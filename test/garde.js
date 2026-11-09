// La tour recentrée sur Novalemo (9 nov. 2026), sans réseau : la garde du budget (chaque appel compté et écrit tout de
// suite, plafond du jour, échéance du passage), la liste des agents qui travaillent, la mise en pause d'un agent coupé
// deux fois, la chasse freinée quand la réserve est pleine, et la migration 19 sur une base comme celle de Louis.
// Lance : node test/garde.js
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
const { jourGP } = require('../lib/util');
const config = require('../lib/config');
const garde = require('../lib/garde');
const claude = require('../lib/claude');

function base() { const db = DB.memory(); DB.forcer(db); garde.oublier(); return db; }
const jour = function (db) { return (db.tables.hq_daily || []).find(function (x) { return x.day === jourGP(); }) || { cost_usd: 0 }; };
const appelSimple = function () { return claude.converse({ tier: 'smart', system: 'test', messages: [{ role: 'user', content: 'Bonjour' }], maxSteps: 1, maxTokens: 100 }); };

(async function () {
  const t0 = Date.now();

  // 1. chaque appel est compté et écrit tout de suite, au prix du modèle appelé
  let db = base();
  const avant = jour(db).cost_usd;
  const r = await appelSimple();
  const apres = jour(db).cost_usd;
  assert.ok(apres > avant && Math.abs((apres - avant) - r.cout) < 1e-9, 'un appel est écrit au compteur du jour dès qu\'il est payé : ' + avant + ' -> ' + apres + ' (coût ' + r.cout + ')');
  assert.ok(garde.prixDe('claude-sonnet-5-5').in === 2 && garde.prixDe('claude-sonnet-4-5').in === 3 && garde.prixDe('claude-opus-5-5').out === 20 && garde.prixDe('claude-haiku-4-5-20251001').in === 1, 'chaque modèle a son prix, les modèles de repli aussi');
  console.log('Compteur OK : un appel à', r.cout.toFixed(4), '$ écrit tout de suite');

  // 2. au plafond du jour, plus rien ne part, d'où que vienne l'appel
  db = base();
  await db.upsert('hq_config', { key: 'budget', value: Object.assign({}, config.BUDGET_DEFAUT, { jour_usd: 0.5 }) }, { onConflict: 'key' });
  await db.rpc('hq_bump', { p_day: jourGP(), p_cost: 0.5, p_runs: 0, p_searches: 0, p_places: 0, p_leads: 0, p_emails: 0, p_items: 0 });
  let refus = null;
  try { await appelSimple(); } catch (e) { refus = e; }
  assert.ok(refus && refus.budget && /Plafond IA du jour/.test(refus.message), 'au plafond : l\'appel ne part pas : ' + (refus && refus.message));
  assert.strictEqual(jour(db).cost_usd, 0.5, 'au plafond : rien de plus dépensé');
  console.log('Plafond OK :', refus.message);

  // 3. aucun appel ne démarre s'il ne peut pas finir avant la coupure de la fonction
  db = base();
  let tard = null;
  try { await garde.executer(garde.contexte({ echeance: Date.now() + 10000 }), appelSimple); } catch (e) { tard = e; }
  assert.ok(tard && tard.temps, 'fin du passage trop proche : l\'appel ne démarre pas');
  const ok = await garde.executer(garde.contexte({ echeance: Date.now() + 120000 }), appelSimple);
  assert.ok(ok.cout > 0, 'assez de temps : l\'appel part');
  console.log('Échéance OK : rien ne démarre dans les 20 dernières secondes du passage');

  // 4. la tour fraîche : seule la chaîne Novalemo travaille
  const runtime = require('../lib/runtime');
  db = base();
  await runtime.semer(db);
  db.tables.hq_agents.forEach(function (a) { if (a.kind !== 'attente') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
  const c1 = await runtime.cycle({ db: db, secondes: 250 });
  const ids = c1.passages.map(function (p) { return p.id; });
  assert.ok(c1.ok && ids.length > 0 && ids.every(function (id) { return config.ACTIFS.indexOf(id) >= 0; }), 'seuls les agents de la chaîne Novalemo passent : ' + ids.join(', '));
  assert.ok(ids.indexOf('pdg') < 0 && ids.indexOf('scenariste') < 0 && ids.indexOf('veille_github') < 0, 'ni la direction, ni le Studio, ni le Labo');
  const manuel = await runtime.cycle({ db: db, agentId: 'pdg', secondes: 200 });
  assert.ok(manuel.passages.length === 0, 'un agent en pause ne passe pas, même lancé à la main');
  const coutRuns = (db.tables.hq_runs || []).reduce(function (t, x) { return t + (Number(x.cost_usd) || 0); }, 0);
  assert.ok(Math.abs(jour(db).cost_usd - coutRuns) < 1e-6, 'le compteur du jour et le journal des passages disent la même chose (rien compté deux fois) : ' + jour(db).cost_usd + ' / ' + coutRuns);
  console.log('Agents OK :', ids.length, 'passages, tous de la chaîne Novalemo :', ids.join(', '));

  // 5. un agent coupé deux fois de suite en plein passage est mis en pause, Louis est prévenu
  const vieux = new Date(Date.now() - 20 * 60000).toISOString();
  const coupe = function (deja) { const a = db.tables.hq_agents.find(function (x) { return x.id === 'demo'; }); a.status = 'working'; a.updated_at = vieux; a.next_run_at = new Date(Date.now() + 3600000).toISOString(); a.stats = Object.assign({}, a.stats || {}, { plantages: deja }); return a; };
  // une première coupure : il repasse, et un passage arrivé au bout remet le compteur à zéro
  coupe(0);
  await runtime.cycle({ db: db, secondes: 250 });
  let noe = db.tables.hq_agents.find(function (x) { return x.id === 'demo'; });
  assert.ok(noe.status !== 'paused' && !noe.stats.plantages, 'une coupure : il repasse, et le compteur repart de zéro après un passage complet');
  // coupé de nouveau alors qu'il venait déjà d'être coupé (le passage de reprise n'est jamais arrivé au bout)
  coupe(1);
  await runtime.cycle({ db: db, secondes: 250 });
  noe = db.tables.hq_agents.find(function (x) { return x.id === 'demo'; });
  assert.ok(noe.status === 'paused' && noe.stats.plantages === 2, 'deux coupures de suite : en pause');
  assert.ok((db.tables.hq_messages || []).some(function (m) { return m.to_id === 'louis' && /mis en pause/.test(m.subject || ''); }), 'Louis est prévenu');
  console.log('Coupures OK : Noé en pause après deux passages coupés, Louis prévenu');

  // 6. la chasse s'arrête quand 40 prospects attendent déjà leur email
  db = base();
  await runtime.semer(db);
  const lignes = [];
  for (let k = 0; k < 40; k++) lignes.push({ company_id: 'novalemo', dedupe: 'test:reserve:' + k, source: 'maps', name: 'Réserve ' + k, island: 'MQ', email: 'r' + k + '@reserve-mq.fr', email_source: 'site', status: 'a_contacter', score: 70 });
  await db.insert('hq_leads', lignes, { returning: false });
  db.tables.hq_agents.forEach(function (a) { a.next_run_at = a.id === 'chasse_maps' ? new Date(Date.now() - 60000).toISOString() : new Date(Date.now() + 86400000).toISOString(); });
  const c6 = await runtime.cycle({ db: db, secondes: 250 });
  const jade = c6.passages.find(function (p) { return p.id === 'chasse_maps'; });
  assert.ok(jade && jade.saute && /40 prospects attendent/.test(jade.resume), 'réserve pleine : Jade ne cherche pas : ' + (jade && jade.resume));
  console.log('Chasse OK :', jade.resume);

  // 7. la migration 19 sur une base comme celle de Louis le 9 nov. : plafond à 10 $, tout le groupe actif, Miranda sur
  // Opus, la boîte en pause à cause de 4 rebonds d'adresses devinées
  db = base();
  await runtime.semer(db);
  db.tables.hq_config.find(function (x) { return x.key === 'seed'; }).value.version = 18;
  db.tables.hq_config.find(function (x) { return x.key === 'budget'; }).value = Object.assign({}, config.BUDGET_DEFAUT, { jour_usd: 10, parts: { novalemo: 0.65, studio3d: 0.3 } });
  db.tables.hq_agents.find(function (x) { return x.id === 'critique'; }).model = 'genius';
  const debut = new Date(Date.now() - 5 * 86400000).toISOString();
  const BX = require('../lib/jobs/boite');
  await BX.ecrireEtat(db, { debut: debut, pause: true, pause_auto: true, pause_at: new Date().toISOString(), raison: '4 rebonds définitifs sur 15 envois (27 %)' });
  for (let k = 0; k < 15; k++) {
    const devine = k < 5;
    const l = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:mig:' + k, source: 'maps', name: 'Mig ' + k, island: 'MQ', email: 'm' + k + '@mig-mq.fr', email_source: devine ? 'devine' : 'site', status: 'contacte', score: 70 }))[0];
    const o = (await db.insert('hq_outbox', { lead_id: l.id, to_email: l.email, subject: 'x', body: 'y', status: 'envoye', kind: 'prospection', step: 1, sent_at: new Date(Date.now() - (devine ? 4 : 1) * 86400000).toISOString() }))[0];
    if (devine && k < 4) await db.insert('hq_inbox', { lead_id: l.id, outbox_id: o.id, from_email: 'mailer-daemon@x.fr', subject: 'Undeliverable', body: '550 5.1.1', kind: 'rebond', status: 'traite', data: { dur: true }, received_at: new Date(Date.now() - 4 * 86400000).toISOString() }, { returning: false });
  }
  const sm = await runtime.semer(db);
  assert.ok(sm.seme, 'la migration passe');
  const actifsEnPause = db.tables.hq_agents.filter(function (a) { return config.ACTIFS.indexOf(a.id) >= 0 && a.status === 'paused'; });
  const autres = db.tables.hq_agents.filter(function (a) { return config.ACTIFS.indexOf(a.id) < 0 && a.kind !== 'attente' && a.status !== 'attente'; });
  assert.ok(actifsEnPause.length === 0 && autres.length > 0 && autres.every(function (a) { return a.status === 'paused'; }), 'tous les autres agents sont en pause, aucun de la chaîne');
  const bud = db.tables.hq_config.find(function (x) { return x.key === 'budget'; }).value;
  assert.ok(bud.jour_usd === 2 && !bud.parts, 'le plafond passe de 10 $ à 2 $, les parts retirées');
  assert.strictEqual(db.tables.hq_agents.find(function (x) { return x.id === 'critique'; }).model, 'smart', 'Miranda passe sur Sonnet');
  const bt = await BX.lireEtat(db);
  assert.ok(!bt.pause && bt.reprise_at, 'la boîte reprend : ses rebonds venaient des adresses devinées');
  const c = await BX.rebondsComptes(db, debut);
  assert.ok(c.envoyes === 10 && c.durs === 0 && c.ignores === 5, 'recomptés sans les adresses devinées : 10 envois, 0 rebond : ' + JSON.stringify(c));
  const note = (db.tables.hq_messages || []).find(function (m) { return m.to_id === 'louis' && /ne fait plus que Novalemo/.test(m.subject || ''); });
  assert.ok(note && /2 \$/.test(note.body) && /reprend/.test(note.body), 'Louis est prévenu de tout : ' + (note && note.body));
  console.log('Migration 19 OK :', autres.length, 'agents en pause, plafond 2 $, Miranda sur Sonnet, boîte relancée');

  // 8. une boîte vraiment abîmée reste en pause, même recomptée
  db = base();
  await runtime.semer(db);
  db.tables.hq_config.find(function (x) { return x.key === 'seed'; }).value.version = 18;
  await BX.ecrireEtat(db, { debut: debut, pause: true, pause_auto: true, pause_at: new Date().toISOString() });
  for (let k = 0; k < 15; k++) {
    const l = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:mig2:' + k, source: 'maps', name: 'Mig2 ' + k, island: 'MQ', email: 'n' + k + '@mig-mq.fr', email_source: 'site', status: 'contacte', score: 70 }))[0];
    const o = (await db.insert('hq_outbox', { lead_id: l.id, to_email: l.email, subject: 'x', body: 'y', status: 'envoye', kind: 'prospection', step: 1, sent_at: new Date(Date.now() - 86400000).toISOString() }))[0];
    if (k < 3) await db.insert('hq_inbox', { lead_id: l.id, outbox_id: o.id, from_email: 'mailer-daemon@x.fr', subject: 'Undeliverable', body: '550', kind: 'rebond', status: 'traite', data: { dur: true }, received_at: new Date().toISOString() }, { returning: false });
  }
  await runtime.semer(db);
  assert.ok((await BX.lireEtat(db)).pause, 'de vrais rebonds (3 sur 15 adresses lues sur les sites) : la boîte reste en pause');
  console.log('Boîte OK : de vrais rebonds la laissent en pause');

  console.log('Garde OK. Tout est vert en', ((Date.now() - t0) / 1000).toFixed(1), 's');
})().catch(function (e) { console.error('ÉCHEC :', e); process.exit(1); });
