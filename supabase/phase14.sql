-- =============================================================
-- NOVALEM APP — Phase 14 (a executer une fois dans Supabase > SQL Editor)
-- Tranche 1 : origine + canal des cibles de prospection.
--   source : d'ou vient la cible ('decouverte' = trouvee par l'IA,
--            'reperage' = ajoutee a la main). Permet de filtrer
--            "montre-moi seulement ce que l'IA a ramene".
--   canal  : par quel canal on prospecte ce contact ('tel' ou
--            'whatsapp'). Se met tout seul a 'whatsapp' quand tu
--            cliques WhatsApp, ou a la main dans la session.
-- Sans risque : ne fait rien si c'est deja en place.
-- =============================================================
ALTER TABLE public.web_prospection_cibles
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE public.web_prospection_cibles
  ADD COLUMN IF NOT EXISTS canal TEXT;
