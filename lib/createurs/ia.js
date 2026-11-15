// Lou fait créer les images IA d'une vidéo, avec la clé fal de la créatrice : une image par phrase (FLUX.2 Turbo, en
// vertical, dans le look choisi, avec le même sujet d'une image à l'autre), puis, selon le mouvement choisi, la première
// scène ou toutes les scènes animées en vraie vidéo à partir de leur image (MiniMax H3 Max Turbo).
// Une étape de la chaîne = un tour : envoyer ce qui doit partir, revenir voir ce qui est prêt (45 secondes au plus),
// noter où on en est (plan.generation). Chaque demande est réservée sur son budget du jour avant de partir et rendue si
// fal échoue ; deux essais par image et par animation. À la fin : une image ratée laisse sa place à une vidéo
// d'illustration (Pexels), sinon au fond animé ; une animation ratée laisse l'image, qui zoome doucement.
// « Refaire le montage » reprend les images de moins de 6 jours (fal les garde 14 jours) : seules les scènes dont le
// texte a changé sont refaites.
'use strict';
const C = require('./index');
const CL = require('./claude');
const FAL = require('./fal');
const IM = require('./images');
const { majFraiche } = require('../db');
const { court } = require('../util');

const iso = () => new Date().toISOString();
const ESSAIS = 2;
const PERDUE_MIN = 15;
const REUTILISABLE_JOURS = 6;
let ATTENTE_MS = 45000;
function reglerAttente(ms) { ATTENTE_MS = ms; }
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ce que l'IA reçoit pour l'image d'une phrase : la scène écrite par la plume, l'univers de la vidéo (le même sujet
// partout), le look choisi, et les règles du format
function promptImage(script, beat, ia) {
  const look = C.STYLES_IA[ia.style] || C.STYLES_IA.realiste;
  const v = (beat && beat.visuel) || {};
  const scene = v.prompt || v.requete || v.description || script.image_generale || 'a vivid, concrete scene';
  return court([scene, script.direction || '', look.prompt, 'vertical 9:16 composition, main subject centered, no text, no letters, no logo, no watermark'].filter(Boolean).join('. '), 1500);
}
function promptVideo(beat) {
  const v = (beat && beat.visuel) || {};
  return court([v.mouvement || 'slow cinematic push-in, subtle natural motion', v.prompt ? 'Scene: ' + v.prompt : '', 'keep the exact look and subject of the image, no text appears'].filter(Boolean).join('. '), 900);
}
// la durée animée d'une phrase : le temps de la dire (2,8 mots par seconde), un peu de marge, entre 2,5 et 8 secondes
function dureeVideo(beat) {
  const mots = String((beat && beat.voix) || '').replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
  return Math.round(Math.min(8, Math.max(2.5, mots / 2.8 + 0.6)) * 10) / 10;
}
const avecVideo = (mouvement, i) => mouvement === 'tout' || (mouvement === 'accroche' && i === 0);

// le point de départ d'une réalisation : les images et les animations encore bonnes de la fois d'avant sont gardées
// (même texte, moins de 6 jours, ou un tour en cours), les autres repartent
function etatInitial(script, ia, avant) {
  const beats = script.beats || [];
  const frais = avant && (!avant.fin_le || Date.now() - new Date(avant.fin_le).getTime() < REUTILISABLE_JOURS * 86400000) ? avant : null;
  const images = beats.map((b, i) => {
    const p = promptImage(script, b, ia);
    const a = frais && (frais.images || [])[i];
    return a && a.prompt === p && a.etat !== 'echec' ? a : { prompt: p, etat: 'attente', essais: 0 };
  });
  const videos = beats.map((b, i) => {
    if (!avecVideo(ia.mouvement, i)) return null;
    const p = promptVideo(b);
    const a = frais && (frais.videos || [])[i];
    const memeImage = frais && images[i] === (frais.images || [])[i];
    return a && memeImage && a.prompt === p && a.etat !== 'echec' ? a : { prompt: p, duree: dureeVideo(b), etat: 'attente', essais: 0 };
  });
  return { style: ia.style, mouvement: ia.mouvement, images, videos, cout: frais ? Number(frais.cout) || 0 : 0, debut_le: (frais && frais.debut_le) || iso(), fin_le: null };
}

function progresDe(g) {
  const vd = g.videos.filter(Boolean);
  const fini = (l) => l.filter((j) => j.etat === 'fini').length;
  return { images: [fini(g.images), g.images.length], videos: [fini(vd), vd.length], ratees: g.images.concat(vd).filter((j) => j.etat === 'echec').length };
}
const reste = (g) => g.images.some((j) => j.etat !== 'fini' && j.etat !== 'echec') || g.videos.some((j) => j && j.etat !== 'fini' && j.etat !== 'echec');

// Un tour de réalisation. Rend { fini, generation, progres }. Une clé absente, refusée ou sans crédit, ou le budget du
// jour atteint, lèvent une erreur (la chaîne met la vidéo en attente, avec le message pour la créatrice).
async function realiser(db, c, v) {
  const k = FAL.cle(c);
  const r = C.reglagesDe(c);
  const script = v.script || {};
  if (!(script.beats || []).length) throw new Error('pas de script à illustrer');
  const plan = v.plan || {};
  const ia = C.nettoyerIa(plan.ia, r.ia);
  const tour = String((v.etape || {}).depuis || 'premier');
  const g = JSON.parse(JSON.stringify(plan.generation && plan.generation.tour === tour && (plan.generation.images || []).length === script.beats.length
    ? plan.generation : Object.assign(etatInitial(script, ia, plan.generation), { tour })));
  // la même graine pour toutes les images d'une vidéo : un air de famille d'une scène à l'autre
  const graine = (Number(v.id) * 7919 + 17) % 2147483647;
  let depense = 0;

  async function sauver() {
    const delta = Math.round(depense * 10000) / 10000;
    depense = 0;
    g.cout = Math.round(((Number(g.cout) || 0) + delta) * 10000) / 10000;
    const progres = progresDe(g);
    await majFraiche(db, 'hq_crea_videos', v.id, (f) => (f.status !== 'realisation' ? null : {
      plan: Object.assign({}, f.plan || {}, { generation: g }),
      cout_usd: Math.round(((Number(f.cout_usd) || 0) + delta) * 10000) / 10000,
      etape: Object.assign({}, f.etape || {}, { quoi: 'images_ia', progres })
    }));
  }
  // réserver, envoyer ; une demande refusée pour de bon (texte refusé par exemple) compte comme un essai raté
  async function envoyer(j, modele, entree, prix) {
    const resa = await CL.compter(db, c, prix, r.budget_jour);
    if (!resa.ok) throw new CL.ErreurStudio('budget', CL.MESSAGES.budget);
    depense += prix;
    try {
      const d = await FAL.envoyer(k, modele, entree);
      Object.assign(j, { etat: 'demande', id: d.id, statut: d.statut, resultat: d.resultat, demande_le: iso(), essais: (j.essais || 0) + 1, prix, erreur: null });
    } catch (e) {
      await CL.compter(db, c, -prix);
      depense -= prix;
      if (!e.definitif) throw e;
      j.essais = (j.essais || 0) + 1;
      j.erreur = court(e.message, 200);
      if (j.essais >= ESSAIS) j.etat = 'echec';
    }
  }
  // revenir voir une demande ; ratée chez fal (rien n'est facturé), sa réservation est rendue
  async function relever(j, type) {
    if (Date.now() - new Date(j.demande_le || 0).getTime() > PERDUE_MIN * 60000) {
      j.erreur = 'pas de nouvelles de fal'; j.etat = j.essais >= ESSAIS ? 'echec' : 'attente'; j.prix = 0;
      return;
    }
    const s = await FAL.suivre(k, j);
    if (s.etat === 'attente' || s.etat === 'en_cours') return;
    if (s.etat === 'fini') {
      const x = type === 'image' ? FAL.lireImage(s.sortie) : FAL.lireVideo(s.sortie);
      if (x.url) { Object.assign(j, { etat: 'fini', url: x.url, w: x.w || undefined, h: x.h || undefined, fini_le: iso(), erreur: null }); return; }
      // rendue mais inutilisable (écartée par le filtre) : fal l'a facturée, on réessaie une fois
      j.erreur = court(x.erreur, 200);
    } else {
      if (j.prix) { await CL.compter(db, c, -j.prix); depense -= j.prix; }
      j.erreur = court(s.erreur || 'demande perdue chez fal', 200);
    }
    j.prix = 0;
    j.etat = (j.essais || 0) >= ESSAIS ? 'echec' : 'attente';
  }

  const fin = Date.now() + ATTENTE_MS;
  let surcharge = null;
  try {
    for (;;) {
      if (!surcharge) {
        try {
          for (const j of g.images) if (j.etat === 'attente') await envoyer(j, FAL.MODELES.image.id, FAL.entreeImage(j.prompt, graine), FAL.MODELES.image.prix);
          for (let i = 0; i < g.videos.length; i++) {
            const j = g.videos[i], im = g.images[i];
            if (!j || j.etat === 'fini' || j.etat === 'echec') continue;
            if (im.etat === 'echec') { j.etat = 'echec'; j.erreur = 'pas d\'image à animer'; continue; }
            if (j.etat === 'attente' && im.etat === 'fini') await envoyer(j, FAL.MODELES.video.id, FAL.entreeVideo(im.url, j.prompt, j.duree), FAL.prixVideo(j.duree));
          }
        } catch (e) {
          if (e.code !== 'fal_surcharge') throw e;
          surcharge = e;
        }
        await sauver();
      }
      const enCours = g.images.map((j) => [j, 'image']).concat(g.videos.map((j) => [j, 'video'])).filter((x) => x[0] && x[0].etat === 'demande');
      for (const [j, type] of enCours) await relever(j, type);
      if (!reste(g)) break;
      // fal en difficulté et plus rien en route : la chaîne réessaiera plus tard
      if (surcharge && !enCours.length) throw surcharge;
      if (Date.now() >= fin) break;
      const aEnvoyer = !surcharge && (g.images.some((j) => j.etat === 'attente') || g.videos.some((j, i) => j && j.etat === 'attente' && g.images[i].etat === 'fini'));
      if (!aEnvoyer) await pause(Math.min(4000, Math.max(0, fin - Date.now())));
    }
    if ((c.secrets || {}).fal && (c.secrets.fal.etat || 'ok') !== 'ok') await FAL.marquer(db, c, 'ok');
  } catch (e) {
    if (e.code === 'fal_refusee') await FAL.marquer(db, c, 'refusee', 'fal a refusé la clé le ' + new Date().toLocaleDateString('fr-FR'));
    if (e.code === 'fal_credit') await FAL.marquer(db, c, 'credit', 'plus de crédit chez fal');
    throw e;
  } finally {
    if (!reste(g) && !g.fin_le) g.fin_le = iso();
    await sauver();
  }
  return { fini: !reste(g), generation: g, progres: progresDe(g) };
}

// Les images de chaque phrase pour l'usine : la vidéo IA si elle existe, sinon l'image IA (qui zoomera), sinon une vidéo
// d'illustration de Pexels (la plume a aussi écrit une recherche pour ça), sinon rien (le fond animé)
async function assembler(script, g) {
  const beats = script.beats || [];
  const clips = beats.map((b, i) => {
    const vd = g.videos[i], im = g.images[i];
    if (vd && vd.etat === 'fini') return { url: vd.url, type: 'video', duree: vd.duree };
    if (im && im.etat === 'fini') return { url: im.url, type: 'image', w: im.w, h: im.h };
    return null;
  });
  const trous = clips.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  let credits = [];
  const notes = [];
  if (trous.length) {
    const res = await IM.choisir({ beats: trous.map((i) => beats[i]), image_generale: script.image_generale });
    trous.forEach((i, n) => { if (res.clips[n]) clips[i] = Object.assign({ type: 'clip' }, res.clips[n]); });
    credits = res.credits;
    const remplacees = res.clips.filter(Boolean).length;
    notes.push(trous.length + (trous.length > 1 ? ' images IA n\'ont pas pu être faites' : ' image IA n\'a pas pu être faite') + (remplacees ? ' : vidéo d\'illustration à la place' : ' : fond animé à la place'));
  }
  const animRatees = g.videos.filter((j) => j && j.etat === 'echec').length;
  if (animRatees) notes.push(animRatees + (animRatees > 1 ? ' animations ratées' : ' animation ratée') + ' : l\'image zoome à la place');
  return { clips, credits, manquants: clips.filter((x) => !x).length, avertissement: notes.join(' ; ') || null };
}

module.exports = { realiser, assembler, etatInitial, promptImage, promptVideo, dureeVideo, progresDe, reglerAttente, ESSAIS };
