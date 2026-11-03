// Noé, Démo-maker : pour chaque bon prospect de Martinique qui a un email, fabrique d'avance l'aperçu de SON site
// (ses vrais services s'il a un site, ses photos et son logo, sa couleur), le publie, et le lien part dans le
// premier email. Les prospects qui ont répondu et à qui on a promis un aperçu passent en premier.
'use strict';
const crypto = require('crypto');
const V = require('../sites/vercel');
const P = require('../sites/publication');
const A = require('../sites/atelier');
const PH = require('../sites/photos');
const R = require('../sites/rendu');
const { NOVALEMO } = require('../config');
const { minuitGP, court } = require('../util');

const PAR_PASSAGE = 3;
const iso = function () { return new Date().toISOString(); };

function slugPour(nom) { return R.slugifier(nom).slice(0, 40).replace(/-+$/, '') + '-' + crypto.randomBytes(3).toString('hex').slice(0, 4); }

// Images du site actuel envoyées chez Vercel (une fois par empreinte) et rangées dans la fiche
async function poserImages(spec, lu) {
  if (!lu) return spec;
  const out = [];
  for (let k = 0; k < lu.photos.length; k++) {
    const p = lu.photos[k];
    try { const up = await V.envoyerFichier(p.data); out.push({ fichier: 'p' + (k + 1) + '.' + PH.ext(p.type), sha: up.sha, taille: up.size, l: p.l, h: p.h, alt: court(p.alt || spec.nom, 120), source: p.url }); } catch (e) { /* image ratée : on continue */ }
  }
  spec.photos = out;
  if (lu.logo) {
    try { const up = await V.envoyerFichier(lu.logo.data); spec.logo = { fichier: 'logo.' + PH.ext(lu.logo.type), sha: up.sha, taille: up.size, l: lu.logo.l, h: lu.logo.h, alt: spec.nom, source: lu.logo.url }; } catch (e) { /* sans logo */ }
  }
  if (lu.couleur && !spec.accent) spec.accent = lu.couleur;
  if (spec.photos.length >= 3 && spec.composition !== 'photo') spec.composition = 'photo';
  return spec;
}

async function fabriquer(db, lead, ctx) {
  await db.update('hq_leads', { apercu_etat: 'en_cours', updated_at: iso() }, { eq: { id: lead.id } });
  let lu = null;
  if (lead.website && ['aucun', 'reseau', 'erreur', 'parking', 'construction', 'vide'].indexOf(lead.site_state) < 0) lu = await PH.lireSite(lead.website).catch(function () { return null; });
  const r = await A.ecrire(lead, { texteSite: lu && lu.texte, photos: lu ? lu.photos.length : 0, logo: !!(lu && lu.logo), couleur: lu && lu.couleur, tier: 'smart' });
  const spec = await poserImages(r.spec, lu);
  const slug = slugPour(spec.nom || lead.name);
  const ins = await db.insert('hq_sites', { lead_id: lead.id, slug: slug, status: 'brouillon', spec: spec, version: 1, data: { par: 'demo', cout_usd: Math.round(r.cout * 10000) / 10000, modele: r.model, problemes: r.problemes.slice(0, 6), site_lu: lu ? lu.url : null } });
  const site = ins[0];
  const d = Object.assign({}, lead.data || {});
  await db.update('hq_leads', { apercu_etat: 'pret', site_id: site.id, data: d, updated_at: iso() }, { eq: { id: lead.id } });
  return { site: site, cout: r.cout, usage: r.usage, model: r.model };
}

async function run(ctx) {
  const db = ctx.db;
  if (!V.branche()) return { resume: 'Hébergement des aperçus non branché (HQ_VERCEL_TOKEN) : les emails partent sans aperçu en attendant.', produit: 0, prochain_min: 720 };
  if (ctx.peutDepenser && !ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint : je reprends demain.', produit: 0, prochain_min: 240 };
  const faitsAujourdhui = await db.count('hq_sites', { gte: { created_at: minuitGP().toISOString() } });
  const plafond = Number((ctx.budget && ctx.budget.apercus_jour) || 12);
  if (faitsAujourdhui >= plafond) return { resume: 'Plafond du jour atteint (' + faitsAujourdhui + ' aperçus).', produit: 0, prochain_min: 240 };
  // d'abord les aperçus promis à des prospects qui ont répondu, puis les meilleurs prospects à contacter,
  // sans dépasser ce que la boîte peut envoyer (un aperçu qui attend des semaines ne sert à rien)
  const promis = await db.select('hq_leads', { eq: { apercu_etat: 'demande' }, not_in: { status: ['stop', 'ecarte', 'perdu'] }, order: 'updated_at.asc', limit: PAR_PASSAGE });
  const enStock = await db.count('hq_leads', { eq: { apercu_etat: 'publie', status: 'a_contacter' } });
  const stockMax = Math.max(6, 2 * Number((ctx.budget && ctx.budget.emails_jour) ? Math.min(ctx.budget.emails_jour, 12) : 8));
  const assez = enStock >= stockMax;
  const file = promis.concat(promis.length >= PAR_PASSAGE || assez ? [] : await db.select('hq_leads', { eq: { status: 'a_contacter' }, in: { island: NOVALEMO.iles }, not_in: { source: ['partenaires'] }, is: { apercu_etat: null }, gte: { score: 45 }, order: ['score.desc', 'id.asc'], limit: PAR_PASSAGE - promis.length }));
  if (!file.length) {
    const pub = await P.suivre(db, {}).catch(function (e) { return { resume: e.message }; });
    return { resume: (assez ? enStock + ' aperçus prêts attendent leur email : j\'en refais quand le stock baisse. ' : 'Aucun prospect en attente d\'aperçu. ') + (pub.resume || ''), produit: 0, prochain_min: 90 };
  }
  let cout = 0, faits = 0, modele = null;
  const usage = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const noms = [], echecs = [];
  for (const lead of file.slice(0, Math.max(0, plafond - faitsAujourdhui))) {
    if (Date.now() > ctx.limite - 70000) break;
    if (ctx.peutDepenser && !ctx.peutDepenser()) break;
    try {
      const r = await fabriquer(db, lead, ctx);
      cout += r.cout; modele = r.model; faits++; noms.push(r.site.spec.nom);
      Object.keys(usage).forEach(function (k) { usage[k] += r.usage[k] || 0; });
    } catch (e) {
      echecs.push(lead.name + ' (' + court(String(e.message || e), 80) + ')');
      await db.update('hq_leads', { apercu_etat: 'echec', updated_at: iso() }, { eq: { id: lead.id } });
    }
  }
  let pub = null;
  if (faits) {
    pub = await P.publier(db, { raison: faits + ' aperçu(s)' }).catch(function (e) { return { resume: 'Publication : ' + e.message }; });
    if (pub && pub.publie && Date.now() < ctx.limite - 40000) pub = Object.assign(pub, { suivi: await P.suivre(db, { attendre: true }).catch(function () { return null; }) });
  }
  const resume = faits + ' aperçu(s) fabriqué(s)' + (noms.length ? ' : ' + noms.join(', ') : '') + (echecs.length ? '. Raté : ' + echecs.join(' ; ') : '') + (pub ? '. ' + (pub.suivi && pub.suivi.pret ? 'En ligne.' : pub.resume) : '');
  return { resume: resume, produit: faits, cout: cout, usage: usage, modele: modele, erreur: !faits && echecs.length > 0, prochain_min: file.length >= PAR_PASSAGE ? 20 : null, detail: { faits: noms, echecs: echecs } };
}

module.exports = { run, fabriquer, slugPour };
