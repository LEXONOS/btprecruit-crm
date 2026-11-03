// Faux réseau pour les tests et la démo locale : Claude (agents et atelier), Google Places, GitHub, Afnic, annuaire,
// BODACC, sites web, Vercel (projet, fichiers, déploiements, domaines, registrar), Stripe. Tout en Martinique.
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
function dernierResultat(last) { const trs = typeof last.content !== 'string' ? last.content.filter(function (b) { return b.type === 'tool_result'; }) : []; const tr = trs[trs.length - 1]; if (!tr) return null; try { return JSON.parse(tr.content); } catch (e) { return tr.content; } }

/* ── l'atelier : fiche de site ── */
let atelierEssais = 0;
function ficheSite(faits, mauvaise) {
  const nom = (faits.nom || 'Entreprise').replace(/\s+(sarl|sas)$/i, '');
  return {
    nom: nom, activite: 'Climatisation et froid', accroches: [mauvaise ? 'Votre confort, notre priorité absolue depuis toujours' : 'Votre clim posée et suivie', 'Le frais chez vous, bien posé', 'Climatisation au Lamentin'],
    chapo: 'Installation, entretien et dépannage de climatisation pour les maisons, les bureaux et les commerces du centre de la Martinique.',
    objectif: 'devis', cta: 'Demander un devis', ton: 'franc', titre_services: 'Nos services', intro_services: 'Du choix de l\'appareil au nettoyage régulier, un seul interlocuteur.',
    services: [
      { titre: 'Installation', texte: 'Split mural, gainable ou cassette : on vous conseille l\'appareil adapté et on le pose proprement.', detail: 'Avant la pose, on regarde la pièce, l\'exposition et l\'usage.' },
      { titre: 'Entretien', texte: 'Filtres, batterie, évacuation : un appareil propre consomme moins et souffle un air plus sain.', detail: 'Nettoyage complet de l\'unité intérieure et extérieure.' },
      { titre: 'Dépannage', texte: 'Panne, fuite, bruit ou mauvaise odeur : on cherche la cause et on vous explique avant de réparer.', detail: 'Diagnostic clair puis réparation.' }
    ],
    titre_atouts: 'Pourquoi nous appeler', atouts: [{ titre: 'Un conseil honnête', texte: 'On vous dit si l\'appareil vaut la peine d\'être réparé.' }, { titre: 'Un travail propre', texte: 'La pose est soignée et le chantier laissé net.' }, { titre: 'Basés au Lamentin', texte: 'Au centre de l\'île.' }],
    etapes: [{ titre: 'Vous nous écrivez', texte: 'Décrivez votre besoin.' }, { titre: 'On passe voir', texte: 'On vous pose les bonnes questions.' }, { titre: 'On pose', texte: 'Au créneau convenu.' }],
    titre_faq: 'Vos questions', faq: [{ q: 'Quelle puissance pour ma pièce ?', r: 'Elle dépend de la surface et de l\'exposition : écrivez-nous.' }, { q: 'Faut-il entretenir sa clim ?', r: 'Oui, avec l\'air salin un entretien régulier évite les pannes.' }, { q: 'Travaillez-vous pour les pros ?', r: 'Oui, bureaux et commerces.' }],
    titre_contact: 'Parlons de votre clim',
    a_propos: mauvaise ? 'Fondée depuis 2010, plus de 500 clients satisfaits.' : 'Une entreprise de climatisation du Lamentin.',
    zone: 'Basés au Lamentin, en Martinique', mots_photo: ['air conditioner unit wall', 'hvac tools', 'portrait of smiling technician'],
    seo: { titre: 'Climatisation au Lamentin, ' + nom, description: 'Installation, entretien et dépannage de climatisation au Lamentin.' }
  };
}
function atelier(body) {
  atelierEssais++;
  const last = body.messages[body.messages.length - 1];
  const txt = typeof last.content === 'string' ? last.content : JSON.stringify(body.messages[0].content);
  const faits = (function () { try { return JSON.parse((txt.match(/FAITS SUR L'ENTREPRISE \(vérifiés\) :\n([\s\S]*?)\n\n/) || [])[1] || '{}'); } catch (e) { return {}; } })();
  const correction = typeof last.content !== 'string' && last.content.some(function (b) { return b.type === 'tool_result'; });
  const modif = /DEMANDE DU CLIENT/.test(txt);
  const f = ficheSite(faits, !correction && !modif && atelierEssais === 1);
  if (modif) { f.accroches = ['Votre clim posée et entretenue', 'Climatisation au Lamentin', 'Le frais chez vous']; f.faits_client = { horaires: ['Lundi au vendredi : 7 h 30 à 17 h'] }; if (/turquoise/i.test(txt)) f.faits_client.couleur = '#0e9aa7'; if (/autre style|tout changer/i.test(txt)) f.faits_client.nouveau_style = true; if (/mes services|nos services sont/i.test(txt)) f.faits_client.services_donnes = true; }
  return rep([tu('ecrire_site', f)], 'tool_use', { output_tokens: 1400 });
}

function claude(body) {
  appelsClaude++;
  if (body.tool_choice && body.tool_choice.name === 'ecrire_site') return atelier(body);
  const sys = body.system.map(function (b) { return b.text; }).join('\n');
  const qui = (sys.match(/TA FICHE DE POSTE \(([^,]+),/) || [])[1] || '';
  const last = body.messages[body.messages.length - 1];
  const userText = typeof last.content === 'string' ? last.content : last.content.map(function (b) { return b.text || b.content || ''; }).join('\n');
  const toolResult = typeof last.content !== 'string' && last.content.some(function (b) { return b.type === 'tool_result'; });
  if (/veilleuse GitHub/i.test(sys)) return rep([{ type: 'text', text: '{"resume":"Framework d\'agents.","pourquoi_fort":"très actif","a_reprendre":"la mémoire","pour_quel_agent":"tous","attention":"MIT","score":82}' }], 'end_turn');
  if (qui === 'Maximilien') {
    const prop = (userText.match(/VALIDÉ PAR LOUIS[\s\S]*?\[proposition #(\d+)\]/) || [])[1];
    if (prop) return rep([tu('creer_entreprise', { proposition_id: Number(prop), contexte: 'Conformité Web : audit des sites des Antilles.' }), tu('creer_agent', { nom: 'Bastien', poste: 'DG Conformité Web', chef: 'pdg', entreprise: 'conformite', niveau: 'dg', mission: 'Lancer la conformité.', fiche: 'Fiche test', outils: ['rapporter', 'decider'], modele: 'smart', cadence_min: 720 }), tu('terminer', { resume: 'Conformité Web créée, DG recruté.' })]);
    return rep([tu('assigner', { a: 'dg_novalemo', titre: 'Objectif semaine 1', consigne: '60 aperçus publiés et envoyés, une vente.', echeance_jours: 7 }), tu('strategie', { nouvelle_strategie: 'Priorité 1 : Novalemo en Martinique.', raison: 'lancement' }), tu('terminer', { resume: 'Réunion de lancement faite.' })]);
  }
  if (qui === 'Élise') return rep([tu('assigner', { a: 'dircom_novalemo', titre: 'Cibles', consigne: 'Clim et électricité au Lamentin d\'abord.' }), tu('proposer', { type: 'nouvel_agent', titre: 'Recruter un vérificateur d\'emails', justification: 'Moins de rebonds.' }), tu('terminer', { resume: 'Consignes données, 1 proposition.' })]);
  if (qui === 'Chloé') {
    if (!toolResult) return rep([tu('lister_leads', { statut: 'a_contacter', pret: true, limite: 5 })]);
    const r = dernierResultat(last);
    if (!Array.isArray(r)) return rep([tu('terminer', { resume: 'Emails écrits.' })]);
    return rep([tu('rediger_emails', { emails: r.slice(0, 3).map(function (l) {
      const lien = /^https?:/.test(String(l.apercu || '')) ? l.apercu : null;
      return { lead_id: l.id, objet: 'Le site de ' + l.nom, angle: lien ? 'apercu' : 'conformite', corps: 'Bonjour,\n\nEn cherchant les entreprises de ' + (l.metier || l.secteur || 'votre métier') + ' en Martinique, j\'ai vu que ' + l.nom + ' n\'a pas encore de site qui la présente vraiment.\n\n' + (lien ? 'J\'ai préparé un aperçu de ce que pourrait être le vôtre : ' + lien + '\n\n' : 'Je peux vous préparer un aperçu gratuit de votre futur site.\n\n') + 'Tout est inclus : la création, la mise en ligne sur votre nom de domaine et l\'hébergement la première année. Le site vous appartient, sans abonnement obligatoire.\n\nJe le mets en ligne pour vous ?\n\nLouis\nNovalemo, sites internet en Martinique' };
    }) }), tu('terminer', { resume: Math.min(3, r.length) + ' emails.' })]);
  }
  if (qui === 'Emma') {
    if (!toolResult) return rep([tu('lister_reponses', {})]);
    const res = dernierResultat(last);
    if (res && res.erreur && /REFUS/.test(res.erreur)) return rep([tu('classer_reponse', { reponse_id: EMMA.dernier, intention: 'interesse', note: 'Veut être rappelé, on reste par email.' }), tu('repondre', { reponse_id: EMMA.dernier, corps: 'Bonjour Monsieur Dupont,\n\nMerci pour votre retour. Pour aller plus vite, tout se règle ici par email : je réponds à toutes vos questions. La formule Vitrine est à 990 € en une fois, sans abonnement. Voulez-vous que je vous prépare la commande ?\n\nLouis\nNovalemo, sites internet en Martinique' }), tu('terminer', { resume: 'Réponse réécrite après le contrôle.' })]);
    if (res && res.lien_paiement) return rep([tu('repondre', { reponse_id: Number((userText.match(/"reponse_id":(\d+)/) || [])[1]) || EMMA.dernier, corps: 'Bonjour,\n\nParfait, c\'est noté pour la formule Vitrine. En une fois (990 €) : ' + res.lien_paiement + (res.lien_mensuel ? '\nOu au mois (89 € par mois, engagement 12 mois) : ' + res.lien_mensuel : '') + '\n\nLe site sera mis en ligne sur ' + (res.domaine || 'votre nom de domaine') + ' dès le paiement, en général dans l\'heure, et vous recevrez la facture par email.\n\nLouis\nNovalemo, sites internet en Martinique' }), tu('terminer', { resume: 'Commande envoyée.' })]);
    if (typeof res === 'string' && /site modifié/.test(res)) return rep([tu('repondre', { reponse_id: EMMA.dernier, corps: 'Bonjour,\n\nC\'est fait : vos horaires sont ajoutés et la couleur a changé. Vous verrez la nouvelle version sur le même lien d\'ici une demi-heure. Elle vous plaît ainsi ?\n\nLouis\nNovalemo, sites internet en Martinique' }), tu('terminer', { resume: 'Retouche faite.' })]);
    if (!Array.isArray(res) || !res.length) return rep([tu('terminer', { resume: 'Aucune réponse.' })]);
    const r = res[0];
    EMMA.dernier = r.id;
    const msg = r.leur_message || '';
    const lid = r.entreprise && r.entreprise.lead_id;
    if (/je prends|on y va|ok pour/i.test(msg)) return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'interesse', note: 'Prend la Vitrine.' }), tu('commande', { reponse_id: r.id, formule: 'vitrine', domaine: (msg.match(/[a-z0-9-]+\.(com|fr)/i) || [])[0] })]);
    if (/changer|ajouter|couleur|horaires/i.test(msg)) return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'question', note: 'Veut des retouches.' }), tu('modifier_site', { reponse_id: r.id, images: /logo/i.test(msg) ? 'logo' : 'aucune', demande: 'Ajouter les horaires (lundi au vendredi, 7 h 30 à 17 h) et passer sur une couleur turquoise.' })]);
    if (/appel|appeler|téléphone/i.test(msg) && EMMA.tentatives++ === 0) return rep([tu('repondre', { reponse_id: r.id, corps: 'Bonjour Monsieur Dupont,\nAvec plaisir. Je vous appelle demain en fin de matinée ou jeudi après-midi ?\nLouis\n+590 691 25 34 49' })]);
    return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'interesse', note: 'Demande le prix.' }), tu('repondre', { reponse_id: r.id, corps: 'Bonjour Monsieur Dupont,\n\nMerci pour votre retour. La formule Vitrine est à 990 € en une fois, sans abonnement : le site de plusieurs pages, sa mise en ligne et l\'hébergement la première année. Tout se règle ici par email pour aller plus vite. Je vous prépare la commande ?\n\nLouis\nNovalemo, sites internet en Martinique' }), tu('terminer', { resume: 'Réponse envoyée à ' + r.de })]);
  }
  if (qui === 'Alan' || qui === 'Malik' || qui === 'Lucie' || qui === 'Adam') return rep([tu('livrer', { type: qui === 'Malik' ? 'idee' : qui === 'Adam' ? 'niche' : 'veille', titre: 'Livrable de ' + qui, contenu: 'Contenu.', score: 70 }), tu('terminer', { resume: 'Un livrable.' })], 'tool_use', { server_tool_use: { web_search_requests: 2 } });
  if (qui === 'Clara') return rep([tu('livrer', { type: 'script', titre: 'Comment marche une serrure', contenu: 'Script.' }), tu('terminer', { resume: 'Un script.' })]);
  return rep([tu('apprendre', { lecon: 'Leçon de ' + qui, poids: 5 }), tu('terminer', { resume: 'Passage de ' + qui })]);
}
const EMMA = { dernier: null, tentatives: 0 };

/* ── une fausse image JPEG (en-tête SOF0 lisible : 1200 x 800) ── */
function jpeg(l, h, graine) {
  const b = Buffer.alloc(2400, graine || 7);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xc0; b.writeUInt16BE(17, 4); b[6] = 8; b.writeUInt16BE(h, 7); b.writeUInt16BE(l, 9);
  return b;
}

/* ── faux Vercel ── */
const VERCEL = { projets: { prj_tour: { id: 'prj_tour', name: 'btprecruit-crm', ssoProtection: { deploymentType: 'all_except_custom_domains' } } }, env: {}, envEchec: new Set(), redemarrages: [], fichiers: new Set(), deploiements: [], domaines: {}, commandes: {}, achats: [], autoRenew: {}, autoRenewEchecs: 0, echecs: new Set(), ailleurs: new Set(), auCompte: new Set(), pris: new Set(), manquantUneFois: true };
function vercel(url, opts) {
  const u = new URL(url), m = (opts && opts.method) || 'GET', p = u.pathname;
  const j = function (code, obj) { return { ok: code < 300, status: code, text: async function () { return JSON.stringify(obj); }, json: async function () { return obj; } }; };
  let corps = null; try { corps = opts && opts.body && !Buffer.isBuffer(opts.body) ? JSON.parse(opts.body) : null; } catch (e) { corps = null; }
  if (p === '/v2/teams') return j(200, { teams: [{ id: 'team_test', slug: 'louis' }] });
  let r;
  if ((r = p.match(/^\/v9\/projects\/([^/]+)$/)) && m === 'GET') { const pr = Object.values(VERCEL.projets).find(function (x) { return x.id === r[1] || x.name === decodeURIComponent(r[1]); }); return pr ? j(200, pr) : j(404, { error: { code: 'not_found', message: 'Project not found' } }); }
  if (p === '/v11/projects' && m === 'POST') { const pr = { id: 'prj_sites', name: corps.name, ssoProtection: corps.ssoProtection }; VERCEL.projets[pr.id] = pr; return j(200, pr); }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)$/)) && m === 'PATCH') { const pr = VERCEL.projets[r[1]]; Object.assign(pr, corps); return j(200, pr); }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/domains$/))) return j(200, { domains: [{ name: 'novalemo-martinique.vercel.app' }].concat(Object.keys(VERCEL.domaines).map(function (d) { return { name: d }; })) });
  if (p === '/v2/files' && m === 'POST') { VERCEL.fichiers.add(opts.headers['x-vercel-digest']); return j(200, {}); }
  if (p === '/v13/deployments' && m === 'POST' && corps && corps.deploymentId) { VERCEL.redemarrages.push(corps); return j(200, { id: 'dpl_redemarrage_' + VERCEL.redemarrages.length, url: 'tour.vercel.app' }); }
  if ((r = p.match(/^\/v10\/projects\/([^/]+)\/env$/)) && m === 'POST') {
    if (!/upsert=true/.test(u.search)) return j(400, { error: { message: 'exists' } });
    const lot = Array.isArray(corps) ? corps : [corps], crees = [], rates = [];
    lot.forEach(function (c) { if (VERCEL.envEchec.has(c.key)) { rates.push({ error: { key: c.key, message: 'refusé' } }); return; } VERCEL.env[c.key] = { type: c.type, target: c.target, projet: r[1], longueur: String(c.value || '').length }; crees.push({ key: c.key }); });
    VERCEL.ecrituresEnv = (VERCEL.ecrituresEnv || 0) + 1;
    crees.forEach(function (c) { VERCEL.env[c.key].id = 'env_' + c.key; });
    return j(200, Array.isArray(corps) ? { created: crees, failed: rates } : { created: crees[0] });
  }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/env$/)) && m === 'GET') return j(200, { envs: Object.keys(VERCEL.env).map(function (k) { return { id: VERCEL.env[k].id || 'env_' + k, key: k, target: VERCEL.env[k].target, type: VERCEL.env[k].type }; }) });
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/env\/([^/]+)$/)) && m === 'DELETE') { const k = Object.keys(VERCEL.env).find(function (x) { return (VERCEL.env[x].id || 'env_' + x) === decodeURIComponent(r[2]); }); if (k) delete VERCEL.env[k]; return j(200, {}); }
  if (p === '/v6/deployments' && m === 'GET') return j(200, { deployments: [{ uid: 'dpl_tour_prod', name: 'btprecruit-crm', state: 'READY' }] });
  if (p === '/v2/user') return j(200, { user: { id: 'u1' } });
  if (p === '/v13/deployments' && m === 'POST') {
    const manquants = corps.files.filter(function (f) { return f.sha && !VERCEL.fichiers.has(f.sha); }).map(function (f) { return f.sha; });
    if (manquants.length) return j(400, { error: { code: 'missing_files', message: 'Missing files', missing: manquants } });
    const d = { id: 'dpl_' + (VERCEL.deploiements.length + 1), url: 'novalemo-martinique-' + (VERCEL.deploiements.length + 1) + '.vercel.app', readyState: 'READY', files: corps.files };
    VERCEL.deploiements.push(d); return j(200, d);
  }
  if ((r = p.match(/^\/v13\/deployments\/([^/]+)$/))) { const d = VERCEL.deploiements.find(function (x) { return x.id === r[1]; }); return j(200, { readyState: d ? d.readyState : 'ERROR', url: d && d.url, alias: [] }); }
  if ((r = p.match(/^\/v10\/projects\/([^/]+)\/domains$/)) && m === 'POST') {
    if (VERCEL.ailleurs.has(corps.name)) return j(409, { error: { code: 'domain_already_in_use', message: 'Domain is already in use by another project' } });
    if (VERCEL.domaines[corps.name]) return j(400, { error: { code: 'domain_already_in_use', message: 'Domain already exists on this project' } });
    VERCEL.domaines[corps.name] = corps; return j(200, { name: corps.name, verified: true });
  }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/domains\/([^/]+)$/)) && m === 'GET') { const d = decodeURIComponent(r[2]); return VERCEL.domaines[d] ? j(200, { name: d, apexName: d.replace(/^www\./, ''), projectId: r[1], verified: true }) : j(404, { error: { code: 'not_found', message: 'Domain not found' } }); }
  if ((r = p.match(/^\/v5\/domains\/([^/]+)$/)) && m === 'GET') { const d = decodeURIComponent(r[1]); const ok = VERCEL.auCompte.has(d) || Object.values(VERCEL.commandes).some(function (c) { return c.status === 'completed' && c.domains[0].domainName === d; }); return ok ? j(200, { domain: { name: d, boughtAt: Date.now(), serviceType: 'zeit.world', renew: true } }) : j(404, { error: { code: 'not_found', message: 'Domain not found' } }); }
  if ((r = p.match(/^\/v6\/domains\/([^/]+)\/config$/))) return j(200, { misconfigured: !VERCEL.domaines[decodeURIComponent(r[1])] });
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/availability$/))) { const d = decodeURIComponent(r[1]); return j(200, { available: !/^clim-eole-martinique\.com$/.test(d) && !/pris/.test(d) && !VERCEL.pris.has(d) && !VERCEL.auCompte.has(d) }); }
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/price$/))) { const d = decodeURIComponent(r[1]); if (/\.fr$/.test(d)) return j(400, { error: { code: 'tld_not_supported' } }); return j(200, { years: 1, purchasePrice: 12.03, renewalPrice: 12.03, transferPrice: 12.03 }); }
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/buy$/)) && m === 'POST') { const d = decodeURIComponent(r[1]); VERCEL.achats.push({ domaine: d, corps: corps }); const id = 'ord_' + VERCEL.achats.length; VERCEL.commandes[id] = { orderId: id, status: VERCEL.echecs.has(d) ? 'failed' : 'completed', domains: [{ domainName: d }] }; return j(200, { orderId: id, _links: {} }); }
  if ((r = p.match(/^\/v1\/registrar\/orders\/([^/]+)$/))) return j(200, VERCEL.commandes[r[1]] || { status: 'failed' });
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/auto-renew$/)) && m === 'PATCH') { if (VERCEL.autoRenewEchecs > 0) { VERCEL.autoRenewEchecs--; return j(500, { error: { code: 'internal', message: 'Temporary error' } }); } VERCEL.autoRenew[decodeURIComponent(r[1])] = !!corps.autoRenew; return j(200, {}); }
  return j(404, { error: { code: 'not_found', message: 'inconnu ' + m + ' ' + p } });
}

/* ── faux Stripe ── */
const STRIPE = { prix: [], liens: [], payes: {}, desactives: [], rembourses: [], abonnements: {}, factures: [], annules: [], pieds: {}, appels: 0, parLien: 0, globales: 0, listeEnPanne: false, annulerEchecs: 0, rembourserEchecs: 0, facturesAnnulees: [] };
function stripe(url, opts) {
  const u = new URL(url), m = (opts && opts.method) || 'GET', p = u.pathname;
  const j = function (code, obj) { return { ok: code < 300, status: code, json: async function () { return obj; } }; };
  const params = new URLSearchParams(m === 'GET' ? u.search : (opts.body || ''));
  let r;
  if (p === '/v1/prices' && m === 'POST') { const x = { id: 'price_' + (STRIPE.prix.length + 1), unit_amount: Number(params.get('unit_amount')), recurring: params.get('recurring[interval]') || null }; STRIPE.prix.push(x); return j(200, x); }
  if (p === '/v1/payment_links' && m === 'POST') {
    const pr = STRIPE.prix.find(function (y) { return y.id === params.get('line_items[0][price]'); }) || {};
    if (pr.recurring && (params.get('invoice_creation[enabled]') || params.get('customer_creation'))) return j(400, { error: { message: 'invoice_creation et customer_creation : paiement unique seulement' } });
    if (!pr.recurring && params.get('subscription_data[description]')) return j(400, { error: { message: 'subscription_data exige un prix récurrent' } });
    const x = { id: 'plink_' + (STRIPE.liens.length + 1), url: 'https://buy.stripe.com/test_' + (STRIPE.liens.length + 1), params: Object.fromEntries(params), mensuel: !!pr.recurring, montant: pr.unit_amount };
    STRIPE.liens.push(x); return j(200, x);
  }
  if (p === '/v1/subscriptions' && m === 'GET') { const tous = Object.values(STRIPE.abonnements); return j(200, { data: tous, has_more: false }); }
  if ((r = p.match(/^\/v1\/subscriptions\/([^/]+)$/)) && m === 'GET') { const a = STRIPE.abonnements[r[1]]; return a ? j(200, a) : j(404, { error: { code: 'resource_missing', message: 'No such subscription' } }); }
  if ((r = p.match(/^\/v1\/subscriptions\/([^/]+)$/)) && m === 'POST') { const a = STRIPE.abonnements[r[1]]; if (!a) return j(404, { error: { message: 'no such subscription' } }); if (params.get('cancel_at_period_end') === 'true') a.cancel_at_period_end = true; if (params.get('cancel_at')) { a.cancel_at = Number(params.get('cancel_at')); a.proration_behavior = params.get('proration_behavior'); } return j(200, a); }
  if ((r = p.match(/^\/v1\/subscriptions\/([^/]+)$/)) && m === 'DELETE') { const a = STRIPE.abonnements[r[1]]; if (!a) return j(404, { error: { message: 'no such subscription' } }); if (STRIPE.annulerEchecs > 0) { STRIPE.annulerEchecs--; return j(500, { error: { message: 'temporary error' } }); } a.status = 'canceled'; a.canceled_at = Math.floor(Date.now() / 1000); a.cancellation_details = { reason: 'cancellation_requested' }; STRIPE.annules.push(a.id); return j(200, a); }
  if ((r = p.match(/^\/v1\/customers\/([^/]+)$/)) && m === 'POST') { STRIPE.pieds[r[1]] = params.get('invoice_settings[footer]'); return j(200, { id: r[1] }); }
  if (p === '/v1/invoices' && m === 'GET') { const gte = Number(params.get('created[gte]') || 0), st = params.get('status'), sub = params.get('subscription'); return j(200, { data: STRIPE.factures.filter(function (f) { return (!st || f.status === st) && f.created >= gte && (!sub || f.subscription === sub); }).map(function (f) { return Object.assign({ status_transitions: { paid_at: f.status === 'paid' ? (f.paye_le || f.created) : null }, payment_intent: 'pi_' + f.id }, f); }), has_more: false }); }
  if ((r = p.match(/^\/v1\/invoices\/([^/]+)\/void$/)) && m === 'POST') { const f = STRIPE.factures.find(function (y) { return y.id === r[1]; }); if (!f || f.status !== 'open') return j(400, { error: { message: 'You can only void an open invoice' } }); f.status = 'void'; STRIPE.facturesAnnulees.push(f.id); return j(200, f); }
  if ((r = p.match(/^\/v1\/payment_links\/([^/]+)$/)) && m === 'POST') { STRIPE.desactives.push(r[1]); return j(200, { id: r[1], active: false }); }
  if (p === '/v1/account' && m === 'GET') { const k = (opts.headers && opts.headers.Authorization) || ''; return j(200, { id: /autre_compte/.test(k) ? 'acct_2' : 'acct_1', charges_enabled: !/inactif/.test(k), details_submitted: true }); }
  if (p === '/v1/refunds' && m === 'POST') { if (STRIPE.rembourserEchecs > 0) { STRIPE.rembourserEchecs--; return j(500, { error: { message: 'temporary error' } }); } STRIPE.rembourses.push(params.get('payment_intent') || params.get('charge')); return j(200, { id: 're_' + STRIPE.rembourses.length, status: 'succeeded' }); }
  if (p === '/v1/checkout/sessions') {
    STRIPE.appels++;
    const l = params.get('payment_link');
    if (l) { STRIPE.parLien++; const s = STRIPE.payes[l]; return j(200, { data: s ? [s] : [], has_more: false }); }
    if (STRIPE.listeEnPanne) return j(500, { error: { message: 'Stripe indisponible' } });
    STRIPE.globales++;
    const gte = Number(params.get('created[gte]') || 0);
    const tous = Object.values(STRIPE.payes).filter(function (x) { return (x.created || 0) >= gte; }).sort(function (a, b) { return b.created - a.created; });
    const apres = params.get('starting_after'), lim = Number(params.get('limit') || 10);
    const debut = apres ? tous.findIndex(function (x) { return x.id === apres; }) + 1 : 0;
    const page = tous.slice(debut, debut + lim);
    return j(200, { data: page, has_more: debut + lim < tous.length });
  }
  if ((r = p.match(/^\/v1\/invoices\/([^/]+)$/))) { const f = STRIPE.factures.find(function (y) { return y.id === r[1]; }); return j(200, { id: r[1], number: 'NOVA-0001', hosted_invoice_url: 'https://invoice.stripe.com/i/test_' + r[1], invoice_pdf: 'https://pay.stripe.com/pdf/' + r[1], status: f ? f.status : 'paid', payment_intent: f ? 'pi_' + r[1] : null }); }
  return j(404, { error: { message: 'inconnu ' + p } });
}
// un paiement abouti sur ce lien : la session porte le lien et ses métadonnées (comme chez Stripe)
function payer(lien, extra) {
  const lk = STRIPE.liens.find(function (x) { return x.id === lien; });
  const meta = lk ? { site_id: lk.params['metadata[site_id]'], origine: lk.params['metadata[origine]'] } : {};
  const base = { id: 'cs_' + lien, livemode: true, payment_link: lien, metadata: meta, payment_intent: 'pi_' + lien, payment_status: 'paid', status: 'complete', mode: 'payment', amount_total: 99000, customer: 'cus_' + lien, customer_details: { email: 'jean@climeole.fr', name: 'Jean Dupont', address: { city: 'Le Lamentin', country: 'MQ' } }, invoice: 'in_1', custom_fields: [], created: Math.floor(Date.now() / 1000) };
  if (lk && lk.mensuel) {
    // abonnement : la session crée l'abonnement et sa première facture, payée ; pas d'intention sur la session
    const sub = 'sub_' + lien, inv = 'in_' + sub + '_1';
    Object.assign(base, { mode: 'subscription', subscription: sub, payment_intent: null, invoice: inv, amount_total: lk.montant });
    STRIPE.abonnements[sub] = { id: sub, status: 'active', customer: 'cus_' + lien, latest_invoice: inv, cancel_at_period_end: false, cancel_at: null, billing_cycle_anchor: base.created, start_date: base.created, current_period_end: Math.floor((Date.now() + 30 * 86400000) / 1000), metadata: meta, created: base.created };
    STRIPE.factures.push({ id: inv, subscription: sub, status: 'paid', amount_paid: lk.montant, billing_reason: 'subscription_create', created: base.created, number: 'NOVA-S1', hosted_invoice_url: 'https://invoice.stripe.com/i/' + inv });
  }
  STRIPE.payes[lien] = Object.assign(base, extra || {});
}
// un mois de plus sur un abonnement : facture payée (ou refusée)
function mois(sub, ok) {
  const a = STRIPE.abonnements[sub];
  const n = STRIPE.factures.filter(function (f) { return f.subscription === sub; }).length + 1;
  const inv = 'in_' + sub + '_' + n;
  STRIPE.factures.push({ id: inv, subscription: sub, status: ok === false ? 'open' : 'paid', amount_paid: ok === false ? 0 : (STRIPE.factures.find(function (f) { return f.subscription === sub; }) || {}).amount_paid, billing_reason: 'subscription_cycle', created: Math.floor(Date.now() / 1000), number: 'NOVA-S' + n, hosted_invoice_url: 'https://invoice.stripe.com/i/' + inv });
  a.latest_invoice = inv; a.status = ok === false ? 'past_due' : 'active'; a.current_period_end = Math.floor((Date.now() + 30 * 86400000) / 1000);
  return inv;
}

const PAGE = '<html><head><title>Clim Pro 972</title><meta name="viewport" content="width=device-width"><meta property="og:image" content="/images/atelier.jpg"></head><body>Climatisation au Lamentin : installation, entretien, dépannage. Contact : contact@climpro972.fr <img src="/images/logo.png" alt="logo Clim Pro" class="logo"><img src="/images/chantier1.jpg" alt="Pose d\'une clim"><img src="/images/chantier2.jpg" alt="Entretien"><a href="/contact">Contact</a> © 2018 <style>.b{color:#e30613}.c{color:#e30613}.d{color:#e30613}</style></body></html>';
/* ── faux Kapso (WhatsApp) ── */
const KAPSO = { recus: [], envoyes: [], fenetreFermee: new Set() };
function kapso(url, opts) {
  const u = new URL(url), m = (opts && opts.method) || 'GET';
  const j = function (code, obj) { return { ok: code < 300, status: code, json: async function () { return obj; } }; };
  if (!opts || !opts.headers || !opts.headers['X-API-Key']) return j(401, { error: { message: 'missing key' } });
  if (/^\/storage\/media\//.test(u.pathname)) { const b = jpeg(900, 700, 11); return { ok: true, status: 200, headers: { get: function (h) { return /content-type/i.test(h) ? 'image/jpeg' : null; } }, arrayBuffer: async function () { return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } }; }
  if (/\/messages$/.test(u.pathname) && m === 'GET') {
    const depuis = u.searchParams.get('since');
    return j(200, { data: KAPSO.recus.filter(function (x) { return !depuis || new Date(Number(x.timestamp) * 1000).toISOString() >= depuis; }), paging: { cursors: {} } });
  }
  if (/\/messages$/.test(u.pathname) && m === 'POST') {
    const c = JSON.parse(opts.body);
    if (KAPSO.fenetreFermee.has(c.to || c.recipient)) return j(422, { error: { message: 'Re-engagement message', code: 131047 } });
    if (!c.to && !c.recipient) return j(400, { error: { message: 'to or recipient required' } });
    KAPSO.envoyes.push(c); return j(200, { messaging_product: 'whatsapp', contacts: [{ wa_id: c.to || null, user_id: c.recipient || null }], messages: [{ id: 'wamid.' + KAPSO.envoyes.length }] });
  }
  return j(404, { error: { message: 'inconnu' } });
}
function recuWhatsApp(de, texte, nom, ilYaMin, extra) { const t = Math.floor((Date.now() - (ilYaMin || 0) * 60000) / 1000); const m = { id: 'wamid.in' + (KAPSO.recus.length + 1), from: de ? String(de).replace(/[^\d]/g, '') : undefined, timestamp: String(t), type: 'text', text: { body: texte }, kapso: { direction: 'inbound', contact_name: nom || null } }; KAPSO.recus.push(Object.assign(m, extra || {})); return m; }

/* ── faux Pexels (photos d'illustration) et fausse banque Picsum ── */
const PEXELS = { recherches: [], refus: false };
function pexels(url, opts) {
  const u = new URL(url);
  if (!opts || !opts.headers || !opts.headers.Authorization) return { ok: false, status: 401, json: async function () { return { error: 'unauthorized' }; } };
  if (PEXELS.refus || opts.headers.Authorization === 'mauvaise') return { ok: false, status: 401, json: async function () { return {}; } };
  const q = u.searchParams.get('query') || '';
  PEXELS.recherches.push(q);
  const base = Array.from(q).reduce(function (t, c) { return (t * 31 + c.charCodeAt(0)) % 90000; }, 7) + 10000;
  const photos = [0, 1, 2, 3, 4, 5].map(function (k) { const id = base * 10 + k; return { id: id, width: 6000, height: 4000, url: 'https://www.pexels.com/photo/' + id + '/', photographer: 'Photographe ' + k, photographer_url: 'https://www.pexels.com/@p' + k, alt: k === 0 ? 'Smiling man fixing an air conditioner' : 'Close up of ' + q, src: { original: 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg' } }; });
  return { ok: true, status: 200, json: async function () { return { photos: photos, total_results: 6 }; } };
}
function imageFausse(url, l, h) { const b = jpeg(l, h, Array.from(url).reduce(function (t, c) { return (t * 31 + c.charCodeAt(0)) % 251; }, 7)); return { ok: true, status: 200, url: url, headers: { get: function (x) { return /content-type/i.test(x) ? 'image/jpeg' : /content-length/i.test(x) ? String(b.length) : null; } }, arrayBuffer: async function () { return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } }; }

global.fetch = async function (url, opts) {
  url = String(url);
  if (url.indexOf('api.pexels.com') >= 0) return pexels(url, opts);
  if (url.indexOf('images.pexels.com') >= 0) return imageFausse(url, 1920, 1280);
  if (url.indexOf('picsum.photos') >= 0) return imageFausse(url, 1920, 1280);
  if (url.indexOf('api.kapso.ai') >= 0) return kapso(url, opts);
  if (url.indexOf('api.anthropic.com') >= 0) return claude(JSON.parse(opts.body));
  if (url.indexOf('api.vercel.com') >= 0) return vercel(url, opts);
  if (url.indexOf('api.stripe.com') >= 0) return stripe(url, opts);
  if (url.indexOf('places.googleapis.com') >= 0) {
    return { ok: true, status: 200, json: async function () { return { places: [
      { id: 'p1', displayName: { text: 'Clim Pro 972' }, formattedAddress: 'Zone de la Lézarde, 97232 Le Lamentin, Martinique', internationalPhoneNumber: '+596 696 11 22 33', websiteUri: 'https://climpro972.fr', rating: 4.6, userRatingCount: 30, businessStatus: 'OPERATIONAL', regularOpeningHours: { weekdayDescriptions: ['lundi: 07:30 – 17:00', 'mardi: 07:30 – 17:00'] } },
      { id: 'p2', displayName: { text: 'Froid Services' }, formattedAddress: 'Rue des Arts, 97200 Fort-de-France, Martinique', internationalPhoneNumber: '+596 696 44 55 66', websiteUri: 'https://www.facebook.com/froid', businessStatus: 'OPERATIONAL' },
      { id: 'p3', displayName: { text: 'Carrefour Génipa' }, formattedAddress: '97224 Ducos, Martinique', internationalPhoneNumber: '+596 596 00 00 00', businessStatus: 'OPERATIONAL' },
      { id: 'p4', displayName: { text: 'Plomberie Durand' }, formattedAddress: '97231 Le Robert, Martinique', internationalPhoneNumber: '+596 696 77 88 99', businessStatus: 'OPERATIONAL' },
      { id: 'p5', displayName: { text: 'Clim Gwada' }, formattedAddress: '12 rue X, 97122 Baie-Mahault, Guadeloupe', internationalPhoneNumber: '+590 690 11 22 33', websiteUri: 'https://climgwada.fr', businessStatus: 'OPERATIONAL' }
    ] }; } };
  }
  if (url.indexOf('api.github.com/search') >= 0) return { ok: true, status: 200, json: async function () { return { items: [{ full_name: 'org/agents', html_url: 'https://github.com/org/agents', stargazers_count: 42000, language: 'Python', license: { spdx_id: 'MIT' }, pushed_at: '2026-10-30', description: 'Agents', topics: ['ai-agents'], default_branch: 'main' }] }; } };
  if (url.indexOf('raw.githubusercontent.com') >= 0) return { ok: true, status: 200, text: async function () { return '# Agents\nUn framework.'; } };
  if (url.indexOf('afnic.fr') >= 0) return { ok: true, status: 200, text: async function () { return 'climpro-martinique.fr\nplomberie-gwada.fr\ncasino-777.fr\nboulangerie-paris15.fr\n'; } };
  if (url.indexOf('recherche-entreprises.api.gouv.fr') >= 0) {
    const q = decodeURIComponent((url.match(/q=([^&]+)/) || [])[1] || '');
    const total = url.indexOf('departement=') < 0;
    if (total) return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { total_results: 1, results: [] }; } };
    if (/clim\s*pro/.test(q) && /972/.test(url)) return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [{ siren: '123456789', nom_raison_sociale: 'CLIMPRO MARTINIQUE', nom_complet: 'CLIMPRO MARTINIQUE', nature_juridique: '5710', categorie_entreprise: 'PME', date_creation: '2026-06-01', activite_principale: '43.22B', etat_administratif: 'A', siege: { departement: '972', code_postal: '97232', libelle_commune: 'LE LAMENTIN', siret: '12345678900011', adresse: 'ZONE DE LA LEZARDE 97232 LE LAMENTIN' }, dirigeants: [{ type_dirigeant: 'personne physique', nom: 'DUPONT', prenoms: 'Jean', qualite: 'Président' }] }] }; } };
    return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [] }; } };
  }
  if (url.indexOf('bodacc') >= 0) {
    const zone972 = /972/.test(decodeURIComponent(url));
    return { ok: true, status: 200, json: async function () { return { results: [{ id: 'b1', commercant: 'SOLAIRE MADININA', ville: 'Le Robert', numerodepartement: '972', dateparution: '2026-10-30', registre: ['987 654 321', '987654321'], listeetablissements: JSON.stringify({ etablissement: { activite: 'Installation de panneaux solaires' } }) }, { id: 'b2', commercant: 'SCI DES PALMIERS', ville: 'Le Diamant', numerodepartement: '972', dateparution: '2026-10-29', registre: ['111 222 333'], listeetablissements: JSON.stringify({ etablissement: { activite: 'Location de logements' } }) }].concat(zone972 ? [] : [{ id: 'b3', commercant: 'SOLAIRE KARUKERA', ville: 'Petit-Bourg', numerodepartement: '971', dateparution: '2026-10-30', registre: ['555 666 777'] }]) }; } };
  }
  // images des sites des prospects
  if (/\.(jpg|png)(\?|$)/.test(url)) {
    const logo = /logo/.test(url);
    const b = logo ? (function () { const x = Buffer.alloc(900, 3); x.writeUInt32BE(0x89504e47, 0); x.writeUInt32BE(240, 16); x.writeUInt32BE(120, 20); return x; })() : jpeg(1200, 800, Array.from(url).reduce(function (t, c) { return (t * 31 + c.charCodeAt(0)) % 251; }, 7));
    return { ok: true, status: 200, url: url, headers: { get: function (h) { return /content-type/i.test(h) ? (logo ? 'image/png' : 'image/jpeg') : /content-length/i.test(h) ? String(b.length) : null; } }, arrayBuffer: async function () { return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } };
  }
  // un site client en ligne (vérification de mise en ligne)
  if (/^https:\/\/(www\.)?[a-z0-9-]+\.com\/$/.test(url) && FAUX_EN_LIGNE.has(new URL(url).hostname)) return { ok: true, status: 200, url: url, text: async function () { return '<html>' + 'x'.repeat(3000) + '</html>'; } };
  // sites web
  const html = /climpro|ifc-guadeloupe|love-dogs/.test(url) ? PAGE.replace('Clim Pro 972', 'Site Studio Novalem') + ' Site réalisé par Studio Novalem' : '<html><body>Bienvenue</body></html>';
  return { ok: true, status: 200, url: url, headers: { get: function (h) { return /content-type/i.test(h) ? 'text/html; charset=utf-8' : null; } }, body: null, text: async function () { return html; } };
};
const FAUX_EN_LIGNE = new Set();

module.exports = { appels: function () { return appelsClaude; }, PEXELS: PEXELS, VERCEL: VERCEL, STRIPE: STRIPE, KAPSO: KAPSO, recuWhatsApp: recuWhatsApp, payer: payer, mois: mois, FAUX_EN_LIGNE: FAUX_EN_LIGNE, EMMA: EMMA, jpeg: jpeg };
