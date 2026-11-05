// La fin de page des templates : ses vraies photos, sa vraie note, les questions qui ont une vraie réponse, UNE rubrique
// contact qui réunit tout (moyens, adresse, horaires, zone) et un pied léger. Fond clair partout.
'use strict';
const K = require('./x-kit');

function grande(p, ctx) {
  if (ctx.optimiseur && !/\.svg$/i.test(p.fichier)) return '/_vercel/image?url=' + encodeURIComponent('/' + ctx.racinePhysique + 'img/' + p.fichier) + '&w=1600&q=74';
  return ctx.racineImg + p.fichier;
}
const siennes = function (n) { return function (spec, ctx) { return ctx.h.libres(n, { siennes: true }).length >= n; }; };
const DLG = '<dialog class="xv-dlg" data-visionneuse aria-label="Photo en grand"><img alt=""></dialog>';
const CSS_DLG = function (c) { return `
.${c} .xv-dlg{border:0;padding:0;max-width:min(94vw,1400px);max-height:92vh;background:transparent;overflow:visible}
.${c} .xv-dlg::backdrop{background:rgb(10 12 16 / .82)}
.${c} .xv-dlg img{max-width:min(94vw,1400px);max-height:92vh;border-radius:12px;object-fit:contain;cursor:zoom-out}
`; };
function tuile(p, ctx, cls, tailles, i) {
  const h = ctx.h, alt = K.net(p.alt);
  return '<li class="' + cls + '"' + h.rv('zoom', i % 4) + '><a href="' + h.esc(grande(p, ctx)) + '" data-zoom data-alt="' + h.esc(alt) + '" aria-label="Agrandir la photo' + (alt ? ' : ' + h.esc(alt) : '') + '">' + h.figure(p, 'lazy', tailles) + '</a></li>';
}
function teteGal(ctx) { return K.tete(ctx, { sur: K.surDe(ctx, 'galerie', 'En images'), titre: ctx.mod.textes.galerie }); }

/* ── photos : la mosaïque ── */
const mosaique = {
  id: 'galerie.x-mosaique', rubrique: 'galerie', x: true, nom: 'Mosaïque', quand: 'trois photos à lui ou plus : une grande et des petites, chaque photo s\'ouvre en grand', surfaces: ['fond', 'surface', 'teinte'], js: ['visionneuse'], besoin: siennes(3),
  rendre: function (spec, ctx, bloc) {
    const ph = ctx.h.photos(7, { siennes: true });
    return K.section(ctx, 'galerie.x-mosaique', bloc, 'sec', 'images') + '<div class="w">' + teteGal(ctx) + '<ul class="xmo n' + ph.length + '">' + ph.map(function (p, k) { return tuile(p, ctx, k === 0 ? 'g' : '', k === 0 ? '(max-width:700px) 100vw, 50vw' : '(max-width:700px) 50vw, 25vw', k); }).join('') + '</ul></div>' + DLG + '</section>';
  },
  css: function () { const c = 'r-galerie-x-mosaique'; return CSS_DLG(c) + `
.${c} .xmo{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:clamp(150px,16vw,240px);gap:clamp(8px,1vw,14px)}
.${c} .xmo .g{grid-column:span 2;grid-row:span 2}
.${c} .xmo.n3 li:not(.g),.${c} .xmo.n5 li:nth-child(n+4){grid-column:span 2}
.${c} .xmo a{display:block;height:100%;border-radius:var(--x-r,14px);overflow:hidden;cursor:zoom-in}
.${c} .xmo .ph{height:100%;border-radius:0}
.${c} .xmo img{transition:scale 1s var(--ease)}
.${c} .xmo a:hover img{scale:1.06}
@media(max-width:700px){.${c} .xmo{grid-template-columns:1fr 1fr;grid-auto-rows:42vw}.${c} .xmo li{grid-column:auto!important;grid-row:auto!important}.${c} .xmo .g{grid-column:span 2!important}}
`; }
};

/* ── photos : la piste qu'on fait glisser ── */
const pisteG = {
  id: 'galerie.x-piste', rubrique: 'galerie', x: true, nom: 'Piste de photos', quand: 'trois photos à lui ou plus : une piste de photos de hauteur égale qu\'on fait glisser, chaque photo s\'ouvre en grand', surfaces: ['fond', 'surface'], js: ['visionneuse', 'glisse'], besoin: siennes(3),
  rendre: function (spec, ctx, bloc) {
    const ph = ctx.h.photos(10, { siennes: true });
    return K.section(ctx, 'galerie.x-piste', bloc, 'sec', 'images') + '<div class="w">' + teteGal(ctx) + '</div><ul class="xpg" data-glisse>' + ph.map(function (p, k) { const r = p.l && p.h ? Math.max(.6, Math.min(1.8, p.l / p.h)) : 1.3; return tuile(p, ctx, '', '(max-width:700px) 80vw, 40vw', k).replace('<li class=""', '<li style="--ar:' + r.toFixed(2) + '"'); }).join('') + '</ul>' + DLG + '</section>';
  },
  css: function () { const c = 'r-galerie-x-piste'; return CSS_DLG(c) + `
.${c}{overflow:hidden}
.${c} .xpg{display:flex;gap:clamp(10px,1.2vw,16px);overflow-x:auto;padding:0 max(var(--g),calc((100vw - var(--w)) / 2)) 8px;scroll-snap-type:x proximity;scrollbar-width:none;cursor:grab}
.${c} .xpg::-webkit-scrollbar{display:none}
.${c} .xpg.tire{cursor:grabbing;scroll-snap-type:none}
.${c} .xpg li{flex:none;height:clamp(260px,40vw,480px);aspect-ratio:var(--ar,1.3);scroll-snap-align:start}
.${c} .xpg a{display:block;height:100%;border-radius:var(--x-r,14px);overflow:hidden;cursor:zoom-in}
.${c} .xpg .ph{height:100%;border-radius:0}
.${c} .xpg img{pointer-events:none;transition:scale 1s var(--ease)}
.${c} .xpg a:hover img{scale:1.05}
`; }
};

/* ── photos : la planche régulière ── */
const planche = {
  id: 'galerie.x-planche', rubrique: 'galerie', x: true, nom: 'Planche', quand: 'deux à huit photos à lui : une planche régulière à coins arrondis, chaque photo s\'ouvre en grand', surfaces: ['fond', 'surface', 'teinte'], js: ['visionneuse'], besoin: siennes(2),
  rendre: function (spec, ctx, bloc) {
    const ph = ctx.h.photos(8, { siennes: true });
    return K.section(ctx, 'galerie.x-planche', bloc, 'sec', 'images') + '<div class="w">' + teteGal(ctx) + '<ul class="xpl n' + ph.length + '">' + ph.map(function (p, k) { return tuile(p, ctx, '', '(max-width:700px) 50vw, 25vw', k); }).join('') + '</ul></div>' + DLG + '</section>';
  },
  css: function () { const c = 'r-galerie-x-planche'; return CSS_DLG(c) + `
.${c} .xpl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(8px,1vw,14px)}
.${c} .xpl.n2{grid-template-columns:repeat(2,minmax(0,1fr))}.${c} .xpl.n3,.${c} .xpl.n6{grid-template-columns:repeat(3,minmax(0,1fr))}
.${c} .xpl a{display:block;aspect-ratio:1;border-radius:var(--x-r,14px);overflow:hidden;cursor:zoom-in}
.${c} .xpl .ph{height:100%;border-radius:0}
.${c} .xpl img{transition:scale 1s var(--ease),filter .6s}
.${c} .xpl a:hover img{scale:1.06}
@media(max-width:700px){.${c} .xpl,.${c} .xpl.n3,.${c} .xpl.n6{grid-template-columns:1fr 1fr}}
`; }
};

/* ── avis : la note en grand ── */
function lienMaps(spec, ctx, cls) { const c = spec.contact || {}; return c.maps && /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.(google|app\.goo)\.|^https:\/\/goo\.gl\/maps/.test(c.maps) ? '<a class="' + cls + '" href="' + ctx.h.esc(c.maps) + '" target="_blank" rel="noopener">Lire les avis sur Google' + ctx.h.icone('fleche') + '</a>' : ''; }
const note = {
  id: 'avis.x-note', rubrique: 'avis', x: true, nom: 'La note en grand', quand: 'une bonne note Google : le chiffre en très grand qui compte, les étoiles, le nombre d\'avis, le lien vers Google', surfaces: ['fond', 'surface', 'teinte'], js: ['compteur'],
  besoin: function (spec, ctx) { return !!K.note(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = K.note(spec, ctx);
    return K.section(ctx, 'avis.x-note', bloc, 'sec', 'avis') + '<div class="w xno"><p class="x-sur"' + h.rv('monte') + '>' + h.esc(K.surDe(ctx, 'avis', 'Avis Google')) + '</p><h2 class="xno-h"><span class="xno-n"' + h.rv('monte', 1) + '><span data-compte="' + Number(g.note) + '" data-dec="1">' + h.noteTexte(g) + '</span><small>/5</small></span><span class="xno-t"' + h.rv('monte', 2) + '>' + h.etoiles(g.note) + '<span>' + g.avis + ' avis laissés sur Google</span></span></h2>' + lienMaps(spec, ctx, 'xno-a') + '</div></section>';
  },
  css: function () { const c = 'r-avis-x-note'; return `
.${c} .xno{display:grid;justify-items:center;text-align:center;gap:16px}
.${c} .xno-h{display:grid;justify-items:center;gap:14px;margin:0;font-weight:inherit}
.${c} .xno-n{font-family:var(--ft);font-weight:var(--tp);font-size:clamp(5rem,13vw,10rem);line-height:.9;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.${c} .xno-n small{font-size:.32em;color:var(--tx2);letter-spacing:0;margin-left:.06em}
.${c} .xno-t{display:grid;justify-items:center;gap:8px;font-size:1.06rem;color:var(--tx2)}
.${c} .xno-t .etoiles .ic{width:26px;height:26px}
.${c} .xno-a{display:inline-flex;align-items:center;gap:8px;font-weight:var(--fxf);color:var(--accT);text-decoration:none;margin-top:6px}
.${c} .xno-a .ic{width:18px;height:18px}
`; }
};
const ligne = {
  id: 'avis.x-ligne', rubrique: 'avis', x: true, nom: 'La note en ligne', quand: 'une bonne note Google : une bande d\'une ligne, la note, les étoiles, le nombre d\'avis, le lien', surfaces: ['teinte', 'surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return !!K.note(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = K.note(spec, ctx);
    return K.section(ctx, 'avis.x-ligne', bloc, '', 'avis', 'Avis Google') + '<div class="w xli"' + h.rv('monte') + '><p class="xli-n"><b>' + h.noteTexte(g) + '</b><span>/5</span></p>' + h.etoiles(g.note) + '<p class="xli-t">' + g.avis + ' clients ont laissé un avis sur Google</p>' + lienMaps(spec, ctx, 'xli-a') + '</div></section>';
  },
  css: function () { const c = 'r-avis-x-ligne'; return `
.${c}{padding-block:clamp(28px,3.4vw,44px)}
.${c} .xli{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px 22px;text-align:center}
.${c} .xli-n{font-family:var(--ft);font-weight:var(--tp);font-size:clamp(2rem,3.4vw,2.8rem);line-height:1}.${c} .xli-n span{font-size:.5em;color:var(--tx2)}
.${c} .etoiles .ic{width:22px;height:22px}
.${c} .xli-t{color:var(--tx2);font-weight:var(--fxf)}
.${c} .xli-a{display:inline-flex;align-items:center;gap:8px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}.${c} .xli-a .ic{width:18px;height:18px}
`; }
};

/* ── questions : deux colonnes, ou une colonne centrée (details : sans script) ── */
function questions(spec, ctx, cls) {
  const h = ctx.h;
  return K.faq(spec, ctx).map(function (x, k) { return '<details class="' + cls + '"' + (k === 0 ? ' open' : '') + h.rv('monte', k) + '><summary><h3>' + h.esc(K.net(x.q)) + '</h3><span class="xq-pl" aria-hidden="true"></span></summary><p>' + h.esc(K.net(x.r)) + '</p></details>'; }).join('');
}
const CSS_Q = function (c, cls) { return `
.${c} .${cls}{border-bottom:var(--x-trait,1px solid var(--bord))}
.${c} .${cls} summary{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 0;cursor:pointer;list-style:none}
.${c} .${cls} summary::-webkit-details-marker{display:none}
.${c} .${cls} h3{font-weight:var(--fxf);font-size:clamp(1.06rem,1.4vw,1.22rem);line-height:1.35}
.${c} .${cls} p{color:var(--tx2);padding:0 48px 24px 0;max-width:64ch}
.${c} .xq-pl{position:relative;flex:none;width:30px;height:30px}
.${c} .xq-pl::before,.${c} .xq-pl::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:1.8px;background:var(--accT);translate:-50% -50%;transition:rotate .45s var(--ease)}
.${c} .xq-pl::after{rotate:90deg}
.${c} .${cls}[open] .xq-pl::after{rotate:0deg}
.${c} .${cls}[open] p{animation:k-${c.slice(2)}-ouvre .5s var(--ease)}
@keyframes k-${c.slice(2)}-ouvre{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.${c} .${cls}[open] p{animation:none}}
`; };
const deuxQ = function (spec, ctx) { return K.faq(spec, ctx).length >= 2; };
const faqCol = {
  id: 'faq.x-colonnes', rubrique: 'faq', x: true, nom: 'Questions en deux colonnes', quand: 'deux questions ou plus qui ont une vraie réponse : le titre à gauche, les réponses qui s\'ouvrent à droite', surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: deuxQ,
  rendre: function (spec, ctx, bloc) { return K.section(ctx, 'faq.x-colonnes', bloc, 'sec', 'faq') + '<div class="w xqc"><div>' + K.tete(ctx, { sur: K.surDe(ctx, 'faq', 'Questions'), titre: ctx.mod.textes.faq }) + '</div><div class="xqc-l">' + questions(spec, ctx, 'xqi') + '</div></div></section>'; },
  css: function () { const c = 'r-faq-x-colonnes'; return CSS_Q(c, 'xqi') + `
.${c} .xqc{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,90px);align-items:start}
.${c} .xqc-l{border-top:var(--x-trait,1px solid var(--bord))}
@media(max-width:860px){.${c} .xqc{grid-template-columns:1fr}}
`; }
};
const faqCentre = {
  id: 'faq.x-centre', rubrique: 'faq', x: true, nom: 'Questions centrées', quand: 'deux questions ou plus qui ont une vraie réponse : une colonne centrée, la première ouverte', surfaces: ['fond', 'surface', 'teinte'], js: [], besoin: deuxQ,
  rendre: function (spec, ctx, bloc) { return K.section(ctx, 'faq.x-centre', bloc, 'sec', 'faq') + '<div class="w xqm">' + K.tete(ctx, { sur: K.surDe(ctx, 'faq', 'Questions'), titre: ctx.mod.textes.faq, cls: 'c' }) + '<div class="xqm-l">' + questions(spec, ctx, 'xqj') + '</div></div></section>'; },
  css: function () { const c = 'r-faq-x-centre'; return CSS_Q(c, 'xqj') + `
.${c} .xqm{max-width:860px}
.${c} .x-tete{text-align:center;justify-items:center;margin-inline:auto}
.${c} .xqm-l{border-top:var(--x-trait,1px solid var(--bord))}
`; }
};

/* ── contact : UNE rubrique qui réunit tout ── */
function titreC(ctx, bloc) {
  const h = ctx.h, t = bloc && bloc.h1 ? ctx.mod.textes.contact : (ctx.textes.appel || ctx.mod.textes.contact), b = bloc && bloc.h1 ? 'h1' : 'h2';
  return '<' + b + ' class="t x-h2 xct-t" data-r="mots">' + h.mots(String(t).replace(/ ([?!:;])/g, ' $1')) + '</' + b + '>';
}
function phraseC(spec, ctx) { return ctx.h.objectif(spec).phrase; }
function blocHoraires(spec, ctx, cls) {
  const h = ctx.h, z = K.zone(spec, ctx);
  const hs = K.horaires(spec, ctx, cls + '-h');
  if (!hs && !z) return '';
  return '<div class="' + cls + '"' + h.rv('monte', 3) + '>' + (hs ? '<p class="' + cls + '-k">Horaires</p>' + K.ouvert(spec, ctx) + hs : '') + (z ? '<p class="' + cls + '-k">Où nous intervenons</p><p class="' + cls + '-z">' + h.esc(z) + '</p>' : '') + '</div>';
}
const JSC = ['ouvert'];
const CSS_MOYENS = function (c, cls) { return `
.${c} .${cls}{display:grid;border-top:var(--x-trait,1px solid var(--bord))}
.${c} .${cls} li{border-bottom:var(--x-trait,1px solid var(--bord))}
.${c} .${cls} a,.${c} .${cls} li>div{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;padding:18px 4px;text-decoration:none}
.${c} .${cls} a::after{content:"";width:10px;height:10px;border-top:1.8px solid currentColor;border-right:1.8px solid currentColor;rotate:45deg;margin-right:6px;transition:translate .45s var(--ease);opacity:.6}
.${c} .${cls} a:hover::after{translate:5px 0;opacity:1}
.${c} .${cls}-i{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:var(--teinte);color:var(--teinteT)}
.${c} .${cls}-i .ic{width:20px;height:20px}
.${c} .${cls}-t{display:grid;gap:2px;min-width:0}
.${c} .${cls}-t small{font-size:.82rem;color:var(--tx2);font-weight:var(--fxf)}
.${c} .${cls}-t b{font-size:1.08rem;font-weight:var(--fxf);overflow-wrap:anywhere}
`; };
const CSS_HOR = function (c, cls) { return `
.${c} .${cls}{display:grid;gap:12px;padding:clamp(20px,2.4vw,28px);border-radius:var(--x-rc,18px);background:var(--carte);border:1px solid var(--bord)}
.${c} .${cls}-k{font-size:.8rem;font-weight:var(--fxf);letter-spacing:.12em;text-transform:uppercase;color:var(--accT)}
.${c} .${cls}-k:not(:first-child){margin-top:8px}
.${c} .${cls}-z{font-weight:var(--fxf)}
.${c} .${cls} .horaires{font-size:.97rem}
`; };

const cSplit = {
  id: 'contact.x-split', rubrique: 'contact', x: true, nom: 'Contact en deux colonnes', quand: 'toujours possible : la question du client en grand et les boutons à gauche, les moyens de joindre et les horaires à droite', surfaces: ['fond', 'surface', 'teinte'], js: JSC,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    return K.section(ctx, 'contact.x-split', bloc, 'sec', 'contact') + '<div class="w xcs"><div class="xcs-g cq">' + K.sur(ctx, K.surDe(ctx, 'contact', 'Contact')) + titreC(ctx, bloc) + '<p class="xcs-p"' + h.rv('monte', 2) + '>' + h.esc(phraseC(spec, ctx)) + '</p><div' + h.rv('monte', 3) + '>' + K.boutons(spec, ctx, { seule: true }) + '</div></div><div class="xcs-d"><ul class="xcm">' + K.moyens(spec, ctx).map(function (x, k) { return K.ligneMoyen(ctx, x, 'xcm', k); }).join('') + '</ul>' + blocHoraires(spec, ctx, 'xch') + '</div></div></section>';
  },
  css: function () { const c = 'r-contact-x-split'; return CSS_MOYENS(c, 'xcm') + CSS_HOR(c, 'xch') + `
.${c} .xcs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,6vw,100px);align-items:start}
.${c} .xcs-g{display:grid;gap:clamp(16px,2vw,22px);position:sticky;top:110px}
.${c} .xct-t{font-size:clamp(2.2rem,4.6vw,4.2rem);line-height:1.02}
.${c} .xcs-p{color:var(--tx2);font-size:1.1rem;max-width:42ch}
.${c} .xcs-d{display:grid;gap:clamp(18px,2.4vw,28px)}
@media(max-width:860px){.${c} .xcs{grid-template-columns:1fr}.${c} .xcs-g{position:static}}
`; }
};

const cCarte = {
  id: 'contact.x-carte', rubrique: 'contact', x: true, nom: 'Grande carte de contact', quand: 'toujours possible : une grande carte centrée (la question, les boutons), et dessous trois colonnes (nous joindre, horaires, où)', surfaces: ['surface', 'teinte', 'fond'], js: JSC,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = K.moyens(spec, ctx), ad = m.find(function (x) { return x.cle === 'adresse'; }), autres = m.filter(function (x) { return x.cle !== 'adresse'; });
    const col = function (titre, corps, i) { return corps ? '<div class="xcc-c"' + h.rv('monte', i) + '><p class="xcc-k">' + titre + '</p>' + corps + '</div>' : ''; };
    const joindre = autres.length ? '<ul class="xcc-l">' + autres.map(function (x) { return '<li><a href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + h.icone(x.icone) + '<span>' + h.esc(x.cle === 'wa' ? 'WhatsApp' : x.valeur) + '</span></a></li>'; }).join('') + '</ul>' : '';
    const hor = K.aHoraires(spec, ctx) ? K.ouvert(spec, ctx) + K.horaires(spec, ctx) : '';
    const ou = ad ? '<p class="xcc-ad">' + (ad.href ? '<a href="' + h.esc(ad.href) + '" target="_blank" rel="noopener">' + h.esc(ad.valeur) + '</a>' : h.esc(ad.valeur)) + '</p>' + (K.zone(spec, ctx) ? '<p class="xcc-z">' + h.esc(K.zone(spec, ctx)) + '</p>' : '') : '';
    return K.section(ctx, 'contact.x-carte', bloc, 'sec', 'contact') + '<div class="w"><div class="xcc cq"' + h.rv('zoom') + '>' + K.sur(ctx, K.surDe(ctx, 'contact', 'Contact')) + titreC(ctx, bloc) + '<p class="xcc-p">' + h.esc(phraseC(spec, ctx)) + '</p>' + K.boutons(spec, ctx, { seule: true }) + '</div><div class="xcc-g">' + col('Nous joindre', joindre, 1) + col('Horaires', hor, 2) + col('Où', ou, 3) + '</div></div></section>';
  },
  css: function () { const c = 'r-contact-x-carte'; return `
.${c} .xcc{display:grid;justify-items:center;text-align:center;gap:clamp(14px,1.8vw,20px);padding:clamp(36px,6vw,80px) clamp(22px,4vw,60px);border-radius:var(--x-rc,26px);background:var(--carte);border:1px solid var(--bord);box-shadow:var(--x-ombre,none)}
.${c} .xct-t{font-size:clamp(2.2rem,5vw,4.4rem);line-height:1.02;max-width:18ch}
.${c} .xcc-p{color:var(--tx2);font-size:1.1rem;max-width:44ch}
.${c} .xcc .actions{justify-content:center}
.${c} .xcc-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,44px);margin-top:clamp(28px,3.4vw,44px)}
.${c} .xcc-c{display:grid;gap:12px;align-content:start;padding-top:18px;border-top:var(--x-trait,1px solid var(--bord))}
.${c} .xcc-k{font-size:.8rem;font-weight:var(--fxf);letter-spacing:.12em;text-transform:uppercase;color:var(--accT)}
.${c} .xcc-l{display:grid;gap:10px}
.${c} .xcc-l a{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-weight:var(--fxf);overflow-wrap:anywhere}
.${c} .xcc-l .ic{width:20px;height:20px;color:var(--accT)}
.${c} .xcc-l a:hover span{text-decoration:underline}
.${c} .xcc-ad{font-weight:var(--fxf)}.${c} .xcc-ad a{text-decoration-thickness:1px}
.${c} .xcc-z{color:var(--tx2)}
@media(max-width:860px){.${c} .xcc-g{grid-template-columns:1fr}}
`; }
};

const cPhoto = {
  id: 'contact.x-photo', rubrique: 'contact', x: true, nom: 'Photo et panneau de contact', quand: 'une photo encore libre : la photo à fond perdu d\'un côté, le panneau de contact complet de l\'autre', surfaces: ['fond', 'surface', 'teinte'], js: JSC,
  besoin: function (spec, ctx) { return ctx.h.libres(1, { decor: true }).length >= 1 || !!ctx.alloc.bandeau; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = h.photos(1, { decor: true })[0] || ctx.alloc.bandeau;
    if (!p) return '';
    return K.section(ctx, 'contact.x-photo', bloc, '', 'contact') + '<div class="xcp"><div class="xcp-v" data-r="rideau">' + h.figure(p, 'lazy', '(max-width:860px) 100vw, 50vw', { classe: 'xcp-f' }) + '</div><div class="xcp-d"><div class="xcp-in cq">' + K.sur(ctx, K.surDe(ctx, 'contact', 'Contact')) + titreC(ctx, bloc) + '<p class="xcp-p"' + h.rv('monte', 2) + '>' + h.esc(phraseC(spec, ctx)) + '</p><ul class="xcm">' + K.moyens(spec, ctx).map(function (x, k) { return K.ligneMoyen(ctx, x, 'xcm', k); }).join('') + '</ul>' + blocHoraires(spec, ctx, 'xch') + '</div></div></div></section>';
  },
  css: function () { const c = 'r-contact-x-photo'; return CSS_MOYENS(c, 'xcm') + CSS_HOR(c, 'xch') + `
.${c} .xcp{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:min(100svh,900px)}
.${c} .xcp-v{position:relative;min-height:320px}
.${c} .xcp-f{position:absolute;inset:0;border-radius:0}
.${c} .xcp-d{display:grid;align-items:center;padding:var(--sec) max(var(--g),calc((100vw - var(--w)) / 2)) var(--sec) clamp(28px,5vw,80px)}
.${c} .xcp-in{display:grid;gap:clamp(16px,2vw,22px);max-width:560px}
.${c} .xct-t{font-size:clamp(2rem,4vw,3.6rem);line-height:1.04}
.${c} .xcp-p{color:var(--tx2);font-size:1.08rem}
@media(max-width:860px){.${c} .xcp{grid-template-columns:1fr}.${c} .xcp-v{aspect-ratio:4/3;min-height:0}.${c} .xcp-d{padding:56px var(--g)}}
`; }
};

const cTeinte = {
  id: 'contact.x-teinte', rubrique: 'contact', x: true, nom: 'Bande teintée et cartes', quand: 'toujours possible : une grande bande teintée claire, la question en très grand et le bouton, puis des cartes blanches (joindre, horaires, lieu)', surfaces: ['teinte'], js: JSC,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = K.moyens(spec, ctx);
    const cartes = m.map(function (x, k) { return '<li' + h.rv('monte', k) + '>' + (x.href ? '<a href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' : '<div>') + h.icone(x.icone) + '<small>' + h.esc(x.etiquette) + '</small><b>' + h.esc(x.valeur) + '</b>' + (x.href ? '</a>' : '</div>') + '</li>'; }).join('');
    const hor = K.aHoraires(spec, ctx) ? '<li class="xct-h"' + h.rv('monte', m.length) + '><div>' + h.icone('horloge') + '<small>Horaires</small>' + K.ouvert(spec, ctx) + K.horaires(spec, ctx) + '</div></li>' : '';
    return K.section(ctx, 'contact.x-teinte', bloc, 'sec', 'contact') + '<div class="w"><div class="xct-g cq">' + K.sur(ctx, K.surDe(ctx, 'contact', 'Contact')) + titreC(ctx, bloc) + '<div class="xct-a"' + h.rv('monte', 2) + '><p>' + h.esc(phraseC(spec, ctx)) + (K.zone(spec, ctx) ? ' ' + h.esc(K.zone(spec, ctx)) + '.' : '') + '</p>' + K.boutons(spec, ctx, { seule: true }) + '</div></div><ul class="xct-l">' + cartes + hor + '</ul></div></section>';
  },
  css: function () { const c = 'r-contact-x-teinte'; return `
.${c} .xct-g{display:grid;gap:clamp(16px,2vw,24px);margin-bottom:clamp(32px,4vw,56px)}
.${c} .xct-t{font-size:clamp(2.4rem,6vw,5.6rem);line-height:.98;max-width:16ch}
.${c} .xct-a{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px 40px}
.${c} .xct-a p{color:var(--tx2);font-size:1.1rem;max-width:46ch}
.${c} .xct-l{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:clamp(10px,1.2vw,16px)}
.${c} .xct-l a,.${c} .xct-l li>div{display:grid;gap:6px;align-content:start;height:100%;padding:clamp(20px,2.2vw,26px);border-radius:var(--x-rc,18px);background:var(--carte);text-decoration:none;transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.${c} .xct-l a:hover{transform:translateY(-4px);box-shadow:var(--ombreF)}
.${c} .xct-l .ic{width:24px;height:24px;color:var(--accentT);margin-bottom:10px}
.${c} .xct-l small{font-size:.82rem;color:var(--tx2);font-weight:var(--fxf)}
.${c} .xct-l b{font-size:1.06rem;font-weight:var(--fxf);overflow-wrap:anywhere}
.${c} .xct-h .horaires{font-size:.95rem;margin-top:6px}
`; }
};

const cColonnes = {
  id: 'contact.x-colonnes', rubrique: 'contact', x: true, nom: 'Écrire, appeler, venir', quand: 'toujours possible : le titre, puis trois colonnes claires (écrire, appeler, venir ou nous trouver), chacune son geste', surfaces: ['fond', 'surface', 'teinte'], js: JSC,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = K.moyens(spec, ctx), par = function (cle) { return m.find(function (x) { return x.cle === cle; }); };
    const ecr = par('wa') || par('mail'), app = par('tel'), ad = par('adresse');
    const col = function (n, titre, x, plus, i) { return x || plus ? '<li class="xco-c"' + h.rv('monte', i) + '><span class="xco-n">' + n + '</span><h3>' + titre + '</h3>' + (x ? (x.href ? '<a href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + h.icone(x.icone) + '<span>' + h.esc(x.cle === 'wa' ? 'Écrire sur WhatsApp' : x.valeur) + '</span></a>' : '<p class="xco-v">' + h.esc(x.valeur) + '</p>') : '') + (plus || '') + '</li>' : ''; };
    const mail = par('mail') && ecr && ecr.cle === 'wa' ? '<a href="' + h.esc(par('mail').href) + '">' + h.icone('mail') + '<span>' + h.esc(par('mail').valeur) + '</span></a>' : '';
    const hor = K.aHoraires(spec, ctx) ? K.ouvert(spec, ctx) + K.horaires(spec, ctx) : '';
    const z = K.zone(spec, ctx);
    const items = [col('01', 'Écrire', ecr, mail, 0), col('02', 'Appeler', app, hor && !ad ? hor : '', 1), col('03', ['visite', 'reservation'].indexOf(spec.objectif) >= 0 ? 'Venir' : 'Nous trouver', ad, (ad && hor ? hor : '') + (z ? '<p class="xco-z">' + h.esc(z) + '</p>' : ''), 2)].filter(Boolean);
    return K.section(ctx, 'contact.x-colonnes', bloc, 'sec', 'contact') + '<div class="w"><div class="xco-h cq">' + K.sur(ctx, K.surDe(ctx, 'contact', 'Contact')) + titreC(ctx, bloc) + '<p' + h.rv('monte', 2) + '>' + h.esc(phraseC(spec, ctx)) + '</p></div><ul class="xco-l n' + items.length + '">' + items.join('') + '</ul></div></section>';
  },
  css: function () { const c = 'r-contact-x-colonnes'; return `
.${c} .xco-h{display:grid;gap:clamp(14px,1.8vw,20px);margin-bottom:clamp(32px,4vw,56px)}
.${c} .xct-t{font-size:clamp(2.2rem,5vw,4.4rem);line-height:1.02;max-width:18ch}
.${c} .xco-h>p{color:var(--tx2);font-size:1.1rem;max-width:46ch}
.${c} .xco-l{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,48px)}
.${c} .xco-l.n2{grid-template-columns:repeat(2,minmax(0,1fr))}.${c} .xco-l.n1{grid-template-columns:1fr}
.${c} .xco-c{display:grid;gap:12px;align-content:start;padding-top:22px;border-top:2px solid var(--acc)}
.${c} .xco-n{font-family:var(--ft);font-size:.9rem;color:var(--accT)}
.${c} .xco-c h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-size:clamp(1.6rem,2.6vw,2.2rem);line-height:1.04}
.${c} .xco-c a{display:inline-flex;align-items:center;gap:10px;font-weight:var(--fxf);text-decoration:none;overflow-wrap:anywhere}
.${c} .xco-c a .ic{width:20px;height:20px;color:var(--accT)}
.${c} .xco-c a:hover span{text-decoration:underline}
.${c} .xco-v,.${c} .xco-z{color:var(--tx2)}
.${c} .horaires{font-size:.95rem}
@media(max-width:860px){.${c} .xco-l,.${c} .xco-l.n2{grid-template-columns:1fr}}
`; }
};

/* ── pieds légers (le contact est juste au-dessus) ── */
function liensPied(ctx, cls) { const h = ctx.h; return (ctx.ancres || []).length ? '<nav class="' + cls + '" aria-label="Plan du site">' + ctx.ancres.map(function (a) { return '<a href="' + h.esc(a.href) + '">' + h.esc(a.nom) + '</a>'; }).join('') + '</nav>' : ''; }
const pSimple = {
  id: 'pied.x-simple', rubrique: 'pied', x: true, nom: 'Pied simple', quand: 'toujours possible : le nom et le métier, les liens, les mentions, sur une ligne', surfaces: ['surface', 'fond', 'teinte'], js: [],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    return '<footer class="' + h.classes('pied.x-simple', bloc) + '"><div class="w"><div class="xps">' + ctx.marque + '<p class="xps-m">' + h.esc(ctx.ligneMetier) + '</p>' + liensPied(ctx, 'xps-l') + '</div>' + ctx.basDePage + '</div></footer>';
  },
  css: function () { const c = 'r-pied-x-simple'; return `
.${c}{padding-block:clamp(40px,5vw,64px) clamp(24px,3vw,36px)}
.${c} .xps{display:flex;flex-wrap:wrap;align-items:center;gap:14px 28px}
.${c} .xps-m{color:var(--tx2);font-size:.95rem}
.${c} .xps-l{display:flex;flex-wrap:wrap;gap:8px 22px;margin-left:auto;font-weight:var(--fxf);font-size:.95rem}
.${c} .xps-l a{text-decoration:none}.${c} .xps-l a:hover{text-decoration:underline}
`; }
};
const pColonnes = {
  id: 'pied.x-colonnes', rubrique: 'pied', x: true, nom: 'Pied en colonnes', quand: 'quand la fiche est riche : le nom et le métier, le plan, joindre, horaires', surfaces: ['surface', 'fond', 'teinte'], js: ['ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = K.moyens(spec, ctx).filter(function (x) { return x.cle !== 'adresse'; }), ad = K.moyens(spec, ctx).find(function (x) { return x.cle === 'adresse'; });
    const joindre = m.length || ad ? '<div><p class="xpc-k">Contact</p><ul>' + m.map(function (x) { return '<li><a href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + h.esc(x.cle === 'wa' ? 'WhatsApp' : x.valeur) + '</a></li>'; }).join('') + (ad ? '<li>' + h.esc(ad.valeur) + '</li>' : '') + '</ul></div>' : '';
    const hor = K.aHoraires(spec, ctx) ? '<div><p class="xpc-k">Horaires</p>' + K.ouvert(spec, ctx) + K.horaires(spec, ctx) + '</div>' : '';
    return '<footer class="' + h.classes('pied.x-colonnes', bloc) + '"><div class="w"><div class="xpc"><div class="xpc-n">' + ctx.marque + '<p>' + h.esc(ctx.ligneMetier) + '</p></div>' + (liensPied(ctx, 'xpc-l') ? '<div><p class="xpc-k">Sur le site</p>' + liensPied(ctx, 'xpc-l') + '</div>' : '') + joindre + hor + '</div>' + ctx.basDePage + '</div></footer>';
  },
  css: function () { const c = 'r-pied-x-colonnes'; return `
.${c}{padding-block:clamp(48px,6vw,80px) clamp(24px,3vw,36px)}
.${c} .xpc{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,1fr));gap:28px clamp(24px,3vw,48px)}
.${c} .xpc-n{display:grid;gap:12px;align-content:start}.${c} .xpc-n p{color:var(--tx2);font-size:.95rem;max-width:32ch}
.${c} .xpc-k{font-size:.78rem;font-weight:var(--fxf);letter-spacing:.12em;text-transform:uppercase;color:var(--accT);margin-bottom:12px}
.${c} .xpc ul,.${c} .xpc-l{display:grid;gap:8px;font-size:.95rem}
.${c} .xpc a{text-decoration:none;overflow-wrap:anywhere}.${c} .xpc a:hover{text-decoration:underline}
.${c} .horaires{font-size:.9rem}.${c} .x-ouvert{font-size:.9rem;margin-bottom:6px}
@media(max-width:900px){.${c} .xpc{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.${c} .xpc{grid-template-columns:1fr}}
`; }
};
const pNom = {
  id: 'pied.x-nom', rubrique: 'pied', x: true, nom: 'Pied au grand nom clair', quand: 'un nom court : le nom de l\'entreprise en très grand, en teinte claire, sur toute la largeur, les liens et mentions dessous', surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec) { return K.net(spec.nom).length <= 22; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, n = K.net(spec.nom);
    return '<footer class="' + h.classes('pied.x-nom', bloc) + '"><div class="w"><div class="xpn-h">' + liensPied(ctx, 'xpn-l') + '<p class="xpn-m">' + h.esc(ctx.ligneMetier) + '</p></div><p class="xpn-n cq" aria-hidden="true"><span style="--hk:' + h.kUne(n, ctx.type) + '">' + h.esc(n) + '</span></p>' + ctx.basDePage + '</div></footer>';
  },
  css: function () { const c = 'r-pied-x-nom'; return `
.${c}{padding-block:clamp(48px,6vw,80px) clamp(24px,3vw,36px);overflow:hidden}
.${c} .xpn-h{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px 28px}
.${c} .xpn-l{display:flex;flex-wrap:wrap;gap:8px 24px;font-weight:var(--fxf)}
.${c} .xpn-l a{text-decoration:none}.${c} .xpn-l a:hover{text-decoration:underline}
.${c} .xpn-m{color:var(--tx2)}
.${c} .xpn-n{margin-top:clamp(28px,4vw,56px)}
.${c} .xpn-n span{display:block;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:min(14rem,calc(100cqi / var(--hk)));line-height:.86;white-space:nowrap;color:color-mix(in srgb,var(--accent) 16%,var(--bg))}
`; }
};

module.exports = [mosaique, pisteG, planche, note, ligne, faqCol, faqCentre, cSplit, cCarte, cPhoto, cTeinte, cColonnes, pSimple, pColonnes, pNom];
