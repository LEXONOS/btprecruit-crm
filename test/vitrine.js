// La vitrine de la bibliothèque des rubriques : un petit serveur pour regarder chaque variante et des sites complets,
// sur des fiches d'exemple (huit métiers), avec de vraies polices et des photos (PHOTOS_DIR, sinon des images de
// remplacement). node test/vitrine.js --port=8793 [--photos=/chemin]
//   /                         la liste
//   /site/<exemple>           le site complet de l'exemple (?essai=2 pour un autre tirage, ?force=hero.voile,services.cartes)
//   /variante/<id>/<exemple>  l'en-tête, la variante seule (?surface=champ&fond=grain) et le pied
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
let R = require('../lib/sites/rendu');
let B = require('../lib/sites/rubriques');
let DN = require('../lib/sites/donne');
let C = require('../lib/sites/composition');
// --recharger : les fichiers des sites sont relus à chaque page (on voit ses changements sans redémarrer)
function recharger() {
  const racine = path.join(__dirname, '..', 'lib', 'sites');
  Object.keys(require.cache).forEach(function (k) { if (k.indexOf(racine) === 0) delete require.cache[k]; });
  R = require('../lib/sites/rendu'); B = require('../lib/sites/rubriques'); DN = require('../lib/sites/donne'); C = require('../lib/sites/composition');
}

const arg = function (n, d) { const a = process.argv.find(function (x) { return x.indexOf('--' + n + '=') === 0; }); return a ? a.split('=').slice(1).join('=') : d; };
const PORT = Number(arg('port', 8793));
const PHOTOS = arg('photos', process.env.PHOTOS_DIR || '');
const RECHARGER = process.argv.indexOf('--recharger') >= 0;
const POLICES = path.join(__dirname, '..', 'lib', 'sites', 'polices');

const ph = function (f, l, h, o) { return Object.assign({ fichier: f, l: l || 1800, h: h || 1200, alt: '' }, o || {}); };
const il = function (f, role, extra) { return ph(f, 1800, 1200, Object.assign({ credit: { id: 'px' + f, source: 'Pexels', auteur: 'Photographe', page: 'https://www.pexels.com' }, role: role }, extra || {})); };
const HORAIRES = ['lundi: 07:30 – 17:00', 'mardi: 07:30 – 17:00', 'mercredi: 07:30 – 17:00', 'jeudi: 07:30 – 17:00', 'vendredi: 07:30 – 17:00', 'samedi: 08:00 – 12:00', 'dimanche: Fermé'];
const EXEMPLES = {
  clim: { v: 3, nom: 'Froid Caraïbes', activite: 'Climatisation et froid', metier: 'Climatisation', secteur: 'climatisation', commune: 'Le Lamentin', objectif: 'devis', ton: 'franc', accroche: 'Pose, entretien et dépannage de climatiseurs pour les maisons et les commerces.', appel: 'Une clim à poser ou à réparer ?',
    services: [{ titre: 'Installation', texte: 'Pose de splits et de gainables, propre et dans les règles.', icone: 'flocon' }, { titre: 'Entretien', texte: 'Nettoyage, contrôle du gaz et des filtres, chaque année.', icone: 'cle' }, { titre: 'Dépannage', texte: 'Une clim qui coule, qui chauffe ou qui ne démarre plus.', icone: 'outils' }, { titre: 'Froid commercial', texte: 'Chambres froides et vitrines pour les commerces.', icone: 'flocon' }],
    atouts: [{ titre: 'On explique avant de poser', texte: 'Le bon appareil pour la pièce, sans en vendre trop.', icone: 'bulle' }, { titre: 'Un chantier propre', texte: 'On protège, on nettoie, on repart sans laisser de trace.', icone: 'etincelles' }, { titre: 'Joignable', texte: 'Un numéro, une personne qui connaît votre installation.', icone: 'tel' }],
    etapes: [{ titre: 'Vous écrivez sur WhatsApp', texte: 'Une photo de l\'appareil ou de la pièce suffit pour un premier avis.' }, { titre: 'On passe voir', texte: 'On mesure, on regarde l\'installation et on vous dit ce qui convient.' }, { titre: 'On pose et on règle', texte: 'Chantier protégé, appareil réglé, et on vous montre comment l\'utiliser.' }],
    a_propos: 'Froid Caraïbes pose et entretient les climatiseurs des maisons et des commerces du centre de la Martinique, depuis le Lamentin.',
    faq: [{ q: 'Quelle puissance pour une chambre ?', r: 'Cela dépend de la surface et de l\'exposition : on vient mesurer avant de conseiller un appareil.' }, { q: 'Tous les combien faut-il entretenir ?', r: 'Une fois par an pour une maison, plus souvent près de la mer. Écrivez-nous pour un passage.' }, { q: 'Vous intervenez où ?', r: 'Dans tout le centre et le sud. Pour le nord, demandez-nous.' }],
    contact: { tel: '+596596501020', mobile: '+596696112233', email: 'contact@froid-caraibes.fr', adresse: 'Zone de la Lézarde, Le Lamentin, Martinique', horaires: HORAIRES }, google: { note: 4.8, avis: 37 },
    photos: [il('clim-4.jpg', 'hero'), il('clim-1.jpg', 'apropos'), il('clim-3.jpg', 'service', { pour: 0 }), il('clim-2.jpg', 'service', { pour: 1 }), il('clim-5.jpg', 'service', { pour: 2 }), il('clim-6.jpg', 'service', { pour: 3 })] },
  table: { v: 3, nom: 'Chez Man Ninotte', activite: 'Restaurant créole', metier: 'Restaurant créole', secteur: 'restaurant', commune: 'Le Diamant', objectif: 'reservation', ton: 'chaleureux', accroche: 'Une cuisine créole de famille, face au Rocher du Diamant.', appel: 'Une table pour ce soir ?',
    services: [{ titre: 'Colombo de poulet', texte: 'Mijoté longtemps, riz et légumes pays.', icone: 'couverts' }, { titre: 'Accras de morue', texte: 'Croustillants, servis chauds avec la sauce chien.', icone: 'couverts' }, { titre: 'Poisson grillé', texte: 'La pêche du jour, grillée au feu de bois.', icone: 'couverts' }, { titre: 'Blanc-manger coco', texte: 'Le dessert de la maison, frais et léger.', icone: 'couverts' }],
    atouts: [{ titre: 'Des produits frais', texte: 'Le poisson et les légumes du marché du matin.', icone: 'feuille' }, { titre: 'Une cuisine de famille', texte: 'Les recettes de la grand-mère, sans raccourci.', icone: 'coeur' }, { titre: 'Face à la mer', texte: 'Une terrasse ouverte sur le Rocher du Diamant.', icone: 'vagues' }],
    etapes: [{ titre: 'Vous appelez ou écrivez' }, { titre: 'On garde votre table' }, { titre: 'Vous profitez' }],
    a_propos: 'Chez Man Ninotte sert une cuisine créole de famille sur sa terrasse du Diamant, midi et soir, avec la pêche du jour.',
    faq: [{ q: 'Faut-il réserver ?', r: 'Le soir et le week-end, c\'est plus sûr : appelez ou écrivez sur WhatsApp.' }, { q: 'Avez-vous des plats végétariens ?', r: 'Oui, demandez le plat du jour végétarien, préparé avec les légumes du marché.' }],
    contact: { tel: '+596596765432', mobile: '+596696765432', adresse: 'Route des Anses, Le Diamant, Martinique', horaires: ['lundi: Fermé', 'mardi: 12:00 – 15:00, 19:00 – 22:00', 'mercredi: 12:00 – 15:00, 19:00 – 22:00', 'jeudi: 12:00 – 15:00, 19:00 – 22:00', 'vendredi: 12:00 – 15:00, 19:00 – 23:00', 'samedi: 12:00 – 15:00, 19:00 – 23:00', 'dimanche: 12:00 – 16:00'] }, google: { note: 4.6, avis: 212 },
    photos: [ph('table-1.jpg', 1800, 844, { alt: 'La table' }), ph('table-4.jpg', 1200, 800, { alt: 'Langouste grillée' }), ph('table-2.jpg', 1200, 800, { alt: 'Assiette' }), ph('table-3.jpg', 1200, 800, { alt: 'Plat' }), ph('table-5.jpg', 1200, 800, { alt: 'Poisson' }), ph('table-6.jpg', 1200, 800, { alt: 'Saumon' }), ph('table-7.jpg', 1200, 800, { alt: 'Dessert' })] },
  soin: { v: 3, nom: 'Institut Kalla', activite: 'Institut de beauté', metier: 'Institut de beauté', secteur: 'esthétique', commune: 'Fort-de-France', objectif: 'reservation', ton: 'premium', accroche: 'Soins du visage, du corps et des mains, dans un lieu calme du centre-ville.',
    services: [{ titre: 'Soin du visage', texte: 'Nettoyage, gommage et masque adaptés à votre peau.', icone: 'coeur' }, { titre: 'Massage', texte: 'Un massage du corps aux huiles, pour relâcher les tensions.', icone: 'main' }, { titre: 'Manucure', texte: 'Des mains soignées, vernis classique ou semi-permanent.', icone: 'etincelles' }],
    atouts: [{ titre: 'Un lieu au calme', texte: 'Une cabine à la fois, sans attente.', icone: 'feuille' }, { titre: 'Des produits doux', texte: 'Choisis pour les peaux sensibles et le climat.', icone: 'goutte' }, { titre: 'Sur rendez-vous', texte: 'Votre heure est votre heure.', icone: 'calendrier' }],
    etapes: [{ titre: 'Vous choisissez votre soin' }, { titre: 'On fixe l\'heure ensemble' }, { titre: 'Vous profitez' }],
    a_propos: 'Institut Kalla accueille ses clientes au calme, en plein centre de Fort-de-France, pour des soins du visage, du corps et des mains.',
    faq: [], contact: { mobile: '+596696998877', email: 'bonjour@institut-kalla.fr', horaires: ['lundi: Fermé', 'mardi: 09:00 – 18:00', 'mercredi: 09:00 – 18:00', 'jeudi: 09:00 – 18:00', 'vendredi: 09:00 – 19:00', 'samedi: 09:00 – 16:00', 'dimanche: Fermé'] },
    photos: [il('soin-1.jpg', 'hero'), il('propre-4.jpg', 'apropos')] },
  mer: { v: 3, nom: 'Alizé Catamaran', activite: 'Sorties en catamaran', metier: 'Sorties en catamaran', secteur: 'excursions en bateau', commune: 'Les Trois-Îlets', objectif: 'reservation', ton: 'premium', accroche: 'Des journées en catamaran vers les fonds blancs et les anses du sud.', appel: 'Envie d\'une journée en mer ?',
    services: [{ titre: 'Journée aux fonds blancs', texte: 'Baignade, snorkeling et déjeuner à bord.', icone: 'bateau', photo: 'catamaran turquoise' }, { titre: 'Coucher de soleil', texte: 'Deux heures en mer à l\'heure dorée.', icone: 'soleil' }, { titre: 'Privatisation', texte: 'Le bateau pour votre groupe, à la journée.', icone: 'equipe' }],
    atouts: [{ titre: 'Petits groupes', texte: 'Douze passagers au plus.', icone: 'equipe' }, { titre: 'Un équipage du pays', texte: 'Qui connaît chaque anse.', icone: 'pin' }, { titre: 'Tout est prévu', texte: 'Masques, palmes et repas à bord.', icone: 'check' }],
    etapes: [{ titre: 'Vous choisissez la sortie' }, { titre: 'On confirme la date' }, { titre: 'On largue les amarres' }],
    a_propos: 'Alizé Catamaran emmène de petits groupes vers les fonds blancs et les anses du sud de la Martinique, au départ de la marina des Trois-Îlets.',
    faq: [{ q: 'Que faut-il apporter ?', r: 'Un maillot, une serviette et de la crème solaire. Le reste est à bord.' }, { q: 'Et s\'il fait mauvais ?', r: 'On décale la sortie à une autre date, sans frais.' }],
    contact: { tel: '+596596661122', mobile: '+596696661122', email: 'bord@alize-cata.fr', adresse: 'Marina de la Pointe du Bout, Les Trois-Îlets, Martinique' }, google: { note: 4.9, avis: 154 },
    photos: [il('mer-1.jpg', 'hero'), il('mer-4.jpg', 'apropos'), il('mer-2.jpg', 'service', { pour: 0 }), il('mer-3.jpg', 'service', { pour: 1 }), il('mer-5.jpg', 'service', { pour: 2 }), il('mer-5.jpg', 'bandeau')] },
  garage: { v: 3, nom: 'Garage Racine', activite: 'Garage automobile', metier: 'Garage automobile', secteur: 'garage automobile', commune: 'Ducos', objectif: 'devis', ton: 'franc', accroche: 'Entretien, réparation et pneus pour toutes les marques, à Ducos.',
    services: [{ titre: 'Vidange et entretien', texte: 'Huile, filtres et contrôle complet du véhicule.', icone: 'cle' }, { titre: 'Freins', texte: 'Plaquettes, disques et liquide, vérifiés et changés.', icone: 'outils' }, { titre: 'Pneus', texte: 'Montage, équilibrage et réparation de crevaison.', icone: 'volant' }],
    atouts: [{ titre: 'Le devis avant', texte: 'Rien n\'est fait sans votre accord.', icone: 'devis' }, { titre: 'Les pièces montrées', texte: 'On vous montre ce qui a été changé.', icone: 'outils' }],
    etapes: [{ titre: 'Vous prenez rendez-vous', texte: 'Par téléphone ou sur WhatsApp, à l\'heure qui vous arrange.' }, { titre: 'On regarde et on chiffre', texte: 'Diagnostic sur place et devis expliqué avant toute intervention.' }, { titre: 'On répare', texte: 'Vous récupérez la voiture avec le détail de ce qui a été fait.' }],
    a_propos: 'Le Garage Racine entretient et répare les voitures de toutes marques à Ducos, avec le devis avant chaque intervention.',
    faq: [], contact: { tel: '+596596778899', horaires: HORAIRES }, google: { note: 4.5, avis: 61 },
    photos: [ph('auto-1.jpg', 1800, 1800, { alt: 'L\'atelier' }), ph('auto-4.jpg', 1800, 1800, { alt: 'Voiture' }), ph('auto-2.jpg', 1800, 1982, { alt: 'Pneu' }), ph('auto-3.jpg', 1800, 2000, { alt: 'Vieille voiture' })] },
  conseil: { v: 3, nom: 'Hakai Courtage', activite: 'Courtage en assurances', metier: 'Courtier en assurances', secteur: 'Courtage, services financiers', commune: 'Schœlcher', objectif: 'appel', ton: 'calme', accroche: 'Assurances et prêts pour les particuliers et les petites entreprises, comparés pour vous.',
    services: [{ titre: 'Assurance habitation', texte: 'La bonne couverture pour une maison exposée aux cyclones.', icone: 'maison' }, { titre: 'Prêt immobilier', texte: 'Votre dossier présenté aux banques, le meilleur taux cherché.', icone: 'document' }, { titre: 'Assurance pro', texte: 'Responsabilité, locaux et véhicules de votre entreprise.', icone: 'bouclier' }],
    atouts: [{ titre: 'On compare pour vous', texte: 'Plusieurs assureurs, une seule personne en face.', icone: 'loupe' }, { titre: 'Des mots simples', texte: 'Chaque garantie expliquée avant de signer.', icone: 'bulle' }, { titre: 'Un suivi dans le temps', texte: 'On revient vers vous à chaque échéance.', icone: 'calendrier' }],
    etapes: [{ titre: 'Vous nous appelez' }, { titre: 'On étudie votre dossier' }, { titre: 'Vous choisissez' }],
    a_propos: 'Hakai Courtage compare les assurances et les prêts pour les particuliers et les petites entreprises de Martinique, depuis Schœlcher.',
    faq: [{ q: 'Le courtage coûte-t-il plus cher ?', r: 'Non : notre rémunération est prévue par l\'assureur ou indiquée avant toute signature.' }, { q: 'Combien de temps pour un prêt ?', r: 'Cela dépend des banques. Appelez-nous pour un premier point sur votre projet.' }],
    contact: { email: 'contact@hakai.fr', tel: '+596596123456' }, photos: [] },
  jardin: { v: 3, nom: 'Vert Créole', activite: 'Paysagiste', metier: 'Paysagiste', secteur: 'paysagiste', commune: 'Le François', objectif: 'devis', ton: 'chaleureux', accroche: 'Création et entretien de jardins tropicaux pour les maisons et les résidences.',
    services: [{ titre: 'Création de jardin', texte: 'Plantes du pays, allées et arrosage pensés ensemble.', icone: 'feuille' }, { titre: 'Entretien', texte: 'Tonte, taille et désherbage, au passage qui vous convient.', icone: 'cle' }, { titre: 'Élagage', texte: 'Arbres et palmiers taillés en sécurité avant la saison.', icone: 'outils' }],
    atouts: [{ titre: 'Des plantes du pays', texte: 'Qui aiment le soleil et la pluie d\'ici.', icone: 'feuille' }, { titre: 'Un travail propre', texte: 'Les déchets verts emportés.', icone: 'etincelles' }, { titre: 'Un passage régulier', texte: 'Le même jardinier à chaque fois.', icone: 'calendrier' }],
    etapes: [{ titre: 'Vous nous écrivez' }, { titre: 'On visite le jardin' }, { titre: 'On plante et on entretient' }],
    a_propos: 'Vert Créole crée et entretient des jardins tropicaux pour les maisons et les résidences du François et de la côte atlantique.',
    faq: [{ q: 'Faites-vous l\'arrosage automatique ?', r: 'Oui, on le pose avec le jardin ou sur un jardin existant.' }, { q: 'Emportez-vous les déchets ?', r: 'Oui, les déchets verts partent avec nous à chaque passage.' }],
    contact: { mobile: '+596696223344', email: 'jardin@vert-creole.fr' }, google: { note: 4.7, avis: 23 },
    photos: [il('propre-5.jpg', 'hero'), il('propre-3.jpg', 'apropos')] },
  fleurs: { v: 3, nom: 'Anthurium & Cie', activite: 'Fleuriste', metier: 'Fleuriste', secteur: 'fleuriste', commune: 'Le Robert', objectif: 'visite', ton: 'chaleureux', accroche: 'Bouquets de fleurs du pays, compositions pour les fêtes et les cérémonies.',
    services: [{ titre: 'Bouquets du jour', texte: 'Anthuriums, roses de porcelaine et feuillages du pays.', icone: 'fleur' }, { titre: 'Mariages', texte: 'Le bouquet, la table et l\'église, pensés avec vous.', icone: 'coeur' }, { titre: 'Deuil', texte: 'Gerbes et couronnes, livrées avec soin.', icone: 'fleur' }],
    atouts: [{ titre: 'Des fleurs du pays', texte: 'Cueillies dans les plantations du nord.', icone: 'feuille' }, { titre: 'Livraison', texte: 'Dans tout le nord atlantique.', icone: 'camion' }],
    etapes: [], a_propos: 'Anthurium & Cie compose des bouquets avec les fleurs des plantations de Martinique, dans sa boutique du bourg du Robert.',
    faq: [], contact: { tel: '+596596443322', horaires: ['lundi: 08:00 – 18:00', 'mardi: 08:00 – 18:00', 'mercredi: 08:00 – 18:00', 'jeudi: 08:00 – 18:00', 'vendredi: 08:00 – 18:00', 'samedi: 08:00 – 13:00', 'dimanche: 08:00 – 12:00'] }, google: { note: 4.9, avis: 48 }, photos: [] }
};
function exemple(nom, essai) {
  const sp = JSON.parse(JSON.stringify(EXEMPLES[nom] || EXEMPLES.clim));
  sp.da = DN.donner(sp, { essai: essai || 0 });
  return sp;
}

/* ── images : les vraies (PHOTOS_DIR) ou une image de remplacement aux couleurs du nom ── */
function remplacement(nom) {
  let h = 0; for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = 'hsl(' + (h % 360) + ' 45% 42%)', b = 'hsl(' + ((h >> 8) % 360) + ' 55% 70%)';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="1800" height="1200" fill="url(#g)"/><circle cx="1300" cy="380" r="220" fill="rgb(255 255 255 / .25)"/><path d="M0 900 L500 600 L900 850 L1300 550 L1800 900 V1200 H0z" fill="rgb(0 0 0 / .25)"/><text x="60" y="1140" font-family="sans-serif" font-size="48" fill="#fff">' + nom + '</text></svg>';
}

function pageListe() {
  const v = Object.keys(B.VARIANTES).sort();
  return '<!doctype html><meta charset="utf-8"><title>Vitrine des rubriques</title><style>body{font:15px/1.5 system-ui;margin:24px;max-width:1100px}a{color:#1a4be0}li{margin:2px 0}code{background:#eee;padding:1px 4px}</style><h1>Rubriques (' + v.length + ')</h1>' + (B.ERREURS.length ? '<pre style="color:#b00">' + B.ERREURS.join('\n') + '</pre>' : '') + '<h2>Sites complets</h2><ul>' + Object.keys(EXEMPLES).map(function (e) { return '<li><a href="/site/' + e + '">' + e + '</a> · <a href="/site/' + e + '?essai=1">tirage 2</a> · <a href="/site/' + e + '?essai=2">tirage 3</a></li>'; }).join('') + '</ul><h2>Variantes</h2>' + B.RUBRIQUES.map(function (r) { return '<h3>' + r + ' (' + B.PAR_RUBRIQUE[r].length + ')</h3><ul>' + B.PAR_RUBRIQUE[r].map(function (x) { return '<li><code>' + x.id + '</code> ' + x.nom + ' : ' + Object.keys(EXEMPLES).map(function (e) { return '<a href="/variante/' + x.id + '/' + e + '">' + e + '</a>'; }).join(' ') + '</li>'; }).join('') + '</ul>'; }).join('');
}

// un site complet, ou une variante seule entre l'en-tête et le pied
function rendrePage(chemin, q) {
  const m1 = chemin.match(/^\/site\/([a-z]+)\/?$/), m2 = chemin.match(/^\/variante\/([a-z]+\.[a-z0-9-]+)\/([a-z]+)\/?$/);
  if (!m1 && !m2) return null;
  const nom = m1 ? m1[1] : m2[2];
  const sp = exemple(nom, Number(q.get('essai') || 0));
  const site = { slug: 'vitrine-' + nom, spec: sp };
  const opts = { mode: 'apercu', optimiseur: false, racineImg: '/img/', base: '/site/' + nom + '/', contactNovalemo: 'louis@novalemo.fr' };
  const x = R.contexte(site, opts);
  let compo = C.composer(x.spec, x.ctx, { essai: Number(q.get('essai') || 0) });
  if (q.get('force')) { const ch = {}; q.get('force').split(',').forEach(function (id) { const v = B.VARIANTES[id]; if (v) ch[v.rubrique] = id; }); compo = C.composer(x.spec, x.ctx, { essai: Number(q.get('essai') || 0), choix: ch }); }
  if (m2) {
    const v = B.VARIANTES[m2[1]];
    if (!v) return '<p>Variante inconnue</p>';
    const surf = q.get('surface') || v.surfaces[0];
    const blocs = compo.blocs.filter(function (b) { return b.rubrique === 'nav' || b.rubrique === 'pied'; });
    if (v.rubrique === 'nav' || v.rubrique === 'pied') blocs.forEach(function (b) { if (b.rubrique === v.rubrique) b.id = v.id; });
    const hero = compo.blocs.find(function (b) { return b.rubrique === 'hero'; });
    const corps = v.rubrique === 'nav' ? [hero] : v.rubrique === 'pied' ? [] : v.rubrique === 'hero' ? [{ rubrique: 'hero', id: v.id, surface: surf, fond: q.get('fond') || (surf === 'champ' ? 'maille' : null) }] : [{ rubrique: v.rubrique, id: v.id, surface: surf, fond: q.get('fond') || null }];
    const nav = blocs.find(function (b) { return b.rubrique === 'nav'; });
    if (nav) nav.surPhoto = !!(corps[0] && corps[0].surface === 'photo');
    compo = Object.assign({}, compo, { blocs: [nav].concat(corps).concat(blocs.filter(function (b) { return b.rubrique === 'pied'; })).filter(Boolean) });
  }
  const r = R.rendre(site, Object.assign({}, opts, { compo: compo }));
  let html = r.files[0].data;
  if (r.erreurs.length) html = html.replace('<body', '<body data-erreurs="' + R.esc(r.erreurs.join(' | ')) + '"');
  // ?tout=1 : tout apparaît d'un coup (captures pleine page)
  if (q.get('tout')) html = html.replace('</body>', '<script>document.querySelectorAll("[data-r]").forEach(function(e){e.classList.add("vu")})</script></body>');
  return html;
}

const TYPES = { '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function servir(req, res) {
  const u = new URL(req.url, 'http://x');
  try {
    if (RECHARGER && !/^\/(_f|img)\//.test(u.pathname) && !/\/img\//.test(u.pathname)) recharger();
    if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(pageListe()); }
    if (u.pathname.indexOf('/_f/') === 0) { const f = path.join(POLICES, path.basename(u.pathname)); if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'font/woff2' }); return res.end(fs.readFileSync(f)); } }
    if (/\/img\//.test(u.pathname)) {
      const n = path.basename(u.pathname);
      const f = PHOTOS && path.join(PHOTOS, n);
      if (f && fs.existsSync(f)) { res.writeHead(200, { 'content-type': TYPES[path.extname(n)] || 'application/octet-stream' }); return res.end(fs.readFileSync(f)); }
      res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end(remplacement(n));
    }
    const p = rendrePage(u.pathname.replace(/\/mentions-legales\/?$/, ''), u.searchParams);
    if (p) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(p); }
    res.writeHead(404); res.end('introuvable');
  } catch (e) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end(String(e.stack || e)); }
}

if (require.main === module) http.createServer(servir).listen(PORT, function () { console.log('Vitrine des rubriques : http://localhost:' + PORT + '/ (' + Object.keys(B.VARIANTES).length + ' variantes' + (B.ERREURS.length ? ', ' + B.ERREURS.length + ' erreur(s)' : '') + ')'); });

module.exports = { EXEMPLES, exemple, rendrePage, servir };
