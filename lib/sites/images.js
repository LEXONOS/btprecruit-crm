// Léa, iconographe : les photos d'illustration quand l'entreprise n'a pas (encore) les siennes. Pour chaque place du
// site (le haut de page, chaque service, la présentation), elle cherche sur Pexels (clé HQ_PEXELS_KEY, licence Pexels :
// usage commercial libre), fait noter chaque candidate par Claude en la regardant (le métier se reconnaît-il ? photo
// nette ? un visage, un texte, un logo, de la neige ?) et ne garde que celles qui passent. Jamais de visage : une photo
// de banque ne doit pas passer pour l'équipe de l'entreprise. Sans clé, une petite banque choisie pour les métiers où une
// image d'ambiance a du sens (banque.js). Les octets sont téléchargés une fois et servis par le site lui-même ; l'auteur
// est crédité dans les mentions légales.
'use strict';
const { telechargerImage } = require('../web');
const { appel, coutDe } = require('../claude');
const { MODELS } = require('../config');
const PH = require('./photos');
const T = require('./theme');
const B = require('./banque');

// version 4 : les vignettes Pexels arrivent enfin (elles étaient servies en AVIF et refusées), et une photo large pour les bandes
const VERSION = 4;
// les mots qui amènent des personnes au premier plan : jamais dans une recherche
const PERSONNES = /\b(man|men|woman|women|person|persons|people|girl|girls|boy|boys|child|children|kid|kids|portrait|face|faces|smiling|smile|couple|family|businessman|businesswoman|worker|workers|guy|lady|selfie|model|team|employee|customer|client|student|doctor|nurse|chef|technician|plumber|electrician|mechanic|hairdresser|barber|beautician|photographer|waiter|waitress|cook|gardener|painter|builder|engineer|farmer|driver|staff|crew)\b/i;
const SEUILS = { hero: { pertinence: 7, qualite: 7 }, service: { pertinence: 7, qualite: 6 }, apropos: { pertinence: 6, qualite: 6 }, bandeau: { pertinence: 6, qualite: 7 } };
function cle() { return String(process.env.HQ_PEXELS_KEY || '').trim(); }
function branche() { return !!cle(); }

// fm=jpg : toujours du JPEG, quel que soit ce que le serveur préférerait envoyer
function urlPexels(id, base, largeur, hauteur) { return String(base || ('https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg')).split('?')[0] + '?auto=compress&cs=tinysrgb&fm=jpg&' + (hauteur ? 'h=' + hauteur : 'w=' + largeur); }
async function chercherPexels(requete, k, n, orientation) {
  const u = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(requete) + '&orientation=' + (orientation || 'landscape') + '&size=medium&per_page=' + (n || 15) + '&locale=en-US';
  const r = await fetch(u, { headers: { Authorization: k, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (r.status === 401 || r.status === 403) { const e = new Error('clé Pexels refusée'); e.statut = r.status; throw e; }
  if (r.status === 429) { const e = new Error('quota Pexels atteint pour l\'heure'); e.statut = 429; throw e; }
  if (!r.ok) throw new Error('Pexels répond ' + r.status);
  const j = await r.json();
  return (j.photos || []).filter(function (p) { return p && p.id && p.width >= 1200 && p.width / p.height >= 1.15; }).map(function (p) {
    const base = (p.src && p.src.original) || null;
    return { id: 'px' + p.id, source: 'Pexels', l: p.width, h: p.height, alt: String(p.alt || ''), base: base, vignette: urlPexels(p.id, base, null, 350), grande: urlPexels(p.id, base, 1920), auteur: p.photographer || null, page_auteur: p.photographer_url || null, page: p.url || null };
  });
}
// La clé est-elle bonne ? (Missions : essayée avant d'être enregistrée)
async function verifier(k) {
  try { await chercherPexels('tropical garden', k, 1); return { ok: true }; }
  catch (e) { return { erreur: e.statut === 401 || e.statut === 403 ? 'clé Pexels refusée : recopie-la depuis ta page API de Pexels' : 'Pexels ne répond pas (' + e.message + ')' }; }
}

/* ── les places du site et ce qu'on y cherche ── */
function cleTitre(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function requete(q) { const t = String(q || '').toLowerCase().replace(/[^a-z \-]/g, ' ').replace(/\s+/g, ' ').trim(); return t && !PERSONNES.test(t) ? t : ''; }
function places(spec) {
  const m = T.pourMetier(spec.secteur || spec.activite || '');
  const defaut = m.photos.map(requete).filter(Boolean);
  const out = [{ role: 'hero', requetes: [requete(spec.photo_hero)].concat(defaut).filter(Boolean).filter(function (q, k, a) { return a.indexOf(q) === k; }).slice(0, 3), quoi: 'la grande photo du haut de page : une scène large et lumineuse qui montre tout de suite le métier' }];
  (spec.services || []).slice(0, 6).forEach(function (s, k) { const q = requete(s && s.photo); if (q) out.push({ role: 'service', pour: k, titre: cleTitre(s.titre), requetes: [q], quoi: 'le service « ' + String(s.titre || '') + ' »' }); });
  out.push({ role: 'apropos', requetes: [requete(spec.photo_ambiance)].concat(defaut.slice(1)).filter(Boolean).filter(function (q, k, a) { return a.indexOf(q) === k; }).slice(0, 2), quoi: 'la photo de la présentation de l\'entreprise : une autre scène du métier' });
  out.push({ role: 'bandeau', requetes: defaut.slice(2).concat(defaut.slice(0, 1)).filter(Boolean).slice(0, 1), quoi: 'une large photo d\'ambiance du métier, posée derrière une bande d\'appel (le texte se lit dessus)' });
  return out;
}

/* ── le regard : Claude note chaque candidate ── */
const OUTIL_NOTES = {
  name: 'noter_photos',
  description: 'Note chaque photo candidate. Appelle cet outil une seule fois avec toutes les notes.',
  input_schema: { type: 'object', properties: { notes: { type: 'array', items: { type: 'object', properties: {
    n: { type: 'integer', description: 'Numéro de la photo' },
    pertinence: { type: 'integer', description: '0 à 10 : un client reconnaît-il tout de suite ce métier, ou ce service précis ? 10 = exactement le service, 7 = clairement le métier, 4 = vague rapport, 0 = hors sujet' },
    qualite: { type: 'integer', description: '0 à 10 : nette, bien éclairée, bien cadrée, digne d\'un site professionnel (une photo de banque ringarde ou mise en scène vaut moins)' },
    visage: { type: 'boolean', description: 'true si un visage humain est reconnaissable (de face ou de profil net) ; des mains, un dos, une silhouette floue ou lointaine : false' },
    texte: { type: 'boolean', description: 'true si on lit un texte, un logo, une marque ou un filigrane' },
    hors_lieu: { type: 'boolean', description: 'true si la scène ne peut pas être en Martinique (neige, feuillage d\'automne, architecture typique d\'ailleurs bien visible) ; un gros plan d\'objet : false' }
  }, required: ['n', 'pertinence', 'qualite', 'visage', 'texte', 'hors_lieu'] } } }, required: ['notes'] }
};
async function noter(spec, candidates, opts) {
  const tier = (opts && opts.tier) || 'fast';
  const p = MODELS[tier] || MODELS.fast;
  const contenu = [{ type: 'text', text: 'Entreprise : ' + [spec.activite, spec.metier].filter(Boolean).join(', ') + (spec.commune ? ', à ' + spec.commune : '') + ', en Martinique.\nNote chacune de ces ' + candidates.length + ' photos candidates pour son site, selon la place indiquée.' }];
  candidates.forEach(function (c, k) {
    contenu.push({ type: 'text', text: 'Photo ' + (k + 1) + ' (pour ' + c.quoi + ')' });
    contenu.push({ type: 'image', source: { type: 'base64', media_type: c.vignetteType || 'image/jpeg', data: c.vignetteData.toString('base64') } });
  });
  const corps = { model: p.id, max_tokens: 2000, system: [{ type: 'text', text: 'Tu es Léa, iconographe de Novalemo, studio de sites internet en Martinique. Tu regardes des photos de banque d\'images et tu notes, honnêtement et sévèrement, si chacune peut illustrer le site d\'une entreprise locale. Une photo médiocre ou hors sujet vaut mieux absente.' }], messages: [{ role: 'user', content: contenu }], tools: [OUTIL_NOTES], tool_choice: { type: 'tool', name: 'noter_photos' } };
  let r = await appel(corps);
  if (!r.ok && (r.status === 404 || (r.status === 400 && /model/i.test(r.message))) && p.fallback) r = await appel(Object.assign({}, corps, { model: p.fallback }));
  if (!r.ok) throw new Error('notes des photos : ' + r.message);
  const u = r.data.usage || {};
  const usage = { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, searches: 0 };
  const bloc = (r.data.content || []).find(function (x) { return x.type === 'tool_use' && x.name === 'noter_photos'; });
  const notes = {};
  ((bloc && bloc.input && bloc.input.notes) || []).forEach(function (x) { if (x && x.n >= 1 && x.n <= candidates.length) notes[candidates[x.n - 1].id] = x; });
  return { notes: notes, usage: usage, cout: coutDe(tier, usage) };
}
function passe(n, role) { const s = SEUILS[role] || SEUILS.service; return !!n && n.pertinence >= s.pertinence && n.qualite >= s.qualite && !n.visage && !n.texte && !n.hors_lieu; }

// opts = { eviter (ids déjà pris par les voisins), graine, peutDepenser (fonction), tier, sauf (places déjà prises par ses photos) }
// → { photos: [{ data, type, l, h, sha, url, credit, role, pour, pour_titre }], source: 'pexels' | 'banque' | null, erreur,
//     reessai (minutes avant de recommencer, null = la réponse est connue), cout, usage, notes }
async function choisir(spec, opts) {
  opts = opts || {};
  spec = spec || {};
  const eviter = opts.eviter instanceof Set ? opts.eviter : new Set(opts.eviter || []);
  const k = cle();
  if (k) {
    const sauf = opts.sauf || [];
    const pl = places(spec).filter(function (p) { return sauf.indexOf(p.role) < 0; });
    pl.forEach(function (p) { p.candidates = []; });
    const cache = {};
    let erreur = null, arret = null;
    // un quota atteint ou une clé refusée arrête toute la recherche : on reprend plus tard, sans rien poser à moitié
    recherche: for (const p of pl) {
      for (const q of p.requetes) {
        if (!(q in cache)) {
          try { cache[q] = await chercherPexels(q, k, 15); }
          catch (e) { cache[q] = []; erreur = e.message; if (e.statut) { arret = e; break recherche; } continue; }
        }
        // les candidates sans personne dans la description d'abord ; les autres restent, le regard tranchera
        cache[q].filter(function (x) { return !eviter.has(x.id); }).sort(function (a, b) { return (PERSONNES.test(a.alt) ? 1 : 0) - (PERSONNES.test(b.alt) ? 1 : 0); }).forEach(function (x) { if (p.candidates.length < (p.role === 'hero' ? 6 : 3) && !p.candidates.some(function (y) { return y.id === x.id; })) p.candidates.push(x); });
      }
    }
    const secours = async function (raison, reessai, extra) { const r = await banque(spec, eviter, opts.graine, opts.sauf); return Object.assign(r, { erreur: raison, reessai: reessai || null, cout: 0, usage: null, notes: null }, extra || {}); };
    if (arret) return secours(arret.message, arret.statut === 429 ? 65 : null);
    // toutes les candidates, une seule fois chacune (24 au plus), avec leur vignette
    const toutes = [];
    pl.forEach(function (p) { p.candidates.forEach(function (c) { if (!toutes.some(function (x) { return x.id === c.id; }) && toutes.length < 24) toutes.push(Object.assign({}, c, { quoi: p.quoi })); }); });
    const vues = [], echecs = {};
    for (const c of toutes) { const r = await telechargerImage(c.vignette, 400000).catch(function (e) { return { erreur: e.message || 'injoignable' }; }); if (!r.erreur) vues.push(Object.assign(c, { vignetteData: r.data, vignetteType: r.type })); else echecs[r.erreur] = (echecs[r.erreur] || 0) + 1; }
    // ce qui s'est passé, pour qu'un « aucune photo » se comprenne sans deviner
    const trouvees = pl.map(function (p) { return p.role + ' ' + p.candidates.length; }).join(', ');
    if (!vues.length) return secours(toutes.length ? 'vignettes illisibles (' + Object.keys(echecs).map(function (k) { return k + ' x' + echecs[k]; }).join(', ') + ')' : (erreur || 'aucune photo trouvée pour ce métier'), toutes.length || erreur ? 120 : null, { notes: { candidates: toutes.length, regardees: 0, trouvees: trouvees, echecs: echecs } });
    // sans le regard de Claude (budget du jour, panne), aucune photo Pexels n'est posée : on reprend plus tard
    if (opts.peutDepenser && !opts.peutDepenser()) return secours('budget IA du jour atteint : photos regardées demain', 12 * 60);
    let notes, cout = 0, usage = null;
    try { const n = await noter(spec, vues, opts); notes = n.notes; cout = n.cout; usage = n.usage; }
    catch (e) { return secours('regard indisponible (' + e.message + ')', 120); }
    const pris = new Set();
    const choix = [];
    for (const p of pl) {
      const ok = p.candidates.filter(function (c) { return !pris.has(c.id) && vues.some(function (v) { return v.id === c.id; }) && passe(notes[c.id], p.role); });
      ok.sort(function (a, b) { const x = notes[a.id], y = notes[b.id]; return (y.pertinence * 2 + y.qualite) - (x.pertinence * 2 + x.qualite); });
      if (ok[0]) { pris.add(ok[0].id); choix.push({ c: ok[0], role: p.role, pour: p.pour, titre: p.titre }); }
    }
    const photos = [];
    for (const x of choix) {
      const r = await telechargerImage(x.role === 'hero' ? x.c.grande : x.c.grande.replace(/w=1920$/, 'w=1400'), 2500000).catch(function () { return { erreur: 1 }; });
      if (r.erreur) continue;
      const d = PH.dimensions(r.data);
      if (!d || d.l < (x.role === 'hero' ? 1280 : 900) || d.h < 500) continue;
      const n = notes[x.c.id];
      photos.push({ data: r.data, type: r.type, l: d.l, h: d.h, sha: PH.sha1(r.data), url: x.c.grande, role: x.role, pour: x.pour, pour_titre: x.titre, note: { pertinence: n.pertinence, qualite: n.qualite }, credit: { id: x.c.id, source: x.c.source, auteur: x.c.auteur, page: x.c.page, page_auteur: x.c.page_auteur } });
    }
    const bilan = { candidates: toutes.length, regardees: vues.length, recalees: vues.filter(function (v) { return !passe(notes[v.id], 'apropos'); }).length, trouvees: trouvees, echecs: Object.keys(echecs).length ? echecs : undefined };
    if (photos.length) return { photos: photos, source: 'pexels', erreur: erreur, reessai: null, cout: cout, usage: usage, notes: bilan };
    // rien d'assez juste sur Pexels : la banque de secours si le métier s'y prête (pas de nouvel essai : la réponse est connue)
    return secours('aucune photo assez juste pour ce métier', null, { cout: cout, usage: usage, notes: bilan });
  }
  // sans clé : la banque de secours, et Léa reprendra l'aperçu dès que la clé est branchée
  return Object.assign(await banque(spec, eviter, opts.graine, opts.sauf), { erreur: 'pas de clé Pexels', reessai: 0, cout: 0, usage: null, notes: null });
}

// La petite banque de secours : déjà choisie à la main, pas besoin de la regarder
async function banque(spec, eviter, graine, sauf) {
  const roles = ['hero', 'apropos'].filter(function (r) { return (sauf || []).indexOf(r) < 0; });
  if (!roles.length) return { photos: [], source: null, erreur: null };
  const m = T.pourMetier(spec.secteur || spec.activite || '');
  if (!m.banque || !B.BANQUE[m.banque]) return { photos: [], source: null, erreur: null };
  const rng = T.tirage(T.hash(graine || spec.nom || ''));
  const set = B.BANQUE[m.banque].filter(function (p) { return p.ratio >= 1.2 && !eviter.has('ps' + p.id); }).map(function (p) { return { p: p, r: rng() }; }).sort(function (a, b) { return a.r - b.r; }).map(function (x) { return x.p; });
  const photos = [];
  for (const p of set.slice(0, 4)) {
    if (photos.length >= roles.length) break;
    const r = await telechargerImage(B.url(p, 1920), 2500000).catch(function () { return { erreur: 1 }; });
    if (r.erreur) continue;
    const d = PH.dimensions(r.data);
    if (!d || d.l < 1200 || d.h < 600) continue;
    photos.push({ data: r.data, type: r.type, l: d.l, h: d.h, sha: PH.sha1(r.data), url: B.url(p, 1920), role: roles[photos.length], credit: { id: 'ps' + p.id, source: 'Unsplash', auteur: p.auteur, page: p.page, page_auteur: null } });
  }
  return { photos: photos, source: photos.length ? 'banque' : null, erreur: null };
}

// L'ancien nom (moteur précédent) : même travail
async function illustrations(spec, opts) { return choisir(spec, opts); }

module.exports = { choisir, illustrations, verifier, branche, chercherPexels, places, noter, passe, cleTitre, PERSONNES, SEUILS, VERSION, OUTIL_NOTES };
