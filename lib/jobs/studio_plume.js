// Romane, la plume française du Studio : écrit la version française de chaque vidéo validée par Vera comme une
// créatrice TikTok française l'aurait écrite (pas une traduction) : son accroche à elle, ses expressions, une ou deux
// blagues sur ce dont les Français parlent cette semaine (la fiche de Gaspard), les mêmes faits, les mêmes images.
'use strict';
const S = require('../studio');
const V = require('../studio/viral');
const L = require('../studio/langues');
const { outil } = require('../studio/ecrire');
const { court } = require('../util');

const OUTIL = {
  name: 'ecrire_francais',
  description: 'La version française de la vidéo.',
  input_schema: {
    type: 'object',
    properties: {
      titre: { type: 'string', description: 'Titre en français, 70 signes max' },
      accroche: { type: 'string', description: 'Le texte en gros à l\'écran pendant la première phrase, 7 mots max, un mot entre *étoiles*' },
      beats: { type: 'array', items: { type: 'object', properties: { voix: { type: 'string', description: 'La phrase dite, en français parlé, mots forts entre *étoiles*' }, ecran: { type: 'string' }, etiquettes: { type: 'array', items: { type: 'object', properties: { objet: { type: 'string' }, texte: { type: 'string' } }, required: ['objet', 'texte'] } } }, required: ['voix'] } },
      description: { type: 'string', description: 'Deux phrases, la seconde pose une question qui fait commenter' },
      hashtags: { type: 'array', items: { type: 'string' }, description: '5 hashtags que le public français cherche vraiment' },
      blagues: { type: 'array', items: { type: 'string' }, description: 'Les touches d\'humour que tu as mises, et à quelle phrase (pour la relecture)' }
    },
    required: ['titre', 'accroche', 'beats', 'description', 'hashtags', 'blagues']
  }
};

function systeme(actu, regles) {
  return `Tu es Romane, la plume française du Studio 3D. Tu écris la version française d'une vidéo verticale « comment ça marche » en 3D (TikTok et YouTube Shorts), à partir de la version anglaise. Tu n'es pas traductrice : tu écris comme une créatrice TikTok française de 25 ans, drôle et précise, qui explique une machine à ses potes. Le public doit se dire « c'est trop bien fait ».

${V.ACCROCHE}

${V.RYTHME}

${V.HUMOUR}

${V.LANGUE}

TES RÈGLES DE FORME (le montage est déjà calé sur chaque phrase)
1. Une phrase française par phrase anglaise, dans le même ordre, avec les mêmes faits et les mêmes chiffres (aucun ajout technique, aucun chiffre changé ; unités métriques).
2. Chaque phrase garde à peu près la longueur de l'anglaise (le français peut être un peu plus long, jamais une fois et demie). Phrases courtes, parlées, tutoiement (« ta clim »).
3. L'accroche (phrase 1 et texte à l'écran) : réécris-la en français pour qu'elle frappe autant ou plus, même question plantée. Jamais une traduction plate.
4. Les mots forts entre *étoiles*, 1 à 3 par phrase, aux mêmes endroits du sens.
5. Une à deux touches d'humour dans toute la vidéo, jamais dans la phrase 1 ni dans la révélation : une comparaison avec une situation que tous les Français vivent en ce moment, qui AIDE à comprendre (« plus de pression qu'un lycéen devant Parcoursup »). On rit de la situation, jamais d'une personne ni d'un groupe ; jamais de politique partisane, jamais un drame.
6. Les étiquettes : mêmes objets (même identifiant), 2 ou 3 mots, 28 signes max, les vrais noms techniques français.
7. Le texte à l'écran (ecran) : court, nombres à la française (80 °C, 3 000 tr/min).
8. Pas de tiret long, pas d'emoji.
${actu ? '\nCE DONT LES FRANÇAIS PARLENT CETTE SEMAINE (la fiche de Gaspard, choisis ce qui colle à la machine) :\n' + actu : '\nPas de fiche d\'actualité cette semaine : prends des situations que tout le monde connaît (les partiels, le métro bondé, le loyer, la canicule, la file à la boulangerie).'}${regles ? '\n\nLES RÈGLES APPRISES PAR LE PROF DU VIRAL :\n' + regles : ''}`;
}

async function run(ctx) {
  const db = ctx.db;
  const liste = await db.select('hq_videos', { eq: { status: 'traduction' }, order: 'updated_at.asc', limit: 20 });
  const v = liste.find((x) => (x.langues || []).indexOf(S.PLUME) >= 0 && x.langue_source !== S.PLUME && !(x.traductions || {})[S.PLUME] && ((x.critique || {}).plume_echecs || 0) < 2);
  if (!v) return { resume: 'Aucune vidéo à écrire en français.', prochain_min: 45 };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const src = L.source(v);
  const actu = await L.actu(db, S.PLUME);
  const regles = await V.lecons(db, 6);
  const contenu = 'LA VIDÉO EN ANGLAIS (les étiquettes visent des pièces de la scène 3D) :\n' + JSON.stringify(src) + '\n\nLA RÉVÉLATION : ' + (((v.script || {}).brief || {}).revelation || '') + '\n\nÉcris la version française (outil ecrire_francais).';
  let x = null, err = [], cout = 0;
  for (let essai = 0; essai < 2; essai++) {
    try {
      const r = await outil({ tier: 'smart', systeme: systeme(actu, regles), contenu: contenu + (err.length ? '\n\nTA PREMIÈRE VERSION A ÉTÉ REFUSÉE :\n- ' + err.join('\n- ') + '\n\nTA VERSION :\n' + JSON.stringify(x).slice(0, 6000) : ''), outil: OUTIL, maxTokens: 6500 });
      cout += r.cout; x = r.entree; err = L.verifier(x, src, 1.5);
      if (!err.length && !(Array.isArray(x.blagues) && x.blagues.length)) err = ['il manque la touche d\'humour (une ou deux dans la vidéo)'];
      if (!err.length && (x.beats || []).some((b) => (String(b.voix || '').match(/\*/g) || []).length % 2)) err = ['une étoile de mot fort n\'est pas refermée'];
    } catch (e) { cout += e.cout || 0; err = [court(e.message, 160)]; }
    if (!err.length) break;
  }
  await S.ajouterCout(db, v.id, cout);
  if (err.length) {
    // deux échecs : Nina prend le français à sa place (la vidéo ne reste pas bloquée)
    await require('../db').majFraiche(db, 'hq_videos', v.id, (f) => ({ critique: Object.assign({}, f.critique || {}, { plume_echecs: ((f.critique || {}).plume_echecs || 0) + 1 }) }));
    return { resume: 'Version française ratée pour « ' + court(v.titre, 50) + ' » : ' + court(err.join(' ; '), 200), cout, erreur: true, prochain_min: 30 };
  }
  const version = L.propre(x);
  await L.enregistrer(db, v.id, S.PLUME, version);
  const avance = await L.avancer(db, v.id);
  ctx.compteurs.items++;
  return { resume: '« ' + court(version.titre, 60) + ' » écrite en français' + (version.blagues.length ? ' (humour : ' + court(version.blagues.join(' ; '), 140) + ')' : '') + (avance ? ', toutes les langues sont prêtes.' : '.'), cout, produit: 1, prochain_min: 10 };
}

module.exports = { run, OUTIL };
