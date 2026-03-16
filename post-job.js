// api/post-job.js
const { postToFranceTravail } = require('./france-travail.js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { board, post } = req.body || {};
  if (!board || !post) return res.status(400).json({ error: 'board et post requis' });
  if (!post.title || !post.body) return res.status(400).json({ error: 'post.title et post.body requis' });

  try {
    let result;
    if (board === 'France Travail') {
      result = await postToFranceTravail(post);
      return res.status(200).json({ success: true, ...result });
    }
    if (board === 'Indeed') {
      return res.status(200).json({ success: false, manual: true, url: `https://employers.indeed.com/p/post-job?jobTitle=${encodeURIComponent(post.title)}&location=${encodeURIComponent(post.location||'')}` });
    }
    if (board === 'LinkedIn Jobs') {
      return res.status(200).json({ success: false, manual: true, url: `https://www.linkedin.com/talent/post-a-job?title=${encodeURIComponent(post.title)}&location=${encodeURIComponent(post.location||'')}` });
    }
    return res.status(400).json({ error: `Board "${board}" non supporté` });
  } catch (err) {
    return res.status(500).json({ error: err.message, board });
  }
};

