# BTPRecruit CRM — Déploiement Vercel

## Variables d'environnement Vercel

Dans Vercel → Settings → Environment Variables :

| Variable | Description | Requis |
|---|---|---|
| `RESEND_API_KEY` | Clé API Resend (resend.com) | ✅ Rappels email |
| `CRM_USER_EMAIL` | Ton email pour recevoir les rappels | ✅ Rappels email |
| `SUPABASE_URL` | URL projet Supabase | ✅ Sync données |
| `SUPABASE_ANON_KEY` | Clé anon/publishable Supabase | ✅ Sync données |
| `CRM_URL` | URL du CRM en prod (ex: https://novalem-crm.vercel.app) | Recommandé |
| `CRON_SECRET` | Secret pour sécuriser le cron | Recommandé |
| `FRANCE_TRAVAIL_CLIENT_ID` | Client ID France Travail API | Auto-post FT |
| `FRANCE_TRAVAIL_CLIENT_SECRET` | Secret France Travail API | Auto-post FT |

## Cron email

Le cron `/api/cron-reminders` tourne du lundi au vendredi à 8h00 UTC (9h Paris hiver, 10h été).
Pour tester manuellement : `GET https://novalem-crm.vercel.app/api/send-reminders`

## Structure
```
├── public/index.html     ← CRM complet
├── api/
│   ├── post-job.js       ← Publication job boards
│   ├── cron-reminders.js ← Email quotidien automatique
│   ├── send-reminders.js ← Déclenchement manuel
│   ├── health.js         ← Statut API
│   └── lib/
│       ├── email.js          ← Resend + template HTML
│       └── france-travail.js ← API France Travail
├── vercel.json
└── package.json
```
