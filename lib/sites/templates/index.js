// Les 40 templates des sites Novalemo (nov. 2026). Un template est un design complet et cohérent : un style (voix,
// angles, filets, teinte de page, boutons, mouvement, lib/sites/templates/styles.js) et, pour chaque rubrique, sa mise
// en scène dans la bibliothèque des sections nouvelle génération (lib/sites/rubriques/x-*.js), avec ses solutions de
// repli quand le contenu manque (pas de photo, pas d'avis...). Chacun est pensé pour des familles de métiers et inspiré
// de ce qui se fait de mieux (Framer, Squarespace, Webflow, sites d'agences et d'artisans européens) ; aucun n'est noir.
// L'assembleur (composition.js) en choisit un par site : la famille du métier, ce que la fiche permet, jamais celui
// d'un voisin du même métier, jamais celui que la critique a écarté.
'use strict';
const T = require('../theme');
const ST = require('./styles');

const NAV = { barre: 'nav.x-barre', centre: 'nav.x-centre', pilule: 'nav.x-pilule', minimal: 'nav.x-minimal' };
const SANS = ['typo', 'degrade', 'tuiles', 'fiche'];
const ORDRE = ['nav', 'hero', 'services', 'apropos', 'galerie', 'avis', 'faq', 'contact', 'pied'];
const ORDRE_LIEU = ['nav', 'hero', 'apropos', 'services', 'galerie', 'avis', 'faq', 'contact', 'pied'];

// t(id, nom, idée, inspiration, familles, style, nav, { hero, services, apropos, galerie, avis, faq, contact, pied }, options)
// chaque rubrique : la liste des sections à essayer dans l'ordre (la première possible avec la fiche est prise)
function t(id, nom, idee, inspi, familles, style, nav, r, o) {
  o = o || {};
  return Object.assign({ id: id, nom: nom, idee: idee, inspiration: inspi, familles: familles, style: style, nav: NAV[nav],
    // sans photo, chaque template a sa propre ouverture (o.sans), puis les autres ouvertures faites pour s'en passer
    hero: r.hero.map(function (x) { return 'hero.x-' + x; }).concat([o.sans || SANS[T.hash(id) % SANS.length]].concat(SANS).map(function (x) { return 'hero.x-' + x; })).filter(function (x, k, a) { return a.indexOf(x) === k; }),
    services: r.services.map(function (x) { return 'services.x-' + x; }).concat(['services.x-cartes', 'services.x-grille']),
    apropos: r.apropos.map(function (x) { return 'apropos.x-' + x; }).concat(['apropos.x-faits', 'apropos.x-manifeste']),
    galerie: (r.galerie || ['mosaique']).map(function (x) { return 'galerie.x-' + x; }).concat(['galerie.x-planche']),
    avis: (r.avis || ['ligne']).map(function (x) { return 'avis.x-' + x; }),
    faq: (r.faq || ['colonnes']).map(function (x) { return 'faq.x-' + x; }),
    contact: r.contact.map(function (x) { return 'contact.x-' + x; }).concat(['contact.x-split']),
    pied: r.pied.map(function (x) { return 'pied.x-' + x; }).concat(['pied.x-simple']),
    ordre: o.lieu ? ORDRE_LIEU : ORDRE,
    // le rythme des fonds : clair, puis une bande adoucie, jamais deux bandes pareilles de suite
    surfaces: Object.assign({ services: 'surface', apropos: 'fond', galerie: 'fond', avis: 'teinte', faq: 'surface', contact: 'fond', pied: 'surface' }, o.surfaces || {}),
    numeros: !!o.numeros }, o.extra || {});
}

const TEMPLATES = [
  // ── artisans, dépannage, bâtiment, énergie (famille atelier) et garages ──
  t('basalte', 'Basalte', 'Le sérieux d\'une entreprise du bâtiment : grille stricte, gros titres condensés, filets épais, tout est à sa place.', 'sites d\'entreprises de construction suisses et allemandes', ['atelier', 'garage'], 'chantier', 'barre',
    { hero: ['split', 'fiche'], services: ['liste'], apropos: ['faits'], galerie: ['mosaique'], avis: ['ligne'], faq: ['colonnes'], contact: ['split'], pied: ['colonnes'] }, { numeros: true }),
  t('alize', 'Alizé', 'Clair et aéré comme un produit moderne : titre centré, grande photo qui s\'ouvre, cartes nettes.', 'templates Framer de start-up', ['atelier', 'cabinet', 'verdure'], 'net', 'pilule',
    { hero: ['centre'], services: ['cartes'], apropos: ['engagements'], contact: ['carte'], pied: ['simple'] }),
  t('pitons', 'Pitons', 'La photo du métier en grand, l\'artisan qui assume : plein écran, grille à filets, trois colonnes pour joindre.', 'sites d\'artisans primés (Awwwards, catégorie construction)', ['atelier', 'garage'], 'chantier', 'barre',
    { hero: ['plein'], services: ['grille'], apropos: ['photo', 'manifeste'], contact: ['colonnes'], pied: ['nom'] }, { surfaces: { services: 'fond', apropos: 'surface' } }),
  t('carbet', 'Carbet', 'Chaleureux et solide : un grand bloc teinté pour le texte, l\'accordéon des services, deux photos superposées.', 'templates Squarespace pour artisans', ['atelier', 'boutique'], 'atelier', 'minimal',
    { hero: ['bloc', 'fiche'], services: ['accordeon'], apropos: ['double', 'faits'], contact: ['teinte'], pied: ['colonnes'] }, { surfaces: { contact: 'teinte' } }),
  t('lamentin', 'Lamentin', 'Éditorial et technique : le titre sur toute la largeur, un panorama qui se resserre, les services qui défilent sous un titre collé.', 'sites de bureaux d\'études et d\'architectes', ['atelier', 'cabinet'], 'mineral', 'barre',
    { hero: ['titre'], services: ['colle'], apropos: ['manifeste'], contact: ['split'], pied: ['simple'] }, { numeros: true }),
  t('cap-est', 'Cap Est', 'L\'efficacité du dépanneur : une fiche qui dit l\'essentiel dès le premier écran, même sans photo.', 'pages de services à domicile nord-américains (plombiers, climatisation)', ['atelier', 'garage'], 'net', 'barre',
    { hero: ['fiche'], services: ['liste'], apropos: ['engagements'], contact: ['colonnes'], pied: ['colonnes'] }),
  t('galion', 'Galion', 'Une photo encadrée comme une affiche de chantier, un bento de services, un pied au grand nom.', 'templates Framer « agency »', ['atelier', 'garage', 'boutique'], 'chantier', 'pilule',
    { hero: ['cadre', 'fiche'], services: ['bento'], apropos: ['faits'], contact: ['carte'], pied: ['nom'] }, { surfaces: { services: 'fond', apropos: 'surface' } }),
  t('tamarin', 'Tamarin', 'Le travail montré : deux colonnes, rangées photo et texte en alternance, un contact posé sur une photo.', 'sites de menuisiers et d\'ébénistes', ['atelier', 'verdure'], 'atelier', 'barre',
    { hero: ['split'], services: ['zigzag', 'cartes'], apropos: ['large', 'engagements'], contact: ['photo', 'split'], pied: ['simple'] }, { surfaces: { services: 'fond', apropos: 'surface' } }),
  t('caravelle', 'Caravelle', 'Le bandeau photo et la carte qui monte dessus, des cartes nettes, une bande de contact teintée.', 'templates Webflow « services »', ['atelier', 'horizon', 'garage'], 'mineral', 'barre',
    { hero: ['bande', 'fiche'], services: ['cartes'], apropos: ['faits'], contact: ['teinte'], pied: ['colonnes'] }, { surfaces: { contact: 'teinte' } }),
  t('morne-rouge', 'Morne Rouge', 'Pensé pour se passer de photo : la typographie en très grand, des couleurs franches, des cadres épais.', 'mouvement néo-brutaliste (Gumroad, sites d\'indépendants)', ['atelier', 'boutique', 'garage'], 'pop', 'pilule',
    { hero: ['typo'], services: ['grille'], apropos: ['engagements'], contact: ['colonnes'], pied: ['nom'] }, { surfaces: { services: 'fond', apropos: 'surface', contact: 'teinte' } }),
  t('trinite', 'Trinité', 'Sobre et sûr de lui : la photo plein écran, l\'accordéon, la présentation comme une parole.', 'sites d\'artisans haut de gamme (rénovation, agencement)', ['atelier', 'cabinet'], 'net', 'minimal',
    { hero: ['plein'], services: ['accordeon'], apropos: ['citation'], contact: ['split'], pied: ['colonnes'] }),
  t('ajoupa', 'Ajoupa', 'Le grand titre d\'abord, comme une enseigne : panorama, cartes, manifeste, trois colonnes de contact.', 'sites éditoriaux de marques d\'outillage', ['garage', 'atelier'], 'chantier', 'barre',
    { hero: ['titre', 'fiche'], services: ['cartes'], apropos: ['manifeste'], contact: ['colonnes'], pied: ['simple'] }, { numeros: true }),

  // ── jardin, nettoyage, piscines (famille verdure) ──
  t('mangrove', 'Mangrove', 'Vivant et rond : la photo dans une arche, des cartes douces, une bande de contact teintée.', 'templates Squarespace pour paysagistes', ['verdure', 'ecrin'], 'tropical', 'pilule',
    { hero: ['arche'], services: ['cartes'], apropos: ['photo', 'engagements'], contact: ['teinte'], pied: ['colonnes'] }, { surfaces: { contact: 'teinte' } }),
  t('balata', 'Balata', 'La nature en grand : photo plein écran, rangées en alternance, engagements numérotés.', 'sites de jardiniers paysagistes anglais', ['verdure'], 'tropical', 'barre',
    { hero: ['plein'], services: ['zigzag', 'grille'], apropos: ['engagements'], contact: ['carte'], pied: ['simple'] }),
  t('fond-blanc', 'Fond Blanc', 'Eau claire et lumière : titre centré, grande photo, bento des services, fiche des faits.', 'templates Framer « wellness »', ['verdure', 'horizon'], 'lagon', 'pilule',
    { hero: ['centre'], services: ['bento'], apropos: ['faits'], contact: ['split'], pied: ['colonnes'] }),
  t('salines', 'Salines', 'Doux et précis : la photo encadrée, la liste éditoriale, deux photos superposées.', 'sites de conciergeries et de services de ménage haut de gamme', ['verdure', 'ecrin', 'horizon'], 'doux', 'barre',
    { hero: ['cadre', 'fiche'], services: ['liste'], apropos: ['double', 'citation'], contact: ['colonnes'], pied: ['nom'] }),
  t('vetiver', 'Vétiver', 'Rassurant et rangé : deux colonnes, grille à filets, contact sur bande teintée.', 'sites de sociétés de nettoyage professionnelles', ['verdure', 'cabinet'], 'doux', 'minimal',
    { hero: ['split', 'fiche'], services: ['grille'], apropos: ['photo', 'manifeste'], contact: ['teinte'], pied: ['simple'] }, { surfaces: { contact: 'teinte' } }),

  // ── tables : restaurants, snacks, traiteurs (famille comptoir) ──
  t('colombo', 'Colombo', 'La table en affiche : le nom sur la photo, la carte comme un menu, la maison racontée.', 'sites de bistrots parisiens', ['comptoir'], 'gourmand', 'centre',
    { hero: ['affiche'], services: ['carte'], apropos: ['citation'], galerie: ['mosaique'], avis: ['note'], contact: ['colonnes'], pied: ['colonnes'] }, { lieu: true, surfaces: { apropos: 'fond', services: 'surface' } }),
  t('cannelle', 'Cannelle', 'Gourmand et rond : l\'arche, la carte, une piste de photos, la note en ligne.', 'templates Squarespace « restaurant »', ['comptoir', 'ecrin'], 'gourmand', 'pilule',
    { hero: ['arche'], services: ['carte'], apropos: ['photo'], galerie: ['piste'], avis: ['ligne'], contact: ['split'], pied: ['nom'] }, { lieu: true }),
  t('rhum-vieux', 'Rhum Vieux', 'Éditorial et chaleureux : le titre d\'enseigne en très grand, la liste, le manifeste, la note qui compte.', 'sites de caves et de bars à cocktails', ['comptoir', 'boutique'], 'papier', 'centre',
    { hero: ['titre'], services: ['liste'], apropos: ['manifeste'], galerie: ['planche'], avis: ['note'], contact: ['carte'], pied: ['colonnes'] }, { lieu: true }),
  t('marche', 'Le Marché', 'Le plein de produits : un collage de photos, des cartes, deux photos superposées.', 'sites d\'épiceries fines et de traiteurs', ['comptoir', 'boutique'], 'gourmand', 'barre',
    { hero: ['collage', 'split'], services: ['cartes'], apropos: ['double', 'photo'], contact: ['teinte'], pied: ['simple'] }, { surfaces: { contact: 'teinte' } }),

  // ── beauté, coiffure, soins (famille écrin) ──
  t('velours', 'Velours', 'L\'élégance d\'un institut : l\'arche, la carte des soins, une parole signée, une grande carte pour réserver.', 'sites d\'instituts parisiens', ['ecrin'], 'luxe', 'centre',
    { hero: ['arche'], services: ['carte'], apropos: ['citation'], contact: ['carte'], pied: ['nom'] }, { lieu: true }),
  t('orchidee', 'Orchidée', 'Raffiné et calme : deux colonnes, l\'accordéon des soins, la photo et le texte.', 'templates Framer « beauty »', ['ecrin', 'cabinet'], 'luxe', 'minimal',
    { hero: ['split'], services: ['accordeon'], apropos: ['photo', 'manifeste'], contact: ['split'], pied: ['colonnes'] }),
  t('nacre', 'Nacre', 'Doux et lumineux : le titre centré, la liste éditoriale, deux photos superposées.', 'sites de spas et de bien-être scandinaves', ['ecrin', 'verdure'], 'doux', 'pilule',
    { hero: ['centre'], services: ['liste'], apropos: ['double', 'citation'], contact: ['teinte'], pied: ['simple'] }, { lieu: true, surfaces: { contact: 'teinte' } }),
  t('hibiscus', 'Hibiscus', 'Coloré sans excès : la photo encadrée, la carte des prestations, les engagements numérotés.', 'templates Squarespace « salon »', ['ecrin', 'comptoir'], 'doux', 'centre',
    { hero: ['cadre'], services: ['carte'], apropos: ['engagements'], contact: ['colonnes'], pied: ['colonnes'] }),

  // ── santé, conseil, immobilier, informatique, formation (famille cabinet) ──
  t('source', 'Source', 'La clarté d\'un cabinet médical : deux colonnes, grille à filets, la fiche des faits.', 'sites de cabinets de santé nordiques', ['cabinet'], 'clinique', 'barre',
    { hero: ['split'], services: ['grille'], apropos: ['faits'], contact: ['split'], pied: ['colonnes'] }),
  t('schoelcher', 'Schœlcher', 'Éditorial et posé : le grand titre, le titre collé, une parole signée.', 'sites de cabinets d\'avocats et de conseil', ['cabinet'], 'papier', 'minimal',
    { hero: ['titre'], services: ['colle'], apropos: ['citation'], contact: ['carte'], pied: ['simple'] }, { numeros: true }),
  t('diamant', 'Diamant', 'Typographique et précis, pensé sans photo : les services en accordéon, les engagements numérotés.', 'sites de cabinets de conseil suisses', ['cabinet', 'atelier'], 'net', 'pilule',
    { hero: ['typo'], services: ['accordeon'], apropos: ['engagements'], contact: ['colonnes'], pied: ['colonnes'] }, { numeros: true }),
  t('plateau', 'Plateau', 'Moderne et rassurant : le titre centré, des cartes, le manifeste, un pied au grand nom.', 'templates Framer « clinic »', ['cabinet', 'verdure'], 'clinique', 'barre',
    { hero: ['centre'], services: ['cartes'], apropos: ['manifeste'], contact: ['teinte'], pied: ['nom'] }, { surfaces: { contact: 'teinte' } }),
  t('savane', 'Savane', 'Pratique et sérieux : la fiche qui dit l\'essentiel, la liste éditoriale, la fiche des faits.', 'sites d\'agences immobilières et d\'assurance', ['cabinet', 'garage'], 'mineral', 'centre',
    { hero: ['fiche'], services: ['liste'], apropos: ['faits'], contact: ['split'], pied: ['colonnes'] }),

  // ── mer, sorties, hébergements (famille horizon) ──
  t('anse', 'Anse', 'L\'appel du large : l\'affiche sur la photo, des sorties qu\'on fait glisser, une piste de photos.', 'sites de loueurs de bateaux et d\'excursions', ['horizon'], 'lagon', 'barre',
    { hero: ['affiche'], services: ['piste'], apropos: ['large', 'citation'], galerie: ['piste'], avis: ['note'], contact: ['split'], pied: ['colonnes'] }),
  t('grand-large', 'Grand Large', 'Le séjour en grand : bandeau et carte, rangées en alternance, une mosaïque de photos.', 'sites d\'hôtels boutique', ['horizon', 'comptoir'], 'lagon', 'pilule',
    { hero: ['bande'], services: ['zigzag', 'cartes'], apropos: ['citation'], galerie: ['mosaique'], avis: ['ligne'], contact: ['carte'], pied: ['nom'] }),
  t('corail', 'Corail', 'Solaire et doux : la photo plein écran, la piste des sorties, la photo et le texte.', 'templates Squarespace « travel »', ['horizon', 'verdure'], 'doux', 'centre',
    { hero: ['plein'], services: ['piste'], apropos: ['photo', 'engagements'], galerie: ['planche'], contact: ['teinte'], pied: ['simple'] }, { surfaces: { contact: 'teinte' } }),
  t('flamboyant', 'Flamboyant', 'Une ambiance avant tout : le collage, le bento, le manifeste et la piste de photos.', 'sites de lieux de vie (rooftops, beach clubs)', ['horizon', 'comptoir', 'boutique'], 'tropical', 'barre',
    { hero: ['collage', 'centre'], services: ['bento'], apropos: ['manifeste'], galerie: ['piste'], contact: ['colonnes'], pied: ['colonnes'] }),

  // ── commerces et boutiques ──
  t('vitrine', 'Vitrine', 'Franc comme une devanture : un grand bloc de couleur claire, le bento des produits, des cadres épais.', 'boutiques en ligne néo-brutalistes', ['boutique'], 'pop', 'barre',
    { hero: ['bloc'], services: ['bento'], apropos: ['engagements'], contact: ['colonnes'], pied: ['nom'] }, { lieu: true }),
  t('enseigne', 'Enseigne', 'L\'enseigne en très grand : le titre sur toute la largeur, des cartes, une bande de contact teintée.', 'sites de concept-stores', ['boutique', 'atelier'], 'pop', 'pilule',
    { hero: ['titre'], services: ['cartes'], apropos: ['faits'], contact: ['teinte'], pied: ['colonnes'] }, { surfaces: { contact: 'teinte' } }),
  t('madras', 'Madras', 'Artisanal et coloré : le collage de photos, la grille à filets, deux photos superposées.', 'sites de créateurs et d\'ateliers d\'art', ['boutique', 'comptoir', 'ecrin'], 'atelier', 'centre',
    { hero: ['collage', 'split'], services: ['grille'], apropos: ['double', 'citation'], contact: ['carte'], pied: ['simple'] }, { lieu: true }),
  t('bakoua', 'Bakoua', 'Net et lumineux : la photo encadrée, la liste éditoriale, un contact posé sur une photo.', 'templates Framer « portfolio »', ['boutique', 'cabinet', 'atelier'], 'net', 'barre',
    { hero: ['cadre'], services: ['liste'], apropos: ['photo', 'faits'], contact: ['photo', 'colonnes'], pied: ['colonnes'] }),

  // ── transverses ──
  t('zouk', 'Zouk', 'Énergique : le titre centré, la piste qui glisse, le manifeste, un pied au grand nom.', 'sites événementiels et culturels', ['boutique', 'comptoir', 'horizon'], 'pop', 'minimal',
    { hero: ['centre'], services: ['piste'], apropos: ['manifeste'], contact: ['carte'], pied: ['nom'] }, { surfaces: { contact: 'teinte' } }),
  t('case-creole', 'Case Créole', 'Le charme d\'une maison : bandeau et carte, la carte des services, la fiche des faits.', 'sites de maisons d\'hôtes et de tables de campagne', ['comptoir', 'horizon', 'ecrin', 'cabinet'], 'papier', 'centre',
    { hero: ['bande', 'fiche'], services: ['carte'], apropos: ['faits'], contact: ['colonnes'], pied: ['colonnes'] }, { lieu: true })
];
const PAR_ID = {};
TEMPLATES.forEach(function (x) { PAR_ID[x.id] = x; });

// la voix typographique d'un site sous ce template : la sienne si le style la permet, sinon une du style (stable)
function typePour(tpl, da, graine) {
  const st = ST.PAR_ID[tpl.style];
  if (!st) return da.type;
  if (st.types.indexOf(da.type) >= 0) return da.type;
  return st.types[T.hash(String(graine || '') + '|' + tpl.id) % st.types.length];
}
// la palette adoucie par le style (béton, papier, sable...), contrastes revérifiés
function palettePour(tpl, brute, marque) {
  const st = ST.PAR_ID[tpl.style], tt = st && st.teintes;
  if (!tt || !brute) return T.palette(brute, marque);
  const p = Object.assign({}, brute);
  if (tt.fond) p.fond = T.melange(p.fond, tt.fond[0], tt.fond[1]);
  if (tt.surface) p.surface = T.melange(p.surface, tt.surface[0], tt.surface[1]);
  // l'encre reste lisible sur la page adoucie
  p.encre = T.lisible(p.encre, p.fond, 7, p.surface);
  return T.palette(p, marque);
}
// la feuille propre aux templates : la base, puis le style
function css(tpl) { const st = ST.PAR_ID[tpl.style]; return ST.BASE + (st ? st.css : ''); }

module.exports = { TEMPLATES, PAR_ID, STYLES: ST.STYLES, typePour, palettePour, css };
