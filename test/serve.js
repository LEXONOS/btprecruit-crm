// Serveur local pour regarder la tour sans Vercel : node test/serve.js [--demo] [--port 8790]
// Sans --demo : base en mémoire + faux réseau + un premier cycle simulé, et un peu d'activité factice
// pour voir les messages voyager (uniquement ici, jamais en production).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const DEMO = process.argv.indexOf('--demo') >= 0;
const PORT = Number((process.argv.find(function (a) { return /^--port=/.test(a); }) || '--port=8790').split('=')[1]);
const RACINE = path.join(__dirname, '..');
const THREE = process.env.THREE_DIR || '/tmp/claude-0/-home-claude/dfcd46f1-fed0-583b-9c1b-956e7448c6b7/scratchpad/three/node_modules/three';

let db = null;
if (!DEMO) {
  process.env.ANTHROPIC_API_KEY = 'test';
  process.env.GOOGLE_MAPS_API_KEY = 'test';
  require('./fakes');
  const DB = require('../lib/db');
  db = DB.memory();
  DB.forcer(db);
}
const hq = require('../api/hq');
const tick = require('../api/tick');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.sql': 'text/plain; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function adapter(req, res, handler) {
  let corps = '';
  req.on('data', function (c) { corps += c; });
  req.on('end', async function () {
    const u = new URL(req.url, 'http://local');
    req.query = Object.fromEntries(u.searchParams);
    try { req.body = corps ? JSON.parse(corps) : {}; } catch (e) { req.body = {}; }
    await handler(req, res);
  });
}

http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/api/hq') return adapter(req, res, hq);
  if (u.pathname === '/api/tick') return adapter(req, res, tick);
  let f;
  if (u.pathname.indexOf('/three/') === 0) f = path.join(THREE, u.pathname.slice(7));
  else f = path.join(RACINE, u.pathname === '/' ? 'index.html' : u.pathname);
  fs.readFile(f, function (err, data) {
    if (err) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
    if (path.basename(f) === 'index.html') {
      data = String(data).replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js', '/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/', '/three/examples/jsm/')
        .replace(/<link[^>]+fonts\.googleapis[^>]+>/g, '');
    }
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', async function () {
  console.log('La tour en local : http://127.0.0.1:' + PORT + (DEMO ? ' (mode démo)' : ''));
  if (DEMO) return;
  const runtime = require('../lib/runtime');
  await runtime.semer(db);
  db.tables.hq_agents.forEach(function (a) { if (a.kind !== 'attente') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
  const r = await runtime.cycle({ db: db, secondes: 250 });
  console.log('Premier cycle simulé :', r.passages.length, 'passages');
  if (process.argv.indexOf('--boite') >= 0) {
    // boîte d'envoi simulée : envois, une réponse de prospect, la réponse préparée par Emma
    process.env.HQ_MAIL_USER = 'contact@studionovalem.fr'; process.env.HQ_MAIL_PASS = 'local';
    const mail = require('../lib/mail'), ENVOI = require('../lib/jobs/envoi'), BOITE = require('../lib/jobs/boite'), { agir } = require('../lib/actions');
    const file = [];
    mail.forcer({ mx: ['mx1.mail.ovh.net'], envoyer: async function () {}, tester: async function () { return { smtp: { ok: true }, imap: { ok: true } }; },
      relever: async function (etat, garder) { const out = []; for (const m of file.splice(0)) if (await garder(m)) out.push(m); return { etat: { uidValidity: '1', dernier: 50 }, messages: out }; },
      dns: async function (d) { return { domaine: d, fournisseur: 'OVH', mx: ['mx1.mail.ovh.net'], spf: { ok: true, valeur: 'v=spf1 include:mx.ovh.com ~all' }, dkim: { ok: false, conseil: 'Espace client OVH > Web Cloud > Emails > ton domaine > onglet DKIM : activer.' }, dmarc: { ok: false, conseil: 'Ajoute un enregistrement TXT sur _dmarc.' + d + ' : v=DMARC1; p=none; rua=mailto:contact@' + d }, verifie_le: new Date().toISOString() }; } });
    db.tables.hq_agents.forEach(function (a) { if (a.id === 'redacteur' || a.id === 'contacts') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
    await runtime.cycle({ db: db, secondes: 250 });
    for (const o of db.tables.hq_outbox.filter(function (x) { return x.status === 'a_valider'; }).slice(0, 1)) await agir('email', { id: o.id, statut: 'pret' });
    await ENVOI.run({ db: db, budget: (await runtime.charger(db)).budget, limite: Date.now() + 60000, toujours: true, espacement: 0 });
    const o1 = db.tables.hq_outbox.find(function (x) { return x.status === 'envoye'; });
    const l1 = o1 && db.tables.hq_leads.find(function (l) { return l.id === o1.lead_id; });
    if (o1) {
      file.push({ uid: 11, messageId: '<r1@climpro971.fr>', inReplyTo: o1.message_id, from: l1.email, fromName: 'Jean Dupont', subject: 'Re: ' + o1.subject, headers: '', date: new Date(),
        source: Buffer.from('Subject: Re\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nBonjour,\r\nOui ça m\'intéresse, on a justement un problème avec notre site actuel. Vous pouvez m\'appeler demain matin ? Combien ça coûterait pour 3 pages ?\r\n\r\nJean Dupont\r\nClim Pro 971\r\n\r\nLe lun. 2 nov. 2026, Louis a écrit :\r\n> Bonjour\r\n') });
      await BOITE.releve({ db: db });
      await runtime.cycle({ db: db, agentId: 'reponses', secondes: 200 });
    }
    console.log('Boîte simulée :', db.tables.hq_outbox.length, 'emails,', (db.tables.hq_inbox || []).length, 'réponse(s)');
  }
  if (process.argv.indexOf('--ventes') >= 0) {
    // pilote automatique simulé : aperçus, une commande, un paiement, un site en ligne
    process.env.HQ_MAIL_USER = process.env.HQ_MAIL_USER || 'louis@novalemo-mq.fr'; process.env.HQ_MAIL_PASS = 'local';
    process.env.HQ_VERCEL_TOKEN = 'local'; process.env.HQ_STRIPE_KEY = 'sk_live_local';
    const fakes = require('./fakes'), { agir } = require('../lib/actions');
    require('../lib/mail').forcer({ mx: ['mx1.mail.ovh.net'], envoyer: async function () {}, relever: async function () { return { etat: { uidValidity: '1', dernier: 1 }, messages: [] }; }, tester: async function () { return { smtp: { ok: true }, imap: { ok: true } }; }, dns: async function () { return null; } });
    await agir('identite', { entreprise: 'NOVALEM', forme: 'Entrepreneur individuel', siret: '10340524700018', marque: 'Studio Novalem', prenom: 'Louis', nom: 'Renault', email: 'louis@novalemo-mq.fr', telephone: '+590691253449', adresse: '1 rue Exemple', cp: '97170', ville: 'Petit-Bourg', region: 'Guadeloupe', pays: 'GP' });
    const noms = [['Clim Éole', 'climatisation', 'Le Lamentin', 'https://climpro972.fr'], ['Net Éclat Services', 'nettoyage professionnel', 'Ducos', null], ['Sentinelle Sécurité', 'entreprise de sécurité', 'Fort-de-France', null], ['Jardins de la Caravelle', 'paysagiste', 'La Trinité', null]];
    for (let k = 0; k < noms.length; k++) await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'local:' + k, source: 'maps', name: noms[k][0], sector: noms[k][1], island: 'MQ', commune: noms[k][2], website: noms[k][3], site_state: noms[k][3] ? 'douteux' : 'aucun', email: 'contact@exemple' + k + '-mq.fr', email_source: 'site', phone: '+596696' + String(100000 + k * 1111), score: 90 - k, status: 'a_contacter', data: { google: { place_id: 'l' + k, note: 4.7, avis: 20 + k, adresse: noms[k][2] + ', Martinique' } } });
    const runtime2 = require('../lib/runtime');
    db.tables.hq_agents.forEach(function (a) { if (a.id === 'demo') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
    await runtime2.cycle({ db: db, agentId: 'demo', secondes: 200 });
    db.tables.hq_agents.forEach(function (a) { if (a.id === 'demo') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
    await runtime2.cycle({ db: db, agentId: 'demo', secondes: 200 });
    const tools = require('../lib/tools'), env = await runtime2.charger(db);
    const emma = env.agents.find(function (a) { return a.id === 'reponses'; });
    const ex = tools.executeurs({ db: db, agent: emma, agents: env.agents, budget: env.budget, compteurs: { items: 0, leads: 0, emails: 0, messages: 0, places: 0 } });
    const l0 = db.tables.hq_leads.find(function (l) { return l.dedupe === 'local:0'; }), l1 = db.tables.hq_leads.find(function (l) { return l.dedupe === 'local:1'; });
    const msg = async function (l) { return (await db.insert('hq_inbox', { message_id: '<local' + l.id + '@client.mq>', lead_id: l.id, from_email: l.email, subject: 'Re: votre site', body: 'On y va.', kind: 'reponse', status: 'traite', data: { confiance: 'adresse' } }))[0].id; };
    await ex.commande({ reponse_id: await msg(l0), formule: 'vitrine' });
    await ex.commande({ reponse_id: await msg(l1), formule: 'essentiel' });
    const s0 = db.tables.hq_sites.find(function (x) { return x.lead_id === l0.id; });
    fakes.payer(s0.stripe.lien); fakes.FAUX_EN_LIGNE.add(s0.domaine);
    for (let k = 0; k < 3; k++) { db.tables.hq_agents.forEach(function (a) { if (a.id === 'livraison') a.next_run_at = new Date(Date.now() - 60000).toISOString(); }); await runtime2.cycle({ db: db, agentId: 'livraison', secondes: 200 }); }
    console.log('Ventes simulées :', db.tables.hq_sites.map(function (x) { return x.slug + ' ' + x.status; }).join(', '));
  }
  // activité factice pour voir la scène vivre
  const ids = db.tables.hq_agents.filter(function (a) { return a.kind !== 'attente'; }).map(function (a) { return a; });
  setInterval(function () {
    const a = ids[Math.floor(Math.random() * ids.length)];
    if (!a.parent_id) return;
    db.tables.hq_messages.push({ id: (db.tables.hq_messages.length + 1000), from_id: a.id, to_id: a.parent_id, company_id: a.company_id, kind: ['rapport', 'rapport', 'note', 'proposition'][Math.floor(Math.random() * 4)], subject: 'Point de ' + a.name, body: 'Activité simulée en local.', created_at: new Date().toISOString() });
    ids.forEach(function (x) { if (x.status === 'working' && Math.random() < 0.5) x.status = 'idle'; });
    const w = ids[Math.floor(Math.random() * ids.length)]; w.status = 'working';
    db.tables.hq_agents.forEach(function (x) { const y = ids.find(function (z) { return z.id === x.id; }); if (y) x.status = y.status; });
  }, 2500);
});
