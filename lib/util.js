'use strict';
const { TZ } = require('./config');

function jourGP(d) { return (d || new Date()).toLocaleDateString('sv-SE', { timeZone: TZ }); } // YYYY-MM-DD
function heureGP(d) {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d || new Date());
  const h = Number((p.find(function (x) { return x.type === 'hour'; }) || {}).value || 0);
  const m = Number((p.find(function (x) { return x.type === 'minute'; }) || {}).value || 0);
  return h + m / 60;
}
function quandGP(d) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d || new Date());
}
function minuitGP(d) { return new Date(jourGP(d) + 'T00:00:00-04:00'); }
// les minutes jusqu'au prochain minuit des Antilles (+ marge) : un plafond du jour atteint attend sa remise à zéro, pas plus
function jusquaDemainGP(marge) { const t = minuitGP(new Date(Date.now() + 24 * 3600000)); return Math.max(15, Math.ceil((t - Date.now()) / 60000) + (marge == null ? 5 : marge)); }

function court(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
// Comme court, mais garde les retours à la ligne (corps d'email)
function coupe(s, n) { s = String(s == null ? '' : s).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function sansAccents(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function dormir(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function nettoie(s) { return String(s == null ? '' : s).replace(/—|–/g, ', ').replace(/ ,/g, ','); } // pas de tirets longs

async function fetchTexte(url, opts) {
  opts = opts || {};
  const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(opts.timeout || 12000) }, opts));
  const t = await r.text();
  return { status: r.status, ok: r.ok, text: t, headers: r.headers };
}

// Exécute des tâches en parallèle (n à la fois)
async function parallele(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function ouvrier() {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { erreur: String(e.message || e) }; }
    }
  }
  await Promise.all(Array(Math.min(n, items.length || 1)).fill(0).map(ouvrier));
  return out;
}

module.exports = { coupe, jourGP, heureGP, quandGP, minuitGP, jusquaDemainGP, court, sansAccents, dormir, nettoie, fetchTexte, parallele };
