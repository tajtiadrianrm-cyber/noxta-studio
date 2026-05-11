/* aurora.js — shared nav, footer, scroll reveals, pill toggles */
(function () {
  'use strict';

  /* ── Nav scroll state ── */
  const nav = document.querySelector('.nav');
  if (nav) {
    const tick = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  }

  /* ── Reveal on scroll ── */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.10, rootMargin: '0px 0px -32px 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }

  /* ── Pill toggles (contact form) ── */
  document.querySelectorAll('.pills').forEach(group => {
    group.querySelectorAll('.pill').forEach(pill => {
      pill.addEventListener('click', () => {
        group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });
  });

  /* ── Contact form submit ── */
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      form.style.display = 'none';
      document.querySelector('.form-success').style.display = 'flex';
    });
  }

  /* ── Year stamp ── */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
})();
