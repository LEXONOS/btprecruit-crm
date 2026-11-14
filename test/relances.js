// Le mode relance du 14 nov. 2026, sans réseau : la fabrication en pause (ni chasse, ni aperçus, ni jugement, l'envoi
// et les réponses continuent), l'aperçu vraiment ouvert par le prospect (un geste, jamais depuis la tour), et la
// migration 21 sur une base comme celle de Louis.
// Lance : node test/relances.js
'use strict';
process.env.HQ_TOUR_PROJET = 'prj_tour'; process.env.HQ_TOUR_EQUIPE = 'team_test';
process.env.HQ_LOCAL = '1';
process.env.ANTHROPIC_API_KEY = 'test';
process.env.GOOGLE_MAPS_API_KEY = 'test';
delete process.env.HQ_AGENTS_ACTIFS;
delete process.env.HQ_SUPABASE_KEY; delete process.env.HQ_VERCEL_TOKEN; delete process.env.VERCEL_TOKEN; delete process.env.HQ_STRIPE_KEY; delete process.env.STRIPE_SECRET_KEY;

const assert = require('assert');
require('./fakes');
const DB = require('../lib/db');
const config = require('../lib/config');
const garde = require('../lib/garde');
const RT = require('../lib/runtime');
const R = require('../lib/sites/retours');

function base() { const db = DB.memory(); DB.forcer(db); garde.oublier(); return db; }
const tous = function (db) { db.tables.hq_agents.forEach(function (a) { if (a.kind !== 'attente') a.next_run_at = new Date(Date.now() - 60000).toISOString(); }); };

(async function () {
  const t0 = Date.now();

  // 1. fabrication coupée par défaut : ni chasse, ni aperçus, ni photos, ni jugement ; l'envoi, les relances, les
  // réponses, les paiements et la mise en ligne passent
  assert.strictEqual(config.BUDGET_DEFAUT.fabrication, false, 'la fabrication est coupée par défaut depuis le 14 nov.');
  let db = base();
  await RT.semer(db);
  tous(db);
  const c1 = await RT.cycle({ db: db, secondes: 250 });
  const ids = c1.passages.map(function (p) { return p.id; });
  assert.ok(c1.ok && ids.length > 0, 'des agents passent : ' + ids.join(', '));
  assert.ok(ids.every(function (id) { return config.FABRICATION.indexOf(id) < 0; }), 'aucun agent de la fabrication ne passe : ' + ids.join(', '));
  assert.ok(['redacteur', 'relanceur', 'livraison'].every(function (id) { return ids.indexOf(id) >= 0; }), 'Chloé, Yanis et Lucas passent : ' + ids.join(', '));
  const manuel = await RT.cycle({ db: db, agentId: 'demo', secondes: 120 });
  assert.strictEqual(manuel.passages.length, 0, 'Noé ne passe pas, même lancé à la main');
  // rallumée depuis la tour : la fabrication repart
  await require('../lib/actions').agir('budget', { fabrication: true });
  assert.strictEqual(db.tables.hq_config.find(function (x) { return x.key === 'budget'; }).value.fabrication, true, 'la fabrication se rallume dans Coûts et budget');
  tous(db);
  const c2 = await RT.cycle({ db: db, secondes: 250 });
  const ids2 = c2.passages.map(function (p) { return p.id; });
  assert.ok(ids2.some(function (id) { return config.FABRICATION.indexOf(id) >= 0; }), 'rallumée : la fabrication passe de nouveau : ' + ids2.join(', '));
  await require('../lib/actions').agir('budget', { fabrication: false });
  console.log('Fabrication OK : en pause par défaut (' + ids.length + ' passages sans elle), rallumable depuis la tour');

  // 2. l'aperçu vraiment ouvert : le panneau l'envoie après un geste, jamais depuis la tour ; rangé dans la fiche, le
  // score monte, Louis est prévenu une seule fois ; une mauvaise clé ne compte pas
  const P = require('../lib/sites/panneau');
  const panneau = String(P.html ? P.html({ slug: 'x', spec: { nom: 'X' } }, {}) : '') + String(P.SCRIPT || '') + require('fs').readFileSync(require.resolve('../lib/sites/panneau'), 'utf8');
  assert.ok(/signal\('page'\)/.test(panneau) && /Date\.now\(\)-t0<4000/.test(panneau) && /pointerdown/.test(panneau), 'le panneau signale la page après un geste, quatre secondes au moins après l\'ouverture');
  assert.ok(/moi\|\|vus\[quoi\]/.test(panneau), 'jamais depuis la tour (?tour=1)');
  const lead = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:vu', source: 'maps', name: 'Clim Vue', island: 'MQ', commune: 'Le Lamentin', phone: '+596696000000', email: 'v@clim-vue-mq.fr', email_source: 'site', status: 'contacte', score: 40 }))[0];
  const site = (await db.insert('hq_sites', { lead_id: lead.id, slug: 'clim-vue-1a2b', status: 'apercu', version: 1, spec: { nom: 'Clim Vue' }, data: {} }))[0];
  await db.update('hq_leads', { site_id: site.id }, { eq: { id: lead.id } });
  const cle = R.jeton(site.slug);
  const faux = await R.traiter(db, { site: site.slug, cle: 'faux', action: 'vu', quoi: 'page' });
  assert.strictEqual(faux.code, 403, 'une mauvaise clé ne compte pas');
  const v1 = await R.traiter(db, { site: site.slug, cle: cle, action: 'vu', quoi: 'page' });
  const v2 = await R.traiter(db, { site: site.slug, cle: cle, action: 'vu', quoi: 'page' });
  assert.ok(v1.code === 200 && v2.code === 200, 'le signal passe');
  const l2 = db.tables.hq_leads.find(function (x) { return x.id === lead.id; });
  assert.ok(l2.data.vues && l2.data.vues.n === 2 && l2.score >= 70 && l2.status === 'contacte', 'rangé dans la fiche, score monté, statut inchangé (les relances continuent) : ' + JSON.stringify(l2.data.vues));
  const notes = (db.tables.hq_messages || []).filter(function (m) { return m.to_id === 'louis' && /a ouvert son aperçu/.test(m.subject || ''); });
  assert.ok(notes.length === 1 && /meilleur moment pour l'appeler/.test(notes[0].body) && /\+596696000000/.test(notes[0].body), 'Louis est prévenu une fois, avec le numéro : ' + notes.length);
  // un aperçu expiré ne compte plus
  await db.update('hq_sites', { status: 'expire' }, { eq: { id: site.id } });
  await R.traiter(db, { site: site.slug, cle: cle, action: 'vu', quoi: 'page' });
  assert.strictEqual(db.tables.hq_leads.find(function (x) { return x.id === lead.id; }).data.vues.n, 2, 'un aperçu expiré ne compte plus');
  // le compteur de la tour
  const W = require('../lib/world');
  const m = await W.monde();
  assert.ok(m.compteurs && m.compteurs.ouverts === 1, 'la tour compte les prospects qui ont ouvert leur aperçu : ' + (m.compteurs && m.compteurs.ouverts));
  console.log('Aperçu ouvert OK : signal après un geste, fiche et score, Louis prévenu une fois avec le numéro, compté dans la chaîne');

  // 3. la migration 21 sur une base comme celle de Louis le 14 nov. : Louis prévenu, Yanis reçoit sa nouvelle fiche
  db = base();
  await RT.semer(db);
  db.tables.hq_config.find(function (x) { return x.key === 'seed'; }).value.version = 20;
  const yanis = db.tables.hq_agents.find(function (a) { return a.id === 'relanceur'; });
  yanis.charter = 'ancienne fiche'; yanis.playbook = 'Une relance au plus, à J+4.';
  // Miranda et Noé mis en pause à la main avant le déploiement (pour arrêter la dépense), Léa en pause pour une autre raison
  const ag = function (id) { return db.tables.hq_agents.find(function (a) { return a.id === id; }); };
  Object.assign(ag('critique'), { status: 'paused', current_task: RT.PAUSE_RELANCE });
  Object.assign(ag('demo'), { status: 'paused', current_task: RT.PAUSE_RELANCE });
  Object.assign(ag('photos'), { status: 'paused', current_task: 'Mis en pause par Louis' });
  const sm = await RT.semer(db);
  assert.ok(ag('critique').status === 'idle' && ag('demo').status === 'idle' && ag('photos').status === 'paused', 'la pause à la main du 14 nov. passe au réglage de la fabrication ; une autre pause reste');
  assert.ok(sm.seme, 'la migration passe');
  const y2 = db.tables.hq_agents.find(function (a) { return a.id === 'relanceur'; });
  assert.ok(/trois relances au plus/.test(y2.charter) && /J\+15/.test(y2.playbook), 'Yanis : trois relances, J+3, J+8, J+15');
  assert.ok((db.tables.hq_messages || []).some(function (x) { return x.to_id === 'louis' && x.subject === 'Mode relance : on vend les aperçus déjà faits'; }), 'Louis est prévenu');
  const sm2 = await RT.semer(db);
  assert.ok(!sm2.seme && (db.tables.hq_messages || []).filter(function (x) { return x.subject === 'Mode relance : on vend les aperçus déjà faits'; }).length === 1, 'une seule fois');
  console.log('Migration 21 OK : Yanis à trois relances, Louis prévenu une fois');

  console.log('Relances OK. Tout est vert en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
})().catch(function (e) { console.error('ÉCHEC :', e && e.stack || e); process.exit(1); });
