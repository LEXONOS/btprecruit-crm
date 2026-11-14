// Lou choisit les vidéos d'illustration : pour chaque phrase du script, une vidéo libre de droits de Pexels (gratuite,
// usage commercial permis, la clé de Louis HQ_PEXELS_KEY), filmée en vertical de préférence, assez longue pour la
// phrase, jamais deux fois la même dans une vidéo. Aucun appel à Claude : rien à payer pour la créatrice.
// Sans résultat, la recherche est simplifiée, puis l'image générale du sujet ; sinon la phrase garde un fond animé.
'use strict';
const { court } = require('../util');

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

module.exports = { choisir, branche, fichier, hoteAccepte, dureePhrase, forcer };
