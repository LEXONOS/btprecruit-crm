// api/apply.js
// ═══════════════════════════════════════════════════════
// Réception candidatures site Novalem → Supabase + Email
// POST /api/apply
// ═══════════════════════════════════════════════════════
// ⚠️  REMPLACE api/test-email.js — supprimer l'ancien fichier
// ═══════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const {
    job_id, job_title, job_reference,
    firstname, lastname, email, phone,
    linkedin_url, message, source
  } = req.body || {};

  // Validation
  if (!firstname?.trim() || !lastname?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Prénom, nom et email sont obligatoires' });
  }
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  try {
    // ── Sauvegarde Supabase ───────────────────────────
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: appData, error: dbErr } = await sb
      .from('job_applications')
      .insert({
        job_posting_id: job_id || null,
        job_title:      job_title   || 'Candidature spontanée',
        job_reference:  job_reference || null,
        firstname:      firstname.trim(),
        lastname:       lastname.trim(),
        email:          email.trim().toLowerCase(),
        phone:          phone?.trim()  || null,
        linkedin_url:   linkedin_url?.trim() || null,
        message:        message?.trim()      || null,
        source:         source || 'site_novalem',
        status:         'nouveau',
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    // ── Increment applications_count ─────────────────
    if (job_id) {
      await sb.rpc('increment_job_applications', { p_job_id: job_id });
    }

    // ── Notification email à Louis ───────────────────
    const resendKey = process.env.RESEND_API_KEY;
    const userEmail = process.env.CRM_USER_EMAIL || 'contact@novalem-recrutement.fr';
    if (resendKey) {
      const jobLabel = job_title ? `<strong>${job_title}</strong>${job_reference ? ` (${job_reference})` : ''}` : 'Candidature spontanée';
      const emailBody = `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0D1117;color:#ECE7DB;padding:32px;border-radius:8px">
          <div style="border-bottom:2px solid #E8A020;padding-bottom:16px;margin-bottom:24px">
            <h1 style="font-size:18px;margin:0;color:#E8A020">🎯 Nouvelle candidature Novalem</h1>
            <p style="margin:4px 0 0;font-size:13px;color:#8b9ab0">Reçue le ${new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#8b9ab0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Poste</td><td style="padding:8px 0;font-size:14px">${jobLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#8b9ab0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Nom</td><td style="padding:8px 0;font-size:14px"><strong>${firstname} ${lastname}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#8b9ab0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Email</td><td style="padding:8px 0;font-size:14px"><a href="mailto:${email}" style="color:#E8A020">${email}</a></td></tr>
            ${phone ? `<tr><td style="padding:8px 0;color:#8b9ab0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Téléphone</td><td style="padding:8px 0;font-size:14px">${phone}</td></tr>` : ''}
            ${linkedin_url ? `<tr><td style="padding:8px 0;color:#8b9ab0;font-size:12px;text-transform:uppercase;letter-spacing:1px">LinkedIn</td><td style="padding:8px 0;font-size:14px"><a href="${linkedin_url}" style="color:#E8A020" target="_blank">Voir profil →</a></td></tr>` : ''}
          </table>
          ${message ? `<div style="margin-top:20px;padding:16px;background:#1a2030;border-radius:6px;border-left:3px solid #E8A020"><p style="margin:0 0 8px;color:#8b9ab0;font-size:11px;text-transform:uppercase;letter-spacing:1px">Message</p><p style="margin:0;font-size:13px;line-height:1.6">${message.replace(/\n/g,'<br>')}</p></div>` : ''}
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1e2a3a">
            <a href="https://novalem-crm.vercel.app/crm" style="display:inline-block;background:#E8A020;color:#0D1117;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:600;font-size:13px">Voir dans le CRM →</a>
          </div>
        </div>
      `;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Novalem CRM <contact@novalem-recrutement.fr>',
          to:      [userEmail],
          subject: `🎯 Candidature : ${firstname} ${lastname} — ${job_title || 'Spontanée'}`,
          html:    emailBody,
        })
      });
    }

    return res.status(200).json({ success: true, id: appData.id });

  } catch (err) {
    console.error('apply.js error:', err);
    return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
  }
};
