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

  // 6 bis. la boîte d'envoi : envoi réel, fil de discussion, réponse, STOP, rebond, chauffe
  process.env.HQ_MAIL_USER = 'contact@studionovalem.fr'; process.env.HQ_MAIL_PASS = 'secret-de-test';
  const mail = require('../lib/mail'), ENVOI = require('../lib/jobs/envoi'), BOITE = require('../lib/jobs/boite');
  const partis = [], aRelever = [];
  mail.forcer({
    mx: ['mx1.mail.ovh.net'],
    envoyer: async function (raw, o) { partis.push({ raw: raw.toString('utf8'), o: o }); },
    relever: async function (etat, garder) {
      const out = []; let dernier = (etat && etat.dernier) || 0;
      for (const m of aRelever.splice(0)) { dernier = Math.max(dernier, m.uid); if (await garder(m)) out.push(m); }
      return { etat: { uidValidity: '7', dernier: dernier }, messages: out, vus: out.length };
    },
    tester: async function () { return { smtp: { ok: true }, imap: { ok: true } }; },
    dns: async function (d) { return { domaine: d, fournisseur: 'OVH', mx: [], spf: { ok: true }, dkim: { ok: false, conseil: 'activer' }, dmarc: { ok: false, conseil: 'ajouter' }, verifie_le: new Date().toISOString() }; }
  });
  assert.strictEqual((await mail.reglages()).smtp, 'ssl0.ovh.net', 'OVH reconnu par ses MX');
  const brouillons = db.tables.hq_outbox.filter(function (o) { return o.status === 'a_valider'; });
  assert.ok(brouillons.length >= 1, 'des brouillons à valider');
  for (const o of brouillons) await agir('email', { id: o.id, statut: 'pret' });
  const env2 = await runtime.charger(db);
  const e1 = await ENVOI.run({ db: db, budget: env2.budget, limite: Date.now() + 120000, toujours: true, espacement: 0 });
  console.log('Envoi :', e1.resume, '|', partis.length, 'parti(s)');
  assert.strictEqual(partis.length, Math.min(2, brouillons.length), 'deux envois maximum par passage');
  const o1 = db.tables.hq_outbox.find(function (o) { return o.id === brouillons[0].id; });
  assert.strictEqual(o1.status, 'envoye');
  assert.ok(/^<hq\.\d+\.[a-f0-9]+@studionovalem\.fr>$/.test(o1.message_id), 'Message-ID reconnaissable');
  assert.ok(/List-Unsubscribe: <mailto:contact@studionovalem\.fr\?subject=STOP>/.test(partis[0].raw), 'désinscription en un clic');
  assert.ok(/From: Louis de Novalemo <contact@studionovalem\.fr>/.test(partis[0].raw), 'expéditeur lisible');
  const l1 = db.tables.hq_leads.find(function (l) { return l.id === o1.lead_id; });
  assert.strictEqual(l1.status, 'contacte');
  assert.ok((await BOITE.lireEtat(db)).debut, 'la chauffe démarre au premier envoi');
  assert.strictEqual(BOITE.quota(await BOITE.lireEtat(db), { emails_jour: 25 }), 5, 'palier de 5 par jour au début');

  // relance dans le même fil, puis annulée quand le prospect répond
  const yanis = env2.agents.find(function (a) { return a.id === 'relanceur'; });
  const exY = tools.executeurs({ db: db, agent: yanis, agents: env2.agents, budget: env2.budget, compteurs: { items: 0, leads: 0, emails: 0, messages: 0, places: 0 }, lirePage: async function () { return {}; } });
  const rr = await exY.rediger_emails({ emails: [{ lead_id: l1.id, objet: 'peu importe', corps: 'Un autre exemple dans votre métier.\nLouis', angle: 'relance1' }] });
  assert.ok(/ok/.test(rr), 'relance acceptée : ' + rr);
  const rel = db.tables.hq_outbox.find(function (o) { return o.kind === 'relance' && o.lead_id === l1.id; });
  assert.strictEqual(rel.in_reply_to, o1.message_id, 'la relance répond au premier email');
  assert.ok(/^Re: /.test(rel.subject), 'objet « Re: »');

  // le prospect répond (vraie réponse, avec citation de notre email)
  aRelever.push({ uid: 11, messageId: '<r1@climpro971.fr>', inReplyTo: o1.message_id, from: l1.email, fromName: 'Jean Dupont', subject: 'Re: ' + o1.subject, headers: 'In-Reply-To: ' + o1.message_id + '\r\n', date: new Date(),
    source: Buffer.from('From: Jean Dupont <' + l1.email + '>\r\nTo: contact@studionovalem.fr\r\nSubject: Re: ' + o1.subject + '\r\nMessage-ID: <r1@climpro971.fr>\r\nIn-Reply-To: ' + o1.message_id + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nBonjour, oui ça m\'intéresse, vous pouvez m\'appeler demain ?\r\n\r\nLe lun. 2 nov. 2026 à 10:00, Louis de Novalemo <contact@studionovalem.fr> a écrit :\r\n> Bonjour,\r\n> Répondez STOP pour ne plus recevoir de message.\r\n') });
  // un message sans rapport dans la boîte de Louis : jamais lu
  aRelever.push({ uid: 12, messageId: '<perso@ami.fr>', from: 'ami@exemple.fr', subject: 'Ce soir ?', headers: '', source: Buffer.from('Subject: Ce soir ?\r\n\r\nOn se voit ?') });
  const rv = await BOITE.releve({ db: db });
  console.log('Relève :', rv.resume);
  const ib = (db.tables.hq_inbox || []).find(function (x) { return x.message_id === '<r1@climpro971.fr>'; });
  assert.ok(ib && ib.kind === 'reponse' && ib.status === 'nouveau', 'réponse rangée');
  assert.ok(!/STOP/.test(ib.body) && /intéresse/.test(ib.body), 'seule la partie neuve est gardée : ' + ib.body);
  assert.ok(!(db.tables.hq_inbox || []).some(function (x) { return x.message_id === '<perso@ami.fr>'; }), 'le courrier personnel n\'est pas lu');
  assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.id === l1.id; }).status, 'repondu');
  assert.strictEqual(db.tables.hq_outbox.find(function (o) { return o.id === rel.id; }).status, 'annule', 'la relance est annulée');
  assert.ok(db.tables.hq_messages.some(function (m) { return m.to_id === 'louis' && /Réponse de/.test(m.subject); }), 'Louis est prévenu');
  const refus = await exY.rediger_emails({ emails: [{ lead_id: l1.id, objet: 'x', corps: 'Encore moi.\nLouis', angle: 'relance2' }] });
  assert.ok(/répondu/.test(refus), 'pas de relance après une réponse');

  // Emma prépare la réponse, Louis l'envoie dans le même fil
  const cE = await runtime.cycle({ db: db, agentId: 'reponses', secondes: 200 });
  console.log('Emma :', cE.passages.map(function (x) { return x.resume; }).join(' | '));
  const rep = db.tables.hq_outbox.find(function (o) { return o.kind === 'reponse'; });
  assert.ok(rep && rep.status === 'a_valider' && rep.in_reply_to === '<r1@climpro971.fr>', 'réponse préparée dans le fil');
  assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.id === l1.id; }).status, 'interesse');
  assert.ok(db.tables.hq_messages.some(function (m) { return m.to_id === 'louis' && m.kind === 'alerte' && /intéressé/.test(m.subject); }), 'alerte « intéressé » pour Louis');
  const envoiRep = await agir('reponse_envoyer', { id: rep.id, body: rep.body + '\n(PS : modifié par Louis)' });
  assert.ok(envoiRep.envoye, 'réponse partie');
  const dernierRaw = partis[partis.length - 1].raw.replace(/=\r?\n/g, '');
  assert.ok(/In-Reply-To: <r1@climpro971\.fr>/.test(dernierRaw) && /modifi=C3=A9 par Louis\)/.test(dernierRaw), 'même fil, texte de Louis');
  assert.strictEqual(db.tables.hq_inbox.find(function (x) { return x.id === ib.id; }).status, 'traite');

  // STOP et rebond sur les autres envois
  const autres = db.tables.hq_outbox.filter(function (o) { return o.status === 'envoye' && o.kind !== 'reponse' && o.id !== o1.id; });
  if (autres.length) {
    const o2 = autres[0], l2 = db.tables.hq_leads.find(function (l) { return l.id === o2.lead_id; });
    aRelever.push({ uid: 20, messageId: '<stop@x.fr>', inReplyTo: o2.message_id, from: l2.email, subject: 'Re: ' + o2.subject, headers: '', source: Buffer.from('Subject: Re\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSTOP merci\r\n') });
    await BOITE.releve({ db: db });
    assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.id === l2.id; }).status, 'stop', 'STOP appliqué');
    assert.ok(db.tables.hq_suppression.some(function (x) { return x.email === String(l2.email).toLowerCase(); }), 'liste noire');
  }
  let o3 = db.tables.hq_outbox.find(function (o) { return o.status === 'pret' && o.kind !== 'reponse'; });
  if (!o3) {
    const nl = await db.insert('hq_leads', { dedupe: 'test:rebond', source: 'manuel', name: 'Test Rebond', email: 'nexistepas@exemple-gp.fr', phone: '+590 690 00 00 01', status: 'brouillon' });
    o3 = (await db.insert('hq_outbox', { lead_id: nl[0].id, to_email: 'nexistepas@exemple-gp.fr', subject: 'Le site de Test', body: 'Bonjour\nRépondez STOP pour ne plus recevoir de message.', status: 'pret', kind: 'prospection', step: 1 }))[0];
  }
  {
    await ENVOI.run({ db: db, budget: env2.budget, limite: Date.now() + 120000, toujours: true, espacement: 0 });
    const o3b = db.tables.hq_outbox.find(function (o) { return o.id === o3.id; });
    const l3 = db.tables.hq_leads.find(function (l) { return l.id === o3.lead_id; });
    aRelever.push({ uid: 30, messageId: '<dsn1@ovh.net>', from: 'mailer-daemon@ovh.net', subject: 'Undelivered Mail Returned to Sender', headers: 'Content-Type: multipart/report; report-type=delivery-status\r\n', source: Buffer.from('Subject: Undelivered Mail Returned to Sender\r\nContent-Type: text/plain\r\n\r\n<' + l3.email + '>: host mx said: 550 5.1.1 user unknown\r\nMessage-ID: ' + o3b.message_id + '\r\n') });
    await BOITE.releve({ db: db });
    assert.ok(o3b.status === 'envoye', 'troisième envoi parti');
    assert.ok(['a_appeler', 'sans_contact'].indexOf(db.tables.hq_leads.find(function (l) { return l.id === l3.id; }).status) >= 0, 'adresse invalide : passe en appel');
    assert.ok(db.tables.hq_suppression.some(function (x) { return x.email === String(l3.email).toLowerCase() && x.reason === 'rebond'; }), 'adresse invalide écartée');
  }
  assert.strictEqual(BOITE.trier({ subject: 'Réponse automatique : absent', headers: '' }, 'Je suis absent', '').kind, 'absence');
  assert.strictEqual(mail.partieNeuve('Oui\n\nOn Mon, 2 Nov 2026, Louis wrote:\n> x'), 'Oui');

  // pause automatique si trop d'adresses invalides
  const etatB = await BOITE.lireEtat(db);
  for (let k = 0; k < 16; k++) await db.insert('hq_outbox', { to_email: 'x' + k + '@y.fr', subject: 's', body: 'b', status: 'envoye', kind: 'prospection', sent_at: new Date().toISOString() });
  for (let k = 0; k < 2; k++) await db.insert('hq_inbox', { message_id: 'dsn-test-' + k, kind: 'rebond', status: 'traite', data: { dur: true }, received_at: new Date().toISOString() });
  const apres = await BOITE.surveiller(db, Object.assign({}, etatB, { reprise_at: new Date(Date.now() - 1000).toISOString() }));
  assert.ok(apres.pause, 'pause automatique');
  await agir('boite_pause', { pause: false });
  const vueBoite = await agir('boite_etat', {});
  assert.ok(vueBoite.branchee && vueBoite.adresse === 'contact@studionovalem.fr' && vueBoite.dns, 'la tour voit la boîte');
  const wB = await world.monde(null);
  assert.ok(wB.boite.branchee, 'monde : boîte branchée');
  const inboxListe = await world.liste('inbox', {});
  assert.ok(inboxListe.rows.some(function (r) { return r.reponse && r.origine && r.lead; }), 'réponses avec contexte complet');
  console.log('Boîte OK :', partis.length, 'envois,', (db.tables.hq_inbox || []).length, 'messages relevés, palier', vueBoite.quota, '/ jour');
  mail.forcer(null); delete process.env.HQ_MAIL_USER; delete process.env.HQ_MAIL_PASS;

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
