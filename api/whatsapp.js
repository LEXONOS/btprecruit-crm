// WhatsApp en express : toutes les 5 minutes, relève les messages reçus, fait répondre Emma s'il y a du nouveau et
// envoie ses réponses. Ne fait rien tant que WhatsApp n'est pas branché (HQ_WHATSAPP_KEY, HQ_WHATSAPP_NUMERO).
'use strict';
const W = require('../lib/whatsapp');
const { open } = require('../lib/db');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function (req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Méthode non autorisée' });
    if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return json(res, 401, { error: 'Réservé au cron' });
    if (!W.branche()) return json(res, 200, { ok: true, whatsapp: false });
    const db = open();
    if (!db) return json(res, 200, { ok: true, demo: true });
    const r = await require('../lib/jobs/whatsapp').releve({ db: db });
    let emma = null;
    if (r.nouveaux) emma = await require('../lib/runtime').cycle({ db: db, agentId: 'reponses', secondes: 150 });
    const envoi = await require('../lib/jobs/envoi').run({ db: db, budget: {}, limite: Date.now() + 50000, conversation: true });
    return json(res, 200, { ok: true, releve: r.resume, emma: emma && emma.passages ? emma.passages.map(function (p) { return p.resume; }) : null, envoi: envoi.resume });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
