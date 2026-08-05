// api/lib/email.js
// Envoi d'emails via Resend depuis contact@novalem-recrutement.fr

async function sendEmail({ to, subject, html, from }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY manquante');

  const fromAddr = from
    || process.env.CRM_USER_EMAIL
    || 'contact@novalem-recrutement.fr';

  const fromLabel = `Novalem Recrutement <${fromAddr}>`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromLabel, to: [to], subject, html })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Resend (${resp.status}): ${err.message || JSON.stringify(err)}`);
  }
  return resp.json();
}

function buildReminderEmail({ alerts, agenda, pipeline, date }) {
  const CRM_URL = process.env.CRM_URL || 'https://novalem-crm.vercel.app';

  const alertsHtml = alerts.length ? `
    <div style="margin-bottom:24px">
      <h2 style="font-family:sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#e04a4a;margin:0 0 10px">⚡ Actions urgentes (${alerts.length})</h2>
      ${alerts.map(a => `<div style="padding:9px 12px;background:#1a0a0a;border:1px solid #3d1010;border-left:3px solid #e04a4a;border-radius:3px;margin-bottom:5px;font-family:monospace;font-size:12px;color:#e4e4db">${a}</div>`).join('')}
    </div>` : '';

  const agendaHtml = agenda.length ? `
    <div style="margin-bottom:24px">
      <h2 style="font-family:sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#cfe046;margin:0 0 10px">📅 Agenda aujourd'hui (${agenda.length})</h2>
      ${agenda.map(a => `<div style="padding:9px 12px;background:#111110;border:1px solid #272724;border-radius:3px;margin-bottom:5px;font-family:monospace;font-size:12px;color:#e4e4db"><span style="color:#e0983a;min-width:44px;display:inline-block">${a.time || '—'}</span> ${a.title}</div>`).join('')}
    </div>` : '';

  const pipelineHtml = pipeline.length ? `
    <div style="margin-bottom:24px">
      <h2 style="font-family:sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#3de09a;margin:0 0 10px">🔄 Pipeline actif (${pipeline.length})</h2>
      ${pipeline.map(c => `<div style="padding:9px 12px;background:#111110;border:1px solid #272724;border-radius:3px;margin-bottom:5px;font-family:monospace;font-size:12px;color:#e4e4db"><span style="color:#3de09a;font-weight:700">${c.name}</span><span style="color:#74746c"> · ${c.status}${c.role ? ' · ' + c.role : ''}</span></div>`).join('')}
    </div>` : '';

  const emptyHtml = (!alerts.length && !agenda.length && !pipeline.length)
    ? `<div style="text-align:center;padding:28px;color:#74746c;font-family:monospace;font-size:13px">✅ Aucune action requise — bonne journée !</div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#0b0b09">
  <div style="max-width:580px;margin:0 auto;padding:20px 12px">
    <div style="padding:18px 22px;background:#111110;border:1px solid #272724;border-radius:6px 6px 0 0;border-bottom:none">
      <div style="font-family:sans-serif;font-weight:800;font-size:19px;color:#e4e4db">Nova<span style="color:#cfe046">lem</span></div>
      <div style="font-family:monospace;font-size:10px;color:#74746c;margin-top:2px;text-transform:uppercase;letter-spacing:.1em">Récap du ${date}</div>
    </div>
    <div style="padding:22px;background:#111110;border:1px solid #272724;border-top:2px solid #cfe046;border-radius:0 0 6px 6px">
      ${alertsHtml}${agendaHtml}${pipelineHtml}${emptyHtml}
      <div style="text-align:center;margin-top:20px;padding-top:18px;border-top:1px solid #272724">
        <a href="${CRM_URL}/crm" style="display:inline-block;padding:11px 26px;background:#cfe046;color:#0a0a08;font-family:sans-serif;font-weight:700;font-size:12px;border-radius:3px;text-decoration:none">Ouvrir le CRM →</a>
      </div>
    </div>
    <div style="padding:10px 0;text-align:center;font-family:monospace;font-size:10px;color:#44443e">Novalem · Rappel automatique quotidien</div>
  </div></body></html>`;
}

module.exports = { sendEmail, buildReminderEmail };
