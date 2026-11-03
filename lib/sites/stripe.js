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
// Paiement reçu sur ce lien ? Retourne la session payée (client, facture) ou null
async function paiement(lienId) {
  const l = await api('GET', '/checkout/sessions', { payment_link: lienId, status: 'complete', limit: 3 });
  const s = (l.data || []).find(function (x) { return x.payment_status === 'paid' || x.payment_status === 'no_payment_required'; });
  if (!s) return null;
  const champ = (s.custom_fields || []).find(function (c) { return c.key === 'domaine'; });
  return {
    session: s.id, montant_eur: (s.amount_total || 0) / 100, email: s.customer_details && s.customer_details.email, nom: s.customer_details && s.customer_details.name,
    adresse: s.customer_details && s.customer_details.address, invoice: typeof s.invoice === 'string' ? s.invoice : (s.invoice && s.invoice.id) || null,
    domaine: champ && champ.text && champ.text.value ? String(champ.text.value).trim().toLowerCase() : null, le: new Date((s.created || Date.now() / 1000) * 1000).toISOString(),
    // un paiement de test (carte de test, clé sk_test) ne déclenche jamais d'achat ni de mise en ligne
    test: s.livemode === false || modeTest(),
    intention: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent && s.payment_intent.id) || null
  };
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
// Remboursement intégral (paiement en double)
async function rembourser(intention) { if (!intention) throw new Error('paiement sans intention'); return api('POST', '/refunds', { payment_intent: intention, reason: 'duplicate' }); }

module.exports = { branche, modeTest, creerLien, paiement, liens, facture, desactiver, rembourser, forcer, form };
