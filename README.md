# La Tour · groupe LEXONOS

Une entreprise entièrement faite d'agents IA, organisée comme une vraie société, et visible en 3D : une tour dans une ville des Antilles la nuit, un étage par entreprise, chaque agent à son bureau, les messages qui voyagent d'un bureau à l'autre, le bureau de Louis sur le toit.

## Le groupe au départ

- **Direction du Groupe** : Maximilien (PDG), Inès (DRH), Hugo (développement), Camille (contrôle de gestion).
- **Labo Avengers** : Tony, Ada (veille GitHub), Alan (veille IA). Ils cherchent les meilleurs projets IA et proposent de les intégrer.
- **Novalemo Sites** : vend des sites aux entreprises de **Martinique uniquement** (la Guadeloupe est le terrain de Studio Novalem), en pilote automatique de bout en bout. DG, directeur commercial, RH, commerciale emailing, fournisseur de contacts, chasseurs (nouveaux domaines .fr, Google Maps, créations BODACC, réseaux), rédactrice, relanceur, Emma (réponses et vente), partenariats, inbound, analyste, chef de production, portfolio, Noé (aperçus), Lucas (mise en ligne).
- **Studio 3D** : vidéos d'ingénierie en 3D pour TikTok et YouTube (veille, scripts ; rendu, voix et publication en attente de branchement).
- **E-commerce Lab** : veille, études de niches, puis boutique validée par Louis.
- **Chantiers** : 4 projets d'entreprises soumis à Louis (Conformité Web, Leads Antilles, Fiches Google, Recover). Validé = un étage de plus.

44 agents. Chacun a une fiche de poste, une stratégie qu'il réécrit lui-même, des connaissances qu'il accumule, un chef, et des outils limités à son rôle.

## Comment ça tourne

- Le cron Vercel appelle `/api/tick` toutes les 15 minutes. Les agents dont c'est l'heure passent : soit un travail automatique (chasse, enrichissement, aperçus, mise en ligne, contrôle des coûts), soit Claude avec des outils.
- Hiérarchie réelle : un agent ne commande que ses équipes ; RH et directeurs donnent leur avis sur les propositions ; DG et PDG tranchent ; ce qui coûte de l'argent hors budget, crée un compte, touche à la loi ou lance une entreprise va à Louis.
- Argent : plafond IA par jour (1,50 $ par défaut) respecté au centime ; quand il se resserre, Novalemo passe en premier (les autres entreprises s'arrêtent à 60 %).

## Novalemo en pilote automatique (Martinique)

1. **Trouver** : nouveaux domaines .fr d'entreprises du 972 (Afnic + annuaire officiel), Google Maps par métier et par commune de Martinique, créations BODACC du 972, prescripteurs. Tout ce qui n'est pas en Martinique est écarté, à chaque étape (chasse, enrichissement, rédaction, envoi).
2. **Montrer** : Noé fabrique d'avance l'aperçu du site de chaque bon prospect. Claude écrit la fiche (textes vrais, aucun chiffre ni promesse inventés, refusés par le contrôle et purgés sinon), le code pose les faits (téléphone, adresse, horaires, note Google, informations légales du registre), reprend les photos, le logo et la couleur de son site actuel, et le moteur met en page (`lib/sites/` : 8 ambiances, 4 compositions, polices auto-hébergées, aucun cookie ni traceur, mentions légales générées). Publié sur un lien privé (non référencé, visible 30 jours après le premier email).
3. **Écrire** : Chloé écrit le premier email avec le lien de l'aperçu. Le contrôle qualité (`lib/qualite.js`) remplace la relecture de Louis : prix de la grille seulement, aucun lien étranger, aucune promesse, aucun mot creux, aucune proposition d'appel, ligne STOP, longueur. Refusé = l'agent réécrit dans le même passage. Envoi depuis la boîte de Louis au rythme de la chauffe (jours ouvrés 8 h à 17 h 30, 5 par jour au début puis jusqu'à 20).
4. **Vendre par email** (et sur WhatsApp une fois branché) : Emma lit chaque réponse et répond seule (7 h 30 à 20 h 30), sans jamais proposer d'appel : questions, retouches de l'aperçu (textes, couleurs, logo et photos joints par le client), puis la commande : deux liens de paiement Stripe au prix de la grille, en une fois (590, 990 ou 1 390 €) ou au mois (49, 89 ou 119 €, engagement 12 mois), le client choisit, et le nom de domaine.
5. **Encaisser et livrer** : Lucas relève les paiements Stripe (pas de webhook : la tour est protégée), réserve le nom de domaine (.com à son nom de marque, prix plafonné) ou relie le sien s'il en a vraiment un (réglage DNS envoyé au client, rappels à 3, 7, 14 et 30 jours avec l'offre d'un nouveau nom inclus), met le site en ligne avec ses pages selon la formule, envoie la facture et le lien. Retouches incluses dans les 30 jours (une par mois pour les abonnés), aperçus et liens de paiement oubliés qui expirent (un aperçu expiré revient au même lien si le prospect se manifeste).
6. **Les années suivantes** (paiement en une fois) : 30 jours avant l'échéance, lien de paiement de 25 € (hébergement et domaine), rappel à J-7, avertissement à J+7, facture au paiement (un an de plus à partir de l'échéance, ou du paiement s'il arrive après). Toujours impayé 30 jours après l'échéance : le site passe en pause (page neutre sur son domaine, renouvellement du domaine coupé), il revient seul au paiement. Les étapes sont toujours espacées, même si le relevé reprend après une coupure.
7. **Au mois** : Stripe prélève chaque mois, la facture part à chaque prélèvement (relevé toutes les heures). Prélèvement raté : email avec le lien de la facture, rappel à 7 jours, site en pause à 14 jours, il revient seul au paiement ; un abonnement que Stripe finit par annuler laisse le site en pause avec un lien de reprise. L'arrêt se demande à tout moment par simple email : pendant l'engagement, il est programmé chez Stripe à la fin des 12 mois (aucune treizième mensualité) ; après, à la fin du mois payé. Un mois avant la fin de l'engagement, le client est prévenu ; sans demande d'arrêt, l'abonnement continue au mois. À l'arrêt, le site reste au client et passe à l'hébergement à 25 € par an. Une mensualité réglée en retard reçoit quand même sa facture ; un site en pause revient dans l'état où il était (en ligne, ou en livraison s'il attendait encore son domaine).

### Garde-fous

- Ciblage : jamais une entreprise qui a déjà un vrai site (récent, en https, adapté au téléphone, pas sur un constructeur gratuit). Seules sont démarchées celles sans site, avec une simple page de réseau social, ou avec un site faible (constructeur gratuit, sans https, illisible sur téléphone, figé depuis 4 ans ou plus, en panne ou en construction) ; ce site faible est lu pour reprendre ses photos, son logo et ses services dans l'aperçu.
- Argent : les paiements sont relevés en une passe sur tout le compte Stripe à chaque cycle (aucune commande oubliée, quel que soit leur nombre), vérifiés lien par lien une fois par jour et dès que Stripe ne répond pas. Tous les liens d'une commande restent suivis (un client peut payer un lien remplacé) ; la formule enregistrée est celle réellement payée, la plus récente s'il en a payé deux, et le second paiement est remboursé tout seul. Un paiement arrivé sur une commande close est encaissé (aperçu expiré entre-temps) ou remboursé (commande annulée). Un client qui paie les deux formules garde la plus récente, l'autre est annulée et remboursée ; un abonnement en trop n'est remboursé qu'une fois vraiment arrêté (sinon réessai à chaque passage, Louis prévenu au troisième échec). Un abonnement arrêté faute de paiement voit ses factures ouvertes annulées ; un mois réglé après l'arrêt est remboursé et le lien de reprise redonné. Un abonnement suivi que le compte Stripe ne connaît pas est signalé à Louis. Une clé ou une carte de test n'achète jamais de domaine et n'envoie aucun lien à un vrai client.
- Domaines : seul un domaine nu qui appartient au client est relié (jamais un sous-domaine Wix, Google ou d'un réseau social) ; un domaine pris par un autre projet Vercel n'est jamais compté comme branché ; un achat resté sans réponse est retrouvé dans le compte avant tout nouvel achat ; un nom dont la commande échoue est écarté (trois échecs : alerte sur la carte du compte Vercel).
- Agents en parallèle : chaque écriture sur un site repart de sa version fraîche et n'a lieu que s'il n'a pas changé d'état entre-temps (un paiement relevé pendant qu'Emma prépare une commande n'est jamais écrasé). Verrous à jeton, plus longs que la limite d'une fonction.
- STOP : vaut pour tout email (prospection, relance, réponse, aperçu promis), y compris le lien de désinscription (STOP dans l'objet), sauf ce qui concerne un site payé (emails de service, réponse à une question qu'il pose). Classé STOP d'office seulement sur le mot seul (« STOP », « stop merci ») ; une phrase (« arrêtez mon abonnement », « arrêt de travail jusqu'à lundi ») va à Emma, et le message d'un client n'est jamais classé STOP d'office.
- Usurpation : une réponse n'est rattachée que par la référence complète d'un de nos emails ou par l'adresse à qui l'on a écrit, et l'adresse ne suffit que si le serveur de réception l'authentifie (DMARC, ou SPF ou DKIM de son domaine). Les outils de vente n'agissent que sur l'auteur du message ; les images et les changements de téléphone, d'email ou d'adresse n'acceptent que l'expéditeur vérifié ; sur le domaine d'un client, aucun autre site n'est accessible.
- Envois : un email est réservé avant de partir (jamais deux fois, jamais après une annulation) ; une erreur passagère est réessayée (15 min à 24 h) ; seule une adresse refusée définitivement est écartée ; un refus pour authentification vient de notre domaine d'envoi : le prospect est gardé, Louis est prévenu, la prospection se met en pause après trois refus ; une adresse ne reçoit jamais deux premiers emails.
- Zone : Lamentin, Sainte-Anne, Saint-Pierre et d'autres noms existent aussi en Guadeloupe, à La Réunion ou dans l'Hexagone : seuls, ils ne prouvent rien (code postal 972 ou numéro de Martinique exigé).
- Base : au-delà de 1 000 lignes (plafond de Supabase par requête), les lectures paginent ; aucune file de travail n'est plafonnée.

## WhatsApp (prêt à brancher)

- Tant qu'il n'est pas branché, la tour mesure la demande : prospects qui demandent WhatsApp ou un appel, prospects joignables seulement par téléphone. À partir de 3 demandes WhatsApp (ou 6 demandes en tout) sur 30 jours, Louis est prévenu, une fois par mois au plus.
- Branché (mission WhatsApp : une SIM de Martinique, un compte Kapso, deux codes), `/api/whatsapp` relève les messages toutes les 5 minutes sans webhook (verrou à lui, il ne bloque jamais le cycle des 15 minutes), rattache l'expéditeur au prospect par son numéro (le client d'abord si deux fiches partagent le numéro ; un inconnu devient un prospect ; un client qui écrit sous un nom d'utilisateur sans numéro est gardé et joignable), et Emma répond sur WhatsApp comme par email. Une photo envoyée sur WhatsApp est gardée comme une pièce jointe, pour la retouche.
- Jamais de premier message sur WhatsApp (règle de Meta : aucune prospection). Passé 24 h sans message du client, Meta interdit le message libre : la réponse part par email, ou Louis est prévenu s'il n'y en a pas. STOP vaut aussi sur WhatsApp.

## Missions (bouton Missions de la tour)

Ce que Louis fait une seule fois, étape par étape, chaque étape vérifiée pour de vrai : jeton Vercel, base, Stripe, boîte d'envoi, identité de vente, réglages DNS de la boîte, mentions des factures Stripe, activité déclarée ; puis, quand ils servent, le premier nom de domaine, WhatsApp et le sous-domaine des aperçus. Chaque code collé est essayé avant d'être enregistré (clé de test, clé publique, mot de passe faux, jeton sans accès : refusés avec la raison), la tour l'écrit elle-même dans les variables Vercel de son projet (type sensible) et redémarre. Aucun code n'est gardé en base, renvoyé à l'écran ou écrit dans un journal. Un code ne s'enregistre que depuis la page de la tour, derrière la protection Vercel (sinon refusé) ; une clé d'un autre compte Stripe ne remplace jamais celle qui marche ; Louis est prévenu de chaque code enregistré, par email s'il en remplace un.

Les aperçus et les sites des clients vivent dans un projet Vercel PUBLIC séparé (`novalemo-martinique`), la tour reste protégée. Un seul déploiement à la fois contient tous les sites ; chaque domaine client est réécrit vers ses fichiers (comportement vérifié sur Vercel).

## Fichiers

- `index.html`, `assets/hq/` : l'interface (scène 3D, panneaux, organigramme, livrables dont « Sites et ventes », chiffres).
- `api/hq.js` : lecture du monde et actions de Louis. `api/tick.js` : le cycle des agents.
- `lib/seed.js` : la fondation. `lib/runtime.js` (moteur), `lib/tools.js` (outils et garde-fous), `lib/qualite.js` (contrôle qualité), `lib/context.js`, `lib/claude.js`, `lib/mail.js` (SMTP, IMAP, DNS), `lib/martinique.js` (communes, téléphones).
- `lib/sites/` : `atelier.js` (Claude écrit la fiche), `rendu.js` et `theme.js` (le moteur de pages), `photos.js` (lecture du site actuel), `publication.js` (déploiement), `vercel.js`, `stripe.js`, `polices/`.
- `lib/jobs/` : chasseurs, `enrichir.js`, `demo.js` (Noé), `livraison.js` (Lucas : paiements, abonnements, domaines, renouvellements), `envoi.js`, `boite.js`, `whatsapp.js` (relève et mesure de la demande).
- `lib/missions.js` : les missions de Louis (états, vérification des codes, écriture dans Vercel). `lib/whatsapp.js` : Kapso. `api/whatsapp.js` : le cron express de WhatsApp.
- `supabase/hq-schema.sql` : les tables `hq_*` (dont `hq_sites` et `hq_fichiers`).
- `test/sim.js` : simulation complète sans réseau, du prospect au site en ligne (`npm test`). `test/serve.js --ventes` : la tour en local avec des ventes simulées.

## Variables Vercel (projet de la tour)

Toutes celles de Novalemo se posent depuis la tour (Missions), sans ouvrir Vercel.

- `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`.
- `HQ_SUPABASE_KEY` : clé secrète (service_role) du projet Supabase Novalemo. Sans elle, mode démo.
- `HQ_MAIL_USER`, `HQ_MAIL_PASS` : la boîte d'envoi (serveur reconnu par les MX). Réglages fins : `HQ_MAIL_NOM`, `HQ_SMTP_HOST`, `HQ_SMTP_PORT`, `HQ_IMAP_HOST`, `HQ_IMAP_PORT`.
- `HQ_VERCEL_TOKEN` : jeton Vercel de l'équipe (hébergement des aperçus et des sites, noms de domaine).
- `HQ_STRIPE_KEY` : clé secrète Stripe live (liens de paiement, factures, remboursement des doublons). Une clé de test ne vend rien : aucun lien n'est envoyé aux clients et aucun domaine n'est acheté.
- `HQ_WHATSAPP_KEY` (clé API Kapso), `HQ_WHATSAPP_NUMERO` (identifiant du numéro chez Kapso), `HQ_WHATSAPP_TEL` (numéro affiché). Sans elles, pas de WhatsApp : la demande est seulement mesurée.
- Optionnels : `HQ_SITES_DOMAINE` (adresse des aperçus sur ton domaine, ex. `apercu.novalemo.fr`, utilisée dès que son CNAME répond), `HQ_SITES_PROJET` (nom du projet public, `novalemo-martinique` par défaut), `HQ_KEY`, `GITHUB_TOKEN`, `HQ_MODEL_FAST` / `HQ_MODEL_SMART`.

L'identité de vente (vendeur sur les factures et les conditions de vente, titulaire des noms de domaine) se remplit une fois dans la tour.

L'ancien outil ViNego est conservé sur la branche `archive/vinego`.
