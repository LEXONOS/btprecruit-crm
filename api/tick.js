// Le cœur qui bat : appelé par le cron Vercel toutes les 15 minutes (GET), ou par la tour
// (POST « Lancer un cycle » / « Lancer maintenant » sur un agent). Un seul passage à la fois.
'use strict';
const { cycle } = require('../lib/runtime');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return json(res, 401, { error: 'Réservé au cron' });
      return json(res, 200, await cycle({}));
    }
    if (req.method === 'POST') {
      if (process.env.HQ_KEY && req.headers['x-hq-key'] !== process.env.HQ_KEY) return json(res, 401, { error: 'Clé d\'accès requise' });
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      b = b || {};
      return json(res, 200, await cycle({ agentId: b.agent ? String(b.agent) : null, manuel: !b.agent, secondes: b.agent ? 200 : 250 }));
    }
    return json(res, 405, { error: 'Méthode non autorisée' });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
