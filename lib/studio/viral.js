// La bible du viral du Studio : ce que savent l'accrocheur, la scénariste, le prof du viral, la plume française, Nina
// et Vera. Une seule source, pour que tout le monde écrive et juge avec les mêmes règles. Le prof du viral l'enrichit de
// ses leçons (hq_knowledge), et plus tard des statistiques réelles de Zoé.
'use strict';

const SIGNAUX = `CE QUI FAIT POUSSER UNE VIDÉO (TikTok et YouTube Shorts, 2026)
- Le taux de visionnage complet est roi : sous 40 % la vidéo meurt, 60 à 70 % elle est testée plus large, au-dessus de 70 % elle part, 80 % et plus elle explose. Sur 60 s, il faut garder les gens 42 s en moyenne.
- Le revisionnage compte presque autant (15 à 20 % de gens qui revoient = excellent) : une fin qui relance le début fait revoir.
- Puis le temps de visionnage, les partages (plus forts que les likes), les enregistrements, les commentaires, les abonnements.
- YouTube Shorts mesure « regardée » contre « balayée » : chaque balayage dans les 2 premières secondes est un vote contre.
- La vidéo est d'abord montrée à 100 à 200 personnes ; si elles restent, elle passe à 1 000 à 5 000, puis plus. Tout se joue sur les premiers spectateurs.`;

const ACCROCHE = `L'ACCROCHE (0 à 1,5 s) : TROIS ACCROCHES EN MÊME TEMPS
1. L'image : la pièce la plus spectaculaire, déjà en mouvement, en gros plan, puis la caméra recule et révèle (jamais un plan large immobile, jamais un logo, jamais un fondu au noir).
2. Le texte à l'écran (7 mots max) : il complète la voix, il ne la répète pas mot pour mot ; un mot en couleur (*mot*).
3. La voix : les 3 premiers mots portent la tension. Aucune intro, aucun « salut », aucun « dans cette vidéo », aucun « avez-vous déjà ».
LES FAMILLES D'ACCROCHES QUI MARCHENT (exemples sur la clim)
- La contradiction : « Your AC doesn't make cold. »
- Le chiffre choc : « This valve is smaller than your thumb and runs your whole house. »
- L'enjeu caché : « One tiny part decides if your AC dies this summer. »
- La question impossible : « How does a box on your wall pump heat outside? »
- Le « personne ne t'explique » : « Nobody tells you what's actually inside this box. »
- Le défi au regard : « Watch the gas the second it hits this valve. »
- Le point de vue : « POV : tu es une molécule de gaz dans ta clim. »
- La comparaison absurde : « This compressor squeezes harder than rush hour on the metro. »
Une bonne accroche crée une question précise dans la tête, que seule la suite de la vidéo répond. Elle doit être comprise en 1,5 s par quelqu'un qui ne connaît rien au sujet.`;

const STRUCTURE = `LA STRUCTURE QUI GARDE LES GENS JUSQU'AU BOUT (60 à 75 s)
- 0 à 3 s : l'accroche (voir plus haut).
- 3 à 8 s : l'enjeu ou la promesse : pourquoi ça le concerne, ce qu'il va comprendre (« in 60 seconds you'll never look at your AC the same way »).
- Le mécanisme, étape par étape, dans l'ordre où il se passe ; chaque phrase fait avancer d'un cran et montre quelque chose de nouveau.
- Au moins 2 BOUCLES OUVERTES : on annonce quelque chose pour plus tard (« but the real trick is a tiny valve, we'll get there »), puis on le paie.
- Une RELANCE vers le milieu (45 à 55 % de la vidéo) : un moment « et là ça devient fou » qui réveille ceux qui décrochent.
- Le GAIN : la révélation qui surprend (le froid n'existe pas, c'est de la chaleur déplacée).
- La FIN boucle sur la première phrase : la dernière phrase appelle la première, on revoit sans s'en rendre compte. Jamais « abonne-toi » à la fin (ça casse la boucle).`;

const RYTHME = `LE RYTHME : JAMAIS UNE DEMI-SECONDE D'ENNUI
- Un événement visuel au moins toutes les 2 secondes : la caméra change d'angle, avance, recule, une pièce s'éclaire, une étiquette apparaît, un chiffre monte, une pièce s'écarte ou revient, un fluide change de couleur.
- Jamais plus de 3 secondes sur le même cadrage.
- Phrases courtes : 6 à 16 mots, une idée par phrase. On coupe tous les mots inutiles.
- Les mots forts entre *étoiles* (2 ou 3 par phrase au plus) : à l'écran ils grossissent, la caméra donne un petit coup de zoom dessus.
- Les chiffres vrais et concrets (80 °C, 3 000 tours par minute, 10 fois la pression d'un pneu) : ils s'affichent en grand et montent.
- Du contraste dans la voix : questions, exclamations rares mais placées, phrases très courtes après une longue.`;

const HUMOUR = `L'HUMOUR ET L'ACTUALITÉ
- Une touche d'humour toutes les 20 à 30 secondes environ, jamais au détriment de la clarté.
- On rit d'une SITUATION que tout le monde connaît (la pression avant les résultats, la salle de classe surchargée, la canicule, le bus en retard, le loyer), jamais d'une personne, d'un groupe, d'une origine ou d'une religion.
- L'actualité du pays est bienvenue dans la version de ce pays (une référence que tout le monde a vue passer cette semaine), sans jamais prendre parti, sans politique partisane, sans drame (mort, accident, guerre, attentat : jamais).
- Une blague doit servir l'explication : elle fait une image qui aide à comprendre (« plus de pression qu'un lycéen devant Parcoursup » fait sentir la pression).`;

const LANGUE = `LA LANGUE
- Parlée, au présent, à la deuxième personne (« ta clim », « your AC »), comme un créateur qui parle à un pote, pas comme un manuel.
- Pas de jargon sans l'expliquer en 4 mots. Pas de liste, pas de « premièrement, deuxièmement » lu à voix haute ; « étape un » est permis une fois.
- Chaque version de langue est écrite comme un créateur NATIF de ce pays, pas traduite : ses expressions, ses références, ses hashtags.
- Pas de tiret long, pas d'emoji dans le texte dit.`;

const INTERDITS = `CE QUI TUE UNE VIDÉO (À NE JAMAIS FAIRE)
- Une intro lente, un « bonjour », un « dans cette vidéo », un logo au début, un plan fixe au début.
- Répéter à la voix exactement le texte écrit à l'écran.
- Une phrase de plus de 20 mots. Un plan de plus de 3 secondes sans changement.
- Un chiffre faux ou inventé (les commentaires le voient, la crédibilité s'effondre et YouTube peut sanctionner).
- Finir sur « like et abonne-toi ». Finir sans boucle.
- Copier une vidéo existante (contenu non original : pas d'argent, et sanction).`;

const TOUT = [SIGNAUX, ACCROCHE, STRUCTURE, RYTHME, HUMOUR, LANGUE, INTERDITS].join('\n\n');

// La grille du prof du viral : 10 critères notés sur 10, pondérés
const GRILLE = [
  ['accroche', 'L\'accroche : trois accroches (image, texte, voix), comprise en 1,5 s, crée une question précise', 3],
  ['enjeu', 'L\'enjeu dans les 8 premières secondes : pourquoi ça me concerne', 1],
  ['boucles', 'Au moins 2 boucles ouvertes annoncées puis payées', 1.5],
  ['relance', 'Une relance vers le milieu', 1],
  ['rythme', 'Phrases de 6 à 16 mots, aucun temps mort, un événement visuel prévu toutes les 2 s', 2],
  ['concret', 'Chiffres vrais, images concrètes, mots forts marqués', 1],
  ['gain', 'Une révélation qui surprend', 1.5],
  ['fin', 'La fin boucle sur le début (on revoit)', 1.5],
  ['humour', 'Au moins une touche d\'humour juste, sans moquer personne', 0.5],
  ['clarte', 'Tout est compréhensible par un ado de 14 ans, rien de faux', 2]
];
const SEUIL_SCRIPT = 8.5;

function noteGrille(notes) {
  let t = 0, p = 0;
  GRILLE.forEach((g) => { const n = Math.max(0, Math.min(10, Number((notes || {})[g[0]]) || 0)); t += n * g[2]; p += g[2]; });
  return Math.round((t / p) * 10) / 10;
}

// Ce que l'image doit faire pour qu'on ne décroche jamais (Oscar et Vera)
const IMAGE = `L'IMAGE QUI TIENT LE REGARD
- Le premier plan est un gros plan sur la pièce la plus spectaculaire, déjà en mouvement, puis la caméra recule et révèle (mouvement « revele »).
- Chaque plan apporte un changement visible dans sa première demi-seconde : nouvel angle, pièce qui s'allume, fluide qui change de couleur, étiquette, pièce qui s'écarte (« eclater ») ou revient (« rassembler »).
- Un plan qui dure plus de 3 secondes change d'angle en son milieu (le moteur le fait seul, ou « puis » pour viser une autre pièce).
- La relance du milieu a un geste fort : « choc » (secousse brève), « plonge » (la caméra plonge dans la pièce), ou une vue éclatée.
- Les chiffres à l'écran montent tout seuls de 0 à leur valeur : un chiffre vrai par plan au plus, pas plus de 5 dans la vidéo.
- Le dernier plan ressemble au premier (même pièce, même angle) : la boucle se voit.`;

// Les règles apprises par le prof du viral (ses leçons) : tout le monde les lit avec la bible
async function lecons(db, n) {
  const l = await db.select('hq_knowledge', { eq: { agent_id: 'prof_viral' }, order: ['weight.desc', 'id.desc'], limit: n || 10 }).catch(() => []);
  return l.map((k) => '- ' + String(k.content).slice(0, 260)).join('\n');
}

// Un texte dit, sans les étoiles des mots forts (pour compter les mots)
const sansEtoiles = (s) => String(s || '').replace(/\*/g, '');
const mots = (s) => sansEtoiles(s).split(/\s+/).filter(Boolean).length;
// les passages entre étoiles d'une phrase
const forts = (s) => (String(s || '').match(/\*[^*]+\*/g) || []).length;

module.exports = { TOUT, SIGNAUX, ACCROCHE, STRUCTURE, RYTHME, HUMOUR, LANGUE, INTERDITS, IMAGE, GRILLE, SEUIL_SCRIPT, noteGrille, lecons, sansEtoiles, mots, forts };
