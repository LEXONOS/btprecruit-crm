// La donne : pour chaque site, une direction artistique complète (mise en scène du haut de page, palette, voix
// typographique, arrondis, présentation des services, mouvement), tirée selon le métier, le ton, les photos disponibles
// et ce que les voisins ont déjà : deux entreprises du même métier ou de la même commune n'ont jamais le même site.
// Le résultat est rangé dans la fiche (spec.da) : même fiche, même site, jusqu'à ce qu'on redonne.
'use strict';
const T = require('./theme');

const VERSION = 2;
// photo : il faut au moins une photo ; clair : palettes claires seulement ; types : voix possibles
const DIRECTIONS = {
  lieu: { nom: 'Photo en grand, bande de couleur', photo: true, types: null },
  scene: { nom: 'Texte et grande photo côte à côte', photo: true, types: null },
  monument: { nom: 'Le nom en très grand', photo: false, types: ['bigshoulders', 'barlow', 'archivo', 'unbounded', 'epilogue', 'schibsted', 'jost', 'besley', 'youngserif', 'bodoni', 'fraunces', 'bricolage'] },
  affiche: { nom: 'Aplat de couleur, phrase en deux lignes', photo: false, types: ['bigshoulders', 'barlow', 'archivo', 'epilogue', 'schibsted', 'unbounded', 'besley', 'jost', 'youngserif', 'bricolage'] },
  sobre: { nom: 'Calme et aéré', photo: false, clair: true, types: ['hanken', 'albert', 'newsreader', 'bodoni', 'fraunces', 'bricolage', 'youngserif', 'schibsted'] }
};
const MOUVEMENTS = { lieu: 'devoile', scene: 'devoile', monument: 'leve', affiche: 'defile', sobre: 'leve' };

function choisir(rng, liste, poids) {
  if (!liste.length) return null;
  const p = liste.map(function (x) { return Math.max(0, poids ? poids(x) : 1); });
  const total = p.reduce(function (a, b) { return a + b; }, 0);
  if (!total) return liste[Math.floor(rng() * liste.length)];
  let r = rng() * total;
  for (let k = 0; k < liste.length; k++) { r -= p[k]; if (r <= 0) return liste[k]; }
  return liste[liste.length - 1];
}

// opts = { recents: [da des sites voisins], essai, marque (couleur), photos (nombre, sinon spec.photos), garder: { palette, type, rayon } }
function donner(spec, opts) {
  opts = opts || {};
  spec = spec || {};
  const m = T.pourMetier(spec.secteur || spec.activite || '');
  const ton = T.TONS.indexOf(spec.ton) >= 0 ? spec.ton : m.ton;
  const nPhotos = typeof opts.photos === 'number' ? opts.photos : (spec.photos || []).filter(function (p) { return p && p.fichier; }).length;
  const essai = opts.essai || 0;
  const rng = T.tirage(T.hash([spec.nom, spec.commune, spec.secteur || spec.activite, essai].join('|')));
  const recents = (opts.recents || []).filter(Boolean);
  const vus = function (cle, v) { return recents.filter(function (r) { return r[cle] === v; }).length; };
  const marque = T.valideHex(opts.marque || spec.accent);
  const calme = ton === 'calme' || ton === 'premium';
  // 1. la mise en scène
  // ses propres photos se montrent toujours en haut de page ; des photos d'illustration peuvent laisser place à l'aplat
  const propres = (spec.photos || []).some(function (p) { return p && p.fichier && !p.credit; });
  const poidsDir = nPhotos
    ? { lieu: 3, scene: 3, monument: 1.2, sobre: calme ? 2.2 : 0.6, affiche: propres ? 0 : (ton === 'franc' ? 0.8 : 0.4) }
    : { affiche: calme ? 1 : 3, monument: 3, sobre: calme ? 3 : 1, lieu: 0, scene: 0 };
  // garder = { palette, type, rayon } : on ne change que la mise en scène (le client a envoyé ses photos)
  const g = opts.garder && T.PAR_ID[opts.garder.palette] && T.typo(opts.garder.type).id === opts.garder.type ? opts.garder : null;
  const possible = function (d) { const X = DIRECTIONS[d]; return !g || ((!X.types || X.types.indexOf(g.type) >= 0) && (!X.clair || T.PAR_ID[g.palette].clair)); };
  const direction = choisir(rng, Object.keys(DIRECTIONS).filter(possible), function (d) { return (poidsDir[d] || 0) * Math.pow(0.35, vus('direction', d)); }) || 'monument';
  const D = DIRECTIONS[direction];
  if (g) {
    const restantesG = nPhotos - (D.photo ? 1 : 0);
    return { v: VERSION, direction: direction, palette: g.palette, type: g.type, rayon: g.rayon || 'carre', services: restantesG >= 2 && direction !== 'affiche' && rng() < 0.6 ? 'photos' : (opts.garder.services && opts.garder.services !== 'photos' ? opts.garder.services : 'liste'), mouvement: MOUVEMENTS[direction], ton: ton, essai: essai };
  }
  // 2. la palette : du ton, claire si le site a un logo (un logo sur fond sombre se perd), proche de la couleur de marque
  let pals = T.PALETTES.filter(function (p) { return p.tons.indexOf(ton) >= 0 && (!D.clair || p.clair) && (!spec.logo || p.clair); });
  if (!pals.length) pals = T.PALETTES.filter(function (p) { return p.clair; });
  if (marque) {
    const neutre = T.teinte(marque).s < 0.18;
    pals = pals.slice().sort(function (a, b) { return (neutre ? 0 : T.ecartTeinte(a.accent, marque) - T.ecartTeinte(b.accent, marque)); }).slice(0, neutre ? pals.length : 6);
  }
  const palsLibres = pals.filter(function (p) { return !vus('palette', p.id); });
  const palette = choisir(rng, palsLibres.length >= 2 ? palsLibres : pals);
  // 3. la voix
  let types = T.TYPES.filter(function (t) { return t.tons.indexOf(ton) >= 0 && (!D.types || D.types.indexOf(t.id) >= 0); });
  if (!types.length) types = T.TYPES.filter(function (t) { return !D.types || D.types.indexOf(t.id) >= 0; });
  const typesLibres = types.filter(function (t) { return !vus('type', t.id); });
  const type = choisir(rng, typesLibres.length ? typesLibres : types);
  // 4. le reste : un rayon pour tout le site, la présentation des services, un seul mouvement
  const rayon = type.rayon || (rng() < 0.5 ? 'carre' : 'rond');
  const restantes = nPhotos - (D.photo ? 1 : 0);
  const services = restantes >= 2 && direction !== 'affiche' && rng() < 0.6 ? 'photos' : (rng() < 0.5 ? 'liste' : 'tuiles');
  return { v: VERSION, direction: direction, palette: palette.id, type: type.id, rayon: rayon, services: services, mouvement: MOUVEMENTS[direction], ton: ton, essai: essai };
}

// La direction d'une fiche : la sienne si elle est complète et possible avec ce qu'elle a, sinon une donne stable
function de(spec) {
  const da = spec && spec.da;
  const nPhotos = ((spec && spec.photos) || []).filter(function (p) { return p && p.fichier; }).length;
  if (da && DIRECTIONS[da.direction] && T.PAR_ID[da.palette] && T.typo(da.type).id === da.type && (!DIRECTIONS[da.direction].photo || nPhotos)) return da;
  return donner(spec || {}, { essai: da && da.essai || 0 });
}

module.exports = { donner, de, DIRECTIONS, VERSION };
