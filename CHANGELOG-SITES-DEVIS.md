# Espace Sites — Devis-contrat, facturation sans acompte, retrait de la prospection

Résumé des changements apportés à l'espace **Sites Internet** (le CRM recrutement
n'est pas touché). Aucune migration de base de données supplémentaire n'est nécessaire :
tout est côté navigateur et réutilise les colonnes existantes.

## 1. Onglet « Prospection » retiré
La prospection se fait désormais hors outil (Google Maps) ; seuls les clients qui
répondent sont ajoutés au CRM. Supprimé : l'entrée de menu, la vue, tout le code
carte (Leaflet + Overpass) et les scripts externes correspondants. Le **stage
« Prospect » du pipeline reste** (un client peut toujours être marqué prospect).
Un nouveau client créé démarre maintenant au stage **« Contacté »** par défaut.

## 2. Le devis devient un vrai devis-contrat
- Le devis signé « bon pour accord » **vaut contrat de prestation** : mention portée
  sur l'écran de signature et sur le PDF.
- **12 articles contractuels** ajoutés automatiquement (objet, prix/TVA, paiement,
  délais, obligations du client, validation/révisions, propriété intellectuelle et
  réserve de propriété, hébergement/domaine, SAV, rétractation entre pros, RGPD,
  droit applicable et litiges). Source unique `contratArticles()`.
- **PDF devis-contrat** refait (jsPDF, multi-pages) : en-tête prestataire + client,
  bandeau paiement, tableau des prestations, conditions, **bloc de signature**
  (« bon pour accord ») ; si le devis est déjà signé, la case client affiche
  « signé électroniquement » + la référence eIDAS.

## 3. Facturation « paiement avant mise en ligne », sans acompte
- Modèle confirmé partout : **100 % à réception de la facture, avant mise en ligne,
  aucun acompte** (le devis → facture unique existait déjà, textes alignés).
- **Nouveau PDF de facture** (bouton « PDF » dans l'onglet Factures) : mentions
  légales micro (293 B), **coordonnées de paiement** (bloc `ENTREPRISE.paiement`),
  bandeau « site mis en ligne dès réception du paiement », pénalités de retard B2B.

## 4. Process guidé et lisible
- Bannière « Circuit » en tête de l'onglet Devis (6 étapes).
- « Prochaine étape » de chaque fiche client réécrite pour coller au déroulé :
  contact → devis → signature → réalisation + **lien d'aperçu** → validation →
  facture → **mise en ligne dès paiement** → SAV.
- E-mail d'envoi du devis reformulé (contrat + explication du process en 5 points).

## 5. À compléter une seule fois
En haut de `public/js/sites-app.js`, le bloc **`ENTREPRISE`** : identité légale de
l'exploitant (nom, adresse), et surtout les **coordonnées de paiement** (IBAN / BIC)
pour qu'elles s'impriment sur les factures.

## Rappel important (signature)
Le circuit de signature (`/sites-sign`, table `web_devis_signatures`, fonctions
`web_devis_public` / trigger de passage en « accepté ») est **déjà en place dans le
code**. S'il « ne se passe rien à signer », c'est que la migration
`supabase/sites-schema.sql` n'a pas encore été jouée dans Supabase. La rejouer suffit
(script idempotent).
