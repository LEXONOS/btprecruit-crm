// La porte de la tour : état (faut-il créer le mot de passe ?), connexion, déconnexion, création ou oubli du mot de passe
// (avec un jeton Vercel), changement, déconnexion de tous les appareils, liste des appareils connus.
'use strict';
const A = require('../lib/acces');

function corps(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);
      const op = q.op || 'etat';
      if (op === 'etat') return A.repondre(res, 200, await A.etat(req));
      if (op === 'appareils') { const s = await A.exiger(req, res); if (!s) return; return A.repondre(res, 200, await A.appareils(s)); }
      return A.repondre(res, 400, { erreur: 'Opération inconnue' });
    }
    if (req.method === 'POST') {
      if (!A.memeOrigine(req)) return A.repondre(res, 403, { erreur: 'À faire depuis la page de la tour.' });
      const b = corps(req);
      if (b.op === 'connexion') return A.connexion(req, res, b);
      if (b.op === 'deconnexion') return A.deconnexion(req, res);
      if (b.op === 'creer') return A.creer(req, res, b);
      if (b.op === 'changer') return A.changer(req, res, b);
      if (b.op === 'partout') return A.partout(req, res);
      return A.repondre(res, 400, { erreur: 'Opération inconnue' });
    }
    return A.repondre(res, 405, { erreur: 'Méthode non autorisée' });
  } catch (e) {
    console.error('acces', e && e.message);
    return A.repondre(res, 500, { erreur: 'La porte de la tour a un souci : réessaie dans un instant.' });
  }
};
