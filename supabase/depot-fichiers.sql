-- OPTIONNEL — a coller dans Supabase > SQL Editor UNIQUEMENT si tu veux
-- deposer les fichiers des clients directement dans l'atelier.
-- Pas necessaire pour prospecter. A faire une seule fois.
--
-- Cree le bucket "web-usine" et autorise les comptes connectes a lire /
-- deposer / supprimer dedans.

insert into storage.buckets (id, name, public)
values ('web-usine', 'web-usine', true)
on conflict (id) do nothing;

drop policy if exists "web_usine_all" on storage.objects;
create policy "web_usine_all" on storage.objects
  for all
  using (bucket_id = 'web-usine')
  with check (bucket_id = 'web-usine');
