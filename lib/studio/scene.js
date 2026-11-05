// La scène 3D d'une vidéo Mécanique : ce qu'Oscar a le droit d'écrire (le kit de l'usine) et la vérification avant
// rendu. Une scène refusée revient à Oscar avec la liste exacte des erreurs.
'use strict';

const TYPES = {
  boite: 'taille [l,h,p], arrondi',
  cylindre: 'rayon, hauteur, axe x|y|z, creux (épaisseur de paroi, tube), rayon_bas',
  sphere: 'rayon',
  cone: 'rayon, hauteur, axe',
  tore: 'rayon, tube, axe',
  capsule: 'rayon, hauteur, axe',
  groupe: 'aucun : un repère pour poser d\'autres pièces dedans (parent)',
  tuyau: 'points [[x,y,z],...] (2 à 12, coordonnées du monde), rayon, flux {couleur} : un tube de verre où circule un fluide lumineux (action flux)',
  serpentin: 'largeur, hauteur, rangs (pair), rayon, ailettes, plan xy|zy|xz, flux {couleur} : échangeur à ailettes ; entrée en haut à droite (+largeur/2, +hauteur/2), sortie en bas à droite (+largeur/2, -hauteur/2), en local',
  particules: 'forme disque|boite, rayon ou taille [l,h,p], direction [x,y,z], longueur (distance parcourue), couleur, nombre (90), style trainees|points : air, chaleur, fumée, gouttes (action flux)',
  jet_eau: 'direction [vx,vy,vz] (vitesse de sortie), gravite, nombre, dispersion, couleur : un jet en parabole (action flux)',
  eau: 'forme cylindre|boite, rayon, hauteur ou taille : un volume d\'eau',
  fleche: 'de [x,y,z], vers [x,y,z], couleur, rayon : une flèche lumineuse (action flux pour la faire vivre)',
  engrenage: 'dents, module (taille des dents, 0.04), epaisseur, axe (z par défaut), entraine_par {objet, mode engrene|axe} : la roue menée tourne seule, au bon rapport',
  ventilateur: 'rayon, pales, inclinaison, carenage (true) ; tourne autour de z',
  rouleau: 'rayon, longueur, axe, pales : ventilateur tangentiel (clim murale)',
  ressort: 'rayon, longueur, spires, fil, axe (action compresser)',
  vis: 'rayon, longueur, pas, arbre, axe (x par défaut) : vis d\'Archimède, convoyeur',
  piston_bielle: 'course, alesage, bielle, mode moteur|pompe : vilebrequin, bielle, piston et chemise de verre, explosion au point mort haut (mode moteur) ; action tourner = tours par seconde du vilebrequin',
  compresseur: 'rayon, hauteur : coque, moteur et spirales qui orbitent (rendre la coque transparente pour voir dedans)',
  detendeur: 'taille, axe : vanne de détente en laiton, l\'étranglement s\'allume avec flux',
  pompe: 'rayon, epaisseur, axe : pompe centrifuge, volute et roue à aubes',
  roue_coupe: 'rayon, axe (z), molettes : roue de coupe de tunnelier',
  moteur_electrique: 'rayon, longueur, axe : stator bobiné et rotor',
  turbine: 'rayon, longueur, etages, axe (x) : arbre et étages d\'aubes sous une coque de verre',
  roue: 'rayon, largeur, axe (x) : pneu et jante'
};
const MATIERES = ['acier', 'acier_sombre', 'chrome', 'alu', 'cuivre', 'laiton', 'or', 'fonte', 'plastique', 'peinture', 'caoutchouc', 'verre', 'eau', 'beton', 'roche', 'terre', 'bois', 'lueur', 'fantome'];
const COULEURS = ['chaud', 'brulant', 'tiede', 'froid', 'glace', 'eau', 'air', 'huile', 'gaz', 'electrique', 'accent', 'blanc', 'noir', 'rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet', 'gris'];
const ACTIONS = ['tourner', 'arreter', 'flux', 'deplacer', 'transparent', 'opaque', 'couleur', 'compresser', 'montrer', 'cacher'];
const MOUVEMENTS = ['orbite', 'avance', 'recule', 'monte', 'descend', 'fixe'];
const FONDS = ['nuit', 'studio', 'bleu', 'ardoise', 'clair'];

const estVec = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && isFinite(x) && Math.abs(x) <= 30);
const ID = /^[a-z][a-z0-9_]{0,29}$/;

// rend { ok, erreurs[], scene } ; la scène est nettoyée (rien d'inconnu ne passe au moteur)
function verifier(scene, nbBeats) {
  const err = [];
  if (!scene || typeof scene !== 'object') return { ok: false, erreurs: ['la scène doit être un objet { style, objets, plans }'] };
  const objets = Array.isArray(scene.objets) ? scene.objets : [];
  const plans = Array.isArray(scene.plans) ? scene.plans : [];
  if (objets.length < 3 || objets.length > 45) err.push('entre 3 et 45 objets (ici ' + objets.length + ')');
  const ids = new Set();
  const propres = [];
  objets.forEach((o, i) => {
    const ou = 'objet n°' + (i + 1) + (o && o.id ? ' (' + o.id + ')' : '');
    if (!o || !ID.test(String(o.id || ''))) { err.push(ou + ' : id manquant ou invalide (minuscules, chiffres, _)'); return; }
    if (ids.has(o.id)) { err.push(ou + ' : id en double'); return; }
    if (!TYPES[o.type]) { err.push(ou + ' : type inconnu « ' + o.type + ' »'); return; }
    ids.add(o.id);
    if (o.pos != null && !estVec(o.pos)) err.push(ou + ' : pos doit être [x,y,z] en mètres');
    if (o.rot != null && !estVec(o.rot)) err.push(ou + ' : rot doit être [x,y,z] en degrés');
    const p = o.params && typeof o.params === 'object' ? o.params : {};
    if (p.matiere && MATIERES.indexOf(p.matiere) < 0) err.push(ou + ' : matière inconnue « ' + p.matiere + ' »');
    if (o.type === 'tuyau' && (!Array.isArray(p.points) || p.points.length < 2 || p.points.length > 14 || !p.points.every(estVec))) err.push(ou + ' : un tuyau a 2 à 14 points [x,y,z]');
    if (o.type === 'fleche' && (!estVec(p.de) || !estVec(p.vers))) err.push(ou + ' : une flèche a de [x,y,z] et vers [x,y,z]');
    propres.push({ id: o.id, type: o.type, parent: o.parent || undefined, pos: o.pos, rot: o.rot, echelle: o.echelle, visible: o.visible, ancre: estVec(o.ancre) ? o.ancre : undefined, params: p });
  });
  propres.forEach((o) => {
    if (o.parent && !ids.has(o.parent)) err.push(o.id + ' : parent « ' + o.parent + ' » inconnu');
    const e = o.params.entraine_par;
    if (e && (!ids.has(e.objet) || e.objet === o.id)) err.push(o.id + ' : entraine_par vise « ' + (e && e.objet) + ' », inconnu');
  });
  // pas de boucle de parents
  const par = {}; propres.forEach((o) => { par[o.id] = o.parent; });
  propres.forEach((o) => { let x = o.parent, n = 0; while (x && n < 50) { if (x === o.id) { err.push(o.id + ' : boucle de parents'); break; } x = par[x]; n++; } });
  if (nbBeats && plans.length !== nbBeats) err.push('il faut exactement un plan par phrase du script : ' + nbBeats + ' plans (ici ' + plans.length + ')');
  const connu = (x) => typeof x === 'string' && ids.has(x);
  const plansPropres = plans.map((pl, i) => {
    const ou = 'plan ' + (i + 1);
    pl = pl && typeof pl === 'object' ? pl : {};
    const cam = pl.camera && typeof pl.camera === 'object' ? pl.camera : {};
    const c = cam.cible;
    if (c != null && !(c === 'tout' || connu(c) || estVec(c) || (Array.isArray(c) && c.length && c.every(connu)))) err.push(ou + ' : cible de caméra inconnue ' + JSON.stringify(c));
    if (cam.mouvement && MOUVEMENTS.indexOf(cam.mouvement) < 0) err.push(ou + ' : mouvement inconnu « ' + cam.mouvement + ' »');
    ['montrer', 'cacher', 'isoler', 'surbrillance'].forEach((k) => { if (pl[k] != null && (!Array.isArray(pl[k]) || !pl[k].every(connu))) err.push(ou + ' : ' + k + ' contient un objet inconnu'); });
    (Array.isArray(pl.actions) ? pl.actions : []).forEach((a, j) => {
      if (!a || !connu(a.objet)) err.push(ou + ', action ' + (j + 1) + ' : objet inconnu « ' + (a && a.objet) + ' »');
      else if (ACTIONS.indexOf(a.faire) < 0) err.push(ou + ', action ' + (j + 1) + ' : faire « ' + a.faire + ' » inconnu');
      else if (a.faire === 'deplacer' && !estVec(a.vers)) err.push(ou + ', action ' + (j + 1) + ' : deplacer demande vers [x,y,z]');
    });
    const et = Array.isArray(pl.etiquettes) ? pl.etiquettes : [];
    if (et.length > 3) err.push(ou + ' : 3 étiquettes au plus');
    et.forEach((e) => { if (!e || !connu(e.objet)) err.push(ou + ' : étiquette sur un objet inconnu « ' + (e && e.objet) + ' »'); else if (!e.texte || String(e.texte).length > 28) err.push(ou + ' : étiquette « ' + e.texte + ' » vide ou trop longue (28 signes)'); });
    return { camera: cam, montrer: pl.montrer, cacher: pl.cacher, isoler: pl.isoler, surbrillance: pl.surbrillance, actions: pl.actions || [], etiquettes: et.slice(0, 3) };
  });
  // l'accroche : quelque chose bouge dès la première image
  const p0 = plansPropres[0] || {};
  if (!(p0.actions || []).some((a) => a && (a.faire === 'tourner' || a.faire === 'flux'))) err.push('plan 1 : rien ne bouge à la première image (il faut au moins un tourner ou un flux, c\'est l\'accroche)');
  const style = scene.style && typeof scene.style === 'object' ? scene.style : {};
  const stylePropre = { fond: FONDS.indexOf(style.fond) >= 0 ? style.fond : 'nuit', accent: /^#[0-9a-f]{6}$/i.test(style.accent || '') ? style.accent : '#FFD60A', accent2: /^#[0-9a-f]{6}$/i.test(style.accent2 || '') ? style.accent2 : '#38BDF8', sol: ['socle', 'grille', 'aucun'].indexOf(style.sol) >= 0 ? style.sol : 'socle' };
  return { ok: err.length === 0, erreurs: err.slice(0, 25), scene: { style: stylePropre, objets: propres, plans: plansPropres } };
}

// la notice du kit, donnée à Oscar
function notice() {
  return 'LE KIT (types d\'objets et leurs params) :\n' + Object.keys(TYPES).map((t) => '- ' + t + ' : ' + TYPES[t]).join('\n') +
    '\n\nCHAMPS COMMUNS d\'un objet : id (minuscules), type, pos [x,y,z] (mètres, y vers le haut, sol à y=0), rot [x,y,z] (degrés), echelle, parent (id d\'un objet : la position devient relative à lui), visible (false = caché au départ), ancre [x,y,z] (où pointe l\'étiquette, en local), params { ...propres au type, matiere, couleur }.' +
    '\nMATIÈRES : ' + MATIERES.join(', ') + '. COULEURS NOMMÉES : ' + COULEURS.join(', ') + ' (ou #rrggbb).' +
    '\n\nUN PLAN PAR PHRASE DU SCRIPT : { camera: { cible: "tout" | id | [ids] | [x,y,z], distance (sinon cadrage auto), cadrage (1 = la cible remplit la largeur), azimut (degrés, 0 = de face depuis +z), elevation (degrés), mouvement: ' + MOUVEMENTS.join('|') + ', transition: "coupe" (sinon fondu de caméra) }, actions: [ { objet, faire: ' + ACTIONS.join('|') + ', vitesse (tours/s pour tourner, m/s pour flux), on (flux), vers [x,y,z] (deplacer), valeur (transparent 0..1, compresser), couleur } ], montrer: [ids], cacher: [ids], isoler: [ids] (le reste devient fantôme pendant ce plan), surbrillance: [ids] (la pièce pulse pendant ce plan), etiquettes: [ { objet, texte (28 signes max, dans la langue du script) } ] (3 au plus) }.' +
    '\nLes actions durent jusqu\'à ce qu\'un autre plan les change (une roue qui tourne continue de tourner). Le plan 1 applique ses actions dès la première image.' +
    '\nGros plan sur une pièce : le moteur efface seul ce qui la cache. La caméra ne rentre jamais dans une pièce (distance minimale).' +
    '\n\nSTYLE : { fond: ' + FONDS.join('|') + ', accent: "#FFD60A" (sous-titres), accent2: "#38BDF8" (étiquettes), sol: socle|grille|aucun }.';
}

module.exports = { verifier, notice, TYPES, MATIERES, ACTIONS };
