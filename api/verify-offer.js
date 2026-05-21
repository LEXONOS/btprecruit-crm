// api/verify-offer.js
// Vérifie la conformité légale d'une annonce avant publication
// POST /api/verify-offer  { title, body, location, salary, cat }

const { verifyOffer, localLegalCheck } = require('./_lib/france-travail.js');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
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
    // En cas d'erreur API (JCMO bêta indispo, credentials manquants…) → check local
    const local = localLegalCheck(post);
    return res.status(200).json({ ...local, fallback: true, fallbackReason: err.message });
  }
};
