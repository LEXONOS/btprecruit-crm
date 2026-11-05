// La fabrication d'une vidéo par l'usine : la demande (une par langue), la commande que l'usine vient chercher, ses
// envois de fichiers et son compte rendu. Chaque écriture repart de la ligne fraîche (deux langues qui finissent en
// même temps ne s'écrasent pas), et chaque demande porte un jeton : un vieux rendu relancé ne remplace jamais le neuf.
'use strict';
const crypto = require('crypto');
const S = require('./index');
const G = require('./github');
const ST = require('./stockage');
const { majFraiche } = require('../db');
const { court } = require('../util');

const nowIso = () => new Date().toISOString();
const FICHIERS = /^(video\.mp4|vignette\.jpg|sous-titres\.srt|cle-[1-8]\.jpg)$/;
const ESSAIS_MAX = 2;

// ce qui reste à rendre : la langue source pendant l'essai, les autres ensuite
function aRendre(v) {
  const r = v.rendus || {};
  const langues = v.status === 'essai' || v.status === 'scene' ? [v.langue_source] : v.status === 'langues' ? (v.langues || []).filter((l) => l !== v.langue_source) : [];
  return langues.filter((l) => !r[l] || (r[l].etat === 'echec' && (r[l].essais || 0) < ESSAIS_MAX));
}

async function demander(db, v, langue) {
  const jeton = crypto.randomBytes(12).toString('hex');
  const fraiche = await majFraiche(db, 'hq_videos', v.id, (f) => {
    const r = Object.assign({}, f.rendus || {});
    const avant = r[langue] || {};
    if (avant.etat === 'demande' || avant.etat === 'fini') return null;
    r[langue] = { etat: 'demande', demande_le: nowIso(), essais: (avant.essais || 0) + 1, jeton };
    return { rendus: r, status: f.status === 'scene' ? 'essai' : f.status };
  });
  if (!fraiche) return { ok: false, raison: 'déjà demandée' };
  try { await G.lancer(v.id, langue); return { ok: true }; }
  catch (e) {
    await majFraiche(db, 'hq_videos', v.id, (f) => { const r = Object.assign({}, f.rendus || {}); if (!r[langue] || r[langue].jeton !== jeton) return null; r[langue] = Object.assign({}, r[langue], { etat: 'echec', erreur: 'lancement refusé par GitHub : ' + court(e.message, 200) }); return { rendus: r }; });
    return { ok: false, raison: court(e.message, 200) };
  }
}

// la commande que vient chercher l'usine
async function commande(db, id, langue) {
  const v = await db.one('hq_videos', { eq: { id: id } });
  if (!v) return { code: 404, erreur: 'vidéo inconnue' };
  const r = (v.rendus || {})[langue];
  if (!r || r.etat !== 'demande') return { code: 409, erreur: 'rien à fabriquer pour cette langue' };
  if (langue !== v.langue_source && !(v.traductions || {})[langue]) return { code: 409, erreur: 'traduction absente' };
  return {
    code: 200,
    jeton: r.jeton,
    production: { id: v.id, ligne: v.ligne, titre: v.titre, langue_source: v.langue_source, script: v.script, scene: v.scene, langues: v.traductions || {} },
    voix: S.voixDe(langue),
    qualite: { echelle: 0.75, msaa: 4, bloom: true, ombre: 1024 },
    style: {}
  };
}

async function liensEnvoi(db, id, langue, jeton, fichiers) {
  const v = await db.one('hq_videos', { eq: { id: id }, select: 'id,rendus' });
  const r = v && (v.rendus || {})[langue];
  if (!r || r.jeton !== jeton || r.etat !== 'demande') return { code: 409, erreur: 'demande périmée' };
  const urls = {};
  for (const f of (Array.isArray(fichiers) ? fichiers : []).slice(0, 12)) {
    if (!f || !FICHIERS.test(String(f.nom))) return { code: 400, erreur: 'fichier refusé : ' + court(f && f.nom, 40) };
    if (Number(f.taille) > 190 * 1048576) return { code: 400, erreur: 'fichier trop lourd : ' + f.nom };
    urls[f.nom] = await ST.lienEnvoi(ST.chemin(id, langue, f.nom));
  }
  return { code: 200, urls };
}

// le compte rendu de l'usine : la langue est finie (ou ratée), et la vidéo avance d'une étape si tout est là
async function fin(db, id, langue, jeton, c) {
  let suite = null;
  const out = await majFraiche(db, 'hq_videos', id, (f) => {
    const r = Object.assign({}, f.rendus || {});
    const cur = r[langue];
    if (!cur || cur.jeton !== jeton || cur.etat !== 'demande') return null;
    r[langue] = c.ok
      ? Object.assign({}, cur, { etat: 'fini', fini_le: nowIso(), duree: Number(c.duree) || null, taille: Number(c.taille) || null, secondes: Number(c.secondes) || null, fichiers: (c.fichiers || []).filter((x) => FICHIERS.test(String(x))), avertissements: (c.avertissements || []).slice(0, 5).map((x) => court(x, 160)), erreur: null })
      : Object.assign({}, cur, { etat: 'echec', fini_le: nowIso(), erreur: court(c.erreur || 'échec sans message', 600) });
    const patch = { rendus: r };
    if (c.ok && f.status === 'essai' && langue === f.langue_source) { patch.status = 'critique'; suite = 'critique'; }
    if (c.ok && f.status === 'langues') {
      const autres = (f.langues || []).filter((l) => l !== f.langue_source);
      if (autres.every((l) => r[l] && r[l].etat === 'fini')) { patch.status = 'prete'; suite = 'prete'; }
    }
    return patch;
  });
  if (!out) return { code: 409, erreur: 'demande périmée' };
  if (suite === 'critique') await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: 'critique_video' }, neq: { status: 'paused' } }).catch(() => null);
  return { code: 200, ok: true, statut: out.status };
}

// une langue qui n'arrive jamais (machine arrêtée, GitHub en panne) : elle repasse en échec et sera relancée
async function perimer(db, v, minutes) {
  const r = v.rendus || {};
  const vieilles = Object.keys(r).filter((l) => r[l].etat === 'demande' && Date.now() - new Date(r[l].demande_le).getTime() > minutes * 60000);
  if (!vieilles.length) return [];
  await majFraiche(db, 'hq_videos', v.id, (f) => { const rr = Object.assign({}, f.rendus || {}); let x = false; vieilles.forEach((l) => { if (rr[l] && rr[l].etat === 'demande') { rr[l] = Object.assign({}, rr[l], { etat: 'echec', erreur: 'pas de nouvelles de l\'usine après ' + minutes + ' minutes' }); x = true; } }); return x ? { rendus: rr } : null; });
  return vieilles;
}

module.exports = { aRendre, demander, commande, liensEnvoi, fin, perimer, ESSAIS_MAX, FICHIERS };
