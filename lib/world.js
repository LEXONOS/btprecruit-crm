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

// Chiffre d'affaires encaissé : prix payé en une fois, ou mensualités réellement payées pour un abonnement
const PAYES = ['paye', 'livraison', 'en_ligne', 'pause'];
function aboActif(x) { return PAYES.indexOf(x.status) >= 0 && x.data && x.data.abonnement && x.data.abonnement.statut === 'active' && !x.data.abonnement.resiliation_demandee; }
function caDe(sites) {
  return sites.filter(function (x) { return PAYES.indexOf(x.status) >= 0; }).reduce(function (t, x) {
    const d = x.data || {};
    const abos = [].concat(d.abonnement ? [d.abonnement] : [], d.abonnements_finis || []);
    return t + (abos.length ? abos.reduce(function (u, a) { return u + Number(a.paye_eur || 0); }, 0) : Number(x.montant_eur || 0));
  }, 0);
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
    const [companies, agents, messages, props, cfg, hist, leads, outbox, nbItems, inbox, sitesRows, cfgVente, runsJour, phase] = await Promise.all([
      db.select('hq_companies', { order: 'floor_order.asc' }),
      db.select('hq_agents', { select: CHAMPS_AGENT, order: 'seat.asc' }),
      since ? db.select('hq_messages', { gt: { id: since }, order: 'id.asc', limit: 80 }) : db.select('hq_messages', { order: 'id.desc', limit: 60 }),
      db.select('hq_proposals', { in: { status: ['ouverte', 'a_louis', 'validee'] }, order: 'id.desc', limit: 40 }),
      db.select('hq_config', { in: { key: ['budget', 'groupe'] } }),
      db.select('hq_daily', { gte: { day: depuis14 }, order: 'day.asc' }),
      db.select('hq_leads', { select: 'status', limit: 6000 }),
      db.select('hq_outbox', { select: 'status,kind', limit: 6000 }),
      db.count('hq_items', {}),
      db.select('hq_inbox', { select: 'status', eq: { kind: 'reponse' }, in: { status: ['nouveau', 'brouillon'] }, limit: 2000 }).catch(function () { return []; }),
      db.select('hq_sites', { select: 'status,version,montant_eur,data', limit: 6000 }).catch(function () { return []; }),
      db.select('hq_config', { in: { key: ['identite', 'publication'] } }).catch(function () { return []; }),
      db.select('hq_runs', { select: 'agent_id,cost_usd', gte: { started_at: require('./util').minuitGP().toISOString() }, limit: 5000 }).catch(function () { return []; }),
      require('./sites/phase').lire(db).catch(function () { return { phase: 'envoi' }; })
    ]);
    const sites = sitesRows || [];
    const b = cfg.find(function (c) { return c.key === 'budget'; });
    const g = cfg.find(function (c) { return c.key === 'groupe'; });
    const nb = function (rows, s) { return rows.filter(function (r) { return r.status === s; }).length; };
    const today = hist.find(function (h) { return h.day === jourGP(); }) || { cost_usd: 0, runs: 0, leads: 0, emails: 0, items: 0 };
    // la part du budget du jour de chaque entreprise, et ce qu'elle en a pris (voir runtime : les parts)
    const budget = Object.assign({}, BUDGET_DEFAUT, (b && b.value) || {});
    const parts = Object.assign({}, require('./runtime').PARTS, budget.parts || {});
    const parSociete = {};
    (runsJour || []).forEach(function (x) { const a = agents.find(function (y) { return y.id === x.agent_id; }); const co = (a && a.company_id) || 'groupe'; parSociete[co] = (parSociete[co] || 0) + (Number(x.cost_usd) || 0); });
    budget.societes = companies.filter(function (c) { return parSociete[c.id] || parts[c.id] !== undefined; }).map(function (c) { return { id: c.id, nom: c.name, depense: Math.round((parSociete[c.id] || 0) * 1000) / 1000, part: parts[c.id] !== undefined ? parts[c.id] : require('./runtime').PART_AUTRES }; });
    const joignables = leads.filter(function (r) { return ['a_contacter', 'a_appeler', 'brouillon', 'contacte', 'relance', 'repondu', 'interesse', 'client', 'perdu'].indexOf(r.status) >= 0; }).length;
    // prêts à partir : la note de Miranda sur la version en ligne au seuil d'envoi (6 sur 10 par défaut), ou validés
    const CRw = require('./jobs/critique');
    const valides = sites.filter(function (x) { const c = x.data && x.data.critique; return ['apercu', 'commande'].indexOf(x.status) >= 0 && c && CRw.peutPartir(x, budget).ok; }).length;
    return {
      demo: false, groupe: { name: (g && g.value && g.value.name) || 'LEXONOS' },
      companies: etages(companies, agents), agents: agents,
      messages: (since ? messages : messages.reverse()).map(function (m) { return Object.assign({}, m, { body: court(m.body, 900) }); }),
      proposals: props, budget: budget, jour: today, historique: hist, phase: (phase && phase.phase) || 'envoi',
      compteurs: { prospects: leads.length, joignables: joignables, valides: valides, a_contacter: nb(leads, 'a_contacter'), a_appeler: nb(leads, 'a_appeler'), brouillons: outbox.filter(function (r) { return r.status === 'a_valider' && r.kind !== 'reponse'; }).length, prets: nb(outbox, 'pret'), envoyes: nb(outbox, 'envoye'), livrables: nbItems, reponses: inbox.length, interesses: nb(leads, 'interesse'),
        apercus: sites.filter(function (x) { return ['apercu', 'commande'].indexOf(x.status) >= 0; }).length, commandes: nb(sites, 'commande'), clients: sites.filter(function (x) { return ['paye', 'livraison', 'en_ligne', 'pause'].indexOf(x.status) >= 0; }).length, en_ligne: nb(sites, 'en_ligne'),
        ca_eur: Math.round(caDe(sites)), sites: sites.length,
        abonnes: sites.filter(aboActif).length, mrr_eur: sites.filter(aboActif).reduce(function (t, x) { return t + Number(x.data.abonnement.mensualite_eur || 0); }, 0) },
      boite: { branchee: require('./mail').branchee() },
      pilote: (function () { const id = cfgVente.find(function (c) { return c.key === 'identite'; }), pub = cfgVente.find(function (c) { return c.key === 'publication'; }); const b0 = Object.assign({}, BUDGET_DEFAUT, (b && b.value) || {}); return { auto: !!b0.envoi_auto, vercel: require('./sites/vercel').branche(), stripe: require('./sites/stripe').branche(), stripe_test: require('./sites/stripe').modeTest(), identite: !!(id && id.value && require('./jobs/livraison').identiteComplete(id.value)), hote: (pub && pub.value && pub.value.hote) || null }; })(),
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
  if (op === 'inbox') {
    const f = { order: 'id.desc', limit: limite };
    f.eq = q.tous ? {} : { kind: 'reponse' };
    if (q.statut) f.eq.status = q.statut;
    const rows = await db.select('hq_inbox', f).catch(function () { return []; });
    const lids = rows.map(function (r) { return r.lead_id; }).filter(Boolean), oids = rows.map(function (r) { return r.outbox_id; }).filter(Boolean), iids = rows.map(function (r) { return r.id; });
    const [leads, origines, brouillons] = await Promise.all([
      lids.length ? db.select('hq_leads', { select: 'id,name,sector,commune,island,website,site_state,status,phone,score,source', in: { id: lids } }) : [],
      oids.length ? db.select('hq_outbox', { select: 'id,subject,body,step,sent_at', in: { id: oids } }) : [],
      iids.length ? db.select('hq_outbox', { select: 'id,inbox_id,subject,body,status,sent_at,error,agent_id', in: { inbox_id: iids }, not_in: { status: ['annule'] } }) : []
    ]);
    return { rows: rows.map(function (r) { return Object.assign({}, r, { lead: leads.find(function (l) { return l.id === r.lead_id; }) || null, origine: origines.find(function (o) { return o.id === r.outbox_id; }) || null, reponse: brouillons.find(function (b) { return b.inbox_id === r.id; }) || null }); }) };
  }
  if (op === 'sites') {
    const f = { order: 'updated_at.desc', limit: limite, select: 'id,lead_id,slug,status,formule,montant_eur,url_apercu,domaine,domaine_mode,url_finale,revisions,stripe,paid_at,live_at,published_at,created_at,updated_at,version,spec,data' };
    if (q.statut) f.eq = { status: q.statut };
    const rows = await db.select('hq_sites', f).catch(function () { return []; });
    const lids = rows.map(function (r) { return r.lead_id; }).filter(Boolean);
    // l'intérêt du prospect (panneau de son aperçu ouvert, paiement regardé, formule choisie) : seulement ce champ de sa fiche
    const leads = (lids.length ? await db.select('hq_leads', { select: 'id,name,sector,commune,email,status,source,interet:data->interet', in: { id: lids } }) : []).map(function (l) {
      const x = Object.assign({}, l, { interet: l.interet !== undefined ? l.interet : (l.data && l.data.interet) || null });
      delete x.data;
      return x;
    });
    const TP = require('./sites/templates'), RB = require('./sites/rubriques');
    return { rows: rows.map(function (r) {
      const sp = r.spec || {}, st = r.stripe || {}, d = r.data || {};
      const tpl = sp.compo && sp.compo.template ? TP.PAR_ID[sp.compo.template] : null;
      const blocs = sp.compo && Array.isArray(sp.compo.blocs) ? sp.compo.blocs : [];
      return { id: r.id, slug: r.slug, status: r.status, formule: r.formule, montant_eur: r.montant_eur, url_apercu: r.url_apercu, domaine: r.domaine, domaine_mode: r.domaine_mode, url_finale: r.url_finale, revisions: r.revisions, paid_at: r.paid_at, live_at: r.live_at, published_at: r.published_at, created_at: r.created_at, updated_at: r.updated_at,
        nom: sp.nom, activite: sp.activite, commune: sp.commune, ambiance: sp.da && require('./sites/donne').paletteDe(sp.da) ? require('./sites/donne').paletteDe(sp.da).nom.toLowerCase() : null, composition: sp.da ? [sp.da.modele && require('./sites/modeles').MODELES[sp.da.modele] ? require('./sites/modeles').MODELES[sp.da.modele].nom : null, sp.da.hero].filter(Boolean).join(', ') || null : null, photos: (sp.photos || []).length, logo: !!sp.logo,
        paiement: st.url || null, paiement_mois: st.url_mois || null, abonnement: d.abonnement ? { mensualite_eur: d.abonnement.mensualite_eur, statut: d.abonnement.statut, engagement_jusqu_au: d.abonnement.engagement_jusqu_au, arret: !!d.abonnement.resiliation_demandee && !d.abonnement.fin_auto, fin_auto: !!d.abonnement.fin_auto } : null,
        critique: d.critique && d.critique.note != null ? { note: d.critique.note, verdict: d.critique.verdict, resume: d.critique.resume, problemes: (d.critique.problemes || []).slice(0, 4), tours: d.critique.tours, abandon: !!d.critique.abandon, a_jour: d.critique.version === r.version, le: d.critique.le } : null,
        template: tpl ? tpl.nom : null,
        rubriques: ['hero', 'services', 'apropos'].map(function (k) { const b = blocs.find(function (x) { return x.rubrique === k; }); const v = RB.VARIANTES[(b && b.id) || (sp.compo && sp.compo.choix && sp.compo.choix[k])]; return v ? v.nom : null; }).filter(Boolean).join(', ') || null, facture: st.facture_url || null, cout_usd: d.cout_usd || null, problemes: d.problemes || [], lead: leads.find(function (l) { return l.id === r.lead_id; }) || null };
    }) };
  }
  return { rows: [] };
}

module.exports = { monde, mondeDemo, ficheAgent, ficheEntreprise, liste };
