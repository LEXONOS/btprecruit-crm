// Cerveau : appels à l'API Anthropic avec boucle d'outils, recherche web, cache et coût exact.
'use strict';
const { MODELS, WEB_SEARCH_USD } = require('./config');

const API = 'https://api.anthropic.com/v1/messages';

function coutDe(tier, u) {
  const p = MODELS[tier] || MODELS.fast;
  return (u.in * p.in + u.out * p.out + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead) / 1e6 + u.searches * WEB_SEARCH_USD;
}

async function appel(body, essais) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY absente des variables Vercel');
  let derniere = null;
  for (let i = 0; i < (essais || 3); i++) {
    let r;
    try {
      r = await fetch(API, {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(110000)
      });
    } catch (e) { derniere = e; await new Promise(function (ok) { setTimeout(ok, 1500 * (i + 1)); }); continue; }
    const data = await r.json().catch(function () { return {}; });
    if (r.ok) return { ok: true, data: data };
    const msg = (data.error && data.error.message) || ('HTTP ' + r.status);
    if (r.status === 429 || r.status === 529 || r.status >= 500) { derniere = new Error(msg); await new Promise(function (ok) { setTimeout(ok, 2500 * (i + 1)); }); continue; }
    return { ok: false, status: r.status, message: msg, data: data };
  }
  throw derniere || new Error('API Anthropic injoignable');
}

// opts = { tier, system (string), messages, tools: [{name, description, input_schema}], executors: {name: async (input) => any},
//          webSearch: { max_uses } | null, maxTokens, maxSteps, stopTool: 'terminer' }
async function converse(opts) {
  const tier = opts.tier || 'fast';
  const p = MODELS[tier] || MODELS.fast;
  let model = p.id;
  const tools = (opts.tools || []).slice();
  if (opts.webSearch) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: opts.webSearch.max_uses || 3, user_location: { type: 'approximate', country: 'FR', timezone: 'America/Guadeloupe' } });
  const messages = opts.messages.slice();
  const usage = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const log = [];
  let fin = null, texte = '', steps = 0, fallbackFait = false;
  const maxSteps = opts.maxSteps || 8;

  while (steps < maxSteps) {
    steps++;
    const body = {
      model: model,
      max_tokens: opts.maxTokens || 2500,
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      messages: avecCache(messages)
    };
    if (tools.length) body.tools = tools;
    const r = await appel(body);
    if (!r.ok) {
      const modeleIndispo = r.status === 404 || (r.status === 400 && /model/i.test(r.message));
      if (modeleIndispo && !fallbackFait && p.fallback) { model = p.fallback; fallbackFait = true; steps--; continue; }
      if (r.status === 400 && /web_search/i.test(r.message) && tools.some(function (t) { return t.name === 'web_search'; })) {
        tools.splice(tools.findIndex(function (t) { return t.name === 'web_search'; }), 1); steps--; continue; // recherche web désactivée sur le compte : on continue sans
      }
      throw new Error(model + ' : ' + r.message);
    }
    const d = r.data;
    const u = d.usage || {};
    usage.in += u.input_tokens || 0;
    usage.out += u.output_tokens || 0;
    usage.cacheWrite += u.cache_creation_input_tokens || 0;
    usage.cacheRead += u.cache_read_input_tokens || 0;
    usage.searches += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
    const content = d.content || [];
    messages.push({ role: 'assistant', content: content });
    content.forEach(function (b) {
      if (b.type === 'text' && b.text) { texte += (texte ? '\n' : '') + b.text; }
      if (b.type === 'server_tool_use') log.push({ t: 'recherche', q: b.input && b.input.query });
    });
    if (opts.maxCout && coutDe(tier, usage) > opts.maxCout) { fin = fin || { resume: 'Passage arrêté : coût maximum du passage atteint.' }; log.push({ t: 'arret', raison: 'cout' }); break; }
    if (d.stop_reason === 'pause_turn') continue;
    if (d.stop_reason !== 'tool_use') break;

    const resultats = [];
    for (const b of content) {
      if (b.type !== 'tool_use') continue;
      const fn = opts.executors && opts.executors[b.name];
      let out;
      if (b.name === (opts.stopTool || 'terminer')) { fin = b.input || {}; out = 'ok'; }
      else if (!fn) out = { erreur: 'outil inconnu : ' + b.name };
      else {
        try { out = await fn(b.input || {}); }
        catch (e) { out = { erreur: String(e.message || e).slice(0, 400) }; }
      }
      log.push({ t: 'outil', nom: b.name, entree: resume(b.input), sortie: resume(out) });
      resultats.push({ type: 'tool_result', tool_use_id: b.id, content: typeof out === 'string' ? out : JSON.stringify(out).slice(0, 12000) });
    }
    messages.push({ role: 'user', content: resultats });
    if (fin) break;
  }
  return { texte: texte, fin: fin, steps: steps, usage: usage, cout: coutDe(tier, usage), model: model, log: log };
}

// Point de cache glissant sur le dernier message utilisateur : les tours suivants d'une même boucle
// relisent le début de la conversation au dixième du prix.
function avecCache(messages) {
  const out = messages.slice();
  for (let k = out.length - 1; k >= 0; k--) {
    if (out[k].role !== 'user') continue;
    const m = out[k];
    const content = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content.map(function (b) { return Object.assign({}, b); });
    if (!content.length) break;
    content[content.length - 1] = Object.assign({}, content[content.length - 1], { cache_control: { type: 'ephemeral' } });
    out[k] = { role: 'user', content: content };
    break;
  }
  return out;
}

function resume(x) {
  try { const s = typeof x === 'string' ? x : JSON.stringify(x); return s.length > 300 ? s.slice(0, 300) + '…' : s; } catch (e) { return ''; }
}

// Appel simple sans outils (rédaction courte, résumé)
async function texteSimple(tier, system, prompt, maxTokens) {
  const r = await converse({ tier: tier, system: system, messages: [{ role: 'user', content: prompt }], maxTokens: maxTokens || 1200, maxSteps: 1 });
  return r;
}

module.exports = { converse, texteSimple, coutDe };
