// Claude avec la clé de la créatrice : chaque appel est payé par elle, dans le budget du jour qu'elle a choisi.
// Avant l'appel, son prix maximum (tout ce qu'il peut lire et écrire) est réservé sur sa dépense du jour, en une seule
// instruction en base : si son budget n'y suffit pas, l'appel n'a pas lieu. Après l'appel, la réservation est ramenée au
// prix réel. Les erreurs sont dites simplement : clé refusée, plus de crédit, budget du jour atteint, Claude surchargé.
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const { MODELS, WEB_SEARCH_USD } = require('../config');
const { relire, lireFlux } = require('../claude');
const SEC = require('./secret');
const C = require('./index');
const { court } = require('../util');

const API = 'https://api.anthropic.com/v1';
let FORCE = null;
function forcer(f) { FORCE = f; }
// l'heure à laquelle la fonction Vercel en cours sera coupée, propre à chaque requête du studio : un appel qui ne peut
// plus finir avant n'est pas lancé, une réponse en cours est attendue jusque-là au plus
const TEMPS = new AsyncLocalStorage();
function avecEcheance(t, f) { return TEMPS.run({ fin: t }, f); }
const TEMPS_MIN = 30000;     // moins de 30 secondes devant soi : on n'appelle pas, le passage suivant reprend
const DELAI_MAX = 210000;    // une réponse attendue 3 min 30 au plus
const SILENCE = 60000;       // une réponse qui ne dit plus rien pendant une minute est abandonnée
const JETONS_MAX = 12000;    // la relance d'une réponse coupée par la longueur

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
  cle_refusee: 'Claude refuse ta clé (supprimée, expirée ou mal copiée) : recolle-la dans Réglages, Connexions.',
  cle_espace: 'Ta clé Claude n\'est liée à aucun espace de travail : recolle-la dans Réglages, Connexions, le studio le trouvera tout seul.',
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
// l'espace de travail de sa clé : les clés personnelles qui ne sont pas liées à un espace doivent le nommer à chaque
// demande (en-tête anthropic-workspace-id) ; le studio l'a trouvé au moment où elle a collé sa clé
const ESPACE_VALIDE = /^[A-Za-z0-9_-]{3,80}$/;
function espaceDe(createur) { const e = ((createur.secrets || {}).claude || {}).espace; return ESPACE_VALIDE.test(String(e || '')) ? e : null; }
// les clés qui ne passent qu'en « Authorization: Bearer » (le studio l'a vu au moment où elle l'a collée)
const porteurDe = (createur) => !!((createur.secrets || {}).claude || {}).porteur;
const SANS_ESPACE = /anthropic-workspace-id|not scoped to a workspace/i;

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

async function requete(k, chemin, methode, corps, delai, espace, porteur) {
  const headers = { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  if (porteur) headers.authorization = 'Bearer ' + k; else headers['x-api-key'] = k;
  if (espace) headers['anthropic-workspace-id'] = espace;
  return (FORCE || fetch)(API + chemin, {
    method: methode,
    headers,
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

// Les modèles qui refusent un outil imposé : la génération 5.5 répond « tool_choice: type "tool" and "any" are not
// supported for this model » (400, rien n'est payé). L'outil leur est alors demandé en clair, avec tool_choice « auto »,
// comme dans la tour ; retenu pour la durée de la fonction. Avant, ce refus passait pour un modèle introuvable : le studio
// essayait l'ancien modèle de repli (claude-sonnet-4-5), fermé aux comptes récents, et toute écriture échouait
// (« Claude a refusé la demande : model: claude-sonnet-4-5 », vidéo d'Emma, 15 nov.).
const SANS_OUTIL_IMPOSE = new Set();
const OUTIL_REFUSE = /tool_choice|forced tool|tool use is not supported/i;
// pour les essais : comme une fonction qui démarre (rien de retenu sur les modèles)
function oublier() { SANS_OUTIL_IMPOSE.clear(); }
function enClair(body, nom) {
  const consigne = 'Réponds en appelant l\'outil ' + nom + ', et seulement lui, directement : aucun texte avant ni après, tout ton travail va dans l\'outil.';
  const messages = body.messages.slice();
  const k = messages.length - 1;
  if (k >= 0 && messages[k].role === 'user') {
    const c = messages[k].content;
    messages[k] = { role: 'user', content: (typeof c === 'string' ? [{ type: 'text', text: c }] : c.slice()).concat([{ type: 'text', text: consigne }]) };
  }
  return Object.assign({}, body, { tool_choice: { type: 'auto' }, messages });
}

// Le modèle prévu n'est pas ouvert à son compte (introuvable, retiré, réservé) : on prend le plus proche de ceux que sa
// clé propose (la liste des modèles ne coûte rien), de la même famille d'abord, le plus récent d'abord.
const MODELE_ABSENT = /^model:|model[^.]{0,80}(not found|does not exist|not available|no longer|deprecated|retired|not have access|no access)|(not found|does not exist|not available|not have access|no access)[^.]{0,80}model/i;
const modeleAbsent = (status, msg) => status === 404 || ((status === 400 || status === 403) && MODELE_ABSENT.test(msg || ''));
const famille = (id) => (/haiku/.test(id) ? 'haiku' : /sonnet/.test(id) ? 'sonnet' : /opus/.test(id) ? 'opus' : null);
const FAMILLES = { fast: ['haiku', 'sonnet'], smart: ['sonnet', 'opus', 'haiku'], genius: ['opus', 'sonnet'] };
// prix prudents quand ce n'est pas le modèle prévu (les générations précédentes coûtent souvent plus cher)
const PRIX_FAMILLE = {
  haiku: { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.10 },
  sonnet: { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  opus: { in: 5, out: 25, cacheWrite: 6.25, cacheRead: 0.50 }
};
const PRIX_TIER = { haiku: 'fast', sonnet: 'smart', opus: 'genius' };
function modeleNomme(id, tier) {
  for (const t of Object.keys(MODELS)) if (MODELS[t].id === id) return Object.assign({}, MODELS[t], { tier, fallback: null });
  const f = famille(id);
  const a = MODELS[PRIX_TIER[f] || tier] || MODELS.smart, b = PRIX_FAMILLE[f] || PRIX_FAMILLE.opus;
  return { tier, id, fallback: null, in: Math.max(a.in, b.in), out: Math.max(a.out, b.out), cacheWrite: Math.max(a.cacheWrite, b.cacheWrite), cacheRead: Math.max(a.cacheRead, b.cacheRead) };
}
async function modelesDe(k, espace, porteur) {
  try {
    const r = await requete(k, '/models?limit=100', 'GET', null, 15000, espace, porteur);
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return (Array.isArray(d.data) ? d.data : []).filter((x) => x && typeof x.id === 'string');
  } catch (e) { return null; }
}
async function remplacant(k, espace, porteur, m) {
  const liste = await modelesDe(k, espace, porteur);
  const ids = (liste && liste.length
    ? liste.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).map((x) => x.id)
    : [m.fallback].filter(Boolean)).filter((id) => id !== m.id && famille(id) && !/fable|mythos/.test(id));
  for (const f of FAMILLES[m.tier] || FAMILLES.smart) {
    const id = ids.find((x) => famille(x) === f);
    if (id) return modeleNomme(id, m.tier);
  }
  return null;
}

// Un appel : un outil à remplir (la réponse), éventuellement des recherches web avant.
// opts = { usage, system, prompt, outil: { name, description, input_schema }, maxTokens, recherches }
// rend { sortie, cout, modele }
async function appeler(db, createur, opts) {
  const k = cle(createur);
  const espace = espaceDe(createur);
  const porteur = porteurDe(createur);
  const r = C.reglagesDe(createur);
  let m = modele(createur, opts.usage);
  const st = TEMPS.getStore();
  const fin = (st && st.fin) || Date.now() + 240000;
  const recherches = Math.max(0, Math.min(4, opts.recherches || 0));
  const tools = [opts.outil];
  if (recherches) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: recherches });
  const messages = [{ role: 'user', content: opts.prompt }];
  let maxTokens = opts.maxTokens || 3000;
  let cout = 0, relance = false, sortie = null, dernierModele = m.id, premier = null, reprises = 0;
  for (let tour = 0; tour < 4 && !sortie; tour++) {
    let body = {
      model: m.id,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      messages,
      tools,
      // avec des recherches, le modèle choisit quand remplir l'outil ; sinon il le remplit tout de suite
      tool_choice: tools.length > 1 ? { type: 'auto' } : { type: 'tool', name: opts.outil.name }
    };
    if (body.tool_choice.type === 'tool' && SANS_OUTIL_IMPOSE.has(m.id)) body = enClair(body, opts.outil.name);
    // plus assez de temps dans ce passage pour une réponse entière : rien n'est demandé, le passage suivant reprend
    if (fin - Date.now() < TEMPS_MIN) throw new ErreurStudio('temps', 'Claude n\'avait plus le temps de répondre dans ce passage : l\'équipe reprend au suivant.');
    const max = prixMax(m, body, tools.length > 1 ? recherches : 0);
    const resa = await compter(db, createur, max, r.budget_jour);
    if (!resa.ok) throw erreur('budget');
    let rep = null, data = null, derniere = null, sansTemps = false;
    // deux essais au plus ; la réponse arrive au fil de l'eau (un long script ne bute plus sur le délai d'une requête)
    for (let essai = 0; essai < 2; essai++) {
      const delai = Math.min(DELAI_MAX, fin - Date.now());
      if (delai < TEMPS_MIN) { sansTemps = essai === 0; break; }
      rep = null; data = null;
      try {
        rep = await requete(k, '/messages', 'POST', Object.assign({}, body, { stream: true }), delai, espace, porteur);
        data = rep.ok ? await lireFlux(rep, SILENCE) : await rep.json().catch(() => ({}));
      } catch (e) {
        // délai dépassé ou réponse coupée en route : la demande a pu être faite et payée, la réservation reste au prix maximum
        if (rep && rep.ok) { console.warn('[studio] Claude coupé en route (' + m.id + ', créatrice ' + createur.id + ') : ' + court(e.message, 200)); throw erreur('surcharge', 'réponse de Claude coupée en route'); }
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw erreur('surcharge', 'pas de réponse de Claude');
        derniere = e; rep = null; await pause(2000 * (essai + 1)); continue;
      }
      if (rep.status === 429 || rep.status === 529 || rep.status >= 500) { derniere = new Error(messageDe(data) || ('HTTP ' + rep.status)); await pause(2500 * (essai + 1)); continue; }
      break;
    }
    if (!rep || !rep.ok) {
      await compter(db, createur, -max);
      if (sansTemps) throw new ErreurStudio('temps', 'Claude n\'avait plus le temps de répondre dans ce passage : l\'équipe reprend au suivant.');
      const msg = messageDe(data) || (derniere && derniere.message) || 'injoignable';
      // la vraie réponse de Claude dans les journaux de Vercel (jamais la clé)
      console.warn('[studio] Claude ' + (rep ? rep.status : 'injoignable') + ' (' + m.id + ', ' + (opts.outil && opts.outil.name) + ', créatrice ' + createur.id + ') : ' + court(msg, 300));
      if (!rep || rep.status === 429 || rep.status === 529 || rep.status >= 500) throw erreur('surcharge', msg);
      if (rep.status === 401) { await marquerCle(db, createur, 'refusee', 'Claude a refusé la clé le ' + new Date().toLocaleDateString('fr-FR')); throw erreur('cle_refusee'); }
      if (rep.status === 400 && SANS_ESPACE.test(msg)) { await marquerCle(db, createur, 'refusee', 'clé liée à aucun espace de travail : recolle-la'); throw erreur('cle_espace'); }
      if (/credit balance|usage limit|spend limit|billing|regain access/i.test(msg)) { await marquerCle(db, createur, 'credit', court(msg, 160)); throw erreur('credit', msg); }
      if (reprises < 4) {
        // la génération 5.5 refuse l'outil imposé : demandé en clair, au même tour (le refus ne coûte rien)
        if (rep.status === 400 && OUTIL_REFUSE.test(msg) && body.tool_choice.type !== 'auto') { SANS_OUTIL_IMPOSE.add(m.id); reprises++; tour--; continue; }
        if (rep.status === 400 && /web_search/i.test(msg) && tools.length > 1) { tools.pop(); reprises++; tour--; continue; }
        if (!premier && modeleAbsent(rep.status, msg)) {
          premier = { id: m.id, msg };
          const autre = await remplacant(k, espace, porteur, m);
          if (autre) { console.warn('[studio] ' + m.id + ' indisponible pour la créatrice ' + createur.id + ' : ' + autre.id + ' à la place'); m = autre; reprises++; tour--; continue; }
        }
      }
      // la cause première d'abord : quand le modèle de remplacement échoue aussi, son refus ne cache plus le premier
      const detail = premier && premier.id !== m.id ? premier.id + ' : ' + premier.msg + ' ; ' + m.id + ' : ' + msg : msg;
      throw new ErreurStudio('claude', 'Claude a refusé la demande : ' + court(detail, 240));
    }
    const prix = prixReel(m, data.usage);
    cout += prix;
    await compter(db, createur, prix - max);
    dernierModele = data.model || m.id;
    if ((createur.secrets || {}).claude && (createur.secrets.claude.etat || 'ok') !== 'ok') await marquerCle(db, createur, 'ok');
    const contenu = data.content || [];
    const t = contenu.find((b) => b.type === 'tool_use' && b.name === opts.outil.name);
    // coupé par la longueur, même en plein outil (un outil à moitié écrit ne se reprend pas) : une relance avec plus de place
    if (data.stop_reason === 'max_tokens' && !relance) { relance = true; maxTokens = Math.min(JETONS_MAX, Math.max(maxTokens * 2, 6000)); continue; }
    if (t) { sortie = relire(t.input || {}, opts.outil.input_schema); break; }
    messages.push({ role: 'assistant', content: contenu });
    if (data.stop_reason === 'pause_turn') continue;
    messages.push({ role: 'user', content: 'Appelle maintenant l\'outil ' + opts.outil.name + ' avec ton travail, directement, sans texte autour.' });
    tools.splice(1);
  }
  if (!sortie) throw new ErreurStudio('claude', 'Claude n\'a pas rendu le travail demandé (réponse incomplète)');
  return { sortie, cout: Math.round(cout * 1e6) / 1e6, modele: dernierModele };
}

// Ce qu'elle a collé : la clé seule (même entourée de texte, coupée par un retour à la ligne, avec des caractères
// invisibles), ou la raison précise pour laquelle ce n'en est pas une. La forme des clés change avec les comptes Claude
// (sk-ant-api03-..., ou sans « api » pour les clés personnelles récentes) : on n'exige rien de plus qu'une longue suite
// sans espace, et c'est Claude qui dit si elle marche.
const MASQUE = /\.\.\.|…|•|\*{2,}/;
const debut = (s) => s.length + ' caractères, commence par « ' + court(s.slice(0, 4), 6) + '… »';
function lireCle(brut) {
  const s = SEC.cleCollee(brut);
  if (!s) return { erreur: 'colle ta clé dans la case' };
  if (MASQUE.test(s)) return { erreur: 'c\'est la version raccourcie d\'une clé (avec des points) : la clé entière ne s\'affiche qu\'une fois, quand tu la crées. Crée une nouvelle clé et copie-la tout de suite avec le bouton de copie' };
  // la clé qui commence par sk-ant- si elle est entourée de texte, sinon tout ce qui a été collé
  const m = /sk-ant-[A-Za-z0-9_\-.~+/=:]+/.exec(s);
  const k = (m ? m[0] : s).replace(/[.,;:!?)\]]+$/, '');
  if (/^sk-ant-admin/.test(k)) return { erreur: 'c\'est une clé d\'administration : crée une clé normale (Settings, API keys, Create key)' };
  if (!m && k.length < 30) return { erreur: 'ce que tu as collé n\'est pas une clé Claude (' + debut(k) + ') : une clé est une longue suite d\'une centaine de caractères. Si ton téléphone a rempli la case tout seul, efface et colle ta clé' };
  if (k.length < 30) return { erreur: 'ta clé est incomplète (' + k.length + ' caractères au lieu d\'une centaine) : recopie-la en entier' };
  if (!/^[\x21-\x7e]+$/.test(k)) return { erreur: 'ta clé contient des caractères inattendus (' + debut(k) + ') : recopie-la avec le bouton de copie' };
  return { cle: k, connue: !!m };
}

// une clé personnelle qui n'est liée à aucun espace de travail : on cherche le sien (celui par défaut d'abord)
async function trouverEspace(k, porteur) {
  let r;
  try { r = await requete(k, '/organizations/workspaces?include_default=true&limit=20', 'GET', null, 15000, null, porteur); } catch (e) { return null; }
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  const l = (Array.isArray(d.data) ? d.data : []).filter((w) => w && ESPACE_VALIDE.test(String(w.id || '')) && !w.archived_at);
  const choisi = l.find((w) => w.is_default === true) || l.find((w) => /default|défaut/i.test(String(w.name || ''))) || l[0];
  return choisi ? String(choisi.id) : null;
}
const messageDe = (d) => (d && d.error && d.error.message) || '';
const SANS_ESPACE_TROUVE = 'ta clé n\'est liée à aucun espace de travail et le studio n\'a pas pu le trouver : recrée-la en choisissant l\'espace « Default » (Workspace) dans la fenêtre de création';

// Une clé collée par la créatrice : est-ce bien une clé, Claude la connaît-il, reste-t-il du crédit ?
// (la liste des modèles ne coûte rien ; l'essai d'un mot coûte moins d'un millième de centime). Rend aussi la clé
// nettoyée et, pour une clé personnelle sans espace de travail, l'espace à nommer dans chaque demande.
async function essayerCle(brut) {
  const lu = lireCle(brut);
  if (lu.erreur) return { erreur: lu.erreur };
  const k = lu.cle;
  let espace = null, porteur = false;
  const refus = (status, d) => {
    const m = messageDe(d);
    if (/expired/i.test(m)) return { erreur: 'Claude refuse cette clé : elle a expiré. Crée-en une nouvelle avec l\'expiration « Never »' };
    if (/^sk-ant-oat/.test(k)) return { erreur: 'c\'est un jeton de connexion (Claude Code ou ton abonnement Claude), pas une clé : crée une clé sur platform.claude.com, Settings, API keys' };
    if (status === 403) return { erreur: 'Claude refuse cette clé (' + court(m || 'accès refusé', 100) + ')' };
    if (!lu.connue) return { erreur: 'Claude ne reconnaît pas ce que tu as collé (' + debut(k) + ') : copie la clé en entier, avec le bouton de copie, juste après l\'avoir créée' };
    return { erreur: 'Claude ne reconnaît pas cette clé (supprimée, ou mal copiée : copie-la en entier)' };
  };
  // la liste des modèles (gratuit) : d'abord avec l'en-tête historique, puis en « Bearer » si la clé n'y passe pas
  const modeles = () => requete(k, '/models?limit=5', 'GET', null, 15000, espace, porteur);
  let r, d;
  try { r = await modeles(); } catch (e) { return { erreur: 'Claude ne répond pas, réessaie dans une minute' }; }
  d = await r.json().catch(() => ({}));
  if (r.status === 401) {
    porteur = true;
    try { const r2 = await modeles(); const d2 = await r2.json().catch(() => ({})); if (r2.status !== 401) { r = r2; d = d2; } else porteur = false; } catch (e) { porteur = false; }
  }
  if (r.status === 401 || r.status === 403) return refus(r.status, d);
  if (r.status === 400 && SANS_ESPACE.test(messageDe(d))) {
    espace = await trouverEspace(k, porteur);
    if (!espace) return { erreur: SANS_ESPACE_TROUVE };
    try { r = await modeles(); } catch (e) { return { erreur: 'Claude ne répond pas, réessaie dans une minute' }; }
    d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) return refus(r.status, d);
  }
  if (!r.ok) return { erreur: 'Claude répond ' + r.status + (messageDe(d) ? ' (' + court(messageDe(d), 100) + ')' : '') + ', réessaie dans une minute' };
  // un mot (moins d'un millième de centime) : reste-t-il du crédit ?
  const essai = () => requete(k, '/messages', 'POST', { model: MODELS.fast.id, max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }, 30000, espace, porteur);
  const reconnue = (x) => Object.assign({ ok: true, cle: k, espace, porteur }, x || {});
  let e;
  try { e = await essai(); } catch (x) { return reconnue({ avertissement: 'clé reconnue, mais l\'essai n\'a pas abouti : on verra à la première vidéo' }); }
  let msg = '';
  if (!e.ok) {
    msg = messageDe(await e.json().catch(() => ({})));
    // la liste des modèles passe sans espace de travail, pas l'écriture : on le cherche et on réessaie
    if (e.status === 400 && SANS_ESPACE.test(msg) && !espace) {
      espace = await trouverEspace(k, porteur);
      if (!espace) return { erreur: SANS_ESPACE_TROUVE };
      try { e = await essai(); } catch (x) { return reconnue({ avertissement: 'clé reconnue, mais l\'essai n\'a pas abouti : on verra à la première vidéo' }); }
      msg = e.ok ? '' : messageDe(await e.json().catch(() => ({})));
    }
  }
  if (e.ok) return reconnue();
  if (e.status === 401) return refus(401, { error: { message: msg } });
  if (/credit balance|billing|purchase credits/i.test(msg)) return reconnue({ credit: false, avertissement: 'ta clé marche, mais ton compte n\'a pas encore de crédit : ajoute 5 $ dans Billing (étape 2) avant ta première vidéo' });
  if (/usage limit|spend limit/i.test(msg)) return reconnue({ credit: false, avertissement: 'ta clé marche, mais ton compte a atteint sa limite de dépense : monte-la dans Limits' });
  if (e.status === 404 || /model/i.test(msg)) return reconnue();
  return reconnue({ avertissement: 'clé reconnue (essai : ' + court(msg || ('HTTP ' + e.status), 80) + ')' });
}

module.exports = { appeler, essayerCle, lireCle, modele, modeleNomme, remplacant, prixMax, prixReel, compter, ErreurStudio, MESSAGES, TIERS, forcer, avecEcheance, oublier };
