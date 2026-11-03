// Ce que voit un agent quand il se réveille : sa fiche (fixe, mise en cache), puis le contexte du moment
// (stratégie, connaissances, consignes de Louis, boîte de réception, tâches, équipe, propositions, chiffres).
'use strict';
const { DOCTRINE } = require('./seed');
const { quandGP, court } = require('./util');

function systeme(agent, company) {
  return [
    DOCTRINE,
    company && company.context ? company.context : '',
    'TA FICHE DE POSTE (' + agent.name + ', ' + agent.title + ')\n' + (agent.charter || agent.mission || ''),
    'MÉTHODE : tu peux appeler plusieurs outils dans la même réponse. Va droit au but. Termine toujours par l\'outil terminer.'
  ].filter(Boolean).join('\n\n');
}

function ligneAgent(a) {
  const quand = a.last_run_at ? new Date(a.last_run_at).toLocaleString('fr-FR', { timeZone: 'America/Guadeloupe', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'jamais';
  return '- ' + a.id + ' | ' + a.name + ' | ' + a.title + ' | ' + a.status + (a.waiting_for ? ' (attend : ' + court(a.waiting_for, 90) + ')' : '') + ' | dernier passage ' + quand + (a.current_task ? ' | ' + court(a.current_task, 140) : '');
}

async function construire(db, agent, agents, companies, budgetEtat) {
  const company = companies.find(function (c) { return c.id === agent.company_id; });
  const parent = agents.find(function (a) { return a.id === agent.parent_id; });
  const equipe = agents.filter(function (a) { return a.parent_id === agent.id; });
  const chefs = ['pdg', 'dg'].indexOf(agent.tier) >= 0;
  const donneAvis = ['rh', 'directeur'].indexOf(agent.tier) >= 0;

  const [savoir, inbox, taches, propsOuvertes, propsLouis] = await Promise.all([
    db.select('hq_knowledge', { eq: { agent_id: agent.id }, order: ['weight.desc', 'id.desc'], limit: 12, select: 'content,weight,source' }),
    db.select('hq_messages', { eq: { to_id: agent.id }, is: { read_at: null }, order: 'id.asc', limit: 14, select: 'id,from_id,kind,subject,body,ref,created_at' }),
    db.select('hq_tasks', { eq: { agent_id: agent.id, status: 'a_faire' }, order: 'id.asc', limit: 6 }),
    (chefs || donneAvis) ? db.select('hq_proposals', { eq: { status: 'ouverte' }, order: 'id.asc', limit: 12 }) : Promise.resolve([]),
    chefs ? db.select('hq_proposals', { eq: { status: 'validee', decided_by: 'louis' }, order: 'id.asc', limit: 6 }) : Promise.resolve([])
  ]);
  const nom = function (id) { if (id === 'louis') return 'Louis'; if (id === 'systeme') return 'Système'; const a = agents.find(function (x) { return x.id === id; }); return a ? a.name + ' (' + a.title + ')' : id; };

  const consignesLouis = inbox.filter(function (m) { return m.from_id === 'louis'; });
  const autres = inbox.filter(function (m) { return m.from_id !== 'louis'; });

  // propositions qui me concernent
  let aTrancher = [], aAnnoter = [];
  if (agent.tier === 'dg') aTrancher = propsOuvertes.filter(function (p) { return p.company_id === agent.company_id && p.from_id !== agent.id; });
  if (agent.tier === 'pdg') aTrancher = propsOuvertes.filter(function (p) { return ['groupe', 'labo'].indexOf(p.company_id) >= 0 || !agents.some(function (a) { return a.tier === 'dg' && a.company_id === p.company_id; }) || ['nouvelle_entreprise'].indexOf(p.kind) >= 0; });
  if (donneAvis) aAnnoter = propsOuvertes.filter(function (p) { return (p.company_id === agent.company_id || agent.company_id === 'groupe') && p.from_id !== agent.id && !(p.avis || []).some(function (x) { return x.by === agent.id; }); });
  const aExecuter = propsLouis.filter(function (p) { return agent.tier === 'pdg' ? (p.kind === 'nouvelle_entreprise' || p.company_id === 'groupe' || p.company_id === 'labo') : p.company_id === agent.company_id; });

  const blocs = [];
  blocs.push('Nous sommes ' + quandGP() + ' (heure de Guadeloupe). Tu es ' + agent.name + ', ' + agent.title + ' chez ' + (company ? company.name : agent.company_id) + '. Ton chef : ' + (parent ? parent.name + ' (' + parent.id + ', ' + parent.title + ')' : 'Louis, l\'actionnaire') + '.');
  blocs.push('TA MISSION : ' + (agent.mission || ''));
  blocs.push('TA STRATÉGIE ACTUELLE (tu peux la réécrire avec l\'outil strategie) :\n' + (agent.playbook || '(vide)'));
  if (savoir.length) blocs.push('TES CONNAISSANCES :\n' + savoir.map(function (k) { return '- ' + k.content + (k.source && k.source !== 'appris' && k.source !== 'fondation' ? ' [' + k.source + ']' : ''); }).join('\n'));
  if (agent.current_task) blocs.push('TON DERNIER PASSAGE : ' + agent.current_task);
  if (consignesLouis.length) blocs.push('CONSIGNES DE LOUIS (priorité absolue) :\n' + consignesLouis.map(function (m) { return '[#' + m.id + '] ' + (m.subject ? m.subject + ' : ' : '') + court(m.body, 1500); }).join('\n'));
  if (autres.length) blocs.push('TA BOÎTE DE RÉCEPTION (non lus) :\n' + autres.map(function (m) { return '[#' + m.id + '] de ' + nom(m.from_id) + ' (' + m.kind + ') ' + (m.subject ? m.subject + ' : ' : '') + court(m.body, 600); }).join('\n'));
  if (taches.length) blocs.push('TES TÂCHES OUVERTES (marque-les faites avec tache_faite) :\n' + taches.map(function (t) { return '[tâche #' + t.id + '] ' + t.title + ' (de ' + nom(t.from_id) + (t.due_at ? ', pour le ' + new Date(t.due_at).toLocaleDateString('fr-FR') : '') + ') : ' + court(t.brief, 600); }).join('\n'));
  if (equipe.length) blocs.push('TON ÉQUIPE (sous tes ordres directs) :\n' + equipe.map(ligneAgent).join('\n'));
  if (agent.tier === 'pdg') {
    const org = companies.filter(function (c) { return c.status === 'active'; }).map(function (c) {
      const dg = agents.find(function (a) { return a.company_id === c.id && (a.tier === 'dg' || (c.id === 'labo' && a.id === 'chef_labo')); });
      const n = agents.filter(function (a) { return a.company_id === c.id; });
      return '- ' + c.name + ' (' + c.id + ') : ' + n.length + ' agents, ' + n.filter(function (a) { return a.status === 'attente'; }).length + ' en attente d\'outil' + (dg ? ', dirigé par ' + dg.name + ' (' + dg.id + ')' : '');
    });
    const projets = companies.filter(function (c) { return c.status === 'proposee'; }).map(function (c) { return c.name; });
    blocs.push('LE GROUPE :\n' + org.join('\n') + (projets.length ? '\nProjets d\'entreprises chez Louis : ' + projets.join(', ') : ''));
  }
  if (aTrancher.length) blocs.push('PROPOSITIONS À TRANCHER (outil decider) :\n' + aTrancher.map(function (p) { return '[proposition #' + p.id + '] ' + p.kind + ' : ' + p.title + ' (de ' + nom(p.from_id) + (p.cost_month_usd != null ? ', ' + p.cost_month_usd + ' $/mois' : '') + ')\n  ' + court(p.justification, 700) + ((p.avis || []).length ? '\n  Avis : ' + p.avis.map(function (a) { return a.nom + ' ' + a.avis + ' (' + court(a.texte, 200) + ')'; }).join(' | ') : ''); }).join('\n'));
  if (aAnnoter.length) blocs.push('PROPOSITIONS SUR LESQUELLES DONNER TON AVIS (outil annoter) :\n' + aAnnoter.map(function (p) { return '[proposition #' + p.id + '] ' + p.kind + ' : ' + p.title + ' (de ' + nom(p.from_id) + ') : ' + court(p.justification, 500); }).join('\n'));
  if (aExecuter.length) blocs.push('VALIDÉ PAR LOUIS, À EXÉCUTER MAINTENANT :\n' + aExecuter.map(function (p) { return '[proposition #' + p.id + '] ' + p.kind + ' : ' + p.title + (p.decision_note ? ' (note de Louis : ' + court(p.decision_note, 300) + ')' : '') + '\n  ' + court(p.justification, 500); }).join('\n'));
  if (budgetEtat) blocs.push('BUDGET IA DU JOUR : ' + budgetEtat.depense.toFixed(2) + ' $ dépensés sur ' + budgetEtat.plafond.toFixed(2) + ' $.' + (budgetEtat.envoi_auto ? ' Envoi automatique des emails : activé.' : ' Envoi automatique des emails : désactivé (brouillons validés par Louis).'));
  blocs.push('Fais ton passage maintenant : produis ou décide, avec tes outils, puis termine avec l\'outil terminer. S\'il n\'y a rien d\'utile à faire, appelle terminer tout de suite.');

  const neuf = consignesLouis.length + autres.length + taches.length + aTrancher.length + aAnnoter.length + aExecuter.length;
  return {
    system: systeme(agent, company),
    user: blocs.join('\n\n'),
    lus: inbox.map(function (m) { return m.id; }),
    neuf: neuf
  };
}

module.exports = { construire, systeme };
