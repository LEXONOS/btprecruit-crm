// Les clips : elle colle un prompt de réalisateur (des personnages, un style, des plans minutés, des sons), son équipe
// en fait un vrai clip, filmé plan par plan par IA puis monté sur le rythme.
//   ecriture      Lou découpe le prompt en plans (sa clé Claude) : les éléments qui reviennent, le style, chaque plan
//   realisation   phase « images » (sa clé fal) : une image de référence par élément qui revient, puis l'image clé de
//                 chaque plan à partir de ces références (les mêmes personnages d'un plan à l'autre)
//   relecture     si elle a choisi de valider : elle regarde les images, refait celles qui ne vont pas, accepte le prix
//                 du tournage
//   realisation   phase « tournage » : chaque plan filmé à partir de son image clé, les bruitages des plans muets, la
//                 musique créée si elle l'a demandée
//   fabrication   l'usine monte (usine/clip.js) : coupes sur le rythme, zooms, secousses, flashs, le son → prete
// Le budget : un clip coûte des dollars, pas des centimes. Il ne passe pas par son budget du jour (fait pour l'équipe
// automatique) mais par le budget qu'elle accepte pour ce clip, au lancement puis au tournage. Chaque demande à fal est
// réservée sur ce budget avant de partir, rendue si fal échoue ; la dépense compte quand même dans son total du jour et
// du mois. Un plan raté deux fois laisse son image clé, qui bouge doucement.
'use strict';
const crypto = require('crypto');
const C = require('./index');
const CL = require('./claude');
const FAL = require('./fal');
const E = require('./equipe');
const ST = require('../studio/stockage');
const { majFraiche } = require('../db');
const { court } = require('../util');

const iso = () => new Date().toISOString();
const ESSAIS = 2;
const PERDUE_MIN = { image: 15, video: 35, son: 15, musique: 20 };
// fal garde les fichiers 14 jours : un plan de moins de 13 jours se reprend sans rien payer
const REUTILISABLE_JOURS = 13;
let ATTENTE_MS = 45000;
function reglerAttente(ms) { ATTENTE_MS = ms; }
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
const arrondi = (x) => Math.round((Number(x) || 0) * 10000) / 10000;
const usd = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
const maj = (db, id, fn) => majFraiche(db, 'hq_crea_videos', id, fn);

const QUALITES = {
  rapide: { nom: 'Rapide', court: 'Le moins cher, pour essayer une idée' },
  hd: { nom: 'HD', court: 'Net en 1080p : le bon choix pour publier' },
  cinema: { nom: 'Cinéma', court: 'Le meilleur rendu du moment' }
};
const MONTAGES = {
  zooms: { nom: 'Zooms tendance', court: 'La caméra avance et zoome sur chaque temps de la musique' },
  rap: { nom: 'Clip de rap', court: 'Coupes sur les temps forts, coups de zoom, secousses et flashs' },
  net: { nom: 'Coupes franches', court: 'Coupé sur le rythme, sans effet' }
};
const FORMATS = { '9:16': { nom: 'Vertical', court: 'TikTok, Shorts, Reels' }, '16:9': { nom: 'Horizontal', court: 'YouTube' }, '1:1': { nom: 'Carré', court: 'Instagram' } };
const SOURCES = { aucune: 'Sans musique', fichier: 'Mon fichier audio', ia: 'Créée pour le clip' };
const DUREES = ['auto', '15', '30', '45', '60'];
const PROMPT_MAX = 8000;
const SON_MAX = 30 * 1048576;
const TYPES_SON = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg' };
const TYPE_PROPRE = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg' };

const estClip = (v) => !!(v && v.plan && v.plan.genre === 'clip');
const lou = (c) => C.equipeDe(c).realisation.prenom;

/* ── ce que la page sait des clips ── */
function catalogue() {
  const V = FAL.MODELES.clip.videos;
  return {
    qualites: Object.fromEntries(Object.keys(QUALITES).map((k) => [k, Object.assign({}, QUALITES[k], { modele: V[k].nom, seconde: V[k].seconde, minimum: V[k].min, maximum: V[k].max, marge: V[k].marge, entier: V[k].entier, son: V[k].son, image: FAL.prixImageClip(V[k].image) })])),
    montages: MONTAGES, formats: FORMATS, sources: SOURCES, durees: DUREES,
    prix: { bruitages: FAL.MODELES.clip.bruitages.seconde, musique_minute: FAL.MODELES.clip.musique.minute },
    modeles: { image: FAL.MODELES.clip.image.nom, bruitages: FAL.MODELES.clip.bruitages.nom, musique: FAL.MODELES.clip.musique.nom },
    limites: { prompt: PROMPT_MAX, son: SON_MAX, plans: 16, secondes: 60 }
  };
}

/* ── le prix ── */
// les secondes de chaque plan, lues dans son prompt quand elle les donne : « (3s) », « (2 sec) », « (4 secondes) »
function dureesDuPrompt(prompt) {
  const out = [];
  String(prompt || '').replace(/\(\s*(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|secondes?|seconds?)\s*\)/gi, (m, n) => { out.push(Number(n.replace(',', '.'))); return m; });
  return out.filter((n) => n > 0 && n <= 20).slice(0, 16);
}
// Ce que coûte un clip sur sa clé fal : les images (références et images clés), les plans filmés, les bruitages des
// plans muets, la musique créée. Avant le découpage, les plans sont lus dans son prompt (ils passent avant la durée
// choisie : son minutage est la référence) ou imaginés (un plan toutes les 2,7 secondes) ; après, ce sont ceux du
// découpage.
function estimer(o) {
  o = o || {};
  const q = FAL.MODELES.clip.videos[o.qualite] ? o.qualite : 'hd';
  const m = FAL.MODELES.clip.videos[q];
  let durees = Array.isArray(o.plans) && o.plans.length ? o.plans.map(Number) : null;
  if (!durees) {
    const lues = dureesDuPrompt(o.prompt);
    const auto = !o.duree || o.duree === 'auto';
    if (lues.length) durees = lues;
    else {
      const total = auto ? 30 : Math.min(60, Math.max(5, Number(o.duree) || 30));
      const n = Math.max(1, Math.round(total / 2.7));
      durees = Array.from({ length: n }, () => Math.round(total / n * 10) / 10);
    }
  }
  const secondes = durees.reduce((a, b) => a + b, 0);
  const elements = o.elements != null ? Number(o.elements) : 2;
  const images = arrondi((durees.length + elements) * FAL.prixImageClip(m.image));
  const video = arrondi(durees.reduce((a, d) => a + FAL.prixPlan(q, d), 0));
  const sons = !m.son && o.bruitages !== false ? arrondi(durees.reduce((a, d) => a + FAL.prixBruitages(FAL.dureePlan(q, d)), 0)) : 0;
  const musique = o.musique === 'ia' ? FAL.prixMusique(secondes + 2.5) : 0;
  return { plans: durees.length, secondes: Math.round(secondes * 10) / 10, images, video, sons, musique, tournage: arrondi(video + sons + musique), total: arrondi(images + video + sons + musique) };
}

/* ── la musique qu'elle envoie (un fichier à elle) ── */
const cheminSonValide = (createurId, c) => new RegExp('^crea/' + Number(createurId) + '/sons/[a-f0-9]{12}-[a-z0-9-]{1,50}\\.(mp3|m4a|aac|wav|ogg)$').test(String(c || ''));
function nomPropre(nom) {
  return String(nom || 'son').replace(/\.[^.]*$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'son';
}
// un lien d'envoi droit dans le stockage (le fichier ne passe pas par la tour) : crea/<compte>/sons/<hasard>-<nom>.<ext>
async function preparerSon(createurId, f) {
  f = f || {};
  const ext = TYPES_SON[String(f.type || '').toLowerCase()] || (/\.(mp3|m4a|aac|wav|ogg)$/i.exec(String(f.nom || '')) || [])[1];
  if (!ext) return { code: 400, erreur: 'ce fichier n\'est pas un son (mp3, m4a, aac, wav ou ogg)' };
  const taille = Number(f.taille) || 0;
  if (taille > SON_MAX) return { code: 400, erreur: 'fichier trop lourd : ' + Math.round(SON_MAX / 1048576) + ' Mo au plus' };
  const e = String(ext).toLowerCase();
  const chemin = 'crea/' + Number(createurId) + '/sons/' + crypto.randomBytes(6).toString('hex') + '-' + nomPropre(f.nom) + '.' + e;
  const url = await ST.lienEnvoi(chemin);
  return { code: 200, chemin, url, type: TYPE_PROPRE[e] };
}

// la musique choisie, passée au tamis (et le fichier, s'il y en a un, doit être arrivé dans le stockage)
async function nettoyerMusique(createurId, m, avant) {
  m = m && typeof m === 'object' ? m : {};
  const a = avant || {};
  const source = SOURCES[m.source] ? m.source : (a.source || 'aucune');
  const out = { source };
  if (source === 'fichier') {
    const chemin = m.chemin != null ? String(m.chemin) : a.chemin;
    if (!cheminSonValide(createurId, chemin)) return { erreur: 'envoie d\'abord ton fichier audio' };
    if (chemin !== a.chemin && !(await ST.existe(chemin).catch(() => false))) return { erreur: 'ton fichier audio n\'est pas arrivé : renvoie-le' };
    out.chemin = chemin;
    out.nom = court(String((m.nom != null ? m.nom : a.nom) || 'mon son').replace(/[<>]/g, ''), 80);
    const debut = Number(m.debut != null ? m.debut : a.debut);
    out.debut = Number.isFinite(debut) ? Math.round(Math.min(600, Math.max(0, debut)) * 10) / 10 : 0;
  }
  if (source === 'ia') out.idee = court(String((m.idee != null ? m.idee : a.idee) || '').replace(/[<>]/g, '').trim(), 300);
  return { musique: out };
}

/* ── lancer un clip ── */
// ce qu'elle a choisi, passé au tamis ; rend { clip } (le plan de la vidéo) ou { erreur }
async function preparer(createur, o) {
  o = o || {};
  const prompt = String(o.prompt || '').replace(/\r/g, '').replace(/[<>]/g, '').replace(/\n{4,}/g, '\n\n\n').trim();
  if (prompt.length < 20) return { erreur: 'colle ton prompt : quelques phrases au moins' };
  if (prompt.length > PROMPT_MAX) return { erreur: 'ton prompt est trop long (' + PROMPT_MAX + ' signes au plus)' };
  if (!(createur.secrets || {}).fal) return { erreur: 'branche d\'abord ta clé fal (Réglages, Connexions) : les images et les plans du clip se font sur ton compte fal' };
  const mus = await nettoyerMusique(createur.id, o.musique, null);
  if (mus.erreur) return mus;
  const clip = {
    prompt,
    format: FORMATS[o.format] ? o.format : '9:16',
    qualite: QUALITES[o.qualite] ? o.qualite : 'hd',
    montage: MONTAGES[o.montage] ? o.montage : 'zooms',
    bruitages: o.bruitages !== false,
    valider: o.valider !== false,
    // un prompt minuté (« Shot 1 (3s) ») garde sa durée : choisir 60 s en plus inventerait des plans qu'elle n'a pas écrits
    duree: !dureesDuPrompt(prompt).length && DUREES.indexOf(String(o.duree)) >= 0 ? String(o.duree) : 'auto',
    musique: mus.musique
  };
  const est = estimer(Object.assign({}, clip, { musique: clip.musique.source }));
  // le budget accepté au lancement : les images seules si elle valide avant le tournage, tout le clip sinon (avec de
  // quoi refaire ce qui rate)
  clip.estime = est.total;
  clip.budget = arrondi((clip.valider ? est.images * 1.5 : est.total * 1.25) + 0.1);
  return { clip };
}

/* ── le découpage (Lou, sur sa clé Claude) ── */
async function decouper(db, c, v) {
  const e = v.etape || {};
  const clip = (v.plan || {}).clip || {};
  const res = await E.decouperClip(db, c, v, { consigne: e.consigne || null, precedent: e.consigne ? clip.storyboard : null });
  const s = res.storyboard;
  await maj(db, v.id, (f) => {
    if (f.status !== 'ecriture') return null;
    const plan = Object.assign({}, f.plan || {});
    plan.clip = Object.assign({}, plan.clip || {}, { storyboard: s });
    return {
      plan, titre: s.titre || f.titre, script: { titre: s.titre, description: s.description, hashtags: s.hashtags, titre_youtube: s.titre_youtube },
      cout_usd: arrondi((Number(f.cout_usd) || 0) + (Number(res.cout) || 0)), status: 'realisation', etape: { quoi: 'images', depuis: iso() }
    };
  });
  return lou(c) + ' a découpé ton prompt en ' + s.plans.length + ' plans';
}

/* ── ce que reçoivent les modèles ── */
const FORMAT_EN = { '9:16': 'vertical 9:16 frame', '16:9': 'horizontal 16:9 frame', '1:1': 'square 1:1 frame' };
function promptReference(e, sb) {
  const quoi = e.type === 'personnage' ? 'Character reference image of ' + e.nom_en + ': full body from head to feet, standing, three-quarter front view, plain light grey studio background, soft even light'
    : e.type === 'lieu' ? 'Location reference image of ' + e.nom_en + ': wide establishing view, no people'
      : 'Object reference image of ' + e.nom_en + ': the whole object visible, three-quarter view, plain light grey studio background';
  return court([quoi, e.description, sb.style, 'No text, no letters, no watermark.'].filter(Boolean).join('. ').replace(/\.\./g, '.'), 2400);
}
function promptImage(p, sb, format) {
  return court(['One frame of the film: ' + p.image, sb.coherence, sb.style, (FORMAT_EN[format] || FORMAT_EN['9:16']) + ', no text, no captions, no letters, no watermark, no borders'].filter(Boolean).join('. ').replace(/\.\./g, '.'), 3000);
}
// l'image clé d'un plan : ce que montre chaque image de référence (dans l'ordre où elles partent), et de les garder telles
// quelles ; puis la scène
function avecReferences(prompt, refs) {
  if (!refs.length) return prompt;
  const qui = refs.map((r, i) => 'Reference image ' + (i + 1) + ' shows ' + r.nom_en + '.').join(' ');
  return court(qui + ' Keep ' + (refs.length > 1 ? 'each of them exactly as in its reference image' : 'it exactly as in the reference image') + ': same design, colors, materials and accessories. ' + prompt, 3800);
}
function promptVideo(p, sb, q) {
  const son = (FAL.MODELES.clip.videos[q] || {}).son;
  return court([p.mouvement, sb.coherence, sb.style ? 'Look: ' + court(sb.style, 300) : '', son ? (p.son ? 'Sound: ' + p.son + '. No music, no dialogue.' : 'Natural ambient sound only, no music, no dialogue.') : '', 'No text or subtitles appear.'].filter(Boolean).join(' '), 2400);
}
const promptSon = (p) => court(p.son || 'natural ambient sound of the scene', 300);
function promptMusique(clip, sb) {
  const idee = (clip.musique || {}).idee || '';
  return court([sb.musique || idee || 'modern cinematic instrumental with a strong beat', 'Instrumental only, no vocals. A strong, clear beat from the very first second (no long intro), punchy drums, ends on a final hit.'].filter(Boolean).join(' '), 1200);
}
const secondesMusique = (sb) => Math.round(((sb.plans || []).reduce((a, p) => a + p.duree, 0) + (sb.fin_noir ? 0.8 : 0) + 1.5) * 10) / 10;

/* ── l'état de la fabrication d'un clip (plan.clip.gen) ── */
// aligné sur le découpage : ce qui a le même texte est gardé tel quel (fait, en route, ou raté deux fois : seule une
// reprise le relance), sauf ce qui a été fait il y a plus de 13 jours ; le reste repart ; un plan dont l'image clé
// change est refait, ses bruitages aussi
function etatDe(clip, sb) {
  const g = clip.gen && typeof clip.gen === 'object' ? clip.gen : {};
  const q = FAL.MODELES.clip.videos[clip.qualite] ? clip.qualite : 'hd';
  const mv = FAL.MODELES.clip.videos[q];
  const vieux = (j) => !!(j && j.fini_le && Date.now() - new Date(j.fini_le).getTime() > REUTILISABLE_JOURS * 86400000);
  const bon = (j, prompt) => !!(j && j.prompt === prompt && !vieux(j));
  const neuf = (prompt, extra) => Object.assign({ prompt, etat: 'attente', essais: 0 }, extra || {});
  const refs = (sb.elements || []).map((e) => {
    const p = promptReference(e, sb);
    const a = (g.refs || []).find((x) => x && x.el === e.id);
    return bon(a, p) ? a : neuf(p, { el: e.id });
  });
  const refsGardees = refs.every((r) => (g.refs || []).indexOf(r) >= 0);
  const images = (sb.plans || []).map((p, i) => {
    const pr = promptImage(p, sb, clip.format);
    const a = (g.images || [])[i];
    // une référence refaite : les images de ses plans aussi
    const refaite = !refsGardees && p.elements.some((id) => { const r = refs.find((x) => x.el === id); return r && (g.refs || []).indexOf(r) < 0; });
    return bon(a, pr) && !refaite ? a : neuf(pr);
  });
  const videos = (sb.plans || []).map((p, i) => {
    const pr = promptVideo(p, sb, q);
    const d = FAL.dureePlan(q, p.duree);
    const a = (g.videos || [])[i];
    const memeImage = images[i] === (g.images || [])[i];
    return memeImage && bon(a, pr) && a.q === q && a.duree === d ? a : neuf(pr, { q, duree: d });
  });
  const sons = !mv.son && clip.bruitages !== false ? (sb.plans || []).map((p, i) => {
    const pr = promptSon(p);
    const a = (g.sons || [])[i];
    return videos[i] === (g.videos || [])[i] && bon(a, pr) ? a : neuf(pr);
  }) : [];
  let musique = null;
  if ((clip.musique || {}).source === 'ia') {
    const pr = promptMusique(clip, sb), s = secondesMusique(sb);
    musique = bon(g.musique, pr) && g.musique.secondes === s ? g.musique : neuf(pr, { secondes: s });
  }
  return { refs, images, videos, sons, musique, cout: Number(g.cout) || 0 };
}
const finis = (l) => l.filter((j) => j && j.etat === 'fini').length;
function progresDe(g) {
  return { refs: [finis(g.refs), g.refs.length], images: [finis(g.images), g.images.length], videos: [finis(g.videos), g.videos.length], sons: [finis(g.sons), g.sons.length], musique: g.musique ? g.musique.etat : null };
}
const enRoute = (j) => !!j && j.etat !== 'fini' && j.etat !== 'echec';
function reste(g, phase) {
  if (g.refs.some(enRoute) || g.images.some(enRoute)) return true;
  return phase === 'tournage' && (g.videos.some(enRoute) || g.sons.some(enRoute) || enRoute(g.musique));
}

// Ce qu'il reste à payer : ce qui va partir chez fal (les images à faire, les plans à filmer, leurs bruitages, la
// musique), pas ce qui a raté deux fois ni ce qui dépend d'une image ratée
function aPayer(v) {
  const clip = (v.plan || {}).clip || {};
  const sb = clip.storyboard;
  if (!sb) return 0;
  const g = etatDe(clip, sb);
  const q = FAL.MODELES.clip.videos[clip.qualite] ? clip.qualite : 'hd';
  const res = FAL.MODELES.clip.videos[q].image;
  let t = 0;
  g.refs.concat(g.images).forEach((j) => { if (j.etat === 'attente') t += FAL.prixImageClip(res); });
  sb.plans.forEach((p, i) => {
    if (g.images[i].etat === 'echec') return;
    if (g.videos[i].etat === 'attente') t += FAL.prixPlan(q, p.duree);
    if (g.sons[i] && g.sons[i].etat === 'attente' && g.videos[i].etat !== 'echec') t += FAL.prixBruitages(FAL.dureePlan(q, p.duree));
  });
  if (g.musique && g.musique.etat === 'attente') t += FAL.prixMusique(g.musique.secondes);
  return arrondi(t);
}

/* ── un tour de fabrication (images, ou tournage) ── */
// Rend { fini, phase, progres, generation }. Une clé absente, refusée ou sans crédit, ou le budget du clip atteint,
// lèvent une erreur (la chaîne met le clip en attente, avec le message pour elle).
async function realiser(db, c, v) {
  const k = FAL.cle(c);
  const plan = v.plan || {};
  const clip = plan.clip || {};
  const sb = clip.storyboard;
  if (!sb || !(sb.plans || []).length) throw new Error('pas de découpage à tourner');
  const phase = (v.etape || {}).quoi === 'tournage' ? 'tournage' : 'images';
  const q = FAL.MODELES.clip.videos[clip.qualite] ? clip.qualite : 'hd';
  const mv = FAL.MODELES.clip.videos[q];
  const res = mv.image;
  const g = JSON.parse(JSON.stringify(etatDe(clip, sb)));
  const budget = Number(clip.budget) || 0;
  // la même graine pour toutes les images d'un clip : un air de famille d'un plan à l'autre
  const graine = (Number(v.id) * 7919 + 17) % 2147483647;
  let depense = 0;

  async function sauver() {
    const delta = arrondi(depense);
    depense = 0;
    g.cout = arrondi((Number(g.cout) || 0) + delta);
    const progres = progresDe(g);
    await maj(db, v.id, (f) => {
      if (f.status !== 'realisation') return null;
      const pl = Object.assign({}, f.plan || {});
      pl.clip = Object.assign({}, pl.clip || {}, { gen: g });
      return { plan: pl, cout_usd: arrondi((Number(f.cout_usd) || 0) + delta), etape: Object.assign({}, f.etape || {}, { progres }) };
    });
  }
  // réserver sur le budget du clip, envoyer ; une demande refusée pour de bon compte comme un essai raté
  async function envoyer(j, modele, entree, prix) {
    if (arrondi((Number(g.cout) || 0) + depense + prix) > arrondi(budget) + 0.0001) {
      const e = new CL.ErreurStudio('budget_clip', 'Ce clip a utilisé le budget que tu as accepté (' + usd(budget) + ') : accepte un peu plus pour qu\'il continue.');
      e.budget = budget;
      throw e;
    }
    const r = await CL.compter(db, c, prix, null);
    if (!r || !r.ok) throw new CL.ErreurStudio('budget', CL.MESSAGES.budget);
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
    if (Date.now() - new Date(j.demande_le || 0).getTime() > PERDUE_MIN[type] * 60000) {
      j.erreur = 'pas de nouvelles de fal'; j.etat = j.essais >= ESSAIS ? 'echec' : 'attente'; j.prix = 0;
      return;
    }
    const s = await FAL.suivre(k, j);
    if (s.etat === 'attente' || s.etat === 'en_cours') return;
    if (s.etat === 'fini') {
      const x = type === 'image' ? FAL.lireImage(s.sortie) : type === 'musique' ? FAL.lireAudio(s.sortie) : FAL.lireVideo(s.sortie);
      if (x.url) { Object.assign(j, { etat: 'fini', url: x.url, fini_le: iso(), erreur: null }); return; }
      // rendue mais inutilisable (écartée par le filtre) : fal l'a facturée, on réessaie une fois
      j.erreur = court(x.erreur, 200);
    } else {
      if (j.prix) { await CL.compter(db, c, -j.prix); depense -= j.prix; }
      j.erreur = court(s.erreur || 'demande perdue chez fal', 200);
    }
    j.prix = 0;
    j.etat = (j.essais || 0) >= ESSAIS ? 'echec' : 'attente';
  }
  const consigne = (j) => (j.consigne ? ' Change requested: ' + court(j.consigne, 400) : '');

  // les références d'abord, puis l'image clé de chaque plan dont les références sont prêtes
  async function lancerImages() {
    for (const j of g.refs) {
      if (j.etat !== 'attente') continue;
      const el = sb.elements.find((e) => e.id === j.el) || {};
      await envoyer(j, FAL.MODELES.clip.reference.id, FAL.entreeReference(j.prompt + consigne(j), el.type, res, graine), FAL.prixImageClip(res));
    }
    for (let i = 0; i < g.images.length; i++) {
      const j = g.images[i];
      if (j.etat !== 'attente') continue;
      const ids = sb.plans[i].elements;
      const siens = ids.map((id) => g.refs.find((r) => r.el === id)).filter(Boolean);
      if (siens.some(enRoute)) continue;
      const prets = siens.filter((r) => r.etat === 'fini');
      const noms = prets.map((r) => sb.elements.find((e) => e.id === r.el));
      const prompt = avecReferences(j.prompt + consigne(j), noms);
      await envoyer(j, prets.length ? FAL.MODELES.clip.image.id : FAL.MODELES.clip.reference.id, FAL.entreeImageCle(prompt, prets.map((r) => r.url), clip.format, res, graine), FAL.prixImageClip(res));
    }
  }
  // chaque plan filmé dès que son image clé est prête ; ses bruitages dès qu'il est filmé ; la musique tout de suite
  async function lancerTournage() {
    await lancerImages();
    for (let i = 0; i < g.videos.length; i++) {
      const j = g.videos[i], im = g.images[i];
      if (j.etat === 'fini' || j.etat === 'echec') continue;
      if (im.etat === 'echec') { j.etat = 'echec'; j.erreur = 'pas d\'image clé'; continue; }
      if (j.etat === 'attente' && im.etat === 'fini') await envoyer(j, mv.id, FAL.entreePlan(q, im.url, j.prompt, sb.plans[i].duree), FAL.prixPlan(q, sb.plans[i].duree));
    }
    for (let i = 0; i < g.sons.length; i++) {
      const j = g.sons[i], vd = g.videos[i];
      if (!j || j.etat === 'fini' || j.etat === 'echec') continue;
      if (vd.etat === 'echec') { j.etat = 'echec'; j.erreur = 'pas de plan filmé'; continue; }
      if (j.etat === 'attente' && vd.etat === 'fini') await envoyer(j, FAL.MODELES.clip.bruitages.id, FAL.entreeBruitages(vd.url, j.prompt, vd.duree), FAL.prixBruitages(vd.duree));
    }
    if (g.musique && g.musique.etat === 'attente') await envoyer(g.musique, FAL.MODELES.clip.musique.id, FAL.entreeMusique(g.musique.prompt, g.musique.secondes), FAL.prixMusique(g.musique.secondes));
  }
  const tous = () => g.refs.map((j) => [j, 'image']).concat(g.images.map((j) => [j, 'image']), g.videos.map((j) => [j, 'video']), g.sons.map((j) => [j, 'son']), g.musique ? [[g.musique, 'musique']] : []);
  const aEnvoyer = () => tous().some(([j, type]) => {
    if (!j || j.etat !== 'attente') return false;
    if (phase === 'images' && type !== 'image') return false;
    return true;
  });

  const fin = Date.now() + ATTENTE_MS;
  let surcharge = null;
  try {
    for (;;) {
      if (!surcharge) {
        try { if (phase === 'images') await lancerImages(); else await lancerTournage(); }
        catch (e) { if (e.code !== 'fal_surcharge') throw e; surcharge = e; }
        await sauver();
      }
      const enCours = tous().filter(([j]) => j && j.etat === 'demande');
      for (const [j, type] of enCours) await relever(j, type);
      if (!reste(g, phase)) break;
      // fal en difficulté et plus rien en route : la chaîne réessaiera plus tard
      if (surcharge && !enCours.length) throw surcharge;
      if (Date.now() >= fin) break;
      if (!aEnvoyer() || surcharge) await pause(Math.min(4000, Math.max(0, fin - Date.now())));
    }
    if ((c.secrets || {}).fal && (c.secrets.fal.etat || 'ok') !== 'ok') await FAL.marquer(db, c, 'ok');
  } catch (e) {
    if (e.code === 'fal_refusee') await FAL.marquer(db, c, 'refusee', 'fal a refusé la clé le ' + new Date().toLocaleDateString('fr-FR'));
    if (e.code === 'fal_credit') await FAL.marquer(db, c, 'credit', 'plus de crédit chez fal');
    throw e;
  } finally {
    await sauver();
  }
  return { fini: !reste(g, phase), phase, progres: progresDe(g), generation: g };
}

// Une étape de la chaîne pour un clip en réalisation. Rend le texte du journal, ou { pret: true, note } quand tous les
// plans sont là (la chaîne lance alors le montage).
async function etape(db, c, v) {
  const r = await realiser(db, c, v);
  const p = r.progres;
  if (!r.fini) {
    if (r.phase === 'images') return lou(c) + ' fait les images (' + (p.refs[0] + p.images[0]) + ' sur ' + (p.refs[1] + p.images[1]) + ')';
    return lou(c) + ' tourne les plans (' + p.videos[0] + ' sur ' + p.videos[1] + ')';
  }
  const g = r.generation;
  if (r.phase === 'images') {
    if (!finis(g.images)) {
      await maj(db, v.id, (f) => (f.status !== 'realisation' ? null : { status: 'echec', etape: { quoi: 'images', statut_avant: 'realisation', erreur: 'Aucune image n\'a pu être faite (' + court((g.images.find((j) => j.erreur) || {}).erreur || 'fal a tout refusé', 200) + ').', depuis: iso() } }));
      return 'images ratées';
    }
    const frais = await db.one('hq_crea_videos', { eq: { id: v.id } });
    const clip = ((frais || v).plan || {}).clip || {};
    if (clip.valider) {
      await maj(db, v.id, (f) => (f.status !== 'realisation' ? null : { status: 'relecture', etape: { quoi: null, depuis: iso() } }));
      return lou(c) + ' a fait les images : à toi de les valider';
    }
    // sans validation : le tournage part tout de suite, s'il tient dans le budget accepté
    const reste = aPayer(frais || v);
    if (arrondi(g.cout + reste) > arrondi(clip.budget) + 0.0001) {
      const e = new CL.ErreurStudio('budget_clip', 'Le tournage coûte environ ' + usd(reste) + ' : c\'est plus que le budget accepté pour ce clip (' + usd(clip.budget) + '). Accepte ce prix pour lancer le tournage.');
      e.budget = clip.budget;
      throw e;
    }
    await maj(db, v.id, (f) => (f.status !== 'realisation' ? null : { etape: { quoi: 'tournage', depuis: iso() } }));
    return lou(c) + ' lance le tournage';
  }
  const notes = [];
  const rates = g.videos.filter((j, i) => j.etat !== 'fini' && g.images[i].etat === 'fini').length;
  if (rates) notes.push(rates + (rates > 1 ? ' plans n\'ont pas pu être filmés : leur image bouge doucement à la place' : ' plan n\'a pas pu être filmé : son image bouge doucement à la place'));
  const sansImage = g.images.filter((j) => j.etat !== 'fini').length;
  if (sansImage) notes.push(sansImage + (sansImage > 1 ? ' plans retirés (pas d\'image)' : ' plan retiré (pas d\'image)'));
  if (g.musique && g.musique.etat !== 'fini') notes.push('la musique n\'a pas pu être créée');
  return { pret: true, note: notes.join(' ; ') || null };
}

/* ── ce qu'elle décide ── */
// lancer le tournage, au prix affiché : le budget du clip monte à ce qu'il a déjà coûté, plus le tournage et de quoi
// refaire un plan raté
async function tourner(db, c, id, accepte) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v || !estClip(v) || v.status !== 'relecture') return { erreur: 'ce clip n\'attend pas de validation' };
  const prix = aPayer(v);
  if (Number(accepte) + 0.005 < prix) return { erreur: 'le prix du tournage a changé (' + usd(prix) + ') : recharge la page' };
  const out = await maj(db, id, (f) => {
    if (f.status !== 'relecture') return null;
    const pl = Object.assign({}, f.plan || {});
    const cl = Object.assign({}, pl.clip || {});
    const deja = Number((cl.gen || {}).cout) || 0;
    cl.budget = arrondi(Math.max(Number(cl.budget) || 0, deja + prix * 1.15 + 0.05));
    pl.clip = cl;
    return { plan: pl, status: 'realisation', etape: { quoi: 'tournage', depuis: iso() } };
  });
  return out ? { ok: true, video: out } : { erreur: 'le clip a changé entre-temps, recharge' };
}
// le budget du clip est atteint : elle accepte ce qu'il faut pour finir
async function accepterBudget(db, c, id, accepte) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v || !estClip(v)) return { erreur: 'clip introuvable' };
  const prix = aPayer(v);
  if (Number(accepte) + 0.005 < prix) return { erreur: 'il reste environ ' + usd(prix) + ' à payer : recharge la page' };
  const out = await maj(db, id, (f) => {
    const pl = Object.assign({}, f.plan || {});
    const cl = Object.assign({}, pl.clip || {});
    cl.budget = arrondi(Math.max(Number(cl.budget) || 0, (Number((cl.gen || {}).cout) || 0) + prix * 1.15 + 0.05));
    pl.clip = cl;
    const e = Object.assign({}, f.etape || {});
    if (e.bloque === 'budget_clip') Object.assign(e, { bloque: null, erreur: null, attendre_jusqu: null });
    return { plan: pl, etape: e };
  });
  return out ? { ok: true, video: out } : { erreur: 'le clip a changé entre-temps, recharge' };
}

// le plan de tournage en cours de validation : ce qu'elle retouche d'un plan ; « refaire » refait son image clé (avec sa
// consigne), « retirer » l'enlève du clip. Une image à refaire repasse par Lou, puis le clip revient à valider.
const EFFETS = ['aucun', 'zoom', 'secousse', 'flash'];
const texteIa = (s, n) => court(String(s == null ? '' : s).replace(/[<>]/g, '').replace(/["`]/g, '\'').replace(/\s+/g, ' ').trim(), n);
async function modifierPlan(db, c, id, o) {
  o = o || {};
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v || !estClip(v) || v.status !== 'relecture') return { erreur: 'ce clip ne se retouche plus maintenant' };
  const i = Number(o.i);
  const sb = ((v.plan || {}).clip || {}).storyboard || {};
  if (!Number.isInteger(i) || i < 0 || i >= (sb.plans || []).length) return { erreur: 'plan introuvable' };
  if (o.retirer && sb.plans.length < 2) return { erreur: 'il faut garder un plan au moins' };
  const clipAvant = (v.plan || {}).clip || {};
  const res = FAL.MODELES.clip.videos[FAL.MODELES.clip.videos[clipAvant.qualite] ? clipAvant.qualite : 'hd'].image;
  let refaire = false;
  const out = await maj(db, id, (f) => {
    if (f.status !== 'relecture') return null;
    const pl = Object.assign({}, f.plan || {});
    const cl = JSON.parse(JSON.stringify(pl.clip || {}));
    const s = cl.storyboard;
    const g = cl.gen || {};
    if (o.retirer) {
      s.plans.splice(i, 1);
      ['images', 'videos', 'sons'].forEach((k) => { if (Array.isArray(g[k])) g[k].splice(i, 1); });
    } else {
      const p = s.plans[i];
      if (o.image != null && texteIa(o.image, 900)) p.image = texteIa(o.image, 900);
      if (o.mouvement != null && texteIa(o.mouvement, 500)) p.mouvement = texteIa(o.mouvement, 500);
      if (o.son != null) p.son = texteIa(o.son, 240);
      if (o.duree != null && Number.isFinite(Number(o.duree))) p.duree = Math.round(Math.min(10, Math.max(1, Number(o.duree))) * 10) / 10;
      if (EFFETS.indexOf(o.effet) >= 0) p.effet = o.effet;
      if (p.accent > p.duree) p.accent = -1;
      // une image refaite : son texte nouveau, ou la même avec sa consigne
      const consigne = court(String(o.consigne || '').replace(/[<>]/g, '').trim(), 400);
      if (o.refaire && Array.isArray(g.images) && g.images[i]) {
        g.images[i] = { prompt: g.images[i].prompt, etat: 'attente', essais: 0, consigne: consigne || g.images[i].consigne || null };
        refaire = true;
      }
    }
    cl.gen = g;
    // l'image refaite se paie : le budget du clip monte d'autant
    if (refaire) cl.budget = arrondi((Number(cl.budget) || 0) + FAL.prixImageClip(res));
    pl.clip = cl;
    // une image dont le texte a changé repart aussi (le découpage en garde l'empreinte)
    const nouveau = etatDe(cl, s);
    if (refaire || nouveau.images.some((j) => j.etat === 'attente')) {
      if (!refaire) cl.budget = arrondi((Number(cl.budget) || 0) + nouveau.images.filter((j) => j.etat === 'attente').length * FAL.prixImageClip(res));
      refaire = true;
      return { plan: pl, status: 'realisation', etape: { quoi: 'images', depuis: iso() } };
    }
    return { plan: pl };
  });
  return out ? { ok: true, video: out, refaire } : { erreur: 'le clip a changé entre-temps, recharge' };
}
// refaire l'image de référence d'un élément (avec sa consigne) : les images clés où il apparaît sont refaites aussi
async function refaireReference(db, c, id, eid, consigne) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v || !estClip(v) || v.status !== 'relecture') return { erreur: 'ce clip ne se retouche plus maintenant' };
  const cl0 = (v.plan || {}).clip || {};
  if (!((cl0.storyboard || {}).elements || []).some((e) => e.id === eid)) return { erreur: 'élément introuvable' };
  const res = FAL.MODELES.clip.videos[FAL.MODELES.clip.videos[cl0.qualite] ? cl0.qualite : 'hd'].image;
  const out = await maj(db, id, (f) => {
    if (f.status !== 'relecture') return null;
    const pl = Object.assign({}, f.plan || {});
    const cl = JSON.parse(JSON.stringify(pl.clip || {}));
    const g = cl.gen || {};
    const s = cl.storyboard;
    let n = 0;
    (g.refs || []).forEach((r, k) => { if (r && r.el === eid) { g.refs[k] = { el: eid, prompt: r.prompt, etat: 'attente', essais: 0, consigne: court(String(consigne || '').replace(/[<>]/g, '').trim(), 400) || null }; n++; } });
    (s.plans || []).forEach((p, k) => { if (p.elements.indexOf(eid) >= 0 && g.images && g.images[k]) { g.images[k] = { prompt: g.images[k].prompt, etat: 'attente', essais: 0, consigne: g.images[k].consigne || null }; n++; } });
    cl.gen = g;
    cl.budget = arrondi((Number(cl.budget) || 0) + n * FAL.prixImageClip(res));
    pl.clip = cl;
    return { plan: pl, status: 'realisation', etape: { quoi: 'images', depuis: iso() } };
  });
  return out ? { ok: true, video: out } : { erreur: 'le clip a changé entre-temps, recharge' };
}
// refaire tout le découpage avec sa consigne (les images dont le texte ne change pas sont gardées)
async function redecouper(db, c, id, consigne) {
  const out = await maj(db, id, (f) => (f.createur_id !== c.id || !estClip(f) || ['relecture', 'echec'].indexOf(f.status) < 0 ? null : {
    status: 'ecriture', etape: { quoi: 'decoupage', consigne: court(String(consigne || '').replace(/[<>]/g, ''), 600) || null, depuis: iso() }
  }));
  return out ? { ok: true, video: out } : { erreur: 'ce clip ne peut pas être redécoupé maintenant' };
}
// Refaire le montage, en changeant si elle veut le style de montage, la musique ou les bruitages : les plans déjà filmés
// sont repris ; une musique à créer, ou des bruitages à ajouter, se paient (le budget du clip monte d'autant)
async function remonter(db, c, id, o) {
  o = o || {};
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v || !estClip(v) || ['prete', 'publiee', 'echec'].indexOf(v.status) < 0 || !((v.plan || {}).clip || {}).storyboard) return { erreur: 'le montage ne peut pas être refait maintenant' };
  const cl0 = v.plan.clip;
  let musique = cl0.musique;
  if (o.musique) {
    const m = await nettoyerMusique(c.id, o.musique, cl0.musique);
    if (m.erreur) return m;
    musique = m.musique;
  }
  const cl = Object.assign({}, cl0, { musique, montage: MONTAGES[o.montage] ? o.montage : cl0.montage, bruitages: o.bruitages != null ? o.bruitages !== false : cl0.bruitages !== false });
  // ce qui reste à payer avec ces choix (une musique nouvelle, des bruitages ajoutés, un plan trop vieux)
  const prix = aPayer({ plan: Object.assign({}, v.plan, { clip: cl }) });
  cl.budget = arrondi(Math.max(Number(cl0.budget) || 0, (Number((cl0.gen || {}).cout) || 0) + prix * 1.15 + 0.05));
  const out = await maj(db, id, (f) => (['prete', 'publiee', 'echec'].indexOf(f.status) < 0 ? null : {
    plan: Object.assign({}, f.plan || {}, { clip: Object.assign({}, (f.plan || {}).clip || {}, { musique: cl.musique, montage: cl.montage, bruitages: cl.bruitages, budget: cl.budget }) }),
    status: 'realisation', rendus: {}, etape: { quoi: 'tournage', depuis: iso(), note: prix ? 'environ ' + usd(prix) + ' à payer sur ta clé fal' : null }
  }));
  return out ? { ok: true, video: out, prix } : { erreur: 'le clip a changé entre-temps, recharge' };
}
// reprendre un clip bloqué : ce qui avait raté deux fois repart pour deux nouveaux essais
async function reprendre(db, c, id) {
  const out = await maj(db, id, (f) => {
    if (f.createur_id !== c.id || !estClip(f)) return null;
    const e = f.etape || {};
    const pl = Object.assign({}, f.plan || {});
    const cl = JSON.parse(JSON.stringify(pl.clip || {}));
    const g = cl.gen || {};
    const relancer = (j) => (j && j.etat === 'echec' ? Object.assign({}, j, { etat: 'attente', essais: 0, erreur: null }) : j);
    ['refs', 'images', 'videos', 'sons'].forEach((k) => { if (Array.isArray(g[k])) g[k] = g[k].map(relancer); });
    if (g.musique) g.musique = relancer(g.musique);
    cl.gen = g; pl.clip = cl;
    if (f.status === 'echec') return { plan: pl, status: e.statut_avant || 'ecriture', etape: { quoi: e.quoi || (e.statut_avant === 'ecriture' ? 'decoupage' : 'images'), depuis: iso() } };
    if (C.AUTOMATIQUES.indexOf(f.status) >= 0) return { plan: pl, etape: Object.assign({}, e, { bloque: null, erreur: null, essais: 0, attendre_jusqu: null }) };
    return null;
  });
  return out ? { ok: true, video: out } : { erreur: 'rien à reprendre' };
}

/* ── pour l'usine ── */
// chaque plan (sa vidéo filmée, avec ses bruitages s'ils sont faits ; sinon son image clé, qui bougera), sa durée, son
// effet et son moment fort ; la musique (son fichier, par un lien de lecture de 6 heures, ou celle créée chez fal)
async function commandeUsine(v) {
  const clip = (v.plan || {}).clip || {};
  const sb = clip.storyboard || {};
  const g = clip.gen || {};
  const plans = (sb.plans || []).map((p, i) => {
    const vd = (g.videos || [])[i], sn = (g.sons || [])[i], im = (g.images || [])[i];
    const media = sn && sn.etat === 'fini' && sn.url ? { url: sn.url, type: 'video' } : vd && vd.etat === 'fini' && vd.url ? { url: vd.url, type: 'video' } : im && im.etat === 'fini' && im.url ? { url: im.url, type: 'image' } : null;
    return media ? Object.assign(media, { duree: p.duree, effet: p.effet || 'aucun', accent: p.accent >= 0 ? p.accent : null }) : null;
  }).filter(Boolean);
  const m = clip.musique || {};
  let musique = null;
  if (m.source === 'fichier' && m.chemin) {
    const u = (await ST.liensLecture([m.chemin], 6 * 3600).catch(() => ({})))[m.chemin];
    if (u) musique = { url: u, debut: Number(m.debut) || 0 };
  } else if (m.source === 'ia' && g.musique && g.musique.etat === 'fini' && g.musique.url) musique = { url: g.musique.url, debut: 0 };
  return { format: FORMATS[clip.format] ? clip.format : '9:16', montage: MONTAGES[clip.montage] ? clip.montage : 'zooms', fin_noir: !!sb.fin_noir, bruitages: clip.bruitages !== false, plans, musique };
}

module.exports = {
  QUALITES, MONTAGES, FORMATS, SOURCES, DUREES, PROMPT_MAX, SON_MAX, ESSAIS,
  estClip, catalogue, dureesDuPrompt, estimer, preparerSon, cheminSonValide, preparer, decouper, etatDe, aPayer, realiser, etape,
  tourner, accepterBudget, modifierPlan, refaireReference, redecouper, remonter, reprendre, commandeUsine,
  promptReference, promptImage, promptVideo, avecReferences, reglerAttente
};
