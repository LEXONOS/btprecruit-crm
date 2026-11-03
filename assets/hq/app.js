// La Tour : l'interface. Lit le monde toutes les quelques secondes, anime la scène 3D, ouvre les fiches,
// et porte les décisions de Louis (valider, consigne, pause, budget, emails).
const S = { world: null, m: null, lastId: 0, view: 'tour', sel: null, etat: null, cycle: false, msgs: [], fails: 0, first: true, tab: 'emails', filtre: '', sous: '' };
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'America/Guadeloupe';
const STATUT = { idle: 'Disponible', working: 'Au travail', waiting: 'Attend une réponse', paused: 'En pause', error: 'Erreur', attente: 'Attend un outil' };
const KIND = { rapport: 'Rapport', ordre: 'Ordre', proposition: 'Proposition', alerte: 'Alerte', decision: 'Décision', evaluation: 'Évaluation', evenement: 'Événement', note: 'Note' };
const PROPK = { nouvel_agent: 'Nouvel agent', nouvelle_entreprise: 'Nouvelle entreprise', depense: 'Dépense', strategie: 'Stratégie', outil: 'Outil', acces: 'Accès', autre: 'Autre' };
const LEADS = { nouveau: 'Brut', a_contacter: 'À contacter', a_appeler: 'À appeler', sans_contact: 'Sans contact', brouillon: 'Brouillon prêt', contacte: 'Contacté', relance: 'Relancé', repondu: 'A répondu', interesse: 'Intéressé', client: 'Client', perdu: 'Perdu', stop: 'Désinscrit', ecarte: 'Écarté' };
const INTENT = { interesse: 'Intéressé', rdv: 'Veut un rendez-vous', question: 'Question', pas_interesse: 'Pas intéressé', plus_tard: 'Plus tard', stop: 'STOP', autre: 'À regarder' };
const ITEMK = { repo: 'Fiches GitHub', veille: 'Veille', idee: 'Idées vidéo', script: 'Scripts', niche: 'Niches', etude: 'Études', reference: 'Références', evaluation: 'Évaluations', fiche: 'Fiches', note: 'Notes' };

/* ── utilitaires ── */
const usd = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
const heure = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '';
const date = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
function depuis(iso) {
  if (!iso) return 'jamais';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) { const m = Math.round(-s / 60); return m < 60 ? 'dans ' + m + ' min' : m < 1440 ? 'dans ' + Math.round(m / 60) + ' h' : 'dans ' + Math.round(m / 1440) + ' j'; }
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  return 'il y a ' + Math.round(s / 86400) + ' j';
}
function heureGP() { const p = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()); const g = (t) => Number((p.find((x) => x.type === t) || {}).value || 0); return g('hour') + g('minute') / 60; }
const initiales = (n) => String(n || '?').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const agentDe = (id) => (S.m && S.m.agents.find((a) => a.id === id)) || null;
const coDe = (id) => (S.m && S.m.companies.find((c) => c.id === id)) || null;
const couleur = (cid) => (coDe(cid) || {}).color || '#7DD3FC';
function nom(id) { if (id === 'louis') return 'Louis'; if (id === 'systeme' || !id) return 'Système'; const a = agentDe(id); return a ? a.name : id; }
function poste(id) { const a = agentDe(id); return a ? a.title : ''; }
function toast(t, type) { const el = document.createElement('div'); el.className = 'toast ' + (type || ''); el.textContent = t; $('#toasts').appendChild(el); setTimeout(() => el.remove(), type === 'err' ? 7000 : 4200); }
const demo = () => !S.m || S.m.demo;

async function api(op, params) {
  const q = new URLSearchParams(Object.assign({ op: op }, params || {}));
  const r = await fetch('/api/hq?' + q.toString(), { headers: hdr() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
}
async function post(body, url) {
  const r = await fetch(url || '/api/hq', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, hdr()), body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
}
function hdr() { let k = ''; try { k = localStorage.getItem('hq_key') || ''; } catch (e) { /* stockage indisponible */ } return k ? { 'x-hq-key': k } : {}; }
function garde() { if (demo()) { toast('La base n\'est pas encore branchée : regarde le bandeau en haut.', 'err'); openSetup(); return false; } return true; }

/* ── démarrage ── */
async function init() {
  bind();
  try {
    const mod = await import('./scene.js');
    S.world = mod.createWorld($('#scene'), { onPick: pick, onHover: hover });
    window.__world = S.world;
  } catch (e) {
    console.error(e);
    $('#scene').innerHTML = '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 80%,#13203a 0%,#05080F 70%)"></div>';
    toast('La 3D n\'a pas pu démarrer sur cet appareil : le reste fonctionne.', 'err');
  }
  api('etat').then((e) => { S.etat = e; if (S.sel && S.sel.type === 'setup') openSetup(); }).catch(() => {});
  poll();
  setInterval(() => { if (S.world && S.m) S.world.update(etatScene()); }, 60000); // le ciel suit l'heure de Guadeloupe
}

function etatScene() {
  return {
    group: S.m.groupe,
    companies: S.m.companies.map((c) => ({ id: c.id, name: c.name, tagline: c.tagline, color: c.color, kind: c.kind, status: c.status, floors: c.floors })),
    agents: S.m.agents.map((a) => ({ id: a.id, company_id: a.company_id, parent_id: a.parent_id, name: a.name, title: a.title, tier: a.tier, status: a.status, seat: a.seat })),
    pending_validations: (S.m.proposals || []).filter((p) => p.status === 'a_louis').length,
    time: { hourGP: heureGP() }
  };
}

let pollTimer = null;
async function poll() {
  clearTimeout(pollTimer);
  try {
    const d = await api('world', S.first ? {} : { since: S.lastId });
    S.fails = 0;
    const nouveaux = S.first ? [] : (d.messages || []);
    const msgs = S.first ? (d.messages || []) : nouveaux;
    S.m = Object.assign({}, d, { messages: undefined });
    msgs.forEach((m) => { if (m.id > S.lastId) S.lastId = m.id; });
    if (S.first) S.msgs = msgs.slice().reverse(); else S.msgs = nouveaux.slice().reverse().concat(S.msgs).slice(0, 200);
    if (S.world) S.world.update(etatScene());
    nouveaux.forEach((m, k) => setTimeout(() => {
      if (S.world && m.from_id && !(m.from_id === 'systeme' && !m.to_id)) S.world.pulse({ from: m.from_id, to: m.to_id || 'louis', kind: m.kind });
      if (m.to_id === 'louis' || m.kind === 'evenement') toast((m.to_id === 'louis' ? nom(m.from_id) + ' : ' : '') + (m.subject || ''), 'ok');
    }, k * 350));
    renderAll(nouveaux.map((m) => m.id));
    S.first = false;
  } catch (e) {
    S.fails++;
    const l = $('#live'); l.className = 'live'; l.querySelector('span').textContent = 'hors ligne, nouvel essai…';
    if (S.fails === 1) console.error(e);
  }
  const vite = S.cycle ? 2500 : 6000;
  pollTimer = setTimeout(poll, document.hidden ? 30000 : vite);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

/* ── rendu général ── */
function renderAll(frais) {
  if (!S.m) return;
  $('#groupName').textContent = S.m.groupe.name;
  const actifs = S.m.agents.filter((a) => a.kind !== 'attente');
  const auTravail = S.m.agents.filter((a) => a.status === 'working').length;
  const live = $('#live');
  if (demo()) { live.className = 'live demo'; live.querySelector('span').textContent = 'mode démo'; }
  else { live.className = 'live on'; live.querySelector('span').textContent = auTravail ? auTravail + ' au travail' : actifs.length + ' agents actifs'; }
  renderChips();
  renderRail();
  renderFeed(frais || []);
  renderBanner();
  const n = (S.m.proposals || []).filter((p) => p.status === 'a_louis').length;
  $('#valCount').textContent = n;
  $('#valBtn').classList.toggle('zero', !n);
  if (S.view === 'org' || S.view === 'chiffres') renderPage(true);
  if (S.sel && S.sel.type === 'agent') majTeteAgent();
}

function renderChips() {
  const j = S.m.jour || {}, b = S.m.budget || {}, c = S.m.compteurs || {};
  const pct = b.jour_usd ? Math.min(100, (Number(j.cost_usd || 0) / Number(b.jour_usd)) * 100) : 0;
  $('#chips').innerHTML = [
    '<button class="chip" data-act="budget"><small>Coût IA du jour</small><b>' + usd(j.cost_usd) + ' <span class="muted">/ ' + usd(b.jour_usd) + '</span></b><span class="gauge"><i style="width:' + pct.toFixed(0) + '%;' + (pct > 85 ? 'background:var(--warn)' : '') + '"></i></span></button>',
    (c.reponses ? '<button class="chip hot" data-view="livrables" data-tab="reponses"><small>Réponses de prospects</small><b>' + c.reponses + ' <span class="muted">· ' + (c.brouillons || 0) + ' à valider</span></b></button>' : '<button class="chip' + (c.brouillons ? ' hot' : '') + '" data-view="livrables" data-tab="emails"><small>Emails à valider</small><b>' + (c.brouillons || 0) + '</b></button>'),
    '<button class="chip" data-view="livrables" data-tab="prospects"><small>Prospects</small><b>' + (c.prospects || 0) + ' <span class="muted">· ' + (c.a_contacter || 0) + ' à contacter</span></b></button>'
  ].join('');
}

function renderRail() {
  const actives = S.m.companies.filter((c) => c.status === 'active').slice().sort((a, b) => b.floor_order - a.floor_order);
  const projets = S.m.companies.filter((c) => c.status === 'proposee');
  let h = '<div class="mobile-views" style="gap:4px;flex-wrap:wrap;margin-bottom:6px">' + ['tour', 'org', 'livrables', 'chiffres'].map((v) => '<button class="btn sm ghost" data-view="' + v + '">' + { tour: 'Tour', org: 'Organigramme', livrables: 'Livrables', chiffres: 'Chiffres' }[v] + '</button>').join('') + '</div>';
  h += '<h3>Les étages</h3>';
  actives.forEach((c) => {
    const ag = S.m.agents.filter((a) => a.company_id === c.id);
    const w = ag.filter((a) => a.status === 'working').length;
    const att = ag.filter((a) => a.kind === 'attente').length;
    h += '<button class="floor' + (S.sel && S.sel.type === 'company' && S.sel.id === c.id ? ' on' : '') + '" style="--c:' + esc(c.color) + '" data-company="' + esc(c.id) + '"><span class="bar-c"></span><span><strong>' + esc(c.name) + '</strong><small>' + ag.length + ' agents' + (w ? ' · ' + w + ' au travail' : '') + (att ? ' · ' + att + ' en attente' : '') + '</small></span><span class="dots">' + ag.map((a) => '<span class="dot ' + esc(a.status) + '"></span>').join('') + '</span></button>';
  });
  if (projets.length) {
    h += '<h3 style="margin-top:12px">Chantiers chez Louis</h3>';
    projets.forEach((c) => {
      const p = propDe(c.id);
      h += '<button class="site" style="--c:' + esc(c.color) + '" data-site="' + esc(c.id) + '"><i></i><span><strong>' + esc(c.name) + '</strong><small>' + (p ? (p.status === 'a_louis' ? 'à valider' : p.status === 'validee' ? 'validé, en création' : p.status) : 'projet') + '</small></span></button>';
    });
  }
  $('#rail').innerHTML = h;
}
function propDe(companyId) { return (S.m.proposals || []).find((p) => p.kind === 'nouvelle_entreprise' && p.details && p.details.company_id === companyId) || null; }

function ligneMsg(m, frais) {
  const vers = m.to_id ? ' → <b>' + esc(nom(m.to_id)) + '</b>' : '';
  return '<button class="msg' + (frais ? ' fresh' : '') + '" data-msg="' + m.id + '"><time>' + heure(m.created_at) + '</time><span><span class="who"><span class="kind ' + esc(m.kind) + '">' + esc(KIND[m.kind] || m.kind) + '</span> <b>' + esc(nom(m.from_id)) + '</b>' + vers + '</span><span class="what">' + esc(m.subject || m.body || '') + '</span></span></button>';
}
function renderFeed(frais) {
  const last = S.msgs[0];
  $('#feedLast').innerHTML = last ? '<span class="muted">' + heure(last.created_at) + '</span> · ' + esc(nom(last.from_id)) + (last.to_id ? ' → ' + esc(nom(last.to_id)) : '') + ' · ' + esc(last.subject || last.body || '') : 'en attente des premiers échanges';
  $('#feedList').innerHTML = S.msgs.slice(0, 120).map((m) => ligneMsg(m, frais.indexOf(m.id) >= 0)).join('') || '<div class="empty">Aucun échange pour l\'instant.</div>';
}

function renderBanner() {
  const b = $('#banner');
  if (!demo()) { b.hidden = true; return; }
  const raison = S.m.raison;
  const t = raison === 'tables' ? 'La base est branchée mais ses tables ne sont pas encore créées.' : raison === 'cle_refusee' ? 'La clé de la base est refusée : vérifie HQ_SUPABASE_KEY dans Vercel.' : 'Mode démo : tu vois la vraie organisation, mais la base n\'est pas branchée, personne ne travaille encore.';
  b.innerHTML = '<span>' + esc(t) + '</span><button class="btn sm gold" data-act="setup">Voir comment (2 gestes)</button>';
  b.hidden = false;
}

/* ── scène : clic et survol ── */
function pick(t) {
  if (!t) return;
  if (t.type === 'agent') openAgent(t.id);
  else if (t.type === 'company') openCompany(t.id);
  else if (t.type === 'site') openSite(t.id);
  else if (t.type === 'roof') openValidations();
}
function hover(t, pos) {
  const tip = $('#tip');
  if (!t || !S.m) { tip.hidden = true; document.body.style.cursor = ''; return; }
  let h = '';
  if (t.type === 'agent') { const a = agentDe(t.id); if (!a) return; h = '<b>' + esc(a.name) + '</b><small>' + esc(a.title) + ' · ' + esc((coDe(a.company_id) || {}).name || '') + '</small><p><span class="status ' + esc(a.status) + '">' + esc(STATUT[a.status] || a.status) + '</span></p>' + (a.current_task ? '<p>' + esc(a.current_task.slice(0, 160)) + '</p>' : a.waiting_for ? '<p>' + esc(a.waiting_for.slice(0, 160)) + '</p>' : ''); }
  else if (t.type === 'company') { const c = coDe(t.id); if (!c) return; h = '<b>' + esc(c.name) + '</b><small>' + esc(c.tagline || '') + '</small><p>' + c.agents_count + ' agents</p>'; }
  else if (t.type === 'site') { const c = coDe(t.id); if (!c) return; h = '<b>' + esc(c.name) + '</b><small>Projet d\'entreprise</small><p>' + esc(c.tagline || '') + '</p><p class="muted">Clique pour voir le dossier et décider.</p>'; }
  else if (t.type === 'roof') { const n = (S.m.proposals || []).filter((p) => p.status === 'a_louis').length; h = '<b>Le Board</b><small>Ton bureau, au sommet</small><p>' + n + ' décision(s) t\'attendent.</p>'; }
  tip.innerHTML = h; tip.hidden = false;
  tip.style.left = Math.min(window.innerWidth - 300, pos.x) + 'px'; tip.style.top = Math.min(window.innerHeight - 140, pos.y) + 'px';
  document.body.style.cursor = 'pointer';
}

/* ── panneau ── */
function panel(html, sel) {
  S.sel = sel;
  $('#panelBody').innerHTML = html;
  $('#panel').hidden = false;
  document.body.classList.add('panel-open');
  $('#panelBody').scrollTop = 0;
  renderRail();
}
function closePanel() { $('#panel').hidden = true; document.body.classList.remove('panel-open'); S.sel = null; renderRail(); }

function teteAgent(a) {
  const c = coDe(a.company_id) || {};
  const chef = a.parent_id ? agentDe(a.parent_id) : null;
  return '<div class="ph"><div class="avatar" style="--c:' + esc(c.color) + '">' + esc(initiales(a.name)) + '</div><div><h2>' + esc(a.name) + '</h2><p>' + esc(a.title) + ' · <a href="#" data-company="' + esc(a.company_id) + '">' + esc(c.name || a.company_id) + '</a></p></div></div>' +
    '<div class="row" id="agStatus"><span class="status ' + esc(a.status) + '">' + esc(STATUT[a.status] || a.status) + '</span>' + (chef ? '<span class="muted" style="font-size:12px">Chef : <a href="#" data-agent="' + esc(chef.id) + '">' + esc(chef.name) + '</a></span>' : '<span class="muted" style="font-size:12px">Rend des comptes à Louis</span>') + '<span class="muted" style="font-size:12px">' + esc(a.kind === 'job' ? 'travail automatique' : a.kind === 'attente' ? '' : (a.model === 'smart' ? 'Sonnet' : 'Haiku')) + '</span></div>';
}
function majTeteAgent() {
  const a = agentDe(S.sel.id); const el = $('#agNow');
  if (!a || !el) return;
  $('#agStatus .status').className = 'status ' + a.status;
  $('#agStatus .status').textContent = STATUT[a.status] || a.status;
  el.innerHTML = nowAgent(a);
}
function nowAgent(a) {
  if (a.kind === 'attente') return '<small>Il attend</small>' + esc(a.waiting_for || 'un outil');
  return '<small>' + (a.status === 'working' ? 'En ce moment' : 'Dernier passage · ' + depuis(a.last_run_at)) + '</small>' + esc(a.status === 'working' ? 'Au travail…' : (a.current_task || 'Pas encore passé.')) + (a.next_run_at && a.status !== 'paused' ? '<div class="muted" style="font-size:12px;margin-top:6px">Prochain passage ' + depuis(a.next_run_at) + ' · cadence ' + Math.round(a.cadence_min / 60 * 10) / 10 + ' h</div>' : '');
}

async function openAgent(id) {
  const a = agentDe(id);
  if (!a) return;
  if (S.world) S.world.focus({ type: 'agent', id: id });
  panel(teteAgent(a) + '<div class="now" id="agNow">' + nowAgent(a) + '</div><div class="muted">Chargement de la fiche…</div>', { type: 'agent', id: id });
  let f;
  try { f = await api('agent', { id: id }); } catch (e) { toast(e.message, 'err'); return; }
  if (!S.sel || S.sel.id !== id) return;
  const ag = Object.assign({}, a, f.agent || {});
  const equipe = S.m.agents.filter((x) => x.parent_id === id);
  const st = ag.stats || {};
  let h = teteAgent(ag) + '<div class="now" id="agNow">' + nowAgent(ag) + '</div>';
  h += '<div class="row">' +
    (ag.kind !== 'attente' ? '<button class="btn sm primary" data-act="lancer" data-id="' + esc(id) + '"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>Lancer maintenant</button>' : '') +
    (ag.kind !== 'attente' ? (ag.status === 'paused' ? '<button class="btn sm ok" data-act="reprendre" data-id="' + esc(id) + '">Reprendre</button>' : '<button class="btn sm ghost" data-act="pause" data-id="' + esc(id) + '">Pause</button>') : '') +
    '</div>';
  h += '<div class="sec"><h4>Donner une consigne</h4><textarea class="in" id="consigne" placeholder="Ex : concentre-toi sur les climatiseurs de Baie-Mahault cette semaine."></textarea><div class="row" style="justify-content:space-between;margin-top:8px"><label class="check"><input type="checkbox" id="consigneNow" checked> le lancer tout de suite</label><button class="btn sm gold" data-act="consigne" data-id="' + esc(id) + '">Envoyer</button></div></div>';
  if (ag.kind === 'attente') h += '<div class="sec"><div class="wait">' + esc(ag.waiting_for || '') + '</div></div>';
  h += '<div class="sec"><h4>Mission</h4><div class="txt">' + esc(ag.mission || '') + '</div></div>';
  h += '<div class="sec"><h4>Sa stratégie <em>il la réécrit lui-même</em></h4><div class="txt">' + esc(ag.playbook || '(vide)') + '</div></div>';
  if (st.runs) h += '<div class="sec"><div class="kpis"><div class="kpi"><small>Passages</small><b>' + (st.runs || 0) + '</b></div><div class="kpi"><small>Coût total</small><b>' + usd(st.cout) + '</b></div><div class="kpi"><small>Produits</small><b>' + (st.produit || 0) + '</b></div></div></div>';
  if (equipe.length) h += '<div class="sec"><h4>Son équipe <em>' + equipe.length + '</em></h4>' + equipe.map(miniAgent).join('') + '</div>';
  if ((f.taches || []).length) h += '<div class="sec"><h4>Tâches</h4><div class="list">' + f.taches.map((t) => '<div class="item"><div class="meta"><span>' + esc(t.status === 'fait' ? 'Fait' : 'À faire') + ' · de ' + esc(nom(t.from_id)) + '</span><span>' + date(t.created_at) + '</span></div><p><b>' + esc(t.title) + '</b>' + (t.result ? '\n' + esc(t.result) : '') + '</p></div>').join('') + '</div></div>';
  if ((f.savoir || []).length) h += '<div class="sec"><h4>Ce qu\'il a appris <em>' + f.savoir.length + '</em></h4><div class="list">' + f.savoir.map((k) => '<div class="item"><div class="meta"><span>' + esc(k.source === 'appris' ? 'appris seul' : k.source || '') + '</span><span>' + (k.created_at ? date(k.created_at) : '') + '</span></div><p>' + esc(k.content) + '</p></div>').join('') + '</div></div>';
  if ((f.evaluations || []).length) h += '<div class="sec"><h4>Évaluations RH</h4><div class="list">' + f.evaluations.map((e) => '<div class="item"><div class="meta"><span>' + esc(nom(e.agent_id)) + '</span><span>' + date(e.created_at) + '</span></div><p><b>' + esc(e.title) + '</b>\n' + esc(e.body) + '</p></div>').join('') + '</div></div>';
  if ((f.messages || []).length) h += '<div class="sec"><h4>Échanges récents</h4><div class="list">' + f.messages.map((m) => '<div class="item"><div class="meta"><span><span class="kind ' + esc(m.kind) + '">' + esc(KIND[m.kind] || m.kind) + '</span> ' + esc(nom(m.from_id)) + ' → ' + esc(m.to_id ? nom(m.to_id) : 'tous') + '</span><span>' + date(m.created_at) + '</span></div><p><b>' + esc(m.subject || '') + '</b>' + (m.body ? '\n' + esc(m.body) : '') + '</p></div>').join('') + '</div></div>';
  if ((f.runs || []).length) h += '<div class="sec"><h4>Passages <em>coût réel</em></h4><div class="list">' + f.runs.map((r) => '<div class="item"><div class="meta"><span>' + date(r.started_at) + (r.model ? ' · ' + esc(r.model) : '') + (r.searches ? ' · ' + r.searches + ' recherche(s)' : '') + '</span><span class="mono">' + usd(r.cost_usd) + '</span></div><p>' + (r.ok ? '' : '<span style="color:var(--err)">Échec · </span>') + esc(r.summary || '') + '</p>' + (r.log ? '<details><summary>Détail</summary><pre>' + esc(JSON.stringify(r.log, null, 1).slice(0, 4000)) + '</pre></details>' : '') + '</div>').join('') + '</div></div>';
  h += '<div class="sec"><details><summary class="muted" style="cursor:pointer">Fiche de poste complète</summary><div class="txt" style="margin-top:8px">' + esc(ag.charter || '') + '</div></details></div>';
  panel(h, { type: 'agent', id: id });
}
function miniAgent(a) {
  return '<button class="mini" data-agent="' + esc(a.id) + '"><span class="avatar sm" style="--c:' + esc(couleur(a.company_id)) + '">' + esc(initiales(a.name)) + '</span><span style="min-width:0;flex:1"><strong>' + esc(a.name) + ' <span class="muted" style="font-weight:400">· ' + esc(a.title) + '</span></strong><small>' + esc(a.kind === 'attente' ? 'Attend : ' + (a.waiting_for || '') : (a.current_task || STATUT[a.status] || '')) + '</small></span><span class="dot ' + esc(a.status) + '"></span></button>';
}

async function openCompany(id) {
  const c = coDe(id);
  if (!c) return;
  if (c.status === 'proposee') return openSite(id);
  if (S.world) S.world.focus({ type: 'company', id: id });
  const ag = S.m.agents.filter((a) => a.company_id === id);
  const tete = '<div class="ph"><div class="avatar" style="--c:' + esc(c.color) + '">' + esc(initiales(c.name)) + '</div><div><h2>' + esc(c.name) + '</h2><p>' + esc(c.tagline || '') + '</p></div></div>';
  panel(tete + '<div class="muted">Chargement…</div>', { type: 'company', id: id });
  let f = {};
  try { f = await api('company', { id: id }); } catch (e) { /* démo ou erreur : on affiche ce qu'on a */ }
  if (!S.sel || S.sel.id !== id) return;
  const st = f.stats;
  let h = tete + '<div class="txt" style="max-height:none">' + esc(c.mission || '') + '</div>';
  if (st) {
    h += '<div class="sec"><div class="kpis"><div class="kpi"><small>Agents actifs</small><b>' + ag.filter((a) => a.kind !== 'attente').length + '<span class="muted" style="font-size:12px"> / ' + ag.length + '</span></b></div><div class="kpi"><small>Coût 7 jours</small><b>' + usd(st.cout_7j_usd) + '</b></div><div class="kpi"><small>Livrables 7 j</small><b>' + st.equipe.reduce((s, x) => s + x.livrables_7j, 0) + '</b></div></div></div>';
    if (st.prospects) {
      const ps = st.prospects.par_statut || {};
      h += '<div class="sec"><h4>Entonnoir de prospection</h4><div class="kpis"><div class="kpi"><small>Prospects</small><b>' + st.prospects.total + '</b></div><div class="kpi"><small>À contacter</small><b>' + (ps.a_contacter || 0) + '</b></div><div class="kpi"><small>À appeler</small><b>' + (ps.a_appeler || 0) + '</b></div><div class="kpi"><small>Brouillons</small><b>' + ((st.emails || {}).a_valider || 0) + '</b></div><div class="kpi"><small>Envoyés</small><b>' + ((st.emails || {}).envoye || 0) + '</b></div><div class="kpi"><small>Réponses</small><b>' + ((ps.repondu || 0) + (ps.interesse || 0)) + '</b></div></div>' +
        '<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-view="livrables" data-tab="emails">Voir les emails</button><button class="btn sm ghost" data-view="livrables" data-tab="prospects">Voir les prospects</button></div></div>';
    }
  }
  const attente = ag.filter((a) => a.kind === 'attente');
  if (attente.length) h += '<div class="sec"><h4>Ce qui attend un outil <em>' + attente.length + '</em></h4><div class="list">' + attente.map((a) => '<div class="wait"><b>' + esc(a.name) + ', ' + esc(a.title) + '</b><br>' + esc(a.waiting_for || '') + '</div>').join('') + '</div></div>';
  h += '<div class="sec"><h4>L\'équipe <em>' + ag.length + '</em></h4>' + ag.filter((a) => a.kind !== 'attente').map(miniAgent).join('') + '</div>';
  if ((f.livrables || []).length) h += '<div class="sec"><h4>Derniers livrables</h4><div class="list">' + f.livrables.slice(0, 12).map(itemCarte).join('') + '</div></div>';
  panel(h, { type: 'company', id: id });
}
function itemCarte(i) {
  return '<div class="item"><div class="meta"><span><span class="kind">' + esc((ITEMK[i.kind] || i.kind).replace(/s$/, '')) + '</span> ' + esc(nom(i.agent_id)) + (i.score != null ? ' · ' + i.score + '/100' : '') + (i.status && i.status !== 'nouveau' ? ' · ' + esc(i.status) : '') + '</span><span>' + date(i.created_at) + '</span></div><p><b>' + esc(i.title) + '</b></p>' + (i.body ? '<details><summary>Lire</summary><pre>' + esc(i.body) + '</pre></details>' : '') + '</div>';
}

function openSite(companyId) {
  const c = coDe(companyId); const p = propDe(companyId);
  if (S.world) S.world.focus({ type: 'site', id: companyId });
  if (p) return openProposal(p.id);
  panel('<div class="ph"><div class="avatar" style="--c:' + esc(c.color) + '">' + esc(initiales(c.name)) + '</div><div><h2>' + esc(c.name) + '</h2><p>' + esc(c.tagline || '') + '</p></div></div><div class="txt">' + esc(c.mission || '') + '</div>', { type: 'site', id: companyId });
}

function openProposal(id) {
  const p = (S.m.proposals || []).find((x) => x.id === id);
  if (!p) return;
  const cid = p.details && p.details.company_id;
  const c = cid ? coDe(cid) : coDe(p.company_id);
  let h = '<div class="ph"><div class="avatar" style="--c:' + esc((c || {}).color || '#E8C872') + '">' + esc(initiales(p.title.replace(/^Créer\s+/i, ''))) + '</div><div><h2>' + esc(p.title) + '</h2><p>' + esc(PROPK[p.kind] || p.kind) + ' · proposé par ' + esc(nom(p.from_id)) + (poste(p.from_id) ? ', ' + esc(poste(p.from_id)) : '') + '</p></div></div>';
  h += '<div class="row"><span class="status ' + (p.status === 'a_louis' ? 'waiting' : '') + '">' + esc({ ouverte: 'En discussion', a_louis: 'Attend ta décision', validee: 'Validé', refusee: 'Refusé', executee: 'Exécuté' }[p.status] || p.status) + '</span>' + (p.cost_month_usd != null ? '<span class="muted" style="font-size:12px">Coût estimé : ' + usd(p.cost_month_usd) + ' / mois</span>' : '') + '</div>';
  h += '<div class="sec"><h4>Le dossier</h4><div class="txt" style="max-height:none">' + esc(p.justification || '') + '</div></div>';
  if (p.details && p.details.etapes) h += '<div class="sec"><h4>Démarrage</h4><ol class="steps">' + p.details.etapes.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ol></div>';
  if ((p.avis || []).length) h += '<div class="sec"><h4>Avis de la hiérarchie</h4>' + p.avis.map((a) => '<div class="avis ' + esc(a.avis) + '"><b>' + esc(a.nom) + '</b> <span class="muted">' + esc(a.role || '') + ' · ' + esc(a.avis) + '</span><br>' + esc(a.texte) + '</div>').join('') + '</div>';
  if (p.decision_note) h += '<div class="sec"><h4>Note</h4><div class="txt">' + esc(p.decision_note) + '</div></div>';
  if (p.status === 'a_louis' || p.status === 'ouverte') {
    h += '<div class="sec"><h4>Ta décision</h4><textarea class="in" id="propNote" placeholder="Optionnel : une précision pour l\'équipe (budget, prix, conditions)."></textarea><div class="row" style="margin-top:9px"><button class="btn ok" data-act="decider" data-id="' + p.id + '" data-d="valider">Valider</button><button class="btn danger" data-act="decider" data-id="' + p.id + '" data-d="refuser">Refuser</button></div></div>';
  }
  panel(h, { type: 'proposal', id: id });
}

function openValidations() {
  if (S.world) S.world.focus({ type: 'roof' });
  const props = (S.m.proposals || []).filter((p) => p.status === 'a_louis');
  const enCours = (S.m.proposals || []).filter((p) => p.status === 'ouverte');
  const attente = S.m.agents.filter((a) => a.kind === 'attente');
  let h = '<div class="ph"><div class="avatar" style="--c:var(--gold)">LR</div><div><h2>Le Board</h2><p>Ce qui attend ta décision, et ce que tes agents attendent de toi</p></div></div>';
  h += '<div class="sec"><h4>À décider <em>' + props.length + '</em></h4><div class="list">' + (props.map((p) => '<button class="item click" data-prop="' + p.id + '"><div class="meta"><span>' + esc(PROPK[p.kind] || p.kind) + ' · ' + esc(nom(p.from_id)) + '</span><span>' + (p.cost_month_usd != null ? usd(p.cost_month_usd) + '/mois' : '') + '</span></div><p><b>' + esc(p.title) + '</b>\n' + esc((p.justification || '').slice(0, 180)) + '…</p></button>').join('') || '<div class="empty">Rien à décider pour l\'instant.</div>') + '</div></div>';
  if (enCours.length) h += '<div class="sec"><h4>En discussion dans les équipes <em>' + enCours.length + '</em></h4><div class="list">' + enCours.map((p) => '<button class="item click" data-prop="' + p.id + '"><div class="meta"><span>' + esc(PROPK[p.kind] || p.kind) + ' · ' + esc(nom(p.from_id)) + '</span><span>' + date(p.created_at) + '</span></div><p><b>' + esc(p.title) + '</b></p></button>').join('') + '</div></div>';
  h += '<div class="sec"><h4>Ce que tes agents attendent <em>' + attente.length + '</em></h4><div class="list">' + attente.map((a) => '<button class="wait" style="text-align:left" data-agent="' + esc(a.id) + '"><b>' + esc(a.name) + ', ' + esc(a.title) + '</b> <span class="muted">· ' + esc((coDe(a.company_id) || {}).name || '') + '</span><br>' + esc(a.waiting_for || '') + '</button>').join('') + '</div></div>';
  panel(h, { type: 'validations' });
}

function openBudget() {
  const b = S.m.budget || {}, j = S.m.jour || {};
  const envoiOk = S.etat && S.etat.envoi;
  let h = '<div class="ph"><div class="avatar" style="--c:var(--accent)">$</div><div><h2>Budget et réglages</h2><p>Le plafond est respecté par tous les agents, au centime près</p></div></div>';
  h += '<div class="kpis"><div class="kpi"><small>Aujourd\'hui</small><b>' + usd(j.cost_usd) + '</b></div><div class="kpi"><small>Passages</small><b>' + (j.runs || 0) + '</b></div><div class="kpi"><small>7 jours</small><b>' + usd((S.m.historique || []).slice(-7).reduce((s, x) => s + Number(x.cost_usd || 0), 0)) + '</b></div></div>';
  h += '<div class="sec"><label class="field"><span>Plafond IA par jour (dollars)</span><input class="in" id="bJour" type="number" min="0" max="50" step="0.25" value="' + esc(b.jour_usd) + '"></label>' +
    '<label class="field"><span>Recherches web par jour (1 cent chacune)</span><input class="in" id="bRech" type="number" min="0" max="500" value="' + esc(b.recherches_jour) + '"></label>' +
    '<label class="field"><span>Recherches Google Maps par jour (prospection)</span><input class="in" id="bPlaces" type="number" min="0" max="500" value="' + esc(b.places_jour) + '"></label>' +
    '<label class="field"><span>Emails envoyés par jour maximum</span><input class="in" id="bMails" type="number" min="0" max="200" value="' + esc(b.emails_jour) + '"></label>' +
    '<div class="row" style="justify-content:space-between;margin:6px 0 4px"><span><b>Envoyer sans ma validation</b><br><span class="muted" style="font-size:12px">' + (envoiOk ? 'Les emails de la rédactrice partent seuls, sans passer par toi. Laisse coupé tant que tu relis.' : 'Possible une fois ta boîte d\'envoi branchée.') + '</span></span><button class="switch' + (b.envoi_auto ? ' on' : '') + '" id="bAuto" ' + (envoiOk ? '' : 'disabled style="opacity:.4"') + ' aria-label="Envoyer sans validation"></button></div>' +
    '<button class="btn primary" data-act="saveBudget" style="margin-top:12px">Enregistrer</button></div>';
  h += '<div class="sec"><h4>Nom du groupe</h4><div class="row"><input class="in" id="gName" value="' + esc(S.m.groupe.name) + '" style="flex:1"><button class="btn sm ghost" data-act="saveGroupe">Renommer</button></div></div>';
  if (S.etat) h += '<div class="sec"><h4>Branchements</h4><div class="list">' + [['Base Supabase (' + S.etat.projet + ')', S.etat.base && !demo()], ['Clé Anthropic', S.etat.anthropic], ['Clé Google Maps', S.etat.google], ['Boîte d\'envoi' + (S.etat.boite ? ' (' + S.etat.boite + ')' : ''), S.etat.envoi, 'boite']].map((x) => '<' + (x[2] ? 'button data-act="' + x[2] + '" class="item click"' : 'div class="item"') + ' style="display:flex;justify-content:space-between"><span>' + esc(x[0]) + '</span><b style="color:' + (x[1] ? 'var(--ok)' : 'var(--faint)') + '">' + (x[1] ? 'branché' : (x[2] ? 'brancher' : 'non')) + '</b></' + (x[2] ? 'button' : 'div') + '>').join('') + '</div></div>';
  panel(h, { type: 'budget' });
}

function openSetup() {
  const e = S.etat || {};
  const raison = S.m && S.m.raison;
  const etape1 = e.base && raison !== 'cle_refusee';
  const etape2 = !demo();
  let h = '<div class="ph"><div class="avatar" style="--c:var(--warn)">!</div><div><h2>Brancher la base</h2><p>Deux gestes, une seule fois</p></div></div>';
  h += '<ol class="steps">';
  h += '<li class="' + (raison === 'tables' || etape2 ? 'done' : '') + '"><b>Créer les tables</b>Le plus simple : dis « go base » à Claude dans la conversation et accepte la question du connecteur Supabase. Sinon : ouvre <a href="https://supabase.com/dashboard/project/fbmzlfrwxrzflfkazvmn/sql/new" target="_blank" rel="noopener">l\'éditeur SQL du projet Novalemo</a>, colle le script et clique Run.<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="copySql">Copier le script SQL</button></div></li>';
  h += '<li class="' + (etape1 ? 'done' : '') + '"><b>Donner la clé à Vercel</b>Supabase, projet Novalemo, Project Settings, API Keys, onglet « Legacy API keys » : copie la clé <code>service_role</code>. Puis Vercel, projet btprecruit-crm, Settings, Environment Variables : ajoute <code>HQ_SUPABASE_KEY</code> avec cette valeur, coche les 3 environnements, Save, puis redéploie.</li>';
  h += '<li class="' + (etape2 ? 'done' : '') + '"><b>C\'est parti</b>Recharge cette page : la fondation se pose toute seule (43 agents), les premiers passages démarrent au prochain cycle (15 min max) ou tout de suite avec « Lancer un cycle ».</li>';
  h += '<li class="' + (e.envoi ? 'done' : '') + '"><b>Brancher ta boîte d\'envoi</b>Quand tu veux : dans Vercel, ajoute <code>HQ_MAIL_USER</code> (l\'adresse, ex. contact@studionovalem.fr) et <code>HQ_MAIL_PASS</code> (son mot de passe), puis redéploie. Les emails validés partiront seuls et les réponses arriveront dans la tour.<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="boite">Voir la boîte</button></div></li>';
  h += '</ol>';
  panel(h, { type: 'setup' });
}

async function openBoite() {
  const tete = (sous) => '<div class="ph"><div class="avatar" style="--c:var(--accent)">@</div><div><h2>La boîte d\'envoi</h2><p>' + sous + '</p></div></div>';
  if (!S.etat || !S.etat.envoi) {
    panel(tete('Pas encore branchée') + '<div class="sec"><p style="margin-top:0">La boîte mail qui envoie les emails des agents et reçoit les réponses des prospects. Deux variables dans Vercel, une seule fois :</p><ol class="steps"><li><b>HQ_MAIL_USER</b>L\'adresse d\'envoi, par exemple <code>contact@studionovalem.fr</code>.</li><li><b>HQ_MAIL_PASS</b>Le mot de passe de cette boîte (celui de ton webmail ; chez Google, un mot de passe d\'application).</li><li><b>Redéploie</b>Vercel, Deployments, les trois points du dernier déploiement, Redeploy. Le serveur (OVH, Google, Zoho, IONOS...) est reconnu tout seul.</li></ol></div><div class="sec"><h4>Ce qui se passe ensuite</h4><p class="muted" style="font-size:12.5px;margin:0">Les emails que tu valides partent de ta boîte (copie dans tes « Envoyés »), 5 par jour au début puis de plus en plus. Les réponses, STOP et adresses invalides sont lus toutes les 15 minutes, uniquement ceux liés à nos envois : le reste de ta boîte n\'est jamais lu.</p></div>', { type: 'boite' });
    return;
  }
  panel(tete('Chargement…'), { type: 'boite' });
  let b;
  try { b = await api('boite'); } catch (e) { b = { erreur: e.message }; }
  if (!S.sel || S.sel.type !== 'boite') return;
  if (!b || b.erreur) return panel(tete('Erreur') + '<div class="sec"><p class="err">' + esc((b && b.erreur) || 'Erreur') + '</p></div>', { type: 'boite' });
  let h = tete(esc(b.adresse) + (b.fournisseur ? ' · ' + esc(b.fournisseur) : ''));
  h += '<div class="kpis"><div class="kpi"><small>Aujourd\'hui</small><b>' + b.envoyes_jour + ' / ' + b.quota + '</b></div><div class="kpi"><small>En file</small><b>' + b.prets + '</b></div><div class="kpi"><small>Réponses 14 j</small><b>' + b.stats14.reponses + ' <span class="muted" style="font-size:12px">' + b.stats14.taux_reponse + ' %</span></b></div></div>';
  if (b.pause) h += '<div class="sec"><div class="wait">En pause : ' + esc(b.raison || '') + '</div><div class="row" style="margin-top:8px"><button class="btn sm ok" data-act="boitePause" data-p="0">Reprendre l\'envoi</button></div></div>';
  h += '<div class="sec"><h4>Le rythme</h4><p style="margin:0;font-size:13px;color:#cfd8e8">Les emails validés partent ' + esc(b.fenetre) + ', deux par passage, espacés. Chauffe de la boîte : 5 par jour la première semaine, puis 8, 12, 16, jusqu\'à 20 (jamais plus que ton plafond de ' + b.plafond + '). Les réponses que tu valides partent tout de suite. Trop d\'adresses invalides : pause automatique.</p>' +
    '<div class="row" style="justify-content:space-between;align-items:center;flex-wrap:nowrap;gap:14px;margin:12px 0 0"><span><b>Envoyer sans ma validation</b><br><span class="muted" style="font-size:12px">Les emails de la rédactrice partent seuls. Seulement quand tu lui fais confiance.</span></span><button class="switch' + (b.envoi_auto ? ' on' : '') + '" data-act="boiteAuto" data-v="' + (b.envoi_auto ? '0' : '1') + '" aria-label="Envoyer sans validation"></button></div></div>';
  const s = b.stats14;
  h += '<div class="sec"><h4>14 derniers jours</h4><div class="list">' + [['Envoyés', s.envoyes], ['Réponses', s.reponses], ['STOP', s.stop], ['Adresses invalides (rebonds)', s.rebonds], ['Absences (réponses automatiques)', s.absences]].map((x) => '<div class="item" style="display:flex;justify-content:space-between"><span>' + x[0] + '</span><b class="mono">' + x[1] + '</b></div>').join('') + '</div></div>';
  if (b.dns) {
    const d = b.dns;
    h += '<div class="sec"><h4>Délivrabilité du domaine ' + esc(d.domaine) + '</h4><div class="list">' + [['SPF', d.spf], ['DKIM', d.dkim], ['DMARC', d.dmarc]].map((x) => '<div class="item"><div class="meta"><b style="color:' + (x[1].ok ? 'var(--ok)' : 'var(--warn)') + '">' + x[0] + ' : ' + (x[1].ok ? 'OK' : 'à régler') + '</b></div>' + (x[1].conseil ? '<p>' + esc(x[1].conseil) + '</p>' : '') + '</div>').join('') + '</div><div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="boiteDns">Revérifier</button></div></div>';
  }
  h += '<div class="sec"><h4>Réception</h4><p style="margin:0 0 8px;font-size:12.5px" class="muted">Dernière relève : ' + (b.releve_at ? depuis(b.releve_at) : 'jamais') + (b.erreur_releve ? ' · <span style="color:var(--err)">' + esc(b.erreur_releve) + '</span>' : '') + '. Seuls les messages liés à nos envois sont lus, rien n\'est marqué comme lu.</p>' +
    '<div class="row"><button class="btn sm ghost" data-act="boiteReleve">Relever maintenant</button><button class="btn sm ghost" data-act="boiteTest">Tester la connexion</button><button class="btn sm ghost" data-act="boiteEssai">M\'envoyer un email test</button>' + (b.pause ? '' : '<button class="btn sm danger" data-act="boitePause" data-p="1">Mettre en pause</button>') + '</div>' +
    (b.aide_mot_de_passe ? '<p class="muted" style="font-size:12px;margin:8px 0 0">Chez ' + esc(b.fournisseur) + ', HQ_MAIL_PASS doit être un ' + esc(b.aide_mot_de_passe) + '.</p>' : '') + '</div>';
  panel(h, { type: 'boite' });
}

/* ── pages ── */
function setView(v, tab) {
  S.view = v;
  if (tab) S.tab = tab;
  $$('#views button, .mobile-views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'tour') { $('#page').hidden = true; return; }
  $('#page').hidden = false;
  $('#rail').classList.remove('open');
  renderPage(false);
}
let pageData = {};
async function renderPage(silencieux) {
  const v = S.view, page = $('#page');
  if (v === 'org') return renderOrg();
  if (v === 'chiffres') return renderChiffres();
  if (v === 'livrables') {
    if (silencieux && document.activeElement && page.contains(document.activeElement) && /TEXTAREA|INPUT/.test(document.activeElement.tagName)) return; // ne pas effacer une saisie
    if (!silencieux) page.innerHTML = '<h1>Livrables</h1><p class="lead">Chargement…</p>';
    try {
      if (S.tab === 'emails') pageData.emails = (await api('outbox', { limite: 80 })).rows;
      if (S.tab === 'reponses') pageData.inbox = (await api('inbox', { limite: 60 })).rows;
      if ((S.tab === 'emails' || S.tab === 'reponses') && S.m.boite && S.m.boite.branchee) pageData.boite = await api('boite').catch(() => null);
      if (S.tab === 'prospects') pageData.leads = (await api('leads', { limite: 200, statut: S.filtre || '' })).rows;
      if (S.tab === 'fiches') pageData.items = (await api('livrables', { limite: 100, type: S.sous || '' })).rows;
    } catch (e) { if (!silencieux) toast(e.message, 'err'); }
    renderLivrables();
  }
}

function renderOrg() {
  const actives = S.m.companies.filter((c) => c.status === 'active').slice().sort((a, b) => b.floor_order - a.floor_order);
  let h = '<h1>Organigramme</h1><p class="lead">Qui dirige qui. Chaque agent a sa fiche de poste, sa stratégie qu\'il réécrit, et rend des comptes à son chef. Clique sur une carte pour ouvrir sa fiche.</p><div class="org">';
  actives.forEach((c) => {
    const ag = S.m.agents.filter((a) => a.company_id === c.id);
    const racines = ag.filter((a) => !a.parent_id || !ag.some((x) => x.id === a.parent_id));
    const branche = (a) => {
      const enf = ag.filter((x) => x.parent_id === a.id);
      return '<li>' + carte(a) + (enf.length ? '<ul>' + enf.map(branche).join('') + '</ul>' : '') + '</li>';
    };
    h += '<section class="org-co" style="--c:' + esc(c.color) + '"><h2><i></i>' + esc(c.name) + ' <small>' + ag.length + ' agents</small></h2><div class="tree-wrap"><ul class="tree">' + racines.map(branche).join('') + '</ul></div></section>';
  });
  $('#page').innerHTML = h + '</div>';
}
function carte(a) {
  return '<button class="card' + (a.kind === 'attente' ? ' attente' : '') + '" data-agent="' + esc(a.id) + '"><span class="st"><span class="dot ' + esc(a.status) + '"></span></span><span class="top"><span class="avatar sm" style="--c:' + esc(couleur(a.company_id)) + '">' + esc(initiales(a.name)) + '</span><span><strong>' + esc(a.name) + '</strong><small>' + esc(a.title) + '</small></span></span><p>' + esc(a.kind === 'attente' ? 'Attend : ' + (a.waiting_for || '') : (a.current_task || a.mission || '')) + '</p></button>';
}

function renderLivrables() {
  const c = S.m.compteurs || {};
  const bo = S.m.boite && S.m.boite.branchee;
  let h = '<h1>Livrables</h1><p class="lead">' + (bo ? 'Ce que les agents ont produit. Les emails que tu valides partent de ta boîte, au rythme de la chauffe (jours ouvrés, 8 h à 17 h 30). Quand un prospect répond, Emma prépare la réponse : tu relis et tu envoies. Chaque retour que tu donnes devient une leçon pour la rédactrice.' : 'Ce que les agents ont produit. Tant que ta boîte d\'envoi n\'est pas branchée, les emails se copient à la main : relis, corrige, puis copie. Chaque retour que tu donnes devient une leçon pour la rédactrice.') + '</p>';
  h += '<div class="tabs">' + [['reponses', 'Réponses', c.reponses], ['emails', 'Emails à valider', c.brouillons], ['prospects', 'Prospects', c.prospects], ['fiches', 'Veille et fiches', c.livrables]].map((t) => '<button data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + (t[2] ? '<b>' + t[2] + '</b>' : '') + '</button>').join('') + '</div>';
  if (S.tab === 'emails' || S.tab === 'reponses') h += barreBoite();
  if (S.tab === 'reponses') {
    const rows = pageData.inbox || [];
    const ouvertes = rows.filter((r) => r.status === 'nouveau' || r.status === 'brouillon'), faites = rows.filter((r) => !(r.status === 'nouveau' || r.status === 'brouillon')).slice(0, 25);
    h += ouvertes.length ? ouvertes.map(carteReponse).join('') : '<div class="empty">' + (bo ? 'Aucune réponse en attente. Dès qu\'un prospect répond, elle arrive ici avec une réponse préparée par Emma (relève toutes les 15 minutes).' : 'Les réponses des prospects arriveront ici quand ta boîte sera branchée.') + '</div>';
    if (faites.length) h += '<h3 class="muted" style="margin:22px 0 10px;font:600 12px var(--f-ui);text-transform:uppercase;letter-spacing:.08em">Déjà traitées</h3>' + faites.map(carteReponse).join('');
  }
  if (S.tab === 'emails') {
    const rows = (pageData.emails || []).filter((r) => r.kind !== 'reponse' && ['a_valider', 'pret', 'erreur'].indexOf(r.status) >= 0);
    const autres = (pageData.emails || []).filter((r) => ['envoye', 'annule'].indexOf(r.status) >= 0).slice(0, 20);
    h += rows.length ? rows.map(carteMail).join('') : '<div class="empty">Aucun email en attente. La rédactrice écrit dès que le Fournisseur de contacts a des prospects avec email.</div>';
    if (autres.length) h += '<h3 class="muted" style="margin:22px 0 10px;font:600 12px var(--f-ui);text-transform:uppercase;letter-spacing:.08em">Déjà traités</h3><table class="t"><tr><th>À</th><th>Objet</th><th>Statut</th><th>Le</th></tr>' + autres.map((r) => '<tr><td>' + esc(r.to_email) + '</td><td>' + esc(r.subject) + (r.kind === 'reponse' ? ' <span class="muted">(réponse)</span>' : r.kind === 'relance' ? ' <span class="muted">(relance)</span>' : '') + '</td><td><span class="pill ' + esc(r.status) + '">' + esc(r.status === 'envoye' ? 'envoyé' : 'annulé') + '</span>' + (r.error ? '<div class="muted" style="font-size:11px">' + esc(r.error) + '</div>' : '') + '</td><td class="muted">' + date(r.sent_at || r.updated_at) + '</td></tr>').join('') + '</table>';
  }
  if (S.tab === 'prospects') {
    const rows = pageData.leads || [];
    const st = ['', 'a_contacter', 'a_appeler', 'brouillon', 'contacte', 'nouveau', 'sans_contact', 'ecarte'];
    h += '<div class="tabs">' + st.map((s) => '<button data-filtre="' + s + '" class="' + (S.filtre === s ? 'on' : '') + '">' + (s ? LEADS[s] : 'Tous') + '</button>').join('') + '</div>';
    h += rows.length ? '<div style="overflow-x:auto"><table class="t"><tr><th>Entreprise</th><th>Métier</th><th>Lieu</th><th>Site</th><th>Contact</th><th>Note</th><th>Statut</th><th></th></tr>' + rows.map((l) => '<tr><td><b>' + esc(l.name) + '</b><div class="muted" style="font-size:11.5px">' + esc({ domaines: 'nouveau domaine', maps: 'Google Maps', registre: 'BODACC', partenaires: 'prescripteur', web: 'web' }[l.source] || l.source) + '</div></td><td>' + esc(l.sector || '') + '</td><td>' + esc([l.commune, l.island].filter(Boolean).join(', ')) + '</td><td>' + (l.website ? '<a href="' + esc(/^https?:/.test(l.website) ? l.website : 'https://' + l.website) + '" target="_blank" rel="noopener">' + esc(l.site_state || 'site') + '</a>' : esc(l.site_state || 'aucun')) + (l.data && l.data.audit && l.data.audit.defauts && l.data.audit.defauts.length ? '<div class="muted" style="font-size:11.5px">' + esc(l.data.audit.defauts.join(', ')) + '</div>' : '') + '</td><td>' + (l.email ? esc(l.email) + (l.email_source === 'devine' ? ' <span class="muted">(deviné)</span>' : '') : '') + (l.phone ? '<div><a href="tel:' + esc(l.phone.replace(/\s/g, '')) + '">' + esc(l.phone) + '</a></div>' : '') + '</td><td class="mono">' + (l.score || '') + '</td><td><span class="pill ' + esc(l.status) + '">' + esc(LEADS[l.status] || l.status) + '</span><div class="muted" style="font-size:11px;max-width:220px">' + esc((l.reason || '').slice(0, 120)) + '</div></td><td>' + (['stop', 'ecarte'].indexOf(l.status) < 0 ? '<button class="btn sm ghost" data-act="leadStop" data-id="' + l.id + '" title="Ne plus jamais contacter">STOP</button>' : '') + '</td></tr>').join('') + '</table></div>' : '<div class="empty">Aucun prospect' + (S.filtre ? ' dans ce statut' : '') + ' pour l\'instant. Les chasseurs tournent toutes les quelques heures.</div>';
  }
  if (S.tab === 'fiches') {
    const kinds = ['', 'reference', 'repo', 'veille', 'idee', 'script', 'niche', 'evaluation'];
    h += '<div class="tabs">' + kinds.map((k) => '<button data-sous="' + k + '" class="' + (S.sous === k ? 'on' : '') + '">' + (k ? ITEMK[k] : 'Tout') + '</button>').join('') + '</div>';
    const rows = pageData.items || [];
    h += rows.length ? '<div class="cards">' + rows.map(itemCarte).join('') + '</div>' : '<div class="empty">Rien pour l\'instant.</div>';
  }
  $('#page').innerHTML = h;
}
function barreBoite() {
  if (!S.m.boite || !S.m.boite.branchee) return '<div class="boitebar off"><span><b>Boîte d\'envoi non branchée</b><small>Branche ta boîte : les emails validés partiront seuls, au bon rythme, et les réponses arriveront ici.</small></span><button class="btn sm primary" data-act="boite">Brancher ma boîte</button></div>';
  const b = pageData.boite;
  if (!b) return '<div class="boitebar"><span><b>Boîte branchée</b></span><button class="btn sm ghost" data-act="boite">La boîte</button></div>';
  return '<div class="boitebar' + (b.pause ? ' pause' : '') + '"><span><b>' + esc(b.adresse) + '</b><small>' + (b.pause ? 'En pause : ' + esc(b.raison || '') : 'Aujourd\'hui ' + b.envoyes_jour + ' sur ' + b.quota + ' (palier de chauffe) · ' + b.prets + ' en file · ' + b.stats14.reponses + ' réponse(s) en 14 jours') + '</small></span><button class="btn sm ghost" data-act="boite">La boîte</button></div>';
}
function carteReponse(r) {
  const l = r.lead || {}, o = r.origine, rep = r.reponse;
  const ouverte = r.status === 'nouveau' || r.status === 'brouillon';
  let h = '<article class="mail reply' + (ouverte ? ' open' : '') + '"><header><span><b>' + esc(r.from_name || r.from_email) + '</b>' + (l.name && l.name !== r.from_name ? ' <span class="muted">· ' + esc(l.name) + '</span>' : '') + '<div class="muted" style="font-size:12px">' + esc(r.from_email) + ' · ' + date(r.received_at) + (l.sector ? ' · ' + esc(l.sector) : '') + (l.commune ? ', ' + esc(l.commune) : '') + '</div></span><span class="pill ' + esc(r.intent || r.status) + '">' + esc(INTENT[r.intent] || { nouveau: 'nouvelle', brouillon: 'réponse prête', traite: 'traitée', archive: 'archivée' }[r.status] || r.status) + '</span></header>';
  h += '<div class="body theirs">' + esc(r.body || '(message vide)') + '</div>';
  if (r.data && r.data.pieces && r.data.pieces.length) h += '<p class="ctx">Pièce(s) jointe(s) : ' + esc(r.data.pieces.map((p) => p.nom).filter(Boolean).join(', ')) + ' (ouvre-les dans ta messagerie)</p>';
  if (r.data && r.data.note) h += '<p class="ctx">Emma : ' + esc(r.data.note) + '</p>';
  if (o) h += '<details class="orig"><summary>Notre email : ' + esc(o.subject) + '</summary><div class="body">' + esc(o.body) + '</div></details>';
  let btns = '';
  if (rep && rep.status !== 'envoye') {
    h += '<div class="draft"><small>Réponse préparée par ' + esc(nom(rep.agent_id)) + ', modifie-la si besoin</small><textarea class="in" id="rb' + rep.id + '">' + esc(rep.body) + '</textarea>' + (rep.status === 'erreur' && rep.error ? '<p class="err">Envoi raté : ' + esc(rep.error) + '</p>' : '') + '</div>';
    btns += '<button class="btn sm ok" data-act="repSend" data-id="' + rep.id + '">' + (rep.status === 'pret' ? 'Envoyer maintenant' : 'Envoyer la réponse') + '</button>';
  } else if (rep && rep.status === 'envoye') {
    h += '<p class="ctx">Réponse envoyée ' + date(rep.sent_at) + '.</p>';
  } else if (r.status === 'nouveau') {
    h += '<p class="ctx">Emma prépare une réponse au prochain passage.</p>';
    btns += '<button class="btn sm ghost" data-act="lancer" data-id="reponses">Lancer Emma maintenant</button>';
  }
  if (l.phone) btns += '<a class="btn sm ghost" href="tel:' + esc(String(l.phone).replace(/\s/g, '')) + '">Appeler ' + esc(l.phone) + '</a>';
  if (ouverte && r.intent !== 'interesse' && r.intent !== 'rdv') btns += '<button class="btn sm ghost" data-act="repInteresse" data-id="' + r.id + '">Il est intéressé</button>';
  if (ouverte) btns += '<button class="btn sm ghost" data-act="repTraite" data-id="' + r.id + '">Marquer traitée</button>';
  if (l.id && l.status !== 'stop' && ouverte) btns += '<button class="btn sm danger" data-act="leadStop" data-id="' + l.id + '">STOP</button>';
  return h + (btns ? '<div class="row" style="margin-top:10px">' + btns + '</div>' : '') + '</article>';
}
function carteMail(r) {
  const l = r.lead || {};
  const bo = S.m.boite && S.m.boite.branchee;
  const mailto = 'mailto:' + encodeURIComponent(r.to_email) + '?subject=' + encodeURIComponent(r.subject) + '&body=' + encodeURIComponent(r.body);
  return '<article class="mail" data-mail="' + r.id + '"><header><span><b>' + esc(r.subject) + '</b><div class="muted" style="font-size:12px">à ' + esc(r.to_email) + ' · ' + esc(l.name || '') + (l.sector ? ' · ' + esc(l.sector) : '') + (l.commune ? ', ' + esc(l.commune) : '') + (r.angle ? ' · angle ' + esc(r.angle) : '') + (r.step > 1 ? ' · relance ' + (r.step - 1) + ' (même fil)' : '') + '</div></span><span class="pill ' + esc(r.status) + '">' + esc({ a_valider: 'à valider', pret: 'en file d\'envoi', erreur: 'erreur d\'envoi' }[r.status] || r.status) + '</span></header>' +
    (l.website ? '<p class="ctx">Site : <a href="' + esc(/^https?:/.test(l.website) ? l.website : 'https://' + l.website) + '" target="_blank" rel="noopener">' + esc(l.website) + '</a> (' + esc(l.site_state || '') + ')</p>' : '') +
    (r.status === 'erreur' && r.error ? '<p class="err">Envoi raté : ' + esc(r.error) + '</p>' : '') +
    '<div class="body" data-edit="' + r.id + '">' + esc(r.body) + '</div>' +
    '<div class="row" style="margin-top:10px">' +
    (bo ? (r.status === 'pret' ? '<button class="btn sm ghost" data-act="mail" data-id="' + r.id + '" data-s="a_valider">Retirer de la file</button>' : '<button class="btn sm ok" data-act="mail" data-id="' + r.id + '" data-s="pret">' + (r.status === 'erreur' ? 'Réessayer' : 'Valider l\'envoi') + '</button>') : '<a class="btn sm ok" href="' + mailto + '" data-act="mailOpen" data-id="' + r.id + '">Ouvrir dans ma messagerie</a><button class="btn sm ghost" data-act="mailCopy" data-id="' + r.id + '">Copier</button><button class="btn sm ghost" data-act="mail" data-id="' + r.id + '" data-s="envoye">Marquer envoyé</button>') +
    '<button class="btn sm ghost" data-act="mailEdit" data-id="' + r.id + '">Modifier</button><button class="btn sm ghost" data-act="mailRetour" data-id="' + r.id + '">Retour à la rédactrice</button><button class="btn sm danger" data-act="mail" data-id="' + r.id + '" data-s="annule">Annuler</button></div></article>';
}

function renderChiffres() {
  const c = S.m.compteurs || {}, j = S.m.jour || {}, hist = S.m.historique || [];
  const total7 = hist.slice(-7).reduce((s, x) => s + Number(x.cost_usd || 0), 0);
  let h = '<h1>Chiffres</h1><p class="lead">Ce que le groupe produit et ce qu\'il coûte, jour par jour.</p>';
  h += '<div class="grid-k">' + [['Coût aujourd\'hui', usd(j.cost_usd)], ['Coût 7 jours', usd(total7)], ['Passages aujourd\'hui', j.runs || 0], ['Prospects', c.prospects || 0], ['À contacter', c.a_contacter || 0], ['À appeler', c.a_appeler || 0], ['Emails à valider', c.brouillons || 0], ['Emails envoyés', c.envoyes || 0], ['Livrables', c.livrables || 0]].map((k) => '<div class="kpi"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>').join('') + '</div>';
  h += '<canvas class="chart" id="chart"></canvas>';
  const top = S.m.agents.filter((a) => a.stats && a.stats.runs).slice().sort((a, b) => (b.stats.cout || 0) - (a.stats.cout || 0)).slice(0, 14);
  h += '<h3 class="muted" style="margin:22px 0 10px;font:600 12px var(--f-ui);text-transform:uppercase;letter-spacing:.08em">Qui coûte et qui produit (depuis le début)</h3>';
  h += top.length ? '<table class="t"><tr><th>Agent</th><th>Poste</th><th>Passages</th><th>Coût</th><th>Produits</th><th>Note RH</th></tr>' + top.map((a) => '<tr><td><a href="#" data-agent="' + esc(a.id) + '">' + esc(a.name) + '</a></td><td class="muted">' + esc(a.title) + '</td><td class="mono">' + a.stats.runs + '</td><td class="mono">' + usd(a.stats.cout) + '</td><td class="mono">' + (a.stats.produit || 0) + '</td><td class="mono">' + (a.score != null ? a.score : '') + '</td></tr>').join('') + '</table>' : '<div class="empty">Pas encore de passages.</div>';
  $('#page').innerHTML = h;
  dessinerCourbe($('#chart'), hist);
}
function dessinerCourbe(cv, hist) {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const pad = { l: 44, r: 44, t: 26, b: 28 };
  const jours = [];
  for (let k = 13; k >= 0; k--) { const d = new Date(Date.now() - k * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ }); const r = hist.find((x) => x.day === d) || {}; jours.push({ d: d, cout: Number(r.cost_usd || 0), leads: r.leads || 0, emails: r.emails || 0 }); }
  const maxC = Math.max(0.5, ...jours.map((x) => x.cout)), maxL = Math.max(5, ...jours.map((x) => Math.max(x.leads, x.emails)));
  const w = (W - pad.l - pad.r) / jours.length;
  g.font = '11px Inter, sans-serif'; g.fillStyle = '#8A96AD';
  g.fillText('coût $', 8, 16); g.textAlign = 'right'; g.fillText('prospects · emails', W - 8, 16); g.textAlign = 'left';
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i <= 4; i++) { const y = pad.t + (H - pad.t - pad.b) * i / 4; g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke(); }
  jours.forEach((x, i) => {
    const bh = (H - pad.t - pad.b) * x.cout / maxC;
    g.fillStyle = 'rgba(125,211,252,0.35)'; g.fillRect(pad.l + i * w + w * 0.2, H - pad.b - bh, w * 0.6, bh);
    if (i % 2 === 0) { g.fillStyle = '#5B667C'; g.fillText(x.d.slice(8) + '/' + x.d.slice(5, 7), pad.l + i * w + w * 0.15, H - 9); }
  });
  [['leads', '#2EE3AF'], ['emails', '#E8C872']].forEach((s) => {
    g.strokeStyle = s[1]; g.lineWidth = 2; g.beginPath();
    jours.forEach((x, i) => { const px = pad.l + i * w + w / 2, py = H - pad.b - (H - pad.t - pad.b) * x[s[0]] / maxL; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
  });
  g.fillStyle = '#2EE3AF'; g.fillText('● prospects', pad.l + 4, pad.t - 8); g.fillStyle = '#E8C872'; g.fillText('● emails', pad.l + 92, pad.t - 8); g.fillStyle = '#7DD3FC'; g.fillText('■ coût', pad.l + 160, pad.t - 8);
}

/* ── actions ── */
async function action(btn, fn) {
  btn && btn.classList.add('busy'); btn && (btn.disabled = true);
  try { await fn(); } catch (e) { toast(e.message, 'err'); }
  finally { if (btn) { btn.classList.remove('busy'); btn.disabled = false; } }
}
async function lancerCycle(btn, agentId) {
  if (!garde()) return;
  S.cycle = true; poll();
  btn.classList.add('busy'); btn.disabled = true;
  const lib = btn.querySelector('span'); const avant = lib ? lib.textContent : '';
  if (lib) lib.textContent = agentId ? 'Au travail…' : 'Cycle en cours…';
  try {
    const r = await post(agentId ? { agent: agentId } : {}, '/api/tick');
    if (r.occupe) toast('Un cycle tourne déjà, il se termine dans quelques minutes.');
    else if (r.passages) toast(r.passages.length + ' passage(s), ' + usd(r.passages.reduce((s, p) => s + p.cout, 0)) + (r.passages.length === 1 ? ' : ' + r.passages[0].resume.slice(0, 140) : ''), 'ok');
    if (agentId && S.sel && S.sel.id === agentId) setTimeout(() => openAgent(agentId), 600);
  } catch (e) { toast(e.message, 'err'); }
  finally { S.cycle = false; btn.classList.remove('busy'); btn.disabled = false; if (lib) lib.textContent = avant; poll(); }
}

function bind() {
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act],[data-view],[data-agent],[data-company],[data-site],[data-prop],[data-tab],[data-filtre],[data-sous],[data-msg]');
    if (!t) return;
    if (t.tagName === 'A' && t.dataset.act !== 'mailOpen') ev.preventDefault();
    const d = t.dataset;
    if (d.view) return setView(d.view, d.tab);
    if (d.tab && S.view === 'livrables') { S.tab = d.tab; return renderPage(false); }
    if (d.filtre != null && d.filtre !== undefined && S.view === 'livrables') { S.filtre = d.filtre; return renderPage(false); }
    if (d.sous != null && S.view === 'livrables') { S.sous = d.sous; return renderPage(false); }
    if (d.agent) { if (S.view !== 'tour' && window.innerWidth < 820) setView('tour'); return openAgent(d.agent); }
    if (d.company) return openCompany(d.company);
    if (d.site) return openSite(d.site);
    if (d.prop) return openProposal(Number(d.prop));
    if (d.msg) { const m = S.msgs.find((x) => String(x.id) === d.msg); if (m && m.from_id && agentDe(m.from_id)) openAgent(m.from_id); return; }
    switch (d.act) {
      case 'overview': if (S.world) S.world.focus({ type: 'overview' }); setView('tour'); closePanel(); break;
      case 'close': closePanel(); if (S.world) S.world.focus({ type: 'overview' }); break;
      case 'feed': $('#feed').classList.toggle('open'); break;
      case 'rail': $('#rail').classList.toggle('open'); break;
      case 'validations': openValidations(); break;
      case 'budget': openBudget(); break;
      case 'setup': openSetup(); break;
      case 'cycle': lancerCycle(t); break;
      case 'lancer': lancerCycle(t, d.id); break;
      case 'pause': case 'reprendre': if (garde()) action(t, async () => { await post({ op: d.act, agent: d.id }); toast(d.act === 'pause' ? 'En pause.' : 'Repris.', 'ok'); await poll(); openAgent(d.id); }); break;
      case 'consigne': if (garde()) action(t, async () => {
        const txt = $('#consigne').value.trim(); if (!txt) throw new Error('Écris la consigne d\'abord.');
        const now = $('#consigneNow').checked;
        await post({ op: 'consigne', agent: d.id, texte: txt, maintenant: now });
        $('#consigne').value = ''; toast('Consigne transmise à ' + nom(d.id) + '.', 'ok');
        if (now) { const b = $('[data-act="lancer"][data-id="' + d.id + '"]'); if (b) lancerCycle(b, d.id); }
      }); break;
      case 'decider': if (garde()) action(t, async () => {
        await post({ op: 'decider', id: Number(d.id), decision: d.d, note: ($('#propNote') || {}).value || '' });
        toast(d.d === 'valider' ? 'Validé : l\'équipe exécute au prochain passage.' : 'Refusé.', 'ok');
        await poll(); openValidations();
      }); break;
      case 'saveBudget': if (garde()) action(t, async () => {
        await post({ op: 'budget', jour_usd: $('#bJour').value, recherches_jour: $('#bRech').value, places_jour: $('#bPlaces').value, emails_jour: $('#bMails').value, envoi_auto: $('#bAuto').classList.contains('on') });
        toast('Réglages enregistrés.', 'ok'); await poll();
      }); break;
      case 'saveGroupe': if (garde()) action(t, async () => { await post({ op: 'groupe', name: $('#gName').value }); toast('Renommé.', 'ok'); await poll(); }); break;
      case 'copySql': action(t, async () => { const r = await fetch('/supabase/hq-schema.sql'); const s = await r.text(); await navigator.clipboard.writeText(s); toast('Script copié : colle-le dans l\'éditeur SQL de Supabase puis Run.', 'ok'); }); break;
      case 'mail': if (garde()) action(t, async () => { await post({ op: 'email', id: Number(d.id), statut: d.s }); toast({ pret: 'Validé : il part de ta boîte au prochain créneau (jours ouvrés, 8 h à 17 h 30).', a_valider: 'Retiré de la file.', envoye: 'Marqué envoyé.', annule: 'Annulé.' }[d.s] || 'Fait.', 'ok'); await renderPage(true); poll(); }); break;
      case 'boite': openBoite(); break;
      case 'repSend': if (garde()) action(t, async () => {
        const ta = $('#rb' + d.id);
        const r = await post({ op: 'reponse_envoyer', id: Number(d.id), body: ta ? ta.value : undefined });
        toast(r.envoye ? 'Réponse envoyée, dans le même fil.' : 'Pas encore partie : ' + (r.erreur || '') + '. ' + (r.note || ''), r.envoye ? 'ok' : 'err');
        await renderPage(false); poll();
      }); break;
      case 'repInteresse': if (garde()) action(t, async () => { await post({ op: 'reponse_maj', id: Number(d.id), intent: 'interesse' }); toast('Noté : prospect intéressé.', 'ok'); await renderPage(false); poll(); }); break;
      case 'repTraite': if (garde()) action(t, async () => { await post({ op: 'reponse_maj', id: Number(d.id), statut: 'traite' }); toast('Marquée traitée.', 'ok'); await renderPage(false); poll(); }); break;
      case 'boiteTest': action(t, async () => {
        const r = await post({ op: 'boite_test' });
        const pb = [r.smtp && !r.smtp.ok ? 'envoi : ' + r.smtp.erreur : '', r.imap && !r.imap.ok ? 'réception : ' + r.imap.erreur : ''].filter(Boolean).join(' ; ');
        toast(r.ok ? 'Connexion OK : envoi et réception (' + (r.fournisseur || '') + ').' : 'Problème ' + pb, r.ok ? 'ok' : 'err');
      }); break;
      case 'boiteEssai': action(t, async () => { const r = await post({ op: 'boite_test_envoi' }); toast('Email de test envoyé à ' + r.a + ' : regarde s\'il arrive en boîte de réception.', 'ok'); }); break;
      case 'boiteDns': action(t, async () => { await post({ op: 'boite_dns' }); toast('DNS revérifié.', 'ok'); openBoite(); }); break;
      case 'boiteReleve': action(t, async () => { const r = await post({ op: 'boite_releve' }); toast(r.resume || 'Relève faite.', r.erreur ? 'err' : 'ok'); await poll(); if (S.view === 'livrables') renderPage(false); openBoite(); }); break;
      case 'boitePause': action(t, async () => { await post({ op: 'boite_pause', pause: d.p === '1' }); toast(d.p === '1' ? 'Envoi en pause.' : 'Envoi repris.', 'ok'); openBoite(); }); break;
      case 'boiteAuto': if (garde()) action(t, async () => { await post({ op: 'budget', envoi_auto: d.v === '1' }); toast(d.v === '1' ? 'Les emails de la rédactrice partiront sans ta validation.' : 'Chaque email repasse par ta validation.', 'ok'); await poll(); openBoite(); }); break;
      case 'mailCopy': { const r = (pageData.emails || []).find((x) => String(x.id) === d.id); if (r) navigator.clipboard.writeText('Objet : ' + r.subject + '\n\n' + r.body).then(() => toast('Copié. Pense à « Marquer envoyé » après.', 'ok')); break; }
      case 'mailOpen': setTimeout(() => toast('Une fois envoyé, clique « Marquer envoyé ».'), 400); break;
      case 'mailEdit': {
        const box = $('[data-edit="' + d.id + '"]'); const r = (pageData.emails || []).find((x) => String(x.id) === d.id);
        if (!box || !r) break;
        box.outerHTML = '<div data-editing="' + d.id + '"><input class="in" id="es' + d.id + '" value="' + esc(r.subject) + '" style="margin-bottom:6px"><textarea class="in" id="eb' + d.id + '" style="min-height:220px">' + esc(r.body) + '</textarea><div class="row" style="margin-top:6px"><button class="btn sm primary" data-act="mailSave" data-id="' + d.id + '">Enregistrer</button></div></div>';
        break;
      }
      case 'mailSave': if (garde()) action(t, async () => { await post({ op: 'email', id: Number(d.id), subject: $('#es' + d.id).value, body: $('#eb' + d.id).value }); toast('Email modifié.', 'ok'); await renderPage(false); }); break;
      case 'mailRetour': if (garde()) { const txt = prompt('Ton retour sur cet email (il devient une règle pour la rédactrice) :'); if (txt) action(t, async () => { await post({ op: 'email', id: Number(d.id), retour: txt }); toast('Retour noté : Chloé s\'en servira.', 'ok'); }); } break;
      case 'leadStop': if (garde() && confirm('Ne plus jamais contacter ce prospect ?')) action(t, async () => { await post({ op: 'lead', id: Number(d.id), statut: 'stop' }); await renderPage(false); }); break;
    }
  });
  $('#panelBody').addEventListener('click', (ev) => { const s = ev.target.closest('#bAuto'); if (s && !s.disabled) s.classList.toggle('on'); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { if (!$('#panel').hidden) { closePanel(); if (S.world) S.world.focus({ type: 'overview' }); } else if (S.view !== 'tour') setView('tour'); } });
}

init();
