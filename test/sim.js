// Simulation complète sans réseau : base en mémoire, Claude simulé, Google/GitHub/Afnic/annuaire/BODACC simulés,
// Vercel, Stripe et le registrar simulés. Novalemo en Martinique, pilote automatique de bout en bout.
// Lance : node test/sim.js
'use strict';
process.env.ANTHROPIC_API_KEY = 'test';
process.env.GOOGLE_MAPS_API_KEY = 'test';
delete process.env.HQ_SUPABASE_KEY; delete process.env.HQ_VERCEL_TOKEN; delete process.env.VERCEL_TOKEN; delete process.env.HQ_STRIPE_KEY; delete process.env.STRIPE_SECRET_KEY;

const assert = require('assert');
const fakes = require('./fakes');
const DB = require('../lib/db');
const db = DB.memory();
DB.forcer(db);

const runtime = require('../lib/runtime');
const world = require('../lib/world');
const { agir } = require('../lib/actions');
const tools = require('../lib/tools');
const C0 = function () { return { items: 0, leads: 0, emails: 0, messages: 0, places: 0 }; };
const dus = function (ids) { db.tables.hq_agents.forEach(function (a) { if (ids.indexOf(a.id) >= 0) { a.next_run_at = new Date(Date.now() - 60000).toISOString(); a.status = 'idle'; } }); };

(async function () {
  const t0 = Date.now();
  // 1. fondation
  const s = await runtime.semer(db);
  assert.ok(s.seme, 'la fondation doit se faire');
  assert.strictEqual(db.tables.hq_agents.length, require('../lib/seed').AGENTS.length);
  assert.ok(db.tables.hq_agents.every(function (a) { return a.parent_id === null ? a.id === 'pdg' : true; }), 'tout le monde a un chef sauf le PDG');
  assert.ok(db.tables.hq_agents.some(function (a) { return a.id === 'livraison' && a.kind === 'job'; }) && db.tables.hq_agents.find(function (a) { return a.id === 'demo'; }).kind === 'job', 'Noé et Lucas travaillent');
  console.log('Fondation :', db.tables.hq_agents.length, 'agents,', db.tables.hq_companies.length, 'entreprises,', db.tables.hq_proposals.length, 'propositions');

  // 2. tout le monde dû maintenant (hébergement et paiement pas encore branchés)
  db.tables.hq_agents.forEach(function (a) { if (a.kind !== 'attente') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
  const c1 = await runtime.cycle({ db: db, secondes: 250 });
  assert.ok(c1.ok, 'cycle ok');
  console.log('Cycle 1 :', c1.passages.length, 'passages, dépense', c1.depense_jour, '$, appels Claude', fakes.appels());
  const leads = db.tables.hq_leads || [];
  console.log('Prospects :', leads.length, JSON.stringify(leads.reduce(function (o, l) { o[l.status] = (o[l.status] || 0) + 1; return o; }, {})));
  assert.ok(leads.some(function (l) { return l.source === 'maps'; }), 'des prospects Google Maps');
  assert.ok(!leads.some(function (l) { return /carrefour/i.test(l.name); }), 'les enseignes sont écartées');
  assert.ok(!leads.some(function (l) { return /gwada/i.test(l.name) || l.island === 'GP'; }), 'rien en Guadeloupe');
  assert.ok(leads.every(function (l) { return l.island === 'MQ'; }), 'tout est en Martinique');
  assert.ok(leads.some(function (l) { return l.source === 'domaines' && /climpro/i.test(l.dedupe); }), 'un nouveau domaine de Martinique');
  assert.ok(!leads.some(function (l) { return /gwada/.test(l.dedupe); }), 'le nouveau domaine de Guadeloupe est ignoré');
  assert.ok(leads.some(function (l) { return l.source === 'registre' && /MADININA/.test(l.name); }), 'une création BODACC en Martinique');
  assert.ok(!leads.some(function (l) { return /SCI DES PALMIERS|KARUKERA/.test(l.name); }), 'SCI et Guadeloupe écartées');
  const maps = require('../lib/jobs/maps');
  assert.ok(maps.lignes('climatisation | Guadeloupe\nMétiers : clim\nZones : Le Lamentin').every(function (x) { return x.zone !== 'Guadeloupe'; }), 'une rotation hors Martinique est ignorée');

  // 3. deuxième cycle : la rédactrice a des contacts (sans hébergement branché : emails sans aperçu)
  dus(['redacteur', 'contacts']);
  const c2 = await runtime.cycle({ db: db, secondes: 250 });
  c2.passages.forEach(function (p) { if (/Chloé|Marcus/.test(p.nom)) console.log('  -', p.nom.padEnd(11), p.ok ? 'ok ' : 'ERR', p.saute ? '(sauté)' : '', '|', p.resume.slice(0, 140)); });
  let outbox = db.tables.hq_outbox || [];
  console.log('Emails :', outbox.length, outbox[0] ? '| ' + outbox[0].subject + ' -> ' + outbox[0].to_email : '');
  assert.ok(outbox.length >= 1, 'au moins un email');
  assert.ok(outbox.every(function (o) { return /STOP/.test(o.body) && o.status === 'pret'; }), 'pilote automatique : STOP présent, email en file sans Louis');

  // le contrôle qualité remplace Louis
  let env = await runtime.charger(db);
  const chloe = env.agents.find(function (a) { return a.id === 'redacteur'; });
  const exC = tools.executeurs({ db: db, agent: chloe, agents: env.agents, budget: env.budget, compteurs: C0(), lirePage: async function () { return {}; } });
  const autre = db.tables.hq_leads.find(function (l) { return l.status === 'a_contacter' && l.email; }) || (await db.insert('hq_leads', { dedupe: 'test:ctrl', source: 'maps', name: 'Test Contrôle', island: 'MQ', email: 'test@controle-mq.fr', status: 'a_contacter', score: 60 }))[0];
  const refus = await exC.rediger_emails({ emails: [{ lead_id: autre.id, objet: 'Le site de Test', corps: 'Bonjour,\nOn vous fait votre site pour 490 €, une solution clé en main, je vous appelle demain ? Remise de 20 % cette semaine.\nLouis' }] });
  assert.ok(/REFUSÉ/.test(refus) && /490/.test(refus) && /appel/.test(refus), 'prix hors grille, mot creux, remise et appel refusés : ' + refus);
  const gp = (await db.insert('hq_leads', { dedupe: 'test:gp', source: 'web', name: 'Garage Gwada', island: 'GP', email: 'a@gwada.fr', status: 'a_contacter', score: 70 }))[0];
  assert.ok(/hors zone/.test(await exC.rediger_emails({ emails: [{ lead_id: gp.id, objet: 'x', corps: 'y' }] })), 'Guadeloupe refusée à la rédaction');
  const ajout = await tools.executeurs({ db: db, agent: env.agents.find(function (a) { return a.id === 'partenaires'; }), agents: env.agents, budget: env.budget, compteurs: C0() }).ajouter_leads({ leads: [{ nom: 'Cabinet X', commune: 'Pointe-à-Pitre', source_url: 'https://x.fr' }, { nom: 'Cabinet Y', commune: 'Schœlcher', email: 'contact@cabinety.fr', source_url: 'https://y.fr' }] });
  assert.ok(/1 prospect\(s\) ajouté\(s\)/.test(ajout) && /hors Martinique/.test(ajout), 'les prescripteurs hors Martinique sont refusés : ' + ajout);
  // mode manuel : Louis coupe le pilote, les emails attendent sa validation
  await agir('budget', { envoi_auto: false });
  env = await runtime.charger(db);
  const exM = tools.executeurs({ db: db, agent: chloe, agents: env.agents, budget: env.budget, compteurs: C0(), lirePage: async function () { return {}; } });
  const lm = (await db.insert('hq_leads', { dedupe: 'test:manuel', source: 'maps', name: 'Manuel SARL', island: 'MQ', email: 'contact@manuel-mq.fr', status: 'a_contacter', score: 60 }))[0];
  const okM = await exM.rediger_emails({ emails: [{ lead_id: lm.id, objet: 'Le site de Manuel SARL', corps: 'Bonjour,\n\nEn cherchant les entreprises de nettoyage en Martinique, j\'ai vu que Manuel SARL n\'a pas encore de site qui la présente vraiment. Je peux vous préparer un aperçu de votre futur site, et le mettre en ligne sur votre nom de domaine avec l\'hébergement inclus la première année. Le site vous appartient, sans abonnement obligatoire.\n\nJe vous le prépare ?\n\nLouis\nNovalemo, sites internet en Martinique' }] });
  assert.ok(/ok/.test(okM) && db.tables.hq_outbox.find(function (o) { return o.lead_id === lm.id; }).status === 'a_valider', 'pilote coupé : validation de Louis');
  await agir('budget', { envoi_auto: true });

  const items = db.tables.hq_items || [];
  assert.ok(items.some(function (i) { return i.kind === 'reference' && i.status === 'valide'; }), 'références vérifiées');
  assert.ok(items.some(function (i) { return i.kind === 'repo'; }), 'fiche GitHub');

  // 4. Louis valide un projet d'entreprise, le PDG l'exécute
  const p = db.tables.hq_proposals.find(function (x) { return x.title === 'Créer Conformité Web'; });
  await agir('decider', { id: p.id, decision: 'valider', note: 'Go, prix OK.' });
  await runtime.cycle({ db: db, agentId: 'pdg', secondes: 200 });
  assert.strictEqual(db.tables.hq_companies.find(function (c) { return c.id === 'conformite'; }).status, 'active', 'Conformité Web devient active');

  // 5. garde-fous de hiérarchie, budget prioritaire pour Novalemo
  env = await runtime.charger(db);
  const dg = env.agents.find(function (a) { return a.id === 'dg_ecom'; });
  const pr = await db.insert('hq_proposals', { company_id: 'ecom', from_id: 'dircom_ecom', kind: 'depense', title: 'Test pub 200 €', justification: 'test', status: 'ouverte' });
  const ex = tools.executeurs({ db: db, agent: dg, agents: env.agents, budget: env.budget, compteurs: C0(), lirePage: async function () { return {}; } });
  assert.ok(/Louis/.test(await ex.decider({ proposition_id: pr[0].id, decision: 'valider', note: 'ok' })), 'une dépense part chez Louis');
  assert.ok((await ex.assigner({ a: 'dg_novalemo', titre: 'x', consigne: 'y' })).erreur, 'un DG ne commande pas un autre DG');
  env.depense = 0.7 * env.budget.jour_usd;
  assert.ok(env.peutDepenser({ company_id: 'novalemo' }) && !env.peutDepenser({ company_id: 'ecom' }), 'budget serré : Novalemo passe en premier');

  // 6. la boîte d'envoi (pilote automatique)
  process.env.HQ_MAIL_USER = 'louis@novalemo-mq.fr'; process.env.HQ_MAIL_PASS = 'secret-de-test';
  const mail = require('../lib/mail'), ENVOI = require('../lib/jobs/envoi'), BOITE = require('../lib/jobs/boite');
  const partis = [], aRelever = [];
  let uid = 10;
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
  const reponse = function (o, de, texte, extra) {
    uid++;
    const mid = '<r' + uid + '@client.mq>';
    aRelever.push(Object.assign({ uid: uid, messageId: mid, inReplyTo: o.message_id, from: de, fromName: 'Jean Dupont', subject: 'Re: ' + o.subject, headers: 'In-Reply-To: ' + o.message_id + '\r\n', date: new Date(),
      source: Buffer.from('From: Jean Dupont <' + de + '>\r\nTo: louis@novalemo-mq.fr\r\nSubject: Re: ' + o.subject + '\r\nMessage-ID: ' + mid + '\r\nIn-Reply-To: ' + o.message_id + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + texte + '\r\n\r\nLe lun. 2 nov. 2026, Louis a écrit :\r\n> Répondez STOP pour ne plus recevoir de message.\r\n') }, extra || {}));
    return mid;
  };
  env = await runtime.charger(db);
  const prets = db.tables.hq_outbox.filter(function (o) { return o.status === 'pret'; });
  const e1 = await ENVOI.run({ db: db, budget: env.budget, limite: Date.now() + 120000, toujours: true, espacement: 0 });
  console.log('Envoi :', e1.resume, '|', partis.length, 'parti(s)');
  assert.strictEqual(partis.length, Math.min(2, prets.length), 'deux envois maximum par passage');
  const o1 = db.tables.hq_outbox.find(function (o) { return o.status === 'envoye'; });
  assert.ok(/^<hq\.\d+\.[a-f0-9]+@novalemo-mq\.fr>$/.test(o1.message_id), 'Message-ID reconnaissable');
  assert.ok(/List-Unsubscribe: <mailto:louis@novalemo-mq\.fr\?subject=STOP>/.test(partis[0].raw), 'désinscription en un clic');
  const l1 = db.tables.hq_leads.find(function (l) { return l.id === o1.lead_id; });
  assert.strictEqual(l1.status, 'contacte');
  // un email vers la Guadeloupe ne part jamais, même déjà en file
  const ogp = (await db.insert('hq_outbox', { lead_id: gp.id, to_email: gp.email, subject: 'x', body: 'y', status: 'pret', kind: 'prospection', step: 1 }))[0];
  assert.strictEqual((await ENVOI.envoyerUn(db, ogp)).raison, 'hors zone', 'garde-fou de zone à l\'envoi');

  // le prospect répond et demande un appel : Emma reste par email (le contrôle refuse l'appel, elle réécrit)
  reponse(o1, l1.email, 'Bonjour, oui ça m\'intéresse, vous pouvez m\'appeler demain ?');
  aRelever.push({ uid: 99, messageId: '<perso@ami.fr>', from: 'ami@exemple.fr', subject: 'Ce soir ?', headers: '', source: Buffer.from('Subject: Ce soir ?\r\n\r\nOn se voit ?') });
  const rv = await BOITE.releve({ db: db });
  console.log('Relève :', rv.resume);
  assert.ok(!(db.tables.hq_inbox || []).some(function (x) { return x.message_id === '<perso@ami.fr>'; }), 'le courrier personnel n\'est pas lu');
  assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.id === l1.id; }).status, 'repondu');
  const cE = await runtime.cycle({ db: db, agentId: 'reponses', secondes: 200 });
  console.log('Emma :', cE.passages.map(function (x) { return x.resume; }).join(' | '));
  const rep = db.tables.hq_outbox.find(function (o) { return o.kind === 'reponse' && o.lead_id === l1.id; });
  assert.ok(rep && rep.status === 'pret' && !/appel|691/i.test(rep.body.replace(/par email/g, '')), 'réponse sans appel, partie en pilote automatique');
  assert.ok(rep.in_reply_to && /client\.mq/.test(rep.in_reply_to), 'dans le fil');
  assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.id === l1.id; }).status, 'interesse');

  // STOP et rebond
  const o2 = db.tables.hq_outbox.find(function (o) { return o.status === 'envoye' && o.kind === 'prospection' && o.id !== o1.id; });
  if (o2) {
    const l2 = db.tables.hq_leads.find(function (l) { return l.id === o2.lead_id; });
    aRelever.push({ uid: 120, messageId: '<stop@x.fr>', inReplyTo: o2.message_id, from: l2.email, subject: 'Re: ' + o2.subject, headers: '', source: Buffer.from('Subject: Re\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSTOP merci\r\n') });
    await BOITE.releve({ db: db });
    assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.id === l2.id; }).status, 'stop', 'STOP appliqué');
  }
  assert.strictEqual(BOITE.trier({ subject: 'Réponse automatique : absent', headers: '' }, 'Je suis absent', '').kind, 'absence');

  // 7. LE PILOTE AUTOMATIQUE DE BOUT EN BOUT : aperçu, email, réponses, retouche, commande, paiement, domaine, mise en ligne
  process.env.HQ_VERCEL_TOKEN = 'test-vercel'; process.env.HQ_STRIPE_KEY = 'sk_live_simulation';
  const idv = await agir('identite', { entreprise: 'NOVALEM', forme: 'Entrepreneur individuel', siret: '103 405 247 00018', marque: 'Studio Novalem', prenom: 'Louis', nom: 'Renault', email: 'louis@novalemo-mq.fr', telephone: '0691 25 34 49', adresse: '11 rue de la Somme', cp: '49300', ville: 'Cholet', region: 'Maine-et-Loire', pays: 'FR' });
  assert.ok(idv.complete && idv.identite.telephone === '+590691253449', 'identité de vente complète');
  const lc = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:climeole', source: 'maps', name: 'Clim Éole', sector: 'climatisation', island: 'MQ', commune: 'Le Lamentin', website: 'https://climpro972.fr', site_state: 'douteux', email: 'jean@climeole.fr', email_source: 'site', phone: '+596 696 12 34 56', score: 92, status: 'a_contacter',
    data: { google: { place_id: 'px', note: 4.8, avis: 37, adresse: 'Zone de la Lézarde, 97232 Le Lamentin, Martinique', maps: 'https://maps.google.com/?cid=1', horaires: ['lundi: 07:30 – 17:00'] }, entreprise: { siren: '912345678', siret: '91234567800017', raison_sociale: 'CLIM EOLE', forme: 'SARL', adresse: 'ZONE DE LA LEZARDE 97232 LE LAMENTIN', dirigeant: 'Jean DUPONT', dirigeant_personne: true } } }))[0];
  // Noé fabrique et publie
  dus(['demo']);
  const cN = await runtime.cycle({ db: db, agentId: 'demo', secondes: 200 });
  console.log('Noé :', cN.passages.map(function (x) { return x.resume; }).join(' | '));
  let site = db.tables.hq_sites.find(function (x) { return x.lead_id === lc.id; });
  assert.ok(site, 'un site pour le prospect');
  assert.strictEqual(site.status, 'apercu', 'aperçu publié');
  assert.ok(site.spec.photos.length === 3 && site.spec.logo && site.spec.accent === '#e30613', 'photos, logo et couleur repris de son site');
  assert.strictEqual(site.spec.composition, 'photo', 'avec ses photos : composition photo');
  assert.ok(!/\d/.test(site.spec.a_propos) && !/500 clients/.test(JSON.stringify(site.spec)), 'chiffres inventés refusés par le contrôle (deuxième essai de l\'atelier)');
  assert.ok(site.spec.legal && site.spec.legal.siren === '912345678' && site.spec.google.note === 4.8 && site.spec.contact.tel === '+596696123456', 'faits posés par le code');
  const l3 = db.tables.hq_leads.find(function (l) { return l.id === lc.id; });
  assert.ok(l3.apercu_etat === 'publie' && /^https:\/\/novalemo-martinique\.vercel\.app\/a\/clim-eole-[a-f0-9]{4}\/$/.test(l3.apercu_url), 'lien d\'aperçu prêt : ' + l3.apercu_url);
  const projet = fakes.VERCEL.projets.prj_sites;
  assert.ok(projet && projet.ssoProtection === null, 'projet public créé, protection coupée');
  let dep = fakes.VERCEL.deploiements[fakes.VERCEL.deploiements.length - 1];
  const chemins = dep.files.map(function (f) { return f.file; });
  assert.ok(chemins.indexOf('a/' + site.slug + '/index.html') >= 0 && chemins.indexOf('a/' + site.slug + '/mentions-legales/index.html') >= 0 && chemins.indexOf('_f/inter.woff2') >= 0 && chemins.indexOf('_n/cgv/index.html') >= 0 && chemins.indexOf('vercel.json') >= 0 && chemins.some(function (c) { return /\/img\/p1\.jpg$/.test(c); }), 'déploiement complet');
  // Chloé écrit avec le lien, le contrôle vérifie qu'il y est
  dus(['redacteur']);
  await runtime.cycle({ db: db, agentId: 'redacteur', secondes: 200 });
  let oc = db.tables.hq_outbox.find(function (o) { return o.lead_id === lc.id && o.kind === 'prospection'; });
  assert.ok(oc && oc.status === 'pret' && oc.body.indexOf(l3.apercu_url) >= 0, 'premier email avec le lien de l\'aperçu');
  const sansLien = await exC.rediger_emails({ emails: [{ lead_id: lc.id, objet: 'x', corps: 'y' }] });
  assert.ok(/déjà un email/.test(sansLien), 'un seul premier email');
  env = await runtime.charger(db);
  partis.length = 0;
  db.tables.hq_outbox.filter(function (o) { return o.status === 'pret' && o.kind === 'prospection' && o.id !== oc.id; }).forEach(function (o) { o.status = 'annule'; });
  await ENVOI.run({ db: db, budget: env.budget, limite: Date.now() + 120000, toujours: true, espacement: 0 });
  oc = db.tables.hq_outbox.find(function (o) { return o.id === oc.id; });
  assert.strictEqual(oc.status, 'envoye', 'premier email parti');
  // il demande le prix
  reponse(oc, lc.email, 'Bonjour, c\'est joli ! Combien ça coûte ?');
  await BOITE.releve({ db: db });
  dus(['reponses']); fakes.EMMA.tentatives = 1;
  await runtime.cycle({ db: db, agentId: 'reponses', secondes: 200 });
  const rPrix = db.tables.hq_outbox.filter(function (o) { return o.lead_id === lc.id && o.kind === 'reponse'; }).pop();
  assert.ok(rPrix && /990 €/.test(rPrix.body) && rPrix.status === 'pret', 'prix de la grille, réponse partie seule');
  // il demande une retouche et envoie son logo
  const logo = (function () { const x = Buffer.alloc(5000, 9); x.writeUInt32BE(0x89504e47, 0); x.writeUInt32BE(400, 16); x.writeUInt32BE(380, 20); return x; })();
  const bnd = 'BOUNDARY42';
  uid++;
  aRelever.push({ uid: uid, messageId: '<r' + uid + '@client.mq>', inReplyTo: oc.message_id, from: lc.email, subject: 'Re: ' + oc.subject, headers: 'In-Reply-To: ' + oc.message_id + '\r\n', date: new Date(),
    source: Buffer.from('From: Jean <' + lc.email + '>\r\nSubject: Re: ' + oc.subject + '\r\nMessage-ID: <r' + uid + '@client.mq>\r\nIn-Reply-To: ' + oc.message_id + '\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="' + bnd + '"\r\n\r\n--' + bnd + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPouvez-vous changer la couleur en turquoise et ajouter nos horaires ? Je vous joins notre logo.\r\n--' + bnd + '\r\nContent-Type: image/png; name="logo-climeole.png"\r\nContent-Disposition: attachment; filename="logo-climeole.png"\r\nContent-Transfer-Encoding: base64\r\n\r\n' + logo.toString('base64') + '\r\n--' + bnd + '--\r\n') });
  await BOITE.releve({ db: db });
  assert.ok((db.tables.hq_fichiers || []).some(function (f) { return f.lead_id === lc.id && f.role === 'logo'; }), 'logo du client gardé');
  dus(['reponses']);
  await runtime.cycle({ db: db, agentId: 'reponses', secondes: 200 });
  site = db.tables.hq_sites.find(function (x) { return x.id === site.id; });
  assert.ok(site.revisions === 1 && site.version === 2 && site.spec.ambiance === 'lagon' && /logo-/.test(site.spec.logo.fichier) && site.spec.contact.horaires[0] === 'Lundi au vendredi : 7 h 30 à 17 h', 'retouche faite : couleur, horaires, logo du client');
  assert.ok((await require('../lib/sites/publication').lireEtat(db)).a_publier, 'nouvelle version à publier');
  // Lucas publie la retouche
  dus(['livraison']);
  await runtime.cycle({ db: db, agentId: 'livraison', secondes: 200 });
  dep = fakes.VERCEL.deploiements[fakes.VERCEL.deploiements.length - 1];
  assert.ok(dep.files.some(function (f) { return /\/img\/logo-\d+\.png$/.test(f.file); }), 'le logo du client est en ligne');
  // il dit oui
  reponse(oc, lc.email, 'Parfait, ok pour la Vitrine, on y va !');
  await BOITE.releve({ db: db });
  dus(['reponses']);
  await runtime.cycle({ db: db, agentId: 'reponses', secondes: 200 });
  site = db.tables.hq_sites.find(function (x) { return x.id === site.id; });
  assert.ok(site.status === 'commande' && site.formule === 'vitrine' && Number(site.montant_eur) === 990 && site.domaine === 'clim-eole.com' && site.domaine_mode === 'achat', 'commande : Vitrine 990 €, domaine libre trouvé : ' + site.domaine);
  const lienStripe = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  assert.ok(lienStripe.params['line_items[0][price]'] && lienStripe.params['metadata[site_id]'] === String(site.id) && lienStripe.params['restrictions[completed_sessions][limit]'] === '1' && /\/_n\/merci\/$/.test(lienStripe.params['after_completion[redirect][url]']), 'lien Stripe bien formé');
  const rCmd = db.tables.hq_outbox.filter(function (o) { return o.lead_id === lc.id && o.kind === 'reponse'; }).pop();
  assert.ok(rCmd.body.indexOf(lienStripe.url) >= 0 && rCmd.status === 'pret', 'le lien de paiement part dans la réponse');
  // il paie : Lucas encaisse, réserve le domaine, met en ligne, prévient
  fakes.payer(lienStripe.id);
  fakes.FAUX_EN_LIGNE.add('clim-eole.com');
  dus(['livraison']);
  await runtime.cycle({ db: db, agentId: 'livraison', secondes: 200 });
  site = db.tables.hq_sites.find(function (x) { return x.id === site.id; });
  console.log('Lucas (1) :', site.status, site.domaine, (site.data && site.data.commande && site.data.commande.id) || '');
  assert.ok(['livraison', 'en_ligne'].indexOf(site.status) >= 0 && site.paid_at, 'payé puis en livraison');
  assert.ok(fakes.VERCEL.achats.some(function (a) { return a.domaine === 'clim-eole.com' && a.corps.expectedPrice === 12.03 && a.corps.contactInformation.lastName === 'Renault' && a.corps.contactInformation.phone === '+590691253449'; }), 'domaine réservé au bon prix avec l\'identité de vente');
  assert.ok(fakes.STRIPE.desactives.indexOf(lienStripe.id) >= 0, 'lien de paiement désactivé');
  assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.id === lc.id; }).status, 'client');
  dus(['livraison']);
  await runtime.cycle({ db: db, agentId: 'livraison', secondes: 200 });
  site = db.tables.hq_sites.find(function (x) { return x.id === site.id; });
  assert.strictEqual(site.status, 'en_ligne', 'site en ligne');
  assert.strictEqual(site.url_finale, 'https://clim-eole.com/');
  dep = fakes.VERCEL.deploiements[fakes.VERCEL.deploiements.length - 1];
  const fl = dep.files.map(function (f) { return f.file; });
  assert.ok(['index.html', 'services/index.html', 'a-propos/index.html', 'contact/index.html', 'mentions-legales/index.html', 'sitemap.xml'].every(function (f) { return fl.indexOf('s/' + site.slug + '/' + f) >= 0; }), 'les pages de la Vitrine sont servies');
  assert.ok(fakes.VERCEL.domaines['clim-eole.com'] && fakes.VERCEL.domaines['www.clim-eole.com'].redirect === 'clim-eole.com', 'domaine et www branchés');
  const services = db.tables.hq_outbox.filter(function (o) { return o.lead_id === lc.id && o.kind === 'service'; });
  assert.ok(services.some(function (o) { return /Paiement reçu/.test(o.subject); }) && services.some(function (o) { return /en ligne/.test(o.subject) && /https:\/\/clim-eole\.com/.test(o.body) && /invoice\.stripe\.com/.test(o.body); }), 'client prévenu : paiement, puis site en ligne avec facture');
  assert.ok(db.tables.hq_messages.some(function (m) { return m.to_id === 'louis' && /Vente : 990/.test(m.subject); }), 'Louis voit la vente passer (sans rien faire)');
  partis.length = 0;
  await ENVOI.run({ db: db, budget: env.budget, limite: Date.now() + 120000, toujours: true, espacement: 0 });
  assert.ok(partis.length >= 3, 'réponses et emails de service envoyés : ' + partis.length);
  // le rendu en ligne : rewrites par domaine, mentions légales du client, pas de bandeau d'aperçu
  const R = require('../lib/sites/rendu'), P = require('../lib/sites/publication');
  const vj = JSON.parse(P.vercelJson([{ slug: site.slug, domaine: 'clim-eole.com' }]).toString());
  assert.ok(vj.rewrites[0].has[0].value === 'clim-eole.com' && vj.rewrites[0].destination === '/s/' + site.slug + '/index.html' && vj.rewrites[2].destination === '/s/' + site.slug + '/:chemin/index.html' && !vj.trailingSlash, 'réécritures par domaine vers des fichiers (comportement vérifié sur Vercel)');
  const live = R.rendre(site, { mode: 'live', url: 'https://clim-eole.com/', identite: idv.identite });
  const ml = live.files.find(function (f) { return /mentions-legales/.test(f.file); }).data;
  assert.ok(/912345678|91234567800017/.test(ml) && /Vercel Inc/.test(ml) && /NOVALEM/.test(ml) && !/class="apercu"/.test(live.files[0].data) && !/noindex/.test(live.files[0].data), 'mentions légales du client, site public');
  const ap = R.rendre(site, { mode: 'apercu', contactNovalemo: 'louis@novalemo-mq.fr' }).files[0].data;
  assert.ok(/noindex/.test(ap) && /class="apercu"/.test(ap) && /Je veux ce site/.test(ap), 'aperçu privé avec bandeau');
  // « Je veux ce site » depuis une autre adresse : rattaché au bon prospect
  const autreSite = (await db.insert('hq_sites', { lead_id: autre.id, slug: 'test-autre-1234', status: 'apercu', spec: { nom: 'Test Contrôle', activite: 'nettoyage' }, published_at: new Date().toISOString() }))[0];
  aRelever.push({ uid: 300, messageId: '<veux@gmail.com>', from: 'patron.perso@gmail.com', subject: 'Je veux ce site : Test Contrôle', headers: '', source: Buffer.from('Subject: Je veux ce site : Test Contrôle\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nBonjour, comment on fait ?\r\n') });
  await BOITE.releve({ db: db });
  assert.ok(db.tables.hq_inbox.some(function (x) { return x.message_id === '<veux@gmail.com>' && x.lead_id === autre.id; }), 'bouton « Je veux ce site » rattaché au prospect');
  // un aperçu oublié expire au bout de 30 jours
  db.tables.hq_sites.filter(function (x) { return x.lead_id === autre.id; }).forEach(function (x) { x.published_at = new Date(Date.now() - 40 * 86400000).toISOString(); });
  db.tables.hq_leads.find(function (l) { return l.id === autre.id; }).status = 'contacte';
  db.tables.hq_config = db.tables.hq_config.filter(function (c) { return c.key !== 'expiration'; });   // la passe d'expiration tourne toutes les 3 h
  dus(['livraison']);
  const cX = await runtime.cycle({ db: db, agentId: 'livraison', secondes: 200 });
  assert.strictEqual(db.tables.hq_sites.find(function (x) { return x.id === autreSite.id; }).status, 'expire', 'aperçu expiré');
  // ce que voit la tour
  const w = await world.monde(null);
  assert.ok(w.pilote.auto && w.pilote.vercel && w.pilote.stripe && w.pilote.identite && w.compteurs.en_ligne === 1 && w.compteurs.ca_eur === 990, 'la tour voit le pilote et la vente : ' + JSON.stringify(w.compteurs));
  const ls = await world.liste('sites', {});
  assert.ok(ls.rows.some(function (r) { return r.status === 'en_ligne' && r.lead && r.facture; }), 'liste des sites complète');
  // un an plus tard : l'hébergement de l'année suivante se facture seul (lien, rappel, paiement, ou pause)
  const LIV = require('../lib/jobs/livraison');
  const vivant = function () { return db.tables.hq_sites.find(function (x) { return x.id === site.id; }); };
  const ren = function () { return (vivant().data && vivant().data.renouvellement) || {}; };
  const recule = function (champ, jours) { const r = ren(); r[champ] = new Date(new Date(r[champ]).getTime() - jours * 86400000).toISOString(); };
  vivant().live_at = new Date(Date.now() - 340 * 86400000).toISOString();
  let rn = await LIV.renouvellements(db);
  const lienRen = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  assert.ok(rn.liens === 1 && ren().lien === lienRen.id && !lienRen.params['custom_fields[0][key]'] && lienRen.params['after_completion[type]'] === 'hosted_confirmation', 'lien de renouvellement sans champ domaine');
  assert.strictEqual(fakes.STRIPE.prix[fakes.STRIPE.prix.length - 1].unit_amount, 2500, 'renouvellement à 25 €');
  assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === lc.id && o.kind === 'service' && /hébergement/.test(o.subject) && o.body.indexOf(lienRen.url) >= 0; }), 'le client reçoit le lien de l\'année');
  rn = await LIV.renouvellements(db);
  assert.strictEqual(rn.liens + rn.payes + rn.pauses, 0, 'rien de plus tant que l\'échéance est loin');
  const finAn1 = new Date(vivant().live_at).getTime() + 365 * 86400000;
  fakes.payer(lienRen.id, { amount_total: 2500, invoice: 'in_2' });
  rn = await LIV.renouvellements(db);
  assert.ok(rn.payes === 1 && ren().annees === 2 && !ren().lien && fakes.STRIPE.desactives.indexOf(lienRen.id) >= 0 && Math.abs(new Date(ren().jusqu_au).getTime() - (finAn1 + 365 * 86400000)) < 5000, 'renouvellement payé : un an de plus à partir de l\'échéance');
  assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === lc.id && /renouvelé/.test(o.subject) && /jusqu'au/.test(o.body); }), 'client remercié avec la nouvelle échéance');
  // l'année d'après, il ne paie pas : lien, rappel, avertissement, pause, chaque étape espacée (jamais tout d'un coup)
  ren().jusqu_au = new Date(Date.now() + 20 * 86400000).toISOString();
  rn = await LIV.renouvellements(db);
  assert.ok(rn.liens === 1 && ren().lien, 'lien de l\'année suivante');
  ren().jusqu_au = new Date(Date.now() - 10 * 86400000).toISOString();
  for (let k = 0; k < 4; k++) rn = await LIV.renouvellements(db);
  assert.ok(vivant().status === 'en_ligne' && !(ren().rappels), 'échéance déjà passée : pas de rappel moins de 5 jours après le lien, jamais de pause d\'un coup');
  recule('cree_le', 6); rn = await LIV.renouvellements(db);
  assert.strictEqual(ren().rappels, 1, 'rappel 5 jours après le lien');
  rn = await LIV.renouvellements(db);
  assert.strictEqual(ren().rappels, 1, 'avertissement pas avant 7 jours après le rappel');
  recule('rappel1_le', 8); rn = await LIV.renouvellements(db);
  assert.ok(ren().rappels === 2 && new Date(ren().pause_prevue).getTime() > Date.now() + 13 * 86400000, 'avertissement : pause annoncée au moins 14 jours plus tard');
  rn = await LIV.renouvellements(db);
  assert.strictEqual(vivant().status, 'en_ligne', 'pas de pause avant la date annoncée');
  ren().pause_prevue = new Date(Date.now() - 60000).toISOString();
  fakes.VERCEL.autoRenewEchecs = 1;
  rn = await LIV.renouvellements(db);
  assert.ok(vivant().status === 'pause' && ren().auto_a_couper && fakes.VERCEL.autoRenew['clim-eole.com'] !== false, 'pause ; Vercel a refusé de couper le renouvellement du domaine, à refaire');
  rn = await LIV.renouvellements(db);
  assert.ok(fakes.VERCEL.autoRenew['clim-eole.com'] === false && ren().auto_coupe && !ren().auto_a_couper, 'renouvellement du domaine coupé au passage suivant');
  assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === lc.id && /en pause/.test(o.subject); }), 'client prévenu de la pause');
  const svP = await P.suivre(db, {});
  if (!(svP.suite && svP.suite.publie)) { const pubP = await P.publier(db, { raison: 'test pause' }); assert.ok(pubP.publie, 'publication de la pause : ' + pubP.resume); }
  const depP = fakes.VERCEL.deploiements[fakes.VERCEL.deploiements.length - 1].files.map(function (f) { return f.file; });
  const vjp = JSON.parse(P.vercelJson([], [{ domaine: 'clim-eole.com' }]).toString());
  assert.ok(depP.indexOf('_n/pause/index.html') >= 0 && depP.indexOf('s/' + site.slug + '/index.html') < 0 && vjp.rewrites.every(function (x) { return x.destination === '/_n/pause/index.html'; }) && vjp.rewrites.length === 2, 'site en pause : page neutre sur son domaine');
  const emmaA = db.tables.hq_agents.find(function (a) { return a.id === 'reponses'; });
  const cmdPause = await tools.executeurs({ db: db, agent: emmaA, agents: db.tables.hq_agents, budget: env.budget, compteurs: C0() }).commande({ reponse_id: db.tables.hq_inbox.filter(function (x) { return x.lead_id === lc.id && x.kind === 'reponse'; }).pop().id, formule: 'vitrine' });
  assert.ok(/en pause/.test(JSON.stringify(cmdPause)), 'Emma ne revend pas un site en pause : ' + JSON.stringify(cmdPause).slice(0, 120));
  const lienPause = ren().lien;
  fakes.payer(lienPause, { amount_total: 2500, invoice: 'in_3' });
  fakes.VERCEL.autoRenewEchecs = 1;
  rn = await LIV.renouvellements(db);
  assert.ok(vivant().status === 'en_ligne' && ren().annees === 3 && ren().auto_coupe && new Date(ren().jusqu_au).getTime() > Date.now() + 364 * 86400000, 'payé en retard : remis en ligne, un an à partir du paiement');
  rn = await LIV.renouvellements(db);
  assert.ok(fakes.VERCEL.autoRenew['clim-eole.com'] === true && !ren().auto_coupe, 'renouvellement du domaine remis au passage suivant (Vercel avait refusé une fois)');
  console.log('Renouvellements OK : lien, paiement, rappels, pause, reprise');

  // les garde-fous de la revue : argent, STOP, usurpation, envois ratés, aperçus expirés, zone, liens nus
  {
  const exE = function () { return tools.executeurs({ db: db, agent: emmaA, agents: db.tables.hq_agents, budget: env.budget, compteurs: C0() }); };
  const nouveauClient = async function (cle, nom, email) {
    const l = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:' + cle, source: 'maps', name: nom, sector: 'garage', island: 'MQ', commune: 'Le Robert', email: email, email_source: 'site', score: 80, status: 'repondu' }))[0];
    const st = (await db.insert('hq_sites', { lead_id: l.id, slug: cle + '-1a2b', status: 'apercu', spec: { nom: nom, activite: 'garage' }, url_apercu: 'https://novalemo-martinique.vercel.app/a/' + cle + '-1a2b/', published_at: new Date().toISOString() }))[0];
    await db.update('hq_leads', { site_id: st.id, apercu_etat: 'publie', apercu_url: st.url_apercu }, { eq: { id: l.id } });
    const ib = (await db.insert('hq_inbox', { message_id: '<' + cle + '@client.mq>', lead_id: l.id, from_email: email, subject: 'Re: votre site', body: 'Ok', kind: 'reponse', status: 'nouveau', data: { confiance: 'adresse' } }))[0];
    return { l: l, s: st, ib: ib };
  };
  const leSite = function (id) { return db.tables.hq_sites.find(function (x) { return x.id === id; }); };
  const lucas = async function () { dus(['livraison']); await runtime.cycle({ db: db, agentId: 'livraison', secondes: 200 }); };
  // 1. il paie l'ancien lien (Essentiel) juste après qu'Emma a créé celui de la Vitrine : vu, au bon prix ; puis un second paiement est remboursé
  const ga = await nouveauClient('garage-test', 'Garage Test', 'garage@test-mq.fr');
  const gc1 = await exE().commande({ reponse_id: ga.ib.id, formule: 'essentiel' });
  const L1 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  const gc2 = await exE().commande({ reponse_id: ga.ib.id, formule: 'vitrine' });
  const L2 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  assert.ok(gc1.lien_paiement && gc2.lien_paiement && L1.id !== L2.id && leSite(ga.s.id).stripe.liens.length === 2 && fakes.STRIPE.desactives.indexOf(L1.id) >= 0, 'changement de formule : nouveau lien, l\'ancien reste suivi');
  fakes.payer(L1.id, { amount_total: 59000, invoice: 'in_g1', customer_details: { email: 'garage@test-mq.fr', name: 'G' } });
  const gc3 = await exE().commande({ reponse_id: ga.ib.id, formule: 'signature' });
  assert.ok(/déjà payé/.test(gc3.erreur || ''), 'pas de troisième lien quand un paiement existe');
  await lucas();
  assert.ok(['paye', 'livraison', 'en_ligne'].indexOf(leSite(ga.s.id).status) >= 0 && leSite(ga.s.id).formule === 'essentiel' && Number(leSite(ga.s.id).montant_eur) === 590, 'paiement de l\'ancien lien vu, formule réellement payée : ' + leSite(ga.s.id).status + ' ' + leSite(ga.s.id).formule);
  fakes.payer(L2.id, { amount_total: 99000, invoice: 'in_g2', customer_details: { email: 'garage@test-mq.fr', name: 'G' } });
  await lucas();
  assert.ok(fakes.STRIPE.rembourses.indexOf('pi_' + L2.id) >= 0 && db.tables.hq_outbox.some(function (o) { return o.lead_id === ga.l.id && /double remboursé/.test(o.subject); }), 'second paiement remboursé tout seul, client prévenu');
  // 2. paiement de test (clé ou carte de test) : rien n'est acheté, le site redevient un aperçu
  const tt = await nouveauClient('test-carte', 'Test Carte', 'carte@test-mq.fr');
  await exE().commande({ reponse_id: tt.ib.id, formule: 'essentiel' });
  const LT = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  const achatsAvant = fakes.VERCEL.achats.length;
  fakes.payer(LT.id, { livemode: false, amount_total: 59000 });
  await lucas();
  assert.ok(leSite(tt.s.id).status === 'apercu' && fakes.VERCEL.achats.length === achatsAvant && db.tables.hq_messages.some(function (m) { return /Paiement de test/.test(m.subject || ''); }), 'paiement de test : aucun achat, retour à l\'aperçu');
  process.env.HQ_STRIPE_KEY = 'sk_test_essai';
  const cT = await exE().commande({ reponse_id: tt.ib.id, formule: 'vitrine' });
  assert.ok(/mode test/.test(cT.erreur || '') && db.tables.hq_config.some(function (c) { return c.key === 'alerte:stripe_test'; }), 'clé de test : pas de lien inutilisable envoyé à un vrai client');
  process.env.HQ_STRIPE_KEY = 'sk_live_simulation';
  // 3. commande de domaine ratée : ce nom est écarté, Louis prévenu une fois, un autre nom est réservé
  const gfl = await nouveauClient('fleurs-test', 'Fleurs Test', 'fleurs@test-mq.fr');
  await exE().commande({ reponse_id: gfl.ib.id, formule: 'essentiel' });
  const LF = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  fakes.VERCEL.echecs.add('fleurs-test.com');
  fakes.payer(LF.id, { amount_total: 59000, customer_details: { email: 'fleurs@test-mq.fr', name: 'F' } });
  await lucas(); await lucas(); await lucas();
  const sf = leSite(gfl.s.id);
  assert.ok(sf.domaine && sf.domaine !== 'fleurs-test.com' && (sf.data.commande_ratee || []).indexOf('fleurs-test.com') >= 0 && fakes.VERCEL.achats.filter(function (a) { return a.domaine === 'fleurs-test.com'; }).length === 1 && db.tables.hq_messages.some(function (m) { return /Commande de domaine ratée/.test(m.subject || ''); }), 'domaine raté écarté, autre nom réservé : ' + sf.domaine);
  // 4. STOP : plus rien ne part, même un aperçu promis ou une réponse
  const st0 = await nouveauClient('stop-test', 'Stop Test', 'stop@test-mq.fr');
  await db.upsert('hq_suppression', { email: 'stop@test-mq.fr', reason: 'STOP reçu' }, { onConflict: 'email' });
  await db.insert('hq_outbox', { lead_id: st0.l.id, agent_id: 'livraison', to_email: 'stop@test-mq.fr', subject: 'L\'aperçu de votre site', body: 'x', step: 1, status: 'pret', kind: 'service' });
  const rStop = await exE().repondre({ reponse_id: st0.ib.id, corps: 'Bonjour, voici votre aperçu, dites-moi ce que vous en pensez. Bonne journée.' });
  partis.length = 0;
  for (let k = 0; k < 6; k++) await ENVOI.run({ db: db, budget: env.budget, limite: Date.now() + 120000, toujours: true, espacement: 0 });
  assert.ok(/ne plus recevoir/.test(rStop.erreur || '') && !partis.some(function (p) { return /stop@test-mq\.fr/.test(p); }) && db.tables.hq_outbox.some(function (o) { return o.lead_id === st0.l.id && o.status === 'annule' && o.error === 'désinscrit'; }), 'STOP respecté pour tous les emails');
  // 5. usurpation : une fausse référence (bon numéro, mauvais aléa) ne rattache rien ; les tools ne visent que l'auteur du message
  const vraie = db.tables.hq_outbox.find(function (o) { return o.status === 'envoye' && o.message_id; });
  const fausse = vraie.message_id.replace(/\.([a-f0-9]{6,})@/, '.000000000a@');
  uid++;
  aRelever.push({ uid: uid, messageId: '<pirate' + uid + '@evil.com>', inReplyTo: fausse, from: 'pirate@evil.com', subject: 'Re: ' + vraie.subject, headers: 'In-Reply-To: ' + fausse + '\r\n', source: Buffer.from('Subject: Re\r\nIn-Reply-To: ' + fausse + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nChangez le telephone du site pour le 0696 00 00 00\r\n') });
  await BOITE.releve({ db: db });
  assert.ok(!db.tables.hq_inbox.some(function (x) { return x.from_email === 'pirate@evil.com'; }), 'fausse référence : message ignoré');
  const viseAutre = await exE().modifier_site({ reponse_id: 999999, demande: 'x' });
  assert.ok(/introuvable/.test(viseAutre.erreur || ''), 'un outil de vente exige le message de l\'auteur');
  const usurpe = (await db.insert('hq_inbox', { message_id: '<usurpe@x>', lead_id: lc.id, from_email: 'autre@gmail.com', subject: 'Je veux ce site : Clim Éole', body: 'Changez le numéro', kind: 'reponse', status: 'nouveau', data: { confiance: 'sujet' } }))[0];
  const rU = await exE().modifier_site({ reponse_id: usurpe.id, demande: 'Mettre le téléphone 0696 00 00 00' });
  assert.ok(/pas celle du client/.test(rU.erreur || ''), 'site payé : pas de modification depuis une adresse inconnue');
  // 6. envoi raté : réessayé plus tard, pas perdu
  const oR = (await db.insert('hq_outbox', { lead_id: ga.l.id, agent_id: 'livraison', to_email: 'garage@test-mq.fr', subject: 'Test réessai', body: 'x', step: 1, status: 'pret', kind: 'service' }))[0];
  await ENVOI.echec(db, oR, Object.assign(new Error('421 4.7.0 Try again later'), { responseCode: 421 }));
  let oR2 = db.tables.hq_outbox.find(function (o) { return o.id === oR.id; });
  assert.ok(oR2.status === 'pret' && oR2.essais === 1 && !ENVOI.pretARessayer(oR2), 'erreur passagère : réessai programmé');
  oR2.updated_at = new Date(Date.now() - 20 * 60000).toISOString();
  assert.ok(ENVOI.pretARessayer(oR2), 'réessai au bout de 15 minutes');
  await ENVOI.echec(db, oR2, Object.assign(new Error('550 5.1.1 <x>: Recipient address rejected: User unknown'), { responseCode: 550 }));
  assert.ok(db.tables.hq_outbox.find(function (o) { return o.id === oR.id; }).status === 'erreur' && db.tables.hq_suppression.some(function (x) { return x.email === 'garage@test-mq.fr'; }), 'adresse refusée : définitif');
  // 7. aperçu expiré : remis en ligne (même lien) dès qu'il revient
  const ex1 = await nouveauClient('expire-test', 'Expire Test', 'expire@test-mq.fr');
  await db.update('hq_sites', { status: 'expire' }, { eq: { id: ex1.s.id } });
  const rv = await exE().preparer_apercu({ reponse_id: ex1.ib.id });
  assert.ok(/remis en ligne/.test(rv) && rv.indexOf(ex1.s.url_apercu) >= 0 && leSite(ex1.s.id).status === 'apercu', 'aperçu expiré remis en ligne : ' + rv);
  // 8. zone : un numéro de Guadeloupe sans commune ne passe pas ; un lien nu est vu par le contrôle
  const zz = await tools.executeurs({ db: db, agent: db.tables.hq_agents.find(function (a) { return a.id === 'partenaires'; }), agents: db.tables.hq_agents, budget: env.budget, compteurs: C0() }).ajouter_leads({ leads: [{ nom: 'Cabinet Gwada', telephone: '0590 12 34 56', source_url: 'https://z.fr' }, { nom: 'Cabinet Madinina', telephone: '0596 12 34 56', source_url: 'https://m.fr' }] });
  assert.ok(/1 prospect\(s\) ajouté/.test(zz) && /1 refusé/.test(zz), 'preuve de Martinique exigée : ' + zz);
  assert.ok(!require('../lib/qualite').verifier('reponse', '', 'Bonjour, merci pour votre message. Vous pouvez régler ici : www.payer-vite.com/carte et je lance tout de suite. Bonne journée.', { hotes: ['buy.stripe.com'] }).ok, 'lien sans https détecté');
  // 9. plus de 1 000 lignes : la base pagine (Supabase plafonne chaque requête)
  const gros = []; for (let k = 0; k < 1300; k++) gros.push({ email: 'x' + k + '@vide.fr', reason: 'test' });
  await db.insert('hq_suppression', gros);
  assert.ok((await db.select('hq_suppression', { limit: 5000 })).length >= 1300, 'pagination au-delà de 1 000 lignes');
  db.tables.hq_suppression = db.tables.hq_suppression.filter(function (x) { return x.reason !== 'test'; });
  // 10. relevé des paiements : plus de 60 commandes ouvertes, le paiement d'une nouvelle est vu, en une requête Stripe
  {
    const ouverts = [];
    for (let k = 0; k < 70; k++) ouverts.push({ slug: 'cmd-' + k + '-aaaa', status: 'commande', spec: { nom: 'Cmd ' + k }, stripe: { lien: 'plink_vieux_' + k, liens: [{ id: 'plink_vieux_' + k }], cree_le: new Date(Date.now() - 10 * 86400000).toISOString() } });
    await db.insert('hq_sites', ouverts);
    const gc = await nouveauClient('apres-soixante', 'Apres Soixante', 'apres@test-mq.fr');
    await exE().commande({ reponse_id: gc.ib.id, formule: 'essentiel' });
    const L70 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    fakes.payer(L70.id, { amount_total: 59000, customer_details: { email: 'apres@test-mq.fr', name: 'A' } });
    const parLien0 = fakes.STRIPE.parLien;
    await lucas();
    assert.ok(['paye', 'livraison', 'en_ligne'].indexOf(leSite(gc.s.id).status) >= 0, 'au-delà de 60 commandes ouvertes, le paiement est vu');
    assert.ok(fakes.STRIPE.parLien - parLien0 < 5 && fakes.STRIPE.globales > 0, 'un relevé global, pas une requête par lien : ' + (fakes.STRIPE.parLien - parLien0));
    // une commande jamais payée expire 45 jours après son lien, même si un déploiement vient de dater le site
    db.tables.hq_sites.filter(function (x) { return /^cmd-/.test(x.slug); }).forEach(function (x) { x.stripe.cree_le = new Date(Date.now() - 50 * 86400000).toISOString(); x.updated_at = new Date().toISOString(); });
    await LIV.expirer(db, { force: true });
    assert.ok(db.tables.hq_sites.filter(function (x) { return /^cmd-/.test(x.slug); }).every(function (x) { return x.status === 'expire'; }), 'commandes de plus de 45 jours expirées, sans plafond');
  }
  // 11. 35 clients qui ne font jamais leur réglage DNS ne bloquent pas un nouveau site payé
  {
    const bloques = [];
    for (let k = 0; k < 35; k++) bloques.push({ slug: 'dns-' + k + '-bbbb', status: 'livraison', domaine: 'client' + k + '.fr', domaine_mode: 'client', spec: { nom: 'Dns ' + k }, paid_at: new Date(Date.now() - 20 * 86400000).toISOString(), data: { live: true, live_publie: new Date().toISOString(), domaine_ajoute: true, dns_demande: new Date(Date.now() - 20 * 86400000).toISOString(), rappels_dns: 4 } });
    await db.insert('hq_sites', bloques);
    const gn = await nouveauClient('apres-dns', 'Apres Dns', 'apresdns@test-mq.fr');
    await exE().commande({ reponse_id: gn.ib.id, formule: 'essentiel' });
    const LN = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    fakes.payer(LN.id, { amount_total: 59000, customer_details: { email: 'apresdns@test-mq.fr', name: 'N' } });
    fakes.FAUX_EN_LIGNE.add(leSite(gn.s.id).domaine);
    await lucas(); await lucas(); await lucas();
    assert.strictEqual(leSite(gn.s.id).status, 'en_ligne', 'le nouveau site passe malgré 35 sites en attente de DNS');
    assert.ok(db.tables.hq_sites.filter(function (x) { return /^dns-/.test(x.slug); }).every(function (x) { return x.data.dns_verifie_le; }), 'les sites en attente sont vérifiés, puis espacés');
  }
  // 12. un sous-domaine de constructeur (Wix) n'est jamais pris pour le domaine du client
  {
    const gw = await nouveauClient('garage-wix', 'Garage Wix', 'wix@test-mq.fr');
    await db.update('hq_leads', { domain: 'garage-wix.wixsite.com', website: 'https://garage-wix.wixsite.com/site' }, { eq: { id: gw.l.id } });
    await exE().commande({ reponse_id: gw.ib.id, formule: 'essentiel' });
    const sw = leSite(gw.s.id);
    assert.ok(sw.domaine_mode === 'achat' && /\.com$/.test(sw.domaine) && !/wixsite/.test(sw.domaine), 'sous-domaine Wix : un vrai nom de domaine est réservé : ' + sw.domaine);
  }
  // 13. Emma et Lucas en même temps : un paiement relevé pendant la commande n'est pas écrasé ; une retouche
  // n'efface pas la commande du domaine posée pendant l'écriture de la fiche
  {
    const gr = await nouveauClient('course-test', 'Course Test', 'course@test-mq.fr');
    await exE().commande({ reponse_id: gr.ib.id, formule: 'essentiel' });
    const S2 = require('../lib/sites/stripe'), creer = S2.creerLien;
    S2.creerLien = async function (o) { const r = await creer(o); const x = db.tables.hq_sites.find(function (y) { return y.id === gr.s.id; }); x.status = 'paye'; x.updated_at = new Date(Date.now() + 5).toISOString(); return r; };
    const cr = await exE().commande({ reponse_id: gr.ib.id, formule: 'vitrine' });
    S2.creerLien = creer;
    const Lc = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    assert.ok(/changer d'état/.test(cr.erreur || '') && leSite(gr.s.id).status === 'paye' && fakes.STRIPE.desactives.indexOf(Lc.id) >= 0, 'paiement relevé pendant la commande : rien d\'écrasé, le lien en trop est coupé');
    db.tables.hq_sites.find(function (y) { return y.id === gr.s.id; }).status = 'annule';
    const A = require('../lib/sites/atelier'), ecrireA = A.ecrire;
    const gm = await nouveauClient('retouche-course', 'Retouche Course', 'rc@test-mq.fr');
    db.tables.hq_inbox.find(function (x) { return x.id === gm.ib.id; }).data.confiance = 'fil';
    Object.assign(db.tables.hq_sites.find(function (y) { return y.id === gm.s.id; }), { status: 'livraison', domaine: 'retouche-course.com', domaine_mode: 'achat', paid_at: new Date().toISOString() });
    A.ecrire = async function (l, o) { const r = await ecrireA(l, o); const y = db.tables.hq_sites.find(function (z) { return z.id === gm.s.id; }); y.data = Object.assign({}, y.data, { commande: { id: 'ord_x', domaine: 'retouche-course.com' } }); y.updated_at = new Date(Date.now() + 5).toISOString(); return r; };
    const rm = await exE().modifier_site({ reponse_id: gm.ib.id, demande: 'Passer en turquoise' });
    A.ecrire = ecrireA;
    assert.ok(/site modifié/.test(rm) && leSite(gm.s.id).data.commande && leSite(gm.s.id).data.commande.id === 'ord_x' && leSite(gm.s.id).version === 2, 'retouche : la commande du domaine posée pendant ce temps est gardée : ' + rm);
    db.tables.hq_sites.find(function (y) { return y.id === gm.s.id; }).status = 'annule';
  }
  // 14. retouches : celles d'avant le paiement ne mangent pas les deux promises après la mise en ligne
  {
    const gt = await nouveauClient('retouches-test', 'Retouches Test', 'rt@test-mq.fr');
    db.tables.hq_inbox.find(function (x) { return x.id === gt.ib.id; }).data.confiance = 'fil';
    Object.assign(db.tables.hq_sites.find(function (y) { return y.id === gt.s.id; }), { status: 'en_ligne', revisions: 3, live_at: new Date().toISOString(), domaine: 'retouches-test.com', domaine_mode: 'achat', data: { revisions_au_paiement: 3 } });
    const r1 = await exE().modifier_site({ reponse_id: gt.ib.id, demande: 'Ajouter le samedi aux horaires' });
    assert.ok(/site modifié/.test(r1) && /1 retouche/.test(r1), 'après la mise en ligne, ses deux retouches sont là : ' + r1);
    db.tables.hq_sites.find(function (y) { return y.id === gt.s.id; }).status = 'annule';
  }
  // 15. usurpation par l'adresse : sans authentification de son serveur (en-tête replié compris), pas vérifié ;
  // authentifié, vérifié ; et un STOP dans l'objet (lien de désinscription) vaut STOP
  {
    const gu = await nouveauClient('usurpe-test', 'Usurpe Test', 'patron@usurpe-mq.fr');
    await db.insert('hq_outbox', { lead_id: gu.l.id, to_email: 'patron@usurpe-mq.fr', subject: 'Le site de Usurpe Test', body: 'x', status: 'envoye', kind: 'prospection', step: 1, sent_at: new Date().toISOString(), message_id: '<hq.999.abcdef12@novalemo-mq.fr>' });
    uid++;
    aRelever.push({ uid: uid, messageId: '<faux' + uid + '@x.fr>', from: 'patron@usurpe-mq.fr', subject: 'Nouveau numéro', headers: '', source: Buffer.from('Authentication-Results: mx1.mail.ovh.net;\r\n spf=fail smtp.mailfrom=patron@usurpe-mq.fr;\r\n dkim=pass header.d=pirate.com;\r\n dmarc=fail header.from=usurpe-mq.fr\r\nFrom: patron@usurpe-mq.fr\r\nSubject: Nouveau numéro\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nMettez le 0696 00 00 00 sur le site.\r\n') });
    uid++;
    aRelever.push({ uid: uid, messageId: '<vrai' + uid + '@x.fr>', from: 'patron@usurpe-mq.fr', subject: 'Nos horaires', headers: '', source: Buffer.from('Authentication-Results: mx1.mail.ovh.net; spf=pass smtp.mailfrom=patron@usurpe-mq.fr; dkim=pass header.d=usurpe-mq.fr; dmarc=pass header.from=usurpe-mq.fr\r\nFrom: patron@usurpe-mq.fr\r\nSubject: Nos horaires\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nNous ouvrons le samedi.\r\n') });
    await BOITE.releve({ db: db });
    const faux = db.tables.hq_inbox.find(function (x) { return x.subject === 'Nouveau numéro'; }), vrai = db.tables.hq_inbox.find(function (x) { return x.subject === 'Nos horaires'; });
    assert.ok(faux && faux.data.confiance === 'douteux' && vrai && vrai.data.confiance === 'adresse', 'faux expéditeur repéré, vrai reconnu');
    uid++;
    aRelever.push({ uid: uid, messageId: '<desabo' + uid + '@x.fr>', from: 'patron@usurpe-mq.fr', subject: 'STOP', headers: 'Auto-Submitted: auto-generated\r\n', source: Buffer.from('Subject: STOP\r\nAuto-Submitted: auto-generated\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n') });
    await BOITE.releve({ db: db });
    assert.ok(db.tables.hq_suppression.some(function (x) { return x.email === 'patron@usurpe-mq.fr'; }), 'STOP dans l\'objet (lien de désinscription) : appliqué');
  }
  // 16. envois : une erreur passagère n'est jamais définitive ; un refus d'authentification vient de notre domaine
  // (prospect gardé, pas de fausse alerte de mot de passe) ; un email annulé pendant l'attente ne part pas ; un client
  // payé qui a dit STOP reçoit quand même la réponse à sa question ; un verrou n'est effacé que par son détenteur
  {
    const ol = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:smtp', source: 'maps', name: 'Smtp Test', island: 'MQ', email: 'smtp@test-mq.fr', status: 'brouillon', score: 60 }))[0];
    const o1 = (await db.insert('hq_outbox', { lead_id: ol.id, to_email: 'smtp@test-mq.fr', subject: 'x', body: 'y', status: 'pret', kind: 'prospection', step: 1 }))[0];
    await ENVOI.echec(db, o1, Object.assign(new Error('450 4.2.1 Mailbox unavailable, try again later'), { responseCode: 450 }));
    assert.ok(db.tables.hq_outbox.find(function (o) { return o.id === o1.id; }).status === 'pret' && !db.tables.hq_suppression.some(function (x) { return x.email === 'smtp@test-mq.fr'; }), '4xx « mailbox unavailable » : réessayé, adresse gardée');
    const alertes0 = db.tables.hq_messages.filter(function (m) { return /connexion refusée/.test(m.subject || ''); }).length;
    await ENVOI.echec(db, db.tables.hq_outbox.find(function (o) { return o.id === o1.id; }), Object.assign(new Error('550 5.7.26 This message does not pass authentication checks (SPF and DKIM both do not pass)'), { responseCode: 550 }));
    const o1b = db.tables.hq_outbox.find(function (o) { return o.id === o1.id; });
    assert.ok(o1b.status === 'erreur' && /^politique/.test(o1b.error) && db.tables.hq_leads.find(function (l) { return l.id === ol.id; }).status === 'a_contacter' && db.tables.hq_messages.filter(function (m) { return /connexion refusée/.test(m.subject || ''); }).length === alertes0 && db.tables.hq_messages.some(function (m) { return /authentification du domaine/.test(m.subject || ''); }), 'refus d\'authentification : notre domaine, prospect gardé, bonne alerte');
    const o2 = (await db.insert('hq_outbox', { lead_id: ol.id, to_email: 'smtp@test-mq.fr', subject: 'x2', body: 'y', status: 'pret', kind: 'service', step: 1 }))[0];
    const copie = Object.assign({}, o2);
    db.tables.hq_outbox.find(function (o) { return o.id === o2.id; }).status = 'annule';
    partis.length = 0;
    const rA = await ENVOI.envoyerUn(db, copie);
    assert.ok(!rA.ok && !partis.length, 'annulé pendant l\'attente entre deux envois : rien ne part');
    const gs = await nouveauClient('stop-client', 'Stop Client', 'stopclient@test-mq.fr');
    db.tables.hq_sites.find(function (y) { return y.id === gs.s.id; }).status = 'en_ligne';
    await db.upsert('hq_suppression', { email: 'stopclient@test-mq.fr', reason: 'STOP reçu' }, { onConflict: 'email' });
    const rS = await exE().repondre({ reponse_id: gs.ib.id, corps: 'Bonjour,\n\nMerci pour votre message. Les horaires du samedi sont bien ajoutés à votre site.\n\nLouis\nNovalemo, sites internet en Martinique' });
    const oS = db.tables.hq_outbox.filter(function (o) { return o.lead_id === gs.l.id && o.kind === 'reponse'; }).pop();
    partis.length = 0;
    const rS2 = oS ? await ENVOI.envoyerUn(db, oS) : { ok: false };
    assert.ok(!(rS && rS.erreur) && rS2.ok && partis.length === 1, 'client payé qui a dit STOP : la réponse à sa question part : ' + JSON.stringify(rS));
    db.tables.hq_sites.find(function (y) { return y.id === gs.s.id; }).status = 'annule';
    const RT = require('../lib/runtime');
    assert.ok(await RT.verrouiller(db, 'essai', 60, 'A'), 'verrou pris');
    await RT.deverrouiller(db, 'essai', 'B');
    assert.ok(!(await RT.verrouiller(db, 'essai', 60, 'C')), 'le verrou d\'un autre n\'est pas effacé');
    await RT.deverrouiller(db, 'essai', 'A');
    assert.ok(await RT.verrouiller(db, 'essai', 60, 'D'), 'libéré par son détenteur');
    await RT.deverrouiller(db, 'essai', 'D');
  }
  // 17. achat de domaine resté sans réponse : retrouvé dans le compte s'il est passé ; sinon, deux heures plus tard, un autre nom
  {
    const ga2 = await nouveauClient('achat-perdu', 'Achat Perdu', 'perdu@test-mq.fr');
    await exE().commande({ reponse_id: ga2.ib.id, formule: 'essentiel' });
    const xs = db.tables.hq_sites.find(function (y) { return y.id === ga2.s.id; });
    Object.assign(xs, { status: 'paye', paid_at: new Date().toISOString(), data: Object.assign({}, xs.data, { achat: { domaine: 'achat-perdu.com', prix: 12.03, le: new Date(Date.now() - 20 * 60000).toISOString() } }) });
    fakes.VERCEL.auCompte.add('achat-perdu.com');
    const achats0 = fakes.VERCEL.achats.length;
    await lucas();
    assert.ok(leSite(ga2.s.id).status !== 'paye' && leSite(ga2.s.id).data.commande && leSite(ga2.s.id).data.commande.recupere && !fakes.VERCEL.achats.slice(achats0).some(function (x) { return /^achat-perdu/.test(x.domaine); }), 'achat sans réponse retrouvé dans le compte : pas de second achat');
    const gb = await nouveauClient('achat-rate', 'Achat Rate', 'rate@test-mq.fr');
    await exE().commande({ reponse_id: gb.ib.id, formule: 'essentiel' });
    const ys = db.tables.hq_sites.find(function (y) { return y.id === gb.s.id; });
    Object.assign(ys, { status: 'paye', paid_at: new Date().toISOString(), data: Object.assign({}, ys.data, { achat: { domaine: 'achat-rate.com', prix: 12.03, le: new Date(Date.now() - 3 * 3600000).toISOString() } }) });
    fakes.VERCEL.pris.add('achat-rate.com');
    await lucas(); await lucas();
    const yd = leSite(gb.s.id);
    assert.ok((yd.data.commande_ratee || []).indexOf('achat-rate.com') >= 0 && yd.domaine && yd.domaine !== 'achat-rate.com', 'achat jamais confirmé ni dans le compte : un autre nom : ' + yd.domaine);
  }
  // 18. domaine déjà sur notre projet : branché ; sur un autre projet : refusé ; les chemins de Vercel jamais réécrits
  {
    const V2 = require('../lib/sites/vercel');
    const pj = (await P.lireEtat(db)).projet;
    fakes.VERCEL.domaines['deja-chez-nous.fr'] = { name: 'deja-chez-nous.fr' };
    const okD = await V2.ajouterDomaine(pj.id, 'deja-chez-nous.fr');
    fakes.VERCEL.ailleurs.add('chez-un-autre.fr');
    const koD = await V2.ajouterDomaine(pj.id, 'chez-un-autre.fr').then(function () { return 'branché'; }).catch(function (e) { return e.statut; });
    assert.ok(okD.deja && okD.name === 'deja-chez-nous.fr' && koD === 409, 'domaine déjà sur notre projet : branché ; sur un autre projet : refusé');
    const vj2 = JSON.parse(P.vercelJson([{ slug: 'x-1a2b', domaine: 'x.com' }]).toString());
    assert.ok(vj2.rewrites.some(function (r) { return r.source.indexOf('(?!_vercel/)') >= 0; }), 'les chemins de Vercel (/_vercel/image) ne sont jamais réécrits');
  }
  // 19. clé de test : aucun lien de renouvellement inutilisable envoyé à un vrai client
  {
    process.env.HQ_STRIPE_KEY = 'sk_test_essai';
    const liens0 = fakes.STRIPE.liens.length;
    ren().jusqu_au = new Date(Date.now() + 10 * 86400000).toISOString();
    const rt = await LIV.renouvellements(db);
    process.env.HQ_STRIPE_KEY = 'sk_live_simulation';
    assert.ok(fakes.STRIPE.liens.length === liens0 && rt.liens === 0, 'clé de test : pas de lien de renouvellement');
    ren().jusqu_au = new Date(Date.now() + 365 * 86400000).toISOString();
  }
  // 20. zone : Lamentin et Sainte-Anne seuls ne prouvent rien (ces noms existent aussi en Guadeloupe)
  {
    const zr = await tools.executeurs({ db: db, agent: db.tables.hq_agents.find(function (a) { return a.id === 'partenaires'; }), agents: db.tables.hq_agents, budget: env.budget, compteurs: C0() }).ajouter_leads({ leads: [{ nom: 'Cabinet Lamentin', commune: 'Lamentin', email: 'a@lamentin-x.fr', source_url: 'https://l.fr' }, { nom: 'Cabinet Anne', commune: 'Sainte-Anne', email: 'b@anne-x.fr', source_url: 'https://a.fr' }, { nom: 'Cabinet Schoelcher', commune: 'Schœlcher', email: 'c@schoelcher-x.fr', source_url: 'https://s.fr' }, { nom: 'Cabinet Anne MQ', commune: '97227 Sainte-Anne', email: 'd@anne-mq.fr', source_url: 'https://d.fr' }] });
    assert.ok(/2 prospect\(s\) ajouté/.test(zr) && /2 refusé/.test(zr), 'communes partagées : preuve exigée : ' + zr);
  }
  // 21. deux paiements dans le même quart d'heure (ancien onglet Essentiel, puis Vitrine) : la dernière formule demandée
  // est gardée, l'autre remboursée
  {
    const gd = await nouveauClient('deux-paiements', 'Deux Paiements', 'deux@test-mq.fr');
    await exE().commande({ reponse_id: gd.ib.id, formule: 'essentiel' });
    const D1 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    await exE().commande({ reponse_id: gd.ib.id, formule: 'vitrine' });
    const D2 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    fakes.payer(D2.id, { amount_total: 99000, customer_details: { email: 'deux@test-mq.fr', name: 'D' } });
    fakes.payer(D1.id, { amount_total: 59000, customer_details: { email: 'deux@test-mq.fr', name: 'D' } });
    await lucas();
    assert.ok(leSite(gd.s.id).formule === 'vitrine' && Number(leSite(gd.s.id).montant_eur) === 990 && fakes.STRIPE.rembourses.indexOf('pi_' + D1.id) >= 0, 'deux paiements : la Vitrine demandée en dernier est gardée, l\'Essentiel remboursé');
  }
  // 22. Stripe ne répond plus au relevé global : vérification lien par lien, rien n'est perdu
  {
    const gp2 = await nouveauClient('panne-stripe', 'Panne Stripe', 'panne@test-mq.fr');
    await exE().commande({ reponse_id: gp2.ib.id, formule: 'essentiel' });
    const LP = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    fakes.payer(LP.id, { amount_total: 59000, customer_details: { email: 'panne@test-mq.fr', name: 'P' } });
    fakes.STRIPE.listeEnPanne = true;
    await lucas();
    fakes.STRIPE.listeEnPanne = false;
    assert.ok(['paye', 'livraison', 'en_ligne'].indexOf(leSite(gp2.s.id).status) >= 0, 'relevé global en panne : le paiement est vu quand même');
  }
  // 23. paiement arrivé sur une commande close : aperçu expiré entre-temps, la commande rouvre et s'encaisse ;
  // commande annulée par Louis, le client est remboursé
  {
    const ge = await nouveauClient('paye-expire', 'Paye Expire', 'expire2@test-mq.fr');
    await exE().commande({ reponse_id: ge.ib.id, formule: 'essentiel' });
    const LE = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    const xe = db.tables.hq_sites.find(function (y) { return y.id === ge.s.id; });
    Object.assign(xe, { status: 'expire', stripe: Object.assign({}, xe.stripe, { lien: null, url: null }) });
    fakes.payer(LE.id, { amount_total: 59000, customer_details: { email: 'expire2@test-mq.fr', name: 'E' } });
    const ga3 = await nouveauClient('paye-annule', 'Paye Annule', 'annule@test-mq.fr');
    await exE().commande({ reponse_id: ga3.ib.id, formule: 'essentiel' });
    const LA = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    db.tables.hq_sites.find(function (y) { return y.id === ga3.s.id; }).status = 'annule';
    fakes.payer(LA.id, { amount_total: 59000, customer_details: { email: 'annule@test-mq.fr', name: 'X' } });
    await lucas();
    assert.ok(['paye', 'livraison', 'en_ligne'].indexOf(leSite(ge.s.id).status) >= 0, 'payé juste après l\'expiration : la commande rouvre et s\'encaisse');
    assert.ok(fakes.STRIPE.rembourses.indexOf('pi_' + LA.id) >= 0 && db.tables.hq_outbox.some(function (o) { return o.lead_id === ga3.l.id && /remboursé/.test(o.subject); }), 'payé sur une commande annulée : remboursé, client prévenu');
  }
  console.log('Garde-fous OK : ancien lien payé, doubles paiements, paiement de test, domaine raté, STOP (objet compris), usurpation (en-têtes), réessais, aperçu expiré, zone, liens nus, pagination, 70 commandes, 35 DNS en attente, Wix, agents en parallèle, retouches, verrous, achat sans réponse, domaines, clé de test, panne Stripe, commandes closes');
  }
  console.log('Pilote automatique OK :', fakes.VERCEL.deploiements.length, 'déploiements,', fakes.STRIPE.liens.length, 'lien(s) de paiement, domaine', site.domaine, ', CA', w.compteurs.ca_eur, '€');
  mail.forcer(null); delete process.env.HQ_MAIL_USER; delete process.env.HQ_MAIL_PASS; delete process.env.HQ_VERCEL_TOKEN; delete process.env.HQ_STRIPE_KEY;

  // 8. budget épuisé = plus aucun appel Claude
  await agir('budget', { jour_usd: 0 });
  const avant = fakes.appels();
  db.tables.hq_agents.forEach(function (a) { if (a.kind === 'llm' || a.id === 'demo') { a.next_run_at = new Date(Date.now() - 60000).toISOString(); a.status = 'idle'; } });
  await runtime.cycle({ db: db, secondes: 250 });
  assert.strictEqual(fakes.appels(), avant, 'plafond respecté');

  // 9. mode démo (sans base)
  DB.forcer(null);
  const d = await world.monde(null);
  assert.ok(d.demo && d.agents.length === require('../lib/seed').AGENTS.length);
  console.log('Démo OK. Tout est vert en', Math.round((Date.now() - t0) / 100) / 10, 's');
})().catch(function (e) { console.error('ÉCHEC :', e); process.exit(1); });
