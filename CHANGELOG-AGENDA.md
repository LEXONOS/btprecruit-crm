# Refonte Agenda & Rappels — Changelog

## Le bug d'origine (corrigé)
Un rappel créé pour **demain** s'affichait à la date d'**aujourd'hui** sur le dashboard.

**Cause racine :** l'agenda enregistrait les dates au bon format (`2026-06-09`), mais le
dashboard les lisait avec `new Date("2026-06-09")`, que JavaScript interprète comme
**minuit UTC**. Sur un fuseau derrière UTC, minuit UTC le 9 juin = le 8 juin au soir en
local → le dashboard croyait que le rappel de demain était pour aujourd'hui.
Deux systèmes de dates coexistaient et se contredisaient.

## 1. Moteur de dates timezone-safe (fondation)
Source unique de vérité, ajoutée en haut de `crm-app.js` :
- `dayKey(v)` → renvoie la **journée locale** `YYYY-MM-DD` de n'importe quelle valeur (date
  seule, ISO complet, Date, ms). Ne fait jamais de conversion UTC hasardeuse.
- `todayKey()`, `parseDayLocal(v)` (date seule → midi local, jamais de décalage),
  `addWorkingDays(date, n)` (saute samedi/dimanche), `shiftDayKey(key, n)`.
- `fD`, `isToday`, `isPast` réécrites en timezone-safe + ajout de `isTomorrow`.

## 2. Création d'agenda centralisée
Tout passe désormais par **`addAgendaAuto()`** → date toujours normalisée en jour local,
champs cohérents (id, created, done, liens candidat/entreprise). Plus aucun décalage possible.
Sites migrés : entretien visio, précal auto, **rappels prospects**, relances profil (CV envoyé),
toast de proposition de rappel, formulaire manuel.

## 3. Rappels prospects fiabilisés
- Un rappel prospect atterrit **toujours** dans l'agenda (avant : seulement si une heure était
  saisie) et **embarque la note** comme contexte.
- `next_call_date` stocké en jour local ; toute la logique « rappel dû / futur / NRP → jour
  suivant » comparée par clé de jour (même bug corrigé là aussi).

## 4. Automatisation des contrats
- **Envoi d'un contrat** → 2 entrées d'agenda automatiques : une trace « Contrat envoyé — …
  » (datée du jour) + une **relance de signature à J+3 ouvrés** (liée à l'entreprise, avec note).
  Anti-doublon si renvoi.
- **Signature détectée** → la relance en attente est **clôturée automatiquement** et une trace
  « Contrat signé — … » est ajoutée.

## 5. Panneau d'événement enrichi (clic sur un rappel)
- Bandeau d'état coloré (En retard / Aujourd'hui / Demain / À venir / Terminé).
- **Carte contexte** : entreprise ou candidat lié avec **téléphone (Appeler / Copier), email
  (mailto), ville/adresse, contact** — directement actionnable.
- La **note** (le contexte saisi) est mise en avant.
- Actions rapides : Terminer/Rouvrir, Modifier, Supprimer, et **report express**
  (+1 jour / Demain / +3 jours / +1 semaine) sans rouvrir le formulaire.

## 6. Suivi sur les fiches
Les fiches **entreprise** et **candidat** affichent une section « Suivi & rappels » : tous les
événements liés (en cours + historique repliable), cliquables, avec bouton « + Rappel ».

## 7. Dashboard — cockpit « charge mentale zéro »
Colonne agenda repensée : **En retard** → **Entretiens du jour** → **À faire aujourd'hui** →
**Demain (anticiper)**. Chaque ligne montre l'icône, l'entité liée et un **extrait de la note**.
Un clic ouvre le panneau contextuel complet (avec le numéro à appeler).

## 8. Types d'événements
Icônes ajoutées (📞 🎥 ✅ 🔁) + nouveaux types **📄 Contrat** et **🤝 Rendez-vous**
(couleurs CSS dans les vues jour/semaine/mois).

## 9. Emails de récap (serveur)
`api/send-reminders.js` et `api/cron-reminders.js` corrigés du même bug, via le nouveau
`api/_lib/dates.js`. Le « jour » est calculé dans un **fuseau métier configurable**
(variable d'env `CRM_TZ`, défaut `Europe/Paris`).

---
### Fichiers modifiés
- `public/js/crm-app.js` — moteur de dates, automatisations, panneau, dashboard, fiches
- `public/css/crm-styles.css` — styles des types Contrat / Rendez-vous
- `api/send-reminders.js`, `api/cron-reminders.js` — récaps timezone-safe
- `api/_lib/dates.js` — **nouveau** helper de dates serveur
