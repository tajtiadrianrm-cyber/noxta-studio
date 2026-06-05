// Noxta Admin — UI shell.
//
// Responsibilities:
//   • Login screen + sessionStorage password gate
//   • Load /admin/schema.json, paint sidebar (collections + items)
//   • Lazy-fetch each collection's JSON when first opened
//   • Draft clone + JSON-diff dirty detection
//   • Save / discard with SHA tracking via api.js
//   • Topbar (brand, view-site, logout) + Savebar (status + buttons)
//   • Toast notifications
//
// Layout assumptions: see admin/index.html — a single <div id="root">.

import * as api from "./api.js";
import { renderField, el, defaultFor } from "./fields.js";

// ─── State ────────────────────────────────────────────────

const state = {
  schema: null,                  // loaded from schema.json
  activeCollection: null,        // id
  activeItemIndex: null,         // index inside list collection (null for single)
  files: new Map(),              // path → { original, draft }  per-file drafts
  loading: false,
  status: "idle",                // idle | dirty | saving | saved | error
  errorMessage: "",
  ctx: null,                     // shared widget context (media config, toast fn)
  collapsedGroups: loadCollapsedGroups(),  // Set<string> of group names hidden by user
};

function loadCollapsedGroups() {
  try { return new Set(JSON.parse(sessionStorage.getItem("admin-collapsed-groups") || "[]")); }
  catch { return new Set(); }
}
function saveCollapsedGroups() {
  try { sessionStorage.setItem("admin-collapsed-groups", JSON.stringify([...state.collapsedGroups])); } catch {}
}

// ─── Bootstrap ────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("root");
  // Build the toast host once
  const toastHost = el("div", { class: "toast-host", id: "toast-host" });
  document.body.appendChild(toastHost);

  if (!api.getPassword()) {
    renderLogin(root);
    return;
  }
  // Verify the stored password before painting the full UI
  try {
    await api.login();
    // Honor ?return=<url> when set by live-edit.js so users land back on
    // the page they came from instead of getting stuck in /admin/.
    const returnTo = new URLSearchParams(location.search).get("return");
    if (returnTo && isSafeReturn(returnTo)) {
      location.replace(returnTo);
      return;
    }
    await boot(root);
  } catch (e) {
    if (e.status === 401) {
      api.clearPassword();
      renderLogin(root, "Session expired");
    } else {
      renderLogin(root, e.message || "Could not reach the admin backend");
    }
  }
});

// Only follow same-origin paths to avoid open-redirect.
function isSafeReturn(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
}

async function boot(root) {
  state.loading = true;
  try {
    const r = await fetch("/admin/schema.json", { cache: "no-store" });
    if (!r.ok) throw new Error(`schema.json HTTP ${r.status}`);
    state.schema = await r.json();
    state.ctx = {
      media: state.schema.media || { folder: "assets/cms", publicPrefix: "/assets/cms" },
      toast,
    };
  } catch (e) {
    renderFatal(root, "Could not load schema.json: " + e.message);
    return;
  }
  // Pre-load every collection's data so the sidebar shows items immediately
  for (const coll of state.schema.collections || []) {
    try {
      const data = await api.readJson(coll.file);
      state.files.set(coll.file, {
        original: deepClone(data),
        draft: deepClone(data),
      });
    } catch (e) {
      // Non-fatal — keep going. Sidebar will show "Load…" for failed ones.
      if (e.status === 401) { api.clearPassword(); renderLogin(root, "Session expired"); return; }
    }
  }
  // Auto-select the first collection's first item, if any
  const first = (state.schema.collections || [])[0];
  if (first) {
    state.activeCollection = first.id;
    if (first.kind === "list") {
      const items = getListItems(first, state.files.get(first.file)?.draft);
      if (items.length) state.activeItemIndex = 0;
    }
  }
  state.loading = false;
  renderApp(root);
}

// ─── Login screen ─────────────────────────────────────────

function renderLogin(root, errorMsg) {
  root.innerHTML = "";
  const errorEl = el("div", { class: "login-error" }, errorMsg || "");
  const passInput = el("input", { type: "password", autofocus: true, autocomplete: "current-password" });
  const form = el("form", {
    onSubmit: async (e) => {
      e.preventDefault();
      const pw = passInput.value;
      if (!pw) return;
      errorEl.textContent = "";
      api.setPassword(pw);
      try {
        await api.login();
        const returnTo = new URLSearchParams(location.search).get("return");
        if (returnTo && isSafeReturn(returnTo)) {
          location.replace(returnTo);
          return;
        }
        await boot(root);
      } catch (err) {
        api.clearPassword();
        errorEl.textContent = err.status === 401 ? "Wrong password" : (err.message || "Login failed");
        passInput.select();
      }
    },
  },
    el("div", null,
      el("div", { class: "field-label" }, "Password"),
      passInput,
    ),
    errorEl,
    el("button", { type: "submit", class: "btn btn-primary" }, "Sign in"),
  );

  const card = el("div", { class: "login-card" },
    el("div", { class: "login-brand" },
      el("span", null, "No"),
      el("span", { class: "brand-mark" }, "xta"),
      el("span", { class: "brand-sub" }, "Admin"),
    ),
    el("div", { class: "login-title" }, "Welcome back."),
    el("div", { class: "login-sub" }, "Sign in to edit the site."),
    form,
  );

  const screen = el("div", { class: "login" }, card);
  root.appendChild(screen);
  // Focus on first paint
  setTimeout(() => passInput.focus(), 30);
}

// ─── Fatal error (schema load failure, etc.) ─────────────

function renderFatal(root, msg) {
  root.innerHTML = "";
  root.appendChild(
    el("div", { class: "login" },
      el("div", { class: "login-card" },
        el("div", { class: "login-title", style: "color: var(--err);" }, "Admin unavailable"),
        el("div", { class: "login-sub" }, msg),
        el("button", {
          class: "btn btn-ghost",
          onClick: () => location.reload(),
        }, "Reload"),
      ),
    ),
  );
}

// ─── Main app shell ───────────────────────────────────────

function renderApp(root) {
  root.innerHTML = "";

  const topbar = el("header", { class: "topbar" },
    el("div", { class: "topbar-brand" },
      el("span", null, "No"),
      el("span", { class: "brand-mark" }, "xta"),
      el("span", { class: "brand-sub" }, state.schema.site?.name || "Admin"),
    ),
    el("div", { class: "topbar-actions" },
      state.schema.site?.viewUrl
        ? el("a", { class: "btn btn-ghost btn-sm", href: state.schema.site.viewUrl, target: "_blank", rel: "noopener" }, "View site ↗")
        : null,
      el("button", {
        class: "btn btn-ghost btn-sm",
        onClick: () => {
          api.clearPassword();
          location.reload();
        },
      }, "Sign out"),
    ),
  );

  const sidebar  = el("aside", { class: "sidebar" });
  const savebar  = el("div", { class: "savebar" });
  const editor   = el("section", { class: "editor", id: "editor" });
  const app      = el("div", { class: "app" }, topbar, sidebar, savebar, editor);
  root.appendChild(app);

  paintSidebar(sidebar);
  paintSavebar(savebar);
  paintEditor(editor);
}

// ─── Sidebar ──────────────────────────────────────────────

function paintSidebar(host) {
  host.innerHTML = "";
  // Bucket collections by group, preserving schema order
  const groups = new Map(); // groupName → [coll, …]
  for (const coll of state.schema.collections || []) {
    const g = coll.group || "Other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(coll);
  }
  for (const [groupName, collections] of groups.entries()) {
    const collapsed = state.collapsedGroups.has(groupName);
    const groupEl = el("div", { class: "sidebar-group" + (collapsed ? " is-collapsed" : "") });

    // Group header — clickable to toggle collapse
    const header = el("button", {
      class: "sidebar-group-header",
      onClick: () => {
        if (state.collapsedGroups.has(groupName)) state.collapsedGroups.delete(groupName);
        else state.collapsedGroups.add(groupName);
        saveCollapsedGroups();
        paintSidebar(host);
      },
    },
      el("span", { class: "sidebar-group-chevron" }, "▾"),
      el("span", { class: "sidebar-group-label" }, groupName),
      el("span", { class: "sidebar-group-count" }, collections.length === 1 && collections[0].kind === "list" && state.files.get(collections[0].file)
        ? `(${getListItems(collections[0], state.files.get(collections[0].file).draft).length})`
        : ""),
    );
    groupEl.appendChild(header);

    if (!collapsed) {
      const body = el("div", { class: "sidebar-group-body" });
      for (const coll of collections) {
        const file = state.files.get(coll.file);
        if (coll.kind === "list" && file) {
          const items = getListItems(coll, file.draft);
          const list = el("div", { class: "sidebar-list" });
          items.forEach((item, i) => {
            const isActive = state.activeCollection === coll.id && state.activeItemIndex === i;
            list.appendChild(el("button", {
              class: "sidebar-item" + (isActive ? " is-active" : ""),
              onClick: () => selectItem(coll.id, i),
            },
              interpolate(coll.itemLabel || "Item {{i}}", item, i),
              el("span", { class: "sidebar-item-meta" }, "#" + String(i + 1).padStart(2, "0")),
            ));
          });
          body.appendChild(list);
        } else {
          // Single-file collection (or not yet loaded)
          const isActive = state.activeCollection === coll.id;
          body.appendChild(el("button", {
            class: "sidebar-item" + (isActive ? " is-active" : ""),
            onClick: () => selectCollection(coll.id),
          }, coll.kind === "list" ? "Load…" : coll.label || coll.id));
        }
      }
      groupEl.appendChild(body);
    }
    host.appendChild(groupEl);
  }
}

// ─── Savebar ──────────────────────────────────────────────

function paintSavebar(host) {
  host.innerHTML = "";
  host.classList.remove("is-dirty", "is-saving", "is-saved", "is-error");
  if (state.status !== "idle") host.classList.add("is-" + state.status);

  const labelMap = {
    idle:   "No changes",
    dirty:  "Unsaved changes",
    saving: "Saving…",
    saved:  "Saved",
    error:  state.errorMessage || "Save failed",
  };

  host.appendChild(el("div", { class: "savebar-status" },
    el("span", { class: "savebar-dot" }),
    el("span", { class: "savebar-label" }, labelMap[state.status]),
  ));

  const dirty = state.status === "dirty";
  host.appendChild(el("div", { class: "savebar-actions" },
    el("button", {
      class: "btn btn-ghost btn-sm",
      disabled: !dirty,
      onClick: discardChanges,
    }, "Discard"),
    el("button", {
      class: "btn btn-primary btn-sm",
      disabled: !dirty,
      onClick: saveChanges,
    }, "Save"),
  ));
}

// ─── Editor pane ──────────────────────────────────────────

function paintEditor(host) {
  host.innerHTML = "";
  if (!state.activeCollection) {
    host.appendChild(el("div", { class: "editor-empty" }, "Pick something from the left to edit."));
    return;
  }
  const coll = findCollection(state.activeCollection);
  if (!coll) return;
  const file = state.files.get(coll.file);
  if (!file) {
    host.appendChild(el("div", { class: "editor-empty" }, "Loading…"));
    return;
  }

  let item;
  let onChangeItem;

  if (coll.kind === "list") {
    const items = getListItems(coll, file.draft);
    item = items[state.activeItemIndex];
    if (!item) {
      host.appendChild(el("div", { class: "editor-empty" }, "Select an item."));
      return;
    }
    const title = interpolate(coll.itemLabel || "Item {{i}}", item, state.activeItemIndex);
    host.appendChild(el("div", { class: "editor-header" },
      el("div", { class: "editor-title" }, title),
      el("div", { class: "editor-meta" }, coll.label || coll.id + " · #" + String(state.activeItemIndex + 1).padStart(2, "0")),
    ));
    onChangeItem = (newItem) => {
      const draftItems = getListItems(coll, file.draft);
      draftItems[state.activeItemIndex] = newItem;
      setListItems(coll, file.draft, draftItems);
      onAnyChange();
    };
  } else {
    item = file.draft;
    host.appendChild(el("div", { class: "editor-header" },
      el("div", { class: "editor-title" }, coll.label || coll.id),
      el("div", { class: "editor-meta" }, "Single file"),
    ));
    onChangeItem = (newItem) => {
      file.draft = newItem;
      onAnyChange();
    };
  }

  // Render every field for the active item
  for (const fieldSchema of coll.fields || []) {
    host.appendChild(
      renderField(fieldSchema, item[fieldSchema.name], (newVal) => {
        const next = { ...item, [fieldSchema.name]: newVal };
        item = next;
        onChangeItem(next);
        // For list collections, refresh the sidebar item label
        if (coll.kind === "list") refreshSidebarItemLabel(coll, next);
      }, state.ctx),
    );
  }

  // Footer actions for list items (delete)
  if (coll.kind === "list") {
    host.appendChild(el("div", { class: "divider" }));
    host.appendChild(el("button", {
      class: "btn btn-danger btn-sm",
      onClick: () => {
        if (!confirm(`Delete this item?`)) return;
        const draftItems = getListItems(coll, file.draft);
        draftItems.splice(state.activeItemIndex, 1);
        setListItems(coll, file.draft, draftItems);
        state.activeItemIndex = null;
        onAnyChange();
        paintSidebar(document.querySelector(".sidebar"));
        paintEditor(host);
      },
    }, "Delete this item"));
  }
}

function refreshSidebarItemLabel(coll, newItem) {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  // Cheap path: just re-paint the whole sidebar; it's small.
  paintSidebar(sidebar);
}

// ─── Selection + lazy load ────────────────────────────────

async function selectCollection(id) {
  state.activeCollection = id;
  state.activeItemIndex = null;
  const coll = findCollection(id);
  await ensureLoaded(coll);
  if (coll.kind === "list") {
    const items = getListItems(coll, state.files.get(coll.file).draft);
    if (items.length) state.activeItemIndex = 0;
  }
  rerenderAll();
}

async function selectItem(collId, idx) {
  state.activeCollection = collId;
  state.activeItemIndex = idx;
  const coll = findCollection(collId);
  await ensureLoaded(coll);
  rerenderAll();
}

async function ensureLoaded(coll) {
  if (!coll) return;
  if (state.files.has(coll.file)) return;
  try {
    const data = await api.readJson(coll.file);
    state.files.set(coll.file, {
      original: deepClone(data),
      draft: deepClone(data),
    });
  } catch (e) {
    if (e.status === 401) { api.clearPassword(); location.reload(); return; }
    toast(`Load failed: ${e.message}`, "error");
  }
}

// ─── Change tracking ─────────────────────────────────────

function onAnyChange() {
  const anyDirty = [...state.files.values()].some(
    (f) => JSON.stringify(f.original) !== JSON.stringify(f.draft),
  );
  state.status = anyDirty ? "dirty" : "idle";
  paintSavebar(document.querySelector(".savebar"));
}

async function saveChanges() {
  state.status = "saving";
  paintSavebar(document.querySelector(".savebar"));
  let savedAny = false;
  try {
    for (const [path, f] of state.files.entries()) {
      if (JSON.stringify(f.original) === JSON.stringify(f.draft)) continue;
      await api.writeJson(path, f.draft);
      f.original = deepClone(f.draft);
      savedAny = true;
    }
    state.status = "saved";
    state.errorMessage = "";
    paintSavebar(document.querySelector(".savebar"));
    if (savedAny) toast("Saved");
    // Settle back to idle after a beat so the green dot doesn't linger forever
    setTimeout(() => {
      if (state.status === "saved") {
        state.status = "idle";
        paintSavebar(document.querySelector(".savebar"));
      }
    }, 1800);
  } catch (e) {
    state.status = "error";
    state.errorMessage = e.message || "Save failed";
    paintSavebar(document.querySelector(".savebar"));
    if (e.status === 401) {
      toast("Session expired — sign in again", "error");
      api.clearPassword();
      setTimeout(() => location.reload(), 1200);
    } else if (e.status === 409 || /sha/i.test(e.message || "")) {
      toast("File changed since you loaded it — reload to merge", "error");
    } else {
      toast(e.message || "Save failed", "error");
    }
  }
}

function discardChanges() {
  if (!confirm("Discard all unsaved changes?")) return;
  for (const f of state.files.values()) f.draft = deepClone(f.original);
  state.status = "idle";
  state.errorMessage = "";
  rerenderAll();
}

// ─── Helpers ──────────────────────────────────────────────

function findCollection(id) {
  return (state.schema.collections || []).find((c) => c.id === id);
}

function getListItems(coll, fileData) {
  const path = (coll.listPath || "").split(".").filter(Boolean);
  let cur = fileData;
  for (const p of path) cur = cur?.[p];
  if (!Array.isArray(cur)) return [];
  return cur;
}

function setListItems(coll, fileData, newItems) {
  const path = (coll.listPath || "").split(".").filter(Boolean);
  if (!path.length) {
    // Top-level array file — rare; replace root
    return newItems;
  }
  let cur = fileData;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = newItems;
}

function interpolate(tpl, item, i) {
  return String(tpl)
    .replace(/\{\{i\}\}/g, String(i + 1))
    .replace(/\{\{(\w+)\}\}/g, (_, k) => (item && item[k] != null ? String(item[k]) : ""));
}

function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

function rerenderAll() {
  const root = document.getElementById("root");
  const sidebar = root.querySelector(".sidebar");
  const savebar = root.querySelector(".savebar");
  const editor  = root.querySelector(".editor");
  if (!sidebar || !savebar || !editor) {
    renderApp(root);
    return;
  }
  paintSidebar(sidebar);
  paintSavebar(savebar);
  paintEditor(editor);
}

// ─── Toast ────────────────────────────────────────────────

function toast(message, kind = "ok") {
  const host = document.getElementById("toast-host");
  if (!host) return;
  const node = el("div", { class: `toast is-${kind}` }, message);
  host.appendChild(node);
  setTimeout(() => {
    node.style.transition = "opacity 200ms";
    node.style.opacity = "0";
    setTimeout(() => node.remove(), 220);
  }, 2400);
}

// expose for debugging
window.__noxtaAdmin = { state, api };
