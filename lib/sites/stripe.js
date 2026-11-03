// Stripe : un lien de paiement par commande (prix de la grille, facture automatique), et la relève des paiements
// (la tour est protégée : pas de webhook entrant, on interroge Stripe à chaque cycle). Variable : HQ_STRIPE_KEY.
'use strict';
let FORCE = null;
function forcer(f) { FORCE = f; }
function cle() { return String(process.env.HQ_STRIPE_KEY || process.env.STRIPE_SECRET_KEY || '').trim(); }
function branche() { return /^(sk|rk)_(live|test)_/.test(cle()); }
function modeTest() { return /^(sk|rk)_test_/.test(cle()); }

function form(obj, prefixe, out) {
  out = out || [];
  Object.keys(obj).forEach(function (k) {
    const v = obj[k], nom = prefixe ? prefixe + '[' + k + ']' : k;
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach(function (x, i) { if (x && typeof x === 'object') form(x, nom + '[' + i + ']', out); else out.push(encodeURIComponent(nom + '[' + i + ']') + '=' + encodeURIComponent(x)); });
    else if (typeof v === 'object') form(v, nom, out);
    else out.push(encodeURIComponent(nom) + '=' + encodeURIComponent(v));
  });
  return out;
}
async function api(methode, chemin, params) {
  if (!branche()) throw new Error('Stripe non branché (HQ_STRIPE_KEY)');
  const corps = params && methode !== 'GET' ? form(params).join('&') : undefined;
  const url = 'https://api.stripe.com/v1' + chemin + (params && methode === 'GET' ? '?' + form(params).join('&') : '');
  const f = FORCE || fetch;
  const r = await f(url, { method: methode, headers: { Authorization: 'Bearer ' + cle(), 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' }, body: corps, signal: AbortSignal.timeout(25000) });
  const d = await r.json().catch(function () { return {}; });
  if (!r.ok) throw new Error('Stripe ' + chemin + ' : ' + ((d.error && d.error.message) || r.status));
  return d;
}

// Lien de paiement : o = { site_id, libelle, montant_eur, mensuel, email, url_merci, url_cgv, pied_facture, sans_domaine, confirmation }
// (une commande demande le nom de domaine souhaité ; un renouvellement non, et confirme sur la page Stripe).
// mensuel : prix récurrent au mois, la session crée un abonnement (prélevé chaque mois par Stripe, facture à chaque fois) ;
// la facture d'un paiement unique est créée par le lien, celle d'un abonnement par l'abonnement.
async function creerLien(o) {
  const meta = { site_id: String(o.site_id) };
  const pp = { currency: 'eur', unit_amount: Math.round(o.montant_eur * 100), product_data: { name: o.libelle, metadata: meta }, metadata: meta };
  if (o.mensuel) pp.recurring = { interval: 'month' };
  const prix = await api('POST', '/prices', pp);
  const p = {
    line_items: [{ price: prix.id, quantity: 1 }],
    metadata: { site_id: String(o.site_id), origine: 'la-tour' },
    after_completion: o.confirmation || !o.url_merci ? { type: 'hosted_confirmation', hosted_confirmation: { custom_message: o.confirmation || 'Merci, c\'est payé. La facture arrive par email.' } } : { type: 'redirect', redirect: { url: o.url_merci } },
    restrictions: { completed_sessions: { limit: 1 } },
    billing_address_collection: 'required',
    custom_fields: o.sans_domaine ? undefined : [{ key: 'domaine', type: 'text', optional: true, label: { type: 'custom', custom: 'Nom de domaine souhaité (facultatif)' } }],
    custom_text: o.url_cgv ? { submit: { message: (o.reprise ? 'Reprise de votre abonnement mensuel, aux mêmes conditions. ' : o.mensuel ? 'Abonnement mensuel, engagement ' + (o.engagement_mois || 12) + ' mois. ' : '') + 'En payant, vous acceptez les conditions de vente : ' + o.url_cgv } } : undefined
  };
  if (o.mensuel) p.subscription_data = { description: o.libelle, metadata: { site_id: String(o.site_id), origine: 'la-tour' } };
  else { p.invoice_creation = { enabled: true, invoice_data: { description: o.libelle, footer: o.pied_facture || 'TVA non applicable, art. 293 B du CGI.', metadata: meta } }; p.customer_creation = 'always'; }
  const lien = await api('POST', '/payment_links', p);
  return { prix: prix.id, lien: lien.id, url: lien.url, mensuel: !!o.mensuel };
}
const idDe = function (x) { return typeof x === 'string' ? x : (x && x.id) || null; };
function payee(s) { return !!s && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required'); }
function normaliser(s) {
  const champ = (s.custom_fields || []).find(function (c) { return c.key === 'domaine'; });
  return {
    session: s.id, lien: idDe(s.payment_link), montant_eur: (s.amount_total || 0) / 100, email: s.customer_details && s.customer_details.email, nom: s.customer_details && s.customer_details.name,
    adresse: s.customer_details && s.customer_details.address, invoice: idDe(s.invoice),
    domaine: champ && champ.text && champ.text.value ? String(champ.text.value).trim().toLowerCase() : null, le: new Date((s.created || Date.now() / 1000) * 1000).toISOString(),
    // un paiement de test (carte de test, clé sk_test) ne déclenche jamais d'achat ni de mise en ligne
    test: s.livemode === false || modeTest(),
    intention: idDe(s.payment_intent),
    // les métadonnées du lien sont recopiées sur ses sessions : à quel site ce paiement appartient
    site_id: s.metadata && s.metadata.site_id ? Number(s.metadata.site_id) : null, origine: (s.metadata && s.metadata.origine) || null,
    // paiement au mois : l'abonnement créé par la session (première mensualité payée) et le client Stripe
    abonnement: idDe(s.subscription), mode: s.mode || 'payment', client: idDe(s.customer)
  };
}
// Paiement reçu sur ce lien ? Retourne la session payée (client, facture) ou null
async function paiement(lienId) {
  const l = await api('GET', '/checkout/sessions', { payment_link: lienId, status: 'complete', limit: 3 });
  const s = (l.data || []).find(payee);
  return s ? normaliser(s) : null;
}
// Tous les paiements aboutis du compte dont la session a été ouverte depuis « depuis » (secondes) : une requête par page
// de 100 au lieu d'une par lien, donc rien n'est oublié quel que soit le nombre de commandes ouvertes. Une session de
// paiement expire 24 h après son ouverture : relever depuis le dernier relevé réussi moins 25 h ne rate aucun paiement.
// Rend une carte lien de paiement -> paiement. Trop de pages : erreur (l'appelant repasse lien par lien).
async function payesDepuis(depuisSec, maxPages) {
  const carte = new Map();
  let apres = null;
  for (let page = 0; page < (maxPages || 25); page++) {
    const q = { status: 'complete', limit: 100, created: { gte: Math.floor(depuisSec) } };
    if (apres) q.starting_after = apres;
    const l = await api('GET', '/checkout/sessions', q);
    const data = l.data || [];
    data.forEach(function (s) { const lien = idDe(s.payment_link); if (lien && payee(s) && !carte.has(lien)) carte.set(lien, normaliser(s)); });
    if (!l.has_more || !data.length) return carte;
    apres = data[data.length - 1].id;
  }
  throw new Error('Stripe : trop de paiements à relever en une fois');
}
// Tous les liens d'une commande, le courant et les remplacés : un client peut payer un lien qu'on vient de remplacer
function liens(st) {
  st = st || {};
  const out = (st.liens || []).filter(function (x) { return x && x.id; }).slice();
  if (st.lien && !out.some(function (x) { return x.id === st.lien; })) out.push({ id: st.lien, url: st.url || null, formule: null, montant_eur: null });
  if (st.lien_mois && !out.some(function (x) { return x.id === st.lien_mois; })) out.push({ id: st.lien_mois, url: st.url_mois || null, formule: null, montant_eur: null, mode: 'mensuel' });
  return out;
}
// L'état utile d'un abonnement Stripe. Fin voulue : arrêt demandé (par nous à la demande du client, ou depuis le tableau
// de bord Stripe) ; sinon arrêt faute de paiement (ou litige). ancre : début des périodes (un mois chacune).
const secIso = function (t) { return t ? new Date(t * 1000).toISOString() : null; };
function etatAbonnement(a) {
  const raison = (a.cancellation_details && a.cancellation_details.reason) || null;
  return { id: a.id, statut: a.status, client: idDe(a.customer), derniere_facture: idDe(a.latest_invoice), resiliation_fin: !!a.cancel_at_period_end, arret_le: secIso(a.cancel_at),
    // arrêté faute de paiement (ou litige) : jamais une fin voulue, même si un arrêt était programmé pour plus tard
    raison_fin: raison, fin_voulue: raison ? raison === 'cancellation_requested' : (!!a.cancel_at_period_end || !!a.cancel_at),
    ancre: secIso(a.billing_cycle_anchor || a.start_date), fin_periode: secIso(a.current_period_end), annule_le: secIso(a.canceled_at), termine_le: secIso(a.ended_at),
    site_id: a.metadata && a.metadata.site_id ? Number(a.metadata.site_id) : null };
}
async function abonnement(id) { return etatAbonnement(await api('GET', '/subscriptions/' + encodeURIComponent(id))); }
// Les abonnements du compte, tous statuts, par pages de 100 : id -> état (un appel par page, pas un par client)
async function abonnementsCompte(maxPages) {
  const carte = new Map();
  let apres = null;
  for (let page = 0; page < (maxPages || 30); page++) {
    const q = { status: 'all', limit: 100 };
    if (apres) q.starting_after = apres;
    const l = await api('GET', '/subscriptions', q);
    const data = l.data || [];
    data.forEach(function (a) {
      carte.set(a.id, etatAbonnement(a));
    });
    if (!l.has_more || !data.length) return carte;
    apres = data[data.length - 1].id;
  }
  throw new Error('Stripe : trop d\'abonnements à relever en une fois');
}
// Les factures payées créées depuis « depuis » (secondes), payées n'importe quand depuis (une carte refusée réglée plus
// tard, une relance réussie) : pour envoyer au client la facture de chaque mois. Tronqué : complet = false.
async function facturesPayees(depuisSec, maxPages) {
  const out = [];
  out.complet = true;
  let apres = null;
  for (let page = 0; page < (maxPages || 40); page++) {
    const q = { status: 'paid', limit: 100, created: { gte: Math.floor(depuisSec) } };
    if (apres) q.starting_after = apres;
    const l = await api('GET', '/invoices', q);
    const data = l.data || [];
    data.forEach(function (f) { out.push({ id: f.id, abonnement: idDe(f.subscription), numero: f.number, url: f.hosted_invoice_url, pdf: f.invoice_pdf, montant_eur: (f.amount_paid || 0) / 100, raison: f.billing_reason, le: new Date((f.created || 0) * 1000).toISOString(), paye_le: secIso(f.status_transitions && f.status_transitions.paid_at) || new Date((f.created || 0) * 1000).toISOString(), intention: idDe(f.payment_intent), charge: idDe(f.charge) }); });
    if (!l.has_more || !data.length) return out;
    apres = data[data.length - 1].id;
  }
  out.complet = false;
  return out;
}
// Les factures encore à régler d'un abonnement arrêté sont annulées : plus personne ne peut payer un mois qui ne
// remettrait pas le site en ligne (la reprise passe par un nouveau lien)
async function annulerFacturesOuvertes(abonnementId) {
  const l = await api('GET', '/invoices', { subscription: abonnementId, status: 'open', limit: 20 });
  let n = 0;
  for (const f of l.data || []) { await api('POST', '/invoices/' + encodeURIComponent(f.id) + '/void'); n++; }
  return n;
}
// Résiliation demandée par le client (après l'engagement) : l'abonnement s'arrête à la fin du mois payé
async function resilierFinPeriode(id) { return etatAbonnement(await api('POST', '/subscriptions/' + encodeURIComponent(id), { cancel_at_period_end: true })); }
// Arrêt demandé pendant l'engagement : programmé une heure avant la mensualité qui suivrait la fin de l'engagement (elle
// n'est jamais créée ; Stripe ajuste la dernière à quelques centimes près) ; les mensualités d'ici là sont prélevées normalement
async function arreterLe(id, tSec) { return etatAbonnement(await api('POST', '/subscriptions/' + encodeURIComponent(id), { cancel_at: Math.floor(tSec), proration_behavior: 'none' })); }
// Le compte Stripe de la clé branchée (ou d'une autre clé, pour comparer)
async function compte() { const a = await api('GET', '/account'); return { id: a.id, paiements: !!a.charges_enabled }; }
// Arrêt immédiat (abonnement payé en double, ou paiement de test) : plus aucun prélèvement
async function annulerAbonnement(id) { return api('DELETE', '/subscriptions/' + encodeURIComponent(id)); }
// Arrêté pour de bon ? (après un arrêt qui a échoué ou dont la réponse s'est perdue)
async function abonnementArrete(id) {
  try { const a = await abonnement(id); return a.statut === 'canceled' || a.statut === 'incomplete_expired'; }
  catch (e) { if (/No such subscription|resource_missing/i.test(e.message)) return true; throw e; }
}
// Les mentions obligatoires sur les factures mensuelles : posées sur le client Stripe
async function piedClient(clientId, texte) { return api('POST', '/customers/' + encodeURIComponent(clientId), { invoice_settings: { footer: String(texte).slice(0, 4999) } }); }
// Remboursement d'un paiement, unique ou première mensualité (dans ce cas il est porté par la facture de l'abonnement)
async function rembourserPaiement(p) {
  if (p.intention) return rembourser(p.intention);
  if (!p.invoice) throw new Error('paiement sans intention ni facture');
  const f = await api('GET', '/invoices/' + encodeURIComponent(p.invoice));
  if (idDe(f.payment_intent)) return rembourser(idDe(f.payment_intent));
  if (idDe(f.charge)) return api('POST', '/refunds', { charge: idDe(f.charge), reason: 'duplicate' });
  throw new Error('facture sans paiement à rembourser');
}
async function facture(id) { const f = await api('GET', '/invoices/' + encodeURIComponent(id)); return { numero: f.number, url: f.hosted_invoice_url, pdf: f.invoice_pdf, statut: f.status }; }
async function desactiver(lienId) { return api('POST', '/payment_links/' + encodeURIComponent(lienId), { active: false }); }
// Pied de facture : l'identité du vendeur et les mentions obligatoires d'une facture entre professionnels (art. L441-9
// et L441-10 du Code de commerce). mensuel : factures d'abonnement, prélevées à chaque échéance (une facture peut rester
// à régler si la carte est refusée : jamais « acquittée » par avance).
function piedFacture(id, mensuel) {
  id = id || {};
  if (id.mentions_facture) return String(id.mentions_facture);
  const qui = [id.entreprise, id.forme].filter(Boolean).join(', ');
  const ou = [id.adresse, [id.cp, id.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [qui ? qui + (id.siret ? ', SIRET ' + String(id.siret).replace(/\s/g, '') : '') + (ou ? ', ' + ou : '') + '.' : '', 'Prestation de services.', 'TVA non applicable, art. 293 B du CGI.',
    mensuel ? 'Paiement par carte, prélevé à chaque échéance mensuelle.' : 'Facture acquittée par carte à la commande.',
    'Pas d\'escompte pour paiement anticipé. En cas de retard de paiement : pénalités de trois fois le taux d\'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).'].filter(Boolean).join(' ');
}
// Remboursement intégral (paiement en double)
async function rembourser(intention) { if (!intention) throw new Error('paiement sans intention'); return api('POST', '/refunds', { payment_intent: intention, reason: 'duplicate' }); }

module.exports = { branche, modeTest, creerLien, paiement, payesDepuis, liens, facture, desactiver, rembourser, rembourserPaiement, piedFacture, abonnement, abonnementsCompte, facturesPayees, annulerFacturesOuvertes, resilierFinPeriode, arreterLe, annulerAbonnement, abonnementArrete, compte, piedClient, forcer, form, api };
