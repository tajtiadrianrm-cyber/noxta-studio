/* =============================================================================
   NOXTA — shared behaviour: page transitions + mobile menu. Loaded on every
   page. Self-contained; does NOT depend on GSAP/Lenis. The pre-paint gates
   (tcover / is-loading / intro-seen) live inline in each page's <head> so they
   run before first paint; this file only wires the runtime behaviour.
   ============================================================================= */
(function(){
  "use strict";
  var docEl = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Page transition — grey cover rises on exit; next page ignites
          grey->orange and wipes up (home = quick reveal). ---- */
  (function(){
    var pt = document.getElementById("ptrans");
    if(!pt) return;

    /* ENTER — only when we arrived via an internal transition (tcover set in
       the <head> before first paint). Home = quick reveal; others = ignite. */
    if(docEl.classList.contains("tcover") && !reduce){
      var isHome = /index\.html$/.test(location.pathname) || location.pathname === "/" || /\/$/.test(location.pathname);
      var finished = false;
      var finish = function(){ if(finished) return; finished = true; pt.style.display = "none"; docEl.classList.remove("is-loading"); };
      var wipe = function(){
        pt.style.transform = "translateY(-100%)";
        docEl.classList.remove("tcover");
        pt.addEventListener("transitionend", function te(ev){ if(ev.propertyName === "transform"){ pt.removeEventListener("transitionend", te); finish(); } });
        setTimeout(finish, 900);
      };
      requestAnimationFrame(function(){
        if(isHome){ wipe(); }                                       // quick reveal
        else { pt.classList.add("is-lit"); setTimeout(wipe, 520); } // ignite, then reveal
      });
    }

    /* EXIT — cover, then navigate, on a click to a DIFFERENT internal .html page. */
    if(!reduce){
      var isInternal = function(a){
        if(a.target === "_blank" || a.hasAttribute("download")) return false;
        var url; try{ url = new URL(a.href, location.href); }catch(e){ return false; }
        if(url.origin !== location.origin) return false;
        if(!/\.html$/.test(url.pathname)) return false;
        if(url.pathname === location.pathname) return false;        // same page (#anchor)
        return true;
      };
      document.addEventListener("click", function(e){
        if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest ? e.target.closest("a[href]") : null;
        if(!a || !isInternal(a)) return;
        e.preventDefault();
        var href = a.getAttribute("href");
        try{ sessionStorage.setItem("noxtaPT", "1"); }catch(_){}
        docEl.classList.add("is-loading");
        pt.style.transform = "translateY(0)";                       // grey cover rises
        var went = false, go = function(){ if(went) return; went = true; window.location.href = href; };
        pt.addEventListener("transitionend", function te(ev){ if(ev.propertyName === "transform"){ pt.removeEventListener("transitionend", te); go(); } });
        setTimeout(go, 650);
      });
    }

    /* bfcache: returning to a page left mid-cover resets it. */
    window.addEventListener("pageshow", function(e){
      if(e.persisted){
        pt.style.transition = "none";
        pt.style.transform = "translateY(100%)";
        pt.style.display = "";
        docEl.classList.remove("is-loading", "tcover");
        requestAnimationFrame(function(){ pt.style.transition = ""; });
      }
    });
  })();

  /* ---- Mobile menu — hamburger toggles a fullscreen overlay. The menu links
          are real <a>s, so the transition / smooth-scroll handlers still fire;
          we just close the overlay on tap. ---- */
  (function(){
    var burger = document.getElementById("navBurger");
    var menu = document.getElementById("menu");
    if(!burger || !menu) return;
    function setOpen(open){
      docEl.classList.toggle("menu-open", open);
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    burger.addEventListener("click", function(){ setOpen(!menu.classList.contains("is-open")); });
    menu.addEventListener("click", function(e){ if(e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function(e){ if(e.key === "Escape" && menu.classList.contains("is-open")) setOpen(false); });
    window.addEventListener("resize", function(){ if(window.innerWidth > 720 && menu.classList.contains("is-open")) setOpen(false); });
  })();

  /* ---- Custom cursor — a single dot that eases toward the pointer.
          Mouse (fine-pointer) devices only; reduced-motion snaps without lag. ---- */
  (function(){
    if(!window.matchMedia("(pointer: fine)").matches) return;     // skip touch / coarse pointers
    var dot = document.createElement("div");
    dot.className = "cursor-dot";
    dot.setAttribute("aria-hidden", "true");
    dot.innerHTML = '<span class="cursor-dot__label">Read</span>';
    document.body.appendChild(dot);

    var mx = 0, my = 0, dx = 0, dy = 0, started = false;
    function render(){
      var ease = reduce ? 1 : 0.2;                                // reduced-motion: no trail
      dx += (mx - dx) * ease;
      dy += (my - dy) * ease;
      dot.style.transform = "translate(" + dx + "px," + dy + "px) translate(-50%,-50%)";
      requestAnimationFrame(render);
    }
    window.addEventListener("mousemove", function(e){
      mx = e.clientX; my = e.clientY;
      if(!started){ started = true; dx = mx; dy = my; dot.classList.add("is-visible"); requestAnimationFrame(render); }
    }, { passive: true });
    document.addEventListener("mouseleave", function(){ dot.classList.remove("is-visible"); });
    document.addEventListener("mouseenter", function(){ if(started) dot.classList.add("is-visible"); });

    /* Expand the dot into a "Read" label while over a project screenshot. */
    Array.prototype.forEach.call(document.querySelectorAll(".workx__shot"), function(shot){
      shot.addEventListener("mouseenter", function(){ dot.classList.add("is-read"); });
      shot.addEventListener("mouseleave", function(){ dot.classList.remove("is-read"); });
    });
  })();
})();
