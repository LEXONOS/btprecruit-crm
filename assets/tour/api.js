// Les appels à la tour. La session voyage dans un cookie HttpOnly (illisible depuis la page) ; une réponse 401
// renvoie à la porte.
let surDeconnexion = null;
export function quandDeconnecte(fn) { surDeconnexion = fn; }

async function lire(r) {
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && d && d.connexion && surDeconnexion) surDeconnexion(d);
  if (!r.ok) { const e = new Error(d.erreur ? d.erreur.charAt(0).toUpperCase() + d.erreur.slice(1) : d.error || ('Erreur ' + r.status)); e.statut = r.status; e.donnees = d; throw e; }
  return d;
}
export async function lireApi(op, params, chemin) {
  const q = new URLSearchParams(Object.assign({ op: op }, params || {}));
  return lire(await fetch((chemin || '/api/hq') + '?' + q.toString(), { credentials: 'same-origin', cache: 'no-store' }));
}
export async function envoyer(corps, chemin) {
  return lire(await fetch(chemin || '/api/hq', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps || {}) }));
}
export const porte = {
  etat: () => lireApi('etat', null, '/api/acces'),
  connexion: (mdp) => envoyer({ op: 'connexion', mdp: mdp }, '/api/acces'),
  creer: (jeton, mdp) => envoyer({ op: 'creer', jeton: jeton, mdp: mdp }, '/api/acces'),
  changer: (actuel, nouveau) => envoyer({ op: 'changer', actuel: actuel, nouveau: nouveau }, '/api/acces'),
  partout: () => envoyer({ op: 'partout' }, '/api/acces'),
  deconnexion: () => envoyer({ op: 'deconnexion' }, '/api/acces'),
  appareils: () => lireApi('appareils', null, '/api/acces')
};
