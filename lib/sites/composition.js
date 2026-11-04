// L'assembleur : la science de la construction d'un site. Pour chaque fiche, il prend la recette du métier (l'ordre des
// rubriques que suivent les meilleurs sites de ce secteur), choisit une variante par rubrique dans la bibliothèque
// (celles que le constructeur a demandées si elles tiennent avec le contenu, sinon les plus justes pour la famille et
// l'ambiance, jamais celles d'un voisin du même métier), règle le rythme des surfaces (clair, teinté, sombre, couleur),
// pose les fonds travaillés et les découpes entre les blocs, le style des boutons et le tempo du mouvement.
// Même fiche, même composition (tirage par graine) ; rangée dans la fiche (spec.compo) pour ne plus bouger.
'use strict';
const T = require('./theme');
const B = require('./rubriques');
const FD = require('./rubriques/fonds');

const VERSION = 1;
const RECETTES = {
  atelier: ['nav', 'hero', 'bandeau', 'services', 'pourquoi', 'apropos', 'etapes', 'galerie', 'avis', 'appel', 'infos', 'faq', 'contact', 'pied'],
  garage: ['nav', 'hero', 'bandeau', 'services', 'pourquoi', 'galerie', 'apropos', 'avis', 'etapes', 'appel', 'infos', 'faq', 'contact', 'pied'],
  comptoir: ['nav', 'hero', 'bandeau', 'apropos', 'services', 'galerie', 'avis', 'infos', 'appel', 'faq', 'contact', 'pied'],
  ecrin: ['nav', 'hero', 'apropos', 'services', 'galerie', 'pourquoi', 'avis', 'etapes', 'appel', 'infos', 'faq', 'contact', 'pied'],
  cabinet: ['nav', 'hero', 'bandeau', 'services', 'pourquoi', 'apropos', 'etapes', 'avis', 'appel', 'infos', 'faq', 'contact', 'pied'],
  horizon: ['nav', 'hero', 'bandeau', 'services', 'apropos', 'galerie', 'pourquoi', 'avis', 'etapes', 'appel', 'infos', 'faq', 'contact', 'pied'],
  verdure: ['nav', 'hero', 'services', 'pourquoi', 'galerie', 'apropos', 'etapes', 'avis', 'appel', 'infos', 'faq', 'contact', 'pied'],
  boutique: ['nav', 'hero', 'bandeau', 'services', 'apropos', 'galerie', 'avis', 'infos', 'appel', 'faq', 'contact', 'pied']
};
const OBLIGATOIRES = { nav: true, hero: true, contact: true, pied: true };
// la fin de page ne répète pas trois fois le même appel : la rubrique contact vient toujours juste avant le pied, donc
// les pieds qui portent une grande invitation à appeler passent après les autres, et des infos juste avant le contact
// prennent plutôt une variante sans boutons
const PIED_APPEL = { 'pied.appel': true, 'pied.photo': true };
const INFOS_BOUTONS = { 'infos.ouvert': true, 'infos.zone': true };
// les bandeaux qui remontent sur le bas du haut de page, et les hauts de page qui occupent eux-mêmes ce bord
const CHEVAUCHENT = { 'bandeau.chevauche': true, 'bandeau.atouts': true };
const BORD_OCCUPE = { 'hero.vitrine': true };
// la signature de chaque famille : fonds qui lui vont, découpes, boutons, tempo
const STYLES = {
  atelier: { fonds: ['grille', 'diagonales', 'points', 'motif', 'halo'], transitions: ['biais', 'marche', null], boutons: ['glisse', 'fleche', 'plein'], mouvement: 'nette' },
  garage: { fonds: ['diagonales', 'grille', 'halo', 'degrade'], transitions: ['biais', 'dents', null], boutons: ['glisse', 'plein', 'fleche'], mouvement: 'nette' },
  comptoir: { fonds: ['grain', 'rayons', 'carreaux', 'motif'], transitions: ['courbe', 'vague', null], boutons: ['pilule', 'glisse', 'brillance'], mouvement: 'vive' },
  ecrin: { fonds: ['lignes', 'grain', 'aurore'], transitions: ['courbe', null], boutons: ['brillance', 'contour', 'pilule'], mouvement: 'douce' },
  cabinet: { fonds: ['points', 'grille', 'lignes', 'maille'], transitions: [null, 'courbe'], boutons: ['fleche', 'contour', 'glisse'], mouvement: 'douce' },
  horizon: { fonds: ['topo', 'vagues', 'aurore', 'rayons'], transitions: ['vague', 'houle', 'courbe'], boutons: ['brillance', 'pilule', 'fleche'], mouvement: 'douce' },
  verdure: { fonds: ['topo', 'motif', 'points', 'grain'], transitions: ['courbe', 'vague', null], boutons: ['pilule', 'glisse', 'fleche'], mouvement: 'vive' },
  boutique: { fonds: ['carreaux', 'rayons', 'points', 'maille'], transitions: ['dents', 'biais', null], boutons: ['plein', 'glisse', 'pilule'], mouvement: 'vive' }
};
const BOUTONS = ['glisse', 'fleche', 'brillance', 'pilule', 'contour', 'plein'];
const MOUVEMENTS = ['douce', 'nette', 'vive'];
const AMBIANCE_MOUVEMENT = { franc: 'nette', calme: 'douce', chaleureux: 'vive', premium: 'douce' };

function choisir(rng, liste, poids) {
  if (!liste.length) return null;
  const p = liste.map(function (x) { return Math.max(0, poids ? poids(x) : 1); });
  const total = p.reduce(function (a, b) { return a + b; }, 0);
  if (!total) return liste[Math.floor(rng() * liste.length)];
  let r = rng() * total;
  for (let k = 0; k < liste.length; k++) { r -= p[k]; if (r <= 0) return liste[k]; }
  return liste[liste.length - 1];
}
function famille(ctx) { return (ctx.da && ctx.da.modele) || 'atelier'; }
function ambianceDe(spec, ctx, voulu) { return B.AMBIANCES.indexOf(voulu) >= 0 ? voulu : (B.AMBIANCES.indexOf(spec.ton) >= 0 ? spec.ton : 'franc'); }

// les variantes possibles d'une rubrique pour cette fiche, avec leur poids
function candidates(r, spec, ctx, amb, recents, deja, eviter, suivante) {
  const fam = famille(ctx);
  return B.PAR_RUBRIQUE[r].filter(function (v) { return B.possible(v, spec, ctx); }).map(function (v) {
    let w = 1;
    if (v.familles.length) w *= v.familles.indexOf(fam) >= 0 ? 3 : 0.12;
    if (v.ambiances.length) w *= v.ambiances.indexOf(amb) >= 0 ? 1.7 : 0.7;
    // jamais la même chose qu'un voisin du même métier (ou de la même commune) si on peut
    const vus = recents.filter(function (c) { return c && c.choix && c.choix[r] === v.id; }).length;
    w *= Math.pow(0.22, vus);
    if (deja && deja[v.id]) w *= 0.05;
    // écartée par la critique (ou par Louis) : seulement s'il n'y a rien d'autre
    if (eviter && eviter.indexOf(v.id) >= 0) w *= 0.001;
    // ce qu'une autre rubrique montre déjà (les atouts dans le bandeau ou la présentation) ne se montre pas deux fois
    if (deja && deja.inclus && (v.inclut || []).some(function (x) { return deja.inclus[x]; })) w = 0;
    // un seul ruban qui défile par page (deux bandes inclinées rapprochées se marchent dessus)
    if (deja && deja.ruban && /defile|ruban/.test(v.id)) w *= 0.04;
    // le socle reste un dernier recours quand la bibliothèque propose mieux
    if (v.socle) w *= 0.35;
    if (r === 'pied' && PIED_APPEL[v.id]) w *= 0.03;
    if (r === 'bandeau' && CHEVAUCHENT[v.id] && deja && Object.keys(BORD_OCCUPE).some(function (id) { return deja[id]; })) w = 0;
    // un haut de page qui montre déjà les photos des services (hero.vitrine) : des services sans photo ensuite
    if (r === 'services' && deja && deja['hero.vitrine'] && v.photo !== 'non') w *= 0.06;
    if (r === 'infos' && suivante === 'contact' && INFOS_BOUTONS[v.id]) w *= 0.3;
    // une photo est là : les hauts de page sans photo passent après ; elle manque : seuls ceux qui s'en passent restent
    if (r === 'hero' && v.photo === 'non' && ctx.alloc && ctx.alloc.hero) w *= 0.04;
    return { v: v, w: w };
  });
}

// la surface d'un bloc : dans celles que la variante sait faire, celle qui change de la précédente, peu de bandes sombres
function surfaceDe(v, prec, sombres, r) {
  const ok = v.surfaces.slice();
  const prendre = function (s) { return ok.indexOf(s) >= 0 ? s : null; };
  if (r === 'pied') return prendre('champ') || ok[0];
  if (r === 'appel') return (prec !== 'accent' && prendre('accent')) || (prec !== 'champ' && prendre('champ')) || ok.find(function (s) { return s !== prec; }) || ok[0];
  const pref = ok.filter(function (s) { return s !== prec && s !== 'photo' && !(s === 'champ' && (sombres >= 2 || prec === 'champ')) && s !== 'accent'; });
  if (pref.length) return pref[0];
  return ok.find(function (s) { return s !== 'photo' || v.rubrique === 'hero'; }) || ok[0];
}

// opts = { recents: [compositions des voisins], choix: { rubrique: id } (le constructeur), essai }
function composer(spec, ctx, opts) {
  opts = opts || {};
  spec = spec || {};
  const fam = famille(ctx);
  const st = STYLES[fam] || STYLES.atelier;
  const voulu = Object.assign({}, (spec.compo && spec.compo.choix) || {}, opts.choix || {});
  const amb = ambianceDe(spec, ctx, voulu.ambiance || (spec.compo && spec.compo.ambiance));
  const rng = T.tirage(T.hash([spec.nom, spec.commune, spec.secteur || spec.activite, opts.essai || 0, 'compo'].join('|')));
  const recents = (opts.recents || []).filter(Boolean);
  const blocs = [], choix = {}, deja = {};
  const recette = RECETTES[fam] || RECETTES.atelier;
  const inclus = {};
  deja.inclus = inclus;
  // la rubrique qui suivra (la prochaine de la recette dont le contenu existe)
  const presente = function (r) { return B.PAR_RUBRIQUE[r].some(function (v) { return B.possible(v, spec, ctx); }); };
  const suivanteDe = function (k) { for (let j = k + 1; j < recette.length; j++) if (presente(recette[j])) return recette[j]; return null; };
  recette.forEach(function (r, kr) {
    if (r === 'pourquoi' && inclus.atouts) return;
    const cands = candidates(r, spec, ctx, amb, recents, deja, (opts.eviter || []).concat((spec.compo && spec.compo.eviter) || []), suivanteDe(kr));
    if (!cands.length) return;
    let v = null;
    const demande = voulu[r] && B.VARIANTES[voulu[r]];
    // ce que le constructeur a demandé, s'il tient avec le contenu (un haut de page sans photo ne garde pas sa place quand
    // une photo est arrivée depuis)
    if (demande && demande.rubrique === r && cands.some(function (c) { return c.v === demande; }) && !(r === 'hero' && demande.photo === 'non' && ctx.alloc && ctx.alloc.hero) && (opts.eviter || []).indexOf(demande.id) < 0) v = demande;
    if (!v) { const c = choisir(rng, cands, function (x) { return x.w; }); v = c && c.v; }
    if (!v) return;
    // une rubrique facultative au contenu maigre n'apparaît pas (la variante le dit par son besoin)
    choix[r] = v.id; deja[v.id] = true;
    if (/defile|ruban/.test(v.id)) deja.ruban = true;
    (v.inclut || []).forEach(function (x) { inclus[x] = true; });
    blocs.push({ rubrique: r, id: v.id });
  });
  // une variante venue après « pourquoi » a montré les atouts : la section « pourquoi » s'efface (jamais deux fois)
  if (inclus.atouts && choix.pourquoi && !(B.VARIANTES[choix.pourquoi].inclut || []).length) {
    const k = blocs.findIndex(function (b) { return b.rubrique === 'pourquoi'; });
    if (k >= 0 && blocs.some(function (b, j) { return j !== k && (B.VARIANTES[b.id].inclut || []).indexOf('atouts') >= 0; })) { blocs.splice(k, 1); delete choix.pourquoi; }
  }
  // la bande d'appel collée à la rubrique contact (faq et infos absentes) remonte d'un cran : deux appels de suite, jamais
  const ka = blocs.findIndex(function (b) { return b.rubrique === 'appel'; });
  if (ka > 2 && blocs[ka + 1] && blocs[ka + 1].rubrique === 'contact' && ['hero', 'nav', 'bandeau'].indexOf(blocs[ka - 1].rubrique) < 0) { const x = blocs[ka]; blocs[ka] = blocs[ka - 1]; blocs[ka - 1] = x; }
  OBLIGATOIRES && Object.keys(OBLIGATOIRES).forEach(function (r) {
    if (!choix[r] && B.PAR_RUBRIQUE[r].length) { const v = B.PAR_RUBRIQUE[r].find(function (x) { return x.socle; }) || B.PAR_RUBRIQUE[r][0]; choix[r] = v.id; blocs.splice(r === 'nav' ? 0 : r === 'hero' ? 1 : r === 'pied' ? blocs.length : Math.max(0, blocs.length - 1), 0, { rubrique: r, id: v.id }); }
  });
  // le rythme des surfaces
  let prec = null, sombres = 0;
  blocs.forEach(function (b) {
    const v = B.VARIANTES[b.id];
    if (b.rubrique === 'nav') { b.surface = 'fond'; return; }
    b.surface = surfaceDe(v, prec, sombres, b.rubrique);
    if (b.surface === 'champ') sombres++;
    prec = b.surface;
  });
  const hero = blocs.find(function (b) { return b.rubrique === 'hero'; });
  const nav = blocs.find(function (b) { return b.rubrique === 'nav'; });
  if (nav && hero && hero.surface === 'photo' && !(B.VARIANTES[hero.id].sousNav === false)) nav.surPhoto = true;
  // les fonds : la signature de la famille sur le haut de page sans photo et sur les bandes sombres, un fond léger ailleurs
  const signature = voulu.fond && FD.FONDS[voulu.fond] ? voulu.fond : choisir(rng, st.fonds, function (f) { return Math.pow(0.3, recents.filter(function (c) { return c && c.fond === f; }).length); });
  let poses = 0;
  blocs.forEach(function (b, k) {
    const v = B.VARIANTES[b.id];
    if (v.fonds === false || b.rubrique === 'nav') return;
    if (b.rubrique === 'hero' && b.surface !== 'photo') { b.fond = ['maille', 'aurore', 'halo'].indexOf(signature) >= 0 ? signature : (fam === 'ecrin' || fam === 'cabinet' ? 'aurore' : 'maille'); poses++; return; }
    if (poses >= 4) return;
    if (b.surface === 'champ' && b.rubrique !== 'pied') { b.fond = signature === 'grain' ? 'grain' : (['halo', 'degrade', 'aurore', 'maille'].indexOf(signature) >= 0 ? signature : signature); poses++; return; }
    if (b.surface === 'accent' && b.rubrique === 'appel') { b.fond = ['rayons', 'motif', 'diagonales', 'topo', 'vagues'].indexOf(signature) >= 0 ? signature : 'maille'; poses++; return; }
    if (b.rubrique === 'pied') { b.fond = 'grain'; return; }
    if ((b.surface === 'surface' || b.surface === 'fond') && k > 2 && poses < 3 && ['points', 'grille', 'topo', 'motif', 'carreaux', 'lignes', 'vagues'].indexOf(signature) >= 0 && rng() < 0.4) { b.fond = signature; poses++; }
  });
  // les découpes entre blocs de surfaces différentes (jamais contre une photo), trois au plus
  const tr = voulu.transition !== undefined && (voulu.transition === null || FD.TRANSITIONS[voulu.transition]) ? voulu.transition : choisir(rng, st.transitions.map(function (x) { return x || 'aucune'; }), function () { return 1; });
  const type = tr === 'aucune' ? null : tr;
  if (type) {
    let n = 0;
    for (let k = 2; k < blocs.length && n < 3; k++) {
      const a = blocs[k - 1], b = blocs[k];
      if (a.surface === 'photo' || b.surface === 'photo' || a.surface === b.surface || b.rubrique === 'pied' || a.rubrique === 'hero' || B.VARIANTES[a.id].decoupe === false || B.VARIANTES[b.id].decoupe === false) continue;
      b.decoupe = type; n++;
    }
  }
  const boutons = BOUTONS.indexOf(voulu.boutons) >= 0 ? voulu.boutons : choisir(rng, st.boutons, function (x) { return Math.pow(0.4, recents.filter(function (c) { return c && c.boutons === x; }).length); });
  const mouvement = MOUVEMENTS.indexOf(voulu.mouvement) >= 0 ? voulu.mouvement : (AMBIANCE_MOUVEMENT[amb] || st.mouvement);
  return { v: VERSION, ambiance: amb, boutons: boutons, mouvement: mouvement, fond: signature, transition: type, choix: Object.assign(choix, amb ? { ambiance: amb } : {}), blocs: blocs, essai: opts.essai || 0, concept: (spec.compo && spec.compo.concept) || undefined };
}

// la composition rangée dans la fiche tient-elle encore ? (variantes connues et possibles avec le contenu d'aujourd'hui)
function valide(compo, spec, ctx) {
  if (!compo || compo.v !== VERSION || !Array.isArray(compo.blocs) || !compo.blocs.length) return false;
  return compo.blocs.every(function (b) { const v = B.VARIANTES[b.id]; return v && v.rubrique === b.rubrique && B.possible(v, spec, ctx); }) && ['nav', 'hero', 'contact', 'pied'].every(function (r) { return compo.blocs.some(function (b) { return b.rubrique === r; }); });
}
// la signature d'une composition, pour comparer deux voisins
function signature(c) { return c && c.choix ? [c.choix.hero, c.choix.services, c.boutons, c.fond].join('|') : ''; }

module.exports = { composer, valide, signature, RECETTES, STYLES, BOUTONS, MOUVEMENTS, VERSION };
