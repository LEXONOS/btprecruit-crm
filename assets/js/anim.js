/* L'Officine : mise en mouvement (Lenis + GSAP ScrollTrigger, repli CSS sinon) */
(function(){
'use strict';
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var G = window.gsap, ST = window.ScrollTrigger;
var avecGsap = !!(G && ST) && !reduit;
var large = function(){ return window.innerWidth > 800; };

/* ---------- Defilement doux ---------- */
if (avecGsap && window.Lenis && window.matchMedia('(hover:hover)').matches){
  G.registerPlugin(ST);
  var lenis = new window.Lenis({duration: 1.15, smoothWheel: true});
  window.OfficineLenis = lenis;
  lenis.on('scroll', ST.update);
  G.ticker.add(function(t){ lenis.raf(t * 1000); });
  G.ticker.lagSmoothing(0);
  if (document.body.classList.contains('fige')) lenis.stop();
  document.addEventListener('officine:entree', function(){ lenis.start(); });
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href^="#"], a[href*="#"]');
    if (!a) return;
    var u = new URL(a.href);
    if (u.pathname !== location.pathname || !u.hash) return;
    var cible = document.querySelector(u.hash);
    if (cible){ e.preventDefault(); lenis.scrollTo(cible, {offset: -80}); }
  });
} else if (avecGsap){ G.registerPlugin(ST); }

/* ---------- Decoupage en lignes ---------- */
function decouperLignes(el){
  if (el.dataset.decoupe) return;
  el.dataset.decoupe = '1';
  var html = el.innerHTML;
  var morceaux = html.split(/(<br\s*\/?>)/i);
  var mots = [];
  el.innerHTML = morceaux.map(function(m){
    if (/^<br/i.test(m)) return '<span class="w br"></span>';
    return m.trim().split(/\s+/).filter(Boolean).map(function(w){ return '<span class="w">' + w + '</span>'; }).join(' ');
  }).join(' ');
  var lignes = [], courant = null, haut = null;
  $$('.w', el).forEach(function(w){
    if (w.classList.contains('br')){ courant = null; haut = null; return; }
    var t = w.offsetTop;
    if (courant === null || Math.abs(t - haut) > 4){ courant = []; lignes.push(courant); haut = t; }
    courant.push(w.innerHTML);
  });
  el.innerHTML = lignes.map(function(l, i){ return '<span class="ln"><span style="--i:' + i + '">' + l.join(' ') + '</span></span>'; }).join('');
}
function prepLignes(){
  $$('.lignes').forEach(decouperLignes);
}

/* ---------- Apparitions ---------- */
var obs = new IntersectionObserver(function(en){
  en.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('vu'); obs.unobserve(e.target); } });
}, {threshold: .12, rootMargin: '0px 0px -6% 0px'});
function surveiller(racine){
  $$('.rv:not([data-entree-rv]), [data-revele], .lignes:not([data-entree])', racine).forEach(function(el){ obs.observe(el); });
}
document.addEventListener('officine:contenu', function(e){ surveiller(e.detail); });
/* ---------- Écran de chargement : après le mur d'âge, l'écrin se remplit ---------- */
var ecran = $('#chargement');
function lancerChargement(fin){
  if (!ecran || !avecGsap || reduit){ if (ecran) ecran.remove(); fin(); return; }
  ecran.hidden = false; ecran.classList.add('on');
  document.body.classList.add('charge');
  var pcEl = $('#chPc'), mot = $('#chMot'), liquide = $('.ch-liquide', ecran);
  var mots = ['Ouverture de l\u2019atelier', 'Mise en place des flacons', 'Derniers réglages'];
  var aff = 0, reel = 0, fini = false;
  G.set(liquide, {attr: {y: 194}});
  G.to('.ch-trait', {strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut', stagger: .12});
  G.to('.ch-cle', {opacity: .9, duration: 1, delay: .5});
  var rendre = function(v){
    pcEl.textContent = Math.round(v);
    G.set(liquide, {attr: {y: 194 - 188 * v / 100}});
    mot.textContent = mots[Math.min(2, Math.floor(v / 38))];
  };
  var tic = function(){
    var plafond = Math.min(94, aff + .55);
    var cible = reel > aff ? Math.max(reel, plafond) : plafond;
    aff += Math.max(.12, (cible - aff) * .08);
    if (aff > cible) aff = cible;
    if (aff > 100) aff = 100;
    rendre(aff);
    if (aff >= 99.5 && !fini) terminer();
  };
  G.ticker.add(tic);
  var terminer = function(){
    fini = true; G.ticker.remove(tic); rendre(100);
    var tl = G.timeline({onComplete: function(){ ecran.remove(); document.body.classList.remove('charge'); }});
    tl.to('.ch-centre', {y: -14, duration: .5, ease: 'power2.out'})
      .to('.ch-ecrin', {scale: 1.14, duration: .9, ease: 'expo.in'}, '<')
      .to(['.ch-pc', '.ch-mot'], {opacity: 0, y: 10, duration: .35, ease: 'power2.in'}, '<')
      .add(fin, '-=.15')
      .to(ecran, {clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut'}, '<')
      .to('.ch-centre', {opacity: 0, duration: .4}, '<');
  };
  /* progression réelle : polices, images, vidéo */
  var taches = [];
  if (document.fonts && document.fonts.ready) taches.push(document.fonts.ready);
  $$('img').slice(0, 14).forEach(function(im){
    if (im.complete) return;
    taches.push(new Promise(function(ok){ im.addEventListener('load', ok, {once: true}); im.addEventListener('error', ok, {once: true}); }));
  });
  var v = $('.hero video');
  if (v && v.readyState < 3) taches.push(new Promise(function(ok){ v.addEventListener('canplay', ok, {once: true}); v.addEventListener('error', ok, {once: true}); }));
  taches.push(new Promise(function(ok){ document.addEventListener('officine:contenu', ok, {once: true}); }));
  var total = taches.length || 1, faits = 0;
  var pas = function(){ faits++; reel = Math.max(reel, Math.round(faits / total * 100)); };
  taches.forEach(function(t){ Promise.resolve(t).then(pas, pas); });
  setTimeout(function(){ reel = 100; }, 5200);
  Promise.all(taches.map(function(t){ return Promise.resolve(t).catch(function(){}); })).then(function(){
    setTimeout(function(){ reel = 100; }, 250);
  });
}

function entree(){
  document.body.classList.add('entre');
  $$('[data-entree], [data-entree-rv]').forEach(function(el){ el.classList.add('vu'); });
}

var pret = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
pret.then(function(){
  prepLignes();
  surveiller();
  var rideauSans = $('#rideau') && $('#rideau').classList.contains('sans');
  var demarrer = function(){
    if (ecran && !rideauSans) lancerChargement(entree);
    else { if (ecran) ecran.remove(); entree(); }
  };
  if (window.OfficineEntree && window.OfficineEntree()) demarrer();
  else document.addEventListener('officine:entree', demarrer, {once: true});
  if (avecGsap) scenes(); else replis();
  var re; window.addEventListener('resize', function(){ clearTimeout(re); re = setTimeout(function(){ if (avecGsap) ST.refresh(); }, 250); });
});

/* ---------- Scenes au scroll ---------- */
function scenes(){
  /* hero : l'ecrin s'efface vers la navigation, la video recule */
  var hero = $('.hero');
  if (hero){
    G.to('.hero video, .hero .poster', {scale: 1.12, ease: 'none', scrollTrigger: {trigger: hero, start: 'top top', end: 'bottom top', scrub: true}});
    var emb = $('#embleme');
    if (emb){
      G.set(emb, {xPercent: -50, yPercent: -50});
      G.to(emb, {y: function(){ return -window.innerHeight * .28; }, scale: .55, opacity: 0, ease: 'power1.in', scrollTrigger: {trigger: hero, start: 'top top', end: '60% top', scrub: true, invalidateOnRefresh: true}});
    }
    G.to('.hero .couche', {y: -60, opacity: 0, ease: 'none', scrollTrigger: {trigger: hero, start: '35% top', end: 'bottom top', scrub: true}});
  }

  /* pages interieures : le visuel du bandeau recule au scroll */
  var hp = $('.hero-p');
  if (hp){
    G.fromTo($('video, .hp-img', hp), {scale: 1.12}, {scale: 1, duration: 2.2, ease: 'expo.out'});
    G.to($('video, .hp-img', hp), {yPercent: 12, ease: 'none', scrollTrigger: {trigger: hp, start: 'top top', end: 'bottom top', scrub: true}});
  }

  /* cuvee : les quatre etapes, l'image suit l'etape lue */
  var etapes = $$('#etapes .m-etape'), mv = $$('.m-visuel img');
  if (etapes.length){
    var activer = function(i){
      etapes.forEach(function(e, k){ e.classList.toggle('actif', k === i); });
      mv.forEach(function(im, k){ im.classList.toggle('on', k === i); });
    };
    activer(0);
    etapes.forEach(function(e, i){
      ST.create({trigger: e, start: 'top 58%', end: 'bottom 58%', onToggle: function(st){ if (st.isActive) activer(i); }});
    });
    G.fromTo('#etapes', {'--fil': 0}, {'--fil': 1, ease: 'none', scrollTrigger: {trigger: '#etapes', start: 'top 58%', end: 'bottom 58%', scrub: true}});
  }

  /* parallaxe */
  $$('[data-plx]').forEach(function(el){
    var v = parseFloat(el.dataset.plx) || 10;
    G.fromTo(el, {yPercent: -v / 2}, {yPercent: v / 2, ease: 'none', scrollTrigger: {trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true}});
  });

  /* manifeste lu mot a mot */
  var m = $('#manifeste');
  if (m){
    m.innerHTML = m.textContent.trim().split(/\s+/).map(function(w){ return '<span class="mot">' + w + '</span>'; }).join(' ');
    var mots = $$('.mot', m);
    ST.create({trigger: m, start: 'top 80%', end: 'bottom 45%', scrub: true, onUpdate: function(s){
      var n = Math.round(s.progress * mots.length);
      mots.forEach(function(w, i){ w.classList.toggle('lu', i < n); });
    }});
  }

  /* etagere : les niches se levent l'une apres l'autre */
  var niches = $$('.niche');
  if (niches.length){
    G.from(niches, {y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: .09, scrollTrigger: {trigger: '#niches', start: 'top 85%', once: true}});
  }

  /* piece de l'atelier : le flacon monte dans son ecrin */
  if ($('#piece')){
    G.fromTo('#pieceImg', {yPercent: 18}, {yPercent: 0, ease: 'none', scrollTrigger: {trigger: '#piece', start: 'top bottom', end: 'center center', scrub: true}});
  }

  /* click & collect : le fil relie les trois temps */
  var temps = $('#temps');
  if (temps){
    G.fromTo(temps, {'--fil': 0}, {'--fil': 1, ease: 'none', scrollTrigger: {trigger: temps, start: 'top 80%', end: 'bottom 60%', scrub: true}});
  }

  /* cuvee : l'image s'ouvre */
  var ouv = $('#ouverture');
  if (ouv){
    ST.matchMedia({
      '(min-width: 801px)': function(){
        var media = $('.media', ouv), vid = $('video', ouv);
        var tl = G.timeline({scrollTrigger: {trigger: ouv, start: 'top top', end: 'bottom bottom', scrub: 1,
          onToggle: function(s){ if (vid){ s.isActive ? vid.play().catch(function(){}) : vid.pause(); } }}});
        tl.fromTo(media, {clipPath: 'inset(16% 40% 16% 40% round 10vw)'}, {clipPath: 'inset(0% 0% 0% 0% round 0vw)', ease: 'power2.inOut', duration: 1})
          .fromTo('.coins span:first-child', {x: 0}, {x: '-30vw', opacity: 0, duration: .8}, 0)
          .fromTo('.coins span:last-child', {x: 0}, {x: '30vw', opacity: 0, duration: .8}, 0)
          .to(media, {'--voile': 1, duration: .4}, .7)
          .fromTo('.titres', {opacity: 0, y: 40}, {opacity: 1, y: 0, duration: .35}, .75)
          .to({}, {duration: .6});
      },
      '(max-width: 800px)': function(){
        var vid = $('video', ouv); if (vid) vid.play().catch(function(){});
      }
    });
  }

  document.addEventListener('officine:contenu', function(){ ST.refresh(); });
  window.addEventListener('load', function(){ ST.refresh(); });
}

function replis(){
  var tp = $('#temps'); if (tp) tp.style.setProperty('--fil', 1);
  var et = $('#etapes'); if (et){ et.style.setProperty('--fil', 1); $$('.m-etape', et).forEach(function(e){ e.classList.add('actif'); }); }
  var m = $('#manifeste'); if (m) m.style.opacity = 1;
  var v = $('#ouverture video'); if (v) v.play && v.play().catch(function(){});
  var o = $('#ouverture'); if (o){ o.style.height = 'auto'; $('.scene', o).style.position = 'relative'; $('.media', o).style.clipPath = 'none'; $('.titres', o).style.opacity = 1; $('.media', o).style.setProperty('--voile', 1); }
}

/* ---------- Accueil : etagere et piece de l'atelier, remplies depuis le catalogue ---------- */
function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var D = window.OfficineDonnees;
if (D && ($('#niches') || $('#piece'))){
  D.produits().then(function(l){
    l = (l || []).slice().sort(function(a, b){ return (a.ordre || 999) - (b.ordre || 999); });
    $$('.niche').forEach(function(n){
      var cat = n.dataset.rayon, du = l.filter(function(p){ return p.categorie === cat; });
      var nb = $('[data-nb]', n); if (nb && du.length) nb.textContent = du.length + (du.length > 1 ? ' références' : ' référence');
      var boite = $('.flacons', n); if (!boite) return;
      var det = du.filter(function(p){ return p.image && p.photo_type !== 'ambiance' && !/cuv[ée]e maison/i.test(p.badge || ''); });
      var amb = du.filter(function(p){ return p.image && p.photo_type === 'ambiance'; });
      if (det.length){
        boite.innerHTML = det.slice(0, 3).map(function(p, i){ return '<img class="flacon f' + i + '" src="' + esc(p.image) + '" alt="" loading="lazy">'; }).join('');
        boite.parentNode.classList.add('rempli');
      } else if (amb.length){
        choisirAmbiance(amb.slice(0, 8), function(p, surBlanc){
          boite.innerHTML = '<img class="' + (surBlanc ? 'flacon f0 large' : 'ambiance') + '" src="' + esc(p.image) + '" alt="" loading="lazy">';
          boite.parentNode.classList.add('rempli');
        });
      }
    });
    var piece = $('#piece');
    var p = l.filter(function(x){ return /cuv[ée]e maison/i.test(x.badge || '') && x.image; })[0];
    if (piece && p){
      poserPiece(p.image, p.nom);
      var mettre = function(sel, v){ var el = $(sel); if (el) el.textContent = v || ''; };
      mettre('#pieceMarque', p.marque); mettre('#pieceNom', p.nom); mettre('#pieceAcc', p.accroche); mettre('#pieceDesc', p.description);
      var dlp = $('#pieceDl');
      if (dlp) dlp.innerHTML = [['Origine', p.origine], ['Degré', p.degre]].concat(p.caracteristiques || []).filter(function(r){ return r[1]; }).slice(0, 5)
        .map(function(r){ return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
      var lienP = '/selection?cat=' + encodeURIComponent(p.categorie) + '&ref=' + encodeURIComponent(p.id);
      if ($('#pieceLien')) $('#pieceLien').href = lienP;
      if (piece.tagName === 'A') piece.href = lienP;
      piece.hidden = false;
      if (avecGsap) ST.refresh();
    }
  }).catch(function(){});
}

/* Rayon sans photo detouree : on prend la photo la plus claire (produit sur fond blanc) pour l'integrer comme les autres */
function analyser(src, fin){
  var im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = function(){
    try {
      var c = document.createElement('canvas'); c.width = 40; c.height = 50; var x = c.getContext('2d'); x.drawImage(im, 0, 0, 40, 50);
      var d = x.getImageData(0, 0, 40, 50).data, b = 0, bord = 0, nb = 0;
      for (var k = 0; k < d.length; k += 4){ var i = (k / 4) % 40, j = Math.floor(k / 160), blanc = d[k] > 236 && d[k + 1] > 236 && d[k + 2] > 236; if (blanc) b++; if (i < 3 || i > 36 || j < 3 || j > 46){ nb++; if (blanc) bord++; } }
      fin(b / 2000, bord / nb);
    } catch (e) { fin(0, 0); }
  };
  im.onerror = function(){ fin(0, 0); };
  im.src = src;
}
function choisirAmbiance(liste, fin){
  var reste = liste.length, meilleur = null, score = -1;
  liste.forEach(function(p){
    analyser(p.image, function(blanc, bord){
      var sc = bord > .8 ? 1 + blanc : blanc;
      if (sc > score){ score = sc; meilleur = p; }
      if (--reste === 0) fin(meilleur, score > 1);
    });
  });
}

/* La photo de la piece : bouteille detouree posee dans l'ecrin, ou photo cadree plein ecrin */
function poserPiece(src, nom){
  var cible = $('#pieceImg'); cible.alt = nom;
  var im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = function(){
    try {
      var W = 80, H = Math.round(80 * im.naturalHeight / im.naturalWidth), c = document.createElement('canvas');
      c.width = W; c.height = H; var x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H);
      var d = x.getImageData(0, 0, W, H).data, x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
      for (var j = 0; j < H; j++) for (var i = 0; i < W; i++){ var k = (j * W + i) * 4; if (d[k] < 236 || d[k + 1] < 236 || d[k + 2] < 236){ n++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
      var aire = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (n && n / aire > .88){
        var r = im.naturalWidth / W, g = document.createElement('canvas');
        g.width = Math.round((x1 - x0 + 1) * r); g.height = Math.round((y1 - y0 + 1) * r);
        g.getContext('2d').drawImage(im, x0 * r, y0 * r, g.width, g.height, 0, 0, g.width, g.height);
        cible.src = g.toDataURL('image/jpeg', .9); cible.classList.add('photo'); return;
      }
    } catch (e) {}
    cible.src = src;
  };
  im.onerror = function(){ cible.src = src; };
  im.src = src;
}

/* ---------- Fiche produit : ouverture en vol depuis la carte, panneau defilant, fermeture au glisser ---------- */
function estPhoto(src, fin){
  var im = new Image(); im.crossOrigin = 'anonymous';
  var fini = false, rendre = function(v){ if (!fini){ fini = true; fin(v); } };
  setTimeout(function(){ rendre(false); }, 350);
  im.onload = function(){
    try {
      var W = 40, H = Math.round(40 * im.naturalHeight / im.naturalWidth), c = document.createElement('canvas');
      c.width = W; c.height = H; var x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H);
      var d = x.getImageData(0, 0, W, H).data, x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
      for (var j = 0; j < H; j++) for (var i = 0; i < W; i++){ var k = (j * W + i) * 4; if (d[k] < 236 || d[k + 1] < 236 || d[k + 2] < 236){ n++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
      if (!(n > 0 && n / ((x1 - x0 + 1) * (y1 - y0 + 1)) > .88)) return rendre(false);
      var r = im.naturalWidth / W, g = document.createElement('canvas');
      g.width = Math.round((x1 - x0 + 1) * r); g.height = Math.round((y1 - y0 + 1) * r);
      g.getContext('2d').drawImage(im, x0 * r, y0 * r, g.width, g.height, 0, 0, g.width, g.height);
      rendre(g.toDataURL('image/jpeg', .9));
    } catch (e) { rendre(false); }
  };
  im.onerror = function(){ rendre(false); };
  im.src = src;
}
function rectDessine(img){
  var r = img.getBoundingClientRect(), cs = getComputedStyle(img);
  var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0, pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
  var bx = {left: r.left + pl, top: r.top + pt, width: r.width - pl - pr, height: r.height - pt - pb};
  if (cs.objectFit !== 'contain' || !img.naturalWidth) return bx;
  var q = img.naturalWidth / img.naturalHeight, w = bx.width, h = bx.height;
  if (w / h > q) w = h * q; else h = w / q;
  return {left: bx.left + (bx.width - w) / 2, top: bx.top + (bx.height - h) / 2, width: w, height: h};
}
function visible(r){ return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth; }
var voileF = $('#ficheVoile');
if (voileF){
  var ficheEl = $('#fiche'), source = null, etaitOuvert = false, mobile = function(){ return window.innerWidth <= 760; };
  if (avecGsap) voileF.classList.add('anime');
  document.addEventListener('click', function(e){
    var v = e.target.closest('#grille [data-fiche]');
    if (v){ var art = v.closest('.fiche-c'); source = art ? $('.visuel img', art) : null; }
  }, true);

  var voler = function(de, vers, img, fin){
    var c = document.createElement('img');
    c.src = img.currentSrc || img.src; c.alt = ''; c.className = 'vol-fiche';
    c.style.cssText = 'left:0;top:0;width:' + de.width + 'px;height:' + de.height + 'px;object-fit:cover;border-radius:' + (de.radius || 0) + 'px';
    document.body.appendChild(c);
    G.fromTo(c, {x: de.left, y: de.top, width: de.width, height: de.height, borderRadius: de.radius || 0},
      {x: vers.left, y: vers.top, width: vers.width, height: vers.height, borderRadius: vers.radius || 0, duration: .95, ease: 'expo.inOut',
       onComplete: function(){ fin && fin(); G.to(c, {opacity: 0, duration: .2, onComplete: function(){ c.remove(); }}); }});
  };

  var ouvrir = function(){
    document.body.classList.add('fiche-ouverte');
    ficheEl.scrollTop = 0;
    var vis = $('.visuel', ficheEl), img = vis && $('img', vis);
    var bouton = $('.fermer', ficheEl); if (bouton) try { bouton.focus({preventScroll: true}); } catch (e) {}
    var suite = function(photo){
      if (photo){ vis.classList.add('cadre-photo'); img.src = photo; }
      if (!avecGsap || !img) return;
      var src = source && source.isConnected ? source : null, a = src && src.getBoundingClientRect();
      if (!src || !visible(a) || photo){
        G.fromTo(img, {opacity: 0, scale: .92}, {opacity: 1, scale: 1, duration: 1.1, ease: 'expo.out', delay: .15, clearProps: 'opacity,scale'});
        return;
      }
      var de = rectDessine(src), rond = !vis.classList.contains('detoure');
      de.radius = rond ? 4 : 0;
      img.style.visibility = 'hidden'; src.style.visibility = 'hidden';
      var b = img.getBoundingClientRect(), dy = G.getProperty(ficheEl, 'y') + G.getProperty(ficheEl, 'yPercent') / 100 * ficheEl.offsetHeight;
      var vers = {left: b.left, top: b.top - dy, width: b.width, height: b.height, radius: rond ? b.width / 2 : 0};
      voler(de, vers, img, function(){ img.style.visibility = ''; src.style.visibility = ''; });
    };
    if (avecGsap){
      var tl = G.timeline();
      if (mobile()) tl.fromTo(ficheEl, {yPercent: 100}, {yPercent: 0, duration: .85, ease: 'expo.out'}, 0);
      else tl.fromTo(ficheEl, {y: 50, opacity: 0}, {y: 0, opacity: 1, duration: .8, ease: 'expo.out'}, 0);
      tl.fromTo(vis, {'--cap': 0}, {'--cap': 1, duration: 1.2, ease: 'expo.out'}, .1)
        .from($$('.info > .f-tete > *, .info > .f-bloc, .info > .maison-f', ficheEl), {y: 34, opacity: 0, duration: 1, ease: 'expo.out', stagger: .06}, .22)
        .from($('.actions', ficheEl), {yPercent: 100, opacity: 0, duration: .8, ease: 'expo.out'}, .45)
        .eventCallback('onComplete', function(){ G.set(ficheEl, {clearProps: 'transform,opacity'}); });
    }
    if (img && vis.classList.contains('detoure')) estPhoto(img.src, suite); else suite(false);
  };

  var fermer = function(){
    document.body.classList.remove('fiche-ouverte');
    if (!avecGsap) return;
    var img = $('.visuel img', ficheEl), vis = $('.visuel', ficheEl);
    var src = source && source.isConnected ? source : null;
    if (img && src && visible(src.getBoundingClientRect()) && vis && !vis.classList.contains('cadre-photo')){
      var b = img.getBoundingClientRect(), rond = !vis.classList.contains('detoure');
      var vers = rectDessine(src); vers.radius = rond ? 4 : 0;
      src.style.visibility = 'hidden'; img.style.visibility = 'hidden';
      voler({left: b.left, top: b.top, width: b.width, height: b.height, radius: rond ? b.width / 2 : 0}, vers, img, function(){ src.style.visibility = ''; });
    }
    G.killTweensOf(ficheEl);
    var fin = function(){ G.set(ficheEl, {clearProps: 'transform,opacity'}); if (img) img.style.visibility = ''; };
    if (mobile()) G.to(ficheEl, {yPercent: 100, y: 0, duration: .55, ease: 'power3.in', onComplete: fin});
    else G.to(ficheEl, {y: 40, opacity: 0, duration: .45, ease: 'power2.in', onComplete: fin});
  };

  new MutationObserver(function(){
    var o = voileF.classList.contains('ouvert');
    if (o && !etaitOuvert) ouvrir(); else if (!o && etaitOuvert) fermer();
    etaitOuvert = o;
  }).observe(voileF, {attributes: true, attributeFilter: ['class']});

  /* mobile : tirer la fiche vers le bas pour la fermer */
  var y0 = null, dy = 0;
  ficheEl.addEventListener('touchstart', function(e){
    if (ficheEl.scrollTop > 2 || !e.target.closest('.visuel, .poignee')) return;
    y0 = e.touches[0].clientY; dy = 0;
  }, {passive: true});
  ficheEl.addEventListener('touchmove', function(e){
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (G) G.set(ficheEl, {y: dy}); else ficheEl.style.transform = 'translateY(' + dy + 'px)';
  }, {passive: true});
  ficheEl.addEventListener('touchend', function(){
    if (y0 === null) return; y0 = null;
    if (dy > 110){ var f = $('[data-fermer-fiche]', ficheEl); if (f) f.click(); }
    else if (G) G.to(ficheEl, {y: 0, duration: .5, ease: 'expo.out'}); else ficheEl.style.transform = '';
  });
}

/* ---------- Selection : ouvrir la fiche demandee (?ref=) ---------- */
var grilleSel = $('#grille'), refDemande = new URLSearchParams(location.search).get('ref');
if (grilleSel && refDemande){
  var mo = new MutationObserver(function(){ ouvrirRef(); });
  var ouvrirRef = function(){
    if (!refDemande) return;
    var v = $$('.visuel[data-fiche]', grilleSel).filter(function(x){ return x.dataset.fiche === refDemande; })[0];
    if (!v) return;
    refDemande = null; mo.disconnect();
    setTimeout(function(){ v.click(); }, 450);
  };
  mo.observe(grilleSel, {childList: true});
  ouvrirRef();
}
/* ---------- La maison : les maisons de la selection, chacune ouvre sa recherche ---------- */
var listeM = $('#listeMaisons');
if (listeM && D){
  D.produits().then(function(l){
    var g = {};
    (l || []).forEach(function(p){
      if (!p.marque) return;
      var m = g[p.marque] || (g[p.marque] = {nom: p.marque, n: 0, cats: {}, img: '', det: false});
      m.n++; m.cats[p.categorie] = 1;
      if (p.image && (!m.img || (!m.det && p.photo_type !== 'ambiance'))){ m.img = p.image; m.det = p.photo_type !== 'ambiance'; }
    });
    var NOMS = {'rhums': 'Rhums', 'spiritueux': 'Spiritueux', 'vins': 'Vins', 'epicerie': 'Épicerie', 'sans-alcool': 'Sans alcool'};
    var ms = Object.keys(g).map(function(k){ return g[k]; }).sort(function(a, b){ return a.nom.localeCompare(b.nom, 'fr'); });
    if (!ms.length) return;
    listeM.innerHTML = ms.map(function(m){
      return '<a class="ms" href="/selection?q=' + encodeURIComponent(m.nom) + '" data-img="' + esc(m.img) + '" data-det="' + (m.det ? 1 : 0) + '">' +
        '<span class="ms-nom">' + esc(m.nom) + '</span><span class="ms-info">' + Object.keys(m.cats).map(function(c){ return NOMS[c]; }).join(', ') + ', ' + m.n + (m.n > 1 ? ' références' : ' référence') + '</span></a>';
    }).join('');
    $('#maisons').hidden = false;
    document.dispatchEvent(new CustomEvent('officine:contenu', {detail: $('#maisons')}));
    if (avecGsap){
      G.from($$('.ms', listeM), {y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: .025, scrollTrigger: {trigger: listeM, start: 'top 85%', once: true}});
      ST.refresh();
    }
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches || reduit) return;
    var ap = document.createElement('div'); ap.className = 'ms-apercu'; ap.setAttribute('aria-hidden', 'true');
    ap.innerHTML = '<span class="ecrin"><img alt=""></span>'; document.body.appendChild(ap);
    var im = $('img', ap), x = 0, y = 0, ax = 0, ay = 0;
    listeM.addEventListener('mousemove', function(e){ x = e.clientX; y = e.clientY; });
    listeM.addEventListener('mouseover', function(e){
      var a = e.target.closest('.ms'); if (!a || !a.dataset.img) return;
      if (im.getAttribute('src') !== a.dataset.img) im.src = a.dataset.img;
      ap.classList.toggle('det', a.dataset.det === '1'); ap.classList.add('on');
    });
    listeM.addEventListener('mouseleave', function(){ ap.classList.remove('on'); });
    (function boucle(){
      ax += (x - ax) * .14; ay += (y - ay) * .14;
      ap.style.transform = 'translate3d(' + (ax + 28) + 'px,' + (ay - ap.offsetHeight / 2) + 'px,0) rotate(' + ((x - ax) * .04).toFixed(2) + 'deg)';
      requestAnimationFrame(boucle);
    })();
  }).catch(function(){});
}

/* ---------- Selection : recherche transmise par lien (?q=) ---------- */
var qLien = new URLSearchParams(location.search).get('q');
if (grilleSel && qLien){
  var poserQ = function(){
    if (!grilleSel.children.length || !qLien) return;
    var champ = $('#recherche'); if (!champ) return;
    champ.value = qLien; qLien = null; moQ.disconnect();
    champ.dispatchEvent(new Event('input', {bubbles: true}));
    var sg = $('#suggestions'); if (sg) sg.hidden = true;
  };
  var moQ = new MutationObserver(poserQ);
  moQ.observe(grilleSel, {childList: true});
  poserQ();
}

/* ---------- Pages legales : sommaire qui suit la lecture ---------- */
var som = $('#sommaire');
if (som){
  var titres = $$('.legal-txt h2');
  titres.forEach(function(h, i){ h.id = h.id || 'art-' + (i + 1); });
  som.innerHTML = '<p class="note">Sommaire</p>' + titres.map(function(h){ return '<a href="#' + h.id + '">' + esc(h.textContent) + '</a>'; }).join('');
  var liens = $$('a', som);
  if ('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){ if (e.isIntersecting){ var i = titres.indexOf(e.target); liens.forEach(function(a, k){ a.classList.toggle('actif', k === i); }); } });
    }, {rootMargin: '-20% 0px -70% 0px'});
    titres.forEach(function(h){ io.observe(h); });
  }
}

/* ---------- Sélection : les formats larges (cubis, coffrets) tiennent mieux dans la carte ---------- */
function ajusterVisuels(racine){
  $$('.fiche-c .visuel.detoure', racine || document).forEach(function(v){
    if (v.dataset.ajuste) return;
    var im = $('img', v); if (!im) return;
    v.dataset.ajuste = '1';
    if (!$('.ombre-c', v)) v.insertAdjacentHTML('beforeend', '<span class="ombre-c" aria-hidden="true"></span>');
    var mesurer = function(){ if (im.naturalWidth / im.naturalHeight > .78) v.classList.add('plat'); };
    if (im.complete && im.naturalWidth) mesurer(); else im.addEventListener('load', mesurer, {once: true});
  });
}
if ($('#grille')){
  ajusterVisuels();
  new MutationObserver(function(){ ajusterVisuels(); }).observe($('#grille'), {childList: true});
  $('#grille').addEventListener('click', function(e){
    var b = e.target.closest('.ajout:not(.voir)');
    if (!b || b.disabled) return;
    b.classList.remove('ok'); void b.offsetWidth; b.classList.add('ok');
    setTimeout(function(){ b.classList.remove('ok'); }, 900);
  });
}

/* ---------- Bandeau : ce qui vient d'entrer, défile en continu ---------- */
var piste = $('#bdPiste');
if (piste && D){
  D.produits().then(function(l){
    var sel = (l || []).filter(function(p){ return p.image; }).sort(function(a, b){ return (a.ordre || 999) - (b.ordre || 999); }).slice(0, 10);
    if (!sel.length) return;
    var html = sel.map(function(p){
      return '<a class="bd-i" href="/selection?cat=' + encodeURIComponent(p.categorie) + '&ref=' + encodeURIComponent(p.id) + '">' +
        '<span class="bd-v"><img src="' + esc(p.image) + '" alt="" loading="lazy"></span>' +
        '<span class="bd-t"><b>' + esc(p.nom) + '</b><span>' + esc([p.marque, CATSN[p.categorie]].filter(Boolean).join(', ')) + '</span></span></a>';
    }).join('');
    piste.innerHTML = html + html;
    if (!avecGsap || reduit) return;
    var largeur = function(){ return piste.scrollWidth / 2; };
    var boucle = G.to(piste, {x: function(){ return -largeur(); }, duration: function(){ return largeur() / 55; }, ease: 'none', repeat: -1,
      modifiers: {x: function(x){ return (parseFloat(x) % largeur()) + 'px'; }}});
    ST.create({trigger: '#bandeau', start: 'top bottom', end: 'bottom top',
      onUpdate: function(st){ boucle.timeScale(1 + Math.min(6, Math.abs(st.getVelocity() / 260))); }});
    $('#bandeau').addEventListener('mouseenter', function(){ G.to(boucle, {timeScale: .25, duration: .6}); });
    $('#bandeau').addEventListener('mouseleave', function(){ G.to(boucle, {timeScale: 1, duration: .6}); });
  }).catch(function(){});
}
var CATSN = {'rhums': 'Rhums & canne', 'spiritueux': 'Spiritueux', 'vins': 'Vins & champagnes', 'epicerie': 'Épicerie fine', 'sans-alcool': 'Sans alcool'};

/* ---------- Accueil : la vitrine des rayons (bouteilles detourees, rotation en orbite) ---------- */
function detourer(src){
  return new Promise(function(ok){
    var im = new Image(); im.crossOrigin = 'anonymous';
    im.onerror = function(){ ok(null); };
    im.onload = function(){
      try {
        /* photo deja detouree (PNG transparent) : on la garde telle quelle */
        var t = document.createElement('canvas'); t.width = 50; t.height = 50;
        var tx = t.getContext('2d'); tx.drawImage(im, 0, 0, 50, 50);
        var td = tx.getImageData(0, 0, 50, 50).data;
        for (var ti = 3; ti < td.length; ti += 4) if (td[ti] < 250) return ok({url: src, ratio: im.naturalWidth / im.naturalHeight, rug: 0});
        var k = Math.min(1, 720 / Math.max(im.naturalWidth, im.naturalHeight));
        var W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k), N = W * H;
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H);
        var id = x.getImageData(0, 0, W, H), d = id.data;
        /* 1. fond : blanc pur relie au bord de la photo */
        var fond = new Uint8Array(N), pile = new Int32Array(N), n = 0, nf = 0;
        var blanc = function(p){ var i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2]; return Math.min(r, g, b) >= 248 && Math.max(r, g, b) - Math.min(r, g, b) < 14; };
        var pousser = function(p){ if (!fond[p] && blanc(p)){ fond[p] = 1; pile[n++] = p; } };
        var i, j, p;
        for (i = 0; i < W; i++){ pousser(i, -1); pousser(N - 1 - i, -1); }
        for (j = 0; j < H; j++){ pousser(j * W, -1); pousser(j * W + W - 1, -1); }
        while (n){
          p = pile[--n]; nf++;
          var px = p % W;
          if (px > 0) pousser(p - 1, p);
          if (px < W - 1) pousser(p + 1, p);
          if (p >= W) pousser(p - W, p);
          if (p < N - W) pousser(p + W, p);
        }
        if (nf / N < .3) return ok(null);
        /* 2. ouverture 5x5 : retire les reflets fins et les poussieres */
        var somme = function(m){
          var S = new Int32Array((W + 1) * (H + 1));
          for (var y = 0; y < H; y++){ var ligne = 0; for (var xx = 0; xx < W; xx++){ ligne += m[y * W + xx]; S[(y + 1) * (W + 1) + xx + 1] = S[y * (W + 1) + xx + 1] + ligne; } }
          return S;
        };
        var fenetre = function(S, xx, y, r){
          var a = Math.max(0, xx - r), b = Math.min(W, xx + r + 1), e = Math.max(0, y - r), f = Math.min(H, y + r + 1);
          return S[f * (W + 1) + b] - S[e * (W + 1) + b] - S[f * (W + 1) + a] + S[e * (W + 1) + a];
        };
        var obj = new Uint8Array(N); for (p = 0; p < N; p++) obj[p] = fond[p] ? 0 : 1;
        var S = somme(obj), ero = new Uint8Array(N);
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) ero[j * W + i] = fenetre(S, i, j, 3) === 49 ? 1 : 0;
        S = somme(ero);
        var garde = new Uint8Array(N), ng = 0;
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) if (fenetre(S, i, j, 3) > 0){ garde[j * W + i] = 1; ng++; }
        if (!ng) return ok(null);
        /* 3. silhouette pleine : on rebouche l'interieur (verre clair, etiquettes blanches) */
        var r0 = new Int32Array(H).fill(W), r1 = new Int32Array(H).fill(-1), c0 = new Int32Array(W).fill(H), c1 = new Int32Array(W).fill(-1);
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) if (garde[j * W + i]){
          if (i < r0[j]) r0[j] = i; if (i > r1[j]) r1[j] = i;
          if (j < c0[i]) c0[i] = j; if (j > c1[i]) c1[i] = j;
        }
        S = somme(garde);
        var masque = new Uint8Array(N), x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (j = 0; j < H; j++) for (i = 0; i < W; i++){
          p = j * W + i;
          if ((i >= r0[j] && i <= r1[j] && j >= c0[i] && j <= c1[i]) || (obj[p] && fenetre(S, i, j, 2) > 0)){
            masque[p] = 1;
            if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
          }
        }
        /* frange : les pixels pales colles au fond partent (halo du detourage) */
        for (var passe = 0; passe < 2; passe++){
          var retirer = [];
          for (p = 0; p < N; p++){
            if (!masque[p]) continue;
            var qq = p % W;
            var auBord = (qq > 0 && !masque[p - 1]) || (qq < W - 1 && !masque[p + 1]) || (p >= W && !masque[p - W]) || (p < N - W && !masque[p + W]);
            if (!auBord) continue;
            var a3 = p * 4, mn3 = Math.min(d[a3], d[a3 + 1], d[a3 + 2]);
            if (mn3 >= 222 && Math.max(d[a3], d[a3 + 1], d[a3 + 2]) - mn3 < 18) retirer.push(p);
          }
          for (var z = 0; z < retirer.length; z++) masque[retirer[z]] = 0;
        }
        /* 4. refus : photo rectangulaire (pas un produit detoure) */
        var bw = x1 - x0 + 1, bh = y1 - y0 + 1, plein = 0, droits = 0, lignes = 0;
        for (j = y0; j <= y1; j++) for (i = x0; i <= x1; i++) plein += garde[j * W + i];
        var kx0 = W, kx1 = -1;
        for (j = 0; j < H; j++) if (r1[j] >= 0){ if (r0[j] < kx0) kx0 = r0[j]; if (r1[j] > kx1) kx1 = r1[j]; }
        for (j = y0; j <= y1; j++){ if (r1[j] < 0) continue; lignes++; if (Math.abs(r0[j] - kx0) <= 3 && Math.abs(r1[j] - kx1) <= 3) droits++; }
        if (plein / (bw * bh) > .97 || (lignes && droits / lignes > .95)) return ok(null);
        /* panneau clair derriere le produit : bord droit et pale sur presque toute la hauteur */
        var panneau = function(tab, dec){
          var compte = {}, mode = -1, max = 0, bons = 0;
          for (j = y0; j <= y1; j++){ if (r1[j] < 0) continue; var v = tab[j]; compte[v] = (compte[v] || 0) + 1; if (compte[v] > max){ max = compte[v]; mode = v; } }
          for (j = y0; j <= y1; j++){
            if (r1[j] < 0 || Math.abs(tab[j] - mode) > 2) continue;
            var xx = Math.min(W - 1, Math.max(0, tab[j] + dec)), a2 = (j * W + xx) * 4, mn2 = Math.min(d[a2], d[a2 + 1], d[a2 + 2]);
            if (mn2 >= 226 && Math.max(d[a2], d[a2 + 1], d[a2 + 2]) - mn2 < 12) bons++;
          }
          return bons / lignes;
        };
        if (lignes && Math.max(panneau(r0, 3), panneau(r1, -3)) > .8) return ok(null);
        /* rugosite du contour : un verre clair mal separe du fond donne un bord dechire */
        var rug = 0, prec = -1;
        for (j = y0; j <= y1; j++){ if (r1[j] < 0) continue; if (prec >= 0) rug += Math.min(12, Math.abs(r0[j] - r0[prec])) + Math.min(12, Math.abs(r1[j] - r1[prec])); prec = j; }
        rug = lignes ? rug / lignes : 0;
        /* 5. transparence et bord adouci */
        var zone = y1 - Math.round((y1 - y0) * .14);
        for (p = 0; p < N; p++){
          var a = p * 4;
          if (!masque[p]){ d[a + 3] = 0; continue; }
          var q = p % W;
          var bord = (q > 0 && !masque[p - 1]) || (q < W - 1 && !masque[p + 1]) || (p >= W && !masque[p - W]) || (p < N - W && !masque[p + W]);
          if (bord){ var l = (d[a] + d[a + 1] + d[a + 2]) / 3; d[a + 3] = l > 200 ? Math.max(70, 255 - (l - 200) * 3.5) : 235; }
          /* reflet de studio sous le produit : les tons clairs s'effacent, la base se fond */
          var ry = (p - q) / W;
          if (ry >= zone){
            var t = (ry - zone) / Math.max(1, y1 - zone), mnp = Math.min(d[a], d[a + 1], d[a + 2]);
            var clair = Math.min(1, Math.max(0, (mnp - 150) / 80));
            var f = Math.min(1 - clair * Math.min(1, t * 1.6), 1 - Math.max(0, (t - .55) / .45) * .9);
            d[a + 3] = Math.round(d[a + 3] * f);
          }
        }
        x.putImageData(id, 0, 0);
        var m = 6, ox = Math.max(0, x0 - m), oy = Math.max(0, y0 - m), cw = Math.min(W, x1 + m + 1) - ox, ch = Math.min(H, y1 + m + 1) - oy;
        var o = document.createElement('canvas'); o.width = cw; o.height = ch;
        o.getContext('2d').drawImage(c, ox, oy, cw, ch, 0, 0, cw, ch);
        o.toBlob(function(b){ ok(b ? {url: URL.createObjectURL(b), ratio: cw / ch, rug: rug} : null); }, 'image/png');
      } catch (e) { ok(null); }
    };
    im.src = src;
  });
}

var vitrine = $('#vitrine');
if (vitrine && D){
  var RAYONS = [
    {cat: 'rhums', nom: 'Rhums & canne', num: 'I', teinte: '#A8602F', forme: '28px 46% 40% 28px / 28px 38% 62% 28px'},
    {cat: 'spiritueux', nom: 'Spiritueux', num: 'II', teinte: '#2E5A5E', forme: '28px 38% 52% 28px / 28px 56% 44% 28px'},
    {cat: 'vins', nom: 'Vins & champagnes', num: 'III', teinte: '#6A2130', forme: '28px 52% 34% 28px / 28px 44% 58% 28px'},
    {cat: 'epicerie', nom: 'Épicerie fine', num: 'IV', teinte: '#6F7F35', forme: '28px 42% 46% 28px / 28px 60% 40% 28px'},
    {cat: 'sans-alcool', nom: 'Sans alcool', num: 'V', teinte: '#2F8479', forme: '28px 48% 38% 28px / 28px 42% 60% 28px'}
  ];
  var scene = $('#vtScene'), forme = $('#vtForme'), lignes = $('#vtLignes'), chips = $$('#vtRayons a');
  var courant = 0, pret = [], occupe = false, catalogue = [], survol = false, visibleV = false;
  var euro = function(n){ n = Number(n) || 0; return n.toLocaleString('fr-FR', {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2}) + ' €'; };

  /* ordre de mise en avant : ces references passent en premier si leur photo se detache bien */
  var VITRINE = {
    'rhums': ['baie-des-tresors-fleurs-du-vent', 'barbancourt-5-etoiles-8-ans', 'neisson-esb-mizunara'],
    'spiritueux': ['algebra-extra-dry', 'kyro-gin', 'june-mangue-passion'],
    'vins': ['cielo-e-terra-baccolo-bianco', 'l-arjolle-equinoxe-cabernet-syrah', 'louis-dehu-blanc-de-blancs'],
    'epicerie': ['estoublon-picholine', 'estoublon-koroneiki', 'kalios-huile-d-olive-fumee'],
    'sans-alcool': ['cielo-e-terra-zero', 'elixia-cola', 'hysope-tonic-water']
  };
  var preparer = function(i){
    if (pret[i]) return pret[i];
    var r = RAYONS[i];
    var du = catalogue.filter(function(p){ return p.categorie === r.cat && p.image; });
    var mis = VITRINE[r.cat] || [];
    var rang = function(p){ var k = mis.indexOf(p.id); return k < 0 ? 99 + (p.photo_type === 'ambiance' ? 10 : 0) : k; };
    var cands = du.slice().sort(function(x, y){ return rang(x) - rang(y); }).slice(0, 14);
    pret[i] = (function suite(k, sortie){
      var nets = sortie.filter(function(x){ return x.img.rug <= 1; });
      if (nets.length >= 3 || sortie.length >= 6 || k >= cands.length){
        var choix = nets.concat(sortie.filter(function(x){ return x.img.rug > 1; })).slice(0, 3);
        return Promise.resolve({r: r, n: du.length, items: choix, secours: du[0] || null});
      }
      return detourer(cands[k].image).then(function(res){ if (res) sortie.push({p: cands[k], img: res}); return suite(k + 1, sortie); });
    })(0, []);
    return pret[i];
  };

  var groupe = function(v){
    var g = document.createElement('div'); g.className = 'vt-groupe';
    if (!v.items.length){
      g.innerHTML = v.secours ? '<div class="vt-secours"><span class="ecrin"><img src="' + esc(v.secours.image) + '" alt=""></span></div>' : '';
      return g;
    }
    var h = v.items[0], f = v.items.slice(1);
    g.innerHTML = '<span class="vt-ombre"></span><div class="vt-heros' + (h.img.ratio > .75 ? ' large' : '') + '"><img src="' + h.img.url + '" alt=""></div>' +
      f.map(function(it, k){ return '<div class="vt-flot f' + (k + 1) + '"><img src="' + it.img.url + '" alt=""></div>'; }).join('');
    return g;
  };

  var remplirListe = function(v){
    var it = v.items.length ? v.items : [];
    lignes.innerHTML = it.map(function(x, k){
      var p = x.p, vente = Number(p.prix) > 0 && p.stock !== 0;
      return '<div class="vt-l" data-k="' + k + '">' +
        '<a class="vt-ln" href="/selection?cat=' + encodeURIComponent(p.categorie) + '&ref=' + encodeURIComponent(p.id) + '"><b>' + esc(p.nom) + '</b><small>' + esc([p.marque, p.contenance].filter(Boolean).join(', ')) + '</small></a>' +
        '<span class="vt-lp">' + (Number(p.prix) > 0 ? euro(p.prix) : 'En boutique') + '</span>' +
        '<span class="vt-lv"><img src="' + x.img.url + '" alt=""></span>' +
        (vente ? '<button class="vt-plus" type="button" data-id="' + esc(p.id) + '" aria-label="Ajouter ' + esc(p.nom) + ' au panier">+</button>'
               : '<a class="vt-plus voir" href="/selection?cat=' + encodeURIComponent(p.categorie) + '&ref=' + encodeURIComponent(p.id) + '" aria-label="Voir ' + esc(p.nom) + '"></a>') +
        '</div>';
    }).join('') || '<p class="vt-vide">La sélection de ce rayon se découvre en boutique.</p>';
    $('#vtCompte').textContent = v.n ? v.n + (v.n > 1 ? ' références dans ce rayon' : ' référence dans ce rayon') : '';
  };

  var attente = null;
  var montrer = function(i, sens){
    if (occupe && sens){ attente = [i, sens]; return; }
    i = (i + RAYONS.length) % RAYONS.length;
    occupe = true;
    var r = RAYONS[i];
    chips.forEach(function(c, k){ if (k === i) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    placerCurseur(i);
    $('#vtVoir').href = '/selection?cat=' + r.cat;
    vitrine.style.setProperty('--teinte', r.teinte);
    preparer(i).then(function(v){
      courant = i;
      var ancien = $('.vt-groupe', scene), neuf = groupe(v), nom = $('#vtNom'), num = $('#vtNum');
      scene.appendChild(neuf);
      var fin = function(){
        occupe = false;
        if (attente){ var a = attente; attente = null; if (a[0] !== courant) return montrer(a[0], a[1]); }
        relancer();
      };
      if (!avecGsap || !sens){
        if (ancien) ancien.remove();
        nom.innerHTML = '<span>' + esc(r.nom) + '</span>'; num.textContent = r.num;
        forme.style.borderRadius = r.forme; remplirListe(v); flotter(neuf); fin(); return;
      }
      var s = sens > 0 ? 1 : -1, piv = '50% 230%';
      var tl = G.timeline({onComplete: function(){ if (ancien) ancien.remove(); fin(); }});
      if (ancien){
        G.killTweensOf($$('*', ancien));
        tl.to(ancien, {rotation: -48 * s, opacity: 0, filter: 'blur(6px)', transformOrigin: piv, duration: .95, ease: 'power3.in'}, 0);
      }
      tl.fromTo(neuf, {rotation: 48 * s, opacity: 0, filter: 'blur(6px)', transformOrigin: piv}, {rotation: 0, opacity: 1, filter: 'blur(0px)', duration: 1.25, ease: 'expo.out', clearProps: 'filter'}, .62);
      tl.fromTo($$('.vt-heros img', neuf), {rotation: 10 * s}, {rotation: 0, duration: 1.6, ease: 'expo.out'}, .62);
      tl.to(forme, {borderRadius: r.forme, duration: 1.4, ease: 'expo.inOut'}, 0);
      var vieux = $('span', nom);
      tl.to(vieux, {yPercent: -110, duration: .55, ease: 'power3.in'}, 0)
        .add(function(){ nom.innerHTML = '<span>' + esc(r.nom) + '</span>'; num.textContent = r.num; G.fromTo($('span', nom), {yPercent: 110}, {yPercent: 0, duration: 1, ease: 'expo.out'}); }, .6);
      tl.to(lignes.children, {x: -30 * s, opacity: 0, duration: .45, stagger: .05, ease: 'power2.in'}, .05)
        .add(function(){ remplirListe(v); G.from(lignes.children, {x: 40 * s, opacity: 0, duration: .9, stagger: .08, ease: 'expo.out'}); }, .65);
      tl.add(function(){ flotter(neuf); }, 1.2);
    });
    preparer((i + 1) % RAYONS.length);
  };

  /* la pastille glisse sous le rayon choisi et prend sa couleur */
  var placerCurseur = function(i, sec){
    var cur = $('#vtCurseur'), c = chips[i], boite = $('#vtRayons'); if (!cur || !c) return;
    cur.style.transition = sec ? 'none' : '';
    cur.style.width = c.offsetWidth + 'px';
    cur.style.transform = 'translateX(' + c.offsetLeft + 'px)';
    cur.style.background = RAYONS[i].teinte;
    var cible = c.offsetLeft - (boite.clientWidth - c.offsetWidth) / 2;
    if (boite.scrollWidth > boite.clientWidth) boite.scrollTo({left: cible, behavior: sec ? 'auto' : 'smooth'});
  };

  var flotter = function(g){
    if (!avecGsap) return;
    $$('.vt-flot', g).forEach(function(f, k){
      G.to(f, {y: k ? 14 : -16, rotation: k ? -5 : 6, duration: 3.2 + k, ease: 'sine.inOut', yoyo: true, repeat: -1});
    });
    var h = $('.vt-heros', g);
    if (h) G.to(h, {y: -8, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1});
  };

  /* lecture automatique, visible sur l'anneau du bouton */
  var anneau = $('.vt-anneau circle'), minuteur = null;
  var epingle = false;
  var relancer = function(){
    if (!avecGsap || !anneau || epingle) return;
    if (minuteur) minuteur.kill();
    minuteur = G.fromTo(anneau, {strokeDashoffset: 138.2}, {strokeDashoffset: 0, duration: 7, ease: 'none', paused: !(visibleV && !survol), onComplete: function(){ montrer(courant + 1, 1); }});
  };
  var etat = function(){ if (!minuteur) return; if (visibleV && !survol && !document.hidden) minuteur.play(); else minuteur.pause(); };
  vitrine.addEventListener('mouseenter', function(){ survol = true; etat(); });
  vitrine.addEventListener('mouseleave', function(){ survol = false; etat(); });
  document.addEventListener('visibilitychange', etat);
  new IntersectionObserver(function(en){ visibleV = en[0].isIntersecting; etat(); }, {threshold: .35}).observe(vitrine);

  $('#vtSuivant').addEventListener('click', function(){ montrer(courant + 1, 1); });
  $('#vtPrec').addEventListener('click', function(){ montrer(courant - 1, -1); });
  window.addEventListener('resize', function(){ placerCurseur(courant, true); });
  chips.forEach(function(c, k){
    c.addEventListener('click', function(e){ e.preventDefault(); if (k !== courant) montrer(k, k > courant ? 1 : -1); });
  });
  lignes.addEventListener('mouseover', function(e){
    var l = e.target.closest('.vt-l'); if (!l || !avecGsap) return;
    var g = $('.vt-groupe', scene), h = g && $('.vt-heros img', g), src = $('.vt-lv img', l);
    if (!h || !src || h.src === src.src || occupe) return;
    G.timeline().to(h, {rotation: -14, yPercent: 8, opacity: 0, duration: .3, ease: 'power2.in', transformOrigin: '50% 100%'})
      .add(function(){ h.src = src.src; h.parentNode.classList.toggle('large', src.naturalWidth / src.naturalHeight > .75); })
      .fromTo(h, {rotation: 14, yPercent: 8, opacity: 0}, {rotation: 0, yPercent: 0, opacity: 1, duration: .7, ease: 'expo.out'});
  });
  lignes.addEventListener('click', function(e){
    var b = e.target.closest('button.vt-plus'); if (!b || !window.OfficinePanier) return;
    var p = catalogue.filter(function(x){ return x.id === b.dataset.id; })[0]; if (!p) return;
    window.OfficinePanier.ajouter({id: 'p-' + p.id, type: 'produit', cat: p.categorie, image: p.image || '', nom: (p.marque ? p.marque + ' ' : '') + p.nom, det: [p.contenance, p.offre].filter(Boolean).join(', '), prix: p.prix, max: p.stock || 99}, b);
    b.classList.remove('ok'); void b.offsetWidth; b.classList.add('ok');
  });

  /* profondeur : les plans bougent differemment sous la souris */
  if (avecGsap && window.matchMedia('(hover:hover) and (pointer:fine)').matches){
    vitrine.addEventListener('mousemove', function(e){
      var b = vitrine.getBoundingClientRect(), dx = (e.clientX - b.left) / b.width - .5, dy = (e.clientY - b.top) / b.height - .5;
      G.to(scene, {x: dx * 16, y: dy * 10, duration: 1, ease: 'power3.out'});
      G.to(forme, {x: dx * -10, y: dy * -6, duration: 1.2, ease: 'power3.out'});
    });
  }

  /* mobile : glisser pour changer de rayon */
  var tx = null;
  vitrine.addEventListener('touchstart', function(e){ if (!e.target.closest('.vt-barre')) tx = e.touches[0].clientX; }, {passive: true});
  vitrine.addEventListener('touchend', function(e){
    if (tx === null) return; var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) montrer(courant + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });

  /* plein écran : le scroll fait défiler les rayons */
  if (avecGsap && window.matchMedia('(min-width:861px)').matches){
    epingle = true;
    ST.create({
      trigger: '#rayons', start: 'top top', end: '+=' + (RAYONS.length * 70) + '%',
      pin: '#vtCadre', pinSpacing: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: function(st){
        var i = Math.max(0, Math.min(RAYONS.length - 1, Math.floor(st.progress * RAYONS.length * .999)));
        if (i !== courant) montrer(i, i > courant ? 1 : -1);
      }
    });
  }

  D.produits().then(function(l){
    catalogue = (l || []).slice().sort(function(a, b){ return (a.ordre || 999) - (b.ordre || 999); });
    vitrine.style.setProperty('--teinte', RAYONS[0].teinte);
    forme.style.borderRadius = RAYONS[0].forme;
    placerCurseur(0, true);
    montrer(0, 0);
  }).catch(function(){});
}

})();
