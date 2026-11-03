// La petite fiche à remplir par le client : seulement ce qui manque à son site, en quelques lignes, pour qu'il réponde
// en une minute (par email ou WhatsApp). Elle sert à Emma (outil fiche_client) et au bouton « Je veux ce site » de l'aperçu.
// Margot y ajoute ce que la loi impose : au moins le nom officiel de l'entreprise (ou son SIRET), tout le reste se
// retrouve dans le registre à partir de lui.
'use strict';
const MQ = require('../martinique');

// un portable (donc WhatsApp) : Antilles, Guyane, Réunion, Mayotte, métropole
function portable(t) { const e = MQ.e164(t); return !!e && /^(\+596(696|697)|\+590(690|691)|\+594694|\+262(692|693|639)|\+33[67])\d{6,8}$/.test(e); }
function aUnPortable(c) { return portable((c || {}).mobile) || portable((c || {}).tel); }

// Ce que le site n'a pas encore, dans l'ordre où on le demande. prov = d'où viennent les contenus (spec.provenance).
function manque(spec) {
  spec = spec || {};
  const J = require('./juridique');
  const c = spec.contact || {}, prov = spec.provenance || {};
  const out = [];
  if (prov.services !== 'site' && prov.services !== 'client') out.push({ cle: 'services', question: 'Vos services ou vos produits principaux, en quelques mots chacun ?', champ: 'Mes services ou produits :' });
  if (prov.objectif !== 'client') out.push({ cle: 'objectif', question: 'Ce que le site doit vous apporter avant tout : des appels, des messages WhatsApp, des demandes de devis ou des réservations ?', champ: 'Ce que je veux recevoir (appels, WhatsApp, devis, réservations) :' });
  if (!aUnPortable(c)) out.push({ cle: 'portable', question: c.tel ? 'Un numéro de portable pour le bouton WhatsApp du site (votre fixe reste affiché pour les appels) ?' : 'Votre numéro de portable, pour le bouton WhatsApp et les appels ?', champ: 'Mon portable (pour WhatsApp) :' });
  // les mentions légales : le nom officiel d'abord (ou le SIRET) ; puis ce que le registre ne donne pas
  const jq = J.questions(spec);
  if (jq.some(function (q) { return q.cle === 'identite'; })) out.push({ cle: 'legal', question: 'Le nom officiel de votre entreprise, tel qu\'il figure sur votre Kbis ou votre avis de situation Insee (ou votre numéro SIRET) : la loi l\'impose dans les mentions légales du site.', champ: 'Nom officiel de mon entreprise (ou SIRET) :' });
  const cap = jq.find(function (q) { return q.cle === 'capital'; });
  if (cap) out.push({ cle: 'capital', question: cap.question, champ: 'Mon capital social (et mon numéro de TVA si j\'en ai un) :' });
  const ordre = jq.find(function (q) { return q.cle === 'ordre'; });
  if (ordre) out.push({ cle: 'ordre', question: ordre.question, champ: 'Ma profession réglementée (ordre, numéro) :' });
  if (!(c.horaires && c.horaires.length)) out.push({ cle: 'horaires', question: 'Vos horaires ?', champ: 'Mes horaires :' });
  // la zone : seulement pour les métiers qui se déplacent, quand on ne connaît que la commune
  if (prov.zone !== 'client' && ['devis', 'appel'].indexOf(spec.objectif || 'devis') >= 0) out.push({ cle: 'zone', question: 'Les communes où vous travaillez ?', champ: 'Les communes où je travaille :' });
  if (!spec.logo) out.push({ cle: 'logo', question: 'Votre logo, si vous en avez un (en pièce jointe).', champ: null });
  if (prov.photos !== 'client') out.push({ cle: 'photos', question: 'Un maximum de photos : vos réalisations, vos locaux, vos produits, votre équipe si vous le souhaitez. Sans photos de votre part, nous choisissons des photos de votre métier dans des banques d\'images libres de droits.', champ: null });
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
  return 'Bonjour,\n\nJe veux ce site.\n\n' + (lignes.length ? lignes.join('\n') + '\n\n' : '') + (pj ? 'Je joins ' + [m.some(function (x) { return x.cle === 'logo'; }) ? 'mon logo' : null, m.some(function (x) { return x.cle === 'photos'; }) ? 'un maximum de photos' : null].filter(Boolean).join(' et ') + ' (sinon, prenez des photos de mon métier dans une banque d\'images).\n\n' : '') + 'Merci';
}

module.exports = { manque, texte, corpsMailto, portable, aUnPortable };
