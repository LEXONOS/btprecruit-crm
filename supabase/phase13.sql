-- =============================================================
-- NOVALEM APP — Phase 13 (a executer une fois dans Supabase > SQL Editor)
-- Rend la valeur d'un RDV flexible : au lieu de compter 490 EUR pour
-- chaque RDV, on stocke la vraie valeur estimee choisie au moment du RDV
-- (une des 3 formules de site, un menu QR, un montant libre, ou 0 pour un
-- RDV qui n'est pas commercial). Les calculs de CA lisent cette valeur.
-- Sans risque : ne fait rien si c'est deja en place.
-- =============================================================
ALTER TABLE public.web_clients
  ADD COLUMN IF NOT EXISTS valeur_estimee NUMERIC;

ALTER TABLE public.web_evenements
  ADD COLUMN IF NOT EXISTS montant NUMERIC;
