// Lucas, Chargé de mise en ligne : publie les aperçus, relève les paiements Stripe, réserve le nom de domaine,
// met le site en ligne sur ce domaine, prévient le client, fait expirer les aperçus oubliés et facture l'hébergement
// des années suivantes. Tout seul. Aucune file plafonnée : chaque commande et chaque site payé sont vus à chaque passage.
// Emma et Lucas travaillent en même temps : chaque écriture part de la version fraîche du site (majFraiche).
'use strict';
const V = require('../sites/vercel');
const S = require('../sites/stripe');
const P = require('../sites/publication');
const R = require('../sites/rendu');
const MQ = require('../martinique');
const mail = require('../mail');
const { majFraiche } = require('../db');
const { NOVALEMO, BUDGET_DEFAUT, TZ } = require('../config');
const { court } = require('../util');

const iso = function (t) { return new Date(t || Date.now()).toISOString(); };
const JOUR = 86400000, HEURE = 3600000, AN = 365 * JOUR;
const SIGNE = 'Louis\nNovalemo, sites internet en Martinique';
const IPV4 = '76.76.21.21', CNAME = 'cname.vercel-dns.com';
const TLD_ACHAT = /\.(com|net|pro|site|online|services|business|company|shop|store|studio|boutique|restaurant|cafe|solar|plumbing|cleaning|construction|immo|fitness|beauty|salon|auto|taxi|tours|travel|boats|yachts|garden|energy|tech|digital|agency|events|photography|photo|video|consulting|repair|tools|supply|works)$/i;

async function identite(db) { const r = await db.one('hq_config', { eq: { key: 'identite' } }); return (r && r.value) || null; }
async function message(db, sujet, corps, kind) { await db.insert('hq_messages', { from_id: 'livraison', to_id: 'louis', company_id: 'novalemo', kind: kind || 'rapport', subject: court(sujet, 120), body: corps }, { returning: false }); }
async function lireCle(db, cle) { const r = await db.one('hq_config', { eq: { key: cle } }); return (r && r.value) || null; }
async function poserCle(db, cle, v) { await db.upsert('hq_config', { key: cle, value: v, updated_at: iso() }, { onConflict: 'key' }); }
const depuis = function (t) { return t ? Date.now() - new Date(t).getTime() : Infinity; };
const plusMois = function (t, n) { const d = new Date(t), j = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); d.setUTCDate(Math.min(j, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return d.getTime(); };
const ABO = NOVALEMO.abonnement;

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
const nomDe = function (s, lead) { return String((s.spec && s.spec.nom) || (lead && lead.name) || s.domaine || s.slug || '').replace(/\*\*/g, ''); };
const leadDe = async function (db, s) { return s.lead_id ? db.one('hq_leads', { eq: { id: s.lead_id } }) : null; };
// Écrit sur le site à partir de sa version fraîche, seulement s'il est encore dans l'un des statuts attendus.
// fn(fraiche, copie de ses data) rend le patch ; null si le site a bougé entre-temps (un autre agent est passé).
function maj(db, id, statuts, fn) {
  return majFraiche(db, 'hq_sites', id, function (f) { return statuts && statuts.indexOf(f.status) < 0 ? null : fn(f, Object.assign({}, f.data || {})); });
}

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
  const ab = site.data && site.data.abonnement;
  return 'Bonjour,\n\nMerci, ' + (ab ? 'votre abonnement ' + (f.nom || site.formule) + ' à ' + ab.mensualite_eur + ' € par mois est en place et le premier mois est réglé.' : 'votre paiement de ' + (site.montant_eur || f.prix) + ' € pour la formule ' + (f.nom || site.formule) + ' est bien reçu.') + (fac ? ' Votre facture : ' + fac : '') +
    (ab ? '\n\nLe paiement se fait ensuite tout seul chaque mois sur votre carte, avec une facture par email' + (ab.fin_auto ? ', ' + ABO.engagement_mois + ' mois en tout : après le ' + dateFr(ab.engagement_jusqu_au) + ', plus rien à payer pour le site, qui est à vous (seul l\'hébergement continue, ' + NOVALEMO.hebergement_an_eur + ' € par an).' : '. Engagement jusqu\'au ' + dateFr(ab.engagement_jusqu_au) + ', puis sans engagement.') : '') + '\n\n' +
    (site.domaine_mode === 'client' ? 'Votre site va être mis en ligne sur ' + site.domaine + '. Je vous envoie juste après le réglage à faire sur votre nom de domaine.' : 'Je réserve maintenant votre nom de domaine ' + (site.domaine || '') + ' et je mets le site en ligne dessus. Vous recevez un email dès qu\'il est visible, en général dans l\'heure.') +
    mentionsAFournir(site) +
    '\n\nPour une retouche, répondez simplement à cet email.';
}
// Ce que la loi impose sur son site et qu'on n'a pas encore (Margot) : demandé dans l'email, en une liste courte
function mentionsAFournir(site) {
  const q = require('../sites/juridique').questions((site && site.spec) || {});
  if (!q.length) return '';
  return '\n\nLa loi impose des mentions légales sur tout site. Pour compléter les vôtres, répondez simplement à cet email avec :\n' + q.map(function (x) { return '- ' + x.question; }).join('\n');
}
function emailDns(site) {
  const v = (site.data && site.data.verification) || [];
  return 'Bonjour,\n\nPour que votre site s\'affiche sur ' + site.domaine + ', il reste un réglage à faire chez l\'hébergeur de votre nom de domaine (OVH, Gandi, IONOS...), dans la zone DNS :\n\n' +
    '1. Un enregistrement A pour ' + site.domaine + ' vers ' + IPV4 + '\n2. Un enregistrement CNAME pour www.' + site.domaine + ' vers ' + CNAME + '\n' +
    v.map(function (x, k) { return (k + 3) + '. Un enregistrement ' + x.type + ' pour ' + x.domain + ' avec la valeur ' + x.value; }).join('\n') + '\n\n' +
    'Ne touchez pas aux enregistrements MX : vos emails continuent de fonctionner. Si quelqu\'un gère votre domaine pour vous, transférez-lui simplement ce message.\n\nDès que c\'est fait, le site s\'allume tout seul et je vous préviens.';
}
// Rappel du réglage DNS ; le client peut aussi prendre un nouveau nom de domaine, inclus (Emma le lui réserve)
function emailRappelDns(site, autre) {
  return 'Bonjour,\n\nVotre site est prêt, il n\'attend plus que le réglage du nom de domaine ' + site.domaine + '. Les deux lignes à ajouter dans la zone DNS, chez l\'hébergeur du domaine :\n\n1. A pour ' + site.domaine + ' vers ' + IPV4 + '\n2. CNAME pour www.' + site.domaine + ' vers ' + CNAME +
    '\n\nSi c\'est compliqué, répondez simplement « nouveau domaine » à cet email : je réserve ' + (autre ? autre + ' (ou le nom que vous voulez)' : 'un nouveau nom de domaine') + ' pour vous, inclus, et le site est en ligne dans l\'heure.';
}
function emailEnLigne(site, factureUrl) {
  const n = NOVALEMO.revisions_apres;
  const ab = site.data && site.data.abonnement;
  const JU = require('../sites/juridique');
  return 'Bonjour,\n\nVotre site est en ligne : https://' + site.domaine + '\n\nIl est hébergé, sécurisé (https) et visible sur téléphone comme sur ordinateur.' + (JU.complet(site.spec || {}) ? ' Les mentions légales sont en place.' : '') +
    (factureUrl ? '\n\nVotre facture : ' + factureUrl : '') +
    (ab ? '\n\nUne série de retouches est incluse chaque mois tant que l\'abonnement court : répondez à cet email avec ce que vous voulez changer (texte, photo, logo, horaires, une promotion du moment).' : '\n\nVous avez ' + n + ' séries de retouches incluses dans les 30 jours : répondez à cet email avec ce que vous voulez changer (texte, photo, logo, horaires).') +
    mentionsAFournir(site) +
    '\n\nMerci pour votre confiance.';
}
function emailApercuPromis(site) {
  return 'Bonjour,\n\nComme promis, voici l\'aperçu de votre site : ' + site.url_apercu + '\n\nDites-moi ce que vous en pensez. Je peux changer les textes, les couleurs, ajouter votre logo et vos photos : envoyez-les simplement en réponse à cet email.';
}

/* ── les étapes ── */
async function promesses(db) {
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

/* ── encaissement ── */
// Le relevé des paiements : une passe sur tout le compte Stripe (carte lien -> paiement) depuis le dernier relevé réussi
// moins 25 h (une session de paiement vit 24 h). Premier passage, Stripe muet, ou filet quotidien : carte nulle, et chaque
// lien est alors vérifié un par un ; le curseur n'avance qu'après une passe complète.
const CURSEUR = 'stripe:releve', FILET = 'stripe:filet';
async function releverPaiements(db) {
  const t0 = Date.now();
  if (!S.branche()) return { carte: null, t0: t0 };
  const c = await lireCle(db, CURSEUR), f = await lireCle(db, FILET);
  const dernier = c && c.le ? new Date(c.le).getTime() : null;
  const filet = depuis(f && f.le) > JOUR;
  if (dernier && !filet) {
    try {
      const carte = await S.payesDepuis(Math.max(dernier - 25 * HEURE, t0 - 60 * JOUR) / 1000);
      await poserCle(db, CURSEUR, { le: iso(t0) });
      return { carte: carte, t0: t0 };
    } catch (e) { return { carte: null, t0: t0, erreur: court(e.message, 120) }; }
  }
  return { carte: null, t0: t0, filet: true };
}
async function releveComplet(db, t0) { await poserCle(db, CURSEUR, { le: iso(t0) }); await poserCle(db, FILET, { le: iso(t0) }); }
// Ce lien a-t-il été payé ? Par la carte quand on l'a ; sinon Stripe, lien par lien ('doute' : Stripe n'a pas répondu)
async function payeSur(carte, lienId) {
  if (carte) return carte.get(lienId) || null;
  return S.paiement(lienId).catch(function () { return 'doute'; });
}

// La formule réellement payée : celle du lien payé (un client peut payer l'ancien lien d'une autre formule)
function formulePayee(lk, montant, defaut) {
  if (lk && lk.formule && NOVALEMO.grille[lk.formule]) return lk.formule;
  const k = Object.keys(NOVALEMO.grille).find(function (x) { return x !== 'menu' && (NOVALEMO.grille[x].prix === Number(montant) || NOVALEMO.grille[x].mois === Number(montant)); });
  return k || defaut;
}
function ordreLiens(tous) {
  return tous.map(function (x, k) { return { x: x, k: k }; }).sort(function (a, b) {
    const ca = a.x.cree_le || '', cb = b.x.cree_le || '';
    if (ca !== cb) return ca && cb ? (ca < cb ? 1 : -1) : b.k - a.k;
    return ((a.x.mode === 'mensuel') - (b.x.mode === 'mensuel')) || (b.k - a.k);
  }).map(function (o) { return o.x; });
}
async function paiements(db, carte, limite) {
  const out = { n: 0, tests: 0, complet: true };
  if (!S.branche()) return out;
  const commandes = await db.select('hq_sites', { eq: { status: 'commande' }, select: 'id,stripe', order: 'id.asc' });
  for (const c of commandes) {
    if (Date.now() > limite) { out.complet = false; break; }
    // la demande la plus récente d'abord (dernière formule demandée) ; pour une même demande, le paiement en une fois
    const tous = ordreLiens(S.liens(c.stripe));
    let p = null, lk = null;
    for (const x of tous) {
      const r = await payeSur(carte, x.id);
      if (r === 'doute') { out.complet = false; continue; }
      if (r) { p = r; lk = x; break; }
    }
    if (p) await encaisser(db, c.id, p, lk, out);
  }
  return out;
}
async function encaisser(db, id, p, lk, out) {
  let tous = [];
  if (p.test) {
    // paiement de test : la chaîne est prouvée, mais rien n'est acheté ni mis en ligne ; le site redevient un aperçu
    const s = await maj(db, id, ['commande'], function (f, d) {
      tous = S.liens(f.stripe);
      d.paiements_test = (d.paiements_test || []).concat([{ le: p.le || iso(), montant_eur: p.montant_eur, session: p.session }]).slice(-5);
      return { status: 'apercu', stripe: {}, data: d };
    });
    if (!s) return;
    for (const x of tous) await S.desactiver(x.id).catch(function () {});
    if (p.abonnement) await S.annulerAbonnement(p.abonnement).catch(function () {});
    out.tests++;
    await message(db, 'Paiement de test reçu : ' + p.montant_eur + ' €', 'La chaîne marche jusqu\'au paiement pour ' + nomDe(s) + '. Paiement de test : je n\'achète pas de domaine et ne mets rien en ligne, le site redevient un aperçu. Pour vendre pour de vrai : la clé live de Stripe dans HQ_STRIPE_KEY.', 'note');
    return;
  }
  const fac = p.invoice ? await S.facture(p.invoice).catch(function () { return null; }) : null;
  const voulu = p.domaine ? propre(p.domaine) : null;
  const mensuel = !!p.abonnement;
  let formule = null;
  const s = await maj(db, id, ['commande'], function (f, d) {
    const st = f.stripe || {};
    tous = S.liens(st);
    formule = formulePayee(lk, p.montant_eur, f.formule);
    d.revisions_au_paiement = f.revisions || 0;   // les retouches d'après la mise en ligne se comptent à partir d'ici
    if (mensuel) {
      const debut = p.le || iso();
      d.abonnement = { id: p.abonnement, client: p.client, mensualite_eur: p.montant_eur, debut: debut, engagement_jusqu_au: iso(plusMois(Date.parse(debut), ABO.engagement_mois)), statut: 'active', paye_eur: p.montant_eur, factures: p.invoice ? [p.invoice] : [] };
      // 12 mensualités, puis plus rien : l'arrêt est enregistré dès le départ, programmé chez Stripe au passage suivant
      if (ABO.fin_auto) Object.assign(d.abonnement, { resiliation_demandee: debut, fin_prevue: d.abonnement.engagement_jusqu_au, fin_auto: true });
    }
    const patch = { status: 'paye', paid_at: p.le || iso(), formule: formule, montant_eur: p.montant_eur || f.montant_eur, data: d,
      stripe: Object.assign({}, st, { session: p.session, intention: p.intention, paye_lien: lk.id, email: p.email, nom: p.nom, adresse: p.adresse, invoice: p.invoice, facture_url: fac && fac.url, facture_numero: fac && fac.numero, montant_paye: p.montant_eur }) };
    if (voulu && voulu !== f.domaine && f.domaine_mode !== 'client') patch.domaine = voulu;
    return patch;
  });
  if (!s) return;   // déjà passé ailleurs entre-temps : repris au prochain passage s'il le faut
  for (const x of tous) await S.desactiver(x.id).catch(function () {});
  // les mentions obligatoires (vendeur, TVA, pénalités) sur les factures des mois suivants
  if (mensuel && p.client) await S.piedClient(p.client, S.piedFacture((await identite(db)) || {}, true)).catch(function () {});
  out.n++;
  const lead = await leadDe(db, s);
  if (lead) await db.update('hq_leads', { status: 'client', updated_at: iso() }, { eq: { id: lead.id } });
  await ecrire(db, s, lead, destinataire(s, lead), 'Paiement reçu, mise en ligne en cours', emailPaiement(s));
  await message(db, 'Vente : ' + (mensuel ? p.montant_eur + ' € par mois' : p.montant_eur + ' €') + ' (' + ((NOVALEMO.grille[formule] || {}).nom || formule) + ', ' + nomDe(s) + ')', (mensuel ? 'Abonnement, engagement ' + ABO.engagement_mois + ' mois, premier mois payé par carte' : 'Payé par carte') + (p.email ? ' par ' + p.email : '') + '. Lucas réserve le domaine et met le site en ligne, rien à faire.', 'alerte');
}
// Un second paiement sur un ancien lien (page restée ouverte) : remboursé tout seul, le client est prévenu. Un abonnement
// en trop est d'abord arrêté pour de bon : tant que ce n'est pas fait, rien n'est remboursé ni noté (réessayé à chaque
// passage, Louis prévenu au troisième échec) ; un remboursement raté est réessayé de même.
const DOUBLONS = 'stripe:doublons';
async function arreterEtRembourser(p) {
  if (p.abonnement) {
    let err = null;
    await S.annulerAbonnement(p.abonnement).catch(function (e) { err = e.message; });
    if (err && !(await S.abonnementArrete(p.abonnement).catch(function () { return false; }))) return 'arrêt de l\'abonnement refusé : ' + err;
  }
  return S.rembourserPaiement(p).then(function () { return true; }).catch(function (e) { return /already been refunded|charge_already_refunded/i.test(e.message) ? true : e.message; });
}
async function doublons(db, carte) {
  if (!S.branche()) return 0;
  const attente = (await lireCle(db, DOUBLONS)) || {};          // site -> lien -> { essais, erreur, alerte }
  const champs = 'id,lead_id,slug,spec,stripe,data';
  const sites = await db.select('hq_sites', { in: { status: ['paye', 'livraison', 'en_ligne', 'pause'] }, gte: { paid_at: iso(Date.now() - 3 * JOUR) }, select: champs });
  const restants = Object.keys(attente).map(Number).filter(function (id) { return !sites.some(function (s) { return s.id === id; }); });
  if (restants.length) (await db.select('hq_sites', { in: { id: restants }, select: champs })).forEach(function (s) { sites.push(s); });
  let n = 0, change = false;
  for (const s of sites) {
    const st = s.stripe || {};
    if (!st.paye_lien || !st.session) continue;   // on ne rembourse que si l'on sait exactement quel paiement est le bon
    const garde = s.data && s.data.abonnement && s.data.abonnement.id;
    const enCours = attente[s.id] || {};
    for (const x of S.liens(st).filter(function (y) { return y.id !== st.paye_lien && (st.rembourses || []).indexOf(y.id) < 0; })) {
      const p = enCours[x.id] ? await S.paiement(x.id).catch(function () { return 'doute'; }) : await payeSur(carte, x.id);
      if (!p || p === 'doute' || p.session === st.session || p.test || (garde && p.abonnement === garde)) continue;
      const r = await arreterEtRembourser(p);
      if (r !== true) {
        const suivi = Object.assign({ essais: 0, depuis: iso() }, enCours[x.id] || {});
        suivi.essais++; suivi.erreur = court(String(r), 140);
        if (suivi.essais >= 3 && !suivi.alerte) {
          suivi.alerte = iso();
          await message(db, 'Double paiement : remboursement en échec (' + p.montant_eur + ' €)', nomDe(s) + ' a payé deux fois ; ' + (p.abonnement ? 'l\'arrêt de l\'abonnement en trop ou ' : '') + 'le remboursement automatique échoue (' + suivi.erreur + '). Je réessaie à chaque passage. Si ça dure : Stripe, Paiements, session ' + p.session + ', Rembourser' + (p.abonnement ? ' ; Abonnements, ' + p.abonnement + ', Annuler' : '') + '.', 'alerte');
        }
        enCours[x.id] = suivi; attente[s.id] = enCours; change = true;
        continue;
      }
      await majFraiche(db, 'hq_sites', s.id, function (f) { const fs = f.stripe || {}; return { stripe: Object.assign({}, fs, { rembourses: (fs.rembourses || []).concat([x.id]) }) }; });
      st.rembourses = (st.rembourses || []).concat([x.id]);
      if (enCours[x.id]) { delete enCours[x.id]; change = true; }
      if (attente[s.id] && !Object.keys(enCours).length) { delete attente[s.id]; change = true; }
      const lead = await leadDe(db, s);
      await ecrire(db, s, lead, p.email || destinataire(s, lead), 'Paiement en double remboursé', 'Bonjour,\n\nVotre site était déjà payé : le second paiement de ' + p.montant_eur + ' € vient d\'être remboursé en totalité, sur la même carte (quelques jours selon votre banque)' + (p.abonnement ? ', et cet abonnement en trop est arrêté : rien ne sera prélevé' : '') + '. Rien à faire de votre côté.');
      await message(db, 'Double paiement remboursé : ' + p.montant_eur + ' €', nomDe(s) + ' a payé deux fois ; le second paiement est remboursé automatiquement' + (p.abonnement ? ' et l\'abonnement en trop arrêté' : '') + ', client prévenu.', 'note');
      n++;
    }
  }
  if (change) await poserCle(db, DOUBLONS, attente);
  return n;
}

/* ── mise en ligne ── */
async function livrer(db, budget, limite) {
  const id = await identite(db);
  const out = { achats: 0, attente: 0, enLigne: 0, notes: [] };
  const maxUsd = Number((budget && budget.domaine_max_usd) || BUDGET_DEFAUT.domaine_max_usd);
  const projet = V.branche() ? await V.assurerProjet(await P.lireEtat(db)).catch(function () { return null; }) : null;
  if (!projet) { if (V.branche()) out.notes.push('hébergement injoignable'); return out; }
  // 1. payés : on fixe le domaine (le leur, ou un à réserver)
  for (const s0 of await db.select('hq_sites', { eq: { status: 'paye' }, select: 'id', order: 'paid_at.asc' })) {
    if (Date.now() > limite) { out.notes.push('suite au prochain passage'); break; }
    const s = await db.one('hq_sites', { eq: { id: s0.id } });
    if (!s || s.status !== 'paye') continue;
    const lead = await leadDe(db, s);
    const d0 = s.data || {};
    if (s.domaine_mode === 'client' && s.domaine) {
      const ajout = await V.ajouterDomaine(projet.id, s.domaine).catch(function (e) { return { erreur: court(e.message, 200) }; });
      if (!ajout.erreur) await V.ajouterDomaine(projet.id, 'www.' + s.domaine, s.domaine).catch(function () {});
      const n = await maj(db, s.id, ['paye'], function (f, d) {
        d.domaine_ajoute = !ajout.erreur; d.erreur_domaine = ajout.erreur || null; d.ajout_le = iso();
        // domaine déjà connu ailleurs chez Vercel : une preuve TXT est demandée en plus
        if (!ajout.erreur && ajout.verified === false && Array.isArray(ajout.verification)) d.verification = ajout.verification.map(function (x) { return { type: x.type, domain: x.domain, value: x.value }; }).slice(0, 2);
        d.live = true; d.dns_demande = iso();
        return { status: 'livraison', data: d };
      });
      if (!n) continue;
      await ecrire(db, n, lead, destinataire(n, lead), 'Dernier réglage pour ' + n.domaine, emailDns(n));
      out.attente++;
      continue;
    }
    // une commande de domaine existe déjà (passage coupé, ou retour en arrière) : on ne paie jamais deux fois
    if (d0.commande) { await maj(db, s.id, ['paye'], function (f, d) { return d.commande ? { status: 'livraison', domaine: d.commande.domaine || f.domaine, domaine_mode: 'achat' } : null; }); out.attente++; continue; }
    if (!identiteComplete(id)) {
      if (!d0.alerte_identite) { await message(db, 'Identité de vente à compléter', 'Un client a payé mais je ne peux pas réserver son nom de domaine sans ton identité de vente (nom, adresse, téléphone). Tour, Réglages, Identité de vente : une seule fois.', 'alerte'); await maj(db, s.id, ['paye'], function (f, d) { d.alerte_identite = iso(); return { data: d }; }); }
      out.notes.push('identité de vente manquante'); continue;
    }
    // un achat a peut-être été lancé sans réponse (passage coupé juste après) : on regarde dans le compte avant tout
    if (d0.achat) {
      if (depuis(d0.achat.le) < 10 * 60000) { out.attente++; continue; }
      const etat = await etatAchat(d0.achat);
      if (etat === 'attente') { out.attente++; continue; }
      if (etat === 'achete') {
        await maj(db, s.id, ['paye'], function (f, d) { if (!d.achat) return null; d.commande = { id: null, domaine: d.achat.domaine, prix_usd: d.achat.prix, le: d.achat.le, recupere: true }; return { status: 'livraison', domaine: d.achat.domaine, domaine_mode: 'achat', data: d }; });
        out.achats++; continue;
      }
      const rate = d0.achat.domaine;
      await maj(db, s.id, ['paye'], function (f, d) { delete d.achat; if (etat === 'rate') d.commande_ratee = (d.commande_ratee || []).concat([rate]); return { data: d }; });
      if (etat === 'rate') await message(db, 'Achat de domaine sans réponse : ' + rate, 'La commande de ' + rate + ' n\'a jamais été confirmée et le nom n\'est pas dans le compte Vercel. J\'en prends un autre. Si ' + rate + ' apparaît plus tard dans Vercel (Domains), il ne sert à rien : tu peux couper son renouvellement.', 'note');
      continue;   // nouvel essai propre au prochain passage
    }
    // trois commandes ratées de suite : c'est le moyen de paiement du compte Vercel, pas le nom ; un essai par jour
    if ((d0.commande_ratee || []).length >= 3) {
      if (!d0.alerte_ratees) { await maj(db, s.id, ['paye'], function (f, d) { d.alerte_ratees = iso(); return { data: d }; }); await message(db, 'Domaines : trois commandes refusées', 'Trois commandes de nom de domaine ont échoué pour ' + nomDe(s, lead) + ' (' + d0.commande_ratee.join(', ') + '). C\'est presque toujours la carte du compte Vercel : vercel.com, Settings, Billing. Dès qu\'elle passe, je reprends seul.', 'alerte'); out.notes.push('commandes de domaine refusées'); continue; }
      if (depuis(d0.alerte_ratees) < JOUR) { out.notes.push('commandes de domaine refusées'); continue; }
      await maj(db, s.id, ['paye'], function (f, d) { d.commande_ratee = []; delete d.alerte_ratees; return { data: d }; });
      continue;
    }
    const choix = await choisirDomaine(propre(s.domaine), nomDe(s, lead), maxUsd, d0.commande_ratee);
    if (!choix) { out.notes.push('aucun domaine libre pour ' + s.slug); if (!d0.alerte_domaine) { await message(db, 'Domaine introuvable', 'Aucun nom de domaine libre sous ' + maxUsd + ' $ pour ' + nomDe(s, lead) + '. Je réessaie au prochain passage.', 'alerte'); await maj(db, s.id, ['paye'], function (f, d) { d.alerte_domaine = iso(); return { data: d }; }); } continue; }
    // l'intention d'achat est écrite AVANT d'acheter : si le passage est coupé, on saura qu'un achat a pu partir
    const pose = await maj(db, s.id, ['paye'], function (f, d) { if (d.achat || d.commande) return null; d.achat = { domaine: choix.domaine, prix: choix.prix, le: iso() }; return { data: d }; });
    if (!pose) continue;
    try {
      const c = await V.acheter(choix.domaine, choix.prix, contact(id, mail.identite().adresse));
      await maj(db, s.id, ['paye'], function (f, d) { d.commande = { id: c.orderId, domaine: choix.domaine, prix_usd: choix.prix, le: iso() }; return { status: 'livraison', domaine: choix.domaine, domaine_mode: 'achat', data: d }; });
      out.achats++;
    } catch (e) {
      // refus explicite du registrar (prix, contact, extension) : rien n'a été acheté, on pourra réessayer avec un autre nom
      const refus = e.statut >= 400 && e.statut < 500;
      await maj(db, s.id, ['paye'], function (f, d) { if (refus) { delete d.achat; d.commande_ratee = (d.commande_ratee || []).concat([choix.domaine]); } d.erreur_achat = court(e.message, 200); if (refus && !d.alerte_achat) d.alerte_achat = iso(); return { data: d }; });
      out.notes.push('achat refusé : ' + court(e.message, 80));
      if (refus && !d0.alerte_achat) await message(db, 'Achat de domaine refusé', choix.domaine + ' : ' + court(e.message, 200) + '. Je réessaie avec un autre nom au prochain passage.', 'alerte');
    }
  }
  // 2. en livraison : commande du domaine, puis domaine branché, puis site servi
  for (const s0 of await db.select('hq_sites', { eq: { status: 'livraison' }, select: 'id', order: 'paid_at.asc' })) {
    if (Date.now() > limite) { out.notes.push('suite au prochain passage'); break; }
    const s = await db.one('hq_sites', { eq: { id: s0.id } });
    if (!s || s.status !== 'livraison') continue;
    const d0 = s.data || {};
    if (s.domaine_mode === 'achat' && d0.commande && !d0.domaine_pret) {
      const etat = await etatCommande(d0.commande);
      if (etat === 'attente') {
        out.attente++;
        if (depuis(d0.commande.le) > 24 * HEURE && !d0.alerte_commande) { await maj(db, s.id, ['livraison'], function (f, d) { d.alerte_commande = iso(); return { data: d }; }); await message(db, 'Commande de domaine en attente : ' + d0.commande.domaine, 'La commande de ' + d0.commande.domaine + ' n\'est pas confirmée après 24 h. Je continue de vérifier ; si elle reste bloquée, regarde vercel.com, Domains.', 'alerte'); }
        continue;
      }
      if (etat === 'rate') {
        const rate = d0.commande.domaine;
        const n = await maj(db, s.id, ['livraison'], function (f, d) { d.commande_ratee = (d.commande_ratee || []).concat([rate]); delete d.commande; delete d.achat; return { status: 'paye', domaine: null, data: d }; });
        if (n && n.data.commande_ratee.length === 1) await message(db, 'Commande de domaine ratée : ' + rate, 'La commande de ' + rate + ' a échoué chez Vercel. Je passe à un autre nom, rien à faire pour l\'instant.', 'alerte');
        out.notes.push('commande de domaine ratée, nouvel essai'); continue;
      }
      const a1 = await V.ajouterDomaine(projet.id, s.domaine).then(function () { return true; }).catch(function () { return false; });
      if (a1) await V.ajouterDomaine(projet.id, 'www.' + s.domaine, s.domaine).catch(function () {});
      if (!a1) { out.attente++; continue; }   // nouvel essai au prochain passage
      await maj(db, s.id, ['livraison'], function (f, d) { d.domaine_pret = iso(); d.live = true; return { data: d }; });
      await P.ecrireEtat(db, { a_publier: true });
      out.attente++; continue;
    }
    if (!d0.live) { await maj(db, s.id, ['livraison'], function (f, d) { d.live = true; return { data: d }; }); await P.ecrireEtat(db, { a_publier: true }); continue; }
    if (!d0.live_publie) { out.attente++; continue; }
    // son domaine à lui : relié au projet (nouvel essai toutes les heures si ça avait échoué), puis on attend son réglage DNS
    const client = s.domaine_mode === 'client';
    const age = depuis(d0.dns_demande || s.paid_at || s.updated_at);
    if (client && d0.domaine_ajoute === false) {
      if (depuis(d0.ajout_le) < HEURE) { out.attente++; continue; }
      const ajout = await V.ajouterDomaine(projet.id, s.domaine).catch(function (e) { return { erreur: court(e.message, 200) }; });
      if (!ajout.erreur) await V.ajouterDomaine(projet.id, 'www.' + s.domaine, s.domaine).catch(function () {});
      await maj(db, s.id, ['livraison'], function (f, d) {
        d.domaine_ajoute = !ajout.erreur; d.erreur_domaine = ajout.erreur || null; d.ajout_le = iso();
        if (!ajout.erreur && ajout.verified === false && Array.isArray(ajout.verification)) d.verification = ajout.verification.map(function (x) { return { type: x.type, domain: x.domain, value: x.value }; }).slice(0, 2);
        if (ajout.erreur && age > JOUR && !d.alerte_ajout) d.alerte_ajout = iso();
        return { data: d };
      });
      if (ajout.erreur && age > JOUR && !d0.alerte_ajout) await message(db, 'Domaine du client impossible à relier : ' + s.domaine, 'Vercel refuse ' + s.domaine + ' pour ' + nomDe(s) + ' (' + ajout.erreur + '). Je réessaie toutes les heures ; le client peut aussi prendre un nouveau nom inclus en répondant à nos emails.', 'alerte');
      out.attente++; continue;
    }
    // vérifié à chaque passage la première semaine, puis toutes les 6 heures (un client qui ne fait jamais le réglage ne bloque personne)
    if (client && age > 7 * JOUR && depuis(d0.dns_verifie_le) < 6 * HEURE) { out.attente++; continue; }
    let pret = false;
    if (d0.verification && d0.verification.length) await V.verifierDomaine(projet.id, s.domaine).catch(function () {});
    const cfg = await V.configDomaine(s.domaine).catch(function () { return null; });
    if (cfg && cfg.misconfigured === false) pret = await enLigne(s.domaine, s.spec && s.spec.nom);
    if (!pret) {
      out.attente++;
      if (client) {
        const lead = await leadDe(db, s);
        const rappels = d0.rappels_dns || 0;
        const seuil = [3, 7, 14, 30][rappels];
        const du = seuil != null && age > seuil * JOUR;
        if (du || age > 7 * JOUR) await maj(db, s.id, ['livraison'], function (f, d) { if (age > 7 * JOUR) d.dns_verifie_le = iso(); if (du) d.rappels_dns = rappels + 1; return { data: d }; });
        if (du) {
          const autre = propositions(nomDe(s, lead))[0];
          await ecrire(db, s, lead, destinataire(s, lead), 'Votre site attend son nom de domaine', emailRappelDns(s, autre !== s.domaine ? autre : null));
          if (rappels + 1 === 2) await message(db, 'Domaine du client pas encore réglé : ' + s.domaine, nomDe(s, lead) + ' a payé il y a une semaine mais n\'a pas fait le réglage DNS de ' + s.domaine + '. Il a reçu le réglage et deux rappels, avec la possibilité de prendre un nouveau nom inclus. Je relance à 14 et 30 jours et je vérifie toutes les 6 heures. Rien à faire.', 'note');
        }
      } else if (depuis(d0.domaine_pret || s.updated_at) > 48 * HEURE && !d0.alerte_lent) {
        await message(db, 'Mise en ligne lente : ' + s.domaine, 'Le domaine est réservé et branché depuis 48 h mais ne répond pas encore. Je continue de vérifier.', 'alerte');
        await maj(db, s.id, ['livraison'], function (f, d) { d.alerte_lent = iso(); return { data: d }; });
      }
      continue;
    }
    const url = 'https://' + s.domaine + '/';
    const n = await maj(db, s.id, ['livraison'], function () { return { status: 'en_ligne', live_at: iso(), url_finale: url }; });
    if (!n) continue;
    const lead = await leadDe(db, s);
    await ecrire(db, n, lead, destinataire(n, lead), 'Votre site est en ligne', emailEnLigne(n, n.stripe && n.stripe.facture_url));
    await message(db, 'Site en ligne : ' + s.domaine, nomDe(s, lead) + ' est en ligne sur ' + url + '. Client prévenu, facture envoyée.', 'evenement');
    out.enLigne++;
  }
  return out;
}
// Où en est une commande de domaine ? 'achete', 'attente' ou 'rate'
async function etatCommande(cmd) {
  if (!cmd.id) { const c = await V.domaineAuCompte(cmd.domaine).catch(function () { return 'doute'; }); return c && c !== 'doute' ? 'achete' : 'attente'; }
  const c = await V.commande(cmd.id).catch(function () { return null; });
  if (!c || c.status === 'draft' || c.status === 'purchasing') return 'attente';
  return c.status === 'failed' ? 'rate' : 'achete';
}
// Un achat parti sans réponse : dans le compte = acheté ; encore libre = jamais parti ; sinon on attend 2 h, puis raté
async function etatAchat(achat) {
  const compte = await V.domaineAuCompte(achat.domaine).catch(function () { return 'doute'; });
  if (compte === 'doute') return 'attente';
  if (compte) return 'achete';
  const libre = await V.disponible(achat.domaine).catch(function () { return null; });
  if (libre === null) return 'attente';
  if (libre) return 'libre';
  return depuis(achat.le) < 2 * HEURE ? 'attente' : 'rate';
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

/* ── expirations (toutes les 3 heures, tout est lu, rien n'est plafonné) ── */
async function expirer(db, opts) {
  opts = opts || {};
  const etat = await lireCle(db, 'expiration');
  if (!opts.force && depuis(etat && etat.le) < 3 * HEURE) return 0;
  const jours = NOVALEMO.apercu_jours * JOUR;
  let n = 0;
  const vieux = await db.select('hq_sites', { eq: { status: 'apercu' }, lte: { published_at: iso(Date.now() - jours) }, select: 'id,lead_id' });
  const ids = vieux.map(function (s) { return s.lead_id; }).filter(Boolean).filter(function (x, k, a) { return a.indexOf(x) === k; });
  const leads = new Map();
  for (let k = 0; k < ids.length; k += 150) (await db.select('hq_leads', { in: { id: ids.slice(k, k + 150) }, select: 'id,status,contacted_at' })).forEach(function (l) { leads.set(l.id, l); });
  for (const s of vieux) {
    const l = s.lead_id ? leads.get(s.lead_id) : null;
    if (l && ['repondu', 'interesse'].indexOf(l.status) >= 0) continue;
    if (l && l.contacted_at && depuis(l.contacted_at) < jours) continue;   // 30 jours après le premier email
    if (l && !l.contacted_at && l.status === 'a_contacter') continue;      // pas encore envoyé : on garde
    const r = await db.update('hq_sites', { status: 'expire', updated_at: iso() }, { eq: { id: s.id, status: 'apercu' } });
    if (!r.length) continue;
    if (l) await db.update('hq_leads', { apercu_etat: 'expire', updated_at: iso() }, { eq: { id: l.id } });
    n++;
  }
  // un lien de paiement jamais utilisé 45 jours après sa création : on le coupe et l'aperçu disparaît
  // (jamais si un paiement existe ou si Stripe ne répond pas)
  for (const s of await db.select('hq_sites', { eq: { status: 'commande' }, select: 'id,lead_id,stripe,updated_at' })) {
    if (depuis((s.stripe && s.stripe.cree_le) || s.updated_at) < 45 * JOUR) continue;
    const tous = S.liens(s.stripe);
    if (tous.length && !S.branche()) continue;
    let garder = false;
    for (const x of tous) { const p = await S.paiement(x.id).catch(function () { return 'doute'; }); if (p) garder = true; }
    if (garder) continue;
    const r = await maj(db, s.id, ['commande'], function (f) { return { status: 'expire', stripe: Object.assign({}, f.stripe || {}, { lien: null, url: null, liens: S.liens(f.stripe) }) }; });
    if (!r) continue;
    for (const x of tous) await S.desactiver(x.id).catch(function () {});
    if (s.lead_id) await db.update('hq_leads', { apercu_etat: 'expire', updated_at: iso() }, { eq: { id: s.lead_id } });
    n++;
  }
  await poserCle(db, 'expiration', { le: iso() });
  if (n) await P.ecrireEtat(db, { a_publier: true });
  return n;
}

// Un paiement abouti sur le lien d'un site qui n'attendait plus rien (aperçu expiré entre-temps, commande annulée) :
// un aperçu expiré redevient une commande et le paiement est encaissé normalement ; une commande annulée est remboursée,
// son abonnement arrêté d'abord. Un échec n'est jamais abandonné : réessayé à chaque passage (même après que le paiement
// a quitté le relevé des dernières 25 h), Louis prévenu au troisième.
async function orphelins(db, carte) {
  const vus = (await lireCle(db, 'stripe:orphelins')) || { sessions: [] };
  vus.attente = vus.attente || {};
  delete vus.essais;
  const enAttente = Object.keys(vus.attente);
  if ((!carte || !carte.size) && !enAttente.length) return 0;
  const lot = carte ? Array.from(carte.values()) : [];
  for (const session of enAttente) {
    if (lot.some(function (p) { return p.session === session; })) continue;
    const p = await S.paiement(vus.attente[session].lien).catch(function () { return null; });
    if (p && p.session === session) lot.push(p);
  }
  let n = 0, change = false;
  for (const p of lot) {
    if (!p.site_id || p.origine !== 'la-tour' || p.test || vus.sessions.indexOf(p.session) >= 0) continue;
    const s = await db.one('hq_sites', { eq: { id: p.site_id }, select: 'id,lead_id,status,stripe,data,slug,spec' });
    if (!s || ['expire', 'annule'].indexOf(s.status) < 0 || !S.liens(s.stripe).some(function (x) { return x.id === p.lien; })) {
      if (vus.attente[p.session]) { delete vus.attente[p.session]; change = true; }
      continue;
    }
    if (s.status === 'expire') {
      vus.sessions = vus.sessions.concat([p.session]).slice(-300); change = true;
      await maj(db, s.id, ['expire'], function (f) { return { status: 'commande', stripe: Object.assign({}, f.stripe || {}, { lien: p.lien, cree_le: iso() }) }; });
      await message(db, 'Paiement sur un aperçu expiré : ' + nomDe(s), 'Le client a payé un lien de ' + p.montant_eur + ' € juste après l\'expiration de son aperçu : la commande est rouverte et encaissée normalement, rien à faire.', 'note');
      n++;
      continue;
    }
    const r = await arreterEtRembourser(p);
    if (r !== true) {
      const a = vus.attente[p.session] = Object.assign({ lien: p.lien, site_id: p.site_id, essais: 0, depuis: iso() }, vus.attente[p.session] || {});
      a.essais++; a.erreur = court(String(r), 140); change = true;
      if (a.essais === 3) await message(db, 'Paiement à rembourser : ' + p.montant_eur + ' € (commande annulée)', nomDe(s) + ' a payé une commande annulée ; ' + (p.abonnement ? 'l\'arrêt de l\'abonnement ou ' : '') + 'le remboursement automatique échoue (' + a.erreur + '). Je réessaie à chaque passage. Si ça dure : Stripe, Paiements, session ' + p.session + ', Rembourser' + (p.abonnement ? ' ; Abonnements, ' + p.abonnement + ', Annuler' : '') + '.', 'alerte');
      continue;
    }
    delete vus.attente[p.session];
    vus.sessions = vus.sessions.concat([p.session]).slice(-300); change = true;
    const lead = await leadDe(db, s);
    await ecrire(db, s, lead, p.email || destinataire(s, lead), 'Paiement remboursé', 'Bonjour,\n\nCette commande avait été annulée : votre paiement de ' + p.montant_eur + ' € vient d\'être remboursé en totalité, sur la même carte (quelques jours selon votre banque)' + (p.abonnement ? ', et l\'abonnement est arrêté : rien ne sera prélevé' : '') + '. Pour reprendre votre site, répondez simplement à cet email.');
    await message(db, 'Paiement remboursé (commande annulée) : ' + p.montant_eur + ' €', nomDe(s) + ' a payé une commande annulée. Remboursé automatiquement' + (p.abonnement ? ', abonnement arrêté' : '') + ', client prévenu.', 'note');
    n++;
  }
  if (change) await poserCle(db, 'stripe:orphelins', vus);
  return n;
}

/* ── les abonnements au mois : facture chaque mois, impayés, fin d'engagement, résiliation, reprise ── */
// Stripe prélève tout seul chaque mois et retente une carte refusée. Lucas, une fois par heure (à chaque passage si une
// reprise est en attente), lit tous les abonnements en une passe et :
// - envoie au client la facture de chaque mois payé, même réglé après coup (carte refusée puis réglée, relance réussie) ;
// - prélèvement refusé : prévient le client avec le lien pour régler, rappel au bout de 7 jours, site en pause au bout
//   de 14 jours ; il revient seul dès que c'est réglé, dans l'état où il était (un site encore en livraison y retourne) ;
// - abonnement arrêté par Stripe faute de paiement : factures encore ouvertes annulées, site en pause, lien pour reprendre ;
// - un mois avant la fin de l'engagement : le client est prévenu que l'abonnement continue au mois, sans engagement ;
// - arrêt demandé par le client : programmé chez Stripe à la fin d'un mois payé, jamais avant la fin de l'engagement ;
//   à l'arrêt, le site reste à lui et l'hébergement passe à 25 € par an.
const ETAT_ABO = 'stripe:abonnements';
const STATUTS_ABO = ['paye', 'livraison', 'en_ligne', 'pause'];
// Quand un arrêt demandé prend effet : { fin_periode } engagement passé, fin du mois en cours ; { t } fin du mois payé qui
// couvre la fin de l'engagement ; null : début des périodes encore inconnu (relu chez Stripe au passage suivant)
function momentArret(a, ancre) {
  const finEng = Date.parse(a.engagement_jusqu_au || '') || 0;
  if (Date.now() >= finEng - JOUR) return { fin_periode: true };
  const t0 = Date.parse(ancre || '') || 0;
  if (!t0) return null;
  let k = 1;
  while (plusMois(t0, k) < finEng - JOUR && k < 120) k++;
  return { t: plusMois(t0, k) };
}
async function programmerArret(a, ancre) {
  const m = momentArret(a, ancre);
  if (!m) throw new Error('début de l\'abonnement inconnu');
  if (m.fin_periode) { const r = await S.resilierFinPeriode(a.id); return { fin: r.fin_periode || null }; }
  await S.arreterLe(a.id, (m.t - HEURE) / 1000);   // une heure avant la mensualité suivante : elle n'est jamais créée
  return { fin: iso(m.t) };
}
// Fin voulue : demandée par le client (enregistrée avant l'appel à Stripe) ou depuis le tableau de bord Stripe ;
// sinon arrêt faute de paiement (ou litige)
function finVoulue(a, sub) {
  // arrêté par Stripe faute de paiement (ou litige) : jamais une fin voulue, même si le client avait demandé l'arrêt pour plus
  // tard (il doit encore les mois de son engagement : pause et lien de reprise, comme tout impayé)
  if (sub && (sub.raison_fin === 'payment_failed' || sub.raison_fin === 'payment_disputed')) return false;
  return !!(a.resiliation_demandee || (sub && sub.fin_voulue));
}
// Le statut d'un site qui sort de pause : celui d'avant la pause
function sortiePause(f, d) { const avant = d.statut_avant_pause || (f.live_at ? 'en_ligne' : 'livraison'); delete d.statut_avant_pause; return avant; }
const deja = function (e) { return /already been refunded|charge_already_refunded/i.test(String(e && e.message || e)); };

async function abonnements(db, carte, limite) {
  const out = { factures: 0, impayes: 0, pauses: 0, reprises: 0, fins: 0, notes: [] };
  if (!S.branche()) return out;
  const sites = (await db.select('hq_sites', { in: { status: STATUTS_ABO }, select: 'id,status,data' })).filter(function (x) { return x.data && x.data.abonnement && x.data.abonnement.id; });
  if (!sites.length) return out;
  const etat = (await lireCle(db, ETAT_ABO)) || {};
  const reprise = sites.some(function (x) { return x.data.abonnement.lien_reprise; });
  if (depuis(etat.le) < HEURE && !reprise) return out;
  let compte;
  try { compte = await S.abonnementsCompte(); } catch (e) { out.notes.push('abonnements : ' + court(e.message, 60)); return out; }
  // les factures payées des 60 derniers jours, quel que soit le jour du paiement ; celles déjà envoyées sont notées sur le site
  const factures = await S.facturesPayees((Date.now() - 60 * JOUR) / 1000).catch(function () { return null; });
  const t0 = iso();
  let manquants = 0, idCache;
  for (const x of sites) {
    if (Date.now() > limite) { out.notes.push('abonnements : suite au prochain passage'); break; }
    const s = await db.one('hq_sites', { eq: { id: x.id } });
    const a = s && s.data && s.data.abonnement;
    if (!a) continue;
    const lead = await leadDe(db, s);
    const dest = destinataire(s, lead);
    const nom = nomDe(s, lead);
    const enLigneAvant = s.status === 'en_ligne';
    const ecrireAbo = function (fn, patch) { return maj(db, s.id, STATUTS_ABO, function (f, d) { if (!d.abonnement || d.abonnement.id !== a.id) return null; fn(d.abonnement, d, f); return Object.assign({ data: d }, (typeof patch === 'function' ? patch(f, d) : patch) || {}); }); };
    const pauser = function (f, d) { if (f.status === 'pause') return null; d.statut_avant_pause = f.status; return { status: 'pause' }; };
    // 1. une reprise d'abonnement payée : nouveau numéro d'abonnement, le site revient
    if (a.lien_reprise) {
      const p = await payeSur(carte, a.lien_reprise);
      if (p && p !== 'doute' && p.abonnement && !p.test) {
        await S.desactiver(a.lien_reprise).catch(function () {});
        const n = await maj(db, s.id, STATUTS_ABO, function (f, d) {
          const ab = d.abonnement || {};
          if (ab.id !== a.id) return null;
          d.abonnement = Object.assign({}, ab, { id: p.abonnement, client: p.client || ab.client, statut: 'active', paye_eur: Math.round(((ab.paye_eur || 0) + p.montant_eur) * 100) / 100, factures: (ab.factures || []).concat(p.invoice ? [p.invoice] : []).slice(-36), anciens: (ab.anciens || []).concat([ab.id]).slice(-5) });
          ['lien_reprise', 'url_reprise', 'url_impaye', 'impaye_le', 'relance_le', 'pause_le'].forEach(function (k) { delete d.abonnement[k]; });
          return f.status === 'pause' ? { data: d, status: sortiePause(f, d) } : { data: d };
        });
        if (n) {
          const revient = n.status === 'en_ligne';
          if (s.status === 'pause' && revient) await P.ecrireEtat(db, { a_publier: true });
          if (s.domaine_mode === 'achat' && revient) await V.autoRenouvellement(s.domaine, true).catch(function () {});
          if (p.client) await S.piedClient(p.client, S.piedFacture((await identite(db)) || {}, true)).catch(function () {});
          await ecrire(db, n, lead, dest, revient ? 'Votre site est de nouveau en ligne' : 'Votre abonnement est repris', 'Bonjour,\n\nMerci, votre abonnement est repris et le mois est réglé' + (revient ? ' : https://' + s.domaine + ' revient en ligne d\'ici quelques minutes.' : '. La mise en ligne de votre site reprend : vous recevez le lien dès qu\'il est en ligne.'));
          await message(db, 'Abonnement repris : ' + nom, 'Le client a repris son abonnement (' + p.montant_eur + ' € par mois). ' + (revient ? 'Site remis en ligne' : 'Mise en ligne reprise') + ', rien à faire.', 'note');
          out.reprises++;
        }
        continue;
      }
    }
    const sub = compte.get(a.id);
    if (!sub) { if (!a.lien_reprise) manquants++; continue; }
    // le vrai début des périodes chez Stripe : l'engagement se compte à partir de lui (abonnement d'origine seulement)
    if (sub.ancre && !a.ancre && !(a.anciens && a.anciens.length)) {
      const fe = iso(plusMois(Date.parse(sub.ancre), ABO.engagement_mois));
      if (await ecrireAbo(function (ab) { ab.ancre = sub.ancre; ab.engagement_jusqu_au = fe; })) { a.ancre = sub.ancre; a.engagement_jusqu_au = fe; }
    }
    const voulue = finVoulue(a, sub);
    const arrete = sub.statut === 'canceled' || sub.statut === 'incomplete_expired';
    // 2. la facture de chaque mois payé, envoyée au client
    if (factures) {
      for (const f of factures.filter(function (y) { return y.abonnement === a.id && (a.factures || []).indexOf(y.id) < 0; })) {
        if (arrete && !voulue && sub.annule_le && f.paye_le > sub.annule_le) {
          // un mois réglé après l'arrêt de l'abonnement (facture restée ouverte) : il ne remettrait rien en ligne, remboursé
          const r = await S.rembourserPaiement({ intention: f.intention, invoice: f.id }).then(function () { return true; }).catch(function (e) { return deja(e) ? true : e.message; });
          if (r !== true) { out.notes.push('remboursement après arrêt : ' + court(String(r), 60)); continue; }
          await ecrireAbo(function (ab) { ab.factures = (ab.factures || []).concat([f.id]).slice(-36); ab.rembourses = (ab.rembourses || []).concat([f.id]).slice(-12); });
          a.factures = (a.factures || []).concat([f.id]);
          await ecrire(db, s, lead, dest, 'Paiement remboursé', 'Bonjour,\n\nVotre abonnement était déjà arrêté quand ce paiement de ' + f.montant_eur + ' € est arrivé : il vous est remboursé en totalité, sur la même carte (quelques jours selon votre banque).' + (a.url_reprise ? ' Pour remettre le site en ligne, l\'abonnement se reprend ici : ' + a.url_reprise : ' Le lien pour reprendre l\'abonnement suit par email.'));
          await message(db, 'Paiement remboursé (abonnement déjà arrêté) : ' + nom, f.montant_eur + ' € réglés après l\'arrêt de l\'abonnement : remboursés automatiquement, le client a le lien de reprise. Rien à faire.', 'note');
          continue;
        }
        await ecrireAbo(function (ab) { ab.factures = (ab.factures || []).concat([f.id]).slice(-36); ab.paye_eur = Math.round(((ab.paye_eur || 0) + f.montant_eur) * 100) / 100; });
        a.factures = (a.factures || []).concat([f.id]);
        await ecrire(db, s, lead, dest, 'Votre facture ' + new Date(f.le).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: TZ }), 'Bonjour,\n\nLe mois de votre abonnement (' + f.montant_eur + ' €) est réglé. Votre facture : ' + f.url + '\n\nUne retouche à faire ce mois-ci ? Répondez simplement à cet email.');
        out.factures++;
      }
    }
    // 3. tout va bien
    if (sub.statut === 'active' || sub.statut === 'trialing') {
      if (a.statut !== 'active' || s.status === 'pause' && a.pause_le) {
        const reprend = s.status === 'pause' && a.pause_le;
        const n = await ecrireAbo(function (ab) { ab.statut = 'active'; delete ab.impaye_le; delete ab.relance_le; delete ab.pause_le; delete ab.url_impaye; }, function (f, d) { return reprend && f.status === 'pause' ? { status: sortiePause(f, d) } : null; });
        if (reprend && n) {
          const revient = n.status === 'en_ligne';
          if (revient) { await P.ecrireEtat(db, { a_publier: true }); if (s.domaine_mode === 'achat') await V.autoRenouvellement(s.domaine, true).catch(function () {}); }
          await ecrire(db, s, lead, dest, revient ? 'Votre site est de nouveau en ligne' : 'Paiement reçu, la mise en ligne reprend', 'Bonjour,\n\nMerci, le paiement est réglé' + (revient ? ' : https://' + s.domaine + ' revient en ligne d\'ici quelques minutes.' : '. La mise en ligne de votre site reprend : vous recevez le lien dès qu\'il est en ligne.'));
          out.reprises++;
        }
      }
      // les mentions des factures mensuelles (version 2) posées une fois sur chaque abonné, anciens compris
      if (a.client && a.pied !== 2) {
        if (idCache === undefined) idCache = (await identite(db)) || {};
        if (await S.piedClient(a.client, S.piedFacture(idCache, true)).then(function () { return true; }).catch(function () { return false; })) await ecrireAbo(function (ab) { ab.pied = 2; });
      }
      // arrêt demandé, pas encore enregistré chez Stripe (Stripe muet au moment de la demande) : programmé maintenant
      if (a.resiliation_demandee && !sub.fin_voulue) {
        const r = await programmerArret(a, sub.ancre).catch(function (e) { return { erreur: e.message }; });
        if (r.erreur) out.notes.push('arrêt à programmer : ' + court(r.erreur, 60));
        else await ecrireAbo(function (ab) { ab.fin_prevue = r.fin || ab.fin_prevue || null; });
      }
      // un mois avant la fin de l'engagement : on le rappelle ; s'il continue, rien ne change
      const finEng = Date.parse(a.engagement_jusqu_au || '') || 0;
      if (finEng && !voulue && !a.fin_engagement_annoncee && Date.now() >= finEng - 30 * JOUR && Date.now() < finEng + 30 * JOUR) {
        await ecrireAbo(function (ab) { ab.fin_engagement_annoncee = t0; });
        await ecrire(db, s, lead, dest, 'Votre abonnement : fin de l\'engagement le ' + dateFr(finEng), 'Bonjour,\n\nVotre engagement de ' + ABO.engagement_mois + ' mois se termine le ' + dateFr(finEng) + '. Si vous continuez, rien ne change : l\'abonnement passe au mois, sans engagement, avec une série de retouches chaque mois.\n\nSi vous préférez arrêter à cette date, répondez simplement à cet email : plus aucun prélèvement ensuite, le site reste à vous et l\'hébergement passe à ' + NOVALEMO.hebergement_an_eur + ' € par an.');
      }
      continue;
    }
    // 4. prélèvement refusé : le client règle avec le lien de la facture ; rappel à 7 jours ; pause à 14 jours
    if (sub.statut === 'past_due' || sub.statut === 'unpaid' || sub.statut === 'incomplete') {
      const fac = sub.derniere_facture ? await S.facture(sub.derniere_facture).catch(function () { return null; }) : null;
      const lien = (fac && fac.url) || a.url_impaye || null;
      if (!a.impaye_le) {
        await ecrireAbo(function (ab) { ab.statut = sub.statut; ab.impaye_le = t0; ab.url_impaye = lien; });
        await ecrire(db, s, lead, dest, 'Le paiement de votre abonnement n\'est pas passé', 'Bonjour,\n\nLe prélèvement de ce mois pour votre site' + (s.domaine ? ' https://' + s.domaine : '') + ' n\'est pas passé (carte expirée ou refusée, cela arrive).' + (lien ? ' Pour le régler en une minute : ' + lien : '') + '\n\nSans règlement d\'ici 14 jours, le site sera mis en pause, puis remis en ligne dès le paiement.');
        out.impayes++;
      } else if (depuis(a.impaye_le) > ABO.relance_jours * JOUR && !a.relance_le) {
        await ecrireAbo(function (ab) { ab.relance_le = t0; ab.url_impaye = lien; });
        await ecrire(db, s, lead, dest, 'Rappel : paiement de votre abonnement', 'Bonjour,\n\nPetit rappel : le paiement de ce mois pour votre site' + (s.domaine ? ' https://' + s.domaine : '') + ' n\'est toujours pas passé.' + (lien ? ' Le lien pour régler : ' + lien : '') + '\n\nSans règlement, le site sera mis en pause dans une semaine.');
      } else if (depuis(a.impaye_le) > 2 * ABO.relance_jours * JOUR && s.status !== 'pause') {
        const n = await ecrireAbo(function (ab) { ab.pause_le = t0; ab.url_impaye = lien; }, pauser);
        if (n && n.status === 'pause') {
          if (enLigneAvant) { if (s.domaine_mode === 'achat') await V.autoRenouvellement(s.domaine, false).catch(function () {}); await P.ecrireEtat(db, { a_publier: true }); }
          await ecrire(db, s, lead, dest, enLigneAvant ? 'Votre site est en pause' : 'Votre abonnement : mise en ligne suspendue', 'Bonjour,\n\nFaute de paiement de l\'abonnement, ' + (enLigneAvant ? 'votre site https://' + s.domaine + ' est mis en pause aujourd\'hui. Il revient en ligne' : 'la mise en ligne de votre site est suspendue. Elle reprend') + ' dès le règlement, sans rien perdre' + (lien ? ' : ' + lien : '.'));
          await message(db, 'Abonnement impayé : ' + nom, nom + ' n\'a pas réglé son abonnement malgré deux emails. ' + (enLigneAvant ? 'Site en pause' : 'Mise en ligne suspendue') + ', tout revient seul au paiement.', 'note');
          out.pauses++;
        }
      }
      continue;
    }
    // 5. abonnement arrêté
    if (arrete) {
      if (voulue) {
        // fin voulue : le site reste à lui, l'hébergement passe au tarif annuel (lien de paiement à l'échéance)
        const fin = sub.termine_le || sub.fin_periode || t0;
        const n = await maj(db, s.id, STATUTS_ABO, function (f, d) {
          if (!d.abonnement || d.abonnement.id !== a.id) return null;
          d.abonnements_finis = (d.abonnements_finis || []).concat([Object.assign({}, d.abonnement, { fin: fin })]).slice(-5);
          delete d.abonnement;
          d.renouvellement = Object.assign({}, d.renouvellement || {}, { jusqu_au: fin });
          return { data: d };
        });
        if (n) {
          await ecrire(db, s, lead, dest, 'Fin de votre abonnement', 'Bonjour,\n\nC\'est fait : votre abonnement s\'est arrêté le ' + dateFr(fin) + ', sans aucun autre prélèvement. Le site' + (s.domaine ? ' https://' + s.domaine : '') + ' reste à vous. L\'hébergement et le nom de domaine passent à ' + NOVALEMO.hebergement_an_eur + ' € par an : vous recevez le lien de paiement par email.' + (a.impaye_le && a.url_impaye ? '\n\nIl reste le dernier mois à régler : ' + a.url_impaye : ''));
          if (!a.resiliation_demandee) await message(db, 'Abonnement arrêté depuis Stripe : ' + nom, 'L\'abonnement a été arrêté à la demande (tableau de bord Stripe). Le site reste au client, hébergement à ' + NOVALEMO.hebergement_an_eur + ' € par an. Rien à faire.', 'note');
          out.fins++;
        }
        continue;
      }
      if (a.lien_reprise) continue;   // déjà en pause, on attend la reprise
      // arrêté faute de paiement : les factures encore ouvertes sont annulées (régler un mois d'un abonnement arrêté ne
      // remettrait rien en ligne), pause, et un lien pour reprendre au même prix
      const annulees = await S.annulerFacturesOuvertes(a.id).then(function () { return null; }).catch(function (e) { return e.message; });
      if (annulees) { out.notes.push('factures ouvertes : ' + court(annulees, 60)); continue; }
      const f = NOVALEMO.grille[s.formule] || {};
      const pub = await P.lireEtat(db);
      const hote = pub.hote || pub.hote_vercel;
      const lien = await S.creerLien({ site_id: s.id, mensuel: true, reprise: true, libelle: 'Abonnement ' + (f.nom || s.formule) + ' : ' + (s.domaine || nom), montant_eur: a.mensualite_eur || f.mois, sans_domaine: true, url_cgv: hote ? P.urlNovalemo(hote, 'cgv/') : null, confirmation: 'Merci, c\'est réglé : votre abonnement reprend. La facture arrive par email.' }).catch(function (e) { return { erreur: e.message }; });
      if (lien.erreur) { out.notes.push('reprise : ' + court(lien.erreur, 60)); continue; }
      const n = await ecrireAbo(function (ab) { ab.statut = 'annule'; ab.lien_reprise = lien.lien; ab.url_reprise = lien.url; ab.pause_le = ab.pause_le || t0; delete ab.url_impaye; }, pauser);
      if (!n) { await S.desactiver(lien.lien).catch(function () {}); continue; }
      if (enLigneAvant) { if (s.domaine_mode === 'achat') await V.autoRenouvellement(s.domaine, false).catch(function () {}); await P.ecrireEtat(db, { a_publier: true }); }
      const visible = enLigneAvant || (s.status === 'pause' && ((s.data && s.data.statut_avant_pause) || (s.live_at ? 'en_ligne' : 'livraison')) === 'en_ligne');
      await ecrire(db, s, lead, dest, visible ? (s.status === 'pause' ? 'Pour remettre votre site en ligne' : 'Votre site est en pause') : 'Votre abonnement est arrêté', 'Bonjour,\n\nVotre abonnement s\'est arrêté faute de paiement' + (visible ? ', et le site' + (s.domaine ? ' https://' + s.domaine : '') + ' est en pause. Il revient en ligne' : '. La mise en ligne de votre site reprendra') + ' dès que l\'abonnement reprend (' + (a.mensualite_eur || f.mois) + ' € par mois, aux mêmes conditions), sans rien perdre : ' + lien.url);
      await message(db, 'Abonnement arrêté (impayé) : ' + nom, 'Stripe a arrêté l\'abonnement de ' + nom + ' faute de paiement. Factures ouvertes annulées, site en pause, lien de reprise envoyé. Rien à faire.', 'note');
      out.pauses++;
    }
  }
  if (manquants) {
    const al = await lireCle(db, 'alerte:abonnements');
    if (!al || depuis(al.le) > JOUR) {
      await poserCle(db, 'alerte:abonnements', { le: t0, n: manquants });
      await message(db, manquants + ' abonnement(s) introuvable(s) chez Stripe', 'Le compte Stripe branché ne connaît pas ' + manquants + ' abonnement(s) suivi(s) par la tour : plus de facture, de relance ni d\'arrêt pour eux tant que ça dure. La clé Stripe branchée est-elle bien celle du compte qui les a encaissés ? (tour, Missions, Le paiement Stripe)', 'alerte');
    }
  }
  await poserCle(db, ETAT_ABO, { le: t0 });
  return out;
}

/* ── les années suivantes : hébergement (et domaine) à 25 € par an, encaissés sans Louis ── */
// 30 jours avant l'échéance : lien de paiement par email ; rappel à J-7 (au moins 5 jours après le lien) ; avertissement de
// pause à J+7 (au moins 7 jours après le rappel) ; pause à J+30 (au moins 14 jours après l'avertissement) : page neutre sur
// son domaine et renouvellement automatique du domaine coupé. Payé : facture, un an de plus à partir de l'échéance (ou du
// jour du paiement s'il est arrivé après), tout revient seul.
function dateFr(t) { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }); }
function echeance(s) {
  const r = (s.data && s.data.renouvellement) || {};
  if (r.jusqu_au) return new Date(r.jusqu_au).getTime();
  return new Date(s.live_at).getTime() + (r.annees || 1) * AN;
}
async function renouvellements(db, carte, limite) {
  const out = { liens: 0, payes: 0, pauses: 0, notes: [] };
  if (!S.branche()) return out;
  limite = limite || Date.now() + 120000;
  const anciens = await db.select('hq_sites', { in: { status: ['en_ligne', 'pause'] }, lte: { live_at: iso(Date.now() - AN + 31 * JOUR) }, select: 'id,status,live_at,data,domaine', order: 'live_at.asc' });
  // un abonnement arrêté avant un an en ligne : son hébergement court jusqu'à la fin du dernier mois payé, pas un an
  const recents = (await db.select('hq_sites', { in: { status: ['en_ligne', 'pause'] }, gt: { live_at: iso(Date.now() - AN + 31 * JOUR) }, select: 'id,status,live_at,data,domaine', order: 'live_at.asc' }))
    .filter(function (s) { return s.data && s.data.renouvellement && s.data.renouvellement.jusqu_au; });
  const candidats = anciens.concat(recents)
    .filter(function (s) { const r = (s.data && s.data.renouvellement) || {}; return s.live_at && s.domaine && !(s.data && s.data.abonnement) && (r.lien || r.auto_coupe || r.auto_a_couper || echeance(s) - Date.now() <= 30 * JOUR); });
  if (!candidats.length) return out;
  if (S.modeTest()) {
    // clé de test : un vrai client ne pourrait pas payer le lien ; rien n'est envoyé, Louis est prévenu une fois
    if (!(await lireCle(db, 'alerte:stripe_test'))) { await poserCle(db, 'alerte:stripe_test', { le: iso() }); await message(db, 'Renouvellements bloqués : clé Stripe de test', candidats.length + ' site(s) arrivent à l\'échéance de leur hébergement, mais HQ_STRIPE_KEY est une clé de test : les vraies cartes ne passent pas. Mets la clé secrète live et tout repart seul.', 'alerte'); }
    out.notes.push('clé Stripe de test : renouvellements en attente');
    return out;
  }
  const idr = (await identite(db)) || {};
  const pub = await P.lireEtat(db);
  const hote = pub.hote || pub.hote_vercel;
  const quoi = function (s) { return s.domaine_mode === 'achat' ? 'l\'hébergement et le nom de domaine' : 'l\'hébergement'; };
  for (const c of candidats) {
    if (Date.now() > limite) { out.notes.push('renouvellements : suite au prochain passage'); break; }
    const s = await db.one('hq_sites', { eq: { id: c.id } });
    if (!s || ['en_ligne', 'pause'].indexOf(s.status) < 0 || (s.data && s.data.abonnement)) continue;
    const r = Object.assign({ annees: 1 }, (s.data && s.data.renouvellement) || {});
    const fin = echeance(s), reste = fin - Date.now();
    const lead = await leadDe(db, s);
    const a = destinataire(s, lead);
    const nom = nomDe(s, lead);
    const sauver = function (patch) { return maj(db, s.id, ['en_ligne', 'pause'], function (f, d) { d.renouvellement = r; return Object.assign({ data: d }, patch || {}); }); };
    if (r.lien) {
      const p = await payeSur(carte, r.lien);
      if (p === 'doute') continue;
      if (p && !p.test) {
        const fac = p.invoice ? await S.facture(p.invoice).catch(function () { return null; }) : null;
        await S.desactiver(r.lien).catch(function () {});
        const jusqua = Math.max(fin, Date.now()) + AN;
        r.historique = (r.historique || []).concat([{ jusqu_au: iso(jusqua), montant_eur: p.montant_eur, le: p.le || iso(), session: p.session, facture_url: (fac && fac.url) || null }]).slice(-10);
        r.annees += 1; r.jusqu_au = iso(jusqua); r.rappels = 0;
        ['lien', 'url', 'prix', 'cree_le', 'rappel1_le', 'rappel2_le', 'pause_prevue', 'pause_le', 'auto_a_couper'].forEach(function (k) { delete r[k]; });
        const reprise = s.status === 'pause';
        // le domaine acheté se renouvelle de nouveau tout seul (nouvel essai à chaque passage tant que Vercel refuse)
        if (r.auto_coupe && s.domaine_mode === 'achat' && await V.autoRenouvellement(s.domaine, true).then(function () { return true; }).catch(function () { return false; })) delete r.auto_coupe;
        await sauver(reprise ? { status: 'en_ligne' } : null);
        if (reprise) await P.ecrireEtat(db, { a_publier: true });
        await ecrire(db, s, lead, a, reprise ? 'Votre site est de nouveau en ligne' : 'Hébergement renouvelé pour un an',
          'Bonjour,\n\nMerci, votre paiement de ' + p.montant_eur + ' € est bien reçu : ' + quoi(s) + ' de https://' + s.domaine + ' sont renouvelés jusqu\'au ' + dateFr(jusqua) + '.' + (fac && fac.url ? ' Votre facture : ' + fac.url : '') +
          (reprise ? '\n\nLe site revient en ligne, il est visible d\'ici quelques minutes.' : ''));
        await message(db, 'Renouvellement : ' + p.montant_eur + ' € (' + nom + ')', 'Hébergement de ' + s.domaine + ' payé jusqu\'au ' + dateFr(jusqua) + '. Rien à faire.', 'note');
        out.payes++;
        continue;
      }
    }
    // renouvellement du domaine à remettre ou à couper : Vercel n'avait pas répondu, on réessaie à chaque passage
    if (r.auto_coupe && s.status === 'en_ligne' && s.domaine_mode === 'achat') {
      if (await V.autoRenouvellement(s.domaine, true).then(function () { return true; }).catch(function () { return false; })) { delete r.auto_coupe; await sauver(); }
    }
    if (r.auto_a_couper && s.status === 'pause' && s.domaine_mode === 'achat') {
      if (await V.autoRenouvellement(s.domaine, false).then(function () { return true; }).catch(function () { return false; })) { delete r.auto_a_couper; r.auto_coupe = iso(); await sauver(); }
    }
    if (reste > 30 * JOUR) continue;
    if (!a) { if (!r.alerte_contact) { r.alerte_contact = iso(); await sauver(); await message(db, 'Renouvellement impossible : ' + nom, 'Aucune adresse email pour facturer l\'hébergement de ' + s.domaine + '.', 'alerte'); } continue; }
    if (!r.lien) {
      const jusqua = Math.max(fin, Date.now()) + AN;
      const lien = await S.creerLien({
        site_id: s.id, libelle: 'Hébergement' + (s.domaine_mode === 'achat' ? ' et nom de domaine' : '') + ' ' + s.domaine + ', jusqu\'au ' + dateFr(jusqua),
        montant_eur: NOVALEMO.hebergement_an_eur, email: a, sans_domaine: true, url_cgv: hote ? P.urlNovalemo(hote, 'cgv/') : null,
        confirmation: 'Merci, c\'est payé : ' + quoi(s) + ' de ' + s.domaine + ' sont renouvelés pour un an. La facture arrive par email.',
        pied_facture: S.piedFacture(idr)
      }).catch(function (e) { return { erreur: e.message }; });
      if (lien.erreur) { out.notes.push('renouvellement : ' + court(lien.erreur, 60)); continue; }
      Object.assign(r, { lien: lien.lien, url: lien.url, prix: lien.prix, cree_le: iso(), rappels: 0 });
      await sauver();
      await ecrire(db, s, lead, a, 'Votre site : l\'hébergement de l\'année ' + (r.annees + 1),
        'Bonjour,\n\nVotre site https://' + s.domaine + (reste > 0 ? ' arrive au bout de son année le ' : ' est arrivé au bout de son année le ') + dateFr(fin) + '. Pour le garder en ligne, ' + quoi(s) + ' coûtent ' + NOVALEMO.hebergement_an_eur + ' € pour l\'année suivante, sans engagement : ' + lien.url +
        '\n\nLa facture arrive par email après le paiement. Une question, une modification à faire ? Répondez simplement à cet email.');
      out.liens++;
      continue;
    }
    const n = r.rappels || 0;
    if (n === 0 && reste <= 7 * JOUR && depuis(r.cree_le) >= 5 * JOUR) {
      r.rappels = 1; r.rappel1_le = iso(); await sauver();
      await ecrire(db, s, lead, a, 'Rappel : hébergement de votre site', 'Bonjour,\n\nPetit rappel : ' + quoi(s) + ' de https://' + s.domaine + (reste > 0 ? ' sont à renouveler avant le ' + dateFr(fin) : ' sont à renouveler') + ' (' + NOVALEMO.hebergement_an_eur + ' €) : ' + r.url + '\n\nSi vous ne souhaitez pas continuer, répondez simplement à cet email.');
      continue;
    }
    if (n === 1 && reste <= -7 * JOUR && depuis(r.rappel1_le || r.cree_le) >= 7 * JOUR) {
      const pauseLe = Math.max(fin + 30 * JOUR, Date.now() + 14 * JOUR);
      r.rappels = 2; r.rappel2_le = iso(); r.pause_prevue = iso(pauseLe); await sauver();
      await ecrire(db, s, lead, a, 'Votre site sera mis en pause le ' + dateFr(pauseLe), 'Bonjour,\n\nL\'hébergement de https://' + s.domaine + ' n\'est pas encore réglé. Sans paiement, le site sera mis en pause le ' + dateFr(pauseLe) + '. Le lien reste valable : ' + r.url + '\n\nVous préférez récupérer votre nom de domaine et les fichiers du site ? Répondez à cet email, c\'est prévu.');
      continue;
    }
    if (s.status === 'en_ligne' && n >= 2 && Date.now() >= new Date(r.pause_prevue || fin + 30 * JOUR).getTime()) {
      if (s.domaine_mode === 'achat') {
        if (await V.autoRenouvellement(s.domaine, false).then(function () { return true; }).catch(function () { return false; })) r.auto_coupe = iso();
        else r.auto_a_couper = true;
      }
      r.pause_le = iso();
      const ok = await sauver({ status: 'pause' });
      if (!ok) continue;
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
  const limite = (ctx.limite || Date.now() + 200000) - 30000;
  const parts = [];
  if (V.branche()) {
    const suivi = await P.suivre(db, {}).catch(function (e) { return { resume: 'suivi : ' + e.message }; });
    if (suivi && suivi.resume && !/^Rien en cours/.test(suivi.resume)) parts.push(suivi.resume);
  }
  const pr = await promesses(db).catch(function () { return 0; });
  if (pr) parts.push(pr + ' aperçu(s) promis envoyé(s)');
  const rel = await releverPaiements(db).catch(function (e) { return { carte: null, t0: Date.now(), erreur: e.message }; });
  if (rel.erreur) parts.push('relevé Stripe : ' + rel.erreur + ' (vérification lien par lien)');
  const orph = await orphelins(db, rel.carte).catch(function () { return 0; });
  if (orph) parts.push(orph + ' paiement(s) sur une commande close traité(s)');
  const pa = await paiements(db, rel.carte, limite).catch(function (e) { parts.push('paiements : ' + court(e.message, 80)); return { n: 0, tests: 0, complet: false }; });
  if (pa.n) parts.push(pa.n + ' paiement(s) reçu(s)');
  if (pa.tests) parts.push(pa.tests + ' paiement(s) de test (rien acheté)');
  const db2 = await doublons(db, rel.carte).catch(function () { return 0; });
  if (db2) parts.push(db2 + ' paiement(s) en double remboursé(s)');
  const li = await livrer(db, ctx.budget, limite).catch(function (e) { parts.push('livraison : ' + court(e.message, 100)); return { achats: 0, attente: 0, enLigne: 0, notes: [] }; });
  if (li.achats) parts.push(li.achats + ' domaine(s) réservé(s)');
  if (li.enLigne) parts.push(li.enLigne + ' site(s) mis en ligne');
  if (li.attente) parts.push(li.attente + ' en cours de mise en ligne');
  if (li.notes.length) parts.push(li.notes.slice(0, 3).join(', '));
  const ab = await abonnements(db, rel.carte, limite).catch(function (e) { parts.push('abonnements : ' + court(e.message, 80)); return { factures: 0, impayes: 0, pauses: 0, reprises: 0, fins: 0, notes: [] }; });
  if (ab.factures) parts.push(ab.factures + ' facture(s) du mois envoyée(s)');
  if (ab.impayes) parts.push(ab.impayes + ' prélèvement(s) refusé(s), client prévenu');
  if (ab.pauses) parts.push(ab.pauses + ' site(s) en pause (abonnement)');
  if (ab.reprises) parts.push(ab.reprises + ' site(s) remis en ligne');
  if (ab.fins) parts.push(ab.fins + ' abonnement(s) terminé(s)');
  if (ab.notes.length) parts.push(ab.notes.slice(0, 2).join(', '));
  const ex = await expirer(db).catch(function () { return 0; });
  if (ex) parts.push(ex + ' aperçu(s) expiré(s)');
  const re = await renouvellements(db, rel.carte, limite).catch(function (e) { parts.push('renouvellements : ' + court(e.message, 80)); return { liens: 0, payes: 0, pauses: 0, notes: [], incomplet: true }; });
  if (re.liens) parts.push(re.liens + ' renouvellement(s) demandé(s)');
  if (re.payes) parts.push(re.payes + ' renouvellement(s) payé(s)');
  if (re.pauses) parts.push(re.pauses + ' site(s) en pause');
  if (re.notes.length) parts.push(re.notes.slice(0, 2).join(', '));
  // vérification lien par lien menée à son terme : le relevé global repart de là
  if (!rel.carte && S.branche() && pa.complet && !re.incomplet && !re.notes.some(function (x) { return /suite au prochain/.test(x); })) await releveComplet(db, rel.t0).catch(function () {});
  if (V.branche()) {
    const h = await P.verifierHote(db).catch(function () { return null; });
    if (h && h.hote_perso_ok) parts.push('les aperçus passent sur ' + h.hote);
    const e = await P.lireEtat(db);
    // un nouveau moteur des sites (P.MOTEUR) republie tout, même sans fiche changée
    if ((e.a_publier || (e.projet && e.moteur !== P.MOTEUR)) && !e.en_cours) { const p = await P.publier(db, { raison: e.a_publier ? 'livraison' : 'nouveau moteur des sites' }).catch(function (err) { return { resume: 'publication : ' + err.message }; }); parts.push(p.resume); }
  }
  const produit = pa.n + li.achats + li.enLigne + pr + re.liens + re.payes;
  return { resume: parts.length ? parts.join(' ; ') : 'Rien à livrer pour l\'instant.', produit: produit, prochain_min: 15, detail: { paiements: pa.n, domaines: li.achats, en_ligne: li.enLigne, renouvellements: re.payes } };
}

module.exports = { run, propositions, choisirDomaine, contact, identiteComplete, emailEnLigne, emailDns, emailPaiement, mentionsAFournir, enLigne, renouvellements, abonnements, programmerArret, momentArret, expirer, paiements, releverPaiements, echeance, plusMois, TLD_ACHAT };
