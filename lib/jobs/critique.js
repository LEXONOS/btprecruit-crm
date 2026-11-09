// Miranda, critique : elle regarde chaque aperçu publié comme le prospect le verra (captures sur ordinateur et sur
// téléphone, prises par un vrai navigateur : api/regard.js) et le juge sans complaisance, sur Sonnet (Opus jusqu'au
// 9 nov. 2026). Seuls les aperçus qui vont partir par email sont jugés. Note sur 10 ; sous le seuil ou au moindre défaut
// bloquant, le site est refait : rubriques remplacées, palette ou photos changées, puis republié et regardé de nouveau
// (une reprise au plus). Un site sous le seuil d'envoi ne part pas chez le prospect. Ses verdicts sont clairs, précis, et
// rangés dans la fiche du site pour Louis.
'use strict';
const { appel, coutDe } = require('../claude');
const { MODELS } = require('../config');
const P = require('../sites/publication');
const R = require('../sites/rendu');
const B = require('../sites/rubriques');
const C = require('../sites/composition');
const DN = require('../sites/donne');
const PH = require('../sites/phase');
const { majFraiche } = require('../db');
const { court, minuitGP, jusquaDemainGP } = require('../util');

// à qui l'aperçu n'a pas encore été montré : il partira par email, ou Louis l'appellera (on peut encore le refaire) ;
// ceux qu'on ne joindra plus (sans contact, écartés, désinscrits, perdus) : leur site n'est plus regardé, personne ne le
// verra, rien n'est dépensé pour lui
const PAS_MONTRE = ['nouveau', 'a_contacter', 'a_appeler', 'brouillon'];
const INJOIGNABLE = ['sans_contact', 'ecarte', 'stop', 'perdu'];

// v2 (nov. 2026) : les templates, et les défauts relevés par Louis sur les 40 premiers aperçus (numéro géant, contact
// répété, rubriques de remplissage, fond noir, effets gadgets) deviennent bloquants
// v3 (nov. 2026) : les aperçus refaits (photo en haut dès qu'il y en a une, grand titre, hauts de page sans photo
// redessinés, plus d'information répétée) sont rejugés, avec de nouvelles reprises
// v4 (6 nov. 2026) : les défauts qu'elle relevait sur tous les sites sont corrigés dans le moteur (note Google montrée
// une fois, phrase du contact sans formule et fidèle aux moyens de joindre, numéros qui se suivent, grande tuile du
// bento avec sa photo, réponses de la FAQ ouvertes, pastilles lisibles, textes jamais coupés, adresses sans code Google,
// numéros en +596) et Léa v6 regarde aussi les photos de l'entreprise : tout est rejugé, avec de nouvelles reprises
const VERSION = 4;
const SEUIL = 8;
// une reprise au plus (9 nov. 2026 : deux reprises jugées chacune sur Opus, 293 jugements en 5 jours pour 16 emails)
const TOURS = 1;
// le modèle du jugement : Sonnet (9 nov. 2026 : Opus coûtait deux fois plus pour juger des aperçus que personne ne recevait)
const MODELE = 'smart';
// seuls les aperçus qui vont partir par email sont jugés : ceux des prospects à appeler ou pas encore triés attendent
const A_JUGER = ['a_contacter', 'brouillon'];
// sa part du budget IA du jour : la moitié au plus (un jugement coûte près de 0,07 $ ; Noé, Chloé, Emma et les autres
// doivent pouvoir travailler le même jour)
const PART_BUDGET = 0.5;
// l'ordre de la file : d'abord les aperçus qui partiront par email, puis ceux des prospects que Louis appellera
const PRIORITE = { a_contacter: 0, brouillon: 0, nouveau: 1, a_appeler: 2 };
// deux sites par passage au plus : le second ne commence que s'il reste le temps d'un regard et d'un jugement entiers
// (TEMPS_SITE), sans retarder la relève des emails ni les réponses d'Emma
const LOT = 2;
const TEMPS_SITE = 170000;
const CLE_REGARD = 'critique:regard';
const iso = function () { return new Date().toISOString(); };

/* ── le regard : la fonction api/regard.js de la tour ── */
function hoteTour() { return String(process.env.HQ_REGARD_HOTE || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'btprecruit-crm.vercel.app').replace(/^https?:\/\//, '').replace(/\/.*$/, ''); }
function branche() { return !!String(process.env.CRON_SECRET || '').trim() && process.env.HQ_REGARD !== 'non'; }
async function regarder(url) {
  const r = await fetch('https://' + hoteTour() + '/api/regard', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + String(process.env.CRON_SECRET || '').trim() }, body: JSON.stringify({ url: url }), signal: AbortSignal.timeout(75000) });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok || !j.ok) throw new Error('regard : ' + (j.error || ('HTTP ' + r.status)));
  // des captures illisibles ne partent jamais au jugement (l'API les refuserait, et on paierait pour rien)
  const lisible = function (b) { return typeof b === 'string' && b.length > 200 && b.slice(0, 4) === '/9j/' && /^[A-Za-z0-9+/]+={0,2}$/.test(b); };
  if (!j.ordinateur || !j.telephone || !lisible(j.ordinateur.haut) || !(j.ordinateur.morceaux || []).length || !(j.telephone.morceaux || []).length || !j.ordinateur.morceaux.concat(j.telephone.morceaux).every(lisible)) throw new Error('regard : captures illisibles');
  return j;
}

// la page en ligne d'un aperçu, lue par une simple requête (sans navigateur, en une seconde) : sa version, ou absente
// (pas dans le déploiement en ligne) ; null si on ne sait pas (le regard tranchera)
async function enLigne(url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Novalemo-Miranda/1.0' }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return { absent: true };
    if (!r.ok) return null;
    const m = /<meta\s+name="novalemo:version"\s+content="([^"]*)"/i.exec(String(await r.text()).slice(0, 40000));
    return { version: m ? m[1] : null };
  } catch (e) { return null; }
}

/* ── le jugement ── */
const ACTIONS = ['changer_rubriques', 'changer_palette', 'changer_photos', 'recomposer', 'changer_template'];
const OUTIL = {
  name: 'juger_site',
  description: 'Rends ton verdict sur ce site, une seule fois.',
  input_schema: { type: 'object', properties: {
    note: { type: 'number', description: 'Note sur 10 (demi-points permis). 8 = un site qu\'une agence haut de gamme livrerait fièrement. 9-10 = remarquable.' },
    verdict: { type: 'string', enum: ['valide', 'a_refaire'], description: 'valide seulement si la note est de 8 ou plus ET qu\'aucun défaut n\'est bloquant.' },
    resume: { type: 'string', description: 'Ton avis en deux ou trois phrases, net et précis, sans tiret long : ce qui va, ce qui ne va pas.' },
    points_forts: { type: 'array', maxItems: 3, items: { type: 'string' } },
    problemes: { type: 'array', maxItems: 8, items: { type: 'object', properties: {
      zone: { type: 'string', enum: ['en-tête', 'haut de page', 'bandeau', 'services', 'raisons', 'présentation', 'étapes', 'galerie', 'avis', 'infos', 'appel', 'questions', 'contact', 'pied', 'photos', 'typographie', 'couleurs', 'rythme', 'téléphone', 'textes'] },
      gravite: { type: 'string', enum: ['bloquant', 'important', 'detail'] },
      constat: { type: 'string', description: 'Ce que tu vois, précisément (où, quoi).' },
      variante: { type: 'string', description: 'Si une rubrique est en cause : son identifiant dans la composition donnée (ex. services.cartes), sinon vide.' }
    }, required: ['zone', 'gravite', 'constat'] } },
    actions: { type: 'array', items: { type: 'string', enum: ACTIONS }, description: 'Ce qu\'il faut faire pour le rattraper : changer_rubriques (les sections citées dans problemes.variante, remplacées dans le même template), changer_palette (couleurs ou lettres qui ne vont pas), changer_photos (photos hors sujet, laides ou répétées), changer_template ou recomposer (le design entier ne va pas à cette entreprise : un autre template).' }
  }, required: ['note', 'verdict', 'resume', 'problemes', 'actions'] }
};
const SYSTEME = 'Tu es Miranda, critique de sites internet chez Novalemo, studio qui vend des sites aux entreprises de Martinique (490 € ou 45 € par mois). Tu as l\'exigence d\'une rédactrice en chef de mode : rien de moyen ne passe. On te montre l\'aperçu d\'un site préparé pour un prospect, tel qu\'il le verra en ouvrant le lien : le premier écran sur ordinateur en net, puis toute la page sur ordinateur et sur téléphone, en captures fixes (les animations sont jouées, l\'état final est montré ; la barre flottante « Votre futur site » en bas, avec ses boutons Modifier et Je le prends, est le panneau de vente de Novalemo : normale, ignore-la).\n\nTA QUESTION : un patron de Martinique qui ouvre ce lien a-t-il un « waouh, c\'est mon site » au premier écran, et envie de payer pour l\'avoir ?\n\nDÉFAUTS BLOQUANTS (verdict a_refaire, quelle que soit la note) : une section sur fond noir ou presque noir (Louis n\'en veut aucune) ; le numéro de téléphone ou le nom de la commune écrit en lettres géantes ; le même contact (numéro, WhatsApp, adresse) répété dans plus de deux sections ; une section de remplissage qui ne dit rien (« WhatsApp, joignable sur WhatsApp », « 4 services pour vous », « Vous appelez, on vient, on répare ») ; un effet gadget ou enfantin (pastille qui tourne, dessin du métier, compteur sans intérêt) ; un texte difficile à lire (sur une photo, contraste faible, trop petit) ; une mise en page cassée (chevauchement non voulu, élément qui déborde, vide béant, section qui paraît vide ou incomplète, mot coupé dans un titre) ; une photo hors sujet, floue, laide, ou avec un visage ou une marque ; la même photo répétée ; aucun bouton pour appeler ou écrire dans le premier écran ; quelque chose de cassé ou d\'illisible sur téléphone ; un texte qui sonne faux, générique ou promotionnel ; un fait qui semble inventé (chiffre, avis, témoignage).\n\nCE QUI FAIT UN 8 ET PLUS : un vrai design, cohérent d\'un bout à l\'autre (le site est fait d\'un template : une seule voix typographique, un seul jeu d\'angles et de filets, un rythme de fonds clairs) ; chaque section a un but et dit quelque chose de vrai ; un premier écran qui frappe (une vraie idée, une photo forte ou un fond travaillé, une typographie qui a du caractère) ; des animations fluides qui accompagnent la lecture, jamais gratuites ; une hiérarchie évidente ; un rythme qui varie d\'une section à l\'autre ; des couleurs qui se tiennent ; des photos justes ; un site qui paraît fait pour CETTE entreprise et pas un modèle ; parfait sur téléphone.\n\nSois juste : ne retire pas de points pour ce qui est voulu par le système (le bandeau d\'aperçu, l\'absence de photo quand il n\'y en a aucune, l\'absence d\'avis quand l\'entreprise n\'en a pas, la note Google montrée une seule fois, la signature « Site réalisé par Studio Novalem » en bas de page : c\'est le nom de l\'agence). Dis précisément ce qui ne va pas et où. Écris en français simple, sans tiret long.';

function images(r) {
  const out = [];
  const img = function (b) { out.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }); };
  out.push({ type: 'text', text: 'Premier écran sur ordinateur (1440 px de large) :' }); img(r.ordinateur.haut);
  out.push({ type: 'text', text: 'Toute la page sur ordinateur, de haut en bas (' + r.ordinateur.morceaux.length + ' morceaux) :' }); r.ordinateur.morceaux.forEach(img);
  out.push({ type: 'text', text: 'Toute la page sur téléphone (390 px de large), de haut en bas (' + r.telephone.morceaux.length + ' morceaux) :' }); r.telephone.morceaux.forEach(img);
  return out;
}
function decrire(site, compo) {
  const sp = site.spec || {};
  const lignes = (compo.blocs || []).map(function (b) { const v = B.VARIANTES[b.id]; return '- ' + b.rubrique + ' : ' + b.id + (v ? ' (' + v.nom + ')' : '') + ', surface ' + b.surface + (b.fond ? ', fond ' + b.fond : ''); });
  const ph = (sp.photos || []).filter(function (p) { return p && p.fichier; });
  return 'L\'ENTREPRISE : ' + [sp.nom, sp.metier || sp.activite, sp.commune].filter(Boolean).join(', ') + '. Photos : ' + (ph.filter(function (p) { return !p.credit; }).length ? ph.filter(function (p) { return !p.credit; }).length + ' à elle' : 'aucune à elle') + (ph.some(function (p) { return p.credit; }) ? ', ' + ph.filter(function (p) { return p.credit; }).length + ' d\'illustration' : '') + '. Note Google : ' + (sp.google ? sp.google.note + ' (' + sp.google.avis + ' avis)' : 'aucune') + '.\n' +
    (compo.concept ? 'L\'IDÉE VOULUE PAR LE CONSTRUCTEUR : ' + compo.concept + '\n' : '') +
    (compo.template ? 'LE TEMPLATE : ' + compo.template + ' (style ' + compo.style + ')\n' : '') + 'LA COMPOSITION (ambiance ' + compo.ambiance + ', boutons ' + compo.boutons + ', mouvement ' + compo.mouvement + ') :\n' + lignes.join('\n');
}
async function juger(site, compo, r) {
  const p = MODELS[MODELE] || MODELS.smart;
  const corps = { model: p.id, max_tokens: 1800, system: [{ type: 'text', text: SYSTEME, cache_control: { type: 'ephemeral' } }], tools: [OUTIL], tool_choice: { type: 'tool', name: 'juger_site' },
    messages: [{ role: 'user', content: [{ type: 'text', text: decrire(site, compo) + (r.debord && r.debord.telephone > 0 ? '\nATTENTION : la page déborde de ' + r.debord.telephone + ' px en largeur sur téléphone.' : '') + (r.erreurs && r.erreurs.length ? '\nErreurs de la page : ' + r.erreurs.join(' ; ') : '') + ['ordinateur', 'telephone'].filter(function (k) { return r[k] && r[k].tronque; }).map(function (k) { return '\nNOTE : sur ' + (k === 'telephone' ? 'téléphone' : 'ordinateur') + ', la page fait ' + r[k].hauteur + ' px et tu n\'en vois que les ' + r[k].vue + ' premiers ; ne juge pas la partie que tu ne vois pas.'; }).join('') }].concat(images(r)).concat([{ type: 'text', text: 'Rends ton verdict (outil juger_site).' }]) }] };
  let x = await appel(corps, 1);
  let tier = MODELE;
  const verdictDe = function (r) { return r.ok && (r.data.content || []).some(function (b) { return b.type === 'tool_use' && b.name === 'juger_site'; }); };
  // modèle introuvable, ou outil demandé en clair et pas appelé : le modèle de repli
  if (((!x.ok && (x.status === 404 || (x.status === 400 && /model/i.test(x.message)))) || (x.ok && !verdictDe(x))) && p.fallback) { x = await appel(Object.assign({}, corps, { model: p.fallback }), 1); }
  if (!x.ok) throw new Error('jugement : ' + x.message);
  const u = x.data.usage || {};
  const usage = { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, searches: 0 };
  const bloc = (x.data.content || []).find(function (b) { return b.type === 'tool_use' && b.name === 'juger_site'; });
  if (!bloc) throw new Error('jugement : pas de verdict rendu');
  const v = bloc.input || {};
  // un modèle peut rendre une chaîne là où on attend une liste : on ne casse pas pour si peu (et on ne repaie pas)
  const liste = function (x) { return Array.isArray(x) ? x : (x ? [x] : []); };
  const note = Math.max(0, Math.min(10, Math.round(Number(v.note) * 2) / 2 || 0));
  const problemes = liste(v.problemes).filter(function (q) { return q && typeof q === 'object'; }).slice(0, 8).map(function (q) { return { zone: court(q.zone, 30), gravite: ['bloquant', 'important', 'detail'].indexOf(q.gravite) >= 0 ? q.gravite : 'important', constat: court(String(q.constat || '').replace(/—/g, ','), 240), variante: B.VARIANTES[q.variante] ? q.variante : undefined }; });
  const bloquant = problemes.some(function (q) { return q.gravite === 'bloquant'; });
  return { note: note, verdict: note >= SEUIL && !bloquant && v.verdict === 'valide' ? 'valide' : 'a_refaire', resume: court(String(v.resume || '').replace(/—/g, ','), 500), points_forts: liste(v.points_forts).slice(0, 3).map(function (t) { return court(String(t), 140); }), problemes: problemes, actions: liste(v.actions).filter(function (a) { return ACTIONS.indexOf(a) >= 0; }), usage: usage, cout: coutDe(tier, usage), modele: x.data.model || corps.model };
}

/* ── les reprises : ce qui peut se refaire sans rien inventer ── */
function reprendre(site, j) {
  const spec = JSON.parse(JSON.stringify(site.spec || {}));
  const faites = [];
  const ctx = R.contexte({ slug: site.slug, spec: spec }, { mode: 'apercu' }).ctx;
  const c0 = C.valide(spec.compo, spec, ctx) ? spec.compo : C.composer(spec, ctx, {});
  const eviter = new Set((spec.compo && spec.compo.eviter) || []);
  j.problemes.forEach(function (q) { if (q.variante) eviter.add(q.variante); });
  const tout = j.actions.indexOf('recomposer') >= 0 || j.actions.indexOf('changer_template') >= 0;
  // un template : refaire tout = un autre template (celui-ci est écarté) ; une section citée = la suivante du même template
  if (tout && c0.template) eviter.add('tpl:' + c0.template);
  if (j.actions.indexOf('changer_palette') >= 0) {
    const da0 = DN.de(spec);
    spec.da = DN.donner(spec, { essai: (da0.essai || 0) + 1 + Math.floor(Math.random() * 20), modele: da0.modele, recents: [da0] });
    faites.push('autres couleurs et autres lettres');
  }
  if (j.actions.indexOf('changer_photos') >= 0) {
    const illus = (spec.photos || []).filter(function (p) { return p && p.credit; });
    if (illus.length) {
      spec.photos_refusees = (spec.photos_refusees || []).concat(illus.map(function (p) { return p.credit.id; })).slice(-40);
      spec.photos = (spec.photos || []).filter(function (p) { return !p.credit; });
      spec.photo_ids = [];
      faites.push('photos d\'illustration à refaire (Léa)');
    }
  }
  if (tout || eviter.size || j.actions.indexOf('changer_rubriques') >= 0 || faites.length) {
    // les rubriques citées sont écartées ; le reste du choix du constructeur est gardé, sauf s'il faut tout reprendre
    const choix = {};
    if (!tout) Object.keys(c0.choix || {}).forEach(function (r) { if (!eviter.has(c0.choix[r])) choix[r] = c0.choix[r]; });
    else if (c0.choix && c0.choix.ambiance) choix.ambiance = c0.choix.ambiance;
    const c2 = Object.assign({}, c0, { choix: choix });
    spec.compo = c2;
    const ctx2 = R.contexte({ slug: site.slug, spec: spec }, { mode: 'apercu' }).ctx;
    spec.compo = C.composer(spec, ctx2, { recents: [c0], choix: choix, essai: (c0.essai || 0) + 1, eviter: Array.from(eviter) });
    spec.compo.eviter = Array.from(eviter).slice(-30);
    faites.push(tout ? (c0.template ? 'autre template : ' + spec.compo.template : 'composition refaite') : 'rubriques remplacées : ' + Array.from(eviter).filter(function (x) { return !/^tpl:/.test(x); }).join(', '));
  }
  return { spec: spec, faites: faites, photos: j.actions.indexOf('changer_photos') >= 0 && faites.some(function (f) { return /photos/.test(f); }) };
}

async function run(ctx) {
  const db = ctx.db;
  if (!branche()) return { resume: 'Mon regard n\'est pas branché (secret du cron absent) : les aperçus partent sans ma critique.', produit: 0, prochain_min: 720 };
  if (ctx.peutDepenser && !ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint : je regarde demain.', produit: 0, prochain_min: 240 };
  const plafond = Number((ctx.budget && ctx.budget.jour_usd) || 0);
  if (plafond > 0) {
    const passes = await db.select('hq_runs', { select: 'cost_usd', eq: { agent_id: 'critique' }, gte: { started_at: minuitGP().toISOString() }, limit: 1000 }).catch(function () { return []; });
    const deja = passes.reduce(function (t, x) { return t + (Number(x.cost_usd) || 0); }, 0);
    if (deja >= PART_BUDGET * plafond) return { resume: 'Ma part du budget du jour est prise (' + deja.toFixed(2) + ' $ sur ' + (PART_BUDGET * plafond).toFixed(2) + ' $) : je reprends à minuit, les autres travaillent.', produit: 0, prochain_min: jusquaDemainGP() };
  }
  // une publication en cours ne l'arrête pas : chaque page est vérifiée avant d'être regardée (sa version en ligne doit
  // être celle de la fiche), le reste du site attend son tour sans bloquer les autres
  const rows0 = await db.select('hq_sites', { select: 'id,lead_id,slug,status,version,url_apercu,created_at,cq:data->critique,rg:data->regard,ph:data->photos,cv:spec->compo->v', eq: { status: 'apercu' }, gte: { created_at: new Date(Date.now() - 30 * 86400000).toISOString() }, order: 'id.desc', limit: 300 });
  const lids = Array.from(new Set(rows0.map(function (s) { return s.lead_id; }).filter(Boolean)));
  const leads = lids.length ? await db.select('hq_leads', { select: 'id,status', in: { id: lids } }) : [];
  const statut = function (s) { const l = leads.find(function (x) { return x.id === s.lead_id; }); return l ? l.status : null; };
  const rows = rows0.filter(function (s) { return INJOIGNABLE.indexOf(statut(s)) < 0; });
  // à juger : pas de verdict pour la version en ligne ; une tentative ratée sur cette version attend son heure ; un
  // aperçu que Léa va réillustrer (photos pas encore passées par sa version) attend ses photos : un seul jugement, pas deux
  const IM = require('../sites/images');
  const attendLea = function (s) { const ph = s.ph !== undefined ? s.ph : (s.data && s.data.photos); return IM.branche() && !(ph && (ph.v >= IM.VERSION || ph.reessai)); };
  // un moteur qui vient de changer : Iris recompose d'abord (sinon c'est l'ancien rendu qui serait jugé, et refait deux fois)
  const attendIris = function (s) { const cv = s.cv !== undefined ? s.cv : (s.spec && s.spec.compo && s.spec.compo.v); return Number(cv) !== C.VERSION_TPL; };
  // un aperçu prêt à partir (sa note sur la version en ligne au seuil d'envoi) chez un prospect qu'on va écrire n'est plus
  // repris avant son premier email : une reprise le retiendrait le temps d'un nouveau jugement (Louis, 6 nov. : « envoyer
  // absolument ») ; ceux des prospects à appeler continuent de monter vers 8
  const pretAPartir = function (s) { const c = s.cq !== undefined ? s.cq : (s.data && s.data.critique); return ['a_contacter', 'brouillon'].indexOf(statut(s)) >= 0 && !!c && peutPartir({ version: s.version, data: { critique: c } }, ctx.budget).ok; };
  const aVoir = rows.filter(function (s) {
    const c = s.cq !== undefined ? s.cq : (s.data && s.data.critique), g = s.rg !== undefined ? s.rg : (s.data && s.data.regard);
    return s.url_apercu && A_JUGER.indexOf(statut(s)) >= 0 && !(c && c.v === VERSION && c.version === s.version) && !(g && g.version === s.version && g.attendre_jusqua && Date.parse(g.attendre_jusqua) > Date.now()) && !attendLea(s) && !attendIris(s) && !pretAPartir(s);
  });
  if (!aVoir.length) {
    const sansVerdict = rows.filter(function (s) { const c = s.cq !== undefined ? s.cq : (s.data && s.data.critique); return s.url_apercu && A_JUGER.indexOf(statut(s)) >= 0 && !(c && c.v === VERSION && c.version === s.version) && !pretAPartir(s); });
    const chezIris = sansVerdict.filter(attendIris).length, attente = sansVerdict.length - chezIris;
    return { resume: chezIris ? chezIris + ' aperçu(s) attendent la relecture d\'Iris (nouveau moteur), je les juge ensuite.' : attente ? attente + ' aperçu(s) attendent un nouvel essai de mon regard (il a échoué ou la page n\'était pas encore à jour).' : 'Tous les aperçus en ligne ont mon verdict.', produit: 0, prochain_min: chezIris || attente ? 15 : 60 };
  }
  // d'abord ceux qui partiront par email, puis ceux des prospects à appeler, puis les autres ; les plus récents d'abord
  const prio = function (s) { const p = PRIORITE[statut(s)]; return p === undefined ? 3 : p; };
  aVoir.sort(function (a, b) { return prio(a) - prio(b) || b.id - a.id; });
  let faits = 0, cout = 0, valides = 0;
  const usage = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const notes = [];
  // LOT jugements par passage ; un site pas encore en ligne ne prend la place de personne ; deux échecs (regard ou
  // jugement) et le passage s'arrête : la panne ne se répète pas sur toute la file
  let vus = 0, rates = 0;
  for (const s0 of aVoir) {
    if (faits >= LOT || vus >= LOT + 6 || rates >= 2) break;
    if (ctx.limite && Date.now() > ctx.limite - TEMPS_SITE) break;
    if (ctx.peutDepenser && !ctx.peutDepenser()) break;
    const site = await db.one('hq_sites', { eq: { id: s0.id } });
    if (!site || site.status !== 'apercu') continue;
    vus++;
    const c0 = (site.data && site.data.critique) || {};
    // une tentative ratée ne touche jamais au verdict : il reste celui de la version réellement jugée
    const g0 = (site.data && site.data.regard) || {};
    const dejaRates = g0.version === site.version ? g0.echecs || 0 : 0;
    const attendre = function (min, extra) { const v = site.version; return majFraiche(db, 'hq_sites', site.id, function (f) { return { data: Object.assign({}, f.data || {}, { regard: Object.assign({ version: v, le: iso(), attendre_jusqua: new Date(Date.now() + min * 60000).toISOString() }, extra || {}) }) }; }); };
    // d'abord la page en ligne, par une simple requête : pas encore republiée, ou pas encore dans le déploiement, elle
    // attend sans occuper le navigateur
    const el = await enLigne(site.url_apercu);
    if (el && el.absent) { await attendre(30, { echecs: dejaRates, erreur: 'page pas encore en ligne' }); continue; }
    if (el && el.version && String(el.version) !== String(site.version)) { await attendre(15, { echecs: dejaRates, erreur: 'la page en ligne est encore la version ' + el.version }); continue; }
    let r;
    try { r = await regarder(site.url_apercu); }
    catch (e) {
      rates++;
      const n = dejaRates + 1;
      await attendre(Math.min(360, 30 * n), { echecs: n, erreur: court(e.message, 160) });
      await sante(db, false, e.message).catch(function () { return null; });
      notes.push(court(site.spec.nom, 30) + ' : regard indisponible (' + court(e.message, 60) + ')');
      continue;
    }
    await sante(db, true).catch(function () { return null; });
    // la page en ligne n'est pas encore la dernière version : on attend la publication
    if (r.version && String(r.version) !== String(site.version)) { await attendre(15, { echecs: dejaRates, erreur: 'la page en ligne est encore la version ' + r.version }); continue; }
    const compo = R.rendre(site, { mode: 'apercu' }).compo;
    let j;
    // un jugement raté (API indisponible, requête refusée) compte comme un essai : le site attend son tour suivant, la file
    // avance, et une panne qui dure prévient Louis
    try { j = await juger(site, compo, r); }
    catch (e) {
      // plafond du jour ou fin du passage : pas une panne du regard, on s'arrête là et on reprend plus tard
      if (e && (e.budget || e.temps)) { notes.push(e.budget ? 'plafond IA du jour atteint' : 'plus le temps ce passage'); break; }
      rates++;
      const n = dejaRates + 1;
      await attendre(Math.min(360, 30 * n), { echecs: n, erreur: court(e.message, 160) });
      await sante(db, false, e.message).catch(function () { return null; });
      notes.push(court(site.spec.nom, 30) + ' : ' + court(e.message, 80));
      continue;
    }
    cout += j.cout; Object.keys(usage).forEach(function (k) { usage[k] += j.usage[k] || 0; });
    faits++;
    // les reprises se comptent par version du jugement : un moteur refait donne une nouvelle chance à un site abandonné
    const tours = (c0.v === VERSION ? (c0.tours || 0) : 0) + 1;
    const critique = { v: VERSION, version: site.version, le: iso(), note: j.note, verdict: j.verdict, resume: j.resume, points_forts: j.points_forts, problemes: j.problemes, actions: j.actions, tours: tours, modele: j.modele, historique: (c0.historique || []).concat([{ le: iso(), version: site.version, note: j.note, verdict: j.verdict }]).slice(-6) };
    const sansAttente = function (d) { const x = Object.assign({}, d || {}, { critique: critique }); delete x.regard; return x; };
    if (j.verdict === 'valide') {
      valides++;
      await majFraiche(db, 'hq_sites', site.id, function (f) { return { data: sansAttente(f.data) }; });
      notes.push(court(site.spec.nom, 30) + ' ' + String(j.note).replace('.', ',') + '/10 validé');
      continue;
    }
    // déjà montré au prospect, ou en discussion avec lui : on ne touche plus à son site (ses retouches, ses choix restent) ;
    // l'avis de Miranda est gardé pour Louis
    const ld = site.lead_id ? await db.one('hq_leads', { eq: { id: site.lead_id }, select: 'id,status' }) : null;
    if (ld && PAS_MONTRE.indexOf(ld.status) < 0) {
      critique.montre = true;
      await majFraiche(db, 'hq_sites', site.id, function (f) { return { data: sansAttente(f.data) }; });
      notes.push(court(site.spec.nom, 30) + ' ' + String(j.note).replace('.', ',') + '/10 (' + (INJOIGNABLE.indexOf(ld.status) >= 0 ? 'prospect injoignable' : 'déjà montré au prospect') + ' : avis gardé, site inchangé)');
      continue;
    }
    // prêt à partir (au seuil d'envoi) chez un prospect qu'on va écrire : gardé tel quel, son premier email ne l'attend
    // pas ; les reprises restent pour les aperçus sous le seuil (Louis, 6 nov. : « envoyer absolument »)
    if (ld && ['a_contacter', 'brouillon'].indexOf(ld.status) >= 0 && j.note >= seuilEnvoi(ctx.budget)) {
      critique.pret = true;
      await majFraiche(db, 'hq_sites', site.id, function (f) { return { data: sansAttente(f.data) }; });
      notes.push(court(site.spec.nom, 30) + ' ' + String(j.note).replace('.', ',') + '/10 : prêt à partir, gardé tel quel');
      continue;
    }
    // à refaire : deux reprises au plus, puis le site attend (il ne part pas) et Louis voit pourquoi dans la tour
    if (tours > TOURS) {
      critique.abandon = true;
      await majFraiche(db, 'hq_sites', site.id, function (f) { return { data: sansAttente(f.data) }; });
      notes.push(court(site.spec.nom, 30) + ' ' + String(j.note).replace('.', ',') + '/10 refusé, ne part pas');
      continue;
    }
    const rp = reprendre(site, j);
    critique.reprise = rp.faites;
    const avant = JSON.stringify(site.spec);
    const ok = await majFraiche(db, 'hq_sites', site.id, function (f) {
      if (f.status !== 'apercu' || JSON.stringify(f.spec) !== avant) return null;
      const d = sansAttente(f.data);
      if (rp.photos) d.photos = { v: 0, le: iso(), par: 'critique', reessai: iso() };
      return { spec: rp.spec, version: (f.version || 1) + 1, data: d };
    });
    if (ok) {
      await P.ecrireEtat(db, { a_publier: true });
      await require('./boite').reveiller(db, rp.photos ? 'photos' : 'livraison', 1).catch(function () { return null; });
    }
    notes.push(court(site.spec.nom, 30) + ' ' + String(j.note).replace('.', ',') + '/10 à refaire (' + (rp.faites.join(', ') || 'rien d\'automatique') + ')');
  }
  // en phase de test : Louis est prévenu quand les premiers sites validés sont prêts à regarder ; sinon Chloé est réveillée
  // pour écrire le premier email de ceux qu'elle peut écrire (le relais passe tout de suite, pas au prochain tour de Chloé)
  if (valides) {
    await annoncer(db).catch(function () { return null; });
    if (!(await require('../sites/phase').enTest(db).catch(function () { return true; }))) await require('./boite').reveiller(db, 'redacteur', 2).catch(function () { return null; });
  }
  return { resume: faits ? faits + ' aperçu(s) jugé(s) : ' + notes.join(' ; ') + '.' : (notes.length ? notes.join(' ; ') : (vus ? vus + ' aperçu(s) pas encore à jour en ligne : je les regarde après leur publication.' : 'Rien à juger ce passage.')), produit: faits, cout: cout, usage: usage, modele: MODELS[MODELE].id, prochain_min: aVoir.length > vus ? 10 : null, detail: { notes: notes } };
}

// Une fois par phase de test : les sites validés à regarder, en lien
async function annoncer(db) {
  const ph = await PH.lire(db);
  if (ph.phase !== 'test' || ph.annonce_le) return null;
  const rows = await db.select('hq_sites', { select: 'id,url_apercu,spec,data', eq: { status: 'apercu' }, order: 'id.desc', limit: 200 });
  const ok = rows.filter(function (s) { return s.url_apercu && s.data && s.data.critique && s.data.critique.verdict === 'valide' && Date.parse(s.data.critique.le) > Date.parse(ph.depuis || 0); });
  if (ok.length < 6) return null;
  // la phase a pu changer entre-temps (Louis a lancé l'envoi) : on relit, et on ne touche qu'à la date de l'annonce
  const ph2 = await PH.lire(db);
  if (ph2.phase !== 'test' || ph2.annonce_le || ph2.illisible) return null;
  await db.insert('hq_messages', { from_id: 'critique', to_id: 'louis', company_id: 'novalemo', kind: 'rapport', subject: ok.length + ' sites du nouveau moteur validés : à toi de regarder', body: 'Voici ceux que j\'ai validés (note sur 10) :\n' + ok.slice(0, 10).map(function (s) { return '- ' + s.spec.nom + ' (' + String(s.data.critique.note).replace('.', ',') + ') : ' + s.url_apercu; }).join('\n') + '\n\nAucun email ne part pendant la phase de test. Quand ils te plaisent : la tour, Novalemo, Sites en test, « Lancer l\'envoi ». Si un détail te gêne, dis-le : on le corrige pour tous les sites.' }, { returning: false });
  await db.upsert('hq_config', { key: PH.CLE, value: Object.assign({}, ph2, { annonce_le: iso() }), updated_at: iso() }, { onConflict: 'key' });
  return ok.length;
}

// le site peut-il partir chez le prospect ? (6 nov. 2026, Louis : « envoyer les mails absolument ») Miranda ne retient
// plus l'email jusqu'à 8 : un aperçu part dès que sa dernière note atteint le seuil d'envoi (6 sur 10 par défaut,
// réglable par budget.note_envoi), ou qu'elle l'a validé. Sa dernière note compte même si le site a été refait depuis
// (recomposé par Iris, repris par elle) : on refait pour mieux, jamais pour moins bien, et un aperçu prêt chez un
// prospect à écrire n'est plus repris. Jamais jugé : il attend son verdict ; sous le seuil : il attend une reprise. Son
// regard pas branché : les aperçus partent sans sa critique ; en panne, ils attendent (Louis est prévenu, sante).
const NOTE_ENVOI = 6;
function seuilEnvoi(budget) { const n = Number(budget && budget.note_envoi); return n >= 1 && n <= 10 ? n : NOTE_ENVOI; }
function peutPartir(site, budget) {
  if (!branche()) return { ok: true };
  const c = site && site.data && site.data.critique;
  if (!c || c.note == null) return { ok: false, raison: 'Miranda ne l\'a pas encore jugé' };
  if (c.verdict === 'valide') return { ok: true };
  const seuil = seuilEnvoi(budget);
  if (Number(c.note) >= seuil) return { ok: true, note: Number(c.note) };
  return { ok: false, refuse: !!c.abandon, raison: 'Miranda lui donne ' + String(c.note).replace('.', ',') + '/10, sous le seuil d\'envoi (' + String(seuil).replace('.', ',') + ')' + (c.abandon ? ' : elle ne le reprend plus (' + court(c.resume, 100) + ')' : ' : elle le reprend') };
}

// la santé du regard, pour tous les sites : ses échecs à la suite, et Louis prévenu une fois par jour s'il est en panne
// depuis plus de deux heures (rien ne part tant qu'elle ne voit pas les sites)
async function sante(db, ok, erreur) {
  const r = await db.one('hq_config', { eq: { key: CLE_REGARD } });
  const v = (r && r.value) || {};
  if (ok) { if (v.echecs) await db.upsert('hq_config', { key: CLE_REGARD, value: Object.assign({}, v, { echecs: 0, depuis: null, retabli_le: iso() }), updated_at: iso() }, { onConflict: 'key' }); return; }
  const x = Object.assign({}, v, { echecs: (v.echecs || 0) + 1, depuis: v.depuis || iso(), erreur: court(String(erreur || ''), 160) });
  const longue = Date.now() - Date.parse(x.depuis) > 2 * 3600000, recente = x.alerte_le && Date.now() - Date.parse(x.alerte_le) < 86400000;
  if (longue && !recente) {
    x.alerte_le = iso();
    await db.insert('hq_messages', { from_id: 'critique', to_id: 'louis', company_id: 'novalemo', kind: 'alerte', subject: 'Je ne peux plus juger les aperçus : aucun ne part', body: 'Depuis ' + new Date(x.depuis).toLocaleString('fr-FR', { timeZone: 'America/Martinique' }) + ', je n\'arrive plus à regarder ou à juger les aperçus (' + x.erreur + '). Sans mon verdict, aucun premier email ne part : les sites attendent. Dis-le à Claude pour qu\'il répare.' }, { returning: false });
  }
  await db.upsert('hq_config', { key: CLE_REGARD, value: x, updated_at: iso() }, { onConflict: 'key' });
}

module.exports = { run, regarder, enLigne, juger, reprendre, peutPartir, seuilEnvoi, NOTE_ENVOI, annoncer, sante, branche, VERSION, SEUIL, PART_BUDGET, OUTIL, SYSTEME, CLE_REGARD, PAS_MONTRE, INJOIGNABLE };
