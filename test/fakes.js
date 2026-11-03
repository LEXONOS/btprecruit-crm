// Faux réseau pour les tests et la démo locale : Claude, Google Places, GitHub, Afnic, annuaire, BODACC, sites.
'use strict';
let appelsClaude = 0;
const dns = require('dns');
dns.promises.resolve4 = async function () { return ['93.184.216.34']; };
dns.promises.resolve6 = async function () { return []; };
dns.promises.resolveMx = async function (d) { return d.indexOf('sansmx') >= 0 ? [] : [{ exchange: 'mx1.mail.ovh.net', priority: 1 }]; };


function rep(content, stop, extraUsage) {
  return { ok: true, status: 200, json: async function () { return { content: content, stop_reason: stop || 'tool_use', usage: Object.assign({ input_tokens: 3000, output_tokens: 400, cache_read_input_tokens: 1500, cache_creation_input_tokens: 0 }, extraUsage || {}) }; } };
}
let n = 0; const tu = function (name, input) { n++; return { type: 'tool_use', id: 'tu_' + n, name: name, input: input }; };

function claude(body) {
  appelsClaude++;
  const sys = body.system.map(function (b) { return b.text; }).join('\n');
  const qui = (sys.match(/TA FICHE DE POSTE \(([^,]+),/) || [])[1] || '';
  const last = body.messages[body.messages.length - 1];
  const userText = typeof last.content === 'string' ? last.content : last.content.map(function (b) { return b.text || b.content || ''; }).join('\n');
  const toolResult = typeof last.content !== 'string' && last.content.some(function (b) { return b.type === 'tool_result'; });
  if (/veilleuse GitHub/i.test(sys)) return rep([{ type: 'text', text: '{"resume":"Framework d\'agents.","pourquoi_fort":"très actif","a_reprendre":"la mémoire","pour_quel_agent":"tous","attention":"MIT","score":82}' }], 'end_turn');
  if (qui === 'Maximilien') {
    const prop = (userText.match(/VALIDÉ PAR LOUIS[\s\S]*?\[proposition #(\d+)\]/) || [])[1];
    if (prop) return rep([tu('creer_entreprise', { proposition_id: Number(prop), contexte: 'Conformité Web : audit des sites des Antilles.' }), tu('creer_agent', { nom: 'Bastien', poste: 'DG Conformité Web', chef: 'pdg', entreprise: 'conformite', niveau: 'dg', mission: 'Lancer la conformité.', fiche: 'Fiche test', outils: ['rapporter', 'decider'], modele: 'smart', cadence_min: 720 }), tu('terminer', { resume: 'Conformité Web créée, DG recruté.' })]);
    return rep([tu('assigner', { a: 'dg_novalemo', titre: 'Objectif semaine 1', consigne: '50 prospects avec email, 30 brouillons.', echeance_jours: 7 }), tu('strategie', { nouvelle_strategie: 'Priorité 1 : Novalemo.', raison: 'lancement' }), tu('terminer', { resume: 'Réunion de lancement faite.' })]);
  }
  if (qui === 'Élise') return rep([tu('assigner', { a: 'dircom_novalemo', titre: 'Cibles', consigne: 'Clim et plomberie d\'abord.' }), tu('proposer', { type: 'nouvel_agent', titre: 'Recruter un vérificateur d\'emails', justification: 'Moins de rebonds.' }), tu('terminer', { resume: 'Consignes données, 1 proposition.' })]);
  if (qui === 'Chloé') {
    if (!toolResult) return rep([tu('lister_leads', { statut: 'a_contacter', limite: 5 })]);
    const tr = last.content.find(function (b) { return b.type === 'tool_result'; });
    const leads = JSON.parse(tr.content);
    return rep(leads.map(function (l) { return null; }).filter(Boolean).concat([tu('rediger_emails', { emails: leads.slice(0, 3).map(function (l) { return { lead_id: l.id, objet: 'Le site de ' + l.nom, corps: 'Bonjour,\nVotre site n\'a pas de mentions légales.\nLouis', angle: 'conformite' }; }) }), tu('terminer', { resume: Math.min(3, leads.length) + ' brouillons.' })]));
  }
  if (qui === 'Emma') {
    if (!toolResult) return rep([tu('lister_reponses', {})]);
    const tr = last.content.find(function (b) { return b.type === 'tool_result'; });
    let rows; try { rows = JSON.parse(tr.content); } catch (e) { rows = []; }
    if (!Array.isArray(rows) || !rows.length) return rep([tu('terminer', { resume: 'Aucune réponse.' })]);
    const r = rows[0];
    return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'interesse', note: 'Veut être appelé demain.' }), tu('repondre', { reponse_id: r.id, corps: 'Bonjour Monsieur Dupont,\nAvec plaisir. Je vous appelle demain en fin de matinée ou jeudi après-midi ?\nLouis\nNovalemo (Studio Novalem), Guadeloupe\n+590 691 25 34 49' }), tu('terminer', { resume: 'Réponse préparée pour ' + r.de })]);
  }
  if (qui === 'Alan' || qui === 'Malik' || qui === 'Lucie' || qui === 'Adam') return rep([tu('livrer', { type: qui === 'Malik' ? 'idee' : qui === 'Adam' ? 'niche' : 'veille', titre: 'Livrable de ' + qui, contenu: 'Contenu.', score: 70 }), tu('terminer', { resume: 'Un livrable.' })], 'tool_use', { server_tool_use: { web_search_requests: 2 } });
  if (qui === 'Clara') return rep([tu('livrer', { type: 'script', titre: 'Comment marche une serrure', contenu: 'Script.' }), tu('terminer', { resume: 'Un script.' })]);
  return rep([tu('apprendre', { lecon: 'Leçon de ' + qui, poids: 5 }), tu('terminer', { resume: 'Passage de ' + qui })]);
}

const PAGE = '<html><head><title>Clim Pro 971</title><meta name="viewport" content="width=device-width"></head><body>Climatisation à Baie-Mahault. Contact : contact@climpro971.fr <a href="/contact">Contact</a> © 2018</body></html>';
global.fetch = async function (url, opts) {
  url = String(url);
  if (url.indexOf('api.anthropic.com') >= 0) return claude(JSON.parse(opts.body));
  if (url.indexOf('places.googleapis.com') >= 0) {
    return { ok: true, status: 200, json: async function () { return { places: [
      { id: 'p1', displayName: { text: 'Clim Pro 971' }, formattedAddress: '12 rue X, 97122 Baie-Mahault, Guadeloupe', internationalPhoneNumber: '+590 690 11 22 33', websiteUri: 'https://climpro971.fr', rating: 4.6, userRatingCount: 30, businessStatus: 'OPERATIONAL' },
      { id: 'p2', displayName: { text: 'Froid Services' }, formattedAddress: '97139 Les Abymes', internationalPhoneNumber: '+590 690 44 55 66', websiteUri: 'https://www.facebook.com/froid', businessStatus: 'OPERATIONAL' },
      { id: 'p3', displayName: { text: 'Carrefour Destreland' }, formattedAddress: '97122 Baie-Mahault', internationalPhoneNumber: '+590 590 00 00 00', businessStatus: 'OPERATIONAL' },
      { id: 'p4', displayName: { text: 'Plomberie Durand' }, formattedAddress: '97190 Le Gosier', internationalPhoneNumber: '+590 690 77 88 99', businessStatus: 'OPERATIONAL' }
    ] }; } };
  }
  if (url.indexOf('api.github.com/search') >= 0) return { ok: true, status: 200, json: async function () { return { items: [{ full_name: 'org/agents', html_url: 'https://github.com/org/agents', stargazers_count: 42000, language: 'Python', license: { spdx_id: 'MIT' }, pushed_at: '2026-10-30', description: 'Agents', topics: ['ai-agents'], default_branch: 'main' }] }; } };
  if (url.indexOf('raw.githubusercontent.com') >= 0) return { ok: true, status: 200, text: async function () { return '# Agents\nUn framework.'; } };
  if (url.indexOf('afnic.fr') >= 0) return { ok: true, status: 200, text: async function () { return 'climpro-guadeloupe.fr\ncasino-777.fr\nboulangerie-paris15.fr\n'; } };
  if (url.indexOf('recherche-entreprises.api.gouv.fr') >= 0) {
    const q = decodeURIComponent((url.match(/q=([^&]+)/) || [])[1] || '');
    const total = url.indexOf('departement=') < 0;
    if (total) return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { total_results: 1, results: [] }; } };
    if (/clim\s*pro/.test(q)) return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [{ siren: '123456789', nom_raison_sociale: 'CLIMPRO GUADELOUPE', nom_complet: 'CLIMPRO GUADELOUPE', nature_juridique: '5710', categorie_entreprise: 'PME', date_creation: '2026-06-01', activite_principale: '43.22B', etat_administratif: 'A', siege: { departement: '971', code_postal: '97122', libelle_commune: 'BAIE-MAHAULT', siret: '12345678900011' }, dirigeants: [{ type_dirigeant: 'personne physique', nom: 'DUPONT', prenoms: 'Jean', qualite: 'Président' }] }] }; } };
    return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [] }; } };
  }
  if (url.indexOf('bodacc') >= 0) return { ok: true, status: 200, json: async function () { return { results: [{ id: 'b1', commercant: 'SOLAIRE KARUKERA', ville: 'Petit-Bourg', numerodepartement: '971', dateparution: '2026-10-30', registre: ['987 654 321', '987654321'], listeetablissements: JSON.stringify({ etablissement: { activite: 'Installation de panneaux solaires' } }) }, { id: 'b2', commercant: 'SCI DES PALMIERS', ville: 'Le Gosier', numerodepartement: '971', dateparution: '2026-10-29', registre: ['111 222 333'], listeetablissements: JSON.stringify({ etablissement: { activite: 'Location de logements' } }) }] }; } };
  // sites web
  const html = /climpro|ifc-guadeloupe|love-dogs/.test(url) ? PAGE.replace('Clim Pro 971', 'Site Studio Novalem') + ' Site réalisé par Studio Novalem' : '<html><body>Bienvenue</body></html>';
  return { ok: true, status: 200, url: url, headers: { get: function (h) { return /content-type/i.test(h) ? 'text/html; charset=utf-8' : null; } }, body: null, text: async function () { return html; } };
};


module.exports = { appels: function () { return appelsClaude; } };
