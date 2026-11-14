// Le montage des vidéos des créatrices par l'usine (GitHub Actions, montage.yml) : une demande par langue, la commande
// que l'usine vient chercher (le texte, la voix, les images, les couleurs), ses envois de fichiers par liens signés
// et son compte rendu. Chaque demande porte un jeton : un vieux montage relancé ne remplace jamais le neuf. Une
// langue sans nouvelles au bout de 70 minutes repasse en échec et est relancée (deux essais).
'use strict';
const crypto = require('crypto');
const C = require('./index');
const G = require('../studio/github');
const ST = require('../studio/stockage');
const { majFraiche } = require('../db');
const { court } = require('../util');

const iso = () => new Date().toISOString();
const FICHIERS = ['video.mp4', 'vignette.jpg', 'sous-titres.srt'];
const ESSAIS_MAX = 2;
const PERIME_MIN = 70;

// les textes d'une langue : la source, ou sa version adaptée
function texteDe(v, langue) {
  const s = langue === v.langue_source ? v.script : (v.traductions || {})[langue];
  if (!s || !Array.isArray(s.beats) || !s.beats.length) return null;
  return { accroche: s.accroche || '', beats: s.beats.map((b) => ({ voix: b.voix, ecran: b.ecran || '' })), titre: s.titre || v.titre };
}

// ce qui reste à monter : les langues jamais demandées, ou ratées avec encore un essai
function aMonter(v) {
  const r = v.rendus || {};
  return (v.langues || []).filter((l) => !r[l] || (r[l].etat === 'echec' && (r[l].essais || 0) < ESSAIS_MAX));
}

async function demander(db, v, langue) {
  const jeton = crypto.randomBytes(12).toString('hex');
  const fraiche = await majFraiche(db, 'hq_crea_videos', v.id, (f) => {
    if (f.status !== 'fabrication') return null;
    const r = Object.assign({}, f.rendus || {});
    const avant = r[langue] || {};
    if (avant.etat === 'demande' || avant.etat === 'fini') return null;
    r[langue] = { etat: 'demande', demande_le: iso(), essais: (avant.essais || 0) + 1, jeton };
    return { rendus: r };
  });
  if (!fraiche) return { ok: false, raison: 'déjà demandée' };
  // la voix Piper de la langue (l'usine la garde en cache d'une vidéo à l'autre)
  const createur = await db.one('hq_createurs', { eq: { id: v.createur_id } }).catch(() => null);
  const voix = C.voixDe(C.reglagesDe(createur || {}), langue);
  try { await G.lancerMontage(v.id, langue, voix.moteur === 'piper' ? voix.piper : ''); return { ok: true }; }
  catch (e) {
    await majFraiche(db, 'hq_crea_videos', v.id, (f) => {
      const r = Object.assign({}, f.rendus || {});
      if (!r[langue] || r[langue].jeton !== jeton) return null;
      r[langue] = Object.assign({}, r[langue], { etat: 'echec', erreur: 'l\'usine n\'a pas démarré : ' + court(e.message, 200) });
      return { rendus: r };
    });
    return { ok: false, raison: court(e.message, 200) };
  }
}

// la commande que vient chercher l'usine
async function commande(db, id, langue) {
  const v = await db.one('hq_crea_videos', { eq: { id } });
  if (!v) return { code: 404, erreur: 'vidéo inconnue' };
  const r = (v.rendus || {})[langue];
  if (!r || r.etat !== 'demande') return { code: 409, erreur: 'rien à monter pour cette langue' };
  const t = texteDe(v, langue);
  if (!t) return { code: 409, erreur: 'texte absent pour cette langue' };
  const c = await db.one('hq_createurs', { eq: { id: v.createur_id } });
  if (!c || c.statut !== 'active') return { code: 409, erreur: 'compte en pause' };
  const reg = C.reglagesDe(c);
  const plan = v.plan || {};
  return {
    code: 200,
    jeton: r.jeton,
    video: { id: v.id, titre: t.titre, createur: c.id },
    langue,
    voix: C.voixDe(reg, langue),
    texte: { accroche: t.accroche, beats: t.beats },
    plan: {
      style: plan.style || reg.style, couleur: plan.couleur || reg.couleur, musique: plan.musique || reg.musique,
      clips: (plan.clips || []).map((x) => (x && x.url ? { url: x.url, w: x.w, h: x.h, duree: x.duree } : null))
    },
    format: { duree_min: (plan.format || reg.format) === 'long' ? 61.5 : 0 }
  };
}

async function liensEnvoi(db, id, langue, jeton, fichiers) {
  const v = await db.one('hq_crea_videos', { eq: { id }, select: 'id,createur_id,rendus' });
  const r = v && (v.rendus || {})[langue];
  if (!r || r.jeton !== jeton || r.etat !== 'demande') return { code: 409, erreur: 'demande périmée' };
  const urls = {};
  for (const f of (Array.isArray(fichiers) ? fichiers : []).slice(0, 3)) {
    if (!f || FICHIERS.indexOf(String(f.nom)) < 0) return { code: 400, erreur: 'fichier refusé : ' + court(f && f.nom, 40) };
    if (Number(f.taille) > 190 * 1048576) return { code: 400, erreur: 'fichier trop lourd : ' + f.nom };
    urls[f.nom] = await ST.lienEnvoi(ST.cheminCrea(v.createur_id, id, langue, f.nom));
  }
  return { code: 200, urls };
}

// le compte rendu de l'usine ; quand toutes les langues sont là, la vidéo est prête
async function fin(db, id, langue, jeton, c) {
  let prete = false;
  const out = await majFraiche(db, 'hq_crea_videos', id, (f) => {
    const r = Object.assign({}, f.rendus || {});
    const cur = r[langue];
    if (!cur || cur.jeton !== jeton || cur.etat !== 'demande') return null;
    r[langue] = c.ok
      ? Object.assign({}, cur, { etat: 'fini', fini_le: iso(), duree: Number(c.duree) || null, taille: Number(c.taille) || null, secondes: Number(c.secondes) || null, fichiers: (c.fichiers || []).filter((x) => FICHIERS.indexOf(String(x)) >= 0), avertissements: (c.avertissements || []).slice(0, 5).map((x) => court(x, 160)), erreur: null })
      : Object.assign({}, cur, { etat: 'echec', fini_le: iso(), erreur: court(c.erreur || 'échec sans message', 600) });
    const patch = { rendus: r };
    if (f.status === 'fabrication' && (f.langues || []).every((l) => r[l] && r[l].etat === 'fini')) { patch.status = 'prete'; patch.etape = { quoi: null, depuis: iso() }; prete = true; }
    return patch;
  });
  if (!out) return { code: 409, erreur: 'demande périmée' };
  return { code: 200, ok: true, statut: out.status, prete };
}

// une langue qui n'arrive jamais (machine arrêtée, GitHub en panne) repasse en échec ; elle sera relancée
async function perimer(db, v) {
  const r = v.rendus || {};
  const vieilles = Object.keys(r).filter((l) => r[l] && r[l].etat === 'demande' && Date.now() - new Date(r[l].demande_le).getTime() > PERIME_MIN * 60000);
  if (!vieilles.length) return [];
  await majFraiche(db, 'hq_crea_videos', v.id, (f) => {
    const rr = Object.assign({}, f.rendus || {});
    let x = false;
    vieilles.forEach((l) => { if (rr[l] && rr[l].etat === 'demande') { rr[l] = Object.assign({}, rr[l], { etat: 'echec', erreur: 'pas de nouvelles de l\'usine après ' + PERIME_MIN + ' minutes' }); x = true; } });
    return x ? { rendus: rr } : null;
  });
  return vieilles;
}

// les liens de lecture (et de téléchargement) des fichiers prêts d'une vidéo, valables 6 heures
async function liens(v, telechargement) {
  const out = {};
  const r = v.rendus || {};
  const chemins = [];
  Object.keys(r).forEach((l) => { if (r[l] && r[l].etat === 'fini') (r[l].fichiers || FICHIERS).forEach((n) => chemins.push([l, n, ST.cheminCrea(v.createur_id, v.id, l, n)])); });
  if (!chemins.length) return out;
  const signes = await ST.liensLecture(chemins.map((x) => x[2]), 6 * 3600).catch(() => ({}));
  chemins.forEach((x) => { out[x[0]] = out[x[0]] || {}; if (signes[x[2]]) out[x[0]][x[1]] = signes[x[2]]; });
  if (telechargement) {
    for (const l of Object.keys(out)) {
      if (!out[l]['video.mp4']) continue;
      const nom = String((v.titre || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'video') + '-' + l + '.mp4';
      out[l].telecharger = await ST.lienTelechargement(ST.cheminCrea(v.createur_id, v.id, l, 'video.mp4'), nom, 6 * 3600).catch(() => null);
    }
  }
  return out;
}

async function effacerFichiers(v) {
  const chemins = [];
  (v.langues || []).forEach((l) => FICHIERS.forEach((n) => chemins.push(ST.cheminCrea(v.createur_id, v.id, l, n))));
  if (chemins.length) await ST.supprimer(chemins);
}

module.exports = { FICHIERS, ESSAIS_MAX, PERIME_MIN, texteDe, aMonter, demander, commande, liensEnvoi, fin, perimer, liens, effacerFichiers };
