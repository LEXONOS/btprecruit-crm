// Services des templates : ce que fait l'entreprise, lisible d'un coup d'œil, chaque service avec son bouton (WhatsApp
// avec le service déjà écrit dans le message). Neuf dessins : liste éditoriale (photo qui suit le pointeur), cartes,
// titre collé, accordéon, bento, piste qu'on fait glisser, carte façon menu, rangées alternées, grille à filets.
'use strict';
const K = require('./x-kit');

function tete(spec, ctx, o) { return K.tete(ctx, Object.assign({ sur: K.surDe(ctx, 'services', 'Services'), titre: ctx.textes.services, phrase: null }, o || {})); }
function lien(spec, ctx, s, cls, contenu) { const l = K.lienService(spec, ctx, s); return l ? '<a class="' + cls + '" href="' + ctx.h.esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : '') + ' aria-label="' + ctx.h.esc(l.texte + ' : ' + s.titre) + '">' + (contenu || ctx.h.esc(l.texte) + ctx.h.icone('fleche')) + '</a>' : ''; }
const deux = function (spec, ctx) { return K.services(spec, ctx).length >= 2; };
const JS = ['progres', 'parallaxe'];

/* ── 1. la liste éditoriale, la photo du service suit le pointeur ── */
const liste = {
  id: 'services.x-liste', rubrique: 'services', x: true, nom: 'Liste éditoriale', quand: 'deux à six services : de grands titres numérotés à filets ; avec des photos, celle du service survolé suit le pointeur',
  surfaces: ['fond', 'surface', 'teinte'], js: ['suivi'], besoin: deux,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx), ph = s.filter(function (x) { return x.photo; });
    const fig = ph.length >= 2 ? '<div class="xl-fig" data-suivi-fig aria-hidden="true">' + ph.map(function (x) { return '<span data-suivi-img="' + x.k + '">' + h.img(x.photo, 'lazy', '320px') + '</span>'; }).join('') + '</div>' : '';
    const lignes = s.map(function (x, k) { return '<li class="xl-li" data-suivi-k="' + x.k + '"' + h.rv('monte', k) + '><span class="xl-n">' + K.num(k) + '</span><h3 class="xl-t">' + h.esc(x.titre) + '</h3><p class="xl-p">' + h.esc(x.texte) + '</p>' + lien(spec, ctx, x, 'xl-a') + '</li>'; }).join('');
    return K.section(ctx, 'services.x-liste', bloc, 'sec', 'services') + '<div class="w">' + tete(spec, ctx, { phrase: h.lieuCourt(spec) }) + '<div class="xl-c" data-suivi><ol class="xl-l">' + lignes + '</ol>' + fig + '</div></div></section>';
  },
  css: function () { const c = 'r-services-x-liste'; return `
.${c} .xl-c{position:relative}
.${c} .xl-l{border-top:var(--x-trait,1px solid var(--bord))}
.${c} .xl-li{display:grid;grid-template-columns:70px minmax(0,1.1fr) minmax(0,1fr) auto;align-items:center;gap:12px clamp(20px,3vw,48px);padding:clamp(22px,2.6vw,34px) 0;border-bottom:var(--x-trait,1px solid var(--bord));transition:padding .5s var(--ease)}
.${c} .xl-n{font-family:var(--ft);font-size:.95rem;color:var(--accT);font-variant-numeric:tabular-nums}
.${c} .xl-t{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.55rem,3vw,2.6rem);line-height:1.04;transition:transform .55s var(--ease)}
.${c} .xl-p{color:var(--tx2);max-width:46ch}
.${c} .xl-a{display:inline-flex;align-items:center;gap:8px;font-weight:var(--fxf);text-decoration:none;white-space:nowrap;padding:10px 0}
.${c} .xl-a .ic{width:18px;height:18px;transition:transform .45s var(--ease)}
.${c} .xl-li:hover .xl-t{transform:translateX(12px)}
.${c} .xl-li:hover .xl-a .ic{transform:translateX(5px)}
.${c} .xl-fig{position:absolute;left:0;top:0;width:260px;aspect-ratio:4/5;margin:-130px 0 0 -130px;pointer-events:none;z-index:2;opacity:0;scale:.85;transition:opacity .35s,scale .45s var(--ease);border-radius:var(--x-r,14px);overflow:hidden;box-shadow:var(--ombreF)}
.${c} .xl-fig.on{opacity:1;scale:1}
.${c} .xl-fig span{position:absolute;inset:0;opacity:0;transition:opacity .3s}
.${c} .xl-fig span.on{opacity:1}
.${c} .xl-fig img{width:100%;height:100%;object-fit:cover}
@media(max-width:860px){.${c} .xl-li{grid-template-columns:44px minmax(0,1fr);align-items:start}.${c} .xl-p,.${c} .xl-a{grid-column:2}.${c} .xl-fig{display:none}}
`; }
};

/* ── 2. les cartes : photo en haut, ou un grand numéro sur une carte teintée ── */
const cartes = {
  id: 'services.x-cartes', rubrique: 'services', x: true, nom: 'Cartes', quand: 'deux à six services : une carte chacun, sa photo en haut s\'il en a une, sinon un grand numéro sur un fond teinté',
  surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: deux,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx), photos = !!K.servicesAvecPhotos(spec, ctx);
    const items = s.map(function (x, k) {
      return '<li class="xc-i' + (photos ? ' avec' : '') + '"' + h.rv('monte', k) + '>' + (photos ? h.figure(x.photo, 'lazy', '(max-width:700px) 100vw, 33vw', { classe: 'xc-ph' }) : '<span class="xc-n" aria-hidden="true">' + K.num(k) + '</span>') + '<div class="xc-tx"><h3>' + h.esc(x.titre) + '</h3><p>' + h.esc(x.texte) + '</p>' + lien(spec, ctx, x, 'xc-a') + '</div></li>';
    }).join('');
    return K.section(ctx, 'services.x-cartes', bloc, 'sec', 'services') + '<div class="w">' + tete(spec, ctx) + '<ul class="xc-l n' + s.length + '">' + items + '</ul></div></section>';
  },
  css: function () { const c = 'r-services-x-cartes'; return `
.${c} .xc-l{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,1.8vw,24px)}
.${c} .xc-l.n2,.${c} .xc-l.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.${c} .xc-i{display:flex;flex-direction:column;border-radius:var(--x-rc,18px);background:var(--carte);border:1px solid var(--bord);overflow:hidden;transition:transform .55s var(--ease),box-shadow .55s var(--ease)}
.${c} .xc-i:not(.avec){background:color-mix(in srgb,var(--acc) 7%,var(--carte));border-color:transparent}
.${c} .xc-i:hover{transform:translateY(-6px);box-shadow:var(--ombreF)}
.${c} .xc-ph{aspect-ratio:4/3;border-radius:0}
.${c} .xc-ph img{transition:scale 1.1s var(--ease)}
.${c} .xc-i:hover .xc-ph img{scale:1.06}
.${c} .xc-n{display:block;padding:clamp(22px,2.4vw,30px) clamp(22px,2.4vw,30px) 0;font-family:var(--ft);font-weight:var(--tp);font-size:clamp(2.6rem,4.6vw,4rem);line-height:1;color:var(--accT);letter-spacing:-.03em}
.${c} .xc-tx{display:grid;gap:10px;align-content:start;flex:1;padding:clamp(20px,2.4vw,30px)}
.${c} .xc-tx h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.3rem,1.9vw,1.6rem);line-height:1.1}
.${c} .xc-tx p{color:var(--tx2)}
.${c} .xc-a{display:inline-flex;align-items:center;gap:8px;margin-top:6px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.${c} .xc-a .ic{width:18px;height:18px;transition:transform .45s var(--ease)}.${c} .xc-a:hover .ic{transform:translateX(5px)}
@media(max-width:900px){.${c} .xc-l{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.${c} .xc-l,.${c} .xc-l.n2,.${c} .xc-l.n4{grid-template-columns:1fr}}
`; }
};

/* ── 3. le titre collé à gauche, les services défilent à droite ── */
const colle = {
  id: 'services.x-colle', rubrique: 'services', x: true, nom: 'Titre collé', quand: 'trois à six services : le titre et le bouton restent collés à gauche pendant que les services défilent à droite, chacun avec sa photo s\'il en a une',
  surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: function (spec, ctx) { return K.services(spec, ctx).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const items = s.map(function (x, k) { return '<li class="xo-i"' + h.rv('monte') + '>' + (x.photo ? h.figure(x.photo, 'lazy', '(max-width:860px) 100vw, 40vw', { classe: 'xo-ph' }) : '') + '<div class="xo-tx"><span class="xo-n">' + K.num(k) + '</span><h3>' + h.esc(x.titre) + '</h3><p>' + h.esc(x.texte) + '</p>' + (x.detail ? '<p class="xo-d">' + h.esc(x.detail) + '</p>' : '') + '</div></li>'; }).join('');
    return K.section(ctx, 'services.x-colle', bloc, 'sec', 'services') + '<div class="w xo"><div class="xo-g"><div class="xo-c">' + tete(spec, ctx, { phrase: h.lieuCourt(spec) }) + '<div' + h.rv('monte', 3) + '>' + K.bouton(spec, ctx) + '</div></div></div><ol class="xo-l">' + items + '</ol></div></section>';
  },
  css: function () { const c = 'r-services-x-colle'; return `
.${c} .xo{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:clamp(32px,6vw,100px);align-items:start}
.${c} .xo-c{position:sticky;top:120px;display:grid;gap:8px}
.${c} .xo-c .x-tete{margin-bottom:18px}
.${c} .xo-l{display:grid;gap:clamp(28px,3.4vw,48px)}
.${c} .xo-i{display:grid;gap:18px;padding-bottom:clamp(28px,3.4vw,48px);border-bottom:var(--x-trait,1px solid var(--bord))}
.${c} .xo-i:last-child{border-bottom:0;padding-bottom:0}
.${c} .xo-ph{aspect-ratio:16/10;border-radius:var(--x-r,16px)}
.${c} .xo-tx{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:18px;row-gap:8px}
.${c} .xo-n{grid-row:1/span 3;font-family:var(--ft);font-size:.95rem;color:var(--accT);padding-top:.45em}
.${c} .xo-tx h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.5rem,2.6vw,2.2rem);line-height:1.06}
.${c} .xo-tx p{color:var(--tx2)}
.${c} .xo-d{font-size:.96rem}
@media(max-width:860px){.${c} .xo{grid-template-columns:1fr}.${c} .xo-c{position:static}}
`; }
};

/* ── 4. l'accordéon : un service ouvert à la fois, sans script (details) ── */
const accordeon = {
  id: 'services.x-accordeon', rubrique: 'services', x: true, nom: 'Accordéon', quand: 'deux à six services à détailler : une liste qui s\'ouvre, le premier ouvert, sa photo et son bouton à l\'intérieur',
  surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: deux,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const items = s.map(function (x, k) { return '<details class="xa-i"' + (k === 0 ? ' open' : '') + h.rv('monte', k) + '><summary><span class="xa-n">' + K.num(k) + '</span><h3>' + h.esc(x.titre) + '</h3><span class="xa-pl" aria-hidden="true"></span></summary><div class="xa-c">' + (x.photo ? h.figure(x.photo, 'lazy', '(max-width:860px) 100vw, 30vw', { classe: 'xa-ph' }) : '') + '<div class="xa-tx"><p>' + h.esc(x.texte) + '</p>' + (x.detail ? '<p class="xa-d">' + h.esc(x.detail) + '</p>' : '') + lien(spec, ctx, x, 'xa-a') + '</div></div></details>'; }).join('');
    return K.section(ctx, 'services.x-accordeon', bloc, 'sec', 'services') + '<div class="w xa"><div>' + tete(spec, ctx, { phrase: h.lieuCourt(spec) }) + '</div><div class="xa-l">' + items + '</div></div></section>';
  },
  css: function () { const c = 'r-services-x-accordeon'; return `
.${c} .xa{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,90px);align-items:start}
.${c} .xa-l{border-top:var(--x-trait,1px solid var(--bord))}
.${c} .xa-i{border-bottom:var(--x-trait,1px solid var(--bord))}
.${c} summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px;padding:clamp(18px,2.2vw,26px) 0;cursor:pointer;list-style:none}
.${c} summary::-webkit-details-marker{display:none}
.${c} .xa-n{font-family:var(--ft);font-size:.92rem;color:var(--accT)}
.${c} summary h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.35rem,2.4vw,2rem);line-height:1.08;transition:color .3s}
.${c} summary:hover h3{color:var(--accT)}
.${c} .xa-pl{position:relative;width:38px;height:38px;border-radius:50%;border:1px solid var(--bord);transition:background-color .35s,border-color .35s,transform .5s var(--ease)}
.${c} .xa-pl::before,.${c} .xa-pl::after{content:"";position:absolute;left:50%;top:50%;width:13px;height:1.6px;background:currentColor;translate:-50% -50%;transition:rotate .45s var(--ease)}
.${c} .xa-pl::after{rotate:90deg}
.${c} .xa-i[open] .xa-pl{background:var(--btn);color:var(--btnT);border-color:var(--btn);transform:rotate(180deg)}
.${c} .xa-i[open] .xa-pl::after{rotate:0deg}
.${c} .xa-c{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(18px,2.4vw,32px);padding:0 0 clamp(22px,2.6vw,32px) calc(18px + 2ch)}
.${c} .xa-c:not(:has(.xa-ph)){grid-template-columns:1fr}
.${c} .xa-ph{aspect-ratio:4/3;border-radius:var(--x-r,14px)}
.${c} .xa-tx{display:grid;gap:12px;align-content:start}
.${c} .xa-tx p{color:var(--tx2)}
.${c} .xa-a{display:inline-flex;align-items:center;gap:8px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.${c} .xa-a .ic{width:18px;height:18px}
.${c} .xa-i[open] .xa-c{animation:k-xa-ouvre .6s var(--ease)}
@keyframes k-xa-ouvre{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@media(max-width:860px){.${c} .xa{grid-template-columns:1fr}.${c} .xa-c{grid-template-columns:1fr;padding-left:0}}
@media(prefers-reduced-motion:reduce){.${c} .xa-i[open] .xa-c{animation:none}}
`; }
};

/* ── 5. le bento : le premier service en grand ── */
const bento = {
  id: 'services.x-bento', rubrique: 'services', x: true, nom: 'Bento', quand: 'trois à six services : une grille asymétrique, le premier service en grande tuile (photo si on l\'a), les autres autour',
  surfaces: ['fond', 'surface'], js: [], besoin: function (spec, ctx) { return K.services(spec, ctx).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const items = s.map(function (x, k) {
      const p = x.photo;
      return '<li class="xbe-i' + (k === 0 ? ' g' : '') + (p ? ' ph' : '') + '"' + h.rv('zoom', k) + '>' + (p ? h.figure(p, 'lazy', k === 0 ? '(max-width:860px) 100vw, 50vw' : '(max-width:860px) 100vw, 25vw', { classe: 'xbe-f' }) : '<span class="xbe-ic">' + h.icone(x.icone) + '</span>') + '<div class="xbe-tx"><h3>' + h.esc(x.titre) + '</h3><p>' + h.esc(x.texte) + '</p></div>' + lien(spec, ctx, x, 'xbe-a', h.icone('fleche')) + '</li>';
    }).join('');
    return K.section(ctx, 'services.x-bento', bloc, 'sec', 'services') + '<div class="w">' + tete(spec, ctx) + '<ul class="xbe-l n' + s.length + '">' + items + '</ul></div></section>';
  },
  css: function () { const c = 'r-services-x-bento'; return `
.${c} .xbe-l{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(220px,auto);gap:clamp(12px,1.4vw,18px)}
.${c} .xbe-i{position:relative;isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:clamp(20px,2.2vw,28px);border-radius:var(--x-rc,20px);background:var(--carte);border:1px solid var(--bord);overflow:hidden}
.${c} .xbe-i.g{grid-column:span 2;grid-row:span 2}
.${c} .xbe-l.n3 .xbe-i:not(.g),.${c} .xbe-l.n5 .xbe-i:nth-child(n+4){grid-column:span 2}
.${c} .xbe-i.ph{color:#fff;border:0;min-height:260px}
.${c} .xbe-f{position:absolute;inset:0;z-index:-2;border-radius:0}
.${c} .xbe-f img{transition:scale 1.2s var(--ease)}
.${c} .xbe-i.ph::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / 0) 35%,rgb(var(--voile) / .78))}
.${c} .xbe-i:hover .xbe-f img{scale:1.06}
.${c} .xbe-i:not(.ph):nth-child(3n+2){background:var(--teinte);border-color:transparent}
.${c} .xbe-ic{position:absolute;top:clamp(20px,2.2vw,28px);left:clamp(20px,2.2vw,28px);width:52px;height:52px;display:grid;place-items:center;border-radius:14px;background:var(--fond);color:var(--accentT)}
.${c} .xbe-ic .ic{width:26px;height:26px}
.${c} .xbe-tx{display:grid;gap:8px;max-width:44ch}
.${c} .xbe-tx h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.25rem,1.8vw,1.55rem);line-height:1.1}
.${c} .xbe-i.g .xbe-tx h3{font-size:clamp(1.6rem,2.8vw,2.4rem)}
.${c} .xbe-tx p{color:var(--tx2)}
.${c} .xbe-i.ph .xbe-tx p{color:rgb(255 255 255 / .88)}
.${c} .xbe-a{position:absolute;top:clamp(16px,2vw,22px);right:clamp(16px,2vw,22px);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--fond);color:var(--encre);transition:transform .5s var(--ease),background-color .3s}
.${c} .xbe-a .ic{width:18px;height:18px;rotate:-45deg;transition:rotate .5s var(--ease)}
.${c} .xbe-i:hover .xbe-a .ic{rotate:0deg}
@media(max-width:860px){.${c} .xbe-l{grid-template-columns:1fr 1fr;grid-auto-rows:minmax(200px,auto)}.${c} .xbe-i.g,.${c} .xbe-l .xbe-i{grid-column:span 2;grid-row:auto}}
`; }
};

/* ── 6. la piste : de grandes cartes qu'on fait glisser ── */
const piste = {
  id: 'services.x-piste', rubrique: 'services', x: true, nom: 'Piste qui glisse', quand: 'trois à six services (sorties, séjours, prestations) : de grandes cartes en hauteur qu\'on fait glisser au doigt ou à la souris, flèches à côté du titre',
  surfaces: ['fond', 'surface'], js: ['carrousel', 'glisse'], besoin: function (spec, ctx) { return K.services(spec, ctx).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const items = s.map(function (x, k) { return '<li class="xpi-i' + (x.photo ? ' ph' : '') + '">' + (x.photo ? h.figure(x.photo, 'lazy', '(max-width:700px) 80vw, 30vw', { classe: 'xpi-f' }) : '<span class="xpi-n" aria-hidden="true">' + K.num(k) + '</span>') + '<div class="xpi-tx"><h3>' + h.esc(x.titre) + '</h3><p>' + h.esc(x.texte) + '</p>' + lien(spec, ctx, x, 'xpi-a') + '</div></li>'; }).join('');
    const fl = '<div class="xpi-fl"><button type="button" data-prec aria-label="Précédent">' + h.icone('fleche') + '</button><button type="button" data-suiv aria-label="Suivant">' + h.icone('fleche') + '</button></div>';
    return K.section(ctx, 'services.x-piste', bloc, 'sec', 'services') + '<div data-carrousel><div class="w xpi-h">' + tete(spec, ctx) + fl + '</div><ul class="xpi-l" data-piste data-glisse>' + items + '</ul></div></section>';
  },
  css: function () { const c = 'r-services-x-piste'; return `
.${c}{overflow:hidden}
.${c} .xpi-h{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.${c} .xpi-h .x-tete{margin-bottom:clamp(28px,3.4vw,48px)}
.${c} .xpi-fl{display:flex;gap:10px;margin-bottom:clamp(28px,3.4vw,48px)}
.${c} .xpi-fl button{width:52px;height:52px;border-radius:50%;border:1px solid var(--bord);background:transparent;color:var(--tx);display:grid;place-items:center;cursor:pointer;transition:background-color .3s,color .3s,opacity .3s}
.${c} .xpi-fl button:first-child .ic{rotate:180deg}
.${c} .xpi-fl button:hover:not(:disabled){background:var(--btn);color:var(--btnT);border-color:var(--btn)}
.${c} .xpi-fl button:disabled{opacity:.35;cursor:default}
.${c} .xpi-l{display:grid;grid-auto-flow:column;grid-auto-columns:min(420px,78vw);gap:clamp(14px,1.6vw,22px);overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:max(var(--g),calc((100vw - var(--w)) / 2));padding:4px max(var(--g),calc((100vw - var(--w)) / 2)) 10px;scrollbar-width:none;cursor:grab}
.${c} .xpi-l::-webkit-scrollbar{display:none}
.${c} .xpi-l.tire{cursor:grabbing;scroll-snap-type:none}
.${c} .xpi-i{position:relative;isolation:isolate;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:flex-end;min-height:clamp(420px,52vh,560px);padding:clamp(22px,2.4vw,30px);border-radius:var(--x-rc,22px);background:var(--teinte);overflow:hidden;user-select:none}
.${c} .xpi-i.ph{color:#fff}
.${c} .xpi-f{position:absolute;inset:0;z-index:-2;border-radius:0}
.${c} .xpi-f img{pointer-events:none;transition:scale 1.2s var(--ease)}
.${c} .xpi-i.ph::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / 0) 40%,rgb(var(--voile) / .82))}
.${c} .xpi-i:hover .xpi-f img{scale:1.05}
.${c} .xpi-n{position:absolute;top:clamp(18px,2vw,26px);left:clamp(22px,2.4vw,30px);font-family:var(--ft);font-weight:var(--tp);font-size:clamp(3.4rem,6vw,5.4rem);line-height:1;color:var(--teinteT);opacity:.85}
.${c} .xpi-tx{display:grid;gap:10px}
.${c} .xpi-tx h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.5rem,2.4vw,2rem);line-height:1.06}
.${c} .xpi-tx p{color:var(--tx2)}
.${c} .xpi-i.ph .xpi-tx p{color:rgb(255 255 255 / .88)}
.${c} .xpi-a{display:inline-flex;align-items:center;gap:8px;margin-top:4px;font-weight:var(--fxf);text-decoration:none;color:inherit}
.${c} .xpi-a .ic{width:18px;height:18px}
@media(max-width:600px){.${c} .xpi-fl{display:none}}
`; }
};

/* ── 7. la carte, comme un menu (tables, soins, prestations) ── */
const carte = {
  id: 'services.x-carte', rubrique: 'services', x: true, nom: 'Carte façon menu', quand: 'tables, soins, prestations : la liste comme une carte, en deux colonnes, les titres reliés par des points à leur bouton, une ligne en italique dessous',
  surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: deux,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const items = s.map(function (x, k) { const l = K.lienService(spec, ctx, x); return '<li' + h.rv('monte', k % 2) + '><div class="xm-h"><h3>' + h.esc(x.titre) + '</h3><span class="xm-pts" aria-hidden="true"></span>' + (l ? '<a href="' + h.esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : '') + ' aria-label="' + h.esc(l.texte + ' : ' + x.titre) + '">' + h.esc(l.texte) + '</a>' : '') + '</div><p>' + h.esc(x.texte) + '</p></li>'; }).join('');
    return K.section(ctx, 'services.x-carte', bloc, 'sec', 'services') + '<div class="w xm">' + tete(spec, ctx, { cls: 'c' }) + '<ul class="xm-l">' + items + '</ul></div></section>';
  },
  css: function () { const c = 'r-services-x-carte'; return `
.${c} .x-tete{text-align:center;justify-items:center;margin-inline:auto}
.${c} .xm-l{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(26px,3vw,40px) clamp(40px,6vw,96px);max-width:1080px;margin-inline:auto}
.${c} .xm-l li{display:grid;gap:8px}
.${c} .xm-h{display:flex;align-items:baseline;gap:12px}
.${c} .xm-h h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.25rem,1.9vw,1.6rem);line-height:1.15}
.${c} .xm-pts{flex:1;min-width:24px;border-bottom:2px dotted color-mix(in srgb,var(--tx) 30%,transparent);translate:0 -.3em}
.${c} .xm-h a{flex:none;font-size:.9rem;font-weight:var(--fxf);color:var(--accT);text-decoration:none;letter-spacing:.02em}
.${c} .xm-h a:hover{text-decoration:underline}
.${c} .xm-l p{color:var(--tx2);font-style:italic}
@media(max-width:760px){.${c} .xm-l{grid-template-columns:1fr}}
`; }
};

/* ── 8. les rangées alternées : photo et texte ── */
const zigzag = {
  id: 'services.x-zigzag', rubrique: 'services', x: true, nom: 'Rangées alternées', quand: 'deux à cinq services qui ont chacun leur photo : une rangée par service, photo et texte en alternance, la photo qui glisse doucement',
  surfaces: ['fond', 'surface'], js: ['parallaxe'],
  besoin: function (spec, ctx) { const s = K.servicesAvecPhotos(spec, ctx); return !!s && s.length >= 2 && s.length <= 5; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const items = s.map(function (x, k) { return '<li class="xz-i' + (k % 2 ? ' inv' : '') + '"><div class="xz-v" data-r="store">' + '<div data-px="0.06">' + h.figure(x.photo, 'lazy', '(max-width:860px) 100vw, 52vw', { classe: 'xz-ph' }) + '</div></div><div class="xz-tx"' + h.rv('monte', 1) + '><span class="xz-n">' + K.num(k) + '</span><h3>' + h.esc(x.titre) + '</h3><p>' + h.esc(x.texte) + '</p>' + (x.detail ? '<p class="xz-d">' + h.esc(x.detail) + '</p>' : '') + lien(spec, ctx, x, 'xz-a') + '</div></li>'; }).join('');
    return K.section(ctx, 'services.x-zigzag', bloc, 'sec', 'services') + '<div class="w">' + tete(spec, ctx, { phrase: h.lieuCourt(spec) }) + '<ul class="xz-l">' + items + '</ul></div></section>';
  },
  css: function () { const c = 'r-services-x-zigzag'; return `
.${c} .xz-l{display:grid;gap:clamp(48px,7vw,110px)}
.${c} .xz-i{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:center;gap:clamp(28px,5vw,80px)}
.${c} .xz-i.inv .xz-v{order:2}
.${c} .xz-v{border-radius:var(--x-r,18px);overflow:hidden;aspect-ratio:5/4}
.${c} .xz-v>div{height:116%;margin-top:-8%}
.${c} .xz-ph{height:100%;border-radius:0}
.${c} .xz-tx{display:grid;gap:14px;align-content:center}
.${c} .xz-n{font-family:var(--ft);font-size:1rem;color:var(--accT)}
.${c} .xz-tx h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.8rem,3.4vw,3rem);line-height:1.02}
.${c} .xz-tx p{color:var(--tx2);font-size:1.06rem;max-width:44ch}
.${c} .xz-d{font-size:.98rem!important}
.${c} .xz-a{display:inline-flex;align-items:center;gap:8px;font-weight:var(--fxf);color:var(--accT);text-decoration:none;margin-top:4px}
.${c} .xz-a .ic{width:18px;height:18px;transition:transform .45s var(--ease)}.${c} .xz-a:hover .ic{transform:translateX(5px)}
@media(max-width:860px){.${c} .xz-i{grid-template-columns:1fr}.${c} .xz-i.inv .xz-v{order:0}.${c} .xz-v{aspect-ratio:4/3}}
`; }
};

/* ── 9. la grille à filets, façon suisse ── */
const grille = {
  id: 'services.x-grille', rubrique: 'services', x: true, nom: 'Grille à filets', quand: 'deux à six services, sans photo ou presque : une grille à filets fins, le numéro et l\'icône en coin, un fond qui monte au survol',
  surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: deux,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const items = s.map(function (x, k) { return '<li' + h.rv('monte', k % 3) + '><div class="xg-h"><span>' + K.num(k) + '</span>' + h.icone(x.icone) + '</div><h3>' + h.esc(x.titre) + '</h3><p>' + h.esc(x.texte) + '</p>' + lien(spec, ctx, x, 'xg-a') + '</li>'; }).join('');
    return K.section(ctx, 'services.x-grille', bloc, 'sec', 'services') + '<div class="w">' + tete(spec, ctx, { phrase: h.lieuCourt(spec) }) + '<ul class="xg-l n' + s.length + '">' + items + '</ul></div></section>';
  },
  css: function () { const c = 'r-services-x-grille'; return `
.${c} .xg-l{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:var(--x-trait,1px solid var(--bord));border-left:var(--x-trait,1px solid var(--bord))}
.${c} .xg-l.n2,.${c} .xg-l.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.${c} .xg-l li{position:relative;isolation:isolate;display:grid;gap:12px;align-content:start;padding:clamp(24px,2.8vw,40px);border-right:var(--x-trait,1px solid var(--bord));border-bottom:var(--x-trait,1px solid var(--bord));min-height:240px}
.${c} .xg-l li::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--teinte);transform:scaleY(0);transform-origin:bottom;transition:transform .6s var(--ease)}
.${c} .xg-l li:hover::before{transform:none}
.${c} .xg-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:clamp(18px,3vw,40px);font-family:var(--ft);color:var(--accT)}
.${c} .xg-h .ic{width:26px;height:26px}
.${c} .xg-l h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.35rem,2vw,1.75rem);line-height:1.08}
.${c} .xg-l p{color:var(--tx2)}
.${c} .xg-a{display:inline-flex;align-items:center;gap:8px;font-weight:var(--fxf);color:var(--accT);text-decoration:none;margin-top:4px}
.${c} .xg-a .ic{width:18px;height:18px}
@media(max-width:900px){.${c} .xg-l{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.${c} .xg-l,.${c} .xg-l.n2,.${c} .xg-l.n4{grid-template-columns:1fr}.${c} .xg-l li{min-height:0}}
`; }
};

module.exports = [liste, cartes, colle, accordeon, bento, piste, carte, zigzag, grille];
