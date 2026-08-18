// api/assistant-prospect.js — ASSISTANT PROSPECT INTELLIGENT
// Une seule action : { action:"analyser", ...cible }
//
// A partir d'un prospect (son site/sa page + ce que le CRM sait deja) :
//   1. va lire sa presence en ligne (fetch du site s'il y en a un)
//   2. en sort une FICHE ENRICHIE ou chaque champ porte un niveau de preuve
//      (fort / faible / absent) — regle absolue : on ne devine JAMAIS
//   3. redige un COLD MAIL personnalise dans le style de Louis / Studio Novalem
//
// Variable Vercel requise : ANTHROPIC_API_KEY (existe deja, cf api/usine.js).
// Aucune autre cle : la fonction ne touche pas Supabase (c'est le front qui
// enregistre, apres validation humaine des preuves faibles).

const MODEL = 'claude-sonnet-4-6'; // meme modele que l'usine ; changeable si besoin
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
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start > 0 || end < t.length - 1) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

// --- Recuperation + nettoyage du contenu d'une page -----------------
function normaliseUrl(u) {
  let s = (u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s;
}

function extraireContenu(html) {
  const meta = {};
  const grab = (re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
  meta.title = grab(/<title[^>]*>([\s\S]*?)<\/title>/i);
  meta.description = grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  meta.ogTitle = grab(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  meta.ogDesc = grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  meta.themeColor = grab(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  // couleurs hex reperees dans le <head>/style (best effort)
  const couleurs = Array.from(new Set((html.slice(0, 60000).match(/#[0-9a-fA-F]{6}\b/g) || []))).slice(0, 12);
  // texte visible
  let txt = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return { meta, couleurs, texte: txt.slice(0, 12000), longueur_texte: txt.length };
}

async function lirePage(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NovalemBot/1.0; +https://studionovalem.fr)' },
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, note: 'Page inaccessible (HTTP ' + r.status + ')' };
    const ct = (r.headers.get('content-type') || '');
    if (ct && !/text|html|xml/i.test(ct)) return { ok: false, note: 'Contenu non lisible (' + ct + ')' };
    const html = (await r.text()).slice(0, 400000);
    const c = extraireContenu(html);
    return { ok: true, url_finale: r.url || url, ...c };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, note: e.name === 'AbortError' ? 'Le site met trop de temps a repondre' : 'Impossible de lire la page (' + (e.message || 'erreur reseau') + ')' };
  }
}

// --- Prompt --------------------------------------------------------
function construirePrompt(cible, page, exp) {
  const connuCRM = {
    entreprise: cible.entreprise || '',
    zone: cible.zone || '',
    site_actuel_declare: cible.site_actuel || '',
    qualite_site_notee_par_louis: cible.qualite_site || '',
    email_deja_en_fiche: cible.email && cible.email !== '//' ? cible.email : '',
    contact_deja_en_fiche: cible.contact_nom && cible.contact_nom !== '/' ? cible.contact_nom : '',
    notes_louis: cible.notes || '',
  };

  let observe;
  if (page && page.ok) {
    observe =
      'CONTENU REELLEMENT RECUPERE sur ' + (page.url_finale || '') + ' :\n' +
      'Titre : ' + (page.meta.title || '(vide)') + '\n' +
      'Meta description : ' + (page.meta.description || '(vide)') + '\n' +
      'OG title/description : ' + (page.meta.ogTitle || '') + ' / ' + (page.meta.ogDesc || '') + '\n' +
      'theme-color : ' + (page.meta.themeColor || '(absent)') + '\n' +
      'Couleurs hex reperees dans le code : ' + (page.couleurs.length ? page.couleurs.join(', ') : '(aucune)') + '\n' +
      'Longueur du texte visible : ' + page.longueur_texte + ' caracteres\n' +
      'Texte visible de la page :\n"""\n' + (page.texte || '(vide)') + '\n"""';
  } else {
    observe =
      'AUCUN CONTENU DE SITE RECUPERE.' + (page && page.note ? ' Raison : ' + page.note + '.' : '') + '\n' +
      'Tu ne disposes donc d\'AUCUNE observation directe de sa presence en ligne : la plupart des champs de la fiche doivent avoir preuve="absent" et valeur vide. Ne comble pas les trous.';
  }

  const schema =
    '{\n' +
    '  "fiche": {\n' +
    '    "nom_commercial": {"valeur":"", "preuve":"fort|faible|absent", "source":"ou tu l\'as vu"},\n' +
    '    "secteur": {"valeur":"", "preuve":"", "source":""},\n' +
    '    "description": {"valeur":"1 phrase neutre sur ce que fait la boite", "preuve":"", "source":""},\n' +
    '    "a_site_reel": {"valeur":true, "preuve":"", "source":""},\n' +
    '    "qualite_site": {"valeur":"aucun|facebook|mauvais|correct|bon", "preuve":"", "source":""},\n' +
    '    "couleur_principale": {"valeur":"#hex ou vide", "preuve":"", "source":""},\n' +
    '    "couleur_secondaire": {"valeur":"#hex ou vide", "preuve":"", "source":""},\n' +
    '    "email_visible": {"valeur":"", "preuve":"", "source":""},\n' +
    '    "telephone_visible": {"valeur":"", "preuve":"", "source":""},\n' +
    '    "instagram": {"valeur":"", "preuve":"", "source":""},\n' +
    '    "facebook": {"valeur":"", "preuve":"", "source":""},\n' +
    '    "accroche": {"valeur":"1 phrase d\'accroche batie sur un FAIT observe (a reutiliser dans le mail)", "preuve":"", "source":""}\n' +
    '  },\n' +
    '  "resume_court": "1 phrase : l\'angle principal pour lui vendre un site (l\'opportunite)",\n' +
    '  "mail": {"objet":"", "corps":""}\n' +
    '}';

  const consignesMail =
    'REDACTION DU COLD MAIL (champ "mail") :\n' +
    '- Expediteur = ' + (exp.nom || 'Studio Novalem') + ' (Louis), createur de sites internet en Guadeloupe. Signature avec : ' + (exp.nom || 'Studio Novalem') + (exp.email ? ', ' + exp.email : '') + (exp.tel ? ', ' + exp.tel : '') + '.\n' +
    '- Vouvoiement, ton simple, direct, humain, PAS corporate. Court : 90 a 130 mots max.\n' +
    '- Accroche personnalisee sur un fait OBSERVE de leur situation (ex : presence limitee a une page Facebook, site ancien, aucun site trouve). Si tu n\'as rien observe de precis, reste factuel et honnete, ne PREtends rien.\n' +
    '- Positionnement : site professionnel codee sur mesure, sans abonnement, propriete du client, prix accessible ; exemple de realisation a citer : ifc-guadeloupe.fr.\n' +
    '- CTA doux : proposer un echange rapide / un appel, pas de vente frontale.\n' +
    '- Interdiction absolue d\'inventer un chiffre, un nom de gerant, une info sur la boite qui ne soit pas dans les donnees fournies.';

  return {
    system:
      'Tu es l\'assistant de prospection de Studio Novalem (Louis, 21 ans, createur de sites internet en Guadeloupe). ' +
      'REGLE ABSOLUE : tu ne DEVINES JAMAIS. Chaque champ de la fiche porte un niveau de preuve base UNIQUEMENT sur ce qui est reellement observe dans le contenu fourni. ' +
      'Si une info n\'a pas ete observee, mets preuve="absent" et valeur vide plutot que d\'inventer. Une fiche avec des trous vaut mieux qu\'une fiche fausse. ' +
      'La qualite_site notee par Louis est une observation humaine valable (preuve faible). ' +
      'Tu reponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaire.',
    user:
      'DONNEES CONNUES DU CRM (saisies par Louis) :\n' + JSON.stringify(connuCRM, null, 1) + '\n\n' +
      observe + '\n\n' +
      consignesMail + '\n\n' +
      'Ressors UNIQUEMENT cet objet JSON, exactement cette structure :\n' + schema,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante dans les variables Vercel du projet.' });
    }
    const body = req.body || {};
    const cible = body.cible || body;
    const exp = body.expediteur || {};

    const url = normaliseUrl(body.site_url || cible.site_actuel || '');
    const page = url ? await lirePage(url) : { ok: false, note: 'Aucune URL fournie' };

    const p = construirePrompt(cible, page, exp);
    const raw = await anthropic({
      model: MODEL,
      max_tokens: 2500,
      system: p.system,
      messages: [{ role: 'user', content: p.user }],
    });

    const out = parseJSONLoose(raw);
    return res.status(200).json({
      fiche: out.fiche || {},
      mail: out.mail || { objet: '', corps: '' },
      resume_court: out.resume_court || '',
      source: { url: url || '', ok: !!(page && page.ok), note: (page && page.note) || (page && page.ok ? 'Site analyse' : '') },
    });
  } catch (err) {
    console.error('api/assistant-prospect:', err);
    return res.status(500).json({ error: err.message });
  }
};
