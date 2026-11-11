// La garde : chaque appel à Claude, d'où qu'il vienne (un agent, un travail automatique, la tour, WhatsApp), passe par
// elle. Avant l'appel : les plafonds du jour et du mois, relus en base, ce que les appels en cours peuvent encore coûter,
// et le temps qui reste au passage. Après l'appel : son coût réel, écrit en base tout de suite.
//
// Pourquoi (9 nov. 2026) : la tour ne comptait un passage qu'à sa fin. Quand Vercel coupait la fonction au bout de
// 300 secondes, le passage en cours disparaissait sans laisser de trace : 92 $ réellement dépensés sur la clé, 45 $ vus
// par la tour, et un frein de budget (réglé à 10 $ par jour) qui ne s'est jamais déclenché.
// (10 nov. 2026, Louis : « pas 100 $ par semaine ») : deux plafonds, 1 $ par jour et 25 $ par mois par défaut. Chaque
// appel réserve d'avance ce qu'il peut coûter au plus : trois agents en parallèle ne passent plus ensemble au-dessus du
// plafond. Un appel coupé en route (réponse en flux interrompue, délai dépassé) est compté à son prix maximum : un appel
// payé et jamais vu par la tour, c'est ce qui a fait les 47 $ invisibles.
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const { MODELS, WEB_SEARCH_USD, BUDGET_DEFAUT } = require('./config');
const { jourGP } = require('./util');

const ALS = new AsyncLocalStorage();

// prix par million de jetons du modèle réellement appelé ; les modèles de repli ont leur propre prix
const PRIX_REPLI = {
  'claude-sonnet-4-5': { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  'claude-haiku-4-5': { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.10 }
};
// entree : les jetons lus par l'appel (Haiku 5.5 coûte cinq fois plus au-delà de 100 000 jetons lus)
function prixDe(model, entree) {
  const m = String(model || '');
  let p = null;
  const tiers = Object.keys(MODELS);
  for (const t of tiers) if (m === MODELS[t].id || m.indexOf(MODELS[t].id + '-') === 0) { p = MODELS[t]; break; }
  if (!p) for (const k of Object.keys(PRIX_REPLI)) if (m === k || m.indexOf(k + '-') === 0) { p = PRIX_REPLI[k]; break; }
  if (!p) p = /opus/.test(m) ? MODELS.genius : /haiku/.test(m) ? MODELS.fast : MODELS.smart;
  if (p.long && Number(entree) > p.long.seuil) return p.long;
  return p;
}
function recherches(u) { return (u && u.server_tool_use && u.server_tool_use.web_search_requests) || 0; }
function coutReponse(model, u) {
  u = u || {};
  const lus = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  const p = prixDe(model, lus);
  return ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out + (u.cache_creation_input_tokens || 0) * p.cacheWrite + (u.cache_read_input_tokens || 0) * p.cacheRead) / 1e6 + recherches(u) * WEB_SEARCH_USD;
}

// ce qu'un appel peut coûter au plus, avant de partir : les jetons de la demande (texte compté large, une image
// comptée 1 600 jetons, son plafond), toute la réponse permise au prix de sortie, et chaque recherche web permise
function estimer(body) {
  if (!body) return 0;
  let jetons = 0;
  const texte = function (s) { jetons += String(s == null ? '' : s).length / 3; };
  const bloc = function (b) {
    if (b == null) return;
    if (typeof b === 'string') return texte(b);
    if (b.type === 'text') return texte(b.text);
    if (b.type === 'image') { jetons += 1600; return; }
    if (b.type === 'document') { jetons += 4000; return; }
    if (b.type === 'tool_result') { if (Array.isArray(b.content)) b.content.forEach(bloc); else texte(b.content); return; }
    if (b.type === 'tool_use' || b.type === 'server_tool_use') return texte(JSON.stringify(b.input || {}));
    texte(JSON.stringify(b));
  };
  if (Array.isArray(body.system)) body.system.forEach(bloc); else texte(body.system);
  (body.messages || []).forEach(function (m) { if (m && Array.isArray(m.content)) m.content.forEach(bloc); else texte(m && m.content); });
  texte(JSON.stringify(body.tools || []));
  const p = prixDe(body.model, jetons);
  let usd = (jetons * p.in + (Number(body.max_tokens) || 4096) * p.out) / 1e6;
  (body.tools || []).forEach(function (t) {
    // une recherche web ramène des pages entières dans la conversation : 3 000 jetons de plus par recherche permise
    if (t && /^web_search/.test(String(t.type || ''))) { const n = Number(t.max_uses) || 5; usd += n * WEB_SEARCH_USD + n * 3000 * p.in / 1e6; }
  });
  return usd;
}

/* ── ce qui a été dépensé aujourd'hui et ce mois-ci, et les plafonds (relus en base, gardés quelques secondes) ── */
const etat = { jour: null, depense: 0, mois: 0, lu_le: 0, plafonds: null, plafonds_le: 0, reserve: 0 };
function base() {
  try { return require('./db').open(); } catch (e) { return null; }
}
function nombre(x, defaut) { return x !== undefined && x !== null && x !== '' && Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : defaut; }
async function lirePlafonds(db) {
  if (etat.plafonds && Date.now() - etat.plafonds_le < 60000) return etat.plafonds;
  let v = { jour: Number(BUDGET_DEFAUT.jour_usd), mois: Number(BUDGET_DEFAUT.mois_usd), depuis: null };
  try {
    const r = await db.one('hq_config', { eq: { key: 'budget' } });
    const b = (r && r.value) || {};
    // mois_depuis : le jour où la garde a pris la main (le mois de sa mise en route se compte à partir de ce jour-là)
    v = { jour: nombre(b.jour_usd, v.jour), mois: nombre(b.mois_usd, v.mois), depuis: /^\d{4}-\d{2}-\d{2}$/.test(String(b.mois_depuis || '')) ? b.mois_depuis : null };
  } catch (e) { /* base injoignable : les plafonds par défaut tiennent */ }
  etat.plafonds = v; etat.plafonds_le = Date.now();
  return v;
}
async function lirePlafond(db) { return (await lirePlafonds(db)).jour; }
function debutMois(j) { return String(j).slice(0, 8) + '01'; }
// le premier jour compté pour le plafond du mois : le 1er, ou le jour de mise en route de la garde s'il est plus tard dans
// le même mois (les 92 $ de début novembre, dépensés avant elle, ne mangent pas le plafond du mois de sa mise en route)
function debutCompte(j, depuis) { const m = debutMois(j); return depuis && depuis > m && depuis <= j ? depuis : m; }
async function lireDepenses(db, depuis) {
  const j = jourGP();
  if (etat.jour === j && Date.now() - etat.lu_le < 15000) return { jour: etat.depense, mois: etat.mois };
  try {
    const rows = await db.select('hq_daily', { select: 'day,cost_usd', gte: { day: debutCompte(j, depuis) } });
    let jour = 0, mois = 0;
    (rows || []).forEach(function (r) { const c = Number(r.cost_usd) || 0; mois += c; if (String(r.day).slice(0, 10) === j) jour = c; });
    etat.depense = jour; etat.mois = mois; etat.jour = j; etat.lu_le = Date.now();
  } catch (e) { if (etat.jour !== j) { etat.depense = 0; etat.jour = j; if (debutMois(j) === j) etat.mois = 0; } }
  return { jour: etat.depense, mois: etat.mois };
}
async function lireDepense(db) { return (await lireDepenses(db)).jour; }
// après un changement de plafond dans la tour, ou dans les essais
function oublier() { Object.assign(etat, { jour: null, depense: 0, mois: 0, lu_le: 0, plafonds: null, plafonds_le: 0, reserve: 0 }); }

function erreur(message, genre, extra) { const e = new Error(message); e[genre] = true; Object.assign(e, extra || {}); return e; }
const usd = function (x) { return Number(x || 0).toFixed(2).replace('.', ',') + ' $'; };

/* ── avant chaque appel : le temps, puis les plafonds, puis la réservation ── */
// renvoie un jeton { delai (ms, ou null sans échéance), est (ce que l'appel peut coûter au plus) } à rendre à apres(),
// perdu() ou liberer()
async function avant(body) {
  const st = ALS.getStore();
  let delai = null;
  if (st && st.echeance) {
    const reste = st.echeance - Date.now();
    if (reste < 20000) throw erreur('Temps du passage écoulé : l\'appel est remis au passage suivant.', 'temps');
    delai = reste - 5000;
  }
  const est = estimer(body);
  const db = base();
  if (db) {
    const p = await lirePlafonds(db);
    const d = await lireDepenses(db, p.depuis);
    const engage = etat.reserve;
    if (d.mois + engage >= p.mois) throw erreur('Plafond IA du mois atteint (' + usd(d.mois) + ' sur ' + usd(p.mois) + ') : reprise le 1er du mois.', 'budget', { mois: true });
    if (d.jour + engage >= p.jour) throw erreur('Plafond IA du jour atteint (' + usd(d.jour) + ' sur ' + usd(p.jour) + ') : reprise demain.', 'budget');
    // un appel qui, au pire, passerait au-dessus d'un plafond ne part pas
    if (d.mois + engage + est > p.mois) throw erreur('Plafond IA du mois presque atteint (' + usd(d.mois) + ' sur ' + usd(p.mois) + ') : cet appel pourrait le dépasser, reprise le 1er du mois.', 'budget', { mois: true });
    if (d.jour + engage + est > p.jour) throw erreur('Plafond IA du jour presque atteint (' + usd(d.jour) + ' sur ' + usd(p.jour) + ') : cet appel pourrait le dépasser, reprise demain.', 'budget');
  }
  etat.reserve += est;
  return { delai: delai, est: est, rendu: false };
}

function rendre(jeton) {
  if (!jeton || jeton.rendu) return;
  jeton.rendu = true;
  etat.reserve = Math.max(0, etat.reserve - (jeton.est || 0));
}
async function compter(c, s) {
  const st = ALS.getStore();
  if (st) { st.cout = (st.cout || 0) + c; st.recherches = (st.recherches || 0) + s; st.appels = (st.appels || 0) + 1; }
  const j = jourGP();
  if (etat.jour === j) { etat.depense += c; etat.mois += c; }
  const db = base();
  if (db && (c > 0 || s > 0)) await db.rpc('hq_bump', { p_day: j, p_cost: c, p_runs: 0, p_searches: s, p_places: 0, p_leads: 0, p_emails: 0, p_items: 0 }).catch(function () { /* compté au prochain relevé */ });
  return c;
}

/* ── après chaque appel réussi : le coût réel, écrit tout de suite ── */
async function apres(model, usage, jeton) {
  rendre(jeton);
  // une réponse sans relevé de consommation est comptée au prix maximum de l'appel, jamais à zéro
  const c = usage ? coutReponse(model, usage) : ((jeton && jeton.est) || 0);
  return compter(c, recherches(usage));
}
/* ── un appel parti mais coupé en route (flux interrompu, délai dépassé) : payé quand même, compté au prix maximum ── */
async function perdu(jeton) {
  rendre(jeton);
  return compter((jeton && jeton.est) || 0, 0);
}
/* ── un appel refusé par l'API (erreur avant tout travail) : rien n'est payé, la réservation est rendue ── */
function liberer(jeton) { rendre(jeton); }

/* ── le contexte d'un passage : son échéance, et ce qu'il a dépensé ── */
function contexte(extra) { return Object.assign({}, ALS.getStore() || {}, { cout: 0, recherches: 0, appels: 0 }, extra || {}); }
function executer(store, fn) { return ALS.run(store, fn); }

module.exports = { avant, apres, perdu, liberer, contexte, executer, coutReponse, estimer, prixDe, oublier, lirePlafond, lirePlafonds, lireDepense, lireDepenses, debutCompte, reserve: function () { return etat.reserve; } };
