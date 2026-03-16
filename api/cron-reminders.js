// api/cron-reminders.js
// Cron Vercel — tourne tous les jours à 8h00 (Europe/Paris)
// Lit les données depuis Supabase, calcule les alertes, envoie l'email

import { sendEmail, buildReminderEmail } from './lib/email.js';

// ─── Statuts lisibles en français ────────────────────────
const STATUS_FR = {
  new: 'Précal à faire',
  precal: 'Précal faite',
  dossier: 'Dossier envoyé',
  interview: 'Entretien visio',
  presented: 'Présenté client',
  placed: 'Placé',
  ko: 'KO',
  entrant: 'Entrant brut',
};

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  // Sécurité : Vercel envoie un header spécial pour les crons
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // En dev sans CRON_SECRET, on laisse passer
    if (process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
  }

  // Vérifier la config
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const userEmail   = process.env.CRM_USER_EMAIL;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'SUPABASE_URL et SUPABASE_ANON_KEY manquants' });
  }
  if (!userEmail) {
    return res.status(500).json({ error: 'CRM_USER_EMAIL manquant' });
  }

  // ── Charger les données depuis Supabase ─────────────────
  let DB;
  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/crm_data?id=eq.1&select=data`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    if (!resp.ok) throw new Error(`Supabase ${resp.status}`);
    const rows = await resp.json();
    if (!rows?.length) throw new Error('Aucune donnée dans crm_data');
    DB = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
  } catch (err) {
    console.error('Supabase load error:', err);
    return res.status(500).json({ error: 'Impossible de charger les données: ' + err.message });
  }

  const now = new Date();
  const todayStr = now.toDateString();

  // ── Calculer les alertes ────────────────────────────────
  const alerts = [];

  (DB.candidates || []).forEach(c => {
    if (c.status === 'new') {
      alerts.push(`Précal à faire : ${c.name} (${c.role || 'poste ?'})`);
    }
    if (c.status === 'dossier') {
      const days = Math.floor((Date.now() - new Date(c.updated)) / 86400000);
      if (days > 2) alerts.push(`Dossier sans retour depuis ${days}j : ${c.name}`);
    }
    if (c.status === 'presented') {
      const days = Math.floor((Date.now() - new Date(c.updated)) / 86400000);
      if (days > 3) alerts.push(`Client sans retour depuis ${days}j sur ${c.name}`);
    }
    if (c.status === 'interview' && !c.int_done) {
      const days = Math.floor((Date.now() - new Date(c.updated)) / 86400000);
      if (days > 1) alerts.push(`Synthèse entretien manquante (${days}j) : ${c.name}`);
    }
  });

  // Événements agenda en retard
  (DB.agenda || []).filter(a => !a.done && a.date).forEach(a => {
    const d = new Date(a.date);
    if (d < now && d.toDateString() !== todayStr) {
      alerts.push(`En retard : ${a.title}`);
    }
  });

  // ── Agenda aujourd'hui ──────────────────────────────────
  const agenda = (DB.agenda || [])
    .filter(a => !a.done && a.date && new Date(a.date).toDateString() === todayStr)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map(a => ({ title: a.title, time: a.time || '' }));

  // ── Pipeline actif (hors entrants/placés/KO) ────────────
  const pipeline = (DB.candidates || [])
    .filter(c => !['entrant', 'placed', 'ko'].includes(c.status))
    .map(c => ({
      name: c.name,
      role: c.role || '',
      status: STATUS_FR[c.status] || c.status
    }));

  // ── Pas d'email si rien à signaler ──────────────────────
  const total = alerts.length + agenda.length + pipeline.length;
  if (total === 0) {
    console.log('Rien à signaler aujourd\'hui — pas d\'email envoyé');
    return res.status(200).json({ sent: false, reason: 'nothing_to_report' });
  }

  // ── Construire et envoyer l'email ───────────────────────
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const html = buildReminderEmail({ alerts, agenda, pipeline, date: dateStr });

  const urgenceLabel = alerts.length > 0 ? `⚡ ${alerts.length} action(s) urgente(s)` : '';
  const agendaLabel  = agenda.length > 0  ? `📅 ${agenda.length} événement(s)` : '';
  const subject = [urgenceLabel, agendaLabel]
    .filter(Boolean)
    .join(' · ')
    || `📋 Récap BTPRecruit — ${dateStr}`;

  try {
    await sendEmail({ to: userEmail, subject, html });
    console.log(`Email envoyé à ${userEmail} — ${alerts.length} alertes, ${agenda.length} agenda, ${pipeline.length} pipeline`);
    return res.status(200).json({
      sent: true,
      to: userEmail,
      alerts: alerts.length,
      agenda: agenda.length,
      pipeline: pipeline.length
    });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Envoi email échoué: ' + err.message });
  }
}
