// Le cœur qui bat : appelé par le cron Vercel toutes les 15 minutes (GET, avec le secret du cron), ou par Louis depuis
// la tour (POST « Lancer un cycle » / « Lancer maintenant » sur un agent, avec sa session). Un seul passage à la fois.
'use strict';
const { cycle } = require('../lib/runtime');
const A = require('../lib/acces');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      if (!A.cronAutorise(req)) return json(res, 401, { error: 'Réservé au cron' });
      return json(res, 200, await cycle({}));
    }
    if (req.method === 'POST') {
      if (!A.memeOrigine(req)) return json(res, 403, { error: 'Origine refusée' });
      const s = await A.exiger(req, res);
      if (!s) return;
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
