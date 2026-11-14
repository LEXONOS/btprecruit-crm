// Sacha publie par upload-post (le compte et la clé de la créatrice) : un « profil » upload-post relie ses comptes
// TikTok, YouTube et Instagram (une fois, par leur page de connexion), puis chaque version de langue part vers le
// profil qu'elle a choisi pour cette langue. upload-post va chercher la vidéo elle-même (un lien signé de 24 heures).
// Gratuit : 10 publications par mois, YouTube et Instagram ; TikTok demande leur offre payante. Sans upload-post, tout
// est prêt pour publier à la main depuis le téléphone (télécharger ou partager, le texte à copier).
'use strict';
const SEC = require('./secret');
const C = require('./index');
const { court } = require('../util');

const API = 'https://api.upload-post.com/api';
let FORCE = null;
function forcer(f) { FORCE = f; }

async function appel(k, methode, chemin, corps, form) {
  const h = { Authorization: 'Apikey ' + k, Accept: 'application/json' };
  let body;
  if (form) body = form;
  else if (corps) { h['Content-Type'] = 'application/json'; body = JSON.stringify(corps); }
  const r = await (FORCE || fetch)(API + chemin, { method: methode, headers: h, body, signal: AbortSignal.timeout(45000) });
  const txt = await r.text();
  let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) { d = { message: txt }; }
  if (!r.ok) { const e = new Error((d && (d.message || d.error || d.detail)) || ('HTTP ' + r.status)); e.statut = r.status; e.code = d && (d.code || d.error_code); throw e; }
  return d || {};
}

function cle(createur) {
  const b = (createur.secrets || {}).uploadpost;
  if (!b) { const e = new Error('upload-post n\'est pas branché (Réglages, Connexions)'); e.cle = true; throw e; }
  const k = SEC.dechiffrer(b, 'uploadpost:' + createur.id);
  if (!k) { const e = new Error('ta clé upload-post doit être recollée (Réglages, Connexions)'); e.cle = true; throw e; }
  return k;
}

// les profils et les comptes reliés à chacun
function lireProfils(d) {
  return (d.profiles || []).map((p) => {
    const comptes = {};
    Object.keys(C.PLATEFORMES).forEach((pl) => {
      const a = (p.social_accounts || {})[pl];
      comptes[pl] = a && typeof a === 'object' ? { nom: court(a.display_name || a.handle || pl, 60), pseudo: a.handle ? court(a.handle, 60) : null, reconnecter: !!a.reauth_required } : null;
    });
    return { username: String(p.username || ''), nom: court(p.display_name || p.username || '', 60), comptes };
  }).filter((p) => p.username);
}

async function essayerCle(k) {
  k = String(k || '').trim();
  if (k.length < 20 || k.length > 400 || /\s/.test(k)) return { erreur: 'ce n\'est pas une clé upload-post (copie-la en entier depuis « API Keys »)' };
  try {
    const d = await appel(k, 'GET', '/uploadposts/users');
    return { ok: true, plan: d.plan || null, limite: d.limit || null, profils: lireProfils(d) };
  } catch (e) {
    if (e.statut === 401 || e.statut === 403) return { erreur: 'upload-post ne reconnaît pas cette clé' };
    return { erreur: 'upload-post répond : ' + court(e.message, 120) };
  }
}

async function profils(createur) {
  const d = await appel(cle(createur), 'GET', '/uploadposts/users');
  return { plan: d.plan || null, limite: d.limit || null, profils: lireProfils(d) };
}

async function creerProfil(createur, username) {
  if (!/^[A-Za-z0-9_.-]{3,40}$/.test(String(username || ''))) throw new Error('nom de profil : 3 à 40 lettres, chiffres, points ou tirets');
  await appel(cle(createur), 'POST', '/uploadposts/users', { username: String(username) });
  return profils(createur);
}

// la page upload-post où elle relie ses comptes (valable 48 heures), puis retour au studio
async function lienConnexion(createur, username, retour, mode) {
  const d = await appel(cle(createur), 'POST', '/uploadposts/users/generate-jwt', {
    username: String(username), redirect_url: retour, platforms: Object.keys(C.PLATEFORMES), language: 'fr',
    connect_theme: mode === 'clair' ? 'light' : 'dark', connect_title: 'Relie tes comptes', connect_description: 'Le studio publiera tes vidéos sur les comptes que tu relies ici.', redirect_button_text: 'Revenir au studio'
  });
  if (!d.access_url || !/^https:\/\//.test(d.access_url)) throw new Error('upload-post n\'a pas rendu de lien');
  return d.access_url;
}

// le texte d'une version de langue, par plateforme
function legende(t) {
  const tags = (t.hashtags || []).map((h) => '#' + h).join(' ');
  return { courte: court([t.description, tags].filter(Boolean).join('\n\n'), 2100), titre: court(t.titre_youtube || t.titre || '', 95), longue: court([t.description, tags].filter(Boolean).join('\n\n'), 4800), tags: (t.hashtags || []).slice(0, 15) };
}

// une version de langue vers ses plateformes ; rend l'identifiant de la demande (suivie ensuite)
async function publier(createur, v, langue, plateformes, urlVideo, texte) {
  const r = C.reglagesDe(createur);
  const profil = ((r.publication || {})[langue] || {}).profil;
  if (!profil) throw new Error('aucun profil upload-post choisi pour cette langue');
  const g = legende(texte);
  const requete = 'crea-' + v.id + '-' + langue + '-' + Date.now().toString(36);
  const f = new FormData();
  f.append('user', profil);
  plateformes.forEach((p) => f.append('platform[]', p));
  f.append('video', urlVideo);
  f.append('title', g.courte);
  f.append('async_upload', 'true');
  f.append('request_id', requete);
  f.append('external_id', 'studio-' + v.id + '-' + langue);
  if (plateformes.indexOf('youtube') >= 0) {
    f.append('youtube_title', g.titre || court(g.courte, 95));
    f.append('youtube_description', g.longue);
    g.tags.forEach((t) => f.append('tags[]', t));
    f.append('privacyStatus', r.visibilite.youtube);
    f.append('selfDeclaredMadeForKids', 'false');
    f.append('defaultLanguage', langue);
    f.append('defaultAudioLanguage', langue);
  }
  if (plateformes.indexOf('tiktok') >= 0) {
    f.append('privacy_level', r.visibilite.tiktok);
    if (r.etiquette_ia !== false) f.append('is_aigc', 'true');
  }
  if (plateformes.indexOf('instagram') >= 0) f.append('media_type', 'REELS');
  const d = await appel(cle(createur), 'POST', '/upload', null, f);
  return { requete: d.request_id || requete, reponse: court(JSON.stringify(d), 300) };
}

// où en est une demande : { fini, resultats: { tiktok: { ok, lien, message } } }
async function suivre(createur, requete) {
  let d;
  try { d = await appel(cle(createur), 'GET', '/uploadposts/status?request_id=' + encodeURIComponent(requete)); }
  catch (e) { if (e.statut === 404) return { fini: true, perdu: true, resultats: {} }; throw e; }
  const resultats = {};
  (d.results || []).forEach((x) => {
    if (!x || !x.platform) return;
    resultats[x.platform] = { ok: !!x.success, lien: x.post_url || x.url || null, message: court(x.message || x.skip_reason || '', 200), saute: !!x.skipped };
  });
  const fini = ['completed', 'failed', 'not_found'].indexOf(String(d.status)) >= 0;
  return { fini, statut: d.status, resultats, message: court(d.message || '', 200) };
}

module.exports = { essayerCle, profils, creerProfil, lienConnexion, publier, suivre, legende, lireProfils, forcer };
