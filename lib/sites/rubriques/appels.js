// Les bandes d'appel : la question du client (ctx.textes.appel), et ce qu'il faut pour appeler ou écrire tout de suite.
// Huit mises en scène : le numéro géant, la photo en parallaxe, la carte à la bordure qui tourne, la ligne qui défile
// derrière le bouton, les ondes autour du bouton, le texte en cercle, le petit formulaire qui prépare le message, la
// bande en biais. Rien n'est inventé : seulement le téléphone, WhatsApp, l'email et les horaires de la fiche.
'use strict';
const MQ = require('../../martinique');
// les heures ne se coupent jamais (« 18 h », « 7 h 30 ») : côté serveur, et après le module « ouvert » dans le navigateur
function heures(s) { return String(s == null ? '' : s).replace(/(\d) h\b/g, '$1\u00a0h').replace(/\bh (\d{2})\b/g, 'h\u00a0$1').replace(/([h\d]) – (?=\d)/g, '$1\u00a0–\u00a0').replace(/\b((?:lun|mar|mer|jeu|ven|sam|dim)\.?) – (?=(?:lun|mar|mer|jeu|ven|sam|dim))/gi, '$1\u00a0–\u00a0'); }
function insecHeures(cls) { return "[].slice.call(d.querySelectorAll('." + cls + " [data-ouvert-texte]')).forEach(function(t){t.textContent=t.textContent.replace(/(\\d) h/g,'$1\\u00a0h').replace(/à (\\d)/g,'à\\u00a0$1').replace(/h (\\d\\d)/g,'h\\u00a0$1')})"; }
// la ponctuation française : une espace insécable avant ? ! : ; (le point d'interrogation ne tombe jamais seul à la ligne)
function fr(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0'); }
// les mots qui montent un à un (comme h.mots), sans perdre l'espace insécable
function motsFr(texte) { return fr(texte).split(' ').filter(Boolean).map(function (m, k) { return '<span class="m"><span style="--i:' + k + '">' + String(m).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }) + '</span></span>'; }).join(' '); }
/* ── ce que la fiche permet ── */
function moyens(spec, ctx) {
  const h = ctx.h, c = spec.contact || {}, o = h.objectif(spec);
  const num = c.tel || c.mobile || '';
  const tel = num ? h.telHref(num) : null;
  return { c: c, o: o, num: num, tel: tel, telTexte: tel ? MQ.affiche(num) : '', wa: h.waHref(c.mobile || c.tel, o.wa), mail: c.email ? h.mailHref(c.email, o.sujet + ' : ' + h.net(spec.nom), o.corps) : null, email: c.email || '' };
}
const QUESTIONS = { devis: 'Un projet ? Parlons-en.', appel: 'Besoin d\'aide ? Appelez-nous.', reservation: 'Envie de réserver ?', visite: 'On vous attend', inscription: 'Prêt à vous lancer ?' };
function question(spec, ctx) { return ctx.textes.appel || QUESTIONS[spec.objectif] || QUESTIONS.devis; }
const SEUL_TEL = { devis: 'Pour un devis, un simple appel suffit.', appel: 'Un souci, une question : appelez, on vous répond.', reservation: 'Pour réserver, appelez-nous.', visite: 'Une question, une commande : appelez-nous.', inscription: 'Pour vous inscrire ou poser une question, appelez-nous.' };
function phrase(spec, m) { return m.wa || m.mail ? m.o.phrase : (SEUL_TEL[spec.objectif] || SEUL_TEL.devis); }
function joignable(spec) { const c = spec.contact || {}; return !!(c.tel || c.mobile || c.email); }
// « Ouvert maintenant » à côté du numéro, si les horaires se lisent
function etat(h, spec, cls) {
  const hs = h.horairesDe(spec.contact), m = h.horairesMachine(hs);
  return m ? '<p class="' + cls + '" data-horaires="' + h.esc(m) + '"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(heures(h.resumeHoraires(hs) || 'Nos horaires')) + '</span></p>' : '';
}
// la clé d'une photo : son fichier (deux fiches peuvent porter le même)
function cleP(p) { return (p && (p.fichier || p.url)) || p; }
// les fichiers réservés à une autre rubrique (héros, présentation, services, bandeau ; sauf la photo « garder »)
function reserves(ctx, garder) {
  const a = ctx.alloc || {}, s = new Set();
  [a.hero, a.apropos, a.bandeau].concat(Object.keys(a.services || {}).map(function (k) { return a.services[k]; })).forEach(function (p) { if (p && p !== garder) s.add(cleP(p)); });
  return s;
}
// une galerie (seulement les photos de l'entreprise) est-elle prévue ? Elle prendra alors les siennes.
function galeriePrevue(ctx) {
  if (!ctx.alloc || ctx.alloc.galerie.length < 2) return false;
  if (ctx.compo && Array.isArray(ctx.compo.blocs)) return ctx.compo.blocs.some(function (b) { return b.rubrique === 'galerie'; });
  try { const r = require('../composition').RECETTES[ctx.da && ctx.da.modele]; return !r || r.indexOf('galerie') >= 0; } catch (e) { return true; }
}
// pendant le choix de la composition, sans rien prendre : les photos qui resteront libres (un fichier une fois, aucun
// fichier réservé, aucune photo déjà montrée plus haut sur la page)
function photosLibres(ctx) {
  const a = ctx.alloc, h = ctx.h, res = reserves(ctx), vus = new Set();
  return (galeriePrevue(ctx) ? [] : a.galerie).concat(a.reste).filter(function (p) { const k = cleP(p); if (res.has(k) || vus.has(k) || (h && h.vue && h.vue(p))) return false; vus.add(k); return true; });
}
// le bandeau peut servir s'il existe et que son fichier n'est pas déjà celui d'une autre photo réservée
function bandeauPossible(ctx) { const b = ctx.alloc && ctx.alloc.bandeau; return b && !reserves(ctx, b).has(cleP(b)) ? b : null; }
// au rendu : la photo du bandeau si elle n'a pas paru plus haut sur la page, sinon une photo encore libre (prise et notée :
// personne ne la remontre) ; aucune s'il n'en reste pas (la rubrique cède alors la place à la bande du socle, sans cadre vide)
function photoBande(ctx) {
  const h = ctx.h, b = ctx.alloc.bandeau;
  if (b && !(h.vue && h.vue(b))) return b;
  return (h.photos && h.photos(1, { decor: true })[0]) || null;
}
// les apparitions communes finissent sur clip-path:inset(0) : levé ici, pour ne rogner ni ombres, ni anneaux, ni débords
function libre(cls) { return '.js .' + cls + ' [data-r].vu:not([data-r=rideau]):not([data-r=store]):not([data-r=iris]){clip-path:none}\n.' + cls + ' p{text-wrap:pretty}'; }
const CSS_ETAT = function (cls) { return `
.${cls} .ae{display:inline-flex;align-items:center;gap:10px;font-weight:var(--fxf);font-size:1rem;line-height:1.3}
.${cls} .ae i{width:10px;height:10px;flex:none;border-radius:50%;background:currentColor;opacity:.5;outline:2px solid color-mix(in srgb,currentColor 70%,transparent);outline-offset:2px}
.${cls} .ae.est-ouvert i{background:#16a34a;opacity:1;box-shadow:0 0 0 0 rgb(22 163 74 / .55);animation:k-${cls.slice(2)}-pouls 2s infinite}
.${cls} .ae.est-ferme i{background:#dc2626;opacity:1}
@keyframes k-${cls.slice(2)}-pouls{70%{box-shadow:0 0 0 10px rgb(22 163 74 / 0)}100%{box-shadow:0 0 0 0 rgb(22 163 74 / 0)}}
`; };

/* ── 1. le numéro en très grand ── */
const geant = {
  id: 'appel.geant', rubrique: 'appel', nom: 'Le numéro en géant', quand: 'un numéro à appeler (artisans, dépannage, garages) : la question, le numéro en très grand qui se remplit, WhatsApp en bouton aimanté',
  surfaces: ['accent', 'champ', 'fond', 'surface'], js: ['ouvert', 'aimant'], script: insecHeures('r-appel-geant'),
  besoin: function (spec, ctx) { return !!moyens(spec, ctx).tel; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx);
    if (!m.tel) return '';
    const n = m.telTexte.split(' ').map(function (g, k) { return '<span class="ag-g" style="--k:' + k + '">' + h.esc(g) + '</span>'; }).join(' ');
    const hk = ((m.telTexte.length + 0.6) * ctx.type.chasse * 1.24).toFixed(2);
    const act = m.wa ? '<a class="btn b1" href="' + h.esc(m.wa) + '" target="_blank" rel="noopener" data-aimant>' + h.contenuBouton('whatsapp', m.o.waBouton) + '</a>'
      : (m.mail ? '<a class="btn b2" href="' + h.esc(m.mail) + '" data-aimant>' + h.contenuBouton('mail', 'Écrire un email') + '</a>' : '');
    return '<section class="' + h.classes('appel.geant', bloc) + '" aria-label="Appeler">' + h.fond(bloc) + '<div class="w ag">' +
      '<h2 class="t ag-q"' + h.rv('monte') + '>' + h.esc(fr(question(spec, ctx))) + '</h2>' +
      '<a class="ag-num" href="' + h.esc(m.tel) + '" aria-label="Appeler le ' + h.esc(m.telTexte) + '"' + h.rv('monte', 1) + '><span class="ag-n" style="--hk:' + hk + '" aria-hidden="true"><span class="ag-c">' + n + '</span><span class="ag-p">' + n + '</span></span><span class="ag-trait" aria-hidden="true"></span></a>' +
      '<div class="ag-bas"' + h.rv('monte', 3) + '>' + etat(h, spec, 'ae') + act + '</div></div></section>';
  },
  css: function () { return `
${libre('r-appel-geant')}
.r-appel-geant{overflow:hidden}
.r-appel-geant .ag{container-type:inline-size;padding-block:clamp(64px,8vw,120px);display:grid;gap:clamp(14px,2vw,24px)}
.r-appel-geant .ag-q{font-size:clamp(1.6rem,3vw,2.6rem);max-width:24ch}
.r-appel-geant .ag-num{display:flex;flex-direction:column;justify-content:center;min-height:44px;width:max-content;max-width:100%;text-decoration:none;color:var(--tx);position:relative;padding-bottom:.08em;outline-offset:8px}
.r-appel-geant .ag-n{display:grid;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);letter-spacing:-.03em;line-height:.92;white-space:nowrap;font-size:min(13rem,calc(100cqi / var(--hk)))}
.r-appel-geant .ag-c,.r-appel-geant .ag-p{grid-area:1/1}
.r-appel-geant .ag-c{color:transparent;-webkit-text-stroke:max(1.5px,.012em) color-mix(in srgb,var(--tx) 60%,transparent)}
.r-appel-geant .ag-p{color:var(--tx)}
.js .r-appel-geant .ag-p{clip-path:inset(0 100% 0 0)}
.r-appel-geant .vu .ag-p{clip-path:inset(0 0 0 0);transition:clip-path 1.5s var(--ease2) .45s}
.r-appel-geant .ag-g{display:inline-block;transition:transform .5s var(--ease);transition-delay:calc(var(--k) * 45ms)}
.r-appel-geant .ag-trait{display:block;height:max(3px,.035em);margin-top:.12em;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform .7s var(--ease);font-size:min(13rem,calc(100cqi / var(--hk)))}
.r-appel-geant .ag-num:hover .ag-g,.r-appel-geant .ag-num:focus-visible .ag-g{transform:translateY(-.06em)}
.r-appel-geant .ag-num:hover .ag-trait,.r-appel-geant .ag-num:focus-visible .ag-trait{transform:none}
.r-appel-geant .ag-bas{display:flex;flex-wrap:wrap;align-items:center;gap:16px 32px;margin-top:clamp(6px,1.4vw,18px)}
.r-appel-geant .ae{color:var(--tx2)}
${CSS_ETAT('r-appel-geant')}
@media(max-width:480px){.r-appel-geant .ag-bas .btn{flex:1 1 100%}}
@media(prefers-reduced-motion:reduce){.r-appel-geant .ae.est-ouvert i{animation:none}}
`; }
};

/* ── 2. sur une large photo en parallaxe ── */
const photo = {
  id: 'appel.photo', rubrique: 'appel', nom: 'Sur une photo en parallaxe', quand: 'une photo libre (bandeau ou illustration) : la question en grand sur la photo qui glisse, dans un cadre fin, les deux boutons',
  surfaces: ['photo'], js: ['parallaxe'], fonds: false,
  besoin: function (spec, ctx) { return joignable(spec) && !!(bandeauPossible(ctx) || photosLibres(ctx).length); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), p = photoBande(ctx);
    if (!p) return '';
    return '<section class="' + h.classes('appel.photo', bloc) + '" aria-label="Contact rapide"><div class="ap-img" data-px="0.16">' + h.figure(p, 'lazy', '100vw') + '</div>' +
      '<div class="w ap"><h2 class="t ap-q" data-r="mots">' + motsFr(question(spec, ctx)) + '</h2><p class="ap-p"' + h.rv('monte', 3) + '>' + h.esc(fr(phrase(spec, m))) + '</p><div class="ap-b"' + h.rv('monte', 4) + '>' + h.boutons(spec) + '</div></div></section>';
  },
  css: function () { return `
${libre('r-appel-photo')}
.r-appel-photo{overflow:hidden;min-height:clamp(480px,74vh,720px);display:grid;align-items:center;text-align:center;color:#fff}
.r-appel-photo .ap-img{position:absolute;inset:-14% 0;z-index:-2}
.r-appel-photo .ap-img .ph{height:100%;border-radius:0}
.r-appel-photo::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(70% 70% at 50% 50%,rgb(var(--voile) / .78),rgb(var(--voile) / .5) 70%,rgb(var(--voile) / .72)),linear-gradient(180deg,rgb(var(--voile) / .35),transparent 40%,rgb(var(--voile) / .45))}
.r-appel-photo::after{content:"";position:absolute;inset:clamp(12px,2vw,26px);border:1px solid rgb(255 255 255 / .38);border-radius:calc(var(--rp) * .6);pointer-events:none}
.r-appel-photo .ap{display:grid;justify-items:center;gap:clamp(18px,2.4vw,28px);padding-block:clamp(90px,11vw,150px)}
.r-appel-photo .ap-q{font-size:clamp(2.2rem,5.6vw,4.8rem);line-height:1;max-width:16ch;text-shadow:0 2px 30px rgb(var(--voile) / .4)}
.r-appel-photo .ap-p{font-size:clamp(1.05rem,1.4vw,1.25rem);color:rgb(255 255 255 / .9);max-width:46ch}
.r-appel-photo .actions{justify-content:center}
.r-appel-photo .b2{color:#fff;border-color:rgb(255 255 255 / .7)}
`; }
};

/* ── 3. la carte dont la bordure en dégradé tourne lentement ── */
const bordure = {
  id: 'appel.bordure', rubrique: 'appel', nom: 'Carte à la bordure qui tourne', quand: 'toujours possible : une carte centrée dont le liseré en dégradé tourne doucement, la question à gauche, les actions à droite',
  surfaces: ['fond', 'surface', 'champ'], js: ['aimant'],
  besoin: function (spec) { return joignable(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx);
    const num = m.tel ? '<a class="ab-tel" href="' + h.esc(m.tel) + '">' + h.icone('tel') + '<span>' + h.esc(m.telTexte) + '</span></a>' : '';
    return '<section class="' + h.classes('appel.bordure', bloc, 'sec') + '" aria-label="Contact rapide">' + h.fond(bloc) + '<div class="w"><div class="ab" data-defile' + h.rv('zoom') + '><div class="ab-carte"><div class="ab-in">' +
      '<div class="ab-tx"><h2 class="t">' + h.esc(fr(question(spec, ctx))) + '</h2><p>' + h.esc(fr(phrase(spec, m))) + '</p></div>' +
      '<div class="ab-act">' + h.boutons(spec, { seule: true }) + num + '</div></div></div></div></div></section>';
  },
  css: function () { return `
${libre('r-appel-bordure')}
.r-appel-bordure .ab{position:relative;max-width:1040px;margin-inline:auto}
.r-appel-bordure .ab-carte{position:relative;border-radius:calc(var(--r) * 1.6 + 11px);overflow:hidden;isolation:isolate;padding:3px;box-shadow:var(--ombreF),0 40px 90px -50px color-mix(in srgb,var(--acc) 70%,transparent)}
.r-appel-bordure .ab-carte::before{content:"";position:absolute;left:50%;top:50%;width:250vmax;height:250vmax;margin:-125vmax 0 0 -125vmax;z-index:-1;background:conic-gradient(from 0deg,transparent 0deg 70deg,color-mix(in srgb,var(--acc) 45%,transparent) 130deg,var(--acc) 172deg,transparent 180deg 250deg,color-mix(in srgb,var(--acc) 45%,transparent) 310deg,var(--acc) 352deg,transparent 360deg);animation:k-appel-bordure-tour 10s linear infinite}
.r-appel-bordure .ab-carte::after{content:"";position:absolute;inset:0;z-index:-2;background:var(--bord)}
.r-appel-bordure .ab.arret .ab-carte::before{animation-play-state:paused}
.r-appel-bordure .ab-in{position:relative;border-radius:calc(var(--r) * 1.6 + 8px);background:var(--carte);padding:clamp(30px,4.4vw,64px);display:grid;grid-template-columns:minmax(0,1.3fr) auto;gap:clamp(24px,4vw,64px);align-items:center}
.r-appel-bordure .ab-tx{display:grid;gap:14px}
.r-appel-bordure h2.t{font-size:clamp(1.8rem,3.4vw,3rem)}
.r-appel-bordure .ab-tx p{color:var(--tx2);font-size:1.08rem;max-width:44ch}
.r-appel-bordure .ab-act{display:grid;gap:16px;justify-items:start}
.r-appel-bordure .ab-tel{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.3rem,2vw,1.7rem);letter-spacing:-.01em;text-decoration:none;white-space:nowrap}
.r-appel-bordure .ab-tel .ic{width:22px;height:22px;color:var(--accT)}
.r-appel-bordure .ab-tel span{background:linear-gradient(currentColor,currentColor) left bottom/0 2px no-repeat;transition:background-size .5s var(--ease)}
.r-appel-bordure .ab-tel:hover span{background-size:100% 2px}
@keyframes k-appel-bordure-tour{to{transform:rotate(1turn)}}
@media(max-width:820px){.r-appel-bordure .ab-in{grid-template-columns:1fr}.r-appel-bordure .ab-act{justify-items:stretch}.r-appel-bordure .ab-tel{justify-content:center}}
@media(prefers-reduced-motion:reduce){.r-appel-bordure .ab-carte::before{animation:none;transform:rotate(-30deg)}}
`; }
};

/* ── 4. la ligne qui défile derrière le bouton ── */
const defile = {
  id: 'appel.defile', rubrique: 'appel', nom: 'Ligne qui défile derrière le bouton', quand: 'toujours possible : « Appeler, WhatsApp » en très grandes lettres qui défilent derrière un gros bouton rond aimanté',
  surfaces: ['champ', 'accent', 'fond'], js: ['aimant'],
  besoin: function (spec) { return joignable(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), a = h.actionPrincipale(spec);
    if (!a) return '';
    let mots = [m.tel ? 'Appeler' : null, m.wa ? 'WhatsApp' : null, (!m.wa && m.mail) ? 'Écrire' : null].filter(Boolean);
    if (mots.length < 2) mots = mots.concat(m.tel ? [m.telTexte] : ['Nous écrire']);
    const sep = '<i class="ad-s">' + h.icone('etoile') + '</i>';
    const serie = function () { let x = ''; for (let k = 0; k < 3; k++) mots.forEach(function (t, j) { x += '<span class="ad-m' + ((k + j) % 2 ? ' ad-o' : '') + '">' + h.esc(t) + '</span>' + sep; }); return '<div class="ad-moitie">' + x + '</div>'; };
    const rond = h.lienA(a, 'ad-rond', h.icone(a.icone) + '<span>' + h.esc(a.type === 'whatsapp' ? 'Écrire sur WhatsApp' : a.type === 'tel' ? 'Appeler' : 'Écrire') + '</span>').replace('<a ', '<a data-aimant ');
    const deux = h.actionSeconde(spec, a);
    return '<section class="' + h.classes('appel.defile', bloc) + '" aria-label="Contact rapide" data-defile>' + h.fond(bloc) +
      '<div class="w ad-t"><h2 class="t"' + h.rv('monte') + '>' + h.esc(fr(question(spec, ctx))) + '</h2></div>' +
      '<div class="ad-scene"' + h.rv('monte', 1) + '><div class="ad-ruban" aria-hidden="true"><div class="ad-piste">' + serie() + serie() + '</div></div>' + rond + '</div>' +
      (deux ? '<div class="w ad-bas"' + h.rv('monte', 2) + '><a href="' + h.esc(deux.href) + '">' + h.icone(deux.icone) + '<span>' + h.esc(deux.type === 'tel' ? 'Ou appelez le ' + deux.texte : 'Ou écrivez-nous un email') + '</span></a></div>' : '') + '</section>';
  },
  css: function () { return `
${libre('r-appel-defile')}
.r-appel-defile{overflow:hidden;padding-block:clamp(64px,8vw,120px)}
.r-appel-defile .ad-t{text-align:center}
.r-appel-defile .ad-t h2.t{font-size:clamp(1.7rem,3.2vw,2.8rem);max-width:22ch;margin-inline:auto}
.r-appel-defile .ad-scene{position:relative;display:grid;place-items:center;margin-block:clamp(26px,4vw,56px)}
.r-appel-defile .ad-ruban{grid-area:1/1;width:100%;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.r-appel-defile .ad-piste{display:flex;width:max-content;animation:k-appel-defile-va 38s linear infinite}
.r-appel-defile.arret .ad-piste,.r-appel-defile .ad-scene:hover .ad-piste{animation-play-state:paused}
.r-appel-defile .ad-moitie{display:flex;align-items:center;flex:none}
.r-appel-defile .ad-m{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(3.6rem,11vw,10.5rem);line-height:1.08;white-space:nowrap;padding-inline:.18em;color:color-mix(in srgb,var(--tx) 16%,transparent)}
.r-appel-defile .ad-o{color:transparent;-webkit-text-stroke:max(1px,.012em) color-mix(in srgb,var(--tx) 34%,transparent)}
.r-appel-defile .ad-s{display:inline-grid;color:var(--acc);opacity:.7}
.r-appel-defile .ad-s .ic{width:clamp(22px,3vw,40px);height:clamp(22px,3vw,40px);fill:currentColor;stroke:none}
.r-appel-defile .ad-rond{grid-area:1/1;position:relative;z-index:2;width:clamp(150px,15vw,200px);aspect-ratio:1;border-radius:50%;display:grid;place-content:center;justify-items:center;gap:10px;padding:18px;text-align:center;background:var(--btn);color:var(--btnT);text-decoration:none;font-weight:var(--fxf);font-size:1.02rem;line-height:1.2;box-shadow:0 24px 60px -22px color-mix(in srgb,var(--btn) 80%,#000),0 0 0 10px color-mix(in srgb,var(--btn) 16%,transparent);transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.r-appel-defile .ad-rond .ic{width:34px;height:34px;transition:transform .6s var(--ease)}
.r-appel-defile .ad-rond:hover{box-shadow:0 30px 70px -22px color-mix(in srgb,var(--btn) 85%,#000),0 0 0 18px color-mix(in srgb,var(--btn) 12%,transparent)}
.r-appel-defile .ad-rond:hover .ic{transform:rotate(-12deg) scale(1.12)}
.r-appel-defile .ad-bas{display:flex;justify-content:center}
.r-appel-defile .ad-bas a{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--tx);text-decoration:none}
.r-appel-defile .ad-bas a span{background:linear-gradient(currentColor,currentColor) left bottom/100% 1px no-repeat;transition:background-size .5s var(--ease)}
.r-appel-defile .ad-bas a:hover span{background-size:0 1px;background-position:right bottom}
.r-appel-defile .ad-bas .ic{color:var(--accT)}
@keyframes k-appel-defile-va{to{transform:translate3d(-50%,0,0)}}
@media(prefers-reduced-motion:reduce){.r-appel-defile .ad-piste{animation:none;transform:translate3d(-12%,0,0)}}
`; }
};

/* ── 5. les ondes autour du bouton ── */
const onde = {
  id: 'appel.onde', rubrique: 'appel', nom: 'Ondes autour du bouton', quand: 'WhatsApp (ou l\'appel) au centre : un gros bouton rond entouré d\'ondes qui pulsent, la question et le numéro à côté',
  surfaces: ['fond', 'surface', 'champ', 'accent'], js: [],
  besoin: function (spec) { return joignable(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), a = h.actionPrincipale(spec);
    if (!a) return '';
    const deux = h.actionSeconde(spec, a);
    const libelle = a.type === 'whatsapp' ? 'Écrire sur WhatsApp' : a.type === 'tel' ? 'Appeler le ' + m.telTexte : 'Écrire un email';
    return '<section class="' + h.classes('appel.onde', bloc, 'sec') + '" aria-label="Contact rapide">' + h.fond(bloc) + '<div class="w ao">' +
      '<div class="ao-tx"><h2 class="t"' + h.rv('monte') + '>' + h.esc(fr(question(spec, ctx))) + '</h2><p' + h.rv('monte', 1) + '>' + h.esc(fr(phrase(spec, m))) + '</p>' +
      (deux ? '<a class="ao-2"' + h.rv('monte', 2) + ' href="' + h.esc(deux.href) + '">' + h.icone(deux.icone) + '<span>' + h.esc(deux.type === 'tel' ? deux.texte : 'Écrire un email') + '</span></a>' : '') + '</div>' +
      '<div class="ao-c" data-defile' + h.rv('zoom', 1) + '><span class="ao-o"></span><span class="ao-o"></span><span class="ao-o"></span>' + h.lienA(a, 'ao-b', h.icone(a.icone) + '<span>' + h.esc(a.court) + '</span>', libelle) + '</div></div></section>';
  },
  css: function () { return `
${libre('r-appel-onde')}
.r-appel-onde{overflow:hidden}
.r-appel-onde .ao{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(36px,6vw,100px);align-items:center}
.r-appel-onde .ao-tx{display:grid;gap:18px;justify-items:start}
.r-appel-onde h2.t{font-size:clamp(2rem,4.4vw,3.8rem);max-width:15ch}
.r-appel-onde .ao-tx p{color:var(--tx2);font-size:1.1rem;max-width:42ch}
.r-appel-onde .ao-2{display:inline-flex;align-items:center;gap:12px;min-height:48px;margin-top:6px;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.25rem,2vw,1.6rem);text-decoration:none;white-space:nowrap}
.r-appel-onde .ao-2 .ic{width:24px;height:24px;color:var(--accT)}
.r-appel-onde .ao-2:hover span{text-decoration:underline;text-decoration-thickness:2px}
.r-appel-onde .ao-c{position:relative;display:grid;place-items:center;aspect-ratio:1;width:min(100%,420px);justify-self:center}
.r-appel-onde .ao-c::before{content:"";position:absolute;inset:6%;border-radius:50%;border:1px dashed color-mix(in srgb,var(--tx) 20%,transparent)}
.r-appel-onde .ao-c::after{content:"";position:absolute;inset:22%;border-radius:50%;border:1px solid color-mix(in srgb,var(--tx) 12%,transparent)}
.r-appel-onde .ao-o{position:absolute;left:50%;top:50%;width:40%;aspect-ratio:1;margin:-20% 0 0 -20%;border-radius:50%;background:color-mix(in srgb,var(--btn) 30%,transparent);border:2px solid color-mix(in srgb,var(--btn) 60%,transparent);opacity:0;animation:k-appel-onde-va 3.6s cubic-bezier(.2,.6,.3,1) infinite}
.r-appel-onde .ao-o:nth-child(2){animation-delay:1.2s}.r-appel-onde .ao-o:nth-child(3){animation-delay:2.4s}
.r-appel-onde .ao-c.arret .ao-o{animation-play-state:paused}
.r-appel-onde .ao-b{position:relative;z-index:2;width:40%;aspect-ratio:1;border-radius:50%;display:grid;place-content:center;justify-items:center;gap:8px;background:var(--btn);color:var(--btnT);text-decoration:none;font-weight:var(--fxf);font-size:1.05rem;box-shadow:0 26px 60px -24px color-mix(in srgb,var(--btn) 85%,#000);transition:transform .5s var(--ease)}
.r-appel-onde .ao-b .ic{width:clamp(34px,3.4vw,44px);height:clamp(34px,3.4vw,44px)}
.r-appel-onde .ao-b:hover{transform:scale(1.06)}
.r-appel-onde .ao-b:active{transform:scale(.97)}
@keyframes k-appel-onde-va{0%{transform:scale(1);opacity:.75}100%{transform:scale(2.45);opacity:0}}
@media(max-width:820px){.r-appel-onde .ao{grid-template-columns:1fr}.r-appel-onde .ao-c{width:min(100%,340px)}.r-appel-onde .ao-b{width:44%}.r-appel-onde .ao-o{width:44%;margin:-22% 0 0 -22%}}
@media(prefers-reduced-motion:reduce){.r-appel-onde .ao-o{animation:none;opacity:.35;transform:scale(1.5)}.r-appel-onde .ao-o+.ao-o{display:none}}
`; }
};

/* ── 6. le texte en cercle qui tourne autour du bouton ── */
const cercle = {
  id: 'appel.cercle', rubrique: 'appel', nom: 'Texte en cercle autour du bouton', quand: 'toujours possible : un bouton rond, entouré d\'une phrase circulaire qui tourne lentement, la question à gauche',
  surfaces: ['surface', 'fond', 'champ', 'accent'], js: [],
  besoin: function (spec) { return joignable(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), a = h.actionPrincipale(spec);
    if (!a) return '';
    const bouts = [m.wa ? 'Écrivez-nous sur WhatsApp' : null, m.tel ? 'Appelez le ' + m.telTexte : null, (!m.wa && m.mail) ? 'Écrivez-nous un email' : null].filter(Boolean);
    let txt = bouts.join(' · ') + ' · ';
    while (txt.length < 38) txt += txt;
    const fs = Math.min(19, 488 / (txt.length * Math.max(0.5, ctx.type.chasse * 1.42))).toFixed(1);
    const deux = h.actionSeconde(spec, a);
    const libelle = a.type === 'whatsapp' ? 'Écrire sur WhatsApp' : a.type === 'tel' ? 'Appeler le ' + m.telTexte : 'Écrire un email';
    const anneau = '<svg class="ac-anneau" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><defs><path id="ac-chemin" d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1-160 0"/></defs><text style="font-size:' + fs + 'px"><textPath href="#ac-chemin" textLength="494" lengthAdjust="spacing">' + h.esc(txt) + '</textPath></text></svg>';
    return '<section class="' + h.classes('appel.cercle', bloc, 'sec') + '" aria-label="Contact rapide">' + h.fond(bloc) + '<div class="w ac">' +
      '<div class="ac-tx"><h2 class="t"' + h.rv('monte') + '>' + h.esc(fr(question(spec, ctx))) + '</h2><p' + h.rv('monte', 1) + '>' + h.esc(fr(phrase(spec, m))) + '</p>' +
      (deux ? '<div' + h.rv('monte', 2) + '><a class="btn b2" href="' + h.esc(deux.href) + '">' + h.contenuBouton(deux.icone, deux.type === 'tel' ? deux.texte : 'Écrire un email') + '</a></div>' : '') + '</div>' +
      '<div class="ac-c" data-defile' + h.rv('zoom', 1) + '>' + h.lienA(a, 'ac-rond', anneau + '<span class="ac-coeur">' + h.icone(a.icone) + '</span>', libelle) + '</div></div></section>';
  },
  css: function () { return `
${libre('r-appel-cercle')}
.r-appel-cercle .ac{display:grid;grid-template-columns:minmax(0,620px) auto;justify-content:space-around;gap:clamp(36px,7vw,130px);align-items:center}
.r-appel-cercle .ac-tx{display:grid;gap:18px;justify-items:start}
.r-appel-cercle h2.t{font-size:clamp(2rem,4.4vw,3.8rem);max-width:15ch}
.r-appel-cercle .ac-tx p{color:var(--tx2);font-size:1.1rem;max-width:42ch}
.r-appel-cercle .ac-c{justify-self:center}
.r-appel-cercle .ac-rond{position:relative;overflow:hidden;display:grid;place-items:center;width:clamp(220px,24vw,300px);aspect-ratio:1;border-radius:50%;color:var(--tx);text-decoration:none;outline-offset:6px}
.r-appel-cercle .ac-anneau{position:absolute;inset:0;width:100%;height:100%;overflow:visible;animation:k-appel-cercle-tour 24s linear infinite;transition:transform .8s var(--ease)}
.r-appel-cercle .ac-anneau text{fill:currentColor;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);text-transform:uppercase;letter-spacing:.06em}
.r-appel-cercle .ac-c.arret .ac-anneau{animation-play-state:paused}
.r-appel-cercle .ac-coeur{position:relative;width:52%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:var(--btn);color:var(--btnT);box-shadow:0 24px 50px -20px color-mix(in srgb,var(--btn) 85%,#000);transition:transform .6s var(--ease)}
.r-appel-cercle .ac-coeur::before{content:"";position:absolute;inset:-12px;border-radius:50%;border:1px solid color-mix(in srgb,var(--tx) 22%,transparent);transition:inset .6s var(--ease),border-color .4s}
.r-appel-cercle .ac-coeur .ic{width:38%;height:38%;transition:transform .6s var(--ease)}
.r-appel-cercle .ac-rond:hover .ac-coeur{transform:scale(1.08)}
.r-appel-cercle .ac-rond:hover .ac-coeur::before{inset:-20px;border-color:var(--acc)}
.r-appel-cercle .ac-rond:hover .ac-coeur .ic{transform:rotate(-14deg)}
@keyframes k-appel-cercle-tour{to{transform:rotate(1turn)}}
@media(max-width:820px){.r-appel-cercle .ac{grid-template-columns:1fr;justify-items:center;text-align:center}.r-appel-cercle .ac-tx{justify-items:center}}
@media(prefers-reduced-motion:reduce){.r-appel-cercle .ac-anneau{animation:none}}
`; }
};

/* ── 7. le petit formulaire qui prépare le message ── */
const COMMUNES = MQ.COMMUNES.map(function (c) { return c[0]; });
const CHAMP_BESOIN = {
  devis: { label: 'Votre besoin', q: 'Mon besoin', intro: 'Je voudrais un devis.' },
  appel: { label: 'Votre question', q: 'Ma question', intro: 'Pouvez-vous me rappeler ?', ph: 'En quelques mots' },
  reservation: { label: 'Votre demande', q: 'Ma demande', intro: 'Je voudrais réserver.', ph: 'Le jour et l\'heure qui vous vont' },
  visite: { label: 'Votre demande', q: 'Ma demande', intro: '' },
  inscription: { label: 'Votre demande', q: 'Ma demande', intro: 'Je voudrais des informations pour une inscription.' }
};
const formulaire = {
  id: 'appel.formulaire', rubrique: 'appel', nom: 'Petit formulaire qui prépare le message', quand: 'un portable (WhatsApp) ou un email : trois champs sur une ligne (besoin, commune, prénom) qui préparent le message ; rien n\'est envoyé par le site',
  surfaces: ['surface', 'fond', 'champ'], js: ['formulaire'],
  besoin: function (spec, ctx) { const m = moyens(spec, ctx); return !!(m.wa || m.email); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx);
    // le contact porte déjà le formulaire : la bande d'appel simple prend la place
    if (!(m.wa || m.email) || (ctx.compo && (ctx.compo.blocs || []).some(function (b) { return b.id === 'contact.formulaire'; }))) return '';
    const cb = CHAMP_BESOIN[spec.objectif] || CHAMP_BESOIN.devis;
    const sv = h.servicesDe(spec).map(function (s) { return h.net(s.titre); }).filter(function (t) { return t.length <= 32; }).slice(0, 4);
    const ph = cb.ph || (sv.length >= 2 ? sv.slice(0, 2).join(', ') + '…' : 'En quelques mots');
    const numWa = m.wa ? (m.wa.match(/wa\.me\/(\d+)/) || [])[1] : null;
    const intro = 'Bonjour, je viens de votre site.' + (cb.intro ? ' ' + cb.intro : '');
    const cible = numWa ? ' data-wa="' + h.esc(numWa) + '" action="https://wa.me/' + h.esc(numWa) + '" method="get" target="_blank"' : ' data-mail="' + h.esc(m.email) + '" data-sujet="' + h.esc(m.o.sujet + ' : ' + h.net(spec.nom)) + '" action="mailto:' + h.esc(m.email) + '" method="post" enctype="text/plain"';
    const champ = function (id, label, q, extra) { return '<div class="af-ch"><label for="' + id + '">' + h.esc(label) + '</label><input id="' + id + '" name="' + id.slice(3) + '" data-q="' + h.esc(q) + '"' + extra + '></div>'; };
    const puces = sv.length >= 2 ? '<div class="af-puces"' + h.rv('monte', 2) + '><span>Par exemple\u00a0:</span>' + sv.map(function (t) { return '<button type="button" data-puce="' + h.esc(t) + '">' + h.esc(t) + '</button>'; }).join('') + '</div>' : '';
    return '<section class="' + h.classes('appel.formulaire', bloc, 'sec') + '" aria-labelledby="af-titre">' + h.fond(bloc) + '<div class="w af">' +
      '<div class="af-tete"' + h.rv('monte') + '><h2 class="t" id="af-titre">' + h.esc(fr(question(spec, ctx))) + '</h2><p>' + (numWa ? 'Trois réponses, et votre message est prêt dans WhatsApp.' : 'Trois réponses, et votre email est prêt à partir.') + '</p></div>' +
      '<form class="af-f" data-formulaire data-intro="' + h.esc(intro) + '"' + cible + h.rv('monte', 1) + '>' +
      champ('af-besoin', cb.label, cb.q, ' required autocomplete="off" placeholder="' + h.esc(ph) + '"') +
      champ('af-commune', 'Votre commune', 'Ma commune', ' list="af-communes" autocomplete="address-level2" placeholder="Où êtes-vous ?"') +
      champ('af-prenom', 'Votre prénom', 'Mon prénom', ' autocomplete="given-name" placeholder="Pour vous répondre"') +
      '<button class="btn b1" type="submit">' + h.contenuBouton(numWa ? 'whatsapp' : 'mail', numWa ? 'Préparer le message' : 'Préparer l\'email') + '</button></form>' +
      puces + '<p class="af-note"' + h.rv('monte', 3) + '>' + h.icone('cadenas') + '<span>' + (numWa ? 'Rien n\'est envoyé par ce site\u00a0: le message s\'ouvre dans WhatsApp, vous le relisez et vous l\'envoyez.' : 'Rien n\'est envoyé par ce site\u00a0: l\'email s\'ouvre dans votre messagerie, vous le relisez et vous l\'envoyez.') + '</span></p>' +
      '<datalist id="af-communes">' + COMMUNES.map(function (c) { return '<option value="' + h.esc(c) + '"></option>'; }).join('') + '</datalist></div></section>';
  },
  // les exemples de besoin remplissent le premier champ
  script: "[].slice.call(d.querySelectorAll('.r-appel-formulaire')).forEach(function(s){var cs=s.querySelectorAll('[data-q]');[].slice.call(s.querySelectorAll('[data-puce]')).forEach(function(b){b.addEventListener('click',function(){if(!cs[0])return;cs[0].value=b.getAttribute('data-puce');if(cs[1])cs[1].focus()})})})",
  css: function () { return `
${libre('r-appel-formulaire')}
.r-appel-formulaire .af{display:grid;gap:clamp(20px,2.6vw,30px)}
.r-appel-formulaire .af-tete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px 40px}
.r-appel-formulaire h2.t{font-size:clamp(1.9rem,3.8vw,3.2rem);max-width:20ch}
.r-appel-formulaire .af-tete p{color:var(--tx2);font-size:1.08rem;max-width:36ch}
.r-appel-formulaire .af-f{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) auto;align-items:stretch;background:var(--carte);border:1px solid var(--bord);border-radius:calc(var(--rb) + 10px);padding:8px;box-shadow:var(--ombre);transition:box-shadow .5s var(--ease),border-color .4s}
.r-appel-formulaire .af-f:focus-within{border-color:var(--acc);box-shadow:var(--ombreF)}
.r-appel-formulaire .af-ch{position:relative;display:grid;align-content:center;gap:0;padding:4px 20px;border-radius:calc(var(--rb) + 4px);min-width:0;transition:background-color .3s}
.r-appel-formulaire .af-ch+.af-ch::before{content:"";position:absolute;left:0;top:22%;bottom:22%;width:1px;background:var(--bord)}
.r-appel-formulaire .af-ch:focus-within{background:color-mix(in srgb,var(--acc) 8%,transparent)}
.r-appel-formulaire .af-ch label{font-size:.95rem;font-weight:var(--fxf);color:var(--tx);cursor:text}
.r-appel-formulaire .af-ch input{width:100%;min-width:0;min-height:44px;box-sizing:border-box;border:0;padding:10px 0;background:transparent;color:var(--tx);font:inherit;font-size:1.02rem;line-height:1.4;outline:0}
.r-appel-formulaire .af-ch input::placeholder{color:var(--tx2);opacity:.85}
.r-appel-formulaire .af-ch:focus-within label{color:var(--accT)}
.r-appel-formulaire .af-f .btn{min-height:64px;margin-left:6px}
.r-appel-formulaire .af-puces{display:none;flex-wrap:wrap;align-items:center;gap:8px 10px;color:var(--tx2);font-size:.98rem}
.js .r-appel-formulaire .af-puces{display:flex}
.r-appel-formulaire .af-puces button{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--bord);background:transparent;color:var(--tx);font:inherit;font-size:.98rem;cursor:pointer;transition:background-color .3s,border-color .3s,color .3s,transform .4s var(--ease)}
.r-appel-formulaire .af-puces button:hover{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 10%,transparent);transform:translateY(-2px)}
.r-appel-formulaire .af-note{display:flex;align-items:flex-start;gap:10px;color:var(--tx2);font-size:.95rem;max-width:70ch}
.r-appel-formulaire .af-note .ic{width:18px;height:18px;margin-top:3px;color:var(--accT)}
@media(max-width:980px){.r-appel-formulaire .af-f{grid-template-columns:1fr 1fr}.r-appel-formulaire .af-ch:first-child{grid-column:1/-1}.r-appel-formulaire .af-ch:nth-child(2)::before{display:none}.r-appel-formulaire .af-ch:nth-child(2),.r-appel-formulaire .af-ch:nth-child(3){border-top:1px solid var(--bord);border-radius:0}.r-appel-formulaire .af-f .btn{grid-column:1/-1;margin:8px 0 0}}
@media(max-width:560px){.r-appel-formulaire .af-f{grid-template-columns:1fr}.r-appel-formulaire .af-ch+.af-ch::before{display:none}.r-appel-formulaire .af-ch+.af-ch{border-top:1px solid var(--bord);border-radius:0}.r-appel-formulaire .af-ch{padding:6px 14px}}
`; }
};

/* ── 8. la bande en biais ── */
const biais = {
  id: 'appel.biais', rubrique: 'appel', nom: 'Bande en biais', quand: 'toujours possible, artisans et garages surtout : un ruban penché aux couleurs du bouton traverse la section, croisé d\'un second liseré, la question et les actions dessus',
  surfaces: ['fond', 'surface', 'champ', 'accent'], js: ['aimant'], fonds: false, decoupe: false,
  besoin: function (spec) { return joignable(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx);
    return '<section class="' + h.classes('appel.biais', bloc) + '" aria-label="Contact rapide"><div class="abi-ruban"><div class="w abi"' + h.rv('monte') + '>' +
      '<h2 class="t">' + h.esc(fr(question(spec, ctx))) + '</h2><div class="abi-act">' + h.boutons(spec) + '</div></div></div></section>';
  },
  css: function () { return `
${libre('r-appel-biais')}
.r-appel-biais{--t1:var(--btn);--t2:var(--btnT);padding-block:clamp(54px,7vw,96px);overflow:hidden}
.r-appel-biais .abi-ruban{position:relative;isolation:isolate;padding-block:clamp(46px,6vw,86px);color:var(--t2);--tx:var(--t2);--tx2:var(--t2);--btn:var(--t2);--btnT:var(--t1);--accT:var(--t2)}
.r-appel-biais .abi-ruban::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--t1);transform:skewY(-3deg);transform-origin:left;transition:transform 1.1s var(--ease2) .1s}
.r-appel-biais .abi-ruban::after{content:"";position:absolute;inset:-20px 0;z-index:-2;border-block:2px solid color-mix(in srgb,var(--t1) 60%,transparent);transform:skewY(2.2deg)}
@supports selector(:has(a)){.js .r-appel-biais .abi-ruban:not(:has(.vu))::before{transform:skewY(-3deg) scaleX(0)}}
.r-appel-biais .abi{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px 48px}
.r-appel-biais h2.t{font-size:clamp(2rem,4.6vw,4rem);max-width:17ch}
.r-appel-biais .b1{box-shadow:none}
.r-appel-biais .b2{color:var(--t2);border-color:color-mix(in srgb,var(--t2) 55%,transparent)}
@media(max-width:700px){.r-appel-biais .abi-ruban::before{transform:skewY(-4.5deg)}.r-appel-biais .abi-ruban::after{transform:skewY(3deg)}}
@media(max-width:700px){@supports selector(:has(a)){.js .r-appel-biais .abi-ruban:not(:has(.vu))::before{transform:skewY(-4.5deg) scaleX(0)}}}
@media(prefers-reduced-motion:reduce){.r-appel-biais .abi-ruban::before{transition:none}}
`; }
};

module.exports = [geant, photo, bordure, defile, onde, cercle, formulaire, biais];
