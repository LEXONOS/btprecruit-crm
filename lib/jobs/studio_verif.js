// Hélène, l'ingénieure du Studio : vérifie chaque fait et chaque chiffre du script avant qu'on fabrique quoi que ce soit
// (une vidéo qui dit un chiffre faux se fait démonter dans les commentaires). Elle cherche sur le web, corrige elle-même
// une phrase approximative en gardant son rythme, et renvoie à Clara si le mécanisme lui-même est faux.
'use strict';
const S = require('../studio');
const V = require('../studio/viral');
const { converse } = require('../claude');
const { relire } = require('../studio/ecrire');
const { court, nettoie } = require('../util');

const OUTIL = {
  name: 'verdict_faits',
  description: 'Ton verdict sur les faits du script, quand tu as fini de vérifier.',
  input_schema: {
    type: 'object',
    properties: {
      faits: { type: 'array', items: { type: 'object', properties: { beat: { type: 'integer' }, affirmation: { type: 'string' }, statut: { type: 'string', enum: ['juste', 'approximatif', 'faux', 'inverifiable'] }, explication: { type: 'string' }, source: { type: 'string' } }, required: ['beat', 'affirmation', 'statut'] }, description: 'Chaque affirmation technique ou chiffrée du script' },
      corrections: { type: 'array', items: { type: 'object', properties: { beat: { type: 'integer' }, voix: { type: 'string', description: 'La phrase corrigée, même longueur à 3 mots près, mêmes *mots forts* si possible' }, ecran: { type: 'string', description: 'Le texte écran corrigé s\'il était faux' } }, required: ['beat', 'voix'] }, description: 'Les phrases que tu corriges toi-même (approximations, chiffres à ajuster)' },
      verdict: { type: 'string', enum: ['ok', 'corrige', 'a_reecrire'], description: 'ok : tout est juste ; corrige : juste après tes corrections ; a_reecrire : le mécanisme ou la révélation est faux, Clara doit reprendre' },
      resume: { type: 'string', description: 'En une ou deux phrases' }
    },
    required: ['faits', 'corrections', 'verdict', 'resume']
  }
};

const SYSTEME = `Tu es Hélène, ingénieure et vérificatrice des faits du Studio 3D. Une chaîne de vidéos « comment ça marche » vit de sa crédibilité : un seul chiffre faux et les commentaires la démontent, et YouTube peut sanctionner.
TON TRAVAIL
1. Liste chaque affirmation technique ou chiffrée du script (températures, pressions, vitesses, ordres de grandeur, ordre des étapes, noms des pièces, la révélation).
2. Vérifie celles dont tu n'es pas certaine avec la recherche web (sources sérieuses : fabricants, manuels techniques, universités, organismes publics, encyclopédies). Deux à quatre recherches suffisent en général.
3. Un ordre de grandeur juste pour une vidéo grand public est « juste » (« around 80 degrees » pour un gaz de clim en sortie de compresseur l'est). Une simplification qui reste vraie est « juste ». Ce qui induit en erreur est « faux ».
4. Corrige toi-même une phrase approximative ou un chiffre à ajuster, en gardant son rythme (même longueur à 3 mots près), ses *mots forts* et son ton parlé anglais.
5. « a_reecrire » seulement si le mécanisme ou la révélation est faux sur le fond.
Termine TOUJOURS par l'outil verdict_faits. Français simple dans tes explications. Pas de tiret long.`;

function texte(v) {
  const s = v.script || {}, b = s.brief || {};
  return 'SUJET : ' + (v.sujet || '') + '\nLE MÉCANISME SELON L\'ÉQUIPE :\n' + (b.mecanisme || []).map((m, i) => (i + 1) + '. ' + m).join('\n') + '\nLA RÉVÉLATION : ' + (b.revelation || '') +
    '\n\nLE SCRIPT :\n' + (s.beats || []).map((x, i) => (i + 1) + '. « ' + x.voix + ' »' + (x.ecran ? ' [écran : ' + x.ecran + ']' : '')).join('\n') +
    (s.sources && s.sources.length ? '\n\nSOURCES DONNÉES PAR LA SCÉNARISTE : ' + s.sources.join(' ; ') : '') +
    (s.a_verifier && s.a_verifier.length ? '\nCE DONT ELLE N\'ÉTAIT PAS SÛRE : ' + s.a_verifier.join(' ; ') : '');
}

async function run(ctx) {
  const db = ctx.db;
  const v = await db.one('hq_videos', { eq: { status: 'verification' }, order: 'updated_at.asc' });
  if (!v) return { resume: 'Aucun script à vérifier.', prochain_min: 45 };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const s0 = v.script || {};
  let r;
  try {
    r = await converse({ tier: 'smart', system: SYSTEME, messages: [{ role: 'user', content: texte(v) + '\n\nVérifie, puis rends ton verdict (outil verdict_faits).' }], tools: [OUTIL], executors: {}, webSearch: { max_uses: 4 }, stopTool: 'verdict_faits', maxSteps: 6, maxTokens: 3000, maxCout: 0.3 });
  } catch (e) { return { resume: 'Vérification impossible : ' + court(e.message, 160), cout: e.cout || 0, erreur: true, prochain_min: 45 }; }
  const x = r.fin ? relire(r.fin, OUTIL.input_schema) : null;
  const echecs = (s0.verif && s0.verif.echecs) || 0;
  if (!x || !Array.isArray(x.faits)) {
    // deux passages sans verdict : la vidéo avance quand même, avec la mention pour Vera et Louis
    if (echecs + 1 >= 2) {
      await S.maj(db, v.id, { status: 'script', script: Object.assign({}, s0, { verif: { echecs: echecs + 1, resume: 'vérification impossible', le: new Date().toISOString() }, a_verifier: (s0.a_verifier || []).concat(['faits non vérifiés (vérification en panne)']).slice(0, 6) }) }, 'verification');
      await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: 'animateur' }, neq: { status: 'paused' } }).catch(() => null);
    } else await S.maj(db, v.id, { script: Object.assign({}, s0, { verif: { echecs: echecs + 1 } }) }, 'verification');
    await S.ajouterCout(db, v.id, r.cout);
    return { resume: 'Pas de verdict sur « ' + court(s0.titre, 50) + ' » (' + (echecs + 1) + ' fois).', cout: r.cout, erreur: true, prochain_min: 30 };
  }
  const faits = x.faits.slice(0, 20).map((f) => ({ beat: Number(f.beat) || 0, affirmation: nettoie(court(f.affirmation, 200)), statut: ['juste', 'approximatif', 'faux', 'inverifiable'].indexOf(f.statut) >= 0 ? f.statut : 'inverifiable', explication: nettoie(court(f.explication || '', 260)), source: court(f.source || '', 200) }));
  // ses corrections : seulement des phrases qui existent, de longueur proche
  const beats = (s0.beats || []).map((b) => Object.assign({}, b));
  const faites = [];
  (Array.isArray(x.corrections) ? x.corrections : []).forEach((c) => {
    const i = Number(c.beat) - 1;
    if (!beats[i] || !c.voix) return;
    const m0 = V.mots(beats[i].voix), m1 = V.mots(c.voix);
    if (m1 < 3 || Math.abs(m1 - m0) > 5 || (String(c.voix).match(/\*/g) || []).length % 2) return;
    beats[i].voix = nettoie(String(c.voix).trim());
    if (c.ecran !== undefined && String(c.ecran).length <= 14) beats[i].ecran = c.ecran ? nettoie(c.ecran) : null;
    faites.push(i + 1);
  });
  const graves = faits.filter((f) => f.statut === 'faux' && faites.indexOf(f.beat) < 0);
  const renvois = (s0.verif && s0.verif.renvois) || 0;
  let suite = 'script';
  if ((x.verdict === 'a_reecrire' || graves.length) && renvois < 1) suite = 'reecriture';
  else if (x.verdict === 'a_reecrire' || graves.length) suite = 'refuse';
  const verif = { le: new Date().toISOString(), verdict: x.verdict, resume: nettoie(court(x.resume, 300)), faits, corriges: faites, renvois: renvois + (suite === 'reecriture' ? 1 : 0), renvoi: suite === 'reecriture', echecs: 0 };
  const inverifiables = faits.filter((f) => f.statut === 'inverifiable').map((f) => 'phrase ' + f.beat + ' : ' + f.affirmation).slice(0, 4);
  const script = Object.assign({}, s0, { beats, verif, a_verifier: inverifiables, mots: beats.reduce((s, b) => s + V.mots(b.voix), 0) });
  const patch = { status: suite, script };
  if (suite === 'refuse') patch.critique = Object.assign({}, v.critique || {}, { resume: 'Hélène : ' + verif.resume, faux: graves.map((f) => f.affirmation) });
  const ok = await S.maj(db, v.id, patch, 'verification');
  await S.ajouterCout(db, v.id, r.cout);
  if (!ok) return { resume: 'La vidéo a changé d\'état pendant la vérification.', cout: r.cout, prochain_min: 10 };
  const prochain = suite === 'script' ? 'animateur' : suite === 'reecriture' ? 'scenariste' : null;
  if (prochain) await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: prochain }, neq: { status: 'paused' } }).catch(() => null);
  if (graves.length) await db.insert('hq_knowledge', { agent_id: 'scenariste', kind: 'lecon', content: 'Hélène a trouvé faux (' + court(s0.titre, 50) + ') : ' + graves.map((f) => f.affirmation + ' (' + f.explication + ')').join(' ; ').slice(0, 400), weight: 7, source: 'verif_studio' }, { returning: false }).catch(() => null);
  ctx.compteurs.items++;
  const nb = (k) => faits.filter((f) => f.statut === k).length;
  return { resume: '« ' + court(s0.titre, 60) + ' » : ' + nb('juste') + ' faits justes, ' + faites.length + ' corrigé(s), ' + nb('faux') + ' faux, ' + nb('inverifiable') + ' invérifiable(s) : ' + (suite === 'script' ? 'prêt à monter.' : suite === 'reecriture' ? 'Clara reprend.' : 'refusé.'), cout: r.cout, produit: 1, prochain_min: 15 };
}

module.exports = { run, OUTIL };
