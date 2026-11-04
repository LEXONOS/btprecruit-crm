// Graphiques en SVG, sans bibliothèque : barres du coût de l'IA par jour, lignes des prospects et des emails.
import { esc, TZ, usd } from './outils.js';

export function jours14(hist) {
  const out = [];
  for (let k = 13; k >= 0; k--) {
    const d = new Date(Date.now() - k * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ });
    const r = (hist || []).find((x) => x.day === d) || {};
    out.push({ d: d, cout: Number(r.cost_usd || 0), leads: Number(r.leads || 0), emails: Number(r.emails || 0), runs: Number(r.runs || 0) });
  }
  return out;
}

// largeur : celle de la carte qui l'accueille (le texte ne se déforme jamais) ; sur téléphone, celle de l'écran
export function courbe(hist, largeur) {
  const J = jours14(hist);
  const W = innerWidth < 880 ? Math.max(320, innerWidth - 64) : (largeur || 640), H = innerWidth < 880 ? 200 : largeur > 900 ? 240 : 210, g = 40, dr = 30, h0 = 16, b0 = 26;
  const maxC = Math.max(0.5, ...J.map((x) => x.cout)), maxL = Math.max(5, ...J.map((x) => Math.max(x.leads, x.emails)));
  const w = (W - g - dr) / J.length, y = (v, m) => H - b0 - (H - h0 - b0) * v / m;
  let s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Coût de l\'IA, prospects et emails sur 14 jours">';
  for (let i = 0; i <= 3; i++) { const yy = h0 + (H - h0 - b0) * i / 3; s += '<line class="g-grille" x1="' + g + '" x2="' + (W - dr) + '" y1="' + yy + '" y2="' + yy + '"/>'; }
  s += '<text x="' + (g - 6) + '" y="' + (h0 + 4) + '" text-anchor="end">' + esc(usd(maxC)) + '</text><text x="' + (W - dr + 6) + '" y="' + (h0 + 4) + '">' + maxL + '</text>';
  J.forEach((x, i) => {
    const bh = (H - h0 - b0) * x.cout / maxC, xx = g + i * w + w * 0.22;
    s += '<rect class="g-barre" x="' + xx.toFixed(1) + '" y="' + (H - b0 - bh).toFixed(1) + '" width="' + (w * 0.56).toFixed(1) + '" height="' + Math.max(0, bh).toFixed(1) + '" rx="3"><title>' + esc(x.d.slice(8) + '/' + x.d.slice(5, 7) + ' : ' + usd(x.cout)) + '</title></rect>';
    if (i % 2 === 0 || i === J.length - 1) s += '<text x="' + (g + i * w + w / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + x.d.slice(8) + '/' + x.d.slice(5, 7) + '</text>';
  });
  [['leads', 'g-l1'], ['emails', 'g-l2']].forEach((k) => {
    const pts = J.map((x, i) => (g + i * w + w / 2).toFixed(1) + ',' + y(x[k[0]], maxL).toFixed(1)).join(' ');
    s += '<polyline class="' + k[1] + '" fill="none" points="' + pts + '"/>';
    J.forEach((x, i) => { s += '<circle class="' + k[1] + '-p" cx="' + (g + i * w + w / 2).toFixed(1) + '" cy="' + y(x[k[0]], maxL).toFixed(1) + '" r="2.6"/>'; });
  });
  return s + '</svg><div class="legende"><span><i class="lg-barre"></i>Coût de l\'IA</span><span><i class="lg-l1"></i>Prospects trouvés</span><span><i class="lg-l2"></i>Emails envoyés</span></div>';
}
