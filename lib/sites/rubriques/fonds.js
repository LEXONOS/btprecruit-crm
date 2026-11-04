// Les fonds travaillés et les transitions entre les blocs. Un fond est un calque posé sous le contenu d'un bloc
// (<div class="fond f-…">) : grain, maille de couleurs, aurore qui respire, trame de points, grille de plan, rayons de
// soleil, courbes de niveau, vagues, motif du métier... Il prend les couleurs locales de la surface du bloc (--acc, --tx),
// il ne gêne jamais la lecture (opacité faible, masques en fondu) et s'arrête pour qui demande moins d'animations.
// Une transition est une découpe entre deux blocs de surfaces différentes (vague, biais, courbe, dents).
'use strict';
const T = require('../theme');

const svg = function (s) { return 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")'; };
const NOISE = svg('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>');
function topo(c) {
  const p = ['M-20 140C80 80 160 170 260 120S420 40 520 90', 'M-20 180C90 120 170 210 270 160S430 80 520 130', 'M-20 220C100 160 180 250 280 200S440 120 520 170', 'M-20 260C110 200 190 290 290 240S450 160 520 210', 'M-20 300C120 240 200 330 300 280S460 200 520 250', 'M-20 60C70 10 150 90 250 50S410-20 520 20', 'M-20 100C75 45 155 130 255 85S415 0 520 55', 'M-20 340C130 280 210 370 310 320S470 240 520 290', 'M-20 380C140 320 220 410 320 360S480 280 520 330'];
  return svg('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400" viewBox="0 0 500 400"><g fill="none" stroke="' + c + '" stroke-width="1.1">' + p.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</g></svg>');
}
function vagues(c) { return svg('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="28" viewBox="0 0 120 28"><path d="M0 14c15 0 15-10 30-10s15 10 30 10 15-10 30-10 15 10 30 10" fill="none" stroke="' + c + '" stroke-width="1.4"/></svg>'); }
function lignes(c) { return svg('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><g fill="none" stroke="' + c + '" stroke-width="1.2">' + [0, 1, 2, 3, 4, 5, 6].map(function (k) { return '<path d="M-50 ' + (420 - k * 34) + 'C250 ' + (260 - k * 30) + ' 520 ' + (560 - k * 22) + ' 820 ' + (330 - k * 28) + 'S1150 ' + (180 - k * 18) + ' 1260 ' + (240 - k * 26) + '"/>'; }).join('') + '</g></svg>'); }
function motif(icone, c) { return svg('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><g fill="none" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(12 12) scale(1)">' + (T.ICONES[icone] || T.ICONES.etoile) + '</g><g transform="translate(60 60) rotate(18 12 12) scale(.8)">' + (T.ICONES[icone] || T.ICONES.etoile) + '</g></g></svg>'); }

// les fonds : id → { nom, quand (pour le constructeur), css(ctx) }
const FONDS = {
  grain: { nom: 'Grain de papier', quand: 'partout, donne de la matière (premium, chaleureux)', anime: false },
  maille: { nom: 'Maille de couleurs', quand: 'haut de page sans photo, bande sombre, appel', anime: false },
  aurore: { nom: 'Aurore qui respire', quand: 'bande sombre, haut de page sans photo (lent, discret)', anime: true },
  points: { nom: 'Trame de points', quand: 'sections claires, cabinets, artisans', anime: false },
  grille: { nom: 'Grille de plan', quand: 'bâtiment, technique, informatique, cabinet', anime: false },
  diagonales: { nom: 'Fines diagonales', quand: 'garage, chantier, sécurité', anime: false },
  rayons: { nom: 'Rayons de soleil', quand: 'table, mer, boutique, fête', anime: true },
  topo: { nom: 'Courbes de niveau', quand: 'mer, randonnée, jardin, terrain', anime: false },
  vagues: { nom: 'Vagues', quand: 'mer, piscine, nautisme, eau', anime: false },
  lignes: { nom: 'Lignes fluides', quand: 'beauté, soins, conseil (élégant)', anime: true },
  halo: { nom: 'Halo qui suit la souris', quand: 'bande sombre (lumière qui suit le pointeur)', anime: true },
  motif: { nom: 'Motif du métier', quand: 'bande claire ou sombre, signature discrète du métier', anime: false },
  degrade: { nom: 'Dégradé profond', quand: 'bande sombre, appel, pied de page', anime: false },
  carreaux: { nom: 'Carreaux', quand: 'carrelage, cuisine, boutique (damier très léger)', anime: false }
};
const IDS = Object.keys(FONDS);

function css(ctx, utilises) {
  const p = ctx.palette;
  const clairTx = T.melange(p.encre, p.fond, 0.82), sombreTx = T.melange(p.surChamp, p.champ, 0.72);
  const ic = ctx.iconeMetier || 'etoile';
  const u = new Set(utilises || IDS);
  const out = [];
  if (u.has('grain')) out.push('.f-grain::after{content:"";position:absolute;inset:0;background-image:' + NOISE + ';background-size:180px;opacity:.13;mix-blend-mode:soft-light}.s-fond .f-grain::after,.s-surface .f-grain::after{opacity:.2;mix-blend-mode:multiply}');
  if (u.has('maille')) out.push('.f-maille{background:radial-gradient(55% 65% at 12% 18%,color-mix(in srgb,var(--acc) 34%,transparent),transparent 70%),radial-gradient(45% 55% at 88% 22%,color-mix(in srgb,var(--accent) 30%,transparent),transparent 72%),radial-gradient(60% 55% at 62% 105%,color-mix(in srgb,var(--vif) 26%,transparent),transparent 70%)}.f-maille::after{content:"";position:absolute;inset:0;background-image:' + NOISE + ';background-size:180px;opacity:.12;mix-blend-mode:soft-light}');
  if (u.has('aurore')) out.push('.f-aurore::before,.f-aurore::after{content:"";position:absolute;width:70vmax;height:70vmax;border-radius:50%;will-change:transform}.f-aurore::before{top:-38vmax;left:-22vmax;background:radial-gradient(circle,color-mix(in srgb,var(--acc) 42%,transparent) 0,transparent 62%);animation:k-aurore-a 24s ease-in-out infinite alternate}.f-aurore::after{bottom:-42vmax;right:-26vmax;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 36%,transparent) 0,transparent 60%);animation:k-aurore-b 30s ease-in-out infinite alternate}@keyframes k-aurore-a{to{transform:translate(16vmax,9vmax) scale(1.18)}}@keyframes k-aurore-b{to{transform:translate(-14vmax,-8vmax) scale(1.12)}}');
  if (u.has('points')) out.push('.f-points{background-image:radial-gradient(color-mix(in srgb,var(--tx) 24%,transparent) 1.1px,transparent 1.4px);background-size:22px 22px;-webkit-mask-image:radial-gradient(ellipse 75% 65% at 70% 35%,#000 20%,transparent 75%);mask-image:radial-gradient(ellipse 75% 65% at 70% 35%,#000 20%,transparent 75%)}');
  if (u.has('grille')) out.push('.f-grille{background-image:linear-gradient(color-mix(in srgb,var(--tx) 9%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--tx) 9%,transparent) 1px,transparent 1px);background-size:56px 56px;background-position:-1px -1px;-webkit-mask-image:linear-gradient(180deg,transparent,#000 18%,#000 72%,transparent);mask-image:linear-gradient(180deg,transparent,#000 18%,#000 72%,transparent)}');
  if (u.has('diagonales')) out.push('.f-diagonales{background-image:repeating-linear-gradient(135deg,color-mix(in srgb,var(--tx) 7%,transparent) 0 1px,transparent 1px 16px);-webkit-mask-image:linear-gradient(90deg,transparent,#000 35%);mask-image:linear-gradient(90deg,transparent,#000 35%)}');
  if (u.has('rayons')) out.push('.f-rayons::before{content:"";position:absolute;left:50%;top:115%;width:260vmax;height:260vmax;translate:-50% -50%;background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--acc) 11%,transparent) 0 5deg,transparent 5deg 15deg);-webkit-mask-image:radial-gradient(circle,#000 8%,transparent 42%);mask-image:radial-gradient(circle,#000 8%,transparent 42%);animation:k-rayons 120s linear infinite}@keyframes k-rayons{to{rotate:360deg}}');
  if (u.has('topo')) out.push('.f-topo{background-image:' + topo(clairTx) + ';background-size:620px auto;opacity:.75}.s-champ .f-topo,.s-photo .f-topo,.s-accent .f-topo{background-image:' + topo(sombreTx) + '}');
  if (u.has('vagues')) out.push('.f-vagues{background-image:' + vagues(clairTx) + ';background-size:120px 28px;-webkit-mask-image:linear-gradient(180deg,transparent,#000 40%,transparent);mask-image:linear-gradient(180deg,transparent,#000 40%,transparent);opacity:.9}.s-champ .f-vagues,.s-accent .f-vagues{background-image:' + vagues(sombreTx) + '}');
  if (u.has('lignes')) out.push('.f-lignes{background-image:' + lignes(clairTx) + ';background-size:cover;background-position:center;animation:k-lignes 18s ease-in-out infinite alternate}.s-champ .f-lignes,.s-accent .f-lignes{background-image:' + lignes(sombreTx) + '}@keyframes k-lignes{to{background-position:60% 40%}}');
  if (u.has('halo')) out.push('.f-halo{background:radial-gradient(520px circle at var(--mx,72%) var(--my,28%),color-mix(in srgb,var(--acc) 26%,transparent),transparent 62%);transition:background .2s}');
  if (u.has('motif')) out.push('.f-motif{background-image:' + motif(ic, clairTx) + ';background-size:96px;-webkit-mask-image:linear-gradient(160deg,#000,transparent 70%);mask-image:linear-gradient(160deg,#000,transparent 70%);opacity:.8}.s-champ .f-motif,.s-accent .f-motif,.s-photo .f-motif{background-image:' + motif(ic, sombreTx) + '}');
  if (u.has('degrade')) out.push('.f-degrade{background:radial-gradient(90% 80% at 50% 120%,color-mix(in srgb,var(--acc) 28%,transparent),transparent 70%),linear-gradient(180deg,transparent,color-mix(in srgb,#000 22%,transparent))}');
  if (u.has('carreaux')) out.push('.f-carreaux{background:conic-gradient(color-mix(in srgb,var(--tx) 4.5%,transparent) 25%,transparent 0 50%,color-mix(in srgb,var(--tx) 4.5%,transparent) 0 75%,transparent 0) 0 0/52px 52px;-webkit-mask-image:linear-gradient(180deg,#000,transparent 85%);mask-image:linear-gradient(180deg,#000,transparent 85%)}');
  out.push('@media(prefers-reduced-motion:reduce){.fond,.fond::before,.fond::after{animation:none!important}}');
  return out.join('');
}

/* ── transitions entre deux blocs ── */
const TRANSITIONS = {
  vague: '<path d="M0 46C180 10 360 10 540 34s360 50 540 26 270-44 360-30V80H0z"/>',
  houle: '<path d="M0 52c120-28 240-28 360 0s240 28 360 0 240-28 360 0 240 28 360 0V80H0z"/>',
  biais: '<path d="M0 80L1440 6V80z"/>',
  courbe: '<path d="M0 80C360 0 1080 0 1440 80z"/>',
  dents: '<path d="M0 80V56l40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24 40-24 40 24V80z"/>',
  marche: '<path d="M0 80V40h480v20h480V24h480V80z"/>'
};
const COULEUR_SURFACE = { fond: 'var(--fond)', surface: 'var(--surface)', champ: 'var(--champ)', accent: 'var(--accent)' };
// la découpe posée entre deux blocs : couleur du bloc du dessus en fond, la forme a la couleur du bloc du dessous
function transition(type, de, vers) {
  if (!TRANSITIONS[type] || !COULEUR_SURFACE[de] || !COULEUR_SURFACE[vers] || de === vers) return '';
  return '<div class="tr tr-' + type + '" aria-hidden="true" style="background:' + COULEUR_SURFACE[de] + ';color:' + COULEUR_SURFACE[vers] + '"><svg viewBox="0 0 1440 80" preserveAspectRatio="none" fill="currentColor">' + TRANSITIONS[type] + '</svg></div>';
}
const CSS_TRANSITIONS = '.tr{position:relative;z-index:2;line-height:0;margin-block:-1px}.tr svg{width:100%;height:clamp(28px,5vw,72px)}.tr-dents svg{height:clamp(16px,2vw,26px)}';

module.exports = { FONDS, IDS, css, TRANSITIONS, transition, CSS_TRANSITIONS, COULEUR_SURFACE };
