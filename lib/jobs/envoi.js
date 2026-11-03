// Envoi réel des emails « prêts » : seulement si Louis a activé l'envoi automatique ET qu'une boîte
// d'envoi dédiée est configurée (variables HQ_SMTP_*). Jamais Resend (interdit pour la prospection).
// Rythme humain : jours ouvrés, 8 h à 17 h en Guadeloupe, plafond du jour, quelques envois par passage.
'use strict';
const { heureGP, minuitGP, dormir } = require('../util');
const { TZ } = require('../config');

function configure() {
  return !!(process.env.HQ_SMTP_HOST && process.env.HQ_SMTP_USER && process.env.HQ_SMTP_PASS);
}

async function run(ctx) {
  const db = ctx.db;
  if (!ctx.budget.envoi_auto) return { resume: 'Envoi automatique désactivé.', envoyes: 0 };
  if (!configure()) return { resume: 'Boîte d\'envoi non configurée (HQ_SMTP_*).', envoyes: 0 };
  const jourSemaine = new Date().toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  const h = heureGP();
  if (jourSemaine === 'Sat' || jourSemaine === 'Sun' || h < 8 || h >= 17) return { resume: 'Hors heures d\'envoi.', envoyes: 0 };
  const deja = await db.count('hq_outbox', { eq: { status: 'envoye' }, gte: { sent_at: minuitGP().toISOString() } });
  const reste = Math.max(0, (ctx.budget.emails_jour || 20) - deja);
  if (!reste) return { resume: 'Plafond d\'envoi du jour atteint.', envoyes: 0 };
  const file = await db.select('hq_outbox', { eq: { status: 'pret' }, order: 'id.asc', limit: Math.min(4, reste) });
  if (!file.length) return { resume: 'Rien à envoyer.', envoyes: 0 };
  const nodemailer = require('nodemailer');
  const port = Number(process.env.HQ_SMTP_PORT || 465);
  const tr = nodemailer.createTransport({ host: process.env.HQ_SMTP_HOST, port: port, secure: port === 465, auth: { user: process.env.HQ_SMTP_USER, pass: process.env.HQ_SMTP_PASS } });
  const from = process.env.HQ_SMTP_FROM || process.env.HQ_SMTP_USER;
  const adresse = (String(from).match(/<([^>]+)>/) || [null, from])[1];
  const sup = new Set((await db.select('hq_suppression', { select: 'email' })).map(function (x) { return x.email; }));
  let n = 0;
  for (const m of file) {
    if (Date.now() > ctx.limite - 20000) break;
    if (sup.has(String(m.to_email).toLowerCase())) { await db.update('hq_outbox', { status: 'annule', error: 'désinscrit' }, { eq: { id: m.id } }); continue; }
    try {
      await tr.sendMail({ from: from, to: m.to_email, subject: m.subject, text: m.body, headers: { 'List-Unsubscribe': '<mailto:' + adresse + '?subject=STOP>' } });
      const t = new Date().toISOString();
      await db.update('hq_outbox', { status: 'envoye', sent_at: t, updated_at: t }, { eq: { id: m.id } });
      if (m.lead_id) await db.update('hq_leads', { status: m.step > 1 ? 'relance' : 'contacte', contacted_at: t, updated_at: t }, { eq: { id: m.lead_id } });
      n++;
      await dormir(8000 + Math.floor(Math.random() * 7000));
    } catch (e) {
      await db.update('hq_outbox', { status: 'erreur', error: String(e.message || e).slice(0, 300) }, { eq: { id: m.id } });
    }
  }
  return { resume: n + ' email(s) envoyé(s)', envoyes: n };
}

module.exports = { run, configure };
