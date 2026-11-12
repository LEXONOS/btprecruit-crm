// Chloé depuis le 12 nov. 2026 : le premier email de Novalemo n'est plus écrit par l'IA, c'est le message de Louis
// (lib/accroche.js), rempli avec les faits du prospect (son nom, sa commune, ses avis Google, son site ou pas) et le lien
// de SON aperçu. Zéro coût, zéro dérapage de ton. Elle écrit juste assez d'avance pour la boîte (deux jours d'envois),
// seulement pour un prospect de Martinique dont l'adresse a été lue (jamais devinée), qui n'a encore rien reçu, et dont
// l'aperçu a passé le seuil d'envoi de Miranda.
'use strict';
const A = require('../accroche');
const { NOVALEMO } = require('../config');
const { court } = require('../util');

const iso = function () { return new Date().toISOString(); };
const PAR_PASSAGE = 12;

async function run(ctx) {
  const db = ctx.db, budget = ctx.budget || {};
  if (await require('../sites/phase').enTest(db)) return { resume: 'Phase de test des sites : aucun premier email pour l\'instant.', produit: 0 };
  const P = require('../sites/publication'), B = require('./boite'), CR = require('./critique');
  const pub = await P.lireEtat(db).catch(function () { return {}; });
  const hote = pub.hote || pub.hote_vercel;
  if (!hote) return { resume: 'Les aperçus ne sont pas encore publiés : rien à écrire.', produit: 0 };
  // assez d'avance pour deux jours d'envoi, jamais plus (un email écrit trop tôt vieillit dans la file)
  const etat = await B.lireEtat(db);
  const quota = B.quota(etat, budget);
  const enFile = await db.count('hq_outbox', { in: { status: ['pret', 'a_valider'], kind: ['prospection'] } });
  const place = Math.max(0, Math.min(PAR_PASSAGE, quota * 2 - enFile));
  if (!place) return { resume: enFile + ' premier(s) email(s) attendent déjà de partir : j\'écris la suite quand la file baisse.', produit: 0, prochain_min: 120 };
  const auto = !!budget.envoi_auto;
  const leads = await db.select('hq_leads', { eq: { status: 'a_contacter', apercu_etat: 'publie' }, order: 'score.desc', limit: 300 });
  const faits = [], attente = [], ecartes = [];
  for (const l of leads) {
    if (faits.length >= place) break;
    const adresse = String(l.email || '').trim().toLowerCase();
    if (!adresse || !/@/.test(adresse)) continue;
    if (l.email_source === 'devine') { await db.update('hq_leads', { status: l.phone ? 'a_appeler' : 'sans_contact', reason: court('Adresse email devinée, pas vue sur son site. ' + (l.reason || ''), 300), updated_at: iso() }, { eq: { id: l.id, status: 'a_contacter' } }); ecartes.push(l.name + ' (adresse devinée)'); continue; }
    if (l.island && NOVALEMO.iles.indexOf(l.island) < 0) continue;
    if (await db.one('hq_suppression', { eq: { email: adresse } })) { await db.update('hq_leads', { status: 'stop', updated_at: iso() }, { eq: { id: l.id } }); continue; }
    if (!l.site_id) continue;
    const site = await db.one('hq_sites', { eq: { id: l.site_id }, select: 'id,slug,status,version,spec,data' });
    if (!site || site.status !== 'apercu' || !site.slug) continue;
    const pp = CR.peutPartir(site, budget);
    if (!pp.ok) { attente.push(l.name + ' : ' + pp.raison); continue; }
    // un seul premier email par entreprise et par adresse (une entreprise trouvée deux fois)
    const deja = await db.select('hq_outbox', { select: 'id', eq: { lead_id: l.id }, not_in: { status: ['annule', 'erreur'] }, limit: 1 });
    if (deja.length) continue;
    const meme = await db.select('hq_outbox', { select: 'id', eq: { to_email: adresse, kind: 'prospection' }, not_in: { status: ['annule', 'erreur'] }, limit: 1 });
    if (meme.length) { await db.update('hq_leads', { status: 'ecarte', reason: 'doublon d\'adresse : l\'entreprise a déjà reçu un email sous une autre fiche', updated_at: iso() }, { eq: { id: l.id } }); ecartes.push(l.name + ' (doublon)'); continue; }
    const url = P.urlApercu(hote, site.slug);
    const m = A.premier(l, site, url);
    await db.insert('hq_outbox', { lead_id: l.id, agent_id: (ctx.agent && ctx.agent.id) || 'redacteur', to_email: adresse, subject: court(m.objet, 120), body: m.corps, step: 1, angle: 'v:L ' + m.situation, status: auto ? 'pret' : 'a_valider', kind: 'prospection' }, { returning: false });
    await db.update('hq_leads', { status: 'brouillon', updated_at: iso() }, { eq: { id: l.id, status: 'a_contacter' } });
    if (ctx.compteurs) ctx.compteurs.emails = (ctx.compteurs.emails || 0) + 1;
    faits.push(l.name);
  }
  const resume = faits.length
    ? faits.length + ' premier(s) email(s) écrit(s) avec le message de Louis (99 €)' + (auto ? ', ils partent au rythme de la boîte' : ', ils attendent ta validation') + '.'
    : 'Aucun prospect prêt à recevoir son premier email' + (attente.length ? ' (' + attente.length + ' aperçu(s) attendent le verdict de Miranda)' : '') + '.';
  return { resume: resume, produit: faits.length, detail: { ecrits: faits, en_attente: attente.slice(0, 8), ecartes: ecartes }, prochain_min: faits.length ? 60 : 120 };
}

module.exports = { run, PAR_PASSAGE };
