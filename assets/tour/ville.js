// La ville en 3D : une maquette blanche posée sur un socle. Au centre, la tour de verre de la Direction (le Board sur le
// toit) ; devant, le campus de Novalemo : un anneau de bureaux autour d'un parc, ouvert d'un passage vers la tour ;
// autour, les pièces ouvertes des autres maisons et les chantiers des projets à valider.
// Chaque détail dit quelque chose de vrai : un agent assis devant un écran allumé travaille, la lueur au-dessus de sa
// tête dit son état, un fantôme attend un outil. Un message entre deux collègues, c'est l'un qui se lève et va voir
// l'autre ; un ordre, une proposition ou une décision entre gens du campus, c'est une réunion à la table du parc ; un
// message vers une autre maison ou vers Louis, c'est une enveloppe qui vole (dorée pour une décision, rouge pour une
// alerte). Ceux qui n'ont rien à faire font un tour au parc, ou passent voir leur chef.
// La caméra suit des ressorts : glisser avec élan, molette et pincement ancrés sous le doigt, double-clic pour
// s'approcher, clic sur un agent pour le suivre. Les ombres ne se recalculent que quand la maquette bouge, et la
// résolution baisse d'elle-même si l'appareil peine : la ville reste fluide.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

const UP = new THREE.Vector3(0, 1, 0);
const RAD = Math.PI / 180;
const ESPACE = 27;                 // d'un îlot à l'autre
const ILOT = 21;                   // taille d'un îlot
const DEMI = 50;                   // le socle : 100 × 100
const SOL = 0.32;                  // dessus des îlots et des pelouses
const PLANCHER = SOL + 0.45;       // dessus des planchers (campus, pièces)
const PARC = SOL + 0.04;           // dessus des allées
const ELEVATION = 34 * RAD;
const BASE_VUE = 64;               // hauteur visible à zoom 1 (unités du monde)
const ZOOM_MIN = 0.42, ZOOM_MAX = 4.4;
const MARCHE = 2.3;                // unités par seconde

// Le campus de Novalemo : 27 places sur l'anneau, par services. Le passage (225°) regarde la tour.
const CAMPUS = { x: 32.5, z: 32.5, R: 13.6, r: 8.4, siege: 9.95, bureau: 10.9, couloir: 9.05, allee: 5.6, pelouse: 15.5, porte: 225, ouverture: 26, portes: [45, 135, 315] };
CAMPUS.f0 = CAMPUS.porte + CAMPUS.ouverture / 2;
CAMPUS.f1 = CAMPUS.porte - CAMPUS.ouverture / 2 + 360;
const PLACES = 27, PAS_PLACE = (CAMPUS.f1 - CAMPUS.f0) / PLACES;
const angPlace = (i) => CAMPUS.f0 + (i + 0.5) * PAS_PLACE;
// chaque service a sa couleur : son tapis au sol (pâle) et ses agents (franche), comme son enseigne
const SECTEURS = [
  { id: 'direction', nom: 'Direction', debut: 0, places: 6, teinte: '#F4E6C2', ton: '#E2B451', agents: ['dg_novalemo', 'dircom_novalemo', 'rh_novalemo', 'analyste', 'partenaires', 'inbound'] },
  { id: 'production', nom: 'Production des sites', debut: 7, places: 8, teinte: '#E6DEFF', ton: '#A086FF', agents: ['chef_prod', 'portfolio', 'demo', 'da', 'photos', 'critique', 'juridique', 'livraison'] },
  { id: 'prospection', nom: 'Prospection', debut: 16, places: 5, teinte: '#D6F1E5', ton: '#3FBF8C', agents: ['contacts', 'chasse_domaines', 'chasse_maps', 'chasse_registre', 'chasse_reseaux'] },
  { id: 'ecriture', nom: 'Pôle écriture', debut: 22, places: 5, teinte: '#DDE7FF', ton: '#6A8DFF', agents: ['emailing', 'plume', 'redacteur', 'relanceur', 'reponses'] }
];
const BANCS = [0, 100, 170, 270];          // les bancs du parc (angle), deux places chacun
const BANCS_DEHORS = [211, 239];           // près du passage, tournés vers la ville
const TABLE = { r: 3.8, f: 65, rayon: 1.3 };
const ARBRES_PARC = [20, 85, 115, 160, 190, 255, 290, 345];
const ARBRES_PELOUSE = [160, 186, 262, 286];

// Où va chaque entreprise : la tour au centre, Novalemo devant, les chantiers sur les îlots du fond et des côtés
const LOTS = { groupe: [0, 0], novalemo: [CAMPUS.x, CAMPUS.z], studio3d: [0, ESPACE], ecom: [ESPACE, 0], labo: [-ESPACE, 0], conformite: [0, -ESPACE], leads: [ESPACE, -ESPACE], fiches: [-ESPACE, ESPACE], recover: [-ESPACE, -ESPACE] };
const LIBRES = [[-ESPACE, -ESPACE * 1.6], [ESPACE * 1.6, -ESPACE], [-ESPACE * 1.6, ESPACE]];

const C = {
  sol: '#E8EDF5', socle: '#F6F8FB', socleBas: '#D9E1EC', route: '#D6DEEA', marque: '#F8FAFD', trottoir: '#F1F4F9', pave: '#E6ECF4',
  blanc: '#F8FAFC', mur: '#F2F5F9', plancher: '#EDF1F7', bureau: '#FFFFFF', pied: '#C5CFDD', ecran: '#3B4659', chaise: '#D6DEE9',
  arbre: '#DFE8F6', arbreBleu: '#A9C1FF', tronc: '#C9D3E1', plante: '#A6D7BD', pot: '#E3E8F0', beton: '#D8DEE7', echafaud: '#BCC7D8',
  vitre: '#CFDDF6', verre: '#6F98FF', pelouse: '#D3EBDD', pelouseBord: '#C2E1CF', allee: '#F5F7FB', eau: '#A8C6FF'
};

/* ── l'assembleur : des pièces simples fusionnées en un seul maillage coloré par sommet (peu d'appels de dessin) ── */
const BOITE = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18).toNonIndexed();
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8).toNonIndexed();
const DISQUE = new THREE.CylinderGeometry(1, 1, 1, 72).toNonIndexed();
const SPH = new THREE.IcosahedronGeometry(1, 2);
const SPH1 = new THREE.IcosahedronGeometry(1, 1);
const CONE = new THREE.ConeGeometry(1, 1, 16).toNonIndexed();
const IDENT = new THREE.Matrix4();
class Assemblage {
  constructor() { this.p = []; this.n = []; this.c = []; }
  ajouter(geo, m, couleur) {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m), c = new THREE.Color(couleur);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      nv.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); this.n.push(nv.x, nv.y, nv.z);
      this.c.push(c.r, c.g, c.b);
    }
    return this;
  }
  // boîte posée : (x, z) au centre, y = bas
  boite(w, h, d, x, y, z, couleur, ry) {
    return this.ajouter(BOITE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromAxisAngle(UP, ry || 0), new THREE.Vector3(w, h, d)), couleur);
  }
  cylindre(r, h, x, y, z, couleur, fin) { return this.ajouter(fin ? CYL8 : CYL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r)), couleur); }
  disque(r, h, x, y, z, couleur) { return this.ajouter(DISQUE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r)), couleur); }
  boule(r, x, y, z, couleur, sy, grossier) { return this.ajouter(grossier ? SPH1 : SPH, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r * (sy || 1), r)), couleur); }
  cone(r, h, x, y, z, couleur) { return this.ajouter(CONE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r)), couleur); }
  // un morceau d'anneau (centre 0,0), de l'angle f0 à f1 en degrés (0° = +x, 90° = +z), du rayon r1 à r2
  anneau(r1, r2, f0, f1, y, h, couleur) {
    const s = new THREE.Shape();
    if (f1 - f0 >= 359.9) {
      s.absarc(0, 0, r2, 0, Math.PI * 2, false);
      const trou = new THREE.Path(); trou.absarc(0, 0, r1, 0, Math.PI * 2, true); s.holes.push(trou);
    } else {
      const n = Math.max(2, Math.ceil((f1 - f0) / 3));
      for (let i = 0; i <= n; i++) { const f = (f0 + (f1 - f0) * i / n) * RAD; if (i) s.lineTo(r2 * Math.cos(f), -r2 * Math.sin(f)); else s.moveTo(r2 * Math.cos(f), -r2 * Math.sin(f)); }
      for (let i = n; i >= 0; i--) { const f = (f0 + (f1 - f0) * i / n) * RAD; s.lineTo(r1 * Math.cos(f), -r1 * Math.sin(f)); }
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 48 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
    this.ajouter(geo, IDENT, couleur); geo.dispose();
    return this;
  }
  maille(materiau, ombre) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, materiau);
    m.castShadow = ombre !== false; m.receiveShadow = true;
    return m;
  }
  vide() { return !this.p.length; }
}

/* ── textures dessinées une fois ── */
function toile(w, h, dessin) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const rond = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
// Ombre douce au sol sous un bâtiment, un agent, une voiture (la maquette repose vraiment)
const textureOmbre = () => toile(128, 128, (g) => { const d = g.createRadialGradient(64, 64, 8, 64, 64, 64); d.addColorStop(0, 'rgba(20,36,72,0.32)'); d.addColorStop(0.55, 'rgba(20,36,72,0.12)'); d.addColorStop(1, 'rgba(20,36,72,0)'); g.fillStyle = d; g.fillRect(0, 0, 128, 128); });
const textureEcranGeant = (c1, c2) => toile(256, 128, (g) => { const d = g.createLinearGradient(0, 0, 256, 128); d.addColorStop(0, c1); d.addColorStop(1, c2); g.fillStyle = d; g.fillRect(0, 0, 256, 128); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(112, 44); g.lineTo(150, 64); g.lineTo(112, 84); g.closePath(); g.fill(); });
const textureEnveloppe = (c) => toile(96, 72, (g) => {
  g.shadowColor = 'rgba(20,36,72,.28)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  rond(g, 10, 10, 76, 50, 8); g.fillStyle = '#FFFFFF'; g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = 4.5; g.strokeStyle = c; rond(g, 10, 10, 76, 50, 8); g.stroke();
  g.lineJoin = 'round'; g.beginPath(); g.moveTo(14, 15); g.lineTo(48, 41); g.lineTo(82, 15); g.stroke();
});
const texturePoint = (c) => toile(32, 32, (g) => { const d = g.createRadialGradient(16, 16, 0, 16, 16, 16); d.addColorStop(0, c); d.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 32, 32); });
// la bulle « … » de quelqu'un qui parle : trois images, le point fort avance
const textureBulle = (k) => toile(96, 72, (g) => {
  g.shadowColor = 'rgba(20,36,72,.22)'; g.shadowBlur = 7; g.shadowOffsetY = 2;
  rond(g, 8, 8, 80, 44, 20); g.fillStyle = '#FFFFFF'; g.fill();
  g.beginPath(); g.moveTo(36, 50); g.lineTo(46, 64); g.lineTo(52, 50); g.closePath(); g.fill(); g.shadowColor = 'transparent';
  [30, 48, 66].forEach((x, i) => { g.fillStyle = i === k ? '#2B59E8' : '#A9B6CC'; g.beginPath(); g.arc(x, 30, 5.5, 0, Math.PI * 2); g.fill(); });
});

const easeOutBack = (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const hasard = (graine) => { let s = graine % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const borne = THREE.MathUtils.clamp;
const lisse = (a, b, x) => { const t = borne((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ecartAngle = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
// sur l'anneau : 0 à l'entrée du passage, 334 à l'autre bord (le passage lui-même est au-delà : on ne le traverse jamais)
const uDe = (f) => ((f - CAMPUS.f0) % 360 + 360) % 360;
const AMPLEUR = CAMPUS.f1 - CAMPUS.f0;
// orientations sur l'anneau : X local le long de l'anneau, Z local vers le centre ; regarder vers l'extérieur
const ryTangent = (f) => Math.atan2(-Math.cos(f * RAD), -Math.sin(f * RAD));
const ryDehors = (f) => Math.atan2(Math.cos(f * RAD), Math.sin(f * RAD));
const wP = (r, f, y) => new THREE.Vector3(CAMPUS.x + r * Math.cos(f * RAD), y, CAMPUS.z + r * Math.sin(f * RAD));
const cap = (de, vers) => Math.atan2(vers.x - de.x, vers.z - de.z);

export function creerVille(conteneur, rappels) {
  rappels = rappels || {};
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;   // ni marche, ni travellings : tout est posé
  const petit = Math.min(innerWidth, innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const PR_MAX = Math.min(2, devicePixelRatio || 1);
  let pr = PR_MAX;
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;           // recalculées seulement quand la maquette bouge
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  conteneur.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('tabindex', '0');
  const fondu = document.createElement('div'); fondu.className = 'fondu-bord'; conteneur.appendChild(fondu);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 800);
  let ombresSales = true;

  /* lumières */
  const ciel = new THREE.HemisphereLight(0xffffff, 0xcdd6e4, 1.25);
  scene.add(ciel);
  const soleil = new THREE.DirectionalLight(0xffffff, 2.3);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(petit ? 1024 : 2048, petit ? 1024 : 2048);
  const sc = soleil.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 280;
  soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.035; soleil.shadow.radius = 3;
  scene.add(soleil, soleil.target);
  const appoint = new THREE.DirectionalLight(0xdfe8ff, 0.45); appoint.position.set(-60, 40, 50); scene.add(appoint);

  /* matériaux */
  const matBase = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const matVitre = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.05, emissive: new THREE.Color('#FFC27A'), emissiveIntensity: 0 });
  const matVerre = new THREE.MeshStandardMaterial({ color: C.verre, transparent: true, opacity: 0.4, roughness: 0.06, metalness: 0.15, depthWrite: false, emissive: new THREE.Color('#2F5BFF'), emissiveIntensity: 0.04 });
  const matVitreAnneau = new THREE.MeshStandardMaterial({ color: '#DCE8FF', transparent: true, opacity: 0.26, roughness: 0.05, metalness: 0.1, depthWrite: false, emissive: new THREE.Color('#8FB0FF'), emissiveIntensity: 0 });
  const matEau = new THREE.MeshStandardMaterial({ color: C.eau, roughness: 0.12, metalness: 0.08, emissive: new THREE.Color('#5E86FF'), emissiveIntensity: 0.05 });
  const matOmbre = new THREE.MeshBasicMaterial({ map: textureOmbre(), transparent: true, depthWrite: false });
  const matLampe = new THREE.MeshStandardMaterial({ color: '#F8FAFF', emissive: new THREE.Color('#FFD59A'), emissiveIntensity: 0, roughness: 0.4 });
  const matPhare = new THREE.MeshStandardMaterial({ color: '#FFF6DE', emissive: new THREE.Color('#FFE2A8'), emissiveIntensity: 0, roughness: 0.4 });
  const matTuileSite = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const matEcran = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const matSurvol = new THREE.MeshBasicMaterial({ color: '#2B59E8', transparent: true, opacity: 0, depthWrite: false });
  const matTronc = new THREE.MeshStandardMaterial({ color: C.tronc, roughness: 1 });
  const matHouppe = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });

  const monde = new THREE.Group(); scene.add(monde);
  const statique = new THREE.Group(); monde.add(statique);
  const batiments = new Map();       // id -> { groupe, pick, ancre, centre, ... }
  const pickables = [];
  const animes = [];                 // fonctions appelées à chaque image (grues, balise, écran géant, eau)
  const pieces = [];                 // planchers des pièces : où les agents marchent
  let campus = null;
  const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);

  // Arbres instanciés : un tronc et une houppe par arbre, deux appels de dessin par lot
  function bosquet(liste, groupe) {
    if (!liste.length) return;
    const tronc = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 1, 6), matTronc, liste.length);
    const houppe = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), matHouppe, liste.length);
    tronc.castShadow = houppe.castShadow = true; houppe.receiveShadow = true;
    const q = new THREE.Quaternion();
    liste.forEach(function (a, i) {
      const y = a.y != null ? a.y : SOL;
      _m.compose(_v.set(a.x, y + 0.6 * a.s, a.z), q.set(0, 0, 0, 1), _s.set(a.s, 1.2 * a.s, a.s)); tronc.setMatrixAt(i, _m);
      _m.compose(_v.set(a.x, y + 1.9 * a.s, a.z), q.setFromAxisAngle(UP, i * 1.7), _s.set(1.15 * a.s, 1.3 * a.s, 1.15 * a.s)); houppe.setMatrixAt(i, _m);
      houppe.setColorAt(i, new THREE.Color(a.bleu ? C.arbreBleu : C.arbre));
    });
    _s.set(1, 1, 1);
    groupe.add(tronc, houppe);
  }

  /* ── le socle, les rues, la parcelle du campus ── */
  const ROUTES = [-ESPACE * 1.5, -ESPACE / 2, ESPACE / 2, ESPACE * 1.5];
  (function socle() {
    const a = new Assemblage();
    const s = new THREE.Shape(); const R = 8, L = DEMI;
    s.moveTo(-L + R, -L); s.lineTo(L - R, -L); s.quadraticCurveTo(L, -L, L, -L + R); s.lineTo(L, L - R); s.quadraticCurveTo(L, L, L - R, L); s.lineTo(-L + R, L); s.quadraticCurveTo(-L, L, -L, L - R); s.lineTo(-L, -L + R); s.quadraticCurveTo(-L, -L, -L + R, -L);
    const ex = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3, curveSegments: 10 });
    ex.rotateX(-Math.PI / 2); ex.translate(0, -3.6, 0);
    // le dessus du socle un peu plus foncé que ses flancs : on lit la maquette posée
    const coul = new THREE.Color(C.socle), coulBas = new THREE.Color(C.socleBas), coulSol = new THREE.Color(C.sol);
    const pos = ex.attributes.position; const cols = [];
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const c = y > -0.05 ? coulSol : y < -3.2 ? coulBas : coul; cols.push(c.r, c.g, c.b); }
    ex.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(ex, matBase); m.receiveShadow = true; statique.add(m);
    // les rues : une grille entre les îlots ; les deux avenues du devant s'arrêtent au campus
    const largeur = 6, fin = DEMI - 4;
    ROUTES.forEach(function (k) {
      const bout = k === ROUTES[3] ? ESPACE / 2 + 3 : fin;
      const long = bout + fin, milieu = (bout - fin) / 2;
      a.boite(long, 0.06, largeur, milieu, 0, k, C.route);
      a.boite(largeur, 0.061, long, k, 0, milieu, C.route);
      for (let t = -fin + 2; t < bout - 2; t += 4.2) {
        if (ROUTES.some(function (j) { return Math.abs(t - j) < 4; })) continue;     // pas de marquage dans les carrefours
        a.boite(1.6, 0.07, 0.22, t, 0.01, k, C.marque); a.boite(0.22, 0.071, 1.6, k, 0.01, t, C.marque);
      }
    });
    // îlots (trottoirs légèrement surélevés), sauf celui que le campus remplace
    [-ESPACE, 0, ESPACE].forEach(function (x) { [-ESPACE, 0, ESPACE].forEach(function (z) { if (x === ESPACE && z === ESPACE) return; a.boite(ILOT, SOL, ILOT, x, 0, z, C.trottoir); }); });
    // la parcelle du campus, et l'allée qui mène du passage à la tour (avec son passage piéton)
    const p0 = ESPACE / 2 + 3, p1 = DEMI - 2.5;
    a.boite(p1 - p0, SOL - 0.02, p1 - p0, (p0 + p1) / 2, 0, (p0 + p1) / 2, C.trottoir);
    const diag = Math.PI / 4;
    const allee = function (d0, d1, y) { const m2 = (d0 + d1) / 2; a.boite(1.9, 0.05, Math.abs(d1 - d0) * Math.SQRT2, m2, y, m2, C.allee, diag); };
    allee(CAMPUS.x - (CAMPUS.R + 0.2) / Math.SQRT2, p0 + 0.6, SOL - 0.02);
    allee(ESPACE / 2 - 3.1, 7.2, SOL);
    for (let i = -2; i <= 2; i++) a.boite(0.62, 0.075, 4.4, ESPACE / 2 + i * 0.82, 0.01, ESPACE / 2 - i * 0.82, C.marque, diag);
    const rues = a.maille(matBase, false); rues.receiveShadow = true; statique.add(rues);
  })();

  // Arbres, lampadaires, voitures garées
  (function decor() {
    const r = hasard(7), arbres = [], lampes = [];
    const dansCampus = function (x, z) { return x > ESPACE / 2 + 2.5 && z > ESPACE / 2 + 2.5; };
    // la place de la tour
    for (let i = 0; i < 10; i++) {
      const cote = i % 4, t = (r() - 0.5) * (ILOT - 4), d = ILOT / 2 - 1.3;
      arbres.push({ x: cote === 0 ? t : cote === 1 ? d : cote === 2 ? t : -d, z: cote === 0 ? d : cote === 1 ? t : cote === 2 ? -d : t, s: 0.75 + r() * 0.55, bleu: r() < 0.28 });
    }
    // les bords du socle, au-delà des avenues
    for (let t = -DEMI + 6; t < DEMI - 4; t += 6.5) {
      [[t, DEMI - 3.6], [DEMI - 3.6, t], [t, -DEMI + 3.6], [-DEMI + 3.6, t]].forEach(function (p) { if (!dansCampus(p[0], p[1])) arbres.push({ x: p[0], z: p[1], y: 0, s: 0.7 + r() * 0.45, bleu: r() < 0.3 }); });
    }
    for (let t = -DEMI + 8; t < DEMI - 6; t += 7) {
      lampes.push({ x: t + 3.5, z: ESPACE / 2 + 3.4 }, { x: ESPACE / 2 + 3.4, z: t + 3.5 });
    }
    bosquet(arbres, statique);
    const m = new THREE.Matrix4();
    const pied = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6), new THREE.MeshStandardMaterial({ color: '#C9D2E0', roughness: 0.6 }), lampes.length);
    const tete = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 10, 8), matLampe, lampes.length);
    lampes.forEach(function (l, i) { m.makeTranslation(l.x, SOL + 1.7, l.z); pied.setMatrixAt(i, m); m.makeTranslation(l.x, SOL + 3.5, l.z); tete.setMatrixAt(i, m); });
    pied.castShadow = true; statique.add(pied, tete);
    // quelques voitures garées (l'échelle de la maquette), du côté libre des rues
    const v = new Assemblage(); const cv = ['#2B59E8', '#FFFFFF', '#F2B543', '#E9EEF6', '#43C79A', '#3B4659'];
    [[ESPACE / 2 + 1.3, 6], [ESPACE / 2 + 1.3, -9], [-ESPACE / 2 - 1.3, 8], [-6, ESPACE / 2 + 1.3], [6, -ESPACE / 2 - 1.3], [-27, -ESPACE * 1.5 + 1.3]].forEach(function (p, i) {
      const tourne = Math.abs(p[0]) > Math.abs(p[1]) ? 0 : Math.PI / 2;
      v.boite(1.6, 0.75, 3.1, p[0], 0.18, p[1], cv[i], tourne);
      v.boite(1.42, 0.62, 1.7, p[0], 0.9, p[1] + (tourne ? 0 : -0.2), '#E7EDF6', tourne);
    });
    statique.add(v.maille(matBase));
  })();

  /* ── les voitures qui roulent : une boucle sur les avenues, autour du campus ── */
  const voitures = [];
  const route = (function () {
    const P = [[-40.5, -40.5], [40.5, -40.5], [40.5, 13.5], [13.5, 13.5], [13.5, 40.5], [-40.5, 40.5]];
    const pts = [], n = P.length, R = 3.4;
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const d1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], d2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
      const p0 = [b[0] - d1[0] * R, b[1] - d1[1] * R], p2 = [b[0] + d2[0] * R, b[1] + d2[1] * R];
      for (let k = 0; k <= 6; k++) { const t = k / 6, u = 1 - t; pts.push([u * u * p0[0] + 2 * u * t * b[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * b[1] + t * t * p2[1]]); }
    }
    // la voie de droite (vers l'extérieur de la boucle)
    const voie = pts.map(function (p, i) {
      const av = pts[(i + pts.length - 1) % pts.length], ap = pts[(i + 1) % pts.length];
      const tx = ap[0] - av[0], tz = ap[1] - av[1], l = Math.hypot(tx, tz) || 1;
      return new THREE.Vector3(p[0] + (tz / l) * 1.45, 0.06, p[1] - (tx / l) * 1.45);
    });
    const cumul = [0];
    for (let i = 1; i <= voie.length; i++) cumul.push(cumul[i - 1] + voie[i - 1].distanceTo(voie[i % voie.length]));
    return { pts: voie, cumul: cumul, total: cumul[voie.length] };
  })();
  (function rouler() {
    const couleurs = ['#2B59E8', '#F2B543', '#FFFFFF', '#43C79A'];
    couleurs.forEach(function (c, i) {
      const g = new THREE.Group();
      const v = new Assemblage(), l = new Assemblage();
      v.boite(1.55, 0.7, 3.0, 0, 0.16, 0, c); v.boite(1.38, 0.58, 1.6, 0, 0.86, -0.15, '#E7EDF6');
      v.boite(0.3, 0.3, 0.3, -0.55, 0.0, 1.05, '#3B4659'); v.boite(0.3, 0.3, 0.3, 0.55, 0.0, 1.05, '#3B4659'); v.boite(0.3, 0.3, 0.3, -0.55, 0.0, -1.05, '#3B4659'); v.boite(0.3, 0.3, 0.3, 0.55, 0.0, -1.05, '#3B4659');
      l.boite(0.32, 0.16, 0.06, -0.48, 0.5, 1.51, '#FFF6DE'); l.boite(0.32, 0.16, 0.06, 0.48, 0.5, 1.51, '#FFF6DE');
      const corps = v.maille(matBase, false); g.add(corps, l.maille(matPhare, false));
      const o = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.9), matOmbre); o.rotation.x = -Math.PI / 2; o.position.y = 0.075; o.renderOrder = 1; g.add(o);
      monde.add(g);
      voitures.push({ g: g, s: route.total * i / couleurs.length + i * 7, i: 0, vitesse: 3.4 + (i % 2) * 0.5 });
    });
  })();
  function placerVoiture(v) {
    const r = route, s = ((v.s % r.total) + r.total) % r.total;
    while (r.cumul[v.i + 1] < s) v.i = (v.i + 1) % r.pts.length;
    while (r.cumul[v.i] > s) v.i = (v.i + r.pts.length - 1) % r.pts.length;
    const a = r.pts[v.i], b = r.pts[(v.i + 1) % r.pts.length], k = (s - r.cumul[v.i]) / Math.max(1e-6, r.cumul[v.i + 1] - r.cumul[v.i]);
    v.g.position.lerpVectors(a, b, k);
    const ry = Math.atan2(b.x - a.x, b.z - a.z);
    let d = ry - v.g.rotation.y; d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    v.g.rotation.y += v.init ? d * 0.35 : d; v.init = true;
  }
  voitures.forEach(placerVoiture);

  /* ── les bâtiments ── */
  function ombreSol(groupe, w, d, x, z) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, d * 1.5), matOmbre);
    o.rotation.x = -Math.PI / 2; o.position.set(x, 0.34, z); o.renderOrder = 1; groupe.add(o);
  }
  function surbrillance(groupe, geo, y) {
    const m = matSurvol.clone(); m.userData.jetable = true;
    const s = new THREE.Mesh(geo, m);
    s.rotation.x = -Math.PI / 2; s.position.y = y || 0.36; s.renderOrder = 2; groupe.add(s); return s;
  }
  function zonePick(id, type, geo, x, y, z) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    m.position.set(x, y, z); m.updateMatrixWorld(true);
    m.userData = { type: type, id: id }; pickables.push(m); return m;
  }

  // La tour de verre : la Direction du Groupe. Au sommet, le Board : la table où Louis tranche.
  function construireTour(co) {
    const [x, z] = lotDe[co.id] || [0, 0];
    const g = new THREE.Group(); g.position.set(x, SOL, z);
    const a = new Assemblage();
    const W = 11, E = 9, H = 3.2;
    a.boite(W + 3, 0.5, W + 3, 0, 0, 0, C.pave);                       // le parvis
    a.boite(4, E * H, 4, 0, 0.5, 0, '#EEF2F8');                         // le noyau
    for (let k = 0; k <= E; k++) a.boite(W, 0.34, W, 0, 0.5 + k * H - (k ? 0.34 : 0), 0, C.blanc);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (s) { a.boite(0.5, E * H, 0.5, s[0] * (W / 2 - 0.25), 0.5, s[1] * (W / 2 - 0.25), C.blanc); });
    [-1, 1].forEach(function (s) { a.boite(0.22, E * H, 0.22, s * W / 6, 0.5, W / 2 - 0.1, C.blanc); a.boite(0.22, E * H, 0.22, W / 2 - 0.1, 0.5, s * W / 6, C.blanc); });
    // des bureaux visibles derrière le verre, un par étage
    for (let k = 1; k < E; k++) { a.boite(2.4, 0.9, 1, 2.6, 0.5 + k * H, 2.6, '#FFFFFF'); a.boite(1, 0.7, 0.12, 2.6, 0.5 + k * H + 0.9, 2.15, C.ecran); }
    const top = 0.5 + E * H;
    // le Board : terrasse, garde-corps, la table et les chaises, une pergola
    a.boite(W, 0.4, W, 0, top, 0, C.blanc);
    [[0, W / 2 - 0.15, W, 0.3], [0, -W / 2 + 0.15, W, 0.3], [W / 2 - 0.15, 0, 0.3, W], [-W / 2 + 0.15, 0, 0.3, W]].forEach(function (p) { a.boite(p[2], 0.9, p[3], p[0], top + 0.4, p[1], '#E9EEF6'); });
    a.boite(5.2, 0.18, 2.4, 0, top + 1.25, 0, '#FFFFFF'); a.boite(0.3, 0.85, 0.3, -2.2, top + 0.4, 0, C.pied); a.boite(0.3, 0.85, 0.3, 2.2, top + 0.4, 0, C.pied);
    // le siège de Louis, en bout de table (coussin doré)
    a.boite(1, 0.12, 1, 3.6, top + 0.95, 0, '#E5B653'); a.boite(0.14, 1.1, 1, 4.1, top + 0.95, 0, '#E5B653');
    [[-1.8, 1.9], [0, 1.9], [1.8, 1.9], [-1.8, -1.9], [0, -1.9], [1.8, -1.9]].forEach(function (c) { a.boite(0.9, 0.12, 0.9, c[0], top + 0.9, c[1], C.chaise); });
    [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]].forEach(function (c) { a.boite(0.22, 3.2, 0.22, c[0], top + 0.4, c[1], C.blanc); });
    for (let i = -4; i <= 4; i += 1.6) a.boite(0.18, 0.18, 9.4, i, top + 3.6, 0, C.blanc);
    a.cylindre(0.09, 4.6, -3.8, top + 0.4, -3.8, C.pied, true);
    g.add(a.maille(matBase));
    const verre = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, E * H - 0.2, W - 0.4), matVerre); verre.position.y = 0.5 + E * H / 2; verre.renderOrder = 3; g.add(verre);
    const balise = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), new THREE.MeshStandardMaterial({ color: '#F4C45F', emissive: new THREE.Color('#F4B63A'), emissiveIntensity: 0, roughness: 0.3 }));
    balise.material.userData.jetable = true;
    balise.position.set(-3.8, top + 5.25, -3.8); g.add(balise);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.78, 32), new THREE.MeshBasicMaterial({ color: '#F4B63A', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    halo.material.userData.jetable = true;
    halo.position.copy(balise.position); g.add(halo);
    ombreSol(g, W, W, 0, 0);
    const sb = surbrillance(g, new THREE.PlaneGeometry(W + 5.4, W + 5.4));
    monde.add(g);
    const b = { id: co.id, type: 'company', groupe: g, survol: sb, hauteur: top + 5, ancre: new THREE.Vector3(x + W / 2, SOL + top - 5.5, z + W / 2), board: new THREE.Vector3(x, top + 2.3 + SOL, z), balise: balise, halo: halo, decisions: 0, flash: -9,
      centre: new THREE.Vector3(x, 14, z), zoomVue: 1.55, x: x, z: z,
      sieges: [[-1.8, 1.9], [0, 1.9], [1.8, 1.9], [-1.8, -1.9], [0, -1.9], [1.8, -1.9]].map(function (c) { return { x: x + c[0], y: SOL + top + 0.62, z: z + c[1], ry: c[1] > 0 ? Math.PI : 0 }; }), w: W, d: W };
    b.pick = zonePick(co.id, 'company', new THREE.BoxGeometry(W, top, W), x, top / 2, z);
    b.pickToit = zonePick('board', 'roof', new THREE.BoxGeometry(W, 8, W), x, SOL + top + 3, z);
    animes.push(function (t) {
      const on = b.decisions > 0, f = borne(1 - (t - b.flash) / 1.2, 0, 1);
      balise.material.emissiveIntensity = (on ? 1.2 + Math.sin(t * 3.2) * 0.6 : 0.05) + f * 2.2;
      const pouls = 0.5 + 0.5 * Math.sin(t * 3.2), onde2 = f > 0 ? (1 - f) * 2.2 : 0;
      halo.material.opacity = Math.max(on ? 0.55 * pouls : 0, f * 0.9);
      halo.scale.setScalar(1 + (on ? 0.35 * pouls : 0) + onde2);
      halo.lookAt(camera.position);
    });
    return b;
  }

  // Le campus de Novalemo : un anneau ouvert d'un passage vers la tour. Le mur du fond est haut, celui de devant bas :
  // on voit dans les bureaux. Dedans, les services côte à côte, chacun sur son tapis ; au milieu, le parc.
  function construireCampus(co, agentsCo) {
    const K = CAMPUS;
    const g = new THREE.Group(); g.position.set(K.x, 0, K.z);
    const a = new Assemblage(), fen = new Assemblage(), vit = new Assemblage();
    const coul = new THREE.Color(co.color || '#2B59E8'), coulHex = '#' + coul.getHexString();
    const loc = function (r, f) { return [r * Math.cos(f * RAD), r * Math.sin(f * RAD)]; };
    const pl = PLANCHER;
    const hauteurMur = function (f) { return 1.05 + 3.35 * (1 - lisse(70, 112, ecartAngle(f, K.porte))); };
    // la pelouse, le plancher de l'anneau, les tapis des services
    a.disque(K.pelouse, SOL, 0, 0, 0, C.pelouse);
    a.anneau(K.pelouse - 0.5, K.pelouse, 0, 360, SOL, 0.012, C.pelouseBord);
    a.anneau(K.r, K.R, K.f0, K.f1, SOL, 0.45, C.blanc);
    a.anneau(K.r + 0.2, K.R - 0.2, K.f0 + 0.5, K.f1 - 0.5, pl, 0.015, C.plancher);
    SECTEURS.forEach(function (s) {
      const fa = angPlace(s.debut) - PAS_PLACE / 2 + 0.9, fb = angPlace(s.debut + s.places - 1) + PAS_PLACE / 2 - 0.9;
      a.anneau(K.siege - 0.8, K.bureau + 0.8, fa, fb, pl + 0.015, 0.012, s.teinte);
    });
    // le mur extérieur, en segments : haut au fond, bas devant ; fenêtres et bandeau à la couleur de la maison au fond
    for (let f = K.f0; f < K.f1 - 0.01; f += 3) {
      const fm = f + 1.5, h = hauteurMur(fm), ry = ryTangent(fm), larg = 2 * (K.R - 0.16) * Math.sin(1.5 * RAD) + 0.05;
      const [x, z] = loc(K.R - 0.16, fm);
      a.boite(larg, h, 0.32, x, pl, z, C.mur, ry);
      const surMurDesSites = fm > 243 && fm < 287;
      if (h > 3 && !surMurDesSites) {
        const [x2, z2] = loc(K.R - 0.34, fm);
        if (Math.round((fm - K.f0) / 3) % 2 === 0) fen.boite(larg * 0.82, 2.0, 0.05, x2, pl + 1.05, z2, C.vitre, ry);
        if (h > 4.2) a.boite(larg, 0.3, 0.05, x2, pl + 3.55, z2, coulHex, ry);
      }
    }
    // le bord du toit, au fond, et les deux joues du passage
    a.anneau(K.R - 1.5, K.R + 0.05, 150, K.porte - K.ouverture / 2, pl + 4.38, 0.22, C.blanc);
    a.anneau(K.R - 1.5, K.R + 0.05, K.porte + K.ouverture / 2, 300, pl + 4.38, 0.22, C.blanc);
    [K.f0, K.f1].forEach(function (f) { const [x, z] = loc((K.r + K.R) / 2, f); a.boite(K.R - K.r + 0.05, hauteurMur(f) + 0.2, 0.36, x, pl, z, C.blanc, -f * RAD); });
    // la façade de verre sur le parc, ouverte aux trois portes
    for (let f = K.f0; f < K.f1 - 0.01; f += 6) {
      const fm = f + 3;
      if (K.portes.some(function (p) { return ecartAngle(fm, p) < 6.5; })) continue;
      const [x, z] = loc(K.r + 0.12, fm), ry = ryTangent(fm), larg = 2 * (K.r + 0.12) * Math.sin(3 * RAD);
      vit.boite(larg, 2.8, 0.05, x, pl, z, '#FFFFFF', ry);
      a.boite(larg + 0.04, 0.12, 0.16, x, pl + 2.8, z, C.blanc, ry);
      const [px, pz] = loc(K.r + 0.12, f);
      a.boite(0.1, 2.92, 0.12, px, pl, pz, C.blanc, ry);
    }
    // les postes : bureau, écran tourné vers l'agent, chaise côté couloir ; une plante aux places libres
    const places = attribuerPlaces(agentsCo);
    const ecrans = [];
    for (let i = 0; i < PLACES; i++) {
      const f = angPlace(i), ry = ryTangent(f), tg = [-Math.sin(f * RAD), Math.cos(f * RAD)];
      if (!places.utilisees[i]) { const [px, pz] = loc(K.bureau - 0.25, f); a.cylindre(0.36, 0.55, px, pl, pz, C.pot); a.boule(0.6, px, pl + 1.1, pz, C.plante, 1.15, true); continue; }
      const [bx, bz] = loc(K.bureau, f);
      a.boite(1.75, 0.1, 0.8, bx, pl + 0.9, bz, C.bureau, ry);
      [-0.78, 0.78].forEach(function (o) { a.boite(0.08, 0.9, 0.62, bx + tg[0] * o, pl, bz + tg[1] * o, C.pied, ry); });
      const [mx, mz] = loc(K.bureau + 0.24, f);
      a.boite(1.0, 0.62, 0.07, mx, pl + 1.06, mz, C.ecran, ry);
      a.boite(0.14, 0.16, 0.14, mx, pl + 1.0, mz, C.ecran, ry);
      const [cx2, cz2] = loc(K.siege, f), [dx2, dz2] = loc(K.siege - 0.42, f);
      a.boite(0.78, 0.12, 0.78, cx2, pl + 0.42, cz2, C.chaise, ry);
      a.boite(0.78, 0.74, 0.12, dx2, pl + 0.48, dz2, C.chaise, ry);
      const [ex, ez] = loc(K.bureau + 0.19, f);
      ecrans[i] = { x: K.x + ex, y: pl + 1.37, z: K.z + ez, ry: ry };
    }
    // le parc : l'allée ronde, les rayons vers les portes et le passage, le bassin, les bancs, la table, les arbres
    a.anneau(K.allee - 0.45, K.allee + 0.45, 0, 360, SOL, 0.04, C.allee);
    K.portes.concat([K.porte]).forEach(function (f) {
      const r0 = K.allee + 0.35, r1 = f === K.porte ? K.pelouse - 0.3 : K.r + 0.25;
      const [x, z] = loc((r0 + r1) / 2, f);
      a.boite(r1 - r0, 0.04, f === K.porte ? 1.9 : 1.05, x, SOL, z, C.allee, -f * RAD);
      if (f !== K.porte) { const [sx, sz] = loc(K.r - 0.25, f); a.boite(0.62, 0.24, 1.2, sx, SOL, sz, C.blanc, -f * RAD); }
    });
    a.disque(2.3, 0.12, 0, SOL, 0, C.blanc);
    BANCS.forEach(function (f) {
      const ry = ryTangent(f), [x, z] = loc(6.65, f), [bx, bz] = loc(6.93, f), tg = [-Math.sin(f * RAD), Math.cos(f * RAD)];
      a.boite(1.7, 0.1, 0.5, x, SOL + 0.38, z, '#FFFFFF', ry); a.boite(1.7, 0.42, 0.08, bx, SOL + 0.48, bz, '#FFFFFF', ry);
      [-0.7, 0.7].forEach(function (o) { a.boite(0.1, 0.38, 0.42, x + tg[0] * o, SOL, z + tg[1] * o, C.pied, ry); });
    });
    BANCS_DEHORS.forEach(function (f) {
      const ry = ryTangent(f), [x, z] = loc(15.1, f), [bx, bz] = loc(14.83, f), tg = [-Math.sin(f * RAD), Math.cos(f * RAD)];
      a.boite(1.7, 0.1, 0.5, x, SOL + 0.38, z, '#FFFFFF', ry); a.boite(1.7, 0.42, 0.08, bx, SOL + 0.48, bz, '#FFFFFF', ry);
      [-0.7, 0.7].forEach(function (o) { a.boite(0.1, 0.38, 0.42, x + tg[0] * o, SOL, z + tg[1] * o, C.pied, ry); });
    });
    const [tx, tz] = loc(TABLE.r, TABLE.f);
    a.cylindre(1.0, 0.08, tx, SOL + 0.82, tz, '#FFFFFF'); a.cylindre(0.12, 0.82, tx, SOL, tz, C.pied, true);
    tabourets().forEach(function (s) { a.cylindre(0.32, 0.46, s.x - K.x, SOL, s.z - K.z, C.chaise); });
    const arbresParc = ARBRES_PARC.map(function (f, i) { const [x, z] = loc(7.55, f); return { x: x, z: z, s: 0.78 + (i % 3) * 0.12, bleu: i % 3 === 1 }; })
      .concat(ARBRES_PELOUSE.map(function (f, i) { const [x, z] = loc(14.7, f); return { x: x, z: z, s: 0.7 + (i % 2) * 0.15, bleu: i % 2 === 0 }; }));
    bosquet(arbresParc, g);
    g.add(a.maille(matBase));
    if (!fen.vide()) g.add(fen.maille(matVitre, false));
    const verreM = vit.maille(matVitreAnneau, false); verreM.renderOrder = 3; g.add(verreM);
    const eau = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.05, 48), matEau); eau.position.y = SOL + 0.1; eau.receiveShadow = true; g.add(eau);
    animes.push(function (t) { matEau.emissiveIntensity = 0.05 + 0.03 * Math.sin(t * 1.1) + nuit * 0.3; });
    // le mur des sites : une case allumée par site en ligne, pâle pour un aperçu
    const tuile = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.7, 0.05), new THREE.MeshBasicMaterial({ toneMapped: false }), 24);
    tuile.material.userData.jetable = true;
    for (let i = 0; i < 24; i++) {
      const c = i % 8, rg = Math.floor(i / 8), f = 249.5 + c * 4.45;
      const [x, z] = loc(K.R - 0.37, f);
      _m.compose(_v.set(x, pl + 2.2 + (2 - rg) * 0.92, z), _q.setFromAxisAngle(UP, ryTangent(f)), _s.set(1, 1, 1)); tuile.setMatrixAt(i, _m);
      tuile.setColorAt(i, new THREE.Color('#E8EEF7'));
    }
    g.add(tuile);
    const sb = surbrillance(g, new THREE.RingGeometry(K.pelouse - 0.4, K.pelouse + 1.2, 72), SOL + 0.02);
    monde.add(g);
    const [ax, az] = loc(K.pelouse + 0.4, 45);
    const b = { id: co.id, type: 'company', campus: true, groupe: g, survol: sb, tuiles: tuile, places: places.de, service: places.service, ecrans: ecrans, x: K.x, z: K.z, w: 2 * K.pelouse, d: 2 * K.pelouse,
      // son étiquette pend sous le campus, côté ville : elle ne couvre ni le parc ni les maisons voisines
      ancre: new THREE.Vector3(K.x + ax, SOL, K.z + az), ancreDessous: true, ancreHaut: wP(K.R - 0.3, K.porte, pl + 5.6), centre: new THREE.Vector3(K.x, 1.2, K.z), zoomVue: 1.85,
      // l'enseigne de chaque service : sur le haut du mur au fond, sur le muret devant
      secteurs: SECTEURS.map(function (s) { const fm = (angPlace(s.debut) + angPlace(s.debut + s.places - 1)) / 2, h = hauteurMur(fm); return { id: s.id, nom: s.nom, teinte: s.teinte, ancre: wP(K.R + 0.05, fm, h > 3 ? pl + h + 0.45 : pl + h * 0.55) }; }) };
    b.pick = zonePick(co.id, 'company', new THREE.CylinderGeometry(K.pelouse, K.pelouse, 5.6, 32), K.x, 2.8, K.z);
    return b;
  }
  // Qui s'assoit où : chacun dans son service, dans l'ordre de l'organigramme ; un nouveau va dans le service de son chef
  function attribuerPlaces(agentsCo) {
    const secteurDe = new Map(), rang = new Map();
    SECTEURS.forEach(function (s) { s.agents.forEach(function (id, i) { secteurDe.set(id, s.id); rang.set(id, i); }); });
    const parId = new Map(agentsCo.map(function (a) { return [a.id, a]; }));
    const trouver = function (a, n) { if (secteurDe.has(a.id)) return secteurDe.get(a.id); const p = a.parent_id && parId.get(a.parent_id); return p && n < 5 ? trouver(p, n + 1) : 'direction'; };
    const tries = agentsCo.slice().sort(function (x, y) { return (rang.has(x.id) ? rang.get(x.id) : 50 + (x.seat || 0)) - (rang.has(y.id) ? rang.get(y.id) : 50 + (y.seat || 0)); });
    const utilisees = new Array(PLACES).fill(false), de = new Map(), service = new Map();
    const libreDans = function (s) { for (let i = s.debut; i < s.debut + s.places; i++) if (!utilisees[i]) return i; for (let k = 1; k < PLACES; k++) { for (const j of [s.debut + s.places - 1 + k, s.debut - k]) if (j >= 0 && j < PLACES && !utilisees[j]) return j; } return -1; };
    tries.forEach(function (a) {
      const s = SECTEURS.find(function (x) { return x.id === trouver(a, 0); }) || SECTEURS[0];
      const i = libreDans(s);
      if (i >= 0) { utilisees[i] = true; de.set(a.id, i); service.set(a.id, s.id); }
    });
    return { utilisees: utilisees, de: de, service: service };
  }
  function tabourets() {
    const t = wP(TABLE.r, TABLE.f, 0);
    return [20, 110, 200, 290].map(function (d) {
      const x = t.x + TABLE.rayon * Math.cos((TABLE.f - 45 + d) * RAD), z = t.z + TABLE.rayon * Math.sin((TABLE.f - 45 + d) * RAD);
      return { x: x, z: z, ry: Math.atan2(t.x - x, t.z - z) };
    });
  }

  // Une pièce ouverte, vue comme une maison de poupée : deux murs au fond, un muret devant, les bureaux dedans
  const STYLE = {
    studio3d: { w: 20.5, d: 17, decor: 'studio' },   // 18 postes : la salle d'écriture et la fabrication
    ecom: { w: 15, d: 13, decor: 'entrepot' },
    labo: { w: 14, d: 12, decor: 'labo' }
  };
  const lotDe = {};
  function attribuerLots(cos) {
    Object.keys(lotDe).forEach(function (k) { delete lotDe[k]; });
    const pris = new Set();
    cos.forEach(function (c) { if (LOTS[c.id]) { lotDe[c.id] = LOTS[c.id]; pris.add(LOTS[c.id].join(',')); } });
    const libres = Object.keys(LOTS).filter(function (k) { return k !== 'novalemo' && !pris.has(LOTS[k].join(',')); }).map(function (k) { return LOTS[k]; }).concat(LIBRES);
    cos.forEach(function (c) { if (!lotDe[c.id]) lotDe[c.id] = libres.shift() || [0, -ESPACE * 1.6]; });
  }
  function construirePiece(co, agentsCo) {
    const [x, z] = lotDe[co.id];
    const st = STYLE[co.id] || { w: 14, d: 12, decor: '' };
    const W = st.w, D = st.d, HM = 6.2, HP = 0.9;
    const g = new THREE.Group(); g.position.set(x, SOL, z);
    const a = new Assemblage(), fen = new Assemblage(), tuiles = new Assemblage();
    const coul = new THREE.Color(co.color || '#2B59E8');
    const pastel = '#' + coul.clone().lerp(new THREE.Color('#ffffff'), 0.55).getHexString();
    a.boite(W, 0.45, D, 0, 0, 0, C.blanc);                                  // le plancher
    a.boite(W - 0.6, 0.02, D - 0.6, 0, 0.45, 0, C.plancher);
    a.boite(0.45, HM, D, -W / 2 + 0.22, 0.45, 0, C.mur);
    a.boite(W, HM, 0.45, 0, 0.45, -D / 2 + 0.22, C.mur);
    a.boite(0.5, 0.5, D + 0.05, -W / 2 + 0.25, 0.45 + HM, 0, '#FFFFFF');
    a.boite(W + 0.05, 0.5, 0.5, 0, 0.45 + HM, -D / 2 + 0.25, '#FFFFFF');
    a.boite(0.08, 0.55, D - 1, -W / 2 + 0.49, 0.45 + HM - 1.0, 0, '#' + coul.getHexString());
    a.boite(W - 1, 0.55, 0.08, 0, 0.45 + HM - 1.0, -D / 2 + 0.49, '#' + coul.getHexString());
    for (let i = -D / 2 + 2.2; i < D / 2 - 1.5; i += 3.1) fen.boite(0.08, 2.4, 2.2, -W / 2 + 0.47, 0.45 + 1.9, i + 0.9, C.vitre);
    for (let i = -W / 2 + 2.2; i < W / 2 - 1.5; i += 3.1) fen.boite(2.2, 2.4, 0.08, i + 0.9, 0.45 + 1.9, -D / 2 + 0.47, C.vitre);
    a.boite(0.3, HP, D * 0.62, W / 2 - 0.15, 0.45, -D * 0.19, '#EEF2F8');
    a.boite(W * 0.62, HP, 0.3, -W * 0.19, 0.45, D / 2 - 0.15, '#EEF2F8');
    const n = Math.max(1, agentsCo.length);
    const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(n * W / D))));
    const rangs = Math.ceil(n / cols);
    const px = (W - 4.2) / cols, pz = Math.min(3.1, (D - 4.4) / Math.max(1, rangs));
    const postes = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const ox = -W / 2 + 2.6 + px * (c + 0.5), oz = -D / 2 + 2.6 + pz * (r + 0.5);
      a.boite(1.9, 0.12, 1.0, ox, 0.45 + 1.0, oz, C.bureau);
      a.boite(0.1, 1.0, 0.8, ox - 0.85, 0.45, oz, C.pied); a.boite(0.1, 1.0, 0.8, ox + 0.85, 0.45, oz, C.pied);
      a.boite(1.05, 0.66, 0.08, ox, 0.45 + 1.17, oz - 0.3, C.ecran);
      a.boite(0.16, 0.2, 0.16, ox, 0.45 + 1.0, oz - 0.34, C.ecran);
      a.boite(0.8, 0.12, 0.8, ox, 0.45 + 0.52, oz + 0.85, C.chaise);
      a.boite(0.8, 0.8, 0.12, ox, 0.45 + 0.6, oz + 1.3, C.chaise);
      postes.push({ x: x + ox, y: PLANCHER, z: z + oz + 0.8, ecran: { x: x + ox, y: PLANCHER + 1.17 + 0.33, z: z + oz - 0.3 + 0.05, ry: 0 } });
    }
    a.boite(W - 3.6, 0.03, Math.min(D - 3.4, rangs * pz + 0.8), -W / 2 + 2.6 + (W - 4.2) / 2, 0.46, -D / 2 + 2.6 + rangs * pz / 2, pastel);
    [[W / 2 - 1.3, -D / 2 + 1.3], [-W / 2 + 1.3, D / 2 - 1.3]].forEach(function (p) { a.cylindre(0.45, 0.7, p[0], 0.45, p[1], C.pot); a.boule(0.75, p[0], 0.45 + 1.35, p[1], C.plante, 1.15, true); });
    if (st.decor === 'studio') {
      // la caméra sur pied et le panneau de lumière, dans la bande libre le long du mur de gauche (hors des bureaux)
      const xb = -W / 2 + 1.5;
      a.boite(0.25, 0.08, 0.25, xb, 0.45, -D / 2 + 2.4, C.pied);
      a.cylindre(0.05, 2.1, xb, 0.45, -D / 2 + 2.4, C.pied, true); a.boite(0.7, 0.45, 0.45, xb, 0.45 + 2.1, -D / 2 + 2.4, C.ecran);
      a.boite(1.4, 1.6, 0.12, xb, 0.45 + 2.4, D / 2 - 3.4, '#F6F8FC'); a.cylindre(0.05, 2.4, xb, 0.45, D / 2 - 3.3, C.pied, true);
    } else if (st.decor === 'entrepot') {
      for (let k = 0; k < 3; k++) { a.boite(0.8, 0.12, 4.4, -W / 2 + 1.1, 0.45 + 0.4 + k * 1.3, D / 2 - 3.6, C.pied); for (let j = 0; j < 3; j++) a.boite(0.62, 0.62, 0.9, -W / 2 + 1.1, 0.45 + 0.52 + k * 1.3, D / 2 - 5.2 + j * 1.35, j % 2 ? '#E6C28A' : '#F1D6A8'); }
      a.boite(1.6, 0.18, 1.6, W / 2 - 2, 0.45, D / 2 - 2.2, '#D9C7A4'); a.boite(1.2, 1.1, 1.2, W / 2 - 2, 0.63, D / 2 - 2.2, '#F1D6A8');
    } else if (st.decor === 'labo') {
      a.boite(4.2, 1.0, 1.1, W / 2 - 3, 0.45, D / 2 - 2, '#FFFFFF');
      [0, 1, 2].forEach(function (k) { a.cylindre(0.16, 0.5, W / 2 - 4.4 + k * 1.1, 1.45, D / 2 - 2, k === 1 ? pastel : '#DCE6F7'); a.boule(0.24, W / 2 - 4.4 + k * 1.1, 1.62, D / 2 - 2, k === 1 ? pastel : '#DCE6F7', 0.8, true); });
      a.boite(3.2, 2.0, 0.1, 1.5, 0.45 + 2.4, -D / 2 + 0.52, '#FFFFFF');
      [[0.6, 3.6], [1.4, 3.3], [2.2, 3.7], [0.9, 2.9], [1.9, 2.8]].forEach(function (p, k) { tuiles.boite(0.45, 0.45, 0.04, p[0], 0.45 + p[1] - 0.8, -D / 2 + 0.6, ['#FFD27A', '#A9C1FF', '#9EE3C3', '#FFB3B8', '#FFD27A'][k]); });
    }
    g.add(a.maille(matBase));
    if (!fen.vide()) g.add(fen.maille(matVitre, false));
    if (!tuiles.vide()) g.add(tuiles.maille(matTuileSite, false));
    ombreSol(g, W, D, 0, 0);
    const sb = surbrillance(g, new THREE.PlaneGeometry(W + 2.4, D + 2.4));
    monde.add(g);
    pieces.push({ x: x, z: z, w: W, d: D });
    const b = { id: co.id, type: 'company', groupe: g, survol: sb, hauteur: 0.45 + HM + 0.5, ancre: new THREE.Vector3(x - W / 2 + 1.2, SOL + 0.45 + HM + 1.6, z - D / 2 + 1.2), postes: postes, w: W, d: D, x: x, z: z, decor: st.decor, coul: coul,
      allee: z + D / 2 - 1.55, centre: new THREE.Vector3(x, 2.5, z), zoomVue: 2.15 * Math.min(1, 15 / W) };
    b.pick = zonePick(co.id, 'company', new THREE.BoxGeometry(W, 0.45 + HM, D), x, (0.45 + HM) / 2, z);
    if (st.decor === 'studio') {
      const ecran = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshBasicMaterial({ map: textureEcranGeant('#8B6CF6', '#4FA3FF'), toneMapped: false }));
      ecran.material.userData.jetable = true;
      ecran.position.set(-W / 2 + 0.5, 0.45 + 3.2, 0.2); ecran.rotation.y = Math.PI / 2; g.add(ecran); b.ecranGeant = ecran;
      animes.push(function (t) { ecran.material.color.setScalar(0.82 + 0.18 * Math.sin(t * 0.9)); });
    }
    return b;
  }

  // Un chantier : le projet d'entreprise qui attend la décision de Louis (une grue, une palissade, un panneau)
  function construireChantier(co) {
    const [x, z] = lotDe[co.id];
    const g = new THREE.Group(); g.position.set(x, SOL, z);
    const a = new Assemblage();
    const coul = '#' + new THREE.Color(co.color || '#F2B543').getHexString();
    a.boite(15, 0.35, 13, 0, 0, 0, C.beton);
    for (let i = -7; i <= 7; i += 1.75) { a.boite(1.6, 1.3, 0.12, i, 0.35, 6.4, i % 3.5 === 0 ? coul : '#FFFFFF'); a.boite(1.6, 1.3, 0.12, i, 0.35, -6.4, '#FFFFFF'); }
    for (let i = -6; i <= 6; i += 1.75) { a.boite(0.12, 1.3, 1.6, 7.4, 0.35, i, '#FFFFFF'); a.boite(0.12, 1.3, 1.6, -7.4, 0.35, i, i % 3.5 === 0 ? coul : '#FFFFFF'); }
    [[-4, -3], [3, -3], [-4, 3], [3, 3]].forEach(function (p) { a.boite(0.16, 5.4, 0.16, p[0], 0.35, p[1], C.echafaud); });
    [1.8, 3.6, 5.4].forEach(function (h) { a.boite(7.2, 0.12, 0.16, -0.5, 0.35 + h, -3, C.echafaud); a.boite(7.2, 0.12, 0.16, -0.5, 0.35 + h, 3, C.echafaud); a.boite(0.16, 0.12, 6.2, -4, 0.35 + h, 0, C.echafaud); a.boite(0.16, 0.12, 6.2, 3, 0.35 + h, 0, C.echafaud); });
    a.boite(7.4, 0.35, 6.4, -0.5, 0.35, 0, '#E9EDF3');
    a.boite(2, 0.5, 1.2, 5, 0.35, -4.5, '#E8D2B0'); a.boite(2, 0.5, 1.2, 5, 0.85, -4.5, '#F0DEC2'); a.cylindre(0.5, 1.2, -5.5, 0.35, -4.6, '#C9D2DF');
    a.boite(0.14, 2.4, 0.14, 5.2, 0.35, 5, C.pied); a.boite(2.6, 1.5, 0.12, 5.2, 0.35 + 2.4, 5, coul);
    g.add(a.maille(matBase));
    const gr = new Assemblage();
    gr.boite(0.55, 13, 0.55, 0, 0.35, 0, '#F2C14E');
    const mat = gr.maille(matBase); mat.position.set(-5, 0, 3.5); g.add(mat);
    const fl = new Assemblage();
    fl.boite(11, 0.45, 0.5, 3.2, 0, 0, '#F2C14E'); fl.boite(3, 0.5, 0.6, -3.2, -0.05, 0, '#F2C14E'); fl.boite(1.5, 1.1, 1, -3.8, -1.1, 0, C.beton); fl.boite(1.2, 1, 1, 0.3, -1, 0, '#FFFFFF');
    fl.boite(0.05, 3.2, 0.05, 6.5, -3.2, 0, '#7D8798'); fl.boite(0.5, 0.35, 0.5, 6.5, -3.55, 0, '#F2C14E');
    const fleche = fl.maille(matBase); fleche.castShadow = false; fleche.position.set(-5, 13.35, 3.5); g.add(fleche);
    const graine = (co.id.length * 37) % 100 / 100;
    animes.push(function (t) { fleche.rotation.y = Math.sin(t * 0.12 + graine * 6) * 1.3 + graine * 3; });
    ombreSol(g, 15, 13, 0, 0);
    const sb = surbrillance(g, new THREE.PlaneGeometry(17.4, 15.4));
    monde.add(g);
    const b = { id: co.id, type: 'site', groupe: g, survol: sb, hauteur: 14, ancre: new THREE.Vector3(x - 5, SOL + 15.2, z + 3.5), w: 15, d: 13, x: x, z: z, centre: new THREE.Vector3(x, 3, z), zoomVue: 2.15 };
    b.pick = zonePick(co.id, 'site', new THREE.BoxGeometry(15, 13, 13), x, 6.5, z);
    return b;
  }
  function liberer(groupe) {
    groupe.traverse(function (o) {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry && o.geometry !== BOITE) o.geometry.dispose();
      if (o.material && o.material.userData && o.material.userData.jetable) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
  }

  /* ── les agents : des petits personnages en pâte, instanciés ── */
  const GEO_CORPS = new THREE.CapsuleGeometry(0.42, 0.52, 4, 14);
  const GEO_TETE = new THREE.SphereGeometry(0.38, 18, 14);
  const GEO_OEIL = new THREE.SphereGeometry(0.055, 8, 6);
  const GEO_STATUT = new THREE.SphereGeometry(0.15, 12, 10);
  const GEO_OMBRE = new THREE.PlaneGeometry(1.3, 1.3); GEO_OMBRE.rotateX(-Math.PI / 2);
  const matAgent = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  const matFantome = new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.32, roughness: 0.5, depthWrite: false });
  const matOeil = new THREE.MeshBasicMaterial({ color: '#1E2638' });
  const matStatut = new THREE.MeshBasicMaterial({ toneMapped: false });
  let agents = [];
  const parId = new Map();
  let inst = null;
  const posAgent = new Map();       // id -> Vector3 (au-dessus de la tête), pour les messages et les étiquettes
  const COUL_STATUT = { working: '#3D6BFF', waiting: '#F2B543', error: '#FF5A60', paused: '#A5B0C2' };
  const GRIS_PAUSE = new THREE.Color('#B8C2D2'), BLANC = new THREE.Color('#ffffff');
  const C_STATUT = {}; Object.keys(COUL_STATUT).forEach(function (k) { C_STATUT[k] = new THREE.Color(COUL_STATUT[k]); });

  function poserAgents(liste) {
    if (inst) { Object.values(inst).forEach(function (m) { if (m && m.isMesh) { monde.remove(m); m.dispose(); } }); inst = null; }
    posAgent.clear(); parId.clear();
    const actifs = liste.filter(function (a) { return a.kind !== 'attente'; });
    const fant = liste.filter(function (a) { return a.kind === 'attente'; });
    const n = Math.max(1, actifs.length), nf = Math.max(1, fant.length);
    inst = {
      corps: new THREE.InstancedMesh(GEO_CORPS, matAgent, n), tete: new THREE.InstancedMesh(GEO_TETE, matAgent, n), yeux: new THREE.InstancedMesh(GEO_OEIL, matOeil, n * 2),
      statut: new THREE.InstancedMesh(GEO_STATUT, matStatut, n), ombres: new THREE.InstancedMesh(GEO_OMBRE, matOmbre, n),
      fantomeC: new THREE.InstancedMesh(GEO_CORPS, matFantome, nf), fantomeT: new THREE.InstancedMesh(GEO_TETE, matFantome, nf)
    };
    inst.corps.count = inst.tete.count = inst.statut.count = inst.ombres.count = actifs.length; inst.yeux.count = actifs.length * 2;
    inst.fantomeC.count = inst.fantomeT.count = fant.length;
    inst.fantomeC.renderOrder = inst.fantomeT.renderOrder = 4; inst.ombres.renderOrder = 1;
    Object.values(inst).forEach(function (m) { m.frustumCulled = false; monde.add(m); });
    inst.ids = actifs.map(function (a) { return a.id; }); inst.idsF = fant.map(function (a) { return a.id; });
    agents = liste.map(function (a, i) { return Object.assign({}, a, { ph: i * 1.37 + (a.seat || 0) * 0.71 }); });
    agents.forEach(function (a) { parId.set(a.id, a); });
    placerAgents();
  }
  // où est chacun : à sa place sur l'anneau du campus, à son poste dans sa pièce, ou autour de la table du Board
  function placerAgents() {
    const parCo = {};
    agents.forEach(function (a) { (parCo[a.company_id] = parCo[a.company_id] || []).push(a); });
    Object.keys(parCo).forEach(function (cid) {
      const b = batiments.get(cid);
      parCo[cid].sort(function (x, y) { return (x.seat || 0) - (y.seat || 0); }).forEach(function (a, i) {
        a.bat = cid; a.couloir = null; a.ecran = null; a.f = null;
        if (b && b.campus && b.places.has(a.id)) {
          const k = b.places.get(a.id), f = angPlace(k);
          a.lieu = 'campus'; a.f = f; a.place = k; a.secteur = b.service.get(a.id);
          const s = SECTEURS.find(function (x) { return x.id === a.secteur; }); if (s) { a.couleur = '#' + new THREE.Color(s.ton).lerp(new THREE.Color('#ffffff'), 0.18).getHexString(); a.c3 = null; }
          a.siege = wP(CAMPUS.siege, f, PLANCHER + 0.42); a.rySiege = ryDehors(f);
          a.debout = wP(CAMPUS.siege - 0.62, f, PLANCHER); a.couloir = wP(CAMPUS.couloir, f, PLANCHER);
          a.ecran = b.ecrans[k];
          return;
        }
        if (b && b.campus) { const f = 20 + i * 31; a.lieu = 'parc'; a.siege = a.debout = wP(CAMPUS.allee + 1.0, f, PARC); a.rySiege = ryTangent(f); return; }
        if (b && b.sieges) { const s = b.sieges[i % b.sieges.length]; a.lieu = 'board'; a.siege = a.debout = new THREE.Vector3(s.x, s.y + 0.42, s.z); a.rySiege = s.ry; a.solFixe = s.y - 0.22; return; }
        if (b && b.postes && b.postes[i]) { const p = b.postes[i]; a.lieu = 'piece'; a.siege = new THREE.Vector3(p.x, p.y + 0.42, p.z); a.rySiege = Math.PI; a.debout = new THREE.Vector3(p.x + 0.95, p.y, p.z); a.couloir = new THREE.Vector3(p.x + 0.95, p.y, b.allee); a.ecran = p.ecran; return; }
        a.lieu = 'libre'; a.siege = a.debout = new THREE.Vector3((b ? b.x : 0) + (i % 4) * 1.4, PLANCHER, (b ? b.z : 0) + Math.floor(i / 4) * 1.4); a.rySiege = 0;
      });
    });
    agents.forEach(function (a) { const r = repos(a, 0); a.pos = r.pos.clone(); a.ry = a.ryCible = r.ry; a.mouv = a.pause = a.regard = null; a.activite = null; a.phase = 0; a.marche = false; a.assis = assisAuRepos(a); });
    marcheurs = 0; promeneurs = 0; tableLibre = true; bancsPris.clear();
    bulles.forEach(function (b) { b.fin = 0; });
  }
  const assisAuRepos = function (a) { return a.kind !== 'attente' && (a.status === 'working' || a.status === 'paused' || a.lieu === 'board'); };
  const versCamera = function () { return Math.atan2(Math.cos(vue.az * RAD), Math.sin(vue.az * RAD)); };
  function repos(a, t) {
    if (assisAuRepos(a)) return { pos: a.siege, ry: a.rySiege, assis: true };
    return { pos: a.debout, ry: a.regard ? cap(a.pos || a.debout, a.regard) : versCamera() + Math.sin(t * 0.6 + a.ph) * 0.3, assis: false };
  }
  function hauteurSol(a) {
    if (a.lieu === 'board') return a.solFixe;
    const x = a.pos.x, z = a.pos.z;
    if (campus) {
      const dx = x - CAMPUS.x, dz = z - CAMPUS.z, r = Math.hypot(dx, dz);
      if (r >= CAMPUS.r - 0.05 && r <= CAMPUS.R + 0.05 && uDe(Math.atan2(dz, dx) / RAD) <= AMPLEUR) return PLANCHER;
    }
    for (let i = 0; i < pieces.length; i++) { const p = pieces[i]; if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) return PLANCHER; }
    return PARC;
  }

  /* ── la vie du campus : se lever, marcher, parler, s'asseoir au parc ── */
  let marcheurs = 0, promeneurs = 0, tableLibre = true, prochaineBalade = 4, prochaineVisite = 18;
  const bancsPris = new Set();
  const libre = function (a) { return !!a && !calme && !a.activite && !a.mouv && !a.pause && a.kind !== 'attente' && a.status !== 'paused' && a.status !== 'error' && (a.lieu === 'campus' || a.lieu === 'piece') && a.apparition == null; };
  function commencer(a, nom) { a.activite = nom; marcheurs++; }
  function finir(a) { if (a.activite) { a.activite = null; marcheurs = Math.max(0, marcheurs - 1); } }
  function lancer(a, pts, apres, vitesse) { a.mouv = { pts: pts, i: 0, vitesse: vitesse || MARCHE, apres: apres }; }
  const longueur = function (de, pts) { let l = 0, p = de; pts.forEach(function (q) { l += p.distanceTo(q); p = q; }); return l; };
  function arcCouloir(fa, fb) {
    const ua = uDe(fa), ub = uDe(fb), pts = [];
    const n = Math.max(1, Math.ceil(Math.abs(ub - ua) / 6));
    for (let i = 1; i <= n; i++) pts.push(wP(CAMPUS.couloir, CAMPUS.f0 + ua + (ub - ua) * i / n, PLANCHER));
    return pts;
  }
  function arcAllee(fa, fb) {
    const d = ((fb - fa) % 360 + 540) % 360 - 180, pts = [];
    const n = Math.max(1, Math.ceil(Math.abs(d) / 9));
    for (let i = 1; i <= n; i++) pts.push(wP(CAMPUS.allee, fa + d * i / n, PARC));
    return pts;
  }
  const porteProche = function (f) { return CAMPUS.portes.slice().sort(function (p, q) { return Math.abs(uDe(f) - uDe(p)) - Math.abs(uDe(f) - uDe(q)); })[0]; };
  // de sa place jusqu'à l'allée du parc, à l'angle voulu : le couloir, la porte la plus proche, l'allée ronde
  function versParc(a, fDest) {
    const p = porteProche(a.f);
    return [a.couloir.clone()].concat(arcCouloir(a.f, p), [wP(CAMPUS.r - 0.55, p, PARC), wP(CAMPUS.allee, p, PARC)], arcAllee(p, fDest));
  }
  function regarder(a, point, duree) { a.regard = { x: point.x, z: point.z }; a.regardFin = horloge + duree; }
  // Aller voir un collègue : à côté de son poste, le temps d'échanger, puis retour
  function visite(A, B) {
    if (!libre(A) || !B || B.bat !== A.bat || B.lieu !== A.lieu || marcheurs >= 8 || A === B) return false;
    let aller;
    if (A.lieu === 'campus') {
      const sens = uDe(B.f) >= uDe(A.f) ? -1 : 1, fB = B.f + sens * 3.6;
      aller = [A.couloir.clone()].concat(arcCouloir(A.f, fB), [wP(CAMPUS.siege - 0.72, fB, PLANCHER)]);
    } else {
      const cote = B.siege.x + (A.siege.x < B.siege.x ? -1.15 : 1.15);
      aller = [A.couloir.clone(), new THREE.Vector3(cote, PLANCHER, A.couloir.z), new THREE.Vector3(cote, PLANCHER, B.siege.z + 0.35)];
    }
    const retour = aller.slice(0, -1).reverse();
    commencer(A, 'visite');
    lancer(A, aller, function () {
      const d = 4.6;
      A.pause = { fin: horloge + d, ry: cap(A.pos, B.pos), apres: function () { lancer(A, retour, function () { finir(A); }); } };
      regarder(B, A.pos, d);
      parler(A, horloge, horloge + d / 2); parler(B, horloge + d / 2, horloge + d);
    });
    return true;
  }
  // Une réunion à la table du parc : chacun y va, ils s'assoient, échangent, et rentrent
  function reunion(A, B) {
    if (!campus || A.lieu !== 'campus' || B.lieu !== 'campus' || !libre(A) || !libre(B) || !tableLibre || marcheurs > 6 || A === B) return false;
    const tb = tabourets();
    const chemins = [A, B].map(function (X, k) {
      const s = tb[k], fs = Math.atan2(s.z - CAMPUS.z, s.x - CAMPUS.x) / RAD;
      return versParc(X, fs).concat([new THREE.Vector3(s.x, SOL + 0.34, s.z)]);
    });
    const arrivee = Math.max(longueur(A.pos, chemins[0]), longueur(B.pos, chemins[1])) / MARCHE;
    const debut = horloge + arrivee + 0.4, fin = debut + 7.5;
    tableLibre = false;
    let rentres = 0;
    [A, B].forEach(function (X, k) {
      commencer(X, 'reunion');
      const retour = chemins[k].slice(0, -1).reverse();
      lancer(X, chemins[k], function () {
        X.pause = { fin: fin, ry: tb[k].ry, assis: true, apres: function () { lancer(X, retour, function () { finir(X); if (++rentres === 2) tableLibre = true; }); } };
      });
    });
    parler(A, debut, debut + 2.4); parler(B, debut + 2.4, debut + 4.8); parler(A, debut + 4.8, fin - 0.3);
    return true;
  }
  // Un tour au parc : un banc libre (parfois dehors, près du passage), quelques secondes assis, et retour
  function promenade(a) {
    if (!campus || !libre(a) || a.lieu !== 'campus' || marcheurs >= 8 || promeneurs >= 3) return false;
    const dehors = Math.random() < 0.3;
    const places = [];
    (dehors ? BANCS_DEHORS : BANCS).forEach(function (f) { [-1, 1].forEach(function (s) { const cle = f + ':' + s; if (!bancsPris.has(cle)) places.push({ f: f, s: s, cle: cle }); }); });
    if (!places.length) return false;
    const pl = places[Math.floor(Math.random() * places.length)];
    let ch, ry;
    if (dehors) {
      const fp = pl.f + pl.s * 2.3;
      ch = versParc(a, CAMPUS.porte).concat([wP(CAMPUS.r - 0.2, CAMPUS.porte, PARC), wP(CAMPUS.R + 0.7, CAMPUS.porte, PARC), wP(15.1, fp, SOL + 0.36)]);
      ry = ryDehors(pl.f);
    } else {
      const fp = pl.f + pl.s * 3.6;
      ch = versParc(a, fp).concat([wP(6.65, fp, SOL + 0.36)]);
      ry = ryTangent(pl.f);
    }
    const retour = ch.slice(0, -1).reverse();
    commencer(a, 'promenade'); promeneurs++; bancsPris.add(pl.cle);
    lancer(a, ch, function () {
      a.pause = { fin: horloge + 6 + Math.random() * 4, ry: ry, assis: true, apres: function () { bancsPris.delete(pl.cle); lancer(a, retour, function () { finir(a); promeneurs--; }, 1.9); } };
    }, 1.9);
    return true;
  }
  // Le rythme du campus quand rien n'arrive : une balade de temps en temps, une question au chef
  function vivre() {
    if (calme || intro || !agents.length) return;
    if (horloge > prochaineBalade) {
      prochaineBalade = horloge + 13 + Math.random() * 12;
      const c = agents.filter(function (a) { return a.lieu === 'campus' && a.status === 'idle' && libre(a); });
      if (c.length) promenade(c[Math.floor(Math.random() * c.length)]);
    }
    if (horloge > prochaineVisite) {
      prochaineVisite = horloge + 24 + Math.random() * 20;
      const c = agents.filter(function (a) { return a.status === 'idle' && libre(a) && a.parent_id && parId.get(a.parent_id) && parId.get(a.parent_id).bat === a.bat; });
      if (c.length) { const a = c[Math.floor(Math.random() * c.length)]; visite(a, parId.get(a.parent_id)); }
    }
  }
  // chaque image : chacun avance sur son chemin, attend, ou rejoint doucement sa place
  function avancerAgent(a, t, dt) {
    if (a.mouv) {
      let reste = a.mouv.vitesse * dt;
      while (reste > 0 && a.mouv) {
        const m = a.mouv, c = m.pts[m.i], d = a.pos.distanceTo(c);
        if (d <= reste) { a.pos.copy(c); reste -= d; m.i++; if (m.i >= m.pts.length) { a.mouv = null; if (m.apres) m.apres(); } }
        else { a.pos.lerp(c, reste / d); reste = 0; }
      }
      if (a.mouv) { const c = a.mouv.pts[a.mouv.i], dx = c.x - a.pos.x, dz = c.z - a.pos.z; if (dx * dx + dz * dz > 1e-4) a.ryCible = Math.atan2(dx, dz); }
      a.marche = !!a.mouv; a.assis = false;
    } else if (a.pause) {
      a.marche = false; a.assis = !!a.pause.assis;
      if (a.pause.ry != null) a.ryCible = a.pause.ry;
      if (t >= a.pause.fin) { const p = a.pause; a.pause = null; if (p.apres) p.apres(); }
    } else {
      if (a.regard && t > a.regardFin) a.regard = null;
      const r = repos(a, t), d = a.pos.distanceTo(r.pos);
      if (d > 0.012) {
        a.pos.lerp(r.pos, Math.min(1, 2.2 * dt / d));
        if (d > 0.3) { a.ryCible = Math.atan2(r.pos.x - a.pos.x, r.pos.z - a.pos.z); a.marche = true; } else { a.ryCible = r.ry; a.marche = false; }
        a.assis = r.assis && d < 0.3;
      } else { a.pos.copy(r.pos); a.ryCible = r.ry; a.marche = false; a.assis = r.assis; }
    }
    let dy = a.ryCible - a.ry; dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    a.ry += dy * Math.min(1, dt * 9);
    if (a.marche) a.phase += dt * 10.5;
  }
  const _tete = new THREE.Vector3(), _co = new THREE.Vector3();
  function majAgents(t, dt) {
    if (!inst) return;
    let i = 0, f = 0;
    for (let k = 0; k < agents.length; k++) {
      const a = agents[k];
      if (!a.pos) continue;
      if (dt) avancerAgent(a, t, dt);
      const app = a.apparition, ech = app != null ? Math.max(0.001, app) : 1;
      let bob = 0;
      if (a.marche) bob = Math.abs(Math.sin(a.phase)) * 0.085;
      else if (a.assis && a.status === 'working') bob = Math.abs(Math.sin(t * 6 + a.ph)) * 0.04;
      else if (!a.assis && a.kind !== 'attente') bob = Math.sin(t * 1.4 + a.ph) * 0.02;
      let saut = 0;
      if (a.saut) { const s = (t - a.saut) / 0.45; if (s >= 1 || s < 0) a.saut = 0; else saut = Math.sin(Math.PI * s) * 0.45; }
      const y0 = a.pos.y + bob + saut + (app != null ? (app - 1) * 1.5 : 0);
      _q.setFromEuler(_e.set(a.marche ? 0.1 : 0, a.ry, a.marche ? Math.sin(a.phase) * 0.06 : 0, 'YXZ'));
      _s.setScalar(ech); _p.set(a.pos.x, y0, a.pos.z);
      _tete.set(0, 1.5 * ech, 0).applyQuaternion(_q).add(_p);
      if (a.kind === 'attente') {
        _v.set(0, 0.68 * ech, 0).applyQuaternion(_q).add(_p); _m.compose(_v, _q, _s); inst.fantomeC.setMatrixAt(f, _m);
        _m.compose(_tete, _q, _s); inst.fantomeT.setMatrixAt(f, _m);
        f++;
      } else {
        if (!a.c3 || a.c3s !== a.status) { a.c3 = new THREE.Color(a.couleur || '#9DB4FF'); if (a.status === 'paused') a.c3.lerp(GRIS_PAUSE, 0.65); a.c3s = a.status; }
        _v.set(0, 0.68 * ech, 0).applyQuaternion(_q).add(_p); _m.compose(_v, _q, _s); inst.corps.setMatrixAt(i, _m); inst.corps.setColorAt(i, a.c3);
        _m.compose(_tete, _q, _s); inst.tete.setMatrixAt(i, _m); inst.tete.setColorAt(i, a.c3);
        for (let j = 0; j < 2; j++) { _v.set((j ? 0.14 : -0.14) * ech, 1.55 * ech, 0.34 * ech).applyQuaternion(_q).add(_p); _m.compose(_v, _q, _s); inst.yeux.setMatrixAt(i * 2 + j, _m); }
        const cs = C_STATUT[a.status];
        const pulse = a.status === 'working' ? 1 + 0.25 * Math.sin(t * 4 + a.ph) : 1;
        _m.compose(_v.set(_tete.x, _tete.y + 0.78 * ech + (a.status === 'working' ? Math.sin(t * 2.4 + a.ph) * 0.06 : 0), _tete.z), _q.identity(), _s.setScalar(cs ? ech * pulse : 0.0001)); inst.statut.setMatrixAt(i, _m);
        inst.statut.setColorAt(i, cs || BLANC);
        const sol = hauteurSol(a);
        _m.compose(_v.set(a.pos.x, sol + 0.025, a.pos.z), _q.identity(), _s.setScalar(ech * (a.marche ? 0.9 + 0.1 * Math.cos(a.phase * 2) : 1))); inst.ombres.setMatrixAt(i, _m);
        i++;
      }
      const pa = posAgent.get(a.id); if (pa) pa.set(_tete.x, _tete.y + 0.4, _tete.z); else posAgent.set(a.id, new THREE.Vector3(_tete.x, _tete.y + 0.4, _tete.z));
    }
    ['corps', 'tete', 'yeux', 'statut', 'ombres', 'fantomeC', 'fantomeT'].forEach(function (k) { inst[k].instanceMatrix.needsUpdate = true; if (inst[k].instanceColor) inst[k].instanceColor.needsUpdate = true; });
  }

  /* ── ce qui parle : les bulles « … », les enveloppes qui volent, les ondes ── */
  const texBulles = [0, 1, 2].map(textureBulle);
  const bulles = [];
  for (let k = 0; k < 10; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBulles[0], transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })); s.scale.set(1.2, 0.9, 1); s.renderOrder = 7; s.visible = false; monde.add(s); bulles.push({ s: s, a: null, debut: 0, fin: 0 }); }
  function parler(a, debut, fin) {
    if (calme) return;
    const b = bulles.find(function (x) { return x.fin < horloge; }) || bulles[0];
    b.a = a; b.debut = debut; b.fin = fin;
  }
  function animerBulles(t) {
    bulles.forEach(function (b) {
      const actif = b.a && t >= b.debut - 0.2 && t <= b.fin + 0.2;
      if (!actif) { if (b.s.visible) b.s.visible = false; return; }
      const p = posAgent.get(b.a.id); if (!p) { b.s.visible = false; return; }
      const k = Math.min(borne((t - b.debut + 0.2) / 0.2, 0, 1), borne((b.fin + 0.2 - t) / 0.2, 0, 1));
      b.s.visible = true; b.s.material.opacity = k;
      b.s.material.map = texBulles[Math.floor(t * 3.2) % 3];
      b.s.position.set(p.x, p.y + 0.95 + Math.sin(t * 2.2) * 0.05, p.z);
      b.s.scale.set(1.2 * (0.7 + 0.3 * k), 0.9 * (0.7 + 0.3 * k), 1);
    });
  }
  const COUL_VOL = { bleu: '#2B59E8', or: '#E5A92E', rouge: '#E5484D' };
  const texEnv = {}, texPts = {};
  Object.keys(COUL_VOL).forEach(function (k) { texEnv[k] = textureEnveloppe(COUL_VOL[k]); texPts[k] = texturePoint(COUL_VOL[k]); });
  const vols = [], ondes = [];
  function genreDe(g) { return g === 'alerte' ? 'rouge' : g === 'decision' || g === 'proposition' ? 'or' : 'bleu'; }
  function boardPos() { const t = batiments.get('groupe'); return t && t.board ? t.board : null; }
  function enveloppe(de, vers, genre) {
    const a = de === 'louis' ? boardPos() : posAgent.get(de);
    const b = vers === 'louis' ? boardPos() : posAgent.get(vers);
    if (!a || !b || vols.length > 24) return;
    const k = genreDe(genre);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEnv[k], transparent: true, depthWrite: false, toneMapped: false }));
    s.scale.set(0.01, 0.01, 1); s.renderOrder = 8; monde.add(s);
    const traine = [];
    for (let j = 0; j < 5; j++) { const tr = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPts[k], transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 - j * 0.1 })); const e = 0.7 - j * 0.1; tr.scale.set(e, e, 1); tr.renderOrder = 7; monde.add(tr); traine.push(tr); }
    const d = a.distanceTo(b), haut = Math.max(a.y, b.y) + 2.5 + d * 0.22;
    vols.push({ s: s, traine: traine, a: a.clone(), b: b.clone(), c: new THREE.Vector3((a.x + b.x) / 2, haut, (a.z + b.z) / 2), t0: performance.now(), d: Math.min(3400, 1100 + d * 26), hist: [], vers: vers, couleur: COUL_VOL[k] });
  }
  function onde(pos, couleur, auSol, taille) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    m.position.copy(pos); m.renderOrder = 6;
    if (auSol) m.rotation.x = -Math.PI / 2; else m.lookAt(camera.position);
    monde.add(m); ondes.push({ m: m, t0: performance.now(), taille: taille || 3, d: auSol ? 650 : 750 });
  }
  const _bz = new THREE.Vector3();
  function animerVols(maintenant) {
    for (let i = vols.length - 1; i >= 0; i--) {
      const v = vols[i]; const k = Math.min(1, (maintenant - v.t0) / v.d), e = easeInOut(k);
      _bz.copy(v.a).multiplyScalar((1 - e) * (1 - e)).addScaledVector(v.c, 2 * (1 - e) * e).addScaledVector(v.b, e * e);
      v.s.position.copy(_bz);
      const gonfle = Math.min(1, k * 7), e2 = 1.1 * easeOutBack(gonfle);
      v.s.scale.set(e2, e2 * 0.75, 1);
      v.s.material.rotation = Math.sin(maintenant / 260 + i) * 0.18 * (1 - k);
      v.hist.unshift(_bz.clone()); if (v.hist.length > 16) v.hist.pop();
      v.traine.forEach(function (tr, j) { const h = v.hist[Math.min(v.hist.length - 1, (j + 1) * 3)]; if (h) tr.position.copy(h); });
      if (k >= 1) {
        onde(v.b, v.couleur, false, 3.2);
        if (v.vers === 'louis') { const t = batiments.get('groupe'); if (t) t.flash = horloge; }
        else { const r = parId.get(v.vers); if (r && !r.mouv && !calme) r.saut = horloge; }
        monde.remove(v.s); v.s.material.dispose(); v.traine.forEach(function (tr) { monde.remove(tr); tr.material.dispose(); }); vols.splice(i, 1);
      }
    }
    for (let i = ondes.length - 1; i >= 0; i--) {
      const o = ondes[i]; const k = (maintenant - o.t0) / o.d;
      if (k >= 1) { monde.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); ondes.splice(i, 1); continue; }
      o.m.scale.setScalar(1 + easeInOut(k) * o.taille); o.m.material.opacity = 0.9 * (1 - k) * (1 - k);
    }
  }
  // Un message arrive : entre collègues de la même maison, on se lève ; sinon, une enveloppe vole
  function impulsion(de, vers, genre) {
    const A = parId.get(de), B = vers && vers !== 'louis' ? parId.get(vers) : null;
    if (A && B && A.bat === B.bat && !calme) {
      if ((genre === 'ordre' || genre === 'proposition' || genre === 'decision') && reunion(A, B)) return;
      if (visite(A, B)) return;
    }
    enveloppe(de, vers || 'louis', genre);
  }

  /* ── la caméra : des ressorts, ni à-coup ni arrêt sec ── */
  let L = 1, H = 1;
  const vue = { cx: 8, cy: 6, cz: 8, lz: Math.log(0.8), az: 45 };     // ce qu'on voit
  const but = Object.assign({}, vue);                                 // où l'on va
  const vit = { cx: 0, cy: 0, cz: 0, lz: 0, az: 0 };
  const CLES = ['cx', 'cy', 'cz', 'lz', 'az'];
  let raideur = 30, ancreZoom = null, inertie = null, suivi = null;
  const zoomVu = function () { return Math.exp(vue.lz); };
  function ressorts(dt) {
    let bouge = false;
    for (let i = 0; i < CLES.length; i++) {
      const k = CLES[i], x = vue[k] - but[k];
      if (Math.abs(x) < 1e-5 && Math.abs(vit[k]) < 1e-5) { if (vue[k] !== but[k]) { vue[k] = but[k]; bouge = true; } vit[k] = 0; continue; }
      bouge = true;
      if (calme) { vue[k] = but[k]; vit[k] = 0; continue; }
      const e = Math.exp(-raideur * dt), tt = (vit[k] + raideur * x) * dt;
      vue[k] = but[k] + (x + tt) * e;
      vit[k] = (vit[k] - raideur * tt) * e;
    }
    return bouge;
  }
  function figer() { CLES.forEach(function (k) { but[k] = vue[k]; vit[k] = 0; }); ancreZoom = null; inertie = null; suivi = null; }
  const _cible = new THREE.Vector3();
  function placerCamera() {
    const az = vue.az * RAD, R = 220;
    camera.position.set(vue.cx + R * Math.cos(ELEVATION) * Math.cos(az), vue.cy + R * Math.sin(ELEVATION), vue.cz + R * Math.cos(ELEVATION) * Math.sin(az));
    camera.lookAt(_cible.set(vue.cx, vue.cy, vue.cz));
    const asp = L / H, hv = BASE_VUE / zoomVu() * (asp < 0.8 ? 1.25 : 1);
    camera.left = -hv * asp / 2; camera.right = hv * asp / 2; camera.top = hv / 2; camera.bottom = -hv / 2;
    camera.updateProjectionMatrix();
  }
  function cadrer() {
    const r = conteneur.getBoundingClientRect(); L = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(L, H, false); placerCamera();
  }
  function parPixel(zoom) { return (BASE_VUE / zoom * (L / H < 0.8 ? 1.25 : 1)) / H; }
  // un écart à l'écran (en pixels, depuis le centre) devient un écart au sol, dans le plan de la cible
  function decalage(sx, sy, zoom, az) {
    const k = parPixel(zoom), a = az * RAD;
    const av = -sy * k / Math.sin(ELEVATION);
    return { x: Math.sin(a) * sx * k - Math.cos(a) * av, z: -Math.cos(a) * sx * k - Math.sin(a) * av };
  }
  function borner() {
    const m = DEMI - 5;
    but.cx = borne(but.cx, -m, m); but.cz = borne(but.cz, -m, m);
    but.lz = borne(but.lz, Math.log(ZOOM_MIN), Math.log(ZOOM_MAX));
    but.az = borne(but.az, 8, 82);
  }
  function glisser(dx, dy) { const o = decalage(dx, dy, zoomVu(), vue.az); but.cx -= o.x; but.cz -= o.z; borner(); }
  function pointEcran(x, y) { const r = renderer.domElement.getBoundingClientRect(); return { sx: x - r.left - r.width / 2, sy: y - r.top - r.height / 2 }; }
  // zoomer en gardant sous le doigt le même point de la maquette, du début à la fin du mouvement
  function zoomVers(lz, x, y, w) {
    suivi = null; inertie = null;
    const e = x != null ? pointEcran(x, y) : { sx: 0, sy: 0 };
    if (!ancreZoom || Math.abs(ancreZoom.sx - e.sx) > 3 || Math.abs(ancreZoom.sy - e.sy) > 3) {
      const o = decalage(e.sx, e.sy, zoomVu(), vue.az);
      ancreZoom = { px: vue.cx + o.x, pz: vue.cz + o.z, sx: e.sx, sy: e.sy };
      but.cx = vue.cx; but.cz = vue.cz; vit.cx = vit.cz = 0;
    }
    but.lz = lz; borner(); raideur = w || 14;
  }
  function decalagePanneau(zoom, az, quoi) {
    const k = parPixel(zoom);
    if (innerWidth >= 880) { const px = quoi === 'tiroir' ? Math.min(480, innerWidth) / 2 : 206, a = az * RAD; return { x: Math.sin(a) * px * k, y: 0, z: -Math.cos(a) * px * k }; }
    return { x: 0, y: -(H * (quoi === 'tiroir' ? 0.36 : 0.26) * k) / Math.cos(ELEVATION), z: 0 };
  }
  function vueEnsemble() {
    const asp = L / H;
    if (asp < 0.8) return { x: 17, y: 2, z: 17, zoom: 0.8, az: 45 };
    return { x: 12, y: 4, z: 12, zoom: asp > 1.9 ? 0.78 : 0.7, az: 45 };
  }
  function viser(c) {
    suivi = null; inertie = null; ancreZoom = null;
    let d = null;
    if (!c || c.type === 'ensemble') d = vueEnsemble();
    else if (c.type === 'company' || c.type === 'site') { const b = batiments.get(c.id); if (!b) return; d = { x: b.centre.x, y: b.centre.y, z: b.centre.z, zoom: b.campus && L / H < 0.8 ? 1.28 : b.zoomVue, az: but.az }; }
    else if (c.type === 'roof') { const b = batiments.get('groupe'); if (!b) return; d = { x: b.board.x, y: b.board.y - 3, z: b.board.z, zoom: 2.1, az: but.az }; }
    else if (c.type === 'agent') { const p = posAgent.get(c.id); if (!p) return; d = { x: p.x, y: p.y - 1.4, z: p.z, zoom: 3.1, az: but.az }; suivi = c.id; const a = parId.get(c.id); if (a && !calme) a.saut = horloge; }
    if (!d) return;
    if (c && c.type !== 'ensemble') { const o = decalagePanneau(d.zoom, d.az, c.type === 'agent' ? 'tiroir' : 'panneau'); d.x += o.x; d.y += o.y; d.z += o.z; }
    but.cx = d.x; but.cy = d.y; but.cz = d.z; but.lz = Math.log(d.zoom); but.az = d.az; borner();
    raideur = 5.2;
  }
  function suivre() {
    if (!suivi) return;
    const p = posAgent.get(suivi); if (!p) { suivi = null; return; }
    const z = Math.exp(but.lz), o = decalagePanneau(z, but.az, 'tiroir');
    but.cx = p.x + o.x; but.cy = p.y - 1.4 + o.y; but.cz = p.z + o.z; borner();
  }

  // les gestes
  const doigts = new Map(); let geste = null, deplace = 0, traces = [], dernierTap = null;
  const el = renderer.domElement;
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  el.addEventListener('pointerdown', function (e) {
    el.setPointerCapture(e.pointerId); el.focus({ preventScroll: true });
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    figer(); raideur = 34; deplace = 0;
    traces = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
    if (doigts.size === 2) { const [p1, p2] = Array.from(doigts.values()); geste = { type: 'pince', d: Math.hypot(p1.x - p2.x, p1.y - p2.y), ang: Math.atan2(p2.y - p1.y, p2.x - p1.x), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 }; }
    else geste = { type: e.button === 2 || e.ctrlKey || e.shiftKey ? 'tourner' : 'glisser', t0: performance.now() };
  });
  el.addEventListener('pointermove', function (e) {
    if (!doigts.has(e.pointerId)) { survolEnAttente = { x: e.clientX, y: e.clientY }; return; }
    const avant = doigts.get(e.pointerId); doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!geste) return;
    if (geste.type === 'pince' && doigts.size === 2) {
      const [p1, p2] = Array.from(doigts.values());
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), ang = Math.atan2(p2.y - p1.y, p2.x - p1.x), cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
      glisser(cx - geste.cx, cy - geste.cy);
      const e2 = pointEcran(cx, cy), oA = decalage(e2.sx, e2.sy, Math.exp(but.lz), but.az), P = { x: but.cx + oA.x, z: but.cz + oA.z };
      let da = ang - geste.ang; da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      but.lz = borne(but.lz + Math.log(Math.max(1, d) / Math.max(1, geste.d)), Math.log(ZOOM_MIN), Math.log(ZOOM_MAX));
      but.az = borne(but.az - da / RAD * 0.9, 8, 82);
      const oB = decalage(e2.sx, e2.sy, Math.exp(but.lz), but.az); but.cx = P.x - oB.x; but.cz = P.z - oB.z; borner();
      geste.d = d; geste.ang = ang; geste.cx = cx; geste.cy = cy; deplace += 10;
      return;
    }
    const dx = e.clientX - avant.x, dy = e.clientY - avant.y;
    deplace += Math.abs(dx) + Math.abs(dy);
    if (geste.type === 'tourner') { but.az = borne(but.az - dx * 0.3, 8, 82); }
    else if (geste.type === 'glisser') { glisser(dx, dy); traces.push({ t: performance.now(), x: e.clientX, y: e.clientY }); if (traces.length > 8) traces.shift(); }
    if (deplace > 5) bulleHud(null);
  });
  const fin = function (e) {
    if (!doigts.has(e.pointerId)) return;
    doigts.delete(e.pointerId);
    if (geste && geste.type === 'pince') {
      if (doigts.size === 1) { const p = Array.from(doigts.values())[0]; geste = { type: 'glisser', t0: performance.now() }; traces = [{ t: performance.now(), x: p.x, y: p.y }]; } else geste = null;
      return;
    }
    if (doigts.size) return;
    if (geste && geste.type === 'glisser') {
      if (deplace < 7 && e.type === 'pointerup' && performance.now() - geste.t0 < 650) tape(e.clientX, e.clientY);
      else lancerInertie();
    }
    geste = null;
  };
  function lancerInertie() {
    const t = performance.now(), der = traces[traces.length - 1];
    if (!der || t - der.t > 70 || traces.length < 2) return;
    let pre = traces[0];
    for (let i = traces.length - 1; i >= 0; i--) { if (t - traces[i].t > 100) break; pre = traces[i]; }
    const dt = Math.max(16, der.t - pre.t) / 1000, vx = (der.x - pre.x) / dt, vy = (der.y - pre.y) / dt;
    if (Math.hypot(vx, vy) > 80) { inertie = { vx: borne(vx, -4000, 4000), vy: borne(vy, -4000, 4000) }; raideur = 34; }
  }
  el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
  el.addEventListener('pointerleave', function () { if (!doigts.size) { bulleHud(null); survolEnAttente = null; marquer(null); survole = null; el.style.cursor = ''; } });
  el.addEventListener('wheel', function (e) {
    e.preventDefault();
    const pas = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomVers(but.lz - pas * (e.ctrlKey ? 0.011 : 0.0016), e.clientX, e.clientY, e.ctrlKey ? 22 : 13);
  }, { passive: false });
  el.addEventListener('keydown', function (e) {
    const pas = 90;
    raideur = 11; suivi = null; inertie = null; ancreZoom = null;
    if (e.key === 'ArrowLeft') glisser(pas, 0); else if (e.key === 'ArrowRight') glisser(-pas, 0); else if (e.key === 'ArrowUp') glisser(0, pas); else if (e.key === 'ArrowDown') glisser(0, -pas);
    else if (e.key === '+' || e.key === '=') zoomVers(but.lz + Math.log(1.3)); else if (e.key === '-') zoomVers(but.lz - Math.log(1.3));
    else if (e.key === 'q' || e.key === 'Q') but.az = borne(but.az + 15, 8, 82); else if (e.key === 'e' || e.key === 'E') but.az = borne(but.az - 15, 8, 82);
    else return;
    e.preventDefault();
  });

  /* ── survol et clic ── */
  let survole = null, survolEnAttente = null, agentSurvole = null;
  const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SOL);
  function rayon(x, y) { const r = el.getBoundingClientRect(); _ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1); _ray.setFromCamera(_ndc, camera); }
  function viseSous(x, y) {
    rayon(x, y);
    if (inst) {
      const hits = _ray.intersectObjects([inst.corps, inst.tete, inst.fantomeC, inst.fantomeT], false);
      if (hits.length) { const h = hits[0]; const ids = h.object === inst.corps || h.object === inst.tete ? inst.ids : inst.idsF; if (ids[h.instanceId]) return { type: 'agent', id: ids[h.instanceId] }; }
    }
    const h2 = _ray.intersectObjects(pickables, false);
    if (h2.length) { const toit = h2.find(function (h) { return h.object.userData.type === 'roof'; }); return (toit || h2[0]).object.userData; }
    return null;
  }
  function traiterSurvol() {
    if (!survolEnAttente) return;
    const { x, y } = survolEnAttente; survolEnAttente = null;
    const t = viseSous(x, y);
    const cle = t ? t.type + ':' + t.id : null;
    if (cle !== survole) {
      survole = cle; marquer(t); el.style.cursor = t ? 'pointer' : '';
      agentSurvole = t && t.type === 'agent' ? parId.get(t.id) : null;
      if (agentSurvole && !agentSurvole.mouv && !calme) agentSurvole.saut = horloge;
    }
    bulleHud(t, x, y);
  }
  function bulleHud(t, x, y) { if (rappels.surSurvol) rappels.surSurvol(t, { x: x, y: y }); }
  let selection = null, viseCle = null;
  function marquer(t) { viseCle = t ? (t.type === 'roof' ? 'groupe' : t.type === 'company' || t.type === 'site' ? t.id : null) : null; }
  const anneauAgent = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 40), new THREE.MeshBasicMaterial({ color: '#2B59E8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  anneauAgent.rotation.x = -Math.PI / 2; anneauAgent.renderOrder = 2; monde.add(anneauAgent);
  function animerLueurs(t, dt) {
    const k = 1 - Math.exp(-dt * 12);
    batiments.forEach(function (b) {
      const choisi = selection && selection.id === b.id;
      const cible = viseCle === b.id ? 0.17 : choisi ? 0.09 + 0.04 * Math.sin(t * 2.4) : 0;
      const pulse = b.clic ? borne(1 - (t - b.clic) / 0.5, 0, 1) * 0.22 : 0;
      b.lueur = (b.lueur || 0) + (cible + pulse - (b.lueur || 0)) * k;
      b.survol.material.opacity = b.lueur;
      b.survol.visible = b.lueur > 0.004;
    });
    const a = agentSurvole || (suivi && parId.get(suivi));
    const op = a ? (agentSurvole ? 0.85 : 0.55) : 0;
    anneauAgent.material.opacity += (op - anneauAgent.material.opacity) * k;
    if (a && a.pos) { anneauAgent.position.set(a.pos.x, hauteurSol(a) + 0.035, a.pos.z); anneauAgent.scale.setScalar(1 + 0.08 * Math.sin(t * 5)); }
    anneauAgent.visible = anneauAgent.material.opacity > 0.01;
  }
  // une tape : l'onde au sol là où le doigt touche, puis le choix (deux tapes sur le vide : on s'approche)
  function tape(x, y) {
    const t = viseSous(x, y), maintenant = performance.now();
    rayon(x, y);
    const p = _ray.ray.intersectPlane(_plan, new THREE.Vector3());
    if (p && !calme) onde(p.add(new THREE.Vector3(0, 0.05, 0)), '#2B59E8', true, 2.6);
    if (t && (t.type === 'company' || t.type === 'site' || t.type === 'roof')) { const b = batiments.get(t.type === 'roof' ? 'groupe' : t.id); if (b) b.clic = horloge; }
    if (!t && dernierTap && maintenant - dernierTap.t < 340 && Math.hypot(x - dernierTap.x, y - dernierTap.y) < 30) { dernierTap = null; zoomVers(but.lz + Math.log(1.9), x, y, 9); return; }
    dernierTap = t ? null : { t: maintenant, x: x, y: y };
    if (rappels.surChoix) rappels.surChoix(t);
  }

  /* ── le jour et la nuit ── */
  let nuit = document.documentElement.dataset.theme === 'nuit' ? 1 : 0, nuitCible = nuit;
  const blanc = new THREE.Color('#ffffff'), teinteNuit = new THREE.Color('#3B4868');
  function eclairer(h) {
    // le soleil suit l'heure de la Guadeloupe : est le matin, ouest le soir
    const a = borne((h - 6) / 12, 0, 1);
    const ang = Math.PI * (0.15 + 0.7 * a);
    soleil.position.set(Math.cos(ang) * 90 + 20, 70 + Math.sin(ang) * 40, -50 + Math.sin(ang) * 30 + 70);
    soleil.target.position.set(0, 0, 0); soleil.target.updateMatrixWorld();
    ombresSales = true;
  }
  function appliquerNuit(k) {
    matBase.color.copy(blanc).lerp(teinteNuit, k);
    matAgent.color.copy(blanc).lerp(new THREE.Color('#8EA3D8'), k * 0.6);
    ciel.intensity = 1.25 - 0.78 * k; ciel.color.set(k > 0.5 ? '#9DB2FF' : '#FFFFFF'); ciel.groundColor.copy(new THREE.Color('#cdd6e4')).lerp(new THREE.Color('#0B1328'), k);
    soleil.intensity = 2.3 - 1.55 * k; soleil.color.copy(blanc).lerp(new THREE.Color('#9FB6FF'), k);
    appoint.intensity = 0.45 + 0.2 * k;
    matVitre.emissiveIntensity = 1.35 * k; matVitre.color.copy(blanc).lerp(new THREE.Color('#5E6E9C'), k);
    matVerre.emissiveIntensity = 0.04 + 0.55 * k; matVerre.opacity = 0.4 + 0.15 * k;
    matVitreAnneau.emissiveIntensity = 0.9 * k; matVitreAnneau.opacity = 0.26 + 0.14 * k;
    matLampe.emissiveIntensity = 2.2 * k; matPhare.emissiveIntensity = 2.4 * k;
    matHouppe.color.copy(blanc).lerp(teinteNuit, k); matTronc.color.set(C.tronc).lerp(teinteNuit, k);
    matOmbre.opacity = 1 - 0.5 * k;
    renderer.toneMappingExposure = 1.02 + 0.12 * k;
  }

  /* ── les données ── */
  let dernierCos = '';
  function maj(etat) {
    const cos = (etat.companies || []).filter(function (c) { return c.status === 'active' || c.status === 'proposee'; });
    const sig = cos.map(function (c) { return c.id + ':' + c.status; }).join(',') + '|' + (etat.agents || []).map(function (a) { return a.id + ':' + a.company_id + ':' + a.kind; }).join(',');
    if (sig !== dernierCos) {
      dernierCos = sig;
      batiments.forEach(function (b) { monde.remove(b.groupe); liberer(b.groupe); }); batiments.clear(); pickables.length = 0; animes.length = 0; pieces.length = 0; campus = null;
      attribuerLots(cos);
      cos.forEach(function (co) {
        const ag = (etat.agents || []).filter(function (a) { return a.company_id === co.id; });
        const b = co.status === 'proposee' ? construireChantier(co) : co.id === 'groupe' ? construireTour(co) : co.id === 'novalemo' ? construireCampus(co, ag) : construirePiece(co, ag);
        b.couleur = co.color; batiments.set(co.id, b);
        if (b.campus) campus = b;
      });
      const couleurs = {}; cos.forEach(function (c) { couleurs[c.id] = c.color; });
      poserAgents((etat.agents || []).map(function (a) { const c = new THREE.Color(couleurs[a.company_id] || '#9DB4FF'); return Object.assign({}, a, { couleur: '#' + c.lerp(new THREE.Color('#ffffff'), 0.25).getHexString() }); }));
      ombresSales = true;
      // tous les shaders d'un coup maintenant (bulles et enveloppes comprises), pas un à-coup au premier message
      bulles[0].s.visible = true;
      try { if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) renderer.compileAsync(scene, camera).catch(function () {}); else renderer.compile(scene, camera); } catch (e) { /* rien */ }
      bulles[0].s.visible = false;
    } else {
      const n = new Map((etat.agents || []).map(function (a) { return [a.id, a]; }));
      agents.forEach(function (a) { const x = n.get(a.id); if (x) { if (x.status !== a.status && x.status === 'working' && !a.activite) a.saut = horloge; a.status = x.status; a.name = x.name; a.parent_id = x.parent_id; } });
    }
    const t = batiments.get('groupe'); if (t) t.decisions = etat.decisions || 0;
    if (campus && campus.tuiles) {
      const enLigne = Math.min(24, etat.en_ligne || 0), apercus = Math.min(24 - enLigne, etat.apercus || 0);
      for (let i = 0; i < 24; i++) campus.tuiles.setColorAt(i, new THREE.Color(i < enLigne ? '#2EE3AF' : i < enLigne + apercus ? '#A9C1FF' : (nuit > 0.5 ? '#26345C' : '#E8EEF7')));
      campus.tuiles.instanceColor.needsUpdate = true;
    }
    majEcrans();
    if (etat.heure != null) eclairer(etat.heure);
  }
  // les écrans s'allument devant ceux qui travaillent
  let ecrans = null;
  function majEcrans() {
    const liste = agents.filter(function (a) { return a.ecran; });
    if (!ecrans || ecrans.count !== liste.length) {
      if (ecrans) { monde.remove(ecrans); ecrans.dispose(); }
      ecrans = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.54), matEcran, Math.max(1, liste.length)); ecrans.count = liste.length; monde.add(ecrans);
    }
    liste.forEach(function (a, i) {
      _m.compose(_v.set(a.ecran.x, a.ecran.y, a.ecran.z), _q.setFromAxisAngle(UP, a.ecran.ry || 0), _s.set(1, 1, 1)); ecrans.setMatrixAt(i, _m);
      ecrans.setColorAt(i, new THREE.Color(a.status === 'working' ? '#5C86FF' : a.status === 'error' ? '#FF7A80' : nuit > 0.5 ? '#1B2747' : '#4B5670'));
    });
    ecrans.instanceMatrix.needsUpdate = true; if (ecrans.instanceColor) ecrans.instanceColor.needsUpdate = true;
  }

  /* ── l'arrivée : les bâtiments sortent du socle, puis les agents arrivent ── */
  let intro = null;
  function lancerIntro() {
    if (calme) return;
    intro = { t0: performance.now() };
    batiments.forEach(function (b) { b.groupe.scale.set(1, 0.001, 1); });
    agents.forEach(function (a) { a.apparition = 0; });
    const v = vueEnsemble();
    vue.cx = v.x; vue.cy = v.y; vue.cz = v.z; vue.az = v.az + 16; vue.lz = Math.log(v.zoom * 0.8);
    but.cx = v.x; but.cy = v.y; but.cz = v.z; but.az = v.az; but.lz = Math.log(v.zoom);
    CLES.forEach(function (k) { vit[k] = 0; });
    raideur = 2.7;
    prochaineBalade = horloge + 6; prochaineVisite = horloge + 14;
  }
  function avancerIntro(t) {
    if (!intro) return;
    const dt = t - intro.t0;
    let fini = true;
    batiments.forEach(function (b) {
      const p = b.groupe.position; const retard = 120 + (Math.hypot(p.x, p.z) / ESPACE) * 170 + (b.id === 'groupe' ? 0 : 160);
      const k = borne((dt - retard) / 750, 0, 1);
      b.groupe.scale.y = Math.max(0.001, easeOutBack(k));
      if (k < 1) fini = false;
    });
    agents.forEach(function (a, i) { const k = borne((dt - 900 - (i % 12) * 45) / 420, 0, 1); a.apparition = easeOutBack(k); if (k < 1) fini = false; });
    ombresSales = true;
    if (fini) { intro = null; agents.forEach(function (a) { a.apparition = null; }); }
  }

  /* ── la boucle, et la qualité qui s'adapte ── */
  let actif = true, horloge = 0, derniere = performance.now(), ema = 1 / 60, lent = 0, depuisReglage = 0;
  function qualite(dt) {
    if (intro || horloge < 3 || window.__tourQualiteFixe) return;
    ema += (dt - ema) * 0.05; depuisReglage += dt;
    lent = ema > 1 / 40 ? lent + dt : Math.max(0, lent - dt * 0.5);
    if (lent > 1.6 && depuisReglage > 2.5) {
      lent = 0; depuisReglage = 0;
      if (pr > 1) { pr = Math.max(1, pr - 0.35); renderer.setPixelRatio(pr); cadrer(); }
      else if (soleil.castShadow) { soleil.castShadow = false; document.body.classList.add('perf-basse'); }
    }
  }
  const ancres = new Map(), _pv = new THREE.Vector3();
  function projeter(v, sortie) {
    _pv.copy(v).project(camera);
    sortie.x = (_pv.x + 1) / 2 * L; sortie.y = (1 - _pv.y) / 2 * H;
    sortie.visible = _pv.z > -1 && _pv.z < 1 && sortie.x > -200 && sortie.x < L + 200 && sortie.y > -120 && sortie.y < H + 160;
    return sortie;
  }
  const _haut = new THREE.Vector3();
  function boucle(tms) {
    const dt = Math.min(0.05, Math.max(0, (tms - derniere) / 1000)) * (window.__tourVitesse || 1); derniere = tms; horloge += dt;
    qualite(dt);
    if (inertie) { glisser(inertie.vx * dt, inertie.vy * dt); const f = Math.exp(-dt * 4.2); inertie.vx *= f; inertie.vy *= f; if (Math.hypot(inertie.vx, inertie.vy) < 14) inertie = null; }
    suivre();
    ressorts(dt);
    if (ancreZoom) {
      const o = decalage(ancreZoom.sx, ancreZoom.sy, zoomVu(), vue.az);
      but.cx = ancreZoom.px - o.x; but.cz = ancreZoom.pz - o.z; borner(); vue.cx = but.cx; vue.cz = but.cz; vit.cx = vit.cz = 0;
      if (Math.abs(vue.lz - but.lz) < 4e-4 && Math.abs(vit.lz) < 2e-3) ancreZoom = null;
    }
    placerCamera();
    avancerIntro(tms);
    traiterSurvol();
    if (Math.abs(nuit - nuitCible) > 0.001) { nuit += (nuitCible - nuit) * Math.min(1, dt * 1.6); appliquerNuit(nuit); }
    for (let i = 0; i < animes.length; i++) animes[i](horloge, dt);
    vivre();
    majAgents(horloge, dt);
    if (!calme) voitures.forEach(function (v) { v.s += v.vitesse * dt; placerVoiture(v); });
    animerVols(tms);
    animerBulles(horloge);
    animerLueurs(horloge, dt);
    if (ombresSales && soleil.castShadow) { renderer.shadowMap.needsUpdate = true; ombresSales = false; }
    renderer.render(scene, camera);
    batiments.forEach(function (b, id) {
      const an = projeter(b.ancre, ancres.get(id) || {}); an.dessous = !!b.ancreDessous; ancres.set(id, an);
      if (b.ancreHaut) ancres.set(id + ':haut', projeter(b.ancreHaut, ancres.get(id + ':haut') || {}));
      if (b.board) ancres.set('board', projeter(_haut.copy(b.board).add(_v.set(0, 3.4, 0)), ancres.get('board') || {}));
      if (b.secteurs) b.secteurs.forEach(function (s) { ancres.set('sec:' + s.id, projeter(s.ancre, ancres.get('sec:' + s.id) || {})); });
    });
    if (rappels.apresImage) rappels.apresImage();
  }
  function demarrer() { derniere = performance.now(); renderer.setAnimationLoop(boucle); }
  function arreter() { renderer.setAnimationLoop(null); }

  const ro = new ResizeObserver(function () { cadrer(); });
  ro.observe(conteneur);
  appliquerNuit(nuit); eclairer(12);
  const v0 = vueEnsemble();
  vue.cx = but.cx = v0.x; vue.cy = but.cy = v0.y; vue.cz = but.cz = v0.z; vue.lz = but.lz = Math.log(v0.zoom); vue.az = but.az = v0.az;
  cadrer();
  demarrer();
  document.addEventListener('visibilitychange', function () { if (document.hidden) arreter(); else if (actif) demarrer(); });
  window.__tourEtat = function () { return { marcheurs: marcheurs, promeneurs: promeneurs, enRoute: agents.filter(function (a) { return a.mouv; }).length, enPause: agents.filter(function (a) { return a.pause; }).length, vols: vols.length, pr: pr, ombres: soleil.castShadow, zoom: zoomVu() }; };

  return {
    maj: maj,
    viser: function (c) { selection = c && (c.type === 'company' || c.type === 'site') ? c : c && c.type === 'roof' ? { id: 'groupe' } : null; viser(c); },
    suivre: function (id) { if (!id) { if (suivi) { suivi = null; } } else viser({ type: 'agent', id: id }); },
    impulsion: impulsion,
    intro: lancerIntro,
    ancre: function (id) { return ancres.get(id); },
    secteurs: function () {
      if (!campus) return [];
      return SECTEURS.map(function (s) { return { id: s.id, nom: s.nom, teinte: s.teinte, ton: s.ton, agents: agents.filter(function (a) { return a.lieu === 'campus' && a.secteur === s.id; }).map(function (a) { return a.id; }) }; });
    },
    ecranAgent: function (id) { const p = posAgent.get(id); return p ? projeter(_haut.copy(p).add(_v.set(0, 1.2, 0)), {}) : null; },
    agentsDe: function (cid) { return agents.filter(function (a) { return a.company_id === cid; }).map(function (a) { return a.id; }); },
    zoom: function (k) { zoomVers(but.lz + Math.log(k)); },
    tourner: function (deg) { suivi = null; raideur = 6; but.az = borne(but.az + deg, 8, 82); },
    actif: function (on) { actif = on; if (on && !document.hidden) demarrer(); else arreter(); },
    theme: function (n) { nuitCible = n === 'nuit' ? 1 : 0; },
    heure: eclairer,
    zoomActuel: function () { return zoomVu(); }
  };
}
