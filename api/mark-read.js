// api/mark-read.js — Vercel Serverless Function
// Marque un email comme lu sur le serveur IMAP
// Body attendu : { uid: number }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const IMAP_HOST = process.env.IMAP_HOST;
  const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
  const IMAP_USER = process.env.IMAP_USER;
  const IMAP_PASS = process.env.IMAP_PASS;

  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASS) {
    return res.status(503).json({ error: 'IMAP non configuré' });
  }

  const { uid } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'uid manquant' });

  let client;
  try {
    const { ImapFlow } = await import('imapflow');

    client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: IMAP_PORT === 993,
      auth: { user: IMAP_USER, pass: IMAP_PASS },
      logger: false,
      connectionTimeout: 10000,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
    await client.logout();
    client = null;

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (client) try { await client.logout(); } catch {}
    console.error('[api/mark-read]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
