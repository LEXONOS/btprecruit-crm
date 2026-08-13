# UNIK'EAU — fontaine-guadeloupe.fr (v3 « Eau vive »)

Site vitrine one-page statique. Aucune dépendance à installer : HTML + CSS + JS.

## Contenu
- `index.html` — la page
- `styles.css` — design system « Eau vive » (voir `charte.html`)
- `script.js` — interactions (scrollytelling filtration, bascule tarifs Location/Achat, menu, FAQ)
- `assets/` — photos, logo, favicons, modèles 3D (`assets/3d`), moteur `model-viewer` local (`assets/vendor`), fiche technique PDF
- `charte.html` — charte graphique (non indexée)
- `robots.txt`, `sitemap.xml`, `vercel.json`

## Avant mise en ligne
Chercher `A-MODIFIER` dans `index.html` : il reste les 2 vraies adresses e-mail à remplacer
(placeholder actuel : contact@fontaine-guadeloupe.fr).

## Déployer (GitHub + Vercel)
1. Pousser ce dossier tel quel dans le repo GitHub.
2. Vercel détecte un site statique : aucun réglage, `vercel.json` gère les en-têtes.
3. Rattacher le domaine fontaine-guadeloupe.fr (OVH) dans les réglages du projet Vercel.

## Tarifs affichés (source : devis O'ELEC D-2026-016, TVA 8,5 %)
- Location : comptoir 50 € TTC/mois, colonne 70 € TTC/mois, entretien compris, garantie pendant le contrat
- Achat : comptoir 699 € TTC, colonne 799 € TTC, + 200 € TTC d'installation
- Entretien à l'achat : 244 € TTC/an (1 à 4 pers., semestriel) ou 488 € TTC/an (5+, trimestriel)
