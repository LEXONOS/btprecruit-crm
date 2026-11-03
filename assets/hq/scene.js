// La Tour, la scène 3D : une tour de verre sur le front de mer, en Guadeloupe, la nuit.
// Étage = entreprise du groupe, personnage = agent, orbe = message, toit = Le Board (Louis),
// chantier = entreprise proposée qui attend sa validation. Rien n'est posé sans raison.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ── dimensions (mètres) ── */
const W = 18, D = 13, FH = 5.0, LOBBY = 8, SLAB = 0.4;
const CORE_Z = -3.8, CORE_W = 2.8, CORE_D = 2.6;
const SHORE = 26, BLOC = 26;
const PAR_ETAGE = 10;
const CHEFS = { pdg: 1, dg: 1, directeur: 1, rh: 1 };
const KIND = { rapport: '#7DD3FC', ordre: '#E8C872', proposition: '#F472B6', alerte: '#FF5A5F', decision: '#FFFFFF', evaluation: '#A3E635', evenement: '#E8C872', note: '#94A3B8' };
const SKIN = ['#F2CBA8', '#E3B08A', '#C98E66', '#A8704C', '#8C5638', '#5F3B27', '#F6D9C0', '#B98563'];
const HAIR = ['#17171B', '#2B1F17', '#47301F', '#6A4425', '#9C5530', '#D6B06C', '#3A3F4B', '#7B2F2F', '#DCD6CB'];
const BUREAUX = [-3.6, 3.6, -7.2, 7.2];
const COLS = [0, -3.5, 3.5, -7, 7];
const RANGS = [3.0, -0.4];
const MAX_ORBES = 40, TRAINE = 9;
const ACCENT = '#7DD3FC', GOLD = '#E8C872';
const UP = new THREE.Vector3(0, 1, 0), UN = new THREE.Vector3(1, 1, 1);
const LUNE = new THREE.Vector3(-0.62, 0.21, -0.76).normalize();
const QX_MECHE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.42);
const QX_ANNEAU = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const ECRAN = { working: [0.62, 0.86, 1.0], idle: [0.17, 0.26, 0.4], waiting: [1.0, 0.7, 0.36], paused: [0.012, 0.014, 0.02], error: [1.0, 0.28, 0.3], attente: [0.012, 0.014, 0.02] };

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lisse = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const num = (x) => (Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : 999);
function h32(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function alea(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function jour(h) { if (h >= 7 && h <= 17) return 1; if (h >= 19 || h <= 5) return 0; return h < 12 ? lisse((h - 5) / 2) : lisse((19 - h) / 2); }
function crepuscule(h) { return Math.max(0, 1 - Math.abs(h - 6.1) / 1.4, 1 - Math.abs(h - 17.9) / 1.4); }
function heureGP() { const n = new Date(); return ((n.getUTCHours() + 20) % 24) + n.getUTCMinutes() / 60; }

/* ── géométries ── */
function boite(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x || 0, y || 0, z || 0); return g; }
function coque(w, h, d) {
  const f = new THREE.PlaneGeometry(w, h); f.translate(0, h / 2, d / 2);
  const b = new THREE.PlaneGeometry(w, h); b.rotateY(Math.PI); b.translate(0, h / 2, -d / 2);
  const l = new THREE.PlaneGeometry(d, h); l.rotateY(-Math.PI / 2); l.translate(-w / 2, h / 2, 0);
  const r = new THREE.PlaneGeometry(d, h); r.rotateY(Math.PI / 2); r.translate(w / 2, h / 2, 0);
  return mergeGeometries([f, b, l, r]);
}
function geoBande(w, d, e) {
  e = e || 0.12;
  return mergeGeometries([boite(w + 2 * e, 0.13, e, 0, 0, d / 2 + e / 2), boite(w + 2 * e, 0.13, e, 0, 0, -d / 2 - e / 2), boite(e, 0.13, d, w / 2 + e / 2, 0, 0), boite(e, 0.13, d, -w / 2 - e / 2, 0, 0)]);
}
function geoBureau() { return mergeGeometries([boite(1.9, 0.07, 0.9, 0, 0.865, 0), boite(0.06, 0.83, 0.82, -0.9, 0.415, 0), boite(0.06, 0.83, 0.82, 0.9, 0.415, 0), boite(1.74, 0.36, 0.03, 0, 0.6, -0.39)]); }
function geoChaise() { const p = new THREE.CylinderGeometry(0.045, 0.045, 0.38, 8); p.translate(0, 0.24, 0.85); return mergeGeometries([boite(0.62, 0.1, 0.58, 0, 0.48, 0.85), boite(0.62, 0.52, 0.08, 0, 0.84, 1.22), p, boite(0.5, 0.04, 0.5, 0, 0.04, 0.85)]); }
function geoMoniteur() { return mergeGeometries([boite(0.98, 0.6, 0.05, 0, 1.33, -0.27), boite(0.08, 0.16, 0.06, 0, 0.98, -0.3), boite(0.32, 0.02, 0.2, 0, 0.91, -0.3)]); }
function geoEcran() { const g = new THREE.PlaneGeometry(0.9, 0.52); g.translate(0, 1.33, -0.242); return g; }
function geoTronc() {
  const g = new THREE.CylinderGeometry(0.16, 0.3, 7.4, 7, 6); g.translate(0, 3.7, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.pow(y / 7.4, 2) * 1.3); }
  g.computeVertexNormals(); return g;
}
function geoCouronne() {
  const parts = [];
  for (let k = 0; k < 9; k++) {
    const f = new THREE.PlaneGeometry(0.85, 4.4, 1, 6);
    f.rotateX(-Math.PI / 2); f.translate(0, 0, 2.2);
    const p = f.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setX(i, p.getX(i) * (1 - z / 5.4)); p.setY(i, -0.075 * z * z + 0.12 * z); }
    f.rotateY((k / 9) * Math.PI * 2 + (k % 2) * 0.25);
    parts.push(f);
  }
  const g = mergeGeometries(parts); g.translate(1.3, 7.3, 0); g.computeVertexNormals(); return g;
}
function geoEchafaudage(w, h, d) {
  const v = []; const L = (a, b, c, e, f, g) => v.push(a, b, c, e, f, g);
  const xs = [-w / 2, -w / 4, 0, w / 4, w / 2], zs = [-d / 2, -d / 6, d / 6, d / 2], ys = [0, h / 3, (2 * h) / 3, h];
  xs.forEach((x) => { L(x, 0, -d / 2, x, h, -d / 2); L(x, 0, d / 2, x, h, d / 2); });
  [zs[1], zs[2]].forEach((z) => { L(-w / 2, 0, z, -w / 2, h, z); L(w / 2, 0, z, w / 2, h, z); });
  ys.slice(1).forEach((y) => { L(-w / 2, y, -d / 2, w / 2, y, -d / 2); L(-w / 2, y, d / 2, w / 2, y, d / 2); L(-w / 2, y, -d / 2, -w / 2, y, d / 2); L(w / 2, y, -d / 2, w / 2, y, d / 2); });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { if ((i + j) % 2) L(xs[i], ys[j], d / 2, xs[i + 1], ys[j + 1], d / 2); else L(xs[i + 1], ys[j], d / 2, xs[i], ys[j + 1], d / 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return g;
}

/* ── textures dessinées ── */
function toile(w, h, dessin) { const c = document.createElement('canvas'); c.width = w; c.height = h; dessin(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function texHalo() { return toile(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(255,255,255,.42)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }); }
function texIcone(type) {
  return toile(128, 128, (g) => {
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (type === 'wait') { g.fillStyle = '#FFB547'; g.fill(); g.fillStyle = '#1A1205'; g.font = '800 86px Inter, system-ui, sans-serif'; g.fillText('!', 64, 68); return; }
    g.fillStyle = 'rgba(9,13,22,.9)'; g.fill(); g.lineWidth = 5; g.strokeStyle = type === 'key' ? GOLD : '#8A96AD'; g.stroke();
    if (type === 'pause') { g.fillStyle = '#C9D2E0'; g.font = '700 50px Inter, system-ui, sans-serif'; g.fillText('zz', 64, 62); return; }
    g.strokeStyle = GOLD; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.arc(45, 64, 15, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(60, 64); g.lineTo(99, 64); g.moveTo(86, 64); g.lineTo(86, 80); g.moveTo(99, 64); g.lineTo(99, 77); g.stroke();
  });
}
function texHelipad() {
  return toile(512, 512, (g) => {
    g.fillStyle = '#151a23'; g.beginPath(); g.arc(256, 256, 254, 0, Math.PI * 2); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();
    g.fillStyle = GOLD; g.font = '700 260px "Space Grotesk", Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 256, 272);
  });
}

/* ── shaders ── */
const CIEL_VS = 'varying vec3 vDir;\nvoid main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const CIEL_FS = `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBas; uniform vec3 uSoleil; uniform vec3 uDir; uniform float uK;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uHor, uTop, pow(clamp(h / 0.62, 0.0, 1.0), 0.7));
  c = mix(c, uBas, clamp(-h * 5.0, 0.0, 1.0));
  float s = max(dot(d, normalize(uDir)), 0.0);
  c += uSoleil * (pow(s, 1500.0) * 7.0 + pow(s, 10.0) * 0.22) * uK;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
const MER = {
  name: 'HqMer',
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 }, uFond: { value: new THREE.Color('#020a14') }, uRefl: { value: 0.8 } }]),
  vertexShader: `uniform mat4 textureMatrix;
varying vec4 vUv; varying vec3 vW;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = textureMatrix * vec4(position, 1.0);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uFond; uniform float uRefl;
varying vec4 vUv; varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 p = vW.xz; float t = uTime;
  vec2 o = vec2(sin(p.x * 0.07 + t * 0.6) + 0.6 * sin(p.y * 0.19 + t * 1.1) + 0.3 * sin((p.x + p.y) * 0.43 + t * 1.8),
                cos(p.y * 0.06 + t * 0.5) + 0.6 * sin(p.x * 0.17 - t * 0.9) + 0.3 * cos((p.x - p.y) * 0.39 + t * 2.0));
  float dist = length(cameraPosition - vW);
  vec4 uv = vUv; uv.xy += o * (0.005 + 0.009 * clamp(dist / 300.0, 0.0, 1.0)) * uv.w;
  vec3 refl = texture2DProj(tDiffuse, uv).rgb * color;
  vec3 v = normalize(cameraPosition - vW);
  float fres = 0.2 + 0.8 * pow(1.0 - clamp(v.y, 0.0, 1.0), 4.0);
  vec3 c = mix(uFond, refl, clamp(fres * uRefl + 0.2, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`
};
const ORBE_VS = `attribute vec3 acol; attribute float ataille; uniform float uEch; varying vec3 vC;
void main() { vC = acol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = ataille * uEch / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const ORBE_FS = `varying vec3 vC;
void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0; if (d > 1.0) discard; float a = pow(1.0 - d, 2.2); float c = smoothstep(0.38, 0.0, d); gl_FragColor = vec4(vC * (a + c * 1.4), 1.0); }`;
const SOL_GLSL = `
float hqGlow = 0.0;
{
  vec2 g = vHqW.xz;
  float ville = step(g.y, ${(SHORE - 17.5).toFixed(1)});
  vec2 dd = abs(fract((g - 13.0) / 26.0 + 0.5) - 0.5) * 26.0;
  float rx = 1.0 - step(3.2, dd.x);
  float rz = 1.0 - step(3.2, dd.y);
  float place = step(abs(g.x), 17.0) * step(-15.5, g.y);
  float route = max(rx, rz) * ville * (1.0 - place);
  float bd = 1.0 - step(3.6, abs(g.y - ${(SHORE - 12).toFixed(1)}));
  route = max(route, bd);
  float prom = step(${(SHORE - 8).toFixed(1)}, g.y);
  vec3 c = vec3(0.03, 0.034, 0.042);
  c = mix(c, vec3(0.062, 0.064, 0.07), place);
  c = mix(c, vec3(0.012, 0.014, 0.018), route);
  c = mix(c, vec3(0.09, 0.085, 0.078), prom);
  float tx = (1.0 - step(0.1, dd.x)) * step(0.5, fract(g.y / 4.0)) * rx * ville * (1.0 - place);
  float tz = (1.0 - step(0.1, dd.y)) * step(0.5, fract(g.x / 4.0)) * rz * ville * (1.0 - place);
  float tb = (1.0 - step(0.1, abs(g.y - ${(SHORE - 12).toFixed(1)}))) * step(0.5, fract(g.x / 4.0));
  float trait = max(max(tx, tz), tb) * (1.0 - prom);
  c = mix(c, vec3(0.22, 0.2, 0.13), trait);
  diffuseColor.rgb = c;
  hqGlow = route * 0.015 + trait * 0.06 + prom * 0.012;
}`;
const FENETRES_GLSL = `
{
  vec3 n = abs(vHqN);
  float facade = 1.0 - step(0.5, n.y);
  vec2 q = n.x > 0.5 ? vec2(vHqW.z, vHqW.y) : vec2(vHqW.x, vHqW.y);
  vec2 cell = q / vec2(1.8, 2.7);
  vec2 id = floor(cell); vec2 f = fract(cell);
  float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.3, f.y) * step(f.y, 0.8);
  float zone = step(vHqW.y, vHqInfo.x - 0.8) * step(1.6, vHqW.y);
  float m = facade * win * zone;
  float r = hqH(id + vHqInfo.y * 31.0);
  float on = step(1.0 - uLit, r);
  vec3 wc = mix(vec3(1.0, 0.72, 0.42), vec3(0.7, 0.84, 1.0), step(0.8, hqH(id * 1.31 + vHqInfo.y)));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.03, 0.045), m * 0.8);
  roughnessFactor = mix(roughnessFactor, 0.18, m);
  totalEmissiveRadiance += m * on * wc * uWin * (0.22 + 0.42 * r);
}`;

function patchMonde(sh) {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHqW;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 hqW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n hqW = instanceMatrix * hqW;\n#endif\n vHqW = (modelMatrix * hqW).xyz; }');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHqW;');
}

const LBL = 'display:flex;align-items:center;gap:7px;padding:4px 10px 4px 8px;border-radius:999px;background:rgba(5,8,15,.66);border:1px solid rgba(232,238,248,.1);color:#E8EEF8;font:500 11.5px/1.2 Inter,system-ui,sans-serif;letter-spacing:.01em;white-space:nowrap;pointer-events:auto;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 4px 18px rgba(0,0,0,.35);user-select:none';
const LBL_SITE = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 11px 7px;border-radius:10px;background:rgba(5,8,15,.72);border:1px dashed rgba(232,238,248,.25);color:#E8EEF8;font:600 12px/1.2 "Space Grotesk",Inter,system-ui,sans-serif;white-space:nowrap;pointer-events:auto;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);user-select:none';

export function createWorld(container, opts) {
  opts = opts || {};
  const onPick = typeof opts.onPick === 'function' ? opts.onPick : null;
  const onHover = typeof opts.onHover === 'function' ? opts.onHover : null;
  const petit = Math.min(window.innerWidth, window.innerHeight) < 700;
  let qualite = petit || (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high';

  /* ── rendu ── */
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = qualite === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none;-webkit-tap-highlight-color:transparent';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(cv);
  const css = new CSS2DRenderer();
  css.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  container.appendChild(css.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#081022', 170, 760);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2600);
  const controls = new OrbitControls(camera, cv);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.075, minDistance: 7, maxDistance: 340, maxPolarAngle: Math.PI * 0.49, minPolarAngle: 0.1, autoRotateSpeed: 0.3, rotateSpeed: 0.55, zoomSpeed: 0.9, panSpeed: 0.7, screenSpacePanning: true });

  const U = { time: { value: 0 }, win: { value: 1 }, lit: { value: 0.34 }, interieur: { value: new THREE.Color(1, 0.86, 0.7) }, echelle: { value: 600 } };
  function interieur(m) {
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uHqInt = U.interieur;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHqInt;')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n{ float hqUp = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));\n reflectedLight.indirectDiffuse += uHqInt * (0.62 + 0.38 * hqUp) * material.diffuseColor; }');
    };
    m.customProgramCacheKey = function () { return 'hq-interieur'; };
    return m;
  }
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const verre = (c) => std({ color: new THREE.Color(c), transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.92, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
  const tex = { halo: texHalo(), heli: texHelipad(), wait: texIcone('wait'), pause: texIcone('pause'), key: texIcone('key') };
  const M = {
    murs: std({ color: '#0b0f17', roughness: 0.55, metalness: 0.35 }),
    plafond: std({ color: '#2a2622', roughness: 0.9, emissive: new THREE.Color('#ffe2bd'), emissiveIntensity: 0.05 }),
    sol: interieur(std({ color: '#3b3833', roughness: 0.82 })),
    toit: std({ color: '#161b23', roughness: 0.75, metalness: 0.2 }),
    bureau: interieur(std({ color: '#d9d3c9', roughness: 0.5 })),
    chaise: interieur(std({ color: '#262b34', roughness: 0.65 })),
    moniteur: std({ color: '#0c0f15', roughness: 0.35, metalness: 0.6 }),
    ecran: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    ecranLouis: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe6b0').multiplyScalar(1.4) }),
    corps: interieur(std({ color: '#ffffff', roughness: 0.5 })),
    peau: interieur(std({ color: '#ffffff', roughness: 0.6 })),
    cheveux: interieur(std({ color: '#ffffff', roughness: 0.85 })),
    corpsLouis: interieur(std({ color: GOLD, roughness: 0.35, metalness: 0.25, emissive: new THREE.Color(GOLD), emissiveIntensity: 0.12 })),
    peauLouis: interieur(std({ color: '#C08A62', roughness: 0.6 })),
    cheveuxLouis: interieur(std({ color: '#17171B', roughness: 0.85 })),
    fantome: std({ color: '#a9c4ea', transparent: true, opacity: 0.26, depthWrite: false, roughness: 0.3, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0.25 }),
    anneau: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    montant: std({ color: '#0a0d13', roughness: 0.4, metalness: 0.85 }),
    cloison: std({ color: '#d6e9ff', transparent: true, opacity: 0.1, roughness: 0.08, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    cadre: std({ color: '#1c222c', roughness: 0.45, metalness: 0.6 }),
    noyau: std({ color: '#0d1626', transparent: true, opacity: 0.42, roughness: 0.15, metalness: 0.7, depthWrite: false }),
    noyauLum: new THREE.MeshBasicMaterial({ color: ACCENT }),
    panneau: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe6c4').multiplyScalar(1.0) }),
    verreHall: verre('#9fc2e8'),
    verreBoard: verre('#f3e2b8'),
    bandeToit: new THREE.MeshBasicMaterial({ color: '#FFEFC7' }),
    invisible: new THREE.MeshBasicMaterial({ visible: false }),
    lampe: new THREE.MeshBasicMaterial({ color: '#ffcf8f' }),
    poteau: std({ color: '#1b2029', roughness: 0.5, metalness: 0.6 }),
    tronc: std({ color: '#4d3f33', roughness: 0.9, flatShading: true }),
    palme: std({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide, flatShading: true }),
    quai: std({ color: '#2b2f37', roughness: 0.9 }),
    grue: std({ color: '#d5dbe3', roughness: 0.45, metalness: 0.3, emissive: new THREE.Color('#9fb0c8'), emissiveIntensity: 0.2 }),
    morne: std({ color: '#0d1a1c', roughness: 1, flatShading: true }),
    chantierSol: std({ color: '#0e131b', roughness: 0.95 }),
    heli: std({ map: tex.heli, roughness: 0.7, emissive: new THREE.Color('#ffffff'), emissiveMap: tex.heli, emissiveIntensity: 0.25 }),
    heliLum: new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(2) }),
    sp: {}
  };
  ['wait', 'pause', 'key'].forEach((k) => { M.sp[k] = new THREE.SpriteMaterial({ map: tex[k], depthWrite: false }); });
  const G = {
    boite: new THREE.BoxGeometry(1, 1, 1), plan: new THREE.PlaneGeometry(1, 1),
    dalle: new THREE.BoxGeometry(W, SLAB, D), bande: geoBande(W, D),
    bureau: geoBureau(), chaise: geoChaise(), moniteur: geoMoniteur(), ecran: geoEcran(),
    corps: new THREE.CapsuleGeometry(0.33, 0.48, 6, 16), tete: new THREE.SphereGeometry(0.26, 22, 16),
    meche: new THREE.SphereGeometry(0.278, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    anneau: new THREE.TorusGeometry(0.36, 0.035, 8, 48, Math.PI * 1.45),
    panneau: new THREE.BoxGeometry(2.3, 0.05, 0.5), volEtage: new THREE.BoxGeometry(W + 0.8, FH, D + 0.8),
    coqueEtage: coque(W, FH - SLAB, D), coqueHall: coque(W, LOBBY - SLAB, D)
  };
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color(), _v = new THREE.Vector3(), _sph = new THREE.Spherical();

  /* ── post-traitement ── */
  let composer = null, bloom = null;
  function construireComposer() {
    if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); bloom.dispose(); }
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: qualite === 'high' ? 4 : 0 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.8);
    const k = qualite === 'high' ? 1 : 0.5;
    const orig = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => orig(Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k)));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  construireComposer();

  /* ── ciel ── */
  const ciel = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBas: { value: new THREE.Color() }, uSoleil: { value: new THREE.Color('#fff1d6') }, uDir: { value: new THREE.Vector3(0, 1, 0) }, uK: { value: 0 } };
  const matCiel = new THREE.ShaderMaterial({ uniforms: ciel, vertexShader: CIEL_VS, fragmentShader: CIEL_FS, side: THREE.BackSide, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 40, 20), matCiel); dome.renderOrder = -10; scene.add(dome);
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), matCiel));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, hEnv = -99;
  const etoiles = (function () {
    const R = alea(11), n = 1800, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = R() * Math.PI * 2, y = 0.06 + Math.pow(R(), 0.8) * 0.94, r = Math.sqrt(1 - y * y), b = 0.35 + Math.pow(R(), 3) * 1.4;
      p.set([Math.cos(th) * r * 1100, y * 1100, Math.sin(th) * r * 1100], i * 3); c.set([b, b, b * 1.06], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const o = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    o.renderOrder = -9; scene.add(o); return o;
  })();
  const lune = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6e0').multiplyScalar(1.8), fog: false, transparent: true }));
  lune.position.copy(LUNE).multiplyScalar(1050); lune.lookAt(0, 0, 0); lune.renderOrder = -8; scene.add(lune);
  const luneHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.halo, color: '#9db4ff', transparent: true, opacity: 0.3, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  luneHalo.position.copy(lune.position); luneHalo.scale.set(170, 170, 1); luneHalo.renderOrder = -8; scene.add(luneHalo);

  /* ── lumières ── */
  const hemi = new THREE.HemisphereLight('#2a3d66', '#05070c', 0.55); scene.add(hemi);
  const cle = new THREE.DirectionalLight('#a9c2ff', 0.45);
  cle.castShadow = true; cle.shadow.mapSize.set(2048, 2048);
  Object.assign(cle.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 20, far: 520 });
  cle.shadow.bias = -0.0004; cle.shadow.normalBias = 0.05;
  cle.target.position.set(0, 12, 0); scene.add(cle, cle.target);

  /* ── sol, ville, mer, promenade, mornes ── */
  const matSol = std({ color: '#ffffff', roughness: 0.94, metalness: 0 });
  matSol.onBeforeCompile = (sh) => {
    sh.uniforms.uWin = U.win; patchMonde(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWin;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + SOL_GLSL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.7, 0.42) * hqGlow * uWin;');
  };
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1400), matSol);
  sol.rotation.x = -Math.PI / 2; sol.position.set(0, 0, SHORE - 700); sol.receiveShadow = true; sol.userData.bloque = true; scene.add(sol);

  const matVille = std({ color: '#ffffff', roughness: 0.8, metalness: 0.1 });
  matVille.onBeforeCompile = (sh) => {
    sh.uniforms.uWin = U.win; sh.uniforms.uLit = U.lit;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aInfo;\nvarying vec2 vHqInfo;\nvarying vec3 vHqN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHqInfo = aInfo;\nvHqN = normal;');
    patchMonde(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWin;\nuniform float uLit;\nvarying vec2 vHqInfo;\nvarying vec3 vHqN;\nfloat hqH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FENETRES_GLSL);
  };
  let ville = null;
  function construireVille(reserve) {
    if (ville) { scene.remove(ville); ville.geometry.dispose(); ville.dispose(); }
    const lots = [];
    for (let i = -11; i <= 11; i++) for (let j = -13; j <= 0; j++) {
      if (j === 0 && (i === 0 || reserve.has(i))) continue;
      const R = alea(h32(i + ':' + j)), cx = i * BLOC, cz = j * BLOC;
      const loin = Math.hypot(cx, cz * 1.2), hm = loin < 60 ? 12 : loin < 140 ? 15 : 18;
      const t = R();
      const lst = t < 0.3 ? [[0, 0, 17, 17]] : t < 0.7 ? [[-4.6, 0, 8, 16], [4.6, 0, 8, 16]] : [[-4.6, -4.6, 8, 8], [4.6, -4.6, 8, 8], [-4.6, 4.6, 8, 8], [4.6, 4.6, 8, 8]];
      lst.forEach((l) => { if (R() < 0.08) return; lots.push({ x: cx + l[0], z: cz + l[1], w: l[2] * (0.82 + R() * 0.16), d: l[3] * (0.82 + R() * 0.16), h: 3.2 + Math.pow(R(), 1.6) * hm, c: R(), s: R() }); });
    }
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const info = new Float32Array(lots.length * 2);
    lots.forEach((l, k) => { info[k * 2] = l.h; info[k * 2 + 1] = l.s; });
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 2));
    ville = new THREE.InstancedMesh(geo, matVille, lots.length);
    const PAL = ['#1b2230', '#222a37', '#1e2430', '#2a303b', '#262c35', '#1a1f28', '#30343c'];
    lots.forEach((l, k) => { _m.makeScale(l.w, l.h, l.d).setPosition(l.x, 0, l.z); ville.setMatrixAt(k, _m); ville.setColorAt(k, _c.set(PAL[Math.floor(l.c * PAL.length)])); });
    ville.castShadow = true; ville.receiveShadow = true; ville.computeBoundingSphere(); ville.userData.bloque = true;
    scene.add(ville);
  }

  let mer = null;
  const matMer = std({ color: '#04101c', roughness: 0.38, metalness: 0.15 });
  matMer.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; patchMonde(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec2 p = vHqW.xz; float t = uTime;\n vec3 nW = normalize(vec3(sin(p.x * 0.11 + t * 0.9) * 0.035 + sin((p.x + p.y) * 0.43 + t * 1.7) * 0.025, 1.0, cos(p.y * 0.13 + t * 0.8) * 0.035 + sin((p.x - p.y) * 0.37 + t * 2.0) * 0.025));\n normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); }');
  };
  function construireMer() {
    if (mer) { scene.remove(mer); mer.geometry.dispose(); if (mer.isReflector) mer.dispose(); }
    const geo = new THREE.PlaneGeometry(2400, 1400);
    if (qualite === 'high') {
      const b = renderer.getDrawingBufferSize(new THREE.Vector2());
      mer = new Reflector(geo, { clipBias: 0.003, textureWidth: Math.max(256, Math.round(b.x * 0.5)), textureHeight: Math.max(256, Math.round(b.y * 0.5)), color: 0xb4bcc8, shader: MER, multisample: 0 });
      mer.material.fog = true;
    } else mer = new THREE.Mesh(geo, matMer);
    mer.rotation.x = -Math.PI / 2; mer.position.set(0, -0.35, SHORE + 698);
    scene.add(mer);
    if (heureCourante > -1) appliquerHeure(heureCourante, true);
  }

  (function promenade() {
    const R = alea(99), pos = [];
    for (let x = -190; x <= 190; x += 9.5) { if (Math.abs(x) < 7) continue; pos.push([x + (R() - 0.5) * 3, SHORE - 3.6 - R() * 1.6]); }
    const tr = new THREE.InstancedMesh(geoTronc(), M.tronc, pos.length), cr = new THREE.InstancedMesh(geoCouronne(), M.palme, pos.length);
    pos.forEach((xz, k) => { _q.setFromAxisAngle(UP, R() * Math.PI * 2); _s.setScalar(0.8 + R() * 0.45); _p.set(xz[0], 0, xz[1]); _m.compose(_p, _q, _s); tr.setMatrixAt(k, _m); cr.setMatrixAt(k, _m); cr.setColorAt(k, _c.setRGB(0.018 + R() * 0.012, 0.055 + R() * 0.03, 0.034)); });
    tr.castShadow = cr.castShadow = true; scene.add(tr, cr);
    const lp = []; for (let x = -200; x <= 200; x += 12) { if (Math.abs(x) < 5) continue; lp.push(x); }
    const pg = new THREE.CylinderGeometry(0.06, 0.09, 4.4, 6); pg.translate(0, 2.2, 0);
    const poles = new THREE.InstancedMesh(pg, M.poteau, lp.length), tetes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 8), M.lampe, lp.length);
    lp.forEach((x, k) => { _m.makeTranslation(x, 0, SHORE - 1.1); poles.setMatrixAt(k, _m); _m.makeTranslation(x, 4.45, SHORE - 1.1); tetes.setMatrixAt(k, _m); });
    scene.add(poles, tetes);
    const quai = new THREE.Mesh(new THREE.BoxGeometry(2400, 1.7, 1.2), M.quai); quai.position.set(0, -0.65, SHORE + 0.3); quai.receiveShadow = true; scene.add(quai);
    const cg = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    const mornes = new THREE.InstancedMesh(cg, M.morne, 11);
    for (let k = 0; k < 11; k++) { _q.setFromAxisAngle(UP, R() * 6); _p.set(-760 + k * 150 + (R() - 0.5) * 70, -4, -540 - R() * 160); const r = 120 + R() * 110; _s.set(r, (k === 4 ? 150 : 55 + R() * 70), r * (0.7 + R() * 0.4)); _m.compose(_p, _q, _s); mornes.setMatrixAt(k, _m); }
    scene.add(mornes);
  })();

  /* ── orbes (messages) ── */
  const NP = MAX_ORBES * TRAINE;
  const oPos = new Float32Array(NP * 3), oCol = new Float32Array(NP * 3), oTai = new Float32Array(NP);
  for (let i = 0; i < NP; i++) oPos[i * 3 + 1] = -500;
  const oGeo = new THREE.BufferGeometry();
  oGeo.setAttribute('position', new THREE.BufferAttribute(oPos, 3).setUsage(THREE.DynamicDrawUsage));
  oGeo.setAttribute('acol', new THREE.BufferAttribute(oCol, 3).setUsage(THREE.DynamicDrawUsage));
  oGeo.setAttribute('ataille', new THREE.BufferAttribute(oTai, 1).setUsage(THREE.DynamicDrawUsage));
  const oPts = new THREE.Points(oGeo, new THREE.ShaderMaterial({ uniforms: { uEch: U.echelle }, vertexShader: ORBE_VS, fragmentShader: ORBE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  oPts.frustumCulled = false; oPts.renderOrder = 5; scene.add(oPts);
  const orbes = [];
  let lueurNoyau = 0, flashBalise = 0;

  /* ── état ── */
  let T = null; // la tour construite
  const S = { sites: [], groupe: new THREE.Group(), jet: [], reserve: new Set() };
  scene.add(S.groupe);
  let sigTour = null, sigSites = null, enAttente = 0, heureCourante = -1, NEON = 2.4, nomGroupe = '';
  let mode = 'overview', vol = null, dernierGeste = -1e9, touche = false, premier = true, heureForcee = null;

  /* ── enseigne du toit ── */
  const ens = { c: document.createElement('canvas') };
  ens.c.width = 2048; ens.c.height = 320;
  ens.tex = new THREE.CanvasTexture(ens.c); ens.tex.colorSpace = THREE.SRGBColorSpace; ens.tex.anisotropy = 8;
  M.enseigne = new THREE.MeshBasicMaterial({ map: ens.tex, transparent: true, depthWrite: false, color: new THREE.Color(1.15, 1.06, 0.92) });
  function dessinerEnseigne(nom) {
    nomGroupe = nom;
    const g = ens.c.getContext('2d'), w = ens.c.width, h = ens.c.height;
    g.clearRect(0, 0, w, h);
    const txt = String(nom || 'LEXONOS').toUpperCase().slice(0, 22).split('');
    let size = 210, sp = 0, larg = 0;
    const mesure = () => { g.font = '700 ' + size + 'px "Space Grotesk", Inter, system-ui, sans-serif'; sp = size * 0.16; larg = txt.reduce((s, ch) => s + g.measureText(ch).width, 0) + sp * (txt.length - 1); };
    mesure(); while (larg > w * 0.9 && size > 60) { size -= 8; mesure(); }
    g.textBaseline = 'middle';
    const dessine = () => { let x = (w - larg) / 2; txt.forEach((ch) => { g.fillText(ch, x, h / 2 + size * 0.04); x += g.measureText(ch).width + sp; }); };
    g.shadowColor = 'rgba(232,200,114,0.9)'; g.shadowBlur = 16; g.fillStyle = '#FFE3A3'; dessine();
    g.shadowBlur = 0; g.fillStyle = '#FFF8EA'; dessine();
    ens.tex.needsUpdate = true;
  }
  dessinerEnseigne('LEXONOS');
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('700 120px "Space Grotesk"'), document.fonts.load('600 40px Inter')]).then(() => { dessinerEnseigne(nomGroupe || 'LEXONOS'); tex.heli.image = texHelipad().image; tex.heli.needsUpdate = true; }).catch(() => {});

  function etiquette(style, enfants, cible) {
    const el = document.createElement('div'); el.style.cssText = style;
    enfants.forEach((x) => el.appendChild(x));
    el.addEventListener('click', (e) => { e.stopPropagation(); if (onPick) onPick(cible); });
    el.addEventListener('pointerenter', (e) => { if (onHover) onHover(cible, { x: e.clientX, y: e.clientY }); });
    el.addEventListener('pointerleave', () => { if (onHover) onHover(null, { x: 0, y: 0 }); });
    return new CSS2DObject(el);
  }
  function span(txt, style) { const s = document.createElement('span'); s.textContent = txt; if (style) s.style.cssText = style; return s; }

  /* ── la tour ── */
  function detruireTour() {
    if (!T) return;
    T.labels.forEach((l) => { if (l.element) l.element.remove(); });
    scene.remove(T.group);
    T.jet.forEach((x) => { if (x && x.dispose) x.dispose(); });
    T = null;
  }
  function construireTour(actives, agents) {
    detruireTour();
    const grp = new THREE.Group();
    const t = { group: grp, jet: [], labels: [], etages: [], parCo: new Map(), agents: [], byId: new Map(), pick1: [], pick2: [], inst: {}, roofY: 0, top: 0, survolAgent: null, survolCo: null, survolToit: false, sales: true };
    const jet = (x) => { t.jet.push(x); return x; };
    const ajoute = (o, cible, pick) => { grp.add(o); if (cible) o.userData.cible = cible; if (pick === 1) t.pick1.push(o); if (pick === 2) t.pick2.push(o); return o; };
    const parCo = new Map();
    agents.forEach((a) => { if (!parCo.has(a.company_id)) parCo.set(a.company_id, []); parCo.get(a.company_id).push(a); });
    parCo.forEach((l) => l.sort((x, y) => (num(x.seat) - num(y.seat)) || String(x.id).localeCompare(String(y.id))));
    let f = 0;
    actives.forEach((c) => {
      const ags = parCo.get(c.id) || [];
      const n = Math.max(1, Math.min(6, Number(c.floors) || 1), Math.ceil(ags.length / PAR_ETAGE));
      const col = new THREE.Color(c.color || ACCENT);
      const info = { c, col, floors: [], mats: {
        bande: jet(new THREE.MeshBasicMaterial({ color: col.clone() })),
        sol: jet(interieur(std({ color: new THREE.Color('#3a3733').lerp(col, 0.14), roughness: 0.85 }))),
        verre: jet(verre(new THREE.Color('#a9c7ea').lerp(col, 0.25)))
      } };
      t.parCo.set(c.id, info);
      for (let k = 0; k < n; k++) { const e = { c, info, k, y: LOBBY + f * FH, idx: f, ags: [] }; t.etages.push(e); info.floors.push(e); f++; }
      ags.forEach((a, r) => info.floors[Math.min(Math.floor(r / PAR_ETAGE), n - 1)].ags.push(a));
    });
    const roofY = LOBBY + f * FH; t.roofY = roofY;
    const cibleToit = { type: 'roof' };

    // étages : dalle, bande néon, vitrage, volume de sélection
    t.etages.forEach((e) => {
      const m = e.info.mats, cible = { type: 'company', id: e.c.id };
      const dalle = ajoute(new THREE.Mesh(G.dalle, [M.murs, M.murs, m.sol, M.plafond, M.murs, M.murs]), cible, 1);
      dalle.position.set(0, e.y - SLAB / 2, 0); dalle.castShadow = dalle.receiveShadow = true;
      ajoute(new THREE.Mesh(G.bande, m.bande)).position.set(0, e.y - SLAB / 2, 0);
      const v = ajoute(new THREE.Mesh(G.coqueEtage, m.verre)); v.position.set(0, e.y, 0); v.renderOrder = 2;
      ajoute(new THREE.Mesh(G.volEtage, M.invisible), cible, 2).position.set(0, e.y + FH / 2 - SLAB / 2, 0);
    });
    // hall d'accueil (point de départ des messages du système)
    const hall = ajoute(new THREE.Mesh(G.dalle, [M.murs, M.murs, M.sol, M.murs, M.murs, M.murs]));
    hall.position.set(0, -SLAB / 2 + 0.05, 0); hall.receiveShadow = true;
    const vh = ajoute(new THREE.Mesh(G.coqueHall, M.verreHall)); vh.position.y = 0.05; vh.renderOrder = 2;
    ajoute(new THREE.Mesh(jet(boite(5.2, 1.05, 1.1, 0, 0.58, 2.0)), M.cadre));
    ajoute(new THREE.Mesh(jet(boite(5.2, 0.06, 0.04, 0, 0.98, 2.57)), M.noyauLum));
    const auvent = ajoute(new THREE.Mesh(jet(boite(8, 0.3, 3.4, 0, 4.6, D / 2 + 1.7)), M.murs)); auvent.castShadow = true;
    ajoute(new THREE.Mesh(jet(boite(7.4, 0.05, 0.08, 0, 4.44, D / 2 + 3.3)), M.noyauLum));
    // toit
    const toit = ajoute(new THREE.Mesh(G.dalle, [M.murs, M.murs, M.toit, M.plafond, M.murs, M.murs]), cibleToit, 1);
    toit.position.set(0, roofY - SLAB / 2, 0); toit.castShadow = toit.receiveShadow = true;
    ajoute(new THREE.Mesh(G.bande, M.bandeToit)).position.set(0, roofY - SLAB / 2, 0);
    ajoute(new THREE.Mesh(jet(mergeGeometries([boite(W, 0.8, 0.22, 0, 0.4, D / 2 - 0.11), boite(W, 0.8, 0.22, 0, 0.4, -D / 2 + 0.11), boite(0.22, 0.8, D, W / 2 - 0.11, 0.4, 0), boite(0.22, 0.8, D, -W / 2 + 0.11, 0.4, 0)])), M.murs), cibleToit, 1).position.y = roofY;
    // noyau : la cage d'ascenseur que traversent les messages entre étages
    const hc = roofY;
    ajoute(new THREE.Mesh(jet(new THREE.BoxGeometry(CORE_W, hc, CORE_D)), M.noyau), null, 1).position.set(0, hc / 2, CORE_Z);
    t.pick1[t.pick1.length - 1].userData.etage = true;
    const aretes = [];
    [[-1, 1], [1, 1]].forEach((s) => aretes.push(boite(0.05, hc, 0.05, (s[0] * CORE_W) / 2, hc / 2, CORE_Z + (s[1] * CORE_D) / 2)));
    aretes.push(boite(0.12, hc, 0.12, 0, hc / 2, CORE_Z));
    ajoute(new THREE.Mesh(jet(mergeGeometries(aretes)), M.noyauLum));
    // montants de façade
    const mt = [];
    for (let i = 0; i <= 8; i++) { const x = -W / 2 + (i * W) / 8; mt.push([x, D / 2], [x, -D / 2]); }
    for (let j = 1; j <= 5; j++) { const z = -D / 2 + (j * D) / 6; mt.push([W / 2, z], [-W / 2, z]); }
    const montants = ajoute(jet(new THREE.InstancedMesh(G.boite, M.montant, mt.length)));
    mt.forEach((xz, i) => { _m.makeScale(0.11, roofY, 0.11).setPosition(xz[0], roofY / 2, xz[1]); montants.setMatrixAt(i, _m); });
    // plafonniers et bureaux vitrés des chefs
    const pl = [], cl = [], cad = [];
    [-6, 0, 6].forEach((x) => [0.8, 4.2].forEach((z) => pl.push([x, LOBBY - SLAB - 0.03, z])));
    t.etages.forEach((e) => {
      const yc = e.y + FH - SLAB - 0.03;
      [-7, -3.5, 3.5, 7].forEach((x) => [0.6, 4.1].forEach((z) => pl.push([x, yc, z])));
      [-5.4, 5.4].forEach((x) => pl.push([x, yc, -4.3]));
      const chefs = e.ags.filter((a) => CHEFS[a.tier]).slice(0, 4);
      e.chefs = chefs;
      chefs.forEach((a, k) => {
        const xc = BUREAUX[k], x0 = xc - 1.8, x1 = xc + 1.8, zf = -2.2, zb = -D / 2 + 0.1, hh = 2.7;
        const fa = xc > 0 ? x0 + 0.95 : x0, fb = xc > 0 ? x1 : x1 - 0.95;
        cl.push([(fa + fb) / 2, e.y + hh / 2, zf, fb - fa, hh, 0.04]); cad.push([(x0 + x1) / 2, e.y + hh + 0.04, zf, x1 - x0, 0.08, 0.08]);
        [x0, x1].forEach((xx) => { cl.push([xx, e.y + hh / 2, (zf + zb) / 2, 0.04, hh, zf - zb]); cad.push([xx, e.y + hh + 0.04, (zf + zb) / 2, 0.08, 0.08, zf - zb]); });
      });
    });
    const plafonniers = ajoute(jet(new THREE.InstancedMesh(G.panneau, M.panneau, pl.length)));
    pl.forEach((p, i) => { _m.makeTranslation(p[0], p[1], p[2]); plafonniers.setMatrixAt(i, _m); });
    [[cl, M.cloison], [cad, M.cadre]].forEach((x) => {
      const arr = x[0]; if (!arr.length) return;
      const im = ajoute(jet(new THREE.InstancedMesh(G.boite, x[1], arr.length)));
      arr.forEach((b, i) => { _m.makeScale(b[3], b[4], b[5]).setPosition(b[0], b[1], b[2]); im.setMatrixAt(i, _m); });
      if (x[1] === M.cloison) im.renderOrder = 3;
    });

    // agents : bureau, chaise, écran, personnage
    const tous = [];
    const placer = (a, e, x, z, rot, chef) => {
      const q = new THREE.Quaternion().setFromAxisAngle(UP, rot);
      const seat = new THREE.Vector3(x, e.y, z).add(new THREE.Vector3(0, 0, 0.85).applyQuaternion(q));
      const R = alea(h32(a.id));
      const r = { id: a.id, a, e, co: e.c.id, rot, q, chef, seat, desk: new THREE.Matrix4().compose(new THREE.Vector3(x, e.y, z), q, UN), fwd: new THREE.Vector3(0, 0, -1).applyQuaternion(q),
        head: seat.clone().add(new THREE.Vector3(0, 1.89, 0)), floorY: e.y, ph: R() * 6.283, skin: SKIN[Math.floor(R() * SKIN.length)], hair: HAIR[Math.floor(R() * HAIR.length)],
        status: a.status || 'idle', ghost: a.status === 'attente', pop: 0, icone: null, i: 0, ci: 0, cCorps: new THREE.Color(e.c.color || ACCENT).lerp(new THREE.Color('#ffffff'), 0.1) };
      tous.push(r);
    };
    t.etages.forEach((e) => {
      e.chefs.forEach((a, k) => placer(a, e, BUREAUX[k], -4.3, Math.PI, true));
      e.ags.filter((a) => e.chefs.indexOf(a) < 0).forEach((a, k) => placer(a, e, COLS[k % 5], RANGS[Math.floor(k / 5) % 2], 0, false));
    });
    tous.forEach((r, i) => { r.i = i; t.byId.set(r.id, r); });
    const solides = tous.filter((r) => !r.ghost), fantomes = tous.filter((r) => r.ghost);
    solides.forEach((r, i) => { r.ci = i; }); fantomes.forEach((r, i) => { r.ci = i; });
    t.agents = tous;
    const mk = (geo, mat, liste, choisissable) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, liste.length)); im.count = liste.length;
      im.userData.agents = liste.map((r) => r.id); im.frustumCulled = false;
      grp.add(im); t.jet.push(im); if (liste.length && choisissable !== false) t.pick1.push(im); return im;
    };
    const I = t.inst;
    I.bureau = mk(G.bureau, M.bureau, tous); I.chaise = mk(G.chaise, M.chaise, tous); I.moniteur = mk(G.moniteur, M.moniteur, tous); I.ecran = mk(G.ecran, M.ecran, tous);
    I.anneau = mk(G.anneau, M.anneau, tous, false); I.anneau.userData.agents = null;
    I.corps = mk(G.corps, M.corps, solides); I.tete = mk(G.tete, M.peau, solides); I.meche = mk(G.meche, M.cheveux, solides);
    I.fCorps = mk(G.corps, M.fantome, fantomes); I.fTete = mk(G.tete, M.fantome, fantomes); I.fMeche = mk(G.meche, M.fantome, fantomes);
    [I.fCorps, I.fTete, I.fMeche].forEach((im) => { im.renderOrder = 4; });
    tous.forEach((r) => { [I.bureau, I.chaise, I.moniteur, I.ecran].forEach((im) => im.setMatrixAt(r.i, r.desk)); I.ecran.setColorAt(r.i, _c.setRGB(0.2, 0.3, 0.4)); I.anneau.setColorAt(r.i, _c.set(ACCENT)); });
    solides.forEach((r) => { I.corps.setColorAt(r.ci, r.cCorps); I.tete.setColorAt(r.ci, _c.set(r.skin)); I.meche.setColorAt(r.ci, _c.set(r.hair)); });
    t.ensemble = tous; poserAgents(t, 0);
    Object.values(I).forEach((im) => im.computeBoundingSphere());

    // Le Board : héliport, pavillon de Louis, enseigne, balise
    const helipad = ajoute(new THREE.Mesh(jet(new THREE.CircleGeometry(3.5, 48)), M.heli), cibleToit, 1);
    helipad.rotation.x = -Math.PI / 2; helipad.position.set(-4.4, roofY + 0.03, 0.9); helipad.receiveShadow = true;
    const hl = ajoute(jet(new THREE.InstancedMesh(jet(new THREE.SphereGeometry(0.09, 8, 6)), M.heliLum, 12)));
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; _m.makeTranslation(-4.4 + Math.cos(a) * 3.75, roofY + 0.1, 0.9 + Math.sin(a) * 3.75); hl.setMatrixAt(k, _m); }
    const pav = { x: 4.7, z: 0.5, w: 6.2, d: 5.0, h: 2.8 };
    const vp = ajoute(new THREE.Mesh(jet(coque(pav.w, pav.h, pav.d)), M.verreBoard)); vp.position.set(pav.x, roofY, pav.z); vp.renderOrder = 2;
    const tv = ajoute(new THREE.Mesh(jet(new THREE.PlaneGeometry(pav.w, pav.d)), M.verreBoard), cibleToit, 1); tv.rotation.x = -Math.PI / 2; tv.position.set(pav.x, roofY + pav.h, pav.z); tv.renderOrder = 2;
    ajoute(new THREE.Mesh(jet(mergeGeometries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map((c) => boite(0.12, pav.h, 0.12, pav.x + (c[0] * pav.w) / 2, roofY + pav.h / 2, pav.z + (c[1] * pav.d) / 2)))), M.cadre));
    ajoute(new THREE.Mesh(jet(geoBande(pav.w + 0.3, pav.d + 0.3, 0.08)), M.bandeToit)).position.set(pav.x, roofY + pav.h + 0.1, pav.z);
    const qL = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI), dz = pav.z + 0.6;
    [[G.bureau, M.bureau], [G.chaise, M.chaise], [G.moniteur, M.moniteur], [G.ecran, M.ecranLouis]].forEach((x) => { const o = ajoute(new THREE.Mesh(x[0], x[1]), cibleToit, 1); o.position.set(pav.x, roofY, dz); o.quaternion.copy(qL); });
    const siege = new THREE.Vector3(pav.x, roofY, dz - 0.85);
    ajoute(new THREE.Mesh(G.corps, M.corpsLouis), cibleToit, 1).position.copy(siege).add(new THREE.Vector3(0, 1.1, 0));
    ajoute(new THREE.Mesh(G.tete, M.peauLouis), cibleToit, 1).position.copy(siege).add(new THREE.Vector3(0, 1.89, 0));
    const ml = ajoute(new THREE.Mesh(G.meche, M.cheveuxLouis), cibleToit, 1); ml.position.copy(siege).add(new THREE.Vector3(0, 1.91, 0)); ml.quaternion.copy(qL).multiply(QX_MECHE);
    t.louis = siege.clone().add(new THREE.Vector3(0, 1.89, 0));
    const sw = 15, sh = (sw * 320) / 2048, sy = roofY + 4.2 + sh / 2, sz = -D / 2 + 1.1;
    const sf = ajoute(new THREE.Mesh(jet(new THREE.PlaneGeometry(sw, sh)), M.enseigne), cibleToit, 1); sf.position.set(0, sy, sz); sf.renderOrder = 3;
    const sb = ajoute(sf.clone(), cibleToit, 1); sb.rotation.y = Math.PI; sb.position.z = sz - 0.05;
    [-5.6, 5.6].forEach((x) => ajoute(new THREE.Mesh(jet(boite(0.2, sy + sh / 2 - roofY, 0.2, x, (sy + sh / 2 - roofY) / 2, sz - 0.12)), M.cadre)).position.y = roofY);
    ajoute(new THREE.Mesh(jet(boite(sw - 1, 0.1, 0.1, 0, sy - sh / 2 - 0.2, sz - 0.12)), M.cadre));
    const mz = -D / 2 + 0.5;
    ajoute(new THREE.Mesh(jet(new THREE.CylinderGeometry(0.1, 0.16, 11, 8)), M.cadre), cibleToit, 1).position.set(0, roofY + 5.5, mz);
    t.balise = ajoute(new THREE.Mesh(jet(new THREE.SphereGeometry(0.48, 20, 14)), jet(new THREE.MeshBasicMaterial({ color: GOLD }))), cibleToit, 1);
    t.balise.position.set(0, roofY + 11.2, mz);
    t.halo = ajoute(new THREE.Sprite(jet(new THREE.SpriteMaterial({ map: tex.halo, color: GOLD, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))));
    t.halo.position.copy(t.balise.position);
    ajoute(new THREE.Mesh(jet(new THREE.BoxGeometry(W + 1, 12.5, D + 1)), M.invisible), cibleToit, 2).position.set(0, roofY + 6.25, 0);
    t.top = roofY + 11.7;

    // étiquettes : une par entreprise, sur le flanc de la tour tourné vers la caméra
    t.parCo.forEach((info) => {
      const y0 = info.floors[0].y, y1 = info.floors[info.floors.length - 1].y + FH - SLAB;
      const dot = document.createElement('i'); dot.style.cssText = 'width:7px;height:7px;border-radius:50%;flex:none';
      dot.style.background = info.c.color || ACCENT; dot.style.boxShadow = '0 0 9px ' + (info.c.color || ACCENT);
      const o = etiquette(LBL, [dot, span(info.c.name || info.c.id)], { type: 'company', id: info.c.id });
      o.center.set(0, 0.5); o.userData.y = (y0 + y1) / 2; o.userData.cote = 1; grp.add(o); t.labels.push(o);
    });
    const badge = span('', 'min-width:16px;height:16px;padding:0 5px;border-radius:999px;background:' + GOLD + ';color:#1a1205;font:700 10.5px/16px Inter,system-ui,sans-serif;text-align:center');
    const lt = etiquette(LBL + ';border-color:rgba(232,200,114,.45)', [span('Le Board', 'font-weight:600'), badge], cibleToit);
    lt.center.set(1, 0.5); lt.userData.y = roofY + 1.6; lt.userData.cote = -1; grp.add(lt); t.labels.push(lt);
    t.badge = badge;

    scene.add(grp);
    T = t;
    majBandes(); majBadge(); T.sales = true;
  }
  function majBadge() { if (!T || !T.badge) return; T.badge.textContent = String(enAttente); T.badge.style.display = enAttente > 0 ? '' : 'none'; }
  function majBandes() {
    if (!T) return;
    T.parCo.forEach((info, id) => info.mats.bande.color.copy(info.col).multiplyScalar(NEON * (T.survolCo === id ? 1.9 : 1)));
    M.bandeToit.color.set('#FFEFC7').multiplyScalar(NEON * 0.45 * (T.survolToit ? 1.8 : 1));
  }

  // pose des personnages (respiration, frappe au clavier, sursaut à l'arrivée d'un message)
  function poserAgents(t, temps) {
    const I = t.inst;
    for (const r of t.agents) {
      const st = r.status;
      let bob = 0, sy = 1, av = 0;
      if (st === 'working') { bob = Math.abs(Math.sin(temps * 7.5 + r.ph)) * 0.035; av = 0.06; }
      else if (st === 'paused') av = -0.04;
      else if (st !== 'attente') sy = 1 + Math.sin(temps * 1.6 + r.ph) * 0.012;
      const hov = t.survolAgent === r.id || t.focusAgent === r.id ? 1.09 : 1;
      const pop = r.pop > 0 ? 1 + 0.3 * Math.sin((1 - r.pop) * Math.PI) : 1;
      const mc = r.ghost ? I.fCorps : I.corps, mt = r.ghost ? I.fTete : I.tete, mm = r.ghost ? I.fMeche : I.meche;
      _p.copy(r.seat).addScaledVector(r.fwd, av); _p.y += 1.1 + bob; _s.set(hov, hov * sy, hov);
      _m.compose(_p, r.q, _s); mc.setMatrixAt(r.ci, _m);
      _p.copy(r.seat).addScaledVector(r.fwd, av * 2.2); _p.y += 1.89 + bob * 1.25 + (sy - 1) * 1.2; _s.setScalar(hov * pop);
      _m.compose(_p, r.q, _s); mt.setMatrixAt(r.ci, _m);
      _p.y += 0.02; _q.copy(r.q).multiply(QX_MECHE); _m.compose(_p, _q, _s); mm.setMatrixAt(r.ci, _m);
      if (st === 'working' || st === 'error') {
        _q.setFromAxisAngle(UP, st === 'working' ? temps * 2.6 + r.ph : 0).multiply(QX_ANNEAU);
        _p.copy(r.head); _p.y += 0.58 + bob; _s.setScalar(st === 'error' ? 1 + 0.1 * Math.sin(temps * 7) : 1);
      } else { _p.copy(r.head); _s.setScalar(0); _q.identity(); }
      _m.compose(_p, _q, _s); I.anneau.setMatrixAt(r.i, _m);
      const e = ECRAN[st] || ECRAN.idle;
      const k = st === 'working' ? 1.45 + 0.3 * Math.sin(temps * 9 + r.ph) + (Math.sin(temps * 23 + r.ph * 3) > 0.93 ? 0.45 : 0) : st === 'waiting' ? 0.85 + 0.3 * Math.sin(temps * 2 + r.ph) : st === 'error' ? (Math.sin(temps * 6) > 0 ? 1.1 : 0.5) : 1;
      I.ecran.setColorAt(r.i, _c.setRGB(e[0] * k, e[1] * k, e[2] * k));
      if (r.icone) r.icone.position.set(r.head.x, r.head.y + 0.74 + Math.sin(temps * 2 + r.ph) * 0.05, r.head.z);
    }
    [I.corps, I.tete, I.meche, I.fCorps, I.fTete, I.fMeche, I.anneau].forEach((im) => { im.instanceMatrix.needsUpdate = true; });
    if (I.ecran.instanceColor) I.ecran.instanceColor.needsUpdate = true;
  }
  function recolorer() {
    if (!T) return;
    const I = T.inst;
    for (const r of T.agents) {
      I.anneau.setColorAt(r.i, r.status === 'error' ? _c.set('#FF5A5F').multiplyScalar(2.2) : _c.set(ACCENT).multiplyScalar(2.4));
      const veut = r.status === 'waiting' ? 'wait' : r.status === 'paused' ? 'pause' : r.status === 'attente' ? 'key' : null;
      if (veut) {
        if (!r.icone) { r.icone = new THREE.Sprite(M.sp[veut]); r.icone.scale.setScalar(0.62); r.icone.renderOrder = 6; T.group.add(r.icone); }
        r.icone.material = M.sp[veut]; r.icone.visible = true;
      } else if (r.icone) r.icone.visible = false;
      if (r.ghost) continue;
      _c.copy(r.cCorps); if (r.status === 'paused') _c.set('#596070'); if (T.survolAgent === r.id || T.focusAgent === r.id) _c.multiplyScalar(1.35);
      I.corps.setColorAt(r.ci, _c);
      _c.set(r.skin); if (r.status === 'paused') _c.lerp(_c2.set('#7d828c'), 0.55); I.tete.setColorAt(r.ci, _c);
    }
    [I.corps, I.tete, I.anneau].forEach((im) => { if (im.instanceColor) im.instanceColor.needsUpdate = true; });
    T.sales = false;
  }

  /* ── chantiers : entreprises proposées ── */
  function construireChantiers(props) {
    S.sites.forEach((s) => { if (s.label && s.label.element) s.label.element.remove(); });
    S.groupe.clear(); S.jet.forEach((x) => { if (x && x.dispose) x.dispose(); });
    S.jet = []; S.sites = []; S.reserve = new Set();
    const jet = (x) => { S.jet.push(x); return x; };
    props.forEach((c, k) => {
      const slot = (k % 2 === 0 ? 1 : -1) * (Math.floor(k / 2) + 1);
      S.reserve.add(slot);
      const x = slot * BLOC, g = new THREE.Group(); g.position.set(x, 0, 0);
      const col = new THREE.Color(c.color || ACCENT), cible = { type: 'site', id: c.id };
      const matL = jet(new THREE.LineBasicMaterial({ color: col.clone().multiplyScalar(0.75), transparent: true, opacity: 0.42 }));
      const matV = jet(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide }));
      const pick = [];
      const pad = new THREE.Mesh(jet(new THREE.PlaneGeometry(18.5, 18.5)), M.chantierSol); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.03; pad.receiveShadow = true; g.add(pad); pick.push(pad);
      const bord = [[-9.25, -9.25], [9.25, -9.25], [9.25, 9.25], [-9.25, 9.25]].map((p) => new THREE.Vector3(p[0], 0.06, p[1]));
      g.add(new THREE.LineLoop(jet(new THREE.BufferGeometry().setFromPoints(bord)), matL));
      const ech = new THREE.LineSegments(jet(geoEchafaudage(10, 7.5, 8)), matL); ech.position.set(1.2, 0, 0.8); g.add(ech);
      const volu = new THREE.Mesh(jet(new THREE.BoxGeometry(10, 7.5, 8)), matV); volu.position.set(1.2, 3.75, 0.8); volu.renderOrder = 2; g.add(volu);
      [2.5, 5].forEach((yy) => { const s = new THREE.Mesh(G.plan, matV); s.scale.set(10, 8, 1); s.rotation.x = -Math.PI / 2; s.position.set(1.2, yy, 0.8); g.add(s); });
      // grue : elle soulève la première dalle de l'entreprise
      const hg = 18 + Math.floor(k / 2) * 3.5, gx = (slot > 0 ? 1 : -1) * 6.8, gz = -6.2;
      const mat = new THREE.Mesh(jet(boite(0.7, hg, 0.7, 0, hg / 2, 0)), M.grue); mat.position.set(gx, 0, gz); mat.castShadow = true; g.add(mat); pick.push(mat);
      const tete = new THREE.Group(); tete.position.set(gx, hg, gz); g.add(tete);
      const fleche = new THREE.Mesh(jet(mergeGeometries([boite(18, 0.5, 0.55, 6, 0.25, 0), boite(0.45, 2.6, 0.45, 0, 1.55, 0), boite(1.1, 1.0, 1.1, 0.9, -0.55, 0)])), M.grue); fleche.castShadow = true; tete.add(fleche); pick.push(fleche);
      tete.add(new THREE.Mesh(jet(boite(1.6, 1.3, 1.1, -2.4, -0.35, 0)), M.murs));
      tete.add(new THREE.LineSegments(jet(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 2.85, 0), new THREE.Vector3(14.5, 0.5, 0), new THREE.Vector3(0, 2.85, 0), new THREE.Vector3(-3, 0.5, 0), new THREE.Vector3(9.5, 0, 0), new THREE.Vector3(9.5, -7.5, 0)])), jet(new THREE.LineBasicMaterial({ color: '#8b94a3' }))));
      tete.add(new THREE.Mesh(jet(boite(3, 0.25, 2, 9.5, -7.8, 0)), jet(std({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.5 }))));
      const feu = new THREE.Mesh(jet(new THREE.SphereGeometry(0.16, 10, 8)), jet(new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(3) }))); feu.position.set(14.8, 0.6, 0); tete.add(feu);
      const vp = new THREE.Mesh(jet(new THREE.BoxGeometry(18.5, hg + 2, 18.5)), M.invisible); vp.position.y = (hg + 2) / 2; g.add(vp);
      pick.forEach((o) => { o.userData.cible = cible; });
      vp.userData.cible = cible;
      const dot = document.createElement('i'); dot.style.cssText = 'width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:1px';
      dot.style.background = c.color || ACCENT;
      const ligne = document.createElement('div'); ligne.appendChild(dot); ligne.appendChild(span(c.name || c.id));
      const label = etiquette(LBL_SITE, [ligne, span('en attente de validation', 'font:500 10.5px/1.2 Inter,system-ui,sans-serif;color:#8A96AD;letter-spacing:.02em')], cible);
      label.element.style.borderColor = c.color || ACCENT;
      label.center.set(0.5, 1); label.position.set(0, hg + 4.2, 0); g.add(label);
      S.groupe.add(g);
      S.sites.push({ id: c.id, x, g, tete, feu, col, matL, matV, pick, vol: vp, label, ph: (h32(c.id) % 628) / 100, base: slot > 0 ? Math.PI : 0, hg });
    });
  }

  /* ── chemins des messages ── */
  function pointDe(id) {
    if (!T) return null;
    if (id === 'louis') return { p: T.louis.clone().add(new THREE.Vector3(0, 0.55, 0)), y: T.roofY, louis: true };
    if (!id || id === 'systeme') return { p: new THREE.Vector3(0, 1.8, 0.4), y: 0, base: true };
    const r = T.byId.get(id); if (!r) return null;
    return { p: r.head.clone().add(new THREE.Vector3(0, 0.55, 0)), y: r.floorY, agent: r };
  }
  function chemin(a, b) {
    if (Math.abs(a.y - b.y) < 0.5) {
      const mid = a.p.clone().lerp(b.p, 0.5); mid.y += 1.4 + Math.min(2.2, a.p.distanceTo(b.p) * 0.12);
      return new THREE.CatmullRomCurve3([a.p, mid, b.p], false, 'centripetal');
    }
    const cz = CORE_Z, ez = CORE_Z + CORE_D / 2 + 0.7;
    const pts = [a.p, a.p.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(0, a.y + 2.7, ez), new THREE.Vector3(0, a.y + 2.7, cz), new THREE.Vector3(0, b.y + 2.7, cz), new THREE.Vector3(0, b.y + 2.7, ez), b.p.clone().add(new THREE.Vector3(0, 0.8, 0)), b.p];
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  }
  function animerOrbes(now) {
    for (let i = orbes.length - 1; i >= 0; i--) {
      const o = orbes[i];
      if (now - o.debut >= o.duree) { if (o.vers.agent) o.vers.agent.pop = 1; if (o.vers.louis) flashBalise = 1; orbes.splice(i, 1); }
    }
    orbes.forEach((o, n) => {
      const u = (now - o.debut) / o.duree, s = easeIO(clamp(u, 0, 1)), entree = clamp(u / 0.08, 0, 1);
      for (let j = 0; j < TRAINE; j++) {
        const idx = n * TRAINE + j, sj = s - j * 0.016;
        if (sj < 0) { oTai[idx] = 0; oPos[idx * 3 + 1] = -500; continue; }
        o.curve.getPointAt(sj, _p); oPos[idx * 3] = _p.x; oPos[idx * 3 + 1] = _p.y; oPos[idx * 3 + 2] = _p.z;
        const fade = 1 - j / TRAINE, k = (j === 0 ? 3.4 : 1.7 * fade * fade) * entree;
        oTai[idx] = j === 0 ? 1.5 : 0.95 * fade;
        oCol[idx * 3] = o.col.r * k; oCol[idx * 3 + 1] = o.col.g * k; oCol[idx * 3 + 2] = o.col.b * k;
      }
      if (o.croise && u > 0.22 && u < 0.8) lueurNoyau = 1;
    });
    for (let idx = orbes.length * TRAINE; idx < NP; idx++) { if (oTai[idx] === 0 && oPos[idx * 3 + 1] === -500) continue; oTai[idx] = 0; oPos[idx * 3 + 1] = -500; }
    oGeo.attributes.position.needsUpdate = true; oGeo.attributes.acol.needsUpdate = true; oGeo.attributes.ataille.needsUpdate = true;
  }

  /* ── heure de Guadeloupe : ciel, lumières, néons ── */
  const NUIT = { top: '#01040c', hor: '#0e1f3d', bas: '#03060c', fog: '#081022', hh: '#2a3d66', hb: '#05070c', hi: 0.55, cle: '#a9c2ff', ci: 0.45, mer: '#020a14' };
  const JOUR = { top: '#2b78cf', hor: '#b5dcf7', bas: '#7aa0b8', fog: '#a9cde6', hh: '#cfe6ff', hb: '#6b6a5c', hi: 1.0, cle: '#fff1dc', ci: 2.4, mer: '#0b5470' };
  const AUBE = { top: '#2a3a74', hor: '#f29a6a', fog: '#c88c78', cle: '#ffb27a' };
  const mix3 = (cible, a, b, k, c, kc) => { cible.set(a).lerp(_c2.set(b), k); if (c) cible.lerp(_c2.set(c), kc); return cible; };
  function appliquerHeure(h, force) {
    const d = jour(h), tw = crepuscule(h) * 0.75;
    heureCourante = h;
    mix3(ciel.uTop.value, NUIT.top, JOUR.top, d, AUBE.top, tw * 0.6);
    mix3(ciel.uHor.value, NUIT.hor, JOUR.hor, d, AUBE.hor, tw);
    mix3(ciel.uBas.value, NUIT.bas, JOUR.bas, d);
    mix3(scene.fog.color, NUIT.fog, JOUR.fog, d, AUBE.fog, tw * 0.8);
    hemi.color.set(NUIT.hh).lerp(_c2.set(JOUR.hh), d); hemi.groundColor.set(NUIT.hb).lerp(_c2.set(JOUR.hb), d); hemi.intensity = lerp(NUIT.hi, JOUR.hi, d);
    const ang = ((h - 6) / 12) * Math.PI;
    const soleil = new THREE.Vector3(Math.cos(ang) * 0.85, Math.max(Math.sin(ang), 0.12), 0.42).normalize();
    const parSoleil = d > 0.12 || tw > 0.35;
    const dir = parSoleil ? soleil : LUNE;
    ciel.uDir.value.copy(soleil); ciel.uK.value = Math.max(d, tw);
    mix3(cle.color, NUIT.cle, JOUR.cle, d, AUBE.cle, tw); cle.intensity = parSoleil ? lerp(0.6, JOUR.ci, d) : NUIT.ci;
    cle.position.copy(dir).multiplyScalar(260).add(cle.target.position);
    renderer.toneMappingExposure = lerp(1.0, 0.9, d);
    if (bloom) { bloom.strength = lerp(0.7, 0.28, d); bloom.threshold = lerp(0.86, 0.94, d); }
    U.win.value = clamp(1 - d + tw * 0.4, 0, 1);
    U.interieur.value.set('#ffdcb5').multiplyScalar(lerp(0.85, 0.45, d));
    NEON = lerp(2.1, 1.2, d); majBandes();
    etoiles.material.opacity = Math.pow(1 - d, 2); etoiles.visible = d < 0.98;
    lune.material.opacity = 1 - d; luneHalo.material.opacity = 0.3 * (1 - d); lune.visible = luneHalo.visible = d < 0.98;
    M.lampe.color.set('#ffcf8f').multiplyScalar(lerp(2.4, 0.25, d));
    M.panneau.color.set('#ffe6c4').multiplyScalar(lerp(1.0, 0.8, d));
    scene.environmentIntensity = lerp(0.35, 1.0, d);
    if (mer && mer.isReflector) { mer.material.uniforms.uFond.value.set(NUIT.mer).lerp(_c2.set(JOUR.mer), d); mer.material.uniforms.uRefl.value = lerp(0.85, 0.6, d); }
    matMer.color.set(NUIT.mer).lerp(_c2.set(JOUR.mer), d);
    if (force || Math.abs(h - hEnv) > 0.2) {
      hEnv = h;
      const rt = pmrem.fromScene(envScene, 0.02); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture;
    }
  }

  /* ── sélection et survol ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function cibleSous(cx, cy) {
    const rc = cv.getBoundingClientRect();
    if (!rc.width || !rc.height) return null;
    ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const l1 = [sol]; if (ville) l1.push(ville);
    if (T) l1.push.apply(l1, T.pick1);
    S.sites.forEach((s) => l1.push.apply(l1, s.pick));
    const l2 = T ? T.pick2.slice() : []; S.sites.forEach((s) => l2.push(s.vol));
    const h1 = ray.intersectObjects(l1, false)[0], h2 = ray.intersectObjects(l2, false)[0];
    const cible1 = h1 ? interpreter(h1) : null;
    if (cible1 && cible1.type === 'agent') return cible1;
    if (h2 && (!h1 || h2.distance <= h1.distance)) return interpreter(h2);
    return cible1;
  }
  function interpreter(h) {
    const u = h.object.userData;
    if (u.agents && h.instanceId != null) { const id = u.agents[h.instanceId]; return id ? { type: 'agent', id } : null; }
    if (u.cible) return u.cible;
    if (u.etage && T) {
      if (h.point.y >= T.roofY - 0.2) return { type: 'roof' };
      const e = T.etages.find((x) => h.point.y >= x.y - SLAB && h.point.y < x.y + FH - SLAB);
      return e ? { type: 'company', id: e.c.id } : null;
    }
    return null;
  }
  let cleSurvol = '';
  function appliquerSurvol(c) {
    if (T) {
      T.survolAgent = c && c.type === 'agent' ? c.id : null; T.survolCo = c && c.type === 'company' ? c.id : null; T.survolToit = !!(c && c.type === 'roof');
      T.sales = true; majBandes();
    }
    S.sites.forEach((s) => { const on = !!(c && c.type === 'site' && c.id === s.id); s.matL.opacity = on ? 0.95 : 0.42; s.matV.opacity = on ? 0.1 : 0.035; s.matL.color.copy(s.col).multiplyScalar(on ? 1.5 : 0.75); });
  }
  function survol(cx, cy) {
    const c = cibleSous(cx, cy), k = c ? c.type + ':' + (c.id || '') : '';
    if (k !== cleSurvol) { cleSurvol = k; appliquerSurvol(c); }
    if (onHover) onHover(c, { x: cx, y: cy });
  }
  let appui = null, dernierSurvol = 0;
  const geste = () => { dernierGeste = performance.now(); touche = true; controls.autoRotate = false; };
  function surAppui(e) { appui = { x: e.clientX, y: e.clientY }; geste(); }
  function surRelache(e) {
    if (!appui) return;
    const dx = e.clientX - appui.x, dy = e.clientY - appui.y; appui = null;
    if (dx * dx + dy * dy > 36) return;
    const c = cibleSous(e.clientX, e.clientY);
    if (onPick) onPick(c);
  }
  function surMouvement(e) {
    if (e.buttons || e.pointerType === 'touch') return;
    const now = performance.now(); if (now - dernierSurvol < 50) return; dernierSurvol = now;
    survol(e.clientX, e.clientY);
  }
  function surSortie() { if (cleSurvol) { cleSurvol = ''; appliquerSurvol(null); } if (onHover) onHover(null, { x: 0, y: 0 }); }
  cv.addEventListener('pointerdown', surAppui);
  cv.addEventListener('pointerup', surRelache);
  cv.addEventListener('pointermove', surMouvement);
  cv.addEventListener('pointerleave', surSortie);
  cv.addEventListener('wheel', geste, { passive: true });
  controls.addEventListener('start', () => { geste(); vol = null; });

  /* ── caméra : vues et vols ── */
  function rect() { const r = container.getBoundingClientRect(); return { w: Math.max(1, r.width), h: Math.max(1, r.height), asp: Math.max(0.3, r.width / Math.max(1, r.height)) }; }
  const tanH = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function vueEnsemble() {
    const r = rect(), top = T ? T.top : LOBBY + 12;
    const ext = S.sites.length ? Math.max.apply(null, S.sites.map((s) => Math.abs(s.x))) + 12 : 18;
    const vert = (top * 0.6) / tanH(), horiz = (r.asp >= 1 ? ext * 0.85 : 17) / (tanH() * r.asp);
    return { cible: new THREE.Vector3(0, top * 0.36, 0), r: clamp(Math.max(vert, horiz) * 1.2, 55, 300), phi: 1.48, theta: 0.6 };
  }
  function voler(v, duree) {
    const t0 = controls.target.clone();
    const s0 = new THREE.Spherical().setFromVector3(_v.subVectors(camera.position, t0));
    vol = { t0, t1: v.cible.clone(), r0: Math.max(1, s0.radius), r1: v.r, p0: s0.phi, p1: v.phi, th0: s0.theta, dth: Math.atan2(Math.sin(v.theta - s0.theta), Math.cos(v.theta - s0.theta)), debut: performance.now(), duree: duree || 1100 };
    controls.autoRotate = false;
  }
  function poser(v) { controls.target.copy(v.cible); camera.position.setFromSpherical(_sph.set(v.r, v.phi, v.theta)).add(v.cible); camera.lookAt(v.cible); }
  function avancerVol(now) {
    const k = Math.min(1, (now - vol.debut) / vol.duree), e = easeIO(k);
    controls.target.lerpVectors(vol.t0, vol.t1, e);
    _sph.set(Math.exp(lerp(Math.log(vol.r0), Math.log(vol.r1), e)), lerp(vol.p0, vol.p1, e), vol.th0 + vol.dth * e);
    camera.position.setFromSpherical(_sph).add(controls.target); camera.lookAt(controls.target);
    if (k >= 1) vol = null;
  }

  /* ── étiquettes collées au flanc visible ── */
  let largeur = 1200;
  function placerEtiquettes() {
    const etroit = largeur < 560;
    S.sites.forEach((x) => { x.label.visible = !etroit; });
    if (!T) return;
    for (const l of T.labels) l.visible = !etroit;
    if (etroit) return;
    const vx = camera.position.x, vz = camera.position.z, L = Math.hypot(vx, vz) || 1;
    const ux = vz / L, uz = -vx / L;
    const tt = Math.min(W / 2 / Math.max(Math.abs(ux), 1e-3), D / 2 / Math.max(Math.abs(uz), 1e-3));
    for (const l of T.labels) l.position.set(ux * (tt + 1.3) * l.userData.cote, l.userData.y, uz * (tt + 1.3) * l.userData.cote);
  }

  /* ── boucle ── */
  let raf = 0, dernier = performance.now();
  function boucle(now) {
    raf = requestAnimationFrame(boucle);
    const dt = Math.min(0.05, Math.max(0, (now - dernier) / 1000)); dernier = now;
    const t = now / 1000;
    U.time.value = t;
    if (mer && mer.isReflector) mer.material.uniforms.uTime.value = t;
    if (T) {
      for (const r of T.agents) if (r.pop > 0) r.pop = Math.max(0, r.pop - dt * 2.6);
      if (T.sales) recolorer();
      poserAgents(T, t);
      let k = enAttente <= 0 ? 0.55 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.1)) : enAttente <= 3 ? 0.9 + 1.4 * Math.pow(0.5 + 0.5 * Math.sin(t * 3), 2) : 1.2 + 2.6 * Math.pow(0.5 + 0.5 * Math.sin(t * 6.2), 3);
      k += flashBalise * 2.2; if (T.survolToit) k *= 1.25;
      flashBalise = Math.max(0, flashBalise - dt * 1.5);
      T.balise.material.color.set(GOLD).multiplyScalar(k * 1.6);
      T.halo.material.opacity = clamp(0.12 + k * 0.13, 0, 0.8); T.halo.scale.setScalar(1.4 + k * 1.1);
      M.noyauLum.color.set(ACCENT).multiplyScalar(0.24 + lueurNoyau * 2.6);
      lueurNoyau = Math.max(0, lueurNoyau - dt * 1.4);
    }
    animerOrbes(now);
    S.sites.forEach((s) => { s.tete.rotation.y = s.base + Math.sin(t * 0.09 + s.ph) * 1.1; s.feu.visible = Math.sin(t * 3 + s.ph) > -0.2; });
    placerEtiquettes();
    if (vol) avancerVol(now); else controls.update(dt);
    if (controls.target.y < 0) controls.target.y = 0;
    controls.target.x = clamp(controls.target.x, -220, 220); controls.target.z = clamp(controls.target.z, -260, 160);
    if (mode === 'overview' && !vol && !controls.autoRotate && now - dernierGeste > 20000) controls.autoRotate = true;
    composer.render(dt);
    css.render(scene, camera);
  }
  function surVisibilite() {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { dernier = performance.now(); raf = requestAnimationFrame(boucle); }
  }
  document.addEventListener('visibilitychange', surVisibilite);

  function redimensionner() {
    const r = rect(); largeur = r.w;
    const dpr = Math.min(window.devicePixelRatio || 1, qualite === 'high' ? 1.75 : 1.25);
    renderer.setPixelRatio(dpr); renderer.setSize(r.w, r.h, false);
    composer.setPixelRatio(dpr); composer.setSize(r.w, r.h);
    css.setSize(r.w, r.h);
    camera.aspect = r.w / r.h; camera.updateProjectionMatrix();
    U.echelle.value = (r.h * dpr) / (2 * tanH());
    if (mer && mer.isReflector) mer.getRenderTarget().setSize(Math.max(256, Math.round(r.w * dpr * 0.5)), Math.max(256, Math.round(r.h * dpr * 0.5)));
  }
  const ro = new ResizeObserver(() => redimensionner()); ro.observe(container);

  /* ── démarrage ── */
  construireVille(new Set());
  construireMer();
  appliquerHeure(heureGP(), true);
  redimensionner();
  poser(vueEnsemble());
  raf = requestAnimationFrame(boucle);

  /* ── interface publique ── */
  const api = {
    update(etat) {
      if (!etat) return;
      try {
        const comps = Array.isArray(etat.companies) ? etat.companies : [];
        const actives = comps.filter((c) => c && c.status === 'active');
        const ids = new Set(actives.map((c) => c.id));
        const agents = (Array.isArray(etat.agents) ? etat.agents : []).filter((a) => a && ids.has(a.company_id));
        const sig = actives.map((c) => [c.id, c.floors, c.color, c.name].join(':')).join('|') + '#' + agents.map((a) => [a.id, a.company_id, a.seat, a.tier, a.status === 'attente' ? 'g' : 's'].join(':')).join('|');
        const props = comps.filter((c) => c && c.status === 'proposee');
        const sigS = props.map((c) => [c.id, c.color, c.name].join(':')).join('|');
        if (sigS !== sigSites) { sigSites = sigS; construireChantiers(props); construireVille(S.reserve); }
        if (sig !== sigTour) {
          sigTour = sig; construireTour(actives, agents);
          if (premier && !touche) { premier = false; voler(vueEnsemble(), 1700); }
        } else if (T) {
          agents.forEach((a) => { const r = T.byId.get(a.id); if (r && r.status !== a.status) { r.status = a.status; T.sales = true; } });
        }
        enAttente = Math.max(0, Number(etat.pending_validations) || 0); majBadge();
        const nom = (etat.group && etat.group.name) || 'LEXONOS';
        if (nom !== nomGroupe) dessinerEnseigne(nom);
        const h = heureForcee != null ? heureForcee : etat.time && Number.isFinite(Number(etat.time.hourGP)) ? Number(etat.time.hourGP) : heureGP();
        if (Math.abs(h - heureCourante) > 0.01) appliquerHeure(h);
      } catch (e) { console.error('scène :', e); }
    },
    pulse(m) {
      if (!T || !m) return;
      const a = pointDe(m.from), b = pointDe(m.to);
      if (!a || !b || a.p.distanceTo(b.p) < 0.3) return;
      const curve = chemin(a, b);
      if (orbes.length >= MAX_ORBES) orbes.shift();
      orbes.push({ curve, debut: performance.now(), duree: clamp(curve.getLength() / 24, 1.0, 3.6) * 1000, col: new THREE.Color(KIND[m.kind] || KIND.note), vers: b, croise: Math.abs(a.y - b.y) > 0.5 });
    },
    focus(c) {
      if (!c || c.type === 'overview') { mode = 'overview'; dernierGeste = performance.now(); if (T && T.focusAgent) { T.focusAgent = null; T.sales = true; } voler(vueEnsemble()); return; }
      mode = 'focus';
      const r = rect();
      if (T && T.focusAgent && c.type !== 'agent') { T.focusAgent = null; T.sales = true; }
      if (c.type === 'company' && T && T.parCo.get(c.id)) {
        const info = T.parCo.get(c.id), y0 = info.floors[0].y, y1 = info.floors[info.floors.length - 1].y + FH;
        const dist = clamp(13 / (tanH() * Math.min(1.6, r.asp)), 30, 70) + (info.floors.length - 1) * 5;
        voler({ cible: new THREE.Vector3(0, (y0 + y1) / 2 - 0.6, 0), r: dist, phi: 1.4, theta: 0.32 });
      } else if (c.type === 'agent' && T && T.byId.get(c.id)) {
        const a = T.byId.get(c.id), cible = a.head.clone().add(new THREE.Vector3(0, -0.3, 0)), dos = -Math.sign(a.fwd.z || -1);
        const cam = new THREE.Vector3(a.head.x * 0.55 + 2 * dos, a.floorY + 3.4, dos * (D / 2 + (r.asp < 1 ? 10 : 7)));
        T.focusAgent = a.id; T.sales = true;
        const sp = new THREE.Spherical().setFromVector3(cam.sub(cible));
        voler({ cible, r: sp.radius, phi: sp.phi, theta: sp.theta });
      } else if (c.type === 'roof' && T) {
        voler({ cible: new THREE.Vector3(0, T.roofY + 3, -0.5), r: r.asp < 1 ? 46 : 34, phi: 1.08, theta: 0.45 });
      } else if (c.type === 'site') {
        const s = S.sites.find((x) => x.id === c.id); if (!s) return;
        voler({ cible: new THREE.Vector3(s.x, s.hg * 0.55, 0), r: r.asp < 1 ? 70 : 52, phi: 1.36, theta: s.x > 0 ? 0.5 : -0.25 });
      }
    },
    _debug() { return { cam: camera.position.toArray().map((x) => +x.toFixed(1)), cible: controls.target.toArray().map((x) => +x.toFixed(1)), vol: !!vol, top: T && T.top, agents: T ? T.agents.length : 0, etages: T ? T.etages.length : 0, sites: S.sites.length, orbes: orbes.length, qualite, info: renderer.info.render }; },
    _heure(h) { heureForcee = h == null ? null : Number(h); appliquerHeure(heureForcee == null ? heureGP() : heureForcee, true); },
    setQuality(q) {
      q = q === 'low' ? 'low' : 'high'; if (q === qualite) return; qualite = q;
      renderer.shadowMap.enabled = q === 'high';
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
      construireComposer(); construireMer(); redimensionner();
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf); raf = 0;
      ro.disconnect(); document.removeEventListener('visibilitychange', surVisibilite);
      ['pointerdown', 'pointerup', 'pointermove', 'pointerleave'].forEach((n, i) => cv.removeEventListener(n, [surAppui, surRelache, surMouvement, surSortie][i]));
      cv.removeEventListener('wheel', geste);
      controls.dispose();
      detruireTour(); construireChantiers([]);
      if (mer && mer.isReflector) mer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
        if (o.material) [].concat(o.material).forEach((m) => { Object.keys(m).forEach((k) => { if (m[k] && m[k].isTexture) m[k].dispose(); }); m.dispose(); });
      });
      Object.values(G).forEach((g) => g.dispose && g.dispose());
      Object.values(tex).forEach((x) => x.dispose()); ens.tex.dispose();
      if (envRT) envRT.dispose(); pmrem.dispose();
      composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); bloom.dispose();
      renderer.dispose(); cv.remove(); css.domElement.remove();
    }
  };
  return api;
}
