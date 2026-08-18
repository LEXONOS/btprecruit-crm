-- phase10.sql — Suivi des factures (Indy)
-- Cree la table qui stocke les factures rattachees a un client + leur statut
-- (envoyee / payee). L'onglet Factures du dossier et la vue Factures en ont besoin.
-- Execute une fois dans Supabase > SQL Editor.

create table if not exists web_factures (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references web_clients(id) on delete cascade,
  numero text,
  montant numeric,
  date_facture date,
  statut text not null default 'envoyee',   -- envoyee | payee
  fichier text,                              -- chemin du PDF dans le bucket web-usine
  created_at timestamptz not null default now()
);

-- Meme posture que le reste du CRM : lecture/ecriture reservees aux comptes connectes.
alter table web_factures enable row level security;
drop policy if exists "factures auth all" on web_factures;
create policy "factures auth all" on web_factures
  for all to authenticated using (true) with check (true);

-- Les PDF des factures sont stockes dans le bucket "web-usine" (le meme que l'atelier),
-- sous le chemin {client_id}/factures/... . Si ce bucket n'existe pas encore :
-- Supabase > Storage > New bucket > nom "web-usine" > Public > Create.
