// Félix, le prof du viral du Studio : relit chaque script comme le ferait l'algorithme et le spectateur qui scrolle.
// Il note la grille de la bible du viral (accroche, enjeu, boucles, relance, rythme, concret, révélation, fin qui boucle,
// humour, clarté), dit à quelle phrase les gens décrochent et propose les phrases réécrites. Au-dessus du seuil le
// script part chez Hélène (vérification des faits) ; en dessous, Clara réécrit (deux fois au plus). Ce qu'il voit revenir
// devient une règle que toute l'équipe d'écriture lit.
'use strict';
const S = require('../studio');
const V = require('../studio/viral');
const { outil } = require('../studio/ecrire');
const { court, nettoie } = require('../util');

const NOTES = {};
V.GRILLE.forEach((g) => { NOTES[g[0]] = { type: 'number', description: g[1] + ' (sur 10)' }; });
const OUTIL = {
  name: 'juger_script',
  description: 'Ton jugement du script.',
  input_schema: {
    type: 'object',
    properties: {
      notes: { type: 'object', properties: NOTES, required: V.GRILLE.map((g) => g[0]) },
      spectateur: { type: 'array', items: { type: 'object', properties: { beat: { type: 'integer' }, risque: { type: 'integer', description: '0 à 3 : 3 = la plupart des gens scrollent ici' }, pourquoi: { type: 'string' } }, required: ['beat', 'risque', 'pourquoi'] }, description: 'Les phrases où un spectateur risque de décrocher (seulement celles-là)' },
      corrections: { type: 'array', items: { type: 'object', properties: { beat: { type: 'integer' }, probleme: { type: 'string' }, proposition: { type: 'string', description: 'La phrase réécrite, prête à dire' } }, required: ['beat', 'probleme'] }, description: 'Les corrections précises, phrase par phrase, les plus importantes d\'abord' },
      accroche_meilleure: { type: 'string', description: 'Seulement si tu as nettement mieux : une accroche (voix) plus forte, vraie, 12 mots au plus' },
      resume: { type: 'string', description: 'Ton avis en 2 phrases, la plus grosse faiblesse d\'abord' },
      lecon: { type: 'string', description: 'Facultatif : une règle générale que tu vois revenir et que toute l\'équipe doit appliquer désormais (une phrase), vide sinon' }
    },
    required: ['notes', 'spectateur', 'corrections', 'resume']
  }
};

function systeme(regles) {
  return `Tu es Félix, le prof du viral du Studio 3D. Tu as étudié des milliers de vidéos courtes qui ont explosé et des milliers qui sont mortes à 200 vues. Tu sais exactement à quelle seconde les gens scrollent et pourquoi. Tu relis des scripts de vidéos verticales « comment ça marche » en 3D (62 à 75 secondes, anglais), avant qu'on les fabrique.

${V.TOUT}

${V.IMAGE}

TA GRILLE (chaque critère sur 10, sans complaisance : 9 ou 10 seulement pour ce que tu partagerais toi-même) :
${V.GRILLE.map((g) => '- ' + g[0] + ' : ' + g[1] + ' (poids ' + g[2] + ')').join('\n')}
Le script part en fabrication à ${V.SEUIL_SCRIPT}/10 de moyenne pondérée, avec au moins 8 en accroche et 7 en clarté.

COMMENT TU RELIS
1. Lis la phrase 1 et l'accroche à l'écran comme quelqu'un qui scrolle à 23 h : t'arrêtes-tu ? Comprends-tu en 1,5 s ? As-tu une question précise en tête ?
2. Puis phrase par phrase, chronomètre en main (2,5 mots par seconde) : où est le premier moment où rien de neuf n'arrive ? C'est là qu'ils partent.
3. Vérifie que chaque boucle annoncée est payée, que la relance tombe vers le milieu, que la fin renvoie au début.
4. Tes corrections sont des phrases prêtes à dire, pas des conseils vagues. Les plus importantes d'abord, 8 au plus.
Français simple dans tes explications, anglais pour les phrases proposées. Pas de tiret long.${regles ? '\n\nTES RÈGLES APPRISES (applique-les dans ta notation) :\n' + regles : ''}`;
}

function texteScript(v) {
  const s = v.script || {}, b = s.brief || {};
  return 'SUJET : ' + (v.sujet || '') + '\nRÉVÉLATION VISÉE : ' + (b.revelation || '') + '\nTITRE : ' + (s.titre || '') + '\nTEXTE À L\'ÉCRAN PENDANT LA PHRASE 1 : « ' + (s.accroche || '') + ' »\n\n' +
    (s.beats || []).map((x, i) => (i + 1) + '. [' + (x.role || '?') + '] « ' + x.voix + ' »' + (x.ecran ? ' [écran : ' + x.ecran + ']' : '') + '\n   on voit : ' + (x.image || '')).join('\n') +
    '\n\nBOUCLES : ' + ((s.boucles || []).map((x) => 'annoncée phrase ' + x.annonce + ', payée phrase ' + x.paiement + ' (' + x.promesse + ')').join(' ; ') || 'aucune') +
    '\nMOTS : ' + (s.mots || '?') + ', VERSION : ' + (s.versions || 1);
}

async function run(ctx) {
  const db = ctx.db;
  const v = await db.one('hq_videos', { eq: { status: 'relecture' }, order: 'updated_at.asc' });
  if (!v) return { resume: 'Aucun script à relire.', prochain_min: 45 };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const regles = await V.lecons(db, 12);
  const s0 = v.script || {};
  const avant = s0.relectures || [];
  let contenu = texteScript(v);
  if (avant.length) contenu += '\n\nTA RELECTURE PRÉCÉDENTE (' + avant[avant.length - 1].note + '/10) : ' + avant[avant.length - 1].resume + '\nVérifie que tes corrections ont été faites, et juge la nouvelle version pour ce qu\'elle est.';
  contenu += '\n\nJuge ce script (outil juger_script).';
  let r;
  try { r = await outil({ tier: 'smart', systeme: systeme(regles), contenu, outil: OUTIL, maxTokens: 2500 }); }
  catch (e) { return { resume: 'Relecture impossible : ' + court(e.message, 160), cout: e.cout || 0, erreur: true, prochain_min: 45 }; }
  const x = r.entree;
  const notes = {};
  V.GRILLE.forEach((g) => { notes[g[0]] = Math.max(0, Math.min(10, Math.round(Number((x.notes || {})[g[0]]) * 2) / 2 || 0)); });
  const note = V.noteGrille(notes);
  const relecture = {
    note, notes, le: new Date().toISOString(), version: s0.versions || 1,
    resume: nettoie(court(x.resume, 400)),
    spectateur: (Array.isArray(x.spectateur) ? x.spectateur : []).slice(0, 8).map((p) => ({ beat: Number(p.beat) || 0, risque: Math.max(0, Math.min(3, Number(p.risque) || 0)), pourquoi: nettoie(court(p.pourquoi, 200)) })),
    corrections: (Array.isArray(x.corrections) ? x.corrections : []).slice(0, 8).map((c) => ({ beat: Number(c.beat) || 0, probleme: nettoie(court(c.probleme, 240)), proposition: c.proposition ? nettoie(court(c.proposition, 200)) : '' })),
    accroche_meilleure: x.accroche_meilleure ? nettoie(court(x.accroche_meilleure, 120)) : ''
  };
  const ok = note >= V.SEUIL_SCRIPT && notes.accroche >= 8 && notes.clarte >= 7;
  // deux réécritures au plus ; au bout, un script correct passe quand même, un script faible sort
  let suite, verdict;
  if (ok) { suite = 'verification'; verdict = 'validé'; }
  else if (avant.length < 2) { suite = 'reecriture'; verdict = 'à réécrire'; }
  else if (note >= 7.5 && notes.accroche >= 7) { suite = 'verification'; verdict = 'passe de justesse'; }
  else { suite = 'refuse'; verdict = 'refusé'; }
  const script = Object.assign({}, s0, { relectures: avant.concat([relecture]).slice(-4), note_viral: note });
  const patch = { status: suite, script };
  if (suite === 'refuse') patch.critique = Object.assign({}, v.critique || {}, { resume: 'Félix : ' + relecture.resume, note });
  const fait = await S.maj(db, v.id, patch, 'relecture');
  await S.ajouterCout(db, v.id, r.cout);
  if (!fait) return { resume: 'La vidéo a changé d\'état pendant la relecture.', cout: r.cout, prochain_min: 10 };
  // une règle qu'il voit revenir : toute l'équipe d'écriture la lit désormais
  const lecon = nettoie(court(x.lecon || '', 260)).trim();
  if (lecon.length > 20) {
    const deja = await db.select('hq_knowledge', { select: 'content', eq: { agent_id: 'prof_viral' }, limit: 60 }).catch(() => []);
    const tete = lecon.toLowerCase().slice(0, 50);
    if (!deja.some((k) => String(k.content).toLowerCase().slice(0, 50) === tete)) await db.insert('hq_knowledge', { agent_id: 'prof_viral', kind: 'regle', content: lecon, weight: 6, source: 'prof_viral' }, { returning: false }).catch(() => null);
  }
  const prochain = suite === 'verification' ? 'verif_studio' : suite === 'reecriture' ? 'scenariste' : null;
  if (prochain) await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: prochain }, neq: { status: 'paused' } }).catch(() => null);
  ctx.compteurs.items++;
  return { resume: '« ' + court(s0.titre || v.sujet, 60) + ' » : ' + note + '/10 (accroche ' + notes.accroche + '), ' + verdict + '. ' + court(relecture.resume, 160), cout: r.cout, produit: 1, prochain_min: 15 };
}

module.exports = { run, OUTIL };
