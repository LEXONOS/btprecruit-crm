# Assistant prospect intelligent

Nouveau bouton **Assistant IA** sur chaque prospect (dans la Session d'appel, sur la carte
d'appel, et dans le Reperage sur la liste des dernieres cibles).

## Ce qu'il fait
1. Lit la presence en ligne du prospect (son site ou sa page si tu colles l'URL).
2. En sort une **fiche enrichie** : secteur, email/tel visibles, qualite du site, couleurs de
   marque... Chaque info est marquee **sur** (pre-cochee) ou **a valider** (a toi de confirmer).
   Regle du CRM : on ne devine jamais, rien n'est invente.
3. Ecrit un **cold mail personnalise** dans ton style, pret a copier-coller dans ta boite.

## Mise en route
- **Obligatoire :** la variable `ANTHROPIC_API_KEY` doit etre dans les variables Vercel du
  projet (Settings > Environment Variables). Elle existe deja si tu avais installe l'usine.
  Si tu la crees, c'est sur console.anthropic.com (facturation a l'usage, quelques centimes par
  analyse).
- **Optionnel :** execute une fois `supabase/phase9.sql` (Supabase > SQL Editor) pour, en plus,
  memoriser le secteur et l'analyse complete sur chaque prospect. Sans ca, l'assistant marche
  quand meme et enregistre les infos de base (email, tel, qualite du site, lien du site).
- Si le deploiement Vercel refuse `maxDuration: 60` (plan Hobby), active **Fluid Compute**
  (Settings > Functions, gratuit) ou baisse cette valeur dans `vercel.json`.

## Cout
Une analyse = 1 appel a l'API Anthropic (modele `claude-sonnet-4-6`, reglable en haut de
`api/assistant-prospect.js`). Quelques centimes par prospect. C'est separe de ton abonnement
Claude perso.
