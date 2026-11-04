// Captures de la vitrine (ou de n'importe quelle page) : node test/capture.js --base=http://localhost:8793 --sortie=/dossier
//   --chemins=/site/clim,/variante/hero.voile/clim  --largeurs=1440,390  [--pleine=1] [--hauteur=900]
// Les apparitions sont jouées d'un coup (?tout=1) pour voir l'état final ; --pleine=1 capture toute la page.
'use strict';
const path = require('path');
const fs = require('fs');
const arg = function (n, d) { const a = process.argv.find(function (x) { return x.indexOf('--' + n + '=') === 0; }); return a ? a.split('=').slice(1).join('=') : d; };

(async function () {
  const { chromium } = require('playwright');
  const base = arg('base', 'http://localhost:8793');
  const sortie = arg('sortie', path.join(process.cwd(), 'captures'));
  const chemins = arg('chemins', '/site/clim').split(/,(?=\/)/).filter(Boolean);
  const largeurs = arg('largeurs', '1440,390').split(',').map(Number);
  const pleine = arg('pleine', '1') === '1';
  const hauteur = Number(arg('hauteur', 900));
  // --calme=1 : mouvement réduit, comme les captures de Miranda
  const calme = arg('calme', '0') === '1';
  fs.mkdirSync(sortie, { recursive: true });
  const nav = await chromium.launch();
  const out = [];
  for (const l of largeurs) {
    const ctx = await nav.newContext({ viewport: { width: l, height: l < 700 ? 844 : hauteur }, deviceScaleFactor: 1, reducedMotion: calme ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', function (e) { erreurs.push(e.message); });
    page.on('console', function (m) { if (m.type() === 'error') erreurs.push(m.text()); });
    for (const c of chemins) {
      const u = base + c + (c.indexOf('?') >= 0 ? '&' : '?') + 'tout=1';
      await page.goto(u, { waitUntil: 'networkidle' });
      // on descend toute la page (les images « lazy » se chargent), puis on remonte
      await page.evaluate(async function () { document.documentElement.style.scrollBehavior = 'auto'; const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += Math.round(window.innerHeight * 0.8)) { window.scrollTo(0, y); await new Promise(function (r) { setTimeout(r, 120); }); } window.scrollTo(0, 0); });
      await page.waitForLoadState('networkidle');
      // toutes les images chargées et décodées avant la capture (sinon des cadres vides qui n'en sont pas)
      await page.evaluate(function () { return Promise.all([].slice.call(document.images).map(function (i) { i.loading = 'eager'; return (i.complete ? Promise.resolve() : new Promise(function (r) { i.onload = i.onerror = r; })).then(function () { return i.decode ? i.decode().catch(function () {}) : null; }); })); });
      await page.waitForTimeout(400);
      const debord = await page.evaluate(function () { return document.documentElement.scrollWidth - window.innerWidth; });
      const errs = await page.evaluate(function () { return document.body.getAttribute('data-erreurs') || ''; });
      const nom = c.replace(/^\//, '').replace(/[^a-z0-9.-]+/gi, '_') + '-' + l + '.png';
      await page.screenshot({ path: path.join(sortie, nom), fullPage: pleine });
      out.push(nom + (debord > 0 ? ' DÉBORDE de ' + debord + ' px' : '') + (errs ? ' ERREURS : ' + errs : '') + (erreurs.length ? ' JS : ' + erreurs.splice(0).join(' ; ') : ''));
    }
    await ctx.close();
  }
  await nav.close();
  console.log(out.join('\n'));
})().catch(function (e) { console.error(e); process.exit(1); });
