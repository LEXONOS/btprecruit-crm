// Les conversations WhatsApp : relève des messages reçus (Kapso), rattachement au prospect par son numéro, Emma réveillée.
// Et, tant que WhatsApp n'est pas branché, la mesure de la demande : combien de prospects demandent WhatsApp ou un appel.
// Au-delà du seuil, Louis est prévenu une fois par mois : la mission WhatsApp l'attend dans la tour.
'use strict';
const W = require('../whatsapp');
const MQ = require('../martinique');
const { court, coupe } = require('../util');

const iso = function (t) { return new Date(t || Date.now()).toISOString(); };
const RE_STOP = /^\s*(stop|arr[êe]t(ez)?|d[ée]sinscri|ne plus (me )?(contacter|[ée]crire))\b/i;
// une demande de WhatsApp, ou d'appel, dans un email reçu
const RE_WHATSAPP = /whats\s?app|watsap|wats\s?ap|watsapp|wa\.me|\bwhat'?s\b|par (message|texto|sms)\b|sur (mon )?(portable|mobile) par message/i;
const RE_APPEL = /appel(ez|er|le)[- ]?(moi|nous)?|t[ée]l[ée]phon|rappel(ez|er)|mon (num[ée]ro|portable)|me joindre|nous joindre|joignable/i;
const SEUIL = { whatsapp: 3, total: 6 };

function demandeDe(texte) {
  const t = String(texte || '');
  if (RE_WHATSAPP.test(t)) return 'whatsapp';
  if (RE_APPEL.test(t)) return 'appel';
  return null;
}

async function lireCle(db, k) { const r = await db.one('hq_config', { eq: { key: k } }); return (r && r.value) || null; }
async function poserCle(db, k, v) { await db.upsert('hq_config', { key: k, value: v, updated_at: iso() }, { onConflict: 'key' }); }

// Les numéros des prospects, au format international, pour reconnaître qui écrit
async function indexTelephones(db) {
  const m = new Map();
  (await db.select('hq_leads', { select: 'id,phone,status,name', not_in: { status: ['ecarte'] }, order: 'id.desc' })).forEach(function (l) {
    const e = MQ.e164(l.phone);
    if (e && !m.has(e)) m.set(e, l);
  });
  return m;
}

// La demande des 30 derniers jours (emails reçus) et le nombre de prospects qu'on ne peut joindre que par téléphone
async function demande(db) {
  const depuis = iso(Date.now() - 30 * 86400000);
  const recus = await db.select('hq_inbox', { select: 'data,lead_id', eq: { kind: 'reponse' }, gte: { received_at: depuis }, limit: 3000 }).catch(function () { return []; });
  const qui = function (k) { return new Set(recus.filter(function (x) { return x.data && x.data.demande === k; }).map(function (x) { return x.lead_id; })).size; };
  const mobiles = await db.count('hq_leads', { eq: { status: 'a_appeler', island: 'MQ' } }).catch(function () { return 0; });
  return { whatsapp: qui('whatsapp'), appel: qui('appel'), mobiles_sans_email: mobiles, seuil: SEUIL.whatsapp };
}
async function surveillerDemande(db) {
  if (W.branche()) return null;
  const d = await demande(db);
  if (d.whatsapp < SEUIL.whatsapp && d.whatsapp + d.appel < SEUIL.total) return d;
  const deja = await lireCle(db, 'alerte:whatsapp');
  if (deja && Date.now() - new Date(deja.le).getTime() < 30 * 86400000) return d;
  await poserCle(db, 'alerte:whatsapp', { le: iso(), demande: d });
  await db.insert('hq_messages', { from_id: 'reponses', to_id: 'louis', company_id: 'novalemo', kind: 'alerte', subject: 'WhatsApp : la demande est là', body: 'Ces 30 derniers jours, ' + d.whatsapp + ' prospect(s) ont demandé à échanger sur WhatsApp et ' + d.appel + ' un appel. Emma leur répond par email, mais un numéro WhatsApp les ferait signer plus vite. La mission WhatsApp est prête dans la tour (bouton Missions) : une SIM, un compte Kapso, deux codes à coller. Emma répondra ensuite sur WhatsApp comme par email.' }, { returning: false });
  return d;
}

// La relève : chaque message reçu devient une réponse à traiter, rattachée au prospect par son numéro (vérifié par
// WhatsApp, c'est bien lui) ; un inconnu devient un prospect. STOP : plus aucune réponse.
async function releve(ctx) {
  const db = ctx.db;
  if (!W.branche()) return { resume: 'WhatsApp non branché.', nouveaux: 0 };
  const etat = (await lireCle(db, 'whatsapp')) || {};
  const t0 = iso();
  const depuis = etat.le ? iso(new Date(etat.le).getTime() - 10 * 60000) : iso(Date.now() - 2 * 86400000);
  let msgs;
  try { msgs = await W.recus(depuis); }
  catch (e) { await poserCle(db, 'whatsapp', Object.assign({}, etat, { erreur: court(e.message, 160), erreur_le: t0 })); return { resume: 'WhatsApp : ' + court(e.message, 100), erreur: true, nouveaux: 0 }; }
  const index = msgs.length ? await indexTelephones(db) : new Map();
  let n = 0, stops = 0;
  for (const m of msgs) {
    const e = MQ.e164(m.de) || m.de;
    let lead = index.get(e) || null;
    if (!lead) {
      const ins = await db.insert('hq_leads', { company_id: 'novalemo', dedupe: 'wa:' + e, source: 'whatsapp', name: court(m.nom || e, 120), phone: e, island: /^\+596/.test(e) ? 'MQ' : null, status: 'repondu', score: 75, reason: 'A écrit sur WhatsApp', data: { whatsapp: { premier: m.le } } }, { onConflict: 'dedupe', ignoreDuplicates: true });
      lead = (ins && ins[0]) || await db.one('hq_leads', { eq: { dedupe: 'wa:' + e } });
      if (lead) index.set(e, lead);
    }
    const stop = RE_STOP.test(m.texte || '') && String(m.texte || '').length < 120;
    const row = { message_id: 'wa:' + m.id, lead_id: lead ? lead.id : null, outbox_id: null, from_email: 'wa:' + e, from_name: court(m.nom || '', 120), subject: 'WhatsApp', body: coupe((m.texte || '') + (m.media ? '\n[pièce jointe : ' + m.type + ']' : ''), 4000), kind: stop ? 'stop' : 'reponse', intent: stop ? 'stop' : null, status: stop ? 'traite' : 'nouveau', data: { canal: 'whatsapp', confiance: 'whatsapp', tel: e, recu_le: m.le, media: m.media || null }, received_at: m.le };
    const ins = await db.insert('hq_inbox', row, { onConflict: 'message_id', ignoreDuplicates: true });
    if (!ins || !ins.length) continue;
    n++;
    if (!lead) continue;
    if (stop) {
      stops++;
      await db.update('hq_leads', { status: lead.status === 'client' ? 'client' : 'stop', updated_at: t0 }, { eq: { id: lead.id } });
      await db.update('hq_outbox', { status: 'annule', error: 'STOP reçu sur WhatsApp', updated_at: t0 }, { eq: { lead_id: lead.id }, in: { status: ['a_valider', 'pret'], kind: ['prospection', 'relance', 'reponse'] } });
      continue;
    }
    if (['interesse', 'client', 'stop'].indexOf(lead.status) < 0) await db.update('hq_leads', { status: 'repondu', updated_at: t0 }, { eq: { id: lead.id } });
    await db.update('hq_outbox', { status: 'annule', error: 'le prospect a répondu sur WhatsApp', updated_at: t0 }, { eq: { lead_id: lead.id }, in: { status: ['a_valider', 'pret'], kind: ['prospection', 'relance'] } });
    await db.insert('hq_messages', { from_id: 'reponses', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: 'WhatsApp de ' + (lead.name || m.nom || e), body: court(m.texte, 700) + '\n\n(Emma s\'en occupe, rien à faire.)', ref: { inbox_id: ins[0].id, lead_id: lead.id } }, { returning: false });
  }
  await poserCle(db, 'whatsapp', { le: t0, erreur: null });
  if (n - stops > 0) await require('./boite').reveiller(db, 'reponses', 0);
  return { resume: n ? n + ' message(s) WhatsApp' + (stops ? ', dont ' + stops + ' STOP' : '') : 'Rien de neuf sur WhatsApp.', nouveaux: n - stops };
}

module.exports = { releve, demande, demandeDe, surveillerDemande, SEUIL };
