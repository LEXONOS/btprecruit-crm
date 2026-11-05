// En-têtes des templates : toujours posés par-dessus le haut de page (position fixe), transparents en haut, en verre
// clair dès qu'on défile ; texte blanc tant qu'ils sont sur une photo. Quatre dessins : la barre, le nom au centre,
// la pilule flottante, le minimal (un bouton Menu, même sur ordinateur).
'use strict';

function liens(ctx, cls) { const h = ctx.h; return (ctx.ancres || []).map(function (a, k) { return '<a class="' + cls + '" href="' + h.esc(a.href) + '" style="--i:' + (k + 1) + '">' + h.esc(a.nom) + '</a>'; }).join(''); }
function cta(spec, ctx, cls) {
  const h = ctx.h, a = h.actionPrincipale(spec);
  return a ? '<a class="btn b1 ' + cls + '" href="' + h.esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + '>' + h.contenuBouton(a.icone, a.type === 'tel' ? 'Appeler' : a.court) + '</a>' : '';
}
// ce que toutes les barres partagent : fond en verre au défilement, blanc sur photo, rangée quand on descend
function socle(c) { return `
.${c},.r.${c}{position:fixed;top:0;left:0;right:0;z-index:50;background:transparent;color:var(--encre);--tx:var(--encre);transition:color .4s}
.${c}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:0;background:color-mix(in srgb,var(--fond) 88%,transparent);-webkit-backdrop-filter:saturate(1.5) blur(16px);backdrop-filter:saturate(1.5) blur(16px);border-bottom:1px solid var(--ligne);transition:opacity .45s,transform .55s var(--ease)}
.${c}.defile::before{opacity:1}
.${c}.sur-photo:not(.defile){color:#fff;--tx:#fff;--btn:var(--btnP);--btnT:var(--btnPT)}
.${c}.range::before,.${c}.range>.w{transform:translateY(-104%)}
.${c}.range{pointer-events:none}
.${c}>.w{transition:transform .55s var(--ease)}
.${c} .btn{min-height:46px;padding:0 20px;font-size:.94rem}
@media(max-width:420px){.${c}>.w .btn .bt{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.${c}>.w .btn{padding:0 14px}}
`; }

const barre = {
  id: 'nav.x-barre', rubrique: 'nav', x: true, nom: 'Barre claire', quand: 'templates : nom à gauche, liens soulignés, bouton à droite',
  surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    return '<header class="' + h.classes('nav.x-barre', bloc, bloc && bloc.surPhoto ? 'sur-photo' : '') + '" data-tete="cache"><div class="w xb">' + ctx.marque + '<nav class="xb-l" aria-label="Navigation">' + liens(ctx, 'xb-a') + '</nav><div class="xb-d">' + cta(spec, ctx, 'xb-c') + ctx.burger + '</div></div>' + ctx.menuMobile + '</header>';
  },
  css: function () { const c = 'r-nav-x-barre'; return socle(c) + `
.${c} .xb{display:flex;align-items:center;gap:24px;min-height:86px;transition:min-height .45s var(--ease)}
.${c}.defile .xb{min-height:70px}
.${c} .xb-l{display:flex;gap:30px;margin-left:auto;font-weight:var(--fxf);font-size:.97rem}
.${c} .xb-a{position:relative;text-decoration:none;padding:8px 0}
.${c} .xb-a::after{content:"";position:absolute;left:0;right:0;bottom:3px;height:1.5px;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .45s var(--ease)}
.${c} .xb-a:hover::after{transform:scaleX(1);transform-origin:left}
.${c} .xb-d{display:flex;align-items:center;gap:10px;margin-left:18px}
@media(max-width:900px){.${c} .xb-l{display:none}.${c} .xb-d{margin-left:auto}.${c} .xb{min-height:72px}}
`; }
};

const centre = {
  id: 'nav.x-centre', rubrique: 'nav', x: true, nom: 'Nom au centre', quand: 'templates : le nom au centre comme une enseigne, les liens de part et d\'autre',
  surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = ctx.ancres || [], m = Math.ceil(a.length / 2);
    const l = function (x, k) { return '<a class="xc-a" href="' + h.esc(x.href) + '" style="--i:' + (k + 1) + '">' + h.esc(x.nom) + '</a>'; };
    return '<header class="' + h.classes('nav.x-centre', bloc, bloc && bloc.surPhoto ? 'sur-photo' : '') + '" data-tete="cache"><div class="w xc"><nav class="xc-g" aria-label="Navigation">' + a.slice(0, m).map(l).join('') + '</nav><div class="xc-m">' + ctx.marque + '</div><div class="xc-d"><nav class="xc-g2" aria-label="Navigation, suite">' + a.slice(m).map(function (x, k) { return l(x, k + m); }).join('') + '</nav>' + cta(spec, ctx, 'xc-c') + ctx.burger + '</div></div>' + ctx.menuMobile + '</header>';
  },
  css: function () { const c = 'r-nav-x-centre'; return socle(c) + `
.${c} .xc{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;min-height:92px;transition:min-height .45s var(--ease)}
.${c}.defile .xc{min-height:72px}
.${c} .xc-g,.${c} .xc-g2{display:flex;gap:28px;font-weight:var(--fxf);font-size:.95rem;letter-spacing:.01em}
.${c} .xc-m{justify-self:center}
.${c} .xc-d{display:flex;align-items:center;justify-content:flex-end;gap:22px}
.${c} .xc-a{text-decoration:none;padding:8px 0;background:linear-gradient(currentColor,currentColor) 0 100%/0 1.5px no-repeat;transition:background-size .45s var(--ease)}
.${c} .xc-a:hover{background-size:100% 1.5px}
.${c} .marque .nm{font-size:1.5rem}
@media(max-width:900px){.${c} .xc{grid-template-columns:auto 1fr;min-height:72px}.${c} .xc-g,.${c} .xc-g2{display:none}.${c} .xc-m{justify-self:start;grid-column:1;grid-row:1}.${c} .xc-d{grid-column:2}}
`; }
};

const pilule = {
  id: 'nav.x-pilule', rubrique: 'nav', x: true, nom: 'Pilule flottante', quand: 'templates : une barre arrondie qui flotte, détachée du bord',
  surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    return '<header class="' + h.classes('nav.x-pilule', bloc, bloc && bloc.surPhoto ? 'sur-photo' : '') + '" data-tete="cache"><div class="w xpl"><div class="xpl-in">' + ctx.marque + '<nav class="xpl-l" aria-label="Navigation">' + liens(ctx, 'xpl-a') + '</nav><div class="xpl-d">' + cta(spec, ctx, 'xpl-c') + ctx.burger + '</div></div></div>' + ctx.menuMobile + '</header>';
  },
  css: function () { const c = 'r-nav-x-pilule'; return `
.${c},.r.${c}{position:fixed;top:14px;left:0;right:0;z-index:50;background:transparent;color:var(--encre);--tx:var(--encre);pointer-events:none}
.${c}>.w{pointer-events:auto;transition:transform .55s var(--ease)}
.${c}.range>.w{transform:translateY(calc(-100% - 20px))}
.${c} .xpl-in{display:flex;align-items:center;gap:22px;padding:8px 8px 8px 20px;border-radius:999px;background:color-mix(in srgb,var(--fond) 82%,transparent);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border:1px solid color-mix(in srgb,var(--encre) 9%,transparent);box-shadow:0 1px 2px rgb(16 24 40 / .05),0 18px 40px -24px rgb(16 24 40 / .35);transition:box-shadow .4s}
.${c} .xpl-l{display:flex;gap:4px;margin-left:auto;font-weight:var(--fxf);font-size:.94rem}
.${c} .xpl-a{text-decoration:none;padding:10px 14px;border-radius:999px;transition:background-color .3s}
.${c} .xpl-a:hover{background:color-mix(in srgb,var(--encre) 7%,transparent)}
.${c} .xpl-d{display:flex;align-items:center;gap:8px}
.${c} .btn{min-height:44px;padding:0 18px;border-radius:999px;font-size:.92rem}
.${c} .marque img{height:38px}
.${c} .marque .mono{width:36px;height:36px;border-radius:50%}
.${c} .marque .nm{font-size:1.12rem}
.${c} .burger{width:44px;height:44px;border-radius:999px}
.${c} .burger span{left:13px;right:13px}.${c} .burger span:nth-child(1){top:16px}.${c} .burger span:nth-child(2){top:21px}.${c} .burger span:nth-child(3){top:26px}
.${c} .burger[aria-expanded=true] span:nth-child(1),.${c} .burger[aria-expanded=true] span:nth-child(3){top:21px}
@media(max-width:900px){.${c} .xpl-l{display:none}.${c} .xpl-d{margin-left:auto}.${c} .xpl-in{padding-left:14px}}
@media(max-width:420px){.${c}>.w .btn .bt{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.${c}>.w .btn{padding:0 13px}}
`; }
};

const minimal = {
  id: 'nav.x-minimal', rubrique: 'nav', x: true, nom: 'Minimal, menu plein écran', quand: 'templates épurés : le nom, le bouton d\'action et un bouton Menu, même sur ordinateur',
  surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    return '<header class="' + h.classes('nav.x-minimal', bloc, bloc && bloc.surPhoto ? 'sur-photo' : '') + '" data-tete="cache"><div class="w xm">' + ctx.marque + '<div class="xm-d">' + cta(spec, ctx, 'xm-c') + '<span class="xm-mot" aria-hidden="true">Menu</span>' + ctx.burger + '</div></div>' + ctx.menuMobile + '</header>';
  },
  css: function () { const c = 'r-nav-x-minimal'; return socle(c) + `
.${c} .xm{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:88px;transition:min-height .45s var(--ease)}
.${c}.defile .xm{min-height:70px}
.${c} .xm-d{display:flex;align-items:center;gap:12px}
.${c} .xm-mot{font-weight:var(--fxf);font-size:.9rem;letter-spacing:.08em;text-transform:uppercase;margin-left:10px}
.${c} .burger{display:block}
@media(min-width:901px){.${c} .menu-m{display:flex}.${c} .menu-m nav a{font-size:clamp(2.6rem,5vw,4.4rem)}}
@media(max-width:600px){.${c} .xm-mot{display:none}}
`; }
};

module.exports = [barre, centre, pilule, minimal];
