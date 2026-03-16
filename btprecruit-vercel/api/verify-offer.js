// api/verify-offer.js
// Vérifie la conformité légale d'une annonce avant publication
// POST /api/verify-offer  { title, body, location, salary, cat }

const { verifyOffer } = require('./lib/france-travail.js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const post = req.body;
  if (!post?.title || !post?.body) {
    return res.status(400).json({ error: 'title et body requis' });
  }

  try {
    const result = await verifyOffer(post);
    return res.status(200).json(result);
  } catch (err) {
    // En cas d'erreur API, on fait la vérification locale
    const { localLegalCheck } = require('./lib/france-travail.js');
    const local = localLegalCheck(post);
    return res.status(200).json({ ...local, fallback: true });
  }
};
