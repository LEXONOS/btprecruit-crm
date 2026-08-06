# NOVALEM — Espace Sites internet · Notice v2

> Ce document remplace `NOTICE-REFONTE-SITES.md`. Il décrit ce qui a changé, ce que tu dois
> faire une seule fois avant d'utiliser le CRM en vrai, et comment le circuit fonctionne
> maintenant. Seul l'espace Sites est concerné. Le CRM recrutement n'a pas été touché.

---

## 1. À FAIRE UNE FOIS (10 minutes)

### a) Jouer la migration SQL
Supabase → SQL Editor → New query → colle **tout** `supabase/sites-schema-v2.sql` → Run.

Elle ajoute trois choses :
- `web_parametres` : tes réglages, partagés entre tous tes appareils
- `web_devis.acompte_pct` : l'échéancier choisi devis par devis
- `web_factures` : désignation, lignes, date de paiement, date d'envoi, note interne

L'application **fonctionne sans** cette migration : elle détecte les colonnes absentes et se
replie sur des valeurs par défaut, sans planter. Mais tu perds l'échéancier par devis et le
suivi fin des factures, et tes réglages restent stockés sur un seul navigateur.

### b) Remplir les Paramètres
Dans le CRM Sites : bouton **Paramètres & documents** en bas de la barre latérale (ou menu
utilisateur en haut à droite).

Le minimum pour émettre des documents conformes :

| Onglet | Champ | Pourquoi |
|---|---|---|
| Entreprise | Adresse complète | Obligatoire sur devis, contrat et facture |
| Entreprise | SIRET | Déjà rempli, vérifie-le |
| Paiement | Titulaire, IBAN, BIC | Sans ça, le client ne peut pas te payer |

Tant qu'il manque quelque chose, le CRM te le rappelle : au démarrage, en bandeau orange sur
le formulaire de devis et la vue Factures, et en rouge sur le PDF de facture. Impossible
d'envoyer une facture muette sans t'en apercevoir.

---

## 2. LES PARAMÈTRES, ONGLET PAR ONGLET

**Entreprise** — nom commercial, exploitant, forme juridique, adresse, SIRET, APE, e-mail,
téléphone, mention TVA, baseline affichée sous le logo sur les PDF.

**Paiement** — titulaire, banque, IBAN, BIC, autres modalités, mention légale de retard de
paiement. Tout est imprimé sur chaque facture.

**Échéancier** — l'échéancier proposé **par défaut** sur un nouveau devis (30/70, 50/50,
100 % à la livraison, 100 % à la commande, ou un pourcentage libre), la validité des devis
en jours, et les délais d'échéance des factures d'acompte et de solde.

**Textes** — le bloc « Ce qui est compris » imprimé sur le devis (une ligne = un argument),
les pieds de devis et de facture, et les 4 modèles d'e-mails : envoi de devis, envoi de
facture, relance impayée, livraison. Les variables disponibles sont listées dans l'onglet :
`{contact} {client} {numero} {total} {montant} {acompte} {solde} {acompte_pct} {solde_pct}
{echeance} {lien} {url} {etapes} {contexte} {iban} {bic} {titulaire} {tva} {validite_j}
{entreprise} {exploitant} {tel} {email} {baseline}`.

**Contrat** — les articles du contrat, modifiables un par un : édition du titre et du corps,
ajout, suppression, réordonnancement, retour aux articles par défaut. Variables utilisables :
`{echeancier}` (la phrase de paiement générée pour CE devis), `{acompte_pct}`, `{solde_pct}`,
`{tva}`, `{cession}`, `{entreprise}`, `{exploitant}`.

**Catalogue** — les prestations et leurs prix, ponctuelles et mensuelles. Elles alimentent le
menu déroulant du devis.

**Automatismes** — quatre interrupteurs :
- joindre le PDF aux e-mails sortants (activé)
- créer la facture automatiquement dès que le client signe (activé)
- envoyer cette facture par e-mail automatiquement (désactivé : à n'activer qu'une fois tes
  coordonnées bancaires et tes textes vérifiés)
- programmer une relance à l'émission d'une facture (activé)

---

## 3. L'ÉCHÉANCIER, DEVIS PAR DEVIS

C'est le changement de fond. Avant, un seul chiffre valait pour toute l'application. Maintenant
chaque devis porte le sien.

Quatre boutons plus un champ libre, présents dans le formulaire de devis, dans le flux
**⚡ Premier RDV**, et dans **Changer l'échéancier** sur un devis pas encore signé :

| Choix | Effet |
|---|---|
| 30 / 70 | Acompte 30 % à la signature, solde 70 % à la livraison |
| 50 / 50 | Acompte 50 %, solde 50 % |
| 100 % livraison | Aucun acompte, une seule facture à la livraison |
| 100 % commande | Une seule facture, réglée à la signature |
| % libre | N'importe quelle valeur entre 0 et 100 |

Le total, l'acompte et le solde se recalculent en direct pendant que tu composes le devis.

Ce qui suit automatiquement, sans que tu aies rien à retoucher : l'article 3 du contrat, le
bandeau de paiement du PDF, la ligne de totaux, les boutons de facturation sur le panneau du
devis, les montants et libellés des factures, le PDF de facture, l'e-mail au client, la
bannière « prochaine étape » sur la fiche client, et la fiche de cadrage.

En 100 %, il n'y a plus ni acompte ni solde : un seul bouton **Facturer la totalité**, une
seule facture, libellée « Création de site internet » et non « Acompte de X % ».

---

## 4. LE BOUTON CONNEXION

Dans l'espace Sites, il n'avait aucun code derrière : ni clic, ni mise à jour. Il affichait
« Connexion » indéfiniment, quoi qu'il arrive. Maintenant :

- **● Connecté** (vert) : données chargées, heure de la dernière synchro dans l'infobulle
- **● Synchro...** (or) : chargement en cours
- **● Hors ligne** (rouge) : la cause exacte est dans l'infobulle

Au clic, un panneau de diagnostic : état, dernière synchro, session (et son e-mail), projet
Supabase, présence de la table des paramètres, dernière erreur, nombre de lignes par table,
colonnes manquantes en base, et deux boutons pour recharger ou resynchroniser.

Il réagit aussi aux coupures réseau du navigateur : perte de connexion signalée, resynchro
automatique au retour.

---

## 5. BUGS CORRIGÉS

**Requêtes lancées avant la session (le plus important).** L'application interrogeait Supabase
sans attendre que la session soit restaurée depuis le navigateur. Selon la vitesse de
restauration, les premières requêtes partaient en anonyme et revenaient vides : écrans vides,
données « disparues », impression que le CRM ne marche pas. L'initialisation attend désormais
la session, puis charge les paramètres, puis les données.

**Formulaire de facture.** Il forçait le type « solde » à chaque enregistrement (une facture
d'acompte éditée devenait un solde) et perdait le lien vers le devis et le projet, même quand
il avait été ouvert depuis un devis. Le formulaire propose maintenant client, devis lié, type,
objet, montant, échéance et note interne, et conserve tout.

**Aucun moyen d'envoyer une facture.** Il n'y avait ni bouton d'envoi, ni relance, ni trace
d'envoi. Ajoutés, avec PDF joint.

**Encaissement sans date.** Le statut « payée » n'enregistrait aucune date de paiement.

**Brouillons de facture non supprimables** depuis la liste.

**Catalogue en double.** Les prix du catalogue étaient codés en dur dans le JS et divergeaient
déjà de ta grille tarifaire réelle. Source unique désormais : les Paramètres.

---

## 6. CE QUI A ÉTÉ AJOUTÉ POUR TA CHARGE MENTALE

- **Envoi par e-mail avec PDF joint** du devis-contrat et des factures, via `/api/send-email`.
  Si Resend n'est pas joignable, bascule automatique sur ta messagerie (mailto).
- **Trace automatique** dans les interactions du client à chaque envoi, signature ou
  encaissement. Tu retrouves l'historique sur la fiche sans le saisir.
- **Enchaînement après signature** : la facture est préparée toute seule (acompte, ou facture
  unique selon l'échéancier), et part par e-mail si tu actives l'option. En 100 % à la
  livraison, rien n'est facturé à la signature, c'est volontaire.
- **Relance programmée** 3 jours après l'échéance, créée dans l'agenda à l'émission d'une
  facture, et refermée automatiquement dès que tu marques la facture payée.
- **Vue Factures** : trois compteurs (encaissé, en attente, en retard), bouton de relance sur
  les factures échues, indicateur « envoyée ».
- **Recherche dans le pipeline** : filtre sur entreprise, contact, ville, secteur, e-mail,
  téléphone.

---

## 7. FICHIERS

| Fichier | État |
|---|---|
| `public/js/sites-config.js` | **nouveau** — paramètres, échéancier, textes, panneau de réglages |
| `public/js/sites-app.js` | modifié en profondeur |
| `public/sites.html` | bouton Paramètres, indicateur de connexion cliquable, chargement du module |
| `public/sites-cadrage.html` | échéancier et mentions dynamiques (elle calculait 30 % en dur) |
| `public/sites-sign.html` | texte de repli neutre (il annonçait 30/70 quoi qu'il arrive) |
| `supabase/sites-schema-v2.sql` | **nouveau** — migration à jouer une fois |

Déploiement inchangé : `git push`, Vercel redéploie. Le reste de la plateforme (recrutement,
formation, hub, API) est intact.

---

## 8. DEUX POINTS À NE PAS ENTERRER

### a) La sécurité d'accès
Les règles de la base (RLS) autorisent **tout utilisateur authentifié** à lire et écrire
l'ensemble des données Sites : clients, devis, factures, et la table des accès qui contient des
identifiants et mots de passe clients. Tant que tu es seul, le risque est théorique. Dès qu'un
compte supplémentaire existe, il faut cloisonner (la variante stricte est déjà écrite en bas de
`sites-schema.sql`) et, pour les mots de passe clients, envisager un gestionnaire dédié plutôt
que la base. C'est un chantier à part, à faire à froid.

### b) La facturation électronique B2B
Tu vends à des professionnels. À partir de septembre 2027, l'émission des factures B2B devra
transiter par une plateforme agréée : un PDF envoyé par e-mail ne suffira plus. Ce CRM reste
parfaitement adapté au commercial et à la préparation des factures, mais prévois le
branchement sur une plateforme le moment venu.

Et le rappel d'usage : le contrat, l'échéancier et les mentions sont solides et de bon sens,
mais méritent une relecture par ton expert-comptable. Ce n'est pas un avis juridique.
