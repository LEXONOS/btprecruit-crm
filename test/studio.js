// Le Studio 3D sans réseau : une vidéo traverse toute la chaîne (la salle d'écriture : Gaspard, Sacha, Clara, Félix,
// Hélène ; puis Oscar, l'usine, Vera, Romane et Nina, l'usine encore) avec Claude, GitHub et le stockage simulés.
// Lance : node test/studio.js
'use strict';
process.env.HQ_TOUR_PROJET = 'prj_tour'; process.env.HQ_TOUR_EQUIPE = 'team_test';
process.env.HQ_LOCAL = '1';
process.env.ANTHROPIC_API_KEY = 'test';
delete process.env.HQ_SUPABASE_KEY; delete process.env.HQ_GITHUB_TOKEN; delete process.env.HQ_USINE_SECRET;

const assert = require('assert');
const fakes = require('./fakes');
const DB = require('../lib/db');
const db = DB.memory();
DB.forcer(db);
const runtime = require('../lib/runtime');
const S = require('../lib/studio');
const G = require('../lib/studio/github');
const ST = require('../lib/studio/stockage');
const SC = require('../lib/studio/scene');
const F = require('../lib/studio/fabrication');
const usine = require('../api/usine');
const tools = require('../lib/tools');

// GitHub simulé : on garde les lancements et les secrets posés
const GH = { lances: [], secrets: {}, variables: {}, panne: false };
G.forcer(async function (url, o) {
  const m = (o && o.method) || 'GET';
  const rep = (code, d) => ({ ok: code < 300, status: code, text: async () => (d == null ? '' : JSON.stringify(d)) });
  if (GH.panne) return rep(500, { message: 'GitHub en panne' });
  if (/\/dispatches$/.test(url)) { GH.lances.push(JSON.parse(o.body).inputs); return rep(204); }
  if (/secrets\/public-key$/.test(url)) return rep(200, { key: Buffer.from(require('tweetnacl').box.keyPair().publicKey).toString('base64'), key_id: 'k1' });
  if (/secrets\/HQ_USINE_SECRET$/.test(url) && m === 'PUT') { GH.secrets.HQ_USINE_SECRET = JSON.parse(o.body); return rep(201, {}); }
  if (/variables\/HQ_TOUR$/.test(url) && m === 'PATCH') return rep(404, { message: 'Not Found' });
  if (/actions\/variables$/.test(url) && m === 'POST') { const b = JSON.parse(o.body); GH.variables[b.name] = b.value; return rep(201, {}); }
  if (/actions\/(workflows|variables)$/.test(url)) return rep(200, { workflows: [], variables: [] });
  if (/runs\?/.test(url)) return rep(200, { workflow_runs: [{ id: 1, display_title: 'Vidéo 1 (en)', status: 'completed', conclusion: 'success', created_at: new Date().toISOString(), html_url: 'https://github.com/x' }] });
  if (/\/repos\/[^/]+\/[^/]+$/.test(url)) return rep(200, { full_name: G.DEPOT });
  return rep(404, { message: 'Not Found' });
});
// stockage simulé
const STOCK = { envoyes: [], signes: 0 };
ST.forcer(async function (url, o) {
  const json = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d), arrayBuffer: async () => new ArrayBuffer(0) });
  if (/\/object\/upload\/sign\//.test(url)) { STOCK.envoyes.push(url.split('/object/upload/sign/studio/')[1]); return json({ url: '/object/upload/sign/studio/x?token=abc' }); }
  if (/\/object\/sign\/studio$/.test(url)) { STOCK.signes++; return json(JSON.parse(o.body).paths.map((p) => ({ path: p, signedURL: '/object/sign/studio/' + p + '?token=t' }))); }
  if (/\/object\/authenticated\//.test(url)) { const b = fakes.jpeg ? fakes.jpeg() : Buffer.from('ffd8ffe0', 'hex'); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; }
  return json({});
});

// l'usine appelle la tour : une fausse requête HTTP sur api/usine.js
async function appelUsine(methode, corps, secret) {
  const req = { method: methode, headers: { 'x-usine': secret === undefined ? process.env.HQ_USINE_SECRET : secret }, query: methode === 'GET' ? corps : undefined, body: methode === 'POST' ? corps : undefined, url: '/api/usine' };
  let code = 0, txt = '';
  const res = { setHeader() {}, end(t) { txt = t; }, set statusCode(c) { code = c; }, get statusCode() { return code; } };
  await usine(req, res);
  return { code, d: JSON.parse(txt || '{}') };
}
const C0 = () => ({ items: 0, leads: 0, emails: 0, messages: 0, places: 0 });

(async function () {
  await runtime.semer(db);
  const env = await runtime.charger(db);
  const agent = (id) => env.agents.find((a) => a.id === id);
  const lancer = async (id) => runtime.JOBS[agent(id).job].run({ db, agent: agent(id), agents: env.agents, budget: env.budget, compteurs: C0(), limite: Date.now() + 200000, peutDepenser: () => true });
  const video = async (id) => db.one('hq_videos', { eq: { id } });

  // 1. l'organigramme
  ['actu_studio', 'accrocheur', 'scenariste', 'prof_viral', 'verif_studio', 'animateur', 'monteur', 'critique_video', 'plume_fr', 'localisation'].forEach((id) => { assert.strictEqual(agent(id).kind, 'job', id + ' travaille seul'); assert.ok(runtime.JOBS[agent(id).job], id + ' : son travail existe'); });
  assert.strictEqual(agent('monteur').name, 'Elsa', 'la cheffe de fabrication ne porte plus le prénom du portfolio');
  assert.strictEqual(env.agents.filter((a) => a.company_id === 'studio3d').length, 18, 'dix-huit postes au Studio');
  ['publication', 'showrunner', 'brainrot'].forEach((id) => assert.strictEqual(agent(id).kind, 'attente', id + ' attend son branchement'));
  assert.ok(agent('dg_studio').tools.indexOf('regler_studio') >= 0, 'le DG règle le rythme');

  // 2. la scène de démonstration passe le contrôle, une scène fausse est refusée avec des raisons précises
  const ex = require('../usine/exemples/clim.json');
  assert.ok(SC.verifier(ex.scene, ex.script.beats.length).ok, 'la scène de la clim est valide');
  const fausse = JSON.parse(JSON.stringify(ex.scene)); fausse.plans[0].actions = []; fausse.objets[1].parent = 'nulle_part';
  const vf = SC.verifier(fausse, 11);
  assert.ok(!vf.ok && vf.erreurs.some((e) => /rien ne bouge/.test(e)) && vf.erreurs.some((e) => /parent/.test(e)), 'erreurs nommées : ' + vf.erreurs.join(' | '));

  // 3. Gaspard : la fiche d'actualité du jour, une seule fois par jour
  const ra = await lancer('actu_studio');
  assert.ok(ra.produit === 2, 'fiche faite pour la France et le monde anglophone : ' + ra.resume);
  const actu = (await db.one('hq_config', { eq: { key: 'studio_actu' } })).value;
  assert.ok(actu.langues.fr.length >= 4 && actu.langues.fr[0].exemple && actu.langues.fr[0].a_eviter, 'chaque sujet a sa situation, son exemple et ce qu\'il faut éviter');
  assert.ok(/déjà faite/.test((await lancer('actu_studio')).resume), 'pas deux fiches le même jour');

  // 4. Sacha : le sujet, la révélation et 8 accroches ; il garde la meilleure ; un sujet déjà fait n'est jamais refait
  const r1 = await lancer('accrocheur');
  assert.ok(r1.produit === 1, 'un sujet lancé : ' + r1.resume);
  let v = (await db.select('hq_videos', {}))[0];
  assert.strictEqual(v.status, 'accroche');
  assert.deepStrictEqual(v.langues, ['en', 'fr', 'es', 'pt', 'hi'], 'cinq langues par défaut');
  assert.ok(v.script.brief.accroches.length === 8 && v.script.brief.choix === 2 && v.script.brief.revelation, 'les accroches et la révélation sont gardées');
  assert.ok(/Grève des transports/.test(fakes.STUDIO.consignes.trouver_accroches), 'Sacha lit l\'actualité pour choisir un sujet de saison');
  await db.update('hq_videos', { dedupe: 'meca:clim-2' }, { eq: { id: v.id } });
  const r1b = await lancer('accrocheur');
  const v2b = (await db.select('hq_videos', { order: 'id.desc', limit: 1 }))[0];
  assert.ok(r1b.produit === 1 && v2b.dedupe === 'meca:clim-3', 'doublon refusé puis un autre sujet : ' + r1b.resume);
  await db.update('hq_videos', { status: 'refuse' }, { eq: { id: v2b.id } });
  assert.ok(/Quota du jour/.test((await lancer('accrocheur')).resume), 'deux sujets par jour, pas plus');

  // 5. Clara écrit le script ; un premier jet refusé par le contrôle est réécrit dans le même passage
  fakes.STUDIO.scriptsRates = 1;
  const r2s = await lancer('scenariste');
  v = await video(v.id);
  assert.strictEqual(v.status, 'relecture', 'script écrit : ' + r2s.resume);
  assert.strictEqual(fakes.STUDIO.appels.ecrire_script, 2, 'le jet trop court est refusé puis réécrit');
  assert.ok(v.script.beats.length === 16 && v.script.mots >= 150 && v.script.boucles.length >= 2 && v.script.brief, 'structure de rétention complète, le brief de Sacha gardé');
  assert.ok(/Your AC has never made \*a single degree\* of cold/.test(fakes.STUDIO.consignes.ecrire_script), 'Clara part de l\'accroche choisie par Sacha');

  // 6. Félix : trop faible, Clara réécrit avec ses corrections ; la règle qu'il a vue revenir est gardée pour l'équipe
  fakes.STUDIO.viral.push(6.5);
  const rf = await lancer('prof_viral');
  v = await video(v.id);
  assert.strictEqual(v.status, 'reecriture', 'sous le seuil : ' + rf.resume);
  assert.ok(db.tables.hq_knowledge.some((k) => k.agent_id === 'prof_viral' && /événement visuel/.test(k.content)), 'la leçon de Félix est gardée');
  await lancer('scenariste');
  v = await video(v.id);
  assert.ok(v.status === 'relecture' && v.script.versions === 2, 'version 2');
  assert.ok(/NOTE DE FÉLIX : 6\.5\/10/.test(fakes.STUDIO.consignes.ecrire_script) && /One fluid does \*all\* the work/.test(fakes.STUDIO.consignes.ecrire_script), 'Clara a reçu les corrections de Félix');
  assert.ok(/événement visuel/.test(fakes.STUDIO.systemes.ecrire_script), 'et la règle apprise par Félix');
  await lancer('prof_viral');
  v = await video(v.id);
  assert.strictEqual(v.status, 'verification', 'au-dessus du seuil : à la vérification');
  assert.strictEqual(v.script.note_viral, 9);

  // 7. Hélène vérifie les faits sur le web et corrige elle-même une approximation
  const rh = await lancer('verif_studio');
  v = await video(v.id);
  assert.strictEqual(v.status, 'script', 'faits vérifiés : ' + rh.resume);
  assert.ok(/about \*ten times\*/.test(v.script.beats[9].voix) && v.script.verif.faits.length === 2, 'la phrase 10 est nuancée');
  assert.ok(rh.cout > 0.01, 'la recherche web est comptée');
  // un mécanisme faux renvoie à Clara une fois, puis la vidéo sort
  const vf2 = (await db.insert('hq_videos', { ligne: 'meca', titre: 'Faux', status: 'verification', langue_source: 'en', langues: ['en'], script: JSON.parse(JSON.stringify(v.script)) }))[0];
  await db.update('hq_videos', { updated_at: new Date(Date.now() - 86400000).toISOString() }, { eq: { id: vf2.id } });
  fakes.STUDIO.verifs.push({ faits: [{ beat: 13, affirmation: 'boiling drinks heat', statut: 'faux', explication: 'test' }], corrections: [], verdict: 'a_reecrire', resume: 'Le mécanisme est faux.' });
  await lancer('verif_studio');
  assert.strictEqual((await video(vf2.id)).status, 'reecriture', 'un fait faux renvoie à Clara');
  await db.update('hq_videos', { status: 'refuse' }, { eq: { id: vf2.id } });

  // 8. Oscar : une première scène fausse est corrigée dans le même passage
  fakes.STUDIO.scenesRatees = 1;
  const r2 = await lancer('animateur');
  v = await video(v.id);
  assert.strictEqual(v.status, 'scene', 'scène montée après correction : ' + r2.resume);
  assert.strictEqual(fakes.STUDIO.appels.ecrire_scene, 2, 'deux appels : le jet refusé puis le bon');
  assert.strictEqual(v.scene.plans.length, v.script.beats.length, 'un plan par phrase');

  // 9. Elsa sans usine : elle attend, sans rien casser
  const r3 = await lancer('monteur');
  assert.ok(/pas encore branchée/.test(r3.resume));
  // l'usine branchée : la langue source part la première
  process.env.HQ_GITHUB_TOKEN = 'github_pat_' + 'x'.repeat(40);
  process.env.HQ_USINE_SECRET = 'a'.repeat(64);
  await lancer('monteur');
  v = await video(v.id);
  assert.strictEqual(v.status, 'essai');
  assert.deepStrictEqual(GH.lances.map((x) => x.langue), ['en'], 'seulement l\'anglais d\'abord');
  assert.ok(!('tour' in GH.lances[0]), 'l\'adresse de la tour ne passe jamais au lancement');

  // 10. la porte de l'usine
  assert.strictEqual((await appelUsine('GET', { op: 'commande', video: String(v.id), langue: 'en' }, 'faux')).code, 401, 'mauvais secret refusé');
  const cmd = await appelUsine('GET', { op: 'commande', video: String(v.id), langue: 'en' });
  assert.strictEqual(cmd.code, 200);
  assert.ok(cmd.d.production.scene.objets.length > 5 && cmd.d.voix.voix === 'af_heart', 'la commande porte la scène et la voix');
  assert.strictEqual((await appelUsine('GET', { op: 'commande', video: String(v.id), langue: 'fr' })).code, 409, 'rien à fabriquer en français pour l\'instant');
  const jeton = cmd.d.jeton;
  const fichiers = ['video.mp4', 'vignette.jpg', 'sous-titres.srt', 'cle-1.jpg', 'cle-2.jpg', 'cle-3.jpg'].map((n) => ({ nom: n, type: 'x', taille: 1000 }));
  const env1 = await appelUsine('POST', { op: 'televerser', video: v.id, langue: 'en', jeton, fichiers });
  assert.strictEqual(env1.code, 200);
  assert.ok(env1.d.urls['video.mp4'] && STOCK.envoyes.some((p) => p === 'videos/' + v.id + '/en/video.mp4'), 'lien d\'envoi signé, rangé au bon endroit');
  assert.strictEqual((await appelUsine('POST', { op: 'televerser', video: v.id, langue: 'en', jeton, fichiers: [{ nom: '../../evil.sh', taille: 1 }] })).code, 400, 'nom de fichier refusé');
  assert.strictEqual((await appelUsine('POST', { op: 'fini', video: v.id, langue: 'en', jeton: 'vieux', ok: true })).code, 409, 'un vieux jeton ne compte pas');
  const fin1 = await appelUsine('POST', { op: 'fini', video: v.id, langue: 'en', jeton, ok: true, duree: 62.3, taille: 25000000, fichiers: fichiers.map((f) => f.nom) });
  assert.strictEqual(fin1.d.statut, 'critique', 'la langue source rendue part chez Vera');

  // 11. Vera : scène à refaire d'abord, puis publication
  fakes.STUDIO.verdicts.push({ note: 5, verdict: 'refaire_scene' });
  await lancer('critique_video');
  v = await video(v.id);
  assert.strictEqual(v.status, 'script', 'retour chez Oscar');
  assert.strictEqual(v.essais, 1);
  assert.ok(!v.rendus.en, 'le rendu d\'essai sera refait');
  assert.ok(fakes.STUDIO.images >= 3, 'Vera a regardé les images');
  assert.ok(/\[relance\]/.test(require('../lib/jobs/studio_critique').OUTIL ? fakes.STUDIO.consignes.juger_video : ''), 'Vera voit le rôle de chaque plan');
  await lancer('animateur');
  v = await video(v.id);
  assert.strictEqual(v.status, 'scene');
  await lancer('monteur');
  const c2 = await appelUsine('GET', { op: 'commande', video: String(v.id), langue: 'en' });
  await appelUsine('POST', { op: 'fini', video: v.id, langue: 'en', jeton: c2.d.jeton, ok: true, duree: 63, fichiers: fichiers.map((f) => f.nom) });
  await lancer('critique_video');
  v = await video(v.id);
  assert.strictEqual(v.status, 'traduction', 'validée : place aux langues');

  // 12. Nina adapte l'espagnol, le portugais et le hindi ; le français attend Romane
  await lancer('localisation');
  v = await video(v.id);
  assert.deepStrictEqual(Object.keys(v.traductions).sort(), ['es', 'hi', 'pt'], 'Nina laisse le français à Romane');
  assert.ok(v.traductions.es.beats[4].etiquettes[0].objet === 'compresseur', 'les étiquettes visent les mêmes pièces');
  assert.ok(/J'attends la version française/.test((await lancer('localisation')).resume));
  // Romane : une version sans humour est refusée et réécrite ; avec la fiche de Gaspard, puis tout part à l'usine
  fakes.STUDIO.plumeRatee = 1;
  const rr = await lancer('plume_fr');
  v = await video(v.id);
  assert.strictEqual(fakes.STUDIO.appels.ecrire_francais, 2, 'la version sans blague est réécrite');
  assert.ok(/RER un jour de grève/.test(fakes.STUDIO.systemes.ecrire_francais), 'Romane a la fiche d\'actualité');
  assert.ok(v.traductions.fr.blagues.length === 2 && /grève/.test(v.traductions.fr.beats[4].voix), 'la blague du jour : ' + rr.resume);
  assert.strictEqual(v.status, 'langues', 'toutes les langues écrites');
  // si Romane échoue deux fois, Nina reprend le français
  assert.deepStrictEqual(require('../lib/jobs/studio_langues').pourNina({ langue_source: 'en', langues: ['en', 'fr', 'es'], traductions: { es: {} }, critique: { plume_echecs: 2 } }), ['fr']);
  assert.deepStrictEqual(require('../lib/jobs/studio_langues').pourNina({ langue_source: 'en', langues: ['en', 'fr', 'es'], traductions: { es: {} }, critique: { le: new Date().toISOString() } }), []);

  // 13. l'usine rend les autres langues ; une langue sans nouvelles est relancée
  GH.lances = [];
  await lancer('monteur');
  assert.deepStrictEqual(GH.lances.map((x) => x.langue).sort(), ['es', 'fr', 'hi', 'pt']);
  v = await video(v.id);
  const r = Object.assign({}, v.rendus); r.hi = Object.assign({}, r.hi, { demande_le: new Date(Date.now() - 2 * 3600000).toISOString() });
  await db.update('hq_videos', { rendus: r }, { eq: { id: v.id } });
  GH.lances = [];
  await lancer('monteur');
  assert.deepStrictEqual(GH.lances.map((x) => x.langue), ['hi'], 'le hindi sans nouvelles est relancé');
  v = await video(v.id);
  for (const l of ['fr', 'es', 'pt', 'hi']) {
    const c = await appelUsine('GET', { op: 'commande', video: String(v.id), langue: l });
    assert.strictEqual(c.code, 200, 'commande ' + l);
    assert.ok(c.d.production.langues[l], 'la traduction voyage avec la commande');
    await appelUsine('POST', { op: 'fini', video: v.id, langue: l, jeton: c.d.jeton, ok: true, duree: 64, fichiers: ['video.mp4', 'vignette.jpg'] });
  }
  v = await video(v.id);
  assert.strictEqual(v.status, 'prete', 'la vidéo est prête dans les 5 langues');
  assert.ok(Number(v.cout_usd) > 0, 'le coût de l\'IA est suivi');

  // 14. un échec répété de la langue source arrête la vidéo et prévient le DG
  const v2 = (await db.insert('hq_videos', { ligne: 'meca', titre: 'Essai panne', status: 'scene', langue_source: 'en', langues: ['en'], script: ex.script, scene: ex.scene }))[0];
  await lancer('monteur');
  for (let k = 0; k < 2; k++) {
    const c = await appelUsine('GET', { op: 'commande', video: String(v2.id), langue: 'en' });
    await appelUsine('POST', { op: 'fini', video: v2.id, langue: 'en', jeton: c.d.jeton, ok: false, erreur: 'Chrome a planté' });
    await lancer('monteur');
  }
  assert.strictEqual((await video(v2.id)).status, 'echec');
  assert.ok(db.tables.hq_messages.some((m) => m.to_id === 'dg_studio' && /Chrome a planté/.test(m.body)), 'le DG est prévenu avec la raison');

  // 15. ce que voit Louis, et ce qu'il peut faire
  const vue = await require('../lib/studio/vue').liste(db, {});
  const pv = vue.videos.find((x) => x.id === v.id);
  assert.strictEqual(pv.rendus.filter((x) => x.video).length, 5, 'un lecteur par langue');
  assert.ok(vue.usine.branchee && vue.usine.fabrications.length === 1);
  assert.ok(pv.ecriture.accroche.nombre === 8 && pv.ecriture.viral.note === 9 && pv.ecriture.verif.corriges === 1 && pv.ecriture.blagues.length === 2, 'Louis voit le travail de la salle d\'écriture');
  assert.ok((await require('../lib/studio/vue').liste(db, { statut: 'ecriture' })).videos.every((x) => S.ECRITURE.indexOf(x.statut) >= 0), 'le filtre « en écriture »');
  await require('../lib/actions').agir('studio_video', { id: v2.id, faire: 'relancer' });
  assert.strictEqual((await video(v2.id)).status, 'scene', 'Louis relance une vidéo en échec');
  await require('../lib/actions').agir('studio_regler', { ligne: 'meca', videos_jour: 4, langues: ['fr', 'es'] });
  const rg = (await S.reglages(db)).meca;
  assert.strictEqual(rg.videos_jour, 4);
  assert.deepStrictEqual(rg.langues, ['en', 'fr', 'es'], 'l\'anglais reste la langue source');

  // 16. les outils du DG
  const ex2 = tools.executeurs({ db, agent: agent('dg_studio'), agents: env.agents, budget: env.budget, compteurs: C0() });
  const lv = await ex2.lister_videos({});
  assert.ok(lv.comptes.prete === 1 && lv.videos.length >= 2);
  const ex3 = tools.executeurs({ db, agent: agent('tendances'), agents: env.agents, budget: env.budget, compteurs: C0() });
  assert.ok((await ex3.regler_studio({ ligne: 'meca', videos_jour: 9, raison: 'x' })).erreur, 'seul le DG règle le rythme');

  // 17. la mise en route : le jeton GitHub pose le secret de l'usine et l'adresse de la tour
  assert.ok((await G.verifier('pas-un-jeton')).erreur);
  assert.ok((await G.verifier(process.env.HQ_GITHUB_TOKEN)).ok);
  await G.poserSecret(process.env.HQ_GITHUB_TOKEN, 'HQ_USINE_SECRET', 'b'.repeat(64));
  await G.poserVariable(process.env.HQ_GITHUB_TOKEN, 'HQ_TOUR', S.adresseTour());
  assert.ok(GH.secrets.HQ_USINE_SECRET.encrypted_value && GH.secrets.HQ_USINE_SECRET.key_id === 'k1', 'secret chiffré pour GitHub');
  assert.strictEqual(GH.variables.HQ_TOUR, 'https://novalem-crm.vercel.app');
  const mi = await require('../lib/missions').etat(db);
  const ms = mi.missions.find((m) => m.id === 'studio');
  assert.ok(ms && ms.etapes.every((e) => e.fait), 'mission Studio terminée : ' + JSON.stringify(ms && ms.etapes.map((e) => e.id + ':' + e.fait)));

  console.log('Studio : tout passe (' + Object.keys(fakes.STUDIO.appels).map((k) => k + ' x' + fakes.STUDIO.appels[k]).join(', ') + ').');
})().catch((e) => { console.error(e); process.exit(1); });
