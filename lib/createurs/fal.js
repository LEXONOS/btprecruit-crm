// fal.ai avec la clé de la créatrice : les images (FLUX.2 Turbo) et les petites vidéos (MiniMax H3 Max Turbo) de ses
// vidéos au look « images IA », et les voix naturelles (Eleven v4 d'ElevenLabs, lib/createurs/voix.js). Elle paie fal
// directement, à l'usage, dans le même budget du jour que Claude : chaque demande est réservée sur sa dépense avant de
// partir, rendue si fal échoue.
// Les demandes passent par la file d'attente de fal (queue.fal.run) : on envoie, on revient voir, on prend le résultat,
// toujours aux adresses que fal a rendues. Les fichiers créés restent 14 jours chez fal (le temps que le studio garde
// les vidéos), puis fal les efface. La clé ne part jamais ailleurs que chez fal.
'use strict';
const SEC = require('./secret');
const { court } = require('../util');

const FILE = 'https://queue.fal.run/';
// les demandes directes (sans file d'attente), pour ce qui se fait en quelques secondes : une phrase dite, une image
const DIRECT = 'https://fal.run/';
let FORCE = null;
function forcer(f) { FORCE = f; }

// les modèles et leurs prix chez fal (novembre 2026), à revoir si fal change ses tarifs
const MODELES = {
  // 1088 x 1920 (vertical, 2 mégapixels) à 0,008 $ le mégapixel
  image: { id: 'fal-ai/flux-2/turbo', nom: 'FLUX.2 Turbo', prix: 0.016, taille: { width: 1088, height: 1920 } },
  // l'image devient la première image de la vidéo ; 0,04 $ la seconde en 768p (la vidéo peut durer 0,7 s de plus que demandé)
  video: { id: 'minimax/h3-max-turbo/image-to-video', nom: 'MiniMax H3 Max Turbo', seconde: 0.04, resolution: '768P', marge: 0.7 },
  // la voix : Eleven v4 (ElevenLabs, septembre 2026), plus de 90 langues, 0,08 $ les 1 000 caractères dits
  voix: { id: 'elevenlabs/tts/eleven-v4', nom: 'Eleven v4 (ElevenLabs)', mille: 0.08 }
};
const GARDE_SECONDES = 14 * 86400;

class ErreurFal extends Error {
  constructor(code, message, definitif) { super(message); this.code = code; this.definitif = !!definitif; }
}
const MESSAGES = {
  fal_absente: 'Ta clé fal n\'est pas branchée : Réglages, Connexions. Ou continue cette vidéo sans images IA.',
  fal_illisible: 'Ta clé fal doit être recollée (le coffre de la tour a changé) : Réglages, Connexions.',
  fal_refusee: 'fal refuse ta clé (supprimée ou mal copiée) : recolle-la dans Réglages, Connexions.',
  fal_credit: 'Ton compte fal n\'a plus de crédit : ajoute du crédit sur fal.ai (Billing), l\'équipe reprend toute seule.',
  fal_surcharge: 'fal ne répond pas bien en ce moment : l\'équipe réessaie toute seule dans quelques minutes.'
};
function erreur(code, detail) { return new ErreurFal(code, MESSAGES[code] + (detail ? ' (' + court(detail, 160) + ')' : '')); }

function cle(createur) {
  const b = (createur.secrets || {}).fal;
  if (!b) throw erreur('fal_absente');
  const k = SEC.dechiffrer(b, 'fal:' + createur.id);
  if (!k) throw erreur('fal_illisible');
  return k;
}

// les adresses de la file d'attente (la clé n'est envoyée qu'à elles) et celles des fichiers créés (le CDN de fal, ou
// son ancien stockage) : l'usine ne télécharge rien d'autre
function urlFile(u) { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)fal\.run$/.test(x.hostname); } catch (e) { return false; } }
function mediaAccepte(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && (/(^|\.)fal\.media$/.test(x.hostname) || (x.hostname === 'storage.googleapis.com' && /^\/falserverless\//.test(x.pathname))); }
  catch (e) { return false; }
}

async function requete(k, url, methode, corps, delai) {
  const headers = { Authorization: 'Key ' + k, Accept: 'application/json' };
  if (corps) {
    headers['Content-Type'] = 'application/json';
    headers['X-Fal-Object-Lifecycle-Preference'] = JSON.stringify({ expiration_duration_seconds: GARDE_SECONDES });
  }
  return (FORCE || fetch)(url, { method: methode, headers, body: corps ? JSON.stringify(corps) : undefined, signal: AbortSignal.timeout(delai || 20000) });
}
async function lireJson(r) { try { return await r.json(); } catch (e) { return {}; } }

// le message d'erreur de fal, quelle que soit sa forme ({ detail: '...' }, { detail: [{ msg }] }, { error: '...' })
function message(d) {
  if (!d || typeof d !== 'object') return '';
  if (typeof d.detail === 'string') return d.detail;
  if (Array.isArray(d.detail)) return d.detail.map((x) => x && (x.msg || x.message)).filter(Boolean).join(' ; ');
  return String(d.error || d.message || '');
}
const SANS_CREDIT = /balance|locked|billing|credit|top.?up|payment|insufficient funds/i;
function traduire(status, d) {
  const msg = message(d);
  if (status === 401) return erreur('fal_refusee');
  if (status === 402 || (status === 403 && SANS_CREDIT.test(msg))) return erreur('fal_credit', msg);
  if (status === 403) return erreur('fal_refusee', msg);
  if (status === 408 || status === 429 || status >= 500) return erreur('fal_surcharge', msg || ('HTTP ' + status));
  // 400, 404, 422 : la même demande serait encore refusée
  return new ErreurFal('fal', 'fal a refusé la demande : ' + court(msg || ('HTTP ' + status), 200), true);
}
// la base des adresses d'une demande : le propriétaire et l'application du modèle (« fal-ai/flux-2 »), sans le reste
const baseDemandes = (modele) => FILE + modele.split('/').slice(0, 2).join('/') + '/requests/';

// envoyer une demande dans la file : { id, statut, resultat } (les adresses à suivre)
async function envoyer(k, modele, entree) {
  let r;
  try { r = await requete(k, FILE + modele, 'POST', entree, 25000); }
  catch (e) { throw erreur('fal_surcharge', e && e.name === 'TimeoutError' ? 'pas de réponse' : (e && e.message) || 'injoignable'); }
  const d = await lireJson(r);
  if (!r.ok) throw traduire(r.status, d);
  if (!d.request_id || !/^[A-Za-z0-9_-]{1,100}$/.test(String(d.request_id))) throw erreur('fal_surcharge', 'pas de numéro de demande');
  const base = baseDemandes(modele) + d.request_id;
  return { id: String(d.request_id), statut: urlFile(d.status_url) ? d.status_url : base + '/status', resultat: urlFile(d.response_url) ? d.response_url : base };
}

// une demande directe : la réponse de fal, ou une erreur (ErreurFal) ; pour les demandes de quelques secondes
async function executer(k, modele, entree, delai) {
  let r;
  try { r = await requete(k, DIRECT + modele, 'POST', entree, delai || 60000); }
  catch (e) { throw erreur('fal_surcharge', e && e.name === 'TimeoutError' ? 'pas de réponse' : (e && e.message) || 'injoignable'); }
  const d = await lireJson(r);
  if (!r.ok) throw traduire(r.status, d);
  return d;
}

// revenir voir une demande : { etat: 'attente' | 'en_cours' | 'fini' | 'echec' | 'perdue', sortie, erreur }
// (une clé refusée ou un compte sans crédit lèvent une erreur : c'est à la créatrice de régler)
async function suivre(k, job) {
  if (!urlFile(job.statut) || !urlFile(job.resultat)) return { etat: 'perdue' };
  let r;
  try { r = await requete(k, job.statut, 'GET', null, 15000); } catch (e) { return { etat: 'attente' }; }
  const d = await lireJson(r);
  if (r.status === 404) return { etat: 'perdue' };
  if (!r.ok) { const e = traduire(r.status, d); if (e.code === 'fal_surcharge' || e.code === 'fal') return { etat: 'attente' }; throw e; }
  if (d.status === 'IN_QUEUE') return { etat: 'attente', position: Number(d.queue_position) || 0 };
  if (d.status === 'IN_PROGRESS') return { etat: 'en_cours' };
  if (d.status !== 'COMPLETED') return { etat: 'attente' };
  if (d.error) return { etat: 'echec', erreur: court(String(d.error), 200) };
  let r2;
  try { r2 = await requete(k, job.resultat, 'GET', null, 20000); } catch (e) { return { etat: 'attente' }; }
  const s = await lireJson(r2);
  if (r2.ok) return { etat: 'fini', sortie: s };
  const e2 = traduire(r2.status, s);
  if (e2.code === 'fal_surcharge') return { etat: 'attente' };
  if (e2.code === 'fal') return { etat: 'echec', erreur: court(message(s) || ('HTTP ' + r2.status), 200) };
  throw e2;
}

// ce qu'on demande, et ce qu'on lit dans la réponse
function entreeImage(prompt, graine) {
  return { prompt, image_size: MODELES.image.taille, num_images: 1, output_format: 'jpeg', guidance_scale: 2.5, enable_safety_checker: true, seed: graine };
}
// le résultat de fal, tel quel ou rangé dans « response » ou « data » selon les versions de la file d'attente
const contenu = (s) => (s && (s.images || s.video || s.audio) ? s : (s && (s.response || s.data)) || s || {});
function lireImage(sortie) {
  sortie = contenu(sortie);
  const im = ((sortie && sortie.images) || [])[0];
  if (!im || !mediaAccepte(im.url)) return { erreur: 'fal n\'a pas rendu d\'image' };
  if (Array.isArray(sortie.has_nsfw_concepts) && sortie.has_nsfw_concepts[0]) return { erreur: 'image écartée par le filtre de fal' };
  return { url: im.url, w: Number(im.width) || MODELES.image.taille.width, h: Number(im.height) || MODELES.image.taille.height };
}
function entreeVideo(image, prompt, duree) {
  return { prompt, image_url: image, duration: duree, resolution: MODELES.video.resolution, prompt_expansion_mode: 'balanced', enable_safety_checker: true };
}
function lireVideo(sortie) {
  const v = contenu(sortie).video;
  if (!v || !mediaAccepte(v.url)) return { erreur: 'fal n\'a pas rendu de vidéo' };
  return { url: v.url };
}
// une phrase dite : la voix choisie, dans la langue de la vidéo (l'accent suit la langue), la même graine pour toute la
// vidéo (une voix égale d'une phrase à l'autre) ; un peu d'expressivité, comme une créatrice qui raconte
function entreeVoix(texte, voix, langue, graine) {
  const e = { text: texte, voice: voix, stability: 0.4, similarity_boost: 0.75, apply_text_normalization: 'auto', output_format: 'mp3_44100_128', enable_safety_checker: true };
  if (/^[a-z]{2}$/.test(String(langue || ''))) e.language_code = langue;
  if (Number.isInteger(graine) && graine >= 0) e.seed = graine;
  return e;
}
function lireAudio(sortie) {
  const a = contenu(sortie).audio;
  if (!a || !mediaAccepte(a.url)) return { erreur: 'fal n\'a pas rendu de voix' };
  return { url: a.url };
}
// le prix d'une phrase dite : ses caractères (un idéogramme compte pour un)
const prixVoix = (texte) => Math.round(Math.max(1, Array.from(String(texte || '')).length) * MODELES.voix.mille / 1000 * 100000) / 100000;
// le prix réservé d'une animation : ses secondes, plus ce que fal peut ajouter
const prixVideo = (duree) => Math.round((Number(duree) + MODELES.video.marge) * MODELES.video.seconde * 10000) / 10000;

// l'état de sa clé, vu par la page (« fal refuse ta clé », « plus de crédit »), remis à « ok » dès que ça remarche
async function marquer(db, createur, etat, msg) {
  const s = Object.assign({}, createur.secrets || {});
  if (!s.fal || ((s.fal.etat || 'ok') === etat && !msg)) return;
  s.fal = Object.assign({}, s.fal, { etat, message: msg || null });
  createur.secrets = s;
  await db.update('hq_createurs', { secrets: s, updated_at: new Date().toISOString() }, { eq: { id: createur.id } }).catch(() => null);
}

// Une clé collée par la créatrice : est-ce bien une clé, fal la connaît-il ? Deux questions gratuites : les prix du
// modèle d'images (l'API de fal, pour une clé de type API), puis l'état d'une demande qui n'existe pas (la file
// d'attente) ; une clé inconnue est refusée par l'une ou l'autre, un compte sans crédit se voit à la seconde.
const PRIX = 'https://api.fal.ai/v1/models/pricing?endpoint_id=';
async function essayerCle(k) {
  k = SEC.cleCollee(String(k || '').trim().replace(/^["']+/, '').replace(/^(Key\s+|Bearer\s+|FAL_KEY\s*=\s*)/i, ''));
  if (/^sk-ant-/.test(k)) return { erreur: 'c\'est ta clé Claude : il faut ici la clé de ton compte fal' };
  if (!/^[A-Za-z0-9_.:-]{20,200}$/.test(k)) return { erreur: 'ce n\'est pas une clé fal : elle ressemble à deux suites de chiffres et de lettres séparées par deux-points' };
  const inconnue = { erreur: 'fal ne reconnaît pas cette clé (supprimée, ou mal copiée : copie-la en entier)' };
  let p = null;
  try { p = await requete(k, PRIX + encodeURIComponent(MODELES.image.id), 'GET', null, 12000); } catch (e) { p = null; }
  if (p && p.status === 401) return inconnue;
  let r;
  try { r = await requete(k, baseDemandes(MODELES.image.id) + '00000000-0000-4000-8000-000000000000/status', 'GET', null, 15000); }
  catch (e) { return p && p.ok ? { ok: true, cle: k } : { erreur: 'fal ne répond pas, réessaie dans une minute' }; }
  const d = await lireJson(r);
  const msg = message(d);
  if (r.status === 401) return inconnue;
  if (r.status === 402 || (r.status === 403 && SANS_CREDIT.test(msg))) return { ok: true, cle: k, credit: false, avertissement: 'ta clé marche, mais ton compte fal n\'a pas encore de crédit : ajoute 5 $ dans Billing avant ta première vidéo en images IA' };
  if (r.status === 403 && !(p && p.ok)) return { erreur: 'fal refuse cette clé (' + court(msg || 'droits insuffisants', 80) + ') : crée une clé de type API' };
  if ((r.status === 429 || r.status >= 500) && !(p && p.ok)) return { erreur: 'fal répond ' + r.status + ', réessaie dans une minute' };
  return { ok: true, cle: k };
}

module.exports = { MODELES, MESSAGES, ErreurFal, cle, envoyer, suivre, executer, entreeImage, lireImage, entreeVideo, lireVideo, prixVideo, entreeVoix, lireAudio, prixVoix, marquer, essayerCle, urlFile, mediaAccepte, traduire, forcer };
