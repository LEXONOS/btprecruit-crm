// Les avis (rubrique avis) : UNIQUEMENT la vraie note Google de la fiche (spec.google : note et nombre d'avis), jamais un
// texte d'avis, jamais un témoignage, jamais un logo de marque. Quatre mises en scène : une pastille au texte circulaire
// qui tourne, une bande sombre où la note compte et les étoiles se remplissent une à une, une carte sobre « Note Google »,
// cinq très grandes étoiles qui se remplissent jusqu'à la note.
'use strict';

// le système d'apparitions pose clip-path:inset(0) sur tout élément apparu : pour celles qui ne découpent pas, on le
// retire (sinon il rogne les ombres et anneaux qui débordent)
function sansCoupe(c) { return ['monte', 'zoom', 'recul', 'gauche', 'droite', 'flou'].map(function (t) { return c + ' [data-r=' + t + '].vu'; }).join(',') + '{clip-path:none}\n'; }
function besoinNote(spec, ctx) { return !!ctx.h.noteGoogle(spec); }
function phrase(spec, h) { return 'La note moyenne de ' + h.net(spec.nom) + ' sur sa fiche Google.'; }
// le lien vers la fiche, seulement si la fiche en donne un (Google Maps)
function lienFiche(spec, h, cls) {
  const c = spec.contact || {};
  return c.maps && /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.(google|app\.goo)\.|^https:\/\/goo\.gl\/maps/.test(c.maps) ? '<a class="' + cls + '" href="' + h.esc(c.maps) + '" target="_blank" rel="noopener">' + h.icone('carte') + '<span>Voir la fiche sur Google Maps</span></a>' : '';
}
// la part remplie de chacune des cinq étoiles (4,6 : quatre pleines, la cinquième à 60 %)
function parts(note) { const n = Math.max(0, Math.min(5, Number(note) || 0)); return [0, 1, 2, 3, 4].map(function (k) { return Math.round(Math.max(0, Math.min(1, n - k)) * 100); }); }
const ETOILE = '<path d="M12 2.6l2.85 5.9 6.45.95-4.67 4.55 1.1 6.42L12 17.38l-5.73 3.04 1.1-6.42L2.7 9.45l6.45-.95z"/>';
function etoile(cls) { return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ETOILE + '</svg>'; }

/* ── 1. une pastille ronde au texte circulaire qui tourne, la note au centre ── */
const avisPastille = {
  id: 'avis.pastille', rubrique: 'avis', nom: 'Pastille qui tourne',
  quand: 'une bonne note Google, pour une table, une boutique, un soin, une sortie : une pastille ronde dont le texte circulaire tourne lentement, la note qui compte au centre',
  familles: ['comptoir', 'boutique', 'ecrin', 'horizon', 'verdure', 'atelier'], ambiances: ['chaleureux', 'premium', 'franc'], surfaces: ['surface', 'fond', 'champ'], js: ['compteur', 'defile'],
  besoin: besoinNote,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec), n = h.noteTexte(g);
    const anneau = ('Note Google • ' + n + ' sur 5 • ' + g.avis + ' avis • ').toUpperCase();
    const badge = '<div class="avp-badge" data-defile><div class="avp-in"' + h.rv('zoom') + '><svg class="avp-anneau" viewBox="0 0 240 240" aria-hidden="true"><defs><path id="avis-pastille-cercle" d="M120 120m-94 0a94 94 0 1 1 188 0a94 94 0 1 1-188 0"/></defs><text><textPath href="#avis-pastille-cercle" textLength="590" lengthAdjust="spacing">' + h.esc(anneau) + '</textPath></text></svg><div class="avp-centre"><span class="avp-n"><span data-compte="' + Number(g.note) + '" data-dec="1">' + n + '</span></span><span class="avp-s">sur 5</span>' + h.etoiles(g.note) + '</div></div></div>';
    return '<section class="' + h.classes('avis.pastille', bloc, 'sec') + '" id="avis">' + h.fond(bloc) + '<div class="w avp">' + badge + '<div class="avp-tx"' + h.rv('monte', 2) + '><h2 class="t">' + h.esc('Noté ' + n + ' sur 5 par ' + g.avis + ' clients') + '</h2><p>' + h.esc(phrase(spec, h)) + '</p>' + lienFiche(spec, h, 'avp-l') + '</div></div></section>';
  },
  css: function () { return sansCoupe('.r-avis-pastille') + `
.r-avis-pastille .avp{display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(36px,6vw,100px);align-items:center}
.r-avis-pastille .avp-badge{width:clamp(230px,26vw,340px);aspect-ratio:1}
.r-avis-pastille .avp-in{position:relative;width:100%;height:100%;border-radius:50%;background:var(--carte);border:1px solid var(--bord);box-shadow:var(--ombreF)}
.r-avis-pastille .avp-in::before{content:"";position:absolute;inset:20%;border-radius:50%;border:1px dashed color-mix(in srgb,var(--acc) 55%,transparent)}
.r-avis-pastille .avp-anneau{position:absolute;inset:0;width:100%;height:100%;animation:k-avis-pastille-tourne 32s linear infinite}
.r-avis-pastille .avp-anneau text{font-family:var(--fx);font-weight:var(--fxf);font-size:16px;fill:var(--tx)}
.r-avis-pastille .arret .avp-anneau{animation-play-state:paused}
.r-avis-pastille .avp-badge:hover .avp-anneau{animation-duration:12s}
@keyframes k-avis-pastille-tourne{to{transform:rotate(360deg)}}
.r-avis-pastille .avp-centre{position:absolute;inset:24%;display:grid;place-content:center;justify-items:center;gap:4px;text-align:center}
.r-avis-pastille .avp-n{font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(3rem,5.4vw,4.6rem);line-height:.9;letter-spacing:-.02em;color:var(--accT)}
.r-avis-pastille .avp-s{font-weight:var(--fxf);color:var(--tx2);font-size:.95rem}
.r-avis-pastille .avp-centre .etoiles{margin-top:6px}
.r-avis-pastille .avp-centre .etoiles .ic{width:17px;height:17px}
.r-avis-pastille .avp-tx{display:grid;gap:16px;justify-items:start;max-width:34em}
.r-avis-pastille .avp-tx p{color:var(--tx2);font-size:1.1rem}
.r-avis-pastille .avp-l{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.r-avis-pastille .avp-l:hover span{text-decoration:underline}
@media(max-width:760px){.r-avis-pastille .avp{grid-template-columns:1fr;justify-items:center;text-align:center}.r-avis-pastille .avp-tx{justify-items:center}}
@media(prefers-reduced-motion:reduce){.r-avis-pastille .avp-anneau{animation:none}}
`; }
};

/* ── 2. une bande sombre : la note compte, les étoiles se remplissent une à une ── */
const avisBande = {
  id: 'avis.bande', rubrique: 'avis', nom: 'Bande, note qui compte',
  quand: 'une bonne note Google, pour un artisan, un garage, un cabinet : une bande sombre où la note compte jusqu\'à sa valeur pendant que cinq grandes étoiles se remplissent une à une',
  familles: ['atelier', 'garage', 'cabinet', 'horizon', 'verdure', 'boutique'], ambiances: ['franc', 'premium', 'calme'], surfaces: ['champ', 'accent', 'surface'], js: ['compteur'],
  besoin: besoinNote,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec), n = h.noteTexte(g);
    const et = parts(g.note).map(function (f, k) { return '<span class="avb-e" style="--f:' + f + '%;--k:' + k + '">' + etoile('avb-v') + '<span class="avb-pl">' + etoile('avb-p') + '</span></span>'; }).join('');
    return '<section class="' + h.classes('avis.bande', bloc) + '" id="avis">' + h.fond(bloc) + '<div class="w avb"><p class="avb-note"' + h.rv('monte') + '><span class="avb-c" data-compte="' + Number(g.note) + '" data-dec="1">' + n + '</span><span class="avb-s">/5</span></p><div class="avb-et"' + h.rv('monte', 1) + ' aria-hidden="true">' + et + '</div><div class="avb-tx"' + h.rv('monte', 2) + '><h2 class="t">' + h.esc(g.avis + ' avis sur Google') + '</h2><p>' + h.esc(phrase(spec, h)) + '</p>' + lienFiche(spec, h, 'avb-l') + '</div></div></section>';
  },
  css: function () { return sansCoupe('.r-avis-bande') + `
.r-avis-bande{padding-block:clamp(56px,7vw,104px)}
.r-avis-bande .avb{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:clamp(24px,4vw,64px);align-items:center}
.r-avis-bande .avb-note{display:flex;align-items:flex-start;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);line-height:.84;color:var(--accT);padding-right:clamp(24px,4vw,64px);border-right:1px solid var(--bord)}
.r-avis-bande .avb-c{font-size:clamp(4.6rem,10vw,8.6rem);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.r-avis-bande .avb-s{font-size:clamp(1.6rem,3vw,2.6rem);margin-top:.35em;opacity:.7}
.r-avis-bande .avb-et{display:flex;gap:clamp(4px,.7vw,10px)}
.r-avis-bande .avb-e{position:relative;width:clamp(36px,4.4vw,58px);aspect-ratio:1}
.r-avis-bande .avb-e svg{position:absolute;inset:0;width:100%;height:100%}
.r-avis-bande .avb-v{fill:color-mix(in srgb,var(--tx) 14%,transparent)}
.r-avis-bande .avb-pl{position:absolute;inset:0;width:var(--f);overflow:hidden;transition:width .55s cubic-bezier(.5,0,.3,1);transition-delay:calc(.45s + var(--k) * .24s)}
.r-avis-bande .avb-pl svg{width:clamp(36px,4.4vw,58px);height:auto;right:auto}
.r-avis-bande .avb-p{fill:#f5b301;filter:drop-shadow(0 4px 10px rgb(245 179 1 / .35))}
.js .r-avis-bande .avb-et:not(.vu) .avb-pl{width:0}
.r-avis-bande .avb-tx{display:grid;gap:12px;justify-items:start}
.r-avis-bande .avb-tx h2.t{font-size:clamp(1.7rem,3vw,2.6rem)}
.r-avis-bande .avb-tx p{color:var(--tx2);font-size:1.05rem;max-width:40ch}
.r-avis-bande .avb-l{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
@media(max-width:980px){.r-avis-bande .avb{grid-template-columns:auto minmax(0,1fr)}.r-avis-bande .avb-tx{grid-column:1/-1}}
@media(max-width:600px){.r-avis-bande .avb{grid-template-columns:1fr;justify-items:center;text-align:center}.r-avis-bande .avb-note{padding-right:0;border-right:0}.r-avis-bande .avb-tx{justify-items:center}}
@media(prefers-reduced-motion:reduce){.r-avis-bande .avb-pl{transition:none}}
`; }
};

/* ── 3. une carte sobre « Note Google » ── */
const avisCarte = {
  id: 'avis.carte', rubrique: 'avis', nom: 'Carte Note Google',
  quand: 'une bonne note Google, pour un cabinet, un soin, un artisan soigné : une carte sobre à double filet (la note, les étoiles, le nombre d\'avis, le nom) qui s\'incline vers la souris, le texte et le bouton à côté',
  familles: ['cabinet', 'ecrin', 'atelier', 'comptoir', 'horizon'], ambiances: ['calme', 'premium', 'franc'], surfaces: ['fond', 'surface'], js: ['compteur', 'inclinaison'],
  besoin: besoinNote,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec), n = h.noteTexte(g);
    const carte = '<div class="avc-pose"' + h.rv('zoom', 1) + '><div class="avc-carte" data-tilt><p class="avc-lab">Note Google</p><p class="avc-n"><span data-compte="' + Number(g.note) + '" data-dec="1">' + n + '</span><small>/5</small></p>' + h.etoiles(g.note) + '<p class="avc-av">' + h.esc(g.avis + ' avis') + '</p><p class="avc-nom">' + h.esc(h.net(spec.nom)) + '</p></div></div>';
    return '<section class="' + h.classes('avis.carte', bloc, 'sec') + '" id="avis">' + h.fond(bloc) + '<div class="w avc"><div class="avc-tx"' + h.rv('monte') + '><h2 class="t">' + h.esc(g.avis + ' clients l\'ont noté sur Google') + '</h2><p>' + h.esc('Une note moyenne de ' + n + ' sur 5, telle qu\'elle apparaît sur la fiche Google de ' + h.net(spec.nom) + '.') + '</p>' + lienFiche(spec, h, 'avc-l') + h.boutons(spec, { seule: true }) + '</div>' + carte + '</div></section>';
  },
  css: function () { return sansCoupe('.r-avis-carte') + `
.r-avis-carte .avc{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:clamp(36px,6vw,100px);align-items:center}
.r-avis-carte .avc-tx{display:grid;gap:18px;justify-items:start}
.r-avis-carte .avc-tx p{color:var(--tx2);font-size:1.1rem;max-width:44ch}
.r-avis-carte .avc-l{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
.r-avis-carte .avc-pose{justify-self:center;width:min(100%,380px);perspective:900px}
.r-avis-carte .avc-carte{position:relative;overflow:hidden;display:grid;justify-items:center;gap:10px;text-align:center;padding:clamp(34px,4vw,48px) 28px clamp(30px,3.6vw,42px);background:var(--carte);color:var(--tx);border:1px solid var(--bord);border-radius:var(--r);box-shadow:var(--ombreF);transition:transform .5s var(--ease)}
.r-avis-carte .avc-carte::before{content:"";position:absolute;inset:10px;border:1px solid color-mix(in srgb,var(--acc) 40%,transparent);border-radius:calc(var(--r) * .7);pointer-events:none}
.r-avis-carte .avc-carte::after{content:"";position:absolute;top:0;bottom:0;left:-70%;width:45%;background:linear-gradient(100deg,transparent,rgb(255 255 255 / .22),transparent);transform:skewX(-16deg);transition:left 1.1s var(--ease);pointer-events:none}
.r-avis-carte .avc-carte:hover::after{left:135%}
.r-avis-carte .avc-lab{font-weight:var(--fxf);font-size:.98rem;color:var(--accT)}
.r-avis-carte .avc-n{display:flex;align-items:flex-start;gap:4px;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(4.4rem,8vw,6.2rem);line-height:.9;letter-spacing:-.03em}
.r-avis-carte .avc-n small{font-size:.34em;margin-top:.3em;color:var(--tx2);letter-spacing:0}
.r-avis-carte .avc-carte .etoiles .ic{width:24px;height:24px}
.r-avis-carte .avc-av{color:var(--tx2)}
.r-avis-carte .avc-nom{margin-top:8px;padding-top:14px;border-top:1px solid var(--bord);width:min(100%,240px);font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.15rem;line-height:1.15}
@media(max-width:860px){.r-avis-carte .avc{grid-template-columns:1fr}.r-avis-carte .avc-pose{order:-1}}
@media(prefers-reduced-motion:reduce){.r-avis-carte .avc-carte::after{transition:none}}
`; }
};

/* ── 4. cinq très grandes étoiles qui se remplissent jusqu'à la note ── */
const avisEtoiles = {
  id: 'avis.etoiles', rubrique: 'avis', nom: 'Cinq grandes étoiles',
  quand: 'toujours possible avec une bonne note Google : cinq très grandes étoiles qu\'une coulée dorée remplit jusqu\'à la note exacte, la note et le nombre d\'avis dessous',
  familles: [], ambiances: ['chaleureux', 'franc', 'premium', 'calme'], surfaces: ['surface', 'fond', 'champ'], js: ['compteur'],
  besoin: besoinNote,
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, g = h.noteGoogle(spec), n = h.noteTexte(g), v = Math.max(0, Math.min(5, Number(g.note)));
    const pleines = Math.floor(v), reste = +(v - pleines).toFixed(2);
    const rang = '<div class="ave-rang"' + h.rv('monte', 1, '--plein:calc(' + pleines + ' * (var(--e) + var(--g)) + ' + reste + ' * var(--e))') + ' aria-hidden="true"><div class="ave-vides">' + [0, 1, 2, 3, 4].map(function () { return etoile('ave-v'); }).join('') + '</div><div class="ave-pleines">' + [0, 1, 2, 3, 4].map(function () { return etoile('ave-p'); }).join('') + '</div></div>';
    return '<section class="' + h.classes('avis.etoiles', bloc, 'sec') + '" id="avis">' + h.fond(bloc) + '<div class="w ave"><h2 class="t"' + h.rv('monte') + '>' + h.esc(g.avis + ' clients l\'ont noté sur Google') + '</h2>' + rang + '<p class="ave-leg"' + h.rv('monte', 2) + '><b><span data-compte="' + Number(g.note) + '" data-dec="1">' + n + '</span> sur 5</b><span>' + h.esc('la note moyenne de ' + h.net(spec.nom) + ' sur sa fiche Google') + '</span></p>' + lienFiche(spec, h, 'ave-l') + '</div></section>';
  },
  css: function () { return sansCoupe('.r-avis-etoiles') + `
.r-avis-etoiles .ave{display:grid;justify-items:center;text-align:center;gap:clamp(22px,3vw,36px)}
.r-avis-etoiles .ave h2.t{max-width:18em}
.r-avis-etoiles .ave-rang{--e:clamp(52px,13vw,150px);--g:clamp(4px,1.2vw,16px);position:relative}
.r-avis-etoiles .ave-vides,.r-avis-etoiles .ave-pleines{display:flex;gap:var(--g)}
.r-avis-etoiles .ave-rang svg{width:var(--e);height:var(--e);flex:none}
.r-avis-etoiles .ave-v{fill:color-mix(in srgb,var(--tx) 9%,transparent);stroke:color-mix(in srgb,var(--tx) 26%,transparent);stroke-width:.6;stroke-linejoin:round}
.r-avis-etoiles .ave-pleines{position:absolute;inset:0;clip-path:inset(-10% calc(100% - var(--plein)) -10% -10%);transition:clip-path 2.3s cubic-bezier(.55,0,.25,1) .35s}
.r-avis-etoiles .ave-p{fill:#f5b301;stroke:#d99a00;stroke-width:.6;stroke-linejoin:round}
.js .r-avis-etoiles .ave-rang:not(.vu) .ave-pleines{clip-path:inset(-10% 100% -10% -10%)}
.r-avis-etoiles .ave-leg{display:grid;gap:4px;justify-items:center}
.r-avis-etoiles .ave-leg b{font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.8rem,3.4vw,2.8rem);line-height:1;color:var(--accT)}
.r-avis-etoiles .ave-leg>span{color:var(--tx2);font-size:1.08rem}
.r-avis-etoiles .ave-l{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--accT);text-decoration:none}
@media(prefers-reduced-motion:reduce){.r-avis-etoiles .ave-pleines{transition:none}}
`; }
};

module.exports = [avisPastille, avisBande, avisCarte, avisEtoiles];
