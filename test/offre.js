// L'offre du 12 nov. 2026, sans réseau : une seule offre à 99 € en une fois, le message de Louis écrit par le code
// (premier email et relance, jamais d'IA), sa version HTML avec le lien derrière des mots, Chloé et Yanis en automatique,
// « Modifier moi-même » sur l'aperçu (textes et photos posés dans la fiche), le panneau, les conditions de vente, l'outil
// de commande d'Emma, et la migration 20 sur une base comme celle de Louis.
// Lance : node test/offre.js
'use strict';
process.env.HQ_TOUR_PROJET = 'prj_tour'; process.env.HQ_TOUR_EQUIPE = 'team_test';
process.env.HQ_LOCAL = '1';
process.env.ANTHROPIC_API_KEY = 'test';
process.env.GOOGLE_MAPS_API_KEY = 'test';
delete process.env.HQ_AGENTS_ACTIFS;
delete process.env.HQ_SUPABASE_KEY; delete process.env.HQ_VERCEL_TOKEN; delete process.env.VERCEL_TOKEN; delete process.env.HQ_STRIPE_KEY; delete process.env.STRIPE_SECRET_KEY;

const assert = require('assert');
const fakes = require('./fakes');
const DB = require('../lib/db');
const config = require('../lib/config');
const { NOVALEMO } = config;
const A = require('../lib/accroche');
const garde = require('../lib/garde');

function base() { const db = DB.memory(); DB.forcer(db); garde.oublier(); return db; }
const il = function (j) { return new Date(Date.now() - j * 86400000).toISOString(); };
// les mots du ton d'avant : critique du site, peur, amende ; et le tiret long, que Louis n'aime pas
const AGRESSIF = /moche|horrible|obsol[eè]te|d[ée]pass[ée]|amende|375 ?000|75 ?000|ne s'affiche pas|mauvais|vieux site|catastroph|perdez des clients|—/i;

(async function () {
  const t0 = Date.now();

  // 1. la grille : une seule offre, 99 € en une fois, sans prix au mois ; Studio Novalem pour les gros projets
  assert.deepStrictEqual(Object.keys(NOVALEMO.grille), ['essentiel'], 'une seule formule');
  assert.ok(NOVALEMO.grille.essentiel.prix === 99 && !NOVALEMO.grille.essentiel.mois && NOVALEMO.hebergement_an_eur === 25, '99 € en une fois, hébergement 25 € par an ensuite');
  assert.ok(NOVALEMO.studio && /studionovalem\.fr/.test(NOVALEMO.studio.url), 'Studio Novalem pour plusieurs pages, réservation, boutique');
  assert.deepStrictEqual(require('../lib/qualite').PRIX_GRILLE.slice().sort(), [25, 99], 'le contrôle ne laisse passer que 99 € et 25 €');
  console.log('Grille OK : 99 € en une fois, 25 € par an ensuite, Studio Novalem au-delà');

  // 2. le message de Louis : ce qu'il a vu (vrai, sans critique), l'aperçu fait d'avance derrière des mots, tout modifiable,
  // 99 €, l'IA dite, Studio Novalem, une question, Louis, STOP
  const url = 'https://apercu.novalemo.fr/a/clim-eole-1a2b/';
  const sansSite = { id: 11, name: 'SARL CLIM EOLE', commune: 'Le Lamentin', site_state: 'aucun', email_source: 'maps', data: { google: { avis: 37, note: 4.8 } } };
  const m1 = A.premier(sansSite, null, url);
  const parag = m1.corps.split('\n\n');
  assert.strictEqual(m1.situation, 'sans_site', 'pas de site');
  assert.ok(parag[0] === 'Bonjour,' && /(Je suis tombé sur|En regardant les entreprises)/.test(parag[1]) && /37 avis/.test(parag[1]) && /4,8/.test(parag[1]) && /Par contre, je n'ai pas trouvé de site internet\./.test(parag[1]), 'il a vu ses avis et pas de site : ' + parag[1]);
  assert.ok(/Clim Eole/.test(m1.corps) && !/SARL|CLIM EOLE/.test(m1.corps), 'le nom écrit comme à une personne (sans forme juridique ni capitales) : ' + parag[1]);
  assert.ok(/J'ai pris un peu d'avance : avec les outils d'aujourd'hui/.test(m1.corps) && m1.corps.indexOf('Voir votre site : ' + url) >= 0, 'l\'avance prise, et le lien derrière « Voir votre site »');
  assert.ok(/Tout est modifiable : en bas de la page, vous changez vous-même les textes et les photos/.test(m1.corps), 'tout est modifiable, en bas de la page');
  assert.ok(/il est à vous pour 99 € en une fois, sans abonnement/.test(m1.corps) && /puis 25 € par an/.test(m1.corps) && /fait avec l'aide de l'IA/.test(m1.corps) && /largement suffisant/.test(m1.corps), '99 €, sans abonnement, fait avec l\'IA et largement suffisant');
  assert.ok(/studionovalem\.fr/.test(m1.corps) && /Louis\nNovalemo/.test(m1.corps) && /répondez STOP/.test(m1.corps) && /sur votre fiche Google/.test(m1.corps), 'Studio Novalem, signé Louis, l\'adresse dite, STOP');
  assert.ok(!AGRESSIF.test(m1.corps) && !AGRESSIF.test(m1.objet), 'aucune critique, aucune amende, aucun tiret long');
  assert.ok(/Clim Eole/.test(m1.objet) && m1.objet.length <= 60, 'objet court avec son nom : ' + m1.objet);
  require('../lib/qualite').horsGrille(m1.objet + '\n' + m1.corps).forEach(function (p) { assert.fail('prix hors grille dans le message de Louis : ' + p); });
  // une note basse ne se cite pas ; peu d'avis non plus
  const bas = A.premier({ id: 12, name: 'Garage du Nord', commune: 'Le Lorrain', site_state: 'aucun', data: { google: { avis: 23, note: 3.2 } } }, null, url);
  assert.ok(!/3,2|23 avis/.test(bas.corps) && /Je suis tombé sur Garage du Nord|En regardant les entreprises à Le Lorrain/.test(bas.corps), 'une note basse n\'est pas citée');
  const peu = A.premier({ id: 13, name: 'Taxi Ti Punch', site_state: 'reseau', data: { google: { avis: 3, note: 5 } } }, null, url);
  assert.ok(!/3 avis/.test(peu.corps) && /à part vos réseaux/.test(peu.corps), 'trois avis ne se citent pas ; une page de réseau social n\'est pas un site');
  // il a déjà un site : jamais un mot contre, « une version plus récente »
  const avecSite = A.premier({ id: 14, name: 'Plomberie du Robert', commune: 'Le Robert', site_state: 'ancien', website: 'plomberie-robert.fr', email_source: 'site', data: { google: { avis: 12, note: 4.5 } } }, null, url);
  assert.ok(avecSite.situation === 'site' && /J'ai vu que vous aviez déjà un site\./.test(avecSite.corps) && /une version plus récente/.test(avecSite.corps) && /sur votre site\./.test(avecSite.corps) && !AGRESSIF.test(avecSite.corps), 'site existant : une version plus récente, sans critique');
  // un domaine réservé qui n'affiche qu'une page d'attente
  const dom = A.premier({ id: 15, name: 'Maison Durand', source: 'domaines', domain: 'https://www.maison-durand.fr/', site_state: 'parking' }, null, url);
  assert.ok(/J'ai vu que vous aviez réservé l'adresse maison-durand\.fr\. Elle n'affiche encore qu'une page d'attente\./.test(dom.corps), 'un domaine réservé : dit simplement');
  // un nom trop long : un objet sans le nom
  assert.strictEqual(A.premier({ id: 16, name: 'Entreprise Générale de Bâtiment et de Rénovation des Trois-Îlets', site_state: 'aucun' }, null, url).objet, 'Votre site, prêt à voir', 'nom trop long : objet neutre');
  // la même entreprise garde la même tournure ; deux voisines en ont souvent une autre
  assert.strictEqual(A.premier(sansSite, null, url).corps, m1.corps, 'même prospect, même message');
  const tournures = new Set([21, 22, 23, 24, 25, 26, 27, 28].map(function (id) { return A.premier(Object.assign({}, sansSite, { id: id }), null, url).corps.split('\n\n')[1].slice(0, 25); }));
  assert.ok(tournures.size >= 2, 'plusieurs tournures entre voisins : ' + Array.from(tournures).join(' | '));
  console.log('Message de Louis OK : ce qu\'il a vu sans critique, avance prise, lien derrière des mots, tout modifiable, 99 €, IA dite, Studio Novalem, STOP');

  // 3. la version HTML : le lien derrière « Voir votre site », pas d'image, STOP en petit, rien d'injecté
  const h = A.html(m1.corps);
  assert.ok(A.avecLien(m1.corps) && h.indexOf('<a href="' + url + '"') >= 0 && />Voir votre site<\/a>/.test(h) && h.indexOf('>' + url + '<') < 0, 'le lien est sur les mots « Voir votre site »');
  assert.ok(!/<img|<script|tracking|pixel/i.test(h) && /font-size:12px[^>]*>Je vous écris/.test(h), 'pas d\'image ni de traceur, la ligne STOP en petit');
  const piege = A.html('Bonjour <b>toi</b>,\n\nVoir votre site : https://x.fr/a/"onmouseover=alert(1)');
  assert.ok(!/<b>/.test(piege) && !/"onmouseover/.test(piege), 'le texte est échappé : ' + piege);
  assert.ok(!A.avecLien('Bonjour,\n\nPas de lien ici.'), 'sans lien : pas de version HTML');
  console.log('HTML OK : lien derrière les mots, sans image ni traceur, échappé');

  // 4. la relance : l'ancien message (490 €) apprend le nouveau prix ; le nouveau, un simple rappel
  const r1 = A.relance(sansSite, null, url, true).corps, r2 = A.relance(sansSite, null, url, false).corps;
  assert.ok(/maintenant à 99 €, en une fois et sans abonnement/.test(r1) && r1.indexOf('Voir votre site : ' + url) >= 0 && /STOP/.test(r1) && !AGRESSIF.test(r1), 'relance de l\'ancien message : le nouveau prix');
  assert.ok(/au cas où mon premier message serait passé à la trappe/.test(r2) && /99 € en une fois/.test(r2) && /STOP/.test(r2) && !AGRESSIF.test(r2), 'relance du message de Louis : un rappel');
  console.log('Relance OK : nouveau prix pour l\'ancien message, rappel pour le nouveau');
  // la version WhatsApp ou SMS (envoyée par Louis lui-même) : courte, le lien en clair, une sortie
  const wa = A.whatsapp({ id: 31, name: 'LA CLEAN’IK DETAILING', commune: 'Fort-de-France', site_state: 'reseau', data: { google: { avis: 65, note: 5 } } }, null, url);
  assert.ok(wa.indexOf(url) >= 0 && /99 € en une fois/.test(wa) && /65 avis/.test(wa) && /à part vos réseaux/.test(wa) && /Pas intéressé \?/.test(wa) && !AGRESSIF.test(wa) && wa.length < 800, 'message WhatsApp : ' + wa);
  assert.ok(/La Clean’ik Detailing/.test(wa) && A.nomDe({ name: "D'ALU SERVICES" }) === "D'Alu Services", 'les capitales : ' + A.nomDe({ name: 'LA CLEAN’IK DETAILING' }) + ' / ' + A.nomDe({ name: "D'ALU SERVICES" }));

  // 5. Chloé en automatique : seulement un prospect de Martinique, adresse lue, aperçu publié et passé ; jamais d'IA
  let db = base();
  const RT = require('../lib/runtime');
  await RT.semer(db);
  const P = require('../lib/sites/publication');
  const budget = Object.assign({}, config.BUDGET_DEFAUT);
  const ECRIRE = require('../lib/jobs/ecrire'), RELANCER = require('../lib/jobs/relancer');
  const sansHote = await ECRIRE.run({ db: db, budget: budget, agent: { id: 'redacteur' } });
  assert.ok(sansHote.produit === 0 && /pas encore publiés/.test(sansHote.resume), 'aperçus pas encore publiés : rien');
  await P.ecrireEtat(db, { hote: 'apercu.novalemo.fr', hote_vercel: 'novalemo-martinique.vercel.app' });
  const leadSite = async function (k, lead, siteSt) {
    const s = (await db.insert('hq_sites', { slug: 'p-' + k + '-1a2b', status: siteSt || 'apercu', version: 1, spec: { nom: lead.name, commune: lead.commune || 'Ducos' }, data: {} }))[0];
    const l = (await db.insert('hq_leads', Object.assign({ company_id: 'novalemo', dedupe: 'test:o:' + k, source: 'maps', island: 'MQ', commune: 'Ducos', status: 'a_contacter', apercu_etat: 'publie', site_id: s.id, score: 90 - k, email_source: 'site', site_state: 'aucun' }, lead)))[0];
    await db.update('hq_sites', { lead_id: l.id }, { eq: { id: s.id } });
    return l;
  };
  const ok1 = await leadSite(1, { name: 'Clim Éole', email: 'jean@climeole.fr', data: { google: { avis: 37, note: 4.8 } } });
  const devine = await leadSite(2, { name: 'Devine SARL', email: 'contact@devine-mq.fr', email_source: 'devine', phone: '+596696000002' });
  const gp = await leadSite(3, { name: 'Gwada Clim', email: 'a@gwada.fr', island: 'GP' });
  const stop = await leadSite(4, { name: 'Stop SARL', email: 'non@stop-mq.fr' });
  await db.insert('hq_suppression', { email: 'non@stop-mq.fr', raison: 'STOP' }, { returning: false });
  const doublon = await leadSite(5, { name: 'Clim Éole bis', email: 'jean@climeole.fr' });
  const pasEnLigne = await leadSite(6, { name: 'Expiré SARL', email: 'x@expire-mq.fr' }, 'expire');
  const appels0 = fakes.appels();
  const e1 = await ECRIRE.run({ db: db, budget: budget, agent: { id: 'redacteur' }, compteurs: {} });
  assert.strictEqual(fakes.appels(), appels0, 'Chloé n\'appelle jamais Claude');
  const ob = function (lid) { return (db.tables.hq_outbox || []).filter(function (o) { return o.lead_id === lid; }); };
  const lead = function (lid) { return db.tables.hq_leads.find(function (l) { return l.id === lid; }); };
  const o1 = ob(ok1.id)[0];
  assert.ok(e1.produit === 1 && o1 && o1.status === 'pret' && o1.kind === 'prospection' && o1.step === 1 && /^v:L sans_site$/.test(o1.angle) && o1.body.indexOf('Voir votre site : https://apercu.novalemo.fr/a/p-1-1a2b/') >= 0 && lead(ok1.id).status === 'brouillon', 'un premier email, le message de Louis avec SON lien, en pilote automatique : ' + e1.resume);
  assert.ok(!ob(devine.id).length && lead(devine.id).status === 'a_appeler', 'adresse devinée : jamais d\'email, à appeler');
  assert.ok(!ob(gp.id).length && !ob(stop.id).length && lead(stop.id).status === 'stop', 'hors Martinique et STOP : rien');
  assert.ok(!ob(doublon.id).length && lead(doublon.id).status === 'ecarte', 'la même adresse sous une autre fiche : écartée');
  assert.ok(!ob(pasEnLigne.id).length, 'aperçu plus en ligne : rien');
  const e1b = await ECRIRE.run({ db: db, budget: budget, agent: { id: 'redacteur' }, compteurs: {} });
  assert.ok(e1b.produit === 0 && ob(ok1.id).length === 1, 'un seul premier email par prospect');
  // pilote coupé : il attend Louis ; phase de test : rien du tout
  const manuel = await leadSite(7, { name: 'Manuel SARL', email: 'contact@manuel-mq.fr' });
  await ECRIRE.run({ db: db, budget: Object.assign({}, budget, { envoi_auto: false }), agent: { id: 'redacteur' }, compteurs: {} });
  assert.strictEqual(ob(manuel.id)[0].status, 'a_valider', 'pilote coupé : validation de Louis');
  await require('../lib/sites/phase').ecrire(db, 'test', 'louis');
  const enTest = await leadSite(8, { name: 'Phase SARL', email: 'contact@phase-mq.fr' });
  const e2 = await ECRIRE.run({ db: db, budget: budget, agent: { id: 'redacteur' }, compteurs: {} });
  assert.ok(e2.produit === 0 && !ob(enTest.id).length && /Phase de test/.test(e2.resume), 'phase de test : aucun premier email');
  await require('../lib/sites/phase').ecrire(db, 'envoi', 'louis');
  console.log('Chloé OK : message de Louis avec son lien, sans IA, jamais une adresse devinée, hors zone, STOP, doublon ou aperçu disparu');

  // 6. Yanis en automatique : une relance, quatre jours après, à qui n'a rien dit ; l'ancien message apprend le prix
  const premier = async function (l, jours, angle) {
    await db.update('hq_leads', { status: 'contacte' }, { eq: { id: l.id } });
    return (await db.insert('hq_outbox', { lead_id: l.id, to_email: l.email, subject: 'Le site de ' + l.name, body: 'x', step: 1, angle: angle, status: 'envoye', kind: 'prospection', sent_at: il(jours), message_id: '<hq.' + l.id + '.abc@novalemo.fr>' }))[0];
  };
  const vieux = await leadSite(20, { name: 'Ancien Ton', email: 'a@ancien-mq.fr' });
  const nouveau = await leadSite(21, { name: 'Nouveau Ton', email: 'b@nouveau-mq.fr' });
  const repondu = await leadSite(22, { name: 'Répondu SARL', email: 'c@repondu-mq.fr' });
  const recent = await leadSite(23, { name: 'Récent SARL', email: 'd@recent-mq.fr' });
  const pv = await premier(vieux, 5, 'v:A apercu');
  await premier(nouveau, 6, 'v:L site');
  await premier(repondu, 5, 'v:L sans_site');
  await db.insert('hq_inbox', { lead_id: repondu.id, from_email: repondu.email, subject: 'Re: x', body: 'Merci, pas pour l\'instant.', kind: 'reponse', status: 'traite', received_at: il(1) }, { returning: false });
  await premier(recent, 2, 'v:L sans_site');
  const appels1 = fakes.appels();
  const y1 = await RELANCER.run({ db: db, budget: budget, agent: { id: 'relanceur' }, compteurs: {} });
  assert.strictEqual(fakes.appels(), appels1, 'Yanis n\'appelle jamais Claude');
  const rv = ob(vieux.id).find(function (o) { return o.kind === 'relance'; }), rn = ob(nouveau.id).find(function (o) { return o.kind === 'relance'; });
  assert.ok(rv && rv.angle === 'relance 99' && /maintenant à 99 €/.test(rv.body) && rv.step === 2 && rv.in_reply_to === pv.message_id && rv.subject === 'Re: ' + pv.subject && rv.status === 'pret', 'l\'ancien message (490 €) : la relance annonce 99 €, dans le même fil');
  assert.ok(rn && rn.angle === 'v:L relance' && /au cas où/.test(rn.body), 'le message de Louis : un simple rappel');
  assert.ok(!ob(repondu.id).some(function (o) { return o.kind === 'relance'; }) && !ob(recent.id).some(function (o) { return o.kind === 'relance'; }), 'jamais à qui a répondu, jamais avant quatre jours');
  const y2 = await RELANCER.run({ db: db, budget: budget, agent: { id: 'relanceur' }, compteurs: {} });
  assert.ok(y1.produit === 2 && y2.produit === 0, 'une seule relance au total : ' + y1.resume + ' / ' + y2.resume);
  console.log('Yanis OK : une relance à J+4 dans le même fil, nouveau prix pour l\'ancien message, jamais à qui a répondu');

  // 7. l'envoi : la version HTML part avec la version texte, le lien sur les mots ; jamais sans STOP
  process.env.HQ_MAIL_USER = 'louis@novalemo.fr'; process.env.HQ_MAIL_PASS = 'secret-de-test';
  const mail = require('../lib/mail'), ENVOI = require('../lib/jobs/envoi');
  ENVOI.sansDelai(true);
  const partis = [];
  mail.forcer({ mx: ['mx1.mail.ovh.net'], envoyer: async function (raw, o) { partis.push(raw.toString('utf8')); }, relever: async function (etat) { return { etat: etat || {}, messages: [], vus: 0 }; }, tester: async function () { return { smtp: { ok: true }, imap: { ok: true } }; }, dns: async function (d) { return { domaine: d, fournisseur: 'OVH', mx: [], spf: { ok: true }, dkim: { ok: true }, dmarc: { ok: true }, verifie_le: new Date().toISOString() }; } });
  db.tables.hq_outbox.forEach(function (o) { if (o.status === 'pret' && o.id !== o1.id) o.status = 'annule'; });
  await ENVOI.run({ db: db, budget: budget, limite: Date.now() + 60000, toujours: true, espacement: 0 });
  const raw = partis.join('\n');
  const o1b = db.tables.hq_outbox.find(function (o) { return o.id === o1.id; });
  assert.ok(o1b.status === 'envoye' && partis.length === 1, 'le premier email part : ' + o1b.status + ' ' + (o1b.error || ''));
  assert.ok(/Content-Type: multipart\/alternative/i.test(raw) && /Content-Type: text\/plain/i.test(raw) && /Content-Type: text\/html/i.test(raw), 'texte et HTML ensemble');
  const decode = function (s) { return s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, function (m, x) { return String.fromCharCode(parseInt(x, 16)); }); };
  const rawD = decode(raw);
  assert.ok(/<a href="https:\/\/apercu\.novalemo\.fr\/a\/p-1-1a2b\/"[^>]*>Voir votre site<\/a>/.test(rawD) || /Voir votre site/.test(Buffer.from((raw.match(/text\/html[\s\S]*?\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/) || [])[1] || '', 'base64').toString('utf8')), 'le lien sur « Voir votre site » dans la version HTML');
  console.log('Envoi OK : version texte et version HTML, le lien sur les mots');

  // 8. « Modifier moi-même » : ses textes et ses photos posés dans la fiche, sans IA ; jamais ses coordonnées
  const ED = require('../lib/sites/edition'), RET = require('../lib/sites/retours');
  const spec0 = { nom: 'Froid Caraïbes', titre: 'Climatisation au Lamentin', accroche: 'Pose et entretien.', services: [{ titre: 'Pose', texte: 'On pose vite.' }], photos: [{ fichier: 'h1.jpg', role: 'hero', place: 'hero', credit: { source: 'Pexels' } }], logo: { fichier: 'logo.png' } };
  const ap = ED.appliquer(spec0, [{ avant: 'Climatisation au Lamentin', apres: 'Votre clim posée en un jour' }, { avant: 'On pose vite.', apres: 'Pose en une journée.' }, { avant: 'Froid Caraïbes', apres: 'Froid Caraïbes, depuis 1998' }, { avant: 'x', apres: 'x' }], [{ fichier: 'h1.jpg', img: { fichier: 'c9.jpg', sha: 's', l: 1200, h: 800 } }]);
  assert.ok(ap.bilan.fiche === 2 && ap.bilan.gabarit === 1 && ap.bilan.photos === 1 && ap.spec.titre === 'Votre clim posée en un jour' && ap.spec.services[0].texte === 'Pose en une journée.' && spec0.titre === 'Climatisation au Lamentin', 'textes de la fiche changés dans une copie : ' + JSON.stringify(ap.bilan));
  assert.ok(ap.spec.photos[0].fichier === 'c9.jpg' && ap.spec.photos[0].role === 'hero' && !ap.spec.photos[0].credit && ap.spec.provenance.photos === 'client', 'sa photo à la place, même rôle, plus de crédit de banque');
  const page = '<title>Froid Caraïbes</title><header><b>Froid Caraïbes</b></header><main id="contenu"><p class="k">Froid Caraïbes</p><img alt="Froid Caraïbes"></main><footer><p>Froid Caraïbes</p></footer>';
  const pageEd = ED.html(page, ap.spec);
  assert.ok(/<main id="contenu"><p class="k">Froid Caraïbes, depuis 1998<\/p><img alt="Froid Caraïbes">/.test(pageEd) && /<header><b>Froid Caraïbes<\/b><\/header>/.test(pageEd) && /<footer><p>Froid Caraïbes<\/p>/.test(pageEd) && /<title>Froid Caraïbes<\/title>/.test(pageEd), 'un texte du gabarit change dans le corps de la page seulement, jamais dans un attribut, l\'en-tête ou le pied : ' + pageEd);
  // le même texte modifié deux fois : une seule ligne, du premier au dernier
  const ap2 = ED.appliquer(ap.spec, [{ avant: 'Froid Caraïbes, depuis 1998', apres: 'Froid Caraïbes, la clim depuis 1998' }], []);
  assert.ok(ap2.spec.edition.textes.length === 1 && ap2.spec.edition.textes[0].avant === 'Froid Caraïbes' && ap2.spec.edition.textes[0].apres === 'Froid Caraïbes, la clim depuis 1998', 'retouché deux fois : une chaîne, pas deux remplacements : ' + JSON.stringify(ap2.spec.edition.textes));
  // par le panneau : enregistré, version suivante, Louis prévenu, le prospect devient intéressé, ses emails en file tombent
  const lE = await leadSite(30, { name: 'Froid Caraïbes', email: 'contact@froid-mq.fr', status: 'contacte' });
  const sE = db.tables.hq_sites.find(function (x) { return x.id === lE.site_id; });
  sE.spec = JSON.parse(JSON.stringify(spec0));
  await db.insert('hq_outbox', { lead_id: lE.id, to_email: lE.email, subject: 'Re: x', body: 'relance', step: 2, status: 'pret', kind: 'relance' }, { returning: false });
  const sansMail = await RET.edition(db, sE, { textes: [{ avant: 'Pose et entretien.', apres: 'Pose, entretien, dépannage.' }] });
  const rien = await RET.edition(db, sE, { textes: [{ avant: 'Pose', apres: 'Pose' }], email: 'patron@froid-mq.fr' });
  assert.ok(/email/.test(sansMail.erreur || '') && /rien n'a changé/.test(rien.erreur || ''), 'sans email, ou sans changement : refusé');
  const okE = await RET.edition(db, sE, { textes: [{ avant: 'Pose et entretien.', apres: 'Pose, entretien, dépannage.' }, { avant: 'Pose', apres: 'Installation' }], email: 'patron@froid-mq.fr', tel: '0696 11 22 33' });
  const sE2 = db.tables.hq_sites.find(function (x) { return x.id === sE.id; });
  const lE2 = lead(lE.id);
  assert.ok(okE.ok && okE.textes === 2 && sE2.spec.accroche === 'Pose, entretien, dépannage.' && sE2.spec.services[0].titre === 'Installation' && sE2.version === 2 && sE2.data.edition_client.email === 'patron@froid-mq.fr', 'enregistré dans la fiche, version suivante : ' + JSON.stringify(okE));
  assert.ok(lE2.status === 'interesse' && lE2.score >= 95 && lE2.phone === '0696112233', 'le prospect passe intéressé, son téléphone gardé : ' + JSON.stringify({ st: lE2.status, sc: lE2.score, tel: lE2.phone }));
  assert.ok(ob(lE.id).filter(function (o) { return o.kind === 'relance'; }).every(function (o) { return o.status === 'annule'; }), 'sa relance en file tombe : il s\'est manifesté');
  assert.ok((db.tables.hq_inbox || []).some(function (x) { return x.lead_id === lE.id && /A modifié son site/.test(x.subject) && x.intent === 'interesse'; }) && (db.tables.hq_messages || []).some(function (m) { return m.to_id === 'louis' && /a modifié son site lui-même/.test(m.subject || ''); }) && (await P.lireEtat(db)).a_publier, 'Emma et Louis le savent, Lucas republie');
  sE2.status = 'paye';
  assert.ok(/ne se modifie plus/.test((await RET.edition(db, sE2, { textes: [{ avant: 'Installation', apres: 'Pose' }], email: 'patron@froid-mq.fr' })).erreur || ''), 'payé : plus de modification depuis l\'aperçu');
  console.log('Modifier moi-même OK : textes de la fiche, textes du gabarit (corps seulement), photos, enregistré sans IA, Louis prévenu, relance annulée');

  // 9. le panneau de l'aperçu : 99 €, « Modifier moi-même », une seule offre déjà choisie, Studio Novalem ; le script tient
  const PN = require('../lib/sites/panneau'), R = require('../lib/sites/rendu'), VT = require('./vitrine');
  const rendu = R.rendre({ slug: 'vitrine-clim', spec: VT.exemple('clim', 0) }, { mode: 'apercu', optimiseur: false, racineImg: '/img/', base: '/', contactNovalemo: 'louis@novalemo.fr', retour: { api: '/api/apercu', jeton: 'jt', site: 'vitrine-clim' } });
  const hp = rendu.files[0].data;
  assert.ok(/Votre site : 99(\s| )€/.test(hp) && /data-prix="99"/.test(hp) && /data-ap-editer/.test(hp) && /Modifier moi-même, sur la page/.test(hp) && /data-ap-outils/.test(hp) && /data-ap-pan="edition"/.test(hp), 'la barre à 99 €, « Modifier moi-même » et sa barre d\'outils');
  assert.ok(/ap-offres un/.test(hp) && !/data-ap-offre="mensuel"/.test(hp) && !/par mois/.test(hp) && /studionovalem\.fr/.test(hp) && /Je le prends, 99/.test(hp), 'une seule offre, rien au mois, Studio Novalem, « Je le prends, 99 € » après une modification');
  assert.doesNotThrow(function () { new Function('w', 'd', 'b', 'calme', PN.SCRIPT); }, 'le script du panneau se lit');
  assert.ok(/plaintext-only/.test(PN.SCRIPT) && /action:'edition'/.test(PN.SCRIPT) && /Changer la photo/.test(PN.SCRIPT) && /beforeunload/.test(PN.SCRIPT) && /offres\.length===1/.test(PN.SCRIPT), 'édition sur la page, photos, enregistrement, alerte avant de quitter, offre unique déjà choisie');
  assert.ok(PN.SCRIPT.indexOf("replace(/\\s+/g,' ')") >= 0 && PN.SCRIPT.indexOf('[^\\s@]+@') >= 0, 'les expressions du script gardent leurs \\s (le gabarit les mange s\'ils ne sont pas doublés)');
  console.log('Panneau OK : 99 €, Modifier moi-même, une seule offre déjà choisie, Studio Novalem, script lisible');

  // 10. les conditions de vente : une seule offre, l'IA dite, rien au mois, rien d'indéfini
  const cg = P.cgv({ entreprise: 'NOVALEM', forme: 'EI', siret: '103 405 247 00018', email: 'louis@novalemo.fr' });
  assert.ok(/99 € en une fois/.test(cg) && /intelligence artificielle/.test(cg) && /25 € par an/.test(cg) && /Studio Novalem/.test(cg) && !/undefined|NaN|mensualit|par mois|Vitrine|Signature/.test(cg), 'conditions de vente à une seule offre');
  assert.ok(P.MOTEUR !== 'v3-templates-panneau', 'nouveau moteur : tous les aperçus republiés avec le nouveau panneau');
  console.log('Conditions de vente OK : 99 € en une fois, IA dite, aucune mensualité');

  // 11. l'outil de commande d'Emma : une formule, une façon de payer ; la Vitrine renvoie vers Studio Novalem
  const T = require('../lib/tools');
  assert.deepStrictEqual(T.DEFS.commande.input_schema.properties.formule.enum, ['essentiel'], 'Emma ne commande que l\'essentiel');
  assert.deepStrictEqual(T.DEFS.commande.input_schema.properties.paiement.enum, ['une_fois'], 'en une fois seulement');
  assert.ok(/99 €/.test(T.DEFS.commande.description) && /Studio Novalem/.test(T.DEFS.commande.description), 'la description dit 99 € et Studio Novalem');
  console.log('Outil de commande OK : une formule, en une fois, Studio Novalem au-delà');

  // 12. la migration 20 sur une base comme celle de Louis le 12 nov. : l'ancien message en file tombe (le prospect revient
  // à contacter), l'envoi coupé ce jour-là reprend, le message de Louis devient la variante mesurée, Louis est prévenu
  db = base();
  await RT.semer(db);
  db.tables.hq_config.find(function (x) { return x.key === 'seed'; }).value.version = 19;
  db.tables.hq_config.find(function (x) { return x.key === 'budget'; }).value = Object.assign({}, config.BUDGET_DEFAUT, { envoi_auto: false });
  const BX = require('../lib/jobs/boite');
  await BX.ecrireEtat(db, { debut: il(8), pause: true, pause_auto: false, raison: 'Coupé par Claude le 12 nov. : les emails partaient avec l\'ancien message.' });
  const lm = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:m20', source: 'maps', name: 'Mig 20', island: 'MQ', email: 'm@mig20-mq.fr', email_source: 'site', status: 'brouillon', score: 70 }))[0];
  const rate = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:m20r', source: 'maps', name: 'Raté 12 nov', island: 'MQ', status: 'a_contacter', apercu_etat: 'echec', score: 70 }))[0];
  await db.insert('hq_outbox', [{ lead_id: lm.id, to_email: lm.email, subject: 'Votre site', body: 'Votre site actuel ne s\'affiche pas... 490 €', step: 1, status: 'pret', kind: 'prospection' }, { lead_id: lm.id, to_email: lm.email, subject: 'Re: Votre site', body: 'relance 490 €', step: 2, status: 'a_valider', kind: 'relance' }], { returning: false });
  const sm = await RT.semer(db);
  assert.ok(sm.seme, 'la migration passe');
  assert.ok(db.tables.hq_outbox.filter(function (o) { return o.lead_id === lm.id; }).every(function (o) { return o.status === 'annule' && /message de Louis à 99/.test(o.error || ''); }) && db.tables.hq_leads.find(function (l) { return l.id === lm.id; }).status === 'a_contacter', 'l\'ancien message en file tombe, le prospect revient à contacter');
  assert.ok(db.tables.hq_leads.find(function (l) { return l.id === rate.id; }).apercu_etat === null, 'un aperçu raté le 12 nov. (compte Anthropic bloqué) repart dans la file de Noé');
  const bt = await BX.lireEtat(db);
  assert.ok(!bt.pause && bt.reprise_at && db.tables.hq_config.find(function (x) { return x.key === 'budget'; }).value.envoi_auto === true, 'l\'envoi coupé le 12 nov. reprend, pilote automatique compris');
  const ec = await require('../lib/ecriture').lire(db);
  assert.deepStrictEqual(require('../lib/ecriture').actives(ec).map(function (v) { return v.id; }), ['L'], 'le message de Louis est la seule variante mesurée');
  assert.ok((db.tables.hq_messages || []).some(function (m) { return m.to_id === 'louis' && m.subject === 'Ton message, à 99 €'; }), 'Louis est prévenu');
  assert.ok(['redacteur', 'relanceur'].every(function (id) { const a = db.tables.hq_agents.find(function (x) { return x.id === id; }); return a && a.kind === 'job' && Date.parse(a.next_run_at) <= Date.now() + 5 * 60000; }), 'Chloé et Yanis passent en automatique et repartent tout de suite');
  // une pause posée pour une autre raison (de vrais rebonds) reste
  db = base();
  await RT.semer(db);
  db.tables.hq_config.find(function (x) { return x.key === 'seed'; }).value.version = 19;
  await BX.ecrireEtat(db, { debut: il(8), pause: true, pause_auto: true, raison: '4 rebonds définitifs sur 15 envois (27 %)' });
  await RT.semer(db);
  assert.ok((await BX.lireEtat(db)).pause, 'une pause pour de vrais rebonds reste');
  console.log('Migration 20 OK : ancien message annulé et réécrit, envoi relancé, message de Louis mesuré, Louis prévenu, vraie pause gardée');

  // 13. le compte Anthropic à sa limite de dépense : retenu (un essai toutes les 30 minutes au plus), Emma ne s'use plus,
  // Louis prévenu une fois avec ce qui marche encore ; une réponse de prospect lui arrive en « À toi de répondre » ; le
  // compte relevé, tout repart et Louis le sait
  db = base();
  await RT.semer(db);
  const claudeM = require('../lib/claude');
  fakes.CLAUDE.limiteCompte = true;
  const ap0 = fakes.appels();
  let refus = null;
  try { await claudeM.converse({ tier: 'smart', system: 'test', messages: [{ role: 'user', content: 'Bonjour' }], maxSteps: 1, maxTokens: 100 }); } catch (e) { refus = e; }
  assert.ok(refus && refus.budget && refus.compte && fakes.appels() === ap0 + 1, 'refus du compte : une erreur de budget, sans trois essais : ' + (refus && refus.message));
  const blq = db.tables.hq_config.find(function (x) { return x.key === 'claude:bloque'; });
  assert.ok(blq && blq.value.jusqua === '2026-12-01T00:00:00Z' && /usage limits/.test(blq.value.message), 'le blocage est retenu, avec sa date : ' + JSON.stringify(blq && blq.value));
  let refus2 = null;
  try { await claudeM.converse({ tier: 'fast', system: 'test', messages: [{ role: 'user', content: 'Encore' }], maxSteps: 1, maxTokens: 100 }); } catch (e) { refus2 = e; }
  assert.ok(refus2 && refus2.compte && fakes.appels() === ap0 + 1, 'dans la demi-heure : refusé par la garde, sans appeler l\'API');
  // Emma a une réponse à traiter : son passage s'arrête proprement, elle repasse dans une demi-heure, Louis prévenu une fois
  await db.insert('hq_inbox', { message_id: '<blq@test.mq>', from_email: 'patron@blq-mq.fr', subject: 'Re: votre site', body: 'Combien ?', kind: 'reponse', status: 'nouveau', received_at: new Date().toISOString() }, { returning: false });
  db.tables.hq_agents.forEach(function (a) { a.next_run_at = a.id === 'reponses' ? new Date(Date.now() - 60000).toISOString() : new Date(Date.now() + 86400000).toISOString(); });
  const cB = await RT.cycle({ db: db, agentId: 'reponses', secondes: 120 });
  const pE = cB.passages.find(function (x) { return x.id === 'reponses'; });
  const emma = db.tables.hq_agents.find(function (a) { return a.id === 'reponses'; });
  assert.ok(pE && /limite de dépense/.test(pE.resume) && Date.parse(emma.next_run_at) - Date.now() < 45 * 60000 && Date.parse(emma.next_run_at) - Date.now() > 25 * 60000, 'Emma repasse dans une demi-heure : ' + (pE && pE.resume) + ' ' + emma.next_run_at);
  emma.next_run_at = new Date(Date.now() - 60000).toISOString();
  await RT.cycle({ db: db, agentId: 'reponses', secondes: 120 });
  const alertesB = (db.tables.hq_messages || []).filter(function (m) { return m.to_id === 'louis' && /limite de dépense du compte Anthropic/.test(m.subject || ''); });
  assert.ok(alertesB.length === 1 && /réponds-lui toi-même/.test(alertesB[0].body) && /ton message/.test(alertesB[0].body), 'Louis prévenu une seule fois, avec ce qui marche et quoi faire : ' + alertesB.length);
  // une réponse arrive pendant le blocage : « À toi de répondre »
  const BXb = require('../lib/jobs/boite'), mailB = require('../lib/mail');
  const lB = (await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'test:blq', source: 'maps', name: 'Bloqué SARL', island: 'MQ', email: 'patron@bloque-mq.fr', email_source: 'site', status: 'contacte', score: 70 }))[0];
  const oB = (await db.insert('hq_outbox', { lead_id: lB.id, to_email: lB.email, subject: 'Un site pour Bloqué SARL', body: 'x', step: 1, status: 'envoye', kind: 'prospection', sent_at: il(1), message_id: '<hq.' + lB.id + '.blq@novalemo.fr>' }))[0];
  mailB.forcer({ relever: async function (etat, garder) { const m = { uid: 900, messageId: '<rep-blq@client.mq>', inReplyTo: oB.message_id, from: lB.email, fromName: 'Patron', subject: 'Re: ' + oB.subject, headers: 'In-Reply-To: ' + oB.message_id + '\r\n', date: new Date(), source: Buffer.from('From: Patron <' + lB.email + '>\r\nSubject: Re: ' + oB.subject + '\r\nMessage-ID: <rep-blq@client.mq>\r\nIn-Reply-To: ' + oB.message_id + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nBonjour, il me plaît, comment on fait ?\r\n') }; return { etat: { uidValidity: '7', dernier: 900 }, messages: (await garder(m)) ? [m] : [], vus: 1 }; } });
  await BXb.releve({ db: db });
  const aToi = (db.tables.hq_messages || []).find(function (m) { return m.to_id === 'louis' && /^À toi de répondre : Réponse de Bloqué SARL/.test(m.subject || ''); });
  assert.ok(aToi && aToi.kind === 'alerte' && /Emma ne peut pas répondre/.test(aToi.body) && /il me plaît/.test(aToi.body), 'la réponse arrive chez Louis en alerte, à lui de répondre : ' + JSON.stringify(aToi && { s: aToi.subject, k: aToi.kind }));
  // le compte relevé : l'appel d'essai passe, le blocage tombe, Louis le sait
  fakes.CLAUDE.limiteCompte = false;
  blq.value.essai_le = new Date(Date.now() - 31 * 60000).toISOString();
  garde.oublier();
  const okC = await claudeM.converse({ tier: 'fast', system: 'test', messages: [{ role: 'user', content: 'Bonjour' }], maxSteps: 1, maxTokens: 100 });
  assert.ok(okC && !db.tables.hq_config.some(function (x) { return x.key === 'claude:bloque'; }) && (db.tables.hq_messages || []).some(function (m) { return m.to_id === 'louis' && m.subject === 'Claude répond de nouveau'; }), 'compte relevé : l\'essai passe, le blocage tombe, Louis prévenu');
  console.log('Compte Anthropic bloqué OK : retenu, un essai par demi-heure, Emma en attente, Louis prévenu une fois, réponses à lui, reprise vue toute seule');

  console.log('Offre OK. Tout est vert en', ((Date.now() - t0) / 1000).toFixed(1), 's');
})().catch(function (e) { console.error('ÉCHEC :', e); process.exit(1); });
