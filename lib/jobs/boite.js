// La boîte de réception de la prospection : relève, tri (vraie réponse, STOP, rebond, absence) et effets.
// Une vraie réponse : prospect « a répondu », relances annulées, Louis prévenu, Emma (chargée des réponses) réveillée.
// Un STOP : liste noire + plus aucun envoi. Un rebond définitif : adresse écartée, le prospect passe en appel si on a son numéro.
// Montée en charge : palier d'envoi qui grimpe avec l'ancienneté de la boîte, accéléré quand elle est saine (des réponses,
// ni rebonds ni STOP), freiné dès qu'elle fatigue ; pause automatique si trop de rebonds.
'use strict';
const mail = require('../mail');
const { minuitGP, court, coupe } = require('../util');
const RE_JE_VEUX = /^\s*(re\s*:\s*)?je veux ce site\s*:?\s*(.*)$/i;

const CLE = 'boite';
const iso = function (t) { return new Date(t || Date.now()).toISOString(); };
const bas = function (s) { return String(s || '').trim().toLowerCase(); };

async function lireEtat(db) { const r = await db.one('hq_config', { eq: { key: CLE } }); return (r && r.value) || {}; }
async function ecrireEtat(db, patch) {
  const v = Object.assign({}, await lireEtat(db), patch);
  await db.upsert('hq_config', { key: CLE, value: v, updated_at: iso() }, { onConflict: 'key' });
  return v;
}

// Chauffe de la boîte : 8 par jour au départ, 40 au bout d'un mois. Une seule boîte ne va pas plus loin sans s'abîmer :
// au-delà, il faut d'autres boîtes. Le palier est multiplié par la santé de la boîte (facteur 0,3 à 1,25), et jamais
// au-delà du plafond de Louis.
function palier(jours) { return jours < 3 ? 8 : jours < 7 ? 12 : jours < 14 ? 18 : jours < 21 ? 25 : jours < 30 ? 32 : 40; }
function joursDepuis(t) { return t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 86400000)) : 0; }
const PLAFOND_DEFAUT = 50;
function facteurDe(etat) { const f = Number(etat && etat.sante && etat.sante.facteur); return f > 0 ? Math.min(1.25, f) : 1; }
function quota(etat, budget) {
  const plafond = Number((budget && budget.emails_jour) != null && budget.emails_jour !== '' ? budget.emails_jour : PLAFOND_DEFAUT);
  return Math.max(0, Math.min(plafond, Math.round(palier(joursDepuis(etat && etat.debut)) * facteurDe(etat))));
}

// La santé de la boîte sur 7 jours (prospection et relances) : les rebonds et les STOP freinent, les réponses accélèrent.
// Jugée à partir de 25 envois ; avant, on suit le palier.
const SANTE_MIN = 25;
function jugerSante(envoyes, durs, stops, reponses) {
  const s = { envoyes: envoyes, rebonds: durs, stop: stops, reponses: reponses, facteur: 1, niveau: 'normal', raison: null, mesure_le: iso() };
  if (envoyes < SANTE_MIN) { s.raison = 'pas encore assez d\'envois pour juger (' + envoyes + ' sur ' + SANTE_MIN + ')'; return s; }
  const b = durs / envoyes, st = stops / envoyes, r = reponses / envoyes;
  const freins = [];
  if (b > 0.04) { s.facteur *= 0.5; freins.push(Math.round(b * 100) + ' % de rebonds'); }
  else if (b > 0.02) { s.facteur *= 0.75; freins.push(Math.round(b * 100) + ' % de rebonds'); }
  if (st > 0.03) { s.facteur *= 0.6; freins.push(Math.round(st * 100) + ' % de STOP'); }
  else if (st > 0.015) { s.facteur *= 0.85; freins.push(Math.round(st * 1000) / 10 + ' % de STOP'); }
  if (freins.length) { s.niveau = 'fatigue'; s.raison = freins.join(' et ') + ' sur 7 jours : j\'envoie moins le temps que ça se calme'; }
  else if (r >= 0.05) { s.facteur = 1.25; s.niveau = 'saine'; s.raison = Math.round(r * 100) + ' % de réponses, aucun signal négatif : j\'accélère'; }
  else s.raison = 'aucun signal négatif';
  s.facteur = Math.round(Math.max(0.3, s.facteur) * 100) / 100;
  return s;
}
async function mesurerSante(db) {
  const depuis = iso(Date.now() - 7 * 86400000);
  const [comptes, recus] = await Promise.all([
    rebondsComptes(db, depuis),
    db.select('hq_inbox', { select: 'kind,intent,data,from_email,lead_id', in: { kind: ['rebond', 'stop', 'reponse'] }, gte: { received_at: depuis }, limit: 3000 })
  ]);
  // sans les adresses devinées (voir rebondsComptes) : leurs rebonds ne disent rien des adresses qu'on écrit aujourd'hui
  const envoyes = comptes.envoyes;
  // WhatsApp ne dit rien de la boîte d'envoi ; on compte des personnes, pas des messages (trois emails du même prospect
  // font une réponse) ; une réponse classée STOP par Emma est un STOP ; les messages des clients ne comptent pas
  const emails = recus.filter(function (x) { return !/^wa:/.test(x.from_email || ''); });
  const qui = function (x) { return x.lead_id ? 'l' + x.lead_id : 'e' + String(x.from_email || '').toLowerCase(); };
  const lids = Array.from(new Set(emails.filter(function (x) { return x.kind === 'reponse' && x.lead_id; }).map(function (x) { return x.lead_id; })));
  const clients = new Set();
  for (let i = 0; i < lids.length; i += 300) (await db.select('hq_leads', { select: 'id,status', in: { id: lids.slice(i, i + 300) }, eq: { status: 'client' } })).forEach(function (l) { clients.add(l.id); });
  const stops = new Set(emails.filter(function (x) { return x.kind === 'stop' || x.intent === 'stop'; }).map(qui));
  const reponses = new Set(emails.filter(function (x) { return x.kind === 'reponse' && x.intent !== 'stop' && !(x.lead_id && clients.has(x.lead_id)) && !stops.has(qui(x)); }).map(qui));
  return jugerSante(envoyes, comptes.durs, stops.size, reponses.size);
}

const RE_REBOND_DE = /^(mailer-daemon|postmaster|mail-daemon|maildaemon|bounce|bounces|mdaemon)/i;
const RE_REBOND_SUJET = /(undeliver|delivery status|delivery fail|failure notice|returned mail|non remis|non distribu|échec de (la )?(remise|distribution)|could not be delivered|address not found|adresse introuvable|message bloqué|mail delivery)/i;
const RE_DUR = /\b5\.[0-7]\.\d{1,3}\b|\b55[0-4][ -]|user unknown|unknown user|does not exist|n'existe pas|no such user|mailbox unavailable|adresse introuvable|address not found|invalid recipient|recipient rejected|destinataire inconnu|introuvable/i;
const RE_ABSENCE = /(absence|absent|out of (the )?office|automatic reply|réponse automatique|reponse automatique|auto[- ]?reply|autoreply|congés|conges|vacances|en déplacement)/i;
const RE_STOP = /(\bstop\b|désinscri|desinscri|unsubscribe|ne plus (me )?(recevoir|contacter|écrire|ecrire|solliciter)|retirez[- ]moi|supprimez[- ]moi|ne m'écrivez plus|ne m'ecrivez plus)/i;

// Le lien de désinscription de nos emails (mailto:...?subject=STOP) et les boutons des messageries écrivent STOP dans l'objet
const RE_STOP_SUJET = /^\s*((re|tr|fwd?)\s*:\s*)*(stop|unsubscribe|d[ée]sinscription|d[ée]sabonnement)\b/i;

function trier(meta, neuf, brut) {
  const h = String(meta.headers || '');
  const local = String(meta.from || '').split('@')[0];
  if (RE_REBOND_DE.test(local) || (/multipart\/report/i.test(h) && /delivery-status/i.test(h)) || RE_REBOND_SUJET.test(meta.subject || '')) return { kind: 'rebond', dur: RE_DUR.test(brut || '') };
  // avant le test d'absence : la désinscription envoyée par une messagerie porte souvent un en-tête automatique
  if (RE_STOP_SUJET.test(meta.subject || '')) return { kind: 'stop' };
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
    // un client reste client (factures et mise en ligne continuent) ; un prospect sort de tout
    if (lead && lead.status === 'client') { await annulerEnAttente(db, lead.id, 'STOP reçu', ['prospection', 'relance', 'reponse']); return; }
    if (lead) { await db.update('hq_leads', { status: 'stop', updated_at: maintenant }, { eq: { id: lead.id } }); await annulerEnAttente(db, lead.id, 'STOP reçu'); }
    return;
  }
  if (lead && ['interesse', 'client', 'stop'].indexOf(lead.status) < 0) await db.update('hq_leads', { status: 'repondu', updated_at: maintenant }, { eq: { id: lead.id } });
  if (lead) await annulerEnAttente(db, lead.id, 'le prospect a répondu', ['relance', 'prospection']);
  // Claude bloqué (limite de dépense du compte Anthropic) : Emma ne peut pas répondre, Louis répond lui-même
  const bloque = await require('../garde').compteBloque(db).catch(function () { return null; });
  await db.insert('hq_messages', { from_id: 'reponses', to_id: 'louis', company_id: 'novalemo', kind: bloque ? 'alerte' : 'note', subject: (bloque ? 'À toi de répondre : ' : '') + (lead && lead.status === 'client' ? 'Message du client ' : 'Réponse de ') + ((lead && lead.name) || ib.from_name || ib.from_email), body: court(ib.body, 700) + (bloque ? '\n\n(Emma ne peut pas répondre : le compte Anthropic est à sa limite de dépense. Réponds-lui toi-même depuis la boîte ' + ((require('../mail').identite() || {}).adresse || 'de Novalemo') + ', dans le même fil.)' : '\n\n(Emma s\'en occupe, rien à faire.)'), ref: { inbox_id: ib.id, lead_id: lead ? lead.id : null } }, { returning: false });
  await reveiller(db, 'reponses', 1);
}

// « Je veux ce site : Nom » écrit depuis le bandeau d'un aperçu, parfois d'une autre adresse que celle qu'on a
async function siteDemande(db, sujet) {
  const nom = String((String(sujet || '').match(RE_JE_VEUX) || [])[2] || '').trim().toLowerCase();
  if (!nom) return null;
  const sites = await db.select('hq_sites', { select: 'id,lead_id,spec', in: { status: ['apercu', 'commande'] }, order: 'id.desc', limit: 500 });
  const s = sites.find(function (x) { return String((x.spec && x.spec.nom) || '').replace(/\*\*/g, '').trim().toLowerCase() === nom; });
  return s ? { id: null, lead_id: s.lead_id, to_email: null } : null;
}
// Images envoyées par le client (logo, photos) : gardées en base pour son site, la chargée des réponses les utilise
async function garderImages(db, leadId, inboxId, images) {
  const crypto = require('crypto');
  const { dimensions } = require('../sites/photos');
  const lead = await db.one('hq_leads', { eq: { id: leadId }, select: 'id,site_id' });
  for (const im of images.slice(0, 8)) {
    const d = dimensions(im.contenu) || {};
    const logo = /logo/i.test(im.nom) || (d.l && d.h && d.l <= 1200 && Math.abs(d.l - d.h) / Math.max(d.l, d.h) < 0.35 && im.taille < 400000 && images.length > 1);
    await db.insert('hq_fichiers', { site_id: lead && lead.site_id || null, lead_id: leadId, inbox_id: inboxId, nom: court(im.nom, 120), mime: im.type, taille: im.taille, largeur: d.l || null, hauteur: d.h || null, sha: crypto.createHash('sha1').update(im.contenu).digest('hex'), role: logo ? 'logo' : 'photo', utilise: false, contenu: im.contenu.toString('base64') }, { returning: false });
  }
}

// À qui se rattache un message reçu : par la référence COMPLÈTE d'un de nos envois (numéro et aléa, impossible à deviner),
// sinon par l'adresse à laquelle on a écrit. Recherche message par message (aucune liste plafonnée en mémoire).
function rattacheur(db) {
  const depuis = iso(Date.now() - 120 * 86400000);
  const parRef = new Map(), parAdresse = new Map();
  const CHAMPS = 'id,lead_id,to_email,message_id,subject,kind,status,sent_at';
  return {
    async fil(refs) {
      for (const x of refs) {
        if (!parRef.has(x.cle)) {
          const o = await db.one('hq_outbox', { eq: { id: x.id }, select: CHAMPS });
          parRef.set(x.cle, o && o.status === 'envoye' && bas(o.message_id).indexOf(x.cle) >= 0 ? o : null);
        }
        if (parRef.get(x.cle)) return parRef.get(x.cle);
      }
      return null;
    },
    async adresse(de) {
      const em = bas(de);
      if (!em) return null;
      if (!parAdresse.has(em)) parAdresse.set(em, (await db.select('hq_outbox', { select: CHAMPS, eq: { to_email: em, status: 'envoye' }, gte: { sent_at: depuis }, order: 'id.desc', limit: 1 }))[0] || null);
      return parAdresse.get(em);
    }
  };
}
// Les en-têtes d'un message, dépliés (une ligne repliée continue par un espace ou une tabulation)
function entetesDe(src) { return String(src || '').split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' '); }
// Domaine d'organisation (approché : les deux derniers niveaux), pour comparer un domaine authentifié à celui de l'expéditeur
function racine(d) { return String(d || '').toLowerCase().replace(/^.*@/, '').replace(/[>"\s]/g, '').replace(/\.$/, '').split('.').filter(Boolean).slice(-2).join('.'); }
// Qui a le droit d'écrire le résultat d'authentification, selon le fournisseur de la boîte (reconnu par ses MX)
const SERVEURS_AUTH = { Google: /google\.com$/i, 'Microsoft 365': /outlook\.com$/i, Zoho: /zoho(mail)?\.(com|eu|in)$/i, OVH: /ovh\.(net|com)$/i, IONOS: /(ionos|kundenserver|1and1)\./i, Infomaniak: /infomaniak\.(ch|com)$/i, Gandi: /gandi\.net$/i, Hostinger: /hostinger\./i };
// Un expéditeur n'a la confiance d'une adresse connue que si le serveur qui nous a remis le message l'authentifie.
// On lit le PREMIER Authentication-Results (ajouté par notre fournisseur, au-dessus de tout ce que l'expéditeur a pu écrire) :
// DMARC passé pour son domaine, ou sans politique DMARC, SPF ou DKIM passés pour SON domaine. Rien de lisible : douteux.
function authentifie(src, de, fournisseur) {
  const m = entetesDe(src).match(/^authentication-results:[ \t]*(.*)$/im);
  if (!m) return false;
  const morceaux = m[1].replace(/\([^)]*\)/g, ' ').split(';').map(function (x) { return x.trim(); }).filter(Boolean);
  if (morceaux.length && morceaux[0].split(/\s+/)[0].indexOf('=') < 0) {
    const auteur = morceaux.shift().split(/\s+/)[0];
    if (SERVEURS_AUTH[fournisseur] && !SERVEURS_AUTH[fournisseur].test(auteur)) return false;
  }
  const dom = racine(de);
  if (!dom || dom.indexOf('.') < 0) return false;
  const res = morceaux.map(function (p) {
    const mm = p.match(/^([a-z0-9-]+)\s*=\s*([a-z]+)/i);
    if (!mm) return null;
    const props = {};
    p.replace(/\b((?:header|smtp)\.[a-z]+)\s*=\s*"?([^\s";]+)"?/gi, function (tout, k, v) { props[k.toLowerCase()] = v.toLowerCase(); return tout; });
    return { m: mm[1].toLowerCase(), r: mm[2].toLowerCase(), p: props };
  }).filter(Boolean);
  const aligne = function (v) { return !!v && racine(v) === dom; };
  const dmarc = res.filter(function (x) { return x.m === 'dmarc'; });
  if (dmarc.some(function (x) { return x.r === 'pass' && (!x.p['header.from'] || aligne(x.p['header.from'])); })) return true;
  if (dmarc.some(function (x) { return ['fail', 'reject', 'quarantine'].indexOf(x.r) >= 0; })) return false;
  return res.some(function (x) { return x.r === 'pass' && ((x.m === 'spf' && aligne(x.p['smtp.mailfrom'])) || (x.m === 'dkim' && aligne(x.p['header.d'] || x.p['header.i']))); });
}

// La relève : appelée à chaque cycle (et par le bouton « Relever maintenant »)
async function releve(ctx) {
  const db = ctx.db;
  if (!mail.branchee()) return { resume: 'Boîte non branchée.', nouveaux: 0 };
  const etat = await lireEtat(db);
  const rat = rattacheur(db);
  const fournisseur = ((await mail.reglages().catch(function () { return null; })) || {}).nom || null;
  const aEnvoye = (await db.count('hq_outbox', { eq: { status: 'envoye' }, gte: { sent_at: iso(Date.now() - 120 * 86400000) } })) > 0;
  const garder = async function (meta) {
    const refs = mail.refsDe(meta.inReplyTo).concat(mail.refsDe(meta.headers));
    if (refs.length && await rat.fil(refs)) return true;
    if (RE_JE_VEUX.test(meta.subject || '')) return true;          // bouton « Je veux ce site » d'un aperçu
    if (!aEnvoye) return false;
    if (RE_REBOND_DE.test(String(meta.from || '').split('@')[0]) || RE_REBOND_SUJET.test(meta.subject || '')) return true;
    return !!(await rat.adresse(meta.from));
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
    const src = m.source ? m.source.toString('utf8') : '';
    const refs = mail.refsDe(m.inReplyTo).concat(mail.refsDe(m.headers), mail.refsDe(brut), mail.refsDe(src));
    // confiance : « fil » (réponse à un de nos emails, référence complète), « adresse » (l'adresse à qui on a écrit),
    // « sujet » (seulement le bouton « Je veux ce site ») ; « douteux » si son serveur ne l'authentifie pas
    let envoi = await rat.fil(refs), confiance = envoi ? 'fil' : null;
    if (!envoi) { envoi = await rat.adresse(m.from); if (envoi) confiance = 'adresse'; }
    if (!envoi && RE_JE_VEUX.test(m.subject || '')) { envoi = await siteDemande(db, m.subject); if (envoi) confiance = 'sujet'; }
    if (!envoi) continue;
    if (confiance === 'adresse' && !authentifie(src || m.headers, m.from, fournisseur)) confiance = 'douteux';
    let t = trier(m, neuf, brut);
    // un client (site payé) n'est jamais classé STOP d'office (« Désabonnement » en objet veut souvent dire : arrêter
    // l'abonnement) : son message va à Emma, qui juge
    if (t.kind === 'stop' && envoi.lead_id) { const l = await db.one('hq_leads', { eq: { id: envoi.lead_id }, select: 'id,status' }); if (l && l.status === 'client') t = { kind: 'reponse' }; }
    const row = {
      message_id: m.messageId || ('uid:' + r.etat.uidValidity + ':' + m.uid), lead_id: envoi.lead_id || null, outbox_id: envoi.id,
      from_email: bas(m.from), from_name: court(m.fromName || '', 120), subject: court(m.subject || '', 200),
      body: coupe(t.kind === 'rebond' ? brut : (neuf || brut), 4000), kind: t.kind, intent: t.kind === 'stop' ? 'stop' : null,
      status: t.kind === 'reponse' ? 'nouveau' : 'traite', data: { uid: m.uid, pieces: lu.attachments || [], images: (lu.images || []).length, dur: !!t.dur, confiance: confiance, demande: t.kind === 'reponse' ? require('./whatsapp').demandeDe(neuf || brut) : null },
      received_at: m.date ? iso(m.date) : iso()
    };
    const ins = await db.insert('hq_inbox', row, { onConflict: 'message_id', ignoreDuplicates: true });
    if (!ins || !ins.length) continue;
    n[t.kind]++;
    // ses images (logo, photos) ne vont sur son site que si le message vient vraiment de lui
    if (t.kind === 'reponse' && lu.images && lu.images.length && envoi.lead_id && (confiance === 'fil' || confiance === 'adresse')) await garderImages(db, envoi.lead_id, ins[0].id, lu.images).catch(function () {});
    await effets(db, t, ins[0], envoi);
  }
  await ecrireEtat(db, { imap: r.etat, releve_at: iso(), erreur_releve: null });
  // combien de prospects demandent WhatsApp ou un appel : au-delà du seuil, Louis est prévenu (une fois par mois)
  if (n.reponse) await require('./whatsapp').surveillerDemande(db).catch(function () {});
  const total = n.reponse + n.stop + n.rebond + n.absence;
  return { resume: total ? [n.reponse && n.reponse + ' réponse(s)', n.stop && n.stop + ' STOP', n.rebond && n.rebond + ' rebond(s)', n.absence && n.absence + ' absence(s)'].filter(Boolean).join(', ') : 'Rien de neuf dans la boîte.', nouveaux: total, detail: n };
}

// Les envois et les rebonds définitifs depuis une date, sans les adresses devinées (contact@ du domaine) : elles sont
// interdites à froid depuis la version 9, et leurs vieux rebonds du 4 novembre (4 sur 5 envois devinés) ont mis la boîte en
// pause le 9 novembre alors que les adresses lues sur les sites n'avaient aucun rebond
async function rebondsComptes(db, depuis) {
  const [envois, rebonds] = await Promise.all([
    db.select('hq_outbox', { select: 'id,lead_id', eq: { status: 'envoye' }, in: { kind: ['prospection', 'relance'] }, gte: { sent_at: depuis }, limit: 5000 }).catch(function () { return []; }),
    db.select('hq_inbox', { select: 'data,lead_id', eq: { kind: 'rebond' }, gte: { received_at: depuis }, limit: 2000 }).catch(function () { return []; })
  ]);
  const lids = Array.from(new Set(envois.concat(rebonds).map(function (x) { return x.lead_id; }).filter(Boolean)));
  const devines = new Set();
  for (let i = 0; i < lids.length; i += 300) (await db.select('hq_leads', { select: 'id', eq: { email_source: 'devine' }, in: { id: lids.slice(i, i + 300) } }).catch(function () { return []; })).forEach(function (l) { devines.add(l.id); });
  return {
    envoyes: envois.filter(function (o) { return !devines.has(o.lead_id); }).length,
    durs: rebonds.filter(function (x) { return x.data && x.data.dur && !devines.has(x.lead_id); }).length,
    ignores: devines.size
  };
}

// Trop de rebonds depuis la dernière reprise : on coupe l'envoi avant d'abîmer la réputation du domaine
async function surveiller(db, etat, budget) {
  // pause automatique pour rebonds : reprise seule au bout de 72 h, avec seulement des adresses vues sur les sites
  if (etat.pause && etat.pause_auto && etat.pause_at && Date.now() - new Date(etat.pause_at).getTime() > 72 * 3600000) {
    await db.insert('hq_messages', { from_id: 'emailing', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: 'Envoi repris après la pause', body: 'Reprise automatique après 72 h. Marcus ne garde plus que les adresses vues sur les sites pendant 30 jours.' }, { returning: false });
    return ecrireEtat(db, { pause: false, pause_auto: false, raison: null, reprise_at: iso(), adresses_vues_jusqua: iso(Date.now() + 30 * 86400000) });
  }
  if (etat.pause) return etat;
  const depuis = etat.reprise_at || etat.debut;
  if (!depuis) return etat;
  const { envoyes, durs } = await rebondsComptes(db, depuis);
  if (envoyes >= 15 && durs / envoyes > 0.08) {
    const raison = durs + ' rebonds définitifs sur ' + envoyes + ' envois (' + Math.round((durs / envoyes) * 100) + ' %) : trop d\'adresses invalides.';
    await db.insert('hq_messages', { from_id: 'emailing', to_id: 'louis', company_id: 'novalemo', kind: 'alerte', subject: 'Envoi mis en pause', body: raison + ' J\'ai coupé l\'envoi pour protéger le domaine. Reprise automatique dans 72 h avec seulement les adresses vues sur les sites ; rien à faire.' }, { returning: false });
    return ecrireEtat(db, { pause: true, pause_auto: true, raison: raison, pause_at: iso(), adresses_vues_jusqua: iso(Date.now() + 30 * 86400000) });
  }
  // la santé de la boîte, mesurée au plus toutes les 30 minutes : elle règle le palier du jour
  if (!etat.sante || !etat.sante.mesure_le || Date.now() - new Date(etat.sante.mesure_le).getTime() > 30 * 60000) {
    const s = await mesurerSante(db);
    // Louis est prévenu quand la boîte se met à fatiguer, une fois tous les trois jours au plus
    const prevenir = s.facteur < 1 && facteurDe(etat) >= 1 && !(etat.fatigue_dite_le && Date.now() - new Date(etat.fatigue_dite_le).getTime() < 72 * 3600000);
    if (prevenir) await db.insert('hq_messages', { from_id: 'emailing', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: 'La boîte fatigue : j\'envoie moins', body: 'Sur 7 jours : ' + s.envoyes + ' envois, ' + s.rebonds + ' rebond(s), ' + s.stop + ' STOP, ' + s.reponses + ' réponse(s). Le palier du jour passe de ' + quota(etat, budget) + ' à ' + quota(Object.assign({}, etat, { sante: s }), budget) + ' emails. Il remonte tout seul quand ça se calme ; rien à faire.' }, { returning: false });
    return ecrireEtat(db, prevenir ? { sante: s, fatigue_dite_le: iso() } : { sante: s });
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
    facteur: facteurDe(e), sante: e.sante ? { niveau: e.sante.niveau, raison: e.sante.raison, envoyes7: e.sante.envoyes, mesure_le: e.sante.mesure_le } : null,
    envoi_auto: !!budget.envoi_auto, plafond: budget.emails_jour != null && budget.emails_jour !== '' ? Number(budget.emails_jour) : PLAFOND_DEFAUT,
    stats14: { envoyes: sent14, reponses: k('reponse'), stop: k('stop'), rebonds: k('rebond'), absences: k('absence'), taux_reponse: sent14 ? Math.round((k('reponse') / sent14) * 1000) / 10 : 0 },
    dns: e.dns || null, releve_at: e.releve_at || null, erreur_releve: e.erreur_releve || null, fenetre: 'du lundi au vendredi, 8 h à 17 h 30 (heure des Antilles)'
  };
}

module.exports = { releve, etatBoite, lireEtat, ecrireEtat, palier, quota, facteurDe, jugerSante, mesurerSante, surveiller, rebondsComptes, trier, annulerEnAttente, reveiller, authentifie, garderImages };
