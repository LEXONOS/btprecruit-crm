-- =============================================================
-- NOVALEM APP — Phase 8 (a executer une fois dans Supabase > SQL Editor)
-- Fiabilisation de l'agenda : garantit que TOUTES les colonnes que
-- l'app ecrit existent, et que les comptes connectes ont le droit
-- de lire/ecrire. Corrige les enregistrements qui echouaient en
-- silence ("Enregistre" affiche mais rien dans l'agenda).
-- Sans risque : chaque instruction ne fait rien si c'est deja en place.
-- =============================================================

ALTER TABLE public.web_evenements
  ADD COLUMN IF NOT EXISTS titre       TEXT,
  ADD COLUMN IF NOT EXISTS type        TEXT,
  ADD COLUMN IF NOT EXISTS date_debut  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_fin    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS statut      TEXT DEFAULT 'a_venir',
  ADD COLUMN IF NOT EXISTS lieu        TEXT,
  ADD COLUMN IF NOT EXISTS notes       TEXT,
  ADD COLUMN IF NOT EXISTS owner       UUID,
  ADD COLUMN IF NOT EXISTS auto        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_id   UUID,
  ADD COLUMN IF NOT EXISTS cible_id    UUID,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

-- Droits : tout compte connecte peut lire et ecrire l'agenda
-- (meme regle que web_charges et web_societe des phases 5 et 6)
ALTER TABLE public.web_evenements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "evenements_auth" ON public.web_evenements;
CREATE POLICY "evenements_auth" ON public.web_evenements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
