// Le panneau des aperçus parle ici : retouches et images du prospect, signal d'intérêt, commande (490 € ou 45 € par
// mois). Les aperçus vivent sur un autre domaine (le projet des sites) : la porte est ouverte à tous les domaines
// (CORS), sans cookie ; c'est la clé de chaque aperçu (HMAC du slug, lib/sites/retours.js) qui décide de tout.
// POST { site, cle, action: image | retouches | vu | commande | rappel, ... } → { ok, ... } ou { erreur }
'use strict';

function corps(req) {
  let b = req.body;
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}
function repondre(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(obj === null ? '' : JSON.stringify(obj));
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      res.setHeader('Access-Control-Max-Age', '86400');
      return repondre(res, 204, null);
    }
    if (req.method !== 'POST') return repondre(res, 405, { erreur: 'méthode non autorisée' });
    const db = require('../lib/db').open();
    if (!db) return repondre(res, 503, { erreur: 'service indisponible, réessayez dans un instant' });
    const r = await require('../lib/sites/retours').traiter(db, corps(req));
    return repondre(res, r.code, r.corps);
  } catch (e) {
    console.error('apercu', e && e.message);
    return repondre(res, 500, { erreur: 'un souci de notre côté : réessayez dans un instant' });
  }
};
