/* UNIK'EAU — interactions */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var nav = document.getElementById('nav');
  var fab = document.querySelector('.fab');
  var bar = document.getElementById('progressbar');

  /* ---- Hauteur du héros : la landing remplit l'écran, bandeau compris ---- */
  var marquee = document.querySelector('.marquee');
  function sizeHero() {
    var h = window.innerHeight - (nav ? nav.offsetHeight : 0) - (marquee ? marquee.offsetHeight : 0);
    document.documentElement.style.setProperty('--heroh', Math.max(h, 500) + 'px');
  }
  sizeHero();
  window.addEventListener('load', sizeHero);
  window.addEventListener('resize', sizeHero, { passive: true });

  /* ---- Nav collée, progression, bouton flottant ---- */
  var ticking = false;

  function frame() {
    var y = window.scrollY || window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (nav) nav.classList.toggle('is-stuck', y > 10);
    if (fab) fab.classList.toggle('is-on', y > 600);
    if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    ticking = false;
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(frame);
  }
  frame();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ---- Filtration : navigation par étapes (boutons et circuit cliquable) ---- */
  (function () {
    var lab = document.getElementById('lab');
    if (!lab) return;
    var segs = Array.prototype.slice.call(document.querySelectorAll('#pipe .pnode'));
    var dtls = Array.prototype.slice.call(lab.querySelectorAll('.dtl'));
    var mvs = Array.prototype.slice.call(lab.querySelectorAll('.mv'));
    var uv = lab.querySelector('.uvstage');
    var bar = document.getElementById('labBar');
    var tapOut = document.querySelector('.pipe__dot--out');
    var tag = document.getElementById('labTag');
    var idxEl = document.getElementById('labIdx');
    var accents = ['#1E86D6', '#E8792B', '#2FA84F', '#D6236B', '#46CDEF'];
    var codes = ['PP', 'GAC', 'UF', 'T33', 'UV'];
    var N = segs.length || 5;
    var idx = -1, scanT = null;

    function scan() {
      lab.classList.remove('scanning');
      void lab.offsetWidth;
      lab.classList.add('scanning');
      clearTimeout(scanT);
      scanT = setTimeout(function () { lab.classList.remove('scanning'); }, 650);
    }
    function paint(i, doScan) {
      if (i === idx) return;
      idx = i;
      lab.style.setProperty('--acc', accents[i] || accents[0]);
      segs.forEach(function (s) {
        var si = parseInt(s.getAttribute('data-i'), 10);
        s.classList.toggle('is-active', si === i);
        s.classList.toggle('is-done', si < i);
      });
      dtls.forEach(function (d) { d.classList.toggle('is-active', parseInt(d.getAttribute('data-i'), 10) === i); });
      mvs.forEach(function (m) { m.classList.toggle('is-active', parseInt(m.getAttribute('data-i'), 10) === i); });
      if (uv) uv.classList.toggle('is-active', i === 4);
      if (tag) tag.textContent = 'SCAN · ' + codes[i];
      if (idxEl) idxEl.textContent = ('0' + (i + 1)).slice(-2);
      if (bar) bar.style.width = ((i + 1) / N) * 100 + '%';
      if (tapOut) tapOut.classList.toggle('is-live', i === N - 1);
      if (doScan) scan();
    }
    function go(i) { paint((i % N + N) % N, true); }

    segs.forEach(function (s) {
      var btn = s.querySelector('button');
      if (btn) btn.addEventListener('click', function () { go(parseInt(s.getAttribute('data-i'), 10)); });
    });
    var prev = document.getElementById('labPrev');
    var next = document.getElementById('labNext');
    if (prev) prev.addEventListener('click', function () { go(idx - 1); });
    if (next) next.addEventListener('click', function () { go(idx + 1); });

    paint(0, false);
  })();

  /* ---- Tarifs : bascule Location / Achat ---- */
  (function () {
    var seg = document.getElementById('priceSeg');
    if (!seg) return;
    var btns = { location: document.getElementById('segLocation'), achat: document.getElementById('segAchat') };
    var panes = { location: document.getElementById('modeLocation'), achat: document.getElementById('modeAchat') };
    function setMode(mode) {
      seg.setAttribute('data-mode', mode);
      Object.keys(btns).forEach(function (k) {
        var on = k === mode;
        if (btns[k]) { btns[k].classList.toggle('is-on', on); btns[k].setAttribute('aria-selected', on ? 'true' : 'false'); }
        if (panes[k]) { panes[k].classList.toggle('is-on', on); panes[k].hidden = !on; }
      });
    }
    if (btns.location) btns.location.addEventListener('click', function () { setMode('location'); });
    if (btns.achat) btns.achat.addEventListener('click', function () { setMode('achat'); });
  })();

  /* ---- Héros : inclinaison de la scène au mouvement de souris ---- */
  (function () {
    var frame = document.getElementById('stageTilt');
    var hero = document.getElementById('top');
    if (!frame || !hero || reduced) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    var raf = null, tx = 0, ty = 0;
    hero.addEventListener('mousemove', function (e) {
      var r = frame.getBoundingClientRect();
      tx = ((e.clientX - (r.left + r.width / 2)) / r.width) * 5;
      ty = ((e.clientY - (r.top + r.height / 2)) / r.height) * -4;
      if (!raf) raf = requestAnimationFrame(function () {
        frame.style.transform = 'rotateY(' + tx.toFixed(2) + 'deg) rotateX(' + ty.toFixed(2) + 'deg)';
        raf = null;
      });
    });
    hero.addEventListener('mouseleave', function () {
      frame.style.transform = '';
    });
  })();

  /* ---- Modèles : sélecteur de coloris ---- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-card]'), function (card) {
    var sws = Array.prototype.slice.call(card.querySelectorAll('.sw'));
    var imgs = Array.prototype.slice.call(card.querySelectorAll('.vimg'));
    sws.forEach(function (sw) {
      sw.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = sw.getAttribute('data-v');
        sws.forEach(function (o) { o.classList.toggle('is-on', o === sw); });
        imgs.forEach(function (im) { im.classList.toggle('is-on', im.getAttribute('data-v') === v); });
      });
    });
  });

  /* ---- Tarifs : un plan en grand au toucher (petits écrans) ---- */
  (function () {
    var mq = window.matchMedia('(max-width: 700px)');
    Array.prototype.forEach.call(document.querySelectorAll('.plans'), function (wrap) {
      var plans = Array.prototype.slice.call(wrap.querySelectorAll('.plan'));
      plans.forEach(function (p) {
        p.addEventListener('click', function (e) {
          if (!mq.matches) return;
          if (e.target.closest('a')) return;
          var was = p.classList.contains('is-x');
          plans.forEach(function (o) { o.classList.remove('is-x'); });
          wrap.classList.toggle('has-x', !was);
          if (!was) p.classList.add('is-x');
        });
      });
    });
  })();

  /* ---- Apparition au scroll ---- */
  var targets = document.querySelectorAll(
    '.shead, .cpanel, .compare__arrow, .place, .lifband__card, .mcard, .realstrip, .step, .seg, .plan, .buynote, .plans__note, .law__card, .qa, .cta'
  );
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('in'); });
  } else {
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var i = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = Math.min(i, 5) * 70 + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---- Compteur sur les prix ---- */
  var nums = document.querySelectorAll('[data-count]');
  if (nums.length && !reduced && 'IntersectionObserver' in window) {
    var counter = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var end = parseInt(el.getAttribute('data-count'), 10) || 0;
        var start = performance.now();
        (function tick(now) {
          var p = Math.min((now - start) / 900, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        })(start);
        counter.unobserve(el);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (el) { counter.observe(el); });
  }

  /* ---- Menu mobile ---- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobilemenu');
  function closeMenu() {
    if (!menu || !burger) return;
    menu.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
  }
  if (burger && menu) {
    burger.addEventListener('click', function () {
      if (burger.getAttribute('aria-expanded') === 'true') closeMenu();
      else {
        menu.hidden = false;
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Fermer le menu');
      }
    });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1100) closeMenu(); });
  }

  /* ---- FAQ : une seule réponse ouverte ---- */
  var qas = document.querySelectorAll('.qa');
  qas.forEach(function (qa) {
    qa.addEventListener('toggle', function () {
      if (!qa.open) return;
      qas.forEach(function (other) { if (other !== qa) other.open = false; });
    });
  });

  /* ---- Ancres avec décalage du header ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - ((nav ? nav.offsetHeight : 0) + 14);
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });
})();
