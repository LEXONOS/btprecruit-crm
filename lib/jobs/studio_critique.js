// Vera, critique vidéo du Studio : regarde le rendu d'essai (la vignette et huit images clés, dont la fin de l'accroche,
// avec le script et ce que chaque plan devait montrer) et tranche : on la publie, Oscar refait la scène (deux fois au
// plus), ou on la refuse. Elle juge comme quelqu'un qui scrolle : est-ce qu'on s'arrête, est-ce qu'on reste, est-ce
// qu'on comprend, est-ce que c'est beau et juste ?
'use strict';
const S = require('../studio');
const ST = require('../studio/stockage');
const { outil } = require('../studio/ecrire');
const { court, nettoie } = require('../util');

const SEUIL = 7;
const OUTIL = {
  name: 'juger_video',
  description: 'Ton verdict sur la vidéo.',
  input_schema: {
    type: 'object',
    properties: {
      note: { type: 'number', description: 'Sur 10' },
      verdict: { type: 'string', enum: ['publier', 'refaire_scene', 'refuser'] },
      resume: { type: 'string', description: 'Ton avis en 2 phrases' },
      problemes: { type: 'array', items: { type: 'object', properties: { plan: { type: 'integer' }, constat: { type: 'string' } }, required: ['plan', 'constat'] } },
      conseils: { type: 'string', description: 'Pour Oscar : ce qu\'il doit changer dans la scène (caméra, pièces, couleurs, étiquettes)' },
      faux: { type: 'array', items: { type: 'string' }, description: 'Les erreurs techniques ou factuelles du script, s\'il y en a' }
    },
    required: ['note', 'verdict', 'resume']
  }
};
const SYSTEME = 'Tu es Vera, critique vidéo du Studio 3D. On te montre une vidéo verticale « comment ça marche » en 3D (anglais), sous forme d\'images fixes : la vignette (la première seconde), puis des images clés (la première juste après l\'accroche, les autres au milieu de plans répartis sur toute la vidéo), avec le script et ce que chaque plan devait montrer. Les sous-titres, l\'accroche et les étiquettes sont posés par le moteur : juge leur lisibilité, pas leur présence.\n\nTES QUESTIONS, DANS L\'ORDRE\n1. L\'arrêt : la vignette est-elle assez forte pour qu\'on arrête de scroller (pièce spectaculaire en gros plan, texte lisible, pas un plan large vide) ?\n2. La rétention : d\'une image clé à l\'autre, l\'image change-t-elle vraiment (angle, pièce, couleur, étiquette) ? Deux images presque identiques de suite = un temps mort où les gens partent.\n3. La compréhension : voit-on la pièce dont parle la phrase ?\n4. La justesse et la beauté.\n\nREFAIRE LA SCÈNE (refaire_scene) : une image vide, illisible ou voilée (blanc laiteux, objet coupé, caméra trop près ou trop loin), la pièce dont on parle introuvable, des pièces qui flottent sans lien, un mécanisme montré faux (tuyaux qui ne relient rien, roues qui ne se touchent pas), une étiquette sur la mauvaise pièce.\nREFUSER : une erreur technique dans le script (fait faux, chiffre faux), un sujet dangereux, une vidéo sans intérêt même bien faite.\nPUBLIER : note ' + SEUIL + ' ou plus, rien de bloquant.\n\nSois exigeante et précise : dis quel plan et quoi changer. Français simple, sans tiret long.';

function decrire(v) {
  const s = v.script || {}, plans = (v.scene && v.scene.plans) || [];
  return 'LA VIDÉO : « ' + (s.titre || v.titre) + ' » (sujet : ' + (v.sujet || '') + ')\nAccroche à l\'écran : ' + (s.accroche || '') + '\n' +
    (s.beats || []).map((b, i) => 'Plan ' + (i + 1) + (b.role ? ' [' + b.role + ']' : '') + ' : « ' + b.voix + ' »' + (b.ecran ? ' [écran : ' + b.ecran + ']' : '') + '\n   caméra sur ' + JSON.stringify((plans[i] && plans[i].camera && plans[i].camera.cible) || 'tout') + ((plans[i] && plans[i].etiquettes || []).length ? ', étiquettes : ' + plans[i].etiquettes.map((e) => e.texte + ' > ' + e.objet).join(', ') : '')).join('\n') +
    (s.a_verifier && s.a_verifier.length ? '\nPoints que la scénariste n\'a pas pu vérifier : ' + s.a_verifier.join(' ; ') : '');
}

async function run(ctx) {
  const db = ctx.db;
  const v = await db.one('hq_videos', { eq: { status: 'critique' }, order: 'updated_at.asc' });
  if (!v) return { resume: 'Aucune vidéo à juger.', prochain_min: 60 };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const l = v.langue_source, rendu = (v.rendus || {})[l] || {};
  const noms = ['vignette.jpg'].concat((rendu.fichiers || []).filter((f) => /^cle-\d\.jpg$/.test(f)).sort());
  const images = [];
  for (const n of noms.slice(0, 9)) {
    try { images.push({ nom: n, b64: (await ST.lire(ST.chemin(v.id, l, n))).toString('base64') }); } catch (e) { /* image manquante : on juge avec le reste */ }
  }
  if (images.length < 3) {
    await S.maj(db, v.id, { status: 'scene', rendus: Object.assign({}, v.rendus, { [l]: Object.assign({}, rendu, { etat: 'echec', erreur: 'images clés introuvables dans le stockage' }) }) }, 'critique');
    return { resume: 'Images introuvables pour « ' + court(v.titre, 50) + ' » : je renvoie à la fabrication.', erreur: true, prochain_min: 30 };
  }
  const contenu = [{ type: 'text', text: decrire(v) + '\n\nLes images, dans l\'ordre (la vignette, puis les images clés) :' }];
  images.forEach((im) => { contenu.push({ type: 'text', text: im.nom === 'vignette.jpg' ? 'Vignette (première seconde) :' : 'Image clé ' + im.nom.replace(/\D/g, '') + ' :' }); contenu.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: im.b64 } }); });
  contenu.push({ type: 'text', text: 'Rends ton verdict (outil juger_video).' });
  let r;
  try { r = await outil({ tier: 'smart', systeme: SYSTEME, contenu, outil: OUTIL, maxTokens: 1500 }); }
  catch (e) { return { resume: 'Jugement impossible : ' + court(e.message, 160), cout: e.cout || 0, erreur: true, prochain_min: 45 }; }
  const x = r.entree;
  const note = Math.max(0, Math.min(10, Math.round(Number(x.note) * 2) / 2 || 0));
  let verdict = ['publier', 'refaire_scene', 'refuser'].indexOf(x.verdict) >= 0 ? x.verdict : 'refaire_scene';
  if (verdict === 'publier' && note < SEUIL) verdict = 'refaire_scene';
  const critique = { note, verdict, resume: nettoie(court(x.resume, 400)), problemes: (Array.isArray(x.problemes) ? x.problemes : []).slice(0, 8).map((p) => ({ plan: Number(p.plan) || 0, constat: nettoie(court(p.constat, 240)) })), conseils: nettoie(court(x.conseils || '', 600)), faux: (Array.isArray(x.faux) ? x.faux : []).slice(0, 5).map((t) => court(t, 200)), le: new Date().toISOString(), essai: (v.essais || 0) + 1 };
  await S.ajouterCout(db, v.id, r.cout);
  const autres = (v.langues || []).filter((x2) => x2 !== l);
  let suite;
  if (verdict === 'publier') suite = { status: autres.length ? 'traduction' : 'prete' };
  else if (verdict === 'refaire_scene' && (v.essais || 0) < 2) {
    // la scène repart chez Oscar ; le rendu d'essai sera refait
    const rr = Object.assign({}, v.rendus); delete rr[l];
    suite = { status: 'script', essais: (v.essais || 0) + 1, rendus: rr };
  } else suite = { status: 'refuse' };
  await S.maj(db, v.id, Object.assign({ critique }, suite), 'critique');
  // ce qui revient souvent devient une leçon pour la scénariste ou l'animateur
  if (verdict === 'refuser' && critique.faux.length) await db.insert('hq_knowledge', { agent_id: 'scenariste', kind: 'lecon', content: 'Refusé par Vera (' + court(v.titre, 60) + ') : ' + critique.faux.join(' ; '), weight: 7, source: 'critique_video' }, { returning: false }).catch(() => null);
  if (verdict === 'refaire_scene' && critique.conseils) await db.insert('hq_knowledge', { agent_id: 'animateur', kind: 'lecon', content: 'Vera sur « ' + court(v.titre, 50) + ' » : ' + court(critique.conseils, 300), weight: 5, source: 'critique_video' }, { returning: false }).catch(() => null);
  const prochain = suite.status === 'traduction' ? 'localisation' : suite.status === 'script' ? 'animateur' : null;
  if (prochain) await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: prochain }, neq: { status: 'paused' } }).catch(() => null);
  ctx.compteurs.items++;
  return { resume: '« ' + court(v.titre, 60) + ' » : ' + note + '/10, ' + (verdict === 'publier' ? 'validée' : verdict === 'refuser' || suite.status === 'refuse' ? 'refusée' : 'scène à refaire') + '. ' + court(critique.resume, 200), cout: r.cout, produit: 1, prochain_min: 15 };
}

module.exports = { run, OUTIL, SEUIL };
