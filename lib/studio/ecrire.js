// Un appel à Claude qui rend une réponse structurée : un seul outil, imposé (ou demandé en clair aux modèles qui refusent
// l'outil imposé, lib/claude.js). Coût exact de tous les essais, modèle de secours, réponse coupée relancée plus longue,
// et les listes ou objets rendus en texte JSON relus selon le schéma.
'use strict';
const { MODELS } = require('../config');
const { appel, coutDe } = require('../claude');

// certains modèles rendent une liste ou un objet imbriqué sous forme de texte JSON (« "beats": "[{...}]" ») : on le relit
function relire(v, sch) {
  if (!sch || v == null) return v;
  if ((sch.type === 'array' || sch.type === 'object') && typeof v === 'string') {
    const t = v.trim();
    if (/^[[{]/.test(t)) { try { v = JSON.parse(t); } catch (e) { /* laissé tel quel : le contrôle du travail le refusera */ } }
  }
  if (sch.type === 'array' && Array.isArray(v) && sch.items) return v.map((x) => relire(x, sch.items));
  if (sch.type === 'object' && v && typeof v === 'object' && !Array.isArray(v) && sch.properties) {
    const o = Object.assign({}, v);
    Object.keys(sch.properties).forEach((k) => { if (k in o) o[k] = relire(o[k], sch.properties[k]); });
    return o;
  }
  return v;
}

// ce qu'un outil a reçu, en une ligne (pour comprendre un refus du contrôle sans relire la réponse)
function recu(x) {
  return Object.keys(x || {}).slice(0, 12).map((k) => { const v = x[k]; return k + ' ' + (Array.isArray(v) ? 'liste de ' + v.length : v && typeof v === 'object' ? 'objet' : typeof v === 'string' ? 'texte de ' + v.length : typeof v); }).join(', ') || 'rien';
}

async function outil(o) {
  const tier = MODELS[o.tier] ? o.tier : 'smart';
  const p = MODELS[tier];
  const contenu = typeof o.contenu === 'string' ? [{ type: 'text', text: o.contenu }] : o.contenu;
  const corps = { model: p.id, max_tokens: o.maxTokens || 4000, system: [{ type: 'text', text: o.systeme, cache_control: { type: 'ephemeral' } }], tools: [o.outil], tool_choice: { type: 'tool', name: o.outil.name }, messages: [{ role: 'user', content: contenu }] };
  const usage = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, searches: 0 };
  const compter = (r) => { if (!r || !r.ok) return; const u = r.data.usage || {}; usage.in += u.input_tokens || 0; usage.out += u.output_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0; usage.cacheRead += u.cache_read_input_tokens || 0; };
  const repondu = (r) => r.ok && (r.data.content || []).some((b) => b.type === 'tool_use' && b.name === o.outil.name);
  const coupe = (r) => r.ok && r.data.stop_reason === 'max_tokens';
  // une longue réponse (une scène 3D, un script) arrive en flux, dans le temps qu'il reste au passage : demandée d'un bloc,
  // elle butait sur le délai de la requête et rien n'arrivait
  const longue = corps.max_tokens >= 6000;
  const lesOpts = () => longue ? { flux: true, delai: o.limite ? Math.max(30000, Math.min(240000, o.limite - Date.now() - 15000)) : 240000 } : null;
  let x = await appel(corps, 2, lesOpts());
  compter(x);
  // réponse coupée avant la fin de l'outil (souvent un texte écrit avant de l'appeler) : on relance avec plus de place
  if (coupe(x)) { corps.max_tokens = Math.min(32000, Math.round(corps.max_tokens * 1.8)); x = await appel(corps, 2, lesOpts()); compter(x); }
  // modèle introuvable, ou outil demandé en clair et pas appelé : le modèle de secours
  if (((!x.ok && (x.status === 404 || (x.status === 400 && /model/i.test(x.message)))) || (x.ok && !repondu(x))) && p.fallback) { x = await appel(Object.assign({}, corps, { model: p.fallback }), 2, lesOpts()); compter(x); }
  const cout = coutDe(tier, usage);
  if (!x.ok) { const e = new Error(o.outil.name + ' : ' + x.message); e.cout = cout; throw e; }
  const bloc = (x.data.content || []).find((b) => b.type === 'tool_use' && b.name === o.outil.name);
  if (!bloc) { const e = new Error(o.outil.name + ' : aucune réponse structurée' + (coupe(x) ? ' (réponse trop longue)' : '')); e.cout = cout; throw e; }
  return { entree: relire(bloc.input || {}, o.outil.input_schema), cout, usage, tronque: coupe(x) };
}

module.exports = { outil, relire, recu };
