// Ses personnages (Réglages, Mes personnages) : une personne (elle-même, une amie qui est d'accord), une mascotte, un
// animal, un objet, un lieu, avec jusqu'à quatre photos. Son équipe les garde à l'identique d'une vidéo à l'autre : la
// réalisatrice en écrit le portrait en anglais (Claude lit les photos, le petit modèle, moins d'un centime), la plume les
// fait jouer dans les scènes, et les images IA ou les plans d'un clip partent avec leurs photos (Nano Banana 2.1).
// Les photos vont droit dans le stockage « studio » (crea/<compte>/persos/<hasard>.jpg), en JPEG (la page les convertit et
// les réduit avant l'envoi), lues par des liens signés ; jamais un chemin dans la page. Une photo d'une personne réelle
// ne part que si elle coche qu'elle en a le droit.
'use strict';
const crypto = require('crypto');
const C = require('./index');
const E = require('./equipe');
const ST = require('../studio/stockage');
const { court } = require('../util');

const TAILLE_MAX = 8 * 1048576;
const iso = () => new Date().toISOString();

// ses personnages, avec leurs photos en liens signés (6 heures)
async function lister(c) {
  const r = C.reglagesDe(c);
  const chemins = [];
  r.personnages.forEach((p) => (p.photos || []).forEach((x) => chemins.push(x)));
  const signes = chemins.length ? await ST.liensLecture(chemins, 6 * 3600).catch(() => ({})) : {};
  return r.personnages.map((p) => Object.assign(C.persoPublic(p), { photos: (p.photos || []).map((x, i) => ({ n: i, url: signes[x] || null })) }));
}

// un lien d'envoi pour une photo (le fichier ne passe pas par la tour)
async function preparerPhoto(c, f) {
  f = f || {};
  if (String(f.type || '').toLowerCase() !== 'image/jpeg') return { code: 400, erreur: 'la photo doit arriver en JPEG (la page la convertit toute seule : recharge-la)' };
  if (!(Number(f.taille) > 0) || Number(f.taille) > TAILLE_MAX) return { code: 400, erreur: 'photo trop lourde (8 Mo au plus)' };
  const chemin = 'crea/' + Number(c.id) + '/persos/' + crypto.randomBytes(8).toString('hex') + '.jpg';
  return { code: 200, chemin, url: await ST.lienEnvoi(chemin), type: 'image/jpeg' };
}

async function sauver(db, c, liste) {
  const frais = await db.one('hq_createurs', { eq: { id: c.id } });
  const reglages = Object.assign({}, (frais || c).reglages || {}, { personnages: liste.slice(0, C.PERSOS_MAX) });
  await db.update('hq_createurs', { reglages, updated_at: iso() }, { eq: { id: c.id } });
  return db.one('hq_createurs', { eq: { id: c.id } });
}

// Créer ou modifier un personnage. b = { id (pour modifier), nom, genre, description, description_en (sa retouche du
// portrait), garder (les numéros des photos gardées), photos (les nouvelles, déjà envoyées), consentement, redecrire }
async function enregistrer(db, c, b) {
  b = b || {};
  const r = C.reglagesDe(c);
  const avant = b.id ? r.personnages.find((p) => p.id === String(b.id)) : null;
  if (b.id && !avant) return { code: 404, erreur: 'personnage introuvable' };
  if (!avant && r.personnages.length >= C.PERSOS_MAX) return { code: 400, erreur: C.PERSOS_MAX + ' personnages au plus : supprime-en un d\'abord' };
  const anciennes = (avant && avant.photos) || [];
  const gardees = Array.isArray(b.garder) ? anciennes.filter((x, i) => b.garder.map(Number).indexOf(i) >= 0) : anciennes.slice();
  const nouvelles = (Array.isArray(b.photos) ? b.photos : []).map(String).filter((x, i, t) => C.cheminPersoValide(c.id, x) && anciennes.indexOf(x) < 0 && t.indexOf(x) === i);
  if (nouvelles.length && b.consentement !== true) return { code: 400, erreur: 'coche que c\'est toi, un personnage à toi, ou que la personne est d\'accord' };
  for (const x of nouvelles) if (!(await ST.existe(x).catch(() => false))) return { code: 400, erreur: 'une photo n\'est pas arrivée : renvoie-la' };
  const photos = gardees.concat(nouvelles).slice(0, 4);
  let p = C.nettoyerPersonnage({ nom: b.nom, genre: b.genre, description: b.description, photos }, avant, c.id);
  // le portrait en anglais : à la création, ou quand ses photos ou sa description changent (ou qu'elle le demande)
  const change = !avant || nouvelles.length || gardees.length !== anciennes.length || (b.description != null && String(b.description).trim() !== String(avant.description || '').trim()) || !!b.redecrire;
  let avertissement = null, cout = 0;
  if (change && (c.secrets || {}).claude) {
    try {
      const signes = p.photos.length ? await ST.liensLecture(p.photos, 900).catch(() => ({})) : {};
      const d = await E.decrirePersonnage(db, c, p, p.photos.map((x) => signes[x]).filter(Boolean));
      p = C.nettoyerPersonnage({ nom_en: d.nom_en, description_en: d.description_en }, p, c.id);
      cout = d.cout;
    } catch (e) { avertissement = 'portrait pas écrit (' + court(e.message, 120) + ') : réessaie, ou écris-le toi-même'; }
  } else if (change && !(c.secrets || {}).claude) avertissement = 'branche ta clé Claude pour que l\'équipe écrive son portrait (ou écris-le toi-même, en anglais)';
  // sa retouche du portrait passe avant
  if (b.description_en != null && String(b.description_en).trim() && (!change || !p.description_en)) p = C.nettoyerPersonnage({ description_en: b.description_en, nom_en: b.nom_en != null ? b.nom_en : p.nom_en }, p, c.id);
  const liste = avant ? r.personnages.map((x) => (x.id === p.id ? p : x)) : r.personnages.concat([p]);
  const c2 = await sauver(db, c, liste);
  const parties = anciennes.filter((x) => photos.indexOf(x) < 0);
  if (parties.length) await ST.supprimer(parties).catch(() => null);
  return { code: 200, ok: true, personnage: C.persoPublic(p), personnages: await lister(c2), moi: C.moi(c2), avertissement, cout, createur: c2 };
}

async function supprimer(db, c, id) {
  const r = C.reglagesDe(c);
  const p = r.personnages.find((x) => x.id === String(id || ''));
  if (!p) return { code: 404, erreur: 'personnage introuvable' };
  const c2 = await sauver(db, c, r.personnages.filter((x) => x.id !== p.id));
  if ((p.photos || []).length) await ST.supprimer(p.photos).catch(() => null);
  return { code: 200, ok: true, personnages: await lister(c2), moi: C.moi(c2) };
}

module.exports = { lister, preparerPhoto, enregistrer, supprimer, TAILLE_MAX };
