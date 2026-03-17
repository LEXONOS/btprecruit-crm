// api/send-email.js
// Envoie un email via le compte Zimbra OVH (SMTP)
// Variables Vercel : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS

const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { to, subject, body } = req.body || {};
  if (!to)      return res.status(400).json({ error: 'Destinataire manquant' });
  if (!subject) return res.status(400).json({ error: 'Objet manquant' });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(500).json({
      error: 'SMTP non configuré. Ajoutez SMTP_HOST, SMTP_USER, SMTP_PASS dans Vercel → Environment Variables.'
    });
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;max-width:600px;margin:0 auto;padding:32px 24px}hr{border:none;border-top:1px solid #eee;margin:20px 0}.footer{font-size:11px;color:#999;margin-top:24px}</style>
</head><body>
${(body||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>').replace(/─+/g,'<hr>')}
<div class="footer">Email envoyé via Novalem CRM</div>
</body></html>`;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false }
    });

    const info = await transporter.sendMail({
      from: `"Novalem Recrutement" <${smtpUser}>`,
      to, subject,
      text: body || '',
      html,
    });

    return res.status(200).json({ sent: true, messageId: info.messageId, from: smtpUser, to });

  } catch (err) {
    console.error('SMTP error:', err.message);
    return res.status(500).json({ error: err.message, hint: 'Vérifiez SMTP_HOST, SMTP_USER, SMTP_PASS dans Vercel' });
  }
};
