// Le travail de l'équipe d'une créatrice, avec sa clé Claude : les idées (Maya), le script (Inès), la relecture notée
// (Jade), l'adaptation dans chaque langue (Nora). Les prénoms sont ceux qu'elle a choisis, ses consignes à chacun
// sont lues à chaque fois. Chaque réponse passe par un outil (une forme fixe), puis est vérifiée ici avant d'être gardée.
'use strict';
const B = require('./bible');
const C = require('./index');
const CL = require('./claude');
const { court, nettoie } = require('../util');

const NOMS_LANGUE = {
  fr: 'français', en: 'anglais américain', es: 'espagnol', pt: 'portugais du Brésil', it: 'italien', hi: 'hindi, écrit en devanagari', zh: 'chinois mandarin, en caractères simplifiés', ja: 'japonais (kanji et kana, registre naturel des réseaux)',
  de: 'allemand', nl: 'néerlandais', ar: 'arabe standard moderne, en écriture arabe', ru: 'russe', uk: 'ukrainien', pl: 'polonais', tr: 'turc', ro: 'roumain', el: 'grec', cs: 'tchèque',
  sk: 'slovaque', hu: 'hongrois', sv: 'suédois', da: 'danois', no: 'norvégien (bokmål)', fi: 'finnois', ca: 'catalan', vi: 'vietnamien', fa: 'persan (farsi), en écriture persane', sw: 'swahili'
};
function nomLangue(reglages, l) {
  const v = C.voixDe(reglages, l).voix;
  if (l === 'en' && /^b/.test(v)) return 'anglais britannique';
  if (l === 'es' && /es_AR/.test(v)) return 'espagnol d\'Argentine';
  if (l === 'es' && /es_MX/.test(v)) return 'espagnol du Mexique';
  if (l === 'pt' && /pt_PT/.test(v)) return 'portugais du Portugal';
  return NOMS_LANGUE[l] || l;
}
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
  // ce que l'équipe a retenu d'elle au fil des conversations (ses goûts, ses habitudes, ce qu'elle a corrigé)
  if ((r.memoire || []).length) lignes.push('CE QUE L\'ÉQUIPE A RETENU D\'ELLE (à respecter) :\n- ' + r.memoire.slice(0, 30).join('\n- '));
  return lignes.join('\n');
}
// ses personnages choisis pour une vidéo (et qui existent encore)
function personnagesDe(createur, ids) {
  const r = C.reglagesDe(createur);
  return (Array.isArray(ids) ? ids : []).map((id) => r.personnages.find((p) => p.id === id)).filter(Boolean);
}
const nomEn = (p) => p.nom_en || p.nom;
function lignesPersos(persos) {
  return persos.map((p) => '- ' + nomEn(p) + ' (« ' + p.nom + ' », ' + (C.GENRES_PERSO[p.genre] || 'personnage').toLowerCase() + ') : ' + (p.description_en || p.description || 'voir son image de référence')).join('\n');
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
// le look d'une vidéo : clips (vidéos d'illustration), ia (images créées par IA) ou texte (texte animé) ; les anciens
// appels passaient « avec images » (oui : clips, non : texte)
const lookDe = (x) => (x === true ? 'clips' : x === false ? 'texte' : Object.prototype.hasOwnProperty.call(C.STYLES, x) ? x : 'clips');
const requeteImage = (q) => propre(q, 60).replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
// la scène pour l'IA : en anglais, sans balises ni guillemets doubles (elle part telle quelle chez fal)
const scene = (s, n) => propre(s, n).replace(/["`]/g, '\'');

function outilScript(mode) {
  const look = lookDe(mode);
  const beat = { voix: { type: 'string', description: 'La phrase dite, 6 à 18 mots, les mots forts entre *étoiles*' }, ecran: { type: 'string', description: 'Le texte court à l\'écran pendant cette phrase, 2 à 5 mots' } };
  const req = ['voix', 'ecran'];
  const proprietes = {};
  if (look === 'clips') {
    beat.visuel = { type: 'object', properties: { requete: { type: 'string', description: 'Recherche de vidéo libre de droits EN ANGLAIS, 2 à 4 mots concrets et filmables : le sujet même de la phrase' }, requete2: { type: 'string', description: 'Une seconde recherche EN ANGLAIS qui montre la même chose autrement (autre cadrage, autre décor, synonyme)' }, description: { type: 'string', description: 'Ce qu\'on voit, en français, une courte phrase' } }, required: ['requete', 'requete2', 'description'] };
    req.push('visuel');
  }
  if (look === 'ia') {
    beat.visuel = {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'La scène pour l\'IA, EN ANGLAIS, 25 à 60 mots : qui, quoi, où, l\'action, le cadrage, la lumière ; jamais de texte dans l\'image' },
        mouvement: { type: 'string', description: 'EN ANGLAIS, 4 à 12 mots : ce qui bouge et comment bouge la caméra' },
        requete: { type: 'string', description: 'Secours : une recherche de vidéo libre de droits EN ANGLAIS, 2 à 4 mots concrets et filmables' },
        description: { type: 'string', description: 'Ce qu\'on voit, en français, une courte phrase' }
      },
      required: ['prompt', 'mouvement', 'requete', 'description']
    };
    req.push('visuel');
    proprietes.direction = { type: 'string', description: 'EN ANGLAIS, 20 à 50 mots : l\'univers commun à toutes les images (le sujet qui revient décrit précisément, le décor, la lumière, la palette)' };
  }
  return {
    name: 'ecrire_script',
    description: 'Rend le script complet de la vidéo.',
    input_schema: {
      type: 'object',
      properties: Object.assign({
        titre: { type: 'string', description: 'Le titre de la vidéo (40 à 90 signes), qui donne envie sans tout dire' },
        accroche: { type: 'string', description: 'Le texte à l\'écran des 2 premières secondes, 7 mots au plus' },
        beats: { type: 'array', items: { type: 'object', properties: beat, required: req } },
        description: { type: 'string', description: 'Le texte de la publication : une ou deux phrases, puis une question qui donne envie de commenter (300 signes au plus)' },
        hashtags: { type: 'array', items: { type: 'string' }, description: '3 à 6 hashtags pertinents, sans le signe #' },
        titre_youtube: { type: 'string', description: 'Le titre YouTube Shorts, 70 signes au plus' },
        image_generale: { type: 'string', description: 'Une recherche EN ANGLAIS de 2 ou 3 mots qui illustre le sujet en général (secours si une image manque)' }
      }, proprietes),
      required: ['titre', 'accroche', 'beats', 'description', 'hashtags', 'titre_youtube'].concat(look === 'ia' ? ['direction'] : [])
    }
  };
}

function nettoyerScript(x, mode, format) {
  const look = lookDe(mode);
  const f = B.FORMATS[format] || B.FORMATS.court;
  const beats = (Array.isArray(x.beats) ? x.beats : []).map((b) => {
    const voix = propre(b && b.voix, 260);
    if (!voix) return null;
    const out = { voix, ecran: propre(b.ecran, 48).replace(/\*/g, '') };
    const vis = b.visuel && typeof b.visuel === 'object' ? b.visuel : null;
    if (look === 'clips' && vis) out.visuel = { requete: requeteImage(vis.requete), requete2: requeteImage(vis.requete2) || null, description: propre(vis.description, 160) };
    if (look === 'ia' && vis) out.visuel = { prompt: scene(vis.prompt, 600), mouvement: scene(vis.mouvement, 160), requete: requeteImage(vis.requete), description: propre(vis.description, 160) };
    return out;
  }).filter(Boolean);
  const pb = [];
  if (beats.length < f.min - 1) pb.push('il faut ' + f.phrases + ' (ici ' + beats.length + ')');
  if (beats.length > f.max + 2) beats.splice(f.max + 2);
  beats.forEach((b, i) => { if (B.mots(b.voix) > 32) pb.push('la phrase ' + (i + 1) + ' est beaucoup trop longue'); });
  if (pb.length) { const e = new CL.ErreurStudio('script', 'script inutilisable : ' + pb.join(', ')); throw e; }
  const out = {
    titre: propre(x.titre, 100), accroche: propre(x.accroche, 70), beats,
    description: propre(x.description, 400), hashtags: (Array.isArray(x.hashtags) ? x.hashtags : []).map((h) => String(h || '').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).slice(0, 6),
    titre_youtube: propre(x.titre_youtube || x.titre, 90).slice(0, 95), image_generale: propre(x.image_generale, 50) || null
  };
  if (look === 'ia') out.direction = scene(x.direction, 400) || null;
  return out;
}

async function ecrireScript(db, createur, video, opts) {
  opts = opts || {};
  const r = C.reglagesDe(createur);
  const f = B.FORMATS[r.format] || B.FORMATS.court;
  const look = lookDe(r.style);
  const m = moiDans(createur, 'plume');
  const lookIa = look === 'ia' ? (C.STYLES_IA[(r.ia || {}).style] || C.STYLES_IA.realiste) : null;
  const system = 'Tu es ' + m.prenom + ', la plume de l\'équipe de ' + createur.prenom + ' : tu écris les scripts de ses vidéos courtes, dits par une voix de synthèse sur des images, avec des sous-titres mot à mot.\n\n' +
    contexte(createur) + m.consignes + '\n\n' + [B.SIGNAUX, B.ACCROCHE, B.STRUCTURE, B.RYTHME, B.LANGUE, B.INTERDITS].concat(look === 'clips' ? [B.IMAGES] : look === 'ia' ? [B.IMAGES_IA] : []).join('\n\n') +
    '\n\nLE FORMAT : ' + f.phrases + ', ' + f.mots + ', soit ' + f.duree + '.' +
    (look === 'texte' ? '\nStyle « texte animé » : pas d\'images, le texte à l\'écran porte tout ; garde des phrases très visuelles.' : '') +
    (lookIa ? '\nLE LOOK DES IMAGES CHOISI PAR ' + String(createur.prenom).toUpperCase() + ' : « ' + lookIa.nom + ' » (' + lookIa.court.toLowerCase() + '). Imagine des scènes qui vont bien dans ce look.' : '');
  const idee = video.idee || {};
  let prompt = 'Écris le script de cette vidéo, en ' + nomLangue(r, video.langue_source || r.langue_source) + '.\n' +
    'SUJET : ' + propre(video.sujet || idee.titre, 600) + (idee.angle ? '\nANGLE : ' + idee.angle : '') + (idee.accroche ? '\nACCROCHE PROPOSÉE (à garder ou améliorer) : ' + idee.accroche : '');
  const modele = B.MODELES[(video.plan || {}).modele];
  if (modele) prompt += '\nLE MODÈLE CHOISI PAR ' + String(createur.prenom).toUpperCase() + ' : « ' + modele.nom + ' ». ' + modele.structure + ' (Le modèle donne la forme ; les règles d\'accroche, de rythme et de langue restent.)';
  // ce qu'elle a répondu aux questions de l'équipe avant d'écrire
  if ((idee.brief || []).length) prompt += '\n\nSES RÉPONSES À TES QUESTIONS (à suivre) :\n' + idee.brief.map((x) => '- ' + x.q + ' → ' + x.r).join('\n');
  // ses personnages : ils jouent dans les scènes (images IA), appelés par leur nom anglais ; leur image de référence part
  // avec chaque image, la scène n'a pas à redécrire leur apparence
  const persos = look === 'ia' ? personnagesDe(createur, (video.plan || {}).personnages) : [];
  if (persos.length) prompt += '\n\nSES PERSONNAGES DANS CETTE VIDÉO (ils apparaissent dans les scènes où ils ont leur place, au moins dans l\'accroche ; dans chaque « prompt », appelle-les par leur nom anglais tel quel, sans redécrire leur apparence : leur photo de référence est donnée à l\'IA ; dans « direction », dis qui ils sont) :\n' + lignesPersos(persos);
  if (opts.precedent) {
    prompt += '\n\nVOICI LA VERSION PRÉCÉDENTE :\n' + JSON.stringify({ accroche: opts.precedent.accroche, beats: opts.precedent.beats.map((b) => b.voix) }, null, 1);
    if (opts.corrections && opts.corrections.length) prompt += '\n\nLES CORRECTIONS DE ' + C.equipeDe(createur).critique.prenom.toUpperCase() + ' (à appliquer toutes) :\n- ' + opts.corrections.join('\n- ');
    prompt += '\nRéécris en gardant ce qui marche.';
  }
  if (opts.consigne) prompt += '\n\nLA CONSIGNE DE ' + String(createur.prenom).toUpperCase() + ' POUR CETTE VERSION (prioritaire) : ' + propre(opts.consigne, 600);
  prompt += '\n\nAppelle l\'outil ecrire_script. Les faits doivent être vrais ; si tu n\'es pas sûre d\'un chiffre, ne le donne pas.';
  // les scènes pour l'IA prennent de la place : plus de jetons pour ce look
  const maxTokens = (r.format === 'long' ? 5000 : 3500) + (look === 'ia' ? (r.format === 'long' ? 3000 : 2000) : 0);
  const res = await CL.appeler(db, createur, { usage: 'ecrire', system, prompt, outil: outilScript(look), maxTokens });
  return { script: nettoyerScript(res.sortie, look, r.format), cout: res.cout, modele: res.modele };
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
  const look = lookDe(r.style);
  const avecImages = look !== 'texte';
  const m = moiDans(createur, 'critique');
  const f = B.FORMATS[r.format] || B.FORMATS.court;
  const critere = (g) => '- ' + g[0] + ' : ' + (g[0] === 'images' && look === 'ia' ? B.CRITERE_IA : g[1]);
  const system = 'Tu es ' + m.prenom + ', la critique de l\'équipe de ' + createur.prenom + ' : tu notes chaque script comme le ferait l\'algorithme et un spectateur pressé, avant qu\'il parte au montage. Exigeante mais juste : 7 = correct, 8 = très bon, 9 = excellent, 10 = rarissime. Tes corrections sont précises et applicables.\n\n' +
    contexte(createur) + m.consignes + '\n\n' + [B.SIGNAUX, B.ACCROCHE, B.STRUCTURE, B.RYTHME, B.INTERDITS].concat(look === 'clips' ? [B.IMAGES] : look === 'ia' ? [B.IMAGES_IA] : []).join('\n\n') +
    '\n\nLE FORMAT ATTENDU : ' + f.phrases + ', ' + f.mots + '.\n\nLA GRILLE (chaque critère sur 10) :\n' + B.GRILLE.filter((g) => avecImages || g[0] !== 'images').map(critere).join('\n') + (avecImages ? '' : '\n(style texte animé : mets 10 au critère images)');
  const s = video.script || {};
  const image = (b) => (b.visuel ? (look === 'ia' ? b.visuel.prompt : b.visuel.requete) : undefined);
  const prompt = 'Note ce script (sujet : ' + propre(video.sujet, 300) + ').\n' + JSON.stringify(Object.assign({ accroche: s.accroche }, look === 'ia' && s.direction ? { univers_des_images: s.direction } : {}, { beats: (s.beats || []).map((b) => avecImages ? { voix: b.voix, ecran: b.ecran, image: image(b) } : { voix: b.voix, ecran: b.ecran }), mots: (s.beats || []).reduce((a, b) => a + B.mots(b.voix), 0) }), null, 1) + '\n\nAppelle l\'outil noter_script.';
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
    (langue === 'zh' ? ' Écris en caractères simplifiés ; des phrases courtes ; le texte à l\'écran de 2 à 8 caractères.' : '') +
    (langue === 'ja' ? ' Écris en japonais naturel (kanji et kana, jamais en romaji) ; des phrases courtes ; le texte à l\'écran de 2 à 10 caractères.' : '') +
    (['ar', 'fa'].indexOf(langue) >= 0 ? ' Écris dans l\'écriture de la langue (pas en lettres latines), sans voyelles ajoutées.' : '') +
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

/* ── Lou : le découpage d'un clip (un prompt de réalisateur) ── */
// Elle colle son prompt (des personnages, un style, des plans minutés) : Lou en fait un plan de tournage que les modèles
// exécutent. Un modèle d'images crée l'image de référence de chaque élément qui revient, puis la première image de
// chaque plan à partir de ces références ; un modèle vidéo l'anime pendant la durée du plan ; le montage coupe sur le
// rythme. Fidèle à son prompt : mêmes plans, même ordre, mêmes durées, même univers.
const IDS_ELEMENTS = ['A', 'B', 'C', 'D'];
const EFFETS_CLIP = ['aucun', 'zoom', 'secousse', 'flash'];
const OUTIL_CLIP = {
  name: 'decouper_clip',
  description: 'Rend le plan de tournage du clip : les éléments qui reviennent, le style commun, chaque plan.',
  input_schema: {
    type: 'object',
    properties: {
      titre: { type: 'string', description: 'Le titre du clip pour la créatrice, en français, 60 signes au plus' },
      style: { type: 'string', description: 'EN ANGLAIS, 25 à 90 mots : le rendu commun à tous les plans, repris de son prompt (réaliste ou dessiné, caméra, objectif, lumière, étalonnage, grain)' },
      coherence: { type: 'string', description: 'EN ANGLAIS, une phrase : ce qui doit rester vrai dans chaque plan (par exemple : the knights\' faces are never visible), ou une chaîne vide' },
      elements: {
        type: 'array', maxItems: 4,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: IDS_ELEMENTS },
            nom: { type: 'string', description: 'Son nom pour la créatrice, en français, 3 à 30 signes' },
            nom_en: { type: 'string', description: 'EN ANGLAIS, 2 à 5 mots, le nom qui le désigne dans les plans (Knight A, the black supercar)' },
            type: { type: 'string', enum: ['personnage', 'objet', 'lieu'] },
            description: { type: 'string', description: 'EN ANGLAIS, 30 à 90 mots : son apparence complète, chaque détail qui le rend reconnaissable (couleurs, matières, accessoires, carrure), sans action ni décor' }
          },
          required: ['id', 'nom', 'nom_en', 'type', 'description']
        }
      },
      plans: {
        type: 'array', minItems: 1, maxItems: 16,
        items: {
          type: 'object',
          properties: {
            duree: { type: 'number', description: 'La durée du plan à l\'écran, en secondes (1 à 10) : celle de son prompt si elle est donnée' },
            image: { type: 'string', description: 'EN ANGLAIS, 30 à 90 mots : la toute première image du plan, comme une photo : cadrage et angle, les éléments présents appelés par leur nom_en et où ils sont, le décor, la lumière' },
            mouvement: { type: 'string', description: 'EN ANGLAIS, 15 à 60 mots : ce qui se passe pendant le plan et comment bouge la caméra (travelling, ralenti, drone, zoom)' },
            son: { type: 'string', description: 'EN ANGLAIS, les bruitages de ce plan (engine roar, champagne cork pop), ou une chaîne vide ; jamais de musique ni de voix' },
            elements: { type: 'array', items: { type: 'string', enum: IDS_ELEMENTS }, description: 'Les éléments visibles dans ce plan' },
            effet: { type: 'string', enum: EFFETS_CLIP, description: 'L\'effet de montage sur le moment fort : secousse pour un choc, une explosion, un moteur qui hurle ; flash pour une révélation ; zoom pour un geste qui claque ; aucun sinon' },
            accent: { type: 'number', description: 'Le moment fort du plan en secondes depuis son début (le bouchon qui saute, les billets qui claquent), ou -1' },
            resume: { type: 'string', description: 'Ce qu\'on voit, en français, 70 signes au plus' }
          },
          required: ['duree', 'image', 'mouvement', 'son', 'elements', 'effet', 'accent', 'resume']
        }
      },
      musique: { type: 'string', description: 'EN ANGLAIS, 15 à 60 mots : la musique instrumentale qui irait avec (genre, tempo en BPM, ambiance, instruments, énergie), sans voix' },
      fin_noir: { type: 'boolean', description: 'Vrai si son prompt finit sur un noir (cut to black, fondu au noir)' },
      description: { type: 'string', description: 'Le texte de la publication, 200 signes au plus, avec une question qui fait commenter' },
      hashtags: { type: 'array', items: { type: 'string' }, description: '3 à 6 hashtags sans le signe #' },
      titre_youtube: { type: 'string', description: 'Le titre YouTube, 70 signes au plus' }
    },
    required: ['titre', 'style', 'elements', 'plans', 'musique', 'fin_noir', 'description', 'hashtags', 'titre_youtube']
  }
};

// le plan de tournage, vérifié : 16 plans et 60 secondes au plus, 1 à 10 secondes par plan, 4 éléments au plus (les
// plans ne citent que des éléments qui existent), les textes pour l'IA sans guillemets doubles
const PLANS_MAX = 16, DUREE_CLIP_MAX = 60;
function nettoyerStoryboard(x) {
  x = x && typeof x === 'object' ? x : {};
  const vus = new Set();
  const elements = (Array.isArray(x.elements) ? x.elements : []).map((e, i) => {
    if (!e || typeof e !== 'object') return null;
    let id = IDS_ELEMENTS.indexOf(String(e.id)) >= 0 ? String(e.id) : IDS_ELEMENTS[i];
    if (!id || vus.has(id)) id = IDS_ELEMENTS.find((k) => !vus.has(k));
    const description = scene(e.description, 700);
    if (!id || !description) return null;
    vus.add(id);
    return { id, nom: propre(e.nom, 40) || 'Élément ' + id, nom_en: scene(e.nom_en, 60) || 'element ' + id, type: ['personnage', 'objet', 'lieu'].indexOf(e.type) >= 0 ? e.type : 'personnage', description };
  }).filter(Boolean).slice(0, 4);
  const ids = elements.map((e) => e.id);
  let plans = (Array.isArray(x.plans) ? x.plans : []).map((p) => {
    if (!p || typeof p !== 'object') return null;
    const image = scene(p.image, 900);
    if (!image) return null;
    const duree = Math.round(Math.min(10, Math.max(1, Number(p.duree) || 3)) * 10) / 10;
    const accent = Number(p.accent);
    return {
      duree, image, mouvement: scene(p.mouvement, 500) || 'subtle natural motion, slow cinematic push-in', son: scene(p.son, 240),
      elements: (Array.isArray(p.elements) ? p.elements : []).map(String).filter((k, j, t) => ids.indexOf(k) >= 0 && t.indexOf(k) === j),
      effet: EFFETS_CLIP.indexOf(p.effet) >= 0 ? p.effet : 'aucun', accent: Number.isFinite(accent) && accent >= 0 && accent <= duree ? Math.round(accent * 10) / 10 : -1,
      resume: propre(p.resume, 90) || propre(p.image, 90)
    };
  }).filter(Boolean).slice(0, PLANS_MAX);
  if (!plans.length) throw new CL.ErreurStudio('script', 'découpage inutilisable : aucun plan');
  // plus de 60 secondes : chaque plan raccourcit d'autant (1 seconde au moins)
  const total = plans.reduce((a, p) => a + p.duree, 0);
  if (total > DUREE_CLIP_MAX) {
    const k = DUREE_CLIP_MAX / total;
    plans = plans.map((p) => Object.assign({}, p, { duree: Math.max(1, Math.floor(p.duree * k * 10) / 10), accent: p.accent >= 0 ? Math.round(Math.min(p.accent * k, p.duree * k) * 10) / 10 : -1 }));
  }
  return {
    titre: propre(x.titre, 80) || 'Clip', style: scene(x.style, 700), coherence: scene(x.coherence, 300), elements, plans,
    musique: scene(x.musique, 500), fin_noir: !!x.fin_noir,
    description: propre(x.description, 400), hashtags: (Array.isArray(x.hashtags) ? x.hashtags : []).map((h) => String(h || '').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).slice(0, 6),
    titre_youtube: propre(x.titre_youtube || x.titre, 95)
  };
}

const FORMATS_TEXTE = { '9:16': 'vertical 9:16 (TikTok, Shorts, Reels)', '16:9': 'horizontal 16:9 (YouTube)', '1:1': 'carré 1:1' };
async function decouperClip(db, createur, video, opts) {
  opts = opts || {};
  const r = C.reglagesDe(createur);
  const clip = (video.plan || {}).clip || {};
  const m = moiDans(createur, 'realisation');
  const system = 'Tu es ' + m.prenom + ', la réalisatrice de l\'équipe de ' + createur.prenom + '. Elle te donne son prompt de réalisateur pour un clip fait par IA. Tu en fais un plan de tournage que des modèles d\'IA vont exécuter : un modèle d\'images crée d\'abord une image de référence pour chaque élément qui revient (personnage, objet, lieu), puis la première image de chaque plan à partir de ces références ; un modèle vidéo anime ensuite chaque image pendant la durée du plan ; le montage coupe sur le rythme de la musique, avec des zooms et des secousses sur les moments forts.' + m.consignes + '\n\n' +
    'TES RÈGLES\n' +
    '- Fidélité : garde ses plans, leur ordre, leurs durées, ses personnages, son style, ses sons. N\'ajoute aucun plan, n\'en retire aucun, n\'adoucis pas son univers.\n' +
    '- Si elle ne découpe pas elle-même : invente un découpage en plans courts (1,5 à 3,5 secondes), une image forte dès le premier plan, la durée totale visée.\n' +
    '- Les éléments : seulement ce qui revient dans plusieurs plans ou doit rester identique (4 au plus). Décris chacun en entier : le modèle ne voit que ta description et son image de référence.\n' +
    '- Chaque plan se comprend seul : jamais « the same », « again », « as before » ; les éléments sont appelés par leur nom_en.\n' +
    '- « image » est une photo fixe, l\'instant zéro du plan ; « mouvement » dit ce qui bouge ensuite et comment bouge la caméra.\n' +
    '- Les sons de son prompt vont dans « son », plan par plan. La musique s\'ajoute au montage : jamais dans « son ».\n' +
    '- Aucun texte, sous-titre ni logo dans les images, sauf si elle le demande.\n' +
    '- Une personne réelle et connue : jamais son nom ni son visage, un personnage inventé à la place. Jamais d\'enfant dans une scène d\'adulte.\n' +
    '- 1 à 10 secondes par plan, 16 plans et 60 secondes au plus en tout.';
  const duree = clip.duree && clip.duree !== 'auto' ? Number(clip.duree) : null;
  const persos = personnagesDe(createur, clip.personnages);
  const lesPersos = persos.length ? '\n\nSES PERSONNAGES (ils ont chacun leur photo de référence) : garde-les comme éléments, avec ces identifiants, ces noms anglais et ces descriptions exactes (complète seulement ce qui manque), et fais-les jouer là où son prompt les met :\n' +
    persos.map((p, i) => '- ' + IDS_ELEMENTS[i] + ' = ' + nomEn(p) + ' (« ' + p.nom + ' », ' + (p.genre === 'objet' ? 'objet' : p.genre === 'lieu' ? 'lieu' : 'personnage') + ') : ' + (p.description_en || p.description || 'voir sa photo')).join('\n') : '';
  let prompt = 'SON PROMPT :\n<<<\n' + String(clip.prompt || video.sujet || '').replace(/<<<|>>>/g, '') + '\n>>>' + lesPersos + '\n\n' +
    'Format : ' + (FORMATS_TEXTE[clip.format] || FORMATS_TEXTE['9:16']) + '. Durée visée : ' + (duree ? duree + ' secondes' : 'celle de son prompt (30 secondes s\'il n\'en dit rien)') + '.' +
    ((clip.musique || {}).source === 'ia' ? '\nElle veut une musique créée pour le clip' + ((clip.musique || {}).idee ? ' : « ' + propre(clip.musique.idee, 300) + ' »' : '') + '. Écris son prompt dans « musique ».' : '') +
    '\nLe titre, le texte de la publication et les hashtags sont en ' + nomLangue(r, video.langue_source || r.langue_source) + '.';
  if (opts.precedent) prompt += '\n\nTON DÉCOUPAGE PRÉCÉDENT :\n' + JSON.stringify({ elements: opts.precedent.elements, plans: (opts.precedent.plans || []).map((p) => ({ duree: p.duree, image: p.image, mouvement: p.mouvement })) }, null, 1);
  if (opts.consigne) prompt += '\n\nSA CONSIGNE POUR CETTE VERSION (prioritaire) : ' + propre(opts.consigne, 600);
  prompt += '\n\nAppelle l\'outil decouper_clip.';
  const res = await CL.appeler(db, createur, { usage: 'ecrire', system, prompt, outil: OUTIL_CLIP, maxTokens: 9000 });
  return { storyboard: nettoyerStoryboard(res.sortie), cout: res.cout, modele: res.modele };
}

/* ── Inès : ses questions avant d'écrire ── */
// Une idée lancée à la main : avant d'écrire, la plume pose deux ou trois questions courtes (l'angle, le ton, ce qu'il
// faut montrer ou éviter, l'appel à l'action), chacune avec des réponses toutes prêtes. Le petit modèle, moins d'un
// centime ; aucune question si l'idée dit déjà tout.
const OUTIL_QUESTIONS = {
  name: 'poser_questions',
  description: 'Rend les questions à poser à la créatrice avant d\'écrire le script (ou aucune si tout est clair).',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array', maxItems: 3,
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'La question, courte, au tutoiement (90 signes au plus)' },
            choix: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' }, description: '2 à 4 réponses toutes prêtes, courtes (40 signes au plus chacune), vraiment différentes' }
          },
          required: ['question', 'choix']
        }
      }
    },
    required: ['questions']
  }
};
async function poserQuestions(db, createur, o) {
  o = o || {};
  const r = C.reglagesDe(createur);
  const m = moiDans(createur, 'plume');
  const modele = B.MODELES[o.modele];
  const system = 'Tu es ' + m.prenom + ', la plume de l\'équipe de ' + createur.prenom + '. Avant d\'écrire un script, tu lui poses au plus trois questions courtes, seulement celles dont la réponse change vraiment le script et que sa chaîne ne dit pas déjà : l\'angle (ce qui la surprend, elle), le ton pour cette vidéo, une anecdote ou un exemple à elle, ce qu\'il faut montrer ou éviter, la fin (une question au public, une chute). Chaque question vient avec 2 à 4 réponses toutes prêtes qu\'elle n\'a qu\'à toucher. Si l\'idée et sa chaîne disent déjà tout, ne pose aucune question.\n\n' + contexte(createur) + m.consignes;
  const prompt = 'Son idée : « ' + propre(o.sujet, 600) + ' »' + (modele ? '\nLa forme choisie : « ' + modele.nom + ' » (' + modele.court + ').' : '') + '\nDurée : ' + (o.format === 'long' ? 'plus d\'une minute' : '35 à 50 secondes') + '. Langue : ' + nomLangue(r, r.langue_source) + '.\n\nAppelle l\'outil poser_questions.';
  const res = await CL.appeler(db, createur, { usage: 'juger', system, prompt, outil: OUTIL_QUESTIONS, maxTokens: 700 });
  const questions = (res.sortie.questions || []).map((x) => x && { question: propre(x.question, 120), choix: (Array.isArray(x.choix) ? x.choix : []).map((c) => propre(c, 60)).filter(Boolean).slice(0, 4) }).filter((x) => x && x.question && x.choix.length >= 2).slice(0, 3);
  return { questions, cout: res.cout };
}

/* ── le portrait d'un personnage (pour le redessiner à l'identique) ── */
const OUTIL_PORTRAIT = {
  name: 'decrire_personnage',
  description: 'Rend la description visuelle du personnage, pour qu\'une IA d\'images le redessine à l\'identique.',
  input_schema: {
    type: 'object',
    properties: {
      nom_en: { type: 'string', description: 'EN ANGLAIS, 2 à 5 mots, le nom qui le désignera dans les scènes (« Lila the red fox », « the girl in the yellow raincoat »)' },
      description_en: { type: 'string', description: 'EN ANGLAIS, 40 à 110 mots : seulement son apparence (âge apparent, allure, peau, cheveux, yeux, visage, vêtements, couleurs, matières, accessoires ; le style si c\'est un dessin, une 3D, une peluche), sans décor ni action' }
    },
    required: ['nom_en', 'description_en']
  }
};
async function decrirePersonnage(db, createur, perso, urls) {
  const m = moiDans(createur, 'realisation');
  const system = 'Tu es ' + m.prenom + ', la réalisatrice de l\'équipe de ' + createur.prenom + '. Tu décris ses personnages (une personne, une mascotte, un animal, un objet, un lieu) pour qu\'une IA d\'images les redessine à l\'identique d\'une scène à l\'autre. Décris seulement ce qui se voit, précisément ; jamais le nom d\'une personne réelle, jamais une identité, jamais un jugement sur le physique.';
  const prompt = 'Son personnage : « ' + propre(perso.nom, 60) + ' » (' + (C.GENRES_PERSO[perso.genre] || 'personnage').toLowerCase() + ')' + (perso.description ? '. Ce qu\'elle en dit : « ' + propre(perso.description, 600) + ' »' : '') + '.' + (urls.length ? '\nSes photos sont jointes : décris ce qu\'elles montrent (ce qu\'elle en dit passe avant).' : '\nPas de photo : invente une apparence précise et cohérente à partir de ce qu\'elle en dit.') + '\n\nAppelle l\'outil decrire_personnage.';
  const res = await CL.appeler(db, createur, { usage: 'juger', system, prompt, outil: OUTIL_PORTRAIT, maxTokens: 600, images: urls.slice(0, 4) });
  return { nom_en: scene(res.sortie.nom_en, 60), description_en: scene(res.sortie.description_en, 800), cout: res.cout };
}

/* ── Nora : le texte d'un clip dans d'autres langues ── */
// un clip n'a ni voix ni sous-titres : la même vidéo sert dans toutes les langues, seul son texte de publication change
const OUTIL_TEXTES = {
  name: 'adapter_textes',
  description: 'Rend le texte de publication du clip dans chaque langue demandée.',
  input_schema: {
    type: 'object',
    properties: {
      versions: {
        type: 'array',
        items: { type: 'object', properties: { langue: { type: 'string' }, titre: { type: 'string' }, description: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } }, titre_youtube: { type: 'string' } }, required: ['langue', 'titre', 'description', 'hashtags', 'titre_youtube'] }
      }
    },
    required: ['versions']
  }
};
const tags = (l) => (Array.isArray(l) ? l : []).map((h) => String(h || '').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).slice(0, 6);
async function adapterTextes(db, createur, video, langues) {
  const r = C.reglagesDe(createur);
  const m = moiDans(createur, 'traduction');
  const s = video.script || {};
  const system = 'Tu es ' + m.prenom + ', chargée des langues dans l\'équipe de ' + createur.prenom + '. Tu réécris le texte de publication de ses clips comme une créatrice NATIVE de chaque pays : ses expressions, ses hashtags que les gens suivent vraiment, jamais mot à mot.\n\n' + contexte(createur) + m.consignes;
  const prompt = 'Le texte du clip :\n' + JSON.stringify({ titre: s.titre || video.titre, description: s.description, hashtags: s.hashtags, titre_youtube: s.titre_youtube }, null, 1) +
    '\n\nÉcris-le dans ces langues : ' + langues.map((l) => l + ' (' + nomLangue(r, l) + ')').join(', ') + '. Titre de 90 signes au plus, titre YouTube de 70 au plus, texte de 300 au plus avec une question qui fait commenter, 3 à 6 hashtags sans le signe #.\n\nAppelle l\'outil adapter_textes.';
  const res = await CL.appeler(db, createur, { usage: 'adapter', system, prompt, outil: OUTIL_TEXTES, maxTokens: 600 + 350 * langues.length });
  const versions = {};
  (res.sortie.versions || []).forEach((x) => {
    if (!x || langues.indexOf(String(x.langue)) < 0) return;
    versions[x.langue] = { titre: propre(x.titre, 100), description: propre(x.description, 400), hashtags: tags(x.hashtags), titre_youtube: propre(x.titre_youtube || x.titre, 95) };
  });
  const manque = langues.filter((l) => !versions[l]);
  if (manque.length) throw new CL.ErreurStudio('script', 'le texte n\'a pas été écrit pour : ' + manque.join(', '));
  return { versions, cout: res.cout };
}

module.exports = {
  proposerIdees, ecrireScript, noterScript, adapter, nettoyerScript, contexte, nomLangue, lookDe, OUTIL_IDEES, OUTIL_NOTE, OUTIL_LANGUE, outilScript, decouperClip, nettoyerStoryboard, OUTIL_CLIP,
  poserQuestions, decrirePersonnage, adapterTextes, personnagesDe, OUTIL_QUESTIONS, OUTIL_PORTRAIT, OUTIL_TEXTES, IDS_ELEMENTS
};
