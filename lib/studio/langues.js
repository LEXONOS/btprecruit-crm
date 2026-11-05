// Les versions de langue d'une vidéo : Romane écrit la française (humour et actualité), Nina adapte les autres.
// Quand toutes sont écrites, la vidéo part à l'usine pour être rendue dans chaque langue.
'use strict';
const S = require('./index');
const { majFraiche } = require('../db');
const { court, nettoie } = require('../util');

// les objets visés par les étiquettes de chaque plan, dans la langue source
function source(v) {
  const s = v.script || {};
  const plans = (v.scene && v.scene.plans) || [];
  return { titre: s.titre, accroche: s.accroche, description: s.description, hashtags: s.hashtags, beats: (s.beats || []).map((b, i) => ({ voix: b.voix, ecran: b.ecran || undefined, etiquettes: (plans[i] && plans[i].etiquettes) || [] })) };
}

// une version de langue est-elle juste ? (même nombre de phrases, mêmes pièces étiquetées, longueur tenable)
function verifier(x, src, marge) {
  const err = [];
  if (!x || !Array.isArray(x.beats) || x.beats.length !== src.beats.length) return ['il faut ' + src.beats.length + ' phrases (ici ' + ((x && x.beats) || []).length + ')'];
  x.beats.forEach((b, i) => {
    const s = src.beats[i];
    const l0 = String(s.voix).replace(/\*/g, '').length, l1 = String(b.voix || '').replace(/\*/g, '').length;
    if (!b.voix) err.push('phrase ' + (i + 1) + ' vide');
    else if (l1 > l0 * (marge || 1.6) + 20) err.push('phrase ' + (i + 1) + ' beaucoup trop longue (' + l1 + ' signes pour ' + l0 + ')');
    const objets = (s.etiquettes || []).map((e) => e.objet);
    const ets = Array.isArray(b.etiquettes) ? b.etiquettes : [];
    if (ets.length !== objets.length || ets.some((e, k) => e.objet !== objets[k])) err.push('phrase ' + (i + 1) + ' : les étiquettes doivent viser ' + (objets.join(', ') || 'aucun objet'));
    ets.forEach((e) => { if (!e.texte || String(e.texte).length > 28) err.push('phrase ' + (i + 1) + ' : étiquette trop longue « ' + e.texte + ' »'); });
  });
  if (!x.accroche || String(x.accroche).split(/\s+/).length > 9) err.push('accroche absente ou trop longue');
  return err;
}

function propre(x) {
  return {
    titre: nettoie(court(x.titre, 90)), accroche: nettoie(court(x.accroche, 70)), description: nettoie(court(x.description, 400)),
    hashtags: (x.hashtags || []).slice(0, 6).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')),
    beats: x.beats.map((b) => ({ voix: nettoie(String(b.voix).trim()), ecran: b.ecran ? nettoie(court(b.ecran, 14)) : null, etiquettes: (b.etiquettes || []).map((e) => ({ objet: e.objet, texte: nettoie(court(e.texte, 28)) })) })),
    blagues: (x.blagues || []).slice(0, 4).map((t) => court(t, 200))
  };
}

async function enregistrer(db, id, langue, version) {
  return majFraiche(db, 'hq_videos', id, (f) => (f.status === 'traduction' ? { traductions: Object.assign({}, f.traductions || {}, { [langue]: version }) } : null));
}

// toutes les langues écrites : la vidéo part à l'usine (ou elle est prête s'il n'y a que la langue source)
async function avancer(db, id) {
  const v = await db.one('hq_videos', { eq: { id } });
  if (!v || v.status !== 'traduction') return false;
  const autres = (v.langues || []).filter((l) => l !== v.langue_source);
  if (autres.some((l) => !(v.traductions || {})[l])) return false;
  await S.maj(db, v.id, { status: autres.length ? 'langues' : 'prete' }, 'traduction');
  if (autres.length) await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: 'monteur' }, neq: { status: 'paused' } }).catch(() => null);
  return true;
}

// la fiche d'actualité du jour (Gaspard) pour une langue, en texte pour les prompts
async function actu(db, langue) {
  const r = await db.one('hq_config', { eq: { key: 'studio_actu' } }).catch(() => null);
  const v = (r && r.value) || {};
  if (!v.le || Date.now() - new Date(v.le).getTime() > 4 * 86400000) return '';
  const l = ((v.langues || {})[langue] || []).slice(0, 6);
  if (!l.length) return '';
  const saison = (v.langues || {})[langue + '_saison'];
  return (saison ? 'En ce moment : ' + saison + '\n' : '') + l.map((x) => '- ' + x.sujet + ' : ' + x.contexte + ' | situation : ' + x.situation + (x.exemple ? ' | exemple : « ' + x.exemple + ' »' : '') + (x.a_eviter ? ' | à éviter : ' + x.a_eviter : '')).join('\n');
}

module.exports = { source, verifier, propre, enregistrer, avancer, actu };
