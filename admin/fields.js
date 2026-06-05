// Noxta Admin — widget library.
//
// Each widget renders a field into a container element and reports value
// changes via onChange. The shell owns the state; widgets are dumb.
//
// Widgets supported: string, text, markdown, select, string-list, object,
// list, image, url.
//
// The shell drives interpolation, label rendering, etc. Each widget is just
// the value editor itself.

import { uploadImage, fileToBase64 } from "./api.js";

const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
};

// ─── Atomic widgets ──────────────────────────────────────

function widgetString(value, schema, onChange) {
  return el("input", {
    type: "text",
    class: "field-input",
    value: value ?? "",
    placeholder: schema.placeholder || "",
    onInput: (e) => onChange(e.target.value),
  });
}

function widgetText(value, schema, onChange) {
  return el("textarea", {
    class: "field-textarea",
    rows: schema.rows || 5,
    placeholder: schema.placeholder || "",
    onInput: (e) => onChange(e.target.value),
  }, value ?? "");
}

function widgetSelect(value, schema, onChange) {
  const sel = el("select", {
    class: "field-select",
    onChange: (e) => onChange(e.target.value),
  });
  for (const opt of schema.options || []) {
    const o = el("option", { value: opt }, opt);
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

function widgetUrl(value, schema, onChange) {
  return el("input", {
    type: "url",
    class: "field-input",
    value: value ?? "",
    placeholder: schema.placeholder || "https:// or /path",
    onInput: (e) => onChange(e.target.value),
  });
}

// ─── String-list (chips) ────────────────────────────────

function widgetStringList(value, schema, onChange) {
  const list = Array.isArray(value) ? [...value] : [];
  const host = el("div", { class: "field-chips" });

  const render = () => {
    host.innerHTML = "";
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const chip = el("span", { class: "chip" },
        v,
        el("span", {
          class: "chip-x",
          title: "Remove",
          onClick: () => { list.splice(i, 1); onChange([...list]); render(); },
        }, "×"),
      );
      host.appendChild(chip);
    }
    const input = el("input", {
      class: "field-chips-input",
      type: "text",
      placeholder: schema.placeholder || "Type and press Enter",
      onKeydown: (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          const v = input.value.trim();
          if (v && !list.includes(v)) {
            list.push(v);
            onChange([...list]);
            render();
          }
        } else if (e.key === "Backspace" && input.value === "" && list.length) {
          list.pop();
          onChange([...list]);
          render();
        }
      },
    });
    host.appendChild(input);
    input.focus();
  };
  render();
  // Don't autofocus on initial mount — only on subsequent re-renders.
  host.firstChild && host.lastChild.blur();
  return host;
}

// ─── Object (nested fields) ─────────────────────────────

function widgetObject(value, schema, onChange) {
  const obj = { ...(value || {}) };
  const host = el("div", { class: "field-object" });
  for (const sub of schema.fields || []) {
    const subHost = renderField(sub, obj[sub.name], (newVal) => {
      obj[sub.name] = newVal;
      onChange({ ...obj });
    });
    host.appendChild(subHost);
  }
  return host;
}

// ─── List (collapsible draggable cards) ─────────────────

function widgetList(value, schema, onChange) {
  const items = Array.isArray(value) ? [...value] : [];
  const itemSchema = schema.itemSchema || {};       // { fields: [...] }
  const summaryTpl = schema.itemLabel || "Item {{i}}";
  const host = el("div", { class: "field-list" });
  const openIdx = new Set();

  const interpolate = (tpl, item, i) =>
    String(tpl)
      .replace(/\{\{i\}\}/g, String(i + 1))
      .replace(/\{\{(\w+)\}\}/g, (_, k) => (item && item[k] != null ? String(item[k]) : ""));

  const fireChange = () => onChange(items.map(x => ({ ...x })));

  const render = () => {
    host.innerHTML = "";
    items.forEach((item, i) => {
      const card = el("div", {
        class: "list-card" + (openIdx.has(i) ? " is-open" : ""),
        draggable: true,
        "data-idx": i,
      });
      const summary = interpolate(summaryTpl, item, i);

      // Drag handlers
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(i));
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        host.querySelectorAll(".list-card").forEach(c => c.classList.remove("drop-before", "drop-after"));
      });
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        card.classList.toggle("drop-before", before);
        card.classList.toggle("drop-after", !before);
      });
      card.addEventListener("dragleave", () => {
        card.classList.remove("drop-before", "drop-after");
      });
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        const rect = card.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        let to = i + (before ? 0 : 1);
        if (from < to) to -= 1;
        if (from === to) return;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        // open-state should follow the moved card
        openIdx.clear();
        fireChange();
        render();
      });

      const head = el("div", {
        class: "list-card-head",
        onClick: (e) => {
          if (e.target.closest("[data-no-toggle]")) return;
          openIdx.has(i) ? openIdx.delete(i) : openIdx.add(i);
          render();
        },
      },
        el("span", { class: "list-card-grip", title: "Drag to reorder" }, "⠿"),
        el("span", { class: "list-card-title" }, summary),
        el("span", { class: "list-card-meta" }, "#" + String(i + 1).padStart(2, "0")),
        el("span", { class: "list-card-toggle" }, "▾"),
      );
      card.appendChild(head);

      const body = el("div", { class: "list-card-body" });
      for (const sub of itemSchema.fields || []) {
        const subHost = renderField(sub, item[sub.name], (newVal) => {
          item[sub.name] = newVal;
          fireChange();
          // Re-render summary line only — but simpler: full render
          const titleEl = card.querySelector(".list-card-title");
          if (titleEl) titleEl.textContent = interpolate(summaryTpl, item, i);
        });
        body.appendChild(subHost);
      }
      body.appendChild(el("div", { class: "list-card-actions", style: "margin-top: 16px; display: flex; justify-content: flex-end;" },
        el("button", {
          type: "button",
          "data-no-toggle": true,
          class: "list-card-remove",
          onClick: () => {
            if (!confirm(`Delete "${summary}"?`)) return;
            items.splice(i, 1);
            openIdx.clear();
            fireChange();
            render();
          },
        }, "Delete item"),
      ));
      card.appendChild(body);
      host.appendChild(card);
    });

    const addBtn = el("button", {
      type: "button",
      class: "field-list-add",
      onClick: () => {
        const empty = {};
        for (const sub of itemSchema.fields || []) empty[sub.name] = defaultFor(sub);
        items.push(empty);
        openIdx.clear();
        openIdx.add(items.length - 1);
        fireChange();
        render();
      },
    }, "+ Add " + (schema.itemSingular || "item"));
    host.appendChild(addBtn);
  };
  render();
  return host;
}

// ─── Image upload ──────────────────────────────────────

function widgetImage(value, schema, onChange, ctx) {
  const host = el("div", { class: "field-image" });
  const preview = el("div", { class: "image-preview" });
  const drop    = el("label", { class: "image-drop" });
  const meta    = el("div", { class: "image-meta" });
  const fileInput = el("input", { type: "file", accept: "image/*" });

  function paintPreview(path) {
    preview.innerHTML = "";
    if (path) {
      // Resolve bare filenames (legacy data) against site root, not /admin/
      const src = /^(https?:)?\/\//.test(path) || path.startsWith("/") ? path : "/" + path;
      preview.appendChild(el("img", { src, alt: "" }));
      meta.textContent = path;
    } else {
      preview.appendChild(el("div", { class: "image-preview-empty" }, "No image"));
      meta.textContent = "";
    }
  }
  paintPreview(value);

  async function handleFiles(files) {
    const file = files && files[0];
    if (!file) return;
    if (!ctx || !ctx.media) {
      ctx.toast("Image upload not configured — schema.media missing", "error");
      return;
    }
    drop.classList.add("is-uploading");
    drop.textContent = "Uploading…";
    try {
      const base64 = await fileToBase64(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
      const stem = `${Date.now()}-${safeName}`;
      const path = `${ctx.media.folder.replace(/\/$/, "")}/${stem}`;
      const publicUrl = `${ctx.media.publicPrefix.replace(/\/$/, "")}/${stem}`;
      await uploadImage(path, base64);
      onChange(publicUrl);
      paintPreview(publicUrl);
      ctx.toast(`Uploaded ${safeName}`);
    } catch (err) {
      ctx.toast(err.message || "Upload failed", "error");
    } finally {
      drop.classList.remove("is-uploading");
      drop.textContent = "";
      drop.appendChild(document.createTextNode("Drop or click to upload"));
      drop.appendChild(fileInput);
    }
  }

  drop.appendChild(document.createTextNode("Drop or click to upload"));
  drop.appendChild(fileInput);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-dragover"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  const actions = el("div", { class: "image-actions" },
    value
      ? el("button", {
          type: "button",
          class: "btn btn-ghost btn-sm",
          onClick: () => { onChange(""); paintPreview(""); },
        }, "Clear")
      : null,
  );

  host.appendChild(preview);
  host.appendChild(drop);
  host.appendChild(meta);
  if (value) host.appendChild(actions);
  return host;
}

// ─── Defaults for new items ────────────────────────────

function defaultFor(schema) {
  switch (schema.widget) {
    case "string": case "text": case "markdown": case "url": case "image": return "";
    case "select": return (schema.options || [])[0] || "";
    case "string-list": return [];
    case "object":
      const o = {};
      for (const sub of schema.fields || []) o[sub.name] = defaultFor(sub);
      return o;
    case "list": return [];
    default: return null;
  }
}

// ─── Field renderer (wraps widget with label) ─────────

export function renderField(schema, value, onChange, ctx) {
  const wrap = el("div", { class: "field" });
  if (schema.label) {
    const lbl = el("label", { class: "field-label" },
      schema.label,
      schema.required ? el("span", { style: "color: var(--accent-solid); margin-left: 4px;" }, "*") : null,
      schema.hint ? el("span", { class: "field-hint" }, schema.hint) : null,
    );
    wrap.appendChild(lbl);
  }
  let widget;
  switch (schema.widget) {
    case "string":      widget = widgetString(value, schema, onChange); break;
    case "text":        widget = widgetText(value, schema, onChange); break;
    case "markdown":    widget = widgetText(value, { ...schema, rows: schema.rows || 8 }, onChange); break;
    case "select":      widget = widgetSelect(value, schema, onChange); break;
    case "string-list": widget = widgetStringList(value, schema, onChange); break;
    case "object":      widget = widgetObject(value, schema, onChange); break;
    case "list":        widget = widgetList(value, schema, onChange); break;
    case "image":       widget = widgetImage(value, schema, onChange, ctx); break;
    case "url":         widget = widgetUrl(value, schema, onChange); break;
    default:
      widget = el("div", { style: "color: var(--err); font: 500 11px var(--f-mono);" }, `Unknown widget: ${schema.widget}`);
  }
  wrap.appendChild(widget);
  return wrap;
}

// Re-export for shell convenience
export { el, defaultFor };
