// La boîte mail des agents : envoi SMTP, relève IMAP, réglages devinés depuis le domaine de l'adresse.
// Deux variables suffisent dans Vercel : HQ_MAIL_USER (l'adresse) et HQ_MAIL_PASS (son mot de passe).
// Le serveur (OVH, Google, Zoho, IONOS...) est reconnu tout seul grâce aux MX du domaine.
// La relève ne marque rien comme lu et ne garde QUE les messages liés à nos envois : le reste de la boîte n'est jamais lu par les agents.
'use strict';
const dns = require('dns').promises;
const crypto = require('crypto');

const PRESETS = [
  { test: /(^|\.)ovh\.(net|com)$/, nom: 'OVH', smtp: 'ssl0.ovh.net', smtpPort: 465, imap: 'ssl0.ovh.net', imapPort: 993, spf: 'mx.ovh.com', dkim: 'Espace client OVH > Web Cloud > Emails > ton domaine > onglet DKIM : activer.' },
  { test: /(google|googlemail)\.com$/, nom: 'Google', smtp: 'smtp.gmail.com', smtpPort: 465, imap: 'imap.gmail.com', imapPort: 993, spf: '_spf.google.com', selecteurs: ['google'], motDePasse: 'mot de passe d\'application Google (Compte Google > Sécurité > Mots de passe des applications)', dkim: 'Console Google Admin > Applications > Gmail > Authentifier les e-mails.' },
  { test: /outlook\.com$/, nom: 'Microsoft 365', smtp: 'smtp.office365.com', smtpPort: 587, imap: 'outlook.office365.com', imapPort: 993, spf: 'spf.protection.outlook.com', selecteurs: ['selector1', 'selector2'], dkim: 'Microsoft Defender > Stratégies > Authentification e-mail > DKIM.' },
  { test: /zoho\.eu$/, nom: 'Zoho', smtp: 'smtp.zoho.eu', smtpPort: 465, imap: 'imap.zoho.eu', imapPort: 993, spf: 'zoho.eu', selecteurs: ['zmail'] },
  { test: /zoho\.(com|in)$/, nom: 'Zoho', smtp: 'smtp.zoho.com', smtpPort: 465, imap: 'imap.zoho.com', imapPort: 993, spf: 'zoho.com', selecteurs: ['zmail'] },
  { test: /(ionos|1and1|kundenserver)\./, nom: 'IONOS', smtp: 'smtp.ionos.fr', smtpPort: 465, imap: 'imap.ionos.fr', imapPort: 993 },
  { test: /infomaniak\.(ch|com)$/, nom: 'Infomaniak', smtp: 'mail.infomaniak.com', smtpPort: 465, imap: 'mail.infomaniak.com', imapPort: 993, spf: 'spf.infomaniak.ch' },
  { test: /gandi\.net$/, nom: 'Gandi', smtp: 'mail.gandi.net', smtpPort: 465, imap: 'mail.gandi.net', imapPort: 993, spf: '_mailcust.gandi.net' },
  { test: /hostinger\.com$/, nom: 'Hostinger', smtp: 'smtp.hostinger.com', smtpPort: 465, imap: 'imap.hostinger.com', imapPort: 993, spf: '_spf.mail.hostinger.com' }
];
const SELECTEURS_COMMUNS = ['default', 'mail', 'dkim', 'k1', 's1', 'selector1'];

let FORCE = null;              // tests : { envoyer(raw, o), relever(etat, garder), tester(), dns(domaine) }
function forcer(f) { FORCE = f; cacheReglages = null; }

function identite() {
  const user = String(process.env.HQ_MAIL_USER || process.env.HQ_SMTP_USER || '').trim();
  const pass = String(process.env.HQ_MAIL_PASS || process.env.HQ_SMTP_PASS || '');
  const brut = String(process.env.HQ_MAIL_FROM || user).trim();
  const adresse = ((brut.match(/<([^>]+)>/) || [null, brut])[1] || '').toLowerCase();
  return { user: user, pass: pass, adresse: adresse, nom: process.env.HQ_MAIL_NOM || 'Louis de Novalemo', domaine: adresse.split('@')[1] || '' };
}
function branchee() { const i = identite(); return !!(i.user && i.pass && /@/.test(i.adresse)); }

let cacheReglages = null;
async function reglages() {
  const id = identite();
  if (!id.domaine) return null;
  if (cacheReglages && cacheReglages.domaine === id.domaine && Date.now() - cacheReglages.t < 600000) return cacheReglages.r;
  let mx = [];
  try { mx = (FORCE && FORCE.mx) ? FORCE.mx : (await dns.resolveMx(id.domaine)).sort(function (a, b) { return a.priority - b.priority; }).map(function (x) { return String(x.exchange).toLowerCase(); }); } catch (e) { mx = []; }
  const p = PRESETS.find(function (x) { return mx.some(function (h) { return x.test.test(h); }); }) || { nom: 'autre', smtp: 'mail.' + id.domaine, smtpPort: 465, imap: 'mail.' + id.domaine, imapPort: 993 };
  const r = Object.assign({}, p, {
    mx: mx,
    smtp: process.env.HQ_SMTP_HOST || p.smtp, smtpPort: Number(process.env.HQ_SMTP_PORT || p.smtpPort),
    imap: process.env.HQ_IMAP_HOST || p.imap, imapPort: Number(process.env.HQ_IMAP_PORT || p.imapPort)
  });
  delete r.test;
  cacheReglages = { domaine: id.domaine, t: Date.now(), r: r };
  return r;
}

// Identifiant de message reconnaissable dans toute réponse ou tout rebond : <hq.{id d'envoi}.{aléa}@domaine>
function nouvelId(ref) { return '<hq.' + (ref || 0) + '.' + crypto.randomBytes(5).toString('hex') + '@' + (identite().domaine || 'localhost') + '>'; }
const RE_ID = /hq\.(\d+)\.[a-f0-9]{6,}@/i;
function refDe(texte) { const m = String(texte || '').match(RE_ID); return m ? Number(m[1]) : null; }

async function composer(o) {
  const id = identite();
  const MailComposer = require('nodemailer/lib/mail-composer');
  const opts = {
    from: { name: id.nom, address: id.adresse }, to: o.to, subject: o.subject, text: o.text,
    messageId: o.messageId, date: new Date(),
    headers: { 'List-Unsubscribe': '<mailto:' + id.adresse + '?subject=STOP>' }
  };
  if (o.inReplyTo) { opts.inReplyTo = o.inReplyTo; opts.references = o.references || o.inReplyTo; }
  return new Promise(function (ok, ko) { new MailComposer(opts).compile().build(function (e, msg) { if (e) ko(e); else ok(msg); }); });
}

// Envoie un message texte. Retourne { messageId, raw } (raw sert à ranger la copie dans « Envoyés »).
async function envoyer(o) {
  if (!branchee()) throw new Error('Boîte non branchée (HQ_MAIL_USER et HQ_MAIL_PASS dans Vercel).');
  const id = identite();
  const messageId = o.messageId || nouvelId(o.ref);
  const raw = await composer(Object.assign({}, o, { messageId: messageId }));
  if (FORCE && FORCE.envoyer) { await FORCE.envoyer(raw, o); return { messageId: messageId, raw: raw }; }
  const r = await reglages();
  const nodemailer = require('nodemailer');
  const tr = nodemailer.createTransport({ host: r.smtp, port: r.smtpPort, secure: r.smtpPort === 465, requireTLS: r.smtpPort !== 465, auth: { user: id.user, pass: id.pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 40000 });
  try { await tr.sendMail({ envelope: { from: id.adresse, to: [o.to] }, raw: raw }); } finally { tr.close(); }
  return { messageId: messageId, raw: raw };
}

async function avecImap(fn) {
  const id = identite(), r = await reglages();
  const { ImapFlow } = require('imapflow');
  const c = new ImapFlow({ host: r.imap, port: r.imapPort, secure: r.imapPort === 993, auth: { user: id.user, pass: id.pass }, logger: false, socketTimeout: 40000, greetingTimeout: 15000, connectionTimeout: 15000 });
  c.on('error', function () { /* coupure réseau : gérée par l'appelant */ });
  await c.connect();
  try { return await fn(c); } finally { try { await c.logout(); } catch (e) { try { c.close(); } catch (e2) { /* déjà fermé */ } } }
}

// Range les copies des envois dans le dossier « Envoyés » de la boîte : Louis voit tout dans son webmail.
async function ranger(raws) {
  raws = (raws || []).filter(Boolean);
  if (!raws.length || (FORCE && FORCE.envoyer)) return 0;
  return avecImap(async function (c) {
    const boites = await c.list();
    const env = boites.find(function (b) { return b.specialUse === '\\Sent'; }) || boites.find(function (b) { return /^(sent|envoy|éléments envoyés|sent items|sent messages)$/i.test(b.name) || /(^|[./])(sent|envoy)/i.test(b.path); });
    if (!env) return 0;
    for (const raw of raws) await c.append(env.path, raw, ['\\Seen']);
    return raws.length;
  });
}

// Relève la boîte de réception depuis le dernier UID vu. garder(meta) dit si un message nous concerne :
// seuls ceux-là sont téléchargés et lus. Retourne { etat, messages: [{ uid, messageId, inReplyTo, references, from, fromName, subject, date, headers, source }] }.
async function relever(etat, garder) {
  if (FORCE && FORCE.relever) return FORCE.relever(etat, garder);
  return avecImap(async function (c) {
    const lock = await c.getMailboxLock('INBOX');
    try {
      const mb = c.mailbox || {};
      const uv = String(mb.uidValidity || '');
      const uidNext = Number(mb.uidNext || 1);
      let depuis = etat && etat.uidValidity === uv && Number.isFinite(Number(etat.dernier)) ? Number(etat.dernier) : null;
      if (depuis === null) {
        // première relève : on regarde les 3 derniers jours, rien de plus ancien
        const uids = await c.search({ since: new Date(Date.now() - 3 * 86400000) }, { uid: true });
        depuis = uids && uids.length ? Math.min.apply(null, uids) - 1 : uidNext - 1;
      }
      const metas = [];
      let max = depuis;
      if (uidNext - 1 > depuis) {
        for await (const m of c.fetch((depuis + 1) + ':*', { uid: true, envelope: true, size: true, headers: ['in-reply-to', 'references', 'auto-submitted', 'x-autoreply', 'x-autorespond', 'precedence', 'content-type', 'x-failed-recipients'] }, { uid: true })) {
          if (m.uid <= depuis) continue;
          max = Math.max(max, m.uid);
          const env = m.envelope || {};
          const de = (env.from && env.from[0]) || {};
          metas.push({ uid: m.uid, messageId: env.messageId || null, inReplyTo: env.inReplyTo || null, from: String(de.address || '').toLowerCase(), fromName: de.name || '', subject: env.subject || '', date: env.date || null, headers: m.headers ? m.headers.toString('utf8') : '', size: m.size || 0 });
          if (metas.length >= 200) break;
        }
      }
      const gardes = [];
      for (const meta of metas) {
        if (!(await garder(meta))) continue;
        const one = await c.fetchOne(String(meta.uid), { source: { start: 0, maxLength: 400000 } }, { uid: true });
        gardes.push(Object.assign({}, meta, { source: one && one.source ? one.source : null }));
      }
      return { etat: { uidValidity: uv, dernier: max }, messages: gardes, vus: metas.length };
    } finally { lock.release(); }
  });
}

async function lire(source) {
  const { simpleParser } = require('mailparser');
  const p = await simpleParser(source, { skipHtmlToText: false, skipImageLinks: true, skipTextToHtml: true, maxHtmlLengthToParse: 300000 });
  return { text: String(p.text || '').replace(/\r/g, ''), html: !!p.html, attachments: (p.attachments || []).map(function (a) { return { nom: a.filename, type: a.contentType, taille: a.size }; }), references: p.references || null, inReplyTo: p.inReplyTo || null };
}

// Garde la partie neuve d'une réponse (coupe la citation de notre email)
function partieNeuve(texte) {
  const lignes = String(texte || '').split('\n');
  const out = [];
  for (const l of lignes) {
    if (/^\s*>/.test(l)) break;
    if (/^\s*(le|on)\s.+(a écrit|wrote)\s*:?\s*$/i.test(l)) break;
    if (/^\s*-{2,}\s*(original message|message d'origine|message original)/i.test(l)) break;
    if (/^\s*(de|from)\s*:\s.+@/i.test(l)) break;
    if (/^\s*(envoyé de mon|sent from my)\b/i.test(l)) break;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function tester() {
  if (FORCE && FORCE.tester) return FORCE.tester();
  const res = { smtp: null, imap: null };
  const id = identite(), r = await reglages();
  try {
    const tr = require('nodemailer').createTransport({ host: r.smtp, port: r.smtpPort, secure: r.smtpPort === 465, requireTLS: r.smtpPort !== 465, auth: { user: id.user, pass: id.pass }, connectionTimeout: 15000, greetingTimeout: 15000 });
    await tr.verify(); tr.close(); res.smtp = { ok: true };
  } catch (e) { res.smtp = { ok: false, erreur: String(e.message || e).slice(0, 200) }; }
  try { await avecImap(async function (c) { await c.status('INBOX', { messages: true }); }); res.imap = { ok: true }; }
  catch (e) { res.imap = { ok: false, erreur: String(e.message || e).slice(0, 200) }; }
  return res;
}

async function txt(nom) { try { return (await dns.resolveTxt(nom)).map(function (x) { return x.join(''); }); } catch (e) { return []; } }

// SPF, DKIM, DMARC : ce qui fait qu'un email arrive en boîte de réception et pas en indésirables
async function verifierDns() {
  const id = identite();
  if (!id.domaine) return null;
  if (FORCE && FORCE.dns) return FORCE.dns(id.domaine);
  const r = await reglages();
  const d = id.domaine;
  const spfs = (await txt(d)).filter(function (t) { return /^v=spf1/i.test(t); });
  const spf = spfs[0] || null;
  const spfOk = !!spf && (!r.spf || spf.indexOf(r.spf) >= 0);
  const dmarc = (await txt('_dmarc.' + d)).find(function (t) { return /^v=DMARC1/i.test(t); }) || null;
  let dkim = null;
  for (const s of (r.selecteurs || []).concat(SELECTEURS_COMMUNS)) {
    const v = (await txt(s + '._domainkey.' + d)).find(function (t) { return /p=/.test(t); });
    if (v) { dkim = s; break; }
  }
  return {
    domaine: d, fournisseur: r.nom, mx: r.mx,
    spf: { ok: spfOk, valeur: spf, conseil: spf ? (spfOk ? null : 'Ton SPF n\'autorise pas ' + r.nom + ' : ajoute include:' + r.spf + ' dans l\'enregistrement TXT « v=spf1 » du domaine.') : 'Ajoute un enregistrement TXT sur ' + d + ' : v=spf1 ' + (r.spf ? 'include:' + r.spf + ' ' : '') + '~all' },
    dkim: { ok: !!dkim, selecteur: dkim, conseil: dkim ? null : (r.dkim || 'Active la signature DKIM chez ton hébergeur mail.') + (r.nom === 'OVH' ? ' (OVH utilise un sélecteur propre à ton compte : s\'il est déjà actif, ignore ce point.)' : '') },
    dmarc: { ok: !!dmarc, valeur: dmarc, conseil: dmarc ? null : 'Ajoute un enregistrement TXT sur _dmarc.' + d + ' : v=DMARC1; p=none; rua=mailto:' + id.adresse },
    verifie_le: new Date().toISOString()
  };
}

module.exports = { identite, branchee, reglages, envoyer, ranger, relever, lire, partieNeuve, tester, verifierDns, nouvelId, refDe, RE_ID, forcer, PRESETS };
