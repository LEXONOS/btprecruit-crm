# Novalem Platform v2.0

> Plateforme interne complète pour les scouts Novalem — Cabinet de recrutement BTP

## Architecture

```
novalem-platform/
├── public/
│   ├── index.html          → Page de connexion (PIN 6 chiffres)
│   ├── hub.html            → ★ Dashboard central — Espace Scout
│   ├── crm.html            → CRM complet (candidats, entreprises, pipeline, emails, IA)
│   ├── formation.html      → ★ Centre de formation (11 modules)
│   ├── annuaire.html       → ★ Annuaire contacts & équipe
│   ├── documents.html      → ★ Documents, templates & ressources
│   ├── statistiques.html   → ★ KPIs & analytics temps réel
│   ├── sign.html           → Signature électronique contrats
│   └── dossier.html        → Dossier de candidature
├── api/                    → Serverless functions (inchangées)
├── vercel.json             → Routes + CORS + crons
└── package.json
```

## Parcours utilisateur

```
Connexion (PIN) → Hub central → CRM / Formation / Annuaire / Documents / Stats / Site web
```

## Stack : Supabase · Vercel · Claude API · HTML/CSS/JS vanilla

## Déploiement : Push sur GitHub → Vercel auto-deploy
