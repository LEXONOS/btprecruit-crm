// La porte de l'usine : la seule entrée de la tour ouverte sans session. Elle n'accepte que l'usine (GitHub Actions),
// qui présente le secret partagé posé par la tour (HQ_USINE_SECRET), et elle ne fait que trois choses : donner la
// commande d'une vidéo, donner les liens d'envoi de ses fichiers, recevoir son compte rendu. Deux usines : le Studio 3D
// (commande, televerser, fini) et le montage du studio des créatrices (montage, montage_televerser, montage_fini).
'use strict';
const crypto = require('crypto');
const F = require('../lib/studio/fabrication');
const FC = require('../lib/createurs/fabrication');
const { open } = require('../lib/db');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function bonSecret(req) {
  const attendu = String(process.env.HQ_USINE_SECRET || '').trim();
  const recu = String(req.headers['x-usine'] || '');
  if (attendu.length < 32 || recu.length !== attendu.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}
const okId = (x) => /^\d{1,12}$/.test(String(x || ''));
const okLangue = (x) => /^[a-z]{2}$/.test(String(x || ''));

module.exports = async function (req, res) {
  try {
    if (!String(process.env.HQ_USINE_SECRET || '').trim()) return json(res, 503, { erreur: 'usine non branchée' });
    if (!bonSecret(req)) return json(res, 401, { erreur: 'refusé' });
    const db = open();
    if (!db) return json(res, 503, { erreur: 'base non branchée' });
    if (req.method === 'GET') {
      const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);
      if (['commande', 'montage'].indexOf(q.op) < 0 || !okId(q.video) || !okLangue(q.langue)) return json(res, 400, { erreur: 'demande invalide' });
      const c = q.op === 'montage' ? await FC.commande(db, Number(q.video), q.langue) : await F.commande(db, Number(q.video), q.langue);
      return json(res, c.code, c);
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      b = b || {};
      if (!okId(b.video) || !okLangue(b.langue) || typeof b.jeton !== 'string') return json(res, 400, { erreur: 'demande invalide' });
      if (b.op === 'televerser') { const r = await F.liensEnvoi(db, Number(b.video), b.langue, b.jeton, b.fichiers); return json(res, r.code, r); }
      if (b.op === 'fini') { const r = await F.fin(db, Number(b.video), b.langue, b.jeton, b); return json(res, r.code, r); }
      if (b.op === 'montage_televerser') { const r = await FC.liensEnvoi(db, Number(b.video), b.langue, b.jeton, b.fichiers); return json(res, r.code, r); }
      if (b.op === 'montage_fini') { const r = await FC.fin(db, Number(b.video), b.langue, b.jeton, b); return json(res, r.code, r); }
      return json(res, 400, { erreur: 'opération inconnue' });
    }
    return json(res, 405, { erreur: 'méthode non autorisée' });
  } catch (e) {
    return json(res, 500, { erreur: String(e.message || e).slice(0, 300) });
  }
};
