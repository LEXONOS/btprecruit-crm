// Ce qu'on reprend du site actuel d'un prospect pour son aperçu : son texte (ses vrais services), ses photos,
// son logo, sa couleur. Uniquement SES contenus, lus sur SON site ; jamais d'images d'ailleurs.
'use strict';
const crypto = require('crypto');
const ND = require('../chasse/nd-moteur');
const { telecharger, telechargerImage, SOCIAUX } = require('../web');
const { parallele } = require('../util');

// Dimensions sans bibliothèque : en-têtes PNG, JPEG, WebP
function dimensions(b) {
  try {
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { l: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), l: b.readUInt16BE(i + 7) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const t = b.toString('ascii', 12, 16);
      if (t === 'VP8X') return { l: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (t === 'VP8 ') return { l: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (t === 'VP8L') { const x = b.readUInt32LE(21); return { l: 1 + (x & 0x3fff), h: 1 + ((x >> 14) & 0x3fff) }; }
    }
  } catch (e) { /* image illisible */ }
  return null;
}
function ext(type) { return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'; }
function sha1(b) { return crypto.createHash('sha1').update(b).digest('hex'); }

function attr(tag, nom) { const m = tag.match(new RegExp('\\b' + nom + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] || m[3] || m[4] || '') : ''; }
function absolu(u, base) { try { return new URL(String(u).trim().replace(/&amp;/g, '&'), base).href; } catch (e) { return null; } }

// couleur de marque : meta theme-color, sinon la couleur saturée la plus fréquente du HTML et des styles
function couleurDe(html) {
  const tc = (html.match(/<meta[^>]+name=["']theme-color["'][^>]*>/i) || [])[0];
  const c0 = tc && attr(tc, 'content');
  const sature = function (h) { const n = parseInt(h.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx - mn > 60 && mx > 70 && mn < 225; };
  if (c0 && /^#[0-9a-f]{6}$/i.test(c0) && sature(c0)) return c0.toLowerCase();
  const compte = {};
  (html.match(/#[0-9a-f]{6}\b/gi) || []).forEach(function (h) { h = h.toLowerCase(); if (sature(h)) compte[h] = (compte[h] || 0) + 1; });
  const top = Object.keys(compte).sort(function (a, b) { return compte[b] - compte[a]; })[0];
  return top && compte[top] >= 3 ? top : null;
}

async function lireSite(url, opts) {
  opts = opts || {};
  if (!url || SOCIAUX.test(url)) return null;
  let u = String(url).trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const t = await telecharger(u, 600000).catch(function () { return { erreur: 'injoignable' }; });
  if (t.erreur || !t.html) return null;
  const html = t.html, base = t.url;
  const texte = ND.texteDe(html).replace(/\s+/g, ' ').slice(0, 3500);
  const candidats = [];
  const vu = new Set();
  const ajouter = function (src, alt, role, poids) {
    const a = absolu(src, base);
    if (!a || vu.has(a) || /^data:/i.test(a) || /\.(svg|gif|ico)(\?|$)/i.test(a) || /(sprite|icon|favicon|pixel|tracking|spinner|loader|placeholder|blank)/i.test(a)) return;
    vu.add(a); candidats.push({ url: a, alt: String(alt || '').slice(0, 120), role: role, poids: poids || 0 });
  };
  (html.match(/<meta[^>]+(property|name)=["'](og:image|twitter:image)["'][^>]*>/gi) || []).forEach(function (m) { ajouter(attr(m, 'content'), '', 'photo', 3); });
  (html.match(/<img\b[^>]*>/gi) || []).slice(0, 80).forEach(function (tag) {
    let src = attr(tag, 'data-src') || attr(tag, 'data-lazy-src') || attr(tag, 'src');
    const srcset = attr(tag, 'srcset') || attr(tag, 'data-srcset');
    if (srcset) { const parts = srcset.split(',').map(function (x) { return x.trim().split(/\s+/); }).filter(function (x) { return x[0]; }); parts.sort(function (a, b) { return (parseInt(b[1], 10) || 0) - (parseInt(a[1], 10) || 0); }); if (parts[0]) src = parts[0][0]; }
    if (!src) return;
    const alt = attr(tag, 'alt'), indices = (src + ' ' + alt + ' ' + attr(tag, 'class') + ' ' + attr(tag, 'id')).toLowerCase();
    ajouter(src, alt, /logo/.test(indices) ? 'logo' : 'photo', /logo/.test(indices) ? 5 : 1);
  });
  const lus = await parallele(candidats.slice(0, opts.max || 10), 3, async function (c) {
    const r = await telechargerImage(c.url, c.role === 'logo' ? 300000 : 900000).catch(function () { return { erreur: 1 }; });
    if (r.erreur) return null;
    const d = dimensions(r.data);
    if (!d || !d.l || !d.h) return null;
    return Object.assign({}, c, { data: r.data, type: r.type, l: d.l, h: d.h, sha: sha1(r.data) });
  });
  const ok = lus.filter(Boolean);
  const logo = ok.filter(function (x) { return x.role === 'logo' && x.l >= 80 && x.l <= 2000 && x.h <= 1200; })[0] || null;
  const shas = new Set();
  const photos = ok.filter(function (x) { return x !== logo && x.l >= 640 && x.h >= 360 && x.l / x.h < 3.2 && x.h / x.l < 2.2; })
    .filter(function (x) { if (shas.has(x.sha)) return false; shas.add(x.sha); return true; })
    .sort(function (a, b) { return (b.poids - a.poids) || (b.l * b.h - a.l * a.h); }).slice(0, 6);
  return { url: base, titre: ND.titreDe(html), texte: texte, couleur: couleurDe(html), logo: logo, photos: photos };
}

module.exports = { lireSite, dimensions, ext, sha1, couleurDe };
