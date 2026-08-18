/* ═══════════════════════════════════════════════════════════════
   NOVALEM APP — js/app.js
   Phase 1 (socle) + Phase 2 (pole Commercial)
   Tables reutilisees telles quelles : users, web_prospection_cibles,
   web_prospection_actions, web_clients, web_evenements, web_projets,
   web_devis, web_liens.
═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var SB_URL  = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';
var PRIX_SITE = 490; // base CA potentiel : 1 site = 490 EUR HT (formule Essentiel)
var FICHE_URL = '/docs/novalem-presentation.pdf';

var _sb = null;
function sb() { if (!_sb) _sb = window.supabase.createClient(SB_URL, SB_ANON); return _sb; }

var ME = null;            // ligne users
var ROLE = 'scout';       // superviseur | scout
var DB = { cibles: [], actions: [], clients: [], evenements: [], projets: [], devis: [] };
var VIEW = 'accueil';
var agenda = null;

/* ── utilitaires ─────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m, warn) {
  var t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = m;
  el('toaster').appendChild(t);
  setTimeout(function () { t.remove(); }, 3200);
}
var TZ_GDLP = 'America/Guadeloupe';
function nowGdlp() { // maintenant, en heure Guadeloupe, sous forme de date naive
  var p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_GDLP, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
  return { date: o.year + '-' + o.month + '-' + o.day, heure: o.hour + ':' + o.minute };
}
function todayISO() { return nowGdlp().date; }
function naive(x) { // retire l'offset renvoye par Supabase : l'heure stockee est l'heure murale Guadeloupe
  return (x || '').replace(/(\+00:00|Z)$/, '').replace(/(\+\d{2}:\d{2})$/, '');
}
function dbFail(res, quoi) { // vrai si Supabase a refuse l'ecriture : on affiche la vraie erreur au lieu de faire semblant
  if (res && res.error) {
    console.error(quoi, res.error);
    toast(quoi + ' : ' + (res.error.message || 'erreur inconnue'), true);
    return true;
  }
  return false;
}
function addDays(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
function eur(n) { return (Math.round(n)).toLocaleString('fr-FR') + ' \u20AC'; }

// Message WhatsApp partage ({NOM} = nom de l'entreprise). Modifiable dans
// l'app (page Decouverte, bouton "Modifier le message"), stocke en base
// (web_societe.message_whatsapp) donc il te suit sur tous tes appareils.
var MSG_DEFAUT = "Bonjour {NOM}, je suis Louis du studio web Novalem en Guadeloupe. J'ai vu que vous n'avez pas encore de site internet. Je cree des sites simples et pros pour les restaurants d'ici : menu en QR code, page de presentation, a partir de 250 EUR. Un exemple : https://ifc-guadeloupe.fr Est-ce que ca vous interesserait d'en discuter ?";
window.NOVA_MSG_DEFAUT = MSG_DEFAUT;
window.novaMsgTemplate = function () { return (DB.societe && DB.societe.message_whatsapp) ? DB.societe.message_whatsapp : MSG_DEFAUT; };
window.novaWaLink = function (tel, nom) {
  if (!tel) return '';
  var d = String(tel).replace(/[^0-9]/g, ''); if (!d) return '';
  var txt = window.novaMsgTemplate().replace(/\{NOM\}/g, nom || '');
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(txt);
};
function waSession(c) { return (c && c.telephone && window.novaWaLink) ? window.novaWaLink(c.telephone, c.entreprise) : ''; }

// Valeur (CA) d'une opportunite : un devis chiffre l'emporte, sinon la valeur
// estimee choisie au RDV, sinon la formule Essentiel par defaut (retro-compat).
function caClient(c) {
  var d = DB.devis.filter(function (x) { return x.client_id === c.id; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; })[0];
  if (d) return Number(d.total_ht || 0);
  if (c && c.valeur_estimee != null && c.valeur_estimee !== '') return Number(c.valeur_estimee) || 0;
  return PRIX_SITE;
}
function montantEvt(e) { return (e && e.montant != null && e.montant !== '') ? (Number(e.montant) || 0) : PRIX_SITE; }

// Selecteur d'offre / valeur reutilise (RDV session, agenda). p = prefixe des ids.
function selectOffre(p, val) {
  var opts = [['490', 'Site Essentiel \u2014 490 EUR'], ['990', 'Site Vitrine \u2014 990 EUR'], ['1390', 'Site Signature \u2014 1390 EUR'], ['250', 'Menu / QR code \u2014 250 EUR'], ['autre', 'Autre montant\u2026'], ['0', 'Sans montant (RDV simple)']];
  var known = ['490', '990', '1390', '250', '0'];
  var cur = (val == null || val === '') ? '490' : String(Number(val));
  var isAutre = known.indexOf(cur) < 0;
  var sel = '<select id="' + p + '-offre" onchange="offreChange(\'' + p + '\')">' +
    opts.map(function (o) {
      var s = (o[0] === 'autre') ? (isAutre ? ' selected' : '') : (o[0] === cur ? ' selected' : '');
      return '<option value="' + o[0] + '"' + s + '>' + o[1] + '</option>';
    }).join('') + '</select>' +
    '<input type="number" id="' + p + '-offre-autre" placeholder="Montant en EUR" value="' + (isAutre ? esc(cur) : '') + '" style="' + (isAutre ? '' : 'display:none;') + 'margin-top:8px">';
  return sel;
}
window.offreChange = function (p) { var s = el(p + '-offre'), i = el(p + '-offre-autre'); if (s && i) i.style.display = (s.value === 'autre') ? '' : 'none'; };
function valeurOffre(p) { var s = el(p + '-offre'); if (!s) return null; if (s.value === 'autre') { var v = parseFloat(el(p + '-offre-autre').value); return isNaN(v) ? 0 : v; } return Number(s.value); }
function openMo(titre, html) { el('mo-t').textContent = titre; el('mo-b').innerHTML = html; el('mo').classList.add('on'); }
function closeMo() { el('mo').classList.remove('on'); }

// Rafraichit les DONNEES et re-affiche seulement la vue courante.
// Ne recharge PAS la page et ne redemande PAS la connexion.
var _lastRefresh = 0;
async function refreshApp(force) {
  if (el('mo') && el('mo').classList.contains('on')) return;   // ne pas casser une saisie en cours
  var now = Date.now();
  if (!force && now - _lastRefresh < 4000) return;             // anti-rebond (focus + visibilite)
  _lastRefresh = now;
  var rb = document.querySelector('.tb-refresh'); if (rb) rb.classList.add('spin');
  try { await loadAll(); } catch (e) { if (rb) rb.classList.remove('spin'); return; }
  if (VIEW === 'decouverte' && window.Decouverte && window.Decouverte._stats) window.Decouverte._stats();
  else go(VIEW);                                               // re-rend juste la page interne
  if (rb) rb.classList.remove('spin');
  if (force) toast('A jour');
}

/* ── auth + demarrage ────────────────────────────────── */
async function boot() {
  var s = await sb().auth.getSession();
  if (!s.data || !s.data.session) { window.location = '/'; return; }
  var email = (s.data.session.user || {}).email;
  var u = await sb().from('users').select('*').eq('email', email).maybeSingle();
  ME = u.data || { email: email, prenom: email.split('.')[0], nom: '', role: 'scout' };
  ROLE = ME.role === 'superviseur' ? 'superviseur' : 'scout';
  el('nv-uname').textContent = ME.prenom || email;
  el('nv-avatar').textContent = ((ME.prenom || 'N')[0] + (ME.nom || ' ')[0]).toUpperCase();
  buildNav();
  el('quick-tache').addEventListener('keydown', function (e) { if (e.key === 'Enter') quickTache(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshApp(false); });
  window.addEventListener('focus', function () { refreshApp(false); });
  await loadAll();
  go(ROLE === 'superviseur' ? 'accueil' : 'session');
}

async function logout() { await sb().auth.signOut(); window.location = '/'; }

async function loadAll() {
  var q = await Promise.all([
    sb().from('web_prospection_cibles').select('*').order('updated_at', { ascending: true }),
    sb().from('web_clients').select('*').order('updated_at', { ascending: false }),
    sb().from('web_evenements').select('*').order('date_debut', { ascending: true }),
    sb().from('web_projets').select('*'),
    sb().from('web_devis').select('*')
  ]);
  DB.cibles = q[0].data || [];
  DB.clients = q[1].data || [];
  DB.evenements = (q[2].data || []).map(function (e) {
    e.date_debut = naive(e.date_debut);
    if (e.date_fin) e.date_fin = naive(e.date_fin);
    return e;
  });
  DB.projets = q[3].data || [];
  DB.devis = q[4].data || [];
  var aj = await sb().from('web_prospection_actions').select('*').gte('created_at', todayISO() + 'T00:00:00');
  DB.actionsJour = aj.data || [];
  var hb = await sb().from('web_hebergements').select('*');
  DB.hebergements = hb.data || [];
  var aa = await sb().from('web_prospection_actions').select('resultat,type,created_at');
  DB.actionsAll = aa.data || [];
  if (ROLE === 'superviseur') {
    var ch = await sb().from('web_charges').select('*').order('created_at');
    DB.charges = ch.error ? [] : (ch.data || []);
  } else { DB.charges = []; }
  var so = await sb().from('web_societe').select('*').limit(1);
  DB.societe = (!so.error && so.data && so.data[0]) || null;
  var fa = await sb().from('web_factures').select('*').order('created_at', { ascending: false });
  DB.factures = fa.error ? [] : (fa.data || []);
  if (ROLE === 'superviseur') {
    var da = await sb().from('demandes_acces').select('*').order('created_at', { ascending: false });
    DB.demandes = da.data || [];
  } else { DB.demandes = []; }
  refreshBadges();
}

/* ── navigation ──────────────────────────────────────── */
var NAV = [
  { sec: 'Pilotage', su: true },
  { id: 'accueil', lbl: 'Tableau de bord', su: true },
  { sec: 'Commercial' },
  { id: 'decouverte', lbl: 'Decouverte', su: true },
  { id: 'session', lbl: 'Session d\'appel', badge: 'b-sess' },
  { id: 'reperage', lbl: 'Reperage' },
  { id: 'morts', lbl: 'Pas interesses' },
  { sec: 'Organisation' },
  { id: 'agenda', lbl: 'Agenda' },
  { id: 'acces', lbl: 'Demandes d\'acces', su: true, badge: 'b-acc' },
  { sec: 'Production', su: true },
  { id: 'production', lbl: 'Sites a produire', su: true },
  { sec: 'Clients', su: true },
  { id: 'pipeline', lbl: 'Pipeline', su: true },
  { id: 'clients', lbl: 'Fichier clients', su: true },
  { id: 'factures', lbl: 'Factures', su: true },
  { id: 'societe', lbl: 'Ma societe', su: true }
];
function buildNav() {
  var h = '';
  NAV.forEach(function (n) {
    if (n.su && ROLE !== 'superviseur') return;
    if (n.sec) { h += '<div class="nv-sec">' + n.sec + '</div>'; return; }
    h += '<div class="ni" data-v="' + n.id + '" onclick="go(\'' + n.id + '\')">' + n.lbl +
      (n.badge ? '<span class="badge gray" id="' + n.badge + '">0</span>' : '') + '</div>';
  });
  el('nv-items').innerHTML = h;
}
function go(v) {
  VIEW = v;
  document.querySelectorAll('.ni').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-v') === v); });
  var titles = { accueil: 'Tableau de bord', decouverte: 'Decouverte', session: 'Session d\'appel', reperage: 'Reperage', morts: 'Pas interesses', agenda: 'Agenda', production: 'Sites a produire', pipeline: 'Pipeline', clients: 'Fichier clients', factures: 'Factures', societe: 'Ma societe', acces: 'Demandes d\'acces' };
  el('tb-title').textContent = titles[v] || v;
  var r = { accueil: rAccueil, decouverte: function () { if (window.Decouverte) window.Decouverte.render(); }, session: rSession, reperage: rReperage, morts: rMorts, agenda: rAgenda, production: rProduction, pipeline: rPipeline, clients: rClients, factures: rFactures, societe: rSociete, acces: rAcces }[v];
  if (r) r();
  var cc = el('content'); if (cc) { cc.classList.remove('vfade'); void cc.offsetWidth; cc.classList.add('vfade'); }
}

/* ── logique commerciale partagee ────────────────────── */
function isRelance(c) { // mail envoye, retour attendu aujourd'hui ou avant
  return c.statut === 'mail_envoye' && c.rappel_le && c.rappel_le <= todayISO();
}
function isRappel(c) { // a rappeler sans mail pris (echec de process mais ca arrive)
  return c.statut === 'rappeler' && (!c.rappel_le || c.rappel_le <= todayISO());
}
function fileAppels() {
  // priorite : relances du jour, puis rappels du jour, puis la file a_appeler (plus ancien contact en premier)
  var rel = DB.cibles.filter(isRelance);
  var rap = DB.cibles.filter(isRappel);
  var neuf = DB.cibles.filter(function (c) { return c.statut === 'a_appeler'; });
  return rel.concat(rap, neuf);
}
function refreshBadges() {
  var rel = DB.cibles.filter(isRelance).length + DB.cibles.filter(isRappel).length;
  var file = fileAppels().length;
  if (el('b-sess')) {
    el('b-sess').textContent = rel || file;
    el('b-sess').className = 'badge' + (rel ? '' : ' gray');
  }
  var att = (DB.demandes || []).filter(function (d) { return d.statut === 'en_attente'; }).length;
  if (el('b-acc')) { el('b-acc').textContent = att; el('b-acc').className = 'badge' + (att ? '' : ' gray'); }
}

/* cloture les rappels agenda en attente d'une cible : appele des qu'une issue est traitee */
async function cloreRappels(cibleId) {
  try {
    await sb().from('web_evenements').update({ statut: 'fait', updated_at: new Date().toISOString() })
      .eq('cible_id', cibleId).eq('type', 'rappel').eq('statut', 'a_venir');
  } catch (e) { /* colonne absente : executer supabase/phase7.sql */ }
}
async function logAction(cibleId, type, resultat, details) {
  await sb().from('web_prospection_actions').insert({ cible_id: cibleId, type: type, resultat: resultat || null, details: details || null, user_id: ME.id || null });
}

/* ═════════ SESSION D'APPEL ═════════ */
var CUR = null;
var FORCE_ID = null;

function statsJour() {
  var mine = (DB.actionsJour || []).filter(function (a) { return !ME.id || a.user_id === ME.id; });
  return {
    appels: mine.length,
    rdv: mine.filter(function (a) { return a.resultat === 'rdv_pris'; }).length,
    fiches: mine.filter(function (a) { return a.resultat === 'mail_envoye'; }).length
  };
}

function rSession() {
  var file = fileAppels();
  refreshBadges();
  var st = statsJour();
  function parHeure(a, b) { return (a.rappel_heure || '99') < (b.rappel_heure || '99') ? -1 : 1; }
  var rel = DB.cibles.filter(isRelance).sort(parHeure);
  var rap = DB.cibles.filter(isRappel).sort(parHeure);
  var futures = DB.cibles.filter(function (c) { return (c.statut === 'mail_envoye' || c.statut === 'rappeler') && c.rappel_le && c.rappel_le > todayISO(); })
    .sort(function (a, b) { return a.rappel_le < b.rappel_le ? -1 : 1; });

  var head =
    '<div class="sess-head">' +
    ' <div class="sh-item"><div class="sh-v">' + st.appels + '</div><div class="sh-l">appels traites</div></div>' +
    ' <div class="sh-item gold"><div class="sh-v">' + st.rdv + '</div><div class="sh-l">RDV pris</div></div>' +
    ' <div class="sh-item blue"><div class="sh-v">' + st.fiches + '</div><div class="sh-l">fiches envoyees</div></div>' +
    ' <div class="sh-item"><div class="sh-v">' + file.length + '</div><div class="sh-l">dans la file</div></div>' +
    '</div>';

  if (FORCE_ID) {
    var f = DB.cibles.find(function (x) { return x.id === FORCE_ID; });
    FORCE_ID = null;
    if (f) file = [f].concat(file.filter(function (x) { return x.id !== f.id; }));
  }

  if (!file.length) {
    el('content').innerHTML = head +
      '<div class="call-card done-card">' +
      '<div class="done-big">File terminee.</div>' +
      '<div class="done-sub">' + st.appels + ' appels traites, ' + st.rdv + ' RDV pris aujourd\'hui. Passe au Reperage pour recharger la file.</div>' +
      '<button class="btn gold big" style="margin-top:18px" onclick="go(\'reperage\')">Ouvrir le Reperage</button></div>';
    return;
  }
  CUR = file[0];
  var c = CUR;
  var mono = (c.entreprise || '?').trim().slice(0, 2).toUpperCase();
  var typeChip = isRelance(c) ? '<span class="chip viol">Relance : fiche envoyee, il attend ton appel</span>'
    : isRappel(c) ? '<span class="chip red">Rappel demande' + (c.rappel_le ? ' pour le ' + fmtDate(c.rappel_le) : '') + '</span>'
      : '<span class="chip gold">Nouveau contact</span>';

  function ligneAside(x, chip) {
    return '<div class="as-row" onclick="appelDirect(\'' + x.id + '\')">' +
      '<div class="as-n">' + esc(x.entreprise) + '<div class="as-z">' + esc(x.zone || '') + (x.rappel_le ? ' \u00b7 ' + fmtDate(x.rappel_le) : '') + (x.rappel_heure ? ' ' + x.rappel_heure.slice(0,5) : '') + '</div>' + (x.rappel_note ? '<div class="as-note">' + esc(x.rappel_note) + '</div>' : '') + '</div>' + chip + '</div>';
  }
  var asideTraiter = rel.map(function (x) { return ligneAside(x, '<span class="chip viol">Relance</span>'); })
    .concat(rap.map(function (x) { return ligneAside(x, '<span class="chip red">Rappel</span>'); }))
    .join('') || '<div class="as-empty">Rien : tout est a jour</div>';
  var asideSuite = file.slice(1, 7).filter(function (x) { return !isRelance(x) && !isRappel(x); }).map(function (x) {
    return ligneAside(x, '');
  }).join('') || '<div class="as-empty">File presque vide</div>';

  el('content').innerHTML = head +
    '<div class="call-wrap">' +
    ' <div class="call-card v2">' +
    '  <div class="call-top">' +
    '   <div class="mono">' + esc(mono) + '</div>' +
    '   <div style="min-width:0">' + typeChip +
    '    <div class="call-ent">' + esc(c.entreprise) + '</div>' +
    '    <div class="call-meta">' +
    (c.contact_nom && c.contact_nom !== '/' ? '<span class="chip gray">' + esc(c.contact_nom) + '</span>' : '') +
    (c.zone ? '<span class="chip gray">' + esc(c.zone) + '</span>' : '') +
    (c.qualite_site ? '<span class="chip gray">Site : ' + esc(c.qualite_site) + '</span>' : '') +
    (c.tentatives ? '<span class="chip gray">' + c.tentatives + ' tentative(s)</span>' : '') +
    '    </div></div>' +
    '  </div>' +
    (c.telephone ? '<a class="call-tel v2" href="tel:' + esc(c.telephone) + '"><span class="ct-ico">&#9742;</span><span>' + esc(c.telephone) + '</span><span class="ct-hint">appuyer pour appeler</span></a>'
      : '<div class="hint">Pas de numero : trouve-le ou passe au suivant</div>') +
    '  <div class="call-links">' +
    (c.email && c.email !== '//' ? '<span class="chip green">Mail deja pris : ' + esc(c.email) + '</span>' : '<span class="chip gray">Mail pas encore pris</span>') +
    (c.site_actuel ? ' <a class="chip blue" style="text-decoration:none" href="' + esc(c.site_actuel) + '" target="_blank">Voir son site</a>' : '') +
    (c.lien_maps ? ' <a class="chip gray" style="text-decoration:none" href="' + esc(c.lien_maps) + '" target="_blank">Fiche Maps</a>' : '') +
    (c.telephone ? ' <a class="chip" style="background:#25d366;color:#fff;text-decoration:none" href="' + waSession(c) + '" target="_blank">WhatsApp</a>' : '') +
    ' <button type="button" class="chip gold" style="border:none;cursor:pointer;font:inherit;font-weight:700" onclick="AssistantIA.open(\'' + c.id + '\')">Assistant IA</button>' +
    '  </div>' +
    ((isRelance(c) || isRappel(c)) && c.rappel_note ? '<div class="call-memo"><b>Note du dernier appel' + (c.rappel_heure ? ' \u00b7 prevu a ' + c.rappel_heure.slice(0,5) : '') + ' :</b> ' + esc(c.rappel_note) + '</div>' : '') +
    (c.notes ? '<div class="call-notes">' + esc(c.notes) + '</div>' : '') +
    '  <div class="issues v2">' +
    '   <button class="ib gold" onclick="issueRdv()"><span class="ib-t">RDV pris</span><span class="ib-s">agenda + fiche envoyee auto</span></button>' +
    '   <button class="ib blue" onclick="issueMail()"><span class="ib-t">Veut un mail</span><span class="ib-s">fiche + relance programmee</span></button>' +
    '   <button class="ib viol" onclick="issueRappeler()"><span class="ib-t">A rappeler</span><span class="ib-s">prends le mail avant !</span></button>' +
    '   <button class="ib gray" onclick="issuePasReponse()"><span class="ib-t">Pas de reponse</span><span class="ib-s">repart en bas de file</span></button>' +
    '   <button class="ib red wide" onclick="issuePasInteresse()"><span class="ib-t">Pas interesse</span><span class="ib-s">range, recuperable plus tard</span></button>' +
    '  </div>' +
    ' </div>' +
    ' <div class="aside">' +
    '  <div class="card as-card"><div class="as-h">A traiter aujourd\'hui <span class="as-count">' + (rel.length + rap.length) + '</span></div>' + asideTraiter + '</div>' +
    '  <div class="card as-card"><div class="as-h">Ensuite dans la file</div>' + asideSuite + '</div>' +
    '  <div class="card as-card"><div class="as-h">Programmes plus tard <span class="as-count gray">' + futures.length + '</span></div>' +
    futures.slice(0, 4).map(function (x) { return ligneAside(x, '<span class="chip gray">' + fmtDate(x.rappel_le) + '</span>'); }).join('') +
    (futures.length > 4 ? '<div class="as-empty">+ ' + (futures.length - 4) + ' autres</div>' : (futures.length ? '' : '<div class="as-empty">Aucun</div>')) + '</div>' +
    ' </div>' +
    '</div>';
}
window.appelDirect = function (id) {
  FORCE_ID = id;
  go('session');
};

/* ── issue : RDV pris ── */
function issueRdv() {
  var c = CUR;
  var jours = [];
  for (var i = 0; i < 10; i++) { var d = addDays(todayISO(), i); var dt = new Date(d + 'T12:00:00'); if (dt.getDay() !== 0) jours.push(d); }
  openMo('RDV pris — ' + c.entreprise,
    '<label class="lbl">Email du prospect (le mail sera pret a copier)</label>' +
    '<input type="email" id="i-email" value="' + esc(c.email && c.email !== '//' ? c.email : '') + '" placeholder="contact@entreprise.fr">' +
    '<label class="lbl">Jour</label>' +
    '<select id="i-jour" onchange="renderSlots()">' + jours.map(function (d) {
      return '<option value="' + d + '">' + new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + '</option>';
    }).join('') + '</select>' +
    '<label class="lbl">Creneau (les barres sont deja pris dans l\'agenda de Louis)</label>' +
    '<div class="slot-grid" id="i-slots"></div>' +
    '<label class="lbl">Lieu / visio</label>' +
    '<input type="text" id="i-lieu" placeholder="Sur place, tel, visio...">' +
    '<label class="lbl">Objet du RDV / valeur estimee</label>' + selectOffre('i', 490) +
    '<div style="margin-top:16px"><button class="btn gold" style="width:100%" onclick="confirmRdv()">Confirmer le RDV et preparer le mail</button></div>');
  renderSlots();
}
window.renderSlots = function () {
  var jour = el('i-jour').value;
  var busy = DB.evenements.filter(function (e) {
    return e.date_debut && e.date_debut.slice(0, 10) === jour && (e.type || '').indexOf('rdv') === 0 && e.statut !== 'annule';
  }).map(function (e) { return e.date_debut.slice(11, 16); });
  var h = '';
  for (var hh = 8; hh <= 18; hh++) {
    ['00', '30'].forEach(function (mm) {
      var t = String(hh).padStart(2, '0') + ':' + mm;
      var b = busy.some(function (x) { return x && Math.abs((parseInt(x.slice(0, 2)) * 60 + parseInt(x.slice(3))) - (hh * 60 + parseInt(mm))) < 60; });
      h += '<div class="slot' + (b ? ' busy' : '') + '" ' + (b ? '' : 'onclick="selSlot(this)"') + ' data-t="' + t + '">' + t + '</div>';
    });
  }
  el('i-slots').innerHTML = h;
};
window.selSlot = function (n) {
  document.querySelectorAll('.slot.sel').forEach(function (x) { x.classList.remove('sel'); });
  n.classList.add('sel');
};
window.confirmRdv = async function () {
  var c = CUR;
  var email = el('i-email').value.trim();
  var jour = el('i-jour').value;
  var slotEl = document.querySelector('.slot.sel');
  if (!slotEl) { toast('Choisis un creneau', true); return; }
  var heure = slotEl.getAttribute('data-t');
  var lieu = el('i-lieu').value.trim();
  var valeur = valeurOffre('i');
  closeMo();
  var clientId = c.client_id;
  if (!clientId) {
    var clientObj = {
      entreprise: c.entreprise, contact_nom: c.contact_nom || null, email: email || c.email || null,
      telephone: c.telephone || null, ville: c.zone || null, source: 'Prospection',
      statut_pipeline: 'rdv_pris', owner: ME.id || null, valeur_estimee: valeur
    };
    var ins = await sb().from('web_clients').insert(clientObj).select().single();
    if (ins.error) { delete clientObj.valeur_estimee; ins = await sb().from('web_clients').insert(clientObj).select().single(); } // colonne absente : on reessaie sans
    if (dbFail(ins, 'Creation du client refusee')) return;
    clientId = ins.data && ins.data.id;
  } else {
    await sb().from('web_clients').update({ valeur_estimee: valeur }).eq('id', clientId); // maj estimation (sans effet si colonne absente)
  }
  await cloreRappels(c.id);
  var evObj = {
    client_id: clientId, titre: 'RDV ' + c.entreprise, type: 'rdv_physique', cible_id: c.id,
    date_debut: jour + 'T' + heure + ':00', lieu: lieu || null,
    statut: 'a_venir', owner: ME.id || null, auto: false, montant: valeur
  };
  var resEv = await sb().from('web_evenements').insert(evObj);
  if (resEv.error) { delete evObj.montant; resEv = await sb().from('web_evenements').insert(evObj); } // colonne absente : on reessaie sans
  if (dbFail(resEv, 'RDV non enregistre dans l\'agenda')) return;
  await sb().from('web_prospection_cibles').update({
    statut: 'rdv_pris', email: email || c.email || null, client_id: clientId, updated_at: new Date().toISOString()
  }).eq('id', c.id);
  await logAction(c.id, 'appel', 'rdv_pris', 'RDV le ' + jour + ' ' + heure);
  if (email) { toast('RDV cale, copie le mail au client'); envoyerFiche(email, c.entreprise, 'rdv', jour, heure); }
  else { toast('RDV cale (pas de mail pris)', true); }
  await loadAll(); rSession();
};

/* ── issue : veut un mail ── */
function issueMail() {
  var c = CUR;
  openMo('Envoi de la fiche — ' + c.entreprise,
    '<label class="lbl">Email du prospect</label>' +
    '<input type="email" id="i-email" value="' + esc(c.email && c.email !== '//' ? c.email : '') + '" placeholder="contact@entreprise.fr">' +
    '<div class="grid g2">' +
    '<div><label class="lbl">Relance dans</label>' +
    '<select id="i-delai"><option value="1">1 jour</option><option value="2" selected>2 jours</option><option value="3">3 jours</option><option value="7">1 semaine</option></select></div>' +
    '<div><label class="lbl">A quelle heure (optionnel)</label><input type="time" id="i-heure"></div>' +
    '</div>' +
    '<label class="lbl">Note pour la relance (ce qu\'il a dit, a qui parler...)</label>' +
    '<textarea id="i-note" style="min-height:60px" placeholder="Ex : voir avec Mme X, interesse par un site vitrine, rappeler apres 14h..."></textarea>' +
    '<div style="margin-top:16px"><button class="btn blue" style="width:100%" onclick="confirmMail()">Programmer la relance et preparer le mail</button></div>');
}
window.confirmMail = async function () {
  var c = CUR;
  var email = el('i-email').value.trim();
  if (!email) { toast('Il faut le mail', true); return; }
  var delai = parseInt(el('i-delai').value, 10);
  var heure = el('i-heure').value;
  var note = el('i-note').value.trim();
  var date = addDays(todayISO(), delai);
  closeMo();
  await sb().from('web_prospection_cibles').update({
    statut: 'mail_envoye', email: email, rappel_le: date,
    rappel_heure: heure || null, rappel_note: note || null,
    updated_at: new Date().toISOString()
  }).eq('id', c.id);
  await cloreRappels(c.id);
  var resRel = await sb().from('web_evenements').insert({
    titre: 'Relancer ' + c.entreprise, type: 'rappel', cible_id: c.id,
    date_debut: date + 'T' + (heure || '09:00') + ':00',
    notes: note || null, statut: 'a_venir', owner: ME.id || null, auto: true
  });
  if (resRel && resRel.error) console.error('Relance agenda', resRel.error);
  await logAction(c.id, 'appel', 'mail_envoye', 'Relance le ' + date + (heure ? ' ' + heure : '') + (note ? ' — ' + note : ''));
  toast('Relance programmee le ' + fmtDate(date) + (heure ? ' a ' + heure : ''));
  await loadAll(); rSession();
  envoyerFiche(email, c.entreprise, 'presentation');
};

/* ── issue : a rappeler ── */
function issueRappeler() {
  var c = CUR;
  openMo('A rappeler — ' + c.entreprise,
    '<div class="hint" style="margin-top:0">Essaie d\'abord de prendre le mail ("je vous envoie notre presentation en attendant"). Un rappel avec fiche envoyee vaut dix fois un rappel sec.</div>' +
    '<label class="lbl">Email si tu as reussi a le prendre (le mail sera pret a copier)</label>' +
    '<input type="email" id="i-email" value="' + esc(c.email && c.email !== '//' ? c.email : '') + '" placeholder="laisse vide sinon">' +
    '<div class="grid g2">' +
    '<div><label class="lbl">Rappeler le</label><input type="date" id="i-date" value="' + addDays(todayISO(), 7) + '"></div>' +
    '<div><label class="lbl">A quelle heure (optionnel)</label><input type="time" id="i-heure"></div>' +
    '</div>' +
    '<label class="lbl">Note pour le rappel (ce qu\'il a dit, le contexte...)</label>' +
    '<textarea id="i-note" style="min-height:60px" placeholder="Ex : le patron rentre de vacances lundi, demander M. Y..."></textarea>' +
    '<div style="margin-top:16px"><button class="btn viol" style="width:100%" onclick="confirmRappeler()">Enregistrer</button></div>');
}
window.confirmRappeler = async function () {
  var c = CUR;
  var email = el('i-email').value.trim();
  var date = el('i-date').value;
  var heure = el('i-heure').value;
  var note = el('i-note').value.trim();
  closeMo();
  if (email) {
    await sb().from('web_prospection_cibles').update({
      statut: 'mail_envoye', email: email, rappel_le: date,
      rappel_heure: heure || null, rappel_note: note || null,
      updated_at: new Date().toISOString()
    }).eq('id', c.id);
    await logAction(c.id, 'appel', 'mail_envoye', 'Mail pris + relance le ' + date + (heure ? ' ' + heure : ''));
    toast('Relance programmee le ' + fmtDate(date) + (heure ? ' a ' + heure : ''));
  } else {
    await sb().from('web_prospection_cibles').update({
      statut: 'rappeler', rappel_le: date,
      rappel_heure: heure || null, rappel_note: note || null,
      updated_at: new Date().toISOString()
    }).eq('id', c.id);
    await logAction(c.id, 'appel', 'rappeler', 'Rappel le ' + date + (heure ? ' ' + heure : '') + ' (sans mail)' + (note ? ' — ' + note : ''));
    toast('Rappel note pour le ' + fmtDate(date) + (heure ? ' a ' + heure : ''));
  }
  await cloreRappels(c.id);
  var resRap = await sb().from('web_evenements').insert({
    titre: (email ? 'Relancer ' : 'Rappeler ') + c.entreprise, type: 'rappel', cible_id: c.id,
    date_debut: date + 'T' + (heure || '09:00') + ':00',
    notes: note || null, statut: 'a_venir', owner: ME.id || null, auto: true
  });
  if (resRap && resRap.error) console.error('Rappel agenda', resRap.error);
  if (email) envoyerFiche(email, c.entreprise, 'presentation');
  await loadAll(); rSession();
};

/* ── issue : pas de reponse ── */
window.issuePasReponse = async function () {
  var c = CUR;
  await sb().from('web_prospection_cibles').update({ tentatives: (c.tentatives || 0) + 1, updated_at: new Date().toISOString() }).eq('id', c.id);
  await logAction(c.id, 'appel', 'pas_de_reponse', null);
  toast('Remis en bas de la file');
  await loadAll(); rSession();
};

/* ── issue : pas interesse ── */
window.issuePasInteresse = async function () {
  var c = CUR;
  await cloreRappels(c.id);
  await sb().from('web_prospection_cibles').update({ statut: 'pas_interesse', updated_at: new Date().toISOString() }).eq('id', c.id);
  await logAction(c.id, 'appel', 'pas_interesse', null);
  toast('Range dans les pas interesses');
  await loadAll(); rSession();
};

/* ── envoi du mail avec la fiche ── */
function envoyerFiche(to, entreprise, contexte, jour, heure) {
  var sujet, corps;
  var _so = DB.societe || {};
  var signature = '\n\n' + ((ME.prenom || 'Louis') + ' ' + (ME.nom || '')).trim() + '\nNOVALEM - Creation de sites internet en Guadeloupe\n' + (_so.telephone || '+590 690 31 79 99') + '\n' + (_so.email || 'louisprorenault@gmail.com');
  if (contexte === 'rdv') {
    sujet = 'Notre rendez-vous du ' + new Date(jour + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' - NOVALEM';
    corps = 'Bonjour,\n\nMerci pour notre echange. Je vous confirme notre rendez-vous le ' +
      new Date(jour + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' a ' + heure + '.\n\n' +
      'Vous trouverez en piece jointe notre fiche de presentation : nos realisations, nos tarifs et notre facon de travailler.\n\nA tres vite,' + signature;
  } else {
    sujet = 'Votre site internet - presentation NOVALEM';
    corps = 'Bonjour,\n\nSuite a notre echange telephonique, voici notre fiche de presentation en piece jointe : realisations, tarifs et facon de travailler.\n\n' +
      'Je reste disponible pour en discuter quand vous voulez, et je reviens vers vous dans quelques jours.\n\nBien a vous,' + signature;
  }
  ouvrirMailCopier(to, sujet, corps);
}


/* boite mail retiree : les mails se copient-collent depuis ta propre boite (voir js/mail-copier.js) */

/* ═════════ REPERAGE (ajout rapide) ═════════ */
function rReperage() {
  var recentes = DB.cibles.slice().sort(function (a, b) { return (a.created_at || '') < (b.created_at || '') ? 1 : -1; }).slice(0, 12);
  el('content').innerHTML =
    '<div class="grid" style="grid-template-columns:380px 1fr;gap:16px" id="rep-grid">' +
    '<div class="card"><h2>Nouvelle cible</h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:6px">Tu reperes sur Google Maps, tu copies-colles ici, elle part dans la file d\'appels. Entree = ajouter.</div>' +
    '<label class="lbl">Entreprise *</label><input type="text" id="c-ent" placeholder="Nom de l\'entreprise">' +
    '<label class="lbl">Telephone</label><input type="tel" id="c-tel" placeholder="0590...">' +
    '<div class="grid g2"><div><label class="lbl">Zone</label><input type="text" id="c-zone" placeholder="Jarry, Baie-Mahault..."></div>' +
    '<div><label class="lbl">Site actuel</label><select id="c-qs"><option value="aucun">Aucun</option><option value="facebook">Juste Facebook</option><option value="mauvais">Site mauvais/vieux</option><option value="correct">Site correct</option></select></div></div>' +
    '<label class="lbl">Lien Google Maps (colle-le)</label><input type="text" id="c-maps" placeholder="https://maps.app.goo.gl/...">' +
    '<label class="lbl">Note</label><input type="text" id="c-note" placeholder="Camionnette croisee, pub Insta, decideur = ...">' +
    '<div style="margin-top:14px"><button class="btn gold" style="width:100%" onclick="saveCible()">Ajouter a la file d\'appels</button></div></div>' +
    '<div class="card"><h2>Dernieres cibles ajoutees</h2>' +
    (recentes.length ? '<table class="tbl"><tr><th>Entreprise</th><th>Zone</th><th>Tel</th><th>Statut</th><th></th></tr>' +
      recentes.map(function (c) {
        return '<tr><td><b>' + esc(c.entreprise) + '</b></td><td>' + esc(c.zone || '') + '</td><td>' + esc(c.telephone || '') + '</td>' +
          '<td><span class="chip gray">' + esc(c.statut || '') + '</span></td>' +
          '<td style="text-align:right"><button type="button" class="btn ghost sm" onclick="AssistantIA.open(\'' + c.id + '\')">IA</button></td></tr>';
      }).join('') + '</table>' : '<div class="empty">Aucune cible</div>') + '</div></div>';
  el('c-ent').focus();
  ['c-ent', 'c-tel', 'c-zone', 'c-maps', 'c-note'].forEach(function (id) {
    el(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') saveCible(); });
  });
}
window.saveCible = async function () {
  var ent = el('c-ent').value.trim();
  if (!ent) { toast('Il faut le nom de l\'entreprise', true); return; }
  var r = await sb().from('web_prospection_cibles').insert({
    entreprise: ent, telephone: el('c-tel').value.trim() || null, zone: el('c-zone').value.trim() || null,
    qualite_site: el('c-qs').value, statut: 'a_appeler',
    lien_maps: el('c-maps').value.trim() || null, notes: el('c-note').value.trim() || null,
    owner: ME.id || null
  });
  if (r.error) { toast('Erreur : ' + r.error.message, true); return; }
  toast(ent + ' ajoutee a la file');
  await loadAll(); rReperage();
};

/* ═════════ PAS INTERESSES/* ═════════ PAS INTERESSES ═════════ */
function rMorts() {
  var morts = DB.cibles.filter(function (c) { return c.statut === 'pas_interesse'; })
    .sort(function (a, b) { return a.updated_at < b.updated_at ? 1 : -1; });
  el('content').innerHTML = '<div class="card"><h2>' + morts.length + ' entreprises pas interessees</h2>' +
    (morts.length ? '<table class="tbl"><tr><th>Entreprise</th><th>Zone</th><th>Tel</th><th>Refus le</th><th></th></tr>' +
      morts.map(function (c) {
        return '<tr><td><b>' + esc(c.entreprise) + '</b></td><td>' + esc(c.zone || '') + '</td><td>' + esc(c.telephone || '') + '</td><td>' + fmtDate(c.updated_at) + '</td>' +
          '<td><button class="btn ghost sm" onclick="ressusciter(\'' + c.id + '\')">Remettre en file</button></td></tr>';
      }).join('') + '</table>' : '<div class="empty">Aucune pour l\'instant</div>') + '</div>';
}
window.ressusciter = async function (id) {
  await sb().from('web_prospection_cibles').update({ statut: 'a_appeler', updated_at: new Date().toISOString() }).eq('id', id);
  toast('Remise dans la file');
  await loadAll(); rMorts();
};

/* ═════════ AGENDA ═════════ */
function rAgenda() {
  el('content').innerHTML = '<div style="margin-bottom:12px;display:flex;gap:8px"><button class="btn ghost sm" onclick="nouvelEvenement()">+ RDV / rappel / tache</button></div><div id="ag"></div>';
  var prev = agenda ? agenda.getState() : null; // ne pas perdre la vue et la date en cours a chaque rendu
  agenda = NovAgenda.create(el('ag'), {
    events: function () { return DB.evenements.filter(function (e) { return e.statut !== 'annule'; }); },
    labelFor: function (e) { return e.titre; },
    onSlotClick: function (d) { nouvelEvenement(d); },
    onEventClick: function (e) { detailEvenement(e.id); },
    view: prev ? prev.view : (window.innerWidth < 820 ? 'jour' : 'semaine'),
    date: prev ? prev.date : undefined,
    hourStart: 7, hourEnd: 20
  });
}
window.nouvelEvenement = function (d) {
  var dd = d instanceof Date ? d : new Date();
  var iso = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
  var hh = d instanceof Date ? String(dd.getHours()).padStart(2, '0') + ':' + String(dd.getMinutes()).padStart(2, '0') : '';
  openMo('Nouvel element',
    '<label class="lbl">Intitule *</label><input type="text" id="e-titre" placeholder="RDV Chez X, rappeler Y, faire Z...">' +
    '<label class="lbl">Type</label><select id="e-type"><option value="rdv_physique">RDV sur place</option><option value="rdv_visio">RDV visio / tel</option><option value="rappel">Rappel</option><option value="tache" ' + (hh ? '' : 'selected') + '>Tache (sans heure)</option></select>' +
    '<div class="grid g2"><div><label class="lbl">Date</label><input type="date" id="e-date" value="' + iso + '"></div>' +
    '<div><label class="lbl">Heure (vide pour une tache)</label><input type="time" id="e-heure" value="' + hh + '"></div></div>' +
    '<label class="lbl">Valeur estimee du RDV (0 si ce n\'est pas commercial)</label>' + selectOffre('e', 0) +
    '<div style="margin-top:16px"><button class="btn gold" style="width:100%" onclick="saveEvenement()">Enregistrer</button></div>');
};
window.saveEvenement = async function () {
  var titre = el('e-titre').value.trim();
  if (!titre) { toast('Il faut un intitule', true); return; }
  var date = el('e-date').value, heure = el('e-heure').value;
  if (!date) { toast('Il faut une date', true); return; }
  var evObj = {
    titre: titre, type: el('e-type').value,
    date_debut: date + 'T' + (heure || '08:00') + ':00',
    statut: 'a_venir', owner: ME.id || null, auto: false, montant: valeurOffre('e')
  };
  var res = await sb().from('web_evenements').insert(evObj).select().single();
  if (res.error) { delete evObj.montant; res = await sb().from('web_evenements').insert(evObj).select().single(); }
  if (dbFail(res, 'Enregistrement refuse')) return;
  closeMo(); toast('Enregistre');
  await loadAll();
  if (VIEW === 'agenda') {
    rAgenda();
    if (agenda) agenda.setDate(new Date(date + 'T12:00:00')); // afficher tout de suite ce qu'on vient de creer
  }
  if (VIEW === 'accueil') rAccueil();
};
window.editEvenement = function (id) {
  var e = DB.evenements.find(function (x) { return x.id === id; });
  if (!e) return;
  var date = (e.date_debut || '').slice(0, 10);
  var heure = (e.date_debut || '').slice(11, 16);
  openMo('Modifier — ' + e.titre,
    '<label class="lbl">Intitule *</label><input type="text" id="e-titre" value="' + esc(e.titre || '') + '">' +
    '<label class="lbl">Type</label><select id="e-type">' +
    [['rdv_physique', 'RDV sur place'], ['rdv_visio', 'RDV visio / tel'], ['rappel', 'Rappel'], ['tache', 'Tache (sans heure)']].map(function (t) {
      return '<option value="' + t[0] + '"' + (e.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
    }).join('') + '</select>' +
    '<div class="grid g2"><div><label class="lbl">Date</label><input type="date" id="e-date" value="' + esc(date) + '"></div>' +
    '<div><label class="lbl">Heure (vide pour une tache)</label><input type="time" id="e-heure" value="' + esc(heure) + '"></div></div>' +
    '<label class="lbl">Valeur estimee du RDV (0 si ce n\'est pas commercial)</label>' + selectOffre('e', e.montant) +
    '<div style="margin-top:16px"><button class="btn gold" style="width:100%" onclick="updateEvenement(\'' + id + '\')">Enregistrer les modifications</button></div>');
};
window.updateEvenement = async function (id) {
  var titre = el('e-titre').value.trim();
  if (!titre) { toast('Il faut un intitule', true); return; }
  var date = el('e-date').value, heure = el('e-heure').value;
  if (!date) { toast('Il faut une date', true); return; }
  var evObj = {
    titre: titre, type: el('e-type').value,
    date_debut: date + 'T' + (heure || '08:00') + ':00',
    montant: valeurOffre('e'), updated_at: new Date().toISOString()
  };
  var res = await sb().from('web_evenements').update(evObj).eq('id', id);
  if (res.error) { delete evObj.montant; res = await sb().from('web_evenements').update(evObj).eq('id', id); }
  if (dbFail(res, 'Modification refusee')) return;
  closeMo(); toast('Modifie');
  await loadAll(); go(VIEW);
};
window.detailEvenement = function (id) {
  var e = DB.evenements.find(function (x) { return x.id === id; });
  if (!e) return;
  var client = e.client_id ? DB.clients.find(function (x) { return x.id === e.client_id; }) : null;
  var cible = e.cible_id ? DB.cibles.find(function (x) { return x.id === e.cible_id; }) : null;
  var TYPES = { rdv_physique: 'RDV sur place', rdv_visio: 'RDV visio / tel', rappel: 'Rappel', tache: 'Tache', echeance: 'Echeance' };
  openMo(e.titre,
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
    '<span class="chip gold">' + (TYPES[e.type] || e.type) + '</span>' +
    ((e.montant != null && Number(e.montant) > 0) ? '<span class="chip">' + eur(Number(e.montant)) + '</span>' : '') +
    (e.statut === 'fait' ? '<span class="chip green">Fait</span>' : '') +
    (client ? '<span class="chip blue">' + esc(client.entreprise) + '</span>' : '') + '</div>' +
    '<div style="font-size:14px;color:var(--mut)">' + new Date(e.date_debut).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) +
    (e.lieu ? ' — ' + esc(e.lieu) : '') + '</div>' +
    (e.notes ? '<div class="call-notes">' + esc(e.notes) + '</div>' : '') +
    (cible && (cible.telephone) ? '<div style="margin-top:10px;font-size:13px">Tel : <b>' + esc(cible.telephone) + '</b>' + (cible.rappel_note ? ' — ' + esc(cible.rappel_note) : '') + '</div>' : '') +
    '<div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">' +
    (e.statut !== 'fait' ? '<button class="btn gold" onclick="marquerFait(\'' + e.id + '\')">Fait</button>' : '') +
    '<button class="btn ghost" onclick="editEvenement(\'' + e.id + '\')">Modifier</button>' +
    (cible && cible.statut !== 'rdv_pris' && cible.statut !== 'pas_interesse' ? '<button class="btn viol" onclick="closeMo();appelDirect(\'' + cible.id + '\')">Appeler maintenant</button>' : '') +
    (client ? '<button class="btn blue" onclick="closeMo();dossierClient(\'' + client.id + '\')">Dossier client</button>' : '') +
    '<button class="btn red" style="margin-left:auto" onclick="supprimerEvenement(\'' + e.id + '\')">Supprimer</button></div>');
};
window.marquerFait = async function (id) {
  var e = DB.evenements.find(function (x) { return x.id === id; });
  var res = await sb().from('web_evenements').update({ statut: 'fait', updated_at: new Date().toISOString() }).eq('id', id);
  if (dbFail(res, 'Impossible de marquer fait')) return;
  // intelligence : un RDV marque fait avance le client dans le pipeline
  if (e && (e.type || '').indexOf('rdv') === 0 && e.client_id) {
    var cl = DB.clients.find(function (x) { return x.id === e.client_id; });
    if (cl && (cl.statut_pipeline === 'rdv_pris' || cl.statut_pipeline === 'contacte')) {
      await sb().from('web_clients').update({ statut_pipeline: 'rdv_fait', updated_at: new Date().toISOString() }).eq('id', e.client_id);
      toast(cl.entreprise + ' passe en "RDV fait" dans le pipeline');
    }
  }
  closeMo(); await loadAll(); go(VIEW);
};
window.supprimerEvenement = async function (id) {
  var res = await sb().from('web_evenements').update({ statut: 'annule', updated_at: new Date().toISOString() }).eq('id', id);
  if (dbFail(res, 'Suppression refusee')) return;
  closeMo(); await loadAll(); go(VIEW);
};

/* — tache rapide depuis la barre du haut (mobile friendly) — */
async function quickTache() {
  var inp = el('quick-tache');
  var t = inp.value.trim();
  if (!t) return;
  var res = await sb().from('web_evenements').insert({ titre: t, type: 'tache', date_debut: todayISO() + 'T08:00:00', statut: 'a_venir', owner: ME.id || null, auto: false });
  if (dbFail(res, 'Tache non enregistree')) return;
  inp.value = '';
  toast('Tache notee pour aujourd\'hui');
  await loadAll(); if (VIEW === 'accueil' || VIEW === 'agenda') go(VIEW);
}

/* ═════════ TABLEAU DE BORD (Louis) ═════════ */
function rAccueil() {
  var today = todayISO();
  // CA en jeu : RDV fait / client en pipeline mais site pas livre
  var enJeu = DB.clients.filter(function (c) { return ['rdv_pris', 'rdv_fait', 'devis_envoye', 'signe', 'en_production'].indexOf(c.statut_pipeline) >= 0; });
  var caEnJeu = 0;
  enJeu.forEach(function (c) { caEnJeu += caClient(c); });
  var rdvAVenir = DB.evenements.filter(function (e) { return (e.type || '').indexOf('rdv') === 0 && e.statut === 'a_venir' && e.date_debut >= today; });
  var caPotentiel = rdvAVenir.reduce(function (s, e) { return s + montantEvt(e); }, 0);
  var aProduire = DB.projets.filter(function (p) { return ['cadrage', 'maquette', 'developpement'].indexOf(p.statut) >= 0; }).length;
  var tachesJour = DB.evenements.filter(function (e) { return e.statut === 'a_venir' && e.date_debut && e.date_debut.slice(0, 10) <= today; })
    .sort(function (a, b) { return a.date_debut < b.date_debut ? -1 : 1; });
  var relCount = DB.cibles.filter(isRelance).length + DB.cibles.filter(isRappel).length;

  el('content').innerHTML =
    '<div class="grid g4" style="margin-bottom:16px">' +
    '<div class="kpi gold"><div class="v">' + eur(caEnJeu) + '</div><div class="l">CA en jeu</div><div class="s">' + enJeu.length + ' client(s) entre RDV et livraison : le timing est sur toi</div></div>' +
    '<div class="kpi blue"><div class="v">' + eur(caPotentiel) + '</div><div class="l">CA potentiel</div><div class="s">' + rdvAVenir.length + ' RDV a venir (valeur estimee)</div></div>' +
    '<div class="kpi"><div class="v">' + aProduire + '</div><div class="l">Sites a produire</div><div class="s">en cadrage, maquette ou dev</div></div>' +
    '<div class="kpi green"><div class="v">' + relCount + '</div><div class="l">Relances du jour</div><div class="s">cote commercial</div></div>' +
    '</div>' +
    '<div class="grid g4" style="margin-bottom:16px">' +
    '<div class="kpi"><div class="v">' + convStats().appels + '</div><div class="l">Appels (30 j)</div><div class="s">toutes issues</div></div>' +
    '<div class="kpi gold"><div class="v">' + convStats().taux + ' %</div><div class="l">Taux appel &rarr; RDV</div><div class="s">' + convStats().rdv + ' RDV pris sur 30 j</div></div>' +
    '<div class="kpi green"><div class="v">' + eur(caEncaisse()) + '</div><div class="l">CA livre</div><div class="s">sites en ligne / livres</div></div>' +
    '<div class="kpi blue"><div class="v">' + eur(margeMensuelle()) + '</div><div class="l">Marge recurrente / mois</div><div class="s">abonnements - charges</div></div>' +
    '</div>' +
    '<div class="grid g2">' +
    '<div class="card"><h2>Aujourd\'hui</h2>' +
    (tachesJour.length ? tachesJour.map(function (e) {
      var late = e.date_debut.slice(0, 10) < today;
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line)">' +
        '<input type="checkbox" onchange="marquerFait(\'' + e.id + '\')" style="width:auto">' +
        '<div style="flex:1"><b>' + esc(e.titre) + '</b>' + (late ? ' <span class="chip red">en retard</span>' : '') +
        '<div style="font-size:11.5px;color:var(--mut2)">' + ({ rdv_physique: 'RDV sur place', rdv_visio: 'RDV visio', rappel: 'Rappel', tache: 'Tache', echeance: 'Echeance' }[e.type] || e.type) +
        ((e.type || '').indexOf('rdv') === 0 ? ' a ' + e.date_debut.slice(11, 16) : '') + '</div></div></div>';
    }).join('') : '<div class="empty">Rien pour aujourd\'hui. Note une tache dans la barre du haut.</div>') + '</div>' +
    '<div class="card"><h2>Charge de la semaine</h2>' + chargeSemaine() + '</div>' +
    '<div class="card" style="grid-column:1/-1"><h2>Charges mensuelles &amp; capacite d\'investissement</h2>' + chargesHtml() + '</div>' +
    '</div>';
}
function convStats() {
  var il30 = new Date(); il30.setDate(il30.getDate() - 30);
  var acts = (DB.actionsAll || []).filter(function (a) { return new Date(a.created_at) >= il30 && a.type === 'appel'; });
  var rdv = acts.filter(function (a) { return a.resultat === 'rdv_pris'; }).length;
  return { appels: acts.length, rdv: rdv, taux: acts.length ? Math.round(rdv / acts.length * 100) : 0 };
}
function caEncaisse() {
  return (DB.projets || []).filter(function (p) { return ['en_ligne', 'livre'].indexOf(p.statut) >= 0; })
    .reduce(function (t, p) { return t + Number(p.prix_ht || 0); }, 0);
}
function mrrTotal() {
  return (DB.hebergements || []).reduce(function (t, h) { return t + Number(h.abonnement_mensuel || 0); }, 0);
}
function margeMensuelle() {
  var charges = (DB.charges || []).reduce(function (t, c) { return t + Number(c.montant_mensuel || 0); }, 0);
  return mrrTotal() - charges;
}
function chargesHtml() {
  var charges = DB.charges || [];
  var totalCh = charges.reduce(function (t, c) { return t + Number(c.montant_mensuel || 0); }, 0);
  return (charges.length ? '<table class="tbl"><tr><th>Charge</th><th>Par mois</th><th></th></tr>' +
    charges.map(function (c) {
      return '<tr><td>' + esc(c.libelle) + '</td><td>' + eur(c.montant_mensuel) + '</td>' +
        '<td style="text-align:right"><span style="color:var(--red);cursor:pointer;font-weight:800" onclick="delCharge(\'' + c.id + '\')">&times;</span></td></tr>';
    }).join('') + '</table>' : '<div class="empty" style="padding:8px">Aucune charge saisie (Vercel, Supabase, abonnements outils, futur local...)</div>') +
    '<div class="grid g3" style="margin-top:10px;align-items:end">' +
    '<div><label class="lbl" style="margin-top:0">Nouvelle charge</label><input type="text" id="ch-lib" placeholder="Vercel Pro, local, outil..."></div>' +
    '<div><label class="lbl" style="margin-top:0">Montant / mois (\u20AC)</label><input type="number" step="0.01" id="ch-mt"></div>' +
    '<button class="btn ghost sm" onclick="addCharge()">Ajouter</button></div>' +
    '<div style="margin-top:14px;font-size:14px">Charges : <b>' + eur(totalCh) + '</b> / mois \u00b7 Abonnements clients : <b>' + eur(mrrTotal()) + '</b> / mois \u00b7 ' +
    'Marge recurrente : <b style="color:' + (margeMensuelle() >= 0 ? 'var(--green)' : 'var(--red)') + '">' + eur(margeMensuelle()) + '</b> / mois</div>' +
    '<div style="font-size:12px;color:var(--mut2);margin-top:4px">Repere simple : un investissement (local, embauche) est raisonnable quand la marge recurrente + ta moyenne de CA one-shot le couvrent 3 mois de suite.</div>';
}
window.addCharge = async function () {
  var lib = el('ch-lib').value.trim();
  var mt = parseFloat(el('ch-mt').value);
  if (!lib || !mt) { toast('Libelle + montant', true); return; }
  var r = await sb().from('web_charges').insert({ libelle: lib, montant_mensuel: mt });
  if (r.error) { toast('Execute d\'abord supabase/phase5.sql (' + r.error.message + ')', true); return; }
  await loadAll(); rAccueil();
};
window.delCharge = async function (id) {
  await sb().from('web_charges').delete().eq('id', id);
  await loadAll(); rAccueil();
};
function chargeSemaine() {
  var jours = [];
  var lundi = new Date(); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  for (var i = 0; i < 6; i++) {
    var d = new Date(lundi); d.setDate(lundi.getDate() + i);
    var iso = d.toISOString().slice(0, 10);
    var evts = DB.evenements.filter(function (e) { return e.statut !== 'annule' && e.date_debut && e.date_debut.slice(0, 10) === iso; });
    var rdv = evts.filter(function (e) { return (e.type || '').indexOf('rdv') === 0; }).length;
    var autres = evts.length - rdv;
    jours.push('<div style="display:flex;align-items:center;gap:10px;padding:7px 2px;border-bottom:1px solid var(--line)">' +
      '<div style="width:74px;font-weight:700;font-size:12.5px;text-transform:capitalize">' + d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) + '</div>' +
      '<div style="flex:1;display:flex;gap:4px">' +
      Array(rdv).fill('<span style="width:16px;height:16px;border-radius:4px;background:var(--gold)"></span>').join('') +
      Array(autres).fill('<span style="width:16px;height:16px;border-radius:4px;background:var(--line2)"></span>').join('') +
      (evts.length === 0 ? '<span style="font-size:11.5px;color:var(--mut2)">libre : ideal pour produire un site</span>' : '') +
      '</div></div>');
  }
  return jours.join('') + '<div style="font-size:11px;color:var(--mut2);margin-top:8px">Carre or = RDV, carre gris = rappel/tache. Les jours libres sont tes creneaux de production.</div>';
}

/* ═════════ DEMANDES D'ACCES (superviseur) ═════════ */
function rAcces() {
  var att = (DB.demandes || []).filter(function (d) { return d.statut === 'en_attente'; });
  var autres = (DB.demandes || []).filter(function (d) { return d.statut !== 'en_attente'; });
  function chipStatut(st) {
    return st === 'en_attente' ? '<span class="chip gold">En attente</span>'
      : (st || '').indexOf('valid') === 0 ? '<span class="chip green">Valide</span>'
        : '<span class="chip red">Refuse</span>';
  }
  el('content').innerHTML =
    '<div class="card" style="margin-bottom:16px"><h2>A valider (' + att.length + ')</h2>' +
    (att.length ? '<table class="tbl"><tr><th>Prenom</th><th>Nom</th><th>Compte qui sera cree</th><th>Demande le</th><th></th></tr>' +
      att.map(function (d) {
        var email = (d.prenom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') + '.' +
          (d.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') + '@novalem.internal';
        return '<tr><td><b>' + esc(d.prenom) + '</b></td><td><b>' + esc(d.nom) + '</b></td><td style="font-size:12px;color:var(--mut)">' + esc(email) + '</td><td>' + fmtDate(d.created_at) + '</td>' +
          '<td style="text-align:right;white-space:nowrap"><button class="btn gold sm" onclick="accesAction(\'' + d.id + '\',\'valider\')">Accepter</button> ' +
          '<button class="btn red sm" onclick="accesAction(\'' + d.id + '\',\'refuser\')">Refuser</button></td></tr>';
      }).join('') + '</table>' : '<div class="empty">Aucune demande en attente</div>') + '</div>' +
    '<div class="card"><h2>Historique</h2>' +
    (autres.length ? '<table class="tbl"><tr><th>Prenom</th><th>Nom</th><th>Statut</th><th>Le</th></tr>' +
      autres.map(function (d) {
        return '<tr><td>' + esc(d.prenom) + '</td><td>' + esc(d.nom) + '</td><td>' + chipStatut(d.statut) + '</td><td>' + fmtDate(d.created_at) + '</td></tr>';
      }).join('') + '</table>' : '<div class="empty">Vide</div>') + '</div>';
}
window.accesAction = async function (id, action) {
  try {
    var r = await fetch('/api/acces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, action: action }) });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Erreur');
    toast(action === 'valider' ? 'Compte cree : ' + (d.email || '') : 'Demande refusee');
  } catch (e) { toast('Erreur : ' + e.message, true); }
  await loadAll(); rAcces();
};

/* ═════════ PRODUCTION (phase 3 : vue de suivi) ═════════ */
function rProduction() {
  // UNIQUEMENT apres le RDV : rdv_fait -> en_production. Un RDV juste pris (rdv_pris),
  // pas encore passe, reste dans la Session d'appel et n'apparait pas ici.
  var etapes = ['rdv_fait', 'devis_envoye', 'signe', 'en_production'];
  function caDe(c) { return caClient(c); }
  function domDe(c) { var h = (DB.hebergements || []).find(function (z) { return z.client_id === c.id; }); return (h && h.nom_domaine) ? h.nom_domaine : ''; }
  var file = DB.clients.filter(function (c) { return etapes.indexOf(c.statut_pipeline) >= 0; })
    .map(function (c) { return { c: c, ca: caDe(c) }; })
    .sort(function (a, b) { return b.ca - a.ca; });
  var enLigne = DB.clients.filter(function (c) { return c.statut_pipeline === 'en_ligne'; })
    .sort(function (a, b) { return (a.updated_at < b.updated_at) ? 1 : -1; });
  var total = file.reduce(function (s, x) { return s + x.ca; }, 0);

  function carte(x) {
    var c = x.c, dom = domDe(c);
    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">' +
      '<div style="min-width:0"><div style="font-weight:800;font-size:15px">' + esc(c.entreprise) + '</div>' +
      '<div style="font-size:12px;color:var(--mut2)">' + esc([c.ville, c.telephone, c.email].filter(Boolean).join(' \u00b7 ')) + '</div></div>' +
      '<span class="chip blue">' + esc(c.statut_pipeline) + '</span></div>' +
      '<div style="margin-top:8px;font-size:13px;color:var(--mut)">CA en jeu : <b style="color:var(--ink)">' + eur(x.ca) + '</b>' + (dom ? ' \u00b7 ' + esc(dom) : '') + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button class="btn gold sm" onclick="UsineUI.open(\'' + c.id + '\')">Ouvrir l\'atelier</button>' +
      '<button class="btn sm" onclick="dossierClient(\'' + c.id + '\')">Dossier</button>' +
      '<button class="btn ghost sm" style="margin-left:auto" onclick="marquerEnLigne(\'' + c.id + '\')">Marquer en ligne (termine)</button>' +
      '</div></div>';
  }

  el('content').innerHTML =
    '<div class="grid g2" style="margin-bottom:16px">' +
    '<div class="kpi gold"><div class="v">' + eur(total) + '</div><div class="l">CA en jeu dans la file</div><div class="s">se debloque site par site</div></div>' +
    '<div class="kpi"><div class="v">' + file.length + '</div><div class="l">Sites a produire</div><div class="s">uniquement apres le RDV</div></div>' +
    '</div>' +
    '<h2 style="margin:0 0 10px">A produire (apres RDV)</h2>' +
    (file.length ? '<div class="grid g2">' + file.map(carte).join('') + '</div>'
      : '<div class="empty">Personne a produire. Un client arrive ici quand son RDV est marque "fait". Un RDV juste pris (pas encore passe) reste dans la Session d\'appel.</div>') +
    (enLigne.length ? '<h2 style="margin:22px 0 10px">Sites en ligne (termines)</h2><div class="card" style="padding:8px 14px">' +
      enLigne.map(function (c) {
        var dom = domDe(c);
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)"><b style="flex:1">' + esc(c.entreprise) + '</b>' +
          (dom ? '<a class="chip blue" style="text-decoration:none" href="' + esc(/^https?:/.test(dom) ? dom : 'https://' + dom) + '" target="_blank">' + esc(dom) + '</a>' : '<span class="chip green">en ligne</span>') +
          '<button class="btn ghost sm" onclick="dossierClient(\'' + c.id + '\')">Dossier</button></div>';
      }).join('') + '</div>' : '') +
    '<div class="hint" style="margin-top:14px">Le site est <b>fini</b> quand tu cliques "Marquer en ligne" (ici ou dans l\'atelier) : il quitte la file et passe en "En ligne" dans le pipeline.</div>';
}

window.marquerEnLigne = async function (id) {
  var c = DB.clients.find(function (x) { return x.id === id; });
  var res = await sb().from('web_clients').update({ statut_pipeline: 'en_ligne', updated_at: new Date().toISOString() }).eq('id', id);
  if (dbFail(res, 'Mise a jour refusee')) return;
  toast((c ? c.entreprise : 'Le site') + ' passe en ligne (termine)');
  await loadAll(); if (VIEW === 'production') rProduction();
};

/* ═════════ FACTURES (suivi global) ═════════ */
function rFactures() {
  var rows = (DB.factures || []).slice().sort(function (a, b) { return (a.date_facture || a.created_at || '') < (b.date_facture || b.created_at || '') ? 1 : -1; });
  var nomClient = function (cid) { var c = DB.clients.find(function (x) { return x.id === cid; }); return c ? c.entreprise : '(client supprime)'; };
  var totFact = rows.reduce(function (s, f) { return s + Number(f.montant || 0); }, 0);
  var totPaye = rows.filter(function (f) { return f.statut === 'payee'; }).reduce(function (s, f) { return s + Number(f.montant || 0); }, 0);
  var nbImp = rows.filter(function (f) { return f.statut !== 'payee'; }).length;
  el('content').innerHTML =
    '<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
    '<div class="kpi"><div class="v">' + eur(totFact) + '</div><div class="l">Total facture</div></div>' +
    '<div class="kpi green"><div class="v">' + eur(totPaye) + '</div><div class="l">Encaisse</div></div>' +
    '<div class="kpi gold"><div class="v">' + eur(totFact - totPaye) + '</div><div class="l">En attente</div><div class="s">' + nbImp + ' facture(s)</div></div>' +
    '<div class="kpi"><div class="v">' + rows.length + '</div><div class="l">Factures</div></div>' +
    '</div>' +
    '<div class="card"><h2>Historique des factures</h2>' +
    (rows.length ? '<table class="tbl"><tr><th>Client</th><th>Numero</th><th>Montant</th><th>Date</th><th>Statut</th></tr>' +
      rows.map(function (f) {
        return '<tr><td class="click" onclick="dossierClient(\'' + f.client_id + '\')"><b>' + esc(nomClient(f.client_id)) + '</b></td>' +
          '<td>' + esc(f.numero || '-') + '</td><td><b>' + eur(Number(f.montant || 0)) + '</b></td>' +
          '<td>' + (f.date_facture ? fmtDate(f.date_facture) : fmtDate(f.created_at)) + '</td>' +
          '<td><select onchange="setFactureStatut(\'' + f.id + '\', this.value)" style="width:auto;padding:5px 8px;font-size:12px">' +
          ['envoyee', 'payee'].map(function (s) { return '<option value="' + s + '"' + (f.statut === s ? ' selected' : '') + '>' + (s === 'payee' ? 'Payee' : 'Envoyee') + '</option>'; }).join('') + '</select></td></tr>';
      }).join('') + '</table>' : '<div class="empty">Aucune facture. Ajoute-les depuis le dossier d\'un client (carte Factures).</div>') +
    '</div>';
}
window.setFactureStatut = async function (id, statut) {
  var res = await sb().from('web_factures').update({ statut: statut }).eq('id', id);
  if (dbFail(res, 'Statut non enregistre')) return;
  await loadAll(); if (VIEW === 'factures') rFactures();
};

/* ═════════ CLIENTS / APRES-VENTE (phase 4) ═════════ */
function rClients() {
  var mrr = (DB.hebergements || []).reduce(function (t, h) { return t + Number(h.abonnement_mensuel || 0); }, 0);
  var bientot = (DB.hebergements || []).filter(function (h) {
    return h.date_renouvellement && h.date_renouvellement <= addDays(todayISO(), 30);
  });
  el('content').innerHTML =
    '<div class="grid g3" style="margin-bottom:16px">' +
    '<div class="kpi green"><div class="v">' + eur(mrr) + '</div><div class="l">Abonnements / mois</div><div class="s">revenu recurrent</div></div>' +
    '<div class="kpi ' + (bientot.length ? 'gold' : '') + '"><div class="v">' + bientot.length + '</div><div class="l">Renouvellements < 30 j</div><div class="s">domaines / hebergements</div></div>' +
    '<div class="kpi"><div class="v">' + DB.clients.length + '</div><div class="l">Clients au fichier</div><div class="s">tous statuts</div></div>' +
    '</div>' +
    '<div class="card"><h2>Fichier clients</h2>' +
    (DB.clients.length ? '<table class="tbl"><tr><th>Entreprise</th><th>Pipeline</th><th>Domaine</th><th>Renouvellement</th><th>Abo / mois</th></tr>' +
      DB.clients.map(function (c) {
        var h = (DB.hebergements || []).find(function (x) { return x.client_id === c.id; });
        var renouvProche = h && h.date_renouvellement && h.date_renouvellement <= addDays(todayISO(), 30);
        return '<tr class="click" onclick="dossierClient(\'' + c.id + '\')"><td><b>' + esc(c.entreprise) + '</b><div style="font-size:11.5px;color:var(--mut2)">' + esc(c.ville || '') + '</div></td>' +
          '<td><span class="chip blue">' + esc(c.statut_pipeline || '') + '</span></td>' +
          '<td>' + esc(h && h.nom_domaine || '') + '</td>' +
          '<td>' + (h && h.date_renouvellement ? (renouvProche ? '<span class="chip gold">' : '<span class="chip gray">') + fmtDate(h.date_renouvellement) + '</span>' : '') + '</td>' +
          '<td>' + (h && h.abonnement_mensuel ? '<b>' + eur(h.abonnement_mensuel) + '</b>' : '') + '</td></tr>';
      }).join('') + '</table>' : '<div class="empty">Aucun client</div>') + '</div>';
}

var DOSS = null; // { client, heberg, liens, acces, interactions }
window.dossierClient = async function (id) {
  var q = await Promise.all([
    sb().from('web_clients').select('*').eq('id', id).single(),
    sb().from('web_hebergements').select('*').eq('client_id', id).maybeSingle(),
    sb().from('web_liens').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    sb().from('web_acces').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    sb().from('web_interactions').select('*').eq('client_id', id).order('date', { ascending: false })
  ]);
  DOSS = { client: q[0].data, heberg: q[1].data, liens: q[2].data || [], acces: q[3].data || [], interactions: q[4].data || [] };
  rDossier();
};

function rDossier() {
  var c = DOSS.client, h = DOSS.heberg || {};
  var PIPE = ['contacte', 'rdv_pris', 'rdv_fait', 'devis_envoye', 'signe', 'en_production', 'en_ligne', 'perdu'];
  el('tb-title').textContent = c.entreprise;
  el('content').innerHTML =
    '<button class="btn ghost sm" onclick="go(\'clients\')" style="margin-bottom:14px">&larr; Fichier clients</button>' +
    '<div class="grid g2">' +

    '<div class="card"><h2>Fiche</h2>' +
    '<div class="grid g2"><div><label class="lbl" style="margin-top:0">Entreprise</label><input type="text" id="d-ent" value="' + esc(c.entreprise || '') + '"></div>' +
    '<div><label class="lbl" style="margin-top:0">Contact</label><input type="text" id="d-contact" value="' + esc(c.contact_nom || '') + '"></div>' +
    '<div><label class="lbl">Telephone</label><input type="tel" id="d-tel" value="' + esc(c.telephone || '') + '"></div>' +
    '<div><label class="lbl">Email</label><input type="email" id="d-mail" value="' + esc(c.email || '') + '"></div></div>' +
    '<label class="lbl">Pipeline</label><select id="d-pipe">' + PIPE.map(function (p) {
      return '<option value="' + p + '"' + (c.statut_pipeline === p ? ' selected' : '') + '>' + p + '</option>';
    }).join('') + '</select>' +
    '<label class="lbl">Notes</label><textarea id="d-notes">' + esc(c.notes || '') + '</textarea>' +
    '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="btn" onclick="saveDossierFiche()">Enregistrer</button>' +
    '<button class="btn gold" onclick="UsineUI.open(\'' + c.id + '\')">Ouvrir l\'atelier</button></div></div>' +

    '<div class="card"><h2>Domaine, hebergement, abonnement</h2>' +
    '<div class="grid g2"><div><label class="lbl" style="margin-top:0">Nom de domaine</label><input type="text" id="d-dom" value="' + esc(h.nom_domaine || '') + '" placeholder="entreprise.fr"></div>' +
    '<div><label class="lbl" style="margin-top:0">Hebergeur</label><input type="text" id="d-heb" value="' + esc(h.hebergeur || 'OVH') + '"></div>' +
    '<div><label class="lbl">Renouvellement le</label><input type="date" id="d-renouv" value="' + esc(h.date_renouvellement || '') + '"></div>' +
    '<div><label class="lbl">Cout annuel (\u20AC)</label><input type="number" step="0.01" id="d-cout" value="' + esc(h.cout_annuel || '') + '"></div>' +
    '<div><label class="lbl">Abonnement mensuel (\u20AC)</label><input type="number" step="0.01" id="d-abo" value="' + esc(h.abonnement_mensuel || '') + '"></div>' +
    '<div><label class="lbl">Notes abo</label><input type="text" id="d-abonotes" value="' + esc(h.abonnement_notes || '') + '" placeholder="maintenance, SEO..."></div></div>' +
    '<div style="margin-top:12px"><button class="btn" onclick="saveDossierHeberg()">Enregistrer</button></div></div>' +

    '<div class="card"><h2>Liens</h2><div id="d-liens">' + rLiensHtml() + '</div>' +
    '<div class="grid g2" style="margin-top:8px"><input type="text" id="l-lib" placeholder="Libelle (Apercu, Site en ligne...)"><input type="text" id="l-url" placeholder="https://..."></div>' +
    '<div style="margin-top:10px"><button class="btn ghost sm" onclick="addLien()">Ajouter le lien</button></div></div>' +

    '<div class="card"><h2>Acces (interne)</h2><div id="d-acces">' + rAccesHtml() + '</div>' +
    '<div class="grid g2" style="margin-top:8px">' +
    '<select id="a-type"><option value="hebergeur">Hebergeur</option><option value="domaine">Domaine</option><option value="github">GitHub</option><option value="email">Email</option><option value="autre">Autre</option></select>' +
    '<input type="text" id="a-lib" placeholder="Libelle">' +
    '<input type="text" id="a-id" placeholder="Identifiant">' +
    '<input type="text" id="a-secret" placeholder="Mot de passe / cle"></div>' +
    '<div style="margin-top:10px"><button class="btn ghost sm" onclick="addAcces()">Ajouter l\'acces</button></div></div>' +

    '<div class="card" style="grid-column:1/-1"><h2>Devis</h2><div id="d-devis">' + rDevisHtml() + '</div>' +
    '<div style="margin-top:10px"><button class="btn gold sm" onclick="openDevisForm()">Nouveau devis</button></div></div>' +

    '<div class="card" style="grid-column:1/-1"><h2>Factures</h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:8px">Glisse la facture Indy (PDF) : l\'IA lit le montant, tu valides, et tu suis qui a paye.</div>' +
    '<div id="d-factures">' + rFacturesClientHtml() + '</div>' +
    '<div class="drop" ondragover="event.preventDefault()" ondrop="event.preventDefault();ajoutFacture(event.dataTransfer.files)" onclick="document.getElementById(\'f-fi\').click()" style="border:2px dashed var(--line2);border-radius:10px;padding:20px 16px;text-align:center;color:var(--mut);cursor:pointer;background:var(--bg2);margin-top:10px">Glisse une facture PDF ici ou clique<br><span style="font-size:11px">l\'IA lira le montant</span></div>' +
    '<input type="file" id="f-fi" accept="application/pdf" style="display:none" onchange="ajoutFacture(this.files)"></div>' +

    '<div class="card" style="grid-column:1/-1"><h2>Historique</h2>' +
    '<div style="display:flex;gap:8px;margin-bottom:10px"><input type="text" id="i-note-add" placeholder="Ajouter une note (appel, decision, souci...)" style="flex:1">' +
    '<button class="btn ghost sm" onclick="addInteraction()">Noter</button></div>' +
    '<div id="d-histo">' + rHistoHtml() + '</div></div>' +
    '</div>';
}
function rLiensHtml() {
  return DOSS.liens.filter(function (l) { return l.libelle !== '__checklist__'; }).map(function (l) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">' +
      '<a href="' + esc(l.url) + '" target="_blank" style="flex:1;font-weight:700;font-size:13px;text-decoration:none">' + esc(l.libelle || l.url) + '</a>' +
      '<span style="font-size:11px;color:var(--mut2);overflow:hidden;text-overflow:ellipsis;max-width:220px;white-space:nowrap">' + esc(l.url) + '</span>' +
      '<span style="color:var(--red);cursor:pointer;font-weight:800" onclick="delLien(\'' + l.id + '\')">&times;</span></div>';
  }).join('') || '<div class="empty" style="padding:8px">Aucun lien</div>';
}
function rAccesHtml() {
  return DOSS.acces.map(function (a) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px">' +
      '<span class="chip gray">' + esc(a.type || 'autre') + '</span>' +
      '<b>' + esc(a.libelle || '') + '</b>' +
      '<span style="color:var(--mut)">' + esc(a.identifiant || '') + '</span>' +
      (a.secret ? '<span style="font-family:monospace;color:var(--mut2);cursor:pointer" onclick="this.textContent=this.textContent===\'\u2022\u2022\u2022\u2022\u2022\u2022\'?\'' + esc(a.secret) + '\':\'\u2022\u2022\u2022\u2022\u2022\u2022\'">\u2022\u2022\u2022\u2022\u2022\u2022</span>' : '') +
      '<span style="margin-left:auto;color:var(--red);cursor:pointer;font-weight:800" onclick="delAcces(\'' + a.id + '\')">&times;</span></div>';
  }).join('') || '<div class="empty" style="padding:8px">Aucun acces enregistre</div>';
}
function rHistoHtml() {
  return DOSS.interactions.map(function (i) {
    return '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">' +
      '<span style="color:var(--mut2);flex-shrink:0;width:76px">' + fmtDate(i.date) + '</span>' +
      '<span class="chip gray" style="flex-shrink:0">' + esc(i.type || 'note') + '</span>' +
      '<span>' + esc(i.contenu || '') + '</span></div>';
  }).join('') || '<div class="empty" style="padding:8px">Aucune note</div>';
}
window.saveDossierFiche = async function () {
  var r = await sb().from('web_clients').update({
    entreprise: el('d-ent').value, contact_nom: el('d-contact').value, telephone: el('d-tel').value,
    email: el('d-mail').value, statut_pipeline: el('d-pipe').value, notes: el('d-notes').value,
    updated_at: new Date().toISOString()
  }).eq('id', DOSS.client.id);
  if (r.error) { toast('Erreur : ' + r.error.message, true); return; }
  toast('Fiche enregistree');
  await loadAll();
};
window.saveDossierHeberg = async function () {
  var payload = {
    client_id: DOSS.client.id,
    nom_domaine: el('d-dom').value || null, hebergeur: el('d-heb').value || null,
    date_renouvellement: el('d-renouv').value || null,
    cout_annuel: el('d-cout').value || null,
    abonnement_mensuel: el('d-abo').value || null, abonnement_notes: el('d-abonotes').value || null
  };
  var r;
  if (DOSS.heberg && DOSS.heberg.id) r = await sb().from('web_hebergements').update(payload).eq('id', DOSS.heberg.id);
  else r = await sb().from('web_hebergements').insert(payload);
  if (r.error) { toast('Erreur : ' + r.error.message, true); return; }
  toast('Hebergement enregistre');
  await loadAll(); dossierClient(DOSS.client.id);
};
window.addLien = async function () {
  var url = el('l-url').value.trim();
  if (!url) { toast('Il faut une URL', true); return; }
  await sb().from('web_liens').insert({ client_id: DOSS.client.id, libelle: el('l-lib').value.trim() || null, url: url });
  dossierClient(DOSS.client.id);
};
window.delLien = async function (id) {
  await sb().from('web_liens').delete().eq('id', id);
  dossierClient(DOSS.client.id);
};
window.addAcces = async function () {
  var lib = el('a-lib').value.trim();
  if (!lib && !el('a-id').value.trim()) { toast('Renseigne au moins le libelle', true); return; }
  await sb().from('web_acces').insert({
    client_id: DOSS.client.id, type: el('a-type').value, libelle: lib || null,
    identifiant: el('a-id').value.trim() || null, secret: el('a-secret').value || null
  });
  dossierClient(DOSS.client.id);
};
window.delAcces = async function (id) {
  await sb().from('web_acces').delete().eq('id', id);
  dossierClient(DOSS.client.id);
};
window.addInteraction = async function () {
  var t = el('i-note-add').value.trim();
  if (!t) return;
  await sb().from('web_interactions').insert({ client_id: DOSS.client.id, type: 'note', contenu: t });
  dossierClient(DOSS.client.id);
};

/* ── factures (Indy) : glisser le PDF, l'IA lit le montant, suivi paye/pas paye ── */
function facturesDuClient() {
  return (DB.factures || []).filter(function (f) { return f.client_id === DOSS.client.id; })
    .sort(function (a, b) { return (a.date_facture || a.created_at || '') < (b.date_facture || b.created_at || '') ? 1 : -1; });
}
function factureUrl(path) {
  try { return sb().storage.from('web-usine').getPublicUrl(path).data.publicUrl; } catch (e) { return '#'; }
}
function rFacturesClientHtml() {
  var list = facturesDuClient();
  if (!list.length) return '<div class="empty" style="padding:8px">Aucune facture pour ce client</div>';
  var tot = list.reduce(function (s, f) { return s + Number(f.montant || 0); }, 0);
  var paye = list.filter(function (f) { return f.statut === 'payee'; }).reduce(function (s, f) { return s + Number(f.montant || 0); }, 0);
  return '<table class="tbl"><tr><th>Numero</th><th>Montant</th><th>Date</th><th>Statut</th><th></th></tr>' +
    list.map(function (f) {
      return '<tr><td><b>' + esc(f.numero || '-') + '</b></td><td><b>' + eur(Number(f.montant || 0)) + '</b></td>' +
        '<td>' + (f.date_facture ? fmtDate(f.date_facture) : fmtDate(f.created_at)) + '</td>' +
        '<td><select onchange="setFactureStatut(\'' + f.id + '\', this.value)" style="width:auto;padding:5px 8px;font-size:12px">' +
        ['envoyee', 'payee'].map(function (s) { return '<option value="' + s + '"' + (f.statut === s ? ' selected' : '') + '>' + (s === 'payee' ? 'Payee' : 'Envoyee') + '</option>'; }).join('') + '</select></td>' +
        '<td style="text-align:right;white-space:nowrap">' + (f.fichier ? '<a class="btn ghost sm" target="_blank" href="' + esc(factureUrl(f.fichier)) + '">PDF</a> ' : '') +
        '<span style="color:var(--red);cursor:pointer;font-weight:800;padding:0 4px" onclick="delFacture(\'' + f.id + '\')">&times;</span></td></tr>';
    }).join('') + '</table>' +
    '<div style="text-align:right;font-size:13px;color:var(--mut);margin-top:8px">Facture : <b style="color:var(--ink)">' + eur(tot) + '</b> &middot; Paye : <b style="color:var(--ink)">' + eur(paye) + '</b> &middot; Reste : <b style="color:var(--ink)">' + eur(tot - paye) + '</b></div>';
}
window.ajoutFacture = async function (files) {
  var f = files && files[0];
  if (!f) return;
  if (f.type !== 'application/pdf') { toast('Il faut un PDF', true); return; }
  if (f.size > 15 * 1024 * 1024) { toast('PDF trop lourd (max 15 Mo)', true); return; }
  toast('Lecture de la facture par l\'IA...');
  var nom = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  var path = DOSS.client.id + '/factures/' + Date.now() + '-' + nom;
  var up = null;
  try { up = await sb().storage.from('web-usine').upload(path, f, { upsert: true }); } catch (e) { up = { error: e }; }
  var chemin = (up && !up.error) ? path : '';
  var b64 = await new Promise(function (resolve, reject) { var rd = new FileReader(); rd.onload = function () { resolve(String(rd.result).split(',')[1]); }; rd.onerror = reject; rd.readAsDataURL(f); });
  var montant = '', numero = '', date = '';
  try {
    var r = await fetch('/api/facture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdf_base64: b64 }) });
    var d = await r.json();
    if (r.ok) { montant = (d.montant != null ? d.montant : ''); numero = d.numero || ''; date = d.date || ''; }
  } catch (e) { /* l'IA a echoue : on ouvre quand meme la saisie manuelle */ }
  openMo('Facture — ' + DOSS.client.entreprise,
    '<div class="hint" style="margin-top:0">L\'IA a lu le PDF. Verifie le montant avant d\'enregistrer (jamais devine : corrige si besoin).</div>' +
    (chemin ? '' : '<div class="hint" style="border-color:var(--gold-line);background:var(--gold-soft)">Le PDF n\'a pas pu etre stocke (bucket web-usine absent ou prive) : le suivi marche quand meme, sans le lien vers le PDF.</div>') +
    '<div class="grid g2"><div><label class="lbl" style="margin-top:0">Montant (\u20AC)</label><input type="number" step="0.01" id="f-montant" value="' + esc(montant) + '"></div>' +
    '<div><label class="lbl" style="margin-top:0">Numero</label><input type="text" id="f-numero" value="' + esc(numero) + '"></div>' +
    '<div><label class="lbl">Date</label><input type="date" id="f-date" value="' + esc(date) + '"></div>' +
    '<div><label class="lbl">Statut</label><select id="f-statut"><option value="envoyee">Envoyee</option><option value="payee">Payee</option></select></div></div>' +
    '<input type="hidden" id="f-chemin" value="' + esc(chemin) + '">' +
    '<div style="margin-top:14px"><button class="btn gold" style="width:100%" onclick="saveFacture()">Enregistrer la facture</button></div>');
};
window.saveFacture = async function () {
  var montant = parseFloat(el('f-montant').value);
  if (isNaN(montant)) { toast('Mets le montant', true); return; }
  var res = await sb().from('web_factures').insert({
    client_id: DOSS.client.id, montant: montant,
    numero: el('f-numero').value.trim() || null,
    date_facture: el('f-date').value || null,
    statut: el('f-statut').value,
    fichier: el('f-chemin').value || null
  });
  if (dbFail(res, 'Facture non enregistree (as-tu execute supabase/phase10.sql ?)')) return;
  closeMo(); toast('Facture enregistree');
  await loadAll(); dossierClient(DOSS.client.id);
};
window.delFacture = async function (id) {
  var res = await sb().from('web_factures').delete().eq('id', id);
  if (dbFail(res, 'Suppression refusee')) return;
  await loadAll(); dossierClient(DOSS.client.id);
};

/* ── devis ── */
function devisDuClient() {
  return DB.devis.filter(function (d) { return d.client_id === DOSS.client.id; })
    .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
}
function rDevisHtml() {
  var list = devisDuClient();
  var STATUTS = ['brouillon', 'envoye', 'signe', 'refuse'];
  return list.length ? '<table class="tbl"><tr><th>Numero</th><th>Total HT</th><th>Statut</th><th>Emis le</th><th></th></tr>' +
    list.map(function (d) {
      return '<tr><td><b>' + esc(d.numero) + '</b></td><td>' + eur(d.total_ht || 0) + '</td>' +
        '<td><select onchange="setDevisStatut(\'' + d.id + '\', this.value)" style="width:auto;padding:5px 8px;font-size:12px">' +
        STATUTS.map(function (st) { return '<option value="' + st + '"' + (d.statut === st ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></td>' +
        '<td>' + fmtDate(d.date_emission || d.created_at) + '</td>' +
        '<td style="text-align:right;white-space:nowrap"><button class="btn ghost sm" onclick="printDevis(\'' + d.id + '\')">Imprimer / PDF</button></td></tr>';
    }).join('') + '</table>' : '<div class="empty" style="padding:8px">Aucun devis</div>';
}
function prochainNumeroDevis() {
  var annee = new Date().getFullYear();
  var max = 0;
  DB.devis.forEach(function (d) {
    var m = /DEV-(\d{4})-(\d+)/.exec(d.numero || '');
    if (m && parseInt(m[1]) === annee) max = Math.max(max, parseInt(m[2]));
  });
  return 'DEV-' + annee + '-' + String(max + 1).padStart(4, '0');
}
window.openDevisForm = function () {
  openMo('Nouveau devis — ' + DOSS.client.entreprise,
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:8px">Numero attribue : <b>' + prochainNumeroDevis() + '</b></div>' +
    '<div id="dv-lignes"></div>' +
    '<button class="btn ghost sm" onclick="dvAddLigne()" style="margin-top:6px">+ Ajouter une ligne</button>' +
    '<div class="grid g2" style="margin-top:8px">' +
    '<div><label class="lbl">Acompte (%)</label><input type="number" id="dv-acompte" value="30"></div>' +
    '<div><label class="lbl">Validite (jours)</label><input type="number" id="dv-validite" value="30"></div></div>' +
    '<div style="text-align:right;font-family:\'Newsreader\',serif;font-size:22px;margin-top:10px">Total HT : <span id="dv-total">0 \u20AC</span></div>' +
    '<div style="margin-top:14px"><button class="btn gold" style="width:100%" onclick="saveDevis()">Creer le devis</button></div>');
  dvAddLigne('Site internet - formule Essentiel', 1, 490);
};
window.dvAddLigne = function (des, qte, pu) {
  var box = el('dv-lignes');
  var div = document.createElement('div');
  div.className = 'grid';
  div.style.cssText = 'grid-template-columns:1fr 70px 100px 24px;gap:6px;margin-top:6px;align-items:center';
  div.innerHTML =
    '<input type="text" class="dv-des" placeholder="Designation" value="' + esc(des || '') + '">' +
    '<input type="number" class="dv-qte" value="' + (qte || 1) + '" oninput="dvTotal()">' +
    '<input type="number" step="0.01" class="dv-pu" placeholder="PU HT" value="' + (pu || '') + '" oninput="dvTotal()">' +
    '<span style="color:var(--red);cursor:pointer;font-weight:800;text-align:center" onclick="this.parentNode.remove();dvTotal()">&times;</span>';
  box.appendChild(div);
  dvTotal();
};
window.dvTotal = function () {
  var t = 0;
  document.querySelectorAll('#dv-lignes > div').forEach(function (r) {
    t += (parseFloat(r.querySelector('.dv-qte').value) || 0) * (parseFloat(r.querySelector('.dv-pu').value) || 0);
  });
  if (el('dv-total')) el('dv-total').textContent = eur(t);
  return t;
};
window.saveDevis = async function () {
  var lignes = [];
  document.querySelectorAll('#dv-lignes > div').forEach(function (r) {
    var des = r.querySelector('.dv-des').value.trim();
    if (!des) return;
    lignes.push({ designation: des, quantite: parseFloat(r.querySelector('.dv-qte').value) || 1, pu_ht: parseFloat(r.querySelector('.dv-pu').value) || 0 });
  });
  if (!lignes.length) { toast('Ajoute au moins une ligne', true); return; }
  var r = await sb().from('web_devis').insert({
    client_id: DOSS.client.id, numero: prochainNumeroDevis(), lignes: lignes,
    total_ht: dvTotal(), acompte_pct: parseFloat(el('dv-acompte').value) || 0,
    validite: parseInt(el('dv-validite').value) || 30,
    statut: 'brouillon', date_emission: todayISO()
  });
  closeMo();
  if (r.error) { toast('Erreur : ' + r.error.message, true); return; }
  toast('Devis cree');
  await loadAll(); dossierClient(DOSS.client.id);
};
window.setDevisStatut = async function (id, statut) {
  await sb().from('web_devis').update({ statut: statut }).eq('id', id);
  toast('Statut : ' + statut);
  await loadAll();
};
window.printDevis = function (id) {
  var d = DB.devis.find(function (x) { return x.id === id; });
  if (!d) return;
  var c = DOSS.client;
  var lignes = d.lignes || [];
  var total = Number(d.total_ht || 0);
  var acompte = Math.round(total * (Number(d.acompte_pct || 0) / 100) * 100) / 100;
  var w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(d.numero) + '</title>' +
    '<style>body{font-family:Arial,sans-serif;color:#26221A;max-width:760px;margin:36px auto;font-size:14px;line-height:1.5}' +
    'h1{font-size:26px;margin:0}.gold{color:#C8900A}.head{display:flex;justify-content:space-between;margin-bottom:30px}' +
    'table{width:100%;border-collapse:collapse;margin:22px 0}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #26221A;padding:8px 6px}' +
    'td{padding:9px 6px;border-bottom:1px solid #EAE4D6}.tot{text-align:right;font-size:18px;margin-top:8px}' +
    '.foot{margin-top:40px;font-size:11.5px;color:#8B8371}.sig{margin-top:44px;display:flex;justify-content:space-between;gap:30px}' +
    '.sig div{flex:1;border-top:1px solid #26221A;padding-top:6px;font-size:12px}</style></head><body>' +
    '<div class="head"><div><h1>Nova<span class="gold">lem</span></h1><div style="font-size:12px;color:#8B8371">' + esc((DB.societe && DB.societe.raison_sociale) || 'Creation de sites internet - Guadeloupe') + '<br>' + esc((DB.societe && DB.societe.adresse) || '') + (DB.societe && DB.societe.adresse ? '<br>' : '') + esc((DB.societe && DB.societe.email) || 'contact@recrutement-novalem.fr') + (DB.societe && DB.societe.telephone ? ' - ' + esc(DB.societe.telephone) : '') + (DB.societe && DB.societe.siret ? '<br>SIRET : ' + esc(DB.societe.siret) : '') + '</div></div>' +
    '<div style="text-align:right"><div style="font-size:20px;font-weight:800">DEVIS ' + esc(d.numero) + '</div>' +
    '<div style="font-size:12px;color:#8B8371">Emis le ' + fmtDate(d.date_emission || d.created_at) + ' · valable ' + (d.validite || 30) + ' jours</div></div></div>' +
    '<div><b>' + esc(c.entreprise) + '</b><br>' + esc(c.contact_nom || '') + '<br>' + esc(c.email || '') + ' · ' + esc(c.telephone || '') + '</div>' +
    '<table><tr><th>Designation</th><th style="text-align:center">Qte</th><th style="text-align:right">PU HT</th><th style="text-align:right">Total HT</th></tr>' +
    lignes.map(function (l) {
      return '<tr><td>' + esc(l.designation) + '</td><td style="text-align:center">' + l.quantite + '</td>' +
        '<td style="text-align:right">' + eur(l.pu_ht) + '</td><td style="text-align:right">' + eur(l.quantite * l.pu_ht) + '</td></tr>';
    }).join('') + '</table>' +
    '<div class="tot"><b>Total HT : ' + eur(total) + '</b><br><span style="font-size:13px">TVA non applicable, art. 293 B du CGI</span>' +
    (acompte ? '<br><span style="font-size:14px">Acompte a la commande (' + d.acompte_pct + '%) : <b>' + eur(acompte) + '</b></span>' : '') + '</div>' +
    '<div class="sig"><div>Bon pour accord - le client<br>(date + signature)</div><div>' + esc((DB.societe && DB.societe.raison_sociale) || 'NOVALEM - Louis Renault') + '</div></div>' + (DB.societe && DB.societe.iban ? '<div style="margin-top:16px;font-size:12.5px"><b>Reglement de l\'acompte par virement :</b> IBAN ' + esc(DB.societe.iban) + (DB.societe.bic ? ' - BIC ' + esc(DB.societe.bic) : '') + '</div>' : '') +
    '<div class="foot">' + esc((DB.societe && DB.societe.mentions) || 'TVA non applicable, art. 293 B du CGI. Reglement : acompte a la commande, solde avant mise en ligne.') + '</div>' +
    '<script>window.print()<\/script></body></html>');
  w.document.close();
};


/* ═══ PIPELINE (kanban) ═══ */
var PIPE_ETAPES = [
  ['contacte', 'Contacte'], ['rdv_pris', 'RDV pris'], ['rdv_fait', 'RDV fait'],
  ['devis_envoye', 'Devis envoye'], ['signe', 'Signe'], ['en_production', 'En production'],
  ['en_ligne', 'En ligne'], ['perdu', 'Perdu']
];
function rPipeline() {
  var cols = PIPE_ETAPES.map(function (et, idx) {
    var clients = DB.clients.filter(function (c) { return (c.statut_pipeline || 'contacte') === et[0]; });
    var ca = clients.reduce(function (t, c) { return t + caClient(c); }, 0);
    return '<div class="pcol' + (et[0] === 'perdu' ? ' perdu' : '') + '">' +
      '<div class="pcol-h">' + et[1] + '<span class="pcol-n">' + clients.length + '</span>' +
      (et[0] !== 'perdu' && clients.length ? '<span class="pcol-ca">' + eur(ca) + '</span>' : '') + '</div>' +
      clients.map(function (c) {
        return '<div class="pcard">' +
          '<div class="pc-nom" onclick="dossierClient(\'' + c.id + '\')">' + esc(c.entreprise) + '</div>' +
          '<div class="pc-sub">' + esc(c.ville || '') + '</div>' +
          '<div class="pc-nav">' +
          (idx > 0 ? '<span onclick="movePipe(\'' + c.id + '\', -1)">&larr;</span>' : '<span class="off">&larr;</span>') +
          '<span style="flex:1"></span>' +
          (idx < PIPE_ETAPES.length - 1 ? '<span onclick="movePipe(\'' + c.id + '\', 1)">&rarr;</span>' : '<span class="off">&rarr;</span>') +
          '</div></div>';
      }).join('') +
      (clients.length ? '' : '<div class="pcol-empty">vide</div>') + '</div>';
  }).join('');
  el('content').innerHTML =
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:10px">Les fleches deplacent un client d\'etape en etape. Clic sur le nom = son dossier. Les prospects pas encore en RDV restent dans la Session d\'appel ; ils arrivent ici des que le RDV est pris.</div>' +
    '<div class="pipe">' + cols + '</div>';
}
window.movePipe = async function (id, dir) {
  var c = DB.clients.find(function (x) { return x.id === id; });
  if (!c) return;
  var idx = PIPE_ETAPES.findIndex(function (e) { return e[0] === (c.statut_pipeline || 'contacte'); });
  var next = PIPE_ETAPES[Math.max(0, Math.min(PIPE_ETAPES.length - 1, idx + dir))][0];
  c.statut_pipeline = next;
  rPipeline();
  await sb().from('web_clients').update({ statut_pipeline: next, updated_at: new Date().toISOString() }).eq('id', id);
  loadAll();
};

/* ═══ MA SOCIETE (infos compta) ═══ */
var SOC_CHAMPS = [
  ['raison_sociale', 'Raison sociale', 'NOVALEM - Louis Renault EI'],
  ['siret', 'SIRET', ''],
  ['adresse', 'Adresse du siege', ''],
  ['email', 'Email', 'contact@recrutement-novalem.fr'],
  ['telephone', 'Telephone', ''],
  ['iban', 'IBAN', 'FR76 ...'],
  ['bic', 'BIC', ''],
  ['mentions', 'Mentions en pied de devis', 'TVA non applicable, art. 293 B du CGI']
];
function rSociete() {
  var so = DB.societe || {};
  el('content').innerHTML =
    '<div class="card" style="max-width:640px"><h2>Infos de la societe</h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:6px">Ces infos alimentent automatiquement les devis (en-tete, SIRET, IBAN pour l\'acompte). A remplir une fois.</div>' +
    SOC_CHAMPS.map(function (ch) {
      return '<label class="lbl">' + ch[1] + '</label><input type="text" id="so-' + ch[0] + '" value="' + esc(so[ch[0]] || '') + '" placeholder="' + esc(ch[2]) + '">';
    }).join('') +
    '<div style="margin-top:14px"><button class="btn" onclick="saveSociete()">Enregistrer</button></div></div>';
}
window.saveSociete = async function () {
  var payload = {};
  SOC_CHAMPS.forEach(function (ch) { payload[ch[0]] = el('so-' + ch[0]).value.trim() || null; });
  var r;
  if (DB.societe && DB.societe.id) r = await sb().from('web_societe').update(payload).eq('id', DB.societe.id);
  else r = await sb().from('web_societe').insert(payload);
  if (r.error) { toast('Execute d\'abord supabase/phase6.sql (' + r.error.message + ')', true); return; }
  toast('Infos enregistrees : elles apparaitront sur les devis');
  await loadAll();
};

/* ── exports globaux ─────────────────────────────────── */
window.go = go; window.closeMo = closeMo; window.logout = logout;
window.refreshApp = refreshApp;
window.issueRdv = issueRdv; window.issueMail = issueMail; window.issueRappeler = issueRappeler;
window.loadAll = loadAll;

boot();
})();
