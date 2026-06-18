# NOVALEM CRM — Contexte Claude

## Projet
CRM de recrutement BTP. Front HTML/CSS/JS vanilla dans `public/`. Déploiement : push GitHub → Vercel (pas de build).

## Stack
- **Front** : `public/js/crm-app.js` (~10 000 lignes), `crm-matching.js`, `crm-booking.js`, `novalem-annonces-pro.js`
- **API** : fonctions Vercel serverless dans `api/*.js` (Node 22)
- **Base** : Supabase (project ref `hfdkkdyyhpymrwiqmitn`, région eu-central-1, **PRODUCTION**)
- **Email** : Resend API + IMAP entrant
- **IA** : Claude (Anthropic) pour analyse CV et recherche de téléphone

## Tables Supabase (production)
| Table | Usage |
|-------|-------|
| `crm_candidats` | 1 ligne par candidat (colonne `data jsonb` pour tout le reste) — **18 candidats actifs** |
| `crm_data` | Données partagées : entreprises, besoins, agenda, posts, factures, règles email (lignes id 1, 2, 3) |
| `novalem_signatures` | Contrats signés électroniquement (11 lignes) |
| `novalem_dossiers` | Dossiers candidats soumis en ligne (4 lignes) |
| `job_postings` | Annonces publiées sur le site |
| `job_applications` | Candidatures entrantes via le site |
| `users` | Utilisateurs CRM (2 actifs) |
| `novalem_documents`, `mandats`, `candidats`, `placements`, `factures` | Tables pour future migration (vides) |

## Storage Supabase
- Bucket `candidat-docs` : CV et pièces candidat (migration base64 → bucket en cours, dossier Emir existant)
- 4 buckets au total (dont `contrats-signes`)

## Variables d'environnement Vercel (toutes nécessaires)
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
CRM_SECRET           (auth API interne X-CRM-Secret)
ANTHROPIC_API_KEY    (analyse CV, recherche tel)
FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET
RESEND_API_KEY, SENDER_EMAIL, SENDER_NAME, CRM_USER_EMAIL
IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS
CRM_TZ               (optionnel, défaut: Europe/Paris — DOIT être America/Guadeloupe)
CRM_URL              (optionnel, défaut: https://novalem-crm.vercel.app)
```

## Règles critiques
- ⚠️ **PRODUCTION** : ne jamais créer/modifier/supprimer de vraies données sans accord explicite
- ⚠️ **Dates** : toujours utiliser `parseDayLocal()`, `fD()`, `todayKey()` — jamais `new Date("YYYY-MM-DD")`
- ⚠️ **Jsonb lourd** : ne jamais faire d'opération jsonb côté serveur — lire en texte, modifier en JS, réécrire en un seul UPDATE
- ⚠️ **Branches** : toujours développer sur `claude/...`, jamais toucher `main`

## Workflow de sauvegarde (front)
- `save()` dans crm-app.js écrit dans `crm_candidats` (chaque candidat individuellement) ET `crm_data`
- Empreinte anti-écrasement sur chaque candidat
- **Pas de flush automatique** à la fermeture de tab (à corriger en Phase 1a)

## Pipeline candidat
`entrant → new (qualifié) → precal → dossier → interview → presented → placed / ko`

## Développement
- Branches : `claude/...` → PR → merge dans `main`
- Tester en lecture seule en priorité
- Commit avant toute opération risquée
