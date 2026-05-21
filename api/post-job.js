// api/post-job.js
// Publie une annonce sur un job board externe.
// Aujourd'hui : France Travail (via API officielle). Autres boards : non auto-publiables.
// POST /api/post-job  { board:'France Travail', post:{title,location,salary,body,cat} }

const { postToFranceTravail, verifyOffer, localLegalCheck } = require('./_lib/france-travail.js');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { board, post, skipJcmo } = req.body || {};
  if (!board) return res.status(400).json({ error: 'board requis' });
  if (!post?.title || !post?.body) {
    return res.status(400).json({ error: 'post.title et post.body requis' });
  }

  // ── Seul France Travail est auto-publiable pour l'instant ─────────
  if (board !== 'France Travail') {
    return res.status(400).json({
      error: `Publication automatique non disponible pour "${board}". Utilisez le lien direct.`
    });
  }

  // ── Vérification credentials avant tout ───────────────────────────
  if (!process.env.FRANCE_TRAVAIL_CLIENT_ID || !process.env.FRANCE_TRAVAIL_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'FRANCE_TRAVAIL_CLIENT_ID / SECRET manquants dans Vercel → Environment Variables'
    });
  }

  try {
    // ── 1) Vérification JCMO (sauf si explicitement skippée) ─────────
    if (!skipJcmo) {
      let jcmo;
      try {
        jcmo = await verifyOffer(post);
      } catch (e) {
        // Fallback local si JCMO indispo
        jcmo = localLegalCheck(post);
      }
      const blockingIssues = (jcmo.issues || []).filter(i => i.startsWith('⚠'));
      if (blockingIssues.length > 0) {
        return res.status(422).json({
          error: 'Annonce non conforme — corrigez avant publication',
          issues: jcmo.issues,
          source: jcmo.source
        });
      }
    }

    // ── 2) Publication officielle ────────────────────────────────────
    const result = await postToFranceTravail(post);
    return res.status(200).json({
      reference: result.reference,
      url: result.url,
      message: result.message,
      board: 'France Travail',
      publishedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('post-job error:', err);
    return res.status(500).json({ error: err.message || 'Erreur publication France Travail' });
  }
};
