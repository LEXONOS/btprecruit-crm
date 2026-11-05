// L'usine : fabrique une vidéo dans une langue, de bout en bout.
//   1. la voix (Kokoro) et le son (musique et bruitages maison), chronométrés phrase par phrase et mot par mot
//   2. le rendu 3D calé sur la voix (rendre.js), avec les sous-titres, l'accroche et les étiquettes dans la langue
//   3. le montage final (son normalisé à -14 LUFS, comme le veulent TikTok et YouTube), la vignette, les images clés
//   4. en production : l'envoi des fichiers dans le stockage de la tour et le compte rendu à la tour
//
// En local :      node produire.js --fichier exemples/clim.json --langue fr --sortie /tmp/clim
// Sur l'usine :   node produire.js --video 12 --langue fr        (variables HQ_TOUR et HQ_USINE_SECRET)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { rendre } = require('./rendre');
const LANGUES = require('./langues.json');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const journal = (...x) => console.log('[usine]', ...x);

function lancer(cmd, args, entree, opts) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, Object.assign({ stdio: ['pipe', 'pipe', 'pipe'] }, opts || {}));
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', ko);
    p.on('close', (c) => (c === 0 ? ok(out) : ko(new Error(cmd + ' : ' + (err || out).slice(-600)))));
    if (entree != null) p.stdin.end(entree); else p.stdin.end();
  });
}

// les textes d'une langue : la langue source vient du script, les autres de la traduction de Nina
function textesPour(prod, langue) {
  const source = prod.langue_source || 'en';
  const s = prod.script || {};
  const plans = (prod.scene && prod.scene.plans) || [];
  if (langue === source) return { langue, accroche: s.accroche, beats: (s.beats || []).map((b, i) => ({ voix: b.voix, ecran: b.ecran || null, etiquettes: (plans[i] && plans[i].etiquettes) || [] })) };
  const t = (prod.langues || {})[langue];
  if (!t || !Array.isArray(t.beats) || t.beats.length !== (s.beats || []).length) throw new Error('traduction ' + langue + ' absente ou incomplète');
  return { langue, accroche: t.accroche || s.accroche, beats: t.beats.map((b, i) => ({ voix: b.voix, ecran: b.ecran || null, etiquettes: b.etiquettes || (plans[i] && plans[i].etiquettes) || [] })) };
}

// les mots d'une phrase, avec les mots forts (*mot* ou *plusieurs mots*) : la voix les dit sans étoiles, l'écran les
// met en couleur et la caméra donne un coup de zoom dessus
function motsForts(voix) {
  let ouvert = false;
  return String(voix || '').split(/\s+/).filter(Boolean).map((w) => {
    const n = (w.match(/\*/g) || []).length;
    const fort = ouvert || n > 0;
    if (n % 2) ouvert = !ouvert;
    return { m: w.replace(/\*/g, ''), fort };
  }).filter((x) => x.m);
}

function srt(segments) {
  const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(ms % 1000).padStart(3, '0'); };
  let n = 0, out = '';
  segments.forEach((sg) => {
    const mots = sg.mots || [];
    for (let i = 0; i < mots.length; i += 7) { const g = mots.slice(i, i + 7); out += (++n) + '\n' + ts(g[0].t0) + ' --> ' + ts(g[g.length - 1].t1) + '\n' + g.map((m) => m.m).join(' ') + '\n\n'; }
  });
  return out;
}

async function produire(prod, langue, sortie, options) {
  options = options || {};
  fs.mkdirSync(sortie, { recursive: true });
  const L = Object.assign({}, LANGUES[langue] || LANGUES.en, options.voix || {});
  const textes = textesPour(prod, langue);
  const t0 = Date.now();
  // 1. la voix
  const modeles = process.env.KOKORO_DIR || path.join(__dirname, '.modeles');
  const forts = textes.beats.map((b) => motsForts(b.voix));
  const commande = { langue: L.kokoro, voix: L.voix, vitesse: L.vitesse || 1.0, segments: forts.map((f) => f.map((x) => x.m).join(' ')), sortie, modele: path.join(modeles, 'kokoro-v1.0.onnx'), voix_fichier: path.join(modeles, 'voices-v1.0.bin'), debut: 0.3, ecart: 0.34, fin: 1.0, duree_min: options.dureeMin != null ? options.dureeMin : 61.5, musique: options.musique !== false, graine: (prod.id || 7), etiquettes: textes.beats.map((b) => Math.min(3, (b.etiquettes || []).length)) };
  const res = await lancer(process.env.PYTHON || 'python3', [path.join(__dirname, 'voix.py')], JSON.stringify(commande));
  const temps = JSON.parse(fs.readFileSync(path.join(sortie, 'temps.json'), 'utf8'));
  journal(langue, 'voix', res.trim(), Math.round((Date.now() - t0) / 1000) + ' s');
  // 2. le rendu calé sur la voix : chaque plan commence un peu avant sa phrase (la caméra arrive, puis on parle)
  const segs = temps.segments;
  segs.forEach((sg, i) => (sg.mots || []).forEach((m, j) => { if (forts[i] && forts[i][j] && forts[i][j].fort) m.fort = true; }));
  const plansT = segs.map((s, i) => ({ debut: i === 0 ? 0 : Math.max(0, s.debut - 0.35), fin: i < segs.length - 1 ? Math.max(0, segs[i + 1].debut - 0.35) : temps.duree }));
  const spec = {
    largeur: 1080, hauteur: 1920, fps: 30, qualite: Object.assign({ echelle: 0.75, msaa: 4, bloom: true, ombre: 1024 }, options.qualite || {}),
    scene: prod.scene, style: Object.assign({}, options.style || {}),
    textes: { langue, accroche: textes.accroche, beats: textes.beats.map((b, i) => ({ voix: commande.segments[i], ecran: b.ecran, etiquettes: b.etiquettes, mots: segs[i].mots })) },
    temps: plansT, duree: temps.duree
  };
  // les images clés pour Vera : juste après l'accroche, puis sept plans répartis sur toute la vidéo
  const cles = [Math.min(temps.duree - 0.3, segs[0].fin + 0.6)];
  const pris = new Set();
  for (let k = 0; k < 7 && segs.length > 1; k++) { const i = Math.min(segs.length - 1, Math.round(1 + (segs.length - 2) * k / 6)); if (!pris.has(i)) { pris.add(i); cles.push(Math.min(temps.duree - 0.2, (segs[i].debut + segs[i].fin) / 2 + 0.3)); } }
  const muette = path.join(sortie, 'muette.mp4');
  const r = await rendre(spec, muette, { images: cles, vignette: Math.min(1.2, segs[0].fin), progres: (i, n, ms) => { if (i % 300 === 0) journal(langue, 'rendu', i + '/' + n, Math.round(ms / 1000) + ' s'); } });
  journal(langue, 'rendu fini', r.frames + ' images en ' + r.secondes + ' s');
  // 3. le montage : la vidéo et le son, normalisé à -14 LUFS
  const finale = path.join(sortie, 'video.mp4');
  await lancer(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', muette, '-i', path.join(sortie, 'son.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', finale]);
  fs.unlinkSync(muette);
  fs.writeFileSync(path.join(sortie, 'sous-titres.srt'), srt(segs));
  const taille = fs.statSync(finale).size;
  journal(langue, 'vidéo prête', (taille / 1048576).toFixed(1) + ' Mo', temps.duree + ' s', Math.round((Date.now() - t0) / 1000) + ' s au total');
  return { video: finale, vignette: r.vignette, images: r.images, srt: path.join(sortie, 'sous-titres.srt'), duree: temps.duree, taille, secondes: Math.round((Date.now() - t0) / 1000), avertissements: r.avertissements };
}

/* ── le lien avec la tour ── */
async function tour(op, corps, methode) {
  const base = String(process.env.HQ_TOUR || '').replace(/\/$/, '');
  const secret = String(process.env.HQ_USINE_SECRET || '');
  if (!base || !secret) throw new Error('HQ_TOUR et HQ_USINE_SECRET sont nécessaires');
  const h = { 'x-usine': secret, 'content-type': 'application/json', 'user-agent': 'la-tour-usine' };
  if (process.env.HQ_BYPASS) h['x-vercel-protection-bypass'] = process.env.HQ_BYPASS;
  const url = base + '/api/usine' + (methode === 'GET' ? '?' + new URLSearchParams(Object.assign({ op }, corps)).toString() : '');
  let derniere;
  for (let essai = 0; essai < 4; essai++) {
    try {
      const r = await fetch(url, { method: methode || 'POST', headers: h, body: methode === 'GET' ? undefined : JSON.stringify(Object.assign({ op }, corps)), signal: AbortSignal.timeout(60000) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return d;
      if (r.status < 500 && r.status !== 429) throw Object.assign(new Error('tour : ' + (d.erreur || d.error || r.status)), { definitif: true });
      derniere = new Error('tour : HTTP ' + r.status);
    } catch (e) { if (e.definitif) throw e; derniere = e; }
    await new Promise((ok) => setTimeout(ok, 3000 * (essai + 1)));
  }
  throw derniere;
}
async function televerser(url, fichier, type) {
  const corps = fs.readFileSync(fichier);
  for (let essai = 0; essai < 3; essai++) {
    const r = await fetch(url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'true' }, body: corps, signal: AbortSignal.timeout(300000) }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
    if (r.ok) return;
    if (essai === 2) throw new Error('envoi de ' + path.basename(fichier) + ' refusé : ' + r.status + ' ' + String(await r.text()).slice(0, 200));
    await new Promise((ok) => setTimeout(ok, 4000));
  }
}

async function principal() {
  const langue = arg('langue', 'en');
  if (arg('fichier')) {
    const prod = JSON.parse(fs.readFileSync(arg('fichier'), 'utf8'));
    const sortie = arg('sortie', path.join(os.tmpdir(), 'usine-' + langue));
    const r = await produire(prod, langue, sortie, { qualite: arg('echelle') ? { echelle: Number(arg('echelle')) } : undefined });
    console.log(JSON.stringify(r, null, 1));
    return;
  }
  const video = arg('video');
  if (!video) throw new Error('--video ou --fichier');
  const c = await tour('commande', { video, langue }, 'GET');
  const sortie = path.join(os.tmpdir(), 'usine-' + video + '-' + langue);
  let r;
  try {
    r = await produire(c.production, langue, sortie, { voix: c.voix, style: c.style, qualite: c.qualite });
  } catch (e) {
    await tour('fini', { video, langue, ok: false, erreur: String(e.message || e).slice(0, 900), jeton: c.jeton }).catch(() => null);
    throw e;
  }
  const fichiers = [['video.mp4', r.video, 'video/mp4'], ['vignette.jpg', r.vignette, 'image/jpeg'], ['sous-titres.srt', r.srt, 'application/x-subrip']].concat(r.images.map((f, k) => ['cle-' + (k + 1) + '.jpg', f, 'image/jpeg']));
  const urls = await tour('televerser', { video, langue, jeton: c.jeton, fichiers: fichiers.map((f) => ({ nom: f[0], type: f[2], taille: fs.statSync(f[1]).size })) });
  for (const f of fichiers) { const u = (urls.urls || {})[f[0]]; if (!u) throw new Error('pas d\'adresse d\'envoi pour ' + f[0]); await televerser(u, f[1], f[2]); }
  await tour('fini', { video, langue, ok: true, jeton: c.jeton, duree: r.duree, taille: r.taille, secondes: r.secondes, fichiers: fichiers.map((f) => f[0]), avertissements: r.avertissements });
  journal('envoyé à la tour');
}

if (require.main === module) principal().catch((e) => { console.error('[usine] échec :', e.message || e); process.exit(1); });

module.exports = { produire, textesPour, srt, motsForts };
