-- phase9.sql — Assistant prospect intelligent
-- Colonnes OPTIONNELLES pour memoriser l'analyse IA sur une cible.
-- L'assistant fonctionne meme sans les executer (il enregistre juste les
-- infos de base : email, telephone, qualite du site, lien du site).
-- Execute ce fichier une fois dans Supabase > SQL Editor pour, en plus,
-- garder le secteur et l'analyse complete sur chaque prospect.

alter table web_prospection_cibles add column if not exists secteur text;
alter table web_prospection_cibles add column if not exists enrichissement jsonb;
alter table web_prospection_cibles add column if not exists enrichi_le timestamptz;
