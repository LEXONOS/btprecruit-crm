// Marcus, Fournisseur de contacts : prend les prospects bruts, audite le site, trouve l'email de
// l'entreprise (jamais celui d'un tiers), vérifie que le domaine reçoit des mails, classe et note.
// Cible : pas de site, seulement les réseaux sociaux, un site gratuit (Wix, Jimdo...), vieux, pas adapté au téléphone,
// en panne ou en construction. Une entreprise qui a déjà un vrai site est écartée : on ne lui vend rien.
'use strict';
const ND = require('../chasse/nd-moteur');
const { auditer } = require('../web');
const { parallele } = require('../util');
const { NOVALEMO } = require('../config');

const PAR_PASSAGE = 12;

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
  return {
    resume: faits + ' prospect(s) traité(s) : ' + res.a_contacter + ' à contacter (email), ' + res.a_appeler + ' à appeler, ' + res.sans_contact + ' sans contact, ' + res.ecarte + ' écarté(s)',
    produit: res.a_contacter, detail: res, prochain_min: rows.length === PAR_PASSAGE ? 15 : null
  };
}

module.exports = { run, enrichirUn };
