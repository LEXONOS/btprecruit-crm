// La boîte de réception de la prospection : relève, tri (vraie réponse, STOP, rebond, absence) et effets.
// Une vraie réponse : prospect « a répondu », relances annulées, Louis prévenu, Emma (chargée des réponses) réveillée.
// Un STOP : liste noire + plus aucun envoi. Un rebond définitif : adresse écartée, le prospect passe en appel si on a son numéro.
// Montée en charge : palier d'envoi qui grimpe avec l'ancienneté de la boîte, pause automatique si trop de rebonds.
'use strict';
const mail = require('../mail');
const { minuitGP, court, coupe } = require('../util');

const CLE = 'boite';
const iso = function (t) { return new Date(t || Date.now()).toISOString(); };
const bas = function (s) { return String(s || '').trim().toLowerCase(); };

async function lireEtat(db) { const r = await db.one('hq_config', { eq: { key: CLE } }); return (r && r.value) || {}; }
async function ecrireEtat(db, patch) {
  const v = Object.assign({}, await lireEtat(db), patch);
  await db.upsert('hq_config', { key: CLE, value: v, updated_at: iso() }, { onConflict: 'key' });
  return v;
}

// Chauffe de la boîte : 5 par jour la première semaine, puis on monte doucement jusqu'à 20 (et jamais au-delà du plafond de Louis)
function palier(jours) { return jours < 3 ? 5 : jours < 7 ? 8 : jours < 14 ? 12 : jours < 21 ? 16 : 20; }
function joursDepuis(t) { return t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 86400000)) : 0; }
function quota(etat, budget) { return Math.max(0, Math.min(Number((budget && budget.emails_jour) || 25), palier(joursDepuis(etat && etat.debut)))); }

const RE_REBOND_DE = /^(mailer-daemon|postmaster|mail-daemon|maildaemon|bounce|bounces|mdaemon)/i;
const RE_REBOND_SUJET = /(undeliver|delivery status|delivery fail|failure notice|returned mail|non remis|non distribu|échec de (la )?(remise|distribution)|could not be delivered|address not found|adresse introuvable|message bloqué|mail delivery)/i;
const RE_DUR = /\b5\.[0-7]\.\d{1,3}\b|\b55[0-4][ -]|user unknown|unknown user|does not exist|n'existe pas|no such user|mailbox unavailable|adresse introuvable|address not found|invalid recipient|recipient rejected|destinataire inconnu|introuvable/i;
const RE_ABSENCE = /(absence|absent|out of (the )?office|automatic reply|réponse automatique|reponse automatique|auto[- ]?reply|autoreply|congés|conges|vacances|en déplacement)/i;
const RE_STOP = /(\bstop\b|désinscri|desinscri|unsubscribe|ne plus (me )?(recevoir|contacter|écrire|ecrire|solliciter)|retirez[- ]moi|supprimez[- ]moi|ne m'écrivez plus|ne m'ecrivez plus)/i;

function trier(meta, neuf, brut) {
  const h = String(meta.headers || '');
  const local = String(meta.from || '').split('@')[0];
  if (RE_REBOND_DE.test(local) || (/multipart\/report/i.test(h) && /delivery-status/i.test(h)) || RE_REBOND_SUJET.test(meta.subject || '')) return { kind: 'rebond', dur: RE_DUR.test(brut || '') };
  if (/auto-submitted:\s*auto-(replied|generated)/i.test(h) || /x-autore(ply|spond)/i.test(h) || /precedence:\s*(auto_reply|bulk|junk)/i.test(h) || RE_ABSENCE.test(meta.subject || '')) return { kind: 'absence' };
  if (RE_STOP.test(neuf || '') && ((neuf || '').length < 280 || /désinscri|desinscri|unsubscribe|ne plus/i.test(neuf))) return { kind: 'stop' };
  return { kind: 'reponse' };
}

async function annulerEnAttente(db, leadId, raison, kinds) {
  const q = { eq: { lead_id: leadId }, in: { status: ['a_valider', 'pret'] } };
  const rows = await db.select('hq_outbox', Object.assign({ select: 'id,kind' }, q));
  const ids = rows.filter(function (r) { return !kinds || kinds.indexOf(r.kind || 'prospection') >= 0; }).map(function (r) { return r.id; });
  if (ids.length) await db.update('hq_outbox', { status: 'annule', error: raison, updated_at: iso() }, { in: { id: ids } });
  return ids.length;
}

async function reveiller(db, id, min) {
  const a = await db.one('hq_agents', { eq: { id: id }, select: 'id,status,kind,next_run_at' });
  if (!a || a.kind === 'attente' || a.status === 'paused') return;
  const t = iso(Date.now() + (min || 2) * 60000);
  if (!a.next_run_at || a.next_run_at > t) await db.update('hq_agents', { next_run_at: t }, { eq: { id: id } });
}

async function effets(db, t, ib, envoi) {
  const lead = envoi.lead_id ? await db.one('hq_leads', { eq: { id: envoi.lead_id } }) : null;
  const maintenant = iso();
  if (t.kind === 'absence') return;
  if (t.kind === 'rebond') {
    await db.update('hq_outbox', { error: t.dur ? 'rebond définitif' : 'rebond temporaire', updated_at: maintenant }, { eq: { id: envoi.id } });
    if (t.dur && lead && lead.email) {
      await db.upsert('hq_suppression', { email: bas(lead.email), reason: 'rebond' }, { onConflict: 'email' });
      await db.update('hq_leads', { status: lead.phone ? 'a_appeler' : 'sans_contact', reason: court('Email invalide (rebond). ' + (lead.reason || ''), 300), updated_at: maintenant }, { eq: { id: lead.id } });
      await annulerEnAttente(db, lead.id, 'adresse invalide');
    }
    return;
  }
  if (t.kind === 'stop') {
    const em = bas(ib.from_email || (lead && lead.email));
    if (em) await db.upsert('hq_suppression', { email: em, reason: 'STOP reçu' }, { onConflict: 'email' });
    if (lead) { await db.update('hq_leads', { status: 'stop', updated_at: maintenant }, { eq: { id: lead.id } }); await annulerEnAttente(db, lead.id, 'STOP reçu'); }
    return;
  }
  if (lead && ['interesse', 'client', 'stop'].indexOf(lead.status) < 0) await db.update('hq_leads', { status: 'repondu', updated_at: maintenant }, { eq: { id: lead.id } });
  if (lead) await annulerEnAttente(db, lead.id, 'le prospect a répondu', ['relance', 'prospection']);
  await db.insert('hq_messages', { from_id: 'reponses', to_id: 'louis', company_id: 'novalemo', kind: 'rapport', subject: 'Réponse de ' + ((lead && lead.name) || ib.from_name || ib.from_email), body: court(ib.body, 700), ref: { inbox_id: ib.id, lead_id: lead ? lead.id : null } }, { returning: false });
  await reveiller(db, 'reponses', 1);
}

// La relève : appelée à chaque cycle (et par le bouton « Relever maintenant »)
async function releve(ctx) {
  const db = ctx.db;
  if (!mail.branchee()) return { resume: 'Boîte non branchée.', nouveaux: 0 };
  const etat = await lireEtat(db);
  const envoyes = await db.select('hq_outbox', { select: 'id,lead_id,to_email,message_id,subject,kind', eq: { status: 'envoye' }, gte: { sent_at: iso(Date.now() - 120 * 86400000) }, order: 'id.asc', limit: 6000 });
  const parId = new Map(envoyes.map(function (o) { return [o.id, o]; }));
  const parEmail = new Map(); envoyes.forEach(function (o) { parEmail.set(bas(o.to_email), o); });
  const garder = async function (meta) {
    const ref = mail.refDe(meta.inReplyTo) || mail.refDe(meta.headers);
    if (ref && parId.has(ref)) return true;
    if (!envoyes.length) return false;
    if (RE_REBOND_DE.test(String(meta.from || '').split('@')[0]) || RE_REBOND_SUJET.test(meta.subject || '')) return true;
    return parEmail.has(bas(meta.from));
  };
  let r;
  try { r = await mail.relever(etat.imap || null, garder); }
  catch (e) {
    await ecrireEtat(db, { erreur_releve: court(String(e.message || e), 200), releve_at: iso() });
    return { resume: 'Relève impossible : ' + court(String(e.message || e), 120), erreur: true, nouveaux: 0 };
  }
  const n = { reponse: 0, stop: 0, rebond: 0, absence: 0 };
  for (const m of r.messages) {
    let lu = { text: '', attachments: [] };
    try { if (m.source) lu = await mail.lire(m.source); } catch (e) { /* message illisible : on garde l'en-tête */ }
    const brut = lu.text || '';
    const neuf = mail.partieNeuve(brut);
    const ref = mail.refDe(m.inReplyTo) || mail.refDe(m.headers) || mail.refDe(brut) || (m.source ? mail.refDe(m.source.toString('utf8')) : null);
    const envoi = (ref && parId.get(ref)) || parEmail.get(bas(m.from)) || null;
    if (!envoi) continue;
    const t = trier(m, neuf, brut);
    const row = {
      message_id: m.messageId || ('uid:' + r.etat.uidValidity + ':' + m.uid), lead_id: envoi.lead_id || null, outbox_id: envoi.id,
      from_email: bas(m.from), from_name: court(m.fromName || '', 120), subject: court(m.subject || '', 200),
      body: coupe(t.kind === 'rebond' ? brut : (neuf || brut), 4000), kind: t.kind, intent: t.kind === 'stop' ? 'stop' : null,
      status: t.kind === 'reponse' ? 'nouveau' : 'traite', data: { uid: m.uid, pieces: lu.attachments || [], dur: !!t.dur },
      received_at: m.date ? iso(m.date) : iso()
    };
    const ins = await db.insert('hq_inbox', row, { onConflict: 'message_id', ignoreDuplicates: true });
    if (!ins || !ins.length) continue;
    n[t.kind]++;
    await effets(db, t, ins[0], envoi);
  }
  await ecrireEtat(db, { imap: r.etat, releve_at: iso(), erreur_releve: null });
  const total = n.reponse + n.stop + n.rebond + n.absence;
  return { resume: total ? [n.reponse && n.reponse + ' réponse(s)', n.stop && n.stop + ' STOP', n.rebond && n.rebond + ' rebond(s)', n.absence && n.absence + ' absence(s)'].filter(Boolean).join(', ') : 'Rien de neuf dans la boîte.', nouveaux: total, detail: n };
}

// Trop de rebonds depuis la dernière reprise : on coupe l'envoi avant d'abîmer la réputation du domaine
async function surveiller(db, etat) {
  if (etat.pause) return etat;
  const depuis = etat.reprise_at || etat.debut;
  if (!depuis) return etat;
  const [envoyes, rebonds] = await Promise.all([
    db.count('hq_outbox', { eq: { status: 'envoye' }, in: { kind: ['prospection', 'relance'] }, gte: { sent_at: depuis } }),
    db.select('hq_inbox', { select: 'data', eq: { kind: 'rebond' }, gte: { received_at: depuis }, limit: 2000 })
  ]);
  const durs = rebonds.filter(function (x) { return x.data && x.data.dur; }).length;
  if (envoyes >= 15 && durs / envoyes > 0.08) {
    const raison = durs + ' rebonds définitifs sur ' + envoyes + ' envois (' + Math.round((durs / envoyes) * 100) + ' %) : trop d\'adresses invalides.';
    await db.insert('hq_messages', { from_id: 'emailing', to_id: 'louis', company_id: 'novalemo', kind: 'alerte', subject: 'Envoi mis en pause', body: raison + ' J\'ai coupé l\'envoi pour protéger le domaine. Marcus ne garde plus que les adresses vues sur les sites ; tu relances depuis la boîte quand tu veux.' }, { returning: false });
    return ecrireEtat(db, { pause: true, raison: raison, pause_at: iso() });
  }
  return etat;
}

// Ce que la tour affiche
async function etatBoite(db, opts) {
  const id = mail.identite(), on = mail.branchee();
  const r = on ? await mail.reglages().catch(function () { return null; }) : null;
  let e = await lireEtat(db);
  const cfg = await db.one('hq_config', { eq: { key: 'budget' } });
  const budget = (cfg && cfg.value) || {};
  const depuis14 = iso(Date.now() - 14 * 86400000);
  const [jour, sent14, in14, prets, aValider] = await Promise.all([
    db.count('hq_outbox', { eq: { status: 'envoye' }, in: { kind: ['prospection', 'relance'] }, gte: { sent_at: minuitGP().toISOString() } }),
    db.count('hq_outbox', { eq: { status: 'envoye' }, in: { kind: ['prospection', 'relance'] }, gte: { sent_at: depuis14 } }),
    db.select('hq_inbox', { select: 'kind,data', gte: { received_at: depuis14 }, limit: 3000 }),
    db.count('hq_outbox', { eq: { status: 'pret' } }),
    db.count('hq_outbox', { eq: { status: 'a_valider' } })
  ]);
  const k = function (x) { return in14.filter(function (i) { return i.kind === x; }).length; };
  if (on && (!e.dns || !e.dns_at || Date.now() - new Date(e.dns_at).getTime() > 12 * 3600000) && !(opts && opts.court)) {
    try { const d = await mail.verifierDns(); if (d) e = await ecrireEtat(db, { dns: d, dns_at: iso() }); } catch (err) { /* DNS injoignable : on réessaiera */ }
  }
  return {
    branchee: on, adresse: id.adresse || null, nom: id.nom, fournisseur: r ? r.nom : null, smtp: r ? r.smtp + ':' + r.smtpPort : null, imap: r ? r.imap + ':' + r.imapPort : null, aide_mot_de_passe: r ? r.motDePasse || null : null,
    pause: !!e.pause, raison: e.raison || null, debut: e.debut || null, palier: palier(joursDepuis(e.debut)), quota: quota(e, budget), envoyes_jour: jour, prets: prets, a_valider: aValider,
    envoi_auto: !!budget.envoi_auto, plafond: Number(budget.emails_jour || 25),
    stats14: { envoyes: sent14, reponses: k('reponse'), stop: k('stop'), rebonds: k('rebond'), absences: k('absence'), taux_reponse: sent14 ? Math.round((k('reponse') / sent14) * 1000) / 10 : 0 },
    dns: e.dns || null, releve_at: e.releve_at || null, erreur_releve: e.erreur_releve || null, fenetre: 'du lundi au vendredi, 8 h à 17 h 30 (Guadeloupe)'
  };
}

module.exports = { releve, etatBoite, lireEtat, ecrireEtat, palier, quota, surveiller, trier, annulerEnAttente, reveiller };
