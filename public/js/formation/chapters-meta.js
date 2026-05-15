/* ═══════════════════════════════════════════════════════════════
   NOVALEM ACADÉMIE — CHAPTERS_META
   ───────────────────────────────────────────────────────────────
   Fichier de métadonnées. Définit l'architecture pédagogique :
   l'ordre des chapitres, leur intitulé, leur promesse, leur hook.

   Le contenu (modules, exercices) vit dans chapter-N.js — un
   fichier par chapitre. Ce séparation permet de livrer/réviser
   chaque chapitre indépendamment sans toucher au reste.

   STRUCTURE D'UN CHAPITRE :
     num        : numéro affiché (string)
     title      : titre court (en gras dans l'UI)
     subtitle   : ligne italique sous le titre
     desc       : paragraphe d'introduction (sur la home et le chapitre)
     promise    : "Ce que tu sauras à la fin" — formulé comme un résultat
     hook       : phrase d'accroche utilisée dans les cliffhangers
     bonus      : true si c'est un module bonus (spécialisation, etc.)
     icon       : emoji optionnel (pour les bonus)
     soonText   : texte affiché si le chapitre est encore vide
     comingSoonLabel : pour les bonus, étiquette spécifique ("bientôt", etc.)

   Si tu ajoutes un chapitre ici, n'oublie pas :
     1. de créer le fichier js/formation/chapter-N.js
     2. d'ajouter <script src="…/chapter-N.js"> dans formation.html
   ═══════════════════════════════════════════════════════════════ */

const CHAPTERS = window.CHAPTERS = {
  /* ─── TRONC COMMUN — 9 chapitres ───────────────────────────── */
  '1': {
    num: '1',
    title: "Les Fondations du recrutement",
    subtitle: "Comprendre le métier avant de le pratiquer.",
    desc: "Avant de parler de sourcing, de scripts ou de closing, il faut comprendre ce qu'est le recrutement, pourquoi il existe, qui sont les trois acteurs en présence, et comment l'argent circule. Ce premier chapitre pose les fondations mentales. Sans elles, le reste ne tiendra pas.",
    promise: "Tu sauras expliquer à n'importe qui en 60 secondes pourquoi un cabinet de recrutement existe, qui paie quoi, et pourquoi ce métier a un avenir long.",
    hook: "Il y a une raison pour laquelle les candidats acceptent de parler à un cabinet plutôt qu'à une entreprise directement. Elle n'est pas dans les livres de RH — elle est dans la psychologie."
  },
  '2': {
    num: '2',
    title: "La Posture & le Mental",
    subtitle: "Ce qui sépare un scout d'un exécutant.",
    desc: "Chez Novalem, on ne forme pas des récitants. On forme des gens qui savent pourquoi ils font les choses. Ce chapitre transmet la posture du métier : la métaphore du puzzle, l'alignement des planètes, la discipline du bison, et la règle d'or qui transforme la charge mentale en avantage compétitif.",
    promise: "Tu auras intégré les six modèles mentaux qui structurent la prise de décision d'un scout senior. Tu sauras à quel moment forcer, à quel moment lâcher, et pourquoi.",
    hook: "Les meilleurs scouts ne réfléchissent pas plus vite. Ils réfléchissent avec de meilleurs outils."
  },
  '3': {
    num: '3',
    title: "Business Development — trouver les clients",
    subtitle: "Sources, prospection, premier contact, mandat signé.",
    desc: "Le pipeline client est l'oxygène du cabinet. Ce chapitre couvre les sources réelles (FFB, Pappers, Société.com, jobboards inversés), les meilleurs créneaux d'appel, le script d'ouverture, le passage du standard, le rendez-vous découverte en 15 minutes, et la grille tarifaire Novalem.",
    promise: "Tu sauras générer toi-même un flux de prospects qualifiés chaque semaine, et signer un mandat sans baisser ta valeur.",
    hook: "Un mardi matin à 9h45, dans n'importe quelle zone du marché, il y a une entreprise qui vient juste de décider qu'il fallait recruter. Trouve-la avant elle."
  },
  '4': {
    num: '4',
    title: "Le Mur des Objections",
    subtitle: "Douze objections, douze réponses précises.",
    desc: "Chaque objection client est un piège classique avec une réponse classique. Ce chapitre te donne le script exact pour les douze objections les plus courantes — du « c'est trop cher » au piège du « envoyez 3 CV pour voir ». À la fin, un test de chapitre en rafale chronométré.",
    promise: "Tu traiteras toutes les objections sans hésiter, sans concéder sur ta valeur, et sans braquer le client.",
    hook: "« Non » n'est jamais une réponse. C'est le début d'une vraie conversation."
  },
  '5': {
    num: '5',
    title: "Brief & Sourcing",
    subtitle: "Capter le vrai besoin, trouver les bons profils.",
    desc: "Un sourcing efficace commence par un brief qui ne laisse rien filer. Ce chapitre couvre les questions à poser au client, la CVthèque, les annonces fictives, la rédaction d'annonce conforme aux règles légales (anti-discrimination — gros morceau), et le sourcing inversé (du profil vers l'entreprise).",
    promise: "Tu rempliras ton pipeline avec des candidats pertinents — pas du bruit. Et tu connaîtras les pièges juridiques que personne n'enseigne.",
    hook: "Le meilleur profil du marché n'est pas sur les jobboards. Il vient de finir son entretien quelque part. Question : où ?"
  },
  '6': {
    num: '6',
    title: "L'Entretien Candidat",
    subtitle: "La conversation qui décide.",
    desc: "L'entretien est le moment où tu construis ton dossier, ta conviction, et la confiance du candidat. Ce chapitre couvre la préparation, l'ouverture, la lecture chronologique du parcours, les questions qui font sortir la vérité, les red flags, les green flags, et le contrôle de référence — l'arme qui te protège.",
    promise: "Tu sauras qualifier un humain en 25 minutes, repérer ce qui ne va pas, et sortir de l'entretien avec un dossier complet.",
    hook: "Un candidat qui ne donne pas le contact de son ancien employeur cache toujours quelque chose. Pourquoi ?"
  },
  '7': {
    num: '7',
    title: "Présentation & Closing",
    subtitle: "De la fiche envoyée à la promesse signée.",
    desc: "Présenter un profil n'est pas un copier-coller. Ce chapitre couvre le CV anonymisé, l'ordre stratégique de présentation, le briefing candidat avant l'entretien client, le débrief (candidat avant client — règle d'or), la négociation salariale, la gestion de la contre-offre, et la facturation.",
    promise: "Tu piloteras un closing du premier mail au paiement, sans rien laisser filer.",
    hook: "Quand un candidat est sur le point de signer ailleurs, il y a toujours un signal qu'on aurait pu lire trois semaines avant."
  },
  '8': {
    num: '8',
    title: "Période d'essai & Long terme",
    subtitle: "Ton dossier n'est clos qu'à la fin de la période d'essai.",
    desc: "Un placement ne se mesure pas à la signature — il se mesure six mois plus tard. Ce chapitre couvre le calendrier de suivi candidat/client, la garantie de remplacement Novalem, la gestion des ruptures précoces, et la transformation d'un one-shot en client récurrent.",
    promise: "Tu construiras une réputation de fiabilité qui te ramène les mêmes clients pendant des années — la vraie richesse du métier.",
    hook: "Le client qui te rappelle deux ans plus tard pour un quatrième recrutement ne le fait pas par hasard."
  },
  '9': {
    num: '9',
    title: "Le Quotidien & la Discipline",
    subtitle: "La routine qui fait tenir — et performer.",
    desc: "Le recrutement est un métier de répétition. Sans rituel, on s'épuise. Ce chapitre couvre la journée type, le rythme de la semaine, la méthode du Bison (Pomodoro + Deep Work appliqués à la prospection), les KPIs réalistes, et les méthodes pour sortir des creux.",
    promise: "Tu sauras comment structurer chaque matin, chaque semaine, chaque trimestre. Et comment éviter le burn-out d'un métier où l'on peut travailler 14h pour rien.",
    hook: "Le scout qui pose son téléphone à 18h fait plus de chiffre que celui qui reste connecté jusqu'à minuit. Pourquoi ?"
  },

  /* ─── SPÉCIALISATIONS (bonus, déverrouillées après le tronc) ── */
  'BTP': {
    num: '10',
    title: "Spécialisation BTP",
    subtitle: "Le secteur où la technique fait la valeur.",
    desc: "Une spécialisation Novalem, c'est un terrain technique sur lequel tu deviens irremplaçable. Ce chapitre te donne le vocabulaire du BTP, les corps d'état, les conventions collectives, les permis (CACES, AIPR, B0/H0), la lecture d'un chantier, et les acteurs du secteur (FFB, CAPEB, FNTP, Constructys). Avec ça, tu parles la langue du client.",
    promise: "Tu parleras au directeur de chantier avec autant d'aisance qu'à la DRH du siège. C'est ce qui fait que les boîtes BTP te rappelleront.",
    hook: "Quand un client te dit « il me faut un conducteur de travaux gros œuvre, second œuvre, secondaire et VRD », tu dois savoir lequel ne va pas avec les autres.",
    bonus: true,
    icon: "🏗️",
    soonText: "Cette spécialisation est en cours de préparation. Elle deviendra disponible une fois le tronc commun complété — et elle te donnera l'avantage technique qui fait la valeur d'un scout Novalem.",
    comingSoonLabel: "bientôt"
  },

  /* ─── BONUS PRATIQUE (toujours accessible) ─────────────────── */
  'MICRO': {
    num: 'µ',
    title: "Accompagnement micro-entreprise",
    subtitle: "Créer ton statut pour bosser avec Novalem.",
    desc: "Un module pratique séparé pour t'accompagner dans la création de ta micro-entreprise. URSSAF, code APE, facturation, déclarations trimestrielles — tout ce qu'il faut pour être en règle dès le premier mois. Ce module n'est pas dans le parcours principal : c'est une boîte à outils que tu consultes quand tu en as besoin.",
    promise: "Tu auras créé ton statut juridique en règle et tu sauras facturer Novalem proprement.",
    hook: "Avant le premier placement, il y a une étape administrative que personne n'aime — sauf qu'elle prend une journée et qu'elle te suit toute ta carrière.",
    bonus: true,
    icon: "📋",
    soonText: "Ce module bonus est en cours de préparation. Il couvrira la création de la micro-entreprise étape par étape, la facturation, et la fiscalité applicable au statut d'apporteur d'affaires en recrutement.",
    comingSoonLabel: "en cours"
  }
};

/* MODULES est rempli au fur et à mesure par chapter-1.js, chapter-2.js, etc. */
const MODULES = window.MODULES = {};
