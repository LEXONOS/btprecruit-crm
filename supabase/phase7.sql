-- =============================================================
-- NOVALEM APP — Phase 7 (a executer une fois dans Supabase > SQL Editor)
-- Lien agenda <-> prospection : les rappels connaissent leur cible,
-- ce qui permet la cloture automatique quand l'appel est traite
-- =============================================================
ALTER TABLE public.web_evenements
  ADD COLUMN IF NOT EXISTS cible_id UUID REFERENCES public.web_prospection_cibles(id) ON DELETE SET NULL;
