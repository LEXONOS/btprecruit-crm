// Margot, juriste : les mentions légales de chaque site, complètes et vérifiées (loi pour la confiance dans l'économie
// numérique, article 6 III). Ce qu'exige la loi selon la forme de l'entreprise, la recherche dans le registre officiel
// (annuaire des entreprises, données INSEE et RNE) à partir du nom officiel ou du SIRET donné par le client, ce qui manque
// encore et la question à lui poser, et la page des mentions elle-même. Rien n'est inventé : ce qui n'est pas connu
// n'est pas affiché, il est demandé.
'use strict';
const ND = require('../chasse/nd-moteur');
const MQ = require('../martinique');

// Adresse de la notice de confidentialité de Vercel (mise à jour du 1er juin 2026, vérifiée le 3 novembre 2026).
// Vercel ne publie aucun numéro de téléphone : son formulaire de contact en tient lieu.
const HEBERGEUR = { nom: 'Vercel Inc.', adresse: '440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis', contact: 'https://vercel.com/contact' };
const HEBERGEUR_TEXTE = HEBERGEUR.nom + ', ' + HEBERGEUR.adresse;
// le greffe du tribunal mixte de commerce de Fort-de-France tient le registre du commerce de toute la Martinique
// les départements à un seul greffe ; ailleurs (Guadeloupe, Réunion, métropole), le client donne la ville de son greffe
const GREFFES = { '972': 'Fort-de-France', '973': 'Cayenne', '976': 'Mamoudzou' };

const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
const net = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
const chiffres = function (s) { return String(s == null ? '' : s).replace(/\D/g, ''); };
function groupe(n, tailles) { let k = 0; return tailles.map(function (t) { const x = n.slice(k, k + t); k += t; return x; }).filter(Boolean).join(' '); }
function siren(s) { const d = chiffres(s); return d.length >= 9 ? d.slice(0, 9) : null; }
function sirenAffiche(s) { const d = siren(s); return d ? groupe(d, [3, 3, 3]) : null; }
function siretAffiche(s) { const d = chiffres(s); return d.length === 14 ? groupe(d, [3, 3, 3, 5]) : null; }
// clé de Luhn : un SIREN ou un SIRET mal recopié se voit tout de suite (La Poste, 356 000 000, fait exception)
function luhn(d) { let s = 0; for (let k = 0; k < d.length; k++) { let x = Number(d[d.length - 1 - k]); if (k % 2) { x *= 2; if (x > 9) x -= 9; } s += x; } return s % 10 === 0; }
function numeroValide(s) { const d = chiffres(s); return (d.length === 9 || d.length === 14) && (luhn(d) || /^356000000/.test(d)); }

/* ── la forme de l'entreprise et ce qu'elle doit afficher ── */
function categorie(l) {
  const code = String((l && l.nature) || ''), f = String((l && l.forme) || '').toUpperCase();
  if (code === '1000' || /ENTREPRENEUR INDIVIDUEL|^EI\b|MICRO/.test(f)) return 'ei';
  if (/^92/.test(code) || /ASSOCIATION/.test(f)) return 'association';
  if (/^5/.test(code) || /\b(SARL|EURL|SAS|SASU|SA|SNC|SELARL|SELAS|SCA|SCS)\b/.test(f)) return 'commerciale';
  if (/^6/.test(code) || /\b(SCI|SCP|SCM|EARL|GAEC)\b|SOCI[ÉE]T[ÉE] CIVILE/.test(f)) return 'civile';
  return null;
}
// Professions réglementées et activités sous autorisation : ce que la loi demande d'afficher en plus
const REGLEMENTEES = [
  { naf: /^86\.(2|9)/, mots: /m[ée]decin|dentist|kin[ée]|infirmi|sage[- ]femme|ost[ée]o|orthophon|podolog|psychomot|ergoth/i, profession: 'professionnel de santé', question: 'Votre profession exacte et votre numéro RPPS (ou ADELI), et l\'ordre auprès duquel vous êtes inscrit.' },
  { naf: /^47\.73/, mots: /pharma/i, profession: 'pharmacien', question: 'Le nom du pharmacien titulaire et son numéro d\'inscription à l\'Ordre des pharmaciens.' },
  { naf: /^75\.00/, mots: /v[ée]t[ée]rinaire/i, profession: 'vétérinaire', question: 'Votre numéro d\'inscription à l\'Ordre des vétérinaires.' },
  { naf: /^69\.10/, mots: /avocat|notaire|huissier|commissaire de justice/i, profession: 'profession juridique', question: 'Votre barreau ou votre chambre, et votre numéro d\'inscription.' },
  { naf: /^69\.20/, mots: /expert[- ]comptable/i, profession: 'expert-comptable', question: 'Votre numéro d\'inscription à l\'Ordre des experts-comptables.' },
  { naf: /^71\.11/, mots: /architecte/i, profession: 'architecte', question: 'Votre numéro d\'inscription à l\'Ordre des architectes.' },
  { naf: /^68\.31/, mots: /immobili/i, profession: 'agent immobilier', question: 'Le numéro de votre carte professionnelle (délivrée par la CCI) et le nom de votre garant financier.' },
  { naf: /^66\.22/, mots: /assurance|courtier/i, profession: 'intermédiaire en assurance', question: 'Votre numéro d\'immatriculation ORIAS.' },
  { naf: /^85\.53/, mots: /auto[- ]?[ée]cole/i, profession: 'école de conduite', question: 'Le numéro de votre agrément préfectoral.' },
  { naf: /^80\.10/, mots: /s[ée]curit[ée] priv[ée]e|gardiennage/i, profession: 'sécurité privée', question: 'Le numéro de votre autorisation du CNAPS.' },
  { naf: /^79\.1/, mots: /agence de voyage/i, profession: 'agence de voyage', question: 'Votre numéro d\'immatriculation Atout France et votre garant financier.' },
  { naf: /^49\.4/, mots: /d[ée]m[ée]nag|transport de marchandises/i, profession: 'transporteur', question: 'Votre numéro d\'inscription au registre des transporteurs.' },
  { naf: /^49\.32/, mots: /taxi|vtc/i, profession: 'taxi ou VTC', question: 'Votre numéro de licence de taxi ou d\'inscription au registre VTC.' }
];
function reglementee(l, secteur) {
  const naf = String((l && l.naf) || ''), s = String(secteur || '');
  return REGLEMENTEES.find(function (r) { return (naf && r.naf.test(naf)) || r.mots.test(s); }) || null;
}

// Ce que la loi exige pour ce site, et ce qu'on a. spec.legal = { raison_sociale, forme, nature, naf, siren, siret,
// adresse, dirigeant, capital, tva, ordre, source ('registre' | 'client' | 'prospection'), confirme, verifie_le }
function exigences(spec) {
  spec = spec || {};
  const l = spec.legal || {}, c = spec.contact || {};
  const cat = categorie(l);
  const out = [];
  const x = function (cle, libelle, ok, question, bloquant) { out.push({ cle: cle, libelle: libelle, ok: !!ok, question: question || null, bloquant: bloquant !== false }); };
  x('identite', cat === 'ei' ? 'nom et prénom de l\'entrepreneur' : 'dénomination sociale', l.raison_sociale && l.confirme,
    'Le nom officiel de votre entreprise, tel qu\'il figure sur votre Kbis ou votre avis de situation Insee, ou votre numéro SIRET : il doit apparaître dans les mentions légales du site.');
  x('numero', 'numéro SIREN', siren(l.siren || l.siret), 'Votre numéro SIRET (14 chiffres, sur votre Kbis, votre avis Insee ou vos factures).');
  x('adresse', cat === 'ei' ? 'adresse' : 'adresse du siège social', l.adresse || c.adresse, 'L\'adresse de votre entreprise (celle du Kbis ou de l\'avis Insee).');
  x('telephone', 'numéro de téléphone', c.tel || c.mobile, 'Un numéro de téléphone où vous joindre (la loi l\'impose dans les mentions légales).');
  x('email', 'adresse email', c.email, 'Une adresse email à afficher dans les mentions légales (la loi l\'impose aussi).');
  x('publication', 'directeur de la publication', l.dirigeant, 'Le nom du responsable du site : vous-même, ou le gérant ou le président de la société.');
  if (cat === 'commerciale' || cat === 'civile') x('capital', 'capital social', l.capital, 'Le montant de votre capital social (il figure sur votre Kbis) et, si vous en avez un, votre numéro de TVA intracommunautaire.');
  if (cat === 'commerciale' || cat === 'civile') x('rcs', 'ville du greffe (immatriculation au registre du commerce)', siren(l.siren || l.siret) && greffe(l, spec), 'La ville du greffe où votre société est immatriculée (elle figure sur votre Kbis, ex. « RCS Pointe-à-Pitre »).');
  const rg = reglementee(l, spec.secteur || spec.activite);
  if (rg) x('ordre', 'mentions de la profession réglementée (' + rg.profession + ')', l.ordre, rg.question);
  return out;
}
function greffe(l, spec) {
  if (l.greffe) return l.greffe;
  const cp = String(l.cp || '') || ((String(l.adresse || '').match(/\b(97\d{3})\b/) || [])[1] || '');
  const dep = String(l.dep || '') || (/^97[1-8]/.test(cp) ? cp.slice(0, 3) : '') || (spec && spec.commune && MQ.commune(spec.commune) ? '972' : '');
  return GREFFES[dep] || null;
}
function manquants(spec) { return exigences(spec).filter(function (e) { return !e.ok; }); }
function complet(spec) { return !manquants(spec).some(function (e) { return e.bloquant; }); }
// les questions à poser au client, dans l'ordre (le nom officiel d'abord : tout le reste se retrouve à partir de lui)
function questions(spec) {
  const m = manquants(spec);
  if (m.some(function (e) { return e.cle === 'identite'; })) {
    // tant que l'entreprise n'est pas identifiée : son nom officiel (ou son SIRET) ; le registre donnera numéro, siège, dirigeant et greffe
    return [m.find(function (e) { return e.cle === 'identite'; })].concat(m.filter(function (e) { return ['capital', 'ordre', 'telephone', 'email'].indexOf(e.cle) >= 0; }));
  }
  return m.filter(function (e) { return e.cle !== 'numero'; });
}

/* ── le registre officiel ── */
// D'après la fiche de prospection (lib/chasse) : une piste seulement, jamais affichée tant que le client n'a pas confirmé
// son nom officiel ; son adresse peut être celle d'un établissement secondaire, elle n'est donc pas reprise.
function depuisFiche(f, source) {
  if (!f || !f.siren) return null;
  const nomEI = String(f.raison_sociale || '').replace(/\s*\(.*\)\s*$/, '').trim();
  return {
    raison_sociale: nomEI || f.raison_sociale || null, nom_commercial: f.nom || null, forme: f.forme || null, nature: f.nature || null, naf: f.naf || null,
    siren: f.siren, dep: f.siege_dep || null,
    dirigeant: f.dirigeant_personne ? f.dirigeant : (f.forme === 'Entrepreneur individuel' && nomEI ? nomEI : null), qualite: f.qualite || null,
    match: f.match || null, source: source || 'prospection', verifie_le: new Date().toISOString()
  };
}
// D'après une entrée brute de l'annuaire : l'identité et le SIÈGE (adresse, département, SIRET du siège)
function depuisRegistre(x, force) {
  const s = x.siege || {};
  const fi = ND.ficheEntreprise({ r: x, f: force || 3, nom: x.nom_raison_sociale || x.nom_complet });
  const nc = String(x.nom_complet || '');
  const nomEI = nc.replace(/\s*\(.*\)\s*$/, '').trim();
  const ei = String(x.nature_juridique || '') === '1000';
  const enseigne = (s.liste_enseignes && s.liste_enseignes[0]) || s.nom_commercial || ((nc.match(/\((.*)\)/) || [])[1]) || null;
  const cp = String(s.code_postal || '');
  return {
    raison_sociale: (ei ? nomEI : (x.nom_raison_sociale || nomEI)) || null, nom_commercial: enseigne, forme: fi.forme || null, nature: x.nature_juridique || null, naf: x.activite_principale || s.activite_principale || null,
    siren: x.siren, siret: s.siret || null, adresse: s.adresse ? titreAdresse(s.adresse) : null, cp: cp || null, dep: String(s.departement || '') || (/^97/.test(cp) ? cp.slice(0, 3) : cp.slice(0, 2)) || null,
    dirigeant: fi.dirigeant_personne ? fi.dirigeant : (ei && nomEI ? nomEI : null), qualite: fi.dirigeant_personne ? fi.qualite : null,
    source: 'registre', verifie_le: new Date().toISOString()
  };
}
function titreAdresse(a) {
  const t = net(a).toLowerCase().replace(/(^|[\s'-])([a-zàâçéèêëîïôûùüÿñæœ])/g, function (m, p, c) { return p + c.toUpperCase(); })
    .replace(/(^|\s)(De|Du|Des|La|Le|Les|Et|Au|Aux|En|Sur|Sous|L'|D')(?=\s|$)/g, function (m, p, w) { return p + w.toLowerCase(); })
    .replace(/^./, function (c) { return c.toUpperCase(); });
  return t.replace(/\s+(\d{5})\s+(.+)$/, function (m, cp, commune) { return ', ' + cp + ' ' + commune.replace(/^(le|la|les)\b/, function (x) { return x.charAt(0).toUpperCase() + x.slice(1); }); });
}

// Recherche dans l'annuaire des entreprises : par SIRET ou SIREN s'il est donné, sinon par le nom officiel (et la commune).
// → { fiche, legal, sur } ou null. sur = le résultat est celui de l'entreprise sans doute possible.
async function rechercher(q, opts) {
  opts = opts || {};
  const f = opts.fetch || fetch;
  const num = chiffres(q.siret || q.siren || '');
  const nom = net(q.nom);
  if (num.length === 9 || num.length === 14) {
    const r = await ND.chercherSirene(num.slice(0, 9), f, null, opts.limite, opts.departements || '971,972,973,974,976,977,978');
    const x = r.find(function (e) { return e && e.siren === num.slice(0, 9); });
    if (x) { const l = depuisRegistre(x, 3); return { fiche: { raison_sociale: l.raison_sociale, siren: l.siren, forme: l.forme }, legal: l, sur: true }; }
    if (!nom) return null;
  }
  if (!nom) return null;
  const toks = ND.tokens(nom);
  const r = await ND.chercherSirene(nom, f, null, opts.limite, opts.departements || '972');
  const m = ND.meilleureEntreprise(nom, toks, r, true);
  if (!m) return null;
  const l = depuisRegistre(m.r, m.f);
  // le nom donné par le client lui-même suffit s'il colle bien (et la commune du siège si on la connaît)
  const communeOk = !q.commune || !(m.r.siege && m.r.siege.libelle_commune) || ND.sansAccents(m.r.siege.libelle_commune) === ND.sansAccents(q.commune);
  return { fiche: { raison_sociale: l.raison_sociale, siren: l.siren, forme: l.forme }, legal: l, sur: m.f >= 2 && (communeOk || m.f >= 3) };
}

// Pose le résultat du registre dans la fiche du site sans perdre ce que le client a donné (capital, TVA, ordre)
function poser(spec, trouve, o) {
  o = o || {};
  const avant = spec.legal || {};
  const garde = {};
  ['capital', 'tva', 'ordre', 'greffe'].forEach(function (k) { if (avant[k]) garde[k] = avant[k]; });
  const l = Object.assign({}, trouve.legal, garde);
  delete l.a_verifier; delete l.nom_donne; delete l.siret_donne; delete l.piste; delete l.introuvable; delete l.incertain;
  if (avant.dirigeant && avant.source_dirigeant === 'client') { l.dirigeant = avant.dirigeant; l.source_dirigeant = 'client'; }
  l.confirme = !!(o.parClient && trouve.sur);
  if (o.parClient) l.donne_par_client = true;
  spec.legal = l;
  return spec;
}

// Complète les mentions d'une fiche : si le client a donné un nom officiel ou un SIRET (legal.a_verifier), ou si la
// fiche n'a encore rien, on cherche dans le registre. → { spec, trouve, sur, resume }
async function completer(spec, lead, opts) {
  opts = opts || {};
  spec = Object.assign({}, spec || {});
  const l = Object.assign({}, spec.legal || {});
  const parClient = !!l.a_verifier;
  if (!parClient && l.siren && l.verifie_le) return { spec: spec, trouve: false, resume: 'déjà vérifié' };
  // ce que le client vient de donner passe avant ce qui avait été trouvé seul (jamais l'ancien SIRET à la place de son nom)
  const q = parClient ? { nom: l.nom_donne || null, siret: l.siret_donne || null, commune: spec.commune } : { nom: (lead && lead.name) || spec.nom, siret: l.siren || (l.piste && l.piste.siren) || null, commune: spec.commune };
  if (parClient && !q.nom && !q.siret) { l.a_verifier = false; spec.legal = l; return { spec: spec, trouve: false, resume: 'rien à chercher' }; }
  let r = null;
  try { r = await rechercher(q, opts); }
  catch (e) {
    // une requête refusée par l'annuaire (nom trop court, caractères refusés) concerne ce site seulement : on le note et on passe
    if (/HTTP 4\d\d/.test(e.message) && !/429/.test(e.message)) {
      if (parClient) { l.a_verifier = false; l.introuvable = { nom: q.nom || null, siret: q.siret || null, raison: 'requête refusée par l\'annuaire', le: new Date().toISOString() }; spec.legal = l; }
      return { spec: spec, trouve: false, refuse: true, resume: 'requête refusée par l\'annuaire (' + e.message + ') : demander le SIRET' };
    }
    return { spec: spec, trouve: false, erreur: e.message, resume: 'registre injoignable : ' + e.message };
  }
  if (!r) {
    if (parClient) { l.a_verifier = false; l.introuvable = { nom: q.nom || null, siret: q.siret || null, le: new Date().toISOString() }; spec.legal = l; }
    return { spec: spec, trouve: false, resume: 'introuvable dans le registre' + (q.nom ? ' (« ' + q.nom + ' »)' : '') };
  }
  // sans confirmation du client, on ne garde qu'un résultat sûr ; il reste « à confirmer » tant qu'il n'a pas donné son nom officiel
  if (!parClient && !r.sur) return { spec: spec, trouve: false, resume: 'résultat incertain (' + r.fiche.raison_sociale + '), le nom officiel sera demandé' };
  if (parClient && !r.sur) {
    l.a_verifier = false; l.incertain = { trouve: r.fiche.raison_sociale, siren: r.fiche.siren, le: new Date().toISOString() }; spec.legal = l;
    return { spec: spec, trouve: false, resume: 'le nom donné ne correspond pas sûrement à une entreprise (' + r.fiche.raison_sociale + ' ?) : demander le SIRET' };
  }
  poser(spec, r, { parClient: parClient });
  return { spec: spec, trouve: true, sur: r.sur, resume: r.fiche.raison_sociale + ' (SIREN ' + sirenAffiche(r.fiche.siren) + (r.fiche.forme ? ', ' + r.fiche.forme : '') + ')' };
}

// Ce que le client donne lui-même (Emma, outil mentions_legales ; ou une retouche) : rangé, puis vérifié par le registre
function donneParClient(spec, d) {
  spec = Object.assign({}, spec || {});
  const l = Object.assign({}, spec.legal || {});
  if (d.nom_officiel) { l.nom_donne = net(d.nom_officiel).slice(0, 140); l.a_verifier = true; }
  if (d.siret) { const n = chiffres(d.siret); if (numeroValide(n)) { l.siret_donne = n; l.a_verifier = true; } else l.siret_refuse = net(d.siret).slice(0, 30); }
  if (d.capital) l.capital = net(d.capital).replace(/euros?/i, '€').slice(0, 40);
  if (d.tva && /^FR\s?[0-9A-Z]{2}\s?\d{9}$/i.test(net(d.tva).replace(/\s/g, ''))) l.tva = net(d.tva).replace(/\s/g, '').toUpperCase();
  if (d.responsable) { l.dirigeant = net(d.responsable).slice(0, 80); l.source_dirigeant = 'client'; }
  if (d.ordre) l.ordre = net(d.ordre).slice(0, 200);
  if (d.greffe) l.greffe = net(d.greffe).replace(/^rcs\s+/i, '').slice(0, 40);
  spec.legal = l;
  if (d.email && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(net(d.email))) spec.contact = Object.assign({}, spec.contact || {}, { email: net(d.email).toLowerCase() });
  return spec;
}

/* ── la page ── */
// ctx = { mode, identite (Novalemo), photos (avec crédits) }
function mentionsHtml(spec, ctx) {
  spec = spec || {}; ctx = ctx || {};
  const l = spec.legal || {}, c = spec.contact || {}, id = ctx.identite || {};
  const cat = categorie(l);
  const nom = net(spec.nom);
  // l'identité légale n'est affichée qu'une fois confirmée par le client (son nom officiel ou son SIRET retrouvés dans le registre)
  const sur = !!l.confirme && l.source === 'registre';
  const lignes = [];
  if (l.raison_sociale && sur) {
    if (cat === 'ei') lignes.push('<strong>' + esc(l.raison_sociale) + '</strong>, entrepreneur individuel (EI)' + (nom && nom.toUpperCase() !== String(l.raison_sociale).toUpperCase() ? ', sous le nom commercial ' + esc(nom) : ''));
    else lignes.push('<strong>' + esc(l.raison_sociale) + '</strong>' + (l.forme ? ', ' + esc(l.forme) : '') + (l.capital ? ' au capital de ' + esc(l.capital) : '') + (nom && nom.toUpperCase() !== String(l.raison_sociale).toUpperCase() ? ' (' + esc(nom) + ')' : ''));
  } else lignes.push('<strong>' + esc(nom) + '</strong>');
  const s = sur && sirenAffiche(l.siren || l.siret);
  if (s) {
    const g = greffe(l, spec);
    if (cat === 'commerciale' || cat === 'civile') lignes.push('RCS ' + (g ? esc(g) + ' ' : '') + s);
    else lignes.push('SIREN ' + s + ', inscrit au Registre national des entreprises');
    if (siretAffiche(l.siret)) lignes.push('SIRET ' + siretAffiche(l.siret));
  }
  if (l.tva) lignes.push('TVA intracommunautaire ' + esc(l.tva));
  // « Siège social » seulement pour l'adresse du siège lue dans le registre ; sinon l'adresse de contact, dite comme telle
  if (sur && l.adresse) lignes.push((cat && cat !== 'ei' ? 'Siège social : ' : 'Adresse : ') + esc(l.adresse));
  else if (c.adresse) lignes.push('Adresse : ' + esc(c.adresse));
  else if (spec.commune) lignes.push(esc(spec.commune) + ', Martinique');
  if (c.tel || c.mobile) lignes.push('Téléphone : ' + esc(MQ.affiche(c.tel || c.mobile)));
  if (c.email) lignes.push('Email : <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
  if (l.ordre) lignes.push(esc(l.ordre));
  const directeur = sur && l.dirigeant ? 'Directeur de la publication : ' + esc(l.dirigeant) + (l.qualite && cat !== 'ei' ? ' (' + esc(String(l.qualite).toLowerCase()) + ')' : '') : null;
  const realise = id.entreprise ? esc(id.entreprise) + (id.siret ? ', SIRET ' + esc(siretAffiche(id.siret) || id.siret) : '') + (id.marque ? ' (' + esc(id.marque) + ')' : '') : 'Studio Novalem';
  const credits = (ctx.photos || []).filter(function (p) { return p && p.credit; }).map(function (p) {
    const k = p.credit;
    const auteur = k.page_auteur ? '<a href="' + esc(k.page_auteur) + '" target="_blank" rel="noopener">' + esc(k.auteur || 'auteur inconnu') + '</a>' : esc(k.auteur || 'auteur inconnu');
    return 'photo de ' + auteur + ' sur ' + (k.page ? '<a href="' + esc(k.page) + '" target="_blank" rel="noopener">' + esc(k.source) + '</a>' : esc(k.source));
  }).filter(function (x, k, a) { return a.indexOf(x) === k; });
  const aCompleter = ctx.mode === 'apercu' && !complet(spec);
  return (aCompleter ? '<p class="note"><strong>Aperçu :</strong> les mentions légales de l\'entreprise seront complétées avec elle, d\'après le registre officiel.</p>' : '') +
    '<h2>Éditeur du site</h2><p>' + lignes.join('<br>') + '</p>' +
    (directeur ? '<p>' + directeur + '</p>' : '') +
    '<h2>Hébergement</h2><p>' + esc(HEBERGEUR.nom) + '<br>' + esc(HEBERGEUR.adresse) + '<br>Contact : <a href="' + esc(HEBERGEUR.contact) + '" target="_blank" rel="noopener">vercel.com/contact</a></p>' +
    '<h2>Réalisation</h2><p>' + realise + '</p>' +
    (credits.length ? '<h2>Photos</h2><p>Photos d\'illustration libres de droits : ' + credits.join(', ') + '.</p>' : '') +
    '<h2>Données personnelles</h2><p>Ce site ne dépose aucun cookie, n\'utilise aucun outil de mesure d\'audience et ne collecte aucune donnée par formulaire. Les informations que vous transmettez par téléphone, email ou WhatsApp servent uniquement à répondre à votre demande et ne sont jamais cédées. Vous pouvez demander à tout moment leur consultation, leur rectification ou leur suppression en écrivant à l\'éditeur, et saisir la CNIL (cnil.fr).</p>' +
    '<h2>Propriété intellectuelle</h2><p>Les textes, images et éléments graphiques de ce site appartiennent à leur éditeur ou à leurs auteurs. Toute reproduction sans autorisation est interdite.</p>';
}

module.exports = { HEBERGEUR, HEBERGEUR_TEXTE, GREFFES, REGLEMENTEES, categorie, reglementee, exigences, manquants, complet, questions, depuisFiche, depuisRegistre, rechercher, poser, completer, donneParClient, mentionsHtml, numeroValide, sirenAffiche, siretAffiche, luhn };
