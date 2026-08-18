// api/usine.js — USINE A SITES
// Une seule fonction, 4 actions : trier | generer | publier | statut
//
// Variables Vercel requises :
//   ANTHROPIC_API_KEY          (existe deja)
//   SUPABASE_URL               (existe deja)
//   SUPABASE_SERVICE_ROLE_KEY  (existe deja)
//   GITHUB_TOKEN               <- nouveau : token fine-grained avec droits repo (contents RW, administration RW)
//   GITHUB_OWNER               <- nouveau : LEXONOS
//   VERCEL_TOKEN               <- nouveau : token API Vercel
//
// vercel.json : maxDuration 300 pour cette fonction (necessite Vercel Pro / fluid compute)

const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'web-usine';
const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function getSB() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

function mimeOf(name) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.svg')) return 'image/svg+xml';
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.csv')) return 'text/plain';
  return 'application/octet-stream';
}

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
  if (!r.ok) throw new Error('Anthropic: ' + (data.error && data.error.message || r.status));
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function parseJSONLoose(text) {
  let t = (text || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start > 0 || end < t.length - 1) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

function stripCodeFences(text) {
  let t = (text || '').trim();
  t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
  return t.trim();
}

async function fetchTemplateFile(host, template, file) {
  const url = 'https://' + host + '/templates/' + template + '/' + file;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Template introuvable: ' + file + ' (' + r.status + ')');
  return await r.text();
}

// ---------------------------------------------------------------
// ACTION 1 : TRIER — lit tous les fichiers du client dans le
// bucket, envoie tout a Claude, ressort une fiche structuree
// ---------------------------------------------------------------
async function actionTrier(sb, body) {
  const clientId = body.client_id;
  if (!clientId) throw new Error('client_id requis');

  const { data: client } = await sb.from('web_clients').select('*').eq('id', clientId).single();

  const { data: files, error: le } = await sb.storage.from(BUCKET).list(clientId, { limit: 100 });
  if (le) throw new Error('Storage list: ' + le.message);
  if (!files || !files.length) throw new Error('Aucun fichier depose pour ce client');

  const content = [];
  const inventory = [];
  let nbImages = 0, nbPdf = 0;

  for (const f of files) {
    if (!f.name || f.name.startsWith('.')) continue;
    const mime = mimeOf(f.name);
    const size = (f.metadata && f.metadata.size) || 0;
    inventory.push(f.name + ' (' + mime + ', ' + Math.round(size / 1024) + ' Ko)');

    const isImg = mime.startsWith('image/') && mime !== 'image/svg+xml';
    const isPdf = mime === 'application/pdf';
    const isTxt = mime === 'text/plain';
    if (!isImg && !isPdf && !isTxt) continue;
    if (isImg && (nbImages >= 8 || size > 4.5 * 1024 * 1024)) continue;
    if (isPdf && (nbPdf >= 3 || size > 8 * 1024 * 1024)) continue;

    const { data: blob, error: de } = await sb.storage.from(BUCKET).download(clientId + '/' + f.name);
    if (de || !blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());

    if (isTxt) {
      content.push({ type: 'text', text: '--- Fichier texte "' + f.name + '" ---\n' + buf.toString('utf8').slice(0, 20000) });
    } else if (isImg) {
      nbImages++;
      content.push({ type: 'text', text: 'Image suivante = fichier "' + f.name + '"' });
      content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } });
    } else if (isPdf) {
      nbPdf++;
      content.push({ type: 'text', text: 'Document suivant = fichier "' + f.name + '"' });
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
    }
  }

  content.push({
    type: 'text',
    text:
      'Client CRM : ' + JSON.stringify({ nom: client && client.nom, activite: client && client.activite, email: client && client.email, telephone: client && client.telephone }) + '\n' +
      (body.cadrage ? 'Fiche de cadrage remplie en RDV (source prioritaire) : ' + JSON.stringify(body.cadrage) + '\n' : '') +
      'Inventaire complet des fichiers deposes :\n' + inventory.join('\n') + '\n\n' +
      'Analyse TOUT ce qui precede (images, PDF, textes) et ressors UNIQUEMENT un objet JSON valide, sans markdown, avec cette structure exacte :\n' +
      '{\n' +
      ' "identite": { "nom_commercial": "", "slogan": "", "description_courte": "", "description_longue": "" },\n' +
      ' "services": [ { "nom": "", "description": "", "prix": "", "details": [""] } ],\n' +
      ' "coordonnees": { "telephone": "", "email": "", "adresse": "", "zone_intervention": "" },\n' +
      ' "horaires": "",\n' +
      ' "reseaux": { "facebook": "", "instagram": "", "whatsapp": "" },\n' +
      ' "mentions_legales": { "forme_juridique": "", "siret": "", "siege": "", "dirigeant": "" },\n' +
      ' "charte": { "couleur_principale": "#hex", "couleur_secondaire": "#hex", "ambiance": "", "notes": "" },\n' +
      ' "assets": { "logo": "nom-fichier", "hero": "nom-fichier", "services_images": { "Nom du service": "nom-fichier" }, "galerie": ["nom-fichier"] },\n' +
      ' "infos_manquantes": [""]\n' +
      '}\n' +
      'Regles : les noms de fichiers dans "assets" doivent venir EXCLUSIVEMENT de l\'inventaire. Deduis la charte des couleurs du logo. Si une info est absente, mets "" et liste-la dans infos_manquantes. Ecris en francais.',
  });

  const raw = await anthropic({
    model: MODEL,
    max_tokens: 4000,
    system: 'Tu es l\'assistant de production de NOVALEM, createur de sites internet en Guadeloupe. Tu tries des documents clients en une fiche structuree. Tu reponds UNIQUEMENT en JSON valide.',
    messages: [{ role: 'user', content: content }],
  });

  const intake = parseJSONLoose(raw);

  const { error: ue } = await sb.from('web_usine').upsert(
    { client_id: clientId, intake: intake, statut: 'trie', updated_at: new Date().toISOString() },
    { onConflict: 'client_id' }
  );
  if (ue) throw new Error('Sauvegarde: ' + ue.message);

  return { intake: intake };
}

// ---------------------------------------------------------------
// ACTION 2 : GENERER — produit les fichiers du site a partir de
// la template + la fiche triee. Deux parties pour tenir dans les
// temps serverless : "index" puis "annexes".
// ---------------------------------------------------------------
async function actionGenerer(sb, body, host) {
  const clientId = body.client_id;
  const partie = body.partie || 'index';
  const template = body.template || 'love-dogs';
  if (!clientId) throw new Error('client_id requis');

  const { data: dossier } = await sb.from('web_usine').select('*').eq('client_id', clientId).single();
  if (!dossier || !dossier.intake) throw new Error('Fiche triee introuvable : lance d\'abord le tri IA');
  const intake = body.intake || dossier.intake;
  const fichiers = dossier.fichiers || {};

  const systeme =
    'Tu es le developpeur senior de NOVALEM. Tu adaptes une template HTML rodee a un nouveau client. ' +
    'Regles absolues : tu gardes la structure, les classes CSS et les scripts de la template (le css/style.css et le js/main.js restent identiques et ne sont PAS a reecrire). ' +
    'Tu changes uniquement : textes, sections, meta/SEO, couleurs via les variables CSS :root (redefinies dans une balise <style> dans le <head>), et les chemins d\'images. ' +
    'Les images utilisees doivent venir EXCLUSIVEMENT de la liste d\'assets fournie, avec le chemin assets/NOM-EXACT-DU-FICHIER. ' +
    'Si une section de la template n\'a pas d\'equivalent chez le client (ex: boutique produits), tu la retires proprement. ' +
    'Tu reponds UNIQUEMENT avec le code du fichier demande, complet, sans markdown, sans commentaire d\'accompagnement.';

  if (partie === 'index') {
    const tpl = await fetchTemplateFile(host, template, 'index.html');
    const html = await anthropic({
      model: MODEL,
      max_tokens: 16000,
      system: systeme,
      messages: [{
        role: 'user',
        content:
          'TEMPLATE index.html :\n\n' + tpl + '\n\n---\n\n' +
          'FICHE CLIENT (JSON) :\n' + JSON.stringify(intake, null, 1) + '\n\n' +
          'Genere le index.html complet et final pour ce client. SEO soigne (title, description, og, JSON-LD LocalBusiness adapte). Langue : francais. Le site ne mentionne jamais qu\'il vient d\'une template.',
      }],
    });
    fichiers['index.html'] = stripCodeFences(html);
  } else if (partie === 'annexes') {
    const tplML = await fetchTemplateFile(host, template, 'mentions-legales.html');
    const ml = await anthropic({
      model: MODEL,
      max_tokens: 8000,
      system: systeme,
      messages: [{
        role: 'user',
        content:
          'TEMPLATE mentions-legales.html :\n\n' + tplML + '\n\n---\n\n' +
          'FICHE CLIENT (JSON) :\n' + JSON.stringify(intake && { identite: intake.identite, coordonnees: intake.coordonnees, mentions_legales: intake.mentions_legales }, null, 1) + '\n\n' +
          'Genere le mentions-legales.html complet et final. Editeur = le client, hebergeur = OVH SAS (2 rue Kellermann, 59100 Roubaix), realisation = NOVALEM. Si le SIRET ou la forme juridique manquent, mets un marqueur visible [A COMPLETER].',
      }],
    });
    fichiers['mentions-legales.html'] = stripCodeFences(ml);

    const nom = (intake.identite && intake.identite.nom_commercial) || 'site';
    fichiers['robots.txt'] = 'User-agent: *\nAllow: /\n';
    fichiers['sitemap.xml'] =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      ' <url><loc>https://A-REMPLACER-PAR-LE-DOMAINE/</loc></url>\n' +
      ' <url><loc>https://A-REMPLACER-PAR-LE-DOMAINE/mentions-legales.html</loc></url>\n' +
      '</urlset>\n';
    fichiers['README.md'] = '# ' + nom + '\n\nSite genere par NOVALEM (Usine a sites).\n';
  } else {
    throw new Error('partie inconnue: ' + partie);
  }

  const { error: ue } = await sb.from('web_usine').update({
    fichiers: fichiers,
    template: template,
    statut: 'genere',
    updated_at: new Date().toISOString(),
  }).eq('client_id', clientId);
  if (ue) throw new Error('Sauvegarde: ' + ue.message);

  return { ok: true, partie: partie, fichiers_prets: Object.keys(fichiers) };
}

// ---------------------------------------------------------------
// ACTION 3 : PUBLIER — cree le repo GitHub, lie le projet Vercel,
// pousse tous les fichiers (le push declenche le deploiement)
// ---------------------------------------------------------------
async function gh(path, method, bodyObj) {
  const r = await fetch('https://api.github.com' + path, {
    method: method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'novalem-usine',
      'Content-Type': 'application/json',
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 422) throw new Error('GitHub ' + path + ': ' + (data.message || r.status));
  return { status: r.status, data: data };
}

async function ghPushFile(owner, repo, path, base64Content, message) {
  let sha;
  const cur = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, {
    headers: {
      'Authorization': 'Bearer ' + process.env.GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'novalem-usine',
    },
  });
  if (cur.ok) { const j = await cur.json(); sha = j.sha; }
  const r = await gh('/repos/' + owner + '/' + repo + '/contents/' + path, 'PUT', {
    message: message || 'NOVALEM Usine: ' + path,
    content: base64Content,
    sha: sha,
  });
  if (r.status === 422) throw new Error('Push ' + path + ': ' + (r.data.message || '422'));
}

async function vercel(path, method, bodyObj) {
  const r = await fetch('https://api.vercel.com' + path, {
    method: method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + process.env.VERCEL_TOKEN,
      'Content-Type': 'application/json',
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: data };
}

async function actionPublier(sb, body, host) {
  const clientId = body.client_id;
  const repoNom = (body.repo_nom || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!clientId) throw new Error('client_id requis');
  if (!repoNom) throw new Error('repo_nom requis');
  const owner = process.env.GITHUB_OWNER || 'LEXONOS';

  const { data: dossier } = await sb.from('web_usine').select('*').eq('client_id', clientId).single();
  if (!dossier || !dossier.fichiers || !dossier.fichiers['index.html']) {
    throw new Error('Aucun site genere : lance d\'abord la generation');
  }
  const template = dossier.template || 'love-dogs';
  const intake = dossier.intake || {};

  // 1. Repo GitHub (prive)
  const cr = await gh('/user/repos', 'POST', {
    name: repoNom, private: true, auto_init: false,
    description: 'Site ' + ((intake.identite && intake.identite.nom_commercial) || repoNom) + ' - genere par NOVALEM',
  });
  const dejaLa = cr.status === 422; // existe deja : on pousse dedans

  // 2. Projet Vercel lie au repo (avant le push, pour que le push declenche le deploiement)
  const pv = await vercel('/v10/projects', 'POST', {
    name: repoNom,
    framework: null,
    gitRepository: { type: 'github', repo: owner + '/' + repoNom },
  });
  if (!pv.ok && pv.status !== 409) {
    throw new Error('Vercel projet: ' + ((pv.data.error && pv.data.error.message) || pv.status));
  }

  // 3. Push : fichiers generes + fichiers fixes de la template + assets clients
  const msg = 'Site genere par NOVALEM Usine';
  for (const [nom, contenu] of Object.entries(dossier.fichiers)) {
    await ghPushFile(owner, repoNom, nom, Buffer.from(contenu, 'utf8').toString('base64'), msg);
  }
  for (const fixe of ['css/style.css', 'js/main.js']) {
    const txt = await fetchTemplateFile(host, template, fixe);
    await ghPushFile(owner, repoNom, fixe, Buffer.from(txt, 'utf8').toString('base64'), msg);
  }

  const assetsVoulus = new Set();
  const a = intake.assets || {};
  if (a.logo) assetsVoulus.add(a.logo);
  if (a.hero) assetsVoulus.add(a.hero);
  Object.values(a.services_images || {}).forEach((v) => v && assetsVoulus.add(v));
  (a.galerie || []).forEach((v) => v && assetsVoulus.add(v));

  const { data: files } = await sb.storage.from(BUCKET).list(clientId, { limit: 100 });
  for (const f of files || []) {
    if (!assetsVoulus.has(f.name)) continue;
    const { data: blob } = await sb.storage.from(BUCKET).download(clientId + '/' + f.name);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length > 20 * 1024 * 1024) continue;
    await ghPushFile(owner, repoNom, 'assets/' + f.name, buf.toString('base64'), msg);
  }

  const repoFull = owner + '/' + repoNom;
  await sb.from('web_usine').update({
    repo: repoFull, statut: 'publie', updated_at: new Date().toISOString(),
  }).eq('client_id', clientId);

  return { ok: true, repo: 'https://github.com/' + repoFull, repo_nom: repoNom, deja_existant: dejaLa };
}

// ---------------------------------------------------------------
// ACTION 4 : STATUT — surveille le deploiement Vercel, range le
// lien d'apercu sur la fiche quand il est pret
// ---------------------------------------------------------------
async function actionStatut(sb, body) {
  const clientId = body.client_id;
  const repoNom = body.repo_nom;
  if (!repoNom) throw new Error('repo_nom requis');

  const d = await vercel('/v6/deployments?app=' + encodeURIComponent(repoNom) + '&limit=1');
  const dep = d.data && d.data.deployments && d.data.deployments[0];
  if (!dep) return { etat: 'EN_ATTENTE' };

  const etat = dep.readyState || dep.state || 'INCONNU';
  if (etat === 'READY') {
    const url = 'https://' + repoNom + '.vercel.app';
    if (clientId) {
      await sb.from('web_usine').update({ preview_url: url, updated_at: new Date().toISOString() }).eq('client_id', clientId);
      const { data: deja } = await sb.from('web_liens').select('id').eq('client_id', clientId).eq('url', url);
      if (!deja || !deja.length) {
        await sb.from('web_liens').insert({ client_id: clientId, libelle: 'Apercu Vercel (Usine)', url: url });
      }
    }
    return { etat: 'READY', url: url };
  }
  return { etat: etat };
}

// ---------------------------------------------------------------
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const action = body.action;
  const host = req.headers.host;
  const sb = getSB();

  try {
    if (action === 'trier') return res.status(200).json(await actionTrier(sb, body));
    if (action === 'generer') return res.status(200).json(await actionGenerer(sb, body, host));
    if (action === 'publier') return res.status(200).json(await actionPublier(sb, body, host));
    if (action === 'statut') return res.status(200).json(await actionStatut(sb, body));
    return res.status(400).json({ error: 'action inconnue: ' + action });
  } catch (err) {
    console.error('api/usine [' + action + ']:', err);
    return res.status(500).json({ error: err.message });
  }
};
