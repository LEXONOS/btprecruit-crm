-- LA TOUR (groupe LEXONOS) : base des agents.
-- Projet Supabase : Novalemo (fbmzlfrwxrzflfkazvmn), tables préfixées hq_ pour ne rien mélanger.
-- Déjà appliqué par Claude via le connecteur Supabase : ce fichier est une trace, rien à exécuter.
-- Sécurité : RLS activée sans politique sur toutes les tables, seul le serveur (clé secrète) lit et écrit.
-- Écritures sobres : pas de ligne par domaine scanné, seulement les prospects retenus ; compteurs du jour en une ligne.

create table if not exists public.hq_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_companies (
  id text primary key,
  name text not null,
  tagline text,
  kind text not null default 'entreprise',        -- groupe | labo | entreprise
  status text not null default 'active',          -- active | proposee | en_pause | fermee
  color text,
  floor_order int not null default 0,
  mission text,
  context text,                                   -- contexte métier injecté dans les prompts des agents
  kpis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_agents (
  id text primary key,
  company_id text not null references public.hq_companies(id) on delete cascade,
  parent_id text references public.hq_agents(id) on delete set null,
  name text not null,
  title text not null,
  tier text not null default 'agent',             -- pdg | dg | directeur | manager | rh | agent
  kind text not null default 'llm',               -- llm | job | attente
  job text,                                       -- travail déterministe (domaines, maps, enrichir, portfolio, github, controle)
  model text not null default 'fast',             -- fast | smart | genius
  mission text,
  charter text,                                   -- fiche de poste (venue du code, mise à jour avec lui)
  playbook text,                                  -- stratégie propre de l'agent (il la réécrit lui-même)
  tools text[] not null default '{}',
  cadence_min int not null default 1440,
  next_run_at timestamptz,
  last_run_at timestamptz,
  status text not null default 'idle',            -- idle | working | waiting | paused | error | attente
  current_task text,
  waiting_for text,                               -- ce qui lui manque (outil, accès, validation)
  stats jsonb not null default '{}'::jsonb,
  score numeric,
  seat int,
  origin text not null default 'fondation',       -- fondation | cree_par_agent
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hq_agents_due on public.hq_agents (next_run_at) where status not in ('paused', 'attente');
create index if not exists hq_agents_company on public.hq_agents (company_id);

create table if not exists public.hq_knowledge (
  id bigserial primary key,
  agent_id text not null references public.hq_agents(id) on delete cascade,
  kind text not null default 'lecon',             -- lecon | fait | regle | source
  content text not null,
  weight int not null default 5,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists hq_knowledge_agent on public.hq_knowledge (agent_id, weight desc, created_at desc);

create table if not exists public.hq_messages (
  id bigserial primary key,
  from_id text,                                   -- id d'agent, 'louis' ou 'systeme'
  to_id text,
  company_id text,
  kind text not null default 'rapport',           -- rapport | ordre | proposition | alerte | decision | evaluation | evenement | note
  subject text,
  body text,
  ref jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hq_messages_to on public.hq_messages (to_id, read_at);
create index if not exists hq_messages_created on public.hq_messages (created_at desc);

create table if not exists public.hq_tasks (
  id bigserial primary key,
  agent_id text not null references public.hq_agents(id) on delete cascade,
  from_id text,
  title text not null,
  brief text,
  status text not null default 'a_faire',         -- a_faire | fait | abandonne
  result text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists hq_tasks_agent on public.hq_tasks (agent_id, status);

create table if not exists public.hq_runs (
  id bigserial primary key,
  agent_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  model text,
  tokens_in int default 0,
  tokens_out int default 0,
  cache_read int default 0,
  searches int default 0,
  cost_usd numeric(10,5) default 0,
  ok boolean default true,
  summary text,
  log jsonb
);
create index if not exists hq_runs_agent on public.hq_runs (agent_id, started_at desc);
create index if not exists hq_runs_started on public.hq_runs (started_at desc);

create table if not exists public.hq_proposals (
  id bigserial primary key,
  company_id text,
  from_id text,
  kind text not null default 'autre',             -- nouvel_agent | nouvelle_entreprise | depense | strategie | outil | acces | autre
  title text not null,
  justification text,
  details jsonb not null default '{}'::jsonb,
  cost_month_usd numeric,
  status text not null default 'ouverte',         -- ouverte | a_louis | validee | refusee | executee
  avis jsonb not null default '[]'::jsonb,
  decided_by text,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hq_proposals_status on public.hq_proposals (status, created_at desc);

create table if not exists public.hq_leads (
  id bigserial primary key,
  company_id text not null default 'novalemo',
  dedupe text not null unique,                    -- place:<id> | domaine:<d> | siren:<n>
  source text not null,                           -- domaines | maps | registre | manuel
  name text,
  sector text,
  island text,                                    -- GP | MQ | MF | BL
  commune text,
  website text,
  domain text,
  email text,
  email_source text,                              -- site | devine
  phone text,
  site_state text,                                -- aucun | reseau | parking | construction | vide | douteux | correct | erreur
  score int,
  reason text,
  status text not null default 'nouveau',         -- nouveau | a_contacter | a_appeler | sans_contact | brouillon | contacte | relance | repondu | interesse | client | perdu | stop | ecarte
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contacted_at timestamptz
);
create index if not exists hq_leads_status on public.hq_leads (company_id, status, score desc);

create table if not exists public.hq_outbox (
  id bigserial primary key,
  lead_id bigint references public.hq_leads(id) on delete set null,
  agent_id text,
  to_email text not null,
  subject text not null,
  body text not null,
  step int not null default 1,
  angle text,
  status text not null default 'a_valider',       -- a_valider | pret | envoye | erreur | annule
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hq_outbox_status on public.hq_outbox (status, created_at desc);

create table if not exists public.hq_suppression (
  email text primary key,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.hq_items (
  id bigserial primary key,
  company_id text,
  agent_id text,
  kind text not null,                             -- reference | repo | veille | idee | script | niche | evaluation | etude
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'nouveau',
  score int,
  dedupe text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hq_items_kind on public.hq_items (company_id, kind, created_at desc);

create table if not exists public.hq_daily (
  day date primary key,
  cost_usd numeric(10,4) not null default 0,
  runs int not null default 0,
  searches int not null default 0,
  places int not null default 0,
  leads int not null default 0,
  emails int not null default 0,
  items int not null default 0
);

alter table public.hq_config enable row level security;
alter table public.hq_companies enable row level security;
alter table public.hq_agents enable row level security;
alter table public.hq_knowledge enable row level security;
alter table public.hq_messages enable row level security;
alter table public.hq_tasks enable row level security;
alter table public.hq_runs enable row level security;
alter table public.hq_proposals enable row level security;
alter table public.hq_leads enable row level security;
alter table public.hq_outbox enable row level security;
alter table public.hq_suppression enable row level security;
alter table public.hq_items enable row level security;
alter table public.hq_daily enable row level security;

-- Compteurs du jour : une seule ligne par jour, mise à jour atomique
create or replace function public.hq_bump(
  p_day date, p_cost numeric default 0, p_runs int default 0, p_searches int default 0,
  p_places int default 0, p_leads int default 0, p_emails int default 0, p_items int default 0
) returns void
language sql security definer set search_path = public as $$
  insert into public.hq_daily (day, cost_usd, runs, searches, places, leads, emails, items)
  values (p_day, coalesce(p_cost, 0), coalesce(p_runs, 0), coalesce(p_searches, 0), coalesce(p_places, 0), coalesce(p_leads, 0), coalesce(p_emails, 0), coalesce(p_items, 0))
  on conflict (day) do update set
    cost_usd = public.hq_daily.cost_usd + excluded.cost_usd,
    runs = public.hq_daily.runs + excluded.runs,
    searches = public.hq_daily.searches + excluded.searches,
    places = public.hq_daily.places + excluded.places,
    leads = public.hq_daily.leads + excluded.leads,
    emails = public.hq_daily.emails + excluded.emails,
    items = public.hq_daily.items + excluded.items;
$$;

-- Verrou de cycle : un seul passage à la fois (cron + bouton)
create or replace function public.hq_lock(p_name text, p_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hq_config (key, value, updated_at)
  values ('lock:' || p_name, jsonb_build_object('until', now() + make_interval(secs => p_seconds)), now())
  on conflict (key) do update set value = excluded.value, updated_at = now()
  where (public.hq_config.value->>'until')::timestamptz < now();
  return found;
end;
$$;

create or replace function public.hq_unlock(p_name text)
returns void
language sql security definer set search_path = public as $$
  delete from public.hq_config where key = 'lock:' || p_name;
$$;

-- Ménage : garde les tables légères (lancé par le Contrôleur de gestion)
create or replace function public.hq_menage()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r int; m int;
begin
  delete from public.hq_runs where started_at < now() - interval '45 days';
  get diagnostics r = row_count;
  delete from public.hq_messages where created_at < now() - interval '90 days' and kind not in ('evenement', 'decision');
  get diagnostics m = row_count;
  delete from public.hq_knowledge k where k.id in (
    select id from (
      select id, row_number() over (partition by agent_id order by weight desc, created_at desc) as rn
      from public.hq_knowledge
    ) x where x.rn > 80
  );
  return jsonb_build_object('runs', r, 'messages', m);
end;
$$;

revoke all on function public.hq_bump(date, numeric, int, int, int, int, int, int) from public, anon, authenticated;
revoke all on function public.hq_lock(text, int) from public, anon, authenticated;
revoke all on function public.hq_unlock(text) from public, anon, authenticated;
revoke all on function public.hq_menage() from public, anon, authenticated;
grant execute on function public.hq_bump(date, numeric, int, int, int, int, int, int) to service_role;
grant execute on function public.hq_lock(text, int) to service_role;
grant execute on function public.hq_unlock(text) to service_role;
grant execute on function public.hq_menage() to service_role;
