// Petits outils partagés : échappement, formats, dates à l'heure de la Guadeloupe, icônes, toasts, dialogues.
export const TZ = 'America/Guadeloupe';
export const $ = (s, el) => (el || document).querySelector(s);
export const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// un lien externe n'est cliquable que s'il est vraiment en http(s)
export function url(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  const v = /^https?:\/\//i.test(s) ? s : /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s) ? 'https://' + s : '';
  try { const x = new URL(v); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch (e) { return ''; }
}
export const eur = (n) => (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
export const usd = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
export const nb = (n) => (Number(n) || 0).toLocaleString('fr-FR');
export const heure = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '';
export const date = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
export const jourCourt = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short' }) : '';
export function depuis(iso) {
  if (!iso) return 'jamais';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) { const m = Math.round(-s / 60); return m < 1 ? 'dans un instant' : m < 60 ? 'dans ' + m + ' min' : m < 1440 ? 'dans ' + Math.round(m / 60) + ' h' : 'dans ' + Math.round(m / 1440) + ' j'; }
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  return 'il y a ' + Math.round(s / 86400) + ' j';
}
export function heureGP() {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = (t) => Number((p.find((x) => x.type === t) || {}).value || 0);
  return g('hour') + g('minute') / 60;
}
export function salut() { const h = heureGP(); return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; }
export const initiales = (n) => String(n || '?').split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
export const pluriel = (n, un, plusieurs) => (Number(n) || 0) + ' ' + ((Number(n) || 0) > 1 ? (plusieurs || un + 's') : un);

export const STATUT = { idle: 'Disponible', working: 'Au travail', waiting: 'Attend une réponse', paused: 'En pause', error: 'En erreur', attente: 'Attend un outil' };
export const KIND = { rapport: 'Rapport', ordre: 'Consigne', proposition: 'Proposition', alerte: 'Alerte', decision: 'Décision', evaluation: 'Évaluation', evenement: 'Événement', note: 'Note' };
export const PROPK = { nouvel_agent: 'Nouvel agent', nouvelle_entreprise: 'Nouvelle entreprise', depense: 'Dépense', strategie: 'Stratégie', outil: 'Outil', acces: 'Accès', autre: 'Autre' };
export const LEADS = { nouveau: 'Brut', a_contacter: 'À contacter', a_appeler: 'À appeler', sans_contact: 'Sans contact', brouillon: 'Email prêt', contacte: 'Contacté', relance: 'Relancé', repondu: 'A répondu', interesse: 'Intéressé', client: 'Client', perdu: 'Perdu', stop: 'Désinscrit', ecarte: 'Écarté' };
export const INTENT = { interesse: 'Intéressé', rdv: 'Veut un rendez-vous', question: 'Question', pas_interesse: 'Pas intéressé', plus_tard: 'Plus tard', stop: 'STOP', autre: 'À regarder' };
export const SITEST = { brouillon: 'En fabrication', apercu: 'Aperçu en ligne', commande: 'Paiement envoyé', paye: 'Payé', livraison: 'Mise en ligne', en_ligne: 'En ligne', pause: 'En pause', expire: 'Expiré', annule: 'Retiré' };
export const SITETON = { brouillon: '', apercu: 'cobalt', commande: 'attention', paye: 'ok', livraison: 'ok', en_ligne: 'ok', pause: 'attention', expire: '', annule: '' };
export const FORMULE = { essentiel: 'Essentiel', vitrine: 'Vitrine', signature: 'Signature', menu: 'Menu QR' };
export const ITEMK = { repo: 'Fiches GitHub', veille: 'Veille', idee: 'Idées vidéo', script: 'Scripts', niche: 'Niches', etude: 'Études', reference: 'Références', evaluation: 'Évaluations', fiche: 'Fiches', note: 'Notes' };
export const SOURCE = { domaines: 'nouveau domaine', maps: 'Google Maps', registre: 'registre', partenaires: 'prescripteur', web: 'web', whatsapp: 'WhatsApp' };

/* ── icônes (trait 1,8, coins arrondis) ── */
const P = {
  ville: '<path d="M3 21h18M5 21V10l5-3v14M10 21V4l9 4v13"/><path d="M13 10h3M13 13h3M13 16h3"/>',
  gestion: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 13h3M8 16h6"/>',
  tableau: '<rect x="3" y="3" width="8" height="9" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="14" width="8" height="7" rx="2"/>',
  ventes: '<path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/>',
  reponses: '<path d="M4 5h16v10H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  emails: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
  prospects: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>',
  equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2c2.6.2 5 2.4 5 5.8"/>',
  decisions: '<path d="M12 3l8 4.5v4c0 5-3.4 8.6-8 9.5-4.6-.9-8-4.5-8-9.5v-4z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  couts: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-1-1.6-1.6-2.8-1.6-1.6 0-2.8.9-2.8 2.1 0 2.9 5.8 1.5 5.8 4.4 0 1.2-1.3 2.2-3 2.2-1.3 0-2.5-.6-3-1.7M12 6v1.6M12 16.4V18"/>',
  veille: '<path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 12h6M8 15h4"/>',
  route: '<path d="M5 20V4M5 4h10l-2 3.5L15 11H5"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  eclair: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  moins: '<path d="M5 12h14"/>',
  recentrer: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.5"/>',
  tourner: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  oeilBarre: '<path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  sortie: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  cadenas: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
  cloche: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  externe: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  copier: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lecture: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  plusMenu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lune: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  bouclier: '<path d="M12 3l8 4.5v4c0 5-3.4 8.6-8 9.5-4.6-.9-8-4.5-8-9.5v-4z"/>',
  fleche: '<path d="M9 6l6 6-6 6"/>',
  retour: '<path d="M15 6l-6 6 6 6"/>',
  maison: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'
};
export const ico = (n, cls) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + (P[n] || '') + '</svg>';
export const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l9 4.5-9 4.5-9-4.5z" fill="#7C9DFF"/><path d="M7 7.5l9 4.5v17l-9-4.5z" fill="#4A75F2"/><path d="M16 12l9-4.5v17L16 29z" fill="#2B59E8"/><path d="M9.5 12l4.5 2.2M9.5 16l4.5 2.2M9.5 20l4.5 2.2" stroke="#BFD0FF" stroke-width="1.1"/></svg>';

/* ── anneau de progression ── */
export function anneau(fait, total, taille) {
  const t = taille || 38, r = (t - 6) / 2, c = 2 * Math.PI * r, p = total ? Math.min(1, fait / total) : 0;
  return '<svg class="anneau" viewBox="0 0 ' + t + ' ' + t + '" width="' + t + '" height="' + t + '"><circle class="a-fond" cx="' + t / 2 + '" cy="' + t / 2 + '" r="' + r + '"/><circle class="a-plein" cx="' + t / 2 + '" cy="' + t / 2 + '" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(2) + '" transform="rotate(-90 ' + t / 2 + ' ' + t / 2 + ')"/></svg>';
}

/* ── toasts ── */
export function toast(texte, type) {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = texte;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('sort'); setTimeout(() => el.remove(), 320); }, type === 'err' ? 7000 : 4200);
}

/* ── dialogues (à la place de confirm et prompt) ── */
export function dialogue(opts) {
  return new Promise((ok) => {
    const voile = document.createElement('div'); voile.className = 'voile';
    const d = document.createElement('div'); d.className = 'dialogue'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<h2>' + esc(opts.titre) + '</h2>' + (opts.texte ? '<p>' + esc(opts.texte) + '</p>' : '') +
      (opts.saisie ? '<label class="champ"><span>' + esc(opts.saisie) + '</span><textarea class="saisie" rows="4"></textarea></label>' : '') +
      '<div class="ligne-actions fin"><button class="btn btn-discret" data-r="0">Annuler</button><button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primaire') + '" data-r="1">' + esc(opts.ok || 'Confirmer') + '</button></div>';
    document.body.append(voile, d);
    requestAnimationFrame(() => { voile.classList.add('visible'); d.classList.add('visible'); (d.querySelector('textarea') || d.querySelector('[data-r="1"]')).focus(); });
    const fin = (v) => { voile.classList.remove('visible'); d.classList.remove('visible'); setTimeout(() => { voile.remove(); d.remove(); }, 260); document.removeEventListener('keydown', clavier); ok(v); };
    const clavier = (e) => { if (e.key === 'Escape') fin(null); };
    document.addEventListener('keydown', clavier);
    voile.addEventListener('click', () => fin(null));
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      if (b.dataset.r === '0') return fin(null);
      const t = d.querySelector('textarea');
      fin(t ? t.value.trim() || null : true);
    });
  });
}

/* ── un bouton occupé pendant une action ── */
export async function occupe(btn, fn) {
  if (btn) { btn.classList.add('occupe'); btn.disabled = true; }
  try { return await fn(); } catch (e) { toast(e.message || String(e), 'err'); return null; }
  finally { if (btn) { btn.classList.remove('occupe'); btn.disabled = false; } }
}

// Compte jusqu'à une valeur (une seule fois par changement) : les chiffres qui bougent se voient
export function compter(el, valeur, format) {
  const fmt = format || nb;
  const avant = Number(el.dataset.v || 0);
  el.dataset.v = valeur;
  if (avant === valeur || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(valeur); return; }
  const t0 = performance.now(), d = 700;
  const pas = (t) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(avant + (valeur - avant) * e); if (k < 1) requestAnimationFrame(pas); };
  requestAnimationFrame(pas);
}
