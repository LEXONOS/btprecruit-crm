// La base commune de tous les sites : jetons (couleurs de la palette, voix typographique, formes, mouvement),
// surfaces (fond, surface, champ, accent, photo) qui donnent à chaque rubrique ses couleurs locales, boutons animés
// (six styles, un par site), apparitions au défilement, et ce qui sert à toutes les pages (aperçu, barre d'action,
// pages intérieures). Les rubriques n'utilisent que ces jetons : une palette change, tout le site suit.
'use strict';
const T = require('../theme');

function triplet(h) { const x = String(h).replace('#', ''); const n = parseInt(x, 16); return ((n >> 16) & 255) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255); }
function couleurs(p) {
  const voile = T.contraste('#ffffff', p.champ) >= 9 ? p.champ : T.melange(p.champ, '#000000', 0.62);
  const carte = p.clair ? (p.fond.toLowerCase() === '#ffffff' ? '#ffffff' : T.melange(p.fond, '#ffffff', 0.65)) : p.surface;
  return {
    voile: triplet(voile), carte: carte,
    ligne: T.melange(p.encre, p.fond, p.clair ? 0.87 : 0.82),
    teinte: T.melange(p.accent, p.fond, p.clair ? 0.87 : 0.8),
    teinteTexte: T.lisible(p.accent, T.melange(p.accent, p.fond, p.clair ? 0.87 : 0.8), 4.5),
    // l'accent lisible sur le champ (petits textes, chiffres, icônes posés sur les bandes sombres)
    accentChamp: T.contraste(p.vif, p.champ) >= 3 ? p.vif : p.surChamp,
    // le bouton sur une bande sombre et sur une photo voilée : la couleur vive seulement si elle s'en détache
    // (une palette moutarde et noir a un « vif » presque noir : le bouton disparaîtrait), sinon le clair de la palette
    btnChamp: T.contraste(p.vif, p.champ) >= 2.4 ? [p.vif, p.surVif] : (T.contraste(p.surChamp, p.champ) >= 3 ? [p.surChamp, p.champ] : ['#ffffff', '#111111']),
    btnPhoto: T.contraste(p.vif, voile) >= 3 ? [p.vif, p.surVif] : ['#ffffff', T.contraste('#111111', '#ffffff') >= 4.5 ? '#111111' : p.encre],
    ombre: p.clair ? '0 1px 2px rgb(16 24 40 / .05), 0 18px 44px -20px rgb(16 24 40 / .28)' : '0 1px 0 rgb(255 255 255 / .04), 0 18px 44px -18px rgb(0 0 0 / .7)',
    ombreF: p.clair ? '0 2px 4px rgb(16 24 40 / .04), 0 30px 70px -28px rgb(16 24 40 / .38)' : '0 30px 70px -24px rgb(0 0 0 / .8)'
  };
}
// le mouvement selon l'ambiance du site : douce (lente, ample), nette (rapide, courte), vive (rebond léger)
const MOUVEMENTS = {
  douce: { dur: '1.15s', pas: '110ms', dy: '34px', dx: '44px', ease: 'cubic-bezier(.19,1,.22,1)' },
  nette: { dur: '.8s', pas: '70ms', dy: '22px', dx: '30px', ease: 'cubic-bezier(.16,.84,.3,1)' },
  vive: { dur: '.95s', pas: '85ms', dy: '30px', dx: '38px', ease: 'cubic-bezier(.34,1.32,.64,1)' }
};

function polices(ty) {
  const faces = [];
  [ty.titre, ty.texte].filter(function (x, i, a) { return a.indexOf(x) === i; }).forEach(function (cle) {
    (T.FICHIERS_POLICES[cle] || []).forEach(function (f) { faces.push('@font-face{font-family:"' + f.famille + '";src:url(/_f/' + f.fichier + ') format("woff2");font-weight:' + f.poids + ';' + (f.etirement ? 'font-stretch:' + f.etirement + ';' : '') + 'font-display:swap}'); });
  });
  return faces.join('');
}

// ctx : { palette, type, mod (modèle de métier), compo: { mouvement, boutons } }
function css(ctx) {
  const p = ctx.palette, ty = ctx.type, f = ctx.mod.forme, k = couleurs(p);
  const ft = T.FICHIERS_POLICES[ty.titre][0].famille, fx = T.FICHIERS_POLICES[ty.texte][0].famille;
  const repli = function (x) { return ty.serif && x === fx ? 'ui-serif,Georgia,"Times New Roman",serif' : (x === ft && /bodoni|fraunces|young|besley|newsreader/i.test(x) ? 'ui-serif,Georgia,serif' : 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'); };
  const ech = 0.5 / ty.chasse;
  const h2a = Math.max(1.75, Math.min(2.3, 2.05 * ech)).toFixed(2), h2b = Math.max(2.4, Math.min(3.7, 3.25 * ech)).toFixed(2);
  const mv = MOUVEMENTS[(ctx.compo && ctx.compo.mouvement) || 'nette'] || MOUVEMENTS.nette;
  return polices(ty) + `
:root{color-scheme:${p.clair ? 'light' : 'dark'};--fond:${p.fond};--surface:${p.surface};--carte:${k.carte};--encre:${p.encre};--doux:${p.doux};--accent:${p.accent};--surA:${p.surAccent};--accentT:${p.accentTexte};--champ:${p.champ};--surC:${p.surChamp};--champDoux:${p.champDoux};--vif:${p.vif};--surV:${p.surVif};--btnC:${k.btnChamp[0]};--btnCT:${k.btnChamp[1]};--btnP:${k.btnPhoto[0]};--btnPT:${k.btnPhoto[1]};--accC:${k.accentChamp};--ligne:${k.ligne};--teinte:${k.teinte};--teinteT:${k.teinteTexte};--voile:${k.voile};--ombre:${k.ombre};--ombreF:${k.ombreF};--ft:"${ft}",${repli(ft)};--fx:"${fx}",${repli(fx)};--tp:${ty.poids};--ti:${ty.interlettre};--th:${ty.hauteur};--tc:${ty.casse};--tr:${ty.reglage};--te:${ty.etirement || 'normal'};--fxr:${ty.reglageTexte || 'normal'};--fxf:${ty.texteFort};--g:clamp(18px,4.4vw,56px);--w:1240px;--r:${f.r};--rb:${f.rb};--rp:${f.rp};--h2a:${h2a}rem;--h2b:${h2b}rem;--corps:${ty.serif ? '1.1rem' : '1.0625rem'};--geant:clamp(3.2rem,${(10.5 * ech).toFixed(1)}vw,${(10 * ech).toFixed(1)}rem);--dur:${mv.dur};--pas:${mv.pas};--dy:${mv.dy};--dx:${mv.dx};--ease:${mv.ease};--ease2:cubic-bezier(.65,0,.35,1);--sec:clamp(76px,9.5vw,144px)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;accent-color:var(--accent);scroll-padding-top:90px}
@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
body{margin:0;background:var(--fond);color:var(--encre);font-family:var(--fx);font-weight:400;font-size:var(--corps);line-height:1.6;font-variation-settings:var(--fxr);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;overflow-x:clip}
body.menu-ouvert{overflow:hidden}
::selection{background:var(--accent);color:var(--surA)}
img,svg{display:block;max-width:100%}img{height:auto}
a{color:inherit;text-decoration-thickness:.07em;text-underline-offset:.2em}
:focus-visible{outline:3px solid var(--accT,var(--accentT));outline-offset:3px}
.s-champ :focus-visible,.s-photo :focus-visible,.s-accent :focus-visible{outline-color:currentColor}
.w{width:min(var(--w),100% - 2*var(--g));margin-inline:auto}
.saut{position:absolute;left:-9999px;top:8px;z-index:99;background:var(--encre);color:var(--fond);padding:10px 14px}.saut:focus{left:8px}
.ic{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.t{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);line-height:var(--th);text-wrap:balance;margin:0;overflow-wrap:break-word}
h2.t{font-size:clamp(var(--h2a),3.7vw,var(--h2b));line-height:1.02}
h3{margin:0;font-weight:var(--fxf);font-size:1.2rem;line-height:1.3}
p,ul,ol,figure,blockquote{margin:0}ul,ol{padding:0;list-style:none}
.h1{font-size:max(1.75rem,min(var(--hmax,5rem),calc(100cqi / var(--hk))));hyphens:auto;-webkit-hyphens:auto}
.cq{container-type:inline-size}
.ph{margin:0;overflow:hidden;background:var(--surface);border-radius:var(--rp);position:relative}
.ph img{width:100%;height:100%;object-fit:cover}
/* surfaces : les couleurs locales d'un bloc */
.r{position:relative;isolation:isolate;background:var(--bg);color:var(--tx)}
.s-fond{--bg:var(--fond);--tx:var(--encre);--tx2:var(--doux);--acc:var(--accent);--accT:var(--accentT);--btn:var(--accent);--btnT:var(--surA);--carte:${k.carte};--bord:var(--ligne);--douce:var(--surface)}
.s-surface{--bg:var(--surface);--tx:var(--encre);--tx2:var(--doux);--acc:var(--accent);--accT:var(--accentT);--btn:var(--accent);--btnT:var(--surA);--carte:${p.clair ? (p.fond.toLowerCase() === p.surface.toLowerCase() ? '#ffffff' : p.fond) : T.melange(p.surface, '#ffffff', 0.06)};--bord:${T.melange(p.encre, p.surface, p.clair ? 0.84 : 0.8)};--douce:var(--fond)}
.s-teinte{--bg:var(--teinte);--tx:var(--encre);--tx2:var(--doux);--acc:var(--accent);--accT:var(--teinteT);--btn:var(--accent);--btnT:var(--surA);--carte:color-mix(in srgb,#fff 70%,var(--teinte));--bord:color-mix(in srgb,var(--encre) 13%,transparent);--douce:color-mix(in srgb,#fff 45%,var(--teinte))}
.s-champ{--bg:var(--champ);--tx:var(--surC);--tx2:var(--champDoux);--acc:var(--accC);--accT:var(--accC);--btn:var(--btnC);--btnT:var(--btnCT);--carte:color-mix(in srgb,var(--surC) 7%,var(--champ));--bord:color-mix(in srgb,var(--surC) 16%,transparent);--douce:color-mix(in srgb,var(--surC) 6%,var(--champ))}
.s-accent{--bg:var(--accent);--tx:var(--surA);--tx2:color-mix(in srgb,var(--surA) 86%,var(--accent));--acc:var(--surA);--accT:var(--surA);--btn:var(--surA);--btnT:var(--accent);--carte:color-mix(in srgb,var(--surA) 10%,var(--accent));--bord:color-mix(in srgb,var(--surA) 24%,transparent);--douce:color-mix(in srgb,var(--surA) 8%,var(--accent))}
.s-photo{--bg:rgb(var(--voile));--tx:#fff;--tx2:rgb(255 255 255 / .86);--acc:#fff;--accT:#fff;--btn:var(--btnP);--btnT:var(--btnPT);--carte:rgb(255 255 255 / .1);--bord:rgb(255 255 255 / .22);--douce:rgb(255 255 255 / .08)}
.fond{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.sec{padding-block:var(--sec)}
/* boutons : la base, puis le style du site (b-glisse, b-fleche, b-brillance, b-pilule, b-contour, b-plein) */
.btn{position:relative;isolation:isolate;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:0 26px;border:2px solid transparent;border-radius:var(--rb);font-family:var(--fx);font-weight:var(--fxf);font-size:1.02rem;line-height:1.1;text-decoration:none;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .45s var(--ease),box-shadow .45s var(--ease),background-color .35s,color .35s,border-color .35s;will-change:transform}
.btn .ic{transition:transform .45s var(--ease)}
.btn .bf{display:none}
.b1{background:var(--btn,var(--accent));color:var(--btnT,var(--surA))}
.b2{border-color:color-mix(in srgb,currentColor 55%,transparent);color:var(--tx,var(--encre));background:transparent}
.b2:hover{border-color:currentColor}
.btn:active{transform:scale(.97)}
.caps .btn{text-transform:uppercase;letter-spacing:.06em;font-size:.93rem}
@media(hover:hover){.btn:hover{transform:translateY(-3px);box-shadow:0 14px 30px -12px color-mix(in srgb,var(--btn,var(--accent)) 70%,transparent)}.b2:hover{box-shadow:none}}
.b-glisse .b1::before{content:"";position:absolute;inset:0;z-index:-1;background:color-mix(in srgb,var(--btnT,var(--surA)) 18%,var(--btn,var(--accent)));transform:scaleX(0);transform-origin:right;transition:transform .55s var(--ease)}
.b-glisse .b1:hover::before{transform:scaleX(1);transform-origin:left}
.b-glisse .b2::before{content:"";position:absolute;inset:0;z-index:-1;background:currentColor;opacity:.1;transform:scaleY(0);transform-origin:bottom;transition:transform .5s var(--ease)}
.b-glisse .b2:hover::before{transform:scaleY(1)}
.b-fleche .btn .bf{display:inline-flex;width:0;overflow:hidden;opacity:0;margin-left:-10px;transition:width .45s var(--ease),opacity .3s,margin .45s var(--ease)}
.b-fleche .btn:hover .bf{width:20px;opacity:1;margin-left:0}
.b-fleche .btn:hover>.ic:first-child{transform:rotate(-8deg) scale(1.08)}
.b-brillance .b1::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;z-index:1;background:linear-gradient(100deg,transparent,rgb(255 255 255 / .45),transparent);transform:skewX(-18deg);transition:left .9s var(--ease)}
.b-brillance .b1:hover::after{left:130%}
.b-pilule .btn{border-radius:999px;padding-left:10px}
.b-pilule .btn>.ic:first-child{width:38px;height:38px;padding:9px;border-radius:999px;background:color-mix(in srgb,currentColor 16%,transparent);transition:transform .5s var(--ease),background-color .3s}
.b-pilule .btn:hover>.ic:first-child{transform:rotate(-12deg) scale(1.06);background:color-mix(in srgb,currentColor 26%,transparent)}
.b-contour .b1{background:transparent;color:var(--tx,var(--encre));border-color:var(--btn,var(--accent))}
.b-contour .b1::before{content:"";position:absolute;inset:-2px;z-index:-1;background:var(--btn,var(--accent));transform:translateY(101%);transition:transform .5s var(--ease)}
.b-contour .b1:hover{color:var(--btnT,var(--surA))}.b-contour .b1:hover::before{transform:none}
.b-plein .btn{border-radius:calc(var(--rb) * 1.4)}.b-plein .b1{box-shadow:inset 0 -3px 0 rgb(0 0 0 / .18)}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px}
@media(max-width:480px){.actions .btn{flex:1 1 100%}}
/* petites pièces communes */
.confiance{display:flex;flex-wrap:wrap;gap:10px 26px;font-size:.95rem;line-height:1.35;color:var(--tx2,var(--doux))}
.confiance li{display:flex;align-items:center;gap:8px}
.confiance .ic{color:var(--accT,var(--accentT));width:18px;height:18px}
.confiance b{color:var(--tx,var(--encre))}
.etoiles{position:relative;display:inline-flex;flex:none}
.etoiles>span{display:inline-flex;gap:1px}
.etoiles .pl{position:absolute;inset:0 auto 0 0;width:var(--n);overflow:hidden}
.etoiles .ic{width:16px;height:16px;flex:none;stroke:none}.etoiles .pl .ic{fill:#f5b301}.etoiles .vd .ic{fill:currentColor;opacity:.25}
.tete-sec{display:grid;gap:16px;margin-bottom:clamp(34px,4.4vw,64px);max-width:64ch}
.tete-sec p{color:var(--tx2,var(--doux));font-size:1.1rem;max-width:56ch}
.centre .tete-sec,.tete-sec.c{margin-inline:auto;text-align:center;justify-items:center}
.sur-t{font-size:.9rem;font-weight:var(--fxf);color:var(--accT,var(--accentT));letter-spacing:.02em}
.horaires li{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px dashed var(--bord,var(--ligne))}
.horaires li:last-child{border-bottom:0}
.horaires span:last-child{text-align:right;color:var(--tx2,var(--doux))}
/* apparitions au défilement (seulement si le script tourne : classe js, posée dans l'en-tête) */
.js [data-r]{opacity:0;transition:opacity var(--dur) var(--ease),translate var(--dur) var(--ease),scale var(--dur) var(--ease),clip-path calc(var(--dur) * 1.25) var(--ease),filter var(--dur) var(--ease);transition-delay:calc(var(--i,0) * var(--pas))}
/* les entrées passent par translate et scale, jamais par transform : la rotation ou l'échelle propre à un élément
   (un tirage posé de travers, une photo centrée) reste intacte, et le survol comme l'aimant continuent de marcher */
.js [data-r=monte]{translate:0 var(--dy)}
.js [data-r=zoom]{scale:.92}
.js [data-r=recul]{scale:1.08}
.js [data-r=gauche]{translate:calc(-1 * var(--dx)) 0}
.js [data-r=droite]{translate:var(--dx) 0}
.js [data-r=rideau]{opacity:1;clip-path:inset(0 100% 0 0)}
.js [data-r=store]{opacity:1;clip-path:inset(100% 0 0 0)}
.js [data-r=iris]{opacity:1;clip-path:circle(0% at 50% 50%)}
.js [data-r=flou]{filter:blur(14px);scale:1.03}
.js [data-r=mots]{opacity:1}
.m{display:inline-block;overflow:hidden;vertical-align:top;padding:.2em 0 .08em;margin:-.2em 0 -.08em}
.m>span{display:inline-block}
.js [data-r=mots] .m>span{translate:0 105%;transition:translate calc(var(--dur) * 1.1) var(--ease);transition-delay:calc(var(--i,0) * 60ms + 80ms)}
.js [data-r].vu{opacity:1;translate:none;scale:none}
.js [data-r=flou].vu{filter:none}
.js [data-r=rideau].vu,.js [data-r=store].vu{clip-path:inset(-80px -80px -80px -80px)}
.js [data-r=iris].vu{clip-path:circle(75% at 50% 50%)}
.js [data-r=mots].vu .m>span{translate:none}
.js [data-r=rideau] img,.js [data-r=store] img,.js [data-r=iris] img{scale:1.14;transition:scale calc(var(--dur) * 1.8) var(--ease)}
.js [data-r=rideau].vu img,.js [data-r=store].vu img,.js [data-r=iris].vu img{scale:none}
/* mouvement réduit : tout est là tout de suite, sans toucher aux formes ni aux filtres voulus par les rubriques */
@media(prefers-reduced-motion:reduce){.js [data-r]{opacity:1!important;translate:none!important;scale:none!important;transition:none!important}.js [data-r=flou]{filter:none!important}.js [data-r=rideau],.js [data-r=store],.js [data-r=iris]{clip-path:none!important}.js [data-r=rideau] img,.js [data-r=store] img,.js [data-r=iris] img,.js [data-r=mots] .m>span{scale:none!important;translate:none!important;transition:none!important}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
/* pages intérieures */
.page-h{padding-block:clamp(130px,14vw,190px) clamp(20px,3vw,40px)}
.page-h .w{display:grid;gap:20px;--hmax:4.6rem;container-type:inline-size}
.page-h p{color:var(--doux);font-size:1.12rem;max-width:56ch}
.prose{max-width:72ch;display:grid;gap:14px;color:var(--doux)}
.prose h2{font-weight:var(--fxf);font-size:1.25rem;line-height:1.3;color:var(--encre);margin:20px 0 0}
.prose strong{color:var(--encre)}
.prose a{color:var(--accentT)}
.prose .note{background:var(--surface);border-radius:var(--r);padding:16px 18px}
.srv-pages{display:grid;gap:clamp(28px,4vw,48px)}
.srv-pages article{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:10px clamp(24px,4vw,64px);padding-bottom:clamp(28px,4vw,48px);border-bottom:1px solid var(--ligne)}
.srv-pages h2{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-size:clamp(1.4rem,2.4vw,2rem);line-height:1.1;margin:0}
.srv-pages p{color:var(--doux)}
@media(max-width:760px){.srv-pages article{grid-template-columns:1fr}}
/* aperçu : la barre et son panneau (lib/sites/panneau.js) ; le menu ouvert passe devant eux et la barre d'action */
.menu-ouvert [data-tete]{z-index:90}
.a-apercu footer.r,.a-apercu .pied{padding-bottom:120px}
/* barre d'action sur téléphone (site en ligne) */
.barre{display:none}
@media(max-width:860px){.barre{position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;gap:8px;padding:10px var(--g) calc(10px + env(safe-area-inset-bottom));background:var(--fond);box-shadow:0 -10px 30px rgba(0,0,0,.12);--btn:var(--accent);--btnT:var(--surA);--tx:var(--encre)}.barre .btn{flex:1;min-height:50px;padding:0 12px}.a-barre footer.r,.a-barre .pied{padding-bottom:104px}}
`;
}

module.exports = { css, couleurs, triplet, MOUVEMENTS, polices };
