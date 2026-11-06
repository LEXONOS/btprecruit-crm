// Léa, iconographe : les photos d'illustration quand l'entreprise n'a pas (encore) les siennes. Pour chaque place du
// site (le haut de page, chaque service, la présentation, le bandeau), elle cherche dans les banques de photos libres
// (Pexels, clé HQ_PEXELS_KEY ; Pixabay, clé HQ_PIXABAY_KEY ; usage commercial libre pour les deux), selon le métier, puis
// regarde chaque candidate (Claude) : elle la DÉCRIT (ce qu'on y voit, en une phrase), la note (le métier se
// reconnaît-il ? nette, bien cadrée ? un visage, un texte, un logo, de la neige ?) et dit à quelles places du site elle
// irait. Chaque place prend la meilleure photo qui lui va, d'où qu'elle vienne ; s'il en manque, un second tour de
// recherche. Jamais de visage : une photo de banque ne doit pas passer pour l'équipe de l'entreprise. Sans clé, une petite
// banque choisie pour les métiers où une image d'ambiance a du sens (banque.js). Les octets sont téléchargés une fois et
// servis par le site lui-même (Pixabay l'exige) ; l'auteur est crédité dans les mentions légales. Les photos de la fiche
// Google de l'entreprise ne sont jamais reprises : Google interdit de les stocker.
'use strict';
const { telechargerImage } = require('../web');
const { appel, coutDe } = require('../claude');
const { MODELS } = require('../config');
const PH = require('./photos');
const T = require('./theme');
const B = require('./banque');

// version 4 : les vignettes Pexels arrivent enfin (elles étaient servies en AVIF et refusées), et une photo large pour les bandes
// version 5 : plus de candidates par place, et les photos générales partagées entre haut de page, présentation et bandeau
// version 6 : deux banques (Pexels et Pixabay), chaque photo décrite et rangée à la place qui lui va, un second tour de
// recherche quand il en manque, des recherches par métier revues (location de matériel, finance, agriculture...)
const VERSION = 6;
// les mots qui amènent des personnes au premier plan : jamais dans une recherche
const PERSONNES = /\b(man|men|woman|women|person|persons|people|girl|girls|boy|boys|child|children|kid|kids|portrait|face|faces|smiling|smile|couple|family|businessman|businesswoman|worker|workers|guy|lady|selfie|model|team|employee|customer|client|student|doctor|nurse|chef|technician|plumber|electrician|mechanic|hairdresser|barber|beautician|photographer|waiter|waitress|cook|gardener|painter|builder|engineer|farmer|driver|staff|crew)\b/i;
const SEUILS = { hero: { pertinence: 7, qualite: 7 }, service: { pertinence: 7, qualite: 6 }, apropos: { pertinence: 6, qualite: 6 }, bandeau: { pertinence: 6, qualite: 7 } };
function cle() { return String(process.env.HQ_PEXELS_KEY || '').trim(); }
function clePixabay() { return String(process.env.HQ_PIXABAY_KEY || '').trim(); }
function branche() { return !!(cle() || clePixabay()); }

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
// Pixabay : des photos libres (licence Pixabay, usage commercial sans attribution obligatoire), téléchargées chez nous
// comme l'exige leur règlement ; la grande version fait 1280 px de large
async function chercherPixabay(requete, k, n) {
  const u = 'https://pixabay.com/api/?key=' + encodeURIComponent(k) + '&q=' + encodeURIComponent(requete) + '&image_type=photo&orientation=horizontal&min_width=1280&safesearch=true&per_page=' + Math.max(3, Math.min(60, n || 15)) + '&lang=en';
  const r = await fetch(u, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (r.status === 400 || r.status === 401 || r.status === 403) { const e = new Error('clé Pixabay refusée'); e.statut = r.status; throw e; }
  if (r.status === 429) { const e = new Error('quota Pixabay atteint pour l\'heure'); e.statut = 429; throw e; }
  if (!r.ok) throw new Error('Pixabay répond ' + r.status);
  const j = await r.json();
  return (j.hits || []).filter(function (p) { return p && p.id && p.imageWidth >= 1280 && p.imageWidth / p.imageHeight >= 1.15 && p.largeImageURL && p.webformatURL; }).map(function (p) {
    return { id: 'pb' + p.id, source: 'Pixabay', l: p.imageWidth, h: p.imageHeight, alt: String(p.tags || ''), base: null, vignette: p.webformatURL, grande: p.largeImageURL, auteur: p.user || null, page_auteur: p.user ? 'https://pixabay.com/users/' + encodeURIComponent(p.user) + '-' + p.user_id + '/' : null, page: p.pageURL || null };
  });
}
// les banques branchées, dans l'ordre où leurs photos sont présentées à Léa (mêlées, une de chaque à tour de rôle)
function sources() {
  const out = [];
  if (cle()) out.push({ nom: 'Pexels', chercher: function (q, n) { return chercherPexels(q, cle(), n); } });
  if (clePixabay()) out.push({ nom: 'Pixabay', chercher: function (q, n) { return chercherPixabay(q, clePixabay(), n); } });
  return out;
}
async function verifierPixabay(k) {
  try { await chercherPixabay('tropical garden', k, 3); return { ok: true }; }
  catch (e) { return { erreur: e.statut ? 'clé Pixabay refusée : recopie-la depuis la page API de Pixabay (connecté)' : 'Pixabay ne répond pas (' + e.message + ')' }; }
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
  const uniques = function (l) { return l.filter(Boolean).filter(function (q, k, a) { return a.indexOf(q) === k; }); };
  const out = [{ role: 'hero', code: 'H', requetes: uniques([requete(spec.photo_hero)].concat(defaut)).slice(0, 3), quoi: 'la grande photo du haut de page : une scène large et lumineuse qui montre tout de suite le métier' }];
  (spec.services || []).slice(0, 6).forEach(function (s, k) { const q = requete(s && s.photo); out.push({ role: 'service', code: 'S' + (k + 1), pour: k, titre: cleTitre(s && s.titre), requetes: q ? [q] : [], quoi: 'le service « ' + String((s && s.titre) || '') + ' »' }); });
  out.push({ role: 'apropos', code: 'A', requetes: uniques([requete(spec.photo_ambiance)].concat(defaut.slice(1))).slice(0, 2), quoi: 'la photo de la présentation de l\'entreprise : une autre scène du métier' });
  out.push({ role: 'bandeau', code: 'B', requetes: uniques(defaut.slice(2).concat(defaut.slice(0, 1))).slice(0, 1), quoi: 'une large photo d\'ambiance du métier, posée derrière une bande d\'appel (le texte se lit dessus)' });
  // le second tour : les recherches du métier pas encore faites
  const faites = out.reduce(function (t, p) { return t.concat(p.requetes); }, []);
  out.reserve = defaut.filter(function (q) { return faites.indexOf(q) < 0; }).slice(0, 3);
  return out;
}

/* ── le regard : Claude note chaque candidate ── */
const OUTIL_NOTES = {
  name: 'noter_photos',
  description: 'Décris et note chaque photo candidate. Appelle cet outil une seule fois avec toutes les notes.',
  input_schema: { type: 'object', properties: { notes: { type: 'array', items: { type: 'object', properties: {
    n: { type: 'integer', description: 'Numéro de la photo' },
    description: { type: 'string', description: 'Ce qu\'on voit, en français, en une phrase courte et neutre (6 à 14 mots), sans interprétation ni nom de marque : « Climatiseur mural blanc dans un salon lumineux », « Mains qui serrent un raccord de cuivre sous un évier »' },
    pertinence: { type: 'integer', description: '0 à 10 : un client reconnaît-il tout de suite le métier de cette entreprise ? 10 = exactement son métier, 7 = clairement son métier, 4 = vague rapport, 0 = hors sujet' },
    qualite: { type: 'integer', description: '0 à 10 : nette, bien éclairée, bien cadrée, digne d\'un site professionnel (une photo de banque ringarde ou mise en scène vaut moins)' },
    convient: { type: 'array', items: { type: 'string' }, description: 'Les codes des places du site où cette photo irait bien (H, A, B, S1, S2...) ; vide si nulle part' },
    visage: { type: 'boolean', description: 'true si un visage humain est reconnaissable (de face ou de profil net) ; des mains, un dos, une silhouette floue ou lointaine : false' },
    texte: { type: 'boolean', description: 'true seulement si un texte ou un logo se lit nettement et attire l\'oeil : enseigne ou nom d\'un autre commerce, filigrane, légende, affiche, écran rempli de texte. Une petite marque de fabricant sur un appareil (climatiseur, voiture, outil), discrète : false' },
    hors_lieu: { type: 'boolean', description: 'true si la scène ne peut pas être en Martinique (neige, feuillage d\'automne, architecture typique d\'ailleurs bien visible) ; un gros plan d\'objet : false' }
  }, required: ['n', 'description', 'pertinence', 'qualite', 'convient', 'visage', 'texte', 'hors_lieu'] } } }, required: ['notes'] }
};
// pl = les places du site (codes H, A, B, S1...) : Léa dit à quelles places chaque photo irait
async function noter(spec, candidates, opts, pl) {
  const tier = (opts && opts.tier) || 'fast';
  const p = MODELS[tier] || MODELS.fast;
  const lesPlaces = (pl || []).map(function (x) { return x.code + ' = ' + x.quoi; }).join('\n');
  const contenu = [{ type: 'text', text: 'Entreprise : ' + [spec.activite, spec.metier].filter(Boolean).join(', ') + (spec.commune ? ', à ' + spec.commune : '') + ', en Martinique.' + (lesPlaces ? '\nLes places de son site :\n' + lesPlaces : '') + '\nDécris et note chacune de ces ' + candidates.length + ' photos candidates, et dis à quelles places elle irait.' }];
  candidates.forEach(function (c, k) {
    contenu.push({ type: 'text', text: 'Photo ' + (k + 1) + ' (cherchée pour ' + c.quoi + ')' });
    contenu.push({ type: 'image', source: { type: 'base64', media_type: c.vignetteType || 'image/jpeg', data: c.vignetteData.toString('base64') } });
  });
  const corps = { model: p.id, max_tokens: Math.min(8000, 600 + 110 * candidates.length), system: [{ type: 'text', text: 'Tu es Léa, iconographe de Novalemo, studio de sites internet en Martinique. Tu regardes des photos de banque d\'images : tu décris honnêtement ce que chacune montre, tu notes sévèrement si elle peut illustrer le site d\'une entreprise locale, et tu dis à quelle place de son site elle irait. Une photo médiocre ou hors sujet vaut mieux absente.' }], messages: [{ role: 'user', content: contenu }], tools: [OUTIL_NOTES], tool_choice: { type: 'tool', name: 'noter_photos' } };
  let r = await appel(corps);
  if (!r.ok && (r.status === 404 || (r.status === 400 && /model/i.test(r.message))) && p.fallback) r = await appel(Object.assign({}, corps, { model: p.fallback }));
  if (!r.ok) throw new Error('notes des photos : ' + r.message);
  const u = r.data.usage || {};
  const usage = { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, searches: 0 };
  const bloc = (r.data.content || []).find(function (x) { return x.type === 'tool_use' && x.name === 'noter_photos'; });
  const notes = {};
  ((bloc && bloc.input && bloc.input.notes) || []).forEach(function (x) {
    if (!x || !(x.n >= 1 && x.n <= candidates.length)) return;
    const conv = Array.isArray(x.convient) ? x.convient.map(function (c) { return String(c).toUpperCase().trim(); }) : null;
    notes[candidates[x.n - 1].id] = Object.assign({}, x, { convient: conv, description: String(x.description || '').replace(/\s+/g, ' ').trim().slice(0, 140) });
  });
  return { notes: notes, usage: usage, cout: coutDe(tier, usage) };
}
function passe(n, role) { const s = SEUILS[role] || SEUILS.service; return !!n && n.pertinence >= s.pertinence && n.qualite >= s.qualite && !n.visage && !n.texte && !n.hors_lieu; }

const GENERALES = ['H', 'A', 'B'];
// la photo va-t-elle à cette place ? Ce que Léa en a dit (ses places) ; à défaut, la place pour laquelle elle a été
// cherchée (une photo générale va aux trois places générales, jamais à un service précis)
function vaA(c, n, p) {
  if (!passe(n, p.role)) return false;
  if (n.convient && n.convient.length) return n.convient.indexOf(p.code) >= 0 || (GENERALES.indexOf(p.code) >= 0 && n.convient.some(function (x) { return GENERALES.indexOf(x) >= 0; }));
  return c.pour === p.code || (GENERALES.indexOf(p.code) >= 0 && GENERALES.indexOf(c.pour) >= 0);
}
// chaque place prend la meilleure photo libre qui lui va : le haut de page d'abord, puis les services, la présentation,
// le bandeau
function ranger(pl, vues, notes) {
  const pris = new Set(), choix = [];
  const ordre = pl.filter(function (p) { return p.role === 'hero'; }).concat(pl.filter(function (p) { return p.role === 'service'; }), pl.filter(function (p) { return p.role === 'apropos'; }), pl.filter(function (p) { return p.role === 'bandeau'; }));
  const score = function (c, p) { const n = notes[c.id]; return n.pertinence * 2 + n.qualite + (n.convient && n.convient[0] === p.code ? 1 : 0) + (c.pour === p.code ? 0.5 : 0); };
  for (const p of ordre) {
    const ok = vues.filter(function (c) { return !pris.has(c.id) && notes[c.id] && vaA(c, notes[c.id], p); });
    ok.sort(function (a, b) { return score(b, p) - score(a, p); });
    if (ok[0]) { pris.add(ok[0].id); choix.push({ c: ok[0], role: p.role, pour: p.pour, titre: p.titre, code: p.code }); }
  }
  return choix;
}

// opts = { eviter (ids déjà pris par les voisins), graine, peutDepenser (fonction), tier, sauf (places déjà prises par ses photos) }
// → { photos: [{ data, type, l, h, sha, url, credit, role, pour, pour_titre, desc }], source: 'pexels' | 'pixabay' | 'banques' |
//     'banque' | null, erreur, reessai (minutes avant de recommencer, null = la réponse est connue), cout, usage, notes }
async function choisir(spec, opts) {
  opts = opts || {};
  spec = spec || {};
  const eviter = opts.eviter instanceof Set ? opts.eviter : new Set(opts.eviter || []);
  const banques = sources();
  // sans clé : la banque de secours, et Léa reprendra l'aperçu dès qu'une clé est branchée
  if (!banques.length) return Object.assign(await banque(spec, eviter, opts.graine, opts.sauf), { erreur: 'pas de clé de banque de photos', reessai: 0, cout: 0, usage: null, notes: null });
  const sauf = opts.sauf || [];
  const tout = places(spec);
  const pl = tout.filter(function (p) { return sauf.indexOf(p.role) < 0; });
  const cache = {}, vues = [], dejaVues = new Set(), echecs = {};
  const notes = {};
  let erreur = null, arret = null, cout = 0, usage = null, regardees = 0, candidates = 0;
  const secours = async function (raison, reessai, extra) { const r = await banque(spec, eviter, opts.graine, opts.sauf); return Object.assign(r, { erreur: raison, reessai: reessai || null, cout: cout, usage: usage, notes: null }, extra || {}); };
  // un tour : les recherches (chaque banque, chaque requête), les vignettes, le regard de Léa
  const tour = async function (demandes, plafond) {
    const nouvelles = [];
    const parPlace = {};
    recherche: for (const d of demandes) {
      for (const q of d.requetes) {
        const lots = [];
        for (const b of banques) {
          const k = b.nom + '|' + q;
          if (!(k in cache)) {
            try { cache[k] = await b.chercher(q, 15); }
            catch (e) { cache[k] = []; erreur = e.message; if (e.statut === 429 || (e.statut && banques.length === 1)) { arret = e; break recherche; } continue; }
          }
          lots.push(cache[k]);
        }
        // les banques mêlées, une photo de chacune à tour de rôle ; sans personne dans la description d'abord
        const melange = [];
        for (let i = 0; i < 15; i++) lots.forEach(function (l) { if (l[i]) melange.push(l[i]); });
        melange.filter(function (x) { return !eviter.has(x.id) && !dejaVues.has(x.id); })
          .sort(function (a, b) { return (PERSONNES.test(a.alt) ? 1 : 0) - (PERSONNES.test(b.alt) ? 1 : 0); })
          .forEach(function (x) {
            parPlace[d.code] = parPlace[d.code] || 0;
            if (parPlace[d.code] >= d.max || nouvelles.length >= plafond || nouvelles.some(function (y) { return y.id === x.id; })) return;
            parPlace[d.code]++;
            nouvelles.push(Object.assign({}, x, { quoi: d.quoi, pour: d.code }));
          });
      }
    }
    candidates += nouvelles.length;
    const aVoir = [];
    for (const c of nouvelles) {
      dejaVues.add(c.id);
      const r = await telechargerImage(c.vignette, 400000).catch(function (e) { return { erreur: e.message || 'injoignable' }; });
      if (!r.erreur) aVoir.push(Object.assign(c, { vignetteData: r.data, vignetteType: r.type })); else echecs[r.erreur] = (echecs[r.erreur] || 0) + 1;
    }
    if (!aVoir.length) return 0;
    // sans le regard de Claude (budget du jour, panne), aucune photo n'est posée : on reprend plus tard
    if (opts.peutDepenser && !opts.peutDepenser()) { erreur = 'budget IA du jour atteint : photos regardées demain'; arret = { message: erreur, statut: 'budget' }; return 0; }
    const n = await noter(spec, aVoir, opts, tout);
    cout += n.cout;
    if (n.usage) { usage = usage || { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 }; Object.keys(usage).forEach(function (k) { usage[k] += n.usage[k] || 0; }); }
    Object.assign(notes, n.notes);
    aVoir.forEach(function (c) { if (notes[c.id]) { vues.push(c); regardees++; } });
    return aVoir.length;
  };
  // premier tour : chaque place avec ses recherches (10 candidates pour le haut de page, 6 ailleurs, 48 au plus)
  try { await tour(pl.filter(function (p) { return p.requetes.length; }).map(function (p) { return { code: p.code, quoi: p.quoi, requetes: p.requetes, max: p.role === 'hero' ? 10 : 6 }; }), 48); }
  catch (e) { return secours('regard indisponible (' + e.message + ')', 120); }
  if (arret) return secours(arret.message, arret.statut === 429 ? 65 : arret.statut === 'budget' ? 12 * 60 : null);
  let choix = ranger(pl, vues, notes);
  // il manque le haut de page, ou le site a moins de trois photos : un second tour, avec les autres recherches du métier
  const manqueHaut = pl.some(function (p) { return p.role === 'hero'; }) && !choix.some(function (c) { return c.role === 'hero'; });
  if ((manqueHaut || choix.length < Math.min(3, pl.length)) && tout.reserve.length) {
    try { await tour([{ code: 'H', quoi: 'une photo du métier (haut de page, présentation, bandeau ou un service)', requetes: tout.reserve, max: 16 }], 16); }
    catch (e) { erreur = 'second tour : ' + e.message; }
    if (!arret) choix = ranger(pl, vues, notes);
  }
  const trouvees = pl.map(function (p) { return p.code + ' ' + vues.filter(function (c) { return c.pour === p.code; }).length; }).join(', ');
  if (!vues.length) return secours(candidates ? 'vignettes illisibles (' + Object.keys(echecs).map(function (k) { return k + ' x' + echecs[k]; }).join(', ') + ')' : (erreur || 'aucune photo trouvée pour ce métier'), candidates || erreur ? 120 : null, { notes: { candidates: candidates, regardees: 0, trouvees: trouvees, echecs: echecs } });
  const photos = [];
  for (const x of choix) {
    const grande = x.c.source === 'Pexels' && x.role !== 'hero' ? x.c.grande.replace(/w=1920$/, 'w=1400') : x.c.grande;
    const r = await telechargerImage(grande, 2500000).catch(function () { return { erreur: 1 }; });
    if (r.erreur) continue;
    const d = PH.dimensions(r.data);
    if (!d || d.l < (x.role === 'hero' ? 1280 : 900) || d.h < 500) continue;
    const n = notes[x.c.id];
    photos.push({ data: r.data, type: r.type, l: d.l, h: d.h, sha: PH.sha1(r.data), url: grande, role: x.role, pour: x.pour, pour_titre: x.titre, desc: n.description || '', note: { pertinence: n.pertinence, qualite: n.qualite }, credit: { id: x.c.id, source: x.c.source, auteur: x.c.auteur, page: x.c.page, page_auteur: x.c.page_auteur } });
  }
  const bilan = { candidates: candidates, regardees: regardees, recalees: vues.filter(function (v) { return !passe(notes[v.id], 'apropos'); }).length, trouvees: trouvees, banques: banques.map(function (b) { return b.nom; }), echecs: Object.keys(echecs).length ? echecs : undefined };
  if (photos.length) {
    const src = Array.from(new Set(photos.map(function (x) { return x.credit.source; })));
    return { photos: photos, source: src.length > 1 ? 'banques' : src[0].toLowerCase(), erreur: erreur, reessai: null, cout: cout, usage: usage, notes: bilan };
  }
  // rien d'assez juste dans les banques : la banque de secours si le métier s'y prête (pas de nouvel essai : la réponse est connue)
  return secours('aucune photo assez juste pour ce métier', null, { cout: cout, usage: usage, notes: bilan });
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

module.exports = { choisir, illustrations, verifier, verifierPixabay, branche, sources, chercherPexels, chercherPixabay, places, noter, passe, ranger, cleTitre, PERSONNES, SEUILS, VERSION, OUTIL_NOTES };
