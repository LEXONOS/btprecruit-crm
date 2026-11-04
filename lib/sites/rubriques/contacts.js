// Le contact, toujours présent (id="contact") : les moyens de joindre l'entreprise, seulement ceux de la fiche. Six mises
// en scène : le formulaire qui prépare le message (et son aperçu en direct), les moyens en très grandes lettres, la photo
// et son panneau, la bande de nuit aux grands boutons, la carte de visite qui s'incline, le contact selon l'état ouvert
// ou fermé. Sur la page contact d'un site de plusieurs pages, le titre devient le h1 (bloc.h1).
'use strict';
const MQ = require('../../martinique');
// les heures ne se coupent jamais (« 18 h », « 7 h 30 ») : côté serveur, et après le module « ouvert » dans le navigateur
function heures(s) { return String(s == null ? '' : s).replace(/(\d) h\b/g, '$1\u00a0h').replace(/\bh (\d{2})\b/g, 'h\u00a0$1').replace(/([h\d]) – (?=\d)/g, '$1\u00a0–\u00a0').replace(/\b((?:lun|mar|mer|jeu|ven|sam|dim)\.?) – (?=(?:lun|mar|mer|jeu|ven|sam|dim))/gi, '$1\u00a0–\u00a0'); }
function insecHeures(cls) { return "[].slice.call(d.querySelectorAll('." + cls + " [data-ouvert-texte]')).forEach(function(t){t.textContent=t.textContent.replace(/(\\d) h/g,'$1\\u00a0h').replace(/à (\\d)/g,'à\\u00a0$1').replace(/h (\\d\\d)/g,'h\\u00a0$1')})"; }
// la ponctuation française : une espace insécable avant ? ! : ; (le point d'interrogation ne tombe jamais seul à la ligne)
function fr(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0'); }
/* ── petits outils ── */
// les apparitions communes finissent sur clip-path:inset(0) : levé ici, pour ne rogner ni ombres, ni anneaux, ni débords
function libre(cls) { return '.js .' + cls + ' [data-r].vu:not([data-r=rideau]):not([data-r=store]):not([data-r=iris]){clip-path:none}\n.' + cls + ' p{text-wrap:pretty}'; }
function net(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
// ce que la fiche permet, dans l'ordre où on le propose
function moyens(spec, ctx) {
  const h = ctx.h, c = spec.contact || {}, o = h.objectif(spec), out = [];
  const wa = h.waHref(c.mobile || c.tel, o.wa);
  if (wa) out.push({ cle: 'wa', icone: 'whatsapp', etiquette: 'WhatsApp', valeur: 'Écrire un message', action: 'Écrire sur WhatsApp', href: wa, ext: true });
  const num = c.tel || c.mobile, t = num ? h.telHref(num) : null;
  if (t) out.push({ cle: 'tel', icone: 'tel', etiquette: 'Téléphone', valeur: MQ.affiche(num), action: 'Appeler', href: t });
  if (c.email) out.push({ cle: 'mail', icone: 'mail', etiquette: 'Email', valeur: c.email, action: 'Écrire un email', href: h.mailHref(c.email, o.sujet + ' : ' + h.net(spec.nom), o.corps) });
  const ad = net(c.adresse) || (spec.commune ? spec.commune + ', Martinique' : '');
  if (ad) out.push({ cle: 'adresse', icone: 'pin', etiquette: ['visite', 'reservation'].indexOf(spec.objectif) >= 0 ? 'Nous trouver' : 'Adresse', valeur: ad, action: c.maps ? 'Itinéraire' : '', href: c.maps || null, ext: true, commune: spec.commune || MQ.communeDe(ad) || '' });
  const z = h.zoneClient(spec);
  if (z && ['devis', 'appel'].indexOf(spec.objectif || 'devis') >= 0) out.push({ cle: 'zone', icone: 'carte', etiquette: 'Où nous intervenons', valeur: z });
  return out;
}
const SEUL_TEL = { devis: 'Pour un devis, un simple appel suffit.', appel: 'Un souci, une question : appelez, on vous répond.', reservation: 'Pour réserver, appelez-nous.', visite: 'Une question, une commande : appelez-nous.', inscription: 'Pour vous inscrire ou poser une question, appelez-nous.' };
function phrase(spec, ctx, m) { return m.some(function (x) { return x.cle === 'wa' || x.cle === 'mail'; }) ? ctx.h.objectif(spec).phrase : (SEUL_TEL[spec.objectif] || SEUL_TEL.devis); }
// le titre de la section, ou le h1 de la page contact
function titre(ctx, bloc, cls, mots) {
  const h = ctx.h, b = bloc && bloc.h1 ? 'h1' : 'h2', t = ctx.mod.textes.contact;
  return '<' + b + ' class="t ' + cls + '"' + (mots ? ' data-r="mots">' + h.mots(t) : h.rv('monte') + '>' + h.esc(t)) + '</' + b + '>';
}
// une ligne de moyen : icône, étiquette, valeur (un lien quand on peut agir)
function ligne(h, x, cls, i) {
  const corps = '<span class="' + cls + '-ic">' + h.icone(x.icone) + '</span><span class="' + cls + '-tx"><small>' + h.esc(x.etiquette) + '</small><b>' + h.esc(x.valeur) + '</b></span>';
  return '<li' + (i != null ? h.rv('monte', i) : '') + '>' + (x.href ? '<a class="' + cls + '-a" href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + corps + '<span class="' + cls + '-f" aria-hidden="true">' + h.icone('fleche') + '</span></a>' : '<div class="' + cls + '-a">' + corps + '</div>') + '</li>';
}
function etatHoraires(h, spec, cls) {
  const hs = h.horairesDe(spec.contact), m = h.horairesMachine(hs);
  return m ? '<p class="' + cls + '" data-horaires="' + h.esc(m) + '"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(heures(h.resumeHoraires(hs) || 'Nos horaires')) + '</span></p>' : '';
}
// « Zone de la Lézarde, Le Lamentin, Martinique » → « Zone de la Lézarde » (la commune est dite à côté)
function sansCommune(ad, com) {
  let x = net(ad).replace(/,?\s*Martinique$/i, '');
  const k = x.toLowerCase().lastIndexOf(String(com).toLowerCase());
  if (k > 0 && k + com.length === x.length) x = x.slice(0, k).replace(/[\s,]*(972\d{2})?[\s,]*$/, '');
  return x.trim();
}
function avecInfos(ctx) { return !!(ctx.compo && (ctx.compo.blocs || []).some(function (b) { return b.rubrique === 'infos'; })); }
const CSS_POINT = function (cls, sel) { return `
.${cls} ${sel}{display:inline-flex;align-items:center;gap:12px;font-weight:var(--fxf)}
.${cls} ${sel} i{width:10px;height:10px;flex:none;border-radius:50%;background:currentColor;opacity:.45;outline:2px solid color-mix(in srgb,currentColor 60%,transparent);outline-offset:2px}
.${cls}.est-ouvert ${sel} i,.${cls} .est-ouvert${sel} i{background:#16a34a;opacity:1;box-shadow:0 0 0 0 rgb(22 163 74 / .55);animation:k-${cls.slice(2)}-pouls 2s infinite}
.${cls}.est-ferme ${sel} i,.${cls} .est-ferme${sel} i{background:#dc2626;opacity:1}
@keyframes k-${cls.slice(2)}-pouls{70%{box-shadow:0 0 0 .55em rgb(22 163 74 / 0)}100%{box-shadow:0 0 0 0 rgb(22 163 74 / 0)}}
@media(prefers-reduced-motion:reduce){.${cls} ${sel} i{animation:none!important}}
`; };
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
// pendant le choix : le bandeau compte s'il est possible et que la bande d'appel en photo ne le prend pas
function bandeauLibre(ctx) { return bandeauPossible(ctx) && !(ctx.compo && (ctx.compo.blocs || []).some(function (x) { return x.id === 'appel.photo'; })) ? ctx.alloc.bandeau : null; }
// au rendu : la photo de ce contact sur les autres pages si elle n'a pas paru plus haut sur celle-ci, sinon une photo
// encore libre (prise et notée), sinon le bandeau s'il n'a pas paru ; aucune s'il n'en reste pas (le contact cède alors la
// place à celui du socle, sans cadre vide)
function photoContact(ctx) {
  const h = ctx.h, b = ctx.alloc.bandeau, vue = function (p) { return !!(h.vue && h.vue(p)); };
  ctx.photosRubriques = ctx.photosRubriques || {};
  const avant = ctx.photosRubriques.contact;
  if (avant && !vue(avant)) return avant;
  const p = (h.photos && h.photos(1)[0]) || (b && !vue(b) ? b : null);
  if (p) ctx.photosRubriques.contact = p;
  return p || null;
}

/* ── 1. le formulaire qui prépare le message ── */
const COMMUNES = MQ.COMMUNES.map(function (c) { return c[0]; });
const CHAMP_BESOIN = {
  devis: { label: 'Votre besoin', q: 'Mon besoin', intro: 'Je voudrais un devis.' },
  appel: { label: 'Votre question', q: 'Ma question', intro: 'Pouvez-vous me rappeler ?', ph: 'En quelques mots' },
  reservation: { label: 'Votre demande', q: 'Ma demande', intro: 'Je voudrais réserver.', ph: 'Le jour et l\'heure qui vous vont' },
  visite: { label: 'Votre demande', q: 'Ma demande', intro: '' },
  inscription: { label: 'Votre demande', q: 'Ma demande', intro: 'Je voudrais des informations pour une inscription.' }
};
const formulaire = {
  id: 'contact.formulaire', rubrique: 'contact', nom: 'Formulaire qui prépare le message', quand: 'un portable (WhatsApp) ou un email : les moyens de contact à gauche, à droite un formulaire de trois champs dont le message se compose sous les yeux, puis s\'ouvre dans WhatsApp ou la messagerie (rien n\'est envoyé par le site)',
  surfaces: ['surface', 'fond', 'champ'], js: ['formulaire', 'ouvert'],
  besoin: function (spec, ctx) { return moyens(spec, ctx).some(function (x) { return x.cle === 'wa' || x.cle === 'mail'; }); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), c = spec.contact || {}, o = h.objectif(spec);
    const wa = m.find(function (x) { return x.cle === 'wa'; }), numWa = wa ? (wa.href.match(/wa\.me\/(\d+)/) || [])[1] : null;
    if (!numWa && !c.email) return '';
    const cb = CHAMP_BESOIN[spec.objectif] || CHAMP_BESOIN.devis;
    const sv = h.servicesDe(spec).map(function (s) { return h.net(s.titre); }).filter(function (t) { return t.length <= 32; }).slice(0, 4);
    const ph = cb.ph || (sv.length >= 2 ? sv.slice(0, 2).join(', ') + '…' : 'En quelques mots');
    const intro = 'Bonjour, je viens de votre site.' + (cb.intro ? ' ' + cb.intro : '');
    const cible = numWa ? ' data-wa="' + h.esc(numWa) + '" action="https://wa.me/' + h.esc(numWa) + '" method="get" target="_blank"' : ' data-mail="' + h.esc(c.email) + '" data-sujet="' + h.esc(o.sujet + ' : ' + h.net(spec.nom)) + '" action="mailto:' + h.esc(c.email) + '" method="post" enctype="text/plain"';
    const champ = function (id, label, q, extra, zone) { return '<div class="cf-ch">' + (zone ? '<textarea id="' + id + '" name="' + id.slice(3) + '" data-q="' + h.esc(q) + '" rows="2"' + extra + ' placeholder=" "></textarea>' : '<input id="' + id + '" name="' + id.slice(3) + '" data-q="' + h.esc(q) + '"' + extra + ' placeholder=" ">') + '<label for="' + id + '">' + h.esc(label) + '</label></div>'; };
    const puces = sv.length >= 2 ? '<div class="cf-puces" role="group" aria-label="Exemples de demande">' + sv.map(function (t) { return '<button type="button" data-puce="' + h.esc(t) + '">' + h.esc(t) + '</button>'; }).join('') + '</div>' : '';
    const liste = m.map(function (x, k) { return ligne(h, x, 'cf', k + 1); }).join('');
    return '<section class="' + h.classes('contact.formulaire', bloc, 'sec') + '" id="contact">' + h.fond(bloc) + '<div class="w cf">' +
      '<div class="cf-g">' + titre(ctx, bloc, 'cf-t') + '<p class="cf-p"' + h.rv('monte', 1) + '>' + h.esc(fr(phrase(spec, ctx, m))) + '</p><ul class="cf-l">' + liste + '</ul>' + etatHoraires(h, spec, 'cf-e') + '</div>' +
      '<form class="cf-form" data-formulaire data-intro="' + h.esc(intro) + '"' + cible + h.rv('monte', 2) + '>' +
      '<div class="cf-bulle" aria-hidden="true"><span class="cf-qui">' + h.icone(numWa ? 'whatsapp' : 'mail') + (numWa ? 'Votre message' : 'Votre email') + '</span><p class="cf-apercu">' + h.esc(intro) + '</p></div>' +
      champ('cf-besoin', cb.label, cb.q, ' required autocomplete="off"', true) + puces +
      '<div class="cf-deux">' + champ('cf-commune', 'Votre commune', 'Ma commune', ' list="cf-communes" autocomplete="address-level2"') + champ('cf-prenom', 'Votre prénom', 'Mon prénom', ' autocomplete="given-name"') + '</div>' +
      '<button class="btn b1" type="submit">' + h.contenuBouton(numWa ? 'whatsapp' : 'mail', numWa ? 'Préparer mon message' : 'Préparer mon email') + '</button>' +
      '<p class="cf-note">' + h.icone('cadenas') + '<span>' + (numWa ? 'Rien n\'est envoyé par ce site\u00a0: le message s\'ouvre dans WhatsApp, vous le relisez et vous l\'envoyez.' : 'Rien n\'est envoyé par ce site\u00a0: l\'email s\'ouvre dans votre messagerie, vous le relisez et vous l\'envoyez.') + '</span></p>' +
      '<datalist id="cf-communes">' + COMMUNES.map(function (x) { return '<option value="' + h.esc(x) + '"></option>'; }).join('') + '</datalist></form></div></section>';
  },
  // l'aperçu du message se compose à mesure qu'on écrit ; les exemples remplissent le premier champ
  script: "[].slice.call(d.querySelectorAll('.r-contact-formulaire [data-formulaire]')).forEach(function(f){var ap=f.querySelector('.cf-apercu'),cs=[].slice.call(f.querySelectorAll('[data-q]'));" +
    "var maj=function(){if(!ap)return;var l=[f.getAttribute('data-intro')||'Bonjour,'];cs.forEach(function(c){var v=(c.value||'').trim();if(v)l.push(c.getAttribute('data-q')+' : '+v)});ap.textContent=l.join('\\n');f.classList.toggle('rempli',l.length>1)};" +
    "cs.forEach(function(c){c.addEventListener('input',maj)});[].slice.call(f.querySelectorAll('[data-puce]')).forEach(function(b){b.addEventListener('click',function(){if(!cs[0])return;cs[0].value=b.getAttribute('data-puce');maj();if(cs[1])cs[1].focus()})});" +
    "f.addEventListener('submit',function(){f.classList.add('pret')});maj()});" + insecHeures('r-contact-formulaire'),
  css: function () { return `
${libre('r-contact-formulaire')}
.r-contact-formulaire .cf{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(34px,5.5vw,90px);align-items:start}
.r-contact-formulaire .cf-g{display:grid;gap:20px;align-content:start}
.r-contact-formulaire .cf-t{font-size:clamp(var(--h2a),4vw,calc(var(--h2b) * 1.05));line-height:1.02}
.r-contact-formulaire .cf-p{color:var(--tx2);font-size:1.08rem;max-width:42ch}
.r-contact-formulaire .cf-l{display:grid;margin-top:6px}
.r-contact-formulaire .cf-l li+li{border-top:1px solid var(--bord)}
.r-contact-formulaire .cf-a{display:flex;align-items:center;gap:16px;padding:14px 0;color:var(--tx);text-decoration:none;min-width:0}
.r-contact-formulaire .cf-ic{width:46px;height:46px;flex:none;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--acc) 12%,transparent);color:var(--accT);transition:background-color .35s,color .35s,transform .5s var(--ease)}
.r-contact-formulaire .cf-tx{display:grid;gap:1px;min-width:0;flex:1}
.r-contact-formulaire .cf-tx small{font-size:.95rem;color:var(--tx2)}
.r-contact-formulaire .cf-tx b{font-weight:var(--fxf);font-size:1.06rem;overflow-wrap:anywhere}
.r-contact-formulaire .cf-f{opacity:0;width:0;flex:none;color:var(--accT);transition:opacity .3s,width .45s var(--ease)}
.r-contact-formulaire a.cf-a:hover .cf-ic{background:var(--btn);color:var(--btnT);transform:rotate(-8deg)}
.r-contact-formulaire a.cf-a:hover .cf-f{opacity:1;width:22px}
.r-contact-formulaire .cf-e{color:var(--tx2)}
.r-contact-formulaire .cf-form{display:grid;gap:14px;background:var(--carte);border:1px solid var(--bord);border-radius:calc(var(--r) * 1.4 + 8px);padding:clamp(20px,3vw,38px);box-shadow:var(--ombreF);color:var(--tx)}
.r-contact-formulaire .cf-bulle{position:relative;justify-self:end;max-width:min(100%,440px);padding:12px 16px 14px;border-radius:16px 4px 16px 16px;background:color-mix(in srgb,var(--btn) 12%,var(--carte));border:1px solid color-mix(in srgb,var(--btn) 28%,transparent);margin-bottom:6px}
.r-contact-formulaire .cf-qui{display:flex;align-items:center;gap:8px;font-size:.95rem;font-weight:var(--fxf);color:var(--accT);margin-bottom:4px}
.r-contact-formulaire .cf-qui .ic{width:16px;height:16px}
.r-contact-formulaire .cf-apercu{white-space:pre-line;font-size:1rem;line-height:1.5;color:var(--tx);min-height:1.5em;overflow-wrap:anywhere}
.r-contact-formulaire .cf-ch{position:relative}
.r-contact-formulaire .cf-ch input,.r-contact-formulaire .cf-ch textarea{display:block;width:100%;min-height:60px;padding:24px 16px 8px;border:1.5px solid var(--bord);border-radius:calc(var(--rb) + 6px);background:var(--bg);color:var(--tx);font:inherit;font-size:1.02rem;line-height:1.4;resize:vertical;transition:border-color .3s,box-shadow .3s}
.r-contact-formulaire .cf-ch textarea{min-height:88px}
.r-contact-formulaire .cf-ch label{position:absolute;left:17px;top:18px;font-size:1rem;color:var(--tx2);pointer-events:none;transform-origin:left top;transition:transform .35s var(--ease),color .3s}
.r-contact-formulaire .cf-ch input:focus+label,.r-contact-formulaire .cf-ch textarea:focus+label,.r-contact-formulaire .cf-ch input:not(:placeholder-shown)+label,.r-contact-formulaire .cf-ch textarea:not(:placeholder-shown)+label{transform:translateY(-10px) scale(.82);color:var(--accT);font-weight:var(--fxf)}
.r-contact-formulaire .cf-ch input:focus,.r-contact-formulaire .cf-ch textarea:focus{outline:0;border-color:var(--acc);box-shadow:0 0 0 4px color-mix(in srgb,var(--acc) 18%,transparent)}
.r-contact-formulaire .cf-deux{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.r-contact-formulaire .cf-puces{display:none;flex-wrap:wrap;gap:8px;margin-top:-4px}
.js .r-contact-formulaire .cf-puces{display:flex}
.r-contact-formulaire .cf-puces button{min-height:44px;padding:0 15px;border-radius:999px;border:1px solid var(--bord);background:transparent;color:var(--tx);font:inherit;font-size:.96rem;cursor:pointer;transition:border-color .3s,background-color .3s,transform .4s var(--ease)}
.r-contact-formulaire .cf-puces button:hover{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 10%,transparent);transform:translateY(-2px)}
.r-contact-formulaire .cf-form .btn{width:100%;min-height:60px;margin-top:4px}
.r-contact-formulaire .cf-note{display:flex;gap:10px;align-items:flex-start;color:var(--tx2);font-size:.95rem}
.r-contact-formulaire .cf-note .ic{width:18px;height:18px;margin-top:3px;color:var(--accT)}
${CSS_POINT('r-contact-formulaire', '.cf-e')}
@media(max-width:900px){.r-contact-formulaire .cf{grid-template-columns:1fr}}
@media(max-width:480px){.r-contact-formulaire .cf-deux{grid-template-columns:1fr}.r-contact-formulaire .cf-bulle{max-width:100%}}
`; }
};

/* ── 2. les moyens de contact en très grandes lettres ── */
const geant = {
  id: 'contact.geant', rubrique: 'contact', nom: 'Les moyens en très grand', quand: 'toujours possible, sites à forte typographie : WhatsApp, le numéro, l\'email et la commune en très grandes lettres qui roulent au survol',
  surfaces: ['fond', 'surface', 'champ'], js: ['ouvert'], script: insecHeures('r-contact-geant'),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), ty = ctx.type;
    const lignes = m.filter(function (x) { return x.cle !== 'zone'; }).map(function (x, k) {
      const v = x.cle === 'adresse' ? (x.commune || x.valeur) : x.cle === 'wa' ? 'WhatsApp' : x.valeur;
      // l'adresse : la commune en grand, la rue au-dessus (sinon « Où nous sommes », « Nous trouver »)
      const rue = x.cle === 'adresse' && x.commune ? sansCommune(x.valeur, x.commune) : '';
      const e = x.cle === 'adresse' ? (rue && rue !== x.commune ? rue : (x.etiquette === 'Nous trouver' ? 'Nous trouver' : 'Où nous sommes')) : x.action;
      const hk = ((v.length + 1) * ty.chasse * 1.2).toFixed(2);
      const corps = '<span class="cg-e">' + h.esc(e) + '</span><span class="cg-v" style="--hk:' + hk + '"><span class="cg-1">' + h.esc(v) + '</span><span class="cg-2" aria-hidden="true">' + h.esc(v) + '</span></span>' + (x.href ? '<span class="cg-f" aria-hidden="true">' + h.icone(x.cle === 'adresse' ? 'carte' : 'fleche') + '</span>' : '');
      return '<li class="cq"' + h.rv('monte', k + 1) + '>' + (x.href ? '<a class="cg-a" href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + corps + '</a>' : '<div class="cg-a">' + corps + '</div>') + '</li>';
    }).join('');
    const z = m.find(function (x) { return x.cle === 'zone'; });
    const bas = [etatHoraires(h, spec, 'cg-e2'), z ? '<p class="cg-z">' + h.icone('carte') + '<span>' + h.esc(z.valeur) + '</span></p>' : ''].join('');
    return '<section class="' + h.classes('contact.geant', bloc, 'sec') + '" id="contact">' + h.fond(bloc) + '<div class="w">' +
      '<div class="cg-tete">' + titre(ctx, bloc, 'cg-t') + '<p' + h.rv('monte', 1) + '>' + h.esc(fr(phrase(spec, ctx, m))) + '</p></div><ul class="cg-l">' + lignes + '</ul>' + (bas ? '<div class="cg-bas"' + h.rv('monte', 2) + '>' + bas + '</div>' : '') + '</div></section>';
  },
  css: function () { return `
${libre('r-contact-geant')}
.r-contact-geant .cg-tete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:14px 40px;margin-bottom:clamp(26px,3.6vw,50px)}
.r-contact-geant .cg-t{font-size:clamp(var(--h2a),3.7vw,var(--h2b));line-height:1.02}
.r-contact-geant .cg-tete p{color:var(--tx2);font-size:1.08rem;max-width:40ch}
.r-contact-geant .cg-l li{border-top:1px solid var(--bord)}
.r-contact-geant .cg-l li:last-child{border-bottom:1px solid var(--bord)}
.r-contact-geant .cg-a{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:4px 24px;padding:clamp(16px,2vw,26px) 0;color:var(--tx);text-decoration:none}
.r-contact-geant .cg-a::before{content:"";position:absolute;left:0;top:-1px;height:2px;width:100%;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform .8s var(--ease)}
.r-contact-geant .cg-e{grid-column:1/-1;font-size:.98rem;font-weight:var(--fxf);color:var(--tx2)}
.r-contact-geant .cg-v{display:grid;overflow:hidden;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);line-height:1.02;padding-bottom:.06em;white-space:nowrap;font-size:max(1.7rem,min(clamp(2.6rem,8vw,7.6rem),calc(100cqi / var(--hk))))}
.r-contact-geant .cg-1,.r-contact-geant .cg-2{grid-area:1/1;transition:transform .7s var(--ease)}
.r-contact-geant .cg-2{color:var(--accT);transform:translateY(108%)}
.r-contact-geant .cg-f{display:grid;place-items:center;width:clamp(48px,5vw,72px);height:clamp(48px,5vw,72px);border-radius:50%;border:1.5px solid var(--bord);color:var(--tx);transform:rotate(-45deg);transition:transform .7s var(--ease),background-color .4s,color .4s,border-color .4s;margin-bottom:.4em}
.r-contact-geant .cg-f .ic{width:44%;height:44%}
.r-contact-geant a.cg-a:hover::before,.r-contact-geant a.cg-a:focus-visible::before{transform:none}
.r-contact-geant a.cg-a:hover .cg-1,.r-contact-geant a.cg-a:focus-visible .cg-1{transform:translateY(-108%)}
.r-contact-geant a.cg-a:hover .cg-2,.r-contact-geant a.cg-a:focus-visible .cg-2{transform:none}
.r-contact-geant a.cg-a:hover .cg-f,.r-contact-geant a.cg-a:focus-visible .cg-f{transform:none;background:var(--btn);border-color:var(--btn);color:var(--btnT)}
.r-contact-geant .cg-bas{display:flex;flex-wrap:wrap;align-items:center;gap:12px 36px;margin-top:clamp(20px,2.6vw,32px);color:var(--tx2)}
.r-contact-geant .cg-z{display:flex;align-items:flex-start;gap:10px;max-width:60ch}
.r-contact-geant .cg-z .ic{margin-top:3px;color:var(--accT)}
${CSS_POINT('r-contact-geant', '.cg-e2')}
@media(max-width:600px){.r-contact-geant .cg-f{display:none}.r-contact-geant .cg-a{grid-template-columns:1fr}}
`; }
};

/* ── 3. la photo d'un côté, le panneau de contact de l'autre ── */
const photo = {
  id: 'contact.photo', rubrique: 'contact', nom: 'Photo et panneau', quand: 'une photo encore libre : la photo à fond perdu d\'un côté, le panneau de contact de l\'autre (moyens, boutons, horaires)',
  surfaces: ['surface', 'fond', 'champ'], js: ['ouvert'], fonds: false, script: insecHeures('r-contact-photo'),
  besoin: function (spec, ctx) { return photosLibres(ctx).length > 0 || !!bandeauLibre(ctx); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), p = photoContact(ctx);
    if (!p) return '';
    const liste = m.filter(function (x) { return x.cle !== 'wa'; }).map(function (x, k) { return ligne(h, x, 'cp', k + 2); }).join('');
    return '<section class="' + h.classes('contact.photo', bloc) + '" id="contact"><div class="cp"><div class="cp-ph"' + h.rv('rideau') + '>' + h.figure(p, 'lazy', '(max-width:860px) 100vw, 50vw') + '</div>' +
      '<div class="cp-pan">' + titre(ctx, bloc, 'cp-t') + '<p class="cp-p"' + h.rv('monte', 1) + '>' + h.esc(fr(phrase(spec, ctx, m))) + '</p>' + (liste ? '<ul class="cp-l">' + liste + '</ul>' : '') +
      '<div' + h.rv('monte', 3) + '>' + h.boutons(spec, { seule: true }) + '</div>' + etatHoraires(h, spec, 'cp-e') + '</div></div></section>';
  },
  css: function () { return `
${libre('r-contact-photo')}
.r-contact-photo .cp{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:clamp(560px,72vh,780px)}
.r-contact-photo .cp-ph{position:relative;min-height:100%}
.r-contact-photo .cp-ph .ph{position:absolute;inset:0;border-radius:0}
.r-contact-photo .cp-ph::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 60%,color-mix(in srgb,var(--bg) 22%,transparent));pointer-events:none}
.r-contact-photo .cp-pan{display:grid;gap:22px;align-content:center;justify-items:start;padding:clamp(56px,7vw,110px) max(var(--g),calc((100vw - var(--w)) / 2)) clamp(56px,7vw,110px) clamp(34px,5.5vw,96px)}
.r-contact-photo .cp-t{font-size:clamp(var(--h2a),4vw,calc(var(--h2b) * 1.05));line-height:1.02;max-width:14ch}
.r-contact-photo .cp-p{color:var(--tx2);font-size:1.08rem;max-width:40ch}
.r-contact-photo .cp-l{display:grid;width:100%;max-width:520px}
.r-contact-photo .cp-l li{border-top:1px solid var(--bord)}
.r-contact-photo .cp-l li:last-child{border-bottom:1px solid var(--bord)}
.r-contact-photo .cp-a{display:flex;align-items:center;gap:16px;padding:15px 0;color:var(--tx);text-decoration:none;min-width:0}
.r-contact-photo .cp-ic{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:var(--rb);background:var(--carte);border:1px solid var(--bord);color:var(--accT);transition:background-color .35s,color .35s,border-color .35s}
.r-contact-photo .cp-tx{display:grid;gap:1px;flex:1;min-width:0}
.r-contact-photo .cp-tx small{font-size:.95rem;color:var(--tx2)}
.r-contact-photo .cp-tx b{font-weight:var(--fxf);font-size:1.06rem;overflow-wrap:anywhere}
.r-contact-photo .cp-f{color:var(--accT);transform:translateX(-6px);opacity:0;transition:transform .5s var(--ease),opacity .3s}
.r-contact-photo a.cp-a:hover .cp-ic{background:var(--btn);border-color:var(--btn);color:var(--btnT)}
.r-contact-photo a.cp-a:hover .cp-f{transform:none;opacity:1}
.r-contact-photo .cp-e{color:var(--tx2)}
${CSS_POINT('r-contact-photo', '.cp-e')}
@media(max-width:860px){.r-contact-photo .cp{grid-template-columns:1fr;min-height:0}.r-contact-photo .cp-ph{aspect-ratio:4/3}.r-contact-photo .cp-ph::after{display:none}.r-contact-photo .cp-pan{padding:clamp(40px,8vw,64px) var(--g) clamp(48px,10vw,72px)}}
`; }
};

/* ── 4. la bande de nuit, grands boutons, halo ── */
const nuit = {
  id: 'contact.nuit', rubrique: 'contact', nom: 'Bande de nuit, grands boutons', quand: 'toujours possible, en fin de page : une bande sombre, le titre qui monte mot à mot, de grandes tuiles d\'action, une lumière qui suit la souris',
  surfaces: ['champ', 'accent'], js: ['halo', 'ouvert'], script: insecHeures('r-contact-nuit'),
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx);
    const tuiles = m.filter(function (x) { return x.href && x.cle !== 'adresse'; }).map(function (x, k) {
      return '<a class="cn-u' + (k === 0 ? ' cn-1' : '') + '" href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + h.rv('monte', k + 2) + '><span class="cn-ic">' + h.icone(x.icone) + '</span><span class="cn-tx"><small>' + h.esc(x.etiquette) + '</small><b' + (x.valeur.length > 17 ? ' class="cn-long"' : '') + '>' + h.esc(x.valeur) + '</b></span><span class="cn-f" aria-hidden="true">' + h.icone('fleche') + '</span></a>';
    }).join('');
    const ad = m.find(function (x) { return x.cle === 'adresse'; });
    const infos = [ad ? (ad.href ? '<a href="' + h.esc(ad.href) + '" target="_blank" rel="noopener">' + h.icone('pin') + '<span>' + h.esc(ad.valeur) + '</span></a>' : '<span>' + h.icone('pin') + '<span>' + h.esc(ad.valeur) + '</span></span>') : '', etatHoraires(h, spec, 'cn-e')].filter(Boolean).join('');
    return '<section class="' + h.classes('contact.nuit', bloc, 'sec') + '" id="contact" data-halo>' + h.fond(bloc) + '<div class="cn-halo" aria-hidden="true"></div><div class="w cn">' + titre(ctx, bloc, 'cn-t', true) +
      '<p class="cn-p"' + h.rv('monte', 1) + '>' + h.esc(fr(phrase(spec, ctx, m))) + '</p><div class="cn-tuiles n' + Math.min(3, m.filter(function (x) { return x.href && x.cle !== 'adresse'; }).length) + '">' + tuiles + '</div>' + (infos ? '<div class="cn-infos"' + h.rv('monte', 5) + '>' + infos + '</div>' : '') + '</div></section>';
  },
  css: function () { return `
${libre('r-contact-nuit')}
.r-contact-nuit{overflow:hidden;text-align:center}
.r-contact-nuit .cn-halo{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(640px circle at var(--mx,50%) var(--my,18%),color-mix(in srgb,var(--btn) 24%,transparent),transparent 62%),radial-gradient(90% 60% at 50% 120%,color-mix(in srgb,var(--btn) 18%,transparent),transparent 70%)}
.r-contact-nuit .cn{display:grid;justify-items:center;gap:clamp(18px,2.4vw,28px)}
.r-contact-nuit .cn-t{font-size:clamp(2.4rem,7vw,6.2rem);line-height:.98;max-width:14ch}
.r-contact-nuit .cn-p{color:var(--tx2);font-size:clamp(1.05rem,1.4vw,1.22rem);max-width:46ch}
.r-contact-nuit .cn-tuiles{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:14px;width:100%;max-width:1080px;margin-top:clamp(10px,2vw,24px);text-align:left}
.r-contact-nuit .cn-tuiles.n1{--n:1;max-width:520px}.r-contact-nuit .cn-tuiles.n2{--n:2;max-width:820px}
.r-contact-nuit .cn-u{position:relative;display:flex;align-items:center;gap:16px;min-height:96px;padding:20px 22px;border-radius:calc(var(--r) * 1.4 + 6px);background:var(--carte);border:1px solid var(--bord);color:var(--tx);text-decoration:none;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:transform .55s var(--ease),border-color .4s,box-shadow .55s var(--ease)}
.r-contact-nuit .cn-1{background:var(--btn);color:var(--btnT);border-color:transparent;box-shadow:0 24px 50px -24px color-mix(in srgb,var(--btn) 80%,#000)}
.r-contact-nuit .cn-ic{width:52px;height:52px;flex:none;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,currentColor 12%,transparent)}
.r-contact-nuit .cn-ic .ic{width:24px;height:24px}
.r-contact-nuit .cn-tx{display:grid;gap:2px;min-width:0;flex:1}
.r-contact-nuit .cn-tx small{font-size:.95rem;opacity:.8}
.r-contact-nuit .cn-tx b{font-family:var(--ft);font-weight:var(--tp);letter-spacing:max(var(--ti),-0.012em);word-spacing:.06em;font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.12rem,1.7vw,1.42rem);line-height:1.15;overflow-wrap:anywhere}
.r-contact-nuit .cn-tx b.cn-long{font-family:var(--fx);font-weight:var(--fxf);letter-spacing:0;font-variation-settings:var(--fxr);font-stretch:normal;font-size:1.05rem}
.r-contact-nuit .cn-f{flex:none;transition:transform .5s var(--ease)}
.r-contact-nuit .cn-u:hover{transform:translateY(-5px);border-color:color-mix(in srgb,var(--tx) 40%,transparent)}
.r-contact-nuit .cn-u:hover .cn-f{transform:translateX(5px)}
.r-contact-nuit .cn-infos{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 32px;margin-top:clamp(6px,1.4vw,16px);color:var(--tx2)}
.r-contact-nuit .cn-infos a,.r-contact-nuit .cn-infos>span{display:inline-flex;align-items:center;gap:10px;min-height:44px;max-width:100%;text-align:left;color:var(--tx2);text-decoration:none}
.r-contact-nuit .cn-infos a:hover span{color:var(--tx);text-decoration:underline}
.r-contact-nuit .cn-infos .ic{color:var(--accT)}
${CSS_POINT('r-contact-nuit', '.cn-e')}
@media(max-width:860px){.r-contact-nuit .cn-tuiles,.r-contact-nuit .cn-tuiles.n2{grid-template-columns:1fr;max-width:520px}}
`; }
};

/* ── 5. une seule carte élégante, centrée ── */
const carte = {
  id: 'contact.carte', rubrique: 'contact', nom: 'Carte de visite', quand: 'toujours possible, métiers soignés (cabinets, soins, boutiques) : une seule carte de visite centrée, au nom de l\'entreprise, qui s\'incline vers la souris',
  surfaces: ['surface', 'fond', 'champ'], js: ['inclinaison', 'ouvert'],
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), nom = h.net(spec.nom);
    const liste = m.map(function (x) { return ligne(h, x, 'cc', null); }).join('');
    return '<section class="' + h.classes('contact.carte', bloc, 'sec') + '" id="contact">' + h.fond(bloc) + '<div class="w">' +
      '<div class="cc-tete">' + titre(ctx, bloc, 'cc-t') + '<p' + h.rv('monte', 1) + '>' + h.esc(fr(phrase(spec, ctx, m))) + '</p></div>' +
      '<div class="cc-scene"' + h.rv('zoom', 2) + '><article class="cc-c" data-tilt><span class="cc-reflet" aria-hidden="true"></span>' +
      '<div class="cc-haut"><span class="cc-sceau" aria-hidden="true">' + h.esc(h.initiale(nom)) + '</span><div class="cc-id"><p class="cc-nom">' + h.esc(nom) + '</p>' + (ctx.ligneMetier ? '<p class="cc-metier">' + h.esc(ctx.ligneMetier) + '</p>' : '') + '</div></div>' +
      '<ul class="cc-l n' + m.length + '">' + liste + '</ul><div class="cc-bas">' + h.boutons(spec) + etatHoraires(h, spec, 'cc-e') + '</div></article></div></div></section>';
  },
  // le reflet suit la souris sur la carte (la carte s'incline grâce au module « inclinaison »)
  script: "if(!calme&&w.matchMedia('(hover:hover) and (pointer:fine)').matches){[].slice.call(d.querySelectorAll('.r-contact-carte .cc-c')).forEach(function(c){c.addEventListener('pointermove',function(v){var r=c.getBoundingClientRect();c.style.setProperty('--lx',((v.clientX-r.left)/r.width*100).toFixed(1)+'%');c.style.setProperty('--ly',((v.clientY-r.top)/r.height*100).toFixed(1)+'%')})})};" + insecHeures('r-contact-carte'),
  css: function () { return `
${libre('r-contact-carte')}
.r-contact-carte .cc-tete{display:grid;justify-items:center;text-align:center;gap:16px;margin-bottom:clamp(30px,4vw,56px)}
.r-contact-carte .cc-t{font-size:clamp(var(--h2a),3.7vw,var(--h2b));line-height:1.02}
.r-contact-carte .cc-tete p{color:var(--tx2);font-size:1.08rem;max-width:46ch}
.r-contact-carte .cc-scene{max-width:820px;margin-inline:auto;perspective:1200px}
.r-contact-carte .cc-c{position:relative;overflow:hidden;isolation:isolate;background:var(--carte);color:var(--tx);border:1px solid var(--bord);border-radius:calc(var(--r) * 1.6 + 10px);padding:clamp(26px,4vw,54px);box-shadow:var(--ombreF);transition:transform .6s var(--ease),box-shadow .6s var(--ease);will-change:transform}
.r-contact-carte .cc-c::before{content:"";position:absolute;right:-90px;top:-90px;width:320px;height:320px;z-index:-1;border-radius:50%;background:repeating-radial-gradient(circle,transparent 0 13px,color-mix(in srgb,var(--acc) 22%,transparent) 13px 14px);-webkit-mask-image:radial-gradient(circle,#000 30%,transparent 70%);mask-image:radial-gradient(circle,#000 30%,transparent 70%)}
.r-contact-carte .cc-reflet{position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient(420px circle at var(--lx,30%) var(--ly,0%),rgb(255 255 255 / .16),transparent 60%);opacity:0;transition:opacity .4s}
.r-contact-carte .cc-c:hover .cc-reflet{opacity:1}
.r-contact-carte .cc-haut{display:flex;align-items:center;gap:20px;padding-bottom:clamp(20px,2.6vw,30px);border-bottom:1px solid var(--bord)}
.r-contact-carte .cc-sceau{width:clamp(64px,7vw,84px);aspect-ratio:1;flex:none;display:grid;place-items:center;border-radius:50%;background:var(--btn);color:var(--btnT);font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:clamp(1.9rem,3.4vw,2.6rem);line-height:1;box-shadow:0 0 0 6px color-mix(in srgb,var(--btn) 16%,transparent)}
.r-contact-carte .cc-id{display:grid;gap:4px;min-width:0}
.r-contact-carte .cc-nom{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.6rem,3vw,2.4rem);line-height:1.04;overflow-wrap:anywhere}
.r-contact-carte .cc-metier{color:var(--tx2)}
.r-contact-carte .cc-l{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 clamp(18px,3vw,40px);padding-block:clamp(10px,1.6vw,18px)}
.r-contact-carte .cc-l li{border-bottom:1px solid color-mix(in srgb,var(--bord) 70%,transparent);min-width:0}
.r-contact-carte .cc-a{display:flex;align-items:center;gap:14px;padding:14px 0;color:var(--tx);text-decoration:none;min-width:0}
.r-contact-carte .cc-ic{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:50%;border:1.5px solid var(--bord);color:var(--accT);transition:background-color .35s,color .35s,border-color .35s}
.r-contact-carte .cc-ic .ic{width:19px;height:19px}
.r-contact-carte .cc-tx{display:grid;gap:1px;flex:1;min-width:0}
.r-contact-carte .cc-tx small{font-size:.95rem;color:var(--tx2)}
.r-contact-carte .cc-tx b{font-weight:var(--fxf);font-size:1.02rem;overflow-wrap:anywhere}
.r-contact-carte .cc-f{display:none}
.r-contact-carte a.cc-a:hover .cc-ic{background:var(--btn);border-color:var(--btn);color:var(--btnT)}
.r-contact-carte .cc-bas{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px 28px;padding-top:clamp(18px,2.4vw,26px)}
.r-contact-carte .cc-e{color:var(--tx2)}
${CSS_POINT('r-contact-carte', '.cc-e')}
@media(max-width:700px){.r-contact-carte .cc-l{grid-template-columns:1fr}.r-contact-carte .cc-haut{gap:14px}}
`; }
};

/* ── 6. le contact selon l'état ouvert ou fermé ── */
const horaires = {
  id: 'contact.horaires', rubrique: 'contact', nom: 'Contact selon l\'heure', quand: 'des horaires connus : l\'état ouvert ou fermé mis en avant ; ouvert, l\'appel passe en premier, fermé, WhatsApp passe en premier',
  surfaces: ['fond', 'surface', 'champ'], js: ['ouvert'], script: insecHeures('r-contact-horaires'),
  besoin: function (spec, ctx) { return !!ctx.h.horairesMachine(ctx.h.horairesDe(spec.contact)) && moyens(spec, ctx).some(function (x) { return x.cle === 'tel' || x.cle === 'wa' || x.cle === 'mail'; }); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, m = moyens(spec, ctx), hs = h.horairesDe(spec.contact), mach = h.horairesMachine(hs);
    if (!mach) return '';
    const wa = m.find(function (x) { return x.cle === 'wa'; }), tel = m.find(function (x) { return x.cle === 'tel'; }), mail = m.find(function (x) { return x.cle === 'mail'; });
    const bt = function (x, cls) { return x ? '<a class="btn ' + cls + '" href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + h.contenuBouton(x.icone, x.cle === 'tel' ? 'Appeler le ' + x.valeur : x.action) + '</a>' : ''; };
    const premier = wa || mail;
    // deux ordres : ouvert (l'appel d'abord), fermé (le message d'abord) ; sans script, le message d'abord
    const ouvertO = '<div class="actions ch-o">' + bt(tel, 'b1') + bt(premier, tel ? 'b2' : 'b1') + '</div>';
    const fermeO = '<div class="actions ch-fe">' + bt(premier, 'b1') + bt(tel, premier ? 'b2' : 'b1') + '</div>';
    const conseil = '<p class="ch-c"><span class="ch-si-o">' + (tel ? 'C\'est le bon moment pour appeler.' : 'Écrivez-nous, on est là.') + '</span><span class="ch-si-f">' + (wa ? 'Vous pouvez déjà nous écrire sur WhatsApp.' : mail ? 'Vous pouvez déjà nous écrire un email.' : 'Appelez-nous aux heures d\'ouverture.') + '</span></p>';
    const semaine = avecInfos(ctx) ? '' : '<div class="ch-sem"' + h.rv('monte', 3) + '>' + heures(h.listeHoraires(hs)) + '</div>';
    const autres = m.filter(function (x) { return x.cle === 'adresse' || x.cle === 'zone' || (x.cle === 'mail' && wa); }).map(function (x, k) { return ligne(h, x, 'ch', k + 4); }).join('');
    return '<section class="' + h.classes('contact.horaires', bloc, 'sec') + '" id="contact" data-horaires="' + h.esc(mach) + '">' + h.fond(bloc) + '<div class="w ch">' +
      '<div class="ch-g">' + titre(ctx, bloc, 'ch-t') + '<div class="ch-etat"' + h.rv('monte', 1) + '><p class="ch-s"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(heures(h.resumeHoraires(hs) || 'Nos horaires')) + '</span></p>' + conseil + '</div>' + semaine + '</div>' +
      '<div class="ch-d"><div' + h.rv('monte', 2) + '>' + ouvertO + fermeO + '</div>' + (autres ? '<ul class="ch-l">' + autres + '</ul>' : '') + '</div></div></section>';
  },
  css: function () { return `
${libre('r-contact-horaires')}
.r-contact-horaires .ch{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(34px,6vw,100px);align-items:center}
.r-contact-horaires .ch-g{display:grid;gap:clamp(18px,2.4vw,26px)}
.r-contact-horaires .ch-t{font-size:clamp(var(--h2a),3.7vw,var(--h2b));line-height:1.02}
.r-contact-horaires .ch-etat{position:relative;display:grid;gap:10px;padding:clamp(20px,2.6vw,30px) clamp(22px,2.8vw,34px);border-radius:calc(var(--r) * 1.4 + 6px);background:var(--carte);border:1px solid var(--bord);overflow:hidden}
.r-contact-horaires .ch-etat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--bord);transition:background-color .5s}
.r-contact-horaires.est-ouvert .ch-etat::before{background:#16a34a}
.r-contact-horaires.est-ferme .ch-etat::before{background:#dc2626}
.r-contact-horaires .ch-s{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.5rem,2.8vw,2.4rem);line-height:1.08}
.r-contact-horaires .ch-etat .ch-s{align-items:flex-start}
.r-contact-horaires .ch-s i{width:.34em;height:.34em;margin-top:.36em}
.r-contact-horaires .ch-c{color:var(--tx2);font-size:1.05rem}
.r-contact-horaires .ch-si-o,.r-contact-horaires .ch-si-f{display:none}
.r-contact-horaires.est-ouvert .ch-si-o,.r-contact-horaires.est-ferme .ch-si-f{display:inline}
.r-contact-horaires .ch-sem{max-width:460px}
.r-contact-horaires .ch-sem .horaires li{padding:8px 0}
.r-contact-horaires .ch-d{display:grid;gap:clamp(20px,2.6vw,30px)}
.r-contact-horaires .ch-o{display:none}
.r-contact-horaires.est-ouvert .ch-o{display:flex}.r-contact-horaires.est-ouvert .ch-fe{display:none}
.r-contact-horaires .actions{flex-direction:column;align-items:stretch}
.r-contact-horaires .actions .btn{min-height:64px;font-size:1.08rem}
.r-contact-horaires .ch-l{display:grid}
.r-contact-horaires .ch-l li+li{border-top:1px solid var(--bord)}
.r-contact-horaires .ch-a{display:flex;align-items:center;gap:16px;padding:14px 0;color:var(--tx);text-decoration:none;min-width:0}
.r-contact-horaires .ch-ic{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--acc) 12%,transparent);color:var(--accT)}
.r-contact-horaires .ch-tx{display:grid;gap:1px;flex:1;min-width:0}
.r-contact-horaires .ch-tx small{font-size:.95rem;color:var(--tx2)}
.r-contact-horaires .ch-tx b{font-weight:var(--fxf);overflow-wrap:anywhere}
.r-contact-horaires .ch-f{color:var(--accT);opacity:0;transform:translateX(-6px);transition:opacity .3s,transform .5s var(--ease)}
.r-contact-horaires a.ch-a:hover .ch-f{opacity:1;transform:none}
${CSS_POINT('r-contact-horaires', '.ch-s')}
@media(max-width:860px){.r-contact-horaires .ch{grid-template-columns:1fr}}
`; }
};

module.exports = [formulaire, geant, photo, nuit, carte, horaires];
