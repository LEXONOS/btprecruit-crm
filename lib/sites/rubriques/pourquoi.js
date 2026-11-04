// Pourquoi nous choisir : les engagements de la fiche (deux à quatre, un titre et une ligne), mis en scène de huit façons
// (bande de nuit aux lampes qui s'allument, photo et liste qui se coche, fil qui se dessine au défilement, manifeste,
// mosaïque au bloc de couleur, titres géants qui défilent, pastilles qui tournent, liste typographique géante).
// Rien d'inventé : les titres et les lignes des atouts, et la vraie note Google quand elle existe.
'use strict';

const TT = 'font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);';
// l'état « vu » du socle pose clip-path:inset(0), qui efface ombres et anneaux de focus : une fois vu, plus de découpe
function vu(cls) { return '.js .' + cls + ' [data-r].vu{clip-path:none}'; }
const REVELE = 'opacity var(--dur) var(--ease) calc(var(--i,0) * var(--pas)),transform var(--dur) var(--ease) calc(var(--i,0) * var(--pas))';

// une vraie nuit : le champ de la palette est sombre (une palette au champ jaune ou vif n'a pas de « nuit »)
const LUM = require('../theme').lum;
function nuitPossible(ctx) { return !!(ctx.palette && /^#[0-9a-f]{6}$/i.test(ctx.palette.champ)) && LUM(ctx.palette.champ) < 0.06; }
function atouts(spec, ctx) { return ctx.h.atouts(spec); }
function assez(spec, ctx) { return atouts(spec, ctx).length >= 2; }
function titreSec(ctx) { return ctx.mod.textes.pourquoi; }
function section(id, ctx, bloc, extra, attrs, corps) { return '<section class="' + ctx.h.classes(id, bloc, 'sec' + (extra ? ' ' + extra : '')) + '" id="pourquoi"' + (attrs || '') + '>' + ctx.h.fond(bloc) + corps + '</section>'; }
function icone(ctx, a) { return ctx.h.icone(ctx.h.iconeDe(a, 'check')); }
function sansPoint(t) { return String(t).replace(/[\s.!?…:;,]+$/, ''); }
// une photo encore libre (comme h.photos, mais une illustration d'abord : la galerie montre déjà celles de l'entreprise)
function libres(ctx) {
  const a = ctx.alloc;
  const pris = new Set([a.hero, a.apropos, a.bandeau].concat(Object.keys(a.services).map(function (k) { return a.services[k]; })).concat(ctx.prises || []).filter(Boolean));
  return { reste: a.reste.filter(function (p) { return !pris.has(p); }), galerie: a.galerie.filter(function (p) { return !pris.has(p); }) };
}
function photoLibre(ctx) { const l = libres(ctx); return l.reste[0] || l.galerie[l.galerie.length - 1] || null; }
function prendrePhoto(ctx) { const p = photoLibre(ctx); if (p) ctx.prises = (ctx.prises || []).concat([p]); return p; }

/* ── 1. la bande de nuit : grandes icônes qui s'allument, une lumière suit la souris ── */
const nuit = {
  id: 'pourquoi.nuit', rubrique: 'pourquoi', nom: 'Bande de nuit, lampes qui s\'allument',
  quand: 'pour une bande sombre au milieu de la page : chaque engagement sous une grande icône lumineuse qui s\'allume à l\'arrivée, une lumière douce suit la souris',
  familles: [], ambiances: ['premium', 'franc', 'calme'], surfaces: ['champ'], js: ['halo'],
  besoin: function (spec, ctx) { return assez(spec, ctx) && nuitPossible(ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx);
    const items = a.map(function (x, k) { return '<li' + h.rv('monte', k) + '><span class="pn-lampe" aria-hidden="true">' + icone(ctx, x) + '</span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('');
    return section('pourquoi.nuit', ctx, bloc, '', ' data-halo data-defile', '<div class="w">' + h.teteSec(titreSec(ctx), null, { classe: 'c' }) + '<ul class="pn n' + a.length + '">' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-pourquoi-nuit')}
.r-pourquoi-nuit{overflow:hidden}
.r-pourquoi-nuit::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(640px circle at var(--mx,78%) var(--my,10%),color-mix(in srgb,var(--acc) 17%,transparent),transparent 62%)}
.r-pourquoi-nuit .pn{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.r-pourquoi-nuit .pn.n2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:900px;margin-inline:auto}
.r-pourquoi-nuit .pn.n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.r-pourquoi-nuit .pn li{display:grid;justify-items:center;align-content:start;gap:12px;text-align:center;padding:8px clamp(18px,3vw,44px)}
.r-pourquoi-nuit .pn li+li{border-left:1px solid var(--bord)}
.r-pourquoi-nuit .pn-lampe{position:relative;width:96px;height:96px;display:grid;place-items:center;margin-bottom:12px;color:var(--acc)}
.r-pourquoi-nuit .pn-lampe::before{content:"";position:absolute;inset:10px;border-radius:50%;border:1px solid color-mix(in srgb,var(--acc) 45%,transparent);background:color-mix(in srgb,var(--acc) 8%,transparent);box-shadow:0 0 34px color-mix(in srgb,var(--acc) 30%,transparent),inset 0 0 22px color-mix(in srgb,var(--acc) 22%,transparent)}
.r-pourquoi-nuit .pn-lampe::after{content:"";position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--acc) 26%,transparent),transparent 68%);animation:k-pourquoi-nuit-souffle 4.6s ease-in-out infinite}
.r-pourquoi-nuit .pn li:nth-child(2) .pn-lampe::after{animation-delay:-1.5s}
.r-pourquoi-nuit .pn li:nth-child(3) .pn-lampe::after{animation-delay:-3s}
.r-pourquoi-nuit.arret .pn-lampe::after{animation-play-state:paused}
.r-pourquoi-nuit .pn-lampe .ic{position:relative;width:42px;height:42px;stroke-width:1.4;filter:drop-shadow(0 0 8px color-mix(in srgb,var(--acc) 85%,transparent))}
.js .r-pourquoi-nuit .pn li.vu .pn-lampe{animation:k-pourquoi-nuit-allume 1.6s steps(1,end) calc(.35s + var(--i,0) * .3s) backwards}
.r-pourquoi-nuit .pn h3{${TT}font-size:clamp(1.35rem,1.9vw,1.75rem);line-height:var(--th)}
.r-pourquoi-nuit .pn p{color:var(--tx2);max-width:30ch}
@keyframes k-pourquoi-nuit-souffle{0%,100%{opacity:.55;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}
@keyframes k-pourquoi-nuit-allume{0%{opacity:.1}10%{opacity:1}16%{opacity:.25}25%{opacity:1}33%{opacity:.4}42%,100%{opacity:1}}
@media(prefers-reduced-motion:reduce){.r-pourquoi-nuit .pn-lampe::after,.js .r-pourquoi-nuit .pn li.vu .pn-lampe{animation:none}}
@media(max-width:980px){.r-pourquoi-nuit .pn.n4{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:40px}.r-pourquoi-nuit .pn.n4 li:nth-child(3){border-left:0}}
@media(max-width:700px){.r-pourquoi-nuit .pn,.r-pourquoi-nuit .pn.n2,.r-pourquoi-nuit .pn.n4{grid-template-columns:1fr;row-gap:0}.r-pourquoi-nuit .pn li{padding:26px 0}.r-pourquoi-nuit .pn li+li{border-left:0;border-top:1px solid var(--bord)}}
`; }
};

/* ── 2. la photo et la liste qui se coche une à une ── */
const photo = {
  id: 'pourquoi.photo', rubrique: 'pourquoi', nom: 'Photo et liste qui se coche',
  quand: 'une photo libre (de l\'entreprise ou d\'illustration) d\'un côté, de l\'autre les engagements qui se cochent un à un, la note Google posée sur la photo si elle est bonne',
  familles: [], ambiances: ['chaleureux', 'calme', 'franc'], surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return assez(spec, ctx) && !!photoLibre(ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx), p = prendrePhoto(ctx), g = h.noteGoogle(spec);
    const note = g ? '<div class="pp-note">' + h.etoiles(g.note) + '<span><b>' + h.noteTexte(g) + '</b> sur Google</span><span>' + g.avis + ' avis</span></div>' : '';
    const vis = p ? '<div class="pp-vis"' + h.rv('mots') + '><div class="pp-cadre">' + h.figure(p, 'lazy', '(max-width:860px) 100vw, 44vw') + '</div>' + note + '</div>' : '';
    const items = a.map(function (x, k) { return '<li' + h.rv('monte', k) + '><svg class="pp-ck" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.5" pathLength="1"/><path d="M8.5 14.4l3.6 3.6 7.4-7.6" pathLength="1"/></svg><div><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</div></li>'; }).join('');
    return section('pourquoi.photo', ctx, bloc, '', '', '<div class="w pp' + (p ? '' : ' sans') + '">' + vis + '<div class="pp-tx">' + h.teteSec(titreSec(ctx)) + '<ul class="pp-l">' + items + '</ul><div' + h.rv('monte', a.length) + '>' + h.boutons(spec, { seule: true }) + '</div></div></div>');
  },
  css: function () { return `
${vu('r-pourquoi-photo')}
.r-pourquoi-photo .pp{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:clamp(36px,6vw,104px);align-items:center}
.r-pourquoi-photo .pp.sans{grid-template-columns:minmax(0,1fr);max-width:760px}
.r-pourquoi-photo .pp-tx .tete-sec{margin-inline:0;text-align:left;justify-items:start}
.r-pourquoi-photo .pp-vis{position:relative;padding-bottom:28px}
.r-pourquoi-photo .pp-cadre{padding:clamp(10px,1.2vw,16px);background:var(--carte);border:1px solid var(--bord);border-radius:calc(var(--rp) + 8px);box-shadow:var(--ombreF);rotate:-1.2deg;transition:rotate 1.2s var(--ease)}
.r-pourquoi-photo .pp-vis:hover .pp-cadre{rotate:0deg}
.r-pourquoi-photo .pp-cadre .ph{aspect-ratio:4/5}
.r-pourquoi-photo .pp-cadre .ph img{transition:transform 1.6s var(--ease)}
.js .r-pourquoi-photo .pp-cadre .ph{transition:clip-path 1.5s var(--ease)}
.js .r-pourquoi-photo .pp-vis:not(.vu) .pp-cadre .ph{clip-path:inset(0 0 100% 0)}
.js .r-pourquoi-photo .pp-vis:not(.vu) .pp-cadre .ph img{transform:scale(1.15)}
.r-pourquoi-photo .pp-note{position:absolute;right:clamp(-18px,-1.6vw,-8px);bottom:0;display:grid;gap:4px;padding:16px 20px;border-radius:var(--r);background:var(--carte);color:var(--tx);box-shadow:var(--ombreF);font-size:.95rem;line-height:1.3}
.r-pourquoi-photo .pp-note b{${TT}font-size:1.6rem}
.js .r-pourquoi-photo .pp-note{transition:opacity .8s var(--ease) .9s,translate 1s var(--ease) .9s}
.js .r-pourquoi-photo .pp-vis:not(.vu) .pp-note{opacity:0;translate:0 16px}
.r-pourquoi-photo .pp-l{display:grid;gap:4px;margin-bottom:clamp(24px,3vw,36px)}
.r-pourquoi-photo .pp-l li{display:grid;grid-template-columns:34px minmax(0,1fr);gap:16px;align-items:start;padding:16px 0;border-bottom:1px solid var(--bord)}
.r-pourquoi-photo .pp-ck{width:34px;height:34px;overflow:visible}
.r-pourquoi-photo .pp-ck circle{fill:color-mix(in srgb,var(--acc) 12%,transparent);stroke:var(--acc);stroke-width:1.6;stroke-dasharray:1;stroke-dashoffset:0}
.r-pourquoi-photo .pp-ck path{fill:none;stroke:var(--accT);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:0}
.js .r-pourquoi-photo .pp-l li .pp-ck circle{transition:stroke-dashoffset .9s var(--ease) calc(.2s + var(--i,0) * .32s),fill .6s calc(.6s + var(--i,0) * .32s)}
.js .r-pourquoi-photo .pp-l li .pp-ck path{transition:stroke-dashoffset .55s var(--ease) calc(.75s + var(--i,0) * .32s)}
.js .r-pourquoi-photo .pp-l li:not(.vu) .pp-ck circle{stroke-dashoffset:1;fill:transparent}
.js .r-pourquoi-photo .pp-l li:not(.vu) .pp-ck path{stroke-dashoffset:1}
.r-pourquoi-photo .pp-l h3{${TT}font-size:clamp(1.25rem,1.7vw,1.55rem);line-height:var(--th);margin-bottom:4px}
.r-pourquoi-photo .pp-l p{color:var(--tx2)}
@media(prefers-reduced-motion:reduce){.js .r-pourquoi-photo .pp-cadre .ph,.js .r-pourquoi-photo .pp-note,.js .r-pourquoi-photo .pp-l li .pp-ck circle,.js .r-pourquoi-photo .pp-l li .pp-ck path{transition:none}}
@media(max-width:860px){.r-pourquoi-photo .pp{grid-template-columns:1fr}.r-pourquoi-photo .pp-vis{width:min(100%,440px)}.r-pourquoi-photo .pp-note{right:8px}}
`; }
};

/* ── 3. le fil : les icônes reliées par un trait qui se dessine au défilement ── */
const fil = {
  id: 'pourquoi.fil', rubrique: 'pourquoi', nom: 'Icônes reliées par un fil',
  quand: 'deux à quatre engagements : des icônes en cercle reliées par un trait qui se dessine au fil du défilement, chaque icône s\'allume quand le trait l\'atteint (vertical sur téléphone)',
  familles: ['atelier', 'cabinet', 'verdure', 'garage', 'horizon', 'boutique'], ambiances: ['franc', 'calme'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: assez,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx);
    const items = a.map(function (x, k) { return '<li class="pf-it"' + h.rv('monte', k) + '><span class="pf-n" aria-hidden="true">' + icone(ctx, x) + '</span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('');
    return section('pourquoi.fil', ctx, bloc, '', '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="pf-z" style="--n:' + a.length + '"><i class="pf-fil" aria-hidden="true"><b></b></i><ul class="pf">' + items + '</ul></div></div>');
  },
  // le trait suit le défilement (mesuré sur les vraies positions des icônes) ; sans mouvement, il est tracé d'office
  script: "[].slice.call(d.querySelectorAll('.r-pourquoi-fil .pf-z')).forEach(function(f){var ns=[].slice.call(f.querySelectorAll('.pf-n'));if(!ns.length)return;var seuils=[],hz=true,tk=0,vis=true,a=0,l=1;var geo=function(){hz=w.matchMedia('(min-width:761px)').matches;var rf=f.getBoundingClientRect();var cs=ns.map(function(n){var r=n.getBoundingClientRect();return hz?(r.left+r.width/2-rf.left):(r.top+r.height/2-rf.top)});a=cs[0];var z=cs[cs.length-1];l=Math.max(1,z-a);f.style.setProperty('--a',a.toFixed(1)+'px');f.style.setProperty('--l',l.toFixed(1)+'px');seuils=cs.map(function(c){return (c-a)/l})};var maj=function(){tk=0;var p=1;if(!calme){var r=f.getBoundingClientRect(),h=w.innerHeight;p=hz?(h*.86-r.top)/(h*.46):(h*.64-r.top-a)/l;p=Math.max(0,Math.min(1,p))}f.style.setProperty('--p',p.toFixed(3));ns.forEach(function(n,i){n.classList.toggle('on',p>=seuils[i]-.002)})};geo();maj();w.addEventListener('resize',function(){geo();maj()});w.addEventListener('load',function(){geo();maj()});if(calme)return;if('IntersectionObserver' in w)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)maj()}).observe(f);w.addEventListener('scroll',function(){if(vis&&!tk){tk=1;requestAnimationFrame(maj)}},{passive:true})})",
  css: function () { return `
${vu('r-pourquoi-fil')}
.r-pourquoi-fil .pf-z{position:relative}
.r-pourquoi-fil .pf{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:clamp(24px,3vw,48px)}
.r-pourquoi-fil .pf-fil{position:absolute;top:39px;left:var(--a,calc(50% / var(--n)));width:var(--l,calc(100% - 100% / var(--n)));height:2px;border-radius:2px;background:var(--bord);pointer-events:none}
.r-pourquoi-fil .pf-fil b{position:absolute;inset:0;border-radius:inherit;background:var(--acc);transform-origin:left;transform:scaleX(var(--p,1))}
.r-pourquoi-fil .pf-fil b::after{content:"";position:absolute;right:-5px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 6px color-mix(in srgb,var(--acc) 22%,transparent)}
.r-pourquoi-fil .pf-it{position:relative;display:grid;justify-items:center;align-content:start;gap:12px;text-align:center}
.r-pourquoi-fil .pf-n{position:relative;z-index:1;width:80px;height:80px;display:grid;place-items:center;margin-bottom:8px;border-radius:50%;border:2px solid var(--btn);background:var(--btn);color:var(--btnT);transition:background-color .5s,color .5s,border-color .5s,transform .7s var(--ease)}
.r-pourquoi-fil .pf-n .ic{width:32px;height:32px;stroke-width:1.6}
.r-pourquoi-fil .pf-n::after{content:"";position:absolute;inset:-9px;border-radius:50%;border:2px solid var(--acc);opacity:.3;transition:opacity .6s,transform .8s var(--ease)}
.js .r-pourquoi-fil .pf-n:not(.on){background:var(--bg);border-color:var(--bord);color:var(--tx2);transform:scale(.92)}
.js .r-pourquoi-fil .pf-n:not(.on)::after{opacity:0;transform:scale(.8)}
.r-pourquoi-fil .pf-it h3{${TT}font-size:clamp(1.3rem,1.8vw,1.65rem);line-height:var(--th)}
.r-pourquoi-fil .pf-it p{color:var(--tx2);max-width:30ch}
@media(max-width:760px){.r-pourquoi-fil .pf{grid-template-columns:1fr;gap:34px}.r-pourquoi-fil .pf-fil{left:39px;top:var(--a,40px);width:2px;height:var(--l,calc(100% - 80px))}.r-pourquoi-fil .pf-fil b{transform-origin:top;transform:scaleY(var(--p,1))}.r-pourquoi-fil .pf-fil b::after{right:auto;top:auto;left:50%;bottom:-5px;margin:0 0 0 -5px}.r-pourquoi-fil .pf-it{grid-template-columns:80px minmax(0,1fr);justify-items:start;text-align:left;gap:4px 20px}.r-pourquoi-fil .pf-n{grid-row:1/3;margin:0}.r-pourquoi-fil .pf-it h3{align-self:end}}
`; }
};

/* ── 4. le manifeste : une grande phrase faite des titres, le détail à côté ── */
const manifeste = {
  id: 'pourquoi.manifeste', rubrique: 'pourquoi', nom: 'Manifeste en une grande phrase',
  quand: 'deux à quatre engagements aux titres courts et forts : leurs titres forment une grande phrase qui s\'éclaire à la lecture, le détail de chacun à côté (survoler l\'un éclaire l\'autre)',
  familles: [], ambiances: ['premium', 'calme', 'franc'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { const a = atouts(spec, ctx); return a.length >= 2 && a.every(function (x) { return ctx.h.net(x.titre).length <= 38; }); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx);
    const phrase = a.map(function (x) { return '<span class="mf-s">' + h.esc(sansPoint(h.net(x.titre))) + '.</span>'; }).join(' ');
    const det = a.map(function (x, k) { return '<li' + h.rv('monte', k) + '><span class="mf-ic" aria-hidden="true">' + icone(ctx, x) + '</span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('');
    return section('pourquoi.manifeste', ctx, bloc, '', '', '<div class="w mf"><div class="mf-g"><h2 class="t mf-h"' + h.rv('monte') + '>' + h.esc(titreSec(ctx)) + '</h2><p class="mf-ph"' + h.rv('monte', 1) + '>' + phrase + '</p></div><ul class="mf-d">' + det + '</ul></div>');
  },
  // la phrase se lit : chaque morceau s'éclaire en passant aux deux tiers de l'écran (tout s'éclaire en bas de page)
  script: "[].slice.call(d.querySelectorAll('.r-pourquoi-manifeste .mf-ph')).forEach(function(p){var ss=[].slice.call(p.querySelectorAll('.mf-s'));if(calme||!ss.length)return;p.classList.add('mf-lit');var vis=true,tk=0;var maj=function(){tk=0;var h=w.innerHeight,fin=(w.scrollY||0)+h>=d.documentElement.scrollHeight-8;ss.forEach(function(s){var r=s.getBoundingClientRect();s.classList.toggle('lu',fin||r.top+r.height*.5<h*.7)})};if('IntersectionObserver' in w)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)maj()}).observe(p);w.addEventListener('scroll',function(){if(vis&&!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});maj()})",
  css: function () {
    const lien = [1, 2, 3, 4].map(function (k) { return '.r-pourquoi-manifeste .mf:has(.mf-d li:nth-child(' + k + '):hover) .mf-s:nth-child(' + k + '){color:var(--accT);opacity:1}.r-pourquoi-manifeste .mf:has(.mf-s:nth-child(' + k + '):hover) .mf-d li:nth-child(' + k + ') .mf-ic{background:var(--btn);color:var(--btnT);transform:rotate(-8deg)}'; }).join('\n');
    return `
${vu('r-pourquoi-manifeste')}
.r-pourquoi-manifeste .mf{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:clamp(32px,6vw,100px);align-items:end}
.r-pourquoi-manifeste .mf-h{font-size:clamp(1.15rem,1.5vw,1.4rem);line-height:1.2;color:var(--accT);margin-bottom:clamp(18px,2.4vw,30px)}
.r-pourquoi-manifeste .mf-ph{${TT}font-size:clamp(2.1rem,4.7vw,5rem);line-height:1.02;text-wrap:balance;hyphens:manual}
.r-pourquoi-manifeste .mf-s{transition:opacity 1s var(--ease),color .4s}
.r-pourquoi-manifeste .mf-ph.mf-lit .mf-s:not(.lu){opacity:.2}
.r-pourquoi-manifeste .mf-d{display:grid;border-top:1px solid var(--bord)}
.r-pourquoi-manifeste .mf-d li{display:grid;grid-template-columns:46px minmax(0,1fr);gap:2px 18px;align-items:start;padding:20px 0;border-bottom:1px solid var(--bord)}
.r-pourquoi-manifeste .mf-ic{grid-row:1/3;width:46px;height:46px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--acc) 14%,transparent);color:var(--accT);transition:background-color .4s,color .4s,transform .6s var(--ease)}
.r-pourquoi-manifeste .mf-d li:hover .mf-ic{background:var(--btn);color:var(--btnT);transform:rotate(-8deg)}
.r-pourquoi-manifeste .mf-d h3{font-size:1.1rem;line-height:1.3}
.r-pourquoi-manifeste .mf-d p{color:var(--tx2)}
${lien}
@media(max-width:860px){.r-pourquoi-manifeste .mf{grid-template-columns:1fr;align-items:start}.r-pourquoi-manifeste .mf-ph{font-size:clamp(2rem,8.4vw,3.2rem)}}
`; }
};

/* ── 5. la mosaïque : un bloc de couleur et les engagements autour ── */
const mosaique = {
  id: 'pourquoi.mosaique', rubrique: 'pourquoi', nom: 'Mosaïque au bloc de couleur',
  quand: 'deux à quatre engagements : une disposition asymétrique, un grand bloc de couleur porte le titre (et la vraie note Google si elle est bonne), les engagements en tuiles autour',
  familles: ['boutique', 'atelier', 'verdure', 'comptoir', 'cabinet', 'garage'], ambiances: ['franc', 'chaleureux'], surfaces: ['fond', 'surface'], js: [],
  besoin: assez,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx), g = h.noteGoogle(spec);
    const note = g ? '<div class="mo-note">' + h.etoiles(g.note) + '<p><b>' + h.noteTexte(g) + '</b> sur Google</p><p>' + g.avis + ' avis</p></div>' : '';
    const surf = bloc && bloc.surface === 'accent' ? 's-champ' : 's-accent';
    const blocCouleur = '<div class="mo-bloc ' + surf + '"' + h.rv('zoom') + '><span class="mo-fant" aria-hidden="true">' + h.icone(ctx.iconeMetier || 'etoile') + '</span><h2 class="t">' + h.esc(titreSec(ctx)) + '</h2>' + note + '</div>';
    const tuiles = a.map(function (x, k) { return '<li class="mo-c mo-' + (k + 1) + (k === a.length - 1 && a.length > 2 ? ' mo-creux' : '') + '"' + h.rv('monte', k + 1) + '><span class="mo-ic" aria-hidden="true">' + icone(ctx, x) + '</span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('');
    return section('pourquoi.mosaique', ctx, bloc, '', '', '<div class="w"><div class="mo n' + a.length + '">' + blocCouleur + '<ul class="mo-l">' + tuiles + '</ul></div></div>');
  },
  css: function () { return `
${vu('r-pourquoi-mosaique')}
.r-pourquoi-mosaique .mo{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,2fr);gap:clamp(12px,1.4vw,18px)}
.r-pourquoi-mosaique .mo-bloc{position:relative;isolation:isolate;overflow:hidden;display:grid;align-content:space-between;gap:32px;min-height:clamp(320px,30vw,440px);padding:clamp(28px,3.4vw,48px);border-radius:var(--rp);background:var(--bg);color:var(--tx)}
.r-pourquoi-mosaique .mo-bloc h2.t{font-size:clamp(2rem,3.5vw,3.4rem);max-width:12ch}
.r-pourquoi-mosaique .mo-fant{position:absolute;right:-14%;bottom:-16%;z-index:-1;width:74%;aspect-ratio:1;opacity:.15;transform:rotate(-14deg);transition:transform 1.8s var(--ease)}
.r-pourquoi-mosaique .mo-fant .ic{width:100%;height:100%;stroke-width:1}
.r-pourquoi-mosaique .mo-bloc:hover .mo-fant{transform:rotate(0deg) scale(1.06)}
.r-pourquoi-mosaique .mo-note{display:grid;gap:2px;justify-items:start}
.r-pourquoi-mosaique .mo-note .etoiles .ic{width:20px;height:20px}
.r-pourquoi-mosaique .mo-note .etoiles .vd .ic{fill:currentColor;opacity:.3}
.r-pourquoi-mosaique .mo-note p{font-size:1rem;color:var(--tx2)}
.r-pourquoi-mosaique .mo-note b{${TT}font-size:2.6rem;line-height:1;color:var(--tx);margin-right:4px}
.r-pourquoi-mosaique .mo-l{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(12px,1.4vw,18px)}
.r-pourquoi-mosaique .n2 .mo-c{grid-column:span 2}
.r-pourquoi-mosaique .n3 .mo-1{grid-column:span 2}
.r-pourquoi-mosaique .mo-c{display:grid;gap:10px;align-content:start;padding:clamp(24px,2.6vw,34px);border-radius:var(--rp);background:var(--carte);border:1px solid var(--bord);transition:${REVELE},translate .6s var(--ease),box-shadow .6s var(--ease)}
.r-pourquoi-mosaique .mo-c:hover{translate:0 -5px;box-shadow:var(--ombreF)}
.r-pourquoi-mosaique .mo-c.mo-creux{background:transparent;border:1.5px solid color-mix(in srgb,var(--acc) 45%,transparent)}
.r-pourquoi-mosaique .mo-ic{width:50px;height:50px;display:grid;place-items:center;border-radius:var(--rb);background:color-mix(in srgb,var(--acc) 14%,transparent);color:var(--accT);transition:transform .6s var(--ease)}
.r-pourquoi-mosaique .mo-c:hover .mo-ic{transform:rotate(-8deg) scale(1.06)}
.r-pourquoi-mosaique .mo-c h3{${TT}font-size:clamp(1.3rem,1.8vw,1.65rem);line-height:var(--th)}
.r-pourquoi-mosaique .mo-c p{color:var(--tx2)}
.r-pourquoi-mosaique .n3 .mo-1 p,.r-pourquoi-mosaique .n2 .mo-c p{max-width:52ch}
@media(max-width:860px){.r-pourquoi-mosaique .mo{grid-template-columns:1fr}.r-pourquoi-mosaique .mo-bloc{min-height:clamp(190px,50vw,280px)}.r-pourquoi-mosaique .mo-fant{width:46%;right:-6%;bottom:-18%}}
@media(max-width:560px){.r-pourquoi-mosaique .mo-l{grid-template-columns:1fr}.r-pourquoi-mosaique .mo-l .mo-c{grid-column:auto}}
`; }
};

/* ── 6. le défilé : les titres en très grand qui passent lentement ── */
const defile = {
  id: 'pourquoi.defile', rubrique: 'pourquoi', nom: 'Titres géants qui défilent',
  quand: 'deux à quatre engagements courts : leurs titres en très grand passent lentement sur deux rubans en sens contraires (le second en lettres creuses), le détail est posé dessous',
  familles: ['boutique', 'garage', 'atelier', 'horizon', 'comptoir', 'verdure'], ambiances: ['franc', 'chaleureux'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { const a = atouts(spec, ctx); return a.length >= 2 && a.every(function (x) { return ctx.h.net(x.titre).length <= 34; }); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx), sep = '<span class="pd-sep">' + h.icone(ctx.iconeMetier || 'etoile') + '</span>';
    const total = a.reduce(function (n, x) { return n + h.net(x.titre).length; }, 0);
    const tour = a.map(function (x) { return '<span class="pd-t">' + h.esc(sansPoint(h.net(x.titre))) + '</span>' + sep; }).join('');
    const groupe = '<div class="pd-g">' + (total < 44 ? tour + tour : tour) + '</div>';
    const ruban = function (cls) { return '<div class="pd-ru' + cls + '">' + groupe + groupe + '</div>'; };
    const det = a.map(function (x, k) { return '<li' + h.rv('monte', k) + '><span class="pd-ic" aria-hidden="true">' + icone(ctx, x) + '</span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('');
    return section('pourquoi.defile', ctx, bloc, '', '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '</div><div class="pd-bande" aria-hidden="true" data-defile>' + ruban('') + ruban(' inv') + '</div><div class="w"><ul class="pd-l n' + a.length + '">' + det + '</ul></div>');
  },
  css: function () { return `
${vu('r-pourquoi-defile')}
.r-pourquoi-defile{overflow:hidden}
.r-pourquoi-defile .pd-bande{display:grid;gap:clamp(2px,.6vw,8px);width:112%;margin:clamp(6px,1vw,14px) 0 clamp(40px,5vw,72px) -6%;padding-block:clamp(14px,2vw,26px);transform:rotate(-2.4deg);border-block:1px solid var(--bord);background:color-mix(in srgb,var(--acc) 6%,transparent)}
.r-pourquoi-defile .pd-ru{display:flex;width:max-content;animation:k-pourquoi-defile-va 80s linear infinite}
.r-pourquoi-defile .pd-ru.inv{animation-name:k-pourquoi-defile-vient;animation-duration:96s}
.r-pourquoi-defile .pd-bande.arret .pd-ru{animation-play-state:paused}
.r-pourquoi-defile .pd-g{display:flex;align-items:center;flex:none}
.r-pourquoi-defile .pd-t{${TT}font-size:clamp(2.6rem,7vw,6.6rem);line-height:1.08;white-space:nowrap;padding-inline:.3em}
.r-pourquoi-defile .pd-ru.inv .pd-t{color:transparent;-webkit-text-stroke:1.5px var(--tx)}
.r-pourquoi-defile .pd-sep{display:grid;place-items:center;color:var(--accT)}
.r-pourquoi-defile .pd-sep .ic{width:clamp(26px,3.6vw,56px);height:clamp(26px,3.6vw,56px);stroke-width:1.6}
.r-pourquoi-defile .pd-ru.inv .pd-sep{color:var(--tx2)}
.r-pourquoi-defile .pd-l{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(24px,3vw,48px)}
.r-pourquoi-defile .pd-l.n2{grid-template-columns:repeat(2,minmax(0,1fr))}
.r-pourquoi-defile .pd-l.n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.r-pourquoi-defile .pd-l li{display:grid;gap:10px;align-content:start;padding-top:22px;border-top:2px solid var(--tx)}
.r-pourquoi-defile .pd-ic{width:46px;height:46px;display:grid;place-items:center;border-radius:var(--rb);background:var(--btn);color:var(--btnT)}
.r-pourquoi-defile .pd-l h3{${TT}font-size:clamp(1.3rem,1.8vw,1.65rem);line-height:var(--th)}
.r-pourquoi-defile .pd-l p{color:var(--tx2)}
@keyframes k-pourquoi-defile-va{to{transform:translate3d(-50%,0,0)}}
@keyframes k-pourquoi-defile-vient{from{transform:translate3d(-50%,0,0)}to{transform:none}}
@media(prefers-reduced-motion:reduce){.r-pourquoi-defile .pd-ru{animation:none}}
@media(max-width:980px){.r-pourquoi-defile .pd-l.n4{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.r-pourquoi-defile .pd-l,.r-pourquoi-defile .pd-l.n2,.r-pourquoi-defile .pd-l.n4{grid-template-columns:1fr}}
`; }
};

/* ── 7. les pastilles : des sceaux ronds dont le texte tourne doucement ── */
const pastilles = {
  id: 'pourquoi.pastilles', rubrique: 'pourquoi', nom: 'Pastilles rondes qui tournent',
  quand: 'deux à quatre engagements : chacun devient un sceau rond, son titre écrit autour d\'une icône et qui tourne lentement, le titre et la ligne dessous',
  familles: ['ecrin', 'comptoir', 'verdure', 'horizon', 'boutique'], ambiances: ['chaleureux', 'premium', 'calme'], surfaces: ['surface', 'fond', 'champ'], js: [],
  besoin: assez,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx);
    const items = a.map(function (x, k) {
      const t = sansPoint(h.net(x.titre)).toUpperCase(), n = Math.max(1, Math.round(58 / (t.length + 3)));
      let tour = ''; for (let i = 0; i < n; i++) tour += t + ' • ';
      return '<li' + h.rv('zoom', k) + '><span class="ps-o" aria-hidden="true"><svg class="ps-tour" viewBox="0 0 200 200"><defs><path id="pastille-' + (k + 1) + '" d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1-160 0"/></defs><circle class="ps-fil" cx="100" cy="100" r="66"/><text><textPath href="#pastille-' + (k + 1) + '" textLength="500" lengthAdjust="spacing">' + h.esc(tour) + '</textPath></text></svg><span class="ps-c">' + icone(ctx, x) + '</span></span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>';
    }).join('');
    return section('pourquoi.pastilles', ctx, bloc, '', ' data-defile', '<div class="w">' + h.teteSec(titreSec(ctx), null, { classe: 'c' }) + '<ul class="ps n' + a.length + '">' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-pourquoi-pastilles')}
.r-pourquoi-pastilles .ps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(36px,4vw,60px) clamp(20px,3vw,44px)}
.r-pourquoi-pastilles .ps.n2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:820px;margin-inline:auto}
.r-pourquoi-pastilles .ps.n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.r-pourquoi-pastilles .ps li{display:grid;justify-items:center;align-content:start;gap:12px;text-align:center}
.r-pourquoi-pastilles .ps-o{position:relative;width:clamp(160px,15vw,200px);aspect-ratio:1;display:grid;place-items:center;margin-bottom:14px}
.r-pourquoi-pastilles .ps-tour{position:absolute;inset:0;width:100%;height:100%;overflow:visible;animation:k-pourquoi-pastilles-tour 32s linear infinite}
.r-pourquoi-pastilles .ps li:nth-child(even) .ps-tour{animation-direction:reverse}
.r-pourquoi-pastilles.arret .ps-tour{animation-play-state:paused}
.r-pourquoi-pastilles .ps-tour text{font-family:var(--fx);font-weight:var(--fxf);font-size:13px;fill:var(--tx)}
.r-pourquoi-pastilles .ps-fil{fill:none;stroke:var(--bord);stroke-width:1.2;stroke-dasharray:2 5}
.r-pourquoi-pastilles .ps-c{position:relative;width:50%;aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);box-shadow:0 0 0 9px color-mix(in srgb,var(--btn) 14%,transparent),0 18px 34px -16px color-mix(in srgb,var(--btn) 70%,#000);transition:transform .8s var(--ease)}
.r-pourquoi-pastilles .ps li:hover .ps-c{transform:scale(1.08) rotate(-10deg)}
.r-pourquoi-pastilles .ps-c .ic{width:42%;height:42%;stroke-width:1.6}
.r-pourquoi-pastilles .ps h3{${TT}font-size:clamp(1.3rem,1.8vw,1.65rem);line-height:var(--th)}
.r-pourquoi-pastilles .ps p{color:var(--tx2);max-width:30ch}
@keyframes k-pourquoi-pastilles-tour{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.r-pourquoi-pastilles .ps-tour{animation:none}}
@media(max-width:980px){.r-pourquoi-pastilles .ps.n4{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.r-pourquoi-pastilles .ps,.r-pourquoi-pastilles .ps.n2,.r-pourquoi-pastilles .ps.n4{grid-template-columns:1fr}}
`; }
};

/* ── 8. la liste géante : chaque titre en très grand, il s'éclaire au survol ── */
const geante = {
  id: 'pourquoi.geante', rubrique: 'pourquoi', nom: 'Liste typographique géante',
  quand: 'deux à quatre engagements : leurs titres en très grandes lettres l\'un sous l\'autre, celui qu\'on survole s\'emplit de couleur et les autres s\'effacent, la ligne de détail à côté',
  familles: [], ambiances: ['premium', 'franc', 'calme'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { const a = atouts(spec, ctx); return a.length >= 2 && a.every(function (x) { return ctx.h.net(x.titre).length <= 40; }); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = atouts(spec, ctx);
    const items = a.map(function (x, k) { const t = h.net(x.titre); return '<li' + h.rv('monte', k) + '><h3 class="pg-t" style="--hk:' + h.kUne(t, ctx.type) + '">' + h.esc(t) + '</h3>' + (h.net(x.texte) ? '<p class="pg-x">' + icone(ctx, x) + '<span>' + h.esc(h.net(x.texte)) + '</span></p>' : '<p class="pg-x">' + icone(ctx, x) + '</p>') + '</li>'; }).join('');
    return section('pourquoi.geante', ctx, bloc, '', '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<ul class="pg">' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-pourquoi-geante')}
.r-pourquoi-geante .pg{container-type:inline-size;border-top:1px solid var(--bord)}
.r-pourquoi-geante .pg li{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,32ch);gap:12px clamp(24px,4vw,64px);align-items:center;padding:clamp(18px,2.4vw,32px) 0;border-bottom:1px solid var(--bord)}
.r-pourquoi-geante .pg li::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform 1s var(--ease)}
.r-pourquoi-geante .pg li:hover::after{transform:scaleX(1)}
.r-pourquoi-geante .pg-t{${TT}font-size:max(2rem,min(6.2rem,calc(66cqi / var(--hk))));line-height:.98;transition:opacity .5s,transform .8s var(--ease)}
.r-pourquoi-geante .pg-x{display:flex;gap:12px;align-items:flex-start;color:var(--tx2);font-size:1.05rem;transition:color .4s}
.r-pourquoi-geante .pg-x .ic{flex:none;margin-top:3px;color:var(--accT);transition:transform .6s var(--ease)}
.r-pourquoi-geante .pg li:hover .pg-x{color:var(--tx)}
.r-pourquoi-geante .pg li:hover .pg-x .ic{transform:rotate(-10deg) scale(1.15)}
@media(hover:hover){.r-pourquoi-geante .pg:hover li:not(:hover) .pg-t{opacity:.26}.r-pourquoi-geante .pg li:hover .pg-t{transform:translateX(12px)}}
@supports ((-webkit-background-clip:text) or (background-clip:text)){.r-pourquoi-geante .pg-t{background:linear-gradient(90deg,var(--accT) 0 50%,var(--tx) 50% 100%) 100% 0/200% 100% no-repeat;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;transition:background-position 1s var(--ease),opacity .5s,transform .8s var(--ease)}.r-pourquoi-geante .pg li:hover .pg-t{background-position:0 0}}
@media(max-width:760px){.r-pourquoi-geante .pg li{grid-template-columns:1fr}.r-pourquoi-geante .pg-t{font-size:max(1.9rem,min(3.4rem,calc(100cqi / var(--hk))))}}
`; }
};

module.exports = [nuit, photo, fil, manifeste, mosaique, defile, pastilles, geante];
