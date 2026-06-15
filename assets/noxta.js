/* ============================================================
   NOXTA — shared runtime (chrome behaviours)
   Loaded after GSAP + ScrollTrigger, before any page-specific script.
   Exposes globals: reduced, isTouch, splitChars(), revealST(), gsapReady
   ============================================================ */
var reduced = false, isTouch = false;

/* split an element's text into per-character spans (used by reveals + hero) */
function splitChars(el){
  const text = el.textContent; el.textContent = "";
  return [...text].map(ch => {
    const s = document.createElement("span");
    s.className = "ch"; s.textContent = ch === " " ? "\u00A0" : ch;
    el.appendChild(s); return s;
  });
}

/* scroll-reveal helper — plays forward on enter, rewinds (faster) on leave-back */
function revealST(tw, trigger, start){
  ScrollTrigger.create({trigger, start,
    onEnter: () => tw.timeScale(1).play(),
    onLeaveBack: () => tw.timeScale(2.6).reverse()});
}

/* failsafe: if GSAP didn't load, show everything statically and bail */
if(typeof gsap === "undefined"){
  const l = document.getElementById("loader"); if(l) l.style.display = "none";
  document.body.insertAdjacentHTML("beforeend","<style>.line-mask>span,[data-reveal],.ch{opacity:1!important;transform:none!important}body{cursor:auto}</style>");
  window.gsapReady = false;
} else {
  window.gsapReady = true;
  gsap.registerPlugin(ScrollTrigger);
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  isTouch = matchMedia("(hover: none)").matches || innerWidth < 900;

  /* pause ambient FX (ember canvas + cursor trail) while actively scrolling —
     frees the frame budget for scroll-linked animation (esp. the pinned work pan) */
  var nxScrolling = false, nxScrollTO;
  addEventListener("scroll", () => { nxScrolling = true; clearTimeout(nxScrollTO); nxScrollTO = setTimeout(() => nxScrolling = false, 150); }, {passive:true});

  /* ---- adaptive lite-mode: keep the horizontal scroll, drop the per-frame GPU FX ----
     If a session can't sustain ~45fps with the FX on (Low Power Mode, weak GPU, thermal
     throttle), swap the animated ember canvas → static glow and the custom cursor → native.
     The pinned horizontal scroll stays. */
  var liteMode = false;
  function goLite(){
    if(liteMode) return; liteMode = true;
    document.documentElement.classList.add("lite");
    var e = document.getElementById("embers"); if(e) e.style.display = "none";
    document.querySelectorAll(".cur-dot,.cur-trail").forEach(el => el.remove());
    if(window.__nxWorkMM){ try { window.__nxWorkMM.revert(); } catch(_){} }  // un-pin section 02 → vertical
    if(typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  }
  if(reduced){ goLite(); }
  else addEventListener("load", () => setTimeout(() => {
    var n = 0, sum = 0, last = performance.now();
    (function probe(t){
      if(document.hidden) return;                      // tab backgrounded → don't misjudge
      var dt = t - last; last = t; if(n++) sum += dt;  // skip the first delta
      if(n < 60){ requestAnimationFrame(probe); return; }
      if(sum / (n - 1) > 22) goLite();                 // avg frame >22ms ≈ <45fps sustained
    })(performance.now());
  }, 1200));

  /* ============ EMBER CANVAS ============ */
  (() => {
    const c = document.getElementById("embers"); if(!c) return;
    const x = c.getContext("2d");
    const DPR = Math.min(devicePixelRatio || 1, 1);
    let w, h, parts = [], mx = -9999, my = -9999;
    const N = isTouch ? 22 : 40;
    function size(){ w = c.width = innerWidth * DPR; h = c.height = innerHeight * DPR; c.style.width = innerWidth+"px"; c.style.height = innerHeight+"px"; }
    size(); addEventListener("resize", size);
    /* pre-rendered glow sprites — drawImage is ~20x cheaper than per-frame shadowBlur */
    function sprite(rgb){
      const s = document.createElement("canvas"), S = 32; s.width = s.height = S;
      const ctx = s.getContext("2d");
      const g = ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
      g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(.35, `rgba(${rgb},.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(0,0,S,S);
      return s;
    }
    const SPR = [sprite("255,107,53"), sprite("255,179,138")];
    function spawn(init){
      return {
        x: Math.random()*w, y: init ? Math.random()*h : h + 20,
        r: (Math.random()*1.6 + .5) * DPR * 5,
        vy: (Math.random()*.5 + .18) * DPR,
        vx: (Math.random()-.5) * .25 * DPR,
        o: Math.random()*.55 + .26,
        tw: Math.random()*Math.PI*2,
        sp: Math.random() < .8 ? 0 : 1
      };
    }
    for(let i=0;i<N;i++) parts.push(spawn(true));
    addEventListener("pointermove", e => { mx = e.clientX*DPR; my = e.clientY*DPR; }, {passive:true});
    const R = 130*DPR, R2 = R*R;
    let running = true;
    document.addEventListener("visibilitychange", () => running = !document.hidden);
    let _emberLast = 0;
    function tick(t){
      requestAnimationFrame(tick);
      if(reduced || !running || nxScrolling || liteMode) return;
      if(t - _emberLast < 33) return;   // cap embers ~30fps — slow drift, frees the frame for cursor + scroll
      _emberLast = t;
      x.clearRect(0,0,w,h);
      for(const p of parts){
        p.tw += .03;
        p.y -= p.vy; p.x += p.vx + Math.sin(p.tw)*.15*DPR;
        const dx = p.x-mx, dy = p.y-my, d2 = dx*dx+dy*dy;
        if(d2 < R2){ const d = Math.sqrt(d2)||1, f = (1 - d/R)*.6*DPR; p.x += dx/d*f; p.y += dy/d*f; }
        if(p.y < -20) Object.assign(p, spawn(false));
        x.globalAlpha = p.o * (.5 + Math.sin(p.tw*2)*.5);
        x.drawImage(SPR[p.sp], p.x - p.r/2, p.y - p.r/2, p.r, p.r);
      }
      x.globalAlpha = 1;
    }
    requestAnimationFrame(tick);
  })();

  /* ============ CURSOR — ember dot + comet trail ============ */
  if(!isTouch && !reduced && document.getElementById("curDot")){
    const dot = document.getElementById("curDot");
    const pos = {x: innerWidth/2, y: innerHeight/2};
    addEventListener("pointermove", e => { pos.x = e.clientX; pos.y = e.clientY; }, {passive:true});
    const N = 3, trail = [];
    for(let i=0;i<N;i++){
      const d = document.createElement("div"); d.className = "cur-trail";
      const s = Math.max(5 - i*0.7, 1.5);
      d.style.width = d.style.height = s + "px";
      d.style.opacity = Math.max(0.42 - i*0.07, 0.04).toFixed(2);
      document.body.appendChild(d);
      trail.push({el:d, x:pos.x, y:pos.y});
    }
    let scale = 1, sTarget = 1;
    gsap.ticker.add((tk, dt) => {
      if(nxScrolling || liteMode) return;
      const f = 1 - Math.pow(1 - .35, dt / 16.67);
      scale += (sTarget - scale) * f;
      dot.style.transform = "translate(" + pos.x + "px," + pos.y + "px) translate(-50%,-50%) scale(" + scale + ")";
      let px = pos.x, py = pos.y;
      for(const t of trail){
        t.x += (px - t.x) * f; t.y += (py - t.y) * f;
        t.el.style.transform = "translate(" + t.x + "px," + t.y + "px) translate(-50%,-50%)";
        px = t.x; py = t.y;
      }
    });
    document.querySelectorAll("[data-hover],a,button,.work-shot,[data-hover-view]").forEach(el => {
      el.addEventListener("pointerenter", () => { sTarget = 2.2; }, {passive:true});
      el.addEventListener("pointerleave", () => { sTarget = 1; }, {passive:true});
    });
  }

  /* ============ MAGNETIC BUTTONS ============ */
  if(!isTouch && !reduced){
    document.querySelectorAll("[data-magnetic]").forEach(el => {
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {x:(e.clientX-r.left-r.width/2)*.28, y:(e.clientY-r.top-r.height/2)*.28, duration:.4, ease:"power3.out"});
      });
      el.addEventListener("pointerleave", () => gsap.to(el, {x:0, y:0, duration:.7, ease:"elastic.out(1,.4)"}));
    });
  }

  /* ============ SPOTLIGHT CARDS ============ */
  document.querySelectorAll("[data-spotlight]").forEach(el => {
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX-r.left)+"px");
      el.style.setProperty("--my", (e.clientY-r.top)+"px");
    });
  });

  /* ============ CLOCK ============ */
  const clk = document.getElementById("clock");
  if(clk){
    const tickClock = () => clk.textContent = "TILBURG — " +
      new Date().toLocaleTimeString("nl-NL",{timeZone:"Europe/Amsterdam",hour12:false});
    tickClock(); setInterval(tickClock, 1000);
  }

  /* ============ NAV SCROLL STATE + PROGRESS ============ */
  const navEl = document.getElementById("nav");
  if(navEl){
    ScrollTrigger.create({
      start: 60, end: "max",
      onToggle: self => navEl.classList.toggle("is-scrolled", self.isActive)
    });
  }
  if(document.getElementById("progress")){
    gsap.to("#progress", {scaleX: 1, ease: "none", scrollTrigger: {start: 0, end: "max", scrub: .3}});
  }

  /* ============ GENERIC SCROLL REVEALS ============ */
  if(!reduced){
    /* line masks */
    document.querySelectorAll(".line-mask > span").forEach(el => {
      revealST(gsap.from(el, {yPercent: 115, duration: 1.1, ease: "power4.out", paused: true}), el, "top 88%");
    });
    /* generic reveals (skip hero — handled by its own intro timeline) */
    document.querySelectorAll("[data-reveal]").forEach(el => {
      if(el.closest(".hero")) return;
      revealST(gsap.from(el, {y: 34, opacity: 0, duration: .9, ease: "power3.out", paused: true}), el, "top 90%");
    });
    /* split words in section/work titles */
    document.querySelectorAll("[data-split-words]").forEach(el => {
      const chars = splitChars(el);
      el.style.overflow = "hidden";
      revealST(gsap.from(chars, {yPercent: 110, duration: .9, stagger: .03, ease: "power4.out", paused: true}), el, "top 86%");
    });
    /* parallax decor */
    document.querySelectorAll("[data-parallax]").forEach(el => {
      gsap.to(el, {yPercent: -100 * parseFloat(el.dataset.parallax) * 4, ease: "none",
        scrollTrigger: {trigger: el, start: "top bottom", end: "bottom top", scrub: true}});
    });
  }

  /* ============ COUNT-UP NUMBERS ([data-count]) ============ */
  document.querySelectorAll("[data-count]").forEach(el => {
    const end = +el.dataset.count, pad = +(el.dataset.pad || 0), start = +(el.dataset.start || 0);
    const fmt = v => { let t = Math.round(v).toString(); return pad ? t.padStart(pad, "0") : t; };
    if(reduced){ el.textContent = fmt(end); return; }
    const o = {v: start};
    revealST(gsap.to(o, {v: end, duration: 1.8, ease: "power2.inOut", paused: true,
      onUpdate: () => el.textContent = fmt(o.v)}), el, "top 88%");
  });

  /* ============ SMOOTH ANCHOR SCROLL ============ */
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const id = a.getAttribute("href");
    if(id.length < 2) return;
    const t = document.querySelector(id);
    if(t){ e.preventDefault(); t.scrollIntoView({behavior: reduced ? "auto" : "smooth"}); }
  }));

  /* keep triggers honest after fonts/images settle */
  window.addEventListener("load", () => { if(!reduced) ScrollTrigger.refresh(); });
}
