// Noé, Démo-maker : pour chaque bon prospect de Martinique qui a un email, fabrique d'avance l'aperçu de SON site
// (ses vrais services s'il a un site, ses photos et son logo, sa couleur), sur le modèle qui va avec son métier. Léa
// choisit les photos du métier quand il n'en a pas, Margot cherche son entreprise dans le registre officiel pour les
// mentions légales, Iris relit ; le lien part dans le premier email. Les aperçus promis à des prospects qui ont répondu
// passent en premier.
'use strict';
const crypto = require('crypto');
const V = require('../sites/vercel');
const P = require('../sites/publication');
const A = require('../sites/atelier');
const PH = require('../sites/photos');
const IM = require('../sites/images');
const J = require('../sites/juridique');
const M = require('../sites/modeles');
const DN = require('../sites/donne');
const DR = require('../sites/direction');
const R = require('../sites/rendu');
const C = require('../sites/composition');
const PH8 = require('../sites/phase');
const { NOVALEMO } = require('../config');
const { minuitGP, court } = require('../util');

const PAR_PASSAGE = 3;
const iso = function () { return new Date().toISOString(); };

function slugPour(nom) { return R.slugifier(nom).slice(0, 40).replace(/-+$/, '') + '-' + crypto.randomBytes(3).toString('hex').slice(0, 4); }

// Images du site actuel envoyées chez Vercel (une fois par empreinte) et rangées dans la fiche
async function poserImages(spec, lu) {
  spec.photos = spec.photos || [];
  if (!lu) return spec;
  const out = [];
  for (let k = 0; k < lu.photos.length; k++) {
    const p = lu.photos[k];
    try { const up = await V.envoyerFichier(p.data); out.push({ fichier: 'p' + (k + 1) + '.' + PH.ext(p.type), sha: up.sha, taille: up.size, l: p.l, h: p.h, alt: court(p.alt || spec.nom, 120), source: p.url }); } catch (e) { /* image ratée : on continue */ }
  }
  spec.photos = out;
  if (out.length) spec.provenance = Object.assign({}, spec.provenance || {}, { photos: 'site' });
  if (lu.logo) {
    try { const up = await V.envoyerFichier(lu.logo.data); spec.logo = { fichier: 'logo.' + PH.ext(lu.logo.type), sha: up.sha, taille: up.size, l: lu.logo.l, h: lu.logo.h, alt: spec.nom, source: lu.logo.url }; } catch (e) { /* sans logo */ }
  }
  if (lu.couleur && !spec.accent) spec.accent = lu.couleur;
  return spec;
}
// Pas (assez) de photos à lui : Léa choisit des photos du métier, jamais celles déjà prises par un voisin du même métier.
// Ses photos à lui restent devant ; les places qu'elles occupent déjà (haut de page, présentation) ne sont pas doublées.
async function poserIllustrations(spec, eviter, graine, opts) {
  opts = opts || {};
  const siennes = (spec.photos || []).filter(function (p) { return p && p.fichier && !p.credit; });
  const sauf = siennes.length >= 2 ? ['hero', 'apropos'] : siennes.length ? ['hero'] : [];
  const r = await IM.choisir(spec, { eviter: eviter, graine: graine, peutDepenser: opts.peutDepenser, sauf: sauf }).catch(function (e) { return { photos: [], erreur: e.message, cout: 0 }; });
  const out = [];
  for (let k = 0; k < r.photos.length; k++) {
    const p = r.photos[k];
    // la description de Léa (ce qu'on voit) sert de texte alternatif et se lit dans la tour
    try { const up = await V.envoyerFichier(p.data); out.push({ fichier: 'i' + (k + 1) + '.' + PH.ext(p.type), sha: up.sha, taille: up.size, l: p.l, h: p.h, alt: court(p.desc || '', 140), credit: p.credit, role: p.role, pour: p.pour, pour_titre: p.pour_titre || undefined, note: p.note || undefined, source: p.url || null }); } catch (e) { /* image ratée : on continue */ }
  }
  if (out.length) {
    spec.photos = siennes.concat(out).slice(0, 12);
    spec.photo_ids = out.map(function (p) { return p.credit.id; });
    spec.provenance = Object.assign({}, spec.provenance || {}, { photos: siennes.length ? ((spec.provenance && spec.provenance.photos) || 'site') : 'banque' });
  }
  return { spec: spec, source: out.length ? r.source : null, erreur: r.erreur || null, reessai: typeof r.reessai === 'number' ? r.reessai : null, cout: r.cout || 0, usage: r.usage || null, notes: r.notes || null };
}
// Ce que Léa retient d'un passage : fait, ou à reprendre (pas encore de clé, quota de l'heure, budget du jour, regard en panne)
function etatPhotos(illus, par, siennes) {
  const e = { v: IM.VERSION, le: iso(), par: par };
  if (!illus) return Object.assign(e, { source: siennes ? 'site' : null });
  Object.assign(e, { source: illus.source, erreur: illus.erreur || null, notes: illus.notes || null });
  if (typeof illus.reessai === 'number') e.reessai = iso(Date.now() + illus.reessai * 60000);
  return e;
}
// Les sites voisins (même commune, ou même famille de métier : les photos sont choisies par métier), ces quatre derniers
// mois : leurs donnes et les photos de banque qu'ils ont déjà
async function voisins(db, spec, sauf) {
  const depuis = new Date(Date.now() - 120 * 86400000).toISOString();
  const sel = 'id,created_at,da:spec->da,compo:spec->compo,ids:spec->photo_ids,commune:spec->>commune,secteur:spec->>secteur';
  const recents = await db.select('hq_sites', { select: sel, gte: { created_at: depuis }, not_in: { status: ['annule'] }, order: 'id.desc', limit: 3000 }).catch(function () { return []; });
  // les sites en ligne restent des voisins, quel que soit leur âge (les photos de banque sont rangées dans spec.photo_ids)
  const enLigne = await db.select('hq_sites', { select: sel, in: { status: ['paye', 'livraison', 'en_ligne', 'pause'] }, lt: { created_at: depuis }, order: 'id.desc', limit: 3000 }).catch(function () { return []; });
  const rows = recents.concat(enLigne);
  const das = [], compos = [], photos = new Set();
  const norm = function (x) { return String(x || '').toLowerCase().trim(); };
  const famille = M.pour(spec.secteur || spec.activite || '');
  rows.forEach(function (r) {
    if (sauf && r.id === sauf) return;
    const sp = r.spec || {};
    const commune = r.commune !== undefined ? r.commune : sp.commune, secteur = r.secteur !== undefined ? r.secteur : sp.secteur;
    const memeCommune = norm(commune) && norm(commune) === norm(spec.commune);
    const memeFamille = M.pour(secteur || '') === famille;
    if (!memeCommune && !memeFamille) return;
    const da = r.da !== undefined ? r.da : sp.da;
    if (da) das.push(da);
    const cp = r.compo !== undefined ? r.compo : sp.compo;
    if (cp && cp.choix) compos.push({ id: r.id, metier: memeFamille, template: cp.template || cp.choix.template || undefined, choix: cp.choix, boutons: cp.boutons, fond: cp.fond });
    const ids = r.ids !== undefined ? r.ids : sp.photo_ids;
    (ids || []).forEach(function (id) { photos.add(id); });
    (sp.photos || []).forEach(function (p) { if (p && p.credit && p.credit.id) photos.add(p.credit.id); });
  });
  return { das: das.slice(0, 60), compos: compos.slice(0, 60), photos: photos };
}
// Direction artistique et relecture d'Iris
function diriger(spec, vs) {
  spec.da = DN.donner(spec, { recents: vs.das });
  const rv = DR.revoir(spec, { recents: vs.das });
  composer(rv.spec, vs);
  return { spec: rv.spec, revue: { v: DN.VERSION, relu: true, par: 'demo', le: new Date().toISOString(), corrections: rv.corrections, restants: rv.restants.map(function (x) { return x.message; }) } };
}
// La composition du site (les rubriques de la bibliothèque, leur rythme, leurs fonds), rangée dans la fiche : ce que le
// constructeur a demandé (spec.compo.choix) quand ça tient, jamais la même chose qu'un voisin
function composer(spec, vs) {
  const x = R.contexte({ slug: 'composition', spec: spec }, { mode: 'apercu' });
  spec.compo = C.composer(spec, x.ctx, { recents: (vs && vs.compos) || [], choix: spec.compo && spec.compo.choix, essai: (spec.compo && spec.compo.essai) || 0 });
  return spec;
}

async function fabriquer(db, lead, ctx) {
  await db.update('hq_leads', { apercu_etat: 'en_cours', updated_at: iso() }, { eq: { id: lead.id } });
  let lu = null;
  if (lead.website && ['aucun', 'reseau', 'erreur', 'parking', 'construction', 'vide'].indexOf(lead.site_state) < 0) lu = await PH.lireSite(lead.website).catch(function () { return null; });
  const r = await A.ecrire(lead, { texteSite: lu && lu.texte, photos: lu ? lu.photos.length : 0, logo: !!(lu && lu.logo), couleur: lu && lu.couleur, tier: 'smart' });
  let spec = await poserImages(r.spec, lu);
  const vs = await voisins(db, spec);
  // Léa : des photos du métier quand il n'a pas (assez) des siennes
  let illus = null;
  if ((spec.photos || []).length < 2) { illus = await poserIllustrations(spec, vs.photos, (spec.nom || lead.name) + '|' + (spec.commune || ''), { peutDepenser: ctx && ctx.peutDepenser }); spec = illus.spec; }
  // Margot : son entreprise dans le registre officiel (le client confirmera son nom officiel avant la mise en ligne)
  let jur = null;
  if (!(spec.legal && spec.legal.siren)) { jur = await J.completer(spec, lead).catch(function (e) { return { spec: spec, resume: 'registre : ' + e.message }; }); spec = jur.spec; }
  const d = diriger(spec, vs);
  spec = d.spec;
  const slug = slugPour(spec.nom || lead.name);
  const cout = r.cout + ((illus && illus.cout) || 0);
  const ins = await db.insert('hq_sites', { lead_id: lead.id, slug: slug, status: 'brouillon', spec: spec, version: 1, data: { par: 'demo', cout_usd: Math.round(cout * 10000) / 10000, modele: r.model, problemes: r.problemes.slice(0, 6), site_lu: lu ? lu.url : null, photos: etatPhotos(illus, 'demo', (spec.photos || []).length > 0), juridique: jur ? { le: iso(), resume: jur.resume } : undefined, revue: d.revue } });
  const site = ins[0];
  const dl = Object.assign({}, lead.data || {});
  await db.update('hq_leads', { apercu_etat: 'pret', site_id: site.id, data: dl, updated_at: iso() }, { eq: { id: lead.id } });
  const usage = Object.assign({}, r.usage);
  if (illus && illus.usage) Object.keys(usage).forEach(function (k) { usage[k] += illus.usage[k] || 0; });
  return { site: site, cout: cout, usage: usage, model: r.model };
}

// Une fois : les premiers aperçus du nouveau moteur, en lien, pour que Louis voie le résultat avec les vraies photos de Léa
async function annoncer(db) {
  const deja = await db.one('hq_config', { eq: { key: 'demo:premiers' } }).catch(function () { return null; });
  if (deja && deja.value && deja.value.le) return null;
  const rows = await db.select('hq_sites', { eq: { status: 'apercu' }, order: 'id.asc', limit: 200, select: 'id,url_apercu,spec' }).catch(function () { return []; });
  const v3 = rows.filter(function (s) { return s.url_apercu && s.spec && s.spec.v >= 3 && s.spec.da && s.spec.da.v >= 3; });
  if (v3.length < 6) return null;
  // un par modèle d'abord, pour voir la variété
  const M = require('../sites/modeles');
  const choix = [], vus = new Set();
  v3.forEach(function (s) { if (!vus.has(s.spec.da.modele) && choix.length < 8) { vus.add(s.spec.da.modele); choix.push(s); } });
  v3.forEach(function (s) { if (choix.indexOf(s) < 0 && choix.length < 8) choix.push(s); });
  const ligne = function (s) { const ph = (s.spec.photos || []).filter(function (p) { return p && p.fichier; }); return '- ' + s.spec.nom + ' (' + (M.MODELES[s.spec.da.modele] || {}).nom + ', ' + (ph.some(function (p) { return !p.credit; }) ? 'ses photos' : ph.length ? ph.length + ' photo(s) de Léa' : 'sans photo') + ') : ' + s.url_apercu; };
  await db.insert('hq_messages', { from_id: 'demo', to_id: 'louis', company_id: 'novalemo', kind: 'rapport', subject: 'Les premiers aperçus du nouveau moteur sont en ligne', body: 'Voici les premiers sites faits sur les nouveaux modèles, avec les photos choisies et vérifiées par Léa :\n' + choix.map(ligne).join('\n') + '\n\nIls partent avec les emails comme d\'habitude. Si un détail te gêne, dis-le : on le corrige pour tous les sites d\'un coup.' }, { returning: false });
  await db.upsert('hq_config', { key: 'demo:premiers', value: { le: iso(), sites: choix.map(function (s) { return s.id; }) }, updated_at: iso() }, { onConflict: 'key' });
  return choix.length;
}

async function run(ctx) {
  const db = ctx.db;
  if (!V.branche()) return { resume: 'Hébergement des aperçus non branché (HQ_VERCEL_TOKEN) : les emails partent sans aperçu en attendant.', produit: 0, prochain_min: 720 };
  if (ctx.peutDepenser && !ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint : je reprends demain.', produit: 0, prochain_min: 240 };
  const faitsAujourdhui = await db.count('hq_sites', { gte: { created_at: minuitGP().toISOString() } });
  const plafond = Number((ctx.budget && ctx.budget.apercus_jour) || 12);
  if (faitsAujourdhui >= plafond) return { resume: 'Plafond du jour atteint (' + faitsAujourdhui + ' aperçus), je reprends à minuit.', produit: 0, prochain_min: require('../util').jusquaDemainGP() };
  // d'abord les aperçus promis à des prospects qui ont répondu, puis les meilleurs prospects à contacter,
  // sans dépasser ce que la boîte peut envoyer (un aperçu qui attend des semaines ne sert à rien)
  const promis = await db.select('hq_leads', { eq: { apercu_etat: 'demande' }, not_in: { status: ['stop', 'ecarte', 'perdu'] }, order: 'updated_at.asc', limit: PAR_PASSAGE });
  const enStock = await db.count('hq_leads', { eq: { apercu_etat: 'publie', status: 'a_contacter' } });
  // deux jours d'envoi d'avance, au rythme que la boîte permet aujourd'hui (son palier monte avec sa santé) ; en phase de
  // test, pas de stock : on fabrique pour que Louis regarde, y compris pour ceux qu'on appellera (un numéro, pas d'email)
  const BOITE = require('./boite');
  const test = await PH8.enTest(db);
  const stockMax = Math.max(6, Math.min(80, 2 * BOITE.quota(await BOITE.lireEtat(db), ctx.budget)));
  const assez = !test && enStock >= stockMax;
  // les entreprises sans vrai site d'abord, puis celles dont le site est vraiment mauvais, puis les meilleures notes
  const candidats = promis.length >= PAR_PASSAGE || assez ? [] : await db.select('hq_leads', { in: { status: test ? ['a_contacter', 'a_appeler'] : ['a_contacter'], island: NOVALEMO.iles }, not_in: { source: ['partenaires'] }, is: { apercu_etat: null }, gte: { score: 45 }, order: ['score.desc', 'id.asc'], limit: 60 });
  // ceux qu'on pourra écrire d'abord (une vraie adresse, vue sur leur site : jamais une adresse devinée), puis pas de site,
  // puis site vraiment mauvais, puis la note
  const ecrivable = function (l) { return l.status === 'a_contacter' && l.email && l.email_source !== 'devine' ? 1 : 0; };
  candidats.sort(function (a, b) { return (ecrivable(b) - ecrivable(a)) || (PH8.rang(a) - PH8.rang(b)) || ((b.score || 0) - (a.score || 0)) || (a.id - b.id); });
  const file = promis.concat(candidats.filter(function (l) { return !test || PH8.rang(l) < 2 || l.status === 'a_contacter'; }).slice(0, PAR_PASSAGE - promis.length));
  if (!file.length) {
    const pub = await P.suivre(db, {}).catch(function (e) { return { resume: e.message }; });
    await annoncer(db).catch(function () { return null; });
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
  if (pub && pub.suivi && pub.suivi.pret) await annoncer(db).catch(function () { return null; });
  if (faits) await require('./boite').reveiller(db, 'critique', pub && pub.suivi && pub.suivi.pret ? 1 : 16).catch(function () { return null; });
  const resume = faits + ' aperçu(s) fabriqué(s)' + (noms.length ? ' : ' + noms.join(', ') : '') + (echecs.length ? '. Raté : ' + echecs.join(' ; ') : '') + (pub ? '. ' + (pub.suivi && pub.suivi.pret ? 'En ligne.' : pub.resume) : '');
  return { resume: resume, produit: faits, cout: cout, usage: usage, modele: modele, erreur: !faits && echecs.length > 0, prochain_min: file.length >= PAR_PASSAGE ? 20 : null, detail: { faits: noms, echecs: echecs } };
}

module.exports = { run, fabriquer, slugPour, poserIllustrations, voisins, diriger, composer, annoncer, etatPhotos };
