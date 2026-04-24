# Caraibe Yachts CRM

CRM professionnel pour Caraibe Yachts — courtage de bateaux en Antilles.

## 🚀 Démarrage rapide

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## 📦 Déploiement sur Vercel

1. Pousser ce dossier sur GitHub
2. Connecter le repo sur [vercel.com](https://vercel.com)
3. Cliquer "Deploy" — aucune configuration requise

## 🗂️ Structure

```
app/
  page.tsx          → Dashboard
  clients/          → Gestion clients
  occasions/        → Annonces bateaux
  prospects/        → Demandes d'info
  catalogue/        → Catalogue modèles
  fabricants/       → Chantiers navals
  moteurs/          → Motorisations
components/
  Sidebar.tsx       → Navigation
  Header.tsx        → En-tête avec recherche
  CRMLayout.tsx     → Layout commun
data/
  referentials.ts   → Fabricants, moteurs, listes (issues du SQL)
  mock-data.ts      → Données de démo
```

## 🔗 Connexion base de données

Pour connecter la vraie base de données (iqya7946_pro sur o2switch) :

### Option 1 — Supabase (recommandé pour Vercel)
1. Créer un projet Supabase
2. Importer le fichier `iqya7946_pro.sql`
3. Ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les variables Vercel

### Option 2 — PlanetScale / Neon
Même principe avec leur URL de connexion.

## 📊 Base de données originale

| Table | Enregistrements |
|-------|----------------|
| clients | 4 373 |
| occasions | 1 495 |
| prospects | 5 347 |
| bateaux | 716 |
| fabricants | 271 |
| moteurs | 297 |
| brokers | 51 |
| bureaux | 7 |

## 🎨 Stack technique

- **Next.js 14** — App Router
- **TypeScript**
- **Tailwind CSS**
- **Lucide React** — icônes
- **Google Fonts** — Cormorant Garamond + Karla

## ⚠️ Note sécurité

Ne pas exposer les identifiants cPanel visibles dans les captures d'écran.
Changer le mot de passe : `LeChrist0phe#1965` → accès https://khonsu.o2switch.net:2083
