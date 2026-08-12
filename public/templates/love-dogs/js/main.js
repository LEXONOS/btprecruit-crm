/* Love Dog's — interactions */
(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* header au scroll */
  var hdr = document.querySelector(".hdr");
  function onScroll(){ hdr.classList.toggle("scrolled", window.scrollY > 20); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive:true });

  /* menu mobile */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  function close(){ nav.classList.remove("open"); burger.setAttribute("aria-expanded","false"); burger.setAttribute("aria-label","Ouvrir le menu"); }
  if (burger && nav){
    burger.addEventListener("click", function(){
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    });
    nav.addEventListener("click", function(e){ if (e.target.closest(".nav-link")) close(); });
    document.addEventListener("keydown", function(e){ if (e.key === "Escape") close(); });
  }

  /* révélations au scroll */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold:0.12, rootMargin:"0px 0px -8% 0px" });
    reveals.forEach(function(el){ io.observe(el); });
  } else {
    reveals.forEach(function(el){ el.classList.add("in"); });
  }

  /* surlignage nav actif */
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
  var sections = links.map(function(l){ var id=l.getAttribute("href"); return id && id.length>1 ? document.querySelector(id) : null; }).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length){
    var spy = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){
          var id = "#"+en.target.id;
          links.forEach(function(l){ l.classList.toggle("active", l.getAttribute("href")===id); });
        }
      });
    }, { threshold:0.4, rootMargin:"-45% 0px -50% 0px" });
    sections.forEach(function(s){ spy.observe(s); });
  }
  /* compteurs animés (prix) */
  var counters = document.querySelectorAll(".count");
  function animateCount(el){
    var to = parseInt(el.getAttribute("data-to"), 10) || 0;
    if (reduce){ el.textContent = to; return; }
    var dur = 900, start = null;
    function step(ts){
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased);
      if (p < 1) requestAnimationFrame(step); else el.textContent = to;
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window && counters.length){
    var co = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting){ animateCount(en.target); co.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function(el){ co.observe(el); });
  } else {
    counters.forEach(animateCount);
  }
})();
