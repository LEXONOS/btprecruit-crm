// Lou choisit les vidéos d'illustration : pour chaque phrase du script, une vidéo libre de droits de Pexels (gratuite,
// usage commercial permis, la clé de Louis HQ_PEXELS_KEY), filmée en vertical de préférence, assez longue pour la
// phrase, jamais deux fois la même dans une vidéo.
// Depuis le 16 novembre 2026 (choisirAvecLou) : la première vidéo trouvée ne suffit plus (la vidéo d'Emma sur la
// digestion montrait une route, une station-service, un poteau électrique). Lou réunit plusieurs vidéos par phrase
// (les deux recherches de la plume), lit ce que chacune montre (les mots de sa page Pexels) et fait choisir Claude
// (le petit modèle, sur la clé de la créatrice, moins d'un centime) celle qui montre vraiment ce que dit la phrase.
// Quand aucune ne va : une image créée pour la phrase sur sa clé fal si elle l'a branchée (1,6 centime), sinon le fond
// animé, jamais une vidéo hors sujet.
// choisir (sans Claude, la première qui va) reste pour les trous des vidéos en images IA.
'use strict';
const { court } = require('../util');
const C = require('./index');
const CL = require('./claude');
const FAL = require('./fal');

let FORCE = null;
function forcer(f) { FORCE = f; }
function cle() { return String(process.env.HQ_PEXELS_KEY || '').trim(); }
function branche() { return !!cle(); }

async function chercher(requete, orientation) {
  const u = 'https://api.pexels.com/videos/search?query=' + encodeURIComponent(requete) + '&orientation=' + (orientation || 'portrait') + '&size=medium&per_page=12&locale=en-US';
  const r = await (FORCE || fetch)(u, { headers: { Authorization: cle(), Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (r.status === 401 || r.status === 403) { const e = new Error('clé Pexels refusée'); e.definitif = true; throw e; }
  if (r.status === 429) { const e = new Error('quota Pexels atteint pour l\'heure'); e.quota = true; throw e; }
  if (!r.ok) throw new Error('Pexels répond ' + r.status);
  const j = await r.json();
  return Array.isArray(j.videos) ? j.videos : [];
}

// le meilleur fichier d'une vidéo : vertical, proche de 1080 x 1920, jamais énorme
function fichier(v) {
  const f = (v.video_files || []).filter((x) => x && x.link && /^https:\/\//.test(x.link) && (x.file_type || 'video/mp4') === 'video/mp4' && x.width && x.height);
  if (!f.length) return null;
  const score = (x) => {
    const portrait = x.height >= x.width;
    const h = Math.max(x.width, x.height);
    return (portrait ? 0 : 400) + Math.abs(h - 1920) / 4 + (h > 2600 ? 600 : 0) + (h < 900 ? 300 : 0);
  };
  return f.sort((a, b) => score(a) - score(b))[0];
}
function hoteAccepte(url) { try { return /^(videos\.pexels\.com|player\.vimeo\.com)$/.test(new URL(url).hostname); } catch (e) { return false; } }

// la durée d'une phrase dite, à peu près (pour qu'une vidéo trop courte ne boucle pas trop)
const dureePhrase = (voix) => String(voix || '').replace(/\*/g, '').split(/\s+/).filter(Boolean).length / 2.8 + 0.4;

function simplifier(q) { return String(q || '').split(/\s+/).filter(Boolean).slice(0, 2).join(' '); }

// script : { beats: [{ voix, visuel: { requete } }], image_generale } ; rend { clips, credits, manquants, avertissement }
async function choisir(script) {
  const beats = (script && script.beats) || [];
  if (!branche()) return { clips: beats.map(() => null), credits: [], manquants: beats.length, avertissement: 'pas de banque de vidéos branchée : fond animé à la place des images' };
  const prises = new Set();
  const caches = {};
  const clips = [];
  const credits = [];
  let manquants = 0, avertissement = null;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const essais = [b.visuel && b.visuel.requete, simplifier(b.visuel && b.visuel.requete), script.image_generale].filter((q, k, t) => q && t.indexOf(q) === k);
    let pris = null;
    for (const q of essais) {
      let liste;
      try {
        liste = caches[q] || (caches[q] = await chercher(q, 'portrait'));
        if (!liste.length) liste = caches[q + '|l'] || (caches[q + '|l'] = await chercher(q, 'landscape'));
      } catch (e) {
        if (e.definitif || e.quota) { avertissement = e.message; break; }
        continue;
      }
      const besoin = dureePhrase(b.voix);
      const candidats = liste.filter((v) => v && v.id && !prises.has(v.id) && Number(v.duration) >= 3)
        .sort((a, c) => ((Number(c.duration) >= besoin) - (Number(a.duration) >= besoin)) || ((c.height >= c.width) - (a.height >= a.width)));
      for (const v of candidats) {
        const f = fichier(v);
        if (!f || !hoteAccepte(f.link)) continue;
        pris = { url: f.link, w: f.width, h: f.height, duree: Number(v.duration) || null, pexels: v.id, page: v.url || null, auteur: (v.user && v.user.name) || null, image: v.image || null, requete: q };
        prises.add(v.id);
        break;
      }
      if (pris) break;
    }
    if (avertissement && !pris) { clips.push(null); manquants++; continue; }
    if (!pris) manquants++;
    clips.push(pris);
    if (pris && pris.auteur) credits.push({ auteur: court(pris.auteur, 60), page: pris.page });
  }
  return { clips, credits, manquants, avertissement };
}

// ce que montre une vidéo Pexels, lu dans l'adresse de sa page (« /video/a-man-eating-a-sandwich-4275784/ »)
function descriptionDe(v) {
  const m = /\/video\/([a-z0-9-]+?)-\d+\/?$/i.exec(String((v && v.url) || ''));
  return m ? m[1].replace(/-/g, ' ').trim().slice(0, 120) : '';
}
const sansEtoiles = (s) => String(s || '').replace(/\*/g, '');

// les vidéos possibles d'une phrase : jusqu'à 5 par recherche, 8 en tout ; une vidéo n'est proposée qu'à une phrase
// (deux phrases qui cherchent la même chose se partagent les résultats) ; moins de 3 : la recherche simplifiée, puis
// l'image générale du sujet
async function candidatsDe(b, generale, caches, offerts) {
  const v = b.visuel || {};
  const qs = [v.requete, v.requete2].filter((q, k, t) => q && t.indexOf(q) === k);
  const secours = [simplifier(v.requete), generale].filter((q, k, t) => q && qs.indexOf(q) < 0 && t.indexOf(q) === k);
  const out = [];
  for (const q of qs.concat(secours)) {
    if (qs.indexOf(q) < 0 && out.length >= 3) break;
    let liste = caches[q] || (caches[q] = await chercher(q, 'portrait'));
    if (!liste.length) liste = caches[q + '|l'] || (caches[q + '|l'] = await chercher(q, 'landscape'));
    let n = 0;
    for (const x of liste) {
      if (out.length >= 8 || n >= 5) break;
      if (!x || !x.id || offerts.has(x.id) || Number(x.duration) < 3) continue;
      const f = fichier(x);
      if (!f || !hoteAccepte(f.link)) continue;
      out.push({ v: x, f, q, description: descriptionDe(x) });
      offerts.add(x.id);
      n++;
    }
  }
  return out;
}
const clipDe = (c) => ({ url: c.f.link, w: c.f.width, h: c.f.height, duree: Number(c.v.duration) || null, pexels: c.v.id, page: c.v.url || null, auteur: (c.v.user && c.v.user.name) || null, image: c.v.image || null, requete: c.q, description: c.description || null });

const OUTIL_CHOIX = {
  name: 'choisir_images',
  description: 'Pour chaque phrase, la vidéo qui montre ce que dit la phrase, ou aucune (0) avec l\'image à créer.',
  input_schema: {
    type: 'object',
    properties: {
      choix: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phrase: { type: 'integer', description: 'Le numéro de la phrase' },
            video: { type: 'integer', description: 'Le numéro de la vidéo choisie, ou 0 si aucune ne montre ce que dit la phrase' },
            image: { type: 'string', description: 'Si video = 0 : l\'image à créer, EN ANGLAIS, 20 à 50 mots, une scène concrète qui montre ce que dit la phrase, sans texte' }
          },
          required: ['phrase', 'video']
        }
      }
    },
    required: ['choix']
  }
};

// une image créée pour une phrase, sur la clé fal de la créatrice : réservée sur son budget, rendue si fal échoue
async function imageCreee(db, c, k, prompt, graine, budget) {
  const prix = FAL.MODELES.image.prix;
  const resa = await CL.compter(db, c, prix, budget);
  if (!resa.ok) return { erreur: 'budget' };
  try {
    const s = await FAL.executer(k, FAL.MODELES.image.id, FAL.entreeImage(court(prompt + '. Vertical 9:16 composition, main subject centered, no text, no letters, no logo, no watermark', 1200), graine), 60000);
    const im = FAL.lireImage(s);
    if (!im.url) return { erreur: im.erreur, prix };
    return { clip: { url: im.url, type: 'image', w: im.w, h: im.h, ia: true }, prix };
  } catch (e) {
    await CL.compter(db, c, -prix);
    return { erreur: e.message, code: e.code };
  }
}

// Lou choisit, avec Claude : rend { clips, credits, manquants, avertissement, cout }
async function choisirAvecLou(db, c, v) {
  const script = v.script || {};
  const beats = script.beats || [];
  if (!branche()) return choisir(script);
  const r = C.reglagesDe(c);
  const caches = {};
  const offerts = new Set();
  const cands = [];
  let avertissement = null;
  for (let i = 0; i < beats.length; i++) {
    if (avertissement) { cands.push([]); continue; }
    try { cands.push(await candidatsDe(beats[i], script.image_generale, caches, offerts)); }
    catch (e) {
      if (e.definitif || e.quota) { avertissement = e.message; cands.push([]); continue; }
      cands.push([]);
    }
  }
  // Claude lit les phrases et ce que montre chaque vidéo possible
  let choix = null, cout = 0;
  const lou = C.equipeDe(c).realisation.prenom;
  const prompt = 'Voici les phrases d\'une vidéo et, pour chacune, les vidéos d\'illustration trouvées (ce qu\'elles montrent, et leur durée).\n\n' +
    beats.map((b, i) => 'PHRASE ' + (i + 1) + ' : « ' + sansEtoiles(b.voix) + ' »' + ((b.visuel || {}).description ? ' (la plume voulait montrer : ' + b.visuel.description + ')' : '') + '\n' +
      (cands[i].length ? cands[i].map((x, k) => '  ' + (k + 1) + '. ' + (x.description || 'sans description') + ' (' + Math.round(Number(x.v.duration) || 0) + ' s)').join('\n') : '  (aucune vidéo trouvée)')).join('\n\n') +
    '\n\nAppelle l\'outil choisir_images avec un choix par phrase.';
  const system = 'Tu es ' + lou + ', chargée des images dans l\'équipe de ' + c.prenom + ' : tu choisis la vidéo d\'illustration de chaque phrase de ses vidéos courtes.\n' +
    'Une vidéo n\'est bonne que si quelqu\'un qui regarde voit tout de suite le lien avec ce que dit la phrase : le même sujet, la même action ou le même lieu. ' +
    'Une vidéo qui ne reprend qu\'un mot pris au hasard ne compte pas (des câbles pour un intestin « comme un câble », une route pour un « voyage », un couple qui court dans un couloir pour une envie pressante) : réponds 0. ' +
    'Jamais la même vidéo pour deux phrases. Mieux vaut 0 qu\'une vidéo hors sujet.\n' +
    'Quand tu réponds 0, écris en anglais l\'image à créer : une scène concrète de 20 à 50 mots qui montre ce que dit la phrase, en photo réaliste, ou en illustration 3D claire et propre si c\'est l\'intérieur du corps, l\'infiniment petit ou ce qui ne se photographie pas ; rien de sanglant ni de dégoûtant, aucun texte, aucune personne célèbre, aucune marque.';
  try {
    const res = await CL.appeler(db, c, { usage: 'juger', system, prompt, outil: OUTIL_CHOIX, maxTokens: 400 + beats.length * 160 });
    choix = Array.isArray(res.sortie.choix) ? res.sortie.choix : [];
    cout += res.cout;
  } catch (e) {
    if (e.code === 'temps') throw e;
    choix = null;
    avertissement = avertissement || 'images choisies sans relecture (' + court(e.message, 100) + ')';
  }
  // fal pour les phrases sans bonne vidéo, si sa clé est branchée
  let k = null;
  try { k = (c.secrets || {}).fal && !(v.plan || {}).sans_fal ? FAL.cle(c) : null; } catch (e) { k = null; }
  const graine = (Number(v.id) * 7919 + 17) % 2147483647;
  const clips = beats.map(() => null);
  const prises = new Set();
  const aCreer = [];
  beats.forEach((b, i) => {
    let c1 = null;
    if (choix) {
      const x = choix.find((y) => Number(y && y.phrase) === i + 1) || {};
      const n = Math.round(Number(x.video) || 0);
      if (n >= 1 && cands[i][n - 1] && !prises.has(cands[i][n - 1].v.id)) c1 = cands[i][n - 1];
      if (!c1 && x.image && String(x.image).trim().length > 12) aCreer.push([i, String(x.image).trim()]);
      else if (!c1 && !choix.length) c1 = cands[i].find((y) => !prises.has(y.v.id)) || null;
    } else c1 = cands[i].find((y) => !prises.has(y.v.id)) || null;
    if (c1) { prises.add(c1.v.id); clips[i] = clipDe(c1); }
  });
  const notes = [];
  let creees = 0, ratees = 0;
  if (aCreer.length && k) {
    for (let j = 0; j < aCreer.length; j += 4) {
      const lot = await Promise.all(aCreer.slice(j, j + 4).map(([i, p]) => imageCreee(db, c, k, p, graine, r.budget_jour).then((x) => [i, x])));
      for (const [i, x] of lot) {
        if (x.prix) cout += x.prix;
        if (x.clip) { clips[i] = x.clip; creees++; } else ratees++;
        if (x.code === 'fal_refusee') await FAL.marquer(db, c, 'refusee', 'fal a refusé la clé le ' + new Date().toLocaleDateString('fr-FR'));
        if (x.code === 'fal_credit') await FAL.marquer(db, c, 'credit', 'plus de crédit chez fal');
      }
    }
  }
  if (creees) notes.push(creees + (creees > 1 ? ' images créées' : ' image créée') + ' là où aucune vidéo ne montrait la phrase');
  const vides = clips.filter((x) => !x).length;
  if (vides) notes.push(vides + (vides > 1 ? ' phrases sans image qui colle' : ' phrase sans image qui colle') + ' : fond animé' + (!k && aCreer.length ? ' (branche ta clé fal pour qu\'une image soit créée à la place)' : ratees ? ' (image pas créée)' : ''));
  if (avertissement) notes.unshift(avertissement);
  const credits = clips.filter((x) => x && x.auteur).map((x) => ({ auteur: court(x.auteur, 60), page: x.page }));
  return { clips, credits, manquants: vides, avertissement: notes.join(' ; ') || null, cout: Math.round(cout * 10000) / 10000 };
}

module.exports = { choisir, choisirAvecLou, branche, fichier, hoteAccepte, dureePhrase, descriptionDe, OUTIL_CHOIX, forcer };
