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
const O = require('./rubriques/outils');

// Version 2 (nov. 2026) : un site d'entreprise locale tient en peu de rubriques, chacune avec un but. Le haut de page dit
// qui et où et donne le bouton ; les services disent quoi ; la présentation dit qui on est (ses atouts y sont, une fois) ;
// ses vraies photos et sa vraie note Google prouvent ; la FAQ répond pour de vrai ; UNE rubrique contact réunit tout
// (moyens, adresse, horaires, zone). Plus de bandeau de « faits » de remplissage, plus de rubrique d'atouts à part,
// plus d'étapes « vous appelez, on vient, on répare », plus de bande d'appel ni d'infos qui répètent le contact.
const VERSION = 2;
// Version 3 (nov. 2026) : un site = un template complet (lib/sites/templates), plus un assemblage de rubriques
const VERSION_TPL = 3;
const RECETTES = {
  atelier: ['nav', 'hero', 'services', 'apropos', 'galerie', 'avis', 'faq', 'contact', 'pied'],
  garage: ['nav', 'hero', 'services', 'galerie', 'apropos', 'avis', 'faq', 'contact', 'pied'],
  comptoir: ['nav', 'hero', 'apropos', 'services', 'galerie', 'avis', 'faq', 'contact', 'pied'],
  ecrin: ['nav', 'hero', 'apropos', 'services', 'galerie', 'avis', 'faq', 'contact', 'pied'],
  cabinet: ['nav', 'hero', 'services', 'apropos', 'avis', 'faq', 'contact', 'pied'],
  horizon: ['nav', 'hero', 'services', 'galerie', 'apropos', 'avis', 'faq', 'contact', 'pied'],
  verdure: ['nav', 'hero', 'services', 'galerie', 'apropos', 'avis', 'faq', 'contact', 'pied'],
  boutique: ['nav', 'hero', 'apropos', 'services', 'galerie', 'avis', 'faq', 'contact', 'pied']
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

// (un poids nul exclut vraiment : si tout est exclu, rien n'est choisi, la rubrique facultative s'efface)
function choisir(rng, liste, poids) {
  if (!liste.length) return null;
  const p = liste.map(function (x) { return Math.max(0, poids ? poids(x) : 1); });
  const total = p.reduce(function (a, b) { return a + b; }, 0);
  if (!total) return null;
  let r = rng() * total;
  for (let k = 0; k < liste.length; k++) { r -= p[k]; if (r <= 0) return liste[k]; }
  return liste[liste.length - 1];
}
function famille(ctx) { return (ctx.da && ctx.da.modele) || 'atelier'; }
function ambianceDe(spec, ctx, voulu) { return B.AMBIANCES.indexOf(voulu) >= 0 ? voulu : (B.AMBIANCES.indexOf(spec.ton) >= 0 ? spec.ton : 'franc'); }

// les variantes possibles d'une rubrique pour cette fiche, avec leur poids
function candidates(r, spec, ctx, amb, recents, deja, eviter, suivante) {
  const fam = famille(ctx);
  return B.PAR_RUBRIQUE[r].filter(function (v) { return !v.x && !B.retiree(v) && B.possible(v, spec, ctx); }).map(function (v) {
    let w = 1;
    // la présentation qui porte aussi les atouts : la seule place des atouts dans un site v2, prise dès qu'il y en a trois
    if (v.id === 'apropos.atouts') w *= 2.4;
    // les cartes à petite icône et la photo sur un aplat décalé : ce qui fait le plus « modèle » ; en dernier recours
    if (v.id === 'services.cartes' && !(ctx.stock && ctx.stock.services >= Math.max(2, O.servicesDe(spec).length))) w *= 0.2;
    if (v.id === 'apropos.photo') w *= 0.35;
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
function composerRubriques(spec, ctx, opts) {
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
    // v2 : plus de motif posé au hasard sur les sections claires (des points, une grille derrière un texte : du décor)
  });
  // les découpes entre blocs de surfaces différentes (jamais contre une photo) : une au plus, et seulement pour les
  // familles douces (mer, table, soins, jardin) ; un artisan, un garage, un cabinet, une boutique gardent des bords nets
  const doux = ['comptoir', 'ecrin', 'horizon', 'verdure'].indexOf(fam) >= 0;
  const tr = !doux ? 'aucune' : voulu.transition !== undefined && (voulu.transition === null || FD.TRANSITIONS[voulu.transition]) ? voulu.transition : choisir(rng, st.transitions.map(function (x) { return x || 'aucune'; }), function () { return 1; });
  const type = tr === 'aucune' ? null : tr;
  if (type) {
    let n = 0;
    for (let k = 2; k < blocs.length && n < 1; k++) {
      const a = blocs[k - 1], b = blocs[k];
      if (a.surface === 'photo' || b.surface === 'photo' || a.surface === b.surface || b.rubrique === 'pied' || a.rubrique === 'hero' || B.VARIANTES[a.id].decoupe === false || B.VARIANTES[b.id].decoupe === false) continue;
      b.decoupe = type; n++;
    }
  }
  const boutons = BOUTONS.indexOf(voulu.boutons) >= 0 ? voulu.boutons : choisir(rng, st.boutons, function (x) { return Math.pow(0.4, recents.filter(function (c) { return c && c.boutons === x; }).length); });
  const mouvement = MOUVEMENTS.indexOf(voulu.mouvement) >= 0 ? voulu.mouvement : (AMBIANCE_MOUVEMENT[amb] || st.mouvement);
  return { v: VERSION, ambiance: amb, boutons: boutons, mouvement: mouvement, fond: signature, transition: type, choix: Object.assign(choix, amb ? { ambiance: amb } : {}), blocs: blocs, essai: opts.essai || 0, concept: (spec.compo && spec.compo.concept) || undefined };
}

/* ── les templates (v3) ── */
// Le template d'un site : celui que le constructeur ou Louis a demandé s'il n'est pas écarté, sinon un template de sa
// famille de métier (les autres seulement à défaut), jamais celui d'un voisin du même métier, jamais un template écarté
// par la critique ; sans photo, ceux qui sont faits pour s'en passer d'abord. Même fiche, même template.
function sectionPour(liste, spec, ctx, ecartees) {
  const ok = function (id) { const v = B.VARIANTES[id]; return v && v.x && B.possible(v, spec, ctx) ? v : null; };
  for (const id of liste || []) { if (ecartees && ecartees.indexOf(id) >= 0) continue; const v = ok(id); if (v) return v; }
  // tout est écarté : la première possible quand même (une rubrique obligatoire ne disparaît pas)
  for (const id of liste || []) { const v = ok(id); if (v) return v; }
  return null;
}
function composer(spec, ctx, opts) {
  opts = opts || {};
  spec = spec || {};
  const TP = require('./templates');
  const fam = famille(ctx);
  const voulu = Object.assign({}, (spec.compo && spec.compo.choix) || {}, opts.choix || {});
  const tous = (opts.eviter || []).concat((spec.compo && spec.compo.eviter) || []).map(String);
  // écartés par la critique ou par Louis : des templates (tpl:id) et des sections (rubrique.x-nom)
  const eviter = tous.filter(function (x) { return /^tpl:/.test(x) || !/\./.test(x); }).map(function (x) { return x.replace(/^tpl:/, ''); });
  const ecartees = tous.filter(function (x) { return /\./.test(x); });
  const recents = (opts.recents || []).filter(Boolean);
  const rng = T.tirage(T.hash([spec.nom, spec.commune, spec.secteur || spec.activite, opts.essai || 0, 'tpl'].join('|')));
  const sansPhoto = !(ctx.alloc && ctx.alloc.hero);
  let cands = TP.TEMPLATES.filter(function (x) { return eviter.indexOf(x.id) < 0; });
  if (!cands.length) cands = TP.TEMPLATES.slice();
  let tpl = voulu.template && TP.PAR_ID[voulu.template] && eviter.indexOf(voulu.template) < 0 ? TP.PAR_ID[voulu.template] : null;
  if (!tpl) {
    const c = choisir(rng, cands, function (x) {
      // un template fait pour son métier d'abord, jamais celui d'un voisin tant qu'il en reste un libre ; quand tous ont servi,
      // le moins repris de son métier plutôt qu'un template d'un autre métier
      let w = x.familles.indexOf(fam) >= 0 ? (x.familles[0] === fam ? 5 : 3.5) : 0.0001;
      const vus = recents.filter(function (r) { return r && (r.template || (r.choix && r.choix.template)) === x.id; }).length;
      w *= vus ? Math.pow(0.04, vus) : 1;
      // sans photo : les templates qui ouvrent sans en avoir besoin passent devant
      const h0 = B.VARIANTES[x.hero[0]];
      if (sansPhoto && h0 && h0.photo === 'oui') w *= 0.35;
      return w;
    });
    tpl = c || cands[0];
  }
  const st = TP.PAR_ID[tpl.id] && require('./templates/styles').PAR_ID[tpl.style];
  const blocs = [];
  tpl.ordre.forEach(function (r) {
    const v = sectionPour(r === 'nav' ? [tpl.nav, 'nav.x-barre'] : tpl[r], spec, ctx, ecartees);
    if (!v) return;
    blocs.push({ rubrique: r, id: v.id });
  });
  // le rythme des fonds : la surface voulue par le template si la section la sait, jamais deux bandes pareilles de suite
  let prec = null;
  blocs.forEach(function (b) {
    const v = B.VARIANTES[b.id];
    if (b.rubrique === 'nav') { b.surface = 'fond'; return; }
    let s = b.rubrique === 'hero' ? v.surfaces[0] : (tpl.surfaces[b.rubrique] && v.surfaces.indexOf(tpl.surfaces[b.rubrique]) >= 0 ? tpl.surfaces[b.rubrique] : v.surfaces[0]);
    if (s === prec && s !== 'photo') s = v.surfaces.find(function (x) { return x !== prec && x !== 'photo' && x !== 'champ' && x !== 'accent'; }) || s;
    b.surface = s; prec = s;
  });
  const hero = blocs.find(function (b) { return b.rubrique === 'hero'; }), nav = blocs.find(function (b) { return b.rubrique === 'nav'; });
  if (nav && hero && hero.surface === 'photo' && B.VARIANTES[hero.id].sousNav !== false) nav.surPhoto = true;
  // les sur-titres numérotés (01 — Services) quand le template le veut
  const numeros = {};
  if (tpl.numeros) { let n = 0; blocs.forEach(function (b) { if (['services', 'apropos', 'galerie', 'avis', 'faq', 'contact'].indexOf(b.rubrique) >= 0) numeros[b.rubrique] = (++n < 10 ? '0' : '') + n; }); }
  const amb = ambianceDe(spec, ctx, voulu.ambiance);
  return { v: VERSION_TPL, template: tpl.id, style: tpl.style, ambiance: amb, boutons: (st && st.boutons) || 'glisse', mouvement: (st && st.mouvement) || 'nette', fond: null, transition: null, numeros: numeros,
    choix: { template: tpl.id, ambiance: amb }, blocs: blocs, essai: opts.essai || 0, eviter: (spec.compo && spec.compo.eviter) || undefined, concept: tpl.idee };
}

// la composition rangée dans la fiche tient-elle encore ? (template connu, sections connues et possibles avec le contenu
// d'aujourd'hui) ; les compositions des moteurs d'avant (rubriques assemblées) sont refaites en template
function valide(compo, spec, ctx) {
  if (!compo || compo.v !== VERSION_TPL || !compo.template || !require('./templates').PAR_ID[compo.template] || !Array.isArray(compo.blocs) || !compo.blocs.length) return false;
  return compo.blocs.every(function (b) { const v = B.VARIANTES[b.id]; return v && v.rubrique === b.rubrique && B.possible(v, spec, ctx); }) && ['nav', 'hero', 'contact', 'pied'].every(function (r) { return compo.blocs.some(function (b) { return b.rubrique === r; }); });
}
// un site commandé ou payé garde son visage quand le moteur change : sa composition telle qu'elle est (les sections devenues
// impossibles avec son contenu d'aujourd'hui retirées), tant que ses sections existent et que l'essentiel y est
function figee(compo, spec, ctx) {
  if (!compo || !Array.isArray(compo.blocs) || !compo.blocs.length) return null;
  if (compo.template && !require('./templates').PAR_ID[compo.template]) return null;
  if (!compo.blocs.every(function (b) { const v = B.VARIANTES[b.id]; return v && v.rubrique === b.rubrique; })) return null;
  const blocs = compo.blocs.filter(function (b) { return B.possible(B.VARIANTES[b.id], spec, ctx); });
  if (!['nav', 'hero', 'contact', 'pied'].every(function (r) { return blocs.some(function (b) { return b.rubrique === r; }); })) return null;
  return blocs.length === compo.blocs.length ? compo : Object.assign({}, compo, { blocs: blocs });
}
// la signature d'une composition, pour comparer deux voisins
function signature(c) { return c && c.template ? 'tpl:' + c.template : c && c.choix ? [c.choix.hero, c.choix.services, c.boutons, c.fond].join('|') : ''; }

module.exports = { composer, composerRubriques, valide, figee, signature, RECETTES, STYLES, BOUTONS, MOUVEMENTS, VERSION, VERSION_TPL };
