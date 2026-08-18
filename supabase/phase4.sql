-- =============================================================
-- NOVALEM APP — Phase 4 (a executer une fois dans Supabase > SQL Editor)
-- 1) heure + note sur les rappels/relances de prospection
-- 2) abonnement mensuel sur les hebergements (revenu recurrent)
-- =============================================================
ALTER TABLE public.web_prospection_cibles
  ADD COLUMN IF NOT EXISTS rappel_heure TEXT,
  ADD COLUMN IF NOT EXISTS rappel_note  TEXT;

ALTER TABLE public.web_hebergements
  ADD COLUMN IF NOT EXISTS abonnement_mensuel NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS abonnement_notes   TEXT;
