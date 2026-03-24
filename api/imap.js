// api/imap.js — Lecture IMAP + marquage lu
// GET  /api/imap               → liste les 30 derniers emails de la boîte de réception
// POST /api/imap  { uid: 123 } → marque l'email comme lu
//
// Variables d'environnement Vercel requises :
//   IMAP_HOST  → ssl0.ovh.net
//   IMAP_PORT  → 993
//   IMAP_USER  → contact@novalem-recrutement.fr
//   IMAP_PASS  → mot de passe OVH

const IMAP_HOST = process.env.IMAP_HOST;
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
const IMAP_USER = process.env.IMAP_USER;
const IMAP_PASS = process.env.IMAP_PASS;

async function getClient() {
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host:   IMAP_HOST,
    port:   IMAP_PORT,
    secure: IMAP_PORT === 993,
    auth:   { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout:    8000,
    socketTimeout:     20000,
  });
  await client.connect();
  return client;
}

// ── GET : lire la boîte de réception ─────────────────
async function handleInbox(res) {
  const { simpleParser } = await import('mailparser');
  let client;
  try {
    client = await getClient();
    const lock   = await client.getMailboxLock('INBOX');
    const emails = [];
    try {
      const total = client.mailbox.exists;
      if (total === 0) {
        return res.status(200).json({ emails: [], total: 0, unread: 0 });
      }
      const range = `${Math.max(1, total - 29)}:${total}`;
      for await (const msg of client.fetch(range, { uid: true, flags: true, envelope: true, source: true })) {
        try {
          const parsed   = await simpleParser(msg.source, { skipHtmlToText: false });
          const fromAddr = parsed.from?.value?.[0]?.address || '';
          const bodyText = (parsed.text || '').trim();
          emails.push({
            uid:         msg.uid,
            seq:         msg.seq,
            seen:        msg.flags ? msg.flags.has('\\Seen') : false,
            from:        parsed.from?.text || fromAddr,
            fromEmail:   fromAddr,
            to:          parsed.to?.text || '',
            subject:     parsed.subject || '(sans objet)',
            date:        (parsed.date || new Date()).toISOString(),
            text:        bodyText.slice(0, 2000),
            snippet:     bodyText.slice(0, 150).replace(/\r?\n/g, ' '),
            attachments: (parsed.attachments || []).map(a => ({
              filename:    a.filename    || 'fichier',
              contentType: a.contentType || 'application/octet-stream',
              size:        a.size        || 0,
            })),
          });
        } catch (e) { console.warn('[imap] parse uid', msg.uid, e.message); }
      }
    } finally { lock.release(); }
    await client.logout(); client = null;
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.status(200).json({ emails, total: emails.length, unread: emails.filter(e => !e.seen).length });
  } catch (err) {
    if (client) try { await client.logout(); } catch {}
    console.error('[imap GET]', err.message);
    let msg = 'Connexion IMAP impossible';
    if (err.message?.includes('auth'))        msg = 'Identifiants incorrects — vérifiez IMAP_USER et IMAP_PASS';
    if (err.message?.includes('ENOTFOUND'))   msg = `Hôte introuvable : ${IMAP_HOST}`;
    if (err.message?.includes('timeout'))     msg = 'Timeout — serveur IMAP trop lent';
    if (err.message?.includes('certificate')) msg = 'Erreur SSL — vérifiez IMAP_HOST';
    return res.status(500).json({ error: msg, detail: err.message });
  }
}

// ── POST : marquer comme lu ───────────────────────────
async function handleMarkRead(uid, res) {
  if (!uid) return res.status(400).json({ error: 'uid manquant' });
  let client;
  try {
    client = await getClient();
    const lock = await client.getMailboxLock('INBOX');
    try { await client.messageFlagsAdd({ uid: Number(uid) }, ['\\Seen'], { uid: true }); }
    finally { lock.release(); }
    await client.logout(); client = null;
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (client) try { await client.logout(); } catch {}
    console.error('[imap POST]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Handler principal ─────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASS) {
    return res.status(503).json({
      error: 'IMAP non configuré',
      hint:  'Ajoutez IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS dans Vercel → Settings → Environment Variables',
    });
  }

  if (req.method === 'GET')  return handleInbox(res);
  if (req.method === 'POST') return handleMarkRead((req.body || {}).uid, res);

  return res.status(405).json({ error: 'Méthode non autorisée' });
};
