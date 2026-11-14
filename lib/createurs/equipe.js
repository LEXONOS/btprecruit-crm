// Le travail de l'équipe d'une créatrice, avec sa clé Claude : les idées (Maya), le script (Inès), la relecture notée
// (Jade), l'adaptation dans chaque langue (Nora). Les prénoms sont ceux qu'elle a choisis, ses consignes à chacun
// sont lues à chaque fois. Chaque réponse passe par un outil (une forme fixe), puis est vérifiée ici avant d'être gardée.
'use strict';
const B = require('./bible');
const C = require('./index');
const CL = require('./claude');
const { court, nettoie } = require('../util');

const NOMS_LANGUE = { fr: 'français', en: 'anglais américain', es: 'espagnol', pt: 'portugais du Brésil', it: 'italien', hi: 'hindi, écrit en devanagari' };
function nomLangue(reglages, l) { return l === 'en' && /^b/.test(C.voixDe(reglages, 'en').voix) ? 'anglais britannique' : (NOMS_LANGUE[l] || l); }
const propre = (s, n) => nettoie(court(String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim(), n));

function contexte(createur) {
  const r = C.reglagesDe(createur);
  const ch = r.chaine;
  const lignes = ['LA CHAÎNE DE ' + String(createur.prenom || '').toUpperCase()];
  if (ch.nom) lignes.push('- Nom : ' + ch.nom);
  lignes.push('- Sujets : ' + (ch.sujets || 'pas encore précisés : reste général et grand public'));
  if (ch.public) lignes.push('- Public : ' + ch.public);
  if (ch.ton) lignes.push('- Ton : ' + ch.ton);
  if (ch.exemples) lignes.push('- Des vidéos qu\'elle aime ou qui ont marché : ' + ch.exemples);
  if (ch.interdits) lignes.push('- Ce qu\'elle ne veut jamais : ' + ch.interdits);
  lignes.push('- Elle publie sur TikTok, YouTube Shorts et Instagram Reels, en vertical. Langue principale : ' + nomLangue(r, r.langue_source) + '.');
  return lignes.join('\n');
}
function moiDans(createur, role) {
  const e = C.equipeDe(createur)[role];
  return { prenom: e.prenom, consignes: e.consignes ? '\nSES CONSIGNES POUR TOI (à suivre en priorité) :\n' + e.consignes : '' };
}

/* ── Maya : les idées ── */
const OUTIL_IDEES = {
  name: 'proposer_idees',
  description: 'Rend les idées de vidéos proposées à la créatrice.',
  input_schema: {
    type: 'object',
    properties: {
      idees: {
        type: 'array', minItems: 3, maxItems: 6,
        items: {
          type: 'object',
          properties: {
            titre: { type: 'string', description: 'Le sujet de la vidéo en une ligne (60 signes au plus)' },
            accroche: { type: 'string', description: 'La première phrase dite, telle qu\'elle sera dite (18 mots au plus)' },
            angle: { type: 'string', description: 'Ce que la vidéo raconte et révèle, en deux phrases' },
            pourquoi: { type: 'string', description: 'Pourquoi elle peut marcher maintenant (tendance, question que tout le monde se pose, émotion), une phrase' }
          },
          required: ['titre', 'accroche', 'angle', 'pourquoi']
        }
      }
    },
    required: ['idees']
  }
};

async function proposerIdees(db, createur, opts) {
  opts = opts || {};
  const r = C.reglagesDe(createur);
  const m = moiDans(createur, 'idees');
  const system = 'Tu es ' + m.prenom + ', chargée des idées dans l\'équipe de ' + createur.prenom + ', créatrice de vidéos courtes. Tu trouves des sujets qui donnent envie de regarder jusqu\'au bout, adaptés à sa chaîne.\n\n' +
    contexte(createur) + m.consignes + '\n\n' + B.SIGNAUX + '\n\n' + B.ACCROCHE + '\n\n' + B.INTERDITS;
  const deja = (opts.deja || []).slice(0, 25);
  const prompt = 'Propose ' + (opts.nombre || 5) + ' idées de vidéos ' + (r.format === 'long' ? 'd\'un peu plus d\'une minute' : 'de 35 à 50 secondes') + ' pour sa chaîne, en ' + nomLangue(r, r.langue_source) + ', toutes différentes (pas cinq fois le même angle).' +
    (opts.theme ? '\nElle veut des idées sur ce thème : ' + propre(opts.theme, 300) + '.' : '') +
    (deja.length ? '\nSujets déjà faits (à ne pas refaire) :\n- ' + deja.map((t) => propre(t, 90)).join('\n- ') : '') +
    (opts.recherches ? '\nCommence par 2 ou 3 recherches web sur ce dont on parle en ce moment dans sa niche (actualité, tendances, questions que les gens se posent cette semaine), puis appelle l\'outil proposer_idees.' : '\nAppelle directement l\'outil proposer_idees.') +
    '\nChaque accroche doit pouvoir être dite telle quelle en première phrase. Rien d\'inventé : si une idée repose sur un fait, il doit être vrai.';
  const res = await CL.appeler(db, createur, { usage: 'idees', system, prompt, outil: OUTIL_IDEES, maxTokens: 2200, recherches: opts.recherches ? 3 : 0 });
  const idees = (res.sortie.idees || []).filter((x) => x && x.titre).slice(0, 6).map((x, i) => ({
    id: Date.now().toString(36) + i, titre: propre(x.titre, 90), accroche: propre(x.accroche, 160), angle: propre(x.angle, 400), pourquoi: propre(x.pourquoi, 240), le: new Date().toISOString()
  }));
  if (!idees.length) throw new CL.ErreurStudio('claude', 'aucune idée rendue');
  return { idees, cout: res.cout, modele: res.modele };
}

/* ── Inès : le script ── */
function outilScript(avecImages) {
  const beat = { voix: { type: 'string', description: 'La phrase dite, 6 à 18 mots, les mots forts entre *étoiles*' }, ecran: { type: 'string', description: 'Le texte court à l\'écran pendant cette phrase, 2 à 5 mots' } };
  const req = ['voix', 'ecran'];
  if (avecImages) {
    beat.visuel = { type: 'object', properties: { requete: { type: 'string', description: 'Recherche de vidéo libre de droits EN ANGLAIS, 2 à 4 mots concrets et filmables' }, description: { type: 'string', description: 'Ce qu\'on voit, en français, une courte phrase' } }, required: ['requete', 'description'] };
    req.push('visuel');
  }
  return {
    name: 'ecrire_script',
    description: 'Rend le script complet de la vidéo.',
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: 'Le titre de la vidéo (40 à 90 signes), qui donne envie sans tout dire' },
        accroche: { type: 'string', description: 'Le texte à l\'écran des 2 premières secondes, 7 mots au plus' },
        beats: { type: 'array', items: { type: 'object', properties: beat, required: req } },
        description: { type: 'string', description: 'Le texte de la publication : une ou deux phrases, puis une question qui donne envie de commenter (300 signes au plus)' },
        hashtags: { type: 'array', items: { type: 'string' }, description: '3 à 6 hashtags pertinents, sans le signe #' },
        titre_youtube: { type: 'string', description: 'Le titre YouTube Shorts, 70 signes au plus' },
        image_generale: { type: 'string', description: 'Une recherche EN ANGLAIS de 2 ou 3 mots qui illustre le sujet en général (secours si une image manque)' }
      },
      required: ['titre', 'accroche', 'beats', 'description', 'hashtags', 'titre_youtube']
    }
  };
}

function nettoyerScript(x, avecImages, format) {
  const f = B.FORMATS[format] || B.FORMATS.court;
  const beats = (Array.isArray(x.beats) ? x.beats : []).map((b) => {
    const voix = propre(b && b.voix, 260);
    if (!voix) return null;
    const out = { voix, ecran: propre(b.ecran, 48).replace(/\*/g, '') };
    if (avecImages && b.visuel) out.visuel = { requete: propre(b.visuel.requete, 60).replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim(), description: propre(b.visuel.description, 160) };
    return out;
  }).filter(Boolean);
  const pb = [];
  if (beats.length < f.min - 1) pb.push('il faut ' + f.phrases + ' (ici ' + beats.length + ')');
  if (beats.length > f.max + 2) beats.splice(f.max + 2);
  beats.forEach((b, i) => { if (B.mots(b.voix) > 32) pb.push('la phrase ' + (i + 1) + ' est beaucoup trop longue'); });
  if (pb.length) { const e = new CL.ErreurStudio('script', 'script inutilisable : ' + pb.join(', ')); throw e; }
  return {
    titre: propre(x.titre, 100), accroche: propre(x.accroche, 70), beats,
    description: propre(x.description, 400), hashtags: (Array.isArray(x.hashtags) ? x.hashtags : []).map((h) => String(h || '').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).slice(0, 6),
    titre_youtube: propre(x.titre_youtube || x.titre, 90).slice(0, 95), image_generale: propre(x.image_generale, 50) || null
  };
}

async function ecrireScript(db, createur, video, opts) {
  opts = opts || {};
  const r = C.reglagesDe(createur);
  const f = B.FORMATS[r.format] || B.FORMATS.court;
  const avecImages = r.style === 'clips';
  const m = moiDans(createur, 'plume');
  const system = 'Tu es ' + m.prenom + ', la plume de l\'équipe de ' + createur.prenom + ' : tu écris les scripts de ses vidéos courtes, dits par une voix de synthèse sur des images, avec des sous-titres mot à mot.\n\n' +
    contexte(createur) + m.consignes + '\n\n' + [B.SIGNAUX, B.ACCROCHE, B.STRUCTURE, B.RYTHME, B.LANGUE, B.INTERDITS].concat(avecImages ? [B.IMAGES] : []).join('\n\n') +
    '\n\nLE FORMAT : ' + f.phrases + ', ' + f.mots + ', soit ' + f.duree + '.' + (avecImages ? '' : '\nStyle « texte animé » : pas d\'images, le texte à l\'écran porte tout ; garde des phrases très visuelles.');
  const idee = video.idee || {};
  let prompt = 'Écris le script de cette vidéo, en ' + nomLangue(r, video.langue_source || r.langue_source) + '.\n' +
    'SUJET : ' + propre(video.sujet || idee.titre, 600) + (idee.angle ? '\nANGLE : ' + idee.angle : '') + (idee.accroche ? '\nACCROCHE PROPOSÉE (à garder ou améliorer) : ' + idee.accroche : '');
  if (opts.precedent) {
    prompt += '\n\nVOICI LA VERSION PRÉCÉDENTE :\n' + JSON.stringify({ accroche: opts.precedent.accroche, beats: opts.precedent.beats.map((b) => b.voix) }, null, 1);
    if (opts.corrections && opts.corrections.length) prompt += '\n\nLES CORRECTIONS DE ' + C.equipeDe(createur).critique.prenom.toUpperCase() + ' (à appliquer toutes) :\n- ' + opts.corrections.join('\n- ');
    prompt += '\nRéécris en gardant ce qui marche.';
  }
  if (opts.consigne) prompt += '\n\nLA CONSIGNE DE ' + String(createur.prenom).toUpperCase() + ' POUR CETTE VERSION (prioritaire) : ' + propre(opts.consigne, 600);
  prompt += '\n\nAppelle l\'outil ecrire_script. Les faits doivent être vrais ; si tu n\'es pas sûre d\'un chiffre, ne le donne pas.';
  const res = await CL.appeler(db, createur, { usage: 'ecrire', system, prompt, outil: outilScript(avecImages), maxTokens: r.format === 'long' ? 5000 : 3500 });
  return { script: nettoyerScript(res.sortie, avecImages, r.format), cout: res.cout, modele: res.modele };
}

/* ── Jade : la relecture notée ── */
const OUTIL_NOTE = {
  name: 'noter_script',
  description: 'Rend la note du script, critère par critère, et les corrections à faire.',
  input_schema: {
    type: 'object',
    properties: {
      notes: { type: 'object', properties: Object.fromEntries(B.GRILLE.map((g) => [g[0], { type: 'number', description: g[1] + ' (sur 10)' }])), required: B.GRILLE.map((g) => g[0]) },
      points_forts: { type: 'array', items: { type: 'string' }, description: 'Ce qui marche, 1 à 3 points' },
      corrections: { type: 'array', items: { type: 'string' }, description: 'Les corrections précises à faire (phrase visée, quoi changer), 0 à 6, les plus importantes d\'abord' },
      verdict: { type: 'string', description: 'Ton avis en une phrase, pour la créatrice' }
    },
    required: ['notes', 'corrections', 'verdict']
  }
};

async function noterScript(db, createur, video) {
  const r = C.reglagesDe(createur);
  const avecImages = r.style === 'clips';
  const m = moiDans(createur, 'critique');
  const f = B.FORMATS[r.format] || B.FORMATS.court;
  const system = 'Tu es ' + m.prenom + ', la critique de l\'équipe de ' + createur.prenom + ' : tu notes chaque script comme le ferait l\'algorithme et un spectateur pressé, avant qu\'il parte au montage. Exigeante mais juste : 7 = correct, 8 = très bon, 9 = excellent, 10 = rarissime. Tes corrections sont précises et applicables.\n\n' +
    contexte(createur) + m.consignes + '\n\n' + [B.SIGNAUX, B.ACCROCHE, B.STRUCTURE, B.RYTHME, B.INTERDITS].concat(avecImages ? [B.IMAGES] : []).join('\n\n') +
    '\n\nLE FORMAT ATTENDU : ' + f.phrases + ', ' + f.mots + '.\n\nLA GRILLE (chaque critère sur 10) :\n' + B.GRILLE.filter((g) => avecImages || g[0] !== 'images').map((g) => '- ' + g[0] + ' : ' + g[1]).join('\n') + (avecImages ? '' : '\n(style texte animé : mets 10 au critère images)');
  const s = video.script || {};
  const prompt = 'Note ce script (sujet : ' + propre(video.sujet, 300) + ').\n' + JSON.stringify({ accroche: s.accroche, beats: (s.beats || []).map((b) => avecImages ? { voix: b.voix, ecran: b.ecran, image: b.visuel && b.visuel.requete } : { voix: b.voix, ecran: b.ecran }), mots: (s.beats || []).reduce((a, b) => a + B.mots(b.voix), 0) }, null, 1) + '\n\nAppelle l\'outil noter_script.';
  const res = await CL.appeler(db, createur, { usage: 'juger', system, prompt, outil: OUTIL_NOTE, maxTokens: 1800 });
  const x = res.sortie;
  const notes = {};
  B.GRILLE.forEach((g) => { notes[g[0]] = Math.max(0, Math.min(10, Number((x.notes || {})[g[0]]) || 0)); });
  if (!avecImages) notes.images = 10;
  return {
    critique: { notes, note: B.note(notes, avecImages), points_forts: (x.points_forts || []).slice(0, 3).map((t) => propre(t, 200)), corrections: (x.corrections || []).slice(0, 6).map((t) => propre(t, 260)).filter(Boolean), verdict: propre(x.verdict, 260) },
    cout: res.cout, modele: res.modele
  };
}

/* ── Nora : l'adaptation dans une langue ── */
const OUTIL_LANGUE = {
  name: 'adapter_script',
  description: 'Rend la version de la vidéo dans la langue demandée.',
  input_schema: {
    type: 'object',
    properties: {
      titre: { type: 'string' },
      accroche: { type: 'string', description: '7 mots au plus' },
      beats: { type: 'array', items: { type: 'object', properties: { voix: { type: 'string' }, ecran: { type: 'string' } }, required: ['voix', 'ecran'] } },
      description: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' } },
      titre_youtube: { type: 'string' }
    },
    required: ['titre', 'accroche', 'beats', 'description', 'hashtags', 'titre_youtube']
  }
};

async function adapter(db, createur, video, langue) {
  const r = C.reglagesDe(createur);
  const m = moiDans(createur, 'traduction');
  const s = video.script || {};
  const n = (s.beats || []).length;
  const system = 'Tu es ' + m.prenom + ', chargée des langues dans l\'équipe de ' + createur.prenom + '. Tu réécris ses vidéos dans une autre langue comme une créatrice NATIVE de ce pays les écrirait : ses expressions, son humour, ses références, ses hashtags. Jamais une traduction mot à mot.\n\n' +
    contexte(createur) + m.consignes + '\n\n' + B.RYTHME + '\n\n' + B.LANGUE.replace('à la deuxième personne (« tu »)', 'à la deuxième personne du singulier') + '\n\n' + B.INTERDITS;
  const prompt = 'Écris la version en ' + nomLangue(r, langue) + ' de cette vidéo.\n' +
    'Contraintes : exactement ' + n + ' phrases, dans le même ordre, chacune dit la même chose que l\'originale (les images sont déjà choisies pour chaque phrase) ; longueur comparable (plus ou moins 20 %) ; mots forts entre *étoiles* ; texte à l\'écran de 2 à 5 mots ; accroche de 7 mots au plus ; hashtags que les gens de ce pays suivent vraiment.' +
    (langue === 'hi' ? ' Écris en devanagari (pas en lettres latines), sauf les hashtags.' : '') +
    '\n\nL\'ORIGINALE :\n' + JSON.stringify({ titre: s.titre, accroche: s.accroche, beats: (s.beats || []).map((b) => ({ voix: b.voix, ecran: b.ecran })), description: s.description, hashtags: s.hashtags, titre_youtube: s.titre_youtube }, null, 1) + '\n\nAppelle l\'outil adapter_script.';
  const res = await CL.appeler(db, createur, { usage: 'adapter', system, prompt, outil: OUTIL_LANGUE, maxTokens: r.format === 'long' ? 5000 : 3500 });
  const x = res.sortie;
  const beats = (x.beats || []).map((b) => ({ voix: propre(b && b.voix, 300), ecran: propre(b && b.ecran, 48).replace(/\*/g, '') }));
  if (beats.length !== n || beats.some((b) => !b.voix)) throw new CL.ErreurStudio('script', 'la version ' + langue + ' n\'a pas ' + n + ' phrases (' + beats.length + ')');
  return {
    version: { titre: propre(x.titre, 100), accroche: propre(x.accroche, 70), beats, description: propre(x.description, 400), hashtags: (x.hashtags || []).map((h) => String(h || '').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).slice(0, 6), titre_youtube: propre(x.titre_youtube || x.titre, 95) },
    cout: res.cout, modele: res.modele
  };
}

module.exports = { proposerIdees, ecrireScript, noterScript, adapter, nettoyerScript, contexte, nomLangue, OUTIL_IDEES, OUTIL_NOTE, OUTIL_LANGUE, outilScript };
