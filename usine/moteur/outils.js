// Petits outils du moteur : interpolations, courbes d'accélération, hasard reproductible.
// Tout est fonction du temps : une image se calcule seule, sans dépendre des images d'avant.

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const lisse = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
export const entreeSortie = (k) => { k = clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const sortie = (k) => { k = clamp(k, 0, 1); return 1 - Math.pow(1 - k, 3); };
export const rebond = (k) => { k = clamp(k, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
export const frac = (x) => x - Math.floor(x);
export const rad = (d) => d * Math.PI / 180;

// angle le plus court entre deux azimuts (degrés)
export function angleVers(a, b, k) { let d = ((b - a + 540) % 360) - 180; return a + d * k; }

// hasard reproductible : la même graine donne toujours la même suite
export function hasard(graine) {
  let s = (graine >>> 0) || 1;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function graineDe(texte) { let h = 2166136261; for (let i = 0; i < String(texte).length; i++) { h ^= String(texte).charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
export const vec = (v, d) => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && isFinite(x)) ? v : d);
