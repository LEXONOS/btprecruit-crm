# Suivi distribution (ViNego)

Outil de pilotage pour le business game ViNego (Sciado), côté distributeur, présenté comme un tableur.

- **À faire** : le parcours guidé de l'étape en cours. Quoi capturer dans le jeu (et pourquoi), quoi y saisir avec les valeurs conseillées et leur explication, les vérifications avant de valider la phase, ce qu'il faut anticiper.
- **Saisie universelle** : colle une capture (Ctrl+V), glisse un fichier, colle le texte d'une page, ou écris dans la barre fx (une info, une consigne, une question). L'IA lit, range chaque valeur à sa place (cellules surlignées en jaune) et répond dans le volet Commentaires. « Annuler ces modifications » ou Ctrl+Z si c'est faux.
- **Tableau de bord** : résultats, trésorerie, score, attractivité par client, graphique.
- **Prévisions** : chaque mois de la partie, ce qui s'y passe, ce qu'il faut préparer, puis le réel.
- **Saisie**, **Négos**, **Notes**, **Paramètres** : les données brutes, les offres avec verdict, le journal, les réglages de la session.
- Discrétion : le volet Commentaires et les bulles se masquent après une période sans activité (Affichage) ou avec Échap.

Les données restent dans le navigateur (Fichier > Exporter une copie).

## Technique

- Pages statiques : `index.html`, `assets/` (aucune étape de build). `assets/engine.js` contient toute la logique de stratégie (testable dans Node).
- Fonction Vercel `api/ai.js` : appelle l'API Anthropic avec la variable d'environnement `ANTHROPIC_API_KEY`. Actions : `smart` (lecture et rangement de tout ce qui est envoyé + réponse), `analyze` (débrief du mois), `coach`, `extract`, `ping`.
- Variables optionnelles : `AI_MODEL` (modèle à utiliser), `COCKPIT_KEY` (clé d'accès à envoyer dans l'en-tête `x-cockpit-key`).
