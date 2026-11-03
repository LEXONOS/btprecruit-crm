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
    if (b.jour_usd != null) v.jour_usd = Math.max(0, Math.min(50, Number(b.jour_usd)));
    if (b.recherches_jour != null) v.recherches_jour = Math.max(0, Math.min(500, parseInt(b.recherches_jour, 10)));
    if (b.places_jour != null) v.places_jour = Math.max(0, Math.min(500, parseInt(b.places_jour, 10)));
    if (b.emails_jour != null) v.emails_jour = Math.max(0, Math.min(200, parseInt(b.emails_jour, 10)));
    if (b.envoi_auto != null) v.envoi_auto = !!b.envoi_auto;
    await db.upsert('hq_config', { key: 'budget', value: v, updated_at: nowIso() }, { onConflict: 'key' });
    return { ok: true, budget: v };
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
    // retour de Louis = apprentissage pour la rédactrice
    if (b.retour && m.agent_id) await db.insert('hq_knowledge', { agent_id: m.agent_id, kind: 'regle', content: 'Retour de Louis sur un email (' + court(m.subject, 60) + ') : ' + court(String(b.retour), 400), weight: 9, source: 'retour de Louis' }, { returning: false });
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
      try {
        const r = await require('./jobs/envoi').envoyerUn(db, Object.assign({}, m, patch));
        try { await mail.ranger([r.raw]); } catch (e) { /* facultatif */ }
        return { ok: true, envoye: true };
      } catch (e) {
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
