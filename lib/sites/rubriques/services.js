// Les services : ce que fait l'entreprise, mis en scène de dix-huit façons (liste aux grands titres, onglets, carrousel,
// bento, pile collante, sommaire collé, accordéon, affiches, rangées alternées, anneaux, lignes qui se remplissent, tuiles
// de nuit, cartes en relief, ardoise de restaurant, liste de soins, volets, récit collant, plaques sur panneau perforé).
// Une variante qui montre des photos ne le fait que si CHAQUE service a la sienne : une grille n'est jamais à moitié
// illustrée. Chaque service peut ouvrir WhatsApp avec un message déjà écrit pour lui (sauf à table : on ne réserve pas
// un plat). Aucun prix, aucun chiffre : les titres et les lignes de la fiche, rien de plus.
'use strict';

// la voix des titres du site
const TT = 'font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);';
// la matière de papier (grain), et la craie : un grain qui laisse des trous dans le trait
const NOISE = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>') + '")';
const CRAIE = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="c"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 3.2 0 0 0 -.62"/></filter><rect width="100%" height="100%" filter="url(#c)"/></svg>') + '")';
const ORNEMENT = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 14"><path d="M4 7c9-6 17 6 26 0s17 6 26 0 17 6 26 0 17 6 26 0" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round"/><circle cx="60" cy="7" r="2.2" fill="white"/></svg>') + '")';

// Deux pièges du socle d'apparitions, contournés ici (voir le compte rendu) : un élément entièrement découpé par
// clip-path n'est jamais vu par l'observateur de Chrome (rideau, store, iris ne s'ouvriraient pas), et l'état « vu »
// pose clip-path:inset(0) qui efface ombres et anneaux de focus. Donc : l'élément observé n'est jamais découpé (c'est son
// enfant qui s'ouvre, data-r="mots" servant de simple déclencheur), et une fois vu, plus aucune découpe.
function vu(cls) { return '.js .' + cls + ' [data-r].vu{clip-path:none}'; }
// la transition des apparitions, à garder quand une variante ajoute les siennes (survol) sur le même élément
const REVELE = 'opacity var(--dur) var(--ease) calc(var(--i,0) * var(--pas)),transform var(--dur) var(--ease) calc(var(--i,0) * var(--pas))';

// une vraie nuit : le champ de la palette est sombre (une palette au champ jaune ou vif n'a pas de « nuit »)
const LUM = require('../theme').lum;
function nuitPossible(ctx) { return !!(ctx.palette && /^#[0-9a-f]{6}$/i.test(ctx.palette.champ)) && LUM(ctx.palette.champ) < 0.06; }
/* ── ce que toutes les variantes partagent ── */
function liste(spec, ctx) { return ctx.h.servicesDe(spec).slice(0, 6); }
function nombre(spec, ctx) { return ctx.h.servicesDe(spec).length; }
// les photos des services, seulement si chacun a la sienne
function photosDe(spec, ctx) {
  const s = liste(spec, ctx);
  if (!s.length || !s.every(function (x, k) { return !!ctx.alloc.services[k]; })) return null;
  return s.map(function (x, k) { return ctx.alloc.services[k]; });
}
// les icônes disent-elles quelque chose ? (quatre plats avec les mêmes couverts : une mise en page à grandes icônes serait pauvre)
function iconesVariees(spec, ctx) { const s = liste(spec, ctx); const vus = {}; s.forEach(function (x) { vus[ctx.h.iconeDe(x, ctx.iconeMetier)] = 1; }); return Object.keys(vus).length >= Math.min(2, s.length); }
// sans photo pour chacun, la variante vit de ses icônes : il les faut variées
function photosOuIcones(spec, ctx) { return !!photosDe(spec, ctx) || iconesVariees(spec, ctx); }
// la taille commune des titres d'une liste : celle qui fait tenir le plus long en deux lignes dans sa colonne
function kTitres(sv, ctx) { return sv.reduce(function (m, s) { return Math.max(m, Number(ctx.h.k2(ctx.h.net(s.titre), ctx.type))); }, 1).toFixed(2); }
// l'action d'un service : WhatsApp avec un message prêt pour lui, sinon l'appel, sinon l'email
function action(spec, ctx, s) {
  if (ctx.da && ctx.da.modele === 'comptoir') return null;
  const h = ctx.h, c = spec.contact || {}, o = h.objectif(spec), t = h.net(s.titre);
  const msg = /:\s*$/.test(o.wa) ? o.wa + t : 'Bonjour, je viens de votre site. Je voudrais des informations sur : ' + t;
  const w = h.waHref(c.mobile || c.tel, msg);
  if (w) return { href: w, ext: true, icone: 'whatsapp', texte: o.waBouton };
  const tel = h.telHref(c.tel);
  if (tel) return { href: tel, ext: false, icone: 'tel', texte: 'Appeler' };
  if (c.email) return { href: h.mailHref(c.email, o.sujet + ' : ' + t, o.corps), ext: false, icone: 'mail', texte: 'Écrire' };
  return null;
}
function ouvre(h, a, cls, attrs) { return '<a class="' + cls + '" href="' + h.esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + (attrs || '') + '>'; }
// le lien d'action d'un service (icône, texte, flèche), nommé pour les lecteurs d'écran
function lienAction(h, a, t, cls) { return a ? ouvre(h, a, cls, ' aria-label="' + h.esc(a.texte + ' : ' + t) + '"') + h.icone(a.icone) + '<span>' + h.esc(a.texte) + '</span>' + h.icone('fleche') + '</a>' : ''; }
function titreSec(ctx) { return ctx.textes.services; }
// une photo encore libre, comme h.photos, mais une illustration d'abord (la galerie montre déjà celles de l'entreprise)
function prendrePhoto(ctx) {
  const a = ctx.alloc;
  const pris = new Set([a.hero, a.apropos, a.bandeau].concat(Object.keys(a.services).map(function (k) { return a.services[k]; })).concat(ctx.prises || []).filter(Boolean));
  const reste = a.reste.filter(function (x) { return !pris.has(x); }), gal = a.galerie.filter(function (x) { return !pris.has(x); });
  const p = reste[0] || gal[gal.length - 1] || null;
  if (p) ctx.prises = (ctx.prises || []).concat([p]);
  return p;
}
function section(id, ctx, bloc, extra, corps) { return '<section class="' + ctx.h.classes(id, bloc, 'sec' + (extra ? ' ' + extra : '')) + '" id="services">' + ctx.h.fond(bloc) + corps + '</section>'; }
// une question courte pour la tuile d'appel
const QUESTIONS = { devis: 'Un autre projet ?', reservation: 'Envie de réserver ?', appel: 'Une question ?', visite: 'Une question ?', inscription: 'Une question ?' };
// la surface contrastée d'une tuile posée sur le bloc (jamais la même que le bloc)
function inverse(bloc) { return bloc && bloc.surface === 'champ' ? 's-fond' : 's-champ'; }
function vive(bloc) { return bloc && bloc.surface === 'accent' ? 's-champ' : 's-accent'; }

/* ── 1. la liste aux grands titres : la photo suit le pointeur ── */
const survol = {
  id: 'services.survol', rubrique: 'services', nom: 'Grands titres, photo qui suit le pointeur',
  quand: 'chaque service a sa photo : une liste éditoriale aux grands titres ; au survol la photo du service apparaît et suit le pointeur (ordinateur), elle est dans la ligne sur téléphone',
  familles: [], ambiances: ['premium', 'calme', 'franc'], surfaces: ['fond', 'surface'], js: ['survol'],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && !!photosDe(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    if (!ph) return '';
    const flot = '<div class="sv-flot" aria-hidden="true"><div class="sv-cadre">' + ph.map(function (p, k) { return h.figure(p, 'lazy', '320px', { classe: k === 0 ? 'on' : '', attrs: ' data-survol-img="' + k + '"' }); }).join('') + '</div></div>';
    const lignes = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      const c = h.figure(ph[k], 'lazy', '(max-width:900px) 100vw, 190px', { classe: 'sv-vig' }) + '<div class="sv-c"><h3 class="sv-t">' + h.esc(t) + '</h3>' + (x ? '<p class="sv-x">' + h.esc(x) + '</p>' : '') + (a ? '<span class="sv-gl">' + h.icone(a.icone) + '<span>' + h.esc(a.texte) + '</span></span>' : '') + '</div>' + (a ? '<span class="sv-fl" aria-hidden="true">' + h.icone('fleche') + '</span>' : '');
      return '<li' + h.rv('monte', k) + '>' + (a ? ouvre(h, a, 'sv-it', ' data-survol-cle="' + k + '"') + c + '</a>' : '<div class="sv-it" data-survol-cle="' + k + '">' + c + '</div>') + '</li>';
    }).join('');
    return section('services.survol', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="sv-liste" data-survol>' + flot + '<ul class="sv-l" style="--kl:' + kTitres(sv, ctx) + '">' + lignes + '</ul></div></div>');
  },
  // au repos la photo du service survolé en dernier attend à droite ; au survol elle rejoint le pointeur en douceur,
  // penche dans le sens du mouvement et reste dans sa colonne (sans jamais couvrir les titres)
  script: "[].slice.call(d.querySelectorAll('.r-services-survol .sv-liste')).forEach(function(l){var f=l.querySelector('.sv-flot');if(!f||calme||!w.matchMedia('(hover:hover) and (pointer:fine)').matches)return;var x=0,y=0,tx=0,ty=0,rt=0,raf=0;var pas=function(){raf=0;var dx=tx-x,dy=ty-y;x+=dx*.14;y+=dy*.14;rt+=(Math.max(-6,Math.min(6,dy*.04))-rt)*.18;f.style.transform='translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,0) rotate('+rt.toFixed(2)+'deg)';if(Math.abs(dx)+Math.abs(dy)>.3||Math.abs(rt)>.03)raf=requestAnimationFrame(pas)};var vise=function(cx,cy){var r=l.getBoundingClientRect(),fw=f.offsetWidth,fh=f.offsetHeight,rx=r.width-80-fw,ry=r.height/2-fh/2,a=r.width*.6;var ax=rx>a?a+Math.max(0,Math.min(1,cx/r.width))*(rx-a):rx;var ay=Math.max(-fh*.15,Math.min(r.height-fh*.85,cy-fh/2));tx=ax-rx;ty=ay-ry;if(!raf)raf=requestAnimationFrame(pas)};var repos=function(){tx=0;ty=0;if(!raf)raf=requestAnimationFrame(pas)};l.addEventListener('pointermove',function(e){var r=l.getBoundingClientRect();vise(e.clientX-r.left,e.clientY-r.top)});l.addEventListener('pointerenter',function(){l.classList.add('suit')});l.addEventListener('pointerleave',function(){l.classList.remove('suit');repos()});l.addEventListener('focusin',function(e){var it=e.target.closest&&e.target.closest('.sv-it');if(!it)return;var r=l.getBoundingClientRect(),q=it.getBoundingClientRect();vise(r.width*.7,q.top-r.top+q.height/2)});l.addEventListener('focusout',repos)})",
  css: function () { return `
${vu('r-services-survol')}
.r-services-survol .sv-liste{position:relative}
.r-services-survol .sv-l{container-type:inline-size;border-bottom:1px solid var(--bord);--col:.68}
.r-services-survol .sv-it{position:relative;display:grid;grid-template-columns:clamp(130px,13vw,190px) minmax(0,1fr) 56px;align-items:center;gap:18px clamp(18px,3vw,44px);padding:clamp(18px,2.2vw,28px) 0;border-top:1px solid var(--bord);color:inherit;text-decoration:none;transition:opacity .45s var(--ease)}
.r-services-survol .sv-vig{aspect-ratio:4/3}
.r-services-survol .sv-vig img{transition:transform 1.2s var(--ease)}
.r-services-survol .sv-it:hover .sv-vig img{transform:scale(1.06)}
.r-services-survol .sv-c{display:grid;gap:8px;justify-items:start;min-width:0}
.r-services-survol .sv-t{${TT}font-size:max(1.6rem,min(4rem,calc(var(--col) * 100cqi / var(--kl))));line-height:var(--th);transition:transform .7s var(--ease),color .35s}
.r-services-survol .sv-x{color:var(--tx2);font-size:1.05rem;max-width:46ch}
.r-services-survol .sv-gl{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:var(--fxf);font-size:.98rem;color:var(--accT)}
.r-services-survol .sv-gl .ic{width:18px;height:18px}
.r-services-survol .sv-fl{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--bord);transition:background-color .35s,color .35s,border-color .35s,transform .6s var(--ease)}
.r-services-survol a.sv-it:hover .sv-fl,.r-services-survol a.sv-it:focus-visible .sv-fl{background:var(--btn);color:var(--btnT);border-color:transparent;transform:rotate(-45deg)}
.r-services-survol .sv-it:hover .sv-t{transform:translateX(14px);color:var(--accT)}
@media(hover:hover){.r-services-survol .sv-l:hover .sv-it:not(:hover){opacity:.42}}
.r-services-survol .sv-flot{--fw:clamp(230px,21vw,310px);display:none;position:absolute;right:80px;top:calc(50% - var(--fw) * .625);z-index:3;width:var(--fw);aspect-ratio:4/5;pointer-events:none;will-change:transform}
.r-services-survol .sv-liste.suit .sv-cadre{transform:scale(1.04)}
.r-services-survol .sv-cadre{position:absolute;inset:0;border-radius:var(--rp);overflow:hidden;background:var(--douce);box-shadow:var(--ombreF);transition:transform .8s var(--ease)}
.r-services-survol .sv-cadre .ph{position:absolute;inset:0;border-radius:0;opacity:0;transform:scale(1.16);transition:opacity .5s var(--ease),transform 1.1s var(--ease)}
.r-services-survol .sv-cadre .ph.on{opacity:1;transform:none}
@media (hover:hover) and (pointer:fine) and (min-width:901px) and (prefers-reduced-motion:no-preference){.js .r-services-survol .sv-vig{display:none}.js .r-services-survol .sv-flot{display:block}.js .r-services-survol .sv-it{grid-template-columns:minmax(0,1fr) 56px}.js .r-services-survol .sv-l{--col:.58}.js .r-services-survol .sv-c{max-width:60%}.js .r-services-survol .sv-gl{opacity:0;transform:translateY(8px);transition:opacity .4s,transform .6s var(--ease)}.js .r-services-survol .sv-it:hover .sv-gl,.js .r-services-survol .sv-it:focus-visible .sv-gl{opacity:1;transform:none}}
@media(max-width:900px){.r-services-survol .sv-it{grid-template-columns:minmax(0,1fr);gap:14px;padding:22px 0 24px}.r-services-survol .sv-vig{aspect-ratio:16/10}.r-services-survol .sv-fl{display:none}.r-services-survol .sv-l{--col:1}.r-services-survol .sv-t{font-size:max(1.55rem,min(2.6rem,calc(100cqi / var(--kl))))}}
`; }
};

/* ── 2. les onglets : un panneau par service, qui défilent seuls ── */
const onglets = {
  id: 'services.onglets', rubrique: 'services', nom: 'Onglets, un panneau par service',
  quand: 'deux à six services à détailler un par un : des onglets qui avancent seuls (pause au survol, arrêt au premier clic), chaque panneau avec sa photo ou son icône qui se dessine, et son bouton WhatsApp',
  familles: [], ambiances: ['franc', 'calme', 'premium'], surfaces: ['surface', 'fond'], js: ['onglets'],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && photosOuIcones(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    const tabs = sv.map(function (s, k) { return '<button type="button" class="og-b" role="tab" id="og-t-' + k + '" aria-controls="og-p-' + k + '" aria-selected="' + (k === 0) + '" tabindex="' + (k === 0 ? 0 : -1) + '">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '<span>' + h.esc(h.net(s.titre)) + '</span><i class="og-tps" aria-hidden="true"></i></button>'; }).join('');
    const pans = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte), ic = h.iconeDe(s, ctx.iconeMetier);
      const vis = ph ? '<div class="og-vis">' + h.figure(ph[k], 'lazy', '(max-width:860px) 100vw, 56vw') + '<span class="og-pas" aria-hidden="true">' + h.icone(ic) + '</span></div>' : '<div class="og-vis og-scene" aria-hidden="true"><span class="og-g">' + h.icone(ic) + '</span></div>';
      return '<div class="og-p" role="tabpanel" id="og-p-' + k + '" aria-labelledby="og-t-' + k + '"' + h.rv('flou') + '>' + vis + '<div class="og-tx"><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + (a ? ouvre(h, a, 'btn b1', ' aria-label="' + h.esc(a.texte + ' : ' + t) + '"') + h.contenuBouton(a.icone, a.texte) + '</a>' : '') + '</div></div>';
    }).join('');
    return section('services.onglets', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="og" data-onglets><div class="og-liste" role="tablist" aria-label="' + h.esc(titreSec(ctx)) + '"><span class="og-ind" aria-hidden="true"></span>' + tabs + '</div><div class="og-pans">' + pans + '</div></div></div>');
  },
  // sans script, tous les panneaux restent lisibles l'un sous l'autre ; avec, un seul, la pastille glisse sous l'onglet
  // choisi et les onglets avancent seuls tant que personne n'y touche (pause au survol, au focus, hors écran)
  script: "[].slice.call(d.querySelectorAll('.r-services-onglets [data-onglets]')).forEach(function(o){var bs=[].slice.call(o.querySelectorAll('[role=tab]')),li=o.querySelector('.og-liste'),ind=o.querySelector('.og-ind');if(!bs.length)return;var cur=function(){for(var i=0;i<bs.length;i++)if(bs[i].getAttribute('aria-selected')==='true')return i;return 0};bs.forEach(function(x,i){var p=d.getElementById(x.getAttribute('aria-controls'));if(p)p.hidden=i!==cur()});var place=function(){var x=bs[cur()];if(!ind||!x)return;ind.style.width=x.offsetWidth+'px';ind.style.transform='translateX('+x.offsetLeft+'px)';o.classList.add('og-pret');if(li&&li.scrollWidth>li.clientWidth+2)li.scrollTo({left:Math.max(0,x.offsetLeft-24),behavior:calme?'auto':'smooth'})};place();w.addEventListener('resize',place);var auto=!calme,vu=false,pause=false,t=null,prog=false;var plan=function(){clearTimeout(t);o.classList.remove('joue');if(!auto||!vu||pause||d.hidden)return;void o.offsetWidth;o.classList.add('joue');t=setTimeout(function(){prog=true;bs[(cur()+1)%bs.length].click();prog=false;plan()},7000)};bs.forEach(function(x){x.addEventListener('click',function(){setTimeout(place,0);if(!prog){auto=false;plan()}});x.addEventListener('keydown',function(){auto=false;plan();setTimeout(place,0)})});o.addEventListener('pointerenter',function(){pause=true;plan()});o.addEventListener('pointerleave',function(){pause=false;plan()});o.addEventListener('focusin',function(){pause=true;plan()});o.addEventListener('focusout',function(){pause=false;plan()});d.addEventListener('visibilitychange',plan);if('IntersectionObserver' in w)new IntersectionObserver(function(es){vu=es[0].isIntersecting;plan()},{threshold:.35}).observe(o)})",
  css: function () { return `
${vu('r-services-onglets')}
.r-services-onglets .og{display:grid;gap:clamp(26px,3.6vw,48px)}
.m-comptoir .r-services-onglets .og-liste,.m-ecrin .r-services-onglets .og-liste{margin-inline:auto}
.r-services-onglets .og-liste{position:relative;display:flex;gap:4px;padding:5px;max-width:100%;width:max-content;overflow-x:auto;scrollbar-width:none;background:color-mix(in srgb,var(--tx) 5%,transparent);border:1px solid var(--bord);border-radius:calc(var(--rb) + 5px)}
.r-services-onglets .og-liste::-webkit-scrollbar{display:none}
.r-services-onglets .og-ind{position:absolute;left:0;top:5px;bottom:5px;width:0;border-radius:var(--rb);background:var(--btn);opacity:0;box-shadow:0 10px 24px -14px color-mix(in srgb,var(--btn) 85%,transparent);transition:transform .6s var(--ease),width .5s var(--ease),opacity .3s}
.r-services-onglets .og-pret .og-ind{opacity:1}
.r-services-onglets .og-b{position:relative;z-index:1;flex:none;display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 20px;border:0;border-radius:var(--rb);background:transparent;color:var(--tx);font-family:var(--fx);font-weight:var(--fxf);font-size:1rem;line-height:1.2;white-space:nowrap;cursor:pointer;overflow:hidden;transition:color .35s,background-color .3s}
.r-services-onglets .og-b .ic{color:var(--accT);transition:color .35s}
.r-services-onglets .og-b[aria-selected=true],.r-services-onglets .og-b[aria-selected=true] .ic{color:var(--btnT)}
.r-services-onglets .og:not(.og-pret) .og-b[aria-selected=true]{background:var(--btn)}
.r-services-onglets .og-b[aria-selected=false]:hover{background:color-mix(in srgb,var(--tx) 8%,transparent)}
.r-services-onglets .og-tps{position:absolute;left:18px;right:18px;bottom:7px;height:2px;border-radius:2px;background:currentColor;opacity:.5;transform:scaleX(0);transform-origin:left}
.r-services-onglets .og.joue .og-b[aria-selected=true] .og-tps{animation:k-services-onglets-temps 7s linear forwards}
.r-services-onglets .og-pans{display:grid;gap:clamp(40px,5vw,64px)}
.r-services-onglets .og-p{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);gap:clamp(28px,4.6vw,76px);align-items:center}
.r-services-onglets .og-p[hidden]{display:none}
.r-services-onglets .og-vis{position:relative}
.r-services-onglets .og-vis .ph{aspect-ratio:4/3;box-shadow:var(--ombreF)}
.r-services-onglets .og-vis .ph img{transition:transform 1.6s var(--ease)}
.r-services-onglets .og-pas{position:absolute;right:clamp(14px,2vw,24px);bottom:clamp(14px,2vw,24px);width:64px;height:64px;display:grid;place-items:center;border-radius:var(--rb);background:var(--btn);color:var(--btnT);box-shadow:var(--ombre)}
.r-services-onglets .og-pas .ic{width:30px;height:30px}
.r-services-onglets .og-scene{aspect-ratio:4/3;border-radius:var(--rp);display:grid;place-items:center;overflow:hidden;border:1px solid var(--bord);background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--acc) 20%,transparent),transparent 62%),radial-gradient(color-mix(in srgb,var(--tx) 18%,transparent) 1px,transparent 1.6px) 0 0/22px 22px,var(--carte)}
.r-services-onglets .og-g{width:40%;aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:var(--bg);color:var(--accT);box-shadow:0 0 0 1px var(--bord),0 0 0 22px color-mix(in srgb,var(--acc) 9%,transparent),0 0 0 48px color-mix(in srgb,var(--acc) 5%,transparent)}
.r-services-onglets .og-g .ic{width:52%;height:52%;stroke-width:1.2}
.r-services-onglets .og-g .ic *{stroke-dasharray:130;stroke-dashoffset:0;transition:stroke-dashoffset 1.8s var(--ease) .2s}
.r-services-onglets .og-tx{display:grid;gap:18px;justify-items:start}
.r-services-onglets .og-tx h3{${TT}font-size:clamp(2rem,3.4vw,3.3rem);line-height:var(--th)}
.r-services-onglets .og-tx p{font-size:1.15rem;line-height:1.6;color:var(--tx2);max-width:40ch}
.js .r-services-onglets .og-p .og-vis .ph{transition:clip-path 1.1s var(--ease)}
.js .r-services-onglets .og-p:not(.vu) .og-vis .ph{clip-path:inset(0 0 0 100%)}
.js .r-services-onglets .og-p:not(.vu) .og-vis .ph img{transform:scale(1.12)}
.js .r-services-onglets .og-p:not(.vu) .og-g .ic *{stroke-dashoffset:130}
.js .r-services-onglets .og-p .og-tx>*{transition:opacity .7s var(--ease),transform .9s var(--ease)}
.js .r-services-onglets .og-p:not(.vu) .og-tx>*{opacity:0;transform:translateY(18px)}
.js .r-services-onglets .og-p .og-tx>:nth-child(2){transition-delay:.08s}
.js .r-services-onglets .og-p .og-tx>:nth-child(3){transition-delay:.16s}
@keyframes k-services-onglets-temps{to{transform:scaleX(1)}}
@media(prefers-reduced-motion:reduce){.r-services-onglets .og-tps{display:none}}
@media(max-width:860px){.r-services-onglets .og-p{grid-template-columns:1fr}.r-services-onglets .og-liste{width:auto;max-width:none;margin-inline:calc(-1 * var(--g));padding-inline:var(--g);border-radius:0;border-inline:0}.m-comptoir .r-services-onglets .og-liste,.m-ecrin .r-services-onglets .og-liste{margin-inline:calc(-1 * var(--g))}}
`; }
};

/* ── 3. le carrousel de cartes photo ── */
const carrousel = {
  id: 'services.carrousel', rubrique: 'services', nom: 'Carrousel de cartes photo',
  quand: 'trois à six services qui ont chacun leur photo : de grandes cartes photo qui défilent au doigt ou avec les flèches, une barre montre où l\'on en est',
  familles: ['horizon', 'comptoir', 'ecrin', 'boutique', 'verdure', 'atelier'], ambiances: ['chaleureux', 'premium', 'franc'], surfaces: ['fond', 'surface'], js: ['carrousel'],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 3 && !!photosDe(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    if (!ph) return '';
    const cartes = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<li class="cr-c"' + h.rv('monte', Math.min(k, 3)) + '>' + h.figure(ph[k], 'lazy', '(max-width:700px) 80vw, 34vw') + '<div class="cr-tx"><span class="cr-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'cr-a') + '</div></li>';
    }).join('');
    return section('services.carrousel', ctx, bloc, '', '<div class="cr" data-carrousel><div class="w cr-tete">' + h.teteSec(titreSec(ctx)) + '<div class="cr-nav"><button type="button" data-prec aria-label="Service précédent">' + h.icone('fleche') + '</button><button type="button" data-suiv aria-label="Service suivant">' + h.icone('fleche') + '</button></div></div><ul class="cr-piste" data-piste tabindex="0" aria-label="' + h.esc(titreSec(ctx)) + '">' + cartes + '</ul><div class="w"><div class="cr-prog" aria-hidden="true"><i></i></div></div></div>');
  },
  // la barre sous les cartes : sa longueur est la part visible, sa place la position du défilement
  script: "[].slice.call(d.querySelectorAll('.r-services-carrousel [data-carrousel]')).forEach(function(c){var p=c.querySelector('[data-piste]'),g=c.querySelector('.cr-prog i');if(!p||!g)return;var tk=0;var maj=function(){tk=0;var m=p.scrollWidth-p.clientWidth,v=p.clientWidth/Math.max(1,p.scrollWidth);c.classList.toggle('cr-fixe',m<=4);g.style.width=(v*100).toFixed(2)+'%';g.style.left=(m>0?p.scrollLeft/m*(1-v)*100:0).toFixed(2)+'%'};p.addEventListener('scroll',function(){if(!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});w.addEventListener('resize',maj);maj()})",
  css: function () { return `
${vu('r-services-carrousel')}
.r-services-carrousel .cr-tete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:18px 40px;margin-bottom:clamp(28px,3.6vw,48px)}
.r-services-carrousel .cr-tete .tete-sec{margin:0;text-align:left;justify-items:start}
.r-services-carrousel .cr-nav{display:flex;gap:10px}
.r-services-carrousel .cr-nav button{width:56px;height:56px;flex:none;display:grid;place-items:center;border-radius:50%;border:1.5px solid var(--bord);background:transparent;color:var(--tx);cursor:pointer;transition:background-color .3s,color .3s,border-color .3s,opacity .3s,transform .45s var(--ease)}
.r-services-carrousel .cr-nav button:not(:disabled):hover{background:var(--btn);color:var(--btnT);border-color:transparent;transform:scale(1.06)}
.r-services-carrousel .cr-nav button:disabled{opacity:.32;cursor:default}
.r-services-carrousel .cr-nav [data-prec] .ic{transform:rotate(180deg)}
.r-services-carrousel .cr-fixe .cr-nav,.r-services-carrousel .cr-fixe .cr-prog{visibility:hidden}
.r-services-carrousel .cr-piste{display:grid;grid-auto-flow:column;grid-auto-columns:clamp(268px,33vw,440px);gap:clamp(14px,1.8vw,24px);overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:max(var(--g),calc((100% - var(--w)) / 2));padding:4px max(var(--g),calc((100% - var(--w)) / 2)) 8px;scrollbar-width:none}
.r-services-carrousel .cr-piste::-webkit-scrollbar{display:none}
.r-services-carrousel .cr-piste:focus-visible{outline-offset:-3px}
.r-services-carrousel .cr-c{position:relative;isolation:isolate;scroll-snap-align:start;aspect-ratio:4/5;border-radius:var(--rp);overflow:hidden;color:#fff;background:rgb(var(--voile))}
.r-services-carrousel .cr-c .ph{position:absolute;inset:0;z-index:-2;border-radius:0}
.r-services-carrousel .cr-c .ph img{transition:transform 1.4s var(--ease)}
.r-services-carrousel .cr-c:hover .ph img{transform:scale(1.07)}
.r-services-carrousel .cr-c::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / 0) 28%,rgb(var(--voile) / .5) 56%,rgb(var(--voile) / .93) 100%)}
.r-services-carrousel .cr-tx{position:absolute;inset:auto 0 0;display:grid;gap:10px;justify-items:start;padding:clamp(20px,2.2vw,30px);transition:transform .6s var(--ease)}
.r-services-carrousel .cr-c:hover .cr-tx{transform:translateY(-6px)}
.r-services-carrousel .cr-ic{width:48px;height:48px;display:grid;place-items:center;border-radius:var(--rb);background:rgb(255 255 255 / .14);border:1px solid rgb(255 255 255 / .32);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.r-services-carrousel .cr-c h3{${TT}font-size:clamp(1.55rem,2.2vw,2.15rem);line-height:var(--th);text-wrap:balance}
.r-services-carrousel .cr-c p{color:rgb(255 255 255 / .88);font-size:1rem;line-height:1.5}
.r-services-carrousel .cr-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;padding:0 16px;margin-top:4px;border-radius:var(--rb);border:1px solid rgb(255 255 255 / .38);background:rgb(255 255 255 / .12);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;font-weight:var(--fxf);font-size:.96rem;text-decoration:none;transition:background-color .35s,color .35s,border-color .35s}
.r-services-carrousel .cr-c:hover .cr-a,.r-services-carrousel .cr-a:focus-visible{background:var(--vif);color:var(--surV);border-color:transparent}
.r-services-carrousel .cr-a .ic{width:18px;height:18px}
.r-services-carrousel .cr-a .ic:last-child{transition:transform .4s var(--ease)}
.r-services-carrousel .cr-a:hover .ic:last-child{transform:translateX(4px)}
.r-services-carrousel .cr-prog{position:relative;height:3px;margin-top:clamp(20px,2.6vw,32px);border-radius:3px;background:var(--bord);overflow:hidden}
.r-services-carrousel .cr-prog i{position:absolute;top:0;bottom:0;left:0;width:34%;border-radius:3px;background:var(--accT);transition:left .25s var(--ease),width .25s}
@media(max-width:700px){.r-services-carrousel .cr-piste{grid-auto-columns:80%}}
`; }
};

/* ── 4. le bento : le premier service en grand, une tuile pour écrire ── */
const bento = {
  id: 'services.bento', rubrique: 'services', nom: 'Grille bento, le premier en grand',
  quand: 'trois à six services : une grille asymétrique, le premier service en grande tuile, les autres autour, et une tuile d\'appel ; photo dans chaque tuile si chaque service a la sienne, sinon tuiles de couleur et grandes icônes',
  familles: ['boutique', 'atelier', 'cabinet', 'verdure', 'garage', 'horizon'], ambiances: ['franc', 'chaleureux'], surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 3 && photosOuIcones(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx), n = sv.length;
    const tuiles = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte), ic = h.iconeDe(s, ctx.iconeMetier);
      const surf = !ph && k === 0 ? ' ' + vive(bloc) : '';
      const fig = ph ? h.figure(ph[k], 'lazy', k === 0 ? '(max-width:980px) 100vw, 50vw' : '(max-width:620px) 100vw, (max-width:980px) 50vw, 25vw') : '<span class="bn-fant" aria-hidden="true">' + h.icone(ic) + '</span>';
      return '<article class="bn-c bn-' + (k + 1) + surf + '"' + h.rv(k === 0 ? 'zoom' : 'monte', k) + '>' + fig + '<div class="bn-tx"><span class="bn-ic" aria-hidden="true">' + h.icone(ic) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'bn-a') + '</div></article>';
    }).join('');
    const cta = '<div class="bn-c bn-cta ' + (ph ? vive(bloc) : inverse(bloc)) + '"' + h.rv('monte', n) + '><p class="bn-q">' + h.esc(QUESTIONS[spec.objectif] || QUESTIONS.devis) + '</p>' + h.boutons(spec, { seule: true, court: true }) + '</div>';
    return section('services.bento', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="bn n' + n + (ph ? ' avec' : ' sans') + '">' + tuiles + cta + '</div></div>');
  },
  css: function () { return `
${vu('r-services-bento')}
.r-services-bento .bn{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(clamp(220px,19vw,280px),auto);gap:clamp(12px,1.4vw,18px)}
.r-services-bento .bn-1{grid-column:span 2;grid-row:span 2}
.r-services-bento .n3 .bn-2,.r-services-bento .n6 .bn-6,.r-services-bento .n6 .bn-cta{grid-column:span 2}
.r-services-bento .n5 .bn-cta{grid-column:1/-1}
.r-services-bento .bn-c{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;border-radius:var(--rp);background:var(--carte);color:var(--tx);border:1px solid var(--bord);transition:${REVELE},translate .6s var(--ease),box-shadow .6s var(--ease)}
.r-services-bento .bn-c:hover{translate:0 -5px;box-shadow:var(--ombreF)}
.r-services-bento .bn-tx{position:relative;display:grid;gap:10px;justify-items:start;padding:clamp(20px,2.2vw,30px)}
.r-services-bento .bn-ic{width:50px;height:50px;display:grid;place-items:center;border-radius:var(--rb);background:color-mix(in srgb,var(--acc) 14%,transparent);color:var(--accT);transition:transform .6s var(--ease)}
.r-services-bento .bn-c:hover .bn-ic{transform:rotate(-8deg) scale(1.06)}
.r-services-bento .bn-c h3{${TT}font-size:clamp(1.3rem,1.7vw,1.6rem);line-height:var(--th)}
.r-services-bento .bn-1 h3{font-size:clamp(1.9rem,3.2vw,3.1rem)}
.r-services-bento .bn-c p{color:var(--tx2);line-height:1.5}
.r-services-bento .bn-1 p{font-size:1.12rem;max-width:40ch}
.r-services-bento .bn-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);font-size:.96rem;color:var(--accT);text-decoration:none}
.r-services-bento .bn-a .ic{width:18px;height:18px}
.r-services-bento .bn-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-bento .bn-a:hover .ic:last-child{transform:translateX(5px)}
.r-services-bento .sans .bn-1{background:var(--bg);color:var(--tx);border-color:transparent}
.r-services-bento .sans .bn-1 .bn-ic{background:color-mix(in srgb,var(--tx) 14%,transparent);color:var(--tx)}
.r-services-bento .sans .bn-1 .bn-a{color:var(--tx)}
.r-services-bento .bn-fant{position:absolute;right:-9%;top:-12%;width:66%;aspect-ratio:1;color:currentColor;opacity:.13;z-index:-1;transform:rotate(-14deg);transition:transform 1.4s var(--ease)}
.r-services-bento .bn-fant .ic{width:100%;height:100%;stroke-width:1}
.r-services-bento .sans .bn-c:not(.bn-1) .bn-fant{width:44%;right:-6%;top:-10%;opacity:.07}
.r-services-bento .bn-c:hover .bn-fant{transform:rotate(-4deg) scale(1.05)}
.r-services-bento .avec .bn-c:not(.bn-cta){color:#fff;border:0;background:rgb(var(--voile))}
.r-services-bento .avec .bn-c .ph{position:absolute;inset:0;z-index:-2;border-radius:0}
.r-services-bento .avec .bn-c .ph img{transition:transform 1.4s var(--ease)}
.r-services-bento .avec .bn-c:hover .ph img{transform:scale(1.06)}
.r-services-bento .avec .bn-c:not(.bn-cta)::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / 0) 25%,rgb(var(--voile) / .55) 60%,rgb(var(--voile) / .9) 100%)}
.r-services-bento .avec .bn-ic{background:rgb(255 255 255 / .16);color:#fff;border:1px solid rgb(255 255 255 / .3);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.r-services-bento .avec .bn-c p{color:rgb(255 255 255 / .88)}
.r-services-bento .avec .bn-a{color:#fff}
.r-services-bento .bn-cta{background:var(--bg);color:var(--tx);border-color:transparent;justify-content:center;gap:16px;padding:clamp(22px,2.4vw,32px);align-items:flex-start}
.r-services-bento .bn-q{${TT}font-size:clamp(1.4rem,2vw,1.9rem);line-height:var(--th)}
.r-services-bento .bn-cta .actions{width:100%}
.r-services-bento .bn-cta .btn{white-space:normal;text-align:center}
@media(max-width:980px){.r-services-bento .bn{grid-template-columns:repeat(2,minmax(0,1fr))}.r-services-bento .bn-1{grid-column:1/-1;grid-row:span 1;min-height:clamp(320px,52vw,440px)}.r-services-bento .n6 .bn-6,.r-services-bento .n6 .bn-cta{grid-column:1/-1}}
@media(max-width:620px){.r-services-bento .bn{grid-template-columns:1fr}.r-services-bento .bn .bn-c{grid-column:auto;grid-row:auto}.r-services-bento .avec .bn-c:not(.bn-1):not(.bn-cta){min-height:250px}}
`; }
};

/* ── 5. la pile : les cartes s'empilent en restant collées ── */
const pile = {
  id: 'services.pile', rubrique: 'services', nom: 'Cartes qui s\'empilent au défilement',
  quand: 'trois à six services présentés un par un : de grandes cartes collées en haut de l\'écran qui viennent se poser l\'une sur l\'autre, celle du dessous recule ; photo si chaque service a la sienne, sinon une grande icône',
  familles: [], ambiances: ['franc', 'premium', 'chaleureux'], surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 3 && photosOuIcones(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    const tons = ['', inverse(bloc), vive(bloc)];
    const cartes = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte), ic = h.iconeDe(s, ctx.iconeMetier);
      const vis = ph ? '<div class="pi-vis">' + h.figure(ph[k], 'lazy', '(max-width:860px) 100vw, 55vw') + '</div>' : '<div class="pi-vis pi-scene" aria-hidden="true"><span class="pi-g">' + h.icone(ic) + '</span></div>';
      return '<li class="pi-c' + (tons[k % 3] ? ' ' + tons[k % 3] : '') + '" style="--k:' + k + '"><div class="pi-in"><div class="pi-tx"><span class="pi-ic" aria-hidden="true">' + h.icone(ic) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + (a ? ouvre(h, a, 'btn b1', ' aria-label="' + h.esc(a.texte + ' : ' + t) + '"') + h.contenuBouton(a.icone, a.texte) + '</a>' : '') + '</div>' + vis + '</div></li>';
    }).join('');
    return section('services.pile', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<ol class="pi" style="--n:' + sv.length + '">' + cartes + '</ol></div>');
  },
  // la carte que la suivante recouvre recule et s'assombrit un peu (seulement quand la pile est à l'écran)
  script: "[].slice.call(d.querySelectorAll('.r-services-pile')).forEach(function(s){var cs=[].slice.call(s.querySelectorAll('.pi-c'));if(cs.length<2||calme)return;var vis=true,tk=0;var maj=function(){tk=0;for(var i=0;i<cs.length-1;i++){var a=cs[i].getBoundingClientRect(),n=cs[i+1].getBoundingClientRect();var k=Math.max(0,Math.min(1,(a.bottom-n.top)/Math.max(1,a.height)));cs[i].style.setProperty('--e',k.toFixed(3))}};if('IntersectionObserver' in w)new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)maj()}).observe(s);w.addEventListener('scroll',function(){if(vis&&!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});w.addEventListener('resize',maj);maj()})",
  css: function () { return `
${vu('r-services-pile')}
.r-services-pile .pi{display:grid;gap:clamp(28px,9vh,90px)}
.r-services-pile .pi-c{position:sticky;top:calc(clamp(18px,5vh,56px) + var(--k) * 18px);transform-origin:50% 0;transform:scale(calc(1 - var(--e,0) * .05));border-radius:calc(var(--r) * 1.6 + 6px);background:var(--carte);color:var(--tx);border:1px solid var(--bord);box-shadow:0 -18px 44px -30px rgb(0 0 0 / .45),var(--ombre);overflow:hidden;will-change:transform}
.r-services-pile .pi-c.s-champ,.r-services-pile .pi-c.s-fond,.r-services-pile .pi-c.s-accent{background:var(--bg);border-color:transparent}
.r-services-pile .pi-c::after{content:"";position:absolute;inset:0;background:#000;opacity:calc(var(--e,0) * .3);pointer-events:none;transition:opacity .2s}
.r-services-pile .pi-in{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);min-height:min(520px,calc(100vh - 180px))}
.r-services-pile .pi-tx{display:grid;gap:18px;align-content:center;justify-items:start;padding:clamp(28px,4.4vw,64px)}
.r-services-pile .pi-ic{width:58px;height:58px;display:grid;place-items:center;border-radius:var(--rb);background:color-mix(in srgb,var(--acc) 16%,transparent);color:var(--accT)}
.r-services-pile .pi-ic .ic{width:28px;height:28px}
.r-services-pile .pi-c.s-accent .pi-ic{background:color-mix(in srgb,var(--tx) 16%,transparent);color:var(--tx)}
.r-services-pile .pi-tx h3{${TT}font-size:clamp(2rem,3.6vw,3.6rem);line-height:var(--th)}
.r-services-pile .pi-tx p{font-size:1.14rem;line-height:1.6;color:var(--tx2);max-width:38ch}
.r-services-pile .pi-vis{position:relative;min-height:260px}
.r-services-pile .pi-vis .ph{position:absolute;inset:clamp(10px,1.2vw,16px);border-radius:calc(var(--r) * 1.2 + 2px)}
.r-services-pile .pi-scene{display:grid;place-items:center;overflow:hidden;background:repeating-radial-gradient(circle at 50% 50%,transparent 0 46px,color-mix(in srgb,var(--tx) 9%,transparent) 46px 47px),radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--acc) 22%,transparent),transparent 60%)}
.r-services-pile .pi-g{width:clamp(130px,15vw,200px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);box-shadow:0 0 0 14px color-mix(in srgb,var(--btn) 18%,transparent),0 30px 60px -24px rgb(0 0 0 / .5);transition:transform 1.2s var(--ease)}
.r-services-pile .pi-g .ic{width:46%;height:46%;stroke-width:1.4}
.r-services-pile .pi-c:hover .pi-g{transform:rotate(-10deg) scale(1.04)}
@media(max-width:860px){.r-services-pile .pi-c{top:calc(14px + var(--k) * 12px)}.r-services-pile .pi-in{grid-template-columns:1fr;min-height:0}.r-services-pile .pi-vis{min-height:0;aspect-ratio:16/10;order:-1}.r-services-pile .pi-scene{aspect-ratio:2/1}.r-services-pile .pi-g{width:110px}.r-services-pile .pi-tx{padding:24px 22px 28px;gap:14px}}
`; }
};

/* ── 6. le titre collé à gauche, les services défilent à droite ── */
const colle = {
  id: 'services.colle', rubrique: 'services', photo: 'non', nom: 'Titre collé, services qui défilent',
  quand: 'trois à six services sans photo : le titre, un sommaire qui suit la lecture et le bouton restent collés à gauche pendant que les services défilent à droite avec leur icône',
  familles: ['cabinet', 'atelier', 'verdure', 'garage', 'boutique'], ambiances: ['calme', 'franc'], surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx);
    const som = '<nav class="cl-som" aria-label="Aller à un service">' + sv.map(function (s, k) { return '<a href="#srv-colle-' + (k + 1) + '"' + (k === 0 ? ' class="on"' : '') + '><i aria-hidden="true"></i><span>' + h.esc(h.net(s.titre)) + '</span></a>'; }).join('') + '</nav>';
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<li class="cl-it' + (k === 0 ? ' on' : '') + '" id="srv-colle-' + (k + 1) + '"' + h.rv('monte') + '><span class="cl-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><div class="cl-tx"><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'cl-a') + '</div></li>';
    }).join('');
    return section('services.colle', ctx, bloc, '', '<div class="w cl"><div class="cl-g"><div class="cl-coll"><div class="tete-sec"' + h.rv('monte') + '><h2 class="t">' + h.esc(titreSec(ctx)) + '</h2></div>' + som + '<div class="cl-act"' + h.rv('monte', 2) + '>' + h.boutons(spec, { seule: true }) + '</div></div></div><ul class="cl-l">' + items + '</ul></div>');
  },
  // le sommaire suit la lecture : le service au milieu de l'écran est marqué
  script: "[].slice.call(d.querySelectorAll('.r-services-colle')).forEach(function(s){var ls=[].slice.call(s.querySelectorAll('.cl-som a')),its=[].slice.call(s.querySelectorAll('.cl-it'));if(!ls.length||!('IntersectionObserver' in w))return;var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var k=its.indexOf(e.target);its.forEach(function(x,i){x.classList.toggle('on',i===k)});ls.forEach(function(a,i){a.classList.toggle('on',i===k);if(i===k)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')})})},{rootMargin:'-42% 0px -52% 0px'});its.forEach(function(e){io.observe(e)})})",
  css: function () { return `
${vu('r-services-colle')}
.r-services-colle .cl{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(32px,6vw,110px);align-items:start}
.r-services-colle .cl-g{align-self:stretch}
.r-services-colle .cl-coll{position:sticky;top:clamp(96px,14vh,140px);display:grid;gap:clamp(22px,3vw,36px)}
.r-services-colle .cl-coll .tete-sec{margin:0;text-align:left;justify-items:start}
.r-services-colle .cl-som{display:grid;gap:2px;border-left:1px solid var(--bord)}
.r-services-colle .cl-som a{position:relative;display:flex;align-items:center;gap:12px;min-height:44px;padding:6px 0 6px 20px;color:var(--tx2);text-decoration:none;font-weight:var(--fxf);font-size:1rem;transition:color .35s}
.r-services-colle .cl-som i{position:absolute;left:-1px;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--acc);transform:scaleY(0);transition:transform .5s var(--ease)}
.r-services-colle .cl-som a.on,.r-services-colle .cl-som a:hover{color:var(--tx)}
.r-services-colle .cl-som a.on i{transform:none}
.r-services-colle .cl-l{display:grid}
.r-services-colle .cl-it{display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(18px,2.6vw,36px);align-items:start;padding:clamp(30px,4.4vw,60px) 0;border-top:1px solid var(--bord);scroll-margin-top:30vh}
.r-services-colle .cl-it:last-child{border-bottom:1px solid var(--bord)}
.r-services-colle .cl-ic{position:relative;width:clamp(64px,6vw,84px);aspect-ratio:1;display:grid;place-items:center;border-radius:var(--rb);background:color-mix(in srgb,var(--acc) 13%,transparent);color:var(--accT);transition:background-color .5s,color .5s,transform .7s var(--ease)}
.r-services-colle .cl-ic .ic{width:42%;height:42%;stroke-width:1.6}
.r-services-colle .cl-ic::after{content:"";position:absolute;inset:-7px;border-radius:calc(var(--rb) + 7px);border:1.5px solid var(--acc);opacity:0;transform:scale(.9);transition:opacity .5s,transform .7s var(--ease)}
.r-services-colle .cl-it.on .cl-ic{background:var(--btn);color:var(--btnT);transform:rotate(-6deg)}
.r-services-colle .cl-it.on .cl-ic::after{opacity:.4;transform:none}
.r-services-colle .cl-tx{display:grid;gap:12px;justify-items:start}
.r-services-colle .cl-tx h3{${TT}font-size:clamp(1.7rem,3vw,2.8rem);line-height:var(--th)}
.r-services-colle .cl-tx p{font-size:1.12rem;color:var(--tx2);max-width:44ch}
.r-services-colle .cl-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.r-services-colle .cl-a .ic{width:18px;height:18px}
.r-services-colle .cl-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-colle .cl-a:hover .ic:last-child{transform:translateX(5px)}
@media(max-width:860px){.r-services-colle .cl{grid-template-columns:1fr}.r-services-colle .cl-coll{position:static}.r-services-colle .cl-som{display:none}.r-services-colle .cl-it{grid-template-columns:1fr;gap:16px}}
`; }
};

/* ── 7. l'accordéon : le service ouvert montre sa photo ── */
const accordeon = {
  id: 'services.accordeon', rubrique: 'services', nom: 'Accordéon, la photo du service ouvert',
  quand: 'deux à six services : une liste qui s\'ouvre un service à la fois ; la photo (ou la grande icône) du service ouvert s\'affiche à côté sur ordinateur, dans le service sur téléphone',
  familles: [], ambiances: ['calme', 'premium', 'franc'], surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && photosOuIcones(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<details class="ac-d" name="services-ouverts"' + (k === 0 ? ' open' : '') + h.rv('monte', k) + '><summary><span class="ac-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(t) + '</h3><span class="ac-plus" aria-hidden="true"></span></summary><div class="ac-rep">' + (ph ? h.figure(ph[k], 'lazy', '100vw', { classe: 'ac-vig' }) : '') + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'ac-a') + '</div></details>';
    }).join('');
    const vis = '<div class="ac-vis' + (ph ? '' : ' ac-sans') + '" aria-hidden="true">' + sv.map(function (s, k) { return ph ? h.figure(ph[k], 'lazy', '(max-width:860px) 1px, 45vw') : '<div class="ac-st"><span class="ac-g">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><span class="ac-n">' + h.esc(h.net(s.titre)) + '</span></div>'; }).join('') + '</div>';
    return section('services.accordeon', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="ac"><div class="ac-l">' + items + '</div>' + vis + '</div></div>');
  },
  css: function () {
    const montre = [1, 2, 3, 4, 5, 6].map(function (k) { return '.r-services-accordeon .ac:has(.ac-d:nth-child(' + k + ')[open]) .ac-vis>:nth-child(' + k + ')'; }).join(',');
    return `
${vu('r-services-accordeon')}
.r-services-accordeon .ac{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(28px,5vw,84px);align-items:stretch}
.r-services-accordeon .ac-d{border-top:1px solid var(--bord)}
.r-services-accordeon .ac-d:last-child{border-bottom:1px solid var(--bord)}
.r-services-accordeon summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:52px minmax(0,1fr) 30px;align-items:center;gap:18px;padding:clamp(18px,2.2vw,26px) 0;-webkit-tap-highlight-color:transparent}
.r-services-accordeon summary::-webkit-details-marker{display:none}
.r-services-accordeon summary:hover h3{color:var(--accT)}
.r-services-accordeon .ac-ic{width:52px;height:52px;display:grid;place-items:center;border-radius:var(--rb);background:color-mix(in srgb,var(--acc) 13%,transparent);color:var(--accT);transition:background-color .4s,color .4s,transform .7s var(--ease)}
.r-services-accordeon details[open] .ac-ic{background:var(--btn);color:var(--btnT);transform:rotate(-8deg)}
.r-services-accordeon summary h3{${TT}font-size:clamp(1.4rem,2.3vw,2.15rem);line-height:var(--th);transition:color .3s}
.r-services-accordeon details[open] summary h3{color:var(--accT)}
.r-services-accordeon .ac-plus{position:relative;width:30px;height:30px;border-radius:50%;border:1.5px solid var(--bord);transition:transform .6s var(--ease),background-color .3s,border-color .3s}
.r-services-accordeon .ac-plus::before,.r-services-accordeon .ac-plus::after{content:"";position:absolute;left:50%;top:50%;width:12px;height:2px;margin:-1px 0 0 -6px;border-radius:2px;background:currentColor;transition:transform .6s var(--ease)}
.r-services-accordeon .ac-plus::after{transform:rotate(90deg)}
.r-services-accordeon details[open] .ac-plus{transform:rotate(180deg);border-color:var(--acc)}
.r-services-accordeon details[open] .ac-plus::after{transform:rotate(0deg)}
.r-services-accordeon .ac-rep{display:grid;gap:14px;justify-items:start;padding:0 0 clamp(22px,2.6vw,30px) 70px}
.r-services-accordeon details[open] .ac-rep{animation:k-services-accordeon-ouvre .7s var(--ease)}
.r-services-accordeon .ac-rep p{color:var(--tx2);font-size:1.1rem;max-width:50ch}
.r-services-accordeon .ac-vig{display:none}
.r-services-accordeon .ac-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.r-services-accordeon .ac-a .ic{width:18px;height:18px}
.r-services-accordeon .ac-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-accordeon .ac-a:hover .ic:last-child{transform:translateX(5px)}
.r-services-accordeon .ac-vis{position:relative;min-height:clamp(360px,34vw,480px);border-radius:var(--rp);overflow:hidden;background:var(--douce);box-shadow:var(--ombreF)}
.r-services-accordeon .ac-vis>*{position:absolute;inset:0;opacity:0;transform:scale(1.06);transition:opacity .7s var(--ease),transform 1.3s var(--ease)}
.r-services-accordeon .ac-vis .ph{border-radius:0}
${montre}{opacity:1;transform:none}
.r-services-accordeon .ac:not(:has(details[open])) .ac-vis>:first-child{opacity:1;transform:none}
@supports not selector(:has(*)){.r-services-accordeon .ac-vis>:first-child{opacity:1;transform:none}}
.r-services-accordeon .ac-sans{box-shadow:none;border:1px solid var(--bord);background:radial-gradient(color-mix(in srgb,var(--tx) 16%,transparent) 1px,transparent 1.6px) 0 0/24px 24px,var(--carte)}
.r-services-accordeon .ac-st{display:grid;place-items:center;align-content:center;gap:28px;padding:30px;text-align:center}
.r-services-accordeon .ac-g{width:clamp(130px,14vw,190px);aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);box-shadow:0 0 0 16px color-mix(in srgb,var(--btn) 14%,transparent),0 0 0 36px color-mix(in srgb,var(--btn) 7%,transparent)}
.r-services-accordeon .ac-g .ic{width:46%;height:46%;stroke-width:1.3}
.r-services-accordeon .ac-n{${TT}font-size:clamp(1.4rem,2.2vw,2rem);line-height:var(--th);max-width:16ch}
@keyframes k-services-accordeon-ouvre{from{opacity:0;transform:translateY(-8px)}}
@media(prefers-reduced-motion:reduce){.r-services-accordeon details[open] .ac-rep{animation:none}}
@media(max-width:860px){.r-services-accordeon .ac{grid-template-columns:1fr}.r-services-accordeon .ac-vis{display:none}.r-services-accordeon .ac-vig{display:block;width:100%;aspect-ratio:16/10}.r-services-accordeon .ac-rep{padding-left:0}.r-services-accordeon summary{grid-template-columns:46px minmax(0,1fr) 30px;gap:14px}.r-services-accordeon .ac-ic{width:46px;height:46px}}
`; }
};

/* ── 8. les affiches : cartes photo pleines, le texte monte au survol ── */
const affiches = {
  id: 'services.affiches', rubrique: 'services', nom: 'Affiches photo, le texte monte',
  quand: 'deux à six services qui ont chacun leur photo : de grandes affiches en hauteur, décalées, voile en dégradé, la ligne de texte monte au survol (toujours visible sur téléphone)',
  familles: ['horizon', 'ecrin', 'comptoir', 'boutique', 'verdure'], ambiances: ['premium', 'chaleureux'], surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && !!photosDe(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    if (!ph) return '';
    const cartes = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<article class="af-c"' + h.rv('monte', k) + '>' + h.figure(ph[k], 'lazy', '(max-width:560px) 100vw, (max-width:1100px) 50vw, 30vw') + '<div class="af-tx"><span class="af-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(t) + '</h3><div class="af-plus"><div>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'af-a') + '</div></div></div></article>';
    }).join('');
    return section('services.affiches', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="af n' + sv.length + '">' + cartes + '</div></div>');
  },
  css: function () { return `
${vu('r-services-affiches')}
.r-services-affiches .af{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,1.8vw,24px);align-items:start}
.r-services-affiches .af.n2{grid-template-columns:repeat(2,minmax(0,1fr))}
.r-services-affiches .af.n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.r-services-affiches .af-c{position:relative;isolation:isolate;aspect-ratio:3/4;border-radius:var(--rp);overflow:hidden;color:#fff;background:rgb(var(--voile))}
.r-services-affiches .af.n2 .af-c{aspect-ratio:4/3}
@media(min-width:861px){.r-services-affiches .af-c:nth-child(even){margin-top:clamp(28px,4vw,64px)}}
.r-services-affiches .af-c .ph{position:absolute;inset:0;z-index:-2;border-radius:0}
.r-services-affiches .af-c .ph img{transition:transform 1.4s var(--ease)}
.js .r-services-affiches .af-c .ph{transition:clip-path 1.4s var(--ease) calc(.15s + var(--i,0) * var(--pas))}
.js .r-services-affiches .af-c:not(.vu) .ph{clip-path:inset(100% 0 0 0)}
.js .r-services-affiches .af-c:not(.vu) .ph img{transform:scale(1.16)}
.js .r-services-affiches .af-c .af-tx{transition:opacity .8s var(--ease) calc(.6s + var(--i,0) * var(--pas)),transform 1s var(--ease) calc(.6s + var(--i,0) * var(--pas))}
.js .r-services-affiches .af-c:not(.vu) .af-tx{opacity:0;transform:translateY(16px)}
@media(prefers-reduced-motion:reduce){.js .r-services-affiches .af-c .ph,.js .r-services-affiches .af-c .af-tx{transition:none}}
.r-services-affiches .af-c:hover .ph img{transform:scale(1.07)}
.r-services-affiches .af-c::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / .02) 0%,rgb(var(--voile) / .12) 42%,rgb(var(--voile) / .9) 100%);transition:background-color .6s}
.r-services-affiches .af-c::before{content:"";position:absolute;inset:10px;z-index:1;border:1px solid rgb(255 255 255 / .4);border-radius:calc(var(--rp) * .7);pointer-events:none;opacity:0;transform:scale(1.04);transition:opacity .5s,transform .8s var(--ease)}
.r-services-affiches .af-c:hover::before,.r-services-affiches .af-c:focus-within::before{opacity:1;transform:none}
.r-services-affiches .af-tx{position:absolute;inset:auto 0 0;z-index:2;display:grid;justify-items:start;gap:12px;padding:clamp(20px,2.2vw,30px)}
.r-services-affiches .af-ic{width:46px;height:46px;display:grid;place-items:center;border-radius:50%;background:rgb(255 255 255 / .16);border:1px solid rgb(255 255 255 / .32);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .7s var(--ease)}
.r-services-affiches .af-c:hover .af-ic{transform:rotate(-12deg)}
.r-services-affiches .af-tx h3{${TT}font-size:clamp(1.5rem,2.1vw,2.15rem);line-height:var(--th);text-wrap:balance}
.r-services-affiches .af-plus{display:grid;grid-template-rows:0fr;transition:grid-template-rows .7s var(--ease)}
.r-services-affiches .af-plus>div{overflow:hidden;display:grid;gap:10px;justify-items:start}
.r-services-affiches .af-plus p{color:rgb(255 255 255 / .9);line-height:1.5}
.r-services-affiches .af-c:hover .af-plus,.r-services-affiches .af-c:focus-within .af-plus{grid-template-rows:1fr}
.r-services-affiches .af-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);font-size:.96rem;color:#fff;text-decoration:none}
.r-services-affiches .af-a .ic{width:18px;height:18px}
.r-services-affiches .af-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-affiches .af-a:hover .ic:last-child{transform:translateX(5px)}
@media(hover:none),(max-width:860px){.r-services-affiches .af-plus{grid-template-rows:1fr}}
@media(max-width:1100px){.r-services-affiches .af.n4{grid-template-columns:repeat(2,minmax(0,1fr))}.r-services-affiches .af.n4 .af-c{aspect-ratio:4/5}}
@media(max-width:860px){.r-services-affiches .af{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.r-services-affiches .af,.r-services-affiches .af.n2,.r-services-affiches .af.n4{grid-template-columns:1fr}.r-services-affiches .af-c,.r-services-affiches .af.n4 .af-c,.r-services-affiches .af.n2 .af-c{aspect-ratio:4/5}}
`; }
};

/* ── 9. les rangées alternées : photo révélée en rideau ── */
const zigzag = {
  id: 'services.zigzag', rubrique: 'services', nom: 'Rangées photo et texte en alternance',
  quand: 'deux à cinq services qui ont chacun leur photo et méritent d\'être lus : une rangée par service, photo et texte qui changent de côté, la photo s\'ouvre en rideau et glisse doucement au défilement',
  familles: ['verdure', 'atelier', 'horizon', 'cabinet', 'ecrin'], ambiances: ['calme', 'chaleureux', 'premium'], surfaces: ['fond', 'surface'], js: ['parallaxe'],
  besoin: function (spec, ctx) { const n = nombre(spec, ctx); return n >= 2 && n <= 5 && !!photosDe(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    if (!ph) return '';
    const rangs = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<article class="zz-r"><div class="zz-vis"' + h.rv('mots') + '><figure class="ph zz-ph"><div class="zz-px" data-px="0.05">' + h.img(ph[k], 'lazy', '(max-width:860px) 100vw, 52vw') + '</div></figure><span class="zz-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span></div><div class="zz-tx"' + h.rv(k % 2 ? 'gauche' : 'droite', 1) + '><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'zz-a') + '</div></article>';
    }).join('');
    return section('services.zigzag', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="zz">' + rangs + '</div></div>');
  },
  css: function () { return `
${vu('r-services-zigzag')}
.r-services-zigzag .zz{display:grid;gap:clamp(56px,8vw,120px)}
.r-services-zigzag .zz-r{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(30px,5.5vw,96px);align-items:center}
.r-services-zigzag .zz-r:nth-child(even) .zz-vis{order:2}
.r-services-zigzag .zz-vis{position:relative}
.r-services-zigzag .zz-vis::before{content:"";position:absolute;inset:0;border:2px solid var(--acc);border-radius:var(--rp);transform:translate(18px,18px);opacity:.5}
.r-services-zigzag .zz-r:nth-child(even) .zz-vis::before{transform:translate(-18px,18px)}
.r-services-zigzag .zz-ph{aspect-ratio:5/4;box-shadow:var(--ombreF)}
.r-services-zigzag .zz-px{position:absolute;inset:-14% 0;will-change:transform}
.r-services-zigzag .zz-ph img{transition:transform 1.9s var(--ease)}
.js .r-services-zigzag .zz-ph{transition:clip-path 1.4s var(--ease)}
.js .r-services-zigzag .zz-vis:not(.vu) .zz-ph{clip-path:inset(0 100% 0 0)}
.js .r-services-zigzag .zz-r:nth-child(even) .zz-vis:not(.vu) .zz-ph{clip-path:inset(0 0 0 100%)}
.js .r-services-zigzag .zz-vis:not(.vu) .zz-ph img{transform:scale(1.16)}
.js .r-services-zigzag .zz-vis::before,.js .r-services-zigzag .zz-ic{transition:opacity .8s var(--ease) .7s,scale .9s var(--ease) .7s}
.js .r-services-zigzag .zz-vis:not(.vu)::before{opacity:0}
.js .r-services-zigzag .zz-vis:not(.vu) .zz-ic{opacity:0;scale:.6}
@media(prefers-reduced-motion:reduce){.js .r-services-zigzag .zz-ph,.js .r-services-zigzag .zz-vis::before,.js .r-services-zigzag .zz-ic{transition:none}}
.r-services-zigzag .zz-ic{position:absolute;left:clamp(-14px,-1.4vw,-8px);top:clamp(18px,3vw,36px);width:62px;height:62px;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);box-shadow:0 0 0 6px var(--bg),var(--ombre)}
.r-services-zigzag .zz-r:nth-child(even) .zz-ic{left:auto;right:clamp(-14px,-1.4vw,-8px)}
.r-services-zigzag .zz-ic .ic{width:28px;height:28px}
.r-services-zigzag .zz-tx{display:grid;gap:16px;justify-items:start;max-width:520px}
.r-services-zigzag .zz-tx h3{${TT}font-size:clamp(1.9rem,3.2vw,3.1rem);line-height:var(--th)}
.r-services-zigzag .zz-tx p{font-size:1.12rem;line-height:1.6;color:var(--tx2)}
.r-services-zigzag .zz-a{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none;background:linear-gradient(currentColor,currentColor) 0 calc(100% - 7px)/0 2px no-repeat;transition:background-size .55s var(--ease)}
.r-services-zigzag .zz-a:hover{background-size:100% 2px}
.r-services-zigzag .zz-a .ic{width:18px;height:18px}
.r-services-zigzag .zz-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-zigzag .zz-a:hover .ic:last-child{transform:translateX(5px)}
@media(max-width:860px){.r-services-zigzag .zz-r{grid-template-columns:1fr;gap:26px}.r-services-zigzag .zz-r:nth-child(even) .zz-vis{order:0}.r-services-zigzag .zz-vis::before,.r-services-zigzag .zz-r:nth-child(even) .zz-vis::before{transform:translate(10px,10px)}.r-services-zigzag .zz-ic,.r-services-zigzag .zz-r:nth-child(even) .zz-ic{left:auto;right:14px;top:auto;bottom:-22px}}
`; }
};

/* ── 10. les anneaux : icônes cerclées, l'anneau se trace puis tourne au survol ── */
const anneaux = {
  id: 'services.anneaux', rubrique: 'services', photo: 'non', nom: 'Icônes dans des anneaux',
  quand: 'trois à six services sans photo, au ton posé : chaque icône dans un cercle dont l\'anneau se trace à l\'arrivée, se ferme et tourne au survol',
  familles: ['cabinet', 'verdure', 'ecrin', 'atelier', 'horizon'], ambiances: ['calme', 'premium'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 3 && iconesVariees(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx);
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<li class="an-it"' + h.rv('monte', k % 3) + '><span class="an-o" aria-hidden="true"><svg class="an-s" viewBox="0 0 120 120"><circle class="an-f" cx="60" cy="60" r="54"/><circle class="an-arc" cx="60" cy="60" r="54" pathLength="100"/><circle class="an-pt" cx="60" cy="60" r="59" pathLength="100"/></svg><span class="an-ic">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span></span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'an-a') + '</li>';
    }).join('');
    return section('services.anneaux', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx), null, { classe: 'c' }) + '<ul class="an n' + sv.length + '">' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-services-anneaux')}
.r-services-anneaux .an{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(40px,4.4vw,64px) clamp(20px,3vw,44px)}
.r-services-anneaux .an.n4{grid-template-columns:repeat(4,minmax(0,1fr))}
.r-services-anneaux .an-it{display:grid;justify-items:center;align-content:start;gap:12px;text-align:center}
.r-services-anneaux .an-o{position:relative;width:136px;height:136px;display:grid;place-items:center;margin-bottom:10px}
.r-services-anneaux .an-s{position:absolute;inset:0;width:100%;height:100%;overflow:visible;transform:rotate(-90deg);transition:transform 1.3s var(--ease)}
.r-services-anneaux .an-s circle{fill:none;stroke-width:2.5}
.r-services-anneaux .an-f{stroke:var(--bord)}
.r-services-anneaux .an-arc{stroke:var(--acc);stroke-linecap:round;stroke-dasharray:100 100;stroke-dashoffset:30;transition:stroke-dashoffset 1s var(--ease)}
.js .r-services-anneaux .an-it.vu .an-arc{animation:k-services-anneaux-trace 1.8s var(--ease) calc(.3s + var(--i,0) * .14s) backwards}
.r-services-anneaux .an-pt{stroke:var(--tx2);stroke-width:2.2;stroke-linecap:round;stroke-dasharray:.01 4.15;opacity:0;transition:opacity .6s}
.r-services-anneaux .an-ic{width:86px;height:86px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--acc) 13%,var(--bg));color:var(--accT);transition:background-color .45s,color .45s,transform .7s var(--ease)}
.r-services-anneaux .an-ic .ic{width:36px;height:36px;stroke-width:1.6}
.r-services-anneaux .an-it:hover .an-s{transform:rotate(270deg)}
.r-services-anneaux .an-it:hover .an-arc{stroke-dashoffset:0}
.r-services-anneaux .an-it:hover .an-pt{opacity:.75}
.r-services-anneaux .an-it:hover .an-ic{background:var(--btn);color:var(--btnT);transform:scale(1.05)}
.r-services-anneaux .an-it h3{${TT}font-size:clamp(1.35rem,1.9vw,1.75rem);line-height:var(--th)}
.r-services-anneaux .an-it p{color:var(--tx2);max-width:32ch}
.r-services-anneaux .an-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);font-size:.96rem;color:var(--accT);text-decoration:none}
.r-services-anneaux .an-a .ic{width:18px;height:18px}
.r-services-anneaux .an-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-anneaux .an-a:hover .ic:last-child{transform:translateX(5px)}
@keyframes k-services-anneaux-trace{from{stroke-dashoffset:100}}
@media(prefers-reduced-motion:reduce){.js .r-services-anneaux .an-it.vu .an-arc{animation:none}}
@media(max-width:980px){.r-services-anneaux .an,.r-services-anneaux .an.n4{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.r-services-anneaux .an,.r-services-anneaux .an.n4{grid-template-columns:1fr}}
`; }
};

/* ── 11. les lignes : chaque ligne se remplit de couleur au survol ── */
const lignes = {
  id: 'services.lignes', rubrique: 'services', photo: 'non', nom: 'Liste éditoriale qui se remplit',
  quand: 'deux à six services sans photo : une liste à grands titres, chaque ligne est un lien vers WhatsApp pour ce service, elle se remplit de couleur au survol et sa flèche glisse',
  familles: ['atelier', 'cabinet', 'garage', 'boutique', 'horizon', 'verdure', 'ecrin'], ambiances: ['franc', 'calme', 'premium'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && !(ctx.da && ctx.da.modele === 'comptoir'); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx);
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      const c = '<span class="lg-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3 class="lg-t">' + h.esc(t) + '</h3>' + (x ? '<p class="lg-x">' + h.esc(x) + '</p>' : '<span></span>') + (a ? '<span class="lg-go"><span class="lg-gl">' + h.esc(a.texte) + '</span><span class="lg-fl" aria-hidden="true">' + h.icone('fleche') + '</span></span>' : '');
      return '<li' + h.rv('monte', k) + '>' + (a ? ouvre(h, a, 'lg-l') + c + '</a>' : '<div class="lg-l">' + c + '</div>') + '</li>';
    }).join('');
    return section('services.lignes', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<ul class="lg" style="--kl:' + kTitres(sv, ctx) + '">' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-services-lignes')}
.r-services-lignes .lg{container-type:inline-size;border-bottom:1px solid var(--bord)}
.r-services-lignes .lg-l{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:64px minmax(0,1.35fr) minmax(0,.85fr) auto;align-items:center;gap:16px clamp(18px,3vw,44px);padding:clamp(20px,2.4vw,30px) clamp(12px,1.8vw,24px);border-top:1px solid var(--bord);color:var(--tx);text-decoration:none;transition:color .45s}
.r-services-lignes .lg-l::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--btn);transform:scaleX(0);transform-origin:right;transition:transform .65s var(--ease)}
.r-services-lignes a.lg-l:hover::before,.r-services-lignes a.lg-l:focus-visible::before{transform:scaleX(1);transform-origin:left}
.r-services-lignes a.lg-l:hover,.r-services-lignes a.lg-l:focus-visible{color:var(--btnT)}
.r-services-lignes .lg-ic{width:64px;height:64px;display:grid;place-items:center;border:1.5px solid var(--bord);border-radius:var(--rb);color:var(--accT);transition:border-color .45s,color .45s,transform .7s var(--ease)}
.r-services-lignes .lg-ic .ic{width:28px;height:28px;stroke-width:1.6}
.r-services-lignes a.lg-l:hover .lg-ic,.r-services-lignes a.lg-l:focus-visible .lg-ic{border-color:currentColor;color:inherit;transform:rotate(-10deg)}
.r-services-lignes .lg-t{${TT}font-size:max(1.4rem,min(2.6rem,calc(46cqi / var(--kl))));line-height:var(--th);transition:transform .7s var(--ease)}
.r-services-lignes a.lg-l:hover .lg-t{transform:translateX(8px)}
.r-services-lignes .lg-x{color:var(--tx2);transition:color .45s}
.r-services-lignes a.lg-l:hover .lg-x,.r-services-lignes a.lg-l:focus-visible .lg-x{color:inherit}
.r-services-lignes .lg-go{display:inline-flex;align-items:center;gap:12px;font-weight:var(--fxf);font-size:.96rem;white-space:nowrap}
.r-services-lignes .lg-gl{opacity:0;transform:translateX(14px);transition:opacity .4s,transform .6s var(--ease)}
.r-services-lignes a.lg-l:hover .lg-gl,.r-services-lignes a.lg-l:focus-visible .lg-gl{opacity:1;transform:none}
.r-services-lignes .lg-fl{width:50px;height:50px;display:grid;place-items:center;border-radius:50%;border:1.5px solid currentColor;transition:transform .6s var(--ease)}
.r-services-lignes a.lg-l:hover .lg-fl{transform:translateX(6px)}
@media(hover:none){.r-services-lignes .lg-gl{opacity:1;transform:none}}
@media(max-width:860px){.r-services-lignes .lg-l{grid-template-columns:52px minmax(0,1fr);padding-inline:0;gap:12px 16px}.r-services-lignes .lg-ic{width:52px;height:52px}.r-services-lignes .lg-x,.r-services-lignes .lg-go{grid-column:2}.r-services-lignes .lg-go{justify-self:start}.r-services-lignes .lg-gl{opacity:1;transform:none}.r-services-lignes .lg-fl{width:40px;height:40px}.r-services-lignes .lg-t{font-size:max(1.35rem,min(2.1rem,calc(76cqi / var(--kl))))}.r-services-lignes a.lg-l:hover .lg-t{transform:none}}
`; }
};

/* ── 12. les tuiles de nuit : icône lumineuse, halo qui suit la souris ── */
const nuit = {
  id: 'services.nuit', rubrique: 'services', photo: 'non', nom: 'Tuiles sombres, icônes lumineuses',
  quand: 'deux à six services sans photo, pour une bande sombre : tuiles de nuit, icônes qui s\'allument à l\'arrivée, une lumière et un liseré qui suivent la souris',
  familles: ['garage', 'atelier', 'cabinet', 'horizon', 'boutique'], ambiances: ['franc', 'premium'], surfaces: ['champ', 'fond'], js: ['halo'],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && iconesVariees(spec, ctx) && nuitPossible(ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx);
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<li class="nu-c" data-halo' + h.rv('monte', k % 3) + '><span class="nu-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'nu-a') + '</li>';
    }).join('');
    return section('services.nuit', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<ul class="nu n' + sv.length + '">' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-services-nuit')}
.r-services-nuit .nu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.4vw,18px)}
.r-services-nuit .nu.n2,.r-services-nuit .nu.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.r-services-nuit .nu-c{--tx:var(--surC);--tx2:var(--champDoux);--acc:var(--accC);--accT:var(--accC);--btn:var(--btnC);--btnT:var(--btnCT);position:relative;isolation:isolate;overflow:hidden;display:grid;gap:12px;align-content:start;justify-items:start;padding:clamp(28px,3vw,42px);border-radius:var(--r);background:color-mix(in srgb,var(--surC) 4%,var(--champ));color:var(--tx)}
.r-services-nuit .nu-c::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(440px circle at var(--mx,18%) var(--my,0%),color-mix(in srgb,var(--accC) 17%,transparent),transparent 65%);opacity:.65;transition:opacity .5s}
.r-services-nuit .nu-c:hover::before{opacity:1}
.r-services-nuit .nu-c::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;background:radial-gradient(240px circle at var(--mx,18%) var(--my,0%),var(--accC),transparent 70%),color-mix(in srgb,var(--surC) 13%,transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.r-services-nuit .nu-ic{position:relative;width:62px;height:62px;display:grid;place-items:center;margin-bottom:8px;color:var(--accC)}
.r-services-nuit .nu-ic::before{content:"";position:absolute;inset:-16px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accC) 32%,transparent),transparent 68%);transition:transform .7s var(--ease)}
.r-services-nuit .nu-ic .ic{position:relative;width:40px;height:40px;stroke-width:1.5;filter:drop-shadow(0 0 7px color-mix(in srgb,var(--accC) 80%,transparent))}
.r-services-nuit .nu-c:hover .nu-ic::before{transform:scale(1.3)}
.js .r-services-nuit .nu-c.vu .nu-ic{animation:k-services-nuit-allume 1.5s steps(1,end) calc(.25s + var(--i,0) * .18s) backwards}
.r-services-nuit .nu-c h3{${TT}font-size:clamp(1.4rem,1.9vw,1.75rem);line-height:var(--th)}
.r-services-nuit .nu-c p{color:var(--tx2);line-height:1.55}
.r-services-nuit .nu-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;margin-top:6px;font-weight:var(--fxf);font-size:.96rem;color:var(--accC);text-decoration:none}
.r-services-nuit .nu-a .ic{width:18px;height:18px}
.r-services-nuit .nu-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-nuit .nu-a:hover .ic:last-child{transform:translateX(5px)}
@keyframes k-services-nuit-allume{0%{opacity:.12}12%{opacity:1}18%{opacity:.3}27%{opacity:1}35%{opacity:.45}44%,100%{opacity:1}}
@media(prefers-reduced-motion:reduce){.js .r-services-nuit .nu-c.vu .nu-ic{animation:none}}
@media(max-width:980px){.r-services-nuit .nu{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.r-services-nuit .nu,.r-services-nuit .nu.n2,.r-services-nuit .nu.n4{grid-template-columns:1fr}}
`; }
};

/* ── 13. le relief : cartes qui s'inclinent vers la souris, avec un reflet ── */
const relief = {
  id: 'services.relief', rubrique: 'services', nom: 'Cartes en relief et reflet',
  quand: 'deux à six services : des cartes qui s\'inclinent en 3D vers la souris, l\'icône (ou la photo si chaque service a la sienne) se détache au-dessus, un reflet suit le pointeur',
  familles: ['atelier', 'garage', 'boutique', 'cabinet'], ambiances: ['franc', 'premium'], surfaces: ['surface', 'fond', 'champ'], js: ['inclinaison'],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && photosOuIcones(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte), ic = h.iconeDe(s, ctx.iconeMetier);
      return '<li class="rl-li"' + h.rv('monte', k % 3) + '><div class="rl-c" data-tilt><div class="rl-in">' + (ph ? h.figure(ph[k], 'lazy', '(max-width:620px) 100vw, 33vw', { classe: 'rl-ph' }) : '') + '<span class="rl-med" aria-hidden="true">' + h.icone(ic) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'rl-a') + '</div><span class="rl-reflet" aria-hidden="true"></span></div></li>';
    }).join('');
    return section('services.relief', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<ul class="rl n' + sv.length + (ph ? ' avec' : '') + '">' + items + '</ul></div>');
  },
  // le reflet suit le pointeur (l'inclinaison est faite par le module commun)
  script: "if(!calme&&w.matchMedia('(hover:hover) and (pointer:fine)').matches){[].slice.call(d.querySelectorAll('.r-services-relief [data-tilt]')).forEach(function(e){e.addEventListener('pointermove',function(v){var r=e.getBoundingClientRect();e.style.setProperty('--lx',((v.clientX-r.left)/r.width*100).toFixed(1)+'%');e.style.setProperty('--ly',((v.clientY-r.top)/r.height*100).toFixed(1)+'%')})})}",
  css: function () { return `
${vu('r-services-relief')}
.r-services-relief .rl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(16px,2.2vw,30px)}
.r-services-relief .rl.n2,.r-services-relief .rl.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.r-services-relief .rl-li{display:grid}
.r-services-relief .rl-c{--ep:color-mix(in srgb,var(--acc) 45%,var(--carte));position:relative;transform-style:preserve-3d;border-radius:calc(var(--r) * 1.4 + 6px);background:linear-gradient(160deg,var(--carte) 30%,color-mix(in srgb,var(--acc) 9%,var(--carte)));border:1px solid var(--bord);box-shadow:0 1px 0 var(--ep),0 2px 0 var(--ep),0 3px 0 var(--ep),0 4px 0 var(--ep),0 5px 0 color-mix(in srgb,var(--ep) 85%,#000),0 6px 0 color-mix(in srgb,var(--ep) 75%,#000),0 30px 46px -26px rgb(0 0 0 / .45);transition:transform .7s var(--ease),box-shadow .7s var(--ease)}
.r-services-relief .rl-c:hover{box-shadow:0 1px 0 var(--ep),0 2px 0 var(--ep),0 3px 0 var(--ep),0 4px 0 var(--ep),0 5px 0 var(--ep),0 6px 0 var(--ep),0 7px 0 var(--ep),0 8px 0 color-mix(in srgb,var(--ep) 85%,#000),0 9px 0 color-mix(in srgb,var(--ep) 75%,#000),0 44px 60px -30px rgb(0 0 0 / .5)}
.r-services-relief .rl-in{display:grid;gap:12px;align-content:start;justify-items:start;padding:clamp(24px,2.6vw,36px);transform-style:preserve-3d}
.r-services-relief .rl-ph{width:100%;aspect-ratio:3/2;margin-bottom:6px;transform:translateZ(34px);box-shadow:0 22px 40px -22px rgb(0 0 0 / .55)}
.r-services-relief .avec .rl-med{margin-top:-52px;margin-left:16px}
.r-services-relief .rl-med{position:relative;width:76px;height:76px;display:grid;place-items:center;border-radius:calc(var(--rb) * 1.5 + 8px);background:var(--btn);color:var(--btnT);transform:translateZ(50px);box-shadow:inset 0 1px 0 rgb(255 255 255 / .4),inset 0 -8px 14px rgb(0 0 0 / .16),0 18px 32px -14px color-mix(in srgb,var(--btn) 75%,#000)}
.r-services-relief .rl-med::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(150deg,rgb(255 255 255 / .38),transparent 48%)}
.r-services-relief .rl-med .ic{width:34px;height:34px}
.r-services-relief .rl-c h3{${TT}font-size:clamp(1.4rem,1.9vw,1.75rem);line-height:var(--th);margin-top:6px;transform:translateZ(28px)}
.r-services-relief .rl-c p{color:var(--tx2);line-height:1.55;transform:translateZ(16px)}
.r-services-relief .rl-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);font-size:.96rem;color:var(--accT);text-decoration:none;transform:translateZ(22px)}
.r-services-relief .rl-a .ic{width:18px;height:18px}
.r-services-relief .rl-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-relief .rl-a:hover .ic:last-child{transform:translateX(5px)}
.r-services-relief .rl-reflet{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(circle at var(--lx,50%) var(--ly,0%),rgb(255 255 255 / .3),transparent 46%);opacity:0;transition:opacity .45s}
.r-services-relief .rl-c:hover .rl-reflet{opacity:1}
@media(max-width:980px){.r-services-relief .rl{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.r-services-relief .rl,.r-services-relief .rl.n2,.r-services-relief .rl.n4{grid-template-columns:1fr}}
`; }
};

/* ── 14. l'ardoise : la carte du restaurant, à la craie ── */
const ardoise = {
  id: 'services.ardoise', rubrique: 'services', photo: 'non', nom: 'Ardoise du restaurant',
  quand: 'restaurant, snack, traiteur : les plats écrits à la craie sur une ardoise, de belles lettres, des ornements, aucun prix',
  familles: ['comptoir'], ambiances: ['chaleureux', 'franc', 'premium'], surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { const n = nombre(spec, ctx); return n >= 2 && n <= 8; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = h.servicesDe(spec).slice(0, 8);
    const plats = sv.map(function (s, k) { const t = h.net(s.titre), x = h.net(s.texte); return '<li' + h.rv('monte', k) + '><h3 class="ar-craie">' + h.esc(t) + '</h3>' + (x ? '<p class="ar-craie">' + h.esc(x) + '</p>' : '') + '</li>'; }).join('');
    return section('services.ardoise', ctx, bloc, '', '<div class="w"><div class="ar"' + h.rv('zoom') + '><div class="ar-tete"><h2 class="t ar-craie">' + h.esc(titreSec(ctx)) + '</h2><svg class="ar-trait" viewBox="0 0 320 24" aria-hidden="true"><path d="M8 15c50-9 100-11 152-6 52 5 100 3 152-7" pathLength="1"/></svg></div><ul class="ar-l">' + plats + '</ul><div class="ar-bas">' + h.boutons(spec, { seule: true }) + '</div></div></div>');
  },
  css: function () { return `
${vu('r-services-ardoise')}
.r-services-ardoise .ar{--ard:color-mix(in srgb,var(--champ) 40%,#1c1d1d);--cadre:clamp(8px,1.2vw,14px);position:relative;isolation:isolate;max-width:920px;margin-inline:auto;padding:clamp(48px,6.5vw,88px) clamp(24px,6vw,84px) clamp(40px,5.5vw,72px);border-radius:calc(var(--r) * .5 + 4px);color:#fff;text-align:center;background:radial-gradient(70% 45% at 18% 8%,rgb(255 255 255 / .075),transparent 70%),radial-gradient(55% 40% at 88% 92%,rgb(255 255 255 / .05),transparent 72%),radial-gradient(40% 30% at 66% 34%,rgb(255 255 255 / .035),transparent 70%),var(--ard);box-shadow:inset 0 0 0 var(--cadre) color-mix(in srgb,var(--ard) 52%,#000),inset 0 0 0 calc(var(--cadre) + 2px) rgb(255 255 255 / .07),inset 0 0 90px rgb(0 0 0 / .5),var(--ombreF);--tx:#fff;--btn:#fff;--btnT:var(--ard);--bord:rgb(255 255 255 / .4)}
.r-services-ardoise .ar::before{content:"";position:absolute;inset:var(--cadre);z-index:-1;border-radius:2px;background-image:${NOISE};background-size:200px;opacity:.13;mix-blend-mode:screen;pointer-events:none}
.r-services-ardoise .ar-craie{color:rgb(255 255 255 / .94);text-shadow:0 0 1px rgb(255 255 255 / .5),0 0 12px rgb(255 255 255 / .12);-webkit-mask-image:${CRAIE};mask-image:${CRAIE};-webkit-mask-size:170px;mask-size:170px}
.r-services-ardoise .ar-tete{display:grid;justify-items:center;gap:10px}
.r-services-ardoise .ar-tete h2{max-width:18ch}
.r-services-ardoise .ar-trait{width:min(300px,70%);height:auto;overflow:visible}
.r-services-ardoise .ar-trait path{fill:none;stroke:rgb(255 255 255 / .62);stroke-width:3;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset 1.5s var(--ease) .5s}
.js .r-services-ardoise .ar:not(.vu) .ar-trait path{stroke-dashoffset:1}
.r-services-ardoise .ar-l{display:grid;margin:clamp(22px,3.4vw,40px) auto 0;max-width:640px}
.r-services-ardoise .ar-l li{display:grid;justify-items:center;gap:6px;padding:clamp(16px,2.2vw,24px) 0}
.r-services-ardoise .ar-l li+li::before{content:"";display:block;width:110px;height:14px;margin:0 auto clamp(14px,2vw,22px);background:${ORNEMENT} center/contain no-repeat;opacity:.5}
.r-services-ardoise .ar-l h3{${TT}font-size:clamp(1.55rem,2.6vw,2.35rem);line-height:1.1;transition:text-shadow .5s}
.r-services-ardoise .ar-l li:hover h3{text-shadow:0 0 1px rgb(255 255 255 / .6),0 0 22px rgb(255 255 255 / .35)}
.r-services-ardoise .ar-l p{color:rgb(255 255 255 / .76);font-size:1.06rem;max-width:44ch}
.r-services-ardoise .ar-bas{display:flex;justify-content:center;margin-top:clamp(26px,3.6vw,44px)}
.r-services-ardoise .ar-bas .actions{justify-content:center}
@media(max-width:560px){.r-services-ardoise .ar{padding-inline:22px;--cadre:7px}}
`; }
};

/* ── 15. la liste de soins : filets fins, photo en arche ── */
const soins = {
  id: 'services.soins', rubrique: 'services', nom: 'Liste de soins, photo en arche',
  quand: 'beauté, soins, bien-être : une liste élégante à filets fins, chaque soin réservable sur WhatsApp, à côté d\'une photo en arche (celle du soin survolé si chacun a la sienne, sinon une photo libre, sinon une arche de lumière)',
  familles: ['ecrin', 'cabinet'], ambiances: ['premium', 'calme'], surfaces: ['fond', 'surface'], js: ['survol'],
  besoin: function (spec, ctx) { const n = nombre(spec, ctx); return n >= 2 && n <= 7; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = ctx.h.servicesDe(spec).slice(0, 7), ph = sv.length <= 6 ? photosDe(spec, ctx) : null;
    const une = ph ? null : prendrePhoto(ctx);
    const arche = ph ? ph.map(function (p, k) { return h.figure(p, 'lazy', '(max-width:860px) 80vw, 34vw', { classe: k === 0 ? 'on' : '', attrs: ' data-survol-img="' + k + '"' }); }).join('') : une ? h.figure(une, 'lazy', '(max-width:860px) 80vw, 34vw', { classe: 'on' }) : '<div class="so-st"><span class="so-g">' + h.icone(ctx.iconeMetier || 'etoile') + '</span></div>';
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte), cle = ph ? ' data-survol-cle="' + k + '"' : '';
      const c = '<span class="so-orn" aria-hidden="true">' + h.icone('etincelles') + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + (a ? '<span class="so-go">' + h.esc(a.texte) + h.icone('fleche') + '</span>' : '');
      return '<li' + h.rv('monte', k) + '>' + (a ? ouvre(h, a, 'so-it' + (k === 0 && ph ? ' on' : ''), cle) + c + '</a>' : '<div class="so-it"' + cle + '>' + c + '</div>') + '</li>';
    }).join('');
    return section('services.soins', ctx, bloc, '', '<div class="w so' + (ph || une ? '' : ' sans') + '"' + (ph ? ' data-survol' : '') + '><div class="so-vis"' + h.rv('mots') + '><div class="so-arche">' + arche + '</div></div><div class="so-tx">' + h.teteSec(titreSec(ctx)) + '<ul class="so-l">' + items + '</ul><div class="so-act"' + h.rv('monte', 2) + '>' + h.boutons(spec, { seule: true }) + '</div></div></div>');
  },
  css: function () { return `
${vu('r-services-soins')}
.r-services-soins .so{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(36px,6.5vw,110px);align-items:start}
.r-services-soins .so-vis{position:sticky;top:clamp(96px,13vh,130px)}
.r-services-soins .so-vis::after{content:"";position:absolute;inset:0;z-index:-1;border:1px solid var(--accT);border-radius:999px 999px var(--rp) var(--rp);transform:translate(16px,16px);opacity:.45;pointer-events:none}
.r-services-soins .so-arche{position:relative;aspect-ratio:3/4;max-height:78vh;border-radius:999px 999px var(--rp) var(--rp);overflow:hidden;background:var(--douce);box-shadow:var(--ombreF)}
.js .r-services-soins .so-arche{transition:clip-path 1.6s var(--ease)}
.js .r-services-soins .so-vis.vu .so-arche{clip-path:inset(-80px -80px -80px -80px)}
.js .r-services-soins .so-vis:not(.vu) .so-arche{clip-path:inset(100% 0 0 0)}
.js .r-services-soins .so-vis::after{transition:opacity 1s var(--ease) .9s}
.js .r-services-soins .so-vis:not(.vu)::after{opacity:0}
@media(prefers-reduced-motion:reduce){.js .r-services-soins .so-arche,.js .r-services-soins .so-vis::after{transition:none}}
.r-services-soins .so-arche .ph{position:absolute;inset:0;border-radius:0;opacity:0;transform:scale(1.06);transition:opacity .9s var(--ease),transform 1.6s var(--ease)}
.r-services-soins .so-arche .ph.on{opacity:1;transform:none}
.r-services-soins .so-st{position:absolute;inset:0;display:grid;place-items:center;background:repeating-radial-gradient(circle at 50% 38%,transparent 0 38px,color-mix(in srgb,var(--acc) 12%,transparent) 38px 39px),radial-gradient(90% 60% at 50% 34%,color-mix(in srgb,var(--acc) 22%,var(--douce)),var(--douce) 72%)}
.r-services-soins .so-g{width:40%;aspect-ratio:1;display:grid;place-items:center;border-radius:50%;background:var(--bg);color:var(--accT);box-shadow:0 0 0 1px color-mix(in srgb,var(--acc) 30%,transparent),0 20px 50px -20px rgb(0 0 0 / .35)}
.r-services-soins .so-g .ic{width:44%;height:44%;stroke-width:1.2}
.r-services-soins .so-tx .tete-sec{margin-inline:0;text-align:left;justify-items:start}
.r-services-soins .so-l{display:grid;border-top:1px solid var(--bord)}
.r-services-soins .so-it{position:relative;display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:6px 18px;align-items:center;padding:clamp(20px,2.4vw,28px) 0;border-bottom:1px solid var(--bord);color:inherit;text-decoration:none}
.r-services-soins .so-it::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--accT);transform:scaleX(0);transform-origin:left;transition:transform .9s var(--ease)}
.r-services-soins .so-it:hover::after,.r-services-soins .so-it:focus-visible::after,.r-services-soins .so-it.on::after{transform:scaleX(1)}
.r-services-soins .so-orn{grid-row:1;color:var(--accT);transition:transform .9s var(--ease)}
.r-services-soins .so-orn .ic{width:20px;height:20px;stroke-width:1.5}
.r-services-soins .so-it:hover .so-orn,.r-services-soins .so-it.on .so-orn{transform:rotate(90deg) scale(1.1)}
.r-services-soins .so-it h3{${TT}grid-column:2;font-size:clamp(1.45rem,2.3vw,2.2rem);line-height:var(--th);transition:transform .7s var(--ease)}
.r-services-soins .so-it:hover h3{transform:translateX(6px)}
.r-services-soins .so-it p{grid-column:2;color:var(--tx2);max-width:46ch}
.r-services-soins .so-go{grid-column:3;grid-row:1/3;display:inline-flex;align-items:center;gap:8px;min-height:44px;font-weight:var(--fxf);font-size:.95rem;color:var(--accT);white-space:nowrap;opacity:.0;transform:translateX(-8px);transition:opacity .4s,transform .6s var(--ease)}
.r-services-soins .so-go .ic{width:18px;height:18px}
.r-services-soins .so-it:hover .so-go,.r-services-soins .so-it:focus-visible .so-go{opacity:1;transform:none}
.r-services-soins .so-act{margin-top:clamp(24px,3vw,36px)}
@media(hover:none){.r-services-soins .so-go{opacity:1;transform:none}}
@media(max-width:860px){.r-services-soins .so{grid-template-columns:1fr}.r-services-soins .so-vis{position:relative;top:auto;width:min(78%,360px);margin-inline:auto}.r-services-soins .so-vis::after{transform:translate(10px,10px)}.r-services-soins .so-it{grid-template-columns:22px minmax(0,1fr)}.r-services-soins .so-go{grid-column:2;grid-row:auto;justify-self:start;opacity:1;transform:none}}
`; }
};

/* ── 16. les volets : bandes photo qui s'ouvrent au survol ── */
const volets = {
  id: 'services.volets', rubrique: 'services', nom: 'Volets photo qui s\'ouvrent',
  quand: 'trois à cinq services qui ont chacun leur photo : des bandes verticales côte à côte, celle qu\'on survole s\'ouvre en grand et montre son texte (cartes empilées sur téléphone)',
  familles: ['horizon', 'ecrin', 'comptoir', 'verdure', 'boutique'], ambiances: ['premium', 'chaleureux'], surfaces: ['fond', 'surface'], js: ['survol'],
  besoin: function (spec, ctx) { const n = nombre(spec, ctx); return n >= 3 && n <= 5 && !!photosDe(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    if (!ph) return '';
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<li class="vl-p' + (k === 0 ? ' on' : '') + '" data-survol-cle="' + k + '"' + h.rv('monte', k) + '>' + h.figure(ph[k], 'lazy', '(max-width:900px) 100vw, 60vw') + '<span class="vl-v" aria-hidden="true">' + h.esc(t) + '</span><div class="vl-tx"><span class="vl-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'vl-a') + '</div></li>';
    }).join('');
    return section('services.volets', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<ul class="vl n' + sv.length + '" data-survol>' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-services-volets')}
.r-services-volets .vl{display:grid;gap:14px}
.r-services-volets .vl-p{position:relative;isolation:isolate;min-height:330px;border-radius:var(--rp);overflow:hidden;color:#fff;background:rgb(var(--voile))}
.r-services-volets .vl-p .ph{position:absolute;inset:0;z-index:-2;border-radius:0}
.r-services-volets .vl-p .ph img{transition:transform 1.6s var(--ease)}
.js .r-services-volets .vl-p .ph{transition:clip-path 1.4s var(--ease) calc(.15s + var(--i,0) * var(--pas))}
.js .r-services-volets .vl-p:not(.vu) .ph{clip-path:inset(100% 0 0 0)}
@media(prefers-reduced-motion:reduce){.js .r-services-volets .vl-p .ph{transition:none}}
.r-services-volets .vl-p::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / .08),rgb(var(--voile) / .28) 45%,rgb(var(--voile) / .9));transition:background-color .6s}
.r-services-volets .vl-tx{position:absolute;inset:auto 0 0;display:grid;gap:10px;justify-items:start;padding:clamp(22px,2.6vw,36px)}
.r-services-volets .vl-ic{width:50px;height:50px;display:grid;place-items:center;border-radius:var(--rb);background:var(--vif);color:var(--surV)}
.r-services-volets .vl-tx h3{${TT}font-size:clamp(1.7rem,2.8vw,2.8rem);line-height:var(--th)}
.r-services-volets .vl-tx p{color:rgb(255 255 255 / .9);font-size:1.06rem;max-width:40ch}
.r-services-volets .vl-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);font-size:.96rem;color:#fff;text-decoration:none}
.r-services-volets .vl-a .ic{width:18px;height:18px}
.r-services-volets .vl-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-volets .vl-a:hover .ic:last-child{transform:translateX(5px)}
.r-services-volets .vl-v{display:none}
@media (hover:hover) and (min-width:901px){.js .r-services-volets .vl{display:flex;height:clamp(460px,40vw,600px)}.js .r-services-volets .vl-p{flex:1 1 0;min-width:0;min-height:0;cursor:pointer;transition:${REVELE},flex-grow .9s var(--ease)}.js .r-services-volets .vl-p.on,.js .r-services-volets .vl-p:focus-within{flex-grow:3.4;cursor:auto}.js .r-services-volets .vl-p.on .ph img{transform:scale(1.04)}.js .r-services-volets .vl-tx{width:min(560px,44vw);opacity:0;transform:translateY(18px);transition:opacity .35s,transform .6s var(--ease);pointer-events:none}.js .r-services-volets .vl-p.on .vl-tx,.js .r-services-volets .vl-p:focus-within .vl-tx{opacity:1;transform:none;transition-delay:.3s;pointer-events:auto}.js .r-services-volets .vl-v{display:block;position:absolute;left:50%;bottom:30px;${TT}font-size:1.35rem;line-height:1;white-space:nowrap;writing-mode:vertical-rl;transform:translateX(-50%) rotate(180deg);transition:opacity .4s}.js .r-services-volets .vl-p.on .vl-v,.js .r-services-volets .vl-p:focus-within .vl-v{opacity:0}}
@media(prefers-reduced-motion:reduce){.js .r-services-volets .vl-p,.js .r-services-volets .vl-tx,.js .r-services-volets .vl-v{transition:none}}
`; }
};

/* ── 17. le récit : la photo collée change avec le service lu ── */
const recit = {
  id: 'services.recit', rubrique: 'services', nom: 'Récit collant, la photo suit la lecture',
  quand: 'deux à cinq services qui ont chacun leur photo, à raconter : les textes défilent à gauche, la grande photo collée à droite change avec le service lu (photo dans chaque service sur téléphone)',
  familles: ['horizon', 'atelier', 'verdure', 'cabinet', 'ecrin'], ambiances: ['premium', 'calme'], surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { const n = nombre(spec, ctx); return n >= 2 && n <= 5 && !!photosDe(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx), ph = photosDe(spec, ctx);
    if (!ph) return '';
    const blocs = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<article class="rc-b' + (k === 0 ? ' on' : '') + '">' + h.figure(ph[k], 'lazy', '100vw', { classe: 'rc-vig' }) + '<div class="rc-in"' + h.rv('monte') + '><span class="rc-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + (a ? ouvre(h, a, 'btn b1', ' aria-label="' + h.esc(a.texte + ' : ' + t) + '"') + h.contenuBouton(a.icone, a.texte) + '</a>' : '') + '</div></article>';
    }).join('');
    const vis = '<div class="rc-vis" aria-hidden="true"><div class="rc-cadre">' + ph.map(function (p, k) { return h.figure(p, 'lazy', '(max-width:900px) 1px, 52vw', { classe: k === 0 ? 'on' : '' }); }).join('') + '<div class="rc-pts">' + sv.map(function (s, k) { return '<i' + (k === 0 ? ' class="on"' : '') + '></i>'; }).join('') + '</div></div></div>';
    return section('services.recit', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<div class="rc"><div class="rc-l">' + blocs + '</div>' + vis + '</div></div>');
  },
  // le service au milieu de l'écran donne sa photo au cadre collé
  script: "[].slice.call(d.querySelectorAll('.r-services-recit')).forEach(function(s){var bs=[].slice.call(s.querySelectorAll('.rc-b')),fs=[].slice.call(s.querySelectorAll('.rc-cadre .ph')),ps=[].slice.call(s.querySelectorAll('.rc-pts i'));if(!bs.length||!('IntersectionObserver' in w))return;var voir=function(k){[bs,fs,ps].forEach(function(l){l.forEach(function(x,i){x.classList.toggle('on',i===k)})})};var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)voir(bs.indexOf(e.target))})},{rootMargin:'-45% 0px -45% 0px'});bs.forEach(function(b){io.observe(b)})})",
  css: function () { return `
${vu('r-services-recit')}
.r-services-recit .rc-l{display:grid;gap:clamp(40px,6vw,72px)}
.r-services-recit .rc-b{display:grid;gap:18px}
.r-services-recit .rc-in{display:grid;gap:16px;justify-items:start}
.r-services-recit .rc-vig{width:100%;aspect-ratio:16/10}
.r-services-recit .rc-ic{width:58px;height:58px;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--acc) 15%,transparent);color:var(--accT);transition:background-color .5s,color .5s,transform .8s var(--ease)}
.r-services-recit .rc-ic .ic{width:26px;height:26px}
.r-services-recit .rc-b.on .rc-ic{background:var(--btn);color:var(--btnT);transform:rotate(-8deg)}
.r-services-recit .rc-b h3{${TT}font-size:clamp(2rem,3.6vw,3.6rem);line-height:var(--th)}
.r-services-recit .rc-b p{font-size:1.15rem;line-height:1.6;color:var(--tx2);max-width:42ch}
.r-services-recit .rc-vis{display:none}
@media(min-width:901px){.js .r-services-recit .rc{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(36px,6vw,100px);align-items:start}.js .r-services-recit .rc-l{gap:0}.js .r-services-recit .rc-vig{display:none}.js .r-services-recit .rc-b{min-height:62vh;align-content:center;opacity:.42;transition:opacity .7s var(--ease)}.js .r-services-recit .rc-b.on{opacity:1}.js .r-services-recit .rc-vis{display:block;position:sticky;top:max(96px,12vh);height:min(76vh,700px)}.js .r-services-recit .rc-cadre{position:relative;height:100%;border-radius:var(--rp);overflow:hidden;background:var(--douce);box-shadow:var(--ombreF)}.js .r-services-recit .rc-cadre .ph{position:absolute;inset:0;border-radius:0;opacity:0;transform:scale(1.08);transition:opacity .9s var(--ease),transform 1.8s var(--ease)}.js .r-services-recit .rc-cadre .ph.on{opacity:1;transform:none}.js .r-services-recit .rc-pts{position:absolute;right:20px;top:50%;display:grid;gap:10px;transform:translateY(-50%)}.js .r-services-recit .rc-pts i{width:8px;height:8px;border-radius:8px;background:rgb(255 255 255 / .55);box-shadow:0 1px 6px rgb(0 0 0 / .3);transition:height .6s var(--ease),background-color .3s}.js .r-services-recit .rc-pts i.on{height:30px;background:#fff}}
@media(prefers-reduced-motion:reduce){.js .r-services-recit .rc-b,.js .r-services-recit .rc-b.on{opacity:1;transition:none}.js .r-services-recit .rc-cadre .ph{transition:none}}
`; }
};

/* ── 18. les plaques : plaques de métal sur un panneau perforé d'atelier ── */
const plaques = {
  id: 'services.plaques', rubrique: 'services', photo: 'non', nom: 'Plaques sur panneau perforé',
  quand: 'garage, artisan, atelier : chaque service gravé sur une plaque de métal brossé rivetée, accrochée à un panneau perforé ; la plaque se soulève et un reflet passe au survol',
  familles: ['garage', 'atelier'], ambiances: ['franc'], surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return nombre(spec, ctx) >= 2 && iconesVariees(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = liste(spec, ctx);
    const items = sv.map(function (s, k) {
      const a = action(spec, ctx, s), t = h.net(s.titre), x = h.net(s.texte);
      return '<li class="pq-c"' + h.rv('monte', k % 3) + '><span class="pq-ic" aria-hidden="true">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(t) + '</h3>' + (x ? '<p>' + h.esc(x) + '</p>' : '') + lienAction(h, a, t, 'pq-a') + '</li>';
    }).join('');
    return section('services.plaques', ctx, bloc, '', '<div class="w">' + h.teteSec(titreSec(ctx)) + '<ul class="pq n' + sv.length + '">' + items + '</ul></div>');
  },
  css: function () { return `
${vu('r-services-plaques')}
.r-services-plaques .pq{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(18px,2.4vw,34px);padding:clamp(20px,3.4vw,52px);border-radius:var(--r);background:radial-gradient(circle,rgb(0 0 0 / .4) 0 2.5px,rgb(255 255 255 / .07) 2.6px 3.3px,transparent 3.5px) 0 0/26px 26px,color-mix(in srgb,var(--tx) 6%,var(--bg));box-shadow:inset 0 2px 12px rgb(0 0 0 / .2),inset 0 0 0 1px var(--bord)}
.r-services-plaques .pq.n2,.r-services-plaques .pq.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.r-services-plaques .pq-c{position:relative;isolation:isolate;overflow:hidden;display:grid;gap:12px;align-content:start;justify-items:start;padding:clamp(30px,3vw,42px) clamp(24px,2.6vw,36px);border-radius:calc(var(--r) * .6 + 3px);color:var(--tx);background:repeating-linear-gradient(90deg,rgb(255 255 255 / .045) 0 1px,rgb(0 0 0 / .04) 1px 3px),linear-gradient(170deg,color-mix(in srgb,var(--carte) 84%,#fff),var(--carte) 46%,color-mix(in srgb,var(--carte) 84%,#000));box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 -2px 3px rgb(0 0 0 / .2),0 2px 0 rgb(0 0 0 / .18),0 20px 34px -20px rgb(0 0 0 / .6);transition:${REVELE},translate .7s var(--ease),rotate .7s var(--ease),box-shadow .7s var(--ease)}
.r-services-plaques .pq-c:nth-child(3n+1){rotate:-.5deg}
.r-services-plaques .pq-c:nth-child(3n+2){rotate:.4deg}
.r-services-plaques .pq-c::before{content:"";position:absolute;inset:11px;z-index:-1;pointer-events:none;background:radial-gradient(circle at 40% 35%,rgb(255 255 255 / .75) 0 1px,color-mix(in srgb,var(--tx) 50%,transparent) 2.2px,transparent 3.6px) left top/9px 9px no-repeat,radial-gradient(circle at 40% 35%,rgb(255 255 255 / .75) 0 1px,color-mix(in srgb,var(--tx) 50%,transparent) 2.2px,transparent 3.6px) right top/9px 9px no-repeat,radial-gradient(circle at 40% 35%,rgb(255 255 255 / .75) 0 1px,color-mix(in srgb,var(--tx) 50%,transparent) 2.2px,transparent 3.6px) left bottom/9px 9px no-repeat,radial-gradient(circle at 40% 35%,rgb(255 255 255 / .75) 0 1px,color-mix(in srgb,var(--tx) 50%,transparent) 2.2px,transparent 3.6px) right bottom/9px 9px no-repeat}
.r-services-plaques .pq-c::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgb(255 255 255 / .24) 50%,transparent 62%) 100% 0/240% 100% no-repeat;transition:background-position 1.1s var(--ease)}
.r-services-plaques .pq-c:hover{translate:0 -6px;rotate:0deg;box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 -2px 3px rgb(0 0 0 / .2),0 4px 0 rgb(0 0 0 / .14),0 34px 50px -24px rgb(0 0 0 / .65)}
.r-services-plaques .pq-c:hover::after{background-position:0% 0}
.r-services-plaques .pq-ic{width:60px;height:60px;display:grid;place-items:center;border-radius:50%;color:var(--accT);background:color-mix(in srgb,var(--tx) 7%,transparent);box-shadow:inset 0 2px 5px rgb(0 0 0 / .28),0 1px 0 rgb(255 255 255 / .3)}
.r-services-plaques .pq-ic .ic{width:28px;height:28px}
.r-services-plaques .pq-c h3{${TT}font-size:clamp(1.4rem,1.9vw,1.75rem);line-height:var(--th);text-shadow:0 1px 0 rgb(255 255 255 / .22),0 -1px 0 rgb(0 0 0 / .25)}
.r-services-plaques .pq-c p{color:var(--tx2);line-height:1.55}
.r-services-plaques .pq-a{display:inline-flex;align-items:center;gap:9px;min-height:44px;font-weight:var(--fxf);font-size:.96rem;color:var(--accT);text-decoration:none}
.r-services-plaques .pq-a .ic{width:18px;height:18px}
.r-services-plaques .pq-a .ic:last-child{transition:transform .45s var(--ease)}
.r-services-plaques .pq-a:hover .ic:last-child{transform:translateX(5px)}
@media(max-width:980px){.r-services-plaques .pq{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.r-services-plaques .pq,.r-services-plaques .pq.n2,.r-services-plaques .pq.n4{grid-template-columns:1fr;padding:16px}}
`; }
};

module.exports = [survol, onglets, carrousel, bento, pile, colle, accordeon, affiches, zigzag, anneaux, lignes, nuit, relief, ardoise, soins, volets, recit, plaques];
