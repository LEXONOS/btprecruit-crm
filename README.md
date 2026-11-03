# La Tour · groupe LEXONOS

Une entreprise entièrement faite d'agents IA, organisée comme une vraie société, et visible en 3D : une tour dans une ville des Antilles la nuit, un étage par entreprise, chaque agent à son bureau, les messages qui voyagent d'un bureau à l'autre, le bureau de Louis sur le toit.

## Le groupe au départ

- **Direction du Groupe** : Maximilien (PDG), Inès (DRH), Hugo (développement), Camille (contrôle de gestion).
- **Labo Avengers** : Tony, Ada (veille GitHub), Alan (veille IA). Ils cherchent les meilleurs projets IA et proposent de les intégrer.
- **Novalemo Sites** : vend des sites aux entreprises des Antilles. DG, directeur commercial, RH, commerciale emailing, fournisseur de contacts, chasseurs (nouveaux domaines .fr, Google Maps, créations BODACC, réseaux), rédactrice, relanceur, partenariats, inbound, analyste, chef de production, portfolio, démo-maker.
- **Studio 3D** : vidéos d'ingénierie en 3D pour TikTok et YouTube (veille, scripts ; rendu, voix et publication en attente de branchement).
- **E-commerce Lab** : veille, études de niches, puis boutique validée par Louis.
- **Chantiers** : 4 projets d'entreprises soumis à Louis (Conformité Web, Leads Antilles, Fiches Google, Recover). Validé = un étage de plus.

42 agents. Chacun a une fiche de poste, une stratégie qu'il réécrit lui-même, des connaissances qu'il accumule, un chef, et des outils limités à son rôle.

## Comment ça tourne

- Le cron Vercel appelle `/api/tick` toutes les 15 minutes. Les agents dont c'est l'heure passent : soit un travail automatique (chasse, enrichissement, contrôle des coûts), soit Claude avec des outils (rapporter, assigner, proposer, décider, évaluer, rédiger, livrer, apprendre, réécrire sa stratégie...).
- Hiérarchie réelle : un agent ne commande que ses équipes ; RH et directeurs donnent leur avis sur les propositions ; DG et PDG tranchent ; tout ce qui coûte de l'argent, crée un compte, touche à la loi ou lance une entreprise va à Louis (Validations, sur le toit).
- Argent : plafond IA par jour (1,50 $ par défaut) respecté au centime, Haiku pour les tâches simples, Sonnet pour les décisions et la rédaction, cache des prompts, et un agent qui ne paie rien quand il n'a rien de neuf à faire. La contrôleuse de gestion met en pause ceux qui coûtent sans produire.
- Emails : brouillons validés par Louis tant que l'envoi automatique n'est pas branché (boîte d'envoi dédiée, jamais Resend, qui interdit la prospection). Ligne STOP partout, liste de désinscription respectée.

## Fichiers

- `index.html`, `assets/hq/` : l'interface (scène 3D Three.js, panneaux, organigramme, livrables, chiffres).
- `api/hq.js` : lecture du monde et actions de Louis. `api/tick.js` : le cycle des agents.
- `lib/seed.js` : la fondation (entreprises, postes, fiches, stratégies de départ, projets soumis à Louis).
- `lib/runtime.js` (moteur), `lib/tools.js` (outils et garde-fous), `lib/context.js` (ce que voit un agent), `lib/claude.js` (API Anthropic), `lib/jobs/` (travaux automatiques), `lib/chasse/` (moteur nouveaux domaines repris de novalem-app).
- `supabase/hq-schema.sql` : les tables `hq_*` (projet Supabase Novalemo).
- `test/sim.js` : simulation complète sans réseau (`npm test`). `test/serve.js` : la tour en local avec une base en mémoire.

## Variables Vercel

- `ANTHROPIC_API_KEY` (déjà là), `GOOGLE_MAPS_API_KEY` (déjà là, chasse Google Maps).
- `HQ_SUPABASE_KEY` : clé secrète (service_role) du projet Supabase Novalemo. Sans elle, la tour tourne en mode démo.
- Plus tard : `HQ_SMTP_HOST`, `HQ_SMTP_PORT`, `HQ_SMTP_USER`, `HQ_SMTP_PASS`, `HQ_SMTP_FROM` (boîte d'envoi dédiée). Optionnels : `HQ_KEY` (clé d'accès en plus de la protection Vercel), `GITHUB_TOKEN` (plus de recherches GitHub), `HQ_MODEL_FAST` / `HQ_MODEL_SMART`.

L'ancien outil ViNego est conservé sur la branche `archive/vinego`.
