/* ═══════════════════════════════════════════════════════════════
   NOVALEM APP — js/decouverte.js
   Page "Decouverte" : trouve automatiquement les restos (et commerces)
   d'une zone qui n'ont PAS de site, et les envoie direct dans la file
   d'appels (web_prospection_cibles, statut a_appeler).
   - quadrille la zone, redecoupe toute case saturee => aucun spot loupe
   - filtre ceux sans vrai site (page Facebook = cible aussi)
   - classe par "chaleur" (note x avis) pour attaquer les plus chauds
   - WhatsApp Business en 1 clic (message pret) sur chaque resultat
   - bandeau stats de prospection (vivier, contactes, RDV, close, CA)
   Autonome : sa propre connexion Supabase (session partagee = RLS ok).
   Expose window.Decouverte.render().
═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var SB_URL = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';
var PRIX_SITE = 490;

// Message WhatsApp pre-rempli ({NOM} = nom du resto). Modifiable ici.
function MSG(nom) {
  return 'Bonjour ' + nom + ', je suis Louis du studio web Novalem (Guadeloupe). '
    + 'J\'ai vu que vous n\'avez pas encore de site internet. Je realise des sites simples '
    + 'et pros pour les restos d\'ici : menu en QR code, page de presentation, a partir de '
    + '250 EUR. Un exemple : https://ifc-guadeloupe.fr Ca vous dirait d\'en parler ?';
}

/* ── reglages du scan ──────────────────────────────────── */
var INITIAL_STEP = 0.045;   // ~5 km
var MIN_STEP = 0.006;       // finesse max au redecoupage (~650 m)
var K_SCAN = 3;             // cases en parallele
var LOT_DETAILS = 20;       // fiches par appel details

var PRESETS = {
  resto: ['restaurant', 'meal_takeaway'],
  large: ['restaurant', 'meal_takeaway', 'cafe', 'bar', 'bakery']
};

var PAS_UN_VRAI_SITE = ['facebook.com', 'instagram.com', 'fb.me', 'linktr.ee', 'linktree',
  'tripadvisor.', 'thefork.', 'lafourchette.', 'ubereats.', 'deliveroo.', 'google.com',
  'goo.gl', 'wa.me', 'whatsapp.com', 'beacons.ai', 'taplink', 'sites.google.com'];

var ILES = {
  'GRANDE-TERRE':  { s: 16.17, n: 16.52, w: -61.61, e: -61.14 },
  'BASSE-TERRE':   { s: 15.93, n: 16.37, w: -61.82, e: -61.50 },
  'MARIE-GALANTE': { s: 15.85, n: 16.02, w: -61.36, e: -61.12 },
  'LES-SAINTES':   { s: 15.83, n: 15.90, w: -61.68, e: -61.55 },
  'LA-DESIRADE':   { s: 16.28, n: 16.34, w: -61.10, e: -60.82 }
};
// zones proposees dans le menu : iles + spots chauds + test + tout
var ZONES = {
  'TEST (Gosier, ~1 min)': { boxes: [{ s: 16.19, n: 16.23, w: -61.53, e: -61.47 }] },
  'Jarry / Baie-Mahault':  { boxes: [{ s: 16.22, n: 16.30, w: -61.62, e: -61.54 }] },
  'Le Gosier':             { boxes: [{ s: 16.18, n: 16.24, w: -61.54, e: -61.44 }] },
  'Pointe-a-Pitre':        { boxes: [{ s: 16.22, n: 16.26, w: -61.56, e: -61.51 }] },
  'Sainte-Anne / St-Francois': { boxes: [{ s: 16.21, n: 16.28, w: -61.41, e: -61.24 }] },
  'Grande-Terre (ile)':    { boxes: [ILES['GRANDE-TERRE']] },
  'Basse-Terre (ile)':     { boxes: [ILES['BASSE-TERRE']] },
  'Marie-Galante':         { boxes: [ILES['MARIE-GALANTE']] },
  'Les Saintes':           { boxes: [ILES['LES-SAINTES']] },
  'La Desirade':           { boxes: [ILES['LA-DESIRADE']] },
  'TOUTE LA GUADELOUPE':   { boxes: [ILES['GRANDE-TERRE'], ILES['BASSE-TERRE'], ILES['MARIE-GALANTE'], ILES['LES-SAINTES'], ILES['LA-DESIRADE']] }
};

var COMMUNES = [
  ['Le Gosier',16.206,-61.499],['Les Abymes',16.271,-61.505],['Pointe-a-Pitre',16.241,-61.533],
  ['Baie-Mahault',16.267,-61.588],['Le Moule',16.333,-61.348],['Sainte-Anne',16.227,-61.383],
  ['Saint-Francois',16.252,-61.271],['Petit-Bourg',16.190,-61.591],['Sainte-Rose',16.331,-61.697],
  ['Gourbeyre',16.006,-61.680],['Basse-Terre',15.998,-61.727],['Capesterre-Belle-Eau',16.045,-61.567],
  ['Lamentin',16.269,-61.632],['Morne-a-l\'Eau',16.336,-61.516],['Petit-Canal',16.383,-61.489],
  ['Port-Louis',16.420,-61.531],['Anse-Bertrand',16.472,-61.506],['Bouillante',16.132,-61.769],
  ['Deshaies',16.302,-61.795],['Pointe-Noire',16.232,-61.789],['Vieux-Habitants',16.058,-61.766],
  ['Baillif',16.013,-61.746],['Saint-Claude',16.024,-61.686],['Trois-Rivieres',15.965,-61.641],
  ['Vieux-Fort',15.951,-61.708],['Goyave',16.130,-61.571],['Grand-Bourg',15.883,-61.316],
  ['Capesterre-de-Marie-Galante',15.902,-61.223],['Saint-Louis',15.958,-61.311],
  ['Terre-de-Haut',15.865,-61.585],['Terre-de-Bas',15.855,-61.639],['La Desirade',16.307,-61.020]
];

/* ── helpers ───────────────────────────────────────────── */
var _sb = null;
function sb() { if (!_sb) _sb = window.supabase.createClient(SB_URL, SB_ANON); return _sb; }
function el(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m, warn) {
  var t = document.createElement('div'); t.className = 'toast' + (warn ? ' warn' : ''); t.textContent = m;
  var box = el('toaster'); if (box) box.appendChild(t); setTimeout(function () { t.remove(); }, 3400);
}
function eur(n) { return (Math.round(n || 0)).toLocaleString('fr-FR') + ' \u20AC'; }
function norm(s) { return (s == null ? '' : String(s)).trim().toLowerCase().replace(/\s+/g, ' '); }
function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '\u2013'; }
function heat(rating, reviews) { return (rating || 0) * Math.log10((reviews || 0) + 1); }

function grid(box, step) {
  var cells = [];
  for (var la = box.s; la < box.n - 1e-9; la += step)
    for (var lo = box.w; lo < box.e - 1e-9; lo += step)
      cells.push({ s: la, n: Math.min(la + step, box.n), w: lo, e: Math.min(lo + step, box.e) });
  return cells;
}
function distKm(aLat, aLng, bLat, bLng) {
  var R = 6371, toRad = function (d) { return d * Math.PI / 180; };
  var dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function communeProche(lat, lng) {
  if (lat == null) return '';
  var best = '', bd = Infinity;
  for (var i = 0; i < COMMUNES.length; i++) { var d = distKm(lat, lng, COMMUNES[i][1], COMMUNES[i][2]); if (d < bd) { bd = d; best = COMMUNES[i][0]; } }
  return best;
}
function analyseSite(website) {
  if (!website) return { real: false, kind: 'aucun', social: '' };
  var bas = website.toLowerCase();
  for (var i = 0; i < PAS_UN_VRAI_SITE.length; i++) if (bas.indexOf(PAS_UN_VRAI_SITE[i]) >= 0) return { real: false, kind: 'facebook', social: website };
  return { real: true, kind: 'correct', social: website };
}
function waLink(tel, nom) {
  if (window.novaWaLink) return window.novaWaLink(tel, nom);
  if (!tel) return '';
  var d = String(tel).replace(/[^0-9]/g, ''); if (!d) return '';
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(MSG(nom));
}

/* ── appels moteur ─────────────────────────────────────── */
async function apiScan(cell, types) {
  var r = await fetch('/api/decouverte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'scan', cell: cell, types: types }) });
  var d = await r.json(); if (!r.ok) throw new Error(d.error || ('scan HTTP ' + r.status)); return d;
}
async function apiDetails(ids) {
  var r = await fetch('/api/decouverte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'details', ids: ids }) });
  var d = await r.json(); if (!r.ok) throw new Error(d.error || ('details HTTP ' + r.status)); return d.details || {};
}

/* ── etat ──────────────────────────────────────────────── */
var running = false, stopFlag = false, meId = null;
var SENT = {}, LAST = null;
function plusJours(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

async function ensureMe() {
  if (meId) return;
  try {
    var s = await sb().auth.getSession();
    var email = s.data && s.data.session ? s.data.session.user.email : null;
    if (!email) return;
    var u = await sb().from('users').select('id').eq('email', email).maybeSingle();
    meId = u.data ? u.data.id : null;
  } catch (e) { /* owner restera null, la colonne est nullable */ }
}

/* ── rendu de la page ──────────────────────────────────── */
function render() {
  ensureMe();
  var opts = Object.keys(ZONES).map(function (z) { return '<option value="' + z + '">' + z + '</option>'; }).join('');
  el('content').innerHTML =
    '<div id="dec-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px"></div>' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
    '  <span style="font-size:12.5px;color:var(--mut)">Tout s\'enregistre automatiquement dans le cloud : tu peux fermer, ou passer du telephone au PC, sans rien perdre.</span>' +
    '  <button class="btn ghost sm" type="button" onclick="Decouverte._openMsg()" style="margin-left:auto">Modifier le message</button>' +
    '  <button class="btn ghost sm" type="button" onclick="Decouverte._backup()">Sauvegarder une copie</button>' +
    '</div>' +
    '<div class="grid" style="grid-template-columns:360px 1fr;gap:16px;align-items:start">' +
    '  <div class="card">' +
    '    <h2>Lancer une recherche</h2>' +
    '    <div style="font-size:12.5px;color:var(--mut);margin-bottom:10px">Choisis une zone. L\'outil ratisse tout, redecoupe les zones denses pour ne rien louper, garde ceux <b>sans site</b> et les met dans la file d\'appels.</div>' +
    '    <label class="lbl">Zone</label>' +
    '    <select id="dec-zone">' + opts + '</select>' +
    '    <label class="lbl" style="margin-top:12px">Cible</label>' +
    '    <select id="dec-cible"><option value="resto">Restaurants (resto, snack, lolo)</option><option value="large">Restaurants + cafes / bars / boulangeries</option></select>' +
    '    <button id="dec-go" class="btn gold" style="width:100%;margin-top:16px" onclick="Decouverte._go()">Scanner la zone</button>' +
    '    <button id="dec-stop" class="btn ghost" style="width:100%;margin-top:8px;display:none" onclick="Decouverte._stop()">Arreter</button>' +
    '    <div id="dec-prog" style="margin-top:14px;font-size:13px;color:var(--mut)"></div>' +
    '    <div style="margin-top:14px;font-size:11.5px;color:var(--mut);line-height:1.5">WhatsApp Business : le bouton ouvre ton WhatsApp avec le message pret. Rythme humain, evite 300 messages identiques d\'un coup.</div>' +
    '  </div>' +
    '  <div class="card"><h2>Resultats</h2><div id="dec-res"><div class="empty">Lance un scan pour voir les restos sans site, les plus chauds en haut.</div></div></div>' +
    '</div>';
  loadStats();
}

async function loadStats() {
  var box = el('dec-stats'); if (!box) return;
  try {
    var q = await Promise.all([
      sb().from('web_prospection_cibles').select('statut,qualite_site'),
      sb().from('web_prospection_actions').select('cible_id,resultat'),
      sb().from('web_evenements').select('type,cible_id,statut,montant')
    ]);
    var cibles = q[0].data || [], actions = q[1].data || [], events = q[2].data || [];
    var vivier = cibles.filter(function (c) { return c.qualite_site === 'aucun' || c.qualite_site === 'facebook'; }).length;
    var aContacter = cibles.filter(function (c) { return c.statut === 'a_appeler'; }).length;
    // Un seul tunnel, meme population : les cibles de prospection et leurs actions.
    var contactes = {}, repondu = {}, rdv = {};
    actions.forEach(function (a) {
      if (!a.cible_id) return;
      contactes[a.cible_id] = 1;
      // "reponse" = le prospect a vraiment repondu (RDV, a voulu un mail, ou a dit non).
      // Un WhatsApp envoye (resultat "contacte") ou un simple "a rappeler" ne comptent pas comme reponse.
      if (['rdv_pris', 'mail_envoye', 'pas_interesse'].indexOf(a.resultat) >= 0) repondu[a.cible_id] = 1;
      if (a.resultat === 'rdv_pris') rdv[a.cible_id] = 1;
    });
    var nbC = Object.keys(contactes).length, nbR = Object.keys(repondu).length, nbRdv = Object.keys(rdv).length;
    // CA en jeu = somme des vraies valeurs estimees des RDV issus de la prospection (pas 490 automatique).
    var caEnJeu = events.filter(function (e) { return e.cible_id && (e.type || '').indexOf('rdv') === 0 && e.statut !== 'annule'; })
      .reduce(function (s, e) { return s + ((e.montant != null && e.montant !== '') ? (Number(e.montant) || 0) : PRIX_SITE); }, 0);
    function bloc(v, l, cls, s) { return '<div class="kpi' + (cls ? ' ' + cls : '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>'; }
    box.innerHTML =
      bloc(vivier, 'restos sans site') +
      bloc(aContacter, 'a contacter') +
      bloc(nbC, 'contactes') +
      bloc(pct(nbR, nbC), 'taux de reponse', 'blue') +
      bloc(nbRdv, 'RDV pris', 'gold') +
      bloc(eur(caEnJeu), 'CA en jeu', 'gold', 'valeur estimee des RDV');
  } catch (e) { box.innerHTML = ''; }
}

/* ── deroulement du scan ───────────────────────────────── */
function setProg(html) { var p = el('dec-prog'); if (p) p.innerHTML = html; }

async function drainQueue(queue, worker, onProg) {
  return new Promise(function (resolve) {
    var active = 0, done = 0;
    function pump() {
      if (stopFlag) { if (active === 0) resolve({ done: done }); return; }
      while (active < K_SCAN && queue.length) {
        var cell = queue.shift(); active++;
        worker(cell).then(function (subs) { if (subs && subs.length) for (var i = 0; i < subs.length; i++) queue.push(subs[i]); })
          .catch(function () {})
          .then(function () { active--; done++; onProg(done, queue.length); if (!queue.length && active === 0) resolve({ done: done }); else pump(); });
      }
      if (!queue.length && active === 0) resolve({ done: done });
    }
    pump();
  });
}

async function existants() {
  var sel = await sb().from('web_prospection_cibles').select('entreprise,zone,place_id');
  var rows;
  if (sel.error) { var s2 = await sb().from('web_prospection_cibles').select('entreprise,zone'); rows = s2.data || []; }
  else rows = sel.data || [];
  var byPlace = {}, byName = {};
  rows.forEach(function (r) { if (r.place_id) byPlace[r.place_id] = 1; byName[norm(r.entreprise) + '|' + norm(r.zone)] = 1; });
  return { byPlace: byPlace, byName: byName };
}

async function insertCibles(rows) {
  var map = { byPlace: {}, byNom: {} };
  if (!rows.length) return { added: 0, map: map };
  function index(data) { (data || []).forEach(function (r) { if (r.place_id) map.byPlace[r.place_id] = r.id; map.byNom[norm(r.entreprise) + '|' + norm(r.zone)] = r.id; }); }
  var r = await sb().from('web_prospection_cibles').insert(rows).select('id,place_id,entreprise,zone');
  if (!r.error) { index(r.data); return { added: (r.data || rows).length, map: map }; }
  // Colonne manquante : on retombe PAR ETAPES en gardant les marqueurs d'origine (place_id, source)
  // le plus longtemps possible, pour ne jamais transformer un resto IA en resto "manuel".
  function socle(x) { return { entreprise: x.entreprise, telephone: x.telephone, zone: x.zone, qualite_site: x.qualite_site, statut: 'a_appeler', lien_maps: x.lien_maps, notes: x.notes, owner: x.owner }; }
  var essais = [
    function (x) { var o = socle(x); o.place_id = x.place_id; o.source = x.source; return o; },
    function (x) { var o = socle(x); o.place_id = x.place_id; return o; },
    socle
  ];
  for (var e = 0; e < essais.length; e++) {
    var payloadE = rows.map(essais[e]);
    var re = await sb().from('web_prospection_cibles').insert(payloadE).select('id,place_id,entreprise,zone');
    if (!re.error) { index(re.data); return { added: (re.data || payloadE).length, map: map }; }
  }
  // dernier recours : ligne par ligne (socle nu), on saute les doublons
  var min = rows.map(socle);
  var ok = 0;
  for (var i = 0; i < min.length; i++) { var rr = await sb().from('web_prospection_cibles').insert(min[i]).select('id,entreprise,zone'); if (!rr.error) { ok++; index(rr.data); } }
  return { added: ok, map: map };
}

async function _go() {
  if (running) return;
  running = true; stopFlag = false;
  el('dec-go').style.display = 'none'; el('dec-stop').style.display = '';
  el('dec-res').innerHTML = '<div class="empty">Scan en cours...</div>';

  try {
    var zoneName = el('dec-zone').value;
    var types = PRESETS[el('dec-cible').value] || PRESETS.resto;
    var boxes = ZONES[zoneName].boxes;
    var firstErr = null;

    // 1) file de cases
    var queue = [];
    boxes.forEach(function (b) { grid(b, INITIAL_STEP).forEach(function (c) { queue.push(c); }); });
    var found = {};
    var initTotal = queue.length;

    setProg('Preparation : ' + initTotal + ' cases...');
    await drainQueue(queue, async function (cell) {
      var d;
      try { d = await apiScan(cell, types); }
      catch (e) { if (!firstErr) firstErr = e; return []; }
      (d.places || []).forEach(function (p) { if (!found[p.place_id]) found[p.place_id] = p; });
      var subs = [];
      if (d.saturated && (cell.n - cell.s) / 2 >= MIN_STEP) {
        var mLat = (cell.s + cell.n) / 2, mLng = (cell.w + cell.e) / 2;
        subs = [
          { s: cell.s, n: mLat, w: cell.w, e: mLng }, { s: cell.s, n: mLat, w: mLng, e: cell.e },
          { s: mLat, n: cell.n, w: cell.w, e: mLng }, { s: mLat, n: cell.n, w: mLng, e: cell.e }
        ];
      }
      return subs;
    }, function (done, reste) {
      setProg('Ratissage : ' + done + ' cases faites, ' + reste + ' en attente<br>' + Object.keys(found).length + ' etablissements reperes');
    });

    if (stopFlag) { finir(); toast('Scan arrete'); return; }

    // rien trouve : on explique au lieu d'afficher un vide muet
    var ids = Object.keys(found);
    if (!ids.length) {
      if (firstErr) throw firstErr; // remonte la vraie cause (souvent la cle Google)
      el('dec-res').innerHTML = '<div class="empty">Le scan n\'a remonte aucun etablissement sur cette zone.<br><br>' +
        'Essaie une zone plus large (ex. <b>Le Gosier</b> ou <b>Grande-Terre</b>). Si ca reste vide partout, c\'est la cle Google : verifie que <b>GOOGLE_MAPS_API_KEY</b> est bien sur le projet Vercel, que <b>Places API</b> est activee et la <b>facturation active</b>, puis <b>relance un deploiement</b>.</div>';
      setProg('');
      return;
    }

    // 2) details (site + tel) par lots
    var detailsMap = {};
    for (var i = 0; i < ids.length; i += LOT_DETAILS) {
      if (stopFlag) break;
      var lot = ids.slice(i, i + LOT_DETAILS);
      var dd = await apiDetails(lot);
      Object.keys(dd).forEach(function (k) { detailsMap[k] = dd[k]; });
      setProg('Verification des sites : ' + Math.min(i + LOT_DETAILS, ids.length) + '/' + ids.length);
    }

    // 3) tri sans-site / avec-site + dedup
    var ex = await existants();
    var sansSite = [], nbAvec = 0, nbDeja = 0;
    ids.forEach(function (id) {
      var p = found[id], d = detailsMap[id] || {};
      if (d.business_status && d.business_status !== 'OPERATIONAL') return;
      var s = analyseSite(d.website);
      if (s.real) { nbAvec++; return; }
      var commune = communeProche(p.lat, p.lng);
      if (ex.byPlace[id] || ex.byName[norm(p.name) + '|' + norm(commune)]) { nbDeja++; return; }
      sansSite.push({
        id: id, nom: p.name, commune: commune, tel: d.phone || '', kind: s.kind, social: s.kind === 'facebook' ? s.social : '',
        rating: p.rating, reviews: p.reviews, url: d.url || ('https://www.google.com/maps/place/?q=place_id:' + id),
        heat: heat(p.rating, p.reviews)
      });
    });
    sansSite.sort(function (a, b) { return b.heat - a.heat; });

    // 4) enregistrement dans la file d'appels
    var payload = sansSite.map(function (x) {
      return {
        entreprise: x.nom, telephone: x.tel || null, zone: x.commune, qualite_site: x.kind,
        statut: 'a_appeler', lien_maps: x.url, site_actuel: x.social || null, secteur: 'Restaurant',
        notes: (x.rating ? x.rating + '\u2605 ' : '') + (x.reviews ? x.reviews + ' avis ' : '') + '\u00b7 repere auto',
        enrichissement: { place_id: x.id, rating: x.rating, reviews: x.reviews, source: 'decouverte' },
        enrichi_le: new Date().toISOString(), place_id: x.id, owner: meId, source: 'decouverte'
      };
    });
    var ins = await insertCibles(payload);
    SENT = {};

    if (window.loadAll) { try { await window.loadAll(); } catch (e) {} }
    loadStats();
    afficherResultats(sansSite, { added: ins.added, avec: nbAvec, deja: nbDeja, brut: ids.length }, ins.map);
    setProg('');
    toast(ins.added + ' cible(s) ajoutee(s) a la file d\'appels');
  } catch (err) {
    setProg('');
    el('dec-res').innerHTML = '<div class="empty" style="color:var(--red)">Erreur : ' + esc(err.message) + '</div>';
    toast(err.message, true);
  } finally {
    finir();
  }
}

function finir() { running = false; stopFlag = false; if (el('dec-go')) el('dec-go').style.display = ''; if (el('dec-stop')) el('dec-stop').style.display = 'none'; }
function _stop() { stopFlag = true; toast('Arret en cours...'); }

function marquerCarteEnvoyee(placeId, cibleId) {
  SENT[placeId] = 1;
  var card = document.getElementById('dc-' + placeId);
  if (card) {
    card.classList.add('done');
    var act = card.querySelector('.dec-act');
    if (act) act.innerHTML = '<span class="chip green">Envoye \u00b7 relance dans 3 j</span> <button class="btn ghost sm" type="button" onclick="Decouverte._undo(\'' + cibleId + '\',\'' + placeId + '\')">Annuler</button>';
  }
}
async function _sent(cibleId, placeId) {
  // On enregistre D'ABORD, on ne marque "envoye" QUE si la base a bien accepte.
  if (!cibleId) { toast('WhatsApp ouvert, mais fiche non reliee au CRM : non enregistre', true); return; }
  try {
    var a = await sb().from('web_prospection_actions').insert({ cible_id: cibleId, type: 'whatsapp', resultat: 'contacte', user_id: meId });
    var u = await sb().from('web_prospection_cibles').update({ statut: 'mail_envoye', rappel_le: plusJours(3), updated_at: new Date().toISOString() }).eq('id', cibleId);
    if ((a && a.error) || (u && u.error)) throw new Error((a && a.error && a.error.message) || (u && u.error && u.error.message) || 'erreur');
    marquerCarteEnvoyee(placeId, cibleId);
    try { await sb().from('web_prospection_cibles').update({ canal: 'whatsapp' }).eq('id', cibleId); } catch (e2) {} // tag canal (best-effort, sans effet si colonne absente)
    if (window.loadAll) { try { await window.loadAll(); } catch (e) {} }
    loadStats();
  } catch (e) {
    toast('Pas enregistre, retape le bouton WhatsApp : ' + (e.message || 'reseau'), true);
  }
}
async function _undo(cibleId, placeId) {
  if (cibleId) {
    try {
      var u = await sb().from('web_prospection_cibles').update({ statut: 'a_appeler', rappel_le: null, updated_at: new Date().toISOString() }).eq('id', cibleId);
      if (u && u.error) throw new Error(u.error.message);
    } catch (e) { toast('Annulation non enregistree : ' + (e.message || 'reseau'), true); return; }
  }
  delete SENT[placeId];
  if (window.loadAll) { try { await window.loadAll(); } catch (e) {} }
  loadStats();
  if (LAST) afficherResultats(LAST.list, LAST.info, LAST.map);
}
async function _backup() {
  toast('Sauvegarde en cours...');
  try {
    var tables = ['web_prospection_cibles', 'web_prospection_actions', 'web_clients', 'web_evenements', 'web_devis', 'web_hebergements', 'web_liens', 'web_factures', 'web_societe'];
    var dump = { _app: 'novalem', _date: new Date().toISOString() };
    for (var i = 0; i < tables.length; i++) { var r = await sb().from(tables[i]).select('*'); dump[tables[i]] = r.error ? { _erreur: r.error.message } : (r.data || []); }
    var n = (dump.web_prospection_cibles && dump.web_prospection_cibles.length) || 0;
    var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'novalem-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    toast('Sauvegarde telechargee (' + n + ' cibles + tout le reste)');
  } catch (e) { toast('Sauvegarde impossible : ' + (e.message || 'erreur'), true); }
}

function afficherResultats(list, info, map) {
  map = map || { byPlace: {}, byNom: {} };
  LAST = { list: list, info: info, map: map };
  var res = el('dec-res');
  if (!list.length) {
    res.innerHTML = '<div class="empty">Aucun resto sans site trouve ici. ' + (info.avec ? info.avec + ' avaient deja un site, ' : '') + (info.deja ? info.deja + ' etaient deja en base.' : '') + '</div>';
    return;
  }
  var chaudSeuil = list.length > 6 ? list[Math.floor(list.length * 0.25)].heat : -1;
  var head = '<div style="font-size:13px;color:var(--mut);margin-bottom:12px"><b>' + info.added + '</b> ajoutes a la file \u00b7 ' + info.avec + ' avaient un site \u00b7 ' + info.deja + ' deja en base \u00b7 ' + info.brut + ' scannes' +
    ' &nbsp;<button class="btn gold sm" type="button" onclick="Decouverte._session()">Session d\'appel</button></div>';
  var cards = list.map(function (x) {
    var cibleId = map.byPlace[x.id] || map.byNom[norm(x.nom) + '|' + norm(x.commune)] || '';
    var wa = waLink(x.tel, x.nom);
    var chaud = (x.heat >= chaudSeuil && chaudSeuil > 0) ? '<span class="chip red">chaud</span>' : '';
    var fb = x.kind === 'facebook' ? '<span class="chip gray">Facebook</span>' : '';
    var sub = esc(x.commune) + (x.rating ? ' \u00b7 ' + esc(x.rating) + '\u2605' : '') + (x.reviews ? ' (' + x.reviews + ')' : '') + (x.tel ? ' \u00b7 ' + esc(x.tel) : ' \u00b7 pas de tel');
    var acts;
    if (SENT[x.id]) {
      acts = '<span class="chip green">Envoye \u00b7 relance dans 3 j</span> <button class="btn ghost sm" type="button" onclick="Decouverte._undo(\'' + cibleId + '\',\'' + esc(x.id) + '\')">Annuler</button>';
    } else {
      acts = (wa ? '<a class="btn wa" target="_blank" href="' + wa + '" onclick="Decouverte._sent(\'' + cibleId + '\',\'' + esc(x.id) + '\')">WhatsApp</a>' : '') +
        (x.tel ? '<a class="btn ghost sm" href="tel:' + esc(x.tel.replace(/ /g, '')) + '">Appeler</a>' : '') +
        '<a class="btn ghost sm" target="_blank" href="' + esc(x.url) + '">Maps</a>';
    }
    return '<div class="dec-card' + (SENT[x.id] ? ' done' : '') + '" id="dc-' + esc(x.id) + '">' +
      '<div class="dec-main"><div class="dec-nom">' + esc(x.nom) + chaud + fb + '</div><div class="dec-sub">' + sub + '</div></div>' +
      '<div class="dec-act">' + acts + '</div></div>';
  }).join('');
  res.innerHTML = head + '<div class="dec-list">' + cards + '</div>';
}

function _openMsg() {
  var cur = window.novaMsgTemplate ? window.novaMsgTemplate() : MSG('{NOM}');
  var html =
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:8px">Ce message part sur WhatsApp quand tu cliques le bouton vert. Ecris <b>{NOM}</b> la ou tu veux le nom du resto : il sera remplace automatiquement. Il s\'applique aux cartes ici et a la session d\'appel, sur tous tes appareils.</div>' +
    '<textarea id="msg-edit" style="min-height:150px">' + esc(cur) + '</textarea>' +
    '<div style="font-size:12px;color:var(--mut);margin-top:8px;background:var(--bg2);border-radius:8px;padding:8px 10px">Apercu : <span id="msg-preview"></span></div>' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
    '  <button class="btn ghost" type="button" onclick="Decouverte._closeMsg()">Annuler</button>' +
    '  <button class="btn gold" type="button" onclick="Decouverte._saveMsg()">Enregistrer</button>' +
    '</div>';
  el('mo-t').textContent = 'Modifier le message WhatsApp';
  el('mo-b').innerHTML = html;
  el('mo').classList.add('on');
  var ta = el('msg-edit'), pv = el('msg-preview');
  function upd() { pv.textContent = ta.value.replace(/\{NOM\}/g, 'Chez Margaux'); }
  ta.addEventListener('input', upd); upd();
}
function _closeMsg() { el('mo').classList.remove('on'); }
async function _saveMsg() {
  var val = (el('msg-edit') ? el('msg-edit').value : '').trim();
  if (!val) { toast('Le message est vide', true); return; }
  try {
    var so = await sb().from('web_societe').select('id').limit(1);
    if (so.error) throw new Error(so.error.message);
    var r;
    if (so.data && so.data[0]) r = await sb().from('web_societe').update({ message_whatsapp: val }).eq('id', so.data[0].id);
    else r = await sb().from('web_societe').insert({ message_whatsapp: val });
    if (r.error) throw new Error(r.error.message);
    el('mo').classList.remove('on');
    if (window.loadAll) { try { await window.loadAll(); } catch (e) {} } // rafraichit le cache -> les liens utilisent le nouveau texte
    if (LAST) afficherResultats(LAST.list, LAST.info, LAST.map);
    toast('Message enregistre');
  } catch (e) {
    toast('Pas enregistre : execute supabase/phase12.sql (' + (e.message || '') + ')', true);
  }
}

/* ── PHASE 2 : mode "Prospection WhatsApp" sur toute la file a contacter ── */
var CAMP = { origine: 'tous', zone: 'toutes', list: [], sent: {} };

function origineDe(c) {
  if (!c) return 'manuel';
  if (c.source === 'decouverte') return 'ia';
  if (c.place_id) return 'ia';
  if (c.enrichissement && c.enrichissement.source === 'decouverte') return 'ia';
  return 'manuel';
}
function heatDe(c) { var e = c.enrichissement || {}; return heat(e.rating, e.reviews); }

function renderCampagne() {
  ensureMe();
  CAMP.sent = {};
  el('content').innerHTML =
    '<div class="card"><h2>Prospection WhatsApp</h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:12px">Toute ta file « a contacter » en cartes. Clique WhatsApp : le message part et le contact passe en relance dans 3 jours. Filtre par origine et par zone. Rythme humain pour ne pas te faire bloquer le numero.</div>' +
    '<div id="camp-bar" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px"></div>' +
    '<div id="camp-list"><div class="empty">Chargement...</div></div></div>';
  chargerCampagne();
}

async function chargerCampagne() {
  var r = await sb().from('web_prospection_cibles').select('*').eq('statut', 'a_appeler');
  CAMP.list = (r && r.data) ? r.data : [];
  majBarreCampagne();
  dessinerCampagne();
}

function majBarreCampagne() {
  var bar = el('camp-bar'); if (!bar) return;
  var zones = [];
  CAMP.list.forEach(function (c) { if (c.zone && zones.indexOf(c.zone) < 0) zones.push(c.zone); });
  zones.sort();
  function chip(g, val, label, actif) { return '<button type="button" class="chip ' + (actif ? 'gold' : 'gray') + '" style="border:none;cursor:pointer;font:inherit;font-weight:600" onclick="Decouverte._campFiltre(\'' + g + '\',\'' + val + '\')">' + label + '</button>'; }
  bar.innerHTML =
    '<span style="font-size:12px;color:var(--mut)">Origine</span>' +
    chip('origine', 'tous', 'Tous', CAMP.origine === 'tous') +
    chip('origine', 'ia', 'IA', CAMP.origine === 'ia') +
    chip('origine', 'manuel', 'Manuel', CAMP.origine === 'manuel') +
    '<span style="font-size:12px;color:var(--mut);margin-left:10px">Zone</span>' +
    '<select onchange="Decouverte._campZone(this.value)" style="padding:6px 10px;border:1px solid var(--line);border-radius:8px"><option value="toutes">Toutes</option>' +
    zones.map(function (z) { return '<option value="' + esc(z) + '"' + (CAMP.zone === z ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select>';
}

function dessinerCampagne() {
  var box = el('camp-list'); if (!box) return;
  var list = CAMP.list.filter(function (c) {
    if (CAMP.origine !== 'tous' && origineDe(c) !== CAMP.origine) return false;
    if (CAMP.zone !== 'toutes' && c.zone !== CAMP.zone) return false;
    return true;
  }).sort(function (a, b) { return heatDe(b) - heatDe(a); });
  if (!list.length) { box.innerHTML = '<div class="empty">Rien a contacter avec ce filtre. Lance un scan dans Decouverte, ou change le filtre.</div>'; return; }
  var head = '<div style="font-size:13px;color:var(--mut);margin-bottom:10px"><b>' + list.length + '</b> a contacter</div>';
  var cards = list.map(function (c) {
    var e = c.enrichissement || {};
    var wa = waLink(c.telephone, c.entreprise);
    var fb = c.qualite_site === 'facebook' ? ' <span class="chip gray">Facebook</span>' : '';
    var org = origineDe(c) === 'ia' ? ' <span class="chip blue">IA</span>' : ' <span class="chip gray">Manuel</span>';
    var sub = esc(c.zone || '') + (e.rating ? ' \u00b7 ' + esc(e.rating) + '\u2605' : '') + (e.reviews ? ' (' + e.reviews + ')' : '') + (c.telephone ? ' \u00b7 ' + esc(c.telephone) : ' \u00b7 pas de tel');
    var acts;
    if (CAMP.sent[c.id]) acts = '<span class="chip green">Envoye \u00b7 relance dans 3 j</span> <button class="btn ghost sm" type="button" onclick="Decouverte._campUndo(\'' + c.id + '\')">Annuler</button>';
    else acts = (wa ? '<a class="btn wa" target="_blank" href="' + wa + '" onclick="Decouverte._campSent(\'' + c.id + '\')">WhatsApp</a>' : '') +
      (c.telephone ? '<a class="btn ghost sm" href="tel:' + esc(String(c.telephone).replace(/ /g, '')) + '">Appeler</a>' : '') +
      (c.lien_maps ? '<a class="btn ghost sm" target="_blank" href="' + esc(c.lien_maps) + '">Maps</a>' : '');
    return '<div class="dec-card' + (CAMP.sent[c.id] ? ' done' : '') + '" id="camp-' + esc(c.id) + '"><div class="dec-main"><div class="dec-nom">' + esc(c.entreprise) + org + fb + '</div><div class="dec-sub">' + sub + '</div></div><div class="dec-act">' + acts + '</div></div>';
  }).join('');
  box.innerHTML = head + '<div class="dec-list">' + cards + '</div>';
}

async function _campSent(cibleId) {
  try {
    var a = await sb().from('web_prospection_actions').insert({ cible_id: cibleId, type: 'whatsapp', resultat: 'contacte', user_id: meId });
    var u = await sb().from('web_prospection_cibles').update({ statut: 'mail_envoye', rappel_le: plusJours(3), updated_at: new Date().toISOString() }).eq('id', cibleId);
    if ((a && a.error) || (u && u.error)) throw new Error((a && a.error && a.error.message) || (u && u.error && u.error.message) || 'erreur');
    CAMP.sent[cibleId] = 1;
    var card = el('camp-' + cibleId);
    if (card) { card.classList.add('done'); var act = card.querySelector('.dec-act'); if (act) act.innerHTML = '<span class="chip green">Envoye \u00b7 relance dans 3 j</span> <button class="btn ghost sm" type="button" onclick="Decouverte._campUndo(\'' + cibleId + '\')">Annuler</button>'; }
    try { await sb().from('web_prospection_cibles').update({ canal: 'whatsapp' }).eq('id', cibleId); } catch (e2) {}
    if (window.loadAll) { try { await window.loadAll(); } catch (e) {} }
  } catch (e) { toast('Pas enregistre, retape WhatsApp : ' + (e.message || 'reseau'), true); }
}
async function _campUndo(cibleId) {
  try {
    var u = await sb().from('web_prospection_cibles').update({ statut: 'a_appeler', rappel_le: null, updated_at: new Date().toISOString() }).eq('id', cibleId);
    if (u && u.error) throw new Error(u.error.message);
  } catch (e) { toast('Annulation non enregistree : ' + (e.message || 'reseau'), true); return; }
  delete CAMP.sent[cibleId];
  if (window.loadAll) { try { await window.loadAll(); } catch (e) {} }
  dessinerCampagne();
}
function _campFiltre(g, val) { if (g === 'origine') CAMP.origine = val; majBarreCampagne(); dessinerCampagne(); }
function _campZone(val) { CAMP.zone = val; dessinerCampagne(); }

window.Decouverte = { render: render, _go: _go, _stop: _stop, _session: function () { if (window.go) window.go('session'); }, _sent: _sent, _undo: _undo, _backup: _backup, _stats: loadStats, _openMsg: _openMsg, _closeMsg: _closeMsg, _saveMsg: _saveMsg, renderCampagne: renderCampagne, _campSent: _campSent, _campUndo: _campUndo, _campFiltre: _campFiltre, _campZone: _campZone };
})();
