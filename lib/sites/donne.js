// La donne : pour chaque site, son modèle (la famille de site qui va avec son métier, voir modeles.js), sa palette et sa
// voix typographique prises dans ce modèle, sa mise en scène du haut de page et sa présentation des services. Deux
// entreprises du même métier ou de la même commune n'ont jamais la même combinaison. Rangée dans la fiche (spec.da) :
// même fiche, même site, jusqu'à ce qu'on redonne.
'use strict';
const T = require('./theme');
const M = require('./modeles');

const VERSION = 3;

function choisir(rng, liste, poids) {
  if (!liste.length) return null;
  const p = liste.map(function (x) { return Math.max(0, poids ? poids(x) : 1); });
  const total = p.reduce(function (a, b) { return a + b; }, 0);
  if (!total) return liste[Math.floor(rng() * liste.length)];
  let r = rng() * total;
  for (let k = 0; k < liste.length; k++) { r -= p[k]; if (r <= 0) return liste[k]; }
  return liste[liste.length - 1];
}
function nPhotos(spec) { return ((spec && spec.photos) || []).filter(function (p) { return p && p.fichier; }).length; }
// une mise en scène photo a besoin d'une photo ; la bande de boutique aussi
const HEROS_PHOTO = { photo: true, split: true, centre: true, bande: true };

function paletteDe(da) {
  const m = M.MODELES[da && da.modele];
  return m ? (m.palettes.find(function (p) { return p.id === da.palette; }) || null) : null;
}

// opts = { recents: [da des sites voisins], essai, photos (nombre), garder: { palette, type } }
function donner(spec, opts) {
  opts = opts || {};
  spec = spec || {};
  const essai = opts.essai || 0;
  const id = opts.modele && M.MODELES[opts.modele] ? opts.modele : M.pour(spec.secteur || spec.activite || '');
  const mod = M.MODELES[id];
  const rng = T.tirage(T.hash([spec.nom, spec.commune, spec.secteur || spec.activite, essai].join('|')));
  const recents = (opts.recents || []).filter(function (r) { return r && r.modele === id; });
  const vus = function (cle, v) { return recents.filter(function (r) { return r[cle] === v; }).length; };
  const n = typeof opts.photos === 'number' ? opts.photos : nPhotos(spec);
  const marque = T.valideHex(opts.marque || spec.accent);
  const g = opts.garder && mod.palettes.some(function (p) { return p.id === opts.garder.palette; }) && mod.types.indexOf(opts.garder.type) >= 0 ? opts.garder : null;
  // la palette : claire si le site a un logo (un logo se perd sur du sombre), proche de la couleur de marque, jamais celle d'un voisin si on peut
  let pals = mod.palettes.filter(function (p) { return !spec.logo || p.clair || mod.sombre; });
  if (!pals.length) pals = mod.palettes.slice();
  if (marque && T.teinte(marque).s >= 0.18) pals = pals.slice().sort(function (a, b) { return T.ecartTeinte(a.accent, marque) - T.ecartTeinte(b.accent, marque); }).slice(0, Math.max(2, Math.ceil(pals.length / 2)));
  const palette = g ? g.palette : choisir(rng, pals, function (p) { return Math.pow(0.15, vus('palette', p.id)); }).id;
  // la voix : jamais la même palette avec la même voix qu'un voisin
  const types = mod.types.filter(function (t) { return !recents.some(function (r) { return r.palette === palette && r.type === t; }); });
  const type = g ? g.type : choisir(rng, types.length ? types : mod.types, function (t) { return Math.pow(0.4, vus('type', t)); });
  // le haut de page : la mise en scène du modèle, la seconde pour varier entre voisins ; sans photo, l'aplat
  const heros = mod.heros.filter(function (h) { return !HEROS_PHOTO[h] || n; });
  const hero = heros.length ? choisir(rng, heros, function (h) { return (h === mod.heros[0] ? 1.6 : 1) * Math.pow(0.5, vus('hero', h)); }) : 'nu';
  const services = choisir(rng, mod.services, function (s) { return (s === mod.services[0] ? 1.5 : 1) * Math.pow(0.6, vus('services', s)); });
  return { v: VERSION, modele: id, palette: palette, type: type, hero: hero, services: services, essai: essai };
}

// La direction d'une fiche : la sienne si elle est complète et possible avec ce qu'elle a, sinon une donne stable
// (les fiches des anciens moteurs sont redonnées, toujours de la même façon)
function de(spec) {
  const da = spec && spec.da;
  const mod = da && M.MODELES[da.modele];
  if (da && da.v === VERSION && mod && paletteDe(da) && mod.types.indexOf(da.type) >= 0 && (da.hero === 'nu' || (mod.heros.indexOf(da.hero) >= 0 && (!HEROS_PHOTO[da.hero] || nPhotos(spec)))) && mod.services.indexOf(da.services) >= 0) return da;
  if (da && da.v === VERSION && mod && paletteDe(da) && mod.types.indexOf(da.type) >= 0) {
    // la mise en scène n'est plus possible (photo retirée) : on garde couleurs et lettres
    return donner(spec || {}, { essai: da.essai || 0, modele: da.modele, garder: da });
  }
  return donner(spec || {}, { essai: (da && da.essai) || 0 });
}

module.exports = { donner, de, paletteDe, VERSION, HEROS_PHOTO };
