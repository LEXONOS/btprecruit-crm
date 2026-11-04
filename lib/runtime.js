// Le moteur : réveille les agents dont c'est l'heure, les fait travailler (Claude + outils, ou travail
// automatique), compte chaque dollar, respecte le plafond du jour, et garde la hiérarchie vivante.
'use strict';
const { open } = require('./db');
const { BUDGET_DEFAUT, CYCLE_SECONDES, AGENTS_EN_PARALLELE, SEED_VERSION, MODELS } = require('./config');
const { COMPANIES, AGENTS, PROPOSALS } = require('./seed');
const { converse } = require('./claude');
const { definitions, executeurs } = require('./tools');
const { construire } = require('./context');
const { lirePage } = require('./web');
const { jourGP, minuitGP, court, nettoie } = require('./util');

const JOBS = {
  domaines: require('./jobs/domaines'),
  maps: require('./jobs/maps'),
  enrichir: require('./jobs/enrichir'),
  portfolio: require('./jobs/portfolio'),
  github: require('./jobs/github'),
  controle: require('./jobs/controle'),
  registre: require('./jobs/registre'),
  demo: require('./jobs/demo'),
  direction: require('./jobs/direction'),
  photos: require('./jobs/photos'),
  juridique: require('./jobs/juridique'),
  livraison: require('./jobs/livraison'),
  critique: require('./jobs/critique')
};
const ENVOI = require('./jobs/envoi');
const BOITE = require('./jobs/boite');

const RANG = { agent: 0, manager: 1, rh: 2, directeur: 3, dg: 4, pdg: 5 };
// stratégies réécrites par le code à une montée de version (sinon chaque agent garde la sienne)
// (3 : la stratégie de Lucas après la seconde relecture ; 4 : l'offre au mois dans les angles de Victor, Ana et Chloé ;
// 8 : le pôle écriture, les tests de messages et Emma qui se présente comme l'assistante IA de Louis)
const MIGRATIONS = { 2: ['dg_novalemo', 'dircom_novalemo', 'rh_novalemo', 'emailing', 'contacts', 'chasse_domaines', 'chasse_maps', 'chasse_registre', 'redacteur', 'relanceur', 'reponses', 'partenaires', 'inbound', 'analyste', 'chef_prod', 'demo', 'livraison'], 3: ['livraison'], 4: ['dircom_novalemo', 'emailing', 'redacteur'], 5: ['livraison', 'dircom_novalemo', 'emailing', 'redacteur'], 6: ['demo', 'reponses'], 7: ['demo', 'reponses', 'da', 'chef_prod', 'livraison'], 8: ['dircom_novalemo', 'emailing', 'redacteur', 'reponses'], 9: ['dircom_novalemo', 'emailing', 'redacteur', 'reponses', 'demo', 'da', 'photos', 'chef_prod', 'contacts'] };
// plafonds par défaut relevés par une version : un plafond resté à l'ancienne valeur par défaut prend la nouvelle
const PLAFONDS = { 8: { emails_jour: [25, 50], apercus_jour: [12, 20] } };
const nowIso = function () { return new Date().toISOString(); };

/* ── fondation (premier branchement, puis nouveaux postes du code) ── */
function sieges(liste) {
  const ordre = { pdg: 0, dg: 1, directeur: 2, rh: 3, manager: 4, agent: 5 };
  const parBoite = {};
  liste.forEach(function (a, k) { (parBoite[a.company_id] = parBoite[a.company_id] || []).push({ a: a, k: k }); });
  const seat = {};
  Object.keys(parBoite).forEach(function (c) {
    parBoite[c].sort(function (x, y) { return (ordre[x.a.tier] - ordre[y.a.tier]) || (x.k - y.k); }).forEach(function (x, i) { seat[x.a.id] = i; });
  });
  return seat;
}

async function semer(db) {
  const cfg = await db.one('hq_config', { eq: { key: 'seed' } });
  const version = (cfg && cfg.value && cfg.value.version) || 0;
  if (version >= SEED_VERSION) return { seme: false };
  const verrou = await db.rpc('hq_lock', { p_name: 'seed', p_seconds: 90 });
  if (!verrou) return { seme: false, encours: true };
  try { return await semerVraiment(db, version); }
  finally { await db.rpc('hq_unlock', { p_name: 'seed' }).catch(function () {}); }
}

function profondeur(a, parId) { let d = 0, cur = a; while (cur && cur.parent_id && d < 20) { cur = parId[cur.parent_id]; d++; } return d; }

async function semerVraiment(db, version) {
  const t = Date.now();
  const existantsC = await db.select('hq_companies', { select: 'id,status' });
  const idsC = new Set(existantsC.map(function (c) { return c.id; }));
  const nouvellesC = COMPANIES.filter(function (c) { return !idsC.has(c.id); }).map(function (c) { return Object.assign({}, c); });
  if (nouvellesC.length) await db.insert('hq_companies', nouvellesC, { returning: false });
  for (const c of COMPANIES.filter(function (x) { return idsC.has(x.id); })) {
    const ex = existantsC.find(function (e) { return e.id === c.id; });
    const patch = { tagline: c.tagline, color: c.color, mission: c.mission, updated_at: nowIso() };
    if (c.context && !(ex.status === 'active' && c.status === 'proposee')) patch.context = c.context;
    await db.update('hq_companies', patch, { eq: { id: c.id } });
  }
  const existantsA = await db.select('hq_agents', { select: 'id,kind,status' });
  const idsA = new Set(existantsA.map(function (a) { return a.id; }));
  const seat = sieges(AGENTS);
  const lignes = [];
  const savoir = [];
  AGENTS.forEach(function (a) {
    if (idsA.has(a.id)) return;
    lignes.push({
      id: a.id, company_id: a.company_id, parent_id: a.parent_id || null, name: a.name, title: a.title, tier: a.tier, kind: a.kind, job: a.job || null, model: a.model || 'fast',
      mission: a.mission, charter: a.charter, playbook: a.playbook || '', tools: a.tools || [], cadence_min: a.cadence_min || 1440,
      next_run_at: a.kind === 'attente' ? null : new Date(t + (a.start || 30) * 60000).toISOString(), status: a.kind === 'attente' ? 'attente' : 'idle',
      waiting_for: a.waiting_for || null, stats: { web: a.web || 0, runs: 0, cout: 0 }, seat: seat[a.id], origin: 'fondation', created_by: 'fondation'
    });
    (a.knowledge || []).forEach(function (k) { savoir.push({ agent_id: a.id, kind: 'fait', content: k, weight: 8, source: 'fondation' }); });
  });
  if (lignes.length) {
    // par niveau hiérarchique : un chef existe toujours avant ses équipes (clé étrangère)
    const parId = {};
    AGENTS.forEach(function (a) { parId[a.id] = a; });
    const niveaux = {};
    lignes.forEach(function (l) { const d = profondeur(parId[l.id], parId); (niveaux[d] = niveaux[d] || []).push(l); });
    for (const d of Object.keys(niveaux).map(Number).sort(function (x, y) { return x - y; })) await db.insert('hq_agents', niveaux[d], { returning: false });
  }
  // postes existants : la fiche et les outils suivent le code, la stratégie et la cadence restent celles de l'agent
  // (sauf migration voulue : version 2 = Novalemo passe en Martinique uniquement et en pilote automatique)
  const forcees = new Set();
  Object.keys(MIGRATIONS).forEach(function (v) { if (Number(v) > version) MIGRATIONS[v].forEach(function (id) { forcees.add(id); }); });
  for (const a of AGENTS.filter(function (x) { return idsA.has(x.id); })) {
    const ex = existantsA.find(function (e) { return e.id === a.id; });
    const patch = { charter: a.charter, mission: a.mission, title: a.title, tools: a.tools || [], waiting_for: a.waiting_for || null, updated_at: nowIso() };
    if (ex.kind === 'attente' && a.kind !== 'attente') Object.assign(patch, { kind: a.kind, job: a.job || null, model: a.model || 'fast', cadence_min: a.cadence_min || 1440, status: 'idle', next_run_at: new Date(t + (a.start || 10) * 60000).toISOString() });
    if (forcees.has(a.id)) patch.playbook = a.playbook || '';
    await db.update('hq_agents', patch, { eq: { id: a.id } });
  }
  if (savoir.length) await db.insert('hq_knowledge', savoir, { returning: false });
  if (version > 0) {
    const b = await db.one('hq_config', { eq: { key: 'budget' } });
    if (b && b.value) {
      const v = Object.assign({}, b.value);
      let change = false;
      const faits = [];
      Object.keys(PLAFONDS).forEach(function (n) { if (Number(n) > version) Object.keys(PLAFONDS[n]).forEach(function (k) { if (Number(v[k]) === PLAFONDS[n][k][0]) { v[k] = PLAFONDS[n][k][1]; change = true; faits.push((k === 'emails_jour' ? 'emails par jour' : 'aperçus par jour') + ' : ' + PLAFONDS[n][k][0] + ' à ' + PLAFONDS[n][k][1]); } }); });
      if (change) {
        await db.update('hq_config', { value: v, updated_at: nowIso() }, { eq: { key: 'budget' } });
        // une valeur égale à l'ancien défaut a pu être choisie par Louis : il est prévenu, il la remet en un clic
        await db.insert('hq_messages', { from_id: 'controleur', to_id: 'louis', company_id: 'groupe', kind: 'note', subject: 'Plafonds relevés', body: 'Ils étaient aux anciennes valeurs par défaut, je les ai relevés : ' + faits.join(', ') + '. La boîte suit toujours sa chauffe (8 emails par jour au départ, plus si elle reste saine) : le plafond ne joue qu\'au bout. Si l\'ancienne valeur était ton choix, remets-la dans Gestion, Coûts et budget.' }, { returning: false });
      }
    }
  }
  // version 9 : le nouveau moteur des sites arrive en phase de test (aucun premier email tant que Louis n'a pas regardé
  // les nouveaux aperçus) ; les adresses devinées (contact@ du domaine) ne sont plus jamais écrites à froid
  if (version > 0 && version < 9) {
    const PHs = require('./sites/phase');
    const ph = await db.one('hq_config', { eq: { key: PHs.CLE } }).catch(function () { return null; });
    if (!ph) await PHs.ecrire(db, 'test', 'migration');
    // y compris ceux dont le premier email attendait déjà dans la file : il est annulé
    const devinees = await db.select('hq_leads', { select: 'id,phone,reason,status', eq: { email_source: 'devine' }, in: { status: ['a_contacter', 'brouillon'] }, limit: 2000 }).catch(function () { return []; });
    for (const l of devinees) {
      await db.update('hq_leads', { status: l.phone ? 'a_appeler' : 'sans_contact', reason: String('Adresse email devinée, pas vue sur son site. ' + (l.reason || '')).slice(0, 300), updated_at: nowIso() }, { eq: { id: l.id, status: l.status } });
      await db.update('hq_outbox', { status: 'annule', error: 'adresse devinée : jamais de premier email', updated_at: nowIso() }, { eq: { lead_id: l.id, kind: 'prospection', status: 'pret' } }).catch(function () { return null; });
    }
    await db.insert('hq_messages', { from_id: 'chef_prod', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: 'Nouveau moteur des sites : phase de test', body: 'Les aperçus se refont sur la bibliothèque de rubriques (animations, fonds travaillés, photos enfin posées par Léa) et Miranda les critique un à un. Aucun premier email ni relance ne part pendant le test ; les réponses aux conversations continuent. ' + (devinees.length ? devinees.length + ' prospect(s) à adresse devinée passent en appel. ' : '') + 'Quand les sites te plaisent : la tour, Novalemo, Sites en test, « Lancer l\'envoi ».' }, { returning: false });
  }
  if (version === 0) {
    await db.insert('hq_proposals', PROPOSALS.map(function (p) { return Object.assign({ avis: [], details: {} }, p); }), { returning: false });
    await db.insert('hq_messages', { from_id: 'systeme', to_id: null, company_id: 'groupe', kind: 'evenement', subject: 'Fondation du groupe LEXONOS', body: AGENTS.length + ' agents, ' + COMPANIES.filter(function (c) { return c.status === 'active'; }).length + ' entités actives, ' + PROPOSALS.length + ' projets d\'entreprises soumis à Louis. Les premiers passages démarrent.' }, { returning: false });
    if (!(await db.one('hq_config', { eq: { key: 'budget' } }))) await db.insert('hq_config', { key: 'budget', value: BUDGET_DEFAUT }, { returning: false });
  }
  await db.upsert('hq_config', { key: 'seed', value: { version: SEED_VERSION, le: nowIso() }, updated_at: nowIso() }, { onConflict: 'key' });
  return { seme: true, agents: lignes.length, entreprises: nouvellesC.length };
}

/* ── état du groupe ── */
async function charger(db) {
  const [cfgs, companies, agents, jour] = await Promise.all([
    db.select('hq_config', { in: { key: ['budget'] } }),
    db.select('hq_companies', { order: 'floor_order.asc' }),
    db.select('hq_agents', { order: 'seat.asc' }),
    db.one('hq_daily', { eq: { day: jourGP() } })
  ]);
  const b = cfgs.find(function (c) { return c.key === 'budget'; });
  const budget = Object.assign({}, BUDGET_DEFAUT, (b && b.value) || {});
  const env = {
    db: db, companies: companies, agents: agents, budget: budget,
    depense: Number((jour && jour.cost_usd) || 0), recherches: (jour && jour.searches) || 0, places: (jour && jour.places) || 0
  };
  // Novalemo passe en premier : les autres entreprises s'arrêtent à 60 % du plafond du jour
  env.peutDepenser = function (agent) { const plafond = Number(budget.jour_usd || 0); return env.depense < (agent && agent.company_id !== 'novalemo' ? 0.6 * plafond : plafond); };
  env.budgetEtat = { depense: env.depense, plafond: Number(budget.jour_usd || 0), envoi_auto: !!budget.envoi_auto };
  return env;
}

/* ── un agent a-t-il quelque chose d'utile à faire ? (sinon on ne paie pas) ── */
async function aDuTravail(db, agent, c) {
  if (c.neuf > 0) return { oui: true };
  const depuis = agent.last_run_at ? Date.now() - new Date(agent.last_run_at).getTime() : Infinity;
  if (RANG[agent.tier] >= 1) {
    if (!agent.last_run_at || depuis > 24 * 3600000 || agent.tier === 'rh') return { oui: true };
    return { oui: false, raison: 'Rien de neuf depuis mon dernier passage, je repasse plus tard.' };
  }
  if (agent.id === 'redacteur') {
    const q = { eq: { status: 'a_contacter' } };
    if (require('./sites/vercel').branche()) q.in = { apercu_etat: ['publie', 'echec'] };
    return (await db.count('hq_leads', q)) > 0 ? { oui: true } : { oui: false, raison: 'Aucun prospect prêt à contacter (les aperçus se fabriquent).' };
  }
  if (agent.id === 'relanceur') return (await db.count('hq_outbox', { eq: { status: 'envoye' }, lte: { sent_at: new Date(Date.now() - 4 * 86400000).toISOString() } })) > 0 ? { oui: true } : { oui: false, raison: 'Aucun email envoyé à relancer.' };
  if (agent.id === 'scenariste') return (await db.count('hq_items', { eq: { company_id: 'studio3d', kind: 'idee', status: 'nouveau' } })) > 0 ? { oui: true } : { oui: false, raison: 'Pas d\'idée nouvelle à scénariser.' };
  if (agent.id === 'analyste') return (await db.count('hq_leads', {})) > 0 ? { oui: true } : { oui: false, raison: 'Pas encore de prospects à analyser.' };
  if (agent.id === 'reponses') return (await db.count('hq_inbox', { eq: { status: 'nouveau', kind: 'reponse' } })) > 0 ? { oui: true } : { oui: false, raison: 'Aucune réponse de prospect à traiter.' };
  // la responsable de l'écriture ne relit que s'il y a assez de messages partis depuis son dernier passage
  if (agent.id === 'plume') {
    const n = await db.count('hq_outbox', { eq: { status: 'envoye' }, in: { kind: ['prospection', 'relance', 'reponse'] }, gte: { sent_at: agent.last_run_at || '1970-01-01T00:00:00.000Z' } });
    return n >= 8 ? { oui: true } : { oui: false, raison: 'Pas assez de messages partis depuis mon dernier passage pour juger (' + n + ').' };
  }
  return { oui: true };
}

function limiterJson(x) {
  if (x == null) return null;
  try { const s = JSON.stringify(x); return s.length <= 20000 ? x : { tronque: true, extrait: s.slice(0, 20000) }; } catch (e) { return null; }
}

async function message(db, m) { await db.insert('hq_messages', Object.assign({ kind: 'rapport' }, m, { body: nettoie(court(m.body, 4000)) }), { returning: false }); }

/* ── le passage d'un agent ── */
async function tourAgent(env, agent) {
  const db = env.db;
  const t0 = new Date();
  const compteurs = { items: 0, leads: 0, emails: 0, messages: 0, places: 0 };
  await db.update('hq_agents', { status: 'working', current_task: 'Au travail', updated_at: t0.toISOString() }, { eq: { id: agent.id } });
  const res = { resume: '', cout: 0, usage: null, ok: true, log: null, modele: null, prochain: null, skip: false, produit: 0 };
  try {
    if (agent.kind === 'job') {
      const job = JOBS[agent.job];
      if (!job) throw new Error('travail inconnu : ' + agent.job);
      const r = await job.run({ db: db, agent: agent, agents: env.agents, budget: env.budget, limite: env.limite, compteurs: compteurs, peutDepenser: function () { return env.peutDepenser(agent); } });
      res.resume = r.resume; res.cout = r.cout || 0; res.usage = r.usage || null; res.modele = r.modele || null; res.prochain = r.prochain_min || null; res.log = r.detail || null; res.produit = r.produit || 0;
      if (r.erreur) res.ok = false;
      if ((r.produit > 0 || r.erreur) && agent.parent_id) {
        const det = r.detail && typeof r.detail === 'object' ? Object.keys(r.detail).map(function (k) { const v = r.detail[k]; return k + ' : ' + (Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : v); }).join('\n') : '';
        await message(db, { from_id: agent.id, to_id: agent.parent_id, company_id: agent.company_id, kind: r.erreur ? 'alerte' : 'rapport', subject: court(r.resume, 110), body: r.resume + (det ? '\n\n' + det : '') });
        compteurs.messages++;
      }
    } else if (agent.kind === 'llm') {
      if (!env.peutDepenser(agent)) {
        res.skip = true; res.resume = 'Budget IA du jour atteint : je reprends demain.';
        res.prochain = Math.max(30, Math.round((minuitGP(new Date(Date.now() + 86400000)).getTime() + 6 * 3600000 - Date.now()) / 60000));
      } else {
        const c = await construire(db, agent, env.agents, env.companies, env.budgetEtat);
        const travail = await aDuTravail(db, agent, c);
        if (!travail.oui) { res.skip = true; res.resume = travail.raison; }
        else {
          const ctxT = { db: db, agent: agent, agents: env.agents, company: env.companies.find(function (x) { return x.id === agent.company_id; }), budget: env.budget, compteurs: compteurs, lirePage: lirePage, peutDepenser: function () { return env.peutDepenser(agent); } };
          const restantes = Math.max(0, (env.budget.recherches_jour || 0) - env.recherches);
          const web = agent.stats && agent.stats.web ? Math.min(agent.stats.web, restantes) : 0;
          const r = await converse({
            tier: MODELS[agent.model] ? agent.model : 'fast', system: c.system, messages: [{ role: 'user', content: c.user }],
            tools: definitions(agent.tools || []), executors: executeurs(ctxT), webSearch: web > 0 ? { max_uses: web } : null,
            maxTokens: agent.model === 'smart' ? 3000 : 2200, maxSteps: RANG[agent.tier] >= 3 ? 9 : 7, maxCout: agent.model === 'smart' ? 0.25 : 0.06
          });
          res.resume = nettoie((r.fin && r.fin.resume) || court(r.texte, 300) || 'Passage terminé.');
          res.prochain = r.fin && r.fin.prochain_passage_min;
          res.cout = r.cout + (compteurs.cout || 0); res.usage = r.usage; res.modele = r.model; res.log = r.log;
          res.produit = compteurs.items + compteurs.emails + compteurs.leads;
          env.recherches += r.usage.searches;
          if (c.lus.length) await db.update('hq_messages', { read_at: nowIso() }, { in: { id: c.lus } });
        }
      }
    }
  } catch (e) {
    res.ok = false;
    res.resume = 'Erreur : ' + court(String(e.message || e), 300);
  }
  const fin = new Date();
  env.depense += res.cout || 0;
  env.budgetEtat.depense = env.depense;
  if (!res.skip) {
    await db.insert('hq_runs', {
      agent_id: agent.id, started_at: t0.toISOString(), ended_at: fin.toISOString(), model: res.modele, ok: res.ok,
      tokens_in: res.usage ? res.usage.in + res.usage.cacheWrite + res.usage.cacheRead : 0, tokens_out: res.usage ? res.usage.out : 0, cache_read: res.usage ? res.usage.cacheRead : 0,
      searches: res.usage ? res.usage.searches : 0, cost_usd: Math.round((res.cout || 0) * 100000) / 100000, summary: court(res.resume, 500), log: limiterJson(res.log)
    }, { returning: false }).catch(function () { /* journal best-effort */ });
  }
  await db.rpc('hq_bump', { p_day: jourGP(), p_cost: res.cout || 0, p_runs: res.skip ? 0 : 1, p_searches: res.usage ? res.usage.searches : 0, p_places: compteurs.places, p_leads: compteurs.leads, p_emails: compteurs.emails, p_items: compteurs.items }).catch(function () {});
  let dans = res.prochain ? Math.max(10, Math.min(10080, Number(res.prochain))) : (agent.cadence_min || 1440);
  if (!res.ok) dans = Math.min(dans, 90);
  const stats = Object.assign({}, agent.stats || {});
  if (!res.skip) { stats.runs = (stats.runs || 0) + 1; stats.cout = Math.round(((stats.cout || 0) + (res.cout || 0)) * 10000) / 10000; stats.produit = (stats.produit || 0) + (res.produit || 0); }
  const patch = { status: res.ok ? 'idle' : 'error', current_task: court(res.resume, 400), next_run_at: new Date(Date.now() + dans * 60000).toISOString(), stats: stats, updated_at: nowIso() };
  if (!res.skip) patch.last_run_at = fin.toISOString();
  await db.update('hq_agents', patch, { eq: { id: agent.id } });
  Object.assign(agent, patch);
  return { id: agent.id, nom: agent.name, resume: res.resume, cout: res.cout || 0, ok: res.ok, saute: res.skip };
}

/* ── un cycle ── */
function estDu(a, maintenant) {
  if (a.kind === 'attente' || a.status === 'paused' || a.status === 'attente') return false;
  if (a.status === 'working') return a.updated_at && (Date.now() - new Date(a.updated_at).getTime()) > 15 * 60000; // passage planté
  return a.next_run_at && new Date(a.next_run_at).getTime() <= maintenant;
}

// Verrous à jeton (le jeton empêche d'effacer le verrou d'un autre) ; base sans la nouvelle signature : ancien appel
async function verrouiller(db, nom, secondes, jeton) {
  try { return await db.rpc('hq_lock', { p_name: nom, p_seconds: secondes, p_owner: jeton }); }
  catch (e) { if (/function|hq_lock/i.test(String(e.message))) return db.rpc('hq_lock', { p_name: nom, p_seconds: secondes }); throw e; }
}
async function deverrouiller(db, nom, jeton) {
  try { await db.rpc('hq_unlock', { p_name: nom, p_owner: jeton }); }
  catch (e) { await db.rpc('hq_unlock', { p_name: nom }).catch(function () {}); }
}

async function cycle(opts) {
  opts = opts || {};
  const db = opts.db || open();
  if (!db) return { ok: false, demo: true, raison: 'Base non branchée (HQ_SUPABASE_KEY absente).' };
  const t0 = Date.now();
  const limite = t0 + (opts.secondes || CYCLE_SECONDES) * 1000;
  // verrou plus long que la limite de la fonction (300 s), à jeton : un passage arrêté le libère en expirant, un passage
  // en retard n'efface jamais celui d'un autre
  // le passage express de WhatsApp a son propre verrou : il ne bloque jamais le cycle des 15 minutes (ni l'inverse)
  const nomVerrou = opts.verrou || 'cycle';
  const jeton = require('crypto').randomBytes(8).toString('hex');
  const verrou = await verrouiller(db, nomVerrou, Math.max(320, (opts.secondes || CYCLE_SECONDES) + 70), jeton);
  if (!verrou) return { ok: true, occupe: true, raison: 'Un passage est déjà en cours.' };
  const passages = [];
  let envoi = null, seme = null, releve = null;
  try {
    seme = await semer(db);
    const env = await charger(db);
    env.limite = limite;
    const maintenant = Date.now();
    let file;
    if (opts.agentId) file = env.agents.filter(function (a) { return a.id === opts.agentId && a.kind !== 'attente'; });
    else file = env.agents.filter(function (a) { return estDu(a, opts.manuel ? maintenant + 30 * 60000 : maintenant); }).sort(function (x, y) {
      const jx = x.kind === 'job' ? -1 : 0, jy = y.kind === 'job' ? -1 : 0;
      return (jx - jy) || (RANG[x.tier] - RANG[y.tier]) || (new Date(x.next_run_at || 0) - new Date(y.next_run_at || 0));
    });
    let k = 0;
    async function ouvrier() {
      while (k < file.length) {
        const a = file[k++];
        const marge = a.kind === 'job' ? 45000 : 80000;
        if (Date.now() > limite - marge) break;
        // Emma peut tourner dans les deux passages (15 minutes et WhatsApp) : jamais deux fois en même temps
        if (EXCLUSIFS.indexOf(a.id) >= 0) {
          const ja = require('crypto').randomBytes(8).toString('hex');
          if (!(await verrouiller(db, 'agent:' + a.id, Math.max(120, Math.round((limite - Date.now()) / 1000) + 60), ja))) continue;
          try { passages.push(await tourAgent(env, a)); } finally { await deverrouiller(db, 'agent:' + a.id, ja); }
          continue;
        }
        passages.push(await tourAgent(env, a));
      }
    }
    await Promise.all(Array(Math.min(AGENTS_EN_PARALLELE, Math.max(1, file.length))).fill(0).map(ouvrier));
    if (!opts.agentId && Date.now() < limite - 40000) {
      try { releve = await BOITE.releve({ db: db }); } catch (e) { releve = { resume: 'Erreur de relève : ' + e.message }; }
      try { const wa = await require('./jobs/whatsapp').releve({ db: db }); if (wa.nouveaux) releve = Object.assign({}, releve, { whatsapp: wa.resume }); } catch (e) { /* WhatsApp indisponible : relevé au prochain passage */ }
      try { envoi = await ENVOI.run({ db: db, budget: env.budget, limite: limite }); } catch (e) { envoi = { resume: 'Erreur d\'envoi : ' + e.message }; }
    }
    return { ok: true, seme: seme, passages: passages, depense_jour: Math.round(env.depense * 1000) / 1000, releve: releve, envoi: envoi, duree_s: Math.round((Date.now() - t0) / 1000) };
  } finally {
    await deverrouiller(db, nomVerrou, jeton);
  }
}
const EXCLUSIFS = ['reponses'];

module.exports = { cycle, semer, charger, tourAgent, aDuTravail, estDu, sieges, JOBS, verrouiller, deverrouiller };
