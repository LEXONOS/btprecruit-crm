// Serveur local pour regarder la tour sans Vercel : node test/serve.js [--demo] [--port 8790]
// Sans --demo : base en mémoire + faux réseau + un premier cycle simulé, et un peu d'activité factice
// pour voir les messages voyager (uniquement ici, jamais en production).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const DEMO = process.argv.indexOf('--demo') >= 0;
const PORT = Number((process.argv.find(function (a) { return /^--port=/.test(a); }) || '--port=8790').split('=')[1]);
const RACINE = path.join(__dirname, '..');
const THREE = process.env.THREE_DIR || '/tmp/claude-0/-home-claude/dfcd46f1-fed0-583b-9c1b-956e7448c6b7/scratchpad/three/node_modules/three';

let db = null;
if (!DEMO) {
  process.env.ANTHROPIC_API_KEY = 'test';
  process.env.GOOGLE_MAPS_API_KEY = 'test';
  require('./fakes');
  const DB = require('../lib/db');
  db = DB.memory();
  DB.forcer(db);
}
const hq = require('../api/hq');
const tick = require('../api/tick');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.sql': 'text/plain; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function adapter(req, res, handler) {
  let corps = '';
  req.on('data', function (c) { corps += c; });
  req.on('end', async function () {
    const u = new URL(req.url, 'http://local');
    req.query = Object.fromEntries(u.searchParams);
    try { req.body = corps ? JSON.parse(corps) : {}; } catch (e) { req.body = {}; }
    await handler(req, res);
  });
}

http.createServer(function (req, res) {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/api/hq') return adapter(req, res, hq);
  if (u.pathname === '/api/tick') return adapter(req, res, tick);
  let f;
  if (u.pathname.indexOf('/three/') === 0) f = path.join(THREE, u.pathname.slice(7));
  else f = path.join(RACINE, u.pathname === '/' ? 'index.html' : u.pathname);
  fs.readFile(f, function (err, data) {
    if (err) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
    if (path.basename(f) === 'index.html') {
      data = String(data).replace('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js', '/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/', '/three/examples/jsm/')
        .replace(/<link[^>]+fonts\.googleapis[^>]+>/g, '');
    }
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', async function () {
  console.log('La tour en local : http://127.0.0.1:' + PORT + (DEMO ? ' (mode démo)' : ''));
  if (DEMO) return;
  const runtime = require('../lib/runtime');
  await runtime.semer(db);
  db.tables.hq_agents.forEach(function (a) { if (a.kind !== 'attente') a.next_run_at = new Date(Date.now() - 60000).toISOString(); });
  const r = await runtime.cycle({ db: db, secondes: 250 });
  console.log('Premier cycle simulé :', r.passages.length, 'passages');
  // activité factice pour voir la scène vivre
  const ids = db.tables.hq_agents.filter(function (a) { return a.kind !== 'attente'; }).map(function (a) { return a; });
  setInterval(function () {
    const a = ids[Math.floor(Math.random() * ids.length)];
    if (!a.parent_id) return;
    db.tables.hq_messages.push({ id: (db.tables.hq_messages.length + 1000), from_id: a.id, to_id: a.parent_id, company_id: a.company_id, kind: ['rapport', 'rapport', 'note', 'proposition'][Math.floor(Math.random() * 4)], subject: 'Point de ' + a.name, body: 'Activité simulée en local.', created_at: new Date().toISOString() });
    ids.forEach(function (x) { if (x.status === 'working' && Math.random() < 0.5) x.status = 'idle'; });
    const w = ids[Math.floor(Math.random() * ids.length)]; w.status = 'working';
    db.tables.hq_agents.forEach(function (x) { const y = ids.find(function (z) { return z.id === x.id; }); if (y) x.status = y.status; });
  }, 2500);
});
