/* ============================================================
   Noxta Studio — interactions
   - Nav scroll state
   - Reveal-on-scroll (IntersectionObserver)
   - VOEP visual reveal toggle (homepage)
   - Tweaks panel: accent color swatches (vanilla)
   ============================================================ */

(function () {
  'use strict';

  /* -------- Nav scroll state -------- */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -------- Reveal on scroll -------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* -------- VOEP visual reveal -------- */
  const caseVisual = document.querySelector('.case__visual');
  if (caseVisual) {
    caseVisual.addEventListener('click', () => {
      caseVisual.classList.toggle('is-revealed');
    });
  }

  /* ============================================================
     Tweaks panel — accent color swatches
     Defaults are wrapped in EDITMODE markers so the host can
     persist a chosen swatch across reloads.
     ============================================================ */
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent": "cyan"
  }/*EDITMODE-END*/;

  const ACCENTS = {
    cyan:   { c: '#06b6d4', name: 'Cyan',         soft: 'rgba(6,182,212,0.12)',   ink: '#064e5e' },
    blue:   { c: '#2563eb', name: 'Electric blue', soft: 'rgba(37,99,235,0.12)',  ink: '#1e3a8a' },
    lime:   { c: '#84cc16', name: 'Lime',          soft: 'rgba(132,204,22,0.14)', ink: '#3f6212' },
    orange: { c: '#ff5722', name: 'Hot orange',    soft: 'rgba(255,87,34,0.12)',  ink: '#7c2d12' }
  };

  function applyAccent(key) {
    const a = ACCENTS[key] || ACCENTS.cyan;
    const root = document.documentElement;
    root.style.setProperty('--accent', a.c);
    root.style.setProperty('--accent-soft', a.soft);
    root.style.setProperty('--accent-ink', a.ink);
    // glow recolor for CTA radial
    const cta = document.querySelector('.cta');
    if (cta) {
      cta.style.setProperty('--accent-glow', a.soft);
    }
    // active swatch
    document.querySelectorAll('.swatch').forEach((s) => {
      s.classList.toggle('is-active', s.dataset.accent === key);
    });
    const nameEl = document.querySelector('[data-tweaks-name]');
    if (nameEl) nameEl.innerHTML = '<b>' + a.name + '</b>';
  }

  // initial application
  applyAccent(TWEAK_DEFAULTS.accent);

  // Build swatches in any tweaks panel that exists
  const swatchHost = document.querySelector('.swatches');
  if (swatchHost) {
    Object.entries(ACCENTS).forEach(([key, val]) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.accent = key;
      b.style.setProperty('--c', val.c);
      b.setAttribute('aria-label', val.name);
      b.title = val.name;
      b.addEventListener('click', () => {
        applyAccent(key);
        try {
          window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { accent: key } }, '*');
        } catch (e) {}
      });
      swatchHost.appendChild(b);
    });
    applyAccent(TWEAK_DEFAULTS.accent);
  }

  /* -------- Tweaks panel host protocol -------- */
  const panel = document.querySelector('.tweaks');
  const closeBtn = document.querySelector('.tweaks__close');

  function openPanel() { panel && panel.classList.add('is-open'); }
  function closePanel() {
    if (!panel) return;
    panel.classList.remove('is-open');
    try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (e) {}
  }

  window.addEventListener('message', (e) => {
    const t = e.data && e.data.type;
    if (t === '__activate_edit_mode') openPanel();
    if (t === '__deactivate_edit_mode') closePanel();
  });

  if (closeBtn) closeBtn.addEventListener('click', closePanel);

  // announce availability
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}

  /* -------- Marquee duplication (so it loops seamlessly) -------- */
  document.querySelectorAll('.marquee__track').forEach((track) => {
    const inner = track.innerHTML;
    track.innerHTML = inner + inner;
  });

  /* -------- Year stamp -------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
})();
