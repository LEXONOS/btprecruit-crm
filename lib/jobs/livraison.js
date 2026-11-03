// Lucas, Chargé de mise en ligne : publie les aperçus, relève les paiements Stripe, réserve le nom de domaine,
// met le site en ligne sur ce domaine, prévient le client, et fait expirer les aperçus oubliés. Tout seul.
'use strict';
const V = require('../sites/vercel');
const S = require('../sites/stripe');
const P = require('../sites/publication');
const R = require('../sites/rendu');
const MQ = require('../martinique');
const mail = require('../mail');
const { NOVALEMO, BUDGET_DEFAUT, TZ } = require('../config');
const { court } = require('../util');

const iso = function (t) { return new Date(t || Date.now()).toISOString(); };
const SIGNE = 'Louis\nNovalemo, sites internet en Martinique';
const IPV4 = '76.76.21.21', CNAME = 'cname.vercel-dns.com';
const TLD_ACHAT = /\.(com|net|pro|site|online|services|business|company|shop|store|studio|boutique|restaurant|cafe|solar|plumbing|cleaning|construction|immo|fitness|beauty|salon|auto|taxi|tours|travel|boats|yachts|garden|energy|tech|digital|agency|events|photography|photo|video|consulting|repair|tools|supply|works)$/i;

async function identite(db) { const r = await db.one('hq_config', { eq: { key: 'identite' } }); return (r && r.value) || null; }
async function message(db, sujet, corps, kind) { await db.insert('hq_messages', { from_id: 'livraison', to_id: 'louis', company_id: 'novalemo', kind: kind || 'rapport', subject: court(sujet, 120), body: corps }, { returning: false }); }

// Le dernier message du fil avec ce client, pour répondre dedans
async function filDe(db, leadId) {
  const recu = (await db.select('hq_inbox', { eq: { lead_id: leadId, kind: 'reponse' }, order: 'received_at.desc', limit: 1 }))[0];
  if (recu && recu.message_id && !/^uid:/.test(recu.message_id)) return recu.message_id;
  const envoye = (await db.select('hq_outbox', { eq: { lead_id: leadId, status: 'envoye' }, order: 'sent_at.desc', limit: 1 }))[0];
  return envoye ? envoye.message_id : null;
}
async function ecrire(db, site, lead, a, sujet, corps) {
  if (!a) return false;
  await db.insert('hq_outbox', { lead_id: lead ? lead.id : null, agent_id: 'livraison', to_email: String(a).trim().toLowerCase(), subject: court(sujet, 140), body: corps + '\n\n' + SIGNE, step: 1, angle: 'service', status: 'pret', kind: 'service', in_reply_to: lead ? await filDe(db, lead.id) : null }, { returning: false });
  return true;
}
function destinataire(site, lead) { return (site.stripe && site.stripe.email) || (lead && lead.email) || null; }

/* ── domaines ── */
function propositions(nom) {
  const b = R.slugifier(String(nom || '').replace(/\b(sarl|sas|sasu|eurl|ei|sa|scop|snc)\b/gi, '')).replace(/-+/g, '-').slice(0, 40).replace(/^-|-$/g, '') || 'mon-entreprise';
  const out = [b + '.com'];
  if (!/martinique|972|madinina/.test(b)) out.push(b + '-martinique.com', b + '972.com');
  out.push(b.replace(/-/g, '') + '.com', b + '.pro', b + '.site');
  return out.filter(function (x, k, a) { return a.indexOf(x) === k && x.split('.')[0].length >= 3; });
}
function propre(d) { return String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''); }
async function choisirDomaine(voulu, nom, maxUsd, exclus) {
  const non = (exclus || []).map(propre);
  const essais = [].concat(voulu && TLD_ACHAT.test(voulu) ? [voulu] : [], propositions(nom)).filter(function (x) { return non.indexOf(x) < 0; }).slice(0, 7);
  for (const d of essais) {
    try {
      if (!(await V.disponible(d))) continue;
      const p = await V.prix(d);
      if (p.prix > 0 && p.prix <= maxUsd) return { domaine: d, prix: p.prix };
    } catch (e) { /* extension refusée ou erreur passagère : suivant */ }
  }
  return null;
}
function contact(id, mailAdresse) {
  const tel = MQ.e164(id.telephone) || id.telephone;
  return { firstName: id.prenom, lastName: id.nom, email: id.email || mailAdresse, phone: tel, address1: id.adresse, city: id.ville, state: id.region || id.ville, zip: id.cp, country: id.pays || 'FR', companyName: id.entreprise || undefined };
}
function identiteComplete(id) { return !!(id && id.prenom && id.nom && id.adresse && id.ville && id.cp && id.telephone && MQ.e164(id.telephone)); }

/* ── emails au client ── */
function emailPaiement(site) {
  const f = NOVALEMO.grille[site.formule] || {};
  const fac = site.stripe && site.stripe.facture_url;
  return 'Bonjour,\n\nMerci, votre paiement de ' + (site.montant_eur || f.prix) + ' € pour la formule ' + (f.nom || site.formule) + ' est bien reçu.' + (fac ? ' Votre facture : ' + fac : '') + '\n\n' +
    (site.domaine_mode === 'client' ? 'Votre site va être mis en ligne sur ' + site.domaine + '. Je vous envoie juste après le réglage à faire sur votre nom de domaine.' : 'Je réserve maintenant votre nom de domaine ' + (site.domaine || '') + ' et je mets le site en ligne dessus. Vous recevez un email dès qu\'il est visible, en général dans l\'heure.') +
    '\n\nPour une retouche, répondez simplement à cet email.';
}
function emailDns(site) {
  const v = (site.data && site.data.verification) || [];
  return 'Bonjour,\n\nPour que votre site s\'affiche sur ' + site.domaine + ', il reste un réglage à faire chez l\'hébergeur de votre nom de domaine (OVH, Gandi, IONOS...), dans la zone DNS :\n\n' +
    '1. Un enregistrement A pour ' + site.domaine + ' vers ' + IPV4 + '\n2. Un enregistrement CNAME pour www.' + site.domaine + ' vers ' + CNAME + '\n' +
    v.map(function (x, k) { return (k + 3) + '. Un enregistrement ' + x.type + ' pour ' + x.domain + ' avec la valeur ' + x.value; }).join('\n') + '\n\n' +
    'Ne touchez pas aux enregistrements MX : vos emails continuent de fonctionner. Si quelqu\'un gère votre domaine pour vous, transférez-lui simplement ce message.\n\nDès que c\'est fait, le site s\'allume tout seul et je vous préviens.';
}
function emailEnLigne(site, factureUrl) {
  const n = NOVALEMO.revisions_apres;
  return 'Bonjour,\n\nVotre site est en ligne : https://' + site.domaine + '\n\nIl est hébergé, sécurisé (https) et visible sur téléphone comme sur ordinateur. Les mentions légales sont en place.' +
    (factureUrl ? '\n\nVotre facture : ' + factureUrl : '') +
    '\n\nVous avez ' + n + ' séries de retouches incluses dans les 30 jours : répondez à cet email avec ce que vous voulez changer (texte, photo, logo, horaires).\n\nMerci pour votre confiance.';
}
function emailApercuPromis(site) {
  return 'Bonjour,\n\nComme promis, voici l\'aperçu de votre site : ' + site.url_apercu + '\n\nDites-moi ce que vous en pensez. Je peux changer les textes, les couleurs, ajouter votre logo et vos photos : envoyez-les simplement en réponse à cet email.';
}

/* ── les étapes ── */
async function promesses(db, nouveaux) {
  let n = 0;
  const leads = await db.select('hq_leads', { eq: { apercu_etat: 'publie' }, limit: 200, order: 'updated_at.desc' });
  for (const l of leads) {
    const d = l.data || {};
    if (!d.apercu_promis || d.apercu_envoye || l.status === 'stop') continue;
    const site = l.site_id ? await db.one('hq_sites', { eq: { id: l.site_id } }) : null;
    if (!site || !site.url_apercu) continue;
    if (await ecrire(db, site, l, l.email, 'L\'aperçu de votre site', emailApercuPromis(site))) n++;
    await db.update('hq_leads', { data: Object.assign({}, d, { apercu_envoye: iso() }), updated_at: iso() }, { eq: { id: l.id } });
  }
  return n;
}

// La formule réellement payée : celle du lien payé (un client peut payer l'ancien lien d'une autre formule)
function formulePayee(lk, montant, defaut) {
  if (lk && lk.formule && NOVALEMO.grille[lk.formule]) return lk.formule;
  const k = Object.keys(NOVALEMO.grille).find(function (x) { return x !== 'menu' && NOVALEMO.grille[x].prix === Number(montant); });
  return k || defaut;
}
async function paiements(db) {
  if (!S.branche()) return { n: 0, tests: 0 };
  const sites = await db.select('hq_sites', { eq: { status: 'commande' }, limit: 60, order: 'updated_at.asc' });
  let n = 0, tests = 0;
  for (const s of sites) {
    const st = s.stripe || {};
    const tous = S.liens(st);
    let p = null, lk = null;
    for (const x of tous) { const r = await S.paiement(x.id).catch(function () { return null; }); if (r) { p = r; lk = x; break; } }
    if (!p) continue;
    const lead = s.lead_id ? await db.one('hq_leads', { eq: { id: s.lead_id } }) : null;
    for (const x of tous) await S.desactiver(x.id).catch(function () {});
    if (p.test) {
      // paiement de test : la chaîne est prouvée, mais rien n'est acheté ni mis en ligne ; le site redevient un aperçu
      tests++;
      const dt = Object.assign({}, s.data || {}, { paiements_test: ((s.data && s.data.paiements_test) || []).concat([{ le: p.le || iso(), montant_eur: p.montant_eur, session: p.session }]).slice(-5) });
      await db.update('hq_sites', { status: 'apercu', stripe: {}, data: dt, updated_at: iso() }, { eq: { id: s.id } });
      await message(db, 'Paiement de test reçu : ' + p.montant_eur + ' €', 'La chaîne marche jusqu\'au paiement pour ' + ((s.spec && s.spec.nom) || s.slug) + '. Paiement de test : je n\'achète pas de domaine et ne mets rien en ligne, le site redevient un aperçu. Pour vendre pour de vrai : la clé live de Stripe dans HQ_STRIPE_KEY.', 'note');
      continue;
    }
    n++;
    let fac = null;
    if (p.invoice) fac = await S.facture(p.invoice).catch(function () { return null; });
    const voulu = p.domaine ? propre(p.domaine) : null;
    const formule = formulePayee(lk, p.montant_eur, s.formule);
    const patch = { status: 'paye', paid_at: p.le || iso(), formule: formule, montant_eur: p.montant_eur || s.montant_eur, stripe: Object.assign({}, st, { session: p.session, intention: p.intention, paye_lien: lk.id, email: p.email, nom: p.nom, adresse: p.adresse, invoice: p.invoice, facture_url: fac && fac.url, facture_numero: fac && fac.numero, montant_paye: p.montant_eur }), updated_at: iso() };
    if (voulu && voulu !== s.domaine && s.domaine_mode !== 'client') patch.domaine = voulu;
    await db.update('hq_sites', patch, { eq: { id: s.id } });
    const site = Object.assign({}, s, patch);
    if (lead) await db.update('hq_leads', { status: 'client', updated_at: iso() }, { eq: { id: lead.id } });
    await ecrire(db, site, lead, destinataire(site, lead), 'Paiement reçu, mise en ligne en cours', emailPaiement(site));
    await message(db, 'Vente : ' + p.montant_eur + ' € (' + ((NOVALEMO.grille[formule] || {}).nom || formule) + ', ' + ((s.spec && s.spec.nom) || '') + ')', 'Payé par carte' + (p.email ? ' par ' + p.email : '') + '. Lucas réserve le domaine et met le site en ligne, rien à faire.', 'alerte');
  }
  return { n: n, tests: tests };
}
// Un second paiement sur un ancien lien (page restée ouverte) : remboursé tout seul, le client est prévenu
async function doublons(db) {
  if (!S.branche()) return 0;
  const recents = await db.select('hq_sites', { in: { status: ['paye', 'livraison', 'en_ligne'] }, gte: { paid_at: iso(Date.now() - 3 * 86400000) }, limit: 60 });
  let n = 0;
  for (const s of recents) {
    const st = s.stripe || {};
    if (!st.paye_lien || !st.session) continue;   // on ne rembourse que si l'on sait exactement quel paiement est le bon
    const autres = S.liens(st).filter(function (x) { return x.id !== st.paye_lien && (st.rembourses || []).indexOf(x.id) < 0; });
    for (const x of autres) {
      const p = await S.paiement(x.id).catch(function () { return null; });
      if (!p || p.session === st.session || p.test) continue;
      const r = await S.rembourser(p.intention).then(function () { return true; }).catch(function (e) { return e.message; });
      const st2 = Object.assign({}, st, { rembourses: (st.rembourses || []).concat([x.id]) });
      await db.update('hq_sites', { stripe: st2, updated_at: iso() }, { eq: { id: s.id } });
      st.rembourses = st2.rembourses;
      const lead = s.lead_id ? await db.one('hq_leads', { eq: { id: s.lead_id } }) : null;
      if (r === true) {
        await ecrire(db, s, lead, p.email || destinataire(s, lead), 'Paiement en double remboursé', 'Bonjour,\n\nVotre site était déjà payé : le second paiement de ' + p.montant_eur + ' € vient d\'être remboursé en totalité, sur la même carte (quelques jours selon votre banque). Rien à faire de votre côté.');
        await message(db, 'Double paiement remboursé : ' + p.montant_eur + ' €', ((s.spec && s.spec.nom) || s.slug) + ' a payé deux fois ; le second paiement est remboursé automatiquement, client prévenu.', 'note');
      } else {
        await message(db, 'Double paiement à rembourser : ' + p.montant_eur + ' €', ((s.spec && s.spec.nom) || s.slug) + ' a payé deux fois et le remboursement automatique a échoué (' + court(String(r), 120) + '). Rembourse la session ' + p.session + ' depuis Stripe.', 'alerte');
      }
      n++;
    }
  }
  return n;
}

async function livrer(db, budget) {
  const id = await identite(db);
  const out = { achats: 0, attente: 0, enLigne: 0, notes: [] };
  const maxUsd = Number((budget && budget.domaine_max_usd) || BUDGET_DEFAUT.domaine_max_usd);
  const projet = V.branche() ? await V.assurerProjet(await P.lireEtat(db)).catch(function () { return null; }) : null;
  // 1. payés : on fixe le domaine (le leur, ou un à réserver)
  for (const s of await db.select('hq_sites', { eq: { status: 'paye' }, limit: 20, order: 'paid_at.asc' })) {
    if (!projet) { out.notes.push('hébergement non branché'); break; }
    const lead = s.lead_id ? await db.one('hq_leads', { eq: { id: s.lead_id } }) : null;
    const d = Object.assign({}, s.data || {});
    if (s.domaine_mode === 'client' && s.domaine) {
      const ajout = await V.ajouterDomaine(projet.id, s.domaine).catch(function (e) { d.erreur_domaine = court(e.message, 200); return null; });
      await V.ajouterDomaine(projet.id, 'www.' + s.domaine, s.domaine).catch(function () {});
      // domaine déjà connu ailleurs chez Vercel : une preuve TXT est demandée en plus
      if (ajout && ajout.verified === false && Array.isArray(ajout.verification)) d.verification = ajout.verification.map(function (x) { return { type: x.type, domain: x.domain, value: x.value }; }).slice(0, 2);
      d.live = true; d.dns_demande = iso();
      await db.update('hq_sites', { status: 'livraison', data: d, updated_at: iso() }, { eq: { id: s.id } });
      await ecrire(db, Object.assign({}, s, { data: d }), lead, destinataire(s, lead), 'Dernier réglage pour ' + s.domaine, emailDns(Object.assign({}, s, { data: d })));
      out.attente++;
      continue;
    }
    if (!identiteComplete(id)) {
      if (!d.alerte_identite) { await message(db, 'Identité de vente à compléter', 'Un client a payé mais je ne peux pas réserver son nom de domaine sans ton identité de vente (nom, adresse, téléphone). Tour, Réglages, Identité de vente : une seule fois.', 'alerte'); d.alerte_identite = iso(); await db.update('hq_sites', { data: d }, { eq: { id: s.id } }); }
      out.notes.push('identité de vente manquante'); continue;
    }
    // un achat a peut-être déjà été lancé (passage coupé juste après) : on ne paie jamais deux fois
    if (d.achat && !d.commande) {
      if (Date.now() - new Date(d.achat.le).getTime() < 10 * 60000) { out.attente++; continue; }
      const libre = await V.disponible(d.achat.domaine).catch(function () { return null; });
      if (libre === null) { out.attente++; continue; }
      if (libre === false) {
        d.commande = { id: null, domaine: d.achat.domaine, prix_usd: d.achat.prix, le: d.achat.le, recupere: true };
        await db.update('hq_sites', { status: 'livraison', domaine: d.achat.domaine, domaine_mode: 'achat', data: d, updated_at: iso() }, { eq: { id: s.id } });
        out.achats++; continue;
      }
      delete d.achat;
    }
    // trois commandes ratées de suite : c'est le moyen de paiement du compte Vercel, pas le nom ; on attend Louis
    if ((d.commande_ratee || []).length >= 3) {
      if (!d.alerte_ratees) { d.alerte_ratees = iso(); await db.update('hq_sites', { data: d }, { eq: { id: s.id } }); await message(db, 'Domaines : trois commandes refusées', 'Trois commandes de nom de domaine ont échoué pour ' + ((s.spec && s.spec.nom) || s.slug) + ' (' + d.commande_ratee.join(', ') + '). C\'est presque toujours la carte du compte Vercel : vercel.com, Settings, Billing. Dès qu\'elle passe, je reprends seul.', 'alerte'); }
      if (Date.now() - new Date(d.alerte_ratees).getTime() < 86400000) { out.notes.push('commandes de domaine refusées'); continue; }
      d.commande_ratee = []; delete d.alerte_ratees;   // un essai par jour ensuite
    }
    const choix = await choisirDomaine(propre(s.domaine), (s.spec && s.spec.nom) || (lead && lead.name), maxUsd, d.commande_ratee);
    if (!choix) { out.notes.push('aucun domaine libre pour ' + s.slug); if (!d.alerte_domaine) { await message(db, 'Domaine introuvable', 'Aucun nom de domaine libre sous ' + maxUsd + ' $ pour ' + ((s.spec && s.spec.nom) || s.slug) + '. Je réessaie au prochain passage.', 'alerte'); d.alerte_domaine = iso(); await db.update('hq_sites', { data: d }, { eq: { id: s.id } }); } continue; }
    d.achat = { domaine: choix.domaine, prix: choix.prix, le: iso() };
    await db.update('hq_sites', { data: d, updated_at: iso() }, { eq: { id: s.id } });
    try {
      const c = await V.acheter(choix.domaine, choix.prix, contact(id, mail.identite().adresse));
      d.commande = { id: c.orderId, domaine: choix.domaine, prix_usd: choix.prix, le: iso() };
      await db.update('hq_sites', { status: 'livraison', domaine: choix.domaine, domaine_mode: 'achat', data: d, updated_at: iso() }, { eq: { id: s.id } });
      out.achats++;
    } catch (e) {
      // refus explicite du registrar (prix, contact, extension) : rien n'a été acheté, on pourra réessayer
      if (e.statut >= 400 && e.statut < 500) { delete d.achat; d.commande_ratee = (d.commande_ratee || []).concat([choix.domaine]); }
      d.erreur_achat = court(e.message, 200);
      await db.update('hq_sites', { data: d, updated_at: iso() }, { eq: { id: s.id } });
      out.notes.push('achat refusé : ' + court(e.message, 80));
      if (!d.alerte_achat && e.statut >= 400 && e.statut < 500) { await message(db, 'Achat de domaine refusé', choix.domaine + ' : ' + court(e.message, 200) + '. Je réessaie avec un autre nom au prochain passage.', 'alerte'); d.alerte_achat = iso(); await db.update('hq_sites', { data: d }, { eq: { id: s.id } }); }
    }
  }
  // 2. en livraison : commande du domaine, puis domaine branché, puis site servi
  for (const s of await db.select('hq_sites', { eq: { status: 'livraison' }, limit: 30, order: 'updated_at.asc' })) {
    if (!projet) break;
    const d = Object.assign({}, s.data || {});
    const lead = s.lead_id ? await db.one('hq_leads', { eq: { id: s.lead_id } }) : null;
    if (s.domaine_mode === 'achat' && d.commande && !d.domaine_pret) {
      const c = d.commande.id ? await V.commande(d.commande.id).catch(function () { return null; }) : { status: 'completed' };
      if (!c || c.status === 'draft' || c.status === 'purchasing') { out.attente++; continue; }
      if (c.status === 'failed') {
        const rate = d.commande.domaine;
        d.commande_ratee = (d.commande_ratee || []).concat([rate]); delete d.commande; delete d.achat;
        await db.update('hq_sites', { status: 'paye', domaine: null, data: d, updated_at: iso() }, { eq: { id: s.id } });
        if (d.commande_ratee.length === 1) await message(db, 'Commande de domaine ratée : ' + rate, 'La commande de ' + rate + ' a échoué chez Vercel. Je passe à un autre nom, rien à faire pour l\'instant.', 'alerte');
        out.notes.push('commande de domaine ratée, nouvel essai'); continue;
      }
      await V.ajouterDomaine(projet.id, s.domaine).catch(function () {});
      await V.ajouterDomaine(projet.id, 'www.' + s.domaine, s.domaine).catch(function () {});
      d.domaine_pret = iso(); d.live = true;
      await db.update('hq_sites', { data: d, updated_at: iso() }, { eq: { id: s.id } });
      await P.ecrireEtat(db, { a_publier: true });
      out.attente++; continue;
    }
    if (!d.live) { d.live = true; await db.update('hq_sites', { data: d }, { eq: { id: s.id } }); await P.ecrireEtat(db, { a_publier: true }); continue; }
    if (!d.live_publie) { out.attente++; continue; }
    // le domaine répond-il ?
    let pret = false;
    if (d.verification && d.verification.length) await V.verifierDomaine(projet.id, s.domaine).catch(function () {});
    const cfg = await V.configDomaine(s.domaine).catch(function () { return null; });
    if (cfg && cfg.misconfigured === false) pret = await enLigne(s.domaine, s.spec && s.spec.nom);
    if (!pret) {
      out.attente++;
      if (s.domaine_mode === 'client') {
        const depuis = Date.now() - new Date(d.dns_demande || s.updated_at).getTime();
        const rappels = d.rappels_dns || 0;
        if ((rappels === 0 && depuis > 3 * 86400000) || (rappels === 1 && depuis > 7 * 86400000)) {
          await ecrire(db, s, lead, destinataire(s, lead), 'Votre site attend son nom de domaine', 'Bonjour,\n\nVotre site est prêt, il n\'attend plus que le réglage du nom de domaine ' + s.domaine + '. Je vous remets les deux lignes à ajouter dans la zone DNS :\n\n1. A pour ' + s.domaine + ' vers ' + IPV4 + '\n2. CNAME pour www.' + s.domaine + ' vers ' + CNAME + '\n\nSi c\'est compliqué, répondez à cet email : on peut aussi mettre le site sur un nouveau nom de domaine, inclus.');
          await db.update('hq_sites', { data: Object.assign(d, { rappels_dns: rappels + 1 }) }, { eq: { id: s.id } });
        }
      } else if (Date.now() - new Date(d.domaine_pret || s.updated_at).getTime() > 48 * 3600000 && !d.alerte_lent) {
        await message(db, 'Mise en ligne lente : ' + s.domaine, 'Le domaine est réservé et branché depuis 48 h mais ne répond pas encore. Je continue de vérifier.', 'alerte');
        await db.update('hq_sites', { data: Object.assign(d, { alerte_lent: iso() }) }, { eq: { id: s.id } });
      }
      continue;
    }
    const url = 'https://' + s.domaine + '/';
    await db.update('hq_sites', { status: 'en_ligne', live_at: iso(), url_finale: url, updated_at: iso() }, { eq: { id: s.id } });
    await ecrire(db, s, lead, destinataire(s, lead), 'Votre site est en ligne', emailEnLigne(s, s.stripe && s.stripe.facture_url));
    await message(db, 'Site en ligne : ' + s.domaine, ((s.spec && s.spec.nom) || '') + ' est en ligne sur ' + url + '. Client prévenu, facture envoyée.', 'evenement');
    out.enLigne++;
  }
  return out;
}
// Le site répond-il vraiment sur son domaine (certificat compris) ?
async function enLigne(domaine, nom) {
  try {
    const r = await fetch('https://' + domaine + '/', { redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!r.ok) return false;
    const t = await r.text();
    return !nom || t.indexOf(R.esc(String(nom).replace(/\*\*/g, '')).slice(0, 20)) >= 0 || t.length > 2000;
  } catch (e) { return false; }
}

async function expirer(db) {
  const jours = NOVALEMO.apercu_jours * 86400000;
  const limite = iso(Date.now() - jours);
  const vieux = await db.select('hq_sites', { eq: { status: 'apercu' }, lte: { published_at: limite }, limit: 100 });
  let n = 0;
  for (const s of vieux) {
    const l = s.lead_id ? await db.one('hq_leads', { eq: { id: s.lead_id } }) : null;
    if (l && ['repondu', 'interesse'].indexOf(l.status) >= 0) continue;
    if (l && l.contacted_at && Date.now() - new Date(l.contacted_at).getTime() < jours) continue;   // 30 jours après le premier email
    if (l && !l.contacted_at && l.status === 'a_contacter') continue;                                // pas encore envoyé : on garde
    await db.update('hq_sites', { status: 'expire', updated_at: iso() }, { eq: { id: s.id } });
    if (l) await db.update('hq_leads', { apercu_etat: 'expire', updated_at: iso() }, { eq: { id: l.id } });
    n++;
  }
  // un lien de paiement jamais utilisé en 45 jours : on le coupe, l'aperçu disparaît (jamais si un paiement existe ou si Stripe ne répond pas)
  const commandes = await db.select('hq_sites', { eq: { status: 'commande' }, lte: { updated_at: iso(Date.now() - 45 * 86400000) }, limit: 50 });
  for (const s of commandes) {
    const tous = S.liens(s.stripe);
    if (tous.length && !S.branche()) continue;
    let garder = false;
    for (const x of tous) { const p = await S.paiement(x.id).catch(function () { return 'doute'; }); if (p) garder = true; }
    if (garder) continue;
    for (const x of tous) await S.desactiver(x.id).catch(function () {});
    await db.update('hq_sites', { status: 'expire', stripe: Object.assign({}, s.stripe || {}, { lien: null, url: null, liens: tous }), updated_at: iso() }, { eq: { id: s.id } });
    if (s.lead_id) await db.update('hq_leads', { apercu_etat: 'expire', updated_at: iso() }, { eq: { id: s.lead_id } });
    n++;
  }
  if (n) await P.ecrireEtat(db, { a_publier: true });
  return n;
}

/* ── les années suivantes : hébergement (et domaine) à 25 € par an, encaissés sans Louis ── */
// 30 jours avant l'échéance : lien de paiement par email ; rappels à J-7 et J+7 ; payé : facture, un an de plus.
// Toujours rien 30 jours après l'échéance : le site passe en pause (page neutre sur son domaine) et le renouvellement
// automatique du domaine acheté est coupé ; tout revient dès que le lien est payé.
const JOUR = 86400000, AN = 365 * JOUR;
function dateFr(t) { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }); }
function echeance(s) { const r = (s.data && s.data.renouvellement) || {}; return new Date(s.live_at).getTime() + (r.annees || 1) * AN; }
async function renouvellements(db) {
  const out = { liens: 0, payes: 0, pauses: 0, notes: [] };
  if (!S.branche()) return out;
  const sites = await db.select('hq_sites', { in: { status: ['en_ligne', 'pause'] }, lte: { live_at: iso(Date.now() - AN + 31 * JOUR) }, limit: 200, order: 'live_at.asc' });
  if (!sites.length) return out;
  const idr = (await identite(db)) || {};
  const pub = await P.lireEtat(db);
  const hote = pub.hote || pub.hote_vercel;
  const quoi = function (s) { return s.domaine_mode === 'achat' ? 'l\'hébergement et le nom de domaine' : 'l\'hébergement'; };
  for (const s of sites) {
    if (!s.live_at || !s.domaine) continue;
    const d = Object.assign({}, s.data || {});
    const r = Object.assign({ annees: 1 }, d.renouvellement || {});
    const fin = echeance(s), reste = fin - Date.now();
    const lead = s.lead_id ? await db.one('hq_leads', { eq: { id: s.lead_id } }) : null;
    const a = destinataire(s, lead);
    const nom = String((s.spec && s.spec.nom) || (lead && lead.name) || s.domaine).replace(/\*\*/g, '');
    const sauver = async function (patch) { d.renouvellement = r; await db.update('hq_sites', Object.assign({ data: d, updated_at: iso() }, patch || {}), { eq: { id: s.id } }); };
    if (r.lien) {
      const p = await S.paiement(r.lien).catch(function () { return null; });
      if (p) {
        const fac = p.invoice ? await S.facture(p.invoice).catch(function () { return null; }) : null;
        await S.desactiver(r.lien).catch(function () {});
        r.historique = (r.historique || []).concat([{ jusqu_au: iso(fin + AN), montant_eur: p.montant_eur, le: p.le || iso(), facture_url: (fac && fac.url) || null }]).slice(-10);
        r.annees += 1; r.rappels = 0; delete r.lien; delete r.url; delete r.prix; delete r.cree_le;
        const reprise = s.status === 'pause';
        if (r.auto_coupe && s.domaine_mode === 'achat') { await V.autoRenouvellement(s.domaine, true).catch(function () {}); delete r.auto_coupe; }
        delete r.pause_le;
        await sauver(reprise ? { status: 'en_ligne' } : null);
        if (reprise) await P.ecrireEtat(db, { a_publier: true });
        await ecrire(db, s, lead, a, reprise ? 'Votre site est de nouveau en ligne' : 'Hébergement renouvelé pour un an',
          'Bonjour,\n\nMerci, votre paiement de ' + p.montant_eur + ' € est bien reçu : ' + quoi(s) + ' de https://' + s.domaine + ' sont renouvelés jusqu\'au ' + dateFr(fin + AN) + '.' + (fac && fac.url ? ' Votre facture : ' + fac.url : '') +
          (reprise ? '\n\nLe site revient en ligne, il est visible d\'ici quelques minutes.' : ''));
        await message(db, 'Renouvellement : ' + p.montant_eur + ' € (' + nom + ')', 'Hébergement de ' + s.domaine + ' payé jusqu\'au ' + dateFr(fin + AN) + '. Rien à faire.', 'note');
        out.payes++;
        continue;
      }
    }
    if (reste > 30 * JOUR) continue;
    if (!a) { if (!r.alerte_contact) { r.alerte_contact = iso(); await sauver(); await message(db, 'Renouvellement impossible : ' + nom, 'Aucune adresse email pour facturer l\'hébergement de ' + s.domaine + '.', 'alerte'); } continue; }
    if (!r.lien) {
      const lien = await S.creerLien({
        site_id: s.id, libelle: 'Hébergement' + (s.domaine_mode === 'achat' ? ' et nom de domaine' : '') + ' ' + s.domaine + ', jusqu\'au ' + dateFr(fin + AN),
        montant_eur: NOVALEMO.hebergement_an_eur, email: a, sans_domaine: true, url_cgv: hote ? P.urlNovalemo(hote, 'cgv/') : null,
        confirmation: 'Merci, c\'est payé : ' + quoi(s) + ' de ' + s.domaine + ' sont renouvelés pour un an. La facture arrive par email.',
        pied_facture: S.piedFacture(idr)
      }).catch(function (e) { return { erreur: e.message }; });
      if (lien.erreur) { out.notes.push('renouvellement : ' + court(lien.erreur, 60)); continue; }
      Object.assign(r, { lien: lien.lien, url: lien.url, prix: lien.prix, cree_le: iso(), rappels: 0 });
      await sauver();
      await ecrire(db, s, lead, a, 'Votre site : l\'hébergement de l\'année ' + (r.annees + 1),
        'Bonjour,\n\nVotre site https://' + s.domaine + ' arrive au bout de son année le ' + dateFr(fin) + '. Pour le garder en ligne, ' + quoi(s) + ' coûtent ' + NOVALEMO.hebergement_an_eur + ' € pour l\'année suivante, sans engagement : ' + lien.url +
        '\n\nLa facture arrive par email après le paiement. Une question, une modification à faire ? Répondez simplement à cet email.');
      out.liens++;
      continue;
    }
    const n = r.rappels || 0;
    if (n === 0 && reste <= 7 * JOUR) {
      r.rappels = 1; await sauver();
      await ecrire(db, s, lead, a, 'Rappel : hébergement de votre site', 'Bonjour,\n\nPetit rappel : ' + quoi(s) + ' de https://' + s.domaine + ' sont à renouveler avant le ' + dateFr(fin) + ' (' + NOVALEMO.hebergement_an_eur + ' €) : ' + r.url + '\n\nSi vous ne souhaitez pas continuer, répondez simplement à cet email.');
      continue;
    }
    if (n === 1 && reste <= -7 * JOUR) {
      r.rappels = 2; await sauver();
      await ecrire(db, s, lead, a, 'Votre site sera mis en pause le ' + dateFr(fin + 30 * JOUR), 'Bonjour,\n\nL\'hébergement de https://' + s.domaine + ' n\'est pas encore réglé. Sans paiement, le site sera mis en pause le ' + dateFr(fin + 30 * JOUR) + '. Le lien reste valable : ' + r.url + '\n\nVous préférez récupérer votre nom de domaine et les fichiers du site ? Répondez à cet email, c\'est prévu.');
      continue;
    }
    if (s.status === 'en_ligne' && reste <= -30 * JOUR) {
      if (s.domaine_mode === 'achat') { await V.autoRenouvellement(s.domaine, false).then(function () { r.auto_coupe = iso(); }).catch(function () {}); }
      r.pause_le = iso();
      await sauver({ status: 'pause' });
      await P.ecrireEtat(db, { a_publier: true });
      await ecrire(db, s, lead, a, 'Votre site est en pause', 'Bonjour,\n\nFaute de règlement de l\'hébergement, votre site https://' + s.domaine + ' est mis en pause aujourd\'hui. Il revient en ligne dès le paiement, au même endroit, sans rien perdre : ' + r.url + '\n\nPour récupérer votre nom de domaine et les fichiers du site, répondez simplement à cet email.');
      await message(db, 'Site en pause : ' + s.domaine, nom + ' n\'a pas réglé l\'hébergement de l\'année (' + NOVALEMO.hebergement_an_eur + ' €) malgré deux rappels. Site en pause, il revient seul au paiement. Rien à faire.', 'note');
      out.pauses++;
    }
  }
  return out;
}

async function run(ctx) {
  const db = ctx.db;
  if (!V.branche() && !S.branche()) return { resume: 'Hébergement (HQ_VERCEL_TOKEN) et paiement (HQ_STRIPE_KEY) pas encore branchés.', produit: 0, prochain_min: 360 };
  const parts = [];
  let suivi = null;
  if (V.branche()) {
    suivi = await P.suivre(db, {}).catch(function (e) { return { resume: 'suivi : ' + e.message }; });
    if (suivi && suivi.resume && !/^Rien en cours/.test(suivi.resume)) parts.push(suivi.resume);
  }
  const pr = await promesses(db).catch(function () { return 0; });
  if (pr) parts.push(pr + ' aperçu(s) promis envoyé(s)');
  const pa = await paiements(db).catch(function (e) { parts.push('paiements : ' + court(e.message, 80)); return { n: 0, tests: 0 }; });
  if (pa.n) parts.push(pa.n + ' paiement(s) reçu(s)');
  if (pa.tests) parts.push(pa.tests + ' paiement(s) de test (rien acheté)');
  const db2 = await doublons(db).catch(function () { return 0; });
  if (db2) parts.push(db2 + ' paiement(s) en double remboursé(s)');
  const li = await livrer(db, ctx.budget).catch(function (e) { parts.push('livraison : ' + court(e.message, 100)); return { achats: 0, attente: 0, enLigne: 0, notes: [] }; });
  if (li.achats) parts.push(li.achats + ' domaine(s) réservé(s)');
  if (li.enLigne) parts.push(li.enLigne + ' site(s) mis en ligne');
  if (li.attente) parts.push(li.attente + ' en cours de mise en ligne');
  if (li.notes.length) parts.push(li.notes.slice(0, 3).join(', '));
  const ex = await expirer(db).catch(function () { return 0; });
  if (ex) parts.push(ex + ' aperçu(s) expiré(s)');
  const re = await renouvellements(db).catch(function (e) { parts.push('renouvellements : ' + court(e.message, 80)); return { liens: 0, payes: 0, pauses: 0, notes: [] }; });
  if (re.liens) parts.push(re.liens + ' renouvellement(s) demandé(s)');
  if (re.payes) parts.push(re.payes + ' renouvellement(s) payé(s)');
  if (re.pauses) parts.push(re.pauses + ' site(s) en pause');
  if (re.notes.length) parts.push(re.notes.slice(0, 2).join(', '));
  if (V.branche()) {
    const e = await P.lireEtat(db);
    if (e.a_publier && !e.en_cours) { const p = await P.publier(db, { raison: 'livraison' }).catch(function (err) { return { resume: 'publication : ' + err.message }; }); parts.push(p.resume); }
  }
  const produit = pa.n + li.achats + li.enLigne + pr + re.liens + re.payes;
  return { resume: parts.length ? parts.join(' ; ') : 'Rien à livrer pour l\'instant.', produit: produit, prochain_min: 15, detail: { paiements: pa.n, domaines: li.achats, en_ligne: li.enLigne, renouvellements: re.payes } };
}

module.exports = { run, propositions, choisirDomaine, contact, identiteComplete, emailEnLigne, emailDns, emailPaiement, enLigne, renouvellements, echeance, TLD_ACHAT };
