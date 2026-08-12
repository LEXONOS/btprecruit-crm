-- ═══════════════════════════════════════════════════════════════════════
-- NOVALEM PROSPECTION — Schema du cockpit de prospection
--
-- A jouer UNE FOIS dans Supabase : SQL Editor > New query > coller > Run.
-- Idempotent : rejouable sans risque. Ne touche ni au recrutement ni aux
-- tables web_* existantes (il ne fait qu'y creer des liens optionnels).
--
-- Ce que ca cree :
--   1. web_prospection_cibles  : le fichier de prospection (les entreprises
--                                reperees sur Google Maps, leur statut, les
--                                rappels programmes).
--   2. web_prospection_actions : le journal de chaque action (appel, mail,
--                                RDV...) qui alimente les statistiques, les
--                                objectifs du jour et la serie de jours.
--
-- Le script d'appel, le modele de mail et les objectifs sont stockes dans
-- la table web_parametres existante (cle "prospection" du JSON) : aucune
-- migration necessaire pour eux.
-- ═══════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────
-- 0. HELPER (no-op s'il existe deja, identique aux autres schemas)
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────
-- 1. LES CIBLES — une ligne par entreprise reperee
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.web_prospection_cibles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise    TEXT        NOT NULL,
  zone          TEXT,                          -- Jarry, Dothemare, Destreland...
  telephone     TEXT,
  email         TEXT,
  contact_nom   TEXT,
  adresse       TEXT,
  lien_maps     TEXT,                          -- lien de la fiche Google
  site_actuel   TEXT,                          -- URL du site existant s'il y en a un
  qualite_site  TEXT        NOT NULL DEFAULT 'aucun'
                CHECK (qualite_site IN ('aucun','facebook_seul','site_faible','site_ok')),
  statut        TEXT        NOT NULL DEFAULT 'a_appeler'
                CHECK (statut IN ('a_appeler','rappeler','mail_a_envoyer','mail_envoye',
                                  'rdv_pris','pas_interesse','hors_cible','injoignable')),
  rappel_le     TIMESTAMPTZ,                   -- prochaine relance programmee
  tentatives    INTEGER     NOT NULL DEFAULT 0,
  notes         TEXT,
  client_id     UUID        REFERENCES public.web_clients(id) ON DELETE SET NULL,
  owner         UUID        DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prosp_cibles_statut  ON public.web_prospection_cibles(statut);
CREATE INDEX IF NOT EXISTS idx_prosp_cibles_rappel  ON public.web_prospection_cibles(rappel_le);
CREATE INDEX IF NOT EXISTS idx_prosp_cibles_zone    ON public.web_prospection_cibles(zone);
CREATE INDEX IF NOT EXISTS idx_prosp_cibles_created ON public.web_prospection_cibles(created_at);

DROP TRIGGER IF EXISTS trg_prosp_cibles_updated ON public.web_prospection_cibles;
CREATE TRIGGER trg_prosp_cibles_updated
  BEFORE UPDATE ON public.web_prospection_cibles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.web_prospection_cibles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prosp_cibles_auth_all" ON public.web_prospection_cibles;
CREATE POLICY "prosp_cibles_auth_all" ON public.web_prospection_cibles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────────────
-- 2. LE JOURNAL D'ACTIONS — une ligne par geste de prospection
--    C'est lui qui alimente : appels du jour, serie de jours actifs,
--    statistiques par personne, entonnoir de conversion.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.web_prospection_actions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cible_id    UUID        REFERENCES public.web_prospection_cibles(id) ON DELETE CASCADE,
  user_id     UUID        DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL
              CHECK (type IN ('ajout','appel','mail','rdv','statut','note')),
  resultat    TEXT,        -- pour un appel : rdv / rappeler / mail / pas_repondu / pas_interesse / hors_cible
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prosp_actions_cible ON public.web_prospection_actions(cible_id);
CREATE INDEX IF NOT EXISTS idx_prosp_actions_user  ON public.web_prospection_actions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_prosp_actions_date  ON public.web_prospection_actions(created_at);

ALTER TABLE public.web_prospection_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prosp_actions_auth_all" ON public.web_prospection_actions;
CREATE POLICY "prosp_actions_auth_all" ON public.web_prospection_actions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────────────
-- 3. VERIFICATION
-- ────────────────────────────────────────────────────────────────────────
-- SELECT count(*) FROM public.web_prospection_cibles;
-- SELECT count(*) FROM public.web_prospection_actions;
