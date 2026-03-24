// api/test-email.js — endpoint de diagnostic
module.exports = async function handler(req, res) {
  const key    = process.env.RESEND_API_KEY;
  const sender = process.env.SENDER_EMAIL || 'contact@novalem-recrutement.fr';
  const dest   = process.env.CRM_USER_EMAIL || 'non configuré';

  if (!key) {
    return res.status(200).json({
      ok: false,
      problem: 'RESEND_API_KEY manquante dans Vercel → Environment Variables',
    });
  }

  // Test envoi réel vers toi-même
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    `Novalem CRM <${sender}>`,
        to:      [dest],
        subject: '✅ Test email Novalem CRM',
        text:    'Si tu reçois cet email, tout fonctionne correctement !'
      })
    });
    const data = await resp.json();
    return res.status(200).json({
      ok: resp.ok,
      status: resp.status,
      resend_response: data,
      config: { sender, dest, key_prefix: key.slice(0,8)+'...' }
    });
  } catch(e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
};
