// La chaîne d'une vidéo, de l'idée à la publication. Chaque appel à avancer() fait UNE étape (un appel à Claude, une
// recherche d'images, un lancement de montage, un envoi ou un suivi de publication) puis rend la main : la page de la
// créatrice l'appelle en boucle quand elle regarde, le passage régulier (toutes les 5 minutes) quand elle n'est pas là.
// Un verrou par vidéo empêche deux étapes en même temps. Une erreur passagère est réessayée plus tard (4 fois) ;
// une erreur qu'elle seule peut régler (clé Claude ou fal, crédit, budget du jour) met la vidéo en attente, avec le
// message clair, et l'équipe reprend toute seule dès que c'est réglé (nouvelle clé, nouveau jour, budget monté).
//   ecriture (script, critique, réécriture) → relecture (elle valide) → langues → realisation (les voix naturelles
//   sur sa clé fal, puis les images : Pexels choisies par Lou, ou images IA en plusieurs tours) → fabrication (montage
//   par langue) → prete → publication → publiee
// Un clip (son prompt de réalisateur, lib/createurs/clip.js) passe par les mêmes étapes : ecriture (le découpage en
// plans) → realisation (les images) → relecture (si elle valide les images) → realisation (le tournage) → fabrication.
// Une langue ajoutée à une vidéo déjà faite (etape.ajout) repasse par langues → realisation (sa voix seulement, les images
// restent) → fabrication (son montage seulement) → le statut d'avant (prête, ou publiée).
// La publication automatique (depuis le 18 novembre 2026) : chaque langue montée part selon sa règle (Réglages,
// Publication : tel profil, donc telle chaîne YouTube, tel compte TikTok ; tout de suite ou à l'heure de grande écoute
// du pays), programmée par la tour elle-même (publication.<langue>.plateformes.<p>.etat = programmee, prevu_le).
'use strict';
const crypto = require('crypto');
const C = require('./index');
const B = require('./bible');
const E = require('./equipe');
const IM = require('./images');
const IA = require('./ia');
const F = require('./fabrication');
const VX = require('./voix');
const CLIP = require('./clip');
const P = require('./publication');
const G = require('../studio/github');
const ST = require('../studio/stockage');
const { majFraiche } = require('../db');
const { court } = require('../util');

const iso = () => new Date().toISOString();
const MAX_EN_COURS = 15;        // vidéos en route en même temps, par compte
const MAX_JOUR = 30;            // vidéos lancées par jour, par compte (le budget du jour reste le vrai plafond)
const ESSAIS_ETAPE = 4;
const PROPRIO = 'studio-' + crypto.randomBytes(4).toString('hex');
const BLOQUANTES = { budget: 'budget', budget_clip: 'budget_clip', cle_absente: 'cle', cle_illisible: 'cle', cle_refusee: 'cle', cle_espace: 'cle', credit: 'credit', fal_absente: 'fal', fal_illisible: 'fal', fal_refusee: 'fal', fal_credit: 'credit_fal' };

async function verrou(db, id, s) {
  try { return (await db.rpc('hq_lock', { p_name: 'crea:v:' + id, p_seconds: s || 280, p_owner: PROPRIO })) !== false; }
  catch (e) { return true; }
}
async function liberer(db, id) { await db.rpc('hq_unlock', { p_name: 'crea:v:' + id, p_owner: PROPRIO }).catch(() => null); }
const maj = (db, id, fn) => majFraiche(db, 'hq_crea_videos', id, fn);
const ajout = (f, cout) => Math.round(((Number(f.cout_usd) || 0) + (Number(cout) || 0)) * 10000) / 10000;

// la créatrice vue par l'équipe pour UNE vidéo : ce qu'elle a choisi pour cette vidéo passe avant ses réglages (le format,
// le look et les images IA, la musique, la couleur, la voix, le ton)
function pourVideo(createur, v) {
  const plan = (v && v.plan) || {};
  const r = createur.reglages || {};
  const o = {};
  if (plan.format) o.format = plan.format;
  if (plan.style) o.style = plan.style;
  if (plan.ia) o.ia = plan.ia;
  if (plan.musique_choisie) o.musique = plan.musique_choisie;
  if (plan.couleur_choisie) o.couleur = plan.couleur_choisie;
  if (plan.voix_choisie === 'gratuite') o.voix_ia = Object.assign({}, r.voix_ia || {}, { actif: false });
  else if (plan.voix_choisie && C.VOIX_IA[plan.voix_choisie]) o.voix_ia = Object.assign({}, r.voix_ia || {}, { actif: true, voix: plan.voix_choisie });
  if (plan.ton) o.chaine = Object.assign({}, r.chaine || {}, { ton: plan.ton });
  return Object.assign({}, createur, { reglages: Object.assign({}, r, o) });
}
// une langue ajoutée à une vidéo faite : ce qu'il faut garder d'une étape à l'autre
const avecAjout = (f, e) => Object.assign(e, ((f && f.etape) || {}).ajout ? { ajout: f.etape.ajout } : {});
function autresLangues(v) { return (v.langues || []).filter((l) => l !== v.langue_source); }
function apresRelecture(v) { return autresLangues(v).some((l) => !(v.traductions || {})[l]) ? 'langues' : 'realisation'; }

/* ── lancer une vidéo ── */
const LANGUES_MAX = 6;          // au lancement ; une vidéo faite peut en recevoir d'autres (« Ajouter une langue »)
const LANGUES_MAX_VIDEO = 12;
// les choix d'une vidéo (« Réglages de cette vidéo ») : la voix, la musique, la couleur, le ton, la relecture, la
// publication, ses personnages ; rien de ce qui n'est pas connu
function optionsVideo(createur, o) {
  const r = C.reglagesDe(createur);
  const out = {};
  if (o.voix && (o.voix === 'gratuite' || C.VOIX_IA[o.voix])) out.voix_choisie = o.voix;
  if (o.musique && C.MUSIQUES[o.musique]) out.musique_choisie = o.musique;
  if (o.couleur && /^#[0-9a-f]{6}$/i.test(String(o.couleur))) out.couleur_choisie = String(o.couleur).toUpperCase();
  const ton = court(String(o.ton || '').replace(/[<>]/g, ''), 200);
  if (ton) out.ton = ton;
  if (o.relire === false) out.relire = false;
  if (o.publier === false) out.publier = false;
  const ids = new Set(r.personnages.map((x) => x.id));
  const persos = (Array.isArray(o.personnages) ? o.personnages : []).map(String).filter((id, i, t) => ids.has(id) && t.indexOf(id) === i).slice(0, 3);
  if (persos.length) out.personnages = persos;
  return out;
}
async function limites(db, createur) {
  const enRoute = await db.count('hq_crea_videos', { eq: { createur_id: createur.id }, in: { status: C.AUTOMATIQUES.concat(['relecture']) } });
  if (enRoute >= MAX_EN_COURS) return { erreur: 'déjà ' + enRoute + ' vidéos en route : laisse l\'équipe finir celles-là d\'abord' };
  const depuis = new Date(Date.now() - 24 * 3600000).toISOString();
  const recentes = await db.count('hq_crea_videos', { eq: { createur_id: createur.id }, gte: { created_at: depuis } });
  if (recentes >= MAX_JOUR) return { erreur: 'déjà ' + recentes + ' vidéos lancées en 24 heures : c\'est le maximum' };
  return null;
}
// un clip : son prompt de réalisateur et ses choix (format, qualité, montage, musique) ; une seule langue, la sienne
async function creerClip(db, createur, o) {
  const p = await CLIP.preparer(createur, o);
  if (p.erreur) return p;
  const lim = await limites(db, createur);
  if (lim) return lim;
  const r = C.reglagesDe(createur);
  const premiere = String(p.clip.prompt).split('\n').map((x) => x.trim()).find(Boolean) || 'Clip';
  const [v] = await db.insert('hq_crea_videos', {
    createur_id: createur.id, status: 'ecriture', sujet: court(p.clip.prompt, 600), titre: court(premiere, 90), langue_source: r.langue_source, langues: [r.langue_source],
    idee: {}, plan: { genre: 'clip', format: 'court', clip: p.clip }, etape: { quoi: 'decoupage', depuis: iso() }, auto: false, rendus: {}, traductions: {}, publication: {}, critique: {}, script: {}, updated_at: iso()
  });
  return { ok: true, video: v };
}
async function creer(db, createur, o) {
  o = o || {};
  if (o.genre === 'clip') return creerClip(db, createur, o);
  const r = C.reglagesDe(createur);
  const idee = o.idee && typeof o.idee === 'object' ? { titre: court(o.idee.titre, 90), accroche: court(o.idee.accroche, 160), angle: court(o.idee.angle, 400), pourquoi: court(o.idee.pourquoi, 240) } : {};
  const sujet = court(String(o.sujet || idee.titre || '').replace(/[<>]/g, ''), 600);
  if (sujet.length < 4) return { erreur: 'écris ton idée en quelques mots' };
  const lim = await limites(db, createur);
  if (lim) return lim;
  const langues = (Array.isArray(o.langues) && o.langues.length ? o.langues : r.langues).filter((l, i, t) => C.LANGUES[l] && t.indexOf(l) === i);
  if (langues.indexOf(r.langue_source) < 0) langues.unshift(r.langue_source);
  const plan = { format: ['court', 'long'].indexOf(o.format) >= 0 ? o.format : r.format, style: Object.prototype.hasOwnProperty.call(C.STYLES, o.style) ? o.style : r.style };
  if (plan.style === 'ia') {
    if (!(createur.secrets || {}).fal) return { erreur: 'branche d\'abord ta clé fal (Réglages, Connexions) pour les images IA, ou choisis un autre look' };
    plan.ia = C.nettoyerIa(o.ia, r.ia);
  }
  if (o.modele && B.MODELES[o.modele]) plan.modele = o.modele;
  Object.assign(plan, optionsVideo(createur, o));
  // ses réponses aux questions de l'équipe (avant d'écrire)
  const brief = (Array.isArray(o.brief) ? o.brief : []).map((x) => x && { q: court(String(x.q || '').replace(/[<>]/g, ''), 200), r: court(String(x.r || '').replace(/[<>]/g, ''), 300) }).filter((x) => x && x.q && x.r).slice(0, 5);
  if (brief.length) idee.brief = brief;
  const consigne = court(String(o.consigne || '').replace(/[<>]/g, ''), 600) || null;
  const [v] = await db.insert('hq_crea_videos', {
    createur_id: createur.id, status: 'ecriture', sujet, titre: idee.titre || court(sujet, 90), langue_source: r.langue_source, langues: langues.slice(0, LANGUES_MAX),
    idee, plan, etape: { quoi: 'script', depuis: iso(), consigne }, auto: !!o.auto, rendus: {}, traductions: {}, publication: {}, critique: {}, script: {}, updated_at: iso()
  });
  // l'idée choisie quitte sa liste (relue fraîche : la liste a pu changer entre-temps)
  if (o.idee && o.idee.id) {
    const frais = await db.one('hq_createurs', { eq: { id: createur.id }, select: 'id,idees' }).catch(() => null);
    if (frais) await db.update('hq_createurs', { idees: (frais.idees || []).filter((x) => x.id !== o.idee.id), updated_at: iso() }, { eq: { id: createur.id } }).catch(() => null);
  }
  return { ok: true, video: v };
}

/* ── les étapes ── */
async function etapeEcriture(db, c, v) {
  if (CLIP.estClip(v)) return CLIP.decouper(db, c, v);
  const cv = pourVideo(c, v);
  const quoi = (v.etape || {}).quoi || 'script';
  const consigne = (v.etape || {}).consigne || null;
  if (quoi === 'script' || !(v.script && Array.isArray(v.script.beats) && v.script.beats.length)) {
    const res = await E.ecrireScript(db, cv, v, { consigne });
    await maj(db, v.id, (f) => (f.status !== 'ecriture' ? null : { script: res.script, titre: res.script.titre || f.titre, critique: { essais: 0, historique: [] }, cout_usd: ajout(f, res.cout), etape: { quoi: 'critique', depuis: iso() } }));
    return C.equipeDe(c).plume.prenom + ' a écrit le script';
  }
  if (quoi === 'critique') {
    const res = await E.noterScript(db, cv, v);
    const essais = (v.critique || {}).essais || 0;
    const passe = res.critique.note >= B.SEUIL || essais >= B.REECRITURES_MAX;
    const r = C.reglagesDe(c);
    await maj(db, v.id, (f) => {
      if (f.status !== 'ecriture') return null;
      const critique = Object.assign({}, res.critique, { essais, historique: ((f.critique || {}).historique || []).concat([{ note: res.critique.note, le: iso() }]).slice(-6) });
      if (!passe) return { critique, cout_usd: ajout(f, res.cout), etape: { quoi: 'reecriture', corrections: res.critique.corrections, consigne: (f.etape || {}).consigne || null, depuis: iso() } };
      // le pilote sans relecture, ou une vidéo lancée « sans relecture », enchaîne ; sinon la créatrice valide
      const suite = (f.auto && !r.pilote.relire) || (f.plan || {}).relire === false ? apresRelecture(f) : 'relecture';
      return { critique, cout_usd: ajout(f, res.cout), status: suite, etape: { quoi: suite === 'relecture' ? null : suite === 'langues' ? 'langue' : 'images', depuis: iso() } };
    });
    return C.equipeDe(c).critique.prenom + ' a noté le script ' + res.critique.note + '/10';
  }
  // réécriture : avec les corrections de la critique et, s'il y en a une, la consigne de la créatrice
  const res = await E.ecrireScript(db, cv, v, { precedent: v.script, corrections: (v.etape || {}).corrections || [], consigne });
  await maj(db, v.id, (f) => (f.status !== 'ecriture' ? null : { script: res.script, titre: res.script.titre || f.titre, critique: Object.assign({}, f.critique || {}, { essais: ((f.critique || {}).essais || 0) + 1 }), cout_usd: ajout(f, res.cout), etape: { quoi: 'critique', depuis: iso() } }));
  return C.equipeDe(c).plume.prenom + ' a réécrit le script';
}

async function etapeLangues(db, c, v) {
  const manquantes = autresLangues(v).filter((l) => !(v.traductions || {})[l]);
  if (!manquantes.length) {
    await maj(db, v.id, (f) => (f.status !== 'langues' ? null : { status: 'realisation', etape: avecAjout(f, { quoi: 'images', depuis: iso() }) }));
    return null;
  }
  const l = manquantes[0];
  const res = await E.adapter(db, pourVideo(c, v), v, l);
  await maj(db, v.id, (f) => {
    if (f.status !== 'langues') return null;
    const t = Object.assign({}, f.traductions || {}, { [l]: res.version });
    const reste = autresLangues(f).filter((x) => !t[x]);
    return { traductions: t, cout_usd: ajout(f, res.cout), status: reste.length ? 'langues' : 'realisation', etape: avecAjout(f, reste.length ? { quoi: 'langue', langue: reste[0], depuis: iso() } : { quoi: 'images', depuis: iso() }) };
  });
  return C.equipeDe(c).traduction.prenom + ' a écrit la version ' + (C.LANGUES[l] || {}).nom;
}

async function etapeRealisation(db, c, v) {
  if (!G.branche()) { const e = new Error('Le montage n\'est pas encore branché sur la tour : Louis doit brancher l\'usine (sa page Missions).'); e.bloque = 'usine'; throw e; }
  const cv = pourVideo(c, v);
  const r = C.reglagesDe(cv);
  const lou = C.equipeDe(c).realisation.prenom;
  // une langue ajoutée à une vidéo faite : sa voix (si la voix naturelle sert), puis son montage ; les images restent
  const ajoutEnCours = (v.etape || {}).ajout;
  if (ajoutEnCours && !CLIP.estClip(v)) {
    const nouvelles = (ajoutEnCours.langues || []).filter((l) => (v.langues || []).indexOf(l) >= 0);
    if (VX.applicable(cv, v)) {
      const rv = await VX.realiser(db, cv, v, { langues: nouvelles });
      if (!rv.fini) return lou + ' enregistre les voix (' + rv.progres.voix[0] + ' phrases sur ' + rv.progres.voix[1] + ')';
    }
    const out = await maj(db, v.id, (f) => (f.status !== 'realisation' ? null : { status: 'fabrication', etape: avecAjout(f, { quoi: 'montage', depuis: iso() }) }));
    if (out) for (const l of nouvelles) await F.demander(db, out, l);
    return lou + ' lance le montage de ' + nouvelles.map((l) => (C.LANGUES[l] || {}).nom || l).join(', ');
  }
  // un clip : les images puis le tournage, en plusieurs tours ; quand tous les plans sont là, le montage
  if (CLIP.estClip(v)) {
    const rc = await CLIP.etape(db, c, v);
    if (!rc || !rc.pret) return rc;
    const out = await maj(db, v.id, (f) => (f.status !== 'realisation' ? null : { rendus: {}, status: 'fabrication', etape: { quoi: 'montage', depuis: iso(), note: rc.note } }));
    if (out) for (const l of out.langues || []) await F.demander(db, out, l);
    return lou + ' a tous les plans et lance le montage';
  }
  // les voix naturelles d'abord (quelques secondes par phrase, sur sa clé fal) : tant qu'il en reste, la vidéo reste ici
  if (VX.applicable(cv, v)) {
    const rv = await VX.realiser(db, cv, v);
    if (!rv.fini) return lou + ' enregistre les voix (' + rv.progres.voix[0] + ' phrases sur ' + rv.progres.voix[1] + ')';
    v = await db.one('hq_crea_videos', { eq: { id: v.id } });
    if (!v || v.status !== 'realisation') return null;
  }
  let plan = Object.assign({}, v.plan || {});
  plan.style = plan.style || r.style;
  let note = null, coutImages = 0;
  if (plan.style === 'ia') {
    // les images IA se font en plusieurs tours : tant que fal travaille, la vidéo reste ici
    const res = await IA.realiser(db, c, v);
    if (!res.fini) {
      const p = res.progres;
      return lou + (p.images[0] < p.images[1] ? ' fait créer les images IA (' + p.images[0] + ' sur ' + p.images[1] + ')' : ' fait animer les scènes (' + p.videos[0] + ' sur ' + p.videos[1] + ')');
    }
    const frais = await db.one('hq_crea_videos', { eq: { id: v.id } });
    if (!frais || frais.status !== 'realisation') return null;
    plan = Object.assign({}, frais.plan || {}, { style: 'ia' });
    const a = await IA.assembler(frais.script || {}, res.generation);
    plan.clips = a.clips; plan.credits = a.credits; plan.manquants = a.manquants;
    note = a.avertissement;
  } else if (plan.style === 'clips') {
    // Lou réunit plusieurs vidéos par phrase et fait choisir celle qui montre vraiment ce qui est dit (sinon une image
    // créée sur sa clé fal, sinon le fond animé)
    const res = await IM.choisirAvecLou(db, c, v);
    plan.clips = res.clips; plan.credits = res.credits; plan.manquants = res.manquants;
    if (res.avertissement) note = res.avertissement;
    coutImages = res.cout || 0;
  } else { plan.clips = []; plan.credits = []; }
  plan.couleur = r.couleur; plan.musique = r.musique;
  plan.choisi_le = iso();
  const out = await maj(db, v.id, (f) => (f.status !== 'realisation' ? null : { plan, rendus: {}, status: 'fabrication', cout_usd: ajout(f, coutImages), etape: { quoi: 'montage', depuis: iso(), note } }));
  if (out) for (const l of out.langues || []) await F.demander(db, out, l);
  return lou + (plan.style === 'texte' ? ' a lancé le montage' : plan.style === 'ia' ? ' a toutes les images IA et lance le montage' : ' a choisi les images et lancé le montage');
}

async function etapeFabrication(db, c, v) {
  await F.perimer(db, v);
  let f = await db.one('hq_crea_videos', { eq: { id: v.id } });
  if (!f || f.status !== 'fabrication') return null;
  const relance = F.aMonter(f);
  for (const l of relance) await F.demander(db, f, l);
  f = await db.one('hq_crea_videos', { eq: { id: v.id } });
  const r = f.rendus || {};
  const enCours = (f.langues || []).some((l) => r[l] && r[l].etat === 'demande');
  if (enCours || F.aMonter(f).length) return relance.length ? 'montage relancé (' + relance.join(', ') + ')' : null;
  const finies = (f.langues || []).filter((l) => r[l] && (r[l].etat === 'fini' || r[l].etat === 'efface'));
  const ratees = (f.langues || []).filter((l) => !r[l] || (r[l].etat !== 'fini' && r[l].etat !== 'efface'));
  const noms = (ls) => ls.map((l) => (C.LANGUES[l] || {}).nom || l).join(', ');
  await maj(db, f.id, (x) => (x.status !== 'fabrication' ? null : finies.length
    ? { status: F.statutFini(x), etape: { quoi: null, depuis: iso(), note: ratees.length ? 'montage raté pour : ' + noms(ratees) + ' (« Relancer le montage raté » pour réessayer)' : null } }
    : { status: 'echec', etape: { quoi: 'montage', statut_avant: 'realisation', erreur: 'Le montage a échoué : ' + court((r[ratees[0]] || {}).erreur || 'raison inconnue', 300), depuis: iso() } }));
  return finies.length ? 'vidéo prête' : 'montage raté';
}

// le texte publié d'une langue (celui du script, ou celui qu'elle a retouché avant de publier)
function textePublication(v, l) {
  const s = l === v.langue_source ? (v.script || {}) : ((v.traductions || {})[l] || {});
  const retouche = ((v.publication || {})[l] || {}).texte || {};
  return { titre: retouche.titre || s.titre || v.titre, titre_youtube: retouche.titre_youtube || s.titre_youtube || s.titre || v.titre, description: retouche.description != null ? retouche.description : s.description, hashtags: retouche.hashtags || s.hashtags || [] };
}

async function etapePublication(db, c, v) {
  // les envois programmés dont l'heure est venue partent
  const maintenant = Date.now();
  const dus = [];
  Object.keys(v.publication || {}).forEach((l) => Object.keys((v.publication[l] || {}).plateformes || {}).forEach((p) => {
    const x = v.publication[l].plateformes[p];
    if (x && x.etat === 'programmee' && new Date(x.prevu_le || 0).getTime() <= maintenant + 30000) dus.push([l, p]);
  }));
  if (dus.length) {
    v = (await maj(db, v.id, (f) => {
      if (f.status !== 'publication') return null;
      const p = JSON.parse(JSON.stringify(f.publication || {}));
      dus.forEach(([l, x]) => { const cur = ((p[l] || {}).plateformes || {})[x]; if (cur && cur.etat === 'programmee') p[l].plateformes[x] = Object.assign({}, cur, { etat: 'a_envoyer' }); });
      return { publication: p };
    })) || v;
  }
  const pub = v.publication || {};
  const fait = [];
  for (const l of Object.keys(pub)) {
    const pl = Object.keys(pub[l].plateformes || {});
    const aEnvoyer = pl.filter((p) => pub[l].plateformes[p].etat === 'a_envoyer');
    if (aEnvoyer.length) {
      // upload-post va chercher la vidéo lui-même : un lien de lecture de 24 heures ; le profil retenu au moment de la
      // programmation (la chaîne choisie alors), sinon celui de la règle
      const chemin = ST.cheminCrea(v.createur_id, v.id, l, 'video.mp4');
      let res = null, err = null;
      try {
        const url = (await ST.liensLecture([chemin], 24 * 3600))[chemin];
        if (!url) throw new Error('le fichier de la vidéo est introuvable (refais le montage)');
        res = await P.publier(c, v, l, aEnvoyer, url, textePublication(v, l), pub[l].plateformes[aEnvoyer[0]].profil || null);
      } catch (e) { err = e; }
      await maj(db, v.id, (f) => {
        const p = JSON.parse(JSON.stringify(f.publication || {}));
        if (!p[l]) return null;
        aEnvoyer.forEach((x) => { const profil = ((p[l].plateformes || {})[x] || {}).profil || null; p[l].plateformes[x] = err ? { etat: 'echec', erreur: court(err.message, 240), le: iso(), profil } : { etat: 'en_cours', requete: res.requete, envoye_le: iso(), profil }; });
        return { publication: p };
      });
      fait.push(l + (err ? ' : refusé (' + court(err.message, 80) + ')' : ' envoyée'));
      continue;
    }
    const enCours = pl.filter((p) => pub[l].plateformes[p].etat === 'en_cours');
    const requetes = Array.from(new Set(enCours.map((p) => pub[l].plateformes[p].requete).filter(Boolean)));
    for (const q of requetes) {
      let s;
      try { s = await P.suivre(c, q); } catch (e) { continue; }
      const envoye = Math.min.apply(null, enCours.map((p) => new Date(pub[l].plateformes[p].envoye_le || Date.now()).getTime()));
      const tropLong = Date.now() - envoye > 3 * 3600000;
      await maj(db, v.id, (f) => {
        const p = JSON.parse(JSON.stringify(f.publication || {}));
        if (!p[l]) return null;
        Object.keys(p[l].plateformes || {}).forEach((x) => {
          const cur = p[l].plateformes[x];
          if (cur.etat !== 'en_cours' || cur.requete !== q) return;
          const r = s.resultats[x];
          if (r && r.ok) p[l].plateformes[x] = { etat: 'publiee', lien: r.lien, le: iso(), message: r.message || null, profil: cur.profil || null };
          else if (r && (s.fini || r.message) && !r.ok && (s.fini || /fail|error|refus|denied/i.test(r.message))) p[l].plateformes[x] = { etat: 'echec', erreur: r.message || 'refusé par la plateforme', le: iso(), profil: cur.profil || null };
          else if ((s.fini && !r) || s.perdu || tropLong) p[l].plateformes[x] = { etat: 'echec', erreur: s.perdu ? 'demande perdue chez upload-post' : tropLong ? 'pas de réponse après 3 heures' : (s.message || 'pas de résultat pour cette plateforme'), le: iso(), profil: cur.profil || null };
        });
        return { publication: p };
      });
      fait.push(l + ' suivie');
    }
  }
  // tout est parti ou retombé : la vidéo est publiée (au moins une plateforme), sinon elle redevient prête ; ce qui est
  // programmé plus tard la garde ici, endormie jusqu'à l'heure du premier envoi
  const f = await db.one('hq_crea_videos', { eq: { id: v.id } });
  if (!f || f.status !== 'publication') return fait.join(', ') || null;
  const etats = [], prevus = [];
  Object.keys(f.publication || {}).forEach((l) => Object.keys((f.publication[l] || {}).plateformes || {}).forEach((p) => { const x = f.publication[l].plateformes[p]; etats.push(x.etat); if (x.etat === 'programmee') prevus.push(new Date(x.prevu_le || 0).getTime()); }));
  if (etats.some((e) => e === 'a_envoyer' || e === 'en_cours')) {
    await maj(db, f.id, (x) => (x.status !== 'publication' ? null : { etape: Object.assign({}, x.etape || {}, { quoi: 'suivi', attendre_jusqu: new Date(Date.now() + 60000).toISOString() }) }));
    return fait.join(', ') || null;
  }
  if (prevus.length) {
    const t = Math.max(Date.now() + 60000, Math.min.apply(null, prevus));
    await maj(db, f.id, (x) => (x.status !== 'publication' ? null : { etape: Object.assign({}, x.etape || {}, { quoi: 'programmee', attendre_jusqu: new Date(t).toISOString() }) }));
    return fait.join(', ') || null;
  }
  const ok = etats.some((e) => e === 'publiee' || e === 'manuelle');
  await maj(db, f.id, (x) => (x.status !== 'publication' ? null : { status: ok ? 'publiee' : 'prete', etape: { quoi: null, depuis: iso(), note: etats.some((e) => e === 'echec') ? 'certaines publications ont échoué : ouvre la vidéo pour voir pourquoi' : null } }));
  return ok ? 'publiée' : 'publication ratée';
}

/* ── la publication, langue par langue ── */
// l'écart (ms) entre l'heure d'un fuseau et l'heure universelle, à un instant donné
function decalage(fuseau, t) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuseau, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t));
  const g = (k) => Number((p.find((x) => x.type === k) || {}).value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - Math.floor(t / 1000) * 1000;
}
// l'instant d'une heure locale (le jour j après aujourd'hui, à h heures, dans le fuseau)
function instantLocal(fuseau, j, h, depuis) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(depuis));
  const g = (k) => Number((p.find((x) => x.type === k) || {}).value);
  const brut = Date.UTC(g('year'), g('month') - 1, g('day') + j, h, 0, 0);
  let t = brut - decalage(fuseau, brut);
  const d2 = decalage(fuseau, t);
  if (brut - d2 !== t) t = brut - d2;
  return t;
}
// Le prochain créneau de grande écoute pour une langue : l'heure de sa règle, dans le fuseau du pays visé ; pas deux
// envois du même profil à moins de 100 minutes (le suivant passe 2 heures plus tard, trois par jour au plus, puis le
// lendemain). « prises » : les créneaux déjà pris, par profil (complétée au fil des choix).
function creneau(regle, prises, depuis) {
  const t0 = depuis || Date.now();
  const deja = prises[regle.profil] || (prises[regle.profil] = []);
  for (let j = 0; j < 30; j++) {
    for (let k = 0; k < 3; k++) {
      const h = regle.heure + 2 * k;
      if (h > 23) break;
      const t = instantLocal(regle.fuseau, j, h, t0);
      if (t < t0 + 5 * 60000) continue;
      if (deja.some((x) => Math.abs(x - t) < 100 * 60000)) continue;
      deja.push(t);
      return t;
    }
  }
  return t0 + 3600000;
}
// les créneaux déjà pris par ses vidéos programmées, par profil
async function creneauxPris(db, c) {
  const prises = {};
  const l = await db.select('hq_crea_videos', { eq: { createur_id: c.id, status: 'publication' }, select: 'id,publication', limit: 60 }).catch(() => []);
  l.forEach((v) => Object.keys(v.publication || {}).forEach((lg) => Object.keys((v.publication[lg] || {}).plateformes || {}).forEach((p) => {
    const x = v.publication[lg].plateformes[p];
    if (x && x.etat === 'programmee' && x.profil) (prises[x.profil] = prises[x.profil] || []).push(new Date(x.prevu_le).getTime());
  })));
  return prises;
}
const nomL = (l) => (C.LANGUES[l] || {}).nom || l;
// Ce qui peut partir d'une vidéo, langue par langue, et pourquoi le reste ne part pas. o = { langues, choix (plateformes
// par langue), quand ('maintenant' | 'programme' | 'regle'), manuel (elle a appuyé : chaque refus est dit), auto (le pilote
// ou une règle automatique : seulement les langues dont la règle publie seule) }
function envoisDe(c, v, o, prises) {
  const r = C.reglagesDe(c);
  const envois = [], ignorees = [];
  const dire = (l, raison) => { if (o.manuel) ignorees.push({ langue: l, nom: nomL(l), raison }); };
  (o.langues || v.langues || []).forEach((l) => {
    const rd = (v.rendus || {})[l] || {};
    if (rd.etat !== 'fini') return dire(l, rd.etat === 'efface' ? 'ses fichiers ont été effacés (gardés 14 jours)' : 'pas encore montée');
    const regle = C.regleDe(r, l);
    if (!regle.profil) return dire(l, 'aucune chaîne choisie pour cette langue : Réglages, Publication');
    let pl = regle.plateformes.slice();
    if (o.choix && Array.isArray(o.choix[l])) pl = o.choix[l].filter((x) => pl.indexOf(x) >= 0);
    if (!pl.length) return dire(l, 'aucune plateforme cochée pour cette langue : Réglages, Publication');
    if (o.auto) {
      const pilote = v.auto && r.pilote.publier;
      if (regle.mode === 'bouton' && !pilote) return;
      if (((v.plan || {}).publier) === false) return;
      // déjà planifiée une fois (partie, ratée, ou programmée puis annulée par elle) : plus rien ne part tout seul
      if (((v.publication || {})[l] || {}).planifie_le) return;
      // une règle allumée ne publie que les vidéos montées après (jamais d'un coup les vieilles) ; le pilote non plus,
      // quand le profil de la langue vient d'être choisi
      if (!pilote && regle.depuis && String(rd.fini_le || '') < regle.depuis) return;
      if (pilote && regle.le && String(rd.fini_le || '') < regle.le) return;
    }
    const quand = o.quand === 'maintenant' || o.quand === 'programme' ? o.quand : (regle.mode === 'programme' ? 'programme' : 'maintenant');
    const deja = ((v.publication || {})[l] || {}).plateformes || {};
    pl.forEach((x) => {
      const cur = deja[x];
      if (cur && ['publiee', 'manuelle'].indexOf(cur.etat) >= 0) return dire(l, C.PLATEFORMES[x] + ' : déjà publiée');
      if (cur && ['a_envoyer', 'en_cours'].indexOf(cur.etat) >= 0) return dire(l, C.PLATEFORMES[x] + ' : envoi déjà en cours');
      if (cur && cur.etat === 'programmee' && quand !== 'maintenant') return dire(l, C.PLATEFORMES[x] + ' : déjà programmée');
      // une publication ratée ne repart jamais toute seule : elle regarde pourquoi, puis relance
      if (cur && cur.etat === 'echec' && !o.manuel) return;
      envois.push({ langue: l, plateforme: x, profil: regle.profil, prevu: quand === 'programme' ? creneau(regle, prises || {}) : null });
    });
  });
  return { envois, ignorees };
}
// les envois choisis, écrits sur la vidéo (qui passe en publication)
function appliquerEnvois(f, envois) {
  const p = JSON.parse(JSON.stringify(f.publication || {}));
  envois.forEach((x) => {
    p[x.langue] = Object.assign({ plateformes: {} }, p[x.langue] || {});
    p[x.langue].plateformes[x.plateforme] = x.prevu
      ? { etat: 'programmee', prevu_le: new Date(x.prevu).toISOString(), profil: x.profil, demande_le: iso() }
      : { etat: 'a_envoyer', profil: x.profil, demande_le: iso() };
    p[x.langue].planifie_le = iso();
  });
  const tout = envois.some((x) => !x.prevu);
  const premier = envois.filter((x) => x.prevu).map((x) => x.prevu).sort((a, b) => a - b)[0];
  return { publication: p, status: 'publication', etape: { quoi: tout ? 'envoi' : 'programmee', depuis: iso(), attendre_jusqu: tout || !premier ? null : new Date(premier).toISOString() } };
}
// publier (elle a appuyé) : tout de suite, ou à l'heure de grande écoute de chaque langue ; chaque langue qui ne part pas
// dit pourquoi (une langue sans chaîne choisie partait en silence : les vidéos en anglais de Louis ne se publiaient pas)
async function publier(db, c, id, choix, quand) {
  if (!(c.secrets || {}).uploadpost) return { erreur: 'branche d\'abord upload-post (Réglages, Connexions), ou publie à la main' };
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v || ['prete', 'publiee', 'publication'].indexOf(v.status) < 0) return { erreur: 'la vidéo n\'est pas prête' };
  const prises = await creneauxPris(db, c);
  const { envois, ignorees } = envoisDe(c, v, { choix: choix || null, quand: quand === 'programme' ? 'programme' : quand === 'regle' ? 'regle' : 'maintenant', manuel: true, langues: choix ? Object.keys(choix) : null }, prises);
  if (!envois.length) return { erreur: ignorees.length ? ignorees.map((x) => x.nom + ' : ' + x.raison).join(' ; ') : 'rien à publier', ignorees };
  const out = await maj(db, id, (f) => (['prete', 'publiee', 'publication'].indexOf(f.status) < 0 ? null : appliquerEnvois(f, envois)));
  return out ? { ok: true, video: out, ignorees } : { erreur: 'la vidéo a changé entre-temps, recharge' };
}
// La publication automatique d'une vidéo prête (ou publiée, à qui on a ajouté une langue) : chaque langue montée dont la
// règle publie seule part, maintenant ou à son heure. Rend le nombre d'envois prévus.
async function planifierAuto(db, c, v) {
  if (!(c.secrets || {}).uploadpost || ['prete', 'publiee'].indexOf(v.status) < 0) return 0;
  const r = C.reglagesDe(c);
  const pilote = v.auto && r.pilote.publier;
  if (!pilote && !(v.langues || []).some((l) => { const g = C.regleDe(r, l); return g.profil && g.mode !== 'bouton'; })) return 0;
  const prises = await creneauxPris(db, c);
  const { envois } = envoisDe(c, v, { auto: true, quand: 'regle' }, prises);
  if (!envois.length) return 0;
  const out = await maj(db, v.id, (f) => (['prete', 'publiee'].indexOf(f.status) < 0 ? null : appliquerEnvois(f, envois)));
  return out ? envois.length : 0;
}
// annuler ce qui est programmé (une langue, ou tout) : la vidéo redevient prête, ou publiée
async function annulerProgrammation(db, c, id, langue) {
  const out = await maj(db, id, (f) => {
    if (f.createur_id !== c.id || f.status !== 'publication') return null;
    const p = JSON.parse(JSON.stringify(f.publication || {}));
    let n = 0;
    Object.keys(p).forEach((l) => {
      if (langue && l !== langue) return;
      Object.keys(p[l].plateformes || {}).forEach((x) => { if (p[l].plateformes[x].etat === 'programmee') { delete p[l].plateformes[x]; n++; } });
    });
    if (!n) return null;
    const etats = [];
    Object.keys(p).forEach((l) => Object.keys(p[l].plateformes || {}).forEach((x) => etats.push(p[l].plateformes[x].etat)));
    if (etats.some((e) => ['a_envoyer', 'en_cours', 'programmee'].indexOf(e) >= 0)) return { publication: p };
    return { publication: p, status: etats.some((e) => e === 'publiee' || e === 'manuelle') ? 'publiee' : 'prete', etape: { quoi: null, depuis: iso() } };
  });
  return out ? { ok: true, video: out } : { erreur: 'rien de programmé à annuler' };
}

/* ── une étape, avec son verrou et ses erreurs ── */
function debloquer(c, v) {
  const e = v.etape || {};
  if (!e.bloque) return true;
  const claude = (c.secrets || {}).claude;
  const cleNeuve = claude && claude.le && claude.le > (e.depuis || '');
  const fal = (c.secrets || {}).fal;
  const falNeuve = fal && fal.le && fal.le > (e.depuis || '');
  if (e.bloque === 'budget') { const d = C.depense(c); return C.jourDe(c) !== e.jour || d.jour + 0.03 < C.reglagesDe(c).budget_jour; }
  // le budget d'un clip : il repart dès qu'elle en a accepté plus
  if (e.bloque === 'budget_clip') return (Number((((v.plan || {}).clip) || {}).budget) || 0) > (Number(e.budget_bloque) || 0) + 0.0001;
  if (e.bloque === 'cle') return !!cleNeuve;
  if (e.bloque === 'credit') return !!cleNeuve || Date.now() - new Date(e.depuis || 0).getTime() > 3 * 3600000;
  if (e.bloque === 'fal') return !!falNeuve || (!CLIP.estClip(v) && (v.plan || {}).style !== 'ia' && !VX.applicable(c, v));
  if (e.bloque === 'credit_fal') return !!falNeuve || Date.now() - new Date(e.depuis || 0).getTime() > 3600000;
  if (e.bloque === 'usine') return G.branche();
  if (e.bloque === 'publication') return true;
  return true;
}

async function avancer(db, createurId, videoId) {
  if (!(await verrou(db, videoId))) return { fait: null, occupe: true };
  try {
    const c = await db.one('hq_createurs', { eq: { id: createurId } });
    let v = await db.one('hq_crea_videos', { eq: { id: videoId, createur_id: createurId } });
    if (!c || !v || c.statut !== 'active') return { fait: null };
    // prête (ou publiée, avec une langue ajoutée) : ce qui doit partir seul part, sans attendre le passage régulier
    if (v.status === 'prete' || v.status === 'publiee') {
      const n = await planifierAuto(db, c, v).catch(() => 0);
      return n ? { fait: C.equipeDe(c).diffusion.prenom + ' programme la publication', video: await db.one('hq_crea_videos', { eq: { id: v.id } }) } : { fait: null, video: v };
    }
    if (C.AUTOMATIQUES.indexOf(v.status) < 0) return { fait: null, video: v };
    const e = v.etape || {};
    if (e.attendre_jusqu && new Date(e.attendre_jusqu).getTime() > Date.now()) return { fait: null, attente: true, video: v };
    if (e.bloque) {
      if (!debloquer(c, v)) return { fait: null, bloque: e.bloque, video: v };
      v = await maj(db, v.id, (f) => ({ etape: Object.assign({}, f.etape || {}, { bloque: null, erreur: null, attendre_jusqu: null }) })) || v;
    }
    let fait = null;
    try {
      if (v.status === 'ecriture') fait = await etapeEcriture(db, c, v);
      else if (v.status === 'langues') fait = await etapeLangues(db, c, v);
      else if (v.status === 'realisation') fait = await etapeRealisation(db, c, v);
      else if (v.status === 'fabrication') fait = await etapeFabrication(db, c, v);
      else if (v.status === 'publication') fait = await etapePublication(db, c, v);
      // l'étape réussie efface les erreurs passées
      if (fait) await maj(db, v.id, (f) => ((f.etape || {}).erreur || (f.etape || {}).essais ? { etape: Object.assign({}, f.etape || {}, { erreur: null, essais: 0, attendre_jusqu: null }) } : null));
    } catch (err) {
      const bloque = err.bloque || BLOQUANTES[err.code] || null;
      await maj(db, v.id, (f) => {
        if (f.status !== v.status) return null;
        const et = Object.assign({}, f.etape || {});
        // plus le temps d'attendre Claude dans ce passage (rien n'a été demandé) : le suivant reprend, sans compter d'essai
        if (err.code === 'temps') return { etape: Object.assign(et, { attendre_jusqu: new Date(Date.now() + 60000).toISOString() }) };
        if (bloque) return { etape: Object.assign(et, { bloque, erreur: court(err.message, 400), depuis: iso(), jour: C.jourDe(c), budget_bloque: err.budget != null ? err.budget : null }) };
        const essais = (et.essais || 0) + 1;
        if (essais >= ESSAIS_ETAPE) return { status: 'echec', etape: Object.assign(et, { statut_avant: f.status, erreur: court(err.message, 400), essais, depuis: iso() }) };
        return { etape: Object.assign(et, { erreur: court(err.message, 400), essais, attendre_jusqu: new Date(Date.now() + Math.min(30, Math.pow(2, essais)) * 60000).toISOString() }) };
      });
      fait = null;
      return { fait: null, erreur: court(err.message, 400), bloque, video: await db.one('hq_crea_videos', { eq: { id: v.id } }) };
    }
    return { fait, video: await db.one('hq_crea_videos', { eq: { id: v.id } }) };
  } finally { await liberer(db, videoId); }
}

/* ── ce que la créatrice décide ── */
// valider le script (avec ses retouches déjà enregistrées) ; un clip se valide en lançant son tournage, au prix affiché
async function valider(db, c, id, accepte) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (CLIP.estClip(v)) return CLIP.tourner(db, c, id, accepte);
  const out = await maj(db, id, (f) => (f.createur_id !== c.id || f.status !== 'relecture' ? null : { status: apresRelecture(f), etape: { quoi: apresRelecture(f) === 'langues' ? 'langue' : 'images', depuis: iso() } }));
  return out ? { ok: true, video: out } : { erreur: 'cette vidéo n\'attend pas de validation' };
}
// faire réécrire, avec sa consigne (une seule relecture automatique ensuite : la consigne compte plus que la note) ; un
// clip est redécoupé
async function reecrire(db, c, id, consigne) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (CLIP.estClip(v)) return CLIP.redecouper(db, c, id, consigne);
  const out = await maj(db, id, (f) => (f.createur_id !== c.id || ['relecture', 'echec'].indexOf(f.status) < 0 || !(f.script && f.script.beats) ? null : {
    status: 'ecriture', critique: Object.assign({}, f.critique || {}, { essais: B.REECRITURES_MAX - 1 }),
    etape: { quoi: 'reecriture', consigne: court(String(consigne || '').replace(/[<>]/g, ''), 600) || null, corrections: [], depuis: iso() }
  }));
  return out ? { ok: true, video: out } : { erreur: 'cette vidéo ne peut pas être réécrite maintenant' };
}
// ses retouches du script (avant validation), ou du texte publié (une fois la vidéo prête)
async function modifier(db, c, id, m) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v) return { erreur: 'vidéo introuvable' };
  if (v.status === 'relecture' && m.script) {
    const look = (v.plan || {}).style || C.reglagesDe(c).style;
    let script;
    try {
      // ses retouches d'une phrase complètent ce que la plume avait écrit (la scène pour l'IA, la recherche d'image)
      const beats = (m.script.beats || v.script.beats || []).map((b, i) => {
        const avant = (v.script.beats || [])[i] || {};
        return Object.assign({}, avant, b, (avant.visuel || b.visuel) ? { visuel: Object.assign({}, avant.visuel || {}, b.visuel || {}) } : {});
      });
      script = E.nettoyerScript(Object.assign({}, v.script, m.script, { beats }), look, (v.plan || {}).format || 'court');
    } catch (e) { return { erreur: e.message }; }
    const out = await maj(db, id, (f) => (f.status !== 'relecture' ? null : { script, titre: script.titre || f.titre }));
    return out ? { ok: true, video: out } : { erreur: 'la vidéo a changé entre-temps, recharge' };
  }
  if (['prete', 'publiee'].indexOf(v.status) >= 0 && m.texte && m.langue && (v.langues || []).indexOf(m.langue) >= 0) {
    const t = m.texte;
    const texte = { titre: court(t.titre, 100), titre_youtube: court(t.titre_youtube, 95), description: court(String(t.description || '').replace(/[<>]/g, ''), 2000), hashtags: (Array.isArray(t.hashtags) ? t.hashtags : String(t.hashtags || '').split(/[\s,]+/)).map((h) => String(h).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).slice(0, 15) };
    const out = await maj(db, id, (f) => { const p = JSON.parse(JSON.stringify(f.publication || {})); p[m.langue] = Object.assign({ plateformes: {} }, p[m.langue] || {}, { texte }); return { publication: p }; });
    return out ? { ok: true, video: out } : { erreur: 'la vidéo a changé entre-temps, recharge' };
  }
  return { erreur: 'rien à modifier à cette étape' };
}
// publiée à la main (depuis son téléphone) : elle le note, avec le lien si elle veut
async function marquerPubliee(db, c, id, langue, plateforme, lien) {
  if (!C.PLATEFORMES[plateforme]) return { erreur: 'plateforme inconnue' };
  const l = /^https:\/\/[^\s<>"]{5,300}$/.test(String(lien || '')) ? String(lien) : null;
  const out = await maj(db, id, (f) => {
    if (f.createur_id !== c.id || ['prete', 'publiee', 'publication'].indexOf(f.status) < 0 || (f.langues || []).indexOf(langue) < 0) return null;
    const p = JSON.parse(JSON.stringify(f.publication || {}));
    p[langue] = Object.assign({ plateformes: {} }, p[langue] || {});
    p[langue].plateformes[plateforme] = { etat: 'manuelle', lien: l, le: iso() };
    return { publication: p, status: f.status === 'prete' ? 'publiee' : f.status };
  });
  return out ? { ok: true, video: out } : { erreur: 'impossible de la marquer maintenant' };
}
// reprendre une vidéo bloquée ou ratée, refaire le montage, archiver
async function reprendre(db, c, id) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (CLIP.estClip(v)) return CLIP.reprendre(db, c, id);
  const out = await maj(db, id, (f) => {
    if (f.createur_id !== c.id) return null;
    const e = f.etape || {};
    if (f.status === 'echec') return { status: e.statut_avant || 'ecriture', etape: { quoi: e.quoi || null, depuis: iso() } };
    if (C.AUTOMATIQUES.indexOf(f.status) >= 0) return { etape: Object.assign({}, e, { bloque: null, erreur: null, essais: 0, attendre_jusqu: null }) };
    return null;
  });
  return out ? { ok: true, video: out } : { erreur: 'rien à reprendre' };
}
async function refaireMontage(db, c, id, o) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (CLIP.estClip(v)) return CLIP.remonter(db, c, id, o || {});
  const out = await maj(db, id, (f) => (f.createur_id !== c.id || ['prete', 'publiee', 'echec'].indexOf(f.status) < 0 || !(f.script && f.script.beats) ? null : { status: 'realisation', rendus: {}, etape: { quoi: 'images', depuis: iso() } }));
  return out ? { ok: true, video: out } : { erreur: 'le montage ne peut pas être refait maintenant' };
}
// Relancer seulement les langues dont le montage a raté (les autres restent telles quelles, rien n'est repayé) : la
// vidéo de deux minutes d'Emma en anglais (trop lourde pour le stockage) se refait seule, sans refaire le reste
async function relancerMontage(db, c, id) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v) return { erreur: 'vidéo introuvable' };
  const enEchec = v.status === 'echec' && (v.etape || {}).quoi === 'montage';
  if (['prete', 'publiee'].indexOf(v.status) < 0 && !enEchec) return { erreur: 'rien à relancer à cette étape' };
  const out = await maj(db, id, (f) => {
    const r = Object.assign({}, f.rendus || {});
    const ratees = (f.langues || []).filter((l) => !r[l] || r[l].etat === 'echec');
    if (!ratees.length) return null;
    ratees.forEach((l) => { delete r[l]; });
    return { rendus: r, status: 'fabrication', etape: { quoi: 'montage', depuis: iso(), retour: f.status === 'publiee' ? 'publiee' : 'prete' } };
  });
  if (!out) return { erreur: 'aucun montage raté à relancer' };
  for (const l of F.aMonter(out)) await F.demander(db, out, l);
  return { ok: true, video: await db.one('hq_crea_videos', { eq: { id } }) };
}

// Ajouter une ou plusieurs langues à une vidéo déjà faite : Nora écrit chaque nouvelle version, sa voix est dite, son
// montage fait ; les langues déjà montées ne bougent pas, et les nouvelles partent selon leur règle de publication.
// Un clip (sans voix ni sous-titres) garde sa vidéo : seul son texte de publication est écrit dans la nouvelle langue.
async function ajouterLangues(db, c, id, langues) {
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v) return { erreur: 'vidéo introuvable' };
  if (['prete', 'publiee'].indexOf(v.status) < 0) return { erreur: 'attends que la vidéo soit prête pour lui ajouter une langue' };
  const nouvelles = (Array.isArray(langues) ? langues : [langues]).map(String).filter((l, i, t) => C.LANGUES[l] && (v.langues || []).indexOf(l) < 0 && t.indexOf(l) === i);
  if (!nouvelles.length) return { erreur: 'choisis une langue que la vidéo n\'a pas encore' };
  if ((v.langues || []).length + nouvelles.length > LANGUES_MAX_VIDEO) return { erreur: LANGUES_MAX_VIDEO + ' langues au plus par vidéo' };
  if (!(c.secrets || {}).claude) return { erreur: 'branche d\'abord ta clé Claude : ' + C.equipeDe(c).traduction.prenom + ' en a besoin pour écrire la nouvelle version' };
  if (CLIP.estClip(v)) return ajouterLanguesClip(db, c, v, nouvelles);
  if (!(v.script && Array.isArray(v.script.beats) && v.script.beats.length)) return { erreur: 'cette vidéo n\'a pas de script à adapter' };
  const out = await maj(db, id, (f) => (['prete', 'publiee'].indexOf(f.status) < 0 ? null : {
    langues: (f.langues || []).concat(nouvelles), status: 'langues',
    etape: { quoi: 'langue', langue: nouvelles[0], depuis: iso(), ajout: { langues: nouvelles, retour: f.status } }
  }));
  return out ? { ok: true, video: out, langues: nouvelles } : { erreur: 'la vidéo a changé entre-temps, recharge' };
}
// un clip : le texte de publication dans chaque nouvelle langue (un seul appel à Claude), puis la même vidéo copiée dans le
// dossier de chaque langue (chez Supabase, rien ne passe par la tour)
async function ajouterLanguesClip(db, c, v, nouvelles) {
  const src = (v.langues || []).find((l) => ((v.rendus || {})[l] || {}).etat === 'fini');
  if (!src) return { erreur: 'les fichiers de ce clip ne sont plus disponibles (gardés ' + C.GARDE_JOURS + ' jours)' };
  let res;
  try { res = await E.adapterTextes(db, c, v, nouvelles); }
  catch (e) { return { erreur: court(e.message, 300), code: e.code || null }; }
  const copiees = [];
  for (const l of nouvelles) {
    try {
      for (const n of ['video.mp4', 'vignette.jpg']) await ST.copier(ST.cheminCrea(v.createur_id, v.id, src, n), ST.cheminCrea(v.createur_id, v.id, l, n));
      copiees.push(l);
    } catch (e) { /* cette langue reste dehors : elle pourra être réessayée */ }
  }
  if (!copiees.length) return { erreur: 'la vidéo n\'a pas pu être copiée pour ces langues, réessaie dans un instant' };
  const out = await maj(db, v.id, (f) => {
    if (['prete', 'publiee'].indexOf(f.status) < 0) return null;
    const r = Object.assign({}, f.rendus || {}), t = Object.assign({}, f.traductions || {});
    const base = r[src] || {};
    copiees.forEach((l) => {
      t[l] = res.versions[l];
      r[l] = { etat: 'fini', fini_le: iso(), duree: base.duree || null, taille: base.taille || null, fichiers: ['video.mp4', 'vignette.jpg'], copie_de: src, avertissements: [] };
    });
    return { langues: (f.langues || []).concat(copiees.filter((l) => (f.langues || []).indexOf(l) < 0)), rendus: r, traductions: t, cout_usd: ajout(f, res.cout) };
  });
  return out ? { ok: true, video: out, langues: copiees } : { erreur: 'la vidéo a changé entre-temps, recharge' };
}

// une vidéo qui attend fal (pas de clé, clé refusée, plus de crédit) ou qui a échoué continue sans lui : des vidéos
// d'illustration à la place des images IA (la plume a aussi écrit une recherche d'image pour chaque phrase), la voix
// gratuite à la place de la voix naturelle, aucune image créée
async function sansIa(db, c, id) {
  const out = await maj(db, id, (f) => {
    const e = f.etape || {};
    const plan = f.plan || {};
    if (f.createur_id !== c.id || CLIP.estClip(f) || plan.sans_fal || (plan.style !== 'ia' && !VX.applicable(c, f))) return null;
    if (f.status !== 'realisation' && !(f.status === 'echec' && e.statut_avant === 'realisation')) return null;
    return { status: 'realisation', plan: Object.assign({}, plan, { style: plan.style === 'ia' ? 'clips' : plan.style, sans_fal: true }), etape: { quoi: 'images', depuis: iso(), note: plan.style === 'ia' ? 'sans images IA' : 'avec la voix gratuite' } };
  });
  return out ? { ok: true, video: out } : { erreur: 'cette vidéo ne peut pas changer de look maintenant' };
}

/* ── le passage régulier ── */
async function etatPilote(db, c) { const r = await db.one('hq_config', { eq: { key: 'crea:pilote:' + c.id } }).catch(() => null); return (r && r.value) || {}; }
async function noterPilote(db, c, v) { await db.upsert('hq_config', { key: 'crea:pilote:' + c.id, value: v, updated_at: iso() }, { onConflict: 'key' }).catch(() => null); }

// le pilote automatique d'une créatrice : à son heure, ses vidéos du jour, dans son budget
async function pilote(db, c) {
  const r = C.reglagesDe(c);
  if (!r.pilote.actif || !(c.secrets || {}).claude) return null;
  if (C.heureDe(c) < r.pilote.heure) return null;
  const jour = C.jourDe(c);
  const st = await etatPilote(db, c);
  const essais = st.jour === jour ? (st.essais || 0) : 0;
  const lancees = st.jour === jour ? (st.lancees || 0) : 0;
  if (lancees >= r.pilote.videos_jour || essais >= r.pilote.videos_jour + 2) return null;
  const d = C.depense(c);
  const estime = C.coutEstime(r, r.langues.length, C.voixNaturelle(c));
  if (d.jour + estime > r.budget_jour) {
    // une fois par jour, dans son journal : sinon le pilote ne fait rien en silence (Emma : 0,30 $ par jour pour une vidéo
    // longue en cinq langues à environ 0,90 $)
    if (st.jour !== jour || !st.alerte) {
      await noterPilote(db, c, Object.assign({}, st, { jour, essais, lancees, alerte: true }));
      await db.update('hq_createurs', { journal: C.ligneJournal(c, 'Pilote en attente', 'une vidéo coûte environ ' + estime.toFixed(2) + ' $, ton budget du jour est ' + r.budget_jour.toFixed(2) + ' $ (' + d.jour.toFixed(2) + ' $ déjà dépensés)'), updated_at: iso() }, { eq: { id: c.id } }).catch(() => null);
    }
    return null;
  }
  await noterPilote(db, c, { jour, essais: essais + 1, lancees, le: iso() });
  let idee = (c.idees || [])[0] || null;
  try {
    if (!idee) {
      const recentes = await db.select('hq_crea_videos', { eq: { createur_id: c.id }, order: ['created_at.desc'], limit: 25, select: 'titre' });
      const res = await E.proposerIdees(db, c, { deja: recentes.map((x) => x.titre).filter(Boolean), recherches: r.tendances });
      idee = res.idees[0];
      await db.update('hq_createurs', { idees: res.idees.slice(1).concat((c.idees || [])).slice(0, 10), updated_at: iso() }, { eq: { id: c.id } });
    }
    const out = await creer(db, c, { idee, auto: true });
    if (out.ok) await noterPilote(db, c, { jour, essais: essais + 1, lancees: lancees + 1, le: iso(), derniere: out.video.id });
    return out.ok ? 'pilote : vidéo ' + out.video.id + ' lancée' : 'pilote : ' + out.erreur;
  } catch (e) { return 'pilote : ' + court(e.message, 120); }
}

async function tick(db, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const limite = (opts.secondes || 230) * 1000;
  const journal = [];
  const createurs = await db.select('hq_createurs', { eq: { statut: 'active' }, select: 'id,identifiant,prenom,statut,reglages,equipe,secrets,couts,idees' });
  for (const c of createurs) {
    if (Date.now() - t0 > limite * 0.3) break;
    const x = await pilote(db, c).catch((e) => 'pilote : ' + e.message);
    if (x) journal.push(c.identifiant + ' ' + x);
  }
  // les vidéos prêtes (ou publiées, à qui une langue a été ajoutée) dont une langue doit partir seule : selon sa règle
  // de publication, tout de suite ou à son heure (et celles du pilote, s'il publie tout seul)
  const recentes = await db.select('hq_crea_videos', { in: { status: ['prete', 'publiee'] }, gte: { updated_at: new Date(Date.now() - 7 * 86400000).toISOString() }, order: ['updated_at.asc'], limit: 40, select: 'id,createur_id,status,auto,langues,rendus,publication,plan' });
  for (const v of recentes) {
    const c = createurs.find((x) => x.id === v.createur_id);
    if (!c) continue;
    const n = await planifierAuto(db, c, v).catch(() => 0);
    if (n) journal.push('vidéo ' + v.id + ' : ' + n + ' publication' + (n > 1 ? 's' : '') + ' prévue' + (n > 1 ? 's' : ''));
  }
  const enRoute = await db.select('hq_crea_videos', { in: { status: C.AUTOMATIQUES }, order: ['updated_at.asc'], limit: 40, select: 'id,createur_id,status,etape' });
  for (const v of enRoute) {
    if (Date.now() - t0 > limite) break;
    const e = v.etape || {};
    if (e.attendre_jusqu && new Date(e.attendre_jusqu).getTime() > Date.now()) continue;
    const r = await avancer(db, v.createur_id, v.id).catch((err) => ({ erreur: err.message }));
    if (r.fait || r.erreur) journal.push('vidéo ' + v.id + ' : ' + (r.fait || r.erreur));
  }
  await menage(db).catch(() => null);
  return { ok: true, journal, secondes: Math.round((Date.now() - t0) / 1000) };
}

// les fichiers de plus de 14 jours quittent le stockage (la vidéo reste dans sa liste, sans fichier)
async function menage(db) {
  const st = await db.one('hq_config', { eq: { key: 'crea:menage' } }).catch(() => null);
  if (st && st.value && Date.now() - new Date(st.value.le).getTime() < 6 * 3600000) return 0;
  await db.upsert('hq_config', { key: 'crea:menage', value: { le: iso() }, updated_at: iso() }, { onConflict: 'key' }).catch(() => null);
  const avant = new Date(Date.now() - C.GARDE_JOURS * 86400000).toISOString();
  const vieilles = await db.select('hq_crea_videos', { lt: { created_at: avant }, in: { status: ['prete', 'publiee', 'echec', 'archivee'] }, order: ['created_at.asc'], limit: 30, select: 'id,createur_id,langues,rendus,plan' });
  let n = 0;
  for (const v of vieilles) {
    const r = v.rendus || {};
    if (!Object.keys(r).some((l) => r[l] && r[l].etat === 'fini')) continue;
    await F.effacerFichiers(v).catch(() => null);
    await maj(db, v.id, (f) => { const rr = JSON.parse(JSON.stringify(f.rendus || {})); Object.keys(rr).forEach((l) => { if (rr[l] && rr[l].etat === 'fini') rr[l] = Object.assign({}, rr[l], { etat: 'efface', efface_le: iso() }); }); return { rendus: rr }; });
    n++;
  }
  // les fichiers de la messagerie de plus de 60 jours
  n += await require('./messages').menage(db).catch(() => 0);
  return n;
}

module.exports = {
  creer, avancer, valider, reecrire, modifier, publier, marquerPubliee, reprendre, refaireMontage, relancerMontage, ajouterLangues, sansIa, tick, pilote, menage, textePublication, apresRelecture,
  planifierAuto, annulerProgrammation, envoisDe, creneau, instantLocal, optionsVideo, pourVideo, MAX_EN_COURS, MAX_JOUR, LANGUES_MAX, LANGUES_MAX_VIDEO
};
