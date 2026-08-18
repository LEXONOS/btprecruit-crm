// api/facture.js — lecture d'une facture PDF (Indy)
// Recoit { pdf_base64 } et renvoie le montant lu, sans rien deviner.
// Variable Vercel requise : ANTHROPIC_API_KEY (la meme que le reste).

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

async function anthropic(payload) {
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Anthropic: ' + ((data.error && data.error.message) || r.status));
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function parseJSONLoose(text) {
  let t = (text || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start > 0 || end < t.length - 1) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante dans les variables Vercel du projet.' });
    }
    const b64 = (req.body || {}).pdf_base64;
    if (!b64) return res.status(400).json({ error: 'pdf_base64 requis' });

    const raw = await anthropic({
      model: MODEL,
      max_tokens: 400,
      system:
        'Tu lis une facture PDF emise via Indy par Studio Novalem (createur de sites en Guadeloupe). ' +
        'Tu extrais UNIQUEMENT ce qui est ecrit sur la facture, sans rien deviner. Tu reponds en JSON strict, sans markdown.',
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          {
            type: 'text',
            text:
              'Extrais de cette facture, exactement cet objet JSON :\n' +
              '{"montant": nombre, "numero": "", "date": "AAAA-MM-JJ", "client": ""}\n' +
              '- "montant" = le TOTAL a payer par le client (TTC), en euros, avec un point decimal, sans symbole ni espace. ' +
              'Si le total n\'est pas lisible avec certitude, mets null.\n' +
              '- "numero" = numero de la facture (vide si absent).\n' +
              '- "date" = date de la facture au format AAAA-MM-JJ (vide si absente).\n' +
              '- "client" = nom du client facture (vide si absent).\n' +
              'Ne devine jamais : en cas de doute, laisse vide ou null.',
          },
        ],
      }],
    });

    const out = parseJSONLoose(raw);
    return res.status(200).json({
      montant: (out.montant != null && out.montant !== '' ? Number(out.montant) : null),
      numero: out.numero || '',
      date: out.date || '',
      client: out.client || '',
    });
  } catch (err) {
    console.error('api/facture:', err);
    return res.status(500).json({ error: err.message });
  }
};
