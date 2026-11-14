// Claude avec la clé de la créatrice : chaque appel est payé par elle, dans le budget du jour qu'elle a choisi.
// Avant l'appel, son prix maximum (tout ce qu'il peut lire et écrire) est réservé sur sa dépense du jour, en une seule
// instruction en base : si son budget n'y suffit pas, l'appel n'a pas lieu. Après l'appel, la réservation est ramenée au
// prix réel. Les erreurs sont dites simplement : clé refusée, plus de crédit, budget du jour atteint, Claude surchargé.
'use strict';
const { MODELS, WEB_SEARCH_USD } = require('../config');
const { relire } = require('../claude');
const SEC = require('./secret');
const C = require('./index');
const { court } = require('../util');

const API = 'https://api.anthropic.com/v1';
let FORCE = null;
function forcer(f) { FORCE = f; }

// le modèle de chaque usage, selon la qualité qu'elle a choisie
const TIERS = {
  eco: { idees: 'fast', ecrire: 'fast', juger: 'fast', adapter: 'fast' },
  equilibre: { idees: 'smart', ecrire: 'smart', juger: 'fast', adapter: 'smart' },
  premium: { idees: 'smart', ecrire: 'genius', juger: 'smart', adapter: 'smart' }
};
function modele(createur, usage) {
  const q = C.reglagesDe(createur).qualite;
  const tier = (TIERS[q] || TIERS.equilibre)[usage] || 'fast';
  return Object.assign({ tier }, MODELS[tier]);
}

class ErreurStudio extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const MESSAGES = {
  cle_absente: 'Ta clé Claude n\'est pas branchée : Réglages, Connexions.',
  cle_illisible: 'Ta clé Claude doit être recollée (le coffre de la tour a changé) : Réglages, Connexions.',
  cle_refusee: 'Claude refuse ta clé (supprimée ou mal copiée) : recolle-la dans Réglages, Connexions.',
  credit: 'Ton compte Claude n\'a plus de crédit (ou a atteint sa limite de dépense) : ajoute du crédit sur platform.claude.com, puis relance.',
  budget: 'Ton budget du jour est atteint : l\'équipe reprend demain, ou monte ton budget dans Réglages.',
  surcharge: 'Claude est surchargé en ce moment : l\'équipe réessaie toute seule dans quelques minutes.'
};
function erreur(code, detail) { return new ErreurStudio(code, MESSAGES[code] + (detail ? ' (' + court(detail, 160) + ')' : '')); }

function cle(createur) {
  const b = (createur.secrets || {}).claude;
  if (!b) throw erreur('cle_absente');
  const k = SEC.dechiffrer(b, 'claude:' + createur.id);
  if (!k) throw erreur('cle_illisible');
  return k;
}

const tokens = (x) => Math.ceil(JSON.stringify(x == null ? '' : x).length / 3.2);
function prixMax(m, body, recherches) {
  const entree = tokens(body.system) + tokens(body.messages) + tokens(body.tools || []);
  // les recherches web ramènent des pages entières : environ 8 000 jetons lus par recherche
  return ((entree + recherches * 8000) * m.in + body.max_tokens * m.out) / 1e6 + recherches * WEB_SEARCH_USD;
}
function prixReel(m, u) {
  u = u || {};
  const s = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  return ((u.input_tokens || 0) * m.in + (u.output_tokens || 0) * m.out + (u.cache_creation_input_tokens || 0) * m.cacheWrite + (u.cache_read_input_tokens || 0) * m.cacheRead) / 1e6 + s * WEB_SEARCH_USD;
}

// réserve (delta > 0, refusé au-delà du plafond) ou rend (delta < 0) sur sa dépense du jour
async function compter(db, createur, delta, plafond) {
  const jour = C.jourDe(createur);
  const r = await db.rpc('hq_crea_cout', { p_id: createur.id, p_jour: jour, p_mois: jour.slice(0, 7), p_delta: Math.round(delta * 1e6) / 1e6, p_plafond: plafond == null ? null : plafond });
  return r || { ok: false };
}

async function requete(k, chemin, methode, corps, delai) {
  return (FORCE || fetch)(API + chemin, {
    method: methode,
    headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
    signal: AbortSignal.timeout(delai || 100000)
  });
}
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function marquerCle(db, createur, etat, message) {
  const s = Object.assign({}, createur.secrets || {});
  if (!s.claude) return;
  s.claude = Object.assign({}, s.claude, { etat, message: message || null });
  await db.update('hq_createurs', { secrets: s, updated_at: new Date().toISOString() }, { eq: { id: createur.id } }).catch(() => null);
}

// Un appel : un outil à remplir (la réponse), éventuellement des recherches web avant.
// opts = { usage, system, prompt, outil: { name, description, input_schema }, maxTokens, recherches }
// rend { sortie, cout, modele }
async function appeler(db, createur, opts) {
  const k = cle(createur);
  const r = C.reglagesDe(createur);
  let m = modele(createur, opts.usage);
  const recherches = Math.max(0, Math.min(4, opts.recherches || 0));
  const tools = [opts.outil];
  if (recherches) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: recherches });
  const messages = [{ role: 'user', content: opts.prompt }];
  let cout = 0, secours = false, relance = false, sortie = null, dernierModele = m.id;
  for (let tour = 0; tour < 4 && !sortie; tour++) {
    const body = {
      model: m.id,
      max_tokens: opts.maxTokens || 3000,
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      messages,
      tools,
      // avec des recherches, le modèle choisit quand remplir l'outil ; sinon il le remplit tout de suite
      tool_choice: tools.length > 1 ? { type: 'auto' } : { type: 'tool', name: opts.outil.name }
    };
    const max = prixMax(m, body, tools.length > 1 ? recherches : 0);
    const resa = await compter(db, createur, max, r.budget_jour);
    if (!resa.ok) throw erreur('budget');
    let rep = null, data = null, derniere = null;
    // deux essais au plus, 95 secondes chacun : l'étape tient dans les 300 secondes d'une fonction
    for (let essai = 0; essai < 2; essai++) {
      try {
        rep = await requete(k, '/messages', 'POST', body, 95000);
        data = await rep.json().catch(() => ({}));
      } catch (e) {
        // délai dépassé : la demande a pu être faite et payée, la réservation reste au prix maximum
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw erreur('surcharge', 'pas de réponse de Claude');
        derniere = e; rep = null; await pause(2000 * (essai + 1)); continue;
      }
      if (rep.status === 429 || rep.status === 529 || rep.status >= 500) { derniere = new Error((data.error && data.error.message) || ('HTTP ' + rep.status)); await pause(2500 * (essai + 1)); continue; }
      break;
    }
    if (!rep || !rep.ok) {
      await compter(db, createur, -max);
      const msg = data && data.error && data.error.message ? data.error.message : (derniere && derniere.message) || 'injoignable';
      if (!rep || rep.status === 429 || rep.status === 529 || rep.status >= 500) throw erreur('surcharge', msg);
      if (rep.status === 401) { await marquerCle(db, createur, 'refusee', 'Claude a refusé la clé le ' + new Date().toLocaleDateString('fr-FR')); throw erreur('cle_refusee'); }
      if (/credit balance|usage limit|spend limit|billing|regain access/i.test(msg)) { await marquerCle(db, createur, 'credit', court(msg, 160)); throw erreur('credit', msg); }
      if ((rep.status === 404 || (rep.status === 400 && /model/i.test(msg))) && !secours && m.fallback) { secours = true; m = Object.assign({}, m, { id: m.fallback }); tour--; continue; }
      if (rep.status === 400 && /web_search/i.test(msg) && tools.length > 1) { tools.pop(); tour--; continue; }
      throw new ErreurStudio('claude', 'Claude a refusé la demande : ' + court(msg, 200));
    }
    const prix = prixReel(m, data.usage);
    cout += prix;
    await compter(db, createur, prix - max);
    dernierModele = data.model || m.id;
    if ((createur.secrets || {}).claude && (createur.secrets.claude.etat || 'ok') !== 'ok') await marquerCle(db, createur, 'ok');
    const contenu = data.content || [];
    const t = contenu.find((b) => b.type === 'tool_use' && b.name === opts.outil.name);
    if (t) { sortie = relire(t.input || {}, opts.outil.input_schema); break; }
    // coupé par la longueur : une seule relance avec plus de place
    if (data.stop_reason === 'max_tokens' && !relance) { relance = true; body.max_tokens = Math.min(8000, (opts.maxTokens || 3000) * 2); opts = Object.assign({}, opts, { maxTokens: body.max_tokens }); continue; }
    messages.push({ role: 'assistant', content: contenu });
    if (data.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: 'Appelle maintenant l\'outil ' + opts.outil.name + ' avec ton travail, directement, sans texte autour.' });
    tools.splice(1);
  }
  if (!sortie) throw new ErreurStudio('claude', 'Claude n\'a pas rendu le travail demandé (réponse incomplète)');
  return { sortie, cout: Math.round(cout * 1e6) / 1e6, modele: dernierModele };
}

// Une clé collée par la créatrice : est-ce bien une clé, Claude la connaît-il, reste-t-il du crédit ?
// (la liste des modèles ne coûte rien ; l'essai d'un mot coûte moins d'un millième de centime)
async function essayerCle(k) {
  k = String(k || '').trim();
  if (/^sk-ant-admin/.test(k)) return { erreur: 'c\'est une clé d\'administration : crée une clé API normale (API keys, Create key)' };
  if (!/^sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}$/.test(k)) return { erreur: 'ce n\'est pas une clé Claude : elle commence par sk-ant-api' };
  let r;
  try { r = await requete(k, '/models?limit=5', 'GET', null, 15000); } catch (e) { return { erreur: 'Claude ne répond pas, réessaie dans une minute' }; }
  if (r.status === 401 || r.status === 403) return { erreur: 'Claude ne reconnaît pas cette clé (supprimée, ou mal copiée : copie-la en entier)' };
  if (!r.ok) return { erreur: 'Claude répond ' + r.status + ', réessaie dans une minute' };
  let e;
  try {
    e = await requete(k, '/messages', 'POST', { model: MODELS.fast.id, max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }, 30000);
  } catch (x) { return { ok: true, avertissement: 'clé reconnue, mais l\'essai n\'a pas abouti : on verra à la première vidéo' }; }
  if (e.ok) return { ok: true };
  const d = await e.json().catch(() => ({}));
  const msg = (d.error && d.error.message) || '';
  if (/credit balance|billing|purchase credits/i.test(msg)) return { ok: true, credit: false, avertissement: 'ta clé marche, mais ton compte n\'a pas encore de crédit : ajoute 5 $ dans Billing (étape 2) avant ta première vidéo' };
  if (/usage limit|spend limit/i.test(msg)) return { ok: true, credit: false, avertissement: 'ta clé marche, mais ton compte a atteint sa limite de dépense : monte-la dans Limits' };
  if (e.status === 404 || /model/i.test(msg)) return { ok: true };
  return { ok: true, avertissement: 'clé reconnue (essai : ' + court(msg || ('HTTP ' + e.status), 80) + ')' };
}

module.exports = { appeler, essayerCle, modele, prixMax, prixReel, compter, ErreurStudio, MESSAGES, TIERS, forcer };
