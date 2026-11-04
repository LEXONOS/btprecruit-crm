// La présentation (rubrique apropos) : qui, quoi, où, dans le texte de l'entreprise (spec.a_propos, 140 à 260
// caractères). Jamais de citation prêtée à une personne : le texte est celui de l'entreprise, présenté comme tel.
// Neuf mises en scène : deux photos décalées, texte qui s'éclaire au défilement, arche, lieu en grand, carte sur photo
// en parallaxe, page de magazine, collage, bande sombre que la photo déborde, présentation et atouts réunis.
'use strict';
const MQ = require('../../martinique');

/* ── outils de la rubrique ── */
function titreDe(ctx, bloc) { return (bloc && bloc.titre) || ctx.mod.textes.apropos; }
function texteDe(spec, h) { return h.net(spec.a_propos); }
function aTexte(spec, ctx) { return texteDe(spec, ctx.h).length >= 40; }

// les faits sûrs posés sous le texte : le lieu, la note Google, la façon de joindre
function faits(spec, h) {
  const g = h.noteGoogle(spec), c = spec.contact || {};
  const out = [{ ic: 'pin', t: h.lieuCourt(spec) + (h.zoneClient(spec) || !spec.commune ? '' : ', en Martinique') }];
  if (g) out.push({ ic: 'etoile', t: 'Noté ' + h.noteTexte(g) + ' sur 5 par ' + g.avis + ' clients sur Google' });
  if (h.waHref(c.mobile || c.tel)) out.push({ ic: 'whatsapp', t: 'Joignable par téléphone et sur WhatsApp' });
  else if (c.tel) out.push({ ic: 'tel', t: 'Joignable par téléphone au ' + MQ.affiche(c.tel) });
  else if (c.email) out.push({ ic: 'mail', t: 'Joignable par email' });
  return out;
}
function coches(spec, h) {
  return '<ul class="coches">' + faits(spec, h).map(function (x) { return '<li><span class="ci">' + h.icone(x.ic) + '</span><span>' + h.esc(x.t) + '</span></li>'; }).join('') + '</ul>';
}
// le bloc de texte commun : le titre, le texte de l'entreprise, ses faits, le bouton principal
function corps(spec, ctx, bloc, o) {
  o = o || {};
  const h = ctx.h;
  return '<h2 class="t">' + h.esc(titreDe(ctx, bloc)) + '</h2><p class="grand">' + h.esc(texteDe(spec, h)) + '</p>' + (o.coches === false ? '' : coches(spec, h)) + h.boutons(spec, { seule: true });
}
// le système d'apparitions pose clip-path:inset(0) sur tout élément apparu : pour celles qui ne découpent pas (monte,
// zoom...), on le retire, sinon il rogne les ombres, anneaux et décors qui débordent de l'élément
function sansCoupe(c) { return ['monte', 'zoom', 'recul', 'gauche', 'droite', 'flou'].map(function (t) { return c + ' [data-r=' + t + '].vu'; }).join(',') + '{clip-path:none}\n'; }
function cssCorps(c) {
  return sansCoupe(c) + `
${c} .tx{display:grid;gap:clamp(18px,2vw,24px);justify-items:start;align-content:center;min-width:0}
${c} .grand{font-size:clamp(1.1rem,1.4vw,1.25rem);line-height:1.65;color:var(--tx2);max-width:54ch;text-wrap:pretty}
${c} .coches{display:grid;gap:12px;margin-block:2px}
${c} .coches li{display:flex;gap:12px;align-items:center;line-height:1.4}
${c} .coches .ci{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:var(--rb);background:color-mix(in srgb,var(--acc) 14%,transparent);color:var(--accT)}
${c} .coches .ci .ic{width:18px;height:18px}
`;
}

// les photos déjà placées ailleurs sur la page
function prises(ctx) {
  const a = ctx.alloc || {};
  const sv = a.services || {};
  return new Set([a.hero, a.apropos, a.bandeau].concat(Object.keys(sv).map(function (k) { return sv[k]; })).concat(ctx.prises || []).filter(Boolean));
}
// combien de photos la présentation peut prendre en plus de la sienne, sans en voler à la galerie (qui en garde trois)
function libres(ctx) {
  const pris = prises(ctx), a = ctx.alloc || {};
  const reste = (a.reste || []).filter(function (p) { return !pris.has(p); }).length;
  const gal = (a.galerie || []).filter(function (p) { return !pris.has(p); }).length;
  return reste + (gal >= 2 ? Math.max(0, gal - 3) : gal);
}
// les photos prises en plus : les illustrations libres d'abord, puis les siennes en fin de galerie (retirées de la galerie
// pour qu'elle ne les montre pas une seconde fois) ; jamais une photo qu'une galerie déjà rendue a pu montrer ; le même
// choix sur toutes les pages du site
function enPlus(ctx, cle, n) {
  ctx.photosPresentation = ctx.photosPresentation || {};
  if (ctx.photosPresentation[cle]) return ctx.photosPresentation[cle];
  const pris = prises(ctx), a = ctx.alloc || {};
  let out = (a.reste || []).filter(function (p) { return !pris.has(p); }).slice(0, n);
  const galerieVue = Array.from(ctx.utilisees || []).some(function (id) { return /^galerie\./.test(id); });
  if (out.length < n && !galerieVue && Array.isArray(a.galerie)) {
    const gal = a.galerie.filter(function (p) { return !pris.has(p); });
    const avecGalerie = ((ctx.compo && ctx.compo.blocs) || []).some(function (b) { return b.rubrique === 'galerie'; });
    const dispo = avecGalerie ? gal.slice(Math.min(gal.length, 3)).reverse() : gal;
    const pris2 = dispo.slice(0, n - out.length);
    out = out.concat(pris2);
    if (avecGalerie && pris2.length) a.galerie = a.galerie.filter(function (p) { return pris2.indexOf(p) < 0; });
  }
  ctx.prises = (ctx.prises || []).concat(out);
  ctx.photosPresentation[cle] = out;
  return out;
}

/* ── 1. deux photos superposées, cadres décalés ── */
const aproposDouble = {
  id: 'apropos.double', rubrique: 'apropos', nom: 'Deux photos superposées',
  quand: 'deux photos ou plus (lieu, gestes, matières) : une grande et une petite qui la chevauche, deux cadres qui se décalent, un léger relief au défilement ; le texte et ses faits à côté',
  familles: [], ambiances: ['chaleureux', 'premium', 'franc', 'calme'], surfaces: ['fond', 'surface'], js: ['parallaxe'],
  besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!ctx.alloc.apropos && libres(ctx) >= 1; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p1 = ctx.alloc.apropos;
    if (!p1) return '';
    const p2 = enPlus(ctx, 'apropos.double', 1)[0];
    const vis = '<div class="ad-vis' + (p2 ? '' : ' seule') + '"><div class="ad-a" data-px="0.04">' + h.figure(p1, 'lazy', '(max-width:860px) 90vw, 42vw', { attrs: h.rv('rideau') }) + '<span class="ad-cadre" aria-hidden="true"></span></div>' +
      (p2 ? '<div class="ad-b" data-px="-0.1">' + h.figure(p2, 'lazy', '(max-width:860px) 50vw, 24vw', { attrs: h.rv('store', 4) }) + '<span class="ad-cadre" aria-hidden="true"></span></div>' : '') + '</div>';
    return '<section class="' + h.classes('apropos.double', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w ad">' + vis + '<div class="tx"' + h.rv('monte', 2) + '>' + corps(spec, ctx, bloc) + '</div></div></section>';
  },
  css: function () { return cssCorps('.r-apropos-double') + `
.r-apropos-double .ad{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(40px,6vw,104px);align-items:center}
.r-apropos-double .ad-vis{position:relative;padding:clamp(18px,2.2vw,30px) 0 clamp(64px,9vw,120px) clamp(18px,2.2vw,30px)}
.r-apropos-double .ad-a,.r-apropos-double .ad-b{isolation:isolate}
.r-apropos-double .ad-a{position:relative;width:76%}
.r-apropos-double .ad-a,.r-apropos-double .ad-b{border-radius:var(--rp);transition:box-shadow .8s ease .3s}
.r-apropos-double .ad-a{box-shadow:var(--ombreF)}
.r-apropos-double .ad-a .ph{aspect-ratio:4/5}
.r-apropos-double .ad-b{position:absolute;right:clamp(14px,2vw,26px);bottom:0;width:48%;z-index:2}
.r-apropos-double .ad-b{box-shadow:0 0 0 clamp(6px,.8vw,10px) var(--bg),var(--ombreF)}
.r-apropos-double .ad-b .ph{aspect-ratio:1/1}
.js .r-apropos-double .ad-a:has(.ph:not(.vu)),.js .r-apropos-double .ad-b:has(.ph:not(.vu)){box-shadow:none}
.r-apropos-double .ad-cadre{position:absolute;inset:0;z-index:-1;border:2px solid var(--acc);border-radius:var(--rp);transform:translate(calc(-1 * clamp(14px,1.8vw,26px)),calc(-1 * clamp(14px,1.8vw,26px)));transition:transform 1.3s var(--ease) .45s,opacity .7s ease .45s}
.r-apropos-double .ad-b .ad-cadre{background:color-mix(in srgb,var(--acc) 16%,transparent);border-color:transparent;transform:translate(clamp(12px,1.6vw,22px),clamp(12px,1.6vw,22px))}
.js .r-apropos-double .ph:not(.vu)~.ad-cadre{transform:none;opacity:0}
.r-apropos-double .ph img{transition:transform 1.2s var(--ease)}
.r-apropos-double .ad-vis:hover .ad-a img{transform:scale(1.04)}
.r-apropos-double .ad-vis.seule{padding-bottom:clamp(18px,2.2vw,30px)}.r-apropos-double .ad-vis.seule .ad-a{width:92%}
@media(max-width:860px){.r-apropos-double .ad{grid-template-columns:1fr}.r-apropos-double .ad-vis{max-width:560px}}
@media(prefers-reduced-motion:reduce){.r-apropos-double .ad-cadre{transition:none}}
`; }
};

/* ── 2. le texte en grand, dont les mots s'éclairent au défilement ── */
const aproposRevele = {
  id: 'apropos.revele', rubrique: 'apropos', nom: 'Texte qui s\'éclaire au défilement',
  quand: 'toujours possible, avec ou sans photo : le texte de présentation en très grand, ses mots s\'allument un à un pendant qu\'on descend ; idéal pour une marque qui a une voix (conseil, soins, table)',
  familles: [], ambiances: ['calme', 'premium', 'chaleureux', 'franc'], surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return aTexte(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec);
    const mots = texteDe(spec, h).split(' ').filter(Boolean).map(function (m) { return '<span class="mt">' + h.esc(m) + '</span>'; }).join(' ');
    const lieu = spec.commune ? '<p class="ar-lieu">' + h.icone('pin') + '<span>' + h.esc(spec.commune) + ', Martinique</span></p>' : '';
    const note = g ? '<p class="ar-note">' + h.etoiles(g.note) + '<span><b>' + h.noteTexte(g) + '</b> sur Google, ' + g.avis + ' avis</span></p>' : '';
    return '<section class="' + h.classes('apropos.revele', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w"><div class="ar-tete"' + h.rv('monte') + '><h2 class="t">' + h.esc(titreDe(ctx, bloc)) + '</h2>' + lieu + '</div><p class="ar-texte" data-revele>' + mots + '</p><div class="ar-pied"' + h.rv('monte', 1) + '>' + note + h.boutons(spec, { seule: true }) + '</div></div></section>';
  },
  // les mots s'allument selon la place du texte dans l'écran ; sans script ou en mouvement réduit, tout est lisible
  script: `
var rvs=[].slice.call(d.querySelectorAll('.r-apropos-revele [data-revele]'));
if(rvs.length&&!calme&&'IntersectionObserver' in w){rvs.forEach(function(p){var ms=[].slice.call(p.querySelectorAll('.mt')),n=ms.length,vu=false,tk=0,der=-1;
var maj=function(){tk=0;var r=p.getBoundingClientRect(),hh=w.innerHeight||1,de=d.documentElement;var k=(hh*.9-r.top)/(r.height+hh*.25);if(w.scrollY+hh>=de.scrollHeight-4)k=1;k=k<0?0:k>1?1:k;var c=Math.round(k*n);if(c===der)return;der=c;for(var i=0;i<n;i++){ms[i].classList.toggle('on',i<c);ms[i].classList.toggle('vif',i<c&&i>=c-3&&c<n)}};
p.classList.add('ok');new IntersectionObserver(function(es){vu=es[0].isIntersecting;if(vu)maj()},{rootMargin:'15% 0px'}).observe(p);
w.addEventListener('scroll',function(){if(vu&&!tk){tk=1;requestAnimationFrame(maj)}},{passive:true});w.addEventListener('resize',function(){der=-1;maj()});maj()})}`,
  css: function (ctx) {
    const ty = ctx.type || {}, ech = Math.max(0.78, Math.min(1.2, 0.5 / (ty.chasse || 0.5))) * (ty.casse === 'uppercase' ? 0.9 : 1);
    return sansCoupe('.r-apropos-revele') + `
.r-apropos-revele .ar-tete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px 32px;padding-bottom:clamp(20px,2.4vw,30px);margin-bottom:clamp(30px,4vw,56px);border-bottom:1px solid var(--bord)}
.r-apropos-revele .ar-lieu{display:flex;align-items:center;gap:8px;color:var(--tx2);font-weight:var(--fxf)}
.r-apropos-revele .ar-lieu .ic{color:var(--accT)}
.r-apropos-revele .ar-tete h2.t{font-size:clamp(1.35rem,2vw,1.85rem);line-height:1.1}
.r-apropos-revele .ar-texte{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(${(1.6 * ech).toFixed(2)}rem,calc(${(1.05 * ech).toFixed(2)}rem + ${(3.3 * ech).toFixed(2)}vw),${(4.3 * ech).toFixed(2)}rem);line-height:1.08;max-width:19em;text-wrap:pretty;overflow-wrap:break-word;hyphens:manual}
.r-apropos-revele .mt{transition:color .5s ease,opacity .5s ease}
.r-apropos-revele .ar-texte.ok .mt{opacity:.2}
.r-apropos-revele .ar-texte.ok .mt.on{opacity:1}
.r-apropos-revele .ar-texte.ok .mt.vif{color:var(--accT)}
.r-apropos-revele .ar-pied{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px 40px;margin-top:clamp(36px,5vw,64px)}
.r-apropos-revele .ar-note{display:flex;align-items:center;gap:12px;color:var(--tx2)}
.r-apropos-revele .ar-note b{color:var(--tx);font-size:1.15rem}
.r-apropos-revele .ar-note .etoiles .ic{width:18px;height:18px}
@media(max-width:600px){.r-apropos-revele .ar-pied .actions{width:100%}}
@media(prefers-reduced-motion:reduce){.r-apropos-revele .ar-texte .mt{opacity:1!important;transition:none}}
`;
  }
};

/* ── 3. la photo en arche, un trait qui la dessine ── */
const aproposArche = {
  id: 'apropos.arche', rubrique: 'apropos', nom: 'Photo en arche',
  quand: 'une photo douce (lieu, mer, soin, table, jardin) : la photo dans une arche qu\'un trait dessine, l\'image glisse dedans au défilement, un disque de couleur flotte',
  familles: ['ecrin', 'comptoir', 'horizon', 'verdure', 'boutique', 'cabinet'], ambiances: ['chaleureux', 'premium', 'calme'], surfaces: ['surface', 'fond'], js: ['parallaxe', 'defile'],
  besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!ctx.alloc.apropos; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = ctx.alloc.apropos;
    if (!p) return '';
    const trait = '<svg class="aa-trait" viewBox="0 0 100 124" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M1.2 124V50.2a48.8 48.8 0 0 1 97.6 0V124"/></svg>';
    const vis = '<div class="aa-vis" data-defile><figure class="ph aa-ph"' + h.rv('store') + '><div class="aa-px" data-px="0.09">' + h.img(p, 'lazy', '(max-width:860px) 80vw, 36vw') + '</div></figure>' + trait + '<span class="aa-disque" aria-hidden="true"></span></div>';
    return '<section class="' + h.classes('apropos.arche', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w aa"><div class="tx"' + h.rv('monte', 1) + '>' + corps(spec, ctx, bloc) + '</div>' + vis + '</div></section>';
  },
  css: function () { return cssCorps('.r-apropos-arche') + `
.r-apropos-arche .aa{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.92fr);gap:clamp(40px,7vw,120px);align-items:center}
.r-apropos-arche .aa-vis{position:relative;isolation:isolate;justify-self:center;width:min(100%,470px);padding:clamp(12px,1.5vw,20px);--arche:50% 50% var(--rp) var(--rp)/40% 40% var(--rp) var(--rp)}
.r-apropos-arche .aa-vis::before{content:"";position:absolute;inset:clamp(12px,1.5vw,20px);z-index:-1;border-radius:var(--arche);box-shadow:var(--ombreF);transition:opacity 1s ease .4s}
.js .r-apropos-arche .aa-vis:has(.aa-ph:not(.vu))::before{opacity:0}
.r-apropos-arche .aa-trait{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.r-apropos-arche .aa-trait path{fill:none;stroke:var(--acc);stroke-width:.55;stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset 2.2s var(--ease2) .3s}
.js .r-apropos-arche .aa-ph:not(.vu)~.aa-trait path{stroke-dashoffset:1}
.r-apropos-arche .aa-ph{aspect-ratio:4/5;border-radius:var(--arche);transform:translateZ(0)}
.r-apropos-arche .aa-px{position:absolute;inset:-11% 0}
.r-apropos-arche .aa-px img{width:100%;height:100%;object-fit:cover}
.r-apropos-arche .aa-disque{position:absolute;right:-5%;top:8%;width:clamp(64px,8vw,112px);aspect-ratio:1;border-radius:50%;background:var(--acc);box-shadow:inset -10px -12px 24px -10px rgb(0 0 0 / .22),0 22px 40px -22px color-mix(in srgb,var(--acc) 80%,transparent);animation:k-apropos-arche-flotte 7s ease-in-out infinite}
.js .r-apropos-arche .aa-ph:not(.vu)~.aa-disque{scale:.4;opacity:0}
.r-apropos-arche .aa-disque{transition:scale 1.1s var(--ease) .9s,opacity .6s ease .9s}
.r-apropos-arche .arret .aa-disque{animation-play-state:paused}
@keyframes k-apropos-arche-flotte{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@media(max-width:860px){.r-apropos-arche .aa{grid-template-columns:1fr}.r-apropos-arche .aa-vis{order:-1;width:min(84%,380px)}}
@media(prefers-reduced-motion:reduce){.r-apropos-arche .aa-disque{animation:none}.r-apropos-arche .aa-trait path{transition:none}}
`; }
};

/* ── 4. le lieu : une épingle, la commune en très grand ── */
// quatre courbes de niveau emboîtées, chacune à sa façon (une île, pas une cible), autour de l'épingle (200, 150)
const COURBES = [
  'M44 162C30 100 86 40 166 44c62 4 96-24 152 6 54 30 58 92 36 128-26 44-90 78-170 72-76-6-128-34-140-88z',
  'M92 160c-10-46 30-88 88-86 42 1 70-20 110 2 36 20 40 64 22 92-20 30-66 52-120 48-54-4-92-22-100-56z',
  'M134 156c-6-30 18-56 58-56 28 0 48-12 72 4 22 14 24 42 10 60-14 18-44 30-78 26-34-4-56-14-62-34z',
  'M168 152c-3-16 10-30 32-30 16 0 26-6 38 2 11 7 12 22 4 31-8 10-24 15-42 13-18-2-29-6-32-16z'
];
function decouperCommune(c) {
  const m = String(c || '').match(/^(Les|Le|La|L')\s*(.+)$/i);
  return m && m[2] ? { art: m[1], nom: m[2] } : { art: '', nom: String(c || '') };
}
const aproposLieu = {
  id: 'apropos.lieu', rubrique: 'apropos', nom: 'Le lieu en grand',
  quand: 'une entreprise attachée à sa commune (commerce, table, artisan du coin, sortie au départ d\'un port) : une épingle qui tombe sur des courbes de niveau, le nom de la commune en très grand, le texte à côté ; aucune carte externe',
  familles: [], ambiances: ['franc', 'chaleureux', 'calme', 'premium'], surfaces: ['surface', 'fond'], js: ['defile'],
  besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!ctx.h.net(spec.commune); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, z = h.zoneClient(spec), cm = decouperCommune(h.net(spec.commune));
    const courbes = COURBES.map(function (d, k) { return '<path pathLength="1" style="--k:' + k + '" d="' + d + '"/>'; }).join('');
    const carte = '<div class="al-carte"' + h.rv('monte') + ' data-defile aria-hidden="true"><svg class="al-courbes" viewBox="0 0 400 300">' + courbes + '</svg><span class="al-onde"></span><span class="al-onde o2"></span><svg class="al-pin" viewBox="0 0 48 64"><path d="M24 2.5C12.1 2.5 3 11.6 3 23.3c0 15.4 21 38.2 21 38.2s21-22.8 21-38.2C45 11.6 35.9 2.5 24 2.5z"/><circle cx="24" cy="23" r="8"/></svg></div>';
    const nom = '<p class="al-nom"' + h.rv('monte', 1, '--hk:' + h.kUne(cm.nom, ctx.type)) + '>' + (cm.art ? '<span class="al-art">' + h.esc(cm.art) + '</span>' : '') + '<span class="al-n">' + h.esc(cm.nom) + '</span><span class="al-ile">Martinique</span></p>';
    const infos = [];
    if (c.adresse) infos.push('<li>' + h.icone('pin') + '<span>' + h.esc(h.net(c.adresse)) + '</span></li>');
    if (z) infos.push('<li>' + h.icone('carte') + '<span>Intervient : ' + h.esc(z) + '</span></li>');
    const itin = c.maps ? '<a class="al-itin" href="' + h.esc(c.maps) + '" target="_blank" rel="noopener">' + h.icone('carte') + '<span>Voir l\'itinéraire</span></a>' : '';
    return '<section class="' + h.classes('apropos.lieu', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w al"><div class="al-g cq">' + carte + nom + '</div><div class="tx"' + h.rv('monte', 2) + '><h2 class="t">' + h.esc(titreDe(ctx, bloc)) + '</h2><p class="grand">' + h.esc(texteDe(spec, h)) + '</p>' + (infos.length ? '<ul class="al-infos">' + infos.join('') + '</ul>' : '') + itin + h.boutons(spec, { seule: true }) + '</div></div></section>';
  },
  css: function () { return cssCorps('.r-apropos-lieu') + `
.r-apropos-lieu .al{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:clamp(36px,6vw,100px);align-items:center}
.r-apropos-lieu .al-g{display:grid;min-width:0}
.r-apropos-lieu .al-carte{position:relative;aspect-ratio:4/3;max-width:520px;width:100%}
.r-apropos-lieu .al-courbes{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.r-apropos-lieu .al-courbes path{fill:none;stroke:var(--acc);stroke-width:1.4;vector-effect:non-scaling-stroke;opacity:calc(.75 - var(--k) * .12);stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset 1.9s var(--ease2);transition-delay:calc(.15s + var(--k) * .18s)}
.r-apropos-lieu .al-courbes path:first-child{fill:color-mix(in srgb,var(--acc) 7%,transparent)}
.js .r-apropos-lieu .al-carte:not(.vu) .al-courbes path{stroke-dashoffset:1}
.r-apropos-lieu .al-pin{position:absolute;left:50%;top:50%;width:clamp(46px,6vw,64px);height:auto;transform:translate(-50%,-100%);fill:var(--acc);filter:drop-shadow(0 10px 14px rgb(0 0 0 / .25));transition:transform .9s cubic-bezier(.34,1.5,.64,1) .9s,opacity .4s ease .9s}
.r-apropos-lieu .al-pin circle{fill:var(--bg)}
.js .r-apropos-lieu .al-carte:not(.vu) .al-pin{transform:translate(-50%,-190%);opacity:0}
.r-apropos-lieu .al-onde{position:absolute;left:50%;top:50%;width:clamp(90px,12vw,150px);aspect-ratio:3/1;margin:0;translate:-50% -50%;border:2px solid var(--acc);border-radius:50%;opacity:0;animation:k-apropos-lieu-onde 3.2s ease-out 1.6s infinite}
.r-apropos-lieu .al-onde.o2{animation-delay:3.2s}
.r-apropos-lieu .arret .al-onde{animation-play-state:paused}
@keyframes k-apropos-lieu-onde{0%{transform:scale(.25);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.r-apropos-lieu .al-nom{display:grid;margin-top:clamp(-30px,-2vw,-12px);font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);line-height:.92}
.r-apropos-lieu .al-art{font-size:clamp(1.3rem,2.2vw,2rem);color:var(--accT);line-height:1.1}
.r-apropos-lieu .al-n{font-size:max(2.2rem,min(8.6rem,calc(100cqi / var(--hk))));overflow-wrap:break-word;hyphens:auto}
.r-apropos-lieu .al-ile{display:flex;align-items:center;gap:12px;margin-top:14px;font-family:var(--fx);font-weight:var(--fxf);text-transform:none;letter-spacing:0;font-stretch:normal;font-variation-settings:var(--fxr);font-size:1rem;color:var(--tx2)}
.r-apropos-lieu .al-ile::before{content:"";width:40px;height:2px;background:var(--acc)}
.r-apropos-lieu .al-infos{display:grid;gap:10px}
.r-apropos-lieu .al-infos li{display:flex;gap:10px;align-items:flex-start;color:var(--tx2)}
.r-apropos-lieu .al-infos .ic{color:var(--accT);margin-top:3px}
.r-apropos-lieu .al-itin{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.r-apropos-lieu .al-itin:hover span{text-decoration:underline}
@media(max-width:860px){.r-apropos-lieu .al{grid-template-columns:1fr}.r-apropos-lieu .al-carte{max-width:420px}}
@media(prefers-reduced-motion:reduce){.r-apropos-lieu .al-onde{animation:none;opacity:.35;transform:scale(1)}.r-apropos-lieu .al-pin,.r-apropos-lieu .al-courbes path{transition:none}}
`; }
};

/* ── 5. une carte de texte posée sur une large photo en parallaxe ── */
const aproposParallaxe = {
  id: 'apropos.parallaxe', rubrique: 'apropos', nom: 'Carte sur photo en parallaxe',
  quand: 'une belle photo large (mer, terrasse, atelier, jardin) : la photo sur toute la largeur glisse au défilement, la présentation en carte vient se poser dessus',
  familles: ['horizon', 'comptoir', 'verdure', 'atelier', 'garage', 'ecrin', 'boutique'], ambiances: ['premium', 'chaleureux', 'franc', 'calme'], surfaces: ['fond', 'surface'], js: ['parallaxe'],
  besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!ctx.alloc.apropos; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = ctx.alloc.apropos;
    if (!p) return '';
    return '<section class="' + h.classes('apropos.parallaxe', bloc) + '" id="apropos">' + h.fond(bloc) + '<div class="apx-photo"><div class="apx-px" data-px="0.16">' + h.figure(p, 'lazy', '100vw', { attrs: h.rv('recul') }) + '</div></div><div class="w apx"><div class="apx-carte tx"' + h.rv('monte', 1) + '>' + corps(spec, ctx, bloc) + '</div></div></section>';
  },
  css: function () { return cssCorps('.r-apropos-parallaxe') + `
.r-apropos-parallaxe{padding-bottom:var(--sec)}
.r-apropos-parallaxe .apx-photo{position:relative;height:clamp(380px,56vw,720px);overflow:hidden}
.r-apropos-parallaxe .apx-px{position:absolute;inset:-14% 0}
.r-apropos-parallaxe .apx-px .ph{height:100%;border-radius:0;background:transparent}
.r-apropos-parallaxe .apx-photo::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgb(var(--voile) / .18),transparent 30%,transparent 52%,color-mix(in srgb,var(--bg) 55%,transparent) 84%,var(--bg))}
.r-apropos-parallaxe .apx{position:relative;z-index:2;margin-top:calc(-1 * clamp(150px,17vw,280px))}
.r-apropos-parallaxe .apx-carte{position:relative;margin-left:auto;width:min(640px,100%);background:var(--carte);color:var(--tx);border:1px solid var(--bord);border-radius:var(--r);box-shadow:var(--ombreF);padding:clamp(28px,4.2vw,60px)}
.r-apropos-parallaxe .apx-carte::before{content:"";position:absolute;left:clamp(28px,4.2vw,60px);top:0;width:64px;height:4px;background:var(--acc);transform-origin:left;transition:transform 1s var(--ease) .5s}
.js .r-apropos-parallaxe .apx-carte:not(.vu)::before{transform:scaleX(0)}
@media(max-width:760px){.r-apropos-parallaxe .apx{margin-top:-90px}}
@media(prefers-reduced-motion:reduce){.r-apropos-parallaxe .apx-carte::before{transition:none}}
`; }
};

/* ── 6. la page de magazine : deux colonnes, lettrine, filets ── */
const aproposEditorial = {
  id: 'apropos.editorial', rubrique: 'apropos', nom: 'Page de magazine',
  quand: 'toujours possible, très bien sans photo (conseil, soins, boutique, table) : deux colonnes, une fiche à filets (lieu, contact, note Google), le texte avec une lettrine ; la photo en vignette si on en a une',
  familles: [], ambiances: ['calme', 'premium', 'chaleureux'], surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return aTexte(spec, ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec), c = spec.contact || {}, p = ctx.alloc.apropos, z = h.zoneClient(spec);
    const fiche = [['Où', spec.commune ? spec.commune + ', Martinique' : 'En Martinique']];
    if (z) fiche.push(['Intervient', z]);
    if (h.waHref(c.mobile || c.tel)) fiche.push(['Contact', 'Téléphone et WhatsApp']);
    else if (c.tel) fiche.push(['Contact', MQ.affiche(c.tel)]);
    else if (c.email) fiche.push(['Contact', 'Par email']);
    if (g) fiche.push(['Google', h.noteTexte(g) + ' sur 5, ' + g.avis + ' avis']);
    const dl = '<dl class="ae-fiche">' + fiche.map(function (x, k) { return '<div' + h.rv('monte', k + 1) + '><dt>' + h.esc(x[0]) + '</dt><dd>' + h.esc(x[1]) + '</dd></div>'; }).join('') + '</dl>';
    const vign = p ? h.figure(p, 'lazy', '(max-width:1240px) 100vw, 1240px', { classe: 'ae-ph', attrs: h.rv('store', 2) }) : '';
    return '<section class="' + h.classes('apropos.editorial', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w ae' + (p ? ' avec' : '') + '"><span class="ae-filet"' + h.rv('monte') + ' aria-hidden="true"></span><div class="ae-g"><h2 class="t"' + h.rv('monte') + '>' + h.esc(titreDe(ctx, bloc)) + '</h2>' + dl + '</div><div class="ae-d"' + h.rv('monte', 2) + '><p class="ae-texte">' + h.esc(texteDe(spec, h)) + '</p>' + h.boutons(spec, { seule: true }) + '</div>' + vign + '</div></section>';
  },
  css: function () {
    return sansCoupe('.r-apropos-editorial') + `
.r-apropos-editorial .ae{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);column-gap:clamp(36px,6vw,100px);row-gap:0;align-items:start}
.r-apropos-editorial .ae-filet{grid-column:1/-1;height:3px;background:var(--tx);margin-bottom:clamp(26px,3.4vw,44px);transform-origin:left;transition:transform 1.4s var(--ease2)}
.js .r-apropos-editorial .ae-filet[data-r]{opacity:1}
.js .r-apropos-editorial .ae-filet:not(.vu){transform:scaleX(0)}
.r-apropos-editorial .ae-g{display:grid;gap:clamp(22px,2.6vw,32px);align-content:start}
.r-apropos-editorial .ae-fiche{margin:0;display:grid}
.r-apropos-editorial .ae-fiche>div{display:grid;grid-template-columns:7.5em minmax(0,1fr);gap:16px;padding:13px 0;border-top:1px solid var(--bord)}
.r-apropos-editorial .ae-fiche>div:last-child{border-bottom:1px solid var(--bord)}
.r-apropos-editorial .ae-fiche dt{font-weight:var(--fxf);color:var(--accT)}
.r-apropos-editorial .ae-fiche dd{margin:0;color:var(--tx2)}
.r-apropos-editorial .ae-ph{grid-column:1/-1;aspect-ratio:21/8;margin-top:clamp(36px,5vw,72px)}
.r-apropos-editorial .ae-ph img{transition:transform 1.6s var(--ease)}
.r-apropos-editorial .ae-ph:hover img{transform:scale(1.03)}
.r-apropos-editorial .ae-d{display:grid;gap:clamp(24px,3vw,36px);justify-items:start;padding-left:clamp(0px,4vw,56px);border-left:1px solid var(--bord)}
.r-apropos-editorial .ae-texte{font-family:var(--fx);font-size:clamp(1.24rem,1.9vw,1.6rem);line-height:1.55;color:var(--tx);text-wrap:pretty;max-width:34em}
.r-apropos-editorial .ae-texte::first-letter{float:left;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);text-transform:var(--tc);font-size:4.35em;line-height:.8;margin:.06em .12em -.02em 0;padding:.12em .14em .1em;color:var(--btnT);background:var(--btn);border-radius:var(--rb)}
.m-ecrin .r-apropos-editorial .ae-texte::first-letter,.m-comptoir .r-apropos-editorial .ae-texte::first-letter{background:none;color:var(--accT);padding:.02em .08em 0 0;font-size:4.8em}
@media(max-width:860px){.r-apropos-editorial .ae{grid-template-columns:1fr;row-gap:28px}.r-apropos-editorial .ae-filet{margin-bottom:0}.r-apropos-editorial .ae-g{display:contents}.r-apropos-editorial .ae-g h2{order:1}.r-apropos-editorial .ae-d{order:2;padding-left:0;border-left:0}.r-apropos-editorial .ae-fiche{order:3}.r-apropos-editorial .ae-ph{order:4;aspect-ratio:4/3;margin-top:0}}
@media(prefers-reduced-motion:reduce){.r-apropos-editorial .ae-filet{transition:none}}
`;
  }
};

/* ── 7. trois photos en collage ── */
const aproposCollage = {
  id: 'apropos.collage', rubrique: 'apropos', nom: 'Collage de trois photos',
  quand: 'trois photos ou plus (table, boutique, sortie, soins, jardin) : un collage à trois cadres qui se chevauchent et bougent chacun à sa vitesse ; le texte à côté',
  familles: ['comptoir', 'ecrin', 'horizon', 'verdure', 'boutique', 'atelier'], ambiances: ['chaleureux', 'premium', 'franc'], surfaces: ['fond', 'surface'], js: ['parallaxe'],
  besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!ctx.alloc.apropos && libres(ctx) >= 2; },
  rendre: function (spec, ctx, bloc) {
    if (!ctx.alloc.apropos) return '';
    const h = ctx.h, ph = [ctx.alloc.apropos].concat(enPlus(ctx, 'apropos.collage', 2));
    const cl = ['acg-a', 'acg-b', 'acg-c'], rv = [['rideau', 0], ['store', 3], ['iris', 5]], px = ['0.03', '-0.07', '0.1'];
    const vis = '<div class="acg-vis n' + ph.length + '">' + ph.map(function (p, k) { return '<div class="' + cl[k] + '" data-px="' + px[k] + '">' + h.figure(p, 'lazy', k ? '(max-width:860px) 50vw, 22vw' : '(max-width:860px) 70vw, 32vw', { attrs: h.rv(rv[k][0], rv[k][1]) }) + '</div>'; }).join('') + '<span class="acg-trame" aria-hidden="true"></span></div>';
    return '<section class="' + h.classes('apropos.collage', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w acg">' + vis + '<div class="tx"' + h.rv('monte', 2) + '>' + corps(spec, ctx, bloc) + '</div></div></section>';
  },
  css: function () { return cssCorps('.r-apropos-collage') + `
.r-apropos-collage .acg{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:clamp(40px,6vw,100px);align-items:center}
.r-apropos-collage .acg-vis{position:relative;aspect-ratio:1/1.02;max-width:620px;width:100%}
.r-apropos-collage .acg-vis>div{position:absolute;isolation:isolate;border-radius:var(--rp);box-shadow:0 0 0 clamp(5px,.7vw,9px) var(--bg),var(--ombre);transition:box-shadow .8s ease .3s}
.js .r-apropos-collage .acg-vis>div:has(.ph:not(.vu)){box-shadow:none}
.r-apropos-collage .acg-vis .ph{width:100%;height:100%}
.r-apropos-collage .acg-vis .ph img{transition:transform 1.2s var(--ease)}
.r-apropos-collage .acg-vis>div:hover img{transform:scale(1.06)}
.r-apropos-collage .acg-a{left:0;top:0;width:60%;height:70%;z-index:1}
.r-apropos-collage .acg-b{right:0;top:14%;width:46%;height:46%;z-index:2}
.r-apropos-collage .acg-c{left:30%;bottom:0;width:42%;height:36%;z-index:3}
.r-apropos-collage .n2 .acg-a{width:66%;height:80%}.r-apropos-collage .n2 .acg-b{top:auto;bottom:0;width:52%;height:52%}
.r-apropos-collage .n1 .acg-a{left:0;top:0;width:84%;height:90%}.r-apropos-collage .n1 .acg-trame{width:46%;height:44%;right:0;bottom:0}
.r-apropos-collage .acg-trame{position:absolute;right:2%;bottom:6%;width:34%;height:30%;z-index:0;background-image:radial-gradient(color-mix(in srgb,var(--acc) 70%,transparent) 1.4px,transparent 1.8px);background-size:14px 14px;opacity:.7}
@media(max-width:860px){.r-apropos-collage .acg{grid-template-columns:1fr}.r-apropos-collage .acg-vis{max-width:520px}}
`; }
};

/* ── 8. une bande sombre que la photo déborde ── */
const aproposBande = {
  id: 'apropos.bande', rubrique: 'apropos', nom: 'Bande sombre, photo qui déborde',
  quand: 'une photo forte (atelier, véhicule, chantier, bateau) : une bande sombre porte le texte, la photo en hauteur la déborde en haut et en bas',
  familles: ['atelier', 'garage', 'horizon', 'verdure', 'cabinet', 'boutique'], ambiances: ['franc', 'premium', 'calme'], surfaces: ['champ', 'accent'], js: [], decoupe: false,
  besoin: function (spec, ctx) { return aTexte(spec, ctx) && !!ctx.alloc.apropos; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = ctx.alloc.apropos;
    if (!p) return '';
    return '<section class="' + h.classes('apropos.bande', bloc) + '" id="apropos">' + h.fond(bloc) + '<div class="w ab"><div class="ab-vis">' + h.figure(p, 'lazy', '(max-width:860px) 100vw, 42vw', { attrs: h.rv('store') }) + '<span class="ab-trait" aria-hidden="true"></span></div><div class="tx"' + h.rv('monte', 2) + '>' + corps(spec, ctx, bloc) + '</div></div></section>';
  },
  css: function (ctx) {
    const clair = !ctx.palette || ctx.palette.clair;
    // sur une palette sombre, la bande s'éclaircit un peu pour se détacher du fond de page
    return cssCorps('.r-apropos-bande') + `
.r-apropos-bande{--deb:clamp(44px,6vw,96px);background:var(--fond);padding-block:0}
.r-apropos-bande::before{content:"";position:absolute;left:0;right:0;top:var(--deb);bottom:var(--deb);z-index:-2;background:var(--bg)}${clair ? '' : '\n.r-apropos-bande.s-champ::before{background:color-mix(in srgb,var(--tx) 7%,var(--bg));border-block:1px solid var(--bord)}'}
.r-apropos-bande>.fond{inset:var(--deb) 0}
.r-apropos-bande .ab{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(36px,6vw,100px);align-items:stretch}
.r-apropos-bande .ab-vis{position:relative;min-height:clamp(440px,46vw,640px)}
.r-apropos-bande .ab-vis .ph{position:absolute;inset:0;border-radius:var(--rp);box-shadow:0 40px 80px -30px rgb(0 0 0 / .55)}
.r-apropos-bande .ab-trait{position:absolute;left:calc(100% + clamp(18px,3vw,50px));top:calc(var(--deb) + clamp(48px,6vw,96px));width:2px;height:clamp(60px,8vw,110px);background:var(--acc);transform-origin:top;transition:transform 1.2s var(--ease) .6s}
.js .r-apropos-bande .ph:not(.vu)+.ab-trait{transform:scaleY(0)}
.r-apropos-bande .tx{padding-block:calc(var(--deb) + clamp(48px,6vw,96px))}
@media(max-width:860px){.r-apropos-bande{--deb:clamp(80px,22vw,140px)}.r-apropos-bande::before{bottom:0}.r-apropos-bande>.fond{inset:var(--deb) 0 0}.r-apropos-bande .ab{grid-template-columns:1fr;gap:0}.r-apropos-bande .ab-vis{min-height:0;aspect-ratio:4/3}.r-apropos-bande .ab-trait{display:none}.r-apropos-bande .tx{padding-block:clamp(36px,8vw,56px) var(--sec)}}
@media(prefers-reduced-motion:reduce){.r-apropos-bande .ab-trait{transition:none}}
`;
  }
};

/* ── 9. la présentation et les atouts réunis ── */
const aproposAtouts = {
  id: 'apropos.atouts', rubrique: 'apropos', nom: 'Présentation et atouts',
  quand: 'un texte de présentation et deux à quatre atouts : le texte (et la photo si on l\'a) en tête, puis les atouts en colonnes à filets, un anneau qui se dessine autour de chaque icône (remplace la rubrique des atouts)',
  familles: [], ambiances: ['franc', 'calme', 'chaleureux', 'premium'], surfaces: ['fond', 'surface'], js: [], inclut: ['atouts'],
  besoin: function (spec, ctx) {
    if (!aTexte(spec, ctx) || ctx.h.atouts(spec).length < 2) return false;
    // quand la recette de la famille place la rubrique des atouts avant la présentation, l'assembleur la garde : les
    // atouts y seraient déjà, la variante n'aurait plus son idée
    const r = require('../composition').RECETTES[(ctx.da && ctx.da.modele) || 'atelier'] || [];
    return !(r.indexOf('pourquoi') >= 0 && r.indexOf('pourquoi') < r.indexOf('apropos'));
  },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = ctx.alloc.apropos;
    // une autre rubrique de la page montre déjà les atouts (la rubrique « pourquoi », gardée quand elle précède la
    // présentation dans la recette, ou un bandeau qui les inclut) : on ne les répète pas
    const B = require('./index');
    const autres = ((ctx.compo && ctx.compo.blocs) || []).map(function (x) { return x.id; }).concat(Array.from(ctx.utilisees || []));
    const dejaVus = autres.some(function (id) { const v = B.VARIANTES[id]; return id !== 'apropos.atouts' && v && (v.rubrique === 'pourquoi' || (v.inclut || []).indexOf('atouts') >= 0); });
    const a = dejaVus ? [] : h.atouts(spec);
    const tete = '<div class="aat-tete' + (p ? ' avec' : '') + '"><div class="tx"' + h.rv('monte') + '>' + corps(spec, ctx, bloc, { coches: false }) + '</div>' + (p ? h.figure(p, 'lazy', '(max-width:860px) 100vw, 44vw', { classe: 'aat-ph', attrs: h.rv('rideau', 1) }) : '') + '</div>';
    const liste = !a.length ? '' : '<ul class="aat-l n' + a.length + '" id="pourquoi" aria-label="' + h.esc(ctx.mod.textes.pourquoi) + '">' + a.map(function (x, k) { return '<li' + h.rv('monte', k + 2) + '><span class="aat-ic"><svg class="aat-anneau" viewBox="0 0 56 56" aria-hidden="true"><circle pathLength="1" cx="28" cy="28" r="26.5"/></svg>' + h.icone(h.iconeDe(x, 'check')) + '</span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('') + '</ul>';
    return '<section class="' + h.classes('apropos.atouts', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w">' + tete + liste + '</div></section>';
  },
  css: function () { return cssCorps('.r-apropos-atouts') + `
.r-apropos-atouts .aat-tete{display:grid;gap:clamp(32px,5vw,90px);align-items:center}
.r-apropos-atouts .aat-tete:not(:last-child){margin-bottom:clamp(44px,6vw,88px)}
.r-apropos-atouts .aat-tete.avec{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}
.r-apropos-atouts .aat-tete:not(.avec) .tx{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);column-gap:clamp(32px,6vw,100px);align-items:start}
.r-apropos-atouts .aat-tete:not(.avec) .tx>h2{grid-column:1;grid-row:1/span 2}
.r-apropos-atouts .aat-tete:not(.avec) .tx>.grand,.r-apropos-atouts .aat-tete:not(.avec) .tx>.actions{grid-column:2}
.r-apropos-atouts .aat-ph{aspect-ratio:3/2}
.r-apropos-atouts .aat-l{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));border-top:1px solid var(--bord)}
.r-apropos-atouts .aat-l.n2{--n:2}.r-apropos-atouts .aat-l.n4{--n:4}
.r-apropos-atouts .aat-l li{position:relative;isolation:isolate;display:grid;gap:14px;align-content:start;padding:clamp(26px,3vw,40px) clamp(18px,2.4vw,34px) clamp(30px,3.4vw,44px)}
.r-apropos-atouts .aat-l li+li{border-left:1px solid var(--bord)}
.r-apropos-atouts .aat-l li::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,color-mix(in srgb,var(--acc) 12%,transparent),transparent 85%);transform:scaleY(0);transform-origin:top;transition:transform .7s var(--ease)}
.r-apropos-atouts .aat-l li::after{content:"";position:absolute;left:0;top:-1px;height:2px;width:100%;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform .7s var(--ease)}
.r-apropos-atouts .aat-l li:hover::before,.r-apropos-atouts .aat-l li:hover::after{transform:none}
.r-apropos-atouts .aat-ic{position:relative;width:60px;height:60px;display:grid;place-items:center;color:var(--accT);margin-bottom:6px}
.r-apropos-atouts .aat-ic>.ic{width:26px;height:26px;transition:transform .6s var(--ease)}
.r-apropos-atouts .aat-l li:hover .aat-ic>.ic{transform:rotate(-10deg) scale(1.12)}
.r-apropos-atouts .aat-anneau{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.r-apropos-atouts .aat-anneau circle{fill:color-mix(in srgb,var(--acc) 10%,transparent);stroke:var(--acc);stroke-width:1.6;stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset 1.4s var(--ease2) .35s}
.js .r-apropos-atouts .aat-l li:not(.vu) .aat-anneau circle{stroke-dashoffset:1}
.r-apropos-atouts .aat-l h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.3rem,1.9vw,1.7rem);line-height:1.08}
.r-apropos-atouts .aat-l p{color:var(--tx2)}
@media(max-width:980px){.r-apropos-atouts .aat-l.n4{--n:2}.r-apropos-atouts .aat-l.n4 li:nth-child(3){border-left:0}.r-apropos-atouts .aat-l.n4 li:nth-child(n+3){border-top:1px solid var(--bord)}}
@media(max-width:860px){.r-apropos-atouts .aat-tete.avec,.r-apropos-atouts .aat-tete:not(.avec) .tx{grid-template-columns:1fr}.r-apropos-atouts .aat-tete:not(.avec) .tx>*{grid-column:auto!important;grid-row:auto!important}}
@media(max-width:700px){.r-apropos-atouts .aat-l,.r-apropos-atouts .aat-l.n2,.r-apropos-atouts .aat-l.n4{--n:1}.r-apropos-atouts .aat-l li{grid-template-columns:auto minmax(0,1fr);column-gap:18px;padding-inline:4px}.r-apropos-atouts .aat-l li+li{border-left:0;border-top:1px solid var(--bord)}.r-apropos-atouts .aat-ic{grid-row:1/span 2;margin:0}.r-apropos-atouts .aat-l li>p{grid-column:2}}
@media(prefers-reduced-motion:reduce){.r-apropos-atouts .aat-anneau circle,.r-apropos-atouts .aat-l li::before,.r-apropos-atouts .aat-l li::after{transition:none}}
`; }
};

module.exports = [aproposDouble, aproposRevele, aproposArche, aproposLieu, aproposParallaxe, aproposEditorial, aproposCollage, aproposBande, aproposAtouts];
