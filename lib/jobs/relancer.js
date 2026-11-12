// Yanis depuis le 12 nov. 2026 : une seule relance, écrite par le code (lib/accroche.js), dans le même fil que le premier
// email, quatre jours après, à quelqu'un qui n'a rien répondu. Ceux qui avaient reçu l'ancien message (490 €) reçoivent la
// nouvelle du prix à 99 € ; les autres, le lien remis simplement. Jamais à quelqu'un qui a répondu, dit STOP, ou dont
// l'aperçu n'est plus en ligne. Zéro coût d'IA.
'use strict';
const A = require('../accroche');
const { NOVALEMO } = require('../config');
const { court } = require('../util');

const iso = function () { return new Date().toISOString(); };
const JOURS = 4;
const PAR_PASSAGE = 10;

async function run(ctx) {
  const db = ctx.db, budget = ctx.budget || {};
  if (await require('../sites/phase').enTest(db)) return { resume: 'Phase de test des sites : pas de relance pour l\'instant.', produit: 0 };
  const P = require('../sites/publication');
  const pub = await P.lireEtat(db).catch(function () { return {}; });
  const hote = pub.hote || pub.hote_vercel;
  if (!hote) return { resume: 'Les aperçus ne sont pas encore publiés.', produit: 0 };
  const auto = !!budget.envoi_auto;
  const avant = new Date(Date.now() - JOURS * 86400000).toISOString();
  const premiers = await db.select('hq_outbox', { select: 'id,lead_id,to_email,subject,message_id,angle,sent_at', eq: { kind: 'prospection', status: 'envoye' }, lte: { sent_at: avant }, order: 'sent_at.asc', limit: 400 });
  const faits = [];
  for (const o of premiers) {
    if (faits.length >= PAR_PASSAGE) break;
    if (!o.lead_id || !o.to_email) continue;
    const l = await db.one('hq_leads', { eq: { id: o.lead_id } });
    // seulement quelqu'un qui n'a rien dit (contacté) ; répondu, intéressé, STOP, écarté : jamais
    if (!l || l.status !== 'contacte') continue;
    if (l.island && NOVALEMO.iles.indexOf(l.island) < 0) continue;
    const adresse = String(o.to_email).trim().toLowerCase();
    if (await db.one('hq_suppression', { eq: { email: adresse } })) continue;
    // une relance au plus, au total (règle de Louis : on ne court pas après les gens)
    const suite = await db.select('hq_outbox', { select: 'id', eq: { lead_id: l.id, kind: 'relance' }, not_in: { status: ['annule', 'erreur'] }, limit: 1 });
    if (suite.length) continue;
    // un message reçu de lui depuis le premier email (même classé autrement) : pas de relance
    const recu = await db.select('hq_inbox', { select: 'id', eq: { lead_id: l.id }, in: { kind: ['reponse', 'stop'] }, limit: 1 });
    if (recu.length) continue;
    if (!l.site_id) continue;
    const site = await db.one('hq_sites', { eq: { id: l.site_id }, select: 'id,slug,status,spec' });
    if (!site || site.status !== 'apercu' || !site.slug) continue;
    const ancien = !/^v:L\b/.test(String(o.angle || ''));
    const r = A.relance(l, site, P.urlApercu(hote, site.slug), ancien);
    await db.insert('hq_outbox', { lead_id: l.id, agent_id: (ctx.agent && ctx.agent.id) || 'relanceur', to_email: adresse, subject: court('Re: ' + String(o.subject || '').replace(/^\s*(re\s*:\s*)+/i, ''), 120), body: r.corps, step: 2, angle: ancien ? 'relance 99' : 'v:L relance', status: auto ? 'pret' : 'a_valider', kind: 'relance', in_reply_to: o.message_id || null }, { returning: false });
    if (ctx.compteurs) ctx.compteurs.emails = (ctx.compteurs.emails || 0) + 1;
    faits.push(l.name + (ancien ? ' (nouveau prix)' : ''));
  }
  return { resume: faits.length ? faits.length + ' relance(s) écrite(s) : ' + faits.join(', ') + '.' : 'Personne à relancer aujourd\'hui.', produit: faits.length, detail: { relances: faits }, prochain_min: 360 };
}

module.exports = { run, JOURS };
