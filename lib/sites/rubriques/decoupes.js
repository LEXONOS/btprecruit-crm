// Les découpes des templates (nov. 2026, planche de Louis « shape dividers ») : la forme qui sépare deux sections de
// fonds différents, comme sur les sites des agences (vague, courbe, biais, pointe, nuages, montagnes...). Elle est
// dessinée de la couleur de la section du dessous et posée sur le bas de celle du dessus, par-dessus son fond (une
// couleur ou une photo) : le dessus semble découpé. Hauteur mesurée (jamais plus de 76 px), aucune animation.
// Le template dit laquelle et où (lib/sites/templates : decoupe), l'assembleur vérifie que les deux fonds diffèrent et
// que les sections la permettent (composition.js), le rendu la pose (rendu.js). Deux par page au plus.
//
// Une forme : { nom, quand, h: [min px, vw, max px], vb: hauteur du viewBox (largeur 1440), etire (la forme suit la
// largeur, sinon elle garde ses proportions et se recadre au centre : festons, dents, nuages, gouttes...), sens (la
// forme n'est pas symétrique : elle peut être retournée d'un site à l'autre), calques: [{ d | cercles | trait, o }] }
'use strict';

// les gouttes qui coulent du dessus : chacune son abscisse, sa largeur, sa longueur
function gouttes() {
  const y0 = 16, L = [46, 74, 24, 94, 58, 32, 86, 28, 66, 100, 44, 26, 80, 54, 92, 34, 70, 40];
  let d = 'M0 ' + y0;
  L.forEach(function (lg, k) {
    const cx = 40 + k * 80 + (k % 3) * 9, hw = 10 + (k * 5) % 7, ep = 14 + (k * 7) % 10;
    const a = cx - hw, b = cx + hw, bas = y0 + lg - hw;
    // l'épaule de la goutte se fond dans le bord, la goutte s'affine puis s'arrondit
    d += 'L' + (a - ep) + ' ' + y0 + 'C' + (a - 3) + ' ' + y0 + ' ' + a + ' ' + (y0 + 5) + ' ' + a + ' ' + (y0 + 14) + 'L' + a + ' ' + bas + 'A' + hw + ' ' + hw + ' 0 0 0 ' + b + ' ' + bas + 'L' + b + ' ' + (y0 + 14) + 'C' + b + ' ' + (y0 + 5) + ' ' + (b + 3) + ' ' + y0 + ' ' + (b + ep) + ' ' + y0;
  });
  return d + 'L1440 ' + y0 + 'V120H0Z';
}
// une onde régulière (festons, dentelle) : période p, amplitude a, sur une bande de hauteur vb
function onde(p, a, vb, pointu) {
  const y = vb - a * 2 - 2;
  let d = 'M0 ' + (y + a);
  for (let x = 0; x < 1440; x += p) d += pointu ? 'L' + (x + p / 2) + ' ' + y + 'L' + (x + p) + ' ' + (y + a * 2) : 'Q' + (x + p / 4) + ' ' + y + ' ' + (x + p / 2) + ' ' + (y + a) + 'T' + (x + p) + ' ' + (y + a);
  return d + 'V' + vb + 'H0Z';
}
// les nuages : des bulles qui se chevauchent, de tailles inégales (les grandes montent plus haut), avec des creux où le
// fond du dessus redescend entre deux amas
const NUAGES = (function () {
  const R = [34, 48, 30, 56, 40, 24, 46, 60, 32, 42, 26, 52];
  const out = [];
  for (let k = 0; k * 46 < 1480; k++) { const r = R[k % R.length]; out.push([16 + k * 46, Math.round(114 - r * 0.62), r]); }
  return out;
})();

const FORMES = {
  vague: { nom: 'Vague', quand: 'une seule grande vague, souple : mer, piscines, bien-être, tables en bord de mer', h: [28, 5, 72], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 52C70 70 150 78 216 72C330 62 450 12 605 12C760 12 900 108 1150 112C1290 114 1380 92 1440 80V120H0Z' }] },
  eventail: { nom: 'Éventail', quand: 'un bord net qui se prolonge en voiles transparents vers le centre : soins, cabinets, lieux calmes', h: [22, 3.6, 52], vb: 120, etire: true,
    calques: [{ d: 'M0 22L720 70L1440 22V120H0Z', o: 0.16 }, { d: 'M0 44L720 70L1440 44V120H0Z', o: 0.3 }, { d: 'M0 66L720 70L1440 66V120H0Z', o: 0.5 }, { d: 'M0 96L720 74L1440 96V120H0Z' }] },
  pointe: { nom: 'Pointe', quand: 'le dessus finit en pointe au centre, comme une flèche vers la suite : commerces, ateliers, sites francs', h: [26, 4.6, 66], vb: 120, etire: true,
    calques: [{ d: 'M0 0L720 120L1440 0V120H0Z' }] },
  'biais-voile': { nom: 'Biais voilé', quand: 'un bord en biais doublé d\'un voile transparent : moderne et léger, services, cabinets, agences', h: [24, 4.2, 60], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 34L1440 108V120H0Z', o: 0.32 }, { d: 'M0 70L1440 120H0Z' }] },
  gouttes: { nom: 'Gouttes', quand: 'le dessus qui coule en gouttes : glaciers, sorbets, peinture, boissons, univers gourmand et joyeux', h: [24, 4.4, 64], vb: 120, etire: false,
    calques: [{ d: gouttes() }] },
  courbe: { nom: 'Courbe', quand: 'le dessus arrondi comme un bol : doux et accueillant, soins, tables, jardins, enfance', h: [26, 4.8, 70], vb: 120, etire: true,
    calques: [{ d: 'M0 0C0 92 360 120 720 120C1080 120 1440 92 1440 0V120H0Z' }] },
  pinceau: { nom: 'Pinceau', quand: 'une vague tracée au pinceau, avec ses filets : créateurs, ateliers d\'art, univers artisanal', h: [26, 4.6, 66], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 46C180 86 360 104 560 76C700 56 770 30 910 40C1060 52 1210 76 1440 34V120H0Z' }, { trait: 'M0 30C180 70 360 88 560 60C700 40 770 14 910 24C1060 36 1210 60 1440 18', w: 3, tirets: '180 40 70 120 260 36 90 60' }, { trait: 'M40 38C210 76 380 94 572 68', w: 2, tirets: '90 30 140 60' }] },
  pyramides: { nom: 'Pyramides', quand: 'deux pointes inégales : architecture, bâtiment, sites qui assument des angles', h: [26, 4.6, 66], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 0L360 38L520 16L965 116L1440 0V120H0Z' }] },
  biais: { nom: 'Biais', quand: 'un simple bord en biais : énergique et net, garages, ateliers, sport, commerces', h: [22, 4, 60], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 120L1440 0V120Z' }] },
  fente: { nom: 'Fente', quand: 'un bord droit avec une petite pointe au centre, comme une bulle : discret, pour tous les sites sobres', h: [12, 1.4, 20], vb: 24, etire: false,
    calques: [{ d: 'M0 0H698L720 22L742 0H1440V24H0Z' }] },
  'pointe-decalee': { nom: 'Pointe décalée', quand: 'une pointe vers la gauche, un bord qui remonte : dynamique, agences, boutiques, événements', h: [24, 4.4, 62], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 36L390 120L1440 10V120H0Z' }] },
  festons: { nom: 'Festons', quand: 'une frise de petites ondes régulières : pâtisseries, boulangeries, univers rétro et gourmand', h: [12, 1.6, 22], vb: 40, etire: false,
    calques: [{ d: onde(80, 9, 40) }] },
  livre: { nom: 'Livre', quand: 'deux pages qui se rejoignent en pointe au centre : éditorial, librairies, formation, cabinets', h: [20, 3.4, 50], vb: 120, etire: true,
    calques: [{ d: 'M0 110C380 110 640 100 720 8C800 100 1060 110 1440 110V120H0Z' }] },
  nuages: { nom: 'Nuages', quand: 'une rangée de nuages : enfance, crèches, voyages, univers tendre et léger', h: [30, 5, 76], vb: 120, etire: false,
    calques: [{ cercles: NUAGES, base: 106 }] },
  dentelle: { nom: 'Dentelle', quand: 'une fine frise en dents de scie : tickets, épiceries, boutiques, univers rétro', h: [8, 0.9, 12], vb: 12, etire: false,
    calques: [{ d: onde(16, 4, 12, true) }] },
  montagnes: { nom: 'Montagnes', quand: 'trois crêtes transparentes l\'une devant l\'autre : randonnée, nature, mer, tourisme', h: [34, 6, 84], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 70C110 34 220 30 330 58S560 96 690 60S930 16 1060 44S1300 92 1440 50V120H0Z', o: 0.3 }, { d: 'M0 92C140 60 250 56 390 78S640 108 780 76S1030 40 1170 66S1360 100 1440 84V120H0Z', o: 0.55 }, { d: 'M0 104C160 84 300 82 450 98S730 118 880 100S1160 74 1300 92S1400 108 1440 104V120H0Z' }] },
  'courbe-decalee': { nom: 'Courbe décalée', quand: 'un arrondi plus marqué d\'un côté : élégant, instituts, hôtels, maisons de caractère', h: [26, 4.8, 70], vb: 120, etire: true, sens: true,
    calques: [{ d: 'M0 0C0 84 150 120 430 120C910 120 1250 92 1440 44V120H0Z' }] },
  encoche: { nom: 'Encoche', quand: 'un bord droit avec une petite encoche au centre, qui pointe vers le dessus : discret, sites sobres', h: [12, 1.4, 20], vb: 24, etire: false,
    calques: [{ d: 'M0 22H698L720 0L742 22H1440V24H0Z' }] }
};
const IDS = Object.keys(FORMES);

// le dessin d'une forme (toujours en currentColor : la couleur de la section du dessous)
function svg(id) {
  const f = FORMES[id];
  if (!f) return '';
  const corps = f.calques.map(function (c) {
    const o = c.o ? ' opacity="' + c.o + '"' : '';
    if (c.cercles) return '<g' + o + '>' + c.cercles.map(function (x) { return '<circle cx="' + x[0] + '" cy="' + x[1] + '" r="' + x[2] + '"/>'; }).join('') + '<rect y="' + c.base + '" width="1440" height="' + (f.vb - c.base) + '"/></g>';
    if (c.trait) return '<path d="' + c.trait + '" fill="none" stroke="currentColor" stroke-width="' + c.w + '" stroke-linecap="round" vector-effect="non-scaling-stroke"' + (c.tirets ? ' stroke-dasharray="' + c.tirets + '"' : '') + o + '/>';
    return '<path d="' + c.d + '"' + o + '/>';
  }).join('');
  return '<svg viewBox="0 0 1440 ' + f.vb + '" preserveAspectRatio="' + (f.etire ? 'none' : 'xMidYMax slice') + '" fill="currentColor" focusable="false">' + corps + '</svg>';
}

// La marge libre en bas des sections dont le contenu descend près de leur bord (en px, ordinateur 1440 et téléphone 390),
// mesurée sur les fiches d'exemple le 10 nov. 2026 : une découpe ne se pose sous elles que si elle y tient, avec de quoi
// respirer. Les autres sections gardent leur respiration entière (144 et 84 px) : toutes les formes y tiennent.
const MARGES = {
  'hero.x-plein': [92, 44], 'hero.x-arche': [102, 56], 'hero.x-split': [96, 56], 'hero.x-collage': [109, 41], 'hero.x-fiche': [113, 71], 'hero.x-galets': [120, 71], 'hero.x-tuiles': [137, 56], 'hero.x-degrade': [167, 32],
  'hero.x-cadre': [64, 28], 'hero.x-bande': [60, 26], 'hero.x-centre': [39, 0], 'hero.x-titre': [13, 0], 'hero.x-bloc': [0, 0], 'hero.x-typo': [0, 0],
  'services.x-accordeon': [0, 0], 'apropos.x-double': [139, 47], 'apropos.x-photo': [87, 84], 'avis.x-ligne': [30, 28], 'contact.x-photo': [0, 77]
};
// la forme tient-elle sous cette section ? (sa plus grande hauteur sur ordinateur, sa plus petite sur téléphone)
function tient(id, variante) {
  const f = FORMES[id], m = MARGES[variante];
  return !!f && (!m || (m[0] >= f.h[2] + 8 && m[1] >= f.h[0] + 6));
}

// la couleur d'une surface (celle du dessous : la forme en prend la couleur) ; une photo n'en a pas
const COULEUR = { fond: 'var(--fond)', surface: 'var(--surface)', teinte: 'var(--teinte)', champ: 'var(--champ)', accent: 'var(--accent)' };
// une découpe se pose-t-elle entre ces deux fonds ? (le dessous doit être une couleur, différente du dessus)
function possible(id, dessus, dessous) { return !!(FORMES[id] && COULEUR[dessous] && dessus && dessus !== dessous); }
// la découpe posée entre deux sections ; inv : retournée (pour qu'un site ne soit pas le reflet de son voisin)
function rendre(id, dessus, dessous, inv) {
  if (!possible(id, dessus, dessous)) return '';
  const f = FORMES[id];
  return '<div class="dc dc-' + id + (inv && f.sens ? ' dc-inv' : '') + '" aria-hidden="true" style="color:' + COULEUR[dessous] + '">' + svg(id) + '</div>';
}
// la feuille : seulement les formes posées sur la page
function css(ids) {
  const vus = (ids || []).filter(function (id, k, a) { return FORMES[id] && a.indexOf(id) === k; });
  if (!vus.length) return '';
  return '.dc{position:relative;z-index:3;height:0;overflow-x:clip;pointer-events:none}.dc svg{position:absolute;left:-1px;bottom:-1px;display:block;width:calc(100% + 2px);max-width:none;height:var(--dc-h,48px)}.dc-inv svg{transform:scaleX(-1)}' +
    vus.map(function (id) { const h = FORMES[id].h; return '.dc-' + id + '{--dc-h:clamp(' + h[0] + 'px,' + h[1] + 'vw,' + h[2] + 'px)}'; }).join('') +
    '@media print{.dc{display:none}}';
}
// le catalogue, une ligne par forme (pour le constructeur et la critique)
function catalogue() { return IDS.map(function (id) { return '- ' + id + ' (' + FORMES[id].nom + ') : ' + FORMES[id].quand; }).join('\n'); }

module.exports = { FORMES, IDS, MARGES, svg, rendre, possible, tient, css, catalogue, COULEUR };
