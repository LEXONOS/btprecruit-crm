// La porte de la tour. Un seul utilisateur, Louis : un mot de passe qu'il choisit à la première ouverture, en prouvant
// que c'est son compte avec un jeton Vercel qui voit le projet de la tour (identifiant fixé dans config.js : un autre
// projet du même nom ne compte pas). Le mot de passe n'est gardé nulle part en clair : seulement son empreinte scrypt,
// dans les variables Vercel (type sensible), à côté d'une clé de session tirée au hasard.
// Quand la base est branchée, elle tient la version du mot de passe en service : une tour restée sur l'ancien (un vieux
// déploiement, ou celle qui redémarre) n'ouvre plus rien. Sessions : cookies signés (HttpOnly, Secure, SameSite=Lax),
// 30 jours renouvelés à l'usage, 90 jours au plus ; « Déconnecter les autres appareils » et « Me déconnecter » les
// ferment côté serveur. Chaque essai est compté AVANT d'être vérifié, en une seule instruction : cinq essais ratés depuis
// une adresse (un bloc /64 en IPv6) et elle attend, de plus en plus longtemps ; 40 en tout et les appareils inconnus
// attendent 15 minutes. Un appareil déjà connu a son propre compteur : personne ne peut fermer la porte à Louis depuis
// ailleurs. Chaque nouvel appareil prévient Louis.
'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const { court } = require('./util');

const scrypt = promisify(crypto.scrypt);
const COOKIE = '__Host-tour';
const COOKIE_APP = '__Host-tour-app';
const DUREE_MS = 30 * 86400000;
const RENOUVELER_MS = 86400000;          // une session utilisée est re-signée au plus une fois par jour
const MAX_MS = 90 * 86400000;            // et quoi qu'il arrive, le mot de passe est redemandé tous les 90 jours
const APPAREIL_MS = 400 * 86400000;
const PARAMS = { N: 32768, r: 8, p: 1 };
const MAXMEM = 128 * 1024 * 1024;
const MIN_MDP = 12;
const FENETRE_S = 15 * 60;
// max : le dernier essai permis pose le verrou (il est quand même vérifié) ; croissant : 15 min, 30, 1 h... jusqu'à 24 h
const LIMITES = {
  adresse: { max: 5, blocage: FENETRE_S, croissant: true },
  tous: { max: 40, blocage: FENETRE_S, croissant: false },
  appareil: { max: 8, blocage: FENETRE_S, croissant: true },
  creer: { max: 6, blocage: FENETRE_S, croissant: true }
};
const COMMUNS = ['motdepasse', 'monmotdepasse', 'password', 'passwordpassword', 'azertyuiop', 'azertyuiopqs', 'qwertyuiop', 'azerty', 'qwerty', 'latour', 'latourdelexonos',
  'lexonos', 'novalemo', 'novalem', 'novalemosites', 'louisrenault', 'renaultlouis', 'louis', 'soleil', 'bonjour', 'bienvenue', 'jetaime', 'iloveyou', 'doudou',
  'chocolat', 'martinique', 'guadeloupe', 'fortdefrance', 'lelamentin', 'lamentin', 'cholet', 'admin', 'administrateur', 'secret', 'welcome', 'football', 'marseille', 'paris'];

const iso = function () { return new Date().toISOString(); };
const b64 = function (buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); };
const deb64 = function (s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); };
const ua = function (req) { return req.headers && req.headers['user-agent']; };

let FORCE_DB = null;
function forcerBase(db) { FORCE_DB = db; vider(); }
function base() { return FORCE_DB || require('./db').open(); }

/* ── le mot de passe ── */
function empreinte() { return String(process.env.HQ_ACCES || '').trim(); }
function configure() { return /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(empreinte()); }
function normaliser(mdp) { return String(mdp == null ? '' : mdp).normalize('NFKC'); }
// La version publique d'une empreinte : elle dit quel mot de passe une tour connaît, sans rien apprendre de lui
function versionDe(h) { return h ? crypto.createHash('sha256').update('la-tour/version/' + h).digest('hex').slice(0, 16) : null; }
function versionIci() { return configure() ? versionDe(empreinte()) : null; }

async function hacher(mdp) {
  const sel = crypto.randomBytes(16);
  const h = await scrypt(normaliser(mdp), sel, 32, Object.assign({ maxmem: MAXMEM }, PARAMS));
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, sel.toString('base64'), h.toString('base64')].join('$');
}
async function bonMotDePasse(mdp, stocke) {
  const p = String(stocke || '').split('$');
  if (p.length !== 6 || p[0] !== 'scrypt') return false;
  const N = Number(p[1]), r = Number(p[2]), pp = Number(p[3]);
  if (!(N >= 16384 && N <= 1048576 && (N & (N - 1)) === 0 && r >= 1 && r <= 16 && pp >= 1 && pp <= 4)) return false;
  const sel = Buffer.from(p[4], 'base64'), attendu = Buffer.from(p[5], 'base64');
  if (sel.length < 8 || attendu.length < 16) return false;
  const h = await scrypt(normaliser(mdp), sel, attendu.length, { N: N, r: r, p: pp, maxmem: MAXMEM });
  return crypto.timingSafeEqual(h, attendu);
}
// Assez long pour ne pas se deviner, et pas un mot évident. Pas de règle de majuscules ou de symboles : la longueur compte.
function regle(mdp) {
  const m = normaliser(mdp);
  if (m.length < MIN_MDP) return 'au moins ' + MIN_MDP + ' caractères';
  if (m.length > 128) return '128 caractères au plus';
  if (new Set(m.toLowerCase()).size < 5) return 'trop peu de caractères différents';
  const lettres = m.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  if (/^\d+$/.test(m) && m.length < 14) return 'que des chiffres : 14 au moins';
  if (COMMUNS.indexOf(lettres) >= 0 || /^(0123456789|1234567890|9876543210)+$/.test(m)) return 'trop facile à deviner';
  return null;
}

/* ── les jetons de session ── */
// Clé : la clé de session tirée au hasard (HQ_SESSION), liée à la version du mot de passe : changer l'un ou l'autre
// annule toutes les sessions. Sans HQ_SESSION (tour d'avant), l'empreinte sert de clé.
function cle() {
  const s = String(process.env.HQ_SESSION || '').trim();
  return crypto.createHmac('sha256', s.length >= 32 ? s : empreinte()).update('la-tour/session/v2/' + versionIci()).digest();
}
function signer(charge) {
  const corps = 'v1.' + b64(JSON.stringify(charge));
  return corps + '.' + b64(crypto.createHmac('sha256', cle()).update(corps).digest());
}
function lireJeton(jeton) {
  if (!configure()) return null;
  const p = String(jeton || '').split('.');
  if (p.length !== 3 || p[0] !== 'v1' || p[2].length < 20) return null;
  const attendu = crypto.createHmac('sha256', cle()).update(p[0] + '.' + p[1]).digest();
  const recu = deb64(p[2]);
  if (recu.length !== attendu.length || !crypto.timingSafeEqual(recu, attendu)) return null;
  let c; try { c = JSON.parse(deb64(p[1]).toString('utf8')); } catch (e) { return null; }
  const t = Date.now();
  if (!c || typeof c.iat !== 'number' || typeof c.exp !== 'number' || c.exp <= t || c.iat > t + 60000) return null;
  return c;
}

/* ── cookies et requête ── */
function lireCookies(req) {
  const out = {};
  String((req.headers && req.headers.cookie) || '').split(';').forEach(function (x) {
    const i = x.indexOf('=');
    if (i > 0) { const k = x.slice(0, i).trim(); if (!(k in out)) out[k] = x.slice(i + 1).trim(); }
  });
  return out;
}
function ligneCookie(nom, valeur, maxAgeMs) {
  return nom + '=' + valeur + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + Math.max(0, Math.floor(maxAgeMs / 1000));
}
function ajouterCookie(res, ligne) {
  const avant = res.getHeader ? res.getHeader('Set-Cookie') : res.__cookies;
  const liste = [].concat(avant || [], ligne);
  if (res.setHeader) res.setHeader('Set-Cookie', liste);
  res.__cookies = liste;
}
function adresse(req) {
  const h = req.headers || {};
  return String(h['x-real-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'inconnue').trim();
}
// Une adresse IPv4 telle quelle ; en IPv6, le bloc /64 (un abonné en a des milliards : on compte le bloc)
function cleAdresse(ip) {
  let a = String(ip || '').trim().toLowerCase();
  const v4 = a.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  if (a.indexOf(':') < 0) return a || 'inconnue';
  a = a.split('%')[0].replace(/^\[|\]$/g, '');
  const morceaux = a.split('::');
  if (morceaux.length > 2) return a;
  const tete = morceaux[0] ? morceaux[0].split(':') : [];
  const queue = morceaux.length === 2 && morceaux[1] ? morceaux[1].split(':') : [];
  const plein = morceaux.length === 2 ? tete.concat(new Array(Math.max(0, 8 - tete.length - queue.length)).fill('0'), queue) : tete;
  return plein.slice(0, 4).map(function (x) { return (x || '0').replace(/^0+(?=.)/, ''); }).join(':') + '::/64';
}
function empreinteAdresse(ip) { return crypto.createHash('sha256').update('la-tour/ip/' + ip).digest('hex').slice(0, 16); }
function masquer(ip) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.split('.').slice(0, 2).join('.') + '.x.x';
  if (ip.indexOf(':') >= 0) return ip.split(':').slice(0, 3).join(':') + ':…';
  return 'inconnue';
}
function appareilDe(u) {
  u = String(u || '');
  const sys = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac OS X|Macintosh/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : 'Appareil';
  const nav = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'navigateur';
  return sys + ', ' + nav;
}
// Un POST ne vient que de la page de la tour : même hôte, et en JSON (un autre site ne peut pas l'envoyer sans pré-vol)
function memeOrigine(req) {
  const h = req.headers || {};
  const o = h.origin || '';
  if (!o) return false;
  let hote;
  try { hote = new URL(o).host; } catch (e) { return false; }
  const ici = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  if (!ici || hote !== ici) return false;
  return /^application\/json\s*(;|$)/i.test(String(h['content-type'] || '').trim());
}

/* ── ce que la base tient : version du mot de passe, génération des sessions, sessions fermées ── */
const CACHE = new Map();
const FRAIS_MS = 8000, SECOURS_MS = 60000;
// { acces, fermee } ; null : base branchée mais muette (on ferme, sauf lecture de moins d'une minute)
async function etatBase(db, s, frais) {
  const k = s || '-', t = Date.now(), c = CACHE.get(k);
  if (!frais && c && t - c.t < FRAIS_MS) return c.v;
  try {
    const rows = await db.select('hq_config', { in: { key: s ? ['acces', 'fermee:' + s] : ['acces'] } });
    const a = rows.find(function (r) { return r.key === 'acces'; });
    const v = { acces: (a && a.value) || {}, fermee: !!(s && rows.some(function (r) { return r.key === 'fermee:' + s; })) };
    CACHE.set(k, { t: t, v: v });
    if (CACHE.size > 300) CACHE.delete(CACHE.keys().next().value);
    return v;
  } catch (e) {
    if (c && t - c.t < SECOURS_MS) return c.v;
    return null;
  }
}
const manque = function (e) { return /could not find the function|PGRST202|function .* does not exist/i.test(String(e && e.message)); };
// Fusion atomique dans la ligne « acces » (la génération ne se perd jamais entre deux écritures)
async function majAcces(db, patch, plus) {
  let v;
  try { v = await db.rpc('hq_acces_maj', { p_patch: patch || {}, p_gen_plus: plus || 0 }); }
  catch (e) {
    if (!manque(e)) throw e;
    const r = await db.one('hq_config', { eq: { key: 'acces' } });
    const cur = (r && r.value) || {};
    v = Object.assign({}, cur, patch || {}, { gen: (cur.gen || 0) + (plus || 0) });
    await db.upsert('hq_config', { key: 'acces', value: v, updated_at: iso() }, { onConflict: 'key' });
  }
  CACHE.clear();
  return v || {};
}
async function noterVersion(db) {
  try { await db.rpc('hq_acces_init', { p_version: versionIci() }); }
  catch (e) {
    if (manque(e)) {
      const r = await db.one('hq_config', { eq: { key: 'acces' } }).catch(function () { return null; });
      const cur = (r && r.value) || {};
      if (!cur.version) await db.upsert('hq_config', { key: 'acces', value: Object.assign({ gen: 0 }, cur, { version: versionIci() }), updated_at: iso() }, { onConflict: 'key' }).catch(function () {});
    }
  }
  CACHE.clear();
}

/* ── les essais : comptés avant d'être vérifiés, en base (une instruction, verrou de ligne) ou en mémoire ── */
const MEM = new Map();
function dureeBlocage(lim, blocages) { return (lim.croissant ? Math.min(86400, lim.blocage * Math.pow(2, Math.max(0, blocages - 1))) : lim.blocage) * 1000; }
function compterIci(k, lim) {
  const t = Date.now();
  const v = Object.assign({ n: 0, debut: t, bloque_jusqu: 0, blocages: 0 }, MEM.get(k));
  if (v.bloque_jusqu > t) return { bloque: true, dernier: false, n: v.n, blocages: v.blocages, reste_ms: v.bloque_jusqu - t };
  if (t - v.debut > FENETRE_S * 1000) { v.n = 0; v.debut = t; }
  v.n += 1;
  if (v.n >= lim.max) {
    v.blocages += 1; v.bloque_jusqu = t + dureeBlocage(lim, v.blocages);
    MEM.set(k, { n: 0, debut: t, bloque_jusqu: v.bloque_jusqu, blocages: v.blocages });
    if (MEM.size > 5000) MEM.delete(MEM.keys().next().value);
    return { bloque: false, dernier: true, n: v.n, blocages: v.blocages, reste_ms: v.bloque_jusqu - t };
  }
  MEM.set(k, v);
  return { bloque: false, dernier: false, n: v.n, blocages: v.blocages, reste_ms: 0 };
}
async function reserver(db, k, lim) {
  if (db) {
    try {
      const r = await db.rpc('hq_compter', { p_cle: k, p_fenetre_s: FENETRE_S, p_max: lim.max, p_blocage_s: lim.blocage, p_croissant: lim.croissant });
      if (r && typeof r === 'object') return { bloque: !!r.bloque, dernier: !!r.dernier, n: Number(r.n) || 0, blocages: Number(r.blocages) || 0, reste_ms: Number(r.reste_ms) || 0 };
    } catch (e) {
      if (!manque(e)) return { bloque: true, panne: true, dernier: false, n: 0, blocages: 0, reste_ms: 60000 };
    }
  }
  return compterIci(k, lim);
}
async function oublier(db, k) {
  MEM.delete(k);
  if (db) await db.remove('hq_config', { eq: { key: 'essai:' + k } }).catch(function () {});
}
const pause = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
let RYTHME = null;                         // tests : pas d'attente après un essai raté
function rythme(ms) { RYTHME = ms; }
const attendreApresEchec = function () { return pause(RYTHME != null ? RYTHME : 400 + Math.floor(Math.random() * 300)); };
function minutes(ms) { const m = Math.ceil(ms / 60000); return m <= 1 ? '1 minute' : m < 60 ? m + ' minutes' : Math.ceil(m / 60) + ' h'; }
const BASE_MUETTE = 'La base de la tour ne répond pas : réessaie dans une minute.';
const REDEMARRE = 'La tour redémarre avec le nouveau mot de passe : réessaie dans une minute.';
function refusEssai(res, r) {
  if (r.panne) return repondre(res, 503, { erreur: BASE_MUETTE });
  return repondre(res, 429, { erreur: 'Trop d\'essais ratés. Réessaie dans ' + minutes(r.reste_ms) + '.', attendre_s: Math.ceil(r.reste_ms / 1000) });
}

/* ── les appareils connus ── */
const APPAREILS_MEM = [];
function hashApp(id) { return crypto.createHash('sha256').update('la-tour/app/' + id).digest('hex').slice(0, 16); }
async function lireAppareils(db) {
  if (!db) return APPAREILS_MEM.slice();
  const r = await db.one('hq_config', { eq: { key: 'acces:appareils' } }).catch(function () { return null; });
  return ((r && r.value && r.value.liste) || []).slice();
}
async function ecrireAppareils(db, liste) {
  liste = liste.slice(0, 20);
  if (!db) { APPAREILS_MEM.length = 0; liste.forEach(function (x) { APPAREILS_MEM.push(x); }); return; }
  await db.upsert('hq_config', { key: 'acces:appareils', value: { liste: liste }, updated_at: iso() }, { onConflict: 'key' });
}
// L'empreinte de l'appareil si son cookie est celui d'un appareil déjà connu (impossible à deviner : 18 octets au hasard)
async function appareilConnu(db, req) {
  const id = lireCookies(req)[COOKIE_APP];
  if (!/^[A-Za-z0-9_-]{22,}$/.test(String(id || ''))) return null;
  const h = hashApp(id);
  return (await lireAppareils(db)).some(function (a) { return a.id === h; }) ? h : null;
}
function idAppareil(req, res) {
  const ck = lireCookies(req);
  let id = ck[COOKIE_APP];
  if (!/^[A-Za-z0-9_-]{22,}$/.test(String(id || ''))) id = b64(crypto.randomBytes(18));
  ajouterCookie(res, ligneCookie(COOKIE_APP, id, APPAREIL_MS));
  return { id: id, h: hashApp(id) };
}

/* ── la session de la requête ── */
async function session(req) {
  if (!configure()) return { ok: false, raison: 'a_configurer' };
  const ck = lireCookies(req);
  const c = lireJeton(ck[COOKIE]);
  const db = base();
  let eb = null;
  if (db) {
    eb = await etatBase(db, c && c.s);
    if (!eb) return { ok: false, raison: 'base' };
    if (eb.acces.version && eb.acces.version !== versionIci()) return { ok: false, raison: 'perimee' };
  }
  if (!c) return { ok: false, raison: ck[COOKIE] ? 'expiree' : 'absente' };
  if (typeof c.d !== 'number' || Date.now() - c.d > MAX_MS) return { ok: false, raison: 'expiree' };
  if (eb && ((c.g || 0) < (eb.acces.gen || 0) || eb.fermee)) return { ok: false, raison: 'revoquee' };
  return { ok: true, charge: c, renouveler: Date.now() - c.iat > RENOUVELER_MS, acces: eb ? eb.acces : null };
}
// s : la session (gardée à chaque renouvellement, pour la fermer côté serveur) ; g : la génération (« partout » l'augmente)
function poserSession(res, charge) {
  const t = Date.now();
  const d = typeof charge.d === 'number' ? charge.d : t;   // l'heure de la connexion, gardée à chaque renouvellement
  const c = { app: charge.app, d: d, s: charge.s || b64(crypto.randomBytes(12)), g: charge.g || 0, iat: t, exp: Math.min(t + DUREE_MS, d + MAX_MS), n: b64(crypto.randomBytes(6)) };
  ajouterCookie(res, ligneCookie(COOKIE, signer(c), DUREE_MS));
  return c;
}
function repondre(res, code, obj) {
  res.statusCode = code;
  if (res.setHeader) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); }
  res.end(JSON.stringify(obj));
}
// La première session vue par une tour branchée sur la base : elle note la version du mot de passe (si aucune ne l'est)
// et, si la liste est vide, l'appareil de Louis (celui qui a ouvert la tour avant que la base existe)
let AMORCE = false;
async function amorcer(db, s, req) {
  if (AMORCE || !db) return;
  AMORCE = true;
  if (s.acces && !s.acces.version) await noterVersion(db);
  const liste = await lireAppareils(db);
  if (!liste.length && s.charge.app) { const t = iso(); await ecrireAppareils(db, [{ id: s.charge.app, nom: appareilDe(ua(req)), premiere: t, derniere: t, adresse: masquer(adresse(req)) }]); }
}
// À appeler en tête de chaque API : la session, ou une réponse déjà écrite (et false)
async function exiger(req, res) {
  const s = await session(req);
  if (!s.ok) {
    if (s.raison === 'expiree' || s.raison === 'revoquee') ajouterCookie(res, ligneCookie(COOKIE, '', 0));
    if (s.raison === 'base') { repondre(res, 503, { erreur: BASE_MUETTE }); return false; }
    repondre(res, 401, { error: s.raison === 'a_configurer' ? 'La tour n\'a pas encore de mot de passe.' : s.raison === 'perimee' ? REDEMARRE : 'Connexion requise.', connexion: true, configurer: s.raison === 'a_configurer', redemarre: s.raison === 'perimee' });
    return false;
  }
  if (s.renouveler) poserSession(res, { app: s.charge.app, d: s.charge.d, s: s.charge.s, g: s.charge.g });
  await amorcer(base(), s, req).catch(function () {});
  return s;
}
// Le cron de Vercel envoie « Authorization: Bearer CRON_SECRET ». Sans secret, rien ne passe, sauf en local déclaré.
function cronAutorise(req) {
  const s = String(process.env.CRON_SECRET || '').trim();
  if (!s) return process.env.HQ_LOCAL === '1' && !process.env.VERCEL;
  const recu = Buffer.from(String((req.headers && req.headers.authorization) || '')), attendu = Buffer.from('Bearer ' + s);
  return recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu);
}

/* ── les opérations ── */
// Ce que la page voit avant la connexion : faut-il créer le mot de passe ou se connecter, et quelle version tourne ici
async function etat(req) {
  const s = await session(req);
  const out = { configure: configure(), connecte: s.ok, min: MIN_MDP, version: versionIci() };
  if (s.raison === 'perimee') out.redemarre = true;
  if (s.raison === 'base') out.base_muette = true;
  if (s.ok) out.base = !!base();
  return out;
}

async function prevenirLouis(db, sujet, corps, emailAussi) {
  if (db) await db.insert('hq_messages', { from_id: 'systeme', to_id: 'louis', company_id: 'groupe', kind: 'alerte', subject: court(sujet, 120), body: corps }, { returning: false }).catch(function () {});
  if (!emailAussi) return;
  try {
    const mail = require('./mail');
    const a = mail.identite().adresse;
    if (mail.branchee() && a) await mail.envoyer({ to: a, subject: 'La tour : ' + sujet, text: 'Bonjour Louis,\n\n' + corps + '\n\nLa tour' });
  } catch (e) { /* l'alerte reste dans la tour */ }
}

// Un appareil jamais vu : noté, et Louis prévenu (dans la tour, et par email quand la boîte est branchée)
async function noterAppareil(db, req, app) {
  const liste = await lireAppareils(db);
  const t = iso(), ip = adresse(req), nom = appareilDe(ua(req));
  const i = liste.findIndex(function (a) { return a.id === app.h; });
  if (i >= 0) liste[i] = Object.assign({}, liste[i], { derniere: t, adresse: masquer(ip), nom: nom });
  else {
    const premier = !liste.length;            // le tout premier appareil est celui qui vient de créer le mot de passe
    liste.unshift({ id: app.h, nom: nom, premiere: t, derniere: t, adresse: masquer(ip) });
    if (!premier) await prevenirLouis(db, 'Nouvelle connexion : ' + nom, 'Connexion à la tour depuis un nouvel appareil (' + nom + ', adresse ' + masquer(ip) + ').\nSi ce n\'est pas toi : Réglages, Sécurité, change ton mot de passe tout de suite (toutes les sessions sont alors coupées).', true);
  }
  await ecrireAppareils(db, liste);
}

async function connexion(req, res, b) {
  const db = base();
  if (!configure()) return repondre(res, 409, { erreur: 'La tour n\'a pas encore de mot de passe : crée-le d\'abord.', configurer: true });
  if (db) {
    const eb = await etatBase(db, null);
    if (!eb) return repondre(res, 503, { erreur: BASE_MUETTE });
    if (eb.acces.version && eb.acces.version !== versionIci()) return repondre(res, 503, { erreur: REDEMARRE, redemarre: true });
  }
  // un appareil connu a son compteur ; un inconnu compte pour son adresse et pour le total
  const connu = await appareilConnu(db, req);
  const k = connu ? 'app:' + connu : 'ip:' + empreinteAdresse(cleAdresse(adresse(req)));
  const lim = connu ? LIMITES.appareil : LIMITES.adresse;
  const r = await reserver(db, k, lim);
  if (r.bloque) return refusEssai(res, r);
  const g = connu ? null : await reserver(db, 'tous', LIMITES.tous);
  if (g && g.bloque) return refusEssai(res, g);
  const ok = await bonMotDePasse(b && b.mdp, empreinte());
  if (!ok) {
    await attendreApresEchec();
    const ferme = r.dernier ? r : g && g.dernier ? g : null;
    if (r.dernier && r.blocages >= 2) await prevenirLouis(db, 'Essais de mot de passe ratés', 'Plusieurs séries de mauvais mots de passe sur la tour (adresse ' + masquer(adresse(req)) + '). L\'adresse est bloquée. Si ce n\'est pas toi, rien à faire : le verrou tient.', true);
    if (g && g.dernier) await prevenirLouis(db, 'Beaucoup d\'essais ratés sur la tour', '40 mauvais mots de passe en un quart d\'heure, depuis plusieurs adresses : les appareils inconnus attendent 15 minutes. Les tiens entrent toujours. Si ça se répète, choisis un mot de passe plus long.', true);
    return repondre(res, ferme ? 429 : 401, { erreur: ferme ? 'Trop d\'essais ratés. Réessaie dans ' + minutes(ferme.reste_ms) + '.' : 'Mot de passe incorrect.', restants: ferme ? 0 : Math.max(0, lim.max - r.n) });
  }
  await oublier(db, k);
  const app = idAppareil(req, res);
  const eb = db ? await etatBase(db, null, true) : null;
  poserSession(res, { app: app.h, g: eb ? eb.acces.gen || 0 : 0 });
  if (eb && !eb.acces.version) await noterVersion(db);
  await noterAppareil(db, req, app).catch(function () {});
  return repondre(res, 200, { ok: true });
}

// La session est fermée côté serveur (quand la base est là) : le même cookie, copié ailleurs, ne rouvre plus rien
async function deconnexion(req, res) {
  const s = await session(req);
  const db = base();
  if (s.ok && db && s.charge.s) {
    await db.upsert('hq_config', { key: 'fermee:' + s.charge.s, value: { jusqu: new Date(s.charge.d + MAX_MS).toISOString() }, updated_at: iso() }, { onConflict: 'key' }).catch(function () {});
    CACHE.delete(s.charge.s);
  }
  ajouterCookie(res, ligneCookie(COOKIE, '', 0));
  return repondre(res, 200, { ok: true });
}

// Première ouverture, ou mot de passe oublié : un jeton Vercel qui voit le projet prouve que c'est Louis. La tour écrit
// elle-même l'empreinte du mot de passe, une clé de session neuve, le jeton et le secret du cron dans Vercel, puis
// redémarre (2 minutes). Avec la base, la nouvelle version y est notée : l'ancienne tour se ferme aussitôt.
async function creer(req, res, b) {
  const M = require('./missions');
  const db = base();
  const pb = regle(b && b.mdp);
  if (pb) return repondre(res, 400, { erreur: 'Mot de passe : ' + pb + '.' });
  const connu = await appareilConnu(db, req);
  const k = connu ? 'creer-app:' + connu : 'creer:' + empreinteAdresse(cleAdresse(adresse(req)));
  const r = await reserver(db, k, LIMITES.creer);
  if (r.bloque) return refusEssai(res, r);
  const jeton = String((b && b.jeton) || '').trim();
  const v = await M.verifierVercel(jeton);
  if (v.erreur) return repondre(res, r.dernier ? 429 : 400, { erreur: r.dernier ? 'Trop d\'essais. Réessaie dans ' + minutes(r.reste_ms) + '.' : v.erreur.charAt(0).toUpperCase() + v.erreur.slice(1) + '.' });
  const deja = configure();
  const h = await hacher(b.mdp);
  const valeurs = { HQ_VERCEL_TOKEN: jeton, HQ_ACCES: h, HQ_SESSION: b64(crypto.randomBytes(32)) };
  if (!String(process.env.CRON_SECRET || '').trim()) valeurs.CRON_SECRET = b64(crypto.randomBytes(32));
  try { await M.ecrireVariables(jeton, v, valeurs); }
  catch (e) { return repondre(res, 502, { erreur: 'Vercel a refusé l\'enregistrement : ' + court(e.message, 120) + '. Rien n\'a changé, réessaie.' }); }
  await oublier(db, k);
  await prevenirLouis(db, deja ? 'Mot de passe de la tour changé' : 'La tour a son mot de passe', (deja ? 'Le mot de passe de la tour vient d\'être changé avec un jeton Vercel de ton compte' : 'La tour est fermée à clé : mot de passe créé avec un jeton Vercel de ton compte') + ' (appareil : ' + appareilDe(ua(req)) + ', adresse ' + masquer(adresse(req)) + '). Toutes les autres sessions sont coupées.', deja);
  let dep = null, note = null;
  try { dep = await M.redemarrer(jeton, v); }
  catch (e) { note = 'Enregistré, mais le redémarrage automatique a échoué (' + court(e.message, 80) + ') : Vercel, projet ' + ((v.projet && v.projet.nom) || 'de la tour') + ', Deployments, les trois points du dernier, Redeploy.'; }
  if (dep && db) await majAcces(db, { version: versionDe(h), changee: iso() }, 1).catch(function () {});
  return repondre(res, 200, { ok: true, redemarrage: dep ? dep.id : null, version: versionDe(h), note: note });
}

// Changer de mot de passe depuis la tour (connecté) : l'ancien est demandé, toutes les sessions tombent
async function changer(req, res, b) {
  const s = await exiger(req, res); if (!s) return;
  const M = require('./missions');
  const db = base();
  const k = 'app:' + s.charge.app;
  const r = await reserver(db, k, LIMITES.appareil);
  if (r.bloque) return refusEssai(res, r);
  if (!(await bonMotDePasse(b && b.actuel, empreinte()))) { await attendreApresEchec(); return repondre(res, r.dernier ? 429 : 400, { erreur: r.dernier ? 'Trop d\'essais ratés. Réessaie dans ' + minutes(r.reste_ms) + '.' : 'Mot de passe actuel incorrect.' }); }
  await oublier(db, k);
  const pb = regle(b && b.nouveau);
  if (pb) return repondre(res, 400, { erreur: 'Nouveau mot de passe : ' + pb + '.' });
  const jeton = String(process.env.HQ_VERCEL_TOKEN || '').trim();
  const cible = jeton ? await M.equipeDuProjet(jeton).catch(function () { return null; }) : null;
  if (!cible) return repondre(res, 409, { erreur: 'Le jeton Vercel branché ne voit plus le projet : passe par « Mot de passe oublié » avec un nouveau jeton.' });
  const h = await hacher(b.nouveau);
  try { await M.ecrireVariables(jeton, cible, { HQ_ACCES: h, HQ_SESSION: b64(crypto.randomBytes(32)) }); }
  catch (e) { return repondre(res, 502, { erreur: 'Vercel a refusé l\'enregistrement : ' + court(e.message, 120) + '.' }); }
  await prevenirLouis(db, 'Mot de passe de la tour changé', 'Changé depuis la tour (' + appareilDe(ua(req)) + '). Toutes les sessions sont coupées.', true);
  let dep = null, note = null;
  try { dep = await M.redemarrer(jeton, cible); }
  catch (e) { note = 'Enregistré, mais le redémarrage a échoué : Vercel, Deployments, Redeploy.'; }
  if (dep && db) await majAcces(db, { version: versionDe(h), changee: iso() }, 1).catch(function () {});
  return repondre(res, 200, { ok: true, redemarrage: dep ? dep.id : null, version: versionDe(h), note: note });
}

// Couper toutes les sessions ouvertes sauf celle-ci : la génération augmente, celle-ci est re-signée avec la nouvelle
async function partout(req, res) {
  const s = await exiger(req, res); if (!s) return;
  const db = base();
  if (!db) return repondre(res, 409, { erreur: 'Il faut d\'abord la base pour couper les autres sessions (sinon : change le mot de passe).' });
  const v = await majAcces(db, { deconnexion_generale: iso() }, 1);
  poserSession(res, { app: s.charge.app, d: s.charge.d, s: s.charge.s, g: v.gen || 0 });
  return repondre(res, 200, { ok: true });
}

async function appareils(s) {
  const db = base();
  const liste = await lireAppareils(db);
  const eb = db ? await etatBase(db, null, true) : null;
  return { appareils: liste.map(function (a) { return Object.assign({}, a, { ici: a.id === s.charge.app }); }), deconnexion_generale: (eb && eb.acces.deconnexion_generale) || null };
}

function vider() { CACHE.clear(); MEM.clear(); APPAREILS_MEM.length = 0; AMORCE = false; }

module.exports = {
  COOKIE, COOKIE_APP, MIN_MDP, LIMITES, configure, hacher, bonMotDePasse, regle, signer, lireJeton, lireCookies, memeOrigine, adresse, cleAdresse,
  versionDe, versionIci, session, exiger, cronAutorise, etat, connexion, deconnexion, creer, changer, partout, appareils, repondre, forcerBase, appareilDe, masquer, rythme
};
