// Vercel pour les sites des clients : un projet PUBLIC séparé de la tour (la tour reste protégée),
// fichiers envoyés une fois par empreinte (sha1), déploiements de production, domaines et registrar.
// Une seule variable à poser : HQ_VERCEL_TOKEN (jeton du compte Vercel, équipe de Louis).
'use strict';
const crypto = require('crypto');
const { NOVALEMO } = require('../config');

const API = 'https://api.vercel.com';
let FORCE = null;                 // tests : fetch simulé
function forcer(f) { FORCE = f; equipeCache = null; }

function jeton() { return String(process.env.HQ_VERCEL_TOKEN || process.env.VERCEL_TOKEN || '').trim(); }
function branche() { return !!jeton(); }
const sha1 = function (b) { return crypto.createHash('sha1').update(b).digest('hex'); };

class ErreurVercel extends Error { constructor(m, statut, code, corps) { super(m); this.statut = statut; this.code = code; this.corps = corps; } }

let equipeCache = null;
async function equipe() {
  if (process.env.HQ_VERCEL_TEAM) return process.env.HQ_VERCEL_TEAM;
  if (equipeCache) return equipeCache;
  const r = await brut('GET', '/v2/teams?limit=5', null, true);
  const t = (r.teams || [])[0];
  equipeCache = t ? t.id : '';
  return equipeCache;
}

async function brut(methode, chemin, corps, sansEquipe, entetes) {
  const t = jeton();
  if (!t) throw new ErreurVercel('HQ_VERCEL_TOKEN absente', 0, 'pas_de_jeton');
  let url = API + chemin;
  if (!sansEquipe) { const e = await equipe(); if (e) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'teamId=' + encodeURIComponent(e); }
  const binaire = Buffer.isBuffer(corps);
  const opts = { method: methode, headers: Object.assign({ Authorization: 'Bearer ' + t }, binaire ? { 'Content-Type': 'application/octet-stream' } : corps ? { 'Content-Type': 'application/json' } : {}, entetes || {}), body: corps == null ? undefined : (binaire ? corps : JSON.stringify(corps)), signal: AbortSignal.timeout(40000) };
  const f = FORCE || fetch;
  const r = await f(url, opts);
  const txt = await r.text();
  let d = null; try { d = txt ? JSON.parse(txt) : {}; } catch (e) { d = { brut: txt }; }
  if (!r.ok) {
    const err = (d && d.error) || d || {};
    throw new ErreurVercel('Vercel ' + methode + ' ' + chemin.split('?')[0] + ' : ' + (err.message || err.code || ('HTTP ' + r.status)), r.status, err.code || (d && d.code) || null, d);
  }
  return d;
}

/* ── le projet public des sites ── */
// Crée le projet s'il n'existe pas, et coupe la protection Vercel (les sites doivent être visibles de tous)
async function assurerProjet(cache) {
  const nom = NOVALEMO.projet_sites;
  if (cache && cache.projet && cache.projet.id && cache.projet.public) return cache.projet;
  let p = null;
  try { p = await brut('GET', '/v9/projects/' + encodeURIComponent(nom)); }
  catch (e) { if (e.statut !== 404) throw e; }
  if (!p) p = await brut('POST', '/v11/projects', { name: nom, framework: null, ssoProtection: null });
  if (p.ssoProtection || p.passwordProtection) p = await brut('PATCH', '/v9/projects/' + p.id, { ssoProtection: null, passwordProtection: null });
  return { id: p.id, nom: p.name, public: true };
}
// L'adresse publique du projet (nom.vercel.app, ou un domaine posé dans HQ_SITES_DOMAINE)
async function hotePrincipal(projetId) {
  if (process.env.HQ_SITES_DOMAINE) return String(process.env.HQ_SITES_DOMAINE).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const d = await brut('GET', '/v9/projects/' + projetId + '/domains?limit=50');
  const liste = (d.domains || []).map(function (x) { return x.name; });
  return liste.find(function (n) { return /\.vercel\.app$/.test(n); }) || liste[0] || null;
}

/* ── fichiers et déploiements ── */
async function envoyerFichier(buf) {
  const s = sha1(buf);
  await brut('POST', '/v2/files', buf, false, { 'x-vercel-digest': s, 'Content-Length': String(buf.length) });
  return { sha: s, size: buf.length };
}
// files = [{ file, sha, size }] ; manquants(shas) doit renvoyer les octets à envoyer pour les fichiers que Vercel n'a pas
async function deployer(projet, files, manquants, meta) {
  const corps = { name: projet.nom, project: projet.id, target: 'production', files: files, meta: meta || {}, projectSettings: { framework: null, buildCommand: null, installCommand: null, outputDirectory: null, devCommand: null } };
  for (let essai = 0; essai < 3; essai++) {
    try { return await brut('POST', '/v13/deployments?skipAutoDetectionConfirmation=1', corps); }
    catch (e) {
      const liste = e.code === 'missing_files' ? ((e.corps && e.corps.error && e.corps.error.missing) || []) : null;
      if (!liste || !liste.length || essai === 2) throw e;
      const bufs = await manquants(liste);
      for (const b of bufs) await envoyerFichier(b);
    }
  }
  throw new ErreurVercel('déploiement impossible', 0, 'echec');
}
async function etatDeploiement(id) { const d = await brut('GET', '/v13/deployments/' + encodeURIComponent(id)); return { etat: d.readyState || d.status, url: d.url, alias: d.alias || [], erreur: d.errorMessage || null }; }

/* ── domaines ── */
// Ajoute un domaine au projet des sites. Déjà là (refus 400 ou 409) : on vérifie qu'il est bien rattaché à CE projet
// (un domaine pris par un autre projet ou un autre compte n'est jamais compté comme branché).
async function ajouterDomaine(projetId, nom, redirection) {
  const corps = { name: nom };
  if (redirection) { corps.redirect = redirection; corps.redirectStatusCode = 308; }
  try { return await brut('POST', '/v10/projects/' + projetId + '/domains', corps); }
  catch (e) {
    if (e.statut !== 400 && e.statut !== 409) throw e;
    const d = await domaineDuProjet(projetId, nom).catch(function () { return null; });
    if (d && d.name) return Object.assign({ deja: true }, d);
    throw e;
  }
}
async function domaineDuProjet(projetId, nom) {
  try { return await brut('GET', '/v9/projects/' + projetId + '/domains/' + encodeURIComponent(nom)); }
  catch (e) { if (e.statut === 404) return null; throw e; }
}
// Le domaine est-il dans le compte (acheté chez Vercel) ? Sert à savoir si un achat dont on n'a pas eu la réponse a abouti
async function domaineAuCompte(nom) {
  try { const d = await brut('GET', '/v5/domains/' + encodeURIComponent(nom)); return (d && d.domain) || null; }
  catch (e) { if (e.statut === 404) return null; throw e; }
}
async function verifierDomaine(projetId, nom) { return brut('POST', '/v9/projects/' + projetId + '/domains/' + encodeURIComponent(nom) + '/verify', {}); }
async function configDomaine(nom) { return brut('GET', '/v6/domains/' + encodeURIComponent(nom) + '/config'); }
async function disponible(nom) { const d = await brut('GET', '/v1/registrar/domains/' + encodeURIComponent(nom) + '/availability'); return !!d.available; }
async function prix(nom) { const d = await brut('GET', '/v1/registrar/domains/' + encodeURIComponent(nom) + '/price'); return { prix: Number(d.purchasePrice), renouvellement: Number(d.renewalPrice), annees: d.years || 1 }; }
async function acheter(nom, prixAttendu, contact) {
  return brut('POST', '/v1/registrar/domains/' + encodeURIComponent(nom) + '/buy', { autoRenew: true, years: 1, expectedPrice: prixAttendu, contactInformation: contact });
}
async function commande(orderId) { return brut('GET', '/v1/registrar/orders/' + encodeURIComponent(orderId)); }
// Renouvellement automatique d'un domaine acheté (coupé si le client ne règle plus l'hébergement, remis au paiement)
async function autoRenouvellement(nom, oui) { return brut('PATCH', '/v1/registrar/domains/' + encodeURIComponent(nom) + '/auto-renew', { autoRenew: !!oui }); }

module.exports = { branche, assurerProjet, hotePrincipal, envoyerFichier, deployer, etatDeploiement, ajouterDomaine, domaineDuProjet, domaineAuCompte, verifierDomaine, configDomaine, disponible, prix, acheter, commande, autoRenouvellement, sha1, forcer, ErreurVercel, brut };
