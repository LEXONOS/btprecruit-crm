// api/inbox.js — Vercel Serverless Function
// Lit la boîte de réception via IMAP (OVH Zimbra)
// Variables d'environnement requises :
//   IMAP_HOST  → ex: ssl0.ovh.net
//   IMAP_PORT  → ex: 993
//   IMAP_USER  → ex: contact@novalem-recrutement.fr
//   IMAP_PASS  → votre mot de passe

export default async function handler(req, res) {
  // CORS — autorise les appels depuis votre domaine Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const IMAP_HOST = process.env.IMAP_HOST;
  const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
  const IMAP_USER = process.env.IMAP_USER;
  const IMAP_PASS = process.env.IMAP_PASS;

  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASS) {
    return res.status(503).json({
      error: 'IMAP non configuré',
      hint: 'Ajoutez IMAP_HOST, IMAP_USER et IMAP_PASS dans les variables d\'environnement Vercel (Settings → Environment Variables)',
    });
  }

  let client;

  try {
    // Import dynamique — imapflow est ESM
    const { ImapFlow } = await import('imapflow');
    const { simpleParser } = await import('mailparser');

    client = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: IMAP_PORT === 993,
      auth: { user: IMAP_USER, pass: IMAP_PASS },
      logger: false,
      connectionTimeout: 12000,
      greetingTimeout: 8000,
      socketTimeout: 20000,
    });

    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    const emails = [];

    try {
      const total = client.mailbox.exists;
      if (total === 0) {
        return res.status(200).json({ emails: [], total: 0 });
      }

      // Récupérer les 30 derniers messages
      const start = Math.max(1, total - 29);
      const range = `${start}:${total}`;

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      })) {
        try {
          const parsed = await simpleParser(msg.source, { skipHtmlToText: false });

          const fromAddr = parsed.from?.value?.[0]?.address || '';
          const fromText = parsed.from?.text || fromAddr;

          // Nettoyer le corps texte (enlever les > de citation excessive)
          let bodyText = (parsed.text || '').trim();
          // Limiter à 2000 caractères pour le contexte IA
          const snippet = bodyText.slice(0, 150).replace(/\r?\n/g, ' ');

          emails.push({
            uid: msg.uid,
            seq: msg.seq,
            seen: msg.flags ? msg.flags.has('\\Seen') : false,
            from: fromText,
            fromEmail: fromAddr,
            to: parsed.to?.text || '',
            subject: parsed.subject || '(sans objet)',
            date: (parsed.date || new Date()).toISOString(),
            text: bodyText.slice(0, 2000),
            snippet: snippet,
            attachments: (parsed.attachments || []).map(a => ({
              filename: a.filename || 'fichier',
              contentType: a.contentType || 'application/octet-stream',
              size: a.size || 0,
            })),
          });
        } catch (parseErr) {
          // Message malformé — on l'ignore silencieusement
          console.warn('Parse error for msg', msg.uid, parseErr.message);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    client = null;

    // Trier du plus récent au plus ancien
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      emails,
      total: emails.length,
      unread: emails.filter(e => !e.seen).length,
    });

  } catch (err) {
    // Tenter de fermer proprement la connexion
    if (client) {
      try { await client.logout(); } catch {}
    }
    console.error('[api/inbox] IMAP error:', err.message);

    // Messages d'erreur lisibles pour l'utilisateur
    let userMessage = 'Connexion IMAP impossible';
    if (err.message?.includes('auth')) userMessage = 'Identifiants IMAP incorrects';
    if (err.message?.includes('ENOTFOUND')) userMessage = `Hôte IMAP introuvable : ${IMAP_HOST}`;
    if (err.message?.includes('timeout')) userMessage = 'Timeout — le serveur IMAP ne répond pas';

    return res.status(500).json({
      error: userMessage,
      detail: err.message,
    });
  }
}
