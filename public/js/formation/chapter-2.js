/* ═══════════════════════════════════════════════════════════════
   NOVALEM ACADÉMIE — CHAPITRE 2
   « La Posture & le Mental »
   ───────────────────────────────────────────────────────────────
   Cinq modules de fond + un boss chronométré (« Le Bison »).
   C'est le chapitre où l'on transmet la posture Novalem : les
   modèles mentaux qui structurent les décisions d'un scout senior.

   Méta-pédagogie :
     · Chaque module ouvre sur une métaphore signature
     · Chaque métaphore est suivie d'une mise en pratique
     · Les références académiques sont placées en clins d'œil
       discrets (« on appelle parfois ça… ») — jamais en cours
       théorique
     · Tous les nouveaux types d'exercices sont utilisés :
       Aligneur (2.1), Dialogue (2.4), Bison (2.6)

   Sources et inspirations :
     · Novalem Process 2026 — sections 1.4, 9.0, 9.1, 9.2
     · Reason (Swiss Cheese Model) — 2.1
     · Eisenhower (matrice urgence/importance) — 2.2
     · Cirillo (Pomodoro, 1987) & Newport (Deep Work, 2016) — 2.3
     · Thaler & Sunstein (Choice Architecture, 2008) — 2.4
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
// MODULE 2.1 — L'ALIGNEMENT DES PLANÈTES
// ═══════════════════════════════════════════════════════════════
MODULES['2.1'] = {
  num: 1, title: "L'alignement des planètes",
  type: "Modèle mental", duration: 10, xp: 80,
  lead: "Pourquoi un placement ne dépend ni du candidat seul, ni du client seul, mais d'autre chose — de plus rare.",
  hook: "Tu vas comprendre pourquoi 80% des placements ratés le sont avant même le premier entretien.",
  exercises: [
    {
      id: 'l1', type: 'lesson',
      title: "Six planètes, une fenêtre",
      duration: 4,
      body: [
        { type:'p', text:"Quand un débutant rate un placement, il blâme presque toujours <strong>la même variable</strong> : le candidat n'était pas motivé, ou le client était trop exigeant, ou le timing était mauvais. Une raison unique. Un coupable." },
        { type:'p', text:"Le scout senior, lui, sait que <strong>cette analyse est presque toujours fausse</strong>. Pas parce que la variable invoquée n'a pas joué — elle a probablement joué. Mais parce qu'elle n'est qu'<em>une planète parmi six</em>." },
        { type:'p', text:"Pour qu'un placement aboutisse, six variables doivent s'aligner en même temps : la disponibilité du candidat, sa motivation profonde, le budget réel du client, l'urgence réelle du recrutement, l'alignement des compétences, et l'alignement humain. Six. Pas une, pas trois. Six." },
        { type:'highlight', title:"Le modèle mental à intégrer", text:"Un placement n'est pas une <em>réaction chimique</em> entre deux molécules. C'est une <em>fenêtre de tir</em> : tous les paramètres doivent être dans une zone acceptable en même temps. Quand l'un dérive, la fenêtre se ferme." },
        { type:'p', text:"En sciences cognitives, on appelle parfois cette logique « le modèle du fromage suisse » : empilez plusieurs tranches de gruyère, et un objet ne passe à travers que si les trous s'alignent. Pour un placement, c'est l'inverse : tous les trous doivent s'aligner pour que ça <em>passe</em>." },
        { type:'p', text:"Conséquence concrète sur ta façon de travailler : <strong>ton rôle n'est pas de pousser une planète</strong>. C'est d'observer leur dérive, et d'agir avant qu'une seule d'entre elles ne sorte de la zone." },
      ]
    },
    {
      id: 'e1', type: 'qcm',
      prompt: "Combien de variables au minimum doivent s'aligner pour qu'un placement aboutisse, selon le modèle Novalem ?",
      options: ["Deux : le candidat et le client", "Quatre : compétences, budget, motivation, timing", "Six : disponibilité, motivation, budget, urgence, compétences, humain", "Le nombre exact varie selon le poste"],
      correct: 2,
      explain: "Six. Le piège mental classique du débutant, c'est de réduire le placement à deux acteurs (candidat + client). En réalité, chaque acteur porte plusieurs variables indépendantes — et c'est <strong>l'alignement simultané</strong> de ces six variables qui fait passer le placement.",
      bonus: "Les meilleurs scouts pilotent ces six variables comme on pilote un avion : ils regardent six cadrans en même temps, et corrigent dès qu'un seul commence à dévier."
    },
    {
      id: 'e2', type: 'match',
      prompt: "Associe chaque planète à la question diagnostique qui te permet de la jauger en entretien.",
      pairs: [
        ["Disponibilité candidat", "Quel préavis exact ? Engagements en cours ?"],
        ["Motivation candidat", "Pourquoi tu bouges maintenant et pas il y a 6 mois ?"],
        ["Budget client", "Si on trouve le profil parfait à +15%, on peut suivre ?"],
        ["Urgence client", "Pour quand vous voulez la personne assise au bureau ?"],
        ["Alignement compétences", "Sur ces 3 compétences clés, où tu te situes ?"],
        ["Alignement humain", "À quoi ressemble une journée idéale dans ce poste ?"]
      ],
      explain: "Chaque planète a sa <strong>question signature</strong>. Pas une question générique — une question qui force la sortie d'une vraie information. « Vous êtes motivé ? » est une question inutile (tout le monde dit oui). « Pourquoi tu bouges maintenant ? » force le candidat à formuler le déclencheur réel.",
      bonus: "Si tu sors d'un entretien sans la réponse à ces six questions, tu n'as pas fait un entretien — tu as fait une discussion."
    },
    {
      id: 'e3', type: 'aligner',
      prompt: "Cas pratique : Conducteur de travaux, gros œuvre, Nice. Le candidat te dit oui, le client est chaud. Ajuste les six variables pour voir si la fenêtre est ouverte. Objectif : 75% de probabilité de match.",
      scenario: "Le client cherche un conducteur de travaux gros œuvre, expérimenté, démarrage souhaité dans 6 semaines, budget annoncé 55 K€. Le candidat sortant d'entretien : 7 ans d'expérience, prétend 60 K€, préavis 3 mois, motivé par un changement de management.",
      threshold: 75,
      dims: [
        { key:'preavis', label:"Préavis candidat", min:0, max:6, step:1, unit:" mois", start:3, ideal:1.5, tolerance:1, weight:1.4, hint:"Le client a besoin sous 6 semaines (≈ 1,5 mois)" },
        { key:'salaire', label:"Salaire négocié", min:50, max:70, step:1, unit:" K€", start:60, ideal:57, tolerance:2, weight:1.5, hint:"Budget annoncé 55 K€, tolérance Novalem +5%" },
        { key:'motivation', label:"Profondeur de la motivation (1-10)", min:1, max:10, step:1, start:6, ideal:8, tolerance:1, weight:1.2, hint:"Veut bouger ≠ va bouger. 8+ = motivation actée" },
        { key:'urgence', label:"Urgence réelle client (1-10)", min:1, max:10, step:1, start:5, ideal:7, tolerance:1.5, weight:1, hint:"Le client va-t-il vraiment signer en 6 semaines ?" },
        { key:'comp', label:"Couverture compétences (%)", min:0, max:100, step:5, unit:" %", start:80, ideal:90, tolerance:8, weight:1.3, hint:"Idéal ≥ 85%. En dessous, friction technique" },
        { key:'humain', label:"Fit humain (1-10)", min:1, max:10, step:1, start:7, ideal:8, tolerance:1.5, weight:1, hint:"Évalué après débrief des deux côtés" },
      ],
      explain: "Le seuil de 75% n'est pas arbitraire : c'est la zone au-dessus de laquelle on peut <strong>raisonnablement parier sur la signature</strong>. En dessous, on parle d'un placement « à risque » qu'on ne pousse pas — ou alors on ajuste activement les variables avant.",
      bonus: "L'ajustement actif des variables, c'est ça le vrai métier. On ne <em>subit</em> pas une dérive : on ouvre une conversation avec le client (« 57 K€ ça lui va, vous montez à 57 ? ») ou avec le candidat (« 1,5 mois c'est possible si vous posez 15 jours de congés ? »)."
    },
    {
      id: 'e4', type: 'scenario',
      context: "Lundi 14h. Tu sors d'un débrief candidat (excellent, motivé, dispo dans 2 mois) et tu enchaînes avec le client (très intéressé, budget 50 K€). Le candidat demande 58 K€ — soit 16% au-dessus du budget.",
      prompt: "Quelle est la première chose à faire ?",
      options: [
        "Présenter le candidat au client en gardant la demande de 58 K€ pour plus tard",
        "Rappeler le candidat pour lui demander d'accepter 50 K€",
        "Rappeler le client pour tester sa flexibilité salariale sur ce profil précis",
        "Chercher un autre candidat dont les prétentions matchent le budget"
      ],
      correct: 2,
      explain: "Tu testes la <strong>planète budget</strong> côté client <em>avant</em> de demander au candidat de bouger. Pourquoi ? Parce que le budget annoncé n'est presque jamais le budget maximum. Et parce que demander au candidat de descendre avant même que le client n'ait flashé sur son CV est une erreur — tu fragilises la motivation candidat pour rien.",
      bonus: "La phrase de calibrage budget : « Sur ce profil précis qui a tout ce que vous cherchez, si on doit aller à 57 ou 58 K€ pour le sécuriser, on peut le faire ? ». Tu ne demandes pas une augmentation du budget — tu testes une zone, sur un profil concret."
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 2.2 — LA CHARGE MENTALE & LE TRI
// ═══════════════════════════════════════════════════════════════
MODULES['2.2'] = {
  num: 2, title: "La charge mentale & le tri",
  type: "Discipline", duration: 10, xp: 70,
  lead: "Comment piloter trente dossiers en parallèle sans rien laisser tomber — sans saturer.",
  hook: "Le scout qui pense à tout en même temps ne pense correctement à rien. Voici la mécanique pour s'en sortir.",
  exercises: [
    {
      id: 'l2', type: 'lesson',
      title: "Sortir l'information du cerveau",
      duration: 3,
      body: [
        { type:'p', text:"Un scout en régime normal pilote entre trente et soixante dossiers en parallèle : candidats en cours, clients en négociation, références à appeler, débriefs à programmer, mails à relancer, mandats à signer. <strong>Aucun cerveau humain n'est conçu pour retenir ça</strong>." },
        { type:'p', text:"Le débutant pense que c'est une question de mémoire. Le senior sait que c'est une question de système. La règle d'or : <strong>si une information est dans ta tête, elle est perdue</strong>. Elle doit être quelque part — agenda, CRM, todo, fiche candidat — mais pas dans ta tête." },
        { type:'highlight', title:"La règle des 3 priorités quotidiennes", text:"Chaque matin, tu choisis <em>trois choses</em> qui doivent absolument avancer dans la journée. Trois. Pas dix. Pas cinq. Trois. Tout le reste est secondaire. Cette discipline du tri est ce qui sépare un scout productif d'un scout occupé." },
        { type:'p', text:"Pour trier, un outil est plus utile que les autres : la <em>matrice urgence × importance</em>. Quatre cases. Une tâche urgente <strong>et</strong> importante : tu la fais maintenant. Importante mais pas urgente : tu la planifies. Urgente mais pas importante : tu délègues ou tu expédies. Ni urgente ni importante : tu supprimes." },
        { type:'p', text:"Cette matrice porte le nom du président américain Dwight Eisenhower, qui l'utilisait pour trier ses décisions militaires. La logique militaire vaut pour le recrutement : sur un champ de bataille, on n'a pas le temps de tout faire — on doit choisir." },
        { type:'p', text:"Conséquence opérationnelle : <strong>la vraie discipline n'est pas de tout faire</strong>. C'est de choisir, chaque jour, ce que tu ne fais pas." },
      ]
    },
    {
      id: 'e5', type: 'qcm',
      prompt: "Quelle est la règle des priorités quotidiennes Novalem ?",
      options: [
        "Lister toutes les tâches et les faire dans l'ordre",
        "Choisir trois choses qui doivent absolument avancer aujourd'hui",
        "Faire d'abord le plus facile pour démarrer la journée",
        "Suivre l'ordre des urgences au fur et à mesure qu'elles arrivent"
      ],
      correct: 1,
      explain: "Trois. Pas plus. Pas moins. Trois choses qui doivent avoir avancé en fin de journée. Tout le reste est secondaire, accessoire, ou peut attendre. <strong>La force de la règle des trois, c'est qu'elle te force à choisir.</strong>",
      bonus: "Les meilleurs scouts notent leurs trois priorités la veille au soir, pas le matin. Le matin, le cerveau est occupé à se réveiller — c'est un mauvais moment pour prendre des décisions stratégiques."
    },
    {
      id: 'e6', type: 'classify',
      prompt: "Place ces huit tâches dans la matrice d'Eisenhower.",
      categories: ["Urgent + Important", "Important pas urgent", "Urgent pas important"],
      items: [
        { text:"Le client A appelle : le candidat placé veut démissionner pendant sa période d'essai", cat:0 },
        { text:"Préparer le brief avec le nouveau client signé hier (entretien dans 3 jours)", cat:1 },
        { text:"Répondre à un commercial qui veut te vendre du sourcing AI", cat:2 },
        { text:"Construire la fiche d'un poste reçu il y a 2 semaines, jamais ouverte", cat:1 },
        { text:"Le candidat top doit signer aujourd'hui, il a besoin d'un dernier appel rassurant", cat:0 },
        { text:"Mettre à jour ta liste de KPIs perso de la semaine", cat:1 },
        { text:"Répondre aux 14 notifications LinkedIn de la matinée", cat:2 },
        { text:"Relancer le DRH qui n'a pas répondu depuis 9 jours sur 3 candidats", cat:0 }
      ],
      explain: "Le piège classique, c'est de confondre <strong>urgent</strong> et <strong>important</strong>. Une notification LinkedIn est urgente (le badge clignote) mais sans importance stratégique. Un brief client à préparer est important mais pas urgent — et c'est pour ça qu'on a tendance à le repousser jusqu'à ce qu'il devienne <em>urgent + important</em> dans la panique.",
      bonus: "Une fois par semaine, fais l'exercice à l'envers : regarde ce que tu as fait, et classe-le rétrospectivement. Tu seras surpris du temps passé en case « Urgent pas important »."
    },
    {
      id: 'e7', type: 'tf',
      prompt: "Une bonne mémoire suffit pour piloter trente dossiers en parallèle.",
      answer: false,
      explain: "Faux, et c'est même le piège le plus classique. La mémoire de travail humaine tient en moyenne sept éléments simultanés (recherches Miller, 1956). Au-delà, des choses passent à la trappe — et tu ne sais même pas lesquelles. <strong>Le scout senior ne fait pas confiance à sa mémoire — il a un système.</strong>",
      bonus: "Le scout qui dit « pas besoin de noter, je vais m'en souvenir » est presque toujours le scout qui rate une relance critique deux semaines plus tard. Note tout. Maintenant."
    },
    {
      id: 'e8', type: 'order',
      prompt: "Mardi matin 9h. Tu arrives au bureau. Voici cinq actions possibles. Mets-les dans le bon ordre.",
      items: [
        "Faire un café et un point mental sur la semaine",
        "Vérifier les mails urgents arrivés depuis hier soir",
        "Ouvrir l'agenda et identifier les 3 priorités du jour",
        "Lancer un premier bloc Pomodoro de 25 min sur la priorité n°1",
        "Répondre aux LinkedIn et notifications accumulées"
      ],
      explain: "L'ordre Novalem : café + point mental → vérifier les mails urgents → identifier les 3 priorités → attaquer la priorité 1 en sprint → traiter les notifs secondaires plus tard. La logique : <strong>commencer par décider</strong>, jamais commencer par réagir. Les notifications passent toujours en dernier — elles cassent la concentration.",
      bonus: "Si tu commences ta journée en lisant LinkedIn, tu finis ta journée dans LinkedIn. Le contenu d'attention que tu absorbes en premier conditionne ton mode mental pour les heures qui suivent."
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 2.3 — LA MÉTHODE DU BISON
// ═══════════════════════════════════════════════════════════════
MODULES['2.3'] = {
  num: 3, title: "La méthode du Bison",
  type: "Méthode", duration: 11, xp: 80,
  lead: "Vingt minutes de chasse pure battent deux heures de mollesse. La mécanique exacte derrière cette phrase.",
  hook: "Le bison ne galope pas pendant deux heures. Il sprinte vingt minutes, puis se repose. Il est encore vivant à la fin. Toi aussi.",
  exercises: [
    {
      id: 'l3', type: 'lesson',
      title: "Sprinter, puis se reposer — vraiment",
      duration: 4,
      body: [
        { type:'p', text:"Un bison est un grand mammifère capable de sprinter à plus de 50 km/h, mais seulement pendant quelques minutes. Après, il s'arrête, baisse la tête, reprend son souffle. Puis il repart. <strong>Il ne galope jamais à demi-régime pendant deux heures</strong> — il alterne sprint et repos, et c'est pour ça qu'il survit." },
        { type:'p', text:"Cette mécanique est exactement celle qui s'applique au cold call et à la chasse en général. Pendant vingt minutes, tu fais une seule chose : tu appelles. Téléphone en main, casque sur la tête, mails fermés, LinkedIn fermé, Slack fermé. <em>Une seule chose.</em>" },
        { type:'p', text:"À la fin des vingt minutes, tu fais une pause de cinq minutes. Tu te lèves, tu marches, tu bois de l'eau. Tu ne « rentabilises » pas la pause en checkant tes mails — tu te reposes pour <strong>vraiment</strong>. Puis tu recommences. Trois cycles de vingt minutes = une heure de chasse à très haute intensité." },
        { type:'highlight', title:"La règle du sprint", text:"Quand tu chasses, tu chasses. Quand tu te reposes, tu te reposes. Mais tu ne fais jamais les deux à moitié. <em>La mollesse continue est le pire des deux mondes — ni efficace, ni reposante.</em>" },
        { type:'p', text:"Cette technique a été formalisée dans les années quatre-vingt par Francesco Cirillo sous le nom de Pomodoro — du nom de la minuterie en forme de tomate qu'il utilisait. Cirillo défendait une durée de vingt-cinq minutes ; chez Novalem, on raccourcit à vingt parce que la fatigue cognitive sur un cold call est plus rapide qu'en travail intellectuel pur." },
        { type:'p', text:"Pour les tâches de fond (qualification, lecture de CV, brief client), la logique change. On parle alors de <em>Deep Work</em>, popularisé par le chercheur Cal Newport : un bloc de quatre-vingt-dix minutes sans interruption, sans téléphone, sans mail. <strong>Plus de profondeur, moins de fréquence.</strong>" },
        { type:'p', text:"Conséquence à retenir : le scout qui travaille quatorze heures par jour en mode mou produit moins que le scout qui fait quatre Pomodoros le matin et deux blocs Deep Work l'après-midi. Sept heures et demie de travail, mais sept heures et demie <em>vraiment travaillées</em>." },
      ]
    },
    {
      id: 'e9', type: 'qcm',
      prompt: "Quelle est la durée d'un cycle de chasse Bison chez Novalem ?",
      options: ["Dix minutes de sprint", "Vingt minutes de sprint + cinq de pause", "Une heure de focus continu", "Quatre-vingt-dix minutes de Deep Work"],
      correct: 1,
      explain: "Vingt minutes de sprint, cinq minutes de pause. C'est volontairement plus court que les vingt-cinq minutes du Pomodoro classique de Cirillo : sur du cold call, la fatigue cognitive arrive plus vite qu'en travail de fond.",
      bonus: "Trois cycles consécutifs = un Bison complet. Au bout du troisième, tu prends une pause longue (15-20 minutes). C'est non négociable. Si tu sautes la pause longue, le quatrième cycle sera mou — tu perds plus de temps que tu n'en gagnes."
    },
    {
      id: 'e10', type: 'multi',
      prompt: "Pendant un sprint Bison, qu'est-ce que tu fermes activement ? (plusieurs réponses)",
      options: [
        "Le client mail",
        "Les notifications téléphone (mode avion ou mode focus)",
        "L'onglet LinkedIn",
        "Slack / Teams / Discord",
        "Ta to-do list (pour ne pas être tenté de cocher autre chose)",
        "Ta porte (si bureau partagé)"
      ],
      correct: [0,1,2,3,4,5],
      explain: "Tout. Le sprint est un état mental où <strong>une seule action est possible</strong> : appeler. Chaque autre stimulus disponible est une porte de sortie. Si elles sont ouvertes, ton cerveau finira par s'y glisser — c'est mécanique, ce n'est pas une question de volonté.",
      bonus: "Beaucoup débutent en se disant « je vais juste laisser Slack ouvert au cas où ». Le résultat est connu : un tiers de sprint perdu en distraction passive. Le « au cas où » est le tueur silencieux de la concentration."
    },
    {
      id: 'e11', type: 'scenario',
      context: "Tu es à la quinzième minute d'un sprint Pomodoro de cold call. Tu as enchaîné trois appels productifs. Ton portable vibre : c'est le standard d'un prospect important que tu attends depuis dix jours.",
      prompt: "Que fais-tu ?",
      options: [
        "Tu décroches — c'est exactement le type d'appel que tu attendais",
        "Tu laisses sonner. Tu rappelles dans cinq minutes à la fin du sprint",
        "Tu termines ton sprint comme prévu, et tu rappelles à la pause",
        "Tu envoies un SMS pour proposer un rappel dans 15 minutes"
      ],
      correct: 2,
      explain: "Tu termines ton sprint. Cinq minutes restantes ne valent pas la cassure de focus que représente un appel non préparé. Tu rappelles dans la pause — l'effet « il vient juste de chercher à me joindre » te donne en plus une légitimité immédiate quand tu rappelles.",
      bonus: "Le piège mental, c'est de penser « cet appel est différent ». Ce n'est jamais vrai. Si tu casses ton sprint pour cet appel, tu le casseras pour tous les suivants. <strong>La règle protège le système, pas chaque cas particulier.</strong>"
    },
    {
      id: 'e12', type: 'tf',
      prompt: "Travailler quatorze heures par jour est un bon indicateur de performance pour un scout.",
      answer: false,
      explain: "Faux. La performance d'un scout se mesure aux résultats — placements signés, RDV obtenus, mandats fermés — pas aux heures connectées. Un scout qui travaille sept heures en mode Bison + Deep Work produit généralement plus qu'un scout qui reste connecté quatorze heures en mode mou.",
      bonus: "Les heures longues en mode mou ne sont pas neutres : elles dégradent la qualité du sommeil, la qualité des décisions du lendemain, et finissent par produire un burn-out à 18 mois. Ce n'est pas une statistique discutable — c'est une réalité physiologique."
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 2.4 — MÂCHER LE TRAVAIL
// ═══════════════════════════════════════════════════════════════
MODULES['2.4'] = {
  num: 4, title: "Mâcher le travail",
  type: "Posture", duration: 10, xp: 70,
  lead: "L'art de présenter les choses pour que l'autre n'ait qu'à dire oui.",
  hook: "Quand tu envoies un mail qui demande à l'autre de réfléchir, tu paries qu'il va prendre le temps. Mauvais pari.",
  exercises: [
    {
      id: 'l4', type: 'lesson',
      title: "Pousser le fauteuil en descente",
      duration: 3,
      body: [
        { type:'p', text:"Imagine que tu pousses un fauteuil roulant. Tu peux le faire en montée — l'autre doit fournir un effort pour avancer avec toi. Ou en descente — le fauteuil roule presque seul, l'autre n'a qu'à se laisser porter. <strong>Mâcher le travail, c'est toujours choisir la descente.</strong>" },
        { type:'p', text:"Concrètement, ça veut dire : à chaque fois que tu envoies une demande, une proposition, une question, tu te poses la question « est-ce que l'autre va devoir <em>réfléchir</em> pour me répondre, ou est-ce qu'il n'a qu'à <em>choisir</em> ? ». Si c'est réfléchir, tu n'as pas mâché. Si c'est choisir, tu as mâché." },
        { type:'p', text:"L'exemple type, c'est le mail de prise de rendez-vous. Mauvais mail : « Quand êtes-vous disponible cette semaine ? » Cinq allers-retours avant d'avoir une date. Bon mail : « Je propose mardi 10h ou jeudi 14h. Lequel vous va ? » <em>Un seul échange, deux options, c'est plié.</em>" },
        { type:'highlight', title:"La règle du mâchage", text:"L'effort que tu épargnes à l'autre est exactement la friction que tu retires entre lui et le oui. Plus tu mâches, plus la conversion est rapide. C'est mécanique." },
        { type:'p', text:"Les chercheurs en psychologie comportementale parlent de <em>choice architecture</em> — la façon dont on présente un choix influence radicalement la décision. Thaler et Sunstein ont montré qu'à contenu équivalent, un choix avec deux options pré-formulées génère trois à cinq fois plus de réponses qu'un choix ouvert." },
        { type:'p', text:"Conséquence opérationnelle : chaque fois que tu écris à un client, à un candidat, à une référence, <strong>tu finis ta phrase par une question fermée ou un choix binaire</strong>. Jamais une question ouverte qui demande à l'autre de produire une réponse à partir de rien." },
      ]
    },
    {
      id: 'e13', type: 'dialogue',
      prompt: "Cas pratique : un client te répond. Joue chaque tour en choisissant la réponse qui mâche le mieux le travail.",
      context: "Lundi 11h. Tu reçois un mail du DRH d'une PME du bâtiment : « Bonjour, on a un poste de conducteur de travaux à pourvoir, est-ce que vous pouvez nous aider ? Cordialement. » Quatre tours te séparent du RDV signé.",
      passScore: 6,
      turns: [
        {
          speaker: 'client',
          text: "Bonjour, on a un poste de conducteur de travaux à pourvoir, est-ce que vous pouvez nous aider ? Cordialement.",
          options: [
            { text: "Bonjour, oui bien sûr. Pouvez-vous m'en dire plus sur le poste ?", score: 0, fb: 'negative', feedback: "Pas mâché. Tu lui demandes de réfléchir et de rédiger un brief — il va prendre trois jours, ou ne jamais répondre." },
            { text: "Bonjour, oui sans problème. On en discute 15 minutes au téléphone — mardi 11h ou jeudi 14h, lequel vous va ?", score: 2, fb: 'positive', feedback: "Mâché. Tu transformes une demande floue en un choix binaire avec un format défini (15 min). Probabilité de réponse rapide : très haute." },
            { text: "Bonjour, vous pouvez me transmettre la fiche de poste pour étude ?", score: 0, fb: 'negative', feedback: "Mauvais réflexe. Tu fais de la valeur sur la base d'une fiche écrite par le client (souvent incomplète) au lieu de poser tes questions." }
          ]
        },
        {
          speaker: 'client',
          text: "Mardi 11h c'est bon. Vous voulez que je vous envoie quoi avant pour préparer ?",
          options: [
            { text: "Tout ce que vous avez sur le poste : fiche, organigramme, contexte de l'équipe.", score: 0, fb: 'negative', feedback: "Tu lui mets une corvée sur le dos avant même de l'avoir parlé. Il va lever les yeux au ciel, et peut-être annuler." },
            { text: "Rien à préparer de votre côté — je vous pose les questions au tel et on remplit ensemble. Vous pouvez juste me dire qui est le manager direct du futur recruté ?", score: 2, fb: 'positive', feedback: "Excellent. Tu décharges complètement le client (rien à préparer) et tu glisses une seule question utile pour caler ton angle dès le premier appel." },
            { text: "On verra ça mardi.", score: 0, fb: 'neutral', feedback: "Pas faux, mais tu rates une opportunité de qualifier en amont — un nom de manager te permet souvent de comprendre l'enjeu réel." }
          ]
        },
        {
          speaker: 'client',
          text: "Le manager direct c'est Pierre Martin. Et combien ça coûte vos services ?",
          options: [
            { text: "On en reparle mardi en détail.", score: 1, fb: 'neutral', feedback: "Acceptable, mais tu laisses planer le doute. Le client peut se dire que tu cherches à fuir la question." },
            { text: "12 à 18% du package annuel selon la difficulté du poste, garantie 3 mois. On précise le pourcentage mardi avec le contexte du poste — c'est plus juste pour vous.", score: 2, fb: 'positive', feedback: "Mâché et droit. Tu donnes la fourchette, tu lies la précision au contexte, tu poses un cadre pro. Le client se sent en sécurité, pas piégé." },
            { text: "Nos honoraires varient entre 12% et 25% du salaire brut annuel hors avantages, payables 30% à la signature et 70% à la prise de poste, avec une garantie de remplacement gratuite de trois mois en cas de rupture pour raison liée au profil…", score: 0, fb: 'negative', feedback: "Trop. Tu noies le client dans la mécanique avant qu'il ait validé le principe. Réserve les détails pour le RDV." }
          ]
        },
        {
          speaker: 'client',
          text: "Ok, ça me va. À mardi.",
          options: [
            { text: "Parfait, à mardi 11h. Je vous appelle au numéro de votre signature ?", score: 2, fb: 'positive', feedback: "Mâché jusqu'au bout. Tu confirmes l'horaire, tu précises qui appelle qui, tu utilises une question fermée pour boucler. Zéro ambiguïté." },
            { text: "Super, on s'appelle mardi !", score: 0, fb: 'negative', feedback: "Trop léger. Qui appelle qui ? Sur quel numéro ? À 11h00 pile ou « dans la matinée » ? Tu rouvres trois zones d'incertitude alors qu'il fallait fermer." },
            { text: "Très bien, je vous envoie une invitation Google Calendar dans la minute.", score: 1, fb: 'neutral', feedback: "Pas mal — pro et structuré. Le seul risque : si le client ne consulte pas son calendrier ou ne valide pas l'invite, tu n'as toujours pas de confirmation explicite." }
          ]
        }
      ],
      explain: "Le mâchage se mesure tour par tour. Chaque message que tu envoies doit <strong>fermer une zone d'incertitude</strong>, pas en ouvrir une. À chaque échange, l'autre n'a qu'à choisir ou confirmer — jamais à produire de la réflexion à partir de rien.",
      bonus: "Quand un client met plus de 24h à te répondre, c'est presque toujours parce que ton dernier message lui demandait un effort cognitif. Reformule, mâche, renvoie."
    },
    {
      id: 'e14', type: 'multi',
      prompt: "Quelles caractéristiques sont propres à un mail qui mâche le travail ? (plusieurs réponses)",
      options: [
        "Il propose deux ou trois options concrètes plutôt qu'une question ouverte",
        "Il pose toutes les questions en une seule fois pour gagner du temps",
        "Il finit par une question fermée ou un choix binaire",
        "Il fournit le contexte nécessaire à la réponse sans demander à l'autre de le chercher",
        "Il fait moins de quinze lignes",
        "Il utilise un ton formel et soutenu pour montrer du respect"
      ],
      correct: [0, 2, 3, 4],
      explain: "Mâcher = offrir un chemin clair, court, et avec un effort minimum. Les questions empilées (option 2) noient le destinataire. Le ton très formel (option 6) ralentit la lecture et donne une impression bureaucratique. Le mail mâché est <strong>court, contextualisé, fermé</strong>.",
      bonus: "Test ultime : relis ton mail et compte les questions ouvertes (« quand », « comment », « pourquoi »). S'il y en a plus d'une, tu n'as pas mâché."
    },
    {
      id: 'e15', type: 'fill',
      prompt: "Complète la règle d'or du mâchage.",
      text: "Le mail mâché ne demande pas à l'autre de réfléchir — il lui demande de ___.",
      choices: ["choisir", "écrire", "valider", "négocier"],
      correct: 0,
      explain: "Choisir. C'est toute la mécanique. Tu fais le travail de réflexion à sa place, tu présentes deux ou trois options, et lui n'a qu'à pointer du doigt. Friction réduite à zéro.",
      bonus: "« Valider » est une réponse acceptable mais moins riche : valider implique une seule proposition. Choisir implique un éventail — c'est plus respectueux de l'autonomie de l'autre tout en restant mâché."
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 2.5 — PLANTER DES GRAINES
// ═══════════════════════════════════════════════════════════════
MODULES['2.5'] = {
  num: 5, title: "Planter des graines",
  type: "Long terme", duration: 10, xp: 70,
  lead: "Le scout est un fermier, pas un chasseur d'opportunités. Voici comment le temps devient ton meilleur asset.",
  hook: "Sur cinquante graines plantées, cinq germent. Sur les cinq, deux portent fruit. C'est suffisant pour vivre.",
  exercises: [
    {
      id: 'l5', type: 'lesson',
      title: "Le scout est un fermier",
      duration: 3,
      body: [
        { type:'p', text:"Beaucoup de débutants pensent que le métier est du tactique pur : tu appelles, tu signes un mandat, tu places, tu factures. Cycle court, action immédiate. C'est <strong>partiellement</strong> vrai — mais ça rate complètement la dimension qui fait les carrières longues." },
        { type:'p', text:"Le scout senior, lui, sait qu'il a un asset compétitif que personne ne peut lui voler : <em>le temps</em>. Il plante des graines tout au long de l'année, sans rien attendre en retour. Un café avec un DRH qui ne recrute pas. Un message LinkedIn à un candidat qui n'est pas en recherche. Un mail d'anniversaire à un client placé il y a deux ans." },
        { type:'p', text:"Pourquoi ? Parce que <strong>les besoins évoluent</strong>. Le DRH d'aujourd'hui qui ne recrute pas sera celui qui aura un poste critique à pourvoir dans neuf mois. Le candidat qui n'est pas en recherche aujourd'hui sera dispo dans deux ans. Le client placé il y a deux ans aura un nouveau besoin que personne n'aura senti venir." },
        { type:'highlight', title:"La règle du top of mind", text:"Quand le besoin se déclare, c'est presque toujours celui qui était <em>déjà présent à l'esprit</em> qui est appelé. Pas le meilleur. Pas le moins cher. Celui dont on se rappelle. Ton travail de fermier, c'est de rester dans la tête des gens qui n'ont pas encore besoin de toi." },
        { type:'p', text:"Les marketeurs appellent ça le « drip » — un goutte-à-goutte de contacts faibles mais constants. Ce n'est pas du spam, ce n'est pas du commercial intrusif. C'est <em>de la présence sans pression</em>. Un message tous les trois ou quatre mois, qui apporte quelque chose ou qui prend des nouvelles — sans jamais vendre." },
        { type:'p', text:"Conséquence opérationnelle : <strong>le scout qui appelle uniquement quand il a besoin de quelque chose se grille</strong>. Le scout qui maintient un lien sans rien attendre devient précieux. Et le marché ne se vit pas en semaines — il se vit en années." },
      ]
    },
    {
      id: 'e16', type: 'tf',
      prompt: "Un client chez qui tu as placé une personne il y a deux ans est un client perdu si tu n'as pas eu de nouveau mandat depuis.",
      answer: false,
      explain: "Faux. C'est un client <strong>dormant</strong>, ce qui est très différent d'un client perdu. Un client dormant garde un souvenir positif de ton travail et reste activable. Un client perdu a soit eu une mauvaise expérience, soit te confond avec un autre. La différence est énorme — et beaucoup de scouts les confondent.",
      bonus: "Une règle simple : un client dormant qui ne reçoit aucun signe de toi pendant 18 mois bascule progressivement vers « perdu ». Au-delà de 24 mois sans contact, tu repars de zéro. Plante des graines au moins tous les six mois."
    },
    {
      id: 'e17', type: 'order',
      prompt: "Tu veux maintenir un lien avec un compte client dormant pendant un an, sans jamais vendre. Mets ces quatre actions dans le bon ordre.",
      items: [
        "Janvier — mail bref pour souhaiter une bonne année + lien vers un article du secteur",
        "Avril — appel court (5 min) pour prendre des nouvelles, sans agenda commercial",
        "Septembre — partage d'une donnée de marché utile pour son secteur (étude, baromètre)",
        "Décembre — vœux de fin d'année personnalisés avec mention d'un succès récent du contact"
      ],
      explain: "L'ordre suit le calendrier mais aussi un crescendo d'intimité : on commence par un message générique (janvier), puis on personnalise progressivement (avril), puis on apporte une valeur réelle (septembre), pour finir sur un message chaud et personnel (décembre). <strong>Plus l'année avance, plus le lien se densifie sans jamais vendre.</strong>",
      bonus: "Si à un moment de l'année tu n'as rien à apporter, n'envoie pas un message creux pour cocher une case. Mieux vaut sauter un trimestre que d'envoyer un message qui sent l'effort de relance commerciale."
    },
    {
      id: 'e18', type: 'multi',
      prompt: "Quels signaux indiquent qu'une graine est en train de germer (qu'un compte dormant redevient activable) ? (plusieurs réponses)",
      options: [
        "Le contact te like ou commente un post LinkedIn récent",
        "Tu reçois une OOO (out of office) avec un changement de poste annoncé",
        "Le contact te demande un café sans agenda précis",
        "Tu vois passer une annonce de recrutement publiée par son entreprise",
        "Le contact ne répond plus depuis 6 mois",
        "Il évoque un projet de croissance ou un changement d'organisation"
      ],
      correct: [0, 1, 2, 3, 5],
      explain: "Tous sauf le silence prolongé. Un like, un café demandé, une annonce publiée, un projet évoqué — ce sont des signaux faibles qui méritent une relance personnalisée. Le silence prolongé, lui, indique au contraire que le contact s'est éloigné — il faut planter une nouvelle graine avant de pouvoir parler business.",
      bonus: "Beaucoup de scouts ratent les signaux LinkedIn par paresse. Un like d'un contact dormant sur un de tes posts n'est pas anodin — c'est un signe d'attention. Réponds avec un message direct dans les 48h, jamais en commentaire public."
    },
    {
      id: 'e19', type: 'scenario',
      context: "Mardi matin. Tu vois sur LinkedIn qu'un de tes anciens clients (placement il y a 18 mois) vient d'être nommé directeur général de sa boîte. Aucun contact entre vous depuis le dernier closing.",
      prompt: "Quelle est la meilleure action ?",
      options: [
        "Lui envoyer un message LinkedIn de félicitations + proposer un café sans agenda dans les deux semaines",
        "Liker son post et attendre qu'il revienne vers toi quand il aura besoin",
        "Lui envoyer un long mail de félicitations en expliquant que tu peux l'aider sur ses futurs recrutements",
        "Attendre quelques semaines qu'il s'installe dans son nouveau poste avant de le contacter"
      ],
      correct: 0,
      explain: "Tu plantes la graine maintenant, pas dans trois semaines. Une promotion est un <strong>signal fort</strong> qu'il va recruter dans les trois à six mois — souvent une équipe entière. Le message court, chaleureux, sans agenda commercial, avec une proposition concrète de café, te remet immédiatement dans son top of mind sans déclencher de réflexe défensif.",
      bonus: "La phrase exacte qui marche : « Félicitations pour la prise de poste, c'est mérité. Si tu veux échanger autour d'un café d'ici quinze jours pour me raconter ton plan, je suis preneur — sans aucun agenda commercial de mon côté. » Tu désamorces immédiatement le réflexe « il veut me vendre quelque chose »."
    }
  ]
};

// ═══════════════════════════════════════════════════════════════
// MODULE 2.6 — BOSS DU CHAPITRE : LE BISON
// ═══════════════════════════════════════════════════════════════
MODULES['2.6'] = {
  num: 6, title: "Le Bison — test de chapitre",
  type: "Boss", duration: 4, xp: 120,
  lead: "Vingt questions, cent quatre-vingts secondes, aucune seconde chance. Voyons ce qui est ancré.",
  hook: "Tu connais maintenant la posture. Reste à voir si tu la portes — sous pression.",
  isBoss: true,
  exercises: [
    {
      id: 'l6', type: 'lesson',
      title: "Avant de lancer le Bison",
      duration: 1,
      body: [
        { type:'p', text:"Tu es sur le point d'enchaîner vingt questions courtes en moins de trois minutes. Pas d'explication intermédiaire, pas de retour en arrière. Chaque erreur compte, chaque seconde compte." },
        { type:'p', text:"Trois choses à savoir avant de lancer :" },
        { type:'highlight', title:"Règles du Bison", text:"1. Tu peux te tromper — c'est la note finale qui compte. 2. Le temps total est de 180 secondes ; à la fin du chrono, le test s'arrête où tu en es. 3. Quatre rangs sont possibles : Or (≥ 90%), Argent (≥ 75%), Bronze (≥ 60%), à retravailler (en dessous)." },
        { type:'p', text:"Si tu rates le rang Or aujourd'hui, ce n'est pas grave — le test est rejouable, et les questions que tu rates reviennent automatiquement dans tes prochaines sessions. <strong>L'idée n'est pas de te piéger — c'est de mesurer ce qui est ancré et ce qui ne l'est pas encore.</strong>" },
        { type:'p', text:"Une dernière chose : ne réfléchis pas trop. Si tu lis une question et que la réponse te vient en une seconde, c'est probablement la bonne. Le Bison teste l'instinct entraîné, pas la déduction lente." },
      ]
    },
    {
      id: 'b1', type: 'bison',
      intro: {
        title: "Le Bison",
        sub: "Vingt questions, cent quatre-vingts secondes. Concentre-toi, respire, puis lance."
      },
      timeLimit: 180,
      passScore: 14,
      questions: [
        { q: "Combien de variables doivent s'aligner pour qu'un placement aboutisse, selon le modèle Novalem ?", options: ["3","4","5","6"], correct: 3 },
        { q: "Quelle est la règle des priorités quotidiennes ?", options: ["1 priorité maximum","3 priorités maximum","5 priorités maximum","Aucune limite"], correct: 1 },
        { q: "Durée d'un cycle de chasse Bison Novalem ?", options: ["10 min sprint","20 min sprint + 5 min pause","45 min focus","Une heure pleine"], correct: 1 },
        { q: "Combien de temps dure un bloc Deep Work Novalem ?", options: ["20 minutes","60 minutes","90 minutes","2 heures"], correct: 2 },
        { q: "Vrai ou Faux : la mémoire d'un bon scout suffit à piloter 30 dossiers.", tf: true, answer: false },
        { q: "Le mail mâché se finit toujours par…", options: ["Une question ouverte","Une question fermée ou un choix binaire","Une signature pro","Une formule de politesse"], correct: 1 },
        { q: "Vrai ou Faux : un client placé il y a 24 mois sans contact depuis est définitivement perdu.", tf: true, answer: false },
        { q: "Le modèle du fromage suisse illustre :", options: ["La défaillance d'un système quand des failles s'alignent","La performance d'une équipe","Le marketing relationnel","La gestion du stress"], correct: 0 },
        { q: "Une notification LinkedIn pendant un sprint Pomodoro, on…", options: ["La traite immédiatement","L'ignore jusqu'à la pause","La traite vite fait","Coupe les notifs avant de commencer"], correct: 3 },
        { q: "Préparer un brief client pour la semaine prochaine, c'est :", options: ["Urgent + Important","Important pas urgent","Urgent pas important","Ni urgent ni important"], correct: 1 },
        { q: "Vrai ou Faux : 14h/jour est un bon indicateur de performance.", tf: true, answer: false },
        { q: "Le scout est un fermier parce que…", options: ["Il vit à la campagne","Il plante des graines sans rien attendre","Il aime la routine","Il déteste les bureaux"], correct: 1 },
        { q: "« Quand êtes-vous dispo cette semaine ? » est :", options: ["Bien mâché","Mal mâché — question ouverte","Acceptable","Excellent en B2B"], correct: 1 },
        { q: "Le « top of mind », c'est :", options: ["Le candidat le plus expérimenté","Être présent à l'esprit quand le besoin se déclare","La concentration profonde","Une technique de mémoire"], correct: 1 },
        { q: "Vrai ou Faux : un like LinkedIn d'un contact dormant est un signal négligeable.", tf: true, answer: false },
        { q: "Fréquence minimale de relance d'un compte dormant ?", options: ["Tous les mois","Tous les trimestres","Tous les six mois","Tous les ans"], correct: 2 },
        { q: "« Choice architecture » (Thaler & Sunstein) signifie :", options: ["Le design d'un site web","La façon de présenter un choix influence la décision","L'architecture d'entreprise","Une méthode de tri"], correct: 1 },
        { q: "Le bon ordre du matin d'un scout :", options: ["Mails → LinkedIn → priorités","Café → priorités → sprint → notifs après","Sprint direct → mails après","Notifs → mails → priorités"], correct: 1 },
        { q: "Une planète qui dérive sur un placement, on…", options: ["Attend qu'elle revienne","Annule le placement","Ouvre une conversation pour la ré-aligner","Compense avec une autre planète"], correct: 2 },
        { q: "L'asset compétitif unique d'un scout senior, c'est :", options: ["Sa base de contacts","Ses tarifs","Le temps cumulé de relations entretenues","Son CRM"], correct: 2 }
      ]
    }
  ]
};
