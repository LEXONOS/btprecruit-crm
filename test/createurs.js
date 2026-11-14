// Le studio des créatrices sans réseau : Louis crée un compte, la créatrice ouvre son lien, règle sa chaîne, branche sa
// clé Claude, lance une vidéo ; son équipe l'écrit, la note, la fait réécrire, l'adapte en anglais ; Lou choisit les
// images ; l'usine monte les deux langues ; Sacha publie par upload-post. Puis : le budget du jour, une clé refusée, le
// pilote automatique, le ménage des vieux fichiers, et les portes (une autre créatrice, une autre origine, les essais).
// Claude, Pexels, GitHub, le stockage et upload-post sont simulés.
// Lance : node test/createurs.js
'use strict';
process.env.HQ_LOCAL = '1';
process.env.CRON_SECRET = 'cron-secret-de-test-assez-long-pour-servir-de-cle-0123456789';
process.env.HQ_GITHUB_TOKEN = 'github_pat_test0123456789abcdefghij';
process.env.HQ_USINE_SECRET = 'usine-secret-de-test-0123456789abcdef0123456789';
process.env.HQ_PEXELS_KEY = 'pexels-test';
delete process.env.HQ_SUPABASE_KEY; delete process.env.HQ_STUDIO_CLE;

const assert = require('assert');
const DB = require('../lib/db');
const db = DB.memory();
DB.forcer(db);
const A = require('../lib/acces');
A.rythme(0);
const C = require('../lib/createurs');
const SEC = require('../lib/createurs/secret');
const CL = require('../lib/createurs/claude');
const IM = require('../lib/createurs/images');
const P = require('../lib/createurs/publication');
const E = require('../lib/createurs/equipe');
const CH = require('../lib/createurs/chaine');
const ADM = require('../lib/createurs/admin');
const G = require('../lib/studio/github');
const ST = require('../lib/studio/stockage');
const studio = require('../api/studio');
const usine = require('../api/usine');
const M = require('../usine/montage');
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* ── Claude simulé ── */
const CLAUDE = { appels: [], refusee: false, sansCredit: false, notes: [6.2, 8.6], cles: [] };
let nTool = 0;
const repJson = (code, d) => ({ ok: code < 300, status: code, json: async () => d, text: async () => JSON.stringify(d) });
function scriptFaux(beatsN, avecImages, version) {
  return {
    titre: 'Pourquoi le ciel est bleu' + (version > 1 ? ' (v' + version + ')' : ''), accroche: 'Le ciel n\'est *pas* bleu',
    beats: Array.from({ length: beatsN }, (_, i) => Object.assign({ voix: (i === 0 ? 'Le ciel n\'est pas *vraiment* bleu.' : 'Phrase numéro ' + (i + 1) + ' qui explique une chose simple et vraie.'), ecran: 'Écran ' + (i + 1) }, avecImages ? { visuel: { requete: i === 3 ? 'introuvable chose' : 'blue sky clouds', description: 'Un ciel bleu' } } : {})),
    description: 'Tu savais ? Dis-moi en commentaire.', hashtags: ['#science', 'ciel', 'le ciel'], titre_youtube: 'Le ciel n\'est pas bleu #shorts', image_generale: 'sky timelapse'
  };
}
CL.forcer(async (url, o) => {
  if (/\/models/.test(url)) return CLAUDE.refusee ? repJson(401, { error: { message: 'invalid x-api-key' } }) : repJson(200, { data: [] });
  const body = JSON.parse(o.body);
  CLAUDE.cles.push(o.headers['x-api-key']);
  if (CLAUDE.refusee) return repJson(401, { error: { message: 'invalid x-api-key' } });
  if (CLAUDE.sansCredit) return repJson(400, { error: { message: 'Your credit balance is too low to access the Anthropic API.' } });
  if (body.max_tokens === 1) return repJson(200, { content: [{ type: 'text', text: 'o' }], usage: { input_tokens: 8, output_tokens: 1 } });
  const outil = body.tools[0].name;
  const prompt = typeof body.messages[0].content === 'string' ? body.messages[0].content : JSON.stringify(body.messages[0].content);
  CLAUDE.appels.push({ outil, model: body.model, max_tokens: body.max_tokens, prompt });
  let input;
  if (outil === 'proposer_idees') input = { idees: [1, 2, 3, 4, 5].map((i) => ({ titre: 'Idée ' + i + ' sur le ciel', accroche: 'Accroche ' + i, angle: 'Angle ' + i, pourquoi: 'Parce que ' + i })) };
  else if (outil === 'ecrire_script') input = scriptFaux(9, !!body.tools[0].input_schema.properties.beats.items.properties.visuel, CLAUDE.appels.filter((x) => x.outil === 'ecrire_script').length);
  else if (outil === 'noter_script') { const n = CLAUDE.notes.length > 1 ? CLAUDE.notes.shift() : CLAUDE.notes[0]; input = { notes: { accroche: n, promesse: n, rythme: n, boucles: n, gain: n, fin: n, clarte: n, ton: n, images: n }, points_forts: ['L\'accroche'], corrections: n < 7.5 ? ['Phrase 2 : plus court'] : [], verdict: 'Note ' + n }; }
  else if (outil === 'adapter_script') { const src = JSON.parse(prompt.split('L\'ORIGINALE :\n')[1].split('\n\nAppelle')[0]); input = { titre: 'Why the sky is blue', accroche: 'The sky is *not* blue', beats: src.beats.map((b, i) => ({ voix: 'English sentence ' + (i + 1) + ' that says the same thing.', ecran: 'Screen ' + (i + 1) })), description: 'Did you know?', hashtags: ['science'], titre_youtube: 'The sky is not blue' }; }
  nTool++;
  return repJson(200, { model: body.model, content: [{ type: 'tool_use', id: 'tu_' + nTool, name: outil, input }], stop_reason: 'tool_use', usage: { input_tokens: 4000, output_tokens: 1500 } });
});

/* ── Pexels simulé : des vidéos verticales, sauf pour une recherche introuvable ── */
const PEXELS = { recherches: [] };
IM.forcer(async (url) => {
  const q = decodeURIComponent((url.match(/query=([^&]+)/) || [])[1] || '');
  PEXELS.recherches.push(q);
  if (/introuvable/.test(q)) return repJson(200, { videos: [] });
  const base = PEXELS.recherches.length * 10;
  return repJson(200, { videos: [1, 2, 3].map((k) => ({ id: base + k, width: 1080, height: 1920, duration: 12, url: 'https://www.pexels.com/video/' + (base + k), image: 'https://images.pexels.com/x.jpg', user: { name: 'Auteur ' + k }, video_files: [{ quality: 'hd', file_type: 'video/mp4', width: 1080, height: 1920, link: 'https://videos.pexels.com/video-files/' + (base + k) + '/hd_1080_1920.mp4' }, { quality: 'uhd', file_type: 'video/mp4', width: 2160, height: 3840, link: 'https://videos.pexels.com/video-files/' + (base + k) + '/uhd.mp4' }] })) });
});

/* ── GitHub simulé : on garde les lancements de montage ── */
const GH = { montages: [] };
G.forcer(async (url, o) => {
  if (/montage\.yml\/dispatches$/.test(url)) { GH.montages.push(JSON.parse(o.body).inputs); return { ok: true, status: 204, text: async () => '' }; }
  return { ok: false, status: 404, text: async () => JSON.stringify({ message: 'Not Found' }) };
});

/* ── le stockage simulé ── */
const STOCK = { envoyes: [], effaces: [] };
ST.forcer(async (url, o) => {
  const json = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  if (/\/object\/upload\/sign\//.test(url)) { STOCK.envoyes.push(url.split('/object/upload/sign/studio/')[1]); return json({ url: '/object/upload/sign/studio/x?token=abc' }); }
  if (/\/object\/sign\/studio$/.test(url)) return json(JSON.parse(o.body).paths.map((p) => ({ path: p, signedURL: '/object/sign/studio/' + p + '?token=t' })));
  if (/\/object\/sign\/studio\//.test(url)) return json({ signedURL: '/object/sign/studio/' + url.split('/object/sign/studio/')[1] + '?token=t' });
  if (/\/object\/studio$/.test(url) && o.method === 'DELETE') { STOCK.effaces.push.apply(STOCK.effaces, JSON.parse(o.body).prefixes); return json([]); }
  return json({});
});

/* ── upload-post simulé ── */
const UP = { envois: [], suivis: 0 };
P.forcer(async (url, o) => {
  const t = (code, d) => ({ ok: code < 300, status: code, text: async () => JSON.stringify(d) });
  if (/\/uploadposts\/users\/generate-jwt$/.test(url)) return t(200, { success: true, access_url: 'https://app.upload-post.com/connect?jwt=abc', duration: '48h' });
  if (/\/uploadposts\/users$/.test(url) && o.method === 'GET') return o.headers.Authorization === 'Apikey up-mauvaise-cle-0123456789' ? t(401, { message: 'Invalid API key' }) : t(200, { success: true, plan: 'free', limit: 2, profiles: [{ username: 'studio', display_name: 'Studio', social_accounts: { tiktok: '', youtube: { display_name: 'Ma chaîne', handle: '@machaine' }, instagram: null } }] });
  if (/\/uploadposts\/users$/.test(url) && o.method === 'POST') return t(201, { success: true });
  if (/\/upload$/.test(url)) { const f = o.body; UP.envois.push({ user: f.get('user'), plateformes: f.getAll('platform[]'), video: f.get('video'), titre: f.get('title'), yt: f.get('youtube_title'), confidentialite: f.get('privacyStatus'), requete: f.get('request_id') }); return t(200, { success: true, request_id: f.get('request_id') }); }
  if (/\/uploadposts\/status/.test(url)) { UP.suivis++; return t(200, UP.suivis < 2 ? { status: 'in_progress', results: [] } : { status: 'completed', completed: 1, total: 1, results: [{ platform: 'youtube', success: true, message: 'Published', post_url: 'https://youtube.com/shorts/abc' }] }); }
  return t(404, { message: 'inconnu' });
});

/* ── de fausses requêtes HTTP ── */
let COOKIE = null;
async function api(methode, corps, opts) {
  opts = opts || {};
  const headers = { host: 'tour.test', 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1', 'x-real-ip': opts.ip || '81.1.2.3' };
  if (methode === 'POST') { headers.origin = opts.origine || 'https://tour.test'; headers['content-type'] = 'application/json'; }
  const ck = opts.cookie !== undefined ? opts.cookie : COOKIE;
  if (ck) headers.cookie = 'autre=1; __Host-studio=' + ck;
  if (opts.auth) headers.authorization = opts.auth;
  const req = { method: methode, headers, query: methode === 'GET' ? corps : undefined, body: methode === 'POST' ? corps : undefined, url: '/api/studio' };
  let code = 0, txt = '', cookies = [];
  const res = { setHeader(k, v) { if (k === 'Set-Cookie') cookies = [].concat(v); }, getHeader(k) { return k === 'Set-Cookie' ? cookies : undefined; }, end(t) { txt = t; }, set statusCode(c) { code = c; }, get statusCode() { return code; } };
  await studio(req, res);
  const c = cookies.map((x) => /^__Host-studio=([^;]*)/.exec(x)).filter(Boolean).pop();
  if (c && opts.garder !== false) COOKIE = c[1] || null;
  return { code, d: JSON.parse(txt || '{}'), cookie: c ? c[1] : undefined, cookies };
}
async function appelUsine(methode, corps) {
  const req = { method: methode, headers: { 'x-usine': process.env.HQ_USINE_SECRET }, query: methode === 'GET' ? corps : undefined, body: methode === 'POST' ? corps : undefined, url: '/api/usine' };
  let code = 0, txt = '';
  const res = { setHeader() {}, end(t) { txt = t; }, set statusCode(c) { code = c; }, get statusCode() { return code; } };
  await usine(req, res);
  return { code, d: JSON.parse(txt || '{}') };
}
// fait avancer une vidéo jusqu'à un statut (ou s'arrête au bout de n étapes)
async function jusqua(id, statuts, n) {
  let v;
  for (let i = 0; i < (n || 12); i++) {
    const r = await api('POST', { op: 'avancer', id });
    assert.strictEqual(r.code, 200, 'avancer répond : ' + JSON.stringify(r.d));
    v = r.d.video;
    if ([].concat(statuts).indexOf(v.status) >= 0) return v;
  }
  return v;
}

(async function () {
  // 1. le coffre : une clé chiffrée se relit, liée à son compte ; un autre secret ne la relit pas
  const b = SEC.chiffrer('sk-ant-api03-secret', 'claude:1');
  assert.ok(!JSON.stringify(b).includes('secret'), 'la clé n\'apparaît pas en clair');
  assert.strictEqual(SEC.dechiffrer(b, 'claude:1'), 'sk-ant-api03-secret', 'la clé se relit');
  assert.strictEqual(SEC.dechiffrer(b, 'claude:2'), null, 'pas sur un autre compte');
  assert.strictEqual(SEC.dechiffrer(Object.assign({}, b, { ct: Buffer.from('autre chose').toString('base64') }), 'claude:1'), null, 'une clé modifiée ne se relit pas');
  const avant = process.env.CRON_SECRET; process.env.CRON_SECRET = 'un-autre-secret-de-cron-tout-aussi-long-que-le-premier';
  assert.strictEqual(SEC.dechiffrer(b, 'claude:1'), null, 'un autre secret : la clé est à recoller');
  assert.strictEqual(SEC.lisible(b), false);
  process.env.CRON_SECRET = avant;

  // 2. les réglages passent au tamis
  const r0 = C.nettoyerReglages({ budget_jour: 999, langues: ['en', 'zz', 'en'], langue_source: 'es', chaine: { sujets: '<script>x</script>beauté' }, voix: { en: 'bf_emma', fr: 'pas-une-voix' }, pilote: { videos_jour: 50, heure: -3 }, publication: { en: { profil: 'studio', plateformes: ['tiktok', 'myspace'] }, fr: { profil: 'x y', plateformes: ['youtube'] } }, fuseau: 'Mars/Olympus' });
  assert.strictEqual(r0.budget_jour, 20, 'budget plafonné à 20 $ par jour');
  assert.deepStrictEqual(r0.langues, ['es', 'en'], 'langues connues, sans doublon, la principale en tête');
  assert.ok(!/script/.test(r0.chaine.sujets), 'pas de balise');
  assert.strictEqual(r0.voix.en, 'bf_emma'); assert.ok(!r0.voix.fr, 'une voix inconnue est ignorée');
  assert.strictEqual(C.voixDe(r0, 'en').kokoro, 'en-gb', 'voix britannique, anglais britannique');
  assert.deepStrictEqual([r0.pilote.videos_jour, r0.pilote.heure], [5, 0], 'pilote borné');
  assert.deepStrictEqual(r0.publication.en, { profil: 'studio', plateformes: ['tiktok'] }, 'plateformes connues seulement');
  assert.deepStrictEqual(r0.publication.fr, { profil: '', plateformes: [] }, 'un profil invalide ne publie nulle part');
  assert.strictEqual(r0.fuseau, 'Europe/Paris', 'un fuseau inconnu est ignoré');

  // 3. Louis crée le compte de Léa : un lien d'invitation, jamais gardé
  const cree = await ADM.agir(db, 'crea_creer', { prenom: 'Léa' });
  assert.strictEqual(cree.identifiant, 'lea', 'identifiant tiré du prénom, sans accent');
  assert.ok(/^[A-Za-z0-9_-]{30,}$/.test(cree.code), 'un code d\'invitation long');
  const lea0 = await db.one('hq_createurs', { eq: { identifiant: 'lea' } });
  assert.notStrictEqual(lea0.invitation, cree.code, 'seule son empreinte est gardée');
  assert.strictEqual((await ADM.agir(db, 'crea_creer', { prenom: 'Léa' })).identifiant, 'lea2', 'un second « Léa » a un identifiant libre');
  await ADM.agir(db, 'crea_supprimer', { id: (await db.one('hq_createurs', { eq: { identifiant: 'lea2' } })).id });

  // 4. elle ouvre son lien et choisit son mot de passe
  let r = await api('GET', { op: 'invitation', code: 'pas-le-bon-code-0123456789abcdef' });
  assert.strictEqual(r.code, 404, 'un faux lien ne mène nulle part');
  r = await api('GET', { op: 'invitation', code: cree.code });
  assert.strictEqual(r.code, 200); assert.strictEqual(r.d.prenom, 'Léa'); assert.strictEqual(r.d.nouveau, true);
  r = await api('POST', { op: 'invitation', code: cree.code, mdp: 'court' });
  assert.strictEqual(r.code, 400, 'mot de passe trop court refusé');
  r = await api('POST', { op: 'invitation', code: cree.code, mdp: 'mes vidéos du dimanche' });
  assert.strictEqual(r.code, 200, 'compte ouvert');
  assert.ok(COOKIE && r.cookies[0].includes('HttpOnly') && r.cookies[0].includes('Secure') && r.cookies[0].includes('SameSite=Lax'), 'session : cookie protégé');
  r = await api('POST', { op: 'invitation', code: cree.code, mdp: 'une autre phrase longue' }, { cookie: null, garder: false });
  assert.strictEqual(r.code, 404, 'le lien ne sert qu\'une fois');
  r = await api('GET', { op: 'etat' });
  assert.strictEqual(r.d.connecte, true); assert.strictEqual(r.d.moi.prenom, 'Léa');
  assert.ok(!JSON.stringify(r.d).includes('"mdp"') && !JSON.stringify(r.d).includes('invitation"'), 'ni mot de passe ni invitation dans la page');
  assert.strictEqual(r.d.catalogue.usine, true, 'l\'usine est branchée'); assert.strictEqual(r.d.catalogue.images, true);
  assert.strictEqual(r.d.moi.equipe.plume.prenom, 'Inès', 'son équipe par défaut');

  // 5. ses réglages, son équipe
  r = await api('POST', { op: 'reglages', reglages: { chaine: { nom: 'Le ciel et nous', sujets: 'La science du quotidien', public: '18-30 ans' }, langues: ['fr', 'en'], couleur: '#22d3ee', theme: { accent: '#ec4899', mode: 'clair' } } });
  assert.strictEqual(r.code, 200); assert.deepStrictEqual(r.d.moi.reglages.langues, ['fr', 'en']); assert.strictEqual(r.d.moi.reglages.couleur, '#22D3EE');
  r = await api('POST', { op: 'equipe', equipe: { plume: { prenom: 'Zoé', couleur: '#00ff88', consignes: 'Tutoie et sois drôle' }, inconnu: { prenom: 'X' } } });
  assert.strictEqual(r.d.moi.equipe.plume.prenom, 'Zoé'); assert.strictEqual(r.d.moi.equipe.plume.couleur, '#00FF88'); assert.ok(!r.d.moi.equipe.inconnu, 'un rôle inconnu est ignoré');

  // 6. sans clé, rien ne se paie ; avec une fausse clé, refus clair ; la vraie est rangée chiffrée
  r = await api('POST', { op: 'idees', theme: 'le ciel' });
  assert.strictEqual(r.code, 402, 'sans clé : refus'); assert.ok(/clé Claude/.test(r.d.erreur));
  r = await api('POST', { op: 'cle_claude', cle: 'sk-ant-admin01-abcdefghijklmnopqrstuvwxyz' });
  assert.strictEqual(r.code, 400); assert.ok(/administration/.test(r.d.erreur));
  r = await api('POST', { op: 'cle_claude', cle: 'bonjour' });
  assert.strictEqual(r.code, 400);
  CLAUDE.refusee = true;
  r = await api('POST', { op: 'cle_claude', cle: 'sk-ant-api03-cle-refusee-abcdefghijklmnop' });
  assert.strictEqual(r.code, 400); assert.ok(/reconnaît pas/.test(r.d.erreur));
  CLAUDE.refusee = false;
  r = await api('POST', { op: 'cle_claude', cle: 'sk-ant-api03-la-bonne-cle-de-lea-0123456789' });
  assert.strictEqual(r.code, 200); assert.strictEqual(r.d.moi.connexions.claude.branchee, true); assert.strictEqual(r.d.moi.connexions.claude.fin, '6789');
  let lea = await db.one('hq_createurs', { eq: { identifiant: 'lea' } });
  assert.ok(!JSON.stringify(lea.secrets).includes('la-bonne-cle'), 'la clé est chiffrée en base');

  // 7. Maya propose des idées, sur la clé de Léa
  r = await api('POST', { op: 'idees', theme: 'le ciel' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(r.d.idees.length, 5);
  assert.strictEqual(CLAUDE.cles[CLAUDE.cles.length - 1], 'sk-ant-api03-la-bonne-cle-de-lea-0123456789', 'appel fait avec SA clé');
  assert.strictEqual(r.d.moi.idees.length, 5);
  assert.ok(r.d.moi.depense.jour > 0, 'la dépense du jour est comptée');
  r = await api('POST', { op: 'idee_oublier', id: r.d.idees[4].id });
  assert.strictEqual(r.d.moi.idees.length, 4);

  // 8. une vidéo : écriture, note trop basse, réécriture, nouvelle note, relecture
  r = await api('POST', { op: 'creer', sujet: 'ab' });
  assert.strictEqual(r.code, 400, 'une idée trop courte');
  r = await api('POST', { op: 'creer', idee_id: (await db.one('hq_createurs', { eq: { identifiant: 'lea' } })).idees[0].id });
  assert.strictEqual(r.code, 200); const vid = r.d.video.id;
  assert.strictEqual(r.d.video.status, 'ecriture'); assert.deepStrictEqual(r.d.video.langues, ['fr', 'en']);
  assert.strictEqual((await db.one('hq_createurs', { eq: { identifiant: 'lea' } })).idees.length, 3, 'l\'idée choisie quitte la liste');
  let v = await jusqua(vid, 'relecture');
  assert.strictEqual(v.status, 'relecture', 'le script attend Léa');
  const ecritures = CLAUDE.appels.filter((x) => x.outil === 'ecrire_script').length, notes = CLAUDE.appels.filter((x) => x.outil === 'noter_script').length;
  assert.deepStrictEqual([ecritures, notes], [2, 2], 'écrit, noté 6,2, réécrit, noté 8,6');
  assert.strictEqual(v.critique.note, 8.6); assert.strictEqual(v.script.beats.length, 9);
  assert.deepStrictEqual(v.script.hashtags, ['science', 'ciel', 'leciel'], 'hashtags nettoyés');
  assert.ok(CLAUDE.appels.find((x) => x.outil === 'ecrire_script').model === 'claude-sonnet-5-5', 'qualité équilibrée : le modèle moyen écrit');
  assert.ok(CLAUDE.appels.find((x) => x.outil === 'noter_script').model === 'claude-haiku-5-5', 'le petit modèle note');
  assert.ok(v.cout_usd > 0, 'le coût de la vidéo est suivi');

  // 9. elle retouche une phrase et valide ; Nora écrit l'anglais ; Lou choisit les images et lance le montage
  const beats = v.script.beats.map((x, i) => (i === 1 ? Object.assign({}, x, { voix: 'Ma phrase à *moi*, bien plus courte.' }) : x));
  r = await api('POST', { op: 'modifier', id: vid, script: { titre: 'Mon titre', beats } });
  assert.strictEqual(r.code, 200); assert.strictEqual(r.d.video.script.beats[1].voix, 'Ma phrase à *moi*, bien plus courte.'); assert.strictEqual(r.d.video.titre, 'Mon titre');
  r = await api('POST', { op: 'valider', id: vid });
  assert.strictEqual(r.d.video.status, 'langues');
  v = await jusqua(vid, 'fabrication');
  assert.strictEqual(v.status, 'fabrication', 'montage lancé');
  assert.strictEqual(v.traductions.en.beats.length, 9, 'la version anglaise a toutes ses phrases');
  assert.strictEqual(v.plan.clips.length, 9); assert.strictEqual(v.plan.clips[3].requete, 'sky timelapse', 'une image introuvable : l\'image générale du sujet à la place');
  assert.ok(v.plan.clips[0].url.indexOf('https://videos.pexels.com/') === 0 && v.plan.clips[0].h === 1920, 'une vidéo verticale proche du 1080 x 1920');
  assert.strictEqual(new Set(v.plan.clips.filter(Boolean).map((x) => x.url)).size, 9, 'jamais deux fois la même vidéo');
  assert.ok(PEXELS.recherches.indexOf('sky timelapse') >= 0, 'secours : l\'image générale du sujet');
  assert.deepStrictEqual(GH.montages.map((x) => x.langue).sort(), ['en', 'fr'], 'un montage par langue');
  assert.ok(!JSON.stringify(v).includes('"jeton"'), 'la page ne voit jamais le jeton du montage');

  // 10. l'usine vient chercher sa commande, envoie ses fichiers, rend compte
  let u = await appelUsine('GET', { op: 'montage', video: String(vid), langue: 'en' });
  assert.strictEqual(u.code, 200);
  assert.strictEqual(u.d.voix.voix, 'af_heart'); assert.strictEqual(u.d.texte.beats.length, 9); assert.strictEqual(u.d.texte.beats[0].voix, 'English sentence 1 that says the same thing.');
  assert.strictEqual(u.d.plan.couleur, '#22D3EE'); assert.strictEqual(u.d.plan.clips.length, 9); assert.ok(!('auteur' in u.d.plan.clips[0]), 'l\'usine ne reçoit que ce qu\'il lui faut'); assert.strictEqual(u.d.format.duree_min, 0);
  const jetonEn = u.d.jeton;
  u = await appelUsine('POST', { op: 'montage_televerser', video: vid, langue: 'en', jeton: 'mauvais', fichiers: [{ nom: 'video.mp4', taille: 1000 }] });
  assert.strictEqual(u.code, 409, 'un vieux jeton ne téléverse rien');
  u = await appelUsine('POST', { op: 'montage_televerser', video: vid, langue: 'en', jeton: jetonEn, fichiers: [{ nom: '../../etc.mp4', taille: 1 }] });
  assert.strictEqual(u.code, 400, 'pas d\'autre fichier que les trois prévus');
  u = await appelUsine('POST', { op: 'montage_televerser', video: vid, langue: 'en', jeton: jetonEn, fichiers: [{ nom: 'video.mp4', taille: 5e6 }, { nom: 'vignette.jpg', taille: 1e5 }, { nom: 'sous-titres.srt', taille: 900 }] });
  assert.strictEqual(u.code, 200); assert.ok(u.d.urls['video.mp4']);
  assert.ok(STOCK.envoyes.indexOf('crea/' + lea.id + '/' + vid + '/en/video.mp4') >= 0, 'rangée sous crea/<compte>/<vidéo>/<langue>/');
  u = await appelUsine('POST', { op: 'montage_fini', video: vid, langue: 'en', jeton: jetonEn, ok: true, duree: 41.2, taille: 5e6, fichiers: ['video.mp4', 'vignette.jpg', 'sous-titres.srt'] });
  assert.strictEqual(u.code, 200); assert.strictEqual(u.d.prete, false, 'une langue sur deux');
  const jetonFr = (await appelUsine('GET', { op: 'montage', video: String(vid), langue: 'fr' })).d.jeton;
  u = await appelUsine('POST', { op: 'montage_fini', video: vid, langue: 'fr', jeton: jetonFr, ok: true, duree: 44, fichiers: ['video.mp4', 'vignette.jpg', 'sous-titres.srt'] });
  assert.strictEqual(u.d.prete, true, 'les deux langues : la vidéo est prête');
  r = await api('GET', { op: 'video', id: String(vid) });
  assert.strictEqual(r.d.video.status, 'prete');
  assert.ok(r.d.video.liens.fr['video.mp4'] && r.d.video.liens.fr.telecharger.includes('download='), 'lire et télécharger');
  r = await api('GET', { op: 'videos' });
  assert.ok(r.d.videos[0].vignette, 'la liste montre la vignette'); assert.strictEqual(r.d.videos[0].accroche, 'Le ciel n\'est *pas* bleu');

  // 11. elle retouche le texte publié, puis Sacha publie sur YouTube par upload-post
  r = await api('POST', { op: 'modifier', id: vid, langue: 'fr', texte: { titre: 'Le ciel', description: 'Tu le savais ?', hashtags: '#ciel #science' } });
  assert.strictEqual(r.d.video.publication.fr.texte.description, 'Tu le savais ?');
  r = await api('POST', { op: 'publier', id: vid });
  assert.strictEqual(r.code, 400, 'sans upload-post : publier à la main');
  r = await api('POST', { op: 'uploadpost', cle: 'up-mauvaise-cle-0123456789' });
  assert.strictEqual(r.code, 400);
  r = await api('POST', { op: 'uploadpost', cle: 'up-bonne-cle-0123456789abcdef' });
  assert.strictEqual(r.code, 200); assert.strictEqual(r.d.moi.connexions.uploadpost.profils[0].comptes.youtube.nom, 'Ma chaîne');
  r = await api('POST', { op: 'uploadpost_connecter', profil: 'studio' });
  assert.ok(/^https:\/\/app\.upload-post\.com\//.test(r.d.url), 'le lien pour relier ses comptes');
  r = await api('POST', { op: 'reglages', reglages: { publication: { fr: { profil: 'studio', plateformes: ['youtube'] } }, visibilite: { youtube: 'unlisted' } } });
  r = await api('POST', { op: 'publier', id: vid });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(r.d.video.status, 'publication');
  // entre deux suivis, Sacha attend une minute : le test avance l'horloge
  for (let i = 0; i < 6 && v.status !== 'publiee'; i++) {
    const f = await db.one('hq_crea_videos', { eq: { id: vid } });
    await db.update('hq_crea_videos', { etape: Object.assign({}, f.etape, { attendre_jusqu: null }) }, { eq: { id: vid } });
    v = (await api('POST', { op: 'avancer', id: vid })).d.video;
  }
  assert.strictEqual(v.status, 'publiee', 'publiée');
  assert.ok(UP.suivis >= 2, 'suivie jusqu\'au bout');
  assert.strictEqual(UP.envois.length, 1); const env1 = UP.envois[0];
  assert.deepStrictEqual([env1.user, env1.plateformes.join(), env1.confidentialite], ['studio', 'youtube', 'unlisted']);
  assert.ok(/^https:\/\/.*crea\/\d+\/\d+\/fr\/video\.mp4/.test(env1.video), 'upload-post va chercher la vidéo par un lien signé');
  assert.ok(env1.titre.includes('Tu le savais ?') && env1.titre.includes('#ciel'), 'le texte retouché part');
  assert.strictEqual(v.publication.fr.plateformes.youtube.lien, 'https://youtube.com/shorts/abc');
  r = await api('POST', { op: 'marquer_publiee', id: vid, langue: 'en', plateforme: 'tiktok', lien: 'javascript:alert(1)' });
  assert.strictEqual(r.d.video.publication.en.plateformes.tiktok.etat, 'manuelle'); assert.strictEqual(r.d.video.publication.en.plateformes.tiktok.lien, null, 'un faux lien n\'est pas gardé');

  // 12. le budget du jour : un appel trop cher n'a pas lieu ; elle monte son budget, l'équipe reprend
  await api('POST', { op: 'reglages', reglages: { budget_jour: 0.05, qualite: 'premium', langues: ['fr'] } });
  const nAvant = CLAUDE.appels.length;
  r = await api('POST', { op: 'creer', sujet: 'Pourquoi la mer est salée', langues: ['fr'] });
  const vid2 = r.d.video.id;
  v = (await api('POST', { op: 'avancer', id: vid2 })).d.video;
  assert.strictEqual(v.etape.bloque, 'budget', 'budget du jour atteint'); assert.strictEqual(CLAUDE.appels.length, nAvant, 'aucun appel payé');
  v = (await api('POST', { op: 'avancer', id: vid2 })).d.video;
  assert.strictEqual(CLAUDE.appels.length, nAvant, 'toujours en attente');
  await api('POST', { op: 'reglages', reglages: { budget_jour: 2 } });
  v = (await api('POST', { op: 'avancer', id: vid2 })).d.video;
  assert.ok(!v.etape.bloque && v.script.beats, 'budget monté : l\'écriture reprend');
  assert.strictEqual(CLAUDE.appels[CLAUDE.appels.length - 1].model, 'claude-opus-5-5', 'qualité premium : le meilleur modèle écrit');

  // 13. une clé refusée en route : la vidéo attend, puis repart avec la nouvelle clé
  CLAUDE.refusee = true;
  v = (await api('POST', { op: 'avancer', id: vid2 })).d.video;
  assert.strictEqual(v.etape.bloque, 'cle'); assert.ok(/refuse ta clé/.test(v.etape.erreur));
  assert.strictEqual((await api('GET', { op: 'moi' })).d.moi.connexions.claude.etat, 'refusee', 'la clé est marquée refusée');
  CLAUDE.refusee = false;
  await dormir(5);
  await api('POST', { op: 'cle_claude', cle: 'sk-ant-api03-nouvelle-cle-de-lea-987654321' });
  v = (await api('POST', { op: 'avancer', id: vid2 })).d.video;
  assert.ok(!v.etape.bloque, 'nouvelle clé : l\'équipe reprend');
  // plus de crédit : même chose, avec le lien pour en ajouter
  CLAUDE.sansCredit = true;
  await db.update('hq_crea_videos', { etape: { quoi: 'critique' }, status: 'ecriture' }, { eq: { id: vid2 } });
  v = (await api('POST', { op: 'avancer', id: vid2 })).d.video;
  assert.strictEqual(v.etape.bloque, 'credit'); assert.ok(/crédit/.test(v.etape.erreur));
  CLAUDE.sansCredit = false;
  r = await api('POST', { op: 'reprendre', id: vid2 });
  v = await jusqua(vid2, 'relecture');
  assert.strictEqual(v.status, 'relecture', 'reprise après le crédit');

  // 14. les dépenses : chaque appel réservé à son prix maximum puis ramené au prix réel
  lea = await db.one('hq_createurs', { eq: { identifiant: 'lea' } });
  const jour = C.jourDe(lea);
  const total = Number(lea.couts.jours[jour]);
  const videos = await db.select('hq_crea_videos', { eq: { createur_id: lea.id } });
  assert.ok(total > 0 && total < 1, 'dépense du jour réaliste : ' + total);
  assert.ok(Math.abs(Number(lea.couts.mois[jour.slice(0, 7)]) - total) < 1e-6, 'le mois suit le jour');
  assert.ok(videos.reduce((s, x) => s + Number(x.cout_usd), 0) <= total + 1e-6, 'les coûts des vidéos sont dans la dépense (les idées en plus)');

  // 15. réécrire avec sa consigne, archiver, supprimer (et ses fichiers)
  r = await api('POST', { op: 'reecrire', id: vid2, consigne: 'Plus drôle, et commence par le chiffre' });
  assert.strictEqual(r.d.video.status, 'ecriture'); assert.strictEqual(r.d.video.etape.consigne, 'Plus drôle, et commence par le chiffre');
  v = await jusqua(vid2, 'relecture');
  assert.strictEqual(v.status, 'relecture', 'réécrit avec sa consigne, puis relu une fois');
  r = await api('POST', { op: 'archiver', id: vid2 });
  assert.strictEqual(r.d.video.status, 'archivee');
  r = await api('POST', { op: 'supprimer', id: vid });
  assert.strictEqual(r.d.supprimee, true);
  assert.ok(STOCK.effaces.indexOf('crea/' + lea.id + '/' + vid + '/fr/video.mp4') >= 0, 'les fichiers partent avec la vidéo');

  // 16. les portes : une autre créatrice ne voit rien de Léa ; une autre origine ne fait rien ; les essais sont comptés
  const coLea = COOKIE;
  const sam = await ADM.agir(db, 'crea_creer', { prenom: 'Samia' });
  COOKIE = null;
  r = await api('POST', { op: 'invitation', code: sam.code, mdp: 'le studio de samia 2026' });
  assert.strictEqual(r.code, 200);
  r = await api('GET', { op: 'video', id: String(vid2) });
  assert.strictEqual(r.code, 404, 'la vidéo de Léa est introuvable pour Samia');
  r = await api('POST', { op: 'supprimer', id: vid2 });
  assert.strictEqual(r.code, 404, 'et Samia ne peut pas la supprimer');
  assert.strictEqual((await api('GET', { op: 'videos' })).d.videos.length, 0);
  COOKIE = coLea;
  r = await api('POST', { op: 'reglages', reglages: { budget_jour: 10 } }, { origine: 'https://pirate.test' });
  assert.strictEqual(r.code, 403, 'une autre origine est refusée');
  r = await api('GET', { op: 'videos' }, { cookie: 'faux.jeton.signature0123456789abcdef' });
  assert.strictEqual(r.code, 401, 'un faux cookie ne passe pas');
  let dernier;
  for (let i = 0; i < 6; i++) dernier = await api('POST', { op: 'connexion', identifiant: 'lea', mdp: 'mauvais mot de passe ' + i }, { cookie: null, garder: false, ip: '5.6.7.8' });
  assert.strictEqual(dernier.code, 429, 'trop d\'essais : on attend');
  r = await api('POST', { op: 'connexion', identifiant: 'lea', mdp: 'mes vidéos du dimanche' }, { cookie: null, ip: '9.9.9.9' });
  assert.strictEqual(r.code, 200, 'le bon mot de passe d\'ailleurs passe');
  const coAvant = COOKIE;
  await ADM.agir(db, 'crea_statut', { id: lea.id, statut: 'suspendue' });
  r = await api('GET', { op: 'videos' });
  assert.strictEqual(r.code, 401, 'compte en pause : déconnectée');
  await ADM.agir(db, 'crea_statut', { id: lea.id, statut: 'active' });
  r = await api('GET', { op: 'videos' }, { cookie: coAvant });
  assert.strictEqual(r.code, 401, 'la pause a fermé ses anciennes sessions');
  r = await api('POST', { op: 'connexion', identifiant: 'lea', mdp: 'mes vidéos du dimanche' }, { cookie: null, ip: '9.9.9.10' });
  assert.strictEqual(r.code, 200, 'réactivée, elle se reconnecte');
  r = await api('POST', { op: 'mdp', ancien: 'mes vidéos du dimanche', nouveau: 'un nouveau mot de passe long' });
  assert.strictEqual(r.code, 200);
  r = await api('POST', { op: 'deconnexion', partout: true });
  r = await api('GET', { op: 'etat' });
  assert.strictEqual(r.d.connecte, false, 'déconnectée partout');

  // 17. le pilote automatique : à son heure, une vidéo du jour, sans relecture si elle l'a choisi ; le passage régulier avance tout
  r = await api('POST', { op: 'connexion', identifiant: 'lea', mdp: 'un nouveau mot de passe long' }, { cookie: null, ip: '9.9.9.11' });
  await api('POST', { op: 'reglages', reglages: { pilote: { actif: true, videos_jour: 1, heure: 0, relire: false, publier: false }, qualite: 'eco', budget_jour: 1, langues: ['fr'] } });
  let t = await api('GET', {}, { auth: 'Bearer ' + process.env.CRON_SECRET, cookie: null });
  assert.strictEqual(t.code, 200, 'le cron passe'); assert.ok(t.d.journal.some((x) => /pilote : vidéo \d+ lancée/.test(x)), 'le pilote lance la vidéo du jour : ' + JSON.stringify(t.d.journal));
  const auto = (await db.select('hq_crea_videos', { eq: { createur_id: lea.id, auto: true } }))[0];
  assert.ok(auto, 'une vidéo du pilote');
  for (let i = 0; i < 6; i++) await api('GET', { tick: '1' }, { auth: 'Bearer ' + process.env.CRON_SECRET, cookie: null });
  const auto2 = await db.one('hq_crea_videos', { eq: { id: auto.id } });
  assert.ok(['fabrication', 'prete'].indexOf(auto2.status) >= 0, 'sans relecture, le pilote va jusqu\'au montage : ' + auto2.status);
  assert.ok(CLAUDE.appels.filter((x) => x.model === 'claude-haiku-5-5' && x.outil === 'ecrire_script').length >= 1, 'qualité économique : le petit modèle écrit');
  t = await api('GET', { tick: '1' }, { auth: 'Bearer ' + process.env.CRON_SECRET, cookie: null });
  assert.ok(!t.d.journal.some((x) => /lancée/.test(x)), 'une seule vidéo du pilote par jour');
  t = await api('GET', { tick: '1' }, { auth: 'Bearer faux', cookie: null });
  assert.strictEqual(t.code, 401, 'le cron sans le bon secret ne fait rien');

  // 18. le ménage : les fichiers de plus de 30 jours partent, la vidéo reste
  const vieille = (await db.insert('hq_crea_videos', { createur_id: lea.id, status: 'publiee', langues: ['fr'], langue_source: 'fr', rendus: { fr: { etat: 'fini', fichiers: ['video.mp4'] } }, created_at: new Date(Date.now() - 40 * 86400000).toISOString() }))[0];
  await db.remove('hq_config', { eq: { key: 'crea:menage' } });
  const n = await CH.menage(db);
  assert.strictEqual(n, 1);
  assert.strictEqual((await db.one('hq_crea_videos', { eq: { id: vieille.id } })).rendus.fr.etat, 'efface');
  assert.ok(STOCK.effaces.indexOf('crea/' + lea.id + '/' + vieille.id + '/fr/vignette.jpg') >= 0);

  // 19. le script trop court est refusé ; la version d'une langue doit avoir toutes ses phrases
  assert.throws(() => E.nettoyerScript({ beats: [{ voix: 'Une seule phrase.' }] }, false, 'court'), /script inutilisable/);
  assert.strictEqual(E.nettoyerScript(scriptFaux(9, true, 1), true, 'court').beats[0].visuel.requete, 'blue sky clouds');

  // 20. le montage : les sous-titres mot à mot (police, couleur, mot qui s'allume), les fenêtres de chaque phrase
  const temps = { duree: 6.2, segments: [{ debut: 0.25, fin: 2.4, mots: [{ m: 'Le', t0: 0.25, t1: 0.4 }, { m: 'ciel', t0: 0.4, t1: 0.8, fort: true }, { m: 'n\'est', t0: 0.8, t1: 1.1 }, { m: 'pas', t0: 1.1, t1: 1.5 }, { m: 'bleu.', t0: 1.5, t1: 2.4 }] }, { debut: 2.7, fin: 5.3, mots: [{ m: 'Extraordinairement', t0: 2.7, t1: 3.9 }, { m: 'vrai.', t0: 3.9, t1: 5.3 }] }] };
  const ass = M.sousTitres({ texte: { accroche: 'Le ciel *ment*', beats: [{ voix: 'a', ecran: 'Un' }, { voix: 'b', ecran: 'Deux' }] }, plan: { style: 'clips', couleur: '#FF5A8A' } }, temps);
  assert.ok(ass.includes('Style: Sous,Poppins ExtraBold'), 'la police des sous-titres');
  assert.ok(ass.includes('&H008A5AFF'), 'la couleur de la créatrice en ASS (BBGGRR)');
  assert.ok(/Accroche,,0,0,0,,\{[^}]*\}Le ciel ment/.test(ass), 'l\'accroche sans étoiles');
  assert.strictEqual((ass.match(/,Sous,/g) || []).length, 7, 'un événement par mot dit');
  assert.ok(/\\fs\d+\}/.test(ass), 'un mot trop large pour l\'écran : la taille baisse');
  const fen = M.fenetres(temps);
  assert.strictEqual(fen[0].debut, 0); assert.ok(Math.abs(fen[fen.length - 1].fin - 6.2) < 1e-9, 'les fenêtres couvrent toute la vidéo');
  assert.ok(M.HOTES.test('videos.pexels.com') && !M.HOTES.test('evil.com'), 'l\'usine ne télécharge que dans les banques libres');

  // 21. les langues : 28 langues, deux moteurs de voix ; le chinois et le japonais coupent leurs sous-titres par mots
  assert.ok(Object.keys(C.LANGUES).length >= 25, 'plus de vingt-cinq langues');
  const vDe = C.voixDe(C.reglagesDe({}), 'de');
  assert.strictEqual(vDe.moteur, 'piper'); assert.ok(/^de_DE-[a-z0-9_]+-(x_low|low|medium|high)$/.test(vDe.piper), 'une voix Piper allemande');
  assert.strictEqual(C.voixDe(C.reglagesDe({}), 'fr').moteur, 'kokoro');
  assert.strictEqual(C.voixDe(C.reglagesDe({ reglages: { voix: { fr: 'piper:fr_FR-tom-medium' } } }), 'fr').piper, 'fr_FR-tom-medium', 'une voix Piper pour le français aussi');
  assert.strictEqual(C.voixDe(C.reglagesDe({ reglages: { voix: { fr: 'piper:../../etc' } } }), 'fr').voix, 'ff_siwis', 'une voix inconnue est refusée');
  Object.keys(C.LANGUES).forEach((l) => C.LANGUES[l].voix.forEach((v) => { if (/^piper:/.test(v[0])) assert.ok(/^piper:[a-z]{2,3}_[A-Z]{2}-[a-z0-9_]+-(x_low|low|medium|high)$/.test(v[0]), 'nom de voix Piper : ' + v[0]); }));
  assert.ok(C.voixDe(C.reglagesDe({}), 'zh').cjk && C.voixDe(C.reglagesDe({}), 'ja').cjk, 'chinois et japonais : sans espaces');
  const tz = { duree: 3, segments: [{ debut: 0.2, fin: 2.6, mots: [{ m: '你', t0: 0.2, t1: 0.4, o: 0 }, { m: '知道吗？', t0: 0.4, t1: 1.0, o: 1 }, { m: '天空', t0: 1.1, t1: 1.5, o: 5, fort: true }, { m: '其实', t0: 1.5, t1: 1.9, o: 7 }, { m: '不是', t0: 1.9, t1: 2.2, o: 9 }, { m: '蓝色的。', t0: 2.2, t1: 2.6, o: 11 }] }] };
  const assZ = M.sousTitres({ langue: 'zh', voix: { cjk: true }, texte: { accroche: '天空其实不是蓝色的', beats: [{ voix: 'x', ecran: '天空' }] }, plan: { style: 'clips', couleur: '#8B5CF6' } }, tz);
  assert.ok(assZ.includes('Style: Sous,Noto Sans CJK SC'), 'la police chinoise');
  assert.ok(!/Dialogue: 0,[^\n]*,Sous,,0,0,0,,[^\n]*你 知/.test(assZ), 'pas d\'espace entre les mots chinois');
  assert.strictEqual(M.policeDe('ru'), 'Noto Sans ExtraBold'); assert.strictEqual(M.policeDe('ar'), 'Noto Sans Arabic ExtBd'); assert.strictEqual(M.policeDe('de'), 'Poppins ExtraBold');
  assert.deepStrictEqual(M.couper('知道吗？章鱼有三颗心脏。', 6, true).map((x) => Array.from(x).length).slice(0, 1), [6], 'le chinois se coupe tous les n caractères');
  assert.ok(!/^[。！？，]/.test(M.couper('一二三四五六。七八', 6, true)[1] || ''), 'jamais une ligne qui commence par une ponctuation');

  // 22. les modèles de vidéo et l'apparence : le modèle va jusqu'à la plume, le thème accepte jour, nuit, auto
  const avantM = CLAUDE.appels.length;
  const rm = await api('POST', { op: 'creer', sujet: 'Les 3 animaux qui ne dorment presque jamais', modele: 'top3', langues: ['fr'] });
  assert.strictEqual(rm.code, 200, 'une vidéo avec un modèle : ' + JSON.stringify(rm.d));
  assert.strictEqual((await db.one('hq_crea_videos', { eq: { id: rm.d.video.id } })).plan.modele, 'top3');
  await api('POST', { op: 'avancer', id: rm.d.video.id });
  const appelM = CLAUDE.appels.slice(avantM).find((x) => x.outil === 'ecrire_script');
  assert.ok(appelM && /Top 3/.test(appelM.prompt), 'la plume reçoit le modèle');
  const rx = await api('POST', { op: 'creer', sujet: 'Un sujet', modele: 'inexistant', langues: ['fr'] });
  if (rx.code === 200) assert.ok(!(await db.one('hq_crea_videos', { eq: { id: rx.d.video.id } })).plan.modele, 'un modèle inconnu est ignoré');
  const rt = await api('POST', { op: 'reglages', reglages: { theme: { mode: 'sombre', ville: false }, visite_faite: true } });
  assert.strictEqual(rt.d.moi.reglages.theme.mode, 'nuit', 'l\'ancien « sombre » devient la nuit'); assert.strictEqual(rt.d.moi.reglages.theme.ville, false); assert.strictEqual(rt.d.moi.reglages.visite_faite, true);
  const cat = (await api('GET', { op: 'etat' })).d.catalogue;
  assert.ok(cat.modeles.top3 && cat.modeles.top3.nom === 'Top 3' && !cat.modeles.top3.structure, 'le catalogue montre les modèles, pas leurs consignes');
  assert.ok(Array.isArray(cat.naturelles) && cat.naturelles.indexOf('fr') >= 0);

  // 23. la page et la ville se lisent (pas d'erreur de syntaxe dans les fichiers du navigateur)
  const { execFileSync } = require('child_process');
  const fs = require('fs'), os = require('os'), path = require('path');
  execFileSync(process.execPath, ['--check', path.join(__dirname, '../assets/studio/app.js')]);
  const tmp = path.join(os.tmpdir(), 'ville-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(__dirname, '../assets/studio/ville.js'), tmp);
  try { execFileSync(process.execPath, ['--check', tmp]); } finally { fs.unlinkSync(tmp); }

  console.log('Studio des créatrices : tout passe (' + CLAUDE.appels.length + ' appels Claude simulés, ' + GH.montages.length + ' montages, ' + UP.envois.length + ' publication).');
})().catch((e) => { console.error(e); process.exit(1); });
