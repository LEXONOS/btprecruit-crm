// api/jobs.js
// ═══════════════════════════════════════════════════════
// API Offres d'emploi Novalem
// GET  /api/jobs           → liste publique (site web, Indeed, Google)
// POST /api/jobs           → CRUD admin (CRM) — nécessite X-CRM-Secret
// ═══════════════════════════════════════════════════════
// ⚠️  REMPLACE api/post-job.js — supprimer l'ancien fichier
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

function getSB() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
  return createClient(url, key);
}

function isAdmin(req) {
  const secret = process.env.CRM_SECRET;
  if (!secret) return false;
  return req.headers['x-crm-secret'] === secret;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET PUBLIC — aucune auth requise ──────────────────
  if (req.method === 'GET') {
    try {
      const sb = getSB();
      const { data, error } = await sb
        .from('job_postings')
        .select('id,reference,title,cat,description,location,department,contract_type,salary_display,salary_min,salary_max,experience,skills,remote_work,featured,created_at,expires_at')
        .eq('published', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ jobs: data || [], count: (data || []).length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST ADMIN — auth CRM requise ─────────────────────
  if (req.method === 'POST') {
    if (!isAdmin(req)) {
      return res.status(401).json({ error: 'Non autorisé — X-CRM-Secret invalide' });
    }

    const { action, job } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action requise' });

    try {
      const sb = getSB();

      // ── CRÉER ────────────────────────────────────────
      if (action === 'create') {
        if (!job?.title || !job?.description || !job?.location) {
          return res.status(400).json({ error: 'title, description et location requis' });
        }
        const { data, error } = await sb
          .from('job_postings')
          .insert({
            reference:     job.reference    || null,
            title:         job.title,
            cat:           job.cat          || 'go',
            description:   job.description,
            location:      job.location,
            department:    job.department   || null,
            contract_type: job.contract_type|| 'CDI',
            salary_display:job.salary_display|| null,
            salary_min:    job.salary_min   || null,
            salary_max:    job.salary_max   || null,
            experience:    job.experience   || null,
            skills:        job.skills       || [],
            remote_work:   job.remote_work  || 'Non',
            featured:      job.featured     || false,
            published:     job.published    || false,
            crm_id:        job.crm_id       || null,
            expires_at:    job.expires_at   || null,
          })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, job: data });
      }

      // ── METTRE À JOUR ────────────────────────────────
      if (action === 'update') {
        if (!job?.id) return res.status(400).json({ error: 'job.id requis' });
        const { id, crm_id, created_at, views_count, applications_count, ...fields } = job;
        const { data, error } = await sb
          .from('job_postings')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, job: data });
      }

      // ── TOGGLE PUBLISH ───────────────────────────────
      if (action === 'toggle_publish') {
        if (!job?.id) return res.status(400).json({ error: 'job.id requis' });
        const { data: current, error: fetchErr } = await sb
          .from('job_postings').select('published').eq('id', job.id).single();
        if (fetchErr) throw fetchErr;
        const newState = !current.published;
        const { data, error } = await sb
          .from('job_postings')
          .update({ published: newState, updated_at: new Date().toISOString() })
          .eq('id', job.id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, job: data, published: newState });
      }

      // ── SUPPRIMER ────────────────────────────────────
      if (action === 'delete') {
        if (!job?.id) return res.status(400).json({ error: 'job.id requis' });
        const { error } = await sb.from('job_postings').delete().eq('id', job.id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ── LISTE ADMIN (brouillons inclus) ──────────────
      if (action === 'list_all') {
        const { data, error } = await sb
          .from('job_postings')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ jobs: data || [] });
      }

      // ── CANDIDATURES D'UNE OFFRE ─────────────────────
      if (action === 'get_applications') {
        if (!job?.id) return res.status(400).json({ error: 'job.id requis' });
        const { data, error } = await sb
          .from('job_applications')
          .select('*')
          .eq('job_posting_id', job.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ applications: data || [] });
      }

      // ── TOUTES CANDIDATURES ───────────────────────────
      if (action === 'get_all_applications') {
        const { data, error } = await sb
          .from('job_applications')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ applications: data || [] });
      }

      // ── UPDATE STATUT CANDIDATURE ─────────────────────
      if (action === 'update_application_status') {
        const { application_id, status } = job || {};
        if (!application_id || !status) return res.status(400).json({ error: 'application_id et status requis' });
        const { data, error } = await sb
          .from('job_applications')
          .update({ status })
          .eq('id', application_id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, application: data });
      }

      return res.status(400).json({ error: `Action "${action}" non reconnue` });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};
