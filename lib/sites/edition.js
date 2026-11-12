// « Modifier moi-même » (12 nov. 2026, Louis : « tout est modifiable, vous pouvez modifier vous-même ici ») : le prospect
// change les textes et les photos directement sur son aperçu, sans attendre personne et sans IA. Le panneau (panneau.js)
// envoie ce qu'il a changé : des paires { avant, apres } (le texte vu sur la page, le texte écrit) et des photos
// remplacées ({ fichier vu sur la page, image envoyée }). Ici, on les pose dans la fiche du site :
//  - un texte qui EST un texte de la fiche (titre, accroche, services, atouts, étapes, questions...) change dans la fiche :
//    le moteur le rend partout où il sert, même si le site est recomposé ;
//  - un texte écrit par le gabarit (un sur-titre, une étiquette) est gardé comme remplacement, appliqué au rendu ;
//  - une photo prend la place de celle qu'il a touchée (même rôle, même place), et devient la sienne.
// Jamais les coordonnées (téléphone, email, adresse, horaires) ni les mentions légales : elles passent par Emma, qui
// vérifie.
'use strict';

const net = function (s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); };
const canon = function (s) { return net(s).replace(/[’`]/g, '\'').toLowerCase(); };
const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

// les textes de la fiche qu'un prospect peut réécrire lui-même
const CHAMPS = ['titre', 'accroche', 'a_propos', 'appel', 'cta', 'zone', 'activite', 'titre_services', 'slogan', 'promesse'];
const LISTES = { services: ['titre', 'texte', 'detail'], atouts: ['titre', 'texte'], etapes: ['titre', 'texte'], faq: ['q', 'r'] };
const MAX_TEXTES = 60, MAX_LONGUEUR = 900;

// toutes les places de texte de la fiche : { lire, ecrire }
function places(spec) {
  const out = [];
  CHAMPS.forEach(function (k) { if (typeof spec[k] === 'string') out.push({ cle: k, lire: function () { return spec[k]; }, ecrire: function (v) { spec[k] = v; } }); });
  Object.keys(LISTES).forEach(function (k) {
    (Array.isArray(spec[k]) ? spec[k] : []).forEach(function (x, i) {
      if (!x || typeof x !== 'object') return;
      LISTES[k].forEach(function (c) { if (typeof x[c] === 'string') out.push({ cle: k + '.' + i + '.' + c, lire: function () { return spec[k][i][c]; }, ecrire: function (v) { spec[k][i][c] = v; } }); });
    });
  });
  return out;
}

function nettoyer(t) { return net(String(t || '').replace(/<[^>]*>/g, ' ')).slice(0, MAX_LONGUEUR); }
function paires(liste) {
  const vues = new Set();
  return (Array.isArray(liste) ? liste : []).slice(0, MAX_TEXTES).map(function (x) { return { avant: nettoyer(x && x.avant), apres: nettoyer(x && x.apres) }; })
    .filter(function (x) { if (!x.avant || !x.apres || x.avant === x.apres || vues.has(x.avant)) return false; vues.add(x.avant); return true; });
}

// Pose les changements dans une COPIE de la fiche. photos = [{ fichier, img }] (img : l'objet image déjà envoyé à Vercel).
// Retourne { spec, bilan: { fiche, gabarit, photos } }.
function appliquer(spec0, textes, photos) {
  const spec = JSON.parse(JSON.stringify(spec0 || {}));
  const bilan = { fiche: 0, gabarit: 0, photos: 0 };
  const restes = [];
  paires(textes).forEach(function (p) {
    const ps = places(spec);
    // 1. le même texte, tel quel : partout où il est (le même texte à deux endroits, c'est la même chose)
    const egaux = ps.filter(function (x) { return canon(x.lire()) === canon(p.avant); });
    if (egaux.length) { egaux.forEach(function (x) { x.ecrire(p.apres); }); bilan.fiche++; return; }
    // 2. une partie d'un texte de la fiche (la page montre une réponse sans sa dernière phrase, par exemple) : seulement si
    // elle n'est qu'à un seul endroit
    const dedans = ps.filter(function (x) { return net(p.avant).length >= 12 && net(x.lire()).indexOf(net(p.avant)) >= 0; });
    if (dedans.length === 1) { const x = dedans[0]; x.ecrire(net(x.lire()).replace(net(p.avant), p.apres)); bilan.fiche++; return; }
    // 3. un texte du gabarit : gardé comme remplacement, appliqué au rendu
    restes.push(p);
  });
  if (restes.length) {
    // un texte qu'il avait déjà réécrit (il retouche sa propre version, ou repart du texte d'origine) : la même ligne, du
    // texte d'origine à sa dernière version ; revenu au texte d'origine, la ligne disparaît
    let fusion = ((spec.edition && Array.isArray(spec.edition.textes)) ? spec.edition.textes : []).slice();
    restes.forEach(function (r) {
      const k = fusion.findIndex(function (x) { return x.apres === r.avant || x.avant === r.avant; });
      if (k >= 0) fusion[k] = { avant: fusion[k].avant, apres: r.apres };
      else fusion.push(r);
    });
    fusion = fusion.filter(function (x) { return x.avant !== x.apres; });
    spec.edition = Object.assign({}, spec.edition || {}, { textes: fusion.slice(-MAX_TEXTES) });
    bilan.gabarit = restes.length;
  }
  (Array.isArray(photos) ? photos : []).forEach(function (p) {
    if (!p || !p.img || !p.fichier) return;
    if (spec.logo && spec.logo.fichier === p.fichier) { spec.logo = Object.assign({}, p.img, { alt: spec.logo.alt || net(spec.nom) }); bilan.photos++; return; }
    const ph = Array.isArray(spec.photos) ? spec.photos : [];
    const k = ph.findIndex(function (x) { return x && x.fichier === p.fichier; });
    if (k < 0) return;
    const ancienne = ph[k];
    // sa photo prend la place de l'illustration : même rôle et même place, plus de crédit de banque d'images
    const neuve = Object.assign({}, p.img, { role: ancienne.role, places: ancienne.places, place: ancienne.place, alt: net(spec.nom) || ancienne.alt || '' });
    Object.keys(neuve).forEach(function (c) { if (neuve[c] === undefined) delete neuve[c]; });
    spec.photos = ph.slice(0, k).concat([neuve], ph.slice(k + 1));
    spec.provenance = Object.assign({}, spec.provenance || {}, { photos: 'client' });
    bilan.photos++;
  });
  if (bilan.fiche || bilan.gabarit || bilan.photos) spec.edition = Object.assign({}, spec.edition || {}, { le: new Date().toISOString(), fois: ((spec.edition && spec.edition.fois) || 0) + 1 });
  return { spec: spec, bilan: bilan };
}

// Au rendu : les textes du gabarit qu'il a réécrits. Seulement un texte entier entre deux balises (un titre, une étiquette),
// jamais dans un attribut ni dans un script, et seulement dans le corps de la page (<main>), là où il les a modifiés :
// le même mot dans l'en-tête, le pied ou les mentions légales (son nom, par exemple) ne bouge pas.
function html(page, spec) {
  const t = spec && spec.edition && Array.isArray(spec.edition.textes) ? spec.edition.textes : [];
  if (!t.length || typeof page !== 'string') return page;
  const i = page.indexOf('<main'), j = page.lastIndexOf('</main>');
  if (i < 0 || j < i) return page;
  let corps = page.slice(i, j);
  t.forEach(function (p) {
    const a = esc(net(p.avant)), b = esc(net(p.apres));
    if (!a || a === b) return;
    corps = corps.split('>' + a + '<').join('>' + b + '<');
  });
  return page.slice(0, i) + corps + page.slice(j);
}

module.exports = { appliquer, html, paires, places, CHAMPS, LISTES, MAX_TEXTES };
