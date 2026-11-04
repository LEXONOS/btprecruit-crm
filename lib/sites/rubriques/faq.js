// Les questions fréquentes : celles de la fiche (spec.faq), jamais une question ou une réponse inventée. Quatre mises en
// scène : des cartes marquées d'un grand point d'interrogation, un accordéon centré qui s'ouvre en douceur, un tableau
// questions et réponses en deux colonnes, une fenêtre de discussion (les questions de l'entreprise en bulles, sans
// prénom ni fausse conversation). Chacune finit sur le moyen de poser une autre question.
'use strict';
// la ponctuation française : une espace insécable avant ? ! : ; (le point d'interrogation ne tombe jamais seul à la ligne)
function fr(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0'); }
// les apparitions communes finissent sur clip-path:inset(0) : levé ici, pour ne rogner ni ombres, ni anneaux, ni débords
function libre(cls) { return '.js .' + cls + ' [data-r].vu:not([data-r=rideau]):not([data-r=store]):not([data-r=iris]){clip-path:none}\n.' + cls + ' p{text-wrap:pretty}'; }
function titre(ctx) { return (ctx.mod.textes && ctx.mod.textes.faq) || 'Questions fréquentes'; }
// « une autre question ? » : l'action principale du site, dite pour une question
function autre(spec, ctx) {
  const h = ctx.h, a = h.actionPrincipale(spec);
  if (!a) return null;
  return { a: a, texte: a.type === 'whatsapp' ? 'Posez-la sur WhatsApp' : a.type === 'tel' ? 'Appelez-nous' : 'Écrivez-nous', bouton: a.type === 'whatsapp' ? 'Écrire sur WhatsApp' : a.type === 'tel' ? 'Appeler' : 'Écrire un email', long: a.type === 'whatsapp' ? 'Posez votre question sur WhatsApp' : a.type === 'tel' ? 'Posez votre question au ' + require('../../martinique').affiche((spec.contact || {}).tel) : 'Posez votre question par email' };
}

/* ── 1. des cartes marquées d'un grand point d'interrogation ── */
const cartes = {
  id: 'faq.cartes', rubrique: 'faq', nom: 'Cartes', quand: 'deux à six questions : chaque question dans sa carte, toutes ouvertes, et une carte pour poser la sienne',
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return ctx.h.faqDe(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, f = h.faqDe(spec), x = autre(spec, ctx);
    const cs = f.map(function (q, k) { return '<article class="fc-c"' + h.rv('monte', k) + '><span class="fc-m" aria-hidden="true">?</span><h3>' + h.esc(fr(q.q)) + '</h3><p>' + h.esc(fr(q.r)) + '</p></article>'; });
    if (x) cs.push('<div class="fc-c fc-plus"' + h.rv('monte', f.length) + '><h3>Votre question n\'est pas là\u00a0?</h3><p>' + h.esc(x.texte) + ', tout simplement.</p><div class="actions">' + h.lienA(x.a, 'btn b1', h.contenuBouton(x.a.icone, x.bouton)) + '</div></div>');
    return '<section class="' + h.classes('faq.cartes', bloc, 'sec') + '" id="faq">' + h.fond(bloc) + '<div class="w">' + h.teteSec(titre(ctx)) + '<div class="fc t' + cs.length + '">' + cs.join('') + '</div></div></section>';
  },
  css: function () { return `
${libre('r-faq-cartes')}
.r-faq-cartes{--t1:var(--btn);--t2:var(--btnT)}
.r-faq-cartes .fc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2vw,26px);align-items:start}
.r-faq-cartes .fc.t4{grid-template-columns:repeat(2,minmax(0,1fr))}
.r-faq-cartes .fc.t7 .fc-plus{grid-column:1/-1}
.r-faq-cartes .fc:not(.t4)>:nth-child(3n+2){margin-top:clamp(0px,3vw,44px)}
.r-faq-cartes .fc.t4>:nth-child(2n){margin-top:clamp(0px,3vw,44px)}
.r-faq-cartes .fc-c{position:relative;overflow:hidden;isolation:isolate;background:var(--carte);border:1px solid var(--bord);border-radius:var(--r);padding:clamp(26px,2.8vw,40px);display:grid;gap:14px;align-content:start;min-height:clamp(200px,18vw,260px);transition:transform .6s var(--ease),border-color .4s,box-shadow .6s var(--ease)}
.r-faq-cartes .fc-c::before{content:"";position:absolute;left:0;top:0;height:4px;width:100%;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform 1.1s var(--ease) .25s}
.r-faq-cartes .fc-c.vu::before,html:not(.js) .r-faq-cartes .fc-c::before{transform:scaleX(.28)}
.r-faq-cartes .fc-c:hover::before{transform:scaleX(1);transition-delay:0s}
.r-faq-cartes .fc-m{position:absolute;right:clamp(14px,1.8vw,26px);bottom:-.26em;z-index:-1;font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:clamp(6rem,10vw,9rem);line-height:1;color:color-mix(in srgb,var(--acc) 16%,transparent);transition:transform .9s var(--ease),color .5s}
.r-faq-cartes .fc-c:hover{transform:translateY(-6px);box-shadow:var(--ombre);border-color:color-mix(in srgb,var(--acc) 45%,var(--bord))}
.r-faq-cartes .fc-c:hover .fc-m{transform:rotate(-12deg) scale(1.06);color:color-mix(in srgb,var(--acc) 30%,transparent)}
.r-faq-cartes .fc-c h3{font-size:clamp(1.12rem,1.4vw,1.25rem);line-height:1.35;max-width:26ch}
.r-faq-cartes .fc-c p{max-width:46ch}
.r-faq-cartes .fc-c p{color:var(--tx2)}
.r-faq-cartes .fc-plus{background:var(--t1);color:var(--t2);border-color:transparent;--tx:var(--t2);--btn:var(--t2);--btnT:var(--t1);align-content:space-between}
.r-faq-cartes .fc-plus p{color:color-mix(in srgb,var(--t2) 84%,var(--t1))}
.r-faq-cartes .fc-plus::before{background:var(--t2)}
.r-faq-cartes .fc-plus .b1{box-shadow:none}
@media(max-width:900px){.r-faq-cartes .fc,.r-faq-cartes .fc.t4{grid-template-columns:repeat(2,minmax(0,1fr))}.r-faq-cartes .fc>*{margin-top:0!important}.r-faq-cartes .fc.t3 .fc-plus,.r-faq-cartes .fc.t5 .fc-plus,.r-faq-cartes .fc.t7 .fc-plus{grid-column:1/-1}}
@media(max-width:600px){.r-faq-cartes .fc,.r-faq-cartes .fc.t4{grid-template-columns:1fr}.r-faq-cartes .fc-c{min-height:0}}
`; }
};

/* ── 2. l'accordéon centré qui s'ouvre en douceur ── */
const centre = {
  id: 'faq.centre', rubrique: 'faq', nom: 'Accordéon centré', quand: 'deux questions ou plus : une colonne centrée, la première ouverte, les réponses qui s\'ouvrent et se referment en douceur',
  surfaces: ['surface', 'fond', 'champ'], js: [],
  besoin: function (spec, ctx) { return ctx.h.faqDe(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, f = h.faqDe(spec), x = autre(spec, ctx);
    const items = f.map(function (q, k) { return '<details class="fz-i"' + (k === 0 ? ' open' : '') + h.rv('monte', k) + '><summary><span class="fz-q">' + h.esc(fr(q.q)) + '</span><span class="fz-ic" aria-hidden="true"></span></summary><div class="fz-r"><p>' + h.esc(fr(q.r)) + '</p></div></details>'; }).join('');
    return '<section class="' + h.classes('faq.centre', bloc, 'sec') + '" id="faq">' + h.fond(bloc) + '<div class="w fz">' + h.teteSec(titre(ctx), null, { classe: 'c' }) + '<div class="fz-l">' + items + '</div>' +
      (x ? '<p class="fz-plus"' + h.rv('monte', f.length) + '><span>Une autre question\u00a0?</span>' + h.lienA(x.a, 'fz-lien', h.icone(x.a.icone) + '<span>' + h.esc(x.texte) + '</span>') + '</p>' : '') + '</div></section>';
  },
  // l'ouverture et la fermeture en douceur (sans script, ou en mouvement réduit : l'accordéon natif)
  script: "[].slice.call(d.querySelectorAll('.r-faq-centre details')).forEach(function(x){var s=x.querySelector('summary'),r=x.querySelector('.fz-r');if(!s||!r||!r.animate)return;" +
    "s.addEventListener('click',function(e){if(calme)return;e.preventDefault();if(x.classList.contains('bouge'))return;x.classList.add('bouge');" +
    "if(x.open){x.classList.add('ferme');var h=r.offsetHeight;var a=r.animate([{height:h+'px',opacity:1},{height:'0px',opacity:0}],{duration:380,easing:'cubic-bezier(.65,0,.35,1)'});a.onfinish=function(){x.open=false;x.classList.remove('bouge','ferme')}}" +
    "else{x.open=true;var h2=r.offsetHeight;var b2=r.animate([{height:'0px',opacity:0},{height:h2+'px',opacity:1}],{duration:560,easing:'cubic-bezier(.16,1,.3,1)'});b2.onfinish=function(){x.classList.remove('bouge')}}})})",
  css: function () { return `
${libre('r-faq-centre')}
.r-faq-centre .fz-l{max-width:820px;margin-inline:auto;background:var(--carte);border:1px solid var(--bord);border-radius:calc(var(--r) * 1.4 + 6px);padding:clamp(6px,1vw,10px);box-shadow:var(--ombre)}
.r-faq-centre .fz-i{position:relative;border-radius:calc(var(--r) * 1.4);transition:background-color .5s}
.r-faq-centre .fz-i+.fz-i::before{content:"";position:absolute;left:clamp(18px,2.4vw,30px);right:clamp(18px,2.4vw,30px);top:0;height:1px;background:var(--bord)}
.r-faq-centre .fz-i[open]{background:color-mix(in srgb,var(--acc) 7%,transparent)}
.r-faq-centre .fz-i[open]+.fz-i::before,.r-faq-centre .fz-i[open]::before{opacity:0}
.r-faq-centre summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:clamp(20px,2.4vw,28px) clamp(18px,2.4vw,30px);border-radius:inherit;-webkit-tap-highlight-color:transparent}
.r-faq-centre summary::-webkit-details-marker{display:none}
.r-faq-centre .fz-q{font-weight:var(--fxf);font-size:clamp(1.08rem,1.5vw,1.26rem);line-height:1.38;transition:transform .5s var(--ease),color .3s}
.r-faq-centre summary:hover .fz-q{transform:translateX(4px)}
.r-faq-centre .fz-i[open] .fz-q{color:var(--accT)}
.r-faq-centre .fz-ic{position:relative;flex:none;width:44px;height:44px;border-radius:50%;border:1.5px solid var(--bord);transition:background-color .45s,border-color .45s,transform .6s var(--ease)}
.r-faq-centre .fz-ic::before,.r-faq-centre .fz-ic::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:2px;margin:-1px 0 0 -7px;border-radius:2px;background:currentColor;transition:transform .5s var(--ease)}
.r-faq-centre .fz-ic::after{transform:rotate(90deg)}
.r-faq-centre .fz-i[open]:not(.ferme) .fz-ic{background:var(--btn);border-color:var(--btn);color:var(--btnT);transform:rotate(135deg)}
.r-faq-centre summary:hover .fz-ic{border-color:var(--acc)}
.r-faq-centre .fz-r{overflow:hidden}
.r-faq-centre .fz-r p{padding:0 clamp(18px,2.4vw,30px) clamp(22px,2.6vw,30px);color:var(--tx2);max-width:64ch;font-size:1.05rem}
.r-faq-centre .fz-plus{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 14px;margin-top:clamp(26px,3vw,40px);color:var(--tx2)}
.r-faq-centre .fz-lien{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:var(--fxf);color:var(--tx);text-decoration:none}
.r-faq-centre .fz-lien .ic{color:var(--accT)}
.r-faq-centre .fz-lien span{background:linear-gradient(currentColor,currentColor) left bottom/100% 1.5px no-repeat;transition:background-size .5s var(--ease)}
.r-faq-centre .fz-lien:hover span{background-size:0 1.5px;background-position:right bottom}
`; }
};

/* ── 3. questions et réponses en deux colonnes ── */
const colonnes = {
  id: 'faq.colonnes', rubrique: 'faq', nom: 'Questions et réponses en colonnes', quand: 'deux à six questions aux réponses courtes : un tableau éditorial, la question en grand à gauche, la réponse ouverte à droite',
  surfaces: ['fond', 'surface', 'champ'], js: [],
  besoin: function (spec, ctx) { return ctx.h.faqDe(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, f = h.faqDe(spec), x = autre(spec, ctx);
    const rangs = f.map(function (q, k) { return '<div class="fl-i"' + h.rv('monte', k) + '><h3 class="fl-q">' + h.esc(fr(q.q)) + '</h3><p class="fl-r">' + h.esc(fr(q.r)) + '</p></div>'; }).join('');
    return '<section class="' + h.classes('faq.colonnes', bloc, 'sec') + '" id="faq">' + h.fond(bloc) + '<div class="w"><div class="fl-tete"' + h.rv('monte') + '><h2 class="t">' + h.esc(titre(ctx)) + '</h2>' +
      (x ? '<p class="fl-plus"><span>Une autre question\u00a0?</span>' + h.lienA(x.a, 'btn b2', h.contenuBouton(x.a.icone, x.texte)) + '</p>' : '') + '</div><div class="fl-l">' + rangs + '</div></div></section>';
  },
  css: function () { return `
${libre('r-faq-colonnes')}
.r-faq-colonnes .fl-tete{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:20px 40px;margin-bottom:clamp(30px,4vw,56px)}
.r-faq-colonnes .fl-tete h2.t{max-width:16ch}
.r-faq-colonnes .fl-plus{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;color:var(--tx2)}
.r-faq-colonnes .fl-i{position:relative;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:14px clamp(24px,5vw,90px);padding-block:clamp(26px,3.4vw,44px);border-top:1px solid var(--bord)}
.r-faq-colonnes .fl-i:last-child{border-bottom:1px solid var(--bord)}
.r-faq-colonnes .fl-i::before{content:"";position:absolute;left:0;top:-1px;width:min(120px,30%);height:2px;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform 1.2s var(--ease) .2s}
.r-faq-colonnes .fl-i.vu::before,html:not(.js) .r-faq-colonnes .fl-i::before{transform:none}
.r-faq-colonnes .fl-q{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.35rem,2.3vw,2rem);line-height:1.12;text-wrap:balance;transition:transform .6s var(--ease),color .4s}
.r-faq-colonnes .fl-r{color:var(--tx2);font-size:clamp(1.05rem,1.3vw,1.16rem);line-height:1.65;max-width:60ch;padding-top:.2em}
.r-faq-colonnes .fl-i:hover .fl-q{transform:translateX(6px);color:var(--accT)}
@media(max-width:760px){.r-faq-colonnes .fl-i{grid-template-columns:1fr}}
`; }
};

/* ── 4. les questions de l'entreprise en bulles, comme dans une discussion ── */
const bulles = {
  id: 'faq.bulles', rubrique: 'faq', nom: 'Questions en bulles', quand: 'deux à six questions, métiers proches de leurs clients : une fenêtre de discussion aux couleurs du site, la question en bulle à droite, la réponse à gauche, et la barre pour écrire la sienne (sans prénom ni fausse conversation)',
  surfaces: ['surface', 'fond', 'champ'], js: [],
  besoin: function (spec, ctx) { return ctx.h.faqDe(spec).length >= 2; },
  rendre: function (spec, ctx, bloc) {
    const h = ctx.h, f = h.faqDe(spec), x = autre(spec, ctx);
    let i = 0;
    const fil = f.map(function (q) { return '<article class="fb-p"><h3 class="fb-q"' + h.rv('zoom', i++) + '>' + h.esc(fr(q.q)) + '</h3><p class="fb-r"' + h.rv('zoom', i++) + '>' + h.esc(fr(q.r)) + '</p></article>'; }).join('');
    const ecrire = x ? h.lienA(x.a, 'fb-ecrire', '<span class="fb-champ"><span class="fb-l">' + h.esc(x.long) + '</span><span class="fb-c">' + h.esc(x.bouton) + '</span></span><span class="fb-env">' + h.icone(x.a.type === 'tel' ? 'tel' : 'fleche') + '</span>') : '';
    return '<section class="' + h.classes('faq.bulles', bloc, 'sec') + '" id="faq">' + h.fond(bloc) + '<div class="w">' + h.teteSec(titre(ctx), null, { classe: 'c' }) +
      '<div class="fb-fen"' + h.rv('monte', 1) + '><div class="fb-barre" aria-hidden="true"><span class="fb-av">' + h.icone(ctx.iconeMetier) + '</span><span class="fb-nom">' + h.esc(h.net(spec.nom)) + '</span></div><div class="fb-fil">' + fil + '</div>' + ecrire + '</div></div></section>';
  },
  css: function () { return `
${libre('r-faq-bulles')}
.r-faq-bulles .fb-fen{max-width:760px;margin-inline:auto;border-radius:calc(var(--r) * 1.4 + 12px);overflow:hidden;border:1px solid var(--bord);background:color-mix(in srgb,var(--tx) 4%,var(--douce));box-shadow:var(--ombreF)}
.r-faq-bulles .fb-barre{display:flex;align-items:center;gap:14px;padding:14px clamp(16px,2.4vw,24px);background:var(--carte);border-bottom:1px solid var(--bord)}
.r-faq-bulles .fb-av{width:44px;height:44px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--btn);color:var(--btnT)}
.r-faq-bulles .fb-av .ic{width:22px;height:22px}
.r-faq-bulles .fb-nom{font-weight:var(--fxf);font-size:1.05rem;line-height:1.2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.r-faq-bulles .fb-fil{display:grid;gap:clamp(18px,2.4vw,26px);padding:clamp(20px,3.4vw,40px) clamp(14px,3vw,36px);background-image:radial-gradient(color-mix(in srgb,var(--tx) 9%,transparent) 1.1px,transparent 1.6px);background-size:20px 20px}
.r-faq-bulles .fb-p{display:grid;gap:10px}
.r-faq-bulles .fb-q,.r-faq-bulles .fb-r{position:relative;max-width:min(86%,520px);padding:13px 18px 14px;line-height:1.5;box-shadow:0 1px 1px rgb(0 0 0 / .06),0 8px 20px -14px rgb(0 0 0 / .35)}
.r-faq-bulles .fb-q{justify-self:end;font-size:1.04rem;font-weight:var(--fxf);background:var(--btn);color:var(--btnT);border-radius:18px 4px 18px 18px;transform-origin:100% 0}
.r-faq-bulles .fb-r{justify-self:start;font-size:1rem;background:var(--carte);color:var(--tx);border-radius:4px 18px 18px 18px;transform-origin:0 0}
.r-faq-bulles .fb-q::after,.r-faq-bulles .fb-r::after{content:"";position:absolute;top:0;width:10px;height:12px}
.r-faq-bulles .fb-q::after{right:-8px;background:var(--btn);clip-path:polygon(0 0,100% 0,0 100%)}
.r-faq-bulles .fb-r::after{left:-8px;background:var(--carte);clip-path:polygon(0 0,100% 0,100% 100%)}
.r-faq-bulles .fb-ecrire{display:flex;align-items:center;gap:12px;padding:12px clamp(12px,2vw,18px);background:var(--carte);border-top:1px solid var(--bord);text-decoration:none;color:var(--tx)}
.r-faq-bulles .fb-champ{flex:1;min-width:0;min-height:48px;display:flex;align-items:center;padding:0 18px;border-radius:999px;background:color-mix(in srgb,var(--tx) 6%,transparent);color:var(--tx2);font-size:1rem;transition:background-color .3s,color .3s}
.r-faq-bulles .fb-env{width:48px;height:48px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--btn);color:var(--btnT);transition:transform .5s var(--ease)}
.r-faq-bulles .fb-c{display:none}
.r-faq-bulles .fb-ecrire:hover .fb-champ{background:color-mix(in srgb,var(--tx) 10%,transparent);color:var(--tx)}
.r-faq-bulles .fb-ecrire:hover .fb-env{transform:translateX(3px) rotate(-8deg)}
@media(max-width:560px){.r-faq-bulles .fb-q,.r-faq-bulles .fb-r{max-width:90%}.r-faq-bulles .fb-champ{padding:0 16px}.r-faq-bulles .fb-l{display:none}.r-faq-bulles .fb-c{display:inline}}
`; }
};

module.exports = [cartes, centre, colonnes, bulles];
