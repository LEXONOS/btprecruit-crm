// Rendu déterministe d'un site à partir de sa fiche (spec) : HTML et CSS faits main, aucun framework, aucune
// requête vers un tiers (polices servies depuis /_f/, pas de cookie, pas de traceur). Même fiche = mêmes fichiers.
// Aperçu : une page + mentions légales, bandeau « aperçu », noindex. En ligne : la formule décide des pages.
'use strict';
const T = require('./theme');
const MQ = require('../martinique');
const { NOVALEMO } = require('../config');

const HEBERGEUR = 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis';

/* ── échappement ── */
const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
// **mot** = mot mis en valeur (une fois par titre)
// la ponctuation qui suit le mot mis en valeur reste collée à lui (sinon elle peut passer seule à la ligne)
function avecAccent(s) { return esc(String(s || '').replace(/\*\*(.+?)\*\*([,.;:!?…»)]+)/, '**$1$2**')).replace(/\*\*(.+?)\*\*/, '<em>$1</em>').replace(/\*\*/g, ''); }
function sansMarques(s) { return String(s || '').replace(/\*\*/g, ''); }
function slugifier(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'page'; }

/* ── liens d'action ── */
function telHref(t) { const e = MQ.e164(t); return e ? 'tel:' + e : null; }
function waHref(t, texte) { const e = MQ.e164(t); return e && MQ.mobile(t) ? 'https://wa.me/' + e.replace('+', '') + '?text=' + encodeURIComponent(texte || 'Bonjour') : null; }
function mailHref(email, sujet, corps) { return email ? 'mailto:' + email + '?subject=' + encodeURIComponent(sujet) + (corps ? '&body=' + encodeURIComponent(corps) : '') : null; }
const OBJECTIFS = {
  devis: { sujet: 'Demande de devis', corps: 'Bonjour,\n\nJe souhaite un devis pour :\n\nAdresse ou commune :\nMon téléphone :\n\nMerci' },
  appel: { sujet: 'Demande de rappel', corps: 'Bonjour,\n\nPouvez-vous me rappeler au :\n\nMerci' },
  reservation: { sujet: 'Demande de rendez-vous', corps: 'Bonjour,\n\nJe souhaite un rendez-vous pour :\nMes disponibilités :\nMon téléphone :\n\nMerci' },
  visite: { sujet: 'Renseignements', corps: 'Bonjour,\n\n' },
  inscription: { sujet: 'Demande d\'inscription', corps: 'Bonjour,\n\nJe souhaite des informations pour une inscription :\nMon téléphone :\n\nMerci' }
};
// action principale du site : email préparé, sinon WhatsApp, sinon téléphone
function actionPrincipale(spec) {
  const c = spec.contact || {}, o = OBJECTIFS[spec.objectif] || OBJECTIFS.devis;
  const m = mailHref(c.email, o.sujet + (spec.nom ? ' : ' + sansMarques(spec.nom) : ''), o.corps);
  if (m && spec.objectif !== 'appel') return { href: m, texte: spec.cta || 'Nous écrire' };
  const w = waHref(c.tel, o.sujet);
  if (w) return { href: w, texte: spec.cta || 'Écrire sur WhatsApp', ext: true };
  const t = telHref(c.tel);
  if (t) return { href: t, texte: spec.cta || 'Appeler' };
  return m ? { href: m, texte: spec.cta || 'Nous écrire' } : null;
}

/* ── feuille de style ── */
function css(p, pol, compo) {
  const ft = T.FICHIERS_POLICES[pol.titre], fx = T.FICHIERS_POLICES[pol.texte];
  const face = function (f) { return '@font-face{font-family:"' + f.famille + '";src:url(/_f/' + f.fichier + ') format("woff2");font-weight:' + f.poids + ';' + (f.etirement ? 'font-stretch:' + f.etirement + ';' : '') + 'font-display:swap}'; };
  return face(ft) + (fx !== ft ? face(fx) : '') + `
:root{--fond:${p.fond};--encre:${p.encre};--encre2:${p.encre2};--accent:${p.accent};--accent2:${p.accent2};--accentT:${p.accentTexte};--surA:${p.surAccent};--doux:${p.doux};--adoux:${p.accentDoux};--ligne:${p.ligne};--ft:"${ft.famille}",ui-sans-serif,system-ui,sans-serif;--fx:"${fx.famille}",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--w:1180px;--g:clamp(18px,4.2vw,44px);--r:14px}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;background:var(--fond);color:var(--encre);font:400 1.0625rem/1.62 var(--fx);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:hidden}
img,svg{display:block;max-width:100%}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}
:focus-visible{outline:2.5px solid var(--accent);outline-offset:3px;border-radius:6px}
.w{width:min(var(--w),100% - 2*var(--g));margin-inline:auto}
.saut{position:absolute;left:-999px;top:8px;background:var(--encre);color:var(--fond);padding:10px 14px;border-radius:8px;z-index:99}.saut:focus{left:8px}
.ic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.t{font-family:var(--ft);font-weight:${pol.poids};font-variation-settings:${pol.reglage};letter-spacing:${pol.interlettre};line-height:${pol.hauteur};text-wrap:balance;margin:0}
.t em{font-style:normal;color:var(--accentT)}
.sur .t em,.bandeau-h .t em,.h-photo .t em{color:inherit;text-decoration:none;background:linear-gradient(currentColor,currentColor) 0 96%/100% .07em no-repeat}
h2.t{font-size:clamp(2rem,4.6vw,3.6rem)}
h3{font:650 1.15rem/1.3 var(--fx);margin:0;letter-spacing:-.01em}
p{margin:0}
.k{display:inline-flex;align-items:center;gap:10px;font:600 .78rem/1 var(--fx);letter-spacing:.14em;text-transform:uppercase;color:var(--encre2)}
.k::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 5px var(--adoux)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 24px;border-radius:999px;font:650 1rem/1 var(--fx);text-decoration:none;border:1.5px solid transparent;transition:transform .25s cubic-bezier(.2,.7,0,1),background-color .25s,color .25s,border-color .25s;cursor:pointer;white-space:nowrap}
.btn .ic{width:19px;height:19px;transition:transform .3s cubic-bezier(.2,.7,0,1)}
.btn-plein{background:var(--accent);color:var(--surA)}
.btn-plein:hover{transform:translateY(-2px)}.btn-plein:hover .ic{transform:translateX(3px)}
.btn-ligne{border-color:currentColor;color:var(--encre)}
.btn-ligne:hover{background:var(--encre);color:var(--fond);border-color:var(--encre)}
.actions{display:flex;flex-wrap:wrap;gap:12px}
/* en-tête */
.tete{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--fond) 86%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid transparent;transition:border-color .3s}
.tete.colle{border-bottom-color:var(--ligne)}
.tete .w{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:70px}
.marque{display:flex;align-items:center;gap:10px;text-decoration:none;font:700 1.08rem/1.1 var(--ft);font-variation-settings:${pol.reglage};letter-spacing:-.02em;max-width:60%}
.marque i{width:10px;height:10px;border-radius:3px;background:var(--accent);flex:none;transform:rotate(45deg)}
.marque img{height:40px;width:auto;max-width:180px;object-fit:contain}
.nav{display:flex;align-items:center;gap:26px;font:550 .95rem/1 var(--fx)}
.nav a{text-decoration:none;position:relative;padding:6px 0}
.nav a:not(.btn)::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.5px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.2,.7,0,1)}
.nav a:not(.btn):hover::after,.nav a[aria-current]::after{transform:scaleX(1)}
.nav .btn{min-height:44px;padding:0 18px;font-size:.92rem}
@media(max-width:860px){.nav a:not(.btn){display:none}}
/* héros */
.hero{padding:clamp(48px,9vw,120px) 0 clamp(40px,6vw,80px);position:relative}
.hero .t.h1{font-size:clamp(2.8rem,8.4vw,8.6rem);margin:22px 0 0;max-width:14.5ch}
.h-editorial .t.h1{font-size:clamp(2.6rem,6.4vw,5.6rem);max-width:13ch}
.hero-bas{display:grid;grid-template-columns:minmax(0,1.1fr) auto;gap:28px 48px;align-items:end;margin-top:clamp(28px,4vw,48px)}
.chapo{font-size:clamp(1.08rem,1.5vw,1.26rem);line-height:1.55;color:var(--encre2);max-width:48ch}
.preuves{list-style:none;padding:0;margin:clamp(34px,5vw,60px) 0 0;display:flex;flex-wrap:wrap;gap:12px 34px;font-size:.95rem;color:var(--encre2);border-top:1px solid var(--ligne);padding-top:20px}
.preuves li{display:flex;align-items:center;gap:10px}
.preuves b{font:700 1.5rem/1 var(--ft);color:var(--encre);letter-spacing:-.02em}
.preuves .ic{color:var(--accentT)}
.etoiles{display:inline-flex;gap:2px;color:var(--accent2)}.etoiles .ic{width:15px;height:15px;fill:currentColor;stroke:none}
@media(max-width:760px){.hero-bas{grid-template-columns:1fr}}
.h-editorial .grille{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:clamp(28px,5vw,72px);align-items:center}
.carte{background:var(--doux);border-radius:calc(var(--r)*1.6);padding:clamp(24px,3vw,36px);display:grid;gap:18px}
.carte .gros{width:56px;height:56px;border-radius:16px;background:var(--accent);color:var(--surA);display:grid;place-items:center}
.carte .gros .ic{width:28px;height:28px}
.carte ul{list-style:none;margin:0;padding:0;display:grid;gap:0}
.carte li{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-top:1px solid var(--ligne);font-weight:550}
.carte li span{color:var(--encre2);font-weight:450}
@media(max-width:860px){.h-editorial .grille{grid-template-columns:1fr}}
.bandeau-h{background:var(--accent);color:var(--surA)}
.bandeau-h .k{color:inherit;opacity:.86}.bandeau-h .k::before{background:var(--surA);box-shadow:0 0 0 5px color-mix(in srgb,var(--surA) 22%,transparent)}
.bandeau-h .chapo{color:inherit;opacity:.88}
.bandeau-h .btn-plein{background:var(--surA);color:var(--accent)}
.bandeau-h .btn-ligne{color:var(--surA)}.bandeau-h .btn-ligne:hover{background:var(--surA);color:var(--accent);border-color:var(--surA)}
.bandeau-h .preuves{border-top-color:color-mix(in srgb,var(--surA) 30%,transparent);color:inherit}.bandeau-h .preuves b{color:inherit}.bandeau-h .preuves .ic{color:inherit}
.puces{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px;list-style:none;padding:0}
.puces li{border:1px solid color-mix(in srgb,var(--surA) 40%,transparent);border-radius:999px;padding:8px 14px;font-size:.9rem}
.h-photo{color:#fff;padding:0;min-height:min(88vh,820px);display:flex;align-items:flex-end;isolation:isolate}
.h-photo .fondimg{position:absolute;inset:0;z-index:-2}.h-photo .fondimg img{width:100%;height:100%;object-fit:cover}
.h-photo::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(0,0,0,.18) 0%,rgba(0,0,0,.28) 40%,rgba(0,0,0,.78) 100%)}
.h-photo .w{padding:clamp(120px,18vw,220px) 0 clamp(36px,5vw,64px)}
.h-photo .k,.h-photo .chapo,.h-photo .preuves{color:rgba(255,255,255,.86)}.h-photo .k::before{background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,.25)}
.h-photo .btn-ligne{color:#fff}.h-photo .btn-ligne:hover{background:#fff;color:#111;border-color:#fff}
.h-photo .preuves{border-top-color:rgba(255,255,255,.28)}.h-photo .preuves b{color:#fff}.h-photo .preuves .ic{color:#fff}
/* bande qui défile */
.defile{overflow:hidden;border-block:1px solid var(--ligne);padding:clamp(16px,2.2vw,26px) 0;user-select:none}
.piste{display:flex;width:max-content;animation:defile 46s linear infinite}
.piste span{font:${pol.poids} clamp(1.7rem,4.2vw,3.4rem)/1 var(--ft);font-variation-settings:${pol.reglage};letter-spacing:-.02em;padding-right:.9em;white-space:nowrap;display:flex;align-items:center;gap:.9em}
.piste span:nth-child(even){color:transparent;-webkit-text-stroke:1.3px var(--encre)}
.piste span::after{content:"";width:.32em;height:.32em;border-radius:50%;background:var(--accent);flex:none}
@keyframes defile{to{transform:translateX(-50%)}}
/* sections */
.sec{padding:clamp(70px,10vw,140px) 0}
.sec-tete{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.8fr);gap:24px 60px;align-items:end;margin-bottom:clamp(36px,5vw,64px)}
.sec-tete p{color:var(--encre2);font-size:1.1rem;max-width:46ch}
@media(max-width:860px){.sec-tete{grid-template-columns:1fr}}
.services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.services.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.services.n5{grid-template-columns:repeat(6,minmax(0,1fr))}.services.n5>*{grid-column:span 2}.services.n5>:nth-child(-n+2){grid-column:span 3}
@media(max-width:980px){.services,.services.n5{grid-template-columns:repeat(2,minmax(0,1fr))}.services.n5>*,.services.n5>:nth-child(-n+2){grid-column:auto}}
@media(max-width:620px){.services,.services.n4,.services.n5{grid-template-columns:1fr}}
.service{background:var(--doux);border-radius:var(--r);padding:clamp(24px,2.6vw,32px);display:grid;gap:14px;align-content:start;position:relative;text-decoration:none}
.service .no{position:absolute;top:22px;right:24px;font:600 .82rem/1 var(--fx);color:var(--encre2);letter-spacing:.08em}
.service .pic{width:48px;height:48px;border-radius:14px;background:var(--fond);color:var(--accentT);display:grid;place-items:center}
.service p{color:var(--encre2)}
a.service{transition:transform .35s cubic-bezier(.2,.7,0,1),background-color .35s}
a.service:hover{transform:translateY(-4px);background:var(--adoux)}
a.service .plus{display:inline-flex;align-items:center;gap:8px;font-weight:650;color:var(--accentT);margin-top:4px}
.liste-num{list-style:none;margin:0;padding:0;border-top:1px solid var(--ligne)}
.liste-num li{display:grid;grid-template-columns:88px minmax(0,1fr) minmax(0,1.3fr);gap:18px 32px;padding:clamp(22px,3vw,34px) 0;border-bottom:1px solid var(--ligne);align-items:baseline}
.liste-num .n{font:${pol.poids} 2.4rem/1 var(--ft);font-variation-settings:${pol.reglage};color:var(--accentT)}
.liste-num h3{font:650 1.35rem/1.25 var(--fx)}
.liste-num p{color:var(--encre2)}
@media(max-width:760px){.liste-num li{grid-template-columns:56px 1fr}.liste-num p{grid-column:2}}
.atouts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(28px,4vw,56px)}
.atout{border-top:2px solid var(--encre);padding-top:22px;display:grid;gap:12px;align-content:start}
.atout .n{font:${pol.poids} clamp(2.6rem,5vw,4.2rem)/1 var(--ft);font-variation-settings:${pol.reglage};color:var(--accentT);letter-spacing:-.04em}
.atout p{color:var(--encre2)}
@media(max-width:860px){.atouts{grid-template-columns:1fr}}
.etapes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;counter-reset:e}
.etape{border:1px solid var(--ligne);border-radius:var(--r);padding:28px;display:grid;gap:12px;align-content:start;counter-increment:e}
.etape::before{content:"0" counter(e);font:600 .82rem/1 var(--fx);letter-spacing:.1em;color:var(--surA);background:var(--accent);width:max-content;padding:7px 10px;border-radius:999px}
.etape p{color:var(--encre2)}
@media(max-width:860px){.etapes{grid-template-columns:1fr}}
.galerie{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:clamp(140px,18vw,230px);gap:12px}
.galerie figure{margin:0;border-radius:var(--r);overflow:hidden;background:var(--doux);grid-column:span 2}
.galerie figure:nth-child(1){grid-column:span 4;grid-row:span 2}
.galerie img{width:100%;height:100%;object-fit:cover}
@media(max-width:760px){.galerie{grid-template-columns:1fr 1fr}.galerie figure,.galerie figure:nth-child(1){grid-column:span 1;grid-row:span 1}.galerie figure:nth-child(1){grid-column:span 2}}
.appel{background:var(--encre);color:var(--fond);border-radius:calc(var(--r)*2);padding:clamp(40px,7vw,96px) clamp(24px,5vw,72px);display:grid;gap:30px;position:relative;overflow:hidden}
.appel .t{font-size:clamp(2.2rem,5.6vw,4.8rem);max-width:16ch}
.appel .t em{color:var(--accent)}
.appel .btn-ligne{color:var(--fond)}.appel .btn-ligne:hover{background:var(--fond);color:var(--encre);border-color:var(--fond)}
.appel .gros-tel{font:${pol.poids} clamp(1.6rem,3.6vw,2.6rem)/1 var(--ft);font-variation-settings:${pol.reglage};text-decoration:none;letter-spacing:-.02em}
.faq{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,80px)}
.faq details{border-bottom:1px solid var(--ligne)}
.faq details:first-of-type{border-top:1px solid var(--ligne)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:20px;padding:22px 0;font:600 1.1rem/1.35 var(--fx)}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"";width:14px;height:14px;flex:none;margin-top:5px;background:linear-gradient(currentColor,currentColor) center/100% 1.8px no-repeat,linear-gradient(currentColor,currentColor) center/1.8px 100% no-repeat;transition:transform .35s cubic-bezier(.2,.7,0,1)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{padding:0 0 22px;color:var(--encre2);max-width:62ch}
@media(max-width:860px){.faq{grid-template-columns:1fr}}
.contact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(30px,5vw,80px);align-items:start}
.infos{list-style:none;margin:0;padding:0;display:grid}
.infos>li{display:grid;grid-template-columns:44px minmax(0,1fr);gap:16px;padding:18px 0;border-bottom:1px solid var(--ligne)}
.infos>li:first-child{border-top:1px solid var(--ligne)}
.infos .pic{width:44px;height:44px;border-radius:12px;background:var(--doux);color:var(--accentT);display:grid;place-items:center}
.infos small{display:block;font:600 .74rem/1.2 var(--fx);letter-spacing:.12em;text-transform:uppercase;color:var(--encre2);margin-bottom:4px}
.infos a{font-weight:600;text-decoration:none}.infos a:hover{text-decoration:underline}
.horaires{margin:4px 0 0;padding:0;list-style:none;font-size:.95rem;color:var(--encre2);display:grid;gap:2px}
.horaires li::first-letter{text-transform:uppercase}
@media(max-width:860px){.contact{grid-template-columns:1fr}}
/* pied */
.pied{padding:clamp(56px,8vw,100px) 0 30px;border-top:1px solid var(--ligne);overflow:hidden}
.pied .signe{font:${pol.poids} min(13rem,calc(min(100vw - 2*var(--g),var(--w)) / (var(--n) * ${pol.chasse || 0.55})))/1.05 var(--ft);font-variation-settings:${pol.reglage};letter-spacing:-.045em;margin:0 0 36px;padding-top:.06em;color:transparent;-webkit-text-stroke:1.2px var(--encre);white-space:nowrap}
.pied .bas{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px 30px;font-size:.9rem;color:var(--encre2)}
.pied .bas a{color:inherit}
.studio{display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.studio i{width:7px;height:7px;border-radius:50%;background:#2c4bff;box-shadow:0 0 0 3px rgba(255,212,0,.6)}
/* pages intérieures */
.page-h{padding:clamp(56px,8vw,110px) 0 clamp(30px,4vw,50px);border-bottom:1px solid var(--ligne)}
.page-h .t{font-size:clamp(2.4rem,6vw,4.8rem);margin-top:18px;max-width:18ch}
.prose{max-width:72ch;display:grid;gap:18px;color:var(--encre2)}
.prose h2{font:650 1.35rem/1.3 var(--fx);color:var(--encre);margin:22px 0 0}
.prose strong{color:var(--encre)}
/* aperçu */
.apercu{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:60;width:min(760px,calc(100% - 24px));background:#0f1115;color:#fff;border-radius:18px;padding:12px 12px 12px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 18px 50px rgba(0,0,0,.28);font:500 .92rem/1.35 var(--fx)}
.apercu b{font-weight:700}
.apercu a{flex:none;background:#fff;color:#0f1115;text-decoration:none;font-weight:700;border-radius:12px;padding:11px 16px}
.apercu .court{display:none}
@media(max-width:560px){.apercu{padding:10px 10px 10px 16px;bottom:10px;border-radius:14px;font-size:.86rem}.apercu .long{display:none}.apercu .court{display:inline}.apercu a{padding:10px 14px}}
body.a-apercu .pied{padding-bottom:120px}
/* mouvement : seulement si le visiteur l'accepte */
.js .rv{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.7,0,1),transform .9s cubic-bezier(.2,.7,0,1)}
.js .rv.vu{opacity:1;transform:none}
.js .mots .m{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.06em;margin-bottom:-.06em}
.js .mots .m>span{display:inline-block;transform:translateY(108%);transition:transform 1s cubic-bezier(.2,.7,0,1);transition-delay:calc(var(--i)*55ms + 80ms)}
.js .mots.vu .m>span{transform:none}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.piste{animation:none}.js .rv,.js .mots .m>span{opacity:1;transform:none;transition:none}}
`.replace(/\n\s*/g, '');
}

const JS = `(function(){var d=document.documentElement;d.classList.add('js');var r=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('.mots').forEach(function(h){var k=0;function decoupe(n){Array.prototype.slice.call(n.childNodes).forEach(function(c){if(c.nodeType===3){var f=document.createDocumentFragment();c.textContent.split(/(\\s+)/).forEach(function(w){if(!w)return;if(/^\\s+$/.test(w)){f.appendChild(document.createTextNode(w));return}var o=document.createElement('span');o.className='m';var i=document.createElement('span');i.style.setProperty('--i',k++);i.textContent=w;o.appendChild(i);f.appendChild(o)});n.replaceChild(f,c)}else if(c.nodeType===1){decoupe(c)}})}decoupe(h)});
var vus=document.querySelectorAll('.rv,.mots');if(r||!('IntersectionObserver' in window)){vus.forEach(function(e){e.classList.add('vu')})}else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('vu');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});vus.forEach(function(e){io.observe(e)})}
var t=document.querySelector('.tete');if(t){var f=function(){t.classList.toggle('colle',scrollY>8)};f();addEventListener('scroll',f,{passive:true})}})();`;

/* ── morceaux de page ── */
function etoiles(note) { let h = '<span class="etoiles" aria-hidden="true">'; for (let k = 0; k < 5; k++) h += k < Math.round(note) ? T.icone('etoile') : ''; return h + '</span>'; }
function preuves(spec) {
  const out = [], g = spec.google, c = spec.contact || {};
  if (g && g.note && g.avis >= 3) out.push('<li><b>' + String(g.note).replace('.', ',') + '</b>' + etoiles(g.note) + '<span>' + g.avis + ' avis Google</span></li>');
  if (spec.commune) out.push('<li>' + T.icone('pin') + '<span>' + esc(spec.zone || ('Basés à ' + spec.commune)) + '</span></li>');
  else if (spec.zone) out.push('<li>' + T.icone('pin') + '<span>' + esc(spec.zone) + '</span></li>');
  if (c.tel) out.push('<li>' + T.icone('tel') + '<span>' + esc(MQ.affiche(c.tel)) + '</span></li>');
  return out.length ? '<ul class="preuves rv">' + out.join('') + '</ul>' : '';
}
function boutons(spec, inverse) {
  const a = actionPrincipale(spec), c = spec.contact || {}, t = telHref(c.tel);
  let h = '<div class="actions">';
  if (a) h += '<a class="btn btn-plein" href="' + esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(a.texte) + T.icone('fleche') + '</a>';
  if (t && (!a || a.href !== t)) h += '<a class="btn btn-ligne" href="' + esc(t) + '">' + T.icone('tel') + esc(MQ.affiche(c.tel)) + '</a>';
  else if (c.email && a && a.href.indexOf('mailto:') !== 0) h += '<a class="btn btn-ligne" href="mailto:' + esc(c.email) + '">' + T.icone('mail') + 'Écrire</a>';
  return h + '</div>';
}
function kicker(spec) { return '<p class="k">' + esc([spec.activite, spec.commune ? spec.commune + ', Martinique' : 'Martinique'].filter(Boolean).join(' · ')) + '</p>'; }

function hero(spec, ctx) {
  const compo = ctx.compo;
  const h1 = '<h1 class="t h1 mots">' + avecAccent(spec.accroche) + '</h1>';
  const chapo = '<p class="chapo">' + esc(spec.chapo) + '</p>';
  if (compo === 'photo' && ctx.photos[0]) {
    return '<section class="hero h-photo" aria-label="Présentation"><div class="fondimg">' + img(ctx.photos[0], ctx, 'eager', '100vw') + '</div><div class="w">' + kicker(spec) + h1 + '<div class="hero-bas"><div class="rv">' + chapo + '</div><div class="rv">' + boutons(spec) + '</div></div>' + preuves(spec) + '</div></section>';
  }
  if (compo === 'editorial') {
    const lignes = (spec.services || []).slice(0, 3).map(function (s) { return '<li>' + esc(s.titre) + '<span>' + T.icone(s.icone || 'check') + '</span></li>'; }).join('');
    return '<section class="hero h-editorial" aria-label="Présentation"><div class="w grille"><div>' + kicker(spec) + h1 + '<div class="rv" style="margin-top:28px;display:grid;gap:26px">' + chapo + boutons(spec) + '</div></div><aside class="carte rv"><span class="gros">' + T.icone(ctx.iconeMetier) + '</span><b style="font:650 1.15rem/1.3 var(--fx)">' + esc(spec.activite || 'Nos services') + '</b><ul>' + lignes + '</ul></aside></div><div class="w">' + preuves(spec) + '</div></section>';
  }
  if (compo === 'bandeau') {
    const puces = (spec.services || []).slice(0, 5).map(function (s) { return '<li>' + esc(s.titre) + '</li>'; }).join('');
    return '<section class="hero bandeau-h" aria-label="Présentation"><div class="w">' + kicker(spec) + h1 + '<div class="hero-bas"><div class="rv">' + chapo + '<ul class="puces">' + puces + '</ul></div><div class="rv">' + boutons(spec) + '</div></div>' + preuves(spec) + '</div></section>';
  }
  return '<section class="hero h-affiche" aria-label="Présentation"><div class="w">' + kicker(spec) + h1 + '<div class="hero-bas"><div class="rv">' + chapo + '</div><div class="rv">' + boutons(spec) + '</div></div>' + preuves(spec) + '</div></section>';
}
function defile(spec) {
  const mots = (spec.defile && spec.defile.length ? spec.defile : (spec.services || []).map(function (s) { return s.titre; })).slice(0, 8);
  if (mots.length < 3) return '';
  const bloc = mots.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
  return '<div class="defile" aria-hidden="true"><div class="piste">' + bloc + bloc + '</div></div>';
}
function sectionServices(spec, ctx, avecLiens) {
  const cartes = (spec.services || []).map(function (s, k) {
    const inner = '<span class="no">' + String(k + 1).padStart(2, '0') + '</span><span class="pic">' + T.icone(s.icone || ctx.iconeMetier) + '</span><h3>' + esc(s.titre) + '</h3><p>' + esc(s.texte) + '</p>';
    return avecLiens ? '<a class="service rv" href="' + esc(ctx.lien('services/' + slugifier(s.titre) + '/')) + '">' + inner + '<span class="plus">En savoir plus' + T.icone('fleche') + '</span></a>' : '<article class="service rv">' + inner + '</article>';
  }).join('');
  return '<section class="sec" id="services"><div class="w"><div class="sec-tete"><h2 class="t rv">' + avecAccent(spec.titre_services || 'Ce que nous **faisons**') + '</h2><p class="rv">' + esc(spec.intro_services || '') + '</p></div><div class="services n' + (spec.services || []).length + '">' + cartes + '</div></div></section>';
}
function sectionAtouts(spec) {
  if (!spec.atouts || !spec.atouts.length) return '';
  return '<section class="sec" id="atouts" style="background:var(--doux)"><div class="w"><div class="sec-tete"><h2 class="t rv">' + avecAccent(spec.titre_atouts || 'Pourquoi nous **appeler**') + '</h2></div><div class="atouts">' + spec.atouts.slice(0, 3).map(function (a, k) { return '<div class="atout rv"><span class="n">0' + (k + 1) + '</span><h3>' + esc(a.titre) + '</h3><p>' + esc(a.texte) + '</p></div>'; }).join('') + '</div></div></section>';
}
function sectionEtapes(spec) {
  if (!spec.etapes || !spec.etapes.length) return '';
  return '<section class="sec" id="methode"><div class="w"><div class="sec-tete"><h2 class="t rv">' + avecAccent(spec.titre_etapes || 'Comment ça **se passe**') + '</h2></div><div class="etapes">' + spec.etapes.slice(0, 3).map(function (e) { return '<div class="etape rv"><h3>' + esc(e.titre) + '</h3><p>' + esc(e.texte) + '</p></div>'; }).join('') + '</div></div></section>';
}
function sectionGalerie(ctx) {
  const ph = ctx.photos.slice(ctx.compo === 'photo' ? 1 : 0, 6);
  if (ph.length < 2) return '';
  return '<section class="sec" id="images" style="padding-top:0"><div class="w"><div class="galerie">' + ph.map(function (p, k) { return '<figure class="rv">' + img(p, ctx, 'lazy', k === 0 ? '(max-width:760px) 100vw, 66vw' : '(max-width:760px) 50vw, 33vw') + '</figure>'; }).join('') + '</div></div></section>';
}
function sectionAppel(spec) {
  const c = spec.contact || {}, t = telHref(c.tel);
  return '<section class="sec" style="padding-top:0"><div class="w"><div class="appel rv"><h2 class="t">' + avecAccent(spec.titre_appel || 'Un projet ? **Parlons-en.**') + '</h2>' + (t ? '<a class="gros-tel" href="' + esc(t) + '">' + esc(MQ.affiche(c.tel)) + '</a>' : '') + boutons(spec) + '</div></div></section>';
}
function sectionFaq(spec) {
  if (!spec.faq || !spec.faq.length) return '';
  return '<section class="sec" id="faq"><div class="w faq"><div><h2 class="t rv">' + avecAccent(spec.titre_faq || 'Vos **questions**') + '</h2></div><div class="rv">' + spec.faq.slice(0, 6).map(function (f) { return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.r) + '</p></details>'; }).join('') + '</div></div></section>';
}
function sectionContact(spec, ctx) {
  const c = spec.contact || {}, li = [];
  const t = telHref(c.tel), w = waHref(c.tel, 'Bonjour');
  if (t) li.push(['tel', 'Téléphone', '<a href="' + esc(t) + '">' + esc(MQ.affiche(c.tel)) + '</a>']);
  if (w) li.push(['bulle', 'WhatsApp', '<a href="' + esc(w) + '" target="_blank" rel="noopener">Écrire sur WhatsApp</a>']);
  if (c.email) li.push(['mail', 'Email', '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>']);
  if (c.adresse || spec.commune) li.push(['pin', 'Adresse', esc(c.adresse || (spec.commune + ', Martinique')) + (c.maps ? '<div><a href="' + esc(c.maps) + '" target="_blank" rel="noopener">Itinéraire</a></div>' : '')]);
  if (c.horaires && c.horaires.length) li.push(['horloge', 'Horaires', '<ul class="horaires">' + c.horaires.slice(0, 7).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>']);
  return '<section class="sec" id="contact" style="background:var(--doux)"><div class="w contact"><div class="rv" style="display:grid;gap:22px"><p class="k">Contact</p><h2 class="t">' + avecAccent(spec.titre_contact || 'Écrivez-nous, on vous **répond**') + '</h2><p class="chapo">' + esc(spec.zone ? 'Nous intervenons : ' + spec.zone + '.' : '') + '</p>' + boutons(spec) + '</div><ul class="infos rv">' + li.map(function (x) { return '<li><span class="pic">' + T.icone(x[0]) + '</span><div><small>' + x[1] + '</small>' + x[2] + '</div></li>'; }).join('') + '</ul></div></section>';
}

/* ── images ── */
function img(p, ctx, chargement, tailles) {
  const src = ctx.racineImg + p.fichier;
  let srcset = '';
  if (ctx.optimiseur && !/\.svg$/i.test(p.fichier)) {
    const phys = encodeURIComponent('/' + ctx.racinePhysique + 'img/' + p.fichier);
    srcset = ' srcset="' + [480, 960, 1600].map(function (w) { return '/_vercel/image?url=' + phys + '&amp;w=' + w + '&amp;q=72 ' + w + 'w'; }).join(', ') + '" sizes="' + (tailles || '100vw') + '"';
  }
  return '<img src="' + esc(src) + '"' + srcset + ' alt="' + esc(p.alt || '') + '"' + (p.l && p.h ? ' width="' + p.l + '" height="' + p.h + '"' : '') + ' loading="' + (chargement || 'lazy') + '" decoding="async">';
}

/* ── page complète ── */
function page(spec, ctx, contenu, o) {
  o = o || {};
  const p = ctx.palette, nom = sansMarques(spec.nom);
  const titre = o.titre || (spec.seo && spec.seo.titre) || (nom + ' · ' + (spec.activite || '') + (spec.commune ? ' à ' + spec.commune : ''));
  const desc = o.description || (spec.seo && spec.seo.description) || spec.chapo || '';
  const marque = ctx.logo ? '<img src="' + esc(ctx.racineImg + ctx.logo.fichier) + '" alt="' + esc(nom) + '">' : '<i></i><span>' + esc(nom) + '</span>';
  const nav = ctx.pages.filter(function (x) { return x.nav; }).length > 1
    ? ctx.pages.filter(function (x) { return x.nav; }).map(function (x) { return '<a href="' + esc(ctx.lien(x.chemin)) + '"' + (o.chemin === x.chemin ? ' aria-current="page"' : '') + '>' + esc(x.nav) + '</a>'; }).join('')
    : '<a href="#services">Services</a>' + (spec.faq && spec.faq.length ? '<a href="#faq">Questions</a>' : '') + '<a href="#contact">Contact</a>';
  const a = actionPrincipale(spec);
  const cta = a ? '<a class="btn btn-plein" href="' + esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(a.texte) + '</a>' : '';
  const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="' + p.accent + '"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="' + p.surAccent + '">' + esc(nom.charAt(0).toUpperCase()) + '</text></svg>');
  const ld = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: nom, description: desc, telephone: spec.contact && MQ.e164(spec.contact.tel) || undefined, email: spec.contact && spec.contact.email || undefined, areaServed: spec.zone || 'Martinique', address: { '@type': 'PostalAddress', addressLocality: spec.commune || undefined, addressRegion: 'Martinique', addressCountry: 'MQ', streetAddress: (spec.legal && spec.legal.adresse) || undefined }, url: ctx.url || undefined };
  const apercu = ctx.mode === 'apercu' ? '<aside class="apercu" role="note"><span class="long"><b>Aperçu préparé par Novalemo pour ' + esc(nom) + '.</b> Pas encore en ligne officiellement.</span><span class="court"><b>Aperçu Novalemo</b>, pas encore en ligne.</span>' + (ctx.contactNovalemo ? '<a href="mailto:' + esc(ctx.contactNovalemo) + '?subject=' + encodeURIComponent('Je veux ce site : ' + nom) + '">Je veux ce site</a>' : '') + '</aside>' : '';
  const legal = ctx.lien('mentions-legales/');
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>' + esc(titre) + '</title><meta name="description" content="' + esc(desc.slice(0, 160)) + '">' +
    (ctx.mode === 'apercu' ? '<meta name="robots" content="noindex,nofollow">' : (ctx.url ? '<link rel="canonical" href="' + esc(ctx.url + (o.chemin || '')) + '">' : '')) +
    '<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="' + esc(titre) + '"><meta property="og:description" content="' + esc(desc.slice(0, 200)) + '">' +
    '<meta name="theme-color" content="' + p.fond + '"><link rel="icon" href="' + favicon + '">' +
    '<link rel="preload" href="/_f/' + T.FICHIERS_POLICES[ctx.polices.titre].fichier + '" as="font" type="font/woff2" crossorigin>' +
    (ctx.polices.texte !== ctx.polices.titre ? '<link rel="preload" href="/_f/' + T.FICHIERS_POLICES[ctx.polices.texte].fichier + '" as="font" type="font/woff2" crossorigin>' : '') +
    '<style>' + ctx.css + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    '</head><body' + (ctx.mode === 'apercu' ? ' class="a-apercu"' : '') + '><a class="saut" href="#contenu">Aller au contenu</a>' +
    '<header class="tete"><div class="w"><a class="marque" href="' + esc(ctx.lien('')) + '">' + marque + '</a><nav class="nav" aria-label="Navigation">' + nav + cta + '</nav></div></header>' +
    '<main id="contenu">' + contenu + '</main>' +
    '<footer class="pied"><div class="w"><p class="signe" aria-hidden="true" style="--n:' + Math.max(6, nom.length) + '">' + esc(nom) + '</p><div class="bas"><span>© ' + ctx.annee + ' ' + esc(nom) + (spec.commune ? ', ' + esc(spec.commune) + ', Martinique' : '') + '</span><a href="' + esc(legal) + '">Mentions légales</a><a class="studio" href="' + esc(NOVALEMO.signature_site.url) + '" target="_blank" rel="noopener"><i></i>' + esc(NOVALEMO.signature_site.texte) + '</a></div></div></footer>' +
    apercu + '<script>' + JS + '</script></body></html>';
}

function mentions(spec, ctx) {
  const l = spec.legal || {}, c = spec.contact || {}, id = ctx.identite || {};
  const nom = sansMarques(spec.nom);
  const ed = [
    '<strong>' + esc(l.raison_sociale || nom) + '</strong>' + (l.forme ? ', ' + esc(l.forme) : ''),
    l.siret ? 'SIRET : ' + esc(l.siret) : (l.siren ? 'SIREN : ' + esc(l.siren) : null),
    l.adresse ? 'Adresse : ' + esc(l.adresse) : (spec.commune ? 'Commune : ' + esc(spec.commune) + ', Martinique' : null),
    c.tel ? 'Téléphone : ' + esc(MQ.affiche(c.tel)) : null,
    c.email ? 'Email : ' + esc(c.email) : null,
    l.dirigeant ? 'Directeur de la publication : ' + esc(l.dirigeant) : null
  ].filter(Boolean);
  const realise = id.entreprise ? esc(id.entreprise) + (id.siret ? ', SIRET ' + esc(id.siret) : '') + (id.marque ? ' (' + esc(id.marque) + ')' : '') : 'Studio Novalem';
  const corps = '<section class="page-h"><div class="w"><p class="k">Informations légales</p><h1 class="t">Mentions légales</h1></div></section>' +
    '<section class="sec"><div class="w prose">' +
    (ctx.mode === 'apercu' && !l.siret && !l.siren ? '<p><strong>Aperçu :</strong> les informations légales de l\'entreprise sont complétées à la mise en ligne.</p>' : '') +
    '<h2>Éditeur du site</h2><p>' + ed.join('<br>') + '</p>' +
    '<h2>Hébergement</h2><p>' + esc(HEBERGEUR) + '.</p>' +
    '<h2>Réalisation</h2><p>' + realise + '.</p>' +
    '<h2>Données personnelles</h2><p>Ce site ne dépose aucun cookie, n\'utilise aucun outil de mesure d\'audience et ne collecte aucune donnée par formulaire. Les informations que vous transmettez par email, téléphone ou WhatsApp servent uniquement à répondre à votre demande et ne sont jamais cédées. Vous pouvez demander leur suppression à tout moment en écrivant à l\'éditeur.</p>' +
    '<h2>Propriété intellectuelle</h2><p>Les textes, images et éléments graphiques de ce site appartiennent à leur éditeur. Toute reproduction sans autorisation est interdite.</p>' +
    '</div></section>';
  return page(spec, ctx, corps, { titre: 'Mentions légales · ' + nom, chemin: 'mentions-legales/' });
}

// les pages d'une formule (le plan du site)
function plan(formule, spec) {
  if (formule === 'vitrine' || formule === 'signature') {
    const p = [{ chemin: '', nav: 'Accueil' }, { chemin: 'services/', nav: 'Services' }, { chemin: 'a-propos/', nav: 'À propos' }, { chemin: 'contact/', nav: 'Contact' }, { chemin: 'mentions-legales/' }];
    if (formule === 'signature') (spec.services || []).forEach(function (s) { p.push({ chemin: 'services/' + slugifier(s.titre) + '/', service: s }); });
    return p;
  }
  return [{ chemin: '' }, { chemin: 'mentions-legales/' }];
}

/* ── point d'entrée ── */
// site = { slug, spec, formule } ; opts = { mode: 'apercu'|'live', identite, contactNovalemo, optimiseur, url }
// Retourne { files: [{ file, data }], pages: [...] } ; les images (spec.photos / spec.logo) sont fournies à part par l'appelant.
function rendre(site, opts) {
  opts = opts || {};
  const spec = site.spec || {};
  const mode = opts.mode === 'live' ? 'live' : 'apercu';
  const formule = mode === 'live' ? (site.formule || 'essentiel') : 'essentiel';
  const metier = T.pourMetier(spec.activite || spec.secteur || '');
  const photos = (spec.photos || []).filter(function (p) { return p && p.fichier; });
  let compo = T.COMPOSITIONS.indexOf(spec.composition) >= 0 ? spec.composition : metier.composition;
  if (compo === 'photo' && !photos.length) compo = 'affiche';
  const racinePhysique = (mode === 'live' ? 's/' : 'a/') + site.slug + '/';
  const base = mode === 'live' ? '/' : '/' + racinePhysique;
  const pol = T.POLICES[compo] || T.POLICES.affiche;
  const pal = T.palette(T.AMBIANCES[spec.ambiance] ? spec.ambiance : metier.ambiance, spec.accent);
  const pages = plan(formule, spec);
  const ctx = {
    mode: mode, compo: compo, palette: pal, polices: pol, css: css(pal, pol, compo), photos: photos, logo: spec.logo && spec.logo.fichier ? spec.logo : null,
    iconeMetier: (spec.services && spec.services[0] && spec.services[0].icone) || metier.icone, pages: pages,
    racinePhysique: racinePhysique, racineImg: base + 'img/', optimiseur: opts.optimiseur !== false,
    lien: function (chemin) { return base + chemin; }, url: mode === 'live' && opts.url ? opts.url.replace(/\/?$/, '/') : null,
    identite: opts.identite || null, contactNovalemo: opts.contactNovalemo || null, annee: new Date().getFullYear()
  };
  const files = [];
  const mettre = function (chemin, html) { files.push({ file: racinePhysique + chemin + 'index.html', data: html }); };
  const accueilComplet = hero(spec, ctx) + defile(spec) + sectionServices(spec, ctx, false) + sectionGalerie(ctx) + sectionAtouts(spec) + sectionEtapes(spec) + sectionAppel(spec) + sectionFaq(spec) + sectionContact(spec, ctx);
  if (pages.length <= 2) {
    mettre('', page(spec, ctx, accueilComplet, { chemin: '' }));
  } else {
    const avecLiens = formule === 'signature';
    mettre('', page(spec, ctx, hero(spec, ctx) + defile(spec) + sectionServices(spec, ctx, avecLiens) + sectionGalerie(ctx) + sectionAtouts(spec) + sectionAppel(spec), { chemin: '' }));
    const tete = function (k, titre, sous) { return '<section class="page-h"><div class="w"><p class="k">' + esc(k) + '</p><h1 class="t mots">' + avecAccent(titre) + '</h1>' + (sous ? '<p class="chapo" style="margin-top:22px">' + esc(sous) + '</p>' : '') + '</div></section>'; };
    mettre('services/', page(spec, ctx, tete(spec.activite || 'Services', spec.titre_services || 'Ce que nous **faisons**', spec.intro_services) +
      '<section class="sec"><div class="w"><ul class="liste-num">' + (spec.services || []).map(function (s, k) { return '<li class="rv"><span class="n">' + String(k + 1).padStart(2, '0') + '</span><h3>' + (avecLiens ? '<a href="' + esc(ctx.lien('services/' + slugifier(s.titre) + '/')) + '">' + esc(s.titre) + '</a>' : esc(s.titre)) + '</h3><p>' + esc(s.detail || s.texte) + '</p></li>'; }).join('') + '</ul></div></section>' + sectionEtapes(spec) + sectionAppel(spec), { chemin: 'services/', titre: 'Services · ' + sansMarques(spec.nom) }));
    mettre('a-propos/', page(spec, ctx, tete('À propos', spec.titre_apropos || sansMarques(spec.nom), spec.zone ? 'Nous intervenons : ' + spec.zone + '.' : '') +
      '<section class="sec"><div class="w prose"><p style="font-size:1.2rem;color:var(--encre)">' + esc(spec.a_propos || spec.chapo) + '</p></div></section>' + sectionAtouts(spec) + defile(spec) + sectionAppel(spec), { chemin: 'a-propos/', titre: 'À propos · ' + sansMarques(spec.nom) }));
    mettre('contact/', page(spec, ctx, sectionContact(spec, ctx) + sectionFaq(spec), { chemin: 'contact/', titre: 'Contact · ' + sansMarques(spec.nom) }));
    pages.filter(function (x) { return x.service; }).forEach(function (x) {
      const s = x.service;
      mettre(x.chemin, page(spec, ctx, tete(spec.activite || 'Service', s.titre + (spec.commune ? ' à ' + spec.commune : ''), s.texte) +
        '<section class="sec"><div class="w prose"><p style="font-size:1.15rem;color:var(--encre)">' + esc(s.detail || s.texte) + '</p></div></section>' + sectionEtapes(spec) + sectionFaq(spec) + sectionAppel(spec),
        { chemin: x.chemin, titre: s.titre + (spec.commune ? ' à ' + spec.commune : '') + ' · ' + sansMarques(spec.nom), description: s.texte }));
    });
  }
  mettre('mentions-legales/', mentions(spec, ctx));
  if (mode === 'live') {
    const hote = ctx.url || '';
    files.push({ file: racinePhysique + 'robots.txt', data: 'User-agent: *\nAllow: /\n' + (hote ? 'Sitemap: ' + hote + 'sitemap.xml\n' : '') });
    if (hote) files.push({ file: racinePhysique + 'sitemap.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(function (x) { return '<url><loc>' + esc(hote + x.chemin) + '</loc></url>'; }).join('') + '</urlset>\n' });
  }
  return { files: files, pages: pages.map(function (x) { return x.chemin; }), compo: compo, palette: pal };
}

module.exports = { rendre, slugifier, actionPrincipale, OBJECTIFS, HEBERGEUR, esc };
