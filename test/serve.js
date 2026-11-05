// La tour en local, sans Vercel : node test/serve.js [--creation | --demo] [--port=8790]
// Les vraies API sur une base en mémoire remplie d'un monde réaliste (prospects, emails, aperçus, ventes, messages) ;
// le réseau est simulé (test/fakes.js). Mot de passe local : « la tour de test 2026 ». --creation : la porte demande
// de créer le mot de passe ; --demo : sans base. Uniquement pour regarder l'interface, jamais en production.
'use strict';
const REPO = require('path').join(__dirname, '..');
const http = require('http'), fs = require('fs'), path = require('path');
process.env.ANTHROPIC_API_KEY = 'test'; process.env.GOOGLE_MAPS_API_KEY = 'test'; process.env.HQ_LOCAL = '1';
const MODE = process.argv.indexOf('--creation') >= 0 ? 'creation' : process.argv.indexOf('--demo') >= 0 ? 'demo' : 'connexion';
require('./fakes');
const DB = require(REPO + '/lib/db');
const A = require(REPO + '/lib/acces');
const PORT = Number((process.argv.find(function (a) { return /^--port=/.test(a); }) || '--port=8790').split('=')[1]);

const db = DB.memory();
if (MODE !== 'demo') DB.forcer(db);

const T = (min) => new Date(Date.now() - min * 60000).toISOString();
const r = (function () { let s = 42; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
async function peupler() {
  const RT = require(REPO + '/lib/runtime');
  await RT.semer(db);
  const tb = db.tables;
  // les agents : certains au travail, des passages, des coûts
  const travail = { reponses: 'Prépare la réponse à Clim Éole (aperçu Vitrine)', demo: 'Fabrique l\'aperçu de Garage Lafontaine, Le Lamentin', chasse_maps: 'Cherche des plombiers à Ducos et au Robert', redacteur: 'Écrit à Boulangerie Saint-Pierre', photos: 'Regarde 6 photos de garage', da_studio: '' };
  tb.hq_agents.forEach((a, i) => {
    if (a.kind === 'attente') return;
    a.status = travail[a.id] ? 'working' : (i % 9 === 4 ? 'waiting' : 'idle');
    a.current_task = travail[a.id] || (a.kind === 'job' ? 'Passage fait : 12 pistes regardées, 3 retenues' : 'Rapport envoyé à son chef');
    a.last_run_at = T(10 + i * 7); a.next_run_at = new Date(Date.now() + (5 + i * 3) * 60000).toISOString();
    a.stats = { runs: 4 + (i % 9) * 3, cout: Math.round((0.05 + r() * 1.4) * 100) / 100, produit: Math.round(r() * 40) };
  });
  const noms = ['Clim Éole', 'Garage Lafontaine', 'Boulangerie Saint-Pierre', 'Institut Lumière', 'Plomberie du Robert', 'Taxi Caraïbes', 'Le Comptoir du Marin', 'Serrurerie du Nord', 'Pâtisserie Les Anses', 'Auto-école Madinina', 'Fleurs de Trinité', 'Pressing du Lamentin', 'Kiné Schœlcher', 'Menuiserie Ducos', 'Glacier Tropic', 'Piscines Sainte-Luce'];
  const secteurs = ['Climatisation', 'Garage', 'Boulangerie', 'Esthétique', 'Plomberie', 'Taxi', 'Restaurant', 'Serrurerie', 'Pâtisserie', 'Auto-école', 'Fleuriste', 'Pressing', 'Kinésithérapie', 'Menuiserie', 'Glacier', 'Piscines'];
  const communes = ['Le Lamentin', 'Fort-de-France', 'Saint-Pierre', 'Schœlcher', 'Le Robert', 'Ducos', 'Le Marin', 'Le Lorrain', 'Les Anses-d\'Arlet', 'Rivière-Salée', 'La Trinité', 'Le Lamentin', 'Schœlcher', 'Ducos', 'Sainte-Anne', 'Sainte-Luce'];
  const statuts = ['a_contacter', 'a_contacter', 'contacte', 'contacte', 'contacte', 'relance', 'a_appeler', 'brouillon', 'interesse', 'client', 'nouveau', 'ecarte'];
  for (let i = 0; i < 146; i++) {
    const k = i % noms.length;
    await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'dev:' + i, source: ['maps', 'domaines', 'registre'][i % 3], name: noms[k] + (i >= noms.length ? ' ' + (Math.floor(i / noms.length) + 1) : ''), sector: secteurs[k], island: 'MQ', commune: communes[k], website: i % 4 ? 'www.' + noms[k].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.fr' : null, email: i % 5 ? 'contact@' + noms[k].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.fr' : null, phone: '+596 696 ' + String(100000 + i * 37).slice(0, 2) + ' ' + String(10 + i % 80) + ' ' + String(20 + i % 70), site_state: ['aucun', 'ancien', 'pas mobile', 'page Facebook'][i % 4], score: 40 + Math.round(r() * 55), reason: 'Pas de site, fiche Google bien notée (4,6 sur 31 avis), activité qui se montre en photos.', status: statuts[i % statuts.length], created_at: T(60 * 24 * (i % 14)), data: { audit: { defauts: i % 3 ? ['pas de https', 'pas de mentions légales'] : [] } } });
  }
  const leads = tb.hq_leads;
  for (let i = 0; i < 64; i++) await db.insert('hq_outbox', { lead_id: leads[i].id, agent_id: i % 3 ? 'redacteur' : 'relanceur', to_email: leads[i].email || 'contact@exemple.fr', subject: i % 3 ? 'Votre site, déjà prêt à voir' : 'Re: Votre site, déjà prêt à voir', body: 'Bonjour,\n\nJ\'ai préparé un aperçu de site pour ' + leads[i].name + ' : il est en ligne, vous pouvez le voir ici.\n\nSi ça vous plaît, il passe sur votre nom de domaine en deux jours.\n\nLouis, Novalemo\n\nSTOP pour ne plus recevoir de message.', step: i % 3 ? 1 : 2, angle: i % 3 ? (i % 2 ? 'v:A apercu' : 'v:B facebook') : 'relance1', status: i < 4 ? 'pret' : i < 6 ? 'a_valider' : 'envoye', kind: i % 3 ? 'prospection' : 'relance', sent_at: i >= 6 ? T(60 * (i * 3)) : null, created_at: T(60 * (i * 3 + 5)) });
  const ib = await db.insert('hq_inbox', { message_id: 'dev-1', kind: 'reponse', lead_id: leads[2].id, from_email: leads[2].email, from_name: 'Rodolphe Larcher', subject: 'Re: Votre site, déjà prêt à voir', body: 'Bonjour,\n\nJ\'ai regardé, c\'est pas mal du tout. C\'est combien pour la version avec plusieurs pages ? Et vous pouvez mettre nos horaires du samedi ?\n\nRodolphe', status: 'brouillon', intent: 'interesse', received_at: T(42), data: { note: 'Intéressé par Vitrine, demande les horaires du samedi : à ajouter avant le lien de paiement.' } });
  await db.insert('hq_outbox', { lead_id: leads[2].id, inbox_id: ib[0].id, agent_id: 'reponses', to_email: leads[2].email, subject: 'Re: Votre site, déjà prêt à voir', body: 'Bonjour Rodolphe,\n\nMerci pour votre retour. La formule Vitrine (plusieurs pages : accueil, services, à propos, contact) est à 990 € en une fois, ou 89 € par mois.\n\nJ\'ajoute vos horaires du samedi dès maintenant. Lesquels sont-ils ?\n\nEmma\nNovalemo, sites internet en Martinique', status: 'a_valider', kind: 'reponse', step: 1 });
  await db.insert('hq_inbox', { message_id: 'dev-2', kind: 'reponse', lead_id: leads[8].id, from_email: leads[8].email, from_name: 'Institut Lumière', subject: 'Re: Votre site', body: 'Bonjour, pouvez-vous m\'appeler ?', status: 'nouveau', intent: 'rdv', received_at: T(12) });
  // les sites
  const sites = [['apercu', 12], ['commande', 2], ['paye', 1], ['en_ligne', 3]];
  let n = 0;
  for (const [st, c] of sites) for (let i = 0; i < c; i++) {
    const l = leads[n % leads.length]; n++;
    const ab = st === 'en_ligne' && i === 0;
    await db.insert('hq_sites', { lead_id: l.id, slug: 'dev-' + n, status: st, formule: ['vitrine', 'essentiel', 'signature'][n % 3], montant_eur: [990, 590, 1390][n % 3], url_apercu: 'https://novalemo-martinique.vercel.app/dev-' + n, domaine: st === 'en_ligne' ? l.name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.fr' : null, domaine_mode: 'achat', url_finale: st === 'en_ligne' ? 'https://' + l.name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '.fr' : null, stripe: st === 'commande' ? { url: 'https://buy.stripe.com/test_dev', url_mois: 'https://buy.stripe.com/test_dev_mois' } : st !== 'apercu' ? { facture_url: 'https://invoice.stripe.com/dev' } : {}, paid_at: ['paye', 'en_ligne'].indexOf(st) >= 0 ? T(60 * 24 * (3 + i)) : null, live_at: st === 'en_ligne' ? T(60 * 24 * (1 + i)) : null, published_at: T(60 * (20 + n * 9)), created_at: T(60 * (24 + n * 9)), spec: { nom: l.name, activite: l.sector, commune: l.commune, photos: [1, 2, 3], da: { modele: ['atelier', 'garage', 'comptoir', 'ecrin'][n % 4], hero: 'photo' } }, data: ab ? { abonnement: { mensualite_eur: 89, statut: 'active', paye_eur: 178, engagement_jusqu_au: new Date(Date.now() + 300 * 86400000).toISOString() } } : {} });
  }
  // les messages du fil
  // le Studio : quelques vidéos à différentes étapes
  const ex = require(REPO + '/usine/exemples/clim.json');
  const vids = [
    ['prete', 'How your AC moves heat outside', 'climatiseur à compression', { note: 8.5, verdict: 'publier', resume: 'On comprend toute la boucle, les gros plans sont nets et les étiquettes tombent juste.' }, ['en', 'fr', 'es', 'pt', 'hi']],
    ['langues', 'Why a tunnel boring machine never stops', 'tunnelier', { note: 8, verdict: 'publier', resume: 'La roue de coupe impressionne dès la première image.' }, ['en', 'fr']],
    ['critique', 'The 4-stroke engine in 60 seconds', 'moteur 4 temps', null, ['en']],
    ['script', 'How a water fountain stays cold', 'fontaine à eau réfrigérée', null, []],
    ['relecture', 'Why your fridge hums at night', 'réfrigérateur', null, []],
    ['accroche', 'How a lock knows your key', 'serrure à goupilles', null, []]
  ];
  // ce que la salle d'écriture laisse sur chaque vidéo (accroches de Sacha, notes de Félix, vérification d'Hélène)
  const ecrit = { brief: { revelation: 'Le froid n\'existe pas : la clim déplace la chaleur.', choix: 1, accroches: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ n, famille: 'contradiction', voix: n === 1 ? ex.script.beats[0].voix : 'Accroche ' + n, ecran: ex.script.accroche })) }, relectures: [{ note: 8.9, notes: { accroche: 9 }, resume: 'Accroche nette, relance au bon endroit, la fin renvoie au début.' }], versions: 2, note_viral: 8.9, verif: { resume: 'Tout est juste, un chiffre nuancé.', faits: [{ statut: 'juste' }, { statut: 'juste' }, { statut: 'approximatif' }], corriges: [10] } };
  for (const [k, v] of vids.entries()) {
    const rendus = {}; v[4].forEach((l) => { rendus[l] = { etat: v[0] === 'langues' && l !== 'en' ? 'demande' : 'fini', duree: 62 + k, demande_le: T(30) }; });
    await db.insert('hq_videos', { ligne: 'meca', titre: v[1], sujet: v[2], status: v[0], langue_source: 'en', langues: ['en', 'fr', 'es', 'pt', 'hi'], script: Object.assign({}, ex.script, v[0] === 'accroche' ? { brief: ecrit.brief, beats: undefined } : ecrit, { titre: v[1] }), scene: ex.scene, traductions: v[0] === 'prete' ? ex.langues : {}, rendus: rendus, critique: v[3] || {}, cout_usd: 0.21 + k * 0.03, dedupe: 'meca:dev-' + k, created_at: T(60 * (5 + k)), updated_at: T(10 + k * 25) });
  }
  const fil = [['chasse_maps', 'contacts', 'rapport', '18 prospects trouvés au Lamentin et à Ducos'], ['demo', 'chef_prod', 'rapport', '3 aperçus en ligne : Garage Lafontaine, Clim Éole, Pressing du Lamentin'], ['reponses', 'louis', 'note', 'Rodolphe Larcher est intéressé par Vitrine'], ['livraison', 'louis', 'rapport', 'Clim Éole est en ligne sur climeole.fr'], ['dg_novalemo', 'dircom_novalemo', 'ordre', 'Priorité aux garages et aux climatiseurs cette semaine'], ['juridique', 'chef_prod', 'rapport', '2 entreprises trouvées dans le registre'], ['photos', 'chef_prod', 'rapport', '6 photos regardées, 4 posées'], ['controleur', 'pdg', 'rapport', 'Coût par aperçu : 0,03 $'], ['redacteur', 'emailing', 'rapport', '8 emails écrits, contrôle qualité passé'], ['pdg', 'louis', 'proposition', 'Créer Conformité Web : le dossier est prêt']];
  for (let i = 0; i < fil.length; i++) await db.insert('hq_messages', { from_id: fil[i][0], to_id: fil[i][1], company_id: 'novalemo', kind: fil[i][2], subject: fil[i][3], body: fil[i][3] + '.', created_at: T(4 + i * 23) });
  // 14 jours d'activité
  for (let k = 13; k >= 0; k--) { const d = new Date(Date.now() - k * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Guadeloupe' }); await db.upsert('hq_daily', { day: d, cost_usd: Math.round((0.35 + r() * 1.05) * 100) / 100, runs: 20 + Math.round(r() * 30), leads: Math.round(4 + r() * 16), emails: Math.round(r() * (14 - k)), items: Math.round(r() * 6) }, { onConflict: 'day' }); }
  await db.upsert('hq_config', { key: 'identite', value: { entreprise: 'Louis Renault', forme: 'EI', siret: '10340524700018', marque: 'NOVALEM', prenom: 'Louis', nom: 'Renault', telephone: '+590691253449', adresse: '11 rue de la Somme', cp: '49300', ville: 'Cholet', region: 'Maine-et-Loire', pays: 'FR', source: 'rempli par Claude d\'après la fiche RNE de NOVALEM' } }, { onConflict: 'key' });
}

async function lireCorps(req) { return new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ok({}); } }); }); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const H = { '/api/acces': require(REPO + '/api/acces.js'), '/api/hq': require(REPO + '/api/hq.js') };

(async function () {
  if (MODE !== 'demo') await peupler();
  if (MODE !== 'creation') process.env.HQ_ACCES = await A.hacher('la tour de test 2026');
  if (MODE !== 'demo') A.forcerBase(db);
  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost:' + PORT);
    if (H[u.pathname] || u.pathname === '/api/tick') {
      req.query = Object.fromEntries(u.searchParams);
      if (req.method === 'POST') req.body = await lireCorps(req);
      if (u.pathname === '/api/tick') { const s = await A.exiger(req, res); if (!s) return; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ passages: [{ cout: 0.02, resume: 'Passage de démonstration' }] })); return; }
      return H[u.pathname](req, res);
    }
    let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
    const f = path.join(REPO, p);
    if (!f.startsWith(REPO + path.sep) || /^\/(lib|test|api|supabase|node_modules)\//.test(p)) { res.writeHead(404); res.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
  }).listen(PORT, () => console.log('La tour en local : http://localhost:' + PORT + (MODE === 'connexion' ? ' (mot de passe : la tour de test 2026)' : ' (' + MODE + ')')));
})().catch((e) => { console.error(e); process.exit(1); });
