// La garde : chaque appel à Claude, d'où qu'il vienne (un agent, un travail automatique, la tour, WhatsApp), passe par
// elle. Avant l'appel : le plafond du jour, relu en base, et le temps qui reste au passage. Après l'appel : son coût réel,
// écrit en base tout de suite.
//
// Pourquoi (9 nov. 2026) : la tour ne comptait un passage qu'à sa fin. Quand Vercel coupait la fonction au bout de
// 300 secondes, le passage en cours disparaissait sans laisser de trace : 88 $ réellement dépensés sur la clé, 45 $ vus
// par la tour, et un frein de budget qui ne s'est jamais déclenché. Maintenant chaque dollar est écrit au moment où il est
// dépensé, aucun appel ne démarre au-delà du plafond, et aucun appel ne démarre s'il ne peut pas finir avant la coupure.
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
function prixDe(model) {
  const m = String(model || '');
  const tiers = Object.keys(MODELS);
  for (const t of tiers) if (m === MODELS[t].id || m.indexOf(MODELS[t].id + '-') === 0) return MODELS[t];
  for (const k of Object.keys(PRIX_REPLI)) if (m === k || m.indexOf(k + '-') === 0) return PRIX_REPLI[k];
  if (/opus/.test(m)) return MODELS.genius;
  if (/haiku/.test(m)) return MODELS.fast;
  return MODELS.smart;
}
function recherches(u) { return (u && u.server_tool_use && u.server_tool_use.web_search_requests) || 0; }
function coutReponse(model, u) {
  u = u || {};
  const p = prixDe(model);
  return ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out + (u.cache_creation_input_tokens || 0) * p.cacheWrite + (u.cache_read_input_tokens || 0) * p.cacheRead) / 1e6 + recherches(u) * WEB_SEARCH_USD;
}

/* ── ce qui a été dépensé aujourd'hui, et le plafond (relus en base, gardés quelques secondes) ── */
const etat = { jour: null, depense: 0, lu_le: 0, plafond: null, plafond_le: 0 };
function base() {
  try { return require('./db').open(); } catch (e) { return null; }
}
async function lirePlafond(db) {
  if (etat.plafond != null && Date.now() - etat.plafond_le < 60000) return etat.plafond;
  let v = Number(BUDGET_DEFAUT.jour_usd);
  try {
    const r = await db.one('hq_config', { eq: { key: 'budget' } });
    const x = r && r.value && r.value.jour_usd;
    if (x !== undefined && x !== null && x !== '' && Number(x) >= 0) v = Number(x);
  } catch (e) { /* base injoignable : le plafond par défaut tient */ }
  etat.plafond = v; etat.plafond_le = Date.now();
  return v;
}
async function lireDepense(db) {
  const j = jourGP();
  if (etat.jour === j && Date.now() - etat.lu_le < 15000) return etat.depense;
  try {
    const r = await db.one('hq_daily', { eq: { day: j } });
    etat.depense = Number((r && r.cost_usd) || 0); etat.jour = j; etat.lu_le = Date.now();
  } catch (e) { if (etat.jour !== j) { etat.depense = 0; etat.jour = j; } }
  return etat.depense;
}
// après un changement de plafond dans la tour, ou dans les essais
function oublier() { etat.jour = null; etat.depense = 0; etat.lu_le = 0; etat.plafond = null; etat.plafond_le = 0; }

function erreur(message, genre) { const e = new Error(message); e[genre] = true; return e; }

/* ── avant chaque appel : le plafond, puis le temps ── */
// renvoie le délai maximum de la requête (ms), ou null s'il n'y a pas d'échéance
async function avant() {
  const st = ALS.getStore();
  let delai = null;
  if (st && st.echeance) {
    const reste = st.echeance - Date.now();
    if (reste < 20000) throw erreur('Temps du passage écoulé : l\'appel est remis au passage suivant.', 'temps');
    delai = reste - 5000;
  }
  const db = base();
  if (db) {
    const [p, d] = await Promise.all([lirePlafond(db), lireDepense(db)]);
    if (d >= p) throw erreur('Plafond IA du jour atteint (' + d.toFixed(2) + ' $ sur ' + p.toFixed(2) + ' $) : reprise demain.', 'budget');
  }
  return delai;
}

/* ── après chaque appel réussi : le coût, écrit tout de suite ── */
async function apres(model, usage) {
  const c = coutReponse(model, usage);
  const s = recherches(usage);
  const st = ALS.getStore();
  if (st) { st.cout = (st.cout || 0) + c; st.recherches = (st.recherches || 0) + s; st.appels = (st.appels || 0) + 1; }
  const j = jourGP();
  if (etat.jour === j) etat.depense += c;
  const db = base();
  if (db && (c > 0 || s > 0)) await db.rpc('hq_bump', { p_day: j, p_cost: c, p_runs: 0, p_searches: s, p_places: 0, p_leads: 0, p_emails: 0, p_items: 0 }).catch(function () { /* compté au prochain relevé */ });
  return c;
}

/* ── le contexte d'un passage : son échéance, et ce qu'il a dépensé ── */
function contexte(extra) { return Object.assign({}, ALS.getStore() || {}, { cout: 0, recherches: 0, appels: 0 }, extra || {}); }
function executer(store, fn) { return ALS.run(store, fn); }

module.exports = { avant, apres, contexte, executer, coutReponse, prixDe, oublier, lirePlafond, lireDepense };
