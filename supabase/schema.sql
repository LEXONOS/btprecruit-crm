-- ═══════════════════════════════════════════════════════════════════════
-- NOVALEM — Schéma BDD complet
-- Supabase > SQL Editor > New query > Coller et exécuter
--
-- ORDRE D'EXÉCUTION :
--   1. Ce fichier entier (schema.sql)
--   2. Créer les comptes dans Auth > Users (email + password)
--   3. Exécuter le bloc "ÉTAPE 3" en bas pour passer Louis en superviseur
-- ═══════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ────────────────────────────────────────────────────────────────────────
-- 2. TYPES ENUM
-- ────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role       AS ENUM ('superviseur', 'scout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mandat_statut   AS ENUM ('ouvert', 'en_cours', 'pourvu', 'suspendu', 'clos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE candidat_statut AS ENUM (
    'nouveau', 'contact', 'entretien_scout', 'presente',
    'entretien_client', 'offre', 'place', 'refuse', 'archive'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE paiement_statut AS ENUM ('en_attente', 'partiel', 'paye', 'litige');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE facture_statut  AS ENUM ('brouillon', 'emise', 'relancee', 'payee', 'annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priorite_niveau AS ENUM ('critique', 'haute', 'normale', 'basse');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────────────────
-- 3. TABLES
-- ────────────────────────────────────────────────────────────────────────

-- 3.1 USERS ─ profils liés à auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id                 UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT        NOT NULL UNIQUE,
  nom                TEXT        NOT NULL,
  prenom             TEXT,
  role               user_role   NOT NULL DEFAULT 'scout',
  actif              BOOLEAN     NOT NULL DEFAULT true,
  tel                TEXT,
  avatar_initials    TEXT,            -- ex: 'LR', 'C'
  avatar_color       TEXT,            -- ex: '#c8e040'
  date_inscription   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  derniere_connexion TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 MANDATS ─ missions client confiées à un scout
CREATE TABLE IF NOT EXISTS public.mandats (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          TEXT          UNIQUE,       -- ex: NDL-2026-001
  titre              TEXT          NOT NULL,
  client             TEXT          NOT NULL,
  client_contact     TEXT,                       -- interlocuteur chez le client
  client_email       TEXT,
  client_tel         TEXT,
  scout_id           UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  statut             mandat_statut NOT NULL DEFAULT 'ouvert',
  honoraires_estimes NUMERIC(10,2),
  description        TEXT,
  localisation       TEXT,
  salaire_min        NUMERIC(10,2),
  salaire_max        NUMERIC(10,2),
  date_ouverture     DATE          NOT NULL DEFAULT CURRENT_DATE,
  date_limite        DATE,
  date_cloture       DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3.3 CANDIDATS
CREATE TABLE IF NOT EXISTS public.candidats (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              TEXT             NOT NULL,
  prenom           TEXT             NOT NULL,
  email            TEXT,
  tel              TEXT,
  poste            TEXT,
  statut           candidat_statut  NOT NULL DEFAULT 'nouveau',
  mandat_id        UUID             REFERENCES public.mandats(id) ON DELETE SET NULL,
  scout_id         UUID             REFERENCES public.users(id) ON DELETE SET NULL,
  linkedin_url     TEXT,
  cv_url           TEXT,
  salaire_actuel   NUMERIC(10,2),
  salaire_souhaite NUMERIC(10,2),
  disponibilite    DATE,
  localisation     TEXT,
  notes            TEXT,
  source           TEXT,            -- 'LinkedIn', 'France Travail', 'Réseau', 'Candidature spontanée'
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- 3.4 PLACEMENTS
-- Les commissions sont calculées automatiquement par la BDD
CREATE TABLE IF NOT EXISTS public.placements (
  id                    UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  candidat_id           UUID             NOT NULL REFERENCES public.candidats(id) ON DELETE RESTRICT,
  mandat_id             UUID             NOT NULL REFERENCES public.mandats(id)   ON DELETE RESTRICT,
  scout_id              UUID             REFERENCES public.users(id) ON DELETE SET NULL,
  honoraires_ht         NUMERIC(10,2)    NOT NULL,
  taux_commission_scout NUMERIC(5,2)     NOT NULL DEFAULT 30.00,
  commission_novalem    NUMERIC(10,2)    GENERATED ALWAYS AS (
                          ROUND(honoraires_ht * (1 - taux_commission_scout / 100.0), 2)
                        ) STORED,
  commission_scout      NUMERIC(10,2)    GENERATED ALWAYS AS (
                          ROUND(honoraires_ht * taux_commission_scout / 100.0, 2)
                        ) STORED,
  date_placement        DATE             NOT NULL DEFAULT CURRENT_DATE,
  date_prise_poste      DATE,
  statut_paiement       paiement_statut  NOT NULL DEFAULT 'en_attente',
  notes                 TEXT,
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- 3.5 FACTURES
CREATE TABLE IF NOT EXISTS public.factures (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID           NOT NULL REFERENCES public.placements(id) ON DELETE RESTRICT,
  numero       TEXT           NOT NULL UNIQUE,   -- ex: NVL-2026-001
  montant_ht   NUMERIC(10,2)  NOT NULL,
  taux_tva     NUMERIC(5,2)   NOT NULL DEFAULT 0.00,
  montant_tva  NUMERIC(10,2)  GENERATED ALWAYS AS (
                 ROUND(montant_ht * taux_tva / 100.0, 2)
               ) STORED,
  montant_ttc  NUMERIC(10,2)  GENERATED ALWAYS AS (
                 ROUND(montant_ht * (1 + taux_tva / 100.0), 2)
               ) STORED,
  emise_le     DATE,
  echeance_le  DATE,
  payee_le     DATE,
  statut       facture_statut NOT NULL DEFAULT 'brouillon',
  notes        TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 3.6 FORMATIONS PROGRESS ─ progression scout par module
CREATE TABLE IF NOT EXISTS public.formations_progress (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_id       TEXT        NOT NULL,   -- ex: 'ch1-m1', 'ch2-m3'
  complete        BOOLEAN     NOT NULL DEFAULT false,
  score           NUMERIC(5,2),           -- 0 à 100
  tentatives      INTEGER     NOT NULL DEFAULT 0,
  date_debut      TIMESTAMPTZ,
  date_completion TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scout_id, module_id)
);

-- 3.7 ROADMAP ITEMS ─ checklist de construction de la plateforme (dashboard superviseur)
CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  titre           TEXT            NOT NULL,
  description     TEXT,
  phase           INTEGER         NOT NULL CHECK (phase BETWEEN 1 AND 10),
  ordre           INTEGER         NOT NULL,
  complete        BOOLEAN         NOT NULL DEFAULT false,
  priorite        priorite_niveau NOT NULL DEFAULT 'normale',
  date_completion TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mandats_scout_id      ON public.mandats(scout_id);
CREATE INDEX IF NOT EXISTS idx_mandats_statut        ON public.mandats(statut);
CREATE INDEX IF NOT EXISTS idx_candidats_scout_id    ON public.candidats(scout_id);
CREATE INDEX IF NOT EXISTS idx_candidats_mandat_id   ON public.candidats(mandat_id);
CREATE INDEX IF NOT EXISTS idx_candidats_statut      ON public.candidats(statut);
CREATE INDEX IF NOT EXISTS idx_placements_scout_id   ON public.placements(scout_id);
CREATE INDEX IF NOT EXISTS idx_placements_mandat_id  ON public.placements(mandat_id);
CREATE INDEX IF NOT EXISTS idx_placements_paiement   ON public.placements(statut_paiement);
CREATE INDEX IF NOT EXISTS idx_factures_placement_id ON public.factures(placement_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut       ON public.factures(statut);
CREATE INDEX IF NOT EXISTS idx_formations_scout_id   ON public.formations_progress(scout_id);


-- ────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER updated_at AUTOMATIQUE
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mandats_updated
    BEFORE UPDATE ON public.mandats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_candidats_updated
    BEFORE UPDATE ON public.candidats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_placements_updated
    BEFORE UPDATE ON public.placements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_factures_updated
    BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_formations_updated
    BEFORE UPDATE ON public.formations_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_roadmap_updated
    BEFORE UPDATE ON public.roadmap_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────────────────
-- 6. AUTO-CRÉER LE PROFIL À L'INSCRIPTION (trigger auth)
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, nom, prenom, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom',    split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'prenom', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'scout')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────────────────
-- 7. FONCTIONS HELPER POUR RLS (SECURITY DEFINER évite la récursion infinie)
-- ────────────────────────────────────────────────────────────────────────

-- Retourne le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Vrai si l'utilisateur connecté est superviseur
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
-- 8. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandats             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formations_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_items       ENABLE ROW LEVEL SECURITY;

-- ── TABLE: users ────────────────────────────────────────────
-- Superviseur : voir tout le monde
CREATE POLICY "superviseur_select_all_users" ON public.users
  FOR SELECT TO authenticated USING (public.is_superviseur());

-- Scout : voir uniquement son propre profil
CREATE POLICY "scout_select_own_user" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());

-- Tout utilisateur : modifier son propre profil
CREATE POLICY "any_update_own_user" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Superviseur : créer / désactiver des utilisateurs
CREATE POLICY "superviseur_insert_user" ON public.users
  FOR INSERT TO authenticated WITH CHECK (public.is_superviseur());
CREATE POLICY "superviseur_delete_user" ON public.users
  FOR DELETE TO authenticated USING (public.is_superviseur());

-- ── TABLE: mandats ───────────────────────────────────────────
-- Superviseur : accès complet
CREATE POLICY "superviseur_all_mandats" ON public.mandats
  FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());

-- Scout : voir + créer + modifier ses propres mandats
CREATE POLICY "scout_select_own_mandats" ON public.mandats
  FOR SELECT TO authenticated USING (scout_id = auth.uid());
CREATE POLICY "scout_insert_mandats" ON public.mandats
  FOR INSERT TO authenticated WITH CHECK (scout_id = auth.uid());
CREATE POLICY "scout_update_own_mandats" ON public.mandats
  FOR UPDATE TO authenticated USING (scout_id = auth.uid());

-- ── TABLE: candidats ─────────────────────────────────────────
-- Superviseur : accès complet
CREATE POLICY "superviseur_all_candidats" ON public.candidats
  FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());

-- Scout : gérer ses propres candidats
CREATE POLICY "scout_select_own_candidats" ON public.candidats
  FOR SELECT TO authenticated USING (scout_id = auth.uid());
CREATE POLICY "scout_insert_candidats" ON public.candidats
  FOR INSERT TO authenticated WITH CHECK (scout_id = auth.uid());
CREATE POLICY "scout_update_own_candidats" ON public.candidats
  FOR UPDATE TO authenticated USING (scout_id = auth.uid());
CREATE POLICY "scout_delete_own_candidats" ON public.candidats
  FOR DELETE TO authenticated USING (scout_id = auth.uid());

-- ── TABLE: placements ────────────────────────────────────────
-- Superviseur : accès complet
CREATE POLICY "superviseur_all_placements" ON public.placements
  FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());

-- Scout : voir + créer ses placements (pas de suppression)
CREATE POLICY "scout_select_own_placements" ON public.placements
  FOR SELECT TO authenticated USING (scout_id = auth.uid());
CREATE POLICY "scout_insert_placements" ON public.placements
  FOR INSERT TO authenticated WITH CHECK (scout_id = auth.uid());

-- ── TABLE: factures ──────────────────────────────────────────
-- Superviseur : accès complet
CREATE POLICY "superviseur_all_factures" ON public.factures
  FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());

-- Scout : voir les factures liées à ses placements
CREATE POLICY "scout_select_own_factures" ON public.factures
  FOR SELECT TO authenticated
  USING (
    placement_id IN (
      SELECT id FROM public.placements WHERE scout_id = auth.uid()
    )
  );

-- ── TABLE: formations_progress ───────────────────────────────
-- Superviseur : tout voir
CREATE POLICY "superviseur_all_formations" ON public.formations_progress
  FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());

-- Scout : gérer uniquement sa propre progression
CREATE POLICY "scout_own_formations" ON public.formations_progress
  FOR ALL TO authenticated
  USING (scout_id = auth.uid()) WITH CHECK (scout_id = auth.uid());

-- ── TABLE: roadmap_items ─────────────────────────────────────
-- Superviseur : lecture + écriture
CREATE POLICY "superviseur_all_roadmap" ON public.roadmap_items
  FOR ALL TO authenticated USING (public.is_superviseur()) WITH CHECK (public.is_superviseur());

-- Scout : lecture seule (peut voir la roadmap mais pas la modifier)
CREATE POLICY "scout_read_roadmap" ON public.roadmap_items
  FOR SELECT TO authenticated USING (true);


-- ────────────────────────────────────────────────────────────────────────
-- 9. DONNÉES INITIALES — ROADMAP
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO public.roadmap_items (titre, description, phase, ordre, priorite, complete) VALUES

-- Phase 1 : Fondations
('Supabase Auth + rôles',
 'Remplacer le PIN hardcodé par Supabase Auth email/password. Table users avec role superviseur/scout. Protection de toutes les routes.',
 1, 1, 'critique', false),

('Schéma BDD complet',
 'Tables mandats, candidats, placements, factures, formations_progress avec RLS par rôle.',
 1, 2, 'critique', false),

('Dashboard superviseur v1',
 'Page superviseur.html : scouts actifs, placements du mois, revenus Novalem, roadmap interactive, alertes.',
 1, 3, 'critique', false),

('Hub branché sur données réelles',
 'Stats KPIs depuis Supabase, feed d''activité live, rangs scouts calculés depuis BDD.',
 1, 4, 'haute', false),

-- Phase 2 : CRM
('CRM candidats fonctionnel',
 'CRUD complet, pipeline kanban drag-and-drop, filtres par statut/scout/mandat, recherche.',
 2, 1, 'haute', false),

('CRM mandats clients',
 'Fiches clients, postes ouverts, assignation scouts, suivi par mandat.',
 2, 2, 'haute', false),

('Pipeline & facturation',
 'Enregistrement placements, calcul commissions automatique, génération facture PDF.',
 2, 3, 'haute', false),

-- Phase 3 : Superviseur avancé
('Vue consolidée multi-scouts',
 'Comparer activité des scouts, heat maps, classement, alertes inactivité.',
 3, 1, 'normale', false),

('Gestion de l''équipe',
 'Inviter de nouveaux scouts par email, voir leur pipeline, assigner des mandats depuis le superviseur.',
 3, 2, 'normale', false),

-- Phase 4 : Formation
('Moteur de modules formation',
 'Player de leçons : texte + quiz + exercices. Navigation entre étapes, score, retry.',
 4, 1, 'normale', false),

('Contenu des 6 chapitres',
 'Rédiger et intégrer le contenu pédagogique des 6 chapitres de l''académie scout.',
 4, 2, 'normale', false),

('Système XP / Rangs réel',
 'Progression XP persistée en BDD, déblocage conditionnel des chapitres, badges.',
 4, 3, 'normale', false),

-- Phase 5 : Finitions
('Signature électronique',
 'Charger les contrats depuis BDD, signer, générer PDF signé, envoyer email de confirmation.',
 5, 1, 'basse', false),

('Statistiques complètes',
 'Tous les charts du dashboard statistiques branchés sur données réelles.',
 5, 2, 'basse', false),

('Dossier candidat 5 étapes',
 'Formulaire 5 étapes fonctionnel avec upload documents, sauvegarde et signature.',
 5, 3, 'basse', false);


-- ────────────────────────────────────────────────────────────────────────
-- 3.8 DEMANDES D'ACCÈS ─ soumises depuis rejoindre.html, validées par le superviseur
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.demandes_acces (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom        TEXT        NOT NULL,
  nom           TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,  -- stocké en clair, protégé par RLS (superviseur uniquement en lecture)
  statut        TEXT        NOT NULL DEFAULT 'en_attente',  -- en_attente | validé | refusé
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demandes_statut ON public.demandes_acces(statut);

ALTER TABLE public.demandes_acces ENABLE ROW LEVEL SECURITY;

-- Anonyme : soumettre une demande (depuis rejoindre.html sans compte)
CREATE POLICY "anon_insert_demande" ON public.demandes_acces
  FOR INSERT TO anon WITH CHECK (true);

-- Superviseur : lire les demandes en attente
CREATE POLICY "superviseur_select_demandes" ON public.demandes_acces
  FOR SELECT TO authenticated USING (public.is_superviseur());

-- Superviseur : valider ou refuser
CREATE POLICY "superviseur_update_demandes" ON public.demandes_acces
  FOR UPDATE TO authenticated USING (public.is_superviseur());


-- ════════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 : Après exécution de ce fichier
-- ════════════════════════════════════════════════════════════════════════
--
-- Va dans Supabase > Authentication > Users > "Add user"
-- Crée Louis : louismcrenault@gmail.com  (mot de passe de ton choix)
-- Crée Corentin : corentin@novalem.fr    (mot de passe de ton choix)
--
-- Le trigger handle_new_user créera automatiquement les lignes dans public.users
-- avec role = 'scout' par défaut.
--
-- ════════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 : Passer Louis en superviseur (exécuter APRÈS avoir créé le compte)
-- ════════════════════════════════════════════════════════════════════════
--
-- UPDATE public.users
-- SET
--   nom             = 'Renault',
--   prenom          = 'Louis',
--   role            = 'superviseur',
--   avatar_initials = 'LR',
--   avatar_color    = '#c8e040'
-- WHERE email = 'louismcrenault@gmail.com';
--
-- UPDATE public.users
-- SET
--   nom             = 'Dupont',
--   prenom          = 'Corentin',
--   role            = 'scout',
--   avatar_initials = 'C',
--   avatar_color    = '#2dd4a0'
-- WHERE email = 'corentin@novalem.fr';
--
-- ════════════════════════════════════════════════════════════════════════
-- NOTE : table job_applications existante
-- ════════════════════════════════════════════════════════════════════════
-- La table job_applications (utilisée par api/apply.js pour les candidatures
-- reçues depuis le site public) est CONSERVÉE telle quelle. Elle est
-- indépendante du nouveau schéma RLS ci-dessus.
-- ════════════════════════════════════════════════════════════════════════
