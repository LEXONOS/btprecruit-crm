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

// Lien de paiement : o = { site_id, libelle, montant_eur, email, url_merci, url_cgv, pied_facture, sans_domaine, confirmation }
// (une commande demande le nom de domaine souhaité ; un renouvellement non, et confirme sur la page Stripe)
async function creerLien(o) {
  const prix = await api('POST', '/prices', { currency: 'eur', unit_amount: Math.round(o.montant_eur * 100), product_data: { name: o.libelle, metadata: { site_id: String(o.site_id) } }, metadata: { site_id: String(o.site_id) } });
  const p = {
    line_items: [{ price: prix.id, quantity: 1 }],
    metadata: { site_id: String(o.site_id), origine: 'la-tour' },
    after_completion: o.confirmation || !o.url_merci ? { type: 'hosted_confirmation', hosted_confirmation: { custom_message: o.confirmation || 'Merci, c\'est payé. La facture arrive par email.' } } : { type: 'redirect', redirect: { url: o.url_merci } },
    invoice_creation: { enabled: true, invoice_data: { description: o.libelle, footer: o.pied_facture || 'TVA non applicable, art. 293 B du CGI.', metadata: { site_id: String(o.site_id) } } },
    restrictions: { completed_sessions: { limit: 1 } },
    customer_creation: 'always',
    billing_address_collection: 'required',
    custom_fields: o.sans_domaine ? undefined : [{ key: 'domaine', type: 'text', optional: true, label: { type: 'custom', custom: 'Nom de domaine souhaité (facultatif)' } }],
    custom_text: o.url_cgv ? { submit: { message: 'En payant, vous acceptez les conditions de vente : ' + o.url_cgv } } : undefined
  };
  const lien = await api('POST', '/payment_links', p);
  return { prix: prix.id, lien: lien.id, url: lien.url };
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
    site_id: s.metadata && s.metadata.site_id ? Number(s.metadata.site_id) : null, origine: (s.metadata && s.metadata.origine) || null
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
  return out;
}
async function facture(id) { const f = await api('GET', '/invoices/' + encodeURIComponent(id)); return { numero: f.number, url: f.hosted_invoice_url, pdf: f.invoice_pdf, statut: f.status }; }
async function desactiver(lienId) { return api('POST', '/payment_links/' + encodeURIComponent(lienId), { active: false }); }
// Pied de facture : l'identité du vendeur et les mentions obligatoires d'une facture entre professionnels
function piedFacture(id) {
  id = id || {};
  if (id.mentions_facture) return String(id.mentions_facture);
  const qui = [id.entreprise, id.forme].filter(Boolean).join(', ');
  const ou = [id.adresse, [id.cp, id.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [qui ? qui + (id.siret ? ', SIRET ' + String(id.siret).replace(/\s/g, '') : '') + (ou ? ', ' + ou : '') + '.' : '', 'TVA non applicable, art. 293 B du CGI.', 'Facture acquittée par carte à la commande.', 'En cas de retard de paiement : pénalités au taux légal et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).'].filter(Boolean).join(' ');
}
// Remboursement intégral (paiement en double)
async function rembourser(intention) { if (!intention) throw new Error('paiement sans intention'); return api('POST', '/refunds', { payment_intent: intention, reason: 'duplicate' }); }

module.exports = { branche, modeTest, creerLien, paiement, payesDepuis, liens, facture, desactiver, rembourser, piedFacture, forcer, form };
