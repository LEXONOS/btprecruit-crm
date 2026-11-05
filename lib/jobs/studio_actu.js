// Gaspard, veilleur d'actualité du Studio : chaque matin, il fait la fiche de ce dont les gens parlent cette semaine,
// pays par pays (étudiants, examens, grèves et manifs vues comme des situations du quotidien, météo, sport, sorties,
// tendances TikTok), avec pour chaque sujet la situation drôle que tout le monde connaît et ce qu'il ne faut pas toucher.
// Romane (la version française), Clara et Sacha y piochent une référence quand elle sert l'explication.
'use strict';
const S = require('../studio');
const { converse } = require('../claude');
const { relire } = require('../studio/ecrire');
const { court, nettoie, jourGP, jusquaDemainGP } = require('../util');

const PAYS = {
  fr: { nom: 'la France', public: 'les 15 à 35 ans en France (lycéens, étudiants, jeunes actifs)', exemples: 'Parcoursup, le bac, les partiels, le logement étudiant, les grèves de transport, une manif qui bloque le lycée, la canicule, le prix du kebab, le Black Friday, un match de foot, une série qui sort' },
  en: { nom: 'le monde anglophone (États-Unis, Royaume-Uni, Inde anglophone)', public: 'les 15 à 35 ans qui regardent TikTok et YouTube Shorts en anglais', exemples: 'les examens de fin de semestre, une vague de chaleur ou de froid, un jeu vidéo qui sort, une tendance TikTok, une fête qui approche, un événement sportif' },
  es: { nom: 'l\'Amérique latine et l\'Espagne', public: 'les 15 à 35 ans hispanophones', exemples: 'les examens, le climat, le football, une fête nationale, une tendance' },
  pt: { nom: 'le Brésil', public: 'les 15 à 35 ans au Brésil', exemples: 'l\'ENEM, la chaleur, le football, le carnaval qui approche, une tendance' }
};
const LANGUES_ACTU = ['fr', 'en'];

const OUTIL = {
  name: 'fiche_actu',
  description: 'La fiche d\'actualité de la semaine, quand tes recherches sont faites.',
  input_schema: {
    type: 'object',
    properties: {
      saison: { type: 'string', description: 'Ce qui est dans l\'air en ce moment (météo, calendrier scolaire, fêtes), en une phrase' },
      sujets: {
        type: 'array', minItems: 4, maxItems: 8,
        items: {
          type: 'object',
          properties: {
            sujet: { type: 'string', description: 'Le sujet en quelques mots' },
            contexte: { type: 'string', description: 'Ce qui se passe, factuel, une phrase' },
            situation: { type: 'string', description: 'La situation drôle et partagée que tout le monde reconnaît, utilisable comme image dans une explication (ex. « réviser ses partiels avec le lycée bloqué »)' },
            exemple: { type: 'string', description: 'Une comparaison prête à dire, dans la langue du pays (ex. « plus de pression qu\'un lycéen devant Parcoursup »)' },
            a_eviter: { type: 'string', description: 'Ce qu\'il ne faut surtout pas dire sur ce sujet' },
            source: { type: 'string', description: 'L\'adresse de la source' }
          },
          required: ['sujet', 'contexte', 'situation', 'exemple', 'a_eviter']
        }
      }
    },
    required: ['saison', 'sujets']
  }
};

function systeme(l) {
  const p = PAYS[l];
  return `Tu es Gaspard, veilleur d'actualité du Studio 3D (vidéos « comment ça marche » en 3D sur TikTok et YouTube). Tu prépares pour les scénaristes la fiche de ce dont ${p.public} parlent CETTE SEMAINE, pour ${p.nom}. Ils y piochent une comparaison drôle qui aide à comprendre une machine.
TON TRAVAIL : 3 ou 4 recherches web sur l'actualité de la semaine (exemples de pistes : ${p.exemples}), puis la fiche (outil fiche_actu), 4 à 8 sujets.
LES RÈGLES (non négociables)
- On rit d'une SITUATION partagée, jamais d'une personne, d'un groupe, d'un métier, d'une origine, d'une religion, d'un physique.
- Les grèves et les manifs : seulement comme situation du quotidien (le métro à l'arrêt, le lycée bloqué, réviser quand même), jamais la cause, jamais un camp, jamais un avis.
- Jamais de politique partisane ni de nom de responsable politique. Jamais de mort, d'accident, de guerre, d'attentat, de catastrophe, de maladie, de crime, de faits divers.
- Des faits vrais et récents (de moins de 10 jours), avec la source.
Termine TOUJOURS par l'outil fiche_actu. Pas de tiret long, pas d'emoji.`;
}

async function run(ctx) {
  const db = ctx.db;
  const r0 = await db.one('hq_config', { eq: { key: 'studio_actu' } }).catch(() => null);
  const avant = (r0 && r0.value) || {};
  if (avant.jour === jourGP()) return { resume: 'La fiche du jour est déjà faite.', prochain_min: jusquaDemainGP(7 * 60) };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const reg = (await S.reglages(db)).meca;
  const langues = LANGUES_ACTU.filter((l) => l === 'en' || reg.langues.indexOf(l) >= 0);
  const out = Object.assign({}, avant.langues || {});
  let cout = 0, recherches = 0;
  const faites = [], ratees = [];
  for (const l of langues) {
    if (ctx.limite && Date.now() > ctx.limite - 60000) break;
    try {
      const r = await converse({ tier: 'fast', system: systeme(l), messages: [{ role: 'user', content: 'Nous sommes le ' + new Date().toISOString().slice(0, 10) + '. Fais la fiche de la semaine pour ' + PAYS[l].nom + ' (textes de la fiche en ' + (l === 'fr' ? 'français' : 'français, et la comparaison « exemple » en ' + (S.LANGUES[l] || {}).nom) + ').' }], tools: [OUTIL], executors: {}, webSearch: { max_uses: 4 }, stopTool: 'fiche_actu', maxSteps: 6, maxTokens: 3000, maxCout: 0.12 });
      cout += r.cout; recherches += r.usage.searches || 0;
      const x = r.fin ? relire(r.fin, OUTIL.input_schema) : null;
      if (!x || !Array.isArray(x.sujets) || !x.sujets.length) { ratees.push(l); continue; }
      out[l] = x.sujets.slice(0, 8).map((s) => ({ sujet: nettoie(court(s.sujet, 80)), contexte: nettoie(court(s.contexte, 240)), situation: nettoie(court(s.situation, 200)), exemple: nettoie(court(s.exemple, 160)), a_eviter: nettoie(court(s.a_eviter, 160)), source: court(s.source || '', 200) }));
      out[l + '_saison'] = nettoie(court(x.saison || '', 200));
      faites.push(l);
    } catch (e) { cout += e.cout || 0; ratees.push(l); }
  }
  if (!faites.length) return { resume: 'Fiche d\'actualité impossible (' + ratees.join(', ') + ').', cout, erreur: true, prochain_min: 180 };
  await db.upsert('hq_config', { key: 'studio_actu', value: { jour: jourGP(), le: new Date().toISOString(), langues: out }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  ctx.compteurs.items++;
  return { resume: 'Fiche d\'actualité faite pour ' + faites.join(', ') + ' (' + faites.map((l) => out[l].length).join(' et ') + ' sujets, ' + recherches + ' recherches)' + (ratees.length ? ', ratée pour ' + ratees.join(', ') : '') + '.', cout, produit: faites.length, prochain_min: jusquaDemainGP(7 * 60) };
}

module.exports = { run, OUTIL, PAYS };
