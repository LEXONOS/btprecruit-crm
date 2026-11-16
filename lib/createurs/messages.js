// La messagerie entre Louis et chaque créatrice, en direct : du texte, des fichiers (vidéos, photos, sons, PDF) et les
// vidéos prêtes de son studio, dans les deux sens. Une conversation par créatrice : Louis écrit depuis la tour
// (Gestion, Studio, Les créatrices) ou depuis son propre compte du studio, elle depuis son studio (l'icône des messages
// en haut).
// Les fichiers vont droit dans l'espace privé « messages » de la tour par un lien d'envoi signé (rien ne passe par la
// fonction, 200 Mo au plus), et se lisent par des liens signés de 6 heures ; ils sont gardés 60 jours, le texte reste.
// La page ouverte sur la conversation regarde toutes les 3 secondes : c'est le direct. Ailleurs, un compteur des
// messages non lus. Quand elle écrit et que Louis n'avait rien de non lu d'elle, il est prévenu dans la tour (et par
// email, une fois par heure au plus).
// Le compte de Louis dans le studio (C.estLouis) : ses conversations sont celles des créatrices, il y écrit en Louis, et
// il leur envoie ses vidéos prêtes (envoyerVideo), copiées dans l'espace « messages » de chaque conversation.
'use strict';
const crypto = require('crypto');
const ST = require('../studio/stockage');
const C = require('./index');
const { court, coupe } = require('../util');

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
const okId = (x) => /^\d{1,12}$/.test(String(x == null ? '' : x));
// le texte d'un message : ses retours à la ligne gardés, 4 000 caractères au plus
const propre = (t) => coupe(String(t || ''), 4000);

// le nom d'un fichier dans le stockage : son nom, sans accents ni espaces, avec la bonne extension, et 12 caractères
// tirés au hasard devant (deux envois du même fichier ne se marchent pas dessus)
function nomPropre(nom, type) {
  const ext = TYPES[type][1];
  const base = String(nom || 'fichier').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'fichier';
  return base + '.' + ext;
}
const cheminValide = (createurId, c) => new RegExp('^conv/' + Number(createurId) + '/\\d{6}/[a-f0-9]{12}-[a-z0-9-]{1,60}\\.[a-z0-9]{2,5}$').test(String(c || ''));
const typeDe = (t) => { const x = String(t || '').toLowerCase().split(';')[0].trim(); return Object.prototype.hasOwnProperty.call(TYPES, x) ? x : null; };
const nouveauChemin = (createurId, nom, type) => 'conv/' + Number(createurId) + '/' + iso().slice(0, 7).replace('-', '') + '/' + crypto.randomBytes(6).toString('hex') + '-' + nomPropre(nom, type);
// le nom d'une vidéo du studio une fois téléchargée : son titre et sa langue
const nomVideo = (titre, l) => (String(titre || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\*/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'video') + '-' + l + '.mp4';
// un lien de lecture signé, en téléchargement (le navigateur enregistre le fichier sous ce nom au lieu de l'ouvrir)
const enTelechargement = (url, nom) => (url ? url + (url.indexOf('?') >= 0 ? '&' : '?') + 'download=' + encodeURIComponent(nom) : null);
// le format d'une vidéo du studio (verticale, ou celui choisi pour un clip) : la page lui donne sa taille avant qu'elle
// charge (la conversation descend jusqu'en bas du premier coup)
const formatDe = (v) => { const f = (((v.plan || {}).clip) || {}).format; return (v.plan || {}).genre === 'clip' && ['16:9', '1:1'].indexOf(f) >= 0 ? f : '9:16'; };
// les fichiers d'une pièce rangés dans l'espace « messages » (une vidéo envoyée du studio de Louis a aussi sa vignette)
const cheminsDe = (p) => (p && p.chemin && !p.expire ? [p.chemin].concat(p.vignette_chemin ? [p.vignette_chemin] : []) : []);

// Avant d'envoyer un fichier : le lien d'envoi signé (valable 2 heures) et le chemin à rappeler avec le message
async function preparerEnvoi(createurId, f) {
  f = f || {};
  const type = typeDe(f.type);
  if (!type) return { code: 400, erreur: 'ce type de fichier ne passe pas : des vidéos, des photos, des sons ou des PDF' };
  const taille = Number(f.taille) || 0;
  if (taille <= 0) return { code: 400, erreur: 'ce fichier est vide' };
  if (taille > TAILLE_MAX) return { code: 400, erreur: 'fichier trop lourd : ' + Math.round(taille / 1048576) + ' Mo, 200 Mo au plus' };
  const chemin = nouveauChemin(createurId, f.nom, type);
  return { code: 200, chemin, type, url: await ST.lienEnvoi(chemin, ESPACE) };
}

// les messages tels que les pages les voient : les fichiers par des liens de lecture de 6 heures, jamais leur chemin
async function publics(db, createurId, lignes) {
  const fichiers = [], studio = [];
  lignes.forEach((m) => (m.pieces || []).forEach((p) => {
    fichiers.push.apply(fichiers, cheminsDe(p));
    // une vidéo du studio laissée où elle est : chez la créatrice qui l'envoie, ou chez Louis si sa copie n'avait pas pris
    if (p.genre === 'studio' && !p.chemin) { const compte = p.compte || createurId; studio.push(ST.cheminCrea(compte, p.video, p.langue, 'video.mp4')); studio.push(ST.cheminCrea(compte, p.video, p.langue, 'vignette.jpg')); }
  }));
  const [lf, ls] = await Promise.all([
    ST.liensLecture(fichiers, LIEN_SECONDES, ESPACE).catch(() => ({})),
    ST.liensLecture(studio, LIEN_SECONDES).catch(() => ({}))
  ]);
  return lignes.map((m) => ({
    id: m.id, auteur: m.auteur, texte: m.texte || '', le: m.created_at, lu_le: m.lu_le || null,
    pieces: (m.pieces || []).map((p) => {
      if (p.genre === 'studio') {
        let url = null, vignette = null;
        if (p.chemin) { url = p.expire ? null : (lf[p.chemin] || null); vignette = p.vignette_chemin ? (lf[p.vignette_chemin] || null) : null; }
        else { const compte = p.compte || createurId; url = ls[ST.cheminCrea(compte, p.video, p.langue, 'video.mp4')] || null; vignette = ls[ST.cheminCrea(compte, p.video, p.langue, 'vignette.jpg')] || null; }
        return {
          genre: 'studio', de: p.de || null, video: p.video, langue: p.langue, titre: p.titre || '', duree: p.duree || null, format: p.format || '9:16',
          url, vignette: url ? vignette : null, telecharger: enTelechargement(url, p.nom || nomVideo(p.titre, p.langue)), publication: p.publication || null, expire: !url
        };
      }
      return { genre: p.genre, type: p.type, nom: p.nom, taille: p.taille || null, url: p.expire ? null : (lf[p.chemin] || null), expire: !!p.expire };
    })
  }));
}

// Un message : son texte, ses fichiers (déjà envoyés dans le stockage) et, si elle veut, une vidéo prête de son studio
async function envoyer(db, c, auteur, b) {
  if (AUTEURS.indexOf(auteur) < 0) return { code: 400, erreur: 'auteur inconnu' };
  b = b || {};
  const texte = propre(b.texte);
  const pieces = [];
  for (const p of (Array.isArray(b.pieces) ? b.pieces : []).slice(0, PIECES_MAX)) {
    const type = p && typeDe(p.type);
    if (!p || !type || !cheminValide(c.id, p.chemin)) return { code: 400, erreur: 'pièce jointe refusée' };
    if (!(await ST.existe(p.chemin, ESPACE).catch(() => false))) return { code: 409, erreur: 'le fichier « ' + court(String(p.nom || ''), 60) + ' » n\'est pas arrivé : renvoie-le' };
    pieces.push({ genre: TYPES[type][0], type, chemin: p.chemin, nom: court(String(p.nom || 'fichier').replace(/[<>]/g, ''), 80), taille: Number(p.taille) || null });
  }
  if (b.video && typeof b.video === 'object') {
    const l = String(b.video.langue || '');
    const v = /^[a-z]{2}$/.test(l) ? await db.one('hq_crea_videos', { eq: { id: Number(b.video.id) || 0, createur_id: c.id }, select: 'id,titre,rendus,plan' }) : null;
    const r = v && (v.rendus || {})[l];
    if (!r || r.etat !== 'fini') return { code: 400, erreur: 'cette vidéo n\'est pas prête dans cette langue' };
    pieces.push({ genre: 'studio', video: v.id, langue: l, titre: court(v.titre || '', 100), format: formatDe(v) });
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
  await require('../acces').prevenirLouis(db, c.prenom + ' t\'a écrit', apercu + '\n\nRéponds-lui dans la tour (Gestion, Studio, Les créatrices) ou depuis ton studio.', email);
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

/* ── le compte de Louis dans le studio ── */
// les comptes avec qui Louis parle depuis son studio : toutes les créatrices, sauf son propre compte et les comptes en pause
async function comptesDe(db, louis, select) {
  return (await db.select('hq_createurs', { neq: { id: louis.id }, order: ['created_at.asc'], select: select || 'id,identifiant,prenom,statut' }))
    .filter((c) => c.statut !== 'suspendue' && !C.estLouis(c));
}
// ses conversations : chacune avec ce qu'il lui reste à lire, son dernier message, et les langues où elle publie (pour
// choisir quelle version de sa vidéo lui envoyer)
async function conversations(db, louis) {
  const comptes = await comptesDe(db, louis, 'id,identifiant,prenom,statut,reglages');
  if (!comptes.length) return [];
  const [aLire, derniers] = await Promise.all([
    nonLusParCreatrice(db),
    Promise.all(comptes.map((c) => db.select('hq_crea_messages', { eq: { createur_id: c.id }, order: 'id.desc', limit: 1, select: 'id,auteur,created_at' }).catch(() => [])))
  ]);
  return comptes.map((c, i) => {
    const d = derniers[i][0];
    const r = C.reglagesDe(c);
    return { id: c.id, prenom: c.prenom, statut: c.statut, chaine: r.chaine.nom || null, langues: r.langues, non_lus: aLire[c.id] || 0, dernier: d ? { id: d.id, auteur: d.auteur, le: d.created_at } : null };
  });
}
// son compteur : ce que les créatrices lui ont écrit et qu'il n'a pas lu, en tout et par conversation
async function etatLouis(db, louis) {
  const [tous, comptes] = await Promise.all([nonLusParCreatrice(db), comptesDe(db, louis).catch(() => [])]);
  const par = {};
  let n = 0;
  comptes.forEach((c) => { if (tous[c.id]) { par[c.id] = tous[c.id]; n += tous[c.id]; } });
  return { non_lus: n, par };
}
// la créatrice d'une de ses conversations (jamais son propre compte ; un compte en pause ne reçoit rien)
async function cible(db, louis, id) {
  const c = okId(id) ? await db.one('hq_createurs', { eq: { id: Number(id) } }) : null;
  if (!c || c.id === louis.id || C.estLouis(c)) return { code: 404, erreur: 'conversation introuvable' };
  if (c.statut === 'suspendue') return { code: 400, erreur: 'le compte de ' + c.prenom + ' est en pause' };
  return { code: 200, createur: c };
}

// Une vidéo prête du studio de Louis, dans une langue, pour la conversation d'une créatrice : copiée (avec sa vignette)
// dans l'espace « messages » de la conversation, gardée 60 jours même si Louis la supprime ou que le studio fait son
// ménage (14 jours). Si la copie ne prend pas, la pièce montre la vidéo du studio de Louis, tant qu'elle y est.
async function copieVideo(louis, v, l, createurId) {
  const r = (v.rendus || {})[l] || {};
  const t = require('./chaine').textePublication(v, l);
  const p = {
    genre: 'studio', de: 'louis', video: v.id, langue: l, titre: court(v.titre || '', 100), duree: Math.round(Number(r.duree) || 0) || null, format: formatDe(v), nom: nomVideo(v.titre, l),
    publication: { titre: court(t.titre || '', 150), description: coupe(t.description || '', 2200), hashtags: (Array.isArray(t.hashtags) ? t.hashtags : []).slice(0, 30).map((x) => court(String(x), 60)).filter(Boolean) }
  };
  const chemin = nouveauChemin(createurId, p.nom, 'video/mp4');
  try {
    await ST.copier(ST.cheminCrea(louis.id, v.id, l, 'video.mp4'), chemin, ST.BUCKET, ESPACE);
    if (!(await ST.existe(chemin, ESPACE))) throw new Error('copie absente');
    Object.assign(p, { chemin, type: 'video/mp4', taille: Number(r.taille) || null });
    if ((r.fichiers || ['vignette.jpg']).indexOf('vignette.jpg') >= 0) {
      const cv = chemin.replace(/\.mp4$/, '.jpg');
      if (await ST.copier(ST.cheminCrea(louis.id, v.id, l, 'vignette.jpg'), cv, ST.BUCKET, ESPACE).then(() => true, () => false)) p.vignette_chemin = cv;
    }
  } catch (e) {
    p.compte = louis.id;
  }
  return p;
}

// Louis envoie une de ses vidéos prêtes à une ou plusieurs créatrices, dans une ou plusieurs langues, avec un mot s'il
// veut : un message de Louis dans chaque conversation, avec la vidéo de chaque langue et le texte de sa publication
// (titre, texte, hashtags), pour qu'elle la regarde, la télécharge ou la publie.
async function envoyerVideo(db, louis, b) {
  b = b || {};
  const v = okId(b.id) ? await db.one('hq_crea_videos', { eq: { id: Number(b.id), createur_id: louis.id } }) : null;
  if (!v) return { code: 404, erreur: 'vidéo introuvable' };
  const pretes = Object.keys(v.rendus || {}).filter((l) => v.rendus[l] && v.rendus[l].etat === 'fini');
  const langues = Array.from(new Set((Array.isArray(b.langues) ? b.langues : []).map(String))).slice(0, 6);
  if (!langues.length) return { code: 400, erreur: 'choisis au moins une langue' };
  const pasPrete = langues.find((l) => pretes.indexOf(l) < 0);
  if (pasPrete) return { code: 400, erreur: 'cette vidéo n\'est pas prête en ' + String((C.LANGUES[pasPrete] || {}).nom || pasPrete).toLowerCase() };
  const ids = Array.from(new Set((Array.isArray(b.a) ? b.a : []).map(String))).slice(0, 12);
  if (!ids.length) return { code: 400, erreur: 'choisis à qui l\'envoyer' };
  const cibles = [];
  for (const id of ids) {
    const x = await cible(db, louis, id);
    if (x.erreur) return { code: x.code, erreur: x.erreur };
    cibles.push(x.createur);
  }
  const texte = propre(b.texte);
  const envois = [];
  for (const c of cibles) {
    const pieces = await Promise.all(langues.map((l) => copieVideo(louis, v, l, c.id)));
    const [m] = await db.insert('hq_crea_messages', { createur_id: c.id, auteur: 'louis', texte, pieces });
    envois.push({ id: c.id, prenom: c.prenom, message: (await publics(db, c.id, [m]))[0] });
  }
  return { code: 200, ok: true, envois };
}

// le ménage : les fichiers de plus de 60 jours sont effacés du stockage (le message garde son texte et le nom du fichier)
async function menage(db) {
  const limite = new Date(Date.now() - GARDE_JOURS * 86400000).toISOString();
  const vieux = await db.select('hq_crea_messages', { lt: { created_at: limite }, order: 'id.asc', limit: 300, select: 'id,pieces' }).catch(() => []);
  const chemins = [];
  const majs = [];
  vieux.forEach((m) => {
    const ps = m.pieces || [];
    const siens = [].concat.apply([], ps.map(cheminsDe));
    if (!siens.length) return;
    chemins.push.apply(chemins, siens);
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
  l.forEach((m) => (m.pieces || []).forEach((p) => chemins.push.apply(chemins, cheminsDe(p))));
  if (chemins.length) await ST.supprimer(chemins, ESPACE).catch(() => null);
  await db.remove('hq_crea_messages', { eq: { createur_id: createurId } }).catch(() => null);
}

module.exports = { ESPACE, TYPES, TAILLE_MAX, GARDE_JOURS, preparerEnvoi, envoyer, lister, nonLus, nonLusParCreatrice, conversations, etatLouis, cible, envoyerVideo, menage, effacer, nomPropre, cheminValide };
