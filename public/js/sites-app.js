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
// ► CONFIGURATION ENTREPRISE  ◄  (a completer une seule fois)
//   Ces informations apparaissent sur les devis-contrats et les factures.
//   Remplace les valeurs entre guillemets par les tiennes, puis pousse sur GitHub.
// ═══════════════════════════════════════════════════════════════════
// Les valeurs viennent des PARAMETRES (bouton Parametres, module sites-config.js).
// Ces alias sont recopies au demarrage et apres chaque enregistrement.
var ENTREPRISE = {};
var SIRET = '';
var TVA_MENTION = '';
var CESSION_CLAUSE = '';

function syncEntreprise() {
  var C = window.NOVCFG;
  if (!C) return;
  var e = C.ent(), p = C.pay();
  ENTREPRISE = {
    nom_commercial: e.nom_commercial, exploitant: e.exploitant, forme: e.forme,
    adresse: e.adresse, siret: e.siret, ape: e.ape, email: e.email, tel: e.tel,
    site: e.site, tva: e.tva, baseline: e.baseline || 'Creation de sites internet',
    paiement: { titulaire: p.titulaire, banque: p.banque, iban: p.iban, bic: p.bic, autres: p.autres }
  };
  SIRET = e.siret; TVA_MENTION = e.tva; CESSION_CLAUSE = C.CESSION;
}

// ═══════════════════════════════════════════════════════════════════
// ECHEANCIER — defini DEVIS PAR DEVIS (colonne web_devis.acompte_pct)
//   0   = tout a la livraison       100 = tout a la commande
//   30  = acompte 30 % / solde 70 %  etc.
//   Absent : on retombe sur le defaut des parametres.
// ═══════════════════════════════════════════════════════════════════
function planOf(devis, totalOverride) { return window.NOVCFG.planFor(devis, totalOverride); }
function planFromPct(pct, total) { return window.NOVCFG.planFor({ acompte_pct: pct, total_ht: total }); }
function montantAcompte(total, devis) { return planOf(devis, total).acompte; }
function montantSolde(total, devis) { return planOf(devis, total).solde; }
// Libelle du type de facture attendu pour un devis donne
function labelFacture(plan, type) {
  if (plan.unique) return 'Facture';
  return type === 'acompte' ? ('Facture d\'acompte ' + plan.pct + ' %') : ('Facture de solde ' + plan.soldePct + ' %');
}
// Retrouve la facture d'acompte non annulee liee a un devis (pour la deduire du solde)
function acompteFactureForDevis(devisId) {
  return DB.factures.find(function (f) {
    return f.devis_id === devisId && f.type === 'acompte' && !f.avoir_de && f.statut !== 'annulee';
  });
}
function soldeFactureForDevis(devisId) {
  return DB.factures.find(function (f) {
    return f.devis_id === devisId && f.type === 'solde' && !f.avoir_de && f.statut !== 'annulee';
  });
}

var PIPE_ORDER  = ['prospect', 'contacte', 'devis_envoye', 'signe', 'en_cours', 'livre', 'sav', 'perdu'];
var PIPE_LABELS = {
  prospect: 'Prospect', contacte: 'Contacte', devis_envoye: 'Devis envoye',
  signe: 'Signe', en_cours: 'En cours', livre: 'Livre', sav: 'SAV', perdu: 'Perdu'
};
var PIPE_ACTIVE = ['prospect', 'contacte', 'devis_envoye', 'signe', 'en_cours'];

var FORMULE_LABELS = { essentiel: 'Essentiel', vitrine: 'Vitrine', signature: 'Signature', sur_mesure: 'Sur mesure' };
var FORMULE_PRICE  = { essentiel: 390, vitrine: 790, signature: 1190, sur_mesure: 0 };
var FORMULE_DELAI  = { essentiel: 'livre en 7 jours', vitrine: 'livre en 10 a 14 jours', signature: 'livre en 3 semaines', sur_mesure: 'delai selon perimetre' };

// Le catalogue de prestations vit desormais dans les Parametres (sites-config.js).
// Acces via catalogue() et catalogueRec().

var PROJ_ORDER  = ['cadrage', 'maquette', 'developpement', 'mise_en_ligne', 'livre'];
var PROJ_LABELS = { cadrage: 'Cadrage', maquette: 'Maquette', developpement: 'Developpement', mise_en_ligne: 'Mise en ligne', livre: 'Livre' };

var DEVIS_LABELS = { brouillon: 'Brouillon', envoye: 'Envoye', accepte: 'Accepte', refuse: 'Refuse', expire: 'Expire' };
var FACT_TYPE_LABELS = { acompte: 'Acompte', solde: 'Facture' };
var FACT_LABELS = { brouillon: 'Brouillon', emise: 'Emise', relancee: 'Relancee', payee: 'Payee', annulee: 'Annulee' };

var OPTIONS_CATALOG = [
  'Page supplementaire', 'Formulaire de devis', 'Prise de rendez-vous', 'Espace client securise',
  'Version multilingue', 'Boutique en ligne', 'Avis Google en direct', 'WhatsApp et messagerie',
  'SEO technique', 'Fiche Google Business', 'Blog SEO', 'GEO (IA generatives)'
];

// Agenda / rappels
var EVT_TYPE_LABELS = { rappel: 'Rappel', rdv_physique: 'RDV physique', rdv_visio: 'RDV visio', tache: 'Tache', echeance: 'Echeance' };
var EVT_TYPE_ORDER  = ['rappel', 'rdv_physique', 'rdv_visio', 'tache', 'echeance'];
// Rappels generes automatiquement a chaque transition de pipeline (le cote "assiste")
var AUTO_RAPPELS = {
  contacte:     { j: 0,   titre: 'Preparer le RDV : devis-contrat + acompte + signature' },
  devis_envoye: { j: 4,   titre: 'Relancer le devis si pas de reponse' },
  signe:        { j: 1,   titre: 'Facturer et encaisser l\'acompte, puis demarrer la maquette' },
  en_cours:     { j: 2,   titre: 'Envoyer l\'apercu du site (lien maquette) au client' },
  livre:        { j: 330, titre: 'Anticiper le renouvellement de l\'hebergement et du domaine' }
};

// ═══════════════════════════════════════════════════════════════════
// ETAT
// ═══════════════════════════════════════════════════════════════════
var DB = { clients: [], projets: [], devis: [], factures: [], hebergements: [], interactions: [], cadrages: [], evenements: [], liens: [], acces: [] };
var UI = { view: 'dash', pid: null };
var _dvLines = [];      // lignes de l'editeur de devis en cours
var _dvPct = null;      // echeancier en cours d'edition (% a la signature)
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
function cadragesOfClient(id) {
  return DB.cadrages.filter(function (c) { return c.client_id === id; })
    .sort(function (a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); });
}
function openCadrage(id) { window.location = '/sites-cadrage' + (id ? '?client=' + id : ''); }

// ═══════════════════════════════════════════════════════════════════
// CHARGEMENT DES DONNEES (tables web_ uniquement)
// ═══════════════════════════════════════════════════════════════════
async function loadAll() {
  var sb = getSB();
  if (!sb) { updateConn('off', 'Client Supabase indisponible'); toast('Connexion indisponible', 'e'); return; }
  updateConn('load');
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
    if (err && err.error) {
      console.warn('[sites] load', err.error);
      updateConn('off', err.error.message);
      toast('Erreur de chargement : ' + err.error.message, 'e');
    } else { updateConn('ok'); }
    DB.clients = res[0].data || [];
    DB.projets = res[1].data || [];
    DB.devis = res[2].data || [];
    DB.factures = res[3].data || [];
    DB.hebergements = res[4].data || [];
    DB.interactions = res[5].data || [];
    // Fiches de cadrage : chargement optionnel (table ajoutee via la migration).
    try {
      var rc = await sb.from('web_cadrages').select('id,nom,client_id,total_ht,updated_at').order('updated_at', { ascending: false });
      if (!rc.error) DB.cadrages = rc.data || [];
    } catch (e) { /* table absente : on ignore */ }
    // Agenda / rappels + liens (tables ajoutees via la migration sites-schema.sql).
    try {
      var re = await sb.from('web_evenements').select('*').order('date_debut', { ascending: true });
      if (!re.error) DB.evenements = re.data || [];
    } catch (e) { /* table absente : on ignore */ }
    try {
      var rl = await sb.from('web_liens').select('*').order('created_at', { ascending: false });
      if (!rl.error) DB.liens = rl.data || [];
    } catch (e) { /* table absente : on ignore */ }
    try {
      var ra = await sb.from('web_acces').select('*').order('created_at', { ascending: false });
      if (!ra.error) DB.acces = ra.data || [];
    } catch (e) { /* table absente : on ignore */ }
  } catch (e) { console.warn(e); updateConn('off', e.message); toast('Erreur reseau au chargement', 'e'); }
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

  var T = { dash: 'Tableau de bord', agenda: 'Agenda et rappels', pipeline: 'Pipeline commercial', devis: 'Devis-contrats', factures: 'Factures', projets: 'Projets', hebergement: 'Hebergement et domaines' };
  el('tbt').textContent = T[v] || v;

  var A = {
    agenda: '<button class="btn bp bsm" onclick="openEventForm()">+ Rappel</button>',
    pipeline: '<input id="pipe-q" placeholder="Chercher un client..." oninput="setPipeQ(this.value)" value="' + esc(_pipeQ) + '" style="max-width:210px;margin-right:6px"><button class="btn bp bsm" onclick="openClientForm()">+ Client</button>',
    devis: '<button class="btn bp bsm" onclick="openDevisForm()">+ Devis</button>',
    factures: '<button class="btn bp bsm" onclick="openFactureForm()">+ Facture</button>',
    projets: '<button class="btn bp bsm" onclick="openProjetForm()">+ Projet</button>',
    hebergement: '<button class="btn bp bsm" onclick="openHebergForm()">+ Hebergement</button>'
  };
  el('tba').innerHTML = A[v] || '';

  var R = { dash: renderDash, agenda: renderAgenda, pipeline: renderPipeline, devis: renderDevis, factures: renderFactures, projets: renderProjets, hebergement: renderHebergement };
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
  setBadge('badge-agenda', evDueList().length, true);

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

  var due = evDueList();
  var dueHtml = due.slice(0, 10).map(function (e) {
    var d = daysUntilTs(e.date_debut);
    var late = d < 0;
    var when = late ? Math.abs(d) + 'j de retard' : (d === 0 ? 'aujourd\'hui' : 'dans ' + d + 'j');
    return '<div class="board-row todo-row" onclick="openEventDetail(\'' + e.id + '\')" style="display:flex;justify-content:space-between;align-items:center;padding:8px 6px;border-bottom:1px solid var(--bd);cursor:pointer;border-radius:6px">' +
      '<div style="min-width:0"><div style="font-size:11px;color:var(--tx)"><span class="ev-dot t-' + e.type + '"></span>' + esc(e.titre) + '</div>' +
      '<div style="font-size:10px;color:var(--mu2)">' + (e.client_id ? esc(clientName(e.client_id)) + ' &middot; ' : '') + esc(EVT_TYPE_LABELS[e.type]) + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
        '<span style="font-size:10px;color:' + (late ? 'var(--red)' : 'var(--orange)') + '">' + when + '</span>' +
        '<span class="btn bg bxs" onclick="event.stopPropagation();setEventDone(\'' + e.id + '\')" title="Marquer fait">&#10003;</span>' +
      '</div></div>';
  }).join('') || '<div class="empty">Rien de prevu, tu es a jour</div>';

  el('view-dash').innerHTML =
    '<div style="margin-bottom:14px">' + card('A faire' + (due.length ? ' (' + due.length + ')' : ''), dueHtml) + '</div>' +
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
var _pipeQ = '';
function setPipeQ(v) {
  _pipeQ = v || '';
  renderPipeline();
  var i = el('pipe-q');
  if (i && document.activeElement !== i) { i.value = _pipeQ; }
}
function matchClient(c, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return [c.entreprise, c.contact_nom, c.ville, c.secteur, c.email, c.telephone]
    .some(function (v) { return (v || '').toLowerCase().indexOf(q) >= 0; });
}
// Valeur estimee d'un client du pipeline : son meilleur devis non refuse,
// sinon l'hypothese de base 1 site = 390 euros.
function clientValeur(c) {
  var ds = devisOfClient(c.id).filter(function (d) { return d.statut !== 'refuse'; });
  var best = 0;
  ds.forEach(function (d) { var m = parseFloat(d.montant_ht || 0); if (m > best) best = m; });
  return best > 0 ? best : 390;
}
function renderPipeline() {
  // Bandeau CA : potentiel (avant signature), engage (signe -> sav), et total pondere
  var pot = 0, potN = 0, eng = 0, engN = 0;
  DB.clients.forEach(function (c) {
    var st = c.statut_pipeline;
    if (st === 'perdu') return;
    var v = clientValeur(c);
    if (st === 'prospect' || st === 'contacte' || st === 'devis_envoye') { pot += v; potN++; }
    else { eng += v; engN++; }
  });
  var fmtE = function (n) { return Math.round(n).toLocaleString('fr-FR') + ' \u20AC'; };
  var caBar =
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">' +
      '<div style="flex:1;min-width:200px;background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:13px 16px">' +
        '<div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--mu)">CA potentiel en pipeline</div>' +
        '<div style="font-size:24px;font-weight:800;color:var(--ac);font-variant-numeric:tabular-nums;margin-top:3px">' + fmtE(pot) + '</div>' +
        '<div style="font-size:10.5px;color:var(--mu2)">' + potN + ' client(s) avant signature &middot; base 390 \u20AC par site, devis reel si emis</div>' +
      '</div>' +
      '<div style="flex:1;min-width:200px;background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:13px 16px">' +
        '<div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--mu)">CA signe et en production</div>' +
        '<div style="font-size:24px;font-weight:800;color:var(--green,#34a853);font-variant-numeric:tabular-nums;margin-top:3px">' + fmtE(eng) + '</div>' +
        '<div style="font-size:10.5px;color:var(--mu2)">' + engN + ' client(s) du stade signe a SAV</div>' +
      '</div>' +
      '<div style="flex:1;min-width:200px;background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:13px 16px">' +
        '<div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--mu)">Total pipeline actif</div>' +
        '<div style="font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px">' + fmtE(pot + eng) + '</div>' +
        '<div style="font-size:10.5px;color:var(--mu2)">' + (potN + engN) + ' client(s) hors perdus</div>' +
      '</div>' +
    '</div>';
  var cols = PIPE_ORDER.map(function (st) {
    var items = DB.clients.filter(function (c) { return c.statut_pipeline === st && matchClient(c, _pipeQ); });
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
      '<div class="kbh sw-kh k-' + st + '"><span class="kbh-t">' + esc(PIPE_LABELS[st]) + '</span><span style="font-size:9px;color:var(--mu2);margin-left:auto;margin-right:6px;font-variant-numeric:tabular-nums">' + (st === 'perdu' ? '' : Math.round(items.reduce(function (t, c) { return t + clientValeur(c); }, 0)).toLocaleString('fr-FR') + ' \u20AC') + '</span><span class="kbh-n">' + items.length + '</span></div>' +
      '<div class="kbcards">' + cards + '</div>' +
    '</div>';
  }).join('');
  el('view-pipeline').innerHTML = caBar + '<div class="kb" style="grid-template-columns:repeat(' + PIPE_ORDER.length + ',minmax(210px,1fr))">' + cols + '</div>';
}

async function moveClient(id, dir) {
  var c = clientById(id); if (!c) return;
  var idx = PIPE_ORDER.indexOf(c.statut_pipeline);
  var ni = Math.max(0, Math.min(PIPE_ORDER.length - 1, idx + dir));
  if (ni === idx) return;
  await updateRow('web_clients', id, { statut_pipeline: PIPE_ORDER[ni] });
  await maybeAutoRappel(id, PIPE_ORDER[ni]);
  await loadAll();
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
    '<button class="btn bp bsm" onclick="openPremierRDV(\'' + id + '\')">\u26a1 RDV : devis + acompte + signature</button>' +
    '<button class="btn bg bsm" onclick="openClientForm(\'' + id + '\')">Modifier</button>' +
    '<button class="btn bg bsm" onclick="openProjetForm(\'' + id + '\')">+ Projet</button>' +
    '<button class="btn bg bsm" onclick="openDevisForm(\'' + id + '\')">+ Devis</button>' +
    '<button class="btn bg bsm" onclick="handoverPDF(\'' + id + '\')">Passation PDF</button>' +
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

  var cad = cadragesOfClient(id).map(function (k) {
    return '<div class="board-row" onclick="openCadrage(\'' + id + '\')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between"><span style="font-size:11px">' + esc(k.nom || 'Fiche') + '</span><span style="font-size:10px;color:var(--mu)">' + (num(k.total_ht) ? fmtEUR(k.total_ht) + ' &middot; ' : '') + fmtDateFR(k.updated_at) + '</span></div>';
  }).join('') || '<div class="empty">Aucune fiche de cadrage</div>';

  var evs = evOfClient(id).filter(function (e) { return e.statut !== 'annule'; });
  var rappelsHtml = evs.map(function (e) {
    var d = daysUntilTs(e.date_debut);
    var late = e.statut === 'a_faire' && d < 0;
    var done = e.statut === 'fait';
    return '<div class="board-row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd)">' +
      '<div onclick="openEventForm(\'' + e.id + '\')" style="cursor:pointer;flex:1;min-width:0">' +
        '<div style="font-size:11px;color:' + (done ? 'var(--mu2)' : 'var(--tx)') + (done ? ';text-decoration:line-through' : '') + '"><span class="ev-dot t-' + e.type + '"></span>' + esc(e.titre) + '</div>' +
        '<div style="font-size:10px;color:' + (late ? 'var(--red)' : 'var(--mu2)') + '">' + esc(EVT_TYPE_LABELS[e.type]) + ' &middot; ' + fmtDateHeureFR(e.date_debut) + (late ? ' (en retard)' : '') + '</div>' +
      '</div>' +
      (e.statut === 'a_faire' ? '<span class="btn bg bxs" onclick="event.stopPropagation();setEventDone(\'' + e.id + '\')" title="Marquer fait">&#10003;</span>' : '') +
    '</div>';
  }).join('') || '<div class="empty">Aucun rappel ni rendez-vous</div>';

  var liensHtml = liensOfClient(id).map(function (l) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)">' +
      '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--ac);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">' + esc(l.libelle || l.url) + '</a>' +
      '<span class="dv-x" onclick="deleteLien(\'' + l.id + '\',\'' + id + '\')" title="Supprimer">&times;</span>' +
    '</div>';
  }).join('') || '<div class="empty">Aucun lien</div>';

  var accesHtml = accesOfClient(id).map(function (a) {
    return '<div style="padding:8px 0;border-bottom:1px solid var(--bd)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">' +
        '<div style="min-width:0;flex:1"><span class="pill" style="background:var(--s3);color:var(--mu)">' + esc(ACCES_LABELS[a.type] || a.type || 'Acces') + '</span> <span style="font-size:11px;color:var(--tx)">' + esc(a.libelle || '') + '</span></div>' +
        '<span class="dv-x" onclick="deleteAcces(\'' + a.id + '\',\'' + id + '\')" title="Supprimer">&times;</span>' +
      '</div>' +
      (a.url ? '<div style="font-size:10px;margin-top:3px"><a href="' + esc(a.url) + '" target="_blank" rel="noopener" style="color:var(--ac);text-decoration:none;word-break:break-all">' + esc(a.url) + '</a></div>' : '') +
      (a.identifiant ? '<div style="font-size:10px;color:var(--mu);margin-top:2px">Identifiant : <span style="color:var(--tx)">' + esc(a.identifiant) + '</span></div>' : '') +
      (a.secret ? '<div style="font-size:10px;color:var(--mu);margin-top:2px">Mot de passe : <span class="secret" onclick="this.classList.toggle(\'show\')" title="Clic pour afficher">' + esc(a.secret) + '</span></div>' : '') +
      (a.notes ? '<div style="font-size:10px;color:var(--mu2);margin-top:2px">' + esc(a.notes) + '</div>' : '') +
    '</div>';
  }).join('') || '<div class="empty">Aucun acces enregistre</div>';

  el('pb').innerHTML =
    section('Prochaine etape', nextStepHtml(c)) +
    section('Coordonnees', infos) +
    section('Etape du pipeline', '<div style="display:flex;gap:4px;flex-wrap:wrap">' + stepBtns + '</div>') +
    section('Rappels et rendez-vous', '<div style="display:flex;gap:6px;margin-bottom:8px"><button class="btn bg bsm" onclick="quickRappel(\'' + id + '\')">+ Rappel</button><button class="btn bg bsm" onclick="quickRdv(\'' + id + '\')">+ RDV</button></div>' + rappelsHtml) +
    section('Cadrage (questionnaire)', '<button class="btn bg bsm" style="margin-bottom:8px" onclick="openCadrage(\'' + id + '\')">Ouvrir la fiche de cadrage</button>' + cad) +
    section('Liens', '<button class="btn bg bsm" style="margin-bottom:8px" onclick="openLienForm(\'' + id + '\')">+ Ajouter un lien</button>' + liensHtml) +
    section('Interactions', '<button class="btn bg bsm" style="margin-bottom:8px" onclick="openInteractionForm(\'' + id + '\')">+ Ajouter</button>' + interHtml) +
    section('Projets', projets) +
    section('Devis', devis) +
    section('Factures', factures) +
    section('Hebergement', heberg) +
    section('Acces et livraison', '<button class="btn bg bsm" style="margin-bottom:8px" onclick="openAccesForm(\'' + id + '\')">+ Ajouter un acces</button>' + accesHtml);

  openPanel();
}
function kv(k, v) { if (!v) return ''; return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span style="color:var(--mu)">' + esc(k) + '</span><span style="color:var(--tx);text-align:right">' + esc(v) + '</span></div>'; }
function section(title, body) { return '<div style="margin-bottom:16px"><div class="syne" style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mu);margin-bottom:8px">' + esc(title) + '</div>' + body + '</div>'; }

async function setClientStage(id, st) {
  await updateRow('web_clients', id, { statut_pipeline: st });
  await maybeAutoRappel(id, st);
  await loadAll();
  openClientPanel(id); if (UI.view === 'pipeline') renderPipeline(); badges();
}

// ── Formulaire client ──
function openClientForm(id) {
  var c = id ? clientById(id) : null;
  var _defStage = c ? c.statut_pipeline : 'contacte';
  var stOpts = PIPE_ORDER.map(function (s) { return '<option value="' + s + '"' + (_defStage === s ? ' selected' : '') + '>' + PIPE_LABELS[s] + '</option>'; }).join('');
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
  var fmOpts = Object.keys(FORMULE_LABELS).map(function (k) { return '<option value="' + k + '"' + (p && p.formule === k ? ' selected' : (!p && k === 'vitrine' ? ' selected' : '')) + '>' + FORMULE_LABELS[k] + ' - ' + (FORMULE_PRICE[k] ? fmtEUR(FORMULE_PRICE[k]) : 'sur devis') + ' - ' + FORMULE_DELAI[k] + '</option>'; }).join('');
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
    return '<tr onclick="openDevisPanel(\'' + d.id + '\')"><td>' + esc(d.numero) + '</td><td>' + esc(clientName(d.client_id)) + '</td><td>' + fmtDateFR(d.date_emission) + '</td><td>' + fmtEUR(d.total_ht) + '</td><td style="font-size:10px;color:var(--mu)">' + esc(window.NOVCFG.planLabel(planOf(d))) + '</td><td>' + statutDevisPill(d.statut) + '</td><td>' + acts + '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="empty">Aucun devis</td></tr>';
  var dflt = planFromPct(window.NOVCFG.defaultPct(), 0);
  var proc =
    '<div class="sites-legal" style="margin-bottom:14px">' +
    '<b style="color:var(--tx)">Le devis vaut contrat. Echeancier choisi devis par devis</b> (defaut : ' + window.NOVCFG.planLabel(dflt) + ', modifiable dans les Parametres). Circuit : ' +
    '<b>1.</b> Devis-contrat signe (bon pour accord) &rarr; <b>2.</b> Facture reglee (acompte, ou totalite selon l\'echeancier) &rarr; <b>3.</b> Realisation + lien d\'apercu prive &rarr; ' +
    '<b>4.</b> Validation du client &rarr; <b>5.</b> Solde regle &rarr; <b>6.</b> Mise en ligne.' +
    '<br><span style="color:var(--mu2)">Astuce : <b>Envoyer</b> genere le lien de signature. La signature bascule le devis en \u00ab accepte \u00bb et prepare la facture automatiquement.</span>' +
    '</div>';
  el('view-devis').innerHTML = proc +
    '<table class="tbl"><thead><tr><th>Numero</th><th>Client</th><th>Emis le</th><th>Total HT</th><th>Echeancier</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
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
  var plan0 = planOf(d);
  el('pb').innerHTML =
    section('Recapitulatif', '<table class="tbl"><thead><tr><th>Designation</th><th style="text-align:right">Qte</th><th style="text-align:right">PU HT</th><th style="text-align:right">Total</th></tr></thead><tbody>' + lignes + '</tbody></table>' +
      '<div style="text-align:right;font-family:Syne,sans-serif;font-weight:700;font-size:15px;margin-top:8px">Total HT : ' + fmtEUR(d.total_ht, 2) + '</div>') +
    section('Echeancier', '<div class="sites-legal">' + esc(window.NOVCFG.echeancierCourt(plan0)) + '</div>' +
      (d.statut === 'brouillon' || d.statut === 'envoye'
        ? '<button class="btn bg bsm" style="margin-top:6px" onclick="openEcheancier(\'' + d.id + '\')">Changer l\'echeancier</button>'
        : '')) +
    section('Mentions', '<div class="sites-legal">' + esc(d.mentions || defaultMentions(plan0)) + '</div>') +
    (d.signature_ref ? section('Signature', '<div class="pill sw-signe">Signe &middot; ' + esc(d.signature_ref) + '</div>') : '') +
    section('Lien de signature (bon pour accord)', '<div style="font-size:10px;color:var(--mu);word-break:break-all;background:var(--s3);padding:8px;border-radius:var(--r)">' + esc(signLink) + '</div><button class="btn bg bsm" style="margin-top:6px" onclick="copyText(\'' + esc(signLink).replace(/'/g, '') + '\')">Copier le lien</button>');
  var acmpt = acompteFactureForDevis(id), sld = soldeFactureForDevis(id);
  var plan = planOf(d);
  var facBtns = '';
  if (d.statut === 'accepte') {
    if (plan.mode === 'commande') {
      facBtns = acmpt ? '<span class="pill" style="background:var(--s3);color:var(--green);align-self:center">Facture emise</span>'
                      : '<button class="btn bs bsm" onclick="createAcompte(\'' + id + '\')">Facturer la totalite</button>';
    } else if (plan.mode === 'livraison') {
      facBtns = sld ? '<span class="pill" style="background:var(--s3);color:var(--green);align-self:center">Facture emise</span>'
                    : '<button class="btn bs bsm" onclick="createSolde(\'' + id + '\')">Facturer la totalite</button>';
    } else if (!acmpt) {
      facBtns = '<button class="btn bs bsm" onclick="createAcompte(\'' + id + '\')">Facture d\'acompte ' + plan.pct + ' %</button>';
    } else if (!sld) {
      facBtns = '<button class="btn bs bsm" onclick="createSolde(\'' + id + '\')">Facture de solde ' + plan.soldePct + ' %</button>';
    } else {
      facBtns = '<span class="pill" style="background:var(--s3);color:var(--green);align-self:center">Acompte + solde factures</span>';
    }
  }
  el('pa').innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
    '<button class="btn bg bsm" onclick="devisPDF(\'' + id + '\')">PDF</button>' +
    (d.statut !== 'accepte' ? '<button class="btn bi bsm" onclick="sendDevis(\'' + id + '\')">Envoyer</button>' : '') +
    facBtns +
    (d.statut !== 'accepte' && d.statut !== 'refuse' ? '<button class="btn bg bsm" onclick="setDevisStatut(\'' + id + '\',\'refuse\')">Refuse</button>' : '') +
    '<button class="btn bd_ bsm" onclick="deleteDevis(\'' + id + '\')">Supprimer</button>' +
    '</div>';
  openPanel();
}

function openDevisForm(clientId, projetId, id) {
  var d = id ? devisById(id) : null;
  if (d) { clientId = d.client_id; projetId = d.projet_id; }
  if (!DB.clients.length) { toast('Cree d\'abord un client', 'w'); return; }
  var cliOpts = DB.clients.map(function (c) { return '<option value="' + c.id + '"' + (clientId === c.id ? ' selected' : '') + '>' + esc(c.entreprise) + '</option>'; }).join('');

  // lignes initiales : depuis le devis, sinon depuis le projet lie, sinon une ligne vide
  _dvPct = d ? planOf(d).pct : window.NOVCFG.defaultPct();
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
    '<div class="fgrp"><label class="lbl">Validite jusqu\'au</label><input id="d-validite" type="date" value="' + (d && d.validite ? esc(d.validite) : addDaysISO(num(window.NOVCFG.fac().validite_devis_j) || 30)) + '"></div></div>' +
    echeancierPickerHtml() +
    '<div class="fgrp"><label class="lbl">Lignes</label><div class="dv-line-h"><span>Designation</span><span>Qte</span><span>PU HT</span><span>Total</span><span></span></div><div id="d-lines"></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">' +
    '<button class="btn bg bsm" onclick="dvAddLine()">+ Ligne libre</button>' +
    '<select id="d-cat" class="ff" style="max-width:280px" onchange="dvAddFromCatalog(this.value);this.value=\'\'"><option value="">+ Depuis le catalogue...</option>' +
      catalogue().map(function (c, i) { return '<option value="' + i + '">' + esc(c.label) + ' (' + fmtEUR(c.prix) + ')</option>'; }).join('') +
    '</select></div>' +
    '<div style="font-size:9px;color:var(--mu2);margin-top:5px">Prestations mensuelles a facturer separement : ' + catalogueRec().map(function (c) { return esc(c.label) + ' ' + fmtEUR(c.prix) + '/mois'; }).join(' ; ') + '</div></div>' +
    '<div style="text-align:right;margin:8px 0">' +
      '<div id="d-total" style="font-family:Syne,sans-serif;font-weight:700;font-size:16px">Total HT : ' + fmtEUR(0, 2) + '</div>' +
      '<div id="d-plan" style="font-size:11px;color:var(--mu);margin-top:3px"></div>' +
    '</div>' +
    manquesBanner() +
    '<div class="sites-legal">Ce devis <b>vaut contrat</b> une fois signe "bon pour accord".<br>' + esc(ENTREPRISE.nom_commercial) + ' - ' + esc(ENTREPRISE.exploitant) + ' &middot; SIRET <b>' + esc(SIRET) + '</b> &middot; <b>' + esc(TVA_MENTION) + '</b><br>Les articles des conditions (paiement, propriete, delais, revisions, litiges...) sont ajoutes automatiquement au PDF et modifiables dans les <b>Parametres</b>.</div>';
  var f = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteDevis(\'' + id + '\')">Supprimer</button>' : '') +
    '<button class="btn bp" onclick="saveDevis(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier le devis' : 'Nouveau devis', b, f);
  dvRenderLines();
}
// ── Selecteur d'echeancier (partage : formulaire devis + premier RDV) ──
function echeancierPickerHtml() {
  var presets = [
    { v: 30,  l: '30 / 70' },
    { v: 50,  l: '50 / 50' },
    { v: 0,   l: '100 % livraison' },
    { v: 100, l: '100 % commande' }
  ];
  var btns = presets.map(function (p) {
    return '<button type="button" class="btn ' + (num(_dvPct) === p.v ? 'bp' : 'bg') + ' bxs" id="ech-b-' + p.v + '" onclick="setDvPct(' + p.v + ')">' + p.l + '</button>';
  }).join(' ');
  return '<div class="fgrp"><label class="lbl">Echeancier</label>' +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">' + btns +
    '<span style="display:flex;align-items:center;gap:5px;margin-left:4px">' +
      '<input type="number" id="ech-pct" min="0" max="100" step="5" value="' + num(_dvPct) + '" oninput="setDvPct(this.value,1)" style="width:74px">' +
      '<span style="font-size:10px;color:var(--mu)">% a la signature</span>' +
    '</span></div>' +
    '<div id="ech-hint" style="font-size:10px;color:var(--mu2);margin-top:5px"></div></div>';
}
function setDvPct(v, fromInput) {
  _dvPct = Math.max(0, Math.min(100, num(v)));
  [0, 30, 50, 100].forEach(function (p) {
    var b = el('ech-b-' + p);
    if (b) b.className = 'btn ' + (_dvPct === p ? 'bp' : 'bg') + ' bxs';
  });
  var inp = el('ech-pct');
  if (inp && !fromInput) inp.value = _dvPct;
  dvSummary();
}

// Changer l'echeancier d'un devis existant (tant qu'il n'est pas signe)
function openEcheancier(id) {
  var d = devisById(id); if (!d) return;
  if (d.statut === 'accepte') { toast('Devis signe : l\'echeancier ne peut plus changer', 'w'); return; }
  _dvPct = planOf(d).pct;
  _dvLines = (d.lignes || []).map(function (l) { return { designation: l.designation, quantite: num(l.quantite), pu_ht: num(l.pu_ht) }; });
  var b = '<div class="sites-legal" style="margin-bottom:10px">Devis <b>' + esc(d.numero) + '</b> &middot; ' + fmtEUR(d.total_ht, 2) + ' HT</div>' +
    echeancierPickerHtml() +
    '<div id="d-total" style="display:none"></div>';
  openMo('Echeancier du devis', b,
    '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    '<button class="btn bp" onclick="saveEcheancier(\'' + id + '\')">Appliquer</button>');
  setDvPct(_dvPct);
}
async function saveEcheancier(id) {
  var d = devisById(id); if (!d) return;
  var patch = { acompte_pct: _dvPct };
  var plan = planFromPct(_dvPct, d.total_ht);
  patch.mentions = defaultMentions(plan);
  var r = await sbUpdate('web_devis', id, patch);
  if (!r.ok) { toast('Erreur : ' + r.error, 'e'); return; }
  closeMo(); toast('Echeancier : ' + window.NOVCFG.planLabel(plan), 's');
  await loadAll(); openDevisPanel(id); if (UI.view === 'devis') renderDevis();
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
  dvSummary();
}
function dvSummary() {
  var t = dvTotal();
  var tot = el('d-total'); if (tot) tot.textContent = 'Total HT : ' + fmtEUR(t, 2);
  var plan = planFromPct(_dvPct == null ? window.NOVCFG.defaultPct() : _dvPct, t);
  var txt;
  if (plan.mode === 'commande') txt = 'Reglement unique a la signature : <b style="color:var(--ac)">' + fmtEUR(plan.total, 2) + '</b>';
  else if (plan.mode === 'livraison') txt = 'Reglement unique a la livraison : <b style="color:var(--ac)">' + fmtEUR(plan.total, 2) + '</b>';
  else txt = 'Acompte ' + plan.pct + ' % : <b style="color:var(--ac)">' + fmtEUR(plan.acompte, 2) + '</b> &nbsp;&middot;&nbsp; Solde ' + plan.soldePct + ' % : <b style="color:var(--tx)">' + fmtEUR(plan.solde, 2) + '</b>';
  var p = el('d-plan'); if (p) p.innerHTML = txt;
  var h = el('ech-hint'); if (h) h.innerHTML = txt;
  // compat : anciens conteneurs
  var a = el('d-acompte'); if (a) a.textContent = fmtEUR(plan.acompte, 2);
  var sd = el('d-solde'); if (sd) sd.textContent = fmtEUR(plan.solde, 2);
}
// Bandeau d'alerte si des informations legales manquent (adresse, IBAN...)
function manquesBanner() {
  var m = window.NOVCFG.manques();
  if (!m.length) return '';
  return '<div class="sites-legal" style="border-color:var(--orange);color:var(--orange);margin-bottom:8px">' +
    'Il manque <b>' + esc(m.join(', ')) + '</b> sur tes documents. ' +
    '<span class="btn bg bxs" onclick="openSettings()">Completer les parametres</span></div>';
}
function catalogue() { return window.NOVCFG.catalogue(); }
function catalogueRec() { return window.NOVCFG.catalogueRecurrent(); }
function dvEdit(i, k, v) { _dvLines[i][k] = (k === 'designation') ? v : num(v); if (k !== 'designation') dvRenderLines(); else dvSummary(); }
function dvAddLine() { _dvLines.push({ designation: '', quantite: 1, pu_ht: 0 }); dvRenderLines(); }
function dvAddFromCatalog(i) {
  if (i === '' || i == null) return;
  var c = catalogue()[parseInt(i, 10)]; if (!c) return;
  var empty = _dvLines.findIndex(function (l) { return !(l.designation || '').trim(); });
  var line = { designation: c.label, quantite: 1, pu_ht: c.prix };
  if (empty >= 0) _dvLines[empty] = line; else _dvLines.push(line);
  dvRenderLines();
}
function dvRemoveLine(i) { _dvLines.splice(i, 1); if (!_dvLines.length) _dvLines.push({ designation: '', quantite: 1, pu_ht: 0 }); dvRenderLines(); }
function dvTotal() { return _dvLines.reduce(function (a, l) { return a + num(l.quantite) * num(l.pu_ht); }, 0); }
// ── Conditions du devis-contrat (source : Parametres > Contrat) ──
// Les articles sont modifiables dans les Parametres ; {echeancier} est
// remplace par la phrase de paiement correspondant a CE devis.
function contratArticles(plan) {
  return window.NOVCFG.conditions(plan || planFromPct(window.NOVCFG.defaultPct(), 0));
}
// Texte compact stocke sur le devis et affiche sur la page de signature.
function defaultMentions(plan) {
  plan = plan || planFromPct(window.NOVCFG.defaultPct(), 0);
  var e = window.NOVCFG.ent();
  var head = e.nom_commercial + ' - ' + e.exploitant + (e.adresse ? ' - ' + e.adresse : '') + ' - SIRET ' + e.siret + '. ' + e.tva + '.\n' +
    'Devis valant contrat de prestation : la signature "bon pour accord" engage les parties.\n' +
    window.NOVCFG.echeancierPhrase(plan) + '\n' +
    'Offre valable ' + (num(window.NOVCFG.fac().validite_devis_j) || 30) + ' jours.\n';
  return head + contratArticles(plan).map(function (a) { return a.t + ' - ' + a.b; }).join('\n');
}

async function saveDevis(id) {
  var clientId = el('d-client').value;
  var lignes = _dvLines.filter(function (l) { return (l.designation || '').trim(); }).map(function (l) { return { designation: l.designation.trim(), quantite: num(l.quantite), pu_ht: num(l.pu_ht) }; });
  if (!lignes.length) { toast('Ajoute au moins une ligne', 'e'); return; }
  var total = lignes.reduce(function (a, l) { return a + l.quantite * l.pu_ht; }, 0);
  var pct = (_dvPct == null) ? window.NOVCFG.defaultPct() : _dvPct;
  var plan = planFromPct(pct, total);
  var payload = {
    client_id: clientId, projet_id: el('d-projet').value || null,
    date_emission: el('d-date').value || todayISO(), validite: el('d-validite').value || null,
    lignes: lignes, total_ht: Math.round(total * 100) / 100,
    acompte_pct: pct, mentions: defaultMentions(plan)
  };
  var r;
  if (id) { r = await sbUpdate('web_devis', id, payload); }
  else {
    payload.numero = await nextNumber('DEV');
    payload.statut = 'brouillon';
    r = await sbInsert('web_devis', payload);
  }
  if (!r.ok) { toast('Erreur : ' + r.error, 'e'); return; }
  closeMo(); toast('Devis enregistre &middot; ' + window.NOVCFG.planLabel(plan), 's');
  await loadAll(); go('devis');
}
async function deleteDevis(id) {
  var d = devisById(id);
  var facs = DB.factures.filter(function (f) { return f.devis_id === id && f.statut !== 'annulee'; });
  var emises = facs.filter(function (f) { return f.statut !== 'brouillon'; });
  if (emises.length) {
    toast(emises.length + ' facture(s) emise(s) liee(s) : suppression impossible (une facture emise est inalterable, avoir uniquement).', 'e');
    return;
  }
  var msg = 'Supprimer le devis ' + (d ? d.numero : '') + ' ?';
  if (facs.length) msg += '\n\n' + facs.length + ' brouillon(s) de facture lie(s) : pense a les supprimer aussi.';
  if (!confirm(msg)) return;
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
  var plan = planOf(d);
  var e = window.NOVCFG.ent();
  var subject = 'Votre devis ' + d.numero + ' - ' + e.nom_commercial + ' (creation de site internet)';
  var body = window.NOVCFG.fill(window.NOVCFG.doc().email_devis, {
    contact     : (c && c.contact_nom) ? c.contact_nom : '',
    client      : c ? c.entreprise : '',
    numero      : d.numero,
    total       : fmtEUR(d.total_ht, 2),
    acompte     : fmtEUR(plan.acompte, 2),
    solde       : fmtEUR(plan.solde, 2),
    acompte_pct : plan.pct,
    solde_pct   : plan.soldePct,
    lien        : link,
    etapes      : window.NOVCFG.etapesTexte(plan),
    validite_j  : num(window.NOVCFG.fac().validite_devis_j) || 30,
    tva         : e.tva,
    entreprise  : e.nom_commercial,
    exploitant  : e.exploitant,
    baseline    : e.baseline,
    tel         : e.tel,
    email       : e.email
  }).replace(/Bonjour ,/, 'Bonjour,');

  await updateRow('web_devis', id, { statut: 'envoye' }); d.statut = 'envoye';

  if (!to) {
    toast('Pas d\'email client : lien de signature copie', 'w');
    copyText(link);
    if (UI.view === 'devis') renderDevis(); openDevisPanel(id); badges();
    return;
  }
  var atts = [];
  if (window.NOVCFG.auto().joindre_pdf) {
    var pj = devisPDF(id, true);
    if (pj) atts.push(pj);
  }
  var sent = await trySendEmail({ to: to, subject: subject, body: body, from_name: e.nom_commercial + ' - Sites Internet', attachments: atts });
  if (sent) {
    toast('Devis envoye a ' + to, 's');
    await logInteraction(d.client_id, 'email', 'Devis ' + d.numero + ' envoye a ' + to + ' (' + window.NOVCFG.planLabel(plan) + ')');
  } else {
    var mailto = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body.replace('[Signer le devis](' + link + ')', link));
    window.open(mailto, '_blank');
    toast('Email pret dans votre messagerie', 'i');
  }
  if (UI.view === 'devis') renderDevis(); openDevisPanel(id); badges();
}

// Trace un echange sur la fiche client (best-effort)
async function logInteraction(clientId, type, contenu) {
  if (!clientId) return;
  try { await getSB().from('web_interactions').insert({ client_id: clientId, type: type, contenu: contenu, date: nowISO() }); }
  catch (e) { /* non bloquant */ }
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

// ── Boite a outils PDF partagee (devis-contrat + facture) ──
function pdfCtor() { return (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF || null); }
function eur(n) { return fmtEUR(num(n), 2).replace('EUR', 'E').replace(/[\u00a0\u202f\u2009]/g, ' '); }
function pdfKit(doc) {
  var M = 18, W = 210, H = 297, bottom = 280;
  var kit = {
    M: M, W: W, H: H, y: 20,
    footer: function (docType) {
      var pg = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 142); doc.setFontSize(7);
      doc.text([ENTREPRISE.nom_commercial, ENTREPRISE.siret ? 'SIRET ' + ENTREPRISE.siret : '', ENTREPRISE.email, ENTREPRISE.tel].filter(Boolean).join('  -  '), M, 288);
      doc.text((docType || '') + '  -  page ' + pg, W - M, 288, { align: 'right' });
    },
    space: function (need, docType) { if (this.y + need > bottom) { kit.footer(docType); doc.addPage(); this.y = 20; } },
    hr: function (color) { var c = color || [224, 169, 46]; doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(0.6); doc.line(M, this.y, W - M, this.y); }
  };
  return kit;
}
function pdfHeader(doc, k, rightTitle, numero, lines) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(26, 20, 6);
  doc.text(ENTREPRISE.nom_commercial, k.M, k.y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 110);
  doc.text(ENTREPRISE.baseline || 'Creation de sites internet', k.M, k.y + 5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(60, 60, 55);
  doc.text(rightTitle, k.W - k.M, k.y, { align: 'right' });
  doc.setFontSize(12); doc.setTextColor(26, 20, 6);
  doc.text(numero, k.W - k.M, k.y + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 90, 84);
  var yy = k.y + 11;
  (lines || []).forEach(function (t) { doc.text(t, k.W - k.M, yy, { align: 'right' }); yy += 4; });
  k.y += 26; k.hr(); k.y += 8;
}
// Bloc "Prestataire" (gauche) + "Client" (droite)
function pdfParties(doc, k, c) {
  var startY = k.y, colR = 112;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 26);
  doc.text('Prestataire', k.M, k.y);
  doc.text('Client', colR, k.y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70, 70, 64);
  var L = [ENTREPRISE.exploitant, ENTREPRISE.forme, ENTREPRISE.adresse, 'SIRET ' + ENTREPRISE.siret, ENTREPRISE.tva, ENTREPRISE.email, ENTREPRISE.tel].filter(Boolean);
  var R = [c ? c.entreprise : '', c && c.contact_nom ? c.contact_nom : '', c && c.ville ? c.ville : '', c && c.email ? c.email : '', c && c.telephone ? c.telephone : ''].filter(Boolean);
  var yl = k.y + 5, yr = k.y + 5, n = Math.max(L.length, R.length);
  for (var i = 0; i < n; i++) {
    if (L[i]) { doc.text(doc.splitTextToSize(String(L[i]), 88), k.M, yl); yl += 4.2; }
    if (R[i]) { doc.text(doc.splitTextToSize(String(R[i]), 80), colR, yr); yr += 4.2; }
  }
  k.y = Math.max(yl, yr) + 4;
}

// ── PDF du devis-contrat (jsPDF, multi-pages) ──
// asAttachment = true : ne telecharge pas, renvoie {filename, content, type}
function devisPDF(id, asAttachment) {
  var d = devisById(id); if (!d) return null;
  var c = clientById(d.client_id);
  var plan = planOf(d);
  var ctor = pdfCtor(); if (!ctor) { toast('Generateur PDF indisponible', 'e'); return null; }
  var doc = new ctor({ unit: 'mm', format: 'a4' });
  var k = pdfKit(doc), DT = 'Devis-contrat ' + d.numero;
  var hLines = ['Emis le ' + fmtDateFR(d.date_emission)];
  if (d.validite) hLines.push('Valable jusqu au ' + fmtDateFR(d.validite));
  pdfHeader(doc, k, 'DEVIS - VALANT CONTRAT', d.numero, hLines);
  pdfParties(doc, k, c);

  // Bandeau paiement (l'essentiel du process, tout de suite visible)
  doc.setFillColor(252, 246, 232); doc.setDrawColor(224, 169, 46); doc.setLineWidth(0.3);
  doc.roundedRect(k.M, k.y, k.W - 2 * k.M, 11, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(120, 90, 20);
  doc.text(window.NOVCFG.echeancierCourt(plan), k.M + 3, k.y + 4.6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140, 110, 40);
  doc.text('Le devis signe "bon pour accord" vaut contrat. Mise en ligne du site apres encaissement integral.', k.M + 3, k.y + 8.4);
  k.y += 16;

  // Tableau des prestations
  doc.setFillColor(245, 243, 239); doc.rect(k.M, k.y, k.W - 2 * k.M, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(40, 40, 36);
  doc.text('Designation', k.M + 2, k.y + 5.5);
  doc.text('Qte', 130, k.y + 5.5, { align: 'right' });
  doc.text('PU HT', 158, k.y + 5.5, { align: 'right' });
  doc.text('Total HT', k.W - k.M - 2, k.y + 5.5, { align: 'right' });
  k.y += 10;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 46);
  (d.lignes || []).forEach(function (l) {
    var desig = doc.splitTextToSize(String(l.designation || ''), 105);
    var rowH = Math.max(6, desig.length * 4.5);
    k.space(rowH + 2, DT);
    doc.text(desig, k.M + 2, k.y);
    doc.text(String(num(l.quantite)), 130, k.y, { align: 'right' });
    doc.text(eur(l.pu_ht), 158, k.y, { align: 'right' });
    doc.text(eur(num(l.quantite) * num(l.pu_ht)), k.W - k.M - 2, k.y, { align: 'right' });
    k.y += rowH;
  });
  k.y += 2; doc.setDrawColor(220, 220, 212); doc.line(k.M, k.y, k.W - k.M, k.y); k.y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 20, 6);
  doc.text('TOTAL HT : ' + eur(d.total_ht), k.W - k.M, k.y, { align: 'right' });
  k.y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 84);
  if (plan.mode === 'deux') {
    doc.text('Acompte ' + plan.pct + ' % a la signature : ' + eur(plan.acompte) + '     Solde ' + plan.soldePct + ' % a la livraison : ' + eur(plan.solde), k.W - k.M, k.y, { align: 'right' });
  } else {
    doc.text(plan.mode === 'commande' ? 'Reglement integral a la signature' : 'Reglement integral a la livraison, avant mise en ligne', k.W - k.M, k.y, { align: 'right' });
  }
  k.y += 12;

  // Arguments de vente (bloc libre, modifiable dans les Parametres)
  var argus = window.NOVCFG.argumentaireLines();
  if (argus.length) {
    k.space(12 + argus.length * 4.6, DT);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 30, 26);
    doc.text('Ce qui est compris', k.M, k.y); k.y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 74);
    argus.forEach(function (a) {
      var lines = doc.splitTextToSize(a, k.W - 2 * k.M - 5);
      k.space(lines.length * 4 + 2, DT);
      doc.setTextColor(200, 150, 40); doc.text('-', k.M, k.y);
      doc.setTextColor(80, 80, 74); doc.text(lines, k.M + 4, k.y);
      k.y += lines.length * 4 + 1.4;
    });
    k.y += 6;
  }

  // Conditions (le contrat proprement dit)
  k.space(14, DT);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 30, 26);
  doc.text('Conditions du contrat', k.M, k.y); k.y += 6;
  contratArticles(plan).forEach(function (a) {
    var body = doc.splitTextToSize(a.b.replace(/\u00a0/g, ' '), k.W - 2 * k.M);
    k.space(6 + body.length * 3.8 + 3, DT);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(50, 50, 46);
    doc.text(a.t, k.M, k.y); k.y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(95, 95, 88);
    doc.text(body, k.M, k.y); k.y += body.length * 3.8 + 3;
  });

  // Bloc signature "bon pour accord"
  k.space(52, DT);
  k.y += 4; k.hr([220, 220, 212]); k.y += 7;
  var signed = !!(d.signature_ref || d.statut === 'accepte');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 26);
  doc.text('Bon pour accord', k.M, k.y); k.y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(95, 95, 88);
  doc.text(doc.splitTextToSize('Le client reconnait avoir pris connaissance du devis et des conditions ci-dessus, et les accepter. La signature manuscrite "bon pour accord" ou la signature electronique via le lien recu ont la meme valeur.', k.W - 2 * k.M), k.M, k.y);
  k.y += 12;
  var boxW = (k.W - 2 * k.M - 8) / 2, bx1 = k.M, bx2 = k.M + boxW + 8, boxTop = k.y;
  doc.setDrawColor(210, 210, 202); doc.setLineWidth(0.3);
  doc.roundedRect(bx1, boxTop, boxW, 30, 1.5, 1.5); doc.roundedRect(bx2, boxTop, boxW, 30, 1.5, 1.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(70, 70, 64);
  doc.text('Le prestataire', bx1 + 3, boxTop + 5);
  doc.text('Le client (bon pour accord)', bx2 + 3, boxTop + 5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 112);
  doc.text(ENTREPRISE.exploitant + ' - ' + ENTREPRISE.nom_commercial, bx1 + 3, boxTop + 10);
  if (signed) {
    doc.setTextColor(30, 140, 90); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('SIGNE ELECTRONIQUEMENT', bx2 + 3, boxTop + 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(90, 120, 100);
    doc.text(doc.splitTextToSize('Reference : ' + (d.signature_ref || d.numero + '-BPA') + '. Signature eIDAS enregistree, preuve conservee (horodatage, empreinte du devis).', boxW - 6), bx2 + 3, boxTop + 17);
  } else {
    doc.text('Date et signature :', bx2 + 3, boxTop + 12);
  }
  k.y = boxTop + 34;

  var pied = window.NOVCFG.fill(window.NOVCFG.doc().devis_pied, { validite_j: num(window.NOVCFG.fac().validite_devis_j) || 30 });
  if (pied) {
    k.space(10, DT);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(140, 140, 132);
    doc.text(doc.splitTextToSize(pied, k.W - 2 * k.M), k.M, k.y);
  }

  k.footer(DT);
  if (asAttachment) return pdfAttachment(doc, d.numero + '.pdf');
  doc.save(d.numero + '.pdf');
  toast('Devis-contrat genere', 's');
  return null;
}

// Convertit un document jsPDF en piece jointe base64 pour /api/send-email
function pdfAttachment(doc, filename) {
  try {
    var uri = doc.output('datauristring');
    var b64 = uri.substring(uri.indexOf('base64,') + 7);
    return { filename: filename, content: b64, type: 'application/pdf' };
  } catch (e) { return null; }
}

// ── Facturation, pilotee par l'echeancier du devis ──────────────────
// Cree une facture (brouillon) a partir d'un devis signe.
// Echeancier 100 % (commande ou livraison) : une seule facture du total.
async function createFactureFromDevis(id, type, silencieux) {
  var d = devisById(id); if (!d) { toast('Devis introuvable', 'e'); return null; }
  if (d.statut !== 'accepte') { toast('Le devis doit etre signe (accepte) avant facturation', 'w'); return null; }
  var plan = planOf(d);
  var isAcompte = (type === 'acompte');
  if (plan.mode === 'commande') isAcompte = true;
  if (plan.mode === 'livraison') isAcompte = false;

  var deja = isAcompte ? acompteFactureForDevis(id) : soldeFactureForDevis(id);
  if (deja) { if (!silencieux) toast('Cette facture existe deja pour ce devis (' + deja.numero + ')', 'w'); return null; }
  if (!plan.unique && !isAcompte && !acompteFactureForDevis(id)) {
    if (!silencieux && !confirm('Aucune facture d\'acompte pour ce devis. Creer directement la facture de solde (' + plan.soldePct + ' %) ?\n\nEn general on facture d\'abord l\'acompte.')) return null;
  }

  var montant = plan.unique ? plan.total : (isAcompte ? plan.acompte : plan.solde);
  if (montant <= 0) { if (!silencieux) toast('Montant nul : rien a facturer', 'w'); return null; }
  var F = window.NOVCFG.fac();
  var delai = isAcompte ? (num(F.delai_acompte_j) || 15) : (num(F.delai_solde_j) || 30);
  var desig = plan.unique
    ? 'Creation de site internet'
    : (isAcompte ? 'Acompte ' + plan.pct + ' % - creation de site internet' : 'Solde ' + plan.soldePct + ' % - creation de site internet');

  var payload = {
    client_id: d.client_id, projet_id: d.projet_id || null, devis_id: d.id,
    numero: await nextNumber('FAC'), type: isAcompte ? 'acompte' : 'solde',
    montant_ht: montant, designation: desig, date_emission: todayISO(),
    date_echeance: addDaysISO(delai), statut: 'brouillon'
  };
  var r = await sbInsert('web_factures', payload);
  if (!r.ok) { toast('Erreur : ' + r.error, 'e'); return null; }
  if (!silencieux) {
    closeMo();
    toast('Facture ' + payload.numero + ' creee (brouillon) : ' + esc(desig), 's');
    await loadAll(); go('factures');
  }
  return r.data || payload;
}
function createAcompte(id) { return createFactureFromDevis(id, 'acompte'); }
function createSolde(id)   { return createFactureFromDevis(id, 'solde'); }
// Raccourci fiche : cree la prochaine facture manquante du devis
function convertDevis(id) {
  var d = devisById(id); if (!d) return;
  var plan = planOf(d);
  if (plan.mode === 'commande') return acompteFactureForDevis(id) ? toast('Deja facture', 'i') : createAcompte(id);
  if (plan.mode === 'livraison') return soldeFactureForDevis(id) ? toast('Deja facture', 'i') : createSolde(id);
  if (!acompteFactureForDevis(id)) return createAcompte(id);
  if (!soldeFactureForDevis(id)) return createSolde(id);
  toast('Acompte et solde deja factures pour ce devis', 'i');
}
function doConvertDevis(id) { return convertDevis(id); }

// ═══════════════════════════════════════════════════════════════════
// FACTURES
// ═══════════════════════════════════════════════════════════════════
function renderFactures() {
  var rows = DB.factures.map(function (f) {
    var d = daysUntil(f.date_echeance);
    var late = (f.statut === 'emise' || f.statut === 'relancee') && d != null && d < 0;
    var acts = '<div class="acol" onclick="event.stopPropagation()">';
    acts += '<span class="btn bg bxs" onclick="facturePDF(\'' + f.id + '\')">PDF</span>';
    if (f.statut === 'brouillon') {
      acts += '<span class="btn bi bxs" onclick="emitFacture(\'' + f.id + '\')">Emettre</span>' +
              '<span class="btn bg bxs" onclick="openFactureForm(null,null,\'' + f.id + '\')">Editer</span>' +
              '<span class="btn bd_ bxs" onclick="deleteFacture(\'' + f.id + '\')">Suppr.</span>';
    }
    if (f.statut === 'emise' || f.statut === 'relancee') {
      acts += '<span class="btn bi bxs" onclick="sendFacture(\'' + f.id + '\')" title="Envoyer la facture par e-mail avec le PDF">Envoyer</span>';
      if (late) acts += '<span class="btn bg bxs" onclick="sendFacture(\'' + f.id + '\',1)" title="E-mail de relance">Relancer</span>';
      acts += '<span class="btn bs bxs" onclick="markPayee(\'' + f.id + '\')">Payee</span>';
      acts += '<span class="btn bd_ bxs" onclick="avoirFacture(\'' + f.id + '\')">Avoir</span>';
    }
    acts += '</div>';
    var typeLbl = f.designation ? f.designation : (FACT_TYPE_LABELS[f.type] || f.type);
    return '<tr><td>' + esc(f.numero) + (f.avoir_de ? ' <span style="color:var(--red);font-size:9px">(avoir)</span>' : '') + '</td>' +
      '<td>' + esc(clientName(f.client_id)) + '</td>' +
      '<td style="font-size:10px;color:var(--mu);max-width:210px">' + esc(typeLbl) + '</td>' +
      '<td>' + fmtEUR(f.montant_ht, 2) + '</td>' +
      '<td style="color:' + (late ? 'var(--red)' : 'var(--mu)') + '">' + (f.date_echeance ? fmtDateFR(f.date_echeance) + (late ? ' (retard)' : '') : '-') + '</td>' +
      '<td>' + statutFacturePill(f.statut) + (f.envoyee_at ? ' <span style="font-size:9px;color:var(--mu2)" title="Envoyee le ' + fmtDateFR(f.envoyee_at) + '">envoyee</span>' : '') + '</td>' +
      '<td>' + acts + '</td></tr>';
  }).join('') || '<tr><td colspan="7" class="empty">Aucune facture. Facture un devis signe ou cree une facture libre.</td></tr>';

  var totalEncaisse = DB.factures.filter(function (f) { return f.statut === 'payee'; }).reduce(function (a, f) { return a + num(f.montant_ht); }, 0);
  var totalDu = DB.factures.filter(function (f) { return f.statut === 'emise' || f.statut === 'relancee'; }).reduce(function (a, f) { return a + num(f.montant_ht); }, 0);
  var retard = DB.factures.filter(function (f) {
    var dd = daysUntil(f.date_echeance);
    return (f.statut === 'emise' || f.statut === 'relancee') && dd != null && dd < 0;
  }).reduce(function (a, f) { return a + num(f.montant_ht); }, 0);

  el('view-factures').innerHTML =
    '<div class="sw-kpis">' +
      kpi(fmtEUR(totalEncaisse), 'Encaisse', 'factures payees') +
      kpi(fmtEUR(totalDu), 'En attente', 'emises / relancees') +
      kpi(fmtEUR(retard), 'En retard', 'echeance depassee') +
    '</div>' +
    manquesBanner() +
    '<div class="sites-legal" style="margin-bottom:14px">Une facture emise est <b>inalterable</b> : toute correction se fait par un avoir, jamais en modifiant la facture.</div>' +
    '<table class="tbl"><thead><tr><th>Numero</th><th>Client</th><th>Objet</th><th>Montant HT</th><th>Echeance</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function openFactureForm(clientId, devisId, id) {
  var f = id ? factureById(id) : null;
  if (f) { clientId = f.client_id; devisId = f.devis_id; }
  if (f && f.statut !== 'brouillon') { toast('Facture emise : non modifiable (avoir uniquement)', 'w'); return; }
  if (!DB.clients.length) { toast('Cree d\'abord un client', 'w'); return; }
  var cliOpts = DB.clients.map(function (c) { return '<option value="' + c.id + '"' + (clientId === c.id ? ' selected' : '') + '>' + esc(c.entreprise) + '</option>'; }).join('');
  var dvOpts = '<option value="">- aucun -</option>' + devisOfClient(clientId || (DB.clients[0] && DB.clients[0].id)).map(function (d) {
    return '<option value="' + d.id + '"' + (devisId === d.id ? ' selected' : '') + '>' + esc(d.numero) + ' (' + fmtEUR(d.total_ht) + ')</option>';
  }).join('');
  var tOpts = [['acompte', 'Acompte / paiement a la commande'], ['solde', 'Solde ou facture unique']].map(function (t) {
    return '<option value="' + t[0] + '"' + (f && f.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
  }).join('');
  var b =
    '<div class="fg"><div class="fgrp"><label class="lbl">Client *</label><select id="fa-client" onchange="onFactureClientChange()">' + cliOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Devis lie</label><select id="fa-devis">' + dvOpts + '</select></div></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Type</label><select id="fa-type">' + tOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Echeance</label><input id="fa-echeance" type="date" value="' + (f && f.date_echeance ? esc(f.date_echeance) : addDaysISO(num(window.NOVCFG.fac().delai_solde_j) || 30)) + '"></div></div>' +
    '<div class="fgrp"><label class="lbl">Objet / designation</label><input id="fa-designation" value="' + esc(f && f.designation ? f.designation : 'Creation de site internet') + '"></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Montant HT</label><input id="fa-montant" type="number" step="1" value="' + (f ? num(f.montant_ht) : 0) + '"></div>' +
    '<div class="fgrp"><label class="lbl">Note interne</label><input id="fa-notes" value="' + esc(f && f.notes) + '"></div></div>' +
    manquesBanner() +
    '<div class="sites-legal">' + esc(TVA_MENTION) + '. SIRET ' + esc(SIRET) + '.<br>Pour facturer un devis signe, passe plutot par le devis : montants et echeancier sont calcules automatiquement.</div>';
  var ft = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteFacture(\'' + id + '\')">Supprimer</button>' : '') +
    '<button class="btn bp" onclick="saveFacture(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier la facture' : 'Nouvelle facture', b, ft);
}
function onFactureClientChange() {
  var cid = el('fa-client').value;
  el('fa-devis').innerHTML = '<option value="">- aucun -</option>' + devisOfClient(cid).map(function (d) {
    return '<option value="' + d.id + '">' + esc(d.numero) + ' (' + fmtEUR(d.total_ht) + ')</option>';
  }).join('');
}
async function saveFacture(id) {
  var montant = num(el('fa-montant').value);
  if (!montant) { toast('Montant requis', 'e'); return; }
  var dvId = el('fa-devis').value || null;
  var dv = dvId ? devisById(dvId) : null;
  var payload = {
    client_id: el('fa-client').value,
    devis_id: dvId,
    projet_id: dv ? (dv.projet_id || null) : null,
    type: el('fa-type').value || 'solde',
    designation: el('fa-designation').value.trim() || 'Creation de site internet',
    montant_ht: montant,
    date_echeance: el('fa-echeance').value || null,
    notes: el('fa-notes').value.trim() || null
  };
  var r;
  if (id) { r = await sbUpdate('web_factures', id, payload); }
  else {
    payload.numero = await nextNumber('FAC'); payload.date_emission = todayISO(); payload.statut = 'brouillon';
    r = await sbInsert('web_factures', payload);
  }
  if (!r.ok) { toast('Erreur : ' + r.error, 'e'); return; }
  closeMo(); toast('Facture enregistree', 's'); await loadAll(); go('factures');
}
async function emitFacture(id) {
  var f = factureById(id); if (!f) return;
  if (!confirm('Emettre la facture ' + f.numero + ' ?\n\nElle deviendra inalterable (correction par avoir uniquement).')) return;
  await updateRow('web_factures', id, { statut: 'emise' });
  await planifierRelance(id);
  toast('Facture emise', 's');
  await loadAll(); go('factures');
  var c = clientById(f.client_id);
  if (c && c.email) {
    if (confirm('Envoyer la facture ' + f.numero + ' a ' + c.email + ' maintenant ?')) await sendFacture(id);
  }
}
// Rappel automatique de relance, 3 jours apres l'echeance
async function planifierRelance(id) {
  if (!window.NOVCFG.auto().relance_auto) return;
  var f = factureById(id); if (!f || !f.date_echeance) return;
  var titre = 'Relancer la facture ' + f.numero + ' (' + fmtEUR(f.montant_ht) + ')';
  var deja = DB.evenements.some(function (e) { return e.titre === titre && e.statut === 'a_faire'; });
  if (deja) return;
  try {
    await getSB().from('web_evenements').insert({
      client_id: f.client_id, titre: titre, type: 'echeance',
      date_debut: new Date(addDaysISO(3, f.date_echeance) + 'T09:00:00').toISOString(), auto: true
    });
  } catch (e) { /* non bloquant */ }
}
async function setFactureStatut(id, st) {
  await updateRow('web_factures', id, { statut: st });
  toast('Facture : ' + FACT_LABELS[st], 's'); await reload();
}
// Encaissement : statut + date de paiement + avancement du client
async function markPayee(id) {
  var f = factureById(id); if (!f) return;
  if (!confirm('Marquer la facture ' + f.numero + ' comme payee (' + fmtEUR(f.montant_ht, 2) + ') ?')) return;
  var r = await sbUpdate('web_factures', id, { statut: 'payee', date_paiement: todayISO() });
  if (!r.ok) { toast('Erreur : ' + r.error, 'e'); return; }
  await logInteraction(f.client_id, 'note', 'Facture ' + f.numero + ' encaissee (' + fmtEUR(f.montant_ht, 2) + ')');
  // referme le rappel de relance devenu inutile
  var titre = 'Relancer la facture ' + f.numero;
  DB.evenements.filter(function (e) { return e.statut === 'a_faire' && (e.titre || '').indexOf(titre) === 0; })
    .forEach(function (e) { try { getSB().from('web_evenements').update({ statut: 'fait' }).eq('id', e.id); } catch (x) {} });
  toast('Facture encaissee', 's');
  await loadAll(); refreshCurrent();
}
async function deleteFacture(id) {
  var f = factureById(id);
  if (f && f.statut !== 'brouillon') { toast('Seul un brouillon peut etre supprime', 'w'); return; }
  if (!confirm('Supprimer ce brouillon de facture ?')) return;
  var r = await getSB().from('web_factures').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Facture supprimee', 's'); await reload();
}

// ── Envoi d'une facture (ou de sa relance) par e-mail, PDF joint ────
async function sendFacture(id, relance) {
  var f = factureById(id); if (!f) return false;
  var c = clientById(f.client_id);
  if (!c || !c.email) { toast('Pas d\'e-mail sur la fiche client', 'w'); return false; }
  if (f.statut === 'brouillon') {
    if (!confirm('Cette facture est un brouillon. L\'emettre puis l\'envoyer ?')) return false;
    await updateRow('web_factures', id, { statut: 'emise' });
    f.statut = 'emise';
  }
  var dv = f.devis_id ? devisById(f.devis_id) : null;
  var plan = planOf(dv);
  var e = window.NOVCFG.ent(), p = window.NOVCFG.pay();
  var contexte = '';
  if (!plan.unique && f.type === 'acompte') contexte = 'Cette facture correspond a l\'acompte de ' + plan.pct + ' % qui lance le projet. Le solde de ' + plan.soldePct + ' % sera facture a la livraison.';
  else if (!plan.unique && f.type === 'solde') contexte = 'Cette facture correspond au solde de ' + plan.soldePct + ' %. Le site est mis en ligne des reception du reglement.';
  else contexte = 'Le site est mis en ligne des reception du reglement.';

  var vars = {
    contact: (c.contact_nom || ''), client: c.entreprise, numero: f.numero,
    montant: fmtEUR(f.montant_ht, 2), total: fmtEUR(f.montant_ht, 2),
    echeance: f.date_echeance ? fmtDateFR(f.date_echeance) : 'reception',
    contexte: contexte, iban: p.iban, bic: p.bic, titulaire: p.titulaire,
    tva: e.tva, entreprise: e.nom_commercial, exploitant: e.exploitant,
    baseline: e.baseline, tel: e.tel, email: e.email,
    acompte_pct: plan.pct, solde_pct: plan.soldePct
  };
  var tpl = relance ? window.NOVCFG.doc().email_relance : window.NOVCFG.doc().email_facture;
  var body = window.NOVCFG.fill(tpl, vars).replace(/Bonjour ,/, 'Bonjour,');
  var subject = (relance ? 'Relance - facture ' : 'Facture ') + f.numero + ' - ' + e.nom_commercial;

  var atts = [];
  if (window.NOVCFG.auto().joindre_pdf) {
    var pj = facturePDF(id, true);
    if (pj) atts.push(pj);
  }
  var sent = await trySendEmail({ to: c.email, subject: subject, body: body, from_name: e.nom_commercial, attachments: atts });
  if (sent) {
    await sbUpdate('web_factures', id, relance ? { statut: 'relancee', envoyee_at: nowISO() } : { envoyee_at: nowISO() });
    await logInteraction(f.client_id, 'email', (relance ? 'Relance' : 'Envoi') + ' facture ' + f.numero + ' a ' + c.email);
    toast((relance ? 'Relance envoyee a ' : 'Facture envoyee a ') + c.email, 's');
    await loadAll(); refreshCurrent();
    return true;
  }
  var mailto = 'mailto:' + encodeURIComponent(c.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  window.open(mailto, '_blank');
  toast('E-mail pret dans ta messagerie (pense a joindre le PDF)', 'i');
  return false;
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

// ── PDF de la facture (jsPDF) ──
function facturePDF(id, asAttachment) {
  var f = factureById(id); if (!f) return null;
  var c = clientById(f.client_id);
  var ctor = pdfCtor(); if (!ctor) { toast('Generateur PDF indisponible', 'e'); return null; }
  var doc = new ctor({ unit: 'mm', format: 'a4' });
  var k = pdfKit(doc), DT = 'Facture ' + f.numero, avoir = num(f.montant_ht) < 0 || f.avoir_de;
  var hLines = ['Emise le ' + fmtDateFR(f.date_emission)];
  if (f.date_echeance) hLines.push('Echeance : ' + fmtDateFR(f.date_echeance));
  var dv = f.devis_id ? devisById(f.devis_id) : null;
  if (dv) hLines.push('Devis lie : ' + dv.numero);
  var plan = planOf(dv);
  var isAcompte = (f.type === 'acompte') && !plan.unique;
  var isSolde = (f.type === 'solde') && !plan.unique && !!dv;
  var titleR = avoir ? 'AVOIR' : (isAcompte ? "FACTURE D'ACOMPTE" : (isSolde ? 'FACTURE DE SOLDE' : 'FACTURE'));
  pdfHeader(doc, k, titleR, f.numero, hLines);
  pdfParties(doc, k, c);

  var totalMarche = dv ? num(dv.total_ht) : num(f.montant_ht);
  var acmtFac = (dv && !avoir) ? acompteFactureForDevis(dv.id) : null;

  // En-tete tableau
  doc.setFillColor(245, 243, 239); doc.rect(k.M, k.y, k.W - 2 * k.M, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(40, 40, 36);
  doc.text('Designation', k.M + 2, k.y + 5.5);
  doc.text('Montant HT', k.W - k.M - 2, k.y + 5.5, { align: 'right' });
  k.y += 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(50, 50, 46);
  function facLine(lbl, val) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(50, 50, 46);
    doc.text(doc.splitTextToSize(String(lbl), 128), k.M + 2, k.y);
    doc.text(eur(val), k.W - k.M - 2, k.y, { align: 'right' });
    k.y += 6.5;
  }
  var refDevis = dv ? ' (devis ' + dv.numero + ')' : '';
  var libelleBase = f.designation || 'Creation de site internet';
  var lignesFac = (f.lignes && f.lignes.length) ? f.lignes : null;
  if (avoir) {
    facLine(libelleBase + refDevis, f.montant_ht);
  } else if (isAcompte) {
    facLine('Acompte ' + plan.pct + ' % - ' + libelleBase + refDevis, f.montant_ht);
    doc.setFontSize(7.6); doc.setTextColor(120, 120, 112);
    doc.text('Montant total du marche : ' + eur(totalMarche) + ' HT. Solde de ' + plan.soldePct + ' % a facturer a la livraison.', k.M + 2, k.y); k.y += 5;
  } else if (isSolde) {
    var ded = Math.round((totalMarche - num(f.montant_ht)) * 100) / 100;
    facLine(libelleBase + refDevis + ' - montant total du marche', totalMarche);
    facLine('Acompte de ' + plan.pct + ' % deja facture' + (acmtFac ? ' (' + acmtFac.numero + ')' : ''), -ded);
  } else if (lignesFac) {
    lignesFac.forEach(function (l) { facLine(l.designation + (num(l.quantite) > 1 ? ' (x' + num(l.quantite) + ')' : ''), num(l.quantite) * num(l.pu_ht)); });
  } else {
    facLine(libelleBase + refDevis, f.montant_ht);
  }

  k.y += 1.5; doc.setDrawColor(220, 220, 212); doc.line(k.M, k.y, k.W - k.M, k.y); k.y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 20, 6);
  doc.text((avoir ? 'TOTAL AVOIR : ' : 'NET A PAYER : ') + eur(f.montant_ht), k.W - k.M, k.y, { align: 'right' });
  k.y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 112);
  doc.text(ENTREPRISE.tva + '.', k.W - k.M, k.y, { align: 'right' }); k.y += 10;

  if (!avoir) {
    doc.setFillColor(252, 246, 232); doc.setDrawColor(224, 169, 46); doc.setLineWidth(0.3);
    doc.roundedRect(k.M, k.y, k.W - 2 * k.M, 10, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 90, 20);
    var fbanner = isAcompte
      ? 'Acompte a la signature : il lance le projet. Le solde de ' + plan.soldePct + ' % sera facture a la livraison.'
      : (isSolde ? 'Le site est mis en ligne des reception du solde.' : 'Le site est mis en ligne des reception du paiement.');
    doc.text(fbanner, k.M + 3, k.y + 6.2);
    k.y += 15;

    // Coordonnees de paiement
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30, 30, 26);
    doc.text('Coordonnees de paiement', k.M, k.y); k.y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 72);
    var coords = [['Titulaire', ENTREPRISE.paiement.titulaire], ['Banque', ENTREPRISE.paiement.banque], ['IBAN', ENTREPRISE.paiement.iban], ['BIC', ENTREPRISE.paiement.bic]];
    var manqueBanque = !ENTREPRISE.paiement.iban || !ENTREPRISE.paiement.bic;
    coords.forEach(function (r) {
      if (!r[1]) return; doc.text(r[0] + ' : ' + r[1], k.M, k.y); k.y += 4.4;
    });
    if (manqueBanque) {
      doc.setTextColor(200, 60, 60);
      doc.text('IBAN / BIC a renseigner dans les Parametres du CRM.', k.M, k.y); k.y += 4.4;
      doc.setTextColor(80, 80, 72);
    }
    if (ENTREPRISE.paiement.autres) { doc.text(doc.splitTextToSize(ENTREPRISE.paiement.autres, k.W - 2 * k.M), k.M, k.y); k.y += 8; }
    doc.setFontSize(7.4); doc.setTextColor(120, 120, 112);
    var pen = window.NOVCFG.fac().penalites || '';
    var piedF = window.NOVCFG.doc().facture_pied || '';
    if (pen) { var pl = doc.splitTextToSize(pen, k.W - 2 * k.M); doc.text(pl, k.M, k.y); k.y += pl.length * 3.6 + 3; }
    if (piedF) { doc.text(doc.splitTextToSize(piedF, k.W - 2 * k.M), k.M, k.y); }
  } else if (f.avoir_de) {
    var orig = factureById(f.avoir_de);
    doc.setFontSize(8); doc.setTextColor(120, 120, 112);
    doc.text('Avoir annulant la facture ' + (orig ? orig.numero : '') + '.', k.M, k.y);
  }

  k.footer(DT);
  if (asAttachment) return pdfAttachment(doc, f.numero + '.pdf');
  doc.save(f.numero + '.pdf');
  toast('Facture generee', 's');
  return null;
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
  var r = await sbUpdate(table, id, patch);
  if (!r.ok) { toast('Erreur : ' + r.error, 'e'); throw new Error(r.error); }
  return true;
}

// ── Ecritures tolerantes au schema ──────────────────────────────────
// Certaines colonnes n'existent que si la migration sites-schema-v2.sql a
// ete jouee. Si la base ne les connait pas, on retire le champ et on
// reessaie : l'appli reste fonctionnelle, en mode degrade, sans planter.
var OPTIONAL_COLS = {
  web_devis:    ['acompte_pct'],
  web_factures: ['lignes', 'designation', 'date_paiement', 'mode_reglement', 'envoyee_at', 'notes']
};
var MISSING_COLS = {};
function colMissing(table, col) { return !!MISSING_COLS[table + '.' + col]; }
function unknownColumn(msg, table) {
  var m = /Could not find the '([a-z_]+)' column/i.exec(msg || '');
  if (!m) m = /column "?([a-z_]+)"? of relation/i.exec(msg || '');
  if (!m) m = /column ([a-z_]+) does not exist/i.exec(msg || '');
  var col = m ? m[1] : null;
  if (!col) return null;
  return ((OPTIONAL_COLS[table] || []).indexOf(col) >= 0) ? col : null;
}
function pruneKnownMissing(table, body) {
  (OPTIONAL_COLS[table] || []).forEach(function (c) {
    if (colMissing(table, c) && body.hasOwnProperty(c)) delete body[c];
  });
  return body;
}
async function sbWrite(mode, table, payload, id) {
  var sb = getSB();
  if (!sb) return { ok: false, error: 'Connexion indisponible' };
  var body = pruneKnownMissing(table, JSON.parse(JSON.stringify(payload)));
  for (var i = 0; i < 5; i++) {
    var r;
    try {
      r = (mode === 'insert')
        ? await sb.from(table).insert(body).select()
        : await sb.from(table).update(body).eq('id', id).select();
    } catch (e) { return { ok: false, error: e.message }; }
    if (!r.error) return { ok: true, data: (r.data && r.data[0]) || null };
    var col = unknownColumn(r.error.message, table);
    if (col && body.hasOwnProperty(col)) {
      MISSING_COLS[table + '.' + col] = true;
      delete body[col];
      continue;
    }
    return { ok: false, error: r.error.message };
  }
  return { ok: false, error: 'Ecriture impossible' };
}
function sbInsert(table, payload) { return sbWrite('insert', table, payload); }
function sbUpdate(table, id, patch) { return sbWrite('update', table, patch, id); }
function copyText(t) {
  try { navigator.clipboard.writeText(t); toast('Copie', 's'); }
  catch (e) { toast('Copie impossible', 'w'); }
}

// ═══════════════════════════════════════════════════════════════════
// ETAT DE CONNEXION (le point en haut a droite, cliquable)
// ═══════════════════════════════════════════════════════════════════
var CONN = { etat: 'load', maj: null, erreur: null, session: null };

function updateConn(etat, erreur) {
  CONN.etat = etat;
  if (erreur !== undefined) CONN.erreur = erreur;
  if (etat === 'ok') { CONN.maj = new Date(); CONN.erreur = null; }
  var ind = el('sync-ind'); if (!ind) return;
  if (etat === 'ok') {
    ind.innerHTML = '&#9679; Connecte';
    ind.style.color = 'var(--green)';
    ind.style.borderColor = 'rgba(61,224,154,.35)';
    ind.title = 'Donnees synchronisees' + (CONN.maj ? ' a ' + CONN.maj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '') + ' - clic pour le detail';
  } else if (etat === 'load') {
    ind.innerHTML = '&#9679; Synchro...';
    ind.style.color = 'var(--ac)';
    ind.style.borderColor = 'var(--ac-border)';
    ind.title = 'Chargement en cours';
  } else {
    ind.innerHTML = '&#9679; Hors ligne';
    ind.style.color = 'var(--red)';
    ind.style.borderColor = 'rgba(224,74,74,.4)';
    ind.title = (CONN.erreur || 'Connexion indisponible') + ' - clic pour diagnostiquer';
  }
}

function openConnexion() {
  var sess = CONN.session;
  var lignes =
    kv('Etat', CONN.etat === 'ok' ? 'Connecte' : (CONN.etat === 'load' ? 'Chargement' : 'Hors ligne')) +
    kv('Derniere synchro', CONN.maj ? CONN.maj.toLocaleString('fr-FR') : 'jamais') +
    kv('Session', sess ? ('active' + (sess.email ? ' - ' + sess.email : '')) : 'aucune (reconnecte-toi)') +
    kv('Projet Supabase', NOV_SB_URL.replace('https://', '')) +
    kv('Parametres', window.NOVCFG.tableOK() === true ? 'table web_parametres OK' : (window.NOVCFG.tableOK() === false ? 'table absente (reglages locaux)' : 'inconnu')) +
    (CONN.erreur ? kv('Derniere erreur', CONN.erreur) : '');
  var compte =
    '<table class="tbl"><thead><tr><th>Donnees</th><th style="text-align:right">Lignes</th></tr></thead><tbody>' +
    [['Clients', DB.clients.length], ['Projets', DB.projets.length], ['Devis', DB.devis.length],
     ['Factures', DB.factures.length], ['Rappels', DB.evenements.length], ['Hebergements', DB.hebergements.length]]
      .map(function (r) { return '<tr><td>' + r[0] + '</td><td style="text-align:right">' + r[1] + '</td></tr>'; }).join('') +
    '</tbody></table>';
  var manqueCols = Object.keys(MISSING_COLS);
  var migr = manqueCols.length
    ? '<div class="sites-legal" style="border-color:var(--orange);color:var(--orange);margin-top:10px">Colonnes absentes en base : <b>' + esc(manqueCols.join(', ')) + '</b>. ' +
      'Joue <b>supabase/sites-schema-v2.sql</b> dans Supabase pour activer l\'echeancier par devis et le suivi complet des factures.</div>'
    : '';
  openMo('Connexion', lignes + '<div style="height:10px"></div>' + compte + migr,
    '<button class="btn bg" onclick="closeMo()">Fermer</button>' +
    '<button class="btn bg" onclick="window.location.reload()">Recharger la page</button>' +
    '<button class="btn bp" onclick="closeMo();reload()">Resynchroniser</button>');
}

// ═══════════════════════════════════════════════════════════════════
// SIGNATURE : polling (comme le CRM pour les contrats)
// ═══════════════════════════════════════════════════════════════════
async function checkSignatures() {
  var pending = DB.devis.filter(function (d) { return d.statut === 'envoye' && d.sign_token; });
  if (!pending.length) return;
  var sb = getSB(); if (!sb) return;
  var changed = false;
  for (var i = 0; i < pending.length; i++) {
    var d = pending[i];
    try {
      var r = await sb.from('web_devis_signatures').select('signer_name,signed_at,reference').eq('devis_id', d.id).order('signed_at', { ascending: false }).limit(1).maybeSingle();
      if (r.data && r.data.signer_name) {
        // on persiste la signature en base (evite qu'elle se perde au rechargement)
        await sb.from('web_devis').update({ statut: 'accepte', signature_ref: r.data.reference || d.signature_ref || r.data.signer_name }).eq('id', d.id);
        d.statut = 'accepte';
        // on fait avancer le client a "signe" s'il est encore avant cette etape
        var c = clientById(d.client_id);
        if (c && ['prospect', 'contacte', 'devis_envoye'].indexOf(c.statut_pipeline) >= 0) {
          await sb.from('web_clients').update({ statut_pipeline: 'signe' }).eq('id', c.id);
          await maybeAutoRappel(c.id, 'signe');
        }
        toast('Devis ' + d.numero + ' signe par ' + r.data.signer_name, 's');
        await logInteraction(d.client_id, 'note', 'Devis ' + d.numero + ' signe par ' + r.data.signer_name);
        await apresSignature(d);
        changed = true;
      }
    } catch (e) { /* silencieux */ }
  }
  if (changed) { await loadAll(); refreshCurrent(); badges(); }
}
// Enchainement automatique apres la signature d'un devis
async function apresSignature(d) {
  var A = window.NOVCFG.auto();
  if (!A.facture_acompte_auto) return;
  var plan = planOf(d);
  if (plan.mode === 'livraison') return; // rien a encaisser a la signature
  try {
    await loadAll();
    var fac = await createFactureFromDevis(d.id, 'acompte', true);
    if (!fac) return;
    await loadAll();
    toast('Facture ' + fac.numero + ' preparee automatiquement', 's');
    if (A.email_auto_signature) {
      var created = DB.factures.find(function (x) { return x.numero === fac.numero; });
      if (created) { await updateRow('web_factures', created.id, { statut: 'emise' }); await loadAll(); await sendFacture(created.id); }
    }
  } catch (e) { console.warn('[sites] apresSignature', e); }
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
// AGENDA / RAPPELS / LIENS  (organisation intelligente)
// ═══════════════════════════════════════════════════════════════════
var _agMonth = null; // mois affiche (Date positionnee sur le 1er du mois)

function evOfClient(id) {
  return DB.evenements.filter(function (e) { return e.client_id === id; })
    .sort(function (a, b) { return new Date(a.date_debut) - new Date(b.date_debut); });
}
function liensOfClient(id) { return DB.liens.filter(function (l) { return l.client_id === id; }); }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// date locale au format AAAA-MM-JJ (sans passage par UTC : evite le decalage de jour)
function localISODate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDateHeureFR(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return iso; }
}
// nombre de jours (calendaires) d'ici la date donnee : <0 = passe, 0 = aujourd'hui
function daysUntilTs(iso) {
  var d = new Date(iso), t = new Date();
  var a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((a - b) / 86400000);
}
// evenements "a faire" en retard ou aujourd'hui (badge + tableau de bord)
function evDueList() {
  var end = new Date(); end.setHours(23, 59, 59, 999);
  return DB.evenements.filter(function (e) { return e.statut === 'a_faire' && new Date(e.date_debut) <= end; })
    .sort(function (a, b) { return new Date(a.date_debut) - new Date(b.date_debut); });
}

// ── Vue Agenda : composant partage NovAgenda (jour / semaine / mois) ──
var _agInst = null;
function renderAgenda() {
  var up = DB.evenements.filter(function (e) { return e.statut === 'a_faire'; })
    .sort(function (a, b) { return new Date(a.date_debut) - new Date(b.date_debut); }).slice(0, 14);
  var upHtml = up.map(function (e) {
    var d = daysUntilTs(e.date_debut), late = d < 0;
    var when = late ? Math.abs(d) + 'j de retard' : (d === 0 ? 'aujourd\'hui' : 'dans ' + d + 'j');
    return '<div class="ag-up" onclick="openEventDetail(\'' + e.id + '\')">' +
      '<div class="ag-up-dot t-' + e.type + '"></div>' +
      '<div style="flex:1;min-width:0"><div class="ag-up-t">' + esc(e.titre) + '</div>' +
      '<div class="ag-up-s">' + (e.client_id ? esc(clientName(e.client_id)) + ' &middot; ' : '') + fmtDateHeureFR(e.date_debut) + '</div></div>' +
      '<div class="ag-up-w ' + (late ? 'late' : '') + '">' + when + '</div>' +
    '</div>';
  }).join('') || '<div class="empty">Aucun rappel a venir</div>';

  el('view-agenda').innerHTML =
    '<div class="ag-wrap" style="grid-template-columns:1fr 280px;align-items:start">' +
      '<div id="ag-mount"></div>' +
      '<div class="ag-side">' +
        '<div class="syne" style="font-weight:700;font-size:12px;margin-bottom:10px">Prochains rappels</div>' + upHtml +
      '</div>' +
    '</div>';

  var keep = _agInst ? _agInst.getState() : null;
  _agInst = NovAgenda.create(el('ag-mount'), {
    dark: true,
    events: function () { return DB.evenements; },
    labelFor: function (ev) { return ev.client_id ? clientName(ev.client_id) : ev.titre; },
    onSlotClick: function (d) {
      var pad = function (n) { return String(n).padStart(2, '0'); };
      openEventForm(null, d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()));
    },
    onEventClick: function (ev) { openEventDetail(ev.id); },
    view: keep ? keep.view : 'semaine',
    date: keep ? keep.date : new Date()
  });
}

// Clic sur un evenement : ouvre la fiche client si rattache, sinon le formulaire
function openEventDetail(id) {
  var e = DB.evenements.find(function (x) { return x.id === id; });
  if (!e) return;
  if (e.client_id && clientById(e.client_id)) { openClientPanel(e.client_id); return; }
  openEventForm(id);
}

// ── Formulaire evenement (rappel / RDV / tache) ──
function openEventForm(id, prefillDateISO, prefillClientId, prefillType) {
  var e = id ? DB.evenements.find(function (x) { return x.id === id; }) : null;
  var typeVal = e ? e.type : (prefillType || 'rappel');
  var typeOpts = EVT_TYPE_ORDER.map(function (t) { return '<option value="' + t + '"' + (typeVal === t ? ' selected' : '') + '>' + EVT_TYPE_LABELS[t] + '</option>'; }).join('');
  var clientVal = e ? e.client_id : (prefillClientId || '');
  var clientOpts = '<option value="">Aucun (evenement general)</option>' + DB.clients.map(function (c) {
    return '<option value="' + c.id + '"' + (clientVal === c.id ? ' selected' : '') + '>' + esc(c.entreprise) + '</option>';
  }).join('');
  var dtVal = e ? toLocalInput(e.date_debut) : (prefillDateISO ? (prefillDateISO.indexOf('T') > 0 ? prefillDateISO : prefillDateISO + 'T09:00') : toLocalInput(new Date().toISOString()));

  var b =
    '<div class="fgrp"><label class="lbl">Intitule *</label><input id="e-titre" value="' + esc(e && e.titre) + '" placeholder="Relancer le devis, appeler, RDV cadrage..."></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Type</label><select id="e-type">' + typeOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Date et heure</label><input id="e-date" type="datetime-local" value="' + dtVal + '"></div></div>' +
    '<div class="fgrp"><label class="lbl">Client rattache</label><select id="e-client">' + clientOpts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Lieu (pour un RDV)</label><input id="e-lieu" value="' + esc(e && e.lieu) + '" placeholder="Adresse, visio, telephone..."></div>' +
    '<div class="fgrp"><label class="lbl">Notes</label><textarea id="e-notes">' + esc(e && e.notes) + '</textarea></div>';
  var f = '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    (id ? '<button class="btn bd_" onclick="deleteEvent(\'' + id + '\')">Supprimer</button>' : '') +
    (id && e && e.statut === 'a_faire' ? '<button class="btn bg" onclick="setEventDone(\'' + id + '\')">Marquer fait</button>' : '') +
    '<button class="btn bp" onclick="saveEvent(' + (id ? '\'' + id + '\'' : '') + ')">Enregistrer</button>';
  openMo(id ? 'Modifier l\'evenement' : 'Nouvel evenement', b, f);
}
// convertit un ISO (UTC) en valeur pour <input type=datetime-local> (heure locale)
function toLocalInput(iso) {
  try {
    var d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  } catch (e) { return ''; }
}
async function saveEvent(id) {
  var titre = el('e-titre').value.trim();
  if (!titre) { toast('Intitule requis', 'e'); return; }
  var dv = el('e-date').value;
  if (!dv) { toast('Date requise', 'e'); return; }
  var payload = {
    titre: titre, type: el('e-type').value, date_debut: new Date(dv).toISOString(),
    client_id: el('e-client').value || null, lieu: el('e-lieu').value.trim() || null,
    notes: el('e-notes').value.trim() || null
  };
  var sb = getSB();
  var r = id ? await sb.from('web_evenements').update(payload).eq('id', id)
             : await sb.from('web_evenements').insert(payload);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Evenement enregistre', 's');
  await loadAll(); refreshCurrent();
}
async function deleteEvent(id) {
  if (!confirm('Supprimer cet evenement ?')) return;
  var r = await getSB().from('web_evenements').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Evenement supprime', 's');
  await loadAll(); refreshCurrent();
}
async function setEventDone(id) {
  var r = await getSB().from('web_evenements').update({ statut: 'fait' }).eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Marque comme fait', 's');
  await loadAll(); refreshCurrent();
}
// rafraichit la vue courante + le panneau ouvert le cas echeant
function refreshCurrent() { syncEntreprise(); go(UI.view); if (UI.pid) openClientPanel(UI.pid); }

// rappels rapides depuis la fiche client
function quickRappel(clientId) { openEventForm(null, todayISO(), clientId, 'rappel'); }
function quickRdv(clientId) { openEventForm(null, todayISO(), clientId, 'rdv_physique'); }

// ── Auto-rappels : generes aux transitions de pipeline (le cote "assiste") ──
async function maybeAutoRappel(clientId, statut) {
  var conf = AUTO_RAPPELS[statut];
  if (!conf) return;
  // anti-doublon : on ne recree pas un auto-rappel deja pose (meme client, meme intitule, encore a faire)
  var exists = DB.evenements.some(function (e) {
    return e.client_id === clientId && e.auto && e.titre === conf.titre && e.statut === 'a_faire';
  });
  if (exists) return;
  var when = new Date(); when.setDate(when.getDate() + conf.j); when.setHours(9, 0, 0, 0);
  try {
    await getSB().from('web_evenements').insert({
      client_id: clientId, titre: conf.titre, type: 'rappel', date_debut: when.toISOString(), auto: true
    });
  } catch (e) { /* best effort */ }
}

// ── Liens rattaches a la fiche ──
function openLienForm(clientId) {
  var b =
    '<div class="fgrp"><label class="lbl">Libelle</label><input id="l-libelle" placeholder="Repo GitHub, apercu Vercel, Drive, site du client..."></div>' +
    '<div class="fgrp"><label class="lbl">URL *</label><input id="l-url" placeholder="https://..."></div>';
  openMo('Ajouter un lien', b,
    '<button class="btn bg" onclick="openClientPanel(\'' + clientId + '\')">Annuler</button><button class="btn bp" onclick="saveLien(\'' + clientId + '\')">Ajouter</button>');
}
async function saveLien(clientId) {
  var url = el('l-url').value.trim();
  if (!url) { toast('URL requise', 'e'); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  var r = await getSB().from('web_liens').insert({ client_id: clientId, libelle: el('l-libelle').value.trim() || null, url: url });
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Lien ajoute', 's');
  await loadAll(); openClientPanel(clientId);
}
async function deleteLien(id, clientId) {
  var r = await getSB().from('web_liens').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  toast('Lien supprime', 's');
  await loadAll(); openClientPanel(clientId);
}

// ═══════════════════════════════════════════════════════════════════
// ACCES / LIVRAISON + PROCHAINE ETAPE (guidage du cycle client)
// ═══════════════════════════════════════════════════════════════════
var ACCES_TYPES  = ['site', 'hebergeur', 'domaine', 'cms', 'ftp', 'email', 'github', 'autre'];
var ACCES_LABELS = { site: 'Site en ligne', hebergeur: 'Hebergeur', domaine: 'Domaine', cms: 'CMS / admin', ftp: 'FTP / serveur', email: 'Email pro', github: 'Depot GitHub', autre: 'Autre' };

function accesOfClient(id) { return DB.acces.filter(function (a) { return a.client_id === id; }); }

// banniere "prochaine action" selon l'etape du pipeline et l'etat des factures
function nextStepHtml(c) {
  var id = c.id, st = c.statut_pipeline;
  var facs = facturesOfClient(id).filter(function (f) { return f.statut !== 'annulee'; });
  var facDue = facs.some(function (f) { return f.statut === 'emise' || f.statut === 'relancee'; });
  var s;
  var facPayee = facs.some(function (f) { return f.statut === 'payee'; });
  if (st === 'prospect') s = { t: 'Etape 1 - Prospect. Prends contact avec lui.', b: '<button class="btn bp bsm" onclick="setClientStage(\'' + id + '\',\'contacte\')">Marquer contacte</button>' };
  else if (st === 'contacte') s = { t: 'Etape 2 - Contacte. RDV : devis-contrat + acompte + signature sur place.', b: '<button class="btn bp bsm" onclick="openPremierRDV(\'' + id + '\')">\u26a1 Lancer le RDV</button> <button class="btn bg bsm" onclick="openDevisForm(\'' + id + '\')">Devis simple</button>' };
  else if (st === 'devis_envoye') s = { t: 'Etape 3 - Devis envoye. En attente de signature (detectee automatiquement des que le client signe).', b: '<button class="btn bg bsm" onclick="quickRappel(\'' + id + '\')">Programmer une relance</button>' };
  else if (st === 'signe') {
    var dvAcc = DB.devis.filter(function (d) { return d.client_id === id && d.statut === 'accepte'; })[0];
    var pl = planOf(dvAcc);
    var acB = '', txt;
    if (pl.mode === 'livraison') {
      txt = 'Etape 4 - Devis signe (contrat conclu). Rien a encaisser maintenant : reglement integral a la livraison. Lance la maquette.';
    } else if (dvAcc && !acompteFactureForDevis(dvAcc.id)) {
      acB = '<button class="btn bp bsm" onclick="createAcompte(\'' + dvAcc.id + '\')">' + (pl.mode === 'commande' ? 'Facturer la totalite' : 'Facturer l\'acompte ' + pl.pct + ' %') + '</button> ';
      txt = 'Etape 4 - Devis signe (contrat conclu). ' + (pl.mode === 'commande' ? 'Facture la totalite' : 'Facture l\'acompte ' + pl.pct + ' %') + ', encaisse, puis lance la maquette.';
    } else {
      txt = 'Etape 4 - Devis signe, facture creee. Encaisse, puis lance la maquette.';
    }
    s = { t: txt, b: acB + '<button class="btn bg bsm" onclick="setClientStage(\'' + id + '\',\'en_cours\')">Passer en cours</button>' };
  }
  else if (st === 'en_cours') s = { t: 'Etape 5 - En cours. Envoie le lien d\'apercu prive au client et ajuste jusqu\'a validation.', b: '<button class="btn bp bsm" onclick="openLienForm(\'' + id + '\')">+ Ajouter le lien d\'apercu</button> <button class="btn bg bsm" onclick="setClientStage(\'' + id + '\',\'livre\')">Maquette validee</button>' };
  else if (st === 'livre') {
    var dvL = DB.devis.filter(function (d) { return d.client_id === id && d.statut === 'accepte'; })[0];
    var plL = planOf(dvL);
    if (plL.mode !== 'commande' && !facs.some(function (f) { return f.type === 'solde'; })) {
      var lbl = plL.mode === 'livraison' ? 'la totalite' : 'le solde ' + plL.soldePct + ' %';
      s = { t: 'Etape 6 - Maquette validee. Facture ' + lbl + '. Le site est mis en ligne apres encaissement.', b: '<button class="btn bp bsm" onclick="nextInvoiceForClient(\'' + id + '\')">Facturer ' + lbl + '</button>' };
    }
    else if (facDue) s = { t: 'Etape 6 - Facture envoyee, en attente de paiement. Mets le site en ligne UNIQUEMENT une fois le solde paye.', b: '<button class="btn bg bsm" onclick="go(\'factures\')">Suivre la facture</button>' };
    else if (facPayee) s = { t: 'Paye. Mets le site en ligne, enregistre les acces ci-dessous, puis bascule en SAV.', b: '<button class="btn bg bsm" onclick="openAccesForm(\'' + id + '\')">+ Enregistrer un acces</button> <button class="btn bp bsm" onclick="setClientStage(\'' + id + '\',\'sav\')">Passer en SAV</button>' };
    else s = { t: 'Site livre. Suis le reglement de la facture avant mise en ligne.', b: '<button class="btn bg bsm" onclick="go(\'factures\')">Voir les factures</button>' };
  }
  else if (st === 'sav') s = { t: 'En SAV. Site en ligne, suivi et maintenance. Pense au renouvellement hebergement/domaine.', b: '' };
  else s = { t: 'Client perdu.', b: '<button class="btn bg bsm" onclick="setClientStage(\'' + id + '\',\'prospect\')">Relancer plus tard</button>' };
  return '<div class="nextstep"><div class="nextstep-t">' + esc(s.t) + '</div>' + (s.b ? '<div style="margin-top:8px">' + s.b + '</div>' : '') + '</div>';
}
// facture depuis la fiche : convertit le devis signe s'il existe, sinon ouvre une facture vierge
function nextInvoiceForClient(cid) {
  var dv = DB.devis.filter(function (d) { return d.client_id === cid && d.statut === 'accepte'; })
    .sort(function (a, b) { return (b.date_emission || '').localeCompare(a.date_emission || ''); })[0];
  if (dv) convertDevis(dv.id); else openFactureForm(cid, null);
}

// ── Acces et livrables rattaches a la fiche ──
function openAccesForm(clientId) {
  var opts = ACCES_TYPES.map(function (t) { return '<option value="' + t + '">' + ACCES_LABELS[t] + '</option>'; }).join('');
  var b =
    '<div class="fg"><div class="fgrp"><label class="lbl">Type</label><select id="ac-type">' + opts + '</select></div>' +
    '<div class="fgrp"><label class="lbl">Libelle</label><input id="ac-libelle" placeholder="ex : OVH, WordPress, Site en ligne"></div></div>' +
    '<div class="fgrp"><label class="lbl">URL</label><input id="ac-url" placeholder="https://..."></div>' +
    '<div class="fg"><div class="fgrp"><label class="lbl">Identifiant</label><input id="ac-id" placeholder="login / email"></div>' +
    '<div class="fgrp"><label class="lbl">Mot de passe / cle</label><input id="ac-secret" placeholder="..."></div></div>' +
    '<div class="fgrp"><label class="lbl">Notes</label><textarea id="ac-notes"></textarea></div>' +
    '<div class="sites-legal">Pratique pour tout retrouver au meme endroit. Pour un mot de passe vraiment sensible, un gestionnaire dedie reste plus sur.</div>';
  openMo('Ajouter un acces', b,
    '<button class="btn bg" onclick="openClientPanel(\'' + clientId + '\')">Annuler</button><button class="btn bp" onclick="saveAcces(\'' + clientId + '\')">Ajouter</button>');
}
async function saveAcces(clientId) {
  var url = el('ac-url').value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  var payload = {
    client_id: clientId, type: el('ac-type').value, libelle: el('ac-libelle').value.trim() || null,
    url: url || null, identifiant: el('ac-id').value.trim() || null,
    secret: el('ac-secret').value.trim() || null, notes: el('ac-notes').value.trim() || null
  };
  var r = await getSB().from('web_acces').insert(payload);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  closeMo(); toast('Acces enregistre', 's');
  await loadAll(); openClientPanel(clientId);
}
async function deleteAcces(id, clientId) {
  if (!confirm('Supprimer cet acces ?')) return;
  var r = await getSB().from('web_acces').delete().eq('id', id);
  if (r.error) { toast('Erreur : ' + r.error.message, 'e'); return; }
  toast('Acces supprime', 's'); await loadAll(); openClientPanel(clientId);
}

// ═══════════════════════════════════════════════════════════════════
// PREMIER RDV — devis-contrat + acompte + signature sur place, en un flux
// ═══════════════════════════════════════════════════════════════════
function openPremierRDV(clientId) {
  var c = clientById(clientId); if (!c) { toast('Client introuvable', 'e'); return; }
  // Pre-remplissage : dernier projet du client s'il existe, sinon une ligne vide
  var pj = projetsOfClient(clientId)[0];
  if (pj && num(pj.prix_ht)) {
    var base = num(pj.prix_ht) * (1 - num(pj.remise_pct) / 100);
    _dvLines = [{ designation: 'Site internet - formule ' + (FORMULE_LABELS[pj.formule] || pj.formule) + ((pj.options || []).length ? ' (' + pj.options.join(', ') + ')' : ''), quantite: 1, pu_ht: Math.round(base * 100) / 100 }];
  } else {
    _dvLines = [{ designation: '', quantite: 1, pu_ht: 0 }];
  }
  _dvPct = window.NOVCFG.defaultPct();
  var projId = pj ? pj.id : '';
  var b =
    '<div class="sites-legal" style="margin-bottom:12px">Rendez-vous avec <b style="color:var(--tx)">' + esc(c.entreprise) + '</b>. Compose le devis, choisis l\'echeancier, puis fais signer sur cette tablette.</div>' +
    manquesBanner() +
    '<input type="hidden" id="rdv-client" value="' + clientId + '"><input type="hidden" id="rdv-projet" value="' + esc(projId) + '">' +
    '<div class="fgrp"><label class="lbl">Prestations</label><div class="dv-line-h"><span>Designation</span><span>Qte</span><span>PU HT</span><span>Total</span><span></span></div><div id="d-lines"></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">' +
    '<button class="btn bg bsm" onclick="dvAddLine()">+ Ligne libre</button>' +
    '<select id="d-cat" class="ff" style="max-width:280px" onchange="dvAddFromCatalog(this.value);this.value=\'\'"><option value="">+ Depuis le catalogue...</option>' +
      catalogue().map(function (x, i) { return '<option value="' + i + '">' + esc(x.label) + ' (' + fmtEUR(x.prix) + ')</option>'; }).join('') +
    '</select></div></div>' +
    echeancierPickerHtml() +
    '<div style="text-align:right;margin:10px 0">' +
      '<div id="d-total" style="font-family:Syne,sans-serif;font-weight:700;font-size:16px">Total HT : ' + fmtEUR(0, 2) + '</div>' +
      '<div id="d-plan" style="font-size:12px;color:var(--mu);margin-top:3px"></div>' +
    '</div>' +
    '<div class="sites-legal">Le devis genere <b>vaut contrat</b> (conditions completes annexees au PDF, modifiables dans les Parametres). La signature "bon pour accord" l\'engage.</div>';
  openMo('\u26a1 Premier RDV - ' + esc(c.entreprise), b,
    '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
    '<button class="btn bp" onclick="saveDevisAndSign()">Creer le devis-contrat \u2192</button>');
  dvRenderLines();
  setDvPct(_dvPct);
}

// Enregistre le devis-contrat, genere le jeton, avance le pipeline, puis ecran signature
async function saveDevisAndSign() {
  var clientId = el('rdv-client').value;
  var projId = el('rdv-projet').value || null;
  var lignes = _dvLines.filter(function (l) { return (l.designation || '').trim(); }).map(function (l) { return { designation: l.designation.trim(), quantite: num(l.quantite), pu_ht: num(l.pu_ht) }; });
  if (!lignes.length) { toast('Ajoute au moins une prestation', 'e'); return; }
  var total = lignes.reduce(function (a, l) { return a + l.quantite * l.pu_ht; }, 0);
  var numero = await nextNumber('DEV');
  var pct = (_dvPct == null) ? window.NOVCFG.defaultPct() : _dvPct;
  var plan = planFromPct(pct, total);
  var payload = {
    client_id: clientId, projet_id: projId,
    date_emission: todayISO(), validite: addDaysISO(num(window.NOVCFG.fac().validite_devis_j) || 30),
    lignes: lignes, total_ht: Math.round(total * 100) / 100,
    acompte_pct: pct, mentions: defaultMentions(plan),
    numero: numero, statut: 'envoye', sign_token: genToken()
  };
  var sb = getSB();
  var r = await sbInsert('web_devis', payload);
  if (!r.ok) { toast('Erreur : ' + r.error, 'e'); return; }
  // avance le client dans le pipeline (best-effort, on n'echoue pas la creation pour ca)
  try { await sb.from('web_clients').update({ statut_pipeline: 'devis_envoye' }).eq('id', clientId); } catch (e) {}
  await loadAll();
  var d = DB.devis.find(function (x) { return x.numero === numero; });
  if (!d) { toast('Devis ' + numero + ' cree. Ouvre-le depuis la liste pour signer.', 'w'); go('devis'); return; }
  showSignStep(d.id);
}

// Ecran "signer maintenant sur la tablette" (ou envoyer le lien)
function showSignStep(devisId) {
  var d = devisById(devisId); if (!d) { toast('Devis introuvable', 'e'); return; }
  var c = clientById(d.client_id);
  var link = location.origin + '/sites-sign?dv=' + d.id + '&t=' + (d.sign_token || '');
  var b =
    '<div style="text-align:center;padding:6px 0 14px">' +
      '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:22px;color:var(--ac)">' + esc(d.numero) + '</div>' +
      '<div style="font-size:13px;color:var(--mu);margin-top:4px">' + esc(c ? c.entreprise : '') + ' &middot; ' + fmtEUR(d.total_ht, 2) + ' HT</div>' +
      '<div style="font-size:12px;color:var(--tx);margin-top:6px">' + esc(window.NOVCFG.echeancierCourt(planOf(d))) + '</div>' +
    '</div>' +
    '<a class="btn bp" style="display:block;text-align:center;text-decoration:none;padding:16px;font-size:15px" href="' + link + '">\u270d Signer maintenant sur cette tablette</a>' +
    '<div style="display:flex;gap:6px;margin-top:8px">' +
      '<button class="btn bi bsm" style="flex:1" onclick="closeMo();sendDevis(\'' + d.id + '\')">\u2709 Envoyer le lien par email</button>' +
      '<button class="btn bg bsm" style="flex:1" onclick="copyText(\'' + link + '\')">Copier le lien</button>' +
    '</div>' +
    '<div class="sites-legal" style="margin-top:12px">Une fois signe, le devis passe en <b>accepte</b> (detection automatique)' +
      (window.NOVCFG.auto().facture_acompte_auto ? ' et la <b>facture est preparee automatiquement</b>.' : '. Reviens sur sa fiche pour generer la facture.') + '</div>';
  openMo('Signature - ' + esc(d.numero), b,
    '<button class="btn bg" onclick="closeMo()">Fermer</button><button class="btn bp" onclick="closeMo();openDevisPanel(\'' + d.id + '\')">Voir le devis</button>');
}

// ── Document de passation (remise du site au client) ──
function handoverPDF(clientId) {
  var c = clientById(clientId); if (!c) { toast('Client introuvable', 'e'); return; }
  var ctor = pdfCtor(); if (!ctor) { toast('Generateur PDF indisponible', 'e'); return; }
  var doc = new ctor({ unit: 'mm', format: 'a4' });
  var k = pdfKit(doc), DT = 'Passation ' + (c.entreprise || '');
  pdfHeader(doc, k, 'DOCUMENT DE PASSATION', c.entreprise || '', ['Etabli le ' + fmtDateFR(todayISO())]);
  pdfParties(doc, k, c);

  var proj = projetsOfClient(clientId).filter(function (p) { return p.url_livree; })[0] || projetsOfClient(clientId)[0];
  var heb = hebergOfClient(clientId)[0];
  function h2(t) { k.space(12, DT); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 30, 26); doc.text(t, k.M, k.y); k.y += 5.5; }
  function row(a, b) { k.space(6, DT); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 84); doc.text(a, k.M, k.y); doc.setTextColor(40, 40, 36); var lines = doc.splitTextToSize(String(b || '-'), 118); doc.text(lines, k.M + 46, k.y); k.y += Math.max(5, lines.length * 4.4); }

  h2('Le site');
  row('Prestation', proj ? (FORMULE_LABELS[proj.formule] || proj.formule) : 'Site internet');
  row('Adresse du site', (proj && proj.url_livree) || (heb && heb.nom_domaine ? 'https://' + heb.nom_domaine : '-'));
  k.y += 3;

  h2('Hebergement et nom de domaine');
  row('Nom de domaine', heb ? heb.nom_domaine : '-');
  row('Proprietaire du domaine', (c.entreprise || 'Le client') + ' (vous)');
  row('Hebergement', (heb && heb.hebergeur) || ('Gere par ' + ENTREPRISE.nom_commercial));
  row('Renouvellement', (heb && heb.date_renouvellement) ? fmtDateFR(heb.date_renouvellement) : 'a definir');
  row('Abonnement annuel', (heb && heb.cout_annuel) ? (fmtEUR(heb.cout_annuel) + ' / an') : 'a definir');
  k.y += 3;

  var accs = accesOfClient(clientId);
  if (accs.length) {
    h2('Acces');
    accs.forEach(function (a) {
      row(ACCES_LABELS[a.type] || a.type || 'Acces', (a.libelle ? a.libelle + ' - ' : '') + (a.url || '') + (a.identifiant ? '  /  ' + a.identifiant : ''));
    });
    k.space(8, DT); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(140, 140, 132);
    doc.text(doc.splitTextToSize('Les mots de passe sont transmis separement, par un canal securise.', k.W - 2 * k.M), k.M, k.y); k.y += 6;
  }

  h2('Repartition des responsabilites');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(70, 70, 64);
  doc.text(doc.splitTextToSize('Vous etes proprietaire de votre nom de domaine et des contenus de votre site. ' + ENTREPRISE.nom_commercial + ' assure l\'hebergement, la gestion technique et la maintenance dans le cadre de l\'abonnement annuel. En cas de fin de collaboration, le transfert du nom de domaine et des fichiers du site vous est facilite.', k.W - 2 * k.M), k.M, k.y);
  k.y += 22;

  k.footer(DT);
  doc.save('Passation-' + String(c.entreprise || 'client').replace(/[^a-z0-9]+/gi, '-') + '.pdf');
  toast('Document de passation genere', 's');
}

// ═══════════════════════════════════════════════════════════════════
// EXPOSITION GLOBALE (handlers onclick) + INIT
// ═══════════════════════════════════════════════════════════════════
var API = {
  go: go, openClientForm: openClientForm, saveClient: saveClient, deleteClient: deleteClient,
  openClientPanel: openClientPanel, moveClient: moveClient, setClientStage: setClientStage,
  openInteractionForm: openInteractionForm, saveInteraction: saveInteraction, openCadrage: openCadrage,
  openProjetForm: openProjetForm, saveProjet: saveProjet, deleteProjet: deleteProjet,
  toggleProjOption: toggleProjOption, onFormuleChange: onFormuleChange,
  openDevisForm: openDevisForm, saveDevis: saveDevis, deleteDevis: deleteDevis,
  openDevisPanel: openDevisPanel, onDevisClientChange: onDevisClientChange,
  dvAddLine: dvAddLine, dvRemoveLine: dvRemoveLine, dvEdit: dvEdit, dvAddFromCatalog: dvAddFromCatalog,
  devisPDF: devisPDF, sendDevis: sendDevis, setDevisStatut: setDevisStatut,
  convertDevis: convertDevis, doConvertDevis: doConvertDevis,
  createFactureFromDevis: createFactureFromDevis, createAcompte: createAcompte, createSolde: createSolde,
  openPremierRDV: openPremierRDV, saveDevisAndSign: saveDevisAndSign, showSignStep: showSignStep, handoverPDF: handoverPDF,
  openFactureForm: openFactureForm, saveFacture: saveFacture, deleteFacture: deleteFacture,
  emitFacture: emitFacture, setFactureStatut: setFactureStatut, avoirFacture: avoirFacture,
  openHebergForm: openHebergForm, saveHeberg: saveHeberg, deleteHeberg: deleteHeberg,
  closeMo: closeMo, closePanel: closePanel, copyText: copyText, openMo: openMo, toast: toast,
  openEcheancier: openEcheancier, saveEcheancier: saveEcheancier, setDvPct: setDvPct,
  sendFacture: sendFacture, markPayee: markPayee, onFactureClientChange: onFactureClientChange,
  openConnexion: openConnexion, reload: reload, refreshCurrent: refreshCurrent,
  NOV_SB: getSB, syncEntreprise: syncEntreprise, setPipeQ: setPipeQ,
  toggleUserMenu: toggleUserMenu, logout: logout,
  openEventForm: openEventForm, saveEvent: saveEvent, deleteEvent: deleteEvent, setEventDone: setEventDone,
  openEventDetail: openEventDetail, agShift: agShift, agToday: agToday, quickRappel: quickRappel, quickRdv: quickRdv,
  openLienForm: openLienForm, saveLien: saveLien, deleteLien: deleteLien,
  openAccesForm: openAccesForm, saveAcces: saveAcces, deleteAcces: deleteAcces, nextInvoiceForClient: nextInvoiceForClient,
  devisContratPDF: devisPDF, facturePDF: facturePDF
};
Object.keys(API).forEach(function (k) { window[k] = API[k]; });

async function init() {
  initUser();
  updateConn('load');
  // navigation : chaque onglet declenche go()
  var nis = document.querySelectorAll('.ni');
  for (var i = 0; i < nis.length; i++) {
    (function (n) { n.addEventListener('click', function () { go(n.getAttribute('data-v')); }); })(nis[i]);
  }
  var sb = getSB();
  // 1) attendre la restauration de la session (sinon les premieres requetes
  //    partent en anonyme et reviennent vides : c'est la cause des ecrans blancs)
  try {
    if (sb && sb.auth && sb.auth.getSession) {
      var sres = await sb.auth.getSession();
      CONN.session = (sres && sres.data && sres.data.session)
        ? { email: (sres.data.session.user || {}).email } : null;
      if (!CONN.session) updateConn('off', 'Session expiree : reconnecte-toi depuis l\'accueil');
    }
  } catch (e) { /* on tente quand meme */ }
  // 2) parametres (entreprise, banque, textes) avant tout rendu
  await window.NOVCFG.load(sb);
  syncEntreprise();
  // 3) donnees
  await loadAll();
  go('dash');
  startSigPolling();
  // 4) etat reseau du navigateur
  window.addEventListener('online', function () { updateConn('load'); reload(); });
  window.addEventListener('offline', function () { updateConn('off', 'Navigateur hors ligne'); });
  // 5) rappel des informations manquantes, une fois, au demarrage
  var mq = window.NOVCFG.manques();
  if (mq.length) toast('A completer dans les Parametres : ' + mq.join(', '), 'w');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
