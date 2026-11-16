// Les voix naturelles des créatrices : chaque phrase de chaque langue dite par une voix d'ElevenLabs (Eleven v4), sur
// sa clé fal, dans le même budget du jour que Claude. La voix gratuite (Kokoro, Piper) reste pour celles qui n'ont pas
// branché fal, ou qui coupent les voix naturelles.
// Une demande directe par phrase (quelques secondes chacune), quatre à la fois : la coupe entre deux phrases tombe ainsi
// exactement sur la voix, et le mot dit s'allume au bon moment. Chaque phrase est réservée sur son budget avant de
// partir, rendue si fal n'a rien fait. Deux essais par phrase ; une langue dont une phrase rate deux fois reprend la voix
// gratuite en entier (jamais deux voix dans une même vidéo). Les voix déjà faites, au même texte et à la même voix, de
// moins de 6 jours (fal garde les fichiers 14 jours), sont reprises : « Refaire le montage » ne repaie rien.
// Une clé fal refusée, un compte sans crédit ou le budget du jour atteint lèvent une erreur : la vidéo attend, avec le
// message pour la créatrice (elle peut aussi couper les voix naturelles dans ses réglages).
'use strict';
const C = require('./index');
const CL = require('./claude');
const FAL = require('./fal');
const { majFraiche } = require('../db');
const { court } = require('../util');

const iso = () => new Date().toISOString();
const ESSAIS = 2;
const EN_MEME_TEMPS = 4;
const REUTILISABLE_JOURS = 6;
const TEMPS_MIN = 40000;   // moins de 40 secondes devant soi : on s'arrête, la suite au passage suivant

// les phrases d'une langue telles qu'elles seront dites : sans les étoiles des mots forts, les phrases vides écartées
// (comme le fait l'usine, pour que la phrase n et le fichier n soient toujours les mêmes)
function phrasesDe(v, langue) {
  const s = langue === v.langue_source ? v.script : (v.traductions || {})[langue];
  return ((s && s.beats) || []).filter((b) => b && String(b.voix || '').trim()).map((b) => String(b.voix).replace(/\*/g, '').replace(/\s+/g, ' ').trim());
}

// la voix naturelle sert pour cette vidéo : allumée, sa clé fal branchée, et la vidéo n'a pas été lancée « sans fal »
const applicable = (c, v) => C.voixNaturelle(c) && !((v && v.plan) || {}).sans_fal;

// le point de départ d'un passage. Dans la même réalisation (le même « tour »), tout continue tel quel : les essais
// comptés, les langues déjà ratées restent à la voix gratuite. Sinon (« Refaire le montage », une autre voix), on
// repart en reprenant les phrases déjà dites au même texte, avec la même voix, assez récentes.
function etatDe(v, voix, avant, tour) {
  const frais = avant && avant.voix === voix && avant.modele === FAL.MODELES.voix.id ? avant : null;
  const memesTextes = frais && (v.langues || []).every((l) => {
    const ms = ((frais.langues || {})[l] || {}).morceaux;
    const t = phrasesDe(v, l);
    return ms && ms.length === t.length && t.every((x, i) => ms[i].texte === x);
  });
  if (frais && frais.tour === tour && memesTextes) return JSON.parse(JSON.stringify(frais));
  const recent = (m) => m && m.etat === 'fini' && m.url && Date.now() - new Date(m.fini_le || 0).getTime() < REUTILISABLE_JOURS * 86400000;
  const langues = {};
  (v.langues || []).forEach((l) => {
    const anciens = ((frais && (frais.langues || {})[l]) || {}).morceaux || [];
    const morceaux = phrasesDe(v, l).map((t) => {
      const a = anciens.find((m) => m.texte === t && recent(m));
      return a ? Object.assign({}, a) : { texte: t, etat: 'attente', essais: 0 };
    });
    langues[l] = { etat: 'attente', morceaux };
  });
  return { modele: FAL.MODELES.voix.id, voix, tour, langues, cout: 0, debut_le: iso(), fin_le: null };
}

// l'état de chaque langue : finie (toutes ses phrases dites), ratée (une phrase a raté deux fois : la voix gratuite la
// remplace), ou encore en route
function bilan(g) {
  let faits = 0, total = 0;
  Object.keys(g.langues).forEach((l) => {
    const ms = g.langues[l].morceaux;
    total += ms.length;
    faits += ms.filter((m) => m.etat === 'fini').length;
    g.langues[l].etat = !ms.length || ms.some((m) => m.etat === 'echec') ? 'echec' : ms.every((m) => m.etat === 'fini') ? 'fini' : 'attente';
  });
  return { voix: [faits, total], ratees: Object.keys(g.langues).filter((l) => g.langues[l].etat === 'echec') };
}
const resteAFaire = (g) => Object.keys(g.langues).some((l) => g.langues[l].etat === 'attente');

// Un passage : dire tout ce qui reste à dire (dans le temps qu'il reste à la requête). Rend { fini, progres, generation }.
async function realiser(db, c, v) {
  const k = FAL.cle(c);
  const r = C.reglagesDe(c);
  const voix = r.voix_ia.voix;
  const g = etatDe(v, voix, (v.plan || {}).voix_ia, String((v.etape || {}).depuis || 'premier'));
  bilan(g);
  if (!resteAFaire(g)) return { fini: true, progres: bilan(g), generation: g };
  // la même graine pour toutes les phrases d'une vidéo : la même voix, le même souffle, d'une phrase à l'autre
  const graine = (Number(v.id) * 7919 + 17) % 4294967295;
  let depense = 0, surcharge = null, arret = null;

  async function dire(l, m) {
    const prix = FAL.prixVoix(m.texte);
    const resa = await CL.compter(db, c, prix, r.budget_jour);
    if (!resa.ok) throw new CL.ErreurStudio('budget', CL.MESSAGES.budget);
    depense += prix;
    m.essais = (m.essais || 0) + 1;
    let s;
    try { s = await FAL.executer(k, FAL.MODELES.voix.id, FAL.entreeVoix(m.texte, voix, l, graine), 60000); }
    catch (e) {
      // fal n'a rien fait : rien n'est facturé, la réservation est rendue
      await CL.compter(db, c, -prix);
      depense -= prix;
      if (e.code === 'fal_surcharge') { surcharge = e; m.essais--; return; }
      if (!e.definitif) throw e;
      m.erreur = court(e.message, 200);
      if (m.essais >= ESSAIS) m.etat = 'echec';
      return;
    }
    const a = FAL.lireAudio(s);
    // rendue sans fichier utilisable : fal l'a facturée, on réessaie une fois
    if (!a.url) { m.erreur = court(a.erreur, 200); if (m.essais >= ESSAIS) m.etat = 'echec'; return; }
    Object.assign(m, { etat: 'fini', url: a.url, prix, fini_le: iso(), erreur: null });
  }

  async function sauver() {
    const delta = Math.round(depense * 100000) / 100000;
    depense = 0;
    g.cout = Math.round(((Number(g.cout) || 0) + delta) * 100000) / 100000;
    const progres = bilan(g);
    if (!resteAFaire(g) && !g.fin_le) g.fin_le = iso();
    await majFraiche(db, 'hq_crea_videos', v.id, (f) => (f.status !== 'realisation' ? null : {
      plan: Object.assign({}, f.plan || {}, { voix_ia: g }),
      cout_usd: Math.round(((Number(f.cout_usd) || 0) + delta) * 10000) / 10000,
      etape: Object.assign({}, f.etape || {}, { quoi: 'voix', progres })
    }));
    return progres;
  }

  try {
    for (;;) {
      // les phrases à dire, langue par langue (une langue déjà ratée n'en a plus besoin : elle prend la voix gratuite)
      const travail = [];
      Object.keys(g.langues).forEach((l) => { if (g.langues[l].etat === 'attente') g.langues[l].morceaux.forEach((m) => { if (m.etat === 'attente') travail.push([l, m]); }); });
      if (!travail.length || surcharge) break;
      if (CL.resteTemps() < TEMPS_MIN) { arret = 'temps'; break; }
      await Promise.all(travail.slice(0, EN_MEME_TEMPS).map(([l, m]) => dire(l, m)));
      bilan(g);
    }
    if ((c.secrets || {}).fal && (c.secrets.fal.etat || 'ok') !== 'ok' && !surcharge) await FAL.marquer(db, c, 'ok');
  } catch (e) {
    if (e.code === 'fal_refusee') await FAL.marquer(db, c, 'refusee', 'fal a refusé la clé le ' + new Date().toLocaleDateString('fr-FR'));
    if (e.code === 'fal_credit') await FAL.marquer(db, c, 'credit', 'plus de crédit chez fal');
    await sauver();
    throw e;
  }
  const progres = await sauver();
  // fal en difficulté et rien n'a avancé : la chaîne réessaiera dans quelques minutes
  if (surcharge && resteAFaire(g) && !arret) throw surcharge;
  return { fini: !resteAFaire(g), progres, generation: g };
}

// La voix d'une langue pour l'usine : les fichiers de chaque phrase, si toutes sont dites et toujours au même texte ;
// sinon rien (l'usine prend la voix gratuite de la langue)
function pourUsine(v, langue) {
  const g = (v.plan || {}).voix_ia;
  const l = g && (g.langues || {})[langue];
  if (!l || l.etat !== 'fini') return null;
  const textes = phrasesDe(v, langue);
  const ms = l.morceaux || [];
  if (!textes.length || textes.length !== ms.length || textes.some((t, i) => !ms[i] || ms[i].texte !== t || ms[i].etat !== 'fini' || !FAL.mediaAccepte(ms[i].url))) return null;
  return { moteur: 'fichiers', fichiers: ms.map((m) => m.url), voix: g.voix, modele: g.modele };
}

// Écouter une voix avant de la choisir : une phrase dans la langue demandée, sur sa clé fal (moins d'un centime)
async function ecouter(db, c, voix, langue) {
  if (!Object.prototype.hasOwnProperty.call(C.VOIX_IA, voix)) return { code: 400, erreur: 'voix inconnue' };
  const l = Object.prototype.hasOwnProperty.call(C.PHRASES_ECOUTE, langue) ? langue : 'fr';
  let k;
  try { k = FAL.cle(c); } catch (e) { return { code: 409, erreur: e.message }; }
  const texte = C.PHRASES_ECOUTE[l];
  const prix = FAL.prixVoix(texte);
  const r = C.reglagesDe(c);
  const resa = await CL.compter(db, c, prix, r.budget_jour);
  if (!resa.ok) return { code: 402, erreur: CL.MESSAGES.budget };
  try {
    const s = await FAL.executer(k, FAL.MODELES.voix.id, FAL.entreeVoix(texte, voix, l, 7), 45000);
    const a = FAL.lireAudio(s);
    if (!a.url) return { code: 502, erreur: a.erreur };
    if ((c.secrets || {}).fal && (c.secrets.fal.etat || 'ok') !== 'ok') await FAL.marquer(db, c, 'ok');
    return { code: 200, ok: true, url: a.url, prix };
  } catch (e) {
    await CL.compter(db, c, -prix);
    if (e.code === 'fal_refusee') await FAL.marquer(db, c, 'refusee', 'fal a refusé la clé le ' + new Date().toLocaleDateString('fr-FR'));
    if (e.code === 'fal_credit') await FAL.marquer(db, c, 'credit', 'plus de crédit chez fal');
    return { code: e.code === 'fal_surcharge' ? 503 : 409, erreur: e.message };
  }
}

module.exports = { realiser, pourUsine, ecouter, applicable, phrasesDe, etatDe, ESSAIS, EN_MEME_TEMPS };
