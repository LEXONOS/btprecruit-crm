// Les outils communs de l'usine du studio des créatrices (montage.js) : lancer un programme, les mots forts d'une phrase,
// les sous-titres SRT, parler à la tour (secret partagé) et envoyer un fichier dans le stockage par un lien signé.
// Aucune dépendance npm : l'usine de montage n'installe que Python (la voix) et ffmpeg.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const journal = (...x) => console.log('[montage]', ...x);

function lancer(cmd, args, entree, opts) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, Object.assign({ stdio: ['pipe', 'pipe', 'pipe'] }, opts || {}));
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', ko);
    p.on('close', (c) => (c === 0 ? ok(out) : ko(new Error(path.basename(cmd) + ' : ' + (err || out).slice(-700)))));
    if (entree != null) p.stdin.end(entree); else p.stdin.end();
  });
}

// les mots d'une phrase, avec les mots forts (*mot* ou *plusieurs mots*) : la voix les dit sans étoiles, l'écran les
// met en couleur
function motsForts(voix) {
  let ouvert = false;
  return String(voix || '').split(/\s+/).filter(Boolean).map((w) => {
    const n = (w.match(/\*/g) || []).length;
    const fort = ouvert || n > 0;
    if (n % 2) ouvert = !ouvert;
    return { m: w.replace(/\*/g, ''), fort };
  }).filter((x) => x.m);
}

// chinois et japonais (écrits sans espaces) : le texte sans étoiles, et pour chaque caractère s'il est dans un mot fort
function fortsCJK(voix) {
  let ouvert = false, texte = '';
  const forts = [];
  String(voix || '').replace(/\s+/g, ' ').trim().split('').forEach((ch) => {
    if (ch === '*') { ouvert = !ouvert; return; }
    texte += ch;
    forts.push(ouvert);
  });
  return { texte: texte.trim(), forts };
}

function horodatage(x) {
  const ms = Math.max(0, Math.round(x * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(ms % 1000).padStart(3, '0');
}
function srt(segments, sep) {
  let n = 0, out = '';
  const s = sep == null ? ' ' : sep;
  segments.forEach((sg) => {
    const mots = sg.mots || [];
    for (let i = 0; i < mots.length; i += 7) { const g = mots.slice(i, i + 7); out += (++n) + '\n' + horodatage(g[0].t0) + ' --> ' + horodatage(g[g.length - 1].t1) + '\n' + g.map((m) => m.m).join(s) + '\n\n'; }
  });
  return out;
}

// la tour : GET pour la commande, POST pour les liens d'envoi et le compte rendu ; jamais une autre adresse que HQ_TOUR
async function tour(op, corps, methode) {
  const base = String(process.env.HQ_TOUR || '').replace(/\/$/, '');
  const secret = String(process.env.HQ_USINE_SECRET || '');
  if (!base || !secret) throw new Error('HQ_TOUR et HQ_USINE_SECRET sont nécessaires');
  const h = { 'x-usine': secret, 'content-type': 'application/json', 'user-agent': 'la-tour-usine' };
  if (process.env.HQ_BYPASS) h['x-vercel-protection-bypass'] = process.env.HQ_BYPASS;
  const url = base + '/api/usine' + (methode === 'GET' ? '?' + new URLSearchParams(Object.assign({ op }, corps)).toString() : '');
  let derniere;
  for (let essai = 0; essai < 4; essai++) {
    try {
      const r = await fetch(url, { method: methode || 'POST', headers: h, body: methode === 'GET' ? undefined : JSON.stringify(Object.assign({ op }, corps)), signal: AbortSignal.timeout(60000) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return d;
      if (r.status < 500 && r.status !== 429) throw Object.assign(new Error('tour : ' + (d.erreur || d.error || r.status)), { definitif: true });
      derniere = new Error('tour : HTTP ' + r.status);
    } catch (e) { if (e.definitif) throw e; derniere = e; }
    await new Promise((ok) => setTimeout(ok, 3000 * (essai + 1)));
  }
  throw derniere;
}

async function televerser(url, fichier, type) {
  const corps = fs.readFileSync(fichier);
  for (let essai = 0; essai < 3; essai++) {
    const r = await fetch(url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'true' }, body: corps, signal: AbortSignal.timeout(300000) }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
    if (r.ok) return;
    if (essai === 2) throw new Error('envoi de ' + path.basename(fichier) + ' refusé : ' + r.status + ' ' + String(await r.text()).slice(0, 200));
    await new Promise((ok) => setTimeout(ok, 4000));
  }
}

// Le stockage de la tour (Supabase, offre gratuite) refuse tout fichier de plus de 50 Mo : la vidéo d'Emma de deux
// minutes en anglais (53 Mo) était refusée à l'envoi, deux fois, et la tour attendait 70 minutes pour rien. La vidéo
// vise 44 Mo au plus, quelle que soit sa durée : le débit maximum de l'image suit la durée (6 Mbit/s au plus, assez pour
// des sous-titres nets) ; si le fichier dépasse encore 48 Mo, il est réencodé plus léger avant l'envoi.
const CIBLE_OCTETS = 44 * 1048576;
const LIMITE_OCTETS = 48 * 1048576;
function debitVideo(duree, audioKbps) {
  const total = (CIBLE_OCTETS * 8) / Math.max(5, Number(duree) || 60) / 1000;
  return Math.max(700, Math.min(6000, Math.floor(total - (audioKbps || 192) - 60)));
}
// un fichier trop lourd : l'image réencodée au débit qui tient sous la cible (le son est gardé tel quel)
async function alleger(ffmpeg, fichier, duree) {
  const taille = fs.statSync(fichier).size;
  if (taille <= LIMITE_OCTETS) return taille;
  const k = Math.max(500, Math.floor(debitVideo(duree) * 0.85 * LIMITE_OCTETS / taille));
  const tmp = fichier.replace(/\.mp4$/, '') + '-leger.mp4';
  await lancer(ffmpeg, ['-y', '-loglevel', 'error', '-i', fichier, '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', k + 'k', '-maxrate', k + 'k', '-bufsize', (2 * k) + 'k', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, fichier);
  const apres = fs.statSync(fichier).size;
  journal('fichier allégé', (taille / 1048576).toFixed(1) + ' Mo → ' + (apres / 1048576).toFixed(1) + ' Mo');
  if (apres > LIMITE_OCTETS) throw new Error('vidéo trop lourde pour le stockage même allégée (' + (apres / 1048576).toFixed(1) + ' Mo, 48 au plus)');
  return apres;
}

module.exports = { journal, lancer, motsForts, fortsCJK, srt, horodatage, tour, televerser, debitVideo, alleger, CIBLE_OCTETS, LIMITE_OCTETS };
