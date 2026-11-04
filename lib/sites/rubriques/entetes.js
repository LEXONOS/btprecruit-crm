// Les en-têtes : neuf barres, chacune avec sa vraie idée (verre qui se resserre, pilule flottante, enseigne au centre,
// barre d'infos, ligne minimale, encre, indicateur glissant, transparente sur photo, tiroir) et son propre menu sur
// téléphone (panneau qui descend, carte qui s'ouvre, fente, store en tuiles, plein écran, double vague, tiroir du bas,
// volet sur la photo, tiroir latéral).
// Règle d'or : le panneau du menu est « position: fixed » ; aucun de ses ancêtres ne porte transform, filter ou
// backdrop-filter (ils en feraient son bloc conteneur et le menu resterait coincé dans la barre). Le verre et les
// translations vont sur un enfant (.nv-barre) ou un pseudo-élément.
'use strict';
const MQ = require('../../martinique');
const T = require('../theme');

/* ── outils locaux ── */
// une icône du jeu commun en masque CSS (pour décorer les liens du menu, dont le balisage est commun)
function masque(nom) { return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (T.ICONES[nom] || T.ICONES.fleche) + '</svg>') + '")'; }
const M_FLECHE = masque('fleche');
// texte gardé pour les lecteurs d'écran quand un bouton ne montre plus que son icône
const CACHE = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

function liens(ctx, o) {
  o = o || {};
  const h = ctx.h;
  return (ctx.ancres || []).map(function (a, k) {
    const t = h.esc(a.nom);
    return '<a class="l" href="' + h.esc(a.href) + '" style="--i:' + (k + 1) + '">' + (o.roule ? '<span class="o"><span class="rl" data-t="' + t + '">' + t + '</span></span>' : t) + '</a>';
  });
}
function navLiens(ctx, o) {
  const l = liens(ctx, o);
  return l.length ? '<nav class="liens" aria-label="Navigation">' + l.join('') + ((o && o.fin) || '') + '</nav>' : '';
}
// le bouton d'action de la barre : un mot, et son nom complet pour les lecteurs d'écran (il ne garde que son icône sur téléphone)
function cta(spec, ctx, cls) {
  const h = ctx.h, a = h.actionPrincipale(spec), c = spec.contact || {};
  if (!a) return '';
  const nom = a.type === 'tel' ? 'Appeler le ' + MQ.affiche(c.tel) : a.type === 'whatsapp' ? 'Écrire sur WhatsApp' : 'Écrire un email';
  return '<a class="btn b1 nav-cta' + (cls ? ' ' + cls : '') + '" href="' + h.esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + ' aria-label="' + h.esc(nom) + '">' + h.contenuBouton(a.icone, a.type === 'tel' ? 'Appeler' : a.court) + '</a>';
}
function telDe(spec, h) { const c = spec.contact || {}, t = h.telHref(c.tel); return t ? { href: t, texte: MQ.affiche(c.tel) } : null; }
function waDe(spec, h) { const c = spec.contact || {}; return h.waHref(c.mobile || c.tel, h.objectif(spec).wa); }
// l'état « ouvert maintenant » (calculé dans le navigateur, module ouvert) ; sans script : le résumé des horaires
function etat(spec, h, cls) {
  const hs = h.horairesDe(spec.contact), mach = hs.length ? h.horairesMachine(hs) : null;
  if (!mach) return '';
  return '<p class="' + cls + '" data-horaires="' + h.esc(mach) + '"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(h.resumeHoraires(hs) || 'Horaires') + '</span></p>';
}
// le panneau commun du menu, avec un complément à la fin (infos pratiques, photo...)
function menuAvec(ctx, avant, apres) {
  let m = ctx.menuMobile || '';
  if (avant) m = m.replace(/^(<div class="menu-m"[^>]*>)/, function (x) { return x + avant; });
  if (apres && /<\/div>$/.test(m)) m = m.slice(0, -6) + apres + '</div>';
  return m;
}
// le bloc d'infos pratiques des menus : état, horaires, adresse
function infosMenu(spec, ctx, o) {
  o = o || {};
  const h = ctx.h, c = spec.contact || {}, hs = h.horairesDe(c), out = [];
  if (hs.length) out.push('<div class="mm-c"><p class="mm-t">Horaires</p>' + etat(spec, h, 'mm-etat') + (o.liste === false ? '' : h.listeHoraires(hs)) + '</div>');
  const ou = c.adresse || (spec.commune ? spec.commune + ', Martinique' : '');
  if (ou && o.adresse !== false) out.push('<div class="mm-c"><p class="mm-t">' + (h.zoneClient(spec) ? 'Où nous intervenons' : 'Adresse') + '</p><p>' + h.esc(h.zoneClient(spec) || ou) + '</p>' + (c.maps ? '<a class="mm-l" href="' + h.esc(c.maps) + '" target="_blank" rel="noopener">Voir l\'itinéraire</a>' : '') + '</div>');
  return out.length ? '<div class="mm-infos">' + out.join('') + '</div>' : '';
}

/* ── les scripts : chacun cherche SA barre par sa classe ── */
// le nom du bouton suit son état ; un clic sur le voile referme ; le lien de la rubrique lue est marqué
function jsBarre(cls, o) {
  o = o || {};
  let s = `var t=d.querySelector('.${cls}');if(t){var mb=t.querySelector('[data-menu-bouton]'),mp=t.querySelector('[data-menu]');
if(mb&&w.MutationObserver){new MutationObserver(function(){mb.setAttribute('aria-label',mb.getAttribute('aria-expanded')==='true'?'Fermer le menu':'Ouvrir le menu')}).observe(mb,{attributes:true,attributeFilter:['aria-expanded']})}`;
  if (o.voile) s += `if(mb&&mp){mp.addEventListener('click',function(e){if(e.target===mp&&mb.getAttribute('aria-expanded')==='true')mb.click()})}`;
  if (o.actif) s += `var ls=[].slice.call(t.querySelectorAll('a[href]')).filter(function(a){return !a.classList.contains('marque')&&!/^(tel|mailto|https?):/.test(a.getAttribute('href'))});
var cle=function(a){var u=a.getAttribute('href'),k=u.indexOf('#');return k>=0?u.slice(k+1):null};
var marquer=function(id){ls.forEach(function(a){var on=!!id&&cle(a)===id;a.classList.toggle('actif',on);if(on)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')});var ev=d.createEvent('Event');ev.initEvent('nv-actif',false,false);t.dispatchEvent(ev)};
var ids=[];ls.forEach(function(a){var id=cle(a);if(id&&ids.indexOf(id)<0&&d.getElementById(id))ids.push(id)});
if(ids.length&&'IntersectionObserver' in w){var vus={};var io=new IntersectionObserver(function(es){es.forEach(function(e){vus[e.target.id]=e.isIntersecting});var a=null;ids.forEach(function(id){if(vus[id])a=id});marquer(a)},{rootMargin:'-42% 0px -52% 0px'});ids.forEach(function(id){io.observe(d.getElementById(id))})}
else if(!ids.length){var p=location.pathname.replace(/\\/?$/,'/');ls.forEach(function(a){if(cle(a)===null&&a.pathname&&a.pathname.replace(/\\/?$/,'/')===p){a.classList.add('actif');a.setAttribute('aria-current','page')}})}`;
  if (o.plus) s += o.plus;
  // une portée à moi : mes variables ne touchent pas celles des modules communs (vus, io, t, mb, maj...)
  return '(function(){' + s + '}})();';
}

/* ── les morceaux de CSS communs à mes barres (toujours sous la classe de la variante) ── */
// la barre posée sur une photo : blanche, transparente, puis normale dès qu'on défile ; le menu ouvert passe devant tout
function cssBase(c, o) {
  o = o || {};
  return `
.${c}{position:sticky;top:0;z-index:50;background:transparent;pointer-events:none}
.${c}.sur-photo{position:fixed;left:0;right:0}
.${c}.sur-photo:not(.defile){--tx:#fff;color:#fff;--btn:var(--btnP);--btnT:var(--btnPT);--acc:#fff;--accT:#fff}
.${c}.sur-photo:not(.defile) :focus-visible{outline-color:#fff}
.${c} .nv-barre{position:relative;z-index:62;pointer-events:auto}
.${c} .menu-m{pointer-events:auto}
.menu-ouvert .${c}.${c}{z-index:90}
.${c} .nb{display:flex;align-items:center;justify-content:space-between;gap:20px}
.${c} .na{display:flex;align-items:center;gap:10px;flex:none}
.${c} .marque{flex:0 1 auto}
.${c} .liens{display:flex;align-items:center}
.${c} .nav-cta{min-height:48px;padding:0 20px;font-size:.95rem}
@media(max-width:900px){.${c} .liens{display:none}}
@media(max-width:520px){.${c} .nav-cta{width:48px;padding:0}.${c} .nav-cta .bt,.${c} .nav-cta .bf{${CACHE}}}
@media(prefers-reduced-motion:reduce){.${c} *,.${c} *::before,.${c} *::after{transition-duration:.01ms!important;transition-delay:0s!important}}
${o.partout ? '' : '@media(min-width:901px){.' + c + '.' + c + ' .menu-m{display:none}}'}
`;
}
// les liens du menu (balisage commun) : une petite flèche à droite
function cssFleche(c) { return `.${c} .menu-m nav a::after{content:"";flex:none;width:22px;height:22px;background:currentColor;-webkit-mask:${M_FLECHE} center/contain no-repeat;mask:${M_FLECHE} center/contain no-repeat;opacity:.45;transition:transform .45s var(--ease),opacity .3s}.${c} .menu-m nav a:hover::after,.${c} .menu-m nav a.actif::after{transform:translateX(4px);opacity:1}`; }
// le bloc d'infos pratiques injecté dans les menus
function cssInfos(c) {
  return `
.${c} .mm-infos{display:grid;gap:14px;font-size:1rem;line-height:1.45}
.${c} .mm-c{display:grid;gap:8px;align-content:start}
.${c} .mm-t{font-weight:var(--fxf);font-size:.95rem;opacity:.75}
.${c} .mm-c>p:not(.mm-t){color:var(--tx2)}
.${c} .mm-l{font-weight:var(--fxf);color:inherit}
.${c} .mm-etat{display:flex;align-items:center;gap:10px;font-weight:var(--fxf);color:var(--tx)}
.${c} .mm-etat i{width:9px;height:9px;flex:none;border-radius:50%;background:currentColor;opacity:.5}
.${c} .mm-etat.est-ouvert i{background:#22c55e;opacity:1}
.${c} .mm-etat.est-ferme i{background:#ef4444;opacity:1}
.${c} .horaires li{padding:4px 0;font-size:.97rem;flex-wrap:wrap;column-gap:12px}
.${c} .horaires span:last-child{white-space:nowrap;margin-left:auto}
`;
}

/* ══ 1. Verre dépoli ══ */
const navVerre = {
  id: 'nav.verre', rubrique: 'nav', nom: 'Verre dépoli', quand: 'toujours possible : barre en verre dépoli qui se resserre au défilement, progression de lecture, se range quand on descend et revient quand on remonte, panneau de verre qui descend sur téléphone',
  ambiances: ['calme', 'premium', 'franc'], surfaces: ['fond'], js: ['tete', 'menu', 'progression'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto, t = telDe(spec, h), a = h.actionPrincipale(spec);
    const rond = t && a && a.type !== 'tel' ? '<a class="nv-rond" href="' + h.esc(t.href) + '" aria-label="Appeler le ' + h.esc(t.texte) + '">' + h.icone('tel') + '</a>' : '';
    return '<header class="' + h.classes('nav.verre', bloc, sur ? 'sur-photo' : '') + '" data-tete="cache"><div class="nv-barre"><div class="w nb">' + ctx.marque + (navLiens(ctx) || '<span></span>') + '<div class="na">' + rond + cta(spec, ctx) + ctx.burger + '</div></div><span class="nv-prog" data-progression aria-hidden="true"></span></div>' + ctx.menuMobile + '</header>';
  },
  script: function () { return jsBarre('r-nav-verre', { voile: true, actif: true }); },
  css: function () {
    const c = 'r-nav-verre';
    return cssBase(c) + cssFleche(c) + `
.${c} .nv-barre{transition:transform .6s var(--ease)}
.${c}.range .nv-barre{transform:translateY(-106%)}
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:color-mix(in srgb,var(--fond) 88%,transparent);-webkit-backdrop-filter:saturate(1.7) blur(18px);backdrop-filter:saturate(1.7) blur(18px);border-bottom:1px solid transparent;transition:background-color .45s,border-color .45s,box-shadow .45s,opacity .45s}
.${c} .nv-barre::after{content:"";position:absolute;inset:0 0 -34px;z-index:-2;background:linear-gradient(180deg,rgb(0 0 0 / .46),rgb(0 0 0 / 0));opacity:0;pointer-events:none;transition:opacity .45s}
.${c}.defile .nv-barre::before{background:color-mix(in srgb,var(--fond) 70%,transparent);border-color:color-mix(in srgb,var(--encre) 10%,transparent);box-shadow:0 16px 36px -26px rgb(0 0 0 / .55)}
.${c}.sur-photo:not(.defile) .nv-barre::before{opacity:0}
.${c}.sur-photo:not(.defile) .nv-barre::after{opacity:1}
.${c} .nb{min-height:84px;transition:min-height .45s var(--ease)}
@media(min-width:1141px){.${c} .nb{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}}
.${c} .nb>span:empty{flex:1}
.${c} .nb>.marque{justify-self:start;max-width:100%}
.${c} .nb>.na{justify-self:end}
.${c}.defile .nb{min-height:66px}
.${c} .liens{gap:2px;padding:4px;border-radius:999px;transition:background-color .45s}
.${c}.defile .liens{background:color-mix(in srgb,var(--encre) 5%,transparent)}
.${c} .l{position:relative;display:inline-flex;align-items:center;min-height:44px;padding:0 17px;border-radius:999px;text-decoration:none;font-weight:var(--fxf);font-size:.98rem;white-space:nowrap;transition:background-color .3s,color .3s}
.${c} .l:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
.${c} .l::after{content:"";position:absolute;left:50%;bottom:5px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--acc);transform:scale(0);transition:transform .45s var(--ease)}
.${c} .l.actif{color:var(--accT)}
.${c} .l.actif::after{transform:scale(1)}
.${c} .nv-rond{width:48px;height:48px;flex:none;display:grid;place-items:center;border-radius:999px;color:inherit;border:1.5px solid color-mix(in srgb,currentColor 26%,transparent);transition:border-color .3s,transform .5s var(--ease),background-color .3s}
.${c} .nv-rond:hover{border-color:currentColor;transform:rotate(-12deg);background:color-mix(in srgb,currentColor 8%,transparent)}
.${c} .nv-prog{position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--accent);transform:scaleX(0);transform-origin:0 50%;opacity:0;transition:opacity .4s}
.${c}.defile .nv-prog{opacity:1}
.${c} .burger{border-radius:999px;background:color-mix(in srgb,currentColor 10%,transparent)}
.${c} .burger span{left:14px;right:14px;transition:transform .5s var(--ease),opacity .3s,top .5s var(--ease),left .45s var(--ease)}
.${c} .burger span:nth-child(2){left:21px}.${c} .burger span:nth-child(3){left:17px}
.${c} .burger:hover span,.${c} .burger[aria-expanded=true] span{left:14px}
.${c} .burger[aria-expanded=true]{color:var(--encre)}
.${c} .menu-m{inset:0;display:grid;grid-template-columns:minmax(0,1fr);justify-content:stretch;grid-template-rows:auto auto minmax(0,1fr);align-content:start;gap:0;padding:0;overflow-y:auto;overscroll-behavior:contain;background:rgb(0 0 0 / 0);color:var(--encre);--tx:var(--encre);--tx2:var(--doux);--btn:var(--accent);--btnT:var(--surA);clip-path:none;transition:background-color .5s,visibility 0s linear .65s}
.${c} .menu-m.ouvert{clip-path:none;background:rgb(0 0 0 / .42);transition:background-color .5s}
.${c} .menu-m::before{content:"";grid-area:1/1/3/2;background:color-mix(in srgb,var(--fond) 86%,transparent);-webkit-backdrop-filter:saturate(1.7) blur(26px);backdrop-filter:saturate(1.7) blur(26px);border-radius:0 0 28px 28px;box-shadow:0 40px 70px -40px rgb(0 0 0 / .6);transform:translateY(-101%);transition:transform .65s var(--ease)}
.${c} .menu-m.ouvert::before{transform:none}
.${c} .menu-m>nav,.${c} .menu-m>.menu-act{position:relative;z-index:1}
.${c} .menu-m nav{grid-area:1/1/2/2;gap:0;padding:90px var(--g) 4px}
.${c} .menu-m nav a{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 2px;border-bottom:1px solid var(--ligne);font-size:clamp(1.45rem,6.4vw,2.05rem);transform:translateY(-16px)}
.${c} .menu-m.ouvert nav a{opacity:1;transform:none;transition-delay:calc(.2s + var(--i) * 55ms)}
.${c} .menu-m nav a.actif{color:var(--accentT)}
.${c} .menu-m .menu-act{grid-area:2/1/3/2;padding:22px var(--g) 30px;transform:translateY(-12px);transition:opacity .5s,transform .6s var(--ease)}
.${c} .menu-m.ouvert .menu-act{transform:none;transition-delay:.42s}
.${c} .menu-m .b2{color:var(--encre)}
.menu-ouvert .${c}.${c}{--tx:var(--encre);color:var(--encre);--btn:var(--accent);--btnT:var(--surA)}
.menu-ouvert .${c}.${c} .nv-barre::before,.menu-ouvert .${c}.${c} .nv-barre::after{opacity:0}
.menu-ouvert .${c}.${c} .na .nav-cta,.menu-ouvert .${c}.${c} .na .nv-rond,.menu-ouvert .${c}.${c} .nv-prog{opacity:0;pointer-events:none}
@media(min-width:901px) and (max-width:1140px){.${c} .l{padding:0 11px}.${c} .nv-rond{display:none}}
@media(max-width:900px){.${c} .nb{display:flex;min-height:70px}.${c} .nb>span:empty{display:none}.${c}.defile .nb{min-height:62px}}
@media(max-width:520px){.${c} .nv-rond{display:none}}
`; }
};

/* ══ 2. Pilule flottante ══ */
const navPilule = {
  id: 'nav.pilule', rubrique: 'nav', nom: 'Pilule flottante', quand: 'sites doux et modernes (soins, conseil, mer, jardin, tables) : une barre en pilule qui flotte, détachée du bord, qui se resserre au défilement ; sur téléphone le menu s\'ouvre en carte',
  familles: ['comptoir', 'ecrin', 'cabinet', 'horizon', 'verdure'], ambiances: ['calme', 'chaleureux', 'premium'], surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto;
    return '<header class="' + h.classes('nav.pilule', bloc, sur ? 'sur-photo' : '') + '" data-tete="fixe"><div class="nv-barre pil">' + ctx.marque + navLiens(ctx) + '<div class="na">' + cta(spec, ctx) + ctx.burger + '</div></div>' + ctx.menuMobile + '</header>';
  },
  script: function () { return jsBarre('r-nav-pilule', { voile: true, actif: true }); },
  css: function () {
    const c = 'r-nav-pilule';
    return cssBase(c) + `
.${c}{padding-top:14px}
.${c} .pil{isolation:isolate;width:min(1140px,100% - 2*var(--g));margin-inline:auto;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:68px;padding:8px 8px 8px 10px;border-radius:999px;transition:width .7s var(--ease),min-height .5s var(--ease);animation:k-nav-pilule-entree 1.1s var(--ease) .1s both}
.${c} .pil::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:color-mix(in srgb,var(--fond) 84%,transparent);-webkit-backdrop-filter:saturate(1.5) blur(16px);backdrop-filter:saturate(1.5) blur(16px);border:1px solid color-mix(in srgb,var(--encre) 11%,transparent);box-shadow:inset 0 1px 0 rgb(255 255 255 / .35),0 18px 44px -24px rgb(0 0 0 / .45);transition:background-color .5s,border-color .5s,box-shadow .5s}
.${c}.sur-photo:not(.defile) .pil::before{background:rgb(0 0 0 / .26);border-color:rgb(255 255 255 / .24);box-shadow:inset 0 1px 0 rgb(255 255 255 / .18),0 18px 44px -24px rgb(0 0 0 / .6)}
.${c}.defile .pil{width:min(1010px,100% - 2*var(--g));min-height:60px}
.${c}.defile .pil::before{box-shadow:inset 0 1px 0 rgb(255 255 255 / .35),0 24px 54px -26px rgb(0 0 0 / .55)}
.${c} .marque{padding-left:4px}
.${c} .mono{border-radius:999px;width:46px;height:46px}
.${c} .marque .nm{font-size:1.16rem}
.${c} .marque img{height:40px}
.${c}.sur-photo:not(.defile) .marque img{height:46px;padding:4px 10px;border-radius:999px}
.${c} .liens{gap:2px}
.${c} .l{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;text-decoration:none;font-weight:var(--fxf);font-size:.96rem;white-space:nowrap;transition:background-color .35s,color .35s}
.${c} .l:hover{background:color-mix(in srgb,currentColor 10%,transparent)}
.${c} .l.actif{background:var(--encre);color:var(--fond)}
.${c}.sur-photo:not(.defile) .l.actif{background:#fff;color:#111}
.${c} .nav-cta{border-radius:999px;min-height:50px}
.${c} .burger{width:50px;height:50px;border-radius:999px;background:var(--encre);color:var(--fond)}
.${c}.sur-photo:not(.defile) .burger{background:#fff;color:#111}
.${c} .burger span{left:16px;right:16px}
.${c} .burger span:nth-child(1){top:20px}.${c} .burger span:nth-child(2){opacity:0}.${c} .burger span:nth-child(3){top:28px}
.${c} .burger[aria-expanded=true],.${c}.sur-photo .burger[aria-expanded=true]{background:var(--encre);color:var(--fond)}
.${c} .burger[aria-expanded=true] span:nth-child(1),.${c} .burger[aria-expanded=true] span:nth-child(3){top:24px}
.${c} .menu-m{inset:0;display:grid;grid-template-columns:minmax(0,1fr);justify-content:stretch;grid-template-rows:auto auto minmax(0,1fr);align-content:start;gap:0;padding:94px 10px 10px;overflow-y:auto;overscroll-behavior:contain;background:rgb(0 0 0 / 0);color:var(--encre);--tx:var(--encre);--tx2:var(--doux);--btn:var(--accent);--btnT:var(--surA);clip-path:none;transition:background-color .45s,visibility 0s linear .55s}
.${c} .menu-m.ouvert{clip-path:none;background:color-mix(in srgb,var(--encre) 34%,transparent);transition:background-color .45s}
.${c} .menu-m::before{content:"";grid-area:1/1/3/2;border-radius:30px;background:var(--fond);border:1px solid var(--ligne);box-shadow:0 34px 80px -34px rgb(0 0 0 / .65);transform-origin:94% -30px;transform:translateY(-14px) scale(.82);opacity:0;transition:transform .6s var(--ease),opacity .3s}
.${c} .menu-m.ouvert::before{transform:none;opacity:1}
.${c} .menu-m>nav,.${c} .menu-m>.menu-act{position:relative;z-index:1}
.${c} .menu-m nav{grid-area:1/1/2/2;gap:2px;padding:16px 12px 4px}
.${c} .menu-m nav a{padding:12px 16px;border-radius:20px;font-size:clamp(1.5rem,6.6vw,2.1rem);transform:translateY(12px) scale(.97);transition:opacity .45s,transform .6s var(--ease),background-color .3s}
.${c} .menu-m.ouvert nav a{opacity:1;transform:none;transition-delay:calc(.16s + var(--i) * 60ms),calc(.16s + var(--i) * 60ms),0s}
.${c} .menu-m nav a:hover,.${c} .menu-m nav a.actif{background:var(--surface)}
.${c} .menu-m .menu-act{grid-area:2/1/3/2;padding:10px 18px 20px;transform:translateY(10px);transition:opacity .45s,transform .6s var(--ease)}
.${c} .menu-m.ouvert .menu-act{transform:none;transition-delay:.38s}
.${c} .menu-m .b2{color:var(--encre)}
.menu-ouvert .${c}.${c} .pil .nav-cta{opacity:0;pointer-events:none}
@keyframes k-nav-pilule-entree{from{transform:translateY(-140%) scale(.94);opacity:0}}
@media(min-width:901px) and (max-width:1140px){.${c} .l{padding:0 11px}}
@media(max-width:900px){.${c}{padding-top:10px}.${c} .pil{width:calc(100% - 20px);min-height:62px;padding:6px 6px 6px 8px}.${c}.defile .pil{width:calc(100% - 20px);min-height:58px}.${c} .mono{width:40px;height:40px}}
@media(prefers-reduced-motion:reduce){.${c} .pil{animation:none}}
`; }
};

/* ══ 3. Nom au centre ══ */
const navCentre = {
  id: 'nav.centre', rubrique: 'nav', nom: 'Nom au centre', quand: 'tables, soins, hébergements, boutiques : le nom au centre comme une enseigne, les liens de part et d\'autre ; sur téléphone un menu plein écran qui s\'ouvre par le milieu, avec l\'état ouvert ou fermé',
  familles: ['comptoir', 'ecrin', 'horizon', 'boutique'], ambiances: ['chaleureux', 'premium', 'calme'], surfaces: ['fond'], js: ['tete', 'menu', 'ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto, l = liens(ctx), t = telDe(spec, h);
    const moitie = Math.ceil(l.length / 2);
    const info = t ? '<a class="nc-info" href="' + h.esc(t.href) + '">' + h.icone('tel') + '<span>' + h.esc(t.texte) + '</span></a>' : (spec.commune ? '<p class="nc-info">' + h.icone('pin') + '<span>' + h.esc(spec.commune) + '</span></p>' : '<span></span>');
    const g = '<div class="nc-g">' + info + (moitie ? '<div class="nc-l">' + l.slice(0, moitie).join('') + '</div>' : '') + '</div>';
    const dr = '<div class="nc-d">' + (l.length > moitie ? '<div class="nc-l">' + l.slice(moitie).join('') + '</div>' : '<span></span>') + cta(spec, ctx) + '</div>';
    const pied = (etat(spec, h, 'mm-etat') || spec.commune) ? '<div class="mm-bas">' + etat(spec, h, 'mm-etat') + (spec.commune ? '<p>' + h.esc(spec.commune) + ', Martinique</p>' : '') + '</div>' : '';
    return '<header class="' + h.classes('nav.centre', bloc, sur ? 'sur-photo' : '') + '" data-tete="cache"><div class="nv-barre"><nav class="w nb" aria-label="Navigation">' + g + ctx.marque + dr + ctx.burger + '</nav></div>' + menuAvec(ctx, '', pied) + '</header>';
  },
  script: function () { return jsBarre('r-nav-centre', { actif: true }); },
  css: function () {
    const c = 'r-nav-centre';
    return cssBase(c) + cssInfos(c) + `
.${c} .nv-barre{transition:transform .6s var(--ease)}
.${c}.range .nv-barre{transform:translateY(-106%)}
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--fond);box-shadow:0 1px 0 var(--ligne);transition:opacity .45s,box-shadow .45s}
.${c}.defile .nv-barre::before{box-shadow:0 1px 0 var(--ligne),0 20px 40px -32px rgb(0 0 0 / .5)}
.${c} .nv-barre::after{content:"";position:absolute;inset:0 0 -46px;z-index:-2;background:linear-gradient(180deg,rgb(0 0 0 / .5),rgb(0 0 0 / 0));opacity:0;pointer-events:none;transition:opacity .45s}
.${c}.sur-photo:not(.defile) .nv-barre::before{opacity:0}
.${c}.sur-photo:not(.defile) .nv-barre::after{opacity:1}
.${c} .nb{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:clamp(18px,3vw,56px);min-height:100px;transition:min-height .5s var(--ease)}
.${c}.defile .nb{min-height:74px}
.${c}.sur-photo:not(.defile) .nb{box-shadow:0 1px 0 rgb(255 255 255 / .26)}
.${c} .nc-g,.${c} .nc-d{display:flex;align-items:center;justify-content:space-between;gap:clamp(16px,2.4vw,40px);min-width:0}
.${c} .nc-l{display:flex;gap:clamp(16px,2.2vw,34px)}
.${c} .l{position:relative;padding:10px 0;text-decoration:none;font-weight:var(--fxf);font-size:.94rem;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
.${c} .l::after{content:"";position:absolute;left:0;right:0;bottom:3px;height:1.5px;background:currentColor;transform:scaleX(0);transition:transform .55s var(--ease)}
.${c} .l:hover::after,.${c} .l.actif::after{transform:scaleX(1)}
.${c} .nc-info{display:inline-flex;align-items:center;gap:9px;font-size:.96rem;font-weight:var(--fxf);text-decoration:none;white-space:nowrap;color:inherit}
.${c} .nc-info .ic{width:17px;height:17px;opacity:.75}
.${c} a.nc-info:hover span{text-decoration:underline;text-underline-offset:.25em}
.${c} .marque{justify-self:center;flex-direction:column;gap:6px;text-align:center}
.${c} .mono{width:34px;height:34px;border-radius:999px;transition:width .45s var(--ease),height .45s var(--ease),opacity .3s,margin .45s var(--ease)}
.${c} .mono .ic{width:19px;height:19px}
.${c}.defile .mono{width:0;height:0;opacity:0;margin-bottom:-6px}
.${c} .marque .nm{font-size:clamp(1.3rem,1.9vw,1.75rem);transition:font-size .5s var(--ease)}
.${c}.defile .marque .nm{font-size:1.3rem}
.${c} .marque img{height:54px}
.${c}.defile .marque img{height:44px}
.${c} .nav-cta{min-height:46px;padding:0 20px}
.${c} .burger{background:transparent;border:1px solid color-mix(in srgb,currentColor 32%,transparent);border-radius:999px}
.${c} .burger span{height:1.5px;left:15px;right:15px}
.${c} .burger span:nth-child(1){top:19px}.${c} .burger span:nth-child(2){opacity:0}.${c} .burger span:nth-child(3){top:27px}
.${c} .burger[aria-expanded=true]{border-color:color-mix(in srgb,var(--surC) 40%,transparent)}
.${c} .burger[aria-expanded=true] span:nth-child(1),.${c} .burger[aria-expanded=true] span:nth-child(3){top:23px}
.${c} .menu-m{align-items:center;justify-content:center;text-align:center;gap:34px;padding:100px var(--g) 56px;overflow-y:auto;clip-path:inset(50% 0 50% 0);transition:clip-path .75s var(--ease2),visibility 0s linear .75s}
.${c} .menu-m.ouvert{clip-path:inset(0 0 0 0);transition:clip-path .75s var(--ease2)}
.${c} .menu-m::before{content:"";position:absolute;inset:14px;border:1px solid color-mix(in srgb,var(--surC) 24%,transparent);border-radius:calc(var(--r) * 1.4);pointer-events:none;opacity:0;transform:scale(.96);transition:opacity .5s,transform .9s var(--ease)}
.${c} .menu-m.ouvert::before{opacity:1;transform:none;transition-delay:.35s}
.${c} .menu-m nav{justify-items:center;gap:2px}
.${c} .menu-m nav a{font-size:clamp(2.2rem,10vw,3.5rem);opacity:1;transform:translateY(100%);clip-path:inset(0 0 100% 0);transition:transform .85s var(--ease),clip-path .85s var(--ease),color .3s}
.${c} .menu-m.ouvert nav a{transform:none;clip-path:inset(-10% 0 -10% 0);transition-delay:calc(.3s + var(--i) * 80ms),calc(.3s + var(--i) * 80ms),0s}
.${c} .menu-m nav a.actif{color:var(--accC)}
.${c} .menu-m .actions{justify-content:center}
.${c} .menu-m .mm-bas{display:grid;gap:6px;justify-items:center;font-size:.98rem;color:var(--tx2);opacity:0;transition:opacity .5s}
.${c} .menu-m.ouvert .mm-bas{opacity:1;transition-delay:.7s}
.${c} .menu-m .mm-etat{color:var(--surC)}
.menu-ouvert .${c}.${c}{--tx:var(--surC);color:var(--surC)}
.menu-ouvert .${c}.${c} .nv-barre::before,.menu-ouvert .${c}.${c} .nv-barre::after{opacity:0}
.menu-ouvert .${c}.${c} .nb{box-shadow:none}
.menu-ouvert .${c}.${c} .nc-d .nav-cta{opacity:0;pointer-events:none}
@media(min-width:901px) and (max-width:1180px){.${c} .nc-info span{${CACHE}}.${c} .nc-l{gap:16px}.${c} .l{letter-spacing:.03em}}
@media(max-width:900px){.${c} .nb{grid-template-columns:48px minmax(0,1fr) 48px;min-height:74px;gap:10px}.${c} .nc-g,.${c} .nc-l,.${c} .nc-d>span{display:none}.${c} .nc-d{justify-content:flex-end}.${c} .burger{order:-1}.${c} .mono{display:none}.${c} .marque .nm{font-size:1.2rem;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.${c} .nav-cta{width:48px;padding:0}.${c} .nav-cta .bt,.${c} .nav-cta .bf{${CACHE}}}
`; }
};

/* ══ 4. Barre d'infos ══ */
const navInfos = {
  id: 'nav.infos', rubrique: 'nav', nom: 'Barre d\'infos au-dessus', quand: 'artisans, garages, commerces : une bande d\'infos au-dessus de la barre (ouvert maintenant, commune, téléphone, WhatsApp) qui s\'efface au défilement ; sur téléphone un menu en tuiles avec les horaires et l\'adresse',
  familles: ['atelier', 'garage', 'verdure', 'boutique', 'comptoir'], ambiances: ['franc', 'chaleureux'], surfaces: ['fond'], js: ['tete', 'menu', 'ouvert'],
  besoin: function (spec, ctx) { const h = ctx.h, c = spec.contact || {}; return !!(h.horairesDe(c).length || h.telHref(c.tel) || waDe(spec, h)) && !!(spec.commune || h.horairesDe(c).length); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto, t = telDe(spec, h), w = waDe(spec, h), c = spec.contact || {}, a = h.actionPrincipale(spec);
    const fin = c.email && !(a && a.type === 'mail') ? '<a class="ni-mail" href="mailto:' + h.esc(c.email) + '">' + h.icone('mail') + '<span>' + h.esc(c.email) + '</span></a>' : (w && !(a && a.type === 'whatsapp') ? '<a class="ni-wa" href="' + h.esc(w) + '" target="_blank" rel="noopener">' + h.icone('whatsapp') + '<span>WhatsApp</span></a>' : '');
    const bande = [etat(spec, h, 'ni-etat'), spec.commune ? '<p class="ni-lieu">' + h.icone('pin') + '<span>' + h.esc(spec.commune) + ', Martinique</span></p>' : '', '<span class="ni-sep"></span>', t ? '<a class="ni-tel" href="' + h.esc(t.href) + '">' + h.icone('tel') + '<span>' + h.esc(t.texte) + '</span></a>' : '', fin].join('');
    return '<header class="' + h.classes('nav.infos', bloc, sur ? 'sur-photo' : '') + '" data-tete="fixe"><div class="ni-bande"><div class="w nib">' + bande + '</div></div><div class="nv-barre"><div class="w nb">' + ctx.marque + navLiens(ctx) + '<div class="na">' + cta(spec, ctx) + ctx.burger + '</div></div></div>' + menuAvec(ctx, '', infosMenu(spec, ctx)) + '</header>';
  },
  script: function () { return jsBarre('r-nav-infos', { actif: true }); },
  css: function (ctx) {
    const c = 'r-nav-infos', ic = function (n) { return masque(n); };
    const metier = ic((ctx && ctx.iconeMetier) || 'outils');
    return cssBase(c) + cssInfos(c) + `
.${c}{--bh:44px;top:calc(-1 * var(--bh))}
.${c}.sur-photo{top:0}
.${c} .ni-bande{position:relative;z-index:63;pointer-events:auto;height:var(--bh);background:var(--champ);color:var(--surC);font-size:.95rem;line-height:1.2;transition:margin-top .55s var(--ease),opacity .4s}
.${c}.sur-photo .ni-bande{background:rgb(0 0 0 / .34);color:#fff;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 -1px 0 rgb(255 255 255 / .16)}
.${c}.sur-photo.defile .ni-bande{margin-top:calc(-1 * var(--bh));opacity:0}
.${c} .nib{height:100%;display:flex;align-items:center;gap:26px;min-width:0}
.${c} .ni-sep{flex:1}
.${c} .ni-bande p,.${c} .ni-bande a{display:inline-flex;align-items:center;gap:9px;min-width:0;white-space:nowrap;text-decoration:none;color:inherit}
.${c} .ni-bande span{overflow:hidden;text-overflow:ellipsis}
.${c} .ni-bande a{min-height:44px;font-weight:var(--fxf)}
.${c} .ni-bande a:hover span{text-decoration:underline;text-underline-offset:.22em}
.${c} .ni-bande .ic{width:17px;height:17px;color:var(--accC)}
.${c}.sur-photo .ni-bande .ic{color:#fff}
.${c} .ni-etat i{width:9px;height:9px;flex:none;border-radius:50%;background:currentColor;opacity:.55}
.${c} .ni-etat.est-ouvert i{background:#22c55e;opacity:1;animation:k-nav-infos-pouls 2.2s infinite}
.${c} .ni-etat.est-ferme i{background:#ef4444;opacity:1}
@keyframes k-nav-infos-pouls{0%{box-shadow:0 0 0 0 rgb(34 197 94 / .6)}80%,100%{box-shadow:0 0 0 8px rgb(34 197 94 / 0)}}
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--fond);box-shadow:0 1px 0 var(--ligne);transition:opacity .45s,box-shadow .45s}
.${c}.defile .nv-barre::before{box-shadow:0 1px 0 var(--ligne),0 14px 34px -22px rgb(0 0 0 / .45)}
.${c}.sur-photo:not(.defile) .nv-barre::before{opacity:0}
.${c} .nb{min-height:82px;transition:min-height .45s var(--ease)}
.${c}.defile .nb{min-height:70px}
.${c} .liens{gap:clamp(20px,2.4vw,36px)}
.${c} .l{position:relative;padding:12px 0;text-decoration:none;font-weight:var(--fxf);white-space:nowrap}
.${c} .l::after{content:"";position:absolute;left:0;right:0;bottom:4px;height:3px;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform .45s var(--ease)}
.${c} .l:hover::after,.${c} .l.actif::after{transform:scaleX(1)}
.${c} .burger{background:var(--accent);color:var(--surA)}
.${c} .burger[aria-expanded=true]{background:var(--encre);color:var(--fond)}
.${c} .menu-m{display:block;overflow-y:auto;overscroll-behavior:contain;padding:144px var(--g) 46px;background:var(--fond);color:var(--encre);--tx:var(--encre);--tx2:var(--doux);--btn:var(--accent);--btnT:var(--surA);--bord:var(--ligne);clip-path:inset(0 0 100% 0);transition:clip-path .65s var(--ease2),visibility 0s linear .65s}
.${c}.defile .menu-m{padding-top:96px}
.${c} .menu-m.ouvert{clip-path:inset(0 0 0 0);transition:clip-path .65s var(--ease2)}
.${c} .menu-m nav{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.${c} .menu-m nav a{display:flex;flex-direction:column;justify-content:space-between;gap:20px;min-height:112px;padding:16px 16px 14px;border-radius:var(--r);background:var(--surface);font-family:var(--fx);font-weight:var(--fxf);font-size:1.12rem;line-height:1.2;letter-spacing:0;text-transform:none;font-stretch:normal;font-variation-settings:normal;transform:translateY(18px) scale(.96);transition:opacity .45s,transform .6s var(--ease),background-color .3s}
.${c} .menu-m.ouvert nav a{opacity:1;transform:none;transition-delay:calc(.22s + var(--i) * 60ms),calc(.22s + var(--i) * 60ms),0s}
.${c} .menu-m nav a{--mq:${M_FLECHE}}
.${c} .menu-m nav a::before{content:"";width:30px;height:30px;background:var(--accentT);-webkit-mask:var(--mq) center/contain no-repeat;mask:var(--mq) center/contain no-repeat}
.${c} .menu-m nav a:hover,.${c} .menu-m nav a.actif{background:var(--teinte)}
.${c} .menu-m nav a[href$="#services"],.${c} .menu-m nav a[href$="/services/"]{--mq:${metier}}
.${c} .menu-m nav a[href$="#apropos"],.${c} .menu-m nav a[href$="/a-propos/"]{--mq:${ic('equipe')}}
.${c} .menu-m nav a[href$="#images"]{--mq:${ic('appareil')}}
.${c} .menu-m nav a[href$="#contact"],.${c} .menu-m nav a[href$="/contact/"]{--mq:${ic('bulle')}}
.${c} .menu-m nav a[href$="#infos"]{--mq:${ic('horloge')}}
.${c} .menu-m nav a[href$="#faq"]{--mq:${ic('loupe')}}
.${c} .menu-m .menu-act{margin-top:16px;opacity:0;transition:opacity .5s}
.${c} .menu-m.ouvert .menu-act{opacity:1;transition-delay:.45s}
.${c} .menu-m .b2{color:var(--encre)}
.${c} .menu-m .mm-infos{margin-top:26px;padding-top:22px;border-top:1px solid var(--ligne);grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:22px;opacity:0;transition:opacity .5s}
.${c} .menu-m.ouvert .mm-infos{opacity:1;transition-delay:.55s}
.${c} .ni-bande .ni-tel,.${c} .ni-bande .ni-wa,.${c} .ni-bande .ni-mail{flex:none}
.menu-ouvert .${c}.${c} .na .nav-cta{opacity:0;pointer-events:none}
.menu-ouvert .${c}.${c}{--tx:var(--encre);color:var(--encre)}
.menu-ouvert .${c}.${c} .nv-barre::before{opacity:1}
.menu-ouvert .${c}.${c} .ni-bande{background:var(--champ);color:var(--surC)}
.menu-ouvert .${c}.${c} .ni-bande .ic{color:var(--accC)}
@media(min-width:901px) and (max-width:1100px){.${c} .liens{gap:18px}.${c} .ni-bande .ni-lieu{display:none}}
@media(max-width:900px){.${c}{--bh:42px}.${c} .nb{min-height:70px}.${c}.defile .nb{min-height:64px}.${c} .ni-bande .ni-lieu,.${c} .ni-bande .ni-mail{display:none}.${c} .nib{gap:16px}}
@media(max-width:560px){.${c} .ni-bande .ni-wa{display:none}.${c} .ni-bande .ni-tel{width:44px;justify-content:center;border-radius:999px;background:color-mix(in srgb,currentColor 12%,transparent);height:32px;min-height:32px;margin-block:6px}.${c} .ni-bande .ni-tel span{${CACHE}}.${c} .ni-bande .ni-tel .ic{width:16px;height:16px}}
@media(prefers-reduced-motion:reduce){.${c} .ni-etat.est-ouvert i{animation:none}}
`; }
};

/* ══ 5. Ligne minimale, menu plein écran ══ */
const navLigne = {
  id: 'nav.ligne', rubrique: 'nav', nom: 'Ligne minimale, menu plein écran', quand: 'sites épurés (soins, conseil, hébergement, boutiques) : le nom, le téléphone et un bouton Menu même sur ordinateur, qui ouvre un plein écran aux liens géants avec tous les contacts',
  familles: ['ecrin', 'cabinet', 'horizon', 'boutique', 'comptoir'], ambiances: ['premium', 'calme'], surfaces: ['fond'], js: ['tete', 'menu', 'ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto, t = telDe(spec, h), c = spec.contact || {};
    const ntel = t ? '<a class="nl-tel" href="' + h.esc(t.href) + '">' + h.icone('tel') + '<span>' + h.esc(t.texte) + '</span></a>' : '';
    const contacts = [];
    if (t) contacts.push('<a class="nl-gros" href="' + h.esc(t.href) + '">' + h.esc(t.texte) + '</a>');
    if (c.email) contacts.push('<a class="nl-mail" href="mailto:' + h.esc(c.email) + '">' + h.esc(c.email) + '</a>');
    const col = '<div class="nl-col">' + (contacts.length ? '<div class="nl-cts' + (c.email ? '' : ' seul-tel') + '"><p class="mm-t">Nous joindre</p>' + contacts.join('') + '</div>' : '') + infosMenu(spec, ctx, { liste: false }) + '</div>';
    return '<header class="' + h.classes('nav.ligne', bloc, (sur ? 'sur-photo' : '') + (t ? ' nl-a-tel' : '')) + '" data-tete="fixe"><div class="nv-barre"><div class="w nb">' + ctx.marque + '<div class="na">' + ntel + ctx.burger + '</div></div></div>' + menuAvec(ctx, '', col) + '</header>';
  },
  script: function () { return jsBarre('r-nav-ligne', { actif: true }); },
  css: function () {
    const c = 'r-nav-ligne';
    return cssBase(c, { partout: true }) + cssInfos(c) + `
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--fond);transition:opacity .45s,box-shadow .45s}
.${c}.defile .nv-barre::before{box-shadow:0 1px 0 var(--ligne)}
.${c} .nv-barre::after{content:"";position:absolute;inset:0 0 -40px;z-index:-2;background:linear-gradient(180deg,rgb(0 0 0 / .42),rgb(0 0 0 / 0));opacity:0;pointer-events:none;transition:opacity .45s}
.${c}.sur-photo:not(.defile) .nv-barre::before{opacity:0}
.${c}.sur-photo:not(.defile) .nv-barre::after{opacity:1}
.${c} .nb{min-height:80px;transition:min-height .45s var(--ease)}
.${c}.defile .nb{min-height:66px}
.${c} .na{gap:clamp(14px,2.2vw,30px)}
.${c} .nl-tel{display:inline-flex;align-items:center;gap:10px;min-height:44px;text-decoration:none;font-weight:var(--fxf);white-space:nowrap;color:inherit}
.${c} .nl-tel .ic{width:18px;height:18px}
.${c} .nl-tel:hover span{text-decoration:underline;text-underline-offset:.25em}
.${c} .burger{display:inline-flex;align-items:center;width:auto;height:48px;padding:0 54px 0 20px;border-radius:999px;background:transparent;border:1.5px solid color-mix(in srgb,currentColor 34%,transparent);font-family:var(--fx);font-weight:var(--fxf);font-size:.98rem;line-height:1;transition:border-color .3s,background-color .3s}
.${c} .burger::before{content:"Menu"}
.${c} .burger[aria-expanded=true]::before{content:"Fermer"}
.${c} .burger:hover{border-color:currentColor;background:color-mix(in srgb,currentColor 7%,transparent)}
.${c} .burger span{left:auto;right:20px;width:22px}
.${c} .burger span:nth-child(1){top:19px}.${c} .burger span:nth-child(2){opacity:0}.${c} .burger span:nth-child(3){top:27px;width:14px;transition:transform .5s var(--ease),top .5s var(--ease),width .45s var(--ease)}
.${c} .burger:hover span:nth-child(3){width:22px}
.${c} .burger[aria-expanded=true] span:nth-child(1),.${c} .burger[aria-expanded=true] span:nth-child(3){top:23px;width:22px}
.${c} .burger[aria-expanded=true]{border-color:color-mix(in srgb,var(--surC) 40%,transparent)}
.${c} .menu-m{display:grid;justify-content:stretch;grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);grid-template-rows:minmax(0,1fr) auto;align-items:center;gap:28px clamp(30px,6vw,110px);padding:120px max(var(--g),calc((100% - var(--w)) / 2)) 56px;overflow-y:auto;overscroll-behavior:contain;background:radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,var(--surC) 9%,transparent),transparent 60%),var(--champ);clip-path:inset(0 0 100% 0);transition:clip-path .85s var(--ease2),visibility 0s linear .85s}
.${c} .menu-m.ouvert{clip-path:inset(0 0 0 0);transition:clip-path .85s var(--ease2)}
.${c} .menu-m nav{grid-column:1;grid-row:1/3;align-self:center;gap:0}
.${c} .menu-m nav a{position:relative;justify-self:start;font-size:clamp(2.5rem,7.2vw,6.2rem);line-height:1.04;padding:.04em 0;opacity:1;transform:translateY(100%);clip-path:inset(0 0 100% 0);transition:transform .95s var(--ease),clip-path .95s var(--ease),opacity .35s,padding-left .5s var(--ease)}
.${c} .menu-m.ouvert nav a{transform:none;clip-path:inset(-10% -20% -10% 0);transition-delay:calc(.35s + var(--i) * 75ms),calc(.35s + var(--i) * 75ms),0s,0s}
.${c} .menu-m nav:hover a{opacity:.32}
.${c} .menu-m nav a:hover,.${c} .menu-m nav a:focus-visible{opacity:1;padding-left:.35em}
.${c} .menu-m nav a::before{content:"";position:absolute;left:0;top:50%;width:.22em;height:.22em;margin-top:-.11em;border-radius:50%;background:var(--accC);transform:scale(0);transition:transform .45s var(--ease)}
.${c} .menu-m nav a:hover::before,.${c} .menu-m nav a.actif::before{transform:scale(1)}
.${c} .menu-m nav a.actif{padding-left:.35em}
.${c} .menu-m .menu-act{grid-column:2;grid-row:2;align-self:end;opacity:0;transform:translateY(16px);transition:opacity .5s,transform .7s var(--ease)}
.${c} .menu-m .menu-act .actions{flex-direction:column;align-items:stretch}
.${c} .menu-m .nl-col{grid-column:2;grid-row:1;align-self:end;display:grid;gap:26px;opacity:0;transform:translateY(16px);transition:opacity .5s,transform .7s var(--ease)}
.${c} .menu-m.ouvert .menu-act,.${c} .menu-m.ouvert .nl-col{opacity:1;transform:none;transition-delay:.6s}
.${c} .nl-cts{display:grid;gap:8px}
.${c} .nl-gros{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.8rem,2.8vw,2.6rem);line-height:1.05;text-decoration:none;white-space:nowrap;color:var(--surC)}
.${c} .nl-gros:hover{color:var(--accC)}
.${c} .nl-mail{color:var(--tx2);text-decoration:none;overflow-wrap:anywhere}
.${c} .nl-mail:hover{text-decoration:underline}
.${c} .menu-m .mm-infos{gap:18px}
.${c} .menu-m .mm-etat{color:var(--surC)}
.menu-ouvert .${c}.${c}{--tx:var(--surC);color:var(--surC)}
.menu-ouvert .${c}.${c} .nv-barre::before,.menu-ouvert .${c}.${c} .nv-barre::after{opacity:0}
.menu-ouvert .${c}.${c} .nl-tel{opacity:0;pointer-events:none}
@media(min-width:901px){.${c} .menu-m .nl-gros~.nl-mail{margin-top:4px}.${c}.nl-a-tel .menu-m .b2{display:none}}
@media(max-width:900px){.${c} .nb{min-height:70px}.${c}.defile .nb{min-height:62px}.${c} .nl-tel span{${CACHE}}.${c} .nl-tel{width:48px;height:48px;justify-content:center;border-radius:999px;background:color-mix(in srgb,currentColor 9%,transparent)}
.${c} .menu-m{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;align-content:start;align-items:start;gap:30px;padding:104px var(--g) 48px}
.${c} .menu-m nav{grid-row:1}.${c} .menu-m .menu-act{grid-column:1;grid-row:2;align-self:start}.${c} .menu-m .nl-col{grid-column:1;grid-row:3;align-self:start}.${c} .nl-gros,.${c} .nl-cts.seul-tel{display:none}}
@media(max-width:520px){.${c} .burger{padding:0 46px 0 16px}.${c} .burger span{right:16px}.${c} .na{gap:8px}}
`; }
};

/* ══ 6. Barre d'encre ══ */
const navEncre = {
  id: 'nav.encre', rubrique: 'nav', nom: 'Barre d\'encre', quand: 'artisans, garages, boutiques au ton franc : une barre sombre pleine liserée de couleur vive, liens qui roulent au survol, menu qui s\'ouvre en double vague depuis le bouton',
  familles: ['atelier', 'garage', 'boutique', 'cabinet'], ambiances: ['franc'], surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto;
    return '<header class="' + h.classes('nav.encre', bloc, sur ? 'sur-photo' : '') + '" data-tete="cache"><div class="nv-barre"><div class="w nb">' + ctx.marque + navLiens(ctx, { roule: true }) + '<div class="na">' + cta(spec, ctx) + ctx.burger + '</div></div></div>' + ctx.menuMobile + '</header>';
  },
  script: function () { return jsBarre('r-nav-encre', { actif: true }); },
  css: function () {
    const c = 'r-nav-encre', centre = 'calc(100% - var(--g) - 24px) 35px';
    return cssBase(c) + `
.${c}{--tx:var(--surC);--tx2:var(--champDoux);--acc:var(--accC);--accT:var(--accC);--btn:var(--btnC);--btnT:var(--btnCT);--bord:color-mix(in srgb,var(--surC) 16%,transparent);color:var(--surC)}
.${c}.sur-photo:not(.defile){--btn:var(--btnP);--btnT:var(--btnPT)}
.${c} .nv-barre{transition:transform .55s var(--ease)}
.${c}.range .nv-barre{transform:translateY(-106%)}
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--champ);box-shadow:inset 0 3px 0 var(--vif);transition:opacity .45s,box-shadow .45s}
.${c}.defile .nv-barre::before{box-shadow:inset 0 3px 0 var(--vif),0 18px 40px -24px rgb(0 0 0 / .6)}
.${c} .nv-barre::after{content:"";position:absolute;inset:0 0 -40px;z-index:-2;background:linear-gradient(180deg,rgb(0 0 0 / .55),rgb(0 0 0 / 0));opacity:0;pointer-events:none;transition:opacity .45s}
.${c}.sur-photo:not(.defile) .nv-barre::before{opacity:0}
.${c}.sur-photo:not(.defile) .nv-barre::after{opacity:1}
.${c}.sur-photo:not(.defile) .nv-barre{box-shadow:inset 0 3px 0 var(--vif)}
.${c} .nb{min-height:82px;transition:min-height .45s var(--ease)}
.${c}.defile .nb{min-height:66px}
.${c} .mono{background:var(--vif);color:var(--surV);border-radius:var(--rb)}
.${c} .marque img{background:#fff;padding:6px 10px;border-radius:10px;mix-blend-mode:normal}
.${c} .liens{gap:clamp(22px,2.6vw,40px)}
.${c} .l{position:relative;display:inline-flex;padding:12px 0;text-decoration:none;font-weight:var(--fxf);white-space:nowrap}
.${c} .l .o{display:block;overflow:hidden;line-height:1.4;height:1.4em}
.${c} .l .rl{display:block;position:relative;transition:transform .55s var(--ease)}
.${c} .l .rl::after{content:attr(data-t);position:absolute;left:0;top:100%;color:var(--vif)}
.${c}.sur-photo:not(.defile) .l .rl::after{color:#fff}
.${c} .l:hover .rl,.${c} .l:focus-visible .rl{transform:translateY(-100%)}
.${c} .l::before{content:"";position:absolute;left:0;right:0;bottom:6px;height:3px;background:var(--vif);transform:scaleX(0);transform-origin:left;transition:transform .5s var(--ease)}
.${c} .l.actif::before{transform:scaleX(1)}
.${c} .burger{background:color-mix(in srgb,var(--surC) 12%,transparent)}
.${c} .burger span{left:13px;right:13px;height:3px}
.${c} .burger span:nth-child(2){right:20px;transition:transform .5s var(--ease),opacity .3s,right .45s var(--ease)}
.${c} .burger:hover span:nth-child(2){right:13px}
.${c} .burger[aria-expanded=true]{background:var(--vif);color:var(--surV)}
.${c} .menu-m{background:transparent;isolation:isolate;clip-path:none;justify-content:center;gap:42px;padding:110px var(--g) 50px;overflow-y:auto;transition:visibility 0s linear 1s}
.${c} .menu-m.ouvert{clip-path:none;transition:visibility 0s}
.${c} .menu-m::before,.${c} .menu-m::after{content:"";position:absolute;inset:0;clip-path:circle(0% at ${centre});transition:clip-path .8s var(--ease2)}
.${c} .menu-m::before{z-index:-2;background:var(--vif);transition-delay:.12s}
.${c} .menu-m::after{z-index:-1;background:radial-gradient(90% 60% at 100% 0%,color-mix(in srgb,var(--vif) 22%,transparent),transparent 60%),var(--champ);transition-delay:0s}
.${c} .menu-m.ouvert::before{clip-path:circle(150% at ${centre});transition-delay:0s}
.${c} .menu-m.ouvert::after{clip-path:circle(150% at ${centre});transition-delay:.16s}
.${c} .menu-m nav{gap:4px}
.${c} .menu-m nav a{position:relative;justify-self:start;padding-left:0;transform:translateX(-34px);transition:opacity .45s,transform .7s var(--ease),padding-left .45s var(--ease),color .3s}
.${c} .menu-m.ouvert nav a{opacity:1;transform:none;transition-delay:calc(.42s + var(--i) * 70ms),calc(.42s + var(--i) * 70ms),0s,0s}
.${c} .menu-m nav a::before{content:"";position:absolute;left:0;top:50%;width:.5em;height:.12em;margin-top:-.06em;background:var(--vif);transform:scaleX(0);transform-origin:left;transition:transform .45s var(--ease)}
.${c} .menu-m nav a:hover,.${c} .menu-m nav a.actif{padding-left:.75em;color:var(--vif)}
.${c} .menu-m nav a:hover::before,.${c} .menu-m nav a.actif::before{transform:scaleX(1)}
.${c} .menu-m.ouvert .menu-act{transition-delay:.7s}
.menu-ouvert .${c}.${c} .nv-barre::before,.menu-ouvert .${c}.${c} .nv-barre::after{opacity:0}
.menu-ouvert .${c}.${c} .nv-barre{box-shadow:none}
.menu-ouvert .${c}.${c} .na .nav-cta{opacity:0;pointer-events:none}
@media(min-width:901px) and (max-width:1100px){.${c} .liens{gap:20px}}
@media(max-width:900px){.${c} .nb{min-height:70px}.${c}.defile .nb{min-height:62px}}
`; }
};

/* ══ 7. Indicateur glissant ══ */
const navSoulignee = {
  id: 'nav.soulignee', rubrique: 'nav', nom: 'Indicateur glissant', quand: 'toujours possible : un trait glisse sous le lien survolé et suit la rubrique en cours de lecture ; sur téléphone le menu monte du bas comme un tiroir',
  familles: ['cabinet', 'atelier', 'verdure', 'boutique', 'horizon', 'garage'], ambiances: ['calme', 'franc'], surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto;
    return '<header class="' + h.classes('nav.soulignee', bloc, sur ? 'sur-photo' : '') + '" data-tete="fixe"><div class="nv-barre"><div class="w nb">' + ctx.marque + navLiens(ctx, { fin: '<span class="ind" aria-hidden="true"></span>' }) + '<div class="na">' + cta(spec, ctx) + ctx.burger + '</div></div></div>' + ctx.menuMobile + '</header>';
  },
  script: function () {
    return jsBarre('r-nav-soulignee', { voile: true, actif: true, plus: `var ln=t.querySelector('.liens'),ind=ln&&ln.querySelector('.ind');
if(ln&&ind){var vers=function(a){if(!a){ln.classList.remove('ind-on');return}var r=a.getBoundingClientRect(),r0=ln.getBoundingClientRect();var neuf=!ln.classList.contains('ind-on');if(neuf)ind.style.transition='none';ln.style.setProperty('--ix',(r.left-r0.left+10).toFixed(1)+'px');ln.style.setProperty('--iw',Math.max(0,r.width-20).toFixed(1)+'px');if(neuf){void ind.offsetWidth;ind.style.transition=''}ln.classList.add('ind-on')};
var sous=false;var actif=function(){return ln.querySelector('.l.actif')};
[].slice.call(ln.querySelectorAll('.l')).forEach(function(a){a.addEventListener('mouseenter',function(){sous=true;vers(a)});a.addEventListener('focus',function(){vers(a)});a.addEventListener('blur',function(){if(!sous)vers(actif())})});
ln.addEventListener('mouseleave',function(){sous=false;vers(actif())});
t.addEventListener('nv-actif',function(){if(!sous)vers(actif())});
w.addEventListener('resize',function(){if(!sous)vers(actif())})}` });
  },
  css: function () {
    const c = 'r-nav-soulignee';
    return cssBase(c) + cssFleche(c) + `
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--fond);box-shadow:0 1px 0 var(--ligne);transition:opacity .45s,box-shadow .45s}
.${c}.defile .nv-barre::before{box-shadow:0 1px 0 var(--ligne),0 16px 36px -26px rgb(0 0 0 / .5)}
.${c} .nv-barre::after{content:"";position:absolute;inset:0 0 -40px;z-index:-2;background:linear-gradient(180deg,rgb(0 0 0 / .44),rgb(0 0 0 / 0));opacity:0;pointer-events:none;transition:opacity .45s}
.${c}.sur-photo:not(.defile) .nv-barre::before{opacity:0}
.${c}.sur-photo:not(.defile) .nv-barre::after{opacity:1}
.${c}.sur-photo:not(.defile) .nb{box-shadow:0 1px 0 rgb(255 255 255 / .22)}
.${c} .nb{align-items:stretch;min-height:84px;transition:min-height .45s var(--ease)}
.${c}.defile .nb{min-height:68px}
.${c} .nb>.marque,.${c} .nb>.na{align-self:center}
.${c} .liens{position:relative;align-items:stretch;gap:4px}
.${c} .l{display:flex;align-items:center;padding:0 16px;text-decoration:none;font-weight:var(--fxf);font-size:.98rem;white-space:nowrap;transition:color .3s}
.${c} .l:hover,.${c} .l.actif{color:var(--accT)}
.${c} .ind{position:absolute;left:0;bottom:0;width:var(--iw,0px);height:3px;border-radius:3px 3px 0 0;background:var(--acc);transform:translateX(var(--ix,0px));opacity:0;pointer-events:none;transition:transform .55s var(--ease),width .55s var(--ease),opacity .3s}
.${c} .liens.ind-on .ind{opacity:1}
.${c} .burger span:nth-child(1){left:20px}.${c} .burger span:nth-child(2){left:16px}.${c} .burger span:nth-child(3){left:24px}
.${c} .burger span{transition:transform .5s var(--ease),opacity .3s,top .5s var(--ease),left .45s var(--ease)}
.${c} .burger:hover span,.${c} .burger[aria-expanded=true] span{left:14px}
.${c} .menu-m{inset:0;display:grid;grid-template-columns:minmax(0,1fr);justify-content:stretch;grid-template-rows:minmax(0,1fr) auto auto;align-content:end;gap:0;padding:0;overflow-y:auto;overscroll-behavior:contain;background:rgb(0 0 0 / 0);color:var(--encre);--tx:var(--encre);--tx2:var(--doux);--btn:var(--accent);--btnT:var(--surA);clip-path:none;transition:background-color .45s,visibility 0s linear .6s}
.${c} .menu-m.ouvert{clip-path:none;background:rgb(0 0 0 / .45);transition:background-color .45s}
.${c} .menu-m::before{content:"";grid-area:2/1/4/2;background:var(--fond);border-radius:30px 30px 0 0;box-shadow:0 -24px 60px -24px rgb(0 0 0 / .45)}
.${c} .menu-m::after{content:"";grid-area:2/1/3/2;justify-self:center;align-self:start;width:46px;height:5px;margin-top:12px;border-radius:5px;background:var(--ligne)}
.${c} .menu-m::before,.${c} .menu-m::after,.${c} .menu-m nav,.${c} .menu-m .menu-act{transform:translateY(100vh);transition:transform .6s var(--ease),opacity .45s}
.${c} .menu-m.ouvert::before,.${c} .menu-m.ouvert::after,.${c} .menu-m.ouvert nav,.${c} .menu-m.ouvert .menu-act{transform:none}
.${c} .menu-m>nav,.${c} .menu-m>.menu-act{position:relative;z-index:1}
.${c} .menu-m nav{grid-area:2/1/3/2;gap:0;padding:38px var(--g) 6px}
.${c} .menu-m nav a{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 4px;border-bottom:1px solid var(--ligne);font-size:clamp(1.4rem,6vw,1.9rem);transform:translateY(14px);transition:opacity .45s,transform .6s var(--ease),box-shadow .35s,padding-left .35s var(--ease)}
.${c} .menu-m.ouvert nav a{opacity:1;transform:none;transition-delay:calc(.25s + var(--i) * 55ms),calc(.25s + var(--i) * 55ms),0s,0s}
.${c} .menu-m nav a.actif{box-shadow:inset 3px 0 0 var(--accent);padding-left:16px;color:var(--accentT)}
.${c} .menu-m .menu-act{grid-area:3/1/4/2;padding:18px var(--g) calc(26px + env(safe-area-inset-bottom))}
.${c} .menu-m.ouvert .menu-act{transition-delay:0s,.4s}
.${c} .menu-m .b2{color:var(--encre)}
.${c} .burger[aria-expanded=true]{color:var(--encre)}
.menu-ouvert .${c}.${c}.sur-photo{--tx:var(--encre);color:var(--encre)}
.menu-ouvert .${c}.${c} .nv-barre::before{opacity:1}
.menu-ouvert .${c}.${c} .nv-barre::after{opacity:0}
.menu-ouvert .${c}.${c} .na .nav-cta{opacity:0;pointer-events:none}
@media(min-width:901px) and (max-width:1100px){.${c} .l{padding:0 11px}}
@media(max-width:900px){.${c} .nb{min-height:70px;align-items:center}.${c}.defile .nb{min-height:62px}}
`; }
};

/* ══ 8. Transparente sur photo ══ */
const navTransparente = {
  id: 'nav.transparente', rubrique: 'nav', nom: 'Transparente sur photo', quand: 'haut de page photo (mer, table, soins, jardin) : texte blanc sur la photo, la barre devient pleine au défilement avec un dégradé discret ; menu plein écran en verre fumé posé sur la page',
  familles: ['horizon', 'comptoir', 'ecrin', 'verdure', 'atelier'], ambiances: ['premium', 'chaleureux', 'calme'], surfaces: ['fond'], js: ['tete', 'menu'],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto;
    return '<header class="' + h.classes('nav.transparente', bloc, sur ? 'sur-photo' : 'sans-photo') + '" data-tete="cache"><div class="nv-barre"><div class="w nb">' + ctx.marque + navLiens(ctx) + '<div class="na">' + cta(spec, ctx) + ctx.burger + '</div></div></div>' + ctx.menuMobile + '</header>';
  },
  script: function () { return jsBarre('r-nav-transparente', { actif: true }); },
  css: function () {
    const c = 'r-nav-transparente';
    return cssBase(c) + `
.${c} .nv-barre{transition:transform .6s var(--ease)}
.${c}.range .nv-barre{transform:translateY(-106%)}
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,var(--fond),color-mix(in srgb,var(--fond) 92%,var(--accent)));box-shadow:0 1px 0 color-mix(in srgb,var(--accent) 22%,transparent),0 20px 44px -30px rgb(0 0 0 / .5);opacity:0;transition:opacity .5s}
.${c} .nv-barre::after{content:"";position:absolute;inset:0 0 -70px;z-index:-2;background:linear-gradient(180deg,rgb(0 0 0 / .55) 0%,rgb(0 0 0 / .22) 55%,rgb(0 0 0 / 0) 100%);pointer-events:none;transition:opacity .5s}
.${c}.defile .nv-barre::before{opacity:1}
.${c}.defile .nv-barre::after,.${c}.sans-photo .nv-barre::after{opacity:0}
.${c}.sans-photo .nv-barre::before{opacity:1;box-shadow:none}
.${c}.sans-photo.defile .nv-barre::before{box-shadow:0 1px 0 color-mix(in srgb,var(--accent) 22%,transparent),0 20px 44px -30px rgb(0 0 0 / .5)}
.${c}.sur-photo:not(.defile) .marque,.${c}.sur-photo:not(.defile) .l{text-shadow:0 1px 18px rgb(0 0 0 / .35)}
.${c} .nb{min-height:92px;transition:min-height .5s var(--ease)}
.${c}.defile .nb{min-height:70px}
.${c} .liens{gap:clamp(22px,2.8vw,44px)}
.${c} .l{position:relative;padding:12px 0;text-decoration:none;font-weight:var(--fxf);font-size:1rem;white-space:nowrap;transition:opacity .35s}
.${c} .liens:hover .l{opacity:.6}
.${c} .liens .l:hover{opacity:1}
.${c} .l::after{content:"";position:absolute;left:0;right:0;bottom:5px;height:1.5px;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .5s var(--ease)}
.${c} .l:hover::after,.${c} .l.actif::after{transform:scaleX(1);transform-origin:left}
.${c}.sur-photo:not(.defile) .nav-cta.b1{background:#fff;color:#111}
.${c} .burger{background:transparent;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,currentColor 45%,transparent);border-radius:999px}
.${c} .burger span{left:15px;right:15px}
.${c} .burger span:nth-child(1){top:19px}.${c} .burger span:nth-child(2){opacity:0}.${c} .burger span:nth-child(3){top:27px}
.${c} .burger[aria-expanded=true]{color:#fff}
.${c} .burger[aria-expanded=true] span:nth-child(1),.${c} .burger[aria-expanded=true] span:nth-child(3){top:23px}
.${c} .menu-m{background:linear-gradient(180deg,rgb(var(--voile) / .62) 0%,rgb(var(--voile) / .5) 38%,rgb(var(--voile) / .9) 100%);-webkit-backdrop-filter:blur(22px) saturate(1.35);backdrop-filter:blur(22px) saturate(1.35);color:#fff;--tx:#fff;--tx2:rgb(255 255 255 / .86);--btn:var(--btnP);--btnT:var(--btnPT);justify-content:flex-end;gap:38px;padding:110px var(--g) 64px;overflow:hidden auto;isolation:isolate;clip-path:inset(0 0 0 100%);transition:clip-path .8s var(--ease2),visibility 0s linear .8s}
.${c} .menu-m.ouvert{clip-path:inset(0 0 0 0);transition:clip-path .8s var(--ease2)}
.${c} .menu-m::after{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(90% 55% at 100% 0%,color-mix(in srgb,var(--vif) 22%,transparent),transparent 65%);opacity:0;transition:opacity 1.2s var(--ease)}
.${c} .menu-m.ouvert::after{opacity:1;transition-delay:.3s}
.${c} .menu-m nav{gap:2px}
.${c} .menu-m nav a{font-size:clamp(2.3rem,10.5vw,3.6rem);transform:translateX(44px);transition:opacity .5s,transform .8s var(--ease)}
.${c} .menu-m.ouvert nav a{opacity:1;transform:none;transition-delay:calc(.32s + var(--i) * 75ms)}
.${c} .menu-m nav a.actif{text-decoration:underline;text-decoration-thickness:.06em;text-underline-offset:.16em}
.${c} .menu-m .b2{color:#fff;border-color:rgb(255 255 255 / .7)}
.${c} .menu-m.ouvert .menu-act{transition-delay:.62s}
.menu-ouvert .${c}.${c}{--tx:#fff;color:#fff}
.menu-ouvert .${c}.${c} .nv-barre::before,.menu-ouvert .${c}.${c} .nv-barre::after{opacity:0}
.menu-ouvert .${c}.${c} .na .nav-cta{opacity:0;pointer-events:none}
@media(min-width:901px) and (max-width:1100px){.${c} .liens{gap:20px}}
@media(max-width:900px){.${c} .nb{min-height:74px}.${c}.defile .nb{min-height:64px}}
`; }
};

/* ══ 9. Tiroir latéral ══ */
const navTiroir = {
  id: 'nav.tiroir', rubrique: 'nav', nom: 'État ouvert et tiroir latéral', quand: 'artisans, dépannage, conseil, commerces : l\'état ouvert ou fermé (ou le téléphone) dans la barre ; sur téléphone un tiroir latéral avec les liens, les horaires, l\'adresse et les boutons',
  familles: ['atelier', 'garage', 'verdure', 'cabinet', 'boutique'], ambiances: ['franc', 'calme'], surfaces: ['fond'], js: ['tete', 'menu', 'ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sur = bloc && bloc.surPhoto, t = telDe(spec, h);
    const st = etat(spec, h, 'tr-etat') || (t ? '<a class="tr-etat tr-tel" href="' + h.esc(t.href) + '">' + h.icone('tel') + '<span>' + h.esc(t.texte) + '</span></a>' : '');
    const nom = '<p class="tr-nom" aria-hidden="true">' + h.esc(h.net(spec.nom)) + '</p>';
    return '<header class="' + h.classes('nav.tiroir', bloc, sur ? 'sur-photo' : '') + '" data-tete="fixe"><div class="nv-barre"><div class="w nb">' + ctx.marque + navLiens(ctx) + '<div class="na">' + st + cta(spec, ctx) + ctx.burger + '</div></div></div>' + menuAvec(ctx, nom, infosMenu(spec, ctx)) + '</header>';
  },
  script: function () { return jsBarre('r-nav-tiroir', { voile: true, actif: true }); },
  css: function () {
    const c = 'r-nav-tiroir', L = 'min(420px,88vw)';
    return cssBase(c) + cssFleche(c) + cssInfos(c) + `
.${c} .nv-barre::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--fond);box-shadow:0 1px 0 var(--ligne);transition:opacity .45s,box-shadow .45s}
.${c}.defile .nv-barre::before{box-shadow:0 1px 0 var(--ligne),0 14px 34px -22px rgb(0 0 0 / .45)}
.${c} .nv-barre::after{content:"";position:absolute;inset:0 0 -40px;z-index:-2;background:linear-gradient(180deg,rgb(0 0 0 / .45),rgb(0 0 0 / 0));opacity:0;pointer-events:none;transition:opacity .45s}
.${c}.sur-photo:not(.defile) .nv-barre::before{opacity:0}
.${c}.sur-photo:not(.defile) .nv-barre::after{opacity:1}
.${c} .nb{min-height:82px;transition:min-height .45s var(--ease)}
.${c}.defile .nb{min-height:68px}
.${c} .liens{gap:clamp(18px,2.2vw,32px)}
.${c} .l{position:relative;padding:12px 0;text-decoration:none;font-weight:var(--fxf);white-space:nowrap}
.${c} .l::after{content:"";position:absolute;left:50%;right:50%;bottom:6px;height:2px;background:var(--acc);transition:left .45s var(--ease),right .45s var(--ease)}
.${c} .l:hover::after,.${c} .l.actif::after{left:0;right:0}
.${c} .na{gap:12px}
.${c} .tr-etat{display:inline-flex;align-items:center;gap:9px;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--bord);background:color-mix(in srgb,var(--tx) 4%,transparent);font-size:.95rem;font-weight:var(--fxf);white-space:nowrap;text-decoration:none;color:inherit}
.${c}.sur-photo:not(.defile) .tr-etat{border-color:rgb(255 255 255 / .35);background:rgb(0 0 0 / .18)}
.${c} .tr-etat i{width:9px;height:9px;flex:none;border-radius:50%;background:currentColor;opacity:.5}
.${c} .tr-etat.est-ouvert i{background:#22c55e;opacity:1;animation:k-nav-tiroir-pouls 2.2s infinite}
.${c} .tr-etat.est-ferme i{background:#ef4444;opacity:1}
.${c} .tr-tel .ic{width:17px;height:17px}
@keyframes k-nav-tiroir-pouls{0%{box-shadow:0 0 0 0 rgb(34 197 94 / .6)}80%,100%{box-shadow:0 0 0 8px rgb(34 197 94 / 0)}}
.${c} .burger{background:transparent;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,currentColor 30%,transparent)}
.${c} .burger[aria-expanded=true]{color:var(--encre);box-shadow:inset 0 0 0 1.5px var(--ligne)}
.${c} .menu-m{inset:0;display:flex;flex-direction:column;justify-content:flex-start;gap:26px;padding:96px var(--g) 36px calc(100% - ${L} + var(--g));overflow-y:auto;overscroll-behavior:contain;background:rgb(0 0 0 / 0);color:var(--encre);--tx:var(--encre);--tx2:var(--doux);--btn:var(--accent);--btnT:var(--surA);--bord:var(--ligne);clip-path:none;transition:background-color .5s,visibility 0s linear .6s}
.${c} .menu-m.ouvert{clip-path:none;background:rgb(0 0 0 / .46);transition:background-color .5s}
.${c} .menu-m::before{content:"";position:fixed;top:0;bottom:0;right:0;width:${L};background:var(--fond);box-shadow:-30px 0 60px -30px rgb(0 0 0 / .5);transform:translateX(102%);transition:transform .6s var(--ease)}
.${c} .menu-m.ouvert::before{transform:none}
.${c} .menu-m>*{position:relative;transform:translateX(60px);opacity:0;transition:opacity .45s,transform .6s var(--ease)}
.${c} .menu-m.ouvert>*{transform:none;opacity:1}
.${c} .menu-m.ouvert>nav{transition-delay:.12s}.${c} .menu-m.ouvert>.menu-act{transition-delay:.2s}.${c} .menu-m.ouvert>.mm-infos{transition-delay:.28s}
.${c} .menu-m nav{gap:0}
.${c} .menu-m nav a{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid var(--ligne);font-size:clamp(1.35rem,5.6vw,1.8rem);opacity:1;transform:none}
.${c} .menu-m nav a.actif{color:var(--accentT)}
.${c} .menu-m .actions .btn{flex:1 1 100%}
.${c} .menu-m .b2{color:var(--encre)}
.${c} .menu-m .mm-infos{padding-top:20px;border-top:1px solid var(--ligne);gap:20px}
.menu-ouvert .${c}.${c} .na .nav-cta,.menu-ouvert .${c}.${c} .na .tr-etat{opacity:0;pointer-events:none}
.menu-ouvert .${c}.${c} .nv-barre::before,.menu-ouvert .${c}.${c} .nv-barre::after{opacity:0}
.menu-ouvert .${c}.${c} .nv-barre .marque{opacity:0;pointer-events:none}
.${c} .menu-m>.tr-nom{position:absolute;top:0;left:calc(100% - ${L} + var(--g));right:calc(var(--g) + 60px);height:70px;display:flex;align-items:center;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.25rem;line-height:1.1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.${c} .menu-m.ouvert>.tr-nom{transition-delay:.1s}
@media(min-width:901px) and (max-width:1180px){.${c} .tr-etat{display:none}}
@media(max-width:900px){.${c} .nb{min-height:70px}.${c}.defile .nb{min-height:62px}.${c} .tr-etat{display:none}}
@media(prefers-reduced-motion:reduce){.${c} .tr-etat.est-ouvert i{animation:none}}
`; }
};

module.exports = [navVerre, navPilule, navCentre, navInfos, navLigne, navEncre, navSoulignee, navTransparente, navTiroir];
