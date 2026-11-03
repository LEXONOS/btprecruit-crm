// La petite fiche à remplir par le client : seulement ce qui manque à son site, en quelques lignes, pour qu'il réponde
// en une minute (par email ou WhatsApp). Elle sert à Emma (outil fiche_client) et au bouton « Je veux ce site » de l'aperçu.
'use strict';
const MQ = require('../martinique');

// un portable (donc WhatsApp) : Antilles, Guyane, Réunion, métropole
function portable(t) { const e = MQ.e164(t); return !!e && /^(\+596(696|697)|\+590(690|691)|\+594694|\+262(692|693)|\+33[67])\d{6,8}$/.test(e); }

// Ce que le site n'a pas encore, dans l'ordre où on le demande. prov = d'où viennent les contenus (spec.provenance).
function manque(spec) {
  spec = spec || {};
  const c = spec.contact || {}, prov = spec.provenance || {};
  const out = [];
  if (prov.services !== 'site' && prov.services !== 'client') out.push({ cle: 'services', question: 'Vos services ou vos produits principaux, en quelques mots chacun ?', champ: 'Mes services ou produits :' });
  if (prov.objectif !== 'client') out.push({ cle: 'objectif', question: 'Ce que le site doit vous apporter avant tout : des appels, des messages WhatsApp, des demandes de devis ou des réservations ?', champ: 'Ce que je veux recevoir (appels, WhatsApp, devis, réservations) :' });
  if (!portable(c.tel)) out.push({ cle: 'portable', question: c.tel ? 'Un numéro de portable pour le bouton WhatsApp du site (en plus de votre fixe) ?' : 'Votre numéro de portable, pour le bouton WhatsApp et les appels ?', champ: 'Mon portable (pour WhatsApp) :' });
  if (!(c.horaires && c.horaires.length)) out.push({ cle: 'horaires', question: 'Vos horaires ?', champ: 'Mes horaires :' });
  // la zone : seulement pour les métiers qui se déplacent, quand on ne connaît que la commune
  const zoneParDefaut = !spec.zone || /^(Basés? (à|au|aux|en) .+, en Martinique|En Martinique)$/i.test(String(spec.zone).trim());
  if (prov.zone !== 'client' && zoneParDefaut && ['devis', 'appel'].indexOf(spec.objectif || 'devis') >= 0) out.push({ cle: 'zone', question: 'Les communes où vous travaillez ?', champ: 'Les communes où je travaille :' });
  if (!spec.logo) out.push({ cle: 'logo', question: 'Votre logo, si vous en avez un (en pièce jointe).', champ: null });
  if (prov.photos !== 'client') out.push({ cle: 'photos', question: 'Un maximum de photos : vos réalisations, vos locaux, vos produits, votre équipe si vous le souhaitez. Sans photos de votre part, nous choisissons des photos d\'illustration dans des banques d\'images libres de droits.', champ: null });
  return out;
}

// Le texte à coller dans une réponse (email ou WhatsApp)
function texte(spec, opts) {
  opts = opts || {};
  const m = manque(spec).filter(function (x) { return !opts.sauf || opts.sauf.indexOf(x.cle) < 0; });
  if (!m.length) return '';
  return 'Pour que votre site soit vraiment le vôtre, il me manque juste ceci (répondez en vrac, même en deux mots) :\n' + m.map(function (x) { return '- ' + x.question; }).join('\n');
}

// Le corps de l'email « Je veux ce site » : des lignes à compléter, et les pièces jointes à ajouter
function corpsMailto(spec) {
  const m = manque(spec);
  const lignes = m.filter(function (x) { return x.champ; }).map(function (x) { return x.champ + ' '; });
  const pj = m.some(function (x) { return x.cle === 'logo'; }) || m.some(function (x) { return x.cle === 'photos'; });
  return 'Bonjour,\n\nJe veux ce site.\n\n' + (lignes.length ? lignes.join('\n') + '\n\n' : '') + (pj ? 'Je joins ' + [m.some(function (x) { return x.cle === 'logo'; }) ? 'mon logo' : null, m.some(function (x) { return x.cle === 'photos'; }) ? 'un maximum de photos' : null].filter(Boolean).join(' et ') + ' (sinon, prenez des photos d\'illustration).\n\n' : '') + 'Merci';
}

module.exports = { manque, texte, corpsMailto, portable };
