// api/jobs.js — NOVALEM
// GET  /api/jobs                          → offres publiées (site)
// POST /api/jobs action=sign_contract     → signature électronique (public, token)
// POST /api/jobs (X-CRM-Secret)           → actions CRM authentifiées

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

  // ══ GET — offres publiées ══════════════════════════════════════
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
      return res.status(500).json({ jobs: [], error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET ou POST requis' });

  const { action, job } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action requis' });

  // ══ Signature électronique — PUBLIC (pas de secret requis) ═════
  if (action === 'sign_contract') {
    return handleSignContract(req, res);
  }

  // ══ Actions CRM authentifiées ══════════════════════════════════
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
      const filter = job?.id ? { id: job.id } : { crm_id: job?.crm_id };
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
      const { data: apps, error } = await sb.from('job_applications').select('*').eq('job_id', job?.id).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, applications: apps || [] });
    }
    if (action === 'update_app_status') {
      const { error } = await sb.from('job_applications').update({ status: job?.status }).eq('id', job?.app_id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    if (action === 'delete') {
      const filter = job?.id ? { id: job.id } : { crm_id: job?.crm_id };
      const { error } = await sb.from('jobs').delete().match(filter);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: `Action inconnue : ${action}` });
  } catch (err) {
    console.error('[api/jobs]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ── Signature électronique ─────────────────────────────────────
async function handleSignContract(req, res) {
  const { co_id, ct_id, token, signer_name, signer_email } = req.body || {};

  if (!co_id || !ct_id || !token || !signer_name?.trim()) {
    return res.status(400).json({ error: 'Paramètres incomplets (co_id, ct_id, token, signer_name requis)' });
  }

  const ip        = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const signed_at = new Date().toISOString();
  const ref       = `NV-${ct_id.slice(0,8).toUpperCase()}`;

  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }

  // 1. Vérifier le token dans Supabase
  const { data: row, error: findErr } = await sb
    .from('companies_contracts')
    .select('*')
    .eq('ct_id', ct_id)
    .eq('signing_token', token)
    .single();

  if (findErr || !row) {
    return res.status(404).json({ error: 'Lien de signature invalide ou expiré' });
  }
  if (row.status === 'signé') {
    return res.status(409).json({
      error: 'Ce contrat a déjà été signé',
      signed_at: row.signed_at,
      signer_name: row.signer_name,
    });
  }

  // 2. Enregistrer la signature
  const { error: updateErr } = await sb
    .from('companies_contracts')
    .update({ status: 'signé', signer_name: signer_name.trim(), signed_at, signer_ip: ip, signer_email: signer_email||null })
    .eq('ct_id', ct_id);

  if (updateErr) {
    console.error('[sign] Supabase update:', updateErr.message);
    return res.status(500).json({ error: 'Erreur enregistrement signature' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const NOVALEM_EMAIL = process.env.CRM_USER_EMAIL || 'contact@novalem-recrutement.fr';
  const senderEmail = process.env.SENDER_EMAIL || 'contact@novalem-recrutement.fr';
  const dt = new Date(signed_at).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris'
  });

  if (RESEND_KEY) {
    // 3a. Email de notification à NOVALEM
    const htmlNovalem = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif;color:#1A1614">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">
  <div style="background:#1A1614;padding:18px 28px">
    <div style="font-size:18px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,.5);letter-spacing:2px;margin-top:2px">NOTIFICATION — CONTRAT SIGNÉ</div>
  </div>
  <div style="padding:24px 28px">
    <div style="background:#F0FFF4;border:1px solid #86EFB0;border-radius:6px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">✅</span>
      <span style="font-weight:700;color:#166534">Contrat signé — ${row.co_name || co_id}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#666;width:140px">Client</td><td style="padding:8px 10px;font-weight:700">${row.co_name || co_id}</td></tr>
      <tr><td style="padding:8px 10px;color:#666">Signataire</td><td style="padding:8px 10px;font-weight:700">${signer_name}</td></tr>
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#666">Email signataire</td><td style="padding:8px 10px">${signer_email || '—'}</td></tr>
      <tr><td style="padding:8px 10px;color:#666">Date & heure</td><td style="padding:8px 10px">${dt} (heure Paris)</td></tr>
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#666">Adresse IP</td><td style="padding:8px 10px;font-family:monospace;font-size:11px">${ip}</td></tr>
      <tr><td style="padding:8px 10px;color:#666">Référence</td><td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#C9891A">${ref}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#888;line-height:1.7">
      Prochaine étape : connectez-vous au CRM et transmettez les coordonnées du candidat au client.
    </p>
  </div>
  <div style="background:#F8F5EF;padding:12px 28px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">
    NOVALEM · contact@novalem-recrutement.fr · Signature électronique simple — eIDAS niveau 1
  </div>
</div></body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `NOVALEM CRM <${senderEmail}>`,
        to: [NOVALEM_EMAIL],
        subject: `✅ Contrat signé — ${row.co_name || co_id} (${ref})`,
        html: htmlNovalem,
      })
    }).catch(e => console.warn('[sign] notif NOVALEM:', e.message));

    // 3b. Email de confirmation au signataire (si email fourni)
    if (signer_email) {
      const htmlClient = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif;color:#1A1614">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">
  <div style="background:#1A1614;padding:18px 28px">
    <div style="font-size:18px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,.5);letter-spacing:2px;margin-top:2px">CONFIRMATION DE SIGNATURE</div>
  </div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1A1614">Bonjour ${signer_name},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7">Nous confirmons avoir reçu votre signature électronique du <strong>Contrat Cadre de Recrutement NOVALEM</strong>.</p>
    <div style="background:#F8F5EF;border-radius:6px;padding:14px 18px;margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9891A;margin-bottom:8px">Détails de la signature</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#666;width:120px">Signataire</td><td style="font-weight:600">${signer_name}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Date</td><td>${dt}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Référence</td><td style="font-family:monospace;color:#C9891A">${ref}</td></tr>
      </table>
    </div>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.7">NOVALEM va vous transmettre très prochainement les coordonnées du candidat pour organiser l'entretien.</p>
    <p style="margin:0;font-size:12px;color:#888;line-height:1.7">Cette signature électronique est juridiquement valide conformément au Règlement UE n°910/2014 (eIDAS). Conservez cet email comme preuve.</p>
  </div>
  <div style="background:#F8F5EF;padding:12px 28px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">
    NOVALEM · contact@novalem-recrutement.fr · 06 58 21 20 96 · novalem-recrutement.fr
  </div>
</div></body></html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Louis RENAULT — NOVALEM <${senderEmail}>`,
          to: [signer_email],
          subject: `Confirmation de signature — Contrat NOVALEM (${ref})`,
          html: htmlClient,
        })
      }).catch(e => console.warn('[sign] confirmation client:', e.message));
    }
  }

  return res.status(200).json({
    success: true,
    signed_at,
    signer_name: signer_name.trim(),
    reference: ref,
  });
}
