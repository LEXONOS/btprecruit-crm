-- =============================================================
-- NOVALEM APP — Phase 11 (a executer une fois dans Supabase > SQL Editor)
-- Page "Decouverte" : evite les doublons quand on rescanne une zone.
-- On memorise l'identifiant Google (place_id) de chaque cible reperee.
-- Sans risque : ne fait rien si c'est deja en place.
-- (Pense aussi a avoir joue phase9.sql pour secteur/enrichissement ;
--  sinon la page enregistre quand meme, avec les colonnes de base.)
-- =============================================================
ALTER TABLE public.web_prospection_cibles
  ADD COLUMN IF NOT EXISTS place_id TEXT;

-- Un meme resto ne peut pas etre ajoute deux fois (les ajouts manuels,
-- sans place_id, ne sont pas concernes : NULL n'entre pas dans l'index).
CREATE UNIQUE INDEX IF NOT EXISTS web_cibles_place_id_uidx
  ON public.web_prospection_cibles(place_id)
  WHERE place_id IS NOT NULL;
