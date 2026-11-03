// La relecture d'Iris, directrice artistique : chaque site est vérifié par le code avant de partir, et corrigé quand
// c'est possible sans rien inventer. Règles nettes : un grand titre qui dit le métier et la commune, une phrase courte et
// concrète dessous, un contact qui marche, une photo là où le modèle en demande, des contrastes lisibles, et jamais deux
// voisins du même métier avec la même combinaison.
'use strict';
const T = require('./theme');
const DN = require('./donne');
const M = require('./modeles');
const Q = require('../qualite');

const PHRASE_MIN = 30, PHRASE_MAX = 110, METIER_MAX = 30;
// les formules qui ne disent rien : refusées dans le titre et la phrase du haut
const VIDES = /(?<![\p{L}\p{N}])(bienvenue|partenaire|l['’]expert|experts?|expertise|excellence|qualit[ée]|professionnalisme|satisfaction|n°\s?1|leader|meilleurs?|incontournable|r[ée]f[ée]rence|au service de|à votre service|à votre écoute|savoir[- ]faire|passion|solutions?|innovant|innovation|unique|prestige|haut de gamme|optimal|sur[- ]mesure|n['’]attendez plus|découvrez|priorit[ée]s?|de confiance|à vos côtés|au c(œ|oe)ur de|l['’]art de|s[ée]r[ée]nit[ée]|tranquillit[ée] d['’]esprit|r[êe]ves?|sublim\p{L}*|id[ée]al\p{L}*|de a à z|cl[ée] en main)(?![\p{L}\p{N}])/iu;
function net(s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
function sansAccents(s) { return net(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

// La phrase sous le grand titre : une phrase simple et concrète
function phraseOk(a, spec) {
  const t = net(a), r = [];
  if (!t) return { ok: false, raisons: ['vide'] };
  if (t.length < PHRASE_MIN) r.push('trop courte (' + t.length + ' caractères, ' + PHRASE_MIN + ' au moins)');
  if (t.length > PHRASE_MAX) r.push('trop longue (' + t.length + ' caractères, ' + PHRASE_MAX + ' au plus)');
  if (/[!?]/.test(t)) r.push('ni question, ni exclamation');
  if (VIDES.test(t)) r.push('formule vide : « ' + t.match(VIDES)[0] + ' »');
  if (spec && spec.nom && sansAccents(spec.nom).length >= 4 && sansAccents(t).indexOf(sansAccents(spec.nom)) >= 0) r.push('répète le nom, déjà affiché');
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) r.push('pas tout en capitales');
  Q.verifierTexteSite(t).forEach(function (x) { r.push(x); });
  return { ok: !r.length, raisons: r };
}
// Le métier du grand titre (« Climatisation » → « Climatisation au Lamentin »)
function metierOk(m) {
  const t = net(m), r = [];
  if (!t) return { ok: false, raisons: ['vide'] };
  if (t.length > METIER_MAX) r.push('trop long');
  if (t.split(' ').length > 5) r.push('cinq mots au plus');
  if (/[!?:;.]/.test(t) || /\d/.test(t)) r.push('ni ponctuation ni chiffre');
  if (VIDES.test(t)) r.push('formule vide : « ' + t.match(VIDES)[0] + ' »');
  return { ok: !r.length, raisons: r };
}
function phraseDeSecours(spec) {
  const t = ((spec && spec.services) || []).slice(0, 3).map(function (s) { return net(s.titre).toLowerCase(); }).filter(Boolean);
  if (!t.length) return '';
  const p = t.length === 1 ? t[0] : t.slice(0, -1).join(', ') + ' et ' + t[t.length - 1];
  return p.charAt(0).toUpperCase() + p.slice(1) + '.';
}

// Les contrastes de la palette réellement affichée (couleur de marque comprise)
function contrastes(spec) {
  const da = DN.de(spec), p = T.palette(DN.paletteDe(da), spec.accent), out = [];
  const voir = function (nom, a, b, min) { const c = T.contraste(a, b); if (c < min) out.push(nom + ' ' + c.toFixed(2) + ' (au moins ' + min + ')'); };
  voir('texte sur fond', p.encre, p.fond, 7); voir('texte secondaire', p.doux, p.fond, 4.5); voir('texte secondaire sur les bandes', p.doux, p.surface, 4.5); voir('lien', p.accentTexte, p.fond, 4.5);
  voir('bouton', p.surAccent, p.accent, 4.5); voir('aplat', p.surChamp, p.champ, 4.5); voir('texte secondaire sur aplat', p.champDoux, p.champ, 4.5); voir('bouton sur aplat', p.surVif, p.vif, 4.5);
  return out;
}

// opts = { recents: [da des voisins] }
function verifier(spec, opts) {
  opts = opts || {};
  spec = spec || {};
  const out = [];
  const pb = function (code, message) { out.push({ code: code, message: message }); };
  const v3 = (spec.v || 0) >= 3;
  if (v3) {
    const m = metierOk(spec.metier);
    if (!m.ok) pb('metier', 'grand titre : ' + m.raisons.join(', '));
    const a = phraseOk(spec.accroche, spec);
    if (!a.ok) pb('accroche', 'phrase du haut : ' + a.raisons.join(', '));
  }
  const sv = spec.services || [];
  if (sv.length < 3) pb('services', sv.length + ' service(s) seulement (3 au moins)');
  const titres = sv.map(function (s) { return sansAccents(s.titre); });
  if (titres.some(function (t, k) { return titres.indexOf(t) !== k; })) pb('services', 'deux services portent le même titre');
  if (sv.some(function (s) { return net(s.texte).length < 20; })) pb('services', 'un service sans vraie description');
  const c = spec.contact || {};
  if (!c.tel && !c.email && !c.mobile) pb('contact', 'aucun moyen de contact sur le site');
  const da = spec.da;
  const mod = da && M.MODELES[da.modele];
  if (!da || da.v !== DN.VERSION || !mod || !DN.paletteDe(da) || mod.types.indexOf(da.type) < 0) pb('donne', 'pas de donne à jour (modèle, palette, voix)');
  else {
    const nPhotos = (spec.photos || []).filter(function (p) { return p && p.fichier; }).length;
    if (DN.HEROS_PHOTO[da.hero] && !nPhotos) pb('photo_manquante', 'le haut de page « ' + da.hero + ' » demande une photo');
    if (da.hero === 'nu' && nPhotos) pb('photo_inutilisee', 'une photo est là mais le haut de page n\'en montre pas');
    const meme = (opts.recents || []).filter(function (r) { return r && r.modele === da.modele && r.palette === da.palette && r.type === da.type; }).length;
    if (meme) pb('repetition', 'même modèle, même palette et même voix qu\'un site voisin');
    contrastes(spec).forEach(function (x) { pb('contraste', 'contraste trop faible : ' + x); });
  }
  return out;
}

// Corrige ce qui peut l'être sans rien inventer : titre du métier, phrase du haut, nouvelle donne. → { spec, corrections, restants }
function revoir(spec, opts) {
  opts = opts || {};
  const s = Object.assign({}, spec);
  const corrections = [];
  let pbs = verifier(s, opts);
  if (pbs.some(function (p) { return p.code === 'metier'; })) {
    const avant = s.metier;
    const act = net(s.activite);
    s.metier = metierOk(act).ok ? act : '';
    corrections.push('grand titre : « ' + net(avant) + ' » devient « ' + (s.metier || net(s.nom)) + ' »');
  }
  if (pbs.some(function (p) { return p.code === 'accroche'; })) {
    const avant = s.accroche, sec = phraseDeSecours(s);
    if (phraseOk(sec, s).ok || !net(avant)) { s.accroche = sec; corrections.push('phrase du haut : « ' + net(avant) + ' » devient « ' + sec + ' »'); }
  }
  const aRedonner = function (l) { return l.some(function (p) { return ['donne', 'photo_manquante', 'photo_inutilisee', 'repetition', 'contraste'].indexOf(p.code) >= 0; }); };
  pbs = verifier(s, opts);
  if (aRedonner(pbs)) {
    const depart = (s.da && s.da.essai) || 0;
    for (let k = 1; k <= 16; k++) {
      const da = DN.donner(s, { recents: opts.recents, essai: depart + k });
      const essai = Object.assign({}, s, { da: da });
      if (!aRedonner(verifier(essai, opts))) { corrections.push('nouvelle donne : ' + M.MODELES[da.modele].nom.toLowerCase() + ', ' + DN.paletteDe(da).nom.toLowerCase() + ', ' + T.typo(da.type).nom + ', haut de page ' + da.hero); s.da = da; break; }
    }
  }
  return { spec: s, corrections: corrections, restants: verifier(s, opts) };
}

module.exports = { verifier, revoir, phraseOk, accrocheOk: phraseOk, metierOk, phraseDeSecours, contrastes, VIDES, PHRASE_MAX, METIER_MAX };
