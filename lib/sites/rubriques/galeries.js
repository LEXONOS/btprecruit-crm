// Les galeries : seulement les photos de l'entreprise (ctx.alloc.galerie), jamais une photo d'illustration. Six mises
// en scène : la piste qu'on fait glisser, le mur qui glisse en colonnes, les deux rangées qui défilent, la planche qui
// s'ouvre en grand, les tirages posés sur la table, la grille bento. Une galerie ne remontre jamais une photo déjà vue
// plus haut sur la page (même fichier) ; celles qu'elle montre sont notées par h.img / h.figure : une autre rubrique ne
// les reprend pas. S'il en reste trop peu, la galerie ne se montre pas (le rendu passe alors à la galerie du socle).
'use strict';

/* ── petits outils ── */
// le rapport largeur / hauteur d'une photo (borné : une photo très longue ne casse pas la mise en page)
function ar(p) { const r = p && p.l && p.h ? p.l / p.h : 1.5; return Math.max(0.62, Math.min(2.2, r)).toFixed(3); }
// une légende seulement si le texte alternatif de sa photo est un vrai texte (pas un nom de fichier)
function legende(h, p) {
  const t = h.net(p && p.alt);
  if (!t || t.length > 48 || !/\p{L}{3}/u.test(t) || /\.(jpe?g|png|webp|gif|avif)$/i.test(t) || /^(img|dsc|dcim|image|photo|pxl|screenshot|capture)[\s_-]*\d/i.test(t)) return '';
  return h.majuscule(t);
}
// la clé d'une photo : son fichier (deux fiches peuvent porter le même)
function cleP(p) { return (p && (p.fichier || p.url)) || p; }
// les photos de l'entreprise pour la galerie (n au plus) : chaque fichier une fois, jamais un fichier réservé à une autre
// rubrique (héros, présentation, services, bandeau), jamais une photo déjà montrée plus haut sur la page
function siennes(ctx, n) {
  const a = ctx.alloc || {}, h = ctx.h, res = new Set(), vus = new Set(), out = [];
  [a.hero, a.apropos, a.bandeau].concat(Object.keys(a.services || {}).map(function (k) { return a.services[k]; })).forEach(function (p) { if (p) res.add(cleP(p)); });
  (a.galerie || []).forEach(function (p) { const k = cleP(p); if (out.length < n && !res.has(k) && !vus.has(k) && !(h && h.vue && h.vue(p))) { vus.add(k); out.push(p); } });
  return out;
}
// les apparitions communes finissent sur clip-path:inset(0) : levé ici, pour ne rogner ni ombres, ni rubans, ni débords
function libre(cls) { return '.js .' + cls + ' [data-r].vu:not([data-r=rideau]):not([data-r=store]):not([data-r=iris]){clip-path:none}\n.' + cls + ' p{text-wrap:pretty}'; }
const PAUSE = '<svg class="ic gd-ip" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg><svg class="ic gd-il" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const CROIX = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/* ── 1. la piste qu'on fait glisser ── */
const carrousel = {
  id: 'galerie.carrousel', rubrique: 'galerie', nom: 'Carrousel', quand: 'trois photos à lui ou plus : une piste qui déborde de l\'écran, qu\'on fait glisser, flèches et barre de progression',
  surfaces: ['fond', 'surface', 'champ'], js: ['carrousel'],
  besoin: function (spec, ctx) { return siennes(ctx, 12).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = siennes(ctx, 12);
    if (ph.length < 3) return '';
    const diapos = ph.map(function (p, k) {
      const cap = legende(h, p);
      return '<figure class="gc-d"' + h.rv('droite', Math.min(k, 4)) + '><div class="ph gc-ph" style="--ar:' + ar(p) + '">' + h.img(p, 'lazy', '(max-width:700px) 86vw, 50vw', ' draggable="false"') + '</div>' + (cap ? '<figcaption>' + h.esc(cap) + '</figcaption>' : '') + '</figure>';
    }).join('');
    return '<section class="' + h.classes('galerie.carrousel', bloc, 'sec') + '" id="images" data-carrousel>' + h.fond(bloc) +
      '<div class="w">' + h.teteSec(ctx.mod.textes.galerie, 'Faites glisser pour voir toutes les photos.') + '</div>' +
      '<div class="gc-piste" data-piste tabindex="0" role="group" aria-label="Photos de ' + h.esc(h.net(spec.nom)) + '">' + diapos + '</div>' +
      '<div class="w gc-bas"' + h.rv('monte', 2) + '><div class="gc-barre" aria-hidden="true"><span></span></div><div class="gc-nav"><button class="gc-b gc-prec" type="button" data-prec aria-label="Photos précédentes">' + h.icone('fleche') + '</button><button class="gc-b" type="button" data-suiv aria-label="Photos suivantes">' + h.icone('fleche') + '</button></div></div></section>';
  },
  // la barre suit la lecture, chaque photo glisse un peu dans son cadre, la souris peut tirer la piste
  script: "[].slice.call(d.querySelectorAll('.r-galerie-carrousel')).forEach(function(s){var p=s.querySelector('[data-piste]'),br=s.querySelector('.gc-barre span');if(!p)return;var ims=[].slice.call(p.querySelectorAll('img')),tk=0;" +
    "var maj=function(){tk=0;var sw=p.scrollWidth;if(br)br.style.transform='scaleX('+(sw>0?Math.max(.06,Math.min(1,(p.scrollLeft+p.clientWidth)/sw)):1).toFixed(4)+')';if(calme)return;var r=p.getBoundingClientRect(),c=r.left+r.width/2;ims.forEach(function(i){var f=i.parentNode.getBoundingClientRect();if(f.right<r.left-80||f.left>r.right+80)return;var k=(f.left+f.width/2-c)/r.width;i.style.transform='translate3d('+(k*-6).toFixed(2)+'%,0,0) scale(1.12)'})};" +
    "p.addEventListener('scroll',function(){if(!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});w.addEventListener('resize',maj);maj();" +
    "if(!w.matchMedia('(hover:hover) and (pointer:fine)').matches)return;var x0=0,s0=0,on=false;p.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse'||e.button!==0)return;on=true;x0=e.clientX;s0=p.scrollLeft;p.classList.add('tire')});" +
    "w.addEventListener('pointermove',function(e){if(on)p.scrollLeft=s0-(e.clientX-x0)});w.addEventListener('pointerup',function(){if(!on)return;on=false;p.classList.remove('tire');var q=p.scrollLeft;p.scrollLeft=q+1;p.scrollLeft=q})})",
  css: function () { return `
${libre('r-galerie-carrousel')}
.r-galerie-carrousel{overflow:hidden}
.r-galerie-carrousel .gc-piste{--pad:max(var(--g),calc((100% - var(--w)) / 2));display:flex;align-items:flex-start;gap:clamp(12px,1.6vw,24px);overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:var(--pad);padding-inline:var(--pad);scrollbar-width:none;cursor:grab;outline-offset:-4px;user-select:none;-webkit-user-select:none}
.r-galerie-carrousel .gc-piste::-webkit-scrollbar{display:none}
.r-galerie-carrousel .gc-piste.tire{scroll-snap-type:none;cursor:grabbing}
.r-galerie-carrousel .gc-d{flex:none;scroll-snap-align:start;display:grid;gap:14px;margin:0}
.r-galerie-carrousel .gc-ph{height:clamp(300px,38vw,560px);aspect-ratio:var(--ar);max-width:min(84vw,940px)}
.r-galerie-carrousel .gc-ph img{transform:scale(1.12);will-change:transform;pointer-events:none}
.r-galerie-carrousel .gc-ph::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tx) 8%,transparent);pointer-events:none}
.r-galerie-carrousel figcaption{font-size:.98rem;color:var(--tx2);display:flex;align-items:center;gap:10px}
.r-galerie-carrousel figcaption::before{content:"";width:7px;height:7px;flex:none;background:var(--acc);border-radius:50%}
.r-galerie-carrousel .gc-bas{display:flex;align-items:center;gap:clamp(18px,3vw,40px);margin-top:clamp(24px,3vw,40px)}
.r-galerie-carrousel .gc-barre{flex:1;height:3px;border-radius:3px;background:var(--bord);position:relative;overflow:hidden}
.r-galerie-carrousel .gc-barre span{position:absolute;inset:0;background:var(--acc);transform-origin:left;transform:scaleX(.25);transition:transform .3s var(--ease)}
.r-galerie-carrousel .gc-nav{display:flex;gap:10px}
.r-galerie-carrousel .gc-b{width:58px;height:58px;border-radius:50%;border:1.5px solid var(--bord);background:var(--carte);color:var(--tx);display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .35s,color .35s,border-color .35s,opacity .3s,transform .45s var(--ease)}
.r-galerie-carrousel .gc-b .ic{width:22px;height:22px;transition:transform .45s var(--ease)}
.r-galerie-carrousel .gc-prec .ic{transform:scaleX(-1)}
.r-galerie-carrousel .gc-b:disabled{opacity:.32;cursor:default}
@media(hover:hover){.r-galerie-carrousel .gc-b:not(:disabled):hover{background:var(--btn);color:var(--btnT);border-color:var(--btn)}.r-galerie-carrousel .gc-b:not(:disabled):hover .ic{transform:translateX(3px)}.r-galerie-carrousel .gc-prec:not(:disabled):hover .ic{transform:scaleX(-1) translateX(3px)}}
@media(max-width:700px){.r-galerie-carrousel .gc-ph{height:clamp(250px,72vw,340px)}.r-galerie-carrousel .gc-b{width:50px;height:50px}}
`; }
};

/* ── 2. le mur : des colonnes qui glissent à des vitesses différentes ── */
// des photos toutes au même format font une grille, pas un mur : on leur donne un rythme de cadrages (une photo en
// hauteur garde sa hauteur), puis chaque photo va dans la colonne la plus courte
const RYTHME = [1.5, 0.8, 1.2, 0.75, 1.42, 1];
function colonnes(ph, n) {
  const cols = []; for (let k = 0; k < n; k++) cols.push({ h: k === 1 ? 0.35 : 0, ph: [] });
  ph.forEach(function (p, k) {
    const nat = Number(ar(p)), r = nat < 1 ? Math.min(nat, RYTHME[k % RYTHME.length]) : RYTHME[k % RYTHME.length];
    const c = cols.reduce(function (a, b) { return b.h < a.h ? b : a; });
    c.ph.push({ p: p, r: r.toFixed(3) }); c.h += 1 / r;
  });
  return cols;
}
const mur = {
  id: 'galerie.mur', rubrique: 'galerie', nom: 'Mur en colonnes', quand: 'trois photos à lui ou plus, de formats variés : un mur en colonnes décalées qui glissent à des vitesses différentes au défilement',
  surfaces: ['fond', 'surface', 'champ'], js: ['parallaxe'],
  besoin: function (spec, ctx) { return siennes(ctx, 12).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = siennes(ctx, 12);
    if (ph.length < 3) return '';
    const n = ph.length >= 5 ? 3 : 2, vitesse = n === 3 ? ['0.05', '-0.035', '0.08'] : ['0.04', '-0.04'];
    let i = 0;
    const cols = colonnes(ph, n).map(function (c, k) {
      return '<div class="gm-col" data-px="' + vitesse[k] + '">' + c.ph.map(function (x) { return h.figure(x.p, 'lazy', '(max-width:700px) 50vw, ' + Math.round(100 / n) + 'vw', { attrs: h.rv('monte', (i++) % 4, '--ar:' + x.r) }); }).join('') + '</div>';
    }).join('');
    return '<section class="' + h.classes('galerie.mur', bloc, 'sec') + '" id="images">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.galerie) + '<div class="gm-mur" style="--c:' + n + '">' + cols + '</div></div></section>';
  },
  css: function () { return `
${libre('r-galerie-mur')}
.r-galerie-mur{overflow:hidden}
.r-galerie-mur .gm-mur{display:grid;grid-template-columns:repeat(var(--c),minmax(0,1fr));gap:clamp(12px,1.6vw,22px);align-items:start;padding-block:clamp(10px,3vw,40px)}
.r-galerie-mur .gm-col{display:grid;gap:clamp(12px,1.6vw,22px);will-change:transform}
.r-galerie-mur .gm-col:nth-child(2){margin-top:clamp(48px,8vw,130px)}
.r-galerie-mur .ph{aspect-ratio:var(--ar);transition:opacity .6s var(--ease),filter .6s var(--ease)}
.r-galerie-mur .ph img{transition:transform 1.4s var(--ease)}
.r-galerie-mur .ph::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,transparent 55%,color-mix(in srgb,#000 28%,transparent));opacity:0;transition:opacity .6s var(--ease);pointer-events:none}
@media(hover:hover){.r-galerie-mur .gm-mur:hover .ph{opacity:.55;filter:saturate(.7)}.r-galerie-mur .gm-mur .ph:hover{opacity:1;filter:none}.r-galerie-mur .ph:hover img{transform:scale(1.06)}.r-galerie-mur .ph:hover::after{opacity:1}}
@media(max-width:700px){.r-galerie-mur .gm-mur{display:block;columns:2;column-gap:10px;padding-block:0}.r-galerie-mur .gm-col{display:contents}.r-galerie-mur .ph{break-inside:avoid;margin-bottom:10px}}
`; }
};

/* ── 3. deux rangées qui défilent en sens contraire ── */
const defile = {
  id: 'galerie.defile', rubrique: 'galerie', nom: 'Rangées qui défilent', quand: 'trois photos à lui ou plus : deux rangées de photos qui défilent en sens contraire, en pause au survol, hors écran ou sur demande',
  surfaces: ['fond', 'champ', 'surface'], js: ['defile'],
  besoin: function (spec, ctx) { return siennes(ctx, 10).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = siennes(ctx, 10), n = ph.length;
    if (n < 3) return '';
    // chaque moitié de piste fait au moins deux largeurs d'écran : la boucle ne montre jamais de trou
    const somme = ph.reduce(function (a, p) { return a + Number(ar(p)); }, 0);
    const fois = Math.max(1, Math.ceil(7.5 / somme));
    const rang = function (liste, sens) {
      let serie = []; for (let k = 0; k < fois; k++) serie = serie.concat(liste);
      const moitie = function (dup) { return '<div class="gd-moitie' + (dup ? ' gd-dup' : '') + '"' + (dup ? ' aria-hidden="true"' : '') + '>' + serie.map(function (p, k) { const prem = !dup && k < liste.length; return '<figure class="ph' + (prem ? '' : ' gd-rep') + '" style="--ar:' + ar(p) + '">' + h.img(prem ? p : Object.assign({}, p, { alt: '' }), 'lazy', '(max-width:700px) 60vw, 30vw') + '</figure>'; }).join('') + '</div>'; };
      return '<div class="gd-rang' + (sens ? ' gd-inverse' : '') + '"><div class="gd-piste" style="--duree:' + Math.round(somme * fois * 7.5) + 's">' + moitie(false) + moitie(true) + '</div></div>';
    };
    const deux = ph.slice(Math.ceil(n / 2)).concat(ph.slice(0, Math.ceil(n / 2)));
    return '<section class="' + h.classes('galerie.defile', bloc, 'sec') + '" id="images" data-defile>' + h.fond(bloc) +
      '<div class="w gd-tete">' + h.teteSec(ctx.mod.textes.galerie) + '<button class="gd-pause" type="button" aria-pressed="false" aria-label="Mettre le défilement en pause"' + h.rv('monte', 1) + '>' + PAUSE + '</button></div>' +
      '<div class="gd-cadre"' + h.rv('monte', 1) + '><div class="gd-rangs">' + rang(ph, false) + rang(deux, true) + '</div></div></section>';
  },
  script: "[].slice.call(d.querySelectorAll('.r-galerie-defile')).forEach(function(s){var bt=s.querySelector('.gd-pause');if(!bt)return;bt.addEventListener('click',function(){var on=!s.classList.contains('en-pause');s.classList.toggle('en-pause',on);bt.setAttribute('aria-pressed',on?'true':'false');bt.setAttribute('aria-label',on?'Relancer le défilement':'Mettre le défilement en pause')})})",
  css: function () { return `
${libre('r-galerie-defile')}
.r-galerie-defile{overflow:hidden}
.r-galerie-defile .gd-tete{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.r-galerie-defile .gd-tete .tete-sec{margin-bottom:clamp(34px,4.4vw,64px)}
.r-galerie-defile .gd-pause{flex:none;width:52px;height:52px;margin-bottom:clamp(34px,4.4vw,64px);border-radius:50%;border:1.5px solid var(--bord);background:var(--carte);color:var(--tx);display:grid;place-items:center;cursor:pointer;transition:background-color .3s,color .3s,border-color .3s}
.r-galerie-defile .gd-pause:hover{background:var(--btn);color:var(--btnT);border-color:var(--btn)}
.r-galerie-defile .gd-pause .ic{width:20px;height:20px;stroke-width:2.6}
.r-galerie-defile .gd-il{display:none}
.r-galerie-defile.en-pause .gd-ip{display:none}.r-galerie-defile.en-pause .gd-il{display:block}
.r-galerie-defile .gd-rangs{display:grid;gap:clamp(10px,1.4vw,18px);transform:rotate(-2deg);margin-inline:-3vw}
.r-galerie-defile .gd-rang{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.r-galerie-defile .gd-piste{display:flex;width:max-content;animation:k-galerie-defile-va var(--duree,60s) linear infinite}
.r-galerie-defile .gd-inverse .gd-piste{animation-direction:reverse}
.r-galerie-defile .gd-moitie{display:flex;gap:clamp(10px,1.4vw,18px);padding-right:clamp(10px,1.4vw,18px)}
.r-galerie-defile .ph{flex:none;height:clamp(170px,21vw,310px);aspect-ratio:var(--ar);transition:transform .7s var(--ease),filter .5s}
.r-galerie-defile .ph img{transition:transform 1.2s var(--ease)}
.r-galerie-defile .gd-rang:hover .gd-piste,.r-galerie-defile.en-pause .gd-piste,.r-galerie-defile.arret .gd-piste{animation-play-state:paused}
@media(hover:hover){.r-galerie-defile .gd-rang:hover .ph{filter:saturate(.75) brightness(.92)}.r-galerie-defile .gd-rang .ph:hover{filter:none;transform:scale(1.035)}}
@keyframes k-galerie-defile-va{to{transform:translate3d(-50%,0,0)}}
@media(max-width:700px){.r-galerie-defile .gd-rangs{transform:rotate(-3deg);margin-inline:-8vw}.r-galerie-defile .ph{height:clamp(130px,38vw,190px)}.r-galerie-defile .gd-pause{width:46px;height:46px}}
@media(prefers-reduced-motion:reduce){.r-galerie-defile .gd-piste{animation:none}.r-galerie-defile .gd-rangs{transform:none;margin-inline:0}.r-galerie-defile .gd-rang{overflow-x:auto;-webkit-mask-image:none;mask-image:none}.r-galerie-defile .gd-dup,.r-galerie-defile .gd-rep,.r-galerie-defile .gd-pause{display:none}}
`; }
};

/* ── 4. la planche : une photo s'ouvre en grand ── */
// les rangées de la planche : trois ou quatre photos par rangée, la dernière jamais seule
function rangees(n) {
  const r = Math.max(1, Math.ceil(n / 4)), base = Math.floor(n / r), extra = n % r, out = [];
  for (let k = 0; k < r; k++) out.push(base + (k < extra ? 1 : 0));
  return out;
}
function grande(p, ctx) {
  if (ctx.optimiseur && !/\.svg$/i.test(p.fichier)) return '/_vercel/image?url=' + encodeURIComponent('/' + ctx.racinePhysique + 'img/' + p.fichier) + '&w=1600&q=74';
  return ctx.racineImg + p.fichier;
}
const visionneuse = {
  id: 'galerie.visionneuse', rubrique: 'galerie', nom: 'Planche qui s\'ouvre en grand', quand: 'deux photos à lui ou plus : une planche régulière, chaque photo s\'ouvre en grand (flèches, clavier, Échap)',
  surfaces: ['fond', 'surface', 'champ'], js: ['visionneuse'],
  besoin: function (spec, ctx) { return siennes(ctx, 12).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = siennes(ctx, 12);
    if (ph.length < 2) return '';
    const rg = rangees(ph.length);
    let k = 0;
    const tuiles = [];
    rg.forEach(function (m) {
      for (let j = 0; j < m; j++, k++) {
        const p = ph[k], cap = legende(h, p);
        tuiles.push('<li' + (k === 0 && ph.length % 2 ? ' class="gv-1"' : '') + h.rv('iris', k % 4, '--c:' + (12 / m)) + '><a class="gv-l" href="' + h.esc(grande(p, ctx)) + '" data-zoom data-alt="' + h.esc(cap) + '" aria-label="Agrandir la photo' + (cap ? ' : ' + h.esc(cap) : '') + '">' + h.figure(p, 'lazy', '(max-width:700px) 50vw, ' + Math.round(100 / m) + 'vw') + '<span class="gv-loupe" aria-hidden="true">' + h.icone('loupe') + '</span></a></li>');
      }
    });
    const nav = ph.length > 1 ? '<button class="gv-f gv-p" type="button" aria-label="Photo précédente">' + h.icone('fleche') + '</button><button class="gv-f gv-s" type="button" aria-label="Photo suivante">' + h.icone('fleche') + '</button>' : '';
    return '<section class="' + h.classes('galerie.visionneuse', bloc, 'sec') + '" id="images">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.galerie, 'Touchez une photo pour l\'agrandir.') +
      '<ul class="gv-grille' + (ph.length % 2 ? ' impair' : '') + '">' + tuiles.join('') + '</ul></div>' +
      '<dialog class="gv-dlg" data-visionneuse aria-label="Photo en grand"><figure class="gv-cadre"><img alt=""><figcaption class="gv-cap"></figcaption></figure><button class="gv-x" type="button" aria-label="Fermer">' + CROIX + '</button>' + nav + '</dialog></section>';
  },
  // les flèches et le clavier dans la visionneuse (le module l'ouvre et la ferme)
  script: "[].slice.call(d.querySelectorAll('.r-galerie-visionneuse')).forEach(function(s){var dv=s.querySelector('[data-visionneuse]');if(!dv)return;var im=dv.querySelector('img'),cap=dv.querySelector('.gv-cap'),ls=[].slice.call(s.querySelectorAll('[data-zoom]'));" +
    "var ici=function(){var u=im.getAttribute('src');for(var k=0;k<ls.length;k++)if(ls[k].getAttribute('href')===u)return k;return 0};" +
    "var voir=function(k){var a=ls[(k+ls.length)%ls.length];im.src=a.getAttribute('href');im.alt=a.getAttribute('data-alt')||'';if(cap)cap.textContent=a.getAttribute('data-alt')||'';dv.classList.remove('bouge');void dv.offsetWidth;dv.classList.add('bouge')};" +
    "ls.forEach(function(a){a.addEventListener('click',function(){if(cap)cap.textContent=a.getAttribute('data-alt')||''})});" +
    "[].slice.call(dv.querySelectorAll('.gv-p,.gv-s')).forEach(function(bt){bt.addEventListener('click',function(e){e.stopPropagation();voir(ici()+(bt.classList.contains('gv-s')?1:-1))})});" +
    "dv.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();voir(ici()+(e.key==='ArrowRight'?1:-1))}})})",
  css: function () { return `
${libre('r-galerie-visionneuse')}
.r-galerie-visionneuse .gv-grille{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:clamp(210px,24vw,370px);gap:clamp(8px,1.2vw,16px)}
.r-galerie-visionneuse .gv-grille>li{grid-column:span var(--c,4);min-width:0}
.r-galerie-visionneuse .gv-l{position:relative;display:block;height:100%;border-radius:var(--rp);outline-offset:4px;-webkit-tap-highlight-color:transparent;cursor:zoom-in}
.r-galerie-visionneuse .gv-l .ph{height:100%}
.r-galerie-visionneuse .gv-l .ph img{transition:transform 1.1s var(--ease),filter .6s var(--ease)}
.r-galerie-visionneuse .gv-l .ph::after{content:"";position:absolute;inset:10px;border:1px solid rgb(255 255 255 / .55);border-radius:calc(var(--rp) * .6);opacity:0;transform:scale(1.04);transition:opacity .5s var(--ease),transform .7s var(--ease);pointer-events:none}
.r-galerie-visionneuse .gv-loupe{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;display:grid;place-items:center;background:var(--btn);color:var(--btnT);box-shadow:0 14px 30px -10px rgb(0 0 0 / .5);transform:scale(.4);opacity:0;transition:transform .55s var(--ease),opacity .35s}
.r-galerie-visionneuse .gv-loupe .ic{width:26px;height:26px}
.r-galerie-visionneuse .gv-l:hover .ph img,.r-galerie-visionneuse .gv-l:focus-visible .ph img{transform:scale(1.07);filter:brightness(.82)}
.r-galerie-visionneuse .gv-l:hover .ph::after,.r-galerie-visionneuse .gv-l:focus-visible .ph::after{opacity:1;transform:none}
.r-galerie-visionneuse .gv-l:hover .gv-loupe,.r-galerie-visionneuse .gv-l:focus-visible .gv-loupe{transform:none;opacity:1}
.r-galerie-visionneuse .gv-dlg{position:fixed;inset:0;width:100%;height:100%;max-width:100%;max-height:100%;margin:0;padding:clamp(56px,7vw,90px) clamp(12px,6vw,110px);border:0;background:transparent;color:#fff;overflow:hidden}
.r-galerie-visionneuse .gv-dlg[open]{display:grid;place-items:center;animation:k-galerie-visionneuse-fond .35s ease both}
.r-galerie-visionneuse .gv-dlg::backdrop{background:rgb(8 8 10 / .9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.r-galerie-visionneuse .gv-cadre{margin:0;display:grid;gap:14px;justify-items:center;max-width:100%;max-height:100%}
.r-galerie-visionneuse .gv-cadre img{max-width:100%;max-height:calc(100dvh - 2 * clamp(56px,7vw,90px) - 40px);width:auto;height:auto;object-fit:contain;border-radius:var(--rp);box-shadow:0 30px 90px -20px rgb(0 0 0 / .7);cursor:zoom-out}
.r-galerie-visionneuse .gv-dlg[open] .gv-cadre,.r-galerie-visionneuse .gv-dlg.bouge .gv-cadre{animation:k-galerie-visionneuse-photo .6s var(--ease) both}
.r-galerie-visionneuse .gv-cap{font-size:1rem;color:rgb(255 255 255 / .82)}
.r-galerie-visionneuse .gv-cap:empty{display:none}
.r-galerie-visionneuse .gv-x,.r-galerie-visionneuse .gv-f{position:absolute;width:52px;height:52px;border-radius:50%;border:1px solid rgb(255 255 255 / .28);background:rgb(255 255 255 / .1);color:#fff;display:grid;place-items:center;cursor:pointer;transition:background-color .3s,transform .45s var(--ease)}
.r-galerie-visionneuse .gv-x:hover,.r-galerie-visionneuse .gv-f:hover{background:rgb(255 255 255 / .24)}
.r-galerie-visionneuse .gv-x:focus-visible,.r-galerie-visionneuse .gv-f:focus-visible{outline:3px solid #fff;outline-offset:3px}
.r-galerie-visionneuse .gv-x{top:clamp(10px,2vw,24px);right:clamp(10px,2vw,24px)}
.r-galerie-visionneuse .gv-f{top:50%;margin-top:-26px}
.r-galerie-visionneuse .gv-p{left:clamp(8px,2vw,28px)}.r-galerie-visionneuse .gv-p .ic{transform:scaleX(-1)}
.r-galerie-visionneuse .gv-s{right:clamp(8px,2vw,28px)}
body:has(.r-galerie-visionneuse .gv-dlg[open]){overflow:hidden}
@keyframes k-galerie-visionneuse-fond{from{opacity:0}}
@keyframes k-galerie-visionneuse-photo{from{opacity:0;transform:scale(.94) translateY(14px)}}
@media(max-width:700px){.r-galerie-visionneuse .gv-grille{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:clamp(150px,44vw,240px)}.r-galerie-visionneuse .gv-grille>li{grid-column:span 1}.r-galerie-visionneuse .gv-grille.impair>li.gv-1{grid-column:span 2}.r-galerie-visionneuse .gv-f{top:auto;bottom:16px;margin-top:0}.r-galerie-visionneuse .gv-loupe{width:52px;height:52px;margin:-26px 0 0 -26px}}
@media(prefers-reduced-motion:reduce){.r-galerie-visionneuse .gv-dlg[open],.r-galerie-visionneuse .gv-dlg[open] .gv-cadre,.r-galerie-visionneuse .gv-dlg.bouge .gv-cadre{animation:none}}
`; }
};

/* ── 5. les tirages posés sur la table ── */
const ANGLES = [-5, 3.5, -2, 4.5, -3.5, 2.5];
const polaroids = {
  id: 'galerie.polaroids', rubrique: 'galerie', nom: 'Tirages sur la table', quand: 'deux à six photos à lui, plutôt chaleureuses (table, fleurs, ateliers) : des tirages légèrement tournés qui s\'écartent au survol',
  surfaces: ['surface', 'fond', 'champ'], js: [],
  besoin: function (spec, ctx) { return siennes(ctx, 6).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = siennes(ctx, 6);
    if (ph.length < 2) return '';
    const tirages = ph.map(function (p, k) {
      const cap = legende(h, p);
      return '<li class="gp-t"' + h.rv('monte', k, '--r:' + ANGLES[k % ANGLES.length] + 'deg;--k:' + k) + '><figure class="gp-f"><div class="gp-ph">' + h.img(p, 'lazy', '(max-width:700px) 46vw, 22vw') + '</div><figcaption>' + h.esc(cap) + '</figcaption></figure></li>';
    }).join('');
    return '<section class="' + h.classes('galerie.polaroids', bloc, 'sec') + '" id="images">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.galerie, null, { classe: 'c' }) + '<ul class="gp-table n' + ph.length + '">' + tirages + '</ul></div></section>';
  },
  css: function () { return `
${libre('r-galerie-polaroids')}
.r-galerie-polaroids{overflow:hidden}
.r-galerie-polaroids .gp-table{display:flex;justify-content:center;align-items:center;padding:clamp(10px,3vw,40px) 0 clamp(20px,4vw,56px)}
.r-galerie-polaroids .gp-t{flex:0 1 clamp(190px,21vw,290px);margin-inline:calc(-1 * clamp(14px,2vw,30px));position:relative;z-index:1;transition:margin .8s var(--ease),z-index 0s .2s}
.r-galerie-polaroids .gp-t:nth-child(even){margin-top:clamp(30px,5vw,70px)}
.r-galerie-polaroids .gp-f{margin:0;background:#fff;padding:clamp(9px,.9vw,13px) clamp(9px,.9vw,13px) 0;border-radius:3px;box-shadow:0 1px 2px rgb(0 0 0 / .18),0 22px 40px -16px rgb(0 0 0 / .45);transform:rotate(var(--r));transition:transform .8s var(--ease),box-shadow .8s var(--ease);position:relative}
.r-galerie-polaroids .gp-f::before{content:"";position:absolute;left:50%;top:-11px;width:84px;height:24px;margin-left:-42px;background:color-mix(in srgb,var(--acc) 30%,rgb(255 255 255 / .55));opacity:.85;transform:rotate(calc(var(--r) * -1.4));box-shadow:0 1px 2px rgb(0 0 0 / .12);z-index:2}
.r-galerie-polaroids .gp-ph{aspect-ratio:1;overflow:hidden;background:#e9e6e1}
.r-galerie-polaroids .gp-ph img{width:100%;height:100%;object-fit:cover;filter:saturate(1.05) contrast(1.02);transition:transform 1.2s var(--ease)}
.r-galerie-polaroids figcaption{min-height:clamp(46px,4.4vw,62px);display:flex;align-items:center;justify-content:center;padding:6px 4px 8px;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:clamp(1rem,1.2vw,1.12rem);line-height:1.2;color:rgb(0 0 0 / .74);text-align:center}
@media(hover:hover) and (min-width:701px){.r-galerie-polaroids .gp-table:hover .gp-t{margin-inline:clamp(6px,.8vw,12px)}.r-galerie-polaroids .gp-table:hover .gp-f{transform:rotate(calc(var(--r) * .35))}.r-galerie-polaroids .gp-t:hover{z-index:5;transition:margin .8s var(--ease),z-index 0s}.r-galerie-polaroids .gp-table .gp-t:hover .gp-f{transform:translateY(-14px) scale(1.07) rotate(0deg);box-shadow:0 2px 4px rgb(0 0 0 / .14),0 40px 70px -24px rgb(0 0 0 / .55)}.r-galerie-polaroids .gp-t:hover .gp-ph img{transform:scale(1.05)}}
@media(max-width:1000px) and (min-width:701px){.r-galerie-polaroids .gp-table{flex-wrap:wrap;row-gap:30px}}
@media(max-width:700px){.r-galerie-polaroids .gp-table{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 14px;padding-inline:6px}.r-galerie-polaroids .gp-t{margin:0}.r-galerie-polaroids .gp-t:nth-child(even){margin-top:34px}.r-galerie-polaroids .gp-table.n2 .gp-t:nth-child(even){margin-top:22px}.r-galerie-polaroids .gp-f::before{width:60px;height:20px;margin-left:-30px;top:-9px}}
`; }
};

/* ── 6. la grille bento : une grande photo, la tuile du titre, les autres autour ── */
const GABARITS = { 2: ['g', 't', 'l'], 3: ['g', 't', 'c', 'c'], 4: ['g', 't', 'c', 'c', 'p'], 5: ['g', 't', 'c', 'c', 'l', 'l'], 6: ['g', 't', 'c', 'c', 'c', 'c', 'l'] };
const bento = {
  id: 'galerie.bento', rubrique: 'galerie', nom: 'Grille bento', quand: 'deux à six photos à lui : une grande photo, la tuile du titre aux couleurs du site avec le bouton, les autres photos en tuiles de tailles variées',
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return siennes(ctx, 6).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = siennes(ctx, 6);
    if (ph.length < 2) return '';
    const gab = GABARITS[ph.length] || GABARITS[6];
    const types = ['rideau', 'iris', 'zoom', 'store'];
    let k = 0;
    const tuiles = gab.map(function (g, j) {
      if (g === 't') return '<div class="gb-t gb-x2"' + h.rv('monte', 1) + '><span class="gb-ic" aria-hidden="true">' + h.icone(ctx.iconeMetier) + '</span><h2 class="t">' + h.esc(ctx.mod.textes.galerie) + '</h2>' + (ctx.ligneMetier ? '<p class="gb-m">' + h.esc(ctx.ligneMetier) + '</p>' : '') + h.boutons(spec, { seule: true }) + '</div>';
      const p = ph[k++];
      return h.figure(p, 'lazy', g === 'g' ? '(max-width:700px) 100vw, 50vw' : (g === 'c' ? '(max-width:700px) 50vw, 25vw' : '(max-width:700px) 100vw, 50vw'), { classe: 'gb-' + g + (g === 'g' ? ' gb-x2 gb-y2' : g === 'l' ? ' gb-x2' : g === 'p' ? ' gb-x4' : ''), attrs: h.rv(types[j % types.length], j) });
    }).join('');
    return '<section class="' + h.classes('galerie.bento', bloc, 'sec') + '" id="images">' + h.fond(bloc) + '<div class="w"><div class="gb">' + tuiles + '</div></div></section>';
  },
  css: function () { return `
${libre('r-galerie-bento')}
.r-galerie-bento{--t1:var(--btn);--t2:var(--btnT)}
.r-galerie-bento .gb{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(clamp(170px,17vw,250px),auto);gap:clamp(10px,1.2vw,16px)}
.r-galerie-bento .gb-x2{grid-column:span 2}.r-galerie-bento .gb-y2{grid-row:span 2}.r-galerie-bento .gb-x4{grid-column:span 4}
.r-galerie-bento .ph{height:100%;min-height:clamp(150px,17vw,250px)}
.r-galerie-bento .ph img{position:absolute;inset:0;transition:transform 1.3s var(--ease)}
.r-galerie-bento .ph:hover img{transform:scale(1.06)}
.r-galerie-bento .gb-t{position:relative;overflow:hidden;isolation:isolate;border-radius:var(--rp);background:var(--t1);color:var(--t2);--tx:var(--t2);--btn:var(--t2);--btnT:var(--t1);padding:clamp(22px,2.4vw,34px);display:flex;flex-direction:column;align-items:flex-start;gap:18px}
.r-galerie-bento .gb-t h2.t{font-size:clamp(1.6rem,2.6vw,2.5rem);max-width:16ch;position:relative}
.r-galerie-bento .gb-t .actions{position:relative;margin-top:auto}
.r-galerie-bento .gb-m{position:relative;margin-top:-8px;font-size:1rem;line-height:1.45;color:color-mix(in srgb,var(--t2) 82%,var(--t1));max-width:34ch}
.r-galerie-bento .gb-t .b1{box-shadow:none}
.r-galerie-bento .gb-ic{position:absolute;right:-6%;bottom:-24%;width:62%;max-width:260px;aspect-ratio:1;opacity:.14;z-index:-1;transition:transform 1.6s var(--ease)}
.r-galerie-bento .gb-ic .ic{width:100%;height:100%;stroke-width:1}
.r-galerie-bento .gb-t:hover .gb-ic{transform:rotate(-12deg) scale(1.06)}
@media(max-width:860px){.r-galerie-bento .gb{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(clamp(150px,40vw,260px),auto)}.r-galerie-bento .gb-x4{grid-column:span 2}.r-galerie-bento .gb-t{grid-row:span 1}}
@media(max-width:520px){.r-galerie-bento .gb-t{grid-column:span 2}.r-galerie-bento .gb-y2{grid-row:span 2}}
`; }
};

module.exports = [carrousel, mur, defile, visionneuse, polaroids, bento];
