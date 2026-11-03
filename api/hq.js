// API de la tour : lecture du monde et des fiches (GET), actions de Louis (POST).
// Protégée par la protection Vercel du projet ; HQ_KEY (optionnelle) ajoute une clé à envoyer dans x-hq-key.
'use strict';
const { monde, ficheAgent, ficheEntreprise, liste } = require('../lib/world');
const { agir } = require('../lib/actions');
const mail = require('../lib/mail');
const { SUPABASE_URL, SUPABASE_KEY } = require('../lib/config');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function memeOrigine(req) {
  const o = req.headers.origin || req.headers.referer || '';
  if (!o) return true;
  try { const h = new URL(o).host; return h === req.headers.host || h.startsWith('localhost') || h.startsWith('127.0.0.1'); } catch (e) { return false; }
}

module.exports = async function (req, res) {
  if (process.env.HQ_KEY && req.headers['x-hq-key'] !== process.env.HQ_KEY) return json(res, 401, { error: 'Clé d\'accès requise' });
  try {
    if (req.method === 'GET') {
      const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      const op = q.op || 'world';
      if (op === 'world') return json(res, 200, await monde(q.since ? Number(q.since) : null));
      if (op === 'agent') { const f = await ficheAgent(String(q.id || '')); return f ? json(res, 200, f) : json(res, 404, { error: 'Agent introuvable' }); }
      if (op === 'company') { const f = await ficheEntreprise(String(q.id || '')); return f ? json(res, 200, f) : json(res, 404, { error: 'Entreprise introuvable' }); }
      if (['leads', 'outbox', 'livrables', 'runs', 'inbox'].indexOf(op) >= 0) return json(res, 200, await liste(op, q));
      if (op === 'boite') return json(res, 200, await agir('boite_etat', {}));
      if (op === 'etat') return json(res, 200, { base: !!SUPABASE_KEY, projet: SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0], anthropic: !!process.env.ANTHROPIC_API_KEY, google: !!process.env.GOOGLE_MAPS_API_KEY, envoi: mail.branchee(), boite: mail.identite().adresse || null });
      return json(res, 400, { error: 'Opération inconnue' });
    }
    if (req.method === 'POST') {
      if (!memeOrigine(req)) return json(res, 403, { error: 'Origine refusée' });
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      b = b || {};
      return json(res, 200, await agir(String(b.op || ''), b));
    }
    return json(res, 405, { error: 'Méthode non autorisée' });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
