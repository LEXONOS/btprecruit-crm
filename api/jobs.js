// api/jobs.js — NOVALEM
// GET  /api/jobs                        → offres publiées (site)
// POST /api/jobs action=sign_contract   → signature électronique (public, sans auth)
// POST /api/jobs (X-CRM-Secret)         → actions CRM authentifiées

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
    return res.status(401).json({ error: 'Non autorisé' });
  }

  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }

  try {
    if (action === 'publish') {
      if (!job?.crm_id || !job?.title) return res.status(400).json({ error: 'crm_id et title requis' });
      const row = {
        crm_id: job.crm_id, title: job.title,
        location: job.location || '', contract_type: job.contract_type || 'CDI',
        category: job.cat || job.category || '',
        salary_display: job.salary_display || job.salary || '',
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
// Stockage dans novalem_signatures (table simple, pas de validation croisée)
// Le token long (2×uid = ~48 chars aléatoires) est l'authentification suffisante
async function handleSignContract(req, res) {
  const { co_id, ct_id, token, signer_name, signer_email, co_name } = req.body || {};

  if (!ct_id || !token || !signer_name?.trim()) {
    return res.status(400).json({ error: 'ct_id, token et signer_name sont requis' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
           || req.socket?.remoteAddress || 'unknown';
  const signed_at = new Date().toISOString();
  const ref = 'NV-' + ct_id.slice(0, 8).toUpperCase();

  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }

  // Vérifier si déjà signé (même ct_id + token)
  const { data: existing } = await sb
    .from('novalem_signatures')
    .select('signer_name, signed_at')
    .eq('ct_id', ct_id)
    .eq('token', token)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({
      error: 'Contrat déjà signé',
      signer_name: existing.signer_name,
      signed_at: existing.signed_at,
      reference: ref,
    });
  }

  // Enregistrer la signature
  const { error: insertErr } = await sb.from('novalem_signatures').insert({
    co_id:        co_id || null,
    ct_id,
    token,
    co_name:      co_name || null,
    signer_name:  signer_name.trim(),
    signer_email: signer_email || null,
    signer_ip:    ip,
    signed_at,
    status:       'signé',
  });

  if (insertErr) {
    console.error('[sign] Insert error:', insertErr.message);
    return res.status(500).json({ error: 'Erreur enregistrement signature: ' + insertErr.message });
  }

  // Envoyer les emails de notification
  const RESEND_KEY   = process.env.RESEND_API_KEY;
  const NOVALEM_EMAIL = process.env.CRM_USER_EMAIL || 'contact@novalem-recrutement.fr';
  const SENDER_EMAIL  = process.env.SENDER_EMAIL   || 'contact@novalem-recrutement.fr';

  const dt = new Date(signed_at).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris'
  });

  if (RESEND_KEY) {
    // Email à NOVALEM
    const htmlNovalem = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">
  <div style="background:#1A1614;padding:16px 24px"><div style="font-size:17px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div><div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;margin-top:1px">CONTRAT SIGNÉ ✅</div></div>
  <div style="padding:22px 24px">
    <div style="background:#F0FFF4;border:1px solid #86EFB0;border-radius:6px;padding:12px 16px;margin-bottom:18px;font-weight:700;color:#166534;font-size:14px">✅ ${co_name || co_id || 'Client'} vient de signer le contrat</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#888;width:130px">Client</td><td style="padding:8px 10px;font-weight:700">${co_name || co_id || '—'}</td></tr>
      <tr><td style="padding:8px 10px;color:#888">Signataire</td><td style="padding:8px 10px;font-weight:700">${signer_name}</td></tr>
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#888">Email</td><td style="padding:8px 10px">${signer_email || '—'}</td></tr>
      <tr><td style="padding:8px 10px;color:#888">Date & heure</td><td style="padding:8px 10px">${dt} (Paris)</td></tr>
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#888">IP</td><td style="padding:8px 10px;font-family:monospace;font-size:11px">${ip}</td></tr>
      <tr><td style="padding:8px 10px;color:#888">Référence</td><td style="padding:8px 10px;font-family:monospace;font-size:12px;color:#C9891A;font-weight:700">${ref}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#888">Prochaine étape : ouvrez le CRM → fiche client → onglet Contrats → Vérifier signature → transmettez les coordonnées du candidat.</p>
  </div>
  <div style="background:#F8F5EF;padding:10px 24px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">NOVALEM · Signature électronique simple eIDAS · ${ref}</div>
</div></body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `NOVALEM CRM <${SENDER_EMAIL}>`,
        to: [NOVALEM_EMAIL],
        subject: `✅ Contrat signé — ${co_name || 'Client'} (${ref})`,
        html: htmlNovalem,
      })
    }).catch(e => console.warn('[sign] email novalem:', e.message));

    // Email de confirmation au signataire
    if (signer_email) {
      const htmlClient = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">
  <div style="background:#1A1614;padding:16px 24px"><div style="font-size:17px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div><div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;margin-top:1px">CONFIRMATION DE SIGNATURE</div></div>
  <div style="padding:22px 24px">
    <p style="font-size:14px;font-weight:700;margin-bottom:14px">Bonjour ${signer_name},</p>
    <p style="font-size:13px;line-height:1.7;margin-bottom:16px">Nous confirmons avoir reçu votre signature électronique du <strong>Contrat Cadre de Recrutement NOVALEM</strong>.</p>
    <div style="background:#F8F5EF;border-radius:6px;padding:14px;margin-bottom:16px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9891A;margin-bottom:8px">Certificat de signature</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#666;width:110px">Signataire</td><td style="font-weight:700">${signer_name}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Date</td><td>${dt}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Référence</td><td style="font-family:monospace;color:#C9891A;font-weight:700">${ref}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Valeur légale</td><td>Signature simple — eIDAS (UE) n°910/2014</td></tr>
      </table>
    </div>
    <p style="font-size:12px;color:#888;line-height:1.65">NOVALEM vous contactera très prochainement avec les coordonnées du candidat pour organiser l'entretien. <strong>Conservez cet email comme preuve de signature.</strong></p>
  </div>
  <div style="background:#F8F5EF;padding:10px 24px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">NOVALEM · contact@novalem-recrutement.fr · 06 58 21 20 96 · novalem-recrutement.fr</div>
</div></body></html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Louis RENAULT — NOVALEM <${SENDER_EMAIL}>`,
          to: [signer_email],
          subject: `Confirmation de signature — Contrat NOVALEM (${ref})`,
          html: htmlClient,
        })
      }).catch(e => console.warn('[sign] email client:', e.message));
    }
  }

  return res.status(200).json({
    success:     true,
    signed_at,
    signer_name: signer_name.trim(),
    reference:   ref,
  });
}
