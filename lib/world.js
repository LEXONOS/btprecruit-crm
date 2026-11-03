// Ce que voit l'interface : le monde (entreprises, agents, fil, propositions, chiffres) et les fiches détaillées.
'use strict';
const { open, BaseManquante } = require('./db');
const { COMPANIES, AGENTS, PROPOSALS } = require('./seed');
const { BUDGET_DEFAUT, SEED_VERSION } = require('./config');
const { semer, sieges } = require('./runtime');
const { stats } = require('./stats');
const { jourGP, court } = require('./util');

const CHAMPS_AGENT = 'id,company_id,parent_id,name,title,tier,kind,job,model,mission,status,current_task,waiting_for,last_run_at,next_run_at,seat,score,stats,cadence_min,origin,created_at';

function etages(companies, agents) {
  return companies.map(function (c) {
    const n = agents.filter(function (a) { return a.company_id === c.id; }).length;
    return Object.assign({}, c, { context: undefined, agents_count: n, floors: c.status === 'active' ? Math.max(1, Math.ceil(n / 10)) : 0 });
  });
}

function mondeDemo(raison) {
  const seat = sieges(AGENTS);
  const companies = COMPANIES.map(function (c) { return Object.assign({ created_at: null }, c); });
  const agents = AGENTS.map(function (a) {
    return { id: a.id, company_id: a.company_id, parent_id: a.parent_id, name: a.name, title: a.title, tier: a.tier, kind: a.kind, job: a.job || null, model: a.model, mission: a.mission, status: a.kind === 'attente' ? 'attente' : 'idle', current_task: null, waiting_for: a.waiting_for || null, last_run_at: null, next_run_at: null, seat: seat[a.id], score: null, stats: {}, cadence_min: a.cadence_min, origin: 'fondation' };
  });
  return {
    demo: true, raison: raison, groupe: { name: 'LEXONOS' },
    companies: etages(companies, agents), agents: agents,
    messages: [{ id: 0, from_id: 'systeme', to_id: null, kind: 'evenement', subject: 'Mode démo', body: 'La base n\'est pas encore branchée : tu vois l\'organisation réelle, mais personne ne travaille encore.', created_at: new Date().toISOString() }],
    proposals: PROPOSALS.map(function (p, k) { return Object.assign({ id: k + 1, avis: [], created_at: new Date().toISOString() }, p); }),
    budget: BUDGET_DEFAUT, jour: { cost_usd: 0, runs: 0, leads: 0, emails: 0, items: 0 }, historique: [],
    compteurs: { prospects: 0, a_contacter: 0, brouillons: 0, envoyes: 0, livrables: 0 }, maintenant: new Date().toISOString()
  };
}

async function monde(since) {
  const db = open();
  if (!db) return mondeDemo('cle');
  try {
    await semer(db);
    const depuis14 = jourGP(new Date(Date.now() - 14 * 86400000));
    const [companies, agents, messages, props, cfg, hist, leads, outbox, nbItems] = await Promise.all([
      db.select('hq_companies', { order: 'floor_order.asc' }),
      db.select('hq_agents', { select: CHAMPS_AGENT, order: 'seat.asc' }),
      since ? db.select('hq_messages', { gt: { id: since }, order: 'id.asc', limit: 80 }) : db.select('hq_messages', { order: 'id.desc', limit: 60 }),
      db.select('hq_proposals', { in: { status: ['ouverte', 'a_louis', 'validee'] }, order: 'id.desc', limit: 40 }),
      db.select('hq_config', { in: { key: ['budget', 'groupe'] } }),
      db.select('hq_daily', { gte: { day: depuis14 }, order: 'day.asc' }),
      db.select('hq_leads', { select: 'status', limit: 6000 }),
      db.select('hq_outbox', { select: 'status', limit: 6000 }),
      db.count('hq_items', {})
    ]);
    const b = cfg.find(function (c) { return c.key === 'budget'; });
    const g = cfg.find(function (c) { return c.key === 'groupe'; });
    const nb = function (rows, s) { return rows.filter(function (r) { return r.status === s; }).length; };
    const today = hist.find(function (h) { return h.day === jourGP(); }) || { cost_usd: 0, runs: 0, leads: 0, emails: 0, items: 0 };
    return {
      demo: false, groupe: { name: (g && g.value && g.value.name) || 'LEXONOS' },
      companies: etages(companies, agents), agents: agents,
      messages: (since ? messages : messages.reverse()).map(function (m) { return Object.assign({}, m, { body: court(m.body, 900) }); }),
      proposals: props, budget: Object.assign({}, BUDGET_DEFAUT, (b && b.value) || {}), jour: today, historique: hist,
      compteurs: { prospects: leads.length, a_contacter: nb(leads, 'a_contacter'), a_appeler: nb(leads, 'a_appeler'), brouillons: nb(outbox, 'a_valider'), prets: nb(outbox, 'pret'), envoyes: nb(outbox, 'envoye'), livrables: nbItems },
      maintenant: new Date().toISOString(), seed: SEED_VERSION
    };
  } catch (e) {
    if (e instanceof BaseManquante) return mondeDemo('tables');
    if (/HQ_SUPABASE_KEY|refusée/i.test(String(e.message))) return mondeDemo('cle_refusee');
    throw e;
  }
}

async function ficheAgent(id) {
  const db = open();
  if (!db) {
    const a = AGENTS.find(function (x) { return x.id === id; });
    return a ? { demo: true, agent: Object.assign({}, a, { playbook: a.playbook, charter: a.charter }), savoir: (a.knowledge || []).map(function (k) { return { content: k, source: 'fondation' }; }), runs: [], messages: [], taches: [], evaluations: [] } : null;
  }
  const [agent, savoir, runs, recus, envoyes, taches, evals] = await Promise.all([
    db.one('hq_agents', { eq: { id: id } }),
    db.select('hq_knowledge', { eq: { agent_id: id }, order: ['weight.desc', 'id.desc'], limit: 30 }),
    db.select('hq_runs', { eq: { agent_id: id }, order: 'id.desc', limit: 15, select: 'id,started_at,ended_at,model,cost_usd,ok,summary,searches,tokens_in,tokens_out,log' }),
    db.select('hq_messages', { eq: { to_id: id }, order: 'id.desc', limit: 15 }),
    db.select('hq_messages', { eq: { from_id: id }, order: 'id.desc', limit: 15 }),
    db.select('hq_tasks', { eq: { agent_id: id }, order: 'id.desc', limit: 10 }),
    db.select('hq_items', { eq: { kind: 'evaluation' }, order: 'id.desc', limit: 40, select: 'id,title,body,score,data,created_at,agent_id' })
  ]);
  if (!agent) return null;
  const messages = recus.concat(envoyes).sort(function (a, b) { return b.id - a.id; }).slice(0, 20).map(function (m) { return Object.assign({}, m, { body: court(m.body, 1200) }); });
  return { agent: agent, savoir: savoir, runs: runs, messages: messages, taches: taches, evaluations: evals.filter(function (e) { return e.data && e.data.cible === id; }).slice(0, 5) };
}

async function ficheEntreprise(id) {
  const db = open();
  if (!db) { const c = COMPANIES.find(function (x) { return x.id === id; }); return c ? { demo: true, company: c, stats: null, livrables: [], leads: [], outbox: [] } : null; }
  const company = await db.one('hq_companies', { eq: { id: id } });
  if (!company) return null;
  const agents = await db.select('hq_agents', { select: CHAMPS_AGENT });
  const [st, livrables] = await Promise.all([
    company.status === 'active' ? stats(db, agents, id) : Promise.resolve(null),
    db.select('hq_items', { eq: { company_id: id }, order: 'id.desc', limit: 25, select: 'id,agent_id,kind,title,body,status,score,data,created_at' })
  ]);
  return { company: company, stats: st, livrables: livrables.map(function (l) { return Object.assign({}, l, { body: court(l.body, 1500) }); }) };
}

async function liste(op, q) {
  const db = open();
  if (!db) return { demo: true, rows: [] };
  const limite = Math.min(200, Number(q.limite) || 60);
  if (op === 'leads') {
    const f = { order: ['score.desc', 'id.desc'], limit: limite };
    if (q.statut) f.eq = { status: q.statut };
    return { rows: await db.select('hq_leads', f) };
  }
  if (op === 'outbox') {
    const f = { order: 'id.desc', limit: limite };
    if (q.statut) f.eq = { status: q.statut };
    const rows = await db.select('hq_outbox', f);
    const ids = rows.map(function (r) { return r.lead_id; }).filter(Boolean);
    const leads = ids.length ? await db.select('hq_leads', { select: 'id,name,sector,commune,island,website,site_state,score,source', in: { id: ids } }) : [];
    return { rows: rows.map(function (r) { return Object.assign({}, r, { lead: leads.find(function (l) { return l.id === r.lead_id; }) || null }); }) };
  }
  if (op === 'livrables') {
    const f = { order: 'id.desc', limit: limite, eq: {} };
    if (q.type) f.eq.kind = q.type;
    if (q.entreprise) f.eq.company_id = q.entreprise;
    return { rows: await db.select('hq_items', f) };
  }
  if (op === 'runs') return { rows: await db.select('hq_runs', { order: 'id.desc', limit: limite, select: 'id,agent_id,started_at,model,cost_usd,ok,summary,searches' }) };
  return { rows: [] };
}

module.exports = { monde, mondeDemo, ficheAgent, ficheEntreprise, liste };
