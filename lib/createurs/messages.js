// La messagerie entre Louis et chaque créatrice, en direct : du texte, des fichiers (vidéos, photos, sons, PDF) et les
// vidéos prêtes de son studio, dans les deux sens. Une conversation par créatrice : Louis écrit depuis la tour
// (Gestion, Studio, Les créatrices), elle depuis son studio (l'icône des messages en haut).
// Les fichiers vont droit dans l'espace privé « messages » de la tour par un lien d'envoi signé (rien ne passe par la
// fonction, 200 Mo au plus), et se lisent par des liens signés de 6 heures ; ils sont gardés 60 jours, le texte reste.
// La page ouverte sur la conversation regarde toutes les 3 secondes : c'est le direct. Ailleurs, un compteur des
// messages non lus. Quand elle écrit et que Louis n'avait rien de non lu d'elle, il est prévenu dans la tour (et par
// email, une fois par heure au plus).
'use strict';
const crypto = require('crypto');
const ST = require('../studio/stockage');
const { court } = require('../util');

const ESPACE = 'messages';
const TAILLE_MAX = 200 * 1048576;
const GARDE_JOURS = 60;
const LIEN_SECONDES = 6 * 3600;
const PIECES_MAX = 6;
// ce qui passe, et ce que c'est (le genre décide de l'affichage : un lecteur vidéo, une image, un lecteur audio, un lien)
const TYPES = {
  'video/mp4': ['video', 'mp4'], 'video/quicktime': ['video', 'mov'], 'video/webm': ['video', 'webm'], 'video/x-m4v': ['video', 'm4v'],
  'image/jpeg': ['image', 'jpg'], 'image/png': ['image', 'png'], 'image/webp': ['image', 'webp'], 'image/gif': ['image', 'gif'], 'image/heic': ['image', 'heic'], 'image/heif': ['image', 'heif'],
  'audio/mpeg': ['son', 'mp3'], 'audio/mp4': ['son', 'm4a'], 'audio/x-m4a': ['son', 'm4a'], 'audio/aac': ['son', 'aac'], 'audio/webm': ['son', 'webm'], 'audio/ogg': ['son', 'ogg'], 'audio/wav': ['son', 'wav'], 'audio/x-wav': ['son', 'wav'],
  'application/pdf': ['document', 'pdf']
};
const AUTEURS = ['louis', 'createur'];
const iso = () => new Date().toISOString();
const autreQue = (lecteur) => (lecteur === 'louis' ? 'createur' : 'louis');

// le nom d'un fichier dans le stockage : son nom, sans accents ni espaces, avec la bonne extension, et 12 caractères
// tirés au hasard devant (deux envois du même fichier ne se marchent pas dessus)
function nomPropre(nom, type) {
  const ext = TYPES[type][1];
  const base = String(nom || 'fichier').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'fichier';
  return base + '.' + ext;
}
const cheminValide = (createurId, c) => new RegExp('^conv/' + Number(createurId) + '/\\d{6}/[a-f0-9]{12}-[a-z0-9-]{1,60}\\.[a-z0-9]{2,5}$').test(String(c || ''));
const typeDe = (t) => { const x = String(t || '').toLowerCase().split(';')[0].trim(); return Object.prototype.hasOwnProperty.call(TYPES, x) ? x : null; };

// Avant d'envoyer un fichier : le lien d'envoi signé (valable 2 heures) et le chemin à rappeler avec le message
async function preparerEnvoi(createurId, f) {
  f = f || {};
  const type = typeDe(f.type);
  if (!type) return { code: 400, erreur: 'ce type de fichier ne passe pas : des vidéos, des photos, des sons ou des PDF' };
  const taille = Number(f.taille) || 0;
  if (taille <= 0) return { code: 400, erreur: 'ce fichier est vide' };
  if (taille > TAILLE_MAX) return { code: 400, erreur: 'fichier trop lourd : ' + Math.round(taille / 1048576) + ' Mo, 200 Mo au plus' };
  const mois = iso().slice(0, 7).replace('-', '');
  const chemin = 'conv/' + Number(createurId) + '/' + mois + '/' + crypto.randomBytes(6).toString('hex') + '-' + nomPropre(f.nom, type);
  return { code: 200, chemin, type, url: await ST.lienEnvoi(chemin, ESPACE) };
}

// les messages tels que les pages les voient : les fichiers par des liens de lecture de 6 heures, jamais leur chemin
async function publics(db, createurId, lignes) {
  const fichiers = [], studio = [];
  lignes.forEach((m) => (m.pieces || []).forEach((p) => {
    if (p.chemin && !p.expire) fichiers.push(p.chemin);
    if (p.genre === 'studio') { studio.push(ST.cheminCrea(createurId, p.video, p.langue, 'video.mp4')); studio.push(ST.cheminCrea(createurId, p.video, p.langue, 'vignette.jpg')); }
  }));
  const [lf, ls] = await Promise.all([
    ST.liensLecture(fichiers, LIEN_SECONDES, ESPACE).catch(() => ({})),
    ST.liensLecture(studio, LIEN_SECONDES).catch(() => ({}))
  ]);
  return lignes.map((m) => ({
    id: m.id, auteur: m.auteur, texte: m.texte || '', le: m.created_at, lu_le: m.lu_le || null,
    pieces: (m.pieces || []).map((p) => {
      if (p.genre === 'studio') {
        const url = ls[ST.cheminCrea(createurId, p.video, p.langue, 'video.mp4')] || null;
        return { genre: 'studio', video: p.video, langue: p.langue, titre: p.titre || '', url, vignette: ls[ST.cheminCrea(createurId, p.video, p.langue, 'vignette.jpg')] || null, expire: !url };
      }
      return { genre: p.genre, type: p.type, nom: p.nom, taille: p.taille || null, url: p.expire ? null : (lf[p.chemin] || null), expire: !!p.expire };
    })
  }));
}

// Un message : son texte, ses fichiers (déjà envoyés dans le stockage) et, si elle veut, une vidéo prête de son studio
async function envoyer(db, c, auteur, b) {
  if (AUTEURS.indexOf(auteur) < 0) return { code: 400, erreur: 'auteur inconnu' };
  b = b || {};
  const texte = court(String(b.texte || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim(), 4000);
  const pieces = [];
  for (const p of (Array.isArray(b.pieces) ? b.pieces : []).slice(0, PIECES_MAX)) {
    const type = p && typeDe(p.type);
    if (!p || !type || !cheminValide(c.id, p.chemin)) return { code: 400, erreur: 'pièce jointe refusée' };
    if (!(await ST.existe(p.chemin, ESPACE).catch(() => false))) return { code: 409, erreur: 'le fichier « ' + court(String(p.nom || ''), 60) + ' » n\'est pas arrivé : renvoie-le' };
    pieces.push({ genre: TYPES[type][0], type, chemin: p.chemin, nom: court(String(p.nom || 'fichier').replace(/[<>]/g, ''), 80), taille: Number(p.taille) || null });
  }
  if (b.video && typeof b.video === 'object') {
    const l = String(b.video.langue || '');
    const v = /^[a-z]{2}$/.test(l) ? await db.one('hq_crea_videos', { eq: { id: Number(b.video.id) || 0, createur_id: c.id }, select: 'id,titre,rendus' }) : null;
    const r = v && (v.rendus || {})[l];
    if (!r || r.etat !== 'fini') return { code: 400, erreur: 'cette vidéo n\'est pas prête dans cette langue' };
    pieces.push({ genre: 'studio', video: v.id, langue: l, titre: court(v.titre || '', 100) });
  }
  if (!texte && !pieces.length) return { code: 400, erreur: 'écris un message ou joins un fichier' };
  const [m] = await db.insert('hq_crea_messages', { createur_id: c.id, auteur, texte, pieces });
  if (auteur === 'createur') await prevenirLouis(db, c, m).catch(() => null);
  return { code: 200, ok: true, message: (await publics(db, c.id, [m]))[0] };
}

// Quand elle écrit et que Louis n'avait rien de non lu d'elle : une alerte dans la tour, et un email une fois par heure
// au plus (il répond quand il veut, sans être noyé)
async function prevenirLouis(db, c, m) {
  const avant = await db.count('hq_crea_messages', { eq: { createur_id: c.id, auteur: 'createur' }, is: { lu_le: null }, lt: { id: m.id } });
  if (avant) return;
  const cle = 'crea:message:' + c.id;
  const cfg = await db.one('hq_config', { eq: { key: cle } }).catch(() => null);
  const email = !(cfg && cfg.value && Date.now() - new Date(cfg.value.email_le || 0).getTime() < 3600000);
  const n = (m.pieces || []).length;
  const apercu = (m.texte ? court(m.texte, 400) : '') + (n ? (m.texte ? '\n' : '') + '(' + n + (n > 1 ? ' fichiers joints' : (m.pieces[0].genre === 'studio' ? ' vidéo de son studio' : ' fichier joint')) + ')' : '');
  await require('../acces').prevenirLouis(db, c.prenom + ' t\'a écrit', apercu + '\n\nRéponds-lui dans la tour : Gestion, Studio, Les créatrices.', email);
  if (email) await db.upsert('hq_config', { key: cle, value: { email_le: iso() }, updated_at: iso() }, { onConflict: 'key' }).catch(() => null);
}

// La conversation vue par l'un des deux : les derniers messages (ou ceux après « apres »), ce qu'il reste à lire, et
// jusqu'où l'autre a lu (le « Vu »). Ouverte (« lire »), tout ce que l'autre a écrit passe en lu.
async function lister(db, createurId, lecteur, opts) {
  opts = opts || {};
  const autre = autreQue(lecteur);
  const apres = Number(opts.apres) || 0;
  let lignes = apres
    ? await db.select('hq_crea_messages', { eq: { createur_id: createurId }, gt: { id: apres }, order: 'id.asc', limit: 200 })
    : (await db.select('hq_crea_messages', { eq: { createur_id: createurId }, order: 'id.desc', limit: 80 })).reverse();
  if (opts.lire) {
    const t = iso();
    const maj = await db.update('hq_crea_messages', { lu_le: t }, { eq: { createur_id: createurId, auteur: autre }, is: { lu_le: null } });
    if ((maj || []).length) lignes = lignes.map((m) => (m.auteur === autre && !m.lu_le ? Object.assign({}, m, { lu_le: t }) : m));
  }
  const [nonLus, vus] = await Promise.all([
    db.count('hq_crea_messages', { eq: { createur_id: createurId, auteur: autre }, is: { lu_le: null } }),
    db.select('hq_crea_messages', { eq: { createur_id: createurId, auteur: lecteur }, gt: { lu_le: '2000-01-01T00:00:00Z' }, order: 'id.desc', limit: 1, select: 'id' })
  ]);
  return { code: 200, messages: await publics(db, createurId, lignes), non_lus: nonLus, vu_jusqua: (vus[0] && vus[0].id) || 0 };
}

// ce qu'il reste à lire, pour le petit compteur
async function nonLus(db, createurId, lecteur) {
  return db.count('hq_crea_messages', { eq: { createur_id: createurId, auteur: autreQue(lecteur) }, is: { lu_le: null } }).catch(() => 0);
}
// pour Louis, toutes ses conversations d'un coup : { idCréatrice: nombre de messages non lus }
async function nonLusParCreatrice(db) {
  const l = await db.select('hq_crea_messages', { eq: { auteur: 'createur' }, is: { lu_le: null }, select: 'createur_id', limit: 2000 }).catch(() => []);
  const out = {};
  l.forEach((m) => { out[m.createur_id] = (out[m.createur_id] || 0) + 1; });
  return out;
}

// le ménage : les fichiers de plus de 60 jours sont effacés du stockage (le message garde son texte et le nom du fichier)
async function menage(db) {
  const limite = new Date(Date.now() - GARDE_JOURS * 86400000).toISOString();
  const vieux = await db.select('hq_crea_messages', { lt: { created_at: limite }, order: 'id.asc', limit: 300, select: 'id,pieces' }).catch(() => []);
  const chemins = [];
  const majs = [];
  vieux.forEach((m) => {
    const ps = m.pieces || [];
    if (!ps.some((p) => p.chemin && !p.expire)) return;
    ps.forEach((p) => { if (p.chemin && !p.expire) chemins.push(p.chemin); });
    majs.push({ id: m.id, pieces: ps.map((p) => (p.chemin ? Object.assign({}, p, { expire: true }) : p)) });
  });
  if (chemins.length) await ST.supprimer(chemins, ESPACE).catch(() => null);
  for (const x of majs) await db.update('hq_crea_messages', { pieces: x.pieces }, { eq: { id: x.id } });
  return chemins.length;
}
// un compte supprimé : ses fichiers partent avec lui
async function effacer(db, createurId) {
  const l = await db.select('hq_crea_messages', { eq: { createur_id: createurId }, select: 'id,pieces', limit: 5000 }).catch(() => []);
  const chemins = [];
  l.forEach((m) => (m.pieces || []).forEach((p) => { if (p.chemin && !p.expire) chemins.push(p.chemin); }));
  if (chemins.length) await ST.supprimer(chemins, ESPACE).catch(() => null);
  await db.remove('hq_crea_messages', { eq: { createur_id: createurId } }).catch(() => null);
}

module.exports = { ESPACE, TYPES, TAILLE_MAX, GARDE_JOURS, preparerEnvoi, envoyer, lister, nonLus, nonLusParCreatrice, menage, effacer, nomPropre, cheminValide };
