# Site Lomaya

Site vitrine et réservation en ligne de Lomaya (flottaison, ZI Jarry). HTML, CSS et JavaScript sans dépendance,
aucune étape de construction côté serveur : Vercel, OVH ou n'importe quel hébergement statique le sert tel quel.

## Ce qu'il y a dedans

- `index.html` : la page (générée, ne pas la modifier à la main)
- `mentions-legales.html`, `cgv.html`, `confidentialite.html` : pages légales (générées aussi)
- `css/style.css` : tout le style (grille, couleurs et typographie en tête de fichier)
- `js/config.js` : les réglages du centre (téléphone, formules, prix, cabines, horaires, réservation)
- `js/main.js` : en-tête, menu du téléphone, apparitions au défilement, frise de la séance, questions
- `js/reservation.js` : le panneau de réservation (formule, jour et heure, coordonnées, paiement)
- `assets/` : logo, police (Instrument Sans, licence OFL), image de partage, icônes
- `_src/` : les sources (gabarit de la page, questions fréquentes, pages légales, scripts). Non publiées.

## Mettre en ligne (GitHub + Vercel)

1. Créer le dépôt (par exemple `LEXONOS/lomaya`) et y glisser tout le contenu de ce dossier.
2. Sur Vercel : Add New, Project, importer le dépôt. Framework Preset : **Other**. Build Command : vide.
   Output Directory : vide (la racine). Deploy.
3. Domaine : Settings, Domains, ajouter le domaine choisi, puis poser chez le registraire (OVH) les
   enregistrements DNS que Vercel affiche.

À chaque modification poussée sur GitHub, Vercel republie le site tout seul.

Si l'ancienne version était déjà sur GitHub, y supprimer ces fichiers devenus inutiles :
`assets/fonts/cormorant.woff2`, `assets/fonts/cormorant-italic.woff2`, `assets/fonts/montserrat.woff2`,
`assets/fonts/OFL-cormorant.txt`, `assets/fonts/OFL-montserrat.txt`, `assets/img/forme-photo.svg`.

## La réservation

`js/config.js`, bloc `reservation` :

- `mode: 'auto'` (réglage livré) : le site demande les créneaux à la plateforme Novalem, espace `lomaya`.
  Tant que l'espace n'est pas ouvert, le site bascule sur un **aperçu simulé**, mais seulement sur une adresse
  de test (`*.vercel.app`, `localhost` ou `?apercu=1` dans l'adresse). Sur le vrai domaine, si la plateforme
  ne répond pas, le panneau propose le téléphone et WhatsApp : jamais de fausse réservation en production.
- `mode: 'apercu'` : toujours l'aperçu (démonstration).
- `mode: 'plateforme'` : toujours la plateforme.

Dans l'aperçu : codes d'essai `123ABC` (carte cadeau) et `BIENVENUE` (moins 10 %).

Côté plateforme, il faut : l'espace `lomaya` avec les options « site » et « agenda », la prise de rendez-vous
ouverte, et deux prestations « Séance solo » et « Séance duo » de 90 minutes. Le site sait déjà lire ce que
la brique Lomaya ajoutera ensuite (cabines et décalage de 15 minutes, paiement à la réservation par Stripe,
codes cadeaux et promo). En attendant cette brique, le code saisi et la cabine partent dans le message de la
demande, et le paiement se fait au centre.

## À compléter avant l'ouverture

- `js/config.js` : `ouverture` (date d'ouverture, affichée « Janvier 2027 » en haut de page),
  `offreOuverture.fin` (fin des tarifs d'ouverture : les prix barrés et la mention disparaissent seuls),
  `horaires` (servent à l'aperçu) ; « Précisés à l'ouverture » est remplacé automatiquement par les horaires
  de la fiche dès que la plateforme répond.
- Pages légales (`_src/*.part.html`) : tout ce qui est surligné en jaune (capital, SIREN, TVA, médiateur).
- Le numéro affiché partout est le 0690 60 97 60 (celui du document du site) : à confirmer.
- Les photos (voir plus bas).

## Les photos

Les photos actuelles sont des photos d'illustration Pexels (libres de droits, sans attribution obligatoire),
servies par le réseau de Pexels. Six emplacements, chacun avec un nom :

- `hero` : l'accueil sur ordinateur (format paysage)
- `hero_mobile` : l'accueil sur téléphone (format portrait)
- `flotte` : la grande photo de « La flottaison »
- `sel` : la petite photo de « La flottaison »
- `etoiles` : le fond de « Les bienfaits »
- `serviettes` : la bande de « Contact »

Remplacer une photo par une vraie photo du centre : déposer `assets/photos/<nom>.jpg` puis lancer
`python3 _src/build.py`. Format conseillé : 1600 px de large (1200 px pour `hero_mobile`), moins de 400 ko.
Si le sujet de la photo d'accueil n'est pas bien cadré, changer `--hero-pos` dans `css/style.css`
(par exemple `50% 30%` pour remonter le cadre).

Copier toutes les photos Pexels dans le site (conseillé avant la mise en ligne, pour ne plus dépendre de
Pexels) : `python3 _src/photos.py` puis `python3 _src/build.py`. Une photo déjà présente n'est jamais écrasée.

## Modifier un texte

- Textes de la page : `_src/index.template.html`, puis `python3 _src/build.py`.
- Questions fréquentes : liste `FAQ` dans `_src/build.py` (elle alimente aussi Google), puis la même commande.
- Prix, formules, cabines : `js/config.js`, et la carte des tarifs dans le gabarit.

## Tester sur son ordinateur

```
python3 -m http.server 8000
```
puis ouvrir http://localhost:8000 (l'aperçu de réservation y est actif).
