# Stock Stores - site vitrine une page

Site statique (HTML / CSS / JS natif, aucun build). A deposer tel quel dans le dossier www de l'hebergement OVH, ou pousser sur GitHub pour un apercu Vercel.

## Fichiers
- index.html : page unique
- mentions-legales.html : mentions legales (noindex)
- styles.css / script.js
- assets/ : logo (fond transparent + version blanche), photos webp en 3 tailles (srcset), favicon, og-image.jpg
- assets/fonts/ : Fraunces + Archivo embarquees (OFL), aucune requete Google Fonts
- charte.html : charte graphique a remettre au client (noindex)
- robots.txt, sitemap.xml, .htaccess (https + sans www, cache, compression : OVH uniquement, ignore par Vercel)

## A completer avant mise en ligne (rechercher "A COMPLETER" / "A-MODIFIER")
- mentions-legales.html : raison sociale, forme juridique, capital, SIREN, adresse exacte, directeur de publication
- index.html : adresse exacte de l'atelier a Jarry (2 endroits : section contact + JSON-LD) et horaires si souhaites
- Verifier le numero affiche (+590 690 67 27 85, celui de la fiche). L'illustration de l'atelier montre un 0590 28 88 32 : a confirmer, et l'ajouter si c'est bien la ligne fixe.
- Liens Instagram / Facebook / Google si le client en a (pas prevus pour l'instant : "aucun" a confirmer)

## Fonctionnement du formulaire
Le formulaire ne stocke rien : il compose un message WhatsApp pre-rempli (ou un email en repli) que le visiteur envoie lui-meme. Aucun backend, aucune cle.

## Canonical / domaine
Les URLs pointent sur https://stock-stores.com/ (domaine existant chez Ionos).


## Guide des stores (v5)
La section « Nos stores » est un guide au scroll : un schéma technique (SVG dessiné sur mesure)
reste fixé à l'écran et se déploie au rythme du défilement, pendant que les 4 chapitres
(bras droits, bras invisibles, vertical à guides, vertical à coulisses) expliquent chaque mécanisme.
Un tableau « Lequel choisir ? » (#choisir) résume les différences. Aucun fichier externe :
tout est dans index.html (SVG), styles.css et script.js (géométrie calculée en JS,
prefers-reduced-motion respecté : schémas affichés déployés, sans animation).
