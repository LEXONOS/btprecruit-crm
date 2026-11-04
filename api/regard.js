// Le regard de Miranda : ouvre un aperçu dans un vrai navigateur (Chromium sans écran) et en rend des captures, sur
// ordinateur et sur téléphone, pour qu'elle juge le site tel que le prospect le verra. Réservé à la tour (secret du cron).
// POST { url } → { ok, version, ordinateur: { haut, morceaux: [jpeg base64], hauteur }, telephone: {...}, debord, erreurs }
// Sur un déploiement de prévisualisation seulement : GET ?essai=<url d'un aperçu> rend un petit bilan, sans image.
'use strict';
const A = require('../lib/acces');

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
// seulement les aperçus de Novalemo, en https : le projet des sites sur Vercel (et ses alias), le sous-domaine des
// aperçus de Louis (HQ_SITES_DOMAINE) et ceux listés dans HQ_REGARD_HOTES ; jamais une autre adresse
function hoteDe(v) { return String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, ''); }
function hotePermis(h) {
  const projet = String(require('../lib/config').NOVALEMO.projet_sites || 'novalemo-martinique').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (projet && new RegExp('^' + projet + '(-[a-z0-9-]+)?\\.vercel\\.app$').test(h)) return true;
  const autres = [hoteDe(process.env.HQ_SITES_DOMAINE)].concat(String(process.env.HQ_REGARD_HOTES || '').split(',').map(hoteDe)).filter(Boolean);
  return autres.indexOf(h) >= 0;
}
function urlPermise(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && !x.port && !x.username && !x.password && hotePermis(x.hostname.toLowerCase()) && /^\/a\/[a-z0-9-]+\/?$/.test(x.pathname); } catch (e) { return false; }
}

async function navigateur() {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;
  chromium.setGraphicsMode = false;
  return puppeteer.launch({ args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }), executablePath: await chromium.executablePath(), headless: 'shell', defaultViewport: null });
}

// une page parcourue de haut en bas (images chargées, apparitions jouées), puis découpée en morceaux
async function capturer(nav, url, o) {
  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', function (e) { erreurs.push(String(e.message || e).slice(0, 160)); });
  // la page ne parle qu'à son propre hôte (polices, images, tout est servi par l'aperçu) : une redirection ou une requête
  // vers ailleurs est coupée
  const hote = new URL(url).hostname;
  await page.setRequestInterception(true);
  page.on('request', function (q) {
    const u = q.url();
    if (/^(data|blob):/i.test(u)) return q.continue();
    let h = null; try { h = new URL(u).hostname; } catch (e) { h = null; }
    if (h === hote) return q.continue();
    return q.abort('blockedbyclient');
  });
  await page.setViewport({ width: o.largeur, height: o.hauteur, deviceScaleFactor: o.echelle, isMobile: !!o.mobile, hasTouch: !!o.mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // une page qui n'a pas fini de charger au bout de 25 s est quand même regardée telle qu'elle est
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 }).catch(function (e) { if (!/timeout/i.test(String(e && e.message))) throw e; });
  if (new URL(page.url()).hostname !== hote) throw new Error('la page a quitté l\'aperçu');
  await page.evaluate(async function () {
    // le retour en haut ne doit pas glisser (scroll-behavior:smooth décalerait la capture du premier écran)
    document.documentElement.style.scrollBehavior = 'auto';
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += Math.round(window.innerHeight * 0.85)) { window.scrollTo(0, y); await new Promise(function (r) { setTimeout(r, 90); }); }
    document.querySelectorAll('[data-r]').forEach(function (e) { e.classList.add('vu'); });
    window.scrollTo(0, 0);
  });
  // toutes les images chargées et décodées (8 s au plus) : sans ça, une photo encore en route ressemble à un cadre vide
  await page.evaluate(function () {
    const att = Promise.all([].slice.call(document.images).map(function (i) { i.loading = 'eager'; return (i.complete ? Promise.resolve() : new Promise(function (r) { i.onload = i.onerror = r; })).then(function () { return i.decode ? i.decode().catch(function () {}) : null; }); }));
    return Promise.race([att, new Promise(function (r) { setTimeout(r, 8000); })]);
  });
  await new Promise(function (r) { setTimeout(r, 600); });
  const info = await page.evaluate(function () {
    const m = document.querySelector('meta[name="novalemo:version"]');
    return { hauteur: document.documentElement.scrollHeight, debord: Math.max(0, document.documentElement.scrollWidth - window.innerWidth), version: m ? m.getAttribute('content') : null };
  });
  // toute la page en o.max morceaux au plus : un morceau s'allonge pour une page longue (jusqu'à o.pasMax), au-delà la
  // fin est signalée à Miranda comme non vue
  const pas = Math.min(o.pasMax, Math.max(o.pas, Math.ceil(info.hauteur / o.max)));
  const morceaux = [];
  for (let y = 0; y < info.hauteur && morceaux.length < o.max; y += pas) {
    const b = await page.screenshot({ type: 'jpeg', quality: 58, clip: { x: 0, y: y, width: o.largeur, height: Math.min(pas, info.hauteur - y) }, captureBeyondViewport: true });
    morceaux.push(b.toString('base64'));
  }
  const vue = Math.min(info.hauteur, pas * o.max);
  // le premier écran, net : c'est ce que le prospect voit en ouvrant le lien
  if (o.echelle !== 1) { await page.setViewport({ width: o.largeur, height: o.hauteur, deviceScaleFactor: 1, isMobile: !!o.mobile, hasTouch: !!o.mobile }); await new Promise(function (r) { setTimeout(r, 400); }); }
  await page.evaluate(function () { window.scrollTo(0, 0); });
  const haut = (await page.screenshot({ type: 'jpeg', quality: 72 })).toString('base64');
  await page.close();
  return { haut: haut, morceaux: morceaux, hauteur: info.hauteur, vue: vue, tronque: vue < info.hauteur, debord: info.debord, version: info.version, erreurs: erreurs.slice(0, 6) };
}

async function regarder(url) {
  const t0 = Date.now();
  const nav = await navigateur();
  try {
    // ordinateur : le premier écran en détail, puis toute la page à demi-échelle ; téléphone : toute la page ; les deux en
    // même temps (le temps d'un seul)
    const deux = await Promise.all([
      capturer(nav, url, { largeur: 1440, hauteur: 900, echelle: 0.5, pas: 2800, pasMax: 4000, max: 4 }),
      capturer(nav, url, { largeur: 390, hauteur: 844, echelle: 1, mobile: true, pas: 1500, pasMax: 2600, max: 6 })
    ]);
    const ordinateur = deux[0], telephone = deux[1];
    return { ok: true, ms: Date.now() - t0, version: ordinateur.version, ordinateur: ordinateur, telephone: telephone, debord: { ordinateur: ordinateur.debord, telephone: telephone.debord }, erreurs: ordinateur.erreurs.concat(telephone.erreurs).slice(0, 8) };
  } finally { await nav.close().catch(function () {}); }
}

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      // l'essai sur une prévisualisation : la preuve que le navigateur tourne, sans rien renvoyer d'autre qu'un bilan
      const u = new URL(req.url, 'https://x').searchParams.get('essai');
      if (process.env.VERCEL_ENV !== 'preview' || !u) return json(res, 404, { error: 'introuvable' });
      if (!urlPermise(u)) return json(res, 400, { error: 'adresse refusée (un aperçu Vercel seulement)' });
      const r = await regarder(u);
      return json(res, 200, { ok: r.ok, ms: r.ms, version: r.version, ordinateur: { hauteur: r.ordinateur.hauteur, morceaux: r.ordinateur.morceaux.length, haut_ko: Math.round(r.ordinateur.haut.length * 0.75 / 1024) }, telephone: { hauteur: r.telephone.hauteur, morceaux: r.telephone.morceaux.length }, debord: r.debord, erreurs: r.erreurs });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Méthode non autorisée' });
    if (!A.cronAutorise(req)) return json(res, 401, { error: 'Réservé à la tour' });
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const url = String((b && b.url) || '');
    if (!urlPermise(url)) return json(res, 400, { error: 'adresse refusée (un aperçu Vercel seulement)' });
    return json(res, 200, await regarder(url));
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e.message || e).slice(0, 300) });
  }
};
module.exports.urlPermise = urlPermise;
module.exports.regarder = regarder;
