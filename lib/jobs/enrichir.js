// Marcus, Fournisseur de contacts : prend les prospects bruts, audite le site, trouve l'email de
// l'entreprise (jamais celui d'un tiers), vérifie que le domaine reçoit des mails, classe et note.
// Cible : pas de site, seulement les réseaux sociaux, un site gratuit (Wix, Jimdo...), vieux, pas adapté au téléphone,
// en panne ou en construction. Une entreprise qui a déjà un vrai site est écartée : on ne lui vend rien.
'use strict';
const ND = require('../chasse/nd-moteur');
const { auditer } = require('../web');
const { parallele, court } = require('../util');
const { NOVALEMO } = require('../config');

const PAR_PASSAGE = 12;

// Une entreprise, un prospect : ses agences (même site) et ses autres fiches Google (même numéro) ne sont démarchées
// qu'une fois (trois emails ou trois appels à la même entreprise, c'est du démarchage en masse), et un STOP vaut pour
// toutes. Sur un annuaire ou une plateforme (une page par entreprise), le site compte chemin compris.
const PLATEFORMES = /(^|\.)(wixsite\.com|welinkbuilders\.fr|pagesjaunes\.fr|societe\.com|xn--socit-esab\.com|facebook\.com|fb\.me|instagram\.com|linktr\.ee|google\.com|goo\.gl|business\.site|jimdosite\.com|bleurouge\.fr|habitatpresto\.com|travaux\.com|starofservice\.com|kompass\.com|yelp\.fr|tripadvisor\.fr|tiktok\.com|linkedin\.com|youtube\.com|wa\.me)$/i;
const CONTACTES = ['contacte', 'relance', 'repondu', 'interesse', 'client', 'perdu'];
function cleSite(url) {
  if (!url) return null;
  try {
    const u = new URL(/^https?:/i.test(url) ? url : 'https://' + url);
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!/\./.test(h)) return null;
    if (PLATEFORMES.test(h)) { const ch = u.pathname.replace(/\/+$/, '').toLowerCase(); return ch ? h + ch : null; }
    return h;
  } catch (e) { return null; }
}
// le numéro sans indicatif ni zéro (les 9 derniers chiffres) : « +596 596 31 03 00 », « 0596 31 03 00 » et
// « +33 5 96 31 03 00 » sont le même
function cleTel(t) { const d = String(t || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : null; }
// les mots d'un nom qui désignent l'entreprise (pas son métier, sa commune ni sa forme juridique) : deux fiches au même
// site n'en sont qu'une si leurs noms se rejoignent (« Plomberie Dom Lézarde » et « Plomberie Dom Ducos ») ; trois
// entreprises qu'un blog sans rapport a rangées sous la même adresse restent trois
const MOTS_VIDES = new Set(('martinique antilles caraibes caraibe guadeloupe agence agences groupe societe compagnie sarl sas sasu eurl ets etablissements entreprise entreprises services service centre cabinet atelier ' +
  'plomberie plombier climatisation clim froid electricite electricien electrique menuiserie nettoyage transport transports location securite piscine piscines imprimerie auto moto ecole garage depannage ' +
  'renovation batiment travaux jardin jardins paysagiste peinture carrelage maconnerie informatique conseil immobilier energie energies solaire fermetures aluminium alu magasin boutique ' +
  'fort france lamentin ducos schoelcher francois trinite robert riviere salee pilote sainte saint anne luce marin diamant vauclin morne rouge case carbet lorrain marigot basse pointe esprit joseph ' +
  'place armes dillon bourg anse madame point rond gouraud zone industrielle californie lezarde').split(' '));
function motsDe(nom) { return String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(function (m) { return m.length >= 3 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m); }); }
// un numéro de Martinique (fixe ou portable) est celui d'une entreprise ; un numéro national partagé (0820, 09...) ne
// rapproche deux fiches que si leurs noms se rejoignent
function telLocal(k) { return /^(596|696|697)/.test(k || ''); }
// les fiches à ne pas démarcher, chacune avec celle qu'on garde : la déjà écrite, sinon celle qui a son aperçu, sinon
// celle qu'on peut écrire, sinon la plus ancienne. Une fiche déjà écrite n'est jamais touchée.
function doublons(leads, ecrits) {
  ecrits = ecrits || new Set();
  const parent = {};
  const racine = function (x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const pourquoi = {};
  const mots = {};
  leads.forEach(function (l) { parent[l.id] = l.id; mots[l.id] = motsDe(l.name); });
  const seRejoignent = function (a, b) { return mots[a.id].some(function (m) { return mots[b.id].indexOf(m) >= 0; }); };
  const unir = function (a, b, raison) { const x = racine(a.id), y = racine(b.id); if (x === y) return; parent[y] = x; pourquoi[b.id] = pourquoi[b.id] || raison; pourquoi[a.id] = pourquoi[a.id] || raison; };
  const parCle = {};
  leads.forEach(function (l) {
    const email = String(l.email || '').trim().toLowerCase();
    [['site', cleSite(l.website)], ['tel', cleTel(l.phone)], ['email', email || null]].forEach(function (c) {
      if (!c[1]) return;
      const k = c[0] + ':' + c[1];
      (parCle[k] = parCle[k] || []).forEach(function (o) {
        const memeEmail = email && String(o.email || '').trim().toLowerCase() === email;
        const ok = c[0] === 'email' || (c[0] === 'tel' ? (telLocal(c[1]) || seRejoignent(l, o)) : (seRejoignent(l, o) || memeEmail));
        if (ok) unir(o, l, c[0] === 'site' ? 'même site' : c[0] === 'tel' ? 'même numéro' : 'même adresse email');
      });
      parCle[k].push(l);
    });
  });
  const groupes = {};
  leads.forEach(function (l) { const r = racine(l.id); (groupes[r] = groupes[r] || []).push(l); });
  const ecrit = function (l) { return ecrits.has(l.id) || CONTACTES.indexOf(l.status) >= 0; };
  const ORDRE = ['a_contacter', 'brouillon', 'a_appeler', 'nouveau', 'sans_contact'];
  const rang = function (l) { return [ecrit(l) ? 0 : 1, l.apercu_etat === 'publie' || l.site_id ? 0 : 1, ORDRE.indexOf(l.status) < 0 ? 9 : ORDRE.indexOf(l.status), l.id]; };
  const avant = function (a, b) { const x = rang(a), y = rang(b); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; };
  const out = new Map();
  Object.keys(groupes).forEach(function (r) {
    const g = groupes[r];
    if (g.length < 2) return;
    g.sort(avant);
    const garde = g[0], stop = g.find(function (x) { return x.status === 'stop'; });
    g.slice(1).forEach(function (l) {
      if (ecrit(l) || l.status === 'stop') return;
      out.set(l.id, { garde: garde, stop: stop || null, raison: (stop ? 'STOP demandé par la même entreprise (« ' + stop.name + ' », #' + stop.id + ')' : 'même entreprise que « ' + garde.name + ' » (#' + garde.id + ', ' + (pourquoi[l.id] || 'même site') + ') : on ne la démarche qu\'une fois') });
    });
  });
  return out;
}

async function enrichirUn(l, sup, prudence) {
  const patch = { updated_at: new Date().toISOString() };
  // Novalemo ne prospecte que la Martinique : le reste est écarté avec la raison, sans visite ni recherche
  if (l.island && NOVALEMO.iles.indexOf(l.island) < 0) return Object.assign(patch, { status: 'ecarte', reason: ((l.reason ? l.reason + ' ; ' : '') + 'hors zone : Novalemo ne prospecte que la ' + NOVALEMO.zone).slice(0, 400) });
  const data = Object.assign({}, l.data || {});
  let email = l.email || null, source = l.email_source || null;
  let etat = l.site_state;
  let score = l.score || 50;
  const raisons = [];
  if (l.website && etat !== 'aucun' && etat !== 'reseau') {
    const a = await auditer(l.website);
    data.audit = { etat: a.etat, qualite: a.qualite || null, https: a.https, mentions_legales: a.mentions_legales, mobile: a.mobile, gratuit: a.gratuit, annee: a.annee, outil: a.outil, defauts: a.defauts || [], titre: a.titre || null };
    etat = a.qualite || (a.etat === 'site' ? 'correct' : a.etat);
    if (a.etat === 'erreur') { etat = 'erreur'; raisons.push('site injoignable'); score += 6; }
    if (!email && a.emails && a.emails.length) { email = a.emails[0]; source = 'site'; }
    if (a.etat === 'site') {
      if (!a.mentions_legales) { score += 14; raisons.push('pas de mentions légales'); }
      if (etat === 'douteux') { score += 10; raisons.push((a.defauts || []).slice(0, 2).join(', ')); }
      // un vrai site, récent, sur téléphone, en https : on ne démarche pas (même sans mentions légales, ce n'est pas notre client)
      if (etat === 'correct') { score = Math.min(score, 25); raisons.push('a déjà un vrai site'); }
    } else if (['parking', 'construction', 'vide'].indexOf(a.etat) >= 0) { score += 12; raisons.push('pas de vrai site en ligne'); }
  }
  // plus jamais d'adresse devinée (contact@ du domaine) : la moitié n'existent pas, et chaque rebond abîme la boîte
  // d'envoi. Sans adresse vue sur son site ou sa fiche, le prospect passe en appel (ou en WhatsApp) s'il a un numéro.
  void prudence;
  if (email && sup.has(email.toLowerCase())) { patch.status = 'stop'; email = null; }
  patch.email = email; patch.email_source = email ? source : null; patch.site_state = etat || null;
  patch.score = Math.max(1, Math.min(99, Math.round(score)));
  if (raisons.length) patch.reason = [l.reason, raisons.filter(Boolean).join(', ')].filter(Boolean).join(' ; ').slice(0, 400);
  if (!patch.status) {
    if (etat === 'correct') patch.status = 'ecarte';
    else if (email) patch.status = 'a_contacter';
    else if (l.phone) patch.status = 'a_appeler';
    else patch.status = 'sans_contact';
  }
  data.enrichi_le = patch.updated_at;
  patch.data = data;
  return patch;
}

async function run(ctx) {
  const db = ctx.db;
  const rows = await db.select('hq_leads', { eq: { status: 'nouveau' }, order: ['score.desc', 'id.asc'], limit: PAR_PASSAGE });
  if (!rows.length) return { resume: 'Aucun prospect brut à traiter.', produit: 0, prochain_min: 120 };
  const sup = new Set((await db.select('hq_suppression', { select: 'email' })).map(function (x) { return x.email; }));
  // ses autres fiches d'abord : une entreprise déjà dans la file n'est pas auditée ni démarchée une seconde fois
  const tous = await db.select('hq_leads', { select: 'id,name,phone,website,email,status,site_id,apercu_etat', not_in: { status: ['ecarte'] }, limit: 5000 }).catch(function () { return []; });
  const ecrits = new Set((await db.select('hq_outbox', { select: 'lead_id', eq: { kind: 'prospection', status: 'envoye' }, limit: 5000 }).catch(function () { return []; })).map(function (o) { return o.lead_id; }));
  const doubles = doublons(tous, ecrits);
  const restants = [];
  let doubles_n = 0;
  for (const l of rows) {
    const d = doubles.get(l.id);
    if (!d) { restants.push(l); continue; }
    await db.update('hq_leads', { status: d.stop ? 'stop' : 'ecarte', reason: court(d.raison + (l.reason ? ' ; ' + l.reason : ''), 400), updated_at: new Date().toISOString() }, { eq: { id: l.id, status: 'nouveau' } });
    doubles_n++;
  }
  rows.length = 0; restants.forEach(function (l) { rows.push(l); });
  const bo = await db.one('hq_config', { eq: { key: 'boite' } });
  const prudence = !!(bo && bo.value && bo.value.adresses_vues_jusqua && new Date(bo.value.adresses_vues_jusqua) > new Date());
  const res = { a_contacter: 0, a_appeler: 0, sans_contact: 0, ecarte: 0, stop: 0, erreurs: 0 };
  await parallele(rows, 4, async function (l) {
    if (Date.now() > ctx.limite - 15000) return;
    try {
      const patch = await enrichirUn(l, sup, prudence);
      await db.update('hq_leads', patch, { eq: { id: l.id } });
      res[patch.status] = (res[patch.status] || 0) + 1;
    } catch (e) {
      res.erreurs++;
      await db.update('hq_leads', { status: 'sans_contact', reason: ((l.reason || '') + ' ; erreur d\'enrichissement').slice(0, 400) }, { eq: { id: l.id } }).catch(function () {});
    }
  });
  const faits = rows.length - res.erreurs;
  res.doublons = doubles_n;
  return {
    resume: faits + ' prospect(s) traité(s) : ' + res.a_contacter + ' à contacter (email), ' + res.a_appeler + ' à appeler, ' + res.sans_contact + ' sans contact, ' + res.ecarte + ' écarté(s)' + (doubles_n ? ' ; ' + doubles_n + ' autre(s) fiche(s) d\'une entreprise déjà dans la file, écartée(s)' : ''),
    produit: res.a_contacter, detail: res, prochain_min: rows.length + doubles_n >= PAR_PASSAGE ? 15 : null
  };
}

module.exports = { run, enrichirUn, doublons, cleSite, cleTel };
