// Ce que l'équipe d'une créatrice sait des vidéos courtes qui marchent (TikTok, YouTube Shorts, Instagram Reels), quel
// que soit le sujet de sa chaîne. Une seule source : la plume écrit avec, la critique note avec, les idées en partent.
'use strict';

const SIGNAUX = `CE QUI FAIT POUSSER UNE VIDÉO COURTE
- Le taux de visionnage complet est roi : sous 40 % la vidéo meurt, au-dessus de 70 % elle part. Tout se joue sur les 2 premières secondes (YouTube compte chaque balayage comme un vote contre) puis sur le maintien jusqu'au bout.
- Le revisionnage pèse presque autant : une fin qui relance le début fait revoir sans qu'on s'en rende compte.
- Puis les partages et les enregistrements (plus forts que les likes), les commentaires, les abonnements.
- La vidéo est d'abord montrée à quelques centaines de personnes : si elles restent, elle est montrée à des milliers.`;

const ACCROCHE = `L'ACCROCHE (0 à 2 s)
- La voix : les 3 premiers mots portent la tension. Jamais « salut », « bonjour », « dans cette vidéo », « aujourd'hui je vais », « avez-vous déjà ».
- Le texte à l'écran (7 mots au plus) complète la voix sans la répéter mot pour mot.
- Elle crée UNE question précise dans la tête, que seule la suite répond, et se comprend en 1,5 s par quelqu'un qui ne connaît rien au sujet.
LES FAMILLES QUI MARCHENT
- La contradiction : « Le ciel n'est pas vraiment bleu. »
- Le chiffre choc : « 90 % des gens se brossent les dents trop fort. »
- L'erreur commune : « Arrête de mettre ton téléphone en charge la nuit. »
- L'enjeu caché : « Un seul détail décide si ton entretien est déjà perdu. »
- Le secret : « Personne ne t'explique pourquoi les avions sont blancs. »
- La promesse précise : « 3 phrases pour qu'on te prenne au sérieux au travail. »
- Le point de vue : « POV : tu es le dernier dinosaure sur Terre. »
- La comparaison absurde : « Ton cerveau consomme autant qu'une ampoule de frigo. »`;

const STRUCTURE = `LA STRUCTURE QUI GARDE LES GENS JUSQU'AU BOUT
- L'accroche (phrase 1).
- La promesse dans les 8 premières secondes : ce qu'on va comprendre, gagner, découvrir.
- Le cœur : une idée par phrase, chaque phrase fait avancer d'un cran ; du concret (exemples, chiffres vrais, images mentales).
- Au moins une BOUCLE OUVERTE : on annonce quelque chose pour plus tard (« mais le vrai piège arrive à la fin »), puis on le paie.
- Une RELANCE vers le milieu (« et c'est là que ça devient fou ») pour réveiller ceux qui décrochent.
- Le GAIN : la révélation, le conseil utilisable tout de suite, la chute.
- La FIN : elle boucle sur la première phrase (on revoit sans s'en rendre compte) ou pose une question qui fait commenter. Jamais « like et abonne-toi » à la fin.`;

const RYTHME = `LE RYTHME
- Phrases parlées de 6 à 18 mots, une idée chacune. On coupe tous les mots inutiles.
- Les mots forts entre *étoiles* (un ou deux par phrase au plus) : à l'écran, ils s'allument dans la couleur de la créatrice.
- Du contraste : une phrase très courte après une longue, une question, une exclamation rare mais placée.
- Le texte court à l'écran (2 à 5 mots) change à chaque phrase : il résume, il ne recopie pas.`;

const LANGUE = `LA LANGUE
- Parlée, au présent, à la deuxième personne (« tu »), comme une créatrice qui parle à une amie, jamais comme un manuel ou une publicité.
- Pas de jargon sans l'expliquer en quelques mots. Pas de liste lue à voix haute (« premièrement, deuxièmement »).
- Pas de tiret long, pas d'emoji, pas de hashtag dans le texte dit.`;

const INTERDITS = `CE QUI TUE UNE VIDÉO (JAMAIS)
- Une intro lente, un bonjour, un « dans cette vidéo ».
- Un chiffre faux, une citation ou une étude inventée (les commentaires le voient, et les plateformes sanctionnent).
- Des promesses de santé, de guérison, d'argent facile ; des conseils médicaux, juridiques ou financiers présentés comme sûrs.
- Ce qui est dangereux à reproduire, ce qui se moque d'une personne, d'un groupe, d'une origine ou d'une religion, la politique partisane.
- Copier une vidéo existante (contenu non original : pas d'argent, et sanction).`;

const IMAGES = `LES IMAGES (style « vidéos d'illustration »)
Chaque phrase est illustrée par une vidéo libre de droits trouvée dans une banque (Pexels), filmée en vertical si possible.
- Pour chaque phrase, une recherche EN ANGLAIS de 2 à 4 mots CONCRETS et FILMABLES : un sujet et une action ou un lieu (« woman pouring coffee », « city traffic night », « ocean waves aerial », « hands typing laptop »).
- Jamais de mots abstraits seuls (« success », « idea », « problem »), jamais de marque, de personne célèbre, de logo, de texte à l'écran, de film.
- Les images changent à chaque phrase et suivent ce qui est dit (une métaphore filmable est permise : « hourglass sand » pour le temps qui passe).
- La première image doit être la plus forte, déjà en mouvement.`;

const FORMATS = {
  court: { nom: 'court', phrases: '8 à 11 phrases', mots: '110 à 150 mots au total', duree: 'entre 35 et 50 secondes une fois dite', min: 8, max: 12 },
  long: { nom: 'long', phrases: '14 à 18 phrases', mots: '200 à 250 mots au total', duree: 'entre 65 et 80 secondes une fois dite (TikTok ne rémunère que les vidéos de plus d\'une minute)', min: 13, max: 20 }
};

// La grille de la critique : chaque critère noté sur 10, pondéré
const GRILLE = [
  ['accroche', 'L\'accroche : comprise en 1,5 s, crée une question précise, aucune intro', 3],
  ['promesse', 'La promesse dans les 8 premières secondes : on sait ce qu\'on va gagner', 1],
  ['rythme', 'Phrases courtes, une idée chacune, aucun temps mort, chaque phrase fait avancer', 2],
  ['boucles', 'Au moins une boucle ouverte annoncée puis payée, une relance au milieu', 1],
  ['gain', 'Une révélation, un conseil utilisable ou une chute qui récompense', 1.5],
  ['fin', 'La fin boucle sur le début ou fait commenter, sans « abonne-toi »', 1.5],
  ['clarte', 'Compréhensible par tout son public, rien de faux ni d\'inventé', 2],
  ['ton', 'Le ton de la chaîne et les consignes de la créatrice sont respectés', 1],
  ['images', 'Chaque phrase a une recherche d\'image concrète, filmable, juste (style vidéos d\'illustration)', 1]
];
const SEUIL = 7.5;
const REECRITURES_MAX = 2;

function note(notes, avecImages) {
  let t = 0, p = 0;
  GRILLE.forEach((g) => {
    if (g[0] === 'images' && !avecImages) return;
    const n = Math.max(0, Math.min(10, Number((notes || {})[g[0]]) || 0));
    t += n * g[2]; p += g[2];
  });
  return p ? Math.round((t / p) * 10) / 10 : 0;
}

const sansEtoiles = (s) => String(s || '').replace(/\*/g, '');
const mots = (s) => sansEtoiles(s).split(/\s+/).filter(Boolean).length;

// Les modèles de vidéo : des formats qui marchent, choisis en un geste au moment de créer. La structure va à Inès (la
// plume), l'exemple aide la créatrice à voir ce que ça donne.
const MODELES = {
  saviez: { nom: 'Le saviez-vous', court: 'Un fait fou, expliqué', exemple: 'Pourquoi les flamants roses sont roses', structure: 'Un fait surprenant annoncé dès la première phrase, puis l\'explication en trois ou quatre étapes simples, puis un dernier fait encore plus fou pour finir.' },
  top3: { nom: 'Top 3', court: 'Un classement, le meilleur à la fin', exemple: 'Les 3 animaux qui ne dorment presque jamais', structure: 'Un classement de trois, du moins fort au plus fort, annoncé dans l\'accroche ; chaque élément en une ou deux phrases avec un détail concret ; le numéro 1 garde la meilleure surprise.' },
  mythe: { nom: 'Mythe ou réalité', court: 'Une croyance, le verdict', exemple: 'Le chewing-gum avalé reste 7 ans dans le ventre ?', structure: 'Une croyance populaire posée en question, une phrase de suspense, le verdict (mythe ou réalité), puis la vraie explication et ce qu\'il faut retenir.' },
  pov: { nom: 'POV', court: 'Tu vis la scène', exemple: 'POV : tu es une goutte d\'eau dans un nuage', structure: 'Raconté à la deuxième personne et au présent, comme si on vivait la situation ; des sensations concrètes ; une fin qui surprend.' },
  histoire: { nom: 'Story time', court: 'Une histoire vraie qui rebondit', exemple: 'L\'homme qui a vendu la tour Eiffel deux fois', structure: 'Une histoire vraie racontée comme à une amie : le personnage et l\'enjeu dès le début, trois rebondissements, la chute.' },
  tuto: { nom: 'Tuto express', court: 'Le résultat, puis les étapes', exemple: 'Plier un t-shirt en 2 secondes', structure: 'Le résultat promis dans l\'accroche, puis des étapes très courtes et visuelles, puis l\'erreur à éviter.' },
  duel: { nom: 'Duel', court: 'Deux camps, trois manches', exemple: 'Chat contre chien : qui est le plus malin ?', structure: 'Deux camps qui s\'affrontent en trois manches, un score qui avance, un vainqueur, et une question au public : et toi, quel camp ?' },
  chiffres: { nom: 'En chiffres', court: 'Des nombres qui donnent le vertige', exemple: 'Ta vie en chiffres : combien de fois tu clignes des yeux', structure: 'Une suite de chiffres étonnants sur un même thème, du plus petit au plus énorme, chacun avec une image concrète pour se le représenter.' },
  avant: { nom: 'Avant / maintenant', court: 'Deux époques face à face', exemple: 'Se laver les dents au Moyen Âge, et aujourd\'hui', structure: 'Deux époques ou deux situations comparées point par point, en contraste fort, avec une conclusion inattendue.' },
  question: { nom: 'Question du jour', court: 'Une question que tout le monde se pose', exemple: 'Pourquoi on bâille quand les autres bâillent ?', structure: 'Une question que tout le monde s\'est déjà posée, la réponse simple et juste, puis une question au public pour faire réagir en commentaire.' }
};

module.exports = { SIGNAUX, ACCROCHE, STRUCTURE, RYTHME, LANGUE, INTERDITS, IMAGES, FORMATS, MODELES, GRILLE, SEUIL, REECRITURES_MAX, note, sansEtoiles, mots };
