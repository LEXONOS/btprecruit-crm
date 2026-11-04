// La bibliothèque des rubriques : chaque fichier de ce dossier apporte des variantes d'une rubrique (en-tête, haut de
// page, services...). Une variante est un objet :
//   { id: 'hero.voile', rubrique: 'hero', nom, quand (une phrase pour le constructeur), familles: [] (modèles de métier
//     qui lui vont, vide = tous), ambiances: [], surfaces: ['fond', ...] (la première est sa préférée), js: [modules],
//     besoin(spec, ctx) → bool (le contenu suffit-il ?), rendre(spec, ctx, bloc) → html, css(ctx) → feuille (sous .r-hero-voile) }
// L'assembleur (composition.js) choisit une variante par rubrique ; le rendu (rendu.js) les met bout à bout.
'use strict';
const fs = require('fs');
const path = require('path');

const RUBRIQUES = ['nav', 'hero', 'bandeau', 'services', 'pourquoi', 'apropos', 'etapes', 'galerie', 'avis', 'infos', 'appel', 'faq', 'contact', 'pied'];
const SURFACES = ['fond', 'surface', 'champ', 'accent', 'photo'];
const FAMILLES = ['atelier', 'garage', 'comptoir', 'ecrin', 'cabinet', 'horizon', 'verdure', 'boutique'];
const AMBIANCES = ['franc', 'calme', 'chaleureux', 'premium'];
// chaque fichier du dossier (sauf les outils communs) apporte un tableau de variantes, d'une ou plusieurs rubriques
const COMMUNS = ['index', 'outils', 'jetons', 'mouvement', 'fonds'];
const FICHIERS = fs.readdirSync(__dirname).filter(function (f) { return /\.js$/.test(f) && COMMUNS.indexOf(f.replace(/\.js$/, '')) < 0; }).map(function (f) { return f.replace(/\.js$/, ''); }).sort();

const VARIANTES = {};
const PAR_RUBRIQUE = {};
RUBRIQUES.forEach(function (r) { PAR_RUBRIQUE[r] = []; });
const ERREURS = [];

function valider(v, fichier) {
  const e = [];
  if (!v || typeof v !== 'object') return ['variante illisible'];
  if (!/^[a-z]+\.[a-z0-9-]+$/.test(v.id || '')) e.push('id « ' + v.id + ' » : rubrique.nom en minuscules');
  if (RUBRIQUES.indexOf(v.rubrique) < 0) e.push(v.id + ' : rubrique inconnue « ' + v.rubrique + ' »');
  else if (String(v.id).split('.')[0] !== v.rubrique) e.push(v.id + ' : l\'id doit commencer par sa rubrique');
  if (typeof v.rendre !== 'function') e.push(v.id + ' : rendre manque');
  if (!v.nom || !v.quand) e.push(v.id + ' : nom et quand sont obligatoires');
  (v.familles || []).forEach(function (f) { if (FAMILLES.indexOf(f) < 0) e.push(v.id + ' : famille inconnue ' + f); });
  (v.ambiances || []).forEach(function (a) { if (AMBIANCES.indexOf(a) < 0) e.push(v.id + ' : ambiance inconnue ' + a); });
  (v.surfaces || []).forEach(function (s) { if (SURFACES.indexOf(s) < 0) e.push(v.id + ' : surface inconnue ' + s); });
  if (VARIANTES[v.id]) e.push(v.id + ' : en double (' + fichier + ')');
  return e;
}
function charger() {
  FICHIERS.forEach(function (f) {
    const p = path.join(__dirname, f + '.js');
    if (!fs.existsSync(p)) return;
    let liste;
    try { liste = require(p); } catch (x) { ERREURS.push(f + '.js : ' + x.message); return; }
    (Array.isArray(liste) ? liste : []).forEach(function (v) {
      const e = valider(v, f);
      if (e.length) { e.forEach(function (x) { ERREURS.push(x); }); return; }
      const x = Object.assign({ familles: [], ambiances: [], surfaces: ['fond'], js: [] }, v);
      x.classe = 'r-' + x.id.replace(/\./g, '-');
      if (f === 'socle') x.socle = true;
      VARIANTES[x.id] = x;
      PAR_RUBRIQUE[x.rubrique].push(x);
    });
  });
}
charger();

// le contenu suffit-il pour cette variante ? (une variante sans besoin déclaré s'affiche si elle rend quelque chose)
function possible(v, spec, ctx) { try { return !v.besoin || !!v.besoin(spec, ctx); } catch (e) { return false; } }
// le catalogue pour le constructeur : les variantes d'une famille, une ligne chacune
function catalogue(famille, rubriques) {
  const out = {};
  (rubriques || RUBRIQUES).forEach(function (r) {
    out[r] = PAR_RUBRIQUE[r].filter(function (v) { return !famille || !v.familles.length || v.familles.indexOf(famille) >= 0; }).map(function (v) { return { id: v.id, nom: v.nom, quand: v.quand }; });
  });
  return out;
}
function texteCatalogue(famille) {
  const c = catalogue(famille);
  return RUBRIQUES.filter(function (r) { return c[r].length; }).map(function (r) { return r + ' :\n' + c[r].map(function (v) { return '- ' + v.id + ' (' + v.nom + ') : ' + v.quand; }).join('\n'); }).join('\n');
}

module.exports = { RUBRIQUES, SURFACES, FAMILLES, AMBIANCES, VARIANTES, PAR_RUBRIQUE, ERREURS, possible, catalogue, texteCatalogue, valider };
