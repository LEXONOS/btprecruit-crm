// Iris, directrice artistique : relit les aperçus qui ne sont pas encore partis (règles du moteur qui ont changé,
// voisins apparus entre-temps, fiches de l'ancien moteur) et corrige ce qui peut l'être sans rien inventer : grand titre,
// phrase du haut, donne (modèle, palette, voix, haut de page). Les photos sont le travail de Léa.
// Un aperçu déjà montré à un prospect ne change plus de visage : seul ce qu'il demande y touche (outil modifier_site).
'use strict';
const P = require('../sites/publication');
const DN = require('../sites/donne');
const DR = require('../sites/direction');
const { majFraiche } = require('../db');
const { court } = require('../util');

const LOT = 10;
const iso = function () { return new Date().toISOString(); };

async function run(ctx) {
  const db = ctx.db;
  const D = require('./demo');
  // les aperçus pas encore relus à la version du moteur, du plus ancien au plus récent, page par page (aucun n'est oublié)
  const ids = [];
  for (let off = 0; off < 3000 && ids.length < LOT; off += 200) {
    const rows = await db.select('hq_sites', { select: 'id,status,rv:data->revue', in: { status: ['brouillon', 'apercu'] }, order: 'id.asc', limit: 200, offset: off });
    rows.forEach(function (r) { const rv = r.rv !== undefined ? r.rv : (r.data && r.data.revue); if (!(rv && rv.v >= DN.VERSION && rv.relu) && ids.length < LOT) ids.push(r.id); });
    if (rows.length < 200) break;
  }
  if (!ids.length) return { resume: 'Rien à relire : les aperçus en attente sont tous passés par la relecture.', produit: 0, prochain_min: 240 };
  const sites = await db.select('hq_sites', { in: { id: ids }, select: 'id,lead_id,slug,status,spec,data,version' });
  const lids = sites.map(function (s) { return s.lead_id; }).filter(Boolean);
  const leads = lids.length ? await db.select('hq_leads', { select: 'id,status', in: { id: lids } }) : [];
  const nonVu = function (s) { const l = leads.find(function (x) { return x.id === s.lead_id; }); return !!l && ['a_contacter', 'nouveau'].indexOf(l.status) >= 0; };
  let relus = 0, corriges = 0;
  const notes = [];
  for (const s of sites) {
    if (ctx.limite && Date.now() > ctx.limite - 30000) break;
    let spec = Object.assign({}, s.spec || {});
    const avant = JSON.stringify(spec);
    const corrections = [];
    let restants = [];
    if (!spec.nom) restants = ['fiche vide'];
    else if (nonVu(s)) {
      const vs = await D.voisins(db, spec, s.id);
      if (!spec.da || spec.da.v !== DN.VERSION) { spec.da = DN.donner(spec, { recents: vs.das, essai: (spec.da && spec.da.essai) || 0 }); corrections.push('donne du nouveau moteur'); }
      const rv = DR.revoir(spec, { recents: vs.das });
      spec = rv.spec; rv.corrections.forEach(function (c) { corrections.push(c); }); restants = rv.restants.map(function (x) { return x.message; });
    } else {
      // déjà vu : on relit sans rien changer au visage
      restants = DR.verifier(spec, {}).map(function (x) { return x.message; });
    }
    const change = JSON.stringify(spec) !== avant;
    const revue = { v: DN.VERSION, relu: true, le: iso(), par: 'da', corrections: corrections.slice(0, 6), restants: restants.slice(0, 6) };
    const fait = await majFraiche(db, 'hq_sites', s.id, function (f) {
      if (['brouillon', 'apercu'].indexOf(f.status) < 0) return null;
      if (change && JSON.stringify(f.spec) !== avant) return null;   // modifié pendant la relecture : on reprendra au prochain passage
      return Object.assign({ data: Object.assign({}, f.data || {}, { revue: revue }) }, change ? { spec: spec, version: (f.version || 1) + 1 } : {});
    });
    if (!fait) continue;
    relus++;
    if (change) { corriges++; notes.push(court(spec.nom, 40) + ' (' + corrections.join(', ') + ')'); }
  }
  if (corriges) await P.ecrireEtat(db, { a_publier: true });
  return { resume: relus + ' aperçu(s) relu(s)' + (corriges ? ', ' + corriges + ' corrigé(s) : ' + notes.slice(0, 4).join(' ; ') : ', rien à corriger') + '.', produit: corriges, prochain_min: ids.length >= LOT ? 15 : null, detail: { relus: relus, corriges: corriges, notes: notes } };
}

module.exports = { run };
