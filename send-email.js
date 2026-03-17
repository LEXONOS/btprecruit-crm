// api/send-email.js
// Envoie un email depuis le CRM via Resend
// POST /api/send-email { to, subject, body }

const { sendEmail } = require('./lib/email.js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { to, subject, body } = req.body || {};

  if (!to) return res.status(400).json({ error: 'Destinataire manquant' });
  if (!subject) return res.status(400).json({ error: 'Objet manquant' });

  const userEmail = process.env.CRM_USER_EMAIL;
  if (!userEmail) return res.status(500).json({ error: 'CRM_USER_EMAIL non configuré' });

  // Convertir le texte brut en HTML simple
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:'Courier New',monospace;background:#fff;color:#111;padding:32px;max-width:600px;margin:0 auto;line-height:1.7;font-size:13px">
    ${(body||'').replace(/\n/g,'<br>').replace(/━+/g,'<hr style="border:none;border-top:1px solid #ddd;margin:12px 0">')}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <div style="font-size:11px;color:#999">Envoyé depuis BTPRecruit CRM</div>
  </body></html>`;

  try {
    const result = await sendEmail({ to, subject, html });
    return res.status(200).json({ sent: true, id: result.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
