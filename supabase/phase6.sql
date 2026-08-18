-- =============================================================
-- NOVALEM APP — Phase 6 (a executer une fois dans Supabase > SQL Editor)
-- Fiche societe (SIRET, IBAN, mentions) utilisee par les devis
-- =============================================================
CREATE TABLE IF NOT EXISTS public.web_societe (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale TEXT, siret TEXT, adresse TEXT,
  email TEXT, telephone TEXT, iban TEXT, bic TEXT, mentions TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.web_societe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "societe_auth" ON public.web_societe;
CREATE POLICY "societe_auth" ON public.web_societe
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
