// Le Studio 3D : trois lignes de vidéos, chacune sa chaîne de fabrication, et les réglages que le DG peut changer.
//   meca      Mécanique 3D : « comment ça marche » en 3D programmée (moteur de l'usine), voix et sous-titres traduits
//   serie     Séries IA : des histoires complètes en plusieurs épisodes, images IA animées (à brancher)
//   brainrot  Brainrot 3D : des clips absurdes courts pour YouTube, vidéo IA (à brancher)
// Le parcours d'une vidéo Mécanique 3D :
//   accroche (Sacha a trouvé le sujet et les accroches) > relecture (Clara a écrit, Félix juge la viralité)
//   > [reecriture : Clara reprend avec les corrections de Félix] > verification (Hélène vérifie les faits)
//   > script (prêt à monter) > scene (Oscar) > essai (l'usine rend la langue source) > critique (Vera)
//   > traduction (Romane écrit la version française, Nina les autres) > langues (l'usine rend les autres langues)
//   > prete (à publier) > publiee
//   Félix et Vera peuvent renvoyer en arrière (deux fois au plus) ou refuser ; une usine en panne met la vidéo en echec.
'use strict';
const LANGUES = require('../../usine/langues.json');
const { court } = require('../util');

const LIGNES = {
  meca: { nom: 'Mécanique 3D', court: 'Comment ça marche', plateformes: ['TikTok', 'YouTube Shorts'], actif: true, duree: [61, 80] },
  serie: { nom: 'Séries IA', court: 'Histoires en épisodes', plateformes: ['TikTok'], actif: false, attente: 'Images IA et animation (prochaine mission)', duree: [61, 90] },
  brainrot: { nom: 'Brainrot 3D', court: 'Clips absurdes', plateformes: ['YouTube Shorts'], actif: false, attente: 'Vidéo IA (mission suivante)', duree: [12, 30] }
};
const STATUTS = {
  accroche: 'Accroches trouvées', relecture: 'Relecture virale', reecriture: 'Réécriture', verification: 'Vérification des faits',
  script: 'Script validé', scene: 'Scène 3D prête', essai: 'Rendu d\'essai', critique: 'À juger', traduction: 'À traduire',
  langues: 'Rendu des langues', prete: 'Prête à publier', publiee: 'Publiée', refuse: 'Refusée', echec: 'Échec de fabrication'
};
const EN_COURS = ['accroche', 'relecture', 'reecriture', 'verification', 'script', 'scene', 'essai', 'critique', 'traduction', 'langues'];
const ECRITURE = ['accroche', 'relecture', 'reecriture', 'verification'];
const DEFAUT = {
  meca: { videos_jour: 2, stock: 6, langues: ['en', 'fr', 'es', 'pt', 'hi'] },
  serie: { videos_jour: 1, stock: 4, langues: ['en', 'fr', 'es'] },
  brainrot: { videos_jour: 3, stock: 6, langues: ['hi', 'en'] }
};
const nowIso = () => new Date().toISOString();

async function reglages(db) {
  const r = await db.one('hq_config', { eq: { key: 'studio' } }).catch(() => null);
  const v = (r && r.value) || {};
  const out = {};
  Object.keys(DEFAUT).forEach((k) => {
    out[k] = Object.assign({}, DEFAUT[k], v[k] || {});
    out[k].langues = (out[k].langues || []).filter((l) => LANGUES[l]);
    if (!out[k].langues.length) out[k].langues = DEFAUT[k].langues.slice();
  });
  return out;
}
async function regler(db, ligne, patch) {
  if (!DEFAUT[ligne]) throw new Error('ligne inconnue : ' + ligne);
  const r = await db.one('hq_config', { eq: { key: 'studio' } }).catch(() => null);
  const v = Object.assign({}, (r && r.value) || {});
  const cur = Object.assign({}, DEFAUT[ligne], v[ligne] || {});
  if (patch.videos_jour != null) cur.videos_jour = Math.max(0, Math.min(12, parseInt(patch.videos_jour, 10) || 0));
  if (patch.stock != null) cur.stock = Math.max(1, Math.min(30, parseInt(patch.stock, 10) || 1));
  if (Array.isArray(patch.langues)) {
    const l = patch.langues.map(String).filter((x) => LANGUES[x]);
    if (!l.length) throw new Error('aucune langue reconnue (possibles : ' + Object.keys(LANGUES).join(', ') + ')');
    if (l.indexOf('en') < 0 && ligne === 'meca') l.unshift('en');
    cur.langues = Array.from(new Set(l)).slice(0, 6);
  }
  v[ligne] = cur;
  await db.upsert('hq_config', { key: 'studio', value: v, updated_at: nowIso() }, { onConflict: 'key' });
  return cur;
}

// une écriture qui n'a lieu que si la vidéo est encore dans l'état attendu (deux agents ne se marchent pas dessus)
async function maj(db, id, patch, statutAttendu) {
  const q = { eq: { id: id } };
  if (statutAttendu) q.eq.status = statutAttendu;
  const r = await db.update('hq_videos', Object.assign({}, patch, { updated_at: nowIso() }), q);
  return r && r.length ? r[0] : null;
}
async function ajouterCout(db, id, cout) {
  if (!cout) return;
  const v = await db.one('hq_videos', { eq: { id: id }, select: 'id,cout_usd' });
  if (v) await db.update('hq_videos', { cout_usd: Math.round((Number(v.cout_usd || 0) + cout) * 10000) / 10000 }, { eq: { id: id } });
}

// l'adresse de la tour, que l'usine rappelle
function adresseTour() {
  if (process.env.HQ_TOUR_URL) return String(process.env.HQ_TOUR_URL).replace(/\/$/, '');
  return 'https://' + (process.env.VERCEL_PROJECT_PRODUCTION_URL || 'novalem-crm.vercel.app');
}

// ce que l'usine rend pour une langue : la voix et la qualité
function voixDe(langue) { const l = LANGUES[langue] || LANGUES.en; return { kokoro: l.kokoro, voix: l.voix, vitesse: l.vitesse }; }

function resume(v) {
  const s = v.script || {};
  return { id: v.id, ligne: v.ligne, titre: v.titre, sujet: v.sujet, statut: v.status, langues: v.langues, rendus: Object.keys(v.rendus || {}).map((l) => l + ':' + ((v.rendus[l] || {}).etat || '?')).join(' '), note_viral: s.note_viral, note: (v.critique || {}).note, critique: court((v.critique || {}).resume || '', 200), accroche: s.accroche, cout: Number(v.cout_usd || 0) };
}

// la langue écrite par la plume française (les autres langues sont adaptées par Nina)
const PLUME = 'fr';

module.exports = { PLUME, ECRITURE, LANGUES, LIGNES, STATUTS, EN_COURS, DEFAUT, reglages, regler, maj, ajouterCout, adresseTour, voixDe, resume };
