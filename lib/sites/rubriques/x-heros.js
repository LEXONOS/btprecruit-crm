// Hauts de page des templates. Le premier écran dit qui, quoi, où, et donne le bouton ; il prouve (note Google, ouvert
// maintenant, commune) sans rien inventer. Douze dessins : photo plein écran, photo encadrée, deux colonnes, titre
// éditorial et panorama, arche, centré et grande photo qui grandit, collage, typographique (sans photo), bloc teinté,
// affiche centrée, fiche pratique, bandeau photo et carte qui chevauche. Fond clair, ou photo : jamais un aplat noir.
'use strict';
const K = require('./x-kit');

// le texte du haut de page : sur-titre, grand titre, phrase, boutons, faits sûrs
function texte(spec, ctx, o) {
  o = o || {};
  const h = ctx.h, tx = ctx.textes;
  const surT = o.sur !== undefined ? o.sur : (tx.sur || K.net(spec.nom));
  const sur = surT && K.net(surT) !== K.net(tx.h1) ? '<p class="x-sur"' + h.rv('monte', 0) + '>' + h.esc(K.net(surT)) + '</p>' : '';
  const phrase = tx.phrase ? '<p class="x-hph"' + h.rv('monte', 3) + '>' + h.esc(tx.phrase) + '</p>' : '';
  const act = '<div' + h.rv('monte', 4) + '>' + K.boutons(spec, ctx, o.boutons) + '</div>';
  return sur + K.h1(ctx, o.h1) + phrase + act + (o.faits === false ? '' : '<div' + h.rv('monte', 5) + '>' + faits(spec, ctx) + '</div>');
}
// trois faits sûrs au plus : la note Google, l'heure (ouvert maintenant), le lieu
function faits(spec, ctx, cls) {
  const h = ctx.h, out = [];
  const g = K.note(spec, ctx);
  if (g) out.push('<li>' + h.etoiles(g.note) + '<span><b>' + h.noteTexte(g) + '</b> · ' + g.avis + ' avis Google</span></li>');
  const hs = h.horairesDe(spec.contact), m = h.horairesMachine(hs);
  if (m) out.push('<li class="x-ouvert" data-horaires="' + h.esc(m) + '"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(h.resumeHoraires(hs) || 'Nos horaires') + '</span></li>');
  out.push('<li>' + h.icone('pin') + '<span>' + h.esc(h.lieuCourt(spec)) + '</span></li>');
  return '<ul class="x-faits' + (cls ? ' ' + cls : '') + '">' + out.slice(0, 3).join('') + '</ul>';
}
const avecPhoto = function (spec, ctx) { return !!ctx.alloc.hero; };
const JS = ['parallaxe', 'ouvert', 'progres'];

/* ── 1. photo plein écran, texte en bas à gauche ── */
const plein = {
  id: 'hero.x-plein', rubrique: 'hero', x: true, photo: 'oui', nom: 'Photo plein écran', quand: 'une belle photo large : plein écran, voile doux, texte en bas à gauche',
  surfaces: ['photo'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    return K.section(ctx, 'hero.x-plein', bloc, 'xh', null, 'Présentation') + '<div class="xp-img" data-px="0.1">' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'recul', tailles: '100vw' }) + '</div><div class="w xp-w"><div class="xp-t cq">' + texte(spec, ctx) + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-plein'; return `
.${c}{min-height:min(100svh,960px);display:grid;align-items:end;overflow:hidden}
.${c} .xp-img{position:absolute;inset:-7% 0;z-index:-2}
.${c} .xp-img .ph{height:100%;border-radius:0}
.${c}::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / .42) 0%,rgb(var(--voile) / 0) 26%,rgb(var(--voile) / .1) 52%,rgb(var(--voile) / .82) 100%),linear-gradient(90deg,rgb(var(--voile) / .5) 0%,rgb(var(--voile) / 0) 62%)}
.${c} .xp-w{padding-block:150px clamp(44px,6.5vw,92px)}
.${c} .xp-t{display:grid;gap:clamp(16px,2vw,24px);max-width:780px;--hmax:6.2rem}
.${c} .x-hph{max-width:46ch;color:rgb(255 255 255 / .9)}
.${c} .b2{color:#fff;border-color:rgb(255 255 255 / .55)}
.${c} .x-faits{color:rgb(255 255 255 / .88)}
@media(max-width:860px){.${c}{min-height:88svh}.${c}::before{background:linear-gradient(180deg,rgb(var(--voile) / .45) 0%,rgb(var(--voile) / .12) 32%,rgb(var(--voile) / .9) 100%)}}
`; }
};

/* ── 2. photo encadrée, texte posé dans le cadre ── */
const cadre = {
  id: 'hero.x-cadre', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Photo encadrée', quand: 'une belle photo : un grand cadre arrondi dans la page, le texte posé dedans, les faits en pastilles de verre',
  surfaces: ['fond', 'surface'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    return K.section(ctx, 'hero.x-cadre', bloc, 'xh', null, 'Présentation') + '<div class="xk"><div class="xk-img">' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'recul', tailles: '100vw' }) + '</div><div class="xk-t cq">' + texte(spec, ctx, { faits: false }) + '</div><div class="xk-f">' + faits(spec, ctx) + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-cadre'; return `
.${c}{padding:94px var(--g) 0}
.${c} .xk{position:relative;isolation:isolate;display:grid;align-items:end;min-height:min(calc(100svh - 112px),860px);border-radius:var(--x-rc,24px);overflow:hidden;color:#fff;--tx:#fff;--btn:var(--btnP);--btnT:var(--btnPT)}
.js .${c} .xk{animation:k-xk-ouvre 1.4s var(--ease2,cubic-bezier(.7,0,.2,1)) both}
@keyframes k-xk-ouvre{from{clip-path:inset(5% 4% round 48px)}to{clip-path:inset(0 round var(--x-rc,24px))}}
.${c} .xk-img{position:absolute;inset:0;z-index:-2}
.${c} .xk-img .ph{height:100%;border-radius:0}
.${c} .xk::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(200deg,rgb(var(--voile) / 0) 30%,rgb(var(--voile) / .78) 100%)}
.${c} .xk-t{display:grid;gap:clamp(16px,2vw,22px);max-width:760px;padding:clamp(28px,5vw,64px);--hmax:5.8rem}
.${c} .x-hph{max-width:44ch;color:rgb(255 255 255 / .9)}
.${c} .b2{color:#fff;border-color:rgb(255 255 255 / .55)}
.${c} .xk-f{position:absolute;top:clamp(16px,2.4vw,28px);right:clamp(16px,2.4vw,28px)}
.${c} .xk-f .x-faits{flex-direction:column;align-items:flex-end;gap:8px}
.${c} .xk-f .x-faits li{padding:9px 14px;border-radius:999px;background:rgb(255 255 255 / .16);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);border:1px solid rgb(255 255 255 / .22);color:#fff;font-size:.88rem}
@media(max-width:860px){.${c}{padding-top:84px}.${c} .xk{min-height:84svh}.${c} .xk-f{left:16px;right:auto}.${c} .xk-f .x-faits{align-items:flex-start}.${c} .xk-f .x-faits li:nth-child(n+2){display:none}}
@media(prefers-reduced-motion:reduce){.${c} .xk{animation:none}}
`; }
};

/* ── 3. deux colonnes : le texte, la photo en hauteur et sa pastille ── */
const split = {
  id: 'hero.x-split', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Deux colonnes', quand: 'texte à gauche, grande photo en hauteur à droite, une pastille posée sur la photo (note, ouvert, lieu)',
  surfaces: ['fond', 'surface'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = K.note(spec, ctx);
    const badge = g ? '<div class="xs-b"' + h.rv('monte', 6) + '>' + h.etoiles(g.note) + '<b>' + h.noteTexte(g) + '/5</b><span>' + g.avis + ' avis Google</span></div>' : (K.aHoraires(spec, ctx) ? '<div class="xs-b"' + h.rv('monte', 6) + '>' + K.ouvert(spec, ctx) + '</div>' : '<div class="xs-b"' + h.rv('monte', 6) + '>' + h.icone('pin') + '<b>' + h.esc(spec.commune || 'Martinique') + '</b></div>');
    return K.section(ctx, 'hero.x-split', bloc, 'xh', null, 'Présentation') + '<div class="w xs"><div class="xs-t cq">' + texte(spec, ctx) + '</div><div class="xs-v">' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'store', tailles: '(max-width:860px) 100vw, 46vw' }) + badge + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-split'; return `
.${c} .xs{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);align-items:center;gap:clamp(32px,6vw,96px);min-height:min(100svh,940px);padding-block:clamp(120px,13vw,160px) clamp(56px,7vw,96px)}
.${c} .xs-t{display:grid;gap:clamp(16px,2vw,24px);--hmax:5.8rem}
.${c} .xs-v{position:relative}
.${c} .xs-v .ph{aspect-ratio:4/5;max-height:76vh;width:100%;border-radius:var(--x-r,18px)}
.${c} .xs-b{position:absolute;left:clamp(-34px,-2.6vw,-16px);bottom:clamp(22px,4vw,48px);display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:var(--x-rc,16px);background:var(--carte);color:var(--encre);box-shadow:var(--ombreF);font-size:.94rem;line-height:1.2}
.${c} .xs-b b{font-size:1.1rem}
.${c} .xs-b .ic{color:var(--accentT)}
.${c} .xs-b .x-ouvert{margin:0}
@media(max-width:860px){.${c} .xs{grid-template-columns:1fr;min-height:0;padding-top:110px}.${c} .xs-v .ph{aspect-ratio:4/3;max-height:none}.${c} .xs-b{left:14px;bottom:14px}}
`; }
};

/* ── 4. titre éditorial sur toute la largeur, puis un panorama qui se resserre ── */
const titre = {
  id: 'hero.x-titre', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Titre éditorial et panorama', quand: 'le titre en très grand sur toute la largeur, la phrase et les boutons sur une ligne, puis une photo panoramique qui se resserre au défilement',
  surfaces: ['fond', 'surface'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, tx = ctx.textes;
    const surT = tx.sur || K.net(spec.nom);
    return K.section(ctx, 'hero.x-titre', bloc, 'xh', null, 'Présentation') + '<div class="w xt"><div class="xt-h cq">' + (surT && K.net(surT) !== K.net(tx.h1) ? '<p class="x-sur"' + h.rv('monte') + '>' + h.esc(K.net(surT)) + '</p>' : '') + K.h1(ctx) + '</div><div class="xt-r">' + (tx.phrase ? '<p class="x-hph"' + h.rv('monte', 3) + '>' + h.esc(tx.phrase) + '</p>' : '<span></span>') + '<div class="xt-a"' + h.rv('monte', 4) + '>' + K.boutons(spec, ctx) + faits(spec, ctx) + '</div></div></div><div class="xt-img" data-prog>' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'store', tailles: '100vw' }) + '</div></section>';
  },
  css: function () { const c = 'r-hero-x-titre'; return `
.${c}{padding-top:clamp(120px,13vw,170px)}
.${c} .xt-h{display:grid;gap:18px;--hmax:9.5rem}
.${c} .xt-h .h1{line-height:.95}
.${c} .xt-r{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:24px 60px;margin-top:clamp(28px,4vw,48px);padding-top:clamp(20px,2.4vw,28px);border-top:var(--x-trait,1px solid var(--ligne))}
.${c} .xt-a{display:grid;gap:16px;justify-items:end}
.${c} .x-hph{max-width:48ch;color:var(--doux)}
.${c} .xt-img{width:calc(100% - 2 * var(--g));max-width:1600px;margin:clamp(36px,5vw,64px) auto 0;aspect-ratio:21/9;border-radius:var(--x-r,18px);overflow:hidden;scale:min(1,calc(.9 + .24 * var(--p,.5)))}
.${c} .xt-img .ph{height:100%;border-radius:0}
.${c} .xt-img img{scale:calc(1.16 - .16 * var(--p,.5))}
@media(max-width:860px){.${c} .xt-r{grid-template-columns:1fr}.${c} .xt-a{justify-items:start}.${c} .xt-img{aspect-ratio:4/3;scale:none}}
`; }
};

/* ── 5. la photo dans une arche, un disque de couleur derrière ── */
const arche = {
  id: 'hero.x-arche', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Arche', quand: 'beauté, soins, table, jardin : la photo dans une arche, un disque teinté qui respire derrière, le texte à gauche',
  surfaces: ['fond', 'surface'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    return K.section(ctx, 'hero.x-arche', bloc, 'xh', null, 'Présentation') + '<div class="w xa"><div class="xa-t cq">' + texte(spec, ctx) + '</div><div class="xa-v"><span class="xa-d" aria-hidden="true"></span>' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'store', tailles: '(max-width:860px) 90vw, 40vw', cls: 'xa-ph' }) + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-arche'; return `
.${c} .xa{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:center;gap:clamp(32px,6vw,90px);min-height:min(100svh,920px);padding-block:clamp(120px,13vw,160px) clamp(56px,7vw,90px)}
.${c} .xa-t{display:grid;gap:clamp(16px,2vw,24px);--hmax:5.6rem}
.${c} .xa-v{position:relative;justify-self:center;width:min(470px,100%)}
.${c} .xa-ph{aspect-ratio:3/4;border-radius:999px 999px var(--x-r,22px) var(--x-r,22px)}
.${c} .xa-d{position:absolute;z-index:-1;width:72%;aspect-ratio:1;right:-14%;top:-8%;border-radius:50%;background:var(--teinte);animation:k-xa-respire 9s ease-in-out infinite alternate}
@keyframes k-xa-respire{from{transform:translate(0,0) scale(1)}to{transform:translate(-6%,5%) scale(1.07)}}
@media(max-width:860px){.${c} .xa{grid-template-columns:1fr;min-height:0;padding-top:110px}.${c} .xa-v{width:min(380px,86%)}}
@media(prefers-reduced-motion:reduce){.${c} .xa-d{animation:none}}
`; }
};

/* ── 6. centré, puis une grande photo qui grandit jusqu'aux bords ── */
const centre = {
  id: 'hero.x-centre', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Centré et grande photo', quand: 'le titre centré, les boutons dessous, puis une grande photo arrondie qui s\'ouvre au défilement',
  surfaces: ['fond', 'surface'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    return K.section(ctx, 'hero.x-centre', bloc, 'xh', null, 'Présentation') + '<div class="xce-halo" aria-hidden="true"></div><div class="w xce cq">' + texte(spec, ctx) + '</div><div class="xce-img" data-prog>' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'zoom', tailles: '100vw' }) + '</div></section>';
  },
  css: function () { const c = 'r-hero-x-centre'; return `
.${c}{padding-top:clamp(130px,14vw,180px);overflow:hidden}
.${c} .xce-halo{position:absolute;z-index:-1;left:50%;top:-30%;width:min(1100px,140vw);aspect-ratio:1;translate:-50% 0;border-radius:50%;background:radial-gradient(closest-side,var(--teinte),transparent);opacity:.9}
.${c} .xce{display:grid;justify-items:center;text-align:center;gap:clamp(16px,2vw,22px);max-width:980px;--hmax:6.4rem}
.${c} .x-hph{max-width:52ch;color:var(--doux)}
.${c} .actions,.${c} .x-faits{justify-content:center}
.${c} .xce-img{width:calc(100% - 2 * var(--g));max-width:1500px;margin:clamp(40px,5vw,72px) auto 0;aspect-ratio:16/7;border-radius:var(--x-r,22px);overflow:hidden;scale:min(1,calc(.86 + .32 * var(--p,.5)));transform-origin:50% 0}
.${c} .xce-img .ph{height:100%;border-radius:0}
@media(max-width:860px){.${c} .xce-img{aspect-ratio:4/3;scale:none}}
`; }
};

/* ── 7. collage de trois photos à des vitesses différentes ── */
const collage = {
  id: 'hero.x-collage', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Collage', quand: 'trois photos ou plus : le texte à gauche, trois photos en planche qui glissent à des vitesses différentes',
  surfaces: ['fond', 'surface'], js: JS,
  besoin: function (spec, ctx) { return !!ctx.alloc.hero && ctx.h.libres(2, { decor: true }).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const autres = ctx.h.photos(2, { decor: true });
    return K.section(ctx, 'hero.x-collage', bloc, 'xh', null, 'Présentation') + '<div class="w xco"><div class="xco-t cq">' + texte(spec, ctx) + '</div><div class="xco-v">' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'store', cls: 'xco-1', tailles: '(max-width:860px) 60vw, 28vw' }) + K.photo(ctx, autres[0], { r: 'store', i: 2, cls: 'xco-2', px: '0.08', tailles: '(max-width:860px) 40vw, 18vw' }) + K.photo(ctx, autres[1], { r: 'store', i: 3, cls: 'xco-3', px: '-0.06', tailles: '(max-width:860px) 40vw, 18vw' }) + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-collage'; return `
.${c} .xco{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:clamp(32px,5vw,80px);min-height:min(100svh,940px);padding-block:clamp(120px,13vw,160px) clamp(56px,7vw,96px)}
.${c} .xco-t{display:grid;gap:clamp(16px,2vw,24px);--hmax:5.4rem}
.${c} .xco-v{display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:auto auto;gap:clamp(12px,1.4vw,18px);align-items:start}
.${c} .xco-1{grid-row:1/span 2;aspect-ratio:3/4.4;border-radius:var(--x-r,16px)}
.${c} .xco-2{aspect-ratio:1;border-radius:var(--x-r,16px);margin-top:12%}
.${c} .xco-3{aspect-ratio:4/5;border-radius:var(--x-r,16px)}
@media(max-width:860px){.${c} .xco{grid-template-columns:1fr;min-height:0;padding-top:110px}.${c} .xco-2{margin-top:0}}
`; }
};

/* ── 8. typographique : sans photo, le titre en très grand sur des lumières douces ── */
const typo = {
  id: 'hero.x-typo', rubrique: 'hero', x: true, photo: 'non', sousNav: false, nom: 'Typographique', quand: 'sans photo, tous métiers : le titre en très grand, des lumières douces aux couleurs du site qui dérivent lentement, les services en pastilles',
  surfaces: ['fond', 'surface'], js: ['ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    const s = K.services(spec, ctx).slice(0, 5);
    const pastilles = s.length ? '<ul class="xty-s"' + h.rv('monte', 6) + '>' + s.map(function (x) { return '<li>' + h.icone(x.icone) + h.esc(x.titre) + '</li>'; }).join('') + '</ul>' : '';
    return K.section(ctx, 'hero.x-typo', bloc, 'xh', null, 'Présentation') + '<div class="xty-f" aria-hidden="true"><i></i><i></i><i></i></div><div class="w xty cq">' + texte(spec, ctx, { h1: { trois: true } }) + pastilles + '</div></section>';
  },
  css: function () { const c = 'r-hero-x-typo'; return `
.${c}{overflow:hidden;min-height:min(100svh,900px);display:grid;align-items:center}
.${c} .xty-f{position:absolute;inset:0;z-index:-1;pointer-events:none}
.${c} .xty-f i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55}
.${c} .xty-f i:nth-child(1){width:46vw;aspect-ratio:1;right:-8vw;top:-12vw;background:var(--accent);opacity:.22;animation:k-xty-a 22s ease-in-out infinite alternate}
.${c} .xty-f i:nth-child(2){width:38vw;aspect-ratio:1;left:-10vw;bottom:-14vw;background:var(--teinte);opacity:.9;animation:k-xty-b 26s ease-in-out infinite alternate}
.${c} .xty-f i:nth-child(3){width:26vw;aspect-ratio:1;left:38vw;top:30%;background:var(--vif);opacity:.18;animation:k-xty-c 18s ease-in-out infinite alternate}
@keyframes k-xty-a{to{transform:translate(-8vw,6vw) scale(1.15)}}
@keyframes k-xty-b{to{transform:translate(9vw,-5vw) scale(1.1)}}
@keyframes k-xty-c{to{transform:translate(-6vw,-4vw) scale(.9)}}
.${c} .xty{display:grid;gap:clamp(18px,2.2vw,26px);padding-block:clamp(130px,14vw,180px) clamp(64px,8vw,110px);--hmax:8rem}
.${c} .x-hph{max-width:50ch;color:var(--doux)}
.${c} .xty-s{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.${c} .xty-s li{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;border:1px solid var(--ligne);background:color-mix(in srgb,var(--fond) 70%,transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-weight:var(--fxf);font-size:.94rem}
.${c} .xty-s .ic{width:18px;height:18px;color:var(--accentT)}
@media(prefers-reduced-motion:reduce){.${c} .xty-f i{animation:none}}
`; }
};

/* ── 9. un bloc teinté pour le texte, la photo jusqu'au bord ── */
const bloc = {
  id: 'hero.x-bloc', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Bloc teinté et photo', quand: 'commerces, ateliers, services : le texte sur un grand bloc teinté clair, la photo jusqu\'au bord droit',
  surfaces: ['fond'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc0) {
    return K.section(ctx, 'hero.x-bloc', bloc0, 'xh', null, 'Présentation') + '<div class="xbl"><div class="xbl-t"><div class="xbl-in cq">' + texte(spec, ctx) + '</div></div><div class="xbl-v">' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'rideau', tailles: '(max-width:860px) 100vw, 46vw' }) + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-bloc'; return `
.${c} .xbl{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);min-height:min(100svh,940px)}
.${c} .xbl-t{display:grid;align-items:center;background:var(--teinte);padding:clamp(120px,13vw,160px) clamp(24px,5vw,80px) clamp(56px,7vw,96px) max(var(--g),calc((100vw - var(--w)) / 2))}
.${c} .xbl-in{display:grid;gap:clamp(16px,2vw,24px);max-width:680px;--hmax:5.6rem}
.${c} .x-hph{color:var(--doux);max-width:46ch}
.${c} .xbl-v{position:relative;min-height:340px}
.${c} .xbl-v .ph{position:absolute;inset:0;border-radius:0}
@media(max-width:860px){.${c} .xbl{grid-template-columns:1fr}.${c} .xbl-t{padding:110px var(--g) 48px}.${c} .xbl-v{min-height:0;aspect-ratio:4/3}}
`; }
};

/* ── 10. l'affiche : le titre centré sur la photo ── */
const affiche = {
  id: 'hero.x-affiche', rubrique: 'hero', x: true, photo: 'oui', nom: 'Affiche', quand: 'lieux et ambiances (table, mer, hébergement) : le titre centré sur la photo plein écran, un trait qui invite à descendre',
  surfaces: ['photo'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    return K.section(ctx, 'hero.x-affiche', bloc, 'xh', null, 'Présentation') + '<div class="xaf-img" data-px="0.14">' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'recul', tailles: '100vw' }) + '</div><div class="w xaf cq">' + texte(spec, ctx, { h1: { une: true } }) + '</div><span class="xaf-bas" aria-hidden="true"></span></section>';
  },
  css: function () { const c = 'r-hero-x-affiche'; return `
.${c}{min-height:min(100svh,980px);display:grid;align-items:center;overflow:hidden;text-align:center}
.${c} .xaf-img{position:absolute;inset:-8% 0;z-index:-2}
.${c} .xaf-img .ph{height:100%;border-radius:0}
.${c}::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(120% 90% at 50% 48%,rgb(var(--voile) / .45),rgb(var(--voile) / .78))}
.${c} .xaf{display:grid;justify-items:center;gap:clamp(16px,2vw,24px);max-width:1000px;padding-block:150px 110px;--hmax:7.4rem}
.${c} .x-hph{max-width:46ch;color:rgb(255 255 255 / .9)}
.${c} .actions,.${c} .x-faits{justify-content:center}
.${c} .b2{color:#fff;border-color:rgb(255 255 255 / .55)}
.${c} .x-faits{color:rgb(255 255 255 / .88)}
.${c} .xaf-bas{position:absolute;left:50%;bottom:22px;width:1px;height:56px;background:linear-gradient(rgb(255 255 255 / 0),#fff);overflow:hidden}
.${c} .xaf-bas::after{content:"";position:absolute;inset:0;background:var(--vif);animation:k-xaf-goutte 2.4s var(--ease) infinite}
@keyframes k-xaf-goutte{from{transform:translateY(-100%)}to{transform:translateY(100%)}}
@media(prefers-reduced-motion:reduce){.${c} .xaf-bas::after{animation:none}}
`; }
};

/* ── 11. la fiche pratique : le texte, et une carte qui dit l'essentiel (avec ou sans photo) ── */
const fiche = {
  id: 'hero.x-fiche', rubrique: 'hero', x: true, photo: 'les-deux', sousNav: false, nom: 'Fiche pratique', quand: 'artisans, dépannage, services, avec ou sans photo : le texte à gauche, une carte à droite qui dit l\'essentiel (services, ouvert maintenant, lieu, note)',
  surfaces: ['fond', 'surface', 'teinte'], js: JS,
  besoin: function (spec, ctx) { return K.services(spec, ctx).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx).slice(0, 5), p = ctx.alloc.hero, g = K.note(spec, ctx);
    const carte = '<div class="xfi-c"' + h.rv('monte', 4) + '>' + (p ? K.photo(ctx, p, { eager: true, r: false, cls: 'xfi-ph', tailles: '(max-width:860px) 100vw, 40vw' }) : '') + '<div class="xfi-in"><p class="xfi-k">' + h.esc(ctx.textes.services) + '</p><ul class="xfi-l">' + s.map(function (x) { return '<li>' + h.icone('check') + '<span>' + h.esc(x.titre) + '</span></li>'; }).join('') + '</ul><div class="xfi-p">' + (K.ouvert(spec, ctx) || '') + '<p class="xfi-lieu">' + h.icone('pin') + h.esc(h.lieuCourt(spec)) + '</p>' + (g ? '<p class="xfi-n">' + h.etoiles(g.note) + '<b>' + h.noteTexte(g) + '</b> · ' + g.avis + ' avis</p>' : '') + '</div></div></div>';
    return K.section(ctx, 'hero.x-fiche', bloc, 'xh', null, 'Présentation') + '<div class="w xfi"><div class="xfi-t cq">' + texte(spec, ctx, { faits: false }) + '</div>' + carte + '</div></section>';
  },
  css: function () { const c = 'r-hero-x-fiche'; return `
.${c} .xfi{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);align-items:center;gap:clamp(32px,6vw,90px);min-height:min(100svh,900px);padding-block:clamp(120px,13vw,160px) clamp(56px,7vw,90px)}
.${c} .xfi-t{display:grid;gap:clamp(16px,2vw,24px);--hmax:5.8rem}
.${c} .x-hph{color:var(--doux);max-width:46ch}
.${c} .xfi-c{border-radius:var(--x-rc,20px);background:var(--carte);border:1px solid var(--bord);box-shadow:var(--ombreF);overflow:hidden}
.${c} .xfi-ph{aspect-ratio:16/10;border-radius:0}
.${c} .xfi-in{display:grid;gap:18px;padding:clamp(22px,2.6vw,32px)}
.${c} .xfi-k{font-size:.82rem;font-weight:var(--fxf);letter-spacing:.12em;text-transform:uppercase;color:var(--accentT)}
.${c} .xfi-l{display:grid;gap:12px}
.${c} .xfi-l li{display:flex;align-items:center;gap:12px;font-weight:var(--fxf);font-size:1.06rem}
.${c} .xfi-l .ic{width:22px;height:22px;padding:4px;border-radius:50%;background:var(--teinte);color:var(--teinteT)}
.${c} .xfi-p{display:grid;gap:10px;padding-top:16px;border-top:1px solid var(--bord);font-size:.94rem;color:var(--doux)}
.${c} .xfi-lieu,.${c} .xfi-n{display:flex;align-items:center;gap:8px}.${c} .xfi-lieu .ic{width:18px;height:18px;color:var(--accentT)}
.${c} .xfi-n b{color:var(--encre)}
@media(max-width:860px){.${c} .xfi{grid-template-columns:1fr;min-height:0;padding-top:110px}}
`; }
};

/* ── 12. le bandeau photo, et la carte de texte qui monte dessus ── */
const bande = {
  id: 'hero.x-bande', rubrique: 'hero', x: true, photo: 'oui', nom: 'Bandeau et carte', quand: 'une belle photo large (hébergement, mer, terrasse, chantier soigné) : la photo en bandeau, une grande carte claire qui monte dessus avec le titre',
  surfaces: ['photo'], js: JS, besoin: avecPhoto,
  rendre: function (spec, ctx, bloc) {
    return K.section(ctx, 'hero.x-bande', bloc, 'xh', null, 'Présentation') + '<div class="xbd-img"><div data-px="0.12">' + K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'recul', tailles: '100vw' }) + '</div></div><div class="w xbd"><div class="xbd-c cq">' + texte(spec, ctx) + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-bande'; return `
.${c}{background:var(--fond);color:var(--encre);--tx:var(--encre);--tx2:var(--doux);--btn:var(--accent);--btnT:var(--surA);--acc:var(--accent);--accT:var(--accentT)}
.${c} .xbd-img{position:relative;height:clamp(420px,68svh,720px);overflow:hidden}
.${c} .xbd-img>div{position:absolute;inset:-8% 0}
.${c} .xbd-img .ph{height:100%;border-radius:0}
.${c} .xbd-img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgb(var(--voile) / .5),rgb(var(--voile) / 0) 40%)}
.${c} .xbd{position:relative;margin-top:clamp(-220px,-14vw,-110px)}
.${c} .xbd-c{display:grid;gap:clamp(16px,2vw,22px);max-width:880px;padding:clamp(28px,4.4vw,60px);border-radius:var(--x-rc,22px);background:var(--fond);box-shadow:0 -30px 60px -40px rgb(var(--voile) / .5);--hmax:5.6rem}
.${c} .x-hph{color:var(--doux);max-width:48ch}
@media(max-width:860px){.${c} .xbd-c{padding:26px 22px}}
`; }
};


/* ── 13. sans photo : un grand cadre en dégradé doux aux couleurs du site ── */
const degrade = {
  id: 'hero.x-degrade', rubrique: 'hero', x: true, photo: 'non', sousNav: false, nom: 'Cadre en dégradé', quand: 'sans photo : un grand cadre arrondi rempli d\'un dégradé doux aux couleurs du site qui bouge lentement, le texte posé dedans, les services en pastilles',
  surfaces: ['fond', 'surface'], js: ['ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx).slice(0, 4);
    const pastilles = s.length ? '<ul class="xdg-s"' + h.rv('monte', 6) + '>' + s.map(function (x) { return '<li>' + h.esc(x.titre) + '</li>'; }).join('') + '</ul>' : '';
    return K.section(ctx, 'hero.x-degrade', bloc, 'xh', null, 'Présentation') + '<div class="xdg"><div class="xdg-in cq">' + texte(spec, ctx, { h1: { trois: true } }) + pastilles + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-degrade'; return `
.${c}{padding:94px var(--g) 0}
.${c} .xdg{position:relative;isolation:isolate;display:grid;align-items:end;min-height:min(calc(100svh - 112px),820px);border-radius:var(--x-rc,24px);overflow:hidden;background:radial-gradient(60% 70% at 85% 15%,color-mix(in srgb,var(--accent) 34%,transparent),transparent 70%),radial-gradient(55% 60% at 10% 90%,color-mix(in srgb,var(--vif) 30%,transparent),transparent 70%),radial-gradient(80% 80% at 50% 50%,var(--teinte),var(--surface));background-size:160% 160%,160% 160%,100% 100%;animation:k-xdg-houle 18s ease-in-out infinite alternate}
@keyframes k-xdg-houle{to{background-position:30% 40%,70% 10%,0 0}}
.${c} .xdg::after{content:"";position:absolute;inset:0;z-index:-1;opacity:.35;background-image:radial-gradient(color-mix(in srgb,var(--encre) 22%,transparent) .6px,transparent .7px);background-size:5px 5px;mix-blend-mode:multiply}
.${c} .xdg-in{display:grid;gap:clamp(16px,2vw,22px);max-width:900px;padding:clamp(32px,5.4vw,72px);--hmax:6.6rem}
.${c} .x-hph{color:var(--doux);max-width:48ch}
.${c} .xdg-s{display:flex;flex-wrap:wrap;gap:8px}
.${c} .xdg-s li{padding:9px 15px;border-radius:999px;background:color-mix(in srgb,var(--fond) 72%,transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-weight:var(--fxf);font-size:.92rem}
@media(max-width:860px){.${c}{padding-top:84px}.${c} .xdg{min-height:80svh}}
@media(prefers-reduced-motion:reduce){.${c} .xdg{animation:none}}
`; }
};

/* ── 14. sans photo : le texte, et les services en tuiles numérotées ── */
const tuiles = {
  id: 'hero.x-tuiles', rubrique: 'hero', x: true, photo: 'non', sousNav: false, nom: 'Texte et tuiles de services', quand: 'sans photo, deux services ou plus : le texte à gauche, les services en tuiles numérotées et teintées à droite, qui mènent chacune à sa demande',
  surfaces: ['fond', 'surface'], js: ['ouvert'], besoin: function (spec, ctx) { return K.services(spec, ctx).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx).slice(0, 4);
    const t = s.map(function (x, k) { const l = K.lienService(spec, ctx, x); return '<li' + h.rv('zoom', k + 3) + '>' + (l ? '<a href="' + h.esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : '') + '>' : '<div>') + '<span class="xtu-n">' + K.num(k) + '</span>' + h.icone(x.icone) + '<b>' + h.esc(x.titre) + '</b>' + (l ? '</a>' : '</div>') + '</li>'; }).join('');
    return K.section(ctx, 'hero.x-tuiles', bloc, 'xh', null, 'Présentation') + '<div class="w xtu"><div class="xtu-t cq">' + texte(spec, ctx) + '</div><ul class="xtu-l n' + s.length + '">' + t + '</ul></div></section>';
  },
  css: function () { const c = 'r-hero-x-tuiles'; return `
.${c} .xtu{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:center;gap:clamp(32px,6vw,90px);min-height:min(100svh,900px);padding-block:clamp(120px,13vw,160px) clamp(56px,7vw,90px)}
.${c} .xtu-t{display:grid;gap:clamp(16px,2vw,24px);--hmax:5.8rem}
.${c} .x-hph{color:var(--doux);max-width:46ch}
.${c} .xtu-l{display:grid;grid-template-columns:1fr 1fr;gap:clamp(10px,1.2vw,14px)}
.${c} .xtu-l.n3 li:first-child{grid-column:span 2}
.${c} .xtu-l a,.${c} .xtu-l li>div{position:relative;display:grid;align-content:space-between;gap:28px;min-height:clamp(150px,15vw,200px);padding:clamp(18px,2vw,24px);border-radius:var(--x-rc,18px);background:var(--teinte);text-decoration:none;transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.${c} .xtu-l li:nth-child(2) a,.${c} .xtu-l li:nth-child(2)>div{background:var(--surface)}
.${c} .xtu-l li:nth-child(3) a,.${c} .xtu-l li:nth-child(3)>div{background:var(--carte);border:1px solid var(--ligne)}
.${c} .xtu-l li:nth-child(4) a,.${c} .xtu-l li:nth-child(4)>div{background:color-mix(in srgb,var(--accent) 14%,var(--fond))}
.${c} .xtu-l a:hover{transform:translateY(-4px);box-shadow:var(--ombreF)}
.${c} .xtu-n{position:absolute;top:clamp(18px,2vw,24px);right:clamp(18px,2vw,24px);font-family:var(--ft);font-size:.9rem;color:var(--doux)}
.${c} .xtu-l .ic{width:28px;height:28px;color:var(--accentT)}
.${c} .xtu-l b{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-size:clamp(1.15rem,1.6vw,1.4rem);line-height:1.1}
@media(max-width:860px){.${c} .xtu{grid-template-columns:1fr;min-height:0;padding-top:110px}}
`; }
};

module.exports = [plein, cadre, split, titre, arche, centre, collage, typo, bloc, affiche, fiche, bande, degrade, tuiles];
module.exports.faits = faits;
