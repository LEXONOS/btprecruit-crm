// L'envoi réel, par la boîte de Louis (SMTP), jamais par Resend (interdit pour la prospection).
// Ne part que ce qui est « prêt » : validé par Louis, ou écrit par la rédactrice si Louis a coupé la validation.
// Rythme humain : jours ouvrés, 8 h à 17 h 30 en Guadeloupe, palier de chauffe, deux envois maximum par passage, espacés.
// Les réponses que Louis valide partent à toute heure : c'est une conversation, pas de la prospection.
'use strict';
const { heureGP, dormir, court } = require('../util');
const { TZ } = require('../config');
const mail = require('../mail');
const boite = require('./boite');

const iso = function () { return new Date().toISOString(); };
const STOP_RELANCE = ['repondu', 'interesse', 'client', 'perdu', 'stop', 'ecarte'];

function configure() { return mail.branchee(); }

function dansLaFenetre() {
  const j = new Date().toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  const h = heureGP();
  return j !== 'Sat' && j !== 'Sun' && h >= 8 && h < 17.5;
}

// Envoie un message de la file. Retourne { ok, raw } ou { ok: false, raison }.
async function envoyerUn(db, m) {
  const kind = m.kind || 'prospection';
  const lead = m.lead_id ? await db.one('hq_leads', { eq: { id: m.lead_id } }) : null;
  if (kind !== 'reponse') {
    const sup = await db.one('hq_suppression', { eq: { email: String(m.to_email || '').toLowerCase() } });
    if (sup || (lead && lead.status === 'stop')) { await db.update('hq_outbox', { status: 'annule', error: 'désinscrit', updated_at: iso() }, { eq: { id: m.id } }); return { ok: false, raison: 'désinscrit' }; }
    if (kind === 'relance' && lead && STOP_RELANCE.indexOf(lead.status) >= 0) { await db.update('hq_outbox', { status: 'annule', error: 'le prospect a déjà répondu', updated_at: iso() }, { eq: { id: m.id } }); return { ok: false, raison: 'déjà répondu' }; }
  }
  const res = await mail.envoyer({ to: m.to_email, subject: m.subject, text: m.body, ref: m.id, inReplyTo: m.in_reply_to || undefined });
  const t = iso();
  await db.update('hq_outbox', { status: 'envoye', sent_at: t, updated_at: t, message_id: res.messageId, error: null }, { eq: { id: m.id } });
  if (lead && kind !== 'reponse' && ['nouveau', 'a_contacter', 'brouillon', 'contacte', 'relance'].indexOf(lead.status) >= 0) await db.update('hq_leads', { status: kind === 'relance' ? 'relance' : 'contacte', contacted_at: t, updated_at: t }, { eq: { id: lead.id } });
  if (kind === 'reponse' && m.inbox_id) await db.update('hq_inbox', { status: 'traite' }, { eq: { id: m.inbox_id } });
  return { ok: true, raw: res.raw };
}

async function echec(db, m, e) {
  await db.update('hq_outbox', { status: 'erreur', error: court(String(e.message || e), 300), updated_at: iso() }, { eq: { id: m.id } });
}

async function run(ctx) {
  const db = ctx.db;
  if (!mail.branchee()) return { resume: 'Boîte non branchée.', envoyes: 0 };
  const limite = ctx.limite || Date.now() + 120000;
  const raws = [];
  let n = 0, reps = 0;

  // 1. réponses validées restées en file (l'envoi immédiat a échoué) : à toute heure
  for (const m of await db.select('hq_outbox', { eq: { status: 'pret', kind: 'reponse' }, order: 'id.asc', limit: 5 })) {
    if (Date.now() > limite - 25000) break;
    try { const r = await envoyerUn(db, m); if (r.ok) { reps++; raws.push(r.raw); } } catch (e) { await echec(db, m, e); }
  }

  // 2. prospection et relances
  let etat = await boite.lireEtat(db);
  etat = await boite.surveiller(db, etat);
  let raison = null;
  if (etat.pause) raison = 'Envoi en pause : ' + (etat.raison || 'décidé dans la tour');
  else if (!ctx.toujours && !dansLaFenetre()) raison = 'Hors heures d\'envoi';
  if (!raison) {
    const deja = await db.count('hq_outbox', { eq: { status: 'envoye' }, in: { kind: ['prospection', 'relance'] }, gte: { sent_at: require('../util').minuitGP().toISOString() } });
    const reste = Math.max(0, boite.quota(etat, ctx.budget) - deja);
    if (!reste) raison = 'Palier du jour atteint (' + deja + ')';
    else {
      const file = await db.select('hq_outbox', { eq: { status: 'pret' }, in: { kind: ['prospection', 'relance'] }, order: 'id.asc', limit: Math.min(2, reste) });
      for (let k = 0; k < file.length; k++) {
        if (Date.now() > limite - 25000) break;
        if (k > 0) { const pause = ctx.espacement != null ? ctx.espacement : 20000 + Math.floor(Math.random() * 25000); if (Date.now() + pause > limite - 25000) break; if (pause) await dormir(pause); }
        try {
          const r = await envoyerUn(db, file[k]);
          if (r.ok) { n++; raws.push(r.raw); if (!etat.debut) etat = await boite.ecrireEtat(db, { debut: iso() }); }
        } catch (e) { await echec(db, file[k], e); }
      }
      if (!file.length) raison = 'Rien de validé à envoyer';
    }
  }
  if (raws.length) { try { await mail.ranger(raws); } catch (e) { /* la copie dans « Envoyés » est un plus */ } }
  const parts = [];
  if (n) parts.push(n + ' email(s) de prospection envoyé(s)');
  if (reps) parts.push(reps + ' réponse(s) envoyée(s)');
  if (!parts.length && raison) parts.push(raison);
  return { resume: parts.join(', ') + '.', envoyes: n + reps };
}

module.exports = { run, configure, envoyerUn, dansLaFenetre };
