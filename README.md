# La Tour · groupe LEXONOS

Une entreprise entièrement faite d'agents IA, organisée comme une vraie société, et visible en 3D : une tour dans une ville des Antilles la nuit, un étage par entreprise, chaque agent à son bureau, les messages qui voyagent d'un bureau à l'autre, le bureau de Louis sur le toit.

## Le groupe au départ

- **Direction du Groupe** : Maximilien (PDG), Inès (DRH), Hugo (développement), Camille (contrôle de gestion).
- **Labo Avengers** : Tony, Ada (veille GitHub), Alan (veille IA). Ils cherchent les meilleurs projets IA et proposent de les intégrer.
- **Novalemo Sites** : vend des sites aux entreprises des Antilles. DG, directeur commercial, RH, commerciale emailing, fournisseur de contacts, chasseurs (nouveaux domaines .fr, Google Maps, créations BODACC, réseaux), rédactrice, relanceur, chargée des réponses (Emma), partenariats, inbound, analyste, chef de production, portfolio, démo-maker.
- **Studio 3D** : vidéos d'ingénierie en 3D pour TikTok et YouTube (veille, scripts ; rendu, voix et publication en attente de branchement).
- **E-commerce Lab** : veille, études de niches, puis boutique validée par Louis.
- **Chantiers** : 4 projets d'entreprises soumis à Louis (Conformité Web, Leads Antilles, Fiches Google, Recover). Validé = un étage de plus.

43 agents. Chacun a une fiche de poste, une stratégie qu'il réécrit lui-même, des connaissances qu'il accumule, un chef, et des outils limités à son rôle.

## Comment ça tourne

- Le cron Vercel appelle `/api/tick` toutes les 15 minutes. Les agents dont c'est l'heure passent : soit un travail automatique (chasse, enrichissement, contrôle des coûts), soit Claude avec des outils (rapporter, assigner, proposer, décider, évaluer, rédiger, livrer, apprendre, réécrire sa stratégie...).
- Hiérarchie réelle : un agent ne commande que ses équipes ; RH et directeurs donnent leur avis sur les propositions ; DG et PDG tranchent ; tout ce qui coûte de l'argent, crée un compte, touche à la loi ou lance une entreprise va à Louis (Validations, sur le toit).
- Argent : plafond IA par jour (1,50 $ par défaut) respecté au centime, Haiku pour les tâches simples, Sonnet pour les décisions et la rédaction, cache des prompts, et un agent qui ne paie rien quand il n'a rien de neuf à faire. La contrôleuse de gestion met en pause ceux qui coûtent sans produire.
- Emails : ils partent de la boîte de Louis (SMTP), jamais par Resend (qui interdit la prospection). Louis valide chaque email, sauf s'il coupe la validation. Rythme humain : jours ouvrés 8 h à 17 h 30, deux par passage, palier de chauffe (5 par jour la première semaine, puis 8, 12, 16, 20), pause automatique si trop d'adresses invalides. Relances dans le même fil, jamais après une réponse.
- Réponses : la boîte est relevée toutes les 15 minutes (IMAP, sans rien marquer comme lu) ; seuls les messages liés à nos envois sont lus. Vraie réponse : Louis est prévenu, Emma classe et prépare la réponse, Louis l'envoie d'un clic. STOP : liste noire. Rebond : adresse écartée, le prospect passe en appel.

## Fichiers

- `index.html`, `assets/hq/` : l'interface (scène 3D Three.js, panneaux, organigramme, livrables, chiffres).
- `api/hq.js` : lecture du monde et actions de Louis. `api/tick.js` : le cycle des agents.
- `lib/seed.js` : la fondation (entreprises, postes, fiches, stratégies de départ, projets soumis à Louis).
- `lib/runtime.js` (moteur), `lib/tools.js` (outils et garde-fous), `lib/context.js` (ce que voit un agent), `lib/claude.js` (API Anthropic), `lib/mail.js` (boîte : SMTP, IMAP, DNS), `lib/jobs/` (travaux automatiques, dont `envoi.js` et `boite.js`), `lib/chasse/` (moteur nouveaux domaines repris de novalem-app).
- `supabase/hq-schema.sql` : les tables `hq_*` (projet Supabase Novalemo).
- `test/sim.js` : simulation complète sans réseau (`npm test`). `test/serve.js` : la tour en local avec une base en mémoire.

## Variables Vercel

- `ANTHROPIC_API_KEY` (déjà là), `GOOGLE_MAPS_API_KEY` (déjà là, chasse Google Maps).
- `HQ_SUPABASE_KEY` : clé secrète (service_role) du projet Supabase Novalemo. Sans elle, la tour tourne en mode démo.
- `HQ_MAIL_USER` et `HQ_MAIL_PASS` : l'adresse d'envoi et son mot de passe (le serveur OVH, Google, Zoho, IONOS, Infomaniak, Gandi, Hostinger ou Microsoft est reconnu par les MX du domaine). Sans elles, les emails se copient à la main. Réglages fins si besoin : `HQ_MAIL_NOM` (nom affiché, « Louis de Novalemo » par défaut), `HQ_SMTP_HOST`, `HQ_SMTP_PORT`, `HQ_IMAP_HOST`, `HQ_IMAP_PORT`.
- Optionnels : `HQ_KEY` (clé d'accès en plus de la protection Vercel), `GITHUB_TOKEN` (plus de recherches GitHub), `HQ_MODEL_FAST` / `HQ_MODEL_SMART`.

L'ancien outil ViNego est conservé sur la branche `archive/vinego`.
