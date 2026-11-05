// Clara, scénariste du Studio 3D (ligne Mécanique) : écrit le script à partir du sujet et de l'accroche de Sacha, avec
// la structure qui garde les gens jusqu'au bout (enjeu, boucles ouvertes, relance au milieu, révélation, fin qui boucle)
// et un événement visuel prévu à chaque phrase. Félix (prof du viral) la juge ; elle réécrit avec ses corrections, ou
// celles d'Hélène si un fait est faux. Elle lit la bible du viral, ses leçons et les dernières critiques de Vera.
'use strict';
const S = require('../studio');
const V = require('../studio/viral');
const L = require('../studio/langues');
const { outil, recu } = require('../studio/ecrire');
const { court, nettoie } = require('../util');

const ROLES = ['accroche', 'enjeu', 'boucle', 'mecanisme', 'relance', 'gain', 'fin'];
const OUTIL = {
  name: 'ecrire_script',
  description: 'Le script complet de la vidéo, en anglais parlé.',
  input_schema: {
    type: 'object',
    properties: {
      titre: { type: 'string', description: 'Titre YouTube en anglais, 70 signes max, qui donne envie sans mentir' },
      accroche: { type: 'string', description: 'Texte en gros à l\'écran pendant la première phrase : 7 mots max, un mot entre *étoiles* mis en couleur ; il complète la voix, il ne la répète pas' },
      beats: {
        type: 'array', minItems: 13, maxItems: 18,
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ROLES, description: 'Le rôle de la phrase dans la structure' },
            voix: { type: 'string', description: 'Une phrase dite à voix haute, 6 à 16 mots, les 1 à 3 mots forts entre *étoiles*' },
            ecran: { type: 'string', description: 'Optionnel : un chiffre vrai ou un mot clé en gros (ex. « 80°C », « x10 »), 12 signes max ; un chiffre monte tout seul de 0 à sa valeur' },
            image: { type: 'string', description: 'Ce qu\'on voit et ce qui CHANGE à l\'écran pendant cette phrase (la pièce, le geste de caméra, l\'événement visuel)' }
          },
          required: ['role', 'voix', 'image']
        }
      },
      boucles: { type: 'array', items: { type: 'object', properties: { annonce: { type: 'integer', description: 'Numéro de la phrase qui ouvre la boucle (à partir de 1)' }, paiement: { type: 'integer', description: 'Numéro de la phrase qui la referme' }, promesse: { type: 'string' } }, required: ['annonce', 'paiement', 'promesse'] }, description: 'Les boucles ouvertes : ce qu\'on annonce, et où on le paie' },
      description: { type: 'string', description: 'Description YouTube et TikTok, 2 phrases, la seconde pose une question qui fait commenter' },
      commentaire: { type: 'string', description: 'Le commentaire épinglé : une question simple qui donne envie de répondre (ex. « What should we open next? »)' },
      hashtags: { type: 'array', items: { type: 'string' }, description: '5 hashtags anglais' },
      sources: { type: 'array', items: { type: 'string' }, description: 'Ce qui permet de vérifier les faits (références techniques connues)' },
      a_verifier: { type: 'array', items: { type: 'string' }, description: 'Les affirmations dont tu n\'es pas sûre (vide si tout est sûr)' }
    },
    required: ['titre', 'accroche', 'beats', 'boucles', 'description', 'commentaire', 'hashtags']
  }
};

function systeme(ligneEditoriale, regles, lecons, critiques, actu) {
  return `Tu es Clara, scénariste d'une chaîne de vidéos verticales « comment ça marche » en 3D, publiées sur TikTok et YouTube Shorts, écrites en anglais puis adaptées dans d'autres langues. Public : curieux de 13 à 45 ans, qui scrollent vite. Tu écris pour qu'il n'y ait jamais une demi-seconde d'ennui : chaque phrase fait avancer, chaque phrase montre quelque chose de nouveau.

TA MISSION : à partir du sujet, de la révélation et de l'accroche choisis par Sacha, écrire un script de 62 à 75 secondes (150 à 195 mots, 13 à 18 phrases courtes) qui explique UN mécanisme réel de façon juste.

${V.TOUT}

${V.IMAGE}

LA FORME DU SCRIPT
- Phrase 1 (role accroche) : la voix de l'accroche de Sacha (tu peux la resserrer, jamais l'affaiblir). Elle fait 12 mots au plus.
- Phrase 2 ou 3 (role enjeu) : pourquoi ça le concerne, ou la promesse de ce qu'il va comprendre.
- Au moins 2 boucles ouvertes (role boucle) payées plus loin (liste « boucles »).
- Les phrases du mécanisme (role mecanisme), dans l'ordre où il se passe.
- Une relance (role relance) entre 40 et 60 % de la vidéo.
- La révélation (role gain), puis la dernière phrase (role fin) qui appelle la première : on revoit sans s'en rendre compte.
- Les mots forts entre *étoiles* : 1 à 3 par phrase, ce sont les mots qu'on doit entendre (à l'écran ils grossissent et la caméra donne un coup de zoom).
- « image » : ce qu'on voit ET ce qui change. Oscar monte la 3D à partir de ça.

VÉRITÉ : aucun chiffre inventé. Si tu n'es pas sûre, ne l'écris pas, ou mets-le dans a_verifier : une ingénieure vérifie chaque fait après toi.

LIGNE ÉDITORIALE DE SARAH (la directrice) :
${ligneEditoriale || 'Séries : mécanismes du quotidien, moteurs et transmissions, engins de chantier, aviation et marine, énergie.'}
${regles ? '\nCE QUE LE PROF DU VIRAL A APPRIS (à appliquer) :\n' + regles : ''}${lecons ? '\nTES LEÇONS :\n' + lecons : ''}${critiques ? '\nCE QUE VERA A REPROCHÉ AUX DERNIÈRES VIDÉOS (à éviter) :\n' + critiques : ''}${actu ? '\nCE DONT LE MONDE ANGLOPHONE PARLE CETTE SEMAINE (une référence au plus, seulement si elle fait une image qui aide, jamais un drame) :\n' + actu : ''}`;
}

function verifierScript(x) {
  const err = [];
  const beats = Array.isArray(x.beats) ? x.beats : [];
  const n = beats.length;
  if (n < 12 || n > 18) err.push('13 à 18 phrases (ici ' + n + ')');
  const mots = beats.reduce((s, b) => s + V.mots(b.voix), 0);
  if (mots < 148) err.push('trop court : ' + mots + ' mots, il en faut 150 à 195 (la vidéo doit dépasser une minute)');
  if (mots > 200) err.push('trop long : ' + mots + ' mots, 195 au plus');
  beats.forEach((b, i) => {
    const m = V.mots(b.voix);
    if (m < 3 || m > (i === 0 ? 13 : 19)) err.push('phrase ' + (i + 1) + ' : ' + m + ' mots (' + (i === 0 ? '12' : '16') + ' au plus)');
    if (V.forts(b.voix) > 3) err.push('phrase ' + (i + 1) + ' : trop de mots forts (3 au plus)');
    if ((String(b.voix || '').match(/\*/g) || []).length % 2) err.push('phrase ' + (i + 1) + ' : une étoile n\'est pas refermée');
    if (b.ecran && String(b.ecran).length > 14) err.push('phrase ' + (i + 1) + ' : texte écran trop long');
    if (!b.image) err.push('phrase ' + (i + 1) + ' : ce qu\'on voit manque');
  });
  const totalForts = beats.reduce((s, b) => s + V.forts(b.voix), 0);
  if (n && totalForts < Math.ceil(n / 2)) err.push('trop peu de mots forts entre *étoiles* (' + totalForts + ')');
  if (n && (beats[0].role !== 'accroche')) err.push('la phrase 1 doit être l\'accroche');
  if (n && beats[n - 1].role !== 'fin') err.push('la dernière phrase doit être la fin qui boucle');
  const relances = beats.map((b, i) => (b.role === 'relance' ? i : -1)).filter((i) => i >= 0);
  if (!relances.some((i) => i >= Math.floor(n * 0.3) && i <= Math.ceil(n * 0.7))) err.push('il manque une relance vers le milieu (role relance)');
  if (!beats.some((b) => b.role === 'gain')) err.push('il manque la révélation (role gain)');
  const boucles = (Array.isArray(x.boucles) ? x.boucles : []).filter((b) => Number(b.annonce) >= 1 && Number(b.paiement) > Number(b.annonce) && Number(b.paiement) <= n);
  if (boucles.length < 2) err.push('au moins 2 boucles ouvertes, annoncées puis payées plus loin');
  if (!x.accroche || V.mots(x.accroche) > 8) err.push('accroche à l\'écran absente ou trop longue (7 mots)');
  if (x.accroche && x.beats && x.beats[0] && V.sansEtoiles(x.accroche).toLowerCase().replace(/[^a-z0-9 ]/g, '') === V.sansEtoiles(x.beats[0].voix).toLowerCase().replace(/[^a-z0-9 ]/g, '')) err.push('le texte à l\'écran répète la voix mot pour mot : il doit la compléter');
  return { err, mots };
}

function relectureEnTexte(rl) {
  if (!rl) return '';
  return 'NOTE DE FÉLIX : ' + rl.note + '/10. ' + (rl.resume || '') + '\n' +
    (rl.notes ? 'Par critère : ' + V.GRILLE.map((g) => g[0] + ' ' + ((rl.notes || {})[g[0]] != null ? rl.notes[g[0]] : '?')).join(', ') + '\n' : '') +
    (rl.spectateur || []).map((s) => '- Phrase ' + s.beat + ' : risque de décrochage ' + s.risque + '/3, ' + s.pourquoi).join('\n') + '\n' +
    (rl.corrections || []).map((c) => '- Phrase ' + c.beat + ' : ' + c.probleme + (c.proposition ? ' Proposition : « ' + c.proposition + ' »' : '')).join('\n') +
    (rl.accroche_meilleure ? '\nAccroche qu\'il propose : « ' + rl.accroche_meilleure + ' »' : '');
}

async function run(ctx) {
  const db = ctx.db;
  // d'abord finir ce qui est commencé (une réécriture), puis un nouveau sujet de Sacha
  const v = (await db.one('hq_videos', { eq: { ligne: 'meca', status: 'reecriture' }, order: 'updated_at.asc' })) || (await db.one('hq_videos', { eq: { ligne: 'meca', status: 'accroche' }, order: 'updated_at.asc' }));
  if (!v) return { resume: 'Rien à écrire : j\'attends les accroches de Sacha.', prochain_min: 45 };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const s0 = v.script || {}, brief = s0.brief || {};
  const sarah = await db.one('hq_agents', { eq: { id: 'dired_studio' }, select: 'playbook' });
  const lecons = (await db.select('hq_knowledge', { eq: { agent_id: ctx.agent.id }, order: ['weight.desc', 'id.desc'], limit: 8 }).catch(() => [])).map((k) => '- ' + court(k.content, 220)).join('\n');
  const regles = await V.lecons(db, 10);
  const critiques = (await db.select('hq_videos', { select: 'titre,critique', eq: { ligne: 'meca' }, in: { status: ['refuse', 'scene', 'script', 'traduction', 'langues', 'prete', 'publiee'] }, order: 'updated_at.desc', limit: 8 }))
    .filter((x) => x.critique && x.critique.resume).slice(0, 4).map((x) => '- ' + court(x.titre, 60) + ' : ' + court(x.critique.resume, 200)).join('\n');
  const actu = await L.actu(db, 'en');

  const h = (brief.accroches || [])[(brief.choix || 1) - 1] || {};
  const autres = (brief.accroches || []).filter((a) => a.n !== brief.choix).slice(0, 3);
  let consigne = 'LE SUJET : ' + (v.sujet || '') + '\nLE MÉCANISME (vrai, dans l\'ordre) :\n' + (brief.mecanisme || []).map((m, i) => (i + 1) + '. ' + m).join('\n') +
    '\nLA RÉVÉLATION (le gain) : ' + (brief.revelation || '') + '\nLES CHIFFRES SÛRS : ' + ((brief.chiffres || []).join(' ; ') || 'aucun') +
    '\n\nL\'ACCROCHE CHOISIE PAR SACHA (' + (h.famille || '') + ') :\n  voix : « ' + (h.voix || '') + ' »\n  écran : « ' + (h.ecran || '') + ' »\n  image : ' + (h.image || '') + '\n  question plantée : ' + (h.question || '') +
    (autres.length ? '\nSes autres pistes (pour des boucles ou la fin) : ' + autres.map((a) => '« ' + V.sansEtoiles(a.voix) + ' »').join(' ; ') : '');
  const relectures = s0.relectures || [];
  if (v.status === 'reecriture') {
    const der = relectures[relectures.length - 1];
    const verif = s0.verif && s0.verif.renvoi ? s0.verif : null;
    consigne += '\n\nTON SCRIPT PRÉCÉDENT :\n' + JSON.stringify({ titre: s0.titre, accroche: s0.accroche, beats: s0.beats, boucles: s0.boucles }).slice(0, 6000) +
      (verif ? '\n\nHÉLÈNE (L\'INGÉNIEURE) A TROUVÉ DES ERREURS DE FOND :\n' + (verif.faits || []).filter((f) => f.statut === 'faux' || f.statut === 'approximatif').map((f) => '- Phrase ' + f.beat + ' : « ' + f.affirmation + ' » est ' + f.statut + '. ' + (f.explication || '')).join('\n') : '') +
      (der && !verif ? '\n\n' + relectureEnTexte(der) : '') +
      '\n\nRéécris le script en entier en corrigeant TOUT ce qui est signalé, sans perdre ce qui marchait.';
  }
  consigne += '\n\nÉcris le script (outil ecrire_script).';
  const sys = systeme(sarah && sarah.playbook, regles, lecons, critiques, actu);
  let r, cout = 0;
  try { r = await outil({ tier: 'smart', systeme: sys, contenu: consigne, outil: OUTIL, maxTokens: 6000 }); cout += r.cout; }
  catch (e) { return { resume: 'Script impossible : ' + court(e.message, 200), cout: e.cout || 0, erreur: true, prochain_min: 60 }; }
  let x = r.entree, vr = verifierScript(x);
  if (vr.err.length) {
    try {
      const r2 = await outil({ tier: 'smart', systeme: sys, contenu: consigne + '\n\nTON JET A ÉTÉ REFUSÉ PAR LE CONTRÔLE :\n- ' + vr.err.join('\n- ') + '\n\nTON JET :\n' + JSON.stringify(x).slice(0, 6000) + '\n\nRéécris-le en corrigeant tout.', outil: OUTIL, maxTokens: 6000 });
      cout += r2.cout; x = r2.entree; vr = verifierScript(x);
    } catch (e) { cout += e.cout || 0; }
  }
  if (vr.err.length) {
    // trois passages ratés sur le même sujet : il sort de la fabrication (il ne coûte plus rien)
    const echecs = (s0.echecs || 0) + 1;
    await S.maj(db, v.id, echecs >= 3 ? { status: 'refuse', script: Object.assign({}, s0, { echecs }), critique: Object.assign({}, v.critique || {}, { resume: 'Script impossible à faire passer le contrôle : ' + court(vr.err.join(' ; '), 300) }) } : { script: Object.assign({}, s0, { echecs }) }, v.status);
    await S.ajouterCout(db, v.id, cout);
    return { resume: 'Script refusé par le contrôle (« ' + court(v.sujet, 40) + ' »)' + (echecs >= 3 ? ', sujet abandonné' : '') + ' : ' + vr.err.join(' ; ') + ' [reçu : ' + recu(x) + ']', cout, erreur: true, prochain_min: 45 };
  }
  const script = Object.assign({}, s0, {
    titre: nettoie(court(x.titre, 90)), accroche: nettoie(court(x.accroche, 70)),
    beats: x.beats.map((b) => ({ role: ROLES.indexOf(b.role) >= 0 ? b.role : 'mecanisme', voix: nettoie(String(b.voix).trim()), ecran: b.ecran ? nettoie(court(b.ecran, 14)) : null, image: nettoie(court(b.image, 300)) })),
    boucles: (x.boucles || []).slice(0, 5).map((b) => ({ annonce: Number(b.annonce), paiement: Number(b.paiement), promesse: nettoie(court(b.promesse, 200)) })),
    description: nettoie(court(x.description, 400)), commentaire: nettoie(court(x.commentaire || '', 200)),
    hashtags: (Array.isArray(x.hashtags) ? x.hashtags : []).slice(0, 6).map((t) => '#' + String(t).replace(/^#+/, '').replace(/\s+/g, '')),
    sources: (Array.isArray(x.sources) ? x.sources : []).slice(0, 6).map((t) => court(t, 200)), a_verifier: (Array.isArray(x.a_verifier) ? x.a_verifier : []).slice(0, 5).map((t) => court(t, 200)),
    mots: vr.mots, versions: (s0.versions || 0) + 1
  });
  if (script.verif) delete script.verif.renvoi;
  const ok = await S.maj(db, v.id, { status: 'relecture', titre: script.titre, script }, v.status);
  await S.ajouterCout(db, v.id, cout);
  if (!ok) return { resume: 'La vidéo a changé d\'état pendant l\'écriture, rien d\'enregistré.', cout, prochain_min: 10 };
  ctx.compteurs.items++;
  // Félix relit dans la foulée
  await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: 'prof_viral' }, neq: { status: 'paused' } }).catch(() => null);
  return { resume: (v.status === 'reecriture' ? 'Réécrit' : 'Script écrit') + ' : « ' + script.titre + ' » (' + vr.mots + ' mots, ' + script.beats.length + ' phrases, version ' + script.versions + ').', cout, produit: 1, prochain_min: 20, detail: { video: v.id } };
}

module.exports = { run, verifierScript, OUTIL, ROLES };
