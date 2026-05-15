// api/apply.js — Novalem candidature receiver
// CommonJS — Vercel serverless function
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

module.exports = async function handler(req, res) {
  // ── CORS preflight ──────────────────────────────────
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const {
      job_id, job_title, job_reference,
      firstname, lastname, email, phone,
      linkedin_url, message, source
    } = req.body || {};

    // Validation
    if (!firstname || !lastname || !email) {
      return res.status(400).json({ error: 'Prénom, nom et email sont obligatoires' });
    }

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    // ── Insert dans Supabase ─────────────────────────
    const record = {
      job_posting_id: job_id        || null,
      job_title:     job_title     || null,
      job_reference: job_reference || null,
      firstname:     (firstname || '').trim(),
      lastname:      (lastname  || '').trim(),
      email:         (email     || '').trim().toLowerCase(),
      phone:         (phone     || '').trim() || null,
      linkedin_url:  (linkedin_url || '').trim() || null,
      message:       (message   || '').trim() || null,
      source:        source || 'site_novalem',
      status:        'nouveau',
    };

    const { data: appData, error: appError } = await supabase
      .from('job_applications')
      .insert([record])
      .select()
      .single();

    if (appError) {
      console.error('[apply] Supabase insert error:', appError.message);
      // Continue quand même — ne pas bloquer la candidature
    }

    // Incrémenter le compteur si job_id
    if (job_id) {
      await supabase.rpc('increment_job_applications', { p_job_id: job_id })
        .catch(e => console.warn('[apply] increment error:', e.message));
    }

    // ── Notification email via Resend ────────────────
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const TO_EMAIL   = process.env.CRM_USER_EMAIL || 'contact@novalem-recrutement.fr';

    if (RESEND_KEY) {
      const subject = job_title
        ? `[Novalem] Candidature — ${job_title} — ${firstname} ${lastname}`
        : `[Novalem] Candidature spontanée — ${firstname} ${lastname}`;

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
          <div style="background:#C8900A;padding:20px 28px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0;font-size:18px">Nouvelle candidature Novalem</h2>
          </div>
          <div style="background:#fff;padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
            ${job_title ? `<p style="background:#FFF8EC;border:1px solid #F0D090;padding:10px 14px;border-radius:6px;margin-bottom:20px;font-size:14px"><strong>Offre :</strong> ${job_title}${job_reference ? ` (${job_reference})` : ''}</p>` : '<p style="background:#f5f5f5;padding:10px 14px;border-radius:6px;margin-bottom:20px;font-size:14px"><em>Candidature spontanée</em></p>'}
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#888;width:120px">Nom</td><td style="padding:8px 0;font-weight:600">${firstname} ${lastname}</td></tr>
              <tr><td style="padding:8px 0;color:#888">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#C8900A">${email}</a></td></tr>
              ${phone ? `<tr><td style="padding:8px 0;color:#888">Téléphone</td><td style="padding:8px 0">${phone}</td></tr>` : ''}
              ${linkedin_url ? `<tr><td style="padding:8px 0;color:#888">LinkedIn</td><td style="padding:8px 0"><a href="${linkedin_url}" style="color:#C8900A">Voir le profil</a></td></tr>` : ''}
              <tr><td style="padding:8px 0;color:#888">Source</td><td style="padding:8px 0">${source || 'site'}</td></tr>
            </table>
            ${message ? `<div style="margin-top:16px;padding:14px;background:#f9f9f9;border-radius:6px;font-size:14px;line-height:1.7"><strong>Message :</strong><br>${message.replace(/\n/g,'<br>')}</div>` : ''}
            <p style="margin-top:20px;font-size:12px;color:#999">Candidature reçue le ${new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
          </div>
        </div>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Novalem Recrutement <contact@novalem-recrutement.fr>',
          to:   [TO_EMAIL],
          reply_to: email,
          subject,
          html,
        })
      }).catch(e => console.warn('[apply] Resend error:', e.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Candidature reçue',
      id: appData?.id || null,
    });

  } catch (err) {
    console.error('[apply] Erreur:', err);
    return res.status(500).json({ error: 'Erreur serveur — réessayez ou contactez-nous directement.' });
  }
};
