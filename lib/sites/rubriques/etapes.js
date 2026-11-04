// Les étapes (rubrique etapes) : trois gestes courts, une vraie suite (les numéros sont permis). Cinq mises en scène :
// une ligne de temps qui se remplit au défilement, un chemin courbe qui se dessine, des cartes aux grands chiffres en
// contour, un indicateur collant qui suit l'étape lue, des étapes reliées par des flèches qui passent le relais.
// Jamais pour un commerce où l'on vient sans rendez-vous (objectif « visite »).
'use strict';

function etapesDe(spec, h) { return h.etapes(spec).slice(0, 3); }
function besoinEtapes(spec, ctx) { return ctx.h.etapes(spec).length >= 3 && spec.objectif !== 'visite'; }
function titreEtape(h, x) { return h.majuscule(h.net(x.titre).replace(/[.]+$/, '')); }
function texteEtape(h, x) { return h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : ''; }
// le système d'apparitions pose clip-path:inset(0) sur tout élément apparu : pour celles qui ne découpent pas, on le
// retire (sinon il rogne les anneaux des pastilles et les ombres qui débordent)
function sansCoupe(c) { return ['monte', 'zoom', 'recul', 'gauche', 'droite', 'flou'].map(function (t) { return c + ' [data-r=' + t + '].vu'; }).join(',') + '{clip-path:none}\n'; }
// le bouton qui fait faire la première étape
function action(spec, h, cls) { return h.boutons(spec, { seule: true, classe: cls }); }

/* ── 1. une ligne de temps qui se remplit au défilement ── */
const etapesChronologie = {
  id: 'etapes.chronologie', rubrique: 'etapes', nom: 'Ligne de temps qui se remplit',
  quand: 'toujours possible avec trois étapes : le titre reste à gauche, une ligne verticale se remplit pendant qu\'on descend et allume chaque étape quand elle l\'atteint',
  familles: [], ambiances: ['calme', 'franc', 'premium', 'chaleureux'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: besoinEtapes,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, e = etapesDe(spec, h);
    const l = e.map(function (x, k) { return '<li class="ech-e"' + h.rv('monte', k) + '><span class="ech-n" aria-hidden="true">' + (k + 1) + '</span><div class="ech-c"><h3>' + h.esc(titreEtape(h, x)) + '</h3>' + texteEtape(h, x) + '</div></li>'; }).join('');
    return '<section class="' + h.classes('etapes.chronologie', bloc, 'sec') + '" id="etapes">' + h.fond(bloc) + '<div class="w ech"><div class="ech-tete">' + h.teteSec(ctx.mod.textes.etapes) + '<div' + h.rv('monte', 1) + '>' + action(spec, h) + '</div></div><ol class="ech-l" data-chrono>' + l + '</ol></div></section>';
  },
  // la ligne suit le milieu de l'écran ; sans script ou en mouvement réduit, elle est pleine et tout est allumé
  script: `
[].slice.call(d.querySelectorAll('.r-etapes-chronologie [data-chrono]')).forEach(function(l){if(calme||!('IntersectionObserver' in w))return;var es=[].slice.call(l.querySelectorAll('.ech-e')),vu=false,tk=0;
var maj=function(){tk=0;var r=l.getBoundingClientRect(),hh=w.innerHeight||1,y=hh*.62,de=d.documentElement;var k=(y-r.top)/(r.height||1);if(w.scrollY+hh>=de.scrollHeight-4)k=1;k=k<0?0:k>1?1:k;l.style.setProperty('--k',k.toFixed(4));es.forEach(function(e){var n=e.querySelector('.ech-n');e.classList.toggle('on',k>=1||r.top+n.offsetTop+n.offsetHeight/2<=y)})};
l.classList.add('ok');new IntersectionObserver(function(x){vu=x[0].isIntersecting;if(vu)maj()},{rootMargin:'20% 0px'}).observe(l);
w.addEventListener('scroll',function(){if(vu&&!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});w.addEventListener('resize',function(){if(vu)maj()});maj()})`,
  css: function () { return sansCoupe('.r-etapes-chronologie') + `
.r-etapes-chronologie .ech{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(36px,6vw,110px);align-items:start}
.r-etapes-chronologie .ech-tete{position:sticky;top:clamp(96px,14vh,150px);display:grid;gap:26px;justify-items:start}
.r-etapes-chronologie .ech-tete .tete-sec{margin-bottom:0}
.r-etapes-chronologie .ech-l{position:relative;display:grid;gap:clamp(64px,11vh,130px);padding-block:6px;--k:1}
.r-etapes-chronologie .ech-l::before,.r-etapes-chronologie .ech-l::after{content:"";position:absolute;left:31px;top:38px;bottom:38px;width:2px;border-radius:2px;background:var(--bord)}
.r-etapes-chronologie .ech-l::after{background:var(--btn);transform-origin:top;transform:scaleY(var(--k));box-shadow:0 0 18px color-mix(in srgb,var(--btn) 60%,transparent)}
.r-etapes-chronologie .ech-e{position:relative;display:grid;grid-template-columns:64px minmax(0,1fr);gap:clamp(20px,3vw,40px);align-items:center}
.r-etapes-chronologie .ech-n{position:relative;z-index:1;width:64px;height:64px;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:1.6rem;line-height:1;box-shadow:0 0 0 8px var(--bg);transition:background-color .5s,color .5s,transform .6s cubic-bezier(.34,1.5,.64,1)}
.r-etapes-chronologie .ech-c{display:grid;gap:8px}
.r-etapes-chronologie .ech-c h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.5rem,2.7vw,2.4rem);line-height:1.04;transition:opacity .5s}
.r-etapes-chronologie .ech-c p{color:var(--tx2);font-size:1.05rem;max-width:44ch}
.r-etapes-chronologie .ok .ech-e:not(.on) .ech-n{background:var(--bg);color:var(--tx2);box-shadow:0 0 0 8px var(--bg),inset 0 0 0 2px var(--bord);transform:scale(.86)}
.r-etapes-chronologie .ok .ech-e:not(.on) .ech-c h3{opacity:.45}
@media(max-width:860px){.r-etapes-chronologie .ech{grid-template-columns:1fr}.r-etapes-chronologie .ech-tete{position:static}.r-etapes-chronologie .ech-l::before,.r-etapes-chronologie .ech-l::after{left:23px;top:30px;bottom:30px}.r-etapes-chronologie .ech-e{grid-template-columns:48px minmax(0,1fr)}.r-etapes-chronologie .ech-n{width:48px;height:48px;font-size:1.25rem;box-shadow:0 0 0 6px var(--bg)}}
@media(prefers-reduced-motion:reduce){.r-etapes-chronologie .ech-n,.r-etapes-chronologie .ech-c h3{transition:none}}
`; }
};

/* ── 2. un chemin courbe qui se dessine et relie les étapes ── */
// le tracé (repère 1200 x 260) et les étapes posées dessus ; la part du chemin parcourue à chaque étape est mesurée une
// fois ici, pour que chaque pastille s'allume quand le trait l'atteint
const CHEMIN = [[[40, 206], [112, 206], [132, 172], [200, 172]], [[200, 172], [336, 172], [446, 88], [600, 88]], [[600, 88], [754, 88], [864, 172], [1000, 172]], [[1000, 172], [1072, 172], [1112, 140], [1164, 112]]];
const POINTS = [[200, 172], [600, 88], [1000, 172]];
const D_CHEMIN = 'M' + CHEMIN[0][0].join(' ') + CHEMIN.map(function (s) { return 'C' + s.slice(1).map(function (p) { return p.join(' '); }).join(' '); }).join('');
const PARTS = (function () {
  const lon = CHEMIN.map(function (s) {
    let l = 0, prec = s[0];
    for (let i = 1; i <= 120; i++) {
      const t = i / 120, u = 1 - t;
      const p = [0, 1].map(function (c) { return u * u * u * s[0][c] + 3 * u * u * t * s[1][c] + 3 * u * t * t * s[2][c] + t * t * t * s[3][c]; });
      l += Math.hypot(p[0] - prec[0], p[1] - prec[1]); prec = p;
    }
    return l;
  });
  const total = lon.reduce(function (a, b) { return a + b; }, 0);
  let cumul = 0;
  return lon.slice(0, 3).map(function (l) { cumul += l; return +(cumul / total).toFixed(3); });
})();
const etapesChemin = {
  id: 'etapes.chemin', rubrique: 'etapes', nom: 'Chemin qui se dessine',
  quand: 'trois étapes, pour un métier de parcours (sortie en mer, soin, jardin, table, conseil) : un chemin courbe se dessine d\'une étape à l\'autre et allume chaque pastille à son passage ; sur téléphone, il descend en ondulant',
  familles: ['horizon', 'verdure', 'comptoir', 'ecrin', 'cabinet', 'boutique'], ambiances: ['chaleureux', 'calme', 'premium'], surfaces: ['surface', 'fond'], js: [],
  besoin: besoinEtapes,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, e = etapesDe(spec, h);
    const piste = '<div class="ecm-piste"' + h.rv('monte') + ' aria-hidden="true"><svg viewBox="0 0 1200 260" preserveAspectRatio="none"><path class="ecm-fond" d="' + D_CHEMIN + '"/><path class="ecm-trace" pathLength="1" d="' + D_CHEMIN + '"/><circle class="ecm-dep" cx="40" cy="206" r="7"/><circle class="ecm-arr" cx="1164" cy="112" r="7"/></svg>' + POINTS.map(function (p, k) { return '<span class="ecm-n" style="--x:' + (p[0] / 12).toFixed(3) + ';--y:' + (p[1] / 12).toFixed(3) + ';--t:' + PARTS[k] + '">' + (k + 1) + '</span>'; }).join('') + '</div>';
    const l = e.map(function (x, k) { return '<li class="ecm-e"' + h.rv('monte', k + 2) + '><span class="ecm-nm" aria-hidden="true">' + (k + 1) + '</span>' + (k < 2 ? '<svg class="ecm-lien" viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M12 0C2 18 22 32 12 50S2 82 12 100"/></svg>' : '') + '<div class="ecm-c"><h3>' + h.esc(titreEtape(h, x)) + '</h3>' + texteEtape(h, x) + '</div></li>'; }).join('');
    return '<section class="' + h.classes('etapes.chemin', bloc, 'sec') + '" id="etapes">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.etapes, null, { classe: 'c' }) + '<div class="ecm">' + piste + '<ol class="ecm-l">' + l + '</ol></div><div class="ecm-act"' + h.rv('monte', 5) + '>' + action(spec, h) + '</div></div></section>';
  },
  css: function () { return sansCoupe('.r-etapes-chemin') + `
.r-etapes-chemin .ecm{position:relative;container-type:inline-size;--dur:2.4s}
.r-etapes-chemin .ecm-piste{position:relative;height:21.667cqw}
.js .r-etapes-chemin .ecm-piste[data-r]{transform:none}
.r-etapes-chemin .ecm-piste svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.r-etapes-chemin .ecm-fond{fill:none;stroke:var(--bord);stroke-width:2;stroke-dasharray:2 12;stroke-linecap:round}
.r-etapes-chemin .ecm-trace{fill:none;stroke:var(--acc);stroke-width:3.5;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset var(--dur) linear .2s}
.js .r-etapes-chemin .ecm-piste:not(.vu) .ecm-trace{stroke-dashoffset:1}
.r-etapes-chemin .ecm-dep{fill:var(--acc)}
.r-etapes-chemin .ecm-arr{fill:var(--bg);stroke:var(--acc);stroke-width:3;transition:fill .4s calc(var(--dur) + .2s)}
.r-etapes-chemin .vu .ecm-arr{fill:var(--acc)}
.r-etapes-chemin .ecm-n{position:absolute;left:calc(var(--x) * 1cqw);top:calc(var(--y) * 1cqw);width:clamp(50px,5.6cqw,68px);aspect-ratio:1;translate:-50% -50%;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:clamp(1.2rem,2.2cqw,1.7rem);line-height:1;box-shadow:0 0 0 7px var(--bg),0 14px 30px -14px color-mix(in srgb,var(--btn) 80%,transparent);transition:background-color .45s,color .45s,transform .7s cubic-bezier(.34,1.6,.64,1);transition-delay:calc(var(--t) * var(--dur) + .1s)}
.js .r-etapes-chemin .ecm-piste:not(.vu) .ecm-n{background:var(--bg);color:var(--tx2);box-shadow:0 0 0 7px var(--bg),inset 0 0 0 2px var(--bord);transform:scale(.8);transition-delay:0s}
.r-etapes-chemin .ecm-l{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:clamp(10px,1.4vw,20px)}
.r-etapes-chemin .ecm-e{text-align:center;padding-inline:clamp(10px,2vw,30px)}
.r-etapes-chemin .ecm-nm,.r-etapes-chemin .ecm-lien{display:none}
.r-etapes-chemin .ecm-c{display:grid;gap:8px;justify-items:center}
.r-etapes-chemin .ecm-c h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.3rem,2.1vw,1.85rem);line-height:1.08;max-width:15em}
.r-etapes-chemin .ecm-c p{color:var(--tx2);max-width:34ch}
.r-etapes-chemin .ecm-e:nth-child(2){margin-top:calc(-1 * clamp(0px,7cqw,90px))}
.r-etapes-chemin .ecm-act{display:flex;justify-content:center;margin-top:clamp(40px,5vw,64px)}
@media(max-width:760px){
.r-etapes-chemin .ecm-piste{display:none}
.r-etapes-chemin .ecm-l{grid-template-columns:1fr;gap:clamp(44px,12vw,64px);margin-top:0}
.r-etapes-chemin .ecm-e,.r-etapes-chemin .ecm-e:nth-child(2){position:relative;display:grid;grid-template-columns:56px minmax(0,1fr);gap:20px;align-items:center;text-align:left;padding:0;margin:0}
.r-etapes-chemin .ecm-c{justify-items:start}
.r-etapes-chemin .ecm-nm{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--btn);color:var(--btnT);font-family:var(--ft);font-weight:var(--tp);font-size:1.35rem;line-height:1;box-shadow:0 0 0 6px var(--bg);position:relative;z-index:1}
.r-etapes-chemin .ecm-lien{display:block;position:absolute;left:16px;top:62px;width:24px;height:calc(100% - 68px + clamp(44px,12vw,64px));overflow:visible}
.r-etapes-chemin .ecm-lien path{fill:none;stroke:var(--acc);stroke-width:2.5;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset 1.1s var(--ease) .45s}
.js .r-etapes-chemin .ecm-e:not(.vu) .ecm-lien path{stroke-dashoffset:1}
}
@media(prefers-reduced-motion:reduce){.r-etapes-chemin .ecm-trace,.r-etapes-chemin .ecm-n,.r-etapes-chemin .ecm-arr,.r-etapes-chemin .ecm-lien path{transition:none}}
`; }
};

/* ── 3. des cartes aux grands chiffres en contour, en escalier ── */
const etapesCartes = {
  id: 'etapes.cartes', rubrique: 'etapes', nom: 'Cartes aux grands chiffres',
  quand: 'trois étapes pour un artisan, un garage ou un cabinet : trois cartes en escalier, un très grand chiffre en contour se dessine dans chacune et se remplit au survol',
  familles: ['atelier', 'garage', 'cabinet', 'boutique', 'verdure'], ambiances: ['franc', 'calme', 'premium'], surfaces: ['surface', 'fond', 'champ'], js: [],
  besoin: besoinEtapes,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, e = etapesDe(spec, h);
    const l = e.map(function (x, k) { return '<li class="eca-c"' + h.rv('monte', k) + '><svg class="eca-n" viewBox="0 0 150 170" aria-hidden="true"><text x="148" y="150" text-anchor="end">' + (k + 1) + '</text></svg><div class="eca-tx"><h3>' + h.esc(titreEtape(h, x)) + '</h3>' + texteEtape(h, x) + '</div></li>'; }).join('');
    return '<section class="' + h.classes('etapes.cartes', bloc, 'sec') + '" id="etapes">' + h.fond(bloc) + '<div class="w"><div class="eca-tete">' + h.teteSec(ctx.mod.textes.etapes) + '<div' + h.rv('monte', 1) + '>' + action(spec, h) + '</div></div><ol class="eca' + (e.some(function (x) { return h.net(x.texte); }) ? '' : ' nu') + '">' + l + '</ol></div></section>';
  },
  css: function () { return sansCoupe('.r-etapes-cartes') + `
.r-etapes-cartes .eca-tete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px 40px;margin-bottom:clamp(34px,4.4vw,64px)}
.r-etapes-cartes .eca-tete .tete-sec{margin-bottom:0}
.r-etapes-cartes .eca{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2vw,26px);align-items:start}
.r-etapes-cartes .eca-c{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;min-height:clamp(270px,26vw,350px);padding:clamp(22px,2.4vw,32px);background:var(--carte);border:1px solid var(--bord);border-radius:var(--r);transition:border-color .4s,transform .6s var(--ease)}
.r-etapes-cartes .eca-c:nth-child(1){margin-top:clamp(0px,6vw,88px)}.r-etapes-cartes .eca-c:nth-child(2){margin-top:clamp(0px,3vw,44px)}
.r-etapes-cartes .eca.nu .eca-c{min-height:clamp(190px,16vw,230px)}.r-etapes-cartes .eca.nu .eca-c:nth-child(1){margin-top:clamp(0px,4vw,56px)}.r-etapes-cartes .eca.nu .eca-c:nth-child(2){margin-top:clamp(0px,2vw,28px)}
.r-etapes-cartes .eca-c::after{content:"";position:absolute;left:0;bottom:0;height:4px;width:100%;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform .7s var(--ease)}
.r-etapes-cartes .eca-c:hover{border-color:color-mix(in srgb,var(--acc) 55%,var(--bord))}
.r-etapes-cartes .eca-c:hover::after{transform:none}
.r-etapes-cartes .eca-n{position:absolute;right:clamp(-30px,-1.6vw,-12px);top:clamp(-46px,-2.6vw,-18px);width:clamp(150px,17vw,250px);height:auto;z-index:-1;overflow:visible}
.r-etapes-cartes .eca-n text{font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:170px;fill:transparent;stroke:var(--acc);stroke-width:1.3;stroke-dasharray:1200;stroke-dashoffset:0;transition:stroke-dashoffset 2.6s cubic-bezier(.4,0,.2,1) .25s,fill .55s ease}
.js .r-etapes-cartes .eca-c:not(.vu) .eca-n text{stroke-dashoffset:1200}
.r-etapes-cartes .eca-c:hover .eca-n text{fill:color-mix(in srgb,var(--acc) 22%,transparent)}
.r-etapes-cartes .eca-tx{display:grid;gap:8px;max-width:22em}
.r-etapes-cartes .eca-tx h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.35rem,2vw,1.75rem);line-height:1.06}
.r-etapes-cartes .eca-tx p{color:var(--tx2)}
@media(max-width:860px){.r-etapes-cartes .eca{grid-template-columns:1fr}.r-etapes-cartes .eca-c,.r-etapes-cartes .eca-c:nth-child(1),.r-etapes-cartes .eca-c:nth-child(2){min-height:200px;margin-top:0}.r-etapes-cartes .eca-n{width:132px;top:-12px;right:-4px}}
@media(prefers-reduced-motion:reduce){.r-etapes-cartes .eca-n text,.r-etapes-cartes .eca-c::after{transition:none}}
`; }
};

/* ── 4. un indicateur collant qui suit l'étape lue ── */
const etapesColle = {
  id: 'etapes.colle', rubrique: 'etapes', nom: 'Indicateur qui suit la lecture',
  quand: 'trois étapes à expliquer posément (cabinet, soins, artisan) : à gauche un grand chiffre collant qui roule d\'une étape à l\'autre pendant la lecture, à droite les étapes en grand',
  familles: ['cabinet', 'atelier', 'ecrin', 'verdure', 'horizon'], ambiances: ['calme', 'premium', 'franc'], surfaces: ['fond', 'surface'], js: [],
  besoin: besoinEtapes,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, e = etapesDe(spec, h), n = e.length;
    const ind = '<div class="eco-ind" aria-hidden="true"><span class="eco-chiffre"><span class="eco-bande">' + e.map(function (x, k) { return '<span>' + (k + 1) + '</span>'; }).join('') + '</span></span><span class="eco-sur">sur ' + n + '</span><span class="eco-segs">' + e.map(function () { return '<i class="eco-seg"></i>'; }).join('') + '</span></div>';
    const l = e.map(function (x, k) { return '<li class="eco-e' + (k ? '' : ' on') + '"' + h.rv('monte') + '><span class="eco-n" aria-hidden="true">Étape ' + (k + 1) + '</span><h3>' + h.esc(titreEtape(h, x)) + '</h3>' + texteEtape(h, x) + '</li>'; }).join('');
    return '<section class="' + h.classes('etapes.colle', bloc, 'sec') + '" id="etapes">' + h.fond(bloc) + '<div class="w eco" data-colle style="--a:0"><div class="eco-g">' + h.teteSec(ctx.mod.textes.etapes) + ind + '<div class="eco-act">' + action(spec, h) + '</div></div><ol class="eco-l' + (e.some(function (x) { return h.net(x.texte); }) ? '' : ' nu') + '">' + l + '</ol></div></section>';
  },
  // l'étape lue est celle qui passe au milieu de l'écran ; sans script, toutes sont pleinement lisibles et l'indicateur se tait
  script: `
[].slice.call(d.querySelectorAll('.r-etapes-colle [data-colle]')).forEach(function(s){var es=[].slice.call(s.querySelectorAll('.eco-e')),sg=[].slice.call(s.querySelectorAll('.eco-seg')),cur=-1;if(!es.length||!('IntersectionObserver' in w))return;
var voir=function(k){if(k===cur||k<0)return;cur=k;s.style.setProperty('--a',k);es.forEach(function(e,i){e.classList.toggle('on',i===k)});sg.forEach(function(g,i){g.classList.toggle('on',i<=k)})};
s.classList.add('ok');var io=new IntersectionObserver(function(x){x.forEach(function(e){if(e.isIntersecting)voir(es.indexOf(e.target))})},{rootMargin:'-42% 0px -52% 0px'});es.forEach(function(e){io.observe(e)});voir(0)})`,
  css: function () { return sansCoupe('.r-etapes-colle') + `
.r-etapes-colle .eco{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:clamp(36px,6vw,110px);align-items:start}
.r-etapes-colle .eco-g{position:sticky;top:clamp(96px,14vh,150px);display:grid;gap:clamp(22px,3vw,34px);justify-items:start}
.r-etapes-colle .eco-g .tete-sec{margin-bottom:0}
.r-etapes-colle .eco-ind{display:none;align-items:flex-end;gap:16px;flex-wrap:wrap}
.r-etapes-colle .ok .eco-ind{display:flex}
.r-etapes-colle .eco-chiffre{display:block;height:1em;overflow:hidden;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(6rem,12vw,10.5rem);line-height:1;color:var(--accT)}
.r-etapes-colle .eco-bande{display:flex;flex-direction:column;transform:translateY(calc(var(--a,0) * -1em));transition:transform .9s cubic-bezier(.7,0,.2,1)}
.r-etapes-colle .eco-bande span{display:block;height:1em}
.r-etapes-colle .eco-sur{font-weight:var(--fxf);color:var(--tx2);padding-bottom:.6em}
.r-etapes-colle .eco-segs{flex-basis:100%;display:flex;gap:6px;max-width:260px}
.r-etapes-colle .eco-seg{flex:1;height:4px;border-radius:4px;background:var(--bord);overflow:hidden;position:relative}
.r-etapes-colle .eco-seg::after{content:"";position:absolute;inset:0;background:var(--btn);transform:scaleX(0);transform-origin:left;transition:transform .7s var(--ease)}
.r-etapes-colle .eco-seg.on::after{transform:none}
.r-etapes-colle .eco-l{display:grid}
.r-etapes-colle .eco-e{min-height:clamp(240px,44vh,420px);display:grid;align-content:center;gap:12px;padding-block:clamp(24px,4vh,48px);border-top:1px solid var(--bord)}
.r-etapes-colle .eco-e:first-child{border-top:0;align-content:start;padding-top:0}
@media(min-width:861px){.r-etapes-colle .eco-l.nu .eco-e{min-height:clamp(170px,28vh,280px)}}
.r-etapes-colle .eco-n{font-weight:var(--fxf);color:var(--accT);font-size:.98rem}
.r-etapes-colle .eco-e h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.9rem,4vw,3.4rem);line-height:1.02;max-width:14em;transition:opacity .6s ease}
.r-etapes-colle .eco-e p{color:var(--tx2);font-size:1.08rem;max-width:46ch;transition:opacity .6s ease}
.r-etapes-colle .ok .eco-e:not(.on) h3,.r-etapes-colle .ok .eco-e:not(.on) p{opacity:.4}
@media(max-width:860px){
.r-etapes-colle .eco{grid-template-columns:1fr;gap:0}
.r-etapes-colle .eco-g{display:contents}
.r-etapes-colle .eco-g .tete-sec{margin-bottom:24px}
.r-etapes-colle .ok .eco-ind{position:sticky;top:84px;z-index:4;display:flex;align-items:center;gap:12px;padding:8px 16px 8px 18px;margin-bottom:12px;background:color-mix(in srgb,var(--carte) 88%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid var(--bord);border-radius:999px;box-shadow:var(--ombre);flex-wrap:nowrap}
.r-etapes-colle .eco-chiffre{font-size:2.1rem}
.r-etapes-colle .eco-sur{padding:0;white-space:nowrap}
.r-etapes-colle .eco-segs{flex:1 1 auto;max-width:none}
.r-etapes-colle .eco-act{order:9;margin-top:28px}
.r-etapes-colle .eco-e{min-height:0;padding-block:28px}
.r-etapes-colle .eco-e:first-child{padding-top:8px}
}
@media(prefers-reduced-motion:reduce){.r-etapes-colle .eco-bande,.r-etapes-colle .eco-seg::after,.r-etapes-colle .eco-e h3,.r-etapes-colle .eco-e p{transition:none}.r-etapes-colle .ok .eco-e:not(.on) h3,.r-etapes-colle .ok .eco-e:not(.on) p{opacity:1}}
`; }
};

/* ── 5. des étapes reliées par des flèches qui passent le relais ── */
const etapesFleches = {
  id: 'etapes.fleches', rubrique: 'etapes', nom: 'Étapes reliées par des flèches',
  quand: 'trois étapes simples (artisan, garage, boutique, jardin) : trois pastilles reliées par des flèches ; le relais passe de l\'une à l\'autre en boucle, comme un message qui avance',
  familles: ['atelier', 'garage', 'verdure', 'boutique', 'cabinet', 'comptoir'], ambiances: ['franc', 'chaleureux', 'calme'], surfaces: ['fond', 'surface', 'champ'], js: ['defile'],
  besoin: besoinEtapes,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, e = etapesDe(spec, h);
    const fleche = '<svg class="efl-f" viewBox="0 0 120 24" aria-hidden="true"><path class="efl-base" d="M4 12H110"/><path class="efl-flux" pathLength="1" d="M4 12H110"/><path class="efl-pointe" d="M100 3.5l11 8.5-11 8.5"/></svg>';
    const l = e.map(function (x, k) { return '<li class="efl-e" style="--k:' + k + '"><div class="efl-in"' + h.rv('monte', k * 2) + '><span class="efl-n" aria-hidden="true">' + (k + 1) + '</span><div class="efl-c"><h3>' + h.esc(titreEtape(h, x)) + '</h3>' + texteEtape(h, x) + '</div></div>' + (k < e.length - 1 ? fleche : '') + '</li>'; }).join('');
    return '<section class="' + h.classes('etapes.fleches', bloc, 'sec') + '" id="etapes">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.etapes) + '<ol class="efl" data-defile>' + l + '</ol><div class="efl-act"' + h.rv('monte', 6) + '>' + action(spec, h) + '</div></div></section>';
  },
  css: function () { return sansCoupe('.r-etapes-fleches') + `
.r-etapes-fleches .efl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:clamp(70px,9vw,130px);--cyc:7.2s}
.r-etapes-fleches .efl-e{position:relative}
.r-etapes-fleches .efl-in{display:grid;gap:18px;justify-items:start}
.r-etapes-fleches .efl-n{position:relative;width:clamp(68px,6.4vw,88px);aspect-ratio:1;display:grid;place-items:center;border-radius:var(--rb);background:var(--btn);color:var(--btnT);font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:clamp(1.5rem,2.4vw,2rem);line-height:1}
.r-etapes-fleches .efl-n::after{content:"";position:absolute;inset:-7px;border-radius:inherit;border:2px solid var(--btn);opacity:0;animation:k-etapes-fleches-relais var(--cyc) ease-out infinite;animation-delay:calc(var(--k) * var(--cyc) / 3)}
.r-etapes-fleches .efl-c{display:grid;gap:8px}
.r-etapes-fleches .efl-c h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.4rem,2.3vw,2rem);line-height:1.04}
.r-etapes-fleches .efl-c p{color:var(--tx2)}
.r-etapes-fleches .efl-f{position:absolute;left:calc(100% + clamp(8px,1.2vw,16px));top:calc(clamp(68px,6.4vw,88px) / 2 - 12px);width:calc(clamp(70px,9vw,130px) - 2 * clamp(8px,1.2vw,16px));height:24px;overflow:visible}
.r-etapes-fleches .efl-base,.r-etapes-fleches .efl-pointe{fill:none;stroke:color-mix(in srgb,var(--tx) 24%,transparent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.r-etapes-fleches .efl-base{stroke-dasharray:1 9}
.r-etapes-fleches .efl-pointe{stroke:var(--acc)}
.r-etapes-fleches .efl-flux{fill:none;stroke:var(--acc);stroke-width:3.5;stroke-linecap:round;stroke-dasharray:.42 1;stroke-dashoffset:.42;animation:k-etapes-fleches-flux var(--cyc) cubic-bezier(.5,0,.3,1) infinite;animation-delay:calc(var(--k) * var(--cyc) / 3 + var(--cyc) / 9)}
.r-etapes-fleches .efl-e .efl-pointe{animation:k-etapes-fleches-pousse var(--cyc) ease-in-out infinite;animation-delay:calc(var(--k) * var(--cyc) / 3 + var(--cyc) / 9)}
.r-etapes-fleches .arret .efl-n::after,.r-etapes-fleches .arret .efl-flux,.r-etapes-fleches .arret .efl-pointe{animation-play-state:paused}
@keyframes k-etapes-fleches-relais{0%{opacity:0;transform:scale(.9)}4%{opacity:.9}24%{opacity:0;transform:scale(1.22)}100%{opacity:0;transform:scale(1.22)}}
@keyframes k-etapes-fleches-flux{0%{stroke-dashoffset:.42}22%{stroke-dashoffset:-1}100%{stroke-dashoffset:-1}}
@keyframes k-etapes-fleches-pousse{0%,6%{transform:none}14%{transform:translateX(5px)}24%,100%{transform:none}}
.r-etapes-fleches .efl-act{margin-top:clamp(40px,5vw,64px)}
@media(max-width:760px){
.r-etapes-fleches .efl{grid-template-columns:1fr;row-gap:clamp(56px,15vw,72px)}
.r-etapes-fleches .efl-in{grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:20px}
.r-etapes-fleches .efl-f{left:calc(clamp(68px,6.4vw,88px) / 2);top:calc(100% - 4px);width:calc(clamp(56px,15vw,72px) - 16px);transform-origin:0 50%;transform:rotate(90deg)}
}
@media(prefers-reduced-motion:reduce){.r-etapes-fleches .efl-n::after,.r-etapes-fleches .efl-flux,.r-etapes-fleches .efl-e .efl-pointe{animation:none}}
`; }
};

module.exports = [etapesChronologie, etapesChemin, etapesCartes, etapesColle, etapesFleches];
