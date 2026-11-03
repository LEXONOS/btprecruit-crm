// Chiffres : par agent (coût, passages, livrables), entonnoir de prospection, emails, jour.
'use strict';
const { jourGP } = require('./util');

function compte(rows, cle) {
  const o = {};
  rows.forEach(function (r) { const k = r[cle] || 'aucun'; o[k] = (o[k] || 0) + 1; });
  return o;
}

async function stats(db, agents, companyId) {
  const depuis = new Date(Date.now() - 7 * 86400000).toISOString();
  const ids = agents.filter(function (a) { return !companyId || a.company_id === companyId; }).map(function (a) { return a.id; });
  const [runs, items, leads, outbox, jour] = await Promise.all([
    db.select('hq_runs', { select: 'agent_id,cost_usd,ok', gte: { started_at: depuis }, limit: 5000 }),
    db.select('hq_items', { select: 'agent_id,kind,company_id', gte: { created_at: depuis }, limit: 5000 }),
    (!companyId || companyId === 'novalemo') ? db.select('hq_leads', { select: 'status,source,island', limit: 5000 }) : Promise.resolve([]),
    (!companyId || companyId === 'novalemo') ? db.select('hq_outbox', { select: 'status', limit: 5000 }) : Promise.resolve([]),
    db.one('hq_daily', { eq: { day: jourGP() } })
  ]);
  const parAgent = {};
  ids.forEach(function (id) { parAgent[id] = { passages: 0, cout_usd: 0, echecs: 0, livrables: 0 }; });
  runs.forEach(function (r) { const p = parAgent[r.agent_id]; if (!p) return; p.passages++; p.cout_usd += Number(r.cost_usd || 0); if (r.ok === false) p.echecs++; });
  items.forEach(function (r) { const p = parAgent[r.agent_id]; if (p) p.livrables++; });
  const equipe = agents.filter(function (a) { return ids.indexOf(a.id) >= 0; }).map(function (a) {
    const p = parAgent[a.id];
    return { id: a.id, nom: a.name, poste: a.title, statut: a.status, attend: a.waiting_for || undefined, passages_7j: p.passages, cout_7j_usd: Math.round(p.cout_usd * 1000) / 1000, livrables_7j: p.livrables, echecs_7j: p.echecs || undefined, note_rh: a.score || undefined };
  });
  const out = {
    entreprise: companyId || 'groupe',
    cout_7j_usd: Math.round(equipe.reduce(function (s, a) { return s + a.cout_7j_usd; }, 0) * 1000) / 1000,
    aujourd_hui: jour ? { cout_usd: Number(jour.cost_usd), passages: jour.runs, recherches: jour.searches, prospects: jour.leads, emails: jour.emails, livrables: jour.items } : { cout_usd: 0 },
    equipe: equipe
  };
  if (leads.length || companyId === 'novalemo' || !companyId) {
    out.prospects = { total: leads.length, par_statut: compte(leads, 'status'), par_source: compte(leads, 'source'), par_ile: compte(leads, 'island') };
    out.emails = compte(outbox, 'status');
  }
  if (!companyId || companyId !== 'novalemo') out.livrables_7j = compte(items.filter(function (i) { return !companyId || i.company_id === companyId; }), 'kind');
  return out;
}

module.exports = { stats };
