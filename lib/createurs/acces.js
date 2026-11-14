// La porte du studio des créatrices : chacune entre avec son identifiant et son mot de passe (choisi en ouvrant le
// lien d'invitation que Louis lui envoie, valable 7 jours ; le même lien sert à le changer si elle l'oublie). Le mot de
// passe n'est gardé que sous forme d'empreinte scrypt. Session : un cookie signé à part (__Host-studio, HttpOnly,
// Secure, SameSite=Lax), 30 jours renouvelés à l'usage, 90 jours au plus, fermé côté serveur par la génération du
// compte (« déconnecter tous mes appareils », un nouveau mot de passe, ou Louis qui suspend le compte). Chaque essai est
// compté avant d'être vérifié, avec les compteurs de la porte de la tour : par adresse et par identifiant.
// La session d'une créatrice n'ouvre que /api/studio, et seulement son compte : jamais la tour de Louis.
'use strict';
const crypto = require('crypto');
const A = require('../acces');
const SEC = require('./secret');
const C = require('./index');

const COOKIE = '__Host-studio';
const DUREE_MS = 30 * 86400000;
const MAX_MS = 90 * 86400000;
const RENOUVELER_MS = 86400000;
const INVITATION_JOURS = 7;
const MIN_MDP = 10;
const LIM_COMPTE = { max: 8, blocage: 15 * 60, croissant: true };
const COMMUNS = /^(motdepasse|password|azerty|qwerty|soleil|bonjour|bienvenue|jetaime|iloveyou|chocolat|tiktok|youtube|instagram|studio|123456|000000|abcdef)/i;

const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const deb64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const iso = () => new Date().toISOString();

function identifiantPropre(x) { const s = String(x || '').trim().toLowerCase(); return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(s) ? s : null; }
function empreinteInvitation(code) { return sha('la-tour/studio/invitation/' + String(code || '')); }
function nouveauCode() { return b64(crypto.randomBytes(24)); }

function regle(mdp) {
  const m = String(mdp == null ? '' : mdp).normalize('NFKC');
  if (m.length < MIN_MDP) return 'au moins ' + MIN_MDP + ' caractères';
  if (m.length > 128) return '128 caractères au plus';
  if (new Set(m.toLowerCase()).size < 5) return 'trop peu de caractères différents';
  if (COMMUNS.test(m.replace(/[^a-z0-9]/gi, '')) && m.length < 16) return 'trop facile à deviner : ajoute quelques mots à toi';
  return null;
}

/* ── le jeton de session ── */
function signer(charge) {
  const k = SEC.cle('session');
  if (!k) throw new Error('la porte du studio n\'est pas prête (secret absent)');
  const corps = 's1.' + b64(JSON.stringify(charge));
  return corps + '.' + b64(crypto.createHmac('sha256', k).update(corps).digest());
}
function lireJeton(j) {
  const k = SEC.cle('session');
  const p = String(j || '').split('.');
  if (!k || p.length !== 3 || p[0] !== 's1' || p[2].length < 20) return null;
  const attendu = crypto.createHmac('sha256', k).update(p[0] + '.' + p[1]).digest();
  const recu = deb64(p[2]);
  if (recu.length !== attendu.length || !crypto.timingSafeEqual(recu, attendu)) return null;
  let c; try { c = JSON.parse(deb64(p[1]).toString('utf8')); } catch (e) { return null; }
  const t = Date.now();
  if (!c || typeof c.c !== 'number' || typeof c.exp !== 'number' || c.exp <= t || c.iat > t + 60000) return null;
  return c;
}
function poser(res, createur, debut) {
  const t = Date.now();
  const d = typeof debut === 'number' ? debut : t;
  const c = { c: Number(createur.id), g: createur.gen || 0, d, iat: t, exp: Math.min(t + DUREE_MS, d + MAX_MS) };
  A.ajouterCookie(res, A.ligneCookie(COOKIE, signer(c), DUREE_MS));
  return c;
}
function effacer(res) { A.ajouterCookie(res, A.ligneCookie(COOKIE, '', 0)); }

// la session de la requête : { ok, createur, charge } ; la ligne est relue à chaque fois (suspension, génération)
async function session(req, db) {
  const c = lireJeton(A.lireCookies(req)[COOKIE]);
  if (!c) return { ok: false, raison: 'absente' };
  const u = await db.one('hq_createurs', { eq: { id: c.c } });
  if (!u) return { ok: false, raison: 'fermee' };
  if (u.statut !== 'active') return { ok: false, raison: u.statut === 'suspendue' ? 'suspendue' : 'fermee' };
  if ((u.gen || 0) !== c.g) return { ok: false, raison: 'fermee' };
  return { ok: true, createur: u, charge: c, renouveler: Date.now() - c.iat > RENOUVELER_MS };
}
async function exiger(req, res, db) {
  const s = await session(req, db);
  if (!s.ok) {
    if (s.raison !== 'absente') effacer(res);
    A.repondre(res, 401, { erreur: s.raison === 'suspendue' ? 'Ton compte est en pause : demande à Louis.' : 'Connecte-toi.', connexion: true });
    return null;
  }
  if (s.renouveler) poser(res, s.createur, s.charge.d);
  return s;
}

/* ── les essais ── */
function cleIp(req) { return 'studio:ip:' + A.empreinteAdresse(A.cleAdresse(A.adresse(req))); }
function refus(res, r) {
  if (r.panne) return A.repondre(res, 503, { erreur: 'La base ne répond pas : réessaie dans une minute.' });
  return A.repondre(res, 429, { erreur: 'Trop d\'essais ratés. Réessaie dans ' + A.minutes(r.reste_ms) + '.', attendre_s: Math.ceil(r.reste_ms / 1000) });
}
let LEURRE = null;   // une empreinte pour faire le même calcul quand l'identifiant n'existe pas
async function leurre() { if (!LEURRE) LEURRE = await A.hacher(crypto.randomBytes(12).toString('hex')); return LEURRE; }

/* ── les opérations ── */
async function connexion(req, res, db, b) {
  const id = identifiantPropre(b && b.identifiant);
  const mdp = String((b && b.mdp) || '');
  const kIp = cleIp(req);
  const r1 = await A.reserver(db, kIp, A.LIMITES.adresse);
  if (r1.bloque) return refus(res, r1);
  const kId = 'studio:id:' + sha(id || 'inconnu').slice(0, 16);
  const r2 = await A.reserver(db, kId, LIM_COMPTE);
  if (r2.bloque) return refus(res, r2);
  const u = id ? await db.one('hq_createurs', { eq: { identifiant: id } }) : null;
  const ok = await A.bonMotDePasse(mdp, (u && u.mdp) || await leurre());
  if (!u || !u.mdp || !ok) {
    await A.attendreApresEchec();
    const ferme = r1.dernier ? r1 : r2.dernier ? r2 : null;
    return A.repondre(res, ferme ? 429 : 401, { erreur: ferme ? 'Trop d\'essais ratés. Réessaie dans ' + A.minutes(ferme.reste_ms) + '.' : 'Identifiant ou mot de passe incorrect.' });
  }
  if (u.statut === 'suspendue') return A.repondre(res, 403, { erreur: 'Ton compte est en pause : demande à Louis.' });
  if (u.statut !== 'active') return A.repondre(res, 403, { erreur: 'Ouvre d\'abord le lien d\'invitation que Louis t\'a envoyé.' });
  await A.oublier(db, kIp); await A.oublier(db, kId);
  poser(res, u);
  await db.update('hq_createurs', { derniere_connexion: iso(), journal: C.ligneJournal(u, 'Connexion', A.appareilDe(req.headers && req.headers['user-agent']) + ', ' + A.masquer(A.adresse(req))), updated_at: iso() }, { eq: { id: u.id } }).catch(() => null);
  return A.repondre(res, 200, { ok: true });
}

// ce que la page d'invitation affiche avant que le mot de passe soit choisi (le prénom, l'identifiant)
async function lireInvitation(req, res, db, code) {
  const r = await A.reserver(db, cleIp(req), A.LIMITES.adresse);
  if (r.bloque) return refus(res, r);
  const u = /^[A-Za-z0-9_-]{20,64}$/.test(String(code || '')) ? await db.one('hq_createurs', { eq: { invitation: empreinteInvitation(code) } }) : null;
  if (!u || !u.invitation_expire || new Date(u.invitation_expire).getTime() < Date.now() || u.statut === 'suspendue') {
    await A.attendreApresEchec();
    return A.repondre(res, 404, { erreur: 'Ce lien n\'est plus valable : demande un nouveau lien à Louis.' });
  }
  return A.repondre(res, 200, { prenom: u.prenom, identifiant: u.identifiant, nouveau: u.statut === 'invitee' });
}

async function accepterInvitation(req, res, db, b) {
  const code = String((b && b.code) || '');
  const kIp = cleIp(req);
  const r = await A.reserver(db, kIp, A.LIMITES.adresse);
  if (r.bloque) return refus(res, r);
  const u = /^[A-Za-z0-9_-]{20,64}$/.test(code) ? await db.one('hq_createurs', { eq: { invitation: empreinteInvitation(code) } }) : null;
  if (!u || !u.invitation_expire || new Date(u.invitation_expire).getTime() < Date.now() || u.statut === 'suspendue') {
    await A.attendreApresEchec();
    return A.repondre(res, 404, { erreur: 'Ce lien n\'est plus valable : demande un nouveau lien à Louis.' });
  }
  const pb = regle(b && b.mdp);
  if (pb) return A.repondre(res, 400, { erreur: 'Mot de passe : ' + pb + '.' });
  const h = await A.hacher(String(b.mdp).normalize('NFKC'));
  const gen = (u.gen || 0) + 1;
  const out = await db.update('hq_createurs', { mdp: h, statut: 'active', gen, invitation: null, invitation_expire: null, derniere_connexion: iso(), journal: C.ligneJournal(u, u.statut === 'invitee' ? 'Compte ouvert' : 'Nouveau mot de passe'), updated_at: iso() }, { eq: { id: u.id, invitation: u.invitation } });
  if (!out || !out.length) return A.repondre(res, 409, { erreur: 'Ce lien vient d\'être utilisé : connecte-toi.' });
  await A.oublier(db, kIp);
  poser(res, Object.assign({}, u, { gen }));
  return A.repondre(res, 200, { ok: true });
}

async function changerMotDePasse(req, res, db, s, b) {
  const u = s.createur;
  const kId = 'studio:id:' + sha(u.identifiant).slice(0, 16);
  const r = await A.reserver(db, kId, LIM_COMPTE);
  if (r.bloque) return refus(res, r);
  if (!(await A.bonMotDePasse(String((b && b.ancien) || ''), u.mdp))) { await A.attendreApresEchec(); return A.repondre(res, 401, { erreur: 'Mot de passe actuel incorrect.' }); }
  const pb = regle(b && b.nouveau);
  if (pb) return A.repondre(res, 400, { erreur: 'Nouveau mot de passe : ' + pb + '.' });
  const gen = (u.gen || 0) + 1;
  await db.update('hq_createurs', { mdp: await A.hacher(String(b.nouveau).normalize('NFKC')), gen, journal: C.ligneJournal(u, 'Mot de passe changé'), updated_at: iso() }, { eq: { id: u.id } });
  await A.oublier(db, kId);
  poser(res, Object.assign({}, u, { gen }));
  return A.repondre(res, 200, { ok: true, message: 'Mot de passe changé. Tes autres appareils sont déconnectés.' });
}

async function deconnexion(req, res, db, partout) {
  const s = await session(req, db).catch(() => ({ ok: false }));
  if (s.ok && partout) await db.update('hq_createurs', { gen: (s.createur.gen || 0) + 1, journal: C.ligneJournal(s.createur, 'Tous les appareils déconnectés'), updated_at: iso() }, { eq: { id: s.createur.id } });
  effacer(res);
  return A.repondre(res, 200, { ok: true });
}

// Louis crée un compte, ou refait un lien (mot de passe oublié) : le code n'est rendu qu'une fois, jamais gardé
async function inviter(db, createur) {
  const code = nouveauCode();
  await db.update('hq_createurs', { invitation: empreinteInvitation(code), invitation_expire: new Date(Date.now() + INVITATION_JOURS * 86400000).toISOString(), updated_at: iso() }, { eq: { id: createur.id } });
  return { code, expire: new Date(Date.now() + INVITATION_JOURS * 86400000).toISOString() };
}

module.exports = { COOKIE, MIN_MDP, INVITATION_JOURS, identifiantPropre, regle, session, exiger, connexion, lireInvitation, accepterInvitation, changerMotDePasse, deconnexion, inviter, empreinteInvitation, signer, lireJeton };
