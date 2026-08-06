# NOVALEM — Espace « Sites internet » · Notice de refonte

> Ce document décrit **ce qui a changé** dans l'espace Sites internet du CRM, **ce que tu dois
> faire avant de l'utiliser en vrai**, et **comment marche le nouveau circuit** (acompte 30 % /
> solde 70 %, signature sur place, hébergement, passation). Il ne concerne **que** l'espace Sites
> (`sites.html` et compagnie). Le reste de la plateforme (recrutement) n'a pas été touché.

---

## 1. À FAIRE AVANT LA PREMIÈRE UTILISATION (5 minutes)

Une seule chose à compléter : tes coordonnées, dans le fichier
**`public/js/sites-app.js`**, tout en haut, dans le bloc `var ENTREPRISE = { ... }`.
Remplace les 4 valeurs marquées, puis pousse sur GitHub (Vercel redéploie tout seul) :

| Champ | Valeur actuelle (à remplacer) | À mettre |
|---|---|---|
| `adresse` | `'Adresse a completer'` | Ton adresse pro complète |
| `ape` | `''` | Ton code APE/NAF (ex : `62.01Z`) — optionnel |
| `paiement.iban` | `'FR76 XXXX …'` | **Ton IBAN** (indispensable pour être payé) |
| `paiement.bic` | `'XXXXXXXX'` | **Ton BIC** |

Le reste (nom, SIRET, email, téléphone, mention TVA) est déjà rempli.

> **Changer le taux d'acompte ?** Un seul chiffre à modifier, juste en dessous :
> `var ACOMPTE_PCT = 30;`. Mets `50` et toute l'appli passe en 50/50 (devis, contrat,
> factures, e-mails, PDF). C'est la **source unique** du modèle de paiement.

---

## 2. CE QUI A CHANGÉ (changelog)

### Le bouton « Supprimer un devis » — enfin accessible partout
Avant, il n'apparaissait que dans le formulaire d'édition, lui-même réservé aux devis
brouillon/envoyé : un devis accepté, refusé ou expiré était **impossible à supprimer**.
Maintenant, le bouton **Supprimer** est présent dans le **panneau du devis** (clic sur
n'importe quel devis), quel que soit son statut. Avec un garde-fou : si une **facture émise**
est rattachée, la suppression est bloquée (une facture émise est inaltérable — c'est la loi ;
on passe par un avoir). S'il n'y a que des brouillons, ça supprime après confirmation.

### Passage au modèle acompte 30 % / solde 70 %
Avant, l'interface disait partout « 100 % à la livraison, aucun acompte » — alors que la base
de données, elle, savait déjà gérer acompte/solde. Tout est désormais aligné sur **30/70** :
- Le **devis-contrat** affiche l'échéancier (acompte à la signature + solde à la livraison) et
  son **article 3** (paiement) est réécrit en conséquence.
- Depuis un devis **signé**, tu génères en un clic la **facture d'acompte (30 %)**, puis, à la
  livraison, la **facture de solde (70 %)**. La facture de solde **déduit automatiquement**
  l'acompte déjà facturé et affiche le net à payer correct.
- E-mails au client, mentions légales, PDF : tout reprend le 30/70 avec les bons montants.
- La fiche de cadrage (`sites-cadrage.html`), qui calculait bizarrement un acompte de 40 %, a
  été alignée sur 30 %.

### Nouveau : le flux « ⚡ Premier RDV »
Sur la fiche d'un client, un bouton **« ⚡ RDV : devis + acompte + signature »**. Il ouvre un
écran unique où tu :
1. composes le devis (lignes libres ou catalogue — pré-rempli depuis le projet du client s'il
   en a un), avec le **total, l'acompte 30 % et le solde 70 % qui se calculent en direct** ;
2. cliques sur **« Créer le devis-contrat → »** : le devis est enregistré, un lien de signature
   est généré, le client passe en « devis envoyé » ;
3. arrives sur l'écran **signature** avec un gros bouton **« ✍ Signer maintenant sur cette
   tablette »** (tu tends la tablette au client) — ou **« Envoyer le lien par e-mail »**.

La signature électronique utilise **ta page maison** (`sites-sign.html`, déjà conforme eIDAS :
jeton, horodatage, empreinte du devis, IP, journal d'audit). Une fois signé, le devis bascule
en **« accepté »** automatiquement ; tu reviens sur la fiche pour **facturer l'acompte**.

### Nouveau : le « Document de passation » (PDF)
Sur la fiche client, bouton **« Passation PDF »**. Il génère un document propre à remettre au
client à la livraison : adresse du site, **nom de domaine (dont il est propriétaire)**,
hébergement, date de renouvellement, coût annuel, accès, et la répartition des responsabilités.
De quoi remplacer la clé USB par un vrai livrable pro.

### Le panneau du devis, plus complet
Selon l'état du devis : bouton PDF, Envoyer, **Facture d'acompte 30 %** puis **Facture de
solde 70 %** (l'un après l'autre), Refusé, et **Supprimer**. La bannière du haut de l'écran
Devis rappelle le circuit complet en 6 étapes.

---

## 3. LE NOUVEAU CIRCUIT, ÉTAPE PAR ÉTAPE

```
1. RDV physique  → ⚡ Premier RDV : devis-contrat composé + signé sur tablette
2. Acompte 30 %  → facture d'acompte générée, envoyée, encaissée → le projet démarre
3. Réalisation   → tu construis le site, tu envoies le lien d'aperçu (Vercel)
4. Validation    → le client valide la maquette
5. Solde 70 %    → facture de solde générée (acompte déduit), encaissée
6. Mise en ligne → domaine du client branché sur l'hébergement → Passation PDF
```

La bannière « Prochaine étape » sur chaque fiche client te dit toujours quoi faire ensuite et
te met le bon bouton sous la main.

---

## 4. HÉBERGEMENT & MISE EN LIGNE — le process recommandé

L'idée qui règle la galère FileZilla/OVH : **séparer le nom de domaine et l'hébergement.**

- **Le nom de domaine** (`www.client.fr`) → enregistré **au nom du client**, c'est SA marque,
  SON URL propre. Il en reste propriétaire.
- **L'hébergement** (là où vivent les fichiers) → une commodité technique **invisible** pour le
  client. Comme tes sites sont en HTML/statique, héberge la **production sur Vercel, sous ton
  compte** : mise en ligne = `git push`, **zéro FTP, zéro identifiant client**.
- **Le lien** : tu pointes le domaine du client vers ton hébergement (2 enregistrements DNS).
  Le client voit **son vrai domaine** — pas un `.vercel.app`. L'URL « propre » vient du domaine,
  pas de l'hébergement.
- **Facturation** : tu avances domaine + hébergement, et tu **refactures une ligne annuelle**
  « hébergement + nom de domaine + maintenance ». Le CRM suit les **dates de renouvellement** et
  t'alerte (badge + rappel automatique ~1 mois avant). L'article 8 du contrat couvre ce montage.

Résultat : plus jamais « donnez-moi votre login OVH », plus de FileZilla. À la livraison : tu
branches le domaine, tu génères la **Passation PDF**, c'est réglé.

---

## 5. ⚠️ DEUX POINTS IMPORTANTS À NE PAS IGNORER

### a) Sécurité de l'accès au CRM — à renforcer (non fait ici, volontairement)
L'accès à la plateforme repose sur un **code PIN stocké côté navigateur** (localStorage),
partagé entre le Hub, le CRM, la formation et l'espace Sites. Ce n'est **pas** une
authentification robuste : quelqu'un qui connaît le PIN (ou qui bricole le navigateur) entre.

Je **n'y ai pas touché** à dessein : le login est mutualisé entre plusieurs pages, et le refaire
à la va-vite risquait de tout casser. Mais pour un usage pro avec des données clients, il faut
prévoir une **vraie authentification** (Supabase Auth : e-mail + mot de passe, voire 2FA) et
resserrer les règles d'accès à la base (RLS) ainsi que la clé publique Supabase. À planifier
comme un chantier à part — je peux t'aider à le faire proprement quand tu veux.

### b) Facturation électronique B2B — l'échéance de 2027
Tu vends à des professionnels. La réforme française de la facturation électronique impose, pour
les micro-entreprises, de **passer par une plateforme agréée** pour **émettre** les factures
B2B **à partir de septembre 2027** (la simple réception via plateforme arrive dès septembre
2026). En clair : à terme, tu ne pourras plus te contenter d'envoyer un **PDF par e-mail** à un
client pro.

Ce CRM reste parfaitement adapté pour tout le **commercial** (devis, contrats, suivi, relances)
et pour **préparer** tes factures. Mais **le générateur de PDF maison n'est pas une solution de
facturation électronique conforme pour toujours** : d'ici 2027, l'émission réelle de tes
factures devra transiter par une plateforme agréée (type Indy, Pennylane…). Anticipe ce
branchement ; garde le CRM comme outil de pilotage.

### c) Je ne suis ni avocat ni expert-comptable
Le contrat (12 articles), le montage 30/70 et les mentions légales sont **solides et de bon
sens**, mais ils méritent une **relecture par ton expert-comptable** (et, si un dossier est
gros, par un juriste). Notamment : le traitement TVA (franchise en base art. 293 B), la
mécanique acompte/solde et les seuils de ta micro-entreprise. C'est une base sérieuse, pas un
avis juridique.

---

## 6. RÉCAP TECHNIQUE (pour info)

- Fichiers modifiés : `public/js/sites-app.js` (cœur de l'espace Sites), `public/sites-sign.html`
  (texte de repli), `public/sites-cadrage.html` (acompte 40 %→30 %).
- Aucune modification de la base de données n'est requise : le schéma (`supabase/sites-schema.sql`)
  gérait déjà les types de facture `acompte`/`solde`. Rien à migrer.
- Déploiement inchangé : `git push` → Vercel redéploie automatiquement.
- Le reste de la plateforme (recrutement, formation, hub, API) est **inchangé**.
