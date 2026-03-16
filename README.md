# BTPRecruit CRM — Déploiement Vercel

## Structure du projet

```
btprecruit-vercel/
├── public/
│   └── index.html          ← Le CRM complet
├── api/
│   ├── post-job.js         ← Publication automatique job boards
│   ├── health.js           ← Vérification statut API
│   └── lib/
│       └── france-travail.js ← Intégration France Travail
├── vercel.json
├── package.json
└── .gitignore
```

## Variables d'environnement Vercel

Dans Vercel → votre projet → Settings → Environment Variables :

| Variable | Description | Requis |
|---|---|---|
| `FRANCE_TRAVAIL_CLIENT_ID` | Client ID API France Travail | Pour auto-post FT |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | Secret API France Travail | Pour auto-post FT |

## Déploiement

1. Créer un repo GitHub avec ce dossier
2. Connecter sur vercel.com → "New Project" → importer le repo
3. Ajouter les variables d'environnement
4. Deploy → votre CRM est en ligne à l'URL Vercel

## Obtenir les clés France Travail

1. Aller sur https://francetravail.io
2. Créer un compte partenaire
3. Créer une application → sélectionner "API Offres d'emploi v2"
4. Récupérer Client ID et Client Secret
5. Les coller dans les variables d'env Vercel
