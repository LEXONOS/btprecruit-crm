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
4. **Vendre par email** : Emma lit chaque réponse et répond seule (7 h 30 à 20 h 30), sans jamais proposer d'appel : questions, retouches de l'aperçu (textes, couleurs, logo et photos joints par le client), puis la commande : lien de paiement Stripe au prix de la grille et nom de domaine.
5. **Encaisser et livrer** : Lucas relève les paiements Stripe (pas de webhook : la tour est protégée), réserve le nom de domaine (.com à son nom de marque, prix plafonné) ou relie le sien (réglage DNS envoyé au client, rappels à 3 et 7 jours), met le site en ligne avec ses pages selon la formule, envoie la facture et le lien. Retouches incluses dans les 30 jours, aperçus et liens de paiement oubliés qui expirent (un aperçu expiré revient au même lien si le prospect se manifeste).
6. **Les années suivantes** : 30 jours avant l'anniversaire, lien de paiement de 25 € (hébergement et domaine), rappels à J-7 et J+7, facture au paiement. Toujours impayé 30 jours après l'échéance : le site passe en pause (page neutre sur son domaine, renouvellement du domaine coupé), il revient seul au paiement.

### Garde-fous

- Argent : tous les liens d'une commande restent suivis (un client peut payer un lien remplacé), la formule enregistrée est celle réellement payée, un second paiement est remboursé tout seul, une clé ou une carte de test n'achète jamais de domaine, un nom de domaine dont la commande échoue est écarté (trois échecs : alerte sur la carte du compte Vercel).
- STOP : vaut pour tout email (prospection, relance, réponse, aperçu promis), sauf le service d'un site payé (facture, mise en ligne, hébergement).
- Usurpation : une réponse n'est rattachée que par la référence complète d'un de nos emails ou par l'adresse à qui l'on a écrit ; les outils de vente n'agissent que sur l'auteur du message ; les images et les changements de téléphone, d'email ou d'adresse n'acceptent que l'expéditeur vérifié ; sur le domaine d'un client, aucun autre site n'est accessible.
- Envois : un envoi raté est réessayé (15 min à 24 h), une adresse refusée est écartée, un mot de passe de boîte refusé prévient Louis ; une adresse ne reçoit jamais deux premiers emails.
- Base : au-delà de 1 000 lignes (plafond de Supabase par requête), les lectures paginent.

Les aperçus et les sites des clients vivent dans un projet Vercel PUBLIC séparé (`novalemo-martinique`), la tour reste protégée. Un seul déploiement à la fois contient tous les sites ; chaque domaine client est réécrit vers ses fichiers (comportement vérifié sur Vercel).

## Fichiers

- `index.html`, `assets/hq/` : l'interface (scène 3D, panneaux, organigramme, livrables dont « Sites et ventes », chiffres).
- `api/hq.js` : lecture du monde et actions de Louis. `api/tick.js` : le cycle des agents.
- `lib/seed.js` : la fondation. `lib/runtime.js` (moteur), `lib/tools.js` (outils et garde-fous), `lib/qualite.js` (contrôle qualité), `lib/context.js`, `lib/claude.js`, `lib/mail.js` (SMTP, IMAP, DNS), `lib/martinique.js` (communes, téléphones).
- `lib/sites/` : `atelier.js` (Claude écrit la fiche), `rendu.js` et `theme.js` (le moteur de pages), `photos.js` (lecture du site actuel), `publication.js` (déploiement), `vercel.js`, `stripe.js`, `polices/`.
- `lib/jobs/` : chasseurs, `enrichir.js`, `demo.js` (Noé), `livraison.js` (Lucas), `envoi.js`, `boite.js`.
- `supabase/hq-schema.sql` : les tables `hq_*` (dont `hq_sites` et `hq_fichiers`).
- `test/sim.js` : simulation complète sans réseau, du prospect au site en ligne (`npm test`). `test/serve.js --ventes` : la tour en local avec des ventes simulées.

## Variables Vercel (projet de la tour)

- `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`.
- `HQ_SUPABASE_KEY` : clé secrète (service_role) du projet Supabase Novalemo. Sans elle, mode démo.
- `HQ_MAIL_USER`, `HQ_MAIL_PASS` : la boîte d'envoi (serveur reconnu par les MX). Réglages fins : `HQ_MAIL_NOM`, `HQ_SMTP_HOST`, `HQ_SMTP_PORT`, `HQ_IMAP_HOST`, `HQ_IMAP_PORT`.
- `HQ_VERCEL_TOKEN` : jeton Vercel de l'équipe (hébergement des aperçus et des sites, noms de domaine).
- `HQ_STRIPE_KEY` : clé secrète Stripe live (liens de paiement, factures, remboursement des doublons). Une clé de test ne vend rien : aucun lien n'est envoyé aux clients et aucun domaine n'est acheté.
- Optionnels : `HQ_SITES_DOMAINE` (adresse des aperçus sur ton domaine, ex. `apercu.novalemo.fr`, utilisée dès que son CNAME répond), `HQ_SITES_PROJET` (nom du projet public, `novalemo-martinique` par défaut), `HQ_KEY`, `GITHUB_TOKEN`, `HQ_MODEL_FAST` / `HQ_MODEL_SMART`.

L'identité de vente (vendeur sur les factures et les conditions de vente, titulaire des noms de domaine) se remplit une fois dans la tour.

L'ancien outil ViNego est conservé sur la branche `archive/vinego`.
