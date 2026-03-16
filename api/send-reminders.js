// api/send-reminders.js
// Endpoint manuel pour tester / déclencher les rappels
// GET /api/send-reminders?preview=1  → aperçu sans envoyer
// POST /api/send-reminders           → envoie vraiment

export default async function handler(req, res) {
  // Déléguer au cron handler
  const cronHandler = (await import('./cron-reminders.js')).default;

  // Pour l'appel manuel, bypass la vérification CRON_SECRET
  const patchedReq = {
    ...req,
    headers: {
      ...req.headers,
      'authorization': `Bearer ${process.env.CRON_SECRET || ''}`
    }
  };

  return cronHandler(patchedReq, res);
}
