// Les pieds de page : sept fins de page, chacune avec son idée (le nom en lettres géantes qui montent, une carte
// d'appel qui chevauche, une ligne centrée, un ruban de contact qui défile, un plan complet en quatre colonnes, une
// houle animée sur un dégradé profond, une photo assombrie). Tous portent ctx.basDePage (mentions et signature) et
// gardent la place de la barre d'aperçu (ou de la barre d'action sur téléphone).
'use strict';
const MQ = require('../../martinique');

/* ── outils locaux ── */
function telDe(spec, h) { const c = spec.contact || {}, t = h.telHref(c.tel); return t ? { href: t, texte: MQ.affiche(c.tel) } : null; }
function waDe(spec, h) { const c = spec.contact || {}; return h.waHref(c.mobile || c.tel, h.objectif(spec).wa); }
function liens(ctx) { const h = ctx.h; return (ctx.ancres || []).map(function (a) { return '<a href="' + h.esc(a.href) + '">' + h.esc(a.nom) + '</a>'; }); }
// les moyens de contact, du plus direct au plus lent : [{ cle, icone, texte, href, ext, label }]
function contacts(spec, ctx) {
  const h = ctx.h, c = spec.contact || {}, t = telDe(spec, h), w = waDe(spec, h), out = [];
  if (t) out.push({ cle: 'tel', icone: 'tel', texte: t.texte, href: t.href, label: 'Appeler le ' + t.texte });
  if (w) out.push({ cle: 'wa', icone: 'whatsapp', texte: 'WhatsApp', href: w, ext: true, label: 'Écrire sur WhatsApp' });
  if (c.email) out.push({ cle: 'mail', icone: 'mail', texte: c.email, href: 'mailto:' + c.email, label: 'Écrire à ' + c.email });
  const ou = c.adresse || (spec.commune ? spec.commune + ', Martinique' : '');
  if (ou) out.push({ cle: 'lieu', icone: 'pin', texte: ou, href: c.maps || null, ext: !!c.maps, label: c.maps ? 'Voir l\'itinéraire' : null });
  return out;
}
function lien(x, h, cls, contenu) { return x.href ? '<a class="' + (cls || '') + '" href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + contenu + '</a>' : '<span class="' + (cls || '') + '">' + contenu + '</span>'; }
// « ouvert maintenant » (module ouvert), avec le résumé des horaires sans script
function etat(spec, h, cls) {
  const hs = h.horairesDe(spec.contact), mach = hs.length ? h.horairesMachine(hs) : null;
  if (!mach) return '';
  return '<p class="' + cls + '" data-horaires="' + h.esc(mach) + '"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(h.resumeHoraires(hs) || 'Horaires') + '</span></p>';
}
// une photo encore libre pour le fond : d'abord une illustration restante, sinon celle prévue pour un bandeau
// (jamais une photo de sa galerie, que la galerie montre déjà)
// (ni une photo dont le fichier a déjà paru sur la page : h.vue)
function photoLibre(ctx) {
  const a = ctx.alloc || {}, h = ctx.h || {}, pris = new Set([a.hero, a.apropos].concat(Object.keys(a.services || {}).map(function (k) { return a.services[k]; })).concat(ctx.prises || []).filter(Boolean));
  const libre = function (p) { return !!p && !pris.has(p) && !(typeof h.vue === 'function' && h.vue(p)); };
  const r = (a.reste || []).find(libre);
  if (r) return r;
  return libre(a.bandeau) ? a.bandeau : null;
}
const TITRES = { devis: 'Parlons de votre projet', appel: 'Une question ? Appelez-nous', reservation: 'Réservez en un message', visite: 'Une question, une commande ?', inscription: 'Prêt à vous inscrire ?' };

/* ── CSS commun à mes pieds (sous la classe de chacun) ── */
function cssBase(c) {
  return `
.${c}{font-size:1rem}
.a-apercu .${c}{padding-bottom:120px}
@media(max-width:860px){.a-barre .${c}{padding-bottom:104px}}
.${c} .marque img{mix-blend-mode:normal}
.${c}.s-champ .marque img,.${c}.s-accent .marque img,.${c}.s-photo .marque img{background:#fff;padding:6px 10px;border-radius:10px}
`;
}

/* ══ 1. Le nom en lettres géantes ══ */
const piedGeant = {
  id: 'pied.geant', rubrique: 'pied', nom: 'Nom en lettres géantes', quand: 'toujours possible, surtout pour un nom court et fort : le nom de l\'entreprise en lettres géantes qui montent une à une au bas de la page, au-dessus, le métier, les contacts et le bouton d\'action',
  surfaces: ['champ', 'fond', 'surface'], js: ['aimant'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, nom = h.net(spec.nom), ty = ctx.type;
    const ap = h.actionPrincipale(spec), cleAp = ap ? ({ whatsapp: 'wa', tel: 'tel', mail: 'mail' })[ap.type] : null;
    const cts = contacts(spec, ctx).filter(function (x) { return x.cle !== cleAp; }).map(function (x) { return '<li>' + h.icone(x.icone) + lien(x, h, '', h.esc(x.texte)) + '</li>'; }).join('');
    const l = liens(ctx);
    // une lettre par masque, les mots gardés ensemble ; taille calculée pour tenir sur une ligne (deux pour un nom long)
    let k = 0;
    const lettres = nom.split(' ').filter(Boolean).map(function (m) { return '<span class="mt">' + Array.from(m).map(function (x) { return '<span class="m"><span style="--i:' + (k++) + '">' + h.esc(x) + '</span></span>'; }).join('') + '</span>'; }).join(' ');
    const long = nom.length > 22;
    const hk = ((long ? h.deuxLignes(nom) : nom.length) + 0.6) * ty.chasse * 1.08;
    return '<footer class="' + h.classes('pied.geant', bloc) + '">' + h.fond(bloc) + '<div class="w"><div class="pg-haut"><div class="pg-dit"' + h.rv('monte') + '><p class="pg-ligne">' + h.esc(ctx.ligneMetier || nom) + '</p>' + (cts ? '<ul class="pg-cts">' + cts + '</ul>' : '') + '</div><div class="pg-act"' + h.rv('monte', 1) + '>' + h.boutons(spec, { seule: true }) + '</div></div>' + (l.length ? '<nav class="pg-nav" aria-label="Pied de page">' + l.join('') + '</nav>' : '') + '</div><div class="pg-g"><p class="pg-nom' + (long ? ' long' : '') + '" aria-hidden="true" data-r="mots" style="--hk:' + hk.toFixed(2) + '"><span class="pg-in">' + lettres + '</span></p></div><div class="w">' + ctx.basDePage + '</div></footer>';
  },
  script: function () {
    return `(function(){var g=d.querySelector('.r-pied-geant .pg-nom'),gi=g&&g.querySelector('.pg-in');
if(g&&gi&&!g.classList.contains('long')){var cale=function(){g.style.fontSize='';var l=gi.getBoundingClientRect().width,p=g.clientWidth;if(l>0&&p>0){var f=parseFloat(getComputedStyle(g).fontSize);g.style.fontSize=Math.min(f*p*.955/l,f*1.9).toFixed(1)+'px'}};var tc=0;w.addEventListener('resize',function(){clearTimeout(tc);tc=setTimeout(cale,150)});if(d.fonts&&d.fonts.ready)d.fonts.ready.then(cale);else cale()}
if(g&&!calme&&'IntersectionObserver' in w){var vis=false,tk=0;var maj=function(){tk=0;var r=g.getBoundingClientRect(),hh=w.innerHeight;var k=Math.max(0,Math.min(1,(hh-r.top)/(hh+r.height)));g.style.setProperty('--pgx',((.5-k)*3).toFixed(2)+'%')};
new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)maj()}).observe(g);
w.addEventListener('scroll',function(){if(vis&&!tk){tk=1;requestAnimationFrame(maj)}},{passive:true})}})();`;
  },
  css: function () {
    const c = 'r-pied-geant';
    return cssBase(c) + `
.${c}{padding-block:clamp(64px,8vw,112px) 30px;overflow:hidden}
.${c} .pg-haut{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px clamp(30px,5vw,80px);align-items:end}
.${c} .pg-ligne{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.55rem,2.7vw,2.4rem);line-height:1.08;max-width:24ch;text-wrap:balance}
.${c} .pg-cts{display:flex;flex-wrap:wrap;gap:10px 30px;margin-top:24px;color:var(--tx2)}
.${c} .pg-cts li{display:flex;align-items:center;gap:10px;min-width:0}
.${c} .pg-cts .ic{width:18px;height:18px;color:var(--accT)}
.${c} .pg-cts a{font-weight:var(--fxf);text-decoration:none;overflow-wrap:anywhere;color:var(--tx)}
.${c} .pg-cts a:hover{text-decoration:underline;text-underline-offset:.22em}
.${c} .pg-act .actions{justify-content:flex-end}
.${c} .pg-nav{display:flex;flex-wrap:wrap;gap:4px 30px;margin-top:clamp(30px,4vw,50px);padding-top:16px;border-top:1px solid var(--bord)}
.${c} .pg-nav a{display:inline-flex;align-items:center;min-height:44px;font-weight:var(--fxf);text-decoration:none;position:relative}
.${c} .pg-nav a::after{content:"";position:absolute;left:0;right:0;bottom:8px;height:2px;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform .45s var(--ease)}
.${c} .pg-nav a:hover::after{transform:scaleX(1)}
.${c} .pg-g{width:calc(100% - 2 * clamp(10px,1.8vw,26px));margin:clamp(34px,5vw,72px) auto 0;container-type:inline-size;overflow-x:clip}
.${c} .pg-nom{display:block;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:calc(100cqi / var(--hk));line-height:1.16;white-space:nowrap;text-align:center;margin-block:-.1em -.14em;transform:translate3d(var(--pgx,0),0,0);user-select:none}
.${c} .pg-in{display:inline-block;white-space:nowrap}
.${c} .pg-nom.long{white-space:normal;text-wrap:balance}
.${c} .pg-nom.long .pg-in{display:inline;white-space:normal}
.${c} .pg-nom .mt{display:inline-block;white-space:nowrap}
.${c} .pg-nom .m{padding:.06em .04em .1em;margin:-.06em -.04em -.1em}
.${c} .pg-nom .m>span{padding:.06em .04em .1em;margin:-.06em -.04em -.1em;background:linear-gradient(180deg,var(--tx) 0%,var(--tx) 45%,color-mix(in srgb,var(--tx) 22%,transparent) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.js .${c} .pg-nom .m>span{transition-duration:calc(var(--dur) * 1.25);transition-delay:calc(var(--i,0) * 45ms + 120ms)}
.${c} .bas{margin-top:clamp(18px,2.6vw,30px)}
@media(max-width:760px){.${c} .pg-haut{grid-template-columns:1fr}.${c} .pg-act .actions{justify-content:flex-start}}
`; }
};

/* ══ 2. La carte d'appel qui chevauche ══ */
const piedAppel = {
  id: 'pied.appel', rubrique: 'pied', nom: 'Carte d\'appel qui chevauche', quand: 'artisans, dépannage, services : une grande carte d\'appel aux couleurs vives posée à cheval sur le haut du pied, sans mordre sur la rubrique d\'avant (le numéro en grand, WhatsApp), puis le nom, les liens et les horaires',
  surfaces: ['champ'], js: ['aimant', 'defile', 'ouvert'], decoupe: false,
  besoin: function (spec, ctx) { const c = spec.contact || {}; return !!(ctx.h.telHref(c.tel) || waDe(spec, ctx.h)); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, t = telDe(spec, h), o = h.objectif(spec), nom = h.net(spec.nom);
    const titre = TITRES[spec.objectif] || TITRES.devis;
    const num = t ? '<a class="pa-num" href="' + h.esc(t.href) + '">' + h.esc(t.texte) + '</a>' : '';
    const hs = h.horairesDe(c);
    const cols = [];
    cols.push('<div class="pa-c"><p class="pa-nom">' + h.esc(nom) + '</p><p>' + h.esc(ctx.ligneMetier) + '</p></div>');
    const l = liens(ctx);
    if (l.length) cols.push('<nav class="pa-c pa-liens" aria-label="Pied de page">' + l.join('') + '</nav>');
    if (hs.length) cols.push('<div class="pa-c"><h3>Horaires</h3>' + etat(spec, h, 'pa-etat') + h.listeHoraires(hs) + '</div>');
    else if (c.email || c.adresse) cols.push('<div class="pa-c"><h3>Nous trouver</h3>' + (c.adresse ? '<p>' + h.esc(c.adresse) + '</p>' : '') + (c.email ? '<p><a href="mailto:' + h.esc(c.email) + '">' + h.esc(c.email) + '</a></p>' : '') + '</div>');
    return '<footer class="' + h.classes('pied.appel', bloc) + '">' + h.fond(bloc) + '<div class="w"><div class="pa-carte" data-defile' + h.rv('monte') + '><div class="pa-g"><span class="pa-ic" aria-hidden="true">' + h.icone(t ? 'tel' : 'whatsapp') + '</span><h2 class="t">' + h.esc(titre) + '</h2><p>' + h.esc(h.phraseContact(spec) || h.objectif(spec).phrase) + '</p></div><div class="pa-d">' + num + h.boutons(spec, { seule: !!t }) + '</div></div><div class="pa-bas">' + cols.join('') + '</div>' + ctx.basDePage + '</div></footer>';
  },
  css: function () {
    const c = 'r-pied-appel';
    return cssBase(c) + `
.${c}{--chev:clamp(72px,9vw,124px);background:linear-gradient(180deg,var(--fond) var(--chev),var(--bg) var(--chev));padding-bottom:30px}
.${c}>.fond{top:var(--chev)}
.${c} .pa-carte{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:26px clamp(30px,5vw,80px);align-items:center;padding:clamp(28px,4.4vw,62px);border-radius:calc(var(--r) * 2 + 6px);background:var(--vif);color:var(--surV);--tx:var(--surV);--tx2:color-mix(in srgb,var(--surV) 80%,var(--vif));--btn:var(--champ);--btnT:var(--surC);--accT:var(--surV);box-shadow:0 44px 90px -44px rgb(0 0 0 / .6),0 0 0 1px color-mix(in srgb,var(--surV) 10%,transparent)}
.${c} .pa-carte::before{content:"";position:absolute;z-index:-1;right:-12%;top:-60%;width:70%;aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--surV) 12%,transparent),transparent);pointer-events:none}
.${c} .pa-g{display:grid;gap:14px;justify-items:start}
.${c} .pa-g h2.t{font-size:clamp(1.9rem,3.6vw,3.1rem);max-width:16ch}
.${c} .pa-g p{color:var(--tx2);font-size:1.08rem;max-width:44ch}
.${c} .pa-ic{position:relative;width:62px;height:62px;display:grid;place-items:center;border-radius:50%;background:var(--champ);color:var(--surC)}
.${c} .pa-ic .ic{width:28px;height:28px;animation:k-pied-appel-sonne 4.2s var(--ease) 1.2s infinite}
.${c} .pa-ic::before,.${c} .pa-ic::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid var(--champ);opacity:0;animation:k-pied-appel-onde 2.8s ease-out infinite}
.${c} .pa-ic::after{animation-delay:1.4s}
.${c} .arret .pa-ic .ic,.${c} .arret .pa-ic::before,.${c} .arret .pa-ic::after{animation-play-state:paused}
@keyframes k-pied-appel-sonne{0%,22%,100%{transform:none}3%{transform:rotate(-16deg)}7%{transform:rotate(14deg)}11%{transform:rotate(-11deg)}15%{transform:rotate(8deg)}19%{transform:rotate(-4deg)}}
@keyframes k-pied-appel-onde{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.9);opacity:0}}
.${c} .pa-d{display:grid;gap:18px;justify-items:start}
.${c} .pa-num{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(2rem,4.4vw,3.6rem);line-height:1;text-decoration:none;white-space:nowrap;background:linear-gradient(currentColor,currentColor) 0 100%/0 .07em no-repeat;transition:background-size .5s var(--ease)}
.${c} .pa-num:hover{background-size:100% .07em}
.${c} .pa-d .b2{color:var(--surV)}
.${c} .pa-bas{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:28px clamp(24px,4vw,60px);margin-top:clamp(46px,6vw,76px);color:var(--tx2)}
.${c} .pa-c{display:grid;gap:8px;align-content:start}
.${c} .pa-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.6rem;line-height:1.1;color:var(--tx)}
.${c} .pa-c h3{font-size:.98rem;color:var(--tx)}
.${c} .pa-liens a{display:inline-flex;align-items:center;min-height:40px;font-weight:var(--fxf);text-decoration:none;color:var(--tx);justify-self:start}
.${c} .pa-liens a:hover{text-decoration:underline;text-underline-offset:.24em}
.${c} .pa-c a{color:var(--tx)}
.${c} .pa-etat{display:flex;align-items:center;gap:9px;font-weight:var(--fxf);color:var(--tx)}
.${c} .pa-etat i{width:9px;height:9px;border-radius:50%;background:currentColor;opacity:.5}
.${c} .pa-etat.est-ouvert i{background:#22c55e;opacity:1}
.${c} .pa-etat.est-ferme i{background:#ef4444;opacity:1}
.${c} .horaires li{padding:4px 0;font-size:.95rem}
@media(max-width:860px){.${c} .pa-carte{grid-template-columns:1fr}}
@media(max-width:480px){.${c} .pa-num{font-size:clamp(1.7rem,9vw,2.2rem)}}
@media(prefers-reduced-motion:reduce){.${c} .pa-ic .ic,.${c} .pa-ic::before,.${c} .pa-ic::after{animation:none}}
`; }
};

/* ══ 3. Une ligne centrée ══ */
const piedMinimal = {
  id: 'pied.minimal', rubrique: 'pied', nom: 'Ligne centrée', quand: 'soins, conseil, boutiques, sites épurés : le nom, le métier, un trait qui se dessine, les liens et les contacts en pastilles rondes, centrés',
  surfaces: ['fond', 'surface', 'champ'], ambiances: ['calme', 'premium'], js: [],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, nom = h.net(spec.nom);
    const ronds = contacts(spec, ctx).filter(function (x) { return x.href; }).map(function (x, k) { return '<li' + h.rv('zoom', k + 2) + '><a class="pm-rond" href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + ' aria-label="' + h.esc(x.label) + '">' + h.icone(x.icone) + '</a></li>'; }).join('');
    const l = liens(ctx);
    const sceau = ctx.logo ? ctx.marque : '<span class="pm-sceau" aria-hidden="true">' + h.icone(ctx.iconeMetier) + '</span><p class="pm-nom">' + h.esc(nom) + '</p>';
    return '<footer class="' + h.classes('pied.minimal', bloc) + '">' + h.fond(bloc) + '<div class="w pm"><div class="pm-tete"' + h.rv('monte') + '>' + sceau + '<p class="pm-ligne">' + h.esc(ctx.ligneMetier) + '</p></div><span class="pm-trait" aria-hidden="true"' + h.rv('monte', 1) + '></span>' + (l.length ? '<nav class="pm-nav" aria-label="Pied de page"' + h.rv('monte', 2) + '>' + l.join('') + '</nav>' : '') + (ronds ? '<ul class="pm-ronds">' + ronds + '</ul>' : '') + ctx.basDePage + '</div></footer>';
  },
  css: function () {
    const c = 'r-pied-minimal';
    return cssBase(c) + `
.${c}{padding-block:clamp(60px,7vw,100px) 28px;border-top:1px solid var(--bord)}
.${c} .pm{display:grid;justify-items:center;text-align:center;gap:22px}
.${c} .pm-tete{display:grid;justify-items:center;gap:12px}
.${c} .pm-sceau{width:58px;height:58px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--bord);color:var(--accT);transition:transform .8s var(--ease)}
.${c} .pm-sceau .ic{width:26px;height:26px}
.${c} .pm-tete:hover .pm-sceau{transform:rotate(-20deg)}
.${c} .pm-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.7rem,3vw,2.5rem);line-height:1.05}
.${c} .pm-ligne{color:var(--tx2);font-size:1.02rem}
.${c} .pm-trait{display:block;width:min(240px,50%);height:1px;background:linear-gradient(90deg,transparent,var(--acc),transparent)}
.js .${c} .pm-trait[data-r]{transform:scaleX(0);opacity:1;translate:none}
.js .${c} .pm-trait[data-r].vu{transform:none;transition:transform 1.4s var(--ease) .2s}
.${c} .pm-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 8px}
.${c} .pm-nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;text-decoration:none;font-weight:var(--fxf);transition:background-color .3s}
.${c} .pm-nav a:hover{background:color-mix(in srgb,currentColor 8%,transparent)}
.${c} .pm-ronds{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.${c} .pm-rond{width:52px;height:52px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--bord);color:var(--tx);transition:background-color .35s,color .35s,border-color .35s,transform .5s var(--ease)}
.${c} .pm-rond .ic{width:21px;height:21px}
.${c} .pm-rond:hover,.${c} .pm-rond:focus-visible{background:var(--btn);color:var(--btnT);border-color:var(--btn);transform:translateY(-4px)}
.${c} .bas{justify-content:center;gap:10px 30px;width:100%;margin-top:12px}
`; }
};

/* ══ 4. Le ruban de contact qui défile ══ */
const piedDefile = {
  id: 'pied.defile', rubrique: 'pied', nom: 'Ruban de contact qui défile', quand: 'artisans, tables, boutiques au ton vif : un ruban incliné qui fait défiler en grand le téléphone, WhatsApp, la commune et les horaires, puis un pied compact',
  surfaces: ['champ', 'accent', 'fond'], ambiances: ['franc', 'chaleureux'], js: ['defile', 'aimant'],
  besoin: function (spec, ctx) { return contacts(spec, ctx).filter(function (x) { return x.href; }).length >= 1; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, nom = h.net(spec.nom);
    const items = contacts(spec, ctx).filter(function (x) { return x.cle !== 'lieu'; }).map(function (x) { return { icone: x.icone, texte: x.cle === 'wa' ? 'Écrire sur WhatsApp' : x.texte, href: x.href, ext: x.ext }; });
    if (spec.commune) items.push({ icone: 'pin', texte: spec.commune, href: c.maps || null, ext: !!c.maps });
    const res = h.resumeHoraires(h.horairesDe(c));
    if (res) items.push({ icone: 'horloge', texte: res });
    const sep = '<span class="pd-sep" aria-hidden="true">' + h.icone(ctx.iconeMetier) + '</span>';
    const groupe = function (copie) { return '<div class="pd-g"' + (copie ? ' aria-hidden="true"' : '') + '>' + items.map(function (x) { const corps = h.icone(x.icone) + '<span>' + h.esc(x.texte) + '</span>'; return (x.href ? '<a class="pd-i" href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + (copie ? ' tabindex="-1"' : '') + '>' + corps + '</a>' : '<span class="pd-i">' + corps + '</span>') + sep; }).join('') + '</div>'; };
    const l = liens(ctx);
    return '<footer class="' + h.classes('pied.defile', bloc) + '">' + h.fond(bloc) + '<div class="pd-ruban" data-defile><div class="pd-piste">' + groupe(false) + groupe(true) + '</div><button class="pd-pause" type="button" data-pause aria-pressed="false" aria-label="Mettre le défilement en pause"><span></span></button></div><div class="w"><div class="pd-bas"><div class="pd-id"><p class="pd-nom">' + h.esc(nom) + '</p><p>' + h.esc(ctx.ligneMetier) + '</p></div>' + (l.length ? '<nav class="pd-nav" aria-label="Pied de page">' + l.join('') + '</nav>' : '') + '<div class="pd-act">' + h.boutons(spec, { seule: true }) + '</div></div>' + ctx.basDePage + '</div></footer>';
  },
  script: function () {
    return `(function(){[].slice.call(d.querySelectorAll('.r-pied-defile [data-pause]')).forEach(function(bt){var r=bt.closest('.r-pied-defile');bt.addEventListener('click',function(){var p=r.classList.toggle('pause');bt.setAttribute('aria-pressed',p?'true':'false');bt.setAttribute('aria-label',p?'Relancer le défilement':'Mettre le défilement en pause')})})})();`;
  },
  css: function () {
    const c = 'r-pied-defile';
    return cssBase(c) + `
.${c}{padding-bottom:30px;overflow:hidden}
.${c} .pd-ruban{position:relative;margin:clamp(34px,4vw,56px) -4vw 0;padding-block:clamp(16px,1.8vw,24px);background:var(--btn);color:var(--btnT);transform:rotate(-2.2deg);box-shadow:0 24px 50px -30px rgb(0 0 0 / .6)}
.${c} .pd-piste{display:flex;width:max-content;animation:k-pied-defile-pas 38s linear infinite}
.${c} .pd-ruban:hover .pd-piste,.${c} .pd-ruban:focus-within .pd-piste,.${c} .pd-ruban.arret .pd-piste,.${c}.pause .pd-piste{animation-play-state:paused}
@keyframes k-pied-defile-pas{to{transform:translate3d(-50%,0,0)}}
.${c} .pd-g{display:flex;align-items:center;flex:none}
.${c} .pd-i{display:inline-flex;align-items:center;gap:.4em;padding:0 .5em;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.9rem,4.6vw,4rem);line-height:1.1;white-space:nowrap;text-decoration:none;color:inherit}
.${c} a.pd-i:hover span{text-decoration:underline;text-decoration-thickness:.06em;text-underline-offset:.12em}
.${c} .pd-i .ic{width:.72em;height:.72em;stroke-width:2.2}
.${c} .pd-sep{display:inline-grid;place-items:center;padding:0 .35em;font-size:clamp(1.9rem,4.6vw,4rem)}
.${c} .pd-sep .ic{width:.5em;height:.5em;opacity:.55;animation:k-pied-defile-tourne 12s linear infinite}
.${c}.pause .pd-sep .ic,.${c} .pd-ruban.arret .pd-sep .ic{animation-play-state:paused}
@keyframes k-pied-defile-tourne{to{transform:rotate(360deg)}}
.${c} .pd-pause{position:absolute;right:calc(4vw + var(--g));top:50%;margin-top:-22px;width:44px;height:44px;border-radius:50%;border:0;background:var(--btnT);color:var(--btn);cursor:pointer;display:none;place-items:center;box-shadow:0 6px 20px -8px rgb(0 0 0 / .5)}
.js .${c} .pd-pause{display:grid}
.${c} .pd-pause span{width:12px;height:14px;border-left:4px solid currentColor;border-right:4px solid currentColor}
.${c}.pause .pd-pause span{width:0;height:0;border-style:solid;border-width:8px 0 8px 13px;border-color:transparent transparent transparent currentColor;margin-left:4px}
.${c} .pd-bas{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;gap:26px clamp(24px,4vw,60px);align-items:center;margin-top:clamp(48px,6vw,84px)}
.${c} .pd-id{display:grid;gap:6px}
.${c} .pd-id p:last-child{color:var(--tx2)}
.${c} .pd-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.7rem;line-height:1.05}
.${c} .pd-nav{display:flex;flex-wrap:wrap;gap:2px 24px}
.${c} .pd-nav a{display:inline-flex;align-items:center;min-height:44px;font-weight:var(--fxf);text-decoration:none}
.${c} .pd-nav a:hover{text-decoration:underline;text-underline-offset:.24em}
@media(max-width:860px){.${c} .pd-bas{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.${c} .pd-piste{animation:none;width:auto;flex-wrap:wrap;justify-content:center}.${c} .pd-g[aria-hidden]{display:none}.${c} .pd-g{flex-wrap:wrap;justify-content:center;row-gap:6px}.${c} .pd-sep .ic{animation:none}.${c} .pd-pause{display:none!important}.${c} .pd-i{font-size:clamp(1.5rem,3.4vw,2.6rem);white-space:normal}}
`; }
};

/* ══ 5. Le plan complet ══ */
const piedComplet = {
  id: 'pied.complet', rubrique: 'pied', nom: 'Plan complet en quatre colonnes', quand: 'quand la fiche est riche (horaires, adresse, plusieurs contacts) : le nom et la note Google, les liens de la page, les horaires avec l\'état ouvert ou fermé, les contacts ; retour en haut animé',
  surfaces: ['champ', 'surface', 'fond'], js: ['ouvert'],
  besoin: function (spec, ctx) { return contacts(spec, ctx).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, nom = h.net(spec.nom), g = h.noteGoogle(spec), hs = h.horairesDe(c);
    const cols = [];
    cols.push('<div class="pc-c pc-id"' + h.rv('monte', 0) + '>' + (ctx.logo ? ctx.marque : '<p class="pc-nom">' + h.esc(nom) + '</p>') + '<p>' + h.esc(ctx.ligneMetier) + '</p>' + (g ? '<p class="pc-note">' + h.etoiles(g.note) + '<span><b>' + h.noteTexte(g) + '</b> sur Google, ' + g.avis + ' avis</span></p>' : '') + '</div>');
    const l = liens(ctx);
    if (l.length) cols.push('<nav class="pc-c" aria-label="Pied de page"' + h.rv('monte', 1) + '><h3>Sur le site</h3><ul>' + l.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></nav>');
    if (hs.length) cols.push('<div class="pc-c"' + h.rv('monte', 2) + '><h3>Horaires</h3>' + etat(spec, h, 'pc-etat') + h.listeHoraires(hs) + '</div>');
    const cts = contacts(spec, ctx).map(function (x) { return '<li>' + h.icone(x.icone) + lien(x, h, '', h.esc(x.cle === 'lieu' && x.href ? x.texte : x.texte)) + '</li>'; }).join('');
    cols.push('<div class="pc-c"' + h.rv('monte', 3) + '><h3>Contact</h3><ul class="pc-cts">' + cts + '</ul></div>');
    return '<footer class="' + h.classes('pied.complet', bloc) + '">' + h.fond(bloc) + '<div class="w"><div class="pc-grille n' + cols.length + '">' + cols.join('') + '</div><div class="pc-fin">' + ctx.basDePage + '<a class="pc-haut" href="#" aria-label="Revenir en haut de la page">' + h.icone('fleche') + '</a></div></div></footer>';
  },
  css: function () {
    const c = 'r-pied-complet';
    return cssBase(c) + `
.${c}{padding-block:clamp(60px,7vw,100px) 30px}
.${c} .pc-grille{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.72fr) minmax(0,1.22fr) minmax(0,1.16fr);gap:34px 0}
.${c} .pc-grille.n3{grid-template-columns:minmax(0,1.3fr) minmax(0,.8fr) minmax(0,1.2fr)}
.${c} .pc-grille.n2{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}
.${c} .pc-c{display:grid;gap:12px;align-content:start;padding:0 clamp(18px,2.6vw,40px);border-left:1px solid var(--bord);min-width:0;color:var(--tx2)}
.${c} .pc-c:first-child{padding-left:0;border-left:0}
.${c} .pc-c h3{font-size:.98rem;color:var(--tx);margin-bottom:4px}
.${c} .pc-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.7rem,2.6vw,2.3rem);line-height:1.04;color:var(--tx)}
.${c} .pc-note{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}
.${c} .pc-note b{color:var(--tx)}
.${c} .pc-c ul{display:grid;gap:4px}
.${c} .pc-c nav ul a,.${c} nav.pc-c a{display:inline-flex;align-items:center;min-height:40px;text-decoration:none;color:var(--tx);font-weight:var(--fxf);transition:transform .4s var(--ease),color .3s}
.${c} nav.pc-c a:hover{transform:translateX(6px);color:var(--accT)}
.${c} .pc-cts li{display:flex;align-items:flex-start;gap:10px;padding:5px 0}
.${c} .pc-cts .ic{width:18px;height:18px;margin-top:3px;color:var(--accT);flex:none}
.${c} .pc-cts a{color:var(--tx);text-decoration:none;font-weight:var(--fxf);overflow-wrap:anywhere}
.${c} .pc-cts a:hover{text-decoration:underline;text-underline-offset:.22em}
.${c} .pc-etat{display:flex;align-items:center;gap:9px;font-weight:var(--fxf);color:var(--tx)}
.${c} .pc-etat i{width:9px;height:9px;flex:none;border-radius:50%;background:currentColor;opacity:.5}
.${c} .pc-etat.est-ouvert i{background:#22c55e;opacity:1;animation:k-pied-complet-pouls 2.2s infinite}
.${c} .pc-etat.est-ferme i{background:#ef4444;opacity:1}
@keyframes k-pied-complet-pouls{0%{box-shadow:0 0 0 0 rgb(34 197 94 / .6)}80%,100%{box-shadow:0 0 0 8px rgb(34 197 94 / 0)}}
.${c} .horaires li{padding:4px 0;font-size:.95rem;gap:12px}
.${c} .horaires span:last-child{white-space:nowrap}
.${c} .pc-fin{display:flex;align-items:flex-end;gap:20px;margin-top:clamp(40px,5vw,64px)}
.${c} .pc-fin .bas{flex:1;margin-top:0}
.${c} .pc-haut{flex:none;width:52px;height:52px;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.${c} .pc-haut .ic{transform:rotate(-90deg);transition:transform .5s var(--ease)}
.${c} .pc-haut:hover{transform:translateY(-5px);box-shadow:0 14px 30px -12px color-mix(in srgb,var(--btn) 70%,transparent)}
.${c} .pc-haut:hover .ic{transform:rotate(-90deg) translateX(3px)}
@media(max-width:980px){.${c} .pc-grille,.${c} .pc-grille.n3{grid-template-columns:repeat(2,minmax(0,1fr))}.${c} .pc-c:nth-child(odd){padding-left:0;border-left:0}}
@media(max-width:600px){.${c} .pc-grille,.${c} .pc-grille.n3,.${c} .pc-grille.n2{grid-template-columns:1fr}.${c} .pc-c{padding:22px 0 0;border-left:0;border-top:1px solid var(--bord)}.${c} .pc-c:first-child{padding-top:0;border-top:0}}
@media(prefers-reduced-motion:reduce){.${c} .pc-etat.est-ouvert i{animation:none}}
`; }
};

/* ══ 6. La houle ══ */
const piedVague = {
  id: 'pied.vague', rubrique: 'pied', nom: 'Houle animée et dégradé profond', quand: 'mer, piscines, jardins, hébergement : le pied s\'ouvre sur trois vagues qui roulent lentement, sur un dégradé profond, avec les contacts et les horaires',
  familles: ['horizon', 'verdure', 'comptoir', 'ecrin'], surfaces: ['champ', 'accent'], ambiances: ['calme', 'chaleureux', 'premium'], js: ['defile', 'ouvert'], decoupe: false, fonds: false,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, nom = h.net(spec.nom);
    const v = 'M0 40C240 76 480 76 720 40S1200 4 1440 40 1920 76 2160 40 2640 4 2880 40V120H0z';
    const crete = 'M0 40C240 76 480 76 720 40S1200 4 1440 40 1920 76 2160 40 2640 4 2880 40';
    const houle = '<div class="pv-houle" data-defile aria-hidden="true">' + [1, 2, 3].map(function (k) { return '<svg class="pv-v pv-v' + k + '" viewBox="0 0 2880 120" preserveAspectRatio="none"><path d="' + v + '"/>' + (k === 3 ? '<path class="pv-crete" d="' + crete + '"/>' : '') + '</svg>'; }).join('') + '</div>';
    const ap = h.actionPrincipale(spec), cleAp = ap ? ({ whatsapp: 'wa', tel: 'tel', mail: 'mail' })[ap.type] : null;
    const cts = contacts(spec, ctx).filter(function (x) { return x.cle !== cleAp; }).map(function (x, k) { return '<li' + h.rv('monte', k + 1) + '>' + lien(x, h, 'pv-ct', '<span class="pv-ic">' + h.icone(x.icone) + '</span><span>' + h.esc(x.texte) + '</span>') + '</li>'; }).join('');
    const l = liens(ctx), hs = h.horairesDe(c);
    return '<footer class="' + h.classes('pied.vague', bloc) + '">' + houle + h.fond(bloc) + '<div class="w"><div class="pv-haut"><div class="pv-id"' + h.rv('monte') + '><p class="pv-nom">' + h.esc(nom) + '</p><p class="pv-ligne">' + h.esc(ctx.ligneMetier) + '</p>' + h.boutons(spec, { seule: true }) + '</div>' + (cts ? '<ul class="pv-cts">' + cts + '</ul>' : '') + '</div>' + ((l.length || hs.length) ? '<div class="pv-bas">' + (l.length ? '<nav class="pv-nav" aria-label="Pied de page">' + l.join('') + '</nav>' : '<span></span>') + (hs.length ? etat(spec, h, 'pv-etat') : '') + '</div>' : '') + ctx.basDePage + '</div></footer>';
  },
  css: function () {
    const c = 'r-pied-vague';
    return cssBase(c) + `
.${c}{--hv:clamp(54px,7vw,104px);padding-block:calc(var(--hv) + clamp(30px,4vw,56px)) 30px;background:linear-gradient(180deg,var(--fond) var(--hv),var(--bg) var(--hv),color-mix(in srgb,var(--bg) 72%,#000) 100%)}
.${c}>.fond{top:var(--hv)}
.${c}::after{content:"";position:absolute;inset:var(--hv) 0 0;z-index:-1;pointer-events:none;-webkit-mask-image:linear-gradient(180deg,transparent,#000 160px);mask-image:linear-gradient(180deg,transparent,#000 160px);background:radial-gradient(70% 55% at 85% 30%,color-mix(in srgb,var(--acc) 20%,transparent),transparent 70%),radial-gradient(60% 50% at 10% 90%,color-mix(in srgb,var(--btn) 14%,transparent),transparent 70%)}
.${c} .pv-houle{position:absolute;left:0;right:0;top:0;height:var(--hv);overflow:hidden;pointer-events:none}
.${c} .pv-v{position:absolute;left:0;bottom:-1px;width:200%;max-width:none;height:100%;fill:var(--bg);animation:k-pied-vague-roule 18s linear infinite}
.${c} .pv-v1{opacity:.32;height:100%;animation-duration:26s;animation-direction:reverse}
.${c} .pv-v2{opacity:.55;height:82%;animation-duration:19s}
.${c} .pv-v3{opacity:1;height:62%;animation-duration:13s}
.${c} .pv-houle.arret .pv-v{animation-play-state:paused}
.${c} .pv-crete{fill:none;stroke:color-mix(in srgb,var(--acc) 55%,transparent);stroke-width:1.5;vector-effect:non-scaling-stroke}
@keyframes k-pied-vague-roule{to{transform:translate3d(-50%,0,0)}}
.${c} .pv-haut{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:36px clamp(30px,6vw,100px);align-items:start}
.${c} .pv-id{display:grid;gap:16px;justify-items:start}
.${c} .pv-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(2.1rem,4.6vw,3.9rem);line-height:1}
.${c} .pv-ligne{color:var(--tx2);font-size:1.08rem;margin-bottom:8px}
.${c} .pv-cts{display:grid;gap:6px}
.${c} .pv-ct{display:flex;align-items:center;gap:14px;min-height:52px;padding:6px 0;text-decoration:none;color:var(--tx);overflow-wrap:anywhere}
.${c} .pv-ic{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--tx) 10%,transparent);transition:background-color .35s,color .35s,transform .5s var(--ease)}
.${c} .pv-ic .ic{width:20px;height:20px}
.${c} a.pv-ct span:last-child{font-weight:var(--fxf)}
.${c} a.pv-ct:hover .pv-ic{background:var(--btn);color:var(--btnT);transform:rotate(-12deg)}
.${c} span.pv-ct{color:var(--tx2)}
.${c} .pv-bas{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 30px;margin-top:clamp(40px,5vw,64px);padding-top:14px;border-top:1px solid var(--bord)}
.${c} .pv-nav{display:flex;flex-wrap:wrap;gap:2px 26px}
.${c} .pv-nav a{display:inline-flex;align-items:center;min-height:44px;font-weight:var(--fxf);text-decoration:none}
.${c} .pv-nav a:hover{text-decoration:underline;text-underline-offset:.24em}
.${c} .pv-etat{display:flex;align-items:center;gap:9px;font-weight:var(--fxf)}
.${c} .pv-etat i{width:9px;height:9px;border-radius:50%;background:currentColor;opacity:.5}
.${c} .pv-etat.est-ouvert i{background:#22c55e;opacity:1}
.${c} .pv-etat.est-ferme i{background:#ef4444;opacity:1}
@media(max-width:860px){.${c} .pv-haut{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.${c} .pv-v{animation:none}}
`; }
};

/* ══ 7. Sur une photo assombrie ══ */
const piedPhoto = {
  id: 'pied.photo', rubrique: 'pied', nom: 'Sur une photo assombrie', quand: 'quand une photo reste libre (bandeau, illustration non utilisée) : le pied posé sur la photo assombrie qui glisse au défilement, une phrase d\'invitation, les boutons, puis les contacts sur un panneau de verre',
  surfaces: ['photo'], ambiances: ['premium', 'chaleureux', 'calme'], js: ['parallaxe', 'aimant', 'ouvert'], fonds: false, decoupe: false,
  besoin: function (spec, ctx) { return !!photoLibre(ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, p = photoLibre(ctx), c = spec.contact || {}, nom = h.net(spec.nom);
    if (p) ctx.prises = (ctx.prises || []).concat([p]);
    const titre = TITRES[spec.objectif] || TITRES.devis;
    const ap = h.actionPrincipale(spec), sec = ap ? h.actionSeconde(spec, ap) : null, dans = {};
    [ap, sec].forEach(function (a) { if (a) dans[({ whatsapp: 'wa', tel: 'tel', mail: 'mail' })[a.type]] = 1; });
    const cts = contacts(spec, ctx).filter(function (x) { return !dans[x.cle]; }).map(function (x) { return '<li>' + h.icone(x.icone) + lien(x, h, '', h.esc(x.texte)) + '</li>'; }).join('');
    const hs = h.horairesDe(c), l = liens(ctx);
    return '<footer class="' + h.classes('pied.photo', bloc, p ? '' : 'sans-photo') + '">' + (p ? '<div class="pp-img" data-px="0.1">' + h.figure(p, 'lazy', '100vw') + '</div>' : '<div class="pp-nuit" aria-hidden="true"></div>') + '<div class="w"><div class="pp-tete"><h2 class="t"' + h.rv('monte') + '>' + h.esc(titre) + '</h2><p' + h.rv('monte', 1) + '>' + h.esc(h.phraseContact(spec) || h.objectif(spec).phrase) + '</p><div' + h.rv('monte', 2) + '>' + h.boutons(spec) + '</div></div><div class="pp-verre"' + h.rv('monte', 3) + '><div class="pp-c"><p class="pp-nom">' + h.esc(nom) + '</p><p>' + h.esc(ctx.ligneMetier) + '</p>' + (l.length ? '<nav class="pp-nav" aria-label="Pied de page">' + l.join('') + '</nav>' : '') + '</div>' + (cts ? '<div class="pp-c"><h3>Nous trouver</h3><ul class="pp-cts">' + cts + '</ul></div>' : '') + (hs.length ? '<div class="pp-c"><h3>Horaires</h3>' + etat(spec, h, 'pp-etat') + h.listeHoraires(hs) + '</div>' : '') + '</div>' + ctx.basDePage + '</div></footer>';
  },
  css: function () {
    const c = 'r-pied-photo';
    return cssBase(c) + `
.${c}{overflow:hidden;padding-block:clamp(110px,13vw,190px) 30px}
.${c} .pp-img{position:absolute;inset:-12% 0;z-index:-2}
.${c} .pp-nuit{position:absolute;inset:0;z-index:-2;background:radial-gradient(70% 60% at 80% 0%,color-mix(in srgb,var(--accent) 34%,transparent),transparent 70%),radial-gradient(60% 50% at 0% 100%,color-mix(in srgb,var(--vif) 18%,transparent),transparent 70%),linear-gradient(180deg,rgb(var(--voile)),color-mix(in srgb,rgb(var(--voile)) 70%,#000))}
.${c}.sans-photo::before{opacity:.55}
.${c} .pp-img .ph{height:100%;border-radius:0}
.${c}::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / .5) 0%,rgb(var(--voile) / .7) 42%,rgb(var(--voile) / .95) 100%),radial-gradient(80% 55% at 50% 22%,rgb(var(--voile) / 0),rgb(var(--voile) / .45))}
.${c} .pp-tete{display:grid;justify-items:center;text-align:center;gap:18px;max-width:760px;margin-inline:auto}
.${c} .pp-tete h2.t{font-size:clamp(2.2rem,5vw,4.4rem);line-height:1}
.${c} .pp-tete>p{font-size:1.1rem;color:var(--tx2);max-width:46ch}
.${c} .pp-tete .actions{justify-content:center}
.${c} .pp-tete .b2{color:#fff;border-color:rgb(255 255 255 / .7)}
.${c} .pp-verre{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:26px clamp(24px,4vw,56px);margin-top:clamp(70px,9vw,130px);padding:clamp(24px,3vw,40px);border-radius:calc(var(--r) * 1.5 + 4px);background:rgb(255 255 255 / .08);border:1px solid rgb(255 255 255 / .16);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2)}
.${c} .pp-c{display:grid;gap:10px;align-content:start;color:var(--tx2)}
.${c} .pp-c h3{font-size:.98rem;color:#fff}
.${c} .pp-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.7rem;line-height:1.05;color:#fff}
.${c} .pp-nav{display:flex;flex-wrap:wrap;gap:0 20px;margin-top:4px}
.${c} .pp-nav a{display:inline-flex;align-items:center;min-height:44px;color:#fff;font-weight:var(--fxf);text-decoration:none}
.${c} .pp-nav a:hover,.${c} .pp-cts a:hover{text-decoration:underline;text-underline-offset:.24em}
.${c} .pp-cts{display:grid;gap:8px}
.${c} .pp-cts li{display:flex;align-items:flex-start;gap:10px}
.${c} .pp-cts .ic{width:18px;height:18px;margin-top:3px;flex:none;color:#fff}
.${c} .pp-cts a{color:#fff;font-weight:var(--fxf);text-decoration:none;overflow-wrap:anywhere}
.${c} .pp-etat{display:flex;align-items:center;gap:9px;font-weight:var(--fxf);color:#fff}
.${c} .pp-etat i{width:9px;height:9px;border-radius:50%;background:currentColor;opacity:.6}
.${c} .pp-etat.est-ouvert i{background:#22c55e;opacity:1}
.${c} .pp-etat.est-ferme i{background:#ef4444;opacity:1}
.${c} .horaires li{padding:4px 0;font-size:.95rem;border-bottom-color:rgb(255 255 255 / .18)}
.${c} .horaires span:last-child{color:rgb(255 255 255 / .82)}
.${c} .bas{border-top-color:rgb(255 255 255 / .18)}
`; }
};

module.exports = [piedGeant, piedAppel, piedMinimal, piedDefile, piedComplet, piedVague, piedPhoto];
