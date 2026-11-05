// Le rendu : ouvre le moteur dans Chrome sans écran, calcule chaque image, et la passe à ffmpeg (H.264, 30 images/s).
// Sort aussi la vignette (l'image de l'accroche) et quelques images clés pour la critique.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { demarrer } = require('./serveur');

function chrome() {
  const c = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  for (const x of c) if (fs.existsSync(x)) return x;
  throw new Error('Chrome introuvable (variable CHROME)');
}

// La 3D sans carte graphique : lavapipe (Mesa, Vulkan sur le processeur, tous les cœurs) est environ dix fois plus
// rapide que SwiftShader, le moteur de secours de Chrome. L'usine l'installe ; sinon, on retombe sur SwiftShader.
const LAVAPIPE = ['/usr/share/vulkan/icd.d/lvp_icd.json', '/usr/share/vulkan/icd.d/lvp_icd.x86_64.json'].find((f) => fs.existsSync(f));
function drapeaux() {
  const base = ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--font-render-hinting=none', '--disable-accelerated-2d-canvas'];
  if (LAVAPIPE && process.env.STUDIO_GL !== 'swiftshader') return { args: base.concat(['--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--disable-vulkan-surface']), env: Object.assign({}, process.env, { VK_ICD_FILENAMES: LAVAPIPE }), moteur: 'lavapipe' };
  return { args: base.concat(['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), env: process.env, moteur: 'swiftshader' };
}

async function ouvrir(spec) {
  const srv = await demarrer();
  const d = drapeaux();
  const nav = await puppeteer.launch({ executablePath: chrome(), headless: true, args: d.args, env: d.env });
  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.text()); });
  await page.setViewport({ width: 400, height: 720, deviceScaleFactor: 1 });
  await page.goto(srv.url + '/usine/moteur/index.html', { waitUntil: 'load' });
  await page.waitForFunction('window.STUDIO && typeof window.STUDIO.preparer === "function"', { timeout: 30000 });
  const info = await page.evaluate((s) => window.STUDIO.preparer(s), spec).catch((e) => { throw new Error('moteur : ' + e.message + (erreurs.length ? ' | ' + erreurs.slice(0, 3).join(' | ') : '')); });
  return { page, nav, srv, info, erreurs, moteur: d.moteur };
}
async function fermer(x) { try { await x.nav.close(); } catch (e) { /* déjà fermé */ } x.srv.fermer(); }

const enBuffer = (dataUrl) => Buffer.from(String(dataUrl).split(',')[1] || '', 'base64');

// rend la vidéo muette ; options.images : instants des images clés ; options.vignette : instant de la vignette
async function rendre(spec, sortie, options) {
  options = options || {};
  const fps = options.fps || spec.fps || 30;
  const x = await ouvrir(spec);
  const t0 = Date.now();
  try {
    const duree = x.info.duree;
    const n = Math.max(1, Math.round(duree * fps));
    const ff = spawn(options.ffmpeg || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', options.preset || 'veryfast', '-crf', String(options.crf || 19), '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', sortie], { stdio: ['pipe', 'ignore', 'pipe'] });
    let errFf = '';
    ff.stderr.on('data', (d) => { errFf += d; });
    const fini = new Promise((ok, ko) => { ff.on('close', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg : ' + errFf.slice(-400))))); ff.on('error', ko); });
    for (let i = 0; i < n; i++) {
      const data = await x.page.evaluate((t) => window.STUDIO.capture(t, 0.93), i / fps);
      if (!ff.stdin.write(enBuffer(data))) await new Promise((ok) => ff.stdin.once('drain', ok));
      if (options.progres && i % 60 === 0) options.progres(i, n, Date.now() - t0);
    }
    ff.stdin.end();
    await fini;
    const sorties = { video: sortie, images: [], duree, frames: n, secondes: Math.round((Date.now() - t0) / 1000), moteur: x.moteur, avertissements: x.erreurs.filter((e) => !/favicon|404/.test(e)).slice(0, 5) };
    const dossier = path.dirname(sortie);
    if (options.vignette != null) { const f = path.join(dossier, 'vignette.jpg'); fs.writeFileSync(f, enBuffer(await x.page.evaluate((t) => window.STUDIO.capture(t, 0.9), options.vignette))); sorties.vignette = f; }
    for (const [k, t] of (options.images || []).entries()) { const f = path.join(dossier, 'cle-' + String(k + 1).padStart(2, '0') + '.jpg'); fs.writeFileSync(f, enBuffer(await x.page.evaluate((tt) => window.STUDIO.capture(tt, 0.82, 540), t))); sorties.images.push(f); }
    return sorties;
  } finally { await fermer(x); }
}

// quelques images fixes seulement (essais, critique sans vidéo)
async function photos(spec, instants, dossier, largeur) {
  const x = await ouvrir(spec);
  try {
    const out = [];
    for (const [k, t] of instants.entries()) { const f = path.join(dossier, 'photo-' + String(k + 1).padStart(2, '0') + '.jpg'); fs.writeFileSync(f, enBuffer(await x.page.evaluate((tt, l) => window.STUDIO.capture(tt, 0.88, l), t, largeur || 0))); out.push(f); }
    return { images: out, avertissements: x.erreurs.filter((e) => !/favicon|404/.test(e)).slice(0, 5), info: x.info, moteur: x.moteur };
  } finally { await fermer(x); }
}

module.exports = { rendre, photos };
