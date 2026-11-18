// L'API du studio des créatrices (/studio). Ouverte seulement avec la session d'une créatrice (cookie __Host-studio,
// voir lib/createurs/acces.js) et seulement sur son compte ; un POST ne vient que de la page du studio (même origine,
// JSON). Le passage régulier (cron Vercel, CRON_SECRET) fait avancer les vidéos quand personne ne regarde.
'use strict';
const A = require('../lib/acces');
const C = require('../lib/createurs');
const AC = require('../lib/createurs/acces');
const SEC = require('../lib/createurs/secret');
const CL = require('../lib/createurs/claude');
const FAL = require('../lib/createurs/fal');
const E = require('../lib/createurs/equipe');
const F = require('../lib/createurs/fabrication');
const P = require('../lib/createurs/publication');
const IM = require('../lib/createurs/images');
const VX = require('../lib/createurs/voix');
const MSG = require('../lib/createurs/messages');
const CLIP = require('../lib/createurs/clip');
const CH = require('../lib/createurs/chaine');
const B = require('../lib/createurs/bible');
const PS = require('../lib/createurs/personnages');
const DI = require('../lib/createurs/discussion');
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
    styles: C.STYLES,
    // les images IA : les looks (sans ce que l'IA reçoit), les mouvements, le coût à peu près de chaque choix, les modèles
    ia: {
      looks: Object.fromEntries(Object.keys(C.STYLES_IA).map((k) => [k, { nom: C.STYLES_IA[k].nom, court: C.STYLES_IA[k].court, teintes: C.STYLES_IA[k].teintes }])),
      mouvements: C.MOUVEMENTS_IA,
      couts: Object.fromEntries(['court', 'long'].map((f) => [f, Object.fromEntries(Object.keys(C.MOUVEMENTS_IA).map((m) => [m, C.coutIa(f, m)]))])),
      modeles: { image: FAL.MODELES.image.nom, video: FAL.MODELES.video.nom }
    },
    // les voix naturelles (ElevenLabs, sur sa clé fal) : les voix, le prix des 1 000 caractères, le coût à peu près d'une
    // vidéo par langue
    voix_ia: { voix: C.VOIX_IA, modele: FAL.MODELES.voix.nom, mille: FAL.MODELES.voix.mille, couts: { court: C.coutVoix('court', 1), long: C.coutVoix('long', 1) } },
    // les clips (son prompt de réalisateur) : les qualités et leurs modèles, le prix de chaque morceau, les styles de
    // montage, les formats, les sources de musique
    clip: CLIP.catalogue(),
    // la qualité des images IA, les modèles qui animent les scènes (les mêmes que les clips), le coût à peu près de chaque
    // combinaison pour une vidéo courte et une longue
    images_ia: Object.fromEntries(Object.keys(C.IMAGES_IA).map((k) => [k, { nom: C.IMAGES_IA[k].nom, court: C.IMAGES_IA[k].court, prix: C.IMAGES_IA[k].prix() }])),
    modeles_video: C.MODELES_VIDEO,
    couts_ia: Object.fromEntries(['court', 'long'].map((f) => [f, Object.fromEntries(C.MODELES_VIDEO.map((q) => [q, Object.fromEntries(Object.keys(C.MOUVEMENTS_IA).map((m) => [m, Object.fromEntries(Object.keys(C.IMAGES_IA).map((im) => [im, C.coutIa(f, m, q, im)]))]))]))])),
    // la publication : les modes, l'heure de grande écoute de chaque langue (fuseau, heure, pays)
    publication: { modes: C.MODES_PUB, marches: Object.fromEntries(Object.keys(C.LANGUES).map((l) => [l, C.marcheDe(l)])) },
    personnages: { genres: C.GENRES_PERSO, max: C.PERSOS_MAX, photo_max: PS.TAILLE_MAX, portrait: FAL.prixImageClip('1K') },
    limites: { budget_jour: C.BUDGET_MAX, langues: CH.LANGUES_MAX, langues_video: CH.LANGUES_MAX_VIDEO, memoire: C.MEMOIRE_MAX },
    images: IM.branche(), usine: G.branche(), coffre: SEC.disponible()
  };
}
async function relire(db, id) { return db.one('hq_createurs', { eq: { id } }); }
// le compteur des messages : pour une créatrice, ce que Louis lui a écrit ; pour le compte de Louis, ce que toutes les
// créatrices lui ont écrit
async function compteur(db, c) { return C.estLouis(c) ? (await MSG.etatLouis(db, c)).non_lus : MSG.nonLus(db, c.id, 'createur'); }
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
  const out = C.videoPublique(v, avecFichiers ? await F.liens(v, true).catch(() => ({})) : undefined);
  // un clip : ce qu'il reste à payer pour le finir (le prix affiché sur « Tourner le clip »), et les photos de ses
  // personnages (leurs liens signés vieillissent : refaits à chaque lecture)
  if (CLIP.estClip(v) && out.plan.clip) {
    out.plan.clip.a_payer = CLIP.aPayer(v);
    const brut = ((((v.plan || {}).clip || {}).gen || {}).refs || []);
    const photos = brut.filter((j) => j && j.photo).map((j) => j.photo);
    if (photos.length && out.plan.clip.gen) {
      const signes = await ST.liensLecture(photos, 6 * 3600).catch(() => ({}));
      out.plan.clip.gen.refs = out.plan.clip.gen.refs.map((j, i) => (j && brut[i] && brut[i].photo ? Object.assign({}, j, { url: signes[brut[i].photo] || j.url, photo: true }) : j));
    }
  }
  return out;
}

async function lecture(req, res, db, q) {
  if (q.op === 'etat') {
    const s = await AC.session(req, db).catch(() => ({ ok: false }));
    return json(res, 200, { connecte: !!s.ok, moi: s.ok ? C.moi(s.createur, { messages_non_lus: await compteur(db, s.createur) }) : null, catalogue: catalogue() });
  }
  if (q.op === 'invitation') return AC.lireInvitation(req, res, db, q.code);
  const s = await AC.exiger(req, res, db);
  if (!s) return;
  const c = s.createur;
  if (q.op === 'moi') return json(res, 200, { moi: C.moi(c, { messages_non_lus: await compteur(db, c) }) });
  // la messagerie : une créatrice et Louis (la conversation, ouverte : les messages de l'autre passent en lus ; ou juste
  // le compteur). Le compte de Louis lit la conversation de la créatrice choisie (« avec »), et le compteur de toutes.
  if (q.op === 'messages') {
    if (C.estLouis(c)) {
      const x = await MSG.cible(db, c, q.avec);
      if (x.erreur) return json(res, x.code, { erreur: x.erreur });
      const r = await MSG.lister(db, x.createur.id, 'louis', { apres: q.apres, lire: q.lire === '1' });
      return json(res, r.code, Object.assign({ avec: x.createur.id }, r));
    }
    const r = await MSG.lister(db, c.id, 'createur', { apres: q.apres, lire: q.lire === '1' });
    return json(res, r.code, r);
  }
  if (q.op === 'messages_etat') return json(res, 200, C.estLouis(c) ? await MSG.etatLouis(db, c) : { non_lus: await MSG.nonLus(db, c.id, 'createur') });
  // le compte de Louis : ses conversations, une par créatrice
  if (q.op === 'conversations') {
    if (!C.estLouis(c)) return json(res, 403, { erreur: 'réservé au compte de Louis' });
    return json(res, 200, { conversations: await MSG.conversations(db, c) });
  }
  if (q.op === 'videos') {
    const liste = await db.select('hq_crea_videos', { eq: { createur_id: c.id }, order: ['created_at.desc'], limit: 80, select: 'id,createur_id,status,titre,sujet,langue_source,langues,cout_usd,auto,etape,rendus,critique,accroche:script->>accroche,genre:plan->>genre,created_at,updated_at' });
    // les vignettes des vidéos montées (une seule demande de liens pour toute la liste)
    const chemins = {};
    liste.forEach((v) => { const r = v.rendus || {}; const l = r[v.langue_source] && r[v.langue_source].etat === 'fini' ? v.langue_source : Object.keys(r).find((x) => r[x] && r[x].etat === 'fini'); if (l) chemins[v.id] = ST.cheminCrea(c.id, v.id, l, 'vignette.jpg'); });
    const signes = Object.keys(chemins).length ? await ST.liensLecture(Object.values(chemins), 6 * 3600).catch(() => ({})) : {};
    return json(res, 200, { videos: liste.map((v) => C.videoResume(Object.assign({}, v, { vignette: signes[chemins[v.id]] || null }))) });
  }
  if (q.op === 'personnages') return json(res, 200, { personnages: await PS.lister(c) });
  if (q.op === 'discussion') return json(res, 200, await DI.lire(db, c));
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
    const r = await CL.essayerCle(b.cle);
    if (r.erreur) return json(res, 400, { erreur: r.erreur });
    // la clé nettoyée (ce qu'elle a collé peut traîner des espaces ou du texte autour) et, pour une clé personnelle sans
    // espace de travail, l'espace trouvé (pas un secret : il est rangé à côté)
    const secrets = Object.assign({}, c.secrets || {}, { claude: Object.assign(SEC.chiffrer(r.cle, 'claude:' + c.id), { etat: r.credit === false ? 'credit' : 'ok', message: r.avertissement || null, espace: r.espace || null, porteur: !!r.porteur }) });
    c = await majCreateur(db, c, { secrets }, ['Clé Claude branchée', 'se termine par ' + r.cle.slice(-4)]);
    return json(res, 200, { ok: true, avertissement: r.avertissement || null, moi: C.moi(c) });
  }
  if (op === 'cle_claude_supprimer') {
    const secrets = Object.assign({}, c.secrets || {}); delete secrets.claude;
    c = await majCreateur(db, c, { secrets }, ['Clé Claude retirée']);
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'cle_fal') {
    const r = await FAL.essayerCle(b.cle);
    if (r.erreur) return json(res, 400, { erreur: r.erreur });
    const secrets = Object.assign({}, c.secrets || {}, { fal: Object.assign(SEC.chiffrer(r.cle, 'fal:' + c.id), { etat: r.credit === false ? 'credit' : 'ok', message: r.avertissement || null }) });
    c = await majCreateur(db, c, { secrets }, ['Clé fal branchée', 'se termine par ' + r.cle.slice(-4)]);
    return json(res, 200, { ok: true, avertissement: r.avertissement || null, moi: C.moi(c) });
  }
  // la messagerie : préparer l'envoi d'un fichier (un lien signé), puis le message. Une créatrice écrit à Louis ; le
  // compte de Louis écrit, en Louis, à la créatrice choisie (« avec »)
  if (op === 'message_envoi' || op === 'message') {
    let pour = c, auteur = 'createur', corps = b;
    if (C.estLouis(c)) {
      const x = await MSG.cible(db, c, b.avec);
      if (x.erreur) return json(res, x.code, { erreur: x.erreur });
      pour = x.createur; auteur = 'louis';
      corps = { texte: b.texte, pieces: b.pieces, nom: b.nom, type: b.type, taille: b.taille };
    }
    if (op === 'message_envoi') { const r = await MSG.preparerEnvoi(pour.id, corps); return json(res, r.code, r.code === 200 ? { ok: true, chemin: r.chemin, url: r.url, type: r.type } : { erreur: r.erreur }); }
    const r = await MSG.envoyer(db, pour, auteur, corps);
    return json(res, r.code, r.code === 200 ? { ok: true, message: r.message } : { erreur: r.erreur });
  }
  // le compte de Louis : une de ses vidéos prêtes, envoyée aux créatrices choisies, dans les langues choisies
  if (op === 'envoyer_video') {
    if (!C.estLouis(c)) return json(res, 403, { erreur: 'réservé au compte de Louis' });
    const r = await MSG.envoyerVideo(db, c, b);
    return json(res, r.code, r.code === 200 ? { ok: true, envois: r.envois } : { erreur: r.erreur });
  }
  // écouter une voix naturelle avant de la choisir : une phrase dans la langue demandée, sur sa clé fal
  if (op === 'ecouter_voix') {
    const r = await VX.ecouter(db, c, String(b.voix || ''), String(b.langue || ''));
    return json(res, r.code || 200, r.ok ? { ok: true, url: r.url, prix: r.prix } : { erreur: r.erreur });
  }
  if (op === 'cle_fal_supprimer') {
    const secrets = Object.assign({}, c.secrets || {}); delete secrets.fal;
    c = await majCreateur(db, c, { secrets }, ['Clé fal retirée']);
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  if (op === 'uploadpost') {
    const r = await P.essayerCle(b.cle);
    if (r.erreur) return json(res, 400, { erreur: r.erreur });
    const secrets = Object.assign({}, c.secrets || {}, { uploadpost: Object.assign(SEC.chiffrer(r.cle, 'uploadpost:' + c.id), { plan: r.plan, limite: r.limite, profils: r.profils }) });
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
  // ses idées à elle (son carnet) : Maya s'en sert, et le pilote les prend en premier
  if (op === 'idee_ajouter') {
    const titre = court(String(b.titre || '').replace(/[<>]/g, '').trim(), 90);
    if (titre.length < 3) return json(res, 400, { erreur: 'écris ton idée en quelques mots' });
    const idee = { id: Date.now().toString(36) + 'm', titre, angle: court(String(b.angle || '').replace(/[<>]/g, ''), 400), accroche: '', pourquoi: '', source: 'moi', le: iso() };
    c = await majCreateur(db, c, { idees: [idee].concat(c.idees || []).slice(0, 12) });
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  // les questions de la plume avant d'écrire (le petit modèle, moins d'un centime)
  if (op === 'questions') {
    if (C.reglagesDe(c).questions === 'non') return json(res, 200, { ok: true, questions: [] });
    try { const r = await E.poserQuestions(db, c, { sujet: b.sujet, modele: b.modele, format: b.format }); return json(res, 200, { ok: true, questions: r.questions, cout: r.cout }); }
    catch (e) { return json(res, 200, { ok: true, questions: [], avertissement: court(e.message, 200) }); }
  }
  // ses personnages : la photo (un lien d'envoi), puis le personnage
  if (op === 'perso_photo_envoi') { const r = await PS.preparerPhoto(c, b); return json(res, r.code, r.code === 200 ? { ok: true, chemin: r.chemin, url: r.url, type: r.type } : { erreur: r.erreur }); }
  if (op === 'perso_enregistrer') { const r = await PS.enregistrer(db, c, b); return json(res, r.code, r.code === 200 ? { ok: true, personnage: r.personnage, personnages: r.personnages, moi: r.moi, avertissement: r.avertissement } : { erreur: r.erreur }); }
  if (op === 'perso_portrait') { const r = await PS.creerPortrait(db, c, b.id, b.style); return json(res, r.code, r.code === 200 ? { ok: true, personnage: r.personnage, personnages: r.personnages, moi: r.moi, cout: r.cout } : { erreur: r.erreur }); }
  if (op === 'perso_supprimer') { const r = await PS.supprimer(db, c, b.id); return json(res, r.code, r.code === 200 ? { ok: true, personnages: r.personnages, moi: r.moi } : { erreur: r.erreur }); }
  // la conversation avec son équipe
  if (op === 'discuter' || op === 'discussion_confirmer') {
    const r = op === 'discuter' ? await DI.envoyer(db, c, b, { CH }) : await DI.confirmer(db, c, b, { CH });
    if (r.code !== 200) return json(res, r.code, { erreur: r.erreur, code: r.code_erreur || null });
    const c2 = await relire(db, c.id);
    return json(res, 200, Object.assign({}, r, { code: undefined, moi: C.moi(c2, { messages_non_lus: await compteur(db, c2) }) }));
  }
  if (op === 'discussion_effacer') { await DI.effacer(db, c); return json(res, 200, { ok: true, messages: [] }); }
  if (op === 'idee_oublier') {
    c = await majCreateur(db, c, { idees: (c.idees || []).filter((x) => x.id !== String(b.id || '')) });
    return json(res, 200, { ok: true, moi: C.moi(c) });
  }
  // un clip : préparer l'envoi de sa musique (un lien signé, le fichier va droit dans le stockage)
  if (op === 'clip_son_envoi') { const r = await CLIP.preparerSon(c.id, b); return json(res, r.code, r.code === 200 ? { ok: true, chemin: r.chemin, url: r.url, type: r.type } : { erreur: r.erreur }); }
  if (op === 'creer') {
    const idee = b.idee_id ? (c.idees || []).find((x) => x.id === String(b.idee_id)) : null;
    const r = b.genre === 'clip'
      ? await CH.creer(db, c, { genre: 'clip', prompt: b.prompt, format: b.format, qualite: b.qualite, montage: b.montage, bruitages: b.bruitages, valider: b.valider, duree: b.duree, musique: b.musique, personnages: b.personnages })
      : await CH.creer(db, c, { sujet: b.sujet, idee, langues: b.langues, format: b.format, style: b.style, ia: b.ia, modele: b.modele, personnages: b.personnages, voix: b.voix, musique: b.musique, couleur: b.couleur, ton: b.ton, relire: b.relire, publier: b.publier, brief: b.brief, consigne: b.consigne });
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
  if (op === 'valider') r = await CH.valider(db, c, v.id, b.accepte);
  else if (op === 'reecrire') r = await CH.reecrire(db, c, v.id, b.consigne);
  else if (op === 'modifier') r = await CH.modifier(db, c, v.id, { script: b.script, langue: b.langue, texte: b.texte });
  else if (op === 'publier') r = await CH.publier(db, c, v.id, b.choix || null, b.quand);
  else if (op === 'annuler_programmation') r = await CH.annulerProgrammation(db, c, v.id, b.langue || null);
  else if (op === 'ajouter_langues') r = await CH.ajouterLangues(db, c, v.id, b.langues);
  else if (op === 'relancer_montage') r = await CH.relancerMontage(db, c, v.id);
  else if (op === 'marquer_publiee') r = await CH.marquerPubliee(db, c, v.id, String(b.langue || ''), String(b.plateforme || ''), b.lien);
  else if (op === 'reprendre') r = await CH.reprendre(db, c, v.id);
  else if (op === 'refaire') r = await CH.refaireMontage(db, c, v.id, { montage: b.montage, musique: b.musique, bruitages: b.bruitages });
  else if (op === 'sans_ia') r = await CH.sansIa(db, c, v.id);
  // un clip en validation : retoucher un plan (refaire son image, l'enlever), refaire un personnage ; accepter plus de
  // budget quand le clip l'a atteint
  else if (op === 'clip_plan') r = await CLIP.modifierPlan(db, c, v.id, { i: b.i, image: b.image, mouvement: b.mouvement, son: b.son, duree: b.duree, effet: b.effet, refaire: !!b.refaire, consigne: b.consigne, retirer: !!b.retirer });
  else if (op === 'clip_reference') r = await CLIP.refaireReference(db, c, v.id, String(b.element || ''), b.consigne);
  else if (op === 'clip_budget') r = await CLIP.accepterBudget(db, c, v.id, b.accepte);
  else if (op === 'archiver') {
    if (C.AUTOMATIQUES.indexOf(v.status) >= 0 && v.status !== 'fabrication') return json(res, 400, { erreur: 'attends que l\'équipe finisse l\'étape en cours' });
    await db.update('hq_crea_videos', { status: 'archivee', etape: {}, updated_at: iso() }, { eq: { id: v.id } });
    r = { ok: true, video: await maVideo(db, c, v.id) };
  } else if (op === 'supprimer') {
    await F.effacerFichiers(v).catch(() => null);
    await db.remove('hq_crea_videos', { eq: { id: v.id, createur_id: c.id } });
    return json(res, 200, { ok: true, supprimee: true });
  } else return json(res, 400, { erreur: 'opération inconnue' });
  if (r.erreur) return json(res, 400, { erreur: r.erreur, ignorees: r.ignorees || undefined });
  return json(res, 200, { ok: true, video: r.video ? await vueVideo(db, r.video) : null, ignorees: r.ignorees || undefined, langues: r.langues || undefined });
}

// la fonction est coupée à 300 secondes : un appel à Claude qui ne pourrait plus finir avant n'est pas lancé (l'heure de
// coupure est propre à chaque requête, même quand plusieurs partagent une instance)
module.exports = function (req, res) { return CL.avecEcheance(Date.now() + 280000, () => traiter(req, res)); };
async function traiter(req, res) {
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
}
