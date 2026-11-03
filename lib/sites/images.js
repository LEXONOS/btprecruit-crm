// Photos d'illustration quand l'entreprise n'a pas (encore) les siennes : Pexels (clé HQ_PEXELS_KEY, licence Pexels),
// sinon une petite banque choisie pour les métiers où une image d'ambiance a du sens (banque.js). Jamais de visages :
// une photo de banque ne doit pas passer pour l'équipe de l'entreprise. Les octets sont téléchargés une fois et servis
// par le site lui-même ; l'auteur est crédité dans les mentions légales.
'use strict';
const { telechargerImage } = require('../web');
const PH = require('./photos');
const T = require('./theme');
const B = require('./banque');

const PERSONNES = /\b(man|men|woman|women|person|persons|people|girl|girls|boy|boys|child|children|kid|kids|portrait|face|faces|smiling|smile|couple|family|businessman|businesswoman|worker|workers|guy|lady|selfie|model|team|employee|customer|client|student|doctor|nurse|chef)\b/i;
function cle() { return String(process.env.HQ_PEXELS_KEY || '').trim(); }
function branche() { return !!cle(); }

async function chercherPexels(requete, k, n) {
  const u = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(requete) + '&orientation=landscape&size=medium&per_page=' + (n || 15) + '&locale=en-US';
  const r = await fetch(u, { headers: { Authorization: k, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (r.status === 401 || r.status === 403) { const e = new Error('clé Pexels refusée'); e.statut = r.status; throw e; }
  if (r.status === 429) { const e = new Error('quota Pexels atteint pour l\'heure'); e.statut = 429; throw e; }
  if (!r.ok) throw new Error('Pexels répond ' + r.status);
  const j = await r.json();
  return (j.photos || []).filter(function (p) { return p && p.id && p.width >= 1600 && p.width / p.height >= 1.2 && !PERSONNES.test(p.alt || ''); }).map(function (p) {
    const base = (p.src && p.src.original) || ('https://images.pexels.com/photos/' + p.id + '/pexels-photo-' + p.id + '.jpeg');
    return { id: 'px' + p.id, source: 'Pexels', url: base.split('?')[0] + '?auto=compress&cs=tinysrgb&w=1920', auteur: p.photographer || null, page_auteur: p.photographer_url || null, page: p.url || null };
  });
}
// La clé est-elle bonne ? (Missions : essayée avant d'être enregistrée)
async function verifier(k) {
  try { await chercherPexels('tropical garden', k, 1); return { ok: true }; }
  catch (e) { return { erreur: e.statut === 401 || e.statut === 403 ? 'clé Pexels refusée : recopie-la depuis ta page API de Pexels' : 'Pexels ne répond pas (' + e.message + ')' }; }
}

// opts = { n (photos voulues), eviter (ids déjà pris par les voisins), graine }
// → { photos: [{ data, type, l, h, sha, credit }], source: 'pexels' | 'banque' | null, erreur }
async function illustrations(spec, opts) {
  opts = opts || {};
  spec = spec || {};
  const n = opts.n || 4;
  const eviter = opts.eviter instanceof Set ? opts.eviter : new Set(opts.eviter || []);
  const m = T.pourMetier(spec.secteur || spec.activite || '');
  const requetes = [].concat(spec.mots_photo || [], m.photos).map(function (q) { return String(q || '').trim().toLowerCase(); }).filter(function (q, k, a) { return q && a.indexOf(q) === k; }).slice(0, 3);
  let choix = [], source = null, erreur = null;
  const k = cle();
  if (k) {
    const listes = [];
    for (const q of requetes) {
      try { listes.push((await chercherPexels(q, k, 15)).filter(function (x) { return !eviter.has(x.id); }).slice(0, 6)); }
      catch (e) { erreur = e.message; if (e.statut) break; }
    }
    // une photo par recherche à tour de rôle : des images variées plutôt que quatre fois la même scène
    const vus = new Set();
    for (let r = 0; r < 6 && choix.length < n + 3; r++) listes.forEach(function (l) { const x = l[r]; if (x && !vus.has(x.id) && choix.length < n + 3) { vus.add(x.id); choix.push(x); } });
    if (choix.length) source = 'pexels';
  }
  if (!choix.length && m.banque && B.BANQUE[m.banque]) {
    const rng = T.tirage(T.hash(opts.graine || spec.nom || ''));
    const set = B.BANQUE[m.banque].filter(function (p) { return !eviter.has('ps' + p.id); }).map(function (p) { return { p: p, r: rng() }; }).sort(function (a, b) { return a.r - b.r; }).map(function (x) { return x.p; });
    choix = set.slice(0, n + 2).map(function (p) { return { id: 'ps' + p.id, source: 'Unsplash', url: B.url(p, 1920), auteur: p.auteur, page_auteur: null, page: p.page }; });
    if (choix.length) source = 'banque';
  }
  const photos = [];
  for (const c of choix) {
    if (photos.length >= n) break;
    const r = await telechargerImage(c.url, 2500000).catch(function () { return { erreur: 1 }; });
    if (r.erreur) continue;
    const d = PH.dimensions(r.data);
    if (!d || d.l < 1200 || d.h < 600) continue;
    photos.push({ data: r.data, type: r.type, l: d.l, h: d.h, sha: PH.sha1(r.data), url: c.url, credit: { id: c.id, source: c.source, auteur: c.auteur, page: c.page, page_auteur: c.page_auteur } });
  }
  return { photos: photos, source: photos.length ? source : null, erreur: erreur };
}

module.exports = { illustrations, verifier, branche, chercherPexels, PERSONNES };
