// Le moteur : réveille les agents dont c'est l'heure, les fait travailler (Claude + outils, ou travail
// automatique), compte chaque dollar, respecte le plafond du jour, et garde la hiérarchie vivante.
'use strict';
const { open } = require('./db');
const { BUDGET_DEFAUT, CYCLE_SECONDES, AGENTS_EN_PARALLELE, SEED_VERSION, MODELS } = require('./config');
const { COMPANIES, AGENTS, PROPOSALS } = require('./seed');
const { converse } = require('./claude');
const { definitions, executeurs } = require('./tools');
const { construire } = require('./context');
const { lirePage } = require('./web');
const { jourGP, minuitGP, court, nettoie } = require('./util');

const JOBS = {
  domaines: require('./jobs/domaines'),
  maps: require('./jobs/maps'),
  enrichir: require('./jobs/enrichir'),
  portfolio: require('./jobs/portfolio'),
  github: require('./jobs/github'),
  controle: require('./jobs/controle'),
  registre: require('./jobs/registre'),
  demo: require('./jobs/demo'),
  direction: require('./jobs/direction'),
  photos: require('./jobs/photos'),
  juridique: require('./jobs/juridique'),
  livraison: require('./jobs/livraison'),
  critique: require('./jobs/critique'),
  studio_scripts: require('./jobs/studio_scripts'),
  studio_scenes: require('./jobs/studio_scenes'),
  studio_usine: require('./jobs/studio_usine'),
  studio_critique: require('./jobs/studio_critique'),
  studio_langues: require('./jobs/studio_langues'),
  studio_actu: require('./jobs/studio_actu'),
  studio_hooks: require('./jobs/studio_hooks'),
  studio_viral: require('./jobs/studio_viral'),
  studio_verif: require('./jobs/studio_verif'),
  studio_plume: require('./jobs/studio_plume')
};
const ENVOI = require('./jobs/envoi');
const BOITE = require('./jobs/boite');

const RANG = { agent: 0, manager: 1, rh: 2, directeur: 3, dg: 4, pdg: 5 };
// stratégies réécrites par le code à une montée de version (sinon chaque agent garde la sienne)
// (3 : la stratégie de Lucas après la seconde relecture ; 4 : l'offre au mois dans les angles de Victor, Ana et Chloé ;
// 8 : le pôle écriture, les tests de messages et Emma qui se présente comme l'assistante IA de Louis)
const MIGRATIONS = { 2: ['dg_novalemo', 'dircom_novalemo', 'rh_novalemo', 'emailing', 'contacts', 'chasse_domaines', 'chasse_maps', 'chasse_registre', 'redacteur', 'relanceur', 'reponses', 'partenaires', 'inbound', 'analyste', 'chef_prod', 'demo', 'livraison'], 3: ['livraison'], 4: ['dircom_novalemo', 'emailing', 'redacteur'], 5: ['livraison', 'dircom_novalemo', 'emailing', 'redacteur'], 6: ['demo', 'reponses'], 7: ['demo', 'reponses', 'da', 'chef_prod', 'livraison'], 8: ['dircom_novalemo', 'emailing', 'redacteur', 'reponses'], 9: ['dircom_novalemo', 'emailing', 'redacteur', 'reponses', 'demo', 'da', 'photos', 'chef_prod', 'contacts'], 12: ['dg_studio', 'dired_studio', 'tendances', 'scenariste', 'animateur', 'monteur'], 14: ['dired_studio', 'scenariste', 'animateur', 'critique_video', 'localisation'] };
// postes qui changent de nature à une montée de version (un agent IA devient un travail automatique, un poste en attente
// prend un autre nom) : la fiche, le travail, la cadence et le nom suivent le code
// (12 : le Studio 3D se branche sur l'usine ; Clara, Oscar et la cheffe de fabrication deviennent des travaux automatiques ;
// 14 : la salle d'écriture du Studio, la cheffe de fabrication s'appelle Elsa, Lina reste le prénom du portfolio)
const POSTES_CHANGES = { 12: ['scenariste', 'animateur', 'monteur'], 14: ['monteur'] };
// plafonds par défaut relevés par une version : un plafond resté à l'ancienne valeur par défaut prend la nouvelle
// ceux qui répondent aux clients et aux prospects : la fin du budget du jour leur est réservée
const RESERVE_CLIENTS = ['reponses'];
const PLAFONDS = { 8: { emails_jour: [25, 50], apercus_jour: [12, 20] }, 11: { places_jour: [25, 80] } };
const NOMS_PLAFONDS = { emails_jour: 'emails par jour', apercus_jour: 'aperçus par jour', places_jour: 'recherches Google Maps par jour (2,80 $ par jour au plus)' };
const nowIso = function () { return new Date().toISOString(); };

/* ── fondation (premier branchement, puis nouveaux postes du code) ── */
function sieges(liste) {
  const ordre = { pdg: 0, dg: 1, directeur: 2, rh: 3, manager: 4, agent: 5 };
  const parBoite = {};
  liste.forEach(function (a, k) { (parBoite[a.company_id] = parBoite[a.company_id] || []).push({ a: a, k: k }); });
  const seat = {};
  Object.keys(parBoite).forEach(function (c) {
    parBoite[c].sort(function (x, y) { return (ordre[x.a.tier] - ordre[y.a.tier]) || (x.k - y.k); }).forEach(function (x, i) { seat[x.a.id] = i; });
  });
  return seat;
}

async function semer(db) {
  const cfg = await db.one('hq_config', { eq: { key: 'seed' } });
  const version = (cfg && cfg.value && cfg.value.version) || 0;
  if (version >= SEED_VERSION) return { seme: false };
  const verrou = await db.rpc('hq_lock', { p_name: 'seed', p_seconds: 90 });
  if (!verrou) return { seme: false, encours: true };
  try { return await semerVraiment(db, version); }
  finally { await db.rpc('hq_unlock', { p_name: 'seed' }).catch(function () {}); }
}

function profondeur(a, parId) { let d = 0, cur = a; while (cur && cur.parent_id && d < 20) { cur = parId[cur.parent_id]; d++; } return d; }

async function semerVraiment(db, version) {
  const t = Date.now();
  const existantsC = await db.select('hq_companies', { select: 'id,status' });
  const idsC = new Set(existantsC.map(function (c) { return c.id; }));
  const nouvellesC = COMPANIES.filter(function (c) { return !idsC.has(c.id); }).map(function (c) { return Object.assign({}, c); });
  if (nouvellesC.length) await db.insert('hq_companies', nouvellesC, { returning: false });
  for (const c of COMPANIES.filter(function (x) { return idsC.has(x.id); })) {
    const ex = existantsC.find(function (e) { return e.id === c.id; });
    const patch = { tagline: c.tagline, color: c.color, mission: c.mission, updated_at: nowIso() };
    if (c.context && !(ex.status === 'active' && c.status === 'proposee')) patch.context = c.context;
    await db.update('hq_companies', patch, { eq: { id: c.id } });
  }
  const existantsA = await db.select('hq_agents', { select: 'id,kind,status' });
  const idsA = new Set(existantsA.map(function (a) { return a.id; }));
  const seat = sieges(AGENTS);
  const lignes = [];
  const savoir = [];
  AGENTS.forEach(function (a) {
    if (idsA.has(a.id)) return;
    lignes.push({
      id: a.id, company_id: a.company_id, parent_id: a.parent_id || null, name: a.name, title: a.title, tier: a.tier, kind: a.kind, job: a.job || null, model: a.model || 'fast',
      mission: a.mission, charter: a.charter, playbook: a.playbook || '', tools: a.tools || [], cadence_min: a.cadence_min || 1440,
      next_run_at: a.kind === 'attente' ? null : new Date(t + (a.start || 30) * 60000).toISOString(), status: a.kind === 'attente' ? 'attente' : 'idle',
      waiting_for: a.waiting_for || null, stats: { web: a.web || 0, runs: 0, cout: 0 }, seat: seat[a.id], origin: 'fondation', created_by: 'fondation'
    });
    (a.knowledge || []).forEach(function (k) { savoir.push({ agent_id: a.id, kind: 'fait', content: k, weight: 8, source: 'fondation' }); });
  });
  if (lignes.length) {
    // par niveau hiérarchique : un chef existe toujours avant ses équipes (clé étrangère)
    const parId = {};
    AGENTS.forEach(function (a) { parId[a.id] = a; });
    const niveaux = {};
    lignes.forEach(function (l) { const d = profondeur(parId[l.id], parId); (niveaux[d] = niveaux[d] || []).push(l); });
    for (const d of Object.keys(niveaux).map(Number).sort(function (x, y) { return x - y; })) await db.insert('hq_agents', niveaux[d], { returning: false });
  }
  // postes existants : la fiche et les outils suivent le code, la stratégie et la cadence restent celles de l'agent
  // (sauf migration voulue : version 2 = Novalemo passe en Martinique uniquement et en pilote automatique)
  const forcees = new Set(), changes = new Set();
  Object.keys(MIGRATIONS).forEach(function (v) { if (Number(v) > version) MIGRATIONS[v].forEach(function (id) { forcees.add(id); }); });
  if (version > 0) Object.keys(POSTES_CHANGES).forEach(function (v) { if (Number(v) > version) POSTES_CHANGES[v].forEach(function (id) { changes.add(id); }); });
  for (const a of AGENTS.filter(function (x) { return idsA.has(x.id); })) {
    const ex = existantsA.find(function (e) { return e.id === a.id; });
    const patch = { charter: a.charter, mission: a.mission, title: a.title, tools: a.tools || [], waiting_for: a.waiting_for || null, updated_at: nowIso() };
    if ((ex.kind === 'attente' && a.kind !== 'attente') || (changes.has(a.id) && ex.kind !== a.kind)) Object.assign(patch, { kind: a.kind, job: a.job || null, model: a.model || 'fast', cadence_min: a.cadence_min || 1440, status: a.kind === 'attente' ? 'attente' : 'idle', next_run_at: a.kind === 'attente' ? null : new Date(t + (a.start || 10) * 60000).toISOString() });
    if (changes.has(a.id)) patch.name = a.name;
    if (forcees.has(a.id)) patch.playbook = a.playbook || '';
    await db.update('hq_agents', patch, { eq: { id: a.id } });
  }
  if (savoir.length) await db.insert('hq_knowledge', savoir, { returning: false });
  if (version > 0) {
    const b = await db.one('hq_config', { eq: { key: 'budget' } });
    if (b && b.value) {
      const v = Object.assign({}, b.value);
      let change = false;
      const faits = [];
      Object.keys(PLAFONDS).forEach(function (n) { if (Number(n) > version) Object.keys(PLAFONDS[n]).forEach(function (k) { if (Number(v[k]) === PLAFONDS[n][k][0]) { v[k] = PLAFONDS[n][k][1]; change = true; faits.push((NOMS_PLAFONDS[k] || k) + ' : ' + PLAFONDS[n][k][0] + ' à ' + PLAFONDS[n][k][1]); } }); });
      if (change) {
        await db.update('hq_config', { value: v, updated_at: nowIso() }, { eq: { key: 'budget' } });
        // une valeur égale à l'ancien défaut a pu être choisie par Louis : il est prévenu, il la remet en un clic
        await db.insert('hq_messages', { from_id: 'controleur', to_id: 'louis', company_id: 'groupe', kind: 'note', subject: 'Plafonds relevés', body: 'Ils étaient aux anciennes valeurs par défaut, je les ai relevés : ' + faits.join(', ') + '. La boîte suit toujours sa chauffe (8 emails par jour au départ, plus si elle reste saine) : le plafond ne joue qu\'au bout. Si l\'ancienne valeur était ton choix, remets-la dans Gestion, Coûts et budget.' }, { returning: false });
      }
    }
  }
  // version 9 : le nouveau moteur des sites arrive en phase de test (aucun premier email tant que Louis n'a pas regardé
  // les nouveaux aperçus) ; les adresses devinées (contact@ du domaine) ne sont plus jamais écrites à froid
  if (version > 0 && version < 9) {
    const PHs = require('./sites/phase');
    const ph = await db.one('hq_config', { eq: { key: PHs.CLE } }).catch(function () { return null; });
    if (!ph) await PHs.ecrire(db, 'test', 'migration');
    // y compris ceux dont le premier email attendait déjà dans la file : il est annulé
    const devinees = await db.select('hq_leads', { select: 'id,phone,reason,status', eq: { email_source: 'devine' }, in: { status: ['a_contacter', 'brouillon'] }, limit: 2000 }).catch(function () { return []; });
    for (const l of devinees) {
      await db.update('hq_leads', { status: l.phone ? 'a_appeler' : 'sans_contact', reason: String('Adresse email devinée, pas vue sur son site. ' + (l.reason || '')).slice(0, 300), updated_at: nowIso() }, { eq: { id: l.id, status: l.status } });
      await db.update('hq_outbox', { status: 'annule', error: 'adresse devinée : jamais de premier email', updated_at: nowIso() }, { eq: { lead_id: l.id, kind: 'prospection', status: 'pret' } }).catch(function () { return null; });
    }
    await db.insert('hq_messages', { from_id: 'chef_prod', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: 'Nouveau moteur des sites : phase de test', body: 'Les aperçus se refont sur la bibliothèque de rubriques (animations, fonds travaillés, photos enfin posées par Léa) et Miranda les critique un à un. Aucun premier email ni relance ne part pendant le test ; les réponses aux conversations continuent. ' + (devinees.length ? devinees.length + ' prospect(s) à adresse devinée passent en appel. ' : '') + 'Quand les sites te plaisent : la tour, Novalemo, Sites en test, « Lancer l\'envoi ».' }, { returning: false });
  }
  // version 11 : Jade cherche deux fois plus souvent (toutes les 90 minutes, six recherches) pour remplir le plafond relevé ;
  // les entreprises écartées pour « un vrai site » sont réauditées (l'audit voit maintenant les sites vraiment datés), sauf
  // celles à qui on a déjà écrit
  if (version > 0 && version < 11) {
    await db.update('hq_agents', { cadence_min: 90 }, { eq: { id: 'chasse_maps', cadence_min: 180 } }).catch(function () { return null; });
    const ecartes = await db.select('hq_leads', { select: 'id,reason', eq: { status: 'ecarte', site_state: 'correct' }, limit: 2000 }).catch(function () { return []; });
    const deja = new Set((await db.select('hq_outbox', { select: 'lead_id', limit: 5000 }).catch(function () { return []; })).map(function (o) { return o.lead_id; }));
    // repartis de leur note d'origine (l'écart l'avait plafonnée à 25 : un site daté retrouvé serait resté sous le seuil
    // des aperçus) et de la seule raison de Jade (l'audit écrit la sienne)
    for (const l of ecartes) {
      if (!/a déjà un vrai site/.test(l.reason || '') || deja.has(l.id)) continue;
      const origine = String(l.reason || '').split(' ; ')[0].slice(0, 300);
      await db.update('hq_leads', { status: 'nouveau', score: /site faible/.test(origine) ? 66 : 50, reason: origine, updated_at: nowIso() }, { eq: { id: l.id, status: 'ecarte' } }).catch(function () { return null; });
    }
    // les aperçus des prospects à appeler (ou dont l'email attend) que Léa avait pris pour déjà montrés : personne ne les a
    // vus, elle les reprend avec ses nouvelles recherches (puis Miranda les juge)
    const PAS_MONTRE = require('./jobs/critique').PAS_MONTRE;
    const sitesL = await db.select('hq_sites', { select: 'id,lead_id,ph:data->photos', in: { status: ['brouillon', 'apercu'] }, limit: 2000 }).catch(function () { return []; });
    const pris = sitesL.filter(function (x) { const ph = x.ph !== undefined ? x.ph : (x.data && x.data.photos); return x.lead_id && ph && ph.rien === 'déjà montré au prospect'; });
    const leadsL = pris.length ? await db.select('hq_leads', { select: 'id,status', in: { id: pris.map(function (x) { return x.lead_id; }) } }).catch(function () { return []; }) : [];
    for (const x of pris) {
      const l = leadsL.find(function (y) { return y.id === x.lead_id; });
      if (!l || PAS_MONTRE.indexOf(l.status) < 0) continue;
      await require('./db').majFraiche(db, 'hq_sites', x.id, function (f) { return { data: Object.assign({}, f.data || {}, { photos: { v: 0, le: nowIso(), par: 'migration' } }) }; }).catch(function () { return null; });
    }
  }
  // version 10 (et toute migration suivante) : un nouveau moteur arrive, la chaîne des aperçus se remet au travail tout
  // de suite au lieu d'attendre la fin de ses pauses (Marcus audite, Noé fabrique, Iris recompose, Léa illustre, Miranda
  // juge)
  if (version > 0 && version < SEED_VERSION) {
    await db.update('hq_agents', { next_run_at: nowIso() }, { in: { id: ['contacts', 'demo', 'da', 'photos', 'critique'] }, neq: { status: 'paused' } }).catch(function () { return null; });
  }
  // version 13 : les 40 templates (fonds clairs, un seul bloc contact, plus de numéro géant ni de rubrique de remplissage) et
  // le panneau des aperçus (retouches, images, paiement direct) ; Iris recompose les aperçus en attente, déjà envoyés
  // compris, Lucas les republie, Miranda les rejuge avec ses critères durcis
  if (version > 0 && version < 13) {
    await db.insert('hq_messages', { from_id: 'da', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: 'Les aperçus passent sur les 40 templates', body: 'Je recompose tous les aperçus qui attendent un paiement, ceux déjà envoyés compris (même lien) : chacun prend un des 40 templates, fond clair, un seul bloc contact, des sections qui disent quelque chose. Le bouton « Je veux ce site » devient un panneau : le prospect y liste ses retouches, dépose ses photos et son logo (tout arrive chez Emma), ou paie directement, 490 € ou 45 € par mois. Miranda rejuge chaque site avec ses critères durcis.' }, { returning: false }).catch(function () { return null; });
  }
  // version 15 (l'audit de novembre) : un email qui attendait dans la file avec l'ancienne offre (590 €, 49 € par mois) est
  // annulé et se réécrit ; les adresses mal lues sur les sites (« u003econtact@... », « .comcontact@... ») sont nettoyées ;
  // les prospects des nouveaux domaines qui ont déjà un site passent par l'audit de Marcus (un vrai site est écarté) ; les
  // tâches données à des automates (qui ne lisent pas les tâches) sont closes
  if (version > 0 && version < 15) {
    const bilan = await auditNovembre(db).catch(function (e) { return { erreur: e.message }; });
    await db.insert('hq_messages', { from_id: 'da', to_id: 'louis', company_id: 'novalemo', kind: 'note', subject: 'Les aperçus se refont avant l\'envoi', body: 'Je reprends les aperçus pas encore montrés, prospects à appeler compris : un vrai grand titre au premier écran (le métier et la commune passent au-dessus, plus jamais la commune en lettres géantes), une photo en haut de page dès qu\'il y en a une, des hauts de page sans photo redessinés, plus aucune information répétée, et deux entreprises voisines du même métier n\'ont plus le même template. Miranda les rejuge tous, refus d\'avant compris.' + (bilan.prix ? ' ' + bilan.prix + ' email(s) en attente annonçaient l\'ancienne offre (590 € ou 49 € par mois) : annulé(s), Chloé les réécrit au bon prix.' : '') + (bilan.emails ? ' ' + bilan.emails + ' adresse(s) mal lue(s) sur des sites corrigée(s).' : '') + (bilan.audits ? ' ' + bilan.audits + ' prospect(s) de nouveaux domaines qui ont déjà un site repassent par l\'audit de Marcus.' : '') + (bilan.doublons ? ' ' + bilan.doublons + ' fiche(s) en double d\'une même entreprise (agences au même site, même numéro) écartée(s) : chaque entreprise n\'est démarchée qu\'une fois.' : '') }, { returning: false }).catch(function () { return null; });
  }
  if (version === 0) {
    await db.insert('hq_proposals', PROPOSALS.map(function (p) { return Object.assign({ avis: [], details: {} }, p); }), { returning: false });
    await db.insert('hq_messages', { from_id: 'systeme', to_id: null, company_id: 'groupe', kind: 'evenement', subject: 'Fondation du groupe LEXONOS', body: AGENTS.length + ' agents, ' + COMPANIES.filter(function (c) { return c.status === 'active'; }).length + ' entités actives, ' + PROPOSALS.length + ' projets d\'entreprises soumis à Louis. Les premiers passages démarrent.' }, { returning: false });
    if (!(await db.one('hq_config', { eq: { key: 'budget' } }))) await db.insert('hq_config', { key: 'budget', value: BUDGET_DEFAUT }, { returning: false });
  }
  await db.upsert('hq_config', { key: 'seed', value: { version: SEED_VERSION, le: nowIso() }, updated_at: nowIso() }, { onConflict: 'key' });
  return { seme: true, agents: lignes.length, entreprises: nouvellesC.length };
}

// la remise en ordre de la version 15 (voir semerVraiment) : rien n'est supprimé, tout est annulé ou corrigé avec sa raison
async function auditNovembre(db) {
  const Q = require('./qualite');
  const ND = require('./chasse/nd-moteur');
  const bilan = { prix: 0, emails: 0, audits: 0, doublons: 0, taches: 0 };
  // 1. la file : rien ne part avec un prix hors de la grille du jour
  const file = await db.select('hq_outbox', { select: 'id,lead_id,kind,subject,body', in: { status: ['pret', 'a_valider'], kind: ['prospection', 'relance'] }, limit: 2000 }).catch(function () { return []; });
  for (const o of file) {
    const hg = Q.horsGrille(String(o.subject || '') + '\n' + String(o.body || ''));
    if (!hg.length) continue;
    await db.update('hq_outbox', { status: 'annule', error: 'prix hors de la grille du jour (' + hg.join(' €, ') + ' €) : email rédigé avec une ancienne offre', updated_at: nowIso() }, { eq: { id: o.id } });
    if (o.kind === 'prospection' && o.lead_id) await db.update('hq_leads', { status: 'a_contacter', updated_at: nowIso() }, { eq: { id: o.lead_id, status: 'brouillon' } });
    bilan.prix++;
  }
  // 2. les adresses lues sur les sites, pour les prospects pas encore écrits
  const lus = await db.select('hq_leads', { select: 'id,email,phone,status', eq: { email_source: 'site' }, in: { status: ['nouveau', 'a_contacter', 'a_appeler', 'brouillon'] }, limit: 5000 }).catch(function () { return []; });
  for (const l of lus) {
    const avant = String(l.email || '').trim().toLowerCase();
    if (!avant) continue;
    const x = ND.nettoyerEmail(avant);
    if (x === avant) continue;
    const patch = { email: x || null, email_source: x ? 'site' : null, updated_at: nowIso() };
    if (!x && ['a_contacter', 'brouillon'].indexOf(l.status) >= 0) patch.status = l.phone ? 'a_appeler' : 'sans_contact';
    await db.update('hq_leads', patch, { eq: { id: l.id } });
    // ce qui attendait vers l'adresse mal lue ne part pas : le prospect revient à écrire (ou à appeler)
    await db.update('hq_outbox', { status: 'annule', error: 'adresse mal lue sur son site (' + avant + ')', updated_at: nowIso() }, { eq: { lead_id: l.id, to_email: avant, status: 'pret' } }).catch(function () { return null; });
    if (x && l.status === 'brouillon') await db.update('hq_leads', { status: 'a_contacter' }, { eq: { id: l.id, status: 'brouillon' } });
    bilan.emails++;
  }
  // 3. les nouveaux domaines qui ont déjà un site : l'audit de Marcus d'abord (jamais écrits, pas encore d'aperçu)
  const doms = await db.select('hq_leads', { select: 'id', eq: { source: 'domaines', site_state: 'site' }, in: { status: ['a_contacter', 'a_appeler'] }, is: { apercu_etat: null }, limit: 2000 }).catch(function () { return []; });
  if (doms.length) {
    const ecrits = new Set((await db.select('hq_outbox', { select: 'lead_id', in: { lead_id: doms.map(function (l) { return l.id; }) } }).catch(function () { return []; })).map(function (o) { return o.lead_id; }));
    for (const l of doms) {
      if (ecrits.has(l.id)) continue;
      await db.update('hq_leads', { status: 'nouveau', updated_at: nowIso() }, { eq: { id: l.id } });
      bilan.audits++;
    }
  }
  // 4. une entreprise, un prospect : ses autres fiches (agences au même site, même numéro) pas encore écrites sont écartées,
  // avec la raison ; ce qui les attendait dans la file est annulé
  const EN = require('./jobs/enrichir');
  const vivants = await db.select('hq_leads', { select: 'id,name,phone,website,status,site_id,apercu_etat', not_in: { status: ['ecarte'] }, limit: 5000 }).catch(function () { return []; });
  const ecritsP = new Set((await db.select('hq_outbox', { select: 'lead_id', eq: { kind: 'prospection', status: 'envoye' }, limit: 5000 }).catch(function () { return []; })).map(function (o) { return o.lead_id; }));
  const doubles = EN.doublons(vivants, ecritsP);
  for (const [id, d] of doubles) {
    const l = vivants.find(function (x) { return x.id === id; });
    await db.update('hq_leads', { status: d.stop ? 'stop' : 'ecarte', reason: String(d.raison).slice(0, 400), updated_at: nowIso() }, { eq: { id: id, status: l.status } });
    await db.update('hq_outbox', { status: 'annule', error: d.raison.slice(0, 300), updated_at: nowIso() }, { eq: { lead_id: id, status: 'pret' } }).catch(function () { return null; });
    bilan.doublons = (bilan.doublons || 0) + 1;
  }
  // 5. les tâches données à des automates : personne ne les lira jamais
  const jobs = await db.select('hq_agents', { select: 'id,name', eq: { kind: 'job' } }).catch(function () { return []; });
  if (jobs.length) {
    const ouvertes = await db.select('hq_tasks', { select: 'id,agent_id', eq: { status: 'a_faire' }, in: { agent_id: jobs.map(function (a) { return a.id; }) }, limit: 500 }).catch(function () { return []; });
    for (const t of ouvertes) {
      const a = jobs.find(function (x) { return x.id === t.agent_id; });
      await db.update('hq_tasks', { status: 'fait', result: 'Close par l\'audit : ' + ((a && a.name) || t.agent_id) + ' est un automate, il ne lit pas les tâches (son travail est fixé par son programme).', done_at: nowIso() }, { eq: { id: t.id } });
      bilan.taches++;
    }
  }
  return bilan;
}

/* ── état du groupe ── */
async function charger(db) {
  const [cfgs, companies, agents, jour] = await Promise.all([
    db.select('hq_config', { in: { key: ['budget'] } }),
    db.select('hq_companies', { order: 'floor_order.asc' }),
    db.select('hq_agents', { order: 'seat.asc' }),
    db.one('hq_daily', { eq: { day: jourGP() } })
  ]);
  const b = cfgs.find(function (c) { return c.key === 'budget'; });
  const budget = Object.assign({}, BUDGET_DEFAUT, (b && b.value) || {});
  const env = {
    db: db, companies: companies, agents: agents, budget: budget,
    depense: Number((jour && jour.cost_usd) || 0), recherches: (jour && jour.searches) || 0, places: (jour && jour.places) || 0
  };
  // Novalemo passe en premier : les autres entreprises s'arrêtent à 60 % du plafond du jour ; dans Novalemo, ceux qui
  // répondent aux clients gardent une réserve (le reste s'arrête à 85 %) : un prospect qui écrit n'attend jamais le
  // lendemain parce que la critique ou les aperçus ont tout pris
  env.peutDepenser = function (agent) {
    const plafond = Number(budget.jour_usd || 0);
    const part = !agent ? 1 : agent.company_id !== 'novalemo' ? 0.6 : RESERVE_CLIENTS.indexOf(agent.id) >= 0 ? 1 : 0.85;
    return env.depense < part * plafond;
  };
  env.budgetEtat = { depense: env.depense, plafond: Number(budget.jour_usd || 0), envoi_auto: !!budget.envoi_auto };
  return env;
}

/* ── un agent a-t-il quelque chose d'utile à faire ? (sinon on ne paie pas) ── */
async function aDuTravail(db, agent, c) {
  if (c.neuf > 0) return { oui: true };
  const depuis = agent.last_run_at ? Date.now() - new Date(agent.last_run_at).getTime() : Infinity;
  if (RANG[agent.tier] >= 1) {
    if (!agent.last_run_at || depuis > 24 * 3600000 || agent.tier === 'rh') return { oui: true };
    return { oui: false, raison: 'Rien de neuf depuis mon dernier passage, je repasse plus tard.' };
  }
  if (agent.id === 'redacteur') {
    const q = { eq: { status: 'a_contacter' } };
    if (require('./sites/vercel').branche()) q.in = { apercu_etat: ['publie', 'echec'] };
    return (await db.count('hq_leads', q)) > 0 ? { oui: true } : { oui: false, raison: 'Aucun prospect prêt à contacter (les aperçus se fabriquent).' };
  }
  if (agent.id === 'relanceur') return (await db.count('hq_outbox', { eq: { status: 'envoye' }, lte: { sent_at: new Date(Date.now() - 4 * 86400000).toISOString() } })) > 0 ? { oui: true } : { oui: false, raison: 'Aucun email envoyé à relancer.' };
  if (agent.id === 'analyste') return (await db.count('hq_leads', {})) > 0 ? { oui: true } : { oui: false, raison: 'Pas encore de prospects à analyser.' };
  if (agent.id === 'reponses') return (await db.count('hq_inbox', { eq: { status: 'nouveau', kind: 'reponse' } })) > 0 ? { oui: true } : { oui: false, raison: 'Aucune réponse de prospect à traiter.' };
  // la responsable de l'écriture ne relit que s'il y a assez de messages partis depuis son dernier passage
  if (agent.id === 'plume') {
    const n = await db.count('hq_outbox', { eq: { status: 'envoye' }, in: { kind: ['prospection', 'relance', 'reponse'] }, gte: { sent_at: agent.last_run_at || '1970-01-01T00:00:00.000Z' } });
    return n >= 8 ? { oui: true } : { oui: false, raison: 'Pas assez de messages partis depuis mon dernier passage pour juger (' + n + ').' };
  }
  return { oui: true };
}

function limiterJson(x) {
  if (x == null) return null;
  try { const s = JSON.stringify(x); return s.length <= 20000 ? x : { tronque: true, extrait: s.slice(0, 20000) }; } catch (e) { return null; }
}

async function message(db, m) { await db.insert('hq_messages', Object.assign({ kind: 'rapport' }, m, { body: nettoie(court(m.body, 4000)) }), { returning: false }); }

/* ── le passage d'un agent ── */
async function tourAgent(env, agent) {
  const db = env.db;
  const t0 = new Date();
  const compteurs = { items: 0, leads: 0, emails: 0, messages: 0, places: 0 };
  await db.update('hq_agents', { status: 'working', current_task: 'Au travail', updated_at: t0.toISOString() }, { eq: { id: agent.id } });
  const res = { resume: '', cout: 0, usage: null, ok: true, log: null, modele: null, prochain: null, skip: false, produit: 0 };
  try {
    if (agent.kind === 'job') {
      const job = JOBS[agent.job];
      if (!job) throw new Error('travail inconnu : ' + agent.job);
      const r = await job.run({ db: db, agent: agent, agents: env.agents, budget: env.budget, limite: env.limite, compteurs: compteurs, peutDepenser: function () { return env.peutDepenser(agent); } });
      res.resume = r.resume; res.cout = r.cout || 0; res.usage = r.usage || null; res.modele = r.modele || null; res.prochain = r.prochain_min || null; res.log = r.detail || null; res.produit = r.produit || 0;
      if (r.erreur) res.ok = false;
      if ((r.produit > 0 || r.erreur) && agent.parent_id) {
        const det = r.detail && typeof r.detail === 'object' ? Object.keys(r.detail).map(function (k) { const v = r.detail[k]; return k + ' : ' + (Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : v); }).join('\n') : '';
        await message(db, { from_id: agent.id, to_id: agent.parent_id, company_id: agent.company_id, kind: r.erreur ? 'alerte' : 'rapport', subject: court(r.resume, 110), body: r.resume + (det ? '\n\n' + det : '') });
        compteurs.messages++;
      }
    } else if (agent.kind === 'llm') {
      if (!env.peutDepenser(agent)) {
        res.skip = true; res.resume = 'Budget IA du jour atteint : je reprends demain.';
        res.prochain = Math.max(30, Math.round((minuitGP(new Date(Date.now() + 86400000)).getTime() + 6 * 3600000 - Date.now()) / 60000));
      } else {
        const c = await construire(db, agent, env.agents, env.companies, env.budgetEtat);
        const travail = await aDuTravail(db, agent, c);
        if (!travail.oui) { res.skip = true; res.resume = travail.raison; }
        else {
          const ctxT = { db: db, agent: agent, agents: env.agents, company: env.companies.find(function (x) { return x.id === agent.company_id; }), budget: env.budget, compteurs: compteurs, lirePage: lirePage, peutDepenser: function () { return env.peutDepenser(agent); } };
          const restantes = Math.max(0, (env.budget.recherches_jour || 0) - env.recherches);
          const web = agent.stats && agent.stats.web ? Math.min(agent.stats.web, restantes) : 0;
          const r = await converse({
            tier: MODELS[agent.model] ? agent.model : 'fast', system: c.system, messages: [{ role: 'user', content: c.user }],
            tools: definitions(agent.tools || []), executors: executeurs(ctxT), webSearch: web > 0 ? { max_uses: web } : null,
            maxTokens: agent.model === 'smart' ? 3000 : 2200, maxSteps: RANG[agent.tier] >= 3 ? 9 : 7, maxCout: agent.model === 'smart' ? 0.25 : 0.06
          });
          res.resume = nettoie((r.fin && r.fin.resume) || court(r.texte, 300) || 'Passage terminé.');
          res.prochain = r.fin && r.fin.prochain_passage_min;
          res.cout = r.cout + (compteurs.cout || 0); res.usage = r.usage; res.modele = r.model; res.log = r.log;
          res.produit = compteurs.items + compteurs.emails + compteurs.leads;
          env.recherches += r.usage.searches;
          if (c.lus.length) await db.update('hq_messages', { read_at: nowIso() }, { in: { id: c.lus } });
        }
      }
    }
  } catch (e) {
    res.ok = false;
    res.resume = 'Erreur : ' + court(String(e.message || e), 300);
  }
  const fin = new Date();
  env.depense += res.cout || 0;
  env.budgetEtat.depense = env.depense;
  if (!res.skip) {
    await db.insert('hq_runs', {
      agent_id: agent.id, started_at: t0.toISOString(), ended_at: fin.toISOString(), model: res.modele, ok: res.ok,
      tokens_in: res.usage ? res.usage.in + res.usage.cacheWrite + res.usage.cacheRead : 0, tokens_out: res.usage ? res.usage.out : 0, cache_read: res.usage ? res.usage.cacheRead : 0,
      searches: res.usage ? res.usage.searches : 0, cost_usd: Math.round((res.cout || 0) * 100000) / 100000, summary: court(res.resume, 500), log: limiterJson(res.log)
    }, { returning: false }).catch(function () { /* journal best-effort */ });
  }
  await db.rpc('hq_bump', { p_day: jourGP(), p_cost: res.cout || 0, p_runs: res.skip ? 0 : 1, p_searches: res.usage ? res.usage.searches : 0, p_places: compteurs.places, p_leads: compteurs.leads, p_emails: compteurs.emails, p_items: compteurs.items }).catch(function () {});
  let dans = res.prochain ? Math.max(10, Math.min(10080, Number(res.prochain))) : (agent.cadence_min || 1440);
  if (!res.ok) dans = Math.min(dans, 90);
  const stats = Object.assign({}, agent.stats || {});
  if (!res.skip) { stats.runs = (stats.runs || 0) + 1; stats.cout = Math.round(((stats.cout || 0) + (res.cout || 0)) * 10000) / 10000; stats.produit = (stats.produit || 0) + (res.produit || 0); }
  const patch = { status: res.ok ? 'idle' : 'error', current_task: court(res.resume, 400), next_run_at: new Date(Date.now() + dans * 60000).toISOString(), stats: stats, updated_at: nowIso() };
  if (!res.skip) patch.last_run_at = fin.toISOString();
  await db.update('hq_agents', patch, { eq: { id: agent.id } });
  Object.assign(agent, patch);
  return { id: agent.id, nom: agent.name, resume: res.resume, cout: res.cout || 0, ok: res.ok, saute: res.skip };
}

/* ── un cycle ── */
function estDu(a, maintenant) {
  if (a.kind === 'attente' || a.status === 'paused' || a.status === 'attente') return false;
  if (a.status === 'working') return a.updated_at && (Date.now() - new Date(a.updated_at).getTime()) > 15 * 60000; // passage planté
  return a.next_run_at && new Date(a.next_run_at).getTime() <= maintenant;
}

// Verrous à jeton (le jeton empêche d'effacer le verrou d'un autre) ; base sans la nouvelle signature : ancien appel
async function verrouiller(db, nom, secondes, jeton) {
  try { return await db.rpc('hq_lock', { p_name: nom, p_seconds: secondes, p_owner: jeton }); }
  catch (e) { if (/function|hq_lock/i.test(String(e.message))) return db.rpc('hq_lock', { p_name: nom, p_seconds: secondes }); throw e; }
}
async function deverrouiller(db, nom, jeton) {
  try { await db.rpc('hq_unlock', { p_name: nom, p_owner: jeton }); }
  catch (e) { await db.rpc('hq_unlock', { p_name: nom }).catch(function () {}); }
}

async function cycle(opts) {
  opts = opts || {};
  const db = opts.db || open();
  if (!db) return { ok: false, demo: true, raison: 'Base non branchée (HQ_SUPABASE_KEY absente).' };
  const t0 = Date.now();
  const limite = t0 + (opts.secondes || CYCLE_SECONDES) * 1000;
  // verrou plus long que la limite de la fonction (300 s), à jeton : un passage arrêté le libère en expirant, un passage
  // en retard n'efface jamais celui d'un autre
  // le passage express de WhatsApp a son propre verrou : il ne bloque jamais le cycle des 15 minutes (ni l'inverse)
  const nomVerrou = opts.verrou || 'cycle';
  const jeton = require('crypto').randomBytes(8).toString('hex');
  const verrou = await verrouiller(db, nomVerrou, Math.max(320, (opts.secondes || CYCLE_SECONDES) + 70), jeton);
  if (!verrou) return { ok: true, occupe: true, raison: 'Un passage est déjà en cours.' };
  const passages = [];
  let envoi = null, seme = null, releve = null;
  try {
    seme = await semer(db);
    const env = await charger(db);
    env.limite = limite;
    const maintenant = Date.now();
    let file;
    if (opts.agentId) file = env.agents.filter(function (a) { return a.id === opts.agentId && a.kind !== 'attente'; });
    else file = env.agents.filter(function (a) { return estDu(a, opts.manuel ? maintenant + 30 * 60000 : maintenant); }).sort(function (x, y) {
      const jx = x.kind === 'job' ? -1 : 0, jy = y.kind === 'job' ? -1 : 0;
      return (jx - jy) || (RANG[x.tier] - RANG[y.tier]) || (new Date(x.next_run_at || 0) - new Date(y.next_run_at || 0));
    });
    let k = 0;
    async function ouvrier() {
      while (k < file.length) {
        const a = file[k++];
        const marge = a.kind === 'job' ? 45000 : 80000;
        if (Date.now() > limite - marge) break;
        // Emma peut tourner dans les deux passages (15 minutes et WhatsApp) : jamais deux fois en même temps
        if (EXCLUSIFS.indexOf(a.id) >= 0) {
          const ja = require('crypto').randomBytes(8).toString('hex');
          if (!(await verrouiller(db, 'agent:' + a.id, Math.max(120, Math.round((limite - Date.now()) / 1000) + 60), ja))) continue;
          try { passages.push(await tourAgent(env, a)); } finally { await deverrouiller(db, 'agent:' + a.id, ja); }
          continue;
        }
        passages.push(await tourAgent(env, a));
      }
    }
    await Promise.all(Array(Math.min(AGENTS_EN_PARALLELE, Math.max(1, file.length))).fill(0).map(ouvrier));
    if (!opts.agentId && Date.now() < limite - 40000) {
      try { releve = await BOITE.releve({ db: db }); } catch (e) { releve = { resume: 'Erreur de relève : ' + e.message }; }
      try { const wa = await require('./jobs/whatsapp').releve({ db: db }); if (wa.nouveaux) releve = Object.assign({}, releve, { whatsapp: wa.resume }); } catch (e) { /* WhatsApp indisponible : relevé au prochain passage */ }
      try { envoi = await ENVOI.run({ db: db, budget: env.budget, limite: limite }); } catch (e) { envoi = { resume: 'Erreur d\'envoi : ' + e.message }; }
    }
    return { ok: true, seme: seme, passages: passages, depense_jour: Math.round(env.depense * 1000) / 1000, releve: releve, envoi: envoi, duree_s: Math.round((Date.now() - t0) / 1000) };
  } finally {
    await deverrouiller(db, nomVerrou, jeton);
  }
}
const EXCLUSIFS = ['reponses'];

module.exports = { cycle, semer, charger, tourAgent, aDuTravail, estDu, sieges, JOBS, verrouiller, deverrouiller };
