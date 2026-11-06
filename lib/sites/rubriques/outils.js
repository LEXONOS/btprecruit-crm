// Les outils communs des rubriques : texte sûr, liens d'action (WhatsApp, appel, email), horaires, note Google,
// icônes du métier, images, mesures des grands titres, et les petites marques du mouvement (apparitions, mots).
// Chaque rubrique (lib/sites/rubriques/*.js) les reçoit par ctx.h : elle n'invente jamais un fait, elle met en scène
// ceux de la fiche.
'use strict';
const T = require('../theme');
const F = require('../fiche');
const MQ = require('../../martinique');

/* ── texte ── */
const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
// les anciennes fiches marquaient un mot **ainsi** : on retire les marques
// (les espaces insécables, « 18 h », « Le Lamentin », restent insécables : seules les espaces ordinaires sont resserrées)
function net(s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/[ \t\r\n\f\v\u2028\u2029]+/g, ' ').replace(/^[\s\u00a0\u202f]+|[\s\u00a0\u202f]+$/g, ''); }
function slugifier(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'page'; }
function majuscule(s) { s = net(s); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function initiale(nom) { const c = Array.from(String(nom || '')).find(function (x) { return /[\p{L}\p{N}]/u.test(x); }); return c ? c.toUpperCase() : 'N'; }

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
function objectif(spec) { return OBJECTIFS[spec && spec.objectif] || OBJECTIFS.devis; }
// L'action principale du site : WhatsApp dès qu'on a un portable, sinon l'appel, sinon l'email préparé
function actionPrincipale(spec) {
  const c = spec.contact || {}, o = objectif(spec);
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
  if (a && a.type === 'whatsapp' && telHref(c.tel)) return { type: 'tel', href: telHref(c.tel), texte: MQ.affiche(c.tel), court: 'Appeler', icone: 'tel' };
  if (a && a.type === 'tel' && c.email) return { type: 'mail', href: 'mailto:' + c.email, texte: 'Écrire un email', court: 'Email', icone: 'mail' };
  return null;
}
function lienA(a, cls, contenu, label) { return '<a class="' + cls + '" href="' + esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' + contenu + '</a>'; }
// le contenu d'un bouton : son icône, son texte, et la flèche que montrent certains styles de bouton au survol
function contenuBouton(icone, texte) { return T.icone(icone) + '<span class="bt">' + esc(texte) + '</span><span class="bf" aria-hidden="true">' + T.icone('fleche') + '</span>'; }
// o = { seule, classe (en plus de « actions »), court (textes courts), aimant }
function boutons(spec, o) {
  o = o || {};
  const a = actionPrincipale(spec);
  if (!a) return '';
  const s = o.seule ? null : actionSeconde(spec, a);
  const aim = o.aimant === false ? '' : ' data-aimant';
  const b1 = '<a class="btn b1" href="' + esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + aim + '>' + contenuBouton(a.icone, o.court ? a.court : a.texte) + '</a>';
  const b2 = s ? '<a class="btn b2" href="' + esc(s.href) + '">' + contenuBouton(s.icone, o.court ? s.court : s.texte) + '</a>' : '';
  return '<div class="actions' + (o.classe ? ' ' + o.classe : '') + '">' + b1 + b2 + '</div>';
}

/* ── horaires : « lundi: 07:30 – 17:00 » (Google) devient « Lun – ven : 7 h 30 – 17 h » ── */
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
function heure(h, m) { return Number(h) + ' h' + (m && m !== '00' ? ' ' + m : ''); }
// les plages lues : [{ j: 0..6, plages: [[minutes début, minutes fin]], v: texte }]
function lireJours(lignes) {
  if (!Array.isArray(lignes) || !lignes.length) return null;
  const jours = [];
  for (const brut of lignes) {
    const x = net(brut).replace(/[  ]/g, ' ');
    const m = x.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*:\s*(.+)$/i);
    if (!m) return null;
    const v = m[2];
    let val; const plages = [];
    if (/ferm/i.test(v)) val = 'Fermé';
    else if (/24\s?h|24\/24/i.test(v)) { val = '24 h sur 24'; plages.push([0, 1440]); }
    else {
      const txt = [];
      v.replace(/(\d{1,2})\s?[:h]\s?(\d{2})?\s*[–—-]\s*(\d{1,2})\s?[:h]\s?(\d{2})?/g, function (z, a, b, c, d) { txt.push(heure(a, b) + ' – ' + heure(c, d)); plages.push([Number(a) * 60 + Number(b || 0), Number(c) * 60 + Number(d || 0)]); return z; });
      if (!txt.length) return null;
      val = txt.join(', ');
    }
    jours.push({ j: JOURS.indexOf(m[1].toLowerCase()), v: val, plages: plages });
  }
  jours.sort(function (a, b) { return a.j - b.j; });
  return jours;
}
function lireHoraires(lignes) {
  const jours = lireJours(lignes);
  if (!jours) return null;
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
function horairesDe(c) { const h = c && c.horaires; return Array.isArray(h) ? h.filter(function (x) { return typeof x === 'string' && net(x); }) : (typeof h === 'string' && net(h) ? [net(h)] : []); }
function listeHoraires(lignes, cls) {
  const g = lireHoraires(lignes);
  if (g) return '<ul class="horaires' + (cls ? ' ' + cls : '') + '">' + g.map(function (x) { return '<li><span>' + esc(nomGroupe(x, false)) + '</span><span>' + esc(x.v) + '</span></li>'; }).join('') + '</ul>';
  return '<ul class="horaires' + (cls ? ' ' + cls : '') + '">' + (lignes || []).slice(0, 7).map(function (h) { return '<li><span>' + esc(majuscule(net(h))) + '</span></li>'; }).join('') + '</ul>';
}
// les plages de la semaine pour le calcul « ouvert maintenant » fait dans le navigateur (heure de la Martinique)
function horairesMachine(lignes) { const j = lireJours(lignes); return j ? JSON.stringify(j.map(function (x) { return [x.j, x.plages]; })) : null; }

/* ── ce que l'on sait de sûr : la note Google, le lieu, WhatsApp, le samedi ── */
function etoiles(note) {
  const n = Math.max(0, Math.min(5, Number(note) || 0));
  const rang = function (cls) { let x = ''; for (let k = 0; k < 5; k++) x += T.icone('etoile'); return '<span class="' + cls + '">' + x + '</span>'; };
  return '<span class="etoiles" aria-hidden="true" style="--n:' + Math.round(n / 5 * 100) + '%">' + rang('vd') + rang('pl') + '</span>';
}
function noteGoogle(spec) { const g = spec.google; return g && Number(g.note) >= 4 && Number(g.avis) >= 5 ? g : null; }
function noteTexte(g) { return String(g.note).replace('.', ','); }
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
  if (g) out.push('<li>' + etoiles(g.note) + '<span><b>' + noteTexte(g) + '</b> sur Google · ' + g.avis + ' avis</span></li>');
  if (['visite', 'reservation'].indexOf(spec.objectif) >= 0 && spec.commune) out.push('<li>' + T.icone('pin') + '<span>' + esc(spec.commune) + ', Martinique</span></li>');
  else out.push('<li>' + T.icone('pin') + '<span>' + esc(lieuCourt(spec)) + '</span></li>');
  const c = spec.contact || {};
  if (ouvertLeSamedi(horairesDe(c))) out.push('<li>' + T.icone('horloge') + '<span>Ouvert le samedi</span></li>');
  else if (waHref(c.mobile || c.tel)) out.push('<li>' + T.icone('whatsapp') + '<span>Joignable sur WhatsApp</span></li>');
  return '<ul class="confiance' + (opts.classe ? ' ' + opts.classe : '') + '">' + out.slice(0, opts.max || 3).join('') + '</ul>';
}
// les faits courts et sûrs, pour une bande de confiance : [{ icone, grand, petit }] (jamais un chiffre inventé)
function faitsSurs(spec) {
  const out = [], c = spec.contact || {};
  const g = noteGoogle(spec);
  if (g) out.push({ icone: 'etoile', grand: noteTexte(g) + '/5', petit: g.avis + ' avis Google', nombre: Number(g.note), decimales: 1 });
  if (g) out.push({ icone: 'sourire', grand: String(g.avis), petit: 'clients ont laissé un avis', nombre: Number(g.avis), decimales: 0 });
  const h = horairesDe(c);
  const groupes = lireHoraires(h);
  if (groupes && groupes.some(function (x) { return x.v === '24 h sur 24'; })) out.push({ icone: 'horloge', grand: '24 h/24', petit: 'selon les horaires affichés' });
  else if (groupes && groupes.length === 1 && groupes[0].debut === 0 && groupes[0].fin === 6 && groupes[0].v !== 'Fermé') out.push({ icone: 'calendrier', grand: '7 j/7', petit: 'ouvert tous les jours' });
  else if (ouvertLeSamedi(h)) out.push({ icone: 'calendrier', grand: 'Samedi', petit: 'ouvert aussi le samedi' });
  if (waHref(c.mobile || c.tel)) out.push({ icone: 'whatsapp', grand: 'WhatsApp', petit: 'joignable sur WhatsApp' });
  else if (c.tel) out.push({ icone: 'tel', grand: MQ.affiche(c.tel), petit: 'un numéro, une personne' });
  out.push({ icone: 'pin', grand: spec.commune || 'Martinique', petit: zoneClient(spec) ? 'et ' + zoneClient(spec).replace(/^./, function (x) { return x.toLowerCase(); }) : 'en Martinique' });
  const n = servicesDe(spec).length;
  if (n >= 3) out.push({ icone: 'check', grand: String(n), petit: 'services pour vous', nombre: n, decimales: 0 });
  return out;
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
// sur trois lignes au plus (titres géants en colonne étroite)
function k3(texte, ty) {
  const m = net(texte).split(' ').filter(Boolean);
  if (m.length < 3) return k2(texte, ty);
  let best = Infinity;
  for (let a = 1; a < m.length - 1; a++) for (let b = a + 1; b < m.length; b++) best = Math.min(best, Math.max(m.slice(0, a).join(' ').length, m.slice(a, b).join(' ').length, m.slice(b).join(' ').length));
  return (Math.max(best + 1.5, motMax(texte) + 1) * ty.chasse * 1.06).toFixed(2);
}

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

/* ── images ── */
// les largeurs servies par l'optimiseur d'images de Vercel : une seule liste, partagée avec vercel.json (publication.js),
// car une largeur demandée qui n'y figure pas renvoie une erreur et l'image ne s'affiche pas
const LARGEURS_IMAGES = [480, 960, 1600, 2200];
function img(p, ctx, chargement, tailles, extra) {
  const src = ctx.racineImg + p.fichier;
  let srcset = '';
  if (ctx.optimiseur && !/\.svg$/i.test(p.fichier)) {
    const phys = encodeURIComponent('/' + ctx.racinePhysique + 'img/' + p.fichier);
    srcset = ' srcset="' + LARGEURS_IMAGES.map(function (w) { return '/_vercel/image?url=' + phys + '&amp;w=' + w + '&amp;q=74 ' + w + 'w'; }).join(', ') + '" sizes="' + (tailles || '100vw') + '"';
  }
  // une photo d'illustration : ce qu'on y voit, dit simplement par Léa (jamais une prétention sur l'entreprise)
  const alt = net(p.alt || '');
  return '<img src="' + esc(src) + '"' + srcset + ' alt="' + esc(alt) + '"' + (p.l && p.h ? ' width="' + p.l + '" height="' + p.h + '"' : '') + ' loading="' + (chargement || 'lazy') + '"' + (chargement === 'eager' ? ' fetchpriority="high"' : '') + ' decoding="async"' + (extra || '') + '>';
}
// o = { classe, attrs (sur la figure), imgAttrs }
function figure(p, ctx, chargement, tailles, o) { o = o || {}; return '<figure class="ph' + (o.classe ? ' ' + o.classe : '') + '"' + (o.attrs || '') + '>' + img(p, ctx, chargement, tailles, o.imgAttrs) + '</figure>'; }

/* ── les textes du site, quelle que soit la version de la fiche ── */
// les services lisibles (une entrée vide ou sans titre est ignorée), et des horaires toujours en liste
function servicesDe(spec) { return (Array.isArray(spec.services) ? spec.services : []).filter(function (s) { return s && typeof s === 'object' && net(s.titre); }); }
function atouts(spec) { return (spec.atouts || []).filter(function (a) { return a && net(a.titre); }).slice(0, 4); }
function etapes(spec) { return (spec.etapes || []).filter(function (x) { return x && net(x.titre); }).slice(0, 4); }
// Une FAQ répond : « Appelez-nous pour en parler » n'est pas une réponse. Les phrases qui renvoient seulement vers le
// téléphone ou WhatsApp sont retirées de la réponse ; une question à qui il ne reste rien de concret est retirée.
const RENVOI = /\b(appelez|contactez|écrivez|ecrivez|dites|demandez|envoyez|joignez)[- ]?(-)?(nous|moi)\b|\bnous vous le dirons\b|\bon vous le dira\b|\bon en parle\b|\bpour en discuter\b|\bselon votre demande\b|\bsur demande\b/i;
function reponseUtile(r) {
  const phrases = net(r).split(/(?<=[.!?])\s+/).filter(Boolean);
  const gardees = phrases.filter(function (p) { return !RENVOI.test(p); });
  const t = gardees.join(' ').trim();
  return t.replace(/[\s,;:]+$/, '').length >= 18 ? t : '';
}
function faqDe(spec) {
  return (spec.faq || []).filter(function (x) { return x && net(x.q) && net(x.r); }).map(function (x) { const r = reponseUtile(x.r); return r ? Object.assign({}, x, { r: r }) : null; }).filter(Boolean).slice(0, 6);
}

/* ── le mouvement : apparitions au défilement, mots qui montent ── */
// rv('monte', 2) → ' data-r="monte" style="--i:2"' ; les apparitions ne jouent que si le script est là (classe js)
function rv(type, i, style) { return ' data-r="' + (type || 'monte') + '"' + ((i || style) ? ' style="' + (i ? '--i:' + i + ';' : '') + (style || '') + '"' : ''); }
// un titre dont les mots montent un à un (le parent porte data-r="mots")
function mots(texte, debut) {
  return net(texte).split(' ').filter(Boolean).map(function (m, k) { return '<span class="m"><span style="--i:' + ((debut || 0) + k) + '">' + esc(m) + '</span></span>'; }).join(' ');
}
// la tête d'une section : son titre et sa phrase, qui apparaissent
function teteSec(titre, sous, o) {
  o = o || {};
  return '<div class="tete-sec' + (o.classe ? ' ' + o.classe : '') + '"' + rv('monte') + '>' + (o.sur ? '<p class="sur-t">' + esc(o.sur) + '</p>' : '') + '<h2 class="t">' + esc(titre) + '</h2>' + (net(sous) ? '<p>' + esc(net(sous)) + '</p>' : '') + '</div>';
}
// les classes d'un bloc posé par l'assembleur : la rubrique, sa surface (fond, surface, champ, accent, photo)
function classes(id, bloc, extra) { return 'r r-' + id.replace(/\./g, '-') + ' s-' + ((bloc && bloc.surface) || 'fond') + (extra ? ' ' + extra : ''); }
// le fond travaillé choisi pour ce bloc (grain, maille, grille...) : un calque sous le contenu
function fond(bloc) { return bloc && bloc.fond ? '<div class="fond f-' + bloc.fond + '" aria-hidden="true"></div>' : ''; }

module.exports = {
  esc, net, slugifier, majuscule, initiale,
  telHref, waHref, mailHref, OBJECTIFS, objectif, actionPrincipale, actionSeconde, lienA, contenuBouton, boutons,
  JOURS, lireJours, lireHoraires, nomGroupe, resumeHoraires, ouvertLeSamedi, horairesDe, listeHoraires, horairesMachine,
  etoiles, noteGoogle, noteTexte, zoneClient, lieuCourt, confiance, faitsSurs,
  deuxLignes, motMax, k2, kUne, k3,
  ICONES_MOTS, iconePour, iconeDe, icone: T.icone,
  LARGEURS_IMAGES, img, figure,
  servicesDe, atouts, etapes, faqDe,
  rv, mots, teteSec, classes, fond
};
