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
const CLAUDE = { appels: [], refusee: false, sansCredit: false, notes: [6.2, 8.6], cles: [], espaces: [] };
// une clé personnelle liée à aucun espace de travail : chaque demande doit nommer l'espace (sauf la liste des espaces)
const SANS_ESPACE = { type: 'error', error: { type: 'invalid_request_error', message: 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace.' } };
let nTool = 0;
const repJson = (code, d) => ({ ok: code < 300, status: code, json: async () => d, text: async () => JSON.stringify(d) });
// comme la vraie API : la génération 5.5 refuse un outil imposé (400, rien n'est payé) ; l'outil demandé en clair passe
const { MODELS } = require('../lib/config');
const GEN55 = [MODELS.fast.id, MODELS.smart.id, MODELS.genius.id];
const REFUS_OUTIL = { type: 'error', error: { type: 'invalid_request_error', message: 'tool_choice: type "tool" and "any" are not supported for this model.' } };
// les modèles fermés aux comptes récents (l'ancien modèle de repli du studio), et un compte où le modèle moyen n'est
// pas ouvert : sa liste de modèles ne le propose pas
CLAUDE.fermes = ['claude-sonnet-4-5'];
const LISTE_FERMEE = [{ id: 'claude-haiku-5-5', created_at: '2026-10-07T00:00:00Z' }, { id: 'claude-fable-5-2', created_at: '2026-11-09T00:00:00Z' }, { id: 'claude-sonnet-4-6', created_at: '2026-02-17T00:00:00Z' }, { id: 'claude-sonnet-5', created_at: '2026-06-30T00:00:00Z' }, { id: 'claude-opus-5-5', created_at: '2026-09-22T00:00:00Z' }];
const texteDe = (c) => (typeof c === 'string' ? c : (c || []).map((b) => b.text || '').join('\n\n'));
// la réponse en flux (server-sent events), découpée en morceaux qui coupent les lignes n'importe où
function enFlux(d) {
  CLAUDE.flux = (CLAUDE.flux || 0) + 1;
  const u = d.usage || {};
  const ev = [{ type: 'message_start', message: { id: 'msg_f', type: 'message', role: 'assistant', model: d.model, content: [], stop_reason: null, usage: { input_tokens: u.input_tokens || 0, output_tokens: 1 } } }];
  (d.content || []).forEach((b, i) => {
    if (b.type === 'tool_use') {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      const j = JSON.stringify(b.input || {});
      for (let k = 0; k < j.length; k += 37) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(k, k + 37) } });
    } else {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: b.text || '' } });
    }
    ev.push({ type: 'content_block_stop', index: i });
  });
  ev.push({ type: 'message_delta', delta: { stop_reason: d.stop_reason }, usage: { output_tokens: u.output_tokens || 0 } });
  ev.push({ type: 'message_stop' });
  const octets = new TextEncoder().encode(ev.map((e) => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join(''));
  let pos = 0;
  return { ok: true, status: 200, body: new ReadableStream({ pull(c) { if (pos >= octets.length) { c.close(); return; } c.enqueue(octets.slice(pos, pos + 53)); pos += 53; } }) };
}
const reponse = (body, d) => (body.stream ? enFlux(d) : repJson(200, d));
function scriptFaux(beatsN, avecImages, version, ia) {
  // en images IA, la plume écrit aussi la scène pour l'IA, son mouvement, une recherche de secours et l'univers commun
  const visuel = (i) => (ia
    ? { prompt: 'A fluffy flamingo chick in scene ' + (i + 1) + ', wading through a pink salt lake at sunrise, close-up', mouvement: 'slow push-in, ripples spreading', requete: 'flamingo lake', description: 'Un petit flamant' }
    : { requete: i === 3 ? 'introuvable chose' : ['blue sky clouds', 'sunlight through clouds', 'sunset over sea', 'rainbow after rain', 'night stars sky', 'airplane above clouds', 'storm clouds moving', 'children looking up sky', 'mountain sky timelapse'][i % 9], requete2: i === 3 ? 'introuvable aussi' : 'sky view ' + (i + 1), description: 'Un ciel bleu' });
  return Object.assign({
    titre: 'Pourquoi le ciel est bleu' + (version > 1 ? ' (v' + version + ')' : ''), accroche: 'Le ciel n\'est *pas* bleu',
    beats: Array.from({ length: beatsN }, (_, i) => Object.assign({ voix: (i === 0 ? 'Le ciel n\'est pas *vraiment* bleu.' : 'Phrase numéro ' + (i + 1) + ' qui explique une chose simple et vraie.'), ecran: 'Écran ' + (i + 1) }, avecImages ? { visuel: visuel(i) } : {})),
    description: 'Tu savais ? Dis-moi en commentaire.', hashtags: ['#science', 'ciel', 'le ciel'], titre_youtube: 'Le ciel n\'est pas bleu #shorts', image_generale: 'sky timelapse'
  }, ia ? { direction: 'A grey fluffy flamingo chick with big curious eyes, pastel pink salt lake, golden light "always"' } : {});
}
CL.forcer(async (url, o) => {
  // la clé arrive par l'en-tête historique (x-api-key) ou en « Bearer » ; certaines clés ne passent qu'en Bearer
  const cleRecue = o.headers['x-api-key'] || String(o.headers.authorization || '').replace(/^Bearer /, '');
  if (/porteur/.test(cleRecue) && o.headers['x-api-key']) return repJson(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
  if (/^sk-ant-oat/.test(cleRecue)) return repJson(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
  const sansEspace = /sans-espace/.test(cleRecue) && !o.headers['anthropic-workspace-id'];
  if (/\/organizations\/workspaces/.test(url)) return repJson(200, { data: [{ id: 'wrkspc_01Projet', type: 'workspace', name: 'Projet', archived_at: null }, { id: 'wrkspc_01Default', type: 'workspace', name: 'Default Workspace', archived_at: null }], has_more: false });
  if (/\/models/.test(url)) return CLAUDE.refusee ? repJson(401, { error: { message: 'invalid x-api-key' } }) : sansEspace ? repJson(400, SANS_ESPACE) : repJson(200, { data: /compte-ferme/.test(cleRecue) ? LISTE_FERMEE : [] });
  if (sansEspace) return repJson(400, SANS_ESPACE);
  CLAUDE.espaces.push(o.headers['anthropic-workspace-id'] || null);
  const body = JSON.parse(o.body);
  CLAUDE.cles.push(cleRecue);
  CLAUDE.porteurs = (CLAUDE.porteurs || []).concat([!!o.headers.authorization]);
  if (CLAUDE.refusee) return repJson(401, { error: { message: 'invalid x-api-key' } });
  if (CLAUDE.sansCredit) return repJson(400, { error: { message: 'Your credit balance is too low to access the Anthropic API.' } });
  if (body.max_tokens === 1) return repJson(200, { content: [{ type: 'text', text: 'o' }], usage: { input_tokens: 8, output_tokens: 1 } });
  if (CLAUDE.fermes.indexOf(body.model) >= 0 || (/compte-ferme/.test(cleRecue) && body.model === MODELS.smart.id) || /compte-vide/.test(cleRecue)) {
    CLAUDE.introuvables = (CLAUDE.introuvables || 0) + 1;
    return repJson(404, { type: 'error', error: { type: 'not_found_error', message: 'model: ' + body.model } });
  }
  if (GEN55.indexOf(body.model) >= 0 && body.tool_choice && (body.tool_choice.type === 'tool' || body.tool_choice.type === 'any')) { CLAUDE.refusOutil = (CLAUDE.refusOutil || 0) + 1; return repJson(400, REFUS_OUTIL); }
  const dernier = body.messages[body.messages.length - 1];
  const enClair = !!(body.tool_choice && body.tool_choice.type === 'auto' && /Réponds en appelant l'outil/.test(texteDe(dernier.content)));
  if (enClair) CLAUDE.enClair = (CLAUDE.enClair || 0) + 1;
  CLAUDE.corps = body;
  const outil = body.tools[0].name;
  const prompt = texteDe(body.messages[0].content);
  CLAUDE.appels.push({ outil, model: body.model, max_tokens: body.max_tokens, prompt, enClair, flux: !!body.stream });
  // un tour où le modèle parle sans remplir l'outil, une réponse coupée par la longueur en plein outil
  if (CLAUDE.texteSeul) { CLAUDE.texteSeul = false; return reponse(body, { model: body.model, content: [{ type: 'text', text: 'Je réfléchis à tes idées.' }], stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 40 } }); }
  if (CLAUDE.coupe) { CLAUDE.coupe = false; return reponse(body, { model: body.model, content: [{ type: 'tool_use', id: 'tu_coupe', name: outil, input: {} }], stop_reason: 'max_tokens', usage: { input_tokens: 3000, output_tokens: body.max_tokens } }); }
  let input;
  if (outil === 'proposer_idees') input = { idees: [1, 2, 3, 4, 5].map((i) => ({ titre: 'Idée ' + i + ' sur le ciel', accroche: 'Accroche ' + i, angle: 'Angle ' + i, pourquoi: 'Parce que ' + i })) };
  else if (outil === 'choisir_images') {
    // Lou choisit : la première vidéo de chaque phrase, sauf celles dites hors sujet (aucune, et l'image à créer)
    const blocs = prompt.split(/\n\n(?=PHRASE \d+ :)/).filter((x) => /^PHRASE \d+ :/.test(x.replace(/^[^]*?(PHRASE \d+ :)/, '$1')));
    input = { choix: blocs.map((x) => {
      const n = Number(/PHRASE (\d+) :/.exec(x)[1]);
      const hors = (CLAUDE.horsSujet || []).indexOf(n) >= 0 || /aucune vidéo trouvée/.test(x);
      return hors ? { phrase: n, video: 0, image: 'A friendly 3D illustration of the human stomach digesting food, soft light, clean background' } : { phrase: n, video: CLAUDE.choixVideo || 1 };
    }) };
    CLAUDE.choix = (CLAUDE.choix || []).concat([{ prompt, choix: input.choix }]);
  }
  else if (outil === 'ecrire_script') { const vis = body.tools[0].input_schema.properties.beats.items.properties.visuel; input = scriptFaux(9, !!vis, CLAUDE.appels.filter((x) => x.outil === 'ecrire_script').length, !!(vis && vis.properties.prompt)); CLAUDE.appels[CLAUDE.appels.length - 1].system = JSON.stringify(body.system); }
  else if (outil === 'noter_script') { const n = CLAUDE.notes.length > 1 ? CLAUDE.notes.shift() : CLAUDE.notes[0]; input = { notes: { accroche: n, promesse: n, rythme: n, boucles: n, gain: n, fin: n, clarte: n, ton: n, images: n }, points_forts: ['L\'accroche'], corrections: n < 7.5 ? ['Phrase 2 : plus court'] : [], verdict: 'Note ' + n }; }
  else if (outil === 'adapter_script') { const src = JSON.parse(prompt.split('L\'ORIGINALE :\n')[1].split('\n\nAppelle')[0]); input = { titre: 'Why the sky is blue', accroche: 'The sky is *not* blue', beats: src.beats.map((b, i) => ({ voix: 'English sentence ' + (i + 1) + ' that says the same thing.', ecran: 'Screen ' + (i + 1) })), description: 'Did you know?', hashtags: ['science'], titre_youtube: 'The sky is not blue' }; }
  nTool++;
  return reponse(body, { model: body.model, content: [{ type: 'tool_use', id: 'tu_' + nTool, name: outil, input }], stop_reason: 'tool_use', usage: { input_tokens: 4000, output_tokens: 1500 } });
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
const STOCK = { envoyes: [], effaces: [], msgEnvoyes: [], msgEffaces: [], arrives: new Set() };
ST.forcer(async (url, o) => {
  const json = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  // l'espace de la messagerie : les liens d'envoi, les fichiers arrivés (STOCK.arrives), les liens de lecture, le ménage
  if (/\/object\/upload\/sign\/messages\//.test(url)) { const c = url.split('/object/upload/sign/messages/')[1]; STOCK.msgEnvoyes.push(c); return json({ url: '/object/upload/sign/messages/' + c + '?token=env' }); }
  if (/\/object\/sign\/messages$/.test(url)) return json(JSON.parse(o.body).paths.map((p) => ({ path: p, signedURL: '/object/sign/messages/' + p + '?token=lu' })));
  if (/\/object\/list\/messages$/.test(url)) { const b = JSON.parse(o.body); return json(STOCK.arrives.has(b.prefix + '/' + b.search) ? [{ name: b.search }] : []); }
  if (/\/object\/messages$/.test(url) && o.method === 'DELETE') { STOCK.msgEffaces.push.apply(STOCK.msgEffaces, JSON.parse(o.body).prefixes); return json([]); }
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

/* ── fal simulé : la file d'attente (envoyer, revenir voir deux fois, prendre le résultat), des images et des vidéos ;
   une image peut rater chez fal, ou revenir écartée par le filtre ── */
const FAL = require('../lib/createurs/fal');
const IA = require('../lib/createurs/ia');
IA.reglerAttente(0);
const FALM = { envois: [], vus: {}, refuse: false, credit: false, erreurs: {}, filtre: {}, cles: [], ailleurs: [], voix: [], directes: [], voixRatees: {} };
FAL.forcer(async (url, o) => {
  const k = String(o.headers.Authorization || '').replace(/^Key /, '');
  FALM.cles.push(k);
  const u = new URL(url);
  if (['queue.fal.run', 'api.fal.ai', 'fal.run'].indexOf(u.hostname) < 0) FALM.ailleurs.push(url);
  if (FALM.refuse || /mauvaise/.test(k)) return repJson(401, { detail: 'Invalid key' });
  if (u.hostname === 'api.fal.ai') return repJson(200, { prices: [{ endpoint_id: u.searchParams.get('endpoint_id'), unit_price: 0.008, unit: 'megapixels', currency: 'USD' }] });
  if (FALM.credit) return repJson(403, { detail: 'User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing.' });
  // les demandes directes (fal.run) : une phrase dite par la voix naturelle, ou une image créée pour une phrase
  if (u.hostname === 'fal.run') {
    const modele = u.pathname.slice(1), corps = JSON.parse(o.body);
    if (/elevenlabs\/tts\//.test(modele)) {
      FALM.voix.push({ modele, corps, cycle: o.headers['X-Fal-Object-Lifecycle-Preference'] });
      const rate = Object.keys(FALM.voixRatees).find((x) => corps.text.includes(x) && FALM.voixRatees[x] > 0);
      if (rate) { FALM.voixRatees[rate]--; return repJson(422, { detail: [{ msg: 'Text could not be synthesized' }] }); }
      return repJson(200, { audio: { url: 'https://v3.fal.media/files/a/voix-' + FALM.voix.length + '.mp3', content_type: 'audio/mpeg' } });
    }
    FALM.directes.push({ modele, corps });
    return repJson(200, { images: [{ url: 'https://v3.fal.media/files/i/d' + FALM.directes.length + '.jpg', width: 1088, height: 1920 }], has_nsfw_concepts: [false] });
  }
  if (o.method === 'POST') {
    const modele = u.pathname.slice(1);
    const id = 'req-' + (FALM.envois.length + 1);
    FALM.envois.push({ id, modele, corps: JSON.parse(o.body), cycle: o.headers['X-Fal-Object-Lifecycle-Preference'] });
    const base = 'https://queue.fal.run/' + modele.split('/').slice(0, 2).join('/') + '/requests/' + id;
    return repJson(200, { request_id: id, status_url: base + '/status', response_url: base, cancel_url: base + '/cancel' });
  }
  const m = /\/requests\/([^/]+?)(\/status)?$/.exec(u.pathname);
  const env = m && FALM.envois.find((x) => x.id === m[1]);
  if (!env) return repJson(404, { detail: 'Request not found' });
  const marque = (table) => { const t = Object.keys(table).find((x) => env.corps.prompt.includes(x) && table[x] > 0); if (t) table[t]--; return !!t; };
  if (m[2]) {
    FALM.vus[env.id] = (FALM.vus[env.id] || 0) + 1;
    if (FALM.vus[env.id] < 2) return repJson(200, { status: 'IN_QUEUE', queue_position: 2 });
    if (marque(FALM.erreurs)) return repJson(200, { status: 'COMPLETED', error: 'Runner crashed', error_type: 'runner_error' });
    return repJson(200, { status: 'COMPLETED' });
  }
  if (/image-to-video/.test(env.modele)) return repJson(200, { video: { url: 'https://v3b.fal.media/files/v/' + env.id + '.mp4', content_type: 'video/mp4', file_size: 2e6 } });
  return repJson(200, { images: [{ url: 'https://v3.fal.media/files/i/' + env.id + '.jpg', width: 1088, height: 1920, content_type: 'image/jpeg' }], has_nsfw_concepts: [marque(FALM.filtre)], seed: env.corps.seed, prompt: env.corps.prompt });
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

  // 24. les images IA : Mila branche sa clé fal, choisit le look anime avec l'accroche en vidéo ; la plume écrit les
  //     scènes ; Lou fait créer les images en plusieurs tours (une image ratée chez fal est refaite, une image écartée
  //     deux fois par le filtre laisse sa place à Pexels), anime la première scène, puis lance le montage ; le budget
  //     compte tout ; « Refaire le montage » reprend les images ; une clé refusée, plus de crédit, continuer sans IA
  COOKIE = null;
  const mila = await ADM.agir(db, 'crea_creer', { prenom: 'Mila' });
  r = await api('POST', { op: 'invitation', code: mila.code, mdp: 'le studio de mila 2026' });
  assert.strictEqual(r.code, 200);
  r = await api('POST', { op: 'cle_claude', cle: 'sk-ant-api03-la-cle-de-mila-0123456789abc' });
  assert.strictEqual(r.code, 200);
  r = await api('POST', { op: 'reglages', reglages: { style: 'ia', ia: { style: 'anime', mouvement: 'accroche' }, budget_jour: 5, langues: ['fr', 'en'] } });
  assert.strictEqual(r.d.moi.reglages.style, 'ia'); assert.deepStrictEqual(r.d.moi.reglages.ia, { style: 'anime', mouvement: 'accroche' });
  assert.ok(r.d.moi.depense.estime_ia > 0.2 && r.d.moi.depense.estime_video > r.d.moi.depense.estime_ia, 'le coût estimé compte les images IA : ' + JSON.stringify(r.d.moi.depense));
  r = await api('POST', { op: 'reglages', reglages: { ia: { style: 'inconnu', mouvement: 'tout' } } });
  assert.deepStrictEqual(r.d.moi.reglages.ia, { style: 'anime', mouvement: 'tout' }, 'un look inconnu est ignoré');
  await api('POST', { op: 'reglages', reglages: { ia: { mouvement: 'accroche' } } });
  const catIa = (await api('GET', { op: 'etat' })).d.catalogue.ia;
  assert.ok(catIa.looks.anime && catIa.looks.anime.nom === 'Anime' && !catIa.looks.anime.prompt, 'le catalogue montre les looks, pas ce que reçoit l\'IA');
  assert.ok(catIa.couts.court.zoom < catIa.couts.court.accroche && catIa.couts.court.accroche < catIa.couts.court.tout && catIa.couts.long.tout > catIa.couts.court.tout, 'les coûts suivent le mouvement et la durée');
  r = await api('POST', { op: 'creer', sujet: 'Pourquoi les flamants roses sont roses', style: 'ia' });
  assert.strictEqual(r.code, 400); assert.ok(/clé fal/.test(r.d.erreur), 'sans clé fal, pas de vidéo en images IA');
  r = await api('POST', { op: 'cle_fal', cle: 'sk-ant-api03-pas-la-bonne-cle-0123456789' });
  assert.strictEqual(r.code, 400); assert.ok(/clé Claude/.test(r.d.erreur), 'une clé Claude collée au mauvais endroit');
  r = await api('POST', { op: 'cle_fal', cle: 'mauvaise-cle-fal-0123:abcdef0123456789abcdef' });
  assert.strictEqual(r.code, 400); assert.ok(/reconnaît pas/.test(r.d.erreur));
  const CLE_FAL = '7c1f2a90-4be3-4f60-9d1e-1a2b3c4d5e6f:0f9e8d7c6b5a49382716abcdef012345';
  r = await api('POST', { op: 'cle_fal', cle: 'Key ' + CLE_FAL });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(r.d.moi.connexions.fal.branchee, true); assert.strictEqual(r.d.moi.connexions.fal.fin, '2345');
  let milaDb = await db.one('hq_createurs', { eq: { id: mila.id } });
  assert.ok(!JSON.stringify(milaDb.secrets).includes('0f9e8d7c6b5a'), 'la clé fal est chiffrée en base');

  // la plume écrit les scènes pour l'IA, dans le look choisi ; Mila retouche une scène
  r = await api('POST', { op: 'creer', sujet: 'Pourquoi les flamants roses sont roses', langues: ['fr', 'en'] });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); const vIa = r.d.video.id;
  assert.strictEqual(r.d.video.plan.style, 'ia'); assert.deepStrictEqual(r.d.video.plan.ia, { style: 'anime', mouvement: 'accroche' });
  v = await jusqua(vIa, 'relecture');
  assert.strictEqual(v.status, 'relecture');
  const ecritIa = CLAUDE.appels.filter((x) => x.outil === 'ecrire_script').pop();
  assert.ok(/style « images IA »/.test(ecritIa.system) && /Anime/.test(ecritIa.system), 'la plume connaît le look et les règles des images IA');
  assert.ok(ecritIa.max_tokens > 3500, 'plus de place pour écrire les scènes');
  assert.ok(v.script.beats[0].visuel.prompt.indexOf('scene 1') > 0 && v.script.beats[0].visuel.mouvement && v.script.beats[0].visuel.requete === 'flamingo lake', 'une scène, un mouvement et une recherche de secours par phrase');
  assert.ok(v.script.direction && !/"/.test(v.script.direction), 'l\'univers commun, sans guillemets doubles');
  const beatsIa = v.script.beats.map((x, i) => (i === 2 ? Object.assign({}, x, { visuel: Object.assign({}, x.visuel, { prompt: 'A fluffy flamingo chick in scene 3, eating tiny pink shrimps, macro shot' }) }) : x));
  r = await api('POST', { op: 'modifier', id: vIa, script: { beats: beatsIa } });
  assert.strictEqual(r.code, 200); assert.ok(/tiny pink shrimps/.test(r.d.video.script.beats[2].visuel.prompt) && r.d.video.script.beats[2].visuel.requete === 'flamingo lake', 'sa retouche garde la recherche de secours');
  r = await api('POST', { op: 'valider', id: vIa });
  assert.strictEqual(r.d.video.status, 'langues');

  // Lou fait créer les images en plusieurs tours, anime la première scène, lance le montage
  FALM.erreurs['scene 4,'] = 1; FALM.filtre['scene 6,'] = 2;
  const avantFal = FALM.envois.length;
  const depAvant = Number(((milaDb.couts || {}).jours || {})[C.jourDe(milaDb)] || 0);
  v = await jusqua(vIa, 'realisation', 4);
  assert.strictEqual(v.status, 'realisation');
  v = await jusqua(vIa, 'fabrication', 8);
  assert.strictEqual(v.status, 'fabrication', 'les images IA sont faites, le montage est lancé : ' + JSON.stringify(v.etape));
  const envIa = FALM.envois.slice(avantFal);
  const imgs = envIa.filter((x) => x.modele === 'fal-ai/flux-2/turbo'), anims = envIa.filter((x) => /image-to-video/.test(x.modele));
  assert.strictEqual(imgs.length, 11, '9 images, une refaite après une erreur, une refaite après le filtre');
  assert.strictEqual(anims.length, 1, 'l\'accroche en vidéo : une seule animation');
  assert.ok(FALM.cles.slice(-3).every((k) => k === CLE_FAL), 'fal reçoit SA clé, nettoyée');
  assert.deepStrictEqual(imgs[0].corps.image_size, { width: 1088, height: 1920 }); assert.strictEqual(imgs[0].corps.output_format, 'jpeg');
  assert.ok(/anime illustration/.test(imgs[0].corps.prompt) && /flamingo chick with big curious eyes/.test(imgs[0].corps.prompt) && /no text/.test(imgs[0].corps.prompt), 'la scène, l\'univers, le look et les règles');
  assert.strictEqual(new Set(imgs.map((x) => x.corps.seed)).size, 1, 'la même graine pour toutes les images de la vidéo');
  assert.ok(imgs.some((x) => /tiny pink shrimps/.test(x.corps.prompt)), 'sa retouche part chez fal');
  assert.strictEqual(JSON.parse(imgs[0].cycle).expiration_duration_seconds, 14 * 86400, 'fal garde les fichiers 14 jours');
  assert.strictEqual(anims[0].corps.image_url, 'https://v3.fal.media/files/i/' + imgs[0].id + '.jpg', 'la vidéo part de la première image');
  assert.strictEqual(anims[0].corps.duration, 2.7); assert.strictEqual(anims[0].corps.resolution, '768P'); assert.strictEqual(anims[0].corps.prompt_expansion_mode, 'balanced');
  assert.ok(/slow push-in/.test(anims[0].corps.prompt), 'le mouvement écrit par la plume');
  const cl = v.plan.clips;
  assert.strictEqual(cl.length, 9);
  assert.strictEqual(cl[0].type, 'video'); assert.ok(/^https:\/\/v3b\.fal\.media\//.test(cl[0].url));
  assert.ok(cl.filter((x, i) => i !== 0 && i !== 5).every((x) => x.type === 'image' && /^https:\/\/v3\.fal\.media\//.test(x.url) && x.h === 1920), 'les autres phrases : leur image IA');
  assert.strictEqual(cl[5].type, 'clip'); assert.ok(/^https:\/\/videos\.pexels\.com\//.test(cl[5].url), 'l\'image écartée deux fois : une vidéo d\'illustration à la place');
  assert.ok(v.plan.credits.length >= 1 && /image IA n'a pas pu être faite/.test(v.etape.note || ''), 'la note le dit : ' + v.etape.note);
  assert.ok(!JSON.stringify(v.plan.generation).includes('queue.fal.run'), 'la page ne voit pas les adresses de suivi');
  const coutIaAttendu = 10 * 0.016 + 0.136;
  assert.ok(Math.abs(v.plan.generation.cout - coutIaAttendu) < 1e-6, 'le coût des images IA (onze envoyées, une rendue après son erreur, l\'animation de 2,7 s) : ' + v.plan.generation.cout);
  milaDb = await db.one('hq_createurs', { eq: { id: mila.id } });
  assert.ok(Number(milaDb.couts.jours[C.jourDe(milaDb)]) - depAvant >= coutIaAttendu - 1e-6, 'le budget du jour compte fal');
  assert.ok(v.cout_usd >= coutIaAttendu, 'le coût de la vidéo compte fal');
  u = await appelUsine('GET', { op: 'montage', video: String(vIa), langue: 'en' });
  assert.strictEqual(u.code, 200); assert.deepStrictEqual(u.d.plan.clips.map((x) => x.type), ['video', 'image', 'image', 'image', 'image', 'clip', 'image', 'image', 'image'], 'l\'usine sait ce qu\'est chaque image');

  // « Refaire le montage » : les images et la vidéo sont reprises, seule l'image écartée est retentée
  await db.update('hq_crea_videos', { status: 'prete', rendus: { fr: { etat: 'fini', fichiers: ['video.mp4'] }, en: { etat: 'fini', fichiers: ['video.mp4'] } }, etape: {} }, { eq: { id: vIa } });
  r = await api('POST', { op: 'refaire', id: vIa });
  assert.strictEqual(r.d.video.status, 'realisation');
  const avantRefaire = FALM.envois.length;
  v = await jusqua(vIa, 'fabrication', 5);
  assert.strictEqual(v.status, 'fabrication');
  assert.strictEqual(FALM.envois.length - avantRefaire, 1, 'refaire : une seule image refaite, le reste est repris');
  assert.strictEqual(v.plan.clips[5].type, 'image', 'cette fois, l\'image IA est là'); assert.strictEqual(v.plan.clips[0].type, 'video');

  // une clé refusée met la vidéo en attente ; une nouvelle clé la relance ; plus de crédit : en attente aussi
  r = await api('POST', { op: 'creer', sujet: 'Pourquoi les chats ronronnent', langues: ['fr'] });
  const vIa2 = r.d.video.id;
  await jusqua(vIa2, 'relecture');
  r = await api('POST', { op: 'valider', id: vIa2 });
  assert.strictEqual(r.d.video.status, 'realisation');
  FALM.refuse = true;
  v = (await api('POST', { op: 'avancer', id: vIa2 })).d.video;
  assert.strictEqual(v.etape.bloque, 'fal'); assert.ok(/fal refuse ta clé/.test(v.etape.erreur), v.etape.erreur);
  assert.strictEqual((await api('GET', { op: 'moi' })).d.moi.connexions.fal.etat, 'refusee', 'Réglages le montre sur sa clé');
  FALM.refuse = false;
  await dormir(5);
  await api('POST', { op: 'cle_fal', cle: CLE_FAL });
  FALM.credit = true;
  v = (await api('POST', { op: 'avancer', id: vIa2 })).d.video;
  assert.strictEqual(v.etape.bloque, 'credit_fal', 'nouvelle clé : Lou reprend, mais le compte fal est vide'); assert.ok(/plus de crédit/.test(v.etape.erreur));
  assert.strictEqual((await api('GET', { op: 'moi' })).d.moi.connexions.fal.etat, 'credit');
  FALM.credit = false;
  r = await api('POST', { op: 'sans_ia', id: vIa2 });
  assert.strictEqual(r.code, 200); assert.strictEqual(r.d.video.plan.style, 'clips');
  v = await jusqua(vIa2, 'fabrication', 3);
  assert.strictEqual(v.status, 'fabrication', 'continuer sans images IA : des vidéos d\'illustration');
  assert.ok(v.plan.clips.every((x) => !x || !x.type || x.type === 'clip') && /^https:\/\/videos\.pexels\.com\//.test(v.plan.clips[0].url));
  r = await api('POST', { op: 'sans_ia', id: vIa2 });
  assert.strictEqual(r.code, 400, 'plus rien à changer');

  // le budget du jour trop bas : Lou attend avant d'envoyer quoi que ce soit chez fal
  await api('POST', { op: 'reglages', reglages: { budget_jour: 0.05 } });
  const scriptIa = (await db.one('hq_crea_videos', { eq: { id: vIa } })).script;
  const [vb] = await db.insert('hq_crea_videos', { createur_id: mila.id, status: 'realisation', sujet: 'Le budget', titre: 'Le budget', langue_source: 'fr', langues: ['fr'], script: scriptIa, plan: { style: 'ia', ia: { style: 'aquarelle', mouvement: 'zoom' } }, etape: { quoi: 'images', depuis: new Date().toISOString() }, rendus: {}, traductions: {}, publication: {}, critique: {}, idee: {} });
  const avantBudget = FALM.envois.length;
  v = (await api('POST', { op: 'avancer', id: vb.id })).d.video;
  assert.strictEqual(v.etape.bloque, 'budget'); assert.strictEqual(FALM.envois.length, avantBudget, 'rien n\'est parti chez fal');
  assert.deepStrictEqual(FALM.ailleurs, [], 'la clé fal n\'est jamais partie ailleurs que chez fal');

  // ce que fal répond, lu avec prudence : un résultat rangé autrement, une adresse d'ailleurs, les erreurs traduites
  assert.strictEqual(FAL.lireImage({ response: { images: [{ url: 'https://v3.fal.media/x.jpg' }] } }).url, 'https://v3.fal.media/x.jpg', 'un résultat rangé dans « response » se lit aussi');
  assert.ok(FAL.lireImage({ images: [{ url: 'https://ailleurs.example/x.jpg' }] }).erreur && FAL.lireVideo({ video: { url: 'http://v3.fal.media/x.mp4' } }).erreur, 'un fichier ailleurs que chez fal est refusé');
  assert.strictEqual(FAL.traduire(403, { detail: 'User is locked. Reason: Exhausted balance.' }).code, 'fal_credit');
  assert.strictEqual(FAL.traduire(401, {}).code, 'fal_refusee'); assert.strictEqual(FAL.traduire(503, {}).code, 'fal_surcharge');
  assert.strictEqual(FAL.traduire(422, { detail: [{ msg: 'prompt too long' }] }).definitif, true, 'une demande refusée pour de bon ne se réessaie pas telle quelle');
  assert.ok(/prompt too long/.test(FAL.traduire(422, { detail: [{ msg: 'prompt too long' }] }).message));

  // l'usine : les adresses de fal sont acceptées (et seulement elles) ; l'image IA bouge, la vidéo IA garde sa dernière image
  assert.ok(['https://v3.fal.media/files/i/x.jpg', 'https://fal.media/files/x.mp4', 'https://storage.googleapis.com/falserverless/x.png', 'https://videos.pexels.com/v.mp4'].every((x) => M.adresseAutorisee(new URL(x))), 'fal et les banques');
  assert.ok(['https://evil-fal.media/x.jpg', 'https://fal.media.evil.com/x.jpg', 'https://storage.googleapis.com/autre/x.png', 'http://v3.fal.media/x.jpg', 'https://cdn.vimeocdn.com/x.mp4'].every((x) => !M.adresseAutorisee(new URL(x))), 'aucune autre adresse');
  assert.ok(M.adresseAutorisee(new URL('https://cdn.vimeocdn.com/x.mp4'), true), 'les serveurs des banques, seulement après une redirection');
  assert.strictEqual(new Set([0, 1, 2, 3].map((i) => JSON.stringify(M.kenBurns(i, 120)))).size, 4, 'quatre mouvements d\'image différents');
  const outil = (n) => { try { execFileSync(n, ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } };
  if (outil('ffmpeg') && outil('ffprobe')) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ia-'));
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1088x1920:d=1', '-frames:v', '1', path.join(dir, 'image.jpg')]);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=768x1366:d=2:r=24', '-pix_fmt', 'yuv420p', path.join(dir, 'ia.mp4')]);
      const sonde = (f) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,nb_frames', '-of', 'csv=p=0', f]).toString().trim();
      const a = await M.morceau(dir, 0, { duree: 3.2 }, { fichier: path.join(dir, 'image.jpg'), type: 'image' }, ['111111', '222222']);
      assert.strictEqual(sonde(a), '1080,1920,96', 'l\'image IA devient 3,2 s de vidéo verticale');
      const b2 = await M.morceau(dir, 1, { duree: 3.0 }, { fichier: path.join(dir, 'ia.mp4'), type: 'video' }, ['111111', '222222']);
      assert.strictEqual(sonde(b2), '1080,1920,90', 'la vidéo IA de 2 s tient les 3 s de sa phrase');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  // 25. les clés collées depuis un téléphone : la clé seule est gardée (espaces, retour à la ligne, caractères
  //     invisibles, texte autour) ; chaque refus dit exactement pourquoi ; une clé personnelle sans espace de travail
  //     trouve le sien toute seule, et chaque demande le nomme
  const vraie = 'sk-ant-api03-' + 'Ab1_'.repeat(23) + 'xAA';
  assert.strictEqual(CL.lireCle('Ma clé : ' + vraie.slice(0, 40) + '\u200b\n ' + vraie.slice(40) + '.').cle, vraie, 'la clé seule, sans ce qui traînait autour');
  assert.strictEqual(CL.lireCle(vraie.replace(/-/g, '\u2011')).cle, vraie, 'des tirets insécables redeviennent des traits d\'union');
  assert.ok(/version raccourcie/.test(CL.lireCle('sk-ant-api03-R2D...igAA').erreur), 'la clé raccourcie de la liste des clés');
  assert.ok(CL.lireCle('sk-ant-pk01-' + 'Qq7_'.repeat(20)).cle, 'une clé récente sans « api » dedans passe à l\'essai');
  assert.ok(CL.lireCle('ak_' + 'Mm3'.repeat(20)).cle, 'une clé d\'une autre forme aussi : c\'est Claude qui dira');
  r = await api('POST', { op: 'cle_claude', cle: 'sk-ant-oat01-' + 'x'.repeat(80) });
  assert.strictEqual(r.code, 400); assert.ok(/jeton de connexion/.test(r.d.erreur), 'un jeton de Claude Code n\'est pas une clé : ' + r.d.erreur);
  assert.ok(/20 caractères, commence par « bovq… »/.test(CL.lireCle('bovqi3-fujpu7-hYmzaf').erreur), 'un mot de passe proposé par le téléphone : on dit ce qui a été collé');
  assert.ok(/incomplète/.test(CL.lireCle('sk-ant-api03-abcdef').erreur));
  r = await api('POST', { op: 'cle_claude', cle: 'bovqi3-fujpu7-hYmzaf' });
  assert.strictEqual(r.code, 400); assert.ok(/n'est pas une clé Claude/.test(r.d.erreur));
  const cleSansEspace = 'sk-ant-api03-sans-espace-' + 'Zz9-'.repeat(20) + 'qAA';
  r = await api('POST', { op: 'cle_claude', cle: '  ' + cleSansEspace.slice(0, 50) + '\n' + cleSansEspace.slice(50) + '  ' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(r.d.moi.connexions.claude.fin, 'qAA'.padStart(4, '-'));
  milaDb = await db.one('hq_createurs', { eq: { id: mila.id } });
  assert.strictEqual(milaDb.secrets.claude.espace, 'wrkspc_01Default', 'l\'espace par défaut, trouvé tout seul');
  assert.strictEqual(CL.lireCle(SEC.dechiffrer(milaDb.secrets.claude, 'claude:' + mila.id)).cle, cleSansEspace, 'la clé rangée est la clé nettoyée');
  await api('POST', { op: 'reglages', reglages: { budget_jour: 5 } });
  r = await api('POST', { op: 'idees', theme: 'les flamants' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(CLAUDE.espaces[CLAUDE.espaces.length - 1], 'wrkspc_01Default', 'chaque demande nomme l\'espace de la clé');
  // une clé récente sans « api » dedans, qui ne passe qu'en « Authorization: Bearer » : branchée, et toutes les
  // demandes partent en Bearer
  const clePorteur = 'sk-ant-pk01-porteur-' + 'Hh4_'.repeat(22);
  r = await api('POST', { op: 'cle_claude', cle: clePorteur });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d));
  milaDb = await db.one('hq_createurs', { eq: { id: mila.id } });
  assert.strictEqual(milaDb.secrets.claude.porteur, true, 'le studio a vu qu\'elle ne passe qu\'en Bearer');
  r = await api('POST', { op: 'idees', theme: 'les flamants roses' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(CLAUDE.porteurs[CLAUDE.porteurs.length - 1], true, 'et chaque demande part en Bearer');
  assert.strictEqual(CLAUDE.cles[CLAUDE.cles.length - 1], clePorteur);
  const fal2 = await FAL.essayerCle('  Key 7c1f2a90-4be3-4f60-9d1e-1a2b3c4d5e6f:\u200b0f9e8d7c6b5a49382716abcdef012345\n');
  assert.strictEqual(fal2.cle, CLE_FAL, 'la clé fal aussi, nettoyée');

  // 26. la vidéo d'Emma (15 nov.) : la génération 5.5 refuse l'outil imposé (« tool_choice … not supported for this
  //     model »). Le studio le demande en clair, au même tour, sans jamais passer par l'ancien modèle de repli (fermé
  //     aux comptes récents : « model: claude-sonnet-4-5 ») ; les réponses arrivent en flux ; un modèle fermé au compte
  //     est remplacé par le plus proche que sa clé propose ; la cause première reste lisible ; le temps compte
  await api('POST', { op: 'reglages', reglages: { qualite: 'equilibre', budget_jour: 5 } });
  const OUTIL_T = { name: 'proposer_idees', description: 'Des idées', input_schema: { type: 'object', properties: { idees: { type: 'array', items: { type: 'object', properties: { titre: { type: 'string' } } } } }, required: ['idees'] } };
  const demande = (x) => Object.assign({ usage: 'ecrire', system: 'Tu écris des idées.', prompt: 'Des idées sur les flamants.', outil: OUTIL_T, maxTokens: 3500 }, x || {});
  let milaC = await db.one('hq_createurs', { eq: { id: mila.id } });
  CL.oublier();
  const refus0 = CLAUDE.refusOutil || 0, introuv0 = CLAUDE.introuvables || 0, n0 = CLAUDE.appels.length;
  let sortieT = await CL.appeler(db, milaC, demande({ maxTokens: 8000 }));
  assert.strictEqual(sortieT.sortie.idees.length, 5, 'le travail est rendu');
  assert.strictEqual(CLAUDE.refusOutil, refus0 + 1, 'un seul refus, puis l\'outil demandé en clair');
  assert.strictEqual(CLAUDE.introuvables || 0, introuv0, 'jamais l\'ancien modèle de repli');
  assert.strictEqual(sortieT.modele, 'claude-sonnet-5-5');
  assert.strictEqual(CLAUDE.appels.length, n0 + 1, 'un seul appel payé');
  assert.ok(CLAUDE.appels[n0].enClair && CLAUDE.appels[n0].flux, 'demandé en clair, réponse en flux');
  assert.ok(!CLAUDE.appels.some((x) => /4-5/.test(x.model)), 'aucun appel à un modèle 4.5');
  sortieT = await CL.appeler(db, milaC, demande());
  assert.strictEqual(CLAUDE.refusOutil, refus0 + 1, 'retenu : plus de refus pour ce modèle');
  // un tour où le modèle parle sans remplir l'outil : on le lui redemande
  CLAUDE.texteSeul = true;
  let n1 = CLAUDE.appels.length;
  sortieT = await CL.appeler(db, milaC, demande());
  assert.strictEqual(CLAUDE.appels.length, n1 + 2, 'un tour de texte, puis l\'outil');
  assert.ok(/Appelle maintenant l'outil proposer_idees/.test(texteDe(CLAUDE.corps.messages[2].content)) && sortieT.sortie.idees.length === 5);
  // une réponse coupée par la longueur en plein outil : refaite avec plus de place
  CLAUDE.coupe = true;
  n1 = CLAUDE.appels.length;
  sortieT = await CL.appeler(db, milaC, demande());
  assert.strictEqual(CLAUDE.appels.length, n1 + 2); assert.strictEqual(CLAUDE.appels[n1 + 1].max_tokens, 7000, 'relancée avec deux fois plus de place');
  assert.strictEqual(sortieT.sortie.idees.length, 5);
  // un compte où le modèle moyen n'est pas ouvert : le plus récent de la même famille que sa clé propose, compté au prix prudent
  const cleFermee = 'sk-ant-api03-compte-ferme-' + 'Rr5_'.repeat(20) + 'kAA';
  r = await api('POST', { op: 'cle_claude', cle: cleFermee });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d));
  milaC = await db.one('hq_createurs', { eq: { id: mila.id } });
  sortieT = await CL.appeler(db, milaC, demande());
  assert.strictEqual(sortieT.modele, 'claude-sonnet-5', 'remplacé par le Sonnet le plus récent de sa liste : ' + sortieT.modele);
  assert.ok(Math.abs(sortieT.cout - (4000 * 3 + 1500 * 15) / 1e6) < 1e-9, 'au prix prudent d\'un Sonnet : ' + sortieT.cout);
  assert.strictEqual(CL.modeleNomme('claude-opus-5-5', 'genius').out, 20, 'un modèle prévu garde son prix');
  // un compte où rien ne passe : la cause première d'abord, celle du remplaçant ensuite
  const cleVide = 'sk-ant-api03-compte-vide-' + 'Vv6_'.repeat(20) + 'mAA';
  r = await api('POST', { op: 'cle_claude', cle: cleVide });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d));
  milaC = await db.one('hq_createurs', { eq: { id: mila.id } });
  await assert.rejects(CL.appeler(db, milaC, demande()), (e) => e.code === 'claude' && /refusé la demande : claude-sonnet-5-5 : model: claude-sonnet-5-5 ; claude-sonnet-5 : model: claude-sonnet-5/.test(e.message), 'la cause première reste lisible');
  // le temps : moins de 30 secondes avant la coupure de la fonction, rien n'est demandé ; dans la chaîne, le passage
  // suivant reprend sans compter d'essai
  r = await api('POST', { op: 'cle_claude', cle: vraie });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d));
  milaC = await db.one('hq_createurs', { eq: { id: mila.id } });
  const n3 = CLAUDE.appels.length;
  const bientot = () => Date.now() + 10000;
  await assert.rejects(CL.avecEcheance(bientot(), () => CL.appeler(db, milaC, demande())), (e) => e.code === 'temps');
  assert.strictEqual(CLAUDE.appels.length, n3, 'rien de demandé, rien de payé');
  const vt = await CH.creer(db, milaC, { sujet: 'Les flamants dorment sur une patte', langues: ['fr'], format: 'court', style: 'clips' });
  assert.ok(vt.video, JSON.stringify(vt));
  // deux requêtes en même temps : chacune garde son heure de coupure
  await Promise.all([CL.avecEcheance(bientot(), () => CH.avancer(db, mila.id, vt.video.id)), CL.avecEcheance(Date.now() + 280000, () => dormir(5))]);
  let vtDb = await db.one('hq_crea_videos', { eq: { id: vt.video.id } });
  assert.ok(vtDb.status === 'ecriture' && !vtDb.etape.erreur && !vtDb.etape.essais && vtDb.etape.attendre_jusqu, 'reprise au passage suivant, sans essai compté : ' + JSON.stringify(vtDb.etape));
  await db.update('hq_crea_videos', { etape: Object.assign({}, vtDb.etape, { attendre_jusqu: null }) }, { eq: { id: vt.video.id } });
  await CH.avancer(db, mila.id, vt.video.id);
  vtDb = await db.one('hq_crea_videos', { eq: { id: vt.video.id } });
  assert.ok(vtDb.script && vtDb.script.beats && vtDb.status === 'ecriture' && vtDb.etape.quoi === 'critique', 'puis le script s\'écrit : ' + vtDb.status + ' ' + JSON.stringify(vtDb.etape));

  // 27. les voix naturelles et les images qui collent (16 nov.). Avec sa clé fal, chaque phrase de chaque langue est
  //     dite par une voix d'ElevenLabs (Eleven v4) ; l'usine reçoit un fichier par phrase ; une langue dont une phrase
  //     rate deux fois prend la voix gratuite en entier ; « Refaire le montage » ne repaie rien. Lou choisit parmi
  //     plusieurs vidéos par phrase, crée une image là où aucune ne montre la phrase ; elle écoute une voix avant de
  //     choisir ; une vidéo bloquée par fal continue avec la voix gratuite.
  r = await api('POST', { op: 'reglages', reglages: { voix_ia: { actif: true, voix: 'Brian' }, langues: ['fr', 'en'], budget_jour: 5, style: 'clips' } });
  assert.strictEqual(r.code, 200); assert.deepStrictEqual(r.d.moi.reglages.voix_ia, { actif: true, voix: 'Brian' });
  assert.ok(r.d.moi.depense.estime_voix > 0 && r.d.moi.depense.estime_video > r.d.moi.depense.estime_voix, 'la voix est comptée dans le coût d\'une vidéo : ' + JSON.stringify(r.d.moi.depense));
  r = await api('POST', { op: 'reglages', reglages: { voix_ia: { voix: 'Personne' } } });
  assert.strictEqual(r.d.moi.reglages.voix_ia.voix, 'Brian', 'une voix inconnue ne passe pas');
  const catV = (await api('GET', { op: 'etat' })).d.catalogue;
  assert.ok(catV.voix_ia && catV.voix_ia.voix.Jessica && catV.voix_ia.couts.court > 0 && catV.voix_ia.couts.long > catV.voix_ia.couts.court, 'la page connaît les voix et leur prix');
  // écouter une voix : une phrase dans sa langue, sur sa clé fal, comptée sur son budget
  const depEcoute = (await db.one('hq_createurs', { eq: { id: mila.id } })).couts.total;
  let nVoix = FALM.voix.length;
  r = await api('POST', { op: 'ecouter_voix', voix: 'Lily', langue: 'fr' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.ok(/^https:\/\/v3\.fal\.media\//.test(r.d.url));
  const ec = FALM.voix[nVoix];
  assert.strictEqual(FALM.voix.length, nVoix + 1); assert.strictEqual(ec.modele, 'elevenlabs/tts/eleven-v4');
  assert.strictEqual(ec.corps.voice, 'Lily'); assert.strictEqual(ec.corps.language_code, 'fr'); assert.ok(/raconterai/.test(ec.corps.text) && ec.cycle, 'la phrase d\'écoute, gardée 14 jours');
  assert.ok((await db.one('hq_createurs', { eq: { id: mila.id } })).couts.total > depEcoute, 'l\'écoute est comptée');
  assert.strictEqual((await api('POST', { op: 'ecouter_voix', voix: 'Personne', langue: 'fr' })).code, 400);
  // une vidéo : Lou trouve la phrase 3 hors sujet (une image est créée), une phrase anglaise rate deux fois
  r = await api('POST', { op: 'creer', sujet: 'Comment se forme le caca', langues: ['fr', 'en'], format: 'court', style: 'clips' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d));
  const vVoix = r.d.video.id;
  let vv = await jusqua(vVoix, 'relecture');
  assert.strictEqual(vv.status, 'relecture');
  r = await api('POST', { op: 'valider', id: vVoix });
  CLAUDE.horsSujet = [3];
  FALM.voixRatees['English sentence 4 '] = 2;
  nVoix = FALM.voix.length;
  const nDirectes = FALM.directes.length;
  vv = await jusqua(vVoix, 'fabrication');
  CLAUDE.horsSujet = [];
  assert.strictEqual(vv.status, 'fabrication', 'montage lancé : ' + JSON.stringify(vv.etape));
  const nFr = vv.script.beats.length, nEn = vv.traductions.en.beats.length;
  const dites = FALM.voix.slice(nVoix);
  assert.strictEqual(dites.filter((x) => x.corps.language_code === 'fr').length, nFr, 'chaque phrase française dite une fois');
  assert.ok(dites.every((x) => x.corps.voice === 'Brian' && x.modele === 'elevenlabs/tts/eleven-v4' && !/\*/.test(x.corps.text) && x.corps.seed === dites[0].corps.seed), 'sa voix, sans les étoiles, la même graine');
  assert.strictEqual(dites.filter((x) => /English sentence 4 /.test(x.corps.text)).length, 2, 'la phrase ratée : deux essais');
  assert.deepStrictEqual(vv.plan.voix_ia.langues.fr, { etat: 'fini', faites: nFr, total: nFr }); assert.strictEqual(vv.plan.voix_ia.langues.en.etat, 'echec');
  assert.ok(!JSON.stringify(vv.plan.voix_ia).includes('fal.media'), 'la page ne voit pas les fichiers de voix');
  // les images : la phrase 3 n'avait pas de bonne vidéo, une image a été créée pour elle sur sa clé fal
  assert.strictEqual(FALM.directes.length, nDirectes + 1, 'une image créée');
  assert.ok(/stomach/.test(FALM.directes[nDirectes].corps.prompt) && /no text/.test(FALM.directes[nDirectes].corps.prompt));
  assert.strictEqual(vv.plan.clips[2].type, 'image'); assert.ok(/^https:\/\/v3\.fal\.media\//.test(vv.plan.clips[2].url));
  assert.ok(vv.plan.clips.filter((x, i) => i !== 2).every((x) => x && /^https:\/\/videos\.pexels\.com\//.test(x.url)), 'les autres phrases : une vidéo choisie par Lou');
  assert.ok(/1 image créée/.test(vv.etape.note || ''), vv.etape.note);
  const ch = CLAUDE.choix[CLAUDE.choix.length - 1];
  assert.ok(/PHRASE 3 :/.test(ch.prompt) && /la plume voulait montrer/.test(ch.prompt), 'Lou voit chaque phrase et ce que la plume voulait montrer');
  assert.ok(CLAUDE.appels.filter((x) => x.outil === 'choisir_images').pop().model === 'claude-haiku-5-5', 'le petit modèle choisit les images');
  // l'usine : les fichiers de chaque phrase en français, la voix gratuite en anglais
  let uc = await appelUsine('GET', { op: 'montage', video: String(vVoix), langue: 'fr' });
  assert.strictEqual(uc.code, 200, JSON.stringify(uc.d));
  assert.strictEqual(uc.d.voix.moteur, 'fichiers'); assert.strictEqual(uc.d.voix.fichiers.length, uc.d.texte.beats.length);
  assert.ok(uc.d.voix.fichiers.every((x) => /^https:\/\/v3\.fal\.media\/files\/a\//.test(x)) && uc.d.voix.secours.moteur === 'kokoro', 'la voix naturelle, avec la voix gratuite en secours');
  uc = await appelUsine('GET', { op: 'montage', video: String(vVoix), langue: 'en' });
  assert.strictEqual(uc.d.voix.moteur, 'kokoro', 'la langue ratée : la voix gratuite en entier');
  // « Refaire le montage » : rien n'est redit (même texte, même voix, récent) ; l'anglais retente
  await db.update('hq_crea_videos', { status: 'prete', rendus: { fr: { etat: 'fini', fichiers: ['video.mp4'] }, en: { etat: 'fini', fichiers: ['video.mp4'] } }, etape: {} }, { eq: { id: vVoix } });
  nVoix = FALM.voix.length;
  r = await api('POST', { op: 'refaire', id: vVoix });
  assert.strictEqual(r.d.video.status, 'realisation');
  vv = await jusqua(vVoix, 'fabrication');
  const redites = FALM.voix.slice(nVoix);
  assert.ok(redites.length === 1 && /English sentence 4 /.test(redites[0].corps.text), 'refaire : seule la phrase anglaise ratée est redite, le reste est repris (' + redites.length + ' sur ' + (nFr + nEn) + ')');
  assert.strictEqual(vv.plan.voix_ia.langues.en.etat, 'fini');
  // fal refuse sa clé pendant les voix : la vidéo attend ; elle continue avec la voix gratuite
  r = await api('POST', { op: 'creer', sujet: 'Pourquoi on baille', langues: ['fr'], format: 'court', style: 'clips' });
  const vBloc = r.d.video.id;
  await jusqua(vBloc, 'relecture');
  await api('POST', { op: 'valider', id: vBloc });
  FALM.refuse = true;
  vv = await jusqua(vBloc, ['fabrication', 'realisation'], 3);
  assert.strictEqual(vv.etape.bloque, 'fal', 'clé refusée pendant les voix : en attente ' + JSON.stringify(vv.etape));
  FALM.refuse = false;
  nVoix = FALM.voix.length;
  r = await api('POST', { op: 'sans_ia', id: vBloc });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(r.d.video.plan.style, 'clips');
  vv = await jusqua(vBloc, 'fabrication', 3);
  assert.strictEqual(vv.status, 'fabrication'); assert.strictEqual(FALM.voix.length, nVoix, 'avec la voix gratuite : plus rien chez fal');
  uc = await appelUsine('GET', { op: 'montage', video: String(vBloc), langue: 'fr' });
  assert.strictEqual(uc.d.voix.moteur, 'kokoro');
  assert.strictEqual((await api('POST', { op: 'sans_ia', id: vBloc })).code, 400, 'plus rien à changer');
  await api('POST', { op: 'cle_fal', cle: CLE_FAL });
  // voix naturelles coupées : la voix gratuite, rien chez fal
  r = await api('POST', { op: 'reglages', reglages: { voix_ia: { actif: false } } });
  assert.strictEqual(r.d.moi.reglages.voix_ia.actif, false); assert.strictEqual(r.d.moi.depense.estime_voix, 0);
  r = await api('POST', { op: 'creer', sujet: 'Pourquoi le chat ronronne', langues: ['fr'], format: 'court', style: 'texte' });
  const vSans = r.d.video.id;
  await jusqua(vSans, 'relecture');
  await api('POST', { op: 'valider', id: vSans });
  nVoix = FALM.voix.length;
  vv = await jusqua(vSans, 'fabrication');
  assert.strictEqual(vv.status, 'fabrication'); assert.strictEqual(FALM.voix.length, nVoix, 'voix naturelles coupées : rien chez fal');
  await api('POST', { op: 'reglages', reglages: { voix_ia: { actif: true } } });

  // 28. la messagerie (16 nov.) : Louis et chaque créatrice s'écrivent dans l'appli, en direct ; des fichiers dans les
  //     deux sens, envoyés droit dans le stockage (l'espace « messages ») ; une vidéo prête de son studio ; le compteur
  //     des non lus ; le « vu » ; Louis prévenu une fois par série de messages ; chacune ne voit que sa conversation ;
  //     les fichiers partent après 60 jours
  const MSG = require('../lib/createurs/messages');
  const alertesAvant = (await db.select('hq_messages', { eq: { to_id: 'louis', kind: 'alerte' } })).length;
  r = await api('POST', { op: 'message', texte: 'Coucou Louis ! Tu peux regarder ma dernière vidéo ?' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d)); assert.strictEqual(r.d.message.auteur, 'createur');
  let alertes = await db.select('hq_messages', { eq: { to_id: 'louis', kind: 'alerte' }, order: 'id.desc' });
  assert.strictEqual(alertes.length, alertesAvant + 1, 'Louis prévenu dans la tour'); assert.ok(/Mila t'a écrit/.test(alertes[0].subject) && /dernière vidéo/.test(alertes[0].body));
  r = await api('POST', { op: 'message', texte: 'Et une question sur les hashtags.' });
  assert.strictEqual((await db.select('hq_messages', { eq: { to_id: 'louis', kind: 'alerte' } })).length, alertesAvant + 1, 'pas prévenu deux fois pour la même série');
  const deuxiemeElle = r.d.message.id;
  // Louis : le compteur dans la tour, la conversation, ses messages à elle passent en lus
  let tour = await ADM.agir(db, 'crea_liste', {});
  assert.strictEqual(tour.createurs.find((x) => x.id === mila.id).messages_non_lus, 2, 'le compteur de Louis');
  let conv = await ADM.agir(db, 'crea_messages', { id: mila.id, lire: true });
  assert.strictEqual(conv.prenom, 'Mila'); assert.strictEqual(conv.messages.length, 2); assert.strictEqual(conv.non_lus, 0);
  assert.strictEqual((await ADM.agir(db, 'crea_liste', {})).createurs.find((x) => x.id === mila.id).messages_non_lus, 0);
  let vueElle = await api('GET', { op: 'messages' });
  assert.strictEqual(vueElle.d.vu_jusqua, deuxiemeElle, 'elle voit que Louis a lu');
  // Louis répond avec une vidéo de son téléphone : le lien d'envoi, le fichier qui arrive, le message
  const env = await ADM.agir(db, 'crea_message_envoi', { id: mila.id, nom: 'Mon exemple TikTok.MOV', type: 'video/quicktime', taille: 30 * 1048576 });
  assert.ok(new RegExp('^conv/' + mila.id + '/\\d{6}/[a-f0-9]{12}-mon-exemple-tiktok\\.mov$').test(env.chemin), env.chemin);
  assert.ok(/\/object\/upload\/sign\/messages\/conv\//.test(env.url) && env.type === 'video/quicktime', 'un lien d\'envoi droit vers l\'espace « messages »');
  const piece = { chemin: env.chemin, nom: 'Mon exemple TikTok.MOV', type: 'video/quicktime', taille: 30 * 1048576 };
  await assert.rejects(ADM.agir(db, 'crea_message', { id: mila.id, texte: 'Regarde', pieces: [piece] }), /pas arrivé/, 'un fichier pas arrivé est refusé');
  STOCK.arrives.add(env.chemin);
  const rep = await ADM.agir(db, 'crea_message', { id: mila.id, texte: 'Regarde cet exemple : https://www.tiktok.com/@exemple', pieces: [piece] });
  assert.strictEqual(rep.message.auteur, 'louis'); assert.strictEqual(rep.message.pieces[0].genre, 'video');
  assert.ok(/\/object\/sign\/messages\/conv\//.test(rep.message.pieces[0].url), 'lu par un lien signé');
  assert.ok(!JSON.stringify(rep.message).includes('"chemin"'), 'la page ne voit jamais le chemin des fichiers');
  // elle : le compteur, puis la conversation ouverte ; le direct ne rend que le nouveau
  assert.strictEqual((await api('GET', { op: 'messages_etat' })).d.non_lus, 1);
  assert.strictEqual((await api('GET', { op: 'etat' })).d.moi.messages_non_lus, 1, 'le compteur est là dès l\'ouverture du studio');
  vueElle = await api('GET', { op: 'messages', lire: '1' });
  assert.strictEqual(vueElle.d.messages.length, 3); assert.strictEqual(vueElle.d.non_lus, 0);
  assert.strictEqual((await api('GET', { op: 'messages_etat' })).d.non_lus, 0);
  assert.strictEqual((await ADM.agir(db, 'crea_messages', { id: mila.id })).vu_jusqua, rep.message.id, 'Louis voit qu\'elle a lu');
  const apresTout = vueElle.d.messages[2].id;
  assert.strictEqual((await api('GET', { op: 'messages', apres: String(apresTout), lire: '1' })).d.messages.length, 0, 'rien de neuf');
  // elle envoie une photo et sa vidéo du studio, prête en français
  const envP = await api('POST', { op: 'message_envoi', nom: 'Écran.PNG', type: 'image/png', taille: 2e5 });
  assert.strictEqual(envP.code, 200, JSON.stringify(envP.d)); STOCK.arrives.add(envP.d.chemin);
  await db.update('hq_crea_videos', { status: 'prete', rendus: { fr: { etat: 'fini', fichiers: ['video.mp4', 'vignette.jpg'] } } }, { eq: { id: vVoix } });
  r = await api('POST', { op: 'message', texte: 'Voilà ma vidéo, et une capture.', pieces: [{ chemin: envP.d.chemin, nom: 'Écran.PNG', type: 'image/png', taille: 2e5 }], video: { id: vVoix, langue: 'fr' } });
  assert.strictEqual(r.code, 200, JSON.stringify(r.d));
  assert.deepStrictEqual(r.d.message.pieces.map((p) => p.genre), ['image', 'studio']);
  const ps = r.d.message.pieces[1];
  assert.ok(/\/object\/sign\/studio\/crea\/\d+\/\d+\/fr\/video\.mp4/.test(ps.url) && /vignette\.jpg/.test(ps.vignette) && ps.langue === 'fr', 'sa vidéo du studio, lisible par Louis');
  assert.strictEqual((await api('POST', { op: 'message', video: { id: vVoix, langue: 'de' } })).code, 400, 'une langue pas prête');
  assert.strictEqual((await db.select('hq_messages', { eq: { to_id: 'louis', kind: 'alerte' } })).length, alertesAvant + 2, 'une nouvelle série : Louis prévenu');
  // ce qui ne passe pas
  assert.strictEqual((await api('POST', { op: 'message_envoi', nom: 'virus.exe', type: 'application/x-msdownload', taille: 1000 })).code, 400);
  assert.strictEqual((await api('POST', { op: 'message_envoi', nom: 'gros.mp4', type: 'video/mp4', taille: 300 * 1048576 })).code, 400, '200 Mo au plus');
  r = await api('POST', { op: 'message', texte: 'x', pieces: [{ chemin: 'conv/999/202611/aaaaaaaaaaaa-x.mp4', nom: 'x.mp4', type: 'video/mp4' }] });
  assert.strictEqual(r.code, 400, 'un fichier d\'une autre conversation est refusé');
  assert.strictEqual((await api('POST', { op: 'message', texte: '   ' })).code, 400, 'un message vide');
  assert.strictEqual((await api('POST', { op: 'message', texte: 'Coucou' }, { origine: 'https://ailleurs.example' })).code, 403, 'seulement depuis la page du studio');
  // par la tour : les mêmes opérations passent par les actions de Louis (lib/actions.js)
  assert.strictEqual((await require('../lib/actions').agir('crea_messages', { id: mila.id })).messages.length, 4, 'la tour lit la conversation');
  // chacune ne voit que sa conversation
  assert.strictEqual((await MSG.lister(db, lea.id, 'createur')).messages.length, 0, 'Léa ne voit rien de la conversation de Mila');
  const vueLea = await api('GET', { op: 'messages' }, { cookie: coLea, garder: false });
  assert.ok(vueLea.code !== 200 || !vueLea.d.messages.some((m) => /Coucou Louis/.test(m.texte)), 'pas même par sa session');
  // le ménage : après 60 jours, le fichier part, le texte et le nom restent
  await db.update('hq_crea_messages', { created_at: new Date(Date.now() - 61 * 86400000).toISOString() }, { eq: { id: rep.message.id } });
  assert.strictEqual(await MSG.menage(db), 1); assert.ok(STOCK.msgEffaces.indexOf(env.chemin) >= 0);
  const pm = (await api('GET', { op: 'messages' })).d.messages.find((m) => m.id === rep.message.id);
  assert.ok(pm.texte && pm.pieces[0].expire && !pm.pieces[0].url && pm.pieces[0].nom === 'Mon exemple TikTok.MOV', 'le texte et le nom du fichier restent');

  console.log('Studio des créatrices : tout passe (' + CLAUDE.appels.length + ' appels Claude simulés, ' + GH.montages.length + ' montages, ' + UP.envois.length + ' publication, ' + FALM.envois.length + ' demandes à fal, phrases dites : ' + FALM.voix.length + ', images créées : ' + FALM.directes.length + ').');
})().catch((e) => { console.error(e); process.exit(1); });
