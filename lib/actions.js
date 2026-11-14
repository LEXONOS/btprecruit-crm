// Ce que Louis fait depuis la tour : trancher, donner une consigne, mettre en pause, régler le budget,
// valider ou annuler un email, désinscrire un prospect.
'use strict';
const { open } = require('./db');
const { BUDGET_DEFAUT } = require('./config');
const { court, nettoie } = require('./util');

const nowIso = function () { return new Date().toISOString(); };
function soon(min) { return new Date(Date.now() + (min || 3) * 60000).toISOString(); }

async function reveiller(db, id, min) {
  const a = await db.one('hq_agents', { eq: { id: id }, select: 'id,status,kind,next_run_at' });
  if (!a || a.kind === 'attente' || a.status === 'paused') return;
  const t = soon(min);
  if (!a.next_run_at || a.next_run_at > t) await db.update('hq_agents', { next_run_at: t }, { eq: { id: id } });
}

async function agir(op, b) {
  const db = open();
  if (!db) throw new Error('La base n\'est pas branchée : ajoute HQ_SUPABASE_KEY dans Vercel (voir le bandeau).');
  b = b || {};

  if (op === 'decider') {
    const p = await db.one('hq_proposals', { eq: { id: b.id } });
    if (!p) throw new Error('Proposition introuvable');
    const ok = b.decision === 'valider';
    await db.update('hq_proposals', { status: ok ? 'validee' : 'refusee', decided_by: 'louis', decision_note: nettoie(court(b.note || '', 1500)) || null, updated_at: nowIso() }, { eq: { id: p.id } });
    // qui exécute : PDG pour une nouvelle entreprise ou le groupe, sinon le DG de l'entreprise
    let executant = 'pdg';
    if (p.kind !== 'nouvelle_entreprise' && p.company_id && ['groupe', 'labo'].indexOf(p.company_id) < 0) {
      const dg = await db.one('hq_agents', { eq: { company_id: p.company_id, tier: 'dg' }, select: 'id' });
      if (dg) executant = dg.id;
    }
    // projet d'entreprise refusé : le chantier disparaît de la ville
    if (!ok && p.kind === 'nouvelle_entreprise' && p.details && p.details.company_id) await db.update('hq_companies', { status: 'fermee', updated_at: nowIso() }, { eq: { id: p.details.company_id, status: 'proposee' } });
    const dest = ok ? executant : (p.from_id || executant);
    await db.insert('hq_messages', { from_id: 'louis', to_id: dest, company_id: p.company_id, kind: 'decision', subject: (ok ? 'Louis valide : ' : 'Louis refuse : ') + court(p.title, 90), body: (b.note ? b.note + '\n\n' : '') + (ok ? 'À exécuter maintenant.' : 'On n\'y va pas pour l\'instant.'), ref: { proposition_id: p.id } }, { returning: false });
    if (p.from_id && p.from_id !== dest) await db.insert('hq_messages', { from_id: 'louis', to_id: p.from_id, company_id: p.company_id, kind: 'decision', subject: (ok ? 'Validé par Louis : ' : 'Refusé par Louis : ') + court(p.title, 90), body: b.note || '', ref: { proposition_id: p.id } }, { returning: false });
    await reveiller(db, dest, 2);
    return { ok: true };
  }

  if (op === 'studio_video' || op === 'studio_regler') return require('./studio/vue').agir(db, op, b);
  // les comptes du studio des créatrices (lib/createurs/admin.js)
  if (/^crea_(liste|creer|lien|statut|supprimer)$/.test(op)) return require('./createurs/admin').agir(db, op, b);

  if (op === 'consigne') {
    const texte = nettoie(court(b.texte || '', 3000)).trim();
    if (!texte) throw new Error('Consigne vide');
    const a = await db.one('hq_agents', { eq: { id: b.agent }, select: 'id,name,company_id,kind,waiting_for' });
    if (!a) throw new Error('Agent introuvable');
    await db.insert('hq_messages', { from_id: 'louis', to_id: a.id, company_id: a.company_id, kind: 'ordre', subject: court(texte, 80), body: texte }, { returning: false });
    await reveiller(db, a.id, b.maintenant ? 0 : 5);
    return { ok: true, attente: a.kind === 'attente' ? a.waiting_for : null };
  }

  if (op === 'pause' || op === 'reprendre') {
    const a = await db.one('hq_agents', { eq: { id: b.agent }, select: 'id,kind' });
    if (!a) throw new Error('Agent introuvable');
    if (a.kind === 'attente') throw new Error('Cet agent attend un outil : il ne tourne pas encore.');
    await db.update('hq_agents', op === 'pause' ? { status: 'paused', current_task: 'Mis en pause par Louis', updated_at: nowIso() } : { status: 'idle', next_run_at: soon(2), current_task: 'Repris par Louis', updated_at: nowIso() }, { eq: { id: a.id } });
    return { ok: true };
  }

  if (op === 'budget') {
    const cur = await db.one('hq_config', { eq: { key: 'budget' } });
    const v = Object.assign({}, BUDGET_DEFAUT, (cur && cur.value) || {});
    if (b.jour_usd != null && b.jour_usd !== '' && Number.isFinite(Number(b.jour_usd))) v.jour_usd = Math.max(0, Math.min(50, Number(b.jour_usd)));
    // le plafond du mois : la tour s'arrête jusqu'au 1er quand il est atteint (lib/garde.js)
    if (b.mois_usd != null && b.mois_usd !== '' && Number.isFinite(Number(b.mois_usd))) v.mois_usd = Math.max(0, Math.min(500, Number(b.mois_usd)));
    if (b.recherches_jour != null) v.recherches_jour = Math.max(0, Math.min(500, parseInt(b.recherches_jour, 10)));
    if (b.places_jour != null) v.places_jour = Math.max(0, Math.min(500, parseInt(b.places_jour, 10)));
    if (b.emails_jour != null) v.emails_jour = Math.max(0, Math.min(200, parseInt(b.emails_jour, 10)));
    if (b.envoi_auto != null) v.envoi_auto = !!b.envoi_auto;
    // la fabrication des aperçus (chasse, aperçus, photos, jugement) : coupée le 14 nov. 2026, on relance ceux déjà faits
    if (b.fabrication != null) v.fabrication = !!b.fabrication;
    if (b.apercus_jour != null) v.apercus_jour = Math.max(0, Math.min(60, parseInt(b.apercus_jour, 10)));
    if (b.domaine_max_usd != null) v.domaine_max_usd = Math.max(5, Math.min(80, Number(b.domaine_max_usd)));
    // la note de Miranda à partir de laquelle un aperçu part chez le prospect (demi-points)
    if (b.note_envoi != null && b.note_envoi !== '' && Number(b.note_envoi) > 0) v.note_envoi = Math.max(1, Math.min(10, Math.round(Number(b.note_envoi) * 2) / 2));
    await db.upsert('hq_config', { key: 'budget', value: v, updated_at: nowIso() }, { onConflict: 'key' });
    // le plafond du jour relevé : ceux que le budget avait mis en pause jusqu'à demain repartent tout de suite (Chloé
    // écrit, Yanis relance, Miranda juge, Léa illustre) au lieu d'attendre minuit
    const avant = Number((cur && cur.value && cur.value.jour_usd) || BUDGET_DEFAUT.jour_usd);
    const avantMois = Number((cur && cur.value && cur.value.mois_usd) || BUDGET_DEFAUT.mois_usd);
    let reveilles = [];
    if (v.jour_usd > avant || Number(v.mois_usd) > avantMois || (v.fabrication && !(cur && cur.value && cur.value.fabrication))) {
      const BX = require('./jobs/boite');
      const ids = [['redacteur', 1], ['relanceur', 4], ['critique', 2], ['photos', 3]];
      for (const x of ids) { await BX.reveiller(db, x[0], x[1]).catch(function () { return null; }); reveilles.push(x[0]); }
    }
    return { ok: true, budget: v, reveilles: reveilles };
  }

  // Identité de vente : vendeur sur les conditions de vente et les factures, titulaire des noms de domaine réservés
  if (op === 'identite') {
    const MQ = require('./martinique');
    const champs = ['entreprise', 'forme', 'siret', 'marque', 'prenom', 'nom', 'email', 'telephone', 'adresse', 'cp', 'ville', 'region', 'pays', 'mentions_facture'];
    const cur = await db.one('hq_config', { eq: { key: 'identite' } });
    const v = Object.assign({}, (cur && cur.value) || {});
    champs.forEach(function (k) { if (b[k] != null) v[k] = court(String(b[k]).trim(), k === 'mentions_facture' ? 300 : 140); });
    if (v.siret) v.siret = v.siret.replace(/\s/g, '');
    if (v.siret && !/^\d{14}$/.test(v.siret)) throw new Error('SIRET : 14 chiffres');
    if (v.telephone && !MQ.e164(v.telephone)) throw new Error('Téléphone illisible (ex. +590 691 00 00 00)');
    if (v.telephone) v.telephone = MQ.e164(v.telephone);
    if (v.pays) v.pays = v.pays.toUpperCase().slice(0, 2);
    if (v.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.email)) throw new Error('Email invalide');
    v.a_verifier = false; v.le = nowIso();
    await db.upsert('hq_config', { key: 'identite', value: v, updated_at: nowIso() }, { onConflict: 'key' });
    await require('./sites/publication').ecrireEtat(db, { a_publier: true });   // les conditions de vente reprennent l'identité
    return { ok: true, identite: v, complete: require('./jobs/livraison').identiteComplete(v) };
  }
  if (op === 'identite_lire') { const cur = await db.one('hq_config', { eq: { key: 'identite' } }); return { identite: (cur && cur.value) || null }; }

  /* ── les sites ── */
  // la phase de test des sites : Louis la termine (l'envoi reprend) ou la relance
  if (op === 'phase_sites') {
    const PHs = require('./sites/phase');
    const v = await PHs.ecrire(db, b.phase === 'test' ? 'test' : 'envoi', 'louis');
    // à Chloé, qui écrit les premiers emails (Ana, sa cheffe, peut être en pause : un ordre qu'elle ne lirait pas ne sert à
    // rien), et le relais passe tout de suite
    await db.insert('hq_messages', { from_id: 'louis', to_id: 'redacteur', company_id: 'novalemo', kind: 'ordre', subject: v.phase === 'test' ? 'Louis remet les sites en test : plus aucun premier email' : 'Louis lance l\'envoi : les sites prêts peuvent partir', body: v.phase === 'test' ? 'Aucun premier email ni relance jusqu\'à nouvel ordre ; les réponses continuent.' : 'La phase de test est finie. Les premiers emails reprennent au rythme de la boîte, avec les aperçus que Miranda note 6/10 ou plus (elle reprend les autres).' }, { returning: false });
    if (v.phase !== 'test') { const BX = require('./jobs/boite'); await BX.reveiller(db, 'redacteur', 1).catch(function () { return null; }); await BX.reveiller(db, 'relanceur', 5).catch(function () { return null; }); }
    return { ok: true, phase: v.phase };
  }
  if (op === 'sites_publier') return require('./sites/publication').publier(db, { raison: 'demandé depuis la tour' });
  if (op === 'sites_suivre') return require('./sites/publication').suivre(db, { attendre: true });
  if (op === 'site_annuler') {
    const s = await db.one('hq_sites', { eq: { id: b.id } });
    if (!s) throw new Error('Site introuvable');
    if (['paye', 'livraison', 'en_ligne', 'pause'].indexOf(s.status) >= 0) throw new Error('Site payé : on ne l\'annule pas depuis la tour');
    const S = require('./sites/stripe'), tous = S.liens(s.stripe);
    for (const x of tous) { const p = await S.paiement(x.id).catch(function () { return null; }); if (p && !p.test) throw new Error('Ce client vient de payer : Lucas le met en ligne, pas d\'annulation'); }
    // seulement s'il n'a pas changé d'état entre-temps (un paiement relevé pendant ce temps garde le site)
    const fait = await db.update('hq_sites', { status: 'annule', updated_at: nowIso() }, { eq: { id: s.id, status: s.status } });
    if (!fait.length) throw new Error('Le site vient de changer d\'état : recharge la liste');
    for (const x of tous) await S.desactiver(x.id).catch(function () {});
    await require('./sites/publication').ecrireEtat(db, { a_publier: true });
    return { ok: true };
  }

  if (op === 'groupe') {
    const name = court(String(b.name || '').trim(), 40);
    if (!name) throw new Error('Nom vide');
    await db.upsert('hq_config', { key: 'groupe', value: { name: name }, updated_at: nowIso() }, { onConflict: 'key' });
    return { ok: true };
  }

  if (op === 'email') {
    const m = await db.one('hq_outbox', { eq: { id: b.id } });
    if (!m) throw new Error('Email introuvable');
    const patch = { updated_at: nowIso() };
    if (b.subject != null) patch.subject = court(String(b.subject), 140);
    if (b.body != null) patch.body = String(b.body).slice(0, 4000);
    if (b.statut) {
      if (['pret', 'annule', 'envoye', 'a_valider'].indexOf(b.statut) < 0) throw new Error('Statut inconnu');
      patch.status = b.statut;
      if (b.statut === 'envoye') patch.sent_at = nowIso();
    }
    await db.update('hq_outbox', patch, { eq: { id: m.id } });
    if (b.statut === 'envoye' && m.lead_id) await db.update('hq_leads', { status: m.step > 1 ? 'relance' : 'contacte', contacted_at: nowIso() }, { eq: { id: m.lead_id } });
    if (b.statut === 'annule' && m.lead_id && m.step === 1) await db.update('hq_leads', { status: 'a_contacter' }, { eq: { id: m.lead_id }, in: { status: ['brouillon'] } });
    // retour de Louis = apprentissage pour la rédactrice, et pour le pôle écriture (Colette en fait une règle pour tous)
    if (b.retour && m.agent_id) await db.insert('hq_knowledge', { agent_id: m.agent_id, kind: 'regle', content: 'Retour de Louis sur un email (' + court(m.subject, 60) + ') : ' + court(String(b.retour), 400), weight: 9, source: 'retour de Louis' }, { returning: false });
    if (b.retour) await db.insert('hq_messages', { from_id: 'louis', to_id: 'plume', company_id: 'novalemo', kind: 'ordre', subject: 'Mon retour sur un email : ' + court(m.subject, 60), body: court(String(b.retour), 400) + '\n\nL\'email :\n' + court(m.body, 700) + '\n\nSi c\'est valable pour tous les messages, mets-le dans la charte.' }, { returning: false });
    return { ok: true };
  }

  if (op === 'lead') {
    const l = await db.one('hq_leads', { eq: { id: b.id } });
    if (!l) throw new Error('Prospect introuvable');
    if (b.statut === 'stop' && l.email) await db.upsert('hq_suppression', { email: String(l.email).toLowerCase(), reason: 'demandé par Louis' }, { onConflict: 'email' });
    if (b.statut) await db.update('hq_leads', { status: b.statut, updated_at: nowIso() }, { eq: { id: l.id } });
    if (b.statut === 'stop') await db.update('hq_outbox', { status: 'annule', error: 'désinscrit' }, { eq: { lead_id: l.id }, in: { status: ['a_valider', 'pret'] } });
    return { ok: true };
  }

  /* ── la boîte d'envoi ── */
  if (op.indexOf('boite_') === 0 || op.indexOf('reponse_') === 0) {
    const mail = require('./mail');
    const BOITE = require('./jobs/boite');
    if (op === 'boite_etat') return BOITE.etatBoite(db);
    if (!mail.branchee()) throw new Error('Boîte non branchée : ajoute HQ_MAIL_USER et HQ_MAIL_PASS dans Vercel, puis redéploie.');
    if (op === 'boite_test') {
      const r = await mail.tester();
      const reg = await mail.reglages();
      return { ok: !!(r.smtp && r.smtp.ok && r.imap && r.imap.ok), smtp: r.smtp, imap: r.imap, fournisseur: reg && reg.nom, serveurs: reg ? { smtp: reg.smtp + ':' + reg.smtpPort, imap: reg.imap + ':' + reg.imapPort } : null };
    }
    if (op === 'boite_dns') {
      const d = await mail.verifierDns();
      await BOITE.ecrireEtat(db, { dns: d, dns_at: nowIso() });
      return { ok: true, dns: d };
    }
    if (op === 'boite_releve') return BOITE.releve({ db: db });
    if (op === 'boite_pause') {
      const pause = !!b.pause;
      await BOITE.ecrireEtat(db, pause ? { pause: true, raison: 'Mis en pause par Louis', pause_at: nowIso() } : { pause: false, raison: null, reprise_at: nowIso() });
      return { ok: true, pause: pause };
    }
    if (op === 'boite_test_envoi') {
      const id = mail.identite();
      const r = await mail.envoyer({ to: id.adresse, subject: 'Test de la boîte des agents', text: 'Si tu lis ce message dans ta boîte de réception (et pas en indésirables), l\'envoi fonctionne.\n\nLa Tour, groupe LEXONOS' });
      try { await mail.ranger([r.raw]); } catch (e) { /* facultatif */ }
      return { ok: true, a: id.adresse };
    }
    if (op === 'reponse_envoyer') {
      const m = await db.one('hq_outbox', { eq: { id: b.id } });
      if (!m || m.kind !== 'reponse') throw new Error('Réponse introuvable');
      if (m.status === 'envoye') return { ok: true, envoye: true, deja: true };
      const patch = { status: 'pret', updated_at: nowIso() };
      if (b.subject != null) patch.subject = court(String(b.subject), 160);
      if (b.body != null) patch.body = String(b.body).slice(0, 4000);
      await db.update('hq_outbox', patch, { eq: { id: m.id } });
      const ENVOI = require('./jobs/envoi');
      const frais = Object.assign({}, m, patch);
      try {
        const r = await ENVOI.envoyerUn(db, frais);
        if (!r.ok) return { ok: true, envoye: false, note: r.raison === 'déjà pris' ? 'Elle part en ce moment même.' : 'Pas envoyée : ' + r.raison };
        try { await mail.ranger([r.raw]); } catch (e) { /* facultatif */ }
        return { ok: true, envoye: true };
      } catch (e) {
        await ENVOI.echec(db, frais, e).catch(function () {});
        return { ok: true, envoye: false, erreur: court(String(e.message || e), 200), note: 'Elle repartira au prochain passage.' };
      }
    }
    if (op === 'reponse_maj') {
      const ib = await db.one('hq_inbox', { eq: { id: b.id } });
      if (!ib) throw new Error('Message introuvable');
      const patch = {};
      if (b.statut) { if (['nouveau', 'traite', 'archive'].indexOf(b.statut) < 0) throw new Error('Statut inconnu'); patch.status = b.statut; }
      if (b.intent) patch.intent = court(String(b.intent), 30);
      await db.update('hq_inbox', patch, { eq: { id: ib.id } });
      if (b.statut === 'traite' || b.statut === 'archive') await db.update('hq_outbox', { status: 'annule', error: 'traité par Louis', updated_at: nowIso() }, { eq: { inbox_id: ib.id }, in: { status: ['a_valider', 'pret'] } });
      if (b.intent === 'interesse' && ib.lead_id) await db.update('hq_leads', { status: 'interesse', updated_at: nowIso() }, { eq: { id: ib.lead_id }, not_in: { status: ['client'] } });
      return { ok: true };
    }
  }

  throw new Error('Action inconnue : ' + op);
}

module.exports = { agir };
