// Les modèles des sites Novalemo : huit familles de vrais sites professionnels, chacune faite pour un type de métier
// (artisans, garages, tables, soins, santé et conseil, mer et tourisme, jardin et entretien, boutiques), avec sa
// structure, ses palettes, ses voix typographiques et ses variantes. La photo porte le site, le texte reste court.
'use strict';

// Palettes : fond et surface (la page), encre et doux (le texte), accent (le bouton), champ (bandes sombres, pied),
// vif (le bouton posé sur le champ). Contrastes recalculés par theme.palette().
const P = function (id, nom, o) { return Object.assign({ id: id, nom: nom, clair: true }, o); };

const MODELES = {
  atelier: {
    forme: { r: '6px', rb: '4px', rp: '6px' }, boutons: 'caps', centre: false, textes: { services: 'Nos services', pourquoi: 'Pourquoi nous choisir', apropos: 'Qui sommes-nous', etapes: 'Comment ça se passe', galerie: 'Nos chantiers en images', faq: 'Questions fréquentes', contact: 'Nous contacter' },
    nom: 'Atelier', pour: 'artisans du bâtiment et du dépannage',
    metiers: /clim|froid|frigor|ventil|vmc|plomb|sanitaire|chauffe-eau|d[ée]bouch|assainiss|[ée]lectri|courant|domotique|borne|solaire|photovolta|menuis|alu\b|alumin|store|vitr|fen[êe]tre|fermeture|s[ée]curit|alarme|surveillance|vid[ée]o ?protec|peint|ravalement|fa[çc]ade|toit|couvreur|charpent|[ée]tanch|serrur|blindage|b[âa]timent|ma[çc]on|construct|travaux|r[ée]novation|carrel|btp|terrassement|forage|soud|ferronn|m[ée]tallerie|cuisiniste|plaquiste|isolation|piscinist|climatis/i,
    heros: ['photo', 'split'], services: ['cartes', 'icones'], haut: true, bandeau: true, pastilles: true, titres: 'metier',
    types: ['barlow', 'bigshoulders', 'archivo', 'schibsted'],
    palettes: [
      P('marine-jaune', 'Marine et jaune', { fond: '#ffffff', surface: '#f3f5f8', encre: '#0f1b2d', doux: '#4a5568', accent: '#f5b301', surAccent: '#0f1b2d', champ: '#0f1b2d', surChamp: '#ffffff', vif: '#f5b301', surVif: '#0f1b2d' }),
      P('anthracite-orange', 'Anthracite et orange', { fond: '#ffffff', surface: '#f5f5f4', encre: '#1c1917', doux: '#57534e', accent: '#e2550b', surAccent: '#ffffff', champ: '#1c1917', surChamp: '#fafaf9', vif: '#f97316', surVif: '#1c1917' }),
      P('bleu-franc', 'Bleu franc', { fond: '#ffffff', surface: '#f0f4fb', encre: '#0b1f3a', doux: '#475569', accent: '#0050e6', surAccent: '#ffffff', champ: '#0b1f3a', surChamp: '#ffffff', vif: '#ffffff', surVif: '#0b1f3a' }),
      P('vert-chantier', 'Vert chantier', { fond: '#ffffff', surface: '#f2f6f1', encre: '#12211a', doux: '#4b5a51', accent: '#15803d', surAccent: '#ffffff', champ: '#12211a', surChamp: '#ffffff', vif: '#a3e635', surVif: '#12211a' }),
      P('rouge-acier', 'Rouge et acier', { fond: '#ffffff', surface: '#f4f4f5', encre: '#18181b', doux: '#52525b', accent: '#d4201f', surAccent: '#ffffff', champ: '#26272b', surChamp: '#ffffff', vif: '#ef4444', surVif: '#ffffff' })
    ]
  },
  garage: {
    forme: { r: '4px', rb: '3px', rp: '4px' }, boutons: 'caps', centre: false, textes: { services: 'Nos services', pourquoi: 'Pourquoi venir chez nous', apropos: 'Qui sommes-nous', etapes: 'Comment ça se passe', galerie: 'L\'atelier en images', faq: 'Questions fréquentes', contact: 'Nous contacter' },
    nom: 'Garage', pour: 'auto, moto, transport et déménagement',
    metiers: /garage|m[ée]cani|carross|pneu|automobile|\bauto\b|moto|scooter|transport|logisti|taxi|vtc|d[ée]m[ée]nag|location de (voiture|v[ée]hicule)|remorqu|d[ée]pannage auto|livraison|fret|transit|poids lourd|carburant|lavage auto|car wash/i,
    heros: ['photo', 'split'], services: ['cartes', 'icones'], haut: true, bandeau: false, pastilles: true, titres: 'metier', sombre: true,
    types: ['barlow', 'archivo', 'bigshoulders'],
    palettes: [
      P('graphite-orange', 'Graphite et orange', { clair: false, fond: '#141518', surface: '#1d1f24', encre: '#f2f3f5', doux: '#a3a7b0', accent: '#ff5a1f', surAccent: '#141518', champ: '#0b0c0e', surChamp: '#f2f3f5', vif: '#ff5a1f', surVif: '#141518' }),
      P('noir-rouge', 'Noir et rouge', { clair: false, fond: '#0f0f10', surface: '#1a1a1c', encre: '#f4f4f5', doux: '#a1a1aa', accent: '#e11d27', surAccent: '#ffffff', champ: '#070708', surChamp: '#f4f4f5', vif: '#e11d27', surVif: '#ffffff' }),
      P('nuit-jaune', 'Nuit et jaune', { clair: false, fond: '#0c1320', surface: '#141e30', encre: '#eef2f8', doux: '#9aa6ba', accent: '#ffc21a', surAccent: '#0c1320', champ: '#070b13', surChamp: '#eef2f8', vif: '#ffc21a', surVif: '#0c1320' })
    ]
  },
  comptoir: {
    forme: { r: '14px', rb: '999px', rp: '14px' }, boutons: 'normal', centre: true, textes: { services: 'Nos spécialités', pourquoi: 'La maison', apropos: 'La maison', etapes: 'Comment commander', galerie: 'En images', faq: 'Questions fréquentes', contact: 'Infos pratiques' },
    nom: 'Comptoir', pour: 'restaurants, snacks, traiteurs, boulangeries',
    metiers: /restau|snack|traiteur|\bbar\b|food|p[âa]tiss|boulang|glac|caf[ée]\b|pizz|brasserie|cr[êe]pe|burger|sushi|grill|rhum|cave|bistro|lolo|cuisine cr[ée]ole|plats? [àa] emporter/i,
    heros: ['centre', 'split'], services: ['carte', 'cartes'], haut: false, bandeau: false, titres: 'nom',
    types: ['youngserif', 'fraunces', 'besley', 'bricolage'],
    palettes: [
      P('bouteille-or', 'Vert bouteille et or', { fond: '#fbf7ef', surface: '#f1ead9', encre: '#16241c', doux: '#57614f', accent: '#14382a', surAccent: '#fbf7ef', champ: '#14382a', surChamp: '#fbf7ef', vif: '#e3b04b', surVif: '#14382a' }),
      P('bordeaux-creme', 'Bordeaux et crème', { fond: '#fcf8f3', surface: '#f4ebe1', encre: '#2a1215', doux: '#6b4f4f', accent: '#7a1424', surAccent: '#fcf8f3', champ: '#3a0d14', surChamp: '#fcf8f3', vif: '#f2c4a8', surVif: '#3a0d14' }),
      P('noir-moutarde', 'Noir et moutarde', { fond: '#fffdf7', surface: '#f6efdc', encre: '#141414', doux: '#57534e', accent: '#141414', surAccent: '#ffffff', champ: '#141414', surChamp: '#fffdf7', vif: '#e0a10e', surVif: '#141414' }),
      P('lagon-corail', 'Lagon et corail', { fond: '#f7fbfa', surface: '#e7f2f0', encre: '#0b2b2b', doux: '#456262', accent: '#c13a1e', surAccent: '#ffffff', champ: '#0b3b3b', surChamp: '#f7fbfa', vif: '#ff8a65', surVif: '#0b2b2b' })
    ]
  },
  ecrin: {
    forme: { r: '18px', rb: '999px', rp: '28px' }, boutons: 'normal', centre: true, textes: { services: 'Nos prestations', pourquoi: 'L\'esprit du lieu', apropos: 'Le lieu', etapes: 'Comment réserver', galerie: 'En images', faq: 'Questions fréquentes', contact: 'Prendre rendez-vous' },
    nom: 'Écrin', pour: 'beauté, coiffure, soins et bien-être',
    metiers: /beaut|esth[ée]ti|coiff|ongle|onglerie|massage|bien[- ][êe]tre|\bspa\b|barb|maquill|tatou|cils|sourcils|[ée]pilation|manucure|soins? du corps|hammam|sauna|yoga|pilates/i,
    heros: ['split', 'photo'], services: ['prestations', 'cartes'], haut: false, bandeau: false, titres: 'metier',
    types: ['bodoni', 'newsreader', 'fraunces'],
    palettes: [
      P('blush-prune', 'Blush et prune', { fond: '#fbf6f3', surface: '#f3e6df', encre: '#2f1a26', doux: '#6c5562', accent: '#5b2a45', surAccent: '#fbf6f3', champ: '#3b1d2d', surChamp: '#fbf6f3', vif: '#f2c9c0', surVif: '#3b1d2d' }),
      P('sauge-creme', 'Sauge et crème', { fond: '#f9f8f3', surface: '#ebeee3', encre: '#1f2a22', doux: '#56615a', accent: '#3d5a46', surAccent: '#f9f8f3', champ: '#263b2d', surChamp: '#f9f8f3', vif: '#d8e3c9', surVif: '#263b2d' }),
      P('sable-cacao', 'Sable et cacao', { fond: '#faf6f0', surface: '#efe5d8', encre: '#2b1e16', doux: '#6a5849', accent: '#5c3b28', surAccent: '#faf6f0', champ: '#3a271b', surChamp: '#faf6f0', vif: '#e8cfb2', surVif: '#3a271b' }),
      P('nuit-or', 'Nuit et or', { clair: false, fond: '#121212', surface: '#1c1b19', encre: '#f6f2ea', doux: '#a8a196', accent: '#c9a45a', surAccent: '#121212', champ: '#0a0a0a', surChamp: '#f6f2ea', vif: '#c9a45a', surVif: '#121212' })
    ]
  },
  cabinet: {
    forme: { r: '16px', rb: '12px', rp: '20px' }, boutons: 'normal', centre: false, textes: { services: 'Nos services', pourquoi: 'Pourquoi nous choisir', apropos: 'Qui sommes-nous', etapes: 'Comment ça se passe', galerie: 'En images', faq: 'Questions fréquentes', contact: 'Nous contacter' },
    nom: 'Cabinet', pour: 'santé, conseil, formation, immobilier, informatique',
    metiers: /sant[ée]|m[ée]dic|kin[ée]|ost[ée]o|infirm|dentist|pharma|psy|sage[- ]femme|podolog|orthophon|di[ée]t[ée]tic|v[ée]t[ée]rin|avocat|notaire|comptab|expert|conseil|assurance|courtier|courtage|financ|banque|cr[ée]dit|patrimoine|investiss|immobili|agence|formation|[ée]cole|cours|coach|auto[- ]?[ée]cole|informatique|r[ée]seau|num[ée]rique|d[ée]veloppe|architecte|g[ée]om[èe]tre|bureau d'[ée]tudes|secr[ée]tariat|domiciliation|ressources humaines|traduct/i,
    heros: ['split', 'photo'], services: ['icones', 'cartes'], haut: false, bandeau: false, pastilles: true, titres: 'metier',
    types: ['albert', 'hanken', 'schibsted', 'newsreader'],
    palettes: [
      P('blanc-canard', 'Blanc et bleu canard', { fond: '#ffffff', surface: '#eef6f6', encre: '#0f2a2e', doux: '#4a6266', accent: '#0d6e73', surAccent: '#ffffff', champ: '#0f2a2e', surChamp: '#ffffff', vif: '#7dd3d0', surVif: '#0f2a2e' }),
      P('blanc-marine', 'Blanc et marine', { fond: '#ffffff', surface: '#f1f4f9', encre: '#0e1a33', doux: '#4b5670', accent: '#1d3f8f', surAccent: '#ffffff', champ: '#0e1a33', surChamp: '#ffffff', vif: '#9ec1ff', surVif: '#0e1a33' }),
      P('glace-cobalt', 'Glace et cobalt', { fond: '#f8fafd', surface: '#e9eff8', encre: '#0a1530', doux: '#4a5573', accent: '#2346d4', surAccent: '#ffffff', champ: '#101c3d', surChamp: '#f8fafd', vif: '#ffffff', surVif: '#2346d4' }),
      P('perle-vert', 'Perle et vert', { fond: '#fbfbf9', surface: '#eef2ec', encre: '#17231c', doux: '#4f5d54', accent: '#2f6b47', surAccent: '#ffffff', champ: '#1b2d22', surChamp: '#fbfbf9', vif: '#b9dcc4', surVif: '#1b2d22' })
    ]
  },
  horizon: {
    forme: { r: '4px', rb: '2px', rp: '4px' }, boutons: 'caps', centre: false, textes: { services: 'Nos sorties', pourquoi: 'Pourquoi partir avec nous', apropos: 'Qui sommes-nous', etapes: 'Comment réserver', galerie: 'En images', faq: 'Questions fréquentes', contact: 'Réserver' },
    nom: 'Horizon', pour: 'mer, bateaux, excursions, hébergements',
    metiers: /nautis|bateau|marine|yacht|plong|p[êe]che|kayak|paddle|catamaran|jet[- ]?ski|voile|tourism|excursion|guide|h[ôo]tel|g[îi]te|chambres? d'h[ôo]te|location saisonni|villa|s[ée]jour|r[ée]sidence|camping|randonn/i,
    heros: ['centre', 'photo'], services: ['offres', 'cartes'], haut: false, bandeau: false, titres: 'nom',
    types: ['jost', 'unbounded', 'bodoni', 'hanken'],
    palettes: [
      P('marine-turquoise', 'Marine et turquoise', { fond: '#ffffff', surface: '#eef7f8', encre: '#0a2033', doux: '#46606f', accent: '#0a7f8f', surAccent: '#ffffff', champ: '#0a2033', surChamp: '#ffffff', vif: '#5eead4', surVif: '#0a2033' }),
      P('sable-bleu', 'Sable et bleu profond', { fond: '#fbf8f2', surface: '#f2eadb', encre: '#0b2545', doux: '#4d5b6e', accent: '#0b3d91', surAccent: '#ffffff', champ: '#0b2545', surChamp: '#fbf8f2', vif: '#f6d38b', surVif: '#0b2545' }),
      P('noir-or-mer', 'Noir et or', { clair: false, fond: '#0e0f11', surface: '#17191c', encre: '#f5f3ee', doux: '#a6a39c', accent: '#d4af64', surAccent: '#0e0f11', champ: '#070809', surChamp: '#f5f3ee', vif: '#d4af64', surVif: '#0e0f11' })
    ]
  },
  verdure: {
    forme: { r: '22px', rb: '999px', rp: '22px' }, boutons: 'normal', centre: false, textes: { services: 'Nos services', pourquoi: 'Pourquoi nous choisir', apropos: 'Qui sommes-nous', etapes: 'Comment ça se passe', galerie: 'Nos chantiers en images', faq: 'Questions fréquentes', contact: 'Nous contacter' },
    nom: 'Verdure', pour: 'jardin, entretien, nettoyage, piscines',
    metiers: /paysag|jardin|espaces? verts|[ée]lagage|d[ée]brouss|tonte|nettoy|propret|entretien|m[ée]nage|lavage|vitres|piscin|p[ée]pini|agricul|maraîch|horticult|arros|d[ée]sinsect|d[ée]ratis|nuisibles/i,
    heros: ['photo', 'split'], services: ['alternance', 'cartes'], haut: true, bandeau: false, pastilles: true, titres: 'metier',
    types: ['bricolage', 'schibsted', 'epilogue', 'albert'],
    palettes: [
      P('foret-citron', 'Forêt et citron', { fond: '#fbfcf8', surface: '#eef3e6', encre: '#142417', doux: '#4f5e51', accent: '#2f6b2f', surAccent: '#ffffff', champ: '#173a1f', surChamp: '#fbfcf8', vif: '#d4f06a', surVif: '#173a1f' }),
      P('mousse-sable', 'Mousse et sable', { fond: '#faf7f0', surface: '#efe8d8', encre: '#24251c', doux: '#5a5a4c', accent: '#4b6130', surAccent: '#ffffff', champ: '#2f3a22', surChamp: '#faf7f0', vif: '#e8d48a', surVif: '#2f3a22' }),
      P('eau-blanc', 'Eau et blanc', { fond: '#ffffff', surface: '#ecf7fb', encre: '#0b2a3a', doux: '#47606d', accent: '#08729e', surAccent: '#ffffff', champ: '#0b2a3a', surChamp: '#ffffff', vif: '#67e8f9', surVif: '#0b2a3a' })
    ]
  },
  boutique: {
    forme: { r: '0px', rb: '0px', rp: '0px' }, boutons: 'normal', centre: false, textes: { services: 'Ce que nous proposons', pourquoi: 'Pourquoi venir chez nous', apropos: 'La boutique', etapes: 'Comment ça se passe', galerie: 'En images', faq: 'Questions fréquentes', contact: 'Venir nous voir' },
    nom: 'Boutique', pour: 'commerces et boutiques',
    metiers: /boutique|magasin|commerce|vente|pr[êe]t[- ][àa][- ]porter|v[êe]tement|chaussure|bijou|fleur|fleuriste|imprim|enseigne|s[ée]rigraph|marquage|photo|cadeau|d[ée]co|librairie|papeterie|jouet|[ée]picerie|alimentation|sup[ée]rette|opticien|t[ée]l[ée]phonie|[ée]lectrom[ée]nager|quincaillerie|bricolage/i,
    heros: ['bande', 'split'], services: ['cartes', 'icones'], haut: false, bandeau: false, titres: 'metier',
    types: ['epilogue', 'unbounded', 'schibsted', 'bricolage'],
    palettes: [
      P('cobalt-blanc', 'Cobalt', { fond: '#ffffff', surface: '#eef1fe', encre: '#0b1033', doux: '#4c5275', accent: '#1d3ae8', surAccent: '#ffffff', champ: '#1d3ae8', surChamp: '#ffffff', vif: '#ffe14d', surVif: '#0b1033' }),
      P('moutarde-noir', 'Moutarde et noir', { fond: '#fffdf6', surface: '#fbf0cf', encre: '#121212', doux: '#55503f', accent: '#121212', surAccent: '#ffffff', champ: '#e0a10e', surChamp: '#121212', vif: '#121212', surVif: '#ffffff' }),
      P('carmin-blanc', 'Carmin', { fond: '#ffffff', surface: '#fbeeee', encre: '#241315', doux: '#6a5153', accent: '#b0142a', surAccent: '#ffffff', champ: '#b0142a', surChamp: '#ffffff', vif: '#ffd6dc', surVif: '#7a0d1d' }),
      P('menthe-noir', 'Menthe et noir', { fond: '#ffffff', surface: '#e9f8f0', encre: '#0f1712', doux: '#4c5a51', accent: '#0f1712', surAccent: '#ffffff', champ: '#0f1712', surChamp: '#ffffff', vif: '#7cf2b0', surVif: '#0f1712' })
    ]
  }
};
const IDS = Object.keys(MODELES);

// les métiers qu'un mot trompe : une auto-école n'est pas un garage, un dépannage informatique pas un artisan
const EXCEPTIONS = [[/auto[- ]?[ée]cole|permis de conduire|code de la route/i, 'cabinet'], [/informatique|ordinateur|r[ée]seau|num[ée]rique/i, 'cabinet'], [/glacier|boulang|p[âa]tiss/i, 'comptoir']];
function pour(secteur) {
  const s = String(secteur || '');
  for (const e of EXCEPTIONS) if (e[0].test(s)) return e[1];
  // ordre voulu : les métiers précis d'abord (un restaurant de plage reste une table, un garage n'est pas un atelier)
  for (const id of ['comptoir', 'ecrin', 'horizon', 'garage', 'cabinet', 'verdure', 'atelier', 'boutique']) if (MODELES[id].metiers.test(s)) return id;
  return 'atelier';
}
// le titre des services quand l'atelier n'en propose pas de juste
function titreServices(id, secteur) {
  if (id === 'horizon' && /h[ôo]tel|g[îi]te|chambre|villa|location saisonni|s[ée]jour|r[ée]sidence|camping|logement/i.test(String(secteur || ''))) return 'Nos hébergements';
  return MODELES[id].textes.services;
}

module.exports = { MODELES, IDS, pour, titreServices };
