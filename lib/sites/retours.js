// Les retours d'un aperçu, sans passer par un email : le panneau de l'aperçu (panneau.js) écrit directement à la tour
// (api/apercu.js). Trois choses seulement :
//  1. des retouches : ce qu'il veut changer, élément par élément, et ses images (photos, logo), qui arrivent dans la boîte
//     d'Emma comme un message vérifié (canal « apercu ») ; elle les applique avec modifier_site et lui répond par email ;
//  2. son intérêt : ouvrir le panneau, regarder le paiement, choisir une formule, rangé dans sa fiche du CRM (le score
//     monte, Louis voit qui regarde le paiement) ; rien ne lui est écrit pour autant ;
//  3. la commande : 99 € en une fois (la seule offre depuis le 12 nov. 2026), lien de paiement Stripe créé à la demande et
//     posé sur son site (statut commande) ; Lucas relève le paiement comme pour un lien envoyé par Emma ;
//  4. « Modifier moi-même » : les textes et les photos qu'il a changés lui-même sur la page, posés dans la fiche tout de
//     suite (lib/sites/edition.js), sans IA ; Lucas republie, Emma lui propose ensuite la mise en ligne.
// Chaque aperçu porte une clé (HMAC du slug avec un secret serveur) : sans elle, rien n'est accepté. Rien n'est jamais
// renvoyé sur l'entreprise (ni email, ni téléphone, ni état) : le panneau ne reçoit que ce qu'il doit afficher.
'use strict';
const crypto = require('crypto');
const { NOVALEMO } = require('../config');
const { court, nettoie } = require('../util');
const { majFraiche } = require('../db');

const iso = function (t) { return new Date(t || Date.now()).toISOString(); };
const JOUR = 86400000;
// plafonds : de quoi envoyer toutes ses photos, pas de quoi remplir la base (par aperçu et par 24 h, par aperçu en tout,
// et pour tous les aperçus ensemble par 24 h)
const MAX_IMAGES_JOUR = 30, MAX_IMAGES_SITE = 80, MAX_IMAGES_TOUS_JOUR = 200, MAX_OCTETS = 3200000, MAX_DEMANDES_JOUR = 8, MAX_COMMANDES_JOUR = 12;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const OUVERTS = ['brouillon', 'apercu', 'commande'];

/* ── la clé d'un aperçu ── */
function secret() { return String(require('../config').SUPABASE_KEY || process.env.HQ_SESSION || process.env.HQ_RETOUR_SECRET || 'la-tour-locale'); }
function jeton(slug) { return crypto.createHmac('sha256', secret()).update('apercu|' + String(slug || '')).digest('base64url').slice(0, 24); }
function jetonOk(slug, j) {
  if (!/^[a-z0-9-]{3,80}$/.test(String(slug || '')) || typeof j !== 'string' || j.length !== 24) return false;
  const a = Buffer.from(jeton(slug)), b = Buffer.from(j);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// l'adresse de la tour, que le panneau appelle (le domaine de production du projet, posé par Vercel)
function hoteTour() { return String(process.env.HQ_RETOUR_HOTE || process.env.HQ_REGARD_HOTE || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'btprecruit-crm.vercel.app').replace(/^https?:\/\//, '').replace(/\/.*$/, ''); }
function api() { return 'https://' + hoteTour() + '/api/apercu'; }
// ce que le rendu met dans la page d'un aperçu
function pour(site) { return { api: api(), jeton: jeton(site.slug), site: site.slug }; }

/* ── ce qu'on lit d'une demande ── */
const ZONES = ['haut', 'services', 'apropos', 'galerie', 'avis', 'faq', 'contact', 'pied', 'couleurs', 'textes', 'photos', 'logo', 'autre'];
const NOMS_ZONES = { haut: 'Haut de page', services: 'Services', apropos: 'Présentation', galerie: 'Photos', avis: 'Avis', faq: 'Questions', contact: 'Contact', pied: 'Bas de page', couleurs: 'Couleurs', textes: 'Textes', photos: 'Photos', logo: 'Logo', autre: 'Autre' };
function propre(x, n) { return court(nettoie(String(x == null ? '' : x)).replace(/\s+/g, ' ').trim(), n || 600); }
function email(x) { const e = String(x || '').trim().toLowerCase(); return /^[^\s@<>"',;]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/.test(e) ? e : null; }
function tel(x) { const t = String(x || '').replace(/[^\d+]/g, ''); return t.length >= 9 && t.length <= 16 ? t : null; }
function elementsDe(liste) {
  return (Array.isArray(liste) ? liste : []).slice(0, 20).map(function (e) {
    const z = ZONES.indexOf(e && e.zone) >= 0 ? e.zone : 'autre';
    return { zone: z, nom: propre(e && e.nom, 60) || NOMS_ZONES[z], demande: propre(e && e.demande, 700) };
  }).filter(function (e) { return e.demande.length >= 2; });
}

/* ── la base ── */
async function siteDe(db, slug) {
  const s = await db.one('hq_sites', { eq: { slug: String(slug) } });
  return s && s.spec && s.spec.nom ? s : null;
}
async function reveiller(db, id, min) {
  const a = await db.one('hq_agents', { eq: { id: id }, select: 'id,status,kind,next_run_at' }).catch(function () { return null; });
  if (!a || a.kind === 'attente' || a.status === 'paused') return;
  const t = iso(Date.now() + (min || 2) * 60000);
  if (!a.next_run_at || a.next_run_at > t) await db.update('hq_agents', { next_run_at: t }, { eq: { id: id } });
}
async function noter(db, sujet, corps, kind, ref) { await db.insert('hq_messages', { from_id: 'reponses', to_id: 'louis', company_id: 'novalemo', kind: kind || 'note', subject: court(sujet, 140), body: court(corps, 900), ref: ref || null }, { returning: false }).catch(function () {}); }

/* ── 1. une image (une requête par image : le panneau les envoie l'une après l'autre) ── */
async function image(db, site, b) {
  const type = String(b.type || '').toLowerCase();
  if (!TYPES[type]) return { erreur: 'format non pris (JPEG, PNG ou WebP)' };
  let buf;
  try { buf = Buffer.from(String(b.donnees || ''), 'base64'); } catch (e) { return { erreur: 'image illisible' }; }
  if (buf.length < 1500) return { erreur: 'image vide' };
  if (buf.length > MAX_OCTETS) return { erreur: 'image trop lourde (3 Mo au plus)' };
  const d = require('./photos').dimensions(buf);
  if (!d || !d.l || !d.h) return { erreur: 'image illisible' };
  const depuis = iso(Date.now() - JOUR);
  const sha = crypto.createHash('sha1').update(buf).digest('hex');
  // la même image envoyée deux fois (double clic, nouvel essai) : la première suffit
  const deja = (await db.select('hq_fichiers', { eq: { site_id: site.id, sha: sha }, select: 'id', limit: 1 }))[0];
  if (deja) return { id: deja.id };
  if (await db.count('hq_fichiers', { eq: { site_id: site.id }, gte: { created_at: depuis } }) >= MAX_IMAGES_JOUR) return { erreur: 'beaucoup d\'images aujourd\'hui : envoyez la suite demain, ou par email' };
  if (await db.count('hq_fichiers', { eq: { site_id: site.id } }) >= MAX_IMAGES_SITE || await db.count('hq_fichiers', { gte: { created_at: depuis } }) >= MAX_IMAGES_TOUS_JOUR) return { erreur: 'nous avons déjà beaucoup d\'images : envoyez la suite par email' };
  const nom = propre(b.nom, 100).replace(/[^\w .()-]/g, '') || ('image.' + TYPES[type]);
  const logo = !!b.logo;
  const r = await db.insert('hq_fichiers', { site_id: site.id, lead_id: site.lead_id || null, inbox_id: null, nom: nom, mime: type, taille: buf.length, largeur: d.l, hauteur: d.h, sha: sha, role: logo ? 'logo' : 'photo', utilise: false, contenu: buf.toString('base64') });
  return { id: r && r[0] ? r[0].id : null };
}

/* ── 2. la demande de retouches ── */
async function retouches(db, site, b) {
  const elements = elementsDe(b.elements);
  const mot = propre(b.message, 1500);
  const ids = (Array.isArray(b.images) ? b.images : []).map(Number).filter(function (x) { return x > 0; }).slice(0, MAX_IMAGES_JOUR);
  const m = email(b.email), t = tel(b.tel), nom = propre(b.nom, 80);
  if (!elements.length && !mot && !ids.length) return { erreur: 'dites-nous ce qu\'il faut changer, ou ajoutez des images' };
  if (!m) return { erreur: 'votre email, pour vous renvoyer le site mis à jour' };
  const depuis = iso(Date.now() - JOUR);
  const recentes = (await db.select('hq_inbox', { eq: { lead_id: site.lead_id || -1 }, gte: { received_at: depuis }, select: 'id,data', limit: 50 })).filter(function (x) { return x.data && x.data.canal === 'apercu'; });
  if (recentes.length >= MAX_DEMANDES_JOUR) return { erreur: 'beaucoup de demandes aujourd\'hui : on traite déjà les précédentes' };
  // seulement ses images à lui, envoyées pour CET aperçu et pas encore rattachées à une demande
  const imgs = ids.length ? (await db.select('hq_fichiers', { in: { id: ids }, select: 'id,site_id,inbox_id,role,nom,created_at' })).filter(function (f) { return f.site_id === site.id && !f.inbox_id && f.created_at >= depuis; }) : [];
  const lead = site.lead_id ? await db.one('hq_leads', { eq: { id: site.lead_id } }) : null;
  const lignes = elements.map(function (e) { return '- ' + e.nom + ' : ' + e.demande; });
  const marques = (Array.isArray(b.logos) ? b.logos : []).map(Number);
  const nbLogo = imgs.filter(function (f) { return marques.indexOf(f.id) >= 0; }).length, nbPhotos = imgs.length - nbLogo;
  const corps = ['Demande envoyée depuis le panneau de l\'aperçu de ' + site.spec.nom + '.', '',
    lignes.length ? 'Ce qu\'il veut changer :\n' + lignes.join('\n') : null,
    mot ? (lignes.length ? '\n' : '') + 'Son message :\n' + mot : null,
    imgs.length ? '\nImages jointes : ' + [nbPhotos ? nbPhotos + ' photo(s) pour le site' : null, nbLogo ? 'son logo' : null].filter(Boolean).join(' et ') + '.' : null,
    t ? '\nSon téléphone : ' + t : null].filter(function (x) { return x !== null; }).join('\n');
  // le lien d'un aperçu pas encore payé n'a été envoyé qu'à lui : sa demande vaut un message de notre fil ; une page restée
  // ouverte après le paiement ne touche plus au site payé sans passer par son adresse (Emma le lui dit)
  const confiance = OUVERTS.indexOf(site.status) >= 0 ? 'apercu' : 'douteux';
  const ib = (await db.insert('hq_inbox', { lead_id: site.lead_id || null, outbox_id: null, from_email: m, from_name: nom || null, subject: 'Retouches de l\'aperçu : ' + court(site.spec.nom, 80), body: corps, kind: 'reponse', intent: null, status: 'nouveau',
    data: { canal: 'apercu', confiance: confiance, site_id: site.id, elements: elements, images: imgs.map(function (f) { return f.id; }), tel: t || null, pieces: imgs.map(function (f) { return { nom: f.nom }; }) }, received_at: iso() }))[0];
  if (imgs.length) await db.update('hq_fichiers', { inbox_id: ib.id }, { in: { id: imgs.map(function (f) { return f.id; }) } });
  // ce qu'il a marqué comme son logo dans le panneau (le reste : des photos pour le site)
  const vraisLogos = imgs.filter(function (f) { return marques.indexOf(f.id) >= 0; }).map(function (f) { return f.id; });
  const photos = imgs.filter(function (f) { return marques.indexOf(f.id) < 0 && f.role === 'logo'; }).map(function (f) { return f.id; });
  if (vraisLogos.length) await db.update('hq_fichiers', { role: 'logo' }, { in: { id: vraisLogos } });
  if (photos.length) await db.update('hq_fichiers', { role: 'photo' }, { in: { id: photos } });
  if (lead) {
    const patch = { updated_at: iso() };
    if (['interesse', 'client', 'stop'].indexOf(lead.status) < 0) patch.status = 'repondu';
    // un prospect qu'on ne pouvait joindre que par téléphone donne son email : on le garde pour lui répondre
    if (!lead.email) { patch.email = m; patch.email_source = 'apercu'; }
    if (t && !lead.phone) patch.phone = t;
    await db.update('hq_leads', patch, { eq: { id: lead.id } });
    // il a répondu : plus de relance de prospection
    await db.update('hq_outbox', { status: 'annule', error: 'le prospect a répondu (panneau de l\'aperçu)', updated_at: iso() }, { eq: { lead_id: lead.id, status: 'pret' }, in: { kind: ['prospection', 'relance'] } }).catch(function () {});
  }
  await noter(db, 'Retouches demandées sur l\'aperçu : ' + site.spec.nom, corps + '\n\n(Emma s\'en occupe, rien à faire.)', 'note', { inbox_id: ib.id, lead_id: site.lead_id || null });
  await reveiller(db, 'reponses', 1);
  return { ok: true };
}

/* ── 2. son intérêt : il ouvre le panneau, regarde le paiement, choisit une formule ── */
// trois paliers, rangés dans sa fiche (data.interet) et dans son score : le CRM met en avant ceux qui regardent. Son statut
// ne bouge pas (les relances continuent tant qu'il n'a rien dit ni payé) ; Louis est prévenu une fois, au premier regard
// sur le paiement
const PALIERS = { retouches: 1, commande: 2, formule: 3 };
const SCORES = [0, 80, 90, 95];
const NOMS_PALIERS = ['', 'a ouvert le panneau de son aperçu', 'a regardé le paiement', 'a choisi une formule'];
// (14 nov. 2026) le prospect a vraiment regardé son aperçu : le panneau l'envoie après un geste (défiler, toucher), au
// moins quatre secondes après l'ouverture, jamais depuis la tour (?tour=1). Rangé dans sa fiche (data.vues), son score
// monte un peu, et Louis est prévenu la première fois : c'est le moment de l'appeler. Son statut ne bouge pas (les
// relances continuent tant qu'il n'a rien dit).
async function vuPage(db, site) {
  if (!site.lead_id || OUVERTS.indexOf(site.status) < 0) return { ok: true };
  const jour = iso().slice(0, 10);
  let premier = false;
  const l = await majFraiche(db, 'hq_leads', site.lead_id, function (f) {
    const d = f.data || {}, v0 = d.vues || {};
    if (v0.jour === jour && (v0.fois_jour || 0) >= 30) return null;
    premier = !v0.n;
    const vues = { n: (v0.n || 0) + 1, premier_le: v0.premier_le || iso(), dernier_le: iso(), jour: jour, fois_jour: (v0.jour === jour ? v0.fois_jour || 0 : 0) + 1 };
    return { data: Object.assign({}, d, { vues: vues }), score: Math.max(Number(f.score) || 0, 70) };
  });
  if (l && premier) {
    const nomSite = String((site.spec && site.spec.nom) || l.name || '').replace(/\*\*/g, '');
    const tel = l.phone ? ' Son numéro : ' + l.phone + '.' : '';
    await noter(db, nomSite + ' a ouvert son aperçu', nomSite + (l.commune ? ' (' + l.commune + ')' : '') + ' vient de regarder le site préparé pour lui. C\'est le meilleur moment pour l\'appeler ou lui écrire sur WhatsApp, pendant qu\'il l\'a en tête.' + tel + ' Les relances continuent tant qu\'il ne répond pas.', 'note', { lead_id: l.id, site_id: site.id });
  }
  return { ok: true };
}
async function vu(db, site, b) {
  if (b.quoi === 'page') return vuPage(db, site);
  const palier = PALIERS[b.quoi] || 0;
  if (!palier || !site.lead_id || OUVERTS.indexOf(site.status) < 0) return { ok: true };
  const jour = iso().slice(0, 10);
  let avant = null;
  const l = await majFraiche(db, 'hq_leads', site.lead_id, function (f) {
    const d = f.data || {}, i0 = d.interet || {};
    avant = i0;
    // un rechargement en boucle ne fait pas monter la fiche : 30 signaux par jour au plus
    if (i0.jour === jour && (i0.fois_jour || 0) >= 30) return null;
    const niveau = Math.max(i0.niveau || 0, palier);
    const interet = { niveau: niveau, quoi: NOMS_PALIERS[niveau], premier_le: i0.premier_le || iso(), dernier_le: iso(), fois: (i0.fois || 0) + 1, jour: jour, fois_jour: (i0.jour === jour ? i0.fois_jour || 0 : 0) + 1 };
    if (b.paiement === 'mensuel' || b.paiement === 'une_fois') interet.paiement = b.paiement;
    else if (i0.paiement) interet.paiement = i0.paiement;
    return { data: Object.assign({}, d, { interet: interet }), score: Math.max(Number(f.score) || 0, SCORES[niveau]) };
  });
  if (l && palier >= 2 && (!avant || (avant.niveau || 0) < 2)) {
    const nomSite = String((site.spec && site.spec.nom) || l.name || '').replace(/\*\*/g, '');
    await noter(db, nomSite + ' regarde le paiement de son site', nomSite + ' a ouvert « Je le prends » sur son aperçu (' + NOVALEMO.grille.essentiel.prix + ' € en une fois). S\'il paie, Lucas met le site en ligne tout seul ; sinon il reste en tête de tes prospects intéressés.', 'note', { lead_id: l.id, site_id: site.id });
  }
  return { ok: true };
}

/* ── 3. la commande ── */
async function commande(db, site, b) {
  const S = require('./stripe'), P = require('./publication'), W = require('../web');
  const f = NOVALEMO.grille.essentiel;
  // au mois seulement si la grille a un prix au mois (plus depuis le 12 nov. 2026 : 99 € en une fois)
  const mode = b.paiement === 'mensuel' && f.mois ? 'mensuel' : 'une_fois';
  if (['paye', 'livraison', 'en_ligne'].indexOf(site.status) >= 0) return { ok: true, deja: true, message: 'C\'est déjà payé : votre site se met en ligne, vous recevez tout par email.' };
  if (OUVERTS.indexOf(site.status) < 0) return { erreur: 'cet aperçu n\'est plus disponible à la commande' };
  const depuis = iso(Date.now() - JOUR);
  const liens0 = S.liens(site.stripe);
  if (liens0.filter(function (x) { return (x.cree_le || '') >= depuis && x.origine === 'apercu'; }).length >= MAX_COMMANDES_JOUR) return { erreur: 'trop d\'essais aujourd\'hui : réessayez demain, ou répondez à notre email' };
  const pret = S.branche() && !S.modeTest();
  const idr = await db.one('hq_config', { eq: { key: 'identite' } });
  const pub = await P.lireEtat(db).catch(function () { return {}; });
  const hote = pub.hote || pub.hote_vercel;
  if (!pret || !idr || !idr.value || !idr.value.entreprise || !hote) {
    // le paiement en ligne n'est pas encore prêt : on garde son envie, Emma lui envoie le lien dès que possible
    return { ok: true, attente: true, message: 'Merci ! Laissez votre email : le lien de paiement vous arrive très vite.' };
  }
  // un lien déjà payé : surtout pas un second (le relevé passe toutes les 15 minutes)
  for (const lk of liens0) {
    const p = await S.paiement(lk.id).catch(function () { return null; });
    if (p && !p.test) return { ok: true, deja: true, message: 'C\'est déjà payé : votre site se met en ligne, vous recevez tout par email.' };
  }
  // le lien prêt pour cette formule, à ce prix, et ce mode de paiement : il resert (une page de paiement par commande)
  const prix = mode === 'mensuel' ? f.mois : f.prix;
  const pretLien = site.status === 'commande' && liens0.slice().reverse().find(function (x) { return x.formule === 'essentiel' && Number(x.montant_eur) === Number(prix) && (x.mode === 'mensuel') === (mode === 'mensuel') && x.url; });
  if (pretLien) {
    const st = site.stripe || {};
    if (st.desactives && st.desactives.indexOf(pretLien.id) >= 0) { /* coupé : on en refait un */ } else return { ok: true, url: pretLien.url };
  }
  const lead = site.lead_id ? await db.one('hq_leads', { eq: { id: site.lead_id } }) : null;
  if (lead && lead.status === 'stop') { /* il revient de lui-même : sa commande compte */ }
  const nomSite = String((site.spec && site.spec.nom) || (lead && lead.name) || '').replace(/\*\*/g, '');
  const merci = 'https://' + hote + '/_n/merci/', cgv = 'https://' + hote + '/_n/cgv/';
  const lien = mode === 'mensuel'
    ? await S.creerLien({ site_id: site.id, mensuel: true, engagement_mois: NOVALEMO.abonnement.engagement_mois, libelle: 'Abonnement ' + f.nom + ' : ' + nomSite, montant_eur: f.mois, email: lead && lead.email, url_merci: merci, url_cgv: cgv })
    : await S.creerLien({ site_id: site.id, libelle: 'Site ' + f.nom + ' : ' + nomSite, montant_eur: f.prix, email: lead && lead.email, url_merci: merci, url_cgv: cgv, pied_facture: S.piedFacture(idr.value) });
  const t = iso();
  // son propre domaine s'il en a vraiment un (domaine nu, à lui) ; sinon Lucas en réserve un au paiement
  const sien = W.domaineAPropre(lead && lead.domain);
  const lu = site.status;
  const ecrit = await majFraiche(db, 'hq_sites', site.id, function (fr) {
    if (fr.status !== lu) return null;
    const fs = fr.stripe || {};
    const stripe = Object.assign({}, fs);
    if (mode === 'mensuel') Object.assign(stripe, { lien_mois: lien.lien, url_mois: lien.url, prix_mois: lien.prix, cree_le: t });
    else Object.assign(stripe, { lien: lien.lien, url: lien.url, prix: lien.prix, cree_le: t });
    // les liens d'avant restent suivis (une page ouverte peut encore aboutir ; un double paiement est remboursé seul)
    stripe.liens = S.liens(fs).concat([{ id: lien.lien, url: lien.url, formule: 'essentiel', montant_eur: prix, mode: mode, cree_le: t, origine: 'apercu' }]).slice(-10);
    const patch = { status: 'commande', stripe: stripe };
    if (fr.status !== 'commande' || !fr.formule) Object.assign(patch, { formule: 'essentiel', montant_eur: f.prix });
    if (!fr.domaine && sien) Object.assign(patch, { domaine: sien, domaine_mode: 'client' });
    return patch;
  });
  if (!ecrit) {
    await S.desactiver(lien.lien).catch(function () {});
    return { ok: true, attente: true, message: 'Votre commande est en cours de traitement : la suite arrive par email.' };
  }
  if (lead && ['nouveau', 'a_contacter', 'a_appeler', 'brouillon', 'contacte', 'relance', 'repondu', 'sans_contact'].indexOf(lead.status) >= 0) await db.update('hq_leads', { status: 'interesse', updated_at: iso() }, { eq: { id: lead.id } });
  await noter(db, 'Paiement ouvert depuis l\'aperçu : ' + nomSite + ', ' + (mode === 'mensuel' ? f.mois + ' € par mois' : f.prix + ' €'), 'Il a cliqué « Je le prends » sur son aperçu et part sur la page de paiement Stripe. Rien à faire : Lucas relève le paiement et met le site en ligne.', 'rapport');
  return { ok: true, url: lien.url };
}

// le paiement n'est pas prêt (ou il préfère qu'on lui écrive) : son email, et Emma s'en occupe
async function rappel(db, site, b) {
  const m = email(b.email);
  if (!m) return { erreur: 'votre email, pour vous envoyer le lien' };
  const f = NOVALEMO.grille.essentiel;
  const mode = b.paiement === 'mensuel' && f.mois ? 'mensuel' : 'une_fois';
  const deja = (await db.select('hq_inbox', { eq: { lead_id: site.lead_id || -1 }, gte: { received_at: iso(Date.now() - JOUR) }, select: 'id,data', limit: 50 })).filter(function (x) { return x.data && x.data.canal === 'apercu'; });
  if (deja.length >= MAX_DEMANDES_JOUR) return { ok: true };
  const corps = 'Il a cliqué « Je le prends » sur son aperçu de ' + site.spec.nom + ' : ' + (mode === 'mensuel' ? f.mois + ' € par mois pendant ' + NOVALEMO.abonnement.engagement_mois + ' mois' : f.prix + ' € en une fois') + '. Envoie-lui la commande (formule Essentiel, paiement ' + mode + ').';
  await db.insert('hq_inbox', { lead_id: site.lead_id || null, from_email: m, from_name: propre(b.nom, 80) || null, subject: 'Je veux ce site : ' + court(site.spec.nom, 80), body: corps, kind: 'reponse', intent: 'interesse', status: 'nouveau', data: { canal: 'apercu', confiance: 'apercu', site_id: site.id, paiement: mode }, received_at: iso() });
  const lead = site.lead_id ? await db.one('hq_leads', { eq: { id: site.lead_id } }) : null;
  if (lead) { const p = { status: lead.status === 'client' ? lead.status : 'interesse', updated_at: iso() }; if (!lead.email) { p.email = m; p.email_source = 'apercu'; } await db.update('hq_leads', p, { eq: { id: lead.id } }); }
  await noter(db, 'Il veut son site : ' + site.spec.nom, corps, 'alerte');
  await reveiller(db, 'reponses', 1);
  return { ok: true };
}

/* ── 4. « Modifier moi-même » : ce qu'il a changé lui-même sur la page ── */
// des paires { avant, apres } pour les textes, et { fichier, image } pour les photos qu'il a remplacées (image = une image
// qu'il a déjà envoyée pour CET aperçu, action image). Rien ne passe par l'IA : c'est posé dans la fiche, Lucas republie.
const MAX_PHOTOS_EDITION = 8;
async function edition(db, site, b) {
  if (OUVERTS.indexOf(site.status) < 0) return { erreur: 'ce site ne se modifie plus ici : répondez à notre email, on s\'en occupe' };
  const ED = require('./edition');
  const textes = ED.paires(b.textes);
  const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, MAX_PHOTOS_EDITION).map(function (x) {
    return { fichier: String((x && x.fichier) || '').replace(/[?#].*$/, '').replace(/^.*\//, ''), image: Number(x && x.image) };
  }).filter(function (x) { return /^[\w.-]{1,90}$/.test(x.fichier) && x.image > 0; });
  if (!textes.length && !photos.length) return { erreur: 'rien n\'a changé : touchez un texte pour l\'écrire autrement, ou une photo pour mettre la vôtre' };
  const m = email(b.email), t = tel(b.tel);
  if (!m) return { erreur: 'votre email, pour retrouver votre site modifié' };
  const depuis = iso(Date.now() - JOUR);
  const recentes = (await db.select('hq_inbox', { eq: { lead_id: site.lead_id || -1 }, gte: { received_at: depuis }, select: 'id,data', limit: 50 })).filter(function (x) { return x.data && x.data.canal === 'apercu'; });
  if (recentes.length >= MAX_DEMANDES_JOUR) return { erreur: 'beaucoup de changements aujourd\'hui : la suite demain, ou répondez à notre email' };
  // ses photos : envoyées pour CET aperçu dans les dernières 24 h, pas encore posées ; leurs octets partent chez Vercel
  const V = require('./vercel'), PH = require('./photos');
  const ids = photos.map(function (p) { return p.image; });
  const fichiers = ids.length ? (await db.select('hq_fichiers', { in: { id: ids }, select: 'id,site_id,mime,largeur,hauteur,utilise,created_at' })).filter(function (f) { return f.site_id === site.id && !f.utilise && f.created_at >= depuis; }) : [];
  const poses = [];
  for (const p of photos) {
    const f = fichiers.find(function (x) { return x.id === p.image; });
    if (!f || !V.branche()) continue;
    try {
      const plein = await db.one('hq_fichiers', { eq: { id: f.id }, select: 'id,contenu' });
      if (!plein || !plein.contenu) continue;
      const up = await V.envoyerFichier(Buffer.from(plein.contenu, 'base64'));
      poses.push({ fichier: p.fichier, id: f.id, img: { fichier: 'c' + f.id + '.' + PH.ext(f.mime), sha: up.sha, taille: up.size, l: f.largeur, h: f.hauteur, fichier_id: f.id } });
    } catch (e) { /* une photo ratée n'empêche pas les textes */ }
  }
  let bilan = null;
  const ecrit = await majFraiche(db, 'hq_sites', site.id, function (fr) {
    if (OUVERTS.indexOf(fr.status) < 0) return null;
    const r = ED.appliquer(fr.spec || {}, textes, poses);
    bilan = r.bilan;
    if (!bilan.fiche && !bilan.gabarit && !bilan.photos) return null;
    return { spec: r.spec, version: (fr.version || 1) + 1, data: Object.assign({}, fr.data || {}, { edition_client: { le: iso(), textes: bilan.fiche + bilan.gabarit, photos: bilan.photos, email: m } }) };
  });
  if (!ecrit) return bilan ? { erreur: 'rien n\'a pu être enregistré : rechargez la page et recommencez' } : { erreur: 'votre site vient de changer : rechargez la page et recommencez' };
  for (const p of poses) await db.update('hq_fichiers', { utilise: true }, { eq: { id: p.id } });
  // Lucas republie au prochain passage (la page de la personne montre déjà ses changements)
  await require('./publication').ecrireEtat(db, { a_publier: true }).catch(function () {});
  await reveiller(db, 'livraison', 1);
  const nb = bilan.fiche + bilan.gabarit;
  const resume = [nb ? nb + ' texte(s)' : null, bilan.photos ? bilan.photos + ' photo(s)' : null].filter(Boolean).join(' et ');
  const lead = site.lead_id ? await db.one('hq_leads', { eq: { id: site.lead_id } }) : null;
  const corps = 'Il a modifié lui-même son aperçu de ' + site.spec.nom + ' : ' + resume + '. C\'est enregistré dans sa fiche et en ligne sur le même lien.\n' +
    textes.slice(0, 12).map(function (x) { return '- « ' + court(x.avant, 80) + ' » devient « ' + court(x.apres, 120) + ' »'; }).join('\n') + (t ? '\nSon téléphone : ' + t : '');
  // Emma lui propose la suite (la mise en ligne à 99 €) ; un message de lui depuis la page vaut un message de notre fil
  await db.insert('hq_inbox', { lead_id: site.lead_id || null, outbox_id: null, from_email: m, from_name: propre(b.nom, 80) || null, subject: 'A modifié son site : ' + court(site.spec.nom, 80), body: corps, kind: 'reponse', intent: 'interesse', status: 'nouveau', data: { canal: 'apercu', confiance: 'apercu', site_id: site.id, edition: true, tel: t || null }, received_at: iso() }).catch(function () {});
  if (lead) {
    const patch = { updated_at: iso(), score: Math.max(Number(lead.score) || 0, 95) };
    if (['client', 'stop'].indexOf(lead.status) < 0) patch.status = 'interesse';
    if (!lead.email) { patch.email = m; patch.email_source = 'apercu'; }
    if (t && !lead.phone) patch.phone = t;
    await db.update('hq_leads', patch, { eq: { id: lead.id } });
    await db.update('hq_outbox', { status: 'annule', error: 'il a modifié lui-même son aperçu : Emma prend la suite', updated_at: iso() }, { eq: { lead_id: lead.id, status: 'pret' }, in: { kind: ['prospection', 'relance'] } }).catch(function () {});
  }
  const bloque = await require('../garde').compteBloque(db).catch(function () { return null; });
  await noter(db, site.spec.nom + ' a modifié son site lui-même', corps + '\n\nC\'est un vrai signal : il s\'approprie le site. ' + (bloque ? 'Emma ne peut pas lui écrire (compte Anthropic à sa limite de dépense) : écris-lui toi-même à ' + m + ' pour lui proposer la mise en ligne (' + NOVALEMO.grille.essentiel.prix + ' €, le bouton « Je le prends » de son aperçu).' : 'Emma lui propose la mise en ligne (' + NOVALEMO.grille.essentiel.prix + ' €).'), 'alerte', { lead_id: site.lead_id || null, site_id: site.id });
  await reveiller(db, 'reponses', 2);
  return { ok: true, textes: nb, photos: bilan.photos };
}

/* ── l'aiguillage (api/apercu.js) ── */
async function traiter(db, b) {
  b = b || {};
  if (!jetonOk(b.site, b.cle)) return { code: 403, corps: { erreur: 'lien invalide : rechargez la page' } };
  const site = await siteDe(db, b.site);
  if (!site) return { code: 404, corps: { erreur: 'aperçu introuvable' } };
  const actions = { image: image, retouches: retouches, vu: vu, commande: commande, rappel: rappel, edition: edition };
  const a = actions[b.action];
  if (!a) return { code: 400, corps: { erreur: 'action inconnue' } };
  if (b.action !== 'commande' && ['annule'].indexOf(site.status) >= 0) return { code: 410, corps: { erreur: 'cet aperçu n\'est plus suivi' } };
  const r = await a(db, site, b);
  return { code: r && r.erreur ? 400 : 200, corps: r };
}

module.exports = { jeton, jetonOk, pour, api, hoteTour, traiter, image, retouches, vu, vuPage, commande, rappel, edition, elementsDe, ZONES, NOMS_ZONES, MAX_OCTETS, OUVERTS, MAX_PHOTOS_EDITION };
