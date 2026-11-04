// Les fiches qui s'ouvrent sur le côté (en bas sur téléphone) : un agent, une entreprise, une proposition à trancher.
import { $, esc, ico, usd, date, depuis, initiales, STATUT, KIND, PROPK, ITEMK, toast, occupe, pluriel } from './outils.js';
import { lireApi, envoyer } from './api.js';
import { S, agentDe, coDe, nom, demo, couleur, action, rafraichir, lancerCycle, surMonde } from './etat.js';

let voile = null, tiroir = null, corps = null, courant = null;

export function monter() {
  voile = document.createElement('div'); voile.className = 'voile'; voile.hidden = true;
  tiroir = document.createElement('aside'); tiroir.className = 'tiroir'; tiroir.setAttribute('role', 'dialog'); tiroir.setAttribute('aria-modal', 'true'); tiroir.hidden = true;
  tiroir.innerHTML = '<button class="fermer" data-fermer aria-label="Fermer">' + ico('fermer') + '</button><div class="tiroir-corps"></div>';
  document.body.append(voile, tiroir);
  corps = tiroir.querySelector('.tiroir-corps');
  voile.addEventListener('click', fermer);
  tiroir.addEventListener('click', clic);
  surMonde(() => { if (courant && courant.type === 'agent') majTete(); });
}
export const ouvert = () => !!courant;
function montrer(html, c) {
  courant = c; corps.innerHTML = html; corps.scrollTop = 0;
  voile.hidden = false; tiroir.hidden = false;
  requestAnimationFrame(() => { voile.classList.add('visible'); tiroir.classList.add('visible'); });
}
export function fermer() {
  if (!courant) return;
  courant = null;
  if (S.ville && S.ville.suivre) S.ville.suivre(null);
  voile.classList.remove('visible'); tiroir.classList.remove('visible');
  setTimeout(() => { if (!courant) { voile.hidden = true; tiroir.hidden = true; } }, 420);
}
function clic(e) {
  const t = e.target.closest('[data-fermer],[data-agent],[data-co],[data-act]');
  if (!t) return;
  if (t.dataset.fermer != null) return fermer();
  if (t.dataset.agent) return agent(t.dataset.agent);
  if (t.dataset.co) return entreprise(t.dataset.co);
}

/* ── un agent ── */
function tete(a) {
  const c = coDe(a.company_id) || {}, chef = a.parent_id ? agentDe(a.parent_id) : null;
  return '<div class="f-tete"><span class="avatar grand" style="--c:' + esc(c.color || '#7C9DFF') + '">' + esc(initiales(a.name)) + '</span><div><h2>' + esc(a.name) + '</h2><p>' + esc(a.title) + ', <a href="#" data-co="' + esc(a.company_id) + '">' + esc(c.name || a.company_id) + '</a></p></div></div>' +
    '<div class="ligne-actions" id="fStatut"><span class="pastille ' + ton(a) + '">' + esc(a.kind === 'attente' ? STATUT.attente : STATUT[a.status] || a.status) + '</span><span style="font-size:12.5px;color:var(--doux)">' + (chef ? 'Son chef : <a href="#" data-agent="' + esc(chef.id) + '">' + esc(chef.name) + '</a>' : 'Rend des comptes à Louis') + '</span></div>';
}
const ton = (a) => a.kind === 'attente' ? '' : a.status === 'working' ? 'cobalt' : a.status === 'error' ? 'alerte' : a.status === 'waiting' ? 'attention' : a.status === 'paused' ? '' : 'ok';
function maintenant(a) {
  if (a.kind === 'attente') return '<div class="attend"><b>Il attend</b><br>' + esc(a.waiting_for || 'un outil') + '</div>';
  return '<div class="maintenant"><small>' + (a.status === 'working' ? 'En ce moment' : 'Dernier passage, ' + depuis(a.last_run_at)) + '</small>' + esc(a.status === 'working' ? (a.current_task || 'Au travail') : (a.current_task || 'Pas encore passé.')) +
    (a.next_run_at && a.status !== 'paused' ? '<small style="margin:6px 0 0">Prochain passage ' + (new Date(a.next_run_at) < Date.now() ? 'au prochain cycle' : depuis(a.next_run_at)) + ', toutes les ' + (a.cadence_min >= 60 ? Math.round(a.cadence_min / 60 * 10) / 10 + ' h' : a.cadence_min + ' min') + '</small>' : '') + '</div>';
}
function majTete() {
  const a = agentDe(courant.id); if (!a) return;
  const s = $('#fMaintenant', corps); if (s) s.innerHTML = maintenant(a);
  const p = $('#fStatut .pastille', corps); if (p) { p.className = 'pastille ' + ton(a); p.textContent = a.kind === 'attente' ? STATUT.attente : STATUT[a.status] || a.status; }
}
export async function agent(id) {
  const a = agentDe(id); if (!a) return;
  montrer(tete(a) + '<div class="f-sec" id="fMaintenant">' + maintenant(a) + '</div><p style="color:var(--doux)">Chargement de la fiche…</p>', { type: 'agent', id: id });
  let f;
  try { f = await lireApi('agent', { id: id }); } catch (e) { toast(e.message, 'err'); return; }
  if (!courant || courant.id !== id) return;
  const ag = Object.assign({}, a, f.agent || {}), st = ag.stats || {};
  const equipe = S.m.agents.filter((x) => x.parent_id === id);
  let h = tete(ag) + '<div class="f-sec" id="fMaintenant">' + maintenant(ag) + '</div>';
  if (ag.kind !== 'attente') h += '<div class="f-sec ligne-actions"><button class="btn btn-primaire btn-petit" data-act="lancer" data-id="' + esc(id) + '">' + ico('lecture') + 'Lancer maintenant</button>' + (ag.status === 'paused' ? '<button class="btn btn-ok btn-petit" data-act="reprendre" data-id="' + esc(id) + '">Reprendre</button>' : '<button class="btn btn-second btn-petit" data-act="pause" data-id="' + esc(id) + '">' + ico('pause') + 'Pause</button>') + '</div>';
  h += '<div class="f-sec"><h3>Lui donner une consigne</h3><textarea class="saisie" id="consigne" rows="3" placeholder="Par exemple : cette semaine, concentre-toi sur les climatiseurs du Lamentin."></textarea><div class="ligne-actions" style="justify-content:space-between;margin-top:8px"><label class="case"><input type="checkbox" id="consigneNow" checked> le lancer tout de suite</label><button class="btn btn-primaire btn-petit" data-act="consigne" data-id="' + esc(id) + '">Envoyer</button></div></div>';
  if (st.runs) h += '<div class="f-sec"><div class="mini-kpi"><div><small>Passages</small><b>' + st.runs + '</b></div><div><small>Coût total</small><b>' + usd(st.cout) + '</b></div><div><small>Produits</small><b>' + (st.produit || 0) + '</b></div></div></div>';
  h += '<div class="f-sec"><h3>Sa mission</h3><div class="texte">' + esc(ag.mission || '') + '</div></div>';
  h += '<div class="f-sec"><h3>Sa stratégie <small>il la réécrit lui-même</small></h3><div class="texte">' + esc(ag.playbook || 'Pas encore écrite.') + '</div></div>';
  if (equipe.length) h += '<div class="f-sec"><h3>Son équipe <small>' + equipe.length + '</small></h3><div class="lignes">' + equipe.map((x) => '<button class="ligne" data-agent="' + esc(x.id) + '"><span class="avatar petit" style="--c:' + esc(couleur(x.company_id)) + '">' + esc(initiales(x.name)) + '</span><span class="l-c"><b>' + esc(x.name) + '</b><span>' + esc(x.title) + '</span></span><span class="point ' + esc(x.kind === 'attente' ? 'attente' : x.status) + '"></span></button>').join('') + '</div></div>';
  if ((f.taches || []).length) h += '<div class="f-sec"><h3>Ses tâches</h3>' + f.taches.map((t) => '<div class="evt"><div class="meta"><span>' + (t.status === 'fait' ? 'Fait' : 'À faire') + ', de ' + esc(nom(t.from_id)) + '</span><span>' + date(t.created_at) + '</span></div><b>' + esc(t.title) + '</b>' + (t.result ? '<div class="texte">' + esc(t.result) + '</div>' : '') + '</div>').join('') + '</div>';
  if ((f.savoir || []).length) h += '<div class="f-sec"><h3>Ce qu\'il a appris <small>' + f.savoir.length + '</small></h3>' + f.savoir.map((k) => '<div class="evt"><div class="meta"><span>' + esc(k.source === 'appris' ? 'appris seul' : k.source || '') + '</span><span>' + (k.created_at ? date(k.created_at) : '') + '</span></div>' + esc(k.content) + '</div>').join('') + '</div>';
  if ((f.evaluations || []).length) h += '<div class="f-sec"><h3>Évaluations</h3>' + f.evaluations.map((e) => '<div class="evt"><div class="meta"><span>' + esc(nom(e.agent_id)) + '</span><span>' + date(e.created_at) + '</span></div><b>' + esc(e.title) + '</b><div class="texte">' + esc(e.body) + '</div></div>').join('') + '</div>';
  if ((f.messages || []).length) h += '<div class="f-sec"><h3>Ses échanges</h3>' + f.messages.map((m) => '<div class="evt"><div class="meta"><span>' + esc((KIND[m.kind] || m.kind) + ', ' + nom(m.from_id) + ' à ' + (m.to_id ? nom(m.to_id) : 'tous')) + '</span><span>' + date(m.created_at) + '</span></div><b>' + esc(m.subject || '') + '</b>' + (m.body ? '<div class="texte">' + esc(m.body) + '</div>' : '') + '</div>').join('') + '</div>';
  if ((f.runs || []).length) h += '<div class="f-sec"><h3>Ses passages <small>coût réel</small></h3>' + f.runs.map((r) => '<div class="evt"><div class="meta"><span>' + date(r.started_at) + (r.model ? ', ' + esc(r.model) : '') + (r.searches ? ', ' + pluriel(r.searches, 'recherche') : '') + '</span><span class="num">' + usd(r.cost_usd) + '</span></div>' + (r.ok ? '' : '<b style="color:var(--alerte)">Échec. </b>') + esc(r.summary || '') + (r.log ? '<details class="repli"><summary>Détail</summary><pre>' + esc(JSON.stringify(r.log, null, 1).slice(0, 4000)) + '</pre></details>' : '') + '</div>').join('') + '</div>';
  h += '<div class="f-sec"><details class="repli"><summary>Sa fiche de poste complète</summary><div class="texte" style="margin-top:8px">' + esc(ag.charter || '') + '</div></details></div>';
  montrer(h, { type: 'agent', id: id });
}

/* ── une entreprise ── */
export async function entreprise(id) {
  const c = coDe(id); if (!c) return;
  if (c.status === 'proposee') { const p = (S.m.proposals || []).find((x) => x.kind === 'nouvelle_entreprise' && x.details && x.details.company_id === id); if (p) return proposition(p.id); }
  const t = '<div class="f-tete"><span class="avatar grand" style="--c:' + esc(c.color) + '">' + esc(initiales(c.name)) + '</span><div><h2>' + esc(c.name) + '</h2><p>' + esc(c.tagline || '') + '</p></div></div>';
  montrer(t + '<p style="color:var(--doux)">Chargement…</p>', { type: 'company', id: id });
  let f = {};
  try { f = await lireApi('company', { id: id }); } catch (e) { /* démo : ce qu'on a */ }
  if (!courant || courant.id !== id) return;
  const ag = S.m.agents.filter((a) => a.company_id === id), st = f.stats;
  let h = t + '<div class="texte">' + esc(c.mission || '') + '</div>';
  if (st) h += '<div class="f-sec"><div class="mini-kpi"><div><small>Agents actifs</small><b>' + ag.filter((a) => a.kind !== 'attente').length + '</b></div><div><small>Coût 7 jours</small><b>' + usd(st.cout_7j_usd) + '</b></div><div><small>Livrables 7 jours</small><b>' + st.equipe.reduce((s, x) => s + x.livrables_7j, 0) + '</b></div></div></div>';
  const att = ag.filter((a) => a.kind === 'attente');
  if (att.length) h += '<div class="f-sec"><h3>Ce qui attend un outil <small>' + att.length + '</small></h3>' + att.map((a) => '<div class="attend" style="margin-bottom:6px"><b>' + esc(a.name) + ', ' + esc(a.title) + '</b><br>' + esc(a.waiting_for || '') + '</div>').join('') + '</div>';
  h += '<div class="f-sec"><h3>L\'équipe <small>' + ag.length + '</small></h3><div class="lignes">' + ag.filter((a) => a.kind !== 'attente').map((a) => '<button class="ligne" data-agent="' + esc(a.id) + '"><span class="avatar petit" style="--c:' + esc(c.color) + '">' + esc(initiales(a.name)) + '</span><span class="l-c"><b>' + esc(a.name) + '</b><span>' + esc(a.current_task || a.title) + '</span></span><span class="point ' + esc(a.status) + '"></span></button>').join('') + '</div></div>';
  if ((f.livrables || []).length) h += '<div class="f-sec"><h3>Derniers livrables</h3>' + f.livrables.slice(0, 12).map((i) => '<div class="evt"><div class="meta"><span>' + esc((ITEMK[i.kind] || i.kind) + ', ' + nom(i.agent_id) + (i.score != null ? ', ' + i.score + '/100' : '')) + '</span><span>' + date(i.created_at) + '</span></div><b>' + esc(i.title) + '</b>' + (i.body ? '<details class="repli"><summary>Lire</summary><div class="texte">' + esc(i.body) + '</div></details>' : '') + '</div>').join('') + '</div>';
  montrer(h, { type: 'company', id: id });
}

/* ── une proposition à trancher ── */
export function proposition(id) {
  const p = (S.m.proposals || []).find((x) => x.id === id); if (!p) return;
  const cid = p.details && p.details.company_id, c = cid ? coDe(cid) : coDe(p.company_id);
  let h = '<div class="f-tete"><span class="avatar grand" style="--c:' + esc((c || {}).color || '#E5B653') + '">' + esc(initiales(p.title.replace(/^Créer\s+/i, ''))) + '</span><div><h2>' + esc(p.title) + '</h2><p>' + esc((PROPK[p.kind] || p.kind) + ', proposé par ' + nom(p.from_id)) + '</p></div></div>';
  h += '<div class="ligne-actions"><span class="pastille ' + (p.status === 'a_louis' ? 'attention' : p.status === 'validee' ? 'ok' : '') + '">' + esc({ ouverte: 'En discussion', a_louis: 'Attend ta décision', validee: 'Validé', refusee: 'Refusé', executee: 'Exécuté' }[p.status] || p.status) + '</span>' + (p.cost_month_usd != null ? '<span style="font-size:12.5px;color:var(--doux)">Coût estimé : ' + usd(p.cost_month_usd) + ' par mois</span>' : '') + '</div>';
  h += '<div class="f-sec"><h3>Le dossier</h3><div class="texte">' + esc(p.justification || '') + '</div></div>';
  if (p.details && p.details.etapes) h += '<div class="f-sec"><h3>Le démarrage</h3><ol style="margin:0;padding-left:20px;color:var(--encre-2)">' + p.details.etapes.map((e) => '<li style="margin-bottom:5px">' + esc(e) + '</li>').join('') + '</ol></div>';
  if ((p.avis || []).length) h += '<div class="f-sec"><h3>L\'avis de la hiérarchie</h3>' + p.avis.map((a) => '<div class="evt"><div class="meta"><span><b>' + esc(a.nom) + '</b>, ' + esc(a.role || '') + '</span><span>' + esc(a.avis) + '</span></div>' + esc(a.texte) + '</div>').join('') + '</div>';
  if (p.decision_note) h += '<div class="f-sec"><h3>Ta note</h3><div class="texte">' + esc(p.decision_note) + '</div></div>';
  if (p.status === 'a_louis' || p.status === 'ouverte') h += '<div class="f-sec"><h3>Ta décision</h3><textarea class="saisie" id="noteDecision" rows="3" placeholder="Une précision pour l\'équipe, si besoin (budget, prix, conditions)."></textarea><div class="ligne-actions" style="margin-top:10px"><button class="btn btn-ok" data-act="decider" data-id="' + p.id + '" data-d="valider">' + ico('coche') + 'Valider</button><button class="btn btn-danger" data-act="decider" data-id="' + p.id + '" data-d="refuser">Refuser</button></div></div>';
  montrer(h, { type: 'proposal', id: id });
}

/* ── les actions des fiches ── */
const garde = () => { if (demo()) { toast('La base n\'est pas encore branchée : fais d\'abord la mise en route.', 'err'); return false; } return true; };
action('lancer', (b, d) => { lancerCycle(b, d.id).then(() => { if (courant && courant.id === d.id) setTimeout(() => agent(d.id), 600); }); });
action('pause', (b, d) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'pause', agent: d.id }); toast('En pause.', 'ok'); await rafraichir(); agent(d.id); }); });
action('reprendre', (b, d) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'reprendre', agent: d.id }); toast('Repris.', 'ok'); await rafraichir(); agent(d.id); }); });
action('consigne', (b, d) => {
  if (!garde()) return;
  occupe(b, async () => {
    const txt = $('#consigne', corps).value.trim(); if (!txt) throw new Error('Écris la consigne d\'abord.');
    const now = $('#consigneNow', corps).checked;
    await envoyer({ op: 'consigne', agent: d.id, texte: txt, maintenant: now });
    $('#consigne', corps).value = ''; toast('Consigne transmise à ' + nom(d.id) + '.', 'ok');
    if (now) { const l = $('[data-act="lancer"][data-id="' + d.id + '"]', corps); if (l) lancerCycle(l, d.id); }
  });
});
action('decider', (b, d) => {
  if (!garde()) return;
  occupe(b, async () => {
    await envoyer({ op: 'decider', id: Number(d.id), decision: d.d, note: ($('#noteDecision', corps) || {}).value || '' });
    toast(d.d === 'valider' ? 'Validé : l\'équipe s\'y met au prochain passage.' : 'Refusé.', 'ok');
    await rafraichir(); proposition(Number(d.id));
  });
});
