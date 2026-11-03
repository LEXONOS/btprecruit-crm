// WhatsApp par Kapso (au-dessus de l'API officielle de Meta), prêt à brancher. Règle de Meta et règle de la maison :
// on ne démarche jamais par WhatsApp. Le client écrit le premier (lien wa.me dans nos emails), on lui répond dans la
// fenêtre de 24 h ouverte par son message. La tour est protégée : pas de webhook entrant, on relève les messages.
// Variables : HQ_WHATSAPP_KEY (clé de projet Kapso), HQ_WHATSAPP_NUMERO (identifiant du numéro chez Kapso),
// HQ_WHATSAPP_TEL (le numéro tel qu'il s'affiche, ex. +596 696 12 34 56).
'use strict';
const BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0/';
let FORCE = null;                  // tests : fetch simulé
function forcer(f) { FORCE = f; }

function cle() { return String(process.env.HQ_WHATSAPP_KEY || '').trim(); }
function numero() { return String(process.env.HQ_WHATSAPP_NUMERO || '').trim(); }
function tel() { return String(process.env.HQ_WHATSAPP_TEL || '').trim(); }
function branche() { return !!(cle() && numero()); }
const chiffres = function (t) { return String(t || '').replace(/[^\d]/g, ''); };
// Le lien qui ouvre une conversation avec nous (à mettre dans un email ou sur un aperçu)
function lien() { const d = chiffres(tel()); return branche() && d ? 'https://wa.me/' + d : null; }

async function api(methode, chemin, corps, params, opts) {
  opts = opts || {};
  const k = opts.cle || cle(), n = opts.numero || numero();
  if (!k || !n) throw new Error('WhatsApp non branché (HQ_WHATSAPP_KEY, HQ_WHATSAPP_NUMERO)');
  const q = params ? '?' + Object.keys(params).filter(function (x) { return params[x] != null && params[x] !== ''; }).map(function (x) { return encodeURIComponent(x) + '=' + encodeURIComponent(params[x]); }).join('&') : '';
  const f = FORCE || fetch;
  const r = await f(BASE + encodeURIComponent(n) + chemin + q, { method: methode, headers: { 'X-API-Key': k, 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined, signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(function () { return {}; });
  if (!r.ok) { const e = new Error('WhatsApp : ' + ((d.error && d.error.message) || r.status)); e.statut = r.status; e.code = d.error && (d.error.code || d.error.error_subcode); throw e; }
  return d;
}

// Envoie un texte, à un numéro, ou à l'identifiant WhatsApp d'un client qui écrit sous un nom d'utilisateur sans montrer
// son numéro (champ recipient, ex. « US.1349... »). Hors de la fenêtre de 24 h, Meta refuse (code 131047) : fenetre = true.
const estNumero = function (t) { return /^\+?[\d\s.()-]{6,}$/.test(String(t || '').trim()) && !/[a-z]/i.test(String(t || '')); };
async function envoyer(to, texte) {
  const corps = { messaging_product: 'whatsapp', recipient_type: 'individual', type: 'text', text: { body: String(texte).slice(0, 4000), preview_url: true } };
  if (estNumero(to)) corps.to = chiffres(to); else corps.recipient = String(to).trim();
  try {
    const d = await api('POST', '/messages', corps);
    return { id: (d.messages && d.messages[0] && d.messages[0].id) || null };
  } catch (e) {
    if (e.code === 131047 || /131047|24.?h|re-?engagement|customer service window/i.test(e.message)) e.fenetre = true;
    throw e;
  }
}

// Les messages reçus depuis une date (ISO), du plus ancien au plus récent, par pages de 100
async function recus(depuisIso, opts) {
  const out = [];
  let apres = null;
  for (let page = 0; page < 20; page++) {
    const d = await api('GET', '/messages', null, { direction: 'inbound', since: depuisIso, limit: 100, after: apres, fields: 'kapso(direction,content,contact_name,has_media,media_url,media_data,message_type_data)' }, opts);
    (d.data || []).forEach(function (m) {
      const k = m.kapso || {}, md = k.media_data || {}, obj = m[m.type] || {};
      out.push({ id: m.id, de: m.from ? '+' + chiffres(m.from) : null, uid: m.from_user_id || null, nom: k.contact_name || m.username || null, type: m.type,
        texte: (m.text && m.text.body) || obj.caption || k.content || (m.type !== 'text' ? '[' + m.type + ']' : ''),
        media: k.has_media ? (k.media_url || md.url || null) : null, media_type: md.content_type || obj.mime_type || null, media_nom: md.filename || obj.filename || null, media_taille: md.byte_size || null,
        le: new Date(Number(m.timestamp || 0) * 1000 || Date.now()).toISOString() });
    });
    apres = d.paging && d.paging.cursors && d.paging.cursors.after;
    if (!apres || !(d.data || []).length) break;
  }
  // un client sans numéro visible (nom d'utilisateur WhatsApp) garde son identifiant : jamais de message perdu
  return out.filter(function (m) { return m.de || m.uid; }).sort(function (a, b) { return a.le < b.le ? -1 : 1; });
}
// Télécharge un média reçu (photo, logo) ; la clé n'est envoyée qu'à Kapso
async function media(url, max) {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('média : adresse non sûre');
  const f = FORCE || fetch;
  const r = await f(url, { headers: /(^|\.)kapso\.ai$/i.test(u.hostname) ? { 'X-API-Key': cle() } : {}, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('média : HTTP ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length > (max || 8000000)) throw new Error('média trop lourd');
  return { contenu: b, type: (r.headers && r.headers.get && r.headers.get('content-type')) || null };
}

// Vérifie une clé et un numéro avant de les enregistrer (mise en route depuis la tour)
async function tester(k, n) {
  await api('GET', '/messages', null, { direction: 'inbound', limit: 1 }, { cle: k, numero: n });
  return true;
}

module.exports = { branche, envoyer, recus, media, tester, lien, tel, forcer, estNumero };
