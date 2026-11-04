// Ce qui se pose sur la ville : les étiquettes des bâtiments (avec leurs chiffres), les noms des agents d'une maison
// ouverte, la bulle au survol, le panneau d'un bâtiment, le fil des échanges, la mise en route, les boutons de vue.
import { $, esc, ico, eur, usd, nb, heure, depuis, pluriel, anneau, STATUT, KIND, PROPK, initiales } from './outils.js';
import { S, agentDe, coDe, nom, demo, surMonde, aller, couleur } from './etat.js';
import * as Fiches from './fiches.js';

let calque = null, etiquettes = null, panneau = null, ouvert = null, filOuvert = false, chaud = null;
const elEtq = new Map(), elNoms = new Map(), elSec = new Map();
// la couleur franche de chaque service du campus (son tapis au sol en est la version pâle)
const TON = { direction: '#D9A43A', production: '#8B6CF6', prospection: '#22A673', ecriture: '#4C74F5' };
const px = (v) => (Math.round(v * 10) / 10) + 'px';
const tailles = new Map();

export function monter(el) {
  calque = el;
  calque.innerHTML = '<div class="etiquettes" id="etiquettes"></div>' +
    '<div class="hud-g"><div id="rappel"></div><section class="fil verre" id="fil"><button class="fil-tete" data-fil>' + '<span class="point idle" id="filPoint"></span><b>Le fil</b><span id="filDernier">en attente des premiers échanges</span></button><div class="fil-liste" id="filListe"></div></section></div>' +
    '<div class="hud-d"><div class="vues verre"><button class="vue-btn" data-vue="plus" title="Rapprocher">' + ico('plus') + '</button><button class="vue-btn" data-vue="moins" title="Éloigner">' + ico('moins') + '</button><button class="vue-btn" data-vue="tourner" title="Tourner">' + ico('tourner') + '</button><button class="vue-btn" data-vue="ensemble" title="Vue d\'ensemble">' + ico('recentrer') + '</button></div></div>' +
    '<aside class="panneau verre ferme" id="panneau" aria-live="polite"><button class="fermer" data-fermer-panneau aria-label="Fermer">' + ico('fermer') + '</button><div class="panneau-corps" id="panneauCorps"></div></aside>' +
    '<div class="bulle" id="bulle" hidden></div>';
  etiquettes = $('#etiquettes', calque); panneau = $('#panneau', calque);
  calque.addEventListener('click', clic);
  surMonde(maj);
  maj([]);
}
export function afficher() { if (calque) calque.hidden = false; }
export function cacher() { if (calque) calque.hidden = true; bulleOff(); }

function clic(e) {
  const t = e.target.closest('[data-etq],[data-vue],[data-fil],[data-fermer-panneau],[data-agent],[data-msg],[data-aller],[data-prop],[data-ouvrir]');
  if (!t) return;
  const d = t.dataset;
  if (d.etq) { aller(d.etq === 'groupe' && decisions().length ? 'ville/board' : 'ville/' + d.etq); return; }
  if (d.vue) { if (!S.ville) return; if (d.vue === 'plus') S.ville.zoom(1.3); else if (d.vue === 'moins') S.ville.zoom(1 / 1.3); else if (d.vue === 'tourner') S.ville.tourner(30); else { aller('ville'); S.ville.viser(null); } return; }
  if (d.fil != null) { filOuvert = !filOuvert; $('#fil', calque).classList.toggle('ouvert', filOuvert); return; }
  if (d.fermerPanneau != null) { aller('ville'); return; }
  if (d.agent) { Fiches.agent(d.agent); if (S.ville) S.ville.viser({ type: 'agent', id: d.agent }); return; }
  if (d.msg) { const m = S.msgs.find((x) => String(x.id) === d.msg); if (m && agentDe(m.from_id)) { Fiches.agent(m.from_id); if (S.ville) S.ville.viser({ type: 'agent', id: m.from_id }); } return; }
  if (d.prop) { Fiches.proposition(Number(d.prop)); return; }
  if (d.ouvrir) { Fiches.entreprise(d.ouvrir); return; }
  if (d.aller) { aller(d.aller); }
}

/* ── ce que la scène signale ── */
export function choix(t) {
  if (!t) { if (ouvert) aller('ville'); return; }
  if (t.type === 'agent') { Fiches.agent(t.id); if (S.ville) S.ville.viser({ type: 'agent', id: t.id }); return; }
  if (t.type === 'roof') { aller('ville/board'); return; }
  aller('ville/' + t.id);
}
export function survol(t, pos) {
  const b = $('#bulle');
  if (!b) return;
  const c = t ? (t.type === 'roof' ? 'groupe' : t.type === 'company' || t.type === 'site' ? t.id : null) : null;
  if (c !== chaud) { if (chaud && elEtq.get(chaud)) elEtq.get(chaud).classList.remove('chaud'); chaud = c; if (c && elEtq.get(c)) elEtq.get(c).classList.add('chaud'); }
  if (!t || !S.m || !pos || pos.x == null) { bulleOff(); return; }
  let h = '';
  if (t.type === 'agent') { const a = agentDe(t.id); if (!a) return bulleOff(); h = '<b>' + esc(a.name) + '</b><small>' + esc(a.title) + ', ' + esc((coDe(a.company_id) || {}).name || '') + '</small><span class="pastille ' + (a.status === 'working' ? 'cobalt' : a.status === 'error' ? 'alerte' : a.kind === 'attente' ? '' : a.status === 'waiting' ? 'attention' : 'ok') + '">' + esc(a.kind === 'attente' ? STATUT.attente : STATUT[a.status] || a.status) + '</span>' + (a.kind === 'attente' && a.waiting_for ? '<p>' + esc(a.waiting_for.slice(0, 160)) + '</p>' : a.current_task ? '<p>' + esc(a.current_task.slice(0, 160)) + '</p>' : ''); }
  else if (t.type === 'roof') { const n = decisions().length; h = '<b>Le Board</b><small>Ta table, en haut de la tour</small><p>' + (n ? pluriel(n, 'décision') + ' t\'attend' + (n > 1 ? 'ent' : '') + '.' : 'Rien à décider pour l\'instant.') + '</p>'; }
  else { const c = coDe(t.id); if (!c) return bulleOff(); h = '<b>' + esc(c.name) + '</b><small>' + esc(c.status === 'proposee' ? 'Projet d\'entreprise, à valider' : c.tagline || '') + '</small><p>' + (c.status === 'proposee' ? 'Clique pour lire le dossier et décider.' : 'Clique pour entrer.') + '</p>'; }
  b.innerHTML = h; b.hidden = false;
  const w = 280, x = Math.min(innerWidth - w - 12, pos.x + 16), y = Math.min(innerHeight - 140, pos.y + 16);
  b.style.left = x + 'px'; b.style.top = y + 'px';
}
function bulleOff() { const b = $('#bulle'); if (b) b.hidden = true; }

/* ── les étiquettes : un nom, un chiffre qui compte, une ligne, qui travaille ── */
const decisions = () => ((S.m && S.m.proposals) || []).filter((p) => p.status === 'a_louis');
function contenuEtiquette(c) {
  const ag = S.m.agents.filter((a) => a.company_id === c.id);
  const travail = ag.filter((a) => a.status === 'working').length, attente = ag.filter((a) => a.kind === 'attente').length, actifs = ag.length - attente;
  const k = S.m.compteurs || {}, j = S.m.jour || {}, b = S.m.budget || {};
  const activite = '<span class="etq-a"><span class="point ' + (travail ? 'working' : 'idle') + '"></span>' + (travail ? pluriel(travail, 'agent') + ' au travail' : pluriel(actifs, 'agent') + (attente ? ', ' + attente + ' en attente d\'outil' : '')) + '</span>';
  if (c.status === 'proposee') {
    const p = (S.m.proposals || []).find((x) => x.kind === 'nouvelle_entreprise' && x.details && x.details.company_id === c.id);
    return { cls: 'chantier', html: '<span class="etq-n"><i></i>' + esc(c.name) + '</span><span class="etq-l">' + esc(p ? (p.status === 'a_louis' ? 'Projet à valider' : p.status === 'validee' ? 'Validé, en création' : 'Projet en discussion') : 'Projet') + '</span>' };
  }
  if (c.id === 'novalemo') {
    return { cls: 'large', html: '<span class="etq-n"><i></i>' + esc(c.name) + '</span><span class="etq-g" data-n="ca">' + eur(k.ca_eur) + '<small>encaissés</small></span><span class="etq-l">' + (k.mrr_eur ? eur(k.mrr_eur) + ' par mois, ' : '') + pluriel(k.en_ligne || 0, 'site') + ' en ligne, ' + pluriel(k.apercus || 0, 'aperçu') + '</span>' + activite };
  }
  if (c.id === 'groupe') {
    const n = decisions().length;
    return { cls: n ? 'board' : '', html: '<span class="etq-n"><i></i>' + esc(c.name) + '</span>' + (n ? '<span class="etq-g">' + pluriel(n, 'décision') + '<small>pour toi</small></span><span class="etq-l">IA aujourd\'hui : ' + usd(j.cost_usd) + ' sur ' + usd(b.jour_usd) + '</span>' : '<span class="etq-g">' + usd(j.cost_usd) + '<small>sur ' + usd(b.jour_usd) + '</small></span><span class="etq-l">Coût de l\'IA aujourd\'hui</span>') + activite };
  }
  return { html: '<span class="etq-n"><i></i>' + esc(c.name) + '</span><span class="etq-l">' + (travail ? pluriel(travail, 'agent') + ' au travail sur ' + actifs : pluriel(actifs, 'agent') + (attente ? ', ' + attente + ' attendent un outil' : '')) + '</span>' };
}
function majEtiquettes() {
  if (!S.m) return;
  const vus = new Set();
  S.m.companies.filter((c) => c.status === 'active' || c.status === 'proposee').forEach((c) => {
    vus.add(c.id);
    let el = elEtq.get(c.id);
    if (!el) { el = document.createElement('button'); el.className = 'etiquette'; el.dataset.etq = c.id; etiquettes.appendChild(el); elEtq.set(c.id, el); }
    const x = contenuEtiquette(c);
    el.style.setProperty('--c', c.color || '#7C9DFF');
    el.className = 'etiquette' + (x.cls ? ' ' + x.cls : '') + (ouvert === c.id || (ouvert === 'board' && c.id === 'groupe') ? ' sel' : '') + (el.__c ? ' compacte' : '');
    if (el.__h !== x.html) { el.innerHTML = x.html; el.__h = x.html; tailles.delete(c.id); tailles.delete(c.id + ':c'); }
  });
  elEtq.forEach((el, id) => { if (!vus.has(id)) { el.remove(); elEtq.delete(id); } });
  majSecteurs();
}
// les enseignes des services du campus : leur nom, et qui y travaille
function majSecteurs() {
  const secs = S.ville && S.ville.secteurs ? S.ville.secteurs() : [];
  const vus = new Set();
  secs.forEach((s) => {
    vus.add(s.id);
    let el = elSec.get(s.id);
    if (!el) { el = document.createElement('span'); el.className = 'etq-sec'; el.style.setProperty('--t', TON[s.id] || '#2B59E8'); etiquettes.appendChild(el); elSec.set(s.id, el); }
    const ag = s.agents.map((id) => S.m.agents.find((a) => a.id === id)).filter(Boolean);
    const travail = ag.filter((a) => a.status === 'working').length;
    const h = '<i></i>' + esc(s.nom) + '<small>' + (travail ? travail + ' au travail' : pluriel(ag.length, 'agent')) + '</small>';
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; el.__w = 0; }
  });
  elSec.forEach((el, id) => { if (!vus.has(id)) { el.remove(); elSec.delete(id); } });
}
// appelé par la scène après chaque image : chaque étiquette suit son bâtiment. Les plus importantes d'abord ; une
// étiquette qui en chevaucherait une autre se fait petite, et disparaît si ça ne suffit pas (jamais de pile illisible).
const PRIORITE = ['novalemo', 'groupe', 'studio3d', 'ecom', 'labo'];
function rang(id) { const i = PRIORITE.indexOf(id); return i < 0 ? 50 : i; }
function taille(el, id, compact) {
  const k = id + (compact ? ':c' : '');
  let t = tailles.get(k);
  if (!t) { const avant = el.classList.contains('compacte'); el.classList.toggle('compacte', compact); t = { w: el.offsetWidth, h: el.offsetHeight }; el.classList.toggle('compacte', avant); tailles.set(k, t); }
  return t;
}
const chevauche = (a, liste) => liste.some((b) => a.x < b.x + b.w + 6 && a.x + a.w + 6 > b.x && a.y < b.y + b.h + 6 && a.y + a.h + 6 > b.y);
export function apresImage() {
  if (!S.ville || !calque || calque.hidden) return;
  const zoom = S.ville.zoomActuel(), tel = innerWidth < 880;
  const plafond = (tel ? 62 : 76) + 8;
  const places = [];
  Array.from(elEtq.keys()).sort((a, b) => rang(a) - rang(b)).forEach((id) => {
    const el = elEtq.get(id), p = (tel && S.ville.ancre(id + ':haut')) || S.ville.ancre(id);
    const cacher = () => { if (el.style.opacity !== '0') { el.style.opacity = '0'; el.style.pointerEvents = 'none'; } };
    if (!p || !p.visible) return cacher();
    if (ouvert && (tel || id === ouvert || (ouvert === 'board' && id === 'groupe'))) return cacher();     // le panneau dit déjà tout
    let compact = (zoom < (tel ? 1.05 : 0.62) && id !== 'novalemo' && id !== 'groupe') || (!!ouvert && zoom > 1.6);
    let t = taille(el, id, compact);
    // une étiquette qui pend (sous le campus) repasse au-dessus si elle sortirait de l'écran ou toucherait les cartes du bas
    const pend = (r0) => p.dessous && !tel && r0.y + r0.h < innerHeight - 10;
    const cadre = (tt) => { const r0 = { x: p.x - tt.w / 2, y: p.y + 12, w: tt.w, h: tt.h }; return pend(r0) ? r0 : { x: p.x - tt.w / 2, y: p.y - tt.h - 10, w: tt.w, h: tt.h }; };
    let r = cadre(t);
    if (chevauche(r, places) && !compact) { compact = true; t = taille(el, id, true); r = cadre(t); }
    if (chevauche(r, places) || r.y < plafond) return cacher();
    places.push(r);
    const dessous = r.y > p.y;
    if (el.__d !== dessous) { el.classList.toggle('dessous', dessous); el.__d = dessous; }
    if (el.__c !== compact) { el.classList.toggle('compacte', compact); el.__c = compact; }
    el.style.opacity = '1'; el.style.pointerEvents = '';
    el.style.transform = 'translate3d(' + px(r.x) + ',' + px(r.y) + ',0)';
  });
  // les enseignes des services, quand on est assez près du campus (ou qu'il est ouvert)
  const voirSec = ouvert === 'novalemo' || (!ouvert && zoom >= (tel ? 1.25 : 1.3));
  elSec.forEach((el, id) => {
    const p = S.ville.ancre('sec:' + id);
    if (!voirSec || !p || !p.visible || p.y < plafond) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
    if (!el.__w) { el.__w = el.offsetWidth; el.__hh = el.offsetHeight; }
    const r = { x: p.x - el.__w / 2, y: p.y - el.__hh / 2, w: el.__w, h: el.__hh };
    if (chevauche(r, places)) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
    places.push(r);
    el.style.opacity = '1';
    el.style.transform = 'translate3d(' + px(r.x) + ',' + px(r.y) + ',0)';
  });
  elNoms.forEach((el, id) => {
    const p = S.ville.ecranAgent(id);
    if (!p || !p.visible || p.y < plafond) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
    if (!el.__w) el.__w = el.offsetWidth;
    el.style.opacity = '1';
    el.style.transform = 'translate3d(' + px(p.x - el.__w / 2) + ',' + px(p.y - 30) + ',0)';
  });
}
function nomsAgents(cid) {
  elNoms.forEach((el) => el.remove()); elNoms.clear();
  if (!cid || !S.ville || cid === 'board') return;
  // les noms des chefs et de ceux qui travaillent : les autres au survol (sinon la pièce devient illisible)
  S.m.agents.filter((a) => a.company_id === cid && a.kind !== 'attente' && (a.status === 'working' || a.status === 'error' || ['dg', 'directeur', 'manager', 'pdg'].indexOf(a.tier) >= 0)).forEach((a) => {
    const el = document.createElement('button'); el.className = 'nom-agent'; el.dataset.agent = a.id;
    el.innerHTML = '<span class="point ' + esc(a.kind === 'attente' ? 'attente' : a.status) + '"></span>' + esc(a.name);
    etiquettes.appendChild(el); elNoms.set(a.id, el);
  });
}

/* ── le panneau d'un bâtiment ── */
export function ouvrir(id) {
  if (!S.m) return;
  ouvert = id;
  if (S.ville) S.ville.viser(id === 'board' ? { type: 'roof' } : { type: (coDe(id) || {}).status === 'proposee' ? 'site' : 'company', id: id });
  remplirPanneau();
  panneau.classList.remove('ferme');
  document.body.classList.add('panneau-ouvert');
  nomsAgents(id);
  majEtiquettes();
}
export function fermerPanneau(silence) {
  if (!panneau) return;
  const etait = ouvert;
  ouvert = null;
  panneau.classList.add('ferme');
  document.body.classList.remove('panneau-ouvert');
  nomsAgents(null);
  majEtiquettes();
  if (etait && S.ville && !silence) S.ville.viser(null);
  if (etait && S.ville && silence) S.ville.viser(null);
}
function kpi(label, valeur, sous) { return '<div><small>' + esc(label) + '</small><b>' + valeur + '</b>' + (sous ? '<small>' + esc(sous) + '</small>' : '') + '</div>'; }
function ligneAgent(a) {
  return '<button class="ligne" data-agent="' + esc(a.id) + '"><span class="avatar petit" style="--c:' + esc(couleur(a.company_id)) + '">' + esc(initiales(a.name)) + '</span><span class="l-c"><b>' + esc(a.name) + '</b><span>' + esc(a.kind === 'attente' ? 'Attend : ' + (a.waiting_for || 'un outil') : a.status === 'working' ? (a.current_task || 'Au travail') : a.title) + '</span></span><span class="point ' + esc(a.kind === 'attente' ? 'attente' : a.status) + '"></span></button>';
}
function remplirPanneau() {
  const corps = $('#panneauCorps', calque);
  if (!ouvert) return;
  let h = '';
  if (ouvert === 'board') {
    const ds = decisions(), enCours = (S.m.proposals || []).filter((p) => p.status === 'ouverte');
    h += '<div class="f-tete"><span class="avatar" style="--c:#E5B653">LR</span><div><h2>Le Board</h2><p>Ce qui attend ta décision</p></div></div>';
    h += ds.length ? '<div class="lignes">' + ds.map((p) => '<button class="ligne" data-prop="' + p.id + '"><span class="l-c"><b>' + esc(p.title) + '</b><span>' + esc((PROPK[p.kind] || p.kind) + ', proposé par ' + nom(p.from_id)) + '</span></span>' + ico('fleche') + '</button>').join('') + '</div>' : '<div class="vide"><b>Rien à décider</b>Les équipes te remontent ici ce qui coûte de l\'argent, crée un compte ou lance une entreprise.</div>';
    if (enCours.length) h += '<div class="f-sec"><h3>En discussion dans les équipes <small>' + enCours.length + '</small></h3><div class="lignes">' + enCours.slice(0, 6).map((p) => '<button class="ligne" data-prop="' + p.id + '"><span class="l-c"><b>' + esc(p.title) + '</b><span>' + esc(nom(p.from_id)) + '</span></span></button>').join('') + '</div></div>';
    h += '<div class="f-sec ligne-actions"><button class="btn btn-second" data-aller="gestion/decisions">Toutes les décisions</button></div>';
    corps.innerHTML = h; return;
  }
  const c = coDe(ouvert);
  if (!c) { corps.innerHTML = ''; return; }
  const ag = S.m.agents.filter((a) => a.company_id === c.id);
  h += '<div class="f-tete"><span class="avatar" style="--c:' + esc(c.color) + '">' + esc(initiales(c.name)) + '</span><div><h2>' + esc(c.name) + '</h2><p>' + esc(c.tagline || '') + '</p></div></div>';
  if (c.status === 'proposee') {
    const p = (S.m.proposals || []).find((x) => x.kind === 'nouvelle_entreprise' && x.details && x.details.company_id === c.id);
    h += '<p class="texte">' + esc(c.mission || '') + '</p>';
    h += p ? '<div class="f-sec ligne-actions"><button class="btn btn-primaire" data-prop="' + p.id + '">Lire le dossier et décider</button></div>' : '<div class="f-sec"><div class="vide">Le dossier n\'est pas encore prêt.</div></div>';
    corps.innerHTML = h; return;
  }
  const k = S.m.compteurs || {};
  if (c.id === 'novalemo') {
    h += '<div class="mini-kpi">' + kpi('Encaissé', eur(k.ca_eur)) + kpi('Par mois', eur(k.mrr_eur || 0)) + kpi('En ligne', nb(k.en_ligne)) + kpi('Aperçus', nb(k.apercus)) + kpi('Réponses', nb(k.reponses)) + kpi('Prospects', nb(k.prospects)) + '</div>';
    h += '<div class="f-sec ligne-actions"><button class="btn btn-primaire" data-aller="gestion/ventes">' + ico('gestion') + 'Ventes et sites</button><button class="btn btn-second" data-aller="gestion/reponses">Réponses</button><button class="btn btn-second" data-aller="gestion/prospects">Prospects</button></div>';
  } else if (c.id === 'groupe') {
    const j = S.m.jour || {}, b = S.m.budget || {};
    h += '<div class="mini-kpi">' + kpi('IA aujourd\'hui', usd(j.cost_usd)) + kpi('Plafond', usd(b.jour_usd)) + kpi('Passages', nb(j.runs)) + '</div>';
    h += '<div class="f-sec ligne-actions"><button class="btn btn-primaire" data-aller="gestion/couts">' + ico('couts') + 'Coûts et budget</button><button class="btn btn-second" data-aller="ville/board">Le Board</button></div>';
  } else {
    const travail = ag.filter((a) => a.status === 'working').length, attente = ag.filter((a) => a.kind === 'attente').length;
    h += '<div class="mini-kpi">' + kpi('Agents', nb(ag.length - attente)) + kpi('Au travail', nb(travail)) + kpi('Attendent un outil', nb(attente)) + '</div>';
    h += '<div class="f-sec ligne-actions"><button class="btn btn-primaire" data-ouvrir="' + esc(c.id) + '">Livrables et chiffres</button><button class="btn btn-second" data-aller="gestion/equipe?co=' + esc(c.id) + '">L\'équipe</button></div>';
  }
  const auTravail = ag.filter((a) => a.status === 'working');
  if (auTravail.length) h += '<div class="f-sec"><h3>En ce moment <small>' + auTravail.length + '</small></h3><div class="lignes">' + auTravail.map(ligneAgent).join('') + '</div></div>';
  h += '<div class="f-sec"><h3>L\'équipe <small>' + ag.length + '</small></h3><div class="lignes">' + ag.filter((a) => a.status !== 'working').map(ligneAgent).join('') + '</div></div>';
  corps.innerHTML = h;
}

/* ── le fil des échanges ── */
function ligneMsg(m, frais) {
  return '<button class="msg' + (frais ? ' frais' : '') + '" data-msg="' + m.id + '"><time>' + heure(m.created_at) + '</time><span><span class="qui">' + esc(nom(m.from_id)) + (m.to_id ? ' à ' + esc(nom(m.to_id)) : '') + '</span><span class="quoi">' + esc((KIND[m.kind] ? KIND[m.kind] + ' : ' : '') + (m.subject || m.body || '')) + '</span></span></button>';
}
function majFil(frais) {
  const d = S.msgs[0];
  $('#filDernier', calque).textContent = d ? heure(d.created_at) + ', ' + nom(d.from_id) + ' : ' + (d.subject || d.body || '') : 'en attente des premiers échanges';
  $('#filPoint', calque).className = 'point ' + (d && Date.now() - new Date(d.created_at).getTime() < 600000 ? 'working' : 'idle');
  $('#filListe', calque).innerHTML = S.msgs.slice(0, 60).map((m) => ligneMsg(m, frais.indexOf(m.id) >= 0)).join('') || '<div class="vide" style="margin:6px">Aucun échange pour l\'instant.</div>';
}

/* ── la mise en route, rappelée tant qu'il reste des étapes ── */
function majRappel() {
  const r = $('#rappel', calque);
  const mis = S.mis;
  if (!mis || !mis.a_faire) { r.innerHTML = ''; return; }
  const b = (mis.missions || []).find((m) => m.id === 'brancher') || { faites: 0, total: 1 };
  r.innerHTML = '<div class="rappel verre">' + anneau(b.faites, b.total) + '<div><b>Mise en route</b><span>' + (demo() ? 'La tour attend ses clés : ' : 'Encore ') + pluriel(mis.a_faire, 'étape') + ', quelques minutes.</span></div><button class="btn btn-primaire btn-petit" data-aller="gestion/route">Continuer</button></div>';
}

function maj(frais) {
  if (!S.m || !calque) return;
  majEtiquettes();
  majFil(frais || []);
  majRappel();
  if (ouvert && !panneau.classList.contains('ferme')) {
    const sc = $('#panneauCorps', calque).scrollTop;
    remplirPanneau(); $('#panneauCorps', calque).scrollTop = sc;
    elNoms.forEach((el, id) => { const a = agentDe(id); if (a) el.querySelector('.point').className = 'point ' + (a.kind === 'attente' ? 'attente' : a.status); });
  }
}
