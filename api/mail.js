// api/mail.js — NOVALEM APP
// Envoi de mails via Resend, avec option attach_fiche pour joindre
// automatiquement la fiche de presentation (/docs/novalem-presentation.pdf).
// Variables Vercel requises : RESEND_API_KEY, SENDER_EMAIL, SENDER_NAME (optionnel)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { to, subject, body, attach_fiche, attachments } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Destinataire manquant' });
  if (!subject) return res.status(400).json({ error: 'Objet manquant' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY manquante dans Vercel' });

  const senderEmail = process.env.SENDER_EMAIL || 'contact@novalem-recrutement.fr';
  const senderName = process.env.SENDER_NAME || 'Louis RENAULT - NOVALEM';

  const pieces = Array.isArray(attachments) ? attachments.slice() : [];
  if (attach_fiche) {
    try {
      const url = 'https://' + req.headers.host + '/docs/novalem-presentation.pdf';
      const fr = await fetch(url);
      if (fr.ok) {
        const buf = Buffer.from(await fr.arrayBuffer());
        pieces.push({ filename: 'NOVALEM-presentation.pdf', content: buf.toString('base64'), type: 'application/pdf' });
      }
    } catch (e) { console.error('fiche introuvable:', e.message); }
  }

  // Corps HTML sobre (meilleure delivrabilite en prospection)
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#26221A;line-height:1.6;max-width:620px">' +
    String(body || '').split('\n').map(function (l) { return l.trim() === '' ? '<br>' : '<p style="margin:0 0 2px">' + l.replace(/</g, '&lt;') + '</p>'; }).join('') +
    '</div>';

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: senderName + ' <' + senderEmail + '>',
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        text: body || '',
        html: html,
        ...(pieces.length ? { attachments: pieces } : {})
      })
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: (data && data.message) || 'Erreur Resend', details: data });
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error('api/mail:', err);
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message });
  }
};
