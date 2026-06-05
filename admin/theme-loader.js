// Noxta — runtime theme loader.
// Fetches /content/theme.json and applies the colors to CSS custom
// properties on <html>. Variable names match what every page's inline
// :root block already defines, so any hard-coded value gets overridden
// at runtime. Runs early (before paint) to avoid flash.

(async function () {
  let t;
  try {
    const res = await fetch("/content/theme.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    t = await res.json();
  } catch (_) { return; }
  if (!t || typeof t !== "object") return;

  // Expose for any consumer (live-edit overlay etc.) that wants to react.
  window.__THEME__ = t;

  // Observer is initialized BEFORE first apply() so apply() can safely
  // disconnect/reconnect to avoid an infinite mutation loop.
  let obs = null;
  try {
    obs = new MutationObserver(() => apply(t));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  } catch (_) { /* observer optional */ }

  // Apply once now, again after React mounts (each page has a useEffect
  // that resets --accent-solid from its own ACCENTS preset on mount —
  // we win the race by re-applying afterward).
  apply(t);
  setTimeout(() => apply(t), 50);
  setTimeout(() => apply(t), 250);
  setTimeout(() => apply(t), 800);

  function apply(t) {
    if (obs) obs.disconnect();
    const r = document.documentElement;
    if (t.bg)      r.style.setProperty("--bg", t.bg);
    if (t.bgSoft)  r.style.setProperty("--bg-soft", t.bgSoft);
    if (t.bgTint)  r.style.setProperty("--bg-tint", t.bgTint);
    if (t.ink)     r.style.setProperty("--ink", t.ink);
    if (t.inkSoft) r.style.setProperty("--ink-soft", t.inkSoft);
    if (t.mute)    r.style.setProperty("--mute", t.mute);

    // Pages' CSS uses --cyan / --violet / --pink as legacy names for the
    // 3-stop accent gradient (light, mid, dark). Map cleaner names back.
    if (t.accentLight) r.style.setProperty("--cyan",   t.accentLight);
    if (t.accentDark)  r.style.setProperty("--pink",   t.accentDark);
    if (t.accentSolid) {
      r.style.setProperty("--violet",       t.accentSolid);
      r.style.setProperty("--accent-solid", t.accentSolid);
      const rgb = hexToRgb(t.accentSolid);
      if (rgb) r.style.setProperty("--accent-glow", `rgba(${rgb}, 0.5)`);
    }
    if (t.accentLight && t.accentSolid && t.accentDark) {
      r.style.setProperty(
        "--accent",
        `linear-gradient(100deg, ${t.accentLight} 0%, ${t.accentSolid} 50%, ${t.accentDark} 100%)`
      );
    }
    if (obs) obs.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  }

  function hexToRgb(hex) {
    const m = String(hex).trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }
})();
