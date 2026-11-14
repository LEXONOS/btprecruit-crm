// Yanis : les relances, écrites par le code (lib/accroche.js), dans le même fil que le premier email, à quelqu'un qui n'a
// rien répondu. Depuis le 14 nov. 2026 (Louis : « on a largement assez de sites faits et envoyés, il faut les relancer
// maintenant »), trois au plus : le lien remis à J+3 (la nouvelle du prix à 99 € pour qui avait reçu l'ancien message),
// une question simple à J+8, le dernier message à J+15 avec la date où l'aperçu est retiré. Jamais deux relances qui
// attendent en même temps, jamais moins de trois jours entre deux, jamais à quelqu'un qui a répondu, dit STOP, ou dont
// l'aperçu n'est plus en ligne. Zéro coût d'IA.
'use strict';
const A = require('../accroche');
const { NOVALEMO } = require('../config');
const { court } = require('../util');

const JOUR = 86400000;
const ETAPES = (NOVALEMO.relances && NOVALEMO.relances.length ? NOVALEMO.relances : [3, 8, 15]).slice(0, 3);
const JOURS = ETAPES[0];
const ECART_MIN_JOURS = 3;
const PAR_PASSAGE = 12;
// un prospect qui a reçu le premier email et n'a rien dit : « contacte », puis « relance » après la première relance
const A_RELANCER = ['contacte', 'relance'];

// la relance que doit recevoir ce prospect maintenant : { numero } ou null (avec la raison, pour les essais)
function suivante(premier, relances, maintenant) {
  const t = maintenant || Date.now();
  const actives = (relances || []).filter(function (r) { return ['annule', 'erreur'].indexOf(r.status) < 0; });
  if (actives.some(function (r) { return r.status !== 'envoye'; })) return { attente: 'une relance attend déjà de partir' };
  const n = actives.length;
  if (n >= ETAPES.length) return { fini: true };
  const depart = new Date(premier.sent_at).getTime();
  if (!(depart > 0) || t < depart + ETAPES[n] * JOUR) return { attente: 'pas encore le jour (J+' + ETAPES[n] + ')' };
  const derniere = actives.map(function (r) { return new Date(r.sent_at || 0).getTime(); }).reduce(function (a, b) { return Math.max(a, b); }, 0);
  if (derniere && t < derniere + ECART_MIN_JOURS * JOUR) return { attente: 'trois jours au moins entre deux relances' };
  return { numero: n + 1 };
}

async function run(ctx) {
  const db = ctx.db, budget = ctx.budget || {};
  if (await require('../sites/phase').enTest(db)) return { resume: 'Phase de test des sites : pas de relance pour l\'instant.', produit: 0 };
  const P = require('../sites/publication');
  const pub = await P.lireEtat(db).catch(function () { return {}; });
  const hote = pub.hote || pub.hote_vercel;
  if (!hote) return { resume: 'Les aperçus ne sont pas encore publiés.', produit: 0 };
  const auto = !!budget.envoi_auto;
  const avant = new Date(Date.now() - JOURS * JOUR).toISOString();
  const premiers = await db.select('hq_outbox', { select: 'id,lead_id,to_email,subject,message_id,angle,sent_at', eq: { kind: 'prospection', status: 'envoye' }, lte: { sent_at: avant }, order: 'sent_at.asc', limit: 600 });
  const faits = [];
  const vus = new Set();
  for (const o of premiers) {
    if (faits.length >= PAR_PASSAGE) break;
    if (!o.lead_id || !o.to_email || vus.has(o.lead_id)) continue;
    vus.add(o.lead_id);
    const l = await db.one('hq_leads', { eq: { id: o.lead_id } });
    // seulement quelqu'un qui n'a rien dit ; répondu, intéressé, STOP, écarté, client : jamais
    if (!l || A_RELANCER.indexOf(l.status) < 0) continue;
    if (l.island && NOVALEMO.iles.indexOf(l.island) < 0) continue;
    const adresse = String(o.to_email).trim().toLowerCase();
    if (await db.one('hq_suppression', { eq: { email: adresse } })) continue;
    const relances = await db.select('hq_outbox', { select: 'id,status,sent_at,step', eq: { lead_id: l.id, kind: 'relance' }, order: 'id.asc', limit: 12 });
    const s = suivante(o, relances);
    if (!s.numero) continue;
    // un message reçu de lui depuis le premier email (même classé autrement) : plus de relance
    const recu = await db.select('hq_inbox', { select: 'id', eq: { lead_id: l.id }, in: { kind: ['reponse', 'stop'] }, limit: 1 });
    if (recu.length) continue;
    if (!l.site_id) continue;
    const site = await db.one('hq_sites', { eq: { id: l.site_id }, select: 'id,slug,status,spec' });
    if (!site || site.status !== 'apercu' || !site.slug) continue;
    // la nouvelle du prix (99 €) ne se dit qu'une fois, à la première relance de qui avait reçu l'ancien message
    const ancien = s.numero === 1 && !/^v:L\b/.test(String(o.angle || ''));
    // l'aperçu reste en ligne 30 jours après le dernier email (Lucas) : la date dite est un peu en deçà
    const jusqu = new Date(Date.now() + Math.max(7, (NOVALEMO.apercu_jours || 30) - 2) * JOUR);
    const r = A.relance(l, site, P.urlApercu(hote, site.slug), { numero: s.numero, ancien: ancien, jusqu: jusqu });
    await db.insert('hq_outbox', { lead_id: l.id, agent_id: (ctx.agent && ctx.agent.id) || 'relanceur', to_email: adresse, subject: court('Re: ' + String(o.subject || '').replace(/^\s*(re\s*:\s*)+/i, ''), 120), body: r.corps, step: s.numero + 1, angle: ancien ? 'relance 99' : 'v:L relance ' + s.numero, status: auto ? 'pret' : 'a_valider', kind: 'relance', in_reply_to: o.message_id || null }, { returning: false });
    if (ctx.compteurs) ctx.compteurs.emails = (ctx.compteurs.emails || 0) + 1;
    faits.push(l.name + ' (' + (ancien ? 'nouveau prix' : 'relance ' + s.numero) + ')');
  }
  return { resume: faits.length ? faits.length + ' relance(s) écrite(s) : ' + faits.join(', ') + '.' : 'Personne à relancer aujourd\'hui.', produit: faits.length, detail: { relances: faits }, prochain_min: faits.length >= PAR_PASSAGE ? 60 : 360 };
}

module.exports = { run, suivante, JOURS, ETAPES, ECART_MIN_JOURS };
