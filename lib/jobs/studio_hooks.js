// Sacha, l'accrocheur du Studio (ligne Mécanique) : choisit le sujet (la meilleure idée de Malik notée par Sarah, sinon
// le sien), trouve la vraie révélation du mécanisme, puis écrit 8 à 10 accroches de familles différentes, chacune pensée
// pour les trois accroches en même temps (l'image, le texte à l'écran, la voix). Il garde la meilleure, Clara écrit le
// script à partir d'elle. C'est lui qui tient le rythme de la ligne : le stock en fabrication et le quota du jour.
'use strict';
const S = require('../studio');
const V = require('../studio/viral');
const L = require('../studio/langues');
const { outil, recu } = require('../studio/ecrire');
const { court, nettoie, minuitGP, jusquaDemainGP, sansAccents } = require('../util');

const FAMILLES = ['contradiction', 'chiffre_choc', 'enjeu_cache', 'question_impossible', 'personne_ne_dit', 'defi_regard', 'pov', 'comparaison_absurde'];
const OUTIL = {
  name: 'trouver_accroches',
  description: 'Le sujet, sa révélation, et les accroches candidates.',
  input_schema: {
    type: 'object',
    properties: {
      sujet: { type: 'string', description: 'Le mécanisme expliqué, en quelques mots (ex. « climatiseur à compression »)' },
      cle: { type: 'string', description: 'Identifiant court et stable du sujet, en minuscules (ex. « clim-compression ») : sert à ne jamais refaire le même' },
      mecanisme: { type: 'array', minItems: 3, maxItems: 7, items: { type: 'string' }, description: 'Le mécanisme réel, étape par étape, dans l\'ordre où il se passe : une phrase de fait sûr par étape' },
      revelation: { type: 'string', description: 'La chose vraie et surprenante que le spectateur va apprendre (le gain de la vidéo)' },
      chiffres: { type: 'array', items: { type: 'string' }, description: 'Les chiffres vrais et frappants du sujet, avec leur unité et leur ordre de grandeur sûr' },
      pourquoi_maintenant: { type: 'string', description: 'Pourquoi ce sujet parle aux gens en ce moment (saison, actualité, objet du quotidien)' },
      accroches: {
        type: 'array', minItems: 8, maxItems: 10,
        items: {
          type: 'object',
          properties: {
            famille: { type: 'string', enum: FAMILLES },
            voix: { type: 'string', description: 'La toute première phrase dite, en anglais parlé, 12 mots au plus, les mots forts entre *étoiles*' },
            ecran: { type: 'string', description: 'Le texte en gros à l\'écran, 7 mots au plus, un mot entre *étoiles* ; il complète la voix, il ne la répète pas' },
            image: { type: 'string', description: 'Ce qu\'on voit pendant la première seconde et demie : la pièce, déjà en mouvement, et le geste de caméra' },
            question: { type: 'string', description: 'La question précise que cette accroche plante dans la tête du spectateur' },
            notes: { type: 'object', properties: { arret: { type: 'number' }, clarte: { type: 'number' }, curiosite: { type: 'number' }, verite: { type: 'number' } }, required: ['arret', 'clarte', 'curiosite', 'verite'], description: 'Sur 10, sans complaisance : on arrête de scroller ; compris en 1,5 s ; envie de la réponse ; 100 % vrai' }
          },
          required: ['famille', 'voix', 'ecran', 'image', 'question', 'notes']
        }
      },
      choix: { type: 'integer', description: 'Le numéro (à partir de 1) de la meilleure accroche' },
      pourquoi: { type: 'string', description: 'Pourquoi celle-là bat les autres, en une phrase' }
    },
    required: ['sujet', 'cle', 'mecanisme', 'revelation', 'chiffres', 'accroches', 'choix', 'pourquoi']
  }
};

const PIECES = 'engrenages, tuyaux de verre où circule un fluide lumineux, serpentins à ailettes, pistons et bielles, compresseurs, vannes, pompes, ventilateurs, ressorts, vis d\'Archimède, turbines, moteurs électriques, roues, roues de coupe de tunnelier, jets d\'eau, volumes d\'eau, particules (air, chaleur, gouttes), flèches, et des formes simples (boîtes, cylindres, sphères, cônes, tores) pour les carters et les décors';

function systeme(ligneEditoriale, regles, lecons) {
  return `Tu es Sacha, l'accrocheur d'une chaîne de vidéos verticales « comment ça marche » en 3D (TikTok et YouTube Shorts), écrites en anglais puis adaptées en français, espagnol, portugais et hindi. Ton seul travail : que la personne qui scrolle s'arrête net et se dise « attends, quoi ? », puis qu'elle ait besoin de la réponse. Les gens doivent se dire que c'est trop bien fait.

TA MISSION : choisir le sujet, trouver sa vraie révélation (le fait surprenant que presque personne ne sait), puis écrire 8 à 10 accroches de familles DIFFÉRENTES et garder la meilleure.

${V.SIGNAUX}

${V.ACCROCHE}

CE QU'ON PEUT MONTRER (le kit 3D programmé, sans personnage) : ${PIECES}. Pas de visage, pas d'animal, pas de carte, pas de logo, pas de marque. Un sujet qui ne se montre pas avec ça est un mauvais sujet ici.

TES EXIGENCES
- La révélation doit être VRAIE et vérifiable (une ingénieure la vérifie après toi). Aucun chiffre inventé : un chiffre dont tu n'es pas sûr ne va pas dans « chiffres ».
- Une accroche qui ment ou qui promet ce que la vidéo ne montre pas = 0 en vérité, jamais choisie.
- Note sans complaisance : 9 ou 10 seulement pour une accroche que tu partagerais toi-même.
- Jamais de sujet dangereux (armes, explosifs, drogue, piratage). Pas de tiret long, pas d'emoji.

LIGNE ÉDITORIALE DE SARAH (la directrice) :
${ligneEditoriale || 'Séries : mécanismes du quotidien, moteurs et transmissions, engins de chantier, aviation et marine, énergie.'}
${regles ? '\nCE QUE LE PROF DU VIRAL A APPRIS (à appliquer) :\n' + regles : ''}${lecons ? '\nTES LEÇONS :\n' + lecons : ''}`;
}

const motsDe = (s) => V.mots(s);
function verifier(x, faits) {
  const err = [];
  const a = Array.isArray(x.accroches) ? x.accroches : [];
  const bonnes = a.filter((h) => h && h.voix && h.ecran && motsDe(h.voix) <= 14 && motsDe(h.ecran) <= 8);
  if (bonnes.length < 6) err.push('il faut au moins 6 accroches valides (voix de 12 mots au plus, écran de 7 mots au plus) ; ici ' + bonnes.length);
  const familles = new Set(a.map((h) => h && h.famille));
  if (familles.size < 4) err.push('au moins 4 familles d\'accroches différentes (ici ' + familles.size + ')');
  a.forEach((h, i) => { if (h && motsDe(h.voix) > 14) err.push('accroche ' + (i + 1) + ' : voix trop longue (' + motsDe(h.voix) + ' mots)'); if (h && motsDe(h.ecran) > 8) err.push('accroche ' + (i + 1) + ' : écran trop long'); });
  if (!Array.isArray(x.mecanisme) || x.mecanisme.length < 3) err.push('le mécanisme en 3 étapes au moins');
  if (!x.revelation) err.push('la révélation manque');
  const cle = cleDe(x);
  if (faits.some((f) => f.dedupe === cle)) err.push('ce sujet (' + cle + ') est déjà fait : choisis-en un autre');
  return err;
}
const cleDe = (x) => 'meca:' + sansAccents(String(x.cle || x.sujet || '')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// la meilleure accroche : le choix de Sacha s'il est vrai et clair, sinon la mieux notée (l'arrêt et la curiosité d'abord)
function meilleure(x) {
  const a = (x.accroches || []).map((h, i) => Object.assign({ n: i + 1 }, h)).filter((h) => h.voix && h.ecran && motsDe(h.voix) <= 14 && motsDe(h.ecran) <= 8);
  const note = (h) => { const n = h.notes || {}; return 0.35 * (Number(n.arret) || 0) + 0.3 * (Number(n.curiosite) || 0) + 0.2 * (Number(n.clarte) || 0) + 0.15 * (Number(n.verite) || 0); };
  const vrai = (h) => (Number((h.notes || {}).verite) || 0) >= 8 && (Number((h.notes || {}).clarte) || 0) >= 7;
  const choisie = a.find((h) => h.n === Number(x.choix));
  if (choisie && vrai(choisie)) return choisie;
  return a.filter(vrai).sort((p, q) => note(q) - note(p))[0] || a.sort((p, q) => note(q) - note(p))[0] || null;
}

async function run(ctx) {
  const db = ctx.db;
  const reg = (await S.reglages(db)).meca;
  if (!reg.videos_jour) return { resume: 'Ligne Mécanique en pause (0 vidéo par jour).', prochain_min: 240 };
  const enCours = await db.count('hq_videos', { eq: { ligne: 'meca' }, in: { status: S.EN_COURS } });
  if (enCours >= reg.stock) return { resume: 'Stock plein : ' + enCours + ' vidéos en fabrication, j\'attends qu\'il descende.', prochain_min: 90 };
  const aujourdhui = await db.count('hq_videos', { eq: { ligne: 'meca' }, gte: { created_at: minuitGP().toISOString() } });
  if (aujourdhui >= reg.videos_jour) return { resume: 'Quota du jour atteint (' + aujourdhui + ' sujets lancés).', prochain_min: jusquaDemainGP(30) };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };

  // l'idée : la mieux notée de Malik (ou de Sarah), sinon Sacha choisit seul
  const idees = (await db.select('hq_items', { eq: { company_id: 'studio3d', kind: 'idee', status: 'nouveau' }, order: ['score.desc', 'id.asc'], limit: 12 })).filter((i) => !(i.data && i.data.ligne) || i.data.ligne === 'meca');
  const idee = idees[0] || null;
  const faits = await db.select('hq_videos', { select: 'sujet,titre,dedupe', eq: { ligne: 'meca' }, order: 'id.desc', limit: 150 });
  const sarah = await db.one('hq_agents', { eq: { id: 'dired_studio' }, select: 'playbook' });
  const lecons = (await db.select('hq_knowledge', { eq: { agent_id: ctx.agent.id }, order: ['weight.desc', 'id.desc'], limit: 6 }).catch(() => [])).map((k) => '- ' + court(k.content, 220)).join('\n');
  const regles = await V.lecons(db, 8);
  const actu = [await L.actu(db, 'en'), await L.actu(db, 'fr')].filter(Boolean).join('\n');

  const consigne = (idee ? 'L\'IDÉE À TRAITER (de ' + (idee.agent_id || 'l\'équipe') + ') : ' + idee.title + '\n' + court(idee.body, 1200) : 'Pas d\'idée en attente : choisis toi-même le meilleur sujet du moment dans la ligne éditoriale.') +
    (actu ? '\n\nCE DONT LES GENS PARLENT CETTE SEMAINE (pour choisir un sujet de saison, pas obligatoire) :\n' + actu : '') +
    '\n\nDÉJÀ FAITS (ne refais aucun de ces sujets, même sous un autre angle) :\n' + (faits.map((f) => '- ' + court(f.sujet || f.titre, 80)).join('\n') || '- aucun pour l\'instant') +
    '\n\nTrouve la révélation et écris les accroches (outil trouver_accroches).';
  const sys = systeme(sarah && sarah.playbook, regles, lecons);
  let r, cout = 0;
  try { r = await outil({ tier: 'smart', systeme: sys, contenu: consigne, outil: OUTIL, maxTokens: 5000 }); cout += r.cout; }
  catch (e) { return { resume: 'Accroches impossibles : ' + court(e.message, 200), cout: e.cout || 0, erreur: true, prochain_min: 60 }; }
  let x = r.entree, err = verifier(x, faits);
  if (err.length) {
    try {
      const r2 = await outil({ tier: 'smart', systeme: sys, contenu: consigne + '\n\nTON PREMIER JET A ÉTÉ REFUSÉ :\n- ' + err.join('\n- ') + '\n\nPREMIER JET :\n' + JSON.stringify(x).slice(0, 5000) + '\n\nRecommence en corrigeant tout.', outil: OUTIL, maxTokens: 5000 });
      cout += r2.cout; x = r2.entree; err = verifier(x, faits);
    } catch (e) { cout += e.cout || 0; }
  }
  if (err.length) {
    if (idee && err.some((e) => /déjà fait/.test(e))) await db.update('hq_items', { status: 'traite', updated_at: new Date().toISOString() }, { eq: { id: idee.id } });
    return { resume: 'Accroches refusées par le contrôle : ' + err.join(' ; ') + ' [reçu : ' + recu(x) + ']', cout, erreur: true, prochain_min: 60 };
  }
  const h = meilleure(x);
  if (!h) return { resume: 'Aucune accroche assez vraie et claire, je recommence plus tard.', cout, erreur: true, prochain_min: 60 };

  const accroches = x.accroches.slice(0, 10).map((a, i) => ({ n: i + 1, famille: a.famille, voix: nettoie(court(a.voix, 120)), ecran: nettoie(court(a.ecran, 70)), image: nettoie(court(a.image, 240)), question: nettoie(court(a.question, 200)), notes: a.notes || {} }));
  const brief = {
    mecanisme: x.mecanisme.slice(0, 7).map((m) => nettoie(court(m, 240))), revelation: nettoie(court(x.revelation, 300)),
    chiffres: (x.chiffres || []).slice(0, 8).map((c) => nettoie(court(c, 120))), pourquoi_maintenant: nettoie(court(x.pourquoi_maintenant || '', 240)),
    accroches, choix: h.n, pourquoi: nettoie(court(x.pourquoi, 240)), idee: idee ? { id: idee.id, titre: idee.title } : null
  };
  const cle = cleDe(x);
  const ins = await db.insert('hq_videos', { ligne: 'meca', sujet: nettoie(court(x.sujet, 120)), titre: nettoie(court(x.sujet, 90)), status: 'accroche', langue_source: 'en', langues: reg.langues, script: { brief, accroche: accroches[h.n - 1].ecran }, item_id: idee ? idee.id : null, dedupe: cle, cout_usd: Math.round(cout * 10000) / 10000 }, { onConflict: 'dedupe', ignoreDuplicates: true });
  if (idee) await db.update('hq_items', { status: 'traite', updated_at: new Date().toISOString() }, { eq: { id: idee.id } });
  if (!ins.length) return { resume: 'Sujet déjà en base, rien de neuf.', cout, prochain_min: 20 };
  ctx.compteurs.items++;
  // Clara écrit dans la foulée
  await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: 'scenariste' }, neq: { status: 'paused' } }).catch(() => null);
  return { resume: '« ' + court(x.sujet, 60) + ' » : ' + accroches.length + ' accroches, je garde « ' + court(V.sansEtoiles(h.voix), 90) + ' » (' + h.famille + ').', cout, produit: 1, prochain_min: 30, detail: { video: ins[0].id, revelation: brief.revelation } };
}

module.exports = { run, OUTIL, FAMILLES, verifier, meilleure };
