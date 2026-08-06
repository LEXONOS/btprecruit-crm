/* NOVALEM SITES — PARAMETRES
   Source unique de verite pour :
     - l'identite de l'entreprise (adresse, SIRET, APE, TVA...)
     - les coordonnees bancaires (IBAN, BIC) imprimees sur les factures
     - le modele de paiement par defaut (100 %, 50/50, 30/70, libre)
     - tous les textes commerciaux et contractuels (arguments de vente,
       12 articles du contrat, pieds de page, modeles d'e-mails)
     - le catalogue de prestations
   Stockage : table Supabase web_parametres (partage) + copie locale
   (localStorage) pour que l'appli reste utilisable meme si la table
   n'existe pas encore ou si la connexion tombe.
   Charge AVANT sites-app.js. Expose window.NOVCFG. */
(function () {
'use strict';

var LS_KEY = 'nov_sites_params_v1';
var TABLE  = 'web_parametres';
var ROW_ID = 'global';

// ═══════════════════════════════════════════════════════════════════
// VALEURS PAR DEFAUT
// ═══════════════════════════════════════════════════════════════════
var DEFAULTS = {
  entreprise: {
    nom_commercial : 'NOVALEM',
    exploitant     : 'Louis Renault',
    forme          : 'Entrepreneur individuel (micro-entreprise)',
    adresse        : '',
    siret          : '103 405 247 00018',
    ape            : '',
    email          : 'louisprorenault@gmail.com',
    tel            : '+590 690 31 79 99 / +33 6 58 21 20 90',
    site           : '',
    tva            : 'TVA non applicable, article 293 B du CGI',
    baseline       : 'Creation de sites internet'
  },
  paiement: {
    titulaire : 'Louis Renault',
    banque    : '',
    iban      : '',
    bic       : '',
    autres    : 'Virement bancaire. Paiement egalement possible par tout moyen convenu.'
  },
  facturation: {
    acompte_pct_defaut : 30,   // 0 = tout a la livraison, 100 = tout a la commande
    validite_devis_j   : 30,
    delai_acompte_j    : 15,   // echeance de la facture d'acompte
    delai_solde_j      : 30,   // echeance de la facture de solde
    penalites          : 'En cas de retard de paiement : penalites au taux de 3 fois l\'interet legal et indemnite forfaitaire de recouvrement de 40 EUR (art. L.441-10 et D.441-5 du Code de commerce). Pas d\'escompte pour paiement anticipe.'
  },
  automatismes: {
    joindre_pdf         : true,  // joindre le PDF aux e-mails sortants
    facture_acompte_auto: true,  // creer la facture d'acompte des que le devis est signe
    email_auto_signature: false, // envoyer cette facture automatiquement par mail
    relance_auto        : true   // creer un rappel de relance a l'emission d'une facture
  },
  documents: {
    // Bloc libre affiche sur le devis-contrat (ce que tu vends, tes arguments)
    devis_argumentaire:
      'Site developpe en code natif (pas de WordPress, pas de no-code) : rapide, leger, durable.\n' +
      'Vous etes proprietaire a 100 % de votre site et de votre nom de domaine.\n' +
      'Referencement Google pris en compte des la conception (structure, vitesse, balises).\n' +
      'Un interlocuteur unique, joignable, qui suit votre projet du debut a la mise en ligne.\n' +
      'SAV gratuit a vie sur tout bug provenant du code livre.',
    devis_pied:
      'Offre valable {validite_j} jours a compter de la date d\'emission. Devis etabli en euros, hors taxes.',
    facture_pied:
      'Merci de votre confiance. Reglement par virement aux coordonnees ci-dessus, en rappelant le numero de facture.',
    // Les articles du contrat. {acompte_pct}, {solde_pct}, {echeancier}, {tva}, {cession} sont remplaces a la generation.
    conditions: null, // null = utilise CONDITIONS_DEFAUT ci-dessous
    email_devis:
      'Bonjour {contact},\n\n' +
      'Veuillez trouver votre devis {numero} d\'un montant de {total} HT ({tva}).\n\n' +
      'Ce devis vaut contrat : en le signant "bon pour accord" ci-dessous, vous validez le lancement du projet.\n' +
      'Signer en ligne (signature electronique, 2 minutes) :\n[Signer le devis]({lien})\n\n' +
      'Comment ca se passe ensuite :\n{etapes}\n\n' +
      'Offre valable {validite_j} jours. Je reste a votre disposition pour toute question.\n\n' +
      'Bien cordialement,\n{exploitant} - {entreprise}\n{baseline}\n{tel}\n{email}',
    email_facture:
      'Bonjour {contact},\n\n' +
      'Veuillez trouver ci-joint la facture {numero} d\'un montant de {montant} HT, a regler avant le {echeance}.\n\n' +
      '{contexte}\n\n' +
      'Coordonnees de paiement :\nIBAN : {iban}\nBIC : {bic}\nTitulaire : {titulaire}\n\n' +
      'Merci de rappeler le numero de facture en reference du virement.\n\n' +
      'Bien cordialement,\n{exploitant} - {entreprise}\n{tel}\n{email}',
    email_relance:
      'Bonjour {contact},\n\n' +
      'Sauf erreur de ma part, la facture {numero} de {montant} HT, echue le {echeance}, reste en attente de reglement.\n' +
      'Si le virement a deja ete effectue, merci de ne pas tenir compte de ce message.\n\n' +
      'Coordonnees de paiement :\nIBAN : {iban}\nBIC : {bic}\n\n' +
      'Bien cordialement,\n{exploitant} - {entreprise}\n{tel}',
    email_livraison:
      'Bonjour {contact},\n\n' +
      'Votre site est en ligne : {url}\n\n' +
      'Vous trouverez en piece jointe le document de passation : nom de domaine, hebergement, acces et repartition des responsabilites.\n' +
      'Le SAV reste gratuit a vie sur tout bug provenant du code livre.\n\n' +
      'Bien cordialement,\n{exploitant} - {entreprise}\n{tel}'
  },
  catalogue: [
    { label: 'Site Essentiel (une page)', prix: 390 },
    { label: 'Site Vitrine (jusqu a 5 pages)', prix: 790 },
    { label: 'Site Signature', prix: 1190 },
    { label: 'Page supplementaire', prix: 60 },
    { label: 'Formulaire de devis multi-etapes', prix: 120 },
    { label: 'Prise de rendez-vous en ligne', prix: 190 },
    { label: 'Espace client securise', prix: 450 },
    { label: 'Version multilingue (par langue)', prix: 120 },
    { label: 'Boutique en ligne (a partir de)', prix: 560 },
    { label: 'Avis Google en direct', prix: 65 },
    { label: 'WhatsApp et messagerie', prix: 35 },
    { label: 'SEO technique (jusqu a 10 pages)', prix: 290 },
    { label: 'Fiche Google Business', prix: 150 },
    { label: 'Blog SEO', prix: 350 },
    { label: 'Redaction article (1000 mots)', prix: 70 },
    { label: 'GEO (IA generatives)', prix: 350 },
    { label: 'Google Ads, lancement', prix: 350 }
  ],
  catalogue_recurrent: [
    { label: 'Abonnement contenu (4 articles/mois)', prix: 250 },
    { label: 'Google Ads, pilotage', prix: 190 },
    { label: 'Rapport de performance mensuel', prix: 90 }
  ]
};

var CESSION = 'Cession des droits d\'auteur sur le code source livre au client apres paiement integral du prix.';

var CONDITIONS_DEFAUT = [
  { t: '1. Objet',
    b: 'Le present devis, une fois signe "bon pour accord" par le client, vaut contrat de prestation de services. Il a pour objet la conception et la realisation du site internet decrit dans le detail ci-dessus, aux conditions qui suivent.' },
  { t: '2. Prix et TVA',
    b: 'Les prix sont indiques en euros, hors taxes. {tva} : aucune TVA n\'est facturee ni recuperable. Le prix est ferme et definitif pour le perimetre decrit ; toute prestation non prevue fait l\'objet d\'un devis complementaire.' },
  { t: '3. Modalites de paiement',
    b: '{echeancier} Passe la date d\'echeance, des penalites de retard au taux de trois fois l\'interet legal sont exigibles, ainsi qu\'une indemnite forfaitaire de recouvrement de 40 EUR (art. L.441-10 et D.441-5 du Code de commerce). En cas d\'abandon du projet par le client apres signature, les sommes deja versees restent acquises au prestataire et les prestations deja realisees restent dues au prorata.' },
  { t: '4. Delais',
    b: 'Les delais annonces sont indicatifs et courent a compter de la signature et de la reception par le prestataire de l\'ensemble des contenus et acces necessaires. Un retard raisonnable ne peut donner lieu a annulation ni a indemnite.' },
  { t: '5. Obligations du client',
    b: 'Le client fournit en temps utile les textes, visuels, logos et acces necessaires, et designe un interlocuteur pour valider les etapes. Il garantit detenir les droits sur les contenus transmis et garantit le prestataire contre tout recours a ce titre.' },
  { t: '6. Validation, revisions et livraison',
    b: 'Une maquette (apercu) est soumise au client via un lien prive. Deux series de modifications sont incluses ; au-dela, les ajustements sont factures au temps passe. La validation de la maquette declenche la facturation. La mise en ligne vaut livraison.' },
  { t: '7. Propriete intellectuelle et reserve de propriete',
    b: '{cession} Jusqu\'au paiement complet, le prestataire conserve la propriete des developpements et l\'usage du site n\'est pas cede : la mise en ligne est subordonnee au reglement integral.' },
  { t: '8. Hebergement et nom de domaine',
    b: 'Le nom de domaine et l\'hebergement sont souscrits au nom du client, qui en demeure seul proprietaire et en supporte le cout annuel (a ce jour de l\'ordre de quelques euros par an chez l\'hebergeur retenu). Le client ajoute le prestataire comme contact technique de ses services afin qu\'il puisse assurer la gestion technique sans partage d\'identifiants. En cas de fin de collaboration, le client conserve son domaine, son hebergement et l\'integralite des fichiers de son site.' },
  { t: '9. Maintenance et SAV',
    b: 'Le SAV technique est gratuit a vie pour tout dysfonctionnement provenant du code livre par le prestataire. Les modifications, evolutions, ajouts de page ou de fonctionnalite apres livraison font l\'objet d\'un nouveau devis.' },
  { t: '10. Retractation',
    b: 'Le contrat est conclu entre professionnels : le droit de retractation prevu par le Code de la consommation ne s\'applique pas. En cas d\'abandon du projet par le client apres signature, les prestations deja realisees restent dues au prorata.' },
  { t: '11. Donnees personnelles (RGPD)',
    b: 'Chaque partie respecte la reglementation applicable. Le client demeure responsable des traitements de donnees personnelles operes via son site.' },
  { t: '12. Droit applicable et litiges',
    b: 'Le present contrat est soumis au droit francais. En cas de differend, les parties rechercheront une solution amiable avant toute action ; a defaut, les tribunaux competents seront saisis.' }
];

// ═══════════════════════════════════════════════════════════════════
// ETAT + UTILITAIRES
// ═══════════════════════════════════════════════════════════════════
var CFG = clone(DEFAULTS);
var _tableOK = null;   // null = inconnu, true = table presente, false = absente
var _loaded  = false;
var _W = null;         // copie de travail pendant l'edition

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function n(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
function esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// fusion profonde : les cles absentes du stockage reprennent la valeur par defaut
function merge(base, over) {
  var out = clone(base);
  if (!over || typeof over !== 'object') return out;
  Object.keys(over).forEach(function (k) {
    var v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = merge(out[k], v);
    } else if (v !== undefined && v !== null) {
      out[k] = v;
    }
  });
  return out;
}
function eur(v, dec) {
  dec = dec == null ? 2 : dec;
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n(v)); }
  catch (e) { return n(v).toFixed(dec) + ' EUR'; }
}
function toast(m, t) { if (window.toast) window.toast(m, t); }

// ═══════════════════════════════════════════════════════════════════
// CHARGEMENT / SAUVEGARDE
// ═══════════════════════════════════════════════════════════════════
function loadLocal() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) CFG = merge(DEFAULTS, JSON.parse(raw));
  } catch (e) { /* cache illisible : on garde les defauts */ }
}
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(CFG)); } catch (e) {}
}

async function load(sb) {
  loadLocal();
  _loaded = true;
  if (!sb) return CFG;
  try {
    var r = await sb.from(TABLE).select('data').eq('id', ROW_ID).maybeSingle();
    if (r.error) { _tableOK = false; return CFG; }
    _tableOK = true;
    if (r.data && r.data.data) { CFG = merge(DEFAULTS, r.data.data); saveLocal(); }
    return CFG;
  } catch (e) { _tableOK = false; return CFG; }
}

async function save(sb, data) {
  CFG = merge(DEFAULTS, data || CFG);
  saveLocal();
  if (!sb) return { ok: false, reason: 'offline' };
  try {
    var r = await sb.from(TABLE).upsert({ id: ROW_ID, data: CFG, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (r.error) { _tableOK = false; return { ok: false, reason: r.error.message }; }
    _tableOK = true;
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ═══════════════════════════════════════════════════════════════════
// ECHEANCIER (par devis, avec repli sur le defaut des parametres)
// ═══════════════════════════════════════════════════════════════════
// pct = part payee A LA SIGNATURE. 0 = tout a la livraison. 100 = tout a la commande.
function defaultPct() {
  var p = n(CFG.facturation.acompte_pct_defaut);
  return Math.max(0, Math.min(100, p));
}
function pctOf(devis) {
  if (devis && devis.acompte_pct !== undefined && devis.acompte_pct !== null && devis.acompte_pct !== '') {
    return Math.max(0, Math.min(100, n(devis.acompte_pct)));
  }
  return defaultPct();
}
function planFor(devis, totalOverride) {
  var total = totalOverride != null ? n(totalOverride) : n(devis && devis.total_ht);
  var pct = pctOf(devis);
  var ac = Math.round(total * pct) / 100;
  var sd = Math.round((total - ac) * 100) / 100;
  return {
    pct: pct,
    soldePct: Math.round((100 - pct) * 100) / 100,
    total: total,
    acompte: ac,
    solde: sd,
    // 'commande' = un seul reglement a la signature
    // 'livraison' = un seul reglement a la livraison
    // 'deux' = acompte + solde
    mode: pct <= 0 ? 'livraison' : (pct >= 100 ? 'commande' : 'deux'),
    unique: (pct <= 0 || pct >= 100)
  };
}
// Libelle court : "30 % / 70 %", "100 % a la commande", "100 % a la livraison"
function planLabel(plan) {
  if (plan.mode === 'commande') return '100 % a la commande';
  if (plan.mode === 'livraison') return '100 % a la livraison';
  return plan.pct + ' % / ' + plan.soldePct + ' %';
}
// Phrase complete, utilisee dans le contrat, les PDF et les e-mails
function echeancierPhrase(plan) {
  if (plan.mode === 'commande') {
    return 'Le prix est integralement du a la signature du present devis-contrat (' + eur(plan.total) + ' HT) ; une facture est emise a cette date. La realisation demarre des encaissement.';
  }
  if (plan.mode === 'livraison') {
    return 'Le prix est integralement du a la livraison (' + eur(plan.total) + ' HT), apres validation du site par le client et AVANT sa mise en ligne. Le site n\'est mis en ligne qu\'apres encaissement integral.';
  }
  return 'Le prix est regle en deux temps : un acompte de ' + plan.pct + ' % du montant total (' + eur(plan.acompte) + ' HT) est du a la signature du present devis-contrat, une facture d\'acompte etant emise a cette date ; le solde de ' + plan.soldePct + ' % (' + eur(plan.solde) + ' HT) est du a la livraison, apres validation du site par le client et AVANT sa mise en ligne. Le site n\'est mis en ligne qu\'apres encaissement integral du solde.';
}
// Bandeau court pour l'en-tete des PDF
function echeancierCourt(plan) {
  if (plan.mode === 'commande') return 'Paiement : 100 % a la signature (' + eur(plan.total) + ').';
  if (plan.mode === 'livraison') return 'Paiement : 100 % a la livraison (' + eur(plan.total) + '), avant mise en ligne.';
  return 'Paiement : acompte ' + plan.pct + ' % a la signature (' + eur(plan.acompte) + '), solde ' + plan.soldePct + ' % a la livraison (' + eur(plan.solde) + ').';
}
// Etapes numerotees pour l'e-mail d'envoi du devis
function etapesTexte(plan) {
  var L = ['1) Vous signez le devis en ligne.'];
  if (plan.mode === 'commande') {
    L.push('2) Vous reglez la facture (' + eur(plan.total) + ' HT), ce qui lance le projet.');
    L.push('3) Je realise votre site et vous envoie un lien d\'apercu prive ; on ajuste ensemble.');
    L.push('4) Je mets votre site en ligne des votre validation.');
  } else if (plan.mode === 'livraison') {
    L.push('2) Je realise votre site et vous envoie un lien d\'apercu prive ; on ajuste ensemble.');
    L.push('3) A la livraison, vous reglez la facture (' + eur(plan.total) + ' HT).');
    L.push('4) Je mets votre site en ligne des reception du paiement.');
  } else {
    L.push('2) Vous reglez l\'acompte de ' + plan.pct + ' % (' + eur(plan.acompte) + ' HT), qui lance le projet.');
    L.push('3) Je realise votre site et vous envoie un lien d\'apercu prive ; on ajuste ensemble.');
    L.push('4) A la livraison, vous reglez le solde de ' + plan.soldePct + ' % (' + eur(plan.solde) + ' HT).');
    L.push('5) Je mets votre site en ligne des reception du solde.');
  }
  return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// TEXTES : interpolation {variables}
// ═══════════════════════════════════════════════════════════════════
function fill(tpl, vars) {
  if (!tpl) return '';
  return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
    return (vars && vars[k] !== undefined && vars[k] !== null) ? String(vars[k]) : '';
  });
}
// Les articles du contrat, variables resolues pour un devis donne
function conditions(plan) {
  var base = (CFG.documents.conditions && CFG.documents.conditions.length) ? CFG.documents.conditions : CONDITIONS_DEFAUT;
  var vars = {
    acompte_pct : plan ? plan.pct : defaultPct(),
    solde_pct   : plan ? plan.soldePct : (100 - defaultPct()),
    echeancier  : plan ? echeancierPhrase(plan) : '',
    tva         : CFG.entreprise.tva,
    cession     : CESSION,
    entreprise  : CFG.entreprise.nom_commercial,
    exploitant  : CFG.entreprise.exploitant
  };
  return base.map(function (a) { return { t: fill(a.t, vars), b: fill(a.b, vars) }; });
}
function argumentaireLines() {
  return String(CFG.documents.devis_argumentaire || '').split('\n')
    .map(function (s) { return s.trim(); }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════
// CONTROLE DE COMPLETUDE (ce qui manque pour facturer proprement)
// ═══════════════════════════════════════════════════════════════════
function manques() {
  var m = [];
  if (!CFG.entreprise.adresse) m.push('adresse de l\'entreprise');
  if (!CFG.entreprise.siret) m.push('SIRET');
  if (!CFG.paiement.iban) m.push('IBAN');
  if (!CFG.paiement.bic) m.push('BIC');
  if (!CFG.paiement.titulaire) m.push('titulaire du compte');
  return m;
}

// ═══════════════════════════════════════════════════════════════════
// INTERFACE : PANNEAU PARAMETRES
// ═══════════════════════════════════════════════════════════════════
var TABS = [
  { k: 'entreprise', l: 'Entreprise' },
  { k: 'banque',     l: 'Paiement' },
  { k: 'modele',     l: 'Echeancier' },
  { k: 'textes',     l: 'Textes' },
  { k: 'contrat',    l: 'Contrat' },
  { k: 'catalogue',  l: 'Catalogue' },
  { k: 'auto',       l: 'Automatismes' }
];

function openSettings(tab) {
  _W = clone(CFG);
  if (!_W.documents.conditions || !_W.documents.conditions.length) _W.documents.conditions = clone(CONDITIONS_DEFAUT);
  var nav = TABS.map(function (t) {
    return '<button class="btn ' + (t.k === (tab || 'entreprise') ? 'bp' : 'bg') + ' bxs" id="pset-tab-' + t.k + '" onclick="cfgTab(\'' + t.k + '\')">' + t.l + '</button>';
  }).join(' ');
  var warn = '';
  var mq = manques();
  if (mq.length) {
    warn = '<div class="sites-legal" style="border-color:var(--orange);color:var(--orange);margin-bottom:10px">' +
      'A completer pour des documents conformes : <b>' + esc(mq.join(', ')) + '</b>.</div>';
  }
  if (_tableOK === false) {
    warn += '<div class="sites-legal" style="border-color:var(--red);color:var(--red);margin-bottom:10px">' +
      'La table <b>web_parametres</b> est absente de la base : les reglages sont enregistres sur ce navigateur uniquement. ' +
      'Execute la migration <b>sites-schema-v2.sql</b> dans Supabase pour les partager entre tes appareils.</div>';
  }
  var body =
    warn +
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;position:sticky;top:0;background:var(--s1);padding-bottom:8px;z-index:2">' + nav + '</div>' +
    '<div id="pset-body"></div>';
  window.openMo('Parametres', body,
    '<button class="btn bg" onclick="closeMo()">Fermer</button>' +
    '<button class="btn bp" onclick="cfgSave()">Enregistrer</button>');
  cfgTab(tab || 'entreprise');
}

function cfgTab(k) {
  TABS.forEach(function (t) {
    var b = document.getElementById('pset-tab-' + t.k);
    if (b) { b.className = 'btn ' + (t.k === k ? 'bp' : 'bg') + ' bxs'; }
  });
  var host = document.getElementById('pset-body');
  if (!host) return;
  var R = {
    entreprise: tabEntreprise, banque: tabBanque, modele: tabModele,
    textes: tabTextes, contrat: tabContrat, catalogue: tabCatalogue, auto: tabAuto
  };
  host.innerHTML = (R[k] || tabEntreprise)();
  if (k === 'contrat') renderConditions();
  if (k === 'catalogue') renderCatalogue();
}

function fld(label, id, val, ph, type) {
  return '<div class="fgrp"><label class="lbl">' + esc(label) + '</label>' +
    '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '"></div>';
}
function area(label, id, val, ph, rows) {
  return '<div class="fgrp"><label class="lbl">' + esc(label) + '</label>' +
    '<textarea id="' + id + '" rows="' + (rows || 4) + '" placeholder="' + esc(ph || '') + '">' + esc(val) + '</textarea></div>';
}
function help(t) { return '<div style="font-size:10px;color:var(--mu2);margin:-4px 0 10px">' + t + '</div>'; }

function tabEntreprise() {
  var e = _W.entreprise;
  return '' +
    '<div class="fg">' + fld('Nom commercial', 'ce-nom', e.nom_commercial) + fld('Exploitant (identite legale)', 'ce-exploitant', e.exploitant, 'Prenom NOM') + '</div>' +
    '<div class="fg">' + fld('Forme juridique', 'ce-forme', e.forme) + fld('Baseline (sous le logo)', 'ce-baseline', e.baseline) + '</div>' +
    area('Adresse complete', 'ce-adresse', e.adresse, 'ex : 12 rue des Artisans, 97110 Pointe-a-Pitre', 2) +
    help('Obligatoire sur un devis, un contrat et une facture.') +
    '<div class="fg3">' + fld('SIRET', 'ce-siret', e.siret) + fld('Code APE / NAF', 'ce-ape', e.ape, 'ex : 62.01Z') + fld('Site internet', 'ce-site', e.site, 'novalem...') + '</div>' +
    '<div class="fg">' + fld('E-mail', 'ce-email', e.email) + fld('Telephone', 'ce-tel', e.tel) + '</div>' +
    fld('Mention TVA', 'ce-tva', e.tva) +
    help('En franchise en base, la mention de l\'article 293 B du CGI est obligatoire sur les factures.');
}

function tabBanque() {
  var p = _W.paiement;
  return '' +
    '<div class="fg">' + fld('Titulaire du compte', 'cb-titulaire', p.titulaire) + fld('Banque', 'cb-banque', p.banque, 'ex : Qonto, Credit Agricole') + '</div>' +
    fld('IBAN', 'cb-iban', p.iban, 'FR76 XXXX XXXX XXXX XXXX XXXX XXX') +
    fld('BIC / SWIFT', 'cb-bic', p.bic, 'XXXXXXXX') +
    help('Imprimes sur chaque facture. Sans eux, le client ne peut pas te payer par virement.') +
    area('Autres modalites de paiement', 'cb-autres', p.autres, '', 2) +
    area('Mention de retard de paiement', 'cb-penalites', _W.facturation.penalites, '', 3) +
    help('Mention legale obligatoire entre professionnels.');
}

function tabModele() {
  var f = _W.facturation;
  var cur = n(f.acompte_pct_defaut);
  function opt(v, l) {
    var on = cur === v;
    return '<button class="btn ' + (on ? 'bp' : 'bg') + ' bsm" onclick="cfgSetPct(' + v + ')">' + l + '</button>';
  }
  return '' +
    '<div class="fgrp"><label class="lbl">Echeancier propose par defaut</label>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      opt(30, '30 % / 70 %') + opt(50, '50 % / 50 %') + opt(0, '100 % a la livraison') + opt(100, '100 % a la commande') +
    '</div></div>' +
    '<div class="fg3">' +
      fld('Acompte par defaut (%)', 'cf-pct', cur, '', 'number') +
      fld('Validite des devis (jours)', 'cf-validite', f.validite_devis_j, '', 'number') +
      fld('Echeance facture d\'acompte (jours)', 'cf-delai-ac', f.delai_acompte_j, '', 'number') +
    '</div>' +
    '<div class="fg">' + fld('Echeance facture de solde (jours)', 'cf-delai-sd', f.delai_solde_j, '', 'number') + '<div class="fgrp"></div></div>' +
    '<div class="sites-legal">Ce n\'est qu\'un <b>defaut</b> : sur chaque devis tu peux choisir un autre echeancier (0 % = tout a la livraison, 100 % = tout a la commande, ou n\'importe quel pourcentage). Tout suit ensuite automatiquement : contrat, PDF, factures, e-mails.</div>';
}

function tabTextes() {
  var d = _W.documents;
  return '' +
    area('Arguments de vente (bloc affiche sur le devis-contrat)', 'ct-argu', d.devis_argumentaire, 'Une ligne = une puce', 7) +
    help('Une ligne par argument. Ce bloc apparait sur le PDF du devis, juste avant les conditions.') +
    area('Pied de devis', 'ct-pied-devis', d.devis_pied, '', 2) +
    area('Pied de facture', 'ct-pied-facture', d.facture_pied, '', 2) +
    '<div class="sites-legal" style="margin:10px 0">Variables utilisables dans les e-mails : ' +
      '<b>{contact} {client} {numero} {total} {montant} {acompte} {solde} {acompte_pct} {solde_pct} {echeance} {lien} {url} {etapes} {contexte} {iban} {bic} {titulaire} {tva} {validite_j} {entreprise} {exploitant} {tel} {email} {baseline}</b></div>' +
    area('E-mail : envoi du devis', 'ct-mail-devis', d.email_devis, '', 10) +
    area('E-mail : envoi d\'une facture', 'ct-mail-facture', d.email_facture, '', 9) +
    area('E-mail : relance de facture impayee', 'ct-mail-relance', d.email_relance, '', 7) +
    area('E-mail : livraison du site', 'ct-mail-livraison', d.email_livraison, '', 6);
}

function tabContrat() {
  return '' +
    '<div class="sites-legal" style="margin-bottom:10px">Ces articles constituent le contrat imprime sur le devis. ' +
    'Variables : <b>{echeancier}</b> (phrase de paiement generee selon l\'echeancier du devis), <b>{acompte_pct}</b>, <b>{solde_pct}</b>, <b>{tva}</b>, <b>{cession}</b>, <b>{entreprise}</b>, <b>{exploitant}</b>.</div>' +
    '<div id="cfg-conds"></div>' +
    '<div style="display:flex;gap:6px;margin-top:10px">' +
      '<button class="btn bg bsm" onclick="cfgAddCond()">+ Ajouter un article</button>' +
      '<button class="btn bg bsm" onclick="cfgResetConds()">Revenir aux articles par defaut</button>' +
    '</div>';
}
function renderConditions() {
  var host = document.getElementById('cfg-conds');
  if (!host) return;
  host.innerHTML = _W.documents.conditions.map(function (a, i) {
    return '<div style="border:1px solid var(--bd);border-radius:var(--r);padding:8px;margin-bottom:8px">' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
        '<input value="' + esc(a.t) + '" oninput="cfgCondEdit(' + i + ',\'t\',this.value)" style="flex:1" placeholder="Titre de l\'article">' +
        '<span class="btn bg bxs" onclick="cfgMoveCond(' + i + ',-1)" title="Monter">&uarr;</span>' +
        '<span class="btn bg bxs" onclick="cfgMoveCond(' + i + ',1)" title="Descendre">&darr;</span>' +
        '<span class="dv-x" onclick="cfgDelCond(' + i + ')" title="Supprimer">&times;</span>' +
      '</div>' +
      '<textarea rows="4" oninput="cfgCondEdit(' + i + ',\'b\',this.value)">' + esc(a.b) + '</textarea>' +
    '</div>';
  }).join('') || '<div class="empty">Aucun article</div>';
}
function cfgCondEdit(i, k, v) { if (_W.documents.conditions[i]) _W.documents.conditions[i][k] = v; }
function cfgAddCond() { _W.documents.conditions.push({ t: '', b: '' }); renderConditions(); }
function cfgDelCond(i) { _W.documents.conditions.splice(i, 1); renderConditions(); }
function cfgMoveCond(i, d) {
  var j = i + d;
  if (j < 0 || j >= _W.documents.conditions.length) return;
  var tmp = _W.documents.conditions[i];
  _W.documents.conditions[i] = _W.documents.conditions[j];
  _W.documents.conditions[j] = tmp;
  renderConditions();
}
function cfgResetConds() {
  if (!confirm('Remplacer tes articles par les 12 articles par defaut ?')) return;
  _W.documents.conditions = clone(CONDITIONS_DEFAUT);
  renderConditions();
}

function tabCatalogue() {
  return '' +
    '<div class="sites-legal" style="margin-bottom:10px">Le catalogue alimente le menu deroulant du devis. Modifie les prix ici, ils suivent partout.</div>' +
    '<div class="lbl" style="margin-bottom:6px">Prestations ponctuelles</div>' +
    '<div id="cfg-cat"></div>' +
    '<button class="btn bg bsm" style="margin-top:6px" onclick="cfgAddCat(0)">+ Ajouter une prestation</button>' +
    '<div class="lbl" style="margin:14px 0 6px">Prestations recurrentes (par mois)</div>' +
    '<div id="cfg-catr"></div>' +
    '<button class="btn bg bsm" style="margin-top:6px" onclick="cfgAddCat(1)">+ Ajouter une prestation mensuelle</button>';
}
function renderCatalogue() {
  [['cfg-cat', 'catalogue', 0], ['cfg-catr', 'catalogue_recurrent', 1]].forEach(function (spec) {
    var host = document.getElementById(spec[0]);
    if (!host) return;
    host.innerHTML = _W[spec[1]].map(function (c, i) {
      return '<div style="display:grid;grid-template-columns:1fr 110px 28px;gap:6px;margin-bottom:5px">' +
        '<input value="' + esc(c.label) + '" oninput="cfgCatEdit(' + spec[2] + ',' + i + ',\'label\',this.value)">' +
        '<input type="number" step="5" value="' + n(c.prix) + '" oninput="cfgCatEdit(' + spec[2] + ',' + i + ',\'prix\',this.value)">' +
        '<div class="dv-x" onclick="cfgDelCat(' + spec[2] + ',' + i + ')">&times;</div>' +
      '</div>';
    }).join('') || '<div class="empty">Vide</div>';
  });
}
function catKey(which) { return which ? 'catalogue_recurrent' : 'catalogue'; }
function cfgCatEdit(which, i, k, v) {
  var arr = _W[catKey(which)];
  if (arr[i]) arr[i][k] = (k === 'prix') ? n(v) : v;
}
function cfgAddCat(which) { _W[catKey(which)].push({ label: '', prix: 0 }); renderCatalogue(); }
function cfgDelCat(which, i) { _W[catKey(which)].splice(i, 1); renderCatalogue(); }

function tabAuto() {
  var a = _W.automatismes;
  function sw(id, on, label, sub) {
    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--bd)">' +
      '<input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' style="width:16px;height:16px;margin-top:2px;accent-color:var(--ac)">' +
      '<label for="' + id + '" style="cursor:pointer;flex:1">' +
        '<div style="font-size:12px;color:var(--tx)">' + esc(label) + '</div>' +
        '<div style="font-size:10px;color:var(--mu2);margin-top:2px">' + esc(sub) + '</div>' +
      '</label></div>';
  }
  return '' +
    sw('ca-pdf', a.joindre_pdf, 'Joindre le PDF aux e-mails', 'Le devis-contrat ou la facture partent en piece jointe, pas seulement en lien.') +
    sw('ca-acompte', a.facture_acompte_auto, 'Creer la facture automatiquement a la signature', 'Des que le client signe, le brouillon de facture est pret (acompte, ou facture unique si 100 % a la commande).') +
    sw('ca-mail', a.email_auto_signature, 'Envoyer cette facture par e-mail automatiquement', 'A activer seulement quand tu es sur de tes coordonnees bancaires et de tes textes.') +
    sw('ca-relance', a.relance_auto, 'Programmer une relance a l\'emission d\'une facture', 'Un rappel est cree dans l\'agenda 3 jours apres l\'echeance.') +
    '<div class="sites-legal" style="margin-top:12px">L\'envoi d\'e-mail passe par <b>/api/send-email</b> (Resend). Si la cle n\'est pas configuree cote Vercel, l\'appli bascule automatiquement sur ta messagerie (mailto) sans rien perdre.</div>';
}

function cfgSetPct(v) {
  _W.facturation.acompte_pct_defaut = v;
  cfgTab('modele');
}

function val(id, dflt) {
  var e = document.getElementById(id);
  return e ? e.value : (dflt || '');
}
function chk(id) { var e = document.getElementById(id); return e ? !!e.checked : false; }

// Recupere les champs de l'onglet actuellement affiche (les autres sont deja dans _W)
function collect() {
  if (document.getElementById('ce-nom')) {
    _W.entreprise.nom_commercial = val('ce-nom').trim();
    _W.entreprise.exploitant = val('ce-exploitant').trim();
    _W.entreprise.forme = val('ce-forme').trim();
    _W.entreprise.baseline = val('ce-baseline').trim();
    _W.entreprise.adresse = val('ce-adresse').trim();
    _W.entreprise.siret = val('ce-siret').trim();
    _W.entreprise.ape = val('ce-ape').trim();
    _W.entreprise.site = val('ce-site').trim();
    _W.entreprise.email = val('ce-email').trim();
    _W.entreprise.tel = val('ce-tel').trim();
    _W.entreprise.tva = val('ce-tva').trim();
  }
  if (document.getElementById('cb-iban')) {
    _W.paiement.titulaire = val('cb-titulaire').trim();
    _W.paiement.banque = val('cb-banque').trim();
    _W.paiement.iban = val('cb-iban').trim();
    _W.paiement.bic = val('cb-bic').trim();
    _W.paiement.autres = val('cb-autres').trim();
    _W.facturation.penalites = val('cb-penalites').trim();
  }
  if (document.getElementById('cf-pct')) {
    _W.facturation.acompte_pct_defaut = Math.max(0, Math.min(100, n(val('cf-pct'))));
    _W.facturation.validite_devis_j = Math.max(1, n(val('cf-validite')) || 30);
    _W.facturation.delai_acompte_j = Math.max(0, n(val('cf-delai-ac')));
    _W.facturation.delai_solde_j = Math.max(0, n(val('cf-delai-sd')));
  }
  if (document.getElementById('ct-argu')) {
    _W.documents.devis_argumentaire = val('ct-argu');
    _W.documents.devis_pied = val('ct-pied-devis');
    _W.documents.facture_pied = val('ct-pied-facture');
    _W.documents.email_devis = val('ct-mail-devis');
    _W.documents.email_facture = val('ct-mail-facture');
    _W.documents.email_relance = val('ct-mail-relance');
    _W.documents.email_livraison = val('ct-mail-livraison');
  }
  if (document.getElementById('ca-pdf')) {
    _W.automatismes.joindre_pdf = chk('ca-pdf');
    _W.automatismes.facture_acompte_auto = chk('ca-acompte');
    _W.automatismes.email_auto_signature = chk('ca-mail');
    _W.automatismes.relance_auto = chk('ca-relance');
  }
  // catalogue et conditions sont deja synchronises dans _W a la frappe
  _W.catalogue = _W.catalogue.filter(function (c) { return (c.label || '').trim(); });
  _W.catalogue_recurrent = _W.catalogue_recurrent.filter(function (c) { return (c.label || '').trim(); });
  _W.documents.conditions = _W.documents.conditions.filter(function (a) { return (a.t || '').trim() || (a.b || '').trim(); });
}

async function cfgSave() {
  collect();
  var sb = window.NOV_SB ? window.NOV_SB() : null;
  var r = await save(sb, _W);
  if (r.ok) toast('Parametres enregistres', 's');
  else if (r.reason === 'offline') toast('Enregistre localement (hors ligne)', 'w');
  else toast('Enregistre sur ce navigateur. Base : ' + r.reason, 'w');
  window.closeMo();
  if (window.refreshCurrent) window.refreshCurrent();
}

// ═══════════════════════════════════════════════════════════════════
// EXPOSITION
// ═══════════════════════════════════════════════════════════════════
window.NOVCFG = {
  DEFAULTS: DEFAULTS,
  CONDITIONS_DEFAUT: CONDITIONS_DEFAUT,
  CESSION: CESSION,
  get: function () { return CFG; },
  ent: function () { return CFG.entreprise; },
  pay: function () { return CFG.paiement; },
  fac: function () { return CFG.facturation; },
  doc: function () { return CFG.documents; },
  auto: function () { return CFG.automatismes; },
  catalogue: function () { return CFG.catalogue; },
  catalogueRecurrent: function () { return CFG.catalogue_recurrent; },
  load: load,
  save: save,
  loaded: function () { return _loaded; },
  tableOK: function () { return _tableOK; },
  manques: manques,
  defaultPct: defaultPct,
  pctOf: pctOf,
  planFor: planFor,
  planLabel: planLabel,
  echeancierPhrase: echeancierPhrase,
  echeancierCourt: echeancierCourt,
  etapesTexte: etapesTexte,
  conditions: conditions,
  argumentaireLines: argumentaireLines,
  fill: fill,
  openSettings: openSettings
};

// Cache local lu immediatement : toute page incluant ce script dispose des
// derniers parametres connus, sans attendre la base.
loadLocal();

// handlers appeles depuis le HTML genere
window.openSettings  = openSettings;
window.cfgTab        = cfgTab;
window.cfgSave       = cfgSave;
window.cfgSetPct     = cfgSetPct;
window.cfgCondEdit   = cfgCondEdit;
window.cfgAddCond    = cfgAddCond;
window.cfgDelCond    = cfgDelCond;
window.cfgMoveCond   = cfgMoveCond;
window.cfgResetConds = cfgResetConds;
window.cfgCatEdit    = cfgCatEdit;
window.cfgAddCat     = cfgAddCat;
window.cfgDelCat     = cfgDelCat;

})();
