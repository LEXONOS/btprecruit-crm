// Oscar, animateur 3D : écrit la scène de chaque script (les pièces du kit, leurs positions, un plan de caméra par
// phrase, les actions et les étiquettes). La scène est vérifiée avant d'aller à l'usine ; refusée, il la corrige
// dans le même passage. Quand Vera renvoie une vidéo, il refait la scène avec ses remarques.
'use strict';
const S = require('../studio');
const SC = require('../studio/scene');
const V = require('../studio/viral');
const { outil } = require('../studio/ecrire');
const { court } = require('../util');
const EXEMPLE = require('../../usine/exemples/clim.json');

const OUTIL = {
  name: 'ecrire_scene',
  description: 'La scène 3D complète, au format du kit.',
  input_schema: {
    type: 'object',
    properties: {
      idee: { type: 'string', description: 'En une phrase : la disposition et la façon de montrer le mécanisme' },
      scene: { type: 'object', description: '{ style, objets: [...], plans: [...] } au format du kit', properties: { style: { type: 'object' }, objets: { type: 'array', items: { type: 'object' } }, plans: { type: 'array', items: { type: 'object' } } }, required: ['objets', 'plans'] }
    },
    required: ['idee', 'scene']
  }
};

let SYSTEME = null;
function systeme() {
  if (SYSTEME) return SYSTEME;
  const ex = { objets: EXEMPLE.scene.objets, plans: EXEMPLE.scene.plans.slice(0, 5) };
  SYSTEME = `Tu es Oscar, animateur 3D du Studio. Tu transformes un script en scène 3D programmée, rendue en vidéo verticale (1080 x 1920) par notre moteur. Personne ne retouche ta scène : elle doit être juste, lisible et belle du premier coup.

${SC.notice()}

RÈGLES DE MISE EN SCÈNE
1. L'objet doit être juste : les pièces sont au bon endroit, dans le bon ordre, reliées comme dans la réalité (le tuyau part de la sortie du compresseur et arrive à l'entrée du serpentin, l'engrenage mené touche le menant : entraxe = module x (dents1 + dents2) / 2).
2. Une scène compacte, pensée pour un écran vertical : le tout tient dans 3 m de large et 3 m de haut, autour de x = 0, posé sur le sol (y = 0). Plus haut que large, c'est mieux.
3. Plan 1 = l'accroche, la première seconde et demie décide de tout : la caméra sur la pièce la plus spectaculaire (cible = son id, pas « tout »), mouvement revele, et ça bouge déjà (tourner, flux) dès la première image.
4. Chaque plan suit sa phrase : la caméra va sur la pièce dont on parle (cible = son id), une étiquette la nomme, la surbrillance la fait pulser. Alterne les mouvements (orbite, avance, recule, monte, plonge) et les angles (azimut entre -40 et 40, élévation entre -5 et 30) : deux plans de suite ne se ressemblent jamais.
4 bis. Chaque plan apporte un changement visible dans sa première demi-seconde (nouvelle cible, flux qui démarre, couleur qui change, étiquette, éclaté). Une phrase qui parle de deux pièces : puis { cible: la seconde }. La phrase « relance » a un geste fort (choc, plonge ou eclater) ; la phrase « gain » (la révélation) aussi.
5. Les carters et les coques passent en transparent (0.7 à 0.9) pour qu'on voie dedans ; un fluide chaud est chaud/brulant, froid est froid/glace, l'eau est eau, l'air est air.
6. Le dernier plan revient sur la vue du plan 1 (la vidéo boucle).
7. Étiquettes courtes (2 ou 3 mots), en anglais comme le script, 3 au plus par plan, seulement sur des objets visibles dans ce plan.
8. Entre 8 et 35 objets. Les ids sont parlants (compresseur, roue_menante, tuyau_chaud).

${V.IMAGE}

EXEMPLE RÉUSSI (la clim, extrait : les objets et les 5 premiers plans) :
${JSON.stringify(ex)}`;
  return SYSTEME;
}

function decrire(v) {
  const s = v.script || {};
  return 'LE SCRIPT (' + (s.beats || []).length + ' phrases, donc ' + (s.beats || []).length + ' plans) : « ' + (s.titre || v.titre) + ' »\nSujet : ' + (v.sujet || '') + '\n' +
    (s.beats || []).map((b, i) => 'Phrase ' + (i + 1) + (b.role ? ' [' + b.role + ']' : '') + ' : ' + b.voix + (b.ecran ? ' [écran : ' + b.ecran + ']' : '') + (b.image ? '\n   on voit : ' + b.image : '')).join('\n');
}

async function run(ctx) {
  const db = ctx.db;
  const v = await db.one('hq_videos', { eq: { status: 'script', ligne: 'meca' }, order: 'updated_at.asc' });
  if (!v) return { resume: 'Aucun script à mettre en scène.', prochain_min: 45 };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const nb = ((v.script || {}).beats || []).length;
  const critique = v.critique && v.critique.verdict === 'refaire_scene' ? v.critique : null;
  let consigne = decrire(v);
  if (critique) consigne += '\n\nVERA A REFUSÉ LA SCÈNE PRÉCÉDENTE (' + critique.note + '/10) : ' + critique.resume + '\n' + (critique.problemes || []).map((p) => '- plan ' + p.plan + ' : ' + p.constat).join('\n') + (critique.conseils ? '\nSes conseils : ' + critique.conseils : '') + '\n\nLA SCÈNE REFUSÉE :\n' + JSON.stringify(v.scene).slice(0, 9000);
  consigne += '\n\nÉcris la scène (outil ecrire_scene).';
  let cout = 0, res = null, verif = null;
  for (let essai = 0; essai < 2; essai++) {
    try {
      const r = await outil({ tier: 'smart', systeme: systeme(), contenu: consigne + (verif ? '\n\nTA SCÈNE A ÉTÉ REFUSÉE PAR LE CONTRÔLE :\n- ' + verif.erreurs.join('\n- ') + '\n\nTA SCÈNE :\n' + JSON.stringify(res.scene).slice(0, 12000) + '\n\nCorrige toutes ces erreurs et rends la scène entière.' : ''), outil: OUTIL, maxTokens: 14000 });
      cout += r.cout; res = r.entree;
    } catch (e) { cout += e.cout || 0; break; }
    verif = SC.verifier(res.scene, nb);
    if (verif.ok) break;
  }
  await S.ajouterCout(db, v.id, cout);
  if (!verif || !verif.ok) {
    const n = (v.essais || 0) + 1;
    if (n >= 3) { await S.maj(db, v.id, { status: 'refuse', essais: n, critique: Object.assign({}, v.critique || {}, { resume: 'Scène impossible à monter après 3 essais : ' + court((verif && verif.erreurs || ['pas de réponse']).join(' ; '), 300) }) }, 'script'); return { resume: 'Vidéo « ' + v.titre + ' » abandonnée : scène impossible.', cout, erreur: true }; }
    await S.maj(db, v.id, { essais: n }, 'script');
    return { resume: 'Scène de « ' + court(v.titre, 60) + ' » refusée par le contrôle (' + court((verif && verif.erreurs || ['pas de réponse']).slice(0, 3).join(' ; '), 220) + '), je réessaie.', cout, erreur: true, prochain_min: 20 };
  }
  await S.maj(db, v.id, { scene: verif.scene, status: 'scene', critique: critique ? Object.assign({}, critique, { refaite: true }) : v.critique }, 'script');
  ctx.compteurs.items++;
  await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: 'monteur' }, neq: { status: 'paused' } }).catch(() => null);
  return { resume: 'Scène montée pour « ' + court(v.titre, 70) + ' » : ' + verif.scene.objets.length + ' pièces, ' + verif.scene.plans.length + ' plans. ' + court(res.idee, 160), cout, produit: 1, prochain_min: 15 };
}

module.exports = { run, OUTIL, systeme };
