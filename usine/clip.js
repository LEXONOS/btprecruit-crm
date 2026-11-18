// L'usine monte un clip du studio des créatrices (lib/createurs/clip.js) : des plans filmés par IA, mis bout à bout en
// coupes franches, calés sur le rythme de la musique, avec les effets des montages qui marchent en ce moment.
//   1. les plans (des vidéos de fal, ou l'image clé d'un plan qui n'a pas pu être filmé) et la musique (son fichier, ou
//      celle créée chez fal) sont téléchargés ; ffprobe dit leur durée et s'ils ont du son
//   2. le rythme de la musique (rythme.py) : les temps, les premiers temps de mesure, le drop
//   3. chaque coupe tombe sur un temps, au plus près de la durée voulue du plan (un premier temps de mesure s'il est
//      presque aussi près) ; sans musique, les durées de son prompt
//   4. chaque plan est cadré au format du clip et reçoit ses effets, au temps près :
//        zooms   la caméra avance pendant tout le plan, un coup de zoom à chaque temps (plus fort sur les premiers
//                temps), la coupe qui claque
//        rap     un coup de zoom sur la coupe et sur les premiers temps de mesure
//        net     rien
//      plus, sur le moment fort du plan (le bruit le plus frappé de son son, sinon celui du découpage) : secousse, flash
//      ou zoom selon le plan ; sur le drop : flash, secousse et grand zoom. Un étalonnage commun (contraste, couleurs,
//      vignette, grain léger) fait tenir ensemble des plans faits séparément.
//   5. le son : les bruitages de chaque plan bout à bout, la musique par-dessus (fondu à la fin), à -14 LUFS ; un noir
//      final si le prompt le demande (la musique continue dessous)
'use strict';
const fs = require('fs');
const path = require('path');
const { journal, lancer, alleger, CIBLE_OCTETS } = require('./commun');

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';
const PYTHON = process.env.PYTHON || 'python3';
const FPS = 30;
const TAILLES = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };
// le plan commence un dixième de seconde après sa première image (l'image clé, encore immobile)
const DEPART = 0.1;
const NOIR = 0.8;
const N = (x) => (Math.round(Number(x) * 1000) / 1000).toFixed(3);

async function sonder(f) {
  try {
    const d = JSON.parse(await lancer(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', f]));
    const st = d.streams || [];
    return { duree: Number((d.format || {}).duration) || 0, son: st.some((s) => s.codec_type === 'audio'), image: !st.some((s) => s.codec_type === 'video') || /\.(jpe?g|png|webp)$/i.test(f) };
  } catch (e) { return { duree: 0, son: false, image: /\.(jpe?g|png|webp)$/i.test(f) }; }
}

// les durées à l'écran : chaque coupe sur un temps entre 60 % et 130 % de la durée voulue (jamais plus que ce qui est
// filmé), le plus près de la durée voulue ; un premier temps de mesure gagne s'il est à moins d'une demi-période
function calerCoupes(durees, dispos, r) {
  const beats = r && Array.isArray(r.beats) && r.beats.length > 3 ? r.beats : null;
  const forts = new Set(((r && r.forts) || []).map((x) => Math.round(x * 1000)));
  const p = (r && r.periode) || 0.5;
  const out = [];
  let t = 0;
  durees.forEach((voulu0, i) => {
    const dispo = Math.max(0.5, dispos[i]);
    const voulu = Math.min(voulu0, dispo);
    let fin = t + voulu;
    if (beats) {
      const min = t + Math.max(0.5, voulu * 0.6), max = t + Math.min(dispo, Math.max(voulu * 1.3, voulu + p));
      let best = null, score = Infinity;
      beats.forEach((b) => {
        if (b < min - 1e-6 || b > max + 1e-6) return;
        const s = Math.abs(b - fin) - (forts.has(Math.round(b * 1000)) ? p * 0.5 : 0);
        if (s < score) { score = s; best = b; }
      });
      if (best != null) fin = best;
    }
    const d = Math.max(0.5, Math.round((fin - t) * 1000) / 1000);
    out.push({ debut: Math.round(t * 1000) / 1000, duree: d });
    t += d;
  });
  return out;
}

// les effets d'un plan, en secondes depuis son début : { push, punchs: [[t, force]], secousses: [[t, force]], flashs: [t] }
function effetsPlan(plan, f, r, style, pic, image) {
  const e = { push: 0, punchs: [], secousses: [], flashs: [] };
  if (style === 'net') { if (image) e.push = 0.1; return e; }
  const dans = (x) => x >= f.debut + 0.12 && x <= f.debut + f.duree - 0.1;
  const loc = (x) => Math.round((x - f.debut) * 1000) / 1000;
  const beats = r && Array.isArray(r.beats) ? r.beats.filter(dans) : [];
  const forts = new Set(((r && r.forts) || []).filter(dans).map((x) => Math.round(x * 1000)));
  if (style === 'zooms') {
    e.push = 0.09;
    e.punchs.push([0, 0.12]);
    // un coup de zoom à chaque temps (un temps sur deux si la musique va très vite)
    const pas = r && r.periode && r.periode < 0.36 ? 2 : 1;
    beats.forEach((b, i) => { const fort = forts.has(Math.round(b * 1000)); if (fort || i % pas === 0) e.punchs.push([loc(b), fort ? 0.13 : 0.06]); });
  } else {
    e.push = image ? 0.1 : 0.035;
    e.punchs.push([0, 0.08]);
    beats.forEach((b) => { if (forts.has(Math.round(b * 1000))) e.punchs.push([loc(b), 0.07]); });
  }
  if (image) e.push = Math.max(e.push, 0.1);
  // le moment fort : entendu dans son son (le bouchon, le briquet), sinon celui prévu au découpage
  const a = pic != null ? pic : plan.accent;
  if (a != null && a > 0.1 && a < f.duree - 0.05) {
    if (plan.effet === 'secousse') e.secousses.push([a, 1]);
    else if (plan.effet === 'flash') { e.flashs.push(a); e.punchs.push([a, 0.08]); }
    else if (plan.effet === 'zoom') e.punchs.push([a, 0.16]);
    else if (style === 'zooms') e.punchs.push([a, 0.09]);
  }
  // le drop, souvent pile sur une coupe (la coupe est calée sur ce temps) : flash, secousse et grand zoom
  if (r && r.drop != null && r.drop >= f.debut - 0.03 && r.drop <= f.debut + f.duree - 0.1) {
    const d = Math.max(0, loc(r.drop));
    e.flashs.push(d); e.secousses.push([d, 1]); e.punchs.push([d, 0.18]);
  }
  // deux coups de zoom trop proches (moins de 0,15 s) : le plus fort reste
  e.punchs.sort((x, y) => x[0] - y[0]);
  e.punchs = e.punchs.filter((x, i, t) => !t.some((y, j) => j !== i && Math.abs(y[0] - x[0]) < 0.15 && (y[1] > x[1] || (y[1] === x[1] && j < i))));
  return e;
}

// les expressions de zoompan (en images : t = on / 30) et d'eq (en images : t = n / 30)
function enveloppe(liste, t, tau) { return liste.map(([b, a]) => N(a) + '*gte(' + t + ',' + N(b) + ')*exp(-(' + t + '-' + N(b) + ')/' + tau + ')').join('+'); }
function expressions(e, D) {
  const t = '(on/' + FPS + ')';
  const z = ['(1+' + N(e.push) + '*' + t + '/' + N(Math.max(0.3, D)) + ')'];
  if (e.punchs.length) z.push('(1+' + enveloppe(e.punchs, t, '0.2') + ')');
  const sec = e.secousses.length ? enveloppe(e.secousses, t, '0.16') : '';
  // la secousse : un peu de marge (zoom) pour pouvoir bouger le cadre
  if (sec) z.push('(1+0.045*(' + sec + '))');
  const dec = (freq, phase) => (sec ? '(' + sec + ')*sin(' + t + '*' + freq + '+' + phase + ')*iw*0.018' : '0');
  const x = 'max(0,min(iw-iw/zoom,(iw-iw/zoom)/2+' + dec(145, 0) + '))';
  const y = 'max(0,min(ih-ih/zoom,(ih-ih/zoom)/2+' + dec(119, 1.3).replace('iw', 'ih') + '))';
  const tn = '(n/' + FPS + ')';
  const flash = e.flashs.length ? '0.45*(' + enveloppe(e.flashs.map((b) => [b, 1]), tn, '0.07') + ')' : '0';
  return { z: z.join('*'), x, y, flash };
}

// un plan à l'écran : cadré au format, ses effets, l'étalonnage commun ; muet (le son est fait à part)
async function morceauVideo(src, info, f, e, style, W, H, sortie, i, kbps) {
  const out = path.join(sortie, 'plan-' + String(i).padStart(2, '0') + '.mp4');
  const k = 1.25, W2 = Math.round(W * k / 2) * 2, H2 = Math.round(H * k / 2) * 2;
  const ex = expressions(e, f.duree);
  const vf = [
    'scale=' + W2 + ':' + H2 + ':force_original_aspect_ratio=increase:flags=lanczos', 'crop=' + W2 + ':' + H2, 'setsar=1', 'fps=' + FPS,
    "zoompan=z='" + ex.z + "':x='" + ex.x + "':y='" + ex.y + "':d=1:s=" + W + 'x' + H + ':fps=' + FPS,
    "eq=brightness='" + ex.flash + "':contrast=" + (style === 'net' ? '1.03' : '1.07') + ':saturation=' + (style === 'net' ? '1.03' : '1.08') + ':eval=frame',
    style === 'net' ? null : 'vignette=PI/5', style === 'net' ? null : 'noise=alls=3:allf=t', 'format=yuv420p'
  ].filter(Boolean).join(',');
  const entree = info.image ? ['-loop', '1', '-framerate', String(FPS), '-t', N(f.duree), '-i', src] : ['-ss', N(DEPART), '-t', N(f.duree), '-i', src];
  await lancer(FFMPEG, ['-y', '-loglevel', 'error'].concat(entree, ['-vf', vf, '-an', '-frames:v', String(Math.round(f.duree * FPS)), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-maxrate', (kbps || 9000) + 'k', '-bufsize', (2 * (kbps || 9000)) + 'k', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), out]));
  return out;
}
// son morceau de son : ses bruitages (fondus de quelques millisecondes : pas de clic à la coupe), ou du silence
async function morceauSon(src, info, f, avecSon, sortie, i) {
  const out = path.join(sortie, 'son-' + String(i).padStart(2, '0') + '.wav');
  const D = N(f.duree);
  if (avecSon && info.son && !info.image) {
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-ss', N(DEPART), '-t', D, '-i', src, '-vn', '-af', 'aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.015,afade=t=out:st=' + N(Math.max(0, f.duree - 0.03)) + ':d=0.03,apad=whole_dur=' + D, '-t', D, '-c:a', 'pcm_s16le', out]);
  } else {
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', D, '-c:a', 'pcm_s16le', out]);
  }
  return out;
}
async function picDe(wav) {
  try { return JSON.parse(await lancer(PYTHON, [path.join(__dirname, 'rythme.py'), wav, '--pic'])).pic; } catch (e) { return null; }
}
async function concat(fichiers, sortie, nom) {
  const liste = path.join(sortie, nom + '.txt');
  fs.writeFileSync(liste, fichiers.map((m) => "file '" + m.replace(/'/g, "'\\''") + "'").join('\n'));
  const out = path.join(sortie, nom);
  await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', out]);
  return out;
}

async function monter(cmd, sortie, outils) {
  fs.mkdirSync(sortie, { recursive: true });
  const t0 = Date.now();
  const c = cmd.clip || {};
  const style = ['zooms', 'rap', 'net'].indexOf(c.montage) >= 0 ? c.montage : 'zooms';
  const [W, H] = TAILLES[c.format] || TAILLES['9:16'];
  const avertissements = [];
  const telecharger = (outils && outils.telecharger) || require('./montage').telecharger;
  const local = (x) => !!(outils && outils.local && x && x.fichier && fs.existsSync(x.fichier));

  // 1. les plans et la musique
  const plans = [];
  for (let i = 0; i < (c.plans || []).length; i++) {
    const p = c.plans[i];
    const image = p.type === 'image';
    let fichier = null;
    try {
      if (local(p)) fichier = p.fichier;
      else fichier = await telecharger(String(p.url || ''), path.join(sortie, 'source-' + i + (image ? '.jpg' : '.mp4')));
    } catch (e) { avertissements.push('plan ' + (i + 1) + ' indisponible (' + String(e.message).slice(0, 80) + ') : retiré'); continue; }
    const info = await sonder(fichier);
    if (image) info.image = true;
    const dispo = info.image ? 30 : Math.max(0.5, info.duree - DEPART - 0.05);
    plans.push({ p, fichier, info, dispo });
  }
  if (!plans.length) throw new Error('aucun plan à monter');
  const total0 = plans.reduce((a, x) => a + Math.min(Number(x.p.duree) || 3, x.dispo), 0);
  let musique = null, rythme = null;
  if (c.musique && (c.musique.url || local(c.musique))) {
    try {
      const brut = local(c.musique) ? c.musique.fichier : await telecharger(String(c.musique.url), path.join(sortie, 'musique.source'), 20000);
      const debut = Math.max(0, Number(c.musique.debut) || 0);
      musique = { brut, debut };
      const wav = path.join(sortie, 'musique-analyse.wav');
      await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-ss', N(debut), '-t', N(total0 * 1.4 + 3), '-i', brut, '-ac', '1', '-ar', '22050', wav]);
      rythme = JSON.parse(await lancer(PYTHON, [path.join(__dirname, 'rythme.py'), wav]));
      journal('clip', 'rythme', rythme.tempo + ' BPM', rythme.beats.length + ' temps', rythme.drop != null ? 'drop à ' + rythme.drop + ' s' : 'pas de drop');
    } catch (e) {
      avertissements.push('musique indisponible (' + String(e.message).slice(0, 80) + ') : clip sans musique');
      musique = null; rythme = null;
    }
  }

  // 2. les coupes, sur le rythme
  const fen = calerCoupes(plans.map((x) => Number(x.p.duree) || 3), plans.map((x) => x.dispo), rythme);
  const total = Math.round(fen.reduce((a, f) => a + f.duree, 0) * 1000) / 1000;
  // le débit maximum de l'image suit la durée du clip : le fichier tient sous les 50 Mo du stockage
  const kbps = Math.max(700, Math.min(9000, Math.floor(CIBLE_OCTETS * 8 / Math.max(5, total + (c.fin_noir ? NOIR : 0)) / 1000 - 252)));

  // 3. chaque plan : son son, son moment fort, ses effets, son image
  const videos = [], sons = [];
  for (let i = 0; i < plans.length; i++) {
    const x = plans[i], f = fen[i];
    const son = await morceauSon(x.fichier, x.info, f, c.bruitages !== false, sortie, i);
    const pic = x.info.son && !x.info.image && c.bruitages !== false ? await picDe(son) : null;
    const e = effetsPlan(x.p, f, rythme, style, pic, x.info.image);
    videos.push(await morceauVideo(x.fichier, x.info, f, e, style, W, H, sortie, i, kbps));
    sons.push(son);
  }
  // le noir final : la musique continue dessous
  if (c.fin_noir) {
    const nv = path.join(sortie, 'plan-noir.mp4'), ns = path.join(sortie, 'son-noir.wav');
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=' + W + 'x' + H + ':r=' + FPS, '-t', N(NOIR), '-frames:v', String(Math.round(NOIR * FPS)), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2), nv]);
    await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', N(NOIR), '-c:a', 'pcm_s16le', ns]);
    videos.push(nv); sons.push(ns);
  }
  const duree = Math.round((total + (c.fin_noir ? NOIR : 0)) * 1000) / 1000;
  const image = await concat(videos, sortie, 'images.mp4');
  const bruitages = await concat(sons, sortie, 'bruitages.wav');

  // 4. le son final : les bruitages, la musique par-dessus (fondu sur la dernière seconde), à -14 LUFS
  const finale = path.join(sortie, 'video.mp4');
  const aDesBruits = c.bruitages !== false && plans.some((x) => x.info.son && !x.info.image);
  const args = ['-y', '-loglevel', 'error', '-i', image, '-i', bruitages];
  let filtre;
  if (musique) {
    const fondu = 1.2;
    args.push('-ss', N(musique.debut), '-t', N(duree + 0.5), '-i', musique.brut);
    filtre = '[2:a]aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=' + N(duree) + ',atrim=0:' + N(duree) + ',afade=t=out:st=' + N(Math.max(0, duree - fondu)) + ':d=' + fondu + '[m];' +
      (aDesBruits ? '[1:a]volume=0.6[b];[b][m]amix=inputs=2:normalize=0:duration=first,' : '[m]') + 'alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]';
  } else filtre = aDesBruits ? '[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]' : '[1:a]anull[a]';
  await lancer(FFMPEG, args.concat(['-filter_complex', filtre, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-t', N(duree), '-movflags', '+faststart', finale]));
  await alleger(FFMPEG, finale, duree);
  if (musique && rythme && rythme.duree && rythme.duree + 0.5 < total) avertissements.push('la musique est plus courte que le clip : la fin est sans musique');
  const vignette = path.join(sortie, 'vignette.jpg');
  await lancer(FFMPEG, ['-y', '-loglevel', 'error', '-ss', N(Math.min(total * 0.3, Math.max(0.5, total - 0.5))), '-i', finale, '-frames:v', '1', '-q:v', '3', vignette]);
  [image, bruitages].concat(videos, sons).forEach((m) => { try { fs.unlinkSync(m); } catch (e) { /* déjà parti */ } });
  const taille = fs.statSync(finale).size;
  journal('clip', 'prêt', (taille / 1048576).toFixed(1) + ' Mo', duree + ' s', plans.length + ' plans', style, Math.round((Date.now() - t0) / 1000) + ' s au total');
  return { video: finale, vignette, srt: null, duree, taille, secondes: Math.round((Date.now() - t0) / 1000), avertissements, coupes: fen, rythme: rythme ? { tempo: rythme.tempo, temps: rythme.beats.length, drop: rythme.drop } : null };
}

module.exports = { monter, calerCoupes, effetsPlan, expressions, TAILLES };
