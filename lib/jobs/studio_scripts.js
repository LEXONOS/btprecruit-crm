// Clara, scénariste du Studio 3D (ligne Mécanique) : transforme la meilleure idée en script de vidéo prêt à monter.
// Elle écrit seulement quand le stock en cours est sous le niveau voulu et que le quota du jour n'est pas atteint.
// Elle lit la ligne éditoriale de Sarah (sa stratégie), ses propres leçons et les dernières critiques de Vera.
'use strict';
const S = require('../studio');
const { outil } = require('../studio/ecrire');
const { court, nettoie, minuitGP, jusquaDemainGP, sansAccents } = require('../util');

const OUTIL = {
  name: 'ecrire_script',
  description: 'Le script complet de la vidéo, en anglais parlé simple.',
  input_schema: {
    type: 'object',
    properties: {
      sujet: { type: 'string', description: 'Le mécanisme expliqué, en quelques mots (ex. « climatiseur à compression »)' },
      cle: { type: 'string', description: 'Identifiant court et stable du sujet, en minuscules (ex. « clim-compression ») : sert à ne jamais refaire le même' },
      titre: { type: 'string', description: 'Titre YouTube en anglais, 70 signes max, qui donne envie sans mentir' },
      accroche: { type: 'string', description: 'Texte en gros à l\'écran pendant la première phrase : 7 mots max, un mot entre *étoiles* mis en couleur' },
      beats: { type: 'array', minItems: 9, maxItems: 13, items: { type: 'object', properties: { voix: { type: 'string', description: 'Une à deux phrases dites à voix haute' }, ecran: { type: 'string', description: 'Optionnel : un chiffre ou un mot clé en gros (ex. « 80°C », « x10 »), 12 signes max' }, image: { type: 'string', description: 'Ce qu\'on voit à l\'écran pendant cette phrase, avec les pièces du kit' } }, required: ['voix', 'image'] } },
      description: { type: 'string', description: 'Description YouTube et TikTok, 2 phrases' },
      hashtags: { type: 'array', items: { type: 'string' }, description: '5 hashtags anglais' },
      sources: { type: 'array', items: { type: 'string' }, description: 'Ce qui permet de vérifier les faits (références techniques connues)' },
      a_verifier: { type: 'array', items: { type: 'string' }, description: 'Les affirmations dont tu n\'es pas sûre (vide si tout est sûr)' }
    },
    required: ['sujet', 'cle', 'titre', 'accroche', 'beats', 'description', 'hashtags']
  }
};

const PIECES = 'engrenages qui s\'engrènent, tuyaux de verre où circule un fluide lumineux, serpentins à ailettes, pistons et bielles, compresseurs, vannes, pompes centrifuges, ventilateurs, ressorts, vis d\'Archimède, turbines, moteurs électriques, roues, roues de coupe de tunnelier, jets d\'eau, volumes d\'eau, particules (air, chaleur, gouttes), flèches, et des formes simples (boîtes, cylindres, sphères, cônes, tores) pour les carters et les décors';

function systeme(ligneEditoriale, lecons, critiques) {
  return `Tu es Clara, scénariste d'une chaîne de vidéos verticales « comment ça marche » en 3D, publiées sur TikTok et YouTube Shorts, d'abord en anglais puis traduites. Public : curieux de 13 à 45 ans, plutôt des hommes, qui scrollent vite.

TA MISSION : un script de 61 à 75 secondes (170 à 200 mots en tout), qui explique UN mécanisme réel de façon juste, et que l'on peut montrer entièrement avec notre kit 3D.

CE QUI FAIT UNE VIDÉO QUI MARCHE
- Phrase 1 = l'accroche : une contradiction ou une question qui oblige à rester (« Your AC doesn't make cold. »). Pas de « Have you ever wondered », pas de « In this video ».
- Une seule mécanique, expliquée dans l'ordre où elle se passe. Chaque phrase fait avancer d'un cran.
- Du concret : chiffres vrais (températures, vitesses, pressions, tours par minute), verbes d'action, « this », « watch ».
- Phrases courtes, anglais parlé simple (niveau B1), pas de jargon sans l'expliquer en 4 mots.
- La dernière phrase referme la boucle sur l'accroche (le spectateur a envie de revoir).
- 9 à 13 phrases (beats), chacune 10 à 25 mots.

CE QU'ON PEUT MONTRER (le kit 3D, programmé, sans personnage) : ${PIECES}. Pas de visage, pas d'animal, pas de carte, pas de logo, pas de marque. Choisis un sujet qui se montre avec ça.

VÉRITÉ : aucun chiffre inventé. Si tu n'es pas sûre d'un point, ne l'écris pas, ou mets-le dans a_verifier. Jamais de sujet dangereux (armes, explosifs, drogue, piratage).
STYLE : pas de tiret long, pas d'emoji.

LIGNE ÉDITORIALE DE SARAH (la directrice) :
${ligneEditoriale || 'Séries : mécanismes du quotidien, moteurs et transmissions, engins de chantier, aviation et marine, inventions qui ont changé le monde.'}
${lecons ? '\nTES LEÇONS :\n' + lecons : ''}${critiques ? '\nCE QUE VERA A REPROCHÉ AUX DERNIÈRES VIDÉOS (à éviter) :\n' + critiques : ''}`;
}

function verifierScript(x) {
  const err = [];
  const beats = Array.isArray(x.beats) ? x.beats : [];
  if (beats.length < 9 || beats.length > 13) err.push('9 à 13 phrases (ici ' + beats.length + ')');
  const mots = beats.reduce((s, b) => s + String(b.voix || '').split(/\s+/).filter(Boolean).length, 0);
  if (mots < 165) err.push('trop court : ' + mots + ' mots, il en faut 170 à 200 (la vidéo doit dépasser une minute)');
  if (mots > 230) err.push('trop long : ' + mots + ' mots, 200 au plus');
  beats.forEach((b, i) => { const n = String(b.voix || '').split(/\s+/).filter(Boolean).length; if (n < 4 || n > 34) err.push('phrase ' + (i + 1) + ' : ' + n + ' mots (4 à 34)'); if (b.ecran && String(b.ecran).length > 14) err.push('phrase ' + (i + 1) + ' : texte écran trop long'); });
  if (!x.accroche || String(x.accroche).split(/\s+/).length > 9) err.push('accroche absente ou trop longue (7 mots)');
  return { err, mots };
}

async function run(ctx) {
  const db = ctx.db;
  const reg = (await S.reglages(db)).meca;
  if (!reg.videos_jour) return { resume: 'Ligne Mécanique en pause (0 vidéo par jour).', prochain_min: 240 };
  const enCours = await db.count('hq_videos', { eq: { ligne: 'meca' }, in: { status: S.EN_COURS } });
  if (enCours >= reg.stock) return { resume: 'Stock plein : ' + enCours + ' vidéos en fabrication, j\'attends qu\'il descende.', prochain_min: 90 };
  const aujourdhui = await db.count('hq_videos', { eq: { ligne: 'meca' }, gte: { created_at: minuitGP().toISOString() } });
  if (aujourdhui >= reg.videos_jour) return { resume: 'Quota du jour atteint (' + aujourdhui + ' scripts).', prochain_min: jusquaDemainGP(30) };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };

  // l'idée : la mieux notée de Malik (ou de Sarah), sinon Clara choisit seule
  const idees = (await db.select('hq_items', { eq: { company_id: 'studio3d', kind: 'idee', status: 'nouveau' }, order: ['score.desc', 'id.asc'], limit: 12 })).filter((i) => !(i.data && i.data.ligne) || i.data.ligne === 'meca');
  const idee = idees[0] || null;
  const faits = await db.select('hq_videos', { select: 'sujet,titre,dedupe', eq: { ligne: 'meca' }, order: 'id.desc', limit: 150 });
  const sarah = await db.one('hq_agents', { eq: { id: 'dired_studio' }, select: 'playbook' });
  const lecons = (await db.select('hq_knowledge', { eq: { agent_id: ctx.agent.id }, order: ['weight.desc', 'id.desc'], limit: 8 }).catch(() => [])).map((k) => '- ' + court(k.content, 220)).join('\n');
  const critiques = (await db.select('hq_videos', { select: 'titre,critique', eq: { ligne: 'meca' }, in: { status: ['refuse', 'scene', 'script', 'traduction', 'langues', 'prete', 'publiee'] }, order: 'updated_at.desc', limit: 8 }))
    .filter((v) => v.critique && v.critique.resume).slice(0, 4).map((v) => '- ' + court(v.titre, 60) + ' : ' + court(v.critique.resume, 200)).join('\n');

  const consigne = (idee ? 'L\'IDÉE À TRAITER (de ' + (idee.agent_id || 'l\'équipe') + ') : ' + idee.title + '\n' + court(idee.body, 1200) : 'Pas d\'idée en attente : choisis toi-même le meilleur sujet du moment dans la ligne éditoriale.') +
    '\n\nDÉJÀ FAITS (ne refais aucun de ces sujets, même sous un autre angle) :\n' + (faits.map((f) => '- ' + court(f.sujet || f.titre, 80)).join('\n') || '- aucun pour l\'instant') +
    '\n\nÉcris le script (outil ecrire_script).';
  let r, cout = 0;
  try { r = await outil({ tier: 'smart', systeme: systeme(sarah && sarah.playbook, lecons, critiques), contenu: consigne, outil: OUTIL, maxTokens: 3500 }); cout += r.cout; }
  catch (e) { return { resume: 'Script impossible : ' + court(e.message, 200), cout: e.cout || 0, erreur: true, prochain_min: 60 }; }
  let x = r.entree, v = verifierScript(x);
  if (v.err.length) {
    try {
      const r2 = await outil({ tier: 'smart', systeme: systeme(sarah && sarah.playbook, lecons, critiques), contenu: consigne + '\n\nTON PREMIER JET A ÉTÉ REFUSÉ :\n- ' + v.err.join('\n- ') + '\n\nPREMIER JET :\n' + JSON.stringify(x).slice(0, 6000) + '\n\nRéécris-le en corrigeant tout.', outil: OUTIL, maxTokens: 3500 });
      cout += r2.cout; x = r2.entree; v = verifierScript(x);
    } catch (e) { cout += e.cout || 0; }
  }
  if (v.err.length) return { resume: 'Script refusé par le contrôle : ' + v.err.join(' ; '), cout, erreur: true, prochain_min: 60 };

  const cle = 'meca:' + sansAccents(String(x.cle || x.sujet || x.titre)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  if (faits.some((f) => f.dedupe === cle)) {
    if (idee) await db.update('hq_items', { status: 'traite', updated_at: new Date().toISOString() }, { eq: { id: idee.id } });
    return { resume: 'Sujet déjà fait (' + cle + ') : idée écartée.', cout, prochain_min: 20 };
  }
  const script = {
    titre: nettoie(court(x.titre, 90)), accroche: nettoie(court(x.accroche, 70)),
    beats: x.beats.map((b) => ({ voix: nettoie(String(b.voix).trim()), ecran: b.ecran ? nettoie(court(b.ecran, 14)) : null, image: nettoie(court(b.image, 300)) })),
    description: nettoie(court(x.description, 400)), hashtags: (Array.isArray(x.hashtags) ? x.hashtags : []).slice(0, 6).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')),
    sources: (Array.isArray(x.sources) ? x.sources : []).slice(0, 6).map((s) => court(s, 200)), a_verifier: (Array.isArray(x.a_verifier) ? x.a_verifier : []).slice(0, 5).map((s) => court(s, 200)), mots: v.mots
  };
  const ins = await db.insert('hq_videos', { ligne: 'meca', sujet: nettoie(court(x.sujet, 120)), titre: script.titre, status: 'script', langue_source: 'en', langues: reg.langues, script, item_id: idee ? idee.id : null, dedupe: cle, cout_usd: Math.round(cout * 10000) / 10000 }, { onConflict: 'dedupe', ignoreDuplicates: true });
  if (idee) await db.update('hq_items', { status: 'traite', updated_at: new Date().toISOString() }, { eq: { id: idee.id } });
  if (!ins.length) return { resume: 'Sujet déjà en base, rien de neuf.', cout, prochain_min: 20 };
  ctx.compteurs.items++;
  // Oscar monte la scène dans la foulée
  await db.update('hq_agents', { next_run_at: new Date(Date.now() + 2 * 60000).toISOString() }, { eq: { id: 'animateur' }, neq: { status: 'paused' } }).catch(() => null);
  return { resume: 'Script écrit : « ' + script.titre + ' » (' + v.mots + ' mots, ' + script.beats.length + ' plans).', cout, produit: 1, prochain_min: 30, detail: { video: ins[0].id, sujet: x.sujet, a_verifier: script.a_verifier } };
}

module.exports = { run, verifierScript, OUTIL };
