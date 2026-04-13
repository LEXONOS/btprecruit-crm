// api/jobs.js — NOVALEM
// GET  /api/jobs                         → offres publiées (site)
// POST /api/jobs (X-CRM-Secret)          → actions CRM authentifiées
// POST /api/jobs action=sign_contract    → signature électronique (public, token)

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

  // ══ GET — offres publiées (site) ═══════════════════════════════
  if (req.method === 'GET') {
    // Action publique : get_contract_info (pour la page de signature)
    if (req.query?.action === 'get_contract_info') {
      return handleGetContractInfo(req, res);
    }
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
      return res.status(500).json({ jobs: [], error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET ou POST requis' });

  const { action, job } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action requis' });

  // ══ Action publique : signature électronique (pas de secret requis) ══
  if (action === 'sign_contract') {
    return handleSignContract(req, res);
  }

  // ══ POST — CRM authentifié ═══════════════════════════════════════
  const secret = req.headers['x-crm-secret'];
  if (!secret || secret !== process.env.CRM_SECRET) {
    return res.status(401).json({ error: 'Non autorisé — X-CRM-Secret invalide' });
  }

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

// ── Page info contrat (GET public avec token) ──────────────────────
async function handleGetContractInfo(req, res) {
  const { co_id, ct_id, token } = req.query || {};
  if (!co_id || !ct_id || !token) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }
  try {
    const sb = getSB();
    const { data: company, error } = await sb
      .from('companies_contracts')
      .select('*')
      .eq('co_id', co_id)
      .eq('ct_id', ct_id)
      .eq('signing_token', token)
      .single();
    if (error || !company) {
      return res.status(404).json({ error: 'Contrat introuvable ou lien invalide' });
    }
    return res.status(200).json({ success: true, contract: company });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Signature électronique (POST public avec token) ────────────────
async function handleSignContract(req, res) {
  const { co_id, ct_id, token, signer_name } = req.body || {};
  if (!co_id || !ct_id || !token || !signer_name) {
    return res.status(400).json({ error: 'Paramètres incomplets' });
  }
  try {
    const sb = getSB();

    // 1. Valider le token dans la table contracts
    const { data: row, error: findErr } = await sb
      .from('companies_contracts')
      .select('*')
      .eq('co_id', co_id)
      .eq('ct_id', ct_id)
      .eq('signing_token', token)
      .single();

    if (findErr || !row) {
      return res.status(404).json({ error: 'Lien de signature invalide ou expiré' });
    }
    if (row.status === 'signé') {
      return res.status(409).json({ error: 'Ce contrat a déjà été signé', signed_at: row.signed_at });
    }

    // 2. Enregistrer la signature
    const signed_at = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    const { error: updateErr } = await sb
      .from('companies_contracts')
      .update({
        status:      'signé',
        signer_name: signer_name.trim(),
        signed_at,
        signer_ip:   ip,
      })
      .eq('co_id', co_id)
      .eq('ct_id', ct_id);

    if (updateErr) throw updateErr;

    // 3. Notifier NOVALEM par email
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const TO_EMAIL   = process.env.CRM_USER_EMAIL || 'contact@novalem-recrutement.fr';
    if (RESEND_KEY) {
      const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <div style="background:#C9891A;padding:16px 24px;border-radius:6px 6px 0 0">
          <h2 style="color:#fff;margin:0;font-size:16px">Contrat signé !</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 6px 6px">
          <p><strong>${row.co_name || 'Client'}</strong> vient de signer le contrat cadre NOVALEM.</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#888">Signataire</td><td><strong>${signer_name}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#888">Date</td><td>${new Date(signed_at).toLocaleString('fr-FR')}</td></tr>
            <tr><td style="padding:6px 0;color:#888">IP</td><td>${ip}</td></tr>
          </table>
          <p style="margin-top:16px;color:#666;font-size:12px">Connectez-vous au CRM pour consulter le contrat et transmettre les coordonnées du candidat.</p>
        </div>
      </div>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'NOVALEM CRM <contact@novalem-recrutement.fr>',
          to: [TO_EMAIL],
          subject: `Contrat signé — ${row.co_name || 'Client'}`,
          html,
        })
      }).catch(e => console.warn('[sign] Resend:', e.message));
    }

    return res.status(200).json({ success: true, signed_at, signer_name });

  } catch (err) {
    console.error('[sign_contract]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
