// Faux réseau pour les tests et la démo locale : Claude (agents et atelier), Google Places, GitHub, Afnic, annuaire,
// BODACC, sites web, Vercel (projet, fichiers, déploiements, domaines, registrar), Stripe. Tout en Martinique.
'use strict';
let appelsClaude = 0;
const dns = require('dns');
dns.promises.resolve4 = async function () { return ['93.184.216.34']; };
dns.promises.resolve6 = async function () { return []; };
dns.promises.resolveMx = async function (d) { return d.indexOf('sansmx') >= 0 ? [] : [{ exchange: 'mx1.mail.ovh.net', priority: 1 }]; };

function rep(content, stop, extraUsage) {
  return { ok: true, status: 200, json: async function () { return { content: content, stop_reason: stop || 'tool_use', usage: Object.assign({ input_tokens: 3000, output_tokens: 400, cache_read_input_tokens: 1500, cache_creation_input_tokens: 0 }, extraUsage || {}) }; } };
}
let n = 0; const tu = function (name, input) { n++; return { type: 'tool_use', id: 'tu_' + n, name: name, input: input }; };
function dernierResultat(last) { const trs = typeof last.content !== 'string' ? last.content.filter(function (b) { return b.type === 'tool_result'; }) : []; const tr = trs[trs.length - 1]; if (!tr) return null; try { return JSON.parse(tr.content); } catch (e) { return tr.content; } }

/* ── l'atelier : fiche de site ── */
let atelierEssais = 0;
function ficheSite(faits, mauvaise) {
  const nom = (faits.nom || 'Entreprise').replace(/\s+(sarl|sas)$/i, '');
  return {
    nom: nom, activite: 'Climatisation et froid', metier: 'Climatisation',
    titre: mauvaise ? 'L\'excellence à votre service !' : 'Votre clim posée et entretenue',
    accroche: mauvaise ? 'Votre confort, notre priorité absolue depuis toujours.' : 'Pose, entretien et dépannage de climatiseurs pour les maisons et les commerces.',
    objectif: 'devis', cta: 'Demander un devis', ton: 'franc', titre_services: '',
    services: [
      { titre: 'Installation', texte: 'Split, gainable ou cassette : l\'appareil adapté à la pièce, posé proprement.', icone: 'flocon', photo: 'air conditioner installation', detail: 'Avant la pose, on regarde la pièce, l\'exposition et l\'usage, puis on vous conseille l\'appareil juste.' },
      { titre: 'Entretien', texte: 'Filtres et évacuation nettoyés : un air plus sain, moins de pannes.', icone: 'cle', photo: 'air conditioner filter cleaning' },
      { titre: 'Dépannage', texte: 'Fuite, bruit, panne : on cherche la cause avant de réparer.', icone: 'outils', photo: 'portrait of smiling technician' }
    ],
    atouts: [{ titre: 'Un conseil honnête', texte: 'On vous dit si la réparation vaut le coup.', icone: 'bulle' }, { titre: 'Un travail propre', texte: 'Pose soignée, chantier laissé net.', icone: 'etincelles' }, { titre: 'Basés au Lamentin', texte: 'Au centre de l\'île.', icone: 'pin' }],
    etapes: [{ titre: 'Vous nous écrivez' }, { titre: 'On passe voir' }, { titre: 'On pose' }],
    a_propos: mauvaise ? 'Fondée depuis 2010, plus de 500 clients satisfaits.' : 'Une entreprise de climatisation du Lamentin, pour les maisons, les bureaux et les commerces du centre de la Martinique.',
    faq: [{ q: 'Quelle puissance pour ma pièce ?', r: 'Elle dépend de la surface et de l\'exposition : écrivez-nous.' }, { q: 'Faut-il entretenir sa clim ?', r: 'Oui, avec l\'air salin un entretien régulier évite les pannes.' }],
    appel: 'Une clim à poser ou à réparer ?',
    photo_hero: 'modern air conditioner living room', photo_ambiance: 'outdoor ac unit house',
    seo: { titre: 'Climatisation au Lamentin, ' + nom, description: 'Installation, entretien et dépannage de climatisation au Lamentin.' }
  };
}
function atelier(body) {
  atelierEssais++;
  const last = body.messages[body.messages.length - 1];
  const premier = typeof body.messages[0].content === 'string' ? body.messages[0].content : JSON.stringify(body.messages[0].content);
  const txt = typeof last.content === 'string' ? last.content : premier;
  const faits = (function () { try { return JSON.parse((premier.match(/FAITS SUR L'ENTREPRISE \(vérifiés\) :\n([\s\S]*?)\n\n/) || [])[1] || '{}'); } catch (e) { return {}; } })();
  const correction = typeof last.content !== 'string' && last.content.some(function (b) { return b.type === 'tool_result'; });
  const modif = /DEMANDE DU CLIENT/.test(txt);
  const f = ficheSite(faits, !correction && !modif && atelierEssais === 1);
  if (modif) { f.accroche = 'Pose et entretien de climatiseurs, pour les maisons et les bureaux du centre.'; f.faits_client = { horaires: ['Lundi au vendredi : 7 h 30 à 17 h'] }; if (/nom officiel|kbis|siret/i.test(txt)) { const so = (txt.match(/SIRET\s*:?\s*([\d ]{9,17})/i) || [])[1]; f.faits_client.raison_sociale = (txt.match(/nom officiel\s*:?\s*([A-Z][A-Z' ]+[A-Z])/) || [])[1]; if (so) f.faits_client.siret = so.replace(/\s/g, ''); } if (/portable/i.test(txt)) { const pt = (txt.match(/(069\d[\d ]{6,9})/) || [])[1]; if (pt) f.faits_client.telephone = pt; } if (/turquoise/i.test(txt)) f.faits_client.couleur = '#0e9aa7'; if (/autre style|tout changer/i.test(txt)) f.faits_client.nouveau_style = true; if (/mes services|nos services sont/i.test(txt)) f.faits_client.services_donnes = true; }
  return rep([tu('ecrire_site', f)], 'tool_use', { output_tokens: 1400 });
}

// Les vignettes portent leur adresse (voir imageFausse) : le faux regard reconnaît la photo et la juge comme le ferait Léa.
// photo n°…0 : un visage (recalée) ; n°…4 : un logo lisible (recalée) ; n°…5 : hors sujet ; les autres : justes et nettes
// Pixabay : les vignettes « pb-<id> » ; places(id, codes) : à quelles places Léa dit que la photo irait (sinon rien n'est dit)
const VISION = { appels: 0, vues: [], panne: false, places: null };
function vision(body) {
  VISION.appels++;
  if (VISION.panne) return { ok: false, status: 400, json: async function () { return { error: { message: 'requête refusée' } }; } };
  const blocs = body.messages[0].content.filter(function (b) { return b.type === 'image'; });
  const codes = ((body.messages[0].content[0].text || '').match(/^(H|A|B|S\d) = /gm) || []).map(function (x) { return x.slice(0, -3); });
  const notes = blocs.map(function (b, k) {
    const txt = Buffer.from(b.source.data, 'base64').toString('latin1');
    // les photos prises sur le site de l'entreprise (servies par l'aperçu, img/p<n>) : 700 + n (p4 un logo, p5 hors sujet)
    const sienne = txt.match(/\/img\/p(\d+)\./);
    const id = sienne ? 700 + Number(sienne[1]) : Number((txt.match(/pexels-photo-(\d+)/) || txt.match(/pb-(\d+)/) || [])[1] || 0);
    VISION.vues.push(id);
    const f = id % 10;
    // les photos Pixabay un peu mieux notées : elles gagnent des places quand les deux banques sont branchées
    const n = { n: k + 1, description: 'Scène de métier n° ' + id + ', nette et lumineuse', pertinence: f === 5 ? 3 : 8, qualite: /pb-\d+/.test(txt) && f !== 2 ? 9 : 8, visage: f === 0, texte: f === 4, hors_lieu: false };
    if (VISION.places) n.convient = VISION.places(id, codes);
    return n;
  });
  return rep([tu('noter_photos', { notes: notes })], 'tool_use', { input_tokens: 400 + 120 * blocs.length, output_tokens: 300 });
}
// Miranda : le faux regard (captures) et le faux jugement ; MIRANDA.notes donne les notes successives à rendre
// pages : ce que sert un aperçu en ligne (son HTML, ou 404) quand Miranda vérifie sa version avant de le regarder
// enTexte : le modèle rend ses listes en texte JSON (« "problemes": "[{...}]" »), comme les modèles 5.5 à qui l'outil est
// demandé en clair
const MIRANDA = { notes: [], regards: 0, jugements: 0, panne: false, illisible: false, enTexte: false, derniers: [], pages: {} };
function regardFaux(opts) {
  MIRANDA.regards++;
  if (MIRANDA.panne) return { ok: false, status: 500, json: async function () { return { ok: false, error: 'navigateur indisponible' }; } };
  // illisible : ce que rendait Node 26 avec un Uint8Array (« 255,216,... »), refusé par l'API
  const b = MIRANDA.illisible ? '255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,219,0,67,0,8,6,6,7,6,5,8,7,7,7,9,9,8,10,12,20,13,12,11,11,12,25,18,19,15,20,29,26,31,30,29,26,28,28,32,36,46,39,32,34,44,35,28,28,40,55,41,44,48,49,52,52,52,31,39,57,61,56,50,60,46,51,52,50' : jpeg(64, 40, 3, 'capture').toString('base64');
  const u = JSON.parse(opts.body).url;
  return { ok: true, status: 200, json: async function () { return { ok: true, ms: 1200, version: null, url: u, ordinateur: { haut: b, morceaux: [b, b], hauteur: 5200 }, telephone: { haut: b, morceaux: [b, b, b], hauteur: 7900 }, debord: { ordinateur: 0, telephone: 0 }, erreurs: [] }; } };
}
function critiqueFausse(body) {
  MIRANDA.jugements++;
  const texte = body.messages[0].content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
  const hero = (texte.match(/- hero : ([a-z]+\.[a-z0-9-]+)/) || [])[1] || null;
  const services = (texte.match(/- services : ([a-z]+\.[a-z0-9-]+)/) || [])[1] || null;
  MIRANDA.derniers.push({ hero: hero, services: services, images: body.messages[0].content.filter(function (b) { return b.type === 'image'; }).length });
  const note = MIRANDA.notes.length ? MIRANDA.notes.shift() : 8.5;
  const ok = note >= 8;
  const liste = function (x) { return MIRANDA.enTexte ? JSON.stringify(x) : x; };
  return rep([tu('juger_site', { note: note, verdict: ok ? 'valide' : 'a_refaire', resume: ok ? 'Un premier écran fort, une photo juste, tout se lit sur téléphone.' : 'Le haut de page est fade et le titre se perd sur la photo.', points_forts: liste(ok ? ['premier écran'] : []), problemes: liste(ok ? [] : [{ zone: 'haut de page', gravite: 'bloquant', constat: 'Le titre se lit mal sur la photo.', variante: hero }]), actions: liste(ok ? [] : ['changer_rubriques']) })], 'tool_use', { input_tokens: 9000, output_tokens: 500 });
}
/* ── le Studio 3D : actualité, accroches, script, relecture, vérification, scène, langues, critique ── */
// STUDIO.viral : notes successives de Félix ; STUDIO.verifs : verdicts d'Hélène ; STUDIO.scriptsRates : jets de Clara
// refusés par le contrôle ; STUDIO.consignes : le dernier texte reçu par chaque outil
// STUDIO.enTexte : listes rendues en texte JSON par le modèle ; STUDIO.coupe : réponse coupée (max_tokens) pour un outil
const STUDIO = { verdicts: [], viral: [], verifs: [], scenesRatees: 0, scriptsRates: 0, plumeRatee: 0, enTexte: 0, coupe: null, appels: {}, consignes: {}, systemes: {} };
const texteDe = function (body) { return body.messages.map(function (m) { return typeof m.content === 'string' ? m.content : m.content.map(function (b) { return b.text || ''; }).join('\n'); }).join('\n'); };
function studio(body) {
  const n = body.tool_choice.name;
  STUDIO.appels[n] = (STUDIO.appels[n] || 0) + 1;
  const ex = require('../usine/exemples/clim.json');
  const texte = texteDe(body);
  STUDIO.consignes[n] = texte;
  STUDIO.systemes[n] = body.system.map(function (b) { return b.text; }).join('\n');
  if (STUDIO.coupe && STUDIO.coupe.outil === n && STUDIO.coupe.n > 0) { STUDIO.coupe.n--; STUDIO.coupe.max = body.max_tokens; return rep([{ type: 'text', text: 'Je commence par écrire tout le raisonnement...' }, tu(n, {})], 'max_tokens', { output_tokens: body.max_tokens }); }
  if (n === 'trouver_accroches') {
    const k = STUDIO.appels[n];
    const familles = ['contradiction', 'chiffre_choc', 'enjeu_cache', 'question_impossible', 'personne_ne_dit', 'defi_regard', 'pov', 'comparaison_absurde'];
    return rep([tu('trouver_accroches', { sujet: 'climatiseur ' + k, cle: 'clim-' + k, mecanisme: ['Le compresseur comprime le gaz', 'Le condenseur évacue la chaleur dehors', 'Le détendeur fait chuter la pression', 'L\'évaporateur absorbe la chaleur de la pièce'], revelation: 'Le froid n\'existe pas : la clim déplace la chaleur.', chiffres: ['environ 80 °C en sortie de compresseur', 'environ 5 °C dans l\'évaporateur'], pourquoi_maintenant: 'la chaleur', accroches: familles.map(function (f, i) { return { famille: f, voix: i === 1 ? 'Your AC has never made *a single degree* of cold.' : 'Accroche ' + (i + 1) + ' sur la *clim*.', ecran: 'So where does the *heat* go?', image: 'gros plan sur le serpentin', question: 'où part la chaleur', notes: { arret: 9 - (i % 3), clarte: 9, curiosite: 9, verite: 9 } }; }), choix: 2, pourquoi: 'La contradiction la plus nette.' })], 'tool_use', { output_tokens: 1500 });
  }
  if (n === 'ecrire_script') {
    const beats = ex.script.beats.map(function (b) { return { role: b.role, voix: b.voix, ecran: b.ecran, image: b.image }; });
    if (STUDIO.scriptsRates > 0) { STUDIO.scriptsRates--; return rep([tu('ecrire_script', { titre: 'Trop court', accroche: 'Court', beats: beats.slice(0, 6), boucles: [], description: 'x', commentaire: 'x', hashtags: [] })]); }
    const texteJson = STUDIO.enTexte > 0 && STUDIO.enTexte--;
    return rep([tu('ecrire_script', { titre: 'Your AC has never made cold ' + STUDIO.appels[n], accroche: ex.script.accroche, beats: texteJson ? JSON.stringify(beats) : beats, boucles: texteJson ? JSON.stringify(ex.script.boucles) : ex.script.boucles, description: ex.script.description, commentaire: ex.script.commentaire, hashtags: ['howitworks', '#engineering'], sources: ['ASHRAE handbook'], a_verifier: [] })], 'tool_use', { output_tokens: 2400 });
  }
  if (n === 'juger_script') {
    const v = STUDIO.viral.length ? STUDIO.viral.shift() : 9;
    const notes = {}; ['accroche', 'enjeu', 'boucles', 'relance', 'rythme', 'concret', 'gain', 'fin', 'humour', 'clarte'].forEach(function (k) { notes[k] = v; });
    return rep([tu('juger_script', { notes: notes, spectateur: v < 8 ? [{ beat: 4, risque: 3, pourquoi: 'rien de neuf à l\'écran' }] : [], corrections: v < 8 ? [{ beat: 4, probleme: 'phrase molle', proposition: 'One fluid does *all* the work.' }] : [], resume: v < 8 ? 'La phrase 4 est molle.' : 'Accroche nette, relance au bon endroit.', lecon: v < 8 ? 'Une phrase sans événement visuel fait décrocher : chaque phrase doit montrer du neuf.' : '' })]);
  }
  if (n === 'ecrire_scene') {
    const nb = Number((texte.match(/LE SCRIPT \((\d+) phrases/) || [])[1]) || ex.scene.plans.length;
    const scene = JSON.parse(JSON.stringify(ex.scene));
    while (scene.plans.length < nb) scene.plans.push({ camera: { cible: 'tout' } });
    scene.plans = scene.plans.slice(0, nb);
    if (STUDIO.scenesRatees > 0) { STUDIO.scenesRatees--; scene.objets[2].type = 'tracteur'; }
    return rep([tu('ecrire_scene', { idee: 'Les deux unités de part et d\'autre du mur.', scene: scene })], 'tool_use', { output_tokens: 6000 });
  }
  if (n === 'adapter_video') {
    const src = JSON.parse((texte.match(/LA VIDÉO EN ANGLAIS :\n([\s\S]*?)\n\nAdapte/) || [])[1] || '{}');
    return rep([tu('adapter_video', { titre: 'Adapté : ' + src.titre, accroche: 'Alors où part la *chaleur* ?', description: 'Version adaptée.', hashtags: ['#commentcamarche'], beats: (src.beats || []).map(function (b) { return { voix: 'Adapté. ' + b.voix, ecran: b.ecran, etiquettes: (b.etiquettes || []).map(function (e) { return { objet: e.objet, texte: 'É ' + e.texte }; }) }; }) })]);
  }
  if (n === 'ecrire_francais') {
    const src = JSON.parse((texte.match(/LA VIDÉO EN ANGLAIS \([^)]*\) :\n([\s\S]*?)\n\nLA RÉVÉLATION/) || [])[1] || '{}');
    const fr = ex.langues.fr;
    const raté = STUDIO.plumeRatee > 0 && STUDIO.plumeRatee--;
    return rep([tu('ecrire_francais', { titre: fr.titre, accroche: fr.accroche, description: fr.description, hashtags: fr.hashtags, blagues: raté ? [] : fr.blagues, beats: (src.beats || []).map(function (b, i) { return { voix: (fr.beats[i] || {}).voix || b.voix, ecran: b.ecran, etiquettes: (b.etiquettes || []).map(function (e) { return { objet: e.objet, texte: 'FR ' + e.texte }; }) }; }) })], 'tool_use', { output_tokens: 2600 });
  }
  if (n === 'juger_video') {
    const v = STUDIO.verdicts.length ? STUDIO.verdicts.shift() : { note: 8, verdict: 'publier' };
    const images = body.messages[0].content.filter(function (b) { return b.type === 'image'; }).length;
    STUDIO.images = images;
    return rep([tu('juger_video', Object.assign({ resume: v.verdict === 'publier' ? 'On comprend tout, c\'est net.' : 'Le plan 3 est voilé.', problemes: v.verdict === 'publier' ? [] : [{ plan: 3, constat: 'image laiteuse' }], conseils: v.verdict === 'publier' ? '' : 'Recule la caméra au plan 3.' }, v))]);
  }
  return null;
}
// les travaux du Studio qui cherchent sur le web (Gaspard, Hélène) : une recherche, puis leur outil de fin
function studioWeb(body) {
  const noms = body.tools.map(function (t) { return t.name; });
  const texte = texteDe(body);
  const apresRecherche = body.messages.length > 1;
  if (noms.indexOf('fiche_actu') >= 0) {
    STUDIO.appels.fiche_actu = (STUDIO.appels.fiche_actu || 0) + 1;
    if (!apresRecherche) return rep([{ type: 'server_tool_use', id: 'st1', name: 'web_search', input: { query: 'actualité étudiants' } }, { type: 'web_search_tool_result', tool_use_id: 'st1', content: [] }, { type: 'text', text: 'Je fais la fiche.' }, tu('fiche_actu', { saison: 'Le froid arrive, les partiels approchent.', sujets: [{ sujet: 'Grève des transports', contexte: 'Journée de grève nationale ce jeudi.', situation: 'Le RER bondé un jour de grève', exemple: 'plus serré que le RER un jour de grève', a_eviter: 'la cause de la grève, un camp', source: 'https://www.sortiraparis.com' }, { sujet: 'Lycées bloqués', contexte: 'Blocages devant plusieurs lycées.', situation: 'Réviser quand le lycée est bloqué', exemple: 'plus de pression qu\'un lycéen devant Parcoursup', a_eviter: 'prendre parti', source: 'https://www.letudiant.fr' }, { sujet: 'Partiels', contexte: 'Les partiels de décembre approchent.', situation: 'La nuit blanche avant le partiel', exemple: 'plus chaud qu\'un cerveau en partiels', a_eviter: '', source: '' }, { sujet: 'Froid', contexte: 'Premières gelées.', situation: 'Le chauffage qu\'on n\'ose pas allumer', exemple: 'plus froid que ton appart en novembre', a_eviter: '', source: '' }] })], 'tool_use', { server_tool_use: { web_search_requests: 1 } });
    return rep([{ type: 'text', text: 'Fini.' }], 'end_turn');
  }
  if (noms.indexOf('verdict_faits') >= 0) {
    STUDIO.appels.verdict_faits = (STUDIO.appels.verdict_faits || 0) + 1;
    STUDIO.consignes.verdict_faits = texte;
    const v = STUDIO.verifs.length ? STUDIO.verifs.shift() : null;
    const x = v || { faits: [{ beat: 6, affirmation: 'eighty degrees', statut: 'juste', explication: 'Ordre de grandeur juste pour un R-32.', source: 'fabricant' }, { beat: 10, affirmation: 'ten times tire pressure', statut: 'approximatif', explication: 'Plutôt huit à douze fois selon le fluide.', source: 'manuel' }], corrections: [{ beat: 10, voix: 'Still warm, and squeezed to about *ten times* a car tire\'s pressure.' }], verdict: 'corrige', resume: 'Tout est juste, un chiffre nuancé.' };
    return rep([{ type: 'server_tool_use', id: 'st2', name: 'web_search', input: { query: 'R-32 high side pressure' } }, { type: 'web_search_tool_result', tool_use_id: 'st2', content: [] }, tu('verdict_faits', x)], 'tool_use', { server_tool_use: { web_search_requests: 1 } });
  }
  return null;
}
// les modèles de la génération 5.5 refusent un outil imposé (tool_choice « tool » ou « any ») : on le simule pour le modèle
// le plus fort (CLAUDE.refusOutil), et l'outil demandé en clair (tool_choice « auto ») est servi comme l'outil imposé
const CLAUDE = { refusOutil: false, refus: 0, enClair: 0 };
const OUVERTURES = { n: 0 };
function claude(body) {
  appelsClaude++;
  if (CLAUDE.refusOutil && body.model === (CLAUDE.modeleRefus || require('../lib/config').MODELS.genius.id) && body.tool_choice && (body.tool_choice.type === 'tool' || body.tool_choice.type === 'any')) {
    CLAUDE.refus++;
    return { ok: false, status: 400, json: async function () { return { type: 'error', error: { type: 'invalid_request_error', message: 'tool_choice: type "tool" and "any" are not supported for this model.' } }; } };
  }
  if (body.tool_choice && body.tool_choice.type === 'auto' && (body.tools || []).length === 1) {
    const last = body.messages[body.messages.length - 1];
    const demande = typeof last.content !== 'string' && last.content.some(function (b) { return b.type === 'text' && new RegExp('appelant l\'outil ' + body.tools[0].name).test(b.text || ''); });
    if (demande) { CLAUDE.enClair++; body = Object.assign({}, body, { tool_choice: { type: 'tool', name: body.tools[0].name } }); }
  }
  // un outil de fin exigé (fiche_essai) : le modèle l'oublie (texte seul) ou se fait couper par la longueur
  if ((body.tools || []).some(function (t) { return t.name === 'fiche_essai'; })) {
    CLAUDE.essais = (CLAUDE.essais || 0) + 1;
    const der = body.messages[body.messages.length - 1];
    const txt = typeof der.content === 'string' ? der.content : der.content.map(function (b) { return b.text || ''; }).join(' ');
    if (CLAUDE.modeEssai === 'texte' && !/Appelle maintenant l'outil fiche_essai/.test(txt)) return rep([{ type: 'text', text: 'Voici ce que j\'ai trouvé : deux sujets.' }], 'end_turn');
    if (CLAUDE.modeEssai === 'long' && body.max_tokens < 5000) return rep([{ type: 'text', text: 'Je commence la fiche.' }, { type: 'tool_use', id: 'tu_coupe', name: 'fiche_essai', input: {} }], 'max_tokens');
    if (CLAUDE.modeEssai === 'muet') return rep([{ type: 'text', text: 'Rien de plus.' }], 'end_turn');
    return rep([tu('fiche_essai', { sujets: '["a","b"]' })], 'tool_use');
  }
  if (body.tool_choice && ['trouver_accroches', 'ecrire_script', 'juger_script', 'ecrire_scene', 'adapter_video', 'ecrire_francais', 'juger_video'].indexOf(body.tool_choice.name) >= 0) return studio(body);
  if ((!body.tool_choice || body.tool_choice.type === 'auto') && Array.isArray(body.tools) && body.tools.some(function (t) { return t.name === 'fiche_actu' || t.name === 'verdict_faits'; })) return studioWeb(body);
  if (body.tool_choice && body.tool_choice.name === 'juger_site') return critiqueFausse(body);
  if (body.tool_choice && body.tool_choice.name === 'titre_site') { CLAUDE.titres = (CLAUDE.titres || 0) + 1; return rep([tu('titre_site', { titre: /Plomb/i.test(JSON.stringify(body.messages)) ? 'Des fuites réparées proprement' : 'Votre clim posée et entretenue' })], 'tool_use', { input_tokens: 400, output_tokens: 20 }); }
  if (body.tool_choice && body.tool_choice.name === 'ecrire_site') return atelier(body);
  if (body.tool_choice && body.tool_choice.name === 'noter_photos') return vision(body);
  const sys = body.system.map(function (b) { return b.text; }).join('\n');
  const qui = (sys.match(/TA FICHE DE POSTE \(([^,]+),/) || [])[1] || '';
  const last = body.messages[body.messages.length - 1];
  const userText = typeof last.content === 'string' ? last.content : last.content.map(function (b) { return b.text || b.content || ''; }).join('\n');
  const toolResult = typeof last.content !== 'string' && last.content.some(function (b) { return b.type === 'tool_result'; });
  if (/veilleuse GitHub/i.test(sys)) return rep([{ type: 'text', text: '{"resume":"Framework d\'agents.","pourquoi_fort":"très actif","a_reprendre":"la mémoire","pour_quel_agent":"tous","attention":"MIT","score":82}' }], 'end_turn');
  if (qui === 'Maximilien') {
    const prop = (userText.match(/VALIDÉ PAR LOUIS[\s\S]*?\[proposition #(\d+)\]/) || [])[1];
    if (prop) return rep([tu('creer_entreprise', { proposition_id: Number(prop), contexte: 'Conformité Web : audit des sites des Antilles.' }), tu('creer_agent', { nom: 'Bastien', poste: 'DG Conformité Web', chef: 'pdg', entreprise: 'conformite', niveau: 'dg', mission: 'Lancer la conformité.', fiche: 'Fiche test', outils: ['rapporter', 'decider'], modele: 'smart', cadence_min: 720 }), tu('terminer', { resume: 'Conformité Web créée, DG recruté.' })]);
    return rep([tu('assigner', { a: 'dg_novalemo', titre: 'Objectif semaine 1', consigne: '60 aperçus publiés et envoyés, une vente.', echeance_jours: 7 }), tu('strategie', { nouvelle_strategie: 'Priorité 1 : Novalemo en Martinique.', raison: 'lancement' }), tu('terminer', { resume: 'Réunion de lancement faite.' })]);
  }
  if (qui === 'Élise') return rep([tu('assigner', { a: 'dircom_novalemo', titre: 'Cibles', consigne: 'Clim et électricité au Lamentin d\'abord.' }), tu('proposer', { type: 'nouvel_agent', titre: 'Recruter un vérificateur d\'emails', justification: 'Moins de rebonds.' }), tu('terminer', { resume: 'Consignes données, 1 proposition.' })]);
  if (qui === 'Chloé') {
    if (!toolResult) return rep([tu('lister_leads', { statut: 'a_contacter', pret: true, limite: 5 })]);
    const r = dernierResultat(last);
    if (!Array.isArray(r)) return rep([tu('terminer', { resume: 'Emails écrits.' })]);
    // six emails dans 3 000 jetons : la réponse est coupée au milieu de l'outil (vu en production le 6 nov.)
    if (CLAUDE.chloeCoupe > 0) { CLAUDE.chloeCoupe--; CLAUDE.chloePremier = body.max_tokens; return rep([{ type: 'tool_use', id: 'tu_coupe_chloe', name: 'rediger_emails', input: {} }], 'max_tokens', { output_tokens: 600 }); }
    if (CLAUDE.chloeCoupe !== undefined) CLAUDE.chloeMax = body.max_tokens;
    return rep([tu('rediger_emails', { emails: r.slice(0, 6).map(function (l, k) {
      const lien = /^https?:/.test(String(l.apercu || '')) ? l.apercu : null;
      // une ouverture propre à chacun (le contrôle refuse la même première phrase que dans un email récent)
      const m = String(l.metier || l.secteur || 'votre métier').toLowerCase(), ou = l.commune ? 'à ' + l.commune : 'en Martinique';
      // (huit ouvertures tournées sur toute la simulation, puis la même avec un mot de plus : deux emails ne commencent
      // jamais pareil, quel que soit l'ordre des numéros de prospects, qui dépend des agents passés en parallèle)
      const tour = OUVERTURES.n++;
      const ouverture = [
        'En cherchant ' + m + ' ' + ou + ', je suis tombé sur ' + l.nom + ', mais pas sur un site.',
        l.nom + ' apparaît sur Google pour ' + m + ' ' + ou + ', sans site derrière.',
        'Un client qui cherche ' + m + ' ' + ou + ' trouve ' + l.nom + ' sans pouvoir voir votre travail.',
        'J\'ai regardé qui fait ' + m + ' ' + ou + ' : ' + l.nom + ' n\'a pas encore de site.',
        'Votre fiche Google pour ' + m + ' ' + ou + ' ne mène vers aucune page qui montre ' + l.nom + '.',
        'Quand on tape ' + m + ' ' + ou + ', on trouve ' + l.nom + ' mais rien pour découvrir vos services.',
        l.nom + ' a de bons avis pour ' + m + ' ' + ou + ', il ne manque qu\'un site pour les montrer.',
        'Pour ' + m + ' ' + ou + ', ' + l.nom + ' sort sur Google, mais sans site à visiter.'
      ][tour % 8].replace(/\.$/, ['.', ', je l\'ai vu ce matin.', ', je l\'ai vu cette semaine.', ', je l\'ai remarqué hier.', ', je l\'ai vu en passant.', ', je l\'ai noté aujourd\'hui.'][Math.floor(tour / 8) % 6]);
      return { lead_id: l.id, objet: 'Le site de ' + l.nom, angle: lien ? 'apercu' : 'conformite', corps: 'Bonjour,\n\n' + ouverture + '\n\n' + (lien ? 'J\'ai préparé un aperçu de ce que pourrait être le vôtre : ' + lien + '\n\n' : 'Je peux vous préparer un aperçu gratuit de votre futur site.\n\n') + 'Tout est inclus : la création, la mise en ligne sur votre nom de domaine et l\'hébergement la première année. Le site vous appartient, sans abonnement obligatoire, et tout reste modifiable : textes, photos, couleurs.\n\nJe le mets en ligne pour vous ?\n\nLouis\nNovalemo, sites internet en Martinique' };
    }) }), tu('terminer', { resume: Math.min(6, r.length) + ' emails.' })]);
  }
  if (qui === 'Emma') {
    if (!toolResult) return rep([tu('lister_reponses', {})]);
    const res = dernierResultat(last);
    if (res && res.erreur && /REFUS/.test(res.erreur)) return rep([tu('classer_reponse', { reponse_id: EMMA.dernier, intention: 'interesse', note: 'Veut être rappelé, on reste par email.' }), tu('repondre', { reponse_id: EMMA.dernier, corps: 'Bonjour Monsieur Dupont,\n\nMerci pour votre retour. Pour aller plus vite, tout se règle ici par email : je réponds à toutes vos questions. La formule Vitrine est à 990 € en une fois, sans abonnement. Voulez-vous que je vous prépare la commande ?\n\n' + signeEmma() }), tu('terminer', { resume: 'Réponse réécrite après le contrôle.' })]);
    if (res && res.lien_paiement) return rep([tu('repondre', { reponse_id: Number((userText.match(/"reponse_id":(\d+)/) || [])[1]) || EMMA.dernier, corps: 'Bonjour,\n\nParfait, c\'est noté pour la formule Vitrine. En une fois (990 €) : ' + res.lien_paiement + (res.lien_mensuel ? '\nOu au mois (89 € par mois, engagement 12 mois) : ' + res.lien_mensuel : '') + '\n\nLe site sera mis en ligne sur ' + (res.domaine || 'votre nom de domaine') + ' dès le paiement, en général dans l\'heure, et vous recevrez la facture par email.\n\n' + signeEmma() }), tu('terminer', { resume: 'Commande envoyée.' })]);
    if (typeof res === 'string' && /site modifié/.test(res)) return rep([tu('repondre', { reponse_id: EMMA.dernier, corps: 'Bonjour,\n\nC\'est fait : vos horaires sont ajoutés et la couleur a changé. Vous verrez la nouvelle version sur le même lien d\'ici une demi-heure. Elle vous plaît ainsi ?\n\n' + signeEmma() }), tu('terminer', { resume: 'Retouche faite.' })]);
    if (!Array.isArray(res) || !res.length) return rep([tu('terminer', { resume: 'Aucune réponse.' })]);
    const r = res[0];
    EMMA.dernier = r.id;
    EMMA.ia = /^non/.test(String(r.sait_que_tu_es_une_ia || ''));
    const msg = r.leur_message || '';
    const lid = r.entreprise && r.entreprise.lead_id;
    if (/je prends|on y va|ok pour/i.test(msg)) return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'interesse', note: 'Prend la Vitrine.' }), tu('commande', { reponse_id: r.id, formule: 'vitrine', domaine: (msg.match(/[a-z0-9-]+\.(com|fr)/i) || [])[0] })]);
    if (/changer|ajouter|couleur|horaires/i.test(msg)) return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'question', note: 'Veut des retouches.' }), tu('modifier_site', { reponse_id: r.id, images: /logo/i.test(msg) ? 'logo' : 'aucune', demande: 'Ajouter les horaires (lundi au vendredi, 7 h 30 à 17 h) et passer sur une couleur turquoise.' })]);
    if (/appel|appeler|téléphone/i.test(msg) && EMMA.tentatives++ === 0) return rep([tu('repondre', { reponse_id: r.id, corps: 'Bonjour Monsieur Dupont,\nAvec plaisir. Je vous appelle demain en fin de matinée ou jeudi après-midi ?\nLouis\n+590 691 25 34 49' })]);
    return rep([tu('classer_reponse', { reponse_id: r.id, intention: 'interesse', note: 'Demande le prix.' }), tu('repondre', { reponse_id: r.id, corps: 'Bonjour Monsieur Dupont,\n\nMerci pour votre retour. La formule Vitrine est à 990 € en une fois, sans abonnement : le site de plusieurs pages, sa mise en ligne et l\'hébergement la première année. Tout se règle ici par email pour aller plus vite. Je vous prépare la commande ?\n\n' + signeEmma() }), tu('terminer', { resume: 'Réponse envoyée à ' + r.de })]);
  }
  // Colette, pôle écriture : remplace une variante à retirer par une nouvelle idée, sinon laisse tourner les tests
  if (qui === 'Colette') {
    if (!toolResult) return rep([tu('tests_ecriture', {})]);
    const r = dernierResultat(last);
    const ar = r && r.variantes && r.variantes.find(function (v) { return v.verdict === 'a_retirer'; });
    if (ar) return rep([tu('regler_ecriture', { retirer: ar.id, ajouter: { nom: 'Trois lignes', consigne: 'Trois lignes seulement : ce que tu as vu sur lui, le lien de son aperçu, puis la question finale en un mot. Pas de prix dans ce premier email.' }, note: 'La variante ' + ar.id + ' fait nettement moins répondre.' }), tu('terminer', { resume: 'Variante ' + ar.id + ' remplacée.' })]);
    return rep([tu('terminer', { resume: 'Tests suivis, rien à changer.' })]);
  }
  if (qui === 'Alan' || qui === 'Malik' || qui === 'Lucie' || qui === 'Adam') return rep([tu('livrer', { type: qui === 'Malik' ? 'idee' : qui === 'Adam' ? 'niche' : 'veille', titre: 'Livrable de ' + qui, contenu: 'Contenu.', score: 70 }), tu('terminer', { resume: 'Un livrable.' })], 'tool_use', { server_tool_use: { web_search_requests: 2 } });
  if (qui === 'Clara') return rep([tu('livrer', { type: 'script', titre: 'Comment marche une serrure', contenu: 'Script.' }), tu('terminer', { resume: 'Un script.' })]);
  return rep([tu('apprendre', { lecon: 'Leçon de ' + qui, poids: 5 }), tu('terminer', { resume: 'Passage de ' + qui })]);
}
const EMMA = { dernier: null, tentatives: 0, ia: false };
// Emma signe « Emma » ; la ligne IA seulement pour quelqu'un qui n'a jamais été prévenu (champ sait_que_tu_es_une_ia)
function signeEmma() { return (EMMA.ia ? 'Emma, l\'assistante IA de Louis' : 'Emma') + '\nNovalemo, sites internet en Martinique'; }

/* ── une fausse image JPEG (en-tête SOF0 lisible : 1200 x 800) ── */
function jpeg(l, h, graine, texte) {
  const b = Buffer.alloc(2400, graine || 7);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xc0; b.writeUInt16BE(17, 4); b[6] = 8; b.writeUInt16BE(h, 7); b.writeUInt16BE(l, 9);
  if (texte) b.write(String(texte).slice(0, 300), 64, 'latin1');
  return b;
}

/* ── faux Vercel ── */
const VERCEL = { projets: { prj_tour: { id: 'prj_tour', name: 'btprecruit-crm', ssoProtection: { deploymentType: 'all_except_custom_domains' } } }, env: {}, valeurs: {}, pirate: null, envEchec: new Set(), redemarrages: [], fichiers: new Set(), deploiements: [], domaines: {}, commandes: {}, achats: [], autoRenew: {}, autoRenewEchecs: 0, echecs: new Set(), ailleurs: new Set(), auCompte: new Set(), pris: new Set(), manquantUneFois: true };
function vercel(url, opts) {
  const u = new URL(url), m = (opts && opts.method) || 'GET', p = u.pathname;
  const j = function (code, obj) { return { ok: code < 300, status: code, text: async function () { return JSON.stringify(obj); }, json: async function () { return obj; } }; };
  let corps = null; try { corps = opts && opts.body && !Buffer.isBuffer(opts.body) ? JSON.parse(opts.body) : null; } catch (e) { corps = null; }
  if (p === '/v2/teams') return j(200, { teams: [{ id: 'team_test', slug: 'louis' }] });
  let r;
  const pirate = /pirate/.test(String((opts && opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || ''));
  if (pirate) VERCEL.appelsPirate = (VERCEL.appelsPirate || []).concat([m + ' ' + p + u.search]);
  if ((r = p.match(/^\/v9\/projects\/([^/]+)$/)) && m === 'GET') {
    if (pirate) { const n = decodeURIComponent(r[1]); return n === 'btprecruit-crm' || n === 'prj_pirate' ? j(200, { id: 'prj_pirate', name: 'btprecruit-crm' }) : j(404, { error: { code: 'not_found', message: 'Project not found' } }); }
    const pr = Object.values(VERCEL.projets).find(function (x) { return x.id === r[1] || x.name === decodeURIComponent(r[1]); }); return pr ? j(200, pr) : j(404, { error: { code: 'not_found', message: 'Project not found' } });
  }
  if (p === '/v11/projects' && m === 'POST') { const pr = { id: 'prj_sites', name: corps.name, ssoProtection: corps.ssoProtection }; VERCEL.projets[pr.id] = pr; return j(200, pr); }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)$/)) && m === 'PATCH') { const pr = VERCEL.projets[r[1]]; Object.assign(pr, corps); return j(200, pr); }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/domains$/))) return j(200, { domains: [{ name: 'novalemo-martinique.vercel.app' }].concat(Object.keys(VERCEL.domaines).map(function (d) { return { name: d }; })) });
  if (p === '/v2/files' && m === 'POST') { VERCEL.fichiers.add(opts.headers['x-vercel-digest']); return j(200, {}); }
  if (p === '/v13/deployments' && m === 'POST' && corps && corps.deploymentId) { VERCEL.redemarrages.push(corps); const id = 'dpl_redemarrage_' + VERCEL.redemarrages.length; VERCEL.enCours = (VERCEL.enCours || []).concat([{ uid: id, state: 'BUILDING', meta: corps.meta || {} }]); return j(200, { id: id, url: 'tour.vercel.app' }); }
  if ((r = p.match(/^\/v10\/projects\/([^/]+)\/env$/)) && m === 'POST') {
    if (!/upsert=true/.test(u.search)) return j(400, { error: { message: 'exists' } });
    const lot = Array.isArray(corps) ? corps : [corps], crees = [], rates = [];
    lot.forEach(function (c) { if (VERCEL.envEchec.has(c.key)) { rates.push({ error: { key: c.key, message: 'refusé' } }); return; } VERCEL.env[c.key] = { type: c.type, target: c.target, projet: r[1], longueur: String(c.value || '').length }; VERCEL.valeurs[c.key] = String(c.value || ''); crees.push({ key: c.key }); });
    VERCEL.ecrituresEnv = (VERCEL.ecrituresEnv || 0) + 1;
    crees.forEach(function (c) { VERCEL.env[c.key].id = 'env_' + c.key; });
    return j(200, Array.isArray(corps) ? { created: crees, failed: rates } : { created: crees[0] });
  }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/env$/)) && m === 'GET') return j(200, { envs: Object.keys(VERCEL.env).map(function (k) { return { id: VERCEL.env[k].id || 'env_' + k, key: k, target: VERCEL.env[k].target, type: VERCEL.env[k].type }; }) });
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/env\/([^/]+)$/)) && m === 'DELETE') { const k = Object.keys(VERCEL.env).find(function (x) { return (VERCEL.env[x].id || 'env_' + x) === decodeURIComponent(r[2]); }); if (k) delete VERCEL.env[k]; return j(200, {}); }
  if (p === '/v6/deployments' && m === 'GET') {
    if (/BUILDING/.test(u.searchParams.get('state') || '')) return j(200, { deployments: (VERCEL.enCours || []).filter(function (d) { return !d.annule; }) });
    return j(200, { deployments: [{ uid: 'dpl_tour_prod', name: 'btprecruit-crm', state: 'READY' }] });
  }
  if ((r = p.match(/^\/v12\/deployments\/([^/]+)\/cancel$/)) && m === 'PATCH') { const d = (VERCEL.enCours || []).find(function (x) { return x.uid === decodeURIComponent(r[1]); }); if (d) d.annule = true; return j(200, { id: r[1], readyState: 'CANCELED' }); }
  if (p === '/v2/user') return j(200, { user: { id: 'u1' } });
  if (p === '/v13/deployments' && m === 'POST') {
    const manquants = corps.files.filter(function (f) { return f.sha && !VERCEL.fichiers.has(f.sha); }).map(function (f) { return f.sha; });
    if (manquants.length) return j(400, { error: { code: 'missing_files', message: 'Missing files', missing: manquants } });
    const d = { id: 'dpl_' + (VERCEL.deploiements.length + 1), url: 'novalemo-martinique-' + (VERCEL.deploiements.length + 1) + '.vercel.app', readyState: 'READY', files: corps.files };
    VERCEL.deploiements.push(d); return j(200, d);
  }
  if ((r = p.match(/^\/v13\/deployments\/([^/]+)$/))) { const d = VERCEL.deploiements.find(function (x) { return x.id === r[1]; }); return j(200, { readyState: d ? d.readyState : 'ERROR', url: d && d.url, alias: [] }); }
  if ((r = p.match(/^\/v10\/projects\/([^/]+)\/domains$/)) && m === 'POST') {
    if (VERCEL.ailleurs.has(corps.name)) return j(409, { error: { code: 'domain_already_in_use', message: 'Domain is already in use by another project' } });
    if (VERCEL.domaines[corps.name]) return j(400, { error: { code: 'domain_already_in_use', message: 'Domain already exists on this project' } });
    VERCEL.domaines[corps.name] = corps; return j(200, { name: corps.name, verified: true });
  }
  if ((r = p.match(/^\/v9\/projects\/([^/]+)\/domains\/([^/]+)$/)) && m === 'GET') { const d = decodeURIComponent(r[2]); return VERCEL.domaines[d] ? j(200, { name: d, apexName: d.replace(/^www\./, ''), projectId: r[1], verified: true }) : j(404, { error: { code: 'not_found', message: 'Domain not found' } }); }
  if ((r = p.match(/^\/v5\/domains\/([^/]+)$/)) && m === 'GET') { const d = decodeURIComponent(r[1]); const ok = VERCEL.auCompte.has(d) || Object.values(VERCEL.commandes).some(function (c) { return c.status === 'completed' && c.domains[0].domainName === d; }); return ok ? j(200, { domain: { name: d, boughtAt: Date.now(), serviceType: 'zeit.world', renew: true } }) : j(404, { error: { code: 'not_found', message: 'Domain not found' } }); }
  if ((r = p.match(/^\/v6\/domains\/([^/]+)\/config$/))) return j(200, { misconfigured: !VERCEL.domaines[decodeURIComponent(r[1])] });
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/availability$/))) { const d = decodeURIComponent(r[1]); return j(200, { available: !/^clim-eole-martinique\.com$/.test(d) && !/pris/.test(d) && !VERCEL.pris.has(d) && !VERCEL.auCompte.has(d) }); }
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/price$/))) { const d = decodeURIComponent(r[1]); if (/\.fr$/.test(d)) return j(400, { error: { code: 'tld_not_supported' } }); return j(200, { years: 1, purchasePrice: 12.03, renewalPrice: 12.03, transferPrice: 12.03 }); }
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/buy$/)) && m === 'POST') { const d = decodeURIComponent(r[1]); VERCEL.achats.push({ domaine: d, corps: corps }); const id = 'ord_' + VERCEL.achats.length; VERCEL.commandes[id] = { orderId: id, status: VERCEL.echecs.has(d) ? 'failed' : 'completed', domains: [{ domainName: d }] }; return j(200, { orderId: id, _links: {} }); }
  if ((r = p.match(/^\/v1\/registrar\/orders\/([^/]+)$/))) return j(200, VERCEL.commandes[r[1]] || { status: 'failed' });
  if ((r = p.match(/^\/v1\/registrar\/domains\/([^/]+)\/auto-renew$/)) && m === 'PATCH') { if (VERCEL.autoRenewEchecs > 0) { VERCEL.autoRenewEchecs--; return j(500, { error: { code: 'internal', message: 'Temporary error' } }); } VERCEL.autoRenew[decodeURIComponent(r[1])] = !!corps.autoRenew; return j(200, {}); }
  return j(404, { error: { code: 'not_found', message: 'inconnu ' + m + ' ' + p } });
}

/* ── faux Stripe ── */
const STRIPE = { prix: [], liens: [], payes: {}, desactives: [], rembourses: [], abonnements: {}, factures: [], annules: [], pieds: {}, appels: 0, parLien: 0, globales: 0, listeEnPanne: false, annulerEchecs: 0, rembourserEchecs: 0, facturesAnnulees: [] };
function stripe(url, opts) {
  const u = new URL(url), m = (opts && opts.method) || 'GET', p = u.pathname;
  const j = function (code, obj) { return { ok: code < 300, status: code, json: async function () { return obj; } }; };
  const params = new URLSearchParams(m === 'GET' ? u.search : (opts.body || ''));
  let r;
  if (p === '/v1/prices' && m === 'POST') { const x = { id: 'price_' + (STRIPE.prix.length + 1), unit_amount: Number(params.get('unit_amount')), recurring: params.get('recurring[interval]') || null }; STRIPE.prix.push(x); return j(200, x); }
  if (p === '/v1/payment_links' && m === 'POST') {
    const pr = STRIPE.prix.find(function (y) { return y.id === params.get('line_items[0][price]'); }) || {};
    if (pr.recurring && (params.get('invoice_creation[enabled]') || params.get('customer_creation'))) return j(400, { error: { message: 'invoice_creation et customer_creation : paiement unique seulement' } });
    if (!pr.recurring && params.get('subscription_data[description]')) return j(400, { error: { message: 'subscription_data exige un prix récurrent' } });
    const x = { id: 'plink_' + (STRIPE.liens.length + 1), url: 'https://buy.stripe.com/test_' + (STRIPE.liens.length + 1), params: Object.fromEntries(params), mensuel: !!pr.recurring, montant: pr.unit_amount };
    STRIPE.liens.push(x); return j(200, x);
  }
  if (p === '/v1/subscriptions' && m === 'GET') { const tous = Object.values(STRIPE.abonnements); return j(200, { data: tous, has_more: false }); }
  if ((r = p.match(/^\/v1\/subscriptions\/([^/]+)$/)) && m === 'GET') { const a = STRIPE.abonnements[r[1]]; return a ? j(200, a) : j(404, { error: { code: 'resource_missing', message: 'No such subscription' } }); }
  if ((r = p.match(/^\/v1\/subscriptions\/([^/]+)$/)) && m === 'POST') { const a = STRIPE.abonnements[r[1]]; if (!a) return j(404, { error: { message: 'no such subscription' } }); if (params.get('cancel_at_period_end') === 'true') a.cancel_at_period_end = true; if (params.get('cancel_at')) { a.cancel_at = Number(params.get('cancel_at')); a.proration_behavior = params.get('proration_behavior'); } return j(200, a); }
  if ((r = p.match(/^\/v1\/subscriptions\/([^/]+)$/)) && m === 'DELETE') { const a = STRIPE.abonnements[r[1]]; if (!a) return j(404, { error: { message: 'no such subscription' } }); if (STRIPE.annulerEchecs > 0) { STRIPE.annulerEchecs--; return j(500, { error: { message: 'temporary error' } }); } a.status = 'canceled'; a.canceled_at = Math.floor(Date.now() / 1000); a.cancellation_details = { reason: 'cancellation_requested' }; STRIPE.annules.push(a.id); return j(200, a); }
  if ((r = p.match(/^\/v1\/customers\/([^/]+)$/)) && m === 'POST') { STRIPE.pieds[r[1]] = params.get('invoice_settings[footer]'); return j(200, { id: r[1] }); }
  if (p === '/v1/invoices' && m === 'GET') { const gte = Number(params.get('created[gte]') || 0), st = params.get('status'), sub = params.get('subscription'); return j(200, { data: STRIPE.factures.filter(function (f) { return (!st || f.status === st) && f.created >= gte && (!sub || f.subscription === sub); }).map(function (f) { return Object.assign({ status_transitions: { paid_at: f.status === 'paid' ? (f.paye_le || f.created) : null }, payment_intent: 'pi_' + f.id }, f); }), has_more: false }); }
  if ((r = p.match(/^\/v1\/invoices\/([^/]+)\/void$/)) && m === 'POST') { const f = STRIPE.factures.find(function (y) { return y.id === r[1]; }); if (!f || f.status !== 'open') return j(400, { error: { message: 'You can only void an open invoice' } }); f.status = 'void'; STRIPE.facturesAnnulees.push(f.id); return j(200, f); }
  if ((r = p.match(/^\/v1\/payment_links\/([^/]+)$/)) && m === 'POST') { STRIPE.desactives.push(r[1]); return j(200, { id: r[1], active: false }); }
  if (p === '/v1/account' && m === 'GET') { const k = (opts.headers && opts.headers.Authorization) || ''; return j(200, { id: /autre_compte/.test(k) ? 'acct_2' : 'acct_1', charges_enabled: !/inactif/.test(k), details_submitted: true }); }
  if (p === '/v1/refunds' && m === 'POST') { if (STRIPE.rembourserEchecs > 0) { STRIPE.rembourserEchecs--; return j(500, { error: { message: 'temporary error' } }); } STRIPE.rembourses.push(params.get('payment_intent') || params.get('charge')); return j(200, { id: 're_' + STRIPE.rembourses.length, status: 'succeeded' }); }
  if (p === '/v1/checkout/sessions') {
    STRIPE.appels++;
    const l = params.get('payment_link');
    if (l) { STRIPE.parLien++; const s = STRIPE.payes[l]; return j(200, { data: s ? [s] : [], has_more: false }); }
    if (STRIPE.listeEnPanne) return j(500, { error: { message: 'Stripe indisponible' } });
    STRIPE.globales++;
    const gte = Number(params.get('created[gte]') || 0);
    const tous = Object.values(STRIPE.payes).filter(function (x) { return (x.created || 0) >= gte; }).sort(function (a, b) { return b.created - a.created; });
    const apres = params.get('starting_after'), lim = Number(params.get('limit') || 10);
    const debut = apres ? tous.findIndex(function (x) { return x.id === apres; }) + 1 : 0;
    const page = tous.slice(debut, debut + lim);
    return j(200, { data: page, has_more: debut + lim < tous.length });
  }
  if ((r = p.match(/^\/v1\/invoices\/([^/]+)$/))) { const f = STRIPE.factures.find(function (y) { return y.id === r[1]; }); return j(200, { id: r[1], number: 'NOVA-0001', hosted_invoice_url: 'https://invoice.stripe.com/i/test_' + r[1], invoice_pdf: 'https://pay.stripe.com/pdf/' + r[1], status: f ? f.status : 'paid', payment_intent: f ? 'pi_' + r[1] : null }); }
  return j(404, { error: { message: 'inconnu ' + p } });
}
// un paiement abouti sur ce lien : la session porte le lien et ses métadonnées (comme chez Stripe)
function payer(lien, extra) {
  const lk = STRIPE.liens.find(function (x) { return x.id === lien; });
  const meta = lk ? { site_id: lk.params['metadata[site_id]'], origine: lk.params['metadata[origine]'] } : {};
  const base = { id: 'cs_' + lien, livemode: true, payment_link: lien, metadata: meta, payment_intent: 'pi_' + lien, payment_status: 'paid', status: 'complete', mode: 'payment', amount_total: 99000, customer: 'cus_' + lien, customer_details: { email: 'jean@climeole.fr', name: 'Jean Dupont', address: { city: 'Le Lamentin', country: 'MQ' } }, invoice: 'in_1', custom_fields: [], created: Math.floor(Date.now() / 1000) };
  if (lk && lk.mensuel) {
    // abonnement : la session crée l'abonnement et sa première facture, payée ; pas d'intention sur la session
    const sub = 'sub_' + lien, inv = 'in_' + sub + '_1';
    Object.assign(base, { mode: 'subscription', subscription: sub, payment_intent: null, invoice: inv, amount_total: lk.montant });
    STRIPE.abonnements[sub] = { id: sub, status: 'active', customer: 'cus_' + lien, latest_invoice: inv, cancel_at_period_end: false, cancel_at: null, billing_cycle_anchor: base.created, start_date: base.created, current_period_end: Math.floor((Date.now() + 30 * 86400000) / 1000), metadata: meta, created: base.created };
    STRIPE.factures.push({ id: inv, subscription: sub, status: 'paid', amount_paid: lk.montant, billing_reason: 'subscription_create', created: base.created, number: 'NOVA-S1', hosted_invoice_url: 'https://invoice.stripe.com/i/' + inv });
  }
  STRIPE.payes[lien] = Object.assign(base, extra || {});
}
// un mois de plus sur un abonnement : facture payée (ou refusée)
function mois(sub, ok) {
  const a = STRIPE.abonnements[sub];
  const n = STRIPE.factures.filter(function (f) { return f.subscription === sub; }).length + 1;
  const inv = 'in_' + sub + '_' + n;
  STRIPE.factures.push({ id: inv, subscription: sub, status: ok === false ? 'open' : 'paid', amount_paid: ok === false ? 0 : (STRIPE.factures.find(function (f) { return f.subscription === sub; }) || {}).amount_paid, billing_reason: 'subscription_cycle', created: Math.floor(Date.now() / 1000), number: 'NOVA-S' + n, hosted_invoice_url: 'https://invoice.stripe.com/i/' + inv });
  a.latest_invoice = inv; a.status = ok === false ? 'past_due' : 'active'; a.current_period_end = Math.floor((Date.now() + 30 * 86400000) / 1000);
  return inv;
}

const PAGE = '<html><head><title>Clim Pro 972</title><meta name="viewport" content="width=device-width"><meta property="og:image" content="/images/atelier.jpg"></head><body>Climatisation au Lamentin : installation, entretien, dépannage. Contact : contact@climpro972.fr <img src="/images/logo.png" alt="logo Clim Pro" class="logo"><img src="/images/chantier1.jpg" alt="Pose d\'une clim"><img src="/images/chantier2.jpg" alt="Entretien"><a href="/contact">Contact</a> © 2018 <style>.b{color:#e30613}.c{color:#e30613}.d{color:#e30613}</style></body></html>';
/* ── faux Kapso (WhatsApp) ── */
const KAPSO = { recus: [], envoyes: [], fenetreFermee: new Set() };
function kapso(url, opts) {
  const u = new URL(url), m = (opts && opts.method) || 'GET';
  const j = function (code, obj) { return { ok: code < 300, status: code, json: async function () { return obj; } }; };
  if (!opts || !opts.headers || !opts.headers['X-API-Key']) return j(401, { error: { message: 'missing key' } });
  if (/^\/storage\/media\//.test(u.pathname)) { const b = jpeg(900, 700, 11); return { ok: true, status: 200, headers: { get: function (h) { return /content-type/i.test(h) ? 'image/jpeg' : null; } }, arrayBuffer: async function () { return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } }; }
  if (/\/messages$/.test(u.pathname) && m === 'GET') {
    const depuis = u.searchParams.get('since');
    return j(200, { data: KAPSO.recus.filter(function (x) { return !depuis || new Date(Number(x.timestamp) * 1000).toISOString() >= depuis; }), paging: { cursors: {} } });
  }
  if (/\/messages$/.test(u.pathname) && m === 'POST') {
    const c = JSON.parse(opts.body);
    if (KAPSO.fenetreFermee.has(c.to || c.recipient)) return j(422, { error: { message: 'Re-engagement message', code: 131047 } });
    if (!c.to && !c.recipient) return j(400, { error: { message: 'to or recipient required' } });
    KAPSO.envoyes.push(c); return j(200, { messaging_product: 'whatsapp', contacts: [{ wa_id: c.to || null, user_id: c.recipient || null }], messages: [{ id: 'wamid.' + KAPSO.envoyes.length }] });
  }
  return j(404, { error: { message: 'inconnu' } });
}
function recuWhatsApp(de, texte, nom, ilYaMin, extra) { const t = Math.floor((Date.now() - (ilYaMin || 0) * 60000) / 1000); const m = { id: 'wamid.in' + (KAPSO.recus.length + 1), from: de ? String(de).replace(/[^\d]/g, '') : undefined, timestamp: String(t), type: 'text', text: { body: texte }, kapso: { direction: 'inbound', contact_name: nom || null } }; KAPSO.recus.push(Object.assign(m, extra || {})); return m; }

/* ── faux Pexels (photos d'illustration) et fausse banque Picsum ── */
const PEXELS = { recherches: [], refus: false, quotaApres: null };
function pexels(url, opts) {
  const u = new URL(url);
  if (!opts || !opts.headers || !opts.headers.Authorization) return { ok: false, status: 401, json: async function () { return { error: 'unauthorized' }; } };
  if (PEXELS.refus || opts.headers.Authorization === 'mauvaise') return { ok: false, status: 401, json: async function () { return {}; } };
  const q = u.searchParams.get('query') || '';
  if (PEXELS.quotaApres !== null && PEXELS.recherches.length >= PEXELS.quotaApres) return { ok: false, status: 429, json: async function () { return {}; } };
  PEXELS.recherches.push(q);
  const base = Array.from(q).reduce(function (t, c) { return (t * 31 + c.charCodeAt(0)) % 90000; }, 7) + 10000;
  const photos = [0, 1, 2, 3, 4, 5].map(function (k) { const id = base * 10 + k; return { id: id, width: 6000, height: 4000, url: 'https://www.pexels.com/photo/' + id + '/', photographer: 'Photographe ' + k, photographer_url: 'https://www.pexels.com/@p' + k, alt: k === 0 ? 'Smiling man fixing an air conditioner' : 'Close up of ' + q, src: { original: 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg' } }; });
  return { ok: true, status: 200, json: async function () { return { photos: photos, total_results: 6 }; } };
}
// La réponse en flux (server-sent events), découpée en petits morceaux qui coupent les lignes n'importe où, comme sur le
// réseau ; « FLUX_MUET » dans le système : le flux s'ouvre puis ne dit plus rien
async function enFlux(r, corps) {
  CLAUDE.flux = (CLAUDE.flux || 0) + 1;
  const sys = (corps.system || []).map(function (b) { return b.text || ''; }).join(' ');
  if (/FLUX_MUET/.test(sys)) return { ok: true, status: 200, body: new ReadableStream({ start: function (c) { c.enqueue(new TextEncoder().encode('event: ping\ndata: {"type":"ping"}\n\n')); } }) };
  const d = await r.json();
  const u = d.usage || {};
  const ev = [{ type: 'message_start', message: { id: 'msg_flux', type: 'message', role: 'assistant', model: corps.model, content: [], stop_reason: null, usage: { input_tokens: u.input_tokens || 0, cache_read_input_tokens: u.cache_read_input_tokens || 0, cache_creation_input_tokens: u.cache_creation_input_tokens || 0, output_tokens: 1 } } }];
  (d.content || []).forEach(function (b, i) {
    if (b.type === 'tool_use') {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      const j = JSON.stringify(b.input || {});
      for (let k = 0; k < j.length; k += 23) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j.slice(k, k + 23) } });
    } else {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      const t = b.text || '';
      for (let k = 0; k < t.length; k += 17) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t.slice(k, k + 17) } });
    }
    ev.push({ type: 'content_block_stop', index: i });
  });
  ev.push({ type: 'message_delta', delta: { stop_reason: d.stop_reason }, usage: { output_tokens: u.output_tokens || 0 } });
  ev.push({ type: 'message_stop' });
  const octets = new TextEncoder().encode(ev.map(function (e) { return 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n'; }).join(''));
  let pos = 0;
  return { ok: true, status: 200, body: new ReadableStream({ pull: function (c) { if (pos >= octets.length) { c.close(); return; } c.enqueue(octets.slice(pos, pos + 41)); pos += 41; } }) };
}
const PIXABAY = { recherches: [], refus: false };
function pixabay(url) {
  const u = new URL(url);
  if (PIXABAY.refus || u.searchParams.get('key') === 'mauvaise') return { ok: false, status: 400, json: async function () { return {}; }, text: async function () { return '[ERROR 400] Invalid or missing API key'; } };
  const q = u.searchParams.get('q') || '';
  PIXABAY.recherches.push(q);
  const base = Array.from(q).reduce(function (t, c) { return (t * 37 + c.charCodeAt(0)) % 90000; }, 11) + 20000;
  const hits = [0, 1, 2, 3, 4, 5].map(function (k) { const id = base * 10 + k; return { id: id, pageURL: 'https://pixabay.com/photos/' + id + '/', tags: k === 0 ? 'man, worker, smiling' : q.split(' ').join(', '), webformatURL: 'https://pixabay.com/get/pb-' + id + '_640.jpg', largeImageURL: 'https://pixabay.com/get/pb-' + id + '_1280.jpg', imageWidth: 5000, imageHeight: 3333, user: 'Auteur' + k, user_id: 100 + k }; });
  return { ok: true, status: 200, json: async function () { return { total: 6, totalHits: 6, hits: hits }; } };
}
function imageFausse(url, l, h) { const b = jpeg(l, h, Array.from(url).reduce(function (t, c) { return (t * 31 + c.charCodeAt(0)) % 251; }, 7), url); return { ok: true, status: 200, url: url, headers: { get: function (x) { return /content-type/i.test(x) ? 'image/jpeg' : /content-length/i.test(x) ? String(b.length) : null; } }, arrayBuffer: async function () { return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } }; }

global.fetch = async function (url, opts) {
  url = String(url);
  if (url.indexOf('/api/regard') >= 0) return regardFaux(opts);
  if (MIRANDA.pages[url] !== undefined) { const pg = MIRANDA.pages[url]; return pg === 404 ? { ok: false, status: 404, text: async function () { return 'introuvable'; } } : { ok: true, status: 200, url: url, text: async function () { return pg; } }; }
  if (url.indexOf('api.pexels.com') >= 0) return pexels(url, opts);
  if (url.indexOf('images.pexels.com') >= 0) return imageFausse(url, 1920, 1280);
  // les photos d'une entreprise, servies par son aperçu : p1 assez grande pour le haut de page, les autres plus petites
  if (/\.vercel\.app\/a\/[a-z0-9-]+\/img\/p\d+\./.test(url)) { const n = Number(url.match(/img\/p(\d+)\./)[1]); return imageFausse(url, n === 1 ? 1600 : 900, n === 1 ? 1000 : 600); }
  if (url.indexOf('pixabay.com/api') >= 0) return pixabay(url);
  if (url.indexOf('pixabay.com/get/') >= 0) return imageFausse(url, /_640/.test(url) ? 640 : 1280, /_640/.test(url) ? 427 : 853);
  if (url.indexOf('picsum.photos') >= 0) return imageFausse(url, 1920, 1280);
  if (url.indexOf('api.kapso.ai') >= 0) return kapso(url, opts);
  if (url.indexOf('api.anthropic.com') >= 0) { const corps = JSON.parse(opts.body); const r = await claude(corps); return corps.stream && r && r.ok ? enFlux(r, corps) : r; }
  if (url.indexOf('api.vercel.com') >= 0) return vercel(url, opts);
  if (url.indexOf('api.stripe.com') >= 0) return stripe(url, opts);
  if (url.indexOf('places.googleapis.com') >= 0) {
    return { ok: true, status: 200, json: async function () { return { places: [
      { id: 'p1', displayName: { text: 'Clim Pro 972' }, formattedAddress: 'Zone de la Lézarde, 97232 Le Lamentin, Martinique', internationalPhoneNumber: '+596 696 11 22 33', websiteUri: 'https://climpro972.fr', rating: 4.6, userRatingCount: 30, businessStatus: 'OPERATIONAL', regularOpeningHours: { weekdayDescriptions: ['lundi: 07:30 – 17:00', 'mardi: 07:30 – 17:00'] } },
      { id: 'p2', displayName: { text: 'Froid Services' }, formattedAddress: 'Rue des Arts, 97200 Fort-de-France, Martinique', internationalPhoneNumber: '+596 696 44 55 66', websiteUri: 'https://www.facebook.com/froid', businessStatus: 'OPERATIONAL' },
      { id: 'p3', displayName: { text: 'Carrefour Génipa' }, formattedAddress: '97224 Ducos, Martinique', internationalPhoneNumber: '+596 596 00 00 00', businessStatus: 'OPERATIONAL' },
      { id: 'p4', displayName: { text: 'Plomberie Durand' }, formattedAddress: '97231 Le Robert, Martinique', internationalPhoneNumber: '+596 696 77 88 99', businessStatus: 'OPERATIONAL' },
      { id: 'p5', displayName: { text: 'Clim Gwada' }, formattedAddress: '12 rue X, 97122 Baie-Mahault, Guadeloupe', internationalPhoneNumber: '+590 690 11 22 33', websiteUri: 'https://climgwada.fr', businessStatus: 'OPERATIONAL' }
    ] }; } };
  }
  if (url.indexOf('api.github.com/search') >= 0) return { ok: true, status: 200, json: async function () { return { items: [{ full_name: 'org/agents', html_url: 'https://github.com/org/agents', stargazers_count: 42000, language: 'Python', license: { spdx_id: 'MIT' }, pushed_at: '2026-10-30', description: 'Agents', topics: ['ai-agents'], default_branch: 'main' }] }; } };
  if (url.indexOf('raw.githubusercontent.com') >= 0) return { ok: true, status: 200, text: async function () { return '# Agents\nUn framework.'; } };
  if (url.indexOf('afnic.fr') >= 0) return { ok: true, status: 200, text: async function () { return 'climpro-martinique.fr\nplomberie-gwada.fr\ncasino-777.fr\nboulangerie-paris15.fr\n'; } };
  if (url.indexOf('recherche-entreprises.api.gouv.fr') >= 0) {
    const q = decodeURIComponent((url.match(/q=([^&]+)/) || [])[1] || '');
    const total = url.indexOf('departement=') < 0;
    if (total) return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { total_results: 1, results: [] }; } };
    const fiche = function (siren, nom, nature, commune, cp, adresse, dir) { return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [{ siren: siren, nom_raison_sociale: nature === '1000' ? null : nom, nom_complet: nom, nature_juridique: nature, activite_principale: '43.22B', etat_administratif: 'A', siege: { departement: '972', code_postal: cp, libelle_commune: commune, siret: siren + '00017', adresse: adresse }, dirigeants: dir ? [dir] : [] }] }; } }; };
    if (q.trim() === 'AB') return { ok: false, status: 400, headers: { get: function () { return null; } }, json: async function () { return {}; } };
    if (/clim nord gwada/i.test(q)) return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [{ siren: '732829320', nom_raison_sociale: 'CLIM NORD GWADA', nom_complet: 'CLIM NORD GWADA', nature_juridique: '5710', activite_principale: '43.22B', etat_administratif: 'A', siege: { departement: '971', code_postal: '97122', libelle_commune: 'BAIE-MAHAULT', siret: '73282932000017', adresse: 'ZI DE JARRY 97122 BAIE-MAHAULT' }, matching_etablissements: [{ commune: '97213', code_postal: '97232', libelle_commune: 'LE LAMENTIN', siret: '73282932000025', adresse: 'ZONE DE LA LEZARDE 97232 LE LAMENTIN' }], dirigeants: [{ type_dirigeant: 'personne physique', nom: 'LAMBERT', prenoms: 'Marie', qualite: 'Président de SAS' }] }] }; } };
    if (q.trim() === '912345675') return fiche('912345675', 'CLIM EOLE', '5499', 'LE LAMENTIN', '97232', 'ZONE DE LA LEZARDE 97232 LE LAMENTIN', { type_dirigeant: 'personne physique', nom: 'DUPONT', prenoms: 'Jean', qualite: 'Gérant' });
    if (q.trim() === '552100554') return fiche('552100554', 'JEAN-MARC TELL (SERRURERIE DU NORD)', '1000', 'LE LORRAIN', '97214', 'QUARTIER MORNE BOIS 97214 LE LORRAIN', null);
    if (/^\d{9}$/.test(q.trim())) return fiche(q.trim(), q.trim() === '843217654' ? 'FROID CARAIBES' : 'ENTREPRISE ' + q.trim(), '5499', 'DUCOS', '97224', 'ZONE DE CHAMPIGNY 97224 DUCOS', { type_dirigeant: 'personne physique', nom: 'MARTIN', prenoms: 'Paul', qualite: 'Gérant' });
    if (/froid caraibes/i.test(q)) return fiche('843217654', 'FROID CARAIBES', '5499', 'DUCOS', '97224', 'ZONE DE CHAMPIGNY 97224 DUCOS', { type_dirigeant: 'personne physique', nom: 'MARTIN', prenoms: 'Paul', qualite: 'Gérant' });
    if (/serrurerie du nord|jean-marc tell/i.test(q)) return fiche('552100554', 'JEAN-MARC TELL (SERRURERIE DU NORD)', '1000', 'LE LORRAIN', '97214', 'QUARTIER MORNE BOIS 97214 LE LORRAIN', null);
    if (/clim\s*pro/.test(q) && /972/.test(url)) return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [{ siren: '123456789', nom_raison_sociale: 'CLIMPRO MARTINIQUE', nom_complet: 'CLIMPRO MARTINIQUE', nature_juridique: '5710', categorie_entreprise: 'PME', date_creation: '2026-06-01', activite_principale: '43.22B', etat_administratif: 'A', siege: { departement: '972', code_postal: '97232', libelle_commune: 'LE LAMENTIN', siret: '12345678900011', adresse: 'ZONE DE LA LEZARDE 97232 LE LAMENTIN' }, dirigeants: [{ type_dirigeant: 'personne physique', nom: 'DUPONT', prenoms: 'Jean', qualite: 'Président' }] }] }; } };
    return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { results: [] }; } };
  }
  if (url.indexOf('bodacc') >= 0) {
    const zone972 = /972/.test(decodeURIComponent(url));
    return { ok: true, status: 200, json: async function () { return { results: [{ id: 'b1', commercant: 'SOLAIRE MADININA', ville: 'Le Robert', numerodepartement: '972', dateparution: '2026-10-30', registre: ['987 654 321', '987654321'], listeetablissements: JSON.stringify({ etablissement: { activite: 'Installation de panneaux solaires' } }) }, { id: 'b2', commercant: 'SCI DES PALMIERS', ville: 'Le Diamant', numerodepartement: '972', dateparution: '2026-10-29', registre: ['111 222 333'], listeetablissements: JSON.stringify({ etablissement: { activite: 'Location de logements' } }) }].concat(zone972 ? [] : [{ id: 'b3', commercant: 'SOLAIRE KARUKERA', ville: 'Petit-Bourg', numerodepartement: '971', dateparution: '2026-10-30', registre: ['555 666 777'] }]) }; } };
  }
  // images des sites des prospects
  if (/\.(jpg|png)(\?|$)/.test(url)) {
    const logo = /logo/.test(url);
    const b = logo ? (function () { const x = Buffer.alloc(900, 3); x.writeUInt32BE(0x89504e47, 0); x.writeUInt32BE(240, 16); x.writeUInt32BE(120, 20); return x; })() : jpeg(1200, 800, Array.from(url).reduce(function (t, c) { return (t * 31 + c.charCodeAt(0)) % 251; }, 7));
    return { ok: true, status: 200, url: url, headers: { get: function (h) { return /content-type/i.test(h) ? (logo ? 'image/png' : 'image/jpeg') : /content-length/i.test(h) ? String(b.length) : null; } }, arrayBuffer: async function () { return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } };
  }
  // un site client en ligne (vérification de mise en ligne)
  if (/^https:\/\/(www\.)?[a-z0-9-]+\.com\/$/.test(url) && FAUX_EN_LIGNE.has(new URL(url).hostname)) return { ok: true, status: 200, url: url, text: async function () { return '<html>' + 'x'.repeat(3000) + '</html>'; } };
  // sites web
  const html = /climpro|ifc-guadeloupe|love-dogs/.test(url) ? PAGE.replace('Clim Pro 972', 'Site Studio Novalem') + ' Site réalisé par Studio Novalem' : '<html><body>Bienvenue</body></html>';
  return { ok: true, status: 200, url: url, headers: { get: function (h) { return /content-type/i.test(h) ? 'text/html; charset=utf-8' : null; } }, body: null, text: async function () { return html; } };
};
const FAUX_EN_LIGNE = new Set();

module.exports = { STUDIO: STUDIO, appels: function () { return appelsClaude; }, CLAUDE: CLAUDE, MIRANDA: MIRANDA, VISION: VISION, PEXELS: PEXELS, PIXABAY: PIXABAY, VERCEL: VERCEL, STRIPE: STRIPE, KAPSO: KAPSO, recuWhatsApp: recuWhatsApp, payer: payer, mois: mois, FAUX_EN_LIGNE: FAUX_EN_LIGNE, EMMA: EMMA, jpeg: jpeg };
