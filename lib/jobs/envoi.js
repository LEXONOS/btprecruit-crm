// L'envoi réel, par la boîte de Louis (SMTP), jamais par Resend (interdit pour la prospection).
// Ne part que ce qui est « prêt » : passé au contrôle qualité en pilote automatique, ou validé par Louis.
// Prospection : jours ouvrés, 8 h à 17 h 30 (heure des Antilles), palier de chauffe, deux envois maximum par passage, espacés.
// Réponses et emails de service (paiement, mise en ligne) : tous les jours de 7 h 30 à 20 h 30, c'est une conversation.
// Garde-fou de zone : Novalemo ne prospecte que la Martinique, un email vers un prospect hors zone est annulé.
'use strict';
const { heureGP, dormir, court } = require('../util');
const { TZ, NOVALEMO } = require('../config');
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
function heureDeReponse() { const h = heureGP(); return h >= 7.5 && h < 20.5; }
const CONVERSATION = ['reponse', 'service'];

// Un contrat en cours (site payé) : ses emails de service (facture, mise en ligne, hébergement) partent même après un STOP
async function contratEnCours(db, leadId) {
  if (!leadId) return false;
  return (await db.select('hq_sites', { select: 'id', eq: { lead_id: leadId }, in: { status: ['paye', 'livraison', 'en_ligne', 'pause'] }, limit: 1 })).length > 0;
}
async function annuler(db, m, erreur, raison) { await db.update('hq_outbox', { status: 'annule', error: erreur, updated_at: iso() }, { eq: { id: m.id } }); return { ok: false, raison: raison || erreur }; }

// Envoie un message de la file. Retourne { ok, raw } ou { ok: false, raison }.
async function envoyerUn(db, m) {
  const kind = m.kind || 'prospection';
  const lead = m.lead_id ? await db.one('hq_leads', { eq: { id: m.lead_id } }) : null;
  const adresse = String(m.to_email || '').trim().toLowerCase();
  // STOP : vaut pour tout (prospection, relances, réponses, aperçus promis), sauf le service d'un contrat payé
  const sup = await db.one('hq_suppression', { eq: { email: adresse } });
  if ((sup || (lead && lead.status === 'stop')) && !(kind === 'service' && await contratEnCours(db, m.lead_id))) return annuler(db, m, 'désinscrit');
  if (CONVERSATION.indexOf(kind) < 0) {
    if (kind === 'relance' && lead && STOP_RELANCE.indexOf(lead.status) >= 0) return annuler(db, m, 'le prospect a déjà répondu', 'déjà répondu');
    if (lead && lead.island && NOVALEMO.iles.indexOf(lead.island) < 0) return annuler(db, m, 'hors zone (Novalemo : ' + NOVALEMO.zone + ' uniquement)', 'hors zone');
    // une même adresse ne reçoit jamais deux premiers emails (même entreprise trouvée par deux chasseurs)
    if (kind === 'prospection') {
      const deja = await db.select('hq_outbox', { select: 'id', eq: { to_email: adresse, kind: 'prospection', status: 'envoye' }, limit: 1 });
      if (deja.length && deja[0].id !== m.id) return annuler(db, m, 'déjà écrit à cette adresse');
    }
  }
  const res = await mail.envoyer({ to: m.to_email, subject: m.subject, text: m.body, ref: m.id, inReplyTo: m.in_reply_to || undefined });
  const t = iso();
  await db.update('hq_outbox', { status: 'envoye', sent_at: t, updated_at: t, message_id: res.messageId, error: null, to_email: adresse }, { eq: { id: m.id } });
  if (lead && CONVERSATION.indexOf(kind) < 0 && ['nouveau', 'a_contacter', 'brouillon', 'contacte', 'relance'].indexOf(lead.status) >= 0) await db.update('hq_leads', { status: kind === 'relance' ? 'relance' : 'contacte', contacted_at: t, updated_at: t }, { eq: { id: lead.id } });
  if (kind === 'reponse' && m.inbox_id) await db.update('hq_inbox', { status: 'traite' }, { eq: { id: m.inbox_id } });
  return { ok: true, raw: res.raw };
}

// Un envoi raté se réessaie (15 min, 1 h, 4 h, 12 h, 24 h) ; seule une adresse refusée par son serveur est définitive.
const ATTENTES = [15, 60, 240, 720, 1440];
const RE_ADRESSE_REFUSEE = /\b55[0-4]\b[^\n]*(user|mailbox|recipient|address|adresse|destinataire)|5\.1\.[0-9]|user unknown|no such user|does not exist|invalid recipient|recipient rejected|mailbox unavailable|destinataire inconnu/i;
const RE_CONNEXION = /EAUTH|535|authentication|auth failed|invalid login|username and password|identifiants|mot de passe/i;
function pretARessayer(m) { const n = m.essais || 0; return !n || Date.now() - new Date(m.updated_at || 0).getTime() >= ATTENTES[Math.min(n, ATTENTES.length) - 1] * 60000; }
async function echec(db, m, e) {
  const msg = court(String((e && e.message) || e), 300), n = (m.essais || 0) + 1, t = iso();
  const code = Number((e && e.responseCode) || (msg.match(/\b([45]\d\d)[ -]/) || [])[1] || 0);
  const connexion = RE_CONNEXION.test(msg) || code === 535;
  const refusee = !connexion && RE_ADRESSE_REFUSEE.test(msg);
  // refus définitif du serveur (5xx hors identification) : réessayer ne servirait qu'à abîmer la réputation
  const definitif = refusee || (!connexion && code >= 500 && code < 600);
  if (!definitif && n <= ATTENTES.length) {
    await db.update('hq_outbox', { essais: n, error: 'essai ' + n + ' : ' + msg, updated_at: t }, { eq: { id: m.id } });
    if (connexion && n === 2) await alerteConnexion(db, msg);
    return;
  }
  await db.update('hq_outbox', { status: 'erreur', essais: n, error: msg, updated_at: t }, { eq: { id: m.id } });
  const kind = m.kind || 'prospection';
  if (refusee && m.to_email) {
    // adresse morte : comme un rebond définitif
    await db.upsert('hq_suppression', { email: String(m.to_email).trim().toLowerCase(), reason: 'adresse refusée' }, { onConflict: 'email' });
    const lead = m.lead_id ? await db.one('hq_leads', { eq: { id: m.lead_id } }) : null;
    if (lead && kind === 'prospection' && ['brouillon', 'a_contacter'].indexOf(lead.status) >= 0) await db.update('hq_leads', { status: lead.phone ? 'a_appeler' : 'sans_contact', reason: court('Email refusé par son serveur. ' + (lead.reason || ''), 300), updated_at: t }, { eq: { id: lead.id } });
    return;
  }
  // refusé (politique du serveur) ou abandon après cinq essais : le prospect redevient « à contacter »,
  // une réponse redevient « à traiter » si c'était un problème passager
  if (kind === 'prospection' && m.lead_id) await db.update('hq_leads', Object.assign({ status: definitif ? 'ecarte' : 'a_contacter', updated_at: t }, definitif ? { reason: court('Email refusé par son serveur : ' + msg, 300) } : {}), { eq: { id: m.lead_id, status: 'brouillon' } });
  if (kind === 'reponse' && m.inbox_id && !definitif) await db.update('hq_inbox', { status: 'nouveau' }, { eq: { id: m.inbox_id } });
  await db.insert('hq_messages', { from_id: 'emailing', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: definitif ? 'Email refusé par le serveur du destinataire' : 'Email abandonné après cinq essais', body: 'À ' + m.to_email + ' (' + kind + ') : ' + msg }, { returning: false });
}
async function alerteConnexion(db, msg) {
  const k = 'alerte:smtp', r = await db.one('hq_config', { eq: { key: k } });
  if (r && r.value && Date.now() - new Date(r.value.le).getTime() < 86400000) return;
  await db.upsert('hq_config', { key: k, value: { le: iso() } }, { onConflict: 'key' });
  await db.insert('hq_messages', { from_id: 'emailing', to_id: 'louis', company_id: 'novalemo', kind: 'alerte', subject: 'Boîte d\'envoi : connexion refusée', body: 'Le serveur d\'envoi refuse la connexion (' + court(msg, 160) + '). Le mot de passe de la boîte a peut-être changé : mets le nouveau dans HQ_MAIL_PASS (Vercel). Les emails attendent et repartent seuls.' }, { returning: false });
}

async function run(ctx) {
  const db = ctx.db;
  if (!mail.branchee()) return { resume: 'Boîte non branchée.', envoyes: 0 };
  const limite = ctx.limite || Date.now() + 120000;
  const raws = [];
  let n = 0, reps = 0;

  // 1. réponses et emails de service : tous les jours, de 7 h 30 à 20 h 30 (une réponse à 3 h du matin ferait robot)
  if (ctx.toujours || heureDeReponse()) {
    for (const m of (await db.select('hq_outbox', { eq: { status: 'pret' }, in: { kind: CONVERSATION }, order: 'id.asc', limit: 40 })).filter(pretARessayer).slice(0, 6)) {
      if (Date.now() > limite - 25000) break;
      try { const r = await envoyerUn(db, m); if (r.ok) { reps++; raws.push(r.raw); } } catch (e) { await echec(db, m, e); }
    }
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
      const file = (await db.select('hq_outbox', { eq: { status: 'pret' }, in: { kind: ['prospection', 'relance'] }, order: 'id.asc', limit: 40 })).filter(pretARessayer).slice(0, Math.min(2, reste));
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
  if (reps) parts.push(reps + ' réponse(s) ou email(s) de service envoyé(s)');
  if (!parts.length && raison) parts.push(raison);
  return { resume: parts.join(', ') + '.', envoyes: n + reps };
}

module.exports = { run, configure, envoyerUn, echec, pretARessayer, dansLaFenetre, heureDeReponse, CONVERSATION };
