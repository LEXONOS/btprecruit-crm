/* ═══════════════════════════════════════════════════════════════
   NOVALEM ACADÉMIE — CHAPITRE 1
   « Les Fondations du recrutement »
   ───────────────────────────────────────────────────────────────
   ⚠ ÉTAT : version extraite du formation.html historique.
   Cette première mouture sera enrichie lors de la Livraison 2
   (refonte du chapitre 1 + ajout des modules 1.6 « Le puzzle
   aveugle » et 1.7 « Code d'honneur Novalem »).

   Pour l'instant, on garde la matière existante intacte pour ne
   rien casser : les scouts qui ont déjà progressé conservent
   leurs XP et leurs scores sur les modules 1.1 à 1.5.
   ═══════════════════════════════════════════════════════════════ */

// MODULE 1.1 — BIENVENUE
// ═══════════════════════════════════════════════════════════════
MODULES['1.1'] = {
  num: 1, title: "Bienvenue",
  type: "Manifeste", duration: 3, xp: 30,
  lead: "Trois minutes pour comprendre dans quoi tu t'engages — vraiment.",
  hook: "Pourquoi un métier que presque personne ne comprend en est peut-être un des plus solides des dix prochaines années.",
  exercises: [
    {
      id: 'l1', type: 'lesson',
      title: "Tu viens d'ouvrir une porte",
      duration: 3,
      body: [
        { type:'p', text:"Il y a deux façons de lire cette académie. La première, c'est de cliquer, lire, cocher, valider. La seconde, c'est de comprendre qu'on ne forme pas ici <strong>des gens qui font du recrutement</strong> — on forme des gens qui <em>pensent</em> le recrutement." },
        { type:'p', text:"La nuance peut paraître subtile. Elle ne l'est pas. <strong>Un exécutant fait ce qu'on lui dit</strong>. Un scout comprend pourquoi. Et quand on comprend pourquoi, on devient difficile à remplacer." },
        { type:'highlight', title:"Ce que tu vas apprendre ici", text:"Comment le recrutement fonctionne vraiment, pourquoi les cabinets existent, comment se construit la valeur que tu vas vendre, et comment ta voix, ton temps et ta discipline deviennent tes outils principaux." },
        { type:'p', text:"L'académie se traverse chapitre par chapitre. Chaque module dure entre 5 et 15 minutes. Pas d'examen final, pas de date butoir, pas de pression. Mais un principe : les questions que tu rates reviennent, à J+1, J+3, J+7. Parce que la mémoire ne se construit pas à la lecture — elle se construit à la répétition." },
        { type:'p', text:"Commence quand tu veux. Reprends quand tu veux. Mais ne lâche pas. <em>Le jeu appartient à ceux qui restent.</em>" },
      ]
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 1.2 — POURQUOI LE RECRUTEMENT EXISTE
// ═══════════════════════════════════════════════════════════════
MODULES['1.2'] = {
  num: 2, title: "Pourquoi le recrutement existe",
  type: "Fondation", duration: 10, xp: 60,
  lead: "Le recrutement n'est pas une industrie — c'est une solution à un problème. Lequel ?",
  hook: "Et si les entreprises pouvaient recruter seules, pourquoi elles passent quand même par nous ?",
  exercises: [
    {
      id: 'l2', type: 'lesson',
      title: "Un problème aussi vieux que le travail",
      duration: 2,
      body: [
        { type:'p', text:"Le recrutement existe pour une raison simple : <strong>trouver la bonne personne pour un poste est extrêmement difficile</strong>. Pas parce qu'il n'y a personne. Parce que les bons sont rarement disponibles, souvent mal référencés, et coûtent cher à identifier." },
        { type:'p', text:"Une entreprise qui recrute doit poser trois questions : <strong>qui</strong> sait faire ce poste, <strong>où</strong> est cette personne aujourd'hui, et <strong>comment</strong> la convaincre de bouger. Chacune de ces questions demande des heures de travail — et un savoir-faire que peu de gens en interne possèdent." },
        { type:'highlight', title:"La vraie proposition de valeur", text:"Un cabinet de recrutement ne vend pas des candidats. Il vend du temps, de la précision, et de l'anti-risque. Retiens ça : temps, précision, risque." },
        { type:'p', text:"Dans les exercices qui suivent, on va te tester sur les cas où une entreprise a besoin d'un cabinet, les cas où elle n'en a pas besoin, et ce qu'elle achète réellement quand elle nous paie." },
      ]
    },
    {
      id:'e1', type:'qcm',
      prompt:"Quand une entreprise fait appel à un cabinet de recrutement, qu'est-ce qu'elle achète en priorité ?",
      options:["Un candidat","Du temps, de la précision et de l'anti-risque","Un CV validé","Un réseau"],
      correct:1,
      explain:"Le candidat est le livrable. Ce que le client paie vraiment, c'est <strong>le temps qu'il ne va pas perdre</strong>, la précision du ciblage, et le fait qu'un mauvais recrutement coûte très cher — donc on réduit ce risque.",
      bonus:"Un directeur RH te dira rarement « j'achète du temps ». Il dira « je n'ai pas la bande passante ». C'est la même chose — formulée différemment."
    },
    {
      id:'e2', type:'tf',
      prompt:"Une entreprise qui a un bon service RH n'a jamais besoin d'un cabinet de recrutement.",
      answer:false,
      explain:"Faux. Même les meilleures équipes RH passent par des cabinets sur des postes pénuriques, urgents, ou confidentiels. La qualité interne et l'usage d'un cabinet ne s'opposent pas — ils se complètent.",
      bonus:"Les plus gros clients cabinets sont souvent les entreprises qui ont les meilleurs RH. Parce que ces RH savent justement quand déléguer."
    },
    {
      id:'e3', type:'classify',
      prompt:"Classe ces situations : cabinet pertinent, ou pas nécessaire ?",
      categories:["Cabinet pertinent", "Interne suffit"],
      items:[
        { text:"Recruter 12 commerciaux juniors en CDI avec un budget marketing", cat:1 },
        { text:"Trouver un directeur financier dans une zone géographique pénurique", cat:0 },
        { text:"Remplacer un stagiaire qui part en septembre", cat:1 },
        { text:"Recruter en confidentiel un remplaçant à un poste encore occupé", cat:0 },
        { text:"Ouvrir un poste classique avec 200 candidatures par semaine sur le jobboard", cat:1 },
        { text:"Chasser un profil qui n'est pas en recherche active", cat:0 },
      ],
      explain:"Un cabinet apporte de la valeur quand le profil est rare, le processus confidentiel, la zone pénurique, ou le poste critique. Pour des postes à fort volume de candidatures entrantes, l'interne est souvent suffisant — et moins cher.",
      bonus:"Règle simple : <strong>si le client peut se servir d'un formulaire et remplir son poste en 2 semaines, il n'a pas besoin de toi</strong>. Ton terrain, c'est la pénurie."
    },
    {
      id:'e4', type:'multi',
      prompt:"Quelles raisons poussent une entreprise à passer par un cabinet ? (plusieurs réponses)",
      options:[
        "Le temps RH est limité et le poste est prioritaire",
        "Le poste est confidentiel et ne peut pas être affiché",
        "Le profil ciblé est rare et difficile à approcher",
        "L'entreprise veut obtenir un meilleur prix qu'en interne",
        "Un mauvais recrutement coûterait très cher et l'entreprise veut du filtre",
      ],
      correct:[0,1,2,4],
      explain:"Temps, confidentialité, rareté du profil, et réduction du risque. Le prix, lui, n'est jamais un moteur — un cabinet coûte toujours plus cher qu'un recrutement interne simple. On nous appelle <em>malgré</em> le prix, pas à cause de lui.",
      bonus:"Si un client négocie uniquement sur le prix, c'est un signal : soit il n'a pas compris ta valeur, soit il n'avait pas réellement besoin de toi."
    },
    {
      id:'e5', type:'fill',
      prompt:"Complète cette phrase fondamentale sur le métier :",
      text:"Un cabinet ne vend pas des candidats. Un cabinet vend de la ___ résolue.",
      choices:["pénurie", "chance", "opinion", "stratégie"],
      correct:0,
      explain:"Tu vends de la pénurie résolue. Ton client a un problème (un poste vide) causé par une pénurie (pas assez de profils disponibles, ou pas accessibles). Tu résous cette pénurie. C'est le cadrage mental à avoir.",
      bonus:"Cette formulation change ta posture commerciale : tu n'es pas en train de vendre un produit, tu es en train de <strong>résoudre un manque</strong>. Le client n'achète pas — il se soigne."
    },
    {
      id:'e6', type:'scenario',
      prompt:"Que fais-tu ?",
      context:"Un prospect te dit : « Vos honoraires sont trop chers, on va passer par une annonce Indeed. » Tu lui réponds quoi ?",
      options:[
        "« Je comprends, bonne chance. »",
        "« On peut s'aligner si vous voulez. »",
        "« Tout dépend du coût d'un mauvais recrutement pour vous. Sur ce poste, combien coûterait une erreur ? »",
        "« Indeed c'est bien pour les postes faciles, je vous laisse essayer. »",
      ],
      correct:2,
      explain:"La bonne réponse recadre le sujet : <strong>le prix n'est pas un coût, c'est une assurance</strong>. Tu remets le client face à la question qu'il n'a pas envie de se poser — combien coûte une erreur ? Un mauvais recrutement se chiffre typiquement entre 30% et 200% du salaire annuel du poste.",
      bonus:"Un bon scout ne baisse jamais ses honoraires pour gagner un dossier. Il change de terrain : il passe du prix à la valeur."
    },
    {
      id:'e7', type:'qcm',
      prompt:"Combien coûte en moyenne un mauvais recrutement (estimation conservatrice) ?",
      options:["Quelques centaines d'euros","Environ un mois de salaire","Entre 30% et 200% du salaire annuel","Toujours plus de 100 000 €"],
      correct:2,
      explain:"Entre 30% et 200% du salaire brut annuel, selon le poste. Pour un conducteur de travaux à 50K€, une erreur peut coûter 15K€ à 100K€ — entre salaires versés, temps RH, perte de productivité de l'équipe, onboarding perdu. C'est l'argument qui rend tes honoraires raisonnables.",
      bonus:"Étude Harvard Business Review : 80% des turnovers sont dus à des erreurs de recrutement initiales. Le coût caché le plus souvent sous-estimé : l'impact moral sur l'équipe autour."
    },
    {
      id:'e8', type:'order',
      prompt:"Remets dans l'ordre les étapes du problème que résout un cabinet :",
      items:[
        "L'entreprise identifie un besoin de recruter",
        "Elle découvre que le profil est rare ou que son temps RH est saturé",
        "Elle fait appel à un cabinet",
        "Le cabinet trouve et qualifie des candidats",
        "L'entreprise recrute sans avoir perdu son temps",
      ],
      explain:"C'est exactement cet enchaînement qu'il faut avoir en tête. Ton entrée dans le processus se fait à l'étape 3, mais tu dois comprendre ce qui s'est passé avant (besoin, saturation) pour parler le bon langage.",
      bonus:"Une bonne question à poser à un prospect en entretien : <em>« À quel moment vous êtes-vous dit qu'un cabinet serait utile ? »</em>. Sa réponse te dit exactement où il en est dans le processus."
    },
    {
      id:'e9', type:'tf',
      prompt:"Les cabinets de recrutement vont disparaître à cause des outils d'IA et des plateformes automatisées.",
      answer:false,
      explain:"Faux. L'IA facilite le sourcing brut (trier 10 000 CV), mais elle ne <strong>convainc pas un candidat passif de bouger</strong>. Ce moment-là — la conversation humaine qui transforme un « non merci » en un oui — reste le vrai métier. L'IA accélère nos outils, elle ne remplace pas le scout.",
      bonus:"Les cabinets qui disparaissent sont ceux qui faisaient déjà du tri basique. Ceux qui font de la vraie chasse et de la vraie qualification se renforcent — parce que leur valeur devient plus visible."
    },
    {
      id:'e10', type:'qcm',
      prompt:"Quelle phrase résume le mieux ta future posture face à un client ?",
      options:["Je vends des CV","Je résous une pénurie précise contre des honoraires","Je propose des candidats au meilleur prix","Je fais de la pub pour votre offre"],
      correct:1,
      explain:"« Je résous une pénurie précise contre des honoraires. » Précise, parce que tu ne traites pas n'importe quel poste. Contre des honoraires, parce que tu n'es pas une œuvre caritative. Cette phrase te protège de toutes les dérives : briefs flous, honoraires négociés à la baisse, demandes en-dehors de ta spécialité.",
      bonus:"Un scout mature apprend à dire non. Refuser un dossier mal cadré est souvent plus rentable que le prendre. <em>Tout dossier pris est un dossier dû.</em>"
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 1.3 — L'ÉCOSYSTÈME À 3 ACTEURS
// ═══════════════════════════════════════════════════════════════
MODULES['1.3'] = {
  num: 3, title: "L'écosystème à trois acteurs",
  type: "Fondation", duration: 12, xp: 70,
  lead: "Candidat, entreprise, cabinet — chacun a ses peurs, ses leviers, sa logique. Si tu comprends les trois, tu deviens indispensable.",
  hook: "La plupart des scouts débutants pensent qu'ils vendent à l'entreprise. Ils se trompent — ils vendent aussi au candidat. Et parfois plus durement.",
  exercises: [
    {
      id:'l3', type:'lesson',
      title:"Trois acteurs, trois langues, un seul pont",
      duration:3,
      body:[
        { type:'p', text:"Dans chaque dossier tu as trois acteurs : <strong>le candidat</strong>, <strong>l'entreprise</strong>, <strong>toi (le cabinet)</strong>. Chacun a sa peur principale, son levier principal, et sa manière de parler." },
        { type:'p', text:"<strong>Le candidat</strong> a peur de se tromper de poste, d'être manipulé, de perdre sa stabilité pour rien. Son levier : <em>un projet qui donne envie</em>. Pas un salaire. Pas un titre. Un projet." },
        { type:'p', text:"<strong>L'entreprise</strong> a peur de recruter mal, de perdre des mois sur un mauvais profil, de passer pour une boîte qui n'arrive pas à retenir. Son levier : <em>la certitude</em>. Pas le prix. Pas la rapidité brute. La certitude qu'on ne lui fait pas perdre son temps." },
        { type:'p', text:"<strong>Toi</strong>, tu es le pont. Tu traduis dans les deux sens. Tu rassures des deux côtés. Tu portes la confiance de l'un à l'autre. <em>Sans toi, ils ne se parleraient pas.</em>" },
        { type:'highlight', title:"Le déclic à avoir", text:"Tu ne travailles pas pour l'entreprise. Tu ne travailles pas pour le candidat. Tu travailles pour le match — la rencontre réussie. C'est une posture à part." },
      ]
    },
    {
      id:'e11', type:'match',
      prompt:"Associe chaque acteur à sa peur principale :",
      pairs:[
        ["Le candidat", "Se tromper de poste et perdre sa stabilité"],
        ["L'entreprise", "Recruter mal et perdre des mois"],
        ["Le cabinet", "Perdre un dossier en cours par manque de suivi"],
      ],
      explain:"Chacun a sa peur dominante. Le candidat protège sa vie, l'entreprise protège son budget et son équipe, toi tu protèges ton pipeline et ta réputation. Reconnaître la peur de l'autre, c'est déjà commencer à la rassurer.",
      bonus:"En entretien candidat, une phrase qui marche souvent : « Qu'est-ce qui vous ferait regretter ce changement dans six mois ? » — tu vas chercher sa peur, pour pouvoir la traiter."
    },
    {
      id:'e12', type:'qcm',
      prompt:"Qu'est-ce qui motive le plus souvent un candidat à quitter un poste qu'il occupe déjà ?",
      options:["Le salaire, uniquement","Un projet ou une perspective qui donne envie, plus qu'un simple salaire","Un titre plus prestigieux","La proximité géographique"],
      correct:1,
      explain:"Études Gallup & LinkedIn répétées : le salaire est rarement le <em>vrai</em> déclencheur — même s'il est souvent celui qu'on évoque publiquement. Ce qui fait bouger un candidat, c'est un <strong>projet, une évolution, une équipe, un sens</strong>. Le salaire est une condition, pas un moteur.",
      bonus:"Un scout qui argumente uniquement sur le salaire perd systématiquement face à un scout qui construit un récit sur le projet. Même avec une offre financière inférieure."
    },
    {
      id:'e13', type:'tf',
      prompt:"En tant que scout, tu dois défendre en priorité les intérêts de l'entreprise qui te paie.",
      answer:false,
      explain:"Faux — et c'est un piège classique. Si tu ne défends que l'entreprise, tu pousses des profils à accepter des postes qui ne leur conviennent pas, ils partent en quelques mois, et l'entreprise te reproche le mauvais recrutement. Tu dois défendre <strong>la qualité du match</strong>. C'est ça que l'entreprise achète réellement.",
      bonus:"Les meilleurs cabinets refusent parfois de présenter un candidat, même quand le client insiste, parce qu'ils savent que le match ne tiendra pas. C'est contre-intuitif mais c'est ce qui construit une réputation solide sur dix ans."
    },
    {
      id:'e14', type:'classify',
      prompt:"Pour chaque phrase, qui parle ?",
      categories:["Candidat", "Client (entreprise)"],
      items:[
        { text:"« J'ai besoin de quelqu'un pour hier, mon équipe est sous l'eau. »", cat:1 },
        { text:"« Je ne suis pas forcément en recherche, mais j'écoute. »", cat:0 },
        { text:"« On a déjà eu des déceptions avec deux cabinets l'année dernière. »", cat:1 },
        { text:"« J'aimerais comprendre qui sera mon manager direct. »", cat:0 },
        { text:"« Envoyez-moi trois profils sous 15 jours. »", cat:1 },
        { text:"« Quel type d'évolution est possible sur 3 ans ? »", cat:0 },
      ],
      explain:"Reconnaître le langage de chacun est un réflexe. Les candidats parlent manager, évolution, projet. Les entreprises parlent délais, profils, résultats. Si tu confonds, tu parles la mauvaise langue au mauvais moment.",
      bonus:"Quand un candidat te demande « quel est le salaire ? » en première question, c'est rarement un bon signal. Les meilleurs profils commencent toujours par le projet."
    },
    {
      id:'e15', type:'scenario',
      prompt:"Que fais-tu ?",
      context:"Un candidat excellent te dit en entretien qu'il a aussi un process chez un concurrent de ton client. Tu apprends que ton client va lui faire une offre demain. Que fais-tu ?",
      options:[
        "Tu caches l'info à ton client pour le laisser faire son offre sans pression",
        "Tu préviens ton client que le candidat est en process ailleurs — c'est une info utile pour son offre et son timing",
        "Tu essaies de convaincre le candidat d'arrêter l'autre process",
        "Tu retardes l'offre de ton client pour gagner du temps",
      ],
      correct:1,
      explain:"Tu préviens ton client. <strong>La transparence est ta meilleure assurance long terme.</strong> Un client qui découvre plus tard que tu lui as caché une concurrence ne te redonnera pas de dossier. Par contre, le client qui t'achète l'info et aligne son offre en conséquence te respecte — et revient.",
      bonus:"Un mantra utile : « ce que tu caches aujourd'hui te coûte dix fois plus demain ». Même vrai au téléphone, en entretien, dans les emails."
    },
    {
      id:'e16', type:'qcm',
      prompt:"Qu'est-ce que l'entreprise achète vraiment quand elle te signe un mandat ?",
      options:["Ton temps à chercher","Un CV acceptable à moindre coût","La certitude qu'elle ne fera pas d'erreur sur un poste qu'elle ne maîtrise pas","Ton réseau social"],
      correct:2,
      explain:"La certitude. C'est ce qu'on vend, ce qu'on facture, et ce qui justifie les honoraires. Un directeur paie pour <strong>arrêter de s'inquiéter</strong> d'un poste qu'il n'arrive pas à pourvoir seul. Tout le reste (ton temps, ton réseau) est un moyen — pas le produit fini.",
      bonus:"La phrase commerciale qui marche : « Je ne peux pas vous garantir un placement, mais je peux vous garantir de ne plus perdre une minute là-dessus tant qu'on cherche ensemble. »"
    },
    {
      id:'e17', type:'fill',
      prompt:"Complète cette phrase stratégique :",
      text:"Un scout ne travaille ni pour le candidat, ni pour l'entreprise. Il travaille pour le ___.",
      choices:["match", "salaire", "cabinet", "CRM"],
      correct:0,
      explain:"Pour le match. C'est la posture neutre qui te protège. Si tu travailles pour le candidat, tu pousses des offres marginales à ton client. Si tu travailles pour l'entreprise, tu forces des profils qui ne conviennent pas. Si tu travailles pour le match — la rencontre qui tient — tu protèges les trois intérêts.",
      bonus:"Cette posture est la seule qui reste rentable sur dix ans. Les scouts qui vendent des placements forcés disparaissent en deux ou trois ans."
    },
    {
      id:'e18', type:'multi',
      prompt:"Un candidat te demande « vous êtes payé par qui ? ». Que peux-tu lui répondre ? (plusieurs réponses correctes)",
      options:[
        "« Par l'entreprise qui m'a mandaté — vous ne me coûtez rien. »",
        "« C'est confidentiel. »",
        "« Par l'entreprise, et c'est important que vous le sachiez : je ne placerai jamais quelqu'un qui n'est pas fait pour le poste, parce que c'est ma réputation qui est en jeu. »",
        "« Par personne, je travaille gratuitement. »",
      ],
      correct:[0,2],
      explain:"Réponses correctes : 1 et 3. Tu assumes qui te paie, parce que la loi l'exige (un candidat ne paie jamais un cabinet) et parce que la transparence construit la confiance. Tu peux aussi ajouter que ta réputation te protège contre les placements forcés — ça rassure le candidat sur ta neutralité.",
      bonus:"Article L5324-1 du Code du travail : facturer un candidat est interdit, même pour des frais annexes. C'est une ligne rouge absolue en France."
    },
    {
      id:'e19', type:'order',
      prompt:"Remets dans l'ordre le parcours typique d'un dossier :",
      items:[
        "Le client signe un mandat avec le cabinet",
        "Le scout sourcera et qualifie des candidats",
        "Les candidats sont présentés au client",
        "Le client reçoit les candidats en entretien",
        "Le client fait une offre au candidat retenu",
        "Le candidat prend ses fonctions et la période d'essai commence",
      ],
      explain:"C'est la chaîne standard. Chaque étape peut durer de quelques jours à plusieurs semaines. Un scout efficace comprend où le dossier est à chaque instant, et sait quelle étape débloquer en priorité.",
      bonus:"Règle : <strong>la période d'essai fait partie de ta mission</strong>. Tant que le candidat n'est pas confirmé après sa période d'essai, ton dossier n'est pas clos. Tu restes en contact avec lui et avec le client."
    },
    {
      id:'e20', type:'qcm',
      prompt:"Sur quelle métrique un bon scout est-il évalué long terme ?",
      options:["Le nombre de candidats dans son CRM","Le nombre d'appels par jour","Le taux de candidats qui restent en poste après 12 mois","Le prix moyen de ses honoraires"],
      correct:2,
      explain:"Le taux de rétention à 12 mois. Un placement qui tient, c'est un client qui revient et qui recommande. Les autres métriques (CRM, appels, honoraires) sont des moyens pour y arriver — pas le résultat final. C'est la différence entre un scout transactionnel et un scout de carrière.",
      bonus:"Les meilleurs cabinets suivent ce chiffre publiquement. Taux de rétention à 12 mois au-dessus de 85% = référence reconnue du marché."
    },
    {
      id:'e21', type:'tf',
      prompt:"Un bon scout doit développer une forme d'empathie stratégique : sentir ce que ressentent les deux côtés à tout moment.",
      answer:true,
      explain:"Vrai. L'empathie stratégique — la capacité à sentir l'état émotionnel de l'autre et à en tenir compte — est ce qui sépare un vendeur d'un conseiller. Ce n'est pas de la sensiblerie : c'est un outil de précision. Un candidat qui dit « c'est intéressant » sur un ton plat te dit « non » sans le dire.",
      bonus:"Exercice utile : après chaque appel, noter en une phrase <em>ce que la personne ressentait</em>, pas seulement ce qu'elle a dit. Cette pratique, faite 100 fois, transforme ton écoute."
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 1.4 — L'ÉCONOMIE DU RECRUTEMENT
// ═══════════════════════════════════════════════════════════════
MODULES['1.4'] = {
  num: 4, title: "L'économie du recrutement",
  type: "Fondation", duration: 10, xp: 65,
  lead: "Qui paie quoi, pourquoi, et combien. Les chiffres qu'un scout doit connaître par cœur.",
  hook: "Un cabinet facture entre 15 et 25% d'un salaire annuel. Pour un seul candidat placé. Pourquoi les entreprises acceptent ?",
  exercises: [
    {
      id:'l4', type:'lesson',
      title:"Les chiffres qui définissent le métier",
      duration:3,
      body:[
        { type:'p', text:"Le marché français du recrutement par cabinet pèse <strong>environ 4 milliards d'euros</strong>. Les acteurs vont des gros chasseurs de têtes internationaux (Spencer Stuart, Egon Zehnder) aux cabinets indépendants spécialisés." },
        { type:'p', text:"Le modèle de facturation standard : <strong>entre 15 et 25% du salaire brut annuel du candidat placé</strong>. Pour un cadre à 50K€, ça fait 7 500€ à 12 500€ d'honoraires pour un seul placement." },
        { type:'p', text:"Pourquoi un client accepte ? Parce qu'un mauvais recrutement coûte entre 30% et 200% du salaire annuel (temps RH, salaires versés, impact équipe, onboarding perdu). Nos honoraires sont donc <em>une assurance</em>, pas un coût brut." },
        { type:'highlight', title:"Les trois types de contrats", text:"Success fee (honoraires à la signature, 80% du marché), retainer (honoraires répartis sur le process), exclusif (tarif plus élevé mais engagement garanti de ta part). Le success fee est le plus risqué pour le cabinet — mais le plus vendu." },
      ]
    },
    {
      id:'e22', type:'qcm',
      prompt:"Marge de facturation standard d'un cabinet sur un placement :",
      options:["5-10% du salaire","10-15% du salaire","15-25% du salaire brut annuel","30-40% du salaire brut annuel"],
      correct:2,
      explain:"Entre 15 et 25% du salaire brut annuel. 15% pour les profils courants, 20% pour les postes techniques ou pénuriques, 25%+ pour les cadres dirigeants ou les chasses complexes. En-dessous de 15%, tu es en train de te brader.",
      bonus:"Règle : si ton honoraire est trop bas, le client pense que tu n'es pas spécialiste. Un cabinet qui baisse ses prix perd de la valeur perçue, pas l'inverse."
    },
    {
      id:'e23', type:'qcm',
      prompt:"Pour un conducteur de travaux placé à 48 000€ brut annuel, avec 18% d'honoraires, ça fait :",
      options:["4 800€","8 640€","12 000€","18 000€"],
      correct:1,
      explain:"48 000 × 18% = 8 640€. À connaître : savoir calculer mentalement des honoraires en une ou deux secondes pendant un appel client. Entraîne-toi sur 18% et 20% des multiples de 10 000 — c'est ta table de multiplication.",
      bonus:"Raccourci pour 18% : prends 20% (facile) et retire 10%. 50K × 20% = 10K, moins 10% (1K) = 9K. Proche de 8,64K en quelques secondes."
    },
    {
      id:'e24', type:'tf',
      prompt:"Un candidat peut être facturé pour des prestations annexes (conseil carrière, relecture CV) par le cabinet qui le place.",
      answer:false,
      explain:"Faux, strictement interdit. Article L5324-1 du Code du travail : aucun frais ne peut être facturé à un candidat, quelle que soit la forme. Cette règle est absolue et engage la responsabilité pénale du cabinet.",
      bonus:"Certains cabinets peu scrupuleux contournent en créant une filiale « coaching ». C'est juridiquement fragile et moralement inacceptable. Ne joue jamais à ça."
    },
    {
      id:'e25', type:'order',
      prompt:"Remets dans l'ordre un cycle de facturation standard :",
      items:[
        "Signature du mandat avec le client",
        "Sourcing et qualification de candidats",
        "Présentation au client",
        "Entretiens client-candidat",
        "Signature de l'embauche (promesse ou contrat)",
        "Émission de la facture du cabinet",
        "Paiement par le client (sous 30 à 60 jours)",
        "Fin de période d'essai validée — dossier clos",
      ],
      explain:"Le moment clé pour facturer : <strong>la signature de la promesse d'embauche</strong>. Pas la prise de poste (qui peut être reportée), pas l'offre verbale (trop flou). Le cash arrive entre 30 et 60 jours plus tard selon le contrat signé.",
      bonus:"Clause à exiger dans tous tes mandats : <em>« facturation à la signature, avec garantie de remplacement gratuite si le candidat part pendant sa période d'essai »</em>. C'est le standard du marché et ça te protège."
    },
    {
      id:'e26', type:'match',
      prompt:"Associe chaque type de mission à son modèle économique :",
      pairs:[
        ["Recrutement standard (volume)", "Success fee — payé à la signature"],
        ["Chasse complexe (cadre dirigeant)", "Retainer — honoraires étalés"],
        ["Mission exclusive avec engagement fort", "Exclusif — honoraires majorés"],
      ],
      explain:"Trois modèles, trois niveaux de risque et d'engagement. Success fee : le plus vendu, le plus risqué pour le cabinet. Retainer : plus sûr mais demande de justifier l'investissement étape par étape. Exclusif : la meilleure relation client possible — le client s'engage à ne passer que par toi.",
      bonus:"Règle : essaie de faire basculer tes gros clients vers du retainer ou de l'exclusif. Un success fee pur c'est du freelance avec tout le risque côté cabinet."
    },
    {
      id:'e27', type:'scenario',
      prompt:"Que fais-tu ?",
      context:"Un prospect te demande un tarif à 10% « pour voir ». Tu sens qu'il teste plusieurs cabinets en parallèle. Comment réagis-tu ?",
      options:[
        "Tu acceptes à 10% pour avoir le dossier et faire tes preuves",
        "Tu proposes 10% mais en success fee seulement, sans exclusivité",
        "Tu refuses et expliques pourquoi ton tarif est à 18% — si ça ne passe pas, tu laisses",
        "Tu proposes 15% et tu espères un oui",
      ],
      correct:2,
      explain:"Tu refuses. Un prospect qui fait jouer plusieurs cabinets en parallèle à 10% cherche du volume low-cost — pas de la qualité. Accepter c'est <strong>signaler que tu n'es pas spécialiste</strong>. Dire non te place comme pro, et la moitié du temps le client revient deux mois plus tard en acceptant ton prix.",
      bonus:"Les scouts qui pratiquent le « non cadré » (refuser proprement, expliquer pourquoi, rester en bon terme) signent plus de dossiers long terme que ceux qui acceptent tout au rabais."
    },
    {
      id:'e28', type:'qcm',
      prompt:"Coût typique pour une entreprise d'un mauvais recrutement (profil cadre) :",
      options:["Environ un mois de salaire","Entre 10% et 20% du salaire annuel","Entre 30% et 200% du salaire annuel","Plus de 500 000€"],
      correct:2,
      explain:"30 à 200% du salaire annuel. Pour un cadre à 60K€, c'est entre 18K€ et 120K€ de coût caché : salaires versés, onboarding perdu, temps management, impact équipe, processus de remplacement. Ce chiffre est ta meilleure arme pour justifier tes honoraires.",
      bonus:"Étude INSEE : le coût moyen d'un mauvais recrutement en France est de 45 000€ tout compris. À connaître et à ressortir à bon escient — pas comme un épouvantail, comme une donnée."
    },
    {
      id:'e29', type:'multi',
      prompt:"Quelles clauses doivent absolument figurer dans un mandat de recrutement ? (plusieurs réponses)",
      options:[
        "Montant et base de calcul des honoraires",
        "Garantie de remplacement si départ pendant la période d'essai",
        "Délai de paiement",
        "Engagement d'exclusivité du cabinet sur le poste",
        "Obligation pour le candidat de rester 2 ans minimum",
      ],
      correct:[0,1,2],
      explain:"Les trois indispensables : honoraires, garantie de remplacement, délai de paiement. L'exclusivité est un plus si tu peux l'obtenir, mais pas indispensable. <strong>La 5 est illégale</strong> — on ne peut pas contraindre un candidat à rester, ce serait une atteinte à la liberté du travail.",
      bonus:"Une garantie de remplacement standard : 3 mois à 6 mois après la prise de poste. Tu remplaces gratuitement ou tu rembourses. C'est ton engagement qualité — et ton meilleur argument commercial."
    },
    {
      id:'e30', type:'fill',
      prompt:"Complète cette règle d'or financière :",
      text:"Un cabinet qui baisse ses honoraires pour gagner un dossier perd ___, pas l'inverse.",
      choices:["de la valeur perçue","du volume","du temps","un client"],
      correct:0,
      explain:"De la valeur perçue. Quand tu baisses ton prix, le client conclut que tu n'étais pas indispensable à ce prix-là. Tu deviens une commodité — remplaçable. Les cabinets qui tiennent leurs tarifs gagnent en réputation ; ceux qui bradent perdent leurs meilleurs clients au profit de concurrents qui assument leur valeur.",
      bonus:"Variante utile : si tu <em>dois</em> bouger sur le prix, ne baisse pas tes honoraires — modifie la prestation (moins de candidats présentés, délai plus long, garantie réduite). Ça garde ta valeur et ça cadre l'échange."
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 1.5 — PSYCHOLOGIE DU CANDIDAT
// ═══════════════════════════════════════════════════════════════
MODULES['1.5'] = {
  num: 5, title: "Psychologie du candidat",
  type: "Fondation", duration: 12, xp: 80,
  lead: "Sept raisons font bouger un candidat. Aucune n'est le salaire — en tout cas pas en premier.",
  hook: "Pourquoi le meilleur profil du marché accepte parfois une baisse de salaire pour changer de boîte ? Tu vas comprendre.",
  exercises: [
    {
      id:'l5', type:'lesson',
      title:"Les sept raisons de bouger",
      duration:4,
      body:[
        { type:'p', text:"Quand un candidat bouge, il y a toujours une raison principale et deux ou trois secondaires. Les scouts débutants demandent « quel salaire ? » en premier. Les scouts expérimentés posent la vraie question : « qu'est-ce qui vous manque aujourd'hui ? »." },
        { type:'p', text:"Les sept moteurs principaux, par ordre de fréquence observée :" },
        { type:'p', text:"<strong>1. Reconnaissance insuffisante</strong> — le candidat fait bien son job mais personne ne le voit. C'est le plus sous-estimé des moteurs. <strong>2. Manque de sens ou de projet</strong> — l'entreprise n'a plus de cap ou le poste n'évolue plus. <strong>3. Manager toxique ou absent</strong> — rarement évoqué directement, mais souvent présent en creux." },
        { type:'p', text:"<strong>4. Salaire</strong> — oui, il est là, mais presque jamais en cause principale. <strong>5. Localisation</strong> — changement de vie perso, déménagement, équilibre. <strong>6. Évolution bloquée</strong> — plafond de verre visible. <strong>7. Envie de changement pur</strong> — après 5-7 ans au même endroit." },
        { type:'highlight', title:"La règle d'or de l'entretien", text:"Ne demande jamais « pourquoi vous voulez changer ? ». Demande « qu'est-ce qui vous ferait rester si vous receviez une contre-offre ? ». La réponse te dit le vrai sujet — celui qu'il faut traiter." },
      ]
    },
    {
      id:'e31', type:'qcm',
      prompt:"Première raison (la plus fréquente) de départ volontaire chez les cadres français :",
      options:["Le salaire","Le manque de reconnaissance ou de perspective","La distance domicile-travail","La charge de travail"],
      correct:1,
      explain:"Reconnaissance et perspective — environ 40% des départs dans les études récentes (Apec, LinkedIn Talent, Robert Half). Le salaire arrive en 3ème ou 4ème position. Les candidats évoquent souvent le salaire comme raison <em>parce que c'est socialement acceptable</em>, pas parce que c'est le vrai moteur.",
      bonus:"Question à poser systématiquement : « Sur une échelle de 1 à 10, à quel point vous sentez-vous reconnu dans votre poste actuel ? ». Réponse sous 7 = signal fort."
    },
    {
      id:'e32', type:'tf',
      prompt:"Un candidat qui dit « je suis bien dans ma boîte, je ne cherche pas » est un mauvais candidat.",
      answer:false,
      explain:"Faux — c'est souvent exactement l'inverse. Les <strong>candidats passifs</strong> (pas en recherche active) représentent 70% du marché et sont généralement les meilleurs profils. Ils sont stables, performants, et donc recherchés par les entreprises qui savent que la rareté est leur meilleur investissement.",
      bonus:"Le candidat qui « cherche activement depuis 6 mois sans trouver » est presque toujours le signal inverse — quelque chose ne passe pas dans ses entretiens. Creuse avant d'investir du temps."
    },
    {
      id:'e33', type:'match',
      prompt:"Associe chaque phrase de candidat à la vraie raison qui se cache derrière :",
      pairs:[
        ["« Je cherche une boîte avec plus de sens »", "Manque de reconnaissance ou projet flou"],
        ["« Je veux évoluer »", "Perspective bloquée ou plafond de verre"],
        ["« J'aimerais un meilleur équilibre »", "Charge ou management difficile"],
        ["« Je veux un salaire à la hauteur »", "Dévalorisation ressentie"],
      ],
      explain:"Ce que les candidats disent n'est jamais exactement ce qu'ils pensent. « Plus de sens » = souvent « mon manager ne me remercie jamais ». « Salaire à la hauteur » = « je ne me sens pas à ma valeur ». Ton travail, c'est de décoder — pas de prendre au pied de la lettre.",
      bonus:"Astuce : quand un candidat évoque le salaire en 1ère position, c'est rarement que le salaire qui pose problème. Pose la question : « si le salaire était ok, qu'est-ce qui resterait à régler ? ». Là tu as le vrai sujet."
    },
    {
      id:'e34', type:'scenario',
      prompt:"Que fais-tu ?",
      context:"Un candidat excellent te dit : « Je gagne 55K chez mon employeur actuel, je veux au moins 65K pour bouger. » Que lui réponds-tu ?",
      options:[
        "« OK, je vais chercher uniquement des postes à 65K+. »",
        "« Si le salaire était ok, qu'est-ce qui vous ferait rester là où vous êtes aujourd'hui ? »",
        "« C'est beaucoup, il faudra baisser. »",
        "« Je vais vous proposer 62K, c'est correct. »",
      ],
      correct:1,
      explain:"La bonne réponse creuse. Tu ne contestes pas le chiffre — tu déplaces la conversation vers ce qui est <strong>vraiment</strong> en jeu. 8 fois sur 10, le candidat va te dire un vrai sujet (manager, projet, perspective) et tu sauras que le salaire est négociable si le reste est solide.",
      bonus:"Cette technique s'appelle « décaler pour qualifier ». Elle marche aussi côté client : « si les honoraires étaient ok, sur quoi choisiriez-vous ? »."
    },
    {
      id:'e35', type:'multi',
      prompt:"Signaux d'un candidat passif qui est en réalité mûr pour bouger : (plusieurs réponses)",
      options:[
        "Il dit « je ne cherche pas » mais prend le temps de te parler 30 minutes",
        "Il te demande des détails sur le manager et la culture",
        "Il répond en moins de 4 heures à tes emails",
        "Il évoque spontanément ce qui « ne va pas » dans sa boîte actuelle",
        "Il te demande poliment d'arrêter de l'appeler",
      ],
      correct:[0,1,2,3],
      explain:"Les quatre premiers sont des <strong>signaux forts</strong>. Un candidat réellement non-intéressé raccroche en 2 minutes. Quelqu'un qui te donne du temps, qui creuse le poste, qui évoque ses irritations actuelles — il est en train de tester ses options. Ton job : rester présent, pas presser.",
      bonus:"Règle du bon timing : rappelle un candidat passif toutes les 6-8 semaines. Trop souvent, il bloque. Jamais, il part chez le concurrent. Entre les deux, tu es <em>le premier appelé quand il décide de bouger</em>."
    },
    {
      id:'e36', type:'qcm',
      prompt:"Quelle est la peur numéro 1 d'un candidat au moment de signer une offre ?",
      options:["Ne pas assez gagner","Se tromper et regretter dans 6 mois","Être mal accueilli par la nouvelle équipe","Que le manager soit désagréable"],
      correct:1,
      explain:"La peur du regret. Un candidat qui bouge sacrifie <strong>ce qu'il connaît</strong> (stabilité, habitudes, collègues) pour <strong>ce qu'il imagine</strong>. Si le « ce qu'il imagine » n'est pas solide dans sa tête, il recule. Ton job de closer : lui donner assez d'éléments pour qu'il se projette concrètement.",
      bonus:"Astuce de closing : organise un déjeuner ou un café avec son futur manager <em>avant</em> la signature. Le concret bat l'abstrait. Un candidat qui a rencontré son futur N+1 ne recule presque jamais."
    },
    {
      id:'e37', type:'classify',
      prompt:"Classe ces raisons de départ selon leur solidité réelle :",
      categories:["Raison solide (il va bouger)","Raison fragile (risque de ghost)"],
      items:[
        { text:"« Mon manager vient de partir, je ne connais pas le remplaçant »", cat:0 },
        { text:"« Je veux un peu plus de salaire »", cat:1 },
        { text:"« Mon conjoint a été muté à Lyon, on déménage en septembre »", cat:0 },
        { text:"« Je m'ennuie un peu en ce moment »", cat:1 },
        { text:"« J'ai été dépassé pour une promotion que je méritais »", cat:0 },
        { text:"« Un ami m'a dit que ça payait mieux ailleurs »", cat:1 },
      ],
      explain:"Les raisons solides ont un <strong>élément déclencheur concret</strong> (départ du manager, déménagement, événement de carrière raté). Les raisons fragiles sont diffuses, souvent formulées au conditionnel. Investis ton temps sur les premières — tu vas gagner.",
      bonus:"Règle du scout : « un candidat sans déclencheur clair est un candidat qui va ghoster ». Avant de pousser un dossier, identifie le déclencheur. Si tu n'en trouves pas, il n'y en a probablement pas."
    },
    {
      id:'e38', type:'order',
      prompt:"Ordonne les étapes psychologiques d'un candidat qui accepte une offre :",
      items:[
        "Première curiosité sur une opportunité",
        "Intérêt réel : il se projette",
        "Doute : « je me trompe peut-être »",
        "Validation par l'entourage (conjoint, amis)",
        "Décision finale et signature",
        "Période d'essai : consolidation ou regret",
      ],
      explain:"Ce parcours psychologique est universel. La phase critique c'est l'étape 3 (<strong>le doute</strong>) — c'est là qu'un candidat ghost, recule, accepte une contre-offre de son employeur actuel. Tu dois savoir la détecter et accompagner la sortie du doute — pas la forcer.",
      bonus:"Technique : quand tu sens le doute (candidat qui met plus de 48h à répondre, réponses courtes, demande de délai), ne pousse pas — pose la question directe : « qu'est-ce qui vous fait hésiter aujourd'hui ? ». 80% du temps, le candidat te dira la vraie chose, et tu sauras quoi faire."
    },
    {
      id:'e39', type:'tf',
      prompt:"Un candidat qui reçoit une contre-offre de son employeur actuel et l'accepte reste typiquement moins de 12 mois.",
      answer:true,
      explain:"Vrai, et c'est documenté. Études cohérentes depuis 20 ans : environ 70 à 80% des candidats qui acceptent une contre-offre de leur employeur actuel partent dans les 12 mois qui suivent. Pourquoi ? Parce que la raison profonde qui les avait fait chercher n'était pas le salaire — c'était autre chose, et elle n'a pas été traitée.",
      bonus:"Argument à ressortir à un candidat tenté par une contre-offre : « si votre employeur actuel vous respectait vraiment, pourquoi a-t-il fallu que vous menaciez de partir pour qu'il s'intéresse à votre cas ? »."
    },
    {
      id:'e40', type:'qcm',
      prompt:"Quelle est la meilleure manière de conclure un premier entretien téléphonique avec un candidat intéressant ?",
      options:[
        "« Je vous envoie le descriptif du poste. »",
        "« On fixe tout de suite un prochain échange : quel créneau vous va cette semaine ? »",
        "« Je reviens vers vous si ça se confirme. »",
        "« Voulez-vous postuler ? »"
      ],
      correct:1,
      explain:"Toujours <strong>fixer le prochain rendez-vous avant de raccrocher</strong>. Un candidat dans l'agenda est un candidat qui avance. Un candidat qui « va réfléchir » est un candidat qui disparaît. Cette règle de base fait la différence entre un pipeline vivant et un pipeline fantôme.",
      bonus:"La phrase magique : « Pour avancer proprement, je préfère qu'on bloque 20 minutes jeudi plutôt qu'on se rappelle à l'aveugle la semaine prochaine — quel créneau ? ». En 10 secondes, tu as un engagement."
    }
  ]
};
