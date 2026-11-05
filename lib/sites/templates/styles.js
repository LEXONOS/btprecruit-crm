// Les styles des templates : ce qui fait qu'un même jeu de sections devient un design à part entière. Chaque style
// fixe sa voix typographique (parmi les polices auto-hébergées), ses angles, ses filets, sa respiration, ses
// sur-titres, ses boutons, son mouvement, et la teinte de sa page. Toujours clair (règle de Louis, nov. 2026) :
// la page est blanche, papier, béton clair, sable ou teintée, jamais noire.
'use strict';

// la base de toutes les pages des templates (classe x sur le corps)
const BASE = `
.x{--x-r:16px;--x-rc:20px;--x-sec:clamp(84px,10vw,150px);--x-trait:1px solid var(--bord,var(--ligne));--x-ombre:none;--x-h2:clamp(2.1rem,4.4vw,3.8rem)}
.x .sec{padding-block:var(--x-sec)}
.x .x-tete{display:grid;gap:14px;margin-bottom:clamp(34px,4.4vw,64px);max-width:64ch}
.x .x-tete.c{text-align:center;justify-items:center;margin-inline:auto}
.x .x-sur{width:fit-content;max-width:100%;display:inline-flex;align-items:center;gap:10px;font-size:.8rem;font-weight:var(--fxf);letter-spacing:.14em;text-transform:uppercase;color:var(--accT,var(--accentT));line-height:1.3}
.x .x-h2{font-size:var(--x-h2);line-height:1.02}
.x .x-phrase{color:var(--tx2,var(--doux));font-size:1.1rem;max-width:56ch}
.x .x-hph{font-size:clamp(1.06rem,1.35vw,1.28rem);line-height:1.5}
.x .x-faits{display:flex;flex-wrap:wrap;gap:10px 22px;font-size:.94rem;color:var(--tx2,var(--doux))}
.x .x-faits li{display:inline-flex;align-items:center;gap:8px}
.x .x-faits .ic{width:18px;height:18px;color:var(--accT,var(--accentT))}
.x .x-faits b{color:var(--tx,var(--encre))}
.x .x-ouvert{display:inline-flex;align-items:center;gap:10px;font-weight:var(--fxf)}
.x .x-ouvert i{width:9px;height:9px;flex:none;border-radius:50%;background:currentColor;opacity:.4}
.x .x-ouvert.est-ouvert i{background:#16a34a;opacity:1;box-shadow:0 0 0 0 rgb(22 163 74 / .5);animation:k-x-pouls 2s infinite}
.x .x-ouvert.est-ferme i{background:#dc2626;opacity:1}
@keyframes k-x-pouls{70%{box-shadow:0 0 0 .5em rgb(22 163 74 / 0)}100%{box-shadow:0 0 0 0 rgb(22 163 74 / 0)}}
.x .menu-m{background:var(--fond);color:var(--encre);--tx:var(--encre);--tx2:var(--doux);--btn:var(--accent);--btnT:var(--surA)}
.x .menu-m .b2{color:var(--encre)}
.x .burger[aria-expanded=true]{color:var(--encre)}
.x .page-h{padding-top:clamp(140px,15vw,200px)}
.x .horaires li{border-bottom-color:var(--bord,var(--ligne))}
.x .s-teinte .ph,.x .s-surface .ph{background:var(--fond)}
@media(prefers-reduced-motion:reduce){.x .x-ouvert.est-ouvert i{animation:none}}
`;

// teintes : la page et les bandes adoucies vers une couleur (béton, papier, sable...) ; calculées à partir de la palette,
// contrastes du texte revérifiés (styles.css)
const S = function (id, nom, types, boutons, mouvement, teintes, css) { return { id: id, nom: nom, types: types, boutons: boutons, mouvement: mouvement, teintes: teintes, css: css }; };
const STYLES = [
  S('net', 'Net', ['albert', 'hanken', 'schibsted', 'epilogue'], 'fleche', 'nette', null, `
.k-net{--x-r:8px;--x-rc:12px;--rb:8px;--x-h2:clamp(2rem,4vw,3.4rem)}
.k-net .x-sur::before{content:"";width:8px;height:8px;background:var(--acc,var(--accent));border-radius:1px}
.k-net .t{letter-spacing:-.035em}
`),
  S('chantier', 'Chantier', ['archivo', 'barlow', 'bigshoulders', 'schibsted'], 'plein', 'nette', { fond: ['#e6e4dd', 0.14], surface: ['#dedbd2', 0.2] }, `
.k-chantier{--x-r:2px;--x-rc:4px;--rb:3px;--x-trait:2px solid color-mix(in srgb,var(--encre) 85%,transparent);--x-h2:clamp(2.2rem,5vw,4.4rem)}
.k-chantier .x-sur{padding:6px 10px 5px;background:var(--acc,var(--accent));color:var(--btnT,var(--surA));letter-spacing:.12em}
.k-chantier .s-photo .x-sur{background:var(--btnP);color:var(--btnPT)}
.k-chantier .btn{text-transform:uppercase;letter-spacing:.06em;font-size:.92rem}
`),
  S('papier', 'Papier', ['newsreader', 'fraunces', 'youngserif', 'besley'], 'contour', 'douce', { fond: ['#f5efe3', 0.34], surface: ['#ece3d2', 0.38] }, `
.k-papier{--x-r:3px;--x-rc:4px;--rb:2px;--x-h2:clamp(2.2rem,4.8vw,4.2rem)}
.k-papier .x-sur{font-family:var(--ft);font-style:italic;text-transform:none;letter-spacing:0;font-size:1.05rem;font-weight:400}
.k-papier .x-sur::before{content:"";width:34px;height:1px;background:currentColor}
.k-papier .btn{text-transform:none;letter-spacing:0}
`),
  S('doux', 'Doux', ['bricolage', 'albert', 'hanken', 'fraunces'], 'pilule', 'vive', null, `
.k-doux{--x-r:28px;--x-rc:28px;--rb:999px;--x-ombre:0 30px 60px -36px rgb(16 24 40 / .35)}
.k-doux .x-sur{padding:7px 14px;border-radius:999px;background:var(--teinte);color:var(--teinteT);letter-spacing:.06em;text-transform:none;font-size:.88rem}
.k-doux .s-teinte .x-sur{background:var(--fond)}
.k-doux .s-photo .x-sur{background:rgb(255 255 255 / .18);color:#fff;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.k-doux .btn{text-transform:none;letter-spacing:0}
`),
  S('luxe', 'Luxe', ['bodoni', 'fraunces', 'newsreader'], 'contour', 'douce', { fond: ['#f7f2ec', 0.2] }, `
.k-luxe{--x-r:0px;--x-rc:0px;--rb:0px;--x-sec:clamp(96px,12vw,180px);--x-h2:clamp(2.3rem,5vw,4.6rem)}
.k-luxe .x-sur{font-size:.74rem;letter-spacing:.32em;font-weight:500}
.k-luxe .t{font-weight:400}
.k-luxe .btn{text-transform:uppercase;letter-spacing:.18em;font-size:.82rem;font-weight:500}
`),
  S('lagon', 'Lagon', ['jost', 'hanken', 'albert', 'unbounded'], 'brillance', 'douce', null, `
.k-lagon{--x-r:20px;--x-rc:24px;--rb:999px;--x-h2:clamp(2.1rem,4.6vw,4rem)}
.k-lagon .x-sur{letter-spacing:.2em;font-size:.76rem}
.k-lagon .x-sur::before{content:"";width:22px;height:2px;border-radius:2px;background:currentColor}
.k-lagon .btn{text-transform:none;letter-spacing:.01em}
`),
  S('atelier', 'Atelier', ['epilogue', 'schibsted', 'bricolage', 'archivo'], 'glisse', 'nette', { fond: ['#f1ece2', 0.12] }, `
.k-atelier{--x-r:10px;--x-rc:14px;--rb:10px;--x-h2:clamp(2.1rem,4.6vw,4rem)}
.k-atelier .x-sur{gap:12px}
.k-atelier .x-sur::before{content:"";width:18px;height:18px;border-radius:50%;border:2px solid currentColor;background:radial-gradient(circle,currentColor 32%,transparent 36%)}
.k-atelier .btn{text-transform:none;letter-spacing:0}
`),
  S('gourmand', 'Gourmand', ['youngserif', 'besley', 'fraunces', 'bricolage'], 'pilule', 'vive', { fond: ['#fbf3e4', 0.3], surface: ['#f3e6cf', 0.3] }, `
.k-gourmand{--x-r:22px;--x-rc:24px;--rb:999px;--x-h2:clamp(2.2rem,5vw,4.4rem)}
.k-gourmand .x-sur{font-family:var(--ft);text-transform:none;letter-spacing:0;font-size:1.1rem;font-weight:400}
.k-gourmand .x-sur::before,.k-gourmand .x-sur::after{content:"✦";font-size:.7em;opacity:.7}
.k-gourmand .btn{text-transform:none;letter-spacing:0}
`),
  S('clinique', 'Clinique', ['hanken', 'albert', 'schibsted', 'newsreader'], 'fleche', 'douce', null, `
.k-clinique{--x-r:16px;--x-rc:20px;--rb:12px;--x-ombre:0 24px 50px -34px rgb(16 24 40 / .3);--x-h2:clamp(2rem,4.2vw,3.6rem)}
.k-clinique .x-sur{padding:6px 12px;border-radius:999px;border:1px solid color-mix(in srgb,currentColor 35%,transparent);letter-spacing:.1em;font-size:.74rem}
.k-clinique .btn{text-transform:none;letter-spacing:0}
`),
  S('pop', 'Pop', ['unbounded', 'epilogue', 'schibsted', 'bigshoulders'], 'plein', 'vive', null, `
.k-pop{--x-r:0px;--x-rc:0px;--rb:0px;--x-trait:2px solid var(--encre);--x-h2:clamp(2.2rem,5.2vw,4.6rem)}
.k-pop .x-sur{padding:6px 10px;border:2px solid currentColor;letter-spacing:.1em}
.k-pop .btn{box-shadow:4px 4px 0 var(--encre);text-transform:none;letter-spacing:0}
.k-pop .s-photo .btn{box-shadow:4px 4px 0 rgb(0 0 0 / .45)}
.k-pop .btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--encre)}
`),
  S('mineral', 'Minéral', ['hanken', 'archivo', 'albert', 'schibsted'], 'glisse', 'nette', { fond: ['#eef1f4', 0.12], surface: ['#e4e9ee', 0.25] }, `
.k-mineral{--x-r:6px;--x-rc:8px;--rb:6px;--x-h2:clamp(2.1rem,4.6vw,3.9rem)}
.k-mineral .x-sur{font-variant-numeric:tabular-nums}
.k-mineral .x-sur::before{content:"";width:28px;height:1.5px;background:currentColor}
.k-mineral .btn{text-transform:none;letter-spacing:0}
`),
  S('tropical', 'Tropical', ['bricolage', 'epilogue', 'albert', 'jost'], 'pilule', 'vive', { fond: ['#f3f6ea', 0.14] }, `
.k-tropical{--x-r:24px;--x-rc:26px;--rb:999px;--x-h2:clamp(2.2rem,5vw,4.3rem)}
.k-tropical .x-sur{padding:7px 14px;border-radius:999px;background:var(--teinte);color:var(--teinteT);text-transform:none;letter-spacing:.04em;font-size:.88rem}
.k-tropical .s-teinte .x-sur{background:var(--fond)}
.k-tropical .s-photo .x-sur{background:rgb(255 255 255 / .2);color:#fff}
.k-tropical .btn{text-transform:none;letter-spacing:0}
`)
];
const PAR_ID = {};
STYLES.forEach(function (s) { PAR_ID[s.id] = s; });

module.exports = { BASE, STYLES, PAR_ID };
