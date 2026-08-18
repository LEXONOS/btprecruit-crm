-- =============================================================
-- NOVALEM APP — Phase 5 (a executer une fois dans Supabase > SQL Editor)
-- Table des charges mensuelles pour l'outil capacite d'investissement
-- =============================================================
CREATE TABLE IF NOT EXISTS public.web_charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle          TEXT NOT NULL,
  montant_mensuel  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.web_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "charges_auth" ON public.web_charges;
CREATE POLICY "charges_auth" ON public.web_charges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
