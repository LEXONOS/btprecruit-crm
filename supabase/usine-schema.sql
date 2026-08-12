-- =============================================================
-- USINE A SITES — migration Supabase
-- A executer dans le SQL Editor de Supabase (projet hfdkkdyyhpymrwiqmitn)
-- =============================================================

-- 1. Table principale : un dossier usine par client
CREATE TABLE IF NOT EXISTS public.web_usine (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID UNIQUE REFERENCES public.web_clients(id) ON DELETE CASCADE,
  intake      JSONB,                          -- fiche structuree triee par l'IA
  fichiers    JSONB DEFAULT '{}'::jsonb,      -- fichiers generes { "index.html": "...", ... }
  template    TEXT  DEFAULT 'love-dogs',
  repo        TEXT,                           -- ex: LEXONOS/love-dogs-client
  preview_url TEXT,                           -- ex: https://xxx.vercel.app
  statut      TEXT  DEFAULT 'brouillon',      -- brouillon | trie | genere | publie
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.web_usine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usine_all" ON public.web_usine;
CREATE POLICY "usine_all" ON public.web_usine
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Bucket de stockage pour les fichiers clients en vrac
INSERT INTO storage.buckets (id, name, public)
VALUES ('web-usine', 'web-usine', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "usine_storage_select" ON storage.objects;
CREATE POLICY "usine_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'web-usine');

DROP POLICY IF EXISTS "usine_storage_insert" ON storage.objects;
CREATE POLICY "usine_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'web-usine');

DROP POLICY IF EXISTS "usine_storage_update" ON storage.objects;
CREATE POLICY "usine_storage_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'web-usine');

DROP POLICY IF EXISTS "usine_storage_delete" ON storage.objects;
CREATE POLICY "usine_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'web-usine');
