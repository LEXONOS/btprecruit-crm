// Le contrôle qualité automatique : ce que Louis vérifiait à la main, vérifié à chaque email, chaque réponse
// et chaque texte de site. Un texte refusé revient à l'agent avec les raisons : il le réécrit dans le même passage.
'use strict';
const { NOVALEMO } = require('./config');

const PRIX_GRILLE = Object.keys(NOVALEMO.grille).reduce(function (t, k) { return t.concat([NOVALEMO.grille[k].prix], NOVALEMO.grille[k].mois ? [NOVALEMO.grille[k].mois] : []); }, []).concat([NOVALEMO.hebergement_an_eur]);
// amendes prévues par la loi pour un site sans mentions légales (LCEN) : l'argument conformité de Louis
const MONTANTS_LEGAUX = [75000, 375000];
const MOTS_CREUX = /\b(solutions?|digitalisation|digitaliser|booster|boostez|boostons|n['’]h[ée]sitez pas|de qualit[ée] sup[ée]rieure|à la pointe|incontournable|clé en main|sur-mesure de qualité|passionn[ée]s? par)\b/i;
const PROMESSES = /(certifi[ée]|agr[ée]{2}|labellis|\brge\b|qualibat|qualipv|garanti(e|s)?\b|d[ée]cennale|assurance tous risques|24 ?h ?\/ ?24|7 ?j ?\/ ?7|satisfait ou rembours|n°\s?1\b|num[ée]ro un|leader\b|le meilleur|les meilleurs|depuis (19|20)\d\d|\d+\s?ans d['’]exp[ée]rience|\d+\s?clients satisfaits)/i;
const REMISES = /(remise|r[ée]duction|promo(tion)?|rabais|\-\s?\d+\s?%|\d+\s?%\s?de r[ée]duc|code promo|offre sp[ée]ciale)/i;
const APPELS = /(je vous (appelle|rappelle|t[ée]l[ée]phone)|on vous (appelle|rappelle)|appelez[- ]moi|rappelez[- ]moi|un (petit )?(appel|coup de fil)|par t[ée]l[ée]phone|mon (num[ée]ro|portable)|\b0691\b|691 ?25 ?34 ?49)/i;
const EMOJIS = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const TROUS = /(\[[^\]]{1,40}\]|\{\{|\}\}|<pr[ée]nom>|<nom>|XXX|lorem ipsum|\bTODO\b|\bA COMPL[ÉE]TER\b)/i;

function mots(t) { return String(t || '').replace(/https?:\/\/\S+/g, 'lien').split(/\s+/).filter(Boolean).length; }
function prixDe(t) {
  const out = [];
  String(t || '').replace(/(\d[\d  .]{0,8})\s?(€|euros?\b|eur\b)/gi, function (m, n) { const v = parseInt(String(n).replace(/[^\d]/g, ''), 10); if (!isNaN(v)) out.push(v); return m; });
  return out;
}
// Les liens, y compris les adresses sans « https:// » (www.x.com, x.net/payer) : les logiciels de mail en font des liens
const TLD_NUS = 'com|fr|net|org|info|biz|io|co|me|pro|site|online|shop|store|app|dev|link|page|xyz|eu|re|gp|mq|ly|gl|to|cc|tv|ai|be|ch|ca|us|uk|de|es|it|nl|club|top|live|website|space|tech|digital|click|pay|money';
const RE_NU = new RegExp('(^|[^a-z0-9@._%+-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:' + TLD_NUS + '))(?![a-z0-9-])(\\/[^\\s<>"\')]*)?', 'gi');
function liensDe(t) {
  const s = String(t || '');
  const out = (s.match(/https?:\/\/[^\s<>"')]+/gi) || []).map(function (u) { return u.replace(/[.,;:!?]+$/, ''); });
  const reste = s.replace(/https?:\/\/[^\s<>"')]+/gi, ' ').replace(/[^\s<>()"',;:]+@[^\s<>()"',;:]+/g, ' ');
  let m;
  RE_NU.lastIndex = 0;
  while ((m = RE_NU.exec(reste))) out.push('https://' + m[2].toLowerCase() + String(m[3] || '').replace(/[.,;:!?]+$/, ''));
  return out;
}
function hoteDe(u) { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } }

// ctx = { lead, site, hotes: [hôtes autorisés], prixAutorises: [nombres] }
function verifier(type, sujet, corps, ctx) {
  ctx = ctx || {};
  const r = [];
  const texte = String(corps || ''), tout = String(sujet || '') + '\n' + texte;
  const n = mots(texte.replace(/R[ée]pondez STOP[^\n]*/i, ''));
  if (TROUS.test(tout)) r.push('un trou à remplir est resté dans le texte (crochets, {{ }}, XXX)');
  if (EMOJIS.test(tout)) r.push('pas d\'emoji');
  if (/[—–]/.test(tout)) r.push('pas de tiret long');
  if (MOTS_CREUX.test(tout)) r.push('mot creux interdit : « ' + tout.match(MOTS_CREUX)[0] + ' »');
  if (PROMESSES.test(tout)) r.push('promesse ou affirmation invérifiable : « ' + tout.match(PROMESSES)[0] + ' »');
  if (REMISES.test(tout)) r.push('jamais de remise ni de promotion');
  const permis = PRIX_GRILLE.concat(MONTANTS_LEGAUX, ctx.prixAutorises || []);
  prixDe(tout).forEach(function (p) { if (permis.indexOf(p) < 0) r.push('prix hors grille : ' + p + ' €'); });
  const hotes = (ctx.hotes || []).map(function (h) { return String(h || '').toLowerCase().replace(/^www\./, ''); }).filter(Boolean);
  liensDe(tout).forEach(function (u) { const h = hoteDe(u); if (!hotes.some(function (x) { return h === x || h.endsWith('.' + x); })) r.push('lien non autorisé : ' + u); });
  if (type === 'prospection' || type === 'relance' || type === 'partenariat') {
    if (!/r[ée]pondez STOP/i.test(texte)) r.push('la ligne « Répondez STOP pour ne plus recevoir de message. » manque');
    if (type === 'prospection' && (n < 45 || n > 170)) r.push('longueur : ' + n + ' mots (entre 45 et 170)');
    if (type === 'relance' && (n < 20 || n > 110)) r.push('longueur : ' + n + ' mots (entre 20 et 110)');
    if (type === 'partenariat' && (n < 45 || n > 200)) r.push('longueur : ' + n + ' mots (entre 45 et 200)');
    if (type !== 'relance' && String(sujet || '').length > 70) r.push('objet trop long (70 caractères maximum)');
    if (type !== 'relance' && /^\s*re\s*:/i.test(sujet || '')) r.push('un premier email ne commence pas par « Re: »');
    if (type === 'prospection' && ctx.site && ctx.site.url_apercu && texte.indexOf(ctx.site.url_apercu) < 0) r.push('le lien de l\'aperçu (' + ctx.site.url_apercu + ') doit être dans l\'email');
    if (APPELS.test(texte)) r.push('Louis ne fait pas d\'appels : pas de proposition d\'appel ni de numéro');
  }
  if (type === 'reponse' || type === 'whatsapp') {
    const lim = type === 'whatsapp' ? [3, 150] : [12, 230];
    if (n < lim[0] || n > lim[1]) r.push('longueur : ' + n + ' mots (entre ' + lim[0] + ' et ' + lim[1] + ')');
    if (APPELS.test(texte)) r.push('Louis ne fait pas d\'appels : tout se règle par email, pas de proposition d\'appel ni de numéro');
    if (/r[ée]pondez STOP/i.test(texte)) r.push('pas de ligne STOP dans une réponse');
  }
  return { ok: r.length === 0, raisons: r.filter(function (x, k, a) { return a.indexOf(x) === k; }) };
}

// Textes d'un site : aucun chiffre inventé, aucune promesse, aucun mot creux (les faits sont posés par le code, pas par l'IA)
function verifierTexteSite(t) {
  const s = String(t || ''), r = [];
  if (/\d/.test(s)) r.push('pas de chiffre dans les textes (« ' + (s.match(/[^.!?]*\d[^.!?]*/) || [''])[0].trim().slice(0, 60) + ' »)');
  if (PROMESSES.test(s)) r.push('affirmation invérifiable : « ' + s.match(PROMESSES)[0] + ' »');
  if (MOTS_CREUX.test(s)) r.push('mot creux : « ' + s.match(MOTS_CREUX)[0] + ' »');
  if (REMISES.test(s)) r.push('promotion interdite');
  if (EMOJIS.test(s)) r.push('pas d\'emoji');
  if (/devis gratuit|intervention rapide|sous \w+ heures|dans l['’]heure/i.test(s)) r.push('promesse de délai ou de gratuité non vérifiée');
  return r;
}
// Retire d'un texte les phrases qui posent problème (dernier filet si la réécriture n'a pas suffi)
function purger(t) {
  return String(t || '').split(/(?<=[.!?])\s+/).filter(function (ph) { return !verifierTexteSite(ph).length; }).join(' ').trim();
}

module.exports = { verifier, verifierTexteSite, purger, prixDe, liensDe, mots, PRIX_GRILLE, APPELS };
