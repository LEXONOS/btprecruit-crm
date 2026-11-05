// Ce que la tour montre du Studio (Gestion, Studio) et ce que Louis peut y faire : regarder chaque vidéo dans chaque
// langue, renvoyer une scène à Oscar, refuser, relancer une fabrication ratée, valider à la place de Vera, régler le
// rythme d'une ligne.
'use strict';
const S = require('./index');
const G = require('./github');
const ST = require('./stockage');
const { court, nettoie } = require('../util');

async function liste(db, q) {
  q = q || {};
  const filtre = { order: 'updated_at.desc', limit: Math.min(40, Number(q.limite) || 30) };
  // « ecriture » : tout ce qui est encore dans la salle d'écriture
  if (q.statut === 'ecriture') filtre.in = { status: S.ECRITURE };
  else if (q.statut) filtre.eq = { status: String(q.statut) };
  const [videos, tous, reglages] = await Promise.all([db.select('hq_videos', filtre), db.select('hq_videos', { select: 'status,ligne,cout_usd', limit: 5000 }), S.reglages(db)]);
  const comptes = {};
  let cout = 0;
  tous.forEach((v) => { comptes[v.status] = (comptes[v.status] || 0) + 1; cout += Number(v.cout_usd || 0); });
  // liens signés (une heure) pour les vidéos et vignettes rendues
  const chemins = [];
  videos.forEach((v) => Object.keys(v.rendus || {}).forEach((l) => { const r = v.rendus[l]; if (r && r.etat === 'fini') { chemins.push(ST.chemin(v.id, l, 'video.mp4'), ST.chemin(v.id, l, 'vignette.jpg')); } }));
  let liens = {};
  if (chemins.length) { try { liens = await ST.liensLecture(chemins, 3600); } catch (e) { liens = {}; } }
  const runs = G.branche() ? await G.dernieres(8).catch(() => []) : [];
  return {
    lignes: S.LIGNES, statuts: S.STATUTS, langues: Object.keys(S.LANGUES).reduce((o, k) => { o[k] = S.LANGUES[k].nom; return o; }, {}), reglages, comptes, cout_total: Math.round(cout * 100) / 100,
    usine: { branchee: G.branche(), depot: G.DEPOT, fabrications: runs },
    videos: videos.map((v) => ({
      id: v.id, ligne: v.ligne, titre: v.titre, sujet: v.sujet, statut: v.status, langue_source: v.langue_source, langues: v.langues, cout: Number(v.cout_usd || 0), essais: v.essais, cree: v.created_at, maj: v.updated_at,
      accroche: (v.script || {}).accroche, description: (v.script || {}).description, a_verifier: (v.script || {}).a_verifier || [],
      ecriture: ecriture(v),
      critique: v.critique && v.critique.note != null ? { note: v.critique.note, verdict: v.critique.verdict, resume: v.critique.resume, problemes: v.critique.problemes || [] } : null,
      rendus: Object.keys(v.rendus || {}).map((l) => { const r = v.rendus[l]; return { langue: l, etat: r.etat, duree: r.duree, taille: r.taille, erreur: r.erreur ? court(r.erreur, 300) : null, video: liens[ST.chemin(v.id, l, 'video.mp4')] || null, vignette: liens[ST.chemin(v.id, l, 'vignette.jpg')] || null, titre: l === v.langue_source ? (v.script || {}).titre : ((v.traductions || {})[l] || {}).titre }; })
    }))
  };
}

// ce que la salle d'écriture a fait de la vidéo : l'accroche gardée, la note de Félix, la vérification d'Hélène, l'humour
function ecriture(v) {
  const s = v.script || {}, b = s.brief || {};
  const h = (b.accroches || [])[(b.choix || 1) - 1];
  const rl = (s.relectures || [])[(s.relectures || []).length - 1];
  const fr = (v.traductions || {}).fr;
  return {
    accroche: h ? { voix: h.voix, ecran: h.ecran, famille: h.famille, nombre: (b.accroches || []).length } : null,
    revelation: b.revelation || null,
    viral: rl ? { note: rl.note, resume: rl.resume, versions: s.versions || 1, accroche: (rl.notes || {}).accroche } : null,
    verif: s.verif && s.verif.faits ? { resume: s.verif.resume, faits: s.verif.faits.length, corriges: (s.verif.corriges || []).length, faux: s.verif.faits.filter((f) => f.statut === 'faux').length } : null,
    phrases: (s.beats || []).length || null, mots: s.mots || null,
    blagues: fr && fr.blagues && fr.blagues.length ? fr.blagues : null
  };
}

async function agir(db, op, b) {
  if (op === 'studio_regler') return { ok: true, reglage: await S.regler(db, String(b.ligne || ''), b) };
  const v = await db.one('hq_videos', { eq: { id: Number(b.id) } });
  if (!v) throw new Error('Vidéo introuvable');
  const note = (t) => Object.assign({}, v.critique || {}, { louis: nettoie(court(t, 300)), louis_le: new Date().toISOString() });
  let patch;
  if (b.faire === 'refaire') patch = { status: 'script', rendus: {}, essais: 0, critique: Object.assign(note(b.note || 'Louis demande une autre scène.'), { verdict: 'refaire_scene', resume: nettoie(court(b.note || 'Louis demande une autre scène.', 300)), conseils: nettoie(court(b.note || '', 600)) }) };
  else if (b.faire === 'refuser') patch = { status: 'refuse', critique: note(b.note || 'Refusée par Louis.') };
  else if (b.faire === 'relancer') patch = { status: v.status === 'echec' ? 'scene' : v.status, rendus: Object.keys(v.rendus || {}).reduce((o, l) => { if (v.rendus[l].etat === 'fini') o[l] = v.rendus[l]; return o; }, {}) };
  else if (b.faire === 'valider') {
    if (['critique', 'refuse'].indexOf(v.status) < 0) throw new Error('Rien à valider à cette étape');
    const autres = (v.langues || []).filter((l) => l !== v.langue_source);
    patch = { status: autres.length ? 'traduction' : 'prete', critique: note('Validée par Louis.') };
  } else throw new Error('Action inconnue');
  await S.maj(db, v.id, patch);
  const qui = { refaire: ['animateur'], relancer: ['monteur'], valider: ['plume_fr', 'localisation'] }[b.faire];
  if (qui) await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { in: { id: qui }, neq: { status: 'paused' } }).catch(() => null);
  return { ok: true };
}

module.exports = { liste, agir };
