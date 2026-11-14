// La chaîne d'une vidéo, de l'idée à la publication. Chaque appel à avancer() fait UNE étape (un appel à Claude, une
// recherche d'images, un lancement de montage, un envoi ou un suivi de publication) puis rend la main : la page de la
// créatrice l'appelle en boucle quand elle regarde, le passage régulier (toutes les 5 minutes) quand elle n'est pas là.
// Un verrou par vidéo empêche deux étapes en même temps. Une erreur passagère est réessayée plus tard (4 fois) ;
// une erreur qu'elle seule peut régler (clé, crédit, budget du jour) met la vidéo en attente, avec le message clair,
// et l'équipe reprend toute seule dès que c'est réglé (nouvelle clé, nouveau jour, budget monté).
//   ecriture (script, critique, réécriture) → relecture (elle valide) → langues → realisation (images)
//   → fabrication (montage par langue) → prete → publication → publiee
'use strict';
const crypto = require('crypto');
const C = require('./index');
const B = require('./bible');
const E = require('./equipe');
const IM = require('./images');
const F = require('./fabrication');
const P = require('./publication');
const G = require('../studio/github');
const ST = require('../studio/stockage');
const { majFraiche } = require('../db');
const { court } = require('../util');

const iso = () => new Date().toISOString();
const MAX_EN_COURS = 10;        // vidéos en route en même temps, par compte
const MAX_JOUR = 12;            // vidéos lancées par jour, par compte
const ESSAIS_ETAPE = 4;
const PROPRIO = 'studio-' + crypto.randomBytes(4).toString('hex');
const BLOQUANTES = { budget: 'budget', cle_absente: 'cle', cle_illisible: 'cle', cle_refusee: 'cle', credit: 'credit' };

async function verrou(db, id, s) {
  try { return (await db.rpc('hq_lock', { p_name: 'crea:v:' + id, p_seconds: s || 280, p_owner: PROPRIO })) !== false; }
  catch (e) { return true; }
}
async function liberer(db, id) { await db.rpc('hq_unlock', { p_name: 'crea:v:' + id, p_owner: PROPRIO }).catch(() => null); }
const maj = (db, id, fn) => majFraiche(db, 'hq_crea_videos', id, fn);
const ajout = (f, cout) => Math.round(((Number(f.cout_usd) || 0) + (Number(cout) || 0)) * 10000) / 10000;

// la créatrice vue par l'équipe pour UNE vidéo : le format et le style choisis pour cette vidéo
function pourVideo(createur, v) {
  const plan = v.plan || {};
  return Object.assign({}, createur, { reglages: Object.assign({}, createur.reglages || {}, plan.format ? { format: plan.format } : {}, plan.style ? { style: plan.style } : {}) });
}
function autresLangues(v) { return (v.langues || []).filter((l) => l !== v.langue_source); }
function apresRelecture(v) { return autresLangues(v).some((l) => !(v.traductions || {})[l]) ? 'langues' : 'realisation'; }

/* ── lancer une vidéo ── */
async function creer(db, createur, o) {
  o = o || {};
  const r = C.reglagesDe(createur);
  const idee = o.idee && typeof o.idee === 'object' ? { titre: court(o.idee.titre, 90), accroche: court(o.idee.accroche, 160), angle: court(o.idee.angle, 400), pourquoi: court(o.idee.pourquoi, 240) } : {};
  const sujet = court(String(o.sujet || idee.titre || '').replace(/[<>]/g, ''), 600);
  if (sujet.length < 4) return { erreur: 'écris ton idée en quelques mots' };
  const enRoute = await db.count('hq_crea_videos', { eq: { createur_id: createur.id }, in: { status: C.AUTOMATIQUES.concat(['relecture']) } });
  if (enRoute >= MAX_EN_COURS) return { erreur: 'déjà ' + enRoute + ' vidéos en route : laisse l\'équipe finir celles-là d\'abord' };
  const depuis = new Date(Date.now() - 24 * 3600000).toISOString();
  const recentes = await db.count('hq_crea_videos', { eq: { createur_id: createur.id }, gte: { created_at: depuis } });
  if (recentes >= MAX_JOUR) return { erreur: 'déjà ' + recentes + ' vidéos lancées en 24 heures : c\'est le maximum' };
  const langues = (Array.isArray(o.langues) && o.langues.length ? o.langues : r.langues).filter((l, i, t) => C.LANGUES[l] && t.indexOf(l) === i);
  if (langues.indexOf(r.langue_source) < 0) langues.unshift(r.langue_source);
  const plan = { format: ['court', 'long'].indexOf(o.format) >= 0 ? o.format : r.format, style: ['clips', 'texte'].indexOf(o.style) >= 0 ? o.style : r.style };
  const [v] = await db.insert('hq_crea_videos', {
    createur_id: createur.id, status: 'ecriture', sujet, titre: idee.titre || court(sujet, 90), langue_source: r.langue_source, langues: langues.slice(0, 6),
    idee, plan, etape: { quoi: 'script', depuis: iso() }, auto: !!o.auto, rendus: {}, traductions: {}, publication: {}, critique: {}, script: {}, updated_at: iso()
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
      // le pilote sans relecture enchaîne ; sinon la créatrice valide
      const suite = f.auto && !r.pilote.relire ? apresRelecture(f) : 'relecture';
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
    await maj(db, v.id, (f) => (f.status !== 'langues' ? null : { status: 'realisation', etape: { quoi: 'images', depuis: iso() } }));
    return null;
  }
  const l = manquantes[0];
  const res = await E.adapter(db, pourVideo(c, v), v, l);
  await maj(db, v.id, (f) => {
    if (f.status !== 'langues') return null;
    const t = Object.assign({}, f.traductions || {}, { [l]: res.version });
    const reste = autresLangues(f).filter((x) => !t[x]);
    return { traductions: t, cout_usd: ajout(f, res.cout), status: reste.length ? 'langues' : 'realisation', etape: reste.length ? { quoi: 'langue', langue: reste[0], depuis: iso() } : { quoi: 'images', depuis: iso() } };
  });
  return C.equipeDe(c).traduction.prenom + ' a écrit la version ' + (C.LANGUES[l] || {}).nom;
}

async function etapeRealisation(db, c, v) {
  if (!G.branche()) { const e = new Error('Le montage n\'est pas encore branché sur la tour : Louis doit brancher l\'usine (sa page Missions).'); e.bloque = 'usine'; throw e; }
  const r = C.reglagesDe(c);
  const plan = Object.assign({}, v.plan || {});
  plan.style = plan.style || r.style;
  plan.couleur = r.couleur; plan.musique = r.musique;
  let note = null;
  if (plan.style === 'clips') {
    const res = await IM.choisir(v.script || {});
    plan.clips = res.clips; plan.credits = res.credits; plan.manquants = res.manquants;
    if (res.avertissement) note = res.avertissement;
  } else { plan.clips = []; plan.credits = []; }
  plan.choisi_le = iso();
  const out = await maj(db, v.id, (f) => (f.status !== 'realisation' ? null : { plan, rendus: {}, status: 'fabrication', etape: { quoi: 'montage', depuis: iso(), note } }));
  if (out) for (const l of out.langues || []) await F.demander(db, out, l);
  return C.equipeDe(c).realisation.prenom + (plan.style === 'clips' ? ' a choisi les images et lancé le montage' : ' a lancé le montage');
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
  const finies = (f.langues || []).filter((l) => r[l] && r[l].etat === 'fini');
  const ratees = (f.langues || []).filter((l) => !r[l] || r[l].etat !== 'fini');
  await maj(db, f.id, (x) => (x.status !== 'fabrication' ? null : finies.length
    ? { status: 'prete', etape: { quoi: null, depuis: iso(), note: ratees.length ? 'montage raté pour : ' + ratees.join(', ') + ' (Refaire le montage pour réessayer)' : null } }
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
  const pub = v.publication || {};
  const fait = [];
  for (const l of Object.keys(pub)) {
    const pl = Object.keys(pub[l].plateformes || {});
    const aEnvoyer = pl.filter((p) => pub[l].plateformes[p].etat === 'a_envoyer');
    if (aEnvoyer.length) {
      // upload-post va chercher la vidéo lui-même : un lien de lecture de 24 heures
      const chemin = ST.cheminCrea(v.createur_id, v.id, l, 'video.mp4');
      let res = null, err = null;
      try {
        const url = (await ST.liensLecture([chemin], 24 * 3600))[chemin];
        if (!url) throw new Error('le fichier de la vidéo est introuvable (refais le montage)');
        res = await P.publier(c, v, l, aEnvoyer, url, textePublication(v, l));
      } catch (e) { err = e; }
      await maj(db, v.id, (f) => {
        const p = JSON.parse(JSON.stringify(f.publication || {}));
        if (!p[l]) return null;
        aEnvoyer.forEach((x) => { p[l].plateformes[x] = err ? { etat: 'echec', erreur: court(err.message, 240), le: iso() } : { etat: 'en_cours', requete: res.requete, envoye_le: iso() }; });
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
          if (r && r.ok) p[l].plateformes[x] = { etat: 'publiee', lien: r.lien, le: iso(), message: r.message || null };
          else if (r && (s.fini || r.message) && !r.ok && (s.fini || /fail|error|refus|denied/i.test(r.message))) p[l].plateformes[x] = { etat: 'echec', erreur: r.message || 'refusé par la plateforme', le: iso() };
          else if ((s.fini && !r) || s.perdu || tropLong) p[l].plateformes[x] = { etat: 'echec', erreur: s.perdu ? 'demande perdue chez upload-post' : tropLong ? 'pas de réponse après 3 heures' : (s.message || 'pas de résultat pour cette plateforme'), le: iso() };
        });
        return { publication: p };
      });
      fait.push(l + ' suivie');
    }
  }
  // tout est parti ou retombé : la vidéo est publiée (au moins une plateforme), sinon elle redevient prête
  const f = await db.one('hq_crea_videos', { eq: { id: v.id } });
  if (!f || f.status !== 'publication') return fait.join(', ') || null;
  const etats = [];
  Object.keys(f.publication || {}).forEach((l) => Object.keys((f.publication[l] || {}).plateformes || {}).forEach((p) => etats.push(f.publication[l].plateformes[p].etat)));
  if (etats.some((e) => e === 'a_envoyer' || e === 'en_cours')) {
    await maj(db, f.id, (x) => (x.status !== 'publication' ? null : { etape: Object.assign({}, x.etape || {}, { quoi: 'suivi', attendre_jusqu: new Date(Date.now() + 60000).toISOString() }) }));
    return fait.join(', ') || null;
  }
  const ok = etats.some((e) => e === 'publiee' || e === 'manuelle');
  await maj(db, f.id, (x) => (x.status !== 'publication' ? null : { status: ok ? 'publiee' : 'prete', etape: { quoi: null, depuis: iso(), note: etats.some((e) => e === 'echec') ? 'certaines publications ont échoué : ouvre la vidéo pour voir pourquoi' : null } }));
  return ok ? 'publiée' : 'publication ratée';
}

/* ── une étape, avec son verrou et ses erreurs ── */
function debloquer(c, v) {
  const e = v.etape || {};
  if (!e.bloque) return true;
  const claude = (c.secrets || {}).claude;
  const cleNeuve = claude && claude.le && claude.le > (e.depuis || '');
  if (e.bloque === 'budget') { const d = C.depense(c); return C.jourDe(c) !== e.jour || d.jour + 0.03 < C.reglagesDe(c).budget_jour; }
  if (e.bloque === 'cle') return !!cleNeuve;
  if (e.bloque === 'credit') return !!cleNeuve || Date.now() - new Date(e.depuis || 0).getTime() > 3 * 3600000;
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
        if (bloque) return { etape: Object.assign(et, { bloque, erreur: court(err.message, 400), depuis: iso(), jour: C.jourDe(c) }) };
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
// valider le script (avec ses retouches déjà enregistrées)
async function valider(db, c, id) {
  const out = await maj(db, id, (f) => (f.createur_id !== c.id || f.status !== 'relecture' ? null : { status: apresRelecture(f), etape: { quoi: apresRelecture(f) === 'langues' ? 'langue' : 'images', depuis: iso() } }));
  return out ? { ok: true, video: out } : { erreur: 'cette vidéo n\'attend pas de validation' };
}
// faire réécrire, avec sa consigne (une seule relecture automatique ensuite : la consigne compte plus que la note)
async function reecrire(db, c, id, consigne) {
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
    const avecImages = ((v.plan || {}).style || C.reglagesDe(c).style) === 'clips';
    let script;
    try { script = E.nettoyerScript(Object.assign({}, v.script, m.script, { beats: (m.script.beats || v.script.beats || []).map((b, i) => Object.assign({}, (v.script.beats || [])[i] || {}, b)) }), avecImages, (v.plan || {}).format || 'court'); }
    catch (e) { return { erreur: e.message }; }
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
// publier automatiquement (les langues et plateformes réglées pour upload-post)
async function publier(db, c, id, choix) {
  const r = C.reglagesDe(c);
  if (!(c.secrets || {}).uploadpost) return { erreur: 'branche d\'abord upload-post (Réglages, Connexions), ou publie à la main' };
  const v = await db.one('hq_crea_videos', { eq: { id, createur_id: c.id } });
  if (!v || ['prete', 'publiee'].indexOf(v.status) < 0) return { erreur: 'la vidéo n\'est pas prête' };
  const plan = {};
  (v.langues || []).forEach((l) => {
    const rl = (r.publication || {})[l] || {};
    if (!rl.profil || !((v.rendus || {})[l] || {}).etat || v.rendus[l].etat !== 'fini') return;
    const voulues = choix && choix[l] ? choix[l].filter((p) => rl.plateformes.indexOf(p) >= 0) : rl.plateformes;
    if (voulues.length) plan[l] = voulues;
  });
  if (!Object.keys(plan).length) return { erreur: 'aucune langue n\'a de compte choisi : Réglages, Publication' };
  const out = await maj(db, id, (f) => {
    if (['prete', 'publiee'].indexOf(f.status) < 0) return null;
    const p = JSON.parse(JSON.stringify(f.publication || {}));
    Object.keys(plan).forEach((l) => {
      p[l] = Object.assign({ plateformes: {} }, p[l] || {});
      plan[l].forEach((x) => { const cur = p[l].plateformes[x]; if (!cur || cur.etat === 'echec') p[l].plateformes[x] = { etat: 'a_envoyer', demande_le: iso() }; });
    });
    return { publication: p, status: 'publication', etape: { quoi: 'envoi', depuis: iso() } };
  });
  return out ? { ok: true, video: out } : { erreur: 'la vidéo a changé entre-temps, recharge' };
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
  const out = await maj(db, id, (f) => {
    if (f.createur_id !== c.id) return null;
    const e = f.etape || {};
    if (f.status === 'echec') return { status: e.statut_avant || 'ecriture', etape: { quoi: e.quoi || null, depuis: iso() } };
    if (C.AUTOMATIQUES.indexOf(f.status) >= 0) return { etape: Object.assign({}, e, { bloque: null, erreur: null, essais: 0, attendre_jusqu: null }) };
    return null;
  });
  return out ? { ok: true, video: out } : { erreur: 'rien à reprendre' };
}
async function refaireMontage(db, c, id) {
  const out = await maj(db, id, (f) => (f.createur_id !== c.id || ['prete', 'publiee', 'echec'].indexOf(f.status) < 0 || !(f.script && f.script.beats) ? null : { status: 'realisation', rendus: {}, etape: { quoi: 'images', depuis: iso() } }));
  return out ? { ok: true, video: out } : { erreur: 'le montage ne peut pas être refait maintenant' };
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
  if (d.jour + C.coutEstime(r, r.langues.length) > r.budget_jour) return null;
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
  // les vidéos prêtes du pilote qui doivent partir seules
  const pretes = await db.select('hq_crea_videos', { eq: { status: 'prete', auto: true }, order: ['updated_at.asc'], limit: 10, select: 'id,createur_id,publication' });
  for (const v of pretes) {
    const c = createurs.find((x) => x.id === v.createur_id);
    if (!c || !C.reglagesDe(c).pilote.publier || Object.keys(v.publication || {}).some((l) => Object.keys((v.publication[l] || {}).plateformes || {}).length)) continue;
    const r = await publier(db, c, v.id).catch((e) => ({ erreur: e.message }));
    journal.push('vidéo ' + v.id + ' : ' + (r.ok ? 'publication lancée' : r.erreur));
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

// les fichiers de plus de 30 jours quittent le stockage (la vidéo reste dans sa liste, sans fichier)
async function menage(db) {
  const st = await db.one('hq_config', { eq: { key: 'crea:menage' } }).catch(() => null);
  if (st && st.value && Date.now() - new Date(st.value.le).getTime() < 6 * 3600000) return 0;
  await db.upsert('hq_config', { key: 'crea:menage', value: { le: iso() }, updated_at: iso() }, { onConflict: 'key' }).catch(() => null);
  const avant = new Date(Date.now() - C.GARDE_JOURS * 86400000).toISOString();
  const vieilles = await db.select('hq_crea_videos', { lt: { created_at: avant }, in: { status: ['prete', 'publiee', 'echec', 'archivee'] }, order: ['created_at.asc'], limit: 30, select: 'id,createur_id,langues,rendus' });
  let n = 0;
  for (const v of vieilles) {
    const r = v.rendus || {};
    if (!Object.keys(r).some((l) => r[l] && r[l].etat === 'fini')) continue;
    await F.effacerFichiers(v).catch(() => null);
    await maj(db, v.id, (f) => { const rr = JSON.parse(JSON.stringify(f.rendus || {})); Object.keys(rr).forEach((l) => { if (rr[l] && rr[l].etat === 'fini') rr[l] = Object.assign({}, rr[l], { etat: 'efface', efface_le: iso() }); }); return { rendus: rr }; });
    n++;
  }
  return n;
}

module.exports = { creer, avancer, valider, reecrire, modifier, publier, marquerPubliee, reprendre, refaireMontage, tick, pilote, menage, textePublication, apresRelecture, MAX_EN_COURS, MAX_JOUR };
