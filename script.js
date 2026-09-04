(function () {
  "use strict";

  var PHONE_WA = "590690672785";
  var EMAIL = "direction@stock-stores.com";

  /* Nav : ombre au scroll, se cache vers le bas, revient vers le haut */
  var nav = document.getElementById("nav");
  var lastY = window.scrollY;
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (y < 40 && !links.classList.contains("is-open")) {
      nav.classList.add("is-top");
    } else {
      nav.classList.remove("is-top");
    }
    if (y > lastY && y > 300 && !links.classList.contains("is-open")) {
      nav.classList.add("is-hidden");
    } else {
      nav.classList.remove("is-hidden");
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  /* Menu mobile */
  var burger = document.getElementById("burger");
  var links = document.getElementById("navLinks");
  function closeMenu() {
    links.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    onScroll();
    burger.setAttribute("aria-label", "Ouvrir le menu");
  }
  burger.addEventListener("click", function () {
    var open = !links.classList.contains("is-open");
    links.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    onScroll();
  });
  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A") closeMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeMenu(); closeLightbox(); }
  });

  /* Galerie : lightbox */
  var items = Array.prototype.slice.call(document.querySelectorAll("#gallery .gallery__item"));
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCap = document.getElementById("lbCap");
  var current = 0;
  var suppressClick = false;
  function show(i) {
    current = (i + items.length) % items.length;
    var img = items[current].querySelector("img");
    var cap = items[current].querySelector("figcaption");
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = cap ? cap.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function openLightbox(i) {
    show(i);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("lbClose").focus();
  }
  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    document.body.style.overflow = "";
  }
  if (lb) items.forEach(function (it, i) {
    it.setAttribute("tabindex", "0");
    it.setAttribute("role", "button");
    it.addEventListener("click", function () { if (!suppressClick) openLightbox(i); });
    it.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(i); }
    });
  });
  if (lb) {
  document.getElementById("lbClose").addEventListener("click", closeLightbox);
  document.getElementById("lbPrev").addEventListener("click", function () { show(current - 1); });
  document.getElementById("lbNext").addEventListener("click", function () { show(current + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
  /* balayage tactile dans la lightbox */
  var touchX = null;
  lb.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
  }

  /* Apparition au scroll */
  var reveals = document.querySelectorAll(".reveal");
  ["bento", "brands", "contact__list--row", "pros__list", "gallery", "steps", "partners__logos"].forEach(function (cls) {
    document.querySelectorAll("." + cls).forEach(function (grid) {
      Array.prototype.forEach.call(grid.children, function (child, i) {
        child.style.setProperty("--d", i);
      });
    });
  });
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* Guide des stores : les schémas se déploient au rythme du scroll */
  var gStage = document.getElementById("gStage");
  if (gStage) {
    var chapters = Array.prototype.slice.call(document.querySelectorAll(".gch"));
    var scenes = ["gs0", "gs1", "gs4", "gs2", "gs3", "gs5"].map(function (id) { return document.getElementById(id); });
    var gName = document.getElementById("gName");
    var gDots = Array.prototype.slice.call(document.querySelectorAll("#gDots i"));
    var NAMES = ["Store bras droits", "Store bras invisibles", "Store coffre", "Store vertical à guides", "Store vertical à coulisses", "Store vertical à coulisses à coffre"];
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var RAD = Math.PI / 180;

    function easeG(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    var SFX = "";
    function G(id) { return document.getElementById(id + SFX); }
    function setA(id, attrs) {
      var el = G(id);
      if (!el) return;
      for (var k in attrs) el.setAttribute(k, attrs[k]);
    }
    function lblOpacity(id, p) {
      var el = G(id);
      if (el) el.style.opacity = Math.max(0, Math.min(1, (p - 0.55) / 0.35)).toFixed(2);
    }

    /* 1. Bras droits : le bras pivote depuis le mur, la toile se déroule et s'incline */
    function drawDroit(p) {
      var Rx = 122, Ry = 108, Px = 122, Py = 300, A = 192;
      var phi = (4 + 58 * p) * RAD;
      var Bx = Px + A * Math.sin(phi), By = Py - A * Math.cos(phi);
      setA("s0arm", { x1: Px, y1: Py, x2: Bx, y2: By });
      setA("s0toileB", { x1: Rx, y1: Ry, x2: Bx, y2: By });
      setA("s0toileF", { x1: Rx, y1: Ry, x2: Bx, y2: By });
      setA("s0bar", { cx: Bx, cy: By });
      setA("s0lamb", { x1: Bx, y1: By + 9, x2: Bx, y2: By + 9 + 20 * p });
      G("s0rays").style.opacity = (p * 0.9).toFixed(2);
      lblOpacity("s0lbl", p);
    }

    /* 2. Bras invisibles : bras articulé en deux segments (coude calculé), toile en avancée */
    function drawBanne(p) {
      var Tx = 142, Ty = 102, dirx = Math.cos(14 * RAD), diry = Math.sin(14 * RAD);
      var reach = 18 + 292 * p;
      var Bx = Tx + reach * dirx, By = Ty + reach * diry;
      var Ax = 150, Ay = 124, L = 150;
      var dx = Bx - Ax, dy = By - Ay;
      var d = Math.min(Math.sqrt(dx * dx + dy * dy), 2 * L - 1);
      var h = Math.sqrt(Math.max(L * L - (d * d) / 4, 0)) * Math.min(1, 0.12 + p * 1.6);
      var ux = dx / (d || 1), uy = dy / (d || 1);
      var Mx = Ax + ux * (d / 2), My = Ay + uy * (d / 2);
      var Ex = Mx - uy * h, Ey = My + ux * h;
      setA("s1a1", { x1: Ax, y1: Ay, x2: Ex, y2: Ey });
      setA("s1a2", { x1: Ex, y1: Ey, x2: Bx, y2: By });
      setA("s1elb", { cx: Ex, cy: Ey });
      setA("s1toileB", { x1: Tx, y1: Ty, x2: Bx, y2: By - 4 });
      setA("s1toileF", { x1: Tx, y1: Ty, x2: Bx, y2: By - 4 });
      setA("s1bar", { cx: Bx, cy: By - 4 });
      setA("s1lamb", { x1: Bx, y1: By + 5, x2: Bx, y2: By + 5 + 18 * p });
      G("s1armg").style.opacity = Math.min(1, 0.1 + p * 2.5).toFixed(2);
      G("s1rays").style.opacity = (p * 0.9).toFixed(2);
      lblOpacity("s1lbl", p);
    }

    /* 3. Vertical à guides : la toile descend le long des câbles */
    function drawCable(p) {
      var h = 4 + 248 * p;
      setA("s2toile", { height: h });
      var barY = 100 + h - 3;
      setA("s2bar", { y: barY });
      setA("s2r1", { cy: barY + 5 });
      setA("s2r2", { cy: barY + 5 });
      lblOpacity("s2lbl", p);
    }

    /* 4. Vertical à coulisses : la toile descend, tenue dans les rails */
    function drawCoul(p) {
      var h = 4 + 254 * p;
      setA("s3toile", { height: h });
      setA("s3bar", { y: 100 + h - 3 });
      lblOpacity("s3lbl", p);
    }


    /* 3. Store coffre : même cinématique que la banne, coffre intégral */
    function drawCoffre(p) {
      var Tx = 142, Ty = 102, dirx = Math.cos(14 * RAD), diry = Math.sin(14 * RAD);
      var reach = 18 + 292 * p;
      var Bx = Tx + reach * dirx, By = Ty + reach * diry;
      var Ax = 150, Ay = 124, L = 150;
      var dx = Bx - Ax, dy = By - Ay;
      var d = Math.min(Math.sqrt(dx * dx + dy * dy), 2 * L - 1);
      var h = Math.sqrt(Math.max(L * L - (d * d) / 4, 0)) * Math.min(1, 0.12 + p * 1.6);
      var ux = dx / (d || 1), uy = dy / (d || 1);
      var Mx = Ax + ux * (d / 2), My = Ay + uy * (d / 2);
      var Ex = Mx - uy * h, Ey = My + ux * h;
      setA("s4a1", { x1: Ax, y1: Ay, x2: Ex, y2: Ey });
      setA("s4a2", { x1: Ex, y1: Ey, x2: Bx, y2: By });
      setA("s4elb", { cx: Ex, cy: Ey });
      setA("s4toileB", { x1: Tx, y1: Ty, x2: Bx, y2: By - 4 });
      setA("s4toileF", { x1: Tx, y1: Ty, x2: Bx, y2: By - 4 });
      setA("s4bar", { cx: Bx, cy: By - 4 });
      setA("s4lamb", { x1: Bx, y1: By + 5, x2: Bx, y2: By + 5 + 18 * p });
      G("s4armg").style.opacity = Math.min(1, 0.1 + p * 2.5).toFixed(2);
      G("s4rays").style.opacity = (p * 0.9).toFixed(2);
      lblOpacity("s4lbl", p);
    }

    /* 6. Vertical à coulisses à coffre : descente dans les rails depuis le coffre */
    function drawCoulCoffre(p) {
      var h = 4 + 246 * p;
      setA("s5toile", { height: h });
      setA("s5bar", { y: 104 + h - 3 });
      lblOpacity("s5lbl", p);
    }

    var DRAW = [drawDroit, drawBanne, drawCoffre, drawCable, drawCoul, drawCoulCoffre];
    var tops = [], heights = [], active = -1, gTicking = false;

    function measure() {
      chapters.forEach(function (c, i) {
        var r = c.getBoundingClientRect();
        tops[i] = r.top + window.scrollY;
        heights[i] = r.height;
      });
    }
    function setActive(i) {
      if (active === i) return;
      active = i;
      scenes.forEach(function (s, k) { s.classList.toggle("is-on", k === i); });
      gDots.forEach(function (d, k) { d.classList.toggle("is-on", k === i); });
      chapters.forEach(function (c, k) { c.classList.toggle("is-active", k === i); });
      gName.textContent = NAMES[i];
    }
    function gFrame() {
      var anchor = window.scrollY + window.innerHeight * 0.55;
      var i = 0;
      for (var k = 0; k < chapters.length; k++) if (anchor > tops[k]) i = k;
      var p = Math.max(0, Math.min(1, (anchor - tops[i]) / Math.max(heights[i], 1)));
      setActive(i);
      DRAW[i](reduce ? 1 : easeG(p));
      gTicking = false;
    }
    function requestG() {
      if (!gTicking) { requestAnimationFrame(gFrame); gTicking = true; }
    }

    /* Version mobile : chaque fiche embarque sa propre scène, animée au défilement */
    var mobileAnims = [];
    (function buildInline() {
      chapters.forEach(function (c, i) {
        var scene = scenes[i];
        if (!scene) return;
        var sfx = "-m" + i;
        var wrap = document.createElement("figure");
        wrap.className = "gch__anim";
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 560 430");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Animation du mécanisme : " + NAMES[i]);
        var clone = scene.cloneNode(true);
        clone.removeAttribute("id");
        clone.classList.add("is-on");
        Array.prototype.forEach.call(clone.querySelectorAll("[id]"), function (el) { el.id = el.id + sfx; });
        svg.appendChild(clone);
        wrap.appendChild(svg);
        var anchorEl = c.querySelector(".gch__how");
        anchorEl.parentNode.insertBefore(wrap, anchorEl.nextSibling);
        mobileAnims.push({ el: wrap, sfx: sfx, i: i });
      });
    
  /* ===== Parallaxe douce au défilement ===== */
  (function () {
    var reduceP = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceP) return;
    var heroImg = document.querySelector(".hero__img");
    var pItems = Array.prototype.slice.call(document.querySelectorAll(".bento__photo img, .gch__photo:not(.gch__photo--schema)>img"));
    var tick = false;
    function frame() {
      tick = false;
      var vh = window.innerHeight;
      if (heroImg) {
        var y = Math.min(window.scrollY, vh);
        heroImg.style.translate = "0 " + (y * 0.22).toFixed(1) + "px";
      }
      pItems.forEach(function (img) {
        var r = img.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var c = (r.top + r.height / 2 - vh / 2) / vh;
        img.style.translate = "0 " + (c * -14).toFixed(1) + "px";
        img.style.scale = "1.06";
      });
    }
    window.addEventListener("scroll", function () {
      if (!tick) { tick = true; requestAnimationFrame(frame); }
    }, { passive: true });
    frame();
  })();
})();
    var mqMobile = window.matchMedia("(max-width:980px)");
    var mobState = mobileAnims.map(function () { return { cur: 0, target: 0 }; });
    var mobRunning = false;
    function mobTargets() {
      if (!mqMobile.matches) return;
      var vh = window.innerHeight;
      mobileAnims.forEach(function (a, k) {
        var r = a.el.getBoundingClientRect();
        if (r.top > vh + 120) { mobState[k].target = 0; return; }
        /* le déploiement s'étale sur presque toute la traversée de l'écran */
        mobState[k].target = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.88)));
      });
    }
    function mobTick() {
      var busy = false;
      mobileAnims.forEach(function (a, k) {
        var st = mobState[k];
        var d = st.target - st.cur;
        if (Math.abs(d) > 0.0015) {
          /* lissage : même un défilement rapide donne un déploiement progressif */
          st.cur += d * 0.075;
          SFX = a.sfx;
          DRAW[a.i](reduce ? 1 : easeG(st.cur));
          SFX = "";
          busy = true;
        }
      });
      if (busy) requestAnimationFrame(mobTick); else mobRunning = false;
    }
    function mobKick() {
      mobTargets();
      if (reduce) {
        mobileAnims.forEach(function (a, k) { SFX = a.sfx; DRAW[a.i](1); SFX = ""; mobState[k].cur = 1; });
        return;
      }
      if (!mobRunning) { mobRunning = true; requestAnimationFrame(mobTick); }
    }
    window.addEventListener("scroll", mobKick, { passive: true });
    window.addEventListener("load", mobKick);
    window.addEventListener("resize", mobKick);

    DRAW.forEach(function (fn, k) { fn(reduce ? 1 : (k === 0 ? 0.06 : 0)); });
    measure();
    gFrame();
    mobKick();
    window.addEventListener("scroll", requestG, { passive: true });
    window.addEventListener("resize", function () { measure(); requestG(); });
    window.addEventListener("load", function () { measure(); gFrame(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); });
  }

  /* Boutons "devis pour ce modèle" : préremplissent le type */
  document.querySelectorAll("[data-store]").forEach(function (a) {
    a.addEventListener("click", function () {
      var sel = document.getElementById("f-type");
      if (sel) sel.value = a.getAttribute("data-store");
    });
  });

  /* Carrousel réalisations : flèches + glisser à la souris */
  var track = document.getElementById("carTrack");
  if (track) {
    var prev = document.getElementById("carPrev"), next = document.getElementById("carNext");
    function step() { var first = track.querySelector(".gallery__item"); return first ? first.offsetWidth + 20 : 400; }
    prev.addEventListener("click", function () { track.scrollBy({ left: -step(), behavior: "smooth" }); });
    next.addEventListener("click", function () { track.scrollBy({ left: step(), behavior: "smooth" }); });
    function updateNav() {
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }
    track.addEventListener("scroll", updateNav, { passive: true });
    window.addEventListener("resize", updateNav);
    updateNav();
    var down = false, startX = 0, startL = 0, moved = false;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      down = true; moved = false; startX = e.clientX; startL = track.scrollLeft;
      track.classList.add("is-dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startL - dx;
    });
    window.addEventListener("pointerup", function () {
      if (!down) return;
      down = false; track.classList.remove("is-dragging");
      if (moved) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 50); }
    });
  }

  /* Année du footer */
  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
