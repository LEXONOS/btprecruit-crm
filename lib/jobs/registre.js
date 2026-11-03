// Sami, Chasseur nouvelles entreprises : annonces officielles de création (BODACC, open data) en Martinique.
// Une entreprise qui vient de naître a besoin d'un site. Le BODACC ne donne ni email ni téléphone :
// on cherche ensuite la fiche Google (budget compté) ; le Fournisseur de contacts fait le reste.
'use strict';
const ND = require('../chasse/nd-moteur');
const { jourGP } = require('../util');
const { NOVALEMO } = require('../config');

const API = 'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records';
const ILE = { '971': 'GP', '972': 'MQ', '977': 'BL', '978': 'MF' };
const HORS_CIBLE = /(soci[ée]t[ée] civile|\bsci\b|holding|location de terrains|location de logements|activit[ée]s des soci[ée]t[ée]s holding|association|m[ée]dec|infirmi|pharmac|avocat|notaire|huissier|expert[- ]comptable|administrateur de biens)/i;

function json(s) { if (!s) return null; if (typeof s === 'object') return s; try { return JSON.parse(s); } catch (e) { return null; } }

async function run(ctx) {
  const db = ctx.db;
  const depuis = jourGP(new Date(Date.now() - 7 * 86400000));
  const where = 'numerodepartement in (' + NOVALEMO.depts.map(function (d) { return '"' + d + '"'; }).join(',') + ') and familleavis in ("creation","immatriculation") and dateparution >= date\'' + depuis + '\'';
  const url = API + '?where=' + encodeURIComponent(where) + '&order_by=' + encodeURIComponent('dateparution desc') + '&limit=100';
  let d;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'LaTour/1.0 (Novalemo, Martinique)' }, signal: AbortSignal.timeout(20000) });
    d = await r.json().catch(function () { return {}; });
    if (!r.ok) return { resume: 'BODACC a refusé la requête : ' + String((d && (d.message || d.error_code)) || r.status).slice(0, 160), produit: 0, erreur: true };
  } catch (e) { return { resume: 'BODACC injoignable : ' + String(e.message).slice(0, 120), produit: 0, erreur: true }; }
  const recs = d.results || [];
  const candidats = [];
  recs.forEach(function (r) {
    const etab = json(r.listeetablissements);
    const e0 = etab && (etab.etablissement ? (Array.isArray(etab.etablissement) ? etab.etablissement[0] : etab.etablissement) : null);
    const activite = (e0 && (e0.activite || e0.activiteRCS)) || '';
    const nom = r.commercant || (json(r.listepersonnes) || {}).denomination || null;
    if (!nom || HORS_CIBLE.test(activite + ' ' + nom)) return;
    if (NOVALEMO.depts.indexOf(String(r.numerodepartement)) < 0) return;
    const reg = Array.isArray(r.registre) ? r.registre.join(' ') : String(r.registre || '');
    const siren = (reg.match(/\d{9}/) || reg.replace(/\s/g, '').match(/\d{9}/) || [null])[0];
    candidats.push({
      company_id: 'novalemo', dedupe: siren ? 'siren:' + siren : 'bodacc:' + (r.id || nom + r.ville), source: 'registre', name: String(nom).slice(0, 120),
      sector: String(activite).slice(0, 120) || null, island: ILE[String(r.numerodepartement)] || null, commune: r.ville || null,
      website: null, phone: null, score: 58, reason: 'Entreprise créée (BODACC du ' + (r.dateparution || '?') + ')' + (activite ? ' : ' + String(activite).slice(0, 80) : ''),
      status: 'nouveau', site_state: null, data: { bodacc: { date: r.dateparution, siren: siren, cp: r.cp || null, activite: activite || null, url: r.url_complete || null } }
    });
  });
  if (!candidats.length) return { resume: recs.length + ' annonce(s) lue(s), aucune création ciblée cette semaine.', produit: 0 };
  // déjà connus ?
  const connus = new Set((await db.select('hq_leads', { select: 'dedupe', in: { dedupe: candidats.map(function (c) { return c.dedupe; }) } })).map(function (x) { return x.dedupe; }));
  const neufs = candidats.filter(function (c) { return !connus.has(c.dedupe); });
  // fiche Google pour quelques-unes (budget)
  const cle = process.env.GOOGLE_MAPS_API_KEY;
  const jour = await db.one('hq_daily', { eq: { day: jourGP() } });
  let reste = Math.max(0, Math.min(6, (ctx.budget.places_jour || 0) - ((jour && jour.places) || 0)));
  for (const c of neufs) {
    if (!cle || reste <= 0 || Date.now() > ctx.limite - 20000) break;
    reste--; ctx.compteurs.places++;
    const dep = Object.keys(ILE).find(function (k) { return ILE[k] === c.island; });
    const g = await ND.chercherGoogle(c.name, c.commune, dep, cle, null, [c.name], null).catch(function () { return null; });
    if (g) {
      c.phone = g.tel || null; c.website = g.site || null;
      c.data.google = g; c.score += 6;
      c.site_state = g.site ? null : 'aucun';
    }
    if (!c.website && !c.phone) c.status = 'sans_contact';
  }
  const ins = neufs.length ? await db.insert('hq_leads', neufs, { onConflict: 'dedupe', ignoreDuplicates: true }) : [];
  ctx.compteurs.leads += ins.length;
  return { resume: recs.length + ' annonce(s) BODACC lue(s), ' + ins.length + ' nouvelle(s) entreprise(s) ciblée(s)', produit: ins.length };
}

module.exports = { run };
