-- =============================================================
-- NOVALEM APP — Phase 15 (a executer une fois dans Supabase > SQL Editor)
-- Tranche 4 : relais production (Louis -> monteur).
--   pret_production : Louis a valide, le client entre dans la file du monteur
--   monteur_id      : a quel monteur ce client est assigne (null = tous)
--   deadline        : echeance, sert a ranger la file du monteur
--   priorite        : 1 Haute / 2 Normale / 3 Basse
--   brief           : le brief de prod (mis au propre par l'IA)
-- Sans risque : ne fait rien si c'est deja en place.
-- =============================================================
ALTER TABLE public.web_clients ADD COLUMN IF NOT EXISTS pret_production BOOLEAN DEFAULT false;
ALTER TABLE public.web_clients ADD COLUMN IF NOT EXISTS monteur_id UUID;
ALTER TABLE public.web_clients ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE public.web_clients ADD COLUMN IF NOT EXISTS priorite INTEGER DEFAULT 2;
ALTER TABLE public.web_clients ADD COLUMN IF NOT EXISTS brief TEXT;
