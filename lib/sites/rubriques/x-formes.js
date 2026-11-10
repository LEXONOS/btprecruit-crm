// Les sections « formes douces » des templates (nov. 2026, planches de wireframes de Louis : arches, pilules, galets,
// panneaux emboîtés, bento). La forme sert toujours le contenu : elle cadre une vraie photo, réunit un texte et sa
// photo, range des moyens de contact ; jamais une forme posée pour décorer. Cinq dessins :
//   hero.x-galets      la photo dans une grande arche, une seconde dans un rond qui la chevauche, une troisième en pilule
//   services.x-arches  les services sous des arches et des pilules alternées, en quinconce, chacun sa photo
//   apropos.x-encoche  un grand panneau teinté dont la photo occupe un coin, emboîtée par des angles rentrants
//   galerie.x-bento    ses photos en bento de tailles inégales, le titre dans une tuile teintée de la grille
//   contact.x-tuiles   la question et le bouton dans un panneau teinté, chaque moyen de joindre dans sa tuile
'use strict';
const K = require('./x-kit');
const XH = require('./x-heros');

/* ── 1. le haut de page en galets ── */
// les photos des galets : d'abord les illustrations, puis les siennes, en laissant trois des siennes à la galerie (une
// galerie privée de ses photos par le haut de page, c'est une section vide)
function photosGalets(ctx) {
  const garder = ctx.h.libres(3, { siennes: true });
  return ctx.h.libres(5, { decor: true }).filter(function (p) { return garder.indexOf(p) < 0; }).slice(0, 2);
}
const galets = {
  id: 'hero.x-galets', rubrique: 'hero', x: true, photo: 'oui', sousNav: false, nom: 'Galets', quand: 'deux photos ou plus (soins, bien-être, tables, jardins, boutiques) : le texte à gauche, à droite la photo dans une grande arche, une seconde dans un rond qui la chevauche, une troisième en pilule s\'il y en a une',
  surfaces: ['fond', 'surface'], js: ['parallaxe', 'ouvert', 'progres'],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero && photosGalets(ctx).length >= 1; },
  rendre: function (spec, ctx, bloc) {
    const autres = photosGalets(ctx);
    if (!autres.length) return '';
    const v = K.photo(ctx, ctx.alloc.hero, { eager: true, r: 'store', cls: 'xgl-1', tailles: '(max-width:860px) 60vw, 30vw' }) +
      K.photo(ctx, autres[0], { r: 'iris', i: 2, cls: 'xgl-2', px: '0.06', tailles: '(max-width:860px) 42vw, 22vw' }) +
      (autres[1] ? K.photo(ctx, autres[1], { r: 'store', i: 3, cls: 'xgl-3', px: '-0.08', tailles: '(max-width:860px) 26vw, 12vw' }) : '');
    return K.section(ctx, 'hero.x-galets', bloc, 'xh', null, 'Présentation') + '<div class="w xgl"><div class="xgl-t cq">' + XH.texte(spec, ctx) + '</div><div class="xgl-v' + (autres[1] ? ' trois' : '') + '">' + v + '</div></div></section>';
  },
  css: function () { const c = 'r-hero-x-galets'; return `
.${c} .xgl{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);align-items:center;gap:clamp(32px,5vw,84px);min-height:min(100svh,940px);padding-block:clamp(120px,13vw,160px) clamp(56px,7vw,96px)}
.${c} .xgl-t{display:grid;gap:clamp(16px,2vw,24px);--hmax:5.6rem}
.${c} .xgl-v{position:relative;justify-self:end;width:min(560px,100%);aspect-ratio:1/1.08}
.${c} .xgl-v .ph{position:absolute;margin:0}
.${c} .xgl-1{right:0;top:0;width:66%;height:94%;border-radius:999px 999px var(--x-r,22px) var(--x-r,22px)}
.${c} .xgl-2{left:2%;bottom:0;width:47%;aspect-ratio:1;border-radius:50%;box-shadow:0 0 0 clamp(7px,.9vw,12px) var(--bg)}
.${c} .xgl-3{left:9%;top:5%;width:23%;aspect-ratio:1/1.75;border-radius:999px;box-shadow:0 0 0 clamp(6px,.7vw,10px) var(--bg)}
.${c} .xgl-v:not(.trois) .xgl-1{width:72%}
.${c} .xgl-v:not(.trois) .xgl-2{width:52%}
@media(max-width:860px){.${c} .xgl{grid-template-columns:1fr;min-height:0;padding-top:110px}.${c} .xgl-v{justify-self:center;width:min(440px,94%)}}
`; }
};

/* ── 2. les services sous des arches ── */
const arches = {
  id: 'services.x-arches', rubrique: 'services', x: true, nom: 'Arches', quand: 'deux à quatre services qui ont chacun leur photo : chaque photo sous une arche ou dans une pilule, en quinconce, le titre et le texte dessous',
  surfaces: ['fond', 'surface', 'teinte'], js: [],
  besoin: function (spec, ctx) { const s = K.servicesAvecPhotos(spec, ctx); return !!s && s.length >= 2 && s.length <= 4; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = K.services(spec, ctx);
    const lien = function (x) { const l = K.lienService(spec, ctx, x); return l ? '<a class="xar-a" href="' + h.esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : '') + ' aria-label="' + h.esc(l.texte + ' : ' + x.titre) + '">' + h.esc(l.texte) + h.icone('fleche') + '</a>' : ''; };
    const items = s.map(function (x, k) {
      return '<li class="xar-i ' + (k % 2 ? 'pil' : 'arc') + '"' + h.rv('monte', k) + '><div class="xar-v">' + h.figure(x.photo, 'lazy', '(max-width:700px) 50vw, 25vw', { classe: 'xar-f' }) + '</div><h3>' + h.esc(x.titre) + '</h3><p>' + h.esc(x.texte) + '</p>' + lien(x) + '</li>';
    }).join('');
    return K.section(ctx, 'services.x-arches', bloc, 'sec', 'services') + '<div class="w">' + K.tete(ctx, { sur: K.surDe(ctx, 'services', 'Services'), titre: ctx.textes.services, cls: 'c' }) + '<ul class="xar n' + s.length + '">' + items + '</ul></div></section>';
  },
  css: function () { const c = 'r-services-x-arches'; return `
.${c} .xar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(18px,2.6vw,40px);align-items:start}
.${c} .xar.n2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:820px;margin-inline:auto}
.${c} .xar.n3{grid-template-columns:repeat(3,minmax(0,1fr));max-width:1060px;margin-inline:auto}
.${c} .xar-i{display:grid;gap:10px;justify-items:center;text-align:center}
.${c} .xar-i:nth-child(2n){margin-top:clamp(28px,5vw,72px)}
.${c} .xar-v{width:100%;aspect-ratio:3/4.3;margin-bottom:clamp(10px,1.4vw,18px);transition:translate .7s var(--ease)}
.${c} .arc .xar-v{border-radius:999px 999px var(--x-r,22px) var(--x-r,22px);overflow:hidden}
.${c} .pil .xar-v{border-radius:999px;overflow:hidden}
.${c} .xar-f{height:100%;border-radius:0}
.${c} .xar-f img{transition:scale 1.1s var(--ease)}
.${c} .xar-i:hover .xar-v{translate:0 -8px}
.${c} .xar-i:hover .xar-f img{scale:1.06}
.${c} .xar-i h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.25rem,1.8vw,1.55rem);line-height:1.1}
.${c} .xar-i p{color:var(--tx2);max-width:30ch}
.${c} .xar-a{display:inline-flex;align-items:center;gap:8px;margin-top:4px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.${c} .xar-a .ic{width:18px;height:18px;transition:transform .45s var(--ease)}.${c} .xar-a:hover .ic{transform:translateX(5px)}
@media(max-width:900px){.${c} .xar,.${c} .xar.n3{grid-template-columns:repeat(2,minmax(0,1fr))}.${c} .xar.n3 .xar-i:last-child{grid-column:1/-1;width:min(50%,320px);justify-self:center;margin-top:0}}
@media(max-width:520px){.${c} .xar,.${c} .xar.n2,.${c} .xar.n3{gap:22px 14px}.${c} .xar-i:nth-child(2n){margin-top:44px}.${c} .xar-i p{font-size:.95rem}}
`; }
};

/* ── 3. la présentation dans un panneau emboîté ── */
// Le panneau teinté porte le texte ; la photo occupe son coin haut droit, détachée par une marge de la couleur de la
// section (un cadre plein, carré en haut et à droite), et le panneau l'épouse par deux angles arrondis rentrants (le motif des sites « bento » de Louis)
const encoche = {
  id: 'apropos.x-encoche', rubrique: 'apropos', x: true, nom: 'Panneau emboîté', quand: 'une photo pour la présentation : un grand panneau teinté (le nom, le texte, les engagements) dont la photo occupe le coin, emboîtée par des angles arrondis rentrants',
  surfaces: ['fond', 'surface', 'teinte'], js: [],
  besoin: function (spec, ctx) { return K.presentation(spec, ctx).length >= 40 && !!ctx.alloc.apropos; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = K.atouts(spec, ctx);
    const liste = a.length ? '<ul class="xen-l n' + a.length + '">' + a.map(function (x, k) { return '<li' + h.rv('monte', k + 3) + '>' + h.icone('check') + '<div><h3>' + h.esc(x.titre) + '</h3>' + (x.texte ? '<p>' + h.esc(x.texte) + '</p>' : '') + '</div></li>'; }).join('') + '</ul>' : '';
    return K.section(ctx, 'apropos.x-encoche', bloc, 'sec', 'apropos') + '<div class="w"><div class="xen"' + h.rv('monte') + '><div class="xen-t">' + K.sur(ctx, K.surDe(ctx, 'apropos', ctx.mod.textes.apropos), 1) + '<h2 class="t x-h2"' + h.rv('monte', 1) + '>' + h.esc(K.net(spec.nom)) + '</h2><p class="xen-p"' + h.rv('monte', 2) + '>' + h.esc(K.presentation(spec, ctx)) + '</p></div><div class="xen-c">' + h.figure(ctx.alloc.apropos, 'lazy', '(max-width:860px) 100vw, 40vw', { classe: 'xen-f', attrs: h.rv('store', 1) }) + '</div>' + liste + '</div></div></section>';
  },
  css: function () { const c = 'r-apropos-x-encoche'; return `
.${c} .xen{--pn:var(--teinte);--P:clamp(28px,4vw,60px);--G:clamp(10px,1.2vw,16px);--R:var(--x-rc,26px);position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.82fr);grid-template-areas:"t c" "l l";gap:clamp(24px,3.4vw,52px) clamp(28px,4vw,64px);padding:var(--P);border-radius:var(--R);background:var(--pn)}
.${c}.s-teinte .xen{--pn:var(--carte)}
.${c} .xen-t{grid-area:t;display:grid;gap:clamp(14px,1.8vw,20px);align-content:center;padding-block:clamp(8px,2vw,32px)}
.${c} .xen .x-sur{background:var(--bg)}
.${c} .xen-p{font-size:clamp(1.06rem,1.3vw,1.2rem);color:var(--tx2);max-width:54ch}
.${c} .xen-c{grid-area:c;position:relative;margin:calc(-1 * var(--P)) calc(-1 * var(--P)) 0 0;padding:0 0 var(--G) var(--G);background:var(--bg);border-bottom-left-radius:calc(var(--R) + var(--G));align-self:start}
.${c} .xen-c::before,.${c} .xen-c::after{content:"";position:absolute;width:var(--R);height:var(--R);background:radial-gradient(circle at 0 100%,transparent calc(var(--R) - .5px),var(--bg) var(--R))}
.${c} .xen-c::before{top:0;left:calc(-1 * var(--R))}
.${c} .xen-c::after{top:100%;right:0}
.${c} .xen-f{aspect-ratio:4/4.4;border-radius:var(--R)}
.${c} .xen-l{grid-area:l;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(18px,2.4vw,36px);padding-top:clamp(20px,2.4vw,30px);border-top:1px solid color-mix(in srgb,var(--tx) 14%,transparent)}
.${c} .xen-l.n2,.${c} .xen-l.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.${c} .xen-l li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}
.${c} .xen-l .ic{width:26px;height:26px;padding:5px;border-radius:50%;background:var(--bg);color:var(--accT)}
.${c} .xen-l h3{font-weight:var(--fxf);font-size:1.06rem}
.${c} .xen-l p{color:var(--tx2);font-size:.96rem}
@media(max-width:860px){.${c} .xen{grid-template-columns:1fr;grid-template-areas:"c" "t" "l"}.${c} .xen-c{margin:calc(-1 * var(--P)) calc(-1 * var(--P)) 0;padding:0;background:none}.${c} .xen-c::before,.${c} .xen-c::after{display:none}.${c} .xen-f{aspect-ratio:4/3;border-radius:var(--R) var(--R) 0 0}.${c} .xen-l,.${c} .xen-l.n2,.${c} .xen-l.n4{grid-template-columns:1fr}}
`; }
};

/* ── 4. la galerie en bento ── */
const DLG = '<dialog class="xv-dlg" data-visionneuse aria-label="Photo en grand"><img alt=""></dialog>';
function grande(p, ctx) {
  if (ctx.optimiseur && !/\.svg$/i.test(p.fichier)) return '/_vercel/image?url=' + encodeURIComponent('/' + ctx.racinePhysique + 'img/' + p.fichier) + '&w=1600&q=74';
  return ctx.racineImg + p.fichier;
}
// la place de chaque tuile (t : le titre), selon le nombre de photos
const GRILLES = {
  3: { col: 3, aires: ['t a b', 'c a b'] },
  4: { col: 4, aires: ['t t a b', 'c d d b'] },
  5: { col: 4, aires: ['t t a b', 'c d e b'] },
  6: { col: 5, aires: ['t t a b b', 'c d d e f'] }
};
const bento = {
  id: 'galerie.x-bento', rubrique: 'galerie', x: true, nom: 'Bento', quand: 'trois à six photos à lui : un bento de tuiles de tailles inégales, le titre dans une tuile teintée de la grille, chaque photo s\'ouvre en grand',
  surfaces: ['fond', 'surface'], js: ['visionneuse'],
  besoin: function (spec, ctx) { return ctx.h.libres(3, { siennes: true }).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = h.photos(6, { siennes: true }), g = GRILLES[ph.length];
    if (!g) return '';
    const lettres = 'abcdef';
    const tuiles = ph.map(function (p, k) { const alt = K.net(p.alt); return '<li class="xbe-p" style="grid-area:' + lettres[k] + '"' + h.rv('zoom', (k + 1) % 4) + '><a href="' + h.esc(grande(p, ctx)) + '" data-zoom data-alt="' + h.esc(alt) + '" aria-label="Agrandir la photo' + (alt ? ' : ' + h.esc(alt) : '') + '">' + h.figure(p, 'lazy', '(max-width:700px) 50vw, 30vw') + '</a></li>'; }).join('');
    const titre = '<li class="xbe-t" style="grid-area:t"' + h.rv('monte') + '>' + K.sur(ctx, K.surDe(ctx, 'galerie', 'En images')) + '<h2 class="t x-h2">' + h.esc(ctx.mod.textes.galerie) + '</h2></li>';
    const aires = g.aires.map(function (l) { return '\'' + l + '\''; }).join(' ');
    return K.section(ctx, 'galerie.x-bento', bloc, 'sec', 'images') + '<div class="w"><ul class="xbe n' + ph.length + '" style="grid-template-columns:repeat(' + g.col + ',minmax(0,1fr));grid-template-areas:' + aires + '">' + titre + tuiles + '</ul></div>' + DLG + '</section>';
  },
  css: function () { const c = 'r-galerie-x-bento'; return `
.${c} .xbe{display:grid;grid-auto-rows:clamp(170px,19vw,290px);gap:clamp(10px,1.2vw,16px)}
.${c} .xbe-t{display:grid;align-content:end;gap:12px;padding:clamp(22px,2.6vw,36px);border-radius:var(--x-rc,24px);background:var(--teinte)}
.${c}.s-surface .xbe-t{background:var(--teinte)}
.${c} .xbe-t .x-h2{font-size:clamp(1.9rem,3.4vw,3.1rem)}
.${c} .xbe-p a{display:block;height:100%;border-radius:var(--x-rc,24px);overflow:hidden;cursor:zoom-in}
.${c} .xbe .ph{height:100%;border-radius:0}
.${c} .xbe img{transition:scale 1s var(--ease)}
.${c} .xbe a:hover img{scale:1.06}
.${c} .xv-dlg{border:0;padding:0;max-width:min(94vw,1400px);max-height:92vh;background:transparent;overflow:visible}
.${c} .xv-dlg::backdrop{background:rgb(10 12 16 / .82)}
.${c} .xv-dlg img{max-width:min(94vw,1400px);max-height:92vh;border-radius:12px;object-fit:contain;cursor:zoom-out}
@media(max-width:700px){.${c} .xbe{grid-template-columns:1fr 1fr!important;grid-template-areas:none!important;grid-auto-rows:42vw}.${c} .xbe li{grid-area:auto!important}.${c} .xbe li.xbe-t{grid-column:1/-1!important;grid-row:auto!important}.${c} .xbe li.xbe-p:nth-child(2){grid-column:1/-1!important;grid-row:span 2!important}}
`; }
};

/* ── 5. le contact en tuiles ── */
function titreC(ctx, bloc) {
  const h = ctx.h, t = bloc && bloc.h1 ? ctx.mod.textes.contact : (ctx.textes.appel || ctx.mod.textes.contact), b = bloc && bloc.h1 ? 'h1' : 'h2';
  return '<' + b + ' class="t x-h2 xtu-h" data-r="mots">' + h.mots(String(t).replace(/ ([?!:;])/g, ' $1')) + '</' + b + '>';
}
const tuilesC = {
  id: 'contact.x-tuiles', rubrique: 'contact', x: true, nom: 'Panneau et tuiles', quand: 'toujours possible : la question du client et le bouton dans un grand panneau teinté, chaque moyen de joindre dans sa tuile à côté, les horaires et la zone dans une tuile en long',
  surfaces: ['fond', 'surface'], js: ['ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = K.moyens(spec, ctx), z = K.zone(spec, ctx), hs = K.horaires(spec, ctx, 'xtu-hs');
    const tuile = function (x, k, large) {
      const corps = h.icone(x.icone) + '<small>' + h.esc(x.etiquette) + '</small><b>' + K.valeurHtml(h, x) + '</b>';
      return '<li class="xtu-m' + (large ? ' large' : '') + '"' + h.rv('monte', k + 1) + '>' + (x.href ? '<a href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + corps + '</a>' : '<div>' + corps + '</div>') + '</li>';
    };
    const lignes = m.map(function (x, k) { return tuile(x, k, m.length % 2 === 1 && k === m.length - 1); }).join('');
    const hor = hs || z ? '<li class="xtu-o large"' + h.rv('monte', m.length + 1) + '>' + (hs ? '<div><p class="xtu-k">Horaires</p>' + K.ouvert(spec, ctx) + hs + '</div>' : '') + (z ? '<div class="xtu-z"><p class="xtu-k">Où nous intervenons</p><p>' + h.esc(z) + '</p></div>' : '') + '</li>' : '';
    return K.section(ctx, 'contact.x-tuiles', bloc, 'sec', 'contact') + '<div class="w xtu"><div class="xtu-p cq"' + h.rv('zoom') + '>' + K.sur(ctx, K.surDe(ctx, 'contact', 'Contact')) + titreC(ctx, bloc) + '<p class="xtu-ph">' + h.esc(h.phraseContact(spec)) + '</p><div>' + K.boutons(spec, ctx, { seule: true }) + '</div></div><ul class="xtu-g">' + lignes + hor + '</ul></div></section>';
  },
  css: function () { const c = 'r-contact-x-tuiles'; return `
.${c} .xtu{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(10px,1.2vw,16px);align-items:stretch}
.${c} .xtu-p{display:grid;gap:clamp(14px,1.8vw,20px);align-content:center;padding:clamp(30px,4.6vw,68px);border-radius:var(--x-rc,26px);background:var(--teinte)}
.${c} .xtu-h{font-size:clamp(2.1rem,4.2vw,3.9rem);line-height:1.02}
.${c} .xtu-ph{color:var(--tx2);font-size:1.1rem;max-width:42ch}
.${c} .xtu-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(10px,1.2vw,16px)}
.${c} .xtu-g>li{border-radius:var(--x-rc,26px);background:var(--carte);border:1px solid var(--bord);min-width:0}
.${c} .xtu-g .large{grid-column:1/-1}
.${c} .xtu-m a,.${c} .xtu-m>div{display:grid;align-content:start;gap:6px;height:100%;padding:clamp(20px,2.4vw,30px);text-decoration:none;border-radius:inherit;transition:background .4s}
.${c} .xtu-m a:hover{background:color-mix(in srgb,var(--acc) 7%,var(--carte))}
.${c} .xtu-m .ic{width:42px;height:42px;padding:10px;margin-bottom:clamp(10px,1.6vw,22px);border-radius:50%;background:var(--teinte);color:var(--teinteT)}
.${c} .xtu-m small{font-size:.82rem;font-weight:var(--fxf);color:var(--tx2)}
.${c} .xtu-m b{font-size:1.08rem;font-weight:var(--fxf);overflow-wrap:anywhere}
.${c} .xtu-o{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 28px;padding:clamp(20px,2.4vw,30px)}
.${c} .xtu-k{font-size:.8rem;font-weight:var(--fxf);letter-spacing:.12em;text-transform:uppercase;color:var(--accT);margin-bottom:8px}
.${c} .xtu-o .x-ouvert{margin-bottom:6px}
.${c} .xtu-hs{font-size:.96rem}
.${c} .xtu-z p:last-child{font-weight:var(--fxf)}
@media(max-width:860px){.${c} .xtu{grid-template-columns:1fr}}
@media(max-width:460px){.${c} .xtu-g{grid-template-columns:1fr}}
`; }
};

module.exports = [galets, arches, encoche, bento, tuilesC];
module.exports.GRILLES = GRILLES;
