// Présentations des templates : qui est l'entreprise, ses engagements (une seule fois sur la page), et ce qui se vérifie
// (où, quand, la note). Sept dessins : manifeste qui s'allume à la lecture, photo et texte, fiche des faits, citation,
// deux photos superposées, grande photo et carte qui chevauche, engagements numérotés.
'use strict';
const K = require('./x-kit');

const aTexte = function (spec, ctx) { return K.presentation(spec, ctx).length >= 40; };
function titre(spec, ctx) { return K.net(spec.nom); }
function surA(ctx) { return K.surDe(ctx, 'apropos', ctx.mod.textes.apropos); }
// les engagements, en liste (filets ou coches)
function liste(spec, ctx, cls, o) {
  o = o || {};
  const h = ctx.h, a = K.atouts(spec, ctx);
  if (!a.length) return '';
  return '<ul class="' + cls + ' n' + a.length + '">' + a.map(function (x, k) { return '<li' + h.rv('monte', k + (o.i || 0)) + '>' + (o.num ? '<span class="xn">' + K.num(k) + '</span>' : h.icone(o.icone || x.icone)) + '<div><h3>' + h.esc(x.titre) + '</h3>' + (x.texte ? '<p>' + h.esc(x.texte) + '</p>' : '') + '</div></li>'; }).join('') + '</ul>';
}
// la photo de la présentation : la sienne, sinon une photo encore libre
function photoA(ctx) { return ctx.alloc.apropos || null; }

/* ── 1. le manifeste : la présentation en très grand, les mots s'allument à la lecture ── */
const manifeste = {
  id: 'apropos.x-manifeste', rubrique: 'apropos', x: true, nom: 'Manifeste', quand: 'toujours possible, sans photo : la présentation en très grand, ses mots qui s\'allument au fil de la lecture, les engagements en ligne dessous',
  surfaces: ['fond', 'surface', 'teinte'], js: ['lecture'], besoin: aTexte,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, t = K.presentation(spec, ctx);
    const mots = t.split(' ').map(function (m) { return '<span class="lw">' + h.esc(m) + '</span>'; }).join(' ');
    return K.section(ctx, 'apropos.x-manifeste', bloc, 'sec', 'apropos') + '<div class="w"><div class="xmf-h">' + K.sur(ctx, surA(ctx)) + '<h2 class="xmf-t"' + h.rv('monte', 1) + '>' + h.esc(titre(spec, ctx)) + '</h2></div><p class="xmf-p" data-lecture>' + mots + '</p>' + liste(spec, ctx, 'xmf-l', { num: true }) + '</div></section>';
  },
  css: function () { const c = 'r-apropos-x-manifeste'; return `
.${c} .xmf-h{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;margin-bottom:clamp(20px,2.6vw,34px)}
.${c} .xmf-t{font-size:1rem;font-weight:var(--fxf);margin:0;color:var(--tx2)}
.${c} .xmf-p{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.7rem,3.6vw,3.3rem);line-height:1.16;max-width:30ch;text-wrap:pretty}
.js .${c} .lw{opacity:.16;transition:opacity .45s}
.js .${c} .lw.on,.js .${c} .lu .lw{opacity:1}
.${c} .xmf-l{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,48px);margin-top:clamp(48px,6vw,90px)}
.${c} .xmf-l.n2,.${c} .xmf-l.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.${c} .xmf-l li{display:grid;gap:12px;padding-top:18px;border-top:var(--x-trait,1px solid var(--bord))}
.${c} .xn{font-family:var(--ft);font-size:.92rem;color:var(--accT)}
.${c} .xmf-l h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-size:clamp(1.2rem,1.7vw,1.45rem);line-height:1.12;margin-bottom:6px}
.${c} .xmf-l p{color:var(--tx2)}
@media(max-width:760px){.${c} .xmf-l,.${c} .xmf-l.n2,.${c} .xmf-l.n4{grid-template-columns:1fr}}
`; }
};

/* ── 2. la photo et le texte, les engagements cochés ── */
const photo = {
  id: 'apropos.x-photo', rubrique: 'apropos', x: true, nom: 'Photo et texte', quand: 'une photo pour la présentation : la photo arrondie qui se dévoile, le texte et les engagements à côté',
  surfaces: ['fond', 'surface', 'teinte'], js: ['parallaxe'], besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!photoA(ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = photoA(ctx);
    return K.section(ctx, 'apropos.x-photo', bloc, 'sec', 'apropos') + '<div class="w xph"><div class="xph-v" data-r="store"><div data-px="0.07">' + h.figure(p, 'lazy', '(max-width:860px) 100vw, 46vw', { classe: 'xph-f' }) + '</div></div><div class="xph-t">' + K.tete(ctx, { sur: surA(ctx), titre: titre(spec, ctx) }) + '<p class="xph-p"' + h.rv('monte', 2) + '>' + h.esc(K.presentation(spec, ctx)) + '</p>' + liste(spec, ctx, 'xph-l', { icone: 'check', i: 3 }) + '</div></div></section>';
  },
  css: function () { const c = 'r-apropos-x-photo'; return `
.${c} .xph{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,6vw,100px);align-items:center}
.${c} .xph-v{border-radius:var(--x-r,18px);overflow:hidden;aspect-ratio:4/5}
.${c} .xph-v>div{height:114%;margin-top:-7%}
.${c} .xph-f{height:100%;border-radius:0}
.${c} .xph-t .x-tete{margin-bottom:18px}
.${c} .xph-p{font-size:clamp(1.06rem,1.3vw,1.2rem);color:var(--tx2);max-width:52ch}
.${c} .xph-l{display:grid;gap:18px;margin-top:clamp(24px,3vw,36px);padding-top:clamp(20px,2.6vw,28px);border-top:var(--x-trait,1px solid var(--bord))}
.${c} .xph-l li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:start}
.${c} .xph-l .ic{width:26px;height:26px;padding:5px;border-radius:50%;background:var(--teinte);color:var(--teinteT)}
.${c} .xph-l h3{font-weight:var(--fxf);font-size:1.08rem}
.${c} .xph-l p{color:var(--tx2);font-size:.97rem}
@media(max-width:860px){.${c} .xph{grid-template-columns:1fr}.${c} .xph-v{aspect-ratio:4/3}}
`; }
};

/* ── 3. la fiche des faits : le texte, et ce qui se vérifie ── */
const faits = {
  id: 'apropos.x-faits', rubrique: 'apropos', x: true, nom: 'Texte et fiche des faits', quand: 'toujours possible, sans photo : le texte de présentation à gauche, à droite une fiche à filets (où, zone, horaires, note Google)',
  surfaces: ['fond', 'surface', 'teinte'], js: ['ouvert'], besoin: aTexte,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, lignes = [];
    lignes.push(['Où', spec.commune ? spec.commune + ', Martinique' : 'Martinique']);
    const z = K.zone(spec, ctx); if (z) lignes.push(['Zone', z]);
    const hs = h.horairesDe(c), r = h.resumeHoraires(hs); if (r) lignes.push(['Horaires', r]);
    const g = K.note(spec, ctx); if (g) lignes.push(['Google', h.noteTexte(g) + ' sur 5, ' + g.avis + ' avis']);
    const n = K.services(spec, ctx); if (n.length) lignes.push(['Services', n.map(function (x) { return x.titre; }).join(', ')]);
    const fiche = '<dl class="xf-d"' + h.rv('monte', 2) + '>' + lignes.map(function (l) { return '<div><dt>' + h.esc(l[0]) + '</dt><dd>' + h.esc(l[1]) + '</dd></div>'; }).join('') + '</dl>';
    return K.section(ctx, 'apropos.x-faits', bloc, 'sec', 'apropos') + '<div class="w xf"><div class="xf-t">' + K.tete(ctx, { sur: surA(ctx), titre: titre(spec, ctx) }) + '<p class="xf-p"' + h.rv('monte', 2) + '>' + h.esc(K.presentation(spec, ctx)) + '</p>' + liste(spec, ctx, 'xf-l', { icone: 'check', i: 3 }) + '</div>' + fiche + '</div></section>';
  },
  css: function () { const c = 'r-apropos-x-faits'; return `
.${c} .xf{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(32px,6vw,100px);align-items:start}
.${c} .xf-t .x-tete{margin-bottom:18px}
.${c} .xf-p{font-size:clamp(1.08rem,1.35vw,1.24rem);color:var(--tx2);max-width:54ch}
.${c} .xf-l{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:22px}
.${c} .xf-l li{display:flex;align-items:center;gap:8px;font-weight:var(--fxf)}.${c} .xf-l li div p{display:none}
.${c} .xf-l h3{font-size:1rem;font-weight:var(--fxf)}
.${c} .xf-l .ic{width:20px;height:20px;color:var(--accT)}
.${c} .xf-d{border-top:var(--x-trait,1px solid var(--bord));position:sticky;top:110px}
.${c} .xf-d>div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:16px;padding:16px 0;border-bottom:var(--x-trait,1px solid var(--bord))}
.${c} .xf-d dt{font-size:.82rem;font-weight:var(--fxf);letter-spacing:.1em;text-transform:uppercase;color:var(--accT);padding-top:.2em}
.${c} .xf-d dd{margin:0;font-weight:var(--fxf)}
@media(max-width:860px){.${c} .xf{grid-template-columns:1fr}.${c} .xf-d{position:static}}
`; }
};

/* ── 4. la citation : la présentation comme une parole, signée ── */
const citation = {
  id: 'apropos.x-citation', rubrique: 'apropos', x: true, nom: 'Citation', quand: 'soins, conseil, tables, métiers de confiance : la présentation centrée comme une parole, grands guillemets, signée du nom, les engagements dessous',
  surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: aTexte,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    return K.section(ctx, 'apropos.x-citation', bloc, 'sec', 'apropos') + '<div class="w xq">' + K.sur(ctx, surA(ctx)) + '<h2 class="xq-h">' + h.esc(titre(spec, ctx)) + '</h2><blockquote class="xq-b" data-r="flou"><p>' + h.esc(K.presentation(spec, ctx)) + '</p></blockquote><p class="xq-s"' + h.rv('monte', 2) + '>' + h.esc(K.net(spec.nom)) + (spec.commune ? ', ' + h.esc(spec.commune) : '') + '</p>' + liste(spec, ctx, 'xq-l', { icone: 'check', i: 3 }) + '</div></section>';
  },
  css: function () { const c = 'r-apropos-x-citation'; return `
.${c} .xq{display:grid;justify-items:center;text-align:center;gap:18px;max-width:1000px}
.${c} .xq-h{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;margin:0}
.${c} .xq-b{position:relative;margin:clamp(8px,1.4vw,18px) 0 0}
.${c} .xq-b::before{content:"\\201C";display:block;font-family:var(--ft);font-size:clamp(5rem,9vw,8rem);line-height:.6;color:var(--accT);opacity:.85;margin-bottom:6px}
.${c} .xq-b p{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-size:clamp(1.55rem,3.2vw,2.75rem);line-height:1.22;text-wrap:balance}
.${c} .xq-s{font-weight:var(--fxf);color:var(--tx2);letter-spacing:.02em}
.${c} .xq-s::before{content:"";display:inline-block;width:34px;height:1.5px;background:var(--acc);vertical-align:middle;margin-right:12px}
.${c} .xq-l{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:clamp(18px,2.6vw,32px)}
.${c} .xq-l li{display:flex;align-items:center;gap:10px;padding:10px 16px 10px 12px;border-radius:999px;background:var(--carte);border:1px solid var(--bord)}
.${c} .xq-l h3{font-size:.98rem;font-weight:var(--fxf)}.${c} .xq-l p{display:none}
.${c} .xq-l .ic{width:20px;height:20px;color:var(--accT)}
`; }
};

/* ── 5. deux photos superposées ── */
const double = {
  id: 'apropos.x-double', rubrique: 'apropos', x: true, nom: 'Deux photos superposées', quand: 'deux photos ou plus (lieu, gestes, matières) : une grande et une petite qui la chevauche, à des vitesses différentes, le texte à côté',
  surfaces: ['fond', 'surface', 'teinte'], js: ['parallaxe'], besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!photoA(ctx) && ctx.h.libres(1, { decor: true }).length >= 1; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = photoA(ctx), q = h.photos(1, { decor: true })[0];
    return K.section(ctx, 'apropos.x-double', bloc, 'sec', 'apropos') + '<div class="w xd"><div class="xd-t">' + K.tete(ctx, { sur: surA(ctx), titre: titre(spec, ctx) }) + '<p class="xd-p"' + h.rv('monte', 2) + '>' + h.esc(K.presentation(spec, ctx)) + '</p>' + liste(spec, ctx, 'xd-l', { num: true, i: 3 }) + '</div><div class="xd-v">' + K.photo(ctx, p, { r: 'store', cls: 'xd-1', tailles: '(max-width:860px) 80vw, 36vw' }) + '<div class="xd-2w" data-px="-0.1">' + K.photo(ctx, q, { r: 'store', i: 2, cls: 'xd-2', tailles: '(max-width:860px) 50vw, 20vw' }) + '</div></div></div></section>';
  },
  css: function () { const c = 'r-apropos-x-double'; return `
.${c} .xd{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,6vw,100px);align-items:center}
.${c} .xd-t .x-tete{margin-bottom:18px}
.${c} .xd-p{font-size:clamp(1.06rem,1.3vw,1.2rem);color:var(--tx2);max-width:52ch}
.${c} .xd-l{display:grid;gap:14px;margin-top:26px}
.${c} .xd-l li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;padding-top:14px;border-top:var(--x-trait,1px solid var(--bord))}
.${c} .xn{font-family:var(--ft);color:var(--accT);font-size:.92rem;padding-top:.15em}
.${c} .xd-l h3{font-weight:var(--fxf);font-size:1.06rem}.${c} .xd-l p{color:var(--tx2);font-size:.96rem}
.${c} .xd-v{position:relative;padding:0 14% 16% 0}
.${c} .xd-1{aspect-ratio:4/5;border-radius:var(--x-r,18px)}
.${c} .xd-2w{position:absolute;right:0;bottom:0;width:48%}
.${c} .xd-2{aspect-ratio:1;border-radius:var(--x-r,18px);box-shadow:0 0 0 clamp(6px,.8vw,10px) var(--bg),var(--ombreF)}
@media(max-width:860px){.${c} .xd{grid-template-columns:1fr}}
`; }
};

/* ── 6. la grande photo et la carte qui chevauche ── */
const large = {
  id: 'apropos.x-large', rubrique: 'apropos', x: true, nom: 'Grande photo et carte', quand: 'une belle photo large (atelier, lieu, terrasse, bateau) : la photo sur toute la largeur glisse au défilement, une carte claire chevauche son bas avec le texte',
  surfaces: ['fond', 'surface'], js: ['parallaxe'], besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!photoA(ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = photoA(ctx);
    return K.section(ctx, 'apropos.x-large', bloc, 'sec', 'apropos') + '<div class="xg-img"><div data-px="0.12">' + h.figure(p, 'lazy', '100vw', { classe: 'xg-f' }) + '</div></div><div class="w"><div class="xg-c"' + h.rv('monte') + '>' + K.tete(ctx, { sur: surA(ctx), titre: titre(spec, ctx) }) + '<p class="xg-p">' + h.esc(K.presentation(spec, ctx)) + '</p>' + liste(spec, ctx, 'xg-l', { icone: 'check' }) + '</div></div></section>';
  },
  css: function () { const c = 'r-apropos-x-large'; return `
.${c}{padding-top:0!important}
.${c} .xg-img{position:relative;height:clamp(360px,62vh,640px);overflow:hidden}
.${c} .xg-img>div{position:absolute;inset:-10% 0}
.${c} .xg-f{height:100%;border-radius:0}
.${c} .xg-c{position:relative;margin-top:clamp(-200px,-12vw,-90px);max-width:820px;padding:clamp(26px,4vw,56px);border-radius:var(--x-rc,22px);background:var(--bg);box-shadow:var(--ombreF)}
.${c} .xg-c .x-tete{margin-bottom:16px}
.${c} .xg-p{font-size:clamp(1.06rem,1.3vw,1.2rem);color:var(--tx2)}
.${c} .xg-l{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:20px}
.${c} .xg-l li{display:flex;align-items:center;gap:8px}.${c} .xg-l h3{font-size:1rem;font-weight:var(--fxf)}.${c} .xg-l p{display:none}
.${c} .xg-l .ic{width:20px;height:20px;color:var(--accT)}
`; }
};

/* ── 7. les engagements numérotés, en grand ── */
const engagements = {
  id: 'apropos.x-engagements', rubrique: 'apropos', x: true, nom: 'Texte et engagements numérotés', quand: 'un texte et deux à quatre engagements : le titre et le texte en deux colonnes, puis les engagements en grands numéros sur un filet',
  surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: function (spec, ctx) { return aTexte(spec, ctx) && K.atouts(spec, ctx).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = K.atouts(spec, ctx);
    const l = '<ol class="xe-l n' + a.length + '">' + a.map(function (x, k) { return '<li' + h.rv('monte', k) + '><span class="xe-n">' + K.num(k) + '</span><h3>' + h.esc(x.titre) + '</h3>' + (x.texte ? '<p>' + h.esc(x.texte) + '</p>' : '') + '</li>'; }).join('') + '</ol>';
    return K.section(ctx, 'apropos.x-engagements', bloc, 'sec', 'apropos') + '<div class="w"><div class="xe-h">' + K.tete(ctx, { sur: surA(ctx), titre: titre(spec, ctx) }) + '<p class="xe-p"' + h.rv('monte', 2) + '>' + h.esc(K.presentation(spec, ctx)) + '</p></div>' + l + '</div></section>';
  },
  css: function () { const c = 'r-apropos-x-engagements'; return `
.${c} .xe-h{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(24px,5vw,90px);align-items:end;margin-bottom:clamp(40px,5vw,72px)}
.${c} .xe-h .x-tete{margin:0}
.${c} .xe-p{font-size:clamp(1.08rem,1.35vw,1.24rem);color:var(--tx2)}
.${c} .xe-l{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,44px)}
.${c} .xe-l.n2,.${c} .xe-l.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.${c} .xe-l li{display:grid;gap:10px;align-content:start;padding-top:22px;border-top:2px solid var(--acc)}
.${c} .xe-n{font-family:var(--ft);font-weight:var(--tp);font-size:clamp(2.6rem,4.4vw,3.8rem);line-height:1;letter-spacing:-.03em;color:var(--accT)}
.${c} .xe-l h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-size:clamp(1.2rem,1.7vw,1.5rem);line-height:1.12}
.${c} .xe-l p{color:var(--tx2)}
@media(max-width:860px){.${c} .xe-h{grid-template-columns:1fr}}
@media(max-width:700px){.${c} .xe-l,.${c} .xe-l.n2,.${c} .xe-l.n4{grid-template-columns:1fr}}
`; }
};

module.exports = [manifeste, photo, faits, citation, double, large, engagements];
