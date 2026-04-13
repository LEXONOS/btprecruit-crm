// api/send-email.js — NOVALEM
// Envoi via Resend avec support HTML enrichi
// Supporte : [Texte](url) pour les boutons CTA dans le corps

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { to, cc, bcc, subject, body, from_name, attachments } = req.body || {};

  if (!to)      return res.status(400).json({ error: 'Destinataire (to) manquant' });
  if (!subject) return res.status(400).json({ error: 'Objet (subject) manquant' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY manquante dans Vercel' });

  const senderEmail = process.env.SENDER_EMAIL || 'contact@novalem-recrutement.fr';
  const senderName  = from_name || process.env.SENDER_NAME || 'Louis RENAULT — NOVALEM';

  // Normaliser les destinataires
  const toArr  = Array.isArray(to)  ? to  : to.split(',').map(s => s.trim()).filter(Boolean);
  const ccArr  = cc  ? (Array.isArray(cc)  ? cc  : cc.split(',').map(s=>s.trim()).filter(Boolean))  : [];
  const bccArr = bcc ? (Array.isArray(bcc) ? bcc : bcc.split(',').map(s=>s.trim()).filter(Boolean)) : [];

  // Convertir le corps texte en HTML soigné
  const html = buildHtml(body || '', subject);

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${senderName} <${senderEmail}>`,
        to:      toArr,
        ...(ccArr.length  ? { cc: ccArr   } : {}),
        ...(bccArr.length ? { bcc: bccArr } : {}),
        subject,
        text: body || '',
        html,
        ...(attachments?.length ? {
          attachments: attachments.map(a => ({
            filename: a.filename,
            content:  a.content,
            type:     a.type || 'application/pdf',
          }))
        } : {}),
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('[send-email] Resend error:', data);
      return res.status(resp.status).json({
        error: data.message || data.error || 'Erreur Resend',
        details: data,
        hint: resp.status === 403
          ? 'Le domaine novalem-recrutement.fr doit être vérifié dans Resend → Domains'
          : null,
      });
    }

    return res.status(200).json({ sent: true, id: data.id, to: toArr });

  } catch (err) {
    console.error('[send-email] Fatal:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ── Constructeur HTML email ─────────────────────────────────────
function buildHtml(text, subject) {
  // Echapper le HTML de base
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Markdown simplifié :
  // [Texte ->(url) → bouton CTA doré
  html = html.replace(
    /\[([^\]]+)-&gt;\(([^)]+)\)/g,
    (_, label, url) => `</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${url}" style="
          display:inline-block;
          background:#C9891A;
          color:#ffffff;
          font-family:Arial,sans-serif;
          font-size:15px;
          font-weight:700;
          text-decoration:none;
          padding:14px 32px;
          border-radius:6px;
          letter-spacing:.3px;
        ">${label} →</a>
      </div>
      <p style="margin:0">`
  );

  // **gras**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Séparateur ---
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #eee;margin:20px 0">');

  // ▸ ou > en début de ligne → puce stylisée
  html = html.replace(/^[▸>]\s+(.+)$/gm,
    '<div style="padding:3px 0 3px 14px;border-left:3px solid #C9891A;margin:4px 0;color:#333">$1</div>'
  );

  // Paragraphes (sauts de ligne doubles)
  const blocks = html.split(/\n\n+/);
  html = blocks.map(b => {
    const trimmed = b.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<div') || trimmed.startsWith('<hr') || trimmed.startsWith('</p>')) return trimmed;
    return `<p style="margin:0 0 12px 0;line-height:1.7">${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,Helvetica,sans-serif;color:#1A1614">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07)">
    <!-- Header doré -->
    <div style="background:#1A1614;padding:20px 32px;display:flex;align-items:center;gap:12px">
      <div>
        <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px">NOVA<span style="color:#C9891A">LEM</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,.5);letter-spacing:2px;text-transform:uppercase;margin-top:2px">Recrutement BTP · CDI</div>
      </div>
    </div>
    <!-- Corps -->
    <div style="padding:28px 32px;font-size:14px;line-height:1.7;color:#2a2a2a">
      ${html}
    </div>
    <!-- Footer -->
    <div style="background:#F8F5EF;padding:16px 32px;border-top:1px solid #E8E4DC;font-size:11px;color:#888;line-height:1.7">
      <strong style="color:#C9891A">NOVALEM</strong> — Cabinet de recrutement BTP<br>
      contact@novalem-recrutement.fr · 06 58 21 20 96<br>
      <a href="https://novalem-recrutement.fr" style="color:#C9891A">novalem-recrutement.fr</a>
    </div>
  </div>
</body>
</html>`;
}
