// api/lib/email.js
// Envoi d'emails via Resend (resend.com)
// Variable d'env requise: RESEND_API_KEY

export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY manquante dans les variables Vercel');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'BTPRecruit CRM <onboarding@resend.dev>',
      to: [to],
      subject,
      html
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Resend erreur (${resp.status}): ${err.message || JSON.stringify(err)}`);
  }

  return await resp.json();
}

// Template email HTML
export function buildReminderEmail({ alerts, agenda, pipeline, date }) {
  const hasContent = alerts.length > 0 || agenda.length > 0 || pipeline.length > 0;

  const alertsHtml = alerts.length ? `
    <div style="margin-bottom:28px">
      <h2 style="font-family:sans-serif;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#e04a4a;margin:0 0 12px">
        ⚡ Actions urgentes (${alerts.length})
      </h2>
      ${alerts.map(a => `
        <div style="padding:10px 14px;background:#1a0a0a;border:1px solid #3d1010;border-left:3px solid #e04a4a;border-radius:3px;margin-bottom:6px;font-family:monospace;font-size:13px;color:#e4e4db">
          ${a}
        </div>`).join('')}
    </div>` : '';

  const agendaHtml = agenda.length ? `
    <div style="margin-bottom:28px">
      <h2 style="font-family:sans-serif;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#cfe046;margin:0 0 12px">
        📅 Agenda aujourd'hui (${agenda.length})
      </h2>
      ${agenda.map(a => `
        <div style="padding:10px 14px;background:#111110;border:1px solid #272724;border-radius:3px;margin-bottom:6px;font-family:monospace;font-size:13px;color:#e4e4db;display:flex;gap:12px">
          <span style="color:#e0983a;min-width:44px">${a.time || '—'}</span>
          <span>${a.title}</span>
        </div>`).join('')}
    </div>` : '';

  const pipelineHtml = pipeline.length ? `
    <div style="margin-bottom:28px">
      <h2 style="font-family:sans-serif;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#3de09a;margin:0 0 12px">
        🔄 Pipeline actif (${pipeline.length} candidats)
      </h2>
      ${pipeline.map(c => `
        <div style="padding:10px 14px;background:#111110;border:1px solid #272724;border-radius:3px;margin-bottom:6px;font-family:monospace;font-size:13px;color:#e4e4db">
          <span style="color:#3de09a;font-weight:700">${c.name}</span>
          <span style="color:#74746c"> · </span>
          <span style="color:#e0983a">${c.status}</span>
          ${c.role ? `<span style="color:#74746c"> · ${c.role}</span>` : ''}
        </div>`).join('')}
    </div>` : '';

  const emptyHtml = !hasContent ? `
    <div style="text-align:center;padding:32px;color:#74746c;font-family:monospace;font-size:13px">
      ✅ Aucune action requise aujourd'hui — bonne journée !
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0b0b09">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="padding:20px 24px;background:#111110;border:1px solid #272724;border-radius:6px 6px 0 0;border-bottom:none">
      <div style="font-family:sans-serif;font-weight:800;font-size:20px;color:#e4e4db">
        BTP<span style="color:#cfe046">Recruit</span>
      </div>
      <div style="font-family:monospace;font-size:11px;color:#74746c;margin-top:3px;text-transform:uppercase;letter-spacing:.1em">
        Récap du ${date}
      </div>
    </div>

    <!-- Content -->
    <div style="padding:24px;background:#111110;border:1px solid #272724;border-top:2px solid #cfe046;border-radius:0 0 6px 6px">
      ${alertsHtml}
      ${agendaHtml}
      ${pipelineHtml}
      ${emptyHtml}

      <!-- CTA -->
      <div style="text-align:center;margin-top:24px;padding-top:20px;border-top:1px solid #272724">
        <a href="${process.env.CRM_URL || 'https://novalem-crm.vercel.app'}"
           style="display:inline-block;padding:12px 28px;background:#cfe046;color:#0a0a08;font-family:sans-serif;font-weight:700;font-size:13px;border-radius:3px;text-decoration:none">
          Ouvrir le CRM →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:12px 0;text-align:center;font-family:monospace;font-size:10px;color:#44443e">
      BTPRecruit CRM · Email automatique quotidien
    </div>
  </div>
</body>
</html>`;
}
