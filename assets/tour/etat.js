// L'état partagé de l'interface, sans dépendance : chaque module le lit, app.js le remplit.
export const S = {
  m: null, msgs: [], lastId: 0, etat: null, mis: null, espace: 'ville', section: 'tableau', params: {}, premier: true,
  ville: null, cycle: false, monte: false, echecs: 0, abonnes: new Set()
};
export const agentDe = (id) => (S.m && S.m.agents.find((a) => a.id === id)) || null;
export const coDe = (id) => (S.m && S.m.companies.find((c) => c.id === id)) || null;
export function nom(id) { if (id === 'louis') return 'Louis'; if (id === 'systeme' || !id) return 'La tour'; const a = agentDe(id); return a ? a.name : id; }
export const demo = () => !S.m || S.m.demo;
export const couleur = (cid) => (coDe(cid) || {}).color || '#7C9DFF';
export function surMonde(fn) { S.abonnes.add(fn); }

// les actions communes (fiches, emails, sites...) : data-act="nom" sur un bouton
export const ACTIONS = {};
export function action(n, fn) { ACTIONS[n] = fn; }

// ce que app.js branche au démarrage
export const hooks = {};
export function aller(chemin) { if (location.hash !== '#/' + chemin) location.hash = '/' + chemin; else if (hooks.routeur) hooks.routeur(); }
export const rafraichir = () => hooks.rafraichir ? hooks.rafraichir() : null;
export const lancerCycle = (b, id) => hooks.lancerCycle ? hooks.lancerCycle(b, id) : null;
export const chargerMissions = () => hooks.chargerMissions ? hooks.chargerMissions() : null;
export const rechargerEtat = () => hooks.rechargerEtat ? hooks.rechargerEtat() : null;
export const majTheme = () => hooks.majTheme ? hooks.majTheme() : null;
