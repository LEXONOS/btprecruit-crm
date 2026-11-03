// Rendu déterministe d'un site à partir de sa fiche (spec) et de sa direction artistique (spec.da, voir donne.js) :
// HTML et CSS faits main, aucun framework, aucun script, aucune requête vers un tiers (polices et images servies par le
// site lui-même, pas de cookie, pas de traceur). Même fiche = mêmes fichiers.
// Aperçu : une page + mentions légales, bandeau « aperçu », noindex. En ligne : la formule décide des pages.
'use strict';
const T = require('./theme');
const DN = require('./donne');
const F = require('./fiche');
const MQ = require('../martinique');
const { NOVALEMO } = require('../config');

const HEBERGEUR = 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis';

/* ── texte ── */
const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
// les anciennes fiches marquaient un mot **ainsi** : on ne colore plus un mot, on retire les marques
function net(s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
function slugifier(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'page'; }
function minuscule(s) { s = net(s).replace(/[.!…]+$/, ''); return /^[A-ZÀ-Ý][a-zà-ÿ']/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

/* ── liens d'action ── */
function telHref(t) { const e = MQ.e164(t); return e ? 'tel:' + e : null; }
function waHref(t, texte) { const e = MQ.e164(t); return e && F.portable(t) ? 'https://wa.me/' + e.replace('+', '') + '?text=' + encodeURIComponent(texte || 'Bonjour') : null; }
function mailHref(email, sujet, corps) { return email ? 'mailto:' + email + '?subject=' + encodeURIComponent(sujet) + (corps ? '&body=' + encodeURIComponent(corps) : '') : null; }
const OBJECTIFS = {
  devis: { sujet: 'Demande de devis', corps: 'Bonjour,\n\nJe souhaite un devis pour :\n\nAdresse ou commune :\nMon téléphone :\n\nMerci', wa: 'Bonjour, je viens de votre site. Je voudrais un devis pour : ', bouton: 'Demander un devis' },
  appel: { sujet: 'Demande de rappel', corps: 'Bonjour,\n\nPouvez-vous me rappeler au :\n\nMerci', wa: 'Bonjour, je viens de votre site. Pouvez-vous me rappeler ?', bouton: 'Être rappelé' },
  reservation: { sujet: 'Demande de rendez-vous', corps: 'Bonjour,\n\nJe souhaite un rendez-vous pour :\nMes disponibilités :\nMon téléphone :\n\nMerci', wa: 'Bonjour, je viens de votre site. Je voudrais réserver : ', bouton: 'Réserver' },
  visite: { sujet: 'Renseignements', corps: 'Bonjour,\n\n', wa: 'Bonjour, je viens de votre site. ', bouton: 'Nous écrire' },
  inscription: { sujet: 'Demande d\'inscription', corps: 'Bonjour,\n\nJe souhaite des informations pour une inscription :\nMon téléphone :\n\nMerci', wa: 'Bonjour, je viens de votre site. Je voudrais des informations pour une inscription.', bouton: 'Demander les infos' }
};
// L'action principale du site : WhatsApp dès qu'on a un portable, sinon l'appel, sinon l'email préparé
function actionPrincipale(spec) {
  const c = spec.contact || {}, o = OBJECTIFS[spec.objectif] || OBJECTIFS.devis;
  const w = waHref(c.tel, o.wa);
  if (w) return { type: 'whatsapp', href: w, texte: 'Écrire sur WhatsApp', court: 'WhatsApp', icone: 'whatsapp', ext: true };
  const t = telHref(c.tel);
  if (t) return { type: 'tel', href: t, texte: 'Appeler le ' + MQ.affiche(c.tel), court: 'Appeler', icone: 'tel' };
  const m = mailHref(c.email, o.sujet + (spec.nom ? ' : ' + net(spec.nom) : ''), o.corps);
  if (m) return { type: 'mail', href: m, texte: net(spec.cta) || o.bouton, court: 'Écrire', icone: 'mail' };
  return null;
}
// L'action d'appoint, en lien simple : l'appel quand l'action principale est WhatsApp, sinon l'email
function actionSeconde(spec, a) {
  const c = spec.contact || {};
  if (a && a.type === 'whatsapp' && telHref(c.tel)) return { href: telHref(c.tel), texte: 'ou appelez le ' + MQ.affiche(c.tel) };
  if (a && a.type !== 'mail' && c.email) return { href: 'mailto:' + c.email, texte: 'ou écrivez à ' + c.email };
  return null;
}
function lienA(a, cls, contenu) { return '<a class="' + cls + '" href="' + esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + '>' + contenu + '</a>'; }
function boutons(spec, o) {
  o = o || {};
  const a = actionPrincipale(spec);
  if (!a) return '';
  const s = o.seule ? null : actionSeconde(spec, a);
  return '<div class="actions">' + lienA(a, 'btn b1', T.icone(a.icone) + '<span>' + esc(a.texte) + '</span>') + (s ? '<a class="lien2" href="' + esc(s.href) + '">' + esc(s.texte) + '</a>' : '') + '</div>';
}

/* ── mesures : chaque grand titre est taillé pour tenir en deux lignes, quelle que soit la largeur ── */
// la plus longue ligne de la meilleure coupure en deux lignes (aux espaces), en caractères
function deuxLignes(texte) {
  const m = net(texte).split(' ').filter(Boolean);
  if (m.length < 2) return net(texte).length;
  let best = Infinity;
  for (let k = 1; k < m.length; k++) best = Math.min(best, Math.max(m.slice(0, k).join(' ').length, m.slice(k).join(' ').length));
  return best;
}
function k2(texte, ty) { return ((deuxLignes(texte) + 1.5) * ty.chasse).toFixed(2); }
function kNom(nom, ty) { const n = net(nom).length; return n <= 22 ? { k: ((n + 1) * ty.chasse).toFixed(2), une: true } : { k: ((deuxLignes(nom) + 1.5) * ty.chasse).toFixed(2), une: false }; }

/* ── feuille de style ── */
function css(ctx) {
  const p = ctx.palette, ty = ctx.type, da = ctx.da;
  const faces = [];
  [ty.titre, ty.texte].filter(function (x, k, a) { return a.indexOf(x) === k; }).forEach(function (cle) {
    (T.FICHIERS_POLICES[cle] || []).forEach(function (f) { faces.push('@font-face{font-family:"' + f.famille + '";src:url(/_f/' + f.fichier + ') format("woff2");font-weight:' + f.poids + ';' + (f.etirement ? 'font-stretch:' + f.etirement + ';' : '') + 'font-display:swap}'); });
  });
  const ft = T.FICHIERS_POLICES[ty.titre][0].famille, fx = T.FICHIERS_POLICES[ty.texte][0].famille;
  const repli = function (f) { return ty.serif && f === fx ? 'ui-serif,Georgia,"Times New Roman",serif' : 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; };
  const rond = da.rayon === 'rond';
  const ech = 0.5 / ty.chasse;   // les voix larges prennent des titres de section un peu plus petits
  const h2a = Math.max(1.55, Math.min(2.1, 1.9 * ech)).toFixed(2), h2b = Math.max(2.3, Math.min(3.7, 3.3 * ech)).toFixed(2);
  return faces.join('') + `
:root{color-scheme:${p.clair ? 'light' : 'dark'};--fond:${p.fond};--surface:${p.surface};--encre:${p.encre};--doux:${p.doux};--accent:${p.accent};--surA:${p.surAccent};--accentT:${p.accentTexte};--champ:${p.champ};--surC:${p.surChamp};--champDoux:${p.champDoux};--vif:${p.vif};--surV:${p.surVif};--ft:"${ft}",${repli(ft)};--fx:"${fx}",${repli(fx)};--tp:${ty.poids};--ti:${ty.interlettre};--th:${ty.hauteur};--tc:${ty.casse};--tr:${ty.reglage};--te:${ty.etirement || 'normal'};--fxr:${ty.reglageTexte || 'normal'};--fxf:${ty.texteFort};--g:clamp(18px,4.6vw,52px);--w:1200px;--hw:min(100vw - 2*var(--g),var(--w));--r:${rond ? '22px' : '0px'};--rb:${rond ? '999px' : '0px'};--h2a:${h2a}rem;--h2b:${h2b}rem;--corps:${ty.serif ? '1.125rem' : '1.0625rem'}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;accent-color:var(--accent);caret-color:var(--accent);scroll-padding-top:20px}
@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
body{margin:0;background:var(--fond);color:var(--encre);font-family:var(--fx);font-weight:400;font-size:var(--corps);line-height:1.6;font-variation-settings:var(--fxr);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;overflow-x:clip}
::selection{background:var(--accent);color:var(--surA)}
img{display:block;max-width:100%;height:auto}
a{color:inherit;text-decoration-thickness:.07em;text-underline-offset:.2em}
:focus-visible{outline:3px solid var(--accentT);outline-offset:3px}
.sur-champ :focus-visible{outline-color:var(--surC)}
.w{width:min(var(--w),100% - 2*var(--g));margin-inline:auto}
.saut{position:absolute;left:-9999px;top:8px;z-index:99;background:var(--encre);color:var(--fond);padding:10px 14px}.saut:focus{left:8px}
.ic{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.t,.st{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);text-wrap:balance;margin:0;overflow-wrap:break-word}
.t{line-height:var(--th)}.st{line-height:1.04}
h2.t{font-size:clamp(var(--h2a),4.2vw,var(--h2b))}
h3{margin:0;font-weight:var(--fxf);font-size:1.15rem;line-height:1.3}
p,ul{margin:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:0 26px;border-radius:var(--rb);font-family:var(--fx);font-weight:var(--fxf);font-size:1.0625rem;line-height:1.1;text-decoration:none;cursor:pointer;transition:transform .2s cubic-bezier(.2,.7,0,1);-webkit-tap-highlight-color:transparent}
.btn:hover{transform:translateY(-2px)}.btn:active{transform:none}
.b1{background:var(--accent);color:var(--surA)}
.b2{background:var(--surface);color:var(--encre)}
.sur-champ .b1{background:var(--vif);color:var(--surV)}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px 28px}
.lien2{font-weight:var(--fxf);text-decoration:underline;text-decoration-thickness:.07em;text-underline-offset:.24em}
.lien2:hover{text-decoration-thickness:.15em}
.chapo{font-size:clamp(1.08rem,1.5vw,1.28rem);line-height:1.55;color:var(--doux);max-width:56ch}
.faits{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px 28px;font-size:.95rem;color:var(--doux)}
.sur-champ .chapo,.sur-champ .faits{color:var(--champDoux)}
.h1{font-size:min(var(--hmax),calc(var(--hw) * var(--hf) / var(--hk)))}
.ph{overflow:hidden;background:var(--surface);border-radius:var(--r);margin:0}
.ph img{width:100%;height:100%;object-fit:cover}
/* en-tête */
.tete .w{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:76px}
.marque{display:flex;align-items:center;text-decoration:none;min-width:0}
.marque span{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.32rem;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.marque img{height:46px;width:auto;max-width:200px;object-fit:contain}
.clair .marque img{mix-blend-mode:multiply}
.nav{display:flex;align-items:center;gap:30px;font-weight:var(--fxf);font-size:.98rem;flex:none}
.nav .l{text-decoration:none;padding:8px 0}.nav .l:hover{text-decoration:underline}
.nav .btn{min-height:46px;padding:0 20px;font-size:.98rem}
.nav .btn .court{display:none}
@media(max-width:860px){.nav .l{display:none}.nav .btn{padding:0 16px}.nav .btn .long{display:none}.nav .btn .court{display:inline}}
/* haut de page : photo en grand et bande de couleur */
.h-lieu>.ph{border-radius:0;height:clamp(250px,56vh,660px)}
@media(max-width:860px){.h-lieu>.ph{height:clamp(210px,40vh,420px)}}
.h-lieu .bande{position:relative;background:var(--champ);color:var(--surC);border-radius:var(--r);padding:clamp(26px,4.4vw,60px);margin-top:calc(-1 * clamp(44px,9vw,130px));display:grid;gap:clamp(18px,2.4vw,26px);--hw:calc(min(100vw - 2*var(--g),var(--w)) - 2*clamp(26px,4.4vw,60px));--hf:1;--hmax:5.4rem}
/* haut de page : texte et photo côte à côte */
.h-scene .w{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:clamp(28px,5vw,80px);align-items:center;padding-block:clamp(12px,3vw,40px) clamp(48px,7vw,96px)}
.h-scene .txt{display:grid;gap:clamp(18px,2.4vw,28px);--hf:.47;--hmax:4.9rem}
.h-scene .ph{aspect-ratio:4/5}
@media(max-width:860px){.h-scene .w{grid-template-columns:1fr}.h-scene .txt{--hf:1}.h-scene .ph{aspect-ratio:4/3}}
/* haut de page : le nom en très grand */
.h-mon .w{padding-block:clamp(14px,3vw,40px) clamp(48px,7vw,96px)}
.h-mon .nom{font-size:min(13rem,calc(var(--hw) / var(--nk)));line-height:.88;margin-bottom:clamp(24px,3.4vw,48px)}
.h-mon .nom.une{white-space:nowrap}
.h-mon .bas{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:22px clamp(28px,5vw,80px);align-items:end}
.h-mon .accroche{font-size:clamp(1.75rem,3.4vw,3.3rem);line-height:1.04}
.h-mon .bas>div{display:grid;gap:22px}
.h-mon .ph{margin-top:clamp(36px,5vw,72px);aspect-ratio:21/9}
@media(max-width:860px){.h-mon .bas{grid-template-columns:1fr}.h-mon .ph{aspect-ratio:4/3}}
/* haut de page : l'aplat de couleur */
.h-aff{background:var(--champ);color:var(--surC)}
.h-aff .w{padding-block:clamp(44px,8vw,120px) clamp(36px,5vw,64px);display:grid;gap:clamp(22px,3vw,36px);--hf:1;--hmax:8.6rem}
.h-aff .bas{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px 48px;align-items:end}
@media(max-width:860px){.h-aff .bas{grid-template-columns:1fr}}
.defile{overflow:hidden;padding-block:clamp(14px,2vw,22px);background:var(--vif);color:var(--surV);user-select:none}
.piste{display:flex;width:max-content}
.piste span{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.3rem,2.6vw,2.2rem);line-height:1;white-space:nowrap;display:flex;align-items:center;gap:.8em;padding-right:.8em}
.piste span::after{content:"";width:.32em;height:.32em;background:currentColor;border-radius:var(--rb);flex:none}
/* haut de page : calme */
.h-sob .w{padding-block:clamp(36px,7vw,104px) clamp(48px,7vw,96px);display:grid;gap:clamp(18px,2.4vw,28px);--hf:.8;--hmax:4.6rem}
.h-sob .ph{margin-top:clamp(18px,3vw,40px);aspect-ratio:16/9}
@media(min-width:861px){.h-sob.nu .w{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);column-gap:clamp(32px,6vw,96px);align-items:end;--hf:.56;--hmax:5.6rem}.h-sob.nu .t{grid-row:span 3}}
@media(max-width:860px){.h-sob .w{--hf:1}.h-sob .ph{aspect-ratio:4/3}}
/* sections */
.sec{padding-block:clamp(64px,9vw,128px)}
.sec-s{background:var(--surface)}
.sec-t{display:grid;gap:16px;margin-bottom:clamp(32px,5vw,60px);max-width:64ch}
.intro{color:var(--doux);font-size:1.12rem;max-width:58ch}
.srv-l{display:grid;gap:clamp(30px,4.4vw,56px)}
.srv-l article{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:10px clamp(24px,4vw,64px);align-items:baseline}
.srv-l h3{font-size:clamp(1.55rem,2.9vw,2.5rem)}
.srv-l p{color:var(--doux);max-width:60ch}
@media(max-width:760px){.srv-l article{grid-template-columns:1fr}}
.srv-t{display:grid;gap:14px;grid-template-columns:repeat(3,minmax(0,1fr))}
.srv-t.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.srv-t.n5{grid-template-columns:repeat(6,minmax(0,1fr))}.srv-t.n5>*{grid-column:span 2}.srv-t.n5>:nth-child(-n+2){grid-column:span 3}
.srv-t article{background:var(--surface);border-radius:var(--r);padding:clamp(24px,3vw,38px);display:grid;gap:14px;align-content:start}
.srv-t h3{font-size:clamp(1.4rem,2.1vw,1.9rem)}
.srv-t p{color:var(--doux)}
@media(max-width:980px){.srv-t,.srv-t.n5{grid-template-columns:repeat(2,minmax(0,1fr))}.srv-t.n5>*,.srv-t.n5>:nth-child(-n+2){grid-column:auto}}
@media(max-width:620px){.srv-t,.srv-t.n4,.srv-t.n5{grid-template-columns:1fr}}
.srv-p{display:grid;gap:clamp(44px,6vw,96px)}
.srv-p article{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:clamp(22px,4vw,72px);align-items:center}
.srv-p article:nth-child(even) .ph{order:2}
.srv-p .ph{aspect-ratio:4/3}
.srv-p .tx{display:grid;gap:14px}
.srv-p h3{font-size:clamp(1.8rem,3.4vw,2.9rem)}
.srv-p p{color:var(--doux);max-width:52ch;font-size:1.08rem}
.srv-p+.srv-l{margin-top:clamp(56px,7vw,104px)}
@media(max-width:760px){.srv-p article{grid-template-columns:1fr}.srv-p article:nth-child(even) .ph{order:0}}
.atouts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(28px,4vw,64px);margin-top:clamp(32px,5vw,60px)}
.atouts h3{font-size:clamp(1.45rem,2.3vw,2rem);margin-bottom:12px}
.atouts p{color:var(--doux)}
@media(max-width:860px){.atouts{grid-template-columns:1fr}}
.etapes-t{font-size:clamp(var(--h2a),3.6vw,calc(var(--h2b) * .86))!important;max-width:26ch}
.etapes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(24px,4vw,56px);margin-top:clamp(32px,5vw,56px)}
.etapes h3{color:var(--accentT);margin-bottom:8px}
.etapes p{color:var(--doux)}
@media(max-width:860px){.etapes{grid-template-columns:1fr}}
.gal{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:clamp(170px,22vw,330px);gap:clamp(8px,1.2vw,14px)}
.gal .ph{grid-column:span 4}
.gal .ph:first-child{grid-column:span 8;grid-row:span 2}
.gal.n2 .ph:first-child{grid-column:span 7}.gal.n2 .ph:nth-child(2){grid-column:span 5;grid-row:span 2}
@media(max-width:760px){.gal{grid-template-columns:1fr 1fr;grid-auto-rows:clamp(140px,40vw,240px)}.gal .ph,.gal.n2 .ph:nth-child(2){grid-column:span 1;grid-row:span 1}.gal .ph:first-child,.gal.n2 .ph:first-child{grid-column:span 2;grid-row:span 1}}
.faq{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:clamp(28px,5vw,88px);align-items:start}
.faq details{background:var(--surface);border-radius:var(--r);padding:0 clamp(18px,2.4vw,26px)}
.faq details+details{margin-top:10px}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:20px 0;font-weight:var(--fxf);font-size:1.06rem;line-height:1.4}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"";flex:none;width:14px;height:14px;margin-top:5px;background:linear-gradient(currentColor,currentColor) center/100% 2px no-repeat,linear-gradient(currentColor,currentColor) center/2px 100% no-repeat;transition:transform .3s cubic-bezier(.2,.7,0,1)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{padding:0 0 22px;color:var(--doux);max-width:62ch}
@media(max-width:860px){.faq{grid-template-columns:1fr}}
/* contact */
.contact{background:var(--champ);color:var(--surC);padding-block:clamp(64px,9vw,128px)}
.contact .w{display:grid;gap:clamp(22px,3vw,34px)}
.gros{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:min(8.5rem,calc(var(--hw) / var(--gk)));line-height:.95;text-decoration:none;width:max-content;max-width:100%;white-space:nowrap}
.gros:hover{text-decoration:underline;text-decoration-thickness:.04em}
.c-infos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:26px clamp(24px,4vw,56px);margin-top:clamp(12px,3vw,32px)}
.c-infos h3{font-size:1rem;margin-bottom:6px}
.c-infos p,.c-infos li{color:var(--champDoux)}
.c-infos ul{list-style:none;padding:0}
.c-infos a{color:var(--surC)}
/* pied */
.pied{padding-block:clamp(40px,6vw,64px) 32px}
.pied .w{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:12px 28px;font-size:.92rem;color:var(--doux)}
.pied .np{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.25rem;color:var(--encre);margin-right:auto}
.pied a{color:inherit}
/* pages intérieures */
.page-h{padding-block:clamp(44px,8vw,112px) clamp(20px,4vw,44px)}
.page-h .w{display:grid;gap:22px;--hf:.82;--hmax:5rem}
.prose{max-width:70ch;display:grid;gap:18px;color:var(--doux)}
.prose h2{font-weight:var(--fxf);font-size:1.3rem;line-height:1.3;color:var(--encre);margin:22px 0 0}
.prose strong{color:var(--encre)}
.prose a{color:var(--accentT)}
/* aperçu */
.apercu{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;width:min(800px,calc(100% - 20px));background:#101113;color:#fff;border-radius:16px;padding:12px 12px 12px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 16px 44px rgba(0,0,0,.3);font-family:var(--fx);font-size:.9rem;line-height:1.35}
.apercu b{font-weight:700}
.apercu a{flex:none;background:#fff;color:#101113;text-decoration:none;font-weight:700;border-radius:11px;padding:11px 16px}
.apercu .court{display:none}
@media(max-width:600px){.apercu{padding:10px 10px 10px 16px;bottom:10px;border-radius:14px;font-size:.86rem}.apercu .long{display:none}.apercu .court{display:inline}.apercu a{padding:10px 13px}}
.a-apercu .pied{padding-bottom:120px}
/* barre d'action sur téléphone (site en ligne) */
.barre{display:none}
@media(max-width:860px){.barre{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;gap:8px;padding:10px var(--g) calc(10px + env(safe-area-inset-bottom));background:var(--fond);box-shadow:0 -10px 30px rgba(0,0,0,.12)}.barre .btn{flex:1;min-height:50px;padding:0 12px}.a-barre .pied{padding-bottom:104px}}
/* un seul mouvement par site, jamais imposé */
@media(prefers-reduced-motion:no-preference){
.m-devoile .h .ph img{animation:devoile 1.8s cubic-bezier(.16,.8,.2,1) both}
.m-leve .h .t{animation:leve 1s cubic-bezier(.16,.8,.2,1) both}
.m-leve .h .chapo,.m-leve .h .actions{animation:leve 1s .12s cubic-bezier(.16,.8,.2,1) both}
.m-defile .piste{animation:defile 38s linear infinite}
.m-defile .defile:hover .piste{animation-play-state:paused}
}
@keyframes devoile{from{transform:scale(1.08)}to{transform:none}}
@keyframes leve{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes defile{to{transform:translateX(-50%)}}
`.replace(/\n\s*/g, '');
}

/* ── images ── */
function img(p, ctx, chargement, tailles) {
  const src = ctx.racineImg + p.fichier;
  let srcset = '';
  if (ctx.optimiseur && !/\.svg$/i.test(p.fichier)) {
    const phys = encodeURIComponent('/' + ctx.racinePhysique + 'img/' + p.fichier);
    srcset = ' srcset="' + [480, 960, 1600].map(function (w) { return '/_vercel/image?url=' + phys + '&amp;w=' + w + '&amp;q=74 ' + w + 'w'; }).join(', ') + '" sizes="' + (tailles || '100vw') + '"';
  }
  // une photo d'illustration ne prétend rien montrer de l'entreprise : texte alternatif vide
  const alt = p.credit ? '' : net(p.alt || '');
  return '<img src="' + esc(src) + '"' + srcset + ' alt="' + esc(alt) + '"' + (p.l && p.h ? ' width="' + p.l + '" height="' + p.h + '"' : '') + ' loading="' + (chargement || 'lazy') + '"' + (chargement === 'eager' ? ' fetchpriority="high"' : '') + ' decoding="async">';
}
function figure(p, ctx, chargement, tailles) { return '<figure class="ph">' + img(p, ctx, chargement, tailles) + '</figure>'; }

/* ── haut de page ── */
function faits(spec) {
  const out = [];
  const z = net(spec.zone);
  if (z) out.push(z);
  const g = spec.google;
  if (g && g.note && g.avis >= 5) out.push('Noté ' + String(g.note).replace('.', ',') + ' sur 5 sur Google (' + g.avis + ' avis)');
  return out.length ? '<ul class="faits">' + out.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
}
function accrocheDe(spec) { return net(spec.accroche) || net(spec.activite) + (spec.commune ? ' à ' + spec.commune : ''); }
function hero(spec, ctx) {
  const ty = ctx.type, d = ctx.da.direction, ph = ctx.photos;
  const acc = accrocheDe(spec);
  const h1 = '<h1 class="t h1" style="--hk:' + k2(acc, ty) + '">' + esc(acc) + '</h1>';
  const chapo = net(spec.chapo) ? '<p class="chapo">' + esc(net(spec.chapo)) + '</p>' : '';
  if (d === 'lieu' && ph[0]) return '<section class="h h-lieu" aria-label="Présentation">' + figure(ph[0], ctx, 'eager', '100vw') + '<div class="w"><div class="bande sur-champ">' + h1 + chapo + boutons(spec) + faits(spec) + '</div></div></section>';
  if (d === 'scene' && ph[0]) return '<section class="h h-scene" aria-label="Présentation"><div class="w"><div class="txt">' + h1 + chapo + boutons(spec) + faits(spec) + '</div>' + figure(ph[0], ctx, 'eager', '(max-width:860px) 100vw, 52vw') + '</div></section>';
  if (d === 'monument') {
    const n = kNom(spec.nom, ty);
    return '<section class="h h-mon" aria-label="Présentation"><div class="w"><h1 class="t nom' + (n.une ? ' une' : '') + '" style="--nk:' + n.k + '">' + esc(net(spec.nom)) + '</h1><div class="bas"><p class="t accroche">' + esc(acc) + '</p><div>' + chapo + boutons(spec) + faits(spec) + '</div></div>' + (ph[0] ? figure(ph[0], ctx, 'eager', '100vw') : '') + '</div></section>';
  }
  if (d === 'affiche') return '<section class="h h-aff sur-champ" aria-label="Présentation"><div class="w">' + h1 + '<div class="bas">' + chapo + boutons(spec) + '</div>' + faits(spec) + '</div>' + defile(spec) + '</section>';
  if (!ph[0]) return '<section class="h h-sob nu" aria-label="Présentation"><div class="w">' + h1 + chapo + boutons(spec) + faits(spec) + '</div></section>';
  return '<section class="h h-sob" aria-label="Présentation"><div class="w">' + h1 + chapo + boutons(spec) + faits(spec) + figure(ph[0], ctx, 'eager', '100vw') + '</div></section>';
}
function defile(spec) {
  const mots = (spec.services || []).map(function (s) { return net(s.titre); }).filter(Boolean).concat(spec.commune ? [spec.commune] : []).slice(0, 8);
  if (mots.length < 3) return '';
  const bloc = mots.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
  return '<div class="defile" aria-hidden="true"><div class="piste">' + bloc + bloc + '</div></div>';
}

/* ── sections ── */
function article(s, cls) { return '<article><h3 class="st">' + esc(net(s.titre)) + '</h3><p>' + esc(net(s.texte)) + '</p></article>'; }
function sectionServices(spec, ctx, photos) {
  const sv = spec.services || [];
  if (!sv.length) return { html: '', utilisees: 0 };
  const v = ctx.da.services;
  let corps = '', utilisees = 0;
  if (v === 'photos' && photos.length >= 2) {
    const avec = sv.slice(0, Math.min(sv.length, photos.length, 3));
    utilisees = avec.length;
    corps = '<div class="srv-p">' + avec.map(function (s, k) { return '<article>' + figure(photos[k], ctx, 'lazy', '(max-width:760px) 100vw, 55vw') + '<div class="tx"><h3 class="st">' + esc(net(s.titre)) + '</h3><p>' + esc(net(s.texte)) + '</p></div></article>'; }).join('') + '</div>';
    const reste = sv.slice(avec.length);
    if (reste.length) corps += '<div class="srv-l">' + reste.map(article).join('') + '</div>';
  } else if (v === 'tuiles') corps = '<div class="srv-t n' + sv.length + '">' + sv.map(article).join('') + '</div>';
  else corps = '<div class="srv-l">' + sv.map(article).join('') + '</div>';
  const intro = net(spec.intro_services) ? '<p class="intro">' + esc(net(spec.intro_services)) + '</p>' : '';
  return { html: '<section class="sec" id="services"><div class="w"><div class="sec-t"><h2 class="t">' + esc(net(spec.titre_services) || 'Ce que nous faisons') + '</h2>' + intro + '</div>' + corps + '</div></section>', utilisees: utilisees };
}
function sectionAtouts(spec) {
  const a = (spec.atouts || []).slice(0, 3);
  if (!a.length) return '';
  return '<section class="sec sec-s" id="atouts"><div class="w"><h2 class="t">' + esc(net(spec.titre_atouts) || 'Pourquoi nous appeler') + '</h2><div class="atouts">' + a.map(function (x) { return '<div><h3 class="st">' + esc(net(x.titre)) + '</h3><p>' + esc(net(x.texte)) + '</p></div>'; }).join('') + '</div></div></section>';
}
// les étapes se lisent comme une phrase : « D'abord, vous nous écrivez. Ensuite, ... »
function sectionEtapes(spec) {
  const e = (spec.etapes || []).slice(0, 3);
  if (e.length < 2) return '';
  const mots = e.length === 2 ? ['D\'abord', 'Ensuite'] : ['D\'abord', 'Ensuite', 'Enfin'];
  const phrase = e.map(function (x, k) { return mots[k] + ', ' + minuscule(x.titre) + '.'; }).join(' ');
  return '<section class="sec" id="etapes"><div class="w"><h2 class="t etapes-t">' + esc(phrase) + '</h2><div class="etapes">' + e.map(function (x, k) { return '<div><h3>' + mots[k] + '</h3><p>' + esc(net(x.texte)) + '</p></div>'; }).join('') + '</div></div></section>';
}
function sectionGalerie(ctx, photos) {
  const ph = photos.slice(0, 3);
  if (ph.length < 2) return '';
  return '<section class="sec" id="images" style="padding-top:0"><div class="w"><div class="gal n' + ph.length + '">' + ph.map(function (p, k) { return figure(p, ctx, 'lazy', k === 0 ? '(max-width:760px) 100vw, 66vw' : '(max-width:760px) 50vw, 33vw'); }).join('') + '</div></div></section>';
}
function sectionFaq(spec) {
  const f = (spec.faq || []).slice(0, 6);
  if (!f.length) return '';
  return '<section class="sec" id="faq"><div class="w faq"><h2 class="t">' + esc(net(spec.titre_faq) || 'Vos questions') + '</h2><div>' + f.map(function (x) { return '<details><summary>' + esc(net(x.q)) + '</summary><p>' + esc(net(x.r)) + '</p></details>'; }).join('') + '</div></div></section>';
}
function sectionContact(spec, ctx) {
  const c = spec.contact || {}, ty = ctx.type;
  const t = telHref(c.tel), w = waHref(c.tel, (OBJECTIFS[spec.objectif] || OBJECTIFS.devis).wa);
  let gros = '';
  if (t) { const n = MQ.affiche(c.tel); gros = '<a class="gros" href="' + esc(t) + '" style="--gk:' + ((n.length + 1) * ty.chasse * 1.06).toFixed(2) + '">' + esc(n) + '</a>'; }
  else if (c.email) gros = '<a class="gros" href="mailto:' + esc(c.email) + '" style="--gk:' + ((c.email.length + 1) * ty.chasse * 1.1).toFixed(2) + '">' + esc(c.email) + '</a>';
  const actions = [];
  if (w) actions.push(lienA({ href: w, ext: true }, 'btn b1', T.icone('whatsapp') + '<span>Écrire sur WhatsApp</span>'));
  if (c.email && (t || w)) actions.push('<a class="lien2" href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
  const infos = [];
  if (c.adresse || spec.commune) infos.push('<div><h3>Adresse</h3><p>' + esc(c.adresse || (spec.commune + ', Martinique')) + '</p>' + (c.maps ? '<p><a href="' + esc(c.maps) + '" target="_blank" rel="noopener">Itinéraire</a></p>' : '') + '</div>');
  if (c.horaires && c.horaires.length) infos.push('<div><h3>Horaires</h3><ul>' + c.horaires.slice(0, 7).map(function (h) { const x = net(h); return '<li>' + esc(x.charAt(0).toUpperCase() + x.slice(1)) + '</li>'; }).join('') + '</ul></div>');
  const zoneUtile = net(spec.zone) && ['devis', 'appel'].indexOf(spec.objectif || 'devis') >= 0 && !/^(Basés? (à|au|aux|en) .+, en Martinique|En Martinique)$/i.test(net(spec.zone));
  if (zoneUtile) infos.push('<div><h3>Où nous intervenons</h3><p>' + esc(net(spec.zone)) + '</p></div>');
  return '<section class="contact sur-champ" id="contact"><div class="w"><h2 class="t">' + esc(net(spec.titre_contact) || 'Écrivez-nous, on vous répond') + '</h2>' + gros + (actions.length ? '<div class="actions">' + actions.join('') + '</div>' : '') + (infos.length ? '<div class="c-infos">' + infos.join('') + '</div>' : '') + '</div></section>';
}

/* ── page complète ── */
function aDesIllustrations(ctx) { return ctx.photos.some(function (p) { return p.credit; }); }
function page(spec, ctx, contenu, o) {
  o = o || {};
  const p = ctx.palette, ty = ctx.type, nom = net(spec.nom);
  const titre = o.titre || (spec.seo && net(spec.seo.titre)) || (nom + (spec.activite ? ', ' + net(spec.activite) : '') + (spec.commune ? ' à ' + spec.commune : ''));
  const desc = o.description || (spec.seo && net(spec.seo.description)) || net(spec.chapo);
  const marque = ctx.logo ? '<img src="' + esc(ctx.racineImg + ctx.logo.fichier) + '" alt="' + esc(nom) + '"' + (ctx.logo.l && ctx.logo.h ? ' width="' + ctx.logo.l + '" height="' + ctx.logo.h + '"' : '') + '>' : '<span>' + esc(nom) + '</span>';
  const navPages = ctx.pages.filter(function (x) { return x.nav; });
  const nav = navPages.length > 1
    ? navPages.map(function (x) { return '<a class="l" href="' + esc(ctx.lien(x.chemin)) + '"' + (o.chemin === x.chemin ? ' aria-current="page"' : '') + '>' + esc(x.nav) + '</a>'; }).join('')
    : ((spec.services || []).length ? '<a class="l" href="#services">' + esc(net(spec.titre_services).length && net(spec.titre_services).length <= 16 ? net(spec.titre_services) : 'Services') + '</a>' : '') + ((spec.faq || []).length ? '<a class="l" href="#faq">Questions</a>' : '') + '<a class="l" href="#contact">Contact</a>';
  const a = actionPrincipale(spec);
  const cta = a ? lienA(a, 'btn b1', T.icone(a.icone) + '<span class="long">' + esc(a.type === 'tel' ? 'Appeler' : a.texte) + '</span><span class="court">' + esc(a.court) + '</span>') : '';
  const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="' + (ctx.da.rayon === 'rond' ? 32 : 0) + '" fill="' + p.champ + '"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="' + p.surChamp + '">' + esc(nom.charAt(0).toUpperCase()) + '</text></svg>');
  const ld = { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: nom, description: desc, telephone: spec.contact && MQ.e164(spec.contact.tel) || undefined, email: spec.contact && spec.contact.email || undefined, areaServed: net(spec.zone) || 'Martinique', address: { '@type': 'PostalAddress', addressLocality: spec.commune || undefined, addressRegion: 'Martinique', addressCountry: 'MQ', streetAddress: (spec.legal && spec.legal.adresse) || undefined }, url: ctx.url || undefined };
  const illus = aDesIllustrations(ctx);
  const veux = ctx.contactNovalemo ? '<a href="mailto:' + esc(ctx.contactNovalemo) + '?subject=' + encodeURIComponent('Je veux ce site : ' + nom) + '&amp;body=' + encodeURIComponent(F.corpsMailto(spec)) + '">Je veux ce site</a>' : '';
  const apercu = ctx.mode === 'apercu' ? '<aside class="apercu" role="note"><span class="long"><b>Aperçu préparé par Novalemo pour ' + esc(nom) + '.</b> ' + (illus ? 'Photos d\'illustration, à remplacer par les vôtres.' : 'Pas encore en ligne officiellement.') + '</span><span class="court"><b>Aperçu Novalemo</b>' + (illus ? ', photos d\'illustration.' : ', pas encore en ligne.') + '</span>' + veux + '</aside>' : '';
  const barre = ctx.mode === 'live' && a ? (function () {
    const c = spec.contact || {}, t = telHref(c.tel);
    const deux = a.type === 'whatsapp' && t ? '<a class="btn b2" href="' + esc(t) + '">' + T.icone('tel') + '<span>Appeler</span></a>' : '';
    return '<nav class="barre" aria-label="Contact rapide">' + lienA(a, 'btn b1', T.icone(a.icone) + '<span>' + esc(a.court) + '</span>') + deux + '</nav>';
  })() : '';
  const legal = ctx.lien('mentions-legales/');
  const prechargees = [T.FICHIERS_POLICES[ty.titre][0].fichier].concat(ty.texte !== ty.titre ? [T.FICHIERS_POLICES[ty.texte][0].fichier] : []);
  const classes = [p.clair ? 'clair' : 'sombre', 'm-' + ctx.da.mouvement, ctx.mode === 'apercu' ? 'a-apercu' : '', barre ? 'a-barre' : ''].filter(Boolean).join(' ');
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>' + esc(titre) + '</title><meta name="description" content="' + esc(desc.slice(0, 160)) + '">' +
    (ctx.mode === 'apercu' ? '<meta name="robots" content="noindex,nofollow">' : (ctx.url ? '<link rel="canonical" href="' + esc(ctx.url + (o.chemin || '')) + '">' : '')) +
    '<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="' + esc(titre) + '"><meta property="og:description" content="' + esc(desc.slice(0, 200)) + '">' +
    '<meta name="theme-color" content="' + p.fond + '"><link rel="icon" href="' + favicon + '">' +
    prechargees.map(function (f) { return '<link rel="preload" href="/_f/' + f + '" as="font" type="font/woff2" crossorigin>'; }).join('') +
    '<style>' + ctx.css + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    '</head><body class="' + classes + '"><a class="saut" href="#contenu">Aller au contenu</a>' +
    '<header class="tete"><div class="w"><a class="marque" href="' + esc(ctx.lien('')) + '" aria-label="' + esc(nom) + ', accueil">' + marque + '</a><nav class="nav" aria-label="Navigation">' + nav + cta + '</nav></div></header>' +
    '<main id="contenu">' + contenu + '</main>' +
    '<footer class="pied"><div class="w"><span class="np">' + esc(nom) + '</span><span>© ' + ctx.annee + ' ' + esc(nom) + (spec.commune ? ', ' + esc(spec.commune) + ', Martinique' : '') + '</span><a href="' + esc(legal) + '">Mentions légales</a><a href="' + esc(NOVALEMO.signature_site.url) + '" target="_blank" rel="noopener">' + esc(NOVALEMO.signature_site.texte) + '</a></div></footer>' +
    barre + apercu + '</body></html>';
}

function mentions(spec, ctx) {
  const l = spec.legal || {}, c = spec.contact || {}, id = ctx.identite || {};
  const nom = net(spec.nom);
  const ed = [
    '<strong>' + esc(l.raison_sociale || nom) + '</strong>' + (l.forme ? ', ' + esc(l.forme) : ''),
    l.siret ? 'SIRET : ' + esc(l.siret) : (l.siren ? 'SIREN : ' + esc(l.siren) : null),
    l.adresse ? 'Adresse : ' + esc(l.adresse) : (spec.commune ? 'Commune : ' + esc(spec.commune) + ', Martinique' : null),
    c.tel ? 'Téléphone : ' + esc(MQ.affiche(c.tel)) : null,
    c.email ? 'Email : ' + esc(c.email) : null,
    l.dirigeant ? 'Directeur de la publication : ' + esc(l.dirigeant) : null
  ].filter(Boolean);
  const realise = id.entreprise ? esc(id.entreprise) + (id.siret ? ', SIRET ' + esc(id.siret) : '') + (id.marque ? ' (' + esc(id.marque) + ')' : '') : 'Studio Novalem';
  const credits = ctx.photos.filter(function (p) { return p.credit; }).map(function (p) { const k = p.credit; return 'Photo de ' + (k.page_auteur ? '<a href="' + esc(k.page_auteur) + '" target="_blank" rel="noopener">' + esc(k.auteur || 'auteur inconnu') + '</a>' : esc(k.auteur || 'auteur inconnu')) + ' sur ' + (k.page ? '<a href="' + esc(k.page) + '" target="_blank" rel="noopener">' + esc(k.source) + '</a>' : esc(k.source)); }).filter(function (x, k, a) { return a.indexOf(x) === k; });
  const corps = '<section class="page-h"><div class="w"><h1 class="t h1" style="--hk:' + k2('Mentions légales', ctx.type) + '">Mentions légales</h1></div></section>' +
    '<section class="sec" style="padding-top:0"><div class="w prose">' +
    (ctx.mode === 'apercu' && !l.siret && !l.siren ? '<p><strong>Aperçu :</strong> les informations légales de l\'entreprise sont complétées à la mise en ligne.</p>' : '') +
    '<h2>Éditeur du site</h2><p>' + ed.join('<br>') + '</p>' +
    '<h2>Hébergement</h2><p>' + esc(HEBERGEUR) + '.</p>' +
    '<h2>Réalisation</h2><p>' + realise + '.</p>' +
    (credits.length ? '<h2>Photos</h2><p>Photos d\'illustration, libres de droits : ' + credits.join(', ') + '.</p>' : '') +
    '<h2>Données personnelles</h2><p>Ce site ne dépose aucun cookie, n\'utilise aucun outil de mesure d\'audience et ne collecte aucune donnée par formulaire. Les informations que vous transmettez par email, téléphone ou WhatsApp servent uniquement à répondre à votre demande et ne sont jamais cédées. Vous pouvez demander leur suppression à tout moment en écrivant à l\'éditeur.</p>' +
    '<h2>Propriété intellectuelle</h2><p>Les textes, images et éléments graphiques de ce site appartiennent à leur éditeur ou à leurs auteurs. Toute reproduction sans autorisation est interdite.</p>' +
    '</div></section>';
  return page(spec, ctx, corps, { titre: 'Mentions légales, ' + nom, chemin: 'mentions-legales/' });
}

// les pages d'une formule (le plan du site)
function plan(formule, spec) {
  if (formule === 'vitrine' || formule === 'signature') {
    const p = [{ chemin: '', nav: 'Accueil' }, { chemin: 'services/', nav: 'Services' }, { chemin: 'a-propos/', nav: 'À propos' }, { chemin: 'contact/', nav: 'Contact' }, { chemin: 'mentions-legales/' }];
    if (formule === 'signature') (spec.services || []).forEach(function (s) { p.push({ chemin: 'services/' + slugifier(net(s.titre)) + '/', service: s }); });
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
  const photos = (spec.photos || []).filter(function (p) { return p && p.fichier; });
  const da = DN.de(spec);
  const racinePhysique = (mode === 'live' ? 's/' : 'a/') + site.slug + '/';
  const base = mode === 'live' ? '/' : '/' + racinePhysique;
  const pages = plan(formule, spec);
  const ty = T.typo(da.type), pal = T.palette(da.palette, spec.accent);
  const ctx = {
    mode: mode, da: da, palette: pal, type: ty, photos: photos, logo: spec.logo && spec.logo.fichier ? spec.logo : null, pages: pages,
    racinePhysique: racinePhysique, racineImg: base + 'img/', optimiseur: opts.optimiseur !== false,
    lien: function (chemin) { return base + chemin; }, url: mode === 'live' && opts.url ? opts.url.replace(/\/?$/, '/') : null,
    identite: opts.identite || null, contactNovalemo: opts.contactNovalemo || null, annee: new Date().getFullYear()
  };
  ctx.css = css(ctx);
  const files = [];
  const mettre = function (chemin, html) { files.push({ file: racinePhysique + chemin + 'index.html', data: html }); };
  // chaque photo ne sert qu'une fois : le haut de page, puis les services, puis la galerie
  const apresHero = photos.slice(['lieu', 'scene', 'monument', 'sobre'].indexOf(da.direction) >= 0 && photos.length ? 1 : 0);
  const srv = sectionServices(spec, ctx, apresHero);
  const reste = apresHero.slice(srv.utilisees);
  if (pages.length <= 2) {
    mettre('', page(spec, ctx, hero(spec, ctx) + srv.html + sectionAtouts(spec) + sectionGalerie(ctx, reste) + sectionEtapes(spec) + sectionFaq(spec) + sectionContact(spec, ctx), { chemin: '' }));
  } else {
    mettre('', page(spec, ctx, hero(spec, ctx) + srv.html + sectionAtouts(spec) + sectionGalerie(ctx, reste) + sectionContact(spec, ctx), { chemin: '' }));
    const avecLiens = formule === 'signature';
    const tete = function (titre, sous) { const x = net(titre); return '<section class="page-h"><div class="w"><h1 class="t h1" style="--hk:' + k2(x, ty) + '">' + esc(x) + '</h1>' + (net(sous) ? '<p class="chapo">' + esc(net(sous)) + '</p>' : '') + '</div></section>'; };
    const liste = '<section class="sec" style="padding-top:0"><div class="w"><div class="srv-l">' + (spec.services || []).map(function (s) { const t = net(s.titre); return '<article><h3 class="st">' + (avecLiens ? '<a href="' + esc(ctx.lien('services/' + slugifier(t) + '/')) + '">' + esc(t) + '</a>' : esc(t)) + '</h3><p>' + esc(net(s.detail || s.texte)) + '</p></article>'; }).join('') + '</div></div></section>';
    mettre('services/', page(spec, ctx, tete(spec.titre_services || 'Ce que nous faisons', spec.intro_services) + liste + sectionEtapes(spec) + sectionContact(spec, ctx), { chemin: 'services/', titre: 'Services, ' + net(spec.nom) }));
    mettre('a-propos/', page(spec, ctx, tete(spec.titre_apropos || spec.nom, spec.zone) + '<section class="sec" style="padding-top:0"><div class="w prose"><p style="font-size:1.2rem;color:var(--encre)">' + esc(net(spec.a_propos || spec.chapo)) + '</p></div></section>' + sectionAtouts(spec) + sectionGalerie(ctx, photos.slice(0, 3)) + sectionContact(spec, ctx), { chemin: 'a-propos/', titre: 'À propos, ' + net(spec.nom) }));
    mettre('contact/', page(spec, ctx, sectionContact(spec, ctx) + sectionFaq(spec), { chemin: 'contact/', titre: 'Contact, ' + net(spec.nom) }));
    pages.filter(function (x) { return x.service; }).forEach(function (x) {
      const s = x.service, t = net(s.titre) + (spec.commune ? ' à ' + spec.commune : '');
      mettre(x.chemin, page(spec, ctx, tete(t, s.texte) + '<section class="sec" style="padding-top:0"><div class="w prose"><p style="font-size:1.15rem;color:var(--encre)">' + esc(net(s.detail || s.texte)) + '</p></div></section>' + sectionEtapes(spec) + sectionFaq(spec) + sectionContact(spec, ctx),
        { chemin: x.chemin, titre: t + ', ' + net(spec.nom), description: net(s.texte) }));
    });
  }
  mettre('mentions-legales/', mentions(spec, ctx));
  if (mode === 'live') {
    const hote = ctx.url || '';
    files.push({ file: racinePhysique + 'robots.txt', data: 'User-agent: *\nAllow: /\n' + (hote ? 'Sitemap: ' + hote + 'sitemap.xml\n' : '') });
    if (hote) files.push({ file: racinePhysique + 'sitemap.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(function (x) { return '<url><loc>' + esc(hote + x.chemin) + '</loc></url>'; }).join('') + '</urlset>\n' });
  }
  return { files: files, pages: pages.map(function (x) { return x.chemin; }), compo: da.direction, da: da, palette: pal };
}

module.exports = { rendre, slugifier, actionPrincipale, OBJECTIFS, HEBERGEUR, esc, net };
