// lib/chasse/nd-moteur.js — MOTEUR « NOUVEAUX DOMAINES » (repris de novalem-app, octobre 2026)
// Chaque jour, l'Afnic publie la liste de tous les .fr crees la veille
// (open data, reutilisation commerciale autorisee). Ce moteur :
//   1. lit la liste du jour (≈ 5 000 noms),
//   2. ecarte le bruit (suites de chiffres, jeux, crypto...),
//   3. cherche chaque nom dans l'annuaire officiel des entreprises
//      (recherche-entreprises.api.gouv.fr), UNIQUEMENT en Guadeloupe,
//      Martinique, Saint-Barthelemy et Saint-Martin,
//   4. pour les entreprises trouvees (et les noms qui sentent les Antilles),
//      regarde ce qu'il y a derriere le domaine (rien, page d'attente du
//      registrar, site en construction, vrai site), le mail, et le numero
//      sur Google,
//   5. donne une note sur 100 et la raison, sans jamais rien jeter en silence.
// Utilise par lib/jobs/domaines.js (et lire_page / enrichissement). Aucune cle requise pour l'Afnic et l'annuaire.
'use strict';

const dnsP = require('dns').promises;
const { domainToUnicode } = require('url');
const M = require('./nd-mots');

const AFNIC = function (ymd) { return 'https://www.afnic.fr/wp-media/ftp/domaineTLD_Afnic/' + ymd + '_CREA_fr.txt'; };
const SIRENE = 'https://recherche-entreprises.api.gouv.fr/search';
const PLACES = 'https://places.googleapis.com/v1/places:searchText';
const DEPTS = '971,972,977,978';
const DEPTS_OK = new Set(['971', '972', '977', '978']);
const UA_API = 'LaTour/1.0 (Novalemo, Antilles; contact@studionovalem.fr)';
const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Rectangles des iles (Google) par departement
const BOITES = {
  '971': { low: { latitude: 15.80, longitude: -61.85 }, high: { latitude: 16.55, longitude: -60.95 } },
  '972': { low: { latitude: 14.35, longitude: -61.25 }, high: { latitude: 14.90, longitude: -60.78 } },
  '977': { low: { latitude: 17.85, longitude: -62.92 }, high: { latitude: 17.98, longitude: -62.77 } },
  '978': { low: { latitude: 18.00, longitude: -63.16 }, high: { latitude: 18.13, longitude: -62.96 } }
};
const ILE_DE_DEPT = { '971': 'GP', '972': 'MQ', '977': 'NORD', '978': 'NORD' };

/* ── texte ─────────────────────────────────────────────── */
function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function squash(s) { return sansAccents(s).replace(/[^a-z0-9]/g, ''); }
function titre(s) { return String(s || '').toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); }); }

/* ── dictionnaire (decoupage des noms colles) ───────────── */
let DICO = null;
function dico() {
  if (DICO) return DICO;
  const set = new Set();
  const norm = function (w) { return sansAccents(w).replace(/[^a-z]/g, ''); };
  const grand = function (w) { const n = norm(w); if (n.length >= 4 && n.length <= 24) set.add(n); };   // gros dictionnaires : 4 lettres et plus
  const choisi = function (w) { const n = norm(w); if (n.length >= 2 && n.length <= 24) set.add(n); };  // nos listes : tout
  try { require('an-array-of-french-words').forEach(grand); } catch (e) { /* dictionnaire absent : decoupage plus grossier */ }
  try { require('an-array-of-english-words').forEach(grand); } catch (e) { /* idem */ }
  M.MOTS_METIER.forEach(choisi); M.MOTS_LOCAUX.forEach(choisi); M.PRENOMS.forEach(choisi); M.NOMS.forEach(choisi); M.COURTS.forEach(choisi);
  DICO = set;
  return set;
}
// Nos listes (metiers, mots d'ici, prenoms, noms, petits mots choisis) : prioritaires sur les mots rares du dictionnaire
let PRIO = null;
function prio() {
  if (PRIO) return PRIO;
  PRIO = new Set([].concat(M.MOTS_METIER, M.MOTS_LOCAUX, M.PRENOMS, M.NOMS, M.COURTS).map(function (w) { return squash(w); }));
  return PRIO;
}
const COLLES = { dela: ['de', 'la'], delas: ['de', 'las'], dulac: ['du', 'lac'] };

// Decoupe un mot colle en mots connus, au moindre cout (moins de morceaux,
// petits morceaux penalises, lettres inconnues cheres). Si le resultat
// ressemble a du hachis (une lettre seule, plusieurs bouts de 2 lettres),
// on garde le mot entier : c'est souvent un nom propre ("financia", "undecies").
function decouper(mot) {
  const s = String(mot || '');
  const n = s.length, D = dico(), P = prio();
  if (n <= 3 || D.has(s)) return [s];
  const best = new Array(n + 1).fill(Infinity), prev = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - 24); j < i; j++) {
      if (best[j] === Infinity) continue;
      const p = s.slice(j, i), L = i - j;
      let c;
      if (L >= 2 && D.has(p)) c = 1 + (L === 2 ? 1.2 : (L === 3 ? 0.6 : 0)) - (P.has(p) ? 0.6 : 0);
      else c = 2 + 1.6 * L + (L <= 3 ? 4 : 0);                            // petit bout inconnu = presque toujours du hachis
      if (best[j] + c < best[i]) { best[i] = best[j] + c; prev[i] = j; }
    }
  }
  const out = [];
  let i = n;
  while (i > 0) { const j = prev[i]; out.unshift(s.slice(j, i)); i = j; }
  const deuxLettres = out.filter(function (p) { return p.length === 2 && !M.MOTS_VIDES.has(p); }).length;
  const hachis = out.some(function (p) { return p.length === 1 || (p.length <= 3 && !D.has(p)); });
  if (hachis || deuxLettres > 1) return [s];
  return [].concat.apply([], out.map(function (p) { return COLLES[p] || [p]; }));
}

/* ── liste Afnic ────────────────────────────────────────── */
function parseAfnic(texte) {
  const out = [], vus = new Set();
  String(texte || '').split(/\r?\n/).forEach(function (l) {
    const d = l.trim().toLowerCase();
    if (!d || d[0] === '#') return;
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+fr$/.test(d) || d.length > 80) return;   // lettres, chiffres, tirets (les noms accentues arrivent en xn--)
    if (!vus.has(d)) { vus.add(d); out.push(d); }
  });
  return out;
}

// Dates au format de l'Afnic (jour de Paris)
function jourParis(decalage) {
  const d = new Date(Date.now() + (decalage || 0) * 86400000);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }); // YYYY-MM-DD
}
function ymd(iso) { return String(iso).replace(/-/g, ''); }

/* ── tri de premier niveau (sans reseau) ────────────────── */
const BRUIT = /(casino|poker|1xbet|1win|bitcoin|crypto|porn|xxx|escort|viagra|cialis|onlyfans|sexe|sexy|forex|trading|paris-sportif|parissportif)/;
function prefiltre(domaine) {
  let label = String(domaine || '').toLowerCase().replace(/\.fr$/, '');
  if (label.indexOf('xn--') === 0) { try { label = domainToUnicode(domaine).replace(/\.fr$/, ''); } catch (e) { /* garde tel quel */ } }
  const n = sansAccents(label);
  const sq = n.replace(/[^a-z0-9]/g, '');
  if (sq.length < 3) return { ok: false, raison: 'nom trop court' };
  if (/^0x[0-9a-f]{6,}/.test(sq) || /^[0-9a-f]{16,}$/.test(sq)) return { ok: false, raison: 'suite de caracteres' };
  if ((sq.replace(/97[1278]\d\d/, '').match(/\d/g) || []).length >= 5) return { ok: false, raison: 'trop de chiffres' };
  if (sq.length > 42) return { ok: false, raison: 'nom trop long' };
  if (BRUIT.test(n)) return { ok: false, raison: 'hors cible (jeux, crypto, adulte)' };
  const nums = n.match(/\d+/g) || [];
  if (nums.some(function (x) { const v = parseInt(x, 10); return (x.length === 2 && v >= 1 && v <= 95) || /^97[3-6]$/.test(x) || (x.length === 5 && !/^97[1278]/.test(x)); })) {
    return { ok: false, raison: 'numéro de département hors Antilles dans le nom' };
  }
  if (/^[bcdfghjklmnpqrstvwxz]{7,}$/.test(sq)) return { ok: false, raison: 'pas un nom lisible' };
  return { ok: true, label: n };
}

// Mots du nom de domaine : tirets, chiffres, puis decoupage des mots colles
function tokens(label) {
  const out = [];
  sansAccents(label).split(/[^a-z0-9]+/).filter(Boolean).forEach(function (p) {
    p.split(/(\d+)/).filter(Boolean).forEach(function (s) {
      if (/^\d+$/.test(s)) { out.push(s); return; }
      decouper(s).forEach(function (t) { out.push(t); });
    });
  });
  return out;
}

// Reperes locaux dans le nom (Guadeloupe, Martinique, Iles du Nord, Antilles)
function signaux(label, toks) {
  const sq = squash(label), out = [], vus = new Set();
  const tset = new Set((toks || tokens(label)).concat(sansAccents(label).split(/[^a-z0-9]+/)));
  M.SIGNAUX.forEach(function (s) {
    const ok = s[2] === 'sub' ? sq.indexOf(s[0]) >= 0 : tset.has(s[0]);
    if (ok && !vus.has(s[0])) { vus.add(s[0]); out.push({ mot: s[0], ile: s[1] }); }
  });
  return out;
}
function estLocal(t) { return M.SIGNAUX.some(function (s) { return s[0] === t; }) || M.GENERIQUES.has(t) && /guadeloupe|gwada|antill|carai|caribb|martinique|madinina|matnik|karu/.test(t); }

// Requetes a envoyer a l'annuaire : tous les mots, puis sans les reperes locaux / chiffres
function requetes(toks) {
  const mots = toks.filter(function (t) { return t.length >= 2 && !M.MOTS_VIDES.has(t); });
  const q1 = mots.filter(function (t) { return !/^\d+$/.test(t) || t.length >= 3; }).join(' ');
  const coeur = mots.filter(function (t) { return !/^\d+$/.test(t) && !estLocal(t); });
  const q2 = coeur.join(' ');
  const out = [];
  const assez = function (q) { return q.replace(/[^a-z]/g, '').length >= 3; };       // "pm" seul : inutile de demander
  if (q1 && assez(q1)) out.push(q1);
  if (q2 && q2 !== q1 && coeur.length && assez(q2)) out.push(q2);
  return out;
}

/* ── correspondance nom de domaine <-> entreprise ───────── */
const FORMES_RE = /\b(sarl|sas|sasu|eurl|sa|sci|snc|earl|ei|eirl|selarl|selas|selasu|scp|scm|sca|ets|etablissements|societe|ste|cie|compagnie)\b/g;
function nomsEntreprise(r) {
  const noms = [];
  function push(s) { if (s && !/diffusible|\[nd\]/i.test(String(s))) noms.push(String(s).trim()); }
  push(r.nom_raison_sociale); push(r.sigle);
  const nc = String(r.nom_complet || '');
  push(nc.replace(/\(.*?\)/g, ' '));
  (nc.match(/\((.*?)\)/g) || []).forEach(function (x) { push(x.slice(1, -1)); });
  [r.siege].concat(r.matching_etablissements || []).filter(Boolean).forEach(function (e) {
    push(e.nom_commercial); (e.liste_enseignes || []).forEach(push);
  });
  return Array.from(new Set(noms.filter(Boolean)));
}
function normNom(s) {
  return sansAccents(s).replace(/[’'`´]s\b/g, 's').replace(/[’'`´]/g, ' ').replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, ' ').replace(FORMES_RE, ' ').replace(/\s+/g, ' ').trim();
}

// 3 = identique, 2 = fort (memes mots), 1 = proche (plusieurs mots en commun), 0 = non.
// Les mots du metier seul ("garage", "multiservices"), les mots generiques et les
// sigles de 3 lettres ne suffisent pas : ils ne prouvent pas que c'est la meme entreprise.
const METIERS_SEULS = new Set(M.MOTS_METIER.concat(['plombier', 'electricien', 'peintre', 'macon', 'menuisier', 'coiffeur', 'boulanger', 'restaurant', 'traiteur', 'fleuriste', 'garage', 'business', 'art', 'deco', 'decoration', 'concept', 'solution', 'solutions', 'contract']));
function singulier(t) { return t.length > 3 && /s$/.test(t) && !/ss$/.test(t) ? t.slice(0, -1) : t; }
function estMetier(t) { return METIERS_SEULS.has(t) || METIERS_SEULS.has(t + 's') || M.GENERIQUES.has(t); }
function coeurDe(mots) {
  return mots.filter(function (t) { return t.length >= 2 && !M.GENERIQUES.has(t) && !estLocal(t) && !/^\d+$/.test(t) && !M.MOTS_VIDES.has(t); })
    .map(singulier).filter(function (t) { return !M.GENERIQUES.has(t) && !estLocal(t); });
}
function force(label, toks, nom, local) {
  const n = normNom(nom), nsq = n.replace(/ /g, '');
  if (nsq.length < 3) return 0;
  const lsq = squash(label);
  if (nsq === lsq) return nsq.length >= 4 || local ? 3 : 0;                       // identique (un sigle de 3 lettres seul ne suffit pas)
  const lc = coeurDe(toks), nc = coeurDe(n.split(' '));
  if (!lc.length || !nc.length) return 0;
  const lj = lc.join(''), nj = nc.join('');
  const distinctif = lc.concat(nc).some(function (t) { return !estMetier(t); });
  if (lj === nj) {                                                                  // "allo-clim" = "ALLO CLIM SERVICE", "ifc-guadeloupe" = "IFC"
    if (!distinctif) return 0;                                                      // "3a-multiservices" != "J-C MULTISERVICES"
    if (lj.length >= 5 || (lj.length >= 3 && local)) return 2;
    return 0;
  }
  // un seul vrai mot en commun, metiers mis a part, et un repere local dans le domaine : "fournil-jarry" ~ "BOULANGERIE LE FOURNIL DE JARRY" (a verifier)
  const ld = lc.filter(function (t) { return !estMetier(t); }), nd = nc.filter(function (t) { return !estMetier(t); });
  if (local && ld.length === 1 && nd.length === 1 && ld[0] === nd[0] && ld[0].length >= 4) return 1;
  // memes mots, a quelques mots generiques pres : tous les mots du plus court sont dans le plus long
  const court = lc.length <= nc.length ? lc : nc, long = lc.length <= nc.length ? nc : lc;
  const commun = court.filter(function (t) { return long.indexOf(t) >= 0; });
  const communDistinctif = commun.filter(function (t) { return !estMetier(t) && t.length >= 3; });
  if (commun.length === court.length && court.length >= 2 && communDistinctif.length >= 1) {
    // mots en plus dans le nom le plus long : les mots de metier ne comptent pas ("fournil jarry" = "BOULANGERIE PATISSERIE FOURNIL JARRY")
    const enPlus = long.filter(function (t) { return court.indexOf(t) < 0 && !estMetier(t); }).length;
    return enPlus <= 1 ? 2 : 1;
  }
  if (communDistinctif.length >= 2 && commun.length / long.length >= 0.6) return 1;
  return 0;
}
function meilleureEntreprise(label, toks, results, local) {
  let best = null;
  (results || []).forEach(function (r) {
    if (!r || r.etat_administratif === 'C') return;
    nomsEntreprise(r).forEach(function (nom) {
      const f = force(label, toks, nom, local);
      if (!f) return;
      const dep = (r.siege && r.siege.departement) || '';
      const bonus = (DEPTS_OK.has(dep) ? 0.2 : 0);
      if (!best || f + bonus > best.f + best.bonus) best = { r: r, f: f, bonus: bonus, nom: nom };
    });
  });
  return best;
}

// Fiche compacte de l'entreprise trouvee (ce que la page affiche)
function depDe(e) { // departement d'un etablissement : code commune INSEE (97701 = Saint-Barthelemy, 97801 = Saint-Martin), sinon code postal
  const c = String((e && e.commune) || '');
  if (/^97\d{3}$/.test(c)) return c.slice(0, 3);
  if (e && e.departement) return String(e.departement);
  const cp = String((e && e.code_postal) || '');
  return /^97/.test(cp) ? cp.slice(0, 3) : cp.slice(0, 2);
}
function ficheEntreprise(m) {
  const r = m.r, s = r.siege || {};
  const et = (r.matching_etablissements || []).find(function (e) { return DEPTS_OK.has(depDe(e)); }) || s;
  const cp = String(et.code_postal || s.code_postal || '');
  const dep = depDe(et);
  // l'annuaire liste aussi les commissaires aux comptes : ce ne sont pas les dirigeants (Louis appelait le mauvais interlocuteur)
  const dirs = (r.dirigeants || []).filter(function (d) { return !/commissaire/i.test(String(d.qualite || '')); });
  const dir = dirs.find(function (d) { return d.type_dirigeant === 'personne physique' && d.nom; }) || dirs[0] || null;
  let dirigeant = null;
  if (dir) dirigeant = dir.nom ? (titre(String(dir.prenoms || '').split(' ')[0]) + ' ' + String(dir.nom).toUpperCase()).trim() : (dir.denomination || null);
  const personne = !!(dir && dir.nom && dir.type_dirigeant !== 'personne morale');
  const enseigne = (et.liste_enseignes && et.liste_enseignes[0]) || et.nom_commercial || s.nom_commercial || null;
  const naf = r.activite_principale || s.activite_principale || '';
  return {
    siren: r.siren, siret: et.siret || s.siret || null,
    nom: titre(normNomAffiche(enseigne || r.nom_raison_sociale || r.nom_complet)),
    raison_sociale: r.nom_raison_sociale || r.nom_complet || null,
    forme: M.FORMES_JURIDIQUES[r.nature_juridique] || null, nature: r.nature_juridique || null,
    naf: naf || null, activite: M.NAF[String(naf).slice(0, 2)] || null,
    cree_le: r.date_creation || null, categorie: r.categorie_entreprise || null,
    commune: titre(et.libelle_commune || s.libelle_commune || ''), cp: cp || null, dep: dep || null, ile: ILE_DE_DEPT[dep] || null,
    siege_dep: depDe(s) || null, adresse: et.adresse || s.adresse || null,
    dirigeant: dirigeant, dirigeant_personne: personne, qualite: dir ? (dir.qualite || null) : null,
    etablissements: r.nombre_etablissements_ouverts || r.nombre_etablissements || null,
    match: m.f >= 3 ? 'identique' : (m.f >= 2 ? 'fort' : 'proche'), nom_trouve: m.nom
  };
}
function normNomAffiche(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

/* ── ce qu'il y a derriere le domaine ───────────────────── */
const FOURNISSEURS = [
  [/ovh/i, 'OVHcloud'], [/ionos|1and1|1&1/i, 'IONOS'], [/hostinger/i, 'Hostinger'], [/godaddy|secureserver|wsimg/i, 'GoDaddy'], [/gandi/i, 'Gandi'],
  [/\blws\b|lws\.fr|lws-hosting/i, 'LWS'], [/o2switch/i, 'o2switch'], [/namecheap/i, 'Namecheap'], [/infomaniak/i, 'Infomaniak'], [/planethoster/i, 'PlanetHoster'],
  [/amen\.fr|\bamen\b/i, 'Amen'], [/strato/i, 'Strato'], [/one\.com/i, 'one.com'], [/sedo|dan\.com|afternic|bodis|parkingcrew/i, 'plateforme de revente']
];
const OUTILS = [
  [/wix\.com|wixstatic|_wix/i, 'Wix'], [/squarespace/i, 'Squarespace'], [/shopify|cdn\.shopify/i, 'Shopify'], [/webflow/i, 'Webflow'],
  [/wp-content|wordpress/i, 'WordPress'], [/jimdo/i, 'Jimdo'], [/zyro|hostinger-website/i, 'Hostinger Builder'], [/img1\.wsimg|godaddy.*website/i, 'GoDaddy Builder'],
  [/weebly/i, 'Weebly'], [/site123/i, 'Site123'], [/e-monsite/i, 'e-monsite'], [/webnode/i, 'Webnode'], [/framer\.(com|website)/i, 'Framer'],
  [/canva\.site|my\.canva/i, 'Canva'], [/sites\.google/i, 'Google Sites'], [/carrd\.co/i, 'Carrd'], [/systeme\.io/i, 'systeme.io']
];
const PARKING = [
  /(nom de )?domaine[^.<]{0,80}(parqu|enregistr|r[ée]serv|achet|cr[ée][ée] chez|h[ée]berg[ée] chez|en vente|[àa] vendre)/i,
  /domain[^.<]{0,60}(parked|registered|reserved|for sale|is available|has been (registered|purchased))/i,
  /parked (free|domain)|domain parking|parking page|this web page is parked/i,
  /f[ée]licitations[^.<]{0,120}(domaine|site|h[ée]bergement)/i, /congratulations[^.<]{0,80}(domain|website)/i,
  /buy this domain|acheter ce (nom de )?domaine|make an offer/i
];
const CONSTRUCTION = /site (web |internet )?en (construction|cours de (construction|cr[ée]ation))|en construction|coming soon|bient[ôo]t (en ligne|disponible|ici)|under construction|page d.attente|maintenance en cours|we.?ll be back|launching soon|ouverture prochaine/i;
const REDIR_SOCIAL = /(facebook\.com|fb\.me|instagram\.com|linktr\.ee|tiktok\.com|wa\.me|whatsapp\.com|linkedin\.com|youtube\.com|google\.com\/maps|goo\.gl)/i;

function texteDe(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();
}
function titreDe(html) { const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m ? texteDe(m[1]).slice(0, 120) : ''; }

const MAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const MAIL_BIDON = /(example|exemple|@domain\.|@(e?mail|domaine?|site|test)\.(com|fr)$|votre.?(mail|adresse|email)|your.?(email|mail)|^(nom|prenom|name|user|test)@|sentry|wixpress|@2x|\.(png|jpe?g|gif|webp|svg|css|js)$|@(ovh|ionos|hostinger|godaddy|gandi|lws|o2switch|namecheap|infomaniak)\.|^(support|abuse|noreply|no-reply|postmaster|hostmaster)@)/i;
function extraireEmails(html, domaine) {
  const vus = new Set(), out = [];
  (String(html || '').match(MAIL_RE) || []).forEach(function (e) {
    const x = e.toLowerCase().replace(/^mailto:/, '');
    if (MAIL_BIDON.test(x) || vus.has(x)) return;
    vus.add(x); out.push(x);
  });
  const dom = String(domaine || '').toLowerCase();
  out.sort(function (a, b) { return (b.endsWith('@' + dom) ? 1 : 0) - (a.endsWith('@' + dom) ? 1 : 0); });
  return out.slice(0, 3);
}
const TEL_RE = /(?:\+|00)(?:33|590|596|594|262)[\s.-]?\(?0?\)?[\s.-]?[1-9](?:[\s.-]?\d{2}){4}|\b0[1-9](?:[\s.-]?\d{2}){4}\b/g;
function extraireTels(texte) {
  const vus = new Set(), out = [];
  (String(texte || '').match(TEL_RE) || []).forEach(function (t) {
    const d = t.replace(/\D/g, '');
    if (vus.has(d)) return;
    vus.add(d); out.push(t.trim());
  });
  return out.slice(0, 3);
}

// Les contacts vus sur la page ne comptent que s'ils sont ceux de l'entreprise : jamais ceux d'une page de registrar,
// d'un autre site, ni ceux d'une agence qui signe la page « en construction » (mail a son nom de domaine ou webmail seulement)
const WEBMAIL = /^(gmail\.com|googlemail\.com|hotmail\.(fr|com)|outlook\.(fr|com)|live\.(fr|com)|msn\.com|yahoo\.(fr|com)|icloud\.com|me\.com|orange\.fr|wanadoo\.fr|free\.fr|sfr\.fr|neuf\.fr|laposte\.net|aol\.com|proton(mail)?\.(com|me)|gmx\.(fr|com))$/;
function contactsAElle(base, domaine) {
  if (base.etat === 'parking' || base.etat === 'redirection' || base.etat === 'reseau' || base.etat === 'erreur') { base.emails = []; base.tels = []; return base; }
  base.emails = (base.emails || []).filter(function (e) { const d = e.split('@')[1] || ''; return d === domaine || d.endsWith('.' + domaine) || WEBMAIL.test(d); });
  if (base.etat === 'construction') base.tels = [];
  return base;
}

// Classe ce que montre le domaine : rien / redirection / parking / construction / vide / site
function classerSite(html, statut, urlFinale, domaine) {
  return contactsAElle(classerBrut(html, statut, urlFinale, domaine), domaine);
}
function classerBrut(html, statut, urlFinale, domaine) {
  const texte = texteDe(html), t = titreDe(html);
  const brut = String(html || '');
  let fournisseur = null, outil = null;
  for (const f of FOURNISSEURS) { if (f[0].test(brut.slice(0, 60000))) { fournisseur = f[1]; break; } }
  for (const o of OUTILS) { if (o[0].test(brut.slice(0, 120000))) { outil = o[1]; break; } }
  const hote = (function () { try { return new URL(urlFinale).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
  const base = { titre: t || null, url: urlFinale || null, http: statut || null, fournisseur: fournisseur, outil: outil, emails: extraireEmails(brut, domaine), tels: extraireTels(texte) };
  if (hote && hote !== domaine && !hote.endsWith('.' + domaine)) {
    base.etat = REDIR_SOCIAL.test(hote) ? 'reseau' : 'redirection';
    base.vers = hote;
    return base;
  }
  if (!statut || statut >= 400) { base.etat = 'erreur'; return base; }
  const echantillon = (t + ' ' + texte.slice(0, 3000));
  if (PARKING.some(function (re) { return re.test(echantillon); })) { base.etat = 'parking'; return base; }
  if (CONSTRUCTION.test(echantillon)) { base.etat = 'construction'; return base; }
  const appli = /id=["'](root|app|__next|__nuxt|svelte)["']/i.test(brut) || brut.length > 40000; // site en JavaScript : peu de texte cote serveur
  if (texte.length < 250 && !appli && !outil) { base.etat = 'vide'; return base; }
  base.etat = 'site';
  return base;
}

/* ── reseau ─────────────────────────────────────────────── */
function avecDelai(p, ms, valeur) {
  let t;
  return Promise.race([p, new Promise(function (res) { t = setTimeout(function () { res(valeur); }, ms); })]).finally(function () { clearTimeout(t); });
}
async function lireTexte(r, max) {
  if (!r.body || !r.body.getReader) { const t = await r.text(); return t.slice(0, max); }
  const lecteur = r.body.getReader(), dec = new TextDecoder('utf-8', { fatal: false });
  let out = '', total = 0;
  while (total < max) {
    const x = await lecteur.read();
    if (x.done) break;
    total += x.value.length; out += dec.decode(x.value, { stream: true });
  }
  try { lecteur.cancel(); } catch (e) { /* rien */ }
  return out.slice(0, max);
}

// Cadence : jamais plus de N appels par seconde vers l'annuaire (limite publique : 7/s)
function cadence(msEntre) {
  let prochain = 0;
  return async function () {
    const maintenant = Date.now();
    const attente = Math.max(0, prochain - maintenant);
    prochain = Math.max(maintenant, prochain) + msEntre;
    if (attente) await new Promise(function (r) { setTimeout(r, attente); });
  };
}

async function telechargerAfnic(isoJour, fetchFn) {
  const f = fetchFn || fetch;
  const r = await f(AFNIC(ymd(isoJour)), { headers: { 'User-Agent': UA_API }, signal: AbortSignal.timeout(20000) });
  if (r.status === 404) return { absent: true, domaines: [] };
  if (!r.ok) throw new Error('Afnic HTTP ' + r.status);
  const domaines = parseAfnic(await r.text());
  if (!domaines.length) return { absent: true, domaines: [] };      // page d'erreur servie en 200 : on retentera
  return { absent: false, domaines: domaines };
}

function assezDeTemps(limite) { if (limite && Date.now() > limite) throw new Error('temps écoulé, repris au passage suivant'); }
async function chercherSirene(q, fetchFn, attendre, limite, departements) {
  const f = fetchFn || fetch;
  const url = SIRENE + '?q=' + encodeURIComponent(q) + '&departement=' + (departements || DEPTS) + '&etat_administratif=A&per_page=5&minimal=true&include=siege,dirigeants,matching_etablissements';
  for (let essai = 0; essai < 4; essai++) {
    assezDeTemps(limite);
    if (attendre) await attendre();
    let r;
    try { r = await f(url, { headers: { 'User-Agent': UA_API, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }); }
    catch (e) { if (essai === 3) throw e; await new Promise(function (ok) { setTimeout(ok, 800 * (essai + 1)); }); continue; }
    if (r.status === 429 || r.status >= 500) {
      const ra = parseFloat(r.headers && r.headers.get ? r.headers.get('retry-after') : '') || (essai + 1);
      await new Promise(function (ok) { setTimeout(ok, Math.min(8, ra) * 1000); });
      continue;
    }
    if (!r.ok) throw new Error('Annuaire HTTP ' + r.status);           // 400 compris : la requete est toujours propre, un refus doit se voir
    const d = await r.json();
    return d.results || [];
  }
  throw new Error('Annuaire sature (429)');
}

async function aUneIp(hote) {
  const ip = await avecDelai(dnsP.resolve4(hote).catch(function () { return null; }), 4000, null);
  if (ip && ip.length) return true;
  const ip6 = await avecDelai(dnsP.resolve6(hote).catch(function () { return null; }), 3000, null);
  return !!(ip6 && ip6.length);
}
// Combien d'entreprises actives portent ce nom dans toute la France ? (un nom rare = une piste sure)
async function compterSirene(q, fetchFn, attendre, limite) {
  const f = fetchFn || fetch;
  const url = SIRENE + '?q=' + encodeURIComponent(q) + '&etat_administratif=A&per_page=1&minimal=true';
  for (let essai = 0; essai < 3; essai++) {
    assezDeTemps(limite);
    if (attendre) await attendre();
    let r;
    try { r = await f(url, { headers: { 'User-Agent': UA_API, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }); }
    catch (e) { continue; }
    if (r.status === 429 || r.status >= 500) { await new Promise(function (ok) { setTimeout(ok, 1500 * (essai + 1)); }); continue; }
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d.total_results === 'number' ? d.total_results : null;
  }
  return null;
}

// Jamais d'adresse interne : un nom de domaine peut pointer (ou rediriger) vers 127.0.0.1 ou un reseau prive
function ipPrivee(ip) {
  return /^(0|10|127)\./.test(ip) || /^169\.254\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) || /^(::|f[cd]|fe[89ab])/i.test(ip);
}
async function hotePublic(h) {
  h = String(h || '').toLowerCase();
  if (!h || h === 'localhost' || /\.(local|internal|localhost)$/.test(h) || h.indexOf(':') >= 0 || h.indexOf('[') >= 0) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return !ipPrivee(h);
  const v4 = await avecDelai(dnsP.resolve4(h).catch(function () { return []; }), 4000, []);
  const v6 = v4.length ? [] : await avecDelai(dnsP.resolve6(h).catch(function () { return []; }), 3000, []);
  const ips = v4.concat(v6);
  return ips.length > 0 && !ips.some(ipPrivee);
}
function sansSite(etat, en_plus) { return Object.assign({ etat: etat, titre: null, url: null, http: null, fournisseur: null, outil: null, emails: [], tels: [] }, en_plus || {}); }
async function verifierSite(domaine, fetchFn) {
  const f = fetchFn || fetch;
  const apex = await aUneIp(domaine);
  const www = apex ? false : await aUneIp('www.' + domaine);
  if (!apex && !www) return sansSite('rien');
  const h = apex ? domaine : 'www.' + domaine;
  for (const depart of ['https://' + h + '/', 'http://' + h + '/']) {
    try {
      const signal = AbortSignal.timeout(10000);
      let url = depart, r = null;
      for (let saut = 0; saut < 5; saut++) {
        const u = new URL(url), hote = u.hostname.toLowerCase().replace(/^www\./, '');
        if (hote !== domaine && !hote.endsWith('.' + domaine)) {         // renvoie ailleurs (Facebook, autre site) : on note ou, sans y aller
          return sansSite(REDIR_SOCIAL.test(u.hostname + u.pathname) ? 'reseau' : 'redirection', { url: url, vers: u.hostname.replace(/^www\./, '') });
        }
        if (!/^https?:$/.test(u.protocol) || u.port || u.username || !(await hotePublic(u.hostname))) return sansSite('erreur'); // adresse interne ou exotique : on ne visite pas
        r = await f(url, { redirect: 'manual', headers: { 'User-Agent': UA_WEB, Accept: 'text/html,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9' }, signal: signal });
        const loc = r.status >= 300 && r.status < 400 && r.headers && r.headers.get ? r.headers.get('location') : null;
        if (!loc) break;
        url = new URL(loc, url).href;
        try { if (r.body && r.body.cancel) r.body.cancel(); } catch (e) { /* rien */ }
      }
      if (!r || (r.status >= 300 && r.status < 400)) return sansSite('erreur');   // trop de redirections
      const html = await lireTexte(r, 300000);
      return classerSite(html, r.status, url, domaine);
    } catch (e) { /* essai suivant */ }
  }
  return sansSite('erreur');
}

async function lireMx(domaine) {
  const mx = await avecDelai(dnsP.resolveMx(domaine).catch(function () { return null; }), 4000, null);
  if (!mx || !mx.length) return { ok: false };
  mx.sort(function (a, b) { return a.priority - b.priority; });
  const h = String(mx[0].exchange || '').toLowerCase();
  let qui = null;
  if (/ovh/.test(h)) qui = 'OVH'; else if (/google|googlemail/.test(h)) qui = 'Google Workspace'; else if (/outlook|microsoft/.test(h)) qui = 'Microsoft 365';
  else if (/ionos|kundenserver|perfora/.test(h)) qui = 'IONOS'; else if (/hostinger/.test(h)) qui = 'Hostinger'; else if (/gandi/.test(h)) qui = 'Gandi';
  else if (/zoho/.test(h)) qui = 'Zoho'; else if (/o2switch/.test(h)) qui = 'o2switch'; else if (/lws/.test(h)) qui = 'LWS';
  return { ok: true, hote: h, qui: qui };
}

async function chercherGoogle(nom, commune, dep, cle, fetchFn, noms, domaine) {
  if (!cle || !nom) return null;
  const f = fetchFn || fetch;
  const body = { textQuery: (nom + ' ' + (commune || '')).trim(), pageSize: 3, languageCode: 'fr' };
  if (BOITES[dep]) body.locationRestriction = { rectangle: BOITES[dep] };
  const r = await f(PLACES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': cle, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus,places.primaryTypeDisplayName' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) return null;
  const d = await r.json();
  const candidats = (d.places || []).map(function (p) {
    const nomG = p.displayName ? p.displayName.text : '';
    const siteOk = p.websiteUri && domaine && String(p.websiteUri).toLowerCase().indexOf(domaine) >= 0;
    let fo = siteOk ? 3 : 0;
    (noms || [nom]).forEach(function (n) { fo = Math.max(fo, force(squash(n), tokens(n), nomG)); });
    return { p: p, fo: fo };
  }).filter(function (x) { return x.fo >= 1 && x.p.businessStatus !== 'CLOSED_PERMANENTLY'; });
  candidats.sort(function (a, b) { return b.fo - a.fo; });
  if (!candidats.length) return null;
  const p = candidats[0].p;
  return {
    place_id: p.id, nom: p.displayName ? p.displayName.text : null, tel: p.internationalPhoneNumber || null, site: p.websiteUri || null,
    maps: p.googleMapsUri || null, note: p.rating || null, avis: p.userRatingCount || 0, type: p.primaryTypeDisplayName ? p.primaryTypeDisplayName.text : null,
    adresse: p.formattedAddress || null
  };
}

/* ── la note sur 100 ────────────────────────────────────── */
function ageMois(iso) { if (!iso) return null; const t = Date.parse(iso); if (!t) return null; return (Date.now() - t) / (30.44 * 86400000); }
function noter(x) {
  const e = x.entreprise, s = x.site || {}, sig = x.signaux || [];
  let score = e ? 40 : 18, pourquoi = [];
  if (e) {
    if (e.match === 'identique') { score += 18; pourquoi.push('nom identique à l\'entreprise'); }
    else if (e.match === 'fort') { score += 12; pourquoi.push('nom très proche de l\'entreprise'); }
    else { score += 4; }
    const age = ageMois(e.cree_le);
    if (age != null && age <= 12) { score += 14; pourquoi.push('entreprise créée il y a moins d\'un an'); }
    else if (age != null && age <= 36) { score += 7; }
    if (e.dep === (x.prefere || '971')) score += 8; else if (e.dep) score += 4;
    if (e.homonymes != null && e.homonymes <= 3) { score += 8; pourquoi.push('nom rare (' + e.homonymes + ' en France)'); }
    else if (e.homonymes != null && e.homonymes > 10) { score -= 8; pourquoi.push('nom assez courant : vérifie que c\'est bien elle'); }
    if (e.siege_dep && !DEPTS_OK.has(e.siege_dep)) { score -= 18; pourquoi.push('siège hors Antilles'); }
    if (/^(92|93|94)/.test(String(e.nature || ''))) { score -= 25; pourquoi.push('association'); }
    // (SCI, administrations et grands groupes sont ecartes avant : voir analyser)
  }
  if (sig.length) { score += e ? 4 : 10; if (!e) pourquoi.push('nom qui sent les Antilles'); }
  const bonusSite = { rien: 16, parking: 16, construction: 12, vide: 12, reseau: 10, redirection: 2, erreur: 8, site: -14 };
  if (s.etat && bonusSite[s.etat] != null) score += bonusSite[s.etat];
  if (s.etat === 'rien' || s.etat === 'parking' || s.etat === 'vide') pourquoi.push('aucun site en ligne pour l\'instant');
  if (s.etat === 'construction') pourquoi.push('site annoncé « en construction »');
  if (s.etat === 'reseau') pourquoi.push('le domaine renvoie vers ses réseaux sociaux');
  if (s.etat === 'site') pourquoi.push('un site est déjà en ligne' + (s.outil ? ' (' + s.outil + ')' : ''));
  if (x.google && x.google.tel) score += 5;
  if ((s.emails && s.emails.length) || (x.mx && x.mx.ok)) score += 2;
  return { score: Math.max(1, Math.min(99, Math.round(score))), pourquoi: pourquoi };
}

/* ── analyse complete d'un domaine ──────────────────────── */
// ctx = { fetch, attendre (cadence annuaire), cleGoogle, googleRestant: {n} }
async function analyser(domaine, ctx) {
  ctx = ctx || {};
  const pf = prefiltre(domaine);
  if (!pf.ok) return { etape: 'ecarte', raison: pf.raison, score: 0, data: null };
  const toks = tokens(pf.label);
  const sig = signaux(pf.label, toks);
  const qs = requetes(toks);
  let m = null, requete = null;
  for (let i = 0; i < qs.length && !m; i++) {
    if (i > 0 && !sig.length && !/\d/.test(pf.label)) break;           // 2e essai seulement si on a retire des reperes locaux ou des chiffres
    const res = await chercherSirene(qs[i], ctx.fetch, ctx.attendre, ctx.limite, ctx.departements);
    requete = qs[i];
    m = meilleureEntreprise(pf.label, toks, res, sig.length > 0);
  }
  if (!m && !sig.length) return { etape: 'ecarte', raison: 'aucune entreprise à ce nom aux Antilles', score: 0, data: null };
  const x = { domaine: domaine, mots: toks.join(' '), requete: requete, signaux: sig, prefere: ctx.prefere || null };
  if (m) {
    const e = x.entreprise = ficheEntreprise(m);
    const vu = ', vu : ' + e.nom + (e.commune ? ' (' + e.commune + ')' : '');
    const ecarte = function (raison) { return { etape: 'ecarte', raison: raison + vu, score: 0, data: null }; };
    // Jamais clientes d'un site a 490 € : on les ecarte avec la raison (rien n'est jete en silence)
    if (/^654/.test(String(e.nature || ''))) return ecarte('SCI (société immobilière)');
    if (/^7/.test(String(e.nature || ''))) return ecarte('administration ou organisme public');
    if (e.categorie === 'GE' || e.categorie === 'ETI') return ecarte('grand groupe');
    const age = ageMois(e.cree_le);
    // Ressemblance partielle (quelques mots en commun) : on ne garde que si le nom sent les Antilles ou si l'entreprise a moins d'un an
    if (m.f < 2 && !sig.length && !(age != null && age <= 12)) return ecarte('ressemblance trop faible');
    // Le nom de domaine peut appartenir a une entreprise homonyme de metropole : on compte les homonymes.
    // Nom courant, entreprise ancienne et aucun repere local = trop de chances que ce soit quelqu'un d'autre.
    const homonymes = await compterSirene(requete, ctx.fetch, ctx.attendre, ctx.limite);
    e.homonymes = homonymes;
    const recente = age != null && age <= 6;
    const sigle = coeurDe(toks).join('').length <= 4;                  // "csdr", "stsm", "dpe-guadeloupe" : un sigle court se partage vite
    if (homonymes != null && !recente) {
      if (!sig.length && (homonymes > 25 || (homonymes > 6 && (m.f < 3 || sigle)))) return ecarte('nom trop courant (' + homonymes + ' entreprises en France)');
      if (sig.length && sigle && homonymes > 25) return ecarte('sigle trop courant (' + homonymes + ' entreprises en France)');
    }
  }
  assezDeTemps(ctx.limite);
  const r2 = await Promise.all([
    avecDelai(verifierSite(domaine, ctx.fetch).catch(function () { return sansSite('erreur'); }), 25000, sansSite('erreur')),
    lireMx(domaine).catch(function () { return { ok: false }; })
  ]);
  x.site = r2[0]; x.mx = r2[1];
  if (x.entreprise && ctx.cleGoogle && (!ctx.googleRestant || ctx.googleRestant.n > 0) && !(ctx.limite && Date.now() > ctx.limite)) {
    if (ctx.googleRestant) ctx.googleRestant.n--;
    try {
      const noms = nomsEntreprise(m.r).concat([x.entreprise.nom]);
      x.google = await chercherGoogle(x.entreprise.nom, x.entreprise.commune, x.entreprise.dep, ctx.cleGoogle, ctx.fetch, noms, domaine);
    } catch (e) { x.google = null; }
  }
  // l'adresse mail a utiliser : seulement celle vue sur le site (une adresse devinée rebondit une fois sur deux)
  const vue = (x.site.emails || [])[0];
  if (vue) x.email = { adresse: vue, source: 'site' };
  const n = noter(x);
  x.pourquoi = n.pourquoi;
  return { etape: 'lead', raison: x.entreprise ? 'entreprise' : 'signal', score: n.score, data: x };
}

module.exports = {
  parseAfnic, jourParis, ymd, prefiltre, compterSirene, tokens, decouper, signaux, requetes, nomsEntreprise, normNom, force, meilleureEntreprise, ficheEntreprise,
  classerSite, extraireEmails, extraireTels, noter, analyser, hotePublic, ipPrivee, telechargerAfnic, chercherSirene, verifierSite, lireMx, chercherGoogle, cadence, squash, sansAccents,
  texteDe, titreDe, lireTexte, avecDelai, contactsAElle, OUTILS, BOITES, UA_WEB
};
