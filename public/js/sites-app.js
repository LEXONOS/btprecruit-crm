/* NOVALEM SITES — Application de l'espace creation de sites internet.
   Totalement isole du recrutement : aucune table recrutement lue ou ecrite.
   Toutes les donnees transitent par le client Supabase (RLS) sur les tables
   web_*. Aucune dependance a crm-app.js. */
(function () {
'use strict';

// ═══════════════════════════════════════════════════════════════════
// CONFIG SUPABASE (meme projet canonique que le hub / le CRM)
// ═══════════════════════════════════════════════════════════════════
var NOV_SB_URL  = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
var NOV_SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';
var API_BASE    = ''; // meme origine : /api/send-email

var _sb = null;
function getSB() {
  try {
    if (!_sb) { _sb = window.supabase.createClient(NOV_SB_URL, NOV_SB_ANON); }
    return _sb;
  } catch (e) { return null; }
}

function currentUser() {
  if (window.CURRENT_USER) return window.CURRENT_USER;
  try { return JSON.parse(localStorage.getItem('novalem_user') || 'null'); }
  catch (e) { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES METIER
// ═══════════════════════════════════════════════════════════════════
var SIRET = '103 405 247 00018';
var TVA_MENTION = 'TVA non applicable, article 293 B du CGI';
var CESSION_CLAUSE = 'Cession des droits d\'auteur sur le code source livre au client apres paiement integral du prix.';
var ACOMPTE_PCT = 40;

var PIPE_ORDER  = ['prospect', 'contacte', 'devis_envoye', 'signe', 'en_cours', 'livre', 'sav', 'perdu'];
var PIPE_LABELS = {
  prospect: 'Prospect', contacte: 'Contacte', devis_envoye: 'Devis envoye',
  signe: 'Signe', en_cours: 'En cours', livre: 'Livre', sav: 'SAV', perdu: 'Perdu'
};
var PIPE_ACTIVE = ['prospect', 'contacte', 'devis_envoye', 'signe', 'en_cours'];

var FORMULE_LABELS = { essentiel: 'Essentiel', vitrine: 'Vitrine', signature: 'Signature', sur_mesure: 'Sur mesure' };
var FORMULE_PRICE  = { essentiel: 990, vitrine: 1900, signature: 3500, sur_mesure: 0 };

var PROJ_ORDER  = ['cadrage', 'maquette', 'developpement', 'mise_en_ligne', 'livre'];
var PROJ_LABELS = { cadrage: 'Cadrage', maquette: 'Maquette', developpement: 'Developpement', mise_en_ligne: 'Mise en ligne', livre: 'Livre' };

var DEVIS_LABELS = { brouillon: 'Brouillon', envoye: 'Envoye', accepte: 'Accepte', refuse: 'Refuse', expire: 'Expire' };
var FACT_TYPE_LABELS = { acompte: 'Acompte', solde: 'Solde' };
var FACT_LABELS = { brouillon: 'Brouillon', emise: 'Emise', relancee: 'Relancee', payee: 'Payee', annulee: 'Annulee' };

var OPTIONS_CATALOG = [
  'Nom de domaine', 'Hebergement 1 an', 'Redaction de contenu', 'Creation de logo',
  'SEO de base', 'Formulaire de contact', 'Prise de rendez-vous en ligne', 'Site multilingue',
  'Maintenance annuelle', 'Boutique en ligne'
];

// ═══════════════════════════════════════════════════════════════════
// ETAT
// ═══════════════════════════════════════════════════════════════════
var DB = { clients: [], projets: [], devis: [], factures: [], hebergements: [], interactions: [] };
var UI = { view: 'dash', pid: null };
var _dvLines = [];      // lignes de l'editeur de devis en cours
var _dvOptions = [];    // options selectionnees pour le projet en cours
var _sigTimer = null;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function el(id) { return document.getElementById(id); }
function esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmtEUR(n, dec) {
  dec = dec == null ? 0 : dec;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(num(n));
  } catch (e) { return num(n).toFixed(dec) + ' EUR'; }
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString(); }
function addDaysISO(days, from) {
  var d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtDateFR(iso) {
  if (!iso) return '-';
  try {
    var d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) { return iso; }
}
function daysUntil(iso) {
  if (!iso) return null;
  var d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return Math.ceil((d - new Date()) / 86400000);
}
function genToken() {
  try {
    var a = new Uint8Array(18); crypto.getRandomValues(a);
    return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  } catch (e) { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)); }
}

function toast(msg, t) {
  t = t || 's';
  var elx = document.createElement('div');
  elx.className = 'toast t' + t; elx.textContent = msg;
  el('toaster').appendChild(elx);
  setTimeout(function () { elx.classList.add('show'); }, 10);
  setTimeout(function () { elx.classList.remove('show'); setTimeout(function () { elx.remove(); }, 200); }, 2400);
}

function openMo(t, b, f) {
  var mh = el('mhdr'); if (mh) mh.style.display = t ? 'flex' : 'none';
  var mht = el('mht'); if (mht) mht.textContent = t || '';
  el('mb').innerHTML = b || '';
  var mff = el('mf');
  if (f === '' || f === undefined) { mff.innerHTML = ''; mff.style.display = 'none'; }
  else { mff.innerHTML = f; mff.style.display = ''; }
  el('mo').classList.add('open');
}
function closeMo() { el('mo').classList.remove('open'); }
function openPanel() { el('panel').classList.add('open'); }
function closePanel() { el('panel').classList.remove('open'); UI.pid = null; }

// ── acces par id ──
function clientById(id) { return DB.clients.find(function (c) { return c.id === id; }); }
function projetById(id) { return DB.projets.find(function (p) { return p.id === id; }); }
function devisById(id) { return DB.devis.find(function (d) { return d.id === id; }); }
function factureById(id) { return DB.factures.find(function (f) { return f.id === id; }); }
function projetsOfClient(id) { return DB.projets.filter(function (p) { return p.client_id === id; }); }
function devisOfClient(id) { return DB.devis.filter(function (d) { return d.client_id === id; }); }
function facturesOfClient(id) { return DB.factures.filter(function (f) { return f.client_id === id; }); }
function hebergOfClient(id) { return DB.hebergements.filter(function (h) { return h.client_id === id; }); }
function interactionsOfClient(id) {
  return DB.interactions.filter(function (i) { return i.client_id === id; })
    .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
}

// ═══════════════════════════════════════════════════════════════════
// CHARGEMENT DES DONNEES (tables web_ uniquement)
// ═══════════════════════════════════════════════════════════════════
async function loadAll() {
  var sb = getSB();
  if (!sb) { toast('Connexion indisponible', 'e'); return; }
  try {
    var res = await Promise.all([
      sb.from('web_clients').select('*').order('updated_at', { ascending: false }),
      sb.from('web_projets').select('*').order('created_at', { ascending: false }),
      sb.from('web_devis').select('*').order('created_at', { ascending: false }),
      sb.from('web_factures').select('*').order('created_at', { ascending: false }),
      sb.from('web_hebergements').select('*').order('date_renouvellement', { ascending: true }),
      sb.from('web_interactions').select('*').order('date', { ascending: false })
    ]);
    var err = res.find(function (r) { return r.error; });
    if (err && err.error) { console.warn('[sites] load', err.error); toast('Erreur de chargement : ' + err.error.message, 'e'); }
    DB.clients = res[0].data || [];
    DB.projets = res[1].data || [];
    DB.devis = res[2].data || [];
    DB.factures = res[3].data || [];
    DB.hebergements = res[4].data || [];
    DB.interactions = res[5].data || [];
  } catch (e) { console.warn(e); toast('Erreur reseau au chargement', 'e'); }
}
async function reload() { await loadAll(); go(UI.view); }

// ═══════════════════════════════════════════════════════════════════
// NUMEROTATION (RPC atomique, propre au web)
// ═══════════════════════════════════════════════════════════════════
async function nextNumber(kind) {
  var sb = getSB();
  var year = new Date().getFullYear();
  try {
    var r = await sb.rpc('web_next_number', { p_kind: kind, p_annee: year });
    if (!r.error && r.data) return r.data;
  } catch (e) { /* repli ci-dessous */ }
  // Repli best-effort si la RPC n'est pas disponible
  var list = kind === 'FAC' ? DB.factures : DB.devis;
  var max = 0;
  list.forEach(function (x) {
    var m = (x.numero || '').match(new RegExp('^' + kind + '-' + year + '-(\\d+)$'));
    if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return kind + '-' + year + '-' + String(max + 1).padStart(4, '0');
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
function go(v) {
  UI.view = v;
  var nis = document.querySelectorAll('.ni');
  for (var i = 0; i < nis.length; i++) { nis[i].classList.toggle('act', nis[i].getAttribute('data-v') === v); }
  var vs = document.querySelectorAll('.view');
  for (var j = 0; j < vs.length; j++) { vs[j].classList.remove('active'); }
  var target = el('view-' + v); if (target) target.classList.add('active');

  var T = { dash: 'Tableau de bord', pipeline: 'Pipeline de prospection', devis: 'Devis', factures: 'Factures', projets: 'Projets', hebergement: 'Hebergement et domaines' };
  el('tbt').textContent = T[v] || v;

  var A = {
    pipeline: '<button class="btn bp bsm" onclick="openClientForm()">+ Client</button>',
    devis: '<button class="btn bp bsm" onclick="openDevisForm()">+ Devis</button>',
    factures: '<button class="btn bp bsm" onclick="openFactureForm()">+ Facture</button>',
    projets: '<button class="btn bp bsm" onclick="openProjetForm()">+ Projet</button>',
    hebergement: '<button class="btn bp bsm" onclick="openHebergForm()">+ Hebergement</button>'
  };
  el('tba').innerHTML = A[v] || '';

  var R = { dash: renderDash, pipeline: renderPipeline, devis: renderDevis, factures: renderFactures, projets: renderProjets, hebergement: renderHebergement };
  if (R[v]) R[v]();
  badges();
}

function badges() {
  var pipe = DB.clients.filter(function (c) { return PIPE_ACTIVE.indexOf(c.statut_pipeline) >= 0; }).length;
  var dv = DB.devis.filter(function (d) { return d.statut === 'envoye'; }).length;
  var fa = DB.factures.filter(function (f) { return f.statut === 'emise' || f.statut === 'relancee'; }).length;
  var pj = DB.projets.filter(function (p) { return p.statut !== 'livre'; }).length;
  var hb = DB.hebergements.filter(function (h) { var d = daysUntil(h.date_renouvellement); return d != null && d <= 30; }).length;

  setBadge('badge-pipe', pipe, false);
  setBadge('badge-devis', dv, false);
  setBadge('badge-fact', fa, true);
  setBadge('badge-proj', pj, false);
  setBadge('badge-heb', hb, true);

  var ca = DB.devis.filter(function (d) { return d.statut === 'accepte'; }).reduce(function (a, d) { return a + num(d.total_ht); }, 0);
  el('nf-ca').textContent = fmtEUR(ca);
}
function setBadge(id, n, hideIfZero) {
  var b = el(id); if (!b) return;
  b.textContent = n;
  if (hideIfZero) b.style.display = n ? '' : 'none';
}

// ═══════════════════════════════════════════════════════════════════
// TABLEAU DE BORD
// ═══════════════════════════════════════════════════════════════════
function renderDash() {
  var prospects = DB.clients.filter(function (c) { return c.statut_pipeline === 'prospect' || c.statut_pipeline === 'contacte'; }).length;
  var devisEnv = DB.devis.filter(function (d) { return d.statut === 'envoye'; }).length;
  var accept = DB.devis.filter(function (d) { return d.statut === 'accepte'; }).length;
  var decided = DB.devis.filter(function (d) { return ['envoye', 'accepte', 'refuse', 'expire'].indexOf(d.statut) >= 0; }).length;
  var taux = decided ? Math.round(accept / decided * 100) : 0;
  var caSigne = DB.devis.filter(function (d) { return d.statut === 'accepte'; }).reduce(function (a, d) { return a + num(d.total_ht); }, 0);
  var projEnCours = DB.projets.filter(function (p) { return p.statut !== 'livre'; }).length;
  var livres = DB.projets.filter(function (p) { return p.statut === 'livre'; }).length;

  // echeances a venir : renouvellements hebergement + factures a echeance
  var ech = [];
  DB.hebergements.forEach(function (h) {
    var d = daysUntil(h.date_renouvellement);
    if (d != null && d <= 60) ech.push({ d: d, label: 'Renouvellement ' + (h.nom_domaine || 'domaine'), sub: clientName(h.client_id), date: h.date_renouvellement });
  });
  DB.factures.forEach(function (f) {
    if (f.statut === 'emise' || f.statut === 'relancee') {
      var d = daysUntil(f.date_echeance);
      if (d != null && d <= 60) ech.push({ d: d, label: 'Facture ' + f.numero + ' (' + fmtEUR(f.montant_ht) + ')', sub: clientName(f.client_id), date: f.date_echeance });
    }
  });
  ech.sort(function (a, b) { return (a.d == null ? 999 : a.d) - (b.d == null ? 999 : b.d); });

  var kpis =
    kpi(prospects, 'Prospects', 'a contacter / relancer') +
    kpi(devisEnv, 'Devis envoyes', 'en attente de reponse') +
    kpi(taux + '%', 'Taux de conversion', accept + ' accepte(s) / ' + decided) +
    kpi(fmtEUR(caSigne), 'CA signe HT', 'devis acceptes') +
    kpi(projEnCours, 'Projets en cours', 'cadrage a mise en ligne') +
    kpi(livres, 'Sites livres', 'total');

  var recentsDevis = DB.devis.slice(0, 6).map(function (d) {
    return '<tr onclick="openDevisPanel(\'' + d.id + '\')"><td>' + esc(d.numero) + '</td><td>' + esc(clientName(d.client_id)) + '</td><td>' + fmtEUR(d.total_ht) + '</td><td>' + statutDevisPill(d.statut) + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="empty">Aucun devis</td></tr>';

  var relances = DB.factures.filter(function (f) { return f.statut === 'emise' || f.statut === 'relancee'; }).slice(0, 6).map(function (f) {
    var d = daysUntil(f.date_echeance);
    var late = d != null && d < 0;
    return '<tr onclick="go(\'factures\')"><td>' + esc(f.numero) + '</td><td>' + esc(clientName(f.client_id)) + '</td><td>' + fmtEUR(f.montant_ht) + '</td><td style="color:' + (late ? 'var(--red)' : 'var(--mu)') + '">' + (f.date_echeance ? fmtDateFR(f.date_echeance) + (late ? ' (retard)' : '') : '-') + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="empty">Aucune facture a suivre</td></tr>';

  var echHtml = ech.slice(0, 8).map(function (e) {
    var col = e.d == null ? 'var(--mu)' : (e.d < 0 ? 'var(--red)' : (e.d <= 15 ? 'var(--orange)' : 'var(--mu)'));
    return '<div class="board-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)"><div><div style="font-size:11px;color:var(--tx)">' + esc(e.label) + '</div><div style="font-size:10px;color:var(--mu2)">' + esc(e.sub) + '</div></div><div style="font-size:10px;color:' + col + ';text-align:right">' + fmtDateFR(e.date) + '<br>' + (e.d == null ? '' : (e.d < 0 ? Math.abs(e.d) + 'j de retard' : 'dans ' + e.d + 'j')) + '</div></div>';
  }).join('') || '<div class="empty">Aucune echeance dans les 60 jours</div>';

  el('view-dash').innerHTML =
    '<div class="sw-kpis">' + kpis + '</div>' +
    '<div class="g2" style="align-items:start">' +
      '<div>' +
        card('Devis recents', '<table class="tbl"><thead><tr><th>Numero</th><th>Client</th><th>Total HT</th><th>Statut</th></tr></thead><tbody>' + recentsDevis + '</tbody></table>') +
        '<div style="height:14px"></div>' +
        card('Factures a suivre', '<table class="tbl"><thead><tr><th>Numero</th><th>Client</th><th>Montant</th><th>Echeance</th></tr></thead><tbody>' + relances + '</tbody></table>') +
      '</div>' +
      '<div>' + card('Echeances a venir', echHtml) + '</div>' +
    '</div>';
}
function kpi(v, l, s) {
  return '<div class="kpi"><div class="kpi-v">' + v + '</div><div class="kpi-l">' + esc(l) + '</div>' + (s ? '<div class="kpi-s">' + esc(s) + '</div>' : '') + '</div>';
}
function card(title, body) {
  return '<div style="background:var(--s1);border:1px solid var(--bd);border-radius:var(--r2);padding:14px 16px"><div class="syne" style="font-weight:700;font-size:12px;margin-bottom:10px">' + esc(title) + '</div>' + body + '</div>';
}
function clientName(id) { var c = clientById(id); return c ? c.entreprise : '(client supprime)'; }

// ═══════════════════════════════════════════════════════════════════
// PIPELINE (kanban)
// ═══════════════════════════════════════════════════════════════════
function renderPipeline() {
  var cols = PIPE_ORDER.map(function (st) {
    var items = DB.clients.filter(function (c) { return c.statut_pipeline === st; });
    var cards = items.map(function (c) {
      var idxc = PIPE_ORDER.indexOf(c.statut_pipeline);
      var prevBtn = idxc > 0 ? '<span class="btn bg bxs" title="Reculer" onclick="event.stopPropagation();moveClient(\'' + c.id + '\',-1)">&larr;</span>' : '';
      var nextBtn = idxc < PIPE_ORDER.length - 1 ? '<span class="btn bg bxs" title="Avancer" onclick="event.stopPropagation();moveClient(\'' + c.id + '\',1)">&rarr;</span>' : '';
      var nDevis = devisOfClient(c.id).length;
      return '<div class="sw-card" onclick="openClientPanel(\'' + c.id + '\')">' +
        '<div class="sw-card-t">' + esc(c.entreprise) + '</div>' +
        '<div class="sw-card-m">' + esc(c.contact_nom || '') + (c.ville ? ' &middot; ' + esc(c.ville) : '') + '</div>' +
        '<div class="sw-card-ft"><span style="font-size:9px;color:var(--mu2)">' + (nDevis ? nDevis + ' devis' : (c.secteur ? esc(c.secteur) : '')) + '</span><span style="display:flex;gap:4px">' + prevBtn + nextBtn + '</span></div>' +
      '</div>';
    }).join('') || '<div class="empty" style="padding:10px">-</div>';
    return '<div class="kbc">' +
      '<div class="kbh sw-kh k-' + st + '"><span class="kbh-t">' + esc(PIPE_LABELS[st]) + '</span><span class="kbh-n">' + items.length + '</span></div>' +
      '<div class="kbcards">' + cards + '</div>' +
    '</div>';
  }).join('');
  el('view-pipeline').innerHTML = '<div class="kb" style="grid-template-columns:repeat(' + PIPE_ORDER.length + ',minmax(210px,1fr))">' + cols + '</div>';
}

async function moveClient(id, dir) {
  var c = clientById(id); if (!c) return;
  var idx = PIPE_ORDER.indexOf(c.statut_pipeline);
  var ni = Math.max(0, Math.min(PIPE_ORDER.length - 1, idx + dir));
  if (ni === idx) return;
  await updateRow('web_clients', id, { statut_pipeline: PIPE_ORDER[ni] });
  c.statut_pipeline = PIPE_ORDER[ni];
  renderPipeline(); badges();
  if (UI.pid === id) openClientPanel(id);
}

// ═══════════════════════════════════════════════════════════════════
// FICHE CLIENT (panneau)
// ═══════════════════════════════════════════════════════════════════
function openClientPanel(id) {
  var c = clientById(id); if (!c) return;
  UI.pid = id;
  el('ph-name').textContent = c.entreprise;
  el('ph-sub').innerHTML = statutPipelinePill(c.statut_pipeline) + (c.ville ? '<span style="color:var(--mu2)">' + esc(c.ville) + '</span>' : '');
  el('ptabs').innerHTML = '';
  el('pa').innerHTML =
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bg bsm" onclick="openClientForm(\'' + id + '\')">Modifier</button>' +
    '<button class="btn bg bsm" onclick="openProjetForm(\'' + id + '\')">+ Projet</button>' +
    '<button class="btn bp bsm" onclick="openDevisForm(\'' + id + '\')">+ Devis</button>' +
    '</div>';

  var infos =
    kv('Contact', c.contact_nom) + kv('Email', c.email) + kv('Telephone', c.telephone) +
    kv('Secteur', c.secteur) + kv('Ville', c.ville) + kv('Source', c.source) +
    (c.notes ? '<div style="margin-top:8px" class="notebox">' + esc(c.notes) + '</div>' : '');

  // pipeline mover
  var idx = PIPE_ORDER.indexOf(c.statut_pipeline);
  var stepBtns = PIPE_ORDER.map(function (st, i) {
    var cls = i === idx ? 'bp' : 'bg';
    return '<button class="btn ' + cls + ' bxs" onclick="setClientStage(\'' + id + '\',\'' + st + '\')">' + esc(PIPE_LABELS[st]) + '</button>';
  }).join(' ');

  var inter = interactionsOfClient(id);
  var interHtml = inter.map(function (it) {
    return '<div style="padding:8px 0;border-bottom:1px solid var(--bd)"><div style="display:flex;justify-content:space-between"><span class="pill" style="background:var(--s3);color:var(--mu)">' + esc(it.type) + '</span><span style="font-size:10px;color:var(--mu2)">' + fmtDateFR(it.date) + '</span></div><div style="font-size:11px;margin-top:4px;color:var(--tx)">' + esc(it.contenu || '') + '</div></div>';
  }).join('') || '<div class="empty">Aucune interaction</div>';

  var projets = projetsOfClient(id).map(function (p) {
    return '<div class="board-row" onclick="openProjetForm(\'' + id + '\',\'' + p.id + '\')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between"><span style="font-size:11px">' + esc(FORMULE_LABELS[p.formule]) + (p.url_livree ? ' &middot; <span style="color:var(--green)">en ligne</span>' : '') + '</span>' + statutProjetPill(p.statut) + '</div>';
  }).join('') || '<div class="empty">Aucun projet</div>';

  var devis = devisOfClient(id).map(function (d) {
    return '<div class="board-row" onclick="openDevisPanel(\'' + d.id + '\')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between align-items:center"><span style="font-size:11px">' + esc(d.numero) + ' &middot; ' + fmtEUR(d.total_ht) + '</span>' + statutDevisPill(d.statut) + '</div>';
  }).join('') || '<div class="empty">Aucun devis</div>';

  var factures = facturesOfClient(id).map(function (f) {
    return '<div class="board-row" onclick="go(\'factures\')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between"><span style="font-size:11px">' + esc(f.numero) + ' &middot; ' + esc(FACT_TYPE_LABELS[f.type]) + ' &middot; ' + fmtEUR(f.montant_ht) + '</span>' + statutFacturePill(f.statut) + '</div>';
  }).join('') || '<div class="empty">Aucune facture</div>';

  var heberg = hebergOfClient(id).map(function (h) {
    var d = daysUntil(h.date_renouvellement);
    var cl = d == null ? '' : (d < 0 ? 'sw-renew-late' : (d <= 30 ? 'sw-renew-soon' : 'sw-renew-ok'));
    return '<div class="board-row" onclick="openHebergForm(\'' + id + '\',\'' + h.id + '\')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid var(--bd)"><div style="font-size:11px">' + esc(h.nom_domaine || '-') + ' <span style="color:var(--mu)">' + esc(h.hebergeur || '') + '</span></div><div class="' + cl + '" style="font-size:10px">Renouvellement : ' + fmtDateFR(h.date_renouvellement) + (h.cout_annuel ? ' &middot; ' + fmtEUR(h.cout_annuel) + '/an' : '') + '</div></div>';
  }).join('') || '<div class="empty">Aucun hebergement</div>';

  el('pb').innerHTML =
    section('Coordonnees', infos) +
    section('Etape du pipeline', '<div style="display:flex;gap:4px;flex-wrap:wrap">' + stepBtns + '</div>') +
    section('Interactions', '<button class="btn bg bsm" style="margin-bottom:8px" onclick="openInteractionForm(\'' + id + '\')">+ Ajouter</button>' + interHtml) +
    section('Projets', projets) +
    section('Devis', devis) +
    section('Factures', factures) +
    section('Hebergement', heberg);

  openPanel();
}
function kv(k, v) { if (!v) return ''; return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span style="color:var(--mu)">' + esc(k) + '</span><span style="color:var(--tx);text-align:right">' + esc(v) + '</span></div>'; }
function section(title, body) { return '<div style="margin-bottom:16px"><div class="syne" style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mu);margin-bottom:8px">' + esc(title) + '</div>' + body + '</div>'; }

async function setClientStage(id, st) {
  await updateRow('web_clients', id, { statut_pipeline: st });
  var c = clientById(id); if (c) c.statut_pipeline = st;
  openClientPanel(id); if (UI.view === 'pipeline') renderPipeline(); badges();
}

// ── Formulaire client ──
function openClientForm(id) {
  var c = id ? clientById(id) : null;
  var stOpts = PIPE_ORDER.map(function (s) { return '<option value="' + s + '"' + (c && c.statut_pipeline === s ? ' selected' : '') + '>' + PIPE_LABELS[s] + '</option>'; }).join('');
  var b =
    '<div class="fg"><div class="fgrp ff"><label class="lbl">Entreprise *</label><input id="f-entreprise" value="' + esc(c && c.entreprise) + '"></div></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Contact</label><input id="f-contact" value="' + esc(c && c.contact_nom) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Statut pipeline</label><select id="f-statut">' + stOpts + '</select></div></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Email</label><input id="f-email" value="' + esc(c && c.email) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Telephone</label><input id="f-tel" value="' + esc(c && c.telephone) + '"></div></div>' +
    '<div class="fg3"><div class="fgrp"><label class="lbl">Secteur</label><input id="f-secteur" value="' + esc(c && c.secteur) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Ville</label><input id="f-ville" value="' + esc(c && c.ville) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Source</label><input id="f-source" value="' + esc(c && c.source) + '"></div></div>' +
    '<div class="fgrp"><label class="lbl">Notes</label><textarea id="f-notes">' + esc(c && c.notes) + '</textarea></div>';
  var f = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteClient(\'' + id + '\')">Supprimer</button>' : '') +
    '<button class="btn bp" onclick="saveClient(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier le client' : 'Nouveau client', b, f);
}
async function saveClient(id) {
  var entreprise = el('f-entreprise').value.trim();
  if (!entreprise) { toast('Nom d\'entreprise requis', 'e'); return; }
  var payload = {
    entreprise: entreprise, contact_nom: el('f-contact').value.trim() || null,
    email: el('f-email').value.trim() || null, telephone: el('f-tel').value.trim() || null,
    secteur: el('f-secteur').value.trim() || null, ville: el('f-ville').value.trim() || null,
    source: el('f-source').value.trim() || null, statut_pipeline: el('f-statut').value,
    notes: el('f-notes').value.trim() || null
  };
  var sb = getSB();
  if (id) {
    var r = await sb.from('web_clients').update(payload).eq('id', id);
    if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  } else {
    var u = currentUser();
    if (u && u.id) payload.owner = u.id;
    var ins = await sb.from('web_clients').insert(payload);
    if (ins.error) { toast('Erreur : ' + ins.error.message, 'e'); return; }
  }
  closeMo(); toast('Client enregistre', 's');
  await loadAll(); go(UI.view === 'dash' ? 'pipeline' : UI.view);
  if (id) openClientPanel(id);
}
async function deleteClient(id) {
  if (!confirm('Supprimer ce client et tout ce qui lui est rattache (projets, devis, factures) ?')) return;
  var r = await getSB().from('web_clients').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); closePanel(); toast('Client supprime', 's');
  await reload();
}

// ── Interaction ──
function openInteractionForm(clientId) {
  var b =
    '<div class="fgrp"><label class="lbl">Type</label><select id="i-type"><option value="appel">Appel</option><option value="email">Email</option><option value="rdv">Rendez-vous</option><option value="note" selected>Note</option></select></div>' +
    '<div class="fgrp"><label class="lbl">Contenu</label><textarea id="i-contenu" placeholder="Ce qui s\'est dit, la prochaine action..."></textarea></div>';
  openMo('Nouvelle interaction', b,
    '<button class="btn bg" onclick="openClientPanel(\'' + clientId + '\')">Annuler</button><button class="btn bp" onclick="saveInteraction(\'' + clientId + '\')">Ajouter</button>');
}
async function saveInteraction(clientId) {
  var payload = { client_id: clientId, type: el('i-type').value, contenu: el('i-contenu').value.trim() || null, date: nowISO() };
  var r = await getSB().from('web_interactions').insert(payload);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Interaction ajoutee', 's');
  await loadAll(); openClientPanel(clientId);
}

// ═══════════════════════════════════════════════════════════════════
// PROJETS
// ═══════════════════════════════════════════════════════════════════
function renderProjets() {
  var rows = DB.projets.map(function (p) {
    var stepDots = PROJ_ORDER.map(function (s, i) {
      var cur = s === p.statut; var done = PROJ_ORDER.indexOf(p.statut) > i;
      return '<span class="step-dot ' + (cur ? 'cur' : (done ? 'done' : '')) + '" title="' + PROJ_LABELS[s] + '">' + (i + 1) + '</span>';
    }).join('<span class="step-arr">&rsaquo;</span>');
    var opts = (p.options || []).length ? (p.options || []).join(', ') : '-';
    return '<tr onclick="openProjetForm(\'' + p.client_id + '\',\'' + p.id + '\')">' +
      '<td>' + esc(clientName(p.client_id)) + '</td>' +
      '<td>' + esc(FORMULE_LABELS[p.formule]) + '</td>' +
      '<td style="max-width:220px;color:var(--mu);font-size:10px">' + esc(opts) + '</td>' +
      '<td>' + fmtEUR(p.prix_ht) + (num(p.remise_pct) ? ' <span style="color:var(--mu2);font-size:9px">-' + num(p.remise_pct) + '%</span>' : '') + '</td>' +
      '<td><div class="steps" style="margin:0;padding:0;border:none;gap:3px">' + stepDots + '</div></td>' +
      '<td>' + (p.url_livree ? '<a href="' + esc(p.url_livree) + '" target="_blank" rel="noopener" style="color:var(--ac)" onclick="event.stopPropagation()">voir</a>' : '-') + '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="6" class="empty">Aucun projet. Cree un projet depuis une fiche client ou le bouton + Projet.</td></tr>';

  el('view-projets').innerHTML =
    '<table class="tbl"><thead><tr><th>Client</th><th>Formule</th><th>Options</th><th>Prix HT</th><th>Etape</th><th>URL</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function openProjetForm(clientId, id) {
  var p = id ? projetById(id) : null;
  if (p) clientId = p.client_id;
  var clients = DB.clients;
  if (!clients.length) { toast('Cree d\'abord un client', 'w'); return; }
  var cliOpts = clients.map(function (c) { return '<option value="' + c.id + '"' + (clientId === c.id ? ' selected' : '') + '>' + esc(c.entreprise) + '</option>'; }).join('');
  var fmOpts = Object.keys(FORMULE_LABELS).map(function (k) { return '<option value="' + k + '"' + (p && p.formule === k ? ' selected' : (!p && k === 'vitrine' ? ' selected' : '')) + '>' + FORMULE_LABELS[k] + ' (' + (FORMULE_PRICE[k] ? fmtEUR(FORMULE_PRICE[k]) : 'sur devis') + ')</option>'; }).join('');
  var stOpts = PROJ_ORDER.map(function (s) { return '<option value="' + s + '"' + (p && p.statut === s ? ' selected' : '') + '>' + PROJ_LABELS[s] + '</option>'; }).join('');
  _dvOptions = (p && p.options) ? p.options.slice() : [];
  var optChips = OPTIONS_CATALOG.map(function (o) {
    var on = _dvOptions.indexOf(o) >= 0;
    return '<span class="pill" style="cursor:pointer;border:1px solid ' + (on ? 'var(--ac-border)' : 'var(--bd2)') + ';background:' + (on ? 'var(--ac-dim)' : 'transparent') + ';color:' + (on ? 'var(--ac)' : 'var(--mu)') + '" onclick="toggleProjOption(this,\'' + esc(o).replace(/'/g, '') + '\')">' + esc(o) + '</span>';
  }).join(' ');

  var b =
    '<div class="fg"><div class="fgrp"><label class="lbl">Client *</label><select id="p-client">' + cliOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Formule</label><select id="p-formule" onchange="onFormuleChange()">' + fmOpts + '</select></div></div>' +
    '<div class="fgrp"><label class="lbl">Options</label><div id="p-opts" style="display:flex;gap:5px;flex-wrap:wrap">' + optChips + '</div></div>' +
    '<div class="fg3"><div class="fgrp"><label class="lbl">Prix HT</label><input id="p-prix" type="number" step="10" value="' + (p ? num(p.prix_ht) : FORMULE_PRICE.vitrine) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Remise %</label><input id="p-remise" type="number" step="1" value="' + (p ? num(p.remise_pct) : 0) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Etape</label><select id="p-statut">' + stOpts + '</select></div></div>' +
    '<div class="fg3"><div class="fgrp"><label class="lbl">Date cadrage</label><input id="p-dc" type="date" value="' + esc(p && p.date_cadrage) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Date maquette</label><input id="p-dm" type="date" value="' + esc(p && p.date_maquette) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Mise en ligne</label><input id="p-dml" type="date" value="' + esc(p && p.date_mise_en_ligne) + '"></div></div>' +
    '<div class="fgrp"><label class="lbl">URL livree</label><input id="p-url" placeholder="https://..." value="' + esc(p && p.url_livree) + '"></div>';
  var f = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteProjet(\'' + id + '\')">Supprimer</button>' : '') +
    '<button class="btn bp" onclick="saveProjet(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier le projet' : 'Nouveau projet', b, f);
}
function toggleProjOption(elx, o) {
  var i = _dvOptions.indexOf(o);
  if (i >= 0) { _dvOptions.splice(i, 1); elx.style.background = 'transparent'; elx.style.color = 'var(--mu)'; elx.style.borderColor = 'var(--bd2)'; }
  else { _dvOptions.push(o); elx.style.background = 'var(--ac-dim)'; elx.style.color = 'var(--ac)'; elx.style.borderColor = 'var(--ac-border)'; }
}
function onFormuleChange() {
  var f = el('p-formule').value;
  if (FORMULE_PRICE[f]) el('p-prix').value = FORMULE_PRICE[f];
}
async function saveProjet(id) {
  var payload = {
    client_id: el('p-client').value, formule: el('p-formule').value,
    options: _dvOptions.slice(), prix_ht: num(el('p-prix').value), remise_pct: num(el('p-remise').value),
    statut: el('p-statut').value,
    date_cadrage: el('p-dc').value || null, date_maquette: el('p-dm').value || null,
    date_mise_en_ligne: el('p-dml').value || null, url_livree: el('p-url').value.trim() || null
  };
  var sb = getSB(), r;
  if (id) r = await sb.from('web_projets').update(payload).eq('id', id);
  else r = await sb.from('web_projets').insert(payload);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Projet enregistre', 's');
  var cid = payload.client_id;
  await loadAll();
  if (UI.pid === cid) openClientPanel(cid); else go(UI.view);
}
async function deleteProjet(id) {
  if (!confirm('Supprimer ce projet ?')) return;
  var r = await getSB().from('web_projets').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Projet supprime', 's'); await reload();
}

// ═══════════════════════════════════════════════════════════════════
// DEVIS
// ═══════════════════════════════════════════════════════════════════
function renderDevis() {
  var rows = DB.devis.map(function (d) {
    var acts = '<div class="acol" onclick="event.stopPropagation()">' +
      '<span class="btn bg bxs" onclick="devisPDF(\'' + d.id + '\')">PDF</span>' +
      (d.statut === 'brouillon' || d.statut === 'envoye' ? '<span class="btn bg bxs" onclick="openDevisForm(null,null,\'' + d.id + '\')">Editer</span>' : '') +
      (d.statut !== 'accepte' && d.statut !== 'refuse' ? '<span class="btn bi bxs" onclick="sendDevis(\'' + d.id + '\')">Envoyer</span>' : '') +
      (d.statut === 'accepte' ? '<span class="btn bs bxs" onclick="convertDevis(\'' + d.id + '\')">En facture</span>' : '') +
      '</div>';
    return '<tr onclick="openDevisPanel(\'' + d.id + '\')"><td>' + esc(d.numero) + '</td><td>' + esc(clientName(d.client_id)) + '</td><td>' + fmtDateFR(d.date_emission) + '</td><td>' + fmtEUR(d.total_ht) + '</td><td>' + statutDevisPill(d.statut) + '</td><td>' + acts + '</td></tr>';
  }).join('') || '<tr><td colspan="6" class="empty">Aucun devis</td></tr>';
  el('view-devis').innerHTML =
    '<table class="tbl"><thead><tr><th>Numero</th><th>Client</th><th>Emis le</th><th>Total HT</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function openDevisPanel(id) {
  var d = devisById(id); if (!d) return;
  var c = clientById(d.client_id);
  el('ph-name').textContent = d.numero;
  el('ph-sub').innerHTML = statutDevisPill(d.statut) + '<span style="color:var(--mu2)">' + esc(c ? c.entreprise : '') + '</span>';
  el('ptabs').innerHTML = '';
  var lignes = (d.lignes || []).map(function (l) {
    return '<tr><td>' + esc(l.designation) + '</td><td style="text-align:right">' + num(l.quantite) + '</td><td style="text-align:right">' + fmtEUR(l.pu_ht, 2) + '</td><td style="text-align:right">' + fmtEUR(num(l.quantite) * num(l.pu_ht), 2) + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="empty">Aucune ligne</td></tr>';
  var signLink = signLinkFor(d);
  el('pb').innerHTML =
    section('Recapitulatif', '<table class="tbl"><thead><tr><th>Designation</th><th style="text-align:right">Qte</th><th style="text-align:right">PU HT</th><th style="text-align:right">Total</th></tr></thead><tbody>' + lignes + '</tbody></table>' +
      '<div style="text-align:right;font-family:Syne,sans-serif;font-weight:700;font-size:15px;margin-top:8px">Total HT : ' + fmtEUR(d.total_ht, 2) + '</div>') +
    section('Mentions', '<div class="sites-legal">' + esc(d.mentions || defaultMentions()) + '</div>') +
    (d.signature_ref ? section('Signature', '<div class="pill sw-signe">Signe &middot; ' + esc(d.signature_ref) + '</div>') : '') +
    section('Lien de signature (bon pour accord)', '<div style="font-size:10px;color:var(--mu);word-break:break-all;background:var(--s3);padding:8px;border-radius:var(--r)">' + esc(signLink) + '</div><button class="btn bg bsm" style="margin-top:6px" onclick="copyText(\'' + esc(signLink).replace(/'/g, '') + '\')">Copier le lien</button>');
  el('pa').innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bg bsm" onclick="devisPDF(\'' + id + '\')">PDF</button>' +
    (d.statut !== 'accepte' ? '<button class="btn bi bsm" onclick="sendDevis(\'' + id + '\')">Envoyer</button>' : '') +
    (d.statut === 'accepte' ? '<button class="btn bs bsm" onclick="convertDevis(\'' + id + '\')">Convertir en facture</button>' : '') +
    '<button class="btn bg bsm" onclick="setDevisStatut(\'' + id + '\',\'refuse\')">Refuse</button>' +
    '</div>';
  openPanel();
}

function openDevisForm(clientId, projetId, id) {
  var d = id ? devisById(id) : null;
  if (d) { clientId = d.client_id; projetId = d.projet_id; }
  if (!DB.clients.length) { toast('Cree d\'abord un client', 'w'); return; }
  var cliOpts = DB.clients.map(function (c) { return '<option value="' + c.id + '"' + (clientId === c.id ? ' selected' : '') + '>' + esc(c.entreprise) + '</option>'; }).join('');

  // lignes initiales : depuis le devis, sinon depuis le projet lie, sinon une ligne vide
  if (d && d.lignes && d.lignes.length) { _dvLines = d.lignes.map(function (l) { return { designation: l.designation, quantite: num(l.quantite), pu_ht: num(l.pu_ht) }; }); }
  else if (projetId && projetById(projetId)) {
    var p = projetById(projetId);
    var base = num(p.prix_ht) * (1 - num(p.remise_pct) / 100);
    _dvLines = [{ designation: 'Site internet - formule ' + FORMULE_LABELS[p.formule] + ((p.options || []).length ? ' (' + p.options.join(', ') + ')' : ''), quantite: 1, pu_ht: Math.round(base * 100) / 100 }];
  } else { _dvLines = [{ designation: '', quantite: 1, pu_ht: 0 }]; }

  var projOpts = '<option value="">- aucun -</option>' + projetsOfClient(clientId || (DB.clients[0] && DB.clients[0].id)).map(function (p) { return '<option value="' + p.id + '"' + (projetId === p.id ? ' selected' : '') + '>' + FORMULE_LABELS[p.formule] + '</option>'; }).join('');

  var b =
    '<div class="fg"><div class="fgrp"><label class="lbl">Client *</label><select id="d-client" onchange="onDevisClientChange()">' + cliOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Projet lie</label><select id="d-projet">' + projOpts + '</select></div></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Date d\'emission</label><input id="d-date" type="date" value="' + (d ? esc(d.date_emission) : todayISO()) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Validite jusqu\'au</label><input id="d-validite" type="date" value="' + (d && d.validite ? esc(d.validite) : addDaysISO(30)) + '"></div></div>' +
    '<div class="fgrp"><label class="lbl">Lignes</label><div class="dv-line-h"><span>Designation</span><span>Qte</span><span>PU HT</span><span>Total</span><span></span></div><div id="d-lines"></div>' +
    '<button class="btn bg bsm" style="margin-top:6px" onclick="dvAddLine()">+ Ligne</button></div>' +
    '<div style="text-align:right;font-family:Syne,sans-serif;font-weight:700;font-size:16px;margin:8px 0" id="d-total">Total HT : ' + fmtEUR(0, 2) + '</div>' +
    '<div class="sites-legal">Mentions portees automatiquement sur le devis :<br>SIRET <b>' + SIRET + '</b><br><b>' + TVA_MENTION + '</b><br>' + CESSION_CLAUSE + '</div>';
  var f = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteDevis(\'' + id + '\')">Supprimer</button>' : '') +
    '<button class="btn bp" onclick="saveDevis(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier le devis' : 'Nouveau devis', b, f);
  dvRenderLines();
}
function onDevisClientChange() {
  var cid = el('d-client').value;
  el('d-projet').innerHTML = '<option value="">- aucun -</option>' + projetsOfClient(cid).map(function (p) { return '<option value="' + p.id + '">' + FORMULE_LABELS[p.formule] + '</option>'; }).join('');
}
function dvRenderLines() {
  var html = _dvLines.map(function (l, i) {
    return '<div class="dv-line">' +
      '<input value="' + esc(l.designation) + '" placeholder="Prestation" oninput="dvEdit(' + i + ',\'designation\',this.value)">' +
      '<input type="number" step="1" value="' + num(l.quantite) + '" oninput="dvEdit(' + i + ',\'quantite\',this.value)">' +
      '<input type="number" step="10" value="' + num(l.pu_ht) + '" oninput="dvEdit(' + i + ',\'pu_ht\',this.value)">' +
      '<div style="font-size:11px;color:var(--mu);text-align:right;padding-right:4px">' + fmtEUR(num(l.quantite) * num(l.pu_ht), 2) + '</div>' +
      '<div class="dv-x" onclick="dvRemoveLine(' + i + ')">&times;</div>' +
    '</div>';
  }).join('');
  el('d-lines').innerHTML = html;
  el('d-total').textContent = 'Total HT : ' + fmtEUR(dvTotal(), 2);
}
function dvEdit(i, k, v) { _dvLines[i][k] = (k === 'designation') ? v : num(v); if (k !== 'designation') dvRenderLines(); else el('d-total').textContent = 'Total HT : ' + fmtEUR(dvTotal(), 2); }
function dvAddLine() { _dvLines.push({ designation: '', quantite: 1, pu_ht: 0 }); dvRenderLines(); }
function dvRemoveLine(i) { _dvLines.splice(i, 1); if (!_dvLines.length) _dvLines.push({ designation: '', quantite: 1, pu_ht: 0 }); dvRenderLines(); }
function dvTotal() { return _dvLines.reduce(function (a, l) { return a + num(l.quantite) * num(l.pu_ht); }, 0); }
function defaultMentions() { return 'SIRET ' + SIRET + '. ' + TVA_MENTION + '. ' + CESSION_CLAUSE; }

async function saveDevis(id) {
  var clientId = el('d-client').value;
  var lignes = _dvLines.filter(function (l) { return (l.designation || '').trim(); }).map(function (l) { return { designation: l.designation.trim(), quantite: num(l.quantite), pu_ht: num(l.pu_ht) }; });
  if (!lignes.length) { toast('Ajoute au moins une ligne', 'e'); return; }
  var total = lignes.reduce(function (a, l) { return a + l.quantite * l.pu_ht; }, 0);
  var payload = {
    client_id: clientId, projet_id: el('d-projet').value || null,
    date_emission: el('d-date').value || todayISO(), validite: el('d-validite').value || null,
    lignes: lignes, total_ht: Math.round(total * 100) / 100, mentions: defaultMentions()
  };
  var sb = getSB(), r;
  if (id) { r = await sb.from('web_devis').update(payload).eq('id', id); }
  else {
    payload.numero = await nextNumber('DEV');
    payload.statut = 'brouillon';
    r = await sb.from('web_devis').insert(payload);
  }
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Devis enregistre', 's');
  await loadAll(); go('devis');
}
async function deleteDevis(id) {
  if (!confirm('Supprimer ce devis ?')) return;
  var r = await getSB().from('web_devis').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); closePanel(); toast('Devis supprime', 's'); await reload();
}
async function setDevisStatut(id, st) {
  await updateRow('web_devis', id, { statut: st });
  var d = devisById(id); if (d) d.statut = st;
  toast('Devis : ' + DEVIS_LABELS[st], 's');
  if (UI.view === 'devis') renderDevis();
  openDevisPanel(id); badges();
}

// ── Lien / jeton de signature ──
function signLinkFor(d) {
  var tok = d.sign_token || '(genere a l\'envoi)';
  return location.origin + '/sites-sign?dv=' + d.id + '&t=' + tok;
}
async function ensureSignToken(d) {
  if (d.sign_token) return d.sign_token;
  var tok = genToken();
  var r = await getSB().from('web_devis').update({ sign_token: tok }).eq('id', d.id);
  if (r.error) { toast('Erreur jeton : ' + r.error.message, 'e'); return null; }
  d.sign_token = tok; return tok;
}

// ── Envoi du devis (reutilise /api/send-email, repli mailto) ──
async function sendDevis(id) {
  var d = devisById(id); if (!d) return;
  var c = clientById(d.client_id);
  var tok = await ensureSignToken(d);
  if (!tok) return;
  var link = location.origin + '/sites-sign?dv=' + d.id + '&t=' + tok;
  var to = c && c.email ? c.email : '';
  var subject = 'Votre devis ' + d.numero + ' - NOVALEM Sites Internet';
  var body =
    'Bonjour' + (c && c.contact_nom ? ' ' + c.contact_nom : '') + ',\n\n' +
    'Veuillez trouver votre devis ' + d.numero + ' pour un montant de ' + fmtEUR(d.total_ht, 2) + ' HT.\n\n' +
    TVA_MENTION + '.\n\n' +
    'Pour donner votre bon pour accord en ligne (signature electronique) :\n[Signer le devis](' + link + ')\n\n' +
    'Bien cordialement,\nNOVALEM';

  // set statut envoye
  await updateRow('web_devis', id, { statut: 'envoye' }); d.statut = 'envoye';

  if (!to) {
    toast('Pas d\'email client : lien de signature copie', 'w');
    copyText(link);
    if (UI.view === 'devis') renderDevis(); openDevisPanel(id); badges();
    return;
  }
  var sent = await trySendEmail({ to: to, subject: subject, body: body, from_name: 'NOVALEM Sites Internet' });
  if (sent) { toast('Devis envoye a ' + to, 's'); }
  else {
    // repli mailto
    var mailto = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body.replace('[Signer le devis](' + link + ')', link));
    window.open(mailto, '_blank');
    toast('Email pret dans votre messagerie', 'i');
  }
  if (UI.view === 'devis') renderDevis(); openDevisPanel(id); badges();
}
async function trySendEmail(opts) {
  try {
    var r = await fetch(API_BASE + '/api/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts)
    });
    return r.ok;
  } catch (e) { return false; }
}

// ── PDF du devis (jsPDF) ──
function devisPDF(id) {
  var d = devisById(id); if (!d) return;
  var c = clientById(d.client_id);
  var jsPDFctor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF || null);
  if (!jsPDFctor) { toast('Generateur PDF indisponible', 'e'); return; }
  var doc = new jsPDFctor({ unit: 'mm', format: 'a4' });
  var M = 18, y = 20;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(26, 20, 6);
  doc.text('NOVALEM', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 110);
  doc.text('Creation de sites internet', M, y + 5);
  doc.setFontSize(9); doc.setTextColor(60, 60, 55);
  doc.text('DEVIS', 210 - M, y, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(d.numero, 210 - M, y + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Emis le ' + fmtDateFR(d.date_emission), 210 - M, y + 11, { align: 'right' });
  if (d.validite) doc.text('Valable jusqu au ' + fmtDateFR(d.validite), 210 - M, y + 15, { align: 'right' });

  y += 26;
  doc.setDrawColor(224, 169, 46); doc.setLineWidth(0.6); doc.line(M, y, 210 - M, y);
  y += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 26);
  doc.text('Client', M, y);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 55);
  y += 5; doc.text(String(c ? c.entreprise : ''), M, y);
  if (c && c.contact_nom) { y += 4; doc.text(String(c.contact_nom), M, y); }
  if (c && c.ville) { y += 4; doc.text(String(c.ville), M, y); }

  y += 10;
  // entete tableau
  doc.setFillColor(245, 243, 239); doc.rect(M, y, 210 - 2 * M, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(40, 40, 36);
  doc.text('Designation', M + 2, y + 5.5);
  doc.text('Qte', 130, y + 5.5, { align: 'right' });
  doc.text('PU HT', 158, y + 5.5, { align: 'right' });
  doc.text('Total HT', 210 - M - 2, y + 5.5, { align: 'right' });
  y += 10;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 46);
  (d.lignes || []).forEach(function (l) {
    var desig = doc.splitTextToSize(String(l.designation || ''), 105);
    doc.text(desig, M + 2, y);
    doc.text(String(num(l.quantite)), 130, y, { align: 'right' });
    doc.text(fmtEUR(num(l.pu_ht), 2).replace('EUR', 'E').replace(/\u00a0/g, ' '), 158, y, { align: 'right' });
    doc.text(fmtEUR(num(l.quantite) * num(l.pu_ht), 2).replace('EUR', 'E').replace(/\u00a0/g, ' '), 210 - M - 2, y, { align: 'right' });
    y += Math.max(6, desig.length * 4.5);
  });
  y += 2; doc.setDrawColor(220, 220, 212); doc.line(M, y, 210 - M, y); y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 20, 6);
  doc.text('TOTAL HT : ' + fmtEUR(d.total_ht, 2).replace('EUR', 'E').replace(/\u00a0/g, ' '), 210 - M, y, { align: 'right' });

  y += 12;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 110, 100);
  var mentions = 'SIRET ' + SIRET + '  -  ' + TVA_MENTION + '.  ' + CESSION_CLAUSE;
  doc.text(doc.splitTextToSize(mentions, 210 - 2 * M), M, y);

  doc.save(d.numero + '.pdf');
  toast('PDF genere', 's');
}

// ── Conversion devis -> facture (acompte 40%) ──
async function convertDevis(id) {
  var d = devisById(id); if (!d) return;
  var acompte = Math.round(num(d.total_ht) * ACOMPTE_PCT) / 100;
  var b =
    '<p style="font-size:12px;color:var(--mu);margin-bottom:12px">Devis <b style="color:var(--tx)">' + esc(d.numero) + '</b> - Total HT ' + fmtEUR(d.total_ht, 2) + '</p>' +
    '<div class="fgrp"><label class="lbl">Type de facture</label><select id="cv-type" onchange="onCvType(' + num(d.total_ht) + ')"><option value="acompte">Acompte ' + ACOMPTE_PCT + '% (' + fmtEUR(acompte, 2) + ')</option><option value="solde">Solde (' + fmtEUR(num(d.total_ht) - acompte, 2) + ')</option></select></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Montant HT</label><input id="cv-montant" type="number" step="1" value="' + acompte + '"></div>' +
    '<div class="fgrp"><label class="lbl">Echeance</label><input id="cv-echeance" type="date" value="' + addDaysISO(30) + '"></div></div>';
  openMo('Convertir en facture', b,
    '<button class="btn bg" onclick="closeMo()">Annuler</button><button class="btn bp" onclick="doConvertDevis(\'' + id + '\')">Creer la facture</button>');
}
function onCvType(total) {
  var t = el('cv-type').value;
  var ac = Math.round(total * ACOMPTE_PCT) / 100;
  el('cv-montant').value = t === 'acompte' ? ac : Math.round((total - ac) * 100) / 100;
}
async function doConvertDevis(id) {
  var d = devisById(id); if (!d) return;
  var payload = {
    client_id: d.client_id, projet_id: d.projet_id || null, devis_id: d.id,
    numero: await nextNumber('FAC'), type: el('cv-type').value,
    montant_ht: num(el('cv-montant').value), date_emission: todayISO(),
    date_echeance: el('cv-echeance').value || null, statut: 'brouillon'
  };
  var r = await getSB().from('web_factures').insert(payload);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Facture ' + payload.numero + ' creee', 's');
  await loadAll(); go('factures');
}

// ═══════════════════════════════════════════════════════════════════
// FACTURES
// ═══════════════════════════════════════════════════════════════════
function renderFactures() {
  var rows = DB.factures.map(function (f) {
    var d = daysUntil(f.date_echeance);
    var late = (f.statut === 'emise' || f.statut === 'relancee') && d != null && d < 0;
    var acts = '<div class="acol" onclick="event.stopPropagation()">';
    if (f.statut === 'brouillon') acts += '<span class="btn bi bxs" onclick="emitFacture(\'' + f.id + '\')">Emettre</span><span class="btn bg bxs" onclick="openFactureForm(null,null,\'' + f.id + '\')">Editer</span>';
    if (f.statut === 'emise') acts += '<span class="btn bg bxs" onclick="setFactureStatut(\'' + f.id + '\',\'relancee\')">Relancer</span><span class="btn bs bxs" onclick="setFactureStatut(\'' + f.id + '\',\'payee\')">Payee</span>';
    if (f.statut === 'relancee') acts += '<span class="btn bs bxs" onclick="setFactureStatut(\'' + f.id + '\',\'payee\')">Payee</span>';
    if (f.statut !== 'payee' && f.statut !== 'annulee' && f.statut !== 'brouillon') acts += '<span class="btn bd_ bxs" onclick="avoirFacture(\'' + f.id + '\')">Avoir</span>';
    acts += '</div>';
    return '<tr><td>' + esc(f.numero) + (f.avoir_de ? ' <span style="color:var(--red);font-size:9px">(avoir)</span>' : '') + '</td><td>' + esc(clientName(f.client_id)) + '</td><td>' + esc(FACT_TYPE_LABELS[f.type]) + '</td><td>' + fmtEUR(f.montant_ht, 2) + '</td><td style="color:' + (late ? 'var(--red)' : 'var(--mu)') + '">' + (f.date_echeance ? fmtDateFR(f.date_echeance) + (late ? ' (retard)' : '') : '-') + '</td><td>' + statutFacturePill(f.statut) + '</td><td>' + acts + '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="empty">Aucune facture. Convertis un devis accepte ou cree une facture.</td></tr>';

  var totalEncaisse = DB.factures.filter(function (f) { return f.statut === 'payee'; }).reduce(function (a, f) { return a + num(f.montant_ht); }, 0);
  var totalDu = DB.factures.filter(function (f) { return f.statut === 'emise' || f.statut === 'relancee'; }).reduce(function (a, f) { return a + num(f.montant_ht); }, 0);

  el('view-factures').innerHTML =
    '<div class="sw-kpis">' + kpi(fmtEUR(totalEncaisse), 'Encaisse', 'factures payees') + kpi(fmtEUR(totalDu), 'En attente', 'emises / relancees') + '</div>' +
    '<div class="sites-legal" style="margin-bottom:14px">Une facture emise est <b>inalterable</b> : toute correction se fait par un avoir, jamais en modifiant la facture.</div>' +
    '<table class="tbl"><thead><tr><th>Numero</th><th>Client</th><th>Type</th><th>Montant HT</th><th>Echeance</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function openFactureForm(clientId, devisId, id) {
  var f = id ? factureById(id) : null;
  if (f) { clientId = f.client_id; devisId = f.devis_id; }
  if (f && f.statut !== 'brouillon') { toast('Facture emise : non modifiable (avoir uniquement)', 'w'); return; }
  if (!DB.clients.length) { toast('Cree d\'abord un client', 'w'); return; }
  var cliOpts = DB.clients.map(function (c) { return '<option value="' + c.id + '"' + (clientId === c.id ? ' selected' : '') + '>' + esc(c.entreprise) + '</option>'; }).join('');
  var b =
    '<div class="fg"><div class="fgrp"><label class="lbl">Client *</label><select id="fa-client">' + cliOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Type</label><select id="fa-type"><option value="acompte"' + (f && f.type === 'acompte' ? ' selected' : '') + '>Acompte</option><option value="solde"' + (f && f.type === 'solde' ? ' selected' : '') + '>Solde</option></select></div></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Montant HT</label><input id="fa-montant" type="number" step="1" value="' + (f ? num(f.montant_ht) : 0) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Echeance</label><input id="fa-echeance" type="date" value="' + (f && f.date_echeance ? esc(f.date_echeance) : addDaysISO(30)) + '"></div></div>' +
    '<div class="sites-legal">' + TVA_MENTION + '. SIRET ' + SIRET + '.</div>';
  var ft = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteFacture(\'' + id + '\')">Supprimer</button>' : '') +
    '<button class="btn bp" onclick="saveFacture(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier la facture' : 'Nouvelle facture', b, ft);
}
async function saveFacture(id) {
  var payload = {
    client_id: el('fa-client').value, type: el('fa-type').value,
    montant_ht: num(el('fa-montant').value), date_echeance: el('fa-echeance').value || null
  };
  var sb = getSB(), r;
  if (id) { r = await sb.from('web_factures').update(payload).eq('id', id); }
  else {
    payload.numero = await nextNumber('FAC'); payload.date_emission = todayISO(); payload.statut = 'brouillon';
    r = await sb.from('web_factures').insert(payload);
  }
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Facture enregistree', 's'); await loadAll(); go('factures');
}
async function emitFacture(id) {
  if (!confirm('Emettre cette facture ? Elle deviendra inalterable (correction par avoir uniquement).')) return;
  await updateRow('web_factures', id, { statut: 'emise' });
  toast('Facture emise', 's'); await reload();
}
async function setFactureStatut(id, st) {
  await updateRow('web_factures', id, { statut: st });
  toast('Facture : ' + FACT_LABELS[st], 's'); await reload();
}
async function deleteFacture(id) {
  var f = factureById(id);
  if (f && f.statut !== 'brouillon') { toast('Seul un brouillon peut etre supprime', 'w'); return; }
  if (!confirm('Supprimer ce brouillon de facture ?')) return;
  var r = await getSB().from('web_factures').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Facture supprimee', 's'); await reload();
}
async function avoirFacture(id) {
  var f = factureById(id); if (!f) return;
  if (!confirm('Creer un avoir annulant la facture ' + f.numero + ' ?')) return;
  var payload = {
    client_id: f.client_id, projet_id: f.projet_id || null, devis_id: f.devis_id || null,
    numero: await nextNumber('FAC'), type: f.type, montant_ht: -Math.abs(num(f.montant_ht)),
    date_emission: todayISO(), statut: 'emise', avoir_de: f.id
  };
  var sb = getSB();
  var ins = await sb.from('web_factures').insert(payload);
  if (ins.error) { toast('Erreur : ' + ins.error.message, 'e'); return; }
  await sb.from('web_factures').update({ statut: 'annulee' }).eq('id', id);
  toast('Avoir ' + payload.numero + ' cree', 's'); await reload();
}

// ═══════════════════════════════════════════════════════════════════
// HEBERGEMENT
// ═══════════════════════════════════════════════════════════════════
function renderHebergement() {
  var rows = DB.hebergements.map(function (h) {
    var d = daysUntil(h.date_renouvellement);
    var cl = d == null ? '' : (d < 0 ? 'sw-renew-late' : (d <= 30 ? 'sw-renew-soon' : 'sw-renew-ok'));
    var lbl = d == null ? '-' : (d < 0 ? Math.abs(d) + 'j de retard' : 'dans ' + d + 'j');
    return '<tr onclick="openHebergForm(\'' + h.client_id + '\',\'' + h.id + '\')"><td>' + esc(clientName(h.client_id)) + '</td><td>' + esc(h.nom_domaine || '-') + '</td><td>' + esc(h.hebergeur || '-') + '</td><td class="' + cl + '">' + fmtDateFR(h.date_renouvellement) + ' <span style="font-size:9px">(' + lbl + ')</span></td><td>' + (h.cout_annuel ? fmtEUR(h.cout_annuel) + '/an' : '-') + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="empty">Aucun hebergement suivi</td></tr>';

  var soon = DB.hebergements.filter(function (h) { var d = daysUntil(h.date_renouvellement); return d != null && d <= 30; });
  var alert = soon.length ? '<div class="sites-legal" style="border-left-color:var(--orange);margin-bottom:14px"><b style="color:var(--orange)">' + soon.length + ' renouvellement(s) sous 30 jours</b> : ' + soon.map(function (h) { return esc((h.nom_domaine || clientName(h.client_id))); }).join(', ') + '</div>' : '';

  el('view-hebergement').innerHTML = alert +
    '<table class="tbl"><thead><tr><th>Client</th><th>Domaine</th><th>Hebergeur</th><th>Renouvellement</th><th>Cout</th></tr></thead><tbody>' + rows + '</tbody></table>';
}
function openHebergForm(clientId, id) {
  var h = id ? DB.hebergements.find(function (x) { return x.id === id; }) : null;
  if (h) clientId = h.client_id;
  if (!DB.clients.length) { toast('Cree d\'abord un client', 'w'); return; }
  var cliOpts = DB.clients.map(function (c) { return '<option value="' + c.id + '"' + (clientId === c.id ? ' selected' : '') + '>' + esc(c.entreprise) + '</option>'; }).join('');
  var b =
    '<div class="fg"><div class="fgrp"><label class="lbl">Client *</label><select id="h-client">' + cliOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Nom de domaine</label><input id="h-domaine" placeholder="exemple.fr" value="' + esc(h && h.nom_domaine) + '"></div></div>' +
    '<div class="fg3"><div class="fgrp"><label class="lbl">Hebergeur</label><input id="h-hebergeur" value="' + esc(h && h.hebergeur) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Renouvellement</label><input id="h-renouv" type="date" value="' + esc(h && h.date_renouvellement) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Cout annuel</label><input id="h-cout" type="number" step="1" value="' + (h ? num(h.cout_annuel) : '') + '"></div></div>' +
    '<div class="fgrp"><label class="lbl">Notes d\'acces</label><textarea id="h-notes">' + esc(h && h.acces_notes) + '</textarea></div>';
  var f = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteHeberg(\'' + id + '\')">Supprimer</button>' : '') +
    '<button class="btn bp" onclick="saveHeberg(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier l\'hebergement' : 'Nouvel hebergement', b, f);
}
async function saveHeberg(id) {
  var payload = {
    client_id: el('h-client').value, nom_domaine: el('h-domaine').value.trim() || null,
    hebergeur: el('h-hebergeur').value.trim() || null, date_renouvellement: el('h-renouv').value || null,
    cout_annuel: el('h-cout').value ? num(el('h-cout').value) : null, acces_notes: el('h-notes').value.trim() || null
  };
  var sb = getSB(), r;
  if (id) r = await sb.from('web_hebergements').update(payload).eq('id', id);
  else r = await sb.from('web_hebergements').insert(payload);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Hebergement enregistre', 's'); await reload();
}
async function deleteHeberg(id) {
  if (!confirm('Supprimer cet hebergement ?')) return;
  var r = await getSB().from('web_hebergements').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Hebergement supprime', 's'); await reload();
}

// ═══════════════════════════════════════════════════════════════════
// PILLS DE STATUT
// ═══════════════════════════════════════════════════════════════════
function statutPipelinePill(st) { return '<span class="sw-pill sw-' + st + '">' + esc(PIPE_LABELS[st] || st) + '</span>'; }
function statutProjetPill(st) {
  var col = { cadrage: 'var(--mu)', maquette: 'var(--blue)', developpement: 'var(--purple)', mise_en_ligne: 'var(--orange)', livre: 'var(--green)' }[st] || 'var(--mu)';
  return '<span class="pill" style="color:' + col + ';background:var(--s3)">' + esc(PROJ_LABELS[st] || st) + '</span>';
}
function statutDevisPill(st) {
  var col = { brouillon: 'var(--mu)', envoye: 'var(--orange)', accepte: 'var(--green)', refuse: 'var(--red)', expire: 'var(--mu2)' }[st] || 'var(--mu)';
  return '<span class="pill" style="color:' + col + ';background:var(--s3)">' + esc(DEVIS_LABELS[st] || st) + '</span>';
}
function statutFacturePill(st) {
  var col = { brouillon: 'var(--mu)', emise: 'var(--blue)', relancee: 'var(--orange)', payee: 'var(--green)', annulee: 'var(--red)' }[st] || 'var(--mu)';
  return '<span class="pill" style="color:' + col + ';background:var(--s3)">' + esc(FACT_LABELS[st] || st) + '</span>';
}

// ═══════════════════════════════════════════════════════════════════
// UTILITAIRES BASE
// ═══════════════════════════════════════════════════════════════════
async function updateRow(table, id, patch) {
  var r = await getSB().from(table).update(patch).eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); throw r.error; }
  return true;
}
function copyText(t) {
  try { navigator.clipboard.writeText(t); toast('Copie', 's'); }
  catch (e) { toast('Copie impossible', 'w'); }
}

// ═══════════════════════════════════════════════════════════════════
// SIGNATURE : polling (comme le CRM pour les contrats)
// ═══════════════════════════════════════════════════════════════════
async function checkSignatures() {
  var pending = DB.devis.filter(function (d) { return d.statut === 'envoye' && d.sign_token; });
  if (!pending.length) return;
  var sb = getSB(); if (!sb) return;
  for (var i = 0; i < pending.length; i++) {
    var d = pending[i];
    try {
      var r = await sb.from('web_devis_signatures').select('signer_name,signed_at,reference').eq('devis_id', d.id).order('signed_at', { ascending: false }).limit(1).maybeSingle();
      if (r.data && r.data.signer_name) {
        d.statut = 'accepte'; d.signature_ref = r.data.reference || d.signature_ref;
        toast('Devis ' + d.numero + ' signe par ' + r.data.signer_name, 's');
        if (UI.view === 'devis') renderDevis();
        if (UI.view === 'dash') renderDash();
        badges();
      }
    } catch (e) { /* silencieux */ }
  }
}
function startSigPolling() {
  if (_sigTimer) return;
  checkSignatures();
  _sigTimer = setInterval(checkSignatures, 20000);
}

// ═══════════════════════════════════════════════════════════════════
// UTILISATEUR / MENU
// ═══════════════════════════════════════════════════════════════════
function initUser() {
  var u = currentUser();
  if (!u) return;
  var av = el('user-avatar'); if (av) av.textContent = u.initials || (u.name ? u.name[0] : '?');
  if (u.color && av) av.style.background = u.color;
  var nm = el('user-badge-name'); if (nm) nm.textContent = u.name || 'Utilisateur';
  var un = el('um-name'); if (un) un.textContent = u.name || 'Utilisateur';
  var ur = el('um-role'); if (ur) ur.textContent = u.role === 'superviseur' ? 'Superviseur' : 'Scout';
}
function toggleUserMenu() { var m = el('user-menu'); m.style.display = m.style.display === 'none' ? 'block' : 'none'; }
function logout() { try { localStorage.removeItem('novalem_user'); } catch (e) {} window.location.href = '/'; }
document.addEventListener('click', function (e) {
  var m = el('user-menu'), b = el('user-badge');
  if (m && m.style.display === 'block' && !m.contains(e.target) && b && !b.contains(e.target)) m.style.display = 'none';
});

// ═══════════════════════════════════════════════════════════════════
// EXPOSITION GLOBALE (handlers onclick) + INIT
// ═══════════════════════════════════════════════════════════════════
var API = {
  go: go, openClientForm: openClientForm, saveClient: saveClient, deleteClient: deleteClient,
  openClientPanel: openClientPanel, moveClient: moveClient, setClientStage: setClientStage,
  openInteractionForm: openInteractionForm, saveInteraction: saveInteraction,
  openProjetForm: openProjetForm, saveProjet: saveProjet, deleteProjet: deleteProjet,
  toggleProjOption: toggleProjOption, onFormuleChange: onFormuleChange,
  openDevisForm: openDevisForm, saveDevis: saveDevis, deleteDevis: deleteDevis,
  openDevisPanel: openDevisPanel, onDevisClientChange: onDevisClientChange,
  dvAddLine: dvAddLine, dvRemoveLine: dvRemoveLine, dvEdit: dvEdit,
  devisPDF: devisPDF, sendDevis: sendDevis, setDevisStatut: setDevisStatut,
  convertDevis: convertDevis, onCvType: onCvType, doConvertDevis: doConvertDevis,
  openFactureForm: openFactureForm, saveFacture: saveFacture, deleteFacture: deleteFacture,
  emitFacture: emitFacture, setFactureStatut: setFactureStatut, avoirFacture: avoirFacture,
  openHebergForm: openHebergForm, saveHeberg: saveHeberg, deleteHeberg: deleteHeberg,
  closeMo: closeMo, closePanel: closePanel, copyText: copyText,
  toggleUserMenu: toggleUserMenu, logout: logout
};
Object.keys(API).forEach(function (k) { window[k] = API[k]; });

async function init() {
  initUser();
  // navigation : chaque onglet declenche go()
  var nis = document.querySelectorAll('.ni');
  for (var i = 0; i < nis.length; i++) {
    (function (n) { n.addEventListener('click', function () { go(n.getAttribute('data-v')); }); })(nis[i]);
  }
  await loadAll();
  go('dash');
  startSigPolling();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
