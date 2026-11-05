// Les matières : métal brossé, cuivre, laiton, peinture laquée, verre, eau, béton, lueurs.
// Chaque objet reçoit ses propres copies (fondu, rayons X et surbrillance sont réglés objet par objet).
import * as THREE from 'three';

// couleurs nommées que les scènes peuvent utiliser partout
export const TEINTES = {
  chaud: '#ff4d2e', brulant: '#ff2a1a', tiede: '#ffa31a', froid: '#2fb8ff', glace: '#7fe3ff', eau: '#2f8cff', air: '#e8f4ff',
  huile: '#c98a12', gaz: '#b7f06a', electrique: '#a78bfa', accent: '#ffd60a', blanc: '#ffffff', noir: '#111317',
  rouge: '#e5383b', bleu: '#2563eb', vert: '#22c55e', jaune: '#facc15', orange: '#f97316', violet: '#8b5cf6', gris: '#8a919c'
};
export function teinte(c, defaut) {
  if (typeof c === 'string' && TEINTES[c]) return new THREE.Color(TEINTES[c]);
  if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) return new THREE.Color(c);
  return new THREE.Color(defaut || '#cccccc');
}

const PHYS = THREE.MeshPhysicalMaterial, STD = THREE.MeshStandardMaterial;
const MODELES = {
  acier: () => new STD({ color: '#b9c1ca', metalness: 1, roughness: 0.3 }),
  acier_sombre: () => new STD({ color: '#5b626c', metalness: 0.9, roughness: 0.42 }),
  chrome: () => new STD({ color: '#e9eef3', metalness: 1, roughness: 0.08 }),
  alu: () => new STD({ color: '#d5dbe2', metalness: 0.85, roughness: 0.24 }),
  cuivre: () => new STD({ color: '#c8743a', metalness: 1, roughness: 0.28 }),
  laiton: () => new STD({ color: '#caa23a', metalness: 1, roughness: 0.3 }),
  or: () => new STD({ color: '#ffcf5a', metalness: 1, roughness: 0.18 }),
  fonte: () => new STD({ color: '#3d4148', metalness: 0.7, roughness: 0.65 }),
  plastique: (c) => new PHYS({ color: teinte(c, '#f1f2f4'), metalness: 0, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
  peinture: (c) => new PHYS({ color: teinte(c, '#d93a2b'), metalness: 0.25, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12 }),
  caoutchouc: () => new STD({ color: '#1c1e22', metalness: 0, roughness: 0.92 }),
  verre: (c) => new PHYS({ color: teinte(c, '#8fb4d6'), metalness: 0, roughness: 0.2, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.25 }),
  eau: (c) => new PHYS({ color: teinte(c, '#2f8cff'), metalness: 0, roughness: 0.06, transparent: true, opacity: 0.62, depthWrite: false, clearcoat: 1 }),
  beton: () => new STD({ color: '#9a9ca0', metalness: 0, roughness: 0.95 }),
  roche: () => new STD({ color: '#6e5847', metalness: 0, roughness: 1 }),
  terre: () => new STD({ color: '#5a4636', metalness: 0, roughness: 1 }),
  bois: () => new STD({ color: '#a8743f', metalness: 0, roughness: 0.7 }),
  lueur: (c) => new THREE.MeshBasicMaterial({ color: teinte(c, '#ffd60a').multiplyScalar(2.2), toneMapped: false }),
  fantome: (c) => new STD({ color: teinte(c, '#9fd3ff'), metalness: 0, roughness: 0.4, transparent: true, opacity: 0.16, depthWrite: false })
};
export const NOMS_MATIERES = Object.keys(MODELES);

export function matiere(nom, couleur) {
  const f = MODELES[nom] || MODELES.acier;
  const m = f(couleur);
  if (couleur && (nom === 'acier' || nom === 'alu' || nom === 'acier_sombre') && m.color) m.color = teinte(couleur, '#b9c1ca');
  return m;
}

// une lueur qui dépasse le blanc : le flou lumineux (bloom) la fait rayonner
export function lueur(couleur, force) {
  return new THREE.MeshBasicMaterial({ color: teinte(couleur, '#ffd60a').multiplyScalar(force || 2.4), toneMapped: false });
}
