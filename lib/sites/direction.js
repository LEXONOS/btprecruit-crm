// La relecture d'Iris, directrice artistique : chaque site est vérifié par le code avant de partir, et corrigé quand
// c'est possible sans rien inventer. Règles nettes : un titre court et concret, un contact qui marche, des photos là où
// la mise en scène en demande, des contrastes lisibles, et jamais deux voisins avec le même site.
'use strict';
const T = require('./theme');
const DN = require('./donne');
const Q = require('../qualite');
const MQ = require('../martinique');

const ACCROCHE_MAX = 46;
// les formules qui ne disent rien : refusées dans un titre
const VIDES = /(?<![\p{L}\p{N}])(bienvenue|partenaire|l['’]expert|experts?|expertise|excellence|qualit[ée]|professionnalisme|satisfaction|n°\s?1|leader|meilleurs?|incontournable|r[ée]f[ée]rence|au service de|à votre service|à votre écoute|savoir[- ]faire|passion|solutions?|innovant|innovation|unique|prestige|haut de gamme|optimal|sur[- ]mesure|n['’]attendez plus|découvrez|priorit[ée]s?|de confiance|à vos côtés|au c(œ|oe)ur de|l['’]art de|s[ée]r[ée]nit[ée]|tranquillit[ée] d['’]esprit|r[êe]ves?|sublim\p{L}*|id[ée]al\p{L}*)(?![\p{L}\p{N}])/iu;
function net(s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
function sansAccents(s) { return net(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

function accrocheOk(a, spec) {
  const t = net(a), r = [];
  if (!t) return { ok: false, raisons: ['vide'] };
  const mots = t.split(' ').filter(Boolean);
  if (t.length > ACCROCHE_MAX) r.push('trop long (' + t.length + ' caractères, ' + ACCROCHE_MAX + ' au plus)');
  if (mots.length < 2 || mots.length > 8) r.push('entre deux et huit mots');
  if (/[?!:;]/.test(t)) r.push('ni question, ni exclamation, ni deux-points');
  if (VIDES.test(t)) r.push('formule vide : « ' + t.match(VIDES)[0] + ' »');
  if (spec && spec.nom && sansAccents(t).indexOf(sansAccents(spec.nom)) >= 0) r.push('répète le nom, déjà affiché');
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) r.push('pas tout en capitales');
  Q.verifierTexteSite(t).forEach(function (x) { r.push(x); });
  return { ok: !r.length, raisons: r };
}
// La meilleure des propositions de l'atelier ; à défaut, un titre factuel tiré du métier et de la commune
function choisirAccroche(liste, spec) {
  const bonnes = (liste || []).map(net).filter(function (a) { return accrocheOk(a, spec).ok; });
  if (bonnes.length) return bonnes[0];
  const act = net(spec && spec.activite), com = spec && spec.commune;
  const factuel = act && com ? act + ' ' + MQ.a(com) : act;
  if (factuel && factuel.length <= ACCROCHE_MAX) return factuel;
  return act || net(spec && spec.nom);
}

// Les contrastes de la palette réellement affichée (couleur de marque comprise)
function contrastes(spec) {
  const da = DN.de(spec), p = T.palette(da.palette, spec.accent), out = [];
  const voir = function (nom, a, b, min) { const c = T.contraste(a, b); if (c < min) out.push(nom + ' ' + c.toFixed(2) + ' (au moins ' + min + ')'); };
  voir('texte sur fond', p.encre, p.fond, 7); voir('texte secondaire', p.doux, p.fond, 4.5); voir('lien', p.accentTexte, p.fond, 4.5);
  voir('bouton', p.surAccent, p.accent, 4.5); voir('aplat', p.surChamp, p.champ, 4.5); voir('texte secondaire sur aplat', p.champDoux, p.champ, 4.5); voir('bouton sur aplat', p.surVif, p.vif, 4.5);
  return out;
}

// opts = { recents: [da des voisins] }
function verifier(spec, opts) {
  opts = opts || {};
  spec = spec || {};
  const out = [];
  const pb = function (code, message) { out.push({ code: code, message: message }); };
  const a = accrocheOk(spec.accroche, spec);
  if (!a.ok) pb('accroche', 'titre : ' + a.raisons.join(', '));
  const ch = net(spec.chapo);
  if (ch.length < 40 || ch.length > 210) pb('chapo', 'phrase d\'introduction de ' + ch.length + ' caractères (40 à 210)');
  const sv = spec.services || [];
  if (sv.length < 3) pb('services', sv.length + ' service(s) seulement (3 au moins)');
  const titres = sv.map(function (s) { return sansAccents(s.titre); });
  if (titres.some(function (t, k) { return titres.indexOf(t) !== k; })) pb('services', 'deux services portent le même titre');
  if (sv.some(function (s) { return net(s.texte).length < 30; })) pb('services', 'un service sans vraie description');
  const c = spec.contact || {};
  if (!c.tel && !c.email) pb('contact', 'aucun moyen de contact sur le site');
  const da = spec.da;
  const nPhotos = (spec.photos || []).filter(function (p) { return p && p.fichier; }).length;
  if (!da || !DN.DIRECTIONS[da.direction]) pb('donne', 'pas de direction artistique');
  else {
    if (DN.DIRECTIONS[da.direction].photo && !nPhotos) pb('photo_manquante', 'la mise en scène « ' + DN.DIRECTIONS[da.direction].nom + ' » demande une photo');
    const pal = T.PAR_ID[da.palette];
    if (spec.logo && pal && !pal.clair) pb('logo_sur_sombre', 'un logo se perd sur une palette sombre');
    const meme = (opts.recents || []).filter(function (r) { return r && r.palette === da.palette && r.type === da.type; }).length;
    if (meme) pb('repetition', 'même palette et même voix qu\'un site voisin');
  }
  contrastes(spec).forEach(function (x) { pb('contraste', 'contraste trop faible : ' + x); });
  return out;
}

// Corrige ce qui peut l'être sans rien inventer : choix du titre, nouvelle donne. Retourne { spec, corrections, restants }
function revoir(spec, opts) {
  opts = opts || {};
  const s = Object.assign({}, spec);
  const corrections = [];
  let pbs = verifier(s, opts);
  if (pbs.some(function (p) { return p.code === 'accroche'; })) {
    const avant = s.accroche;
    s.accroche = choisirAccroche([].concat(s.accroches || [], [s.accroche]), s);
    if (s.accroche !== avant) corrections.push('titre : « ' + net(avant) + ' » devient « ' + s.accroche + ' »');
  }
  const aRedonner = function (l) { return l.some(function (p) { return ['donne', 'photo_manquante', 'logo_sur_sombre', 'repetition', 'contraste'].indexOf(p.code) >= 0; }); };
  pbs = verifier(s, opts);
  if (aRedonner(pbs)) {
    const depart = (s.da && s.da.essai) || 0;
    for (let k = 1; k <= 12; k++) {
      const da = DN.donner(s, { recents: opts.recents, essai: depart + k });
      const essai = Object.assign({}, s, { da: da });
      if (!aRedonner(verifier(essai, opts))) { corrections.push('nouvelle direction : ' + DN.DIRECTIONS[da.direction].nom.toLowerCase() + ', ' + T.PAR_ID[da.palette].nom.toLowerCase() + ', ' + T.typo(da.type).nom); s.da = da; break; }
    }
  }
  return { spec: s, corrections: corrections, restants: verifier(s, opts) };
}

module.exports = { verifier, revoir, accrocheOk, choisirAccroche, contrastes, ACCROCHE_MAX };
