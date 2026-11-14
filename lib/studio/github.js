// L'usine du Studio tourne sur GitHub Actions, dans le dépôt de la tour (public : minutes illimitées, 20 machines en
// parallèle). La tour y pose elle-même le secret partagé avec l'usine (chiffré pour GitHub, boîte scellée libsodium) et
// lance une fabrication par vidéo et par langue. Le jeton de Louis ne sort jamais de la tour.
'use strict';
const nacl = require('tweetnacl');
const { blake2b } = require('blakejs');
const { court } = require('../util');

const API = 'https://api.github.com';
const DEPOT = process.env.HQ_USINE_DEPOT || 'LEXONOS/btprecruit-crm';
const WORKFLOW = 'usine.yml';
let FORCE = null;
function forcer(f) { FORCE = f; }

function jeton() { return String(process.env.HQ_GITHUB_TOKEN || '').trim(); }
function branche() { return !!(jeton() && String(process.env.HQ_USINE_SECRET || '').trim()); }

async function gh(tok, methode, chemin, corps) {
  const r = await (FORCE || fetch)(API + chemin, { method: methode, headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'la-tour' }, body: corps ? JSON.stringify(corps) : undefined, signal: AbortSignal.timeout(20000) });
  const txt = r.status === 204 ? '' : await r.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) { d = txt; }
  if (!r.ok) { const e = new Error((d && d.message) || ('HTTP ' + r.status)); e.statut = r.status; throw e; }
  return d;
}

// boîte scellée (crypto_box_seal de libsodium) : clé éphémère, nonce = blake2b(clé éphémère || clé publique, 24 octets)
function sceller(texte, clePubliqueB64) {
  const pk = new Uint8Array(Buffer.from(clePubliqueB64, 'base64'));
  const eph = nacl.box.keyPair();
  const nonce = blake2b(Buffer.concat([Buffer.from(eph.publicKey), Buffer.from(pk)]), null, 24);
  const chiffre = nacl.box(new Uint8Array(Buffer.from(String(texte), 'utf8')), nonce, pk, eph.secretKey);
  return Buffer.concat([Buffer.from(eph.publicKey), Buffer.from(chiffre)]).toString('base64');
}

// le jeton voit-il le dépôt, ses Actions et ses secrets ? (fine-grained : Actions et Secrets en écriture)
async function verifier(tok) {
  if (!/^(github_pat_|ghp_|gho_)[A-Za-z0-9_]{20,}$/.test(String(tok || ''))) return { erreur: 'ce n\'est pas un jeton GitHub (il commence par github_pat_)' };
  try { await gh(tok, 'GET', '/repos/' + DEPOT); }
  catch (e) { return { erreur: e.statut === 401 ? 'jeton refusé par GitHub (expiré ou mal copié)' : e.statut === 404 ? 'ce jeton ne voit pas le dépôt ' + DEPOT + ' : choisis-le dans « Repository access »' : 'GitHub répond : ' + court(e.message, 100) }; }
  try { await gh(tok, 'GET', '/repos/' + DEPOT + '/actions/secrets/public-key'); }
  catch (e) { return { erreur: 'il manque la permission « Secrets : Read and write » sur le jeton' }; }
  try { await gh(tok, 'GET', '/repos/' + DEPOT + '/actions/workflows'); }
  catch (e) { return { erreur: 'il manque la permission « Actions : Read and write » sur le jeton' }; }
  try { await gh(tok, 'GET', '/repos/' + DEPOT + '/actions/variables'); }
  catch (e) { return { erreur: 'il manque la permission « Variables : Read and write » sur le jeton' }; }
  return { ok: true };
}

async function poserSecret(tok, nom, valeur) {
  const k = await gh(tok, 'GET', '/repos/' + DEPOT + '/actions/secrets/public-key');
  await gh(tok, 'PUT', '/repos/' + DEPOT + '/actions/secrets/' + encodeURIComponent(nom), { encrypted_value: sceller(valeur, k.key), key_id: k.key_id });
}

// une variable (non secrète) de l'usine : l'adresse de la tour, que l'usine rappelle (jamais une adresse passée à la
// main au lancement : le secret partagé ne part que vers la tour)
async function poserVariable(tok, nom, valeur) {
  try { await gh(tok, 'PATCH', '/repos/' + DEPOT + '/actions/variables/' + encodeURIComponent(nom), { name: nom, value: String(valeur) }); }
  catch (e) { if (e.statut !== 404) throw e; await gh(tok, 'POST', '/repos/' + DEPOT + '/actions/variables', { name: nom, value: String(valeur) }); }
}

// lance la fabrication d'une vidéo dans une langue (l'usine rappelle la tour pour la commande et les envois)
async function lancer(video, langue) {
  const tok = jeton();
  if (!tok) throw new Error('usine non branchée (jeton GitHub absent)');
  await gh(tok, 'POST', '/repos/' + DEPOT + '/actions/workflows/' + WORKFLOW + '/dispatches', { ref: 'main', inputs: { video: String(video), langue: String(langue) } });
}

// le montage d'une vidéo du studio des créatrices (montage.yml : la voix, les images, les sous-titres, sans 3D)
const MONTAGE = 'montage.yml';
// voix : la voix Piper de cette langue (l'usine la garde en cache), vide pour Kokoro
async function lancerMontage(video, langue, voix) {
  const tok = jeton();
  if (!tok) throw new Error('usine non branchée (jeton GitHub absent)');
  const piper = /^[a-z]{2,3}_[A-Z]{2}-[a-z0-9_]+-(x_low|low|medium|high)$/.test(String(voix || '')) ? String(voix) : '';
  await gh(tok, 'POST', '/repos/' + DEPOT + '/actions/workflows/' + MONTAGE + '/dispatches', { ref: 'main', inputs: { video: String(video), langue: String(langue), voix: piper } });
}

// l'état des dernières fabrications (pour voir une usine qui ne démarre pas)
async function dernieres(n, flux) {
  const tok = jeton();
  if (!tok) return [];
  const d = await gh(tok, 'GET', '/repos/' + DEPOT + '/actions/workflows/' + (flux || WORKFLOW) + '/runs?per_page=' + (n || 10)).catch(() => null);
  return ((d && d.workflow_runs) || []).map((r) => ({ id: r.id, nom: r.display_title || r.name, etat: r.status, resultat: r.conclusion, le: r.created_at, url: r.html_url }));
}

module.exports = { DEPOT, WORKFLOW, MONTAGE, branche, verifier, poserSecret, poserVariable, lancer, lancerMontage, dernieres, sceller, forcer };
