-- =============================================================
-- NOVALEM APP — Phase 12 (a executer une fois dans Supabase > SQL Editor)
-- Rend le message WhatsApp modifiable depuis l'app (bouton "Modifier
-- le message" sur la page Decouverte). Le texte est stocke ici, donc
-- il te suit sur tous tes appareils.
-- Sans risque : ne fait rien si c'est deja en place.
-- (Necessite web_societe, cree par phase6.sql.)
-- =============================================================
ALTER TABLE public.web_societe
  ADD COLUMN IF NOT EXISTS message_whatsapp TEXT;
