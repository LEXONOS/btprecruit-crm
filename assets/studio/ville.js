// La petite ville d'une créatrice, dans le style de la ville de la tour : une maquette blanche posée sur un socle, des
// ombres douces. Dedans, son studio ouvert et son équipe, avec SES prénoms et SES couleurs ; devant, une rue avec des
// voitures garées ; à côté, une résidence fermée par une grille, avec une piscine au milieu.
// Chaque détail dit quelque chose de vrai : une coéquipière assise devant un écran allumé travaille sur une de ses
// vidéos ; quand une étape passe de l'une à l'autre, une feuille vole d'un bureau à l'autre ; quand un script l'attend,
// elle-même apparaît près du grand téléphone, qui montre sa dernière vidéo ; une vidéo prête, ce sont des confettis.
// Et il se passe des choses, de temps en temps : Mila recule dans le rétro d'une voiture garée et file sans laisser de
// mot ; celles qui n'ont rien à faire escaladent la grille de la résidence pour aller se baigner, jusqu'à ce que le
// voisin allume la lumière. Toucher quelqu'un : ce qu'elle fait ; le téléphone : la vidéo ; la voiture, la piscine...
// Glisser pour tourner, deux doigts (ou clic droit) pour se déplacer, pincer ou molette pour s'approcher, double-clic
// pour revenir. La boucle s'arrête quand la maquette n'est pas à l'écran ; moins d'animations si l'appareil le demande.
import * as THREE from '/assets/vendor/three-0.170.0.module.min.js';

const RAD = Math.PI / 180;
const PLANCHER = 0.35;                 // dessus du plancher du studio
const SOL = 0.14;                      // dessus du parvis et des trottoirs
const COUR = 0.3;                      // dessus de la cour de la résidence
const ELEVATION = 33 * RAD;
const ZMIN = 0.7, ZMAX = 3.4;
const MARCHE = 2.4;                    // unités par seconde
const SOCLE = { x: 3, z: 0.4, w: 42, d: 25.6 };
// le studio
const ALLEE = { a: -3.7, b: 0.75 };    // les allées entre les rangées de bureaux
const COULOIR = -2.4;                  // le couloir entre les bureaux et la table de l'équipe
const COULOIR_G = -14.65;              // et celui le long du mur de gauche
const SEUIL = 1.9;                     // juste devant le studio
const POSTES = { idees: [-12.6, -6.4], plume: [-8.8, -6.4], critique: [-5.0, -6.4], traduction: [-12.6, -1.6], realisation: [-8.8, -1.6], diffusion: [-5.0, -1.6] };
const RANG = { idees: 'a', plume: 'a', critique: 'a', traduction: 'b', realisation: 'b', diffusion: 'b' };
const TELEPHONE = { x: 0.9, z: -8.4 };
const TABLE = { x: 1.2, z: -3.9 };
// la rue
const PARVIS = { x0: -15.6, x1: 3.6, z0: 2.7, z1: 4.6 };
const RUE = { x0: -18, x1: 24, z0: 5.8, z1: 9.8 };
const VOIE = { aller: 7.95, retour: 6.6 };   // les voitures vers la droite roulent côté trottoir sud (à leur droite)
const BANCS = [{ x: -11.4, z: 4.0, ry: 0 }, { x: -6.2, z: 4.0, ry: 0 }];
const LAMPADAIRES = [[-14.2, 5.3], [-4.4, 5.3], [4.4, 5.3], [14.6, 5.3], [-9.4, 10.4], [21.4, 10.4]];
const GAREES = [{ x: -9.4, couleur: '#C9D6EA' }, { x: 8.6, couleur: '#F4EFE6', cible: true }, { x: 17.6, couleur: '#CFE7D9' }];
const Z_GAREE = 9.72;                  // à moitié sur le trottoir, comme dans la vraie vie
// la résidence
const RES = { x0: 5.2, x1: 21.6, z0: -10.7, z1: 3.8 };
const PISCINE = { x: 12.4, z: -1.9, w: 6.6, d: 3.2 };
const EAU = COUR + 0.05;            // l'eau affleure dans la margelle ; dessous, la cour cache le corps des nageuses
const ESCALADE = { x: [8.2, 9.4], dehors: 4.4, dedans: 3.1 };
const FENETRE = { x: 12.4, y: COUR + 3.05, z: -7.52 };
const C = {
  socle: '#F6F8FB', socleBas: '#D9E1EC', plancher: '#EEF2F8', mur: '#F2F5F9', murHaut: '#E6ECF4', bureau: '#FFFFFF', pied: '#C5CFDD',
  ecran: '#3B4659', chaise: '#D6DEE9', arbre: '#DFE8F6', arbreBleu: '#A9C1FF', tronc: '#C9D3E1', pelouse: '#D7ECDF',
  route: '#D6DEEA', marque: '#F8FAFD', trottoir: '#F1F4F9', bordure: '#E3E9F2', pave: '#E9EEF5', banc: '#E3E8F0', pot: '#E3E8F0', plante: '#A6D7BD',
  telephone: '#1E1828', table: '#FFFFFF', facade: '#F7F9FC', toit: '#E8EDF5', vitre: '#B7C7DC', grille: '#B5C1D2', cour: '#EEF2F7',
  margelle: '#FFFFFF', eau: '#7DB4FF', transat: '#FFFFFF', parasol: '#A9C1FF', roue: '#394457', pneu: '#2B3342', jante: '#D7DEE8', verre: '#9FB4CF'
};

/* ── l'assembleur : des pièces simples fusionnées en un maillage coloré par sommet ── */
const BOITE = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20).toNonIndexed();
const SPH = new THREE.IcosahedronGeometry(1, 2);
const CONE = new THREE.ConeGeometry(1, 1, 18).toNonIndexed();
const AXE_Y = new THREE.Vector3(0, 1, 0), AXE_X = new THREE.Vector3(1, 0, 0);
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
  boite(w, h, d, x, y, z, couleur, ry) { return this.ajouter(BOITE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromAxisAngle(AXE_Y, ry || 0), new THREE.Vector3(w, h, d)), couleur); }
  cylindre(r, h, x, y, z, couleur) { return this.ajouter(CYL, new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r)), couleur); }
  // un cylindre couché le long de z (une roue)
  roue(r, l, x, y, z, couleur) { return this.ajouter(CYL, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(AXE_X, Math.PI / 2), new THREE.Vector3(r, l, r)), couleur); }
  boule(r, x, y, z, couleur, sy) { return this.ajouter(SPH, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r * (sy || 1), r)), couleur); }
  cone(r, h, x, y, z, couleur) { return this.ajouter(CONE, new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r)), couleur); }
  forme(geo, couleur) { this.ajouter(geo, new THREE.Matrix4(), couleur); geo.dispose(); return this; }
  vide() { return !this.p.length; }
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
}
// un rectangle aux coins arrondis, extrudé (le socle, les tapis, les planchers)
function plaque(w, d, r, h, x, y, z) {
  const s = new THREE.Shape();
  const x0 = -w / 2, z0 = -d / 2;
  r = Math.min(r, w / 2 - 0.001, d / 2 - 0.001);
  s.moveTo(x0 + r, z0); s.lineTo(x0 + w - r, z0); s.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r); s.lineTo(x0 + w, z0 + d - r);
  s.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d); s.lineTo(x0 + r, z0 + d); s.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r); s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(Math.PI / 2); g.translate(x, y, z);
  return g.index ? g.toNonIndexed() : g;
}

/* ── les textures dessinées ── */
function toile(w, h, dessin) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  dessin(cv.getContext('2d'), cv);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rond = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
function clair(c) { const n = parseInt(String(c || '#888888').slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 160; }
function pale(c, k) { const a = new THREE.Color(c), b = new THREE.Color('#FFFFFF'); return '#' + a.lerp(b, k).getHexString(); }
function fonce(c, k) { const a = new THREE.Color(c), b = new THREE.Color('#1B2233'); return '#' + a.lerp(b, k).getHexString(); }
const POLICE = 'Geist, system-ui, -apple-system, sans-serif';
const textureOmbre = () => toile(128, 128, (g) => { const d = g.createRadialGradient(64, 64, 6, 64, 64, 64); d.addColorStop(0, 'rgba(20,36,72,0.30)'); d.addColorStop(0.55, 'rgba(20,36,72,0.11)'); d.addColorStop(1, 'rgba(20,36,72,0)'); g.fillStyle = d; g.fillRect(0, 0, 128, 128); });
const textureHalo = () => toile(128, 128, (g) => { const d = g.createRadialGradient(64, 64, 2, 64, 64, 64); d.addColorStop(0, 'rgba(255,214,150,0.85)'); d.addColorStop(0.4, 'rgba(255,196,120,0.32)'); d.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = d; g.fillRect(0, 0, 128, 128); });
// l'étiquette au-dessus d'une coéquipière (ou d'une voiture) : son prénom, et un point qui dit son état
function textureEtiquette(nom, couleur, etat) {
  return toile(320, 88, (g) => {
    g.font = '700 38px ' + POLICE;
    const w = Math.min(300, g.measureText(nom).width + (etat ? 74 : 48));
    const x = (320 - w) / 2;
    g.shadowColor = 'rgba(20,20,40,.28)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
    rond(g, x, 14, w, 58, 29); g.fillStyle = couleur; g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = clair(couleur) ? '#16121F' : '#FFFFFF'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(nom, x + (etat ? 50 : 24), 44);
    if (etat) { g.beginPath(); g.arc(x + 28, 44, 10, 0, Math.PI * 2); g.fillStyle = etat === 'bloque' ? '#F87171' : '#FFFFFF'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.18)'; g.stroke(); }
  });
}
const textureFeuille = (c) => toile(96, 96, (g) => {
  g.shadowColor = 'rgba(20,36,72,.28)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  rond(g, 22, 12, 52, 70, 7); g.fillStyle = '#FFFFFF'; g.fill(); g.shadowColor = 'transparent';
  g.lineWidth = 4; g.strokeStyle = c; rond(g, 22, 12, 52, 70, 7); g.stroke();
  g.lineCap = 'round'; [30, 42, 54, 66].forEach((y, i) => { g.beginPath(); g.moveTo(32, y); g.lineTo(i === 3 ? 52 : 64, y); g.stroke(); });
});
// une bulle de bande dessinée (style « choc » : un éclat au lieu d'un rond)
function textureBulle(texte, couleur, choc) {
  return toile(340, 130, (g) => {
    g.font = '800 36px ' + POLICE;
    const w = Math.min(320, g.measureText(texte).width + 48), x = (340 - w) / 2;
    g.shadowColor = 'rgba(20,36,72,.25)'; g.shadowBlur = 9; g.shadowOffsetY = 3;
    if (choc) {
      g.beginPath();
      const cx = 170, cy = 58, n = 14;
      for (let i = 0; i <= n * 2; i++) { const a = i * Math.PI / n, r = i % 2 ? 40 : 58; const rx = r * (w / 120); g.lineTo(cx + Math.cos(a) * Math.min(rx, 160), cy + Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#FFF4C7'; g.fill(); g.shadowColor = 'transparent'; g.lineWidth = 3; g.strokeStyle = couleur; g.stroke();
    } else {
      rond(g, x, 10, w, 64, 26); g.fillStyle = '#FFFFFF'; g.fill();
      g.beginPath(); g.moveTo(156, 72); g.lineTo(168, 96); g.lineTo(182, 72); g.closePath(); g.fill(); g.shadowColor = 'transparent';
    }
    g.fillStyle = couleur; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(texte, 170, choc ? 58 : 43);
  });
}
// le grand téléphone sans vignette : l'accroche de la dernière vidéo, dans sa couleur, comme à l'écran
function textureAccroche(texte, couleur) {
  return toile(360, 640, (g) => {
    const d = g.createLinearGradient(0, 0, 360, 640); d.addColorStop(0, pale(couleur, 0.05)); d.addColorStop(1, '#1A1024'); g.fillStyle = d; g.fillRect(0, 0, 360, 640);
    g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 40px ' + POLICE;
    const mots = String(texte || 'Ta prochaine vidéo').replace(/\*/g, '').split(/\s+/), lignes = []; let l = '';
    mots.forEach((m) => { const t = l ? l + ' ' + m : m; if (g.measureText(t).width > 300 && l) { lignes.push(l); l = m; } else l = t; });
    if (l) lignes.push(l);
    lignes.slice(0, 6).forEach((x, i, t) => { g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 6; g.fillText(x, 180, 300 - (t.length - 1) * 26 + i * 52); });
    g.shadowColor = 'transparent'; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(160, 520); g.lineTo(206, 548); g.lineTo(160, 576); g.closePath(); g.fill();
  });
}
const textureCarre = (c) => toile(32, 32, (g) => { g.fillStyle = c; rond(g, 4, 8, 24, 16, 3); g.fill(); });
const textureGoutte = () => toile(48, 48, (g) => { const d = g.createRadialGradient(24, 24, 2, 24, 24, 22); d.addColorStop(0, 'rgba(235,246,255,1)'); d.addColorStop(0.5, 'rgba(150,200,255,0.9)'); d.addColorStop(1, 'rgba(120,180,255,0)'); g.fillStyle = d; g.fillRect(0, 0, 48, 48); });
const textureAnneau = () => toile(128, 128, (g) => { g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke(); });
const textureAvion = () => toile(96, 96, (g) => { g.shadowColor = 'rgba(20,36,72,.3)'; g.shadowBlur = 6; g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(8, 50); g.lineTo(88, 14); g.lineTo(52, 86); g.lineTo(44, 58); g.closePath(); g.fill(); g.shadowColor = 'transparent'; g.fillStyle = '#D9E2EF'; g.beginPath(); g.moveTo(44, 58); g.lineTo(88, 14); g.lineTo(52, 66); g.closePath(); g.fill(); });
const textureAmpoule = () => toile(96, 120, (g) => {
  g.shadowColor = 'rgba(255,200,60,.9)'; g.shadowBlur = 22; g.fillStyle = '#FFE27A';
  g.beginPath(); g.arc(48, 46, 30, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = '#C5CFDD'; rond(g, 34, 74, 28, 22, 5); g.fill(); g.strokeStyle = '#A9B5C6'; g.lineWidth = 3; [80, 88].forEach((y) => { g.beginPath(); g.moveTo(36, y); g.lineTo(60, y); g.stroke(); });
});
const texturePanneau = () => toile(256, 96, (g) => {
  rond(g, 6, 6, 244, 84, 12); g.fillStyle = '#FFFFFF'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#C9D3E1'; g.stroke();
  g.fillStyle = '#B4433B'; g.font = '800 34px ' + POLICE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PRIVÉ', 128, 38);
  g.fillStyle = '#627287'; g.font = '600 18px ' + POLICE; g.fillText('Résidence Les Mouettes', 128, 68);
});

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const hasard = (graine) => { let s = graine % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; };
const angleVers = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export function creerStudio3D(conteneur, rappels) {
  rappels = rappels || {};
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.domElement.className = 'ville-toile';
  renderer.domElement.setAttribute('aria-label', 'Ton studio en 3D : ton équipe au travail, la rue, la résidence');
  renderer.domElement.setAttribute('role', 'img');
  conteneur.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcdd6e4, 1.3); scene.add(hemi);
  const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
  soleil.position.set(26, 44, 18); soleil.castShadow = true;
  soleil.target.position.set(SOCLE.x, 0, SOCLE.z); scene.add(soleil.target);
  soleil.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(soleil.shadow.camera, { left: -30, right: 30, top: 24, bottom: -24, near: 1, far: 130 });
  soleil.shadow.bias = -0.0006; soleil.shadow.normalBias = 0.03; soleil.shadow.radius = 4;
  scene.add(soleil);
  const appoint = new THREE.DirectionalLight(0xdfe8ff, 0.45); appoint.position.set(-40, 30, 40); scene.add(appoint);

  const matMaquette = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  const matFenetres = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.05, emissive: new THREE.Color('#FFC27A'), emissiveIntensity: 0 });
  const matVoisin = new THREE.MeshStandardMaterial({ color: C.vitre, roughness: 0.3, metalness: 0.05, emissive: new THREE.Color('#FFD08A'), emissiveIntensity: 0 });
  const matAmpoules = new THREE.MeshBasicMaterial({ color: '#E8EDF5', toneMapped: false });
  const texOmbre = textureOmbre(), texHalo = textureHalo(), texGoutte = textureGoutte(), texAnneau = textureAnneau();
  const jetables = [texOmbre, texHalo, texGoutte, texAnneau];
  const garder = (x) => { jetables.push(x); return x; };
  const cibles = [];                    // ce qu'on peut toucher

  /* ── la maquette ── */
  const a = new Assemblage();
  a.forme(plaque(SOCLE.w, SOCLE.d, 2.2, 1.3, SOCLE.x, 0, SOCLE.z), C.socle);
  a.forme(plaque(SOCLE.w + 0.6, SOCLE.d + 0.6, 2.4, 0.5, SOCLE.x, -1.3, SOCLE.z), C.socleBas);
  // le studio : plancher, mur du fond, mur de gauche (on voit dedans par les deux autres côtés)
  a.forme(plaque(19.4, 13.4, 0.6, PLANCHER, -6, PLANCHER, -4), C.plancher);
  a.boite(19.4, 3.2, 0.36, -6, PLANCHER, -10.52, C.mur); a.boite(19.4, 0.12, 0.42, -6, PLANCHER + 3.2, -10.52, C.murHaut);
  a.boite(0.36, 3.2, 13.4, -15.52, PLANCHER, -4, C.mur); a.boite(0.42, 0.12, 13.4, -15.52, PLANCHER + 3.2, -4, C.murHaut);
  // la table de l'équipe, avec ses chaises
  a.cylindre(1.25, 0.12, TABLE.x, PLANCHER + 1.0, TABLE.z, C.table); a.cylindre(0.12, 1.0, TABLE.x, PLANCHER, TABLE.z, C.pied);
  [[0, 1.75], [1.6, 0.5], [-1.6, 0.5], [0, -1.75]].forEach((p) => a.cylindre(0.38, 0.6, TABLE.x + p[0], PLANCHER, TABLE.z + p[1], C.chaise));
  // des plantes dans les coins
  [[-14.6, -9.6], [2.9, -9.6]].forEach((p) => { a.cylindre(0.45, 0.8, p[0], PLANCHER, p[1], C.pot); a.boule(0.62, p[0], PLANCHER + 1.4, p[1], C.plante, 1.15); });
  // le parvis devant le studio et ses bancs (face à la rue)
  a.forme(plaque(PARVIS.x1 - PARVIS.x0, PARVIS.z1 - PARVIS.z0 + 0.4, 0.3, SOL, (PARVIS.x0 + PARVIS.x1) / 2, SOL, (PARVIS.z0 + PARVIS.z1) / 2 - 0.2), C.pave);
  BANCS.forEach((b) => {
    a.boite(2.2, 0.16, 0.7, b.x, SOL + 0.5, b.z, C.banc, b.ry);
    a.boite(2.2, 0.6, 0.14, b.x - Math.sin(b.ry) * 0.32, SOL + 0.62, b.z - Math.cos(b.ry) * 0.32, C.banc, b.ry);
    [-0.85, 0.85].forEach((o) => a.boite(0.14, 0.5, 0.6, b.x + Math.cos(b.ry) * o, SOL, b.z - Math.sin(b.ry) * o, C.pied, b.ry));
  });
  // le passage entre le studio et la résidence
  a.boite(1.5, SOL, 14.5, 4.4, 0, -3.4, C.pelouse);
  // la rue : chaussée, marquage, passage piéton, trottoirs avec bordures
  a.boite(RUE.x1 - RUE.x0, 0.03, RUE.z1 - RUE.z0, (RUE.x0 + RUE.x1) / 2, 0, (RUE.z0 + RUE.z1) / 2, C.route);
  for (let x = RUE.x0 + 1; x < RUE.x1 - 1; x += 2.6) if (x < -3.4 || x > 1.6) a.boite(1.3, 0.035, 0.14, x + 0.65, 0, (RUE.z0 + RUE.z1) / 2, C.marque);
  for (let k = 0; k < 6; k++) a.boite(2.6, 0.036, 0.36, -0.9, 0, RUE.z0 + 0.42 + k * 0.64, C.marque);
  a.boite(RUE.x1 - RUE.x0, SOL, 1.2, (RUE.x0 + RUE.x1) / 2, 0, 5.2, C.trottoir); a.boite(RUE.x1 - RUE.x0, SOL + 0.02, 0.16, (RUE.x0 + RUE.x1) / 2, 0, 5.72, C.bordure);
  a.boite(RUE.x1 - RUE.x0, SOL, 1.4, (RUE.x0 + RUE.x1) / 2, 0, 10.5, C.trottoir); a.boite(RUE.x1 - RUE.x0, SOL + 0.02, 0.16, (RUE.x0 + RUE.x1) / 2, 0, 9.88, C.bordure);
  // de l'autre côté de la rue : une bande de pelouse et des arbres
  a.boite(RUE.x1 - RUE.x0 - 2, 0.1, 1.6, (RUE.x0 + RUE.x1) / 2, 0, 12.0, C.pelouse);
  [[-15.6, 12.0, 0.8, 0], [-4.2, 12.0, 0.95, 1], [6.8, 12.0, 0.85, 0], [19.6, 12.0, 0.9, 1]].forEach((t) => { a.cylindre(0.16 * t[2], 1.3 * t[2], t[0], 0.1, t[1], C.tronc); a.boule(1.15 * t[2], t[0], 0.1 + 2.2 * t[2], t[1], t[3] ? C.arbreBleu : C.arbre, 1.12); });
  // les lampadaires (l'ampoule s'allume la nuit)
  const ampoules = new Assemblage();
  LAMPADAIRES.forEach((l) => {
    const cote = l[1] < 8 ? 1 : -1;
    a.cylindre(0.07, 3.1, l[0], SOL, l[1], C.pied); a.boite(0.1, 0.08, 0.7, l[0], SOL + 3.05, l[1] + cote * 0.32, C.pied);
    ampoules.boite(0.34, 0.14, 0.34, l[0], SOL + 2.92, l[1] + cote * 0.62, '#FFFFFF');
  });
  // la résidence : la cour surélevée, le bâtiment en L, la piscine, les transats, le parasol, la grille
  a.forme(plaque(RES.x1 - RES.x0, RES.z1 - RES.z0, 0.3, COUR, (RES.x0 + RES.x1) / 2, COUR, (RES.z0 + RES.z1) / 2), C.cour);
  const fen = new Assemblage();
  a.boite(15.0, 4.6, 2.8, 13.5, COUR, -9.0, C.facade); a.boite(15.2, 0.16, 3.0, 13.5, COUR + 4.6, -9.0, C.toit);
  a.boite(2.8, 4.6, 9.2, 19.6, COUR, -3.0, C.facade); a.boite(3.0, 0.16, 9.4, 19.6, COUR + 4.6, -3.0, C.toit);
  for (let x = 7.4; x <= 18.0; x += 2.0) [COUR + 0.9, COUR + 2.85].forEach((y) => { if (!(Math.abs(x - FENETRE.x) < 0.3 && y > COUR + 2)) fen.boite(1.1, 1.2, 0.08, x, y, -7.56, C.vitre); });
  for (let z = -6.4; z <= 0.6; z += 2.0) [COUR + 0.9, COUR + 2.85].forEach((y) => fen.boite(0.08, 1.2, 1.1, 18.16, y, z, C.vitre));
  a.boite(3.0, 0.12, 1.0, 13.5, COUR + 2.3, -7.1, C.toit);   // un petit balcon
  // la piscine : la margelle, l'eau (un maillage à part, qui scintille), une échelle
  const P = PISCINE;
  a.boite(P.w + 0.8, 0.12, 0.4, P.x, COUR, P.z - P.d / 2 - 0.2, C.margelle); a.boite(P.w + 0.8, 0.12, 0.4, P.x, COUR, P.z + P.d / 2 + 0.2, C.margelle);
  a.boite(0.4, 0.12, P.d, P.x - P.w / 2 - 0.2, COUR, P.z, C.margelle); a.boite(0.4, 0.12, P.d, P.x + P.w / 2 + 0.2, COUR, P.z, C.margelle);
  [-0.25, 0.25].forEach((o) => a.boite(0.05, 0.7, 0.05, P.x + P.w / 2 - 0.5 + o, COUR, P.z - P.d / 2 + 0.05, C.jante));
  [10.0, 12.4, 14.8].forEach((x) => { a.boite(0.8, 0.22, 1.9, x, COUR + 0.12, 1.4, C.transat); a.boite(0.8, 0.5, 0.12, x, COUR + 0.3, 2.3, C.transat, 0); });
  a.cylindre(0.05, 2.2, 16.6, COUR, 1.2, C.pied); a.cone(1.3, 0.55, 16.6, COUR + 2.0, 1.2, C.parasol);
  [[7.0, -6.2], [16.8, -6.4], [6.6, 2.4]].forEach((t, i) => { a.cylindre(0.15, 1.5, t[0], COUR, t[1], C.tronc); a.boule(1.0, t[0], COUR + 2.2, t[1], i === 1 ? C.arbreBleu : C.plante, 1.0); });
  // la grille, côté rue et côté studio, avec un portail fermé
  const grille = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.42)), ry = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i <= n; i++) { const k = i / n; a.boite(0.06, 1.25, 0.06, x0 + (x1 - x0) * k, COUR, z0 + (z1 - z0) * k, C.grille); }
    a.boite(L, 0.08, 0.09, (x0 + x1) / 2, COUR + 1.2, (z0 + z1) / 2, C.grille, ry); a.boite(L, 0.06, 0.08, (x0 + x1) / 2, COUR + 0.2, (z0 + z1) / 2, C.grille, ry);
  };
  grille(RES.x0 + 0.1, RES.z1 - 0.1, 12.6, RES.z1 - 0.1); grille(14.4, RES.z1 - 0.1, RES.x1 - 0.1, RES.z1 - 0.1);
  grille(RES.x0 + 0.1, RES.z0 + 0.1, RES.x0 + 0.1, RES.z1 - 0.1);
  a.boite(1.8, 1.5, 0.1, 13.5, COUR, RES.z1 - 0.1, '#C9D3E1'); a.boite(0.14, 1.75, 0.14, 12.55, COUR, RES.z1 - 0.1, C.pied); a.boite(0.14, 1.75, 0.14, 14.45, COUR, RES.z1 - 0.1, C.pied);
  // le grand téléphone sur son pied : la dernière vidéo
  a.boite(1.6, 0.25, 1.0, TELEPHONE.x, PLANCHER, TELEPHONE.z, C.pied); a.boite(0.25, 0.9, 0.25, TELEPHONE.x, PLANCHER + 0.25, TELEPHONE.z, C.pied);
  a.forme(plaque(3.1, 5.5, 0.45, 0.32, TELEPHONE.x, 0, 0).rotateX(-Math.PI / 2).translate(0, PLANCHER + 1.1 + 2.75, TELEPHONE.z - 0.16), C.telephone);
  const statique = a.maille(matMaquette); scene.add(statique); garder(statique.geometry);
  const mFen = fen.maille(matFenetres, false); scene.add(mFen); garder(mFen.geometry);
  const mAmp = ampoules.maille(matAmpoules, false); mAmp.castShadow = false; scene.add(mAmp); garder(mAmp.geometry);
  // la fenêtre du voisin (celle qui s'allume quand on se baigne chez lui)
  const voisin = new THREE.Mesh(garder(new THREE.BoxGeometry(1.1, 1.2, 0.08)), matVoisin); voisin.position.set(FENETRE.x, FENETRE.y, -7.56); scene.add(voisin);
  // le panneau du portail
  const panneau = new THREE.Mesh(garder(new THREE.PlaneGeometry(1.5, 0.56)), new THREE.MeshBasicMaterial({ map: garder(texturePanneau()), transparent: true, toneMapped: false }));
  panneau.position.set(13.5, COUR + 1.0, RES.z1 - 0.03); scene.add(panneau);
  // l'eau de la piscine
  const texEau = garder(toile(256, 256, (g) => {
    g.fillStyle = '#7DB4FF'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
    for (let i = 0; i < 26; i++) { const x = (i * 97) % 256, y = (i * 53) % 256; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 20, y - 10, x + 30, y + 14, x + 52, y + 2); g.stroke(); }
  }));
  texEau.wrapS = texEau.wrapT = THREE.RepeatWrapping; texEau.repeat.set(2.2, 1.1);
  const matEau = new THREE.MeshStandardMaterial({ map: texEau, color: '#FFFFFF', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.92, emissive: new THREE.Color('#2F7BFF'), emissiveIntensity: 0.08 });
  const eau = new THREE.Mesh(garder(new THREE.PlaneGeometry(P.w, P.d)), matEau); eau.rotation.x = -Math.PI / 2; eau.position.set(P.x, EAU, P.z); eau.receiveShadow = true; scene.add(eau);
  eau.userData.type = 'piscine'; cibles.push(eau);
  // les halos des lampadaires, la nuit
  const matHalo = new THREE.MeshBasicMaterial({ map: texHalo, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  LAMPADAIRES.forEach((l) => { const hh = new THREE.Mesh(garder(new THREE.PlaneGeometry(4.2, 4.2)), matHalo); hh.rotation.x = -Math.PI / 2; hh.position.set(l[0], SOL + 0.03, l[1] + (l[1] < 8 ? 1.1 : -1.1)); scene.add(hh); });
  // l'écran du téléphone (la vignette, ou l'accroche dessinée)
  const matEcranGeant = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const ecranGeant = new THREE.Mesh(garder(new THREE.PlaneGeometry(2.78, 4.94)), matEcranGeant);
  ecranGeant.position.set(TELEPHONE.x, PLANCHER + 1.1 + 2.75, TELEPHONE.z + 0.17); ecranGeant.userData.type = 'ecran';
  scene.add(ecranGeant); cibles.push(ecranGeant);
  // l'enseigne : le nom de sa chaîne, sur le mur du fond
  const matEnseigne = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
  const enseigne = new THREE.Mesh(garder(new THREE.PlaneGeometry(11.5, 1.6)), matEnseigne);
  enseigne.position.set(-8.8, PLANCHER + 2.25, -10.32); enseigne.userData.type = 'enseigne'; scene.add(enseigne); cibles.push(enseigne);

  /* ── les bureaux : chacun avec son tapis dans la couleur de sa titulaire, son écran qui s'allume ── */
  const postes = {};
  Object.keys(POSTES).forEach((role) => {
    const [x, z] = POSTES[role];
    const g = new THREE.Group();
    const p = new Assemblage();
    p.boite(2.5, 0.1, 1.2, x, PLANCHER + 1.05, z, C.bureau); [-1.1, 1.1].forEach((o) => p.boite(0.1, 1.05, 1.0, x + o, PLANCHER, z, C.pied));
    p.boite(1.6, 1.0, 0.1, x, PLANCHER + 1.35, z - 0.38, C.pied); p.boite(0.18, 0.2, 0.18, x, PLANCHER + 1.15, z - 0.38, C.pied);
    p.cylindre(0.42, 0.62, x, PLANCHER, z + 1.25, C.chaise); p.boite(0.84, 0.75, 0.14, x, PLANCHER + 0.62, z + 1.62, C.chaise);
    const m = p.maille(matMaquette); g.add(m); garder(m.geometry);
    const matTapis = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const tapis = new THREE.Mesh(plaque(3.2, 3.4, 0.5, 0.04, x, PLANCHER + 0.04, z + 0.55), matTapis); tapis.receiveShadow = true; g.add(tapis); garder(tapis.geometry);
    const matEcran = new THREE.MeshBasicMaterial({ color: C.ecran, toneMapped: false });
    const ecran = new THREE.Mesh(garder(new THREE.PlaneGeometry(1.44, 0.86)), matEcran); ecran.position.set(x, PLANCHER + 1.85, z - 0.32); g.add(ecran);
    scene.add(g);
    postes[role] = { x, z, tapis: matTapis, ecran: matEcran, siege: new THREE.Vector3(x, PLANCHER, z + 1.25), allee: RANG[role] === 'a' ? ALLEE.a : ALLEE.b, lumiere: 0 };
  });

  /* ── les voitures ── */
  const GEO_OMBRE = garder(new THREE.PlaneGeometry(1, 1));
  const GEO_RETRO = garder(new THREE.BoxGeometry(0.18, 0.16, 0.24));
  let texRetro = null;
  function creerVoiture(couleur, nom) {
    const g = new THREE.Group();
    const v = new Assemblage();
    const bas = fonce(couleur, 0.12);
    v.boite(3.3, 0.5, 1.5, 0, 0.3, 0, couleur);                  // la caisse
    v.boite(3.36, 0.16, 1.52, 0, 0.26, 0, bas);                  // le bas de caisse
    v.boite(1.9, 0.52, 1.34, -0.25, 0.8, 0, C.verre);           // l'habitacle vitré
    v.boite(1.7, 0.09, 1.36, -0.3, 1.31, 0, couleur);            // le toit
    [[0.65, 0.66], [0.65, -0.66], [-1.15, 0.66], [-1.15, -0.66]].forEach((p) => v.boite(0.12, 0.52, 0.06, p[0], 0.8, p[1], couleur));
    [[1.05, 0.62], [1.05, -0.62], [-1.05, 0.62], [-1.05, -0.62]].forEach((p) => { v.roue(0.3, 0.24, p[0], 0.3, p[1], C.pneu); v.roue(0.15, 0.26, p[0], 0.3, p[1], C.jante); });
    v.boite(0.1, 0.16, 1.2, 1.66, 0.38, 0, pale(couleur, 0.5)); v.boite(0.1, 0.16, 1.2, -1.66, 0.38, 0, pale(couleur, 0.5));
    const corps = v.maille(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })); g.add(corps);
    // les feux : phares, stop, recul, clignotants (couleurs vives allumés, ternes éteints)
    const feu = (c, x, z, w) => { const m = new THREE.Mesh(GEO_OMBRE, new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.scale.set(w || 0.3, 0.14, 1); m.position.set(x, 0.66, z); m.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(m); return m; };
    const feux = {
      phares: [feu('#F2F5F9', 1.66, 0.48), feu('#F2F5F9', 1.66, -0.48)],
      stop: [feu('#8E3B45', -1.66, 0.5), feu('#8E3B45', -1.66, -0.5)],
      recul: [feu('#B9C2CF', -1.665, 0.2, 0.14), feu('#B9C2CF', -1.665, -0.2, 0.14)],
      cligno: [feu('#B98A4A', 1.665, 0.7, 0.12), feu('#B98A4A', 1.665, -0.7, 0.12), feu('#B98A4A', -1.665, 0.72, 0.12), feu('#B98A4A', -1.665, -0.72, 0.12)]
    };
    // les rétros : à part, pour pouvoir en perdre un
    const matRetro = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.5 });
    const retro = (z) => { const r = new THREE.Mesh(GEO_RETRO, matRetro); r.position.set(0.62, 0.86, z); r.castShadow = true; g.add(r); return r; };
    const retros = { g: retro(-0.8), d: retro(0.8) };
    const ombre = new THREE.Mesh(GEO_OMBRE, new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false })); ombre.scale.set(4.2, 2.4, 1); ombre.rotation.x = -Math.PI / 2; ombre.position.y = 0.04; g.add(ombre);
    let etiquette = null;
    if (nom) { etiquette = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureEtiquette(nom, '#FF5A8A', ''), transparent: true, depthTest: false, toneMapped: false })); etiquette.scale.set(2.5, 0.69, 1); etiquette.position.y = 2.25; etiquette.renderOrder = 10; g.add(etiquette); }
    scene.add(g);
    const o = { g, corps, feux, retros, etiquette, couleur };
    allumer(o, 'phares', false); allumer(o, 'stop', false); allumer(o, 'recul', false); allumer(o, 'cligno', false);
    return o;
  }
  const TEINTES = { phares: ['#F2F5F9', '#FFF6D8'], stop: ['#8E3B45', '#FF3B4E'], recul: ['#B9C2CF', '#FFFFFF'], cligno: ['#B98A4A', '#FFB02E'] };
  function allumer(v, quoi, on) { v.feux[quoi].forEach((m) => m.material.color.set(TEINTES[quoi][on ? 1 : 0])); }
  const garees = GAREES.map((p) => {
    const v = creerVoiture(p.couleur);
    v.g.position.set(p.x, 0.07, Z_GAREE); v.g.rotation.x = -0.05;   // les roues de droite sur le trottoir
    v.cible = !!p.cible;
    if (v.cible) { const zone = new THREE.Mesh(garder(new THREE.BoxGeometry(3.4, 1.4, 1.7)), new THREE.MeshBasicMaterial({ visible: false })); zone.position.y = 0.7; zone.userData.type = 'voiture'; v.g.add(zone); cibles.push(zone); }
    return v;
  });
  const cibleGaree = garees.find((v) => v.cible);
  const passantes = [];                 // les voitures qui passent

  /* ── l'équipe ── */
  const GEO_CORPS = garder(new THREE.CapsuleGeometry(0.4, 0.5, 4, 14));
  const GEO_TETE = garder(new THREE.SphereGeometry(0.34, 18, 14));
  const GEO_OEIL = garder(new THREE.SphereGeometry(0.055, 8, 6));
  const matOeil = new THREE.MeshBasicMaterial({ color: '#1E1828' });
  const tirage = hasard(20261114);
  const agents = {};
  // un endroit où flâner : le parvis, le trottoir, ou la table de l'équipe
  function pointLibre() {
    const k = tirage();
    if (k < 0.18) { const an = tirage() * Math.PI; return new THREE.Vector3(TABLE.x + Math.cos(an) * 2.3, PLANCHER, TABLE.z + Math.sin(an) * 2.3); }
    if (k < 0.32) return new THREE.Vector3(-13 + tirage() * 15, SOL, 5.05 + tirage() * 0.4);
    for (let i = 0; i < 20; i++) {
      const x = PARVIS.x0 + 1 + tirage() * (PARVIS.x1 - PARVIS.x0 - 2), z = 3.0 + tirage() * 1.3;
      if (BANCS.some((b) => Math.abs(x - b.x) < 1.4 && Math.abs(z - b.z) < 0.7)) continue;
      return new THREE.Vector3(x, SOL, z);
    }
    return new THREE.Vector3(-2, SOL, 3.6);
  }
  function creerAgent(role, prenom, couleur) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.55 });
    const corps = new THREE.Mesh(GEO_CORPS, mat); corps.position.y = 0.66; corps.castShadow = true;
    const tete = new THREE.Mesh(GEO_TETE, new THREE.MeshStandardMaterial({ color: pale(couleur, 0.55), roughness: 0.5 })); tete.position.y = 1.5; tete.castShadow = true;
    const yeux = [-0.12, 0.12].map((x) => { const o = new THREE.Mesh(GEO_OEIL, matOeil); o.position.set(x, 1.55, 0.3); return o; });
    const ombre = new THREE.Mesh(GEO_OMBRE, new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false }));
    ombre.scale.set(1.5, 1.5, 1); ombre.rotation.x = -Math.PI / 2; ombre.position.y = 0.02;
    const corpsG = new THREE.Group(); corpsG.add(corps, tete, yeux[0], yeux[1]);
    g.add(corpsG, ombre);
    const etiquette = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, toneMapped: false }));
    etiquette.scale.set(2.5, 0.69, 1); etiquette.renderOrder = 10; etiquette.position.y = 2.55;
    g.add(etiquette);
    [corps, tete].forEach((m) => { m.userData.type = 'agent'; m.userData.role = role; cibles.push(m); });
    g.position.copy(role === 'toi' ? new THREE.Vector3(TELEPHONE.x + 1.6, PLANCHER, TELEPHONE.z + 2.0) : pointLibre());
    scene.add(g);
    return { role, prenom, couleur, g, corpsG, corps, tete, mat, ombre, etiquette, chemin: [], actions: [], assis: false, travail: null, pause: 1 + tirage() * 4, ph: tirage() * 6.28, cle: '', saut: 0, mouille: 0, scene: null };
  }
  function etiqueter(ag, etat) {
    const cle = ag.prenom + '|' + ag.couleur + '|' + (etat || '');
    if (ag.cle === cle) return;
    ag.cle = cle;
    if (ag.etiquette.material.map) ag.etiquette.material.map.dispose();
    ag.etiquette.material.map = textureEtiquette(ag.prenom, ag.couleur, etat); ag.etiquette.material.needsUpdate = true;
  }
  function teinter(ag) {
    const c = ag.mouille > 0 ? fonce(ag.couleur, 0.28) : ag.couleur;
    ag.mat.color.set(c); ag.tete.material.color.set(pale(ag.couleur, ag.mouille > 0 ? 0.35 : 0.55));
  }

  /* ── les chemins : jamais à travers un bureau (les allées, le couloir, puis le devant du studio) ── */
  const dedans = (p) => p.x > -15.4 && p.x < 3.7 && p.z > -10.4 && p.z < 2.75;
  const auSol = (p) => (dedans(p) ? PLANCHER : (p.x > RES.x0 && p.z < RES.z1 ? COUR : SOL));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const bordX = (x) => Math.max(COULOIR_G, Math.min(3.0, x));
  // sortir du studio par devant : depuis un bureau (par son allée, et le couloir pour la rangée du fond) ou depuis le
  // coin de la table (tout droit, rien devant)
  // le couloir le plus court entre deux abscisses (celui de gauche ou celui de droite)
  const couloir = (x0, x1) => (Math.abs(x0 - COULOIR_G) + Math.abs(x1 - COULOIR_G) < Math.abs(x0 - COULOIR) + Math.abs(x1 - COULOIR) ? COULOIR_G : COULOIR);
  function versSeuil(p, ch) {
    if (p.x > COULOIR + 0.3) { ch.push(V(p.x, PLANCHER, SEUIL)); return; }
    if (p.z < ALLEE.a + 0.6) { const xc = couloir(p.x, p.x); ch.push(V(p.x, PLANCHER, ALLEE.a), V(xc, PLANCHER, ALLEE.a), V(xc, PLANCHER, SEUIL)); return; }
    if (p.z < ALLEE.b - 0.2) ch.push(V(p.x, PLANCHER, ALLEE.b));
    ch.push(V(bordX(p.x), PLANCHER, SEUIL));
  }
  function cheminVers(ag, cible, allee) {
    const p = ag.g.position, ch = [];
    const assisAvant = ag.assis;
    ag.assis = false; ag.assisBanc = null;
    if (allee != null) {
      // vers un bureau : par le devant du studio, puis l'allée de sa rangée (le couloir pour celle du fond)
      if (!dedans(p)) ch.push(V(bordX(p.x), SOL, 2.95), V(bordX(p.x), PLANCHER, SEUIL));
      else if (assisAvant || p.x > COULOIR + 0.3 || p.z < ALLEE.b - 0.2) versSeuil(p, ch);
      const depuis = ch.length ? ch[ch.length - 1] : p;
      if (allee === ALLEE.a) { const xc = couloir(depuis.x, cible.x); ch.push(V(xc, PLANCHER, depuis.z), V(xc, PLANCHER, ALLEE.a), V(cible.x, PLANCHER, ALLEE.a)); }
      else ch.push(V(depuis.x, PLANCHER, ALLEE.b), V(cible.x, PLANCHER, ALLEE.b));
    } else if (dedans(p) && !dedans(cible)) {
      versSeuil(p, ch);
      ch.push(V(ch[ch.length - 1].x, SOL, 2.95));
    } else if (dedans(p) && dedans(cible)) {
      if (assisAvant || (p.z < ALLEE.b - 0.2 && p.x < COULOIR + 0.3)) versSeuil(p, ch);
      if (ch.length && cible.x > COULOIR + 0.3) ch.push(V(cible.x, PLANCHER, SEUIL));
    } else if (!dedans(p) && dedans(cible)) {
      ch.push(V(bordX(p.x), SOL, 2.95), V(bordX(p.x), PLANCHER, SEUIL));
      if (cible.x > COULOIR + 0.3) ch.push(V(cible.x, PLANCHER, SEUIL));
    }
    ch.push(cible.clone());
    ag.chemin = ch;
  }

  /* ── les actions des scènes : aller, sauter par-dessus, attendre, nager ── */
  function agir(ag, liste) { ag.actions = ag.actions.concat(liste); ag.chemin = []; ag.assis = false; ag.assisBanc = null; }
  function executer(ag, dt, t) {
    const x = ag.actions[0], p = ag.g.position;
    if (!x.t) x.t = 0;
    x.t += dt;
    if (x.type === 'aller') {
      const d = new THREE.Vector3(x.cible.x - p.x, 0, x.cible.z - p.z), L = d.length();
      const v = (x.vitesse || MARCHE) * (x.accroupi ? 0.6 : 1);
      if (L < 0.06) { p.x = x.cible.x; p.z = x.cible.z; ag.actions.shift(); }
      else { d.multiplyScalar(Math.min(1, v * dt / L)); p.add(d); ag.g.rotation.y = Math.atan2(x.cible.x - p.x + d.x, x.cible.z - p.z + d.z); }
      const sol = x.y != null ? x.y : auSol(p);
      p.y += (sol - p.y) * Math.min(1, dt * 8);
      ag.corpsG.scale.y = x.accroupi ? 0.8 : 1;
      ag.corpsG.position.y = Math.abs(Math.sin(t * (x.vitesse > 3 ? 13 : 9) + ag.ph)) * (x.accroupi ? 0.05 : 0.12);
    } else if (x.type === 'arc') {
      if (!x.de) x.de = p.clone();
      const k = Math.min(1, x.t / x.duree), e = easeInOut(k);
      p.lerpVectors(x.de, x.a, e); p.y += Math.sin(k * Math.PI) * x.hauteur;
      ag.g.rotation.y = Math.atan2(x.a.x - x.de.x, x.a.z - x.de.z);
      ag.corpsG.position.y = 0; ag.corpsG.scale.y = 1;
      if (k >= 1) { ag.actions.shift(); if (x.fin) x.fin(); }
    } else if (x.type === 'attendre') {
      ag.corpsG.position.y = x.nage ? 0 : 0;
      if (x.regard != null) ag.g.rotation.y += angleVers(ag.g.rotation.y, x.regard) * Math.min(1, dt * 6);
      if (x.t >= x.duree) ag.actions.shift();
    } else if (x.type === 'nager') {
      const an = x.t * 0.9 + x.ph;
      const cx = x.centre.x + Math.cos(an) * x.r, cz = x.centre.z + Math.sin(an) * x.r * 0.55;
      ag.g.rotation.y = Math.atan2(cx - p.x, cz - p.z) || ag.g.rotation.y;
      p.x = cx; p.z = cz; p.y = EAU - 1.25 + Math.sin(t * 3 + ag.ph) * 0.04;
      ag.corpsG.position.y = 0;
      if (x.duree && x.t >= x.duree) ag.actions.shift();
    } else if (x.type === 'fn') { ag.actions.shift(); x.f(); }
  }

  /* ── l'état venu de la page ── */
  let ETAT = null, derniereTache = {}, texteEcran = '', urlEcran = '';
  const bulles = [], vols = [], particules = [];
  let nuit = 0, nuitCible = 0;
  function maj(etat) {
    ETAT = etat;
    nuitCible = etat.nuit ? 1 : 0;
    const eq = etat.equipe || {};
    ['idees', 'plume', 'critique', 'traduction', 'realisation', 'diffusion'].forEach((role) => {
      const m = eq[role] || { prenom: role, couleur: '#8B5CF6' };
      if (!agents[role]) agents[role] = creerAgent(role, m.prenom, m.couleur);
      const ag = agents[role];
      if (ag.couleur !== m.couleur) { ag.couleur = m.couleur; teinter(ag); }
      ag.prenom = m.prenom;
      const p = postes[role];
      p.tapis.color.set(pale(m.couleur, 0.78));
      const t = (etat.taches || {})[role] || null;
      etiqueter(ag, t ? (t.bloque ? 'bloque' : 'travail') : '');
      // une étape passe de l'une à l'autre : une feuille vole du bureau de la précédente à celui de la suivante
      if (t && t.videoId != null) Object.keys(derniereTache).forEach((r2) => { if (r2 !== role && derniereTache[r2] === t.videoId) voler(postes[r2] || null, p, (eq[r2] || {}).couleur || m.couleur); });
      const avant = ag.travail;
      ag.travail = t;
      ag.poste = p;
      if (ag.scene) { if (t && sceneEnCours && sceneEnCours.presser) sceneEnCours.presser(); return; }
      if (t && (!avant || !ag.assis)) {
        if (calme) { ag.g.position.copy(p.siege); ag.assis = true; ag.chemin = []; }
        else if (!ag.chemin.length || !avant) cheminVers(ag, p.siege, p.allee);
      }
      if (!t && avant) { ag.pause = 0; const c = pointLibre(); if (!calme) cheminVers(ag, c, null); else { ag.g.position.copy(c); ag.assis = false; } }
    });
    const nouvelles = {};
    Object.keys(etat.taches || {}).forEach((r) => { if (etat.taches[r] && etat.taches[r].videoId != null) nouvelles[r] = etat.taches[r].videoId; });
    // un script qui l'attend : elle apparaît près du grand téléphone
    if (etat.toi) {
      if (!agents.toi) agents.toi = creerAgent('toi', etat.moi.prenom, etat.moi.accent);
      const ag = agents.toi; ag.g.visible = true; ag.prenom = etat.moi.prenom;
      if (ag.couleur !== etat.moi.accent) { ag.couleur = etat.moi.accent; teinter(ag); }
      etiqueter(ag, 'travail');
      if (!bulles.some((b) => b.role === 'toi')) bulle('toi', 'À toi !', etat.moi.accent, 0);
      Object.keys(derniereTache).forEach((r2) => { if (derniereTache[r2] === etat.toi.videoId && postes[r2]) voler(postes[r2], { x: TELEPHONE.x + 1.6, z: TELEPHONE.z + 2.4 }, (eq[r2] || {}).couleur || etat.moi.accent); });
    } else if (agents.toi) { agents.toi.g.visible = false; enleverBulles('toi'); }
    derniereTache = nouvelles;
    // le grand téléphone
    const e = etat.ecran || {};
    if (e.vignette && e.vignette !== urlEcran) {
      urlEcran = e.vignette;
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(e.vignette, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; if (matEcranGeant.map) matEcranGeant.map.dispose(); matEcranGeant.map = tx; matEcranGeant.needsUpdate = true; demanderRendu(); }, undefined, () => { urlEcran = ''; dessinerAccroche(e.accroche); });
    } else if (!e.vignette) dessinerAccroche(e.accroche);
    // l'enseigne
    const nom = etat.chaine || ('Le studio de ' + (etat.moi || {}).prenom);
    if (matEnseigne.userData.nom !== nom + etat.moi.accent) {
      matEnseigne.userData.nom = nom + etat.moi.accent;
      if (matEnseigne.map) matEnseigne.map.dispose();
      matEnseigne.map = toile(1150, 160, (g) => {
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = etat.moi.accent;
        let taille = 92; g.font = '800 ' + taille + 'px ' + POLICE;
        while (g.measureText(nom).width > 1110 && taille > 46) { taille -= 4; g.font = '800 ' + taille + 'px ' + POLICE; }
        let t = nom; while (g.measureText(t).width > 1110 && t.length > 4) t = t.slice(0, -2) + '…';
        g.fillText(t, 575, 84);
      });
      matEnseigne.needsUpdate = true;
    }
    demanderRendu();
  }
  function dessinerAccroche(texte) {
    const k = String(texte || '') + '|' + ((ETAT && ETAT.couleur) || '');
    if (k === texteEcran) return;
    texteEcran = k; urlEcran = '';
    if (matEcranGeant.map) matEcranGeant.map.dispose();
    matEcranGeant.map = textureAccroche(texte, (ETAT && ETAT.couleur) || '#FF5A8A'); matEcranGeant.needsUpdate = true;
  }
  // une bulle au-dessus de quelqu'un (role), d'une voiture (objet avec g) ou d'un point (Vector3)
  function bulle(qui, texte, couleur, duree, choc) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureBulle(texte, couleur, choc), transparent: true, depthTest: false, toneMapped: false }));
    s.scale.set(choc ? 3.1 : 2.8, choc ? 1.2 : 1.07, 1); s.renderOrder = 11; scene.add(s);
    bulles.push({ role: typeof qui === 'string' ? qui : null, objet: typeof qui === 'object' ? qui : null, s, fin: duree ? performance.now() + duree : 0 });
  }
  function enleverBulles(role) { for (let i = bulles.length - 1; i >= 0; i--) if (bulles[i].role === role) { scene.remove(bulles[i].s); bulles[i].s.material.map.dispose(); bulles[i].s.material.dispose(); bulles.splice(i, 1); } }
  const texFeuilles = {};
  function voler(de, vers, couleur) {
    if (calme || !de || !vers) return;
    const tex = texFeuilles[couleur] || (texFeuilles[couleur] = textureFeuille(couleur));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
    s.scale.set(1.1, 1.1, 1); s.renderOrder = 12; scene.add(s);
    vols.push({ s, a: new THREE.Vector3(de.x, PLANCHER + 2.2, de.z - 0.3), b: new THREE.Vector3(vers.x, PLANCHER + 2.2, (vers.z || 0) - 0.3), t0: performance.now(), d: 1500, haut: 3.2 });
  }
  // les petits bouts qui volent : confettis, gouttes, l'avion en papier, l'ampoule, le rétro arraché
  const texCarres = {};
  function particule(o) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.tex, transparent: true, depthTest: o.profondeur !== false ? true : false, toneMapped: false }));
    s.scale.set(o.taille || 0.3, o.taille || 0.3, 1); s.position.copy(o.p); s.renderOrder = 9; scene.add(s);
    particules.push(Object.assign({ s, v: o.v || new THREE.Vector3(), vie: o.vie || 2, age: 0, g: o.gravite != null ? o.gravite : 9, tourne: (tirage() - 0.5) * 8 }, o));
  }
  function confettis(centre, couleurs, n) {
    if (calme) return;
    for (let i = 0; i < (n || 46); i++) {
      const c = couleurs[i % couleurs.length];
      const tex = texCarres[c] || (texCarres[c] = textureCarre(c));
      const an = tirage() * Math.PI * 2, f = 2 + tirage() * 4;
      particule({ tex, p: centre.clone(), v: new THREE.Vector3(Math.cos(an) * f, 5 + tirage() * 5, Math.sin(an) * f), vie: 2.2 + tirage() * 1.2, gravite: 7, taille: 0.34, freinage: 1.6 });
    }
  }
  function eclabousser(centre) {
    if (calme) return;
    for (let i = 0; i < 22; i++) { const an = tirage() * Math.PI * 2, f = 1 + tirage() * 2.6; particule({ tex: texGoutte, p: centre.clone(), v: new THREE.Vector3(Math.cos(an) * f, 3 + tirage() * 3.5, Math.sin(an) * f), vie: 1.1, gravite: 10, taille: 0.28 }); }
    onde(centre);
  }
  function onde(centre) {
    const m = new THREE.Mesh(GEO_OMBRE, new THREE.MeshBasicMaterial({ map: texAnneau, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(centre.x, EAU + 0.02, centre.z); scene.add(m);
    particules.push({ s: m, onde: true, vie: 1.4, age: 0 });
  }
  function sauter(roles) { roles.forEach((r) => { const ag = agents[r]; if (ag && ag.g.visible && !ag.scene) ag.saut = 1.3; }); }

  /* ── la circulation : de temps en temps, une voiture passe ── */
  const COULEURS_PASSANTES = ['#E9EEF5', '#C9D6EA', '#F6D9C8', '#D6E7F7', '#DCD3F2', '#CFE7D9'];
  let prochainePassante = 6 + tirage() * 10;
  function lancerPassante() {
    // pendant que Mila manoeuvre, personne ne vient de son côté
    const sens = sceneEnCours && sceneEnCours.nom === 'accident' ? -1 : (tirage() < 0.5 ? 1 : -1);
    const v = creerVoiture(COULEURS_PASSANTES[Math.floor(tirage() * COULEURS_PASSANTES.length)]);
    v.g.rotation.y = sens > 0 ? 0 : Math.PI;
    v.g.position.set(sens > 0 ? RUE.x0 + 1.6 : RUE.x1 - 1.6, 0.03, sens > 0 ? VOIE.aller : VOIE.retour);
    v.sens = sens; v.vitesse = 4 + tirage() * 2.2; v.age = 0;
    if (nuit > 0.5) allumer(v, 'phares', true);
    passantes.push(v);
  }
  function enleverVoiture(v) { scene.remove(v.g); v.g.traverse((o) => { if (o.material) { if (o.material.map && o.material.map !== texOmbre) o.material.map.dispose(); o.material.dispose(); } if (o.geometry && o.geometry !== GEO_OMBRE && o.geometry !== GEO_RETRO) o.geometry.dispose(); }); }
  function entreeSortie(v, x) {
    // une voiture apparaît et disparaît aux bords de la maquette
    const bord = Math.min(x - (RUE.x0 + 0.2), (RUE.x1 - 0.2) - x);
    const k = Math.max(0, Math.min(1, bord / 1.6));
    v.g.scale.setScalar(0.001 + k * 0.999);
  }

  /* ── les scènes ── */
  let sceneEnCours = null;
  let prochaineScene = 24 + tirage() * 18;
  const derniere = { accident: -999, piscine: -999 };
  const horloge = { t: 0 };
  function annoncer(texte, focus, qui) { if (rappels.evenement) rappels.evenement({ texte, focus: focus || null, qui: qui || 'mila' }); }

  // Mila arrive, dépasse la voiture garée, s'arrête, recule trop près : son rétro (côté passager) arrache celui de la
  // voiture garée (côté conducteur). Les warnings de la voiture garée clignotent. Mila file sans laisser de mot.
  let mila = null;
  function sceneAccident() {
    if (!mila) mila = creerVoiture('#FF7EA5', 'Mila');
    const v = mila, g = cibleGaree;
    // la voiture garée retrouve son rétro (personne n'a rien vu)
    if (g.retros.g.parent !== g.g) { scene.remove(g.retros.g); g.g.add(g.retros.g); }
    g.retros.g.position.set(0.62, 0.86, -0.8); g.retros.g.rotation.set(0, 0, 0); g.retros.g.visible = true;
    particules.forEach((p) => { if (p.retro) p.vie = 0; });
    v.g.visible = true; v.g.rotation.set(0, 0, 0); v.g.position.set(RUE.x0 + 0.4, 0.03, VOIE.aller); v.g.scale.setScalar(0.001); v.retros.d.rotation.y = 0;
    allumer(v, 'stop', false); allumer(v, 'recul', false); allumer(v, 'phares', nuit > 0.5);
    let phase = 'avance', t = 0, warn = 0, vitesse = 5.4;
    const xArret = g.g.position.x + 6.0;
    annoncer('Mila arrive en voiture…', { x: g.g.position.x + 2, z: 8.2, zoom: 1.7 }, 'mila');
    return {
      nom: 'accident',
      maj(dt) {
        t += dt;
        const p = v.g.position;
        if (phase === 'avance') {
          vitesse = Math.max(0.5, Math.min(5.4, (xArret - p.x) * 1.4));
          p.x += vitesse * dt;
          if (xArret - p.x < 0.05) { p.x = xArret; phase = 'arret'; t = 0; allumer(v, 'stop', true); }
        } else if (phase === 'arret') {
          if (t > 0.9) { phase = 'recule'; t = 0; allumer(v, 'stop', false); allumer(v, 'recul', true); }
        } else if (phase === 'recule') {
          // elle recule en braquant un peu : l'arrière file vers le trottoir
          p.x -= 1.9 * dt;
          const k = Math.min(1, (xArret - p.x) / 5.4);
          p.z = VOIE.aller + 0.27 * k; v.g.rotation.y = 0.06 * k;
          if (p.x <= g.g.position.x + 0.12) {
            phase = 'choc'; t = 0; allumer(v, 'recul', false); allumer(v, 'stop', true);
            const r = g.retros.g, w = new THREE.Vector3(); r.getWorldPosition(w);
            g.g.remove(r); r.visible = false;
            if (!texRetro) texRetro = garder(toile(48, 48, (cx) => { cx.fillStyle = g.couleur; rond(cx, 6, 10, 36, 28, 6); cx.fill(); cx.fillStyle = '#9FB4CF'; rond(cx, 12, 15, 24, 18, 4); cx.fill(); }));
            particule({ tex: texRetro, p: w, v: new THREE.Vector3(-2.6, 3.4, -0.4), vie: 60, gravite: 9, taille: 0.42, retro: true, sol: 0.08, rebond: 0.35 });
            v.retros.d.rotation.y = 0.9;
            bulle(new THREE.Vector3(w.x + 0.4, 1.9, w.z - 0.3), 'Clac !', '#C2410C', 1500, true);
            secousse = 0.35; warn = 4.5;
            annoncer('Clac. Mila vient d\'arracher le rétro de la voiture garée.', { x: g.g.position.x, z: 8.4, zoom: 2.0 }, 'mila');
          }
        } else if (phase === 'choc') {
          if (t > 0.5 && !v.oups) { v.oups = true; bulle(v, 'Oups…', '#E0457B', 1700); }
          if (t > 2.4) { phase = 'fuite'; t = 0; v.oups = false; allumer(v, 'stop', false); }
        } else if (phase === 'fuite') {
          vitesse = Math.min(8, 1 + t * 5);
          p.x += vitesse * dt; p.z += (VOIE.aller - p.z) * Math.min(1, dt * 1.5); v.g.rotation.y += (0 - v.g.rotation.y) * Math.min(1, dt * 2);
          if (p.x > RUE.x1 - 0.3) { v.g.visible = false; phase = 'fin'; annoncer('Mila a filé sans laisser de mot.', null, 'mila'); }
        }
        if (warn > 0) { warn -= dt; allumer(g, 'cligno', warn > 0 && Math.floor(warn * 3) % 2 === 0); if (Math.abs(warn - 3.9) < dt) bulle(g, 'Biip biip', '#C2410C', 1800); }
        entreeSortie(v, p.x);
        return phase !== 'fin' || warn > 0;
      }
    };
  }

  // Celles qui n'ont rien à faire escaladent la grille de la résidence et vont se baigner. Le voisin allume la lumière,
  // elles ressortent en courant, mouillées.
  function scenePiscine() {
    const libres = Object.values(agents).filter((ag) => ag.role !== 'toi' && ag.g.visible && !ag.travail && !ag.scene);
    if (!libres.length) return null;
    const qui = libres.sort(() => tirage() - 0.5).slice(0, Math.min(2, libres.length));
    let phase = 'aller', t = 0, presse = false;
    const dansLeau = new Set();
    const noms = qui.map((ag) => ag.prenom);
    const quiParle = qui[0].role;
    annoncer((noms.length > 1 ? noms.join(' et ') + ' ont' : noms[0] + ' a') + ' repéré la piscine de la résidence…', { x: 10.5, z: 1.5, zoom: 1.6 }, quiParle);
    qui.forEach((ag, i) => {
      ag.scene = 'piscine';
      const xg = ESCALADE.x[i], depart = ag.g.position;
      const ch = [];
      if (dedans(depart)) { const tmp = []; versSeuil(depart, tmp); tmp.forEach((q) => ch.push({ type: 'aller', cible: q })); ch.push({ type: 'aller', cible: new THREE.Vector3(Math.max(-14, Math.min(3, depart.x)), SOL, 3.0) }); }
      ch.push({ type: 'aller', cible: new THREE.Vector3(depart.x > 3.6 ? depart.x : 3.6, SOL, 5.1 + i * 0.3) });
      ch.push({ type: 'aller', cible: new THREE.Vector3(xg, SOL, 5.1 + i * 0.3) }, { type: 'aller', cible: new THREE.Vector3(xg, SOL, ESCALADE.dehors) });
      ch.push({ type: 'attendre', duree: 0.4 + i * 0.5, regard: Math.PI });
      ch.push({ type: 'arc', a: new THREE.Vector3(xg, COUR, ESCALADE.dedans), duree: 1.1, hauteur: 1.45 });
      ch.push({ type: 'aller', cible: new THREE.Vector3(xg - 0.4, COUR, 0.4), accroupi: true, y: COUR });
      ch.push({ type: 'aller', cible: new THREE.Vector3(9.6 + i * 1.6, COUR, -0.05), accroupi: true, y: COUR });
      ch.push({ type: 'attendre', duree: 0.3 + i * 0.4, regard: Math.PI });
      const plongeon = new THREE.Vector3(10.4 + i * 1.9, EAU - 1.25, -1.6);
      ch.push({ type: 'arc', a: plongeon, duree: 0.7, hauteur: 1.3, fin: () => { eclabousser(new THREE.Vector3(plongeon.x, EAU + 0.1, plongeon.z)); dansLeau.add(ag); ag.mouille = 14; teinter(ag); } });
      ch.push({ type: 'nager', centre: new THREE.Vector3(PISCINE.x - 0.6 + i * 1.2, 0, PISCINE.z), r: 1.6, ph: i * 3.1, duree: 0 });
      agir(ag, ch);
    });
    function sortir() {
      phase = 'sortie'; t = 0;
      qui.forEach((ag, i) => {
        const xg = ESCALADE.x[i];
        const ch = [];
        if (dansLeau.has(ag)) ch.push({ type: 'arc', a: new THREE.Vector3(9.4 + i * 1.4, COUR, 0.1), duree: 0.5, hauteur: 0.8 });
        ch.push({ type: 'aller', cible: new THREE.Vector3(xg, COUR, ESCALADE.dedans), vitesse: 5.2, y: COUR });
        ch.push({ type: 'arc', a: new THREE.Vector3(xg, SOL, ESCALADE.dehors), duree: 0.75, hauteur: 1.4 });
        ch.push({ type: 'aller', cible: new THREE.Vector3(xg, SOL, 5.15 + i * 0.3), vitesse: 5.2 });
        const fin = pointLibre(); fin.y = SOL;
        ch.push({ type: 'aller', cible: new THREE.Vector3(Math.min(3.0, fin.x), SOL, 5.15 + i * 0.3), vitesse: 4.6 });
        ch.push({ type: 'fn', f: () => { ag.scene = null; ag.pause = 1; if (ag.travail && ag.poste) cheminVers(ag, ag.poste.siege, ag.poste.allee); else cheminVers(ag, fin, null); } });
        ag.actions = ch;
      });
    }
    return {
      nom: 'piscine',
      presser() { presse = true; },
      maj(dt) {
        t += dt;
        if (phase === 'aller' && (dansLeau.size === qui.length || (presse && t > 1))) {
          phase = 'baignade'; t = 0;
          if (dansLeau.size) { bulle(qui[0].role, 'Trop bien !', qui[0].couleur, 1800); annoncer(qui.length > 1 ? 'Plouf. Les voilà dans la piscine.' : 'Plouf. La voilà dans la piscine.', null, quiParle); }
        }
        if (phase === 'baignade') {
          if (Math.floor(t / 1.6) !== Math.floor((t - dt) / 1.6)) dansLeau.forEach((ag) => onde(ag.g.position));
          if (qui[1] && Math.abs(t - 2.2) < dt) bulle(qui[1].role, 'Hihi', qui[1].couleur, 1400);
          if (t > (presse ? 1.2 : 6.5)) { phase = 'voisin'; t = 0; bulle(new THREE.Vector3(FENETRE.x, FENETRE.y + 1.4, FENETRE.z + 0.4), 'Hé ! C\'est privé !', '#B4433B', 2600, true); annoncer(qui.length > 1 ? 'Le voisin les a vues !' : 'Le voisin l\'a vue !', { x: 12, z: -2, zoom: 1.7 }, quiParle); }
        }
        if (phase === 'voisin') { if (t > 1.0) sortir(); }
        if (phase === 'sortie') {
          // des gouttes derrière celles qui courent
          qui.forEach((ag) => { if (ag.mouille > 8 && tirage() < dt * 7) particule({ tex: texGoutte, p: ag.g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), v: new THREE.Vector3(0, 0.5, 0), vie: 0.8, gravite: 6, taille: 0.2 }); });
          if (qui.every((ag) => !ag.scene)) { phase = 'fin'; annoncer(qui.length > 1 ? 'Retour au studio, mouillées.' : 'Retour au studio, mouillée.', null, quiParle); }
        }
        return phase !== 'fin';
      }
    };
  }
  function lancerScene(nom) {
    if (sceneEnCours || calme) return false;
    const s = nom === 'accident' ? sceneAccident() : nom === 'piscine' ? scenePiscine() : null;
    if (!s) return false;
    sceneEnCours = s; derniere[nom] = horloge.t;
    demanderRendu();
    return true;
  }
  function choisirScene() {
    const libres = Object.values(agents).filter((ag) => ag.role !== 'toi' && !ag.travail && ag.g.visible).length;
    const options = ['accident'];
    if (libres >= 1 && !(ETAT && ETAT.nuit && tirage() < 0.5)) options.push('piscine', 'piscine');
    const possibles = options.filter((n) => horloge.t - derniere[n] > 120);
    return possibles.length ? possibles[Math.floor(tirage() * possibles.length)] : null;
  }

  /* ── la caméra : tourner autour, se déplacer, s'approcher ── */
  const vue = { az: 34, zoom: 1, cibleAz: 34, cibleZoom: 1, vitesse: 0, cx: SOCLE.x, cz: SOCLE.z, cibleX: SOCLE.x, cibleZ: SOCLE.z };
  let W = 1, H = 1, secousse = 0;
  function vueDepart() {
    const asp = W / H;
    // sur un écran étroit, on commence plus près du studio et de la rue
    if (asp < 1.1) { vue.cibleZoom = 1.45; vue.cibleX = -2.2; vue.cibleZ = -0.6; } else { vue.cibleZoom = 1; vue.cibleX = SOCLE.x; vue.cibleZ = SOCLE.z; }
    vue.cibleAz = 34;
  }
  function redimensionner() {
    const r = conteneur.getBoundingClientRect();
    const premiere = W === 1 && H === 1;
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
    if (premiere) { vueDepart(); vue.zoom = vue.cibleZoom; vue.cx = vue.cibleX; vue.cz = vue.cibleZ; vue.az = vue.cibleAz; }
    placerCamera(); demanderRendu();
  }
  function placerCamera() {
    const asp = W / H;
    const haut = Math.max(27, 47 / asp) / vue.zoom;
    // sur un écran étroit, les cartes sont en bas : le point visé remonte vers le haut de l'écran
    const dec = asp < 1.1 ? 0.12 : 0;
    camera.left = -haut * asp / 2; camera.right = haut * asp / 2; camera.top = haut * (0.5 - dec); camera.bottom = -haut * (0.5 + dec);
    const az = vue.az * RAD, d = 90;
    const sx = secousse > 0 ? (Math.random() - 0.5) * secousse * 0.6 : 0, sz = secousse > 0 ? (Math.random() - 0.5) * secousse * 0.6 : 0;
    camera.position.set(vue.cx + sx + Math.sin(az) * Math.cos(ELEVATION) * d, Math.sin(ELEVATION) * d, vue.cz + sz + Math.cos(az) * Math.cos(ELEVATION) * d);
    camera.lookAt(vue.cx + sx, 1.0, vue.cz + sz);
    camera.updateProjectionMatrix();
  }
  // déplacer la cible de la caméra d'un glissé à l'écran (en pixels)
  function glisserCible(dx, dy) {
    const haut = Math.max(27, 47 / (W / H)) / vue.zoom, parPx = haut / H;
    const az = vue.az * RAD;
    const droite = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)), avant = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az));
    vue.cibleX -= (droite.x * dx - avant.x * dy / Math.sin(ELEVATION)) * parPx;
    vue.cibleZ -= (droite.z * dx - avant.z * dy / Math.sin(ELEVATION)) * parPx;
    vue.cibleX = Math.max(SOCLE.x - SOCLE.w / 2, Math.min(SOCLE.x + SOCLE.w / 2, vue.cibleX));
    vue.cibleZ = Math.max(SOCLE.z - SOCLE.d / 2, Math.min(SOCLE.z + SOCLE.d / 2, vue.cibleZ));
    vue.cx = vue.cibleX; vue.cz = vue.cibleZ;
  }
  const pointeurs = new Map();
  let geste = null, dernierGeste = 0;
  const el = renderer.domElement;
  el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  el.addEventListener('pointerdown', (ev) => {
    pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    dernierGeste = performance.now();
    if (pointeurs.size === 1) geste = { x0: ev.clientX, y0: ev.clientY, t0: performance.now(), az0: vue.cibleAz, bouge: false, dernierX: ev.clientX, dernierY: ev.clientY, dernierT: performance.now(), deplace: ev.button === 2 || ev.shiftKey };
    if (pointeurs.size === 2) { const p = [...pointeurs.values()]; geste = { pince: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), zoom0: vue.cibleZoom, mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2, bouge: true }; }
    el.setPointerCapture(ev.pointerId);
  });
  el.addEventListener('pointermove', (ev) => {
    if (!pointeurs.has(ev.pointerId) || !geste) return;
    pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    dernierGeste = performance.now();
    if (geste.pince != null && pointeurs.size === 2) {
      const p = [...pointeurs.values()];
      vue.cibleZoom = THREE.MathUtils.clamp(geste.zoom0 * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / geste.pince, ZMIN, ZMAX);
      const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
      glisserCible(mx - geste.mx, my - geste.my); geste.mx = mx; geste.my = my;
      demanderRendu(); return;
    }
    const dx = ev.clientX - geste.x0, dy = ev.clientY - geste.y0;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) geste.bouge = true;
    if (!geste.bouge) return;
    if (geste.deplace) { glisserCible(ev.clientX - geste.dernierX, ev.clientY - geste.dernierY); geste.dernierX = ev.clientX; geste.dernierY = ev.clientY; demanderRendu(); return; }
    const t = performance.now();
    vue.vitesse = (ev.clientX - geste.dernierX) / Math.max(8, t - geste.dernierT) * -0.35;
    geste.dernierX = ev.clientX; geste.dernierT = t;
    vue.cibleAz = geste.az0 - dx * 0.35; vue.az = vue.cibleAz; demanderRendu();
  });
  const lacher = (ev) => {
    const g = geste;
    pointeurs.delete(ev.pointerId);
    if (!pointeurs.size) {
      if (g && !g.bouge && g.t0 && performance.now() - g.t0 < 450) toucher(ev.clientX, ev.clientY);
      geste = null;
    } else if (pointeurs.size === 1) geste = null;
  };
  el.addEventListener('pointerup', lacher);
  el.addEventListener('pointercancel', (ev) => { pointeurs.delete(ev.pointerId); geste = null; });
  el.addEventListener('wheel', (ev) => { ev.preventDefault(); dernierGeste = performance.now(); vue.cibleZoom = THREE.MathUtils.clamp(vue.cibleZoom * Math.exp(-ev.deltaY * 0.0015), ZMIN, ZMAX); demanderRendu(); }, { passive: false });
  el.addEventListener('dblclick', () => { vueDepart(); demanderRendu(); });
  const rayon = new THREE.Raycaster(), souris = new THREE.Vector2();
  function toucher(x, y) {
    const r = el.getBoundingClientRect();
    souris.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(souris, camera);
    const h = rayon.intersectObjects(cibles.filter((o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; }), false)[0];
    if (!h) { if (rappels.rien) rappels.rien(); return; }
    const type = h.object.userData.type;
    if (type === 'agent' && rappels.agent) rappels.agent(h.object.userData.role);
    else if (type === 'ecran' && rappels.ecran) rappels.ecran((ETAT && ETAT.ecran) || null);
    else if (type === 'enseigne' && rappels.enseigne) rappels.enseigne();
    else if (type === 'voiture') { const ok = horloge.t - derniere.accident > 25 && lancerScene('accident'); if (rappels.voiture) rappels.voiture(ok); }
    else if (type === 'piscine') { const ok = horloge.t - derniere.piscine > 25 && lancerScene('piscine'); if (rappels.piscine) rappels.piscine(ok); }
  }

  /* ── la boucle ── */
  let enMarche = false, raf = 0, dernier = performance.now(), visible = true, besoin = true;
  function demanderRendu() { besoin = true; if (!enMarche) demarrer(); }
  const _cible = new THREE.Vector3();
  function lumieres(dt) {
    nuit += (nuitCible - nuit) * Math.min(1, dt * 2.5);
    if (Math.abs(nuitCible - nuit) < 0.002) nuit = nuitCible;
    hemi.intensity = 1.3 - 0.78 * nuit; hemi.color.set('#FFFFFF').lerp(new THREE.Color('#8FA3D9'), nuit); hemi.groundColor.set('#CDD6E4').lerp(new THREE.Color('#1B2644'), nuit);
    soleil.intensity = 2.2 - 1.6 * nuit; soleil.color.set('#FFFFFF').lerp(new THREE.Color('#AFC2FF'), nuit);
    appoint.intensity = 0.45 - 0.3 * nuit;
    renderer.toneMappingExposure = 1.02 + 0.12 * nuit;
    matFenetres.emissiveIntensity = 0.95 * nuit;
    matAmpoules.color.set('#E8EDF5').lerp(new THREE.Color('#FFE3AE'), nuit);
    matHalo.opacity = 0.75 * nuit;
    matEau.emissiveIntensity = 0.05 + 0.4 * nuit;
    return nuit !== nuitCible;
  }
  function animer(t, dt) {
    let bouge = lumieres(dt);
    horloge.t += dt;
    // l'eau qui bouge
    texEau.offset.x = (t * 0.018) % 1; texEau.offset.y = Math.sin(t * 0.4) * 0.02;
    Object.values(agents).forEach((ag) => {
      if (!ag.g.visible) return;
      const p = ag.g.position;
      if (ag.mouille > 0) { ag.mouille -= dt; if (ag.mouille <= 0) teinter(ag); }
      if (ag.actions.length) { executer(ag, dt, t); bouge = true; }
      else if (ag.role === 'toi') { ag.g.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) * 0.6; ag.corpsG.position.y = Math.abs(Math.sin(t * 2.2)) * 0.08; bouge = true; }
      else if (ag.chemin.length) {
        const c = ag.chemin[0];
        _cible.copy(c); const d = _cible.sub(p); d.y = 0;
        const L = d.length();
        if (L < 0.06) { p.x = c.x; p.z = c.z; ag.chemin.shift(); }
        else { d.multiplyScalar(Math.min(1, MARCHE * dt / L)); p.add(d); ag.g.rotation.y = Math.atan2(c.x - p.x + d.x, c.z - p.z + d.z); }
        p.y += (c.y - p.y) * Math.min(1, dt * 7);
        ag.corpsG.position.y = Math.abs(Math.sin(t * 9 + ag.ph)) * 0.12; ag.corpsG.scale.y = 1;
        if (!ag.chemin.length) {
          if (ag.travail && ag.poste && Math.hypot(p.x - ag.poste.siege.x, p.z - ag.poste.siege.z) < 0.2) { ag.assis = true; ag.g.rotation.y = Math.PI; }
          else if (ag.allerBanc) { ag.assisBanc = ag.allerBanc; ag.allerBanc = null; }
          else ag.pause = 2.5 + tirage() * 5;
        }
        bouge = true;
      } else if (ag.travail && ag.assis) {
        // au travail : assise, tournée vers son écran, un petit balancement de quelqu'un qui tape
        ag.g.rotation.y = Math.PI;
        ag.corpsG.position.y = -0.26 + (calme ? 0 : Math.sin(t * 6 + ag.ph) * 0.025);
        bouge = bouge || !calme;
      } else if (ag.travail && !ag.assis && ag.poste) {
        cheminVers(ag, ag.poste.siege, ag.poste.allee);
      } else if (!ag.travail) {
        ag.corpsG.position.y = 0;
        if (ag.assisBanc) { ag.g.rotation.y += angleVers(ag.g.rotation.y, ag.assisBanc.ry) * Math.min(1, dt * 5); ag.corpsG.position.y = -0.22; }
        ag.pause -= dt;
        if (ag.pause <= 0 && !calme) {
          const libre = BANCS.find((b) => !Object.values(agents).some((o) => o !== ag && (o.assisBanc === b || o.allerBanc === b)));
          if (libre && tirage() < 0.3) { cheminVers(ag, new THREE.Vector3(libre.x + (tirage() - 0.5) * 0.8, SOL, libre.z - 0.08), null); ag.allerBanc = libre; }
          else cheminVers(ag, pointLibre(), null);
        }
        bouge = bouge || !calme;
      }
      if (ag.saut > 0) { ag.saut -= dt; ag.corpsG.position.y += Math.abs(Math.sin(ag.saut * 7)) * 0.7 * Math.min(1, ag.saut); bouge = true; }
      ag.etiquette.position.y = 2.5 + ag.corpsG.position.y;
      ag.ombre.visible = p.y > EAU - 0.6;
    });
    // les écrans s'allument dans la couleur de leur titulaire quand elle travaille
    Object.keys(postes).forEach((role) => {
      const ps = postes[role], ag = agents[role];
      const on = !!(ag && ag.travail && ag.assis);
      ps.lumiere += ((on ? 1 : 0) - ps.lumiere) * Math.min(1, dt * 4);
      const base = new THREE.Color(C.ecran);
      if (ag) ps.ecran.color.copy(base.lerp(new THREE.Color(ag.travail && ag.travail.bloque ? '#F87171' : pale(ag.couleur, 0.15)), ps.lumiere * (0.82 + (on && !calme ? Math.sin(t * 3 + role.length) * 0.08 : 0))));
      if (Math.abs(ps.lumiere - (on ? 1 : 0)) > 0.01) bouge = true;
    });
    // les bulles suivent celle (ou ce) qui parle
    for (let i = bulles.length - 1; i >= 0; i--) {
      const b = bulles[i];
      const ag = b.role ? agents[b.role] : null;
      if ((b.fin && performance.now() > b.fin) || (b.role && (!ag || !ag.g.visible))) { scene.remove(b.s); b.s.material.map.dispose(); b.s.material.dispose(); bulles.splice(i, 1); continue; }
      if (ag) b.s.position.set(ag.g.position.x, ag.g.position.y + ag.corpsG.position.y + 3.55 + Math.sin(t * 2.4) * 0.08, ag.g.position.z);
      else if (b.objet && b.objet.g) b.s.position.set(b.objet.g.position.x, 3.0 + Math.sin(t * 2.4) * 0.06, b.objet.g.position.z);
      else if (b.objet) b.s.position.copy(b.objet);
    }
    for (let i = vols.length - 1; i >= 0; i--) {
      const v = vols[i], k = Math.min(1, (performance.now() - v.t0) / v.d), e = easeInOut(k);
      v.s.position.lerpVectors(v.a, v.b, e); v.s.position.y += Math.sin(e * Math.PI) * v.haut;
      v.s.material.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
      if (k >= 1) { scene.remove(v.s); v.s.material.dispose(); vols.splice(i, 1); }
      bouge = true;
    }
    for (let i = particules.length - 1; i >= 0; i--) {
      const q = particules[i];
      q.age += dt;
      if (q.onde) { const k = q.age / q.vie; q.s.scale.setScalar(0.4 + k * 3.2); q.s.material.opacity = Math.max(0, 1 - k); }
      else {
        if (q.freinage) q.v.multiplyScalar(Math.max(0, 1 - q.freinage * dt));
        q.v.y -= q.g * dt;
        q.s.position.addScaledVector(q.v, dt);
        if (q.sol != null && q.s.position.y < q.sol) { q.s.position.y = q.sol; q.v.y = -q.v.y * (q.rebond || 0); q.v.x *= 0.6; q.v.z *= 0.6; if (Math.abs(q.v.y) < 0.4) { q.v.set(0, 0, 0); q.g = 0; } }
        q.s.material.rotation += q.tourne * dt * (q.g ? 1 : 0);
        const reste = q.vie - q.age;
        q.s.material.opacity = Math.min(1, reste / 0.5);
      }
      if (q.age >= q.vie) { scene.remove(q.s); q.s.material.dispose(); particules.splice(i, 1); continue; }
      if (q.g || q.onde || q.v.lengthSq() > 0) bouge = true;
    }
    // la circulation
    if (!calme) {
      prochainePassante -= dt;
      if (prochainePassante <= 0) { prochainePassante = 14 + tirage() * 22; if (passantes.length < 2) lancerPassante(); }
    }
    for (let i = passantes.length - 1; i >= 0; i--) {
      const v = passantes[i];
      v.g.position.x += v.sens * v.vitesse * dt;
      entreeSortie(v, v.g.position.x);
      if ((v.sens > 0 && v.g.position.x > RUE.x1 - 0.2) || (v.sens < 0 && v.g.position.x < RUE.x0 + 0.2)) { enleverVoiture(v); passantes.splice(i, 1); }
      bouge = true;
    }
    // les scènes
    if (sceneEnCours) { if (!sceneEnCours.maj(dt)) sceneEnCours = null; bouge = true; }
    else if (!calme) {
      prochaineScene -= dt;
      if (prochaineScene <= 0) { const n = choisirScene(); prochaineScene = n && lancerScene(n) ? 110 + tirage() * 120 : 30; }
    }
    if (secousse > 0) { secousse = Math.max(0, secousse - dt); bouge = true; }
    if (Math.abs(vue.vitesse) > 0.002 && !geste) { vue.cibleAz += vue.vitesse * dt * 60; vue.az = vue.cibleAz; vue.vitesse *= Math.pow(0.9, dt * 60); bouge = true; }
    const z0 = vue.zoom; vue.zoom += (vue.cibleZoom - vue.zoom) * Math.min(1, dt * 6);
    if (Math.abs(vue.cibleAz - vue.az) > 0.01) { vue.az += (vue.cibleAz - vue.az) * Math.min(1, dt * 6); bouge = true; }
    if (Math.abs(vue.cibleX - vue.cx) > 0.005 || Math.abs(vue.cibleZ - vue.cz) > 0.005) { vue.cx += (vue.cibleX - vue.cx) * Math.min(1, dt * 4); vue.cz += (vue.cibleZ - vue.cz) * Math.min(1, dt * 4); bouge = true; }
    if (Math.abs(z0 - vue.zoom) > 0.0005) bouge = true;
    placerCamera();
    return bouge;
  }
  function boucle(t) {
    raf = requestAnimationFrame(boucle);
    if (!visible || document.hidden) return;
    const dt = Math.min(0.1, (t - dernier) / 1000); dernier = t;
    const bouge = animer(t / 1000, dt);
    if (bouge || besoin) { renderer.render(scene, camera); besoin = false; }
  }
  function demarrer() { if (enMarche) return; enMarche = true; dernier = performance.now(); raf = requestAnimationFrame(boucle); }
  function arreter() { enMarche = false; cancelAnimationFrame(raf); }
  const observateur = 'IntersectionObserver' in window ? new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) demanderRendu(); }, { threshold: 0.02 }) : null;
  if (observateur) observateur.observe(conteneur);
  const surRedim = () => redimensionner();
  window.addEventListener('resize', surRedim);
  redimensionner();
  demarrer();

  // les fêtes : des confettis, l'équipe qui saute, une bulle de celle qui a fini
  function feter(type) {
    const eq = (ETAT && ETAT.equipe) || {};
    const couleurs = Object.values(eq).map((m) => m.couleur).concat([(ETAT && ETAT.moi && ETAT.moi.accent) || '#8B5CF6', '#FFD166']);
    const haut = new THREE.Vector3(TELEPHONE.x, PLANCHER + 6.8, TELEPHONE.z + 0.4);
    if (type === 'prete') { confettis(haut, couleurs); sauter(Object.keys(postes)); bulle('realisation', 'Elle est prête !', (eq.realisation || {}).couleur || '#3B82F6', 2600); }
    else if (type === 'publiee') {
      confettis(haut, couleurs, 30); sauter(['diffusion', 'idees', 'plume']); bulle('diffusion', 'En ligne !', (eq.diffusion || {}).couleur || '#EC4899', 2600);
      if (!calme) { const tex = garder(textureAvion()); particule({ tex, p: haut.clone(), v: new THREE.Vector3(3.4, 3.2, 2.2), vie: 3.2, gravite: -0.6, taille: 0.9, profondeur: false, tourne: 0 }); }
    } else if (type === 'idees') {
      const ag = agents.idees;
      if (ag) { particule({ tex: garder(textureAmpoule()), p: ag.g.position.clone().add(new THREE.Vector3(0, 3.6, 0)), v: new THREE.Vector3(0, 0.25, 0), vie: 2.6, gravite: 0, taille: 1.0, profondeur: false, tourne: 0 }); ag.saut = 1.1; bulle('idees', 'J\'ai des idées !', ag.couleur, 2400); }
    } else if (type === 'badge' || type === 'bienvenue') {
      confettis(new THREE.Vector3(-5, 5.5, 3.4), couleurs, type === 'bienvenue' ? 60 : 40); sauter(Object.keys(postes));
      if (type === 'bienvenue') { const ag = agents.idees; if (ag) bulle('idees', 'Bienvenue !', ag.couleur, 3000); }
    }
    demanderRendu();
  }

  if (/^(localhost|127\.)/.test(location.hostname)) window.__ville = { agents, postes, vue, scene: () => sceneEnCours, horloge, lancer: (n) => lancerScene(n), feter };
  return {
    maj,
    redimensionner,
    feter,
    scene: (nom) => lancerScene(nom),
    element: renderer.domElement,
    // regarder un endroit (la voiture de Mila, la piscine, l'équipe) ou revenir à la vue de départ
    regarder(f) { if (!f) vueDepart(); else { vue.cibleX = f.x; vue.cibleZ = f.z; if (f.zoom) vue.cibleZoom = Math.max(vue.cibleZoom, Math.min(ZMAX, f.zoom * (W / H < 1.1 ? 1.25 : 1))); } demanderRendu(); },
    zoomer(k) { vue.cibleZoom = THREE.MathUtils.clamp(vue.cibleZoom * k, ZMIN, ZMAX); demanderRendu(); },
    tourner(deg) { vue.cibleAz += deg; demanderRendu(); },
    // déplacer la maquette dans un autre emplacement (l'accueil se redessine sans recréer la 3D)
    attacher(nouveau) { if (nouveau === conteneur) return; if (observateur) observateur.unobserve(conteneur); conteneur = nouveau; conteneur.appendChild(renderer.domElement); if (observateur) observateur.observe(conteneur); redimensionner(); demarrer(); },
    pause() { arreter(); },
    reprendre() { demarrer(); demanderRendu(); },
    inactif: () => performance.now() - dernierGeste,
    detruire() {
      arreter(); window.removeEventListener('resize', surRedim); if (observateur) observateur.disconnect();
      scene.traverse((o) => { if (o.material) { [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } if (o.geometry) o.geometry.dispose(); });
      jetables.forEach((g) => g.dispose && g.dispose()); Object.values(texFeuilles).forEach((t) => t.dispose()); Object.values(texCarres).forEach((t) => t.dispose());
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}
