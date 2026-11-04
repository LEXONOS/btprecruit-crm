// Contrôle de la bibliothèque des rubriques : chaque variante, sur chaque fiche d'exemple et chaque surface qu'elle
// accepte, doit se rendre sans erreur, sans texte cassé (undefined, NaN, [object Object]), sans lien vers un tiers
// inattendu, avec une feuille de style qui ne touche qu'elle (sélecteurs sous .r-sa-variante, animations nommées k-…).
// node test/rubriques.js [--variante=hero.voile] ; renvoie la liste des défauts (code 1 s'il y en a).
'use strict';
const B = require('../lib/sites/rubriques');
const R = require('../lib/sites/rendu');
const C = require('../lib/sites/composition');
const V = require('./vitrine');
const { NOVALEMO } = require('../lib/config');

const LIENS_OK = [/^#/, /^\//, /^tel:/, /^mailto:/, /^https:\/\/wa\.me\//, /^https:\/\/(www\.)?google\.[a-z.]+\/maps/, /^https:\/\/maps\.(google|app\.goo)\./, /^https:\/\/goo\.gl\/maps/, /^https:\/\/www\.pexels\.com/, /^https:\/\/unsplash\.com/, /^data:/];
function lienOk(u) { return LIENS_OK.some(function (r) { return r.test(u); }) || u.indexOf(NOVALEMO.signature_site.url) === 0; }

// les sélecteurs de premier niveau d'une feuille (dans les @media aussi) et les noms d'animations
function analyserCss(css) {
  const out = { selecteurs: [], keyframes: [] };
  const s = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  const lire = function (fin) {
    while (i < s.length) {
      const o = s.indexOf('{', i), f = s.indexOf('}', i);
      if (f >= 0 && (o < 0 || f < o)) { i = f + 1; if (fin) return; continue; }
      if (o < 0) return;
      const tete = s.slice(i, o).trim();
      i = o + 1;
      if (/^@keyframes/.test(tete)) { out.keyframes.push(tete.replace(/^@keyframes\s+/, '')); let n = 1; while (i < s.length && n) { if (s[i] === '{') n++; else if (s[i] === '}') n--; i++; } continue; }
      if (/^@(media|supports|container|layer)/.test(tete)) { lire(true); continue; }
      if (/^@font-face/.test(tete)) { const f2 = s.indexOf('}', i); i = f2 + 1; continue; }
      out.selecteurs.push(tete);
      const f2 = s.indexOf('}', i); i = f2 < 0 ? s.length : f2 + 1;
    }
  };
  lire(false);
  return out;
}

function controler(filtre) {
  const defauts = B.ERREURS.map(function (e) { return 'chargement : ' + e; });
  const keyframes = {};
  const ids = Object.keys(B.VARIANTES).filter(function (id) { return !filtre || id === filtre || id.indexOf(filtre + '.') === 0; });
  let rendus = 0;
  ids.forEach(function (id) {
    const v = B.VARIANTES[id];
    // la feuille : sous sa classe, et des animations à son nom
    const ex0 = V.exemple('clim');
    const x0 = R.contexte({ slug: 'controle', spec: ex0 }, { mode: 'apercu', optimiseur: false });
    let css = '';
    try { css = typeof v.css === 'function' ? v.css(x0.ctx) : String(v.css || ''); } catch (e) { defauts.push(id + ' : css plante (' + e.message + ')'); }
    const a = analyserCss(css);
    a.selecteurs.forEach(function (sel) { sel.split(',').forEach(function (x) { x = x.trim(); if (x && x.indexOf(v.classe) < 0 && !/^(from|to|\d+%)$/.test(x)) defauts.push(id + ' : sélecteur hors de sa classe « ' + x.slice(0, 80) + ' »'); }); });
    a.keyframes.forEach(function (k) { if (!/^k-/.test(k)) defauts.push(id + ' : animation « ' + k + ' » à nommer k-…'); if (keyframes[k] && keyframes[k] !== id) defauts.push(id + ' : animation « ' + k + ' » déjà définie par ' + keyframes[k]); keyframes[k] = id; });
    if (v.js) v.js.forEach(function (m) { if (!require('../lib/sites/rubriques/mouvement').MODULES[m]) defauts.push(id + ' : module de mouvement inconnu « ' + m + ' »'); });
    Object.keys(V.EXEMPLES).forEach(function (e) {
      v.surfaces.slice(0, 3).forEach(function (surf) {
        const sp = V.exemple(e);
        const site = { slug: 'controle-' + e, spec: sp };
        const x = R.contexte(site, { mode: 'apercu', optimiseur: false });
        if (!B.possible(v, sp, x.ctx)) return;
        const base = C.composer(sp, x.ctx, {});
        const nav = base.blocs.find(function (b) { return b.rubrique === 'nav'; }), pied = base.blocs.find(function (b) { return b.rubrique === 'pied'; });
        const bloc = { rubrique: v.rubrique, id: id, surface: surf, fond: surf === 'champ' ? 'maille' : null };
        const blocs = v.rubrique === 'nav' ? [Object.assign({}, bloc, { surface: 'fond' }), base.blocs.find(function (b) { return b.rubrique === 'hero'; }), pied] : v.rubrique === 'pied' ? [nav, Object.assign({}, bloc, { surface: surf })] : [nav, bloc, pied];
        let r;
        try { r = R.rendre(site, { mode: 'apercu', optimiseur: false, compo: Object.assign({}, base, { blocs: blocs.filter(Boolean) }) }); } catch (err) { defauts.push(id + ' / ' + e + ' / ' + surf + ' : le rendu plante (' + err.message + ')'); return; }
        rendus++;
        const html = r.files[0].data;
        r.erreurs.forEach(function (m) { defauts.push(id + ' / ' + e + ' / ' + surf + ' : ' + m); });
        if (r.utilisees.indexOf(id) < 0) { defauts.push(id + ' / ' + e + ' / ' + surf + ' : possible mais ne rend rien'); return; }
        const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
        const casse = visible.match(/undefined|NaN|\[object Object\]|>null<|="null"/);
        if (casse) defauts.push(id + ' / ' + e + ' / ' + surf + ' : texte cassé « ' + casse[0] + ' »');
        (visible.match(/(?:href|src)="([^"]*)"/g) || []).forEach(function (m) { const u = m.replace(/^(href|src)="/, '').replace(/"$/, '').replace(/&amp;/g, '&'); if (!lienOk(u)) defauts.push(id + ' / ' + e + ' : lien inattendu ' + u.slice(0, 80)); });
        const ouvre = (visible.match(/<section\b/g) || []).length, ferme = (visible.match(/<\/section>/g) || []).length;
        if (ouvre !== ferme) defauts.push(id + ' / ' + e + ' : balises section déséquilibrées (' + ouvre + '/' + ferme + ')');
        if (/<h1\b/.test(visible) && (visible.match(/<h1\b/g) || []).length > 1) defauts.push(id + ' / ' + e + ' : plusieurs h1');
      });
    });
  });
  return { defauts: defauts.filter(function (d, k, t) { return t.indexOf(d) === k; }), variantes: ids.length, rendus: rendus };
}

if (require.main === module) {
  const f = (process.argv.find(function (x) { return x.indexOf('--variante=') === 0; }) || '').split('=')[1];
  const r = controler(f);
  console.log(r.variantes + ' variante(s), ' + r.rendus + ' rendu(s), ' + r.defauts.length + ' défaut(s)');
  r.defauts.slice(0, 200).forEach(function (d) { console.log('- ' + d); });
  process.exit(r.defauts.length ? 1 : 0);
}
module.exports = { controler, analyserCss };
