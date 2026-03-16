// api/send-reminders.js
// Endpoint pour déclencher / tester les rappels email manuellement
// GET ou POST https://novalem-crm.vercel.app/api/send-reminders

import { sendEmail, buildReminderEmail } from './lib/email.js';

const STATUS_FR = {
  new: 'Précal à faire', precal: 'Précal faite', dossier: 'Dossier envoyé',
  interview: 'Entretien visio', presented: 'Présenté client',
  placed: 'Placé', ko: 'KO', entrant: 'Entrant brut',
};

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const userEmail   = process.env.CRM_USER_EMAIL;

  // Vérif config
  const missing = [];
  if (!supabaseUrl)  missing.push('SUPABASE_URL');
  if (!supabaseKey)  missing.push('SUPABASE_ANON_KEY');
  if (!userEmail)    missing.push('CRM_USER_EMAIL');
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');

  if (missing.length) {
    return res.status(500).json({
      error: 'Variables manquantes dans Vercel → Settings → Environment Variables',
      missing
    });
  }

  // Charger données Supabase
  let DB;
  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/crm_data?id=eq.1&select=data`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    if (!resp.ok) throw new Error(`Supabase HTTP ${resp.status}`);
    const rows = await resp.json();
    if (!rows?.length) throw new Error('Table crm_data vide ou introuvable');
    DB = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
  } catch (err) {
    return res.status(500).json({ error: 'Supabase: ' + err.message });
  }

  const now = new Date();
  const todayStr = now.toDateString();

  // Calculer alertes
  const alerts = [];
  (DB.candidates || []).forEach(c => {
    if (c.status === 'new') alerts.push(`Précal à faire : ${c.name}`);
    if (c.status === 'dossier') {
      const d = Math.floor((Date.now() - new Date(c.updated)) / 86400000);
      if (d > 2) alerts.push(`Dossier sans retour ${d}j : ${c.name}`);
    }
    if (c.status === 'presented') {
      const d = Math.floor((Date.now() - new Date(c.updated)) / 86400000);
      if (d > 3) alerts.push(`Client sans retour ${d}j sur ${c.name}`);
    }
  });
  (DB.agenda || []).filter(a => !a.done && a.date).forEach(a => {
    const d = new Date(a.date);
    if (d < now && d.toDateString() !== todayStr) alerts.push(`En retard : ${a.title}`);
  });

  // Agenda du jour
  const agenda = (DB.agenda || [])
    .filter(a => !a.done && a.date && new Date(a.date).toDateString() === todayStr)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .map(a => ({ title: a.title, time: a.time || '' }));

  // Pipeline actif
  const pipeline = (DB.candidates || [])
    .filter(c => !['entrant','placed','ko'].includes(c.status))
    .map(c => ({ name: c.name, role: c.role || '', status: STATUS_FR[c.status] || c.status }));

  const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  const html = buildReminderEmail({ alerts, agenda, pipeline, date: dateStr });

  const urgence = alerts.length ? `⚡ ${alerts.length} action(s) urgente(s)` : '';
  const ag      = agenda.length  ? `📅 ${agenda.length} événement(s)` : '';
  const subject = [urgence, ag].filter(Boolean).join(' · ') || `📋 Récap BTPRecruit — ${dateStr}`;

  try {
    await sendEmail({ to: userEmail, subject, html });
    return res.status(200).json({
      sent: true, to: userEmail,
      alerts: alerts.length, agenda: agenda.length, pipeline: pipeline.length
    });
  } catch (err) {
    return res.status(500).json({ error: 'Envoi email : ' + err.message });
  }
}
