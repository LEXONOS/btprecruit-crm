// api/send-email.js — Envoi via Resend REST API
// Variable requise : RESEND_API_KEY (déjà configurée dans Vercel)
// L'expéditeur doit être sur un domaine vérifié dans Resend

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { to, subject, body, from_name } = req.body || {};

  if (!to)      return res.status(400).json({ error: 'Destinataire (to) manquant' });
  if (!subject) return res.status(400).json({ error: 'Objet (subject) manquant' });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: 'RESEND_API_KEY manquante dans Vercel → Settings → Environment Variables'
    });
  }

  // Expéditeur : utiliser le domaine vérifié
  const senderEmail = process.env.SENDER_EMAIL || 'contact@novalem-recrutement.fr';
  const senderName  = from_name || process.env.SENDER_NAME || 'Novalem Recrutement';

  // Convertir texte → HTML propre
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #222; max-width: 600px; margin: 0 auto; padding: 32px 20px; }
  hr   { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
  .sig { margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
</style></head>
<body>${
  (body || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>')
    .replace(/─{3,}/g,'<hr>')
}</body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from:    `${senderName} <${senderEmail}>`,
        to:      [to],
        subject,
        text:    body || '',
        html
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Resend error:', data);
      return res.status(resp.status).json({
        error: data.message || data.error || 'Erreur Resend',
        details: data,
        hint: resp.status === 403
          ? 'Le domaine novalem-recrutement.fr doit être vérifié dans Resend → Domains'
          : null
      });
    }

    return res.status(200).json({
      sent: true,
      id:   data.id,
      from: `${senderName} <${senderEmail}>`,
      to
    });

  } catch (err) {
    console.error('send-email fatal:', err);
    return res.status(500).json({ error: err.message });
  }
};
