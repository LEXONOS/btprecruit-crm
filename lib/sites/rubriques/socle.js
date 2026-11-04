// Le socle : une variante sûre pour chaque rubrique, celle que l'assembleur prend quand rien d'autre ne convient.
// Reprise des modèles éprouvés (photo plein écran, deux colonnes, aplat sans photo, cartes de services...), avec le
// mouvement et les surfaces de la nouvelle bibliothèque.
'use strict';
const MQ = require('../../martinique');

/* ── en-tête ── */
const navClassique = {
  id: 'nav.classique', rubrique: 'nav', nom: 'Barre classique', quand: 'toujours possible : nom à gauche, liens, bouton d\'action, menu animé sur téléphone',
  surfaces: ['fond'], js: ['tete', 'menu'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, nom = h.net(spec.nom);
    const sur = bloc && bloc.surPhoto;
    const liens = (ctx.ancres || []).map(function (a, k) { return '<a class="l" href="' + h.esc(a.href) + '" style="--i:' + (k + 1) + '">' + h.esc(a.nom) + '</a>'; }).join('');
    const a = h.actionPrincipale(spec);
    const cta = a ? '<a class="btn b1 nav-cta" href="' + h.esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + '>' + h.contenuBouton(a.icone, a.type === 'tel' ? 'Appeler' : a.court) + '</a>' : '';
    return '<header class="' + h.classes('nav.classique', bloc, (sur ? 'sur-photo' : '')) + '" data-tete="cache"><div class="w nb">' + ctx.marque + '<nav class="liens" aria-label="Navigation">' + liens + '</nav><div class="na">' + cta + ctx.burger + '</div></div>' + ctx.menuMobile + '</header>';
  },
  css: function () { return `
/* le fond, le flou et le déplacement sont portés par des enfants : posés sur l'en-tête, ils enfermeraient le menu plein
   écran (position fixed) dans la hauteur de la barre */
.r-nav-classique{position:sticky;top:0;z-index:50;background:transparent;transition:color .4s}
.r-nav-classique::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:color-mix(in srgb,var(--fond) 96%,transparent);border-bottom:1px solid transparent;transition:background-color .4s,box-shadow .4s,border-color .4s,transform .5s var(--ease),opacity .4s}
.r-nav-classique>.w{transition:transform .5s var(--ease)}
.r-nav-classique.sur-photo{position:fixed;left:0;right:0;color:#fff;--tx:#fff;--btn:var(--btnP);--btnT:var(--btnPT)}
.r-nav-classique.sur-photo::before{opacity:0}
.r-nav-classique.defile{color:var(--encre);--tx:var(--encre);--btn:var(--accent);--btnT:var(--surA)}
.r-nav-classique.defile::before{opacity:1;background:color-mix(in srgb,var(--fond) 94%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);box-shadow:0 10px 30px -18px rgb(0 0 0 / .35);border-color:var(--ligne)}
.r-nav-classique.range::before,.r-nav-classique.range>.w{transform:translateY(-102%)}
.r-nav-classique.range{pointer-events:none}
.r-nav-classique .nb{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:84px;transition:min-height .4s var(--ease)}
.r-nav-classique.defile .nb{min-height:70px}
.r-nav-classique .liens{display:flex;gap:30px;font-weight:var(--fxf);font-size:.98rem}
.r-nav-classique .l{position:relative;text-decoration:none;padding:8px 0}
.r-nav-classique .l::after{content:"";position:absolute;left:0;right:0;bottom:2px;height:2px;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .45s var(--ease)}
.r-nav-classique .l:hover::after{transform:scaleX(1);transform-origin:left}
.r-nav-classique .na{display:flex;align-items:center;gap:10px}
.r-nav-classique .nav-cta{min-height:48px;padding:0 20px;font-size:.95rem}
@media(max-width:900px){.r-nav-classique .liens{display:none}.r-nav-classique .nb{min-height:70px}}
@media(max-width:420px){.r-nav-classique .nav-cta .bt{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}.r-nav-classique .nav-cta{padding:0 14px}}
`; }
};

/* ── haut de page ── */
function corpsHero(spec, ctx, o) {
  o = o || {};
  const h = ctx.h, tx = ctx.textes, ty = ctx.type;
  const h1 = '<h1 class="t h1" style="--hk:' + (ctx.mod.titres === 'nom' ? h.kUne(tx.h1, ty) : h.k2(tx.h1, ty)) + '" data-r="mots">' + h.mots(tx.h1) + '</h1>';
  const sur = tx.sur ? '<p class="h-sur"' + h.rv('monte', 1) + '>' + h.esc(tx.sur) + '</p>' : '';
  const phrase = tx.phrase ? '<p class="h-phrase"' + h.rv('monte', 4) + '>' + h.esc(tx.phrase) + '</p>' : '';
  const act = '<div' + h.rv('monte', 5) + '>' + h.boutons(spec) + '</div>';
  const conf = o.confiance === false ? '' : '<div' + h.rv('monte', 6) + '>' + h.confiance(spec) + '</div>';
  return (o.surAvant ? sur + h1 : h1 + sur) + phrase + act + conf;
}
const heroVoile = {
  id: 'hero.voile', rubrique: 'hero', nom: 'Photo plein écran, voile dégradé', quand: 'une belle photo large du métier : le texte se lit sur un voile sombre à gauche',
  surfaces: ['photo'], js: ['parallaxe'],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.voile', bloc, 'h') + '" aria-label="Présentation"><div class="hv-img" data-px="0.12">' + h.figure(ph, 'eager', '100vw', { attrs: h.rv('recul') }) + '</div>' + h.fond(bloc) + '<div class="w"><div class="h-txt cq">' + corpsHero(spec, ctx) + '</div></div></section>';
  },
  css: function () { return `
.r-hero-voile{min-height:clamp(600px,92vh,880px);display:grid;align-items:center;overflow:hidden;color:#fff}
.r-hero-voile .hv-img{position:absolute;inset:-8% 0;z-index:-2}
.r-hero-voile .hv-img .ph{height:100%;border-radius:0}
.r-hero-voile::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgb(var(--voile) / .94) 0%,rgb(var(--voile) / .8) 36%,rgb(var(--voile) / .28) 72%,rgb(var(--voile) / .1) 100%)}
.r-hero-voile .w{padding-block:clamp(130px,14vw,180px) clamp(72px,9vw,120px)}
.r-hero-voile .h-txt{display:grid;gap:clamp(18px,2.4vw,26px);max-width:660px;--hmax:5.6rem}
.r-hero-voile .h1{text-shadow:0 2px 30px rgb(var(--voile) / .35)}
.r-hero-voile .h-phrase{font-size:clamp(1.08rem,1.45vw,1.3rem);line-height:1.5;max-width:44ch;color:rgb(255 255 255 / .9)}
.r-hero-voile .h-sur{font-size:.92rem;letter-spacing:.16em;text-transform:uppercase;font-weight:var(--fxf)}
.r-hero-voile .confiance{color:rgb(255 255 255 / .9)}.r-hero-voile .confiance .ic{color:#fff}.r-hero-voile .confiance b{color:#fff}
.r-hero-voile .b2{color:#fff;border-color:rgb(255 255 255 / .7)}
@media(max-width:860px){.r-hero-voile{min-height:auto}.r-hero-voile::before{background:linear-gradient(180deg,rgb(var(--voile) / .55) 0%,rgb(var(--voile) / .9) 100%)}}
`; }
};
const heroCote = {
  id: 'hero.cote', rubrique: 'hero', nom: 'Deux colonnes, photo en portrait', quand: 'texte à gauche, grande photo à droite avec la note Google en carte flottante',
  surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero, g = h.noteGoogle(spec);
    const note = g ? '<div class="hc-note"' + h.rv('monte', 7) + '>' + h.etoiles(g.note) + '<span><b>' + h.noteTexte(g) + '</b> sur Google</span><span>' + g.avis + ' avis</span></div>' : '';
    return '<section class="' + h.classes('hero.cote', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="w"><div class="h-txt cq">' + corpsHero(spec, ctx) + '</div><div class="hc-vis">' + h.figure(ph, 'eager', '(max-width:860px) 100vw, 50vw', { attrs: h.rv('rideau', 2) }) + note + '</div></div></section>';
  },
  css: function () { return `
.r-hero-cote .w{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(32px,5vw,84px);align-items:center;padding-block:clamp(40px,6vw,90px) clamp(60px,7vw,110px)}
.r-hero-cote .h-txt{display:grid;gap:clamp(18px,2.4vw,26px);--hmax:4.9rem}
.r-hero-cote .h-phrase{font-size:clamp(1.08rem,1.45vw,1.28rem);line-height:1.5;max-width:44ch;color:var(--tx2)}
.r-hero-cote .h-sur{font-size:.92rem;letter-spacing:.14em;text-transform:uppercase;font-weight:var(--fxf);color:var(--accT)}
.r-hero-cote .hc-vis{position:relative}
.r-hero-cote .hc-vis .ph{aspect-ratio:4/5;box-shadow:var(--ombreF)}
.r-hero-cote .hc-note{position:absolute;left:clamp(-28px,-2vw,-12px);bottom:clamp(20px,3vw,36px);z-index:2;background:var(--carte);color:var(--encre);border-radius:var(--r);box-shadow:var(--ombreF);padding:14px 18px;display:grid;gap:4px;font-size:.92rem;line-height:1.3}
.r-hero-cote .hc-note b{font-size:1.5rem;font-family:var(--ft);font-weight:var(--tp)}
@media(max-width:860px){.r-hero-cote .w{grid-template-columns:1fr}.r-hero-cote .hc-vis .ph{aspect-ratio:4/3}.r-hero-cote .hc-note{left:12px;bottom:12px}}
`; }
};
const heroAffiche = {
  id: 'hero.affiche', rubrique: 'hero', nom: 'Affiche centrée sur photo', quand: 'lieux et ambiances (restaurant, mer, hébergement) : le nom au centre, très grand',
  surfaces: ['photo'], js: ['parallaxe'],
  besoin: function (spec, ctx) { return !!ctx.alloc.hero; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, ph = ctx.alloc.hero;
    return '<section class="' + h.classes('hero.affiche', bloc, 'h') + '" aria-label="Présentation"><div class="ha-img" data-px="0.18">' + h.figure(ph, 'eager', '100vw', { attrs: h.rv('recul') }) + '</div>' + h.fond(bloc) + '<div class="w"><div class="h-txt cq">' + corpsHero(spec, ctx, { surAvant: true }) + '</div></div><a class="ha-bas" href="#' + ((ctx.ancres[0] && ctx.ancres[0].id) || 'contact') + '" aria-label="Voir la suite"><span></span></a></section>';
  },
  css: function () { return `
.r-hero-affiche{min-height:clamp(640px,96vh,940px);display:grid;align-items:center;text-align:center;overflow:hidden;color:#fff}
.r-hero-affiche .ha-img{position:absolute;inset:-10% 0;z-index:-2}.r-hero-affiche .ha-img .ph{height:100%;border-radius:0}
.r-hero-affiche::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / .66) 0%,rgb(var(--voile) / .38) 45%,rgb(var(--voile) / .78) 100%)}
.r-hero-affiche .h-txt{display:grid;justify-items:center;gap:22px;padding-block:clamp(140px,15vw,190px) clamp(90px,10vw,130px);--hmax:7.4rem}
.r-hero-affiche .h-sur{font-size:.92rem;letter-spacing:.26em;text-transform:uppercase;font-weight:var(--fxf)}
.r-hero-affiche .h-phrase{font-size:clamp(1.08rem,1.5vw,1.3rem);max-width:46ch;color:rgb(255 255 255 / .9)}
.r-hero-affiche .actions,.r-hero-affiche .confiance{justify-content:center}
.r-hero-affiche .confiance{color:rgb(255 255 255 / .9)}.r-hero-affiche .confiance .ic,.r-hero-affiche .confiance b{color:#fff}
.r-hero-affiche .b2{color:#fff;border-color:rgb(255 255 255 / .7)}
.r-hero-affiche .ha-bas{position:absolute;left:50%;bottom:26px;width:28px;height:46px;margin-left:-14px;border:2px solid rgb(255 255 255 / .7);border-radius:20px}
.r-hero-affiche .ha-bas span{position:absolute;left:50%;top:9px;width:4px;height:9px;margin-left:-2px;border-radius:2px;background:#fff;animation:k-ha-bas 1.8s var(--ease) infinite}
@keyframes k-ha-bas{0%{transform:none;opacity:1}70%{transform:translateY(14px);opacity:0}100%{opacity:0}}
@media(max-width:600px){.r-hero-affiche .h-sur{letter-spacing:.12em;font-size:.82rem}.r-hero-affiche .ha-bas{display:none}}
`; }
};
const heroAplat = {
  id: 'hero.aplat', rubrique: 'hero', nom: 'Aplat de couleur, services en tuiles', quand: 'sans photo : grand titre sur un fond travaillé, les services en tuiles lumineuses',
  surfaces: ['champ'], js: [], photo: 'non',
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    const tuiles = h.servicesDe(spec).slice(0, 4).map(function (s, k) { return '<li' + h.rv('monte', 4 + k) + '>' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '<span>' + h.esc(h.net(s.titre)) + '</span></li>'; }).join('');
    return '<section class="' + h.classes('hero.aplat', bloc, 'h') + '" aria-label="Présentation">' + h.fond(bloc) + '<div class="w"><div class="h-txt cq">' + corpsHero(spec, ctx) + '</div>' + (tuiles ? '<ul class="tuiles" aria-hidden="true">' + tuiles + '</ul>' : '') + '</div></section>';
  },
  css: function () { return `
.r-hero-aplat{overflow:hidden}
.r-hero-aplat .w{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:clamp(32px,5vw,72px);align-items:center;padding-block:clamp(70px,9vw,130px)}
.r-hero-aplat .h-txt{display:grid;gap:clamp(18px,2.4vw,26px);--hmax:5.4rem}
.r-hero-aplat .h-phrase{font-size:clamp(1.08rem,1.45vw,1.28rem);line-height:1.5;max-width:44ch;color:var(--tx2)}
.r-hero-aplat .h-sur{font-size:.92rem;letter-spacing:.14em;text-transform:uppercase;font-weight:var(--fxf);color:var(--accT)}
.r-hero-aplat .tuiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.r-hero-aplat .tuiles li{background:color-mix(in srgb,currentColor 7%,transparent);border:1px solid var(--bord);border-radius:var(--r);padding:clamp(18px,2vw,24px);display:grid;gap:14px;align-content:start;font-weight:var(--fxf);line-height:1.3;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:transform .5s var(--ease),background-color .3s}
.r-hero-aplat .tuiles li:hover{transform:translateY(-4px);background:color-mix(in srgb,currentColor 12%,transparent)}
.r-hero-aplat .tuiles .ic{width:30px;height:30px;color:var(--acc)}
@media(max-width:860px){.r-hero-aplat .w{grid-template-columns:1fr}}
`; }
};

/* ── bandeau : les atouts qui chevauchent le haut de page ── */
const bandeauAtouts = {
  id: 'bandeau.atouts', rubrique: 'bandeau', nom: 'Trois atouts en carte qui chevauche', quand: 'artisans : trois engagements posés à cheval sur le haut de page',
  surfaces: ['fond'], js: [], inclut: ['atouts'],
  besoin: function (spec, ctx) { return ctx.h.atouts(spec).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = h.atouts(spec).slice(0, 3);
    return '<section class="' + h.classes('bandeau.atouts', bloc) + '" aria-label="' + h.esc(ctx.mod.textes.pourquoi) + '"><div class="w"><ul>' + a.map(function (x, k) { return '<li' + h.rv('monte', k) + '><span class="ic-b">' + h.icone(h.iconeDe(x, 'check')) + '</span><div><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</div></li>'; }).join('') + '</ul></div></section>';
  },
  css: function () { return `
.r-bandeau-atouts{z-index:3;background:transparent;margin-top:calc(-1 * clamp(44px,6vw,84px))}
.r-bandeau-atouts ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:var(--carte);color:var(--encre);border-top:4px solid var(--accent);border-radius:var(--r);box-shadow:var(--ombreF);overflow:hidden}
.r-bandeau-atouts li{display:flex;gap:18px;align-items:flex-start;padding:clamp(22px,2.6vw,34px)}
.r-bandeau-atouts li+li{border-left:1px solid var(--ligne)}
.r-bandeau-atouts .ic-b{width:52px;height:52px;flex:none;display:grid;place-items:center;background:var(--accent);color:var(--surA);border-radius:var(--rb)}
.r-bandeau-atouts .ic-b .ic{width:26px;height:26px}
.r-bandeau-atouts h3{font-size:1.1rem;margin-bottom:4px}
.r-bandeau-atouts p{color:var(--doux);font-size:.96rem;line-height:1.5}
@media(max-width:860px){.r-bandeau-atouts{margin-top:-28px}.r-bandeau-atouts ul{grid-template-columns:1fr}.r-bandeau-atouts li+li{border-left:0;border-top:1px solid var(--ligne)}}
`; }
};

/* ── services ── */
const servicesCartes = {
  id: 'services.cartes', rubrique: 'services', nom: 'Cartes', quand: 'toujours possible : une carte par service, avec sa photo si chacun en a une, sinon son icône',
  surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return ctx.h.servicesDe(spec).length >= 1; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = h.servicesDe(spec).slice(0, 6);
    const toutes = sv.every(function (s, k) { return ctx.alloc.services[k]; });
    const cartes = sv.map(function (s, k) {
      const p = toutes ? ctx.alloc.services[k] : null;
      return '<article class="carte"' + h.rv('monte', k % 3) + '>' + (p ? h.figure(p, 'lazy', '(max-width:620px) 100vw, (max-width:980px) 50vw, 33vw') : '') + '<div class="cc"><span class="ic-r">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><h3>' + h.esc(h.net(s.titre)) + '</h3>' + (h.net(s.texte) ? '<p>' + h.esc(h.net(s.texte)) + '</p>' : '') + '</div></article>';
    }).join('');
    return '<section class="' + h.classes('services.cartes', bloc, 'sec') + '" id="services">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.textes.services) + '<div class="grille n' + sv.length + '">' + cartes + '</div></div></section>';
  },
  css: function () { return `
.r-services-cartes .grille{display:grid;gap:clamp(16px,2vw,24px);grid-template-columns:repeat(3,minmax(0,1fr))}
.r-services-cartes .grille.n2,.r-services-cartes .grille.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.r-services-cartes .carte{background:var(--carte);border:1px solid var(--bord);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;transition:transform .55s var(--ease),box-shadow .55s var(--ease)}
.r-services-cartes .carte:hover{transform:translateY(-6px);box-shadow:var(--ombreF)}
.r-services-cartes .carte>.ph{border-radius:0;aspect-ratio:3/2}
.r-services-cartes .carte>.ph img{transition:transform 1.2s var(--ease)}
.r-services-cartes .carte:hover>.ph img{transform:scale(1.06)}
.r-services-cartes .cc{padding:clamp(22px,2.4vw,30px);display:grid;gap:10px;align-content:start}
.r-services-cartes .ic-r{width:52px;height:52px;display:grid;place-items:center;background:var(--teinte);color:var(--teinteT);border-radius:var(--rb)}
.r-services-cartes .ph+.cc .ic-r{margin-top:calc(-26px - clamp(22px,2.4vw,30px));box-shadow:0 0 0 5px var(--carte);background:var(--accent);color:var(--surA)}
.r-services-cartes .ic-r .ic{width:26px;height:26px}
.r-services-cartes .carte p{color:var(--tx2)}
@media(max-width:980px){.r-services-cartes .grille{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.r-services-cartes .grille,.r-services-cartes .grille.n2,.r-services-cartes .grille.n4{grid-template-columns:1fr}}
`; }
};
const servicesListe = {
  id: 'services.liste', rubrique: 'services', photo: 'non', nom: 'Liste à la carte', quand: 'tables, soins, prestations : une liste élégante en deux colonnes, comme une carte',
  surfaces: ['fond', 'surface'], js: [], familles: ['comptoir', 'ecrin', 'boutique', 'cabinet'],
  besoin: function (spec, ctx) { return ctx.h.servicesDe(spec).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = h.servicesDe(spec).slice(0, 8);
    return '<section class="' + h.classes('services.liste', bloc, 'sec') + '" id="services">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.textes.services, null, { classe: 'c' }) + '<ul class="menu">' + sv.map(function (s, k) { return '<li' + h.rv('monte', k % 2) + '><h3>' + h.esc(h.net(s.titre)) + '</h3>' + (h.net(s.texte) ? '<p>' + h.esc(h.net(s.texte)) + '</p>' : '') + '</li>'; }).join('') + '</ul></div></section>';
  },
  css: function () { return `
.r-services-liste .menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:clamp(32px,5vw,80px);max-width:1000px;margin-inline:auto}
.r-services-liste .menu li{padding:24px 0;border-bottom:1px solid var(--bord);display:grid;gap:6px}
.r-services-liste .menu h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-size:clamp(1.3rem,2vw,1.65rem);line-height:1.15}
.r-services-liste .menu p{color:var(--tx2)}
@media(max-width:760px){.r-services-liste .menu{grid-template-columns:1fr}}
`; }
};

/* ── pourquoi nous ── */
const pourquoiGrille = {
  id: 'pourquoi.grille', rubrique: 'pourquoi', nom: 'Grille d\'engagements', quand: 'toujours possible avec deux atouts ou plus : icône, titre, une ligne',
  surfaces: ['surface', 'champ', 'fond'], js: [],
  besoin: function (spec, ctx) { return ctx.h.atouts(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = h.atouts(spec);
    return '<section class="' + h.classes('pourquoi.grille', bloc, 'sec') + '" id="pourquoi">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.pourquoi) + '<ul>' + a.map(function (x, k) { return '<li' + h.rv('monte', k) + '><span class="ic-r">' + h.icone(h.iconeDe(x, 'check')) + '</span><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('') + '</ul></div></section>';
  },
  css: function () { return `
.r-pourquoi-grille ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:clamp(18px,2.4vw,32px)}
.r-pourquoi-grille li{display:grid;gap:12px;align-content:start;background:var(--carte);border:1px solid var(--bord);border-radius:var(--r);padding:clamp(24px,2.6vw,34px);transition:transform .5s var(--ease),border-color .3s}
.r-pourquoi-grille li:hover{transform:translateY(-5px);border-color:var(--acc)}
.r-pourquoi-grille .ic-r{width:52px;height:52px;display:grid;place-items:center;background:color-mix(in srgb,var(--acc) 16%,transparent);color:var(--accT);border-radius:var(--rb)}
.r-pourquoi-grille .ic-r .ic{width:26px;height:26px}
.r-pourquoi-grille p{color:var(--tx2)}
`; }
};

/* ── présentation ── */
const aproposPhoto = {
  id: 'apropos.photo', rubrique: 'apropos', nom: 'Photo et texte', quand: 'toujours possible : la présentation, avec une photo décalée si on en a une',
  surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return !!ctx.h.net(spec.a_propos); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, t = h.net(spec.a_propos), p = ctx.alloc.apropos, g = h.noteGoogle(spec), c = spec.contact || {};
    const coches = [h.lieuCourt(spec) + (h.zoneClient(spec) || !spec.commune ? '' : ', en Martinique')];
    if (g) coches.push('Noté ' + h.noteTexte(g) + ' sur 5 par ' + g.avis + ' clients sur Google');
    if (h.waHref(c.mobile || c.tel)) coches.push('Joignable par téléphone et sur WhatsApp');
    else if (c.tel) coches.push('Joignable par téléphone au ' + MQ.affiche(c.tel));
    const titre = (bloc && bloc.titre) || ctx.mod.textes.apropos;
    return '<section class="' + h.classes('apropos.photo', bloc, 'sec') + '" id="apropos">' + h.fond(bloc) + '<div class="w ap' + (p ? '' : ' sans') + '">' + (p ? '<div class="ap-vis">' + h.figure(p, 'lazy', '(max-width:860px) 100vw, 50vw', { attrs: h.rv('rideau') }) + '</div>' : '') + '<div class="tx"' + h.rv('monte', 1) + '><h2 class="t">' + h.esc(titre) + '</h2><p class="grand">' + h.esc(t) + '</p><ul class="coches">' + coches.map(function (x) { return '<li>' + h.icone('check') + '<span>' + h.esc(x) + '</span></li>'; }).join('') + '</ul>' + h.boutons(spec, { seule: true }) + '</div></div></section>';
  },
  css: function () { return `
.r-apropos-photo .ap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,5.5vw,92px);align-items:center}
.r-apropos-photo .ap.sans{grid-template-columns:minmax(0,1fr);max-width:820px}
.r-apropos-photo .ap-vis{position:relative;padding:0 0 18px 18px}
.r-apropos-photo .ap-vis::before{content:"";position:absolute;left:0;bottom:0;width:72%;height:78%;background:var(--acc);border-radius:var(--rp);opacity:.9}
.r-apropos-photo .ap-vis .ph{aspect-ratio:4/3;box-shadow:var(--ombreF)}
.r-apropos-photo .tx{display:grid;gap:20px;justify-items:start}
.r-apropos-photo .grand{font-size:clamp(1.1rem,1.4vw,1.25rem);line-height:1.65;color:var(--tx2)}
.r-apropos-photo .coches{display:grid;gap:10px}
.r-apropos-photo .coches li{display:flex;gap:10px;align-items:flex-start}
.r-apropos-photo .coches .ic{color:var(--accT);margin-top:3px}
@media(max-width:860px){.r-apropos-photo .ap{grid-template-columns:1fr}}
`; }
};

/* ── étapes ── */
const etapesTrois = {
  id: 'etapes.trois', rubrique: 'etapes', nom: 'Trois temps numérotés', quand: 'toujours possible avec trois étapes : des colonnes, un gros chiffre, un trait qui se dessine',
  surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return ctx.h.etapes(spec).length >= 3 && spec.objectif !== 'visite'; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, e = h.etapes(spec).slice(0, 3);
    return '<section class="' + h.classes('etapes.trois', bloc, 'sec') + '" id="etapes">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.etapes) + '<ol class="et">' + e.map(function (x, k) { return '<li' + h.rv('monte', k) + '><h3>' + h.esc(h.majuscule(h.net(x.titre).replace(/[.]+$/, ''))) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</li>'; }).join('') + '</ol></div></section>';
  },
  css: function () { return `
.r-etapes-trois .et{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,44px);counter-reset:e}
.r-etapes-trois .et li{display:grid;gap:10px;align-content:start;padding-top:26px;border-top:2px solid var(--bord);position:relative}
.r-etapes-trois .et li::before{counter-increment:e;content:counter(e,decimal-leading-zero);font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:clamp(2.6rem,4.4vw,3.6rem);line-height:1;color:var(--accT)}
.r-etapes-trois .et li::after{content:"";position:absolute;top:-2px;left:0;width:64px;height:2px;background:var(--acc);transform-origin:left;transition:transform 1.2s var(--ease) .3s}
.js .r-etapes-trois .et li:not(.vu)::after{transform:scaleX(0)}
.r-etapes-trois .et h3{font-size:1.25rem}
.r-etapes-trois .et p{color:var(--tx2)}
@media(max-width:760px){.r-etapes-trois .et{grid-template-columns:1fr}}
`; }
};

/* ── galerie : seulement ses photos à lui ── */
const galerieMosaique = {
  id: 'galerie.mosaique', rubrique: 'galerie', nom: 'Mosaïque', quand: 'ses propres photos (trois ou plus) : une grande et des petites, zoom au survol',
  surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return ctx.alloc.galerie.length >= 2; },
  rendre: function (spec, ctx, bloc) {
    // jamais une photo déjà montrée plus haut sur la page
    const h = ctx.h, ph = ctx.alloc.galerie.filter(function (p) { return !(h.vue && h.vue(p)); });
    if (ph.length < 2) return '';
    const n = ph.length >= 5 ? 5 : ph.length >= 3 ? 3 : 2;
    return '<section class="' + h.classes('galerie.mosaique', bloc, 'sec') + '" id="images">' + h.fond(bloc) + '<div class="w">' + h.teteSec(ctx.mod.textes.galerie) + '<div class="gal n' + n + '">' + ph.slice(0, n).map(function (p, k) { return h.figure(p, 'lazy', k === 0 ? '(max-width:760px) 100vw, 66vw' : '(max-width:760px) 50vw, 33vw', { attrs: h.rv('zoom', k) }); }).join('') + '</div></div></section>';
  },
  css: function () { return `
.r-galerie-mosaique .gal{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:clamp(160px,20vw,300px);gap:clamp(8px,1.2vw,14px)}
.r-galerie-mosaique .ph{grid-column:span 4}
.r-galerie-mosaique .ph:first-child{grid-column:span 8;grid-row:span 2}
.r-galerie-mosaique .gal.n2 .ph{grid-column:span 6;grid-row:span 2}
.r-galerie-mosaique .gal.n5 .ph:nth-child(n+4){grid-column:span 6}
.r-galerie-mosaique .ph img{transition:transform 1.2s var(--ease)}
.r-galerie-mosaique .ph:hover img{transform:scale(1.06)}
@media(max-width:760px){.r-galerie-mosaique .gal{grid-template-columns:1fr 1fr;grid-auto-rows:clamp(140px,42vw,240px)}.r-galerie-mosaique .ph,.r-galerie-mosaique .gal.n5 .ph:nth-child(n+4){grid-column:span 1;grid-row:span 1}.r-galerie-mosaique .ph:first-child,.r-galerie-mosaique .gal.n2 .ph{grid-column:span 2;grid-row:span 1}}
`; }
};

/* ── avis : la vraie note Google, jamais un témoignage inventé ── */
const avisNote = {
  id: 'avis.note', rubrique: 'avis', nom: 'La note Google en grand', quand: 'une bonne note Google (4 et plus, 5 avis et plus) : le chiffre qui compte, les étoiles',
  surfaces: ['champ', 'surface', 'fond'], js: ['compteur'],
  besoin: function (spec, ctx) { return !!ctx.h.noteGoogle(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec);
    return '<section class="' + h.classes('avis.note', bloc, 'sec') + '" id="avis" aria-label="Avis Google">' + h.fond(bloc) + '<div class="w an"><div class="an-n"' + h.rv('zoom') + '><span class="an-c" data-compte="' + Number(g.note) + '" data-dec="1">' + h.noteTexte(g) + '</span><span class="an-s">/5</span></div><div class="an-t"' + h.rv('monte', 1) + '>' + h.etoiles(g.note) + '<h2 class="t">' + h.esc(g.avis + ' clients l\'ont noté sur Google') + '</h2><p>La note moyenne de ' + h.esc(h.net(spec.nom)) + ' sur sa fiche Google.</p></div></div></section>';
  },
  css: function () { return `
.r-avis-note .an{display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(24px,5vw,80px);align-items:center}
.r-avis-note .an-n{font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);line-height:.85;display:flex;align-items:flex-start;color:var(--accT)}
.r-avis-note .an-c{font-size:clamp(5.5rem,14vw,12rem);letter-spacing:-.04em}
.r-avis-note .an-s{font-size:clamp(1.8rem,4vw,3.2rem);margin-top:.4em;opacity:.7}
.r-avis-note .an-t{display:grid;gap:14px}
.r-avis-note .etoiles .ic{width:26px;height:26px}
.r-avis-note .an-t p{color:var(--tx2);font-size:1.08rem}
@media(max-width:700px){.r-avis-note .an{grid-template-columns:1fr}}
`; }
};

/* ── infos pratiques : horaires, ouvert maintenant, zone ── */
const infosPratiques = {
  id: 'infos.pratiques', rubrique: 'infos', nom: 'Infos pratiques', quand: 'des horaires connus ou une zone d\'intervention : ouvert maintenant, horaires, où on intervient',
  surfaces: ['fond', 'surface'], js: ['ouvert'],
  besoin: function (spec, ctx) { return ctx.h.horairesDe(spec.contact).length > 0 || !!ctx.h.zoneClient(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, hs = h.horairesDe(c), mach = h.horairesMachine(hs), z = h.zoneClient(spec);
    const etat = mach ? '<p class="ip-etat" data-horaires="' + h.esc(mach) + '"><i></i><span data-ouvert-texte>Horaires de la semaine</span></p>' : '';
    const hor = hs.length ? '<div class="ip-c"' + h.rv('monte', 1) + '><h3>' + h.icone('horloge') + 'Horaires</h3>' + etat + h.listeHoraires(hs) + '</div>' : '';
    const ou = '<div class="ip-c"' + h.rv('monte', 2) + '><h3>' + h.icone('pin') + (z ? 'Où nous intervenons' : 'Où nous trouver') + '</h3><p>' + h.esc(z || (c.adresse || ((spec.commune ? spec.commune + ', ' : '') + 'Martinique'))) + '</p>' + (c.maps ? '<a class="ip-l" href="' + h.esc(c.maps) + '" target="_blank" rel="noopener">Voir l\'itinéraire</a>' : '') + '</div>';
    return '<section class="' + h.classes('infos.pratiques', bloc, 'sec') + '" id="infos">' + h.fond(bloc) + '<div class="w">' + h.teteSec('Infos pratiques') + '<div class="ip">' + hor + ou + '</div></div></section>';
  },
  css: function () { return `
.r-infos-pratiques .ip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:clamp(16px,2vw,24px)}
.r-infos-pratiques .ip-c{background:var(--carte);border:1px solid var(--bord);border-radius:var(--r);padding:clamp(24px,2.6vw,34px);display:grid;gap:14px;align-content:start}
.r-infos-pratiques h3{display:flex;align-items:center;gap:10px}.r-infos-pratiques h3 .ic{color:var(--accT)}
.r-infos-pratiques .ip-etat{display:flex;align-items:center;gap:10px;font-weight:var(--fxf)}
.r-infos-pratiques .ip-etat i{width:10px;height:10px;border-radius:50%;background:var(--tx2)}
.r-infos-pratiques .est-ouvert i{background:#16a34a;box-shadow:0 0 0 0 rgb(22 163 74 / .6);animation:k-ip-pouls 2s infinite}
.r-infos-pratiques .est-ferme i{background:#dc2626}
@keyframes k-ip-pouls{70%{box-shadow:0 0 0 10px rgb(22 163 74 / 0)}100%{box-shadow:0 0 0 0 rgb(22 163 74 / 0)}}
.r-infos-pratiques .ip-l{font-weight:var(--fxf);color:var(--accT)}
.r-infos-pratiques .ip-c>p{color:var(--tx2)}
`; }
};

/* ── appel ── */
const appelBande = {
  id: 'appel.bande', rubrique: 'appel', nom: 'Bande d\'appel', quand: 'toujours possible : une question du client, le numéro en grand, le bouton',
  surfaces: ['accent', 'champ'], js: [],
  besoin: function (spec, ctx) { const c = spec.contact || {}; return !!(c.tel || c.mobile || c.email); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, o = h.objectif(spec);
    const t = h.telHref(c.tel), w = h.waHref(c.mobile || c.tel, o.wa);
    const titre = ctx.textes.appel || ({ devis: 'Un projet ? Parlons-en.', appel: 'Besoin d\'aide ? Appelez-nous.', reservation: 'Envie de réserver ?', visite: 'On vous attend', inscription: 'Prêt à vous lancer ?' })[spec.objectif || 'devis'];
    const act = [];
    if (t) act.push('<a class="gros" href="' + h.esc(t) + '">' + h.icone('tel') + h.esc(MQ.affiche(c.tel)) + '</a>');
    if (w) act.push('<a class="btn b1" href="' + h.esc(w) + '" target="_blank" rel="noopener" data-aimant>' + h.contenuBouton('whatsapp', o.waBouton) + '</a>');
    else if (!t && c.email) act.push('<a class="btn b1" href="' + h.esc(h.mailHref(c.email, o.sujet + ' : ' + h.net(spec.nom), o.corps)) + '" data-aimant>' + h.contenuBouton('mail', h.net(spec.cta) || o.bouton) + '</a>');
    return '<section class="' + h.classes('appel.bande', bloc) + '" aria-label="Contact rapide">' + h.fond(bloc) + '<div class="w"><h2 class="t"' + h.rv('monte') + '>' + h.esc(titre) + '</h2><div class="actions"' + h.rv('monte', 1) + '>' + act.join('') + '</div></div></section>';
  },
  css: function () { return `
.r-appel-bande .w{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:22px 48px;padding-block:clamp(50px,6.5vw,86px)}
.r-appel-bande h2.t{max-width:20ch;font-size:clamp(1.8rem,3.4vw,2.9rem)}
.r-appel-bande .actions{gap:14px 30px}
.r-appel-bande .gros{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.7rem,3vw,2.6rem);line-height:1;text-decoration:none;display:inline-flex;align-items:center;gap:12px;white-space:nowrap}
.r-appel-bande .gros .ic{width:28px;height:28px}
.r-appel-bande .gros:hover{text-decoration:underline;text-decoration-thickness:.05em}
`; }
};

/* ── questions ── */
const faqAccordeon = {
  id: 'faq.accordeon', rubrique: 'faq', nom: 'Accordéon en deux colonnes', quand: 'deux questions ou plus : le titre à gauche, les réponses qui s\'ouvrent à droite',
  surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return ctx.h.faqDe(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, f = h.faqDe(spec).slice(0, 5);
    return '<section class="' + h.classes('faq.accordeon', bloc, 'sec') + '" id="faq">' + h.fond(bloc) + '<div class="w fq">' + h.teteSec('Questions fréquentes') + '<div>' + f.map(function (x, k) { return '<details' + h.rv('monte', k) + '><summary>' + h.esc(h.net(x.q)) + '</summary><div class="rep"><p>' + h.esc(h.net(x.r)) + '</p></div></details>'; }).join('') + '</div></div></section>';
  },
  css: function () { return `
.r-faq-accordeon .fq{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,80px);align-items:start}
.r-faq-accordeon details{border-bottom:1px solid var(--bord)}
.r-faq-accordeon summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:24px 0;font-weight:var(--fxf);font-size:1.1rem;line-height:1.4}
.r-faq-accordeon summary::-webkit-details-marker{display:none}
.r-faq-accordeon summary::after{content:"";flex:none;width:14px;height:14px;margin-top:5px;background:linear-gradient(var(--accT),var(--accT)) center/100% 2px no-repeat,linear-gradient(var(--accT),var(--accT)) center/2px 100% no-repeat;transition:transform .45s var(--ease)}
.r-faq-accordeon details[open] summary::after{transform:rotate(135deg)}
.r-faq-accordeon .rep{display:grid;grid-template-rows:1fr}
.r-faq-accordeon details p{padding:0 0 24px;color:var(--tx2);max-width:62ch}
.r-faq-accordeon details[open] .rep{animation:k-faq-ouvre .5s var(--ease)}
@keyframes k-faq-ouvre{from{opacity:0;transform:translateY(-6px)}}
@media(max-width:860px){.r-faq-accordeon .fq{grid-template-columns:1fr}}
`; }
};

/* ── contact ── */
const contactCartes = {
  id: 'contact.cartes', rubrique: 'contact', nom: 'Cartes de contact', quand: 'toujours possible : téléphone, WhatsApp, email, adresse, horaires, chacun dans sa carte',
  surfaces: ['surface', 'fond'], js: [],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, o = h.objectif(spec);
    const t = h.telHref(c.tel), w = h.waHref(c.mobile || c.tel, o.wa);
    const cartes = [];
    if (t) cartes.push('<div class="ct-c"><h3>' + h.icone('tel') + 'Téléphone</h3><a href="' + h.esc(t) + '">' + h.esc(MQ.affiche(c.tel)) + '</a></div>');
    if (w) cartes.push('<div class="ct-c"><h3>' + h.icone('whatsapp') + 'WhatsApp</h3><a href="' + h.esc(w) + '" target="_blank" rel="noopener">Nous écrire</a></div>');
    if (c.email) cartes.push('<div class="ct-c"><h3>' + h.icone('mail') + 'Email</h3><a href="mailto:' + h.esc(c.email) + '">' + h.esc(c.email) + '</a></div>');
    if (c.adresse || spec.commune) cartes.push('<div class="ct-c"><h3>' + h.icone('pin') + 'Adresse</h3><p>' + h.esc(c.adresse || (spec.commune + ', Martinique')) + '</p>' + (c.maps ? '<a href="' + h.esc(c.maps) + '" target="_blank" rel="noopener">Itinéraire</a>' : '') + '</div>');
    const z = h.zoneClient(spec);
    if (z && ['devis', 'appel'].indexOf(spec.objectif || 'devis') >= 0) cartes.push('<div class="ct-c"><h3>' + h.icone('carte') + 'Où nous intervenons</h3><p>' + h.esc(z) + '</p></div>');
    if (h.horairesDe(c).length && !(bloc && bloc.sansHoraires)) cartes.push('<div class="ct-c large"><h3>' + h.icone('horloge') + 'Horaires</h3>' + h.listeHoraires(h.horairesDe(c)) + '</div>');
    if (cartes.length % 2 === 1 && cartes.length > 1 && !/large/.test(cartes[cartes.length - 1])) cartes[cartes.length - 1] = cartes[cartes.length - 1].replace('class="ct-c"', 'class="ct-c large"');
    const balise = bloc && bloc.h1 ? 'h1' : 'h2';
    return '<section class="' + h.classes('contact.cartes', bloc, 'sec') + '" id="contact">' + h.fond(bloc) + '<div class="w ct"><div class="tx"' + h.rv('monte') + '><' + balise + ' class="t">' + h.esc(ctx.mod.textes.contact) + '</' + balise + '><p>' + h.esc(o.phrase) + '</p>' + h.boutons(spec) + '</div><div class="ct-cartes">' + cartes.map(function (x, k) { return x.replace('<div class="ct-c', '<div' + h.rv('monte', k + 1) + ' class="ct-c'); }).join('') + '</div></div></section>';
  },
  css: function () { return `
.r-contact-cartes .ct{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(32px,5vw,80px);align-items:start}
.r-contact-cartes .tx{display:grid;gap:20px;justify-items:start}
.r-contact-cartes .tx>p{color:var(--tx2);max-width:42ch;font-size:1.08rem}
.r-contact-cartes .ct-cartes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.r-contact-cartes .ct-c{background:var(--carte);border:1px solid var(--bord);border-radius:var(--r);padding:24px;display:grid;gap:8px;align-content:start;min-width:0;transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.r-contact-cartes .ct-c:hover{transform:translateY(-4px);box-shadow:var(--ombre)}
.r-contact-cartes .ct-c h3{display:flex;align-items:center;gap:10px;font-size:.98rem}
.r-contact-cartes .ct-c h3 .ic{color:var(--accT)}
.r-contact-cartes .ct-c a{font-weight:var(--fxf);text-decoration:none;overflow-wrap:anywhere}.r-contact-cartes .ct-c a:hover{text-decoration:underline}
.r-contact-cartes .ct-c p{color:var(--tx2)}
.r-contact-cartes .ct-c.large{grid-column:1/-1}
@media(max-width:860px){.r-contact-cartes .ct{grid-template-columns:1fr}}
@media(max-width:560px){.r-contact-cartes .ct-cartes{grid-template-columns:1fr}}
`; }
};

/* ── pied de page ── */
const piedColonnes = {
  id: 'pied.colonnes', rubrique: 'pied', nom: 'Trois colonnes', quand: 'toujours possible : nom et métier, contact, horaires, mentions légales',
  surfaces: ['champ'], js: [],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, nom = h.net(spec.nom), c = spec.contact || {};
    const hs = h.horairesDe(c);
    const hor = hs.length ? h.listeHoraires(hs).replace(/<li><span>([^<]*)<\/span><span>([^<]*)<\/span><\/li>/g, '<li>$1 : $2</li>') : '';
    const contact = [c.tel ? '<li><a href="' + h.esc(h.telHref(c.tel) || '#') + '">' + h.esc(MQ.affiche(c.tel)) + '</a></li>' : '', c.email ? '<li><a href="mailto:' + h.esc(c.email) + '">' + h.esc(c.email) + '</a></li>' : '', c.adresse ? '<li>' + h.esc(c.adresse) + '</li>' : (spec.commune ? '<li>' + h.esc(spec.commune) + ', Martinique</li>' : '')].join('');
    return '<footer class="' + h.classes('pied.colonnes', bloc) + '">' + h.fond(bloc) + '<div class="w"><div class="pd"><div><span class="nm">' + h.esc(nom) + '</span><p>' + h.esc(ctx.ligneMetier) + '</p></div><div><h3>Contact</h3><ul>' + contact + '</ul></div><div>' + (hor ? '<h3>Horaires</h3>' + hor : '') + '</div></div>' + ctx.basDePage + '</div></footer>';
  },
  css: function () { return `
.r-pied-colonnes{padding-block:clamp(52px,6vw,80px) 28px;font-size:.95rem}
.r-pied-colonnes .pd{display:grid;grid-template-columns:minmax(0,1.3fr) repeat(2,minmax(0,1fr));gap:28px clamp(24px,4vw,64px)}
.r-pied-colonnes .nm{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.6rem;line-height:1.1;display:block;margin-bottom:10px}
.r-pied-colonnes p,.r-pied-colonnes li{color:var(--tx2)}
.r-pied-colonnes h3{font-size:.95rem;margin-bottom:10px}
.r-pied-colonnes a{color:var(--tx);text-decoration:none}.r-pied-colonnes a:hover{text-decoration:underline}
@media(max-width:760px){.r-pied-colonnes .pd{grid-template-columns:1fr}}
`; }
};

module.exports = [navClassique, heroVoile, heroCote, heroAffiche, heroAplat, bandeauAtouts, servicesCartes, servicesListe, pourquoiGrille, aproposPhoto, etapesTrois, galerieMosaique, avisNote, infosPratiques, appelBande, faqAccordeon, contactCartes, piedColonnes];
