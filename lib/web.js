// Lecture de pages publiques sans risque (jamais d'adresse interne) + audit d'un site prospect.
'use strict';
const ND = require('./chasse/nd-moteur');

const UA = ND.UA_WEB;

async function telecharger(url, maxOctets) {
  let u;
  try { u = new URL(url); } catch (e) { return { erreur: 'adresse invalide' }; }
  if (!/^https?:$/.test(u.protocol)) return { erreur: 'protocole refusé' };
  const signal = AbortSignal.timeout(12000);
  let courante = u.href, r = null;
  for (let saut = 0; saut < 5; saut++) {
    const h = new URL(courante);
    if (h.port || h.username || !(await ND.hotePublic(h.hostname))) return { erreur: 'adresse non publique' };
    r = await fetch(courante, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9' }, signal: signal });
    const loc = r.status >= 300 && r.status < 400 && r.headers.get('location');
    if (!loc) break;
    courante = new URL(loc, courante).href;
    try { if (r.body && r.body.cancel) r.body.cancel(); } catch (e) { /* rien */ }
  }
  if (!r || (r.status >= 300 && r.status < 400)) return { erreur: 'trop de redirections' };
  const type = r.headers.get('content-type') || '';
  if (!/html|text|json|xml/i.test(type)) return { erreur: 'pas une page texte (' + type + ')', statut: r.status };
  const html = await ND.lireTexte(r, maxOctets || 400000);
  return { html: html, statut: r.status, url: courante };
}

// Image publique (jpeg, png, webp), avec les mêmes protections que les pages : jamais d'adresse interne
async function telechargerImage(url, maxOctets) {
  let u;
  try { u = new URL(url); } catch (e) { return { erreur: 'adresse invalide' }; }
  if (!/^https?:$/.test(u.protocol)) return { erreur: 'protocole refusé' };
  const signal = AbortSignal.timeout(12000);
  let courante = u.href, r = null;
  for (let saut = 0; saut < 4; saut++) {
    const h = new URL(courante);
    if (h.port || h.username || !(await ND.hotePublic(h.hostname))) return { erreur: 'adresse non publique' };
    r = await fetch(courante, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5' }, signal: signal });
    const loc = r.status >= 300 && r.status < 400 && r.headers.get('location');
    if (!loc) break;
    courante = new URL(loc, courante).href;
  }
  if (!r || !r.ok) return { erreur: 'HTTP ' + (r ? r.status : '?') };
  const type = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(type) < 0) return { erreur: 'type refusé (' + type + ')' };
  const max = maxOctets || 900000;
  const lg = Number(r.headers.get('content-length') || 0);
  if (lg && lg > max) { try { r.body.cancel(); } catch (e) { /* rien */ } return { erreur: 'trop lourde' }; }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > max) return { erreur: 'trop lourde' };
  return { data: buf, type: type, url: courante };
}

function liensDe(html, base) {
  const out = [], vus = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 60) {
    try {
      const href = new URL(m[1], base).href;
      if (!/^https?:/.test(href) || vus.has(href)) continue;
      vus.add(href);
      out.push({ url: href, texte: ND.texteDe(m[2]).slice(0, 80) });
    } catch (e) { /* lien cassé */ }
  }
  return out;
}

// Outil des agents : lire une page
async function lirePage(url) {
  try {
    const t = await telecharger(url);
    if (t.erreur) return { erreur: t.erreur };
    const texte = ND.texteDe(t.html);
    return {
      url: t.url, statut: t.statut, titre: ND.titreDe(t.html), texte: texte.slice(0, 6000),
      emails: ND.extraireEmails(t.html, new URL(t.url).hostname.replace(/^www\./, '')), tels: ND.extraireTels(texte),
      liens: liensDe(t.html, t.url).slice(0, 30)
    };
  } catch (e) { return { erreur: String(e.message || e).slice(0, 200) }; }
}

const GRATUITS = /(wixsite\.com|jimdosite|jimdofree|e-monsite|webnode|site123|sites\.google|weebly|godaddysites|business\.site|my\.canva|wordpress\.com|blogspot)/i;
const SOCIAUX = /(facebook\.com|fb\.me|instagram\.com|linktr\.ee|tiktok\.com|wa\.me|linkedin\.com|youtube\.com|pagesjaunes\.fr|google\.com\/maps|goo\.gl|business\.site)/i;
// Hébergeurs et constructeurs dont les adresses appartiennent à la plateforme, jamais au client
const PLATEFORMES = /(^|\.)(wix\.com|wixsite\.com|wixstudio\.io|editorx\.io|jimdo\.com|jimdosite\.com|jimdofree\.com|e-monsite\.com|webnode\.(fr|com|page)|site123\.me|google\.com|weebly\.com|godaddysites\.com|business\.site|canva\.site|my\.canva\.site|wordpress\.com|blogspot\.(com|fr)|over-blog\.com|free\.fr|orange\.fr|wanadoo\.fr|sfr\.fr|squarespace\.com|webflow\.io|netlify\.app|vercel\.app|github\.io|carrd\.co|strikingly\.com|mystrikingly\.com|ueniweb\.com|yolasite\.com|simplesite\.com|webself\.net|hubspotpagebuilder\.com|square\.site|myshopify\.com|shopify\.com|solocal\.com|pagesjaunes\.fr|business\.page|ovh\.net|ionos\.fr|1and1\.fr)$/i;
// Le domaine qui appartient vraiment au client (« garage-durand.fr ») : un domaine nu, jamais un sous-domaine
// (garage.wixsite.com, sites.google.com...) ni l'adresse d'un réseau social, sur lequel il ne pourrait rien régler.
function domaineAPropre(u) {
  let h = String(u || '').trim().toLowerCase();
  if (!h) return null;
  try { h = new URL(/^https?:\/\//.test(h) ? h : 'https://' + h).hostname; } catch (e) { return null; }
  h = h.replace(/^www\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]{2,63}\.[a-z]{2,24}$/.test(h)) return null;          // un seul point : un domaine nu
  if (PLATEFORMES.test(h) || SOCIAUX.test(h) || GRATUITS.test(h)) return null;
  return h;
}

// Audit d'un site prospect : état, conformité, mobile, âge, outil, contacts (accueil + contact + mentions)
async function auditer(site) {
  if (!site) return { etat: 'aucun' };
  let url = String(site).trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let host;
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return { etat: 'erreur' }; }
  if (SOCIAUX.test(url)) return { etat: 'reseau', url: url };
  let t = await telecharger(url).catch(function () { return { erreur: 'injoignable' }; });
  if (t.erreur && /^https:/.test(url)) t = await telecharger(url.replace(/^https:/, 'http:')).catch(function () { return { erreur: 'injoignable' }; });
  if (t.erreur) return { etat: 'erreur', url: url, detail: t.erreur };
  const domaine = (function () { try { return new URL(t.url).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return host; } })();
  const base = ND.classerSite(t.html, t.statut, t.url, domaine);
  const html = t.html, texte = ND.texteDe(html);
  const a = {
    etat: base.etat, url: t.url, titre: base.titre, outil: base.outil, fournisseur: base.fournisseur,
    https: /^https:/.test(t.url),
    gratuit: GRATUITS.test(t.url) || GRATUITS.test(html.slice(0, 50000)),
    mobile: /<meta[^>]+name=["']viewport["']/i.test(html),
    mentions_legales: /mentions[\s-]*l[ée]gales|legal[\s-]*notice|imprint/i.test(html),
    cookies: /cookie/i.test(html),
    annee: (function () { const ys = (texte.match(/(?:©|copyright|&copy;)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)/gi) || []).map(function (s) { return parseInt(s.match(/20\d\d/g).pop(), 10); }); return ys.length ? Math.max.apply(null, ys) : null; })(),
    emails: base.emails || [], tels: base.tels || []
  };
  // pages contact et mentions : souvent là que se trouve l'email
  if (a.etat === 'site' && a.emails.length === 0) {
    const liens = liensDe(html, t.url).filter(function (l) {
      try { return new URL(l.url).hostname.replace(/^www\./, '') === domaine && /contact|mention|legal|a-propos|about/i.test(l.url + ' ' + l.texte); } catch (e) { return false; }
    }).slice(0, 2);
    for (const l of liens) {
      const p = await telecharger(l.url, 200000).catch(function () { return { erreur: 1 }; });
      if (p.erreur) continue;
      if (/mention|legal/i.test(l.url + l.texte)) a.mentions_legales = true;
      const em = ND.extraireEmails(p.html, domaine).filter(function (e) { const d = e.split('@')[1] || ''; return d === domaine || d.endsWith('.' + domaine) || /^(gmail|hotmail|outlook|yahoo|orange|wanadoo|icloud|live|free|sfr|laposte)\./.test(d); });
      if (em.length) { a.emails = em; break; }
    }
  }
  // verdict
  const age = a.annee ? new Date().getFullYear() - a.annee : null;
  const defauts = [];
  if (!a.https) defauts.push('pas de https');
  if (!a.mentions_legales) defauts.push('pas de mentions légales visibles');
  if (!a.mobile) defauts.push('pas adapté au mobile');
  if (a.gratuit) defauts.push('site gratuit (' + (a.outil || 'constructeur') + ')');
  if (age != null && age >= 4) defauts.push('copyright ' + a.annee);
  a.defauts = defauts;
  if (a.etat === 'site') a.qualite = (a.gratuit || !a.https || !a.mobile || (age != null && age >= 4)) ? 'douteux' : 'correct';
  return a;
}

module.exports = { lirePage, auditer, telecharger, telechargerImage, liensDe, domaineAPropre, SOCIAUX, GRATUITS };
