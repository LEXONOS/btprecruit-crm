// Ada, Veilleuse GitHub : recherche des dépôts les plus forts sur nos sujets (rotation dans sa stratégie),
// lecture du README, fiche écrite par Claude (rapide) : ce que ça fait, pourquoi c'est fort, licence, quoi reprendre.
'use strict';
const { converse } = require('../claude');
const { court } = require('../util');

const UA = 'LaTour-Labo/1.0 (LEXONOS)';
const PAR_PASSAGE = 3;

function requetes(playbook) {
  return String(playbook || '').split('\n').map(function (l) { return l.trim(); })
    .filter(function (l) { return l && !/^recherches/i.test(l) && /[a-z]/i.test(l) && l.indexOf('|') < 0; });
}
function gh(url) {
  const h = { 'User-Agent': UA, Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) h.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  return fetch(url, { headers: h, signal: AbortSignal.timeout(15000) });
}
async function readme(full, branche) {
  for (const n of ['README.md', 'readme.md', 'README.MD', 'Readme.md']) {
    try {
      const r = await fetch('https://raw.githubusercontent.com/' + full + '/' + (branche || 'main') + '/' + n, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
      if (r.ok) return (await r.text()).slice(0, 9000);
    } catch (e) { /* essai suivant */ }
  }
  return '';
}

async function run(ctx) {
  const db = ctx.db;
  const qs = requetes(ctx.agent.playbook);
  if (!qs.length) return { resume: 'Aucune recherche dans ma stratégie.', produit: 0 };
  const cfg = await db.one('hq_config', { eq: { key: 'job:github' } });
  let i = (cfg && cfg.value && cfg.value.i) || 0;
  const candidats = [];
  for (let k = 0; k < 2 && candidats.length < PAR_PASSAGE * 3; k++) {
    const q = qs[i % qs.length]; i++;
    const r = await gh('https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&order=desc&per_page=10').catch(function () { return null; });
    if (!r || !r.ok) continue;
    const d = await r.json().catch(function () { return {}; });
    (d.items || []).forEach(function (it) { if (!it.archived && !it.fork) candidats.push(Object.assign({ _q: q }, it)); });
  }
  await db.upsert('hq_config', { key: 'job:github', value: { i: i % qs.length }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (!candidats.length) return { resume: 'GitHub n\'a rien renvoyé (limite de requêtes ?), je réessaie au prochain passage.', produit: 0, prochain_min: 180 };
  // déjà connus ?
  const cles = candidats.map(function (c) { return 'repo:' + c.full_name.toLowerCase(); });
  const connus = new Set((await db.select('hq_items', { select: 'dedupe', in: { dedupe: cles } })).map(function (x) { return x.dedupe; }));
  const neufs = candidats.filter(function (c, k, arr) { return !connus.has('repo:' + c.full_name.toLowerCase()) && arr.findIndex(function (x) { return x.full_name === c.full_name; }) === k; })
    .sort(function (a, b) { return (b.stargazers_count || 0) - (a.stargazers_count || 0); }).slice(0, PAR_PASSAGE);
  if (!neufs.length) return { resume: 'Rien de nouveau sur ces recherches (déjà fiché).', produit: 0 };
  let cout = 0; const usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };
  const fiches = [];
  for (const c of neufs) {
    if (Date.now() > ctx.limite - 30000) break;
    const txt = await readme(c.full_name, c.default_branch);
    const meta = { nom: c.full_name, url: c.html_url, etoiles: c.stargazers_count, langue: c.language, licence: c.license ? c.license.spdx_id : 'aucune', maj: c.pushed_at, description: c.description, sujets: (c.topics || []).slice(0, 8), recherche: c._q };
    let fiche = { resume: court(c.description, 300), pourquoi_fort: '', a_reprendre: '', pour_quel_agent: '', score: 50 };
    if (process.env.ANTHROPIC_API_KEY && ctx.peutDepenser()) {
      try {
        const r = await converse({
          tier: 'fast', maxTokens: 700, maxSteps: 1,
          system: 'Tu es Ada, veilleuse GitHub du Labo Avengers (groupe LEXONOS : agents IA qui prospectent des clients pour des sites internet aux Antilles, produisent des vidéos 3D, étudient des niches e-commerce ; stack Node sur Vercel + Supabase + API Claude). Tu fais des fiches courtes et utiles, en français, sans tirets longs. Réponds UNIQUEMENT en JSON : {"resume":"ce que fait le projet en 2 phrases","pourquoi_fort":"ce qui le rend fort","a_reprendre":"ce qu\'on peut reprendre concrètement chez nous","pour_quel_agent":"quel agent ou quelle entreprise du groupe en profite","attention":"licence ou limite","score":0-100}. Score = intérêt pour NOUS (licence non réutilisable ou hors sujet = score bas).',
          messages: [{ role: 'user', content: 'Dépôt : ' + JSON.stringify(meta) + '\n\nREADME (extrait) :\n' + txt.slice(0, 7000) }]
        });
        cout += r.cout; ['in', 'out', 'cacheRead', 'cacheWrite'].forEach(function (k) { usage[k] += r.usage[k]; });
        const m = String(r.texte || '').match(/\{[\s\S]*\}/);
        if (m) fiche = Object.assign(fiche, JSON.parse(m[0]));
      } catch (e) { fiche.attention = 'fiche automatique : ' + String(e.message).slice(0, 100); }
    }
    fiches.push({
      company_id: 'labo', agent_id: ctx.agent.id, kind: 'repo', dedupe: 'repo:' + c.full_name.toLowerCase(),
      title: c.full_name + ' (' + (c.stargazers_count || 0).toLocaleString('fr-FR') + ' étoiles)',
      body: ['Ce que c\'est : ' + fiche.resume, 'Pourquoi c\'est fort : ' + (fiche.pourquoi_fort || '?'), 'À reprendre : ' + (fiche.a_reprendre || '?'), 'Pour : ' + (fiche.pour_quel_agent || '?'), fiche.attention ? 'Attention : ' + fiche.attention : '', 'Licence : ' + meta.licence + ' · ' + c.html_url].filter(Boolean).join('\n'),
      data: meta, score: Math.max(0, Math.min(100, Number(fiche.score) || 50)), status: 'nouveau'
    });
  }
  if (fiches.length) await db.insert('hq_items', fiches, { onConflict: 'dedupe', ignoreDuplicates: true, returning: false });
  ctx.compteurs.items += fiches.length;
  const top = fiches.slice().sort(function (a, b) { return b.score - a.score; })[0];
  return { resume: fiches.length + ' fiche(s) GitHub' + (top ? ', la plus utile : ' + top.title.split(' (')[0] + ' (' + top.score + '/100)' : ''), produit: fiches.length, cout: cout, usage: usage, modele: 'fast' };
}

module.exports = { run, requetes };
