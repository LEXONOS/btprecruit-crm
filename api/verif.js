// api/verif.js — VERIFICATION DU SITE section par section (commence par le HEADER).
// Recoit { url, section:'header', brief, formule }.
//   1. va chercher la page en ligne (HTML) + ses CSS/JS lies (best effort)
//   2. fait des verifications DETERMINISTES sur le code -> jamais de bluff,
//      chaque point porte sa preuve. Ce que le code ne montre pas (comportement,
//      visuel) est renvoye en "a confirmer a l'oeil".
//   3. Claude (honnete, humble) : resume court + prompt de correction si besoin.
// Variable Vercel : ANTHROPIC_API_KEY (existe deja).

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

async function anthropic(payload) {
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Anthropic: ' + ((data.error && data.error.message) || r.status));
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function parseJSONLoose(text) {
  let t = (text || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s > 0 || e < t.length - 1) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

function normaliseUrl(u) {
  let s = (u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s;
}

const SYS_SECTION =
  'Tu es un relecteur web senior, honnete et humble, pour Novalem. On te donne le code d\'une SECTION d\'un site client (header, hero, etc.) et une liste de verifications DEJA faites automatiquement sur le code. ' +
  'Tu ne juges QUE sur ces elements, tu n\'inventes rien, tu ne felicites pas pour faire plaisir. ' +
  'Tu produis un resume honnete et court de l\'etat de cette section (2 a 3 phrases, francais simple). ' +
  'S\'il y a des points en defaut (status KO, ou probleme evident dans le code fourni), tu rediges un PROMPT DE CORRECTION pret a coller pour l\'assistant qui a construit le site : des consignes concretes et ciblees, en francais, sans tirets longs, sans blabla, qui ne portent QUE sur cette section. ' +
  'Si rien n\'est a corriger, laisse la correction vide (chaine vide). ' +
  'Reponds UNIQUEMENT en JSON strict, sans texte autour : {"resume":"...","correction":"..."}';
const SYS_TEXTES =
  'Tu es relecteur editorial pour Novalem, honnete et exigeant. On te donne TOUS les textes visibles d\'un site client. ' +
  'Tu reperes ce qui sonne "IA" ou generique : formules creuses (par exemple "dans un monde ou", "que vous soyez ... ou ..."), tournures passe-partout, superlatifs vides, tirets longs, remplissage. ' +
  'Tu produis un resume honnete (ces textes sonnent-ils IA ou naturels, 2 a 3 phrases). ' +
  'Si des passages sonnent IA, tu rediges un PROMPT DE CORRECTION pour l\'assistant qui a fait le site : cite les passages a revoir et explique comment les rendre plus naturels, concrets, humains, dans la voix du metier du client, phrases courtes, SANS tirets longs. ' +
  'Si les textes sont deja bons, laisse la correction vide. ' +
  'Reponds UNIQUEMENT en JSON strict : {"resume":"...","correction":"..."}';

function sysFor(section) { return section === 'textes' ? SYS_TEXTES : SYS_SECTION; }
function userFor(section, findings, region, formule) {
  if (section === 'textes') {
    return 'Formule du site : ' + (formule || '(non precisee)') + '\n\nTEXTES VISIBLES DU SITE :\n"""\n' + region.slice(0, 9000) + '\n"""';
  }
  return 'Section analysee : ' + section + '\n' +
    'Formule du site : ' + (formule || '(non precisee)') + '\n\n' +
    'VERIFICATIONS AUTOMATIQUES (source de verite, ne les contredis pas) :\n' + findings + '\n\n' +
    'CODE DE LA SECTION (peut etre tronque) :\n"""\n' + region.slice(0, 6000) + '\n"""';
}
function findingsOf(checks) { return checks.map(function (k) { return '- [' + k.status.toUpperCase() + '] ' + k.label + ' : ' + k.evidence; }).join('\n'); }
async function askClaude(systeme, user) {
  try {
    const t = await anthropic({ model: MODEL, max_tokens: 1400, system: systeme, messages: [{ role: 'user', content: user }] });
    const o = parseJSONLoose(t);
    return { resume: o.resume || '', correction: o.correction || '' };
  } catch (e) {
    return { resume: '(analyse IA indisponible : ' + (e.message || 'erreur') + '). Les verifications automatiques ci-dessus restent valables.', correction: '' };
  }
}

async function fetchText(url, cap) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: c.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NovalemBot/1.0; +https://studionovalem.fr)' },
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status };
    const txt = (await r.text()).slice(0, cap || 300000);
    return { ok: true, text: txt, url: r.url || url };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, err: e.name === 'AbortError' ? 'le site met trop de temps a repondre' : (e.message || 'erreur reseau') };
  }
}

function absUrl(base, href) { try { return new URL(href, base).href; } catch (e) { return null; } }

function headerRegion(html) {
  let m = html.match(/<header[\s\S]*?<\/header>/i);
  if (m) return { region: m[0], found: 'header' };
  let n = html.match(/<nav[\s\S]*?<\/nav>/i);
  if (n) return { region: n[0], found: 'nav' };
  let b = html.match(/<body[^>]*>([\s\S]*)/i);
  return { region: (b ? b[1] : html).slice(0, 5000), found: 'debut de body' };
}

function linkedAssets(html, base) {
  const css = [], js = [];
  (html.match(/<link\b[^>]*>/gi) || []).forEach(function (tag) {
    if (/rel\s*=\s*["']?\s*stylesheet/i.test(tag)) {
      const h = tag.match(/href\s*=\s*["']([^"']+)["']/i);
      if (h) { const u = absUrl(base, h[1]); if (u) css.push(u); }
    }
  });
  (html.match(/<script\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi) || []).forEach(function (tag) {
    const h = tag.match(/src\s*=\s*["']([^"']+)["']/i);
    if (h) { const u = absUrl(base, h[1]); if (u) js.push(u); }
  });
  return { css: css.slice(0, 4), js: js.slice(0, 4) };
}

function inlineOf(html, tag) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
  let out = '', m;
  while ((m = re.exec(html))) { out += '\n' + m[1]; if (out.length > 120000) break; }
  return out;
}

function analyseHeader(ctx) {
  const H = ctx.headerHtml, FULL = ctx.html;
  const CSS = (ctx.css || '').toLowerCase();
  const JS = (ctx.js || '').toLowerCase();
  const B = (ctx.brief || '').toLowerCase();
  const out = [];
  const push = (id, label, group, status, evidence) => out.push({ id, label, group, status, evidence });

  // Logo present
  const hasImgLogo = /<img[^>]+(?:src|alt|class)=["'][^"']*logo/i.test(H);
  const hasSvg = /<svg[\s>]/i.test(H);
  const hasBrandLink = /<a[^>]+class=["'][^"']*(?:logo|brand|navbar-brand)/i.test(H);
  if (hasImgLogo || hasSvg || hasBrandLink) push('logo', 'Logo present en haut', 'auto', 'ok', hasImgLogo ? 'image de logo trouvee dans le header' : (hasSvg ? 'logo vectoriel (svg) dans le header' : 'element de marque identifie'));
  else push('logo', 'Logo present en haut', 'auto', 'unknown', 'pas repere dans le code du header (peut-etre une image de fond CSS) : a confirmer');

  // Logo cliquable retour haut
  const linkHome = /<a[^>]+href=["'](?:#|\/|\.\/|index\.html|#top|#home|#accueil)["'][^>]*>[\s\S]{0,400}?(?:<img[^>]+logo|<svg|class=["'][^"']*(?:logo|brand))/i.test(H);
  if (linkHome) push('logo_clic', 'Logo cliquable (retour en haut)', 'auto', 'ok', 'le logo est dans un lien vers l\'accueil / le haut');
  else push('logo_clic', 'Logo cliquable (retour en haut)', 'auto', 'unknown', 'pas confirme dans le code : a confirmer');

  // Navigation
  const navCount = (H.match(/<a\b/gi) || []).length;
  if (/<nav[\s>]/i.test(H) || navCount >= 2) push('nav', 'Navigation presente et coherente', 'auto', 'ok', (/<nav/i.test(H) ? 'balise <nav> presente' : navCount + ' liens dans le header'));
  else push('nav', 'Navigation presente et coherente', 'auto', 'unknown', 'peu ou pas de liens de navigation reperes : a confirmer');

  // Reseaux (croise avec le brief)
  const soc = /(?:facebook|instagram|twitter|x\.com|linkedin|tiktok|youtu|wa\.me|whatsapp|snapchat)/i;
  const headerHasSoc = soc.test(H);
  const briefHasSoc = soc.test(B) || /r[eé]seau/.test(B);
  if (headerHasSoc) push('reseaux', 'Reseaux sociaux dans le header (si le client en a)', 'auto', 'ok', 'liens reseaux presents dans le header');
  else if (!briefHasSoc) push('reseaux', 'Reseaux sociaux dans le header (si le client en a)', 'auto', 'ok', 'le brief ne mentionne pas de reseaux : rien a ajouter');
  else push('reseaux', 'Reseaux sociaux dans le header (si le client en a)', 'auto', 'ko', 'le brief mentionne des reseaux mais aucun n\'est dans le header');

  // Bouton d'action
  const cta = /(?:<a|<button)[^>]*(?:class=["'][^"']*(?:btn|button|cta)|>[^<]{0,40}(?:contact|devis|appel|appeler|rendez|rdv|r[eé]serv|command|nous joindre|prendre|demander|whatsapp))/i;
  if (cta.test(H)) push('cta', 'Bouton d\'action visible dans le header', 'auto', 'ok', 'un bouton / lien d\'action est present dans le header');
  else push('cta', 'Bouton d\'action visible dans le header', 'auto', 'unknown', 'pas de bouton d\'action clair repere : a confirmer');

  // Base responsive
  const viewport = /<meta[^>]+name=["']viewport["'][^>]+width=device-width/i.test(FULL);
  const media = /@media/i.test(CSS);
  if (viewport && media) push('responsive', 'Base responsive presente', 'auto', 'ok', 'meta viewport + regles @media presentes');
  else if (!viewport) push('responsive', 'Base responsive presente', 'auto', 'ko', 'balise meta viewport manquante : le site ne s\'adaptera pas au mobile');
  else push('responsive', 'Base responsive presente', 'auto', 'unknown', 'viewport present mais aucune regle @media reperee : a confirmer');

  // tel / mailto
  if (/href=["'](?:tel:|mailto:)/i.test(FULL)) push('telmail', 'Telephone / email cliquables', 'auto', 'ok', 'au moins un lien tel: ou mailto: present');
  else push('telmail', 'Telephone / email cliquables', 'auto', 'unknown', 'aucun lien tel:/mailto: repere (pas toujours necessaire)');

  // Comportement au scroll (humain)
  const stickyHeader = /position\s*:\s*(?:sticky|fixed)/i.test(CSS);
  const scrollJs = /scroll/i.test(JS) && /(?:classlist|scrolltop|scrolly)/i.test(JS);
  push('scroll', 'Le header se condense / s\'allege au scroll', 'human', 'unknown', (stickyHeader || scrollJs) ? 'mecanisme repere dans le code (header sticky/fixed ou script au scroll) : confirme a l\'oeil' : 'aucun mecanisme repere : verifie a l\'oeil');

  // Hamburger (humain)
  const burger = /(?:hamburger|burger|menu-toggle|nav-toggle|navbar-toggler|aria-label=["'][^"']*menu)/i.test(FULL);
  push('hamburger', 'Le hamburger s\'ouvre proprement sur mobile', 'human', 'unknown', (burger && media) ? 'bouton menu + @media reperes : confirme sur telephone' : 'a confirmer sur telephone');

  // Visuel pur (humain)
  push('clair', 'Le header reste clair, pas encombre', 'human', 'unknown', 'a juger a l\'oeil');
  push('overflow', 'Rien ne deborde sur petit ecran', 'human', 'unknown', 'a juger a l\'oeil (reduis la fenetre ou ouvre sur telephone)');

  return out;
}

function bodyInner(html) {
  const b = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return b ? b[1] : html;
}
function heroRegion(html) {
  let body = bodyInner(html).replace(/<header[\s\S]*?<\/header>/i, '');
  let s = body.match(/<section[\s\S]*?<\/section>/i);
  if (s) return { region: s[0], found: 'premiere section' };
  let m = body.match(/<main[\s\S]*?<\/main>/i);
  if (m) return { region: m[0].slice(0, 5000), found: 'main' };
  return { region: body.slice(0, 5000), found: 'debut de body' };
}
function analyseHero(ctx) {
  const HR = ctx.heroHtml, FULL = ctx.html;
  const CSS = (ctx.css || '').toLowerCase();
  const landing = /essentiel|menu qr/i.test(ctx.formule || '');
  const out = [];
  const push = (id, label, group, status, evidence) => out.push({ id, label, group, status, evidence });

  const h1m = FULL.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1txt = h1m ? h1m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const h1InHero = h1m && HR.indexOf(h1m[0]) >= 0;
  if (h1txt) push('h1', 'Titre principal (h1) present', 'auto', 'ok', 'titre : "' + h1txt.slice(0, 80) + (h1txt.length > 80 ? '...' : '') + '"' + (h1InHero ? '' : ' (pas dans la zone hero detectee : a confirmer)'));
  else push('h1', 'Titre principal (h1) present', 'auto', 'ko', 'aucun <h1> trouve sur la page');

  const hasP = /<(?:p|h2|span)[^>]*>[\s\S]{15,}?<\/(?:p|h2|span)>/i.test(HR);
  push('accroche', 'Texte d\'accroche / sous-titre', 'auto', hasP ? 'ok' : 'unknown', hasP ? 'du texte d\'accroche est present dans le hero' : 'peu de texte repere dans le hero : a confirmer');

  const cta = /(?:<a|<button)[^>]*(?:class=["'][^"']*(?:btn|button|cta)|>[^<]{0,40}(?:contact|devis|appel|appeler|rendez|rdv|r[eé]serv|command|decouvr|obtenir|demander|reserver|commencer|essayer|nous joindre|prendre|whatsapp))/i;
  push('cta_hero', 'Bouton d\'action dans le hero', 'auto', cta.test(HR) ? 'ok' : 'unknown', cta.test(HR) ? 'un bouton d\'action est present dans le hero' : 'pas de bouton d\'action clair dans le hero : a confirmer');

  const visuel = /<img[\s>]/i.test(HR) || /<svg[\s>]/i.test(HR) || /background(?:-image)?\s*:\s*url/i.test(CSS);
  push('visuel', 'Visuel present dans le hero', 'auto', visuel ? 'ok' : 'unknown', visuel ? 'une image / un visuel est present' : 'aucun visuel repere dans le hero : a confirmer');

  const puces = /<ul[\s>][\s\S]*?<li/i.test(HR);
  if (landing) push('puces', 'Puces benefices (recommande en landing)', 'auto', puces ? 'ok' : 'ko', puces ? 'une liste de benefices est presente' : 'aucune liste de benefices dans le hero (recommande pour une landing)');
  else push('puces', 'Puces benefices (optionnel)', 'auto', puces ? 'ok' : 'unknown', puces ? 'liste presente' : 'pas de liste (facultatif pour un multipage)');

  push('clair3s', 'On comprend en 3 secondes ce que fait l\'entreprise', 'human', 'unknown', 'a juger a l\'oeil : le titre dit-il clairement l\'activite et pour qui');
  push('cta_relief', 'Le bouton d\'action ressort (du relief)', 'human', 'unknown', 'a juger a l\'oeil : couleur contrastee, bien visible');
  push('flottaison', 'L\'essentiel est visible sans scroller', 'human', 'unknown', 'a juger a l\'oeil : titre + accroche + bouton au-dessus de la ligne de flottaison');
  push('hierarchie', 'Hierarchie visuelle claire', 'human', 'unknown', 'a juger a l\'oeil : titre puis sous-titre puis bouton');

  return out;
}

function footerRegion(html) {
  let m = html.match(/<footer[\s\S]*?<\/footer>/i);
  if (m) return { region: m[0], found: 'footer' };
  return { region: bodyInner(html).slice(-4000), found: 'fin de body' };
}
function contactRegion(html) {
  let body = bodyInner(html);
  let sec = body.match(/<(section|div)[^>]*(?:id|class)=["'][^"']*contact[\s\S]*?<\/\1>/i);
  if (sec) return { region: sec[0].slice(0, 5000), found: 'section contact' };
  let form = body.match(/<form[\s\S]*?<\/form>/i);
  if (form) return { region: form[0].slice(0, 5000), found: 'formulaire' };
  return { region: '', found: 'introuvable' };
}
function rubriquesRegion(html) {
  let body = bodyInner(html).replace(/<header[\s\S]*?<\/header>/i, '').replace(/<footer[\s\S]*?<\/footer>/i, '');
  return { region: body.slice(0, 12000), found: 'corps de page' };
}

function analyseRubriques(ctx) {
  const R = ctx.region;
  const out = [];
  const push = (id, label, group, status, evidence) => out.push({ id, label, group, status, evidence });

  const h2 = (R.match(/<h2[\s>]/gi) || []).length;
  push('sections', 'Rubriques avec titre (h2)', 'auto', h2 >= 1 ? 'ok' : 'unknown', h2 >= 1 ? h2 + ' titre(s) de section (h2) reperes' : 'aucun titre de section (h2) repere : a confirmer');

  const txt = R.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  push('contenu', 'Contenu present dans le corps', 'auto', txt.length > 300 ? 'ok' : 'unknown', txt.length > 300 ? txt.length + ' caracteres de texte' : 'peu de texte dans le corps : a confirmer');

  const preuve = /(?:t[eé]moign|avis|recommand|note\s*:|★|⭐|\b5\/5\b|nos clients|ils nous font confiance)/i.test(R);
  push('preuve', 'Preuve sociale (temoignages / references)', 'auto', preuve ? 'ok' : 'unknown', preuve ? 'des elements de preuve sociale sont presents' : 'aucune preuve sociale reperee (recommande) : a confirmer');

  const imgs = (R.match(/<img\b[^>]*>/gi) || []);
  const sansAlt = imgs.filter((t) => !/alt\s*=\s*["'][^"']/i.test(t)).length;
  if (!imgs.length) push('imgalt', 'Images avec texte alt', 'auto', 'unknown', 'aucune image reperee dans le corps');
  else if (sansAlt === 0) push('imgalt', 'Images avec texte alt', 'auto', 'ok', imgs.length + ' image(s), toutes avec un alt');
  else push('imgalt', 'Images avec texte alt', 'auto', 'ko', sansAlt + ' image(s) sur ' + imgs.length + ' sans attribut alt (SEO / accessibilite)');

  const cta = /(?:<a|<button)[^>]*(?:class=["'][^"']*(?:btn|button|cta)|>[^<]{0,40}(?:contact|devis|appel|rendez|rdv|r[eé]serv|command|demander|reserver|whatsapp))/i;
  push('cta_corps', 'Un appel a l\'action dans le corps', 'auto', cta.test(R) ? 'ok' : 'unknown', cta.test(R) ? 'au moins un bouton d\'action dans le corps' : 'pas de bouton d\'action repere dans le corps : a confirmer');

  push('but', 'Chaque rubrique a un but clair', 'human', 'unknown', 'a juger a l\'oeil');
  push('continuite', 'Ordre logique et bonne continuite', 'human', 'unknown', 'a juger a l\'oeil : l\'enchainement des sections est fluide');
  push('soigne', 'Aucune section vide ou baclee', 'human', 'unknown', 'a juger a l\'oeil');
  return out;
}

function analyseFooter(ctx) {
  const R = ctx.region, FULL = ctx.html, B = (ctx.brief || '').toLowerCase();
  const out = [];
  const push = (id, label, group, status, evidence) => out.push({ id, label, group, status, evidence });

  const hasFooter = /<footer[\s>]/i.test(FULL);
  push('footer', 'Footer present', 'auto', hasFooter ? 'ok' : 'unknown', hasFooter ? 'balise <footer> presente' : 'pas de balise <footer> claire : a confirmer');

  const coord = /href=["'](?:tel:|mailto:)/i.test(R) || /\b\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}\b/.test(R);
  push('coord_footer', 'Coordonnees dans le footer', 'auto', coord ? 'ok' : 'unknown', coord ? 'coordonnees (tel / email) presentes' : 'pas de coordonnees clairement reperees : a confirmer');

  const soc = /(?:facebook|instagram|twitter|x\.com|linkedin|tiktok|youtu|wa\.me|whatsapp)/i;
  const briefHasSoc = soc.test(B) || /r[eé]seau/.test(B);
  if (soc.test(R)) push('reseaux_footer', 'Reseaux dans le footer (si le client en a)', 'auto', 'ok', 'liens reseaux presents');
  else if (!briefHasSoc) push('reseaux_footer', 'Reseaux dans le footer (si le client en a)', 'auto', 'ok', 'le client n\'a pas de reseaux : rien a ajouter');
  else push('reseaux_footer', 'Reseaux dans le footer (si le client en a)', 'auto', 'ko', 'le client a des reseaux mais absents du footer');

  push('mentions', 'Lien mentions legales', 'auto', /mentions|legal|cgv|confidential/i.test(R) ? 'ok' : 'ko', /mentions|legal|cgv/i.test(R) ? 'lien mentions / legal present' : 'aucun lien mentions legales repere');
  push('novalem', 'Mention "Realisation Novalem"', 'auto', /novalem/i.test(R) ? 'ok' : 'unknown', /novalem/i.test(R) ? 'la signature Novalem est presente' : 'signature Novalem non reperee : a confirmer');
  push('copyright', 'Annee / copyright', 'auto', /(?:©|copyright|&copy;|\b20\d\d\b)/i.test(R) ? 'ok' : 'unknown', /(?:©|copyright|20\d\d)/i.test(R) ? 'mention de copyright / annee presente' : 'pas de copyright / annee repere : a confirmer');
  push('footer_propre', 'Footer complet et propre', 'human', 'unknown', 'a juger a l\'oeil');
  return out;
}

function analyseContact(ctx) {
  const R = ctx.region, FULL = ctx.html;
  const out = [];
  const push = (id, label, group, status, evidence) => out.push({ id, label, group, status, evidence });

  const hasForm = /<form[\s>]/i.test(R) || /<form[\s>]/i.test(FULL);
  const hasTelMail = /href=["'](?:tel:|mailto:)/i.test(FULL);
  const hasWa = /(?:wa\.me|api\.whatsapp|whatsapp)/i.test(FULL);
  const any = hasForm || hasTelMail || hasWa;
  const moyens = [hasForm ? 'formulaire' : null, hasTelMail ? 'tel / email' : null, hasWa ? 'whatsapp' : null].filter(Boolean).join(', ');
  push('moyen', 'Un moyen de contact existe', 'auto', any ? 'ok' : 'ko', any ? ('present : ' + moyens) : 'aucun moyen de contact repere (formulaire, tel, mail, whatsapp)');

  if (hasForm) {
    const champs = ((R + FULL).match(/<(?:input|textarea|select)\b/gi) || []).length;
    const submit = /type=["']submit["']|<button[^>]*>[\s\S]{0,30}(?:envoyer|envoi|submit)/i.test(R + FULL);
    push('form_champs', 'Formulaire : champs presents', 'auto', champs >= 2 ? 'ok' : 'unknown', champs >= 2 ? champs + ' champ(s) dans le formulaire' : 'peu de champs reperes : a confirmer');
    push('form_submit', 'Formulaire : bouton d\'envoi', 'auto', submit ? 'ok' : 'unknown', submit ? 'bouton d\'envoi present' : 'bouton d\'envoi non repere : a confirmer');
  }

  push('trouvable', 'Le contact est facile a trouver', 'human', 'unknown', 'a juger a l\'oeil');
  push('form_test', 'Le formulaire fonctionne (envoi + confirmation)', 'human', 'unknown', 'a TESTER toi-meme : remplis, envoie, verifie le message de confirmation');
  return out;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function analyseTextes(ctx) {
  const FULL = ctx.html;
  const out = [];
  const push = (id, label, group, status, evidence) => out.push({ id, label, group, status, evidence });

  const imgs = (FULL.match(/<img\b[^>]*>/gi) || []);
  const sansAlt = imgs.filter((t) => !/alt\s*=\s*["'][^"']/i.test(t)).length;
  if (!imgs.length) push('img_all', 'Images avec texte alt', 'auto', 'unknown', 'aucune balise <img> sur la page (images en fond CSS ?)');
  else if (sansAlt === 0) push('img_all', 'Images avec texte alt', 'auto', 'ok', imgs.length + ' image(s), toutes avec un alt');
  else push('img_all', 'Images avec texte alt', 'auto', 'ko', sansAlt + ' image(s) sur ' + imgs.length + ' sans attribut alt');

  const vt = visibleText(FULL);
  const ph = vt.match(/lorem ipsum|\[image[^\]]*\]|\[a completer[^\]]*\]|\[à compléter[^\]]*\]|votre texte ici|texte a remplacer|texte de remplacement|placeholder/i);
  if (ph) push('placeholders', 'Aucun placeholder oublie', 'auto', 'ko', 'placeholder trouve dans le texte : "' + ph[0].slice(0, 40) + '"');
  else push('placeholders', 'Aucun placeholder oublie', 'auto', 'ok', 'aucun texte de remplacement (lorem ipsum, [image...]) repere');

  const mots = vt.split(/\s+/).filter(Boolean).length;
  push('longueur', 'Volume de texte', 'auto', 'ok', mots + ' mots environ sur la page');

  push('naturel', 'Les textes sonnent naturels (pas trop IA)', 'human', 'unknown', 'a confirmer apres relecture et apres avoir applique les suggestions de l\'IA');
  push('vraies_photos', 'De vraies photos de mise en situation (pas generiques)', 'human', 'unknown', 'a juger a l\'oeil');
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante dans les variables Vercel.' });

  const b = req.body || {};
  const url = normaliseUrl(b.url || '');
  if (!url) return res.status(400).json({ error: 'Lien du site manquant. Renseigne l\'apercu Vercel a l\'etape 2.' });
  const section = b.section || 'header';

  const page = await fetchText(url, 400000);
  if (!page.ok) return res.status(200).json({ ok: false, error: 'Site inaccessible (' + (page.err || ('HTTP ' + page.status)) + '). Verifie le lien de l\'apercu.' });

  const html = page.text;
  const assets = linkedAssets(html, page.url);

  let cssText = inlineOf(html, 'style');
  for (let i = 0; i < assets.css.length; i++) { const c = await fetchText(assets.css[i], 150000); if (c.ok) cssText += '\n' + c.text; }
  let jsText = inlineOf(html, 'script');
  for (let j = 0; j < assets.js.length; j++) { const s = await fetchText(assets.js[j], 150000); if (s.ok) jsText += '\n' + s.text; }

  if (section === 'final') {
    const H = headerRegion(html), HE = heroRegion(html), RU = rubriquesRegion(html), FO = footerRegion(html), CO = contactRegion(html);
    const all = [];
    const tag = (s, arr) => arr.forEach((k) => { k.section = s; all.push(k); });
    tag('Header', analyseHeader({ html, headerHtml: H.region, css: cssText, js: jsText, brief: b.brief || '' }));
    tag('Hero', analyseHero({ html, heroHtml: HE.region, css: cssText, js: jsText, formule: b.formule || '' }));
    tag('Rubriques', analyseRubriques({ html, region: RU.region, css: cssText, js: jsText, formule: b.formule || '' }));
    tag('Footer', analyseFooter({ html, region: FO.region, css: cssText, js: jsText, brief: b.brief || '' }));
    tag('Contact', analyseContact({ html, region: CO.region, css: cssText, js: jsText }));
    tag('Textes & images', analyseTextes({ html }));
    const autoChecks = all.filter((k) => k.group === 'auto');
    const humanCount = all.filter((k) => k.group === 'human').length;
    const koF = autoChecks.filter((k) => k.status === 'ko');
    const koList = koF.map((k) => '- [' + k.section + '] ' + k.label + ' : ' + k.evidence).join('\n') || '(aucun probleme detecte automatiquement)';
    const vt = visibleText(html);
    const systemeF =
      'Tu fais l\'AUDIT FINAL honnete d\'un site client Novalem avant livraison. On te donne la liste des problemes detectes automatiquement (par section) et un extrait du texte du site. ' +
      'Tu ne juges QUE sur ces elements, tu n\'inventes rien, tu ne felicites pas pour faire plaisir. ' +
      'Donne un verdict global honnete et court (2 a 4 phrases) : le site est-il pret a livrer, et sinon pourquoi. ' +
      'S\'il reste des choses a corriger, redige un PROMPT DE CORRECTION global et PRIORISE (les plus importants d\'abord), en francais, sans tirets longs. Si tout est bon, laisse la correction vide. ' +
      'Reponds UNIQUEMENT en JSON strict : {"resume":"...","correction":"..."}';
    const userF =
      'Formule du site : ' + (b.formule || '(non precisee)') + '\n\n' +
      'PROBLEMES DETECTES AUTOMATIQUEMENT (source de verite) :\n' + koList + '\n\n' +
      'Nombre de points visuels a confirmer a l\'oeil : ' + humanCount + '\n\n' +
      'Extrait du texte du site :\n"""\n' + vt.slice(0, 4000) + '\n"""';
    let resumeF = '', correctionF = '';
    try {
      const outF = await anthropic({ model: MODEL, max_tokens: 1400, system: systemeF, messages: [{ role: 'user', content: userF }] });
      const oF = parseJSONLoose(outF);
      resumeF = oF.resume || ''; correctionF = oF.correction || '';
    } catch (e) { resumeF = '(analyse IA indisponible : ' + (e.message || 'erreur') + '). Les points ci-dessus restent valables.'; }
    return res.status(200).json({ ok: true, section: 'final', checks: autoChecks, humanCount, resume: resumeF, correction: correctionF });
  }

  if (section === 'all') {
    const rHeader = headerRegion(html).region, rHero = heroRegion(html).region, rRub = rubriquesRegion(html).region, rFoot = footerRegion(html).region, rCont = contactRegion(html).region, rTxt = visibleText(html);
    const defs = [
      ['header', analyseHeader({ html, headerHtml: rHeader, css: cssText, js: jsText, brief: b.brief || '' }), rHeader],
      ['hero', analyseHero({ html, heroHtml: rHero, css: cssText, js: jsText, formule: b.formule || '' }), rHero],
      ['rubriques', analyseRubriques({ html, region: rRub, css: cssText, js: jsText, formule: b.formule || '' }), rRub],
      ['footer', analyseFooter({ html, region: rFoot, css: cssText, js: jsText, brief: b.brief || '' }), rFoot],
      ['contact', analyseContact({ html, region: rCont, css: cssText, js: jsText }), rCont],
      ['textes', analyseTextes({ html }), rTxt]
    ];
    const results = await Promise.all(defs.map(async function (d) {
      const sec = d[0], checks = d[1], region = d[2];
      const ai = await askClaude(sysFor(sec), userFor(sec, findingsOf(checks), region, b.formule));
      return { section: sec, checks: checks, resume: ai.resume, correction: ai.correction };
    }));
    const all = {};
    results.forEach(function (r) { all[r.section] = { ok: true, section: r.section, checks: r.checks, resume: r.resume, correction: r.correction }; });
    return res.status(200).json({ ok: true, all: all });
  }

  let region, found, checks;
  if (section === 'textes') {
    region = visibleText(html); found = 'textes de la page';
    checks = analyseTextes({ html });
  } else if (section === 'hero') {
    const h = heroRegion(html); region = h.region; found = h.found;
    checks = analyseHero({ html, heroHtml: region, css: cssText, js: jsText, formule: b.formule || '' });
  } else if (section === 'rubriques') {
    const h = rubriquesRegion(html); region = h.region; found = h.found;
    checks = analyseRubriques({ html, region, css: cssText, js: jsText, formule: b.formule || '' });
  } else if (section === 'footer') {
    const h = footerRegion(html); region = h.region; found = h.found;
    checks = analyseFooter({ html, region, css: cssText, js: jsText, brief: b.brief || '' });
  } else if (section === 'contact') {
    const h = contactRegion(html); region = h.region; found = h.found;
    checks = analyseContact({ html, region, css: cssText, js: jsText });
  } else {
    const h = headerRegion(html); region = h.region; found = h.found;
    checks = analyseHeader({ html, headerHtml: region, css: cssText, js: jsText, brief: b.brief || '' });
  }

  const findings = findingsOf(checks);
  const ai = await askClaude(sysFor(section), userFor(section, findings, region, b.formule));
  const resume = ai.resume, correction = ai.correction;

  return res.status(200).json({
    ok: true,
    section,
    sectionFound: found,
    assets: { css: assets.css.length, js: assets.js.length },
    checks,
    resume,
    correction,
  });
};
