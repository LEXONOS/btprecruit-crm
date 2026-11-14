// L'usine du studio des créatrices : monte une vidéo verticale (1080 x 1920, 30 images/s) dans une langue, de bout en bout.
//   1. la voix (Kokoro, voix.py) et la musique d'ambiance choisie, chronométrées phrase par phrase et mot par mot
//   2. le fond : pour chaque phrase, la vidéo d'illustration choisie par la réalisatrice (banque libre de droits, Pexels),
//      recadrée en vertical et coupée à la durée de la phrase ; sans vidéo (style « texte », ou rien de trouvé), un fond
//      en dégradé animé aux couleurs de la créatrice
//   3. les textes : l'accroche à l'écran pendant les premières secondes, le texte court de chaque phrase, et les
//      sous-titres mot à mot (le mot dit s'allume dans sa couleur, les mots forts aussi)
//   4. le montage final (son normalisé à -14 LUFS, comme le veulent TikTok et YouTube), la vignette et les sous-titres SRT
//   5. sur l'usine : l'envoi des fichiers dans le stockage de la tour et le compte rendu
//
// En local :      node montage.js --fichier exemples/montage.json --sortie /tmp/montage
// Sur l'usine :   node montage.js --video 12 --langue fr        (variables HQ_TOUR et HQ_USINE_SECRET)
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { journal, lancer, motsForts, srt, tour, televerser } = require('./commun');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const L = 1080, H = 1920, FPS = 30;
const POLICES = path.join(__dirname, 'polices');
const POLICE = 'Poppins ExtraBold';
// les vidéos d'illustration ne viennent que des banques libres de droits (jamais une autre adresse)
const HOTES = /^(videos\.pexels\.com|player\.vimeo\.com|cdn\.pixabay\.com)$/;
const MAX_CLIP = 80 * 1048576;

/* ── couleurs ── */
function hex(c, defaut) { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); return m ? m[1].toUpperCase() : defaut; }
// ASS : &HAABBGGRR (AA = transparence, 00 opaque)
function ass(c, alpha) { const h = hex(c, 'FFFFFF'); return '&H' + (alpha || '00') + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); }
function melange(a, b, t) {
  const x = hex(a, '000000'), y = hex(b, '000000');
  const v = [0, 2, 4].map((i) => Math.round(parseInt(x.slice(i, i + 2), 16) * (1 - t) + parseInt(y.slice(i, i + 2), 16) * t));
  return v.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function clair(c) { const h = hex(c, 'FFFFFF'); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150; }

/* ── 1. la voix ── */
async function voix(cmd, sortie, forts) {
  const v = cmd.voix || {};
  const modeles = process.env.KOKORO_DIR || path.join(__dirname, '.modeles');
  const commande = {
    langue: v.kokoro || 'fr-fr', voix: v.voix || 'ff_siwis', vitesse: v.vitesse || 1.0,
    segments: forts.map((f) => f.map((x) => x.m).join(' ')), sortie,
    modele: path.join(modeles, 'kokoro-v1.0.onnx'), voix_fichier: path.join(modeles, 'voices-v1.0.bin'),
    debut: 0.25, ecart: 0.28, fin: 0.9, duree_min: Number((cmd.format || {}).duree_min) || 0,
    musique: (cmd.plan || {}).musique !== 'aucune', ambiance: (cmd.plan || {}).musique || 'calme', graine: Number((cmd.video || {}).id) || 7,
    etiquettes: []
  };
  const res = await lancer(process.env.PYTHON || 'python3', [path.join(__dirname, 'voix.py')], JSON.stringify(commande));
  journal(cmd.langue, 'voix', res.trim());
  const temps = JSON.parse(fs.readFileSync(path.join(sortie, 'temps.json'), 'utf8'));
  temps.segments.forEach((sg, i) => (sg.mots || []).forEach((m, j) => { if (forts[i] && forts[i][j] && forts[i][j].fort) m.fort = true; }));
  return temps;
}

/* ── 2. le fond ── */
async function telecharger(url, fichier) {
  let u;
  try { u = new URL(url); } catch (e) { throw new Error('adresse de vidéo illisible'); }
  if (u.protocol !== 'https:' || !HOTES.test(u.hostname)) throw new Error('adresse de vidéo refusée : ' + u.hostname);
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const final = new URL(r.url || u);
      if (!HOTES.test(final.hostname) && !/\.(pexels\.com|vimeocdn\.com|akamaized\.net|pixabay\.com)$/.test(final.hostname)) throw new Error('redirection refusée : ' + final.hostname);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 10000 || buf.length > MAX_CLIP) throw new Error('taille inattendue : ' + buf.length);
      fs.writeFileSync(fichier, buf);
      return fichier;
    } catch (e) {
      if (essai === 2) throw e;
      await new Promise((ok) => setTimeout(ok, 2500 * (essai + 1)));
    }
  }
  return null;
}

// les fenêtres de chaque phrase sur la ligne de temps : la coupe tombe juste avant que la phrase commence
function fenetres(temps) {
  const s = temps.segments;
  return s.map((sg, i) => {
    const debut = i === 0 ? 0 : Math.max(0, sg.debut - 0.12);
    const fin = i < s.length - 1 ? Math.max(debut + 0.4, s[i + 1].debut - 0.12) : temps.duree;
    return { debut, fin, duree: Math.round((fin - debut) * 1000) / 1000 };
  });
}

// un morceau du fond : la vidéo recadrée en vertical, légèrement assombrie pour que les textes se lisent ; ou un dégradé
async function morceau(sortie, i, f, clip, couleurs) {
  const out = path.join(sortie, 'fond-' + String(i).padStart(2, '0') + '.mp4');
  const d = f.duree.toFixed(3);
  const commun = ['-r', String(FPS), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), out];
  if (clip) {
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-ss', String(clip.depart || 0), '-i', clip.fichier, '-t', d,
      '-vf', 'scale=' + L + ':' + H + ':force_original_aspect_ratio=increase,crop=' + L + ':' + H + ',setsar=1,fps=' + FPS + ',eq=brightness=-0.035:saturation=1.06,format=yuv420p'].concat(commun));
  } else {
    // un dégradé lent, aux couleurs de la créatrice, différent à chaque phrase (le regard voit quelque chose bouger)
    const c0 = couleurs[i % couleurs.length], c1 = couleurs[(i + 1) % couleurs.length];
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'gradients=s=' + L + 'x' + H + ':c0=0x' + c0 + ':c1=0x' + c1 + ':x0=0:y0=0:x1=' + L + ':y1=' + H + ':speed=0.012:d=' + d + ':r=' + FPS + ':type=linear',
      '-vf', 'vignette=PI/5,noise=alls=3:allf=t,format=yuv420p'].concat(commun));
  }
  return out;
}

async function fond(cmd, sortie, temps) {
  const plan = cmd.plan || {};
  const fen = fenetres(temps);
  const accent = '#' + hex(plan.couleur, 'FFD400');
  // trois couleurs de fond sombres tirées de la couleur de la créatrice (le texte blanc se lit toujours)
  // en style texte, le fond est le décor : plus de couleur ; derrière une vidéo manquante, il reste discret
  const couleurs = plan.style === 'texte'
    ? [melange('0E0E1A', accent, 0.62), melange('0A0A12', accent, 0.22), melange('1B1030', accent, 0.45)]
    : [melange('0B0B14', accent, 0.28), melange('120A1F', accent, 0.12), melange('06131A', accent, 0.22)];
  const caches = {};
  const morceaux = [];
  const avertissements = [];
  for (let i = 0; i < fen.length; i++) {
    let clip = null;
    const c = plan.style !== 'texte' && Array.isArray(plan.clips) ? plan.clips[i] : null;
    // en local seulement (--fichier), un clip peut être un fichier de la machine (pour essayer sans réseau)
    if (c && c.fichier && arg('fichier') && fs.existsSync(c.fichier)) clip = { fichier: c.fichier, depart: Number(c.depart) || 0 };
    else if (c && c.url) {
      try {
        if (!caches[c.url]) caches[c.url] = await telecharger(c.url, path.join(sortie, 'clip-' + i + '.mp4'));
        // un même clip réutilisé plus loin repart d'un autre moment
        const deja = Object.keys(caches).indexOf(c.url) !== Object.keys(caches).length - 1;
        clip = { fichier: caches[c.url], depart: deja ? 2.5 : (Number(c.depart) || 0) };
      } catch (e) { avertissements.push('phrase ' + (i + 1) + ' : vidéo indisponible (' + String(e.message).slice(0, 80) + '), fond en dégradé'); }
    }
    morceaux.push(await morceau(sortie, i, fen[i], clip, couleurs));
  }
  const liste = path.join(sortie, 'fond.txt');
  fs.writeFileSync(liste, morceaux.map((m) => "file '" + m.replace(/'/g, "'\\''") + "'").join('\n'));
  const sortieFond = path.join(sortie, 'fond.mp4');
  await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', sortieFond]);
  morceaux.forEach((m) => { try { fs.unlinkSync(m); } catch (e) { /* déjà parti */ } });
  return { fichier: sortieFond, avertissements };
}

/* ── 3. les textes (sous-titres ASS, rendus par libass dans ffmpeg) ── */
const t = (x) => { const cs = Math.max(0, Math.round(x * 100)); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60; return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(cs % 100).padStart(2, '0'); };
const echapper = (s) => String(s || '').replace(/\\/g, '').replace(/[{}]/g, '').replace(/\n/g, ' ');
// une ligne de texte coupée en lignes d'environ n caractères (\N), sans couper un mot
function couper(s, n) {
  const mots = String(s || '').split(/\s+/).filter(Boolean);
  const lignes = [];
  let cur = '';
  mots.forEach((m) => { if (cur && (cur + ' ' + m).length > n) { lignes.push(cur); cur = m; } else cur = cur ? cur + ' ' + m : m; });
  if (cur) lignes.push(cur);
  return lignes;
}
// la largeur approximative d'un texte en Poppins ExtraBold (0,62 em par caractère en moyenne)
const largeur = (s, taille) => String(s || '').length * taille * 0.62;

function sousTitres(cmd, temps) {
  const plan = cmd.plan || {};
  const texte = plan.style === 'texte';
  const accent = plan.couleur || '#FFD400';
  const surAccent = clair(accent) ? '#111111' : '#FFFFFF';
  // le mot qui s'allume : la couleur de la créatrice, éclaircie si elle est sombre (elle doit se lire sur tout fond)
  const surligne = clair(accent) ? accent : '#' + melange(accent, 'FFFFFF', 0.42);
  const taille = texte ? 116 : 96;
  const marge = 90;
  const styles = [
    // les sous-titres : blanc, contour noir épais ; en style texte, plus grands et au centre
    'Style: Sous,' + POLICE + ',' + taille + ',' + ass('#FFFFFF') + ',' + ass('#FFFFFF') + ',' + ass('#000000') + ',&H78000000,-1,0,0,0,100,100,0,0,1,' + (texte ? 6 : 8) + ',' + (texte ? 0 : 3) + ',' + (texte ? 5 : 2) + ',' + marge + ',' + marge + ',' + (texte ? 0 : 600) + ',1',
    // l'accroche : en haut, sur un bandeau de sa couleur
    'Style: Accroche,' + POLICE + ',76,' + ass(surAccent) + ',' + ass(surAccent) + ',' + ass(accent) + ',&H00000000,-1,0,0,0,100,100,0,0,3,20,0,8,' + marge + ',' + marge + ',300,1',
    // le texte court d'une phrase : en haut, sur un bandeau sombre
    'Style: Ecran,' + POLICE + ',60,' + ass('#FFFFFF') + ',' + ass('#FFFFFF') + ',&H50000000,&H00000000,-1,0,0,0,100,100,0,0,3,16,0,8,' + marge + ',' + marge + ',360,1'
  ];
  const ev = [];
  const segs = temps.segments;
  const beats = (cmd.texte && cmd.texte.beats) || [];
  const fen = fenetres(temps);
  // l'accroche, pendant les premières secondes (ou la première phrase si elle est plus longue)
  const acc = String((cmd.texte && cmd.texte.accroche) || '').replace(/\*/g, '').trim();
  const finAccroche = segs.length ? Math.max(2.6, Math.min(4.2, segs[0].fin + 0.3)) : 2.6;
  if (acc) ev.push('Dialogue: 2,' + t(0.05) + ',' + t(finAccroche) + ',Accroche,,0,0,0,,{\\fad(120,160)\\t(0,180,\\fscx104\\fscy104)\\t(180,320,\\fscx100\\fscy100)}' + couper(echapper(acc), 18).join('\\N'));
  // le texte court de chaque phrase (pas sur la première : l'accroche y est)
  beats.forEach((b, i) => {
    const e = String((b && b.ecran) || '').replace(/\*/g, '').trim();
    if (!e || !fen[i] || (i === 0 && acc)) return;
    const debut = Math.max(fen[i].debut, i === 1 && acc ? finAccroche : fen[i].debut);
    if (fen[i].fin - debut < 0.6) return;
    ev.push('Dialogue: 1,' + t(debut + 0.05) + ',' + t(fen[i].fin) + ',Ecran,,0,0,0,,{\\fad(100,120)}' + couper(echapper(e), 24).join('\\N'));
  });
  // les sous-titres mot à mot : des groupes courts ; le mot dit s'allume (couleur et petit saut), les mots forts restent
  // dans la couleur pendant tout le groupe
  // clips : trois mots au plus sur une ligne ; texte : quatre mots au plus sur deux lignes
  const parGroupe = texte ? 4 : 3, maxCar = texte ? 26 : 16, maxLigne = texte ? 13 : 99;
  segs.forEach((sg) => {
    const mots = (sg.mots || []).filter((m) => m && m.m);
    const groupes = [];
    let g = [];
    mots.forEach((m) => {
      const longueur = g.map((x) => x.m).join(' ').length + (g.length ? 1 : 0) + m.m.length;
      if (g.length && (g.length >= parGroupe || longueur > maxCar)) { groupes.push(g); g = []; }
      g.push(m);
      if (/[.!?…]$/.test(m.m)) { groupes.push(g); g = []; }
    });
    if (g.length) groupes.push(g);
    groupes.forEach((gr, gi) => {
      const finGroupe = gi < groupes.length - 1 ? groupes[gi + 1][0].t0 : Math.min(sg.fin + 0.25, gr[gr.length - 1].t1 + 0.4);
      const brut = gr.map((x) => x.m).join(' ');
      // un groupe trop large pour l'écran : la taille baisse (jamais un mot qui sort de l'image)
      const dispo = L - 2 * marge, lignes = texte ? couper(brut, maxLigne) : [brut];
      const plusLong = lignes.reduce((a, l) => Math.max(a, largeur(l, taille)), 0);
      const fs = plusLong > dispo ? Math.floor(taille * dispo / plusLong) : null;
      gr.forEach((m, k) => {
        const debut = m.t0, fin = k < gr.length - 1 ? gr[k + 1].t0 : finGroupe;
        if (fin - debut < 0.03) return;
        let n = 0;
        const morceaux = gr.map((x, j) => {
          const mot = echapper(x.m);
          const coupe = texte && j > 0 && n + x.m.length + 1 > maxLigne ? '\\N' : (j > 0 ? ' ' : '');
          n = coupe === '\\N' ? x.m.length : n + x.m.length + (j > 0 ? 1 : 0);
          if (j === k) return coupe + '{\\c' + ass(surligne) + '\\t(0,70,\\fscx114\\fscy114)\\t(70,150,\\fscx100\\fscy100)}' + mot + '{\\c' + ass('#FFFFFF') + '}';
          if (x.fort) return coupe + '{\\c' + ass(surligne) + '}' + mot + '{\\c' + ass('#FFFFFF') + '}';
          return coupe + mot;
        });
        ev.push('Dialogue: 0,' + t(debut) + ',' + t(fin) + ',Sous,,0,0,0,,' + (fs ? '{\\fs' + fs + '}' : '') + morceaux.join(''));
      });
    });
  });
  return ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: ' + L, 'PlayResY: ' + H, 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', 'YCbCr Matrix: TV.709', '',
    '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding'].concat(styles, ['',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'], ev).join('\n') + '\n';
}

/* ── 4. le montage ── */
async function monter(cmd, sortie) {
  fs.mkdirSync(sortie, { recursive: true });
  const t0 = Date.now();
  const beats = ((cmd.texte && cmd.texte.beats) || []).filter((b) => b && String(b.voix || '').trim());
  if (beats.length < 2) throw new Error('script trop court : ' + beats.length + ' phrase(s)');
  const c = Object.assign({}, cmd, { texte: Object.assign({}, cmd.texte, { beats }) });
  const forts = beats.map((b) => motsForts(b.voix));
  const temps = await voix(c, sortie, forts);
  const f = await fond(c, sortie, temps);
  const sous = path.join(sortie, 'textes.ass');
  fs.writeFileSync(sous, sousTitres(c, temps));
  const finale = path.join(sortie, 'video.mp4');
  const chemin = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-i', f.fichier, '-i', path.join(sortie, 'son.wav'),
    '-filter_complex', "[0:v]subtitles='" + chemin(sous) + "':fontsdir='" + chemin(POLICES) + "'[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-maxrate', '7M', '-bufsize', '14M', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-shortest', '-movflags', '+faststart', finale]);
  const vignette = path.join(sortie, 'vignette.jpg');
  await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(Math.min(1.4, Math.max(0.6, temps.duree / 3))), '-i', finale, '-frames:v', '1', '-q:v', '3', vignette]);
  fs.writeFileSync(path.join(sortie, 'sous-titres.srt'), srt(temps.segments));
  try { fs.unlinkSync(f.fichier); } catch (e) { /* déjà parti */ }
  const taille = fs.statSync(finale).size;
  journal(cmd.langue, 'vidéo prête', (taille / 1048576).toFixed(1) + ' Mo', temps.duree + ' s', Math.round((Date.now() - t0) / 1000) + ' s au total');
  return { video: finale, vignette, srt: path.join(sortie, 'sous-titres.srt'), duree: temps.duree, taille, secondes: Math.round((Date.now() - t0) / 1000), avertissements: f.avertissements };
}

/* ── 5. avec la tour ── */
async function principal() {
  const langue = arg('langue', 'fr');
  if (arg('fichier')) {
    const cmd = JSON.parse(fs.readFileSync(arg('fichier'), 'utf8'));
    cmd.langue = cmd.langue || langue;
    const r = await monter(cmd, arg('sortie', path.join(os.tmpdir(), 'montage-' + cmd.langue)));
    console.log(JSON.stringify(r, null, 1));
    return;
  }
  const video = arg('video');
  if (!/^\d{1,12}$/.test(String(video || '')) || !/^[a-z]{2}$/.test(langue)) throw new Error('--video et --langue');
  const cmd = await tour('montage', { video, langue }, 'GET');
  const sortie = path.join(os.tmpdir(), 'montage-' + video + '-' + langue);
  let r;
  try { r = await monter(cmd, sortie); }
  catch (e) {
    await tour('montage_fini', { video, langue, ok: false, erreur: String(e.message || e).slice(0, 900), jeton: cmd.jeton }).catch(() => null);
    throw e;
  }
  const fichiers = [['video.mp4', r.video, 'video/mp4'], ['vignette.jpg', r.vignette, 'image/jpeg'], ['sous-titres.srt', r.srt, 'application/x-subrip']];
  const urls = await tour('montage_televerser', { video, langue, jeton: cmd.jeton, fichiers: fichiers.map((f) => ({ nom: f[0], type: f[2], taille: fs.statSync(f[1]).size })) });
  for (const f of fichiers) { const u = (urls.urls || {})[f[0]]; if (!u) throw new Error('pas d\'adresse d\'envoi pour ' + f[0]); await televerser(u, f[1], f[2]); }
  await tour('montage_fini', { video, langue, ok: true, jeton: cmd.jeton, duree: r.duree, taille: r.taille, secondes: r.secondes, fichiers: fichiers.map((f) => f[0]), avertissements: r.avertissements });
  journal('envoyé à la tour');
}

if (require.main === module) principal().catch((e) => { console.error('[montage] échec :', e.message || e); process.exit(1); });

module.exports = { monter, sousTitres, fenetres, couper, ass, hex, HOTES };
