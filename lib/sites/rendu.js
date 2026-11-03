// Rendu déterministe d'un site à partir de sa fiche (spec) et de sa donne (spec.da, voir donne.js) : un des huit
// modèles de modeles.js, habillé de sa palette et de sa voix. HTML et CSS faits main, aucun framework, aucun script, aucune
// requête vers un tiers (polices et images servies par le site lui-même, pas de cookie, pas de traceur). Même fiche =
// mêmes fichiers. Peu de texte, des photos du métier, un seul geste demandé : écrire ou appeler.
// Aperçu : une page + mentions légales, bandeau « aperçu », noindex. En ligne : la formule décide des pages.
'use strict';
const T = require('./theme');
const DN = require('./donne');
const M = require('./modeles');
const F = require('./fiche');
const J = require('./juridique');
const MQ = require('../martinique');
const { NOVALEMO } = require('../config');

const HEBERGEUR = J.HEBERGEUR_TEXTE;
// les largeurs servies par l'optimiseur d'images de Vercel : une seule liste, partagée avec vercel.json (publication.js),
// car une largeur demandée qui n'y figure pas renvoie une erreur et l'image ne s'affiche pas
const LARGEURS_IMAGES = [480, 960, 1600, 2200];

/* ── texte ── */
const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
// les anciennes fiches marquaient un mot **ainsi** : on retire les marques
function net(s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
function slugifier(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'page'; }
function majuscule(s) { s = net(s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ── liens d'action ── */
function telHref(t) { const e = MQ.e164(t); return e ? 'tel:' + e : null; }
function waHref(t, texte) { const e = MQ.e164(t); return e && F.portable(t) ? 'https://wa.me/' + e.replace('+', '') + '?text=' + encodeURIComponent(texte || 'Bonjour') : null; }
function mailHref(email, sujet, corps) { return email ? 'mailto:' + email + '?subject=' + encodeURIComponent(sujet) + (corps ? '&body=' + encodeURIComponent(corps) : '') : null; }
const OBJECTIFS = {
  devis: { sujet: 'Demande de devis', corps: 'Bonjour,\n\nJe souhaite un devis pour :\n\nAdresse ou commune :\nMon téléphone :\n\nMerci', wa: 'Bonjour, je viens de votre site. Je voudrais un devis pour : ', bouton: 'Demander un devis', waBouton: 'Devis sur WhatsApp', phrase: 'Pour un devis, écrivez-nous ou appelez : on vous répond avec plaisir.' },
  appel: { sujet: 'Demande de rappel', corps: 'Bonjour,\n\nPouvez-vous me rappeler au :\n\nMerci', wa: 'Bonjour, je viens de votre site. Pouvez-vous me rappeler ?', bouton: 'Être rappelé', waBouton: 'Écrire sur WhatsApp', phrase: 'Un souci, une question : appelez ou écrivez, on vous répond.' },
  reservation: { sujet: 'Demande de rendez-vous', corps: 'Bonjour,\n\nJe souhaite un rendez-vous pour :\nMes disponibilités :\nMon téléphone :\n\nMerci', wa: 'Bonjour, je viens de votre site. Je voudrais réserver : ', bouton: 'Réserver', waBouton: 'Réserver sur WhatsApp', phrase: 'Pour réserver, écrivez-nous ou appelez.' },
  visite: { sujet: 'Renseignements', corps: 'Bonjour,\n\n', wa: 'Bonjour, je viens de votre site. ', bouton: 'Nous écrire', waBouton: 'Écrire sur WhatsApp', phrase: 'Une question, une commande : écrivez-nous ou appelez.' },
  inscription: { sujet: 'Demande d\'inscription', corps: 'Bonjour,\n\nJe souhaite des informations pour une inscription :\nMon téléphone :\n\nMerci', wa: 'Bonjour, je viens de votre site. Je voudrais des informations pour une inscription.', bouton: 'Demander les infos', waBouton: 'Infos sur WhatsApp', phrase: 'Pour vous inscrire ou poser une question, écrivez-nous ou appelez.' }
};
// L'action principale du site : WhatsApp dès qu'on a un portable, sinon l'appel, sinon l'email préparé
function actionPrincipale(spec) {
  const c = spec.contact || {}, o = OBJECTIFS[spec.objectif] || OBJECTIFS.devis;
  const w = waHref(c.mobile || c.tel, o.wa);
  if (w) return { type: 'whatsapp', href: w, texte: o.waBouton, court: 'WhatsApp', icone: 'whatsapp', ext: true };
  const t = telHref(c.tel);
  if (t) return { type: 'tel', href: t, texte: 'Appeler le ' + MQ.affiche(c.tel), court: 'Appeler', icone: 'tel' };
  const m = mailHref(c.email, o.sujet + (spec.nom ? ' : ' + net(spec.nom) : ''), o.corps);
  if (m) return { type: 'mail', href: m, texte: net(spec.cta) || o.bouton, court: 'Écrire', icone: 'mail' };
  return null;
}
// L'action d'appoint : l'appel quand l'action principale est WhatsApp, sinon l'email
function actionSeconde(spec, a) {
  const c = spec.contact || {};
  if (a && a.type === 'whatsapp' && telHref(c.tel)) return { href: telHref(c.tel), texte: MQ.affiche(c.tel), icone: 'tel' };
  if (a && a.type === 'tel' && c.email) return { href: 'mailto:' + c.email, texte: 'Écrire un email', icone: 'mail' };
  return null;
}
function lienA(a, cls, contenu, label) { return '<a class="' + cls + '" href="' + esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' + contenu + '</a>'; }
function boutons(spec, o) {
  o = o || {};
  const a = actionPrincipale(spec);
  if (!a) return '';
  const s = o.seule ? null : actionSeconde(spec, a);
  return '<div class="actions">' + lienA(a, 'btn b1', T.icone(a.icone) + '<span>' + esc(a.texte) + '</span>', a.type === 'whatsapp' ? a.texte : null) + (s ? '<a class="btn b2" href="' + esc(s.href) + '">' + T.icone(s.icone) + '<span>' + esc(s.texte) + '</span></a>' : '') + '</div>';
}

/* ── horaires : « lundi: 07:30 – 17:00 » (Google) devient « Lun – ven : 7 h 30 – 17 h » ── */
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
function heure(h, m) { return Number(h) + ' h' + (m && m !== '00' ? ' ' + m : ''); }
function lireHoraires(lignes) {
  if (!Array.isArray(lignes) || !lignes.length) return null;
  const jours = [];
  for (const brut of lignes) {
    const x = net(brut).replace(/[  ]/g, ' ');
    const m = x.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*:\s*(.+)$/i);
    if (!m) return null;
    const v = m[2];
    let val;
    if (/ferm/i.test(v)) val = 'Fermé';
    else if (/24\s?h|24\/24/i.test(v)) val = '24 h sur 24';
    else {
      const plages = [];
      v.replace(/(\d{1,2})\s?[:h]\s?(\d{2})?\s*[–—-]\s*(\d{1,2})\s?[:h]\s?(\d{2})?/g, function (z, a, b, c, d) { plages.push(heure(a, b) + ' – ' + heure(c, d)); return z; });
      if (!plages.length) return null;
      val = plages.join(', ');
    }
    jours.push({ j: JOURS.indexOf(m[1].toLowerCase()), v: val });
  }
  jours.sort(function (a, b) { return a.j - b.j; });
  // jours consécutifs aux mêmes heures : regroupés
  const groupes = [];
  jours.forEach(function (d) { const g = groupes[groupes.length - 1]; if (g && g.v === d.v && g.fin === d.j - 1) g.fin = d.j; else groupes.push({ debut: d.j, fin: d.j, v: d.v }); });
  return groupes;
}
function nomGroupe(g, court) {
  const n = function (j) { const x = JOURS[j]; return court ? x.slice(0, 3) : x; };
  if (g.debut === 0 && g.fin === 6) return court ? '7 j sur 7' : 'Tous les jours';
  if (g.debut === g.fin) return majuscule(n(g.debut));
  if (g.fin === g.debut + 1) return majuscule(n(g.debut)) + (court ? ', ' : ' et ') + n(g.fin);
  return majuscule(n(g.debut)) + (court ? ' – ' : ' au ') + n(g.fin);
}
function resumeHoraires(lignes) {
  const g = lireHoraires(lignes);
  if (!g) return null;
  const ouverts = g.filter(function (x) { return x.v !== 'Fermé'; });
  if (!ouverts.length) return null;
  return nomGroupe(ouverts[0], true) + ' ' + ouverts[0].v.split(', ').join(' · ');
}
function ouvertLeSamedi(lignes) { const g = lireHoraires(lignes); return !!g && g.some(function (x) { return x.debut <= 5 && x.fin >= 5 && x.v !== 'Fermé'; }); }

/* ── ce que l'on sait de sûr : la note Google, le lieu, WhatsApp, le samedi ── */
function etoiles(note) {
  const n = Math.max(0, Math.min(5, Number(note) || 0));
  const rang = function (cls) { let x = ''; for (let k = 0; k < 5; k++) x += T.icone('etoile'); return '<span class="' + cls + '">' + x + '</span>'; };
  return '<span class="etoiles" aria-hidden="true" style="--n:' + Math.round(n / 5 * 100) + '%">' + rang('vd') + rang('pl') + '</span>';
}
function noteGoogle(spec) { const g = spec.google; return g && Number(g.note) >= 4 && Number(g.avis) >= 5 ? g : null; }
function zoneClient(spec) { return spec.provenance && spec.provenance.zone === 'client' && net(spec.zone) ? net(spec.zone) : null; }
function lieuCourt(spec) {
  const z = zoneClient(spec);
  if (z) return z.length <= 46 ? z : z.slice(0, 44).replace(/[ ,;]+[^ ,;]*$/, '') + '…';
  return spec.commune ? 'Basés ' + MQ.a(spec.commune) : 'En Martinique';
}
function confiance(spec, opts) {
  opts = opts || {};
  const out = [];
  const g = noteGoogle(spec);
  if (g) out.push('<li>' + etoiles(g.note) + '<span><b>' + String(g.note).replace('.', ',') + '</b> sur Google · ' + g.avis + ' avis</span></li>');
  if (['visite', 'reservation'].indexOf(spec.objectif) >= 0 && spec.commune) out.push('<li>' + T.icone('pin') + '<span>' + esc(spec.commune) + ', Martinique</span></li>');
  else out.push('<li>' + T.icone('pin') + '<span>' + esc(lieuCourt(spec)) + '</span></li>');
  const c = spec.contact || {};
  if (ouvertLeSamedi(horairesDe(c))) out.push('<li>' + T.icone('horloge') + '<span>Ouvert le samedi</span></li>');
  else if (waHref(c.mobile || c.tel)) out.push('<li>' + T.icone('whatsapp') + '<span>Joignable sur WhatsApp</span></li>');
  return '<ul class="confiance">' + out.slice(0, opts.max || 3).join('') + '</ul>';
}

/* ── mesures : chaque grand titre est taillé pour sa colonne, sans jamais déborder ── */
function deuxLignes(texte) {
  const m = net(texte).split(' ').filter(Boolean);
  if (m.length < 2) return net(texte).length;
  let best = Infinity;
  for (let k = 1; k < m.length; k++) best = Math.max(0, Math.min(best, Math.max(m.slice(0, k).join(' ').length, m.slice(k).join(' ').length)));
  return best;
}
function motMax(texte) { return net(texte).split(' ').reduce(function (n, w) { return Math.max(n, w.length); }, 0); }
// --hk : la largeur du titre en « em » ; la police est ensuite calculée pour que la colonne la contienne (marge de 6 %)
function k2(texte, ty) { return (Math.max(deuxLignes(texte) + 1.5, motMax(texte) + 1) * ty.chasse * 1.06).toFixed(2); }
function kUne(texte, ty) { const n = net(texte).length; return n <= 20 ? ((n + 1) * ty.chasse * 1.06).toFixed(2) : k2(texte, ty); }

/* ── icônes du métier ── */
// chaque motif est cherché au début d'un mot (« entreprise » n'est pas une prise, « commerce » n'est pas la mer) ;
// $ marque un mot entier (« mer » mais pas « mercerie »)
const ICONES_MOTS = [
  ['clim|froid|frigo|r[ée]frig', 'flocon'], ['ventil|vmc|a[ée]ration', 'ventilateur'], ['chauffe-eau|plomb|fuites?$|sanitaire|douche|robinet|canalis|eau$', 'goutte'],
  ['[ée]lectri|courant$|tableau[x]?$|c[âa]bl|prises?$', 'eclair'], ['solaire|photovolta', 'soleil'], ['piscin|bassin', 'vagues'], ['d[ée]m[ée]nag|cartons?$|garde-meuble', 'cartons'],
  ['nettoy|m[ée]nage$|propret|lavage|vitres$', 'etincelles'], ['fen[êe]tre|vitr|menuis|alu$|alumin|baie|volet|stores?$', 'fenetre'], ['s[ée]curit|alarme|cam[ée]ra|surveill', 'bouclier'],
  ['transport|livraison|camion|fret$', 'camion'], ['jardin|paysag|[ée]lag|tonte|plantes?$|plantation|haies?$|gazon|arbres?$', 'feuille'], ['pneu|jante|volant', 'volant'],
  ['autos?$|automobile|voiture|garage|m[ée]cani|carross|vidange|v[ée]hicule|motos?$', 'voiture'], ['imprim|impression|flocage|enseigne', 'imprimante'], ['informatique|ordinateur|r[ée]seau|sites?$|num[ée]rique', 'ecran'],
  ['photo|vid[ée]o|drone', 'appareil'], ['formations?$|cours$|permis|code$|[ée]cole|soutien', 'diplome'], ['repas|plats?$|cuisine|menus?$|traiteur|d[ée]jeuner|d[îi]ner|buffet|g[âa]teau|p[âa]tiss|pains?$|boulang|cocktail|accras|poulet|poisson', 'couverts'],
  ['fleur|bouquet|d[ée]cor', 'fleur'], ['peint|ravalement|fa[çc]ade|enduit', 'rouleau'], ['toit|couvreur|couverture$|charpent|[ée]tanch|goutti', 'toit'], ['serrur|portes?$|blind|cl[ée]s?$', 'cadenas'],
  ['bateau|mer$|excursion|plong|nautique|catamaran|kayak|p[êe]che$|snorkel|voile$', 'bateau'], ['massage|soins?$|beaut|visage|corps$|bien-[êe]tre|spa$|[ée]pilation', 'coeur'], ['coiff|coupes?$|couleur|barbe|ongles?$|manucure|p[ée]dicure', 'etincelles'],
  ['chambres?$|g[îi]tes?$|villa|h[ée]berg|s[ée]jour|nuits?$|terrasse', 'maison'], ['ma[çc]on|b[âa]timent|r[ée]nov|construct|carrel|dalles?$|b[ée]ton|travaux|gros (?:œ|oe)uvre', 'maison'], ['devis|[ée]tudes?$|diagnostic|conseil', 'devis'],
  ['entretien|maintenance|contr[ôo]le|r[ée]vision', 'cle'], ['d[ée]pann|r[ée]par|pannes?$|urgence', 'outils'], ['install|poses?$|montage|remplacement', 'outils'], ['rendez-vous|r[ée]serv', 'calendrier'],
  ['sant[ée]$|m[ée]dic|kin[ée]|infirm|ost[ée]o|th[ée]rap', 'coeur'], ['ventes?$|boutique|produits?$|magasin|achats?$|rayons?$|[ée]picerie|fruits?$|l[ée]gumes?$', 'etoile'], ['local|proximit|communes?$|quartier|martinique', 'pin'], ['propre|soign|nets?$', 'etincelles'],
  ['explic|parl|[ée]coute|r[ée]pon', 'bulle'], ['[ée]quipe|famil|ensemble$', 'equipe'], ['heures?$|ponctu|d[ée]lais?$|rapide|horaires?$', 'horloge'], ['prix$|tarif|clairs?$|transparen', 'devis'], ['garanti|s[ûu]ret[ée]|confiance|assur', 'bouclier']
].map(function (x) { return [new RegExp('(?<![\\p{L}\\p{N}])(?:' + x[0].split('|').map(function (m) { return /\$$/.test(m) ? m.slice(0, -1) + '(?![\\p{L}\\p{N}])' : m; }).join('|') + ')', 'iu'), x[1]]; });
function iconePour(texte, defaut) {
  const t = String(texte || '');
  for (const x of ICONES_MOTS) if (x[0].test(t)) return x[1];
  return defaut || 'check';
}
function iconeDe(item, secours) { return item && T.NOMS_ICONES.indexOf(item.icone) >= 0 ? item.icone : iconePour((item && item.titre) + ' ' + (item && item.texte), secours); }

/* ── feuille de style ── */
function triplet(h) { const x = String(h).replace('#', ''); const n = parseInt(x, 16); return ((n >> 16) & 255) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255); }
function couleurs(p) {
  const voile = T.contraste('#ffffff', p.champ) >= 9 ? p.champ : T.melange(p.champ, '#000000', 0.62);
  const carte = p.clair ? (p.fond.toLowerCase() === '#ffffff' ? '#ffffff' : T.melange(p.fond, '#ffffff', 0.65)) : p.surface;
  return {
    voile: triplet(voile), carte: carte,
    ligne: T.melange(p.encre, p.fond, p.clair ? 0.87 : 0.82),
    teinte: T.melange(p.accent, p.fond, p.clair ? 0.87 : 0.8),
    teinteTexte: T.lisible(p.accent, T.melange(p.accent, p.fond, p.clair ? 0.87 : 0.8), 4.5),
    ombre: p.clair ? '0 1px 2px rgb(16 24 40 / .05), 0 18px 44px -20px rgb(16 24 40 / .28)' : '0 1px 0 rgb(255 255 255 / .04), 0 18px 44px -18px rgb(0 0 0 / .7)'
  };
}

function css(ctx) {
  const p = ctx.palette, ty = ctx.type, mod = ctx.mod, k = couleurs(p);
  const faces = [];
  [ty.titre, ty.texte].filter(function (x, i, a) { return a.indexOf(x) === i; }).forEach(function (cle) {
    (T.FICHIERS_POLICES[cle] || []).forEach(function (f) { faces.push('@font-face{font-family:"' + f.famille + '";src:url(/_f/' + f.fichier + ') format("woff2");font-weight:' + f.poids + ';' + (f.etirement ? 'font-stretch:' + f.etirement + ';' : '') + 'font-display:swap}'); });
  });
  const ft = T.FICHIERS_POLICES[ty.titre][0].famille, fx = T.FICHIERS_POLICES[ty.texte][0].famille;
  const repli = function (f) { return ty.serif && f === fx ? 'ui-serif,Georgia,"Times New Roman",serif' : (f === ft && /bodoni|fraunces|young|besley|newsreader/i.test(f) ? 'ui-serif,Georgia,serif' : 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'); };
  const ech = 0.5 / ty.chasse;
  const h2a = Math.max(1.7, Math.min(2.2, 2 * ech)).toFixed(2), h2b = Math.max(2.3, Math.min(3.4, 3.05 * ech)).toFixed(2);
  const f = mod.forme;
  return faces.join('') + `
:root{color-scheme:${p.clair ? 'light' : 'dark'};--fond:${p.fond};--surface:${p.surface};--carte:${k.carte};--encre:${p.encre};--doux:${p.doux};--accent:${p.accent};--surA:${p.surAccent};--accentT:${p.accentTexte};--champ:${p.champ};--surC:${p.surChamp};--champDoux:${p.champDoux};--vif:${p.vif};--surV:${p.surVif};--ligne:${k.ligne};--teinte:${k.teinte};--teinteT:${k.teinteTexte};--voile:${k.voile};--ombre:${k.ombre};--ft:"${ft}",${repli(ft)};--fx:"${fx}",${repli(fx)};--tp:${ty.poids};--ti:${ty.interlettre};--th:${ty.hauteur};--tc:${ty.casse};--tr:${ty.reglage};--te:${ty.etirement || 'normal'};--fxr:${ty.reglageTexte || 'normal'};--fxf:${ty.texteFort};--g:clamp(18px,4.4vw,48px);--w:1200px;--r:${f.r};--rb:${f.rb};--rp:${f.rp};--h2a:${h2a}rem;--h2b:${h2b}rem;--corps:${ty.serif ? '1.1rem' : '1.0625rem'}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;accent-color:var(--accent);scroll-padding-top:24px}
@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
body{margin:0;background:var(--fond);color:var(--encre);font-family:var(--fx);font-weight:400;font-size:var(--corps);line-height:1.6;font-variation-settings:var(--fxr);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;overflow-x:clip}
::selection{background:var(--accent);color:var(--surA)}
img{display:block;max-width:100%;height:auto}
a{color:inherit;text-decoration-thickness:.07em;text-underline-offset:.2em}
:focus-visible{outline:3px solid var(--accentT);outline-offset:3px}
.sur-champ :focus-visible,.sur-photo :focus-visible{outline-color:currentColor}
.w{width:min(var(--w),100% - 2*var(--g));margin-inline:auto}
.saut{position:absolute;left:-9999px;top:8px;z-index:99;background:var(--encre);color:var(--fond);padding:10px 14px}.saut:focus{left:8px}
.ic{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.t{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);line-height:var(--th);text-wrap:balance;margin:0;overflow-wrap:break-word}
h2.t,#contact h1.t{font-size:clamp(var(--h2a),3.6vw,var(--h2b));line-height:1.02}
h3{margin:0;font-weight:var(--fxf);font-size:1.2rem;line-height:1.3}
p,ul,ol{margin:0}ul,ol{padding:0;list-style:none}
.h1{font-size:max(1.75rem,min(var(--hmax),calc(100cqi / var(--hk))));hyphens:auto;-webkit-hyphens:auto}
.ph{margin:0;overflow:hidden;background:var(--surface);border-radius:var(--rp)}
.ph img{width:100%;height:100%;object-fit:cover}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 24px;border:2px solid transparent;border-radius:var(--rb);font-family:var(--fx);font-weight:var(--fxf);font-size:1.02rem;line-height:1.1;text-decoration:none;white-space:nowrap;cursor:pointer;transition:transform .2s cubic-bezier(.2,.7,0,1),filter .2s;-webkit-tap-highlight-color:transparent}
.btn:hover{transform:translateY(-2px);filter:brightness(1.06)}.btn:active{transform:none}
.b1{background:var(--accent);color:var(--surA)}
.b2{border-color:currentColor;color:var(--encre)}
.sur-champ .b1{background:var(--vif);color:var(--surV)}
.sur-champ .b2{color:var(--surC)}
.sur-photo .b2{color:#fff;border-color:rgb(255 255 255 / .8)}
.caps .btn{text-transform:uppercase;letter-spacing:.06em;font-size:.93rem}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px}
@media(max-width:480px){.actions .btn{flex:1 1 100%}}
.confiance{display:flex;flex-wrap:wrap;gap:10px 26px;font-size:.95rem;line-height:1.35}
.confiance li{display:flex;align-items:center;gap:8px}
.confiance .ic{color:var(--accentT);width:18px;height:18px}
.sur-photo .confiance,.sur-champ .confiance{opacity:.95}
.sur-photo .confiance .ic{color:#fff}.sur-champ .confiance .ic{color:var(--vif)}
.etoiles{position:relative;display:inline-flex;flex:none}
.etoiles>span{display:inline-flex;gap:1px}
.etoiles .pl{position:absolute;inset:0 auto 0 0;width:var(--n);overflow:hidden}
.etoiles .ic{width:16px;height:16px;flex:none;stroke:none}.etoiles .pl .ic{fill:#f5b301}.etoiles .vd .ic{fill:currentColor;opacity:.25}
.h-phrase{font-size:clamp(1.08rem,1.45vw,1.28rem);line-height:1.5;max-width:44ch}
/* en-tête */
.topbar{background:var(--champ);color:var(--surC);font-size:.88rem;line-height:1.3}
.topbar .w{display:flex;flex-wrap:wrap;align-items:center;gap:6px 26px;min-height:42px;padding-block:6px}
.topbar a,.topbar span{display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.topbar .ic{width:16px;height:16px;color:var(--vif)}
.topbar .d{margin-left:auto;font-weight:var(--fxf)}
@media(max-width:760px){.topbar .x{display:none}.topbar .w{justify-content:center}.topbar .d{margin-left:0}}
.tete{position:relative;z-index:6;background:var(--fond);border-bottom:1px solid var(--ligne)}
.tete .w{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:78px}
.tete.sur-photo{position:absolute;inset:0 0 auto;background:linear-gradient(rgb(var(--voile) / .55),rgb(var(--voile) / 0));border:0;color:#fff}
.marque{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0}
.marque .nm{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.38rem;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mono{width:44px;height:44px;flex:none;display:grid;place-items:center;background:var(--accent);color:var(--surA);border-radius:var(--rb)}
.mono .ic{width:24px;height:24px}
.marque img{height:48px;width:auto;max-width:210px;object-fit:contain}
.clair .tete:not(.sur-photo) .marque img{mix-blend-mode:multiply}
.sur-photo .marque img,.sombre .marque img{background:#fff;padding:6px 10px;border-radius:10px;height:54px}
.nav{display:flex;align-items:center;gap:28px;font-weight:var(--fxf);font-size:.98rem;flex:none}
.nav .l{text-decoration:none;padding:8px 0}.nav .l:hover{text-decoration:underline}
.nav .btn{min-height:46px;padding:0 18px;font-size:.95rem}
.nav .court{display:none}
@media(max-width:900px){.nav .l{display:none}.nav .btn .long{display:none}.nav .btn .court{display:inline}.marque .nm{font-size:1.2rem}.mono{width:38px;height:38px}}
@media(max-width:520px){.marque .nm{white-space:normal;font-size:1.06rem;line-height:1.08;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.tete .w{min-height:68px}.nav .btn{padding:0 14px}}
/* haut de page */
.h{position:relative}
.h-txt{display:grid;gap:clamp(18px,2.4vw,26px);align-content:center;container-type:inline-size}
.h-photo,.h-centre{isolation:isolate;color:#fff;display:grid;align-items:center}
.h-photo>.ph,.h-centre>.ph{position:absolute;inset:0;z-index:-2;border-radius:0}
.h-photo::before,.h-centre::before{content:"";position:absolute;inset:0;z-index:-1}
.sur-photo .t{text-shadow:0 2px 30px rgb(var(--voile) / .35)}
.h-photo{min-height:clamp(560px,84vh,800px)}
.h-photo::before{background:linear-gradient(90deg,rgb(var(--voile) / .93) 0%,rgb(var(--voile) / .8) 38%,rgb(var(--voile) / .3) 72%,rgb(var(--voile) / .12) 100%)}
.h-photo .w{padding-block:clamp(72px,10vw,132px)}
.h-photo .h-txt{max-width:640px;--hmax:5.3rem}
@media(max-width:860px){.h-photo{min-height:auto}.h-photo::before{background:linear-gradient(180deg,rgb(var(--voile) / .6) 0%,rgb(var(--voile) / .88) 100%)}}
.h-centre{min-height:clamp(620px,94vh,900px);text-align:center}
.h-centre::before{background:linear-gradient(180deg,rgb(var(--voile) / .62) 0%,rgb(var(--voile) / .42) 45%,rgb(var(--voile) / .74) 100%)}
.h-centre .h-txt{justify-items:center;padding-block:clamp(130px,15vw,180px) clamp(72px,9vw,112px);--hmax:7rem}
.h-centre .actions,.h-centre .confiance{justify-content:center}
.h-sur{font-size:.92rem;letter-spacing:.2em;text-transform:uppercase;font-weight:var(--fxf)}
@media(max-width:860px){.h-centre{min-height:clamp(560px,88vh,760px)}}
.h-split .w{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(32px,5vw,84px);align-items:center;padding-block:clamp(36px,6vw,88px) clamp(56px,7vw,104px)}
.h-split .h-txt{--hmax:4.7rem}
.h-split .h-phrase{color:var(--doux)}
.h-vis{position:relative;isolation:isolate}
.h-vis .ph{aspect-ratio:4/5}
.h-note{position:absolute;left:clamp(-28px,-2vw,-12px);bottom:clamp(20px,3vw,36px);z-index:2;background:var(--carte);color:var(--encre);border-radius:var(--r);box-shadow:var(--ombre);padding:14px 18px;display:grid;gap:4px;font-size:.92rem;line-height:1.3;max-width:240px}
.h-note b{font-size:1.5rem;font-family:var(--ft);font-weight:var(--tp)}
@media(max-width:860px){.h-split .w{grid-template-columns:1fr}.h-vis .ph{aspect-ratio:4/3}.h-note{left:12px;bottom:12px}}
.h-bande .w{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);padding-block:clamp(12px,2vw,24px) clamp(40px,5vw,64px)}
.h-bloc{background:var(--champ);color:var(--surC);padding:clamp(32px,5vw,72px);display:grid;gap:22px;align-content:center;--hmax:5.4rem}
.h-bloc .h-phrase{color:var(--champDoux)}
.h-bande .ph{border-radius:0;min-height:100%}
@media(max-width:860px){.h-bande .w{grid-template-columns:1fr}.h-bande .ph{aspect-ratio:4/3;order:-1}}
.h-nu{background:var(--champ);color:var(--surC);overflow:hidden}
.h-nu .w{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:clamp(32px,5vw,72px);align-items:center;padding-block:clamp(64px,9vw,128px)}
.h-nu .h-txt{--hmax:5.3rem}
.h-nu .h-phrase{color:var(--champDoux)}
.tuiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tuiles li{background:color-mix(in srgb,currentColor 7%,transparent);border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:var(--r);padding:clamp(18px,2vw,24px);display:grid;gap:14px;align-content:start;font-weight:var(--fxf);line-height:1.3}
.tuiles .ic{width:30px;height:30px;color:var(--vif)}
@media(max-width:860px){.h-nu .w{grid-template-columns:1fr}}
/* sections */
.sec{padding-block:clamp(64px,8.5vw,120px)}
.sec-s{background:var(--surface)}
.tete-sec{display:grid;gap:14px;margin-bottom:clamp(30px,4vw,56px);max-width:62ch}
.centre .tete-sec{margin-inline:auto;text-align:center;justify-items:center}
.tete-sec p{color:var(--doux);font-size:1.08rem}
.ic-b{width:54px;height:54px;flex:none;display:grid;place-items:center;background:var(--accent);color:var(--surA);border-radius:var(--rb)}
.ic-b .ic{width:26px;height:26px}
.ic-r{width:54px;height:54px;flex:none;display:grid;place-items:center;background:var(--teinte);color:var(--teinteT);border-radius:var(--rb)}
.ic-r .ic{width:26px;height:26px}
.bande-atouts{position:relative;z-index:3;margin-top:calc(-1 * clamp(44px,6vw,80px))}
.bande-atouts ul{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:var(--carte);color:var(--encre);border-top:4px solid var(--accent);border-radius:var(--r);box-shadow:var(--ombre);overflow:hidden}
.bande-atouts li{display:flex;gap:18px;align-items:flex-start;padding:clamp(22px,2.6vw,32px)}
.bande-atouts li+li{border-left:1px solid var(--ligne)}
.bande-atouts h3{font-size:1.1rem;margin-bottom:4px}
.bande-atouts p{color:var(--doux);font-size:.96rem;line-height:1.5}
@media(max-width:860px){.bande-atouts{margin-top:-28px}.bande-atouts ul{grid-template-columns:1fr}.bande-atouts li+li{border-left:0;border-top:1px solid var(--ligne)}}
.srv{display:grid;gap:clamp(16px,2vw,24px);grid-template-columns:repeat(3,minmax(0,1fr))}
.srv.n2,.srv.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
@media(max-width:980px){.srv{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.srv,.srv.n2,.srv.n4{grid-template-columns:1fr}}
.carte{background:var(--carte);border:1px solid var(--ligne);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column}
.carte>.ph{border-radius:0;aspect-ratio:3/2}
.carte .cc{padding:clamp(20px,2.4vw,28px);display:grid;gap:10px;align-content:start}
.carte>.ph+.cc .ic-b{margin-top:calc(-27px - clamp(20px,2.4vw,28px));margin-bottom:4px;box-shadow:0 0 0 5px var(--carte)}
.carte p{color:var(--doux)}
.menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:clamp(32px,5vw,80px);max-width:1000px;margin-inline:auto}
.menu li{padding:22px 0;border-bottom:1px solid var(--ligne);display:grid;gap:6px}
.menu h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-size:clamp(1.3rem,2vw,1.6rem);line-height:1.15}
.menu p{color:var(--doux)}
@media(max-width:760px){.menu{grid-template-columns:1fr}}
.offres{display:grid;gap:16px;grid-template-columns:repeat(3,minmax(0,1fr))}
.offres.n2,.offres.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.offre{position:relative;isolation:isolate;color:#fff;border-radius:var(--rp);overflow:hidden;min-height:clamp(320px,32vw,440px);display:flex;flex-direction:column;justify-content:flex-end;gap:8px;padding:clamp(20px,2.4vw,28px)}
.offre>.ph{position:absolute;inset:0;z-index:-2;border-radius:0}
.offre::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(var(--voile) / 0) 30%,rgb(var(--voile) / .88) 100%)}
.offre h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-size:clamp(1.35rem,2vw,1.7rem);line-height:1.1}
.offre p{opacity:.92}
@media(max-width:980px){.offres{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.offres,.offres.n2,.offres.n4{grid-template-columns:1fr}}
.alt{display:grid;gap:clamp(40px,6vw,88px)}
.alt article{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:clamp(24px,4vw,64px);align-items:center}
.alt article:nth-child(even) .ph{order:2}
.alt .ph{aspect-ratio:4/3}
.alt .tx{display:grid;gap:14px;justify-items:start}
.alt h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-size:clamp(1.6rem,2.6vw,2.2rem);line-height:1.08}
.alt p{color:var(--doux);font-size:1.08rem;max-width:44ch}
@media(max-width:760px){.alt article{grid-template-columns:1fr}.alt article:nth-child(even) .ph{order:0}}
.alt+.srv{margin-top:clamp(48px,6vw,80px)}
.pourquoi ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:clamp(24px,3vw,44px)}
.pourquoi li{display:grid;gap:12px;align-content:start;background:var(--carte);border:1px solid var(--ligne);border-radius:var(--r);padding:clamp(22px,2.4vw,30px)}
.pourquoi.sur-champ li{background:color-mix(in srgb,currentColor 6%,transparent);border-color:color-mix(in srgb,currentColor 14%,transparent)}
.ap-atouts{display:grid;gap:18px}
.ap-atouts li{display:flex;gap:16px;align-items:flex-start}
.ap-atouts .ic-r{width:46px;height:46px}.ap-atouts .ic-r .ic{width:22px;height:22px}
.ap-atouts h3{font-size:1.08rem;margin-bottom:2px}
.ap-atouts p{color:var(--doux);font-size:.98rem}
.pourquoi p{color:var(--doux)}
.pourquoi.sur-champ p{color:var(--champDoux)}
.pourquoi.sur-champ .ic-r{background:color-mix(in srgb,var(--vif) 16%,transparent);color:var(--vif)}
.ap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(32px,5.5vw,88px);align-items:center}
.ap.sans{grid-template-columns:minmax(0,1fr);max-width:780px}
.ap .ph{aspect-ratio:4/3}
.ap .tx{display:grid;gap:20px;justify-items:start}
.ap .grand{font-size:clamp(1.1rem,1.4vw,1.24rem);line-height:1.65}
.coches{display:grid;gap:10px}
.coches li{display:flex;gap:10px;align-items:flex-start}
.coches .ic{color:var(--accentT);margin-top:3px}
@media(max-width:860px){.ap{grid-template-columns:1fr}}
.et{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,44px);counter-reset:e}
.et li{display:grid;gap:10px;align-content:start;padding-top:24px;border-top:2px solid var(--ligne);position:relative}
.et li::before{counter-increment:e;content:counter(e,decimal-leading-zero);font-family:var(--ft);font-weight:var(--tp);font-variation-settings:var(--tr);font-size:clamp(2.4rem,4vw,3.3rem);line-height:1;color:var(--accentT)}
.et li::after{content:"";position:absolute;top:-2px;left:0;width:56px;height:2px;background:var(--accent)}
.et h3{font-size:1.25rem}
.et p{color:var(--doux)}
@media(max-width:760px){.et{grid-template-columns:1fr}}
.gal{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:clamp(160px,20vw,300px);gap:clamp(8px,1.2vw,14px)}
.gal .ph{grid-column:span 4}
.gal .ph:first-child{grid-column:span 8;grid-row:span 2}
.gal.n2 .ph{grid-column:span 6;grid-row:span 2}
.gal.n5 .ph:nth-child(n+4){grid-column:span 6}
@media(max-width:760px){.gal{grid-template-columns:1fr 1fr;grid-auto-rows:clamp(140px,42vw,240px)}.gal .ph,.gal.n5 .ph:nth-child(n+4){grid-column:span 1;grid-row:span 1}.gal .ph:first-child,.gal.n2 .ph{grid-column:span 2;grid-row:span 1}}
.appel{background:var(--accent);color:var(--surA)}
.appel .w{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:22px 48px;padding-block:clamp(44px,6vw,76px)}
.appel h2.t{max-width:20ch;font-size:clamp(1.7rem,3.2vw,2.7rem)}
.appel .actions{gap:14px 28px}
.appel .gros{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:clamp(1.7rem,3vw,2.5rem);line-height:1;text-decoration:none;display:inline-flex;align-items:center;gap:12px;white-space:nowrap}
.appel .gros .ic{width:28px;height:28px}
.appel .gros:hover{text-decoration:underline;text-decoration-thickness:.05em}
.appel .b1{background:var(--surA);color:var(--accent)}
.faq{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,80px);align-items:start}
.faq details{border-bottom:1px solid var(--ligne)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:22px 0;font-weight:var(--fxf);font-size:1.08rem;line-height:1.4}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"";flex:none;width:14px;height:14px;margin-top:5px;background:linear-gradient(var(--accentT),var(--accentT)) center/100% 2px no-repeat,linear-gradient(var(--accentT),var(--accentT)) center/2px 100% no-repeat;transition:transform .3s cubic-bezier(.2,.7,0,1)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{padding:0 0 22px;color:var(--doux);max-width:62ch}
@media(max-width:860px){.faq{grid-template-columns:1fr}}
.ct{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(32px,5vw,80px);align-items:start}
.ct .tx{display:grid;gap:20px;justify-items:start}
.ct .tx>p{color:var(--doux);max-width:42ch;font-size:1.08rem}
.ct-cartes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.ct-c{background:var(--carte);border:1px solid var(--ligne);border-radius:var(--r);padding:22px;display:grid;gap:8px;align-content:start;min-width:0}
.sec-s .ct-c{border-color:transparent}
.ct-c h3{display:flex;align-items:center;gap:10px;font-size:.98rem}
.ct-c h3 .ic{color:var(--accentT)}
.ct-c a{font-weight:var(--fxf);text-decoration:none;overflow-wrap:anywhere}.ct-c a:hover{text-decoration:underline}
.ct-c p{color:var(--doux)}
.ct-c.large{grid-column:1/-1}
.horaires li{display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px dashed var(--ligne)}
.horaires li:last-child{border-bottom:0}
.horaires span:last-child{text-align:right;color:var(--doux)}
@media(max-width:860px){.ct{grid-template-columns:1fr}}
@media(max-width:560px){.ct-cartes{grid-template-columns:1fr}}
/* pied */
.pied{background:var(--champ);color:var(--surC);padding-block:clamp(48px,6vw,72px) 28px;font-size:.95rem}
.pied .pd{display:grid;grid-template-columns:minmax(0,1.3fr) repeat(2,minmax(0,1fr));gap:28px clamp(24px,4vw,64px)}
.pied .nm{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-stretch:var(--te);font-size:1.5rem;line-height:1.1;display:block;margin-bottom:10px}
.pied p,.pied li{color:var(--champDoux)}
.pied h3{font-size:.95rem;margin-bottom:10px}
.pied a{color:var(--surC);text-decoration:none}.pied a:hover{text-decoration:underline}
.pied .bas{display:flex;flex-wrap:wrap;gap:10px 26px;justify-content:space-between;margin-top:clamp(34px,5vw,56px);padding-top:22px;border-top:1px solid color-mix(in srgb,currentColor 18%,transparent);font-size:.88rem;color:var(--champDoux)}
.pied .bas a{color:var(--champDoux)}
@media(max-width:760px){.pied .pd{grid-template-columns:1fr}}
/* pages intérieures */
.page-h{padding-block:clamp(44px,7vw,104px) clamp(20px,3vw,40px)}
.page-h .w{display:grid;gap:20px;--hmax:4.6rem;container-type:inline-size}
.page-h p{color:var(--doux);font-size:1.12rem;max-width:56ch}
.prose{max-width:72ch;display:grid;gap:14px;color:var(--doux)}
.prose h2{font-weight:var(--fxf);font-size:1.25rem;line-height:1.3;color:var(--encre);margin:20px 0 0}
.prose strong{color:var(--encre)}
.prose a{color:var(--accentT)}
.prose .note{background:var(--surface);border-radius:var(--r);padding:16px 18px}
.srv-pages{display:grid;gap:clamp(28px,4vw,48px)}
.srv-pages article{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:10px clamp(24px,4vw,64px);padding-bottom:clamp(28px,4vw,48px);border-bottom:1px solid var(--ligne)}
.srv-pages h2{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);text-transform:var(--tc);font-variation-settings:var(--tr);font-size:clamp(1.4rem,2.4vw,2rem);line-height:1.1;margin:0}
.srv-pages p{color:var(--doux)}
@media(max-width:760px){.srv-pages article{grid-template-columns:1fr}}
/* aperçu */
.apercu{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;width:min(820px,calc(100% - 20px));background:#101113;color:#fff;border-radius:16px;padding:12px 12px 12px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 16px 44px rgba(0,0,0,.3);font-family:var(--fx);font-size:.9rem;line-height:1.35}
.apercu b{font-weight:700}
.apercu a{flex:none;background:#fff;color:#101113;text-decoration:none;font-weight:700;border-radius:11px;padding:11px 16px}
.apercu .court{display:none}
@media(max-width:600px){.apercu{padding:10px 10px 10px 16px;bottom:10px;border-radius:14px;font-size:.86rem}.apercu .long{display:none}.apercu .court{display:inline}.apercu a{padding:10px 13px}}
.a-apercu .pied{padding-bottom:120px}
/* barre d'action sur téléphone (site en ligne) */
.barre{display:none}
@media(max-width:860px){.barre{position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;gap:8px;padding:10px var(--g) calc(10px + env(safe-area-inset-bottom));background:var(--fond);box-shadow:0 -10px 30px rgba(0,0,0,.12)}.barre .btn{flex:1;min-height:50px;padding:0 12px}.a-barre .pied{padding-bottom:104px}}
/* un seul mouvement, jamais imposé */
@media(prefers-reduced-motion:no-preference){
.h>.ph img{animation:zoom 2.4s cubic-bezier(.16,.8,.2,1) both}
.h .h-txt>*{animation:leve .9s cubic-bezier(.16,.8,.2,1) both}
.h .h-txt>:nth-child(2){animation-delay:.07s}.h .h-txt>:nth-child(3){animation-delay:.14s}.h .h-txt>:nth-child(4){animation-delay:.21s}.h .h-txt>:nth-child(5){animation-delay:.28s}
}
@keyframes zoom{from{transform:scale(1.07)}to{transform:none}}
@keyframes leve{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
` + (SKINS[ctx.da.modele] || function () { return ''; })(ctx);
}
// Ce qui donne son caractère à chaque modèle
const SKINS = {
  atelier: function () { return `
.m-atelier .tete-sec .t::before,.m-atelier .ap .t::before{content:"";display:block;width:56px;height:5px;background:var(--accent);margin-bottom:18px}
.m-atelier .h-photo .h1{text-wrap:balance}
.m-atelier .ap .ph{box-shadow:-16px 16px 0 var(--accent);margin:0 0 16px 16px}
.m-atelier .carte{transition:box-shadow .25s,transform .25s}.m-atelier .carte:hover{box-shadow:var(--ombre);transform:translateY(-3px)}
.m-atelier .appel{background:var(--accent)}
`; },
  garage: function () { return `
.raye{height:12px;background:repeating-linear-gradient(-45deg,var(--accent) 0 16px,var(--fond) 16px 32px)}
.m-garage .tete-sec .t::before{content:"";display:block;width:56px;height:5px;background:var(--accent);margin-bottom:18px}
.m-garage .carte{border:0;border-top:3px solid var(--accent);background:var(--surface)}
.m-garage .pourquoi{background:var(--champ);color:var(--surC)}
.m-garage .ct-c{background:var(--surface);border-color:transparent}
`; },
  comptoir: function () { return `
.m-comptoir .tete-sec::after{content:"";width:44px;height:2px;background:var(--accent);margin-top:4px}
.m-comptoir .carte h3,.m-comptoir .ct-c h3{font-family:var(--ft);font-weight:var(--tp);letter-spacing:var(--ti);font-variation-settings:var(--tr);font-size:1.35rem}
.m-comptoir .carte{border:0;box-shadow:var(--ombre)}
.m-comptoir .appel{background:var(--champ);color:var(--surC)}.m-comptoir .appel .b1{background:var(--vif);color:var(--surV)}
.m-comptoir .h-sur{font-family:var(--ft);font-weight:var(--tp);letter-spacing:.14em}
`; },
  ecrin: function () { return `
.m-ecrin .h-vis .ph{border-radius:999px 999px var(--rp) var(--rp);aspect-ratio:4/5}
.m-ecrin .ap .ph{border-radius:999px 999px var(--rp) var(--rp);aspect-ratio:4/5;max-height:640px}
.m-ecrin .tete-sec .t{font-weight:var(--tp)}
.m-ecrin .menu li{grid-template-columns:auto 1fr;column-gap:18px}
.m-ecrin .menu li::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:12px;grid-row:span 2}
.m-ecrin .carte{border:0;background:var(--surface)}
.m-ecrin .appel{background:var(--champ);color:var(--surC)}.m-ecrin .appel .b1{background:var(--vif);color:var(--surV)}
@media(max-width:860px){.m-ecrin .h-vis .ph{aspect-ratio:1/1}}
`; },
  cabinet: function () { return `
.m-cabinet .h-vis::before{content:"";position:absolute;inset:28px -16px -16px 28px;background:var(--teinte);border-radius:var(--rp);z-index:-1}
.m-cabinet .carte{border-color:var(--ligne);box-shadow:0 1px 2px rgb(16 24 40 / .04)}
.m-cabinet .appel{background:var(--champ);color:var(--surC)}.m-cabinet .appel .b1{background:var(--vif);color:var(--surV)}
`; },
  horizon: function () { return `
.m-horizon .tete-sec .t{text-wrap:balance}
.m-horizon .h-sur{letter-spacing:.32em}
@media(max-width:600px){.h-sur,.m-horizon .h-sur{letter-spacing:.12em;font-size:.82rem}}
.m-horizon .appel{background:var(--champ);color:var(--surC)}.m-horizon .appel .b1{background:var(--vif);color:var(--surV)}
.m-horizon .carte{border:0;background:var(--surface)}
`; },
  verdure: function () { return `
.m-verdure .h-photo{width:calc(100% - 2*clamp(0px,1.4vw,18px));margin-inline:auto;border-radius:0 0 var(--rp) var(--rp);overflow:hidden}
.m-verdure .h-photo::before{background:linear-gradient(90deg,rgb(var(--voile) / .9) 0%,rgb(var(--voile) / .72) 40%,rgb(var(--voile) / .18) 78%,rgb(var(--voile) / 0) 100%)}
.m-verdure .carte{border:0;background:var(--surface)}
.m-verdure .ic-r{border-radius:999px}
.m-verdure .appel{border-radius:var(--rp);width:min(var(--w),100% - 2*var(--g));margin:0 auto clamp(48px,6vw,80px)}
@media(max-width:860px){.m-verdure .h-photo::before{background:linear-gradient(180deg,rgb(var(--voile) / .55) 0%,rgb(var(--voile) / .88) 100%)}}
`; },
  boutique: function () { return `
.m-boutique .carte{border:2px solid var(--encre);box-shadow:6px 6px 0 var(--encre)}
.m-boutique .btn{border-color:var(--encre)}
.m-boutique .sur-champ .btn{border-color:currentColor}
.m-boutique .h-split .ph{box-shadow:14px 14px 0 var(--accent)}
.m-boutique .tete-sec .t{font-size:clamp(var(--h2a),4.4vw,calc(var(--h2b) * 1.12))}
.m-boutique .ct-c{border:2px solid var(--encre)}
`; }
};
function minifier(s) { return s.replace(/\n\s*/g, ''); }
// la première lettre ou le premier chiffre du nom (un nom qui commence par un emoji ne casse rien)
function initiale(nom) { const c = Array.from(String(nom || '')).find(function (x) { return /[\p{L}\p{N}]/u.test(x); }); return c ? c.toUpperCase() : 'N'; }

/* ── images ── */
function img(p, ctx, chargement, tailles) {
  const src = ctx.racineImg + p.fichier;
  let srcset = '';
  if (ctx.optimiseur && !/\.svg$/i.test(p.fichier)) {
    const phys = encodeURIComponent('/' + ctx.racinePhysique + 'img/' + p.fichier);
    srcset = ' srcset="' + LARGEURS_IMAGES.map(function (w) { return '/_vercel/image?url=' + phys + '&amp;w=' + w + '&amp;q=74 ' + w + 'w'; }).join(', ') + '" sizes="' + (tailles || '100vw') + '"';
  }
  // une photo d'illustration ne prétend rien montrer de l'entreprise : texte alternatif vide
  const alt = p.credit ? '' : net(p.alt || '');
  return '<img src="' + esc(src) + '"' + srcset + ' alt="' + esc(alt) + '"' + (p.l && p.h ? ' width="' + p.l + '" height="' + p.h + '"' : '') + ' loading="' + (chargement || 'lazy') + '"' + (chargement === 'eager' ? ' fetchpriority="high"' : '') + ' decoding="async">';
}
function figure(p, ctx, chargement, tailles) { return '<figure class="ph">' + img(p, ctx, chargement, tailles) + '</figure>'; }

// Chaque photo ne sert qu'une fois. Les siennes d'abord (c'est son entreprise), puis celles choisies par Léa pour leur rôle
function repartir(spec) {
  const toutes = (spec.photos || []).filter(function (p) { return p && p.fichier; });
  const siennes = toutes.filter(function (p) { return !p.credit; });
  const illus = toutes.filter(function (p) { return p.credit; });
  const prises = new Set();
  const prendre = function (p) { if (p && !prises.has(p)) { prises.add(p); return p; } return null; };
  const r = { hero: null, services: {}, apropos: null, galerie: [] };
  r.hero = prendre(siennes[0]) || prendre(illus.find(function (p) { return p.role === 'hero'; })) || prendre(illus.find(function (p) { return !p.role; }));
  const cle = require('./images').cleTitre;
  servicesDe(spec).forEach(function (s, k) { const t = cle(s.titre); const p = illus.find(function (x) { return x.role === 'service' && !prises.has(x) && (x.pour_titre ? x.pour_titre === t : x.pour === k); }); if (p) r.services[k] = prendre(p); });
  r.apropos = prendre(siennes[1]) || prendre(illus.find(function (p) { return p.role === 'apropos' && !prises.has(p); })) || prendre(illus.find(function (p) { return !p.role && !prises.has(p); }));
  r.galerie = siennes.filter(function (p) { return !prises.has(p); });
  return r;
}

/* ── les textes du site, quelle que soit la version de la fiche ── */
// les services lisibles (une entrée vide ou sans titre est ignorée), et des horaires toujours en liste
function servicesDe(spec) { return (Array.isArray(spec.services) ? spec.services : []).filter(function (s) { return s && typeof s === 'object' && net(s.titre); }); }
function horairesDe(c) { const h = c && c.horaires; return Array.isArray(h) ? h.filter(function (x) { return typeof x === 'string' && net(x); }) : (typeof h === 'string' && net(h) ? [net(h)] : []); }
function textes(spec, ctx) {
  const v3 = (spec.v || 0) >= 3;
  const metier = net(spec.metier) || net(spec.activite) || '';
  const lieu = spec.commune ? MQ.a(spec.commune) : '';
  const titreMetier = metier ? metier + (lieu ? ' ' + lieu : '') : net(spec.nom);
  return {
    v3: v3, metier: metier,
    h1: ctx.mod.titres === 'nom' ? net(spec.nom) : titreMetier,
    sur: ctx.mod.titres === 'nom' ? titreMetier : null,
    phrase: v3 ? net(spec.accroche) : (net(spec.chapo) || net(spec.accroche)),
    services: net(spec.titre_services && v3 ? spec.titre_services : '') || M.titreServices(ctx.da.modele, spec.secteur || spec.activite),
    appel: net(spec.appel) || null
  };
}

/* ── haut de page ── */
function enTete(spec, ctx, o) {
  o = o || {};
  const nom = net(spec.nom), c = spec.contact || {};
  const marque = ctx.logo
    ? '<img src="' + esc(ctx.racineImg + ctx.logo.fichier) + '" alt="' + esc(nom) + '"' + (ctx.logo.l && ctx.logo.h ? ' width="' + ctx.logo.l + '" height="' + ctx.logo.h + '"' : '') + '>'
    : '<span class="mono" aria-hidden="true">' + T.icone(ctx.iconeMetier) + '</span><span class="nm">' + esc(nom) + '</span>';
  const navPages = ctx.pages.filter(function (x) { return x.nav; });
  const tx = ctx.textes;
  // sur une page intérieure d'un site d'une page (mentions légales), les liens ramènent à l'accueil
  const ancre = function (id) { return (o.chemin ? ctx.lien('') : '') + '#' + id; };
  const nav = navPages.length > 1
    ? navPages.map(function (x) { return '<a class="l" href="' + esc(ctx.lien(x.chemin)) + '"' + (o.chemin === x.chemin ? ' aria-current="page"' : '') + '>' + esc(x.nav) + '</a>'; }).join('')
    : (servicesDe(spec).length ? '<a class="l" href="' + ancre('services') + '">' + esc(tx.services.length <= 18 ? tx.services.replace(/^Nos /, '').replace(/^./, function (x) { return x.toUpperCase(); }) : 'Services') + '</a>' : '') + (net(spec.a_propos) ? '<a class="l" href="' + ancre('apropos') + '">À propos</a>' : '') + '<a class="l" href="' + ancre('contact') + '">Contact</a>';
  const a = actionPrincipale(spec);
  const cta = a ? lienA(a, 'btn b1', T.icone(a.icone) + '<span class="long">' + esc(a.type === 'tel' ? 'Appeler' : a.texte) + '</span><span class="court">' + esc(a.court) + '</span>') : '';
  let haut = '';
  if (ctx.mod.haut && !o.surPhoto) {
    const t = telHref(c.tel), h = resumeHoraires(horairesDe(c));
    const morceaux = [];
    morceaux.push('<span class="x">' + T.icone('pin') + esc(lieuCourt(spec)) + '</span>');
    if (h) morceaux.push('<span class="x">' + T.icone('horloge') + esc(h) + '</span>');
    if (t) morceaux.push('<a class="d" href="' + esc(t) + '">' + T.icone('tel') + esc(MQ.affiche(c.tel)) + '</a>');
    else if (c.email) morceaux.push('<a class="d" href="mailto:' + esc(c.email) + '">' + T.icone('mail') + esc(c.email) + '</a>');
    haut = '<div class="topbar"><div class="w">' + morceaux.join('') + '</div></div>';
  }
  return haut + '<header class="tete' + (o.surPhoto ? ' sur-photo' : '') + '"><div class="w"><a class="marque" href="' + esc(ctx.lien('')) + '" aria-label="' + esc(nom) + ', accueil">' + marque + '</a><nav class="nav" aria-label="Navigation">' + nav + cta + '</nav></div></header>';
}
function hero(spec, ctx) {
  const ty = ctx.type, d = ctx.da.hero, ph = ctx.alloc.hero, tx = ctx.textes;
  const h1 = '<h1 class="t h1" style="--hk:' + (ctx.mod.titres === 'nom' ? kUne(tx.h1, ty) : k2(tx.h1, ty)) + '">' + esc(tx.h1) + '</h1>';
  const sur = tx.sur ? '<p class="h-sur">' + esc(tx.sur) + '</p>' : '';
  const phrase = tx.phrase ? '<p class="h-phrase">' + esc(tx.phrase) + '</p>' : '';
  const corps = (d === 'centre' ? sur + h1 : h1 + (tx.sur ? sur : '')) + phrase + boutons(spec) + confiance(spec);
  if (d === 'photo' && ph) return '<section class="h h-photo sur-photo" aria-label="Présentation">' + figure(ph, ctx, 'eager', '100vw') + '<div class="w"><div class="h-txt">' + corps + '</div></div></section>';
  if (d === 'centre' && ph) return '<section class="h h-centre sur-photo" aria-label="Présentation">' + figure(ph, ctx, 'eager', '100vw') + '<div class="w"><div class="h-txt">' + corps + '</div></div></section>';
  if (d === 'bande' && ph) return '<section class="h h-bande" aria-label="Présentation"><div class="w"><div class="h-bloc sur-champ h-txt">' + h1 + (tx.sur ? sur : '') + phrase + boutons(spec) + '</div>' + figure(ph, ctx, 'eager', '(max-width:860px) 100vw, 50vw') + '</div></section>';
  if (d === 'split' && ph) {
    const g = noteGoogle(spec);
    const note = g ? '<div class="h-note">' + etoiles(g.note) + '<span><b>' + String(g.note).replace('.', ',') + '</b> sur Google</span><span>' + g.avis + ' avis</span></div>' : '';
    return '<section class="h h-split" aria-label="Présentation"><div class="w"><div class="h-txt">' + corps + '</div><div class="h-vis">' + figure(ph, ctx, 'eager', '(max-width:860px) 100vw, 50vw') + note + '</div></div></section>';
  }
  // sans photo : l'aplat de couleur, et ce que fait l'entreprise en tuiles
  const tuiles = servicesDe(spec).slice(0, 4).map(function (s) { return '<li>' + T.icone(iconeDe(s, ctx.iconeMetier)) + '<span>' + esc(net(s.titre)) + '</span></li>'; }).join('');
  return '<section class="h h-nu sur-champ" aria-label="Presentation"><div class="w"><div class="h-txt">' + corps + '</div>' + (tuiles ? '<ul class="tuiles" aria-hidden="true">' + tuiles + '</ul>' : '') + '</div></section>';
}

/* ── sections ── */
function teteSec(titre, sous) { return '<div class="tete-sec"><h2 class="t">' + esc(titre) + '</h2>' + (net(sous) ? '<p>' + esc(net(sous)) + '</p>' : '') + '</div>'; }
function atouts(spec) { return (spec.atouts || []).filter(function (a) { return a && net(a.titre); }).slice(0, 4); }
function sectionBandeAtouts(spec, ctx) {
  const a = atouts(spec).slice(0, 3);
  if (a.length < 3) return '';
  return '<section class="bande-atouts" aria-label="' + esc(ctx.mod.textes.pourquoi) + '"><div class="w"><ul>' + a.map(function (x) { return '<li><span class="ic-b">' + T.icone(iconeDe(x, 'check')) + '</span><div><h3>' + esc(net(x.titre)) + '</h3>' + (net(x.texte) ? '<p>' + esc(net(x.texte)) + '</p>' : '') + '</div></li>'; }).join('') + '</ul></div></section>';
}
function sectionPourquoi(spec, ctx) {
  const a = atouts(spec);
  if (a.length < 2) return '';
  const sombre = ctx.da.modele === 'garage';
  return '<section class="sec pourquoi' + (sombre ? ' sur-champ' : ' sec-s') + '" id="pourquoi"><div class="w">' + teteSec(ctx.mod.textes.pourquoi) + '<ul>' + a.map(function (x) { return '<li><span class="ic-r">' + T.icone(iconeDe(x, 'check')) + '</span><h3>' + esc(net(x.titre)) + '</h3>' + (net(x.texte) ? '<p>' + esc(net(x.texte)) + '</p>' : '') + '</li>'; }).join('') + '</ul></div></section>';
}
function carteService(s, k, ctx, avecPhoto) {
  const p = avecPhoto ? ctx.alloc.services[k] : null;
  const ic = p && !ctx.mod.pastilles ? '' : '<span class="' + (p ? 'ic-b' : 'ic-r') + '">' + T.icone(iconeDe(s, ctx.iconeMetier)) + '</span>';
  return '<article class="carte">' + (p ? figure(p, ctx, 'lazy', '(max-width:620px) 100vw, (max-width:980px) 50vw, 33vw') : '') + '<div class="cc">' + ic + '<h3>' + esc(net(s.titre)) + '</h3>' + (net(s.texte) ? '<p>' + esc(net(s.texte)) + '</p>' : '') + '</div></article>';
}
function sectionServices(spec, ctx) {
  const sv = servicesDe(spec).slice(0, 6);
  if (!sv.length) return '';
  const v = ctx.da.services;
  const nPh = sv.filter(function (s, k) { return ctx.alloc.services[k]; }).length;
  const touteslesPhotos = nPh === sv.length;
  let corps;
  if (v === 'offres' && nPh >= Math.min(3, sv.length) && nPh >= 2) {
    const avec = sv.map(function (s, k) { return { s: s, k: k }; }).filter(function (x) { return ctx.alloc.services[x.k]; });
    const sans = sv.map(function (s, k) { return { s: s, k: k }; }).filter(function (x) { return !ctx.alloc.services[x.k]; });
    corps = '<div class="offres n' + avec.length + '">' + avec.map(function (x) { return '<article class="offre">' + figure(ctx.alloc.services[x.k], ctx, 'lazy', '(max-width:620px) 100vw, 33vw') + '<h3>' + esc(net(x.s.titre)) + '</h3>' + (net(x.s.texte) ? '<p>' + esc(net(x.s.texte)) + '</p>' : '') + '</article>'; }).join('') + '</div>' +
      (sans.length ? '<div class="srv n' + sans.length + '" style="margin-top:16px">' + sans.map(function (x) { return carteService(x.s, x.k, ctx, false); }).join('') + '</div>' : '');
  } else if (v === 'alternance' && nPh >= 2) {
    const avec = sv.map(function (s, k) { return { s: s, k: k }; }).filter(function (x) { return ctx.alloc.services[x.k]; }).slice(0, 3);
    const reste = sv.map(function (s, k) { return { s: s, k: k }; }).filter(function (x) { return avec.indexOf(x) < 0 && !avec.some(function (y) { return y.k === x.k; }); });
    corps = '<div class="alt">' + avec.map(function (x) { return '<article>' + figure(ctx.alloc.services[x.k], ctx, 'lazy', '(max-width:760px) 100vw, 55vw') + '<div class="tx"><span class="ic-r">' + T.icone(iconeDe(x.s, ctx.iconeMetier)) + '</span><h3>' + esc(net(x.s.titre)) + '</h3>' + (net(x.s.texte) ? '<p>' + esc(net(x.s.texte)) + '</p>' : '') + '</div></article>'; }).join('') + '</div>' +
      (reste.length ? '<div class="srv n' + reste.length + '">' + reste.map(function (x) { return carteService(x.s, x.k, ctx, false); }).join('') + '</div>' : '');
  } else if ((v === 'carte' || v === 'prestations') && !touteslesPhotos) {
    corps = '<ul class="menu">' + sv.map(function (s) { return '<li><h3>' + esc(net(s.titre)) + '</h3>' + (net(s.texte) ? '<p>' + esc(net(s.texte)) + '</p>' : '') + '</li>'; }).join('') + '</ul>';
  } else {
    // cartes : avec photos si chaque service a la sienne, sinon des icônes (jamais une grille à moitié illustrée)
    corps = '<div class="srv n' + sv.length + '">' + sv.map(function (s, k) { return carteService(s, k, ctx, touteslesPhotos); }).join('') + '</div>';
  }
  return '<section class="sec" id="services"><div class="w">' + teteSec(ctx.textes.services) + corps + '</div></section>';
}
// les modèles où les raisons de choisir se lisent mieux dans la présentation qu'en section à part
const ATOUTS_DANS_APROPOS = { comptoir: true, ecrin: true, horizon: true, boutique: true };
function atoutsDansApropos(spec, ctx) { return !!net(spec.a_propos) && (ATOUTS_DANS_APROPOS[ctx.da.modele] || atouts(spec).length <= 2) && !(ctx.mod.bandeau && atouts(spec).length >= 3); }
function sectionApropos(spec, ctx, o) {
  o = o || {};
  const t = net(spec.a_propos);
  if (!t) return '';
  const p = ctx.alloc.apropos;
  const g = noteGoogle(spec), c = spec.contact || {};
  let liste;
  if (atoutsDansApropos(spec, ctx) && atouts(spec).length) {
    liste = '<ul class="ap-atouts">' + atouts(spec).map(function (x) { return '<li><span class="ic-r">' + T.icone(iconeDe(x, 'check')) + '</span><div><h3>' + esc(net(x.titre)) + '</h3>' + (net(x.texte) ? '<p>' + esc(net(x.texte)) + '</p>' : '') + '</div></li>'; }).join('') + '</ul>';
  } else {
    const coches = [];
    coches.push(lieuCourt(spec) + (zoneClient(spec) || !spec.commune ? '' : ', en Martinique'));
    if (g) coches.push('Noté ' + String(g.note).replace('.', ',') + ' sur 5 par ' + g.avis + ' clients sur Google');
    if (waHref(c.mobile || c.tel)) coches.push('Joignable par téléphone et sur WhatsApp');
    else if (c.tel) coches.push('Joignable par téléphone au ' + MQ.affiche(c.tel));
    liste = '<ul class="coches">' + coches.map(function (x) { return '<li>' + T.icone('check') + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>';
  }
  const titre = o.titre || ctx.mod.textes.apropos;
  return '<section class="sec' + (ctx.da.modele === 'garage' ? '' : ' sec-s') + '" id="apropos"><div class="w ap' + (p ? '' : ' sans') + '">' + (p ? figure(p, ctx, 'lazy', '(max-width:860px) 100vw, 50vw') : '') + '<div class="tx"><h2 class="t">' + esc(titre) + '</h2><p class="grand">' + esc(t) + '</p>' + liste + boutons(spec, { seule: true }) + '</div></div></section>';
}
function sectionEtapes(spec, ctx) {
  const e = (spec.etapes || []).filter(function (x) { return x && net(x.titre); }).slice(0, 3);
  if (e.length < 3 || ['visite'].indexOf(spec.objectif) >= 0) return '';
  return '<section class="sec" id="etapes"><div class="w">' + teteSec(ctx.mod.textes.etapes) + '<ol class="et">' + e.map(function (x) { return '<li><h3>' + esc(majuscule(net(x.titre).replace(/[.]+$/, ''))) + '</h3>' + (net(x.texte) ? '<p>' + esc(net(x.texte)) + '</p>' : '') + '</li>'; }).join('') + '</ol></div></section>';
}
function sectionGalerie(ctx, photos) {
  const n = photos.length >= 5 ? 5 : photos.length >= 3 ? 3 : photos.length === 2 ? 2 : 0;
  if (!n) return '';
  return '<section class="sec" id="images"><div class="w">' + teteSec(ctx.mod.textes.galerie) + '<div class="gal n' + n + '">' + photos.slice(0, n).map(function (p, k) { return figure(p, ctx, 'lazy', k === 0 ? '(max-width:760px) 100vw, 66vw' : '(max-width:760px) 50vw, 33vw'); }).join('') + '</div></div></section>';
}
function sectionAppel(spec, ctx) {
  const c = spec.contact || {}, o = OBJECTIFS[spec.objectif] || OBJECTIFS.devis;
  const t = telHref(c.tel), w = waHref(c.mobile || c.tel, o.wa);
  if (!t && !w && !c.email) return '';
  const titre = ctx.textes.appel || ({ devis: 'Un projet ? Parlons-en.', appel: 'Besoin d\'aide ? Appelez-nous.', reservation: 'Envie de réserver ?', visite: 'On vous attend', inscription: 'Prêt à vous lancer ?' })[spec.objectif || 'devis'];
  const actions = [];
  if (t) actions.push('<a class="gros" href="' + esc(t) + '">' + T.icone('tel') + esc(MQ.affiche(c.tel)) + '</a>');
  if (w) actions.push(lienA({ href: w, ext: true }, 'btn b1', T.icone('whatsapp') + '<span>' + esc(o.waBouton) + '</span>'));
  else if (!t && c.email) actions.push(lienA({ href: mailHref(c.email, o.sujet + ' : ' + net(spec.nom), o.corps) }, 'btn b1', T.icone('mail') + '<span>' + esc(net(spec.cta) || o.bouton) + '</span>'));
  return '<section class="appel" aria-label="Contact rapide"><div class="w"><h2 class="t">' + esc(titre) + '</h2><div class="actions">' + actions.join('') + '</div></div></section>';
}
function sectionFaq(spec) {
  const f = (spec.faq || []).filter(function (x) { return x && net(x.q) && net(x.r); }).slice(0, 4);
  if (f.length < 2) return '';
  return '<section class="sec" id="faq"><div class="w faq">' + teteSec('Questions fréquentes') + '<div>' + f.map(function (x) { return '<details><summary>' + esc(net(x.q)) + '</summary><p>' + esc(net(x.r)) + '</p></details>'; }).join('') + '</div></div></section>';
}
function listeHoraires(lignes) {
  const g = lireHoraires(lignes);
  if (g) return '<ul class="horaires">' + g.map(function (x) { return '<li><span>' + esc(nomGroupe(x, false)) + '</span><span>' + esc(x.v) + '</span></li>'; }).join('') + '</ul>';
  return '<ul class="horaires">' + (lignes || []).slice(0, 7).map(function (h) { return '<li><span>' + esc(majuscule(net(h))) + '</span></li>'; }).join('') + '</ul>';
}
function sectionContact(spec, ctx, opts) {
  opts = opts || {};
  const c = spec.contact || {}, o = OBJECTIFS[spec.objectif] || OBJECTIFS.devis;
  const t = telHref(c.tel), w = waHref(c.mobile || c.tel, o.wa);
  const cartes = [];
  if (t) cartes.push('<div class="ct-c"><h3>' + T.icone('tel') + 'Téléphone</h3><a href="' + esc(t) + '">' + esc(MQ.affiche(c.tel)) + '</a></div>');
  if (w) cartes.push('<div class="ct-c"><h3>' + T.icone('whatsapp') + 'WhatsApp</h3><a href="' + esc(w) + '" target="_blank" rel="noopener">Nous écrire</a></div>');
  if (c.email) cartes.push('<div class="ct-c' + (cartes.length % 2 ? '' : '') + '"><h3>' + T.icone('mail') + 'Email</h3><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></div>');
  if (c.adresse || spec.commune) cartes.push('<div class="ct-c"><h3>' + T.icone('pin') + 'Adresse</h3><p>' + esc(c.adresse || (spec.commune + ', Martinique')) + '</p>' + (c.maps ? '<a href="' + esc(c.maps) + '" target="_blank" rel="noopener">Itinéraire</a>' : '') + '</div>');
  const z = zoneClient(spec);
  if (z && ['devis', 'appel'].indexOf(spec.objectif || 'devis') >= 0) cartes.push('<div class="ct-c"><h3>' + T.icone('carte') + 'Où nous intervenons</h3><p>' + esc(z) + '</p></div>');
  if (horairesDe(c).length) cartes.push('<div class="ct-c large"><h3>' + T.icone('horloge') + 'Horaires</h3>' + listeHoraires(horairesDe(c)) + '</div>');
  if (cartes.length % 2 === 1 && cartes.length > 1 && !/large/.test(cartes[cartes.length - 1])) cartes[cartes.length - 1] = cartes[cartes.length - 1].replace('class="ct-c"', 'class="ct-c large"');
  const balise = opts.h1 ? 'h1' : 'h2';
  return '<section class="sec sec-s" id="contact"><div class="w ct"><div class="tx"><' + balise + ' class="t">' + esc(ctx.mod.textes.contact) + '</' + balise + '><p>' + esc(o.phrase) + '</p>' + boutons(spec) + '</div><div class="ct-cartes">' + cartes.join('') + '</div></div></section>';
}
function pied(spec, ctx) {
  const nom = net(spec.nom), c = spec.contact || {};
  const legal = ctx.lien('mentions-legales/');
  const h = horairesDe(c).length ? listeHoraires(horairesDe(c)).replace('class="horaires"', 'class="horaires h-pied"') : '';
  const contact = [c.tel ? '<li><a href="' + esc(telHref(c.tel) || '#') + '">' + esc(MQ.affiche(c.tel)) + '</a></li>' : '', c.email ? '<li><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '', c.adresse ? '<li>' + esc(c.adresse) + '</li>' : (spec.commune ? '<li>' + esc(spec.commune) + ', Martinique</li>' : '')].join('');
  return '<footer class="pied"><div class="w"><div class="pd"><div><span class="nm">' + esc(nom) + '</span><p>' + esc([ctx.textes.metier, spec.commune ? MQ.a(spec.commune).replace(/^./, function (x) { return x; }) : null].filter(Boolean).join(' ') + (spec.commune ? ', Martinique' : '')) + '</p></div><div><h3>Contact</h3><ul>' + contact + '</ul></div><div>' + (h ? '<h3>Horaires</h3>' + h.replace(/<li><span>([^<]*)<\/span><span>([^<]*)<\/span><\/li>/g, '<li>$1 : $2</li>') : '') + '</div></div><div class="bas"><span>© ' + ctx.annee + ' ' + esc(nom) + '</span><a href="' + esc(legal) + '">Mentions légales</a><a href="' + esc(NOVALEMO.signature_site.url) + '" target="_blank" rel="noopener">' + esc(NOVALEMO.signature_site.texte) + '</a></div></div></footer>';
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
function page(spec, ctx, contenu, o) {
  o = o || {};
  const p = ctx.palette, ty = ctx.type, nom = net(spec.nom);
  const titre = o.titre || (spec.seo && net(spec.seo.titre)) || (nom + (ctx.textes.metier ? ', ' + ctx.textes.metier : '') + (spec.commune ? ' ' + MQ.a(spec.commune) : ''));
  const desc = o.description || (spec.seo && net(spec.seo.description)) || ctx.textes.phrase || '';
  const a = actionPrincipale(spec);
  const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="' + (parseInt(ctx.mod.forme.rb, 10) >= 100 ? 32 : 12) + '" fill="' + p.accent + '"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="' + p.surAccent + '">' + esc(initiale(nom)) + '</text></svg>');
  const ld = { '@context': 'https://schema.org', '@type': typeSchema(ctx.da.modele, spec), name: nom, description: desc || undefined, telephone: spec.contact && MQ.e164(spec.contact.tel) || undefined, email: spec.contact && spec.contact.email || undefined, areaServed: zoneClient(spec) || 'Martinique', address: { '@type': 'PostalAddress', addressLocality: spec.commune || undefined, addressRegion: 'Martinique', addressCountry: 'MQ', streetAddress: (spec.contact && spec.contact.adresse) || undefined }, url: ctx.url || undefined };
  const illus = ctx.photos.some(function (x) { return x.credit; });
  const veux = ctx.contactNovalemo ? '<a href="mailto:' + esc(ctx.contactNovalemo) + '?subject=' + encodeURIComponent('Je veux ce site : ' + nom) + '&amp;body=' + encodeURIComponent(F.corpsMailto(spec)) + '">Je veux ce site</a>' : '';
  const apercu = ctx.mode === 'apercu' ? '<aside class="apercu" role="note"><span class="long"><b>Aperçu préparé par Novalemo pour ' + esc(nom) + '.</b> ' + (illus ? 'Photos d\'illustration, à remplacer par les vôtres.' : 'Pas encore en ligne officiellement.') + '</span><span class="court"><b>Aperçu Novalemo</b>' + (illus ? ', photos d\'illustration.' : ', pas encore en ligne.') + '</span>' + veux + '</aside>' : '';
  const barre = ctx.mode === 'live' && a ? (function () {
    const c = spec.contact || {}, t = telHref(c.tel);
    const deux = a.type === 'whatsapp' && t ? '<a class="btn b2" href="' + esc(t) + '">' + T.icone('tel') + '<span>Appeler</span></a>' : '';
    return '<nav class="barre" aria-label="Contact rapide">' + lienA(a, 'btn b1', T.icone(a.icone) + '<span>' + esc(a.court) + '</span>') + deux + '</nav>';
  })() : '';
  const prechargees = [T.FICHIERS_POLICES[ty.titre][0].fichier].concat(ty.texte !== ty.titre ? [T.FICHIERS_POLICES[ty.texte][0].fichier] : []);
  const classes = [p.clair ? 'clair' : 'sombre', 'm-' + ctx.da.modele, ctx.mod.boutons === 'caps' ? 'caps' : '', ctx.mod.centre ? 'centre' : '', ctx.mode === 'apercu' ? 'a-apercu' : '', barre ? 'a-barre' : ''].filter(Boolean).join(' ');
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>' + esc(titre) + '</title><meta name="description" content="' + esc(desc.slice(0, 160)) + '">' +
    (ctx.mode === 'apercu' ? '<meta name="robots" content="noindex,nofollow">' : (ctx.url ? '<link rel="canonical" href="' + esc(ctx.url + (o.chemin || '')) + '">' : '')) +
    '<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:title" content="' + esc(titre) + '"><meta property="og:description" content="' + esc(desc.slice(0, 200)) + '">' +
    '<meta name="theme-color" content="' + p.fond + '"><link rel="icon" href="' + favicon + '">' +
    prechargees.map(function (f) { return '<link rel="preload" href="/_f/' + f + '" as="font" type="font/woff2" crossorigin>'; }).join('') +
    '<style>' + ctx.css + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    '</head><body class="' + classes + '"><a class="saut" href="#contenu">Aller au contenu</a>' +
    enTete(spec, ctx, { chemin: o.chemin, surPhoto: o.surPhoto }) +
    '<main id="contenu">' + contenu + '</main>' + pied(spec, ctx) + barre + apercu + '</body></html>';
}

function mentions(spec, ctx) {
  const corps = '<section class="page-h"><div class="w"><h1 class="t h1" style="--hk:' + k2('Mentions légales', ctx.type) + '">Mentions légales</h1></div></section>' +
    '<section class="sec" style="padding-top:0"><div class="w prose">' + J.mentionsHtml(spec, { mode: ctx.mode, identite: ctx.identite, photos: ctx.photos }) + '</div></section>';
  return page(spec, ctx, corps, { titre: 'Mentions légales, ' + net(spec.nom), chemin: 'mentions-legales/' });
}

// les pages d'une formule (le plan du site)
function plan(formule, spec) {
  if (formule === 'vitrine' || formule === 'signature') {
    const p = [{ chemin: '', nav: 'Accueil' }, { chemin: 'services/', nav: 'Services' }, { chemin: 'a-propos/', nav: 'À propos' }, { chemin: 'contact/', nav: 'Contact' }, { chemin: 'mentions-legales/' }];
    // une page par service, chacune à son adresse (deux titres proches ne s'écrasent pas)
    if (formule === 'signature') { const pris = new Set(); servicesDe(spec).forEach(function (s) { let sl = slugifier(net(s.titre)), n = 2; while (pris.has(sl)) sl = slugifier(net(s.titre)) + '-' + (n++); pris.add(sl); p.push({ chemin: 'services/' + sl + '/', service: s }); }); }
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
  const mod = M.MODELES[da.modele];
  const racinePhysique = (mode === 'live' ? 's/' : 'a/') + site.slug + '/';
  const base = mode === 'live' ? '/' : '/' + racinePhysique;
  const pages = plan(formule, spec);
  const ty = T.typo(da.type), pal = T.palette(DN.paletteDe(da), spec.accent);
  const ctx = {
    mode: mode, da: da, mod: mod, palette: pal, type: ty, photos: photos, logo: spec.logo && spec.logo.fichier ? spec.logo : null, pages: pages,
    racinePhysique: racinePhysique, racineImg: base + 'img/', optimiseur: opts.optimiseur !== false,
    lien: function (chemin) { return base + chemin; }, url: mode === 'live' && opts.url ? opts.url.replace(/\/?$/, '/') : null,
    identite: opts.identite || null, contactNovalemo: opts.contactNovalemo || null, annee: new Date().getFullYear(),
    alloc: repartir(spec)
  };
  ctx.textes = textes(spec, ctx);
  ctx.iconeMetier = iconePour([spec.secteur, spec.activite, ctx.textes.metier].filter(Boolean).join(' '), servicesDe(spec)[0] ? iconeDe(servicesDe(spec)[0], 'etoile') : 'etoile');
  ctx.css = minifier(css(ctx));
  const files = [];
  const mettre = function (chemin, html) { files.push({ file: racinePhysique + chemin + 'index.html', data: html }); };
  const avecPhoto = !!ctx.alloc.hero && da.hero !== 'nu';
  const surPhoto = avecPhoto && da.hero === 'centre';
  const debut = hero(spec, ctx) + (da.modele === 'garage' ? '<div class="raye" aria-hidden="true"></div>' : '') + (mod.bandeau ? sectionBandeAtouts(spec, ctx) : '');
  const pourquoi = (mod.bandeau && atouts(spec).length >= 3) || atoutsDansApropos(spec, ctx) ? '' : sectionPourquoi(spec, ctx);
  if (pages.length <= 2) {
    mettre('', page(spec, ctx, debut + sectionServices(spec, ctx) + pourquoi + sectionApropos(spec, ctx) + sectionEtapes(spec, ctx) + sectionGalerie(ctx, ctx.alloc.galerie) + sectionAppel(spec, ctx) + sectionFaq(spec) + sectionContact(spec, ctx), { chemin: '', surPhoto: surPhoto }));
  } else {
    mettre('', page(spec, ctx, debut + sectionServices(spec, ctx) + pourquoi + sectionApropos(spec, ctx) + sectionGalerie(ctx, ctx.alloc.galerie) + sectionAppel(spec, ctx) + sectionContact(spec, ctx), { chemin: '', surPhoto: surPhoto }));
    const avecLiens = formule === 'signature';
    const tete = function (titre, sous) { const x = net(titre); return '<section class="page-h"><div class="w"><h1 class="t h1" style="--hk:' + k2(x, ty) + '">' + esc(x) + '</h1>' + (net(sous) ? '<p>' + esc(net(sous)) + '</p>' : '') + '</div></section>'; };
    const pageDe = function (s) { const x = pages.find(function (y) { return y.service === s; }); return x ? x.chemin : null; };
    const liste = '<section class="sec" style="padding-top:0"><div class="w srv-pages">' + servicesDe(spec).map(function (s) { const t = net(s.titre), ch = avecLiens && pageDe(s); return '<article><h2>' + (ch ? '<a href="' + esc(ctx.lien(ch)) + '">' + esc(t) + '</a>' : esc(t)) + '</h2><p>' + esc(net(s.detail || s.texte)) + '</p></article>'; }).join('') + '</div></section>';
    mettre('services/', page(spec, ctx, tete(ctx.textes.services, ctx.textes.phrase) + liste + sectionEtapes(spec, ctx) + sectionFaq(spec) + sectionAppel(spec, ctx), { chemin: 'services/', titre: ctx.textes.services + ', ' + net(spec.nom) }));
    mettre('a-propos/', page(spec, ctx, tete(mod.textes.apropos, lieuCourt(spec)) + sectionApropos(Object.assign({}, spec, { a_propos: spec.a_propos || ctx.textes.phrase }), ctx, { titre: net(spec.nom) }) + sectionPourquoi(spec, ctx) + sectionGalerie(ctx, ctx.alloc.galerie) + sectionAppel(spec, ctx), { chemin: 'a-propos/', titre: 'À propos, ' + net(spec.nom) }));
    mettre('contact/', page(spec, ctx, sectionContact(spec, ctx, { h1: true }) + sectionFaq(spec), { chemin: 'contact/', titre: 'Contact, ' + net(spec.nom) }));
    pages.filter(function (x) { return x.service; }).forEach(function (x) {
      const s = x.service, t = net(s.titre) + (spec.commune ? ' ' + MQ.a(spec.commune) : '');
      mettre(x.chemin, page(spec, ctx, tete(t, s.texte) + '<section class="sec" style="padding-top:0"><div class="w prose"><p style="font-size:1.15rem;color:var(--encre)">' + esc(net(s.detail || s.texte)) + '</p></div></section>' + sectionEtapes(spec, ctx) + sectionFaq(spec) + sectionAppel(spec, ctx) + sectionContact(spec, ctx),
        { chemin: x.chemin, titre: t + ', ' + net(spec.nom), description: net(s.texte) }));
    });
  }
  mettre('mentions-legales/', mentions(spec, ctx));
  if (mode === 'live') {
    const hote = ctx.url || '';
    files.push({ file: racinePhysique + 'robots.txt', data: 'User-agent: *\nAllow: /\n' + (hote ? 'Sitemap: ' + hote + 'sitemap.xml\n' : '') });
    if (hote) files.push({ file: racinePhysique + 'sitemap.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(function (x) { return '<url><loc>' + esc(hote + x.chemin) + '</loc></url>'; }).join('') + '</urlset>\n' });
  }
  return { files: files, pages: pages.map(function (x) { return x.chemin; }), compo: da.modele + '/' + da.hero, da: da, palette: pal };
}

module.exports = { rendre, slugifier, actionPrincipale, OBJECTIFS, HEBERGEUR, LARGEURS_IMAGES, esc, net, lireHoraires, resumeHoraires, repartir, iconePour, textes };
