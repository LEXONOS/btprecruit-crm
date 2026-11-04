// Léa, iconographe : reprend les aperçus qui ne sont pas encore partis et dont les photos ne sont pas passées par elle
// (clé Pexels branchée après coup, quota atteint pendant la fabrication, fiche de l'ancien moteur) : photos du métier
// cherchées place par place, regardées une à une, jamais celles d'un voisin. Les photos de l'entreprise restent devant.
// Un aperçu déjà montré à un prospect ne change plus de visage.
'use strict';
const P = require('../sites/publication');
const IM = require('../sites/images');
const DN = require('../sites/donne');
const DR = require('../sites/direction');
const V = require('../sites/vercel');
const { majFraiche } = require('../db');
const { court } = require('../util');

const LOT = 4;
const iso = function (t) { return new Date(t || Date.now()).toISOString(); };

async function run(ctx) {
  const db = ctx.db;
  if (!V.branche()) return { resume: 'Hébergement des aperçus pas encore branché : rien à illustrer.', produit: 0, prochain_min: 720 };
  if (!IM.branche()) return { resume: 'Clé Pexels pas encore branchée (Missions) : les aperçus prennent la petite banque de secours, ou restent sans photo.', produit: 0, prochain_min: 720 };
  if (ctx.peutDepenser && !ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint : je reprends demain.', produit: 0, prochain_min: 240 };
  const D = require('./demo');
  // les aperçus pas encore relus par Léa, du plus ancien au plus récent, page par page (aucun n'est oublié)
  const aFaire = [];
  for (let off = 0; off < 3000 && aFaire.length < 40; off += 200) {
    const rows = await db.select('hq_sites', { select: 'id,lead_id,status,ph:data->photos', in: { status: ['brouillon', 'apercu'] }, order: 'id.asc', limit: 200, offset: off });
    rows.forEach(function (r) {
      const ph = r.ph !== undefined ? r.ph : (r.data && r.data.photos);
      if (ph && ph.v >= IM.VERSION && !ph.reessai) return;
      if (ph && ph.reessai && Date.parse(ph.reessai) > Date.now()) return;
      aFaire.push(r);
    });
    if (rows.length < 200) break;
  }
  if (!aFaire.length) return { resume: 'Rien à illustrer : tous les aperçus en attente ont leurs photos.', produit: 0, prochain_min: 360 };
  const lids = aFaire.map(function (s) { return s.lead_id; }).filter(Boolean);
  const leads = lids.length ? await db.select('hq_leads', { select: 'id,status', in: { id: lids } }) : [];
  const nonVu = function (s) { const l = leads.find(function (x) { return x.id === s.lead_id; }); return !!l && ['a_contacter', 'nouveau'].indexOf(l.status) >= 0; };
  let faits = 0, cout = 0, quota = null;
  const usage = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const notes = [];
  for (const s0 of aFaire) {
    if (faits >= LOT || quota) break;
    if (ctx.limite && Date.now() > ctx.limite - 45000) break;
    if (ctx.peutDepenser && !ctx.peutDepenser()) break;
    const site = await db.one('hq_sites', { eq: { id: s0.id } });
    if (!site || ['brouillon', 'apercu'].indexOf(site.status) < 0) continue;
    const spec0 = site.spec || {};
    const avant = JSON.stringify(spec0);
    const siennes = (spec0.photos || []).filter(function (p) { return p && p.fichier && !p.credit; });
    const marquer = async function (info, nouvelle) {
      return majFraiche(db, 'hq_sites', site.id, function (f) {
        if (['brouillon', 'apercu'].indexOf(f.status) < 0) return null;
        if (nouvelle && JSON.stringify(f.spec) !== avant) return null;   // modifié entre-temps (retouche du client) : on reprendra
        const patch = { data: Object.assign({}, f.data || {}, { photos: Object.assign({ v: IM.VERSION, le: iso(), par: 'photos' }, info, info.reessai ? {} : { reessai: undefined }) }) };
        if (nouvelle) { patch.spec = nouvelle; patch.version = (f.version || 1) + 1; }
        return patch;
      });
    };
    // déjà vu par le prospect, ou assez de photos à lui : rien à faire ; un aperçu resté SANS AUCUNE photo en reçoit
    // toujours (il ne peut qu'y gagner, même déjà montré)
    const sansPhoto = !(spec0.photos || []).some(function (p) { return p && p.fichier; });
    if ((!nonVu(site) && !sansPhoto) || siennes.length >= 2 || (spec0.provenance && spec0.provenance.photos === 'client')) { await marquer({ rien: !nonVu(site) ? 'déjà montré au prospect' : 'ses propres photos' }); continue; }
    const vs = await D.voisins(db, spec0, site.id);
    const base = Object.assign({}, spec0, { photos: siennes });
    // jamais les photos d'un voisin, ni celles que Miranda a refusées sur ce site
    (spec0.photos_refusees || []).forEach(function (id) { vs.photos.add(id); });
    const il = await D.poserIllustrations(base, vs.photos, (spec0.nom || '') + '|' + (spec0.commune || ''), { peutDepenser: ctx.peutDepenser });
    cout += il.cout || 0;
    if (il.usage) Object.keys(usage).forEach(function (k) { usage[k] += il.usage[k] || 0; });
    if (!il.source || typeof il.reessai === 'number') {
      // quota de l'heure, budget du jour, regard en panne : on reprend plus tard ; sinon on note pourquoi, sans revenir dessus
      const e = D.etatPhotos(il, 'photos');
      if (il.erreur && /quota/.test(il.erreur)) quota = il.erreur;
      if (!il.source) { await marquer(e); continue; }
      // la banque de secours a servi en attendant : on la pose, et Léa repassera
      Object.assign(il, { _etat: e });
    }
    let spec = il.spec;
    // une donne qui montre les photos (mêmes couleurs, mêmes lettres si elles étaient déjà données)
    const da0 = spec0.da && spec0.da.v === DN.VERSION ? spec0.da : null;
    spec.da = DN.donner(spec, { recents: vs.das, essai: (da0 && da0.essai) || 0, garder: da0 });
    const rv = DR.revoir(spec, { recents: vs.das });
    spec = rv.spec;
    // les photos changent ce que le site peut montrer : la composition est refaite (ce que le constructeur a demandé reste)
    D.composer(spec, vs);
    const ok = await marquer(il._etat || { source: il.source, erreur: il.erreur, notes: il.notes }, spec);
    if (!ok) continue;
    faits++;
    notes.push(court(spec.nom, 40) + ' (' + (spec.photos || []).filter(function (p) { return p.credit; }).length + ' photo(s)' + (il.notes && il.notes.recalees ? ', ' + il.notes.recalees + ' recalée(s)' : '') + ')');
  }
  if (faits) {
    await P.ecrireEtat(db, { a_publier: true });
    await require('./boite').reveiller(db, 'livraison', 1).catch(function () { return null; });
    await require('./boite').reveiller(db, 'critique', 16).catch(function () { return null; });
  }
  const reste = aFaire.length - faits;
  return { resume: (faits ? faits + ' aperçu(s) illustré(s) : ' + notes.join(' ; ') + '.' : 'Aucun aperçu illustré ce passage.') + (quota ? ' ' + quota + ' : je reprends dans une heure.' : ''), produit: faits, cout: cout, usage: usage, modele: 'fast', prochain_min: quota ? 65 : (reste > 0 ? 20 : null), detail: { faits: faits, notes: notes } };
}

module.exports = { run };
