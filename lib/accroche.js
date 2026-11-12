// Le message de Louis (12 nov. 2026), écrit par le code et jamais par l'IA : le premier email et la relance de Novalemo.
// Louis : « une phrase agressive dès le début, ça plaît à personne et ça braque. Dis plutôt : je suis tombé sur votre
// entreprise, j'ai remarqué que vous aviez pas mal d'avis mais pas de site, j'ai pris de l'avance, grâce aux outils
// d'aujourd'hui je vous ai fait un aperçu ; tout est modifiable en bas ; 99 € ; nos sites sont faits avec l'IA mais
// largement suffisants ; pour un plus gros site, Studio Novalem ; et un mot avec le lien dedans, pour rassurer ».
// Donc : jamais de critique du site actuel ni de menace d'amende, le prix franchement, l'IA dite, un seul lien (derrière
// des mots dans la version HTML), et une ligne STOP. Zéro coût : aucun appel à Claude.
'use strict';
const { NOVALEMO } = require('./config');

const net = function (s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); };
const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
// un choix stable par prospect : le même prospect garde la même tournure, deux voisins en ont souvent une autre
function choix(id, liste, sel) { const h = (((Number(id) || 0) + (sel || 0) * 7919) * 2654435761 >>> 0) % liste.length; return liste[h]; }

// pas de site du tout, une page de réseau social, une adresse qui ne mène à rien : « pas de site »
const SANS_SITE = ['aucun', 'reseau', 'vide', 'parking', 'construction', 'erreur'];
function situation(lead) {
  const st = String((lead && lead.site_state) || '').toLowerCase();
  if (!st || SANS_SITE.indexOf(st) >= 0) return 'sans_site';
  return 'site';
}

// le nom tel qu'on l'écrit à quelqu'un : celui du site préparé (déjà propre), sinon celui de la fiche, sans tout en
// capitales ni forme juridique devant
function nomDe(lead, site) {
  let n = net((site && site.spec && site.spec.nom) || (lead && lead.name) || '');
  n = n.replace(/^(sarl|sas|sasu|eurl|sa|sci|snc|ei|ets|entreprise)\.?\s+/i, '').trim();
  if (n && n === n.toUpperCase() && /[A-Z]{4,}/.test(n)) n = n.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); });
  return n || 'votre entreprise';
}
function avisDe(lead, site) {
  const g = (lead && lead.data && lead.data.google) || (site && site.spec && site.spec.google) || {};
  const n = parseInt(String(g.avis == null ? (g.nb_avis || g.avis_nb || '') : g.avis).replace(/[^\d]/g, ''), 10) || 0;
  const note = parseFloat(String(g.note == null ? '' : g.note).replace(',', '.')) || 0;
  return { n: n, note: note };
}
const noteTexte = function (x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, ''); };
function communeDe(lead, site) { return net((lead && lead.commune) || (site && site.spec && site.spec.commune) || ''); }

// « J'ai vu que vous aviez réservé maison-durand.fr » : seulement un vrai domaine à lui, sans protocole
function domaineDe(lead) {
  const d = String((lead && lead.domain) || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null;
}

// la première phrase : ce que Louis a vu, vrai et précis, sans un mot sur ce qui ne va pas chez lui
function ouverture(lead, site) {
  const nom = nomDe(lead, site), commune = communeDe(lead, site), a = avisDe(lead, site);
  const st = String((lead && lead.site_state) || '').toLowerCase();
  const dom = domaineDe(lead);
  if (lead && lead.source === 'domaines' && dom && ['vide', 'parking', 'construction'].indexOf(st) >= 0) {
    return 'J\'ai vu que vous aviez réservé l\'adresse ' + dom + '. Elle n\'affiche encore qu\'une page d\'attente.';
  }
  const ou = commune ? ' à ' + commune : '';
  let vu;
  // des avis qui donnent confiance : au moins cinq, et une bonne note (une note basse ne se cite pas)
  if (a.n >= 5 && (!a.note || a.note >= 4)) {
    const note = a.note >= 4 ? ', avec une note de ' + noteTexte(a.note) : '';
    const contents = a.note >= 4.3 ? ' et une note de ' + noteTexte(a.note) + ' : vos clients parlent de vous' : '';
    vu = choix(lead && lead.id, [
      'Je suis tombé sur ' + nom + ' en cherchant des entreprises' + ou + ' : ' + a.n + ' avis sur Google' + note + '.',
      'En regardant les entreprises' + ou + ' sur Google, je suis tombé sur ' + nom + ' : ' + a.n + ' avis' + note + '.',
      'Je suis tombé sur la fiche Google de ' + nom + ' en cherchant des entreprises' + ou + '. ' + a.n + ' avis' + (contents || note) + '.'
    ]);
  } else {
    vu = choix(lead && lead.id, [
      'Je suis tombé sur ' + nom + ' en cherchant des entreprises' + ou + '.',
      'En regardant les entreprises' + ou + ' sur Google, je suis tombé sur ' + nom + '.'
    ]);
  }
  if (situation(lead) === 'site') return vu + ' J\'ai vu que vous aviez déjà un site.';
  if (st === 'reseau') return vu + ' Par contre, à part vos réseaux, je n\'ai pas trouvé de site internet.';
  if (st === 'erreur') return vu + ' Par contre, l\'adresse de votre site ne s\'ouvre pas chez moi.';
  if (['vide', 'parking', 'construction'].indexOf(st) >= 0) return vu + ' Par contre, l\'adresse de votre site n\'affiche encore qu\'une page d\'attente.';
  return vu + ' Par contre, je n\'ai pas trouvé de site internet.';
}

const PIED = 'Pour ne plus recevoir de message, répondez STOP.';
function pied(lead) {
  const src = String((lead && lead.email_source) || '');
  const ou = src === 'site' ? 'sur votre site' : src === 'maps' || src === 'google' ? 'sur votre fiche Google' : src === 'apercu' ? 'dans votre demande' : 'publiquement';
  return 'Je vous écris à l\'adresse affichée ' + ou + '. ' + PIED;
}
const SIGNE = 'Bonne journée,\nLouis\nNovalemo, sites internet en Martinique';
function prix() { return NOVALEMO.grille.essentiel.prix; }
function studio() { return NOVALEMO.studio || { url: 'https://studionovalem.fr' }; }

// Le premier email : { objet, corps, situation }. url = le lien de l'aperçu publié.
function premier(lead, site, url) {
  const nom = nomDe(lead, site), sit = situation(lead), p = prix(), an = NOVALEMO.hebergement_an_eur;
  const avance = sit === 'site'
    ? 'J\'ai pris un peu d\'avance : avec les outils d\'aujourd\'hui, je vous ai préparé une version plus récente, pour que vous voyiez ce que ça pourrait donner.'
    : 'J\'ai pris un peu d\'avance : avec les outils d\'aujourd\'hui, je vous ai préparé un aperçu de ce que pourrait être votre site.';
  const corps = [
    'Bonjour,',
    ouverture(lead, site),
    avance + '\nVoir votre site : ' + url,
    'Tout est modifiable : en bas de la page, vous changez vous-même les textes et les photos, ou vous me dites ce que vous voulez.',
    'Si le site vous plaît, il est à vous pour ' + p + ' € en une fois, sans abonnement, nom de domaine et hébergement compris la première année (puis ' + an + ' € par an). Il est fait avec l\'aide de l\'IA : c\'est ce qui permet ce prix, et pour une entreprise comme la vôtre c\'est largement suffisant.',
    'Pour un projet plus complet (plusieurs pages, réservation en ligne, boutique), mon studio s\'en occupe : ' + studio().url.replace(/^https?:\/\//, '') + '.',
    choix(lead && lead.id, ['Qu\'en pensez-vous ?', 'Il vous plaît ?', 'Je le mets en ligne pour vous ?'], 3),
    SIGNE,
    pied(lead)
  ].join('\n\n');
  const court = nom.length <= 34;
  const objet = court ? choix(lead && lead.id, ['J\'ai préparé le site de ' + nom, 'Un site pour ' + nom, nom + ' : votre site, prêt à voir'], 5) : 'Votre site, prêt à voir';
  return { objet: objet, corps: corps, situation: sit };
}

// La relance, dans le même fil. ancien = le premier email était l'ancien message (490 €) : la relance annonce le nouveau prix.
function relance(lead, site, url, ancien) {
  const nom = nomDe(lead, site), p = prix(), an = NOVALEMO.hebergement_an_eur;
  const corps = ancien ? [
    'Bonjour,',
    'Une nouvelle pour ' + nom + ' : le site que je vous ai préparé est maintenant à ' + p + ' €, en une fois et sans abonnement. Le nom de domaine et l\'hébergement sont compris la première année, puis ' + an + ' € par an.\nVoir votre site : ' + url,
    'Tout est modifiable : en bas de la page, vous changez vous-même les textes et les photos.',
    'Il vous plaît ?',
    SIGNE,
    PIED
  ] : [
    'Bonjour,',
    'Je vous remets le site que j\'ai préparé pour ' + nom + ', au cas où mon premier message serait passé à la trappe.\nVoir votre site : ' + url,
    'Il reste en ligne encore quelques jours. S\'il vous convient, il est à vous pour ' + p + ' € en une fois, nom de domaine et hébergement compris la première année. Et tout se modifie depuis le bas de la page.',
    SIGNE,
    PIED
  ];
  return { corps: corps.join('\n\n') };
}

// La version HTML d'un email texte : des paragraphes, et une ligne « Libellé : https://… » devient un lien sur les mots
// (« Voir votre site ») ; un lien nu reste un lien. Pas d'image, pas de traceur, pas de mise en page : un email de
// personne à personne. La version texte garde l'adresse en entier (les deux partent ensemble).
const RE_LIBELLE = /^\s*([^:\n]{2,48}?)\s:\s(https?:\/\/[^\s<>"]+)\s*$/;
function ligneHtml(l) {
  const m = l.match(RE_LIBELLE);
  if (m) return '<a href="' + esc(m[2]) + '" style="color:#0b63ce;font-weight:600;text-decoration:underline">' + esc(m[1]) + '</a>';
  return esc(l).replace(/https?:\/\/[^\s<>"']+/g, function (u) { const fin = (u.match(/[.,;:!?)]+$/) || [''])[0], v = fin ? u.slice(0, -fin.length) : u; return '<a href="' + v + '" style="color:#0b63ce">' + v + '</a>' + fin; });
}
function html(corps) {
  const paras = String(corps || '').replace(/\r/g, '').trim().split(/\n{2,}/);
  const bloc = paras.map(function (p) {
    const petit = /r[ée]pondez STOP/i.test(p) && p.length < 220;
    return '<p style="margin:0 0 14px' + (petit ? ';font-size:12px;color:#7a7f87' : '') + '">' + p.split('\n').map(ligneHtml).join('<br>') + '</p>';
  }).join('');
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;padding:0"><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2328;max-width:600px">' + bloc + '</div></body></html>';
}
// un email a-t-il une version HTML utile (un lien derrière des mots) ?
function avecLien(corps) { return String(corps || '').split('\n').some(function (l) { return RE_LIBELLE.test(l); }); }

module.exports = { premier, relance, html, avecLien, ouverture, situation, nomDe, avisDe, PIED, SIGNE, SANS_SITE };
