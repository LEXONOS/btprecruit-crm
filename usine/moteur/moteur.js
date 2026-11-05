// Le moteur du Studio 3D : il construit la scène décrite par Oscar (pièces, plans, caméra, actions), puis calcule
// n'importe quelle image à l'instant t, sans dépendre des images d'avant. La page de rendu l'appelle image par image.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { KIT } from './kit.js';
import { matiere, teinte } from './matieres.js';
import { creerCalque, morceaux } from './calque.js';
import { clamp, lerp, entreeSortie, lisse, sortie, angleVers, num, vec, rad } from './outils.js';

const FONDS = {
  nuit: ['#0d1526', '#03060c', '#0f1a2e'],
  studio: ['#2b3039', '#0c0e12', '#1f232a'],
  bleu: ['#0e2d52', '#020a17', '#0b2342'],
  ardoise: ['#2f3a45', '#10161d', '#24303b'],
  clair: ['#eef1f5', '#c4cbd4', '#dde2e9']
};
const RAMPE = 0.6;          // secondes pour changer de vitesse ou d'état
const FONDU = 0.45;         // apparition et disparition
const TRANSITION = 0.75;    // passage d'un plan de caméra au suivant

function textureDegrade(c1, c2) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'), d = g.createLinearGradient(0, 0, 0, 512);
  d.addColorStop(0, c1); d.addColorStop(1, c2); g.fillStyle = d; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function textureSol(couleur, grille) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(512, 512, 0, 512, 512, 512);
  const col = new THREE.Color(couleur);
  const rgb = (a) => 'rgba(' + Math.round(col.r * 255) + ',' + Math.round(col.g * 255) + ',' + Math.round(col.b * 255) + ',' + a + ')';
  r.addColorStop(0, rgb(1)); r.addColorStop(0.55, rgb(0.85)); r.addColorStop(1, rgb(0));
  g.fillStyle = r; g.fillRect(0, 0, 1024, 1024);
  if (grille) {
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function creer(spec) {
  const W = spec.largeur || 1080, H = spec.hauteur || 1920;
  const style = Object.assign({ fond: 'nuit', accent: '#FFD60A', accent2: '#38BDF8', sol: 'socle' }, (spec.scene && spec.scene.style) || {}, spec.style || {});
  const scene3d = spec.scene || {};
  const temps = spec.temps || [];
  const textes = spec.textes || { beats: [] };
  const duree = spec.duree || (temps.length ? temps[temps.length - 1].fin + 0.5 : 10);

  // qualité du rendu 3D : la 3D peut être calculée plus petite puis agrandie (les textes restent nets, posés après)
  const Q = Object.assign({ echelle: 0.5, msaa: 4, bloom: true, ombre: 1024 }, spec.qualite || {});
  const W3 = Math.round(W * Q.echelle / 2) * 2, H3 = Math.round(H * Q.echelle / 2) * 2;
  const toile = document.createElement('canvas'); toile.width = W3; toile.height = H3;
  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W3, H3, false);
  renderer.shadowMap.enabled = Q.ombre > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = num(style.exposition, 1.05);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const fond = FONDS[style.fond] || FONDS.nuit;
  scene.background = textureDegrade(fond[0], fond[1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(num(style.focale, 40), W / H, 0.05, 400);

  /* ── les pièces ── */
  const objets = {};          // id -> { def, res, racine, mailles, base, ... }
  const ordre = [];
  (scene3d.objets || []).forEach((def) => {
    if (!def || typeof def.id !== 'string' || !KIT[def.type] || objets[def.id]) return;
    let res;
    try { res = KIT[def.type](def.params || {}, def); } catch (e) { console.warn('pièce impossible', def.id, e.message); return; }
    if (!res || !res.racine) return;
    if (def.matiere && !(def.params && def.params.matiere)) {
      // une matière donnée au niveau de la pièce s'applique à ses formes simples
      res.racine.traverse((m) => { if (m.isMesh && !m.isInstancedMesh && ['boite', 'cylindre', 'sphere', 'cone', 'tore', 'capsule'].indexOf(def.type) >= 0) m.material = matiere(def.matiere, def.couleur); });
    }
    const mailles = [];
    res.racine.traverse((m) => { if (m.isMesh) mailles.push(m); });
    // chaque pièce a ses propres matières (fondu, rayons X et surbrillance pièce par pièce)
    const copies = new Map();
    mailles.forEach((m) => {
      if (!copies.has(m.material)) { const c = m.material.clone(); c.userData.base = { opacite: c.opacity, transparent: c.transparent, depthWrite: c.depthWrite, emissif: c.emissive ? c.emissive.clone() : null }; copies.set(m.material, c); }
      m.material = copies.get(m.material);
    });
    const coque = new Set((res.coque || mailles).map((m) => m));
    const o = { def, res, racine: res.racine, mailles, materiaux: Array.from(copies.values()), coque, enfants: [] };
    objets[def.id] = o; ordre.push(def.id);
  });
  // hiérarchie : une pièce peut être posée dans une autre (son repère est alors celui du parent)
  ordre.forEach((id) => {
    const o = objets[id], p = o.def.parent && objets[o.def.parent] && o.def.parent !== id ? objets[o.def.parent] : null;
    // pas de boucle parent -> enfant -> parent
    let x = p, n = 0; while (x && n < 30) { if (x === o) { o.parentId = null; break; } x = x.def.parent ? objets[x.def.parent] : null; n++; }
    o.parentId = p && o.parentId !== null ? p.def.id : null;
    (o.parentId ? objets[o.parentId].racine : scene).add(o.racine);
    if (o.parentId) objets[o.parentId].enfants.push(id);
    const d = o.def;
    o.racine.position.fromArray(vec(d.pos, [0, 0, 0]));
    const r = vec(d.rot, [0, 0, 0]); o.racine.rotation.set(rad(r[0]), rad(r[1]), rad(r[2]));
    const e = d.echelle; if (typeof e === 'number') o.racine.scale.setScalar(e); else if (vec(e, null)) o.racine.scale.fromArray(e);
  });
  scene.updateMatrixWorld(true);
  // repères pour la caméra et les étiquettes : centre et rayon de chaque pièce dans son propre repère
  ordre.forEach((id) => {
    const o = objets[id];
    const inv = new THREE.Matrix4().copy(o.racine.matrixWorld).invert();
    const b = new THREE.Box3();
    o.mailles.forEach((m) => { if (m.geometry) { m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); b.union(bb); } });
    if (o.def.type === 'particules' || o.def.type === 'jet_eau') { const p = o.def.params || {}; const L = num(p.longueur, 1.5); const dir = new THREE.Vector3().fromArray(vec(p.direction, [0, 0, 1])).normalize(); b.makeEmpty(); b.expandByPoint(new THREE.Vector3()); b.expandByPoint(dir.multiplyScalar(L)); b.expandByScalar(num(p.rayon, 0.3)); }
    if (b.isEmpty()) b.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(0.2, 0.2, 0.2));
    o.centreLocal = b.getCenter(new THREE.Vector3());
    o.rayonLocal = Math.max(0.05, b.getSize(new THREE.Vector3()).length() / 2);
    const a = vec(o.def.ancre, null) || (o.res.ancre && vec(o.res.ancre, null));
    o.ancreLocal = a ? new THREE.Vector3().fromArray(a) : o.centreLocal.clone();
  });
  // la scène entière (pour les plans larges)
  const boiteTout = new THREE.Box3();
  ordre.forEach((id) => { const o = objets[id]; if (o.def.visible === false) return; const c = o.centreLocal.clone().applyMatrix4(o.racine.matrixWorld); const s = o.rayonLocal * o.racine.getWorldScale(new THREE.Vector3()).x; boiteTout.expandByPoint(c.clone().addScalar(s * 0.7)); boiteTout.expandByPoint(c.clone().addScalar(-s * 0.7)); });
  if (boiteTout.isEmpty()) boiteTout.setFromCenterAndSize(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(2, 2, 2));
  const centreTout = boiteTout.getCenter(new THREE.Vector3()), rayonTout = Math.max(0.5, boiteTout.getSize(new THREE.Vector3()).length() / 2);

  /* ── le sol, les lumières ── */
  const solY = num(style.sol_y, Math.min(0, boiteTout.min.y));
  if (style.sol !== 'aucun') {
    const solR = rayonTout * 2.6;
    const sol = new THREE.Mesh(new THREE.CircleGeometry(solR, 96), new THREE.MeshStandardMaterial({ map: textureSol(fond[2], style.sol === 'grille' || style.sol === 'socle'), transparent: true, roughness: 0.85, metalness: 0, depthWrite: false }));
    sol.rotation.x = -Math.PI / 2; sol.position.y = solY - 0.002; scene.add(sol);
    const ombre = new THREE.Mesh(new THREE.CircleGeometry(solR, 96), new THREE.ShadowMaterial({ opacity: style.fond === 'clair' ? 0.22 : 0.42 }));
    ombre.rotation.x = -Math.PI / 2; ombre.position.y = solY; ombre.receiveShadow = true; scene.add(ombre);
  }
  scene.add(new THREE.HemisphereLight('#d7e8ff', '#20242b', 0.55));
  const cle = new THREE.DirectionalLight('#fff1e2', 2.4);
  cle.position.copy(centreTout).add(new THREE.Vector3(rayonTout * 1.3, rayonTout * 2.4, rayonTout * 1.8));
  cle.target.position.copy(centreTout); scene.add(cle, cle.target);
  cle.castShadow = Q.ombre > 0; cle.shadow.mapSize.set(Q.ombre || 512, Q.ombre || 512); cle.shadow.bias = -0.0004; cle.shadow.normalBias = 0.02; cle.shadow.radius = 5;
  const sc = cle.shadow.camera; sc.left = sc.bottom = -rayonTout * 1.6; sc.right = sc.top = rayonTout * 1.6; sc.near = 0.1; sc.far = rayonTout * 8;
  const contre = new THREE.DirectionalLight('#8fcaff', 1.5); contre.position.copy(centreTout).add(new THREE.Vector3(-rayonTout * 2, rayonTout, -rayonTout * 2.2)); scene.add(contre);
  const appoint = new THREE.DirectionalLight('#ffffff', 0.4); appoint.position.copy(centreTout).add(new THREE.Vector3(-rayonTout * 1.5, rayonTout * 0.6, rayonTout * 2.5)); scene.add(appoint);

  /* ── les plans : l'état de chaque pièce, plan par plan ── */
  const plans = (scene3d.plans || []).slice(0, Math.max(1, temps.length));
  while (plans.length < temps.length) plans.push(plans.length ? plans[plans.length - 1] : {});
  const T = temps.length ? temps : [{ debut: 0, fin: duree }];
  const etats = {};
  ordre.forEach((id) => {
    const d = objets[id].def, p = d.params || {};
    etats[id] = [];
    let cur = { vis: d.visible !== false, vitesse: 0, flux: !!(p.flux && p.flux.actif), vflux: num(p.flux && p.flux.vitesse, 0.6), pos: vec(d.pos, [0, 0, 0]), transp: 0, couleur: null, compr: 1 };
    plans.forEach((pl) => {
      cur = Object.assign({}, cur);
      (pl.montrer || []).forEach((x) => { if (x === id) cur.vis = true; });
      (pl.cacher || []).forEach((x) => { if (x === id) cur.vis = false; });
      (pl.actions || []).forEach((a) => {
        if (!a || a.objet !== id) return;
        if (a.faire === 'tourner') cur.vitesse = num(a.vitesse, 1);
        else if (a.faire === 'arreter') cur.vitesse = 0;
        else if (a.faire === 'flux') { cur.flux = a.on !== false; if (typeof a.vitesse === 'number') cur.vflux = a.vitesse; if (a.couleur) cur.couleur = a.couleur; }
        else if (a.faire === 'deplacer') cur.pos = vec(a.vers, cur.pos);
        else if (a.faire === 'transparent') cur.transp = clamp(num(a.valeur, 0.8), 0, 1);
        else if (a.faire === 'opaque') cur.transp = 0;
        else if (a.faire === 'couleur') cur.couleur = a.couleur || cur.couleur;
        else if (a.faire === 'compresser') cur.compr = clamp(num(a.valeur, 0.6), 0.2, 1.5);
        else if (a.faire === 'montrer') cur.vis = true;
        else if (a.faire === 'cacher') cur.vis = false;
      });
      etats[id].push(cur);
    });
    // angle et phase du flux cumulés au début de chaque plan (vitesses qui changent en douceur)
    let A = 0, F = 0;
    etats[id].forEach((e, i) => {
      e.A0 = A; e.F0 = F;
      const dur = T[i].fin - T[i].debut, prev = i ? etats[id][i - 1] : e;
      const integre = (v0, v1, d) => { const r = Math.min(RAMPE, d); return v0 * r + (v1 - v0) * r / 2 + v1 * Math.max(0, d - r); };
      A += integre(prev.vitesse, e.vitesse, dur) * Math.PI * 2;
      F += integre(prev.vflux, e.vflux, dur);
    });
  });
  function indicePlan(t) { for (let i = T.length - 1; i >= 0; i--) if (t >= T[i].debut) return i; return 0; }
  function cumule(e0, e1, champ, v0key, dt, facteur) {
    // valeur cumulée à dt secondes après le début du plan : vitesse qui passe de e0 à e1 en RAMPE secondes
    const v0 = e0[v0key], v1 = e1[v0key], r = RAMPE;
    const inte = dt < r ? v0 * dt + (v1 - v0) * dt * dt / (2 * r) : v0 * r + (v1 - v0) * r / 2 + v1 * (dt - r);
    return e1[champ] + inte * facteur;
  }

  // engrenages menés : leur angle suit la roue qui les entraîne (rapport des dents) ; même axe : même angle
  function angleDe(id, t, profondeur) {
    const o = objets[id];
    const ent = o.def.params && o.def.params.entraine_par;
    if (ent && objets[ent.objet] && (profondeur || 0) < 10) {
      const m = objets[ent.objet], am = angleDe(ent.objet, t, (profondeur || 0) + 1);
      if (ent.mode === 'axe') return am;
      const zm = m.res.dents || 20, zo = o.res.dents || 20;
      return -am * zm / zo + (o.dephasage || 0);
    }
    const i = indicePlan(t), e1 = etats[id][i], e0 = i ? etats[id][i - 1] : e1;
    return cumule(e0, e1, 'A0', 'vitesse', Math.max(0, t - T[i].debut), Math.PI * 2);
  }
  // déphasage d'un engrenage mené : une dent de l'un tombe dans un creux de l'autre
  ordre.forEach((id) => {
    const o = objets[id], ent = o.def.params && o.def.params.entraine_par;
    if (!ent || ent.mode === 'axe' || !objets[ent.objet] || o.def.type !== 'engrenage') return;
    const m = objets[ent.objet];
    const pa = new THREE.Vector3().setFromMatrixPosition(o.racine.matrixWorld), pb = new THREE.Vector3().setFromMatrixPosition(m.racine.matrixWorld);
    const axe = (o.res.axe || 'z');
    const d = pb.clone().sub(pa);
    const phi = axe === 'z' ? Math.atan2(d.y, d.x) : axe === 'x' ? Math.atan2(d.y, -d.z) : Math.atan2(-d.z, d.x);
    const zo = o.res.dents || 20, zm = m.res.dents || 20;
    const phiM = phi + Math.PI;
    // l'angle de la roue menante à t=0 vaut 0 : son repère de dent est sur phiM ; on cale la roue menée sur un creux
    o.dephasage = phi + Math.PI / zo + phiM * zm / zo;
  });
  function fluxDe(id, t) {
    const i = indicePlan(t), e1 = etats[id][i], e0 = i ? etats[id][i - 1] : e1;
    const dt = Math.max(0, t - T[i].debut);
    const phase = cumule(e0, e1, 'F0', 'vflux', dt, 1);
    const k0 = e0.flux ? 1 : 0, k1 = e1.flux ? 1 : 0;
    return { phase, k: lerp(k0, k1, lisse(dt / RAMPE)), couleur: e1.couleur };
  }
  function etatLisse(id, t, champ, duree) {
    const i = indicePlan(t), e1 = etats[id][i], e0 = i ? etats[id][i - 1] : e1;
    const k = entreeSortie((t - T[i].debut) / duree);
    const a = e0[champ], b = e1[champ];
    if (typeof a === 'boolean') return lerp(a ? 1 : 0, b ? 1 : 0, k);
    if (Array.isArray(a)) return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    return lerp(a, b, k);
  }

  /* ── la caméra ── */
  const hfov = 2 * Math.atan(Math.tan(rad(camera.fov / 2)) * camera.aspect);
  const centreDe = (id) => { const o = objets[id]; return o ? o.centreLocal.clone().applyMatrix4(o.racine.matrixWorld) : centreTout.clone(); };
  const rayonDe = (id) => { const o = objets[id]; if (!o) return rayonTout; const s = new THREE.Vector3(); o.racine.getWorldScale(s); return o.rayonLocal * Math.max(s.x, s.y, s.z); };
  function cibleDe(c) {
    if (Array.isArray(c) && vec(c, null)) return { p: new THREE.Vector3().fromArray(c), r: 1 };
    if (Array.isArray(c)) { const b = new THREE.Box3(); c.forEach((id) => { if (objets[id]) { const p = centreDe(id), r = rayonDe(id) * 0.7; b.expandByPoint(p.clone().addScalar(r)); b.expandByPoint(p.clone().addScalar(-r)); } }); if (!b.isEmpty()) return { p: b.getCenter(new THREE.Vector3()), r: b.getSize(new THREE.Vector3()).length() / 2 }; }
    if (typeof c === 'string' && objets[c]) return { p: centreDe(c), r: rayonDe(c) };
    return { p: centreTout.clone(), r: rayonTout };
  }
  function camPlan(i, t) {
    const pl = plans[i] || {}, cam = pl.camera || {};
    const c = cibleDe(cam.cible || 'tout');
    const ajuste = (c.r / Math.sin(Math.min(hfov, rad(camera.fov)) / 2)) * num(cam.cadrage, 1.0);
    // une distance trop courte met la caméra dans la pièce : on garde au moins 1,7 fois son rayon
    const dist = Math.max(num(cam.distance, ajuste), c.r * 1.7, 0.35);
    let az = num(cam.azimut, 30), el = num(cam.elevation, 16);
    const k = lisse(clamp((t - T[i].debut) / Math.max(0.1, T[i].fin - T[i].debut), 0, 1));
    let d = dist;
    const mv = cam.mouvement || 'orbite', amp = num(cam.amplitude, 1);
    if (mv === 'orbite') az += lerp(-9, 9, k) * amp;
    else if (mv === 'avance') d *= lerp(1.12, 0.9, k * amp);
    else if (mv === 'recule') d *= lerp(0.88, 1.12, k * amp);
    else if (mv === 'monte') el += lerp(-7, 9, k) * amp;
    else if (mv === 'descend') el += lerp(9, -7, k) * amp;
    else { az += lerp(-1.5, 1.5, k); d *= lerp(1.01, 0.99, k); }
    const p = c.p.clone();
    if (vec(cam.decalage, null)) p.add(new THREE.Vector3().fromArray(cam.decalage));
    return { p, d, az, el: clamp(el, -60, 85) };
  }
  function camA(t) {
    const i = indicePlan(t);
    let s = camPlan(i, t);
    const pl = plans[i] || {};
    if (i > 0 && !(pl.camera && pl.camera.transition === 'coupe')) {
      const k = entreeSortie((t - T[i].debut) / TRANSITION);
      if (k < 1) {
        const prev = camPlan(i - 1, T[i].debut);
        s = { p: prev.p.clone().lerp(s.p, k), d: lerp(prev.d, s.d, k), az: angleVers(prev.az, s.az, k), el: lerp(prev.el, s.el, k) };
      }
    }
    return s;
  }

  /* ── une image ── */
  const sortieToile = document.createElement('canvas'); sortieToile.width = W; sortieToile.height = H;
  const ctx = sortieToile.getContext('2d');
  const rt = new THREE.WebGLRenderTarget(W3, H3, { type: THREE.HalfFloatType, samples: Q.msaa || 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(W3, H3);
  composer.addPass(new RenderPass(scene, camera));
  if (Q.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W3 / 2, H3 / 2), num(style.bloom, 0.5), 0.5, 0.95));
  composer.addPass(new OutputPass());
  const calque = creerCalque(W, H, style);
  const langue = textes.langue || 'en';
  const morceauxBeats = (textes.beats || []).map((b) => morceaux((b && b.mots) || [], langue));
  const accent = teinte(style.accent, '#ffd60a');

  // un gros plan sur une pièce : tout ce qui n'est ni elle, ni étiqueté, ni en surbrillance s'efface, pour qu'aucune
  // coque ou mur translucide ne vienne voiler l'image
  const autos = plans.map((pl) => {
    const cam = (pl && pl.camera) || {};
    if (pl && pl.isoler) return null;
    const ids = [].concat(cam.cible || []).filter((x) => typeof x === 'string' && objets[x]);
    if (!ids.length) return null;
    const r = Math.max.apply(null, ids.map(rayonDe));
    if (r > rayonTout * 0.45) return null;
    return ids.concat((pl.etiquettes || []).map((e) => e.objet), pl.surbrillance || []).filter((x) => objets[x]);
  });
  function isoleAuto(i) { return autos[i] || []; }
  function poser(t) {
    const i = indicePlan(t), pl = plans[i] || {};
    const iso = new Set(pl.isoler || isoleAuto(i));
    if (iso.size) { // les parents et les enfants d'une pièce isolée restent visibles
      const ajoute = (id) => { (objets[id] ? objets[id].enfants : []).forEach((c) => { iso.add(c); ajoute(c); }); };
      Array.from(iso).forEach((id) => { ajoute(id); let x = objets[id]; while (x && x.parentId) { iso.add(x.parentId); x = objets[x.parentId]; } });
    }
    const brille = new Set(pl.surbrillance || []);
    const isoPrec = new Set(i ? (plans[i - 1].isoler || isoleAuto(i - 1)) : []);
    const kTrans = entreeSortie((t - T[i].debut) / FONDU);
    ordre.forEach((id) => {
      const o = objets[id];
      const pos = etatLisse(id, t, 'pos', 0.9);
      o.racine.position.fromArray(pos);
      const vis = etatLisse(id, t, 'vis', FONDU);
      o.racine.visible = vis > 0.01;
      o.vis = vis;
      // rotation
      const ang = angleDe(id, t);
      if (o.res.tourner) o.res.tourner(ang);
      else if (o.res.pivot) o.res.pivot.rotation[o.res.axe || 'y'] = ang;
      if (o.res.ressort) { const c = etatLisse(id, t, 'compr', 0.8); o.res.pivot.scale[o.res.axe || 'y'] = c; }
      // fluide
      if (o.res.flux) { const f = fluxDe(id, t); if (f.couleur && o.res.teinter && o.couleurAct !== f.couleur) { o.res.teinter(f.couleur); o.couleurAct = f.couleur; } o.res.flux(f.phase, f.k * (vis > 0.5 ? 1 : vis * 2)); }
      // isolement, rayons X, surbrillance
      const ghostNow = iso.size && !iso.has(id) ? 1 : 0;
      const ghostAvant = isoPrec.size && !isoPrec.has(id) ? 1 : 0;
      const ghost = lerp(ghostAvant, ghostNow, kTrans);
      const transp = etatLisse(id, t, 'transp', 0.7);
      const kb = brille.has(id) ? sortie((t - T[i].debut) / 0.4) * (0.55 + 0.45 * Math.sin((t - T[i].debut) * Math.PI * 2.2)) : 0;
      o.mailles.forEach((m) => {
        const mt = m.material, b = mt.userData.base;
        if (!b) return;
        let op = b.opacite * (1 - 0.93 * ghost);
        if (o.coque.has(m)) op *= (1 - 0.86 * transp);
        op *= Math.min(1, vis);
        const transparent = b.transparent || op < 0.995;
        if (mt.transparent !== transparent) { mt.transparent = transparent; mt.needsUpdate = true; }
        mt.opacity = op;
        mt.depthWrite = transparent ? false : b.depthWrite;
        m.castShadow = op > 0.6 && !b.transparent;
        if (b.emissif && mt.emissive) mt.emissive.copy(b.emissif).lerp(accent, kb * 0.22);
      });
    });
    scene.updateMatrixWorld(true);
    const s = camA(t);
    const off = new THREE.Vector3(Math.sin(rad(s.az)) * Math.cos(rad(s.el)), Math.sin(rad(s.el)), Math.cos(rad(s.az)) * Math.cos(rad(s.el))).multiplyScalar(s.d);
    camera.position.copy(s.p).add(off);
    camera.near = Math.max(0.02, s.d / 60); camera.far = s.d * 30 + rayonTout * 6; camera.updateProjectionMatrix();
    camera.lookAt(s.p);
    camera.updateMatrixWorld(true);
    return i;
  }

  function etiquettesA(t, i) {
    const pl = plans[i] || {}, beat = (textes.beats || [])[i] || {};
    const liste = (beat.etiquettes && beat.etiquettes.length ? beat.etiquettes : pl.etiquettes) || [];
    const d0 = T[i].debut, d1 = T[i].fin;
    return liste.slice(0, 3).map((e, k) => {
      const o = objets[e.objet];
      if (!o || !e.texte) return { visible: false };
      const p = o.ancreLocal.clone().applyMatrix4(o.racine.matrixWorld);
      const v = p.clone().project(camera);
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      const dedans = v.z < 1 && x > W * 0.03 && x < W * 0.97 && y > H * 0.06 && y < H * 0.9;
      const kin = sortie((t - d0 - 0.4 - k * 0.3) / 0.45), kout = clamp((d1 - t - 0.05) / 0.25, 0, 1);
      return { x, y, texte: String(e.texte).slice(0, 40), visible: dedans && o.vis > 0.3, k: Math.min(kin, kout) };
    });
  }

  const profil = { poser: 0, rendu: 0, calque: 0, n: 0 };
  function image(t) {
    const p0 = performance.now();
    const i = poser(t);
    const p1 = performance.now();
    composer.render();
    if (spec.profil) renderer.getContext().finish();
    const p2 = performance.now();
    profil.poser += p1 - p0; profil.rendu += p2 - p1; profil.n++;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = Q.lissage || 'medium';
    ctx.drawImage(toile, 0, 0, W, H);
    if (spec.profil) { ctx.getImageData(0, 0, 1, 1); profil.copie = (profil.copie || 0) + performance.now() - p2; }
    calque.fondVignette(ctx);
    calque.etiquettes(ctx, etiquettesA(t, i));
    calque.accroche(ctx, textes.accroche, t, T[0].fin, langue);
    const b = (textes.beats || [])[i] || {};
    if (i > 0 || !textes.accroche) calque.ecran(ctx, b.ecran, t, T[i].debut, T[i].fin, langue);
    calque.sousTitres(ctx, morceauxBeats[i] || [], t, langue);
    calque.progression(ctx, t, duree);
    calque.marque(ctx, style.marque);
    profil.calque += performance.now() - p2;
    return sortieToile;
  }

  return { image, duree, toile: sortieToile, objets, plans: plans.length, profil, renderer };
}
