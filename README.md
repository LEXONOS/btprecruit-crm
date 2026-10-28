# ViNego Cockpit

Outil de pilotage pour le business game ViNego (Sciado), côté distributeur.

- **Import intelligent** : glisse ou colle (Ctrl+V) tes captures d'écran du simulateur, un PDF ou le texte d'une page. L'IA lit tout et remplit l'outil ; tu vérifies avant d'appliquer.
- **Mois par mois** : planification (prix, délais, marketing avec recommandations), ventes et achats (demande, indices, tri, répartition, plan d'achat), résultats (débrief et plan du mois suivant par l'IA).
- **Coach** : checklist de la phase, alertes, ce qu'il faut anticiper, et un chat IA qui connaît la stratégie et toutes tes données.
- **Négociations** : chaque offre avec le verdict (accepter, négocier, refuser) et la contre-offre conseillée, mails prêts à copier.

Les données restent dans le navigateur (export en fichier dans Paramètres).

## Technique

- Pages statiques : `index.html`, `assets/` (aucune étape de build).
- Fonction Vercel `api/ai.js` : appelle l'API Anthropic avec la variable d'environnement `ANTHROPIC_API_KEY`.
- Variables optionnelles : `AI_MODEL` (modèle à utiliser), `COCKPIT_KEY` (clé d'accès à envoyer dans l'en-tête `x-cockpit-key`).
