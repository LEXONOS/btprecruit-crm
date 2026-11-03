// Camille, Contrôleuse de gestion : coût par agent et par livrable, alerte au PDG, pause des agents qui
// coûtent sans produire, ménage de la base pour qu'elle reste légère.
'use strict';
const { jourGP } = require('../util');

async function run(ctx) {
  const db = ctx.db;
  const depuis7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const hier = jourGP(new Date(Date.now() - 86400000));
  const [runs, items, emails, leads, jours] = await Promise.all([
    db.select('hq_runs', { select: 'agent_id,cost_usd', gte: { started_at: depuis7 }, limit: 8000 }),
    db.select('hq_items', { select: 'agent_id', gte: { created_at: depuis7 }, limit: 8000 }),
    db.select('hq_outbox', { select: 'agent_id', gte: { created_at: depuis7 }, limit: 8000 }),
    db.select('hq_leads', { select: 'data', gte: { created_at: depuis7 }, limit: 8000 }),
    db.select('hq_daily', { gte: { day: jourGP(new Date(Date.now() - 7 * 86400000)) }, order: 'day.asc' })
  ]);
  const par = {};
  function p(id) { return par[id] || (par[id] = { cout: 0, passages: 0, livrables: 0 }); }
  runs.forEach(function (r) { p(r.agent_id).cout += Number(r.cost_usd || 0); p(r.agent_id).passages++; });
  items.forEach(function (r) { p(r.agent_id).livrables++; });
  emails.forEach(function (r) { p(r.agent_id).livrables++; });
  leads.forEach(function (r) { const by = r.data && r.data.ajoute_par; if (by) p(by).livrables++; });
  // les chasseurs produisent des prospects : comptés via leurs passages réussis (run.produit dans le log)
  const jHier = jours.find(function (j) { return j.day === hier; });
  const total7 = jours.reduce(function (s, j) { return s + Number(j.cost_usd || 0); }, 0);
  const plafond = Number(ctx.budget.jour_usd || 0);
  const coupes = [];
  for (const a of ctx.agents) {
    if (a.kind !== 'llm' || a.status === 'paused' || ['pdg', 'dg'].indexOf(a.tier) >= 0) continue;
    const s = par[a.id];
    if (s && s.cout > 0.30 && s.livrables === 0 && ['directeur', 'rh', 'manager'].indexOf(a.tier) < 0) {
      await db.update('hq_agents', { status: 'paused', current_task: 'En pause : 7 jours de coût sans livrable' }, { eq: { id: a.id } });
      coupes.push(a.name + ' (' + s.cout.toFixed(2) + ' $)');
    }
  }
  const classement = Object.keys(par).map(function (id) { const a = ctx.agents.find(function (x) { return x.id === id; }); return { nom: a ? a.name : id, cout: par[id].cout, livrables: par[id].livrables }; })
    .sort(function (a, b) { return b.cout - a.cout; }).slice(0, 5);
  const lignes = [
    'Hier : ' + (jHier ? Number(jHier.cost_usd).toFixed(2) : '0.00') + ' $ pour un plafond de ' + plafond.toFixed(2) + ' $/jour.',
    '7 jours : ' + total7.toFixed(2) + ' $.',
    'Plus gros postes 7 j : ' + (classement.map(function (c) { return c.nom + ' ' + c.cout.toFixed(2) + ' $ / ' + c.livrables + ' livrables'; }).join(', ') || 'aucun'),
    coupes.length ? 'Mis en pause (coût sans livrable) : ' + coupes.join(', ') : 'Aucun agent à couper.'
  ];
  const alerte = jHier && plafond && Number(jHier.cost_usd) > 0.8 * plafond;
  await db.insert('hq_messages', { from_id: ctx.agent.id, to_id: 'pdg', company_id: 'groupe', kind: alerte || coupes.length ? 'alerte' : 'rapport', subject: 'Point coûts du jour' + (alerte ? ' : plafond presque atteint' : ''), body: lignes.join('\n') }, { returning: false });
  ctx.compteurs.messages++;
  // ménage hebdomadaire (lundi)
  let menage = null;
  if (new Date().getUTCDay() === 1) menage = await db.rpc('hq_menage', {}).catch(function () { return null; });
  return { resume: lignes[0] + ' ' + (coupes.length ? coupes.length + ' agent(s) mis en pause.' : 'Rien à couper.'), produit: 1, detail: { classement: classement, coupes: coupes, menage: menage } };
}

module.exports = { run };
