// Le calque 2D posé sur la 3D : l'accroche du début, les sous-titres mot à mot, les étiquettes reliées aux pièces,
// le chiffre clé du moment et une fine barre de progression. Les zones couvertes par l'interface de TikTok
// (le bas de l'écran et la colonne de boutons à droite) restent libres.
import { clamp, sortie, rebond } from './outils.js';

const LATIN = /^[\u0000-ɏḀ-ỿ\s\p{P}\p{N}]*$/u;
const enCapitales = (s, langue) => (LATIN.test(s) && langue !== 'hi' ? s.toLocaleUpperCase(langue || 'en') : s);

function police(ctx, poids, taille, famille, etroit) {
  ctx.font = poids + ' ' + Math.round(taille) + 'px ' + famille;
  try { ctx.fontStretch = etroit ? 'condensed' : 'normal'; } catch (e) { /* navigateur ancien */ }
}
function arrondi(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// un texte avec des *mots* mis en valeur, coupé en lignes qui tiennent dans la largeur
function lignesSurlignees(ctx, texte, largeurMax) {
  const mots = String(texte || '').split(/\s+/).filter(Boolean).map((m) => ({ m: m.replace(/\*/g, ''), fort: /^\*.*\*$|^\*|\*$/.test(m) }));
  const lignes = [];
  let cur = [], w = 0;
  const esp = Math.max(ctx.measureText(' ').width, parseFloat(ctx.font.split('px')[0].split(' ').pop()) * 0.26);
  mots.forEach((x) => {
    const lw = ctx.measureText(x.m).width;
    if (cur.length && w + esp + lw > largeurMax) { lignes.push({ mots: cur, w }); cur = []; w = 0; }
    cur.push(Object.assign(x, { w: lw })); w += (cur.length > 1 ? esp : 0) + lw;
  });
  if (cur.length) lignes.push({ mots: cur, w });
  return { lignes, esp };
}
function texteContoure(ctx, txt, x, y, remplissage, contour, epaisseur) {
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (epaisseur) { ctx.strokeStyle = contour; ctx.lineWidth = epaisseur; ctx.strokeText(txt, x, y); }
  ctx.fillStyle = remplissage; ctx.fillText(txt, x, y);
}

export function creerCalque(W, H, style) {
  const accent = style.accent || '#FFD60A';
  const accent2 = style.accent2 || '#38BDF8';
  const titre = '"Unbounded", "Noto Sans Devanagari", sans-serif';
  const sous = '"Archivo", "Noto Sans Devanagari", sans-serif';
  const texte = '"Inter", "Noto Sans Devanagari", sans-serif';
  let vignette = null;

  function fondVignette(ctx) {
    if (!vignette) {
      vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
      const g = vignette.getContext('2d');
      const r = g.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.75);
      r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = r; g.fillRect(0, 0, W, H);
      const haut = g.createLinearGradient(0, 0, 0, H * 0.32); haut.addColorStop(0, 'rgba(0,0,0,0.38)'); haut.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = haut; g.fillRect(0, 0, W, H * 0.32);
      const bas = g.createLinearGradient(0, H * 0.58, 0, H); bas.addColorStop(0, 'rgba(0,0,0,0)'); bas.addColorStop(1, 'rgba(0,0,0,0.30)');
      g.fillStyle = bas; g.fillRect(0, H * 0.58, W, H * 0.42);
    }
    ctx.drawImage(vignette, 0, 0);
  }

  // l'accroche : en haut, en gros, pendant le premier plan
  function accroche(ctx, txt, t, fin, langue) {
    if (!txt || t > fin + 0.25) return;
    const apparition = sortie(t / 0.35), depart = clamp((fin + 0.25 - t) / 0.25, 0, 1);
    const k = Math.min(apparition, depart);
    if (k <= 0) return;
    ctx.save();
    const taille = W * 0.072;
    police(ctx, 800, taille, titre);
    const { lignes, esp } = lignesSurlignees(ctx, enCapitales(txt, langue), W * 0.84);
    const lh = taille * 1.12, y0 = H * 0.135 - ((lignes.length - 1) * lh) / 2;
    const s = 1.12 - 0.12 * rebond(clamp(t / 0.4, 0, 1));
    ctx.globalAlpha = k; ctx.translate(W / 2, y0); ctx.scale(s, s);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    lignes.forEach((l, i) => {
      let x = -l.w / 2;
      l.mots.forEach((m) => { texteContoure(ctx, m.m, x, i * lh, m.fort ? accent : '#ffffff', 'rgba(0,0,0,0.92)', taille * 0.2); x += m.w + esp; });
    });
    ctx.restore();
  }

  // le chiffre ou le mot clé du plan : un grand texte en couleur sous l'accroche
  function ecran(ctx, txt, t, debut, fin, langue) {
    if (!txt || t < debut || t > fin) return;
    const k = Math.min(sortie((t - debut - 0.15) / 0.3), clamp((fin - t) / 0.2, 0, 1));
    if (k <= 0) return;
    ctx.save();
    const taille = W * 0.1;
    police(ctx, 900, taille, titre);
    const t2 = enCapitales(txt, langue);
    let tw = ctx.measureText(t2).width, sc = 1;
    if (tw > W * 0.86) sc = (W * 0.86) / tw;
    const pop = 0.7 + 0.3 * rebond(clamp((t - debut - 0.15) / 0.45, 0, 1));
    ctx.translate(W / 2, H * 0.245); ctx.scale(sc * pop, sc * pop); ctx.globalAlpha = k;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    texteContoure(ctx, t2, 0, 0, accent, 'rgba(0,0,0,0.95)', taille * 0.2);
    ctx.restore();
  }

  // les sous-titres : 1 à 3 mots à la fois, le mot dit en couleur
  function sousTitres(ctx, morceaux, t, langue) {
    const m = morceaux.find((x) => t >= x.t0 && t < x.t1);
    if (!m) return;
    ctx.save();
    const taille = W * (langue === 'hi' ? 0.074 : 0.088);
    police(ctx, 850, taille, sous, true);
    const mots = m.mots.map((x) => Object.assign({}, x, { txt: enCapitales(x.m, langue) }));
    const esp = taille * 0.34;
    mots.forEach((x) => { x.w = ctx.measureText(x.txt).width; });
    let total = mots.reduce((s, x) => s + x.w, 0) + esp * (mots.length - 1);
    const sc = total > W * 0.84 ? (W * 0.84) / total : 1;
    const pop = 0.92 + 0.08 * sortie((t - m.t0) / 0.09);
    ctx.translate(W / 2, H * 0.695); ctx.scale(sc * pop, sc * pop);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let x = -total / 2;
    mots.forEach((w) => {
      const dit = t >= w.t0 && t < w.t1 + 0.04;
      ctx.save();
      if (dit) { ctx.translate(x + w.w / 2, 0); ctx.scale(1.04, 1.04); ctx.translate(-(x + w.w / 2), 0); }
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      texteContoure(ctx, w.txt, x, 0, dit ? accent : '#ffffff', 'rgba(0,0,0,0.95)', taille * 0.22);
      ctx.restore();
      x += w.w + esp;
    });
    ctx.restore();
  }

  // une étiquette : un point sur la pièce, un trait, une pastille de verre sombre avec le nom
  function etiquettes(ctx, liste) {
    const prises = [];
    liste.forEach((e, i) => {
      if (!e.visible || e.k <= 0.01) return;
      ctx.save();
      const taille = W * 0.036;
      police(ctx, 700, taille, texte);
      const tw = ctx.measureText(e.texte).width;
      const pw = tw + taille * 1.3, ph = taille * 1.9;
      const gauche = e.x > W * 0.5;
      let px = gauche ? e.x - W * 0.13 - pw : e.x + W * 0.13;
      let py = e.y - H * 0.075 - ph / 2;
      px = clamp(px, W * 0.04, W * 0.8 - pw);
      py = clamp(py, H * 0.29, H * 0.6);
      // pas de chevauchement entre deux étiquettes
      prises.forEach((q) => { if (Math.abs(q.y - py) < ph * 1.15 && px < q.x + q.w && px + pw > q.x) py = q.y + (py < q.y ? -ph * 1.2 : ph * 1.2); });
      py = clamp(py, H * 0.29, H * 0.6);
      prises.push({ x: px, y: py, w: pw });
      const ax = gauche ? px + pw : px, ay = py + ph / 2;
      const k = e.k, kl = clamp(k * 1.6, 0, 1), kp = clamp(k * 1.6 - 0.6, 0, 1);
      // le point
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.beginPath(); ctx.arc(e.x, e.y, taille * 0.32, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.arc(e.x, e.y, taille * 0.32 + 6 + 10 * (1 - k), 0, Math.PI * 2); ctx.strokeStyle = accent2; ctx.lineWidth = 4; ctx.stroke();
      // le trait
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + (ax - e.x) * kl, e.y + (ay - e.y) * kl); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3.5; ctx.stroke();
      // la pastille
      if (kp > 0) {
        ctx.globalAlpha = kp;
        ctx.translate(0, (1 - kp) * 14);
        arrondi(ctx, px, py, pw, ph, ph * 0.28); ctx.fillStyle = 'rgba(9,13,22,0.82)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
        arrondi(ctx, px, py, taille * 0.22, ph, taille * 0.11); ctx.fillStyle = accent2; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillText(e.texte, px + taille * 0.75, py + ph / 2 + 1);
      }
      ctx.restore();
    });
  }

  function progression(ctx, t, duree) {
    const k = clamp(t / Math.max(0.1, duree), 0, 1);
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, 0, W, 7); ctx.fillStyle = accent; ctx.fillRect(0, 0, W * k, 7); ctx.restore();
  }

  function marque(ctx, txt) {
    if (!txt) return;
    ctx.save(); police(ctx, 700, W * 0.03, texte); ctx.globalAlpha = 0.62; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    texteContoure(ctx, txt, W * 0.05, H * 0.6, '#ffffff', 'rgba(0,0,0,0.6)', 6); ctx.restore();
  }

  return { fondVignette, accroche, ecran, sousTitres, etiquettes, progression, marque };
}

// Découpe les mots chronométrés d'un plan en petits morceaux lisibles (3 mots, 18 signes au plus)
export function morceaux(mots, langue) {
  const out = [];
  let cur = [];
  const max = langue === 'hi' ? 3 : 3, maxSignes = 18;
  const pousser = () => { if (cur.length) { out.push({ mots: cur, t0: cur[0].t0, t1: cur[cur.length - 1].t1 }); cur = []; } };
  mots.forEach((m, i) => {
    const signes = cur.reduce((s, x) => s + x.m.length + 1, 0) + m.m.length;
    if (cur.length >= max || (cur.length && signes > maxSignes)) pousser();
    cur.push(m);
    if (/[.!?,;:]$/.test(m.m) && i < mots.length - 1) pousser();
  });
  pousser();
  // chaque morceau reste à l'écran jusqu'au suivant (pas de trou noir entre deux)
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1].t0 - out[i].t1 < 0.6) out[i].t1 = out[i + 1].t0;
  if (out.length) out[out.length - 1].t1 += 0.35;
  return out;
}
