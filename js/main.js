/* Lomaya · interactions du site (sans dépendance) */
(function () {
  'use strict';
  var C = window.LOMAYA || {};
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;
  var FUSEAU = C.fuseau || 'America/Guadeloupe';
  var NAV_LARGE = '(min-width: 1101px)'; // même seuil que la feuille de style

  // ---------- Entrée de page : après les polices, sans jamais attendre plus de 0,7 s ----------
  function pret() { body.classList.add('est-pret'); }
  if (document.fonts && document.fonts.ready) {
    var garde = setTimeout(pret, 700);
    document.fonts.ready.then(function () { clearTimeout(garde); requestAnimationFrame(pret); });
  } else { pret(); }

  // ---------- Photos : une photo qui ne charge pas laisse un aplat sobre ----------
  document.querySelectorAll('.photo img, .hero__photo img').forEach(function (img) {
    var boite = img.closest('.photo, .hero__photo');
    function absente() { boite.classList.add('photo--absente'); }
    // currentSrc est vide tant qu'une image différée (loading="lazy") n'a pas commencé à charger
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) absente();
    img.addEventListener('error', absente);
    img.addEventListener('load', function () { boite.classList.remove('photo--absente'); });
  });

  // ---------- Date d'ouverture et tarifs d'ouverture ----------
  (function () {
    var o = C.offreOuverture || {};
    var aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(new Date());
    var active = !!o.actif && !(o.fin && aujourdhui > o.fin);
    function euros(c) { return (c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\s/g, ' ') + ' €'; }
    var formules = C.formules || [];
    var solo = formules.filter(function (f) { return f.id === 'solo'; })[0];
    var duo = formules.filter(function (f) { return f.id === 'duo'; })[0];

    if (!active) {
      document.querySelectorAll('[data-si-ouverture]').forEach(function (e) { e.hidden = true; });
      document.querySelectorAll('[data-prix]').forEach(function (e) { e.textContent = e.getAttribute('data-prix') + ' €'; });
    }
    var libTarif = document.querySelector('[data-tarif-libelle]'), valTarif = document.querySelector('[data-tarif-valeur]');
    if (libTarif && valTarif && solo && duo) {
      libTarif.textContent = active ? 'Tarif d’ouverture' : 'Tarifs';
      valTarif.textContent = euros(active ? solo.prixOuverture : solo.prix) + ' solo · ' + euros(active ? duo.prixOuverture : duo.prix) + ' duo';
    }
    var ouv = document.querySelector('[data-ouverture]');
    if (!ouv) return;
    var lib = ouv.querySelector('[data-ouverture-libelle]'), val = ouv.querySelector('[data-ouverture-texte]');
    if (C.ouverture && aujourdhui < C.ouverture) {
      var mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(C.ouverture + 'T12:00:00Z'));
      val.textContent = mois.charAt(0).toUpperCase() + mois.slice(1);
    } else {
      // Une fois ouvert, l'emplacement sert à l'adresse
      lib.textContent = 'Adresse';
      val.textContent = 'ZI Jarry, Baie-Mahault';
    }
  })();

  // ---------- En-tête : transparent sur la photo d'accueil, papier ensuite, caché quand on descend ----------
  var entete = document.getElementById('entete');
  var hero = document.getElementById('accueil');
  var seuil = 30, dernierY = window.scrollY, plein = null, cache = false, menuOuvert = false;
  function mesurer() { seuil = hero ? Math.max(30, hero.offsetHeight - entete.offsetHeight - 10) : 30; }
  function surDefilement() {
    var y = window.scrollY;
    var doitEtrePlein = y > seuil || menuOuvert;
    if (doitEtrePlein !== plein) { plein = doitEtrePlein; entete.classList.toggle('est-plein', plein); }
    var descend = y > dernierY + 6, monte = y < dernierY - 6;
    if (descend && y > 480 && !cache && !menuOuvert) { cache = true; entete.classList.add('est-cache'); }
    else if ((monte || y < 200) && cache) { cache = false; entete.classList.remove('est-cache'); }
    if (descend || monte) dernierY = y;
  }
  mesurer();
  window.addEventListener('scroll', surDefilement, { passive: true });
  window.addEventListener('resize', function () { mesurer(); surDefilement(); });
  surDefilement();

  // Lien actif de la navigation
  var liens = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  if ('IntersectionObserver' in window && liens.length) {
    var parId = {};
    liens.forEach(function (a) { parId[a.getAttribute('href').slice(1)] = a; });
    var obsNav = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        var a = parId[e.target.id];
        if (!a) return;
        if (e.isIntersecting) { liens.forEach(function (l) { l.classList.remove('est-actif'); }); a.classList.add('est-actif'); }
        else a.classList.remove('est-actif');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(parId).forEach(function (id) { var s = document.getElementById(id); if (s) obsNav.observe(s); });
  }

  // ---------- Menu du téléphone ----------
  var burger = document.querySelector('.burger');
  var menu = document.getElementById('menu');
  function basculerMenu(ouvrir) {
    menuOuvert = typeof ouvrir === 'boolean' ? ouvrir : !menuOuvert;
    burger.setAttribute('aria-expanded', String(menuOuvert));
    burger.setAttribute('aria-label', menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.classList.toggle('est-ouvert', menuOuvert);
    menu.setAttribute('aria-hidden', String(!menuOuvert));
    body.classList.toggle('verrou', menuOuvert);
    if (menuOuvert) {
      entete.classList.remove('est-cache'); cache = false;
      setTimeout(function () { var p = menu.querySelector('a'); if (p) p.focus({ preventScroll: true }); }, 300);
    }
    surDefilement();
  }
  if (burger && menu) {
    burger.addEventListener('click', function () { basculerMenu(); });
    menu.addEventListener('click', function (ev) { if (ev.target.closest('a, [data-reserver]')) basculerMenu(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && menuOuvert) { basculerMenu(false); burger.focus(); } });
    document.addEventListener('lomaya:fermer-menu', function () { if (menuOuvert) basculerMenu(false); });
    window.matchMedia(NAV_LARGE).addEventListener('change', function (m) { if (m.matches && menuOuvert) basculerMenu(false); });
  }

  // ---------- Apparitions au défilement (textes, photos, frise de la séance) ----------
  var apparitions = document.querySelectorAll('.apparait, .revele, .frise');
  if (!reduit && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('est-visible');
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    apparitions.forEach(function (e) { obs.observe(e); });
  } else {
    apparitions.forEach(function (e) { e.classList.add('est-visible'); });
  }

  // ---------- Questions : ouverture en douceur ----------
  document.querySelectorAll('.question').forEach(function (d) {
    var resume = d.querySelector('summary'), contenu = d.querySelector('.question__reponse');
    var enCours = null;
    resume.addEventListener('click', function (ev) {
      if (reduit || !contenu.animate) return;
      ev.preventDefault();
      if (enCours) enCours.cancel();
      if (d.open) {
        var h0 = contenu.offsetHeight;
        d.classList.add('se-ferme');
        enCours = contenu.animate([{ height: h0 + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' });
        enCours.onfinish = function () { d.open = false; d.classList.remove('se-ferme'); enCours = null; };
      } else {
        d.open = true;
        var h1 = contenu.offsetHeight;
        enCours = contenu.animate([{ height: '0px', opacity: 0 }, { height: h1 + 'px', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.7,.2,1)' });
        enCours.onfinish = function () { enCours = null; };
      }
    });
  });

  // ---------- Barre du téléphone : visible dès que le bouton de l'accueil sort de l'écran ----------
  (function () {
    var barre = document.querySelector('[data-barre-mobile]');
    var cible = document.querySelector('.hero__actions') || hero;
    var pied = document.querySelector('.pied');
    if (!barre || !cible || !('IntersectionObserver' in window)) return;
    var apresHero = false, surPied = false, resaOuverte = false;
    function maj() { barre.classList.toggle('est-visible', apresHero && !surPied && !resaOuverte && !menuOuvert); }
    new IntersectionObserver(function (e) { apresHero = !e[0].isIntersecting; maj(); }, { threshold: 0.5 }).observe(cible);
    if (pied) new IntersectionObserver(function (e) { surPied = e[0].isIntersecting; maj(); }).observe(pied);
    document.addEventListener('lomaya:resa', function (e) { resaOuverte = e.detail.ouvert; maj(); });
    if (burger) burger.addEventListener('click', function () { setTimeout(maj, 0); });
  })();

  // ---------- Horaires lus dans le CRM ----------
  document.addEventListener('lomaya:info', function (e) {
    var t = e.detail && e.detail.entreprise && e.detail.entreprise.horaires_texte;
    var cible = document.querySelector('[data-horaires]');
    if (t && cible) cible.textContent = t.charAt(0).toUpperCase() + t.slice(1);
  });

  document.querySelectorAll('[data-annee]').forEach(function (e) { e.textContent = new Date().getFullYear(); });
})();
