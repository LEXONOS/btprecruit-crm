// La boîte à outils des sections « nouvelle génération » (fichiers x-*.js) : celles dont sont faits les 40 templates
// (lib/sites/templates). Chaque section ne met en scène que les faits de la fiche ; la forme (lettres, angles, rythme,
// mouvement) vient du style du template, posé sur la page (classe k-<style>) par des variables :
//   --x-r (rayon des photos), --x-rc (des cartes), --x-sec (respiration des sections), --x-h2 (taille des titres),
//   --x-trait (filets), --x-ombre (ombre des cartes)
// Fond clair toujours : aucune section n'est noire (règle de Louis, nov. 2026) ; la photo voilée reste une photo.
'use strict';
const MQ = require('../../martinique');

const net = function (s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/[ \t\r\n\f\v]+/g, ' ').trim(); };
const num = function (k) { return (k + 1 < 10 ? '0' : '') + (k + 1); };

// le grand titre : le métier et la commune (ou le nom), taillé pour sa colonne, les mots qui montent
function h1(ctx, o) {
  o = o || {};
  const h = ctx.h, tx = ctx.textes, ty = ctx.type;
  // un vrai titre : il porte le premier écran, en grand ; le métier et la commune (ce que cherche Google) restent dans le
  // h1, en sur-titre, jamais en lettres géantes
  if (tx.titre) {
    const kt = o.une ? h.kUne(tx.titre, ty) : h.k2(tx.titre, ty);
    return '<h1 class="t h1 x-h1d' + (o.cls ? ' ' + o.cls : '') + '" style="--hk:' + kt + '" data-r="mots"><span class="x-sur x-h1s">' + h.esc(tx.lieuMetier) + '</span><span class="x-h1t">' + h.mots(tx.titre) + '</span></h1>';
  }
  const k = o.une ? h.kUne(tx.h1, ty) : (ctx.mod.titres === 'nom' ? h.kUne(tx.h1, ty) : h.k2(tx.h1, ty));
  return '<h1 class="t h1' + (o.cls ? ' ' + o.cls : '') + '" style="--hk:' + k + '" data-r="mots">' + h.mots(tx.h1) + '</h1>';
}
// le petit sur-titre, au-dessus d'un titre
function sur(ctx, texte, i, cls) { return net(texte) ? '<p class="x-sur' + (cls ? ' ' + cls : '') + '"' + ctx.h.rv('monte', i || 0) + '>' + ctx.h.esc(net(texte)) + '</p>' : ''; }
// la tête d'une section : sur-titre, titre, phrase
function tete(ctx, o) {
  const h = ctx.h;
  return '<div class="x-tete' + (o.cls ? ' ' + o.cls : '') + '">' + sur(ctx, o.sur, 0) + '<h2 class="t x-h2"' + h.rv('monte', 1) + '>' + h.esc(net(o.titre)) + '</h2>' + (net(o.phrase) ? '<p class="x-phrase"' + h.rv('monte', 2) + '>' + h.esc(net(o.phrase)) + '</p>' : '') + '</div>';
}
// les sur-titres des sections : le nom de la rubrique, ou son numéro (selon le style du template)
function surDe(ctx, rub, defaut) { const n = ctx.compo && ctx.compo.numeros && ctx.compo.numeros[rub]; return n ? n + ' — ' + defaut : defaut; }

// une photo, avec son apparition (rideau, store, iris, recul, zoom...)
function photo(ctx, p, o) {
  o = o || {};
  if (!p) return '';
  return ctx.h.figure(p, o.eager ? 'eager' : 'lazy', o.tailles || '(max-width:860px) 100vw, 50vw', { classe: o.cls || '', attrs: o.r === false ? '' : ctx.h.rv(o.r || 'rideau', o.i || 0) + (o.px ? ' data-px="' + o.px + '"' : '') });
}

// les services, chacun avec sa photo s'il en a une (jamais celle d'un autre service)
function services(spec, ctx) {
  const h = ctx.h;
  return h.servicesDe(spec).slice(0, 6).map(function (s, k) { return { titre: net(s.titre), texte: net(s.texte), detail: net(s.detail), icone: h.iconeDe(s, 'etoile'), photo: ctx.alloc.services[k] || null, k: k }; });
}
function servicesAvecPhotos(spec, ctx) { const s = services(spec, ctx); return s.length && s.every(function (x) { return x.photo; }) ? s : null; }

// le lien d'un service : seulement s'il porte le service (WhatsApp avec le service déjà écrit) ; le même « Appeler » répété
// sous chaque service n'apprend rien au visiteur (le bouton du haut et le contact suffisent)
function lienService(spec, ctx, s) {
  const h = ctx.h, c = spec.contact || {}, o = h.objectif(spec);
  const wa = h.waHref(c.mobile || c.tel, o.wa + s.titre);
  return wa ? { href: wa, ext: true, texte: 'Demander' } : null;
}

// les moyens de joindre l'entreprise, seulement ceux de la fiche
function moyens(spec, ctx) {
  const h = ctx.h, c = spec.contact || {}, o = h.objectif(spec), out = [];
  const wa = h.waHref(c.mobile || c.tel, o.wa);
  if (wa) out.push({ cle: 'wa', icone: 'whatsapp', etiquette: 'WhatsApp', valeur: 'Écrire un message', href: wa, ext: true });
  const num0 = c.tel || c.mobile, t = num0 ? h.telHref(num0) : null;
  if (t) out.push({ cle: 'tel', icone: 'tel', etiquette: 'Téléphone', valeur: MQ.affiche(num0), href: t });
  if (c.email) out.push({ cle: 'mail', icone: 'mail', etiquette: 'Email', valeur: c.email, href: h.mailHref(c.email, o.sujet + ' : ' + net(spec.nom), o.corps) });
  const ad = net(c.adresse) || (spec.commune ? spec.commune + ', Martinique' : '');
  if (ad) out.push({ cle: 'adresse', icone: 'pin', etiquette: ['visite', 'reservation'].indexOf(spec.objectif) >= 0 ? 'Nous trouver' : 'Adresse', valeur: ad.replace(/,?\s*Martinique$/i, ''), href: c.maps || null, ext: true });
  return out;
}
function ligneMoyen(ctx, x, cls, i) {
  const h = ctx.h;
  const corps = '<span class="' + cls + '-i">' + h.icone(x.icone) + '</span><span class="' + cls + '-t"><small>' + h.esc(x.etiquette) + '</small><b>' + h.esc(x.valeur) + '</b></span>';
  return '<li' + h.rv('monte', i || 0) + '>' + (x.href ? '<a href="' + h.esc(x.href) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '>' + corps + '</a>' : '<div>' + corps + '</div>') + '</li>';
}

// ouvert maintenant (calculé dans le navigateur, heure de la Martinique) : seulement avec des horaires lisibles
function ouvert(spec, ctx, cls) {
  const h = ctx.h, hs = h.horairesDe(spec.contact), m = h.horairesMachine(hs);
  return m ? '<p class="x-ouvert' + (cls ? ' ' + cls : '') + '" data-horaires="' + h.esc(m) + '"><i aria-hidden="true"></i><span data-ouvert-texte>' + h.esc(h.resumeHoraires(hs) || 'Nos horaires') + '</span></p>' : '';
}
function horaires(spec, ctx, cls) { const hs = ctx.h.horairesDe(spec.contact); return hs.length ? ctx.h.listeHoraires(hs, cls) : ''; }
function aHoraires(spec, ctx) { return ctx.h.horairesDe(spec.contact).length > 0; }

// la note Google, si elle vaut d'être montrée (4 et plus, 5 avis et plus)
function note(spec, ctx) { return ctx.h.noteGoogle(spec); }
function lieu(spec) { return spec.commune ? spec.commune + ', Martinique' : 'Martinique'; }
function zone(spec, ctx) { return ctx.h.zoneClient(spec) || null; }

function atouts(spec, ctx) { return ctx.h.atouts(spec).map(function (a) { return { titre: net(a.titre), texte: net(a.texte), icone: ctx.h.iconeDe(a, 'check') }; }); }
function faq(spec, ctx) { return ctx.h.faqDe(spec); }
// le texte de présentation (à défaut, la phrase du haut de page)
function presentation(spec, ctx) { return net(spec.a_propos) || ctx.textes.phrase || ''; }

// les boutons du haut de page (action principale, action d'appoint)
function boutons(spec, ctx, o) { return ctx.h.boutons(spec, Object.assign({ aimant: false }, o || {})); }
// le bouton seul de l'action principale
function bouton(spec, ctx, cls, texte) {
  const a = ctx.h.actionPrincipale(spec);
  return a ? '<a class="btn b1' + (cls ? ' ' + cls : '') + '" href="' + ctx.h.esc(a.href) + '"' + (a.ext ? ' target="_blank" rel="noopener"' : '') + '>' + ctx.h.contenuBouton(a.icone, texte || a.texte) + '</a>' : '';
}
// la marque de la section (classes du bloc + identifiant d'ancre)
function section(ctx, id, bloc, extra, ancre, label) { return '<section class="' + ctx.h.classes(id, bloc, extra) + '"' + (ancre ? ' id="' + ancre + '"' : '') + (label ? ' aria-label="' + ctx.h.esc(label) + '"' : '') + '>'; }

module.exports = { net, num, h1, sur, tete, surDe, photo, services, servicesAvecPhotos, lienService, moyens, ligneMoyen, ouvert, horaires, aHoraires, note, lieu, zone, atouts, faq, presentation, boutons, bouton, section };
