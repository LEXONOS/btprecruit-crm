// api/ai.js — Proxy Anthropic API (Claude Haiku)
// Variable requise : ANTHROPIC_API_KEY dans Vercel env vars

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante dans les variables Vercel' });
  }

  const { messages, system, model, max_tokens } = req.body || {};
  if (!messages || !messages.length) {
    return res.status(400).json({ error: 'messages requis' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001', // Haiku = moins cher
        max_tokens: max_tokens || 1000,
        system: system || 'Tu es un assistant CRM de recrutement specialise BTP.',
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erreur Anthropic', details: data });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('api/ai error:', err);
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message });
  }
};
