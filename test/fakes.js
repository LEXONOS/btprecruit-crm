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
    nom: nom, activite: 'Climatisation et froid', accroche: 'Le frais chez vous, posé et **entretenu** comme il faut',
    chapo: 'Installation, entretien et dépannage de climatisation pour les maisons, les bureaux et les commerces du centre de la Martinique.',
    objectif: 'devis', cta: 'Demander un devis', titre_services: 'Ce que nous **faisons**', intro_services: 'Du choix de l\'appareil au nettoyage régulier, un seul interlocuteur.',
    services: [
      { titre: 'Installation', texte: 'Split mural, gainable ou cassette : on vous conseille l\'appareil adapté et on le pose proprement.', detail: 'Avant la pose, on regarde la pièce, l\'exposition et l\'usage.', icone: 'flocon' },
      { titre: 'Entretien', texte: 'Filtres, batterie, évacuation : un appareil propre consomme moins et souffle un air plus sain.', detail: 'Nettoyage complet de l\'unité intérieure et extérieure.', icone: 'etincelles' },
      { titre: 'Dépannage', texte: 'Panne, fuite, bruit ou mauvaise odeur : on cherche la cause et on vous explique avant de réparer.', detail: 'Diagnostic clair puis réparation.', icone: 'cle' }
    ],
    titre_atouts: 'Pourquoi nous **appeler**', atouts: [{ titre: 'Un conseil honnête', texte: 'On vous dit si l\'appareil vaut la peine d\'être réparé.' }, { titre: 'Un travail propre', texte: 'La pose est soignée et le chantier laissé net.' }, { titre: 'Basés au Lamentin', texte: 'Au centre de l\'île.' }],
    titre_etapes: 'Comment ça **se passe**', etapes: [{ titre: 'Vous nous écrivez', texte: 'Décrivez votre besoin.' }, { titre: 'On regarde', texte: 'On vous pose les bonnes questions.' }, { titre: 'On intervient', texte: 'Au créneau convenu.' }],
    titre_faq: 'Vos **questions**', faq: [{ q: 'Quelle puissance pour ma pièce ?', r: 'Elle dépend de la surface et de l\'exposition : écrivez-nous.' }, { q: 'Faut-il entretenir sa clim ?', r: 'Oui, avec l\'air salin un entretien régulier évite les pannes.' }, { q: 'Travaillez-vous pour les pros ?', r: 'Oui, bureaux et commerces.' }],
    titre_appel: 'Trop chaud ? **Parlons-en.**', titre_contact: 'Écrivez-nous, on vous **répond**',
    a_propos: mauvaise ? 'Fondée depuis 2010, plus de 500 clients satisfaits.' : 'Une entreprise de climatisation du Lamentin.',
    zone: 'Basés au Lamentin, en Martinique', defile: ['Le Lamentin', 'Fort-de-France', 'Ducos', 'Schœlcher'], ambiance: 'ocean', composition: 'affiche',
    seo: { titre: 'Climatisation au Lamentin · ' + nom, description: 'Installation, entretien et dépannage de climatisation au Lamentin.' }
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
  if (modif) { f.accroche = 'Votre clim posée et **entretenue**, au Lamentin'; f.ambiance = 'lagon'; f.faits_client = { horaires: ['Lundi au vendredi : 7 h 30 à 17 h'] }; }
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
    if (res && res.lien_paiement) return rep([tu('repondre', { reponse_id: Number((userText.match(/"reponse_id":(\d+)/) || [])[1]) || EMMA.dernier, corps: 'Bonjour,\n\nParfait, c\'est noté pour la formule Vitrine. Voici le lien de paiement sécurisé : ' + res.lien_paiement + '\n\nLe site sera mis en ligne sur ' + (res.domaine || 'votre nom de domaine') + ' dès le paiement, en général dans l\'heure, et vous recevrez la facture par email.\n\nLouis\nNovalemo, sites internet en Martinique' }), tu('terminer', { resume: 'Commande envoyée.' })]);
    if (typeof res === 'string' && /site modifié/.test(res)) return rep([tu('repondre', { reponse_id: EMMA.dernier, corps: 'Bonjour,\n\nC\'est fait : vos horaires sont ajoutés et la couleur a changé. Vous verrez la nouvelle version sur le même lien d\'ici une demi-heure. Elle vous plaît ainsi ?\n\nLouis\nNovalemo, sites internet en Martinique' }), tu('terminer', { resume: 'Retouche faite.' })]);
    if (!Array.isArray(res) || !res.length) return rep([tu('terminer', { resume: 'Aucune réponse.' })]);
    const r = res[0];
    EMMA.dernier = r.id;
    const msg = r.leur_message || '';
    const lid = r.entreprise && r.entreprise.lead_id;
    if (/je prends|on y va|ok pour/i.test(msg)) return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'interesse', note: 'Prend la Vitrine.' }), tu('commande', { reponse_id: r.id, formule: 'vitrine', domaine: (msg.match(/[a-z0-9-]+\.(com|fr)/i) || [])[0] })]);
    if (/changer|ajouter|couleur|horaires/i.test(msg)) return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'question', note: 'Veut des retouches.' }), tu('modifier_site', { reponse_id: r.id, demande: 'Ajouter les horaires (lundi au vendredi, 7 h 30 à 17 h) et passer sur une couleur turquoise.' })]);
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
const VERCEL = { projets: {}, fichiers: new Set(), deploiements: [], domaines: {}, commandes: {}, achats: [], autoRenew: {}, echecs: new Set(), manquantUneFois: true };
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
  if (p === '/v13/deployments' && m === 'POST') {
    const manquants = corps.files.filter(function (f) { return f.sha && !VERCEL.fichiers.has(f.sha); }).map(function (f) { return f.sha; });
    if (manquants.length) return j(400, { error: { code: 'missing_files', message: 'Missing files', missing: manquants } });
    const d = { id: 'dpl_' + (VERCEL.deploiements.length + 1), url: 'novalemo-martinique-' + (VERCEL.deploiements.length + 1) + '.vercel.app', readyState: 'READY', files: corps.files };
    VERCEL.deploiements.push(d); return j(200, d);
  }
  if ((r = p.match(/^\/v13\/deployments\/([^/]+)$/))) { const d = VERCEL.deploiements.find(function (x) { return x.id === r[1]; }); return j(200, { readyState: d ? d.readyState : 'ERROR', url: d && d.url, alias: [] }); }
  if ((r = p.match(/^\/v10\/projects\/([^/]+)\/domains$/)) && m === 'POST') { VERCEL.domaines[corps.name] = corps; return j(200, { name: corps.name, verified: true }); }
  if ((r = p.match(/^\/v6\/domains\/([^/]+)\/config$/))) return j(200, { misconfigured: !VERCEL.domaines[decodeURIComponent(r[1])] });
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/availability$/))) { const d = decodeURIComponent(r[1]); return j(200, { available: !/^clim-eole-martinique\.com$/.test(d) && !/pris/.test(d) }); }
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/price$/))) { const d = decodeURIComponent(r[1]); if (/\.fr$/.test(d)) return j(400, { error: { code: 'tld_not_supported' } }); return j(200, { years: 1, purchasePrice: 12.03, renewalPrice: 12.03, transferPrice: 12.03 }); }
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/buy$/)) && m === 'POST') { const d = decodeURIComponent(r[1]); VERCEL.achats.push({ domaine: d, corps: corps }); const id = 'ord_' + VERCEL.achats.length; VERCEL.commandes[id] = { orderId: id, status: VERCEL.echecs.has(d) ? 'failed' : 'completed', domains: [{ domainName: d }] }; return j(200, { orderId: id, _links: {} }); }
  if ((r = p.match(/^\/v1\/registrar\/orders\/([^/]+)$/))) return j(200, VERCEL.commandes[r[1]] || { status: 'failed' });
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/auto-renew$/)) && m === 'PATCH') { VERCEL.autoRenew[decodeURIComponent(r[1])] = !!corps.autoRenew; return j(200, {}); }
  return j(404, { error: { code: 'not_found', message: 'inconnu ' + m + ' ' + p } });
}

/* ── faux Stripe ── */
const STRIPE = { prix: [], liens: [], payes: {}, desactives: [], rembourses: [] };
function stripe(url, opts) {
  const u = new URL(url), m = (opts && opts.method) || 'GET', p = u.pathname;
  const j = function (code, obj) { return { ok: code < 300, status: code, json: async function () { return obj; } }; };
  const params = new URLSearchParams(m === 'GET' ? u.search : (opts.body || ''));
  if (p === '/v1/prices' && m === 'POST') { const x = { id: 'price_' + (STRIPE.prix.length + 1), unit_amount: Number(params.get('unit_amount')) }; STRIPE.prix.push(x); return j(200, x); }
  if (p === '/v1/payment_links' && m === 'POST') { const x = { id: 'plink_' + (STRIPE.liens.length + 1), url: 'https://buy.stripe.com/test_' + (STRIPE.liens.length + 1), params: Object.fromEntries(params) }; STRIPE.liens.push(x); return j(200, x); }
  let r;
  if ((r = p.match(/^\/v1\/payment_links\/([^/]+)$/)) && m === 'POST') { STRIPE.desactives.push(r[1]); return j(200, { id: r[1], active: false }); }
  if (p === '/v1/refunds' && m === 'POST') { STRIPE.rembourses.push(params.get('payment_intent')); return j(200, { id: 're_' + STRIPE.rembourses.length, status: 'succeeded' }); }
  if (p === '/v1/checkout/sessions') { const l = params.get('payment_link'); const s = STRIPE.payes[l]; return j(200, { data: s ? [s] : [] }); }
  if ((r = p.match(/^\/v1\/invoices\/([^/]+)$/))) return j(200, { id: r[1], number: 'NOVA-0001', hosted_invoice_url: 'https://invoice.stripe.com/i/test_' + r[1], invoice_pdf: 'https://pay.stripe.com/pdf/' + r[1], status: 'paid' });
  return j(404, { error: { message: 'inconnu ' + p } });
}
function payer(lien, extra) { STRIPE.payes[lien] = Object.assign({ id: 'cs_' + lien, livemode: true, payment_intent: 'pi_' + lien, payment_status: 'paid', status: 'complete', amount_total: 99000, customer_details: { email: 'jean@climeole.fr', name: 'Jean Dupont', address: { city: 'Le Lamentin', country: 'MQ' } }, invoice: 'in_1', custom_fields: [], created: Math.floor(Date.now() / 1000) }, extra || {}); }

const PAGE = '<html><head><title>Clim Pro 972</title><meta name="viewport" content="width=device-width"><meta property="og:image" content="/images/atelier.jpg"></head><body>Climatisation au Lamentin : installation, entretien, dépannage. Contact : contact@climpro972.fr <img src="/images/logo.png" alt="logo Clim Pro" class="logo"><img src="/images/chantier1.jpg" alt="Pose d\'une clim"><img src="/images/chantier2.jpg" alt="Entretien"><a href="/contact">Contact</a> © 2018 <style>.b{color:#e30613}.c{color:#e30613}.d{color:#e30613}</style></body></html>';
global.fetch = async function (url, opts) {
  url = String(url);
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

module.exports = { appels: function () { return appelsClaude; }, VERCEL: VERCEL, STRIPE: STRIPE, payer: payer, FAUX_EN_LIGNE: FAUX_EN_LIGNE, EMMA: EMMA, jpeg: jpeg };
