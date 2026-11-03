// Simulation complète sans réseau : base en mémoire, Claude simulé, Google/GitHub/Afnic/annuaire simulés.
// Lance : node test/sim.js
'use strict';
process.env.ANTHROPIC_API_KEY = 'test';
process.env.GOOGLE_MAPS_API_KEY = 'test';
delete process.env.HQ_SUPABASE_KEY;

const assert = require('assert');
const fakes = require('./fakes');
const DB = require('../lib/db');
const db = DB.memory();
DB.forcer(db);

const runtime = require('../lib/runtime');
const world = require('../lib/world');
const { agir } = require('../lib/actions');

(async function () {
  const t0 = Date.now();
  // 1. fondation
  const s = await runtime.semer(db);
  assert.ok(s.seme, 'la fondation doit se faire');
  assert.strictEqual(db.tables.hq_agents.length, require('../lib/seed').AGENTS.length);
  assert.ok(db.tables.hq_agents.every(function (a) { return a.parent_id === null ? a.id === 'pdg' : true; }), 'tout le monde a un chef sauf le PDG');
  console.log('Fondation :', db.tables.hq_agents.length, 'agents,', db.tables.hq_companies.length, 'entreprises,', db.tables.hq_proposals.length, 'propositions');

  // 2. tout le monde dû maintenant
  db.tables.hq_agents.forEach(function (a) { if (a.kind !== 'attente') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
  const c1 = await runtime.cycle({ db: db, secondes: 250 });
  assert.ok(c1.ok, 'cycle ok');
  console.log('Cycle 1 :', c1.passages.length, 'passages, dépense', c1.depense_jour, '$, appels Claude', fakes.appels());
  c1.passages.forEach(function (p) { console.log('  -', p.nom.padEnd(11), p.ok ? 'ok ' : 'ERR', p.saute ? '(sauté)' : '', '|', p.resume.slice(0, 120)); });

  const leads = db.tables.hq_leads || [];
  console.log('Prospects :', leads.length, JSON.stringify(leads.reduce(function (o, l) { o[l.status] = (o[l.status] || 0) + 1; return o; }, {})));
  assert.ok(leads.some(function (l) { return l.source === 'maps'; }), 'des prospects Google Maps');
  assert.ok(!leads.some(function (l) { return /carrefour/i.test(l.name); }), 'les enseignes sont écartées');
  assert.ok(leads.some(function (l) { return l.source === 'domaines'; }), 'un prospect nouveau domaine');
  assert.ok(leads.some(function (l) { return l.source === 'registre' && /SOLAIRE/.test(l.name); }), 'une création BODACC');
  assert.ok(!leads.some(function (l) { return /SCI DES PALMIERS/.test(l.name); }), 'les SCI sont écartées');

  // 3. deuxième cycle : la rédactrice a des contacts
  db.tables.hq_agents.forEach(function (a) { if (a.id === 'redacteur' || a.id === 'contacts') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
  const c2 = await runtime.cycle({ db: db, secondes: 250 });
  c2.passages.forEach(function (p) { console.log('  -', p.nom.padEnd(11), p.ok ? 'ok ' : 'ERR', p.saute ? '(sauté)' : '', '|', p.resume.slice(0, 120)); });
  const outbox = db.tables.hq_outbox || [];
  console.log('Brouillons :', outbox.length, outbox[0] ? '| ' + outbox[0].subject + ' -> ' + outbox[0].to_email : '');
  assert.ok(outbox.length >= 1, 'au moins un brouillon');
  assert.ok(outbox.every(function (o) { return /STOP/.test(o.body) && o.status === 'a_valider'; }), 'STOP ajouté, en attente de Louis');

  const items = db.tables.hq_items || [];
  console.log('Livrables :', items.length, JSON.stringify(items.reduce(function (o, i) { o[i.kind] = (o[i.kind] || 0) + 1; return o; }, {})));
  assert.ok(items.some(function (i) { return i.kind === 'reference' && i.status === 'valide'; }), 'références vérifiées');
  assert.ok(items.some(function (i) { return i.kind === 'repo'; }), 'fiche GitHub');

  // 4. Louis valide un projet d'entreprise, le PDG l'exécute
  const p = db.tables.hq_proposals.find(function (x) { return x.title === 'Créer Conformité Web'; });
  await agir('decider', { id: p.id, decision: 'valider', note: 'Go, prix OK.' });
  const c3 = await runtime.cycle({ db: db, agentId: 'pdg', secondes: 200 });
  console.log('Cycle PDG :', c3.passages.map(function (x) { return x.resume; }).join(' | '));
  const conf = db.tables.hq_companies.find(function (c) { return c.id === 'conformite'; });
  assert.strictEqual(conf.status, 'active', 'Conformité Web devient active');
  assert.ok(db.tables.hq_agents.some(function (a) { return a.company_id === 'conformite' && a.origin === 'cree_par_agent'; }), 'un DG recruté par le PDG');

  // 5. garde-fous : un DG ne peut pas valider une dépense
  const tools = require('../lib/tools');
  const env = await runtime.charger(db);
  const dg = env.agents.find(function (a) { return a.id === 'dg_ecom'; });
  const pr = await db.insert('hq_proposals', { company_id: 'ecom', from_id: 'dircom_ecom', kind: 'depense', title: 'Test pub 200 €', justification: 'test', status: 'ouverte' });
  const ex = tools.executeurs({ db: db, agent: dg, agents: env.agents, budget: env.budget, compteurs: { items: 0, leads: 0, emails: 0, messages: 0, places: 0 }, lirePage: async function () { return {}; } });
  const r = await ex.decider({ proposition_id: pr[0].id, decision: 'valider', note: 'ok' });
  assert.ok(/Louis/.test(r), 'une dépense part chez Louis');
  const r2 = await ex.assigner({ a: 'dg_novalemo', titre: 'x', consigne: 'y' });
  assert.ok(r2.erreur, 'un DG ne commande pas un autre DG');
  const r3 = await ex.assigner({ a: 'sourcing', titre: 'x', consigne: 'y' });
  assert.ok(r3.erreur && /attend/.test(r3.erreur), 'on n\'assigne pas un agent en attente');

  // 6. le monde vu par l'interface
  const w = await world.monde(null);
  assert.ok(!w.demo && w.agents.length > 40 && w.messages.length > 0);
  console.log('Monde :', w.companies.filter(function (c) { return c.status === 'active'; }).map(function (c) { return c.name + ' x' + c.floors; }).join(', '), '|', w.messages.length, 'messages |', w.proposals.length, 'propositions | jour', JSON.stringify(w.jour));
  const fa = await world.ficheAgent('redacteur');
  assert.ok(fa.agent && fa.runs.length >= 1);
  const fe = await world.ficheEntreprise('novalemo');
  assert.ok(fe.stats && fe.stats.prospects);

  // 7. budget épuisé = plus aucun appel Claude
  await agir('budget', { jour_usd: 0 });
  const avant = fakes.appels();
  db.tables.hq_agents.forEach(function (a) { if (a.kind === 'llm') { a.next_run_at = new Date(Date.now() - 60000).toISOString(); a.status = 'idle'; } });
  const c4 = await runtime.cycle({ db: db, secondes: 250 });
  assert.strictEqual(fakes.appels(), avant, 'plafond respecté');
  console.log('Plafond à 0 :', c4.passages.filter(function (x) { return x.saute; }).length, 'passages sautés, 0 appel Claude');

  // 8. mode démo (sans base)
  DB.forcer(null);
  const d = await world.monde(null);
  assert.ok(d.demo && d.agents.length === require('../lib/seed').AGENTS.length);
  console.log('Démo OK. Tout est vert en', Math.round((Date.now() - t0) / 100) / 10, 's');
})().catch(function (e) { console.error('ÉCHEC :', e); process.exit(1); });
