/* L'Officine Sélection : comportements communs (age, navigation, panier, catalogue, programme, contact) */
(function(){
'use strict';
var OC = window.OFFICINE_CONFIG || {};
var MODE = OC.commande === 'stripe' || OC.paiement === true ? 'stripe' : (OC.commande === 'retrait' ? 'retrait' : 'off');
function lireMode(){
  if (OC.commande !== 'auto' || !OC.supabaseUrl) return;
  fetch(OC.supabaseUrl.replace(/\/$/, '') + '/rest/v1/reglages?select=valeur&cle=eq.mode_commande', {headers: {apikey: OC.supabaseAnon, Authorization: 'Bearer ' + OC.supabaseAnon}})
    .then(function(r){ return r.json(); })
    .then(function(l){
      var v = l && l[0] && l[0].valeur;
      MODE = v === 'stripe' ? 'stripe' : v === 'retrait' ? 'retrait' : 'off';
      CONFIG.paiementActif = MODE !== 'off';
      if (window.OfficinePanier) window.OfficinePanier.rendre();
    }).catch(function(){});
}
var CONFIG = {paiementActif: MODE !== 'off', retrait: "Retrait à L'Officine, 39 rue de l'Industrie, Jarry"};
lireMode();
var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function lire(k, d){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }
function ecrire(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function euros(n){ n = Number(n) || 0; return n.toLocaleString('fr-FR', {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2}) + ' €'; }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var FL = '<svg class="fl" viewBox="0 0 18 10" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M0 5h16M12 1l4 4-4 4"/></svg>';

/* ============ Silhouettes de flacons (quand il n'y a pas de photo) ============ */
var FORMES = {
  spiritueux: 'M38 6h24v26c0 6 22 8 22 22v140c0 5-3 8-8 8H24c-5 0-8-3-8-8V54c0-14 22-16 22-22z',
  rhums: 'M42 4h16v46c0 12 26 18 26 44v100c0 4-3 6-6 6H22c-3 0-6-2-6-6V94c0-26 26-32 26-44z',
  vins: 'M44 2h12v58c0 14 22 22 22 40v96c0 3-2 4-4 4H26c-2 0-4-1-4-4v-96c0-18 22-26 22-40z',
  epicerie: 'M22 82h56v8c6 2 8 6 8 12v84c0 8-6 14-14 14H28c-8 0-14-6-14-14v-84c0-6 2-10 8-12z',
  'sans-alcool': 'M40 8h20v22c0 8 30 20 30 62v90c0 10-8 18-18 18H28c-10 0-18-8-18-18V92c0-42 30-54 30-62z'
};
var TEINTES = {spiritueux: ['#3A2410', '#6B4420'], rhums: ['#4A2A0C', '#8A5520'], vins: ['#1D2A1E', '#2F4230'], epicerie: ['#5C2A22', '#8C4A38'], 'sans-alcool': ['#2F4A48', '#5E7F79']};
var nbSvg = 0;
function bouteille(cat){
  var f = FORMES[cat] || FORMES.rhums, t = TEINTES[cat] || TEINTES.rhums, id = 'g' + (nbSvg++);
  var bouchon = cat === 'epicerie' ? '<rect x="18" y="70" width="64" height="14" rx="3" fill="#B8955A"/>' :
    '<rect x="' + (cat === 'vins' ? 43 : 39) + '" y="0" width="' + (cat === 'vins' ? 14 : 22) + '" height="' + (cat === 'vins' ? 30 : 22) + '" rx="2" fill="#B8955A"/>';
  var etiq = cat === 'epicerie' ? [26, 118, 48, 50] : cat === 'vins' ? [26, 120, 48, 52] : [22, 112, 56, 58];
  return '<svg class="btl" viewBox="0 0 100 212" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" x2="1">' +
    '<stop offset="0" stop-color="' + t[0] + '"/><stop offset=".35" stop-color="' + t[1] + '"/><stop offset=".6" stop-color="' + t[0] + '"/><stop offset="1" stop-color="' + t[0] + '"/></linearGradient></defs>' +
    '<ellipse cx="50" cy="208" rx="40" ry="3.5" fill="rgba(6,27,30,.18)"/>' +
    '<path d="' + f + '" fill="url(#' + id + ')"/>' + bouchon +
    '<path d="M' + (etiq[0] + 6) + ' 60 q2 40 0 130" stroke="rgba(255,255,255,.18)" stroke-width="3" fill="none"/>' +
    '<rect x="' + etiq[0] + '" y="' + etiq[1] + '" width="' + etiq[2] + '" height="' + etiq[3] + '" fill="#EFE8DB"/>' +
    '<rect x="' + (etiq[0] + 3) + '" y="' + (etiq[1] + 3) + '" width="' + (etiq[2] - 6) + '" height="' + (etiq[3] - 6) + '" fill="none" stroke="#B8955A" stroke-width=".6"/>' +
    '<path d="M50 ' + (etiq[1] + 12) + 'c-3 0-3 7 0 7s3-7 0-7zM50 ' + (etiq[1] + 19) + 'v16M50 ' + (etiq[1] + 29) + 'h3.5M50 ' + (etiq[1] + 32) + 'h2.4" stroke="#B8955A" stroke-width=".9" fill="none"/>' +
    '<text x="50" y="' + (etiq[1] + etiq[3] - 8) + '" text-anchor="middle" font-family="Bodoni Moda, serif" font-size="6.5" fill="#122428">L\'Officine</text></svg>';
}
window.OfficineBouteille = bouteille;
$$('[data-illu]').forEach(function(el){ el.innerHTML = bouteille(el.dataset.illu === 'pot' ? 'epicerie' : 'sans-alcool'); });

/* ============ Rideau entre les pages ============ */
var rideau = $('#rideau');
function lever(){
  if (!rideau || !rideau.classList.contains('tombe')) return;
  rideau.classList.remove('tombe', 'sans'); void rideau.offsetWidth; rideau.classList.add('leve');
  setTimeout(function(){ rideau.className = 'net'; }, 950);
}
window.addEventListener('pageshow', function(e){ if (e.persisted && rideau){ rideau.className = 'net'; } });
document.addEventListener('click', function(e){
  var a = e.target.closest('a[href]');
  if (!a || !rideau || reduit || e.defaultPrevented) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === '_blank') return;
  var h = a.getAttribute('href');
  if (/^(mailto|tel|#)/.test(h)) return;
  var url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search){ if (url.hash) return; }
  e.preventDefault();
  fermerMenu(); fermerPanier();
  try { sessionStorage.setItem('officine_rideau', '1'); } catch(er){}
  rideau.className = 'net'; void rideau.offsetWidth; rideau.className = 'tombe';
  setTimeout(function(){ location.href = url.href; }, 720);
});

/* ============ Mur d'age ============ */
var age = $('#age');
var entre = false;
function entrer(){
  if (entre) return; entre = true;
  document.body.classList.remove('fige');
  document.dispatchEvent(new CustomEvent('officine:entree'));
}
window.OfficineEntree = function(){ return entre; };
if (!age || age.hidden){ setTimeout(function(){ lever(); entrer(); }, 80); }
else {
  $('#ageOui').addEventListener('click', function(){
    ecrire('officine_age', Date.now());
    age.classList.add('part');
    setTimeout(entrer, 450);
    setTimeout(function(){ age.hidden = true; }, 1300);
  });
  $('#ageNon').addEventListener('click', function(){ $('#ageRefus').hidden = false; });
}

/* ============ Navigation ============ */
var nav = $('#nav');
if (nav){
  var dernierY = 0;
  var majNav = function(){
    var y = window.scrollY;
    nav.classList.toggle('fond', y > 40);
    var cacher = y > 400 && y > dernierY + 4 && !document.body.classList.contains('fige');
    if (cacher) nav.classList.add('cache');
    else if (y < dernierY - 4 || y <= 400) nav.classList.remove('cache');
    document.body.classList.toggle('nav-visible', !nav.classList.contains('cache'));
    dernierY = y;
  };
  document.documentElement.style.setProperty('--h-nav', '68px');
  window.addEventListener('scroll', majNav, {passive: true}); majNav();
}
var menu = $('#menuMobile');
function fermerMenu(){ if (menu && menu.classList.contains('ouvert')){ menu.classList.remove('ouvert'); menu.setAttribute('aria-hidden', 'true'); document.body.classList.remove('fige'); } }
$$('[data-menu]').forEach(function(b){
  b.addEventListener('click', function(){
    var o = !menu.classList.contains('ouvert');
    if (!o) return fermerMenu();
    menu.classList.add('ouvert'); menu.setAttribute('aria-hidden', 'false'); document.body.classList.add('fige');
    $$('nav a span', menu).forEach(function(s, i){ s.style.transitionDelay = (0.25 + i * 0.06) + 's'; });
  });
});

/* ============ Curseur ============ */
var curseur = $('.curseur');
if (curseur && window.matchMedia('(hover:hover) and (pointer:fine)').matches && !reduit){
  var cx = -100, cy = -100, tx = -100, ty = -100;
  window.addEventListener('mousemove', function(e){ tx = e.clientX; ty = e.clientY; curseur.style.opacity = 1; }, {passive: true});
  document.addEventListener('mouseleave', function(){ curseur.style.opacity = 0; });
  (function boucle(){ cx += (tx - cx) * .2; cy += (ty - cy) * .2; curseur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)'; requestAnimationFrame(boucle); })();
  document.addEventListener('mouseover', function(e){
    var c = e.target.closest('[data-curseur]');
    curseur.classList.toggle('grand', !!c);
    if (c) $('span', curseur).textContent = c.dataset.curseur || 'Voir';
  });
}

/* ============ Panier unifie ============ */
var Panier = {
  items: lire('officine_panier', []),
  sauver: function(){ ecrire('officine_panier', this.items); this.rendre(); },
  compte: function(){ return this.items.reduce(function(t, i){ return t + i.qte; }, 0); },
  total: function(){ return this.items.reduce(function(t, i){ return t + i.qte * i.prix; }, 0); },
  ajouter: function(item, depuis){
    var ex = this.items.filter(function(i){ return i.id === item.id; })[0];
    if (ex) ex.qte = Math.min(ex.qte + 1, ex.max || 99);
    else { item.qte = 1; this.items.push(item); }
    var self = this;
    if (depuis && !reduit){ voler(depuis, function(){ self.sauver(); }); }
    else self.sauver();
  },
  changer: function(id, d){
    this.items = this.items.map(function(i){ if (i.id === id) i.qte = Math.max(0, Math.min(i.qte + d, i.max || 99)); return i; }).filter(function(i){ return i.qte > 0; });
    this.sauver();
  },
  retirer: function(id){ this.items = this.items.filter(function(i){ return i.id !== id; }); this.sauver(); },
  rendre: function(){
    var n = this.compte();
    $$('.btn-panier .nb').forEach(function(p){ p.textContent = n; });
    var corps = $('#panierCorps'); if (!corps) return;
    if (!this.items.length){
      corps.innerHTML = '<div class="p-vide"><p>Votre panier attend sa première bouteille.</p>Bouteilles et places d\'atelier se réunissent ici et se règlent en une fois.<br><br><a class="souligne" href="/selection">Parcourir la sélection</a></div>';
    } else {
      var html = '';
      [['produit', 'Bouteilles, retrait à Jarry'], ['evenement', 'Places réservées']].forEach(function(g){
        var l = Panier.items.filter(function(i){ return i.type === g[0]; });
        if (!l.length) return;
        html += '<p class="p-groupe">' + g[1] + '</p>';
        l.forEach(function(i){
          var mini = i.type === 'evenement' ? '<div class="mini evt">' + esc(String(i.jour || '')) + '</div>' : '<div class="mini">' + (i.image ? '<img src="' + esc(i.image) + '" alt="">' : bouteille(i.cat)) + '</div>';
          html += '<div class="p-ligne">' + mini + '<div><div class="nom">' + esc(i.nom) + '</div><div class="det">' + esc(i.det || '') + '</div>' +
            '<div class="p-ctrl"><span class="qte"><button data-q="-1" data-id="' + esc(i.id) + '" aria-label="Moins">−</button><span>' + i.qte + '</span><button data-q="1" data-id="' + esc(i.id) + '" aria-label="Plus">+</button></span>' +
            '<button class="retirer" data-del="' + esc(i.id) + '">Retirer</button></div></div><div class="prix">' + euros(i.qte * i.prix) + '</div></div>';
        });
      });
      corps.innerHTML = html;
    }
    $('#panierTotal').textContent = euros(this.total());
    $('#panierAccord').hidden = !this.items.length || !CONFIG.paiementActif;
    var ALCOOL = {rhums: 1, spiritueux: 1, vins: 1};
    var alcool = this.items.some(function(i){ return i.type !== 'produit' || ALCOOL[i.cat]; });
    var txt = $('#accordTxt');
    if (txt) txt.innerHTML = (alcool ? 'Je certifie avoir 18 ans ou plus et j\'accepte les ' : 'J\'accepte les ') + '<a class="souligne" href="/cgv" target="_blank">conditions de vente</a>.';
    $('#panierClient').hidden = !this.items.length || MODE !== 'retrait';
    $('#panierPayerTxt').textContent = MODE === 'retrait' ? 'Valider la commande' : 'Régler par carte';
    $('#panierPayer').disabled = !this.items.length || !CONFIG.paiementActif || !$('#panierOk').checked;
    $('#panierInfo').textContent = MODE === 'stripe' ? 'Paiement sécurisé par carte. ' + CONFIG.retrait + '.'
      : MODE === 'retrait' ? 'Règlement en boutique au moment du retrait. ' + CONFIG.retrait + '.'
      : 'La commande en ligne ouvre très prochainement. Votre panier reste enregistré.';
  }
};
window.OfficinePanier = Panier;
var tiroir = $('#panier'), voileP = $('#voilePanier');
function ouvrirPanier(){ tiroir.classList.add('ouvert'); voileP.classList.add('ouvert'); tiroir.setAttribute('aria-hidden', 'false'); document.body.classList.add('fige'); if (window.OfficineLenis) window.OfficineLenis.stop(); }
function fermerPanier(){ if (!tiroir || !tiroir.classList.contains('ouvert')) return; tiroir.classList.remove('ouvert'); voileP.classList.remove('ouvert'); tiroir.setAttribute('aria-hidden', 'true'); document.body.classList.remove('fige'); if (window.OfficineLenis) window.OfficineLenis.start(); }
$$('[data-panier]').forEach(function(b){ b.addEventListener('click', ouvrirPanier); });
if (tiroir){
  $('#panierFermer').addEventListener('click', fermerPanier);
  voileP.addEventListener('click', fermerPanier);
  $('#panierCorps').addEventListener('click', function(e){
    var q = e.target.closest('[data-q]'); if (q) Panier.changer(q.dataset.id, +q.dataset.q);
    var d = e.target.closest('[data-del]'); if (d) Panier.retirer(d.dataset.del);
  });
  $('#panierOk').addEventListener('change', function(){ Panier.rendre(); });
  $('#panierPayer').addEventListener('click', payer);
}
document.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ fermerPanier(); fermerMenu(); fermerFiche(); } });
function payer(){
  var b = $('#panierPayer'), info = $('#panierInfo');
  if (!Panier.items.length || !$('#panierOk').checked) return;
  var items = Panier.items.map(function(i){ return {id: i.id, qte: i.qte}; });
  var corps = {items: items}, route = '/api/paiement';
  if (MODE === 'retrait'){
    corps = {items: items, nom: $('#pcNom').value.trim(), tel: $('#pcTel').value.trim(), email: $('#pcMail').value.trim(), note: $('#pcNote').value.trim(), website: $('#pcSite').value, majeur: true};
    if (corps.nom.length < 2 || corps.tel.replace(/\D/g, '').length < 9 || !/^\S+@\S+\.\S+$/.test(corps.email)){
      info.textContent = 'Indiquez votre nom, votre téléphone et un e-mail valide pour recevoir la confirmation.'; return;
    }
    route = '/api/commander';
  }
  b.disabled = true; info.textContent = MODE === 'retrait' ? 'Enregistrement de votre commande…' : 'Ouverture du paiement sécurisé…';
  fetch(route, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(corps)})
    .then(function(r){ return r.json().then(function(d){ return {code: r.status, d: d}; }); })
    .then(function(x){
      if (x.d.ok && x.d.url){ location.href = x.d.url; return; }
      if (x.d.ok && x.d.numero){
        try { sessionStorage.setItem('officine_commande', JSON.stringify(x.d)); } catch(er){}
        Panier.items = []; Panier.sauver();
        location.href = '/merci?commande=' + encodeURIComponent(x.d.numero); return;
      }
      if (x.code === 409 && x.d.problemes){
        var noms = [];
        x.d.problemes.forEach(function(pb){
          var it = Panier.items.filter(function(i){ return i.id === pb.id; })[0]; if (!it) return;
          noms.push(it.nom + (pb.dispo > 0 ? ' (plus que ' + pb.dispo + ')' : ' (plus disponible)'));
          if (pb.dispo > 0){ it.qte = pb.dispo; it.max = pb.dispo; }
          else Panier.items = Panier.items.filter(function(i){ return i.id !== pb.id; });
        });
        Panier.sauver();
        $('#panierInfo').textContent = 'Le panier a été ajusté : ' + noms.join(', ') + '. Vérifiez puis réglez à nouveau.';
        return;
      }
      throw new Error(x.d.erreur || 'erreur');
    })
    .catch(function(e){
      Panier.rendre();
      $('#panierInfo').textContent = e.message && e.message !== 'erreur' ? e.message : 'Le paiement n\'a pas pu démarrer. Réessayez dans un instant.';
    });
}
if (/paiement=annule/.test(location.search)){
  setTimeout(function(){
    ouvrirPanier();
    $('#panierInfo').textContent = 'Paiement interrompu, rien n\'a été débité. Votre panier est intact.';
    history.replaceState(null, '', location.pathname);
  }, 1200);
}
function voler(depuis, fin){
  var cible = $('.nav .btn-panier');
  if (!cible){ fin(); return; }
  nav.classList.remove('cache');
  var a = depuis.getBoundingClientRect(), b = cible.getBoundingClientRect();
  var bille = document.createElement('div'); bille.className = 'bille'; document.body.appendChild(bille);
  var x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.right - 22, y1 = b.top + b.height / 2, t0 = performance.now();
  (function f(t){
    var p = Math.min((t - t0) / 800, 1), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    var x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - Math.sin(p * Math.PI) * 160;
    bille.style.transform = 'translate(' + (x - 6) + 'px,' + (y - 6) + 'px) scale(' + (1.4 - p * .6) + ')';
    if (p < 1) return requestAnimationFrame(f);
    bille.remove(); cible.classList.remove('bump'); void cible.offsetWidth; cible.classList.add('bump'); fin();
  })(t0);
}
Panier.rendre();

/* ============ Catalogue ============ */
var CATS = {'spiritueux': 'Spiritueux', 'rhums': 'Rhums & canne', 'vins': 'Vins & champagnes', 'epicerie': 'Épicerie fine', 'sans-alcool': 'Sans alcool'};
var grille = $('#grille'), produits = [], etat = {cat: 'tout', q: '', tri: 'defaut'};
function normal(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
if (grille){
  etat.cat = new URLSearchParams(location.search).get('cat') || 'tout';
  window.OfficineDonnees.produits().then(function(l){
    produits = l || [];
    if (produits.some(function(p){ return p.demo; })) $('#demo').hidden = false;
    var h = '<button data-cat="tout">Tout</button>';
    Object.keys(CATS).forEach(function(k){
      if (produits.some(function(p){ return p.categorie === k; })) h += '<button data-cat="' + k + '">' + CATS[k] + '</button>';
    });
    $('#chips').innerHTML = h + '<span class="barre"></span>';
    afficher(false);
  }).catch(function(){ grille.innerHTML = '<div class="vide-cat"><p class="d3">La sélection se charge mal.</p><p class="doux">Rechargez la page dans un instant.</p></div>'; });
  $('#chips').addEventListener('click', function(e){
    var c = e.target.closest('[data-cat]'); if (!c) return;
    etat.cat = c.dataset.cat;
    var u = new URL(location.href);
    if (etat.cat === 'tout') u.searchParams.delete('cat'); else u.searchParams.set('cat', etat.cat);
    history.replaceState(null, '', u);
    afficher(true);
    var f = $('#filtres');
    if (f.getBoundingClientRect().top < 90){
      var y = f.offsetTop - 60;
      if (window.OfficineLenis) window.OfficineLenis.scrollTo(y); else window.scrollTo({top: y, behavior: 'smooth'});
    }
  });
  $('#recherche').addEventListener('input', function(e){ etat.q = normal(e.target.value.trim()); afficher(true); });
  $('#tri').addEventListener('change', function(e){ etat.tri = e.target.value; afficher(true); });
  grille.addEventListener('click', function(e){
    var es = e.target.closest('[data-essai]'); if (es){ essayer(es.dataset.essai); return; }
    var a = e.target.closest('.ajout:not(.voir)');
    if (a){ e.stopPropagation(); ajouterProduit(a.dataset.id, a); return; }
    var v = e.target.closest('[data-fiche]'); if (v) ouvrirFiche(v.dataset.fiche);
  });
  grille.addEventListener('keydown', function(e){ if (e.key === 'Enter' && e.target.dataset.fiche) ouvrirFiche(e.target.dataset.fiche); });
  window.addEventListener('resize', placerBarre);
}
/* ============ Recherche intelligente : tolère les fautes, comprend les familles, propose ============ */
var ALIAS = {
  'rhums': 'rhum rhums rum ron canne agricole ambre vieux blanc caraibes antilles',
  'spiritueux': 'spiritueux whisky whiskey scotch bourbon gin vodka cognac armagnac calvados tequila mezcal liqueur aperitif amer vermouth eau de vie',
  'vins': 'vin vins champagne bulles petillant rouge blanc rose cremant prosecco',
  'epicerie': 'epicerie huile olive vinaigre condiment truffe miel',
  'sans-alcool': 'sans alcool zero 0% soft sirop limonade cola jus'
};
var VIDES = {de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, en: 1, au: 1, aux: 1, un: 1, une: 1, d: 1, l: 1, a: 1, pour: 1, avec: 1};
function mots(s){ return normal(s).replace(/[^a-z0-9%]+/g, ' ').trim().split(' ').filter(Boolean); }
function ecart(a, b, max){
  if (Math.abs(a.length - b.length) > max) return max + 1;
  var v = []; for (var j = 0; j <= b.length; j++) v[j] = j;
  for (var i = 1; i <= a.length; i++){
    var prec = v[0], mini = v[0] = i;
    for (j = 1; j <= b.length; j++){
      var t = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1));
      prec = t; if (v[j] < mini) mini = v[j];
    }
    if (mini > max) return max + 1;
  }
  return v[b.length];
}
function indexer(p){
  if (p._idx) return p._idx;
  p._idx = {
    fort: mots([p.marque, p.nom].join(' ')),
    moyen: mots([p.origine, p.style, p.accroche, CATS[p.categorie]].join(' ')),
    famille: mots(ALIAS[p.categorie] || ''),
    faible: mots([p.notes, p.description].concat((p.caracteristiques || []).map(function(r){ return r[1]; })).join(' ')),
    plein: mots([p.marque, p.nom].join(' ')).join(' ')
  };
  return p._idx;
}
function scoreMot(q, liste){
  var tol = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0, meilleur = 0;
  for (var i = 0; i < liste.length && meilleur < 1; i++){
    var w = liste[i], s = 0;
    if (w === q) s = 1;
    else if (w.indexOf(q) === 0) s = q.length >= 2 ? .85 : 0;
    else if (q.length >= 4 && w.indexOf(q) > 0) s = .65;
    else if (tol){
      var d = Math.min(ecart(q, w, tol), w.length > q.length ? ecart(q, w.slice(0, q.length), tol) : tol + 1);
      if (d <= tol) s = .6 - d * .12;
    }
    if (s > meilleur) meilleur = s;
  }
  return meilleur;
}
var largeCache = {};
function pertinence(p, q){
  if (!(q in largeCache)) largeCache[q] = !produits.some(function(x){ return brute(x, q, false) > 0; });
  return brute(p, q, largeCache[q]);
}
function brute(p, q, large){
  var t = mots(q), idx = indexer(p);
  var utiles = t.filter(function(m){ return !VIDES[m]; });
  if (utiles.length) t = utiles;
  if (!t.length) return 1;
  var total = 0;
  for (var i = 0; i < t.length; i++){
    var s = Math.max(scoreMot(t[i], idx.fort), scoreMot(t[i], idx.moyen) * .75, scoreMot(t[i], idx.faible) * .45, large ? scoreMot(t[i], idx.famille) * .5 : 0);
    if (!s) return 0;
    total += s;
  }
  if (idx.plein.indexOf(t.join(' ')) > -1) total += 1;
  return total;
}
var vocabulaire = null;
function peutEtre(q){
  if (!vocabulaire){
    var v = {};
    produits.forEach(function(p){ var x = indexer(p); x.fort.concat(x.moyen, x.famille).forEach(function(m){ if (m.length > 2) v[m] = 1; }); });
    vocabulaire = Object.keys(v);
  }
  var t = mots(q).filter(function(m){ return !VIDES[m]; }), sortie = [];
  for (var i = 0; i < t.length; i++){
    var best = null, bd = 99, tol = Math.max(2, Math.floor(t[i].length / 3));
    vocabulaire.forEach(function(m){ var d = ecart(t[i], m, tol); if (d < bd){ bd = d; best = m; } });
    sortie.push(bd <= tol ? best : t[i]);
  }
  var prop = sortie.join(' ');
  return prop && prop !== t.join(' ') ? prop : '';
}
function essayer(txt){
  var r = $('#recherche'); r.value = txt; etat.q = normal(txt); afficher(true); montrerSuggestions(); r.focus();
}
var sugg = $('#suggestions'), actif = -1;
function fermerSuggestions(){ if (!sugg) return; sugg.hidden = true; actif = -1; $('#recherche').setAttribute('aria-expanded', 'false'); }
function montrerSuggestions(){
  if (!sugg) return;
  var q = $('#recherche').value.trim();
  if (q.length < 2 || !produits.length){ fermerSuggestions(); return; }
  var l = produits.map(function(p){ return {p: p, s: pertinence(p, q)}; }).filter(function(x){ return x.s > 0; })
    .sort(function(a, b){ return b.s - a.s; });
  var html = '';
  if (!l.length){
    var pv = peutEtre(q);
    html = '<p class="sg-vide">Aucune référence pour « ' + esc(q) + ' ».' + (pv ? ' <button class="sg-essai" data-essai="' + esc(pv) + '">Essayer « ' + esc(pv) + ' »</button>' : '') + '</p>';
  } else {
    html = l.slice(0, 6).map(function(x, i){
      var p = x.p;
      return '<button class="sg" role="option" id="sg' + i + '" data-sugg="' + esc(p.id) + '">' +
        '<span class="sg-img' + (p.image && p.photo_type !== 'ambiance' ? ' detoure' : '') + '">' + (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '') + '</span>' +
        '<span class="sg-txt"><b>' + esc(p.nom) + '</b><small>' + esc([p.marque, CATS[p.categorie]].filter(Boolean).join(', ')) + '</small></span>' +
        '<span class="sg-px">' + (enVente(p) ? euros(p.prix) : 'En boutique') + '</span></button>';
    }).join('') + (l.length > 6 ? '<button class="sg-tout" data-sg-tout>Voir les ' + l.length + ' résultats</button>' : '');
  }
  sugg.innerHTML = html; sugg.hidden = false; actif = -1;
  $('#recherche').setAttribute('aria-expanded', 'true');
}
function marquer(n){
  var b = $$('.sg', sugg); if (!b.length) return;
  actif = (n + b.length) % b.length;
  b.forEach(function(x, i){ x.classList.toggle('actif', i === actif); });
  $('#recherche').setAttribute('aria-activedescendant', 'sg' + actif);
}
if (sugg){
  var champ = $('#recherche');
  champ.addEventListener('input', montrerSuggestions);
  champ.addEventListener('focus', montrerSuggestions);
  champ.addEventListener('keydown', function(e){
    if (sugg.hidden) return;
    if (e.key === 'ArrowDown'){ e.preventDefault(); marquer(actif + 1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); marquer(actif - 1); }
    else if (e.key === 'Enter'){ e.preventDefault(); var b = $$('.sg', sugg)[actif]; if (b) b.click(); else { fermerSuggestions(); champ.blur(); } }
    else if (e.key === 'Escape'){ fermerSuggestions(); }
  });
  sugg.addEventListener('mousedown', function(e){ e.preventDefault(); });
  sugg.addEventListener('click', function(e){
    var es = e.target.closest('[data-essai]'); if (es){ essayer(es.dataset.essai); return; }
    if (e.target.closest('[data-sg-tout]')){ fermerSuggestions(); champ.blur(); return; }
    var b = e.target.closest('[data-sugg]'); if (!b) return;
    fermerSuggestions(); champ.blur(); ouvrirFiche(b.dataset.sugg);
  });
  champ.addEventListener('blur', function(){ setTimeout(fermerSuggestions, 120); });
}
function placerBarre(){
  var actif = $('#chips [aria-pressed="true"]'), barre = $('#chips .barre');
  if (!actif || !barre) return;
  barre.style.width = actif.offsetWidth + 'px';
  barre.style.transform = 'translateX(' + actif.offsetLeft + 'px)';
}
function afficher(anime){
  $$('#chips [data-cat]').forEach(function(c){ c.setAttribute('aria-pressed', etat.q ? c.dataset.cat === 'tout' : c.dataset.cat === etat.cat); });
  placerBarre();
  var liste = produits.filter(function(p){
    return (etat.q || etat.cat === 'tout' || p.categorie === etat.cat) && (!etat.q || (p._score = pertinence(p, etat.q)) > 0);
  });
  if (etat.q && etat.tri === 'defaut') liste.sort(function(a, b){ return b._score - a._score; });
  if (etat.tri === 'prix-asc') liste.sort(function(a, b){ return a.prix - b.prix; });
  if (etat.tri === 'prix-desc') liste.sort(function(a, b){ return b.prix - a.prix; });
  if (etat.tri === 'nom') liste.sort(function(a, b){ return a.nom.localeCompare(b.nom, 'fr'); });
  $('#compte').textContent = liste.length + (liste.length > 1 ? ' références' : ' référence') + (etat.q ? ' pour votre recherche, tous rayons' : '');
  if (!produits.length){ grille.innerHTML = '<div class="vide-cat"><p class="d3">La sélection arrive très bientôt en ligne.</p><p class="doux" style="margin-top:10px">La boutique de Jarry vous accueille du mardi au samedi.</p></div>'; return; }
  if (!liste.length){ var pv = peutEtre(etat.q); grille.innerHTML = '<div class="vide-cat"><p class="d3">Rien ne correspond à « ' + esc($('#recherche').value.trim()) + ' ».</p><p class="doux" style="margin-top:10px">' + (pv ? 'Vous cherchiez peut-être <button class="souligne" data-essai="' + esc(pv) + '">' + esc(pv) + '</button> ?' : 'Essayez le nom d\'une maison, un pays ou un arôme.') + '</p></div>'; return; }
  var avant = {};
  if (anime && !reduit) $$('.fiche-c', grille).forEach(function(el){ avant[el.dataset.id] = el.getBoundingClientRect(); });
  grille.innerHTML = liste.map(carte).join('');
  if (reduit) return;
  $$('.fiche-c', grille).forEach(function(el, i){
    var a = avant[el.dataset.id], b = el.getBoundingClientRect();
    if (a) el.animate([{transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)'}, {transform: 'none'}], {duration: 900, easing: 'cubic-bezier(.19,1,.22,1)'});
    else if (b.top < innerHeight + 100) el.animate([{opacity: 0, transform: 'translateY(50px)'}, {opacity: 1, transform: 'none'}], {duration: 1100, delay: Math.min(i, 8) * 70 + (anime ? 0 : 300), easing: 'cubic-bezier(.19,1,.22,1)', fill: 'backwards'});
  });
}
function enVente(p){ return Number(p.prix) > 0; }
function visuel(p, attrs){
  return '<div class="visuel' + (p.image && p.photo_type !== 'ambiance' ? ' detoure' : '') + '" ' + (attrs || '') + '>' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.nom) + '" loading="lazy">' : bouteille(p.categorie)) +
    '<span class="pastilles">' + (enVente(p) && p.stock === 0 ? '<span class="etiquette-r">Revient bientôt</span>' : '') +
    (p.offre ? '<span class="etiquette-r offre">' + esc(p.offre) + '</span>' : '') +
    (p.badge ? '<span class="etiquette-r">' + esc(p.badge) + '</span>' : '') + '</span>';
}
function carte(p){
  return '<article class="fiche-c" data-id="' + esc(p.id) + '">' +
    visuel(p, 'data-fiche="' + esc(p.id) + '" tabindex="0" role="button" aria-label="Voir ' + esc(p.nom) + '"') +
    (enVente(p) ? '<button class="ajout" data-id="' + esc(p.id) + '"' + (p.stock === 0 ? ' disabled>Indisponible' : '>Ajouter au panier') + '</button>' : '<button class="ajout voir" data-fiche="' + esc(p.id) + '" tabindex="-1">Voir la fiche</button>') + '</div>' +
    '<div class="bas"><div>' + (p.marque ? '<p class="marque-c">' + esc(p.marque) + '</p>' : '') + '<h3>' + esc(p.nom) + '</h3><p class="orig">' + esc([p.origine, p.contenance].filter(Boolean).join(', ')) + '</p></div>' + prixHtml(p) + '</div></article>';
}
function prixHtml(p){
  if (!enVente(p)) return '<span class="en-boutique">En boutique</span>';
  return '<span class="prix">' + (p.offre && p.prix_normal > p.prix ? '<s>' + euros(p.prix_normal) + '</s> ' : '') + euros(p.prix) + '</span>';
}
function ajouterProduit(id, el){
  var p = produits.filter(function(x){ return x.id === id; })[0];
  if (!p || p.stock === 0 || !enVente(p)) return;
  Panier.ajouter({id: 'p-' + p.id, type: 'produit', cat: p.categorie, image: p.image || '', nom: (p.marque ? p.marque + ' ' : '') + p.nom, det: [p.contenance, p.offre].filter(Boolean).join(', '), prix: p.prix, max: p.stock || 99}, el);
}
var ficheVoile = $('#ficheVoile');
function ouvrirFiche(id){
  var p = produits.filter(function(x){ return x.id === id; })[0]; if (!p || !ficheVoile) return;
  var dl = [['Rayon', CATS[p.categorie]], ['Origine', p.origine], ['Degré', p.degre], ['Contenance', p.contenance]].concat(p.caracteristiques || [])
    .filter(function(r){ return r[1]; }).map(function(r){ return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
  $('#fiche').innerHTML = '<span class="poignee" aria-hidden="true"></span>' + visuel(p) + '</div><div class="info"><button class="fermer" data-fermer-fiche aria-label="Fermer la fiche"><span>Fermer</span><i aria-hidden="true"></i></button>' +
    '<div class="f-tete">' + (p.marque ? '<p class="marque-f">' + esc(p.marque) + '</p>' : '') + '<h3 class="d3">' + esc(p.nom) + '</h3><p class="note">' + esc(p.accroche || CATS[p.categorie]) + '</p></div>' +
    (p.notes ? '<div class="f-bloc"><h4>Dégustation</h4><p class="notes">' + esc(p.notes) + '</p></div>' : '') +
    (p.description ? '<div class="f-bloc"><h4>L\'histoire</h4><p class="desc-fiche">' + esc(p.description) + '</p></div>' : '') +
    '<div class="f-bloc"><h4>Fiche technique</h4><dl>' + dl + '</dl></div>' +
    (p.maison ? '<div class="maison-f"><b>La maison</b>' + esc(p.maison) + '</div>' : '') +
    '<div class="actions">' + (!enVente(p) ? '<p class="boutique-f">Disponible en boutique à Jarry. La vente en ligne arrive bientôt.</p><a class="cta ligne" href="/contact?sujet=information">Nous écrire ' + FL + '</a></div></div>' : '<span class="px">' + (p.offre && p.prix_normal > p.prix ? '<s>' + euros(p.prix_normal) + '</s> ' : '') + euros(p.prix) + (p.offre ? ' <em class="offre-txt">' + esc(p.offre) + '</em>' : '') + '</span>' +
    (p.stock === 0 ? '<span class="cta ligne" style="pointer-events:none">Revient bientôt</span>' : '<button class="cta encre" data-ajout-fiche="' + esc(p.id) + '">Ajouter au panier ' + FL + '</button>') + '</div></div>');
  ficheVoile.classList.add('ouvert');
  if (window.OfficineLenis) window.OfficineLenis.stop();
}
function fermerFiche(){ if (ficheVoile && ficheVoile.classList.contains('ouvert')){ ficheVoile.classList.remove('ouvert'); if (window.OfficineLenis) window.OfficineLenis.start(); } }
if (ficheVoile){
  ficheVoile.addEventListener('click', function(e){
    if (e.target === ficheVoile || e.target.closest('[data-fermer-fiche]')) return fermerFiche();
    var b = e.target.closest('[data-ajout-fiche]');
    if (b){ ajouterProduit(b.dataset.ajoutFiche, b); setTimeout(fermerFiche, 500); }
  });
}

/* ============ Programme ============ */
var MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function jour(s){ var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
var agenda = $('#agenda');
if (agenda){
  window.OfficineDonnees.evenements().then(function(l){
    var auj = new Date(); auj.setHours(0, 0, 0, 0);
    var evts = (l || []).filter(function(e){ return jour(e.date) >= auj; })
      .sort(function(a, b){ return ((a.ordre || 100) - (b.ordre || 100)) || (jour(a.date) - jour(b.date)); });
    if (agenda.dataset.limite) evts = evts.slice(0, +agenda.dataset.limite);
    var demo = $('#demoEvt'); if (demo && evts.some(function(e){ return e.demo; })) demo.hidden = false;
    if (!evts.length){ $('#attente').hidden = false; agenda.hidden = true; return; }
    agenda.innerHTML = evts.map(function(e){
      var d = jour(e.date), r = e.places_restantes, complet = r <= 0;
      var total = e.places_total || Math.max(r, 12);
      var pris = Math.max(0, Math.min(100, Math.round((total - Math.max(r, 0)) / total * 100)));
      return '<article class="evt rv' + (complet ? ' complet' : '') + (e.image ? ' avec-img' : '') + '">' +
        '<div class="evt-img">' + (e.image ? '<img src="' + esc(e.image) + '" alt="" loading="lazy">' : '<img class="evt-cle" src="/img/symbole-cle.png" alt="">') + '</div>' +
        '<div class="date"><b>' + d.getDate() + '</b><span>' + MOIS[d.getMonth()] + '</span><em>' + esc(e.heure) + '</em></div>' +
        '<div class="evt-corps"><p class="fmt">' + esc(e.format) + '</p><h3>' + esc(e.titre) + '</h3>' + (e.description ? '<p class="desc">' + esc(e.description) + '</p>' : '') + '</div>' +
        '<div class="places"><span class="p-prix">' + euros(e.prix) + ' la place</span><span class="p-reste">' + (complet ? 'Complet' : r + (r > 1 ? ' places restantes' : ' place restante')) + '</span><span class="jauge" aria-hidden="true"><i style="width:' + pris + '%"></i></span></div>' +
        (complet ? '<span class="etat">Liste d\'attente en boutique</span>' : '<button class="cta plein" data-resa="' + esc(e.id) + '">Réserver ' + FL + '</button>') + '</article>';
    }).join('');
    document.dispatchEvent(new CustomEvent('officine:contenu', {detail: agenda}));
    agenda.addEventListener('click', function(ev){
      var b = ev.target.closest('[data-resa]'); if (!b) return;
      var e = evts.filter(function(x){ return x.id === b.dataset.resa; })[0], d = jour(e.date);
      Panier.ajouter({id: 'e-' + e.id, type: 'evenement', jour: d.getDate(), nom: e.titre, det: d.getDate() + ' ' + MOIS[d.getMonth()] + ', ' + e.heure, prix: e.prix, max: e.places_restantes}, b);
    });
  }).catch(function(){ $('#attente').hidden = false; });
}

/* ============ Contact ============ */
var form = $('#formContact');
if (form){
  var params = new URLSearchParams(location.search);
  var choisir = function(p){
    $$('.profils button').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.profil === p); });
    form.dataset.profil = p;
    $$('.cond', form).forEach(function(c){
      var on = c.dataset.pour.split(' ').indexOf(p) > -1;
      c.classList.toggle('on', on);
      $$('input', c).forEach(function(i){ i.disabled = !on; });
    });
  };
  $$('.profils button').forEach(function(b){ b.addEventListener('click', function(){ choisir(b.dataset.profil); }); });
  choisir(['particulier', 'entreprise', 'fournisseur'].indexOf(params.get('profil')) > -1 ? params.get('profil') : 'particulier');
  var sujet = params.get('sujet'); if (sujet && $('#fSujet option[value="' + sujet + '"]')) $('#fSujet').value = sujet;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var retour = $('#retourForm'), bouton = $('button[type=submit]', form);
    if (form.website.value) return;
    if (!form.nom.value.trim() || !/^\S+@\S+\.\S+$/.test(form.email.value) || !form.message.value.trim()){
      retour.className = 'retour-form ko'; retour.textContent = 'Indiquez votre nom, un e-mail valide et votre message.'; return;
    }
    var data = {profil: form.dataset.profil};
    $$('input,select,textarea', form).forEach(function(i){ if (i.name && i.name !== 'website' && !i.disabled) data[i.name] = i.value.trim(); });
    bouton.disabled = true; retour.className = 'retour-form'; retour.textContent = 'Envoi en cours…';
    fetch('/api/contact', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(){ retour.className = 'retour-form ok'; retour.textContent = 'Message envoyé. L\'équipe vous répond rapidement.'; form.reset(); choisir(data.profil); })
      .catch(function(){
        var corps = Object.keys(data).map(function(k){ return k + ' : ' + data[k]; }).join('\n');
        retour.className = 'retour-form ko';
        retour.innerHTML = 'L\'envoi direct n\'a pas abouti. <a class="souligne" href="mailto:' + form.dataset.mail + '?subject=' + encodeURIComponent('Demande site, ' + data.profil) + '&body=' + encodeURIComponent(corps) + '">Envoyer par e-mail</a>.';
      })
      .then(function(){ bouton.disabled = false; });
  });
}

/* ============ Videos ============ */
$$('video[data-mobile]').forEach(function(v){ if (window.innerWidth < 700){ $('source', v).src = v.dataset.mobile; v.load(); } });
})();
