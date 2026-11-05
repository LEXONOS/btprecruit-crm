// API de la tour : lecture du monde et des fiches (GET), actions de Louis (POST).
// Fermée à clé : chaque requête porte la session de Louis (cookie signé, voir lib/acces.js) ; un POST ne vient que de
// la page de la tour elle-même (même origine, JSON).
'use strict';
const { monde, ficheAgent, ficheEntreprise, liste } = require('../lib/world');
const { agir } = require('../lib/actions');
const A = require('../lib/acces');
const mail = require('../lib/mail');
const { SUPABASE_URL, SUPABASE_KEY } = require('../lib/config');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'POST' && !A.memeOrigine(req)) return json(res, 403, { error: 'Origine refusée', erreur: 'à faire depuis la page de la tour' });
    const s = await A.exiger(req, res);
    if (!s) return;
    if (req.method === 'GET') {
      const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);
      const op = q.op || 'world';
      if (op === 'world') return json(res, 200, await monde(q.since ? Number(q.since) : null));
      if (op === 'agent') { const f = await ficheAgent(String(q.id || '')); return f ? json(res, 200, f) : json(res, 404, { error: 'Agent introuvable' }); }
      if (op === 'company') { const f = await ficheEntreprise(String(q.id || '')); return f ? json(res, 200, f) : json(res, 404, { error: 'Entreprise introuvable' }); }
      if (['leads', 'outbox', 'livrables', 'runs', 'inbox', 'sites'].indexOf(op) >= 0) return json(res, 200, await liste(op, q));
      if (op === 'identite') return json(res, 200, await agir('identite_lire', {}));
      if (op === 'boite') return json(res, 200, await agir('boite_etat', {}));
      if (op === 'ecriture') { const db = require('../lib/db').open(); return json(res, 200, db ? await require('../lib/ecriture').tableau(db) : { demo: true, variantes: [] }); }
      if (op === 'phase_sites') { const db = require('../lib/db').open(); return json(res, 200, db ? await require('../lib/sites/phase').tableau(db) : { demo: true, phase: 'envoi', sites: [] }); }
      if (op === 'missions') return json(res, 200, await require('../lib/missions').etat(require('../lib/db').open()));
      if (op === 'studio') { const db = require('../lib/db').open(); return json(res, 200, db ? await require('../lib/studio/vue').liste(db, q) : { demo: true, videos: [], comptes: {}, lignes: require('../lib/studio').LIGNES, statuts: require('../lib/studio').STATUTS, usine: { branchee: false } }); }
      if (op === 'etat') return json(res, 200, { base: !!SUPABASE_KEY, projet: SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0], anthropic: !!process.env.ANTHROPIC_API_KEY, google: !!process.env.GOOGLE_MAPS_API_KEY, pexels: require('../lib/sites/images').branche(), envoi: mail.branchee(), boite: mail.identite().adresse || null, vercel: require('../lib/sites/vercel').branche(), stripe: require('../lib/sites/stripe').branche(), stripe_test: require('../lib/sites/stripe').modeTest(), cron: !!String(process.env.CRON_SECRET || '').trim() });
      return json(res, 400, { error: 'Opération inconnue' });
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      b = b || {};
      // la mise en route marche avant même que la base soit branchée
      if (b.op === 'mission_enregistrer') return json(res, 200, await require('../lib/missions').enregistrer(b.valeurs || {}, { hote: req.headers['x-forwarded-host'] || req.headers.host }));
      if (b.op === 'mission_cocher') { const db = require('../lib/db').open(); if (!db) return json(res, 200, { erreur: 'branche d\'abord la base' }); return json(res, 200, await require('../lib/missions').cocher(db, String(b.etape || ''), !!b.fait)); }
      if (b.op === 'mission_dns') return json(res, 200, await agir('boite_dns', {}));
      return json(res, 200, await agir(String(b.op || ''), b));
    }
    return json(res, 405, { error: 'Méthode non autorisée' });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
