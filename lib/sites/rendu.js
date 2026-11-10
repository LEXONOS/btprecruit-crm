// Rendu d'un site à partir de sa fiche (spec), de sa donne (spec.da : modèle de métier, palette, voix, voir donne.js) et
// de sa composition (spec.compo : les rubriques choisies dans la bibliothèque, voir composition.js). HTML et CSS faits
// main, un petit script maison pour le mouvement (aucune requête vers un tiers, pas de cookie, pas de traceur ; tout
// reste lisible sans lui). Polices et images servies par le site lui-même. Même fiche = mêmes fichiers.
// Aperçu : une page + mentions légales, bandeau « aperçu », noindex. En ligne : la formule décide des pages.
'use strict';
const T = require('./theme');
const DN = require('./donne');
const M = require('./modeles');
const F = require('./fiche');
const J = require('./juridique');
const O = require('./rubriques/outils');
const B = require('./rubriques');
const JT = require('./rubriques/jetons');
const MV = require('./rubriques/mouvement');
const FD = require('./rubriques/fonds');
const DC = require('./rubriques/decoupes');
const C = require('./composition');
const TP = require('./templates');
const PN = require('./panneau');
const MQ = require('../martinique');
const { NOVALEMO } = require('../config');

const HEBERGEUR = J.HEBERGEUR_TEXTE;
const esc = O.esc, net = O.net;

/* ── les photos : chacune ne sert qu'une fois ; les siennes d'abord (c'est son entreprise), puis celles de Léa ── */
function repartir(spec) {
  // une photo en double (même fichier sous deux rôles) ne compte qu'une fois
  const toutes = (spec.photos || []).filter(function (p, k, t) { return p && p.fichier && t.findIndex(function (x) { return x && x.fichier === p.fichier; }) === k; });
  const siennes = toutes.filter(function (p) { return !p.credit; });
  const illus = toutes.filter(function (p) { return p.credit; });
  const prises = new Set();
  const prendre = function (p) { if (p && !prises.has(p)) { prises.add(p); return p; } return null; };
  const r = { hero: null, services: {}, apropos: null, bandeau: null, galerie: [], reste: [] };
  // le haut de page avant tout : sans photo à lui ni photo de haut de page, il prend la photo d'ambiance du bandeau, puis
  // celle de la présentation, puis celle d'un service (un premier écran avec une vraie photo frappe plus qu'un titre seul)
  // une photo à lui ne porte le haut de page que si elle tient l'écran entier (Léa l'a dit, ou assez grande) : une petite
  // photo agrandie paraît pixelisée (Miranda) ; elle sert alors plus bas
  const heroOk = function (p) { return p.hero === true || (p.hero === undefined && (p.l || 0) >= 1100); };
  r.hero = prendre(siennes.find(heroOk)) || prendre(illus.find(function (p) { return p.role === 'hero'; })) || prendre(illus.find(function (p) { return !p.role; }))
    || prendre(illus.find(function (p) { return p.role === 'bandeau'; })) || prendre(illus.find(function (p) { return p.role === 'apropos'; })) || prendre(illus.find(function (p) { return p.role === 'service'; }));
  const cle = require('./images').cleTitre;
  O.servicesDe(spec).forEach(function (s, k) { const t = cle(s.titre); const p = illus.find(function (x) { return x.role === 'service' && !prises.has(x) && (x.pour_titre ? x.pour_titre === t : x.pour === k); }); if (p) r.services[k] = prendre(p); });
  r.apropos = prendre(siennes.find(function (p) { return !prises.has(p); })) || prendre(illus.find(function (p) { return p.role === 'apropos' && !prises.has(p); })) || prendre(illus.find(function (p) { return !p.role && !prises.has(p); }));
  r.bandeau = prendre(illus.find(function (p) { return p.role === 'bandeau' && !prises.has(p); })) || null;
  r.galerie = siennes.filter(function (p) { return !prises.has(p); });
  r.reste = illus.filter(function (p) { return !prises.has(p); });
  return r;
}

/* ── les textes du site, quelle que soit la version de la fiche ── */
function textes(spec, ctx) {
  const v3 = (spec.v || 0) >= 3;
  const metier = net(spec.metier) || net(spec.activite) || '';
  const lieu = spec.commune ? MQ.a(spec.commune) : '';
  const titreMetier = metier ? metier + (lieu ? ' ' + lieu : '') : net(spec.nom);
  return {
    v3: v3, metier: metier,
    // le grand titre du premier écran (écrit par l'atelier) : le métier et la commune restent dans le h1, en sur-titre
    titre: ctx.mod.titres === 'nom' ? null : (net(spec.titre) || null),
    lieuMetier: titreMetier,
    h1: ctx.mod.titres === 'nom' ? net(spec.nom) : titreMetier,
    sur: ctx.mod.titres === 'nom' ? titreMetier : null,
    phrase: v3 ? net(spec.accroche) : (net(spec.chapo) || net(spec.accroche)),
    services: net(spec.titre_services && v3 ? spec.titre_services : '') || M.titreServices(ctx.da.modele, spec.secteur || spec.activite),
    appel: net(spec.appel) || null
  };
}
function iconePour(t, d) { return O.iconePour(t, d); }

/* ── les pièces partagées par toutes les variantes d'en-tête et de pied ── */
function pieces(spec, ctx) {
  const nom = net(spec.nom);
  ctx.marque = '<a class="marque" href="' + esc(ctx.lien('')) + '" aria-label="' + esc(nom) + ', accueil">' + (ctx.logo
    ? '<img src="' + esc(ctx.racineImg + ctx.logo.fichier) + '" alt="' + esc(nom) + '"' + (ctx.logo.l && ctx.logo.h ? ' width="' + ctx.logo.l + '" height="' + ctx.logo.h + '"' : '') + '>'
    : '<span class="mono" aria-hidden="true">' + T.icone(ctx.iconeMetier) + '</span><span class="nm">' + esc(nom) + '</span>') + '</a>';
  ctx.burger = '<button class="burger" type="button" data-menu-bouton aria-expanded="false" aria-controls="menu-m" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>';
  const liens = (ctx.ancres || []).map(function (a, k) { return '<a href="' + esc(a.href) + '" style="--i:' + k + '">' + esc(a.nom) + '</a>'; }).join('');
  ctx.menuMobile = '<div class="menu-m" id="menu-m" data-menu><nav aria-label="Menu">' + liens + '</nav><div class="menu-act">' + O.boutons(spec, { aimant: false }) + '</div></div>';
  ctx.ligneMetier = [ctx.textes.metier, spec.commune ? MQ.a(spec.commune) : null].filter(Boolean).join(' ') + (spec.commune ? ', Martinique' : '');
  ctx.basDePage = '<div class="bas"><span>© ' + ctx.annee + ' ' + esc(nom) + '</span><a href="' + esc(ctx.lien('mentions-legales/')) + '">Mentions légales</a><a href="' + esc(NOVALEMO.signature_site.url) + '" target="_blank" rel="noopener">' + esc(NOVALEMO.signature_site.texte) + '</a></div>';
}
// la marque, le bouton du menu et le panneau sur téléphone : les mêmes pour toutes les variantes d'en-tête
const CSS_PIECES = `
.marque{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0;color:inherit}
.marque .nm{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.38rem;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mono{width:44px;height:44px;flex:none;display:grid;place-items:center;background:var(--accent);color:var(--surA);border-radius:var(--rb);transition:transform .6s var(--ease)}
.marque:hover .mono{transform:rotate(-8deg) scale(1.05)}
.mono .ic{width:24px;height:24px}
.marque img{height:48px;width:auto;max-width:210px;object-fit:contain}
.clair .marque img{mix-blend-mode:multiply}
.sur-photo:not(.defile) .marque img,.sombre .marque img{background:#fff;padding:6px 10px;border-radius:10px;height:54px;mix-blend-mode:normal}
@media(max-width:900px){.marque .nm{font-size:1.18rem}.mono{width:38px;height:38px}}
@media(max-width:520px){.marque .nm{white-space:normal;font-size:1.04rem;line-height:1.08;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}
.burger{display:none;position:relative;z-index:62;width:48px;height:48px;flex:none;border:0;border-radius:var(--rb);background:color-mix(in srgb,currentColor 10%,transparent);color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.burger span{position:absolute;left:14px;right:14px;height:2px;border-radius:2px;background:currentColor;transition:transform .5s var(--ease),opacity .3s,top .5s var(--ease)}
.burger span:nth-child(1){top:17px}.burger span:nth-child(2){top:23px}.burger span:nth-child(3){top:29px}
.burger[aria-expanded=true]{color:var(--surC)}
.burger[aria-expanded=true] span:nth-child(1){top:23px;transform:rotate(45deg)}
.burger[aria-expanded=true] span:nth-child(2){opacity:0;transform:scaleX(.2)}
.burger[aria-expanded=true] span:nth-child(3){top:23px;transform:rotate(-45deg)}
@media(max-width:900px){.burger{display:block}}
.menu-m{position:fixed;inset:0;z-index:61;background:var(--champ);color:var(--surC);--tx:var(--surC);--tx2:var(--champDoux);--btn:var(--btnC);--btnT:var(--btnCT);display:flex;flex-direction:column;justify-content:center;gap:40px;padding:100px var(--g) 40px;clip-path:circle(0% at calc(100% - 46px) 42px);visibility:hidden;transition:clip-path .8s var(--ease2),visibility 0s linear .8s}
.menu-m.ouvert{clip-path:circle(150% at calc(100% - 46px) 42px);visibility:visible;transition:clip-path .8s var(--ease2)}
.menu-m nav{display:grid;gap:6px}
.menu-m nav a{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(2.1rem,9vw,3.4rem);line-height:1.12;text-decoration:none;opacity:0;transform:translateY(24px);transition:opacity .5s,transform .7s var(--ease)}
.menu-m.ouvert nav a{opacity:1;transform:none;transition-delay:calc(.25s + var(--i) * 70ms)}
.menu-m .menu-act{opacity:0;transition:opacity .5s}.menu-m.ouvert .menu-act{opacity:1;transition-delay:.55s}
.menu-m .b2{color:var(--surC)}
@media(min-width:901px){.menu-m{display:none}}
.nobr{white-space:nowrap}
.r .bas{display:flex;flex-wrap:wrap;gap:10px 26px;justify-content:space-between;margin-top:clamp(34px,5vw,56px);padding-top:22px;border-top:1px solid var(--bord);font-size:.88rem;color:var(--tx2)}
.r .bas a{color:var(--tx2);text-decoration:none}.r .bas a:hover{text-decoration:underline}
`;
// les petites touches de chaque famille de métier, posées sur toutes les rubriques
const TOUCHES = {
  atelier: '.m-atelier .tete-sec .t::before{content:"";display:block;width:56px;height:5px;background:var(--acc);margin-bottom:18px;border-radius:2px}',
  garage: '.m-garage .tete-sec .t::before{content:"";display:block;width:56px;height:5px;background:var(--acc);margin-bottom:18px}.m-garage .tete-sec .t{font-style:normal}',
  comptoir: '.m-comptoir .tete-sec{text-align:center;justify-items:center;margin-inline:auto}.m-comptoir .tete-sec::after{content:"";width:44px;height:2px;background:var(--acc);margin-top:4px}',
  ecrin: '.m-ecrin .tete-sec{text-align:center;justify-items:center;margin-inline:auto}',
  cabinet: '',
  horizon: '.m-horizon .tete-sec .t{text-wrap:balance}',
  verdure: '.m-verdure .ph{border-radius:var(--rp)}',
  boutique: '.m-boutique .tete-sec .t{font-size:clamp(var(--h2a),4.6vw,calc(var(--h2b) * 1.12))}'
};

/* ── un bloc : la variante choisie, rendue ; une variante en panne ne casse pas le site (le socle prend sa place) ── */
function rendreBloc(b, spec, ctx) {
  const v = B.VARIANTES[b.id];
  ctx.blocNo = (ctx.blocNo || 0) + 1;
  // une section qui n'a rien de neuf à dire sur cette page (la note déjà montrée plus haut) se retire, sans secours
  try { if (v && v.passer && v.passer(spec, ctx)) return ''; } catch (e) { ctx.erreurs.push(b.id + ' (passer) : ' + e.message); }
  let html = '';
  try { html = v ? v.rendre(spec, ctx, b) || '' : ''; } catch (e) { ctx.erreurs.push(b.id + ' : ' + e.message); html = ''; }
  if (!html && v && !v.socle) {
    const secours = B.PAR_RUBRIQUE[b.rubrique].find(function (x) { return x.socle && B.possible(x, spec, ctx); });
    if (secours) { try { html = secours.rendre(spec, ctx, b) || ''; if (html) ctx.utilisees.add(secours.id); } catch (e) { ctx.erreurs.push(secours.id + ' : ' + e.message); } }
  } else if (html) ctx.utilisees.add(b.id);
  return html;
}

/* ── page complète ── */
function typeSchema(id, spec) {
  if (id === 'comptoir') return 'Restaurant';
  if (id === 'ecrin') return 'BeautySalon';
  if (id === 'garage' && /garage|m[ée]cani|carross|pneu/i.test(spec.secteur || spec.activite || '')) return 'AutoRepair';
  if (id === 'atelier' || id === 'verdure') return 'HomeAndConstructionBusiness';
  if (id === 'boutique') return 'Store';
  return 'LocalBusiness';
}
function feuille(ctx) {
  const parts = [JT.css(ctx), CSS_PIECES];
  // un template : sa base et son style, puis ses sections (ni motifs de fond, ni touches de l'ancien moteur)
  if (ctx.template) parts.push(TP.css(ctx.template));
  const vus = new Set();
  ctx.utilisees.forEach(function (id) { const v = B.VARIANTES[id]; if (!v || vus.has(id) || !v.css) return; vus.add(id); try { parts.push(typeof v.css === 'function' ? v.css(ctx) : String(v.css)); } catch (e) { ctx.erreurs.push(id + ' (css) : ' + e.message); } });
  // les découpes des templates (vague, courbe, biais...) posées entre deux sections
  if (ctx.decoupes.size) parts.push(DC.css(Array.from(ctx.decoupes)));
  if (!ctx.template) {
    if (ctx.fondsUtilises.size) parts.push(FD.css(ctx, Array.from(ctx.fondsUtilises)));
    if (ctx.avecDecoupes) parts.push(FD.CSS_TRANSITIONS);
    parts.push(TOUCHES[ctx.da.modele] || '');
  }
  if (ctx.mode === 'apercu') parts.push(PN.CSS);
  return parts.join('').replace(/\n\s*/g, '');
}
function page(spec, ctx, contenu, o) {
  o = o || {};
  const p = ctx.palette, ty = ctx.type, nom = net(spec.nom);
  const titre = o.titre || (spec.seo && net(spec.seo.titre)) || (nom + (ctx.textes.metier ? ', ' + ctx.textes.metier : '') + (spec.commune ? ' ' + MQ.a(spec.commune) : ''));
  const desc = o.description || (spec.seo && net(spec.seo.description)) || ctx.textes.phrase || '';
  const a = O.actionPrincipale(spec);
  const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="' + (parseInt(ctx.mod.forme.rb, 10) >= 100 ? 32 : 12) + '" fill="' + p.accent + '"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="' + p.surAccent + '">' + esc(O.initiale(nom)) + '</text></svg>');
  const ld = { '@context': 'https://schema.org', '@type': typeSchema(ctx.da.modele, spec), name: nom, description: desc || undefined, telephone: spec.contact && MQ.e164(spec.contact.tel) || undefined, email: spec.contact && spec.contact.email || undefined, areaServed: O.zoneClient(spec) || 'Martinique', address: { '@type': 'PostalAddress', addressLocality: spec.commune || undefined, addressRegion: 'Martinique', addressCountry: 'MQ', streetAddress: (spec.contact && spec.contact.adresse) || undefined }, url: ctx.url || undefined };
  if (O.noteGoogle(spec)) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(spec.google.note), reviewCount: Number(spec.google.avis) };
  // l'aperçu : la barre et son panneau (retouches, images, commande), écrits directement à la tour
  const apercu = ctx.mode === 'apercu' ? PN.html(spec, ctx) : '';
  const barre = ctx.mode === 'live' && a ? (function () {
    const c = spec.contact || {}, t = O.telHref(c.tel);
    const deux = a.type === 'whatsapp' && t ? '<a class="btn b2" href="' + esc(t) + '">' + T.icone('tel') + '<span>Appeler</span></a>' : '';
    return '<nav class="barre" aria-label="Contact rapide">' + O.lienA(a, 'btn b1', T.icone(a.icone) + '<span>' + esc(a.court) + '</span>') + deux + '</nav>';
  })() : '';
  // les liens vers les rubriques de l'accueil : seulement celles qui s'y sont vraiment rendues (une galerie dont les photos
  // ont toutes servi plus haut se retire, son lien aussi)
  if (o.chemin === '' && !ctx.ancresRelues) {
    const ids = new Set((contenu.match(/\sid="[a-z-]+"/g) || []).map(function (m) { return m.replace(/^\sid="|"$/g, ''); }));
    ctx.ancres = (ctx.ancres || []).filter(function (a) { return String(a.href).indexOf('#') < 0 || ids.has(a.id); });
    ctx.ancresRelues = true;
  }
  // l'en-tête et le pied de la composition, rendus avant la feuille (elle ne garde que les variantes utilisées)
  const blocNav = Object.assign({}, ctx.compo.blocs.find(function (b) { return b.rubrique === 'nav'; }) || { rubrique: 'nav', id: 'nav.classique', surface: 'fond' }, { surPhoto: !!o.surPhoto });
  const blocPied = ctx.compo.blocs.find(function (b) { return b.rubrique === 'pied'; }) || { rubrique: 'pied', id: 'pied.colonnes', surface: 'champ' };
  const tete = rendreBloc(blocNav, spec, ctx);
  const piedHtml = rendreBloc(blocPied, spec, ctx);
  const modules = new Set(), scripts = [];
  ctx.utilisees.forEach(function (id) { const v = B.VARIANTES[id]; (v && v.js || []).forEach(function (m) { modules.add(m); }); if (v && v.script) scripts.push(typeof v.script === 'function' ? v.script(ctx) : String(v.script)); });
  if (ctx.fondsUtilises.has('halo')) modules.add('halo');
  if (/data-aimant/.test(contenu + tete)) modules.add('aimant');
  if (/data-defile/.test(contenu)) modules.add('defile');
  const prechargees = [T.FICHIERS_POLICES[ty.titre][0].fichier].concat(ty.texte !== ty.titre ? [T.FICHIERS_POLICES[ty.texte][0].fichier] : []);
  const classes = [p.clair ? 'clair' : 'sombre', 'm-' + ctx.da.modele, 'b-' + (ctx.compo.boutons || 'glisse'), ctx.mod.boutons === 'caps' && !ctx.template ? 'caps' : '', ctx.mod.centre && !ctx.template ? 'centre' : '', ctx.template ? 'x k-' + ctx.template.style + ' t-' + ctx.template.id + (ctx.template.panneaux ? ' pn' : '') : '', ctx.mode === 'apercu' ? 'a-apercu' : '', barre ? 'a-barre' : ''].filter(Boolean).join(' ');
  if (ctx.mode === 'apercu' && ctx.retour) scripts.push(PN.SCRIPT);
  const css = feuille(ctx);
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>' + esc(titre) + '</title><meta name="description" content="' + esc(desc.slice(0, 160)) + '">' +
    (ctx.mode === 'apercu' ? '<meta name="robots" content="noindex,nofollow">' : (ctx.url ? '<link rel="canonical" href="' + esc(ctx.url + (o.chemin || '')) + '">' : '')) +
    '<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="' + esc(titre) + '"><meta property="og:description" content="' + esc(desc.slice(0, 200)) + '">' +
    '<meta name="theme-color" content="' + p.fond + '"><link rel="icon" href="' + favicon + '">' + (ctx.mode === 'apercu' && ctx.version ? '<meta name="novalemo:version" content="' + esc(ctx.version) + '">' : '') +
    prechargees.map(function (f) { return '<link rel="preload" href="/_f/' + f + '" as="font" type="font/woff2" crossorigin>'; }).join('') +
    '<script>' + MV.TETE + '</script>' +
    '<style>' + css + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    '</head><body class="' + classes + '"><a class="saut" href="#contenu">Aller au contenu</a>' +
    tete + '<main id="contenu">' + contenu + '</main>' + piedHtml + barre + apercu +
    '<script>' + MV.script(Array.from(modules), scripts) + '</script></body></html>';
}

function mentions(spec, ctx) {
  // une page neuve : ses photos repartent de zéro (le pied peut en montrer une)
  ctx.montrees = new Set(); ctx.vues = new Map(); ctx._prises = []; ctx.alloc.galerie = ctx.galerieDepart.slice();
  const corps = '<section class="page-h r s-fond"><div class="w"><h1 class="t h1" style="--hk:' + O.k2('Mentions légales', ctx.type) + '">Mentions légales</h1></div></section>' +
    '<section class="sec r s-fond" style="padding-top:0"><div class="w prose">' + J.mentionsHtml(spec, { mode: ctx.mode, identite: ctx.identite, photos: ctx.photos }) + '</div></section>';
  return page(spec, ctx, corps, { titre: 'Mentions légales, ' + net(spec.nom), chemin: 'mentions-legales/' });
}

// les pages d'une formule (le plan du site)
function plan(formule, spec) {
  if (formule === 'vitrine' || formule === 'signature') {
    const p = [{ chemin: '', nav: 'Accueil' }, { chemin: 'services/', nav: 'Services' }, { chemin: 'a-propos/', nav: 'À propos' }, { chemin: 'contact/', nav: 'Contact' }, { chemin: 'mentions-legales/' }];
    // une page par service, chacune à son adresse (deux titres proches ne s'écrasent pas)
    if (formule === 'signature') { const pris = new Set(); O.servicesDe(spec).forEach(function (s) { let sl = O.slugifier(net(s.titre)), n = 2; while (pris.has(sl)) sl = O.slugifier(net(s.titre)) + '-' + (n++); pris.add(sl); p.push({ chemin: 'services/' + sl + '/', service: s }); }); }
    return p;
  }
  return [{ chemin: '' }, { chemin: 'mentions-legales/' }];
}

// les liens de l'en-tête : les rubriques présentes sur la page d'accueil (ou les pages, pour un site de plusieurs pages)
const ANCRES = { services: 'services', apropos: 'apropos', galerie: 'images', infos: 'infos', faq: 'faq', contact: 'contact' };
function ancres(spec, ctx, blocs, pages) {
  const navPages = pages.filter(function (x) { return x.nav; });
  if (navPages.length > 1) return navPages.map(function (x) { return { id: x.chemin.replace(/\/$/, '') || 'accueil', nom: x.nav, href: ctx.lien(x.chemin) }; });
  const noms = { services: ctx.textes.services.length <= 18 ? ctx.textes.services.replace(/^Nos /, '').replace(/^./, function (x) { return x.toUpperCase(); }) : 'Services', apropos: 'À propos', galerie: 'En images', infos: 'Infos', faq: 'Questions', contact: 'Contact' };
  const out = [];
  // une section qui en couvre une autre (le haut de page en tuiles de services) porte aussi son ancre
  const rubriquesDe = function (b) { const v = B.VARIANTES[b.id]; return [b.rubrique].concat((v && v.couvre) || []); };
  blocs.forEach(function (b) { rubriquesDe(b).forEach(function (r) { if (ANCRES[r] && !out.some(function (x) { return x.id === ANCRES[r]; })) out.push({ id: ANCRES[r], nom: noms[r], href: ctx.lien('') + '#' + ANCRES[r], rang: r }); }); });
  // quatre liens au plus : les services, la présentation, les images, le contact d'abord
  const ordre = ['services', 'apropos', 'images', 'contact', 'infos', 'faq'];
  const place = function (a) { return blocs.findIndex(function (x) { return rubriquesDe(x).some(function (r) { return ANCRES[r] === a.id; }); }); };
  return out.sort(function (a, b) { return ordre.indexOf(a.id) - ordre.indexOf(b.id); }).slice(0, 4).sort(function (a, b) { return place(a) - place(b); }).map(function (a) { return { id: a.id, nom: a.nom, href: a.href }; });
}

/* ── le contexte d'un rendu ── */
// la fiche telle qu'on la montre : l'adresse sans le code Google qui la précède parfois (« JX76+HFQ, ... »), et sans les
// textes qu'un ancien moteur avait coupés au milieu d'un mot (« ... une installation à fair… ») ; la fiche en base ne
// change pas (les numéros des outre-mer écrits en +33 sont remis à leur indicatif par martinique.e164)
function propre(spec0) {
  const spec = Object.assign({}, spec0 || {});
  if (spec.contact && spec.contact.adresse) { const a = MQ.sansPlusCode(spec.contact.adresse); spec.contact = Object.assign({}, spec.contact, { adresse: a.replace(/,?\s*Martinique$/i, '') ? a : '' }); }
  ['appel', 'titre', 'titre_services', 'cta'].forEach(function (k) { if (typeof spec[k] === 'string' && /…\s*$/.test(spec[k])) spec[k] = ''; });
  return spec;
}
function contexte(site, opts) {
  const spec = propre(site.spec);
  const mode = opts.mode === 'live' ? 'live' : 'apercu';
  const formule = mode === 'live' ? (site.formule || 'essentiel') : 'essentiel';
  const photos = (spec.photos || []).filter(function (p) { return p && p.fichier; });
  const da = DN.de(spec);
  const mod = M.MODELES[da.modele];
  const racinePhysique = (mode === 'live' ? 's/' : 'a/') + site.slug + '/';
  const base = opts.base || (mode === 'live' ? '/' : '/' + racinePhysique);
  const pages = plan(formule, spec);
  const ctx = {
    mode: mode, formule: formule, da: da, mod: mod, palette: T.palette(DN.paletteDe(da), spec.accent), type: T.typo(da.type), photos: photos, logo: spec.logo && spec.logo.fichier ? spec.logo : null, pages: pages,
    racinePhysique: racinePhysique, racineImg: opts.racineImg || (base + 'img/'), optimiseur: opts.optimiseur !== false,
    lien: function (chemin) { return base + chemin; }, url: mode === 'live' && opts.url ? opts.url.replace(/\/?$/, '/') : null,
    identite: opts.identite || null, contactNovalemo: opts.contactNovalemo || null, retour: opts.retour || null, vendu: !!opts.vendu, annee: new Date().getFullYear(),
    alloc: repartir(spec), erreurs: [], utilisees: new Set(), fondsUtilises: new Set(), decoupes: new Set(), avecDecoupes: false, version: site.version || null
  };
  ctx.textes = textes(spec, ctx);
  ctx.iconeMetier = O.iconePour([spec.secteur, spec.activite, ctx.textes.metier].filter(Boolean).join(' '), O.servicesDe(spec)[0] ? O.iconeDe(O.servicesDe(spec)[0], 'etoile') : 'etoile');
  const siennes = photos.filter(function (p) { return !p.credit; }).length;
  ctx.stock = { total: photos.length, siennes: siennes, illus: photos.length - siennes, services: Object.keys(ctx.alloc.services).length };
  // les outils des variantes, liés à ce rendu
  // chaque photo montrée est notée : une photo ne paraît qu'une fois par page
  ctx.montrees = new Set();
  // le fichier de chaque photo montrée sur la page, avec la rubrique qui l'a montrée
  ctx.vues = new Map();
  ctx.galerieDepart = ctx.alloc.galerie.slice();
  const cleP = function (p) { return (p && (p.fichier || p.url)) || p; };
  const montrer = function (p) { if (!p) return; ctx.montrees.add(p); if (!ctx.vues.has(cleP(p))) ctx.vues.set(cleP(p), ctx.blocNo || 0); };
  // déjà montrée par une autre rubrique de cette page ?
  const vue = function (p) { if (!p) return false; const k = ctx.vues.get(cleP(p)); return k !== undefined && k !== (ctx.blocNo || 0); };
  // une photo déjà montrée par une autre rubrique est remplacée par une photo encore libre ; s'il n'y en a plus, elle
  // reste (mieux qu'un cadre vide). Une même rubrique peut montrer deux fois sa photo (un fond flou et la photo nette).
  const unique = function (p) { if (!vue(p)) return p; const x = ctx.h.photos(1, { decor: true })[0]; return x || p; };
  // ctx.prises : les photos que les variantes se réservent entre elles ; on y voit aussi toujours celles déjà montrées
  // sur la page (même fichier), pour qu'aucune variante n'en reprenne une
  ctx._prises = [];
  Object.defineProperty(ctx, 'prises', {
    enumerable: true, configurable: true,
    get: function () { return ctx._prises.concat(ctx.photos.filter(function (p) { return ctx.vues.has(cleP(p)) && ctx._prises.indexOf(p) < 0; })); },
    set: function (v) { ctx._prises = (Array.isArray(v) ? v : []).filter(function (p, k, t) { return p && t.indexOf(p) === k; }); }
  });
  ctx.h = Object.assign({}, O, {
    figure: function (p, ch, t, o) { p = unique(p); montrer(p); return O.figure(p, ctx, ch, t, o); },
    img: function (p, ch, t, x) { p = unique(p); montrer(p); return O.img(p, ctx, ch, t, x); },
    vue: vue,
    // des photos encore libres (n au plus), jamais une déjà montrée ni une réservée : o.siennes = seulement les siennes.
    // Celles qu'on prend quittent la galerie (elle ne les remontrera pas).
    photos: function (n, o) {
      const libres = ctx.h.libres(n, o);
      libres.forEach(function (p) { montrer(p); const k = ctx.alloc.galerie.indexOf(p); if (k >= 0) ctx.alloc.galerie.splice(k, 1); });
      return libres;
    },
    // les mêmes, sans les prendre (pour un besoin, ou pour compter)
    libres: function (n, o) {
      o = o || {};
      const pris = new Set([ctx.alloc.hero, ctx.alloc.apropos, ctx.alloc.bandeau].concat(Object.keys(ctx.alloc.services).map(function (k) { return ctx.alloc.services[k]; })).concat(Array.from(ctx.montrees)).concat(ctx._prises).filter(Boolean));
      // o.decor : une photo de décor (fond d'appel, collage) prend d'abord les illustrations, pour laisser les siennes à la galerie
      const ordre = o.siennes ? ctx.alloc.galerie : o.decor ? ctx.alloc.reste.concat(ctx.alloc.galerie) : ctx.alloc.galerie.concat(ctx.alloc.reste);
      const libres = [], fichiers = new Set();
      ordre.forEach(function (p) { if (libres.length < (n || 1) && !pris.has(p) && !ctx.vues.has(cleP(p)) && !fichiers.has(cleP(p))) { libres.push(p); fichiers.add(cleP(p)); } });
      return libres;
    }
  });
  return { spec: spec, ctx: ctx };
}

// la composition du site : celle de la fiche si elle tient encore, sinon l'assembleur (même fiche, même résultat)
function compositionDe(spec, ctx, opts) {
  if (opts.compo) return opts.compo;
  if (C.valide(spec.compo, spec, ctx)) return spec.compo;
  // un site commandé ou payé garde sa composition, même d'un moteur d'avant, tant qu'elle se rend
  if (opts.figee) { const f = C.figee(spec.compo, spec, ctx); if (f) return f; }
  return C.composer(spec, ctx, { recents: opts.recents, choix: spec.compo && spec.compo.choix, essai: (spec.compo && spec.compo.essai) || 0 });
}

/* ── point d'entrée ── */
// site = { slug, spec, formule } ; opts = { mode: 'apercu'|'live', identite, contactNovalemo, optimiseur, url, compo (forcée), racineImg }
// Retourne { files: [{ file, data }], pages, compo, da, palette } ; les images (spec.photos / spec.logo) sont fournies à part.
function rendre(site, opts) {
  opts = opts || {};
  const x = contexte(site, opts), spec = x.spec, ctx = x.ctx;
  ctx.compo = compositionDe(spec, ctx, opts);
  // un template : sa voix typographique et sa page adoucie (béton, papier, sable...), contrastes revérifiés
  ctx.template = ctx.compo.template ? TP.PAR_ID[ctx.compo.template] || null : null;
  if (ctx.template) { ctx.type = T.typo(TP.typePour(ctx.template, ctx.da, spec.nom)); ctx.palette = TP.palettePour(ctx.template, DN.paletteDe(ctx.da), spec.accent); }
  const blocs = ctx.compo.blocs;
  const pages = ctx.pages;
  ctx.ancres = ancres(spec, ctx, blocs, pages);
  pieces(spec, ctx);
  blocs.forEach(function (b) { if (b.fond) ctx.fondsUtilises.add(b.fond); });
  const files = [];
  const mettre = function (chemin, html) { files.push({ file: ctx.racinePhysique + chemin + 'index.html', data: html }); };
  const hero = blocs.find(function (b) { return b.rubrique === 'hero'; });
  const nav = blocs.find(function (b) { return b.rubrique === 'nav'; });
  // les blocs du corps, avec les découpes entre surfaces
  const corps = function (filtre, extra) {
    // une page neuve : toutes les photos redeviennent disponibles (chaque page montre chacune au plus une fois), la note
    // Google peut être montrée une fois, et les numéros des sections repartent de 01
    ctx.montrees = new Set(); ctx.vues = new Map(); ctx._prises = []; ctx.alloc.galerie = ctx.galerieDepart.slice();
    ctx.noteMontree = false; ctx.numerosPage = {};
    let html = '', prec = null, precId = null, report = null, poses = 0;
    blocs.filter(function (b) { return b.rubrique !== 'nav' && b.rubrique !== 'pied' && (!filtre || filtre(b)); }).forEach(function (b) {
      const bb = Object.assign({}, b, extra && extra(b));
      const h = rendreBloc(bb, spec, ctx);
      // une section qui ne se rend pas (sa note déjà montrée plus haut...) passe sa découpe à la suivante
      if (!h) { if (b.dc && !report) report = { forme: b.dc, inv: b.dcInv }; return; }
      if (b.decoupe && prec && prec !== b.surface) { const d = FD.transition(b.decoupe, prec, b.surface); if (d) { html += d; ctx.avecDecoupes = true; } }
      // la découpe d'un template : dessinée de la couleur de cette section, posée sur le bas de la précédente, si elle y
      // tient (la section d'au-dessus n'est pas toujours celle que l'assembleur avait prévue)
      const dc = b.dc ? { forme: b.dc, inv: b.dcInv } : report;
      if (dc && prec && poses < 2 && DC.tient(dc.forme, precId)) { const d = DC.rendre(dc.forme, prec, b.surface, dc.inv); if (d) { html += d; ctx.decoupes.add(dc.forme); poses++; } }
      report = null;
      html += h; prec = b.surface; precId = b.id;
    });
    return html;
  };
  if (pages.length <= 2) {
    mettre('', page(spec, ctx, corps(), { chemin: '', surPhoto: !!(nav && nav.surPhoto) }));
  } else {
    const ty = ctx.type;
    mettre('', page(spec, ctx, corps(function (b) { return ['faq', 'etapes'].indexOf(b.rubrique) < 0; }), { chemin: '', surPhoto: !!(nav && nav.surPhoto) }));
    const avecLiens = ctx.formule === 'signature';
    const tete = function (titre, sous) { const t = net(titre); return '<section class="page-h r s-fond"><div class="w"><h1 class="t h1" style="--hk:' + O.k2(t, ty) + '">' + esc(t) + '</h1>' + (net(sous) ? '<p>' + esc(net(sous)) + '</p>' : '') + '</div></section>'; };
    const pageDe = function (s) { const y = pages.find(function (z) { return z.service === s; }); return y ? y.chemin : null; };
    const liste = !O.servicesDe(spec).length ? '' : '<section class="sec r s-fond" style="padding-top:0"><div class="w srv-pages">' + O.servicesDe(spec).map(function (s) { const t = net(s.titre), ch = avecLiens && pageDe(s); return '<article><h2>' + (ch ? '<a href="' + esc(ctx.lien(ch)) + '">' + esc(t) + '</a>' : esc(t)) + '</h2><p>' + esc(net(s.detail || s.texte)) + '</p></article>'; }).join('') + '</div></section>';
    const garder = function (r) { return function (b) { return r.indexOf(b.rubrique) >= 0; }; };
    mettre('services/', page(spec, ctx, tete(ctx.textes.services, ctx.textes.phrase) + liste + corps(garder(['etapes', 'faq', 'appel'])), { chemin: 'services/', titre: ctx.textes.services + ', ' + net(spec.nom) }));
    mettre('a-propos/', page(spec, ctx, tete(ctx.mod.textes.apropos, O.lieuCourt(spec)) + corps(garder(['apropos', 'pourquoi', 'galerie', 'avis', 'appel']), function (b) { return b.rubrique === 'apropos' ? { titre: net(spec.nom) } : null; }), { chemin: 'a-propos/', titre: 'À propos, ' + net(spec.nom) }));
    mettre('contact/', page(spec, ctx, corps(garder(['contact', 'infos', 'faq']), function (b) { return b.rubrique === 'contact' ? { h1: true } : null; }), { chemin: 'contact/', titre: 'Contact, ' + net(spec.nom) }));
    pages.filter(function (y) { return y.service; }).forEach(function (y) {
      const s = y.service, t = net(s.titre) + (spec.commune ? ' ' + MQ.a(spec.commune) : '');
      const detail = net(s.detail || s.texte);
      mettre(y.chemin, page(spec, ctx, tete(t, s.texte) + (detail ? '<section class="sec r s-fond" style="padding-top:0"><div class="w prose"><p style="font-size:1.15rem;color:var(--encre)">' + esc(detail) + '</p></div></section>' : '') + corps(garder(['etapes', 'faq', 'appel', 'contact'])), { chemin: y.chemin, titre: t + ', ' + net(spec.nom), description: net(s.texte) }));
    });
  }
  mettre('mentions-legales/', mentions(spec, ctx));
  if (ctx.mode === 'live') {
    const hote = ctx.url || '';
    files.push({ file: ctx.racinePhysique + 'robots.txt', data: 'User-agent: *\nAllow: /\n' + (hote ? 'Sitemap: ' + hote + 'sitemap.xml\n' : '') });
    if (hote) files.push({ file: ctx.racinePhysique + 'sitemap.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(function (y) { return '<url><loc>' + esc(hote + y.chemin) + '</loc></url>'; }).join('') + '</urlset>\n' });
  }
  return { files: files, pages: pages.map(function (y) { return y.chemin; }), compo: ctx.compo, da: ctx.da, palette: ctx.palette, erreurs: ctx.erreurs, utilisees: Array.from(ctx.utilisees), hero: hero ? hero.id : null };
}

const actionPrincipale = O.actionPrincipale, OBJECTIFS = O.OBJECTIFS, slugifier = O.slugifier, LARGEURS_IMAGES = O.LARGEURS_IMAGES, lireHoraires = O.lireHoraires, resumeHoraires = O.resumeHoraires;
module.exports = { rendre, contexte, compositionDe, TP, slugifier, actionPrincipale, OBJECTIFS, HEBERGEUR, LARGEURS_IMAGES, esc, net, lireHoraires, resumeHoraires, repartir, iconePour, textes };
