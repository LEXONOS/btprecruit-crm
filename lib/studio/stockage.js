// Le stockage des vidéos du Studio : un espace privé « studio » du projet Supabase de la tour. L'usine y dépose ses
// fichiers par des liens d'envoi signés (valables 2 heures, un par fichier) ; la tour les lit par des liens signés.
'use strict';
const { SUPABASE_URL, SUPABASE_KEY } = require('../config');

const BUCKET = 'studio';
const BASE = SUPABASE_URL.replace(/\/$/, '') + '/storage/v1';
let FORCE = null;
function forcer(f) { FORCE = f; }

function entetes(extra) {
  const k = process.env.HQ_SUPABASE_KEY || SUPABASE_KEY;
  const h = Object.assign({ apikey: k }, extra || {});
  if (/^eyJ/.test(k)) h.Authorization = 'Bearer ' + k;
  return h;
}
async function appel(methode, chemin, corps, extra) {
  const r = await (FORCE || fetch)(BASE + chemin, { method: methode, headers: entetes(Object.assign(corps !== undefined ? { 'Content-Type': 'application/json' } : {}, extra || {})), body: corps !== undefined ? JSON.stringify(corps) : undefined, signal: AbortSignal.timeout(20000) });
  const txt = await r.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) { d = txt; }
  if (!r.ok) throw new Error('stockage : ' + ((d && (d.message || d.error)) || ('HTTP ' + r.status)));
  return d;
}
// un chemin propre : videos/<id>/<langue>/<fichier>, rien d'autre
function chemin(video, langue, nom) {
  if (!/^\d+$/.test(String(video)) || !/^[a-z]{2}$/.test(String(langue)) || !/^[a-z0-9-]+\.(mp4|jpg|srt)$/.test(String(nom))) throw new Error('chemin de fichier refusé');
  return 'videos/' + video + '/' + langue + '/' + nom;
}

// les fichiers du studio des créatrices : crea/<compte>/<vidéo>/<langue>/<fichier>
function cheminCrea(createur, video, langue, nom) {
  if (!/^\d+$/.test(String(createur)) || !/^\d+$/.test(String(video)) || !/^[a-z]{2}$/.test(String(langue)) || !/^(video\.mp4|vignette\.jpg|sous-titres\.srt)$/.test(String(nom))) throw new Error('chemin de fichier refusé');
  return 'crea/' + createur + '/' + video + '/' + langue + '/' + nom;
}

async function lienEnvoi(c) {
  const d = await appel('POST', '/object/upload/sign/' + BUCKET + '/' + c, {}, { 'x-upsert': 'true' });
  const rel = d && (d.url || d.signedURL);
  if (!rel) throw new Error('stockage : pas de lien d\'envoi');
  return BASE + rel;
}
async function liensLecture(chemins, secondes) {
  if (!chemins.length) return {};
  const d = await appel('POST', '/object/sign/' + BUCKET, { expiresIn: secondes || 3600, paths: chemins });
  const out = {};
  (Array.isArray(d) ? d : []).forEach((x) => { if (x && x.signedURL && !x.error) out[x.path] = BASE + x.signedURL; });
  return out;
}
async function lire(c) {
  const r = await (FORCE || fetch)(BASE + '/object/authenticated/' + BUCKET + '/' + c, { headers: entetes(), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('stockage : lecture ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
async function supprimer(chemins) { if (chemins.length) await appel('DELETE', '/object/' + BUCKET, { prefixes: chemins }); }

// un lien de téléchargement (le navigateur enregistre le fichier sous ce nom au lieu de l'ouvrir)
async function lienTelechargement(c, nom, secondes) {
  const d = await appel('POST', '/object/sign/' + BUCKET + '/' + c, { expiresIn: secondes || 3600 });
  const rel = d && (d.signedURL || d.signedUrl);
  if (!rel) throw new Error('stockage : pas de lien');
  return BASE + rel + (rel.indexOf('?') >= 0 ? '&' : '?') + 'download=' + encodeURIComponent(nom || '');
}
// les fichiers rangés sous un dossier (pour le ménage)
async function lister(dossier) {
  const d = await appel('POST', '/object/list/' + BUCKET, { prefix: dossier, limit: 100, offset: 0 });
  return (Array.isArray(d) ? d : []).map((x) => x && x.name).filter(Boolean);
}

module.exports = { BUCKET, chemin, cheminCrea, lienEnvoi, liensLecture, lienTelechargement, lister, lire, supprimer, forcer };
