// Iris, directrice artistique : relit les aperçus qui ne sont pas encore partis (règles du moteur qui ont changé,
// voisins apparus entre-temps, fiches de l'ancien moteur) et corrige ce qui peut l'être sans rien inventer : grand titre,
// phrase du haut, donne (modèle, palette, voix, haut de page). Les photos sont le travail de Léa.
// Un aperçu déjà montré à un prospect ne change plus de visage : seul ce qu'il demande y touche (outil modifier_site).
'use strict';
const P = require('../sites/publication');
const DN = require('../sites/donne');
const DR = require('../sites/direction');
const C = require('../sites/composition');
const R = require('../sites/rendu');
const CR = require('./critique');
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
    const rows = await db.select('hq_sites', { select: 'id,status,rv:data->revue,cv:spec->compo->v', in: { status: ['brouillon', 'apercu'] }, order: 'id.asc', limit: 200, offset: off });
    // à relire : pas encore relu à la version du moteur, ou pas encore de composition de la bibliothèque des rubriques
    rows.forEach(function (r) { const rv = r.rv !== undefined ? r.rv : (r.data && r.data.revue); const cv = r.cv !== undefined ? r.cv : (r.spec && r.spec.compo && r.spec.compo.v); if (!(rv && rv.v >= DN.VERSION && rv.relu && Number(cv) === C.VERSION_TPL) && ids.length < LOT) ids.push(r.id); });
    if (rows.length < 200) break;
  }
  if (!ids.length) return { resume: 'Rien à relire : les aperçus en attente sont tous passés par la relecture.', produit: 0, prochain_min: 240 };
  const sites = await db.select('hq_sites', { in: { id: ids }, select: 'id,lead_id,slug,status,spec,data,version' });
  const lids = sites.map(function (s) { return s.lead_id; }).filter(Boolean);
  const leads = lids.length ? await db.select('hq_leads', { select: 'id,status', in: { id: lids } }) : [];
  // pas encore montré : la même règle que Miranda et Léa (un prospect à appeler n'a pas encore vu son aperçu, Louis
  // l'appellera avec : il se refait comme les autres)
  const nonVu = function (s) { const l = leads.find(function (x) { return x.id === s.lead_id; }); return !!l && CR.PAS_MONTRE.indexOf(l.status) >= 0; };
  let relus = 0, corriges = 0, cout = 0;
  const usage = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
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
      // déjà vu : on relit sans rien changer à ses couleurs ni à ses lettres
      restants = DR.verifier(spec, {}).map(function (x) { return x.message; });
    }
    // le grand titre du premier écran, pour les fiches écrites avant lui (un essai par fiche : « » si rien de bon) ; un
    // aperçu déjà montré garde ses mots
    if (spec.nom && (spec.v || 0) >= 3 && spec.titre === undefined && nonVu(s)) {
      const t = await require('../sites/atelier').titre(spec).catch(function () { return null; });
      if (t) {
        cout += t.cout || 0; Object.keys(usage).forEach(function (k) { usage[k] += (t.usage && t.usage[k]) || 0; });
        spec.titre = t.titre || '';
        if (t.titre) corrections.push('grand titre « ' + t.titre + ' »');
      }
    }
    // le template (v3) : rangé une fois pour toutes (un aperçu déjà vu garde celle que
    // le moteur lui donne aujourd'hui ; un aperçu pas encore parti l'obtient en évitant ses voisins)
    if (spec.nom) {
      const x = R.contexte({ slug: s.slug || 'relecture', spec: spec }, { mode: 'apercu' });
      if (!C.valide(spec.compo, spec, x.ctx)) {
        const vs = nonVu(s) ? await D.voisins(db, spec, s.id) : { compos: [] };
        let choix = spec.compo && spec.compo.choix;
        if (nonVu(s) && spec.compo) {
          // un moteur refait : les sections écartées par Miranda l'avaient été sur l'ancien rendu, elles ont leur chance
          if (spec.compo.v !== C.VERSION_TPL) spec.compo = Object.assign({}, spec.compo, { eviter: undefined });
          // son template déjà pris par un voisin plus ancien du même métier : il en change (le moteur l'avait gardé d'une
          // composition à l'autre, et trois climaticiens de Fort-de-France avaient le même site)
          const t0 = choix && choix.template;
          if (t0 && vs.compos.some(function (c) { return c && c.metier && c.template === t0 && c.id < s.id; })) {
            choix = Object.assign({}, choix); delete choix.template;
            spec.compo = Object.assign({}, spec.compo, { choix: choix });   // l'assembleur relit aussi le choix rangé dans la fiche
            corrections.push('template déjà pris par un voisin');
          }
        }
        spec.compo = C.composer(spec, x.ctx, { recents: vs.compos, choix: choix, essai: (spec.compo && spec.compo.essai) || 0 });
        corrections.push('template ' + (spec.compo.template || '?'));
      }
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
  if (corriges) {
    await P.ecrireEtat(db, { a_publier: true });
    // la chaîne ne dort pas : Lucas publie au passage suivant, Miranda juge dès que c'est en ligne
    await require('./boite').reveiller(db, 'livraison', 1).catch(function () { return null; });
    await require('./boite').reveiller(db, 'critique', 16).catch(function () { return null; });
  }
  return { resume: relus + ' aperçu(s) relu(s)' + (corriges ? ', ' + corriges + ' corrigé(s) : ' + notes.slice(0, 4).join(' ; ') : ', rien à corriger') + '.', produit: corriges, prochain_min: ids.length >= LOT ? 15 : null, cout: cout, usage: usage, modele: cout ? 'fast' : undefined, detail: { relus: relus, corriges: corriges, notes: notes } };
}

module.exports = { run };
