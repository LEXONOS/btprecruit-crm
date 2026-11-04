// Les infos pratiques : les horaires et la zone, seulement ceux de la fiche. Quatre mises en scène : « ouvert
// maintenant » en très grand avec la semaine (le jour même en évidence), la semaine dessinée en barres avec le trait de
// l'heure qu'il est, la zone en pastilles autour d'un radar, la bande d'une ligne (ouvert, adresse, téléphone).
// L'heure est celle de la Martinique (UTC-4, sans heure d'été), calculée dans le navigateur.
'use strict';
const MQ = require('../../martinique');
// les heures ne se coupent jamais (« 18 h », « 7 h 30 ») : côté serveur, et après le module « ouvert » dans le navigateur
function heures(s) { return String(s == null ? '' : s).replace(/(\d) h\b/g, '$1\u00a0h').replace(/\bh (\d{2})\b/g, 'h\u00a0$1').replace(/([h\d]) – (?=\d)/g, '$1\u00a0–\u00a0').replace(/\b((?:lun|mar|mer|jeu|ven|sam|dim)\.?) – (?=(?:lun|mar|mer|jeu|ven|sam|dim))/gi, '$1\u00a0–\u00a0'); }
function insecHeures(cls) { return "[].slice.call(d.querySelectorAll('." + cls + " [data-ouvert-texte]')).forEach(function(t){t.textContent=t.textContent.replace(/(\\d) h/g,'$1\\u00a0h').replace(/à (\\d)/g,'à\\u00a0$1').replace(/h (\\d\\d)/g,'h\\u00a0$1')})"; }
// les apparitions communes finissent sur clip-path:inset(0) : levé ici, pour ne rogner ni ombres, ni anneaux, ni débords
function libre(cls) { return '.js .' + cls + ' [data-r].vu:not([data-r=rideau]):not([data-r=store]):not([data-r=iris]){clip-path:none}\n.' + cls + ' p{text-wrap:pretty}'; }
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
// la semaine jour par jour (null si les horaires ne se lisent pas, ou si rien n'est ouvert)
function semaine(h, spec) {
  const hs = h.horairesDe(spec.contact), j = h.lireJours(hs);
  if (!j || !j.some(function (x) { return x.plages.length; })) return null;
  const jours = []; for (let k = 0; k < 7; k++) jours.push(j.find(function (x) { return x.j === k; }) || null);
  return { hs: hs, jours: jours, mach: h.horairesMachine(hs), resume: h.resumeHoraires(hs) || 'Nos horaires' };
}
function adresse(spec) { const c = spec.contact || {}; return h2s(c.adresse) || (spec.commune ? spec.commune + ', Martinique' : ''); }
function h2s(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
// le jour d'aujourd'hui en Martinique, posé sur [data-jour] (le module « ouvert » dit seulement ouvert ou fermé)
function scriptJour(cls, marque) {
  return "(function(){var n=new Date(Date.now()-4*3600000),jr=(n.getUTCDay()+6)%7,mn=n.getUTCHours()*60+n.getUTCMinutes();[].slice.call(d.querySelectorAll('." + cls + " [data-jour]')).forEach(function(e){if(+e.getAttribute('data-jour')!==jr)return;e.classList.add('auj');e.setAttribute('aria-current','date');" + (marque || '') + "})})()";
}
const CSS_POINT = function (cls, sel) { return `
.${cls} ${sel} i{display:inline-block;flex:none;border-radius:50%;background:currentColor;opacity:.45;outline:2px solid color-mix(in srgb,currentColor 60%,transparent);outline-offset:2px}
.${cls}.est-ouvert ${sel} i,.${cls} .est-ouvert${sel} i{background:#16a34a;opacity:1;box-shadow:0 0 0 0 rgb(22 163 74 / .55);animation:k-${cls.slice(2)}-pouls 2s infinite}
.${cls}.est-ferme ${sel} i,.${cls} .est-ferme${sel} i{background:#dc2626;opacity:1}
@keyframes k-${cls.slice(2)}-pouls{70%{box-shadow:0 0 0 .5em rgb(22 163 74 / 0)}100%{box-shadow:0 0 0 0 rgb(22 163 74 / 0)}}
@media(prefers-reduced-motion:reduce){.${cls} ${sel} i{animation:none!important}}
`; };

/* ── 1. « ouvert maintenant » en très grand ── */
const ouvert = {
  id: 'infos.ouvert', rubrique: 'infos', nom: 'Ouvert maintenant, en grand', quand: 'des horaires connus, surtout pour les lieux où l\'on vient (table, boutique, garage, soins) : l\'état ouvert ou fermé en très grand, la semaine à côté, le jour même en évidence',
  surfaces: ['fond', 'surface', 'champ'], js: ['ouvert'],
  besoin: function (spec, ctx) { const s = semaine(ctx.h, spec); return !!(s && s.mach); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = semaine(h, spec), c = spec.contact || {};
    if (!s || !s.mach) return '';
    const hk = h.k2('Fermé, ouvre aujourd\'hui à 19 h 30', ctx.type);
    const jours = s.jours.map(function (x, k) { return '<li data-jour="' + k + '"' + (x && !x.plages.length ? ' class="ferme"' : '') + '><span class="io-j">' + JOURS[k] + '</span><span class="io-h">' + h.esc(heures(x ? x.v : 'Non précisé')) + '</span><span class="io-auj">Aujourd\'hui</span></li>'; }).join('');
    const ad = adresse(spec);
    return '<section class="' + h.classes('infos.ouvert', bloc, 'sec') + '" id="infos" data-horaires="' + h.esc(s.mach) + '">' + h.fond(bloc) + '<div class="w io">' +
      '<div class="io-g cq"' + h.rv('monte') + '><h2 class="t io-t"><span class="io-s"><i aria-hidden="true"></i>Nos horaires</span><span class="io-grand" style="--hk:' + hk + '" data-ouvert-texte>' + h.esc(heures(s.resume)) + '</span></h2>' +
      (ad ? '<p class="io-ad">' + h.icone('pin') + '<span>' + h.esc(ad) + '</span>' + (c.maps ? '<a href="' + h.esc(c.maps) + '" target="_blank" rel="noopener">Itinéraire</a>' : '') + '</p>' : '') + h.boutons(spec) + '</div>' +
      '<ol class="io-sem"' + h.rv('monte', 2) + '>' + jours + '</ol></div></section>';
  },
  script: scriptJour('r-infos-ouvert') + ';' + insecHeures('r-infos-ouvert'),
  css: function () { return `
${libre('r-infos-ouvert')}
.r-infos-ouvert .io{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:clamp(34px,6vw,100px);align-items:center}
.r-infos-ouvert .io-g{display:grid;gap:clamp(20px,2.6vw,30px);justify-items:start}
.r-infos-ouvert .io-t{display:grid;gap:clamp(12px,1.6vw,20px);line-height:1}
.r-infos-ouvert .io-s{display:inline-flex;align-items:center;gap:14px;font-family:var(--fx);font-weight:var(--fxf);font-size:1.05rem;letter-spacing:0;text-transform:none;font-variation-settings:var(--fxr);font-stretch:normal;color:var(--tx2)}
.r-infos-ouvert .io-s i{width:12px;height:12px}
.r-infos-ouvert .io-grand{display:block;font-size:max(2.2rem,min(var(--hmax,5.6rem),calc(100cqi / var(--hk))));line-height:var(--th);text-wrap:balance}
.r-infos-ouvert .io-ad{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;color:var(--tx2);font-size:1.05rem}
.r-infos-ouvert .io-ad .ic{color:var(--accT)}
.r-infos-ouvert .io-ad a{font-weight:var(--fxf);color:var(--tx);min-height:44px;display:inline-flex;align-items:center}
.r-infos-ouvert .io-sem{display:grid;background:var(--carte);border:1px solid var(--bord);border-radius:calc(var(--r) * 1.4 + 4px);padding:clamp(8px,1.2vw,14px);box-shadow:var(--ombre)}
.r-infos-ouvert .io-sem li{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 16px;padding:13px clamp(12px,1.6vw,18px);border-radius:calc(var(--r) * 1.2);transition:background-color .4s}
.r-infos-ouvert .io-sem li+li::before{content:"";position:absolute;left:clamp(12px,1.6vw,18px);right:clamp(12px,1.6vw,18px);top:0;height:1px;background:var(--bord)}
.r-infos-ouvert .io-j{font-weight:var(--fxf)}
.r-infos-ouvert .io-h{text-align:right;color:var(--tx2)}
.r-infos-ouvert .ferme .io-h{opacity:.75}
.r-infos-ouvert .io-auj{display:none;grid-column:1/-1;font-size:.95rem;font-weight:var(--fxf);color:var(--btnT)}
.r-infos-ouvert .io-sem li.auj{background:var(--btn);color:var(--btnT)}
.r-infos-ouvert .io-sem li.auj::before,.r-infos-ouvert .io-sem li.auj+li::before{display:none}
.r-infos-ouvert .io-sem li.auj .io-h{color:var(--btnT)}
.r-infos-ouvert .io-sem li.auj .io-auj{display:block;order:-1}
${CSS_POINT('r-infos-ouvert', '.io-s')}
@media(max-width:860px){.r-infos-ouvert .io{grid-template-columns:1fr}}
`; }
};

/* ── 2. la semaine dessinée en barres ── */
function heureTxt(m) { const h = Math.floor(m / 60), x = m % 60; return h + ' h' + (x ? ' ' + (x < 10 ? '0' : '') + x : ''); }
const semaineBarres = {
  id: 'infos.semaine', rubrique: 'infos', nom: 'La semaine en barres', quand: 'des horaires connus et variés (coupures, samedi, dimanche) : chaque jour dessiné en barres sur la journée, le jour même en évidence avec le trait de l\'heure qu\'il est',
  surfaces: ['surface', 'fond', 'champ'], js: ['ouvert'],
  besoin: function (spec, ctx) { const s = semaine(ctx.h, spec); return !!(s && s.mach); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, s = semaine(h, spec);
    if (!s || !s.mach) return '';
    // l'axe : du plus tôt au plus tard, calé sur des pas de deux, trois ou quatre heures
    let a0 = 1440, b0 = 0;
    s.jours.forEach(function (x) { (x ? x.plages : []).forEach(function (p) { a0 = Math.min(a0, p[0]); b0 = Math.max(b0, p[1] <= p[0] ? 1440 : p[1]); }); });
    const span = (b0 - a0) / 60, pas = span <= 8 ? 120 : span <= 15 ? 180 : 240;
    const d = Math.max(0, Math.floor(a0 / pas) * pas), f = Math.min(1440, Math.max(d + pas * 2, Math.ceil(b0 / pas) * pas));
    const pc = function (m) { return ((m - d) / (f - d) * 100).toFixed(2) + '%'; };
    const ticks = []; for (let t = d; t <= f; t += pas) ticks.push('<span style="--x:' + pc(t) + '">' + heureTxt(t) + '</span>');
    const rangs = s.jours.map(function (x, k) {
      const barres = (x ? x.plages : []).map(function (p) { const b = p[1] <= p[0] ? f : Math.min(f, p[1]); return '<i style="--a:' + pc(Math.max(d, p[0])) + ';--l:' + ((b - Math.max(d, p[0])) / (f - d) * 100).toFixed(2) + '%"></i>'; }).join('');
      return '<li class="is-j' + (x && x.plages.length ? '' : ' ferme') + '" data-jour="' + k + '"' + h.rv('monte', k) + '><span class="is-nom"><span class="is-long">' + JOURS[k] + '</span><span class="is-court">' + JOURS[k].slice(0, 3) + '</span></span><span class="is-piste">' + barres + '<b class="is-mt" aria-hidden="true"></b></span><span class="is-txt">' + h.esc(heures(x ? x.v : 'Non précisé')) + '</span></li>';
    }).join('');
    return '<section class="' + h.classes('infos.semaine', bloc, 'sec') + '" id="infos">' + h.fond(bloc) + '<div class="w">' +
      '<div class="is-tete"' + h.rv('monte') + '><h2 class="t">Nos horaires</h2><p class="is-etat" data-horaires="' + h.esc(s.mach) + '"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(heures(s.resume)) + '</span></p></div>' +
      '<div class="is-g" data-d="' + d + '" data-f="' + f + '" style="--nt:' + ((f - d) / pas) + '"><div class="is-axe" aria-hidden="true"><span></span><span class="is-ticks">' + ticks.join('') + '</span><span></span></div><ol class="is-l">' + rangs + '</ol></div></div></section>';
  },
  // le jour même en évidence, et le trait de l'heure qu'il est sur sa ligne
  script: insecHeures('r-infos-semaine') + ';' + scriptJour('r-infos-semaine', "var g=e.closest('.is-g'),a=+g.getAttribute('data-d'),z=+g.getAttribute('data-f'),m=e.querySelector('.is-mt');if(m&&mn>=a&&mn<=z){m.style.left=((mn-a)/(z-a)*100).toFixed(2)+'%';m.classList.add('on')}"),
  css: function () { return `
${libre('r-infos-semaine')}
.r-infos-semaine .is-tete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px 40px;margin-bottom:clamp(30px,4vw,52px)}
.r-infos-semaine .is-etat{display:inline-flex;align-items:center;gap:12px;min-height:48px;padding:0 20px;border-radius:999px;background:var(--carte);border:1px solid var(--bord);font-weight:var(--fxf);font-size:1.02rem}
.r-infos-semaine .is-etat i{width:10px;height:10px}
.r-infos-semaine .is-g{--cn:clamp(80px,9vw,120px);--ct:clamp(150px,17vw,220px);background:var(--carte);border:1px solid var(--bord);border-radius:calc(var(--r) * 1.4 + 6px);padding:clamp(18px,2.6vw,34px) clamp(16px,2.6vw,36px) clamp(12px,1.6vw,20px);box-shadow:var(--ombre)}
.r-infos-semaine .is-axe,.r-infos-semaine .is-j{display:grid;grid-template-columns:var(--cn) minmax(0,1fr) var(--ct);column-gap:clamp(14px,2vw,28px);align-items:center}
.r-infos-semaine .is-ticks{position:relative;height:26px}
.r-infos-semaine .is-ticks span{position:absolute;left:var(--x);top:0;transform:translateX(-50%);font-size:.95rem;color:var(--tx2);white-space:nowrap}
.r-infos-semaine .is-ticks span:first-child{transform:none}.r-infos-semaine .is-ticks span:last-child{transform:translateX(-100%)}
.r-infos-semaine .is-j{position:relative;padding-block:clamp(9px,1vw,12px);border-radius:12px}
.r-infos-semaine .is-j+.is-j::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:color-mix(in srgb,var(--bord) 60%,transparent)}
.r-infos-semaine .is-nom{font-weight:var(--fxf)}
.r-infos-semaine .is-court{display:none}
.r-infos-semaine .is-piste{position:relative;height:clamp(26px,2.4vw,32px);border-radius:999px;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--tx) 14%,transparent) 0 1px,transparent 1px calc(100% / var(--nt))),color-mix(in srgb,var(--tx) 5%,transparent)}
.r-infos-semaine .is-piste i{position:absolute;top:3px;bottom:3px;left:var(--a);width:var(--l);border-radius:999px;background:var(--acc);transform-origin:left;transition:transform 1s var(--ease);transition-delay:calc(var(--i,0) * 70ms + 250ms)}
.js .r-infos-semaine .is-j:not(.vu) .is-piste i{transform:scaleX(0)}
.r-infos-semaine .is-txt{color:var(--tx2);line-height:1.35}
.r-infos-semaine .ferme .is-txt{opacity:.75}
.r-infos-semaine .ferme .is-piste{background:repeating-linear-gradient(-45deg,color-mix(in srgb,var(--tx) 9%,transparent) 0 6px,transparent 6px 12px)}
.r-infos-semaine .is-mt{display:none;position:absolute;top:-7px;bottom:-7px;width:2px;margin-left:-1px;background:var(--tx);border-radius:2px;z-index:2}
.r-infos-semaine .is-mt::before{content:"";position:absolute;left:50%;top:-5px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:var(--tx);box-shadow:0 0 0 3px var(--carte)}
.r-infos-semaine .is-mt.on{display:block}
.r-infos-semaine .is-j.auj{background:color-mix(in srgb,var(--acc) 10%,transparent)}
.r-infos-semaine .is-j.auj::before,.r-infos-semaine .is-j.auj+.is-j::before{display:none}
.r-infos-semaine .is-j.auj .is-nom{color:var(--accT)}
.r-infos-semaine .is-j.auj .is-txt{color:var(--tx)}
.r-infos-semaine .is-j.auj .is-piste i{background:var(--btn);box-shadow:0 6px 16px -6px color-mix(in srgb,var(--btn) 80%,transparent)}
${CSS_POINT('r-infos-semaine', '.is-etat')}
@media(max-width:700px){.r-infos-semaine .is-g{--cn:44px;--ct:0px;padding-inline:14px}.r-infos-semaine .is-axe,.r-infos-semaine .is-j{grid-template-columns:var(--cn) minmax(0,1fr);row-gap:6px}.r-infos-semaine .is-axe>span:last-child{display:none}.r-infos-semaine .is-long{display:none}.r-infos-semaine .is-court{display:inline}.r-infos-semaine .is-txt{grid-column:2;font-size:.95rem}.r-infos-semaine .is-j{padding-inline:6px}}
`; }
};

/* ── 3. la zone en pastilles autour d'un radar ── */
function morceaux(z) { return String(z || '').split(/\s*(?:,|;|\/|\bet\b|\+)\s*/i).map(function (x) { return x.trim(); }).filter(function (x) { return x && x.length <= 40; }); }
const zone = {
  id: 'infos.zone', rubrique: 'infos', nom: 'La zone en pastilles', quand: 'une zone d\'intervention connue ou au moins la commune (artisans qui se déplacent, livraisons) : la commune au centre d\'un radar, les communes desservies en pastilles',
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return !!(ctx.h.zoneClient(spec) || spec.commune); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, z = h.zoneClient(spec), o = spec.objectif || 'devis';
    const base = spec.commune || '';
    if (!z && !base) return '';
    const vient = ['visite', 'reservation'].indexOf(o) >= 0;
    const puces = z ? morceaux(z).filter(function (x) { return x.toLowerCase() !== base.toLowerCase(); }).slice(0, 12) : [];
    const titre = z ? 'Où nous intervenons' : (vient ? 'Nous trouver' : 'Basés ' + MQ.a(base));
    const a = h.actionPrincipale(spec);
    const texte = z ? (base ? 'Basés ' + MQ.a(base) + ', nous intervenons dans ces communes.' : 'Nous intervenons dans ces communes.')
      : vient ? (h2s(c.adresse) || base + ', Martinique') : (a ? 'Pour savoir si nous venons jusqu\'à vous, ' + (a.type === 'whatsapp' ? 'écrivez-nous sur WhatsApp.' : a.type === 'tel' ? 'appelez-nous.' : 'écrivez-nous.') : 'Nous sommes en Martinique.');
    const liste = puces.length ? '<ul class="iz-puces">' + puces.map(function (x, k) { const com = MQ.commune(x); return '<li' + h.rv('zoom', Math.min(k, 8)) + '>' + (com ? h.icone('pin') : '') + '<span>' + h.esc(h.majuscule(x)) + '</span></li>'; }).join('') + '</ul>' : '';
    const iti = c.maps ? '<a class="btn b2 iz-iti" href="' + h.esc(c.maps) + '" target="_blank" rel="noopener">' + h.contenuBouton('carte', 'Itinéraire') + '</a>' : '';
    return '<section class="' + h.classes('infos.zone', bloc, 'sec') + '" id="infos">' + h.fond(bloc) + '<div class="w iz">' +
      '<div class="iz-tx"' + h.rv('monte') + '><h2 class="t">' + h.esc(titre) + '</h2><p>' + h.esc(texte) + '</p>' + liste + '<div class="iz-act">' + h.boutons(spec, { seule: !!iti }) + iti + '</div></div>' +
      '<div class="iz-radar" data-defile' + h.rv('zoom', 1) + ' aria-hidden="true"><span class="iz-anneau"></span><span class="iz-anneau"></span><span class="iz-anneau"></span><span class="iz-balai"></span><span class="iz-centre">' + h.icone('pin') + '<b>' + h.esc(base || 'Martinique') + '</b></span></div></div></section>';
  },
  css: function () { return `
${libre('r-infos-zone')}
.r-infos-zone .iz{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(36px,6vw,100px);align-items:center}
.r-infos-zone .iz-tx{display:grid;gap:20px;justify-items:start}
.r-infos-zone .iz-tx>p{color:var(--tx2);font-size:1.1rem;max-width:44ch}
.r-infos-zone .iz-puces{display:flex;flex-wrap:wrap;gap:10px}
.r-infos-zone .iz-puces li{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px 0 14px;border-radius:999px;background:var(--carte);border:1px solid var(--bord);font-weight:var(--fxf);transition:transform .45s var(--ease),border-color .3s,background-color .3s}
.r-infos-zone .iz-puces li:hover{transform:translateY(-3px);border-color:var(--acc)}
.r-infos-zone .iz-puces .ic{width:18px;height:18px;color:var(--accT)}
.r-infos-zone .iz-act{display:flex;flex-wrap:wrap;gap:12px 14px;margin-top:6px}
.r-infos-zone .iz-radar{position:relative;overflow:hidden;width:min(100%,460px);aspect-ratio:1;justify-self:center;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--acc) 12%,transparent),transparent 70%)}
.r-infos-zone .iz-anneau{position:absolute;inset:0;border-radius:50%;border:1px solid color-mix(in srgb,var(--tx) 18%,transparent)}
.r-infos-zone .iz-anneau:nth-child(2){inset:17%;border-style:dashed}
.r-infos-zone .iz-anneau:nth-child(3){inset:34%;border-color:color-mix(in srgb,var(--acc) 45%,transparent)}
.r-infos-zone .iz-radar::before,.r-infos-zone .iz-radar::after{content:"";position:absolute;background:color-mix(in srgb,var(--tx) 10%,transparent)}
.r-infos-zone .iz-radar::before{left:50%;top:0;bottom:0;width:1px}
.r-infos-zone .iz-radar::after{top:50%;left:0;right:0;height:1px}
.r-infos-zone .iz-balai{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,color-mix(in srgb,var(--acc) 38%,transparent),transparent 70deg);animation:k-infos-zone-balai 6s linear infinite;-webkit-mask-image:radial-gradient(circle,#000 69%,transparent 70%);mask-image:radial-gradient(circle,#000 69%,transparent 70%)}
.r-infos-zone .iz-radar.arret .iz-balai{animation-play-state:paused}
.r-infos-zone .iz-centre{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:10px;max-width:88%;padding:14px 22px 14px 16px;border-radius:999px;background:var(--btn);color:var(--btnT);box-shadow:0 20px 44px -18px color-mix(in srgb,var(--btn) 80%,#000);font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.15rem,1.9vw,1.6rem);line-height:1.1;white-space:nowrap}
.r-infos-zone .iz-centre b{font-weight:inherit;overflow:hidden;text-overflow:ellipsis}
.r-infos-zone .iz-centre .ic{width:24px;height:24px;flex:none;animation:k-infos-zone-pin 2.4s var(--ease) infinite}
@keyframes k-infos-zone-balai{to{transform:rotate(1turn)}}
@keyframes k-infos-zone-pin{0%,60%,100%{transform:none}30%{transform:translateY(-4px)}}
@media(max-width:860px){.r-infos-zone .iz{grid-template-columns:1fr}.r-infos-zone .iz-radar{width:min(100%,340px);order:-1}}
@media(prefers-reduced-motion:reduce){.r-infos-zone .iz-balai,.r-infos-zone .iz-centre .ic{animation:none}}
`; }
};

/* ── 4. la bande d'une ligne : ouvert maintenant, adresse, téléphone ── */
const bande = {
  id: 'infos.bande', rubrique: 'infos', nom: 'Bande d\'une ligne', quand: 'au moins deux faits parmi horaires, adresse et téléphone : une bande compacte, ouvert maintenant, l\'adresse avec l\'itinéraire, le numéro, WhatsApp',
  surfaces: ['champ', 'accent', 'surface', 'fond'], js: ['ouvert'], script: insecHeures('r-infos-bande'),
  besoin: function (spec, ctx) { const c = spec.contact || {}, s = semaine(ctx.h, spec); return [s && s.mach, adresse(spec), c.tel || c.mobile].filter(Boolean).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, c = spec.contact || {}, s = semaine(h, spec), o = h.objectif(spec);
    const cell = function (ic, grand, petit, href, ext, extra) { const corps = '<span class="ib-ic">' + ic + '</span><span class="ib-tx"><b' + (extra || '') + '>' + h.esc(grand) + '</b><small>' + h.esc(petit) + '</small></span>'; return href ? '<a class="ib-c" href="' + h.esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + corps + '</a>' : '<div class="ib-c">' + corps + '</div>'; };
    const cells = [];
    if (s && s.mach) cells.push('<div class="ib-c ib-etat" data-horaires="' + h.esc(s.mach) + '"><span class="ib-ic"><i aria-hidden="true"></i></span><span class="ib-tx"><b data-ouvert-texte>Nos horaires</b><small>' + h.esc(heures(s.resume)) + '</small></span></div>');
    const ad = h2s(c.adresse), com = spec.commune || MQ.communeDe(ad) || '';
    const rue = ad.replace(/,?\s*Martinique$/i, '').replace(new RegExp(',?\\s*(972\\d{2}\\s*)?' + com.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'), '').trim();
    if (ad || com) cells.push(cell(h.icone('pin'), com || ad, rue && rue !== com ? rue : (c.maps ? 'Voir l\'itinéraire' : 'Martinique'), c.maps || null, true));
    const num = c.tel || c.mobile, t = num ? h.telHref(num) : null;
    if (t) cells.push(cell(h.icone('tel'), MQ.affiche(num), 'Appeler', t));
    const wa = h.waHref(c.mobile || c.tel, o.wa);
    if (wa) cells.push(cell(h.icone('whatsapp'), 'WhatsApp', 'Écrire un message', wa, true));
    if (cells.length < 2) return '';
    return '<section class="' + h.classes('infos.bande', bloc) + '" id="infos" aria-labelledby="ib-titre">' + h.fond(bloc) + '<div class="w"><h2 class="ib-titre" id="ib-titre">Horaires, adresse et téléphone</h2><div class="ib n' + cells.length + (s && s.mach ? ' ae' : '') + '">' + cells.map(function (x, k) { return x.replace(/^<(a|div) class="ib-c/, '<$1' + h.rv('monte', k) + ' class="ib-c'); }).join('') + '</div></div></section>';
  },
  css: function () { return `
${libre('r-infos-bande')}
.r-infos-bande{padding-block:clamp(26px,3.4vw,44px)}
.r-infos-bande .ib-titre{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.r-infos-bande .ib{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));align-items:stretch}
.r-infos-bande .ib.n2{--n:2}.r-infos-bande .ib.n3{--n:3}.r-infos-bande .ib.n4{--n:4}
@media(min-width:1181px){.r-infos-bande .ib.ae.n4{grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(0,1fr))}}
@media(min-width:981px){.r-infos-bande .ib.ae.n3{grid-template-columns:minmax(0,1.4fr) repeat(2,minmax(0,1fr))}}
@media(min-width:981px) and (max-width:1180px){.r-infos-bande .ib.n4{grid-template-columns:repeat(2,minmax(0,1fr))}.r-infos-bande .ib.n4 .ib-c:nth-child(odd)::before{display:none}}
.r-infos-bande .ib-c{position:relative;display:flex;align-items:center;gap:16px;min-width:0;padding:14px clamp(14px,2vw,28px);color:var(--tx);text-decoration:none;border-radius:var(--r);transition:background-color .35s}
.r-infos-bande .ib-c+.ib-c::before{content:"";position:absolute;left:0;top:18%;bottom:18%;width:1px;background:var(--bord)}
.r-infos-bande a.ib-c:hover{background:color-mix(in srgb,var(--tx) 7%,transparent)}
.r-infos-bande .ib-ic{width:48px;height:48px;flex:none;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--bord);color:var(--accT);transition:background-color .4s,color .4s,border-color .4s,transform .5s var(--ease)}
.r-infos-bande .ib-ic .ic{width:22px;height:22px}
.r-infos-bande a.ib-c:hover .ib-ic{background:var(--btn);border-color:var(--btn);color:var(--btnT);transform:rotate(-8deg)}
.r-infos-bande .ib-tx{display:grid;gap:2px;min-width:0}
.r-infos-bande .ib-tx b{text-wrap:balance;font-family:var(--ft);font-weight:var(--tp);letter-spacing:max(var(--ti),-0.012em);word-spacing:.06em;font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.12rem,1.5vw,1.32rem);line-height:1.15;overflow-wrap:anywhere}
.r-infos-bande .ib-tx small{font-size:.95rem;color:var(--tx2);line-height:1.35}
.r-infos-bande .ib-etat .ib-ic i{width:14px;height:14px}
${CSS_POINT('r-infos-bande', '.ib-etat')}
@media(max-width:980px){.r-infos-bande .ib,.r-infos-bande .ib.n3,.r-infos-bande .ib.n4{grid-template-columns:repeat(2,minmax(0,1fr))}.r-infos-bande .ib-c:nth-child(odd)::before{display:none}.r-infos-bande .ib.n3 .ib-c:first-child{grid-column:1/-1}.r-infos-bande .ib.n3 .ib-c:nth-child(2)::before{display:none}.r-infos-bande .ib.n3 .ib-c:nth-child(3)::before{display:block}}
@media(max-width:560px){.r-infos-bande .ib,.r-infos-bande .ib.n2,.r-infos-bande .ib.n3,.r-infos-bande .ib.n4{grid-template-columns:1fr}.r-infos-bande .ib-c+.ib-c::before,.r-infos-bande .ib.n3 .ib-c:nth-child(3)::before{display:block;left:14px;right:14px;top:0;bottom:auto;width:auto;height:1px}.r-infos-bande .ib .ib-c{grid-column:auto}}
`; }
};

module.exports = [ouvert, semaineBarres, zone, bande];
