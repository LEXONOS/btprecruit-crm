-- ═══════════════════════════════════════════════════════════════════════
-- NOVALEM SITES — MIGRATION v2
--
-- A jouer UNE FOIS dans Supabase : SQL Editor > New query > coller > Run.
-- Idempotent : rejouable sans risque. Ne touche pas au recrutement.
--
-- Ce que ca ajoute :
--   1. web_parametres      : tes reglages (entreprise, IBAN/BIC, textes,
--                            catalogue, automatismes) partages entre tous
--                            tes appareils au lieu d'etre codes en dur.
--   2. web_devis.acompte_pct : l'echeancier choisi DEVIS PAR DEVIS
--                            (0 = tout a la livraison, 100 = tout a la
--                            commande, 30 = acompte 30 % / solde 70 %...).
--   3. web_factures        : designation, lignes, date de paiement, mode de
--                            reglement, date d'envoi, note interne.
--
-- L'application fonctionne meme SANS cette migration (elle detecte les
-- colonnes absentes et retombe sur des valeurs par defaut), mais tu perds
-- l'echeancier par devis et le suivi fin des factures.
-- ═══════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────
-- 1. PARAMETRES DE L'ENTREPRISE (une seule ligne, id = 'global')
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.web_parametres (
  id         TEXT        PRIMARY KEY DEFAULT 'global',
  data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.web_parametres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "web_parametres_auth_all" ON public.web_parametres;
CREATE POLICY "web_parametres_auth_all" ON public.web_parametres
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.web_parametres (id, data)
VALUES ('global', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────
-- 2. ECHEANCIER PAR DEVIS
--    NULL = on applique l'echeancier par defaut des parametres.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.web_devis
  ADD COLUMN IF NOT EXISTS acompte_pct NUMERIC(5,2);

COMMENT ON COLUMN public.web_devis.acompte_pct IS
  'Part du prix due a la signature, en %. 0 = tout a la livraison, 100 = tout a la commande. NULL = defaut des parametres.';


-- ────────────────────────────────────────────────────────────────────────
-- 3. SUIVI COMPLET DES FACTURES
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.web_factures
  ADD COLUMN IF NOT EXISTS designation    TEXT,
  ADD COLUMN IF NOT EXISTS lignes         JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS date_paiement  DATE,
  ADD COLUMN IF NOT EXISTS mode_reglement TEXT,
  ADD COLUMN IF NOT EXISTS envoyee_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes          TEXT;

CREATE INDEX IF NOT EXISTS idx_web_factures_paiement ON public.web_factures(date_paiement);


-- ────────────────────────────────────────────────────────────────────────
-- 4. VERROU DES FACTURES : on autorise les colonnes de SUIVI a bouger
--    apres emission (envoi, encaissement), mais jamais le fond de la
--    facture (montant, numero, type, client, date d'emission).
--    Remplace la version precedente du trigger.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_facture_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut <> 'brouillon' THEN
    IF NEW.montant_ht    IS DISTINCT FROM OLD.montant_ht
    OR NEW.numero        IS DISTINCT FROM OLD.numero
    OR NEW.type          IS DISTINCT FROM OLD.type
    OR NEW.client_id     IS DISTINCT FROM OLD.client_id
    OR NEW.designation   IS DISTINCT FROM OLD.designation
    OR NEW.lignes        IS DISTINCT FROM OLD.lignes
    OR NEW.date_emission IS DISTINCT FROM OLD.date_emission THEN
      RAISE EXCEPTION 'Facture % emise : inalterable. Corriger par un avoir.', OLD.numero;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_web_facture_lock ON public.web_factures;
CREATE TRIGGER trg_web_facture_lock
  BEFORE UPDATE ON public.web_factures FOR EACH ROW EXECUTE FUNCTION public.web_facture_lock();


-- ────────────────────────────────────────────────────────────────────────
-- 5. LECTURE PUBLIQUE DU DEVIS (page de signature) : on expose aussi
--    l'echeancier, pour que la page de signature affiche le bon montant.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_devis_public(p_devis UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id',            d.id,
    'numero',        d.numero,
    'date_emission', d.date_emission,
    'validite',      d.validite,
    'lignes',        d.lignes,
    'total_ht',      d.total_ht,
    'acompte_pct',   d.acompte_pct,
    'mentions',      d.mentions,
    'statut',        d.statut,
    'entreprise',    c.entreprise,
    'contact_nom',   c.contact_nom
  )
  INTO v
  FROM public.web_devis d
  JOIN public.web_clients c ON c.id = d.client_id
  WHERE d.id = p_devis
    AND d.sign_token IS NOT NULL
    AND d.sign_token = p_token;

  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.web_devis_public(UUID, TEXT) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────
-- 6. RECHARGEMENT DU CACHE POSTGREST
-- ────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════
-- FIN. Retourne dans le CRM > Parametres pour saisir adresse, IBAN et BIC.
-- ════════════════════════════════════════════════════════════════════════
