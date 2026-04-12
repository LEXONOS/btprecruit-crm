// api/jobs.js — NOVALEM
// ─────────────────────────────────────────────────────────────────────
// GET  /api/jobs                         → liste publique offres publiées (site web)
// POST /api/jobs  (header X-CRM-Secret)  → actions CRM authentifiées
//
// Actions POST : publish | unpublish | list_all | get_applications |
//                update_app_status | delete
//
// Env requis : SUPABASE_URL, SUPABASE_ANON_KEY, CRM_SECRET
//
// ─── SQL À EXÉCUTER DANS SUPABASE (SQL Editor) ───────────────────────
//
// create table if not exists public.jobs (
//   id                  uuid default gen_random_uuid() primary key,
//   crm_id              text unique,
//   title               text not null,
//   location            text default '',
//   contract_type       text default 'CDI',
//   category            text default '',
//   salary_display      text default '',
//   experience          text default '',
//   reference           text default '',
//   description         text default '',
//   skills              text[] default '{}',
//   published           boolean default false,
//   views_count         integer default 0,
//   applications_count  integer default 0,
//   created_at          timestamptz default now(),
//   updated_at          timestamptz default now()
// );
// alter table public.jobs enable row level security;
// create policy "public_read"   on public.jobs for select using (published = true);
// create policy "service_write" on public.jobs for all    using (true);
//
// create table if not exists public.job_applications (
//   id            uuid default gen_random_uuid() primary key,
//   job_id        uuid references public.jobs(id) on delete set null,
//   job_title     text,
//   job_reference text,
//   firstname     text not null,
//   lastname      text not null,
//   email         text not null,
//   phone         text,
//   linkedin_url  text,
//   message       text,
//   source        text default 'site_novalem',
//   status        text default 'new',
//   created_at    timestamptz default now()
// );
// alter table public.job_applications enable row level security;
// create policy "service_all" on public.job_applications for all using (true);
//
// create or replace function increment_job_applications(p_job_id uuid)
// returns void language plpgsql as $$
// begin
//   update public.jobs
//     set applications_count = applications_count + 1, updated_at = now()
//   where id = p_job_id;
// end;
// $$;
// ─────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

function getSB() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
  return createClient(url, key);
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-CRM-Secret',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ══ GET — liste publique pour le site ═══════════════════════════
  if (req.method === 'GET') {
    try {
      const sb = getSB();
      const { data: jobs, error } = await sb
        .from('jobs')
        .select('id,title,location,contract_type,category,salary_display,experience,reference,description,skills,views_count,applications_count,created_at')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ jobs: jobs || [] });
    } catch (err) {
      console.error('[api/jobs GET]', err.message);
      return res.status(500).json({ jobs: [], error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET ou POST requis' });

  // ══ POST — CRM authentifié ═══════════════════════════════════════
  const secret = req.headers['x-crm-secret'];
  if (!secret || secret !== process.env.CRM_SECRET) {
    return res.status(401).json({ error: 'Non autorisé — X-CRM-Secret invalide' });
  }

  const { action, job } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action requis' });

  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }

  try {
    if (action === 'publish') {
      if (!job?.crm_id || !job?.title) return res.status(400).json({ error: 'crm_id et title requis' });
      const row = {
        crm_id: job.crm_id, title: job.title,
        location: job.location || '', contract_type: job.contract_type || 'CDI',
        category: job.cat || job.category || '', salary_display: job.salary_display || job.salary || '',
        experience: job.experience || '', reference: job.reference || '',
        description: job.description || job.body || '',
        skills: Array.isArray(job.skills) ? job.skills : [],
        published: true, updated_at: new Date().toISOString(),
      };
      const { data, error } = await sb.from('jobs').upsert(row, { onConflict: 'crm_id' }).select().single();
      if (error) throw error;
      return res.status(200).json({ success: true, job: data });
    }

    if (action === 'unpublish') {
      if (!job?.id && !job?.crm_id) return res.status(400).json({ error: 'id ou crm_id requis' });
      const filter = job.id ? { id: job.id } : { crm_id: job.crm_id };
      const { error } = await sb.from('jobs').update({ published: false, updated_at: new Date().toISOString() }).match(filter);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'list_all') {
      const { data: jobs, error } = await sb.from('jobs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, jobs: jobs || [] });
    }

    if (action === 'get_applications') {
      if (!job?.id) return res.status(400).json({ error: 'job.id requis' });
      const { data: apps, error } = await sb.from('job_applications').select('*').eq('job_id', job.id).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, applications: apps || [] });
    }

    if (action === 'update_app_status') {
      if (!job?.app_id || !job?.status) return res.status(400).json({ error: 'app_id et status requis' });
      const { error } = await sb.from('job_applications').update({ status: job.status }).eq('id', job.app_id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'delete') {
      if (!job?.id && !job?.crm_id) return res.status(400).json({ error: 'id ou crm_id requis' });
      const filter = job.id ? { id: job.id } : { crm_id: job.crm_id };
      const { error } = await sb.from('jobs').delete().match(filter);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Action inconnue : ${action}` });

  } catch (err) {
    console.error('[api/jobs POST]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
