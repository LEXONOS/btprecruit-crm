// api/find-prospects.js
// Trouve des entreprises BTP à fort potentiel de recrutement (La Bonne Boite v2)
// POST /api/find-prospects  { rome, dept, distance }

const { findBonnesBoites } = require('./_lib/france-travail.js');

const BTP_TO_ROME = {
  go:'F1201', so:'F1101', be:'F1106', vrd:'F1302', hse:'H1502', mgmt:'F1201',
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { cat, dept, lat, lon, distance = 30 } = req.body || {};

  if (!dept && (!lat || !lon)) {
    return res.status(400).json({ error: 'dept ou lat+lon requis' });
  }

  const rome = BTP_TO_ROME[cat] || 'F1201';

  try {
    const result = await findBonnesBoites({
      rome,
      commune: dept ? { dept } : { lat, lon },
      distance,
      nbResultats: 25
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
