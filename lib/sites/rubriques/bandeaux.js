// Les bandeaux (rubrique bandeau) : la bande posée juste sous le haut de page. Six mises en scène : les services qui
// défilent sur une bande inclinée dont la vitesse suit le défilement, une rangée de faits sûrs, les vrais nombres qui
// roulent (note Google, nombre d'avis, nombre de services), deux rubans croisés, les atouts dans une carte de verre qui
// chevauche le haut de page, les services en icônes sur une ligne. Rien d'inventé : seulement ce que dit la fiche.
'use strict';
const MQ = require('../../martinique');

// le système d'apparitions pose clip-path:inset(0) sur tout élément apparu : pour celles qui ne découpent pas, on le
// retire (sinon il rogne les ombres et anneaux qui débordent)
function sansCoupe(c) { return ['monte', 'zoom', 'recul', 'gauche', 'droite', 'flou'].map(function (t) { return c + ' [data-r=' + t + '].vu'; }).join(',') + '{clip-path:none}\n'; }
// une liste répétée jusqu'à n éléments au moins (une bande qui défile ne doit jamais montrer de trou)
function remplir(items, n) { let out = []; if (!items.length) return out; while (out.length < n) out = out.concat(items); return out; }
// un petit astre à quatre branches qui sépare les mots des bandes
const ASTRE = '<svg class="astre" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z"/></svg>';
// une icône dont chaque trait sait se dessiner (pathLength)
function iconeTrace(h, nom) { return h.icone(nom).replace(/<(path|circle|rect)\b/g, '<$1 pathLength="1"'); }
// le lien d'un service : sa page s'il en a une (formule signature), sinon la rubrique des services
function lienService(ctx, s) { const p = (ctx.pages || []).find(function (y) { return y.service === s; }); return p ? ctx.lien(p.chemin) : '#services'; }

/* ── 1. les services qui défilent sur une bande inclinée, plus vite quand on défile ── */
const bandeauDefile = {
  id: 'bandeau.defile', rubrique: 'bandeau', nom: 'Bande inclinée qui défile',
  quand: 'trois services ou plus, pour un artisan, une boutique, une table : les services défilent sur une bande inclinée aux couleurs du site ; elle accélère quand on fait défiler la page et change de sens quand on remonte',
  familles: ['atelier', 'garage', 'comptoir', 'boutique', 'horizon', 'cabinet'], ambiances: ['franc', 'chaleureux', 'premium'], surfaces: ['fond', 'surface'], js: [], fonds: false, decoupe: false,
  besoin: function (spec, ctx) { return ctx.h.servicesDe(spec).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = h.servicesDe(spec).slice(0, 8);
    const items = remplir(sv, 10).map(function (s) { return '<li>' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '<span>' + h.esc(h.net(s.titre)) + '</span>' + ASTRE + '</li>'; }).join('');
    return '<section class="' + h.classes('bandeau.defile', bloc) + '" aria-label="' + h.esc(ctx.textes.services) + '"><div class="bd-bande" data-bd><div class="bd-piste"><ul class="bd-g">' + items + '</ul><ul class="bd-g" aria-hidden="true">' + items + '</ul></div></div></section>';
  },
  // la bande avance d'elle-même, prend de la vitesse avec le défilement, change de sens quand on remonte, s'arrête hors
  // de l'écran ; en mouvement réduit elle reste immobile
  script: `
[].slice.call(d.querySelectorAll('.r-bandeau-defile [data-bd]')).forEach(function(bd){var p=bd.querySelector('.bd-piste'),g=p&&p.querySelector('.bd-g');if(!p||!g||calme||!('IntersectionObserver' in w))return;
var x=0,sens=-1,elan=0,vu=false,t0=0,raf=0,y0=w.scrollY||0,lg=g.offsetWidth||1;
var pas=function(t){raf=0;if(!vu)return;var dt=t0?Math.min(48,t-t0):16;t0=t;x+=sens*(.05+elan)*dt;elan*=.93;if(x<=-lg)x+=lg;if(x>0)x-=lg;p.style.transform='translate3d('+x.toFixed(1)+'px,0,0)';raf=requestAnimationFrame(pas)};
new IntersectionObserver(function(es){vu=es[0].isIntersecting;if(vu&&!raf){t0=0;raf=requestAnimationFrame(pas)}}).observe(bd);
w.addEventListener('scroll',function(){var y=w.scrollY||0,dy=y-y0;y0=y;if(dy){sens=dy>0?-1:1;elan=Math.min(.7,elan+Math.abs(dy)*.0035)}},{passive:true});
w.addEventListener('resize',function(){lg=g.offsetWidth||1})})`,
  css: function () { return `
.r-bandeau-defile{overflow:hidden;padding-block:clamp(34px,4.6vw,64px)}
.r-bandeau-defile .bd-bande{width:calc(100% + 160px);margin-left:-80px;transform:rotate(-2.2deg);background:var(--accent);color:var(--surA);box-shadow:0 24px 50px -26px color-mix(in srgb,var(--accent) 85%,transparent);overflow:hidden}
.r-bandeau-defile .bd-piste{display:flex;width:max-content;will-change:transform}
.r-bandeau-defile .bd-g{display:flex;flex:none}
.r-bandeau-defile .bd-g li{display:flex;align-items:center;gap:clamp(14px,1.6vw,22px);padding:clamp(16px,1.9vw,24px) 0 clamp(16px,1.9vw,24px) clamp(14px,1.6vw,22px);white-space:nowrap;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.35rem,2.6vw,2.4rem);line-height:1}
.r-bandeau-defile .bd-g li>.ic{width:.95em;height:.95em;stroke-width:1.7;opacity:.85}
.r-bandeau-defile .astre{width:.62em;height:.62em;fill:currentColor;opacity:.55;margin-left:clamp(4px,.6vw,10px)}
@media(max-width:600px){.r-bandeau-defile .bd-bande{transform:rotate(-3.2deg)}}
`; }
};

/* ── 2. une rangée de faits sûrs, des icônes qui se dessinent ── */
function faitsBande(spec, h) {
  const f = h.faitsSurs(spec);
  // le nombre d'avis est déjà dit avec la note : une seule case pour Google
  const out = f.filter(function (x, k) { return !(x.icone === 'sourire' && f[0] && f[0].icone === 'etoile'); });
  return out.slice(0, 4);
}
const bandeauFaits = {
  id: 'bandeau.faits', rubrique: 'bandeau', nom: 'Rangée de faits sûrs',
  quand: 'toujours possible : trois ou quatre faits vrais (note Google, ouvert le samedi, WhatsApp, la commune, le nombre de services) en rangée à filets, chaque icône se dessine à son arrivée',
  familles: [], ambiances: ['franc', 'calme', 'chaleureux', 'premium'], surfaces: ['surface', 'fond'], js: [],
  besoin: function (spec, ctx) { return faitsBande(spec, ctx.h).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, f = faitsBande(spec, h);
    return '<section class="' + h.classes('bandeau.faits', bloc) + '" aria-label="En bref">' + h.fond(bloc) + '<div class="w"><ul class="bf n' + f.length + '">' + f.map(function (x, k) { return '<li' + h.rv('monte', k) + '><span class="bf-ic">' + iconeTrace(h, x.icone) + '</span><span class="bf-t"><b>' + h.esc(x.grand) + '</b><span>' + h.esc(x.petit) + '</span></span></li>'; }).join('') + '</ul></div></section>';
  },
  css: function () { return sansCoupe('.r-bandeau-faits') + `
.r-bandeau-faits{border-bottom:1px solid var(--bord)}
.r-bandeau-faits .bf{display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr))}
.r-bandeau-faits .bf.n3{--n:3}
.r-bandeau-faits .bf li{display:flex;align-items:center;gap:16px;padding:clamp(26px,3.2vw,42px) clamp(14px,2vw,30px);min-width:0}
.r-bandeau-faits .bf li+li{border-left:1px solid var(--bord)}
.r-bandeau-faits .bf li:first-child{padding-left:0}
.r-bandeau-faits .bf-ic{position:relative;width:54px;height:54px;flex:none;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--acc) 13%,transparent);color:var(--accT);transition:transform .6s cubic-bezier(.34,1.5,.64,1)}
.r-bandeau-faits .bf li:hover .bf-ic{transform:rotate(-10deg) scale(1.08)}
.r-bandeau-faits .bf-ic .ic{width:26px;height:26px}
.r-bandeau-faits .bf-ic .ic *{stroke-dasharray:1;stroke-dashoffset:0;transition:stroke-dashoffset 1.3s var(--ease2);transition-delay:calc(.25s + var(--i,0) * .14s)}
.js .r-bandeau-faits .bf li:not(.vu) .bf-ic .ic *{stroke-dashoffset:1}
.r-bandeau-faits .bf-t{display:grid;gap:2px;min-width:0}
.r-bandeau-faits .bf-t b{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.25rem,1.9vw,1.7rem);line-height:1.05;overflow-wrap:anywhere}
.r-bandeau-faits .bf-t span{color:var(--tx2);font-size:.95rem;line-height:1.35}
@media(max-width:860px){.r-bandeau-faits .bf,.r-bandeau-faits .bf.n3{grid-template-columns:repeat(2,minmax(0,1fr))}.r-bandeau-faits .bf li{padding:22px 12px}.r-bandeau-faits .bf li:nth-child(odd){padding-left:0;border-left:0}.r-bandeau-faits .bf li:nth-child(n+3){border-top:1px solid var(--bord)}.r-bandeau-faits .bf.n3 li:last-child{grid-column:1/-1}}
@media(max-width:420px){.r-bandeau-faits .bf li{flex-direction:column;align-items:flex-start;gap:12px}.r-bandeau-faits .bf-ic{width:46px;height:46px}}
@media(prefers-reduced-motion:reduce){.r-bandeau-faits .bf-ic .ic *,.r-bandeau-faits .bf-ic{transition:none}}
`; }
};

/* ── 3. les vrais nombres qui roulent : la note, les avis, les services ── */
function rouleau(h, texte, k0) {
  const chiffres = '01234567890123456789'.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('');
  let k = k0;
  return String(texte).split('').map(function (ch) { return /\d/.test(ch) ? '<span class="bc-ch"><span class="bc-col" style="--d:' + ch + ';--k:' + (k++) + '">' + chiffres + '</span></span>' : '<span class="bc-sep">' + h.esc(ch) + '</span>'; }).join('');
}
const bandeauCompteurs = {
  id: 'bandeau.compteurs', rubrique: 'bandeau', nom: 'Les vrais nombres qui roulent',
  quand: 'une bonne note Google : la note, le nombre d\'avis et les jours d\'ouverture en très grands chiffres qui roulent comme un compteur à leur arrivée',
  familles: ['atelier', 'garage', 'cabinet', 'horizon', 'comptoir', 'boutique'], ambiances: ['franc', 'premium', 'calme', 'chaleureux'], surfaces: ['champ', 'accent', 'surface'], js: [],
  besoin: function (spec, ctx) { return !!ctx.h.noteGoogle(spec); },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec);
    const items = [{ v: h.noteTexte(g), u: '/5', l: 'Note moyenne sur Google', ic: 'etoile', lu: h.noteTexte(g) + ' sur 5' }, { v: String(g.avis), l: 'Avis laissés sur Google', ic: 'sourire', lu: String(g.avis) }];
    // le troisième chiffre n'est montré que s'il dit quelque chose de vrai et d'utile : les jours d'ouverture
    const js = h.lireJours(h.horairesDe(spec.contact || {})), nj = js ? js.filter(function (x) { return x.plages.length; }).length : 0;
    if (nj >= 5) items.push({ v: String(nj), u: '/7', l: nj === 7 ? 'Ouvert tous les jours' : 'Jours d\'ouverture par semaine', ic: 'horloge', lu: nj + ' jours sur 7' });
    let k0 = 0;
    const lis = items.map(function (x, k) { const r = rouleau(h, x.v, k0); k0 += x.v.replace(/\D/g, '').length + 1; return '<li' + h.rv('monte', k) + '><p class="bc-n"><span class="bc-lu">' + h.esc(x.lu) + '</span><span class="bc-r" aria-hidden="true">' + r + (x.u ? '<span class="bc-u">' + x.u + '</span>' : '') + '</span></p><p class="bc-l">' + h.icone(x.ic) + '<span>' + h.esc(x.l) + '</span></p></li>'; }).join('');
    return '<section class="' + h.classes('bandeau.compteurs', bloc) + '" aria-label="En chiffres">' + h.fond(bloc) + '<div class="w"><ul class="bc n' + items.length + '">' + lis + '</ul></div></section>';
  },
  css: function () { return sansCoupe('.r-bandeau-compteurs') + `
.r-bandeau-compteurs{padding-block:clamp(44px,5.6vw,80px)}
.r-bandeau-compteurs .bc{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr))}
.r-bandeau-compteurs .bc.n2{--n:2}
.r-bandeau-compteurs .bc li{display:grid;gap:12px;justify-items:start;padding-inline:clamp(16px,3vw,48px)}
.r-bandeau-compteurs .bc li:first-child{padding-left:0}
.r-bandeau-compteurs .bc li+li{border-left:1px solid var(--bord)}
.r-bandeau-compteurs .bc-n{margin:0;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(3.4rem,7.4vw,6.6rem);line-height:1;letter-spacing:-.02em;color:var(--tx);font-variant-numeric:tabular-nums}
.r-bandeau-compteurs .bc-lu{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.r-bandeau-compteurs .bc-r{display:inline-flex;align-items:flex-start}
.r-bandeau-compteurs .bc-ch{display:inline-block;height:1.08em;overflow:hidden}
.r-bandeau-compteurs .bc-col{display:block;transform:translateY(calc((10 + var(--d)) * -1.08em));transition:transform 2s cubic-bezier(.16,1,.3,1);transition-delay:calc(.2s + var(--k) * .11s)}
.r-bandeau-compteurs .bc-col span{display:block;height:1.08em;line-height:1.08em;text-align:center}
.js .r-bandeau-compteurs li:not(.vu) .bc-col{transform:none}
.r-bandeau-compteurs .bc-sep{display:inline-block;line-height:1.08em}
.r-bandeau-compteurs .bc-u{font-size:.36em;line-height:1;margin:.28em 0 0 .12em;color:var(--accT)}
.r-bandeau-compteurs .bc-l{display:flex;align-items:center;gap:10px;margin:0;color:var(--tx2);font-weight:var(--fxf)}
.r-bandeau-compteurs .bc-l .ic{color:var(--accT)}
@media(max-width:760px){.r-bandeau-compteurs .bc li{padding-inline:clamp(10px,3vw,18px);gap:8px}.r-bandeau-compteurs .bc-n{font-size:clamp(2.1rem,10.5vw,3.4rem)}.r-bandeau-compteurs .bc-l{display:block;font-size:.94rem;line-height:1.3}.r-bandeau-compteurs .bc-l .ic{display:none}}
@media(prefers-reduced-motion:reduce){.r-bandeau-compteurs .bc-col{transition:none}}
`; }
};

/* ── 4. deux rubans croisés qui défilent en sens contraire ── */
function motsRuban(spec, h) {
  const c = spec.contact || {}, g = h.noteGoogle(spec), out = h.atouts(spec).map(function (a) { return h.net(a.titre); });
  out.push(h.lieuCourt(spec));
  if (g) out.push('Noté ' + h.noteTexte(g) + ' sur Google');
  if (h.ouvertLeSamedi(h.horairesDe(c))) out.push('Ouvert le samedi');
  if (h.waHref(c.mobile || c.tel)) out.push('Joignable sur WhatsApp');
  else if (c.tel) out.push(MQ.affiche(c.tel));
  return out.filter(Boolean);
}
const bandeauRuban = {
  id: 'bandeau.ruban', rubrique: 'bandeau', nom: 'Deux rubans croisés',
  quand: 'deux services ou plus, pour une boutique, une table, un artisan qui a du caractère : deux rubans croisés défilent en sens contraire, les services sur l\'un, les atouts et les faits sûrs sur l\'autre',
  familles: ['boutique', 'comptoir', 'atelier', 'garage', 'verdure', 'horizon'], ambiances: ['franc', 'chaleureux'], surfaces: ['fond', 'surface'], js: ['defile'], fonds: false, decoupe: false,
  besoin: function (spec, ctx) { return ctx.h.servicesDe(spec).length >= 2 && motsRuban(spec, ctx.h).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h;
    const ligne = function (mots, n) { const li = remplir(mots, n).map(function (m) { return '<li><span>' + h.esc(m) + '</span>' + ASTRE + '</li>'; }).join(''); return '<ul class="br-g">' + li + '</ul><ul class="br-g" aria-hidden="true">' + li + '</ul>'; };
    const a = h.servicesDe(spec).slice(0, 8).map(function (s) { return h.net(s.titre); }), b = motsRuban(spec, h);
    return '<section class="' + h.classes('bandeau.ruban', bloc) + '" aria-label="En bref"><div class="br" data-defile><div class="br-r br-a"><div class="br-piste">' + ligne(a, 10) + '</div></div><div class="br-r br-b"><div class="br-piste">' + ligne(b, 10) + '</div></div></div></section>';
  },
  css: function () { return `
.r-bandeau-ruban{overflow:hidden;padding-block:clamp(56px,7vw,104px)}
.r-bandeau-ruban .br{position:relative;display:grid;align-items:center}
.r-bandeau-ruban .br-r{grid-area:1/1;width:calc(100% + 240px);margin-left:-120px;overflow:hidden}
.r-bandeau-ruban .br-a{position:relative;z-index:2;transform:rotate(-3.4deg);background:var(--accent);color:var(--surA);box-shadow:0 22px 44px -24px color-mix(in srgb,var(--accent) 90%,transparent)}
.r-bandeau-ruban .br-b{transform:rotate(3.2deg);background:var(--carte);color:var(--encre);border-block:1px solid var(--ligne);box-shadow:0 16px 36px -24px rgb(0 0 0 / .35)}
.r-bandeau-ruban .br-piste{display:flex;width:max-content;animation:k-bandeau-ruban-g 46s linear infinite}
.r-bandeau-ruban .br-b .br-piste{animation-name:k-bandeau-ruban-d;animation-duration:58s}
.r-bandeau-ruban .arret .br-piste{animation-play-state:paused}
.r-bandeau-ruban .br-g{display:flex;flex:none}
.r-bandeau-ruban .br-g li{display:flex;align-items:center;gap:clamp(16px,1.8vw,26px);padding:clamp(14px,1.6vw,20px) 0 clamp(14px,1.6vw,20px) clamp(16px,1.8vw,26px);white-space:nowrap;line-height:1}
.r-bandeau-ruban .br-a li{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.3rem,2.4vw,2.2rem)}
.r-bandeau-ruban .br-b li{font-weight:var(--fxf);font-size:clamp(1rem,1.4vw,1.2rem)}
.r-bandeau-ruban .astre{width:.7em;height:.7em;fill:currentColor;opacity:.6}
.r-bandeau-ruban .br-b .astre{fill:var(--accentT);opacity:1}
@keyframes k-bandeau-ruban-g{to{transform:translate3d(-50%,0,0)}}
@keyframes k-bandeau-ruban-d{from{transform:translate3d(-50%,0,0)}to{transform:none}}
@media(max-width:900px){.r-bandeau-ruban{padding-block:clamp(34px,8vw,56px)}.r-bandeau-ruban .br-r{grid-area:auto}.r-bandeau-ruban .br-a{transform:rotate(-3deg)}.r-bandeau-ruban .br-b{transform:rotate(2deg);margin-top:-4px}}
@media(prefers-reduced-motion:reduce){.r-bandeau-ruban .br-piste,.r-bandeau-ruban .br-b .br-piste{animation:none}}
`; }
};

/* ── 5. les atouts dans une carte de verre qui chevauche le haut de page ── */
const bandeauChevauche = {
  id: 'bandeau.chevauche', rubrique: 'bandeau', nom: 'Carte de verre qui chevauche',
  quand: 'deux à quatre atouts, sous un haut de page à photo (artisan, garage, jardin, mer) : une carte de verre dépoli posée à cheval sur le bas de la photo, un trait de lumière la parcourt à son arrivée (remplace la rubrique des atouts)',
  familles: ['atelier', 'garage', 'verdure', 'cabinet', 'horizon', 'boutique'], ambiances: ['franc', 'premium', 'calme', 'chaleureux'], surfaces: ['fond'], js: [], inclut: ['atouts'], fonds: false, decoupe: false,
  besoin: function (spec, ctx) { return ctx.h.atouts(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, a = h.atouts(spec).slice(0, 4);
    return '<section class="' + h.classes('bandeau.chevauche', bloc) + '" id="pourquoi" aria-label="' + h.esc(ctx.mod.textes.pourquoi) + '"><div class="w"><div class="bcv"' + h.rv('monte') + '><ul class="n' + a.length + '">' + a.map(function (x, k) { return '<li' + h.rv('monte', k + 1) + '><span class="bcv-ic">' + h.icone(h.iconeDe(x, 'check')) + '</span><div><h3>' + h.esc(h.net(x.titre)) + '</h3>' + (h.net(x.texte) ? '<p>' + h.esc(h.net(x.texte)) + '</p>' : '') + '</div></li>'; }).join('') + '</ul></div></div></section>';
  },
  css: function () { return sansCoupe('.r-bandeau-chevauche') + `
.r-bandeau-chevauche{z-index:3;background:transparent;margin-top:calc(-1 * clamp(48px,6.4vw,92px))}
.r-bandeau-chevauche .bcv{position:relative;overflow:hidden;border-radius:var(--r);background:color-mix(in srgb,var(--carte) 74%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);border:1px solid color-mix(in srgb,var(--encre) 12%,transparent);box-shadow:var(--ombreF),inset 0 1px 0 rgb(255 255 255 / .35);color:var(--encre)}
.r-bandeau-chevauche .bcv::before{content:"";position:absolute;left:0;top:0;height:2px;width:40%;background:linear-gradient(90deg,transparent,var(--accent),transparent);transform:translateX(-100%);opacity:0}
.r-bandeau-chevauche .bcv.vu::before{animation:k-bandeau-chevauche-lueur 2.4s var(--ease2) .3s 1 both}
@keyframes k-bandeau-chevauche-lueur{0%{transform:translateX(-100%);opacity:1}100%{transform:translateX(250%);opacity:1}}
.r-bandeau-chevauche ul{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr))}
.r-bandeau-chevauche ul.n2{--n:2}.r-bandeau-chevauche ul.n4{--n:4}
.r-bandeau-chevauche li{position:relative;display:flex;gap:16px;align-items:flex-start;padding:clamp(22px,2.6vw,34px)}
.r-bandeau-chevauche li+li::before{content:"";position:absolute;left:0;top:18%;bottom:18%;width:1px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--encre) 18%,transparent),transparent)}
.r-bandeau-chevauche .bcv-ic{width:48px;height:48px;flex:none;display:grid;place-items:center;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--accent) 60%,transparent);color:var(--accentT);transition:background-color .4s,color .4s,transform .6s cubic-bezier(.34,1.5,.64,1)}
.r-bandeau-chevauche li:hover .bcv-ic{background:var(--accent);color:var(--surA);transform:rotate(-8deg)}
.r-bandeau-chevauche .bcv-ic .ic{width:22px;height:22px}
.r-bandeau-chevauche h3{font-size:1.08rem;margin-bottom:4px}
.r-bandeau-chevauche p{color:var(--doux);font-size:.95rem;line-height:1.5}
@media(max-width:860px){.r-bandeau-chevauche{margin-top:-30px}.r-bandeau-chevauche ul,.r-bandeau-chevauche ul.n2,.r-bandeau-chevauche ul.n4{grid-template-columns:1fr}.r-bandeau-chevauche li{padding:18px 20px}.r-bandeau-chevauche li+li::before{left:20px;right:20px;top:0;bottom:auto;width:auto;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--encre) 18%,transparent),transparent)}}
@media(prefers-reduced-motion:reduce){.r-bandeau-chevauche .bcv.vu::before{animation:none}}
`; }
};

/* ── 6. les services en icônes, sur une ligne ── */
const bandeauIcones = {
  id: 'bandeau.icones', rubrique: 'bandeau', nom: 'Services en icônes',
  quand: 'trois à six services courts (artisan, garage, cabinet, boutique) : les services en icônes sur une ligne, chacun mène à sa description ; au survol une pastille glisse sous l\'élément visé et son icône saute',
  familles: ['atelier', 'garage', 'cabinet', 'boutique', 'verdure', 'comptoir'], ambiances: ['franc', 'calme', 'chaleureux'], surfaces: ['fond', 'surface'], js: [],
  besoin: function (spec, ctx) { return ctx.h.servicesDe(spec).length >= 3; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, sv = h.servicesDe(spec).slice(0, 6);
    return '<section class="' + h.classes('bandeau.icones', bloc) + '" aria-label="' + h.esc(ctx.textes.services) + '">' + h.fond(bloc) + '<div class="w"><ul class="bi n' + sv.length + '" data-bi>' + sv.map(function (s, k) { return '<li' + h.rv('monte', k) + '><a class="bi-a" href="' + h.esc(lienService(ctx, s)) + '"><span class="bi-ic">' + h.icone(h.iconeDe(s, ctx.iconeMetier)) + '</span><span class="bi-t">' + h.esc(h.net(s.titre)) + '</span>' + h.icone('fleche', 'ic bi-f') + '</a></li>'; }).join('') + '</ul></div></section>';
  },
  // la pastille suit le pointeur d'un service à l'autre (souris seulement) ; sans script, le survol reste sur l'élément
  script: `
if(!calme&&w.matchMedia('(hover:hover) and (pointer:fine)').matches){[].slice.call(d.querySelectorAll('.r-bandeau-icones [data-bi]')).forEach(function(l){var ind=d.createElement('span');ind.className='bi-ind';ind.setAttribute('aria-hidden','true');l.appendChild(ind);l.classList.add('ok');
var aller=function(a){var r=a.getBoundingClientRect(),q=l.getBoundingClientRect();l.style.setProperty('--x',(r.left-q.left).toFixed(1)+'px');l.style.setProperty('--y',(r.top-q.top).toFixed(1)+'px');l.style.setProperty('--lw',r.width.toFixed(1)+'px');l.style.setProperty('--lh',r.height.toFixed(1)+'px');l.classList.add('vise')};
[].slice.call(l.querySelectorAll('.bi-a')).forEach(function(a){a.addEventListener('mouseenter',function(){aller(a)});a.addEventListener('focus',function(){aller(a)})});
l.addEventListener('mouseleave',function(){l.classList.remove('vise')})})}`,
  css: function () { return sansCoupe('.r-bandeau-icones') + `
.r-bandeau-icones{padding-block:clamp(22px,2.8vw,40px);border-bottom:1px solid var(--bord)}
.r-bandeau-icones .bi{position:relative;isolation:isolate;display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr));gap:clamp(6px,1vw,12px)}
.r-bandeau-icones .bi.n3{--n:3}.r-bandeau-icones .bi.n5{--n:5}.r-bandeau-icones .bi.n6{--n:6}
.r-bandeau-icones .bi li{min-width:0}
.r-bandeau-icones .bi-a{position:relative;display:flex;align-items:center;gap:16px;min-height:44px;height:100%;padding:clamp(14px,1.5vw,20px) clamp(14px,1.6vw,22px);text-decoration:none;border-radius:var(--r);transition:background-color .35s}
.r-bandeau-icones .bi:not(.ok) .bi-a:hover{background:color-mix(in srgb,var(--acc) 8%,transparent)}
.r-bandeau-icones .bi-ind{position:absolute;left:0;top:0;z-index:-1;width:var(--lw,0);height:var(--lh,0);transform:translate(var(--x,0),var(--y,0));border-radius:var(--r);background:color-mix(in srgb,var(--acc) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 22%,transparent);opacity:0;transition:transform .55s cubic-bezier(.34,1.3,.64,1),width .45s var(--ease),height .45s var(--ease),opacity .3s}
.r-bandeau-icones .bi.vise .bi-ind{opacity:1}
.r-bandeau-icones .bi-ic{position:relative;isolation:isolate;width:clamp(52px,4.6vw,62px);aspect-ratio:1;flex:none;display:grid;place-items:center;border-radius:50%;color:var(--accT);border:1.5px solid color-mix(in srgb,var(--acc) 45%,transparent);transition:color .35s,border-color .35s,border-radius .5s var(--ease)}
.r-bandeau-icones .bi-ic::before{content:"";position:absolute;inset:-1.5px;z-index:-1;border-radius:inherit;background:var(--btn);transform:scale(0);transition:transform .5s var(--ease)}
.r-bandeau-icones .bi-ic .ic{width:46%;height:46%}
.r-bandeau-icones .bi-a:hover .bi-ic,.r-bandeau-icones .bi-a:focus-visible .bi-ic{color:var(--btnT);border-color:var(--btn);border-radius:var(--rb)}
.r-bandeau-icones .bi-a:hover .bi-ic::before,.r-bandeau-icones .bi-a:focus-visible .bi-ic::before{transform:none}
.r-bandeau-icones .bi-a:hover .bi-ic .ic{animation:k-bandeau-icones-saut .7s cubic-bezier(.34,1.5,.64,1)}
@keyframes k-bandeau-icones-saut{0%{transform:none}35%{transform:translateY(-7px) rotate(-8deg)}70%{transform:translateY(1px)}100%{transform:none}}
.r-bandeau-icones .bi-t{flex:1;min-width:0;font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.05rem,1.45vw,1.3rem);line-height:1.1;overflow-wrap:break-word}
.r-bandeau-icones .bi-f{width:18px;height:18px;flex:none;color:var(--accT);opacity:0;transform:translateX(-8px);transition:opacity .35s,transform .5s var(--ease)}
.r-bandeau-icones .bi-a:hover .bi-f,.r-bandeau-icones .bi-a:focus-visible .bi-f{opacity:1;transform:none}
.r-bandeau-icones .bi.n5 .bi-a,.r-bandeau-icones .bi.n6 .bi-a{flex-direction:column;align-items:flex-start;gap:12px}.r-bandeau-icones .bi.n5 .bi-f,.r-bandeau-icones .bi.n6 .bi-f{position:absolute;right:14px;top:16px}
@media(max-width:980px){.r-bandeau-icones .bi-a{flex-direction:column;align-items:flex-start;gap:12px}.r-bandeau-icones .bi-f{position:absolute;right:14px;top:16px}}
@media(max-width:760px){.r-bandeau-icones .bi{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:8px;margin-inline:calc(-1 * var(--g));padding:4px var(--g) 8px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 var(--g),#000 calc(100% - var(--g)),transparent);mask-image:linear-gradient(90deg,transparent,#000 var(--g),#000 calc(100% - var(--g)),transparent)}.r-bandeau-icones .bi::-webkit-scrollbar{display:none}.r-bandeau-icones .bi li{flex:0 0 44%;scroll-snap-align:start}.r-bandeau-icones .bi-t{font-size:.98rem;hyphens:auto;-webkit-hyphens:auto;overflow-wrap:anywhere}.r-bandeau-icones .bi.n3 li{flex-basis:calc((100% - 16px) / 3)}.r-bandeau-icones .bi-a{background:color-mix(in srgb,var(--acc) 6%,transparent);padding:14px}.r-bandeau-icones .bi-f{display:none}}
@media(prefers-reduced-motion:reduce){.r-bandeau-icones .bi-a:hover .bi-ic .ic{animation:none}.r-bandeau-icones .bi-ic::before,.r-bandeau-icones .bi-ind{transition:none}}
`; }
};

module.exports = [bandeauDefile, bandeauFaits, bandeauCompteurs, bandeauRuban, bandeauChevauche, bandeauIcones];
