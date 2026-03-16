// api/health.js
module.exports = function handler(req, res) {
  const hasFT = !!(process.env.FRANCE_TRAVAIL_CLIENT_ID && process.env.FRANCE_TRAVAIL_CLIENT_SECRET);
  res.status(200).json({
    status: 'ok', version: '1.0.0', timestamp: new Date().toISOString(),
    boards: {
      'France Travail': hasFT ? 'configured' : 'missing_credentials',
      'Indeed': 'manual_only', 'LinkedIn Jobs': 'manual_only',
    }
  });
};
