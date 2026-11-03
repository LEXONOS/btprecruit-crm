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
  assert.ok(site.spec.da && site.spec.da.v === 3 && site.spec.da.modele === 'atelier' && site.spec.da.hero !== 'nu' && site.spec.photos.every(function (p) { return !p.credit; }), 'avec ses photos : le modèle Atelier, un haut de page qui les montre, aucune photo de banque : ' + JSON.stringify(site.spec.da));
  assert.ok(site.spec.metier === 'Climatisation' && site.spec.accroche === 'Pose, entretien et dépannage de climatiseurs pour les maisons et les commerces.', 'grand titre clair et phrase concrète, après le refus de la formule vide : ' + site.spec.metier + ' / ' + site.spec.accroche);
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
  assert.ok(site.revisions === 1 && site.version === 2 && site.spec.accent === '#0e9aa7' && /logo-/.test(site.spec.logo.fichier) && site.spec.contact.horaires[0] === 'Lundi au vendredi : 7 h 30 à 17 h', 'retouche faite : couleur, horaires, logo du client');
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
  const lienStripe = fakes.STRIPE.liens.find(function (x) { return x.id === site.stripe.lien; });
  const lienMois = fakes.STRIPE.liens.find(function (x) { return x.id === site.stripe.lien_mois; });
  assert.ok(lienMois && lienMois.mensuel && lienMois.montant === 8900 && lienMois.params['subscription_data[metadata][site_id]'] === String(site.id) && !lienMois.params['invoice_creation[enabled]'], 'deux liens : en une fois et au mois (89 €, abonnement)');
  assert.ok(lienStripe.params['line_items[0][price]'] && lienStripe.params['metadata[site_id]'] === String(site.id) && lienStripe.params['restrictions[completed_sessions][limit]'] === '1' && /\/_n\/merci\/$/.test(lienStripe.params['after_completion[redirect][url]']), 'lien Stripe bien formé');
  const rCmd = db.tables.hq_outbox.filter(function (o) { return o.lead_id === lc.id && o.kind === 'reponse'; }).pop();
  assert.ok(rCmd.body.indexOf(lienStripe.url) >= 0 && rCmd.body.indexOf(lienMois.url) >= 0 && rCmd.status === 'pret', 'les deux liens de paiement partent dans la réponse');
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
  assert.ok(/RCS Fort-de-France 912 345 678/.test(ml) && /SIRET 912 345 678 00017/.test(ml) && /Directeur de la publication : Jean DUPONT/.test(ml) && /Vercel Inc\.<br>340 S Lemon Ave #4133, Walnut, CA 91789/.test(ml) && /NOVALEM/.test(ml) && !/class="apercu"/.test(live.files[0].data) && !/noindex/.test(live.files[0].data), 'mentions légales du client, site public');
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
  const gc1 = await exE().commande({ reponse_id: ga.ib.id, formule: 'essentiel', paiement: 'une_fois' });
  const L1 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  const gc2 = await exE().commande({ reponse_id: ga.ib.id, formule: 'vitrine', paiement: 'une_fois' });
  const L2 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  assert.ok(gc1.lien_paiement && gc2.lien_paiement && L1.id !== L2.id && leSite(ga.s.id).stripe.liens.length === 2 && fakes.STRIPE.desactives.indexOf(L1.id) >= 0, 'changement de formule : nouveau lien, l\'ancien reste suivi');
  fakes.payer(L1.id, { amount_total: 59000, invoice: 'in_g1', customer_details: { email: 'garage@test-mq.fr', name: 'G' } });
  const gc3 = await exE().commande({ reponse_id: ga.ib.id, formule: 'signature', paiement: 'une_fois' });
  assert.ok(/déjà payé/.test(gc3.erreur || ''), 'pas de troisième lien quand un paiement existe');
  await lucas();
  assert.ok(['paye', 'livraison', 'en_ligne'].indexOf(leSite(ga.s.id).status) >= 0 && leSite(ga.s.id).formule === 'essentiel' && Number(leSite(ga.s.id).montant_eur) === 590, 'paiement de l\'ancien lien vu, formule réellement payée : ' + leSite(ga.s.id).status + ' ' + leSite(ga.s.id).formule);
  fakes.payer(L2.id, { amount_total: 99000, invoice: 'in_g2', customer_details: { email: 'garage@test-mq.fr', name: 'G' } });
  await lucas();
  assert.ok(fakes.STRIPE.rembourses.indexOf('pi_' + L2.id) >= 0 && db.tables.hq_outbox.some(function (o) { return o.lead_id === ga.l.id && /double remboursé/.test(o.subject); }), 'second paiement remboursé tout seul, client prévenu');
  // 2. paiement de test (clé ou carte de test) : rien n'est acheté, le site redevient un aperçu
  const tt = await nouveauClient('test-carte', 'Test Carte', 'carte@test-mq.fr');
  await exE().commande({ reponse_id: tt.ib.id, formule: 'essentiel', paiement: 'une_fois' });
  const LT = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
  const achatsAvant = fakes.VERCEL.achats.length;
  fakes.payer(LT.id, { livemode: false, amount_total: 59000 });
  await lucas();
  assert.ok(leSite(tt.s.id).status === 'apercu' && fakes.VERCEL.achats.length === achatsAvant && db.tables.hq_messages.some(function (m) { return /Paiement de test/.test(m.subject || ''); }), 'paiement de test : aucun achat, retour à l\'aperçu');
  process.env.HQ_STRIPE_KEY = 'sk_test_essai';
  const cT = await exE().commande({ reponse_id: tt.ib.id, formule: 'vitrine', paiement: 'une_fois' });
  assert.ok(/mode test/.test(cT.erreur || '') && db.tables.hq_config.some(function (c) { return c.key === 'alerte:stripe_test'; }), 'clé de test : pas de lien inutilisable envoyé à un vrai client');
  process.env.HQ_STRIPE_KEY = 'sk_live_simulation';
  // 3. commande de domaine ratée : ce nom est écarté, Louis prévenu une fois, un autre nom est réservé
  const gfl = await nouveauClient('fleurs-test', 'Fleurs Test', 'fleurs@test-mq.fr');
  await exE().commande({ reponse_id: gfl.ib.id, formule: 'essentiel', paiement: 'une_fois' });
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
    await exE().commande({ reponse_id: gc.ib.id, formule: 'essentiel', paiement: 'une_fois' });
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
    await exE().commande({ reponse_id: gn.ib.id, formule: 'essentiel', paiement: 'une_fois' });
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
    await exE().commande({ reponse_id: gw.ib.id, formule: 'essentiel', paiement: 'une_fois' });
    const sw = leSite(gw.s.id);
    assert.ok(sw.domaine_mode === 'achat' && /\.com$/.test(sw.domaine) && !/wixsite/.test(sw.domaine), 'sous-domaine Wix : un vrai nom de domaine est réservé : ' + sw.domaine);
  }
  // 13. Emma et Lucas en même temps : un paiement relevé pendant la commande n'est pas écrasé ; une retouche
  // n'efface pas la commande du domaine posée pendant l'écriture de la fiche
  {
    const gr = await nouveauClient('course-test', 'Course Test', 'course@test-mq.fr');
    await exE().commande({ reponse_id: gr.ib.id, formule: 'essentiel', paiement: 'une_fois' });
    const S2 = require('../lib/sites/stripe'), creer = S2.creerLien;
    S2.creerLien = async function (o) { const r = await creer(o); const x = db.tables.hq_sites.find(function (y) { return y.id === gr.s.id; }); x.status = 'paye'; x.updated_at = new Date(Date.now() + 5).toISOString(); return r; };
    const cr = await exE().commande({ reponse_id: gr.ib.id, formule: 'vitrine', paiement: 'une_fois' });
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
    await exE().commande({ reponse_id: ga2.ib.id, formule: 'essentiel', paiement: 'une_fois' });
    const xs = db.tables.hq_sites.find(function (y) { return y.id === ga2.s.id; });
    Object.assign(xs, { status: 'paye', paid_at: new Date().toISOString(), data: Object.assign({}, xs.data, { achat: { domaine: 'achat-perdu.com', prix: 12.03, le: new Date(Date.now() - 20 * 60000).toISOString() } }) });
    fakes.VERCEL.auCompte.add('achat-perdu.com');
    const achats0 = fakes.VERCEL.achats.length;
    await lucas();
    assert.ok(leSite(ga2.s.id).status !== 'paye' && leSite(ga2.s.id).data.commande && leSite(ga2.s.id).data.commande.recupere && !fakes.VERCEL.achats.slice(achats0).some(function (x) { return /^achat-perdu/.test(x.domaine); }), 'achat sans réponse retrouvé dans le compte : pas de second achat');
    const gb = await nouveauClient('achat-rate', 'Achat Rate', 'rate@test-mq.fr');
    await exE().commande({ reponse_id: gb.ib.id, formule: 'essentiel', paiement: 'une_fois' });
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
    await exE().commande({ reponse_id: gd.ib.id, formule: 'essentiel', paiement: 'une_fois' });
    const D1 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    await exE().commande({ reponse_id: gd.ib.id, formule: 'vitrine', paiement: 'une_fois' });
    const D2 = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    fakes.payer(D2.id, { amount_total: 99000, customer_details: { email: 'deux@test-mq.fr', name: 'D' } });
    fakes.payer(D1.id, { amount_total: 59000, customer_details: { email: 'deux@test-mq.fr', name: 'D' } });
    await lucas();
    assert.ok(leSite(gd.s.id).formule === 'vitrine' && Number(leSite(gd.s.id).montant_eur) === 990 && fakes.STRIPE.rembourses.indexOf('pi_' + D1.id) >= 0, 'deux paiements : la Vitrine demandée en dernier est gardée, l\'Essentiel remboursé');
  }
  // 22. Stripe ne répond plus au relevé global : vérification lien par lien, rien n'est perdu
  {
    const gp2 = await nouveauClient('panne-stripe', 'Panne Stripe', 'panne@test-mq.fr');
    await exE().commande({ reponse_id: gp2.ib.id, formule: 'essentiel', paiement: 'une_fois' });
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
    await exE().commande({ reponse_id: ge.ib.id, formule: 'essentiel', paiement: 'une_fois' });
    const LE = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    const xe = db.tables.hq_sites.find(function (y) { return y.id === ge.s.id; });
    Object.assign(xe, { status: 'expire', stripe: Object.assign({}, xe.stripe, { lien: null, url: null }) });
    fakes.payer(LE.id, { amount_total: 59000, customer_details: { email: 'expire2@test-mq.fr', name: 'E' } });
    const ga3 = await nouveauClient('paye-annule', 'Paye Annule', 'annule@test-mq.fr');
    await exE().commande({ reponse_id: ga3.ib.id, formule: 'essentiel', paiement: 'une_fois' });
    const LA = fakes.STRIPE.liens[fakes.STRIPE.liens.length - 1];
    db.tables.hq_sites.find(function (y) { return y.id === ga3.s.id; }).status = 'annule';
    fakes.payer(LA.id, { amount_total: 59000, customer_details: { email: 'annule@test-mq.fr', name: 'X' } });
    await lucas();
    assert.ok(['paye', 'livraison', 'en_ligne'].indexOf(leSite(ge.s.id).status) >= 0, 'payé juste après l\'expiration : la commande rouvre et s\'encaisse');
    assert.ok(fakes.STRIPE.rembourses.indexOf('pi_' + LA.id) >= 0 && db.tables.hq_outbox.some(function (o) { return o.lead_id === ga3.l.id && /remboursé/.test(o.subject); }), 'payé sur une commande annulée : remboursé, client prévenu');
  }
  // 24. L'ABONNEMENT AU MOIS de bout en bout : deux liens, paiement au mois, mise en ligne, facture de chaque mois,
  // retouche du mois, prélèvement refusé (prévenu, rappel, pause, retour), engagement, fin d'engagement, arrêt demandé
  {
    const sansThrottle = function () { db.tables.hq_config = db.tables.hq_config.filter(function (c) { return c.key !== 'stripe:abonnements'; }); };
    const ilYa = function (j) { return new Date(Date.now() - j * 86400000).toISOString(); };
    const ab = await nouveauClient('abo-test', 'Abo Test', 'abo@test-mq.fr');
    const cA = await exE().commande({ reponse_id: ab.ib.id, formule: 'essentiel' });
    assert.ok(cA.lien_paiement && cA.lien_mensuel && /49 € par mois/.test(cA.au_mois) && /590 €/.test(cA.en_une_fois), 'commande : les deux façons de payer');
    const sub = 'sub_' + leSite(ab.s.id).stripe.lien_mois;
    fakes.payer(leSite(ab.s.id).stripe.lien_mois, { customer_details: { email: 'abo@test-mq.fr', name: 'A' } });
    fakes.FAUX_EN_LIGNE.add(leSite(ab.s.id).domaine);
    await lucas(); await lucas(); await lucas();
    let sa = leSite(ab.s.id);
    assert.ok(sa.status === 'en_ligne' && sa.data.abonnement && sa.data.abonnement.id === sub && Number(sa.montant_eur) === 49 && /293 B/.test(fakes.STRIPE.pieds['cus_' + sa.stripe.lien_mois] || ''), 'abonnement payé : en ligne, mentions légales posées sur ses factures : ' + sa.status);
    assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === ab.l.id && /abonnement Essentiel à 49 € par mois/.test(o.body); }), 'client prévenu : abonnement en place');
    fakes.mois(sub, true);
    sansThrottle(); await lucas();
    assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === ab.l.id && /^Votre facture/.test(o.subject); }) && leSite(ab.s.id).data.abonnement.paye_eur === 98, 'facture du mois envoyée, encaissé suivi');
    db.tables.hq_inbox.find(function (x) { return x.id === ab.ib.id; }).data.confiance = 'fil';
    const r1 = await exE().modifier_site({ reponse_id: ab.ib.id, demande: 'Ajouter la promotion du mois' });
    const r2 = await exE().modifier_site({ reponse_id: ab.ib.id, demande: 'Changer la photo' });
    assert.ok(/site modifié/.test(r1) && /mois prochain/.test((r2 && r2.erreur) || ''), 'abonné : une retouche chaque mois');
    fakes.mois(sub, false);
    sansThrottle(); await lucas();
    assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === ab.l.id && /pas passé/.test(o.subject) && /invoice\.stripe\.com/.test(o.body); }), 'prélèvement refusé : client prévenu avec le lien pour régler');
    leSite(ab.s.id).data.abonnement.impaye_le = ilYa(8); sansThrottle(); await lucas();
    assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === ab.l.id && /^Rappel : paiement/.test(o.subject); }) && leSite(ab.s.id).status === 'en_ligne', 'rappel à 7 jours, encore en ligne');
    leSite(ab.s.id).data.abonnement.impaye_le = ilYa(15); sansThrottle(); await lucas();
    assert.strictEqual(leSite(ab.s.id).status, 'pause', 'toujours impayé à 14 jours : pause');
    fakes.STRIPE.abonnements[sub].status = 'active'; sansThrottle(); await lucas();
    assert.ok(leSite(ab.s.id).status === 'en_ligne' && !leSite(ab.s.id).data.abonnement.impaye_le, 'réglé : le site revient seul');
    // l'engagement se compte depuis le vrai début de l'abonnement chez Stripe
    const LV = require('../lib/jobs/livraison');
    const ancre = fakes.STRIPE.abonnements[sub].billing_cycle_anchor * 1000;
    assert.ok(Math.abs(Date.parse(leSite(ab.s.id).data.abonnement.engagement_jusqu_au) - LV.plusMois(ancre, 12)) < 1000, 'engagement : 12 mois depuis le début réel de l\'abonnement');
    assert.ok(new Date(LV.plusMois(Date.UTC(2027, 0, 31), 1)).getUTCDate() === 28 && new Date(LV.plusMois(Date.UTC(2028, 1, 29), 12)).getUTCDate() === 28, 'mois comptés comme Stripe : un 31 janvier donne le 28 février');
    // un mois avant la fin : annoncée, rien ne change
    const dans = function (j) { return new Date(Date.now() + j * 86400000).toISOString(); };
    leSite(ab.s.id).data.abonnement.engagement_jusqu_au = dans(20); sansThrottle(); await lucas();
    assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === ab.l.id && /fin de l'engagement le/.test(o.subject) && /répondez simplement/.test(o.body); }) && fakes.STRIPE.abonnements[sub].status === 'active', 'fin d\'engagement annoncée un mois avant, l\'abonnement continue');
    // arrêt demandé pendant l'engagement : enregistré, programmé chez Stripe à la fin du mois payé qui couvre la fin de l'engagement
    const rr = await exE().resilier_abonnement({ reponse_id: ab.ib.id });
    const ca = fakes.STRIPE.abonnements[sub].cancel_at;
    assert.ok(rr.arret_programme && /engagement/.test(rr.consigne || '') && ca && Math.abs(ca * 1000 - (LV.plusMois(ancre, 1) - 3600000)) < 2000 && fakes.STRIPE.abonnements[sub].proration_behavior === 'none' && !fakes.STRIPE.abonnements[sub].cancel_at_period_end && leSite(ab.s.id).data.abonnement.resiliation_demandee, 'arrêt pendant l\'engagement : programmé à la fin de l\'engagement, aucune mensualité de plus : ' + JSON.stringify(rr));
    assert.ok(/déjà demandé/.test(await exE().resilier_abonnement({ reponse_id: ab.ib.id })), 'demande répétée : rien de plus');
    assert.ok(LV.momentArret({ engagement_jusqu_au: ilYa(3) }, null).fin_periode && LV.momentArret({ engagement_jusqu_au: dans(200) }, null) === null, 'après l\'engagement : fin du mois en cours ; début inconnu : on attend de le lire chez Stripe');
    // l'arrêt arrive : le site reste à lui, l'hébergement passe à 25 € par an
    fakes.STRIPE.abonnements[sub].status = 'canceled'; fakes.STRIPE.abonnements[sub].ended_at = ca;
    leSite(ab.s.id).live_at = ilYa(400);
    sansThrottle(); await lucas();
    sa = leSite(ab.s.id);
    assert.ok(sa.status === 'en_ligne' && !sa.data.abonnement && sa.data.renouvellement && sa.data.renouvellement.jusqu_au && sa.data.renouvellement.lien, 'abonnement fini : le site reste à lui, l\'hébergement passe à 25 € par an (lien envoyé)');
    assert.ok(db.tables.hq_outbox.some(function (o) { return o.lead_id === ab.l.id && /^Fin de votre abonnement/.test(o.subject); }), 'client prévenu de la fin');
    // deux paiements pour la même commande (en une fois et au mois) : on garde le paiement en une fois, l'abonnement est arrêté et remboursé
    const dd = await nouveauClient('deux-modes', 'Deux Modes', 'modes@test-mq.fr');
    await exE().commande({ reponse_id: dd.ib.id, formule: 'essentiel' });
    const sd = leSite(dd.s.id).stripe;
    fakes.payer(sd.lien_mois, { customer_details: { email: 'modes@test-mq.fr', name: 'M' } });
    fakes.payer(sd.lien, { amount_total: 59000, customer_details: { email: 'modes@test-mq.fr', name: 'M' } });
    await lucas();
    assert.ok(!leSite(dd.s.id).data.abonnement && Number(leSite(dd.s.id).montant_eur) === 590 && fakes.STRIPE.annules.indexOf('sub_' + sd.lien_mois) >= 0 && fakes.STRIPE.rembourses.some(function (x) { return /in_sub_/.test(x); }), 'payé deux fois : paiement en une fois gardé, abonnement arrêté et remboursé');
    // abonnement arrêté par Stripe faute de paiement : pause, lien pour reprendre, payé, le site revient
    const ar = await nouveauClient('abo-arret', 'Abo Arret', 'arret@test-mq.fr');
    await exE().commande({ reponse_id: ar.ib.id, formule: 'essentiel', paiement: 'mensuel' });
    const subA = 'sub_' + leSite(ar.s.id).stripe.lien_mois;
    assert.ok(!leSite(ar.s.id).stripe.lien, 'au mois seulement : un seul lien');
    fakes.payer(leSite(ar.s.id).stripe.lien_mois, { customer_details: { email: 'arret@test-mq.fr', name: 'R' } });
    fakes.FAUX_EN_LIGNE.add(leSite(ar.s.id).domaine);
    await lucas(); await lucas(); await lucas();
    assert.strictEqual(leSite(ar.s.id).status, 'en_ligne', 'abonné en ligne');
    fakes.STRIPE.abonnements[subA].status = 'canceled';
    sansThrottle(); await lucas();
    const sr = leSite(ar.s.id);
    assert.ok(sr.status === 'pause' && sr.data.abonnement.lien_reprise && db.tables.hq_outbox.some(function (o) { return o.lead_id === ar.l.id && o.body.indexOf(sr.data.abonnement.url_reprise) >= 0; }), 'arrêté faute de paiement : pause et lien de reprise envoyé');
    const lienReprise = sr.data.abonnement.lien_reprise;
    fakes.payer(lienReprise, { customer_details: { email: 'arret@test-mq.fr', name: 'R' } });
    await lucas();
    assert.ok(leSite(ar.s.id).status === 'en_ligne' && leSite(ar.s.id).data.abonnement.id === 'sub_' + lienReprise && leSite(ar.s.id).data.abonnement.statut === 'active', 'reprise payée : nouvel abonnement, site remis en ligne');
    console.log('Abonnement OK : deux liens, prélèvements, facture mensuelle, retouche du mois, impayé, pause, reprise, engagement, arrêt, double paiement');
  }
  // 25. WhatsApp : la demande mesurée tant qu'il n'est pas branché ; puis branché, le client écrit, il est reconnu par son
  // numéro, Emma répond sur WhatsApp ; plus de 24 h après son message, la réponse part par email ; STOP respecté
  {
    const WAJ = require('../lib/jobs/whatsapp');
    assert.ok(WAJ.demandeDe('Vous avez WhatsApp ? Ce serait plus simple') === 'whatsapp' && WAJ.demandeDe('Appelez-moi demain') === 'appel' && !WAJ.demandeDe('Combien ça coûte ?'), 'demande de WhatsApp ou d\'appel reconnue dans un email');
    for (let k = 0; k < 3; k++) { const c = await nouveauClient('wa-dem-' + k, 'Wa Dem ' + k, 'wadem' + k + '@test-mq.fr'); const ibw = db.tables.hq_inbox.find(function (x) { return x.id === c.ib.id; }); ibw.data.demande = 'whatsapp'; ibw.received_at = new Date().toISOString(); }
    await WAJ.surveillerDemande(db);
    assert.ok(db.tables.hq_messages.some(function (m) { return m.to_id === 'louis' && /WhatsApp : la demande est là/.test(m.subject || ''); }), 'seuil atteint : Louis prévenu, la mission WhatsApp l\'attend');
    process.env.HQ_WHATSAPP_KEY = 'kapso_test'; process.env.HQ_WHATSAPP_NUMERO = '1234567890'; process.env.HQ_WHATSAPP_TEL = '+596 696 99 88 77';
    const cw = await nouveauClient('wa-client', 'Wa Client', 'waclient@test-mq.fr');
    await db.update('hq_leads', { phone: '0696 55 44 33' }, { eq: { id: cw.l.id } });
    fakes.recuWhatsApp('+596696554433', 'Bonjour, je préfère WhatsApp. Vous pouvez mettre mes horaires du samedi ?', 'Patron Wa');
    fakes.recuWhatsApp('+596696000111', 'Bonjour, vous faites des sites ?', 'Inconnu');
    const rw = await WAJ.releve({ db: db });
    const iw = db.tables.hq_inbox.find(function (x) { return x.from_email === 'wa:+596696554433'; });
    const inc = db.tables.hq_leads.find(function (l) { return l.dedupe === 'wa:+596696000111'; });
    assert.ok(rw.nouveaux === 2 && iw && iw.lead_id === cw.l.id && iw.data.confiance === 'whatsapp' && inc && inc.island === 'MQ' && inc.source === 'whatsapp', 'WhatsApp relevé : client reconnu par son numéro, inconnu devenu prospect');
    const rep = await exE().repondre({ reponse_id: iw.id, corps: 'Bonjour, c\'est noté, j\'ajoute vos horaires du samedi aujourd\'hui. Louis, Novalemo' });
    const ow = db.tables.hq_outbox.filter(function (o) { return o.inbox_id === iw.id; }).pop();
    assert.ok(!(rep && rep.erreur) && ow && ow.to_email === 'wa:+596696554433' && !ow.in_reply_to, 'Emma répond sur WhatsApp : ' + JSON.stringify(rep));
    const envW = await ENVOI.envoyerUn(db, ow);
    assert.ok(envW.ok && fakes.KAPSO.envoyes.some(function (c) { return c.to === '596696554433' && /samedi/.test(c.text.body); }), 'réponse partie sur WhatsApp');
    // plus de 24 h après son dernier message : la réponse part par email
    iw.received_at = new Date(Date.now() - 25 * 3600000).toISOString();
    db.tables.hq_inbox.filter(function (x) { return x.from_email === 'wa:+596696554433'; }).forEach(function (x) { x.received_at = iw.received_at; });
    const ow2 = (await db.insert('hq_outbox', { lead_id: cw.l.id, agent_id: 'reponses', to_email: 'wa:+596696554433', subject: 'WhatsApp', body: 'Bonjour, c\'est en ligne, dites-moi si tout vous va. Louis, Novalemo', step: 1, status: 'pret', kind: 'reponse', inbox_id: iw.id }))[0];
    const r24 = ow2 ? await ENVOI.envoyerUn(db, ow2) : null;
    assert.ok(r24 && !r24.ok && db.tables.hq_outbox.find(function (o) { return o.id === ow2.id; }).to_email === 'waclient@test-mq.fr', 'fenêtre de 24 h fermée : la réponse repart par email');
    fakes.recuWhatsApp('+596696000111', 'STOP', 'Inconnu');
    await WAJ.releve({ db: db });
    assert.strictEqual(db.tables.hq_leads.find(function (l) { return l.dedupe === 'wa:+596696000111'; }).status, 'stop', 'STOP sur WhatsApp respecté');
    delete process.env.HQ_WHATSAPP_KEY; delete process.env.HQ_WHATSAPP_NUMERO; delete process.env.HQ_WHATSAPP_TEL;
    console.log('WhatsApp OK : demande mesurée, alerte, relève, numéro reconnu, réponse WhatsApp, repli email après 24 h, STOP');
  }
  // 26. MISSIONS : chaque code est essayé avant d'être enregistré, la tour l'écrit elle-même dans Vercel et redémarre
  {
    const M = require('../lib/missions');
    const e0 = await M.etat(db);
    const br = e0.missions.find(function (m) { return m.id === 'brancher'; });
    assert.ok(br && br.etapes.length === 9 && br.etapes.some(function (x) { return x.id === 'photos' && !x.fait; }) && br.etapes.find(function (x) { return x.id === 'vercel'; }).fait && br.etapes.find(function (x) { return x.id === 'base'; }).fait && e0.missions.some(function (m) { return m.id === 'whatsapp'; }), 'missions : étapes et états détectés');
    assert.ok(!JSON.stringify(e0).includes('sk_live_simulation') && !JSON.stringify(e0).includes('secret-de-test'), 'aucun code ne revient à l\'écran');
    assert.ok(/clé de TEST/.test((await M.enregistrer({ HQ_STRIPE_KEY: 'sk_test_abc' })).erreur || ''), 'clé Stripe de test refusée avec la raison');
    assert.ok(/clé publique/.test((await M.enregistrer({ HQ_SUPABASE_KEY: 'sb_publishable_abc' })).erreur || ''), 'clé publique Supabase refusée');
    assert.ok(/rien à enregistrer/.test((await M.enregistrer({ PATH: '/tmp', NODE_OPTIONS: 'x' })).erreur || ''), 'seules les variables de la tour peuvent être écrites');
    const okS = await M.enregistrer({ HQ_STRIPE_KEY: 'sk_live_nouvelle_cle_123' });
    assert.ok(okS.ok && fakes.VERCEL.env.HQ_STRIPE_KEY && fakes.VERCEL.env.HQ_STRIPE_KEY.type === 'sensitive' && fakes.VERCEL.env.HQ_STRIPE_KEY.projet === 'prj_tour' && fakes.VERCEL.redemarrages.length === 1 && fakes.VERCEL.redemarrages[0].deploymentId === 'dpl_tour_prod', 'clé live : vérifiée, écrite (sensible) dans le projet de la tour, redémarrage lancé');
    const okM = await M.enregistrer({ HQ_MAIL_USER: 'louis@novalemo-mq.fr', HQ_MAIL_PASS: 'nouveau-mot-de-passe' });
    assert.ok(okM.ok && fakes.VERCEL.env.HQ_MAIL_PASS, 'boîte : connexion essayée puis enregistrée');
    assert.ok(/étape inconnue/.test((await M.cocher(db, 'HQ_STRIPE_KEY', true)).erreur || '') && (await M.cocher(db, 'activite', true)).ok, 'seules les étapes à cocher se cochent');
    const e1 = await M.etat(db);
    assert.ok(e1.missions.find(function (m) { return m.id === 'brancher'; }).etapes.find(function (x) { return x.id === 'activite'; }).fait, 'étape cochée');
    console.log('Missions OK : états, codes essayés avant enregistrement, écriture dans Vercel, redémarrage, cases à cocher');
  }
  // 27. TROISIÈME RELECTURE : l'argent des abonnements, STOP, WhatsApp, verrous, Missions
  {
    const WAJ = require('../lib/jobs/whatsapp'), M = require('../lib/missions'), RT = require('../lib/runtime');
    const sansThrottle = function () { db.tables.hq_config = db.tables.hq_config.filter(function (c) { return c.key !== 'stripe:abonnements'; }); };
    const ilYa = function (j) { return new Date(Date.now() - j * 86400000).toISOString(); };
    const abonne = async function (cle, email, extra) {
      const c = await nouveauClient(cle, 'Rv ' + cle, email);
      await exE().commande(Object.assign({ reponse_id: c.ib.id, formule: 'essentiel', paiement: 'mensuel' }, extra || {}));
      const lm = leSite(c.s.id).stripe.lien_mois;
      fakes.payer(lm, { customer_details: { email: email, name: 'X' } });
      if (!extra) fakes.FAUX_EN_LIGNE.add(leSite(c.s.id).domaine);
      await lucas(); await lucas(); await lucas();
      return Object.assign(c, { sub: 'sub_' + lm, lm: lm });
    };
    // A. abonnement payé en double, arrêt refusé une fois par Stripe : ni remboursé ni oublié, réglé au passage suivant
    const dd = await nouveauClient('rv-deux', 'Rv Deux', 'rvdeux@test-mq.fr');
    await exE().commande({ reponse_id: dd.ib.id, formule: 'essentiel' });
    const sd = Object.assign({}, leSite(dd.s.id).stripe);
    fakes.payer(sd.lien, { amount_total: 59000, customer_details: { email: 'rvdeux@test-mq.fr', name: 'D' } });
    await lucas();
    fakes.payer(sd.lien_mois, { customer_details: { email: 'rvdeux@test-mq.fr', name: 'D' } });
    const subD = 'sub_' + sd.lien_mois;
    fakes.STRIPE.annulerEchecs = 1;
    await lucas();
    assert.ok(fakes.STRIPE.abonnements[subD].status === 'active' && !fakes.STRIPE.rembourses.some(function (x) { return String(x).indexOf(subD) >= 0; }) && (leSite(dd.s.id).stripe.rembourses || []).indexOf(sd.lien_mois) < 0 && !db.tables.hq_outbox.some(function (o) { return o.lead_id === dd.l.id && /double/.test(o.subject); }), 'abonnement en double, arrêt refusé : rien remboursé, rien noté, rien dit au client');
    await lucas();
    assert.ok(fakes.STRIPE.abonnements[subD].status === 'canceled' && fakes.STRIPE.rembourses.some(function (x) { return String(x).indexOf(subD) >= 0; }) && (leSite(dd.s.id).stripe.rembourses || []).indexOf(sd.lien_mois) >= 0 && db.tables.hq_outbox.filter(function (o) { return o.lead_id === dd.l.id && /double/.test(o.subject); }).length === 1, 'passage suivant : abonnement en trop arrêté, remboursé, client prévenu une fois');
    // B. mensualité refusée puis réglée trois jours plus tard : la facture part quand même, l'encaissé suit
    const b = await abonne('rv-late', 'rvlate@test-mq.fr');
    const invB = fakes.mois(b.sub, false);
    const fb = fakes.STRIPE.factures.find(function (x) { return x.id === invB; });
    fb.created = Math.floor((Date.now() - 3 * 86400000) / 1000);
    sansThrottle(); await lucas();
    assert.ok(leSite(b.s.id).data.abonnement.impaye_le && /invoice\.stripe\.com/.test(leSite(b.s.id).data.abonnement.url_impaye || ''), 'impayé vu, lien pour régler gardé (pour Emma aussi)');
    fb.status = 'paid'; fb.amount_paid = 4900; fb.paye_le = Math.floor(Date.now() / 1000); fakes.STRIPE.abonnements[b.sub].status = 'active';
    sansThrottle(); await lucas();
    const abB = leSite(b.s.id).data.abonnement;
    assert.ok(abB.factures.indexOf(invB) >= 0 && abB.paye_eur === 98 && abB.statut === 'active' && !abB.url_impaye && db.tables.hq_outbox.some(function (o) { return o.lead_id === b.l.id && /^Votre facture/.test(o.subject); }), 'réglée en retard : facture envoyée, encaissé à jour');
    // C. abonné dont le domaine attend son réglage DNS : pause puis paiement le ramènent en livraison, jamais « en ligne » à tort
    const c = await abonne('rv-dns', 'rvdns@test-mq.fr', { domaine: 'rv-dns-client.fr' });
    assert.strictEqual(leSite(c.s.id).status, 'livraison', 'son domaine : en attente de son réglage DNS');
    fakes.mois(c.sub, false); sansThrottle(); await lucas();
    leSite(c.s.id).data.abonnement.impaye_le = ilYa(15); sansThrottle(); await lucas(); sansThrottle(); await lucas();
    assert.ok(leSite(c.s.id).status === 'pause' && leSite(c.s.id).data.statut_avant_pause === 'livraison' && db.tables.hq_outbox.some(function (o) { return o.lead_id === c.l.id && /mise en ligne suspendue/.test(o.subject); }), 'impayé à 14 jours, site pas encore en ligne : mise en ligne suspendue');
    fakes.STRIPE.abonnements[c.sub].status = 'active'; sansThrottle(); await lucas();
    const sc = leSite(c.s.id);
    assert.ok(sc.status === 'livraison' && !sc.live_at && db.tables.hq_outbox.some(function (o) { return o.lead_id === c.l.id && /la mise en ligne reprend/.test(o.subject); }), 'réglé : retour en livraison, rien d\'annoncé à tort : ' + sc.status);
    // D. arrêt voulu connu de Stripe seulement (tableau de bord) : fin voulue, ni pause ni lien de reprise
    const d = await abonne('rv-cancel', 'rvcancel@test-mq.fr');
    Object.assign(fakes.STRIPE.abonnements[d.sub], { cancel_at_period_end: true, status: 'canceled', cancellation_details: { reason: 'cancellation_requested' } });
    sansThrottle(); await lucas();
    const sdd = leSite(d.s.id);
    assert.ok(sdd.status === 'en_ligne' && !sdd.data.abonnement && sdd.data.renouvellement && db.tables.hq_outbox.some(function (o) { return o.lead_id === d.l.id && /^Fin de votre abonnement/.test(o.subject); }), 'arrêt voulu (depuis Stripe) : le site reste à lui');
    // H. arrêté par Stripe faute de paiement : facture ouverte annulée ; un mois réglé après l'arrêt est remboursé, lien de reprise redonné
    const h = await abonne('rv-impaye', 'rvimpaye@test-mq.fr');
    const invH = fakes.mois(h.sub, false);
    Object.assign(fakes.STRIPE.abonnements[h.sub], { status: 'canceled', canceled_at: Math.floor(Date.now() / 1000) - 60, cancellation_details: { reason: 'payment_failed' } });
    sansThrottle(); await lucas();
    const sh = leSite(h.s.id);
    assert.ok(sh.status === 'pause' && sh.data.abonnement.lien_reprise && fakes.STRIPE.facturesAnnulees.indexOf(invH) >= 0, 'arrêté faute de paiement : pause, lien de reprise, facture ouverte annulée');
    const liensReprise = fakes.STRIPE.liens.filter(function (l) { return l.id === sh.data.abonnement.lien_reprise; });
    assert.ok(liensReprise.length && /Reprise de votre abonnement/.test(liensReprise[0].params['custom_text[submit][message]'] || ''), 'lien de reprise : aux mêmes conditions, sans nouvel engagement');
    fakes.STRIPE.factures.push({ id: 'in_tard_h', subscription: h.sub, status: 'paid', amount_paid: 4900, billing_reason: 'subscription_cycle', created: Math.floor(Date.now() / 1000) - 3600, paye_le: Math.floor(Date.now() / 1000), number: 'NOVA-T', hosted_invoice_url: 'https://invoice.stripe.com/i/in_tard_h' });
    sansThrottle(); await lucas();
    assert.ok(fakes.STRIPE.rembourses.indexOf('pi_in_tard_h') >= 0 && db.tables.hq_outbox.some(function (o) { return o.lead_id === h.l.id && /^Paiement remboursé/.test(o.subject) && o.body.indexOf(leSite(h.s.id).data.abonnement.url_reprise) >= 0; }), 'réglé après l\'arrêt : remboursé, lien de reprise redonné');
    const vueEmma = await exE().lister_reponses({ statut: 'nouveau' });
    const cmdH = await exE().commande({ reponse_id: h.ib.id, formule: 'essentiel' });
    assert.ok(/abonnement/.test((cmdH && cmdH.erreur) || '') && (cmdH.erreur || '').indexOf(leSite(h.s.id).data.abonnement.url_reprise) >= 0, 'Emma, pour un abonné en pause : le bon lien (reprise), pas celui de l\'hébergement annuel');
    assert.ok(Array.isArray(vueEmma) || typeof vueEmma === 'string', 'vue d\'Emma lisible');
    // I. abonnement introuvable chez Stripe (clé d'un autre compte) : Louis prévenu
    const i1 = await abonne('rv-perdu', 'rvperdu@test-mq.fr');
    const sauve = fakes.STRIPE.abonnements[i1.sub]; delete fakes.STRIPE.abonnements[i1.sub];
    sansThrottle(); await lucas();
    fakes.STRIPE.abonnements[i1.sub] = sauve;
    assert.ok(db.tables.hq_messages.some(function (m) { return /introuvable\(s\) chez Stripe/.test(m.subject || ''); }), 'abonnement introuvable : Louis prévenu');
    // E. STOP seulement sur le mot seul ; le message d'un client va toujours à Emma
    process.env.HQ_WHATSAPP_KEY = 'kapso_test'; process.env.HQ_WHATSAPP_NUMERO = '1234567890'; process.env.HQ_WHATSAPP_TEL = '+596 696 99 88 77';
    const e1 = await abonne('rv-wa', 'rvwa@test-mq.fr');
    await db.update('hq_leads', { phone: '0696 11 22 33', status: 'client' }, { eq: { id: e1.l.id } });
    fakes.recuWhatsApp('+596696112233', 'Arrêtez mon abonnement svp', 'Patron');
    fakes.recuWhatsApp('+596696223344', 'Arrêt de travail jusqu\'à lundi, je reviens vers vous', 'Prospect');
    fakes.recuWhatsApp('+596696334455', 'Stop merci', 'Autre');
    await WAJ.releve({ db: db });
    const ligne = function (de) { return db.tables.hq_inbox.filter(function (x) { return x.from_email === 'wa:' + de; }).pop(); };
    assert.ok(ligne('+596696112233').kind === 'reponse' && ligne('+596696112233').status === 'nouveau' && ligne('+596696112233').lead_id === e1.l.id && ligne('+596696223344').kind === 'reponse' && ligne('+596696334455').kind === 'stop', 'WhatsApp : STOP sur le mot seul, le message d\'un client va à Emma');
    const cl = await abonne('rv-desabo', 'rvdesabo@test-mq.fr');
    await db.insert('hq_outbox', { lead_id: cl.l.id, to_email: 'rvdesabo@test-mq.fr', subject: 'Votre facture', body: 'x', status: 'envoye', kind: 'service', step: 1, sent_at: new Date().toISOString(), message_id: '<hq.998.abcdef99@novalemo-mq.fr>' });
    uid++;
    aRelever.push({ uid: uid, messageId: '<desabo-client' + uid + '@x.fr>', inReplyTo: '<hq.998.abcdef99@novalemo-mq.fr>', from: 'rvdesabo@test-mq.fr', subject: 'Désabonnement', headers: 'In-Reply-To: <hq.998.abcdef99@novalemo-mq.fr>\r\n', source: Buffer.from('From: rvdesabo@test-mq.fr\r\nSubject: Désabonnement\r\nIn-Reply-To: <hq.998.abcdef99@novalemo-mq.fr>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nJe souhaite arrêter mon abonnement.\r\n') });
    await BOITE.releve({ db: db });
    const rowD = db.tables.hq_inbox.filter(function (x) { return x.lead_id === cl.l.id && x.subject === 'Désabonnement'; }).pop();
    assert.ok(rowD && rowD.kind === 'reponse' && rowD.status === 'nouveau' && !db.tables.hq_suppression.some(function (x) { return x.email === 'rvdesabo@test-mq.fr'; }), 'email d\'un client « Désabonnement » : à Emma, pas désinscrit d\'office');
    // F. même numéro sur deux fiches (le client, et un doublon trouvé par un chasseur) : le message va au client
    const f1 = await abonne('rv-old', 'rvold@test-mq.fr');
    await db.update('hq_leads', { phone: '0696 44 55 66', status: 'client' }, { eq: { id: f1.l.id } });
    await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'maps:rv-old-dup', source: 'maps', name: 'Rv Old (fiche Maps)', island: 'MQ', phone: '+596 696 44 55 66', status: 'a_appeler', score: 60 });
    fakes.recuWhatsApp('+596696445566', 'Bonjour, une question sur ma facture', 'Patron');
    await WAJ.releve({ db: db });
    assert.strictEqual(ligne('+596696445566').lead_id, f1.l.id, 'même numéro sur deux fiches : le message va au client');
    // K. photo envoyée sur WhatsApp : gardée comme une pièce jointe, utilisable par la retouche
    fakes.recuWhatsApp('+596696112233', '', 'Patron', 0, { type: 'image', text: undefined, image: { caption: 'Voici mon nouveau logo', mime_type: 'image/jpeg' }, kapso: { direction: 'inbound', contact_name: 'Patron', has_media: true, media_url: 'https://api.kapso.ai/storage/media/logo123.jpg', media_data: { url: 'https://api.kapso.ai/storage/media/logo123.jpg', filename: 'logo.jpg', content_type: 'image/jpeg', byte_size: 5000 } } });
    await WAJ.releve({ db: db });
    const fich = db.tables.hq_fichiers.filter(function (x) { return x.lead_id === e1.l.id; });
    const rowK = ligne('+596696112233');
    assert.ok(fich.length && fich[fich.length - 1].contenu && /logo/.test(fich[fich.length - 1].nom) && /nouveau logo/.test(rowK.body) && (rowK.data.pieces || []).length === 1, 'photo reçue sur WhatsApp : gardée pour son site, Emma la voit');
    // L. client qui écrit sous un nom d'utilisateur, sans numéro visible : gardé, et la réponse lui parvient
    fakes.recuWhatsApp(null, 'Bonjour, vous faites les sites vitrines ?', 'Sans Numéro', 0, { from_user_id: 'US.13491208655302741918', username: 'boulangerie972' });
    await WAJ.releve({ db: db });
    const ibU = ligne('US.13491208655302741918');
    const lU = db.tables.hq_leads.find(function (l) { return l.dedupe === 'wa:US.13491208655302741918'; });
    assert.ok(ibU && lU && !lU.phone && ibU.lead_id === lU.id, 'nom d\'utilisateur sans numéro : message gardé, rattaché à son identifiant');
    const repU = await exE().repondre({ reponse_id: ibU.id, corps: 'Bonjour, oui, je vous prépare un aperçu gratuit de votre site dès aujourd\'hui. Louis, Novalemo' });
    const oU = db.tables.hq_outbox.filter(function (o) { return o.inbox_id === ibU.id; }).pop();
    const envU = await ENVOI.envoyerUn(db, oU);
    assert.ok(!(repU && repU.erreur) && envU.ok && fakes.KAPSO.envoyes.some(function (x) { return x.recipient === 'US.13491208655302741918' && !x.to; }), 'réponse partie à son identifiant WhatsApp');
    delete process.env.HQ_WHATSAPP_KEY; delete process.env.HQ_WHATSAPP_NUMERO; delete process.env.HQ_WHATSAPP_TEL;
    // M. verrous : le passage WhatsApp tourne pendant un cycle des 15 minutes ; Emma ne tourne jamais deux fois à la fois
    await RT.verrouiller(db, 'cycle', 300, 'tick-en-cours');
    const occ = await RT.cycle({ db: db, agentId: 'livraison', secondes: 60 });
    const libre = await RT.cycle({ db: db, agentId: 'livraison', secondes: 60, verrou: 'cycle:whatsapp' });
    await RT.deverrouiller(db, 'cycle', 'tick-en-cours');
    assert.ok(occ.occupe && !libre.occupe, 'passage WhatsApp : son propre verrou');
    await RT.verrouiller(db, 'agent:reponses', 300, 'emma-ailleurs');
    dus(['reponses']);
    const sansEmma = await RT.cycle({ db: db, agentId: 'reponses', secondes: 120, verrou: 'cycle:whatsapp' });
    await RT.deverrouiller(db, 'agent:reponses', 'emma-ailleurs');
    assert.ok(!sansEmma.occupe && !(sansEmma.passages || []).length, 'Emma déjà au travail : jamais deux passages en même temps');
    // G. Missions : origine exigée, protection Vercel vérifiée, ancienne clé publique et autre compte Stripe refusés, écriture d'un bloc
    const H0 = require('../api/hq.js');
    const appelHq = async function (headers, corps) { let out = null; const res = { statusCode: 0, setHeader: function () {}, end: function (x) { out = { code: this.statusCode, corps: JSON.parse(x) }; } }; await H0({ method: 'POST', headers: headers, body: corps, url: '/api/hq' }, res); return out; };
    const ecr0 = fakes.VERCEL.ecrituresEnv;
    const sansOrigine = await appelHq({ host: 'btprecruit-crm.vercel.app' }, { op: 'mission_enregistrer', valeurs: { HQ_STRIPE_KEY: 'sk_live_autre_compte_123' } });
    const autreOrigine = await appelHq({ host: 'btprecruit-crm.vercel.app', origin: 'https://pirate.example' }, { op: 'mission_enregistrer', valeurs: { HQ_STRIPE_KEY: 'sk_live_autre_compte_123' } });
    assert.ok(sansOrigine.code === 403 && autreOrigine.code === 403 && fakes.VERCEL.ecrituresEnv === ecr0, 'un code ne s\'enregistre que depuis la page de la tour');
    const depuisTour = await appelHq({ host: 'btprecruit-crm.vercel.app', origin: 'https://btprecruit-crm.vercel.app' }, { op: 'mission_enregistrer', valeurs: { HQ_STRIPE_KEY: 'sk_live_autre_compte_123' } });
    assert.ok(depuisTour.code === 200 && /autre compte Stripe/.test(depuisTour.corps.erreur || ''), 'clé d\'un autre compte Stripe refusée tant que la clé branchée marche');
    process.env.VERCEL = '1';
    const perso = await M.enregistrer({ HQ_SITES_DOMAINE: 'apercu.novalemo.fr' }, { hote: 'tour.novalemo.fr' });
    const vapp = await M.enregistrer({ HQ_SITES_DOMAINE: 'apercu.novalemo.fr' }, { hote: 'btprecruit-crm.vercel.app' });
    fakes.VERCEL.projets.prj_tour.ssoProtection = null;
    const nue = await M.enregistrer({ HQ_SITES_DOMAINE: 'apercu.novalemo.fr' }, { hote: 'btprecruit-crm.vercel.app' });
    fakes.VERCEL.projets.prj_tour.ssoProtection = { deploymentType: 'all_except_custom_domains' };
    delete process.env.VERCEL;
    assert.ok(/adresse vercel\.app/.test(perso.erreur || '') && vapp.ok && /pas protégée/.test(nue.erreur || ''), 'codes acceptés seulement derrière la protection Vercel : ' + JSON.stringify([perso, vapp, nue]));
    const jwt = function (role) { return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'fbmzlfrwxrzflfkazvmn', role: role })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.signature'; };
    assert.ok(/clé publique \(anon\)/.test((await M.enregistrer({ HQ_SUPABASE_KEY: jwt('anon') })).erreur || '') && M.roleJwt(jwt('service_role')) === 'service_role', 'ancienne clé publique (anon) refusée');
    // une étape à moitié acceptée par Vercel est défaite : jamais une adresse neuve avec l'ancien mot de passe
    fakes.VERCEL.env.HQ_MAIL_USER = { type: 'sensitive', target: ['production'], projet: 'prj_tour', longueur: process.env.HQ_MAIL_USER.length, id: 'env_HQ_MAIL_USER' };
    fakes.VERCEL.envEchec.add('HQ_MAIL_PASS');
    const rate = await M.enregistrer({ HQ_MAIL_USER: 'nouvelle.adresse@novalemo-mq.fr', HQ_MAIL_PASS: 'autre-mot-de-passe' });
    fakes.VERCEL.envEchec.clear();
    assert.ok(/refusé/.test(rate.erreur || '') && /rien n'a changé/.test(rate.erreur || '') && fakes.VERCEL.env.HQ_MAIL_USER.longueur === process.env.HQ_MAIL_USER.length, 'étape à moitié refusée : l\'adresse reprend sa valeur d\'avant : ' + JSON.stringify(rate));
    fakes.VERCEL.envEchec.add('HQ_WHATSAPP_NUMERO');
    const rateW = await M.enregistrer({ HQ_WHATSAPP_KEY: 'kapso_cle_essai', HQ_WHATSAPP_NUMERO: '1234567890' });
    fakes.VERCEL.envEchec.clear();
    assert.ok(/refusé/.test(rateW.erreur || '') && !fakes.VERCEL.env.HQ_WHATSAPP_KEY, 'variable neuve d\'une étape refusée : retirée');
    assert.ok(db.tables.hq_messages.some(function (m) { return /^Réglage enregistré : HQ_SITES_DOMAINE/.test(m.subject || ''); }), 'chaque code enregistré : Louis prévenu (le nom, jamais la valeur)');
    assert.ok(!JSON.stringify(db.tables.hq_messages).includes('autre-mot-de-passe') && !JSON.stringify(db.tables.hq_messages).includes('sk_live_autre_compte_123'), 'aucune valeur de code dans les messages');
    console.log('Relecture OK : doublon d\'abonnement, facture réglée en retard, pause en livraison, fin voulue depuis Stripe, factures ouvertes annulées, remboursement après arrêt, abonnement introuvable, STOP, client prioritaire, photo WhatsApp, nom d\'utilisateur, verrous, Missions protégées');
  }
  // 28. VÉRIFICATION DES CORRECTIONS : arrêt demandé puis impayé, Emma express sans boucle, images choisies, remboursement
  // réessayé jusqu'au bout, mentions des anciens abonnés, identifiant WhatsApp appris, fin d'abonnement avant un an
  {
    const WAJ = require('../lib/jobs/whatsapp');
    const sansThrottle = function () { db.tables.hq_config = db.tables.hq_config.filter(function (c) { return c.key !== 'stripe:abonnements'; }); };
    const dans = function (j) { return new Date(Date.now() + j * 86400000).toISOString(); };
    const abonne = async function (cle, email) {
      const c = await nouveauClient(cle, 'Vf ' + cle, email);
      await exE().commande({ reponse_id: c.ib.id, formule: 'essentiel', paiement: 'mensuel' });
      const lm = leSite(c.s.id).stripe.lien_mois;
      fakes.payer(lm, { customer_details: { email: email, name: 'X' } });
      fakes.FAUX_EN_LIGNE.add(leSite(c.s.id).domaine);
      await lucas(); await lucas(); await lucas();
      db.tables.hq_inbox.find(function (x) { return x.id === c.ib.id; }).data.confiance = 'fil';
      return Object.assign(c, { sub: 'sub_' + lm, lm: lm });
    };
    // N1. arrêt demandé pendant l'engagement, puis la carte ne passe plus et Stripe arrête l'abonnement : c'est un impayé
    const n1 = await abonne('vf-arret-impaye', 'vfai@test-mq.fr');
    leSite(n1.s.id).data.abonnement.engagement_jusqu_au = dans(200);
    const r1 = await exE().resilier_abonnement({ reponse_id: n1.ib.id });
    assert.ok(r1.arret_programme && fakes.STRIPE.abonnements[n1.sub].cancel_at, 'arrêt programmé à la fin de l\'engagement');
    const invN1 = fakes.mois(n1.sub, false);
    Object.assign(fakes.STRIPE.abonnements[n1.sub], { status: 'canceled', canceled_at: Math.floor(Date.now() / 1000) - 60, cancellation_details: { reason: 'payment_failed' } });
    sansThrottle(); await lucas();
    const sN1 = leSite(n1.s.id);
    assert.ok(sN1.status === 'pause' && sN1.data.abonnement && sN1.data.abonnement.lien_reprise && fakes.STRIPE.facturesAnnulees.indexOf(invN1) >= 0 && !db.tables.hq_outbox.some(function (o) { return o.lead_id === n1.l.id && /^Fin de votre abonnement/.test(o.subject); }), 'arrêt demandé puis impayé : pause et lien de reprise, jamais « fin voulue »');
    // N2. le passage express de WhatsApp ne relance pas Emma sur un message qu'elle a déjà vu
    process.env.HQ_WHATSAPP_KEY = 'kapso_test'; process.env.HQ_WHATSAPP_NUMERO = '1234567890'; process.env.HQ_WHATSAPP_TEL = '+596 696 99 88 77';
    const H1 = require('../api/whatsapp.js');
    const express = async function () { let out = null; const res = { statusCode: 0, setHeader: function () {}, end: function (x) { out = JSON.parse(x); } }; await H1({ method: 'GET', headers: {} }, res); return out; };
    const passagesEmma = function () { return db.tables.hq_runs ? db.tables.hq_runs.filter(function (r) { return r.agent_id === 'reponses'; }).length : 0; };
    fakes.recuWhatsApp('+596696778899', 'Bonjour, je regarde et je reviens vers vous', 'Hésitant');
    const e1 = await express();
    const apres1 = passagesEmma();
    const e2 = await express(); const e3 = await express();
    assert.ok(e1 && e1.ok && e1.emma && e2.ok && !e2.emma && !e3.emma && passagesEmma() === apres1, 'express : Emma passe pour un message neuf, jamais deux fois pour le même : ' + JSON.stringify([e1, e2]));
    // N3. un autocollant n'est rien ; une photo reçue ne va sur le site que si Emma le dit
    const c3 = await abonne('vf-images', 'vfimg@test-mq.fr');
    await db.update('hq_leads', { phone: '0696 21 21 21', status: 'client' }, { eq: { id: c3.l.id } });
    fakes.recuWhatsApp('+596696212121', '', 'Patron', 0, { type: 'sticker', text: undefined, sticker: { mime_type: 'image/webp' }, kapso: { direction: 'inbound', has_media: true, media_url: 'https://api.kapso.ai/storage/media/sticker1.webp', media_data: { content_type: 'image/webp', byte_size: 9000 } } });
    fakes.recuWhatsApp('+596696212121', 'Voilà une capture de mon écran, le site ne s\'affiche pas bien', 'Patron', 0, { type: 'image', text: undefined, image: { caption: 'Voilà une capture de mon écran, le site ne s\'affiche pas bien', mime_type: 'image/jpeg' }, kapso: { direction: 'inbound', has_media: true, media_url: 'https://api.kapso.ai/storage/media/capture.jpg', media_data: { content_type: 'image/jpeg', byte_size: 2400 } } });
    await WAJ.releve({ db: db });
    const im3 = db.tables.hq_fichiers.filter(function (x) { return x.lead_id === c3.l.id; });
    assert.ok(im3.length === 1 && !db.tables.hq_inbox.some(function (x) { return x.lead_id === c3.l.id && /sticker/.test(x.body || ''); }), 'autocollant ignoré, la capture est gardée');
    const ib3 = db.tables.hq_inbox.filter(function (x) { return x.lead_id === c3.l.id && x.data && x.data.canal === 'whatsapp'; }).pop();
    const photosAvant = (leSite(c3.s.id).spec.photos || []).length;
    const m3 = await exE().modifier_site({ reponse_id: ib3.id, demande: 'Mettre les horaires du samedi : 8 h à 12 h', images: 'aucune' });
    assert.ok(/site modifié/.test(m3) && /laissée\(s\) de côté/.test(m3) && (leSite(c3.s.id).spec.photos || []).length === photosAvant && db.tables.hq_fichiers.find(function (x) { return x.id === im3[0].id; }).utilise === false, 'capture d\'écran : jamais publiée d\'office');
    leSite(c3.s.id).data.retouches_mois = {};
    const m4 = await exE().modifier_site({ reponse_id: ib3.id, demande: 'Mettre ce nouveau logo', images: 'logo' });
    assert.ok(/site modifié/.test(m4) && /^logo-/.test(leSite(c3.s.id).spec.logo.fichier || ''), 'image choisie comme logo : devient le logo');
    // P18. un client qui écrit avec son numéro, puis sous son nom d'utilisateur (numéro masqué) : toujours reconnu
    fakes.recuWhatsApp('+596696212121', 'Merci !', 'Patron', 0, { from_user_id: 'FR.9988776655' });
    await WAJ.releve({ db: db });
    fakes.recuWhatsApp(null, 'Je voudrais aussi changer le texte d\'accueil', 'Patron', 0, { from_user_id: 'FR.9988776655' });
    await WAJ.releve({ db: db });
    const ibU = db.tables.hq_inbox.filter(function (x) { return x.from_email === 'wa:FR.9988776655'; }).pop();
    assert.ok(ibU && ibU.lead_id === c3.l.id, 'numéro masqué ensuite : son message va toujours à sa fiche de client');
    fakes.recuWhatsApp('+596696556677', 'Stop 🙏', 'Prospect');
    fakes.recuWhatsApp('+596696556688', 'Stop, je voulais juste savoir le prix', 'Prospect');
    await WAJ.releve({ db: db });
    assert.ok(db.tables.hq_inbox.filter(function (x) { return x.from_email === 'wa:+596696556677'; }).pop().kind === 'stop' && db.tables.hq_inbox.filter(function (x) { return x.from_email === 'wa:+596696556688'; }).pop().kind === 'reponse', 'STOP avec un émoji : STOP ; une vraie phrase : à Emma');
    delete process.env.HQ_WHATSAPP_KEY; delete process.env.HQ_WHATSAPP_NUMERO; delete process.env.HQ_WHATSAPP_TEL;
    // P3. commande annulée payée au mois, arrêt refusé trois fois : Louis prévenu, et réessayé jusqu'au bout, même après le relevé
    const p3 = await nouveauClient('vf-annule', 'Vf Annule', 'vfannule@test-mq.fr');
    await exE().commande({ reponse_id: p3.ib.id, formule: 'essentiel' });
    const stP3 = Object.assign({}, leSite(p3.s.id).stripe);
    leSite(p3.s.id).status = 'annule';
    fakes.payer(stP3.lien_mois, { customer_details: { email: 'vfannule@test-mq.fr', name: 'A' } });
    fakes.STRIPE.annulerEchecs = 3;
    await lucas(); await lucas(); await lucas();
    const subP3 = 'sub_' + stP3.lien_mois;
    assert.ok(fakes.STRIPE.abonnements[subP3].status === 'active' && db.tables.hq_messages.filter(function (m) { return /^Paiement à rembourser/.test(m.subject || '') && /Vf Annule/.test(m.body || ''); }).length === 1, 'trois refus : rien d\'abandonné, Louis prévenu une fois');
    fakes.STRIPE.payes[stP3.lien_mois].created = Math.floor((Date.now() - 30 * 3600000) / 1000);
    await lucas();
    assert.ok(fakes.STRIPE.abonnements[subP3].status === 'canceled' && fakes.STRIPE.rembourses.some(function (x) { return String(x).indexOf(subP3) >= 0; }) && db.tables.hq_outbox.some(function (o) { return o.lead_id === p3.l.id && /^Paiement remboursé/.test(o.subject); }), 'réessayé hors du relevé des 25 h : arrêté, remboursé, client prévenu');
    // P17. un abonné d'avant garde-t-il l'ancien pied de facture ? non : les mentions mensuelles sont reposées une fois
    const p17 = await abonne('vf-pied', 'vfpied@test-mq.fr');
    fakes.STRIPE.pieds['cus_' + p17.lm] = 'Facture acquittée par carte à la commande.';
    delete leSite(p17.s.id).data.abonnement.pied;
    sansThrottle(); await lucas();
    assert.ok(/prélevé à chaque échéance/.test(fakes.STRIPE.pieds['cus_' + p17.lm] || '') && leSite(p17.s.id).data.abonnement.pied === 2, 'anciens abonnés : mentions des factures mensuelles mises à jour');
    // fin voulue avant un an en ligne : l'hébergement court jusqu'à la fin du dernier mois payé, le lien à 25 € suit
    const pe = await abonne('vf-tot', 'vftot@test-mq.fr');
    Object.assign(fakes.STRIPE.abonnements[pe.sub], { status: 'canceled', cancel_at_period_end: true, cancellation_details: { reason: 'cancellation_requested' } });
    sansThrottle(); await lucas(); await lucas();
    const sPe = leSite(pe.s.id);
    assert.ok(sPe.status === 'en_ligne' && !sPe.data.abonnement && sPe.data.renouvellement && sPe.data.renouvellement.lien, 'abonnement arrêté tôt : le site reste, le lien d\'hébergement à 25 € part à temps');
    console.log('Vérification OK : arrêt demandé puis impayé, Emma express sans boucle, autocollant ignoré, images choisies par Emma, remboursement réessayé jusqu\'au bout, mentions des anciens abonnés, identifiant WhatsApp appris, fin avant un an');
  }
  // 29. LE MOTEUR DES SITES : huit modèles de métier, peu de texte, un grand titre clair, WhatsApp d'abord ; Léa et ses
  // photos regardées une à une ; Margot et les mentions légales vérifiées dans le registre ; Iris ; les défauts de la relecture
  {
    const DN = require('../lib/sites/donne'), DR = require('../lib/sites/direction'), T = require('../lib/sites/theme'), F = require('../lib/sites/fiche'), R = require('../lib/sites/rendu'), M = require('../lib/sites/modeles'), J = require('../lib/sites/juridique'), IM = require('../lib/sites/images'), A = require('../lib/sites/atelier'), V = require('../lib/sites/vercel'), P = require('../lib/sites/publication');
    const DEMO = require('../lib/jobs/demo');
    const prospect = async function (cle, nom, secteur, commune, extra) { return (await db.insert('hq_leads', Object.assign({ company_id: 'novalemo', dedupe: 'test:' + cle, source: 'maps', name: nom, sector: secteur, island: 'MQ', commune: commune, email: cle + '@test-mq.fr', email_source: 'site', score: 85, status: 'a_contacter' }, extra || {})))[0]; };
    const message = async function (l, corps) { return (await db.insert('hq_inbox', { message_id: '<m-' + l.id + '-' + Math.random().toString(36).slice(2) + '@client.mq>', lead_id: l.id, from_email: l.email, subject: 'Re: votre site', body: corps || 'Oui', kind: 'reponse', status: 'nouveau', data: { confiance: 'adresse' } }))[0]; };
    const services3 = [{ titre: 'Fuites', texte: 'On trouve la fuite avant de casser quoi que ce soit, puis on répare.', icone: 'goutte' }, { titre: 'Chauffe-eau', texte: 'Pose, remplacement et entretien des chauffe-eau électriques et solaires.', icone: 'soleil' }, { titre: 'Salle de bain', texte: 'Douche, lavabo et WC refaits proprement, pièce rendue nette.', icone: 'maison' }];
    // a. le bon modèle pour chaque métier ; six entreprises de clim au Lamentin : six sites différents
    assert.deepStrictEqual(['climatisation', 'plombier', 'garage automobile', 'restaurant créole', 'coiffure', 'auto-école', 'agence immobilière', 'location de bateaux', 'paysagiste', 'fleuriste', 'boulangerie', 'dépannage informatique'].map(M.pour), ['atelier', 'atelier', 'garage', 'comptoir', 'ecrin', 'cabinet', 'cabinet', 'horizon', 'verdure', 'boutique', 'comptoir', 'cabinet'], 'chaque métier sur son modèle');
    const recents = [];
    for (let k = 0; k < 6; k++) { const sp = { v: 3, nom: 'Clim ' + k, commune: 'Le Lamentin', secteur: 'climatisation', metier: 'Climatisation', accroche: 'Pose, entretien et dépannage de climatiseurs pour les maisons.', services: services3, contact: { tel: '+59669611220' + k } }; sp.da = DN.donner(sp, { recents: recents }); recents.push(DR.revoir(sp, { recents: recents }).spec.da); }
    const paires = recents.map(function (d) { return d.modele + '/' + d.palette + '/' + d.type; });
    assert.ok(recents.every(function (d) { return d.modele === 'atelier' && d.v === 3; }) && paires.every(function (p, k) { return paires.indexOf(p) === k; }) && new Set(recents.map(function (d) { return d.palette; })).size >= 4, 'voisins du même métier : même modèle, jamais le même site : ' + paires.join(' '));
    // b. toutes les palettes des modèles, avec ou sans couleur de marque : contrastes lisibles partout
    const malLus = [];
    M.IDS.forEach(function (id) { M.MODELES[id].palettes.forEach(function (p) { ['', '#e30613', '#f6e016', '#0e9aa7', '#111111', '#ffffff', '#7fdbff', '#ff7a00'].forEach(function (m) { const c = DR.contrastes({ da: { v: 3, modele: id, palette: p.id, type: M.MODELES[id].types[0], hero: 'nu', services: M.MODELES[id].services[0] }, accent: m || undefined }); if (c.length) malLus.push(id + '/' + p.id + (m ? ' + ' + m : '') + ' : ' + c.join(', ')); }); }); });
    assert.deepStrictEqual(malLus, [], 'contrastes lisibles avec toutes les palettes et toutes les couleurs de marque');
    // c. peu de mots, et justes : le métier en grand titre, une phrase concrète dessous
    assert.ok(!DR.phraseOk('Votre confort, notre priorité.', {}).ok && !DR.phraseOk('Bienvenue chez Clim Éole, votre partenaire clim', { nom: 'Clim Éole' }).ok && !DR.phraseOk('Besoin d\'un plombier à Ducos ce week-end ?', {}).ok && !DR.phraseOk('Pose de clim', {}).ok && DR.phraseOk('Pose, entretien et dépannage de climatiseurs pour les maisons.', {}).ok, 'phrases jugées');
    assert.ok(DR.metierOk('Climatisation').ok && DR.metierOk('Restaurant créole').ok && !DR.metierOk('Le meilleur plombier de l\'île').ok && !DR.metierOk('Clim 972').ok, 'métiers jugés');
    const nl = A.nettoyer({ nom: '🔧 Solutions Clim', activite: 'Climatisation', metier: 'Plombier au Lamentin', accroche: 'L\'excellence à votre service !', services: services3, atouts: [], etapes: [{ titre: 'Vous écrivez' }], faq: [] }, { name: '🔧 Clim Express', sector: 'climatisation', commune: 'Le Lamentin' }, null);
    assert.ok(nl.metier === 'Plombier' && nl.accroche === 'Fuites, chauffe-eau et salle de bain.' && !/🔧/.test(nl.nom) && !nl.etapes.length, 'commune retirée du métier, phrase vide remplacée par les services, emoji retiré du nom, étapes incomplètes retirées : ' + JSON.stringify([nl.nom, nl.metier, nl.accroche]));
    // d. le rendu : bouton WhatsApp avec un portable, l'appel avec un fixe, l'email sinon ; le portable donné en plus du fixe
    const base = { v: 3, nom: 'Test Rendu', activite: 'Plomberie', metier: 'Plomberie', commune: 'Ducos', secteur: 'plomberie', objectif: 'devis', accroche: 'Fuites, chauffe-eau et salles de bain pour les maisons et les commerces.', services: services3, atouts: [{ titre: 'On explique avant', texte: 'Le prix annoncé avant de commencer.', icone: 'devis' }, { titre: 'Travail propre', texte: 'Pièce rendue nette.', icone: 'etincelles' }, { titre: 'Basés à Ducos', texte: 'Au centre de l\'île.', icone: 'pin' }], etapes: [{ titre: 'Vous appelez' }, { titre: 'On vient voir' }, { titre: 'On répare' }], faq: [{ q: 'Vous venez le samedi ?', r: 'Écrivez-nous : on vous dit ce qui est possible.' }], appel: 'Une fuite à réparer ?' };
    const rendu = function (contact, extra) { const sp = Object.assign({}, base, { contact: contact }, extra || {}); sp.da = sp.da || DN.donner(sp, {}); return R.rendre({ slug: 'test-rendu', spec: sp }, { mode: 'apercu', contactNovalemo: 'louis@novalemo-mq.fr' }).files[0].data; };
    const hWa = rendu({ tel: '+596696112233', email: 'a@b.fr' }), hFixe = rendu({ tel: '+596596112233' }), hMail = rendu({ email: 'a@b.fr' }), hDeux = rendu({ tel: '+596596112233', mobile: '+596696998877' });
    const premier = function (h) { const m = h.match(/<section class="h [^"]*"[\s\S]*?<a class="btn b1" href="([^"]+)"/); return m ? m[1].replace(/&amp;/g, '&') : ''; };
    assert.ok(/^https:\/\/wa\.me\/596696112233\?text=/.test(premier(hWa)) && /^tel:\+596596112233$/.test(premier(hFixe)) && /^mailto:a@b\.fr/.test(premier(hMail)), 'bouton du haut : WhatsApp, sinon appel, sinon email : ' + [premier(hWa), premier(hFixe), premier(hMail)].join(' | '));
    assert.ok(/^https:\/\/wa\.me\/596696998877/.test(premier(hDeux)) && /href="tel:\+596596112233"/.test(hDeux), 'portable pour WhatsApp, fixe pour les appels');
    assert.ok(/<h1 class="t h1"[^>]*>Plomberie à Ducos<\/h1>/.test(hWa) && /Fuites, chauffe-eau et salles de bain/.test(hWa) && /<body class="[^"]*\bm-atelier\b/.test(hWa) && /class="topbar"/.test(hWa) && /class="bande-atouts"/.test(hWa) && /100cqi/.test(hWa) && /Comment ça se passe/.test(hWa) && /Une fuite à réparer \?/.test(hWa), 'grand titre métier + commune, modèle Atelier (bandeau du haut, atouts en bande), titres taillés sur leur colonne : ' + (hWa.match(/<h1[^>]*>[^<]*/) || [''])[0]);
    assert.ok(!/\*\*|class="k"|<em>|text-stroke|backdrop-filter|IntersectionObserver/.test(hWa) && (hWa.match(/<script/g) || []).length === 1 && /prefers-reduced-motion/.test(hWa) && /::selection/.test(hWa) && /accent-color/.test(hWa) && /0696 11 22 33/.test(hWa) && !/id="faq"/.test(hWa), 'aucun des anciens défauts, mouvement respectueux, numéro visible, pas de FAQ d\'une seule question');
    const ancien = R.rendre({ slug: 'ancien', spec: Object.assign({}, base, { v: 2, metier: undefined, accroche: 'Le frais chez vous, posé et **entretenu** comme il faut', chapo: 'Fuites et chauffe-eau, pour les maisons du centre.', titre_services: 'Ce que nous **faisons**', da: { v: 2, direction: 'monument', palette: 'feuille-bleu', type: 'schibsted' }, contact: { tel: '+596696112233' } }) }, { mode: 'apercu' });
    assert.ok(!/\*\*/.test(ancien.files[0].data) && /<h1/.test(ancien.files[0].data) && ancien.da.v === 3 && /Fuites et chauffe-eau/.test(ancien.files[0].data), 'une fiche de l\'ancien moteur se rend proprement, sur la nouvelle donne');
    const emoji = R.rendre({ slug: 'emoji', spec: Object.assign({}, base, { nom: '🔧 Clim Express', contact: { tel: '+596696112233' } }) }, { mode: 'apercu' });
    assert.ok(/<link rel="icon" href="data:image\/svg\+xml,[^"]*%3EC%3C/.test(emoji.files[0].data), 'un nom qui commence par un emoji ne casse plus le rendu (initiale du favicon)');
    // e. les huit modèles se rendent, chacun avec son caractère
    const vus = M.IDS.map(function (id) { const sp = Object.assign({}, base, { secteur: { atelier: 'plombier', garage: 'garage automobile', comptoir: 'restaurant', ecrin: 'coiffure', cabinet: 'kinésithérapeute', horizon: 'excursions en bateau', verdure: 'paysagiste', boutique: 'fleuriste' }[id], contact: { tel: '+596696112233' } }); sp.da = DN.donner(sp, {}); const h = R.rendre({ slug: 'm-' + id, spec: sp }, { mode: 'apercu' }).files[0].data; return sp.da.modele === id && new RegExp('<body class="[^"]*\\bm-' + id + '\\b').test(h) && /<h1/.test(h) && /id="services"/.test(h) && /id="contact"/.test(h) ? id : null; });
    assert.deepStrictEqual(vus, M.IDS, 'les huit modèles se rendent');
    // f. Léa : une photo par place, cherchée sur Pexels, regardée par Claude, jamais de visage, de logo ni de hors-sujet
    process.env.HQ_PEXELS_KEY = 'pexels-test';
    fakes.PEXELS.recherches.length = 0;
    const vision0 = fakes.VISION.appels;
    const lp = await prospect('pexels', 'Froid Caraïbes', 'climatisation', 'Ducos', { phone: '+596 696 44 33 22' });
    const fp = await DEMO.fabriquer(db, lp, {});
    const sp = fp.site.spec;
    const roles = sp.photos.map(function (p) { return p.role + (p.pour !== undefined ? p.pour : ''); });
    assert.ok(roles.indexOf('hero') >= 0 && roles.indexOf('service0') >= 0 && roles.indexOf('service1') >= 0 && roles.indexOf('apropos') >= 0 && roles.indexOf('service2') < 0 && sp.photos.every(function (p) { return p.credit && p.credit.source === 'Pexels' && p.credit.auteur && p.sha; }) && sp.provenance.photos === 'banque', 'une photo pour le haut, pour chaque service qui a sa recherche, pour la présentation : ' + roles.join(' '));
    assert.ok(fakes.VISION.appels === vision0 + 1 && fakes.VISION.vues.length >= 8 && sp.photos.every(function (p) { const f = Number(p.credit.id.slice(2)) % 10; return f !== 0 && f !== 4 && f !== 5; }) && fakes.VISION.vues.some(function (id) { return id % 10 === 0; }), 'chaque candidate regardée ; les visages, logos et hors-sujet recalés : ' + sp.photos.map(function (p) { return p.credit.id; }).join(' '));
    assert.ok(fakes.PEXELS.recherches.indexOf('modern air conditioner living room') >= 0 && fakes.PEXELS.recherches.indexOf('air conditioner installation') >= 0 && fakes.PEXELS.recherches.every(function (q) { return !IM.PERSONNES.test(q); }) && fp.site.data.photos.v === IM.VERSION && fp.site.data.photos.notes.recalees > 0, 'recherches tirées des textes, aucune personne : ' + fakes.PEXELS.recherches.join(', '));
    const ap = R.rendre(fp.site, { mode: 'apercu', contactNovalemo: 'louis@novalemo-mq.fr' });
    const ml = ap.files.find(function (f) { return /mentions-legales/.test(f.file); }).data;
    assert.ok(/photo de <a[^>]+>Photographe \d<\/a> sur <a[^>]+>Pexels<\/a>/.test(ml) && /Photos d'illustration/.test(ap.files[0].data) && /<img src="[^"]+i1\.jpg"[^>]* alt=""/.test(ap.files[0].data) && /h-(photo|split)/.test(ap.files[0].data), 'crédits dans les mentions légales, bandeau honnête, aucune fausse description, une photo en haut');
    assert.ok(fp.site.data.revue && fp.site.data.revue.relu && sp.da.v === 3 && /Mes%20horaires/.test(ap.files[0].data) && /Nom%20officiel%20de%20mon%20entreprise/.test(ap.files[0].data), 'relu par Iris ; « Je veux ce site » demande aussi le nom officiel');
    // g. un voisin du même métier, même commune : d'autres photos, un autre site
    const lp2 = await prospect('pexels2', 'Clim Ducos Services', 'climatisation', 'Ducos', { phone: '+596 696 55 33 22' });
    const fp2 = await DEMO.fabriquer(db, lp2, {});
    const ids1 = sp.photos.map(function (p) { return p.credit.id; }), ids2 = fp2.site.spec.photos.map(function (p) { return p.credit.id; });
    assert.ok(ids2.length >= 3 && ids2.every(function (id) { return ids1.indexOf(id) < 0; }) && !(fp2.site.spec.da.palette === sp.da.palette && fp2.site.spec.da.type === sp.da.type) && (fp2.site.spec.photo_ids || []).length === ids2.length, 'voisin : autres photos, autre site');
    // h. sans clé Pexels : la petite banque pour les métiers où elle a du sens ; sinon un haut de page sans photo
    delete process.env.HQ_PEXELS_KEY;
    const lr = await prospect('table', 'Chez Ginette', 'restaurant', 'Le Diamant', { phone: '+596 696 77 88 99' });
    const fr = await DEMO.fabriquer(db, lr, {});
    assert.ok(fr.site.spec.photos.length === 2 && fr.site.spec.photos.every(function (p) { return p.credit && p.credit.source === 'Unsplash' && /unsplash\.com\/photos\//.test(p.credit.page); }) && fr.site.spec.photos[0].role === 'hero' && fr.site.spec.da.modele === 'comptoir', 'banque de secours pour un restaurant, sur le modèle Comptoir');
    const lg = await prospect('serrure', 'Serrurerie du Nord', 'serrurier', 'Le Lorrain', { phone: '+596 596 11 22 33' });
    const fg = await DEMO.fabriquer(db, lg, {});
    assert.ok(!fg.site.spec.photos.length && fg.site.spec.da.hero === 'nu' && /class="h h-nu/.test(R.rendre(fg.site, { mode: 'apercu' }).files[0].data), 'sans photo : le haut de page en aplat (' + fg.site.spec.da.hero + ')');
    // i. Margot : la recherche d'après le nom ne suffit pas, le client confirme ; ce que la loi exige selon la forme
    assert.ok(fg.site.spec.legal && fg.site.spec.legal.siren === '552100554' && !fg.site.spec.legal.confirme && J.questions(fg.site.spec)[0].cle === 'identite', 'trouvée dans le registre d\'après le nom, à confirmer par le client');
    const manque = F.manque(fg.site.spec).map(function (x) { return x.cle; });
    assert.ok(['portable', 'legal', 'horaires', 'logo', 'photos', 'services'].every(function (k) { return manque.indexOf(k) >= 0; }) && /nom officiel de votre entreprise/i.test(F.texte(fg.site.spec)) && /un maximum de photos/i.test(F.texte(fg.site.spec)), 'fiche : ' + manque.join(', '));
    const complet = { objectif: 'devis', zone: 'Le Robert et Le François', contact: { tel: '+596696112233', horaires: ['lundi : 8 h à 17 h'] }, logo: { fichier: 'logo.png' }, legal: { raison_sociale: 'JEAN-MARC TELL', nature: '1000', siren: '552100554', adresse: 'Morne Bois, 97214 Le Lorrain', dirigeant: 'JEAN-MARC TELL', source: 'registre', confirme: true }, provenance: { services: 'client', photos: 'client', objectif: 'client', zone: 'client' } };
    assert.deepStrictEqual(F.manque(complet), [], 'rien ne manque : pas de fiche');
    assert.ok(J.exigences({ secteur: 'agence immobilière', legal: {} }).some(function (e) { return e.cle === 'ordre' && /carte professionnelle/.test(e.question); }) && J.exigences({ legal: { nature: '5710' } }).some(function (e) { return e.cle === 'capital'; }) && !J.exigences({ legal: { nature: '1000' } }).some(function (e) { return e.cle === 'capital'; }) && J.numeroValide('84321765400014') && !J.numeroValide('84321765400015'), 'profession réglementée, capital des sociétés, SIRET vérifié par sa clé');
    // j. Emma : la fiche (nom officiel compris), puis l'outil mentions_legales ; Margot vérifie dans le registre
    const ibF = await message(lg, 'Ça me plaît, combien ?');
    const rf = await exE().fiche_client({ reponse_id: ibF.id });
    assert.ok(rf.a_coller_tel_quel && /portable/.test(rf.a_coller_tel_quel) && /nom officiel/.test(rf.a_coller_tel_quel) && db.tables.hq_leads.find(function (l) { return l.id === lg.id; }).data.fiche, 'Emma reçoit la fiche à coller : ' + JSON.stringify(rf).slice(0, 160));
    db.tables.hq_inbox.filter(function (x) { return x.status === 'test-fiche'; }).forEach(function (x) { x.status = 'traite'; });
    db.tables.hq_inbox.find(function (x) { return x.id === ibF.id; }).status = 'test-fiche';
    const vues = await exE().lister_reponses({ statut: 'test-fiche', limite: 10 });
    const vue = (Array.isArray(vues) ? vues : []).find(function (x) { return x.id === ibF.id; });
    assert.ok(vue && /envoyée le/.test(vue.son_site_novalemo.fiche) && vue.son_site_novalemo.mentions_legales && vue.son_site_novalemo.mentions_legales.completes === false && /nom officiel/i.test(vue.son_site_novalemo.mentions_legales.a_demander[0]), 'Emma voit que la fiche est partie et ce qu\'il manque aux mentions légales');
    const ibJ = await message(lp, 'Notre nom officiel c\'est FROID CARAIBES, une SARL');
    const mj = await exE().mentions_legales({ reponse_id: ibJ.id, nom_officiel: 'FROID CARAIBES' });
    const lJ = leSite(fp.site.id).spec.legal;
    assert.ok(mj.trouve && lJ.siren === '843217654' && lJ.confirme && lJ.forme === 'SARL' && lJ.dirigeant === 'Paul MARTIN' && !mj.mentions_completes && mj.encore_a_demander.some(function (q) { return /capital social/.test(q); }), 'nom officiel confirmé dans le registre, le capital reste à demander : ' + JSON.stringify(mj));
    const mj2 = await exE().mentions_legales({ reponse_id: ibJ.id, capital: '5 000 euros' });
    const mlJ = R.rendre(leSite(fp.site.id), { mode: 'live', url: 'https://froid-caraibes.com/', identite: idv.identite }).files.find(function (f) { return /mentions-legales/.test(f.file); }).data;
    assert.ok(mj2.mentions_completes && /FROID CARAIBES<\/strong>, SARL au capital de 5 000 €/.test(mlJ) && /RCS Fort-de-France 843 217 654/.test(mlJ) && /Siège social : Zone de Champigny, 97224 Ducos/.test(mlJ) && /Directeur de la publication : Paul MARTIN \(gérant\)/.test(mlJ) && !/Aperçu :/.test(mlJ), 'mentions complètes d\'une SARL : ' + mlJ.slice(mlJ.indexOf('Éditeur'), mlJ.indexOf('Éditeur') + 300));
    const ibT = await message(lg, 'Mon nom officiel : JEAN-MARC TELL, SIRET 552 100 554 00013. Mon portable : 0696 22 33 44');
    const mT = await exE().modifier_site({ reponse_id: ibT.id, demande: 'Mon nom officiel : JEAN-MARC TELL, SIRET 552 100 554 00013. Mon portable : 0696 22 33 44', images: 'aucune' });
    const sT = leSite(fg.site.id).spec;
    const mlT = R.rendre(leSite(fg.site.id), { mode: 'live', url: 'https://serrurerie-du-nord.com/' }).files.find(function (f) { return /mentions-legales/.test(f.file); }).data;
    assert.ok(/site modifié/.test(mT) && /Mentions légales/.test(mT) && sT.legal.confirme && /JEAN-MARC TELL<\/strong>, entrepreneur individuel \(EI\), sous le nom commercial Serrurerie du Nord/.test(mlT) && /SIREN 552 100 554/.test(mlT) && sT.contact.tel === '+596596112233' && sT.contact.mobile === '+596696223344', 'un entrepreneur individuel confirmé par une retouche ; le portable s\'ajoute au fixe sans l\'effacer : ' + mT);
    assert.ok(J.donneParClient({}, { siret: '843 217 654 00015' }).legal.siret_refuse && !J.donneParClient({}, { siret: '843 217 654 00015' }).legal.a_verifier, 'un SIRET mal recopié est refusé, pas cherché');
    // k. Margot surveille les sites payés : mentions incomplètes trois jours après le paiement, Louis prévenu une fois
    const lPaye = await prospect('paye-jur', 'Clim Payée', 'climatisation', 'Le Robert', { phone: '+596 696 10 20 30', status: 'client' });
    await db.insert('hq_sites', { lead_id: lPaye.id, slug: 'clim-payee-1a2b', status: 'en_ligne', version: 1, domaine: 'clim-payee.com', paid_at: new Date(Date.now() - 4 * 86400000).toISOString(), live_at: new Date(Date.now() - 4 * 86400000).toISOString(), spec: { v: 3, nom: 'Clim Payée', secteur: 'climatisation', commune: 'Le Robert', contact: { tel: '+596696102030' } }, data: {} });
    dus(['juridique']);
    const cJ = await runtime.cycle({ db: db, agentId: 'juridique', secondes: 120 });
    const alertes = function () { return db.tables.hq_messages.filter(function (m) { return m.from_id === 'juridique' && /Clim Payée/.test(m.subject); }).length; };
    assert.ok(alertes() === 1 && /incomplète/.test(cJ.passages.map(function (p) { return p.resume; }).join(' ')), 'Louis prévenu d\'un site payé aux mentions incomplètes : ' + cJ.passages.map(function (p) { return p.resume; }).join(' | '));
    dus(['juridique']);
    await runtime.cycle({ db: db, agentId: 'juridique', secondes: 120 });
    assert.strictEqual(alertes(), 1, 'une seule fois');
    assert.ok(/La loi impose des mentions légales sur tout site/.test(require('../lib/jobs/livraison').emailPaiement(Object.assign({ formule: 'vitrine', montant_eur: 990 }, leSite(fg.site.id), { spec: Object.assign({}, leSite(fg.site.id).spec, { legal: {} }) }))), 'l\'email de paiement demande ce qui manque aux mentions');
    // l. ses photos à lui remplacent les illustrations (même modèle, mêmes couleurs, mêmes lettres) ; une retouche sans rapport ne change rien à la mise en page ; un envoi raté ne retire rien
    await db.insert('hq_fichiers', [21, 22].map(function (g) { const b = fakes.jpeg(1600, 1067, g); return { lead_id: lp.id, role: 'photo', mime: 'image/jpeg', largeur: 1600, hauteur: 1067, taille: b.length, contenu: b.toString('base64'), utilise: false }; }));
    const ibP = await message(lp, 'Voici nos photos de chantier pour le site');
    const daAvant = leSite(fp.site.id).spec.da;
    const envoyer0 = V.envoyerFichier;
    V.envoyerFichier = async function () { throw new Error('Vercel muet'); };
    const mR = await exE().modifier_site({ reponse_id: ibP.id, demande: 'Mettre nos photos de chantier sur le site', images: 'photos' });
    V.envoyerFichier = envoyer0;
    const spR = leSite(fp.site.id).spec;
    assert.ok(spR.photos.length === sp.photos.length && spR.photos.every(function (p) { return p.credit; }) && !/image\(s\) du client ajoutée/.test(mR) && /n'ont pas pu être ajoutée/.test(mR), 'envoi raté : les illustrations restent, la réponse ne prétend rien : ' + mR);
    db.tables.hq_fichiers.filter(function (f) { return f.lead_id === lp.id; }).forEach(function (f) { f.utilise = false; });
    const mp = await exE().modifier_site({ reponse_id: ibP.id, demande: 'Mettre nos photos de chantier sur le site', images: 'photos' });
    const spP = leSite(fp.site.id).spec;
    assert.ok(/site modifié/.test(mp) && spP.photos.length === 2 && spP.photos.every(function (p) { return !p.credit && p.fichier_id; }) && spP.provenance.photos === 'client' && spP.da.modele === daAvant.modele && spP.da.palette === daAvant.palette && spP.da.type === daAvant.type && !spP.photo_ids, 'ses photos à la place des illustrations, même modèle, mêmes couleurs, mêmes lettres : ' + mp);
    const daP = JSON.stringify(spP.da);
    const ibH = await message(lp, 'Mettez nos horaires : lundi au vendredi 7 h 30 à 17 h');
    await exE().modifier_site({ reponse_id: ibH.id, demande: 'Mettez nos horaires : lundi au vendredi 7 h 30 à 17 h', images: 'aucune' });
    assert.strictEqual(JSON.stringify(leSite(fp.site.id).spec.da), daP, 'une retouche d\'horaires ne change pas la mise en page');
    // m. Iris relit les aperçus pas encore partis (même les plus anciens), jamais le visage de ceux déjà vus
    const lI = await prospect('iris', 'Élec François', 'électricité', 'Le François');
    const lV = await prospect('iris-vu', 'Élec Vu', 'électricité', 'Le Vauclin', { status: 'contacte' });
    const specIris = function (nom, commune) { return { v: 3, nom: nom, activite: 'Électricité', metier: 'Le meilleur électricien de l\'île', secteur: 'électricité', commune: commune, accroche: 'Votre partenaire électricité de confiance !', services: services3, contact: { tel: '+596696998877' } }; };
    const sI = (await db.insert('hq_sites', { lead_id: lI.id, slug: 'iris-1a2b', status: 'brouillon', version: 1, spec: specIris('Élec François', 'Le François') }))[0];
    const sV = (await db.insert('hq_sites', { lead_id: lV.id, slug: 'iris-vu-1a2b', status: 'apercu', version: 1, spec: specIris('Élec Vu', 'Le Vauclin'), url_apercu: 'https://x/a/iris-vu-1a2b/', published_at: new Date().toISOString() }))[0];
    db.tables.hq_sites.filter(function (x) { return ['brouillon', 'apercu'].indexOf(x.status) >= 0 && x.id !== sI.id && x.id !== sV.id; }).forEach(function (x) { x.data = Object.assign({}, x.data || {}, { revue: { v: DN.VERSION, relu: true } }); });
    dus(['da']);
    const cI = await runtime.cycle({ db: db, agentId: 'da', secondes: 120 });
    const sI2 = leSite(sI.id), sV2 = leSite(sV.id);
    assert.ok(sI2.spec.metier === 'Électricité' && sI2.spec.accroche === 'Fuites, chauffe-eau et salle de bain.' && sI2.spec.da && sI2.spec.da.v === 3 && sI2.data.revue.relu && sI2.version === 2, 'Iris corrige un aperçu pas encore parti : ' + JSON.stringify(cI.passages.map(function (p) { return p.resume; })));
    assert.ok(sV2.spec.accroche === 'Votre partenaire électricité de confiance !' && !sV2.spec.da && sV2.data.revue.relu && sV2.data.revue.restants.length && sV2.version === 1, 'un aperçu déjà vu ne change pas de visage');
    // n. Léa reprend un aperçu fabriqué avant que la clé Pexels n'arrive
    const lL = await prospect('lea', 'Clim Sans Photo', 'climatisation', 'Sainte-Luce', { phone: '+596 696 31 32 33' });
    const sL = (await db.insert('hq_sites', { lead_id: lL.id, slug: 'clim-sans-photo-1a2b', status: 'brouillon', version: 1, spec: Object.assign({}, base, { nom: 'Clim Sans Photo', secteur: 'climatisation', commune: 'Sainte-Luce', photo_hero: 'modern air conditioner living room', photos: [], contact: { tel: '+596696313233' }, da: { v: 3, modele: 'atelier', palette: 'marine-jaune', type: 'barlow', hero: 'nu', services: 'icones', essai: 0 } }), data: {} }))[0];
    db.tables.hq_sites.filter(function (x) { return ['brouillon', 'apercu'].indexOf(x.status) >= 0 && x.id !== sL.id; }).forEach(function (x) { x.data = Object.assign({}, x.data || {}, { photos: { v: IM.VERSION } }); });
    process.env.HQ_PEXELS_KEY = 'pexels-test';
    dus(['photos']);
    const cL = await runtime.cycle({ db: db, agentId: 'photos', secondes: 120 });
    const sL2 = leSite(sL.id);
    assert.ok(sL2.spec.photos.length >= 2 && sL2.spec.photos.every(function (p) { return p.credit && p.role; }) && sL2.spec.da.hero !== 'nu' && sL2.spec.da.palette === 'marine-jaune' && sL2.spec.da.type === 'barlow' && sL2.data.photos.v === IM.VERSION && sL2.version === 2, 'Léa illustre l\'aperçu, le haut de page montre la photo, mêmes couleurs et mêmes lettres : ' + cL.passages.map(function (p) { return p.resume; }).join(' | '));
    delete process.env.HQ_PEXELS_KEY;
    // o. une fiche qui ne se rend pas ne bloque plus la publication des autres sites
    const casse = (await db.insert('hq_sites', { lead_id: lL.id, slug: 'casse-1a2b', status: 'apercu', version: 1, spec: { nom: 'Fiche cassée' }, data: {} }))[0];
    const rendre0 = R.rendre;
    R.rendre = function (site, o) { if (site.slug === 'casse-1a2b') throw new Error('fiche illisible'); return rendre0(site, o); };
    const pubC = await P.publier(db, { raison: 'test fiche cassée' });
    R.rendre = rendre0;
    assert.ok(pubC.publie && db.tables.hq_messages.some(function (m) { return /impossible\(s\) à rendre/.test(m.subject) && /Fiche cassée/.test(m.body); }), 'publication faite sans la fiche cassée, Louis prévenu : ' + pubC.resume);
    casse.status = 'annule';
    // p. Missions : la clé Pexels est essayée avant d'être enregistrée
    const MI = require('../lib/missions');
    assert.ok(/clé Pexels refusée/.test((await MI.enregistrer({ HQ_PEXELS_KEY: 'mauvaise' })).erreur || ''), 'clé Pexels refusée avec la raison');
    const okP = await MI.enregistrer({ HQ_PEXELS_KEY: 'bonne-cle-pexels' });
    assert.ok(okP.ok && okP.enregistre.indexOf('HQ_PEXELS_KEY') >= 0, 'clé Pexels essayée puis enregistrée : ' + JSON.stringify(okP));
    delete process.env.HQ_PEXELS_KEY;
    console.log('Moteur des sites OK : huit modèles de métier, voisins toujours différents, contrastes, titre clair et phrase concrète, WhatsApp d\'abord et fixe gardé, Léa et ses photos regardées une à une (visages, logos et hors-sujet recalés), banque de secours, Margot et le registre (SARL, EI, capital, alerte), fiche du client, ses photos à la place, retouches sans effet de bord, Iris, publication robuste, clé Pexels');
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
