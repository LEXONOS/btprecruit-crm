// L'usine du studio des créatrices : monte une vidéo verticale (1080 x 1920, 30 images/s) dans une langue, de bout en bout.
//   1. la voix (Kokoro ou Piper, voix.py) et la musique d'ambiance choisie, chronométrées phrase par phrase et mot par mot
//   2. le fond : pour chaque phrase, la vidéo d'illustration choisie par la réalisatrice (banque libre de droits, Pexels),
//      ou l'image créée par IA (elle zoome ou glisse doucement), ou la vidéo créée par IA, recadrée en vertical et coupée
//      à la durée de la phrase ; sans rien (style « texte », ou rien de trouvé), un fond en dégradé animé aux couleurs de
//      la créatrice
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
const { journal, lancer, motsForts, fortsCJK, srt, tour, televerser } = require('./commun');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const L = 1080, H = 1920, FPS = 30;
const POLICES = path.join(__dirname, 'polices');
const POLICE = 'Poppins ExtraBold';
const PYTHON = process.env.PYTHON || 'python3';
// la police des textes selon l'écriture : Poppins (latin, devanagari), Noto Sans (cyrillique, grec, vietnamien), Noto
// Sans Arabic (arabe, persan), toutes dans polices/ ; Noto Sans CJK pour le chinois et le japonais (installée sur l'usine)
const POLICES_LANGUE = {
  ru: 'Noto Sans ExtraBold', uk: 'Noto Sans ExtraBold', el: 'Noto Sans ExtraBold', vi: 'Noto Sans ExtraBold',
  ar: 'Noto Sans Arabic ExtBd', fa: 'Noto Sans Arabic ExtBd', zh: 'Noto Sans CJK SC', ja: 'Noto Sans CJK JP'
};
const policeDe = (langue) => POLICES_LANGUE[langue] || POLICE;
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const longueur = (s) => Array.from(String(s || '')).length;
// les vidéos d'illustration ne viennent que des banques libres de droits, les images et vidéos IA que de fal (son CDN
// fal.media, ou son ancien stockage) : jamais une autre adresse
const HOTES = /^(videos\.pexels\.com|player\.vimeo\.com|cdn\.pixabay\.com)$/;
const FAL = /(^|\.)fal\.media$/;
const REDIRECTIONS = /\.(pexels\.com|vimeocdn\.com|akamaized\.net|pixabay\.com)$/;
// la musique qu'une créatrice a envoyée pour son clip : un lien de lecture signé de l'espace « studio » de la tour
const STOCKAGE = /^[a-z0-9]{20}\.supabase\.co$/;
function adresseAutorisee(u, apresRedirection) {
  if (!u || u.protocol !== 'https:') return false;
  if (HOTES.test(u.hostname) || FAL.test(u.hostname)) return true;
  if (u.hostname === 'storage.googleapis.com' && /^\/falserverless\//.test(u.pathname)) return true;
  if (STOCKAGE.test(u.hostname) && /^\/storage\/v1\/object\/sign\/studio\/crea\/\d+\/sons\//.test(u.pathname)) return true;
  return !!apresRedirection && REDIRECTIONS.test(u.hostname);
}
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
// chinois ou japonais : écrits sans espaces (voix.py les découpe en mots)
const cjkDe = (cmd) => ((cmd.voix || {}).cjk ? (cmd.langue === 'ja' ? 'ja' : 'zh') : '');

// ce que la voix demande en plus selon la langue, installé une fois si l'usine ne l'a pas encore (Piper pour une
// vingtaine de langues, misaki pour écrire le chinois et le japonais comme les voix de Kokoro les lisent, avec jieba et
// fugashi qui coupent leurs phrases en mots pour les sous-titres, voix naturelle comprise)
async function dependances(cmd) {
  const v = cmd.voix || {};
  const besoins = [];
  if (v.moteur === 'piper') besoins.push(['import piper', 'piper-tts==1.8.0']);
  if (cjkDe(cmd) === 'zh') besoins.push(['from misaki import zh; import jieba', 'misaki[zh]==0.7.4']);
  if (cjkDe(cmd) === 'ja') besoins.push(['from misaki import ja; import fugashi', 'misaki[ja]==0.7.4']);
  for (const [essai, paquet] of besoins) {
    const deja = await lancer(PYTHON, ['-c', essai]).then(() => true, () => false);
    if (deja) continue;
    journal(cmd.langue, 'installation de ' + paquet);
    await lancer(PYTHON, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', paquet]);
  }
}

// la voix naturelle (ElevenLabs, par fal) : un fichier par phrase, déjà dit ; téléchargés depuis fal seulement (en local,
// --fichier, un fichier de la machine), mis en WAV mono 48 kHz pour voix.py (les aigus de la voix sont gardés)
async function voixEnFichiers(v, sortie, n) {
  const liste = Array.isArray(v.fichiers) ? v.fichiers : [];
  if (liste.length !== n) throw new Error(liste.length + ' fichiers de voix pour ' + n + ' phrases');
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = liste[i];
    const brut = path.join(sortie, 'voix-' + i + '.source');
    const wav = path.join(sortie, 'voix-' + i + '.wav');
    if (x && typeof x === 'object' && x.fichier && arg('fichier') && fs.existsSync(x.fichier)) fs.copyFileSync(x.fichier, brut);
    else await telecharger(String((x && x.url) || x || ''), brut, 2000);
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-i', brut, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', wav]);
    out.push(wav);
  }
  return out;
}

async function voix(cmd, sortie, beats) {
  let v = cmd.voix || {};
  let fichiers = null;
  if (v.moteur === 'fichiers') {
    // la voix naturelle ; si ses fichiers ne viennent pas, la voix gratuite de la langue la remplace en entier
    try { fichiers = await voixEnFichiers(v, sortie, beats.length); }
    catch (e) {
      journal(cmd.langue, 'voix naturelle indisponible (' + String(e.message).slice(0, 120) + ') : voix gratuite à la place');
      (cmd.avertissements = cmd.avertissements || []).push('voix naturelle indisponible : voix gratuite à la place');
      v = v.secours || {};
    }
  }
  const cjk = cjkDe(cmd);
  const modeles = process.env.KOKORO_DIR || path.join(__dirname, '.modeles');
  // les mots forts (*mot*) : par position du mot (langues à espaces) ou par caractère (chinois, japonais)
  const forts = beats.map((b) => (cjk ? fortsCJK(b.voix) : motsForts(b.voix)));
  const commande = {
    moteur: fichiers ? 'fichiers' : v.moteur === 'piper' ? 'piper' : 'kokoro', fichiers, sr: fichiers ? 48000 : 24000, piper: v.piper || null, piper_dir: process.env.PIPER_DIR || path.join(__dirname, '.piper'), cjk,
    langue: v.kokoro || 'fr-fr', voix: v.voix || 'ff_siwis', vitesse: v.vitesse || 1.0,
    segments: forts.map((f) => (cjk ? f.texte : f.map((x) => x.m).join(' '))), sortie,
    modele: path.join(modeles, 'kokoro-v1.0.onnx'), voix_fichier: path.join(modeles, 'voices-v1.0.bin'),
    debut: 0.25, ecart: 0.28, fin: 0.9, duree_min: Number((cmd.format || {}).duree_min) || 0,
    musique: (cmd.plan || {}).musique !== 'aucune', ambiance: (cmd.plan || {}).musique || 'calme', graine: Number((cmd.video || {}).id) || 7,
    etiquettes: []
  };
  // ce que la voix gratuite demande (Piper, misaki) et, même avec une voix naturelle, le découpage en mots du chinois et
  // du japonais pour les sous-titres mot à mot (jieba, fugashi : voix.py s'en sert dans tous les cas)
  await dependances(Object.assign({}, cmd, { voix: v }));
  const res = await lancer(PYTHON, [path.join(__dirname, 'voix.py')], JSON.stringify(commande));
  journal(cmd.langue, 'voix', commande.moteur, res.trim().split('\n').pop());
  const temps = JSON.parse(fs.readFileSync(path.join(sortie, 'temps.json'), 'utf8'));
  temps.segments.forEach((sg, i) => (sg.mots || []).forEach((m, j) => {
    if (cjk) { const f = forts[i].forts; for (let k = m.o; k < m.o + m.m.length; k++) if (f[k]) { m.fort = true; break; } }
    else if (forts[i] && forts[i][j] && forts[i][j].fort) m.fort = true;
  }));
  return temps;
}

/* ── 2. le fond ── */
async function telecharger(url, fichier, minimum) {
  let u;
  try { u = new URL(url); } catch (e) { throw new Error('adresse de vidéo illisible'); }
  if (!adresseAutorisee(u)) throw new Error('adresse de vidéo refusée : ' + u.hostname);
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const final = new URL(r.url || u);
      if (!adresseAutorisee(final, true)) throw new Error('redirection refusée : ' + final.hostname);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < (minimum || 10000) || buf.length > MAX_CLIP) throw new Error('taille inattendue : ' + buf.length);
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

// le mouvement d'une image IA, différent d'une phrase à l'autre : elle avance, recule, monte ou glisse (zoompan, sur
// l'image agrandie deux fois : le mouvement reste fluide, sans tremblement)
function kenBurns(i, n) {
  const p = 'on/' + Math.max(1, n - 1);
  const centre = { x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' };
  return [
    { z: '1+0.12*' + p, x: centre.x, y: centre.y },
    { z: '1.12-0.12*' + p, x: centre.x, y: centre.y },
    { z: '1.1', x: centre.x, y: '(ih-ih/zoom)*(1-' + p + ')' },
    { z: '1.1', x: '(iw-iw/zoom)*' + p, y: centre.y }
  ][i % 4];
}

// un morceau du fond : la vidéo recadrée en vertical, légèrement assombrie pour que les textes se lisent ; l'image IA
// qui bouge doucement ; la vidéo IA (plus courte que la phrase, elle garde sa dernière image) ; ou un dégradé
async function morceau(sortie, i, f, clip, couleurs) {
  const out = path.join(sortie, 'fond-' + String(i).padStart(2, '0') + '.mp4');
  const d = f.duree.toFixed(3);
  const commun = ['-r', String(FPS), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), out];
  const cadrer = 'scale=' + L + ':' + H + ':force_original_aspect_ratio=increase,crop=' + L + ':' + H + ',setsar=1,fps=' + FPS;
  if (clip && clip.type === 'image') {
    const n = Math.ceil(f.duree * FPS) + 2;
    const k = kenBurns(i, n);
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-i', clip.fichier, '-t', d,
      '-vf', 'scale=' + 2 * L + ':' + 2 * H + ':force_original_aspect_ratio=increase:flags=lanczos,crop=' + 2 * L + ':' + 2 * H + ',setsar=1,' +
      "zoompan=z='" + k.z + "':x='" + k.x + "':y='" + k.y + "':d=" + n + ':s=' + L + 'x' + H + ':fps=' + FPS + ',eq=brightness=-0.03:saturation=1.04,format=yuv420p'].concat(commun));
  } else if (clip && clip.type === 'video') {
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-i', clip.fichier, '-t', d,
      '-vf', cadrer + ',tpad=stop_mode=clone:stop_duration=' + d + ',eq=brightness=-0.035:saturation=1.06,format=yuv420p'].concat(commun));
  } else if (clip) {
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
    const type = c && ['image', 'video'].indexOf(c.type) >= 0 ? c.type : 'clip';
    // en local seulement (--fichier), un clip peut être un fichier de la machine (pour essayer sans réseau)
    if (c && c.fichier && arg('fichier') && fs.existsSync(c.fichier)) clip = { fichier: c.fichier, depart: Number(c.depart) || 0, type };
    else if (c && c.url) {
      try {
        // l'extension du fichier suit ce qu'il est (ffmpeg devine mieux une image .jpg qu'une image .mp4)
        const ext = type === 'image' ? ((/\.(jpe?g|png|webp)$/i.exec(new URL(c.url).pathname) || ['.jpg'])[0].toLowerCase()) : '.mp4';
        if (!caches[c.url]) caches[c.url] = await telecharger(c.url, path.join(sortie, 'clip-' + i + ext));
        // un même clip réutilisé plus loin repart d'un autre moment
        const deja = Object.keys(caches).indexOf(c.url) !== Object.keys(caches).length - 1;
        clip = { fichier: caches[c.url], depart: deja && type === 'clip' ? 2.5 : (Number(c.depart) || 0), type };
      } catch (e) { avertissements.push('phrase ' + (i + 1) + ' : ' + (type === 'clip' ? 'vidéo' : type === 'image' ? 'image IA' : 'vidéo IA') + ' indisponible (' + String(e.message).slice(0, 80) + '), fond en dégradé'); }
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
// une ligne de texte coupée en lignes d'environ n caractères (\N), sans couper un mot ; en chinois et en japonais,
// tous les n caractères, sans commencer une ligne par une ponctuation
function couper(s, n, cjk) {
  if (cjk) {
    const c = Array.from(String(s || '').replace(/\s+/g, ''));
    const out = [];
    let cur = '';
    c.forEach((ch, i) => {
      cur += ch;
      const suivant = c[i + 1];
      if (longueur(cur) >= n && suivant && !/[。！？，、；：…)）」』】》”’!?,.]/.test(suivant)) { out.push(cur); cur = ''; }
    });
    if (cur) out.push(cur);
    return out;
  }
  const mots = String(s || '').split(/\s+/).filter(Boolean);
  const lignes = [];
  let cur = '';
  mots.forEach((m) => { if (cur && (cur + ' ' + m).length > n) { lignes.push(cur); cur = m; } else cur = cur ? cur + ' ' + m : m; });
  if (cur) lignes.push(cur);
  return lignes;
}
// la largeur approximative d'un texte (0,62 em par caractère en moyenne, 1 em pour un caractère chinois ou japonais)
const largeur = (s, taille) => Array.from(String(s || '')).reduce((a, ch) => a + (CJK.test(ch) || /[。！？，、]/.test(ch) ? 1 : 0.62), 0) * taille;

function sousTitres(cmd, temps) {
  const plan = cmd.plan || {};
  const texte = plan.style === 'texte';
  const cjk = !!cjkDe(cmd);
  const sep = cjk ? '' : ' ';
  const POLICE = policeDe(cmd.langue);
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
  if (acc) ev.push('Dialogue: 2,' + t(0.05) + ',' + t(finAccroche) + ',Accroche,,0,0,0,,{\\fad(120,160)\\t(0,180,\\fscx104\\fscy104)\\t(180,320,\\fscx100\\fscy100)}' + couper(echapper(acc), cjk ? 10 : 18, cjk).join('\\N'));
  // le texte court de chaque phrase (pas sur la première : l'accroche y est)
  beats.forEach((b, i) => {
    const e = String((b && b.ecran) || '').replace(/\*/g, '').trim();
    if (!e || !fen[i] || (i === 0 && acc)) return;
    const debut = Math.max(fen[i].debut, i === 1 && acc ? finAccroche : fen[i].debut);
    if (fen[i].fin - debut < 0.6) return;
    ev.push('Dialogue: 1,' + t(debut + 0.05) + ',' + t(fen[i].fin) + ',Ecran,,0,0,0,,{\\fad(100,120)}' + couper(echapper(e), cjk ? 13 : 24, cjk).join('\\N'));
  });
  // les sous-titres mot à mot : des groupes courts ; le mot dit s'allume (couleur et petit saut), les mots forts restent
  // dans la couleur pendant tout le groupe
  // clips : trois mots au plus sur une ligne ; texte : quatre mots au plus sur deux lignes
  // chinois et japonais : en caractères (un caractère y est à peu près aussi large que haut)
  const parGroupe = texte ? 4 : 3, maxCar = cjk ? (texte ? 12 : 8) : (texte ? 26 : 16), maxLigne = cjk ? (texte ? 7 : 99) : (texte ? 13 : 99);
  segs.forEach((sg) => {
    const mots = (sg.mots || []).filter((m) => m && m.m);
    const groupes = [];
    let g = [];
    mots.forEach((m) => {
      const n = longueur(g.map((x) => x.m).join(sep)) + (g.length ? sep.length : 0) + longueur(m.m);
      if (g.length && (g.length >= parGroupe || n > maxCar)) { groupes.push(g); g = []; }
      g.push(m);
      if (/[.!?…。！？]$/.test(m.m)) { groupes.push(g); g = []; }
    });
    if (g.length) groupes.push(g);
    groupes.forEach((gr, gi) => {
      const finGroupe = gi < groupes.length - 1 ? groupes[gi + 1][0].t0 : Math.min(sg.fin + 0.25, gr[gr.length - 1].t1 + 0.4);
      const brut = gr.map((x) => x.m).join(sep);
      // un groupe trop large pour l'écran : la taille baisse (jamais un mot qui sort de l'image)
      const dispo = L - 2 * marge, lignes = texte ? couper(brut, maxLigne, cjk) : [brut];
      const plusLong = lignes.reduce((a, l) => Math.max(a, largeur(l, taille)), 0);
      const fs = plusLong > dispo ? Math.floor(taille * dispo / plusLong) : null;
      gr.forEach((m, k) => {
        const debut = m.t0, fin = k < gr.length - 1 ? gr[k + 1].t0 : finGroupe;
        if (fin - debut < 0.03) return;
        let n = 0;
        const morceaux = gr.map((x, j) => {
          const mot = echapper(x.m);
          const coupe = texte && j > 0 && n + longueur(x.m) + sep.length > maxLigne ? '\\N' : (j > 0 ? sep : '');
          n = coupe === '\\N' ? longueur(x.m) : n + longueur(x.m) + (j > 0 ? sep.length : 0);
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
  const temps = await voix(c, sortie, beats);
  const f = await fond(c, sortie, temps);
  const sous = path.join(sortie, 'textes.ass');
  fs.writeFileSync(sous, sousTitres(c, temps));
  const finale = path.join(sortie, 'video.mp4');
  const chemin = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-i', f.fichier, '-i', path.join(sortie, 'son.wav'),
    '-filter_complex', "[0:v]subtitles='" + chemin(sous) + "':fontsdir='" + chemin(POLICES) + "'[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]",
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-shortest', '-movflags', '+faststart', finale]);
  const vignette = path.join(sortie, 'vignette.jpg');
  await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(Math.min(1.4, Math.max(0.6, temps.duree / 3))), '-i', finale, '-frames:v', '1', '-q:v', '3', vignette]);
  fs.writeFileSync(path.join(sortie, 'sous-titres.srt'), srt(temps.segments, cjkDe(c) ? '' : ' '));
  try { fs.unlinkSync(f.fichier); } catch (e) { /* déjà parti */ }
  const taille = fs.statSync(finale).size;
  journal(cmd.langue, 'vidéo prête', (taille / 1048576).toFixed(1) + ' Mo', temps.duree + ' s', Math.round((Date.now() - t0) / 1000) + ' s au total');
  return { video: finale, vignette, srt: path.join(sortie, 'sous-titres.srt'), duree: temps.duree, taille, secondes: Math.round((Date.now() - t0) / 1000), avertissements: (c.avertissements || []).concat(f.avertissements) };
}

/* ── 5. avec la tour ── */
// une vidéo racontée (voix, images, sous-titres) ou un clip (des plans filmés montés sur le rythme, usine/clip.js)
function monterCommande(cmd, sortie, local) {
  if (cmd.genre === 'clip') return require('./clip').monter(cmd, sortie, { telecharger, local });
  return monter(cmd, sortie);
}
async function principal() {
  const langue = arg('langue', 'fr');
  if (arg('fichier')) {
    const cmd = JSON.parse(fs.readFileSync(arg('fichier'), 'utf8'));
    cmd.langue = cmd.langue || langue;
    const r = await monterCommande(cmd, arg('sortie', path.join(os.tmpdir(), 'montage-' + cmd.langue)), true);
    console.log(JSON.stringify(r, null, 1));
    return;
  }
  const video = arg('video');
  if (!/^\d{1,12}$/.test(String(video || '')) || !/^[a-z]{2}$/.test(langue)) throw new Error('--video et --langue');
  const cmd = await tour('montage', { video, langue }, 'GET');
  const sortie = path.join(os.tmpdir(), 'montage-' + video + '-' + langue);
  let r;
  try { r = await monterCommande(cmd, sortie, false); }
  catch (e) {
    await tour('montage_fini', { video, langue, ok: false, erreur: String(e.message || e).slice(0, 900), jeton: cmd.jeton }).catch(() => null);
    throw e;
  }
  const fichiers = [['video.mp4', r.video, 'video/mp4'], ['vignette.jpg', r.vignette, 'image/jpeg']].concat(r.srt ? [['sous-titres.srt', r.srt, 'application/x-subrip']] : []);
  const urls = await tour('montage_televerser', { video, langue, jeton: cmd.jeton, fichiers: fichiers.map((f) => ({ nom: f[0], type: f[2], taille: fs.statSync(f[1]).size })) });
  for (const f of fichiers) { const u = (urls.urls || {})[f[0]]; if (!u) throw new Error('pas d\'adresse d\'envoi pour ' + f[0]); await televerser(u, f[1], f[2]); }
  await tour('montage_fini', { video, langue, ok: true, jeton: cmd.jeton, duree: r.duree, taille: r.taille, secondes: r.secondes, fichiers: fichiers.map((f) => f[0]), avertissements: r.avertissements });
  journal('envoyé à la tour');
}

if (require.main === module) principal().catch((e) => { console.error('[montage] échec :', e.message || e); process.exit(1); });

module.exports = { monter, monterCommande, sousTitres, fenetres, couper, ass, hex, HOTES, adresseAutorisee, telecharger, kenBurns, morceau, policeDe };
