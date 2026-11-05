// Un appel à Claude qui rend une réponse structurée : un seul outil, imposé. Coût exact, modèle de secours.
'use strict';
const { MODELS } = require('../config');
const { appel, coutDe } = require('../claude');

async function outil(o) {
  const tier = MODELS[o.tier] ? o.tier : 'smart';
  const p = MODELS[tier];
  const contenu = typeof o.contenu === 'string' ? [{ type: 'text', text: o.contenu }] : o.contenu;
  const corps = { model: p.id, max_tokens: o.maxTokens || 4000, system: [{ type: 'text', text: o.systeme, cache_control: { type: 'ephemeral' } }], tools: [o.outil], tool_choice: { type: 'tool', name: o.outil.name }, messages: [{ role: 'user', content: contenu }] };
  let x = await appel(corps, 2);
  if (!x.ok && (x.status === 404 || (x.status === 400 && /model/i.test(x.message))) && p.fallback) x = await appel(Object.assign({}, corps, { model: p.fallback }), 2);
  if (!x.ok) throw new Error(o.outil.name + ' : ' + x.message);
  const u = x.data.usage || {};
  const usage = { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, searches: 0 };
  const bloc = (x.data.content || []).find((b) => b.type === 'tool_use' && b.name === o.outil.name);
  const cout = coutDe(tier, usage);
  if (!bloc) { const e = new Error(o.outil.name + ' : aucune réponse structurée' + (x.data.stop_reason === 'max_tokens' ? ' (réponse trop longue)' : '')); e.cout = cout; throw e; }
  return { entree: bloc.input || {}, cout, usage, tronque: x.data.stop_reason === 'max_tokens' };
}

module.exports = { outil };
