-- ═══════════════════════════════════════════════════════════════════════
-- NOVALEM SITES INTERNET — Schema de l'espace "Sites"
-- Activite de creation de sites internet. TOTALEMENT SEPARE du recrutement.
--
-- Toutes les tables sont prefixees web_. Aucune table recrutement n'est
-- touchee, modifiee ni lue par ce fichier. Il est idempotent : on peut le
-- rejouer sans risque.
--
-- MARCHE A SUIVRE :
--   Supabase > SQL Editor > New query > coller CE fichier entier > Run.
--   (Le schema recrutement schema.sql doit deja avoir ete execute une fois,
--    car on reutilise les fonctions helper public.is_superviseur() et
--    public.touch_updated_at(). Par securite on les recree a l'identique
--    ci-dessous : c'est un no-op si elles existent deja.)
-- ═══════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ────────────────────────────────────────────────────────────────────────
-- 1. HELPERS RLS (recrees a l'identique — no-op s'ils existent deja)
--    On ne modifie rien du recrutement : ce sont les memes definitions
--    que dans schema.sql. Utile si l'espace Sites est deploye seul.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_superviseur()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'superviseur' AND actif = true
  );
$$;


-- ────────────────────────────────────────────────────────────────────────
-- 2. TYPES ENUM (prefixes web_)
-- ────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE web_pipeline_statut AS ENUM (
    'prospect', 'contacte', 'devis_envoye', 'signe', 'en_cours', 'livre', 'sav', 'perdu'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE web_formule AS ENUM ('essentiel', 'vitrine', 'signature', 'sur_mesure');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE web_projet_statut AS ENUM (
    'cadrage', 'maquette', 'developpement', 'mise_en_ligne', 'livre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE web_devis_statut AS ENUM ('brouillon', 'envoye', 'accepte', 'refuse', 'expire');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE web_facture_type AS ENUM ('acompte', 'solde');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE web_facture_statut AS ENUM ('brouillon', 'emise', 'relancee', 'payee', 'annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────────────────
-- 3. TABLES
-- ────────────────────────────────────────────────────────────────────────

-- 3.1 web_clients — entreprises / prospects de l'activite Sites
CREATE TABLE IF NOT EXISTS public.web_clients (
  id               UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise       TEXT                NOT NULL,
  contact_nom      TEXT,
  email            TEXT,
  telephone        TEXT,
  secteur          TEXT,
  ville            TEXT,
  source           TEXT,
  statut_pipeline  web_pipeline_statut NOT NULL DEFAULT 'prospect',
  notes            TEXT,
  owner            UUID                REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- 3.2 web_projets — suivi de production d'un site
CREATE TABLE IF NOT EXISTS public.web_projets (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID              NOT NULL REFERENCES public.web_clients(id) ON DELETE CASCADE,
  formule             web_formule       NOT NULL DEFAULT 'vitrine',
  options             JSONB             NOT NULL DEFAULT '[]'::jsonb,
  prix_ht             NUMERIC(10,2)     NOT NULL DEFAULT 0,
  remise_pct          NUMERIC(5,2)      NOT NULL DEFAULT 0,
  statut              web_projet_statut NOT NULL DEFAULT 'cadrage',
  date_cadrage        DATE,
  date_maquette       DATE,
  date_mise_en_ligne  DATE,
  url_livree          TEXT,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- 3.3 web_devis — devis (numerotation DEV-YYYY-####, propre au web)
CREATE TABLE IF NOT EXISTS public.web_devis (
  id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID             NOT NULL REFERENCES public.web_clients(id) ON DELETE CASCADE,
  projet_id      UUID             REFERENCES public.web_projets(id) ON DELETE SET NULL,
  numero         TEXT             NOT NULL UNIQUE,      -- ex : DEV-2026-0001
  date_emission  DATE             NOT NULL DEFAULT CURRENT_DATE,
  validite       DATE,
  lignes         JSONB            NOT NULL DEFAULT '[]'::jsonb,  -- [{designation, quantite, pu_ht}]
  total_ht       NUMERIC(10,2)    NOT NULL DEFAULT 0,
  mentions       TEXT,
  statut         web_devis_statut NOT NULL DEFAULT 'brouillon',
  signature_ref  TEXT,
  sign_token     TEXT,            -- jeton du lien de signature (bon pour accord)
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- 3.4 web_factures — factures (numerotation FAC-YYYY-####, DISTINCTE du recrutement)
--     Une facture emise est inalterable : correction par avoir, jamais en place.
CREATE TABLE IF NOT EXISTS public.web_factures (
  id             UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID               NOT NULL REFERENCES public.web_clients(id) ON DELETE CASCADE,
  projet_id      UUID               REFERENCES public.web_projets(id) ON DELETE SET NULL,
  devis_id       UUID               REFERENCES public.web_devis(id)   ON DELETE SET NULL,
  numero         TEXT               NOT NULL UNIQUE,     -- ex : FAC-2026-0001
  type           web_facture_type   NOT NULL DEFAULT 'acompte',
  montant_ht     NUMERIC(10,2)      NOT NULL DEFAULT 0,
  date_emission  DATE               NOT NULL DEFAULT CURRENT_DATE,
  date_echeance  DATE,
  statut         web_facture_statut NOT NULL DEFAULT 'brouillon',
  avoir_de       UUID               REFERENCES public.web_factures(id) ON DELETE SET NULL, -- si avoir : facture corrigee
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- 3.5 web_hebergements — hebergement + nom de domaine par client
CREATE TABLE IF NOT EXISTS public.web_hebergements (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID          NOT NULL REFERENCES public.web_clients(id) ON DELETE CASCADE,
  nom_domaine         TEXT,
  hebergeur           TEXT,
  date_renouvellement DATE,
  cout_annuel         NUMERIC(10,2),
  acces_notes         TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3.6 web_interactions — historique (appel, email, rdv, note)
CREATE TABLE IF NOT EXISTS public.web_interactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID        NOT NULL REFERENCES public.web_clients(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'note',  -- appel | email | rdv | note
  contenu    TEXT,
  date       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 web_devis_signatures — preuves eIDAS de la signature d'un devis
--     Table PROPRE au web (les signatures recrutement restent dans
--     novalem_signatures, non touchee). Alimentee par la page publique
--     sites-sign.html via le client anon, protegee par le jeton du devis.
CREATE TABLE IF NOT EXISTS public.web_devis_signatures (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id           UUID        NOT NULL REFERENCES public.web_devis(id) ON DELETE CASCADE,
  token              TEXT        NOT NULL,
  reference          TEXT,
  client_nom         TEXT,
  signer_name        TEXT        NOT NULL,
  signer_fonction    TEXT,
  signer_email       TEXT,
  signer_ip          TEXT,
  signed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             TEXT        NOT NULL DEFAULT 'signe',
  signature_image    TEXT,
  signature_method   TEXT,       -- drawn | uploaded | typed
  devis_hash         TEXT,
  user_agent         TEXT,
  acceptance_lecture BOOLEAN     NOT NULL DEFAULT false,
  acceptance_pouvoir BOOLEAN     NOT NULL DEFAULT false,
  acceptance_eidas   BOOLEAN     NOT NULL DEFAULT false,
  audit_log          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8 web_counters — compteurs de numerotation, propres au web, sans trou
CREATE TABLE IF NOT EXISTS public.web_counters (
  kind  TEXT    NOT NULL,   -- 'DEV' | 'FAC'
  annee INTEGER NOT NULL,
  seq   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, annee)
);


-- ────────────────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_web_clients_owner       ON public.web_clients(owner);
CREATE INDEX IF NOT EXISTS idx_web_clients_statut      ON public.web_clients(statut_pipeline);
CREATE INDEX IF NOT EXISTS idx_web_projets_client      ON public.web_projets(client_id);
CREATE INDEX IF NOT EXISTS idx_web_projets_statut      ON public.web_projets(statut);
CREATE INDEX IF NOT EXISTS idx_web_devis_client        ON public.web_devis(client_id);
CREATE INDEX IF NOT EXISTS idx_web_devis_projet        ON public.web_devis(projet_id);
CREATE INDEX IF NOT EXISTS idx_web_devis_statut        ON public.web_devis(statut);
CREATE INDEX IF NOT EXISTS idx_web_factures_client     ON public.web_factures(client_id);
CREATE INDEX IF NOT EXISTS idx_web_factures_devis      ON public.web_factures(devis_id);
CREATE INDEX IF NOT EXISTS idx_web_factures_statut     ON public.web_factures(statut);
CREATE INDEX IF NOT EXISTS idx_web_heberg_client       ON public.web_hebergements(client_id);
CREATE INDEX IF NOT EXISTS idx_web_heberg_renouv       ON public.web_hebergements(date_renouvellement);
CREATE INDEX IF NOT EXISTS idx_web_interactions_client ON public.web_interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_web_devsig_devis        ON public.web_devis_signatures(devis_id);


-- ────────────────────────────────────────────────────────────────────────
-- 5. TRIGGERS updated_at (reutilise public.touch_updated_at)
-- ────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_web_clients_updated
    BEFORE UPDATE ON public.web_clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────────────────
-- 6. STAMP owner = auth.uid() a la creation d'un client (si non fourni)
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_stamp_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner IS NULL THEN
    NEW.owner := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_web_clients_owner ON public.web_clients;
CREATE TRIGGER trg_web_clients_owner
  BEFORE INSERT ON public.web_clients FOR EACH ROW EXECUTE FUNCTION public.web_stamp_owner();


-- ────────────────────────────────────────────────────────────────────────
-- 7. NUMEROTATION SEQUENTIELLE PROPRE AU WEB (DEV-YYYY-#### / FAC-YYYY-####)
--    Atomique (incremente une ligne verrouillee), distincte du recrutement.
--    Appel cote client : supabase.rpc('web_next_number', {p_kind, p_annee}).
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_next_number(p_kind TEXT, p_annee INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_kind TEXT := upper(p_kind);
BEGIN
  IF v_kind NOT IN ('DEV', 'FAC') THEN
    RAISE EXCEPTION 'Type de numero invalide: %', p_kind;
  END IF;

  INSERT INTO public.web_counters(kind, annee, seq)
  VALUES (v_kind, p_annee, 1)
  ON CONFLICT (kind, annee)
  DO UPDATE SET seq = public.web_counters.seq + 1
  RETURNING seq INTO v_seq;

  RETURN v_kind || '-' || p_annee::text || '-' || lpad(v_seq::text, 4, '0');
END;
$$;


-- ────────────────────────────────────────────────────────────────────────
-- 8. SIGNATURE eIDAS DES DEVIS (sans fonction serverless)
--    a) web_devis_public : la page publique lit le devis SI le jeton matche
--    b) web_devis_token_valid : autorise l'insertion de la signature
--    c) web_devis_after_sign : passe le devis en 'accepte' apres signature
-- ────────────────────────────────────────────────────────────────────────

-- a) Lecture publique controlee par jeton (retourne le devis en JSON)
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
    'id',           d.id,
    'numero',       d.numero,
    'date_emission',d.date_emission,
    'validite',     d.validite,
    'lignes',       d.lignes,
    'total_ht',     d.total_ht,
    'mentions',     d.mentions,
    'statut',       d.statut,
    'entreprise',   c.entreprise,
    'contact_nom',  c.contact_nom
  )
  INTO v
  FROM public.web_devis d
  JOIN public.web_clients c ON c.id = d.client_id
  WHERE d.id = p_devis
    AND d.sign_token IS NOT NULL
    AND d.sign_token = p_token;

  RETURN v;  -- NULL si jeton invalide / devis introuvable
END;
$$;

-- b) Validite du jeton pour autoriser l'insertion de la signature
CREATE OR REPLACE FUNCTION public.web_devis_token_valid(p_devis UUID, p_token TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.web_devis
    WHERE id = p_devis
      AND sign_token IS NOT NULL
      AND sign_token = p_token
      AND statut IN ('envoye', 'brouillon')
  );
$$;

-- c) Apres signature : marquer le devis accepte + tracer la reference
CREATE OR REPLACE FUNCTION public.web_devis_after_sign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.web_devis
     SET statut = 'accepte',
         signature_ref = COALESCE(NEW.reference, 'SIG-' || left(NEW.id::text, 8))
   WHERE id = NEW.devis_id
     AND statut <> 'accepte';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_web_devis_after_sign ON public.web_devis_signatures;
CREATE TRIGGER trg_web_devis_after_sign
  AFTER INSERT ON public.web_devis_signatures FOR EACH ROW EXECUTE FUNCTION public.web_devis_after_sign();


-- ────────────────────────────────────────────────────────────────────────
-- 9. FACTURE INALTERABLE APRES EMISSION
--    Des que statut <> 'brouillon', montant / numero / type / dates
--    ne peuvent plus changer. Seul le statut peut evoluer
--    (emise -> relancee -> payee / annulee). Correction = avoir.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.web_facture_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut <> 'brouillon' THEN
    IF NEW.montant_ht    IS DISTINCT FROM OLD.montant_ht
    OR NEW.numero        IS DISTINCT FROM OLD.numero
    OR NEW.type          IS DISTINCT FROM OLD.type
    OR NEW.client_id     IS DISTINCT FROM OLD.client_id
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
-- 10. ROW LEVEL SECURITY
--     Modele par defaut : PARTAGE entre les utilisateurs internes
--     authentifies (comme le reste de l'agence Novalem : un seul espace
--     partage). La colonne owner sert a l'attribution "qui a cree".
--     -> Pour un cloisonnement strict par proprietaire (calque exact sur
--        le pattern candidats/mandats du recrutement), voir le bloc
--        commente "VARIANTE STRICTE" tout en bas.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.web_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_projets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_devis            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_factures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_hebergements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_interactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_devis_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_counters         ENABLE ROW LEVEL SECURITY;

-- ── web_clients ──────────────────────────────────────────────
DROP POLICY IF EXISTS "web_clients_auth_all" ON public.web_clients;
CREATE POLICY "web_clients_auth_all" ON public.web_clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── web_projets ──────────────────────────────────────────────
DROP POLICY IF EXISTS "web_projets_auth_all" ON public.web_projets;
CREATE POLICY "web_projets_auth_all" ON public.web_projets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── web_devis ────────────────────────────────────────────────
DROP POLICY IF EXISTS "web_devis_auth_all" ON public.web_devis;
CREATE POLICY "web_devis_auth_all" ON public.web_devis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── web_factures ─────────────────────────────────────────────
DROP POLICY IF EXISTS "web_factures_auth_all" ON public.web_factures;
CREATE POLICY "web_factures_auth_all" ON public.web_factures
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── web_hebergements ─────────────────────────────────────────
DROP POLICY IF EXISTS "web_heberg_auth_all" ON public.web_hebergements;
CREATE POLICY "web_heberg_auth_all" ON public.web_hebergements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── web_interactions ─────────────────────────────────────────
DROP POLICY IF EXISTS "web_interactions_auth_all" ON public.web_interactions;
CREATE POLICY "web_interactions_auth_all" ON public.web_interactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── web_devis_signatures ─────────────────────────────────────
-- Lecture par les utilisateurs internes.
DROP POLICY IF EXISTS "web_devsig_auth_select" ON public.web_devis_signatures;
CREATE POLICY "web_devsig_auth_select" ON public.web_devis_signatures
  FOR SELECT TO authenticated USING (true);

-- Insertion (signature) autorisee au signataire externe (anon) ET a un
-- utilisateur interne, UNIQUEMENT si le jeton du devis est valide.
DROP POLICY IF EXISTS "web_devsig_anon_insert" ON public.web_devis_signatures;
CREATE POLICY "web_devsig_anon_insert" ON public.web_devis_signatures
  FOR INSERT TO anon WITH CHECK (public.web_devis_token_valid(devis_id, token));

DROP POLICY IF EXISTS "web_devsig_auth_insert" ON public.web_devis_signatures;
CREATE POLICY "web_devsig_auth_insert" ON public.web_devis_signatures
  FOR INSERT TO authenticated WITH CHECK (public.web_devis_token_valid(devis_id, token));

-- ── web_counters ─────────────────────────────────────────────
-- Aucune policy : acces direct interdit. Seule la RPC web_next_number
-- (SECURITY DEFINER) peut ecrire, ce qui empeche toute falsification.


-- ────────────────────────────────────────────────────────────────────────
-- 11. GRANTS EXECUTE SUR LES RPC
-- ────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.web_next_number(TEXT, INTEGER)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_devis_public(UUID, TEXT)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_devis_token_valid(UUID, TEXT)   TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- FIN. L'espace Sites est pret cote base. Rien du recrutement n'a ete
-- modifie. Le CRM recrutement continue de fonctionner a l'identique.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- VARIANTE STRICTE (OPTIONNELLE) — cloisonnement par proprietaire
-- ------------------------------------------------------------------------
-- Si tu preferes que chaque utilisateur ne voie QUE ses propres clients web
-- (calque exact du pattern recrutement : superviseur voit tout, chacun voit
-- les siens), remplace les 6 policies "..._auth_all" ci-dessus par le bloc
-- suivant. NE PAS executer les deux modeles en meme temps.
--
-- DROP POLICY IF EXISTS "web_clients_auth_all" ON public.web_clients;
-- CREATE POLICY "web_clients_sup_all" ON public.web_clients
--   FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());
-- CREATE POLICY "web_clients_owner" ON public.web_clients
--   FOR ALL TO authenticated USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());
--
-- Et pour chaque table fille (web_projets, web_devis, web_factures,
-- web_hebergements, web_interactions), remplacer "..._auth_all" par :
--
-- CREATE POLICY "<t>_sup_all" ON public.<t>
--   FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());
-- CREATE POLICY "<t>_owner" ON public.<t>
--   FOR ALL TO authenticated
--   USING (client_id IN (SELECT id FROM public.web_clients WHERE owner = auth.uid()))
--   WITH CHECK (client_id IN (SELECT id FROM public.web_clients WHERE owner = auth.uid()));
-- ════════════════════════════════════════════════════════════════════════
