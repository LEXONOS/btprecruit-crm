// api/find-phone.js — Recherche numéro de téléphone via scraping Google
// POST /api/find-phone { company: string, city: string }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { company, city } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company requis' });

  try {
    const q = encodeURIComponent(`"${company}" ${city||'Nice'} téléphone contact`);
    const url = `https://www.google.com/search?q=${q}&num=3&hl=fr`;

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html',
      }
    });

    if (!resp.ok) return res.status(200).json({ phone: null });

    const html = await resp.text();

    // Extraire tous les numéros de téléphone français
    const patterns = [
      /(?:Tél\.?\s*:?\s*)(\+33\s?[1-9](?:[\s.]?\d{2}){4})/gi,
      /(?:Tél\.?\s*:?\s*)(0[1-9](?:[\s.\-]?\d{2}){4})/gi,
      /(\+33\s?[1-9](?:[\s.]?\d{2}){4})/g,
      /(0[1-9](?:[\s.\-]\d{2}){4})/g,
      /(04[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2})/g, // PACA
      /(06[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2})/g,
    ];

    const found = new Set();
    for (const pat of patterns) {
      const matches = html.matchAll(pat);
      for (const m of matches) {
        const num = (m[1] || m[0]).replace(/[\s.\-]/g, '');
        if (num.length === 10 || (num.startsWith('+33') && num.length === 12)) {
          found.add(num);
        }
      }
    }

    const phones = [...found];
    // Préférer les numéros fixes (04 pour PACA) sur les mobiles
    const fixed = phones.find(p => p.startsWith('04'));
    const mobile = phones.find(p => p.startsWith('06') || p.startsWith('07'));
    const phone = fixed || mobile || phones[0] || null;

    return res.status(200).json({ phone, all: phones.slice(0, 5) });

  } catch (err) {
    console.error('[find-phone]', err.message);
    return res.status(200).json({ phone: null });
  }
};
