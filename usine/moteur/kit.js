// Le kit : les pièces que les scènes assemblent. Des formes simples (boîte, cylindre, tuyau...) et des mécanismes
// justes par construction (engrenages qui s'engrènent, bielle et piston, compresseur à spirales, roue de tunnelier...).
// Chaque pièce rend { racine, pivot?, tourner?(angle), flux?(phase, k), teinter?(couleur), coque?[], ancre? }.
// Unités : le mètre. Axes : y vers le haut, la caméra par défaut regarde depuis +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { matiere, lueur, teinte } from './matieres.js';
import { num, vec, frac, hasard, graineDe, clamp } from './outils.js';

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const maille = (g, m) => { const x = new THREE.Mesh(g, m); x.castShadow = true; x.receiveShadow = true; return x; };
const mat = (p, defaut, couleurDefaut) => matiere(p.matiere || defaut, p.couleur || couleurDefaut);

// une géométrie construite le long de y, tournée vers l'axe voulu
function orienter(g, axe) {
  if (axe === 'x') g.rotateZ(-Math.PI / 2);
  else if (axe === 'z') g.rotateX(Math.PI / 2);
  return g;
}
const vecteurAxe = (axe) => (axe === 'x' ? new THREE.Vector3(1, 0, 0) : axe === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
const axeDe = (p, d) => (['x', 'y', 'z'].indexOf(p.axe) >= 0 ? p.axe : d);

// une texture de flux : des têtes lumineuses qui traînent une queue, la direction se lit d'un coup d'œil
let TEX_FLUX = null;
function textureFlux() {
  if (TEX_FLUX) return TEX_FLUX;
  const c = document.createElement('canvas'); c.width = 128; c.height = 8;
  const g = c.getContext('2d');
  const d = g.createLinearGradient(0, 0, 128, 0);
  d.addColorStop(0, 'rgba(255,255,255,0.05)'); d.addColorStop(0.62, 'rgba(255,255,255,0.35)'); d.addColorStop(0.9, 'rgba(255,255,255,1)'); d.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = d; g.fillRect(0, 0, 128, 8);
  TEX_FLUX = new THREE.CanvasTexture(c); TEX_FLUX.wrapS = THREE.RepeatWrapping; TEX_FLUX.wrapT = THREE.RepeatWrapping; TEX_FLUX.colorSpace = THREE.SRGBColorSpace;
  return TEX_FLUX;
}

// le fluide qui circule dans un tube : un cœur lumineux texturé qui défile
function coeurDeFlux(courbe, rayon, longueur, couleur, segments) {
  const tex = textureFlux().clone(); tex.needsUpdate = true;
  const periode = 0.22;
  tex.repeat.set(Math.max(1, longueur / periode), 1);
  const m = new THREE.MeshBasicMaterial({ color: teinte(couleur, '#2fb8ff').multiplyScalar(1.35), map: tex, transparent: true, opacity: 1, depthWrite: false, toneMapped: false });
  const coeur = new THREE.Mesh(new THREE.TubeGeometry(courbe, segments, rayon, 8, false), m);
  coeur.renderOrder = 2;
  const base = teinte(couleur, '#2fb8ff');
  return {
    mesh: coeur,
    flux(phase, k) { coeur.visible = k > 0.01; m.opacity = k; tex.offset.x = -phase / periode; },
    teinter(c) { base.copy(teinte(c, '#2fb8ff')); m.color.copy(base).multiplyScalar(1.35); }
  };
}

/* ───────────── formes simples ───────────── */
function boite(p) {
  const t = vec(p.taille, [1, 1, 1]);
  const r = clamp(num(p.arrondi, 0.03), 0, Math.min(t[0], t[1], t[2]) / 2 - 0.001);
  const g = r > 0.002 ? new RoundedBoxGeometry(t[0], t[1], t[2], 3, r) : new THREE.BoxGeometry(t[0], t[1], t[2]);
  const racine = new THREE.Group(); racine.add(maille(g, mat(p, 'plastique')));
  return { racine };
}
function cylindre(p) {
  const r = num(p.rayon, 0.25), h = num(p.hauteur, 0.5), axe = axeDe(p, 'y');
  const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot);
  const m = mat(p, 'acier');
  if (num(p.creux, 0) > 0) {
    const e = Math.min(num(p.creux, 0.02), r * 0.9);
    const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false);
    const trou = new THREE.Path(); trou.absarc(0, 0, r - e, 0, Math.PI * 2, true); s.holes.push(trou);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 40 }); g.translate(0, 0, -h / 2); g.rotateX(-Math.PI / 2);
    pivot.add(maille(orienter(g, axe), m));
  } else pivot.add(maille(orienter(new THREE.CylinderGeometry(r, num(p.rayon_bas, r), h, 48, 1), axe), m));
  return { racine, pivot, axe };
}
function sphere(p) { const racine = new THREE.Group(); racine.add(maille(new THREE.SphereGeometry(num(p.rayon, 0.25), 40, 24), mat(p, 'acier'))); return { racine }; }
function cone(p) { const axe = axeDe(p, 'y'); const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot); pivot.add(maille(orienter(new THREE.ConeGeometry(num(p.rayon, 0.25), num(p.hauteur, 0.5), 40), axe), mat(p, 'acier'))); return { racine, pivot, axe }; }
function tore(p) { const axe = axeDe(p, 'y'); const g = new THREE.TorusGeometry(num(p.rayon, 0.3), num(p.tube, 0.05), 16, 64); g.rotateX(Math.PI / 2); const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot); pivot.add(maille(orienter(g, axe), mat(p, 'acier'))); return { racine, pivot, axe }; }
function capsule(p) { const axe = axeDe(p, 'y'); const r = num(p.rayon, 0.15); const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot); pivot.add(maille(orienter(new THREE.CapsuleGeometry(r, Math.max(0.001, num(p.hauteur, 0.6) - 2 * r), 8, 32), axe), mat(p, 'peinture'))); return { racine, pivot, axe }; }
function groupe() { return { racine: new THREE.Group() }; }

/* ───────────── tuyaux et fluides ───────────── */
function courbeDe(points) {
  const pts = (Array.isArray(points) ? points : []).filter((q) => vec(q, null)).map(V3);
  if (pts.length < 2) pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}
function tuyau(p) {
  const courbe = courbeDe(p.points);
  const L = courbe.getLength(), r = num(p.rayon, 0.035);
  const seg = Math.min(400, Math.max(48, Math.round(L * 70)));
  const racine = new THREE.Group();
  const avecFlux = !!p.flux || p.flux === undefined;
  const coque = maille(new THREE.TubeGeometry(courbe, seg, r, 14, false), mat(p, avecFlux ? 'verre' : 'cuivre'));
  racine.add(coque);
  // embouts : de petits manchons en bout de tube, plus propres qu'une coupe nette
  [0, 1].forEach((u) => { const m = maille(new THREE.CylinderGeometry(r * 1.25, r * 1.25, r * 1.6, 18), matiere('laiton')); m.position.copy(courbe.getPointAt(u)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), courbe.getTangentAt(u)); racine.add(m); });
  const out = { racine, coque: [coque], courbe };
  if (avecFlux) {
    const f = coeurDeFlux(courbe, r * 0.62, L, (p.flux && p.flux.couleur) || p.fluide || 'froid', seg);
    racine.add(f.mesh); out.flux = f.flux; out.teinter = f.teinter;
  }
  out.ancre = courbe.getPointAt(0.5).toArray();
  return out;
}
// un serpentin à ailettes (condenseur, évaporateur, radiateur) : le tube fait des allers-retours dans un plan
function serpentin(p) {
  const w = num(p.largeur, 1), h = num(p.hauteur, 0.8), n = Math.max(2, Math.min(16, Math.round(num(p.rangs, 6)))), r = num(p.rayon, 0.022);
  const pas = h / (n - 1), b = pas / 2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = h / 2 - i * pas, versGauche = i % 2 === 0;
    const a = versGauche ? w / 2 : -w / 2, z = versGauche ? -w / 2 : w / 2;
    pts.push([a, y, 0], [a + (z - a) * 0.5, y, 0], [z, y, 0]);
    if (i < n - 1) pts.push([z + (versGauche ? -b : b), y - pas / 2, 0]);
  }
  const courbe = courbeDe(pts);
  const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot);
  const L = courbe.getLength(), seg = Math.min(600, Math.round(L * 60));
  const tube = maille(new THREE.TubeGeometry(courbe, seg, r, 10, false), mat(p, 'cuivre'));
  pivot.add(tube);
  const nb = Math.max(0, Math.min(120, Math.round(num(p.ailettes, Math.round(w / 0.035)))));
  if (nb) {
    const fin = new THREE.BoxGeometry(0.004, h + pas, r * 5);
    const im = new THREE.InstancedMesh(fin, matiere('alu'), nb); im.castShadow = true; im.receiveShadow = true;
    const o = new THREE.Object3D();
    for (let i = 0; i < nb; i++) { o.position.set(-w / 2 + (i + 0.5) * w / nb, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    pivot.add(im);
  }
  const out = { racine, pivot, coque: [tube], courbe };
  if (p.flux !== false) { const f = coeurDeFlux(courbe, r * 0.62, L, (p.flux && p.flux.couleur) || p.fluide || 'chaud', seg); pivot.add(f.mesh); out.flux = f.flux; out.teinter = f.teinter; f.mesh.visible = false; }
  // plan du serpentin : xy par défaut (face à la caméra), zy pour le tourner de profil
  if (p.plan === 'zy') pivot.rotation.y = Math.PI / 2;
  if (p.plan === 'xz') pivot.rotation.x = -Math.PI / 2;
  return out;
}
// des grains qui avancent : air soufflé, chaleur, gouttes, fumée
function particules(p) {
  const n = Math.max(8, Math.min(220, Math.round(num(p.nombre, 90))));
  const dir = V3(vec(p.direction, [0, 0, 1])).normalize();
  const longueur = num(p.longueur, 1.5), grain = Math.min(0.014, num(p.grain, 0.011)), etal = num(p.etalement, 0.22);
  const forme = p.forme === 'boite' ? 'boite' : 'disque';
  const taille = vec(p.taille, [0.6, 0.2, 0.2]), rayon = num(p.rayon, 0.3);
  const rnd = hasard(graineDe(JSON.stringify(p).slice(0, 200)));
  const geo = p.style === 'points' ? new THREE.SphereGeometry(1, 6, 4) : new THREE.CapsuleGeometry(0.5, 1.6, 2, 6);
  const m = new THREE.MeshBasicMaterial({ color: teinte(p.couleur || 'air', '#e8f4ff').multiplyScalar(1.25), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false;
  const racine = new THREE.Group(); racine.add(im);
  // perpendiculaires pour l'émetteur
  const a = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u1 = new THREE.Vector3().crossVectors(dir, a).normalize(), u2 = new THREE.Vector3().crossVectors(dir, u1).normalize();
  const graines = [];
  for (let i = 0; i < n; i++) {
    let s;
    if (forme === 'boite') s = new THREE.Vector3((rnd() - 0.5) * taille[0], (rnd() - 0.5) * taille[1], (rnd() - 0.5) * taille[2]);
    else { const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * rayon; s = u1.clone().multiplyScalar(Math.cos(ang) * rr).add(u2.clone().multiplyScalar(Math.sin(ang) * rr)); }
    graines.push({ s, d: rnd(), w: (rnd() - 0.5) * 2, v: 0.75 + rnd() * 0.5, e: rnd() * 6.28 });
  }
  const o = new THREE.Object3D(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const base = teinte(p.couleur || 'air', '#e8f4ff');
  return {
    racine, coque: [],
    flux(phase, k) {
      im.visible = k > 0.01;
      for (let i = 0; i < n; i++) {
        const g = graines[i];
        const u = frac(g.d + phase * g.v / longueur);
        const fade = Math.sin(Math.PI * u) * k;
        o.position.copy(g.s).multiplyScalar(1 + etal * u * 2).addScaledVector(dir, u * longueur);
        o.position.addScaledVector(u1, Math.sin(g.e + u * 5) * 0.03 * u).addScaledVector(u2, g.w * etal * 0.15 * u);
        o.quaternion.copy(q);
        const sc = grain * (0.35 + 0.65 * fade);
        o.scale.set(sc, sc * (p.style === 'points' ? 1 : 1.2), sc);
        o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      m.opacity = 0.62 * k;
    },
    teinter(c) { base.copy(teinte(c, '#e8f4ff')); m.color.copy(base).multiplyScalar(1.25); }
  };
}
// un jet d'eau : des gouttes en parabole (fontaine, arrosage, injecteur)
function jet_eau(p) {
  const n = Math.max(10, Math.min(400, Math.round(num(p.nombre, 160))));
  const v0 = V3(vec(p.direction, [0, 2.4, 0])), g = num(p.gravite, 4.5), T = Math.max(0.2, (2 * v0.y) / g);
  const rnd = hasard(graineDe('jet' + JSON.stringify(p).slice(0, 120)));
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshPhysicalMaterial({ color: teinte(p.couleur || 'eau', '#2f8cff'), roughness: 0.05, transmission: 0, transparent: true, opacity: 0.85, emissive: teinte(p.couleur || 'eau', '#2f8cff'), emissiveIntensity: 0.35 }), n);
  im.frustumCulled = false; im.castShadow = false;
  const racine = new THREE.Group(); racine.add(im);
  const gr = [];
  for (let i = 0; i < n; i++) gr.push({ d: rnd(), dx: (rnd() - 0.5) * num(p.dispersion, 0.18), dz: (rnd() - 0.5) * num(p.dispersion, 0.18), s: 0.6 + rnd() * 0.6 });
  const o = new THREE.Object3D(), grain = num(p.grain, 0.022);
  return {
    racine, coque: [],
    flux(phase, k) {
      im.visible = k > 0.01;
      for (let i = 0; i < n; i++) {
        const c = gr[i], tau = frac(c.d + phase / (T * 1.4)) * T * 1.4;
        o.position.set((v0.x + c.dx) * tau, v0.y * tau - 0.5 * g * tau * tau, (v0.z + c.dz) * tau);
        const sc = (o.position.y < -0.02 ? 0 : grain * c.s) * k;
        o.scale.setScalar(sc); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  };
}
// une surface d'eau (bassin, réservoir) : un cylindre ou une boîte d'eau
function eau(p) {
  const racine = new THREE.Group();
  const m = matiere('eau', p.couleur);
  const g = p.forme === 'boite' ? new THREE.BoxGeometry(...vec(p.taille, [1, 0.3, 1])) : new THREE.CylinderGeometry(num(p.rayon, 0.6), num(p.rayon, 0.6), num(p.hauteur, 0.3), 48);
  const x = new THREE.Mesh(g, m); x.receiveShadow = true; racine.add(x);
  return { racine };
}
// une flèche lumineuse qui montre un sens (air, force, courant)
function fleche(p) {
  const a = V3(vec(p.de, [0, 0, 0])), b = V3(vec(p.vers, [1, 0, 0]));
  const d = b.clone().sub(a), L = Math.max(0.05, d.length()), r = num(p.rayon, 0.025);
  const racine = new THREE.Group(), axe = new THREE.Group(); racine.add(axe);
  const m = lueur(p.couleur || 'accent', 2);
  const corps = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L * 0.78, 12), m); corps.position.y = L * 0.39;
  const tete = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, L * 0.22, 16), m); tete.position.y = L * 0.89;
  axe.add(corps, tete); axe.position.copy(a); axe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return { racine, coque: [], ancre: a.clone().lerp(b, 0.5).toArray(), flux(phase, k) { const s = 0.92 + 0.08 * Math.sin(phase * 6); axe.scale.set(1, Math.max(0.001, k) * s, 1); } };
}

/* ───────────── mécanismes ───────────── */
function formeEngrenage(z, mod, trou) {
  const r = mod * z / 2, ra = r + mod, rf = Math.max(trou + mod, r - 1.25 * mod);
  const s = new THREE.Shape();
  for (let i = 0; i < z; i++) {
    const a0 = (i / z) * Math.PI * 2, pas = (Math.PI * 2) / z;
    const pts = [[rf, a0 - pas * 0.5], [rf, a0 - pas * 0.27], [ra, a0 - pas * 0.12], [ra, a0 + pas * 0.12], [rf, a0 + pas * 0.27]];
    pts.forEach((q, k) => { const x = Math.cos(q[1]) * q[0], y = Math.sin(q[1]) * q[0]; if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  }
  s.closePath();
  const h = new THREE.Path(); h.absarc(0, 0, trou, 0, Math.PI * 2, true); s.holes.push(h);
  // allègements : de grands trous sur les grosses roues
  if (rf > trou * 3.2 && z >= 18) {
    const rc = (rf + trou) / 2, rr = (rf - trou) * 0.28;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const c = new THREE.Path(); c.absarc(Math.cos(a) * rc, Math.sin(a) * rc, rr, 0, Math.PI * 2, true); s.holes.push(c); }
  }
  return s;
}
function engrenage(p) {
  const z = Math.max(6, Math.min(120, Math.round(num(p.dents, 20)))), mod = num(p.module, 0.04), e = num(p.epaisseur, 0.08), axe = axeDe(p, 'z');
  const trou = num(p.trou, Math.max(mod * 1.2, mod * z * 0.08));
  const g = new THREE.ExtrudeGeometry(formeEngrenage(z, mod, trou), { depth: e, bevelEnabled: true, bevelThickness: Math.min(0.006, e * 0.1), bevelSize: Math.min(0.005, mod * 0.15), bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -e / 2);
  if (axe === 'x') g.rotateY(Math.PI / 2); else if (axe === 'y') g.rotateX(-Math.PI / 2);
  const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot);
  pivot.add(maille(g, mat(p, 'acier')));
  const moyeu = maille(orienter(new THREE.CylinderGeometry(trou * 1.9, trou * 1.9, e * 1.25, 28), axe === 'z' ? 'z' : axe), matiere('acier_sombre'));
  pivot.add(moyeu);
  return { racine, pivot, axe, dents: z, rayon: mod * z / 2 };
}
function ventilateur(p) {
  const R = num(p.rayon, 0.4), nb = Math.max(2, Math.min(12, Math.round(num(p.pales, 4)))), axe = axeDe(p, 'z');
  const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot);
  const m = mat(p, 'plastique', '#2a2e35');
  const moyeu = maille(new THREE.SphereGeometry(R * 0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); moyeu.rotation.x = Math.PI / 2; pivot.add(moyeu);
  const pale = new THREE.Shape();
  pale.moveTo(0, -R * 0.07); pale.bezierCurveTo(R * 0.4, -R * 0.16, R * 0.85, -R * 0.24, R * 0.94, -R * 0.06); pale.bezierCurveTo(R * 0.98, R * 0.06, R * 0.7, R * 0.14, 0, R * 0.07);
  const gp = new THREE.ExtrudeGeometry(pale, { depth: 0.008, bevelEnabled: false, curveSegments: 12 }); gp.translate(R * 0.12, 0, -0.004);
  for (let i = 0; i < nb; i++) { const b = maille(gp, m); const s = new THREE.Group(); b.rotation.x = num(p.inclinaison, 28) * Math.PI / 180; s.add(b); s.rotation.z = (i / nb) * Math.PI * 2; pivot.add(s); }
  if (p.carenage !== false) {
    const anneau = maille(new THREE.TorusGeometry(R * 1.04, R * 0.035, 10, 64), matiere('plastique', '#1f2228')); racine.add(anneau);
    // grille de protection
    const fil = matiere('acier_sombre');
    for (let k = 1; k <= 3; k++) { const c = maille(new THREE.TorusGeometry(R * k / 3, 0.004, 6, 64), fil); c.position.z = R * 0.12; racine.add(c); }
    for (let k = 0; k < 8; k++) { const b = maille(new THREE.BoxGeometry(R * 2, 0.006, 0.006), fil); b.rotation.z = (k / 8) * Math.PI; b.position.z = R * 0.12; racine.add(b); }
  }
  if (axe !== 'z') { const q = new THREE.Group(); q.add(...racine.children.slice()); if (axe === 'x') q.rotation.y = Math.PI / 2; else q.rotation.x = -Math.PI / 2; racine.add(q); }
  return { racine, pivot, axe: 'z', axeLocal: true };
}
// ventilateur tangentiel (unité intérieure de clim) : un long cylindre de lamelles
function rouleau(p) {
  const r = num(p.rayon, 0.07), L = num(p.longueur, 0.9), nb = Math.max(8, Math.min(48, Math.round(num(p.pales, 28)))), axe = axeDe(p, 'x');
  const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.004, L, r * 0.45), mat(p, 'plastique', '#e9ecef'), nb); im.castShadow = true;
  const o = new THREE.Object3D();
  for (let i = 0; i < nb; i++) { const a = (i / nb) * Math.PI * 2; o.position.set(Math.cos(a) * r * 0.78, 0, Math.sin(a) * r * 0.78); o.rotation.set(0, -a + 0.6, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
  pivot.add(im);
  [-L / 2, 0, L / 2].forEach((y) => { const d = maille(new THREE.CylinderGeometry(r, r, 0.01, 32), matiere('plastique', '#d5d9de')); d.position.y = y; pivot.add(d); });
  const q = new THREE.Group(); q.add(pivot); racine.add(q);
  if (axe === 'x') q.rotation.z = -Math.PI / 2; else if (axe === 'z') q.rotation.x = Math.PI / 2;
  return { racine, pivot, axe: 'y', axeLocal: true };
}
function ressort(p) {
  const r = num(p.rayon, 0.08), L = num(p.longueur, 0.4), n = num(p.spires, 8), fil = num(p.fil, 0.012), axe = axeDe(p, 'y');
  class Helice extends THREE.Curve { getPoint(t, o) { o = o || new THREE.Vector3(); const a = t * n * Math.PI * 2; return o.set(Math.cos(a) * r, t * L - L / 2, Math.sin(a) * r); } }
  const g = orienter(new THREE.TubeGeometry(new Helice(), Math.round(n * 24), fil, 8, false), axe);
  const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot); pivot.add(maille(g, mat(p, 'acier')));
  return { racine, pivot, axe, ressort: true };
}
// vis d'Archimède ou convoyeur à vis (tunnelier, hachoir, pompe à vis)
function vis(p) {
  const R = num(p.rayon, 0.25), L = num(p.longueur, 1.2), pas = num(p.pas, 0.25), ra = num(p.arbre, R * 0.22), axe = axeDe(p, 'x');
  const tours = L / pas;
  const g = new ParametricGeometry(function (u, v, o) { const a = v * tours * Math.PI * 2, rr = ra + (R - ra) * u; o.set(Math.cos(a) * rr, v * L - L / 2, Math.sin(a) * rr); }, 6, Math.round(tours * 36));
  g.computeVertexNormals();
  const racine = new THREE.Group(), pivot = new THREE.Group(); racine.add(pivot);
  const m = mat(p, 'acier'); m.side = THREE.DoubleSide;
  pivot.add(maille(orienter(g, axe), m));
  pivot.add(maille(orienter(new THREE.CylinderGeometry(ra, ra, L * 1.06, 24), axe), matiere('acier_sombre')));
  return { racine, pivot, axe };
}
function piston_bielle(p) {
  const course = num(p.course, 0.4), al = num(p.alesage, 0.32), rm = course / 2, Lb = num(p.bielle, course * 1.75);
  const racine = new THREE.Group();
  const vilo = new THREE.Group(); racine.add(vilo);
  const flasque = maille(new THREE.CylinderGeometry(rm * 1.45, rm * 1.45, al * 0.22, 40), matiere('acier')); flasque.rotation.x = Math.PI / 2; vilo.add(flasque);
  const contre = maille(new THREE.CylinderGeometry(rm * 1.25, rm * 1.25, al * 0.24, 40, 1, false, Math.PI * 0.25, Math.PI * 0.5), matiere('fonte')); contre.rotation.x = Math.PI / 2; contre.rotation.z = Math.PI; vilo.add(contre);
  const maneton = maille(new THREE.CylinderGeometry(al * 0.09, al * 0.09, al * 0.5, 20), matiere('chrome')); maneton.rotation.x = Math.PI / 2; maneton.position.y = rm; vilo.add(maneton);
  const arbre = maille(new THREE.CylinderGeometry(al * 0.1, al * 0.1, al * 1.2, 20), matiere('acier_sombre')); arbre.rotation.x = Math.PI / 2; racine.add(arbre);
  const bielle = maille(new THREE.BoxGeometry(al * 0.16, Lb, al * 0.1), matiere('acier')); racine.add(bielle);
  const piston = new THREE.Group(); racine.add(piston);
  piston.add(maille(new THREE.CylinderGeometry(al / 2 * 0.97, al / 2 * 0.97, al * 0.62, 40), matiere('alu')));
  [0.16, 0.06].forEach((y) => { const s = maille(new THREE.TorusGeometry(al / 2 * 0.975, al * 0.012, 6, 40), matiere('acier_sombre')); s.rotation.x = Math.PI / 2; s.position.y = y * al; piston.add(s); });
  const haut = rm + Lb + al * 0.31;
  // la chemise couvre toute la course du piston (du point mort bas au point mort haut)
  const chemise = maille(new THREE.CylinderGeometry(al / 2 * 1.06, al / 2 * 1.06, course + al * 0.95, 40, 1, true), matiere('verre'));
  chemise.position.y = Lb + al * 0.47; racine.add(chemise);
  const flamme = new THREE.Mesh(new THREE.SphereGeometry(al * 0.42, 24, 12), lueur('tiede', 2.6)); flamme.position.y = haut + al * 0.45; flamme.scale.y = 0.35; racine.add(flamme);
  const moteur = p.mode !== 'pompe';
  return {
    racine, coque: [chemise], ancre: [0, haut, 0],
    tourner(a) {
      vilo.rotation.z = -a;
      const px = Math.sin(a) * rm, py = Math.cos(a) * rm;
      const yp = py + Math.sqrt(Math.max(0, Lb * Lb - px * px));
      piston.position.set(0, yp + al * 0.31, 0);
      bielle.position.set(px / 2, (py + yp) / 2, al * 0.2);
      bielle.rotation.z = Math.atan2(px, yp - py);
      // explosion au point mort haut, un tour sur deux (temps moteur)
      const cyc = ((a / (Math.PI * 2)) % 2 + 2) % 2;
      const k = moteur ? Math.max(0, 1 - Math.abs(cyc - 0.02) / 0.18) : 0;
      flamme.visible = k > 0.02; flamme.scale.set(0.6 + k * 0.4, 0.2 + k * 0.25, 0.6 + k * 0.4); flamme.position.y = yp + al * 0.31 + al * 0.36 + al * 0.08;
    }
  };
}
// compresseur à spirales (clim, frigo, pompe à chaleur) : une coque, un moteur, deux spirales dont l'une orbite
function compresseur(p) {
  const r = num(p.rayon, 0.15), h = num(p.hauteur, 0.5);
  const racine = new THREE.Group();
  const coque = maille(new THREE.CapsuleGeometry(r, h - 2 * r, 10, 40), mat(p, 'peinture', '#25292f'));
  racine.add(coque);
  // pieds et embouts
  const pied = matiere('caoutchouc');
  [0, 1, 2].forEach((k) => { const f = maille(new THREE.CylinderGeometry(r * 0.18, r * 0.22, r * 0.25, 12), pied); const a = k * Math.PI * 2 / 3; f.position.set(Math.cos(a) * r * 0.75, -h / 2 + r * 0.05, Math.sin(a) * r * 0.75); racine.add(f); });
  const sortie = maille(new THREE.CylinderGeometry(r * 0.12, r * 0.12, r * 0.5, 12), matiere('cuivre')); sortie.position.y = h / 2 + r * 0.1; racine.add(sortie);
  const entree = maille(new THREE.CylinderGeometry(r * 0.13, r * 0.13, r * 0.6, 12), matiere('cuivre')); entree.rotation.z = Math.PI / 2; entree.position.set(r * 1.05, -h * 0.18, 0); racine.add(entree);
  // le moteur : un stator en cuivre
  const stator = maille(new THREE.TorusGeometry(r * 0.62, r * 0.2, 10, 32), matiere('cuivre')); stator.rotation.x = Math.PI / 2; stator.position.y = -h * 0.12; racine.add(stator);
  const rotor = maille(new THREE.CylinderGeometry(r * 0.32, r * 0.32, h * 0.32, 24), matiere('acier_sombre')); rotor.position.y = -h * 0.12; racine.add(rotor);
  // les deux spirales, en haut
  function spirale(tours, a0) {
    const s = new THREE.Shape(), n = 120, e = r * 0.035;
    const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + t * tours * Math.PI * 2, rr = r * 0.08 + t * r * 0.72; pts.push([Math.cos(a) * rr, Math.sin(a) * rr, a]); }
    pts.forEach((q, i) => { const x = q[0] + Math.cos(q[2]) * e, y = q[1] + Math.sin(q[2]) * e; if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); });
    for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; s.lineTo(q[0] - Math.cos(q[2]) * e, q[1] - Math.sin(q[2]) * e); }
    const g = new THREE.ExtrudeGeometry(s, { depth: h * 0.16, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
  }
  const fixe = maille(spirale(2.2, 0), matiere('alu')); fixe.position.y = h * 0.14; racine.add(fixe);
  const orbite = maille(spirale(2.2, Math.PI), matiere('laiton')); orbite.position.y = h * 0.14; racine.add(orbite);
  const ex = r * 0.06;
  return {
    racine, coque: [coque], ancre: [0, h * 0.2, 0],
    tourner(a) { orbite.position.x = Math.cos(a) * ex; orbite.position.z = Math.sin(a) * ex; rotor.rotation.y = a; }
  };
}
// détendeur (vanne de détente) : un corps en laiton, un pointeau, un étranglement qui s'illumine quand le fluide passe
function detendeur(p) {
  const t = num(p.taille, 0.12), axe = axeDe(p, 'y');
  const racine = new THREE.Group(), q = new THREE.Group(); racine.add(q);
  const corps = maille(new THREE.CylinderGeometry(t * 0.38, t * 0.38, t, 28), mat(p, 'laiton')); q.add(corps);
  const tete = maille(new THREE.CylinderGeometry(t * 0.5, t * 0.5, t * 0.32, 28), matiere('laiton')); tete.rotation.z = Math.PI / 2; tete.position.x = t * 0.42; q.add(tete);
  const bulbe = maille(new THREE.CapsuleGeometry(t * 0.08, t * 0.5, 4, 12), matiere('cuivre')); bulbe.position.set(t * 0.9, -t * 0.4, 0); q.add(bulbe);
  const gorge = new THREE.Mesh(new THREE.CylinderGeometry(t * 0.06, t * 0.18, t * 0.7, 16), lueur('glace', 2.4)); q.add(gorge);
  if (axe === 'x') q.rotation.z = -Math.PI / 2; else if (axe === 'z') q.rotation.x = Math.PI / 2;
  return { racine, coque: [corps, tete], flux(phase, k) { gorge.visible = k > 0.02; gorge.scale.setScalar(0.85 + 0.15 * Math.sin(phase * 9)); gorge.material.opacity = k; } };
}
// pompe centrifuge : une volute (coque) et une roue à aubes qui tourne
function pompe(p) {
  const R = num(p.rayon, 0.25), e = num(p.epaisseur, R * 0.5), axe = axeDe(p, 'z');
  const racine = new THREE.Group(), q = new THREE.Group(); racine.add(q);
  const volute = new THREE.Shape(); const n = 80;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = R * (1.05 + 0.32 * i / n); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) volute.moveTo(x, y); else volute.lineTo(x, y); }
  volute.lineTo(R * 1.37, -R * 0.0); volute.lineTo(R * 1.37, R * 0.9); volute.lineTo(R * 1.05, R * 0.9); volute.lineTo(R * 1.05, 0);
  const gv = new THREE.ExtrudeGeometry(volute, { depth: e, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }); gv.translate(0, 0, -e / 2);
  const coque = maille(gv, mat(p, 'peinture', '#2563eb')); q.add(coque);
  const pivot = new THREE.Group(); q.add(pivot);
  const m = matiere('laiton');
  pivot.add(maille(new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.012, 40).rotateX(Math.PI / 2).translate(0, 0, -e * 0.35), m));
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Shape(); s.moveTo(R * 0.18, 0); s.quadraticCurveTo(R * 0.6, R * 0.12, R * 0.92, R * 0.38); s.lineTo(R * 0.9, R * 0.42); s.quadraticCurveTo(R * 0.58, R * 0.17, R * 0.17, 0.02);
    const g = new THREE.ExtrudeGeometry(s, { depth: e * 0.6, bevelEnabled: false }); g.translate(0, 0, -e * 0.32);
    const a = maille(g, m); a.rotation.z = (i / 7) * Math.PI * 2; pivot.add(a);
  }
  const arbre = maille(new THREE.CylinderGeometry(R * 0.08, R * 0.08, e * 2.4, 16).rotateX(Math.PI / 2), matiere('acier')); q.add(arbre);
  if (axe === 'x') q.rotation.y = Math.PI / 2; else if (axe === 'y') q.rotation.x = -Math.PI / 2;
  return { racine, pivot, axe: 'z', axeLocal: true, coque: [coque] };
}
// la roue de coupe d'un tunnelier : un disque, des bras, des molettes qui grignotent la roche
function roue_coupe(p) {
  const R = num(p.rayon, 1), axe = axeDe(p, 'z'), nb = Math.max(8, Math.min(80, Math.round(num(p.molettes, 32))));
  const racine = new THREE.Group(), q = new THREE.Group(), pivot = new THREE.Group(); racine.add(q); q.add(pivot);
  const m = mat(p, 'peinture', '#e0b21a');
  pivot.add(maille(new THREE.CylinderGeometry(R, R * 1.02, R * 0.16, 64).rotateX(Math.PI / 2), m));
  for (let k = 0; k < 6; k++) { const b = maille(new THREE.BoxGeometry(R * 0.16, R * 1.96, R * 0.12), m); b.rotation.z = (k / 6) * Math.PI; b.position.z = R * 0.1; pivot.add(b); }
  const centre = maille(new THREE.ConeGeometry(R * 0.2, R * 0.3, 32).rotateX(Math.PI / 2), matiere('acier')); centre.position.z = R * 0.25; pivot.add(centre);
  const mol = matiere('acier_sombre'), rnd = hasard(7);
  for (let i = 0; i < nb; i++) {
    const bras = i % 6, rr = R * (0.25 + 0.72 * ((i * 0.618) % 1));
    const a = (bras / 6) * Math.PI * 2 + (rnd() - 0.5) * 0.12;
    const d = maille(new THREE.CylinderGeometry(R * 0.07, R * 0.07, R * 0.05, 24), mol);
    d.rotation.z = a; d.position.set(Math.cos(a + Math.PI / 2) * rr, Math.sin(a + Math.PI / 2) * rr, R * 0.2); pivot.add(d);
  }
  if (axe === 'x') q.rotation.y = Math.PI / 2; else if (axe === 'y') q.rotation.x = -Math.PI / 2;
  return { racine, pivot, axe: 'z', axeLocal: true };
}
// moteur électrique : un stator bobiné et un rotor qui tourne
function moteur_electrique(p) {
  const R = num(p.rayon, 0.2), L = num(p.longueur, 0.4), axe = axeDe(p, 'x');
  const racine = new THREE.Group(), q = new THREE.Group(); racine.add(q);
  const carter = maille(new THREE.CylinderGeometry(R, R, L, 48, 1, true), mat(p, 'peinture', '#1f6feb')); carter.material.side = THREE.DoubleSide; q.add(carter);
  for (let k = 0; k < 6; k++) { const b = maille(new THREE.TorusGeometry(R * 0.22, R * 0.08, 8, 20), matiere('cuivre')); const a = (k / 6) * Math.PI * 2; b.position.set(Math.cos(a) * R * 0.66, 0, Math.sin(a) * R * 0.66); b.rotation.set(0, -a, Math.PI / 2); b.scale.y = L / (R * 0.5); q.add(b); }
  const pivot = new THREE.Group(); q.add(pivot);
  pivot.add(maille(new THREE.CylinderGeometry(R * 0.4, R * 0.4, L * 0.92, 32), matiere('acier_sombre')));
  for (let k = 0; k < 8; k++) { const s = maille(new THREE.BoxGeometry(R * 0.05, L * 0.9, R * 0.12), matiere('cuivre')); const a = (k / 8) * Math.PI * 2; s.position.set(Math.cos(a) * R * 0.4, 0, Math.sin(a) * R * 0.4); s.rotation.y = -a; pivot.add(s); }
  pivot.add(maille(new THREE.CylinderGeometry(R * 0.08, R * 0.08, L * 1.6, 16), matiere('chrome')));
  if (axe === 'x') q.rotation.z = -Math.PI / 2; else if (axe === 'z') q.rotation.x = Math.PI / 2;
  return { racine, pivot, axe: 'y', axeLocal: true, coque: [carter] };
}
// turbine (réacteur d'avion, turbine à gaz, éolienne carénée) : des étages d'aubes sur un arbre, sous une coque
function turbine(p) {
  const R = num(p.rayon, 0.4), L = num(p.longueur, 1.4), et = Math.max(2, Math.min(10, Math.round(num(p.etages, 5)))), axe = axeDe(p, 'x');
  const racine = new THREE.Group(), q = new THREE.Group(); racine.add(q);
  const pivot = new THREE.Group(); q.add(pivot);
  pivot.add(maille(new THREE.CylinderGeometry(R * 0.18, R * 0.12, L, 32), matiere('acier')));
  const nez = maille(new THREE.ConeGeometry(R * 0.2, R * 0.45, 32), matiere('chrome')); nez.position.y = L / 2 + R * 0.2; pivot.add(nez);
  for (let k = 0; k < et; k++) {
    const y = L / 2 - (k + 0.5) * L / et, rr = R * (0.95 - 0.35 * k / et), nb = 14 + k * 4;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(rr * 0.78, 0.01, rr * 0.22), matiere(k < et / 2 ? 'alu' : 'acier'), nb); im.castShadow = true;
    const o = new THREE.Object3D();
    for (let i = 0; i < nb; i++) { const a = (i / nb) * Math.PI * 2; o.position.set(Math.cos(a) * (rr * 0.5 + R * 0.12), y, Math.sin(a) * (rr * 0.5 + R * 0.12)); o.rotation.set(0.5, -a, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    pivot.add(im);
  }
  const coque = maille(new THREE.CylinderGeometry(R * 1.02, R * 0.8, L, 48, 1, true), mat(p, 'verre')); q.add(coque);
  if (axe === 'x') q.rotation.z = Math.PI / 2; else if (axe === 'z') q.rotation.x = -Math.PI / 2;
  return { racine, pivot, axe: 'y', axeLocal: true, coque: [coque] };
}
// une roue (voiture, vélo, poulie)
function roue(p) {
  const R = num(p.rayon, 0.35), l = num(p.largeur, 0.2), axe = axeDe(p, 'x');
  const racine = new THREE.Group(), pivot = new THREE.Group(), q = new THREE.Group(); racine.add(q); q.add(pivot);
  const pneu = maille(new THREE.TorusGeometry(R * 0.82, R * 0.18, 16, 48), matiere('caoutchouc')); pneu.scale.z = l / (R * 0.36); pivot.add(pneu);
  const jante = maille(new THREE.CylinderGeometry(R * 0.66, R * 0.66, l * 0.8, 40).rotateX(Math.PI / 2), mat(p, 'alu')); pivot.add(jante);
  for (let k = 0; k < 5; k++) { const b = maille(new THREE.BoxGeometry(R * 0.12, R * 1.2, l * 0.2), matiere('chrome')); b.rotation.z = (k / 5) * Math.PI; b.position.z = l * 0.42; pivot.add(b); }
  if (axe === 'x') q.rotation.y = Math.PI / 2; else if (axe === 'y') q.rotation.x = -Math.PI / 2;
  return { racine, pivot, axe: 'z', axeLocal: true };
}

export const KIT = { boite, cylindre, sphere, cone, tore, capsule, groupe, tuyau, serpentin, particules, jet_eau, eau, fleche, engrenage, ventilateur, rouleau, ressort, vis, piston_bielle, compresseur, detendeur, pompe, roue_coupe, moteur_electrique, turbine, roue };
export { vecteurAxe };
