// api/find-phone.js — Recherche numéro via Anthropic web_search (côté serveur)
// POST /api/find-phone { company: string, city: string }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { company, city } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company requis' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ phone: null, reason: 'ANTHROPIC_API_KEY manquante' });

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': key,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Tu cherches le numéro de téléphone d'une entreprise. 
Réponds UNIQUEMENT avec un objet JSON sur une seule ligne, sans markdown :
{"phone":"0X XX XX XX XX","source":"url ou nom du site"}
Si non trouvé : {"phone":null}
Ne fournis aucun autre texte.`,
        messages: [{
          role: 'user',
          content: `Numéro de téléphone de "${company}" à ${city || 'France'}. Cherche sur leur site officiel, Pages Jaunes, ou annuaire.`
        }]
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[find-phone] API error:', resp.status, err.slice(0, 200));
      return res.status(200).json({ phone: null, reason: `API ${resp.status}` });
    }

    const data = await resp.json();

    // Trouver la réponse texte finale (après que l'outil ait été utilisé)
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const raw = textBlocks.map(b => b.text).join('').trim();

    console.log('[find-phone]', company, '→', raw.slice(0, 100));

    // Parser le JSON retourné
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const phone = parsed.phone || null;
      // Normaliser le format
      const normalized = phone
        ? phone.replace(/[\s.\-]/g, '').replace(/^(\+33|0033)/, '0')
        : null;
      return res.status(200).json({ phone: normalized, source: parsed.source || null });
    } catch {
      // Essayer d'extraire un numéro directement du texte brut
      const match = raw.match(/0[1-9](?:[\s.\-]?\d{2}){4}/);
      const phone = match ? match[0].replace(/[\s.\-]/g, '') : null;
      return res.status(200).json({ phone });
    }

  } catch (err) {
    console.error('[find-phone] fatal:', err.message);
    return res.status(200).json({ phone: null, reason: err.message });
  }
};
