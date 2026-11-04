// Les hauts de page « scènes de métier » : le haut de page montre le métier au lieu de le décorer. Sur la photo du haut
// de page quand il y en a une (sinon sur un aplat travaillé), une scène se joue : la clim qui rafraîchit la photo, le
// courant qui court dans un circuit, la lumière qui danse dans l'eau, la vapeur qui monte d'une cuisine, les palmes qui
// se balancent, la raclette qui nettoie une vitre, la route de nuit, le soleil qui se lève. Et quatre hauts de page sans
// photo, aussi travaillés que les autres : la typographie en mouvement, l'icône du métier dessinée trait par trait, la
// carte de visite en 3D, la grille bento.
// Les règles de la scène : elle reste derrière le texte (voiles, masques), elle ne coûte presque rien (CSS sur transform
// et opacity, pause hors écran par la classe « vit », rien quand on demande moins d'animations), elle n'invente rien
// (aucun chiffre, aucun fait : seulement la fiche). Sans JS, chaque scène montre son état final, immobile.
// Les entrées sont des @keyframes posées sur « .vu » (et non des transitions) : au premier chargement, le navigateur
// saute les transitions déclenchées pendant que les polices arrivent, une animation, elle, joue toujours.
'use strict';
const T = require('../theme');
const MQ = require('../../martinique');

/* ── matières ── */
const svgUrl = function (s) { return 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")'; };
// deux lumières de scène (pas des couleurs de marque) : le froid de la clim, et le jaune des étoiles pour le soleil
const GLACE = '191 228 255';
const SOLEIL = '245 179 1';
const GRAIN = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .9 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>');
const ETOILE4 = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 0C12.9 8.2 15.8 11.1 24 12 15.8 12.9 12.9 15.8 12 24 11.1 15.8 8.2 12.9 0 12 8.2 11.1 11.1 8.2 12 0z" fill="#fff"/></svg>');
// la lumière au fond de l'eau : les lignes de niveau d'une turbulence à une octave dessinent les cellules ondulées des
// caustiques, gardées fines (tuile sans couture)
function caustique(graine, freq, seuil) {
  return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="520" height="520"><filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="turbulence" baseFrequency="' + freq + '" numOctaves="1" seed="' + graine + '" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ' + seuil + ' 0 0 0 1.35"/><feComponentTransfer><feFuncA type="gamma" amplitude="1" exponent="1.5"/></feComponentTransfer><feGaussianBlur stdDeviation=".6"/></filter><rect width="100%" height="100%" filter="url(#c)"/></svg>');
}
const CAUSTIQUE_A = caustique(7, '.014', -16);
const CAUSTIQUE_B = caustique(11, '.022', -22);
// une volute de vapeur : un panache flou (large) et son filet plus net, qui s'effacent aux deux bouts
function volute(d) {
  return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="700" viewBox="0 0 300 700"><defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity=".85"/><stop offset=".6" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="b" x="-60%" y="-10%" width="220%" height="120%"><feGaussianBlur stdDeviation="18"/></filter><filter id="f" x="-60%" y="-10%" width="220%" height="120%"><feGaussianBlur stdDeviation="5"/></filter></defs><path d="' + d + '" fill="none" stroke="url(#g)" stroke-width="78" stroke-linecap="round" filter="url(#b)" opacity=".75"/><path d="' + d + '" fill="none" stroke="url(#g)" stroke-width="16" stroke-linecap="round" filter="url(#f)" opacity=".55" transform="translate(14 0)"/></svg>');
}
const VOLUTES = [volute('M150 690C108 606 196 556 150 470S86 352 162 254S214 116 138 6'), volute('M150 690C204 598 116 538 160 446S224 326 140 236S86 108 172 6'), volute('M150 690C128 622 172 588 140 516S104 416 172 346S206 216 118 118S142 28 164 -4')];

/* ── le métier : secteur, activité, métier de la fiche ── */
function quoi(spec) { return [spec && spec.secteur, spec && spec.activite, spec && spec.metier].filter(Boolean).join(' '); }
// chaque motif est cherché au début d'un mot ; $ marque un mot entier (« eau » mais pas « réseau »)
function rx(motifs) { return new RegExp('(?<![\\p{L}\\p{N}])(?:' + motifs.split('|').map(function (m) { return /\$$/.test(m) ? m.slice(0, -1) + '(?![\\p{L}\\p{N}])' : m; }).join('|') + ')', 'iu'); }
const RX = {
  froid: rx('clim|froid|frigo|r[ée]frig|vmc$|ventil|chambres? froides?'),
  courant: rx('[ée]lectri|solaire|photovolta|bornes?$|recharge|domotique|courant$|[ée]nergies?$|c[âa]blage|tableaux? [ée]lectriques?'),
  eau: rx('piscin|plomb|sanitaire|chauffe-eau|eaux?$|mer$|plong|nautique|nautisme|bassins?$|spa$|jacuzzi|fontaines?$|forage|assainiss|d[ée]bouch|fuites?$|robinet|canalis|kayak|paddle|catamaran|bateaux?$|aqua'),
  table: rx('restau|traiteur|boulang|p[âa]tiss|snack|cuisine|caf[ée]s?$|food|plats?$|grill|brasserie|cr[êe]pe|pizz|bistro|lolo|cantine|sushi|burger|glacier|chocolat|viennois'),
  jardin: rx('jardin|paysag|espaces? verts|[ée]lag|tonte|d[ée]brouss|p[ée]pini|horticult|arros|v[ée]g[ée]ta|plantes?$|fleur|gazon|haies?$'),
  propre: rx('nettoy|propret|m[ée]nage$|lavage|vitres?$|vitrerie|d[ée]sinfect|pressing|blanchiss|entretien de locaux|nettoiement'),
  route: rx('transport|garage|auto[- ]?[ée]cole|permis|conduite|d[ée]m[ée]nag|taxis?$|vtc$|livraison|m[ée]cani|carross|pneu|automobile|autos?$|motos?$|scooter|location de (?:voitures?|v[ée]hicules?)|remorqu|d[ée]pannage auto|poids lourds?|fret$|logisti|coursier|chauffeur'),
  soleil: rx('tourism|excursion|h[ée]berg|g[îi]tes?$|h[ôo]tel|villas?$|location saisonni|chambres? d.h[ôo]tes?|s[ée]jour|mer$|plage|bateaux?$|catamaran|voilier|kayak|plong|randonn|guide|nautique|nautisme|croisi[èe]re|balade|snorkel|jet[- ]?ski|paddle|bungalow')
};
function pour(re) { return function (spec) { return re.test(quoi(spec)); }; }

/* ── le texte du haut de page (mêmes conventions que le socle) ── */
function corps(spec, ctx, o) {
  o = o || {};
  const h = ctx.h, tx = ctx.textes, ty = ctx.type;
  const h1 = '<h1 class="t h1" style="--hk:' + (ctx.mod.titres === 'nom' ? h.kUne(tx.h1, ty) : h.k2(tx.h1, ty)) + '" data-r="mots">' + h.mots(tx.h1) + '</h1>';
  const sur = tx.sur ? '<p class="h-sur"' + h.rv('monte', 2) + '>' + h.esc(tx.sur) + '</p>' : '';
  const phrase = tx.phrase ? '<p class="h-phrase"' + h.rv('monte', 4) + '>' + h.esc(tx.phrase) + '</p>' : '';
  let b = h.boutons(spec);
  if (o.finActions && b) b = b.replace(/<\/div>$/, o.finActions + '</div>');
  const act = b ? '<div class="h-act"' + h.rv('monte', 5) + '>' + b + '</div>' : '';
  const conf = o.confiance === false ? '' : '<div class="h-conf"' + h.rv('monte', 6) + '>' + h.confiance(spec) + '</div>';
  return h1 + sur + phrase + act + conf;
}
// la photo plein cadre (parallaxe douce), dans son calque
function photoPleine(ctx, o) {
  o = o || {};
  const ph = ctx.alloc.hero;
  if (!ph) return '';
  const fig = ctx.h.figure(ph, 'eager', '100vw', { attrs: ctx.h.rv('recul') });
  return '<div class="hp-img" data-px="' + (o.px || 0.1) + '">' + (o.enveloppe ? '<div class="' + o.enveloppe + '">' + fig + '</div>' : fig) + '</div>';
}
// le script commun : la scène ne vit que lorsqu'elle est à l'écran (classe « vit ») et jamais quand on demande moins
// d'animations ; code = la suite, qui voit s (la section) et fin (une vraie souris)
function vivant(cls, code, siCalme) {
  return "[].slice.call(d.querySelectorAll('." + cls + "')).forEach(function(s){" + (siCalme ? 'if(calme){' + siCalme + '}' : '') + "if(calme)return;var fin=w.matchMedia&&w.matchMedia('(hover:hover) and (pointer:fine)').matches;" +
    "if('IntersectionObserver' in w){new IntersectionObserver(function(es){es.forEach(function(e){s.classList.toggle('vit',e.isIntersecting)})},{rootMargin:'60px 0px'}).observe(s)}else{s.classList.add('vit')}" + (code || '') + "})";
}
// l'entrée orchestrée du texte et de la scène, en @keyframes (voir l'en-tête du fichier). Deux corrections locales des
// apparitions communes : un bloc apparu ne coupe plus ce qui le déborde (ombre des boutons au survol, accents des
// capitales de la première ligne, fil du courant), et les mots du titre gardent la place des accents (É, À, Ç)
function cssEntree(c, n, o) {
  o = o || {};
  const k = 'k-hero-' + n + '-e-';
  return c + ' .m{padding-top:.2em;margin-top:-.2em}' +
    '.js ' + c + ' [data-r].vu{clip-path:none}' +
    '.js ' + c + ' [data-r=mots].vu .m>span{animation:' + k + 'mot calc(var(--dur) * 1.15) var(--ease) calc(var(--i,0) * 70ms + ' + (o.mots || '120ms') + ') both}' +
    '.js ' + c + ' [data-r=monte].vu{animation:' + k + 'monte var(--dur) var(--ease) calc(var(--i,0) * var(--pas) + ' + (o.monte || '160ms') + ') both}' +
    '.js ' + c + ' [data-r=zoom].vu{animation:' + k + 'zoom var(--dur) var(--ease) calc(var(--i,0) * var(--pas) + 120ms) both}' +
    '.js ' + c + ' .ph[data-r=recul].vu{animation:' + k + 'recul 2.4s cubic-bezier(.2,.7,.2,1) both}' +
    '.js ' + c + ' [data-r=scene].vu{animation:' + k + 'scene ' + (o.scene || '.9s') + ' ease both}' +
    '@keyframes ' + k + 'mot{from{transform:translate3d(0,130%,0)}}' +
    '@keyframes ' + k + 'monte{from{opacity:0;transform:translate3d(0,var(--dy),0)}}' +
    '@keyframes ' + k + 'zoom{from{opacity:0;transform:scale(.92)}}' +
    '@keyframes ' + k + 'recul{0%{opacity:0;transform:scale(1.1)}35%{opacity:1}100%{transform:none}}' +
    '@keyframes ' + k + 'scene{from{opacity:0}}';
}
// le texte clair des scènes (posées sur la surface photo)
function cssTexte(c, hmax) {
  return c + ' .h-txt{display:grid;gap:clamp(18px,2.4vw,26px);--hmax:' + (hmax || '5.4rem') + '}' +
    c + ' .h1{text-shadow:0 2px 34px rgb(var(--voile) / .45)}' +
    c + ' .h-sur{font-size:clamp(1.06rem,1.5vw,1.3rem);font-weight:var(--fxf);line-height:1.35;color:rgb(255 255 255 / .94);max-width:42ch}' +
    c + ' .h-phrase{font-size:clamp(1.08rem,1.45vw,1.28rem);line-height:1.5;max-width:44ch;color:rgb(255 255 255 / .9)}' +
    c + ' .confiance{color:rgb(255 255 255 / .9)}' + c + ' .confiance .ic,' + c + ' .confiance b{color:#fff}' +
    c + ' .b2{color:#fff;border-color:rgb(255 255 255 / .7)}';
}
// la mise en page plein cadre : photo, voile, texte (les calques de la scène se glissent entre eux)
const VOILE = 'linear-gradient(90deg,rgb(var(--voile) / .92) 0%,rgb(var(--voile) / .78) 32%,rgb(var(--voile) / .3) 66%,rgb(var(--voile) / .1) 100%)';
const VOILE_M = 'linear-gradient(180deg,rgb(var(--voile) / .38) 0%,rgb(var(--voile) / .5) 38%,rgb(var(--voile) / .9) 72%,rgb(var(--voile) / .95) 100%)';
function cssPlein(c, o) {
  o = o || {};
  return c + '{min-height:clamp(620px,94vh,920px);display:grid;align-items:center;overflow:hidden;color:#fff}' +
    c + ' .hp-img{position:absolute;inset:-7% 0;z-index:-6}' +
    c + ' .hp-img .ph{height:100%;border-radius:0;background:rgb(var(--voile))}' +
    c + ' .hp-voile{position:absolute;inset:0;z-index:-4;pointer-events:none;background:' + (o.voile || VOILE) + '}' +
    c + ' .w{position:relative;padding-block:clamp(132px,14vw,184px) clamp(76px,9vw,124px)}' +
    c + ' .h-txt{max-width:' + (o.large || '640px') + '}' +
    cssTexte(c, o.hmax) +
    '@media(max-width:860px){' + c + '{min-height:min(96vh,820px);min-height:min(96svh,820px);align-items:end}' + c + ' .hp-voile{background:' + (o.voileM || VOILE_M) + '}' + c + ' .w{padding-block:132px 60px}}';
}
// les calques d'une scène : sous le voile (-5), au-dessus du voile (-3)
const SOUS = 'position:absolute;inset:0;z-index:-5;pointer-events:none;overflow:hidden';
const DESSUS = 'position:absolute;inset:0;z-index:-3;pointer-events:none;overflow:hidden';
const graine = function (s) { return T.tirage(T.hash(String(s))); };
const r2 = function (v) { return Math.round(v * 100) / 100; };

/* ════════════════ A. les scènes de métier ════════════════ */

/* ── la fraîcheur : la clim rafraîchit la photo ── */
const AIRS = ['M-20 70C80 230 210 320 370 400S610 580 700 720', 'M40 30C130 220 280 330 450 405S690 525 770 610', 'M110 0C210 230 380 350 560 425S770 470 830 505', 'M-50 170C0 300 110 420 230 530S410 710 470 790', 'M180 -20C280 160 440 270 620 330'];
const SOUFFLE = '<svg class="hf-souffle" viewBox="0 0 600 700" preserveAspectRatio="xMinYMin slice" aria-hidden="true" focusable="false"><defs><linearGradient id="hf-sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".55" stop-color="rgb(' + GLACE + ')" stop-opacity=".7"/><stop offset="1" stop-color="rgb(' + GLACE + ')" stop-opacity="0"/></linearGradient><filter id="hf-flou" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter></defs>' +
  '<g class="hf-nappe" fill="none" stroke="url(#hf-sg)" stroke-linecap="round" filter="url(#hf-flou)">' + AIRS.map(function (d, k) { return '<path pathLength="100" d="' + d + '" stroke-width="' + [46, 36, 28, 32, 24][k] + '" style="--k:' + k + '"/>'; }).join('') + '</g>' +
  '<g class="hf-filet" fill="none" stroke="#fff" stroke-linecap="round">' + AIRS.map(function (d, k) { return '<path pathLength="100" d="' + d + '" stroke-width="' + [2.2, 1.8, 1.5, 1.6, 1.3][k] + '" style="--k:' + k + '"/>'; }).join('') + '</g></svg>';
const CRISTAUX = (function () { const g = graine('cristaux'); const out = []; for (let k = 0; k < 14; k++) out.push({ x: r2(4 + g() * 72), y: r2(2 + g() * 70), d: r2(-g() * 8), t: r2(6 + g() * 5), s: r2(0.7 + g() * 1.2), f: k % 3 === 0 }); return out; })();
const heroFraicheur = {
  id: 'hero.fraicheur', rubrique: 'hero', nom: 'La fraîcheur gagne la photo',
  quand: 'climatisation, froid, ventilation : la photo passe du chaud au frais, un souffle d\'air la traverse, un bouton rejoue l\'effet',
  familles: ['atelier'], ambiances: ['franc', 'calme'], surfaces: ['photo'], js: [],
  besoin: pour(RX.froid),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const vitre = ph ? h.figure(ph, 'eager', '(max-width:860px) 100vw, 50vw') : '<div class="hf-vide">' + h.icone('flocon', 'hf-flo') + '</div>';
    const cristaux = CRISTAUX.map(function (c) { return '<i' + (c.f ? ' class="f"' : '') + ' style="--x:' + c.x + '%;--y:' + c.y + '%;--d:' + c.d + 's;--t:' + c.t + 's;--s:' + c.s + '">' + (c.f ? h.icone('flocon') : '') + '</i>'; }).join('');
    return '<section class="' + h.classes('hero.fraicheur', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) +
      '<div class="w hf-g"><div class="h-txt cq">' + corps(spec, ctx) + '</div>' +
      '<div class="hf-cadre' + (ph ? '' : ' sans') + '" data-r="scene"><div class="hf-halo" aria-hidden="true"><i></i><i></i></div><div class="hf-vitre">' + vitre +
      '<div class="hf-chaud" aria-hidden="true"></div><div class="hf-frais" aria-hidden="true"></div><div class="hf-givre" aria-hidden="true"></div>' + SOUFFLE +
      '<div class="hf-cristaux" aria-hidden="true">' + cristaux + '</div>' +
      '<button class="hf-btn" type="button">' + h.icone('flocon') + '<span>Ressentir la fraîcheur</span></button></div></div></div></section>';
  },
  // le bouton rejoue la scène : retour au chaud (.re), puis la fraîcheur revient (.rejeu, des animations sous un autre nom)
  script: vivant('r-hero-fraicheur',
    "var sc=s.querySelector('.hf-cadre'),bt=s.querySelector('.hf-btn');if(!sc||!bt)return;var occ=0;" +
    "var rejouer=function(){if(occ||!sc.classList.contains('vu'))return;occ=1;sc.classList.remove('rejeu');sc.classList.add('re');setTimeout(function(){sc.classList.remove('re');sc.classList.add('rejeu')},520);setTimeout(function(){occ=0},3800)};" +
    "bt.addEventListener('mouseenter',rejouer);bt.addEventListener('focus',rejouer);bt.addEventListener('click',rejouer);",
    "var bq=s.querySelector('.hf-btn');if(bq)bq.hidden=true;"),
  css: function () {
    const c = '.r-hero-fraicheur', k = 'k-hero-fraicheur-', CHAUD = 'sepia(.34) saturate(1.45) hue-rotate(-14deg) brightness(1.02)', FRAIS = 'saturate(.94) brightness(1.04)';
    const cycle = function (suf, dl) {
      return c + ' .hf-cadre.' + suf + ' .hf-chaud,' + c + ' .hf-cadre.' + suf + ' .hf-halo i:first-child{animation:' + k + 'part' + (dl ? '2' : '') + ' 2.4s ease ' + (dl ? '.25s' : '1.3s') + ' both}' +
        c + ' .hf-cadre.' + suf + ' .hf-frais,' + c + ' .hf-cadre.' + suf + ' .hf-halo i:last-child{animation:' + k + 'vient' + (dl ? '2' : '') + ' 2.6s ease ' + (dl ? '.15s' : '1.2s') + ' both}' +
        c + ' .hf-cadre.' + suf + ' .hf-givre{animation:' + k + 'vient' + (dl ? '2' : '') + ' 3.2s ease ' + (dl ? '.6s' : '1.7s') + ' both}' +
        c + ' .hf-cadre.' + suf + ' .hf-cristaux{animation:' + k + 'vient' + (dl ? '2' : '') + ' 2s ease ' + (dl ? '.7s' : '1.8s') + ' both}' +
        c + ' .hf-cadre.' + suf + ' .hf-nappe path{animation:' + k + 'nappe' + (dl ? '2' : '') + ' 2.9s cubic-bezier(.45,0,.55,1) calc(' + (dl ? '.1s' : '1.1s') + ' + var(--k) * .18s) 2 both}' +
        c + ' .hf-cadre.' + suf + ' .hf-filet path{animation:' + k + 'filet' + (dl ? '2' : '') + ' 2.9s cubic-bezier(.45,0,.55,1) calc(' + (dl ? '.18s' : '1.18s') + ' + var(--k) * .18s) 2 both}' +
        c + ' .hf-cadre.' + suf + ' .hf-vitre>.ph img{animation:' + k + 'photo' + (dl ? '2' : '') + ' 2.6s ease ' + (dl ? '.2s' : '1.2s') + ' both}' +
        c + ' .hf-cadre.' + suf + ' .hf-btn{animation:' + k + 'appui' + (dl ? '2' : '') + ' .55s ease ' + (dl ? '0s' : '1s') + ' both}' +
        c + ' .hf-cadre.' + suf + ' .hf-btn .ic{animation:' + k + 'tourne' + (dl ? '2' : '') + ' 1.8s cubic-bezier(.2,.7,.2,1) ' + (dl ? '0s' : '1s') + ' both}';
    };
    const kf = function (suf) {
      return '@keyframes ' + k + 'part' + suf + '{from{opacity:1}to{opacity:0}}@keyframes ' + k + 'vient' + suf + '{from{opacity:0}to{opacity:1}}' +
        '@keyframes ' + k + 'photo' + suf + '{from{filter:' + CHAUD + '}to{filter:' + FRAIS + '}}' +
        '@keyframes ' + k + 'nappe' + suf + '{0%{stroke-dashoffset:34;opacity:0}14%{opacity:.62}78%{opacity:.5}100%{stroke-dashoffset:-100;opacity:0}}' +
        '@keyframes ' + k + 'filet' + suf + '{0%{stroke-dashoffset:16;opacity:0}14%{opacity:.75}78%{opacity:.6}100%{stroke-dashoffset:-100;opacity:0}}' +
        '@keyframes ' + k + 'appui' + suf + '{0%,100%{transform:none}35%{transform:scale(.9)}}@keyframes ' + k + 'tourne' + suf + '{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
    };
    return `
${c}{overflow:hidden;color:#fff}
${c}::before{content:"";position:absolute;inset:0;z-index:-3;background:radial-gradient(55% 75% at 76% 46%,color-mix(in srgb,rgb(var(--voile)),#fff 7%),transparent 72%),linear-gradient(165deg,rgb(var(--voile)) 35%,color-mix(in srgb,rgb(var(--voile)),#000 34%))}
${c}::after{content:"";position:absolute;inset:0;z-index:-2;background-image:${GRAIN};background-size:160px;opacity:.06;mix-blend-mode:screen;pointer-events:none}
${c} .hf-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.02fr);gap:clamp(32px,5vw,84px);align-items:center;padding-block:clamp(124px,12vw,164px) clamp(64px,8vw,108px)}
${cssTexte(c, '5.2rem')}
${c} .hf-cadre{position:relative}
${c} .hf-halo{position:absolute;inset:-22% -18%;z-index:-1;pointer-events:none}
${c} .hf-halo i{position:absolute;inset:0}
${c} .hf-halo i:first-child{background:radial-gradient(closest-side,rgb(${SOLEIL} / .2),transparent);opacity:0}
${c} .hf-halo i:last-child{background:radial-gradient(closest-side,rgb(${GLACE} / .24),transparent)}
${c} .hf-vitre{position:relative;isolation:isolate;overflow:hidden;border-radius:var(--rp);aspect-ratio:5/5.3;max-height:calc(100vh - 210px);width:100%;box-shadow:0 60px 110px -60px rgb(0 0 0 / .85);background:rgb(var(--voile))}
${c} .hf-vitre::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .16);pointer-events:none;z-index:6}
${c} .hf-vitre>.ph{position:absolute;inset:0;border-radius:0}
${c} .hf-vitre>.ph img{filter:${FRAIS}}
.js ${c} .hf-cadre:not(.vu) .hf-vitre>.ph img,${c} .hf-cadre.re .hf-vitre>.ph img{filter:${CHAUD}}
${c} .hf-vide{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(85% 75% at 30% 22%,color-mix(in srgb,rgb(var(--voile)),#fff 14%),transparent 70%),linear-gradient(160deg,color-mix(in srgb,rgb(var(--voile)),#fff 6%),rgb(var(--voile)))}
${c} .hf-flo{width:46%;height:auto;fill:none;stroke:#fff;stroke-width:.55;stroke-linecap:round;stroke-linejoin:round;opacity:.55}
${c} .hf-chaud,${c} .hf-frais,${c} .hf-givre{position:absolute;inset:0;pointer-events:none}
${c} .hf-chaud{z-index:1;background:linear-gradient(160deg,rgb(${SOLEIL} / .5),rgb(${SOLEIL} / .24) 48%,rgb(${SOLEIL} / .38));mix-blend-mode:multiply;opacity:0}
${c} .hf-frais{z-index:2;background:radial-gradient(125% 95% at 0% 0%,rgb(${GLACE} / .56),rgb(${GLACE} / .16) 46%,transparent 76%),linear-gradient(rgb(${GLACE} / .12),rgb(${GLACE} / .12));mix-blend-mode:screen}
${c} .hf-givre{z-index:3;background:radial-gradient(118% 92% at 50% 50%,transparent 60%,rgb(255 255 255 / .26) 100%)}
${c} .hf-givre::after{content:"";position:absolute;inset:0;background-image:${GRAIN};background-size:120px;mix-blend-mode:screen;opacity:.5;-webkit-mask-image:radial-gradient(110% 90% at 50% 50%,transparent 62%,#000 100%);mask-image:radial-gradient(110% 90% at 50% 50%,transparent 62%,#000 100%)}
${c} .hf-cadre.sans .hf-chaud{mix-blend-mode:normal;background:radial-gradient(80% 70% at 50% 62%,rgb(${SOLEIL} / .34),rgb(${SOLEIL} / .08) 60%,transparent 80%)}
${c} .hf-souffle{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none}
${c} .hf-nappe path{stroke-dasharray:34 166;stroke-dashoffset:34}
${c} .hf-filet path{stroke-dasharray:16 184;stroke-dashoffset:16}
${c} .hf-cristaux{position:absolute;inset:0;z-index:5;pointer-events:none}
${c} .hf-cristaux i{position:absolute;left:var(--x);top:var(--y);width:calc(9px * var(--s));height:calc(9px * var(--s));border-radius:50%;background:radial-gradient(circle,#fff 0,rgb(255 255 255 / .9) 28%,transparent 70%);opacity:0;animation:${k}cristal var(--t) ease-in-out var(--d) infinite;animation-play-state:paused}
${c} .hf-cristaux i.f{width:calc(15px * var(--s));height:calc(15px * var(--s));background:none;color:#fff;filter:drop-shadow(0 0 4px rgb(${GLACE} / .9))}
${c} .hf-cristaux i.f .ic{width:100%;height:100%;stroke-width:2.2}
${c}.vit .hf-cristaux i{animation-play-state:running}
${c} .hf-btn{position:absolute;left:clamp(12px,2vw,20px);bottom:clamp(12px,2vw,20px);z-index:7;display:none;align-items:center;gap:10px;min-height:46px;padding:0 18px 0 8px;border:1px solid rgb(255 255 255 / .38);border-radius:999px;background:rgb(var(--voile) / .38);-webkit-backdrop-filter:blur(10px) saturate(1.2);backdrop-filter:blur(10px) saturate(1.2);color:#fff;font:var(--fxf) .95rem/1 var(--fx);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color .3s,border-color .3s}
${c} .hf-btn .ic{width:30px;height:30px;padding:6px;border-radius:50%;background:rgb(255 255 255 / .18)}
${c} .hf-btn:hover,${c} .hf-btn:focus-visible{background:rgb(var(--voile) / .58);border-color:rgb(255 255 255 / .7)}
${c} .hf-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
.js ${c} .hf-btn{display:inline-flex}
.js ${c} .hf-cadre:not(.vu) .hf-chaud,.js ${c} .hf-cadre:not(.vu) .hf-halo i:first-child,${c} .hf-cadre.re .hf-chaud,${c} .hf-cadre.re .hf-halo i:first-child{opacity:1}
.js ${c} .hf-cadre:not(.vu) .hf-frais,.js ${c} .hf-cadre:not(.vu) .hf-givre,.js ${c} .hf-cadre:not(.vu) .hf-cristaux,.js ${c} .hf-cadre:not(.vu) .hf-halo i:last-child,${c} .hf-cadre.re .hf-frais,${c} .hf-cadre.re .hf-givre,${c} .hf-cadre.re .hf-cristaux,${c} .hf-cadre.re .hf-halo i:last-child{opacity:0}
${cycle('vu', false)}
${c} .hf-cadre.re .hf-chaud,${c} .hf-cadre.re .hf-frais,${c} .hf-cadre.re .hf-givre,${c} .hf-cadre.re .hf-cristaux,${c} .hf-cadre.re .hf-halo i,${c} .hf-cadre.re .hf-souffle path,${c} .hf-cadre.re .hf-btn,${c} .hf-cadre.re .hf-btn .ic,${c} .hf-cadre.re .hf-vitre>.ph img{animation:none;transition:opacity .45s ease,filter .45s ease}
${cycle('rejeu', true)}
${kf('')}${kf('2')}
@keyframes ${k}cristal{0%{transform:translate3d(0,0,0) scale(.5) rotate(0deg);opacity:0}25%{opacity:.95}75%{opacity:.7}100%{transform:translate3d(70px,80px,0) scale(1) rotate(90deg);opacity:0}}
${cssEntree(c, 'fraicheur')}
@media(max-width:860px){${c} .hf-g{grid-template-columns:1fr;padding-block:112px 56px}${c} .hf-vitre{aspect-ratio:4/3.5;max-height:none}${c} .hf-halo{inset:-10% -8%}}
@media(prefers-reduced-motion:reduce){${c} .hf-chaud,${c} .hf-halo i:first-child{opacity:0!important}${c} .hf-frais,${c} .hf-givre,${c} .hf-halo i:last-child{opacity:1!important}${c} .hf-cristaux,${c} .hf-btn,${c} .hf-souffle{display:none!important}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── le courant : un circuit où court le courant, jusqu'aux boutons ── */
const CIRCUIT = (function () {
  const L = function (p) { return 'M' + p.map(function (q) { return q[0] + ' ' + q[1]; }).join('L'); };
  // les pistes : [points, impulsion [durée, retard] ou null] ; les bus gardent leur écart dans les virages à 45°
  const P = [
    [[[1640, 170], [1330, 170], [1270, 110], [1060, 110]], [4.6, 0.3]],
    [[[1640, 206], [1315, 206], [1255, 146], [950, 146]], [6.2, 2.1]],
    [[[1640, 242], [1300, 242], [1240, 182], [1150, 182]], null],
    [[[1640, 470], [1400, 470], [1310, 560], [1170, 560]], [5.4, 1.1]],
    [[[1640, 506], [1415, 506], [1325, 596], [1030, 596]], [6.8, 3.4]],
    [[[1640, 542], [1430, 542], [1340, 632], [1230, 632]], null],
    [[[1640, 578], [1445, 578], [1355, 668], [1290, 668], [1250, 708], [1250, 1040]], [5.8, 2.6]],
    [[[1180, 1040], [1180, 900], [1120, 840], [1120, 760]], [4.9, 1.6]],
    [[[1216, 1040], [1216, 885], [1156, 825], [1156, 720]], null],
    [[[1470, -40], [1470, 50], [1420, 100], [1340, 100]], [3.9, 0.8]],
    [[[1640, 860], [1520, 860], [1470, 910], [1470, 1040]], null]
  ];
  let base = '', plots = '', halos = '', imp = '';
  P.forEach(function (t, k) {
    const d = L(t[0]), fin = t[0][t[0].length - 1], dedans = fin[0] > -20 && fin[0] < 1620 && fin[1] > -20 && fin[1] < 1020;
    base += '<path class="hc-t" pathLength="1" d="' + d + '" style="--k:' + k + '"/>';
    const i = t[1];
    if (dedans) {
      plots += '<circle class="hc-pl" cx="' + fin[0] + '" cy="' + fin[1] + '" r="7" style="--k:' + k + '"/>';
      if (i) halos += '<circle class="hc-ha" cx="' + fin[0] + '" cy="' + fin[1] + '" r="7" style="--t:' + i[0] + 's;--d:' + r2(i[1] + 1.6) + 's"/>';
    }
    if (i) {
      const d0 = i[1] + 1.6, trace = r2(d0 + 8.5 / 200 * i[0]);
      imp += '<path class="hc-p hc-l" pathLength="100" d="' + d + '" style="--t:' + i[0] + 's;--d:' + trace + 's"/><path class="hc-p hc-q" pathLength="100" d="' + d + '" style="--t:' + i[0] + 's;--d:' + trace + 's"/><path class="hc-p hc-h" pathLength="100" d="' + d + '" style="--t:' + i[0] + 's;--d:' + r2(d0) + 's"/>';
    }
  });
  return '<svg class="hc-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false"><g class="hc-base" fill="none">' + base + '</g><g class="hc-imp" fill="none" stroke-linecap="round">' + imp + '</g><g class="hc-halos">' + halos + '</g><g class="hc-plots">' + plots + '</g></svg>';
})();
const heroCourant = {
  id: 'hero.courant', rubrique: 'hero', nom: 'Le courant court dans un circuit',
  quand: 'électricité, solaire, bornes de recharge, domotique : un circuit se dessine sur la photo et le courant y court jusqu\'aux boutons',
  familles: ['atelier'], ambiances: ['franc', 'premium'], surfaces: ['photo'], js: ['parallaxe'],
  besoin: pour(RX.courant),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.courant', bloc, 'h' + (ph ? '' : ' sans')) + '" aria-label="Présentation">' + h.fond(bloc) + photoPleine(ctx) +
      '<div class="hp-voile" aria-hidden="true"></div>' +
      '<div class="hc-scene" data-r="scene" aria-hidden="true"><div class="hc-noir"></div>' + CIRCUIT + '</div>' +
      '<div class="w"><div class="h-txt cq">' + corps(spec, ctx, { finActions: '<span class="hc-fil" aria-hidden="true"><i></i></span>' }) + '</div></div></section>';
  },
  script: vivant('r-hero-courant', ''),
  css: function () {
    const c = '.r-hero-courant', k = 'k-hero-courant-';
    return cssPlein(c, { voile: 'linear-gradient(90deg,rgb(var(--voile) / .95) 0%,rgb(var(--voile) / .86) 34%,rgb(var(--voile) / .58) 66%,rgb(var(--voile) / .44) 100%)' }) + `
${c}.sans{background:radial-gradient(60% 70% at 82% 40%,color-mix(in srgb,rgb(var(--voile)),var(--vif) 14%),transparent 70%),radial-gradient(40% 50% at 70% 100%,color-mix(in srgb,rgb(var(--voile)),var(--vif) 8%),transparent 70%),rgb(var(--voile))}
${c}.sans .hp-voile{background:linear-gradient(90deg,rgb(var(--voile) / .7),transparent 60%)}
${c} .hc-scene{${DESSUS}}
${c} .hc-noir{position:absolute;inset:0;background:rgb(0 0 0 / .62);opacity:0}
${c} .hc-svg{position:absolute;inset:0;width:100%;height:100%;-webkit-mask-image:linear-gradient(90deg,transparent 26%,rgb(0 0 0 / .5) 44%,#000 62%);mask-image:linear-gradient(90deg,transparent 26%,rgb(0 0 0 / .5) 44%,#000 62%)}
${c} .hc-t{stroke:rgb(255 255 255 / .22);stroke-width:2;stroke-linejoin:round;stroke-dasharray:1 1;stroke-dashoffset:0}
${c} .hc-pl{fill:rgb(var(--voile));stroke:rgb(255 255 255 / .45);stroke-width:2.5;transform-box:fill-box;transform-origin:center}
${c} .hc-ha{fill:var(--vif);opacity:0;transform-box:fill-box;transform-origin:center;animation:${k}halo var(--t) linear var(--d) infinite;animation-play-state:paused}
${c} .hc-p{stroke:var(--vif);stroke-dashoffset:0;opacity:0;animation:${k}flux var(--t) linear var(--d) infinite;animation-play-state:paused}
${c} .hc-l{stroke-width:10;stroke-dasharray:11 189}
${c} .hc-q{stroke-width:3;stroke-dasharray:11 189}
${c} .hc-h{stroke:#fff;stroke-width:3.5;stroke-dasharray:2.5 197.5}
${c}.vit .hc-scene.vu .hc-p,${c}.vit .hc-scene.vu .hc-ha{animation-play-state:running}
${c}.vit .hc-scene.vu .hc-h{opacity:1}
${c}.vit .hc-scene.vu .hc-l{opacity:.3}
${c}.vit .hc-scene.vu .hc-q{opacity:.72}
${c} .hc-scene.vu .hc-t{animation:${k}trace 1.5s cubic-bezier(.65,0,.35,1) calc(.3s + var(--k) * .07s) both}
${c} .hc-scene.vu .hc-pl{animation:${k}pose .6s cubic-bezier(.34,1.56,.64,1) calc(1.35s + var(--k) * .07s) both}
.js ${c} .hc-scene:not(.vu) .hc-noir{opacity:1}
${c} .hc-scene.vu .hc-noir{animation:${k}allume 1.5s linear .35s both}
${c} .h-act .actions{flex-wrap:nowrap}
${c} .hc-fil{position:relative;flex:1 1 0;min-width:0;align-self:center;height:2px}
${c} .hc-fil::before{content:"";position:absolute;left:14px;top:0;width:70vw;height:2px;background:linear-gradient(90deg,rgb(255 255 255 / .5),rgb(255 255 255 / .16) 45%,transparent)}
${c} .hc-fil::after{content:"";position:absolute;left:14px;top:-1px;width:170px;height:4px;border-radius:2px;background:linear-gradient(90deg,#fff,var(--vif) 22%,transparent);opacity:0;transform:translateX(64vw);animation:${k}fil 5.6s cubic-bezier(.4,0,.2,1) 2.4s infinite;animation-play-state:paused}
${c} .hc-fil i{position:absolute;left:6px;top:-5px;width:12px;height:12px;border-radius:50%;border:2px solid rgb(255 255 255 / .7);background:rgb(var(--voile));animation:${k}arrivee 5.6s linear 2.4s infinite;animation-play-state:paused}
${c}.vit .hc-fil::after,${c}.vit .hc-fil i{animation-play-state:running}
@keyframes ${k}trace{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes ${k}pose{from{transform:scale(0)}to{transform:none}}
@keyframes ${k}flux{from{stroke-dashoffset:0}to{stroke-dashoffset:-200}}
@keyframes ${k}halo{0%,44%{opacity:0;transform:scale(.6)}49%{opacity:.95;transform:scale(1.5)}70%,100%{opacity:0;transform:scale(2.6)}}
@keyframes ${k}allume{0%,30%{opacity:1}36%{opacity:.3}42%{opacity:.85}50%{opacity:.15}60%{opacity:.45}100%{opacity:0}}
@keyframes ${k}fil{0%{transform:translateX(64vw);opacity:0}10%{opacity:1}40%{transform:translateX(0);opacity:1}46%,100%{transform:translateX(0);opacity:0}}
@keyframes ${k}arrivee{0%,38%{background:rgb(var(--voile));border-color:rgb(255 255 255 / .7);box-shadow:0 0 0 0 transparent}42%{background:var(--vif);border-color:#fff;box-shadow:0 0 0 6px color-mix(in srgb,var(--vif) 30%,transparent),0 0 26px 6px color-mix(in srgb,var(--vif) 60%,transparent)}60%,100%{background:rgb(var(--voile));border-color:rgb(255 255 255 / .7);box-shadow:0 0 0 0 transparent}}
${cssEntree(c, 'courant', { scene: '.5s' })}
@media(max-width:860px){${c} .hc-svg{-webkit-mask-image:linear-gradient(180deg,#000 0%,#000 30%,rgb(0 0 0 / .25) 58%,transparent 80%);mask-image:linear-gradient(180deg,#000 0%,#000 30%,rgb(0 0 0 / .25) 58%,transparent 80%)}${c} .hc-fil{display:none}${c} .h-act .actions{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){${c} .hc-noir,${c} .hc-p,${c} .hc-ha,${c} .hc-fil::after{display:none}${c} *,${c} .hc-fil::after{animation:none!important;transition:none!important}}
`;
  }
};

/* ── les ondes : la lumière danse au fond de l'eau ── */
const RONDS = [{ x: 64, y: 72, d: 0, r: 220 }, { x: 82, y: 58, d: 1.9, r: 160 }, { x: 74, y: 88, d: 3.4, r: 260 }, { x: 52, y: 84, d: 4.6, r: 180 }];
const heroOndes = {
  id: 'hero.ondes', rubrique: 'hero', nom: 'Reflets dans l\'eau',
  quand: 'piscine, plomberie, mer, eau : la lumière danse au fond de l\'eau, des ronds s\'élargissent, et sous le doigt',
  familles: ['verdure', 'atelier', 'horizon'], ambiances: ['calme', 'premium'], surfaces: ['photo'], js: ['parallaxe'],
  besoin: pour(RX.eau),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const ronds = RONDS.map(function (o) { return '<i style="--x:' + o.x + '%;--y:' + o.y + '%;--d:' + o.d + 's;--r:' + o.r + 'px"></i>'; }).join('');
    return '<section class="' + h.classes('hero.ondes', bloc, 'h' + (ph ? '' : ' sans')) + '" aria-label="Présentation">' + h.fond(bloc) + photoPleine(ctx) +
      '<div class="ho-eau" data-r="scene" aria-hidden="true"><i class="ho-c a"></i><i class="ho-c b"></i><i class="ho-lame"></i></div>' +
      '<div class="hp-voile" aria-hidden="true"></div>' +
      '<div class="ho-ronds" aria-hidden="true">' + ronds + '</div>' +
      '<div class="w"><div class="h-txt cq">' + corps(spec, ctx) + '</div></div></section>';
  },
  script: vivant('r-hero-ondes',
    "var ro=s.querySelector('.ho-ronds');if(!ro)return;var der=0,lx=-999,ly=-999;" +
    "var poser=function(x,y,g){if(ro.childElementCount>16)return;var i=d.createElement('i');i.className='m';i.style.cssText='--x:'+x+'px;--y:'+y+'px;--r:'+(g||(110+Math.random()*90|0))+'px';ro.appendChild(i);setTimeout(function(){if(i.parentNode)i.parentNode.removeChild(i)},2600)};" +
    "var ici=function(e){var r=s.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};" +
    "if(fin)s.addEventListener('pointermove',function(e){var t=Date.now(),p=ici(e);if(t-der<150||Math.abs(p[0]-lx)+Math.abs(p[1]-ly)<80)return;der=t;lx=p[0];ly=p[1];poser(p[0],p[1])},{passive:true});" +
    "s.addEventListener('pointerdown',function(e){var p=ici(e);poser(p[0],p[1],240)},{passive:true});"),
  css: function () {
    const c = '.r-hero-ondes', k = 'k-hero-ondes-';
    return cssPlein(c, { voile: 'linear-gradient(90deg,rgb(var(--voile) / .9) 0%,rgb(var(--voile) / .72) 34%,rgb(var(--voile) / .2) 70%,rgb(var(--voile) / .06) 100%),linear-gradient(0deg,rgb(var(--voile) / .35),transparent 40%)' }) + `
${c}.sans{background:radial-gradient(70% 60% at 75% 100%,color-mix(in srgb,rgb(var(--voile)),var(--vif) 26%),transparent 75%),linear-gradient(180deg,rgb(var(--voile)) 20%,color-mix(in srgb,rgb(var(--voile)),var(--vif) 12%))}
${c}.sans .hp-voile{background:linear-gradient(90deg,rgb(var(--voile) / .7),transparent 62%)}
${c} .ho-eau{${SOUS};-webkit-mask-image:linear-gradient(180deg,transparent 42%,rgb(0 0 0 / .6) 66%,#000 90%);mask-image:linear-gradient(180deg,transparent 42%,rgb(0 0 0 / .6) 66%,#000 90%)}
${c}.sans .ho-eau{-webkit-mask-image:radial-gradient(85% 95% at 82% 78%,#000 30%,transparent 80%);mask-image:radial-gradient(85% 95% at 82% 78%,#000 30%,transparent 80%)}
${c} .ho-c{position:absolute;top:-520px;left:-520px;right:0;bottom:0;background-repeat:repeat;will-change:transform;animation:${k}a 28s linear infinite;animation-play-state:paused}
${c} .ho-c.a{background-image:${CAUSTIQUE_A};background-size:520px;mix-blend-mode:overlay;opacity:.34}
${c} .ho-c.b{background-image:${CAUSTIQUE_B};background-size:420px;mix-blend-mode:soft-light;opacity:.5;animation-name:${k}b;animation-duration:21s}
${c}.sans .ho-c.a{mix-blend-mode:screen;opacity:.2}${c}.sans .ho-c.b{mix-blend-mode:screen;opacity:.14}
${c} .ho-lame{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgb(255 255 255 / .1) 48%,transparent 66%);background-size:250% 100%;mix-blend-mode:screen;animation:${k}lame 11s ease-in-out infinite;animation-play-state:paused}
${c}.vit .ho-c,${c}.vit .ho-lame{animation-play-state:running}
${c} .ho-ronds{${DESSUS}}
${c} .ho-ronds i{position:absolute;left:var(--x);top:var(--y);width:var(--r);height:var(--r);margin:calc(var(--r) / -2) 0 0 calc(var(--r) / -2);border-radius:50%;border:1.5px solid rgb(255 255 255 / .55);opacity:0;transform:scale(.04,.016);animation:${k}rond 6.4s cubic-bezier(.15,.55,.3,1) var(--d) infinite;animation-play-state:paused}
${c} .ho-ronds i::before{content:"";position:absolute;inset:17%;border-radius:50%;border:1px solid rgb(255 255 255 / .4)}
${c} .ho-ronds i.m{animation:${k}doigt 2.5s cubic-bezier(.15,.55,.3,1) both}
${c}.vit .ho-ronds i{animation-play-state:running}
@keyframes ${k}a{from{transform:translate3d(0,0,0)}to{transform:translate3d(520px,520px,0)}}
@keyframes ${k}b{from{transform:translate3d(420px,0,0)}to{transform:translate3d(0,420px,0)}}
@keyframes ${k}lame{0%,100%{background-position:100% 0}50%{background-position:0 0}}
@keyframes ${k}rond{0%{transform:scale(.04,.016);opacity:0}6%{opacity:.85}60%{opacity:.25}100%{transform:scale(1,.38);opacity:0}}
@keyframes ${k}doigt{0%{transform:scale(.04,.016);opacity:0}8%{opacity:.9}100%{transform:scale(1,.4);opacity:0}}
${cssEntree(c, 'ondes', { scene: '2.6s' })}
@media(max-width:860px){${c} .ho-eau{-webkit-mask-image:linear-gradient(180deg,#000 0%,rgb(0 0 0 / .8) 30%,transparent 62%);mask-image:linear-gradient(180deg,#000 0%,rgb(0 0 0 / .8) 30%,transparent 62%)}${c} .ho-ronds i{top:calc(var(--y) - 46%)}}
@media(prefers-reduced-motion:reduce){${c} .ho-ronds{display:none}${c} .ho-c{opacity:.6!important}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── la vapeur : une buée se lève, des volutes montent de la cuisine ── */
const VAPEURS = [{ x: 58, b: 2, w: 280, t: 11, d: -1, o: 0.3, dx: -40, r: -7, v: 0 }, { x: 70, b: -2, w: 340, t: 13, d: -6, o: 0.34, dx: 50, r: 9, v: 1 }, { x: 83, b: 4, w: 300, t: 12, d: -3.5, o: 0.3, dx: -60, r: -11, v: 2 }, { x: 93, b: 0, w: 320, t: 14, d: -9.5, o: 0.26, dx: 36, r: 8, v: 1 }, { x: 46, b: 4, w: 260, t: 12.5, d: -4.5, o: 0.14, dx: 24, r: 6, v: 2 }, { x: 76, b: 10, w: 240, t: 10, d: -8, o: 0.22, dx: -24, r: -6, v: 0 }, { x: 64, b: 8, w: 220, t: 9.5, d: -2.6, o: 0.2, dx: 30, r: 5, v: 2 }];
const heroVapeur = {
  id: 'hero.vapeur', rubrique: 'hero', nom: 'La vapeur qui monte',
  quand: 'restaurant, traiteur, boulangerie, snack : une buée se lève sur la photo, puis des volutes de vapeur montent doucement',
  familles: ['comptoir'], ambiances: ['chaleureux', 'premium'], surfaces: ['photo'], js: ['parallaxe'],
  besoin: pour(RX.table),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const v = VAPEURS.map(function (o) { return '<i class="v' + o.v + '" style="--x:' + o.x + '%;--b:' + o.b + '%;--l:' + o.w + 'px;--t:' + o.t + 's;--d:' + o.d + 's;--o:' + o.o + ';--dx:' + o.dx + 'px;--rt:' + o.r + 'deg"></i>'; }).join('');
    return '<section class="' + h.classes('hero.vapeur', bloc, 'h' + (ph ? '' : ' sans')) + '" aria-label="Présentation">' + h.fond(bloc) + photoPleine(ctx, { px: 0.12 }) +
      '<div class="hp-voile" aria-hidden="true"></div>' +
      '<div class="hv-scene" data-r="scene" aria-hidden="true"><div class="hv-lueur"></div><div class="hv-volutes">' + v + '</div><div class="hv-buee"></div></div>' +
      '<div class="w"><div class="h-txt cq">' + corps(spec, ctx) + '</div></div></section>';
  },
  script: vivant('r-hero-vapeur', ''),
  css: function () {
    const c = '.r-hero-vapeur', k = 'k-hero-vapeur-';
    return cssPlein(c, { voile: 'linear-gradient(90deg,rgb(var(--voile) / .9) 0%,rgb(var(--voile) / .74) 34%,rgb(var(--voile) / .3) 68%,rgb(var(--voile) / .2) 100%),linear-gradient(0deg,rgb(var(--voile) / .55),transparent 45%)' }) + `
${c}.sans{background:radial-gradient(70% 55% at 72% 105%,rgb(${SOLEIL} / .2),transparent 70%),radial-gradient(50% 50% at 90% 10%,color-mix(in srgb,rgb(var(--voile)),#fff 6%),transparent 70%),linear-gradient(180deg,rgb(var(--voile)),color-mix(in srgb,rgb(var(--voile)),#000 26%))}
${c}.sans .hp-voile{background:none}
${c} .hv-scene{${DESSUS}}
${c} .hv-lueur{position:absolute;left:30%;right:-10%;bottom:-30%;height:70%;background:radial-gradient(closest-side,rgb(${SOLEIL} / .24),transparent);mix-blend-mode:soft-light;animation:${k}lueur 7s ease-in-out infinite alternate;animation-play-state:paused}
${c}.sans .hv-lueur{mix-blend-mode:screen;opacity:.6}
${c} .hv-volutes{position:absolute;inset:0;-webkit-mask-image:linear-gradient(90deg,rgb(0 0 0 / .25) 20%,#000 52%);mask-image:linear-gradient(90deg,rgb(0 0 0 / .25) 20%,#000 52%)}
${c} .hv-volutes i{position:absolute;left:var(--x);bottom:var(--b);width:var(--l);aspect-ratio:300/700;--o2:calc(var(--o) * 1.3);background:${VOLUTES[0]} center/100% 100% no-repeat;opacity:0;transform-origin:50% 100%;will-change:transform,opacity;animation:${k}monte var(--t) cubic-bezier(.3,.1,.4,1) var(--d) infinite;animation-play-state:paused}
${c} .hv-volutes i.v1{background-image:${VOLUTES[1]}}${c} .hv-volutes i.v2{background-image:${VOLUTES[2]}}
${c}.vit .hv-volutes i,${c}.vit .hv-lueur{animation-play-state:running}
${c} .hv-buee{position:absolute;inset:-6% -6% -24%;background:radial-gradient(52% 46% at 26% 74%,rgb(255 255 255 / .55),transparent 72%),radial-gradient(50% 42% at 70% 66%,rgb(255 255 255 / .5),transparent 72%),radial-gradient(80% 44% at 50% 104%,rgb(255 255 255 / .62),transparent 72%),radial-gradient(40% 36% at 88% 30%,rgb(255 255 255 / .3),transparent 70%);opacity:0;pointer-events:none}
.js ${c} .hv-scene:not(.vu) .hv-buee{opacity:1}
${c} .hv-scene.vu .hv-buee{animation:${k}buee 3.4s cubic-bezier(.25,.6,.3,1) .2s both}
@keyframes ${k}buee{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,-22%,0) scale(1.08)}}
@keyframes ${k}monte{0%{transform:translate3d(-50%,18%,0) scale(.42,.6) rotate(0deg);opacity:0}18%{opacity:var(--o2)}50%{transform:translate3d(calc(-50% + var(--dx) * .3),-20%,0) scale(.85,.9) rotate(calc(var(--rt) * -.4))}66%{opacity:calc(var(--o2) * .6)}100%{transform:translate3d(calc(-50% + var(--dx)),-60%,0) scale(1.35,1.2) rotate(var(--rt));opacity:0}}
@keyframes ${k}lueur{from{opacity:.75;transform:scale(1)}to{opacity:1;transform:scale(1.06)}}
${cssEntree(c, 'vapeur', { scene: '.4s' })}
@media(max-width:860px){${c} .hv-volutes{-webkit-mask-image:linear-gradient(180deg,#000 10%,rgb(0 0 0 / .4) 50%,transparent 75%);mask-image:linear-gradient(180deg,#000 10%,rgb(0 0 0 / .4) 50%,transparent 75%)}${c} .hv-volutes i{bottom:calc(var(--b) + 34%);width:calc(var(--l) * .72)}}
@media(prefers-reduced-motion:reduce){${c} .hv-buee,${c} .hv-volutes{display:none}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── la brise : des palmes en silhouette se balancent, la lumière filtre ── */
// une palme : un rachis courbe (Bézier), des folioles effilées de part et d'autre, plus longues au milieu
function palme(o) {
  const g = graine(o.graine || 'palme');
  const B = o.base, C = o.ctrl, E = o.bout, n = o.n || 34;
  const bez = function (t) { const u = 1 - t; return [u * u * B[0] + 2 * u * t * C[0] + t * t * E[0], u * u * B[1] + 2 * u * t * C[1] + t * t * E[1]]; };
  const tan = function (t) { const x = 2 * (1 - t) * (C[0] - B[0]) + 2 * t * (E[0] - C[0]), y = 2 * (1 - t) * (C[1] - B[1]) + 2 * t * (E[1] - C[1]); const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const rot = function (v, a) { const cs = Math.cos(a), sn = Math.sin(a); return [v[0] * cs - v[1] * sn, v[0] * sn + v[1] * cs]; };
  let d = '';
  for (let k = 0; k < n; k++) {
    const t = 0.1 + 0.88 * k / (n - 1);
    const P = bez(t), Tg = tan(t);
    [-1, 1].forEach(function (cote) {
      const ang = cote * (Math.PI / 180) * (68 - 34 * t + (g() - 0.5) * 8);
      const D = rot(Tg, ang);
      const L = o.long * (0.32 + 0.68 * Math.sin(Math.PI * Math.min(1, t * 1.08))) * (0.88 + g() * 0.2);
      const chute = o.chute * L;
      const tip = [P[0] + D[0] * L, P[1] + D[1] * L + chute];
      const N = [-D[1], D[0]], lw = o.large * (1 - 0.5 * t);
      const m1 = [P[0] + D[0] * L * 0.45 + N[0] * lw, P[1] + D[1] * L * 0.45 + N[1] * lw + chute * 0.3];
      const m2 = [P[0] + D[0] * L * 0.45 - N[0] * lw, P[1] + D[1] * L * 0.45 - N[1] * lw + chute * 0.3];
      d += 'M' + r2(P[0]) + ' ' + r2(P[1]) + 'Q' + r2(m1[0]) + ' ' + r2(m1[1]) + ' ' + r2(tip[0]) + ' ' + r2(tip[1]) + 'Q' + r2(m2[0]) + ' ' + r2(m2[1]) + ' ' + r2(P[0]) + ' ' + r2(P[1]) + 'Z';
    });
  }
  const rachis = 'M' + B.join(' ') + 'Q' + C.join(' ') + ' ' + E.join(' ');
  return '<svg class="hb-f" viewBox="' + o.vb + '" aria-hidden="true" focusable="false"><path d="' + d + '" fill="currentColor"/><path d="' + rachis + '" fill="none" stroke="currentColor" stroke-width="' + (o.tige || 6) + '" stroke-linecap="round"/></svg>';
}
// une feuille de bananier : le limbe est continu près de la nervure, puis déchiré en lanières le long des nervures
// obliques jusqu'au bord ; un point du limbe = (t le long de la nervure, u la part de la largeur)
function bananier(o) {
  const g = graine(o.graine || 'banane');
  const B = o.base, C = o.ctrl, E = o.bout, obl = 0.045;
  const bez = function (t) { const u = 1 - t; return [u * u * B[0] + 2 * u * t * C[0] + t * t * E[0], u * u * B[1] + 2 * u * t * C[1] + t * t * E[1]]; };
  const tan = function (t) { const x = 2 * (1 - t) * (C[0] - B[0]) + 2 * t * (E[0] - C[0]), y = 2 * (1 - t) * (C[1] - B[1]) + 2 * t * (E[1] - C[1]); const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const larg = function (t) { const x = Math.max(0, Math.min(1, t)); return o.large * Math.pow(Math.sin(Math.PI * x), 0.55) * (1 - 0.18 * x); };
  const pt = function (t, u, cote) { const tt = Math.min(1, t + obl * u), P = bez(tt), T0 = tan(tt), w = larg(tt) * u * cote; return r2(P[0] - T0[1] * w) + ' ' + r2(P[1] + T0[0] * w); };
  const bande = function (ta, tb, ua, ub, cote) {
    const n = Math.max(2, Math.ceil((tb - ta) * 40)); let s = 'M' + pt(ta, ua, cote);
    for (let k = 0; k <= n; k++) s += 'L' + pt(ta + (tb - ta) * k / n, ub, cote);
    for (let k = n; k >= 0; k--) s += 'L' + pt(ta + (tb - ta) * k / n, ua, cote);
    return s + 'Z';
  };
  let d = '';
  [-1, 1].forEach(function (cote) {
    d += bande(0.02, 0.98, 0, 0.3, cote);
    const coupes = [0.04];
    while (coupes[coupes.length - 1] < 0.9) coupes.push(coupes[coupes.length - 1] + 0.07 + g() * 0.11);
    coupes[coupes.length - 1] = 0.985;
    for (let k = 0; k < coupes.length - 1; k++) d += bande(coupes[k] + 0.004, coupes[k + 1] - 0.004, 0.24, 1, cote);
  });
  return '<svg class="hb-f" viewBox="' + o.vb + '" aria-hidden="true" focusable="false"><path d="' + d + '" fill="currentColor"/><path d="M' + B.join(' ') + 'Q' + C.join(' ') + ' ' + E.join(' ') + '" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
}
const FEUILLAGE = '<span class="hb-e a">' + palme({ vb: '0 0 640 640', base: [660, -30], ctrl: [420, 60], bout: [120, 380], long: 150, large: 9, chute: 0.22, graine: 'pa' }) + '</span>' +
  '<span class="hb-e b">' + palme({ vb: '0 0 560 560', base: [590, 300], ctrl: [400, 170], bout: [70, 160], long: 120, large: 8, chute: 0.3, n: 30, graine: 'pb', tige: 5 }) + '</span>' +
  '<span class="hb-e c">' + bananier({ vb: '0 0 520 640', base: [560, 680], ctrl: [380, 380], bout: [110, 70], large: 92, graine: 'bc' }) + '</span>';
const TACHES = [{ x: 62, y: 30, s: 260, t: 9, d: -2 }, { x: 78, y: 54, s: 200, t: 11, d: -6 }, { x: 54, y: 70, s: 300, t: 13, d: -4 }, { x: 88, y: 26, s: 170, t: 8, d: -1 }, { x: 70, y: 84, s: 220, t: 10, d: -7 }, { x: 44, y: 42, s: 160, t: 12, d: -3 }];
const heroBrise = {
  id: 'hero.brise', rubrique: 'hero', nom: 'Palmes dans la brise',
  quand: 'jardin, paysagiste, élagage, pépinière, fleuriste : des palmes en silhouette se balancent devant la photo, la lumière filtre',
  familles: ['verdure', 'boutique'], ambiances: ['chaleureux', 'calme'], surfaces: ['photo'], js: ['parallaxe'],
  besoin: pour(RX.jardin),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const taches = TACHES.map(function (o) { return '<i style="--x:' + o.x + '%;--y:' + o.y + '%;--s:' + o.s + 'px;--t:' + o.t + 's;--d:' + o.d + 's"></i>'; }).join('');
    return '<section class="' + h.classes('hero.brise', bloc, 'h' + (ph ? '' : ' sans')) + '" aria-label="Présentation">' + h.fond(bloc) + photoPleine(ctx) +
      '<div class="hb-lumiere" aria-hidden="true"><i class="hb-rayons"></i><span class="hb-taches">' + taches + '</span></div>' +
      '<div class="hp-voile" aria-hidden="true"></div>' +
      '<div class="hb-scene" data-r="scene" aria-hidden="true">' + FEUILLAGE + '</div>' +
      '<div class="w"><div class="h-txt cq">' + corps(spec, ctx) + '</div></div></section>';
  },
  script: vivant('r-hero-brise', ''),
  css: function () {
    const c = '.r-hero-brise', k = 'k-hero-brise-';
    return cssPlein(c) + `
${c}.sans{background:radial-gradient(45% 55% at 84% 16%,color-mix(in srgb,rgb(var(--voile)),rgb(${SOLEIL}) 34%),transparent 72%),radial-gradient(75% 80% at 88% 8%,color-mix(in srgb,rgb(var(--voile)),#fff 18%),transparent 74%),radial-gradient(50% 60% at 60% 100%,color-mix(in srgb,rgb(var(--voile)),var(--vif) 10%),transparent 70%),rgb(var(--voile))}
${c}.sans .hb-scene{color:color-mix(in srgb,rgb(var(--voile)),#000 42%)}
${c}.sans .hp-voile{background:linear-gradient(90deg,rgb(var(--voile) / .6),transparent 60%)}
${c} .hb-lumiere{${SOUS}}
${c} .hb-rayons{position:absolute;inset:-20% -10% 0 20%;background:repeating-linear-gradient(118deg,transparent 0 70px,rgb(255 255 255 / .12) 70px 104px,transparent 104px 190px,rgb(255 255 255 / .07) 190px 214px,transparent 214px 300px);-webkit-mask-image:radial-gradient(75% 85% at 92% 0%,#000,transparent 75%);mask-image:radial-gradient(75% 85% at 92% 0%,#000,transparent 75%);mix-blend-mode:screen;filter:blur(6px);animation:${k}rayons 12s ease-in-out infinite alternate;animation-play-state:paused}
${c} .hb-taches i{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);margin:calc(var(--s) / -2) 0 0 calc(var(--s) / -2);border-radius:50%;background:radial-gradient(closest-side,rgb(255 255 255 / .5),rgb(${SOLEIL} / .12) 55%,transparent);mix-blend-mode:soft-light;animation:${k}tache var(--t) ease-in-out var(--d) infinite alternate;animation-play-state:paused}
${c}.sans .hb-taches i{mix-blend-mode:screen;opacity:.16}
${c} .hb-scene{${DESSUS};color:rgb(var(--voile) / .94)}
${c} .hb-e{position:absolute;display:block}
${c} .hb-e .hb-f{display:block;width:100%;height:auto;will-change:transform}
${c} .hb-e.a{top:-6%;right:-5%;width:min(48vw,700px)}
${c} .hb-e.a .hb-f{transform-origin:100% 0;animation:${k}a 7s ease-in-out infinite alternate;animation-play-state:paused}
${c} .hb-e.b{top:34%;right:-7%;width:min(34vw,480px);opacity:.8;filter:blur(1.5px)}
${c} .hb-e.b .hb-f{transform-origin:100% 55%;animation:${k}b 9s ease-in-out -3s infinite alternate;animation-play-state:paused}
${c} .hb-e.c{bottom:-12%;right:16%;width:min(26vw,360px);opacity:.92}
${c} .hb-e.c .hb-f{transform-origin:100% 100%;animation:${k}c 8s ease-in-out -2s infinite alternate;animation-play-state:paused}
${c}.vit .hb-e .hb-f,${c}.vit .hb-rayons,${c}.vit .hb-taches i{animation-play-state:running}
${c} .hb-scene.vu .hb-e.a{animation:${k}entre 2.4s cubic-bezier(.2,.7,.2,1) .15s both}
${c} .hb-scene.vu .hb-e.b{animation:${k}entre 2.6s cubic-bezier(.2,.7,.2,1) .4s both}
${c} .hb-scene.vu .hb-e.c{animation:${k}entre-bas 2.4s cubic-bezier(.2,.7,.2,1) .6s both}
@keyframes ${k}entre{from{transform:translate3d(6%,-8%,0) rotate(-7deg);opacity:0}}
@keyframes ${k}entre-bas{from{transform:translate3d(4%,12%,0) rotate(7deg);opacity:0}}
@keyframes ${k}a{from{transform:rotate(-1.6deg)}to{transform:rotate(2.4deg)}}
@keyframes ${k}b{from{transform:rotate(2deg) skewY(-1deg)}to{transform:rotate(-2.4deg) skewY(1deg)}}
@keyframes ${k}c{from{transform:rotate(-2deg)}to{transform:rotate(1.8deg)}}
@keyframes ${k}rayons{from{transform:translate3d(-2%,0,0);opacity:.7}to{transform:translate3d(2%,0,0);opacity:1}}
@keyframes ${k}tache{from{transform:translate3d(-14px,-8px,0) scale(.92);opacity:.6}to{transform:translate3d(16px,10px,0) scale(1.08);opacity:1}}
${cssEntree(c, 'brise', { scene: '.3s' })}
@media(max-width:860px){${c} .hb-e.a{width:78vw;top:-4%;right:-12%}${c} .hb-e.b{width:56vw;top:18%;right:-16%}${c} .hb-e.c{display:none}}
@media(prefers-reduced-motion:reduce){${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── l'éclat : la raclette nettoie la photo, la vitre scintille ── */
const ECLATS = [{ x: 30, y: 26, s: 30, d: 2.7, t: 4.2 }, { x: 72, y: 18, s: 20, d: 3.1, t: 5.1 }, { x: 58, y: 62, s: 38, d: 3.5, t: 4.6 }, { x: 86, y: 74, s: 24, d: 3.9, t: 5.6 }, { x: 40, y: 82, s: 18, d: 4.3, t: 4.9 }];
const heroEclat = {
  id: 'hero.eclat', rubrique: 'hero', nom: 'La vitre nettoyée',
  quand: 'nettoyage, vitres, ménage, propreté : une raclette passe sur la photo et la rend nette, puis des éclats scintillent',
  familles: ['verdure', 'atelier'], ambiances: ['calme', 'franc'], surfaces: ['photo'], js: [],
  besoin: pour(RX.propre),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const eclats = ECLATS.map(function (o) { return '<i style="--x:' + o.x + '%;--y:' + o.y + '%;--s:' + o.s + 'px;--d:' + o.d + 's;--t:' + o.t + 's"></i>'; }).join('');
    const vitre = ph ? h.figure(ph, 'eager', '(max-width:860px) 100vw, 60vw') : '<div class="he-vide">' + h.icone(ctx.iconeMetier === 'check' ? 'etincelles' : ctx.iconeMetier, 'he-ico') + '</div>';
    return '<section class="' + h.classes('hero.eclat', bloc, 'h' + (ph ? '' : ' sans')) + '" aria-label="Présentation">' + h.fond(bloc) +
      '<div class="he-vitre"><div class="he-pan" data-r="scene">' + vitre + '<div class="he-sale" aria-hidden="true"></div><div class="he-raclette" aria-hidden="true"><i></i></div><div class="he-reflet" aria-hidden="true"></div><div class="he-eclats" aria-hidden="true">' + eclats + '</div></div></div>' +
      '<div class="w"><div class="h-txt cq">' + corps(spec, ctx) + '</div></div></section>';
  },
  script: vivant('r-hero-eclat',
    "var v=s.querySelector('.he-vitre');if(!v||!fin)return;var tk=0;v.addEventListener('pointermove',function(e){if(tk)return;tk=1;requestAnimationFrame(function(){tk=0;var r=v.getBoundingClientRect();v.style.setProperty('--mx',(e.clientX-r.left)+'px');v.style.setProperty('--my',(e.clientY-r.top)+'px');v.classList.add('lu')})},{passive:true});v.addEventListener('pointerleave',function(){v.classList.remove('lu')});"),
  css: function () {
    const c = '.r-hero-eclat', k = 'k-hero-eclat-';
    return `
${c}{min-height:clamp(620px,92vh,900px);display:grid;align-items:center;overflow:hidden;color:#fff}
${c}::before{content:"";position:absolute;inset:0;z-index:-4;background:radial-gradient(60% 80% at 20% 30%,color-mix(in srgb,rgb(var(--voile)),#fff 8%),transparent 70%),linear-gradient(170deg,rgb(var(--voile)),color-mix(in srgb,rgb(var(--voile)),#000 28%))}
${c} .w{position:relative;padding-block:clamp(132px,13vw,176px) clamp(76px,9vw,120px)}
${c} .h-txt{max-width:min(560px,40vw)}
${cssTexte(c, '5rem')}
${c} .he-vitre{position:absolute;top:0;right:0;bottom:0;width:58%;z-index:-2;clip-path:polygon(16% 0,100% 0,100% 100%,0 100%);container-type:size;background:rgb(var(--voile))}
${c} .he-pan{position:absolute;inset:0}
${c} .he-pan>.ph{position:absolute;inset:0;border-radius:0}
${c} .he-vitre::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(240px circle at var(--mx,50%) var(--my,50%),rgb(255 255 255 / .16),transparent 70%);opacity:0;transition:opacity .4s;mix-blend-mode:screen}
${c} .he-vitre.lu::after{opacity:1}
${c} .he-vitre::before{content:"";position:absolute;left:0;right:0;top:0;height:min(32%,210px);z-index:1;pointer-events:none;background:linear-gradient(180deg,rgb(var(--voile) / .72),rgb(var(--voile) / .3) 48%,transparent)}
${c} .he-vide{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(125deg,color-mix(in srgb,rgb(var(--voile)),#fff 18%),rgb(var(--voile)) 55%,color-mix(in srgb,rgb(var(--voile)),#fff 8%))}
${c} .he-ico{width:34%;height:auto;fill:none;stroke:#fff;stroke-width:.6;stroke-linecap:round;stroke-linejoin:round;opacity:.75;margin-left:12%}
${c} .he-sale{position:absolute;inset:0;clip-path:polygon(132% 0,132% 0,132% 100%,120% 100%)}
${c} .he-sale::before{content:"";position:absolute;inset:0;background:rgb(128 128 128);mix-blend-mode:saturation;opacity:.7}
${c} .he-sale::after{content:"";position:absolute;inset:0;background-image:${GRAIN},linear-gradient(rgb(255 255 255 / .24),rgb(255 255 255 / .3));background-size:140px,100% 100%;opacity:.95}
${c} .he-raclette{position:absolute;inset:0;transform:translateX(126%);pointer-events:none}
${c} .he-raclette i{position:absolute;left:0;top:-4%;bottom:-4%;width:4px;margin-left:-2px;background:linear-gradient(180deg,transparent,#fff 12%,#fff 88%,transparent);box-shadow:0 0 18px 4px rgb(255 255 255 / .6),-26px 0 40px 6px rgb(255 255 255 / .12);transform:skewX(atan2(-16cqw,100cqh));opacity:0}
${c} .he-reflet{position:absolute;inset:0;background:linear-gradient(104deg,transparent 38%,rgb(255 255 255 / .2) 46%,rgb(255 255 255 / .06) 50%,transparent 58%);background-size:300% 100%;background-position:110% 0;mix-blend-mode:screen;animation:${k}reflet 8s ease-in-out 3.6s infinite;animation-play-state:paused}
${c} .he-eclats i{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);margin:calc(var(--s) / -2) 0 0 calc(var(--s) / -2);background:${ETOILE4} center/contain no-repeat;filter:drop-shadow(0 0 6px rgb(255 255 255 / .9));transform:scale(0);animation:${k}scintille var(--t) ease-in-out var(--d) infinite;animation-play-state:paused}
${c}.vit .he-reflet,${c}.vit .he-eclats i{animation-play-state:running}
.js ${c} .he-pan:not(.vu) .he-sale{clip-path:polygon(-8% 0,132% 0,132% 100%,-24% 100%)}
.js ${c} .he-pan:not(.vu) .he-raclette{transform:translateX(-16%)}
${c} .he-pan.vu .he-sale{animation:${k}sale 2s cubic-bezier(.65,0,.35,1) .75s both}
${c} .he-pan.vu .he-raclette{animation:${k}raclette 2s cubic-bezier(.65,0,.35,1) .75s both}
${c} .he-pan.vu .he-raclette i{animation:${k}barre 2s linear .75s both}
@keyframes ${k}sale{from{clip-path:polygon(-8% 0,132% 0,132% 100%,-24% 100%)}to{clip-path:polygon(132% 0,132% 0,132% 100%,116% 100%)}}
@keyframes ${k}raclette{from{transform:translateX(-16%)}to{transform:translateX(124%)}}
@keyframes ${k}barre{0%{opacity:0}8%,86%{opacity:1}100%{opacity:0}}
@keyframes ${k}reflet{0%{background-position:110% 0}28%,100%{background-position:-10% 0}}
@keyframes ${k}scintille{0%,62%,100%{transform:scale(0) rotate(0deg);opacity:0}74%{transform:scale(1) rotate(45deg);opacity:1}88%{transform:scale(.2) rotate(90deg);opacity:0}}
${cssEntree(c, 'eclat', { scene: '.4s' })}
@media(max-width:860px){${c}{align-items:start;min-height:0}${c} .he-vitre{position:relative;width:100%;height:min(54vh,440px);clip-path:polygon(0 0,100% 0,100% 86%,0 100%)}${c} .w{padding-block:28px 60px}${c} .h-txt{max-width:none}}
@media(prefers-reduced-motion:reduce){${c} .he-sale,${c} .he-raclette,${c} .he-eclats,${c} .he-reflet{display:none}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── la route : marquages qui défilent, phares qui s'allument ── */
const heroRoute = {
  id: 'hero.route', rubrique: 'hero', nom: 'La route de nuit',
  quand: 'garage, transport, livraison, déménagement, taxi, auto-école : une route de nuit dont les marquages défilent, des phares qui s\'allument',
  familles: ['garage', 'cabinet'], ambiances: ['franc', 'premium'], surfaces: ['photo'], js: ['parallaxe'],
  besoin: pour(RX.route),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.route', bloc, 'h' + (ph ? '' : ' sans')) + '" aria-label="Présentation">' + h.fond(bloc) + photoPleine(ctx) +
      '<div class="hp-voile" aria-hidden="true"></div>' +
      '<div class="hr-scene" data-r="scene" aria-hidden="true"><div class="hr-nuit"></div><div class="hr-sol"><i class="hr-lueur"></i><div class="hr-voie"><i class="hr-tirets"></i><span class="hr-file v"><i></i></span><span class="hr-file v deux"><i></i></span><span class="hr-file a"><i></i></span></div></div><div class="hr-eclair"></div></div>' +
      '<div class="w"><div class="h-txt cq">' + corps(spec, ctx) + '</div></div></section>';
  },
  script: vivant('r-hero-route', ''),
  css: function () {
    const c = '.r-hero-route', k = 'k-hero-route-';
    return cssPlein(c, { voile: 'linear-gradient(90deg,rgb(var(--voile) / .94) 0%,rgb(var(--voile) / .8) 34%,rgb(var(--voile) / .4) 66%,rgb(var(--voile) / .3) 100%),linear-gradient(0deg,rgb(var(--voile) / .5),transparent 50%)' }) + `
${c}.sans{background:radial-gradient(40% 30% at 72% 46%,color-mix(in srgb,rgb(var(--voile)),#fff 10%),transparent 70%),linear-gradient(180deg,color-mix(in srgb,rgb(var(--voile)),#000 30%),rgb(var(--voile)) 46%,color-mix(in srgb,rgb(var(--voile)),#000 18%))}
${c}.sans .hp-voile{background:linear-gradient(90deg,rgb(var(--voile) / .7),transparent 60%)}
${c} .hr-scene{${DESSUS}}
${c} .hr-nuit{position:absolute;inset:0;background:radial-gradient(60% 60% at 72% 70%,rgb(0 0 0 / .45),rgb(0 0 0 / .8));opacity:0}
${c} .hr-sol{position:absolute;left:28%;right:-24%;bottom:0;height:60%;perspective:440px;perspective-origin:50% 0;mix-blend-mode:screen;-webkit-mask-image:linear-gradient(0deg,#000 16%,rgb(0 0 0 / .55) 54%,transparent 94%);mask-image:linear-gradient(0deg,#000 16%,rgb(0 0 0 / .55) 54%,transparent 94%)}
${c} .hr-lueur{position:absolute;left:50%;top:0;width:min(30vw,420px);height:min(12vw,160px);margin:calc(min(12vw,160px) / -2) 0 0 calc(min(30vw,420px) / -2);border-radius:50%;background:radial-gradient(closest-side,rgb(255 255 255 / .32),rgb(${SOLEIL} / .12) 45%,transparent);mix-blend-mode:screen;animation:${k}lueur 6s ease-in-out infinite alternate;animation-play-state:paused}
${c} .hr-voie{position:absolute;left:50%;bottom:-2%;width:min(48vw,660px);height:300%;transform-origin:50% 100%;transform:translateX(-50%) rotateX(78deg);border-left:4px solid rgb(255 255 255 / .6);border-right:4px solid rgb(255 255 255 / .6);background:linear-gradient(90deg,rgb(255 255 255 / .07),transparent 16%,transparent 84%,rgb(255 255 255 / .07));overflow:hidden}
${c} .hr-tirets{position:absolute;left:50%;top:-140px;bottom:0;width:8px;margin-left:-4px;background:repeating-linear-gradient(180deg,rgb(255 255 255 / .92) 0 70px,transparent 70px 140px);animation:${k}tirets .72s linear infinite;animation-play-state:paused}
${c} .hr-file{position:absolute;left:0;right:0;top:0;height:100%;animation:${k}vient 3.4s cubic-bezier(.55,0,.9,.6) infinite;animation-play-state:paused}
${c} .hr-file i{position:absolute;top:50%;width:7px;height:320px;margin-top:-160px;border-radius:4px;background:linear-gradient(180deg,transparent,rgb(255 255 255 / .45) 55%,#fff);box-shadow:0 0 18px 3px rgb(255 255 255 / .26)}
${c} .hr-file.v i{left:24%}${c} .hr-file.v.deux{animation-delay:-1.9s;animation-duration:4.1s}${c} .hr-file.v.deux i{left:31%}
${c} .hr-file.a{animation-name:${k}part;animation-duration:5.2s;animation-delay:-2.2s;animation-timing-function:cubic-bezier(.1,.4,.45,1)}
${c} .hr-file.a i{left:72%;background:linear-gradient(0deg,transparent,color-mix(in srgb,var(--accent) 55%,transparent) 55%,var(--accent));box-shadow:0 0 20px 4px color-mix(in srgb,var(--accent) 45%,transparent)}
${c} .hr-eclair{position:absolute;inset:0;background:radial-gradient(70% 70% at 66% 64%,rgb(255 255 255 / .3),rgb(${SOLEIL} / .06) 50%,transparent 75%);mix-blend-mode:screen;opacity:0}
${c}.vit .hr-tirets,${c}.vit .hr-file,${c}.vit .hr-lueur{animation-play-state:running}
.js ${c} .hr-scene:not(.vu) .hr-nuit{opacity:1}
${c} .hr-scene.vu .hr-nuit{animation:${k}nuit 1.8s cubic-bezier(.3,0,.2,1) .75s both}
${c} .hr-scene.vu .hr-eclair{animation:${k}eclair 2.2s ease-out .5s both}
@keyframes ${k}nuit{from{opacity:1}to{opacity:0}}
@keyframes ${k}tirets{from{transform:translateY(0)}to{transform:translateY(140px)}}
@keyframes ${k}vient{0%{transform:translateY(-62%);opacity:0}12%{opacity:1}100%{transform:translateY(56%);opacity:1}}
@keyframes ${k}part{0%{transform:translateY(56%);opacity:1}80%{opacity:.9}100%{transform:translateY(-62%);opacity:0}}
@keyframes ${k}lueur{from{opacity:.6;transform:scale(.9)}to{opacity:1;transform:scale(1.08)}}
@keyframes ${k}eclair{0%{opacity:0}22%{opacity:1}100%{opacity:0}}
${cssEntree(c, 'route', { scene: '.3s' })}
@media(max-width:860px){${c} .hr-sol{left:-10%;right:-30%;height:58%;bottom:auto;top:0;-webkit-mask-image:linear-gradient(0deg,transparent 6%,#000 44%,rgb(0 0 0 / .5) 70%,transparent 96%);mask-image:linear-gradient(0deg,transparent 6%,#000 44%,rgb(0 0 0 / .5) 70%,transparent 96%)}${c} .hr-voie{width:78vw}}
@media(prefers-reduced-motion:reduce){${c} .hr-nuit,${c} .hr-file,${c} .hr-eclair{display:none}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── le soleil : il se lève, la mer scintille, la photo avance lentement ── */
const SCINTILLES = (function () { const g = graine('scintilles'); const out = []; for (let k = 0; k < 30; k++) out.push({ x: r2(34 + g() * 64), y: r2(62 + g() * 34), w: Math.round(5 + g() * 16), t: r2(1.8 + g() * 2.8), d: r2(-g() * 4.6), e: k % 6 === 0 }); return out; })();
const heroSoleil = {
  id: 'hero.soleil', rubrique: 'hero', nom: 'Le soleil se lève',
  quand: 'tourisme, mer, excursions, hébergement, gîte : le soleil se lève sur la photo, la mer scintille, l\'image avance très lentement',
  familles: ['horizon'], ambiances: ['premium', 'chaleureux'], surfaces: ['photo'], js: ['parallaxe'],
  besoin: pour(RX.soleil),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    const sc = SCINTILLES.map(function (o) { return '<i' + (o.e ? ' class="e"' : '') + ' style="--x:' + o.x + '%;--y:' + o.y + '%;--l:' + o.w + 'px;--t:' + o.t + 's;--d:' + o.d + 's"></i>'; }).join('');
    return '<section class="' + h.classes('hero.soleil', bloc, 'h' + (ph ? '' : ' sans')) + '" aria-label="Présentation">' + h.fond(bloc) + photoPleine(ctx, { px: 0.08, enveloppe: 'hs-zoom' }) +
      (ph ? '' : '<div class="hs-ciel" aria-hidden="true"><i class="hs-horizon"></i></div>') +
      '<div class="hs-dore" aria-hidden="true"></div>' +
      '<div class="hp-voile" aria-hidden="true"></div>' +
      '<div class="hs-scene" data-r="scene" aria-hidden="true"><div class="hs-astre"><i class="hs-rayons"></i><i class="hs-disque"></i></div><div class="hs-mer">' + sc + '</div></div>' +
      '<div class="w"><div class="h-txt cq">' + corps(spec, ctx) + '</div></div></section>';
  },
  script: vivant('r-hero-soleil', ''),
  css: function () {
    const c = '.r-hero-soleil', k = 'k-hero-soleil-';
    return cssPlein(c, { voile: 'linear-gradient(90deg,rgb(var(--voile) / .88) 0%,rgb(var(--voile) / .68) 34%,rgb(var(--voile) / .16) 70%,transparent 100%),linear-gradient(0deg,rgb(var(--voile) / .3),transparent 40%)' }) + `
${c} .hs-zoom{position:absolute;inset:0;transform-origin:72% 38%;animation:${k}zoom 46s ease-in-out infinite alternate;animation-play-state:paused}
${c} .hs-zoom .ph{height:100%;border-radius:0}
${c}.vit .hs-zoom{animation-play-state:running}
${c}{--hz:62%}
${c} .hs-ciel{position:absolute;inset:0;z-index:-6;background:linear-gradient(180deg,rgb(var(--voile)) 0%,color-mix(in srgb,rgb(var(--voile)),rgb(${SOLEIL}) 22%) calc(var(--hz) - 10%),color-mix(in srgb,rgb(var(--voile)),rgb(${SOLEIL}) 46%) var(--hz),color-mix(in srgb,rgb(var(--voile)),#000 22%) calc(var(--hz) + .2%),color-mix(in srgb,rgb(var(--voile)),#000 40%) 100%)}
${c} .hs-horizon{position:absolute;left:0;right:0;top:calc(var(--hz) - .4%);height:2px;background:linear-gradient(90deg,transparent,rgb(255 255 255 / .55) 70%,transparent)}
${c} .hs-dore{position:absolute;inset:0;z-index:-5;pointer-events:none;background:radial-gradient(95% 85% at 82% 22%,rgb(${SOLEIL} / .62),rgb(${SOLEIL} / .14) 46%,transparent 76%);mix-blend-mode:soft-light}
${c}.sans .hs-dore{mix-blend-mode:screen;opacity:.4}
${c} .hs-scene{${DESSUS}}
${c} .hs-astre{position:absolute;right:6%;top:-4%;width:clamp(140px,16vw,250px);aspect-ratio:1}
${c}.sans .hs-astre{top:auto;right:14%;bottom:calc(100% - var(--hz));width:clamp(80px,9vw,140px);margin-bottom:calc(clamp(80px,9vw,140px) / -2.4)}
${c} .hs-disque{position:absolute;inset:-60%;border-radius:50%;background:radial-gradient(closest-side,rgb(255 255 255 / .95) 0,color-mix(in srgb,#fff 50%,rgb(${SOLEIL})) 10%,rgb(${SOLEIL} / .42) 26%,rgb(${SOLEIL} / .12) 52%,transparent 74%);mix-blend-mode:screen}
${c}.sans .hs-disque{inset:0;background:radial-gradient(circle at 46% 44%,#fff 0,color-mix(in srgb,#fff 40%,rgb(${SOLEIL})) 50%,rgb(${SOLEIL}) 70%,rgb(${SOLEIL} / 0) 71%);box-shadow:0 0 60px 26px rgb(${SOLEIL} / .32),0 0 160px 80px rgb(${SOLEIL} / .14)}
${c} .hs-rayons{position:absolute;inset:-420%;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgb(255 255 255 / .1) 0 2.2deg,transparent 2.2deg 11deg);-webkit-mask-image:radial-gradient(closest-side,#000 6%,transparent 62%);mask-image:radial-gradient(closest-side,#000 6%,transparent 62%);mix-blend-mode:screen;animation:${k}tourne 240s linear infinite;animation-play-state:paused}
${c} .hs-mer{position:absolute;inset:0;-webkit-mask-image:linear-gradient(90deg,transparent 28%,#000 52%);mask-image:linear-gradient(90deg,transparent 28%,#000 52%)}
${c} .hs-mer i{position:absolute;left:var(--x);top:var(--y);width:var(--l);height:1.5px;border-radius:2px;background:linear-gradient(90deg,transparent,#fff 30%,#fff 70%,transparent);box-shadow:0 0 5px rgb(255 255 255 / .7);opacity:0;animation:${k}scintille var(--t) ease-in-out var(--d) infinite;animation-play-state:paused}
${c} .hs-mer i.e{width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:0;background:${ETOILE4} center/contain no-repeat;box-shadow:none;filter:drop-shadow(0 0 4px #fff)}
${c}.vit .hs-rayons,${c}.vit .hs-mer i{animation-play-state:running}
${c} .hs-scene.vu .hs-astre{animation:${k}leve 3.8s cubic-bezier(.2,.7,.2,1) .15s both}
@keyframes ${k}leve{from{transform:translate3d(0,46%,0) scale(.82);opacity:.15}}
@keyframes ${k}zoom{from{transform:scale(1)}to{transform:scale(1.12)}}
@keyframes ${k}tourne{to{transform:rotate(360deg)}}
@keyframes ${k}scintille{0%,100%{opacity:0;transform:scaleX(.2)}50%{opacity:.95;transform:scaleX(1)}}
${cssEntree(c, 'soleil', { scene: '.3s' })}
@media(max-width:860px){${c}{--hz:30%}${c} .hs-astre{right:-4%;top:-2%;width:44vw}${c}.sans .hs-astre{right:16%;width:84px;margin-bottom:-35px}${c} .hs-mer{-webkit-mask-image:none;mask-image:none}${c} .hs-mer i{top:calc(var(--hz) - 4% + (var(--y) - 62%) * .42)}}
@media(prefers-reduced-motion:reduce){${c} .hs-mer{display:none}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ════════════════ B. sans photo ════════════════ */

/* ── la typographie en mouvement ── */
const PAS_TOUR = 2.8;
function cssTour(c) {
  let out = '';
  for (let n = 2; n <= 6; n++) {
    const p = 100 / n, e = r2(0.5 / (PAS_TOUR * n) * 100);
    out += '@keyframes k-hero-typo-tour' + n + '{0%{transform:none;opacity:1}' + r2(p - e) + '%{transform:none;opacity:1}' + r2(p) + '%{transform:translate3d(0,-105%,0);opacity:0}' + r2(p + 0.01) + '%{transform:translate3d(0,105%,0);opacity:0}' + r2(100 - e) + '%{transform:translate3d(0,105%,0);opacity:0}100%{transform:none;opacity:1}}';
    out += c + ' .ht-tour ul.n' + n + ' li{animation-name:k-hero-typo-tour' + n + ';animation-duration:' + r2(PAS_TOUR * n) + 's;animation-delay:calc(var(--k) * -' + PAS_TOUR + 's)}';
  }
  return out;
}
const heroTypo = {
  id: 'hero.typo', rubrique: 'hero', nom: 'Typographie en mouvement',
  quand: 'sans photo, tous métiers (conseil, informatique, courtage...) : le métier en très grand, la commune dessous, les services qui tournent et défilent',
  familles: [], ambiances: ['franc', 'premium'], surfaces: ['fond', 'surface', 'champ'], js: [], photo: 'non', fonds: false,
  besoin: function (spec, ctx) { return ctx.h.servicesDe(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, tx = ctx.textes, ty = ctx.type;
    const sv = h.servicesDe(spec).slice(0, 6);
    const lieu = spec.commune ? MQ.a(spec.commune) : '';
    const parMetier = ctx.mod.titres !== 'nom' && tx.metier && tx.h1 !== h.net(spec.nom);
    const grand = parMetier ? tx.metier : tx.h1;
    const bas = parMetier ? lieu : (tx.sur || '');
    const nG = h.net(grand).split(' ').length;
    // une ligne sur un grand écran (jusqu'à 26 signes), deux sur un écran étroit
    const nC = h.net(grand).length, k2 = h.k2(grand, ty), k1 = nC <= 26 ? ((nC + 1) * ty.chasse * 1.06).toFixed(2) : k2;
    const titre = '<h1 class="t h1 ht-titre" style="--hk:' + k2 + ';--k1:' + k1 + ';--k2:' + k2 + '" data-r="mots"><span class="ht-g">' + h.mots(grand) + '</span>' + (parMetier && bas ? ' <span class="ht-l">' + h.mots(bas, nG) + '</span>' : '') + '</h1>' + (!parMetier && bas ? '<p class="ht-l ht-lp"' + h.rv('monte', 2) + '>' + h.esc(bas) + '</p>' : '');
    const tour = '<div class="ht-tour"' + h.rv('monte', 3) + ' aria-hidden="true"><span class="ht-ic">' + h.icone(ctx.iconeMetier) + '</span><ul class="n' + sv.length + '">' + sv.map(function (s, k) { return '<li style="--k:' + k + '">' + h.esc(h.net(s.titre)) + '</li>'; }).join('') + '</ul></div>';
    const groupe = function () { let x = ''; const fois = Math.max(1, Math.ceil(8 / sv.length)); for (let f = 0; f < fois; f++) sv.forEach(function (s) { x += '<span>' + h.icone(ctx.iconeMetier) + h.esc(h.net(s.titre)) + '</span>'; }); return '<div class="ht-gr">' + x + '</div>'; };
    const phrase = tx.phrase ? '<p class="h-phrase"' + h.rv('monte', 4) + '>' + h.esc(tx.phrase) + '</p>' : '';
    const b = h.boutons(spec);
    return '<section class="' + h.classes('hero.typo', bloc, 'h') + '" aria-label="Présentation"><div class="ht-trame" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="w"><div class="ht-haut cq">' + titre + '</div><div class="ht-bas">' + tour + '<div class="ht-dr">' + phrase + (b ? '<div class="h-act"' + h.rv('monte', 5) + '>' + b + '</div>' : '') + '<div class="h-conf"' + h.rv('monte', 6) + '>' + h.confiance(spec) + '</div></div></div></div>' +
      '<div class="ht-bande" aria-hidden="true"><div class="ht-piste" style="--t:' + Math.max(22, sv.length * 7) + 's">' + groupe() + groupe() + '</div></div></section>';
  },
  script: vivant('r-hero-typo', ''),
  css: function () {
    const c = '.r-hero-typo', k = 'k-hero-typo-';
    return `
${c}{overflow:hidden}
${c}::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:${GRAIN};background-size:160px;opacity:.07;mix-blend-mode:multiply}
${c}.s-champ::after{mix-blend-mode:screen;opacity:.05}
${c} .ht-trame{position:absolute;inset:0;z-index:-2;display:grid;grid-template-columns:repeat(5,1fr);width:min(var(--w),100% - 2*var(--g));margin-inline:auto;pointer-events:none}
${c} .ht-trame i{border-left:1px solid color-mix(in srgb,var(--tx) 7%,transparent);transform-origin:top}
${c} .ht-trame i:last-child{border-right:1px solid color-mix(in srgb,var(--tx) 7%,transparent)}
.js ${c} .ht-trame i{animation:${k}trame 1.6s cubic-bezier(.65,0,.35,1) both}
.js ${c} .ht-trame i:nth-child(2){animation-delay:.08s}.js ${c} .ht-trame i:nth-child(3){animation-delay:.16s}.js ${c} .ht-trame i:nth-child(4){animation-delay:.24s}.js ${c} .ht-trame i:nth-child(5){animation-delay:.32s}
${c} .w{position:relative;padding-block:clamp(48px,6.5vw,96px) clamp(36px,4.5vw,64px)}
${c} .ht-titre{--kg:var(--k1);--tg:max(2.4rem,min(10rem,calc(100cqi / var(--kg))));font-size:var(--tg);line-height:var(--th);display:block}
${c} .ht-g{display:block;font-size:var(--tg);line-height:.92}
${c} .ht-l{display:block;margin-top:.12em;font-size:max(1.5rem,min(4.6rem,calc(var(--tg) * .42)));line-height:1;color:var(--accT);font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te)}
${c} .ht-lp{margin-top:18px}
${c} .ht-bas{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,80px);align-items:start;margin-top:clamp(28px,4vw,52px);padding-top:clamp(24px,3vw,34px);border-top:2px solid var(--tx)}
${c} .ht-tour{display:flex;align-items:flex-start;gap:16px;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.5rem,3vw,2.5rem);line-height:1.08}
${c} .ht-ic{flex:none;width:1.2em;height:1.2em;display:grid;place-items:center;border-radius:var(--rb);background:var(--btn);color:var(--btnT)}
${c} .ht-ic .ic{width:.66em;height:.66em}
${c} .ht-tour ul{display:grid;overflow:hidden;padding-bottom:.08em;flex:1;min-width:0}
${c} .ht-tour li{grid-area:1/1;overflow-wrap:break-word}
${c} .ht-tour li:not(:first-child){opacity:0}
${c} .ht-tour li{animation-timing-function:cubic-bezier(.7,0,.2,1);animation-iteration-count:infinite;animation-play-state:paused}
${c}.vit .ht-tour li{animation-play-state:running}
${c} .ht-dr{display:grid;gap:20px;justify-items:start}
${c} .h-phrase{font-size:clamp(1.08rem,1.4vw,1.24rem);line-height:1.5;color:var(--tx2);max-width:44ch}
${c} .ht-bande{position:relative;margin:clamp(8px,2vw,24px) -4vw clamp(18px,3vw,34px);transform:rotate(-1.4deg);background:var(--btn);color:var(--btnT);padding-block:clamp(12px,1.6vw,18px);overflow:hidden}
${c}:has(+ .r-bandeau-chevauche) .ht-bande{margin-bottom:calc(clamp(48px,6.4vw,92px) + clamp(16px,2.4vw,30px))}
${c}:has(+ .r-bandeau-atouts) .ht-bande{margin-bottom:calc(clamp(44px,6vw,84px) + clamp(16px,2.4vw,30px))}
${c} .ht-piste{display:flex;width:max-content;animation:${k}bande var(--t) linear infinite;animation-play-state:paused}
${c}.vit .ht-piste{animation-play-state:running}
${c} .ht-gr{display:flex;flex:none}
${c} .ht-gr span{display:inline-flex;align-items:center;gap:.5em;padding-inline:.9em;white-space:nowrap;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.15rem,2vw,1.7rem);line-height:1.1}
${c} .ht-gr .ic{width:.8em;height:.8em;opacity:.75}
${cssTour(c)}
@keyframes ${k}trame{from{transform:scaleY(0)}}
@keyframes ${k}bande{to{transform:translate3d(-50%,0,0)}}
${cssEntree(c, 'typo')}
@container (max-width:760px){${c} .ht-titre{--kg:var(--k2)}}
@media(max-width:860px){${c}:has(+ .r-bandeau-chevauche) .ht-bande{margin-bottom:52px}${c}:has(+ .r-bandeau-atouts) .ht-bande{margin-bottom:50px}${c} .ht-bas{grid-template-columns:1fr}${c} .ht-trame{grid-template-columns:repeat(3,1fr)}${c} .ht-trame i:nth-child(n+4){display:none}${c} .ht-trame i:nth-child(3){border-right:1px solid color-mix(in srgb,var(--tx) 7%,transparent)}}
@media(prefers-reduced-motion:reduce){${c} .ht-tour li:not(:first-child){display:none}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── l'icône du métier dessinée trait par trait ── */
// les traits d'une icône de theme.js, en chemins simples (un par sous-chemin), pour les dessiner un à un
function traitsIcone(nom) {
  const src = T.ICONES[nom] || T.ICONES.etoile;
  const f = function (v) { return +(+v).toFixed(3); };
  const out = [];
  src.replace(/<(path|circle|rect)\b([^>]*)\/?>/g, function (z, tag, at) {
    const a = {};
    at.replace(/([a-z-]+)="([^"]*)"/g, function (y, k, v) { a[k] = v; return y; });
    if (tag === 'path') String(a.d || '').split(/(?=M)/).forEach(function (p) { if (p.trim()) out.push(p.trim()); });
    else if (tag === 'circle') { const cx = +a.cx, cy = +a.cy, r = +a.r; out.push('M' + f(cx - r) + ' ' + f(cy) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0'); }
    else if (tag === 'rect') {
      const x = +a.x, y = +a.y, wd = +a.width, ht = +a.height, q = Math.min(+a.rx || 0, wd / 2, ht / 2);
      out.push(q ? 'M' + f(x + q) + ' ' + f(y) + 'H' + f(x + wd - q) + 'A' + f(q) + ' ' + f(q) + ' 0 0 1 ' + f(x + wd) + ' ' + f(y + q) + 'V' + f(y + ht - q) + 'A' + f(q) + ' ' + f(q) + ' 0 0 1 ' + f(x + wd - q) + ' ' + f(y + ht) + 'H' + f(x + q) + 'A' + f(q) + ' ' + f(q) + ' 0 0 1 ' + f(x) + ' ' + f(y + ht - q) + 'V' + f(y + q) + 'A' + f(q) + ' ' + f(q) + ' 0 0 1 ' + f(x + q) + ' ' + f(y) + 'Z' : 'M' + f(x) + ' ' + f(y) + 'h' + f(wd) + 'v' + f(ht) + 'h' + f(-wd) + 'Z');
    }
    return z;
  });
  return out;
}
// la longueur approchée d'un chemin (pour que chaque trait se dessine à vitesse égale)
function longueur(d) {
  const tk = String(d).match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, L = 0, qx = 0, qy = 0;
  const num = function () { return parseFloat(tk[i++]); };
  const estNum = function () { return i < tk.length && !/^[a-zA-Z]$/.test(tk[i]); };
  const seg = function (nx, ny) { L += Math.hypot(nx - x, ny - y); x = nx; y = ny; };
  const cub = function (x1, y1, x2, y2, nx, ny) { let px = x, py = y; for (let k = 1; k <= 16; k++) { const u = k / 16, v = 1 - u; const ax = v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * nx, ay = v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * ny; L += Math.hypot(ax - px, ay - py); px = ax; py = ay; } x = nx; y = ny; qx = x2; qy = y2; };
  const quad = function (x1, y1, nx, ny) { cub(x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), nx + 2 / 3 * (x1 - nx), ny + 2 / 3 * (y1 - ny), nx, ny); qx = x1; qy = y1; };
  let garde = 0;
  while (i < tk.length && garde++ < 2000) {
    if (!estNum()) cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { seg(sx, sy); continue; }
    if (!estNum()) continue;
    if (C === 'M') { x = num() + ox; y = num() + oy; sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') seg(num() + ox, num() + oy);
    else if (C === 'H') seg(num() + ox, y);
    else if (C === 'V') seg(x, num() + oy);
    else if (C === 'C') cub(num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy);
    else if (C === 'S') { const x1 = 2 * x - qx, y1 = 2 * y - qy; cub(x1, y1, num() + ox, num() + oy, num() + ox, num() + oy); }
    else if (C === 'Q') quad(num() + ox, num() + oy, num() + ox, num() + oy);
    else if (C === 'T') quad(2 * x - qx, 2 * y - qy, num() + ox, num() + oy);
    else if (C === 'A') { const rx0 = num(), ry0 = num(); num(); const gd = num(); num(); const nx = num() + ox, ny = num() + oy; const corde = Math.hypot(nx - x, ny - y); const r = Math.max((rx0 + ry0) / 2, corde / 2) || 1; let th = 2 * Math.asin(Math.min(1, corde / (2 * r))); if (gd) th = 2 * Math.PI - th; L += r * th; x = nx; y = ny; }
    else i++;
  }
  return L;
}
const heroIcone = {
  id: 'hero.icone', rubrique: 'hero', nom: 'L\'icône du métier dessinée',
  quand: 'sans photo, tous métiers : l\'icône du métier se dessine en très grand, trait par trait, sur sa grille et une maille de couleurs',
  familles: [], ambiances: ['calme', 'franc'], surfaces: ['champ', 'fond'], js: [], photo: 'non', fonds: false,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    const traits = traitsIcone(ctx.iconeMetier);
    let t0 = 0.45;
    const chemins = traits.map(function (d, k) { const l = longueur(d), td = r2(Math.min(1.5, 0.35 + l * 0.045)); const s = 'style="--k:' + k + ';--td:' + td + 's;--t0:' + r2(t0) + 's"'; t0 += td * 0.62; return { d: d, s: s }; });
    const p = function (cls) { return '<g class="' + cls + '">' + chemins.map(function (x) { return '<path pathLength="1" d="' + x.d + '" ' + x.s + '/>'; }).join('') + '</g>'; };
    let grille = '';
    for (let k = 1; k < 24; k++) grille += '<path d="M' + k + ' 0V24M0 ' + k + 'H24"/>';
    return '<section class="' + h.classes('hero.icone', bloc, 'h') + '" aria-label="Présentation"><div class="hi-maille" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<div class="w hi-g"><div class="h-txt cq">' + corps(spec, ctx) + '</div>' +
      '<div class="hi-dessin" data-r="scene" aria-hidden="true"><div class="hi-cadre"><svg class="hi-grille" viewBox="-2 -2 28 28" focusable="false"><g class="hi-lignes">' + grille + '</g><g class="hi-guides"><circle cx="12" cy="12" r="10"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M0 0L24 24M24 0L0 24"/></g></svg>' +
      '<svg class="hi-ic" viewBox="-2 -2 28 28" focusable="false">' + p('hi-lueur') + p('hi-trait') + p('hi-eclat') + '</svg></div></div></div></section>';
  },
  script: vivant('r-hero-icone',
    "var de=s.querySelector('.hi-dessin');if(!de)return;var tk=0,der=0;" +
    "if(fin){s.addEventListener('pointermove',function(e){if(tk)return;tk=1;requestAnimationFrame(function(){tk=0;var r=s.getBoundingClientRect();de.style.setProperty('--px',((e.clientX-r.left)/r.width-.5).toFixed(3));de.style.setProperty('--py',((e.clientY-r.top)/r.height-.5).toFixed(3))})},{passive:true});" +
    "de.addEventListener('mouseenter',function(){var t=Date.now();if(t-der<5000||!de.classList.contains('vu'))return;der=t;de.classList.add('re');setTimeout(function(){de.classList.remove('re')},80)})}"),
  css: function () {
    const c = '.r-hero-icone', k = 'k-hero-icone-';
    return `
${c}{overflow:hidden}
${c} .hi-maille{position:absolute;inset:0;z-index:-2;pointer-events:none;overflow:hidden}
${c} .hi-maille i{position:absolute;width:62vmax;height:62vmax;border-radius:50%;will-change:transform;animation:${k}derive 26s ease-in-out infinite alternate;animation-play-state:paused}
${c} .hi-maille i:nth-child(1){left:42%;top:-28%;background:radial-gradient(closest-side,color-mix(in srgb,var(--acc) 42%,transparent),transparent)}
${c} .hi-maille i:nth-child(2){left:62%;top:30%;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 46%,transparent),transparent);animation-duration:31s;animation-delay:-9s}
${c} .hi-maille i:nth-child(3){left:-18%;top:40%;width:52vmax;height:52vmax;background:radial-gradient(closest-side,color-mix(in srgb,var(--btn) 22%,transparent),transparent);animation-duration:36s;animation-delay:-14s}
${c} .hi-maille i:nth-child(4){left:24%;top:-40%;width:40vmax;height:40vmax;background:radial-gradient(closest-side,color-mix(in srgb,var(--tx) 10%,transparent),transparent);animation-duration:22s;animation-delay:-5s}
${c} .hi-maille::after{content:"";position:absolute;inset:0;background-image:${GRAIN};background-size:160px;opacity:.1;mix-blend-mode:soft-light}
${c}.vit .hi-maille i{animation-play-state:running}
${c} .hi-g{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(28px,5vw,80px);align-items:center;padding-block:clamp(60px,8vw,120px)}
${c} .h-txt{display:grid;gap:clamp(18px,2.4vw,26px);--hmax:5.2rem}
${c} .h-sur{font-size:clamp(1.05rem,1.5vw,1.28rem);font-weight:var(--fxf);color:var(--tx)}
${c} .h-phrase{font-size:clamp(1.08rem,1.45vw,1.28rem);line-height:1.5;max-width:44ch;color:var(--tx2)}
${c} .hi-dessin{position:relative;justify-self:center;width:min(100%,560px)}
${c} .hi-cadre{position:relative;aspect-ratio:1;transform:translate3d(calc(var(--px,0) * -10px),calc(var(--py,0) * -10px),0);transition:transform .9s var(--ease)}
${c} .hi-cadre svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
${c} .hi-grille{fill:none;stroke:var(--tx);opacity:.12}
${c} .hi-lignes{stroke-width:.03}
${c} .hi-guides{stroke-width:.05;stroke-dasharray:.4 .3;opacity:.9}
${c} .hi-ic{fill:none;stroke-linecap:round;stroke-linejoin:round;transform:translate3d(calc(var(--px,0) * 18px),calc(var(--py,0) * 18px),0);transition:transform .9s var(--ease)}
${c} .hi-ic path{stroke-dasharray:1 1;stroke-dashoffset:0}
${c} .hi-lueur{stroke:var(--acc);stroke-width:1.5;opacity:.28;filter:blur(.35px)}
${c} .hi-trait{stroke:var(--tx);stroke-width:.62}
${c} .hi-eclat{stroke:var(--acc);stroke-width:.66;opacity:0}
${c} .hi-eclat path{stroke-dasharray:.07 .93;animation:${k}eclat 3.4s linear calc(var(--t0) + 2.6s) infinite;animation-play-state:paused}
${c}.vit .hi-dessin.vu .hi-eclat{animation:${k}vient 1s ease 2.4s both}
${c}.vit .hi-eclat path{animation-play-state:running}
${c} .hi-dessin.vu .hi-trait path,${c} .hi-dessin.vu .hi-lueur path{animation:${k}trace var(--td) cubic-bezier(.55,0,.35,1) var(--t0) both}
${c} .hi-dessin.vu .hi-grille{animation:${k}grille 2.6s ease both}
${c} .hi-dessin.re .hi-trait path,${c} .hi-dessin.re .hi-lueur path,${c} .hi-dessin.re .hi-grille{animation:none}
@keyframes ${k}trace{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes ${k}grille{0%{opacity:0}30%{opacity:.34}100%{opacity:.12}}
@keyframes ${k}vient{from{opacity:0}to{opacity:1}}
@keyframes ${k}derive{from{transform:translate3d(-6%,-4%,0) scale(1)}to{transform:translate3d(6%,5%,0) scale(1.12)}}
@keyframes ${k}eclat{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
${cssEntree(c, 'icone', { scene: '.3s' })}
@media(max-width:860px){${c} .hi-g{grid-template-columns:1fr;padding-block:36px 64px}${c} .hi-dessin{order:-1;width:min(64vw,300px);justify-self:start}}
@media(prefers-reduced-motion:reduce){${c} .hi-eclat{display:none}${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── la carte de visite en 3D ── */
const heroCarte = {
  id: 'hero.carte', rubrique: 'hero', nom: 'La carte de visite en 3D',
  quand: 'sans photo (conseil, courtage, informatique, cabinet) : une carte de visite en 3D qui s\'incline vers la souris, avec le nom, le métier et les vrais contacts',
  familles: [], ambiances: ['premium', 'calme'], surfaces: ['champ', 'fond'], js: [], photo: 'non', fonds: false,
  besoin: function (spec) { const c = spec.contact || {}; return !!(c.tel || c.mobile || c.email); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {};
    const g = h.noteGoogle(spec), o = h.objectif(spec);
    const lignes = [];
    const t = h.telHref(c.tel), wa = h.waHref(c.mobile || c.tel, o.wa);
    if (t) lignes.push('<li><a href="' + h.esc(t) + '">' + h.icone('tel') + '<span>' + h.esc(MQ.affiche(c.tel)) + '</span></a></li>');
    if (wa) lignes.push('<li><a href="' + h.esc(wa) + '" target="_blank" rel="noopener">' + h.icone('whatsapp') + '<span>' + h.esc(c.mobile && c.mobile !== c.tel ? MQ.affiche(c.mobile) : 'WhatsApp') + '</span></a></li>');
    if (c.email) lignes.push('<li><a href="mailto:' + h.esc(c.email) + '">' + h.icone('mail') + '<span>' + h.esc(c.email) + '</span></a></li>');
    const ou = c.adresse || (spec.commune ? spec.commune + ', Martinique' : '');
    const metier = [ctx.textes.metier, spec.commune ? MQ.a(spec.commune) : ''].filter(Boolean).join(' ');
    const carte = '<div class="hk-carte" role="group" aria-label="Carte de visite de ' + h.esc(h.net(spec.nom)) + '"><div class="hk-face"><div class="hk-haut"><span class="hk-mono" aria-hidden="true">' + h.icone(ctx.iconeMetier) + '</span>' +
      (g ? '<span class="hk-note">' + h.etoiles(g.note) + '<b>' + h.noteTexte(g) + '</b></span>' : '') + '</div>' +
      '<p class="hk-nom">' + h.esc(h.net(spec.nom)) + '</p>' + (metier ? '<p class="hk-metier">' + h.esc(metier) + '</p>' : '') +
      '<ul class="hk-lignes">' + lignes.slice(0, 3).join('') + '</ul>' + (ou ? '<p class="hk-ou">' + h.icone('pin') + '<span>' + h.esc(ou) + '</span></p>' : '') + '</div><span class="hk-reflet" aria-hidden="true"></span></div>';
    return '<section class="' + h.classes('hero.carte', bloc, 'h') + '" aria-label="Présentation"><div class="hk-aurore" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '<div class="w hk-g"><div class="h-txt cq">' + corps(spec, ctx, { confiance: false }) + '</div>' +
      '<div class="hk-scene" data-r="scene"><div class="hk-entree"><div class="hk-flot">' + carte + '</div></div><span class="hk-ombre" aria-hidden="true"></span></div></div></section>';
  },
  script: vivant('r-hero-carte',
    "var k=s.querySelector('.hk-carte');if(!k||!fin)return;var tk=0;" +
    "s.addEventListener('pointermove',function(e){if(tk)return;tk=1;requestAnimationFrame(function(){tk=0;var r=k.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(s.clientWidth/2),y=(e.clientY-r.top-r.height/2)/(s.clientHeight/2);x=Math.max(-1,Math.min(1,x));y=Math.max(-1,Math.min(1,y));k.classList.add('pil');k.style.setProperty('--ry',(x*16).toFixed(2)+'deg');k.style.setProperty('--rx',(-y*12).toFixed(2)+'deg');k.style.setProperty('--gx',(50+x*40).toFixed(1)+'%');k.style.setProperty('--gy',(40+y*40).toFixed(1)+'%')})},{passive:true});" +
    "s.addEventListener('pointerleave',function(){k.classList.remove('pil');k.style.removeProperty('--rx');k.style.removeProperty('--ry');k.style.removeProperty('--gx');k.style.removeProperty('--gy')});"),
  css: function () {
    const c = '.r-hero-carte', k = 'k-hero-carte-';
    return `
${c}{overflow:hidden}
${c} .hk-aurore{position:absolute;inset:0;z-index:-2;pointer-events:none;overflow:hidden}
${c} .hk-aurore i{position:absolute;width:70vmax;height:70vmax;border-radius:50%;will-change:transform;animation:${k}aurore 24s ease-in-out infinite alternate;animation-play-state:paused}
${c} .hk-aurore i:nth-child(1){right:-24vmax;top:-34vmax;background:radial-gradient(closest-side,color-mix(in srgb,var(--acc) 44%,transparent),transparent)}
${c} .hk-aurore i:nth-child(2){right:4vmax;bottom:-46vmax;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 50%,transparent),transparent);animation-duration:30s;animation-delay:-11s}
${c} .hk-aurore i:nth-child(3){left:-30vmax;top:-20vmax;width:56vmax;height:56vmax;background:radial-gradient(closest-side,color-mix(in srgb,var(--btn) 20%,transparent),transparent);animation-duration:34s;animation-delay:-6s}
${c} .hk-aurore::after{content:"";position:absolute;inset:0;background-image:${GRAIN};background-size:160px;opacity:.09;mix-blend-mode:soft-light}
${c}.vit .hk-aurore i{animation-play-state:running}
${c} .hk-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,5vw,84px);align-items:center;padding-block:clamp(64px,8vw,124px)}
${c} .h-txt{display:grid;gap:clamp(18px,2.4vw,26px);--hmax:5rem}
${c} .h-sur{font-size:clamp(1.05rem,1.5vw,1.28rem);font-weight:var(--fxf)}
${c} .h-phrase{font-size:clamp(1.08rem,1.45vw,1.28rem);line-height:1.5;max-width:44ch;color:var(--tx2)}
${c} .hk-scene{position:relative;perspective:1100px;justify-self:center;width:min(100%,500px);padding-block:20px 56px}
${c} .hk-entree,${c} .hk-flot{transform-style:preserve-3d}
${c} .hk-flot{animation:${k}flotte 7s ease-in-out infinite alternate;animation-play-state:paused}
${c}.vit .hk-flot{animation-play-state:running}
${c} .hk-carte{--kc:var(--champ);--kt:var(--surC);--kd:var(--champDoux);--ka:var(--accC);--kb:var(--vif);position:relative;aspect-ratio:1.586;border-radius:calc(var(--r) * .9 + 6px);background:var(--kc);color:var(--kt);transform:rotateX(var(--rx,9deg)) rotateY(var(--ry,-16deg)) rotateZ(2deg);transform-style:preserve-3d;transition:transform .8s cubic-bezier(.2,.7,.2,1);box-shadow:0 1px 0 color-mix(in srgb,var(--kt) 12%,transparent) inset,0 50px 80px -40px rgb(0 0 0 / .6),0 18px 30px -18px rgb(0 0 0 / .5)}
${c}.s-champ .hk-carte{--kc:var(--fond);--kt:var(--encre);--kd:var(--doux);--ka:var(--accentT);--kb:var(--accent)}
${c} .hk-carte.pil{transition:transform .25s ease-out}
${c} .hk-carte::before{content:"";position:absolute;inset:0;border-radius:inherit;background-image:${GRAIN};background-size:140px;opacity:.12;mix-blend-mode:multiply;pointer-events:none}
${c} .hk-carte::after{content:"";position:absolute;left:0;right:0;bottom:0;height:7px;border-radius:0 0 inherit inherit;background:var(--kb)}
${c} .hk-face{position:relative;min-height:100%;display:flex;flex-direction:column;gap:2px;padding:clamp(20px,3vw,30px) clamp(20px,3vw,32px) clamp(22px,3vw,30px);transform:translateZ(18px)}
${c} .hk-haut{display:flex;justify-content:space-between;align-items:center;margin-bottom:auto;padding-bottom:12px}
${c} .hk-mono{width:44px;height:44px;display:grid;place-items:center;border-radius:var(--rb);background:var(--kb);color:var(--kc)}
${c} .hk-mono .ic{width:24px;height:24px}
${c} .hk-note{display:inline-flex;align-items:center;gap:8px;font-weight:var(--fxf)}
${c} .hk-note b{font-size:1.05rem}
${c} .hk-note .etoiles .vd .ic{opacity:.3}
${c} .hk-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.45rem,2.6vw,2.1rem);line-height:1.04;overflow-wrap:anywhere}
${c} .hk-metier{color:var(--kd);font-size:.98rem;line-height:1.35;margin-bottom:10px}
${c} .hk-lignes{display:grid;gap:0}
${c} .hk-lignes a{display:flex;align-items:center;gap:10px;min-height:44px;text-decoration:none;font-weight:var(--fxf);font-size:1rem;overflow-wrap:anywhere}
${c} .hk-lignes a .ic{width:18px;height:18px;color:var(--ka);flex:none}
${c} .hk-lignes a:hover span{text-decoration:underline;text-underline-offset:.2em}
${c} .hk-lignes a:focus-visible{outline:3px solid var(--ka);outline-offset:2px;border-radius:4px}
${c} .hk-ou{display:flex;gap:10px;align-items:flex-start;color:var(--kd);font-size:.95rem;line-height:1.4;padding-top:6px}
${c} .hk-ou .ic{width:18px;height:18px;color:var(--ka);flex:none;margin-top:1px}
${c} .hk-reflet{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:radial-gradient(circle at var(--gx,26%) var(--gy,18%),rgb(255 255 255 / .42),transparent 48%),linear-gradient(115deg,transparent 40%,rgb(255 255 255 / .1) 50%,transparent 60%);mix-blend-mode:soft-light;transform:translateZ(19px)}
${c} .hk-ombre{position:absolute;left:12%;right:12%;bottom:6px;height:34px;border-radius:50%;background:radial-gradient(closest-side,rgb(0 0 0 / .45),transparent);filter:blur(6px);animation:${k}ombre 7s ease-in-out infinite alternate;animation-play-state:paused}
${c}.vit .hk-ombre{animation-play-state:running}
${c} .hk-scene.vu .hk-entree{animation:${k}entree 1.7s cubic-bezier(.2,.9,.25,1.1) .25s both}
@keyframes ${k}entree{from{transform:translate3d(0,90px,0) rotateX(52deg) rotateY(-34deg) rotateZ(-8deg) scale(.86);opacity:0}}
@keyframes ${k}flotte{from{transform:translate3d(0,-6px,0) rotateZ(-.6deg)}to{transform:translate3d(0,8px,0) rotateZ(.8deg)}}
@keyframes ${k}ombre{from{transform:scale(1.04);opacity:.85}to{transform:scale(.9);opacity:.65}}
@keyframes ${k}aurore{from{transform:translate3d(-4%,-3%,0) scale(1)}to{transform:translate3d(5%,4%,0) scale(1.12)}}
${cssEntree(c, 'carte', { scene: '.3s' })}
@media(max-width:860px){${c} .hk-g{grid-template-columns:1fr;padding-block:40px 56px}${c} .hk-scene{width:min(100%,440px);padding-block:8px 40px}}
@media(prefers-reduced-motion:reduce){${c} *{animation:none!important;transition:none!important}}
`;
  }
};

/* ── la grille bento ── */
const heroBento = {
  id: 'hero.bento', rubrique: 'hero', nom: 'Grille bento',
  quand: 'sans photo, avec deux services ou plus : une grille de tuiles qui apparaît en cascade (le titre, les services, la note Google, le contact, le lieu, les horaires)',
  familles: [], ambiances: ['franc', 'chaleureux'], surfaces: ['fond', 'surface'], js: ['ouvert'], photo: 'non', fonds: false,
  besoin: function (spec, ctx) { const c = spec.contact || {}; return ctx.h.servicesDe(spec).length >= 2 && !!(c.tel || c.mobile || c.email); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {};
    const g = h.noteGoogle(spec), a = h.actionPrincipale(spec), sv = h.servicesDe(spec).slice(0, 6);
    // les tuiles d'information, puis une tuile par service
    const infos = [];
    if (g) infos.push({ cls: 'hg-note s-accent', html: '<p class="hg-n"><b>' + h.noteTexte(g) + '</b><span>/5</span></p>' + h.etoiles(g.note) + '<p class="hg-p">' + h.esc(g.avis + ' avis sur Google') + '</p>' });
    if (a) infos.push({ cls: 'hg-act s-champ', lien: a, html: '<span class="hg-ic">' + h.icone(a.icone) + '</span><span class="hg-f">' + h.icone('fleche') + '</span><p class="hg-x">' + h.esc(a.texte) + '</p>' });
    const hs = h.horairesDe(c), mach = h.horairesMachine(hs), res = h.resumeHoraires(hs);
    if (res) infos.push({ cls: 'hg-hor', html: '<p class="hg-k">' + h.icone('horloge') + '<span>Horaires</span></p><p class="hg-x">' + h.esc(res) + '</p>' + (mach ? '<p class="hg-etat" data-horaires="' + h.esc(mach) + '"><i></i><span data-ouvert-texte>Horaires de la semaine</span></p>' : '') });
    const z = h.zoneClient(spec);
    infos.push({ cls: 'hg-lieu', html: '<p class="hg-k">' + h.icone('pin') + '<span>' + (z ? 'Où nous intervenons' : 'Où nous trouver') + '</span></p><p class="hg-x">' + h.esc(z || c.adresse || ((spec.commune ? spec.commune + ', ' : '') + 'Martinique')) + '</p>' });
    const serv = sv.map(function (s) { return { cls: 'hg-srv', html: '<span class="hg-si">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h2 class="hg-st">' + h.esc(h.net(s.titre)) + '</h2>' + (h.net(s.texte) ? '<p class="hg-sp">' + h.esc(h.net(s.texte)) + '</p>' : '') }; });
    // à droite du titre, quatre cases (deux colonnes sur deux rangées) ; dessous, le reste par rangées de quatre,
    // la dernière rangée élargie pour ne laisser aucun trou
    const droite = infos.slice(0, 4), reste = serv.slice();
    while (droite.length < 4 && reste.length) droite.push(reste.shift());
    const dessous = infos.slice(4).concat(reste);
    const largeurs = droite.map(function (t, i) { return droite.length === 3 && i === 2 ? 'l2' : droite.length === 2 ? 'l2' : droite.length === 1 ? 'l2 haut' : ''; });
    const r = dessous.length % 4;
    dessous.forEach(function (t, i) { const dans = i - (dessous.length - r); largeurs.push(r && dans >= 0 ? (r === 1 ? 'l4' : r === 2 ? 'l2' : (dans === 0 ? 'l2' : '')) : ''); });
    const tuile = function (t, k) {
      const cl = 'hg-c ' + t.cls + (largeurs[k] ? ' ' + largeurs[k] : ''), dedans = '<div class="hg-in">' + t.html + '</div>';
      return t.lien ? '<a class="' + cl + '" href="' + h.esc(t.lien.href) + '"' + (t.lien.ext ? ' target="_blank" rel="noopener"' : '') + h.rv('zoom', k + 2) + '>' + dedans + '</a>' : '<div class="' + cl + '"' + h.rv('zoom', k + 2) + '>' + dedans + '</div>';
    };
    return '<section class="' + h.classes('hero.bento', bloc, 'h') + '" aria-label="Présentation"><div class="w"><div class="hg-g">' +
      '<div class="hg-c hg-titre s-champ"' + h.rv('monte', 1) + '><div class="hg-in h-txt cq">' + corps(spec, ctx, { confiance: false }) + '</div></div>' + droite.concat(dessous).map(tuile).join('') + '</div></div></section>';
  },
  script: vivant('r-hero-bento',
    "var gr=s.querySelector('.hg-g');if(!gr||!fin)return;var ts=[].slice.call(gr.querySelectorAll('.hg-c')),tk=0;" +
    "gr.addEventListener('pointermove',function(e){if(tk)return;tk=1;requestAnimationFrame(function(){tk=0;ts.forEach(function(t){var r=t.getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left).toFixed(0)+'px');t.style.setProperty('--my',(e.clientY-r.top).toFixed(0)+'px')})})},{passive:true});"),
  css: function () {
    const c = '.r-hero-bento';
    return `
${c}{overflow:hidden}
${c}::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(60% 50% at 100% 0%,color-mix(in srgb,var(--acc) 9%,transparent),transparent 70%);opacity:.9}
${c} .w{padding-block:clamp(28px,4vw,56px) clamp(56px,7vw,96px)}
${c} .hg-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(150px,auto);gap:clamp(10px,1.2vw,16px)}
${c} .hg-c{position:relative;isolation:isolate;overflow:hidden;border-radius:calc(var(--r) + 6px);background:var(--carte);border:1px solid var(--bord);color:var(--tx);text-decoration:none;min-width:0}
${c} .hg-c.s-champ,${c} .hg-c.s-accent{background:var(--bg);border-color:transparent}
${c} .hg-c::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(320px circle at var(--mx,-400px) var(--my,-400px),color-mix(in srgb,var(--acc) 16%,transparent),transparent 70%);opacity:0;transition:opacity .4s}
${c} .hg-g:hover .hg-c::before{opacity:1}
${c} .hg-in{position:relative;height:100%;display:flex;flex-direction:column;gap:10px;padding:clamp(18px,2vw,26px)}
${c} .hg-titre{grid-column:span 2;grid-row:span 2}
${c} .hg-titre .hg-in{justify-content:flex-end;gap:clamp(16px,2vw,24px);padding:clamp(24px,3.4vw,48px);min-height:clamp(360px,40vw,500px);--hmax:4.6rem}
${c} .hg-titre::after{content:"";position:absolute;right:-18%;top:-30%;width:70%;aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--acc) 30%,transparent),transparent);z-index:-1;pointer-events:none}
${c} .hg-titre .h-sur{font-size:clamp(1.05rem,1.5vw,1.25rem);font-weight:var(--fxf)}
${c} .hg-titre .h-phrase{font-size:clamp(1.05rem,1.3vw,1.18rem);line-height:1.5;color:var(--tx2);max-width:44ch}
${c} .l2{grid-column:span 2}${c} .l4{grid-column:1/-1}${c} .haut{grid-row:span 2}
${c} .hg-k{display:flex;align-items:center;gap:8px;font-weight:var(--fxf);font-size:.95rem;color:var(--tx2)}
${c} .hg-k .ic{color:var(--accT);width:18px;height:18px}
${c} .hg-x{font-size:1.08rem;line-height:1.4;font-weight:var(--fxf)}
${c} .hg-note .hg-in{justify-content:space-between}
${c} .hg-n{display:flex;align-items:flex-start;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);line-height:.9}
${c} .hg-n b{font-weight:inherit;font-size:clamp(3.2rem,6vw,4.8rem);letter-spacing:-.03em}
${c} .hg-n span{font-size:1.3rem;margin-top:.3em;opacity:.75}
${c} .hg-note .etoiles .ic{width:18px;height:18px}${c} .hg-note .etoiles .vd .ic{opacity:.35}
${c} .hg-p{font-size:.98rem;color:var(--tx2)}
${c} .hg-act .hg-in{justify-content:space-between}
${c} .hg-act .hg-ic{width:52px;height:52px;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);transition:transform .6s var(--ease)}
${c} .hg-act .hg-ic .ic{width:26px;height:26px}
${c} .hg-act .hg-f{position:absolute;right:clamp(18px,2vw,26px);top:clamp(18px,2vw,26px);transition:transform .5s var(--ease)}
${c} .hg-act:hover .hg-ic{transform:rotate(-10deg) scale(1.06)}${c} .hg-act:hover .hg-f{transform:translateX(4px)}
${c} .hg-act:focus-visible{outline:3px solid var(--acc);outline-offset:3px}
${c} .hg-hor .hg-in,${c} .hg-lieu .hg-in{justify-content:space-between}
${c} .hg-etat{display:flex;align-items:center;gap:8px;font-size:.95rem;font-weight:var(--fxf)}
${c} .hg-etat i{width:9px;height:9px;border-radius:50%;background:var(--tx2)}
${c} .hg-etat.est-ouvert i{background:#16a34a;box-shadow:0 0 0 0 rgb(22 163 74 / .6);animation:k-hero-bento-pouls 2s infinite}
${c} .hg-etat.est-ferme i{background:#dc2626}
${c} .hg-srv .hg-in{gap:8px}
${c} .hg-si{width:44px;height:44px;display:grid;place-items:center;border-radius:var(--rb);background:var(--teinte);color:var(--teinteT);margin-bottom:auto;transition:transform .6s var(--ease)}
${c} .hg-si .ic{width:22px;height:22px}
${c} .hg-st{font-size:1.12rem;line-height:1.25;margin:10px 0 0;font-weight:var(--fxf)}
${c} .hg-sp{color:var(--tx2);font-size:.96rem;line-height:1.45}
${c} .hg-srv{transition:transform .6s var(--ease),border-color .4s}
${c} .hg-srv:hover{transform:translateY(-4px);border-color:var(--acc)}
${c} .hg-srv:hover .hg-si{transform:rotate(-8deg)}
@keyframes k-hero-bento-pouls{70%{box-shadow:0 0 0 9px rgb(22 163 74 / 0)}100%{box-shadow:0 0 0 0 rgb(22 163 74 / 0)}}
${cssEntree(c, 'bento')}
@media(max-width:980px){${c} .hg-g{grid-template-columns:repeat(2,minmax(0,1fr))}${c} .hg-titre{grid-column:1/-1;grid-row:auto}${c} .l4{grid-column:1/-1}${c} .l2{grid-column:span 2}${c} .hg-titre .hg-in{min-height:0}}
@media(max-width:480px){${c} .hg-g{grid-auto-rows:minmax(128px,auto)}${c} .hg-srv .hg-sp{display:none}}
@media(prefers-reduced-motion:reduce){${c} *{animation:none!important;transition:none!important}}
`;
  }
};

module.exports = [heroFraicheur, heroCourant, heroOndes, heroVapeur, heroBrise, heroEclat, heroRoute, heroSoleil, heroTypo, heroIcone, heroCarte, heroBento];
