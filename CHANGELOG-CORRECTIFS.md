# Correctifs — Déconnexions, Agenda, Processus entretien

## 1. Déconnexions fréquentes (mobile / 4G) — CORRIGÉ
**Cause réelle :** la session était stockée en `sessionStorage`, effacé dès que le
navigateur mobile décharge l'onglet de la mémoire (fréquent quand on change d'appli,
encore plus en partage de connexion 4G). L'onglet revenait sans session → redirection
vers l'écran de connexion. Ce n'était pas la 4G en elle-même.

**Correctif :** session déplacée vers `localStorage` (survit au déchargement d'onglet et
au redémarrage du navigateur), avec une **fenêtre glissante de 7 jours** : chaque ouverture
de l'outil prolonge la session. Appliqué partout : `index.html`, `hub.html`, `crm-auth.js`,
`annuaire.html`, `documents.html`, `statistiques.html`, `formation.html`.
La déconnexion (bouton) vide bien `localStorage`.

## 2. Agenda — mauvaise date dans l'email (mardi au lieu de mercredi) — CORRIGÉ
**Cause :** vous êtes en **Guadeloupe (UTC-4)**. Le code construisait la date de l'email
avec `new Date("2026-06-10")`, interprété par JavaScript comme **minuit UTC** = 20h **la
veille** en Guadeloupe → "mardi 9" au lieu de "mercredi 10". L'événement dans l'agenda,
lui, était correct ; seul le **texte de l'email** affichait la veille.

**Correctif :** `public/js/crm-app.js`
- `proceedToEmail()` : la date du créneau est lue avec `parseDayLocal()` (jour local), plus
  jamais `new Date("YYYY-MM-DD")`.
- Modèle d'email "précal" : date affichée via `fD()` (timezone-safe).
- Plusieurs calculs de « aujourd'hui » (`new Date().toISOString()`) remplacés par `todayKey()`
  pour éviter un décalage le soir en Guadeloupe (tri pipeline, comparaisons agenda, factures).

Le moteur de dates et le **formulaire manuel** de l'agenda étaient déjà corrects : vos saisies
s'enregistrent bien (c'était l'affichage de l'email qui mentait).

## 3. Documents + dossier PDF rattachés automatiquement à la fiche — CORRIGÉ
Avant : à la soumission du dossier, le candidat était marqué « validé », mais ses pièces
n'étaient **qu'envoyées par email** et le « Dossier.pdf » de la fiche était une étiquette vide.

**Correctif :**
- `public/dossier.html` : génère désormais le **PDF complet du dossier signé** (identité,
  situation pro/admin, compétences **et expériences + référents**) côté candidat et l'ajoute
  aux pièces transmises.
- `api/jobs.js` (`handleSubmitDossier`) : **toutes** les pièces reçues sont rattachées à la
  fiche candidat (`cand.docs`), classées dans les bons emplacements :
  CV → `cv`, CNI/passeport/titre de séjour → `id_card`, permis → `permis`,
  carte vitale → `carte_vit`, dossier PDF → `dossier`.
  Stockage en base64 (data URL) → **aperçu et téléchargement directs** dans le CRM, comme les
  uploads manuels. `_dossier_validated_at` est aussi renseigné (affichage « validé le … »).

## 4. Cockpit d'entretien (pop-up) — AJOUTÉ
Nouveau pop-up unique `openInterviewModal(candId)` (`public/js/crm-app.js`) qui réunit :
- le **lien visio** (bouton « Rejoindre » + copier) ;
- le **récap complet du dossier** pour repasser sur toutes les infos pendant l'entretien
  (identité, poste/expérience/salaire/dispo/mobilité/permis, situation administrative,
  compétences CACES/habilitations/logiciels/langues, **expériences passées + référents
  cliquables**) ;
- une zone de **notes d'entretien** (enregistrement + « Entretien fait »).

Accès : clic sur un **entretien du jour** (dashboard) → ouvre directement le pop-up ;
panneau d'un événement visio → bouton « Ouvrir le cockpit d'entretien » + « Rejoindre la
visio » ; onglet « Entretien » de la fiche candidat → bouton cockpit.

---

## À garder en tête (architecture)
Les documents et le PDF du dossier sont stockés **en base64 dans la donnée CRM** (comme les
uploads existants), pas dans un bucket Supabase Storage. C'est simple et l'aperçu marche tout
de suite, mais :
- chaque fichier est limité à 5 Mo côté candidat ;
- avec beaucoup de candidats lourds, la donnée locale peut dépasser le quota du navigateur
  (le cache local est alors ignoré sans planter — le cloud reste la source de vérité) ;
- l'envoi du dossier passe par le corps de la requête (limite ~4,5 Mo sur Vercel).

**Évolution recommandée** (quand le volume grandit) : uploader CV/CNI/permis directement vers
Supabase Storage depuis le navigateur (comme `api/apply.js` le fait déjà pour les CV du site),
ne stocker que les liens sur la fiche, et lire l'aperçu via une URL signée.
