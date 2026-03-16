// api/post-job.js
// Serverless function Vercel — publie une annonce sur les job boards
// Variables d'environnement requises selon les boards :
//   FRANCE_TRAVAIL_CLIENT_ID     — depuis espacepartenaires.pole-emploi.fr
//   FRANCE_TRAVAIL_CLIENT_SECRET
//   INDEED_API_KEY               — depuis indeed.com/hire (si disponible)

import { postToFranceTravail } from './lib/france-travail.js';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { board, post } = req.body || {};

  if (!board || !post) {
    return res.status(400).json({ error: 'board et post sont requis' });
  }

  if (!post.title || !post.body) {
    return res.status(400).json({ error: 'post.title et post.body sont requis' });
  }

  try {
    let result;

    switch (board) {
      case 'France Travail':
        result = await postToFranceTravail(post);
        break;

      // Indeed : API fermée sauf partenaires agréés — lien manuel uniquement
      case 'Indeed':
        return res.status(200).json({
          success: false,
          manual: true,
          url: `https://employers.indeed.com/p/post-job?jobTitle=${encodeURIComponent(post.title)}&location=${encodeURIComponent(post.location || '')}`,
          message: "Indeed nécessite une publication manuelle — lien pré-rempli fourni"
        });

      // LinkedIn : API Recruiter fermée sans contrat — lien manuel
      case 'LinkedIn Jobs':
        return res.status(200).json({
          success: false,
          manual: true,
          url: `https://www.linkedin.com/talent/post-a-job?title=${encodeURIComponent(post.title)}&location=${encodeURIComponent(post.location || '')}`,
          message: "LinkedIn Jobs nécessite une publication manuelle — lien pré-rempli fourni"
        });

      default:
        return res.status(400).json({
          error: `Board "${board}" non supporté pour la publication automatique`
        });
    }

    return res.status(200).json({ success: true, ...result });

  } catch (err) {
    console.error(`[post-job] Erreur board ${board}:`, err.message);
    return res.status(500).json({
      error: err.message || 'Erreur interne',
      board
    });
  }
}
