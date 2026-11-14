// L'API du studio des créatrices (/studio). Ouverte seulement avec la session d'une créatrice (cookie __Host-studio,
// voir lib/createurs/acces.js) et seulement sur son compte ; un POST ne vient que de la page du studio (même origine,
// JSON). Le passage régulier (cron Vercel, CRON_SECRET) fait avancer les vidéos quand personne ne regarde.
'use strict';
const A = require('../lib/acces');
const C = require('../lib/createurs');
const AC = require('../lib/createurs/acces');
const SEC = require('../lib/createurs/secret');
const CL = require('../lib/createurs/claude');
const E = require('../lib/createurs/equipe');
const F = require('../lib/createurs/fabrication');
const P = require('../lib/createurs/publication');
const IM = require('../lib/createurs/images');
const CH = require('../lib/createurs/chaine');
const B = require('../lib/createurs/bible');
const G = require('../lib/studio/github');
const ST = require('../lib/studio/stockage');
const { open } = require('../lib/db');
const { court } = require('../lib/util');

const iso = () => new Date().toISOString();
const json = (res, code, obj) => A.repondre(res, code, obj);
const okId = (x) => /^\d{1,12}$/.test(String(x || ''));

function catalogue() {
  return {
    langues: Object.fromEntries(Object.keys(C.LANGUES).map((l) => [l, { nom: C.LANGUES[l].nom, voix: C.LANGUES[l].voix, defaut: C.LANGUES[l].defaut, vitesse: C.LANGUES[l].vitesse }])),
    naturelles: C.NATURELLES, modeles: Object.fromEntries(Object.keys(B.MODELES).map((k) => [k, { nom: B.MODELES[k].nom, court: B.MODELES[k].court, exemple: B.MODELES[k].exemple }])),
    roles: C.ROLES, ordre: C.ORDRE_ROLES, plateformes: C.PLATEFORMES, musiques: C.MUSIQUES, qualites: C.QUALITES, statuts: C.STATUTS, automatiques: C.AUTOMATIQUES, garde_jours: C.GARDE_JOURS,
    images: IM.branche(), usine: G.branche(), coffre: SEC.disponible()
  };
}
async function relire(db, id) { return db.one('hq_createurs', { eq: { id } }); }
async function majCreateur(db, c, patch, journal) {
  const p = Object.assign({}, patch, { updated_at: iso() });
  if (journal) p.journal = C.ligneJournal(c, journal[0], journal[1]);
  await db.update('hq_createurs', p, { eq: { id: c.id } });
  return relire(db, c.id);
}
function hote(req) { return String((req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '').split(',')[0].trim(); }

async function maVideo(db, c, id) { return okId(id) ? db.one('hq_crea_videos', { eq: { id: Number(id), createur_id: c.id } }) : null; }
async function vueVideo(db, v) {
  const avecFichiers = Object.values(v.rendus || {}).some((r) => r && r.etat === 'fini');
  return C.videoPublique(v, avecFichiers ? await F.liens(v, true).catch(() => ({})) : undefined);
}

async function lecture(req, res, db, q) {
  if (q.op === 'etat') {
    const s = await AC.session(req, db).catch(() => ({ ok: false }));
    return json(res, 200, { connecte: !!s.ok, moi: s.ok ? C.moi(s.createur) : null, catalogue: catalogue() });
  }
  if (q.op === 'invitation') return AC.lireInvitation(req, res, db, q.code);
  const s = await AC.exiger(req, res, db);
  if (!s) return;
  const c = s.createur;
  if (q.op === 'moi') return json(res, 200, { moi: C.moi(c) });
  if (q.op === 'videos') {
    const liste = await db.select('hq_crea_videos', { eq: { createur_id: c.id }, order: ['created_at.desc'], limit: 80, select: 'id,createur_id,status,titre,sujet,langue_source,langues,cout_usd,auto,etape,rendus,critique,accroche:script->>accroche,created_at,updated_at' });
    // les vignettes des vidéos montées (une seule demande de liens pour toute la liste)
    const chemins = {};
    liste.forEach((v) => { const r = v.rendus || {}; const l = r[v.langue_source] && r[v.langue_source].etat === 'fini' ? v.langue_source : Object.keys(r).find((x) => r[x] && r[x].etat === 'fini'); if (l) chemins[v.id] = ST.cheminCrea(c.id, v.id, l, 'vignette.jpg'); });
    const signes = Object.keys(chemins).length ? await ST.liensLecture(Object.values(chemins), 6 * 3600).catch(() => ({})) : {};
    return json(res, 200, { videos: liste.map((v) => C.videoResume(Object.assign({}, v, { vignette: signes[chemins[v.id]] || null }))) });
  }
  if (q.op === 'video') {
    const v = await maVideo(db, c, q.id);
    if (!v) return json(res, 404, { erreur: 'vidéo introuvable' });
    return json(res, 200, { video: await vueVideo(db, v) });
  }
  return json(res, 400, { erreur: 'opération inconnue' });
}

async function action(req, res, db, b) {
  const op = String(b.op || '');
  if (op === 'connexion') return AC.connexion(req, res, db, b);
  if (op === 'invitation') return AC.accepterInvitation(req, res, db, b);
  if (op === 'deconnexion') return AC.deconnexion(req, res, db, !!b.partout);
  const s = await AC.exiger(req, res, db);
  if (!s) return;
  let c = s.createur;
  if (op === 'mdp') return AC.changerMotDePasse(req, res, db, s, b);

  if (op === 'reglages') {
    const r = C.nettoyerReglages(b.reglages || {}, c.reglages);
    c = await majCreateur(db, c, { reglages: r });
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'equipe') {
    c = await majCreateur(db, c, { equipe: C.nettoyerEquipe(b.equipe || {}, c.equipe) });
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'cle_claude') {
    const k = String(b.cle || '').trim();
    const r = await CL.essayerCle(k);
    if (r.erreur) return json(res, 400, { erreur: r.erreur });
    const secrets = Object.assign({}, c.secrets || {}, { claude: Object.assign(SEC.chiffrer(k, 'claude:' + c.id), { etat: r.credit === false ? 'credit' : 'ok', message: r.avertissement || null }) });
    c = await majCreateur(db, c, { secrets }, ['Clé Claude branchée', 'se termine par ' + k.slice(-4)]);
    return json(res, 200, { ok: true, avertissement: r.avertissement || null, moi: C.moi(c) });
  }
  if (op === 'cle_claude_supprimer') {
    const secrets = Object.assign({}, c.secrets || {}); delete secrets.claude;
    c = await majCreateur(db, c, { secrets }, ['Clé Claude retirée']);
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'uploadpost') {
    const k = String(b.cle || '').trim();
    const r = await P.essayerCle(k);
    if (r.erreur) return json(res, 400, { erreur: r.erreur });
    const secrets = Object.assign({}, c.secrets || {}, { uploadpost: Object.assign(SEC.chiffrer(k, 'uploadpost:' + c.id), { plan: r.plan, limite: r.limite, profils: r.profils }) });
    c = await majCreateur(db, c, { secrets }, ['upload-post branché', r.profils.length + ' profil(s)']);
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'uploadpost_supprimer') {
    const secrets = Object.assign({}, c.secrets || {}); delete secrets.uploadpost;
    c = await majCreateur(db, c, { secrets }, ['upload-post retiré']);
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'uploadpost_profils' || op === 'uploadpost_creer_profil') {
    let r;
    try { r = op === 'uploadpost_profils' ? await P.profils(c) : await P.creerProfil(c, String(b.nom || '').trim()); }
    catch (e) { return json(res, 400, { erreur: court(e.message, 200) }); }
    const secrets = Object.assign({}, c.secrets || {});
    secrets.uploadpost = Object.assign({}, secrets.uploadpost, { plan: r.plan, limite: r.limite, profils: r.profils, maj_le: iso() });
    c = await majCreateur(db, c, { secrets });
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'uploadpost_connecter') {
    try { return json(res, 200, { ok: true, url: await P.lienConnexion(c, String(b.profil || ''), 'https://' + hote(req) + '/studio#connexions', C.reglagesDe(c).theme.mode) }); }
    catch (e) { return json(res, 400, { erreur: court(e.message, 200) }); }
  }

  if (op === 'idees') {
    try {
      const recentes = await db.select('hq_crea_videos', { eq: { createur_id: c.id }, order: ['created_at.desc'], limit: 25, select: 'titre' });
      const r = await E.proposerIdees(db, c, { theme: b.theme, deja: recentes.map((x) => x.titre).filter(Boolean).concat((c.idees || []).map((x) => x.titre)), recherches: C.reglagesDe(c).tendances && b.tendances !== false });
      c = await relire(db, c.id);
      c = await majCreateur(db, c, { idees: r.idees.concat(c.idees || []).slice(0, 10) });
      return json(res, 200, { ok: true, idees: r.idees, cout: r.cout, moi: C.moi(c) });
    } catch (e) { return json(res, e.code === 'budget' || /^cle|credit/.test(e.code || '') ? 402 : 400, { erreur: court(e.message, 300), code: e.code || null }); }
  }
  if (op === 'idee_oublier') {
    c = await majCreateur(db, c, { idees: (c.idees || []).filter((x) => x.id !== String(b.id || '')) });
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'creer') {
    const idee = b.idee_id ? (c.idees || []).find((x) => x.id === String(b.idee_id)) : null;
    const r = await CH.creer(db, c, { sujet: b.sujet, idee, langues: b.langues, format: b.format, style: b.style, modele: b.modele });
    if (r.erreur) return json(res, 400, { erreur: r.erreur });
    return json(res, 200, { ok: true, video: await vueVideo(db, r.video) });
  }

  // les opérations sur une de ses vidéos
  const v = await maVideo(db, c, b.id);
  if (!v) return json(res, 404, { erreur: 'vidéo introuvable' });
  let r;
  if (op === 'avancer') {
    r = await CH.avancer(db, c.id, v.id);
    const f = r.video || await maVideo(db, c, v.id);
    return json(res, 200, { ok: true, fait: r.fait || null, erreur: r.erreur || null, occupe: !!r.occupe, video: f ? await vueVideo(db, f) : null });
  }
  if (op === 'valider') r = await CH.valider(db, c, v.id);
  else if (op === 'reecrire') r = await CH.reecrire(db, c, v.id, b.consigne);
  else if (op === 'modifier') r = await CH.modifier(db, c, v.id, { script: b.script, langue: b.langue, texte: b.texte });
  else if (op === 'publier') r = await CH.publier(db, c, v.id, b.choix || null);
  else if (op === 'marquer_publiee') r = await CH.marquerPubliee(db, c, v.id, String(b.langue || ''), String(b.plateforme || ''), b.lien);
  else if (op === 'reprendre') r = await CH.reprendre(db, c, v.id);
  else if (op === 'refaire') r = await CH.refaireMontage(db, c, v.id);
  else if (op === 'archiver') {
    if (C.AUTOMATIQUES.indexOf(v.status) >= 0 && v.status !== 'fabrication') return json(res, 400, { erreur: 'attends que l\'équipe finisse l\'étape en cours' });
    await db.update('hq_crea_videos', { status: 'archivee', etape: {}, updated_at: iso() }, { eq: { id: v.id } });
    r = { ok: true, video: await maVideo(db, c, v.id) };
  } else if (op === 'supprimer') {
    await F.effacerFichiers(v).catch(() => null);
    await db.remove('hq_crea_videos', { eq: { id: v.id, createur_id: c.id } });
    return json(res, 200, { ok: true, supprimee: true });
  } else return json(res, 400, { erreur: 'opération inconnue' });
  if (r.erreur) return json(res, 400, { erreur: r.erreur });
  return json(res, 200, { ok: true, video: r.video ? await vueVideo(db, r.video) : null });
}

module.exports = async function (req, res) {
  try {
    const db = open();
    if (!db) return json(res, 503, { erreur: 'la base de la tour n\'est pas branchée' });
    if (req.method === 'GET') {
      const q = req.query || Object.fromEntries(new URL(req.url || '/', 'http://x').searchParams);
      // le passage régulier (cron Vercel : GET /api/studio avec « Authorization: Bearer CRON_SECRET »)
      if (q.tick || (!q.op && req.headers && req.headers.authorization)) {
        if (!A.cronAutorise(req)) return json(res, 401, { erreur: 'refusé' });
        return json(res, 200, await CH.tick(db, { secondes: 230 }));
      }
      return lecture(req, res, db, q);
    }
    if (req.method === 'POST') {
      if (!A.memeOrigine(req)) return json(res, 403, { erreur: 'à faire depuis la page du studio' });
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      return action(req, res, db, b || {});
    }
    return json(res, 405, { erreur: 'méthode non autorisée' });
  } catch (e) {
    return json(res, 500, { erreur: court(String(e.message || e), 300) });
  }
};
