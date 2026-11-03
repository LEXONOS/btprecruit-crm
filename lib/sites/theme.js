// La direction artistique des sites Novalemo : ambiances (palettes calculées pour le contraste), compositions,
// paires de polices auto-hébergées, icônes dessinées maison, et le choix par défaut selon le métier.
'use strict';

/* ── couleurs ── */
function hexRgb(h) { const x = String(h).replace('#', ''); const n = parseInt(x.length === 3 ? x.split('').map(function (c) { return c + c; }).join('') : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r) { return '#' + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
function lum(h) { return hexRgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (s, v, k) { return s + v * [0.2126, 0.7152, 0.0722][k]; }, 0); }
function contraste(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function melange(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map(function (v, k) { return v + (y[k] - v) * t; })); }
// fonce ou éclaircit une couleur jusqu'à atteindre le contraste voulu sur un fond
function lisible(c, fond, cible) {
  if (contraste(c, fond) >= cible) return c;
  const vers = lum(fond) > 0.4 ? '#000000' : '#ffffff';
  for (let t = 0.05; t <= 1; t += 0.05) { const x = melange(c, vers, t); if (contraste(x, fond) >= cible) return x; }
  return vers;
}
function surCouleur(c, encre) { return contraste('#ffffff', c) >= contraste(encre || '#111111', c) ? '#ffffff' : (encre || '#111111'); }
function valideHex(h) { return /^#[0-9a-f]{6}$/i.test(String(h || '')) ? String(h).toLowerCase() : null; }

/* ── ambiances : la couleur de l'île, sans folklore ── */
const AMBIANCES = {
  lagon: { nom: 'Lagon', fond: '#f6f1e7', encre: '#0d2a2c', accent: '#0e7c7b', accent2: '#f2b134', doux: '#e9efe7', sombre: false },
  ocean: { nom: 'Océan', fond: '#f3f6fa', encre: '#0b1b33', accent: '#1f5eff', accent2: '#ffb020', doux: '#e4ecf8', sombre: false },
  canne: { nom: 'Canne', fond: '#f4f6ee', encre: '#1d2b1f', accent: '#2f7d3a', accent2: '#d9a93f', doux: '#e5ebda', sombre: false },
  soleil: { nom: 'Soleil', fond: '#fffbf0', encre: '#1f1a10', accent: '#e58e00', accent2: '#0e5f53', doux: '#fbefcf', sombre: false },
  corail: { nom: 'Corail', fond: '#fff6f1', encre: '#2a1416', accent: '#e5533d', accent2: '#2a9d8f', doux: '#fbe6dc', sombre: false },
  ardoise: { nom: 'Ardoise', fond: '#ecedea', encre: '#161816', accent: '#ff5a1f', accent2: '#2b2d2a', doux: '#dfe1dc', sombre: false },
  volcan: { nom: 'Volcan', fond: '#14110f', encre: '#f4eee6', accent: '#ff6a3d', accent2: '#f4c95d', doux: '#211b18', sombre: true },
  nuit: { nom: 'Nuit', fond: '#0b1020', encre: '#eef2ff', accent: '#39d5ff', accent2: '#a78bfa', doux: '#131b34', sombre: true }
};
const COMPOSITIONS = ['affiche', 'editorial', 'bandeau', 'photo'];
// paires de polices : titre + texte (fichiers dans lib/sites/polices, servis depuis /_f/)
const POLICES = {
  affiche: { titre: 'archivo', texte: 'inter', reglage: '"wdth" 78', poids: 800, interlettre: '-0.035em', hauteur: 0.92, chasse: 0.5 },
  editorial: { titre: 'fraunces', texte: 'inter', reglage: '"opsz" 144', poids: 560, interlettre: '-0.03em', hauteur: 0.98, chasse: 0.52 },
  bandeau: { titre: 'space-grotesk', texte: 'inter', reglage: 'normal', poids: 700, interlettre: '-0.04em', hauteur: 0.95, chasse: 0.6 },
  photo: { titre: 'archivo', texte: 'inter', reglage: '"wdth" 84', poids: 760, interlettre: '-0.03em', hauteur: 0.95, chasse: 0.53 }
};
const FICHIERS_POLICES = {
  archivo: { famille: 'Archivo', fichier: 'archivo.woff2', poids: '100 900', etirement: '62% 125%' },
  fraunces: { famille: 'Fraunces', fichier: 'fraunces.woff2', poids: '100 900' },
  inter: { famille: 'Inter', fichier: 'inter.woff2', poids: '100 900' },
  'space-grotesk': { famille: 'Space Grotesk', fichier: 'space-grotesk.woff2', poids: '300 700' }
};

// Palette complète d'un site : ambiance + éventuelle couleur de marque (logo, demande du client), contrastes garantis
function palette(nom, accentMarque) {
  const a = Object.assign({}, AMBIANCES[nom] || AMBIANCES.lagon);
  const marque = valideHex(accentMarque);
  if (marque) a.accent = marque;
  a.ligne = melange(a.fond, a.encre, a.sombre ? 0.16 : 0.13);
  a.encre2 = melange(a.encre, a.fond, 0.32);                 // texte secondaire
  a.accentTexte = lisible(a.accent, a.fond, 4.6);              // liens et petits textes en couleur
  a.surAccent = surCouleur(a.accent, a.sombre ? a.fond : a.encre);
  if (contraste(a.surAccent, a.accent) < 3) a.accent = lisible(a.accent, a.surAccent === '#ffffff' ? '#ffffff' : a.encre, 3.2);
  a.accentDoux = melange(a.accent, a.fond, a.sombre ? 0.82 : 0.86);
  return a;
}

/* ── icônes (24 x 24, trait) ── */
const ICONES = {
  flocon: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10"/><path d="M9.2 3.8L12 5.6l2.8-1.8M9.2 20.2L12 18.4l2.8 1.8M3.6 10.3l3 .3-1.2-2.9M20.4 13.7l-3-.3 1.2 2.9M3.6 13.7l3-.3-1.2 2.9M20.4 10.3l-3 .3 1.2-2.9"/>',
  ventilateur: '<circle cx="12" cy="12" r="1.7"/><path d="M12 10.3c-.2-3.9 1.3-7.3 3.9-7.3 2.2 0 2.7 3.3-.5 5.6M13.5 12.9c3.4 1.9 5.6 4.9 4.3 7.2-1.1 1.9-4.2.6-4.5-3.3M10.5 12.9c-3.4 1.9-7.1 2.3-8.4 0-1.1-1.9 1.5-3.9 5-2.1"/>',
  goutte: '<path d="M12 3c3.6 4.4 6.2 7.8 6.2 11.1a6.2 6.2 0 0 1-12.4 0C5.8 10.8 8.4 7.4 12 3z"/><path d="M9.3 14.6a2.8 2.8 0 0 0 2.4 2.7"/>',
  cle: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.5 2.6l5.9-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.4-.6-.6-2.4z"/>',
  eclair: '<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  panneau: '<path d="M3 15l2.5-9h13L21 15z"/><path d="M9.3 6L8.4 15M14.7 6l.9 9M4.2 10.5h15.6M12 15v5M8 20h8"/>',
  vagues: '<path d="M2 8c2 0 2-1.6 4-1.6S8 8 10 8s2-1.6 4-1.6S16 8 18 8s2-1.6 4-1.6M2 13c2 0 2-1.6 4-1.6S8 13 10 13s2-1.6 4-1.6S16 13 18 13s2-1.6 4-1.6M2 18c2 0 2-1.6 4-1.6S8 18 10 18s2-1.6 4-1.6S16 18 18 18s2-1.6 4-1.6"/>',
  etincelles: '<path d="M11 3l1.9 4.8L17.7 9.7l-4.8 1.9L11 16.4l-1.9-4.8L4.3 9.7l4.8-1.9z"/><path d="M18.5 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
  fenetre: '<rect x="4" y="3" width="16" height="18" rx="1.2"/><path d="M12 3v18M4 12h16"/>',
  bouclier: '<path d="M12 3l7.5 3v5.3c0 4.6-3.1 8.3-7.5 9.9-4.4-1.6-7.5-5.3-7.5-9.9V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.4"/>',
  camion: '<path d="M2.5 6h11.5v10H2.5zM14 9.5h4.2l3.3 3.3V16H14z"/><circle cx="6.5" cy="17.2" r="1.9"/><circle cx="17.5" cy="17.2" r="1.9"/>',
  clef: '<circle cx="8" cy="15.5" r="4.2"/><path d="M11 12.5l9.5-9.5M16.2 7.3l2.6 2.6M14 9.5l2 2"/>',
  feuille: '<path d="M5 19.5C5 11 10 5 20 4c-.9 10.4-6.9 15.5-15 15.5z"/><path d="M5 19.5l8.5-8.5"/>',
  volant: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><path d="M3.4 10.2h6.3M14.3 10.2h6.3M12 14.4V21"/>',
  imprimante: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
  ecran: '<rect x="3" y="4" width="18" height="12.5" rx="1.5"/><path d="M8 20.5h8M12 16.5v4"/>',
  appareil: '<path d="M4 7.5h3l2-2.5h6l2 2.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  diplome: '<path d="M2 9.2l10-5 10 5-10 5z"/><path d="M6 11.2v5.1c3 2.6 9 2.6 12 0v-5.1M22 9.2v5.6"/>',
  couverts: '<path d="M7.5 3v8.5M5 3v5.2a2.5 2.5 0 0 0 5 0V3M7.5 11.5V21M17.5 3c-2.1 1.2-3.1 3.6-3.1 6.2 0 1.7 1.4 3.1 3.1 3.1V21"/>',
  fleur: '<circle cx="12" cy="12" r="2.4"/><path d="M12 9.6C10 6.1 10.5 3 12 3s2 3.1 0 6.6M14.4 12c3.5-2 6.6-1.5 6.6 0s-3.1 2-6.6 0M12 14.4c2 3.5 1.5 6.6 0 6.6s-2-3.1 0-6.6M9.6 12C6.1 14 3 13.5 3 12s3.1-2 6.6 0"/>',
  maison: '<path d="M3 11.2L12 4l9 7.2"/><path d="M5.2 9.6V20h13.6V9.6M10 20v-5.8h4V20"/>',
  rouleau: '<rect x="3" y="3" width="15" height="6" rx="1.5"/><path d="M18 6h2.5v5H11.2v3"/><rect x="9.7" y="14" width="3" height="7" rx="1"/>',
  toit: '<path d="M2 12.5L12 4.5l10 8"/><path d="M4.8 10.8V20h14.4v-9.2"/><path d="M8.5 15.5h7"/>',
  cadenas: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10M12 14v3"/>',
  cartons: '<path d="M3 8.5L7 4h10l4 4.5V20H3z"/><path d="M3 8.5h18M10 4l-.8 4.5M14 4l.8 4.5M9 13h6"/>',
  marteau: '<path d="M14.5 3.5l6 6-2.6 2.6-6-6z"/><path d="M11.9 6.1L3.2 14.8a1.8 1.8 0 0 0 0 2.6l.4.4a1.8 1.8 0 0 0 2.6 0l8.7-8.7"/>',
  document: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14.5 3v4.5H19M9 12h7M9 16h7"/>',
  tel: '<path d="M5.2 3.5h3.7l1.9 4.8-2.4 1.5a11.5 11.5 0 0 0 5.8 5.8l1.5-2.4 4.8 1.9v3.7a1.9 1.9 0 0 1-2 1.9A16.6 16.6 0 0 1 3.3 5.5a1.9 1.9 0 0 1 1.9-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  bulle: '<path d="M4.2 20.2l1.3-3.9a8.3 8.3 0 1 1 3.4 3.1z"/><path d="M9 11.5h.01M12.5 11.5h.01M16 11.5h.01"/>',
  pin: '<path d="M12 21.5s7.2-6.3 7.2-11.8a7.2 7.2 0 0 0-14.4 0C4.8 15.2 12 21.5 12 21.5z"/><circle cx="12" cy="9.7" r="2.6"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.3 2"/>',
  etoile: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bateau: '<path d="M3 16.5l2 4h14l2-4z"/><path d="M12 3v13.5M12 4.5l6 9.5h-6"/>',
  voiture: '<path d="M5 16v-3.8L7.1 7h9.8l2.1 5.2V16"/><path d="M3 16h18v3.2H3z"/><circle cx="7.5" cy="13.3" r=".6"/><circle cx="16.5" cy="13.3" r=".6"/>',
  coeur: '<path d="M12 20.2s-7.3-4.6-7.3-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.3 2.7c0 5.7-7.3 10.3-7.3 10.3z"/>',
  equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M2.8 20.5c0-3.4 2.8-6.2 6.2-6.2s6.2 2.8 6.2 6.2"/><circle cx="17.2" cy="9" r="2.5"/><path d="M15.8 14.4c3 .4 5.4 2.8 5.4 6"/>',
  cible: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  route: '<path d="M8.5 3L5 21M15.5 3L19 21M12 4.5v2.5M12 10.5V13M12 16.5v3"/>',
  outils: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.5 2.6l5.9-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.4-.6-.6-2.4z"/><path d="M15.5 14.5l5 5"/>'
};
const NOMS_ICONES = Object.keys(ICONES);
function icone(nom, cls) { return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONES[nom] || ICONES.check) + '</svg>'; }

/* ── défauts par métier : icône, ambiance, composition, objectif du site ── */
const METIERS = [
  [/clim|froid|frigor|ventil|vmc/i, { icone: 'flocon', ambiance: 'ocean', composition: 'affiche', objectif: 'devis' }],
  [/plomb|sanitaire|chauffe-eau|assainiss|d[ée]bouch/i, { icone: 'goutte', ambiance: 'ocean', composition: 'bandeau', objectif: 'devis' }],
  [/[ée]lectric|[ée]lectri|courant|domotique|borne/i, { icone: 'eclair', ambiance: 'ardoise', composition: 'affiche', objectif: 'devis' }],
  [/solaire|photovolta|[ée]nergie/i, { icone: 'panneau', ambiance: 'soleil', composition: 'affiche', objectif: 'devis' }],
  [/piscin|spa\b/i, { icone: 'vagues', ambiance: 'lagon', composition: 'editorial', objectif: 'devis' }],
  [/nettoy|propret|entretien|m[ée]nage|lavage/i, { icone: 'etincelles', ambiance: 'lagon', composition: 'bandeau', objectif: 'devis' }],
  [/menuis|alu|store|vitr|fen[êe]tre|fermeture/i, { icone: 'fenetre', ambiance: 'ardoise', composition: 'editorial', objectif: 'devis' }],
  [/s[ée]curit|gardiennage|alarme|surveillance|vid[ée]o/i, { icone: 'bouclier', ambiance: 'nuit', composition: 'affiche', objectif: 'devis' }],
  [/transport|logisti|livraison|transit|fret/i, { icone: 'camion', ambiance: 'volcan', composition: 'affiche', objectif: 'devis' }],
  [/d[ée]m[ée]nag/i, { icone: 'cartons', ambiance: 'soleil', composition: 'bandeau', objectif: 'devis' }],
  [/location|loueur/i, { icone: 'clef', ambiance: 'ardoise', composition: 'bandeau', objectif: 'devis' }],
  [/paysag|jardin|espaces? verts|[ée]lagage/i, { icone: 'feuille', ambiance: 'canne', composition: 'editorial', objectif: 'devis' }],
  [/auto[- ]?[ée]cole|conduite|permis/i, { icone: 'volant', ambiance: 'ocean', composition: 'bandeau', objectif: 'inscription' }],
  [/imprim|enseigne|signal[ée]tique|marquage|s[ée]rigraph/i, { icone: 'imprimante', ambiance: 'corail', composition: 'affiche', objectif: 'devis' }],
  [/informatique|r[ée]seau|ordinateur|d[ée]pannage info|num[ée]rique/i, { icone: 'ecran', ambiance: 'nuit', composition: 'bandeau', objectif: 'devis' }],
  [/photo|vid[ée]ast|drone/i, { icone: 'appareil', ambiance: 'volcan', composition: 'editorial', objectif: 'devis' }],
  [/formation|[ée]cole|cours|coach/i, { icone: 'diplome', ambiance: 'canne', composition: 'editorial', objectif: 'inscription' }],
  [/restau|snack|traiteur|bar\b|food|cuisine/i, { icone: 'couverts', ambiance: 'corail', composition: 'editorial', objectif: 'visite' }],
  [/beaut|esth[ée]ti|coiff|ongle|massage|bien[- ][êe]tre|spa/i, { icone: 'fleur', ambiance: 'corail', composition: 'editorial', objectif: 'reservation' }],
  [/peint|ravalement|fa[çc]ade/i, { icone: 'rouleau', ambiance: 'soleil', composition: 'bandeau', objectif: 'devis' }],
  [/toit|couvreur|charpent|[ée]tanch/i, { icone: 'toit', ambiance: 'ardoise', composition: 'affiche', objectif: 'devis' }],
  [/serrur|blindage/i, { icone: 'cadenas', ambiance: 'nuit', composition: 'affiche', objectif: 'appel' }],
  [/b[âa]timent|ma[çc]on|construct|travaux|r[ée]novation|carrel|btp|terrassement/i, { icone: 'marteau', ambiance: 'ardoise', composition: 'affiche', objectif: 'devis' }],
  [/nautis|bateau|marine|yacht/i, { icone: 'bateau', ambiance: 'lagon', composition: 'editorial', objectif: 'devis' }],
  [/garage|m[ée]cani|carross|pneu|automobile/i, { icone: 'voiture', ambiance: 'volcan', composition: 'affiche', objectif: 'devis' }],
  [/sant[ée]|m[ée]dic|kin[ée]|ost[ée]o|infirm/i, { icone: 'coeur', ambiance: 'lagon', composition: 'editorial', objectif: 'reservation' }]
];
function pourMetier(secteur) {
  const s = String(secteur || '');
  for (const m of METIERS) if (m[0].test(s)) return Object.assign({}, m[1]);
  return { icone: 'outils', ambiance: 'lagon', composition: 'affiche', objectif: 'devis' };
}
// petite variation stable par entreprise : deux voisins du même métier n'ont pas le même site
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

module.exports = { AMBIANCES, COMPOSITIONS, POLICES, FICHIERS_POLICES, ICONES, NOMS_ICONES, icone, palette, pourMetier, hash, contraste, lisible, melange, valideHex, surCouleur };
