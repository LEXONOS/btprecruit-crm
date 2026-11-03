// La matière de la direction artistique des sites Novalemo : palettes (contrastes vérifiés par le code), systèmes
// typographiques auto-hébergés, icônes de service (téléphone, WhatsApp, email, lieu) et ce que chaque métier appelle.
// Palettes et systèmes typographiques adaptés de taste-skill (licence MIT) ; polices sous licence SIL OFL (polices/LICENCE.txt).
'use strict';

/* ── couleurs ── */
function hexRgb(h) { const x = String(h).replace('#', ''); const n = parseInt(x.length === 3 ? x.split('').map(function (c) { return c + c; }).join('') : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r) { return '#' + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
function lum(h) { return hexRgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (s, v, k) { return s + v * [0.2126, 0.7152, 0.0722][k]; }, 0); }
function contraste(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function melange(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map(function (v, k) { return v + (y[k] - v) * t; })); }
// fonce ou éclaircit une couleur jusqu'au contraste voulu sur un fond (sur deux fonds : les deux)
function lisible(c, fond, cible, fond2) {
  const ok = function (x) { return contraste(x, fond) >= cible && (!fond2 || contraste(x, fond2) >= cible); };
  if (ok(c)) return c;
  const vers = lum(fond) > 0.4 ? '#000000' : '#ffffff';
  for (let t = 0.04; t <= 1.001; t += 0.04) { const x = melange(c, vers, t); if (ok(x)) return x; }
  return vers;
}
function surCouleur(c, encre) { return contraste('#ffffff', c) >= contraste(encre || '#111111', c) ? '#ffffff' : (encre || '#111111'); }
function valideHex(h) { return /^#[0-9a-f]{6}$/i.test(String(h || '')) ? String(h).toLowerCase() : null; }
// teinte (0-360) et saturation (0-1) d'une couleur, pour rapprocher une couleur de marque d'une palette
function teinte(h) {
  const [r, g, b] = hexRgb(h).map(function (v) { return v / 255; });
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let t = 0;
  if (d) t = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { t: (t * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
function ecartTeinte(a, b) { const x = teinte(a), y = teinte(b); const d = Math.abs(x.t - y.t); return Math.min(d, 360 - d) / 180 + Math.abs(x.s - y.s) * 0.5; }

/* ── palettes ──
   fond, surface, encre, doux : la page ; accent (+ surAccent) : le bouton principal et les liens ;
   champ (+ surChamp) : les grands aplats (héros affiche, bande du héros photo, contact) ; vif (+ surVif) : le bouton posé sur le champ.
   tons : franc (artisans, dépannage, transport), calme (santé, conseil, services), chaleureux (table, beauté, jardin), premium. */
const PALETTES = [
  { id: 'feuille-bleu', nom: 'Feuille et stylo bleu', clair: true, tons: ['franc', 'calme'], fond: '#ffffff', surface: '#f3f3f1', encre: '#111111', doux: '#5f5f5f', accent: '#1a4be0', surAccent: '#ffffff', champ: '#111111', surChamp: '#ffffff', vif: '#ffffff', surVif: '#111111' },
  { id: 'givre-ardoise', nom: 'Givre et ardoise', clair: true, tons: ['calme'], fond: '#f7f9fa', surface: '#e9eef1', encre: '#1f3038', doux: '#55636a', accent: '#0d7480', surAccent: '#ffffff', champ: '#1f3038', surChamp: '#f7f9fa', vif: '#f7f9fa', surVif: '#1f3038' },
  { id: 'rose-vert', nom: 'Gris rosé et vert', clair: true, tons: ['calme', 'chaleureux'], fond: '#ebe5e3', surface: '#e0d8d5', encre: '#2b2622', doux: '#625955', accent: '#0f7d45', surAccent: '#ffffff', champ: '#0f7d45', surChamp: '#ffffff', vif: '#ebe5e3', surVif: '#2b2622' },
  { id: 'pierre-plan', nom: 'Pierre et plan bleu', clair: true, tons: ['franc'], fond: '#dfdedb', surface: '#d2d1cc', encre: '#26251e', doux: '#57554d', accent: '#2456d6', surAccent: '#ffffff', champ: '#2456d6', surChamp: '#ffffff', vif: '#dfdedb', surVif: '#26251e' },
  { id: 'marine-orange', nom: 'Marine et orange', clair: true, tons: ['franc'], fond: '#ffffff', surface: '#f2f2ef', encre: '#1f2b4d', doux: '#5d6479', accent: '#1f2b4d', surAccent: '#ffffff', champ: '#1f2b4d', surChamp: '#ffffff', vif: '#f7941d', surVif: '#1f2b4d' },
  { id: 'trois-pierres', nom: 'Trois pierres', clair: true, tons: ['calme', 'premium'], fond: '#eeecea', surface: '#e3e0db', encre: '#333231', doux: '#625e5a', accent: '#4f5d48', surAccent: '#ffffff', champ: '#cdc3b6', surChamp: '#333231', vif: '#333231', surVif: '#eeecea' },
  { id: 'mastic-canard', nom: 'Mastic, noir et bleu canard', clair: true, tons: ['franc', 'calme'], fond: '#dedad3', surface: '#d2cdc4', encre: '#0a0a0a', doux: '#55514b', accent: '#1f6375', surAccent: '#ffffff', champ: '#0a0a0a', surChamp: '#dedad3', vif: '#dedad3', surVif: '#0a0a0a' },
  { id: 'sable-mousse', nom: 'Sable et mousse', clair: true, tons: ['chaleureux'], fond: '#ddd6c6', surface: '#d1c9b6', encre: '#2a2a26', doux: '#535148', accent: '#3f5a2a', surAccent: '#ffffff', champ: '#3f5a2a', surChamp: '#ffffff', vif: '#ddd6c6', surVif: '#2a2a26' },
  { id: 'os-chocolat', nom: 'Os, vert et chocolat', clair: true, tons: ['chaleureux'], fond: '#e5e1d8', surface: '#d9d4c8', encre: '#2a1d17', doux: '#63544a', accent: '#456f3a', surAccent: '#ffffff', champ: '#2a1d17', surChamp: '#e5e1d8', vif: '#e5e1d8', surVif: '#2a1d17' },
  { id: 'gris-cobalt', nom: 'Gris froid et cobalt', clair: true, tons: ['franc'], fond: '#eef0f3', surface: '#e1e4ea', encre: '#0b0c0e', doux: '#545b67', accent: '#1f2de6', surAccent: '#ffffff', champ: '#1f2de6', surChamp: '#ffffff', vif: '#ffffff', surVif: '#0b0c0e' },
  { id: 'blanc-rouge', nom: 'Blanc et rouge signal', clair: true, tons: ['franc'], fond: '#ffffff', surface: '#f1f1f1', encre: '#0a0a0a', doux: '#5e5e5e', accent: '#c8251c', surAccent: '#ffffff', champ: '#0a0a0a', surChamp: '#ffffff', vif: '#d92b21', surVif: '#ffffff' },
  { id: 'bouteille-jaune', nom: 'Vert bouteille et jaune', clair: true, tons: ['franc', 'chaleureux'], fond: '#f7f7f5', surface: '#ebebe7', encre: '#0d2a1c', doux: '#53605a', accent: '#0d2a1c', surAccent: '#ffffff', champ: '#f6e016', surChamp: '#0d2a1c', vif: '#0d2a1c', surVif: '#f6e016' },
  { id: 'canard-papier', nom: 'Bleu canard sur papier', clair: true, tons: ['calme'], fond: '#f7f9f8', surface: '#e8eeeb', encre: '#06525c', doux: '#2c6a73', accent: '#06525c', surAccent: '#f7f9f8', champ: '#06525c', surChamp: '#f7f9f8', vif: '#f7f9f8', surVif: '#06525c' },
  { id: 'olive-os', nom: 'Olive sur os', clair: true, tons: ['chaleureux', 'premium'], fond: '#ecebe7', surface: '#e0ded7', encre: '#38450f', doux: '#535d33', accent: '#38450f', surAccent: '#ecebe7', champ: '#38450f', surChamp: '#ecebe7', vif: '#ecebe7', surVif: '#38450f' },
  { id: 'cobalt-sable', nom: 'Cobalt sur sable', clair: true, tons: ['chaleureux', 'premium'], fond: '#e6dbc7', surface: '#dccfb6', encre: '#062b8a', doux: '#2f4f9c', accent: '#062b8a', surAccent: '#e6dbc7', champ: '#062b8a', surChamp: '#e6dbc7', vif: '#e6dbc7', surVif: '#062b8a' },
  { id: 'sang-gris', nom: 'Sang de bœuf et gris', clair: true, tons: ['premium', 'chaleureux'], fond: '#e4e3e1', surface: '#d7d6d3', encre: '#6e0b12', doux: '#6c4347', accent: '#7d0c14', surAccent: '#f2f1ef', champ: '#7d0c14', surChamp: '#f2f1ef', vif: '#f2f1ef', surVif: '#7d0c14' },
  { id: 'blush-aubergine', nom: 'Blush et aubergine', clair: true, tons: ['chaleureux', 'premium'], fond: '#efd3c7', surface: '#e8c4b4', encre: '#351a2b', doux: '#62404e', accent: '#351a2b', surAccent: '#efd3c7', champ: '#351a2b', surChamp: '#efd3c7', vif: '#efd3c7', surVif: '#351a2b' },
  { id: 'menthe-rose', nom: 'Menthe et rose', clair: true, tons: ['calme'], fond: '#f8f8f7', surface: '#ececea', encre: '#0a0a0a', doux: '#5e5e5e', accent: '#1f6b3a', surAccent: '#ffffff', champ: '#c3edce', surChamp: '#0a0a0a', vif: '#0a0a0a', surVif: '#ffffff' },
  { id: 'ciel-sable', nom: 'Ciel et sable', clair: true, tons: ['chaleureux', 'calme'], fond: '#cfe6f3', surface: '#bddcee', encre: '#0a0a0a', doux: '#3c5764', accent: '#0a0a0a', surAccent: '#ffffff', champ: '#f1e3b5', surChamp: '#0a0a0a', vif: '#0a0a0a', surVif: '#f1e3b5' },
  { id: 'graphite-orange', nom: 'Graphite et orange', clair: false, tons: ['franc'], fond: '#18191b', surface: '#222427', encre: '#eff0f1', doux: '#a2a4a9', accent: '#ff4a1f', surAccent: '#18191b', champ: '#ff4a1f', surChamp: '#18191b', vif: '#18191b', surVif: '#eff0f1' },
  { id: 'nuit-bleuet', nom: 'Nuit et bleuet', clair: false, tons: ['franc', 'premium'], fond: '#0a0d14', surface: '#141a27', encre: '#e9edf3', doux: '#959eae', accent: '#5a9bfc', surAccent: '#0a0d14', champ: '#e9edf3', surChamp: '#0a0d14', vif: '#0a0d14', surVif: '#e9edf3' },
  { id: 'vert-noir-os', nom: 'Vert noir et os', clair: false, tons: ['premium', 'calme'], fond: '#161c1a', surface: '#1f2725', encre: '#e3e2da', doux: '#979d96', accent: '#9fc7b8', surAccent: '#161c1a', champ: '#9fc7b8', surChamp: '#161c1a', vif: '#161c1a', surVif: '#e3e2da' },
  { id: 'noir-or', nom: 'Noir chaud et or', clair: false, tons: ['premium'], fond: '#0c0a08', surface: '#181512', encre: '#f7f3ec', doux: '#9a948d', accent: '#c9a45a', surAccent: '#0c0a08', champ: '#c9a45a', surChamp: '#0c0a08', vif: '#0c0a08', surVif: '#f7f3ec' },
  { id: 'charbon-sauge', nom: 'Charbon et sauge', clair: false, tons: ['premium', 'calme'], fond: '#1c1c1c', surface: '#272727', encre: '#f1f1ef', doux: '#a3a49f', accent: '#8fa68e', surAccent: '#1c1c1c', champ: '#c8c5ba', surChamp: '#1c1c1c', vif: '#1c1c1c', surVif: '#f1f1ef' },
  { id: 'champ-cobalt', nom: 'Champ cobalt', clair: true, tons: ['franc'], fond: '#ffffff', surface: '#eef1fb', encre: '#0b0f2a', doux: '#4f5570', accent: '#0034eb', surAccent: '#ffffff', champ: '#0034eb', surChamp: '#ffffff', vif: '#e9e34a', surVif: '#111111' },
  { id: 'moutarde-noir', nom: 'Moutarde et noir', clair: true, tons: ['franc', 'chaleureux'], fond: '#faf7ee', surface: '#f0e9d3', encre: '#0b0b0b', doux: '#575041', accent: '#0b0b0b', surAccent: '#ffffff', champ: '#e1ac10', surChamp: '#0b0b0b', vif: '#0b0b0b', surVif: '#e1ac10' },
  { id: 'orange-noir', nom: 'Orange et noir', clair: true, tons: ['franc'], fond: '#fbf8f4', surface: '#f2ebe2', encre: '#050f16', doux: '#584a3f', accent: '#050f16', surAccent: '#ffffff', champ: '#ff7a1f', surChamp: '#050f16', vif: '#050f16', surVif: '#ffffff' },
  { id: 'ciel-marine', nom: 'Ciel et marine', clair: true, tons: ['franc', 'chaleureux'], fond: '#f4f9fd', surface: '#e3eff9', encre: '#0e1822', doux: '#465a6d', accent: '#0e1822', surAccent: '#ffffff', champ: '#6bb4ee', surChamp: '#0e1822', vif: '#0e1822', surVif: '#ffffff' },
  { id: 'champ-carmin', nom: 'Champ carmin', clair: true, tons: ['chaleureux', 'franc'], fond: '#ffffff', surface: '#f6eeee', encre: '#2a2a2a', doux: '#625556', accent: '#9c1220', surAccent: '#ffffff', champ: '#9c1220', surChamp: '#ffffff', vif: '#ffd9dc', surVif: '#9c1220' },
  { id: 'bouteille-or', nom: 'Vert bouteille et or', clair: false, tons: ['premium', 'chaleureux'], fond: '#133621', surface: '#1a4429', encre: '#f4d96c', doux: '#c2b46d', accent: '#f4d96c', surAccent: '#133621', champ: '#f4d96c', surChamp: '#133621', vif: '#133621', surVif: '#f4d96c' }
];
const PAR_ID = {};
PALETTES.forEach(function (p) { PAR_ID[p.id] = p; });

// La palette prête à l'emploi : couleur de marque éventuelle à la place de l'accent, tous les contrastes garantis (4,5 au moins)
function palette(id, marque) {
  const p = Object.assign({}, PAR_ID[id] || PALETTES[0]);
  const m = valideHex(marque);
  if (m) {
    // la marque prend le bouton et les liens ; si le champ était l'accent, il la suit
    const champEtaitAccent = p.champ === p.accent;
    p.accent = m;
    p.surAccent = surCouleur(m, p.encre);
    if (contraste(p.surAccent, p.accent) < 4.5) p.accent = lisible(m, p.surAccent, 4.5);
    if (champEtaitAccent) { p.champ = p.accent; p.surChamp = p.surAccent; }
  }
  p.doux = lisible(p.doux, p.fond, 4.6, p.surface);
  p.accentTexte = lisible(p.accent, p.fond, 4.6, p.surface);   // liens et petits textes en couleur
  if (contraste(p.surAccent, p.accent) < 4.5) p.surAccent = surCouleur(p.accent, p.encre);
  if (contraste(p.surChamp, p.champ) < 4.5) p.surChamp = lisible(p.surChamp, p.champ, 4.5);
  if (contraste(p.surVif, p.vif) < 4.5) p.surVif = surCouleur(p.vif, p.encre);
  // le bouton posé sur le champ doit se voir (sinon : la couleur du texte du champ)
  if (contraste(p.vif, p.champ) < 1.6) { p.vif = p.surChamp; p.surVif = p.champ; }
  p.champDoux = melange(p.surChamp, p.champ, 0.22);
  if (contraste(p.champDoux, p.champ) < 4.5) p.champDoux = p.surChamp;
  return p;
}

/* ── polices (auto-hébergées, servies depuis /_f/) ── */
const FICHIERS_POLICES = {
  albert: [{ famille: 'Albert Sans', fichier: 'albert.woff2', poids: '100 900' }],
  archivo: [{ famille: 'Archivo', fichier: 'archivo.woff2', poids: '100 900', etirement: '62% 125%' }],
  barlow: [{ famille: 'Barlow', fichier: 'barlow-400.woff2', poids: '400' }, { famille: 'Barlow', fichier: 'barlow-600.woff2', poids: '600' }],
  barlowcond: [{ famille: 'Barlow Condensed', fichier: 'barlowcond-700.woff2', poids: '700' }],
  besley: [{ famille: 'Besley', fichier: 'besley.woff2', poids: '400 900' }],
  bigshoulders: [{ famille: 'Big Shoulders', fichier: 'bigshoulders.woff2', poids: '100 900' }],
  bodoni: [{ famille: 'Bodoni Moda', fichier: 'bodoni.woff2', poids: '400 900' }],
  bricolage: [{ famille: 'Bricolage Grotesque', fichier: 'bricolage.woff2', poids: '200 800' }],
  epilogue: [{ famille: 'Epilogue', fichier: 'epilogue.woff2', poids: '100 900' }],
  franklin: [{ famille: 'Libre Franklin', fichier: 'franklin.woff2', poids: '100 900' }],
  fraunces: [{ famille: 'Fraunces', fichier: 'fraunces.woff2', poids: '100 900' }],
  hanken: [{ famille: 'Hanken Grotesk', fichier: 'hanken.woff2', poids: '100 900' }],
  inter: [{ famille: 'Inter', fichier: 'inter.woff2', poids: '100 900' }],
  jost: [{ famille: 'Jost', fichier: 'jost.woff2', poids: '100 900' }],
  newsreader: [{ famille: 'Newsreader', fichier: 'newsreader.woff2', poids: '200 800' }],
  onest: [{ famille: 'Onest', fichier: 'onest.woff2', poids: '100 900' }],
  publicsans: [{ famille: 'Public Sans', fichier: 'publicsans.woff2', poids: '100 900' }],
  schibsted: [{ famille: 'Schibsted Grotesk', fichier: 'schibsted.woff2', poids: '400 900' }],
  sourceserif: [{ famille: 'Source Serif 4', fichier: 'sourceserif.woff2', poids: '200 900' }],
  unbounded: [{ famille: 'Unbounded', fichier: 'unbounded.woff2', poids: '200 900' }],
  youngserif: [{ famille: 'Young Serif', fichier: 'youngserif.woff2', poids: '400' }]
};
// Systèmes typographiques : une voix de titre, une voix de texte. chasse = largeur moyenne d'un caractère (em), mesurée
// dans le navigateur sur des titres en français : elle sert à dimensionner chaque titre pour tenir en deux lignes.
const TYPES = [
  { id: 'schibsted', nom: 'Schibsted Grotesk', titre: 'schibsted', texte: 'schibsted', poids: 800, interlettre: '-0.045em', hauteur: 0.92, casse: 'none', reglage: 'normal', texteFort: 600, tons: ['franc', 'chaleureux'], rayon: null, chasse: 0.5 },
  { id: 'bricolage', nom: 'Bricolage Grotesque', titre: 'bricolage', texte: 'bricolage', poids: 620, interlettre: '-0.035em', hauteur: 0.94, casse: 'none', reglage: '"opsz" 96', reglageTexte: '"opsz" 14', texteFort: 600, tons: ['chaleureux', 'calme'], rayon: 'rond', chasse: 0.44 },
  { id: 'hanken', nom: 'Hanken Grotesk', titre: 'hanken', texte: 'hanken', poids: 560, interlettre: '-0.045em', hauteur: 0.96, casse: 'none', reglage: 'normal', texteFort: 600, tons: ['calme', 'premium'], rayon: null, chasse: 0.45 },
  { id: 'bigshoulders', nom: 'Big Shoulders et Public Sans', titre: 'bigshoulders', texte: 'publicsans', poids: 800, interlettre: '0em', hauteur: 0.9, casse: 'uppercase', reglage: '"opsz" 72', texteFort: 600, tons: ['franc'], rayon: 'carre', chasse: 0.42 },
  { id: 'barlow', nom: 'Barlow Condensed et Barlow', titre: 'barlowcond', texte: 'barlow', poids: 700, interlettre: '-0.01em', hauteur: 0.92, casse: 'uppercase', reglage: 'normal', texteFort: 600, tons: ['franc'], rayon: 'carre', chasse: 0.42 },
  { id: 'unbounded', nom: 'Unbounded et Onest', titre: 'unbounded', texte: 'onest', poids: 700, interlettre: '-0.035em', hauteur: 1.02, casse: 'none', reglage: 'normal', texteFort: 600, tons: ['franc', 'premium'], rayon: null, chasse: 0.65 },
  { id: 'epilogue', nom: 'Epilogue', titre: 'epilogue', texte: 'epilogue', poids: 820, interlettre: '-0.045em', hauteur: 0.92, casse: 'none', reglage: 'normal', texteFort: 600, tons: ['franc', 'chaleureux'], rayon: 'rond', chasse: 0.53 },
  { id: 'albert', nom: 'Albert Sans', titre: 'albert', texte: 'albert', poids: 620, interlettre: '-0.035em', hauteur: 1, casse: 'none', reglage: 'normal', texteFort: 600, tons: ['calme', 'franc'], rayon: 'rond', chasse: 0.48 },
  { id: 'youngserif', nom: 'Young Serif et Source Serif', titre: 'youngserif', texte: 'sourceserif', poids: 400, interlettre: '-0.025em', hauteur: 1, casse: 'none', reglage: 'normal', texteFort: 600, tons: ['chaleureux'], rayon: null, chasse: 0.52, serif: true },
  { id: 'newsreader', nom: 'Newsreader', titre: 'newsreader', texte: 'newsreader', poids: 340, interlettre: '-0.035em', hauteur: 0.98, casse: 'none', reglage: 'normal', texteFort: 560, tons: ['premium', 'calme'], rayon: 'carre', chasse: 0.42, serif: true },
  { id: 'besley', nom: 'Besley et Libre Franklin', titre: 'besley', texte: 'franklin', poids: 800, interlettre: '-0.025em', hauteur: 0.96, casse: 'none', reglage: 'normal', texteFort: 600, tons: ['chaleureux'], rayon: 'carre', chasse: 0.59 },
  { id: 'bodoni', nom: 'Bodoni Moda et Jost', titre: 'bodoni', texte: 'jost', poids: 500, interlettre: '-0.02em', hauteur: 1, casse: 'none', reglage: '"opsz" 96', texteFort: 500, tons: ['premium'], rayon: 'carre', chasse: 0.49 },
  { id: 'archivo', nom: 'Archivo étroit', titre: 'archivo', texte: 'archivo', poids: 800, interlettre: '-0.01em', hauteur: 0.88, casse: 'uppercase', reglage: 'normal', etirement: '62%', texteFort: 600, tons: ['franc'], rayon: 'carre', chasse: 0.43 },
  { id: 'fraunces', nom: 'Fraunces et Hanken Grotesk', titre: 'fraunces', texte: 'hanken', poids: 560, interlettre: '-0.03em', hauteur: 0.98, casse: 'none', reglage: '"opsz" 144', texteFort: 600, tons: ['chaleureux', 'premium'], rayon: null, chasse: 0.41 },
  { id: 'jost', nom: 'Jost capitales', titre: 'jost', texte: 'jost', poids: 700, interlettre: '-0.02em', hauteur: 0.94, casse: 'uppercase', reglage: 'normal', texteFort: 500, tons: ['franc', 'premium'], rayon: null, chasse: 0.61 }
];
const TYPE_PAR_ID = {};
TYPES.forEach(function (t) { TYPE_PAR_ID[t.id] = t; });
function typo(id) { return TYPE_PAR_ID[id] || TYPES[0]; }

/* ── icônes de service (24 x 24, trait) : seulement là où elles aident à agir ── */
const ICONES = {
  tel: '<path d="M5.2 3.5h3.7l1.9 4.8-2.4 1.5a11.5 11.5 0 0 0 5.8 5.8l1.5-2.4 4.8 1.9v3.7a1.9 1.9 0 0 1-2 1.9A16.6 16.6 0 0 1 3.3 5.5a1.9 1.9 0 0 1 1.9-2z"/>',
  whatsapp: '<path d="M4 20.3l1.2-4.1A8.3 8.3 0 1 1 8.4 19z"/><path d="M9.1 8.4c.3-.6.6-.6.9-.6h.6c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.1.6l-.5.6c-.1.2-.2.4 0 .6.6 1.1 1.5 1.9 2.6 2.5.2.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5 0 .5-.2 1.2-.7 1.5-.6.5-1.5.6-2.5.3a9.6 9.6 0 0 1-4.6-4.1c-.6-1-.8-2.1-.4-3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  pin: '<path d="M12 21.5s7.2-6.3 7.2-11.8a7.2 7.2 0 0 0-14.4 0C4.8 15.2 12 21.5 12 21.5z"/><circle cx="12" cy="9.7" r="2.6"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.3 2"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
function icone(nom, cls) { return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONES[nom] || ICONES.fleche) + '</svg>'; }

/* ── métiers : le but du site, le ton, et les photos d'illustration à chercher (décors, objets, gestes ; jamais de visages) ── */
const METIERS = [
  [/clim|froid|frigor|ventil|vmc/i, { objectif: 'devis', ton: 'franc', photos: ['air conditioner unit wall', 'air conditioning installation', 'hvac technician tools'], banque: null }],
  [/plomb|sanitaire|chauffe-eau|assainiss|d[ée]bouch/i, { objectif: 'devis', ton: 'franc', photos: ['plumbing pipes wrench', 'bathroom faucet water', 'plumber tools'], banque: null }],
  [/[ée]lectric|[ée]lectri|courant|domotique|borne/i, { objectif: 'devis', ton: 'franc', photos: ['electrical panel wiring', 'electrician tools cables', 'light switch installation'], banque: null }],
  [/solaire|photovolta|[ée]nergie/i, { objectif: 'devis', ton: 'franc', photos: ['solar panels roof', 'solar panel installation', 'solar energy sun'], banque: null }],
  [/piscin|spa\b/i, { objectif: 'devis', ton: 'calme', photos: ['swimming pool water clear', 'pool tropical villa', 'pool cleaning'], banque: 'mer' }],
  [/nettoy|propret|entretien|m[ée]nage|lavage/i, { objectif: 'devis', ton: 'calme', photos: ['cleaning supplies bucket', 'clean bright interior', 'window cleaning'], banque: null }],
  [/menuis|alu|store|vitr|fen[êe]tre|fermeture/i, { objectif: 'devis', ton: 'franc', photos: ['aluminium window frame', 'modern window house', 'sliding glass door'], banque: 'batiment' }],
  [/s[ée]curit|gardiennage|alarme|surveillance|vid[ée]o/i, { objectif: 'devis', ton: 'franc', photos: ['security camera building', 'alarm system keypad', 'cctv camera'], banque: null }],
  [/transport|logisti|livraison|transit|fret|taxi|vtc/i, { objectif: 'devis', ton: 'franc', photos: ['truck road', 'delivery van', 'cargo containers port'], banque: 'route' }],
  [/d[ée]m[ée]nag/i, { objectif: 'devis', ton: 'franc', photos: ['moving boxes', 'moving truck', 'cardboard boxes home'], banque: null }],
  [/location|loueur/i, { objectif: 'reservation', ton: 'chaleureux', photos: ['tropical villa terrace', 'caribbean holiday rental', 'rental car keys'], banque: 'mer' }],
  [/paysag|jardin|espaces? verts|[ée]lagage/i, { objectif: 'devis', ton: 'chaleureux', photos: ['tropical garden plants', 'garden landscaping', 'lawn mowing garden'], banque: 'jardin' }],
  [/auto[- ]?[ée]cole|conduite|permis/i, { objectif: 'inscription', ton: 'calme', photos: ['driving car steering wheel', 'car on road', 'driving lesson car'], banque: 'route' }],
  [/imprim|enseigne|signal[ée]tique|marquage|s[ée]rigraph/i, { objectif: 'devis', ton: 'franc', photos: ['printing press colors', 'shop sign storefront', 'screen printing'], banque: null }],
  [/informatique|r[ée]seau|ordinateur|d[ée]pannage info|num[ée]rique/i, { objectif: 'devis', ton: 'franc', photos: ['computer repair desk', 'network cables server', 'laptop workspace'], banque: null }],
  [/photo|vid[ée]ast|drone/i, { objectif: 'devis', ton: 'premium', photos: ['camera lens', 'photographer camera', 'drone sky'], banque: 'mer' }],
  [/formation|[ée]cole|cours|coach/i, { objectif: 'inscription', ton: 'calme', photos: ['classroom desk notebook', 'training workshop', 'books study'], banque: null }],
  [/restau|snack|traiteur|bar\b|food|cuisine|p[âa]tiss|boulang|glac/i, { objectif: 'visite', ton: 'chaleureux', photos: ['caribbean food plate', 'restaurant table', 'fresh tropical dish'], banque: 'table' }],
  [/beaut|esth[ée]ti|coiff|ongle|massage|bien[- ][êe]tre|spa|barb/i, { objectif: 'reservation', ton: 'premium', photos: ['beauty salon interior', 'spa massage stones', 'hair salon chair'], banque: 'jardin' }],
  [/peint|ravalement|fa[çc]ade/i, { objectif: 'devis', ton: 'franc', photos: ['paint roller wall', 'painting house facade', 'paint colors'], banque: null }],
  [/toit|couvreur|charpent|[ée]tanch/i, { objectif: 'devis', ton: 'franc', photos: ['roof tiles', 'roofing work', 'metal roof house'], banque: 'batiment' }],
  [/serrur|blindage/i, { objectif: 'appel', ton: 'franc', photos: ['door lock key', 'locksmith tools', 'front door handle'], banque: null }],
  [/b[âa]timent|ma[çc]on|construct|travaux|r[ée]novation|carrel|btp|terrassement/i, { objectif: 'devis', ton: 'franc', photos: ['construction site concrete', 'tiles floor renovation', 'building construction'], banque: 'batiment' }],
  [/nautis|bateau|marine|yacht|plong|p[êe]che|kayak/i, { objectif: 'reservation', ton: 'premium', photos: ['boat caribbean sea', 'sailboat turquoise water', 'marina boats'], banque: 'mer' }],
  [/garage|m[ée]cani|carross|pneu|automobile/i, { objectif: 'devis', ton: 'franc', photos: ['car mechanic engine', 'garage tools car', 'tire wheel car'], banque: 'route' }],
  [/sant[ée]|m[ée]dic|kin[ée]|ost[ée]o|infirm|dentist|pharma/i, { objectif: 'reservation', ton: 'calme', photos: ['physiotherapy room', 'medical office calm', 'healthcare clinic'], banque: null }],
  [/immobili|agence|archi|d[ée]co|int[ée]rieur/i, { objectif: 'appel', ton: 'premium', photos: ['modern house tropical', 'interior living room', 'architecture villa'], banque: 'batiment' }],
  [/fleur|fleuriste|pépini|p[ée]pini/i, { objectif: 'visite', ton: 'chaleureux', photos: ['tropical flowers bouquet', 'flower shop', 'anthurium flowers'], banque: 'jardin' }],
  [/tourism|excursion|guide|h[ôo]tel|g[îi]te|chambre/i, { objectif: 'reservation', ton: 'chaleureux', photos: ['caribbean beach', 'tropical island coast', 'hotel terrace sea view'], banque: 'mer' }]
];
function pourMetier(secteur) {
  const s = String(secteur || '');
  for (const m of METIERS) if (m[0].test(s)) return Object.assign({}, m[1], { photos: m[1].photos.slice() });
  return { objectif: 'devis', ton: 'franc', photos: ['tools workshop', 'craftsman hands work', 'workbench tools'], banque: null };
}
const TONS = ['franc', 'calme', 'chaleureux', 'premium'];

// petite variation stable : deux voisins du même métier n'ont pas le même site
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
// tirage reproductible à partir d'une graine
function tirage(graine) { let a = graine >>> 0; return function () { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

module.exports = { PALETTES, palette, PAR_ID, TYPES, typo, FICHIERS_POLICES, ICONES, icone, pourMetier, TONS, hash, tirage, contraste, lisible, melange, valideHex, surCouleur, teinte, ecartTeinte, lum };
