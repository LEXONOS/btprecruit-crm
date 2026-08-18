# NOVALEM APP — installation (10 minutes, une seule fois)

## 1. Creer le repo GitHub (2 min)
1. github.com > bouton + en haut a droite > New repository
2. Nom : novalem-app / Private / Create repository
3. Pousse le contenu de ce dossier dedans (comme d'habitude)

## 2. Creer le projet Vercel (3 min)
1. vercel.com > Add New > Project > importe novalem-app
2. Framework preset : Other. Deploy.

## 3. Variables d'environnement (3 min)
Vercel > novalem-app > Settings > Environment Variables :
- RESEND_API_KEY = la meme valeur que dans le projet btprecruit-crm
  (btprecruit-crm > Settings > Environment Variables > copier RESEND_API_KEY)
- SENDER_EMAIL   = contact@novalem-recrutement.fr
- SENDER_NAME    = Louis RENAULT - NOVALEM
Puis Deployments > les trois points sur le dernier > Redeploy.

## 4. Comptes de connexion (rien a faire)
On se connecte avec PRENOM + NOM + mot de passe : l'app construit
toute seule l'email interne (prenom.nom@novalem.internal), les
comptes existants (toi, Leyla) marchent directement.
Un nouveau venu passe par l'onglet "Demander un acces" : sa demande
apparait chez toi dans "Demandes d'acces" (badge rouge), tu Acceptes
(le compte est cree automatiquement) ou tu Refuses.
Prerequis pour la validation : la variable SUPABASE_SERVICE_ROLE_KEY
(deja demandee a l'etape 6 pour l'usine) doit etre presente.

## 5. URL propre (quand tu as le domaine)
Vercel > novalem-app > Settings > Domains > Add > ex: crm.novalem.fr
Vercel te donne un enregistrement CNAME a coller chez OVH (Zone DNS).

## Ce qui marche des maintenant
- Connexion email + mot de passe, roles (Louis = tout, Leyla = commercial)
- Session d'appel : file intelligente (relances du jour > rappels > nouveaux),
  gros bouton d'appel, issues : RDV pris (agenda integre avec tes creneaux
  occupes + mail fiche automatique), Veut un mail (fiche + relance auto),
  A rappeler (avec nudge "prends le mail"), Pas de reponse (bas de file),
  Pas interesse (tableau dedie avec bouton "remettre en file")
- Relances du jour + relances programmees
- Reperage : carte OpenStreetMap, clic = nouvelle cible dans la file
- Agenda semaine/jour (le composant que tu aimes), RDV + rappels + taches
- Tache rapide depuis la barre du haut (marche tres bien sur telephone)
- Tableau de bord Louis : CA en jeu, CA potentiel (RDV x 390), sites a
  produire, taches du jour, charge de la semaine avec jours libres
- Vues Production et Clients en lecture (Phases 3 et 4 a venir)

## Donnees
L'app lit et ecrit dans les MEMES tables Supabase que l'ancien CRM :
rien a migrer, tes fiches et celles de Leyla sont deja dedans.
L'ancien CRM reste accessible en parallele tant que tu veux.

## 6. Usine a sites (pole Production) — 8 min, une seule fois
La vue "Sites a produire" > "Ouvrir l'atelier" utilise l'usine a sites.
Prerequis :
1. Supabase > SQL Editor > executer le fichier supabase/usine-schema.sql
   du ZIP btprecruit-crm-usine-et-fix (table web_usine + bucket web-usine).
2. Cle API Anthropic : console.anthropic.com > API keys > Create key,
   copie la cle (sk-ant-...).
3. Token GitHub : github.com > Settings > Developer settings >
   Personal access tokens > Fine-grained > Generate. Nom novalem-usine,
   expiration 1 an, All repositories, permissions Repository :
   Administration = Read and write, Contents = Read and write.
4. Token Vercel : vercel.com > Account Settings > Tokens > Create,
   scope Full Account.
5. Variables dans Vercel > novalem-app > Settings > Environment Variables :
   - ANTHROPIC_API_KEY = la cle Anthropic
   - SUPABASE_URL = https://hfdkkdyyhpymrwiqmitn.supabase.co
   - SUPABASE_SERVICE_ROLE_KEY = Supabase > Settings > API > service_role
   - GITHUB_TOKEN = le token GitHub
   - GITHUB_OWNER = LEXONOS
   - VERCEL_TOKEN = le token Vercel
   Puis Redeploy.
6. Vercel Pro obligatoire sur ce projet (la generation IA depasse les
   limites du plan gratuit).

## 7. Phase 4 — rappels avec heure/note + apres-vente (1 min)
Supabase > SQL Editor > executer le fichier supabase/phase4.sql
(ajoute l'heure et la note sur les rappels, et l'abonnement mensuel
sur les hebergements). Sans ca, l'enregistrement d'un rappel avec
heure/note echouera.

## 8. Phase 5 — boite mail + devis + cadrage + dashboard (5 min)
1. Supabase > SQL Editor > executer supabase/phase5.sql (table des charges).
2. Boite mail (reception) : dans Vercel > novalem-app > Environment
   Variables, copie depuis l'ancien projet btprecruit-crm les 4 variables :
   IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS. Puis Redeploy.
   (Ce sont les acces de contact@recrutement-novalem.fr, deja configures
   dans l'ancien CRM.)
Le reste (devis dans le dossier client, fiche de cadrage dans l'atelier,
stats de conversion et outil charges sur le tableau de bord) marche sans
aucune configuration.
