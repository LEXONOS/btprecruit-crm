// Les hauts de page avec photo : ce que le prospect voit en ouvrant le lien. Chaque variante a sa mise en page, son
// entrée orchestrée (la photo se révèle, le titre monte mot à mot, la phrase et les boutons suivent en cascade) et son
// vrai traitement photo (arche, passe-partout, coupe en biais, planche, fondu enchaîné, lames, cercle, verre fumé...).
// Le grand titre se mesure avec --hk (h.k2 / h.kUne / h.k3) dans sa colonne : il ne déborde jamais. Le texte posé sur
// une photo se lit sur un voile fondé sur rgb(var(--voile)). Sur la surface « photo », l'en-tête est posé par-dessus :
// la variante réserve sa place en haut.
'use strict';

/* ── outils locaux ── */
// les photos encore libres, sans les prendre (la même règle que h.photos, sans effet : pour les besoins)
function libres(ctx, siennes) {
  const a = ctx.alloc || {}, svc = a.services || {};
  const pris = new Set([a.hero, a.apropos, a.bandeau].concat(Object.keys(svc).map(function (k) { return svc[k]; })).concat(ctx.prises || []).filter(Boolean));
  return (siennes ? (a.galerie || []) : (a.galerie || []).concat(a.reste || [])).filter(function (p) { return p && p.fichier && !pris.has(p); });
}
// prendre n photos libres pour le haut de page : les illustrations encore libres d'abord (aucune galerie ne les montre),
// puis ses photos à lui ; elles sont retenues (ctx.prises) comme le fait h.photos
function prendre(ctx, n) {
  const a = ctx.alloc || {}, l = libres(ctx);
  const ordre = l.filter(function (p) { return (a.reste || []).indexOf(p) >= 0; }).concat(l.filter(function (p) { return (a.reste || []).indexOf(p) < 0; })).slice(0, n);
  ctx.prises = (ctx.prises || []).concat(ordre);
  return ordre;
}
// la mesure du grand titre : deux lignes (un nom court tient sur une), trois en colonne étroite
function hk(ctx, lignes) {
  const h = ctx.h, t = ctx.textes.h1, ty = ctx.type, nom = ctx.mod.titres === 'nom';
  if (lignes === 3) return nom ? h.k2(t, ty) : h.k3(t, ty);
  return nom ? h.kUne(t, ty) : h.k2(t, ty);
}
// le grand titre (o.copie : son double décoratif, caché aux lecteurs d'écran)
function titre(ctx, o) {
  o = o || {};
  const b = o.copie ? 'p' : 'h1';
  return '<' + b + ' class="t h1' + (o.classe ? ' ' + o.classe : '') + '"' + (o.copie ? ' aria-hidden="true"' : '') + ' style="--hk:' + hk(ctx, o.lignes) + '" data-r="mots">' + ctx.h.mots(ctx.textes.h1, o.debut || 0) + '</' + b + '>';
}
// la fiche sans sa note Google, quand la variante la montre ailleurs en grand (pas deux fois la même preuve)
function sansNote(spec) { return Object.assign({}, spec, { google: null }); }
// le bloc de texte : titre, ligne du métier (quand le titre est le nom), phrase, boutons, confiance, en cascade
function texte(spec, ctx, o) {
  o = o || {};
  const h = ctx.h, tx = ctx.textes, i = o.i || 1;
  const sur = tx.sur && !o.sansSur ? '<p class="h-sur"' + h.rv('monte', i) + '>' + h.esc(tx.sur) + '</p>' : '';
  const h1 = o.sansTitre ? '' : titre(ctx, { lignes: o.lignes, debut: o.debut });
  const phrase = tx.phrase ? '<p class="h-phrase"' + h.rv('monte', i + 3) + '>' + h.esc(tx.phrase) + '</p>' : '';
  const b = h.boutons(spec, o.boutons);
  const act = b ? '<div class="h-act"' + h.rv('monte', i + 4) + '>' + b + '</div>' : '';
  const conf = o.confiance === false ? '' : '<div class="h-conf"' + h.rv('monte', i + 5) + '>' + h.confiance(o.sansNote ? sansNote(spec) : spec, o.conf) + '</div>';
  return (o.surAvant ? sur + h1 : h1 + sur) + phrase + act + conf;
}
// la note Google en petite carte (étoiles, note, nombre d'avis), lisible par tous
function carteNote(ctx, g, cls, i) {
  const h = ctx.h;
  return '<p class="' + cls + '"' + h.rv('monte', i) + '>' + h.etoiles(g.note) + '<span><b>' + h.esc(h.noteTexte(g)) + '</b> sur Google</span><span class="nb">' + h.esc(String(g.avis)) + ' avis</span></p>';
}
// le texte qui tourne en anneau (métier et commune, ou la note) : répété pour faire le tour, sans jamais se chevaucher
function anneau(texteBase, tour, taille, mini, maxi) {
  const base = texteBase.toUpperCase(), k = 0.86;
  const n = Math.max(1, Math.round(tour / (base.length * taille * k)));
  const fs = Math.max(mini || 7, Math.min(maxi || 11, tour / (n * base.length * k)));
  return { texte: new Array(n + 1).join(base), taille: fs.toFixed(2) };
}
// la souris donne de la profondeur (ordinateur seulement, arrêtée hors écran, jamais si le mouvement est réduit)
function scriptSouris(sel) {
  return "if(!calme&&w.matchMedia&&w.matchMedia('(hover:hover) and (pointer:fine)').matches){[].slice.call(d.querySelectorAll('" + sel + "')).forEach(function(s){var vis=true,tk=0,x=0,y=0;if('IntersectionObserver' in w){new IntersectionObserver(function(es){vis=es[0].isIntersecting}).observe(s)}var pose=function(){tk=0;s.style.setProperty('--mx',x.toFixed(3));s.style.setProperty('--my',y.toFixed(3))};s.addEventListener('pointermove',function(e){if(!vis)return;var r=s.getBoundingClientRect();x=(e.clientX-r.left)/r.width-.5;y=(e.clientY-r.top)/r.height-.5;if(!tk){tk=1;requestAnimationFrame(pose)}});s.addEventListener('pointerleave',function(){x=0;y=0;pose()})})}";
}
function lienServices(ctx) { const a = (ctx.ancres || []).find(function (x) { return x.id === 'services'; }); return a ? a.href : '#services'; }
function metierLieu(spec, ctx) {
  const h = ctx.h, m = ctx.textes.metier || h.net(spec.nom), c = h.net(spec.commune);
  return m + (c && m.indexOf(c) < 0 ? ' · ' + c : '') + ' · ';
}
// un bord festonné de pastille (n bosses, entre r1 et r2, centre c)
function festons(n, r1, r2, c) {
  const f = function (x) { return x.toFixed(2); };
  let d = '';
  for (let k = 0; k < n; k++) {
    const a0 = k / n * 2 * Math.PI, a1 = (k + 0.5) / n * 2 * Math.PI, a2 = (k + 1) / n * 2 * Math.PI;
    if (!k) d += 'M' + f(c + r1 * Math.cos(a0)) + ' ' + f(c + r1 * Math.sin(a0));
    d += 'Q' + f(c + r2 * Math.cos(a1)) + ' ' + f(c + r2 * Math.sin(a1)) + ' ' + f(c + r1 * Math.cos(a2)) + ' ' + f(c + r1 * Math.sin(a2));
  }
  return d + 'Z';
}

// la photo révélée (store, rideau, iris) : c'est son porteur, jamais masqué, que surveille le script des apparitions ;
// une cible entièrement masquée par clip-path n'est jamais vue « à l'écran » et resterait cachée pour toujours
function revele(type, i, contenu, cls, style) {
  return '<div class="rv rv-' + type + (cls ? ' ' + cls : '') + '" data-r="revele" style="--i:' + (i || 0) + ';' + (style || '') + '">' + contenu + '</div>';
}
// L'entrée est jouée en @keyframes à partir de « vu » : une transition déclenchée au chargement ne démarre pas
// toujours (Chrome la saute dans une partie des chargements dès qu'un module a mesuré la page avant le premier rendu),
// une animation démarre à chaque fois. Les transitions de la base restent : quand elles jouent, elles ont la main, avec
// les mêmes valeurs. Chaque variante a ses propres noms d'animation (k-hero-<nom>-...).
function cssEntree(c) {
  const k = 'k-hero-' + c.replace(/^\.r-hero-/, '') + '-', d = 'calc(var(--i,0) * var(--pas))';
  const a = function (sel, kf, dur, delai, ease) { return '.js ' + c + ' ' + sel + '{animation:' + k + kf + ' ' + dur + ' ' + (ease || 'var(--ease)') + ' ' + (delai || d) + ' backwards}'; };
  // (le mouvement est porté par ces animations : les décalages communs, translate et scale, s'effacent ici)
  return '.js ' + c + ' [data-r=monte],.js ' + c + ' [data-r=zoom],.js ' + c + ' [data-r=recul],.js ' + c + ' [data-r=mots] .m>span{translate:none;scale:none}' +
    '@keyframes ' + k + 'monte{from{opacity:0;transform:translate3d(0,var(--dy),0)}}' +
    '@keyframes ' + k + 'zoom{from{opacity:0;transform:scale(.92)}}' +
    '@keyframes ' + k + 'recul{from{opacity:0;transform:scale(1.08)}}' +
    '@keyframes ' + k + 'mot{from{transform:translate3d(0,105%,0)}}' +
    '@keyframes ' + k + 'store{from{clip-path:inset(100% -14% 0 -14%)}}' +
    '@keyframes ' + k + 'rideau{from{clip-path:inset(-14% 100% -14% 0)}}' +
    '@keyframes ' + k + 'iris{from{clip-path:circle(0% at 50% 50%)}}' +
    '@keyframes ' + k + 'img{from{transform:scale(1.14)}}' +
    a('[data-r=monte].vu', 'monte', 'var(--dur)') + a('[data-r=zoom].vu', 'zoom', 'var(--dur)') + a('[data-r=recul].vu', 'recul', 'calc(var(--dur) * 1.3)') +
    a('[data-r=mots].vu .m>span', 'mot', 'calc(var(--dur) * 1.1)', 'calc(var(--i,0) * 60ms + 80ms)') +
    // la photo révélée : son porteur (jamais masqué) reçoit « vu », la photo se découvre dedans
    '.js ' + c + ' [data-r=revele]{opacity:1}.js ' + c + ' [data-r=revele].vu{clip-path:none}' +
    c + ' .rv>.ph img{transition:transform 1.4s var(--ease)}' +
    '.js ' + c + ' .rv:not(.vu)>.ph img{transform:scale(1.14)}' +
    '.js ' + c + ' .rv-store>.ph,.js ' + c + ' .rv-rideau>.ph{clip-path:inset(-14% -14% -14% -14%)}' +
    '.js ' + c + ' .rv-store:not(.vu)>.ph{clip-path:inset(100% -14% 0 -14%)}.js ' + c + ' .rv-rideau:not(.vu)>.ph{clip-path:inset(-14% 100% -14% 0)}' +
    '.js ' + c + ' .rv-iris>.ph{clip-path:circle(75% at 50% 50%)}.js ' + c + ' .rv-iris:not(.vu)>.ph{clip-path:circle(0% at 50% 50%)}' +
    a('.rv-store.vu>.ph', 'store', 'calc(var(--dur) * 1.4)') + a('.rv-rideau.vu>.ph', 'rideau', 'calc(var(--dur) * 1.4)') + a('.rv-iris.vu>.ph', 'iris', 'calc(var(--dur) * 1.5)') + a('.rv.vu>.ph img', 'img', 'calc(var(--dur) * 2)') +
    '@media(prefers-reduced-motion:reduce){' + c + ' [data-r],' + c + ' [data-r] *,' + c + ' .rv>.ph{animation:none!important}' + c + ' .rv>.ph,' + c + ' .rv>.ph img{clip-path:none!important;transform:none!important}}';
}

/* ── la feuille commune du bloc de texte, posée sous la classe de chaque variante ── */
function cssTexte(c, o) {
  o = o || {};
  return `
${c} .h-txt{display:grid;gap:clamp(16px,2vw,24px);justify-items:${o.centre ? 'center' : 'start'};align-content:center;min-width:0;--hmax:${o.hmax || '5.2rem'}${o.centre ? ';text-align:center' : ''}}
${c} .h-sur{display:flex;align-items:center;gap:12px;font-weight:var(--fxf);font-size:1.04rem;line-height:1.35;color:var(--tx2);margin-top:calc(-.25 * clamp(16px,2vw,24px))}
${c} .h-sur::before{content:"";width:26px;height:2px;flex:none;background:var(--acc)}
${c} .h-phrase{font-size:clamp(1.06rem,1.3vw,1.22rem);line-height:1.55;max-width:46ch;color:var(--tx2)}
${c} .h-act{width:100%}
${o.centre ? `${c} .h-act .actions,${c} .h-conf .confiance{justify-content:center}${c} .h-sur::after{content:"";width:26px;height:2px;flex:none;background:var(--acc)}` : ''}
${o.photo ? `${c} .h1{text-shadow:0 2px 30px rgb(var(--voile) / .4)}${c} .h-phrase{color:rgb(255 255 255 / .92);text-shadow:0 1px 16px rgb(var(--voile) / .5)}${c} .h-conf .confiance{color:rgb(255 255 255 / .9)}` : ''}
`;
}
// le mouvement coupé pour qui le demande (les apparitions data-r le sont déjà par la base)
function calme(c, sel) { return '@media(prefers-reduced-motion:reduce){' + sel.split(',').map(function (s) { return c + ' ' + s.trim(); }).join(',') + '{animation:none!important;transition:none!important}}'; }

/* ══ 1. L'arche au soleil ══ */
const arche = {
  id: 'hero.arche', rubrique: 'hero', nom: 'Photo en arche et disque solaire',
  quand: 'beauté, mer, table, jardin : la photo dans une arche, un disque de couleur qui flotte derrière, un trait qui se dessine autour',
  familles: ['ecrin', 'horizon', 'comptoir', 'verdure', 'cabinet'], ambiances: ['calme', 'chaleureux', 'premium'],
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero, g = h.noteGoogle(spec);
    const vis = '<div class="ar-vis"><div class="ar-soleil" aria-hidden="true"' + h.rv('monte', 2) + '><i></i></div>' +
      '<svg class="ar-trait" viewBox="0 0 100 125" aria-hidden="true" focusable="false" data-r="trace"><path pathLength="1" d="M50 124H1V50A49 49 0 0 1 99 50V124Z"/></svg>' +
      revele('store', 0, h.figure(ph, 'eager', '(max-width:860px) 62vw, 470px', { classe: 'ar-ph' }), 'ar-porte') +
      (g ? carteNote(ctx, g, 'ar-note', 7) : '') + '</div>';
    return '<section class="' + h.classes('hero.arche', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="w ar"><div class="h-txt cq">' + texte(spec, ctx, { sansNote: !!g, debut: 2 }) + '</div>' + vis + '</div></section>';
  },
  css: function () {
    const c = '.r-hero-arche';
    return cssTexte(c, { hmax: '5.2rem' }) + cssEntree(c) + `
${c}{overflow:hidden}
${c} .ar-porte{position:relative;z-index:2}
${c} .ar{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(0,.94fr);gap:clamp(36px,6vw,100px);align-items:center;padding-block:clamp(44px,6vw,92px) clamp(64px,8vw,120px)}
${c} .ar-vis{position:relative;width:min(100%,470px);justify-self:center;margin:clamp(24px,3vw,44px) clamp(0px,4vw,60px) 0 0}
${c} .ar-ph{--ar:1.25;aspect-ratio:1/var(--ar);border-radius:50% 50% var(--rp) var(--rp)/calc(50% / var(--ar)) calc(50% / var(--ar)) var(--rp) var(--rp);box-shadow:var(--ombreF)}
${c} .ar-vis:hover .ar-ph img{transform:scale(1.04)}
${c} .ar-soleil{position:absolute;z-index:0;width:58%;aspect-ratio:1;right:-17%;top:-8%}
${c} .ar-soleil i{display:block;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 32% 30%,color-mix(in srgb,var(--acc) 58%,#fff) 0,var(--acc) 62%);box-shadow:0 30px 70px -30px color-mix(in srgb,var(--acc) 85%,transparent);animation:k-hero-arche-flotte 9s ease-in-out infinite alternate}
@keyframes k-hero-arche-flotte{from{translate:0 6px}to{translate:-6px -14px}}
${c} .ar-trait{position:absolute;z-index:1;left:-8%;top:6%;width:100%;height:auto;overflow:visible;fill:none;stroke:color-mix(in srgb,var(--tx) 50%,transparent);stroke-width:.42;stroke-linejoin:round}
.js ${c} .ar-trait[data-r]{opacity:1}
.js ${c} .ar-trait.vu{clip-path:none}
${c} .ar-trait path{stroke-dasharray:1;stroke-dashoffset:0}
.js ${c} .ar-trait:not(.vu) path{stroke-dashoffset:1}
.js ${c} .ar-trait.vu path{animation:k-hero-arche-trace 2.6s var(--ease2) .35s backwards}
@keyframes k-hero-arche-trace{from{stroke-dashoffset:1}}
${c} .ar-note{position:absolute;z-index:3;left:-13%;bottom:9%;display:grid;gap:3px;background:var(--carte);color:var(--tx);border:1px solid var(--bord);border-radius:var(--r);box-shadow:var(--ombreF);padding:13px 18px;font-size:.95rem;line-height:1.3}
${c} .ar-note b{font-family:var(--ft);font-weight:var(--tp);font-size:1.45rem;letter-spacing:var(--ti)}
${c} .ar-note .nb{color:var(--tx2)}
@media(max-width:860px){
${c} .ar{grid-template-columns:minmax(0,1fr);gap:clamp(30px,7vw,44px);padding-block:clamp(18px,4vw,36px) clamp(56px,12vw,84px)}
${c} .ar-vis{order:-1;width:min(60vw,290px);margin:14px auto 0}
${c} .ar-note{left:auto;right:-20%;bottom:5%;padding:10px 13px}
${c} .ar-note b{font-size:1.2rem}
}
` + calme(c, '.ar-soleil i,.ar-trait path');
  }
};

/* ══ 2. Le passe-partout ══ */
const cadre = {
  id: 'hero.cadre', rubrique: 'hero', nom: 'Photo encadrée, carte de texte',
  quand: 'toujours élégant avec une belle photo : la photo presque pleine page dans une marge, coins arrondis, filet intérieur, le texte sur une carte posée en bas à gauche',
  familles: [], ambiances: ['premium', 'calme', 'chaleureux'],
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero, g = h.noteGoogle(spec);
    const note = g ? '<p class="ca-note"' + h.rv('monte', 6) + '>' + h.etoiles(g.note) + '<span><b>' + h.esc(h.noteTexte(g)) + '</b> sur Google, ' + h.esc(String(g.avis)) + ' avis</span></p>' : '';
    return '<section class="' + h.classes('hero.cadre', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="ca"><div class="ca-cadre" data-r="cadre">' + h.figure(ph, 'eager', '100vw', { classe: 'ca-ph' }) + note + '</div><div class="ca-carte"' + h.rv('monte', 2) + '><div class="h-txt cq">' + texte(spec, ctx, { lignes: 3, sansNote: !!g, debut: 4, conf: { max: 2 } }) + '</div></div></div></section>';
  },
  css: function () {
    const c = '.r-hero-cadre';
    return cssTexte(c, { hmax: '4.5rem' }) + cssEntree(c) + `
${c} .ca{display:grid;padding:clamp(4px,.7vw,10px) clamp(10px,1.4vw,22px) clamp(10px,1.4vw,22px)}
${c} .ca-cadre,${c} .ca-carte{grid-area:1/1}
${c} .ca-cadre{position:relative;min-height:clamp(560px,calc(100svh - 112px),880px);border-radius:calc(var(--rp) * 1.4);overflow:hidden;background:rgb(var(--voile))}
${c} .ca-ph{position:absolute;inset:0;border-radius:0}
${c} .ca-cadre::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(200deg,transparent 35%,rgb(var(--voile) / .38) 100%)}
${c} .ca-cadre::after{content:"";position:absolute;inset:clamp(10px,1.2vw,16px);z-index:1;pointer-events:none;border:1px solid rgb(255 255 255 / .5);border-radius:max(0px,calc(var(--rp) * 1.4 - 10px))}
.js ${c} [data-r=cadre]{opacity:1;clip-path:inset(6% 5% 6% 5% round calc(var(--rp) * 1.4 + 8px))}
.js ${c} [data-r=cadre]:not(.vu) img{transform:scale(1.16)}
.js ${c} [data-r=cadre].vu{clip-path:inset(0 0 0 0 round calc(var(--rp) * 1.4));animation:k-hero-cadre-ouvre calc(var(--dur) * 1.6) var(--ease) backwards}
.js ${c} [data-r=cadre].vu img{animation:k-hero-cadre-photo calc(var(--dur) * 2.4) var(--ease) backwards}
@keyframes k-hero-cadre-ouvre{from{clip-path:inset(6% 5% 6% 5% round calc(var(--rp) * 1.4 + 8px))}}
@keyframes k-hero-cadre-photo{from{transform:scale(1.16)}}
${c} .ca-carte{align-self:end;justify-self:start;position:relative;z-index:2;width:min(560px,calc(100% - 2 * clamp(28px,4.4vw,70px)));margin:clamp(28px,4.4vw,70px);background:var(--carte);color:var(--tx);border-radius:var(--r);box-shadow:var(--ombreF);padding:clamp(26px,3vw,46px)}
${c} .ca-note{position:absolute;z-index:2;top:clamp(22px,2.6vw,36px);right:clamp(22px,2.6vw,36px);display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:999px;background:rgb(var(--voile) / .55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgb(255 255 255 / .22);color:#fff;font-size:.95rem;line-height:1.2}
${c} .ca-note b{font-weight:var(--fxf)}
${c} .ca-note .etoiles .vd .ic{fill:#fff}
@media(max-width:860px){
${c} .ca{display:block;padding:6px 10px 12px}
${c} .ca-cadre{min-height:0;aspect-ratio:4/4.3}
${c} .ca-carte{width:auto;justify-self:stretch;margin:-68px 10px 0;padding:clamp(22px,6vw,30px)}
${c} .ca-note{top:auto;bottom:84px;right:auto;left:22px;font-size:.92rem}
}
`;
  }
};

/* ══ 3. La coupe en biais ══ */
const diagonale = {
  id: 'hero.diagonale', rubrique: 'hero', nom: 'Photo coupée en biais',
  quand: 'artisans, garages, boutiques : le texte sur un aplat franc à gauche, la photo coupée en biais à droite, soulignée d\'une bande de couleur',
  familles: ['atelier', 'garage', 'boutique', 'cabinet'], ambiances: ['franc', 'premium'],
  surfaces: ['champ', 'fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.diagonale', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="bi-vis" data-r="biais"><div class="bi-bande" aria-hidden="true"></div>' + h.figure(ph, 'eager', '(max-width:860px) 100vw, 56vw', { classe: 'bi-ph' }) + '</div><div class="w bi-w"><div class="h-txt cq">' + texte(spec, ctx, { lignes: 3, debut: 3 }) + '</div></div></section>';
  },
  css: function () {
    const c = '.r-hero-diagonale';
    return cssTexte(c, { hmax: '5.6rem' }) + cssEntree(c) + `
${c}{overflow:hidden;min-height:clamp(580px,calc(100svh - 84px),860px);display:grid;align-items:center}
${c} .bi-vis{position:absolute;top:0;right:0;bottom:0;width:56%;--x1:27%;--x2:7%;--coupe0:polygon(100% 0,100% 0,100% 100%,100% 100%);--bande0:polygon(calc(var(--x1) - 34px) 0,calc(var(--x1) - 18px) 0,calc(var(--x1) - 18px) 0,calc(var(--x1) - 34px) 0)}
${c} .bi-ph{position:absolute;inset:0;border-radius:0;clip-path:polygon(var(--x1) 0,100% 0,100% 100%,var(--x2) 100%)}
${c} .bi-ph img{filter:saturate(1.06) contrast(1.04)}
${c} .bi-ph::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,rgb(var(--voile) / .5),rgb(var(--voile) / .08) 42%,transparent 70%)}
${c} .bi-bande{position:absolute;inset:0;background:var(--acc);clip-path:polygon(calc(var(--x1) - 34px) 0,calc(var(--x1) - 18px) 0,calc(var(--x2) - 18px) 100%,calc(var(--x2) - 34px) 100%)}
.js ${c} .bi-vis[data-r]{opacity:1}
.js ${c} .bi-vis.vu{clip-path:none}
.js ${c} .bi-vis:not(.vu) .bi-ph{clip-path:var(--coupe0)}
.js ${c} .bi-vis:not(.vu) .bi-ph img{transform:scale(1.16) translateX(6%)}
.js ${c} .bi-vis:not(.vu) .bi-bande{clip-path:var(--bande0)}
.js ${c} .bi-vis.vu .bi-ph{animation:k-hero-diagonale-coupe 1.3s var(--ease2) backwards}
.js ${c} .bi-vis.vu .bi-ph img{animation:k-hero-diagonale-photo 1.9s var(--ease) backwards}
.js ${c} .bi-vis.vu .bi-bande{animation:k-hero-diagonale-bande 1.1s var(--ease2) .55s backwards}
@keyframes k-hero-diagonale-coupe{from{clip-path:var(--coupe0)}}
@keyframes k-hero-diagonale-photo{from{transform:scale(1.16) translateX(6%)}}
@keyframes k-hero-diagonale-bande{from{clip-path:var(--bande0)}}
${c} .bi-w{position:relative;z-index:1;padding-block:clamp(56px,7vw,110px)}
${c} .bi-w .h-txt{width:min(560px,44%)}
@media(max-width:1100px) and (min-width:861px){${c} .bi-vis{width:52%}${c} .bi-w .h-txt{width:46%}}
@media(max-width:860px){
${c}{display:block;min-height:0}
${c} .bi-vis{position:relative;width:100%;aspect-ratio:4/3;--y:86%;--coupe0:polygon(0 0,100% 0,100% 0,0 0);--bande0:polygon(0 calc(100% - 8px),0 calc(100% - 8px),0 100%,0 100%)}
${c} .bi-ph{clip-path:polygon(0 0,100% 0,100% var(--y),0 100%)}
${c} .bi-ph::after{background:linear-gradient(0deg,rgb(var(--voile) / .35),transparent 45%)}
${c} .bi-bande{top:12px;bottom:-12px;clip-path:polygon(0 calc(100% - 8px),100% calc(var(--y) - 8px),100% var(--y),0 100%)}
${c} .bi-w{padding-block:clamp(34px,8vw,48px) clamp(56px,12vw,80px)}
${c} .bi-w .h-txt{width:auto}
}
` + calme(c, '.bi-ph,.bi-ph img,.bi-bande');
  }
};

/* ══ 4. La planche de trois photos ══ */
const collage = {
  id: 'hero.collage', rubrique: 'hero', nom: 'Collage de trois photos',
  quand: 'table, boutique, soins, sorties, avec au moins trois photos : trois photos en planche décalée qui arrivent l\'une après l\'autre, le texte à côté',
  familles: ['comptoir', 'boutique', 'ecrin', 'horizon', 'verdure'], ambiances: ['chaleureux', 'premium', 'franc'],
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero && libres(ctx).length >= 2; },
  script: scriptSouris('.r-hero-collage .co-vis'),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const autres = prendre(ctx, 2);
    if (autres.length < 2) return '';
    const vis = '<div class="co-vis">' + revele('store', 0, h.figure(ph, 'eager', '(max-width:860px) 70vw, 40vw'), 'co-a', '--z:.6') + revele('rideau', 4, h.figure(autres[0], 'eager', '(max-width:860px) 50vw, 26vw'), 'co-b', '--z:1.6') + revele('store', 7, h.figure(autres[1], 'eager', '(max-width:860px) 45vw, 22vw'), 'co-c', '--z:2.4') + '</div>';
    return '<section class="' + h.classes('hero.collage', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="w co"><div class="h-txt cq">' + texte(spec, ctx, { debut: 2 }) + '</div>' + vis + '</div></section>';
  },
  css: function () {
    const c = '.r-hero-collage';
    return cssTexte(c, { hmax: '5rem' }) + cssEntree(c) + `
${c}{overflow:hidden}
${c} .co{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:clamp(32px,5vw,84px);align-items:center;padding-block:clamp(40px,5.5vw,86px) clamp(60px,7.5vw,112px)}
${c} .co-vis{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:repeat(12,minmax(0,1fr));aspect-ratio:1/1.02;--bd:clamp(5px,.6vw,9px)}
${c} .co-vis>div{position:relative;min-height:0;display:grid;translate:calc(var(--mx,0) * var(--z) * -16px) calc(var(--my,0) * var(--z) * -12px);transition:translate 1s var(--ease)}
${c} .co-vis .ph{border:var(--bd) solid var(--bg);box-shadow:var(--ombre);border-radius:calc(var(--rp) + var(--bd));min-height:0}
${c} .co-vis .ph img{transition:transform 1.4s var(--ease)}
${c} .co-vis .ph:hover img{transform:scale(1.06)}
${c} .co-a{grid-column:2/10;grid-row:1/10;z-index:1}
${c} .co-b{grid-column:7/13;grid-row:6/12;z-index:2}
${c} .co-c{grid-column:1/6;grid-row:8/13;z-index:3}
@media(max-width:860px){
${c} .co{grid-template-columns:minmax(0,1fr);padding-block:clamp(28px,7vw,44px) clamp(56px,12vw,80px)}
${c} .co-vis{width:min(100%,520px);justify-self:center}
}
` + calme(c, '.co-vis>div');
  }
};

/* ══ 5. Le fondu enchaîné ══ */
// deux à quatre photos qui se relaient lentement (effet Ken Burns), en CSS : chaque photo a sa partition, la suivante
// apparaît par-dessus la précédente (jamais de creux de lumière), la dernière s'efface sur la première
const FONDU = { P: 6.6, F: 1.5, Z: 0.12 };
function cssFondu(c) {
  const P = FONDU.P, F = FONDU.F, Z = FONDU.Z;
  let out = '';
  [2, 3, 4].forEach(function (n) {
    const C = n * P;
    const pc = function (t) { return (Math.max(0, Math.min(C, t)) / C * 100).toFixed(3) + '%'; };
    const sc = function (t0, t) { return 'scale(' + (1 + Z * Math.max(0, t - t0) / (P + F)).toFixed(4) + ')'; };
    for (let k = 0; k < n; k++) {
      let kf = '';
      if (k === 0) {
        // visible de 0 à P (la suivante arrive par-dessus), réapparaît sous la dernière avant la fin du tour
        kf = '0%{opacity:1;transform:' + sc(-F, 0) + '}' + pc(P) + '{opacity:1;transform:' + sc(-F, P) + '}' + pc(P + 0.02) + '{opacity:0;transform:scale(1)}' + pc(C - F - 0.02) + '{opacity:0;transform:scale(1)}' + pc(C - F) + '{opacity:1;transform:scale(1)}100%{opacity:1;transform:' + sc(-F, 0) + '}';
      } else if (k < n - 1) {
        kf = '0%{opacity:0;transform:scale(1)}' + pc(k * P - F) + '{opacity:0;transform:scale(1)}' + pc(k * P) + '{opacity:1;transform:' + sc(k * P - F, k * P) + '}' + pc((k + 1) * P) + '{opacity:1;transform:' + sc(k * P - F, (k + 1) * P) + '}' + pc((k + 1) * P + 0.02) + '{opacity:0;transform:scale(1)}100%{opacity:0;transform:scale(1)}';
      } else {
        kf = '0%{opacity:0;transform:scale(1)}' + pc(k * P - F) + '{opacity:0;transform:scale(1)}' + pc(k * P) + '{opacity:1;transform:' + sc(k * P - F, k * P) + '}' + pc(C - F) + '{opacity:1;transform:' + sc(k * P - F, C - F) + '}100%{opacity:0;transform:' + sc(k * P - F, C) + '}';
      }
      out += '@keyframes k-hero-diaporama-n' + n + '-' + k + '{' + kf + '}';
      out += c + ' .di-scene.n' + n + ' .di-s:nth-child(' + (k + 1) + '){animation:k-hero-diaporama-n' + n + '-' + k + ' ' + C.toFixed(1) + 's linear infinite}';
    }
    // le fil de chaque photo se remplit pendant qu'elle est là
    out += '@keyframes k-hero-diaporama-fil-' + n + '{0%{transform:scaleX(0)}' + pc(P - 0.05) + '{transform:scaleX(1)}' + pc(P) + '{transform:scaleX(0)}100%{transform:scaleX(0)}}';
    out += c + ' .di-fils.n' + n + ' i::after{animation:k-hero-diaporama-fil-' + n + ' ' + C.toFixed(1) + 's linear infinite}';
    for (let k = 1; k < n; k++) out += c + ' .di-fils.n' + n + ' i:nth-child(' + (k + 1) + ')::after{animation-delay:' + (k * P - C).toFixed(1) + 's}';
  });
  return out;
}
const diaporama = {
  id: 'hero.diaporama', rubrique: 'hero', nom: 'Fondu enchaîné de photos',
  quand: 'lieux et ambiances avec deux photos ou plus (table, mer, soins, jardin) : les photos se relaient lentement en plein écran, le texte sur un voile en bas',
  familles: ['horizon', 'comptoir', 'ecrin', 'verdure', 'boutique'], ambiances: ['premium', 'calme', 'chaleureux'],
  surfaces: ['photo'], js: [], fonds: false,
  besoin: function (spec, ctx) { return !!ctx.alloc.hero && libres(ctx).length >= 1; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    const ph = [ctx.alloc.hero].concat(prendre(ctx, 3));
    const n = Math.min(4, ph.length);
    if (n < 2) return '';
    const imgs = ph.slice(0, n).map(function (p, k) { return h.figure(p, k ? 'lazy' : 'eager', '100vw', { classe: 'di-s' }); }).join('');
    const fils = '<div class="di-fils n' + n + '" aria-hidden="true"' + h.rv('monte', 1) + '>' + new Array(n + 1).join('<i></i>') + '</div>';
    return '<section class="' + h.classes('hero.diaporama', bloc, 'h') + '" aria-label="Présentation" data-defile><div class="di-scene n' + n + '"' + h.rv('recul') + '>' + imgs + '</div><div class="w di-w"><div class="h-txt cq">' + fils + texte(spec, ctx, { debut: 2 }) + '</div></div></section>';
  },
  css: function () {
    const c = '.r-hero-diaporama';
    return cssTexte(c, { hmax: '5.8rem', photo: true }) + cssEntree(c) + `
${c}{overflow:hidden;color:#fff;min-height:clamp(620px,96svh,980px);display:grid;align-items:end}
${c} .di-scene{position:absolute;inset:0;z-index:-2;background:rgb(var(--voile))}
${c} .di-s{position:absolute;inset:0;border-radius:0;opacity:0;background:transparent;will-change:opacity,transform}
${c} .di-s:first-child{opacity:1}
${c} .di-s:nth-child(1){transform-origin:30% 40%}${c} .di-s:nth-child(2){transform-origin:70% 60%}${c} .di-s:nth-child(3){transform-origin:45% 80%}${c} .di-s:nth-child(4){transform-origin:80% 25%}
${c}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(0deg,rgb(var(--voile) / .94) 0%,rgb(var(--voile) / .62) 34%,rgb(var(--voile) / .12) 64%,rgb(var(--voile) / .3) 100%),linear-gradient(90deg,rgb(var(--voile) / .55),transparent 62%)}
${c} .di-w{padding-block:clamp(130px,14vw,180px) clamp(84px,11vh,126px)}
${c} .di-w .h-txt{max-width:720px}
${c} .di-fils{display:flex;gap:8px;margin-bottom:4px}
${c} .di-fils i{position:relative;display:block;width:clamp(34px,3.4vw,48px);height:3px;border-radius:3px;background:rgb(255 255 255 / .3);overflow:hidden}
${c} .di-fils i::after{content:"";position:absolute;inset:0;background:#fff;transform-origin:left;transform:scaleX(0)}
${c} .di-fils i:first-child::after{transform:scaleX(1)}
${c}.arret .di-s,${c}.arret .di-fils i::after{animation-play-state:paused}
${cssFondu(c)}
@media(max-width:860px){${c}{min-height:clamp(560px,88svh,780px)}${c} .di-w{padding-block:120px 96px}}
@media(prefers-reduced-motion:reduce){${c} .di-s,${c} .di-fils i::after{animation:none!important}${c} .di-s:not(:first-child){opacity:0}${c} .di-fils{display:none}}
`;
  }
};

/* ══ 6. Le titre géant qui passe sur la photo ══ */
const geant = {
  id: 'hero.geant', rubrique: 'hero', nom: 'Titre géant qui passe sur la photo',
  quand: 'un titre court et fort (métier, nom) : il prend toute la largeur, plein sur l\'aplat et en contour sur la photo qu\'il traverse',
  familles: [], ambiances: ['franc', 'premium', 'chaleureux'],
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero && ctx.h.net(ctx.textes.h1).length <= 44; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const suite = texte(spec, ctx, { sansTitre: true, i: 3 });
    return '<section class="' + h.classes('hero.geant', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="w ge cq">' + titre(ctx, { classe: 'ge-plein', debut: 5 }) + revele('rideau', 0, h.figure(ph, 'eager', '(max-width:860px) 100vw, 50vw'), 'ge-ph') + titre(ctx, { classe: 'ge-trait', copie: true, debut: 5 }) + '<div class="ge-txt">' + suite + '</div></div></section>';
  },
  css: function (ctx) {
    const c = '.r-hero-geant';
    const fine = !!(ctx && ctx.type && Number(ctx.type.poids) < 600);
    return cssTexte(c, { hmax: '5rem' }) + cssEntree(c) + `
${c}{overflow:hidden}
${c} .ge{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:auto auto 1fr;column-gap:var(--cg);--cg:clamp(14px,2vw,28px);padding-block:clamp(36px,4.6vw,72px) clamp(56px,7vw,104px)}
${c} .ge .h1{--hmax:10.5rem;grid-column:1/-1;grid-row:1;align-self:start;margin-top:clamp(26px,3.4vw,56px);line-height:.92}
${c} .ge-plein{z-index:1}
${c} .ge-trait{z-index:3;color:transparent;-webkit-text-stroke:max(1.5px,.016em) #fff;pointer-events:none;-webkit-user-select:none;user-select:none}
${c} .ge-trait,.js ${c} .ge-trait.vu{clip-path:inset(-30% -4% -30% calc(50% + var(--cg) / 2));filter:drop-shadow(0 2px 14px rgb(var(--voile) / .45))}
${c} .ge-ph{grid-column:7/-1;grid-row:1/4;z-index:2;position:relative;display:grid;min-height:clamp(500px,72vh,760px)}
${c} .ge-ph>.ph{border-radius:var(--rp);box-shadow:var(--ombreF)}
${c} .ge-ph>.ph::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgb(var(--voile) / .72),rgb(var(--voile) / .3) 46%,transparent 80%),linear-gradient(180deg,rgb(var(--voile) / .45),rgb(var(--voile) / .2) 40%,transparent 62%)}
${fine ? `${c} .ge-trait{color:#fff;-webkit-text-stroke:0}` : ''}
${c} .ge-txt{grid-column:1/7;grid-row:2;display:grid;gap:clamp(16px,2vw,24px);justify-items:start;align-content:start;padding:clamp(26px,3vw,46px) clamp(0px,2vw,30px) 0 0;max-width:560px}
${c} .ge-txt .h-sur{margin-top:0}
@media(max-width:860px){
${c} .ge{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;padding-block:clamp(14px,4vw,28px) clamp(56px,12vw,80px)}
${c} .ge-ph{grid-column:1;grid-row:1;min-height:0;aspect-ratio:4/3.4}
${c} .ge-ph>.ph::after{background:linear-gradient(0deg,rgb(var(--voile) / .86),rgb(var(--voile) / .35) 34%,transparent 64%)}
${c} .ge .h1{grid-column:1;grid-row:2;margin-top:-.6em}
${c} .ge-trait{color:#fff;-webkit-text-stroke:0}
${c} .ge-trait,.js ${c} .ge-trait.vu{clip-path:inset(-30% -4% calc(100% - .6em) -4%)}
${c} .ge-txt{grid-column:1;grid-row:3;padding:clamp(20px,5vw,30px) 0 0}
}
`;
  }
};

/* ══ 7. Le grand angle qui s'ouvre ══ */
const panorama = {
  id: 'hero.panorama', rubrique: 'hero', nom: 'Titre centré, panorama qui s\'ouvre',
  quand: 'paysages, salles, terrasses : le titre centré en haut, une large photo panoramique dessous qui se déroule puis s\'élargit jusqu\'aux bords quand on descend',
  familles: ['horizon', 'comptoir', 'verdure', 'ecrin', 'cabinet'], ambiances: ['calme', 'premium', 'chaleureux'],
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.panorama', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="w pa-t"><div class="h-txt cq">' + texte(spec, ctx, { surAvant: true }) + '</div></div><div class="pa-vis">' + revele('store', 3, h.figure(ph, 'eager', '100vw', { classe: 'pa-ph' }), 'pa-cadre') + '</div></section>';
  },
  script: "var pv=[].slice.call(d.querySelectorAll('.r-hero-panorama .pa-vis'));if(!calme&&pv.length){pv.forEach(function(e){var vis=true,tk=0,y0=0;var mesurer=function(){y0=e.getBoundingClientRect().top+(w.scrollY||0)};var maj=function(){tk=0;if(!vis)return;var h=w.innerHeight||800,fin=Math.max(160,y0-h*.14),p=(w.scrollY||0)/fin;e.style.setProperty('--p',Math.max(0,Math.min(1,p)).toFixed(3))};if('IntersectionObserver' in w){new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)maj()}).observe(e)}w.addEventListener('scroll',function(){if(!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});w.addEventListener('resize',function(){mesurer();maj()});mesurer();maj()})}",
  css: function () {
    const c = '.r-hero-panorama';
    return cssTexte(c, { hmax: '6.2rem', centre: true }) + cssEntree(c) + `
${c}{overflow:hidden}
${c} .pa-t{padding-block:clamp(44px,6vw,96px) clamp(36px,4.6vw,70px)}
${c} .pa-t .h-txt{max-width:1000px;margin-inline:auto}
${c} .pa-t .h-sur{margin:0}
${c} .pa-vis{--p:0;--m:max(var(--g),calc((100% - var(--w)) / 2));--rr:min(calc(var(--rp) * 1.6),40px);clip-path:inset(0 calc((1 - var(--p)) * var(--m)) 0 calc((1 - var(--p)) * var(--m)) round calc((1 - var(--p)) * var(--rr)))}
${c} .pa-cadre{position:relative;aspect-ratio:21/9;min-height:340px;max-height:78vh;width:100%;overflow:hidden}
${c} .pa-ph{position:absolute;inset:-8% 0;border-radius:0;transform:translate3d(0,calc(var(--p) * -5%),0)}
${c} .pa-cadre::after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 120px 10px rgb(var(--voile) / .28)}
@media(max-width:860px){
${c} .pa-t{padding-block:clamp(22px,6vw,40px) clamp(30px,7vw,40px)}
${c} .pa-cadre{aspect-ratio:4/3.5;min-height:0}
}
`;
  }
};

/* ══ 8. Le verre fumé ══ */
const verre = {
  id: 'hero.verre', rubrique: 'hero', nom: 'Photo plein écran, carte en verre fumé',
  quand: 'soins, sorties, cabinets, tables : la photo en plein écran et le texte sur une carte en verre dépoli, un reflet qui passe à l\'arrivée',
  familles: ['ecrin', 'horizon', 'cabinet', 'comptoir', 'verdure'], ambiances: ['premium', 'calme'],
  surfaces: ['photo'], js: ['parallaxe'], fonds: false,
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.verre', bloc, 'h') + '" aria-label="Présentation"><div class="ve-img" data-px="0.14">' + h.figure(ph, 'eager', '100vw', { attrs: h.rv('recul') }) + '</div><div class="w ve-w"><div class="ve-carte"' + h.rv('monte') + '><div class="h-txt cq">' + texte(spec, ctx, { lignes: 3, debut: 3 }) + '</div></div></div></section>';
  },
  css: function () {
    const c = '.r-hero-verre';
    return cssTexte(c, { hmax: '4.6rem', photo: true }) + cssEntree(c) + `
${c}{overflow:hidden;color:#fff;min-height:clamp(640px,96svh,960px);display:grid;align-items:center}
${c} .ve-img{position:absolute;inset:-9% 0;z-index:-2;background:rgb(var(--voile))}
${c} .ve-img .ph{height:100%;border-radius:0}
${c}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(90deg,rgb(var(--voile) / .5),rgb(var(--voile) / .12) 62%,transparent)}
${c} .ve-w{padding-block:clamp(124px,13vw,176px) clamp(72px,9vw,120px)}
${c} .ve-carte{position:relative;width:min(620px,100%);padding:clamp(26px,3.2vw,48px);border-radius:calc(var(--r) * 1.5 + 4px);overflow:hidden;border:1px solid transparent;background:linear-gradient(140deg,rgb(var(--voile) / .64),rgb(var(--voile) / .5)) padding-box,linear-gradient(140deg,rgb(255 255 255 / .55),rgb(255 255 255 / .08) 38%,rgb(255 255 255 / .06) 62%,rgb(255 255 255 / .34)) border-box;-webkit-backdrop-filter:blur(20px) saturate(1.35);backdrop-filter:blur(20px) saturate(1.35);box-shadow:inset 0 1px 0 rgb(255 255 255 / .18),0 50px 90px -50px rgb(0 0 0 / .75)}
${c} .ve-carte::after{content:"";position:absolute;inset:-40%;pointer-events:none;background:linear-gradient(100deg,transparent 44%,rgb(255 255 255 / .2) 50%,transparent 56%);transform:translateX(-62%)}
.js ${c} .ve-carte.vu::after{animation:k-hero-verre-reflet 2.4s var(--ease) .7s 1 both}
@keyframes k-hero-verre-reflet{to{transform:translateX(62%)}}
${c} .ve-carte .b2{border-color:rgb(255 255 255 / .6)}
@media(max-width:860px){
${c}{min-height:clamp(600px,92svh,860px);align-items:end}
${c} .ve-w{padding-block:116px 92px}
${c} .ve-carte{padding:clamp(22px,6vw,30px)}
}
` + calme(c, '.ve-carte::after');
  }
};

/* ══ 9. Le cercle et son anneau de texte ══ */
const cercle = {
  id: 'hero.cercle', rubrique: 'hero', nom: 'Photo ronde, anneau de texte qui tourne',
  quand: 'beauté, table, fleurs, jardin : la photo dans un grand cercle, le métier et la commune écrits en anneau qui tourne lentement autour',
  familles: ['ecrin', 'comptoir', 'verdure', 'boutique', 'horizon'], ambiances: ['chaleureux', 'calme', 'premium'],
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const a = anneau(metierLieu(spec, ctx), 553, 9.4, 7, 11);
    const svg = '<svg class="ce-anneau" viewBox="0 0 200 200" aria-hidden="true" focusable="false"' + h.rv('zoom', 2) + '><defs><path id="hero-cercle-c" d="M100 100m-88 0a88 88 0 1 1 176 0a88 88 0 1 1-176 0"/></defs><circle class="ce-fil" cx="100" cy="100" r="99"/><g class="ce-tour"><text style="font-size:' + a.taille + 'px"><textPath href="#hero-cercle-c" textLength="550" lengthAdjust="spacing">' + h.esc(a.texte) + '</textPath></text></g></svg>';
    const pastille = '<span class="ce-pastille" aria-hidden="true"' + h.rv('zoom', 8) + '>' + h.icone(ctx.iconeMetier) + '</span>';
    return '<section class="' + h.classes('hero.cercle', bloc, 'h') + '" aria-label="Présentation" data-defile>' + h.fond(bloc) + '<div class="w ce"><div class="h-txt cq">' + texte(spec, ctx, { debut: 2 }) + '</div><div class="ce-vis">' + svg + revele('iris', 0, h.figure(ph, 'eager', '(max-width:860px) 70vw, 460px'), 'ce-ph') + pastille + '</div></div></section>';
  },
  css: function () {
    const c = '.r-hero-cercle';
    return cssTexte(c, { hmax: '5.2rem' }) + cssEntree(c) + `
${c}{overflow:hidden}
${c} .ce{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,5vw,90px);align-items:center;padding-block:clamp(40px,5.5vw,86px) clamp(60px,7.5vw,112px)}
${c} .ce-vis{position:relative;width:min(100%,560px);aspect-ratio:1;justify-self:center}
${c} .ce-anneau{position:absolute;inset:0;width:100%;height:100%;overflow:visible;color:var(--tx)}
${c} .ce-anneau text{font-family:var(--fx);font-weight:var(--fxf);letter-spacing:.18em;fill:currentColor}
${c} .ce-fil{fill:none;stroke:color-mix(in srgb,var(--tx) 22%,transparent);stroke-width:.5}
${c} .ce-tour{transform-box:view-box;transform-origin:50% 50%;animation:k-hero-cercle-tourne 60s linear infinite}
@keyframes k-hero-cercle-tourne{to{transform:rotate(360deg)}}
${c}.arret .ce-tour{animation-play-state:paused}
${c} .ce-ph{position:absolute;inset:12.5%;display:grid}
${c} .ce-ph>.ph{border-radius:50%;box-shadow:var(--ombreF)}
${c} .ce-vis:hover .ce-ph img{transform:scale(1.05)}
${c} .ce-pastille{position:absolute;left:4%;bottom:9%;width:21%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:var(--btn);color:var(--btnT);box-shadow:var(--ombre)}
${c} .ce-pastille .ic{width:40%;height:40%}
@media(max-width:860px){
${c} .ce{grid-template-columns:minmax(0,1fr);padding-block:clamp(20px,5vw,36px) clamp(56px,12vw,80px)}
${c} .ce-vis{order:-1;width:min(80vw,380px)}
}
` + calme(c, '.ce-tour');
  }
};

/* ══ 10. Les lames ══ */
const lames = {
  id: 'hero.lames', rubrique: 'hero', nom: 'Photo découpée en lames',
  quand: 'artisans, garages, boutiques, cabinets : la photo découpée en quatre lames verticales qui se révèlent l\'une après l\'autre, et bougent sous la souris',
  familles: ['atelier', 'garage', 'boutique', 'cabinet', 'horizon'], ambiances: ['franc', 'premium'],
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const une = h.img(ph, 'eager', '(max-width:860px) 100vw, 55vw');
    const copie = une.replace(/ alt="[^"]*"/, ' alt=""').replace(' fetchpriority="high"', '');
    const ls = [0, 1, 2, 3].map(function (k) { return '<div class="la-l" style="--k:' + k + '"' + (k ? ' aria-hidden="true"' : '') + '>' + (k ? copie : une) + '</div>'; }).join('');
    return '<section class="' + h.classes('hero.lames', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="w la"><div class="h-txt cq">' + texte(spec, ctx, { debut: 3 }) + '</div><div class="la-vis" data-r="lames">' + ls + '</div></div></section>';
  },
  css: function () {
    const c = '.r-hero-lames';
    return cssTexte(c, { hmax: '5.2rem' }) + cssEntree(c) + `
${c}{overflow:hidden}
${c} .la{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:clamp(32px,5vw,88px);align-items:center;padding-block:clamp(40px,5.5vw,86px) clamp(64px,8vw,120px)}
${c} .la-vis{position:relative;aspect-ratio:1/1.08;--n:4;--gap:clamp(6px,.7vw,10px)}
.js ${c} .la-vis[data-r]{opacity:1}
.js ${c} .la-vis.vu{clip-path:none}
${c} .la-l{position:absolute;inset:0;--a:calc(var(--k) * 100% / var(--n));--b:calc((var(--n) - 1 - var(--k)) * 100% / var(--n));--d:calc(var(--k) * 120ms + 100ms);clip-path:inset(0 calc(var(--b) + var(--gap) / 2) 0 calc(var(--a) + var(--gap) / 2) round var(--rp));translate:0 var(--y,0);transition:translate 1s var(--ease)}
${c} .la-l:nth-child(2){--y:5%}${c} .la-l:nth-child(3){--y:2%}${c} .la-l:nth-child(4){--y:7%}
${c} .la-vis:hover .la-l{--y:3.5%}
${c} .la-l img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
${c} .la-l::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgb(0 0 0 / .12),transparent 18%,transparent 82%,rgb(255 255 255 / .1))}
.js ${c} .la-vis:not(.vu) .la-l{clip-path:inset(100% calc(var(--b) + var(--gap) / 2) 0 calc(var(--a) + var(--gap) / 2) round var(--rp))}
.js ${c} .la-vis:not(.vu) .la-l:nth-child(even){clip-path:inset(0 calc(var(--b) + var(--gap) / 2) 100% calc(var(--a) + var(--gap) / 2) round var(--rp))}
.js ${c} .la-vis:not(.vu) .la-l img{transform:scale(1.2)}
.js ${c} .la-vis.vu .la-l{animation:k-hero-lames-lame 1.3s var(--ease2) var(--d) backwards}
.js ${c} .la-vis.vu .la-l:nth-child(even){animation-name:k-hero-lames-lame2}
.js ${c} .la-vis.vu .la-l img{animation:k-hero-lames-photo 1.9s var(--ease) var(--d) backwards}
@keyframes k-hero-lames-lame{from{clip-path:inset(100% calc(var(--b) + var(--gap) / 2) 0 calc(var(--a) + var(--gap) / 2) round var(--rp))}}
@keyframes k-hero-lames-lame2{from{clip-path:inset(0 calc(var(--b) + var(--gap) / 2) 100% calc(var(--a) + var(--gap) / 2) round var(--rp))}}
@keyframes k-hero-lames-photo{from{transform:scale(1.2)}}
@media(max-width:860px){
${c} .la{grid-template-columns:minmax(0,1fr);padding-block:clamp(16px,4vw,30px) clamp(56px,12vw,80px)}
${c} .la-vis{order:-1;aspect-ratio:4/3.6;--gap:6px}
${c} .la-l:nth-child(2){--y:3%}${c} .la-l:nth-child(3){--y:1%}${c} .la-l:nth-child(4){--y:4%}
}
` + calme(c, '.la-l,.la-l img');
  }
};

/* ══ 11. La photo qui recule ══ */
const recul = {
  id: 'hero.recul', rubrique: 'hero', nom: 'Photo plein écran qui recule au défilement',
  quand: 'une belle photo large : plein écran à l\'arrivée, elle recule et s\'arrondit en carte dans la page quand on descend, le texte s\'efface doucement',
  familles: [], ambiances: ['premium', 'calme', 'franc'],
  surfaces: ['photo'], js: [], fonds: false,
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.recul', bloc, 'h') + '" aria-label="Présentation"><div class="re-scene">' + h.figure(ph, 'eager', '100vw', { classe: 're-ph', attrs: h.rv('recul') }) + '</div><div class="w re-w"><div class="h-txt cq">' + texte(spec, ctx, { debut: 2 }) + '</div></div></section>';
  },
  script: "var rs=[].slice.call(d.querySelectorAll('.r-hero-recul'));if(!calme&&rs.length){rs.forEach(function(s){var vis=true,tk=0;var maj=function(){tk=0;if(!vis)return;var r=s.getBoundingClientRect(),p=-r.top/Math.max(1,r.height*.8);s.style.setProperty('--p',Math.max(0,Math.min(1,p)).toFixed(3))};if('IntersectionObserver' in w){new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)maj()}).observe(s)}w.addEventListener('scroll',function(){if(!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});w.addEventListener('resize',maj);maj()})}",
  css: function () {
    const c = '.r-hero-recul';
    return cssTexte(c, { hmax: '6.4rem', photo: true }) + cssEntree(c) + `
${c}{--p:0;overflow:hidden;color:#fff;background:var(--fond);min-height:clamp(620px,100svh,1000px);display:grid;align-items:center}
${c} .re-scene{position:absolute;inset:0;z-index:-1;overflow:hidden;background:rgb(var(--voile));transform-origin:50% 0;transform:translate3d(0,calc(var(--p) * 6vh),0) scale(calc(1 - var(--p) * .1));border-radius:calc(var(--p) * min(calc(var(--rp) * 1.8),48px));will-change:transform}
${c} .re-ph{position:absolute;inset:0;border-radius:0;background:transparent}
${c} .re-scene::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(90deg,rgb(var(--voile) / .86) 0%,rgb(var(--voile) / .62) 40%,rgb(var(--voile) / .14) 78%),linear-gradient(180deg,rgb(var(--voile) / .45),transparent 24%,transparent 72%,rgb(var(--voile) / .4))}
${c} .re-w{position:relative;padding-block:clamp(130px,14vw,190px) clamp(80px,10vw,130px);transform:translate3d(0,calc(var(--p) * -3vh),0);opacity:calc(1 - var(--p) * .55)}
${c} .re-w .h-txt{max-width:700px}
@media(max-width:860px){${c}{min-height:clamp(600px,94svh,860px);align-items:end}${c} .re-w{padding-block:120px 96px}${c} .re-scene::after{background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(0deg,rgb(var(--voile) / .92),rgb(var(--voile) / .55) 50%,rgb(var(--voile) / .3))}}
`;
  }
};

/* ══ 12. La profondeur : plusieurs plans, l'emblème du métier dessiné en grand ══ */
const profondeur = {
  id: 'hero.profondeur', rubrique: 'hero', nom: 'Plans en profondeur, emblème du métier',
  quand: 'artisans, garages, sorties, jardins : photo plein écran, voile, l\'emblème du métier dessiné en grand trait, et le texte, qui glissent à des vitesses différentes (défilement et souris)',
  familles: ['atelier', 'garage', 'horizon', 'verdure', 'cabinet'], ambiances: ['franc', 'premium'],
  surfaces: ['photo'], js: ['parallaxe'], fonds: false,
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const forme = h.icone(ctx.iconeMetier, 'pr-forme').replace('<svg ', '<svg data-r="trace" ').replace(/<(path|circle|rect)\b/g, '<$1 pathLength="1"');
    return '<section class="' + h.classes('hero.profondeur', bloc, 'h') + '" aria-label="Présentation">' +
      '<div class="pr-plan pr-p0" data-px="0.24"><div class="pr-souris" style="--z:.5">' + h.figure(ph, 'eager', '100vw', { attrs: h.rv('recul') }) + '</div></div>' +
      '<div class="pr-voile" aria-hidden="true"></div>' +
      '<div class="pr-plan pr-p1" data-px="-0.12" aria-hidden="true"><div class="pr-souris" style="--z:2.2">' + forme + '</div></div>' +
      '<div class="pr-plan pr-p2" data-px="0.06" aria-hidden="true"><div class="pr-souris" style="--z:1.2"><i class="pr-anneau"' + h.rv('zoom', 3) + '></i></div></div>' +
      '<div class="w pr-w"><div class="h-txt cq pr-souris" style="--z:.35">' + texte(spec, ctx, { debut: 2 }) + '</div></div></section>';
  },
  script: scriptSouris('.r-hero-profondeur'),
  css: function () {
    const c = '.r-hero-profondeur';
    return cssTexte(c, { hmax: '6rem', photo: true }) + cssEntree(c) + `
${c}{overflow:hidden;color:#fff;min-height:clamp(640px,98svh,980px);display:grid;align-items:center}
${c} .pr-plan{position:absolute;inset:0;pointer-events:none}
${c} .pr-p0{inset:-12% 0;z-index:-3;background:rgb(var(--voile))}
${c} .pr-p0 .pr-souris,${c} .pr-p0 .ph{height:100%}
${c} .pr-p0 .ph{border-radius:0;background:transparent}
${c} .pr-souris{translate:calc(var(--mx,0) * var(--z) * -26px) calc(var(--my,0) * var(--z) * -18px);transition:translate 1.1s var(--ease)}
${c} .pr-voile{position:absolute;inset:0;z-index:-2;pointer-events:none;background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(90deg,rgb(var(--voile) / .88),rgb(var(--voile) / .6) 42%,rgb(var(--voile) / .2) 80%),linear-gradient(180deg,rgb(var(--voile) / .45),transparent 26%,transparent 70%,rgb(var(--voile) / .55))}
${c} .pr-p1{z-index:-1}
${c} .pr-p1 .pr-souris{position:absolute;right:max(var(--g),calc((100% - var(--w)) / 2));top:50%;width:min(46vw,620px);aspect-ratio:1;margin-top:calc(min(46vw,620px) / -2)}
${c} .pr-forme{width:100%;height:100%;overflow:visible;fill:none;stroke:#fff;stroke-width:.075;stroke-linecap:round;stroke-linejoin:round;opacity:.62;filter:drop-shadow(0 0 18px rgb(255 255 255 / .25))}
.js ${c} .pr-forme[data-r]{opacity:.62}
.js ${c} .pr-forme.vu{clip-path:none;filter:drop-shadow(0 0 18px rgb(255 255 255 / .25))}
${c} .pr-forme *{stroke-dasharray:1;stroke-dashoffset:0}
.js ${c} .pr-forme:not(.vu) *{stroke-dashoffset:1}
.js ${c} .pr-forme.vu *{animation:k-hero-profondeur-trace 3s var(--ease2) .45s backwards}
@keyframes k-hero-profondeur-trace{from{stroke-dashoffset:1}}
${c} .pr-p2{z-index:-1}
${c} .pr-p2 .pr-souris{position:absolute;right:calc(max(var(--g),calc((100% - var(--w)) / 2)) - min(8vw,110px));bottom:-14%;width:min(64vw,880px);aspect-ratio:1}
${c} .pr-anneau{display:block;width:100%;height:100%;border-radius:50%;border:1px solid rgb(255 255 255 / .28);box-shadow:inset 0 0 0 clamp(18px,2.4vw,34px) rgb(255 255 255 / .03)}
${c} .pr-w{position:relative;padding-block:clamp(130px,14vw,190px) clamp(80px,10vw,130px)}
${c} .pr-w .h-txt{max-width:680px}
@media(max-width:860px){
${c}{min-height:clamp(600px,94svh,860px);align-items:end}
${c} .pr-w{padding-block:120px 96px}
${c} .pr-voile{background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(0deg,rgb(var(--voile) / .92),rgb(var(--voile) / .5) 55%,rgb(var(--voile) / .34))}
${c} .pr-p1 .pr-souris{right:-12vw;top:96px;margin-top:0;width:72vw}
${c} .pr-p2 .pr-souris{right:-40vw;bottom:auto;top:0;width:110vw}
}
` + calme(c, '.pr-forme *,.pr-souris');
  }
};

/* ══ 13. L'étiquette : un bloc de couleur, la photo, une pastille qui roule ══ */
const etiquette = {
  id: 'hero.etiquette', rubrique: 'hero', nom: 'Bloc de couleur, photo et pastille qui tourne',
  quand: 'boutiques, tables, fleurs : un bloc de couleur franc et la photo côte à côte, une pastille festonnée posée à la jointure, avec la note Google si elle existe, qui roule quand on descend',
  familles: ['boutique', 'comptoir', 'verdure', 'atelier'], ambiances: ['franc', 'chaleureux'],
  surfaces: ['champ', 'accent'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero, g = h.noteGoogle(spec);
    const base = g ? 'Noté ' + h.noteTexte(g) + ' sur Google · ' + g.avis + ' avis · ' : metierLieu(spec, ctx);
    const a = anneau(base, 465, 13, 9, 14);
    const label = g ? ' role="img" aria-label="' + h.esc('Noté ' + h.noteTexte(g) + ' sur 5 sur Google, ' + g.avis + ' avis') + '"' : ' aria-hidden="true"';
    const coeur = g ? '<span class="et-coeur"><b>' + h.esc(h.noteTexte(g)) + '</b>' + h.etoiles(g.note) + '</span>' : '<span class="et-coeur">' + h.icone(ctx.iconeMetier) + '</span>';
    const pastille = '<div class="et-pastille"' + label + h.rv('zoom', 7) + '><div class="et-roule"><svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><defs><path id="hero-etiquette-c" d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0"/></defs><path class="et-bord" d="' + festons(26, 91, 101, 100) + '"/><circle class="et-fil" cx="100" cy="100" r="60"/><text style="font-size:' + a.taille + 'px"><textPath href="#hero-etiquette-c" textLength="463" lengthAdjust="spacing">' + h.esc(a.texte) + '</textPath></text></svg></div>' + coeur + '</div>';
    return '<section class="' + h.classes('hero.etiquette', bloc, 'h') + '" aria-label="Présentation" data-defile>' + h.fond(bloc) + '<div class="et-vis">' + revele('rideau', 0, h.figure(ph, 'eager', '(max-width:860px) 100vw, 50vw'), 'et-ph') + pastille + '</div><div class="w et-w"><div class="h-txt cq">' + texte(spec, ctx, { lignes: 3, sansNote: !!g, debut: 2 }) + '</div></div></section>';
  },
  script: "var ep=[].slice.call(d.querySelectorAll('.r-hero-etiquette .et-roule'));if(!calme&&ep.length){var ev=true,et=0;if('IntersectionObserver' in w){new IntersectionObserver(function(es){ev=es[0].isIntersecting}).observe(ep[0])}var roule=function(){et=0;if(!ev)return;var y=w.scrollY||0;ep.forEach(function(e){e.style.setProperty('--rot',(y*.18).toFixed(1)+'deg')})};w.addEventListener('scroll',function(){if(!et){et=1;requestAnimationFrame(roule)}},{passive:true})}",
  css: function () {
    const c = '.r-hero-etiquette';
    return cssTexte(c, { hmax: '5rem' }) + cssEntree(c) + `
${c}{overflow:hidden;min-height:clamp(560px,calc(100svh - 84px),860px);display:grid;align-items:center}
${c} .et-vis{position:absolute;top:0;right:0;bottom:0;width:50%;z-index:1}
${c} .et-ph{position:absolute;inset:0;display:grid}
${c} .et-ph>.ph{border-radius:0}
${c} .et-w{position:relative;z-index:2;padding-block:clamp(56px,7vw,110px)}
${c} .et-w .h-txt{width:calc(50% - clamp(40px,5vw,90px))}
${c} .et-pastille{--t:clamp(150px,14.5vw,212px);position:absolute;z-index:3;left:0;top:clamp(48px,12%,110px);width:var(--t);aspect-ratio:1;margin-left:calc(var(--t) / -2);color:var(--btnT)}
${c} .et-pastille,.js ${c} .et-pastille.vu{filter:drop-shadow(0 18px 30px rgb(0 0 0 / .28))}
${c} .et-roule{position:absolute;inset:0;rotate:var(--rot,0deg);transition:rotate .5s var(--ease)}
${c} .et-roule svg{width:100%;height:100%;display:block;animation:k-hero-etiquette-tourne 40s linear infinite}
@keyframes k-hero-etiquette-tourne{to{transform:rotate(360deg)}}
${c}.arret .et-roule svg{animation-play-state:paused}
${c} .et-bord{fill:var(--btn)}
${c} .et-fil{fill:none;stroke:currentColor;stroke-width:.8;opacity:.35}
${c} .et-pastille text{font-family:var(--fx);font-weight:var(--fxf);letter-spacing:.16em;fill:currentColor}
${c} .et-coeur{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:4px;text-align:center}
${c} .et-coeur b{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-size:calc(var(--t) * .22);line-height:.9}
${c} .et-coeur .etoiles .ic{width:calc(var(--t) * .075);height:calc(var(--t) * .075)}
${c} .et-coeur .etoiles .pl .ic{fill:currentColor}
${c} .et-coeur .etoiles .vd .ic{fill:currentColor;opacity:.3}
${c} .et-coeur>.ic{width:calc(var(--t) * .3);height:calc(var(--t) * .3);stroke-width:1.5}
@media(max-width:860px){
${c}{display:block;min-height:0}
${c} .et-vis{position:relative;width:100%;aspect-ratio:4/3}
${c} .et-pastille{--t:clamp(128px,34vw,150px);left:auto;right:14px;top:auto;bottom:calc(var(--t) / -2);margin-left:0}
${c} .et-w{padding-block:calc(clamp(128px,34vw,150px) / 2 + 14px) clamp(56px,12vw,80px)}
${c} .et-w .h-txt{width:auto}
}
` + calme(c, '.et-roule,.et-roule svg');
  }
};

/* ══ 14. La vitrine : la photo du haut et les services qui ont une photo ══ */
const vitrine = {
  id: 'hero.vitrine', rubrique: 'hero', nom: 'Photo plein écran et trois services en vitrine',
  quand: 'trois services avec chacun sa photo : la grande photo, le texte sur un voile, et une bande de trois vignettes de services posées à cheval sur le bas de la photo',
  familles: ['atelier', 'garage', 'horizon', 'boutique', 'verdure', 'cabinet'], ambiances: ['franc', 'calme', 'chaleureux'],
  surfaces: ['photo'], js: ['parallaxe'], fonds: false,
  besoin: function (spec, ctx) { const s = ctx.h.servicesDe(spec); return !!ctx.alloc.hero && s.filter(function (x, k) { return ctx.alloc.services[k]; }).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero, sv = h.servicesDe(spec);
    const avec = [];
    sv.forEach(function (s, k) { if (ctx.alloc.services[k] && avec.length < 3) avec.push({ s: s, p: ctx.alloc.services[k] }); });
    if (avec.length < 3) return '';
    const lien = lienServices(ctx);
    const cartes = avec.map(function (x, k) { return '<li' + h.rv('monte', 6 + k) + '><a class="vi-c" href="' + h.esc(lien) + '">' + h.figure(x.p, 'lazy', '(max-width:860px) 30vw, 380px', { classe: 'vi-ph' }) + '<span class="vi-t">' + h.esc(h.net(x.s.titre)) + '</span><span class="vi-f" aria-hidden="true">' + h.icone('fleche') + '</span></a></li>'; }).join('');
    return '<section class="' + h.classes('hero.vitrine', bloc, 'h') + '" aria-label="Présentation"><div class="vi-haut"><div class="vi-img" data-px="0.1">' + h.figure(ph, 'eager', '100vw', { attrs: h.rv('recul') }) + '</div><div class="w vi-w"><div class="h-txt cq">' + texte(spec, ctx, { debut: 2 }) + '</div></div></div><div class="w vi-bas"><ul class="vi-liste" aria-label="' + h.esc(ctx.textes.services) + '">' + cartes + '</ul></div></section>';
  },
  css: function () {
    const c = '.r-hero-vitrine';
    return cssTexte(c, { hmax: '5.6rem', photo: true }) + cssEntree(c) + `
${c}{background:var(--fond);color:#fff;padding-bottom:clamp(30px,4vw,56px)}
${c} .vi-haut{position:relative;isolation:isolate;overflow:hidden;min-height:clamp(560px,80svh,820px);display:grid;align-items:center;background:rgb(var(--voile))}
${c} .vi-img{position:absolute;inset:-8% 0;z-index:-2}
${c} .vi-img .ph{height:100%;border-radius:0;background:transparent}
${c} .vi-haut::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(90deg,rgb(var(--voile) / .9) 0%,rgb(var(--voile) / .66) 40%,rgb(var(--voile) / .16) 80%),linear-gradient(180deg,rgb(var(--voile) / .45),transparent 24%,transparent 70%,rgb(var(--voile) / .5))}
${c} .vi-w{padding-block:clamp(126px,13vw,176px) clamp(96px,10vw,132px)}
${c} .vi-w .h-txt{max-width:690px}
${c} .vi-bas{position:relative;z-index:2;margin-top:calc(-1 * clamp(50px,4.4vw,62px))}
${c} .vi-liste{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.6vw,22px);--tx:var(--encre);--tx2:var(--doux)}
${c} .vi-c{display:grid;grid-template-columns:clamp(84px,8vw,118px) minmax(0,1fr) auto;align-items:center;gap:16px;padding:8px;min-height:44px;background:var(--fond);color:var(--encre);border:1px solid var(--ligne);border-radius:calc(var(--r) + 6px);box-shadow:var(--ombreF);text-decoration:none;transition:transform .6s var(--ease),box-shadow .6s var(--ease)}
${c} .vi-ph{aspect-ratio:4/3.1;border-radius:var(--r)}
${c} .vi-ph img{transition:transform 1.2s var(--ease)}
${c} .vi-t{font-weight:var(--fxf);font-size:1.06rem;line-height:1.3}
${c} .vi-f{width:40px;height:40px;margin-right:6px;display:grid;place-items:center;border-radius:50%;background:var(--teinte);color:var(--teinteT);transition:transform .5s var(--ease),background-color .3s,color .3s}
@media(hover:hover){${c} .vi-c:hover{transform:translateY(-6px)}${c} .vi-c:hover .vi-ph img{transform:scale(1.07)}${c} .vi-c:hover .vi-f{transform:translateX(3px);background:var(--accent);color:var(--surA)}}
@media(max-width:860px){
${c} .vi-haut{min-height:clamp(560px,86svh,800px);align-items:end}
${c} .vi-haut::before{background:linear-gradient(180deg,rgb(var(--voile) / .62),rgb(var(--voile) / .24) 96px,transparent 190px),linear-gradient(0deg,rgb(var(--voile) / .94),rgb(var(--voile) / .6) 55%,rgb(var(--voile) / .34))}
${c} .vi-w{padding-block:120px 110px}
${c} .vi-bas{margin-top:-64px}
${c} .vi-liste{grid-template-columns:minmax(0,1fr);gap:10px}
${c} .vi-c{grid-template-columns:84px minmax(0,1fr) auto;gap:14px}
${c} .vi-ph{aspect-ratio:1}
}
`;
  }
};

module.exports = [arche, cadre, diagonale, collage, diaporama, geant, panorama, verre, cercle, lames, recul, profondeur, etiquette, vitrine];
