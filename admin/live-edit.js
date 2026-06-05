// Noxta Admin — live-site edit overlay.
//
// Drops into any HTML page via:
//   <script type="module" src="/admin/live-edit.js"></script>
//
// Activates ONLY when:
//   - URL contains ?edit=1
//   - sessionStorage holds a valid admin password
//
// Walks the DOM for [data-cms-field="<collection>.<json.path>"] markers,
// loads the referenced JSON files from /admin/schema.json's collection map,
// makes the elements contenteditable (text) or click-to-replace (images),
// and writes changes back via /api/admin write-json + upload-image.

import * as api from "./api.js";

const SETTLE_MS = 600;   // wait for React / DOM to settle
const TOAST_MS  = 2400;

// ─── Bootstrap ────────────────────────────────────────────────

(async function bootstrap() {
  const params = new URLSearchParams(location.search);
  if (!params.has("edit")) return;
  if (!api.getPassword()) {
    redirectToLogin();
    return;
  }
  try {
    await api.login();
  } catch (e) {
    if (e.status === 401) { api.clearPassword(); redirectToLogin(); return; }
    return console.warn("[live-edit] login probe failed:", e);
  }

  injectStyles();
  await new Promise((r) => setTimeout(r, SETTLE_MS));

  let schema;
  try {
    schema = await (await fetch("/admin/schema.json", { cache: "no-store" })).json();
  } catch (e) {
    console.error("[live-edit] schema.json load failed:", e);
    return;
  }

  const collFile = new Map();
  for (const c of schema.collections || []) collFile.set(c.id, c.file);

  const media = schema.media || { folder: "assets/cms", publicPrefix: "/assets/cms" };

  const state = {
    files: new Map(),   // file path → { original, draft }
    bindings: [],       // { el, file, path, kind, baseline }
    dirty: false,
    saving: false,
  };

  // Scan DOM
  const elements = Array.from(document.querySelectorAll("[data-cms-field]"));
  if (!elements.length) {
    showToast("No editable fields on this page", "warn");
    renderToolbar(state, schema, media);
    return;
  }

  // Pre-load all referenced files
  const wantedFiles = new Set();
  for (const el of elements) {
    const [coll] = parseField(el.dataset.cmsField);
    const f = collFile.get(coll);
    if (f) wantedFiles.add(f);
  }
  for (const file of wantedFiles) {
    try {
      const data = await api.readJson(file);
      state.files.set(file, { original: deepClone(data), draft: deepClone(data) });
    } catch (e) {
      console.warn(`[live-edit] failed to load ${file}:`, e);
    }
  }

  // Wire each element
  for (const el of elements) {
    const [coll, ...pathParts] = parseField(el.dataset.cmsField);
    const path = pathParts.join(".");
    const file = collFile.get(coll);
    if (!file || !state.files.has(file)) continue;
    const kind = detectKind(el);
    const current = readPath(state.files.get(file).draft, path);
    state.bindings.push({ el, file, path, kind, baseline: current });
    wireElement(el, kind, file, path, state, media);
  }

  renderToolbar(state, schema, media);
  showToast(`Edit mode — ${state.bindings.length} editable field${state.bindings.length === 1 ? "" : "s"}`);
})();

// ─── DOM wiring ───────────────────────────────────────────────

function detectKind(el) {
  if (el.tagName === "IMG") return "image";
  if (el.hasAttribute("data-cms-multiline")) return "multiline";
  return "text";
}

function wireElement(el, kind, file, path, state, media) {
  el.classList.add("nx-le-field");
  el.dataset.nxLeFile = file;
  el.dataset.nxLePath = path;

  if (kind === "text" || kind === "multiline") {
    el.setAttribute("contenteditable", "plaintext-only");
    el.setAttribute("spellcheck", "false");
    el.addEventListener("focus", () => el.classList.add("nx-le-focus"));
    el.addEventListener("blur", () => {
      el.classList.remove("nx-le-focus");
      const newVal = (kind === "multiline" ? el.innerText : el.textContent).trim();
      const file_ = state.files.get(file);
      const oldVal = readPath(file_.draft, path);
      if (String(oldVal ?? "") === newVal) return;
      writePath(file_.draft, path, newVal);
      markDirty(state);
    });
    // Trap Enter for single-line so we don't insert newlines
    if (kind === "text") {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); el.blur(); }
      });
    }
  } else if (kind === "image") {
    el.classList.add("nx-le-image");
    const overlay = document.createElement("div");
    overlay.className = "nx-le-image-overlay";
    overlay.innerHTML = "<span>📷 Click or drop to replace</span>";
    const wrap = wrapElement(el);
    wrap.appendChild(overlay);
    wrap.addEventListener("click", () => openImagePicker(wrap, el, file, path, state, media));
    wrap.addEventListener("dragover", (e) => { e.preventDefault(); wrap.classList.add("nx-le-dragover"); });
    wrap.addEventListener("dragleave", () => wrap.classList.remove("nx-le-dragover"));
    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      wrap.classList.remove("nx-le-dragover");
      handleImageFiles(e.dataTransfer.files, el, file, path, state, media);
    });
  }
}

function wrapElement(el) {
  if (el.parentElement && el.parentElement.classList.contains("nx-le-image-wrap")) return el.parentElement;
  const wrap = document.createElement("span");
  wrap.className = "nx-le-image-wrap";
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  return wrap;
}

function openImagePicker(wrap, imgEl, file, path, state, media) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  input.addEventListener("change", (e) => handleImageFiles(e.target.files, imgEl, file, path, state, media));
  document.body.appendChild(input);
  input.click();
  setTimeout(() => input.remove(), 4000);
}

async function handleImageFiles(files, imgEl, file, path, state, media) {
  const f = files && files[0];
  if (!f) return;
  showToast("Uploading…", "warn");
  try {
    const base64 = await api.fileToBase64(f);
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    const stem = `${Date.now()}-${safeName}`;
    const repoPath = `${media.folder.replace(/\/$/, "")}/${stem}`;
    const publicUrl = `${media.publicPrefix.replace(/\/$/, "")}/${stem}`;
    await api.uploadImage(repoPath, base64);
    imgEl.src = publicUrl;
    const file_ = state.files.get(file);
    writePath(file_.draft, path, publicUrl);
    markDirty(state);
    showToast(`Uploaded ${safeName}`);
  } catch (e) {
    showToast(e.message || "Upload failed", "error");
  }
}

// ─── Toolbar ──────────────────────────────────────────────────

function renderToolbar(state, schema, media) {
  const bar = document.createElement("div");
  bar.id = "nx-le-toolbar";
  bar.innerHTML = `
    <div class="nx-le-brand">
      <span>No<b>xta</b></span><span class="nx-le-meta">Edit mode</span>
    </div>
    <div class="nx-le-status">
      <span class="nx-le-dot"></span>
      <span class="nx-le-label">No changes</span>
    </div>
    <div class="nx-le-actions">
      <button class="nx-le-btn" data-act="discard" disabled>Discard</button>
      <button class="nx-le-btn nx-le-btn-primary" data-act="save" disabled>Save</button>
      <button class="nx-le-btn nx-le-btn-ghost" data-act="exit">Exit</button>
    </div>
  `;
  document.body.appendChild(bar);

  bar.querySelector('[data-act="save"]').addEventListener("click", () => save(state));
  bar.querySelector('[data-act="discard"]').addEventListener("click", () => discard(state));
  bar.querySelector('[data-act="exit"]').addEventListener("click", () => exitEditMode(state));

  updateToolbar(state);
}

function updateToolbar(state) {
  const bar = document.getElementById("nx-le-toolbar");
  if (!bar) return;
  bar.className = "";
  if (state.saving) bar.classList.add("is-saving");
  else if (state.dirty) bar.classList.add("is-dirty");
  const label = state.saving ? "Saving…" : state.dirty ? "Unsaved changes" : "No changes";
  bar.querySelector(".nx-le-label").textContent = label;
  const save = bar.querySelector('[data-act="save"]');
  const disc = bar.querySelector('[data-act="discard"]');
  save.disabled = !state.dirty || state.saving;
  disc.disabled = !state.dirty || state.saving;
}

// ─── State ────────────────────────────────────────────────────

function markDirty(state) {
  state.dirty = computeDirty(state);
  updateToolbar(state);
}

function computeDirty(state) {
  for (const f of state.files.values()) {
    if (JSON.stringify(f.original) !== JSON.stringify(f.draft)) return true;
  }
  return false;
}

async function save(state) {
  if (!state.dirty) return;
  state.saving = true;
  updateToolbar(state);
  try {
    for (const [path, f] of state.files.entries()) {
      if (JSON.stringify(f.original) === JSON.stringify(f.draft)) continue;
      await api.writeJson(path, f.draft);
      f.original = deepClone(f.draft);
    }
    state.dirty = false;
    showToast("Saved");
  } catch (e) {
    if (e.status === 401) { api.clearPassword(); redirectToLogin(); return; }
    showToast(e.message || "Save failed", "error");
  } finally {
    state.saving = false;
    updateToolbar(state);
  }
}

function discard(state) {
  if (!confirm("Discard all unsaved changes on this page?")) return;
  for (const f of state.files.values()) f.draft = deepClone(f.original);
  // Re-paint all bound elements
  for (const b of state.bindings) {
    const val = readPath(state.files.get(b.file).draft, b.path);
    if (b.kind === "text" || b.kind === "multiline") {
      b.el.textContent = String(val ?? "");
    } else if (b.kind === "image" && b.el.tagName === "IMG") {
      b.el.src = normalizeImagePath(val);
    }
  }
  state.dirty = false;
  updateToolbar(state);
  showToast("Discarded");
}

function exitEditMode() {
  const u = new URL(location.href);
  u.searchParams.delete("edit");
  location.href = u.toString();
}

function redirectToLogin() {
  const ret = location.pathname + location.search;
  location.href = "/admin/?return=" + encodeURIComponent(ret);
}

// ─── Helpers ──────────────────────────────────────────────────

function parseField(spec) {
  // "home.hero.title" → ["home", "hero", "title"]
  // "portfolio.items.0.title" → ["portfolio", "items", "0", "title"]
  return String(spec || "").split(".").filter((s) => s.length);
}

function readPath(obj, path) {
  const parts = path.split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function writePath(obj, path, value) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

function normalizeImagePath(p) {
  if (!p) return "";
  if (/^(https?:)?\/\//.test(p) || p.startsWith("/")) return p;
  return "/" + p;
}

function showToast(msg, kind = "ok") {
  let host = document.getElementById("nx-le-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "nx-le-toast-host";
    document.body.appendChild(host);
  }
  const node = document.createElement("div");
  node.className = `nx-le-toast nx-le-toast-${kind}`;
  node.textContent = msg;
  host.appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    setTimeout(() => node.remove(), 200);
  }, TOAST_MS);
}

// ─── Styles ───────────────────────────────────────────────────

function injectStyles() {
  const css = `
    .nx-le-field {
      outline: 1px dashed rgba(255,77,21,0.25) !important;
      outline-offset: 4px;
      cursor: text;
      transition: outline-color 120ms;
    }
    .nx-le-field:hover { outline-color: rgba(255,77,21,0.7) !important; }
    .nx-le-field.nx-le-focus,
    .nx-le-field[contenteditable]:focus {
      outline: 2px solid #ff4d15 !important;
      outline-offset: 4px;
      box-shadow: 0 0 0 6px rgba(255,77,21,0.12);
    }
    .nx-le-field.nx-le-image,
    .nx-le-image-wrap { cursor: pointer; }
    .nx-le-image-wrap {
      position: relative;
      display: inline-block;
      outline: 2px dashed rgba(255,77,21,0.3) !important;
      outline-offset: 4px;
      transition: outline-color 120ms;
    }
    .nx-le-image-wrap:hover { outline-color: rgba(255,77,21,0.7) !important; }
    .nx-le-image-wrap.nx-le-dragover {
      outline: 3px solid #ff4d15 !important;
      box-shadow: 0 0 0 6px rgba(255,77,21,0.12);
    }
    .nx-le-image-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 12px;
      background: linear-gradient(transparent 60%, rgba(0,0,0,0.7));
      color: #fff;
      font: 600 11px/1 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0;
      transition: opacity 160ms;
      pointer-events: none;
    }
    .nx-le-image-wrap:hover .nx-le-image-overlay { opacity: 1; }

    #nx-le-toolbar {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      background: #0a0a0a;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,77,21,0.18);
      color: #f5f6f7;
      font: 600 11px/1 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: 0.16em;
      z-index: 2147483647;
      clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
    }
    #nx-le-toolbar .nx-le-brand {
      display: flex; align-items: baseline; gap: 8px;
      font-family: "Orbitron", system-ui, sans-serif;
      font-size: 13px;
      letter-spacing: 0.04em;
    }
    #nx-le-toolbar .nx-le-brand b {
      background: linear-gradient(100deg, #ff7a3d, #ff4d15);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      font-style: normal;
    }
    #nx-le-toolbar .nx-le-meta {
      color: #8a8786;
      font: 500 10px/1 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    #nx-le-toolbar .nx-le-status { display: flex; align-items: center; gap: 8px; padding: 0 12px; border-left: 1px solid rgba(255,255,255,0.08); border-right: 1px solid rgba(255,255,255,0.08); text-transform: uppercase; }
    #nx-le-toolbar .nx-le-dot { width: 8px; height: 8px; border-radius: 50%; background: #3a3838; transition: background 200ms, box-shadow 200ms; }
    #nx-le-toolbar.is-dirty .nx-le-dot { background: #fbbf24; box-shadow: 0 0 0 4px rgba(251,191,36,0.18); }
    #nx-le-toolbar.is-saving .nx-le-dot { background: #ff4d15; box-shadow: 0 0 0 4px rgba(255,77,21,0.18); animation: nx-le-pulse 900ms infinite ease-in-out; }
    #nx-le-toolbar.is-dirty .nx-le-label { color: #f5f6f7; }
    @keyframes nx-le-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.35); }
    }
    #nx-le-toolbar .nx-le-actions { display: flex; gap: 6px; }
    #nx-le-toolbar .nx-le-btn {
      padding: 8px 14px;
      font: 600 10px/1 "Orbitron", system-ui, sans-serif;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #f5f6f7;
      background: #1a1c1c;
      border: 1px solid rgba(255,255,255,0.08);
      cursor: pointer;
      transition: border-color 120ms, background 120ms;
    }
    #nx-le-toolbar .nx-le-btn:hover { border-color: rgba(255,255,255,0.16); background: #1f2123; }
    #nx-le-toolbar .nx-le-btn[disabled] { opacity: 0.4; pointer-events: none; }
    #nx-le-toolbar .nx-le-btn-primary {
      background: linear-gradient(100deg, #ff7a3d 0%, #ff4d15 50%, #d63a0d 100%);
      border-color: transparent; color: #fff;
    }
    #nx-le-toolbar .nx-le-btn-primary:hover { filter: brightness(1.1); }
    #nx-le-toolbar .nx-le-btn-ghost { background: transparent; }
    #nx-le-toolbar .nx-le-btn-ghost:hover { background: rgba(255,255,255,0.04); }

    #nx-le-toast-host {
      position: fixed;
      bottom: 96px; right: 24px;
      display: grid; gap: 8px;
      z-index: 2147483646;
      pointer-events: none;
    }
    .nx-le-toast {
      background: #0a0a0a;
      border: 1px solid rgba(255,255,255,0.08);
      border-left: 3px solid #ff4d15;
      color: #f5f6f7;
      padding: 12px 16px;
      font: 500 12px/1.4 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: 0.06em;
      min-width: 220px;
      transition: opacity 200ms;
    }
    .nx-le-toast-ok    { border-left-color: #4ade80; }
    .nx-le-toast-warn  { border-left-color: #fbbf24; }
    .nx-le-toast-error { border-left-color: #f87171; color: #f87171; }
  `;
  const tag = document.createElement("style");
  tag.id = "nx-le-styles";
  tag.textContent = css;
  document.head.appendChild(tag);
}
