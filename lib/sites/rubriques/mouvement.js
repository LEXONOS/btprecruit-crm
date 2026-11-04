// Le mouvement des sites : un petit script maison, écrit dans la page (aucune requête vers un tiers, aucun traceur),
// fait de modules dont la page ne reçoit que ceux que ses rubriques demandent. Tout reste lisible sans lui : la classe
// « js » n'est posée que s'il tourne, et retirée s'il ne démarre pas (le contenu ne reste jamais caché). Les personnes
// qui demandent moins d'animations à leur appareil n'ont ni apparitions, ni parallaxe, ni effets au survol.
'use strict';

// posé tout en haut de la page, avant le premier rendu
const TETE = "document.documentElement.classList.add('js');setTimeout(function(){if(!window.__nv)document.documentElement.classList.remove('js')},2600)";

const MODULES = {
  // apparitions au défilement : chaque [data-r] reçoit « vu » quand il entre à l'écran
  // (un élément entièrement découpé par clip-path, rideau, store, iris, n'est jamais « vu » par l'observateur : on
  // observe son parent à sa place ; « vu » est posé deux images plus tard, pour que l'état caché ait été dessiné une
  // fois et que la transition parte toujours, même pour le haut de page)
  base: `
var vus=[].slice.call(d.querySelectorAll('[data-r]'));
var cible=function(e){return /^(rideau|store|iris)$/.test(e.getAttribute('data-r')||'')&&e.parentElement?e.parentElement:e};
var rf=w.requestAnimationFrame||function(f){setTimeout(f,16)};
var montrer=function(e){rf(function(){rf(function(){e.classList.add('vu')})})};
if(calme||!('IntersectionObserver' in w)){vus.forEach(montrer)}
else{var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){(x.target.__nvr||[]).forEach(montrer);io.unobserve(x.target)}})},{rootMargin:'0px 0px -7% 0px',threshold:0});
vus.forEach(function(e){var c=cible(e);(c.__nvr=c.__nvr||[]).push(e);io.observe(c)});
setTimeout(function(){vus.forEach(function(e){if(!e.classList.contains('vu')){var r=cible(e).getBoundingClientRect();if(r.top<w.innerHeight&&r.bottom>0)montrer(e)}})},1800)}`,
  // l'en-tête : se resserre et prend un fond dès qu'on défile ; [data-tete=cache] se range quand on descend
  tete: `
var t=d.querySelector('[data-tete]');if(t){var y0=0,tic=0;var maj=function(){tic=0;var y=w.scrollY||0;t.classList.toggle('defile',y>12);if(t.getAttribute('data-tete')==='cache'&&!b.classList.contains('menu-ouvert')){t.classList.toggle('range',y>y0&&y>320)}y0=y};w.addEventListener('scroll',function(){if(!tic){tic=1;requestAnimationFrame(maj)}},{passive:true});maj()}`,
  // le menu sur téléphone : le bouton (trois traits qui deviennent une croix) ouvre le panneau, Échap le ferme
  menu: `
var mb=d.querySelector('[data-menu-bouton]'),mp=d.querySelector('[data-menu]');
if(mb&&mp){var ouvrir=function(o){b.classList.toggle('menu-ouvert',o);mb.setAttribute('aria-expanded',o?'true':'false');mb.setAttribute('aria-label',o?'Fermer le menu':'Ouvrir le menu');mp.classList.toggle('ouvert',o);if(o){var l=mp.querySelector('a');if(l)setTimeout(function(){l.focus()},60)}else{mb.focus()}};
mb.addEventListener('click',function(){ouvrir(mb.getAttribute('aria-expanded')!=='true')});
mp.addEventListener('click',function(e){if(e.target===mp||e.target.closest('a'))ouvrir(false)});
d.addEventListener('keydown',function(e){if(e.key==='Escape'&&mb.getAttribute('aria-expanded')==='true')ouvrir(false)});
w.addEventListener('resize',function(){if(w.innerWidth>900&&mb.getAttribute('aria-expanded')==='true')ouvrir(false)})}`,
  // les chiffres vrais (note Google, nombre d'avis) qui défilent jusqu'à leur valeur
  compteur: `
var cs=[].slice.call(d.querySelectorAll('[data-compte]'));
var compter=function(e){var v=parseFloat(e.getAttribute('data-compte')),dec=+(e.getAttribute('data-dec')||0),t0=0,du=1400;var f=function(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/du);k=1-Math.pow(1-k,3);e.textContent=(v*k).toFixed(dec).replace('.',',');if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)};
if(!calme&&'IntersectionObserver' in w){var ic=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){compter(e.target);ic.unobserve(e.target)}})},{threshold:.6});cs.forEach(function(e){ic.observe(e)})}`,
  // un carrousel à défilement natif : boutons précédent / suivant, désactivés aux extrémités
  carrousel: `
[].slice.call(d.querySelectorAll('[data-carrousel]')).forEach(function(c){var p=c.querySelector('[data-piste]'),pr=c.querySelector('[data-prec]'),su=c.querySelector('[data-suiv]');if(!p)return;
var pas=function(){var x=p.querySelector(':scope>*');return x?x.getBoundingClientRect().width+parseFloat(getComputedStyle(p).columnGap||getComputedStyle(p).gap||0):p.clientWidth*.8};
var etat=function(){if(pr)pr.disabled=p.scrollLeft<8;if(su)su.disabled=p.scrollLeft+p.clientWidth>p.scrollWidth-8};
if(pr)pr.addEventListener('click',function(){p.scrollBy({left:-pas(),behavior:calme?'auto':'smooth'})});
if(su)su.addEventListener('click',function(){p.scrollBy({left:pas(),behavior:calme?'auto':'smooth'})});
p.addEventListener('scroll',function(){requestAnimationFrame(etat)},{passive:true});etat()})`,
  // la parallaxe douce : [data-px="0.15"] glisse un peu moins vite que la page
  parallaxe: `
var px=[].slice.call(d.querySelectorAll('[data-px]'));
if(px.length&&!calme){var tk=0;var bouge=function(){tk=0;var h=w.innerHeight;px.forEach(function(e){var r=e.parentElement.getBoundingClientRect();if(r.bottom<-50||r.top>h+50)return;var k=parseFloat(e.getAttribute('data-px'))||.15;e.style.transform='translate3d(0,'+((r.top+r.height/2-h/2)*-k).toFixed(1)+'px,0)'})};w.addEventListener('scroll',function(){if(!tk){tk=1;requestAnimationFrame(bouge)}},{passive:true});w.addEventListener('resize',bouge);bouge()}`,
  // les boutons aimantés : ils suivent un peu la souris (seulement avec une souris)
  aimant: `
if(!calme&&w.matchMedia('(hover:hover) and (pointer:fine)').matches){[].slice.call(d.querySelectorAll('[data-aimant]')).forEach(function(e){e.addEventListener('pointermove',function(v){var r=e.getBoundingClientRect();e.style.transform='translate('+((v.clientX-r.left-r.width/2)*.18).toFixed(1)+'px,'+((v.clientY-r.top-r.height/2)*.28).toFixed(1)+'px)'});e.addEventListener('pointerleave',function(){e.style.transform=''})})}`,
  // « Ouvert maintenant » : calculé à l'heure de la Martinique (UTC-4, sans heure d'été) d'après les horaires affichés
  ouvert: `
[].slice.call(d.querySelectorAll('[data-horaires]')).forEach(function(e){try{var j=JSON.parse(e.getAttribute('data-horaires'));var n=new Date(Date.now()-4*3600000);var jr=(n.getUTCDay()+6)%7,mn=n.getUTCHours()*60+n.getUTCMinutes();
var hm=function(m){var h=Math.floor(m/60),x=m%60;return h+'\\u00a0h'+(x?'\\u00a0'+(x<10?'0':'')+x:'')};var noms=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
var auj=j.filter(function(x){return x[0]===jr})[0],ouv=false,fin=null,proch=null;
if(auj)auj[1].forEach(function(p){if(mn>=p[0]&&mn<p[1]){ouv=true;fin=p[1]}});
if(!ouv){for(var k=0;k<8&&!proch;k++){var jj=(jr+k)%7,x=j.filter(function(y){return y[0]===jj})[0];if(x)x[1].forEach(function(p){if(!proch&&(k>0||p[0]>mn))proch={j:jj,m:p[0],k:k}})}}
var t=e.querySelector('[data-ouvert-texte]')||e;e.classList.add(ouv?'est-ouvert':'est-ferme');
t.textContent=ouv?(fin>=1440?'Ouvert maintenant':'Ouvert maintenant, jusqu\\'à\\u00a0'+hm(fin)):(proch?('Fermé, ouvre '+(proch.k===0?'aujourd\\'hui':proch.k===1?'demain':noms[proch.j])+' à\\u00a0'+hm(proch.m)):'Fermé')}catch(x){}})`,
  // les onglets (services par catégorie) : flèches du clavier, un seul panneau visible
  onglets: `
[].slice.call(d.querySelectorAll('[data-onglets]')).forEach(function(o){var bs=[].slice.call(o.querySelectorAll('[role=tab]'));var voir=function(k,f){bs.forEach(function(x,i){var on=i===k;x.setAttribute('aria-selected',on?'true':'false');x.tabIndex=on?0:-1;var p=d.getElementById(x.getAttribute('aria-controls'));if(p){p.hidden=!on;if(on){p.classList.remove('vu');void p.offsetWidth;p.classList.add('vu')}}});if(f)bs[k].focus()};
bs.forEach(function(x,i){x.addEventListener('click',function(){voir(i)});x.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();voir((i+(e.key==='ArrowRight'?1:bs.length-1))%bs.length,1)}})});
var k0=bs.findIndex(function(x){return x.getAttribute('aria-selected')==='true'});if(bs.length)voir(k0<0?0:k0)})`,
  // une liste dont chaque ligne montre sa photo au survol (sur ordinateur)
  survol: `
[].slice.call(d.querySelectorAll('[data-survol]')).forEach(function(l){var ims=[].slice.call(l.querySelectorAll('[data-survol-img]'));[].slice.call(l.querySelectorAll('[data-survol-cle]')).forEach(function(x){var on=function(){var k=x.getAttribute('data-survol-cle');ims.forEach(function(i){i.classList.toggle('on',i.getAttribute('data-survol-img')===k)});l.querySelectorAll('[data-survol-cle]').forEach(function(y){y.classList.toggle('on',y===x)})};x.addEventListener('mouseenter',on);x.addEventListener('focusin',on)})})`,
  // la visionneuse : une photo de la galerie s'ouvre en grand, Échap ou un clic la referme
  visionneuse: `
var dv=d.querySelector('[data-visionneuse]');if(dv&&dv.showModal){var vi=dv.querySelector('img');[].slice.call(d.querySelectorAll('[data-zoom]')).forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();vi.src=a.getAttribute('href');vi.alt=a.getAttribute('data-alt')||'';dv.showModal()})});dv.addEventListener('click',function(){dv.close()})}`,
  // le petit formulaire : il prépare un message WhatsApp ou un email, rien n'est envoyé ni gardé par le site
  formulaire: `
[].slice.call(d.querySelectorAll('[data-formulaire]')).forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var lignes=[];[].slice.call(f.querySelectorAll('[data-q]')).forEach(function(c){var v=(c.value||'').trim();if(v)lignes.push(c.getAttribute('data-q')+' : '+v)});var txt=(f.getAttribute('data-intro')||'Bonjour,')+'\\n'+lignes.join('\\n');var wa=f.getAttribute('data-wa'),ml=f.getAttribute('data-mail');var u=wa?'https://wa.me/'+wa+'?text='+encodeURIComponent(txt):'mailto:'+ml+'?subject='+encodeURIComponent(f.getAttribute('data-sujet')||'Demande')+'&body='+encodeURIComponent(txt);if(wa)w.open(u,'_blank','noopener');else w.location.href=u})})`,
  // la barre de progression de lecture
  progression: `
var pg=d.querySelector('[data-progression]');if(pg){var tp=0;var av=function(){tp=0;var h=d.documentElement.scrollHeight-w.innerHeight;pg.style.transform='scaleX('+(h>0?Math.min(1,(w.scrollY||0)/h):0).toFixed(4)+')'};w.addEventListener('scroll',function(){if(!tp){tp=1;requestAnimationFrame(av)}},{passive:true});av()}`,
  // le halo : une lumière douce suit la souris sur les sections qui le demandent
  halo: `
if(!calme&&w.matchMedia('(hover:hover) and (pointer:fine)').matches){[].slice.call(d.querySelectorAll('.f-halo,[data-halo]')).forEach(function(f){var s=f.classList.contains('fond')?f.parentElement:f;s.addEventListener('pointermove',function(v){var r=s.getBoundingClientRect();f.style.setProperty('--mx',(v.clientX-r.left)+'px');f.style.setProperty('--my',(v.clientY-r.top)+'px')})})}`,
  // les cartes qui s'inclinent légèrement vers la souris
  inclinaison: `
if(!calme&&w.matchMedia('(hover:hover) and (pointer:fine)').matches){[].slice.call(d.querySelectorAll('[data-tilt]')).forEach(function(e){e.addEventListener('pointermove',function(v){var r=e.getBoundingClientRect(),x=(v.clientX-r.left)/r.width-.5,y=(v.clientY-r.top)/r.height-.5;e.style.transform='perspective(900px) rotateX('+(-y*6).toFixed(2)+'deg) rotateY('+(x*8).toFixed(2)+'deg) translateY(-4px)'});e.addEventListener('pointerleave',function(){e.style.transform=''})})}`,
  // les bandeaux qui défilent s'arrêtent quand ils ne sont plus à l'écran (économie de batterie)
  defile: `
if('IntersectionObserver' in w){var id=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('arret',!e.isIntersecting)})});[].slice.call(d.querySelectorAll('[data-defile]')).forEach(function(e){id.observe(e)})}`
};
const NOMS = Object.keys(MODULES);

function minifier(s) { return s.replace(/\n\s*/g, ''); }
// le script de la page, avec les seuls modules demandés (base toujours là), et les scripts propres à certaines
// variantes (chacun isolé dans sa propre portée : une erreur dans l'un n'arrête pas les autres, et une variable d'un
// module ne peut pas écraser celle d'un autre ; ils voient w, d, b et calme)
function script(modules, propres) {
  const voulus = ['base'].concat((modules || []).filter(function (m, k, a) { return MODULES[m] && m !== 'base' && a.indexOf(m) === k; }));
  const extra = (propres || []).filter(function (x, k, a) { return x && a.indexOf(x) === k; });
  const isoler = function (x) { return 'try{(function(){' + x + '\n})()}catch(e){}'; };
  return minifier('(function(){var w=window,d=document,b=d.body;w.__nv=1;var calme=w.matchMedia&&w.matchMedia(\'(prefers-reduced-motion: reduce)\').matches;' + voulus.map(function (m) { return isoler(MODULES[m]); }).join('') + extra.map(isoler).join('') + '})();');
}

module.exports = { TETE, MODULES, NOMS, script };
