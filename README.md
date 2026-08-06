# Love Dog's — site vitrine

Site vitrine une page pour **Love Dog's** (partenaire canin en Guadeloupe) : éducation canine, dog sitting et nutrition. HTML / CSS / JavaScript natif, sans framework ni étape de build. Il fonctionne tel quel dans n'importe quel navigateur et se met en ligne sur n'importe quel hébergeur.

Design clair et aéré, fond porcelaine chaud, accents or et anthracite, motif patte de chien comme fil conducteur, micro-interactions au survol.

---

## Arborescence

```
love-dogs/
├── index.html          Page unique (contenu, SEO, données structurées)
├── css/style.css       Styles (palette claire, mise en page, animations, responsive)
├── js/main.js          Menu mobile, header au scroll, révélations au défilement
├── mentions-legales.html   Mentions légales (éditeur, hébergeur, RGPD)
├── cgv.html                Conditions générales de vente
├── css/style.css
├── js/main.js
├── assets/
│   ├── logo.png        Logo officiel Love Dog's (blason)
│   ├── hero.jpg / education.jpg / sitting.jpg   Photos d'ambiance
│   └── og-image.png    Image d'aperçu réseaux sociaux
├── favicon.png         Icône d'onglet (logo)
├── robots.txt
├── sitemap.xml
└── README.md
```

---

## Voir le site en local

Double-cliquer sur `index.html`, ou lancer un petit serveur :

```bash
python3 -m http.server 8000     # puis ouvrir http://localhost:8000
```

---

## Mettre en ligne sur GitHub

1. Créer un dépôt (ex. `love-dogs`).
2. Déposer **le contenu** de ce dossier (le `index.html` doit être à la racine du dépôt).
3. Aperçu gratuit : **GitHub Pages** (Settings, Pages, branche `main`, dossier `/root`) ou **Vercel / Netlify** (import du dépôt, aucun réglage de build).
4. Mise en ligne finale chez le client : upload via OVH / FileZilla à la racine, une fois `love-dogs.fr` transféré.

---

## Photos

Les 3 photos d'ambiance sont intégrées (`assets/hero.jpg`, `assets/education.jpg`, `assets/sitting.jpg`), recadrées au format exact de chaque emplacement. Pour en changer une, remplacer le fichier en gardant le même nom, ou modifier le chemin dans `css/style.css` (blocs `.photo-hero`, `.photo-edu`, `.photo-sit`). Format conseillé : portrait pour le héro, paysage pour les deux autres.

**Visuels des sacs de croquettes** : les 4 sacs de la section Nutrition sont des illustrations vectorielles (SVG) dessinées directement dans `index.html`, une couleur par produit (Énergie rouge, Ultra Énergie noir, Wild Spirit doré, Sport bronze). Elles s'affichent toujours, sans dépendre d'un fichier image. Pour changer un nom ou une couleur, modifier le bloc SVG correspondant dans la section `#nutrition`.

---

## Logo

Le logo officiel Love Dog's (le blason) est intégré partout : header, footer, favicon et image de partage. Il est stocké dans `assets/logo.png`. Pour le mettre à jour, remplacer ce fichier en gardant le même nom.

---

## Coordonnées

Numéro, WhatsApp et email apparaissent à plusieurs endroits : `tel:+590690302359`, `https://wa.me/590690302359`, `lovedogs971@gmail.com`. Un simple rechercher / remplacer dans `index.html` suffit si un contact change.

---

## Référencement (SEO)

Déjà en place : `title`, meta description, mots-clés, Open Graph (partage réseaux), `sitemap.xml`, `robots.txt` et surtout les **données structurées `LocalBusiness`** (JSON-LD) avec téléphone, email et zone Guadeloupe.

À faire ensuite pour « apparaître en premier » :
1. **Créer la fiche Google Business Profile** (le client n'en a pas) : c'est le levier n°1 pour la visibilité locale en Guadeloupe.
2. Mettre en ligne sur le domaine définitif puis déclarer le site dans **Google Search Console** (soumettre le `sitemap.xml`).
3. Remplacer les URL `https://www.love-dogs.fr/` dans `index.html`, `sitemap.xml` et `robots.txt` si le domaine final diffère.

---

## Détails techniques

- Aucune dépendance externe hors polices Google (Great Vibes, Sora, Inter).
- Accessible : navigation clavier, focus visible, lien d'évitement, `prefers-reduced-motion` respecté.
- Responsive du mobile au grand écran, bouton WhatsApp flottant sur mobile.

---

## Sections et fonctionnalités

- **Header** : les 3 services (éducation, dog sitting, nutrition) sont présentés dès l'arrivée, sous forme de bandeau cliquable, pour qu'un visiteur qui scanne le QR code comprenne immédiatement l'offre.
- **Tarifs dog sitting** : deux formules claires (1 ou 2 visites/jour) avec compteurs animés, plus les options (promenade, chien supplémentaire, déplacement).
- **Abonnement croquettes** : bloc dédié à la livraison automatique mensuelle avec suivi personnalisé, en complément de l'achat à l'unité.

## Pages légales — à compléter avant mise en ligne

`mentions-legales.html` et `cgv.html` sont des **modèles** pré-remplis avec les informations de Love Dog's (association, SIRET, RNA, TVA), l'hébergeur OVH et la réalisation Novalem. Les mentions entre crochets `[ ... ]` doivent être complétées : adresse du siège, nom du représentant (directeur de publication), moyens de paiement, conditions d'annulation, médiateur de la consommation. Une relecture par un professionnel du droit est recommandée.

Le lien de crédit « Novalem » en pied de page pointe vers `https://novalem-recrutement.fr` ; le domaine du site dans `sitemap.xml` (`love-dogs.fr`) est un exemple à adapter au domaine réel.
