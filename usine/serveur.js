// Petit serveur de fichiers local pour le moteur 3D (la page du moteur, three.js et les polices du dépôt).
// Il n'écoute que sur 127.0.0.1, ne sert que la lecture, et jamais en dehors du dépôt.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.css': 'text/css' };

function demarrer() {
  return new Promise(function (ok, ko) {
    const srv = http.createServer(function (req, res) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
      let p;
      try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.statusCode = 400; return res.end(); }
      const fichier = path.resolve(RACINE, '.' + p);
      if (fichier !== RACINE && !fichier.startsWith(RACINE + path.sep)) { res.statusCode = 403; return res.end(); }
      fs.stat(fichier, function (err, st) {
        if (err || !st.isFile()) { res.statusCode = 404; return res.end(); }
        res.setHeader('Content-Type', TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(fichier).pipe(res);
      });
    });
    srv.on('error', ko);
    srv.listen(0, '127.0.0.1', function () { ok({ url: 'http://127.0.0.1:' + srv.address().port, fermer: function () { srv.close(); } }); });
  });
}

module.exports = { demarrer, RACINE };
