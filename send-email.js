// api/send-email.js
// Envoie un email via Resend depuis contact@novalem-recrutement.fr
// Variable requise : RESEND_API_KEY (déjà configurée dans Vercel)

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { to, subject, body } = req.body || {};
  if (!to)      return res.status(400).json({ error: 'Destinataire manquant' });
  if (!subject) return res.status(400).json({ error: 'Objet manquant' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY manquante dans Vercel → Environment Variables' });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.75; color: #222; max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
  .footer { font-size: 11px; color: #aaa; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; }
</style>
</head><body>
${(body || '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/\n/g,'<br>')
  .replace(/─+/g,'<hr>')}
<div class="footer">Novalem — Cabinet de recrutement<br>contact@novalem-recrutement.fr</div>
</body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Novalem Recrutement <contact@novalem-recrutement.fr>',
        to: [to],
        subject,
        text: body || '',
        html,
      })
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(500).json({ error: data.message || 'Erreur Resend', detail: data });
    }

    return res.status(200).json({ sent: true, id: data.id, from: 'contact@novalem-recrutement.fr', to });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
