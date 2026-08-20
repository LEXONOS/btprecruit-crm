-- =============================================================
-- NOVALEM APP — Phase 16 (a executer une fois dans Supabase > SQL Editor)
-- REPARE l'origine des cibles : re-tague en 'decouverte' (IA) toutes
-- les cibles qui viennent clairement de Decouverte mais avaient perdu
-- leur marqueur source (bug de repli d'insertion, corrige cote code).
-- Une cible manuelle n'a jamais de place_id : ce backfill ne touche
-- donc QUE des cibles IA. Sans risque, ne fait rien deux fois.
-- =============================================================
UPDATE public.web_prospection_cibles
SET source = 'decouverte'
WHERE source IS NULL
  AND (
    place_id IS NOT NULL
    OR (enrichissement ->> 'source') = 'decouverte'
  );

-- Verification (optionnel) : compter par origine
-- SELECT COALESCE(source,'(vide=manuel)') AS origine, count(*)
-- FROM public.web_prospection_cibles GROUP BY 1 ORDER BY 2 DESC;

-- ------------------------------------------------------------------
-- OPTION "repartir propre" (NE PAS jouer sauf si tu veux vraiment
-- vider ta file d'appels de test et rescanner depuis zero). Decommente
-- les 2 lignes ci-dessous seulement dans ce cas. IRREVERSIBLE.
-- DELETE FROM public.web_prospection_actions;
-- DELETE FROM public.web_prospection_cibles WHERE statut = 'a_appeler';
