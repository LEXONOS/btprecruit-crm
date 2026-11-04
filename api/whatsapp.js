// WhatsApp en express : toutes les 5 minutes, relève les messages reçus, fait répondre Emma s'il y a du nouveau et
// envoie ses réponses. Ne fait rien tant que WhatsApp n'est pas branché (HQ_WHATSAPP_KEY, HQ_WHATSAPP_NUMERO).
'use strict';
const W = require('../lib/whatsapp');
const { open } = require('../lib/db');
const A = require('../lib/acces');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function (req, res) {
  const t0 = Date.now();
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Méthode non autorisée' });
    if (!A.cronAutorise(req)) return json(res, 401, { error: 'Réservé au cron' });
    if (!W.branche()) return json(res, 200, { ok: true, whatsapp: false });
    const db = open();
    if (!db) return json(res, 200, { ok: true, demo: true });
    const r = await require('../lib/jobs/whatsapp').releve({ db: db });
    let emma = null;
    // Emma passe seulement pour des messages qu'elle n'a pas encore vus : arrivés depuis son dernier passage express réussi
    // (un message qu'elle a choisi de laisser sans réponse ne la relance jamais ; occupée ailleurs, on réessaie au suivant)
    const vu = await db.one('hq_config', { eq: { key: 'whatsapp:emma' } }).catch(function () { return null; });
    const depuis = (vu && vu.value && vu.value.jusqu_a) || '1970-01-01T00:00:00.000Z';
    const neufs = await db.select('hq_inbox', { select: 'id,received_at', eq: { status: 'nouveau', kind: 'reponse', subject: 'WhatsApp' }, gt: { received_at: depuis }, order: 'received_at.desc', limit: 1 }).catch(function () { return []; });
    if (neufs.length) {
      emma = await require('../lib/runtime').cycle({ db: db, agentId: 'reponses', secondes: 150, verrou: 'cycle:whatsapp' });
      if (emma && (emma.passages || []).some(function (p) { return p.id === 'reponses'; })) await db.upsert('hq_config', { key: 'whatsapp:emma', value: { jusqu_a: neufs[0].received_at }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    // une réponse attend son heure (une minute et demie à trois minutes après le message) si la fonction a le temps
    // (240 s au plus), sinon elle part au passage suivant
    const envoi = await require('../lib/jobs/envoi').run({ db: db, budget: {}, limite: Math.min(Date.now() + 90000, t0 + 228000), conversation: true });
    return json(res, 200, { ok: true, releve: r.resume, emma: emma && emma.passages ? emma.passages.map(function (p) { return p.resume; }) : null, envoi: envoi.resume });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
