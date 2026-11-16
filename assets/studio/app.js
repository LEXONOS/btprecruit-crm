// Le studio d'une créatrice : de l'idée à la vidéo publiée, avec son équipe. Une page, sans dépendance (la ville en 3D
// se charge à part, assets/studio/ville.js). Le design est celui de la tour : la ville à l'accueil, avec par-dessus une
// barre et des cartes en verre ; le reste (créer, les vidéos, l'équipe, les réglages) sur un fond plein, sous la barre.
// Une vidéo en route avance quand la page la regarde (une étape à la fois, voir lib/createurs/chaine.js), à l'accueil
// comme sur sa page, et toute seule le reste du temps.
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const S = {
    moi: null, cat: null, videos: null, filtre: 'tout', video: null, sigCorps: '', onglet: {}, partage: {}, mayaCherche: false, boucle: 0, chargement: false,
    ville: null, villeEssai: false, fil: [], filOuvert: false, salutReplie: false, menu: false, fiche: null, evenement: null, modele: '', visite: null, statuts: null, badgesVus: null
  };

  /* ── petits outils ── */
  const I = {
    studio: '<path d="M3 21h18"/><path d="M5 21V9l6-4v16"/><path d="M11 21V8l8-3v16"/><path d="M14 10h2M14 14h2M7.5 12h1M7.5 16h1"/>',
    creer: '<path d="M12 5v14M5 12h14"/>',
    ecouter: '<path d="M8 5.5v13l10.5-6.5z"/>',
    message: '<path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1.1-4.4A7.5 7.5 0 1 1 20 12.5z"/>',
    trombone: '<path d="M20.5 11.5l-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
    envoyer: '<path d="M4.5 12L20 4.5 16 20l-3.6-6.4z"/><path d="M12.4 13.6L20 4.5"/>',
    videos: '<rect x="4" y="3" width="7" height="12" rx="2"/><rect x="13" y="9" width="7" height="12" rx="2"/>',
    equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.6c2.2.3 3.8 1.9 4.5 4.4"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    retour: '<path d="M15 18l-6-6 6-6"/>',
    telecharger: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    partager: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
    copier: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    ouvrir: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    jour: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    nuit: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    moins: '<path d="M5 12h14"/>',
    recentrer: '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.5"/>',
    tourner: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
    bas: '<path d="M6 9l6 6 6-6"/>',
    personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    sortir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    aide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
    etoile: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z"/>',
    flamme: '<path d="M12 21c-4 0-7-2.7-7-6.5 0-3 2-5.2 3.5-6.8.3 1.8 1.2 3 2.5 3.3C11 7 12.5 4.5 14.5 3c.2 3 1.5 4.6 2.8 6.1C18.6 10.6 19 12.2 19 14.5 19 18.3 16 21 12 21z"/>',
    avion: '<path d="M21 3L3 10.5l7 2.5 2.5 7z"/><path d="M10 13l11-10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
    cle: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    pile: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M7 5h10M9 2h6"/>',
    clap: '<path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 9l2-5 14 3-1 2M9 5l2 3M14 6l2 3"/>',
    pilote: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    // les modèles de vidéo
    saviez: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    top3: '<path d="M4 20v-6h5v6M9 20V9h6v11M15 20v-8h5v8"/><path d="M3 20h18"/>',
    mythe: '<path d="M12 4v16M6 20h12M6 8h12"/><path d="M6 8l-3 6h6zM18 8l-3 6h6z"/>',
    pov: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    histoire: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    tuto: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    duel: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    chiffres: '<path d="M5 19L19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    avant: '<path d="M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4"/>',
    question: '<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9.2a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.5M12 14v.01"/>',
    libre: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'
  };
  const ico = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[n] || '') + '</svg>';
  const usd = (n) => { n = Number(n) || 0; if (n > 0 && n < 0.01) return 'moins d\'un centime'; return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $'; };
  const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '');
  const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  function depuis(iso) {
    if (!iso) return '';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'à l\'instant';
    if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
    return 'le ' + dateCourte(iso);
  }
  const forts = (t) => h(String(t || '')).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const sansEtoiles = (t) => String(t || '').replace(/\*/g, '');
  function clair(c) { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) return false; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 160; }
  const NUANCES = ['#8B5CF6', '#EC4899', '#FF5A8A', '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#A855F7'];
  const nomLangue = (l) => ((S.cat && S.cat.langues[l]) || {}).nom || l;
  const membre = (role) => (S.moi && S.moi.equipe[role]) || { prenom: role, couleur: '#8B5CF6' };
  const initiale = (s) => h(String(s || '?').charAt(0).toUpperCase());
  const avatar = (role, cls, travaille) => { const m = membre(role); return '<span class="agent ' + (cls || '') + (travaille ? ' travaille' : '') + '" style="--c:' + h(m.couleur) + '" title="' + h(m.prenom) + '">' + initiale(m.prenom) + '</span>'; };
  const avatarMoi = (cls) => '<span class="agent ' + (cls || '') + '" style="--c:var(--accent)">' + initiale(S.moi.prenom) + '</span>';
  const memoire = { lire(k, d) { try { const v = localStorage.getItem('studio:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, ecrire(k, v) { try { localStorage.setItem('studio:' + k, JSON.stringify(v)); } catch (e) { /* navigation privée */ } } };

  function toast(texte, type) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = texte;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('sort'); setTimeout(() => el.remove(), 320); }, type === 'err' ? 7000 : 3800);
  }
  function fenetre(o) {
    return new Promise((ok) => {
      const voile = document.createElement('div'); voile.className = 'voile';
      const f = document.createElement('div'); f.className = 'fenetre'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
      f.innerHTML = '<h2>' + h(o.titre) + '</h2>' + (o.texte ? '<p>' + h(o.texte) + '</p>' : '') + (o.saisie ? '<textarea rows="3" placeholder="' + h(o.saisie) + '">' + h(o.valeur || '') + '</textarea>' : '') +
        '<div class="actions fin"><button class="btn discret" data-r="0">Annuler</button><button class="btn ' + (o.danger ? 'danger' : '') + '" data-r="1">' + h(o.ok || 'Confirmer') + '</button></div>';
      document.body.append(voile, f);
      requestAnimationFrame(() => { voile.classList.add('visible'); f.classList.add('visible'); ($('textarea', f) || $('[data-r="1"]', f)).focus(); });
      const fin = (v) => { voile.classList.remove('visible'); f.classList.remove('visible'); setTimeout(() => { voile.remove(); f.remove(); }, 220); document.removeEventListener('keydown', cl); ok(v); };
      const cl = (e) => { if (e.key === 'Escape') fin(null); };
      document.addEventListener('keydown', cl);
      voile.addEventListener('click', () => fin(null));
      f.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; if (b.dataset.r === '0') return fin(null); const t = $('textarea', f); fin(t ? (t.value.trim() || '') : true); });
    });
  }
  async function occupe(btn, fn) {
    if (btn) { btn.classList.add('occupe'); btn.disabled = true; }
    try { return await fn(); } catch (e) { toast(e.message || String(e), 'err'); return null; }
    finally { if (btn) { btn.classList.remove('occupe'); btn.disabled = false; } }
  }
  // des confettis en papier par-dessus la page (quand la ville n'est pas à l'écran)
  function confettis() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confettis'; box.setAttribute('aria-hidden', 'true');
    const couleurs = Object.values(S.moi.equipe).map((m) => m.couleur).concat([getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8B5CF6', '#FFD166']);
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.left = (Math.random() * 100) + 'vw'; c.style.background = couleurs[i % couleurs.length];
      c.style.setProperty('--dx', ((Math.random() - 0.5) * 30) + 'vw'); c.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
      c.style.animationDelay = (Math.random() * 0.5) + 's'; c.style.animationDuration = (2 + Math.random() * 1.4) + 's';
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  }

  /* ── l'API ── */
  async function lire(op, p) {
    const r = await fetch('/api/studio?' + new URLSearchParams(Object.assign({ op }, p || {})), { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.connexion) { S.moi = null; rendre(); throw new Error(d.erreur || 'Connecte-toi.'); }
    if (!r.ok) throw new Error(d.erreur || 'Le studio ne répond pas (' + r.status + ').');
    return d;
  }
  async function agir(op, corps) {
    const r = await fetch('/api/studio', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ op }, corps || {})) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.connexion) { S.moi = null; rendre(); throw new Error(d.erreur || 'Connecte-toi.'); }
    if (!r.ok) { const e = new Error(d.erreur || 'Le studio ne répond pas (' + r.status + ').'); e.code = d.code; throw e; }
    if (d.moi) S.moi = d.moi;
    return d;
  }

  /* ── le thème : ses couleurs, le jour et la nuit comme dans la tour ── */
  function estNuit() {
    const t = (S.moi && S.moi.reglages.theme) || {};
    if (t.mode === 'nuit') return true;
    if (t.mode === 'jour') return false;
    let hh = new Date().getHours();
    try { hh = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: S.moi.reglages.fuseau || 'Europe/Paris' }).format(new Date())); } catch (e) { /* l'heure de l'appareil */ }
    return hh < 7 || hh >= 20;
  }
  function appliquerTheme() {
    const r = S.moi ? S.moi.reglages : {};
    const t = r.theme || {};
    const root = document.documentElement;
    const nuit = S.moi ? estNuit() : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = nuit ? 'nuit' : 'jour';
    root.style.setProperty('--accent', t.accent || '#8B5CF6');
    root.style.setProperty('--sur-accent', clair(t.accent) ? '#16121F' : '#FFFFFF');
    root.style.setProperty('--video', r.couleur || '#FF5A8A');
    const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', nuit ? '#0A1328' : '#EDF1F7');
  }

  /* ── la navigation ── */
  const VUES = ['accueil', 'creer', 'videos', 'video', 'equipe', 'reglages', 'messages'];
  function route() {
    const x = location.hash.replace(/^#/, '');
    if (x.indexOf('invitation=') === 0) return { vue: 'invitation', arg: x.slice(11) };
    const p = x.split('/');
    if (p[0] === 'connexions') return { vue: 'reglages', arg: 'connexions' };
    return { vue: VUES.indexOf(p[0]) >= 0 ? p[0] : 'accueil', arg: p[1] || '' };
  }
  window.addEventListener('hashchange', () => { S.boucle++; S.menu = false; rendre(); window.scrollTo(0, 0); });

  function jaugeHtml() {
    const d = S.moi.depense;
    const k = Math.max(0, Math.min(1, d.budget ? d.jour / d.budget : 0));
    const c = 2 * Math.PI * 11;
    return '<a class="jauge" href="#reglages/budget" title="Dépense du jour sur ta clé Claude"><svg viewBox="0 0 28 28"><circle class="fond" cx="14" cy="14" r="11" fill="none" stroke-width="3"/><circle class="plein" cx="14" cy="14" r="11" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - k)).toFixed(1) + '"/></svg><span><b class="num">' + h(usd(d.jour)) + '</b><br>sur ' + h(usd(d.budget)) + '</span></a>';
  }
  const NAV = [['accueil', 'Studio', 'studio'], ['creer', 'Créer', 'creer'], ['videos', 'Vidéos', 'videos'], ['equipe', 'Équipe', 'equipe'], ['reglages', 'Réglages', 'reglages']];
  function barreHtml(vue) {
    const r = S.moi.reglages;
    const actif = vue === 'video' ? 'videos' : vue;
    const nom = r.chaine.nom || 'Le studio de ' + S.moi.prenom;
    return '<header class="barre"><a class="marque" href="#accueil" aria-label="Mon studio"><span class="logo">' + initiale(r.chaine.nom || S.moi.prenom) + '</span><span><b>' + h(nom) + '</b><small>' + h(r.langues.map(nomLangue).join(', ')) + '</small></span></a>' +
      '<nav class="onglets-barre" aria-label="Le studio">' + NAV.map((n) => '<a href="#' + n[0] + '" class="' + (n[0] === 'creer' ? 'creer ' : '') + (actif === n[0] ? 'on' : '') + '"' + (actif === n[0] ? ' aria-current="page"' : '') + '>' + ico(n[2]) + n[1] + '</a>').join('') + '</nav>' +
      '<div class="barre-d">' + jaugeHtml() + boutonMessages(vue) +
      '<button class="icone-barre" data-a="basculerNuit" title="' + (estNuit() ? 'Passer au jour' : 'Passer à la nuit') + '" aria-label="' + (estNuit() ? 'Passer au jour' : 'Passer à la nuit') + '">' + ico(estNuit() ? 'jour' : 'nuit') + '</button>' +
      '<div class="compte"><button class="icone-barre" data-a="menu" aria-label="Mon compte" aria-expanded="' + S.menu + '">' + ico('personne') + '</button>' + (S.menu ? menuHtml() : '') + '</div></div></header>';
  }
  // l'icône des messages de Louis, avec ce qu'il reste à lire
  function boutonMessages(vue) {
    const n = S.moi.messages_non_lus || 0;
    return '<a class="icone-barre messages' + (vue === 'messages' ? ' on' : '') + '" id="b-messages" href="#messages" title="Messages avec Louis" aria-label="Messages avec Louis' + (n ? ', ' + n + ' non lu' + (n > 1 ? 's' : '') : '') + '">' + ico('message') + (n ? '<span class="compteur">' + (n > 9 ? '9+' : n) + '</span>' : '') + '</a>';
  }
  function majBoutonMessages() { const b = $('#b-messages'); if (b) b.outerHTML = boutonMessages(route().vue); }
  function menuHtml() {
    return '<div class="menu-compte" role="menu"><a href="#reglages/compte" role="menuitem">' + ico('personne') + 'Mon compte (' + h(S.moi.identifiant) + ')</a><a href="#equipe" role="menuitem">' + ico('etoile') + 'Mes badges</a>' +
      '<button data-a="revoirVisite" role="menuitem">' + ico('studio') + 'Revoir la visite</button><a href="#reglages/aide" role="menuitem">' + ico('aide') + 'Aide</a><hr><button data-a="deconnexion" role="menuitem">' + ico('sortir') + 'Me déconnecter</button></div>';
  }
  function tabsHtml(vue) {
    const actif = vue === 'video' ? 'videos' : vue;
    return '<nav class="tabs" aria-label="Le studio">' + NAV.map((n) => '<a href="#' + n[0] + '" class="' + (n[0] === 'creer' ? 'creer ' : '') + (actif === n[0] ? 'on' : '') + '"' + (actif === n[0] ? ' aria-current="page"' : '') + '>' + ico(n[2]) + '<span>' + n[1] + '</span></a>').join('') + '</nav>';
  }

  function rendre() {
    const r = route();
    if (r.vue === 'invitation') { cacherVille(); return vueInvitation(r.arg); }
    if (!S.cat) return;
    if (!S.moi) { cacherVille(); return vueConnexion(); }
    appliquerTheme();
    const accueil = r.vue === 'accueil';
    document.body.classList.toggle('sur-ville', accueil);
    let corps;
    if (accueil) corps = calqueAccueil();
    else {
      let c;
      if (r.vue === 'creer') c = vueCreer();
      else if (r.vue === 'videos') c = vueVideos();
      else if (r.vue === 'video') c = vueVideo(r.arg);
      else if (r.vue === 'equipe') c = vueEquipe();
      else if (r.vue === 'messages') c = vueMessages();
      else c = vueReglages(r.arg || 'chaine');
      corps = '<div class="gestion"><main id="contenu" class="contenu' + (r.vue === 'videos' ? ' large' : r.vue === 'messages' ? ' conv-page' : '') + '">' + c + '</main></div>';
    }
    $('#app').innerHTML = barreHtml(r.vue) + corps + tabsHtml(r.vue);
    if (accueil) montrerVille(); else cacherVille();
    apres(r);
  }
  // ce qui se charge après l'affichage (les listes, la vidéo, le suivi)
  function apres(r) {
    if (r.vue === 'reglages') { const a = $('.reglages-nav a.on'); if (a && a.scrollIntoView) a.scrollIntoView({ inline: 'center', block: 'nearest' }); }
    if ((r.vue === 'accueil' || r.vue === 'videos' || r.vue === 'equipe') && !S.chargement) chargerVideos();
    if (r.vue === 'video') { if (!S.video || String(S.video.id) !== String(r.arg)) chargerVideo(r.arg); else { centrerBande(); suivre(r.arg); } }
    if (r.vue === 'messages') ouvrirMessages();
    if (r.vue === 'accueil' && !S.moi.reglages.visite_faite && !S.visite && !memoire.lire('visite-passee-' + S.moi.identifiant, false)) ouvrirVisite(0);
  }
  async function chargerVideos(silencieux) {
    S.chargement = true;
    const premiere = S.videos === null;
    try { const d = await lire('videos'); remarquer(d.videos || []); S.videos = d.videos || []; } catch (e) { if (!silencieux) toast(e.message, 'err'); }
    finally { S.chargement = false; }
    const r = route();
    if (r.vue === 'accueil') { majCalque(); majVille(); }
    else if (r.vue === 'videos' || (r.vue === 'equipe' && premiere)) { const c = $('#contenu'); if (c) c.innerHTML = r.vue === 'videos' ? vueVideos() : vueEquipe(); }
    verifierBadges();
    // une vidéo en route : à l'accueil, la page la fait avancer comme sur sa page ; sinon la liste se rafraîchit seule
    if (r.vue === 'accueil') pousserAccueil();
    else if (r.vue === 'videos' && (S.videos || []).some((v) => S.cat.automatiques.indexOf(v.status) >= 0)) {
      const moi = ++S.boucle;
      await dormir(20000);
      if (moi === S.boucle && !document.hidden) chargerVideos(true);
    }
  }
  // ce qui a changé depuis la dernière fois : une vidéo prête ou publiée, c'est la fête ; le fil de l'équipe s'allonge
  function remarquer(liste) {
    const avant = S.statuts;
    S.statuts = {};
    liste.forEach((v) => { S.statuts[v.id] = v.status; });
    if (!avant) { liste.slice(0, 6).forEach((v) => { const t = phraseVideo(v); if (t) S.fil.push({ role: t.role, texte: t.texte, lien: '#video/' + v.id, t: new Date(v.updated_at || v.created_at).getTime() }); }); S.fil.sort((a, b) => b.t - a.t); return; }
    liste.forEach((v) => {
      const a = avant[v.id];
      if (a === v.status) return;
      const t = phraseVideo(v);
      if (t) ajouterFil(t.role, t.texte, '#video/' + v.id);
      if (v.status === 'prete' && a && a !== 'prete') { feter('prete'); toast('« ' + sansEtoiles(v.titre) + ' » est prête.', 'ok'); }
      if (v.status === 'publiee' && a && a !== 'publiee') { feter('publiee'); }
      if (v.status === 'relecture' && a && a !== 'relecture') toast('Un script t\'attend : « ' + sansEtoiles(v.titre) + ' ».', 'ok');
    });
  }
  function phraseVideo(v) {
    const e = v.etape || {}, tt = '« ' + sansEtoiles(v.titre || '') + ' »';
    if (e.erreur && S.cat.automatiques.indexOf(v.status) >= 0) return { role: roleActif(v), texte: 'Souci sur ' + tt + ' : ' + e.erreur };
    switch (v.status) {
      case 'ecriture': return e.quoi === 'critique' ? { role: 'critique', texte: membre('critique').prenom + ' relit ' + tt } : { role: 'plume', texte: membre('plume').prenom + (e.quoi === 'reecriture' ? ' réécrit ' : ' écrit ') + tt };
      case 'relecture': return { role: 'toi', texte: 'Le script de ' + tt + ' t\'attend' };
      case 'langues': return { role: 'traduction', texte: membre('traduction').prenom + ' adapte ' + tt };
      case 'realisation': return { role: 'realisation', texte: membre('realisation').prenom + (e.quoi === 'voix' ? ' enregistre les voix de ' : e.quoi === 'images_ia' ? ' fait créer les images IA de ' : ' choisit les images de ') + tt };
      case 'fabrication': return { role: 'realisation', texte: 'Montage de ' + tt };
      case 'prete': return { role: 'diffusion', texte: tt + ' est prête à publier' };
      case 'publication': return { role: 'diffusion', texte: membre('diffusion').prenom + ' publie ' + tt };
      case 'publiee': return { role: 'diffusion', texte: tt + ' est en ligne' };
      case 'echec': return { role: roleActif(v), texte: tt + ' est bloquée' };
      default: return null;
    }
  }
  function ajouterFil(role, texte, lien) {
    S.fil.unshift({ role, texte, lien: lien || null, t: Date.now(), frais: true });
    S.fil = S.fil.slice(0, 30);
    const f = $('#fil'); if (f) f.outerHTML = filHtml();
  }
  // à l'accueil : une vidéo en route avance pendant qu'elle regarde son équipe travailler
  async function pousserAccueil() {
    const moi = ++S.boucle;
    while (moi === S.boucle && route().vue === 'accueil') {
      if (document.hidden) { await dormir(4000); continue; }
      const enRoute = (S.videos || []).filter((v) => S.cat.automatiques.indexOf(v.status) >= 0);
      if (!enRoute.length) return;
      const prete = enRoute.find((v) => { const e = v.etape || {}; return !e.bloque && !(e.attendre_jusqu && new Date(e.attendre_jusqu).getTime() > Date.now()); });
      let attente = 15000;
      if (prete) {
        try {
          const lent = prete.status === 'fabrication' || prete.status === 'publication';
          const d = await agir('avancer', { id: prete.id });
          if (moi !== S.boucle) return;
          attente = lent ? 15000 : d.occupe ? 5000 : d.erreur ? 6000 : 2500;
        } catch (e) { attente = 12000; }
      }
      await dormir(attente);
      if (moi !== S.boucle || route().vue !== 'accueil') return;
      try { const d = await lire('videos'); remarquer(d.videos || []); S.videos = d.videos || []; majCalque(); majVille(); verifierBadges(); } catch (e) { /* on réessaie au prochain tour */ }
    }
  }

  /* ── la ville en 3D ── */
  function villeVoulue() { return S.moi && S.moi.reglages.theme.ville !== false && 'WebGLRenderingContext' in window; }
  function montrerVille() {
    const box = $('#ville');
    box.hidden = false;
    if (!villeVoulue()) { box.classList.add('sans-3d'); if (S.ville) { S.ville.detruire(); S.ville = null; } return; }
    box.classList.remove('sans-3d');
    if (S.ville) { S.ville.reprendre(); S.ville.redimensionner(); majVille(); return; }
    if (S.villeEssai) return;
    S.villeEssai = true;
    import('/assets/studio/ville.js').then((m) => {
      S.villeEssai = false;
      if (route().vue !== 'accueil' || S.ville) return;
      try {
        S.ville = m.creerStudio3D(box, {
          agent: (role) => ouvrirFiche(role),
          ecran: () => { const v = derniereVideo(); location.hash = v ? '#video/' + v.id : '#creer'; },
          enseigne: () => { location.hash = '#reglages/chaine'; },
          voiture: (ok) => { if (!ok) toast('Mila est passée il y a peu. Elle repassera, elle repasse toujours.'); },
          piscine: (ok) => { if (!ok) toast((S.videos || []).some((v) => S.cat.automatiques.indexOf(v.status) >= 0) ? 'Personne n\'est libre pour se baigner : l\'équipe travaille.' : 'Elles sèchent encore de la dernière fois.'); },
          rien: () => fermerFiche(),
          evenement: (e) => scene(e)
        });
        majVille();
      } catch (e) { box.classList.add('sans-3d'); }
    }).catch(() => { S.villeEssai = false; box.classList.add('sans-3d'); });
  }
  function cacherVille() { const box = $('#ville'); if (box) box.hidden = true; if (S.ville) S.ville.pause(); document.body.classList.remove('sur-ville'); }
  function derniereVideo() { return (S.videos || []).find((v) => ['prete', 'publiee', 'publication'].indexOf(v.status) >= 0) || (S.videos || [])[0] || null; }
  // ce que la ville montre : qui travaille sur quoi, ce qui l'attend, la dernière vidéo
  function etatVille() {
    const taches = {};
    (S.videos || []).forEach((v) => {
      if (S.cat.automatiques.indexOf(v.status) < 0) return;
      const role = roleActif(v);
      if (!taches[role]) taches[role] = { videoId: v.id, titre: v.titre, bloque: !!((v.etape || {}).bloque || (v.etape || {}).erreur) };
    });
    const attend = (S.videos || []).find((v) => v.status === 'relecture');
    const der = derniereVideo();
    return {
      equipe: S.moi.equipe, moi: { prenom: S.moi.prenom, accent: S.moi.reglages.theme.accent }, chaine: S.moi.reglages.chaine.nom, couleur: S.moi.reglages.couleur,
      taches, toi: attend ? { videoId: attend.id, titre: attend.titre } : null, ecran: der ? { videoId: der.id, vignette: der.vignette || null, accroche: der.accroche || der.titre } : null, nuit: estNuit()
    };
  }
  function majVille() { if (S.ville && S.videos) S.ville.maj(etatVille()); }
  function feter(type) {
    if (S.ville && route().vue === 'accueil') S.ville.feter(type);
    else if (type === 'prete' || type === 'publiee' || type === 'badge') confettis();
  }
  // une scène dans la ville : une ligne dans le fil, et la petite alerte pour aller voir
  function scene(e) {
    ajouterFil(e.qui || 'mila', e.texte, null);
    if (!e.focus) return;
    S.evenement = e;
    const el = $('#evenement');
    if (el) { el.hidden = false; el.innerHTML = '<span>' + h(e.texte) + '</span><button class="btn petit second" data-a="regarderScene">Regarder</button>'; }
    clearTimeout(scene.minuteur);
    scene.minuteur = setTimeout(() => { const x = $('#evenement'); if (x) x.hidden = true; S.evenement = null; }, 9000);
  }

  /* ── l'accueil : la ville, et par-dessus le bonjour, le fil de l'équipe, les boutons de la vue ── */
  function etapesDepart() {
    const m = S.moi, r = m.reglages;
    return [
      { fait: !!r.chaine.sujets, titre: 'Décris ta chaîne', texte: 'Tes sujets, ton public, ton ton : toute l\'équipe s\'en sert.', lien: '#reglages/chaine' },
      { fait: m.connexions.claude.branchee && m.connexions.claude.etat === 'ok', titre: 'Branche ta clé Claude', texte: 'C\'est elle qui fait travailler ton équipe, dans le budget que tu choisis. Le pas à pas prend 5 minutes.', lien: '#reglages/connexions' },
      { fait: (S.videos || []).length > 0, titre: 'Lance ta première vidéo', texte: 'Un modèle et une idée en une phrase suffisent.', lien: '#creer' },
      { fait: m.connexions.fal && m.connexions.fal.branchee, titre: 'Images IA', texte: 'Facultatif : des scènes créées pour chaque vidéo, dans le style que tu veux, sur ta clé fal.', lien: '#reglages/connexions', facultatif: true },
      { fait: m.connexions.uploadpost.branchee, titre: 'Publication automatique', texte: 'Facultatif : sinon tu publies depuis ton téléphone en quelques secondes.', lien: '#reglages/connexions', facultatif: true }
    ];
  }
  function salutHtml() {
    const m = S.moi, vids = S.videos || [];
    const etapes = etapesDepart();
    const obligatoires = etapes.filter((x) => !x.facultatif), faites = obligatoires.filter((x) => x.fait).length;
    const aValider = vids.filter((v) => v.status === 'relecture');
    const pretes = vids.filter((v) => v.status === 'prete');
    const enRoute = vids.filter((v) => S.cat.automatiques.indexOf(v.status) >= 0);
    let phrase = 'Ton équipe t\'attend. Une idée, et elle se met au travail.';
    const actions = [];
    if (aValider.length) { phrase = aValider.length > 1 ? aValider.length + ' scripts t\'attendent.' : 'Le script de « ' + sansEtoiles(aValider[0].titre) + ' » t\'attend.'; actions.push('<a class="btn" href="#video/' + aValider[0].id + '">Lire le script</a>'); }
    else if (pretes.length) { phrase = pretes.length > 1 ? pretes.length + ' vidéos sont prêtes à publier.' : '« ' + sansEtoiles(pretes[0].titre) + ' » est prête à publier.'; actions.push('<a class="btn" href="#video/' + pretes[0].id + '">Voir la vidéo</a>'); }
    else if (enRoute.length) { const t = phraseVideo(enRoute[0]); phrase = (t ? t.texte : 'Ton équipe travaille') + (enRoute.length > 1 ? ', et ' + (enRoute.length - 1) + ' autre' + (enRoute.length > 2 ? 's' : '') + ' en route.' : '.'); }
    else if (faites < obligatoires.length) phrase = 'Encore ' + (obligatoires.length - faites) + ' étape' + (obligatoires.length - faites > 1 ? 's' : '') + ' et ton équipe se met au travail.';
    actions.push('<a class="btn' + (actions.length ? ' second' : '') + '" href="#creer">' + ico('creer') + 'Nouvelle vidéo</a>');
    let pied;
    if (faites < obligatoires.length) {
      const suivante = obligatoires.find((x) => !x.fait);
      pied = '<div class="progres"><span>Pour commencer</span><span class="barre-p"><i style="width:' + Math.round(faites / obligatoires.length * 100) + '%"></i></span><a href="' + suivante.lien + '">' + h(suivante.titre) + '</a></div>';
    } else {
      const b = badges(), g = b.filter((x) => x.gagne).length;
      pied = '<div class="progres"><span>Badges</span><span class="barre-p"><i style="width:' + Math.round(g / b.length * 100) + '%"></i></span><a href="#equipe">' + g + ' sur ' + b.length + '</a></div>';
    }
    if (S.salutReplie) return '<section class="verre salut" id="salut" style="padding:10px 12px"><div class="ligne">' + avatarMoi('petit') + '<b class="plein">Salut ' + h(m.prenom) + '</b><button class="btn discret petit icone" data-a="replier" aria-label="Déplier">' + ico('bas') + '</button></div></section>';
    return '<section class="verre salut" id="salut" style="position:relative"><button class="btn discret petit icone replier" data-a="replier" aria-label="Replier"><span style="display:inline-flex;transform:rotate(180deg)">' + ico('bas') + '</span></button><h1>Salut ' + h(m.prenom) + '</h1><p>' + h(phrase) + '</p><div class="actions">' + actions.join('') + '</div>' + pied + '</section>';
  }
  function filHtml() {
    const l = S.fil;
    const quiAvatar = (role) => role === 'toi' ? avatarMoi('petit') : role === 'mila' ? '<span class="agent petit" style="--c:#FF7EA5">M</span>' : avatar(role, 'petit');
    const tete = l[0] ? '<b>L\'équipe</b><span>' + h(l[0].texte) + '</span>' : '<b>L\'équipe</b><span>Rien de neuf pour l\'instant</span>';
    return '<section class="verre fil' + (S.filOuvert ? ' ouvert' : '') + '" id="fil"><button class="fil-tete" data-a="fil" aria-expanded="' + S.filOuvert + '"><span class="point' + ((S.videos || []).some((v) => S.cat.automatiques.indexOf(v.status) >= 0) ? ' vif' : ' ok') + '"></span>' + tete + ico('bas') + '</button>' +
      '<div class="fil-liste">' + (l.length ? l.map((x) => (x.lien ? '<a class="msg' + (x.frais ? ' frais' : '') + '" href="' + x.lien + '">' : '<div class="msg' + (x.frais ? ' frais' : '') + '">') + quiAvatar(x.role) + '<span><b style="color:var(--encre)">' + h(x.texte) + '</b><time>' + h(heure(x.t)) + '</time></span>' + (x.lien ? '</a>' : '</div>')).join('') : '<p class="doux petit" style="padding:8px">Ce que fait ton équipe s\'affichera ici.</p>') + '</div></section>';
  }
  function calqueAccueil() {
    S.fil.forEach((x) => { x.frais = false; });
    return '<div class="calque"><div class="hud-g" id="hud"' + (S.visite != null ? ' hidden' : '') + '>' + salutHtml() + filHtml() + '</div>' +
      '<div class="hud-d verre vues"><button class="vue-btn" data-a="vueZoom" data-k="1.25" aria-label="S\'approcher">' + ico('creer') + '</button><button class="vue-btn" data-a="vueZoom" data-k="0.8" aria-label="S\'éloigner">' + ico('moins') + '</button><button class="vue-btn" data-a="vueTourner" aria-label="Tourner">' + ico('tourner') + '</button><button class="vue-btn" data-a="vueCentre" aria-label="Revenir à la vue de départ">' + ico('recentrer') + '</button></div>' +
      '<div class="evenement verre" id="evenement" hidden></div>' +
      '<aside class="panneau verre ferme" id="fiche" aria-label="Fiche"></aside>' +
      (S.visite != null ? visiteHtml() : '') + '</div>';
  }
  function majCalque() {
    const s = $('#salut'); if (s) s.outerHTML = salutHtml();
    const f = $('#fil'); if (f) f.outerHTML = filHtml();
    if (S.fiche) ouvrirFiche(S.fiche, true);
    const j = $('.jauge'); if (j) j.outerHTML = jaugeHtml();
  }
  // la fiche d'une coéquipière touchée dans la ville
  function ouvrirFiche(role, maj) {
    const el = $('#fiche'); if (!el) return;
    S.fiche = role;
    const taches = etatVille().taches;
    let corps;
    if (role === 'toi') {
      const v = (S.videos || []).find((x) => x.status === 'relecture');
      corps = '<div class="fiche-tete">' + avatarMoi('grand') + '<div><b>' + h(S.moi.prenom) + '</b><small>C\'est toi</small></div></div>' +
        (v ? '<div class="fiche-quoi vif">Le script de « ' + forts(v.titre) + ' » attend ta validation.</div><a class="btn large" href="#video/' + v.id + '">Lire le script</a>' : '<div class="fiche-quoi">Rien ne t\'attend.</div>');
    } else {
      const m = membre(role), t = taches[role];
      const quoi = t ? (S.videos || []).find((v) => v.id === t.videoId) : null;
      const ph = quoi ? phraseVideo(quoi) : null;
      corps = '<div class="fiche-tete">' + avatar(role, 'grand', !!t) + '<div><b>' + h(m.prenom) + '</b><small>' + h(m.metier) + '</small></div></div>' +
        '<div class="fiche-quoi' + (t ? ' vif' : '') + '">' + (ph ? h(ph.texte) + '.' : 'Rien à faire pour l\'instant : elle flâne dans le quartier.') + '</div>' +
        '<p class="doux petit" style="margin-bottom:14px">' + h(m.fait) + (m.consignes ? ' Tes consignes : « ' + h(m.consignes) + ' »' : '') + '</p>' +
        '<div class="actions">' + (quoi ? '<a class="btn" href="#video/' + quoi.id + '">Voir la vidéo</a>' : role === 'idees' ? '<a class="btn" href="#creer">Lui demander des idées</a>' : '<a class="btn" href="#creer">Lancer une vidéo</a>') + '<a class="btn second" href="#equipe">Personnaliser</a></div>';
    }
    el.innerHTML = '<button class="fermer" data-a="fermerFiche" aria-label="Fermer">' + ico('fermer') + '</button><div class="panneau-corps">' + corps + '</div>';
    if (!maj) requestAnimationFrame(() => el.classList.remove('ferme'));
  }
  function fermerFiche() { S.fiche = null; const el = $('#fiche'); if (el) el.classList.add('ferme'); }

  /* ── la visite du premier jour ── */
  const VISITE = [
    () => ({ titre: 'Bienvenue dans ton studio, ' + S.moi.prenom, texte: 'Voici ton équipe : six coéquipières qui font tes vidéos avec toi, de l\'idée à la publication. Quand l\'une travaille, son écran s\'allume ; quand elle n\'a rien à faire, elle se promène dans la rue.', extra: '<div class="equipe-mini">' + S.cat.ordre.map((k) => avatar(k, 'petit')).join('') + '</div>', focus: { x: -8, z: -3, zoom: 1.5 }, fete: 'bienvenue' }),
    () => ({ titre: 'Elles sont à toi', texte: 'Touche quelqu\'un dans le studio pour voir ce qu\'elle fait. Leurs prénoms, leurs couleurs et leurs consignes se changent dans Équipe.', boutons: '<a class="btn second" href="#equipe" data-a="visiteSortie">Personnaliser mon équipe</a>' }),
    () => ({ titre: 'De quoi parle ta chaîne ?', texte: 'Deux lignes suffisent : toute l\'équipe s\'en sert pour les idées et les scripts.', form: true }),
    () => ({ titre: 'Branche ta clé Claude', texte: 'C\'est elle qui fait travailler ton équipe : tu paies Claude directement, quelques centimes par vidéo, dans le budget du jour que tu choisis. Le pas à pas prend 5 minutes.', boutons: S.moi.connexions.claude.branchee ? '<span class="pastille ok">Déjà branchée</span>' : '<a class="btn second" href="#reglages/connexions" data-a="visiteSortie">Voir le pas à pas</a>', passe: S.moi.connexions.claude.branchee }),
    () => ({ titre: 'Et il se passe des choses dans ta rue', texte: 'Une voiture garée, une résidence avec une piscine, des collègues qui s\'ennuient... Touche la voiture ou la piscine pour voir. Ou attends un peu.', boutons: '<button class="btn second" data-a="visiteMontrer">Montre-moi</button>', focus: { x: 9, z: 4, zoom: 1.4 } })
  ];
  function visiteHtml() {
    const i = S.visite, e = VISITE[i]();
    return '<section class="verre visite" id="visite" role="dialog" aria-label="Visite du studio"><div class="etapes-v">' + VISITE.map((_, k) => '<i class="' + (k <= i ? 'on' : '') + '"></i>').join('') + '</div><h2>' + h(e.titre) + '</h2><p>' + h(e.texte) + '</p>' + (e.extra || '') +
      (e.form ? '<form data-form="visiteChaine"><label class="champ"><span>Le nom de ta chaîne</span><input type="text" name="nom" maxlength="60" value="' + h(S.moi.reglages.chaine.nom) + '" placeholder="Les petites questions"></label><label class="champ"><span>Tes sujets</span><input type="text" name="sujets" maxlength="700" value="' + h(S.moi.reglages.chaine.sujets) + '" placeholder="La science du quotidien, expliquée simplement"></label><div class="actions"><button class="btn" type="submit">Enregistrer et continuer</button><button class="btn discret" type="button" data-a="visiteSuivante">Plus tard</button></div></form>'
        : '<div class="actions">' + (e.boutons || '') + '<button class="btn" data-a="visiteSuivante">' + (i === VISITE.length - 1 ? 'C\'est parti' : 'Suivant') + '</button>' + (i < VISITE.length - 1 ? '<button class="btn discret" data-a="visiteFin">Passer</button>' : '') + '</div>') + '</section>';
  }
  function ouvrirVisite(i) {
    if (route().vue !== 'accueil') { location.hash = '#accueil'; }
    S.visite = i;
    const e = VISITE[i]();
    const box = $('#visite');
    if (box) box.outerHTML = visiteHtml(); else { const c = $('.calque'); if (c) c.insertAdjacentHTML('beforeend', visiteHtml()); }
    const hud = $('#hud'); if (hud) hud.hidden = true;
    fermerFiche();
    const go = () => { if (!S.ville) return; if (e.focus) S.ville.regarder(e.focus); if (e.fete) S.ville.feter(e.fete); };
    if (S.ville) go(); else setTimeout(go, 1600);
  }
  async function finirVisite() {
    S.visite = null;
    const box = $('#visite'); if (box) box.remove();
    const hud = $('#hud'); if (hud) hud.hidden = false;
    if (S.ville) S.ville.regarder(null);
    memoire.ecrire('visite-passee-' + S.moi.identifiant, true);
    if (!S.moi.reglages.visite_faite) { try { await agir('reglages', { reglages: { visite_faite: true } }); } catch (e) { /* elle reviendra, ce n'est pas grave */ } }
  }

  /* ── les badges ── */
  function serie() {
    const jours = new Set((S.videos || []).map((v) => new Date(v.created_at).toLocaleDateString('sv-SE')));
    let n = 0;
    const d = new Date();
    if (!jours.has(d.toLocaleDateString('sv-SE'))) d.setDate(d.getDate() - 1);
    while (jours.has(d.toLocaleDateString('sv-SE'))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function badges() {
    const m = S.moi, vids = S.videos || [];
    const renommees = S.cat.ordre.some((k) => m.equipe[k] && S.cat.roles[k] && m.equipe[k].prenom !== S.cat.roles[k].prenom);
    return [
      { id: 'equipe', nom: 'Mon équipe', texte: 'Un prénom à ton goût pour une coéquipière', icone: 'equipe', gagne: renommees },
      { id: 'cle', nom: 'Branchée', texte: 'Ta clé Claude marche', icone: 'cle', gagne: m.connexions.claude.branchee && m.connexions.claude.etat === 'ok' },
      { id: 'premiere', nom: 'Première vidéo', texte: 'Ta toute première idée lancée', icone: 'clap', gagne: vids.length > 0 },
      { id: 'prete', nom: 'Coupez !', texte: 'Une vidéo montée de A à Z', icone: 'videos', gagne: vids.some((v) => (v.pretes || []).length || ['prete', 'publication', 'publiee'].indexOf(v.status) >= 0) },
      { id: 'publiee', nom: 'En ligne', texte: 'Ta première vidéo publiée', icone: 'avion', gagne: vids.some((v) => v.status === 'publiee') },
      { id: 'note9', nom: 'Neuf sur dix', texte: 'Un script noté 9 par ' + membre('critique').prenom, icone: 'etoile', gagne: vids.some((v) => Number(v.note) >= 9) },
      { id: 'polyglotte', nom: 'Polyglotte', texte: 'Une vidéo en trois langues', icone: 'globe', gagne: vids.some((v) => (v.langues || []).length >= 3) },
      { id: 'serie3', nom: 'Trois jours de suite', texte: 'Une vidéo par jour, trois jours d\'affilée', icone: 'flamme', gagne: serie() >= 3 },
      { id: 'dix', nom: 'Dix vidéos', texte: 'Dix idées lancées', icone: 'pile', gagne: vids.length >= 10 },
      { id: 'pilote', nom: 'En pilote', texte: 'Ton équipe tourne toute seule', icone: 'pilote', gagne: !!m.reglages.pilote.actif }
    ];
  }
  // un badge gagné depuis la dernière visite : un petit mot et des confettis (une seule fois)
  function verifierBadges() {
    if (!S.videos || !S.moi) return;
    const cle = 'badges-' + S.moi.identifiant;
    const vus = memoire.lire(cle, null);
    const gagnes = badges().filter((b) => b.gagne).map((b) => b.id);
    if (!vus) { memoire.ecrire(cle, gagnes); return; }
    const nouveaux = gagnes.filter((id) => vus.indexOf(id) < 0);
    if (!nouveaux.length) return;
    memoire.ecrire(cle, gagnes);
    const b = badges().find((x) => x.id === nouveaux[0]);
    toast('Badge gagné : ' + b.nom + '. ' + b.texte + '.', 'ok');
    feter('badge');
  }
  function badgesHtml() {
    const b = badges(), s = serie();
    return '<div class="bloc"><div class="bloc-t"><span>Tes badges</span><small class="doux">' + b.filter((x) => x.gagne).length + ' sur ' + b.length + '</small></div>' +
      (s ? '<div class="serie" style="margin-bottom:14px"><span class="flamme">' + ico('flamme') + '</span><div><b>' + s + ' jour' + (s > 1 ? 's' : '') + '</b><div class="doux petit">de suite avec une vidéo lancée</div></div></div>' : '') +
      '<div class="badges">' + b.map((x) => '<div class="badge' + (x.gagne ? ' gagne' : '') + '">' + ico(x.icone) + '<b>' + h(x.nom) + '</b><small>' + h(x.texte) + '</small></div>').join('') + '</div></div>';
  }

  /* ── la porte ── */
  function porte(contenu) { document.body.classList.remove('sur-ville'); $('#app').innerHTML = '<div class="porte"><div class="porte-c verre"><div class="marque-porte">' + ico('studio') + '</div>' + contenu + '</div></div>'; }
  function vueConnexion() {
    appliquerTheme();
    porte('<h1>Ton studio</h1><p class="sous">Tes vidéos et ton équipe, de l\'idée à la publication.</p>' +
      '<form data-form="connexion"><label class="champ"><span>Identifiant</span><input type="text" name="identifiant" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
      '<label class="champ"><span>Mot de passe</span><input type="password" name="mdp" autocomplete="current-password" required></label>' +
      '<button class="btn large" type="submit">Entrer</button></form><p class="doux petit" style="margin-top:16px">Mot de passe oublié ? Demande un nouveau lien à Louis.</p>');
    const i = $('input[name="identifiant"]'); if (i) i.focus();
  }
  async function vueInvitation(code) {
    appliquerTheme();
    porte('<div class="cadre-vide" style="width:60px"></div>');
    let info;
    try {
      const r = await fetch('/api/studio?' + new URLSearchParams({ op: 'invitation', code }), { credentials: 'same-origin' });
      info = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(info.erreur || 'Ce lien n\'est plus valable.');
    } catch (e) {
      porte('<h1>Lien expiré</h1><p class="sous">' + h(e.message) + '</p><a class="btn second large" href="#">Aller à la connexion</a>');
      return;
    }
    porte('<h1>' + (info.nouveau ? 'Bienvenue ' + h(info.prenom) : 'Nouveau mot de passe') + '</h1><p class="sous">Ton identifiant : <b>' + h(info.identifiant) + '</b>. ' + (info.nouveau ? 'Choisis ton mot de passe pour ouvrir ton studio.' : 'Choisis ton nouveau mot de passe.') + '</p>' +
      '<form data-form="invitation" data-code="' + h(code) + '"><input type="text" name="identifiant" value="' + h(info.identifiant) + '" autocomplete="username" hidden>' +
      '<label class="champ"><span>Mot de passe</span><input type="password" name="mdp" autocomplete="new-password" minlength="10" required><small>10 caractères au moins. Une petite phrase marche très bien.</small></label>' +
      '<label class="champ"><span>Encore une fois</span><input type="password" name="mdp2" autocomplete="new-password" required></label>' +
      '<button class="btn large" type="submit">' + (info.nouveau ? 'Ouvrir mon studio' : 'Enregistrer') + '</button></form>');
  }

  /* ── les cadres des vidéos ── */
  const TON = { ecriture: 'vif', relecture: 'attention', langues: 'vif', realisation: 'vif', fabrication: 'vif', prete: 'ok', publication: 'vif', publiee: 'ok', echec: 'alerte', archivee: '' };
  function cadre(v) {
    const fond = v.vignette ? '<img src="' + h(v.vignette) + '" alt="" loading="lazy"><span class="voile"></span>' : '';
    const e = v.etape || {};
    const ton = e.erreur ? 'alerte' : TON[v.status] || '';
    return '<a class="cadre" href="#video/' + v.id + '">' + fond + '<span class="accroche">' + forts(v.accroche || v.titre || '') + '</span><span class="pied"><span class="pastille ' + ton + '">' + h(e.erreur ? 'À regarder' : v.statut) + '</span><small>' + (v.genre === 'clip' ? 'CLIP' : h(v.langues.map((l) => l.toUpperCase()).join(' '))) + '</small></span></a>';
  }

  /* ── créer : un modèle, une idée, les langues ── */
  // les langues : celles aux voix les plus naturelles d'abord, puis les autres (avec une recherche)
  function choixLangues(nom, coches) {
    const toutes = Object.keys(S.cat.langues);
    const nat = (S.cat.naturelles || toutes).filter((l) => S.cat.langues[l]);
    const autres = toutes.filter((l) => nat.indexOf(l) < 0).sort((a, b) => nomLangue(a).localeCompare(nomLangue(b), 'fr'));
    const puce = (l) => '<label data-nom="' + h(nomLangue(l).toLowerCase()) + '"><input type="checkbox" name="' + nom + '" value="' + l + '"' + (coches.indexOf(l) >= 0 ? ' checked' : '') + '><span>' + h(nomLangue(l)) + '</span></label>';
    return '<div class="langues-c"><div class="groupe"><small>Les voix les plus naturelles</small><div class="choix">' + nat.map(puce).join('') + '</div></div>' +
      (autres.length ? '<div class="groupe"><small>' + autres.length + ' autres langues</small><input type="search" placeholder="Chercher une langue : allemand, arabe, russe..." data-filtre-langues aria-label="Chercher une langue"><div class="choix" style="margin-top:8px">' + autres.map(puce).join('') + '</div></div>' : '') + '</div>';
  }
  function radios(nom, options, valeur) { return '<div class="choix">' + options.map((o) => '<label><input type="radio" name="' + nom + '" value="' + h(o[0]) + '"' + (o[0] === valeur ? ' checked' : '') + '><span>' + h(o[1]) + (o[2] ? ' <small>' + h(o[2]) + '</small>' : '') + '</span></label>').join('') + '</div>'; }

  /* ── le look : vidéos d'illustration, images IA (un style, un mouvement), texte animé ── */
  const IA_VIDE = { looks: {}, mouvements: {}, couts: {}, modeles: {} };
  const coutIa = (format, mouvement) => (((S.cat.ia || IA_VIDE).couts || {})[format === 'long' ? 'long' : 'court'] || {})[mouvement] || 0;
  function mouvementsHtml(format, choisi) {
    const m = (S.cat.ia || IA_VIDE).mouvements;
    return radios('ia.mouvement', Object.keys(m).map((k) => [k, m[k].nom, 'environ ' + usd(coutIa(format, k))]), choisi) +
      '<small>' + h((m[choisi] || {}).court || '') + '. Par vidéo, sur ta clé fal.</small>';
  }
  function lookHtml(r, format) {
    const cat = S.cat.ia || IA_VIDE;
    const ia = r.ia || {};
    const fal = S.moi.connexions.fal || {};
    const st = S.cat.styles || { clips: 'Vidéos d\'illustration', ia: 'Images IA', texte: 'Texte animé' };
    const style = st[r.style] ? r.style : 'clips';
    return '<div class="champ"><span>Le look</span>' + radios('style', [['clips', st.clips, 'offertes'], ['ia', st.ia, 'sur ta clé fal'], ['texte', st.texte]], style) + '</div>' +
      '<div class="panneau-ia" data-panneau-ia' + (style === 'ia' ? '' : ' hidden') + '>' +
      (fal.branchee ? '' : '<div class="message attention" style="margin-bottom:14px"><b>Ce look demande ta clé fal</b>Les images IA se paient sur ton compte fal, à l\'usage. <a href="#reglages/connexions">Le pas à pas prend 5 minutes</a>.</div>') +
      '<div class="champ"><span>Le style des images</span><div class="looks">' + Object.keys(cat.looks).map((k) => {
        const l = cat.looks[k];
        return '<label class="look"><input type="radio" name="ia.style" value="' + h(k) + '"' + (k === ia.style ? ' checked' : '') + '><span><i style="background:linear-gradient(155deg,' + (l.teintes || []).map(h).join(',') + ')"></i><b>' + h(l.nom) + '</b><small>' + h(l.court) + '</small></span></label>';
      }).join('') + '</div></div>' +
      '<div class="champ" data-mouvements><span>Le mouvement</span>' + mouvementsHtml(format, ia.mouvement) + '</div></div>';
  }
  // le formulaire a changé (format, look, mouvement) : le panneau des images IA et les coûts suivent
  function majLook(form) {
    if (!form) return;
    const d = lireForm(form);
    const p = $('[data-panneau-ia]', form);
    if (p) p.hidden = d.style !== 'ia';
    const format = d.format || S.moi.reglages.format;
    const mouvement = (d.ia || {}).mouvement || S.moi.reglages.ia.mouvement;
    // les prix suivent la durée choisie, l'explication suit le mouvement (sans redessiner : le focus reste où il est)
    $$('input[name="ia.mouvement"]', form).forEach((el) => { const sm = $('small', el.nextElementSibling); if (sm) sm.textContent = 'environ ' + usd(coutIa(format, el.value)); });
    const m = $('[data-mouvements] > small', form);
    if (m) m.textContent = (((S.cat.ia || IA_VIDE).mouvements[mouvement] || {}).court || '') + '. Par vidéo, sur ta clé fal.';
    const c = $('[data-cout-creer]', form);
    if (c) c.innerHTML = coutCreerHtml(d.style, format, mouvement, (d.langues || []).length);
  }
  // ce que coûte la vidéo qu'elle s'apprête à lancer : l'écriture sur sa clé Claude (le même calcul que le serveur),
  // les images IA sur sa clé fal
  function voixNaturelle() { const vi = S.moi.reglages.voix_ia || {}; return vi.actif !== false && !!S.moi.connexions.fal.branchee; }
  function coutVoix(format, n) { const c = ((S.cat.voix_ia || {}).couts || {})[format === 'long' ? 'long' : 'court'] || 0; return Math.round(c * Math.max(1, n) * 100) / 100; }
  function coutCreerHtml(style, format, mouvement, nbLangues) {
    const r = S.moi.reglages, q = S.cat.qualites[r.qualite] || {};
    const f = format === 'long' ? 1.4 : 1, n = nbLangues || r.langues.length || 1;
    const ecriture = (q.par_video || 0) * f + (q.par_langue || 0) * f * Math.max(0, n - 1) + (r.tendances ? 0.02 : 0);
    const voix = voixNaturelle();
    const offert = ['le montage'].concat(voix ? [] : ['les voix']).concat(style === 'clips' ? ['les vidéos d\'illustration'] : []);
    const liste = offert.length > 1 ? offert.slice(0, -1).join(', ') + ' et ' + offert[offert.length - 1] : offert[0];
    return 'Environ ' + h(usd(ecriture)) + ' pour l\'écriture sur ta clé Claude, en qualité ' + h((q.nom || '').toLowerCase()) + '.' +
      (style === 'ia' ? ' Les images IA : environ ' + h(usd(coutIa(format, mouvement))) + ' sur ta clé fal.' : '') +
      (voix ? ' La voix naturelle : environ ' + h(usd(coutVoix(format, n))) + ' sur ta clé fal.' : '') +
      ' ' + h(liste.charAt(0).toUpperCase() + liste.slice(1)) + (offert.length > 1 ? ' sont offerts.' : ' est offert.');
  }
  function carteIdee(i) {
    return '<article class="idee"><h3>' + h(i.titre) + '</h3>' + (i.accroche ? '<blockquote>' + forts(i.accroche) + '</blockquote>' : '') + '<p>' + h(i.angle) + '</p>' + (i.pourquoi ? '<p class="pourquoi">' + h(i.pourquoi) + '</p>' : '') +
      '<div class="actions"><button class="btn petit" data-a="ideeChoisir" data-id="' + h(i.id) + '">Faire cette vidéo</button><button class="btn discret petit" data-a="ideeOublier" data-id="' + h(i.id) + '">Oublier</button></div></article>';
  }
  function modelesHtml() {
    const m = S.cat.modeles || {};
    const libre = '<label class="modele"><input type="radio" name="modele" value=""' + (!S.modele ? ' checked' : '') + '><span>' + ico('libre') + '<b>Libre</b><small>Ton idée, ta forme</small></span></label>';
    return '<div class="modeles">' + libre + Object.keys(m).map((k) => '<label class="modele"><input type="radio" name="modele" value="' + k + '"' + (S.modele === k ? ' checked' : '') + '><span>' + ico(k) + '<b>' + h(m[k].nom) + '</b><small>' + h(m[k].court) + '</small></span></label>').join('') + '</div>';
  }
  // deux façons de faire : une vidéo racontée (une idée, un script dit par une voix) ou un clip (son prompt de
  // réalisateur, filmé plan par plan)
  function genresHtml(genre) {
    const carte = (k, icone, titre, texte) => '<label class="modele"><input type="radio" name="genre" value="' + k + '"' + (genre === k ? ' checked' : '') + '><span>' + ico(icone) + '<b>' + titre + '</b><small>' + texte + '</small></span></label>';
    return '<div class="genres" role="radiogroup" aria-label="Le genre de vidéo">' + carte('video', 'histoire', 'Vidéo racontée', 'Une idée : ton équipe écrit, une voix raconte') + carte('clip', 'clap', 'Clip à partir de ton prompt', 'Tes plans, filmés par IA et montés sur le rythme') + '</div>';
  }
  function vueCreer() {
    const r = S.moi.reglages;
    const mod = (S.cat.modeles || {})[S.modele];
    const genre = S.genreCreer === 'clip' && S.cat.clip ? 'clip' : 'video';
    if (genre === 'clip') return '<div class="s-tete"><div><h1>Nouveau clip</h1><p>Colle ton prompt de réalisateur : ' + h(membre('realisation').prenom) + ' le découpe en plans, fait une image par plan, tu valides, elle tourne et monte sur le rythme.</p></div></div>' + genresHtml(genre) + vueCreerClip();
    let x = '<div class="s-tete"><div><h1>Nouvelle vidéo</h1><p>Choisis une forme, donne une idée : ' + h(membre('plume').prenom) + ' écrit, ' + h(membre('critique').prenom) + ' relit, tu valides.</p></div></div>' + (S.cat.clip ? genresHtml(genre) : '');
    if (!S.moi.connexions.claude.branchee) x += '<div class="message attention" style="margin-bottom:16px"><b>Ta clé Claude n\'est pas encore branchée</b>Ton équipe ne peut pas écrire sans elle.<div class="actions"><a class="btn petit" href="#reglages/connexions">Brancher ma clé</a></div></div>';
    x += '<form class="bloc" data-form="creer">' +
      '<div class="champ"><span>La forme</span>' + modelesHtml() + '</div>' +
      '<label class="champ"><span>Ton idée</span><textarea name="sujet" rows="3" maxlength="600" placeholder="' + h(mod ? mod.exemple : 'Pourquoi on a toujours froid aux pieds la nuit') + '"></textarea><small class="aide" id="aideIdee">' + (mod ? 'Par exemple : « ' + h(mod.exemple) + ' ». <a href="#" data-a="prendreExemple">Prendre cet exemple</a>' : 'Une phrase suffit.') + '</small></label>' +
      '<div class="champ"><span>Langues</span>' + choixLangues('langues[]', r.langues) + '<small>La version en ' + h(nomLangue(r.langue_source).toLowerCase()) + ' s\'écrit d\'abord ; ' + h(membre('traduction').prenom) + ' adapte les autres. Six langues au plus par vidéo.</small></div>' +
      '<div class="champ"><span>Durée</span>' + radios('format', [['court', '35 à 50 s'], ['long', 'Plus d\'une minute', 'payée par TikTok']], r.format) + '</div>' +
      lookHtml(r, r.format) +
      '<button class="btn large" type="submit">Lancer l\'équipe</button><p class="doux petit" style="margin-top:10px" data-cout-creer>' + coutCreerHtml(r.style, r.format, r.ia.mouvement, r.langues.length) + '</p></form>';
    x += '<div class="ou">ou</div><section class="bloc"><div class="ligne" style="margin-bottom:14px">' + avatar('idees', 'grand', S.mayaCherche) + '<div class="plein"><h2>' + h(membre('idees').prenom) + ' te propose 5 idées</h2><p class="doux petit">' + (r.tendances ? 'Elle regarde d\'abord ce dont on parle cette semaine dans ta niche. ' : '') + 'Quelques centimes sur ta clé.</p></div></div>' +
      '<form data-form="idees"><label class="champ"><span>Un thème ?</span><input type="text" name="theme" maxlength="200" placeholder="Facultatif : la rentrée, les plantes, les entretiens d\'embauche"></label><button class="btn second large" type="submit"' + (S.mayaCherche ? ' disabled' : '') + '>' + (S.mayaCherche ? h(membre('idees').prenom) + ' cherche…' : 'Proposer des idées') + '</button></form>';
    const idees = S.moi.idees || [];
    if (idees.length) x += '<div class="idees" style="margin-top:14px">' + idees.map(carteIdee).join('') + '</div>';
    return x + '</section>';
  }

  /* ── un clip : son prompt de réalisateur ── */
  const CLIP_VIDE = { qualites: {}, montages: {}, formats: {}, sources: {}, durees: [], prix: {}, limites: { prompt: 8000, son: 31457280 } };
  const catClip = () => S.cat.clip || CLIP_VIDE;
  const EFFETS_CLIP = { aucun: 'Aucun', zoom: 'Coup de zoom', secousse: 'Secousse', flash: 'Flash' };
  const EFFETS_COURTS = { zoom: 'Zoom', secousse: 'Secousse', flash: 'Flash' };
  // les secondes de chaque plan, lues dans son prompt (« (3s) », « (2 sec) ») : le même calcul que la tour
  function dureesLues(prompt) {
    const out = [];
    String(prompt || '').replace(/\(\s*(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|secondes?|seconds?)\s*\)/gi, (m, n) => { out.push(Number(n.replace(',', '.'))); return m; });
    return out.filter((n) => n > 0 && n <= 20).slice(0, 16);
  }
  function dureePlanClip(q, d) {
    const m = catClip().qualites[q] || {};
    if (m.entier) return Math.min(m.maximum || 30, Math.max(m.minimum || 4, Math.ceil(d + 0.3)));
    return Math.round(Math.min(m.maximum || 15, Math.max(m.minimum || 1, d + 0.5)) * 10) / 10;
  }
  const prixPlanClip = (q, d) => { const m = catClip().qualites[q] || {}; return (dureePlanClip(q, d) + (m.marge || 0)) * (m.seconde || 0); };
  // ce que coûte un clip sur sa clé fal (images, plans filmés, bruitages, musique), avant le découpage
  function estimerClip(o) {
    const cat = catClip(), q = cat.qualites[o.qualite] ? o.qualite : 'hd', m = cat.qualites[q] || {};
    const lues = dureesLues(o.prompt), auto = !o.duree || o.duree === 'auto';
    let durees;
    if (auto && lues.length) durees = lues;
    else { const total = auto ? 30 : Number(o.duree) || 30, n = Math.max(1, Math.round(total / 2.7)); durees = Array.from({ length: n }, () => Math.round(total / n * 10) / 10); }
    const secondes = durees.reduce((a, b) => a + b, 0);
    const images = (durees.length + 2) * (m.image || 0);
    const video = durees.reduce((a, d) => a + prixPlanClip(q, d), 0);
    const sons = !m.son && o.bruitages !== false ? durees.reduce((a, d) => a + Math.min(30, dureePlanClip(q, d)), 0) * (cat.prix.bruitages || 0) : 0;
    const musique = o.musique === 'ia' ? Math.ceil((secondes + 2.5) / 60) * (cat.prix.musique_minute || 0) : 0;
    return { plans: durees.length, secondes: Math.round(secondes * 10) / 10, lues: auto && lues.length > 0, images, tournage: video + sons + musique, total: images + video + sons + musique };
  }
  function luHtml(prompt) {
    const l = dureesLues(prompt);
    if (!String(prompt || '').trim()) return 'En français ou en anglais. Donne les personnages, le style, puis chaque plan avec sa durée entre parenthèses : « Shot 1 (3s) : … ».';
    if (!l.length) return 'Aucune durée lue : ' + h(membre('realisation').prenom) + ' découpe elle-même, des plans de 2 à 3 secondes.';
    const t = Math.round(l.reduce((a, b) => a + b, 0) * 10) / 10;
    return l.length + ' plan' + (l.length > 1 ? 's' : '') + ' lu' + (l.length > 1 ? 's' : '') + ' dans ton prompt, ' + String(t).replace('.', ',') + ' secondes' + (t > 60 ? ' (60 au plus : les plans seront raccourcis)' : '') + '.';
  }
  function coutClipHtml(o) {
    const e = estimerClip(o), m = catClip().qualites[o.qualite] || {};
    return 'Environ ' + h(usd(e.total)) + ' sur ta clé fal pour ' + e.plans + ' plans et ' + String(e.secondes).replace('.', ',') + ' s en qualité ' + h(m.nom === 'HD' ? 'HD' : (m.nom || '').toLowerCase()) +
      (o.valider !== false ? ' : ' + h(usd(e.images)) + ' pour les images, puis le tournage (' + h(usd(e.tournage)) + ') seulement quand tu le lances.' : ', tout de suite (sans validation des images).') +
      ' Le découpage : quelques centimes sur ta clé Claude. Le montage est offert.';
  }
  function cartesMontage(nom, choisi) {
    const m = catClip().montages;
    return '<div class="montages">' + Object.keys(m).map((k) => '<label class="modele montage"><input type="radio" name="' + nom + '" value="' + k + '"' + (k === choisi ? ' checked' : '') + '><span><i class="apercu-montage ' + k + '" aria-hidden="true"><i></i></i><b>' + h(m[k].nom) + '</b><small>' + h(m[k].court) + '</small></span></label>').join('') + '</div>';
  }
  // la musique : rien (un son TikTok ajouté en publiant), son fichier à elle, ou une musique créée pour le clip
  function musiqueClipHtml(m, prefixe) {
    m = m || {};
    const src = m.source || 'aucune', s = catClip().sources;
    return '<div class="champ"><span>La musique</span>' + radios('musique.source', Object.keys(s).map((k) => [k, s[k]]), src) +
      '<div class="sous-musique" data-musique="aucune"' + (src === 'aucune' ? '' : ' hidden') + '><small>Pour un son connu : publie le clip sans musique et choisis le son dans TikTok en publiant. Il y est licencié, et un son tendance aide la portée.</small></div>' +
      '<div class="sous-musique" data-musique="fichier"' + (src === 'fichier' ? '' : ' hidden') + '>' + (m.nom && prefixe ? '<small>Actuel : ' + h(m.nom) + '. Choisis un autre fichier pour le changer.</small>' : '') +
        '<input type="file" name="son" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg" aria-label="Ton fichier audio"><div class="duo"><label class="mini"><span>Commencer le morceau à (secondes)</span><input type="number" name="musique.debut" min="0" max="600" step="0.5" value="' + h(m.debut || 0) + '"></label></div>' +
        '<small>Un son à toi, ou que tu as le droit d\'utiliser (une instru achetée avec sa licence). ' + Math.round((catClip().limites.son || 31457280) / 1048576) + ' Mo au plus.</small></div>' +
      '<div class="sous-musique" data-musique="ia"' + (src === 'ia' ? '' : ' hidden') + '><textarea name="musique.idee" rows="2" maxlength="300" placeholder="Trap sombre et luxueuse, 140 BPM, grosses basses">' + h(m.idee || '') + '</textarea><small>Une musique instrumentale créée pour ce clip, à sa durée, libre de droits : ' + h(usd(catClip().prix.musique_minute || 0.6)) + ' la minute entamée.</small></div>' +
      '<small>Un lien YouTube ou Spotify ne peut pas servir : la musique appartient à son auteur, et la vidéo serait coupée ou démonétisée.</small></div>';
  }
  function vueCreerClip() {
    const cat = catClip();
    const b = S.brouillonClip || {};
    const lou = membre('realisation').prenom;
    let x = '';
    if (!S.moi.connexions.claude.branchee) x += '<div class="message attention" style="margin-bottom:12px"><b>Ta clé Claude n\'est pas encore branchée</b>' + h(lou) + ' en a besoin pour découper ton prompt.<div class="actions"><a class="btn petit" href="#reglages/connexions">Brancher ma clé</a></div></div>';
    if (!S.moi.connexions.fal.branchee) x += '<div class="message attention" style="margin-bottom:12px"><b>Un clip demande ta clé fal</b>Les images et les plans filmés se paient sur ton compte fal, à l\'usage. <a href="#reglages/connexions">Le pas à pas prend 5 minutes</a>.</div>';
    const q = cat.qualites;
    const qualites = Object.keys(q).map((k) => '<label class="modele qualite"><input type="radio" name="qualite" value="' + k + '"' + (k === (b.qualite || 'hd') ? ' checked' : '') + '><span><b>' + h(q[k].nom) + '</b><em>' + h(usd(q[k].seconde)) + ' la seconde</em><small>' + h(q[k].court) + '. ' + h(q[k].modele) + (q[k].son ? ', sons du film compris' : '') + (q[k].minimum >= 4 ? ', ' + q[k].minimum + ' s payées au moins par plan' : '') + '.</small></span></label>').join('');
    return x + '<form class="bloc" data-form="clip">' +
      '<label class="champ"><span>Ton prompt</span><textarea name="prompt" class="prompt-clip" rows="12" maxlength="' + cat.limites.prompt + '" placeholder="Fast-cut cinematic montage in Monaco…&#10;&#10;CHARACTERS (identical in every shot): …&#10;&#10;Shot 1 (3s): …&#10;Shot 2 (2s): …">' + h(b.prompt || '') + '</textarea><small class="aide" data-lu>' + luHtml(b.prompt) + '</small></label>' +
      '<div class="champ"><span>Format</span>' + radios('format', Object.keys(cat.formats).map((k) => [k, cat.formats[k].nom, cat.formats[k].court]), b.format || '9:16') + '</div>' +
      '<div class="champ"><span>Durée</span>' + radios('duree', [['auto', 'Selon mon prompt'], ['15', '15 s'], ['30', '30 s'], ['45', '45 s'], ['60', '60 s']], b.duree || 'auto') + '</div>' +
      '<div class="champ"><span>La qualité des plans</span><div class="qualites-clip">' + qualites + '</div></div>' +
      '<div class="champ"><span>Le montage</span>' + cartesMontage('montage', b.montage || 'zooms') + '</div>' +
      '<div class="inters">' + inter('bruitages', b.bruitages !== false, 'Les bruitages', 'Le moteur, le bouchon, le briquet : le son de chaque plan') + inter('valider', b.valider !== false, 'Je vois les images avant le tournage', 'Une image par plan, quelques centimes chacune : tu valides avant de payer les plans filmés') + '</div>' +
      musiqueClipHtml(b.musique || {}) +
      '<button class="btn large" type="submit">Lancer ' + h(lou) + '</button><p class="doux petit" style="margin-top:10px" data-cout-clip>' + coutClipHtml(Object.assign({ qualite: 'hd', valider: true }, b, { musique: (b.musique || {}).source })) + '</p></form>';
  }
  // le formulaire a changé : ce qui est lu dans le prompt, la musique choisie, le prix ; le brouillon est gardé (un long
  // prompt ne se perd pas en changeant de page)
  function majClip(form) {
    if (!form) return;
    const d = lireForm(form);
    const lu = $('[data-lu]', form); if (lu) lu.innerHTML = luHtml(d.prompt);
    const src = (d.musique || {}).source || 'aucune';
    $$('[data-musique]', form).forEach((el) => { el.hidden = el.dataset.musique !== src; });
    const c = $('[data-cout-clip]', form);
    if (c) c.innerHTML = coutClipHtml(Object.assign({}, d, { musique: src }));
    if (form.dataset.form === 'clip') { S.brouillonClip = { prompt: d.prompt, format: d.format, duree: d.duree, qualite: d.qualite, montage: d.montage, bruitages: d.bruitages, valider: d.valider, musique: { source: src, idee: (d.musique || {}).idee, debut: (d.musique || {}).debut } }; memoire.ecrire('brouillonClip', S.brouillonClip); }
  }
  // envoyer son fichier audio droit dans le stockage (un lien signé), la barre de progression sur le bouton
  async function envoyerSon(form, btn) {
    const input = $('input[name="son"]', form);
    const fi = input && input.files && input.files[0];
    if (!fi) return null;
    const max = catClip().limites.son || 31457280;
    if (fi.size > max) throw new Error(fi.name + ' : trop lourd (' + Math.round(max / 1048576) + ' Mo au plus).');
    const r = await agir('clip_son_envoi', { nom: fi.name, type: typeFichier(fi), taille: fi.size });
    const texte = btn ? btn.textContent : '';
    await televerser(r.url, fi, r.type, (x) => { if (btn) btn.textContent = 'Envoi du son : ' + Math.round(x * 100) + ' %'; });
    if (btn) btn.textContent = texte;
    return { chemin: r.chemin, nom: fi.name };
  }

  /* ── les vidéos ── */
  const FILTRES = [['tout', 'Toutes'], ['route', 'En route'], ['valider', 'À valider'], ['pretes', 'Prêtes'], ['publiees', 'Publiées'], ['archivees', 'Archivées']];
  function filtrer(v, f) {
    f = f || S.filtre;
    if (f === 'route') return S.cat.automatiques.indexOf(v.status) >= 0 || v.status === 'echec';
    if (f === 'valider') return v.status === 'relecture';
    if (f === 'pretes') return v.status === 'prete';
    if (f === 'publiees') return v.status === 'publiee';
    if (f === 'archivees') return v.status === 'archivee';
    return v.status !== 'archivee';
  }
  function vueVideos() {
    const vids = S.videos || [];
    let x = '<div class="s-tete"><div><h1>Tes vidéos</h1>' + (vids.length ? '<p>' + vids.filter((v) => v.status === 'publiee').length + ' publiées, ' + vids.filter((v) => S.cat.automatiques.indexOf(v.status) >= 0).length + ' en route.</p>' : '') + '</div><a class="btn" href="#creer">' + ico('creer') + 'Nouvelle vidéo</a></div>' +
      '<div class="onglets">' + FILTRES.map((f) => { const n = S.videos ? vids.filter((v) => filtrer(v, f[0])).length : 0; return '<button data-a="filtre" data-f="' + f[0] + '" class="' + (S.filtre === f[0] ? 'on' : '') + '">' + f[1] + (n && f[0] !== 'tout' ? ' <b>' + n + '</b>' : '') + '</button>'; }).join('') + '</div>';
    if (S.videos === null) return x + '<div class="cadres"><div class="cadre-vide"></div><div class="cadre-vide"></div><div class="cadre-vide"></div></div>';
    const l = vids.filter((v) => filtrer(v));
    if (!l.length) return x + '<div class="vide"><h3>' + (vids.length ? 'Rien ici pour l\'instant' : 'Pas encore de vidéo') + '</h3><p>' + (vids.length ? 'Les autres onglets en ont peut-être.' : 'Donne une première idée à ton équipe.') + '</p><a class="btn" href="#creer">Nouvelle vidéo</a></div>';
    return x + '<div class="cadres">' + l.map(cadre).join('') + '</div>';
  }

  /* ── une vidéo ── */
  const estClip = (v) => !!(v && v.plan && v.plan.genre === 'clip');
  // les étapes d'un clip : son prompt, le découpage, les images, sa validation, le tournage, le montage, la publication
  function etapesClip(v) {
    const st = v.status, e = v.etape || {};
    const cl = v.plan.clip || {};
    const ou = st === 'echec' ? (e.statut_avant || 'ecriture') : st;
    const quoi = st === 'echec' ? e.quoi : e.quoi;
    const rang = { ecriture: 0, realisation: quoi === 'tournage' ? 3 : 1, relecture: 2, fabrication: 4, prete: 5, publication: 6, publiee: 7, archivee: 7 }[ou] || 0;
    const bloque = !!(e.bloque || e.erreur || st === 'echec');
    const lou = membre('realisation').prenom;
    const liste = [
      { role: 'toi', titre: 'Toi', sous: 'le prompt', fait: true },
      { role: 'realisation', titre: lou, sous: 'le découpage', fait: rang > 0, actif: rang === 0 },
      { role: 'realisation', titre: lou, sous: 'les images', fait: rang > 1, actif: rang === 1 }
    ];
    if (cl.valider) liste.push({ role: 'toi', titre: 'Toi', sous: st === 'relecture' ? 'à valider' : 'validation', fait: rang > 2, actif: rang === 2 });
    liste.push({ role: 'realisation', titre: lou, sous: 'le tournage', fait: rang > 3, actif: rang === 3 });
    liste.push({ role: 'realisation', titre: lou, sous: 'le montage', fait: rang > 4, actif: rang === 4 });
    liste.push({ role: 'diffusion', titre: membre('diffusion').prenom, sous: 'la publication', fait: st === 'publiee' || st === 'archivee', actif: st === 'publication' });
    return liste.map((x) => Object.assign(x, { bloque: x.actif && bloque }));
  }
  function etapes(v) {
    if (estClip(v)) return etapesClip(v);
    const st = v.status, e = v.etape || {};
    const plusieurs = (v.langues || []).length > 1;
    const ordre = ['ecriture', 'relecture', 'langues', 'realisation', 'fabrication', 'prete', 'publication', 'publiee'];
    const rang = ordre.indexOf(st === 'echec' ? (e.statut_avant || 'ecriture') : st === 'archivee' ? 'publiee' : st);
    const bloque = !!(e.bloque || e.erreur || st === 'echec');
    const liste = [
      { role: 'idees', titre: v.idee && v.idee.titre ? membre('idees').prenom : 'Idée', sous: v.idee && v.idee.titre ? 'l\'idée' : 'la tienne', fait: true },
      { role: 'plume', titre: membre('plume').prenom, sous: 'le script', fait: rang > 0 || (st === 'ecriture' && e.quoi === 'critique'), actif: st === 'ecriture' && e.quoi !== 'critique' },
      { role: 'critique', titre: membre('critique').prenom, sous: v.critique && v.critique.note ? 'note ' + String(v.critique.note).replace('.', ',') + '/10' : 'la relecture', fait: rang > 0, actif: st === 'ecriture' && e.quoi === 'critique' },
      { role: 'toi', titre: 'Toi', sous: st === 'relecture' ? 'à valider' : 'validation', fait: rang > 1, actif: st === 'relecture' }
    ];
    if (plusieurs) liste.push({ role: 'traduction', titre: membre('traduction').prenom, sous: 'les langues', fait: rang > 2, actif: st === 'langues' });
    liste.push({ role: 'realisation', titre: membre('realisation').prenom, sous: st === 'fabrication' ? 'le montage' : ((v.plan || {}).style === 'ia' ? 'images IA et montage' : 'images et montage'), fait: rang > 4, actif: st === 'realisation' || st === 'fabrication' });
    liste.push({ role: 'diffusion', titre: membre('diffusion').prenom, sous: 'la publication', fait: st === 'publiee' || st === 'archivee', actif: st === 'publication' });
    return liste.map((x) => Object.assign(x, { bloque: x.actif && bloque }));
  }
  function bandeHtml(v) {
    return '<div class="bande">' + etapes(v).map((x) => {
      const av = x.role === 'toi' ? '<span class="agent' + (x.actif ? ' travaille' : '') + '" style="--c:var(--accent)">' + initiale(S.moi.prenom) + '</span>' : avatar(x.role, '', x.actif && !x.bloque);
      return '<div class="etape ' + (x.fait ? 'faite' : x.bloque ? 'bloquee' : x.actif ? 'active' : '') + '">' + av + '<b>' + h(x.titre) + '</b><small>' + h(x.sous) + '</small></div>';
    }).join('') + '</div>';
  }
  function activiteHtml(v) {
    const e = v.etape || {}, st = v.status;
    const r = v.rendus || {};
    const enIa = (v.plan || {}).style === 'ia';
    const clip = estClip(v);
    // le budget d'un clip atteint : elle accepte ce qu'il reste à payer
    if (clip && e.bloque === 'budget_clip') return '<div class="activite alerte">' + avatar('realisation', 'petit') + '<div class="plein"><b>En attente</b><br>' + h(e.erreur || '') + '<div class="actions" style="margin-top:8px"><button class="btn petit" data-a="clipBudget">Accepter ' + h(usd((v.plan.clip || {}).a_payer)) + ' de plus</button></div></div></div>';
    // continuer sans fal : sans images IA (look images IA), ou avec la voix gratuite (une vidéo bloquée par sa voix
    // naturelle) ; jamais pour un clip, fait par fal de bout en bout
    const parFal = !clip && !(v.plan || {}).sans_fal && (enIa || e.bloque === 'fal' || e.bloque === 'credit_fal' || !!(v.plan || {}).voix_ia);
    const libelleSans = enIa ? 'Continuer sans images IA' : 'Continuer avec la voix gratuite';
    if (e.bloque || (e.erreur && st !== 'echec')) {
      const sans = parFal && st === 'realisation' ? '<button class="btn second petit" data-a="sansIa">' + libelleSans + '</button>' : '';
      const act = {
        cle: '<a class="btn petit" href="#reglages/connexions">Ma clé Claude</a>',
        credit: '<a class="btn petit" href="https://platform.claude.com/settings/billing" target="_blank" rel="noopener noreferrer">Ajouter du crédit</a><button class="btn second petit" data-a="reprendre">Réessayer</button>',
        budget: '<a class="btn petit" href="#reglages/budget">Monter mon budget</a>' + sans,
        fal: '<a class="btn petit" href="#reglages/connexions">Ma clé fal</a>' + sans,
        credit_fal: '<a class="btn petit" href="https://fal.ai/dashboard/billing" target="_blank" rel="noopener noreferrer">Ajouter du crédit fal</a><button class="btn second petit" data-a="reprendre">Réessayer</button>' + sans,
        usine: ''
      }[e.bloque];
      return '<div class="activite alerte">' + avatar(roleActif(v), 'petit') + '<div class="plein"><b>' + h(e.bloque ? 'En attente' : 'Petit souci') + '</b><br>' + h(e.erreur || '') + (e.bloque ? '' : '<br><span class="doux petit">L\'équipe réessaie toute seule.</span>') + (act != null ? '<div class="actions" style="margin-top:8px">' + (act || '') + (e.bloque ? '' : '<button class="btn second petit" data-a="reprendre">Réessayer maintenant</button>') + '</div>' : '') + '</div></div>';
    }
    if (st === 'echec') return '<div class="activite alerte">' + avatar(roleActif(v), 'petit') + '<div class="plein"><b>Bloquée</b><br>' + h(e.erreur || 'L\'équipe n\'a pas pu finir.') + '<div class="actions" style="margin-top:8px"><button class="btn petit" data-a="reprendre">Reprendre</button>' + (parFal && e.statut_avant === 'realisation' ? '<button class="btn second petit" data-a="sansIa">' + libelleSans + '</button>' : '') + '</div></div></div>';
    // les voix naturelles, puis les images IA en route : combien sont faites, combien d'animations
    const pr = e.progres || null;
    const lou = membre('realisation').prenom;
    const realisation = e.quoi === 'voix' && pr && pr.voix ? lou + ' enregistre les voix naturelles : ' + pr.voix[0] + ' phrases sur ' + pr.voix[1] + '. Quelques secondes chacune.'
      : !enIa ? lou + ' choisit les images de chaque phrase.'
      : !pr || !pr.images ? lou + ' prépare les images IA de chaque phrase.'
        : pr.images[0] < pr.images[1] ? lou + ' fait créer les images IA : ' + pr.images[0] + ' sur ' + pr.images[1] + '. Quelques secondes chacune.'
          : pr.videos[1] && pr.videos[0] < pr.videos[1] ? lou + ' anime ' + (pr.videos[1] > 1 ? 'les scènes en vidéo : ' + pr.videos[0] + ' sur ' + pr.videos[1] : 'la première scène en vidéo') + '. Compte une à deux minutes.'
            : lou + ' a toutes les images IA et lance le montage.';
    if (clip) return activiteClip(v);
    const textes = {
      ecriture: e.quoi === 'critique' ? membre('critique').prenom + ' relit le script et le note.' : e.quoi === 'reecriture' ? membre('plume').prenom + ' réécrit le script avec ' + (e.consigne ? 'ta consigne.' : 'les remarques de ' + membre('critique').prenom + '.') : membre('plume').prenom + ' écrit le script.',
      relecture: 'À toi : relis le script, retouche ce que tu veux, puis valide.',
      langues: membre('traduction').prenom + ' écrit la version ' + h(nomLangue(e.langue || (v.langues || []).find((l) => l !== v.langue_source && !(v.traductions || {})[l]) || '').toLowerCase()) + '.',
      realisation: h(realisation),
      fabrication: 'Montage en cours : ' + (v.langues || []).filter((l) => r[l] && r[l].etat === 'fini').length + ' sur ' + (v.langues || []).length + '. Compte 3 à 6 minutes.' + (e.note ? ' ' + e.note : ''),
      prete: 'Ta vidéo est prête.' + (e.note ? ' ' + e.note : ''),
      publication: membre('diffusion').prenom + ' publie ta vidéo.',
      publiee: 'Publiée.' + (e.note ? ' ' + e.note : ''),
      archivee: 'Archivée.'
    };
    const travaille = S.cat.automatiques.indexOf(st) >= 0;
    const role = st === 'relecture' ? null : roleActif(v);
    return '<div class="activite">' + (role ? avatar(role, 'petit', travaille) : avatarMoi('petit')) + '<div class="plein">' + textes[st] + '</div></div>';
  }
  // ce que fait l'équipe sur un clip, en ce moment
  function activiteClip(v) {
    const e = v.etape || {}, st = v.status, pr = e.progres || null;
    const cl = v.plan.clip || {};
    const lou = membre('realisation').prenom;
    let t;
    if (st === 'ecriture') t = lou + (e.consigne ? ' redécoupe ton prompt avec ta consigne.' : ' découpe ton prompt en plans : les personnages qui reviennent, le style, chaque plan.');
    else if (st === 'realisation' && e.quoi !== 'tournage') t = pr && pr.images ? lou + ' fait les images : ' + (pr.refs[0] + pr.images[0]) + ' sur ' + (pr.refs[1] + pr.images[1]) + '. Les personnages d\'abord, puis la première image de chaque plan.' : lou + ' prépare les images.';
    else if (st === 'relecture') t = 'À toi : regarde chaque image, refais celles qui ne vont pas, puis lance le tournage.';
    else if (st === 'realisation') t = (pr && pr.videos ? lou + ' tourne les plans : ' + pr.videos[0] + ' sur ' + pr.videos[1] + (pr.sons && pr.sons[1] ? ', bruitages ' + pr.sons[0] + ' sur ' + pr.sons[1] : '') + (pr.musique ? ', musique ' + (pr.musique === 'fini' ? 'prête' : 'en cours') : '') + '.' : lou + ' lance le tournage.') + ' Ils tournent en même temps : compte 2 à 5 minutes.' + (e.note ? ' ' + e.note + '.' : '');
    else if (st === 'fabrication') t = 'Montage en cours : coupes sur le rythme, ' + (cl.montage === 'net' ? 'le son.' : 'zooms et le son.') + ' Compte 2 à 4 minutes.' + (e.note ? ' ' + e.note : '');
    else t = { prete: 'Ton clip est prêt.', publication: membre('diffusion').prenom + ' publie ton clip.', publiee: 'Publié.', archivee: 'Archivé.' }[st] || '';
    if (e.note && ['prete', 'publiee'].indexOf(st) >= 0) t += ' ' + e.note;
    const travaille = S.cat.automatiques.indexOf(st) >= 0;
    return '<div class="activite">' + (st === 'relecture' ? avatarMoi('petit') : avatar(st === 'prete' || st === 'publication' || st === 'publiee' ? 'diffusion' : 'realisation', 'petit', travaille)) + '<div class="plein">' + h(t) + '</div></div>';
  }
  function roleActif(v) {
    if (estClip(v)) return v.status === 'prete' || v.status === 'publication' || v.status === 'publiee' ? 'diffusion' : 'realisation';
    const e = v.etape || {};
    const st = v.status === 'echec' ? (e.statut_avant || 'ecriture') : v.status;
    return { ecriture: e.quoi === 'critique' ? 'critique' : 'plume', relecture: 'critique', langues: 'traduction', realisation: 'realisation', fabrication: 'realisation', prete: 'diffusion', publication: 'diffusion', publiee: 'diffusion', archivee: 'diffusion' }[st] || 'plume';
  }
  function etatHtml(v) { return bandeHtml(v) + activiteHtml(v); }
  // la bande défile jusqu'à l'étape en cours (un clip en a jusqu'à sept, plus que la largeur d'un téléphone)
  function centrerBande() {
    const b = $('#v-etat .bande');
    if (!b || b.scrollWidth <= b.clientWidth + 1) return;
    const faites = b.querySelectorAll('.etape.faite');
    const x = b.querySelector('.etape.active, .etape.bloquee') || faites[faites.length - 1];
    if (!x) return;
    const rb = b.getBoundingClientRect(), rx = x.getBoundingClientRect();
    b.scrollLeft = Math.max(0, b.scrollLeft + rx.left - rb.left - (b.clientWidth - rx.width) / 2);
  }

  function scriptLecture(s, titre) {
    if (!s || !s.beats) return '';
    const image = (v) => (!v ? '' : v.prompt ? '<span>Scène : ' + h(v.description || v.prompt) + '</span>' : v.requete ? '<span>Image : ' + h(v.requete) + '</span>' : '');
    return '<div class="bloc"><h3 style="margin-bottom:6px">' + h(titre || 'Le script') + '</h3>' + (s.accroche ? '<p class="doux petit">À l\'écran au début : « ' + h(sansEtoiles(s.accroche)) + ' »</p>' : '') + '<ol class="beats">' + s.beats.map((b) => '<li><div class="dit">' + forts(b.voix) + '</div><div class="sous">' + (b.ecran ? '<span>Écran : ' + h(b.ecran) + '</span>' : '') + image(b.visuel) + '</div></li>').join('') + '</ol></div>';
  }
  function noteHtml(c) {
    if (!c || !c.note) return '';
    return '<div class="bloc"><div class="note-jade">' + avatar('critique', 'grand') + '<div class="plein"><div class="chiffre">' + h(String(c.note).replace('.', ',')) + '<small>/10</small></div><p style="margin-top:6px">' + h(c.verdict || '') + '</p>' +
      (c.points_forts && c.points_forts.length ? '<ul class="liste-points">' + c.points_forts.map((p) => '<li>' + h(p) + '</li>').join('') + '</ul>' : '') +
      (c.corrections && c.corrections.length ? '<p class="doux petit" style="margin-top:10px">Ce qu\'elle changerait encore :</p><ul class="liste-points">' + c.corrections.slice(0, 4).map((p) => '<li>' + h(p) + '</li>').join('') + '</ul>' : '') + '</div></div></div>';
  }
  function editionScript(v) {
    const s = v.script || {};
    const look = (v.plan && v.plan.style) || 'clips';
    const clips = look === 'clips', ia = look === 'ia';
    const nomLook = ia ? (((S.cat.ia || IA_VIDE).looks[((v.plan || {}).ia || {}).style] || {}).nom || '') : '';
    const champImage = (b, i) => (clips ? '<label class="mini"><span>Image (en anglais)</span><input type="text" name="requete" data-i="' + i + '" maxlength="60" value="' + h((b.visuel || {}).requete || '') + '"></label>' : '');
    const champScene = (b, i) => (ia ? '<label class="mini scene"><span>La scène pour l\'IA (en anglais)</span><textarea name="prompt" data-i="' + i + '" rows="2" maxlength="600">' + h((b.visuel || {}).prompt || '') + '</textarea></label>' : '');
    return '<form class="bloc vif" data-form="script"><h3 style="margin-bottom:14px">Le script de ' + h(membre('plume').prenom) + '</h3>' +
      '<label class="champ"><span>Titre</span><input type="text" name="titre" maxlength="100" value="' + h(s.titre || '') + '"></label>' +
      '<label class="champ"><span>Accroche à l\'écran</span><input type="text" name="accroche" maxlength="70" value="' + h(s.accroche || '') + '"><small>Les deux premières secondes, 7 mots au plus.</small></label>' +
      (ia ? '<label class="champ"><span>L\'univers des images (en anglais)</span><textarea name="direction" rows="2" maxlength="400">' + h(s.direction || '') + '</textarea><small>Ajouté à chaque image : le sujet qui revient, le décor, la lumière. C\'est ce qui fait que toutes les scènes se ressemblent.</small></label>' : '') +
      '<ol class="beats">' + (s.beats || []).map((b, i) => '<li><textarea name="voix" data-i="' + i + '" rows="2" aria-label="Phrase ' + (i + 1) + '">' + h(b.voix) + '</textarea><div class="duo"><label class="mini"><span>À l\'écran</span><input type="text" name="ecran" data-i="' + i + '" maxlength="48" value="' + h(b.ecran || '') + '"></label>' + champImage(b, i) + '</div>' + champScene(b, i) + '</li>').join('') + '</ol>' +
      '<p class="doux petit" style="margin:4px 0 16px">Les mots entre *étoiles* s\'allument à l\'écran dans ta couleur.' + (clips ? ' L\'image se cherche en anglais, en 2 à 4 mots concrets : « ocean waves aerial ».' : '') + (ia ? ' Chaque scène se décrit en anglais : qui, quoi, où, la lumière ; jamais de texte dans l\'image. Le style « ' + h(nomLook) + ' » s\'ajoute tout seul.' : '') + '</p>' +
      '<label class="champ"><span>Texte de la publication</span><textarea name="description" rows="3" maxlength="400">' + h(s.description || '') + '</textarea></label>' +
      '<label class="champ"><span>Hashtags</span><input type="text" name="hashtags" value="' + h((s.hashtags || []).join(' ')) + '"></label>' +
      '<div class="actions"><button class="btn" type="submit">Valider et lancer la suite</button><button class="btn second" type="button" data-a="scriptEnregistrer">Enregistrer mes retouches</button></div></form>' +
      '<div class="bloc"><h3>Pas convaincue ?</h3><p class="doux petit" style="margin:4px 0 12px">Dis à ' + h(membre('plume').prenom) + ' ce qui ne va pas : elle réécrit tout le script.</p><textarea id="consigne" rows="2" maxlength="600" placeholder="Plus drôle, et commence par le chiffre"></textarea><div class="actions" style="margin-top:10px"><button class="btn second" data-a="reecrire">Faire réécrire</button></div></div>';
  }
  function pretes(v) { return (v.langues || []).filter((l) => (v.rendus || {})[l] && v.rendus[l].etat === 'fini'); }
  function textePub(v, l) {
    const s = l === v.langue_source ? (v.script || {}) : ((v.traductions || {})[l] || {});
    const t = ((v.publication || {})[l] || {}).texte || {};
    return { titre: t.titre || s.titre || v.titre, titre_youtube: t.titre_youtube || s.titre_youtube || s.titre || v.titre, description: t.description != null ? t.description : (s.description || ''), hashtags: t.hashtags || s.hashtags || [] };
  }
  const legende = (t) => [t.description, (t.hashtags || []).map((x) => '#' + x).join(' ')].filter(Boolean).join('\n\n');
  function pubHtml(v, l) {
    const r = S.moi.reglages;
    const conf = (r.publication || {})[l] || {};
    const up = S.moi.connexions.uploadpost;
    const p = ((v.publication || {})[l] || {}).plateformes || {};
    const lignes = Object.keys(S.cat.plateformes).map((k) => {
      const x = p[k] || {};
      let etat = '<small>Pas encore publiée</small>', bouton = '<button class="btn second petit" data-a="marquer" data-l="' + l + '" data-p="' + k + '">Je l\'ai publiée</button>';
      if (x.etat === 'publiee' || x.etat === 'manuelle') { etat = '<small>' + (x.etat === 'manuelle' ? 'Publiée à la main ' : 'Publiée ') + h(depuis(x.le)) + '</small>'; bouton = x.lien ? '<a class="btn second petit" href="' + h(x.lien) + '" target="_blank" rel="noopener noreferrer">' + ico('ouvrir') + 'Voir</a>' : ''; }
      else if (x.etat === 'a_envoyer' || x.etat === 'en_cours') { etat = '<small>Envoi en cours…</small>'; bouton = ''; }
      else if (x.etat === 'echec') etat = '<small style="color:var(--alerte)">' + h(x.erreur || 'Refusée') + '</small>';
      const auto = conf.profil && (conf.plateformes || []).indexOf(k) >= 0;
      return '<div class="plateforme"><div class="plein"><b>' + h(S.cat.plateformes[k]) + (auto ? ' <span class="pastille vif">auto</span>' : '') + '</b>' + etat + '</div>' + bouton + '</div>';
    }).join('');
    const auto = up.branchee && conf.profil && (conf.plateformes || []).length;
    const enCours = Object.keys(p).some((k) => p[k].etat === 'a_envoyer' || p[k].etat === 'en_cours');
    let tete = '';
    if (auto && !enCours) tete = '<div class="actions" style="margin-bottom:12px"><button class="btn" data-a="publier">' + ico('avion') + 'Publier sur ' + h((conf.plateformes || []).map((k) => S.cat.plateformes[k]).join(', ')) + '</button></div>';
    else if (!up.branchee) tete = '<p class="doux petit" style="margin-bottom:12px">Pour publier depuis ton téléphone : Partager (ou Télécharger), puis l\'appli. Le texte se copie avec « Copier le texte ». <a href="#reglages/connexions">Publication automatique</a></p>';
    else if (!conf.profil) tete = '<p class="doux petit" style="margin-bottom:12px">Choisis où publier cette langue dans <a href="#reglages/publication">Réglages, Publication</a>.</p>';
    return '<h3 style="margin:22px 0 10px">Publication</h3>' + tete + '<div class="plateformes">' + lignes + '</div>';
  }
  function lecteurHtml(v) {
    const ls = pretes(v);
    if (!ls.length) return '<div class="message">Les fichiers de cette vidéo ne sont plus disponibles (ils sont gardés ' + S.cat.garde_jours + ' jours).' + (v.script && v.script.beats ? '<div class="actions"><button class="btn second petit" data-a="refaire">Refaire le montage</button></div>' : '') + '</div>';
    const l = ls.indexOf(S.onglet[v.id]) >= 0 ? S.onglet[v.id] : ls[0];
    const f = (v.liens || {})[l] || {};
    const t = textePub(v, l);
    const pret = S.partage[v.id + l];
    const peutPartager = !!(navigator.share && navigator.canShare);
    return (ls.length > 1 ? '<div class="onglets">' + ls.map((x) => '<button data-a="onglet" data-l="' + x + '" class="' + (x === l ? 'on' : '') + '">' + h(nomLangue(x)) + '</button>').join('') + '</div>' : '') +
      '<div class="lecteur"><video controls playsinline preload="metadata"' + (f['vignette.jpg'] ? ' poster="' + h(f['vignette.jpg']) + '"' : '') + ' src="' + h(f['video.mp4'] || '') + '"></video><div>' +
      '<div class="actions">' + (f.telecharger ? '<a class="btn" href="' + h(f.telecharger) + '" download>' + ico('telecharger') + 'Télécharger</a>' : '') +
      (peutPartager ? '<button class="btn second" data-a="partager" data-l="' + l + '">' + ico('partager') + (pret ? 'Partager maintenant' : 'Partager') + '</button>' : '') +
      '<button class="btn second" data-a="copierTexte" data-l="' + l + '">' + ico('copier') + 'Copier le texte</button>' +
      '<button class="btn second" data-a="envoyerALouis" data-l="' + l + '">' + ico('message') + 'Envoyer à Louis</button></div>' +
      '<p class="doux petit" style="margin-top:10px">' + (((v.rendus || {})[l] || {}).duree ? Math.round(v.rendus[l].duree) + ' secondes. ' : '') + 'Disponible jusqu\'au ' + h(dateCourte(v.garde_jusqu)) + '.</p>' +
      '<form data-form="texte" data-l="' + l + '" style="margin-top:18px"><label class="champ"><span>Titre (TikTok, Instagram)</span><input type="text" name="titre" maxlength="100" value="' + h(t.titre) + '"></label>' +
      '<label class="champ"><span>Titre YouTube</span><input type="text" name="titre_youtube" maxlength="95" value="' + h(t.titre_youtube) + '"></label>' +
      '<label class="champ"><span>Texte de la publication</span><textarea name="description" rows="3" maxlength="2000">' + h(t.description) + '</textarea></label>' +
      '<label class="champ"><span>Hashtags</span><input type="text" name="hashtags" value="' + h((t.hashtags || []).join(' ')) + '"></label><button class="btn second petit" type="submit">Enregistrer le texte</button></form>' +
      '<div id="v-pub">' + pubHtml(v, l) + '</div></div></div>' +
      creditsHtml(v);
  }
  // d'où viennent les images : créées par IA sur son compte fal, et les vidéos de Pexels (avec leurs auteurs)
  function creditsHtml(v) {
    const p = v.plan || {}, t = [];
    if (p.style === 'ia') { const m = (S.cat.ia || IA_VIDE).modeles; t.push('créées par IA sur ton compte fal (' + [m.image, p.generation && p.generation.videos && p.generation.videos.some((x) => x && x.etat === 'fini') ? m.video : null].filter(Boolean).join(', ') + (p.generation && p.generation.cout ? ', ' + usd(p.generation.cout) : '') + ')'); }
    if (p.credits && p.credits.length) t.push('Pexels (' + Array.from(new Set(p.credits.map((c) => c.auteur))).slice(0, 8).join(', ') + ')');
    return t.length ? '<p class="doux petit" style="margin-top:14px">Images : ' + h(t.join(' ; ')) + '.</p>' : '';
  }
  // les images IA qui arrivent, une case par phrase (celles qui seront animées en vidéo sont marquées)
  function plancheHtml(v) {
    const g = (v.plan || {}).generation;
    if (!g || !(g.images || []).length) return '';
    const cases = g.images.map((im, i) => {
      const vd = (g.videos || [])[i];
      const etat = !im ? 'attente' : im.etat;
      const fond = im && im.url ? '<img src="' + h(im.url) + '" alt="" loading="lazy">' : '';
      const marque = vd ? '<span class="anime' + (vd.etat === 'fini' ? ' ok' : '') + '">' + (vd.etat === 'fini' ? 'vidéo prête' : vd.etat === 'echec' ? 'image fixe' : 'en vidéo') + '</span>' : '';
      return '<div class="case ' + h(etat) + '" title="' + h('Phrase ' + (i + 1) + (im && im.erreur ? ' : ' + im.erreur : '')) + '">' + fond + '<small>' + (i + 1) + '</small>' + marque + '</div>';
    }).join('');
    return '<div class="bloc"><h3 style="margin-bottom:10px">Les images IA</h3><div class="planche">' + cases + '</div></div>';
  }
  /* ── un clip : les personnages, les plans, la validation, le remontage ── */
  const ratioClip = (cl) => (cl.format === '16:9' ? '16 / 9' : cl.format === '1:1' ? '1 / 1' : '9 / 16');
  const prixImageClip = (cl) => ((catClip().qualites[cl.qualite] || {}).image) || 0.07;
  function refsClipHtml(v) {
    const cl = v.plan.clip, sb = cl.storyboard, g = cl.gen || {};
    if (!sb || !(sb.elements || []).length) return '';
    const edit = v.status === 'relecture';
    const TYPES = { personnage: 'Personnage', objet: 'Objet', lieu: 'Lieu' };
    const cartes = sb.elements.map((e) => {
      const j = (g.refs || []).find((x) => x && x.id === e.id) || {};
      const ratio = e.type === 'personnage' ? '3 / 4' : e.type === 'lieu' ? '16 / 9' : '4 / 3';
      return '<article class="ref-clip ' + h(j.etat || 'attente') + '"><div class="vue" style="aspect-ratio:' + ratio + '">' + (j.url ? '<img src="' + h(j.url) + '" alt="' + h(e.nom) + '" loading="lazy">' : '') + '</div><div class="txt"><b>' + h(e.nom) + '</b><small>' + h(TYPES[e.type] || '') + (j.etat === 'echec' ? ', image ratée' : '') + '</small>' +
        (edit ? '<button class="btn discret petit" data-a="clipRef" data-e="' + h(e.id) + '">Refaire</button>' : '') + '</div></article>';
    }).join('');
    return '<div class="bloc"><div class="bloc-t"><h3>Les personnages et objets</h3><small class="doux">la même apparence dans chaque plan</small></div><div class="refs-clip">' + cartes + '</div></div>';
  }
  function storyboardHtml(v) {
    const cl = v.plan.clip, sb = cl.storyboard, g = cl.gen || {};
    const edit = v.status === 'relecture';
    const total = Math.round(sb.plans.reduce((a, p) => a + p.duree, 0) * 10) / 10;
    const cases = sb.plans.map((p, i) => {
      const im = (g.images || [])[i] || {}, vd = (g.videos || [])[i] || {};
      const etat = vd.etat === 'fini' ? 'filmé' : vd.etat === 'demande' ? 'en tournage' : vd.etat === 'echec' ? 'image fixe à la place' : im.etat === 'echec' ? 'image ratée' : im.etat === 'fini' ? '' : 'image en cours';
      const jouer = vd.url ? '<button class="jouer" data-a="voirPlan" data-i="' + i + '" aria-label="Voir le plan ' + (i + 1) + ' filmé">' + ico('ecouter') + '</button>' : '';
      return '<article class="plan-clip ' + h(im.etat || 'attente') + (vd.etat === 'demande' ? ' tourne' : '') + (S.planOuvert === i && edit ? ' ouvert' : '') + '"><div class="vue">' + (im.url ? '<img src="' + h(im.url) + '" alt="" loading="lazy">' : '') + jouer +
        '<span class="n">' + (i + 1) + '</span><span class="d">' + String(p.duree).replace('.', ',') + ' s</span>' + (p.effet && p.effet !== 'aucun' ? '<span class="fx" title="' + h(EFFETS_CLIP[p.effet]) + ' sur le moment fort">' + h(EFFETS_COURTS[p.effet] || '') + '</span>' : '') + '</div>' +
        '<div class="txt"><p>' + h(p.resume) + '</p>' + (etat ? '<small>' + h(etat) + '</small>' : '') + (im.erreur && im.etat === 'echec' ? '<small class="err">' + h(im.erreur) + '</small>' : '') + (edit ? '<button class="btn discret petit" data-a="ouvrirPlan" data-i="' + i + '">Retoucher</button>' : '') + '</div></article>';
    }).join('');
    let x = '<div class="bloc"><div class="bloc-t"><h3>Les plans</h3><small class="doux">' + sb.plans.length + ' plans, ' + String(total).replace('.', ',') + ' s</small></div><div class="storyboard' + (cl.format === '16:9' ? ' paysage' : '') + '" style="--ratio:' + ratioClip(cl) + '">' + cases + '</div></div>';
    if (edit && S.planOuvert != null && sb.plans[S.planOuvert]) x += editeurPlanHtml(v, S.planOuvert);
    return x;
  }
  function editeurPlanHtml(v, i) {
    const cl = v.plan.clip, p = cl.storyboard.plans[i];
    return '<form class="bloc vif editeur-clip" data-form="clipPlan" data-i="' + i + '" id="editeur-plan"><div class="bloc-t"><h3>Plan ' + (i + 1) + '</h3><button type="button" class="btn discret petit" data-a="fermerPlan">Fermer</button></div>' +
      '<label class="champ"><span>La première image (en anglais)</span><textarea name="image" rows="3" maxlength="900">' + h(p.image) + '</textarea></label>' +
      '<label class="champ"><span>Ce qui se passe et la caméra (en anglais)</span><textarea name="mouvement" rows="2" maxlength="500">' + h(p.mouvement) + '</textarea></label>' +
      '<div class="duo"><label class="mini"><span>Durée (secondes)</span><input type="number" name="duree" min="1" max="10" step="0.5" value="' + h(p.duree) + '"></label><label class="mini"><span>Effet sur le moment fort</span><select name="effet">' + Object.keys(EFFETS_CLIP).map((k) => '<option value="' + k + '"' + (k === p.effet ? ' selected' : '') + '>' + EFFETS_CLIP[k] + '</option>').join('') + '</select></label></div>' +
      '<label class="champ"><span>Les bruitages (en anglais)</span><input type="text" name="son" maxlength="240" value="' + h(p.son || '') + '" placeholder="engine roar, champagne cork pop"></label>' +
      '<label class="champ"><span>Une consigne pour refaire l\'image</span><input type="text" name="consigne" maxlength="400" placeholder="Facultatif : plus sombre, la voiture plus près, de dos"></label>' +
      '<div class="actions"><button class="btn" type="submit">Refaire l\'image (' + h(usd(prixImageClip(cl))) + ')</button><button class="btn second" type="button" data-a="clipPlanEnregistrer">Enregistrer</button><button class="btn danger petit" type="button" data-a="clipPlanRetirer">Retirer ce plan</button></div>' +
      '<p class="doux petit" style="margin-top:10px">Les textes en anglais partent tels quels aux modèles. Une première image changée est refaite (même prix) ; la durée, l\'effet et les bruitages servent au tournage et ne coûtent rien maintenant.</p></form>';
  }
  const enListe = (l) => (l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : String(l[0]));
  function validationClipHtml(v) {
    const cl = v.plan.clip, sb = cl.storyboard, g = cl.gen || {}, q = catClip().qualites[cl.qualite] || {};
    // un plan sans image (ratée deux fois) n'est pas filmé : il sort du clip si elle ne la refait pas
    const sans = sb.plans.map((_, i) => i).filter((i) => ((g.images || [])[i] || {}).etat === 'echec');
    const n = sb.plans.length - sans.length;
    const morceaux = [n + (n > 1 ? ' plans filmés' : ' plan filmé') + ' par ' + (q.modele || 'fal')].concat(!q.son && cl.bruitages ? ['leurs bruitages'] : []).concat(cl.musique.source === 'ia' ? ['la musique créée'] : []);
    const avert = sans.length ? '<p class="petit alerte-texte" style="margin-top:8px">' + h((sans.length > 1 ? 'Les plans ' + enListe(sans.map((i) => i + 1)) + ' n\'ont pas d\'image' : 'Le plan ' + (sans[0] + 1) + ' n\'a pas d\'image') + ' : refais-la avec « Retoucher », sinon ' + (sans.length > 1 ? 'ils sortent' : 'il sort') + ' du clip.') + '</p>' : '';
    return '<div class="bloc vif tourner"><div class="ligne"><div class="plein"><h3>Le tournage</h3><p class="doux petit">' + h(enListe(morceaux)) + ', sur ta clé fal.</p></div><b class="prix-clip">' + h(usd(cl.a_payer)) + '</b></div>' + avert +
      '<div class="actions" style="margin-top:12px"><button class="btn large" data-a="tourner">Tourner le clip pour ' + h(usd(cl.a_payer)) + '</button></div>' +
      '<p class="doux petit" style="margin-top:8px">Déjà dépensé pour ce clip : ' + h(usd(g.cout)) + '. Un plan raté est refait une fois sans te redemander.</p></div>';
  }
  function remontageHtml(v) {
    const cl = v.plan.clip;
    return '<form class="bloc" data-form="remonter"><h3 style="margin-bottom:4px">Refaire le montage</h3><p class="doux petit" style="margin-bottom:14px">Les plans filmés sont repris : change le style ou la musique sans rien retourner.</p>' +
      '<div class="champ"><span>Le montage</span>' + cartesMontage('montage', cl.montage) + '</div>' +
      '<div class="inters">' + inter('bruitages', cl.bruitages !== false, 'Les bruitages', 'Le son de chaque plan, sous la musique') + '</div>' +
      musiqueClipHtml(cl.musique, true) + '<button class="btn second" type="submit">Refaire le montage</button></form>';
  }
  function corpsClip(v) {
    const st = v.status, cl = v.plan.clip || {}, sb = cl.storyboard;
    let x = '';
    if (['prete', 'publication', 'publiee'].indexOf(st) >= 0) x += '<div class="bloc">' + lecteurHtml(v) + '</div>' + (st !== 'publication' ? remontageHtml(v) : '');
    if (st === 'relecture') x += validationClipHtml(v);
    if (sb) x += refsClipHtml(v) + storyboardHtml(v);
    x += '<details class="bloc"' + (sb ? '' : ' open') + '><summary>Ton prompt</summary><pre class="prompt-lu">' + h(cl.prompt || v.sujet) + '</pre></details>';
    if (st === 'relecture') x += '<div class="bloc"><h3>Pas convaincue par le découpage ?</h3><p class="doux petit" style="margin:4px 0 12px">Dis à ' + h(membre('realisation').prenom) + ' ce qui ne va pas : elle redécoupe tout. Les images dont le plan ne change pas sont gardées.</p><textarea id="consigne" rows="2" maxlength="600" placeholder="Ajoute un plan sur le yacht, et la voiture en rouge"></textarea><div class="actions" style="margin-top:10px"><button class="btn second" data-a="reecrire">Faire redécouper</button></div></div>';
    return x + basVideo(v);
  }
  // un plan filmé, en grand
  function voirVideo(url, titre) {
    const voile = document.createElement('div'); voile.className = 'voile';
    const f = document.createElement('div'); f.className = 'fenetre fenetre-video'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
    f.innerHTML = '<h2>' + h(titre) + '</h2><video controls autoplay playsinline loop src="' + h(url) + '"></video><div class="actions fin"><button class="btn discret" data-r="0">Fermer</button></div>';
    document.body.append(voile, f);
    requestAnimationFrame(() => { voile.classList.add('visible'); f.classList.add('visible'); });
    const fin = () => { voile.classList.remove('visible'); f.classList.remove('visible'); setTimeout(() => { voile.remove(); f.remove(); }, 220); document.removeEventListener('keydown', cl); };
    const cl = (e) => { if (e.key === 'Escape') fin(); };
    document.addEventListener('keydown', cl);
    voile.addEventListener('click', fin);
    f.addEventListener('click', (e) => { if (e.target.closest('[data-r]')) fin(); });
  }
  function corpsVideo(v) {
    if (estClip(v)) return corpsClip(v);
    const st = v.status;
    let x = '';
    if (st === 'relecture') return noteHtml(v.critique) + editionScript(v) + basVideo(v);
    if (['prete', 'publication', 'publiee'].indexOf(st) >= 0) return '<div class="bloc">' + lecteurHtml(v) + '</div>' + basVideo(v);
    if (st === 'ecriture' && !(v.script && v.script.beats)) {
      const mod = (S.cat.modeles || {})[(v.plan || {}).modele];
      x += '<div class="bloc"><p class="doux petit">L\'idée' + (mod ? ', en « ' + h(mod.nom) + ' »' : '') + '</p><p style="margin-top:4px;font-size:16px">' + h(v.sujet) + '</p>' + (v.idee && v.idee.angle ? '<p class="doux petit" style="margin-top:8px">' + h(v.idee.angle) + '</p>' : '') + '</div>';
    }
    if (v.critique && v.critique.note && st === 'ecriture') x += noteHtml(v.critique);
    if (st === 'realisation' || st === 'fabrication' || st === 'echec') x += plancheHtml(v);
    x += scriptLecture(v.script);
    const trad = Object.keys(v.traductions || {});
    if (trad.length) x += trad.map((l) => scriptLecture(v.traductions[l], 'Version ' + nomLangue(l).toLowerCase())).join('');
    const r = v.rendus || {};
    if (st === 'fabrication' || Object.keys(r).length) {
      x += '<div class="bloc"><h3 style="margin-bottom:10px">Le montage</h3><div class="plateformes">' + (v.langues || []).map((l) => {
        const e = r[l] || {};
        const t = e.etat === 'fini' ? 'Prête' : e.etat === 'demande' ? 'En cours depuis ' + h(depuis(e.demande_le)).replace('il y a ', '') : e.etat === 'echec' ? h(e.erreur || 'Raté') + (e.essais < 2 ? ' (nouvel essai bientôt)' : '') : 'En attente';
        return '<div class="plateforme"><div class="plein"><b>' + h(nomLangue(l)) + '</b><small' + (e.etat === 'echec' ? ' style="color:var(--alerte)"' : '') + '>' + t + '</small></div>' + (e.etat === 'fini' ? '<span class="pastille ok nu">' + ico('ok') + '</span>' : '') + '</div>';
      }).join('') + '</div></div>';
    }
    return x + basVideo(v);
  }
  function basVideo(v) {
    const b = [];
    if (['prete', 'publiee', 'echec'].indexOf(v.status) >= 0 && v.script && v.script.beats) b.push('<button class="btn second petit" data-a="refaire">Refaire le montage</button>');
    if (['relecture', 'prete', 'publiee', 'echec', 'fabrication'].indexOf(v.status) >= 0) b.push('<button class="btn discret petit" data-a="archiver">Archiver</button>');
    b.push('<button class="btn danger petit" data-a="supprimer">Supprimer</button>');
    return '<div class="actions" style="margin-top:22px">' + b.join('') + '</div>';
  }
  function signature(v) {
    const g = (v.plan || {}).generation;
    const ia = g ? (g.images || []).concat(g.videos || []).map((j) => (j ? j.etat.charAt(0) : '-')).join('') : '';
    // un clip : où en est chaque image et chaque plan, le découpage, le prix
    const cl = (v.plan || {}).clip;
    const clip = cl ? [['refs', 'images', 'videos', 'sons'].map((k) => ((cl.gen || {})[k] || []).map((j) => (j ? j.etat.charAt(0) + String(j.url || '').slice(-10) : '-')).join('')).join('/'), cl.storyboard ? cl.storyboard.plans.map((p) => p.duree + p.effet + p.image.length + (p.son || '').length).join(',') : '', cl.a_payer, cl.montage, (cl.musique || {}).source].join('|') : '';
    return [v.status, (v.script && v.script.beats || []).length, (v.script || {}).titre, Object.keys(v.traductions || {}).join(), JSON.stringify(Object.keys(v.rendus || {}).map((l) => [l, v.rendus[l].etat, v.rendus[l].essais])), (v.critique || {}).note, (v.etape || {}).quoi, ia, clip].join('|');
  }
  function vueVideo(id) {
    const v = S.video && String(S.video.id) === String(id) ? S.video : null;
    if (!v) return '<a class="retour" href="#videos">' + ico('retour') + 'Tes vidéos</a><div class="cadre-vide" style="max-width:220px"></div>';
    S.sigCorps = signature(v);
    return '<a class="retour" href="#videos">' + ico('retour') + 'Tes vidéos</a><div class="video-tete"><div class="titre-video">' + forts(v.titre || v.sujet) + '</div><div class="meta"><span class="pastille ' + ((v.etape || {}).erreur ? 'alerte' : TON[v.status] || '') + '">' + h(v.statut) + '</span><span>' + h(v.langues.map(nomLangue).join(', ')) + '</span><span>' + h(usd(v.cout_usd)) + '</span><span>' + h(depuis(v.created_at)) + '</span>' + (v.auto ? '<span>pilote automatique</span>' : '') + '</div></div>' +
      '<div class="bloc" id="v-etat">' + etatHtml(v) + '</div><div id="v-corps" style="margin-top:12px">' + corpsVideo(v) + '</div>';
  }
  async function chargerVideo(id) {
    try { const d = await lire('video', { id }); S.video = d.video; }
    catch (e) { toast(e.message, 'err'); return; }
    if (route().vue === 'video' && route().arg === String(id)) { const c = $('#contenu'); if (c) c.innerHTML = vueVideo(id); centrerBande(); suivre(id); }
  }
  // une nouvelle version de la vidéo : l'état se met à jour, le reste seulement si quelque chose a changé
  function majVideo(v) {
    if (!v) return;
    const avant = S.video && S.video.id === v.id ? S.video.status : null;
    S.video = v;
    if (avant && avant !== v.status) {
      if (v.status === 'prete') { feter('prete'); toast('Ta vidéo est prête.', 'ok'); }
      if (v.status === 'publiee') feter('publiee');
      if (S.statuts) S.statuts[v.id] = v.status;
    }
    if (route().vue !== 'video' || route().arg !== String(v.id)) return;
    const e = $('#v-etat'), c = $('#v-corps');
    if (!e || !c) { $('#contenu').innerHTML = vueVideo(v.id); centrerBande(); return; }
    e.innerHTML = etatHtml(v);
    centrerBande();
    const sig = signature(v);
    if (sig !== S.sigCorps) { S.sigCorps = sig; c.innerHTML = corpsVideo(v); }
    else { const p = $('#v-pub'); if (p) { const l = pretes(v).indexOf(S.onglet[v.id]) >= 0 ? S.onglet[v.id] : pretes(v)[0]; if (l) p.innerHTML = pubHtml(v, l); } }
  }
  // la page regarde la vidéo : elle la fait avancer, une étape à la fois
  async function suivre(id) {
    const moi = ++S.boucle;
    let tours = 0;
    while (moi === S.boucle) {
      const v = S.video;
      if (!v || String(v.id) !== String(id) || S.cat.automatiques.indexOf(v.status) < 0) return;
      if (document.hidden) { await dormir(4000); continue; }
      const e = v.etape || {};
      let attente = 700;
      try {
        if (e.bloque || (e.attendre_jusqu && new Date(e.attendre_jusqu).getTime() > Date.now())) {
          await dormir(15000); if (moi !== S.boucle) return;
          majVideo((await lire('video', { id })).video); continue;
        }
        if (v.status === 'fabrication' || v.status === 'publication') {
          await dormir(10000); if (moi !== S.boucle) return;
          tours++;
          majVideo((tours % 3 === 0 ? await agir('avancer', { id }) : await lire('video', { id })).video);
          continue;
        }
        const d = await agir('avancer', { id });
        if (moi !== S.boucle) return;
        majVideo(d.video);
        if (d.occupe) attente = 4000;
        else if (d.erreur) attente = 3000;
      } catch (err) { attente = 8000; }
      await dormir(attente);
    }
  }

  /* ── les messages avec Louis ── */
  // une conversation : le direct (la page regarde toutes les 3 secondes), les fichiers envoyés droit dans le stockage
  const TYPES_EXT = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf' };
  const typeFichier = (f) => f.type || TYPES_EXT[String(f.name || '').split('.').pop().toLowerCase()] || '';
  const tailleLisible = (o) => (o >= 1048576 ? (o / 1048576).toFixed(o >= 10485760 ? 0 : 1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(o / 1024)) + ' Ko');
  function vueMessages() {
    S.conv = S.conv || { messages: [], dernier: 0, vu: 0, pieces: [], charge: false };
    return '<section class="conv"><header class="conv-tete"><span class="agent" style="--c:#2B59E8">L</span><div><b>Louis</b><small>Écris-lui ici, envoie-lui tes vidéos : il te répond depuis la tour.</small></div></header>' +
      '<div class="conv-fil" id="conv-fil" aria-live="polite">' + filMessagesHtml() + '</div>' +
      '<form class="conv-saisie" data-form="message" autocomplete="off"><div class="conv-pieces" id="conv-pieces">' + piecesChoisiesHtml() + '</div>' +
      '<div class="conv-ligne"><label class="conv-joindre" title="Joindre une vidéo, une photo, un son"><input type="file" name="fichiers" accept="video/*,image/*,audio/*,application/pdf" multiple aria-label="Joindre des fichiers">' + ico('trombone') + '</label>' +
      '<textarea name="texte" rows="1" maxlength="4000" placeholder="Écris à Louis" aria-label="Ton message"></textarea>' +
      '<button class="conv-envoyer" type="submit" aria-label="Envoyer">' + ico('envoyer') + '</button></div></form></section>';
  }
  function jourDe(iso) {
    const d = new Date(iso), a = new Date(), hier = new Date(Date.now() - 86400000);
    if (d.toDateString() === a.toDateString()) return 'Aujourd\'hui';
    if (d.toDateString() === hier.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  const heureDe = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const avecLiens = (t) => t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  function pieceHtml(p) {
    if (p.expire || !p.url) return '<div class="piece expiree">' + h(p.nom || p.titre || 'Fichier') + ' : ' + (p.genre === 'studio' ? 'la vidéo n\'est plus disponible' : 'effacé après 60 jours') + '</div>';
    if (p.genre === 'studio') return '<div class="piece studio"><video controls playsinline preload="none"' + (p.vignette ? ' poster="' + h(p.vignette) + '"' : '') + ' src="' + h(p.url) + '"></video><small>Vidéo du studio : ' + h(sansEtoiles(p.titre || '')) + ' (' + h(nomLangue(p.langue)) + ')</small></div>';
    if (p.genre === 'video') return '<div class="piece"><video controls playsinline preload="metadata" src="' + h(p.url) + '"></video><a class="piece-nom" href="' + h(p.url) + '" target="_blank" rel="noopener noreferrer">' + h(p.nom) + (p.taille ? ', ' + tailleLisible(p.taille) : '') + '</a></div>';
    if (p.genre === 'image') return '<a class="piece" href="' + h(p.url) + '" target="_blank" rel="noopener noreferrer"><img src="' + h(p.url) + '" alt="' + h(p.nom) + '" loading="lazy"></a>';
    if (p.genre === 'son') return '<div class="piece"><audio controls preload="none" src="' + h(p.url) + '"></audio></div>';
    return '<a class="piece doc" href="' + h(p.url) + '" target="_blank" rel="noopener noreferrer">' + ico('telecharger') + h(p.nom) + '</a>';
  }
  function filMessagesHtml() {
    const c = S.conv;
    if (!c.charge) return '<div class="conv-vide">Un instant…</div>';
    if (!c.messages.length) return '<div class="conv-vide"><b>Ta conversation avec Louis</b>Une question, une idée de vidéo, une vidéo que tu viens de faire : écris-lui ici, il te répond depuis la tour.</div>';
    const derniereMoi = c.messages.filter((m) => m.auteur === 'createur').map((m) => m.id).pop();
    let jour = '';
    return c.messages.map((m) => {
      const j = jourDe(m.le);
      const sep = j !== jour ? '<div class="conv-jour">' + h(j) + '</div>' : '';
      jour = j;
      const moi = m.auteur === 'createur';
      return sep + '<div class="bulle ' + (moi ? 'moi' : 'lui') + '">' + (m.texte ? '<p>' + avecLiens(h(m.texte)) + '</p>' : '') + (m.pieces || []).map(pieceHtml).join('') +
        '<small>' + h(heureDe(m.le)) + (moi && m.id === derniereMoi && c.vu >= m.id ? ', vu' : '') + '</small></div>';
    }).join('') + (c.envoi ? '<div class="bulle moi envoi"><p>' + h(c.envoi) + '</p><div class="barre-envoi"><i style="width:' + Math.round((c.progres || 0) * 100) + '%"></i></div></div>' : '');
  }
  function piecesChoisiesHtml() {
    return (S.conv && S.conv.pieces || []).map((f, i) => '<span class="puce-piece">' + h(f.name) + ' (' + tailleLisible(f.size) + ')<button type="button" data-a="retirerPiece" data-i="' + i + '" aria-label="Retirer ' + h(f.name) + '">' + ico('fermer') + '</button></span>').join('');
  }
  function majConv(bas) {
    const f = $('#conv-fil');
    if (!f) return;
    const enBas = bas || f.scrollHeight - f.scrollTop - f.clientHeight < 80;
    f.innerHTML = filMessagesHtml();
    if (enBas) f.scrollTop = f.scrollHeight;
  }
  function recevoir(d, bas) {
    const c = S.conv;
    const nouveaux = (d.messages || []).filter((m) => !c.messages.some((x) => x.id === m.id));
    c.messages = c.messages.concat(nouveaux).sort((a, b) => a.id - b.id);
    c.dernier = c.messages.length ? c.messages[c.messages.length - 1].id : 0;
    const vuAvant = c.vu;
    c.vu = Math.max(c.vu, d.vu_jusqua || 0);
    c.charge = true;
    if (nouveaux.length || c.vu !== vuAvant || bas) majConv(bas || nouveaux.some((m) => m.auteur === 'createur'));
    S.moi.messages_non_lus = d.non_lus || 0;
    majBoutonMessages();
  }
  async function ouvrirMessages() {
    const moi = ++S.boucle;
    S.conv = S.conv || { messages: [], dernier: 0, vu: 0, pieces: [], charge: false };
    try { const d = await lire('messages', { lire: '1' }); S.conv.messages = []; recevoir(d, true); }
    catch (e) { toast(e.message, 'err'); }
    // le direct : toutes les 3 secondes tant qu'elle regarde (moins souvent quand la page est cachée)
    while (moi === S.boucle && route().vue === 'messages') {
      await dormir(document.hidden ? 9000 : 3000);
      if (moi !== S.boucle || route().vue !== 'messages') return;
      if (document.hidden) continue;
      try { recevoir(await lire('messages', { apres: String(S.conv.dernier || 0), lire: '1' })); } catch (e) { await dormir(5000); }
    }
  }
  // ailleurs dans le studio : le compteur se met à jour toutes les 20 secondes, un petit mot quand Louis écrit
  async function verifierMessages() {
    if (!S.moi || document.hidden || route().vue === 'messages' || route().vue === 'invitation') return;
    try {
      const d = await lire('messages_etat');
      const avant = S.moi.messages_non_lus || 0;
      S.moi.messages_non_lus = d.non_lus || 0;
      if (S.moi.messages_non_lus !== avant) majBoutonMessages();
      if (S.moi.messages_non_lus > avant) toast('Louis t\'a écrit : ouvre tes messages.', 'ok');
    } catch (e) { /* la prochaine fois */ }
  }
  // envoyer un fichier droit dans le stockage, avec sa progression
  function televerser(url, fichier, type, progres) {
    return new Promise((ok, ko) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.setRequestHeader('Content-Type', type);
      x.setRequestHeader('x-upsert', 'true');
      x.upload.onprogress = (e) => { if (e.lengthComputable) progres(e.loaded / e.total); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : ko(new Error(x.status === 413 ? 'fichier trop lourd pour l\'envoi' : 'envoi refusé (' + x.status + ')')));
      x.onerror = () => ko(new Error('connexion coupée pendant l\'envoi'));
      x.send(fichier);
    });
  }

  /* ── l'équipe ── */
  function vueEquipe() {
    const eq = S.moi.equipe;
    return '<div class="s-tete"><div><h1>Ton équipe</h1><p>Six rôles, tes prénoms, tes couleurs : tu les retrouves dans ton studio. Les consignes que tu leur donnes passent avant tout le reste.</p></div></div>' +
      '<div class="bloc" style="margin-bottom:12px"><div class="equipe-rang">' + S.cat.ordre.map((k) => { const mb = eq[k]; return '<div class="membre">' + avatar(k, 'grand') + '<b>' + h(mb.prenom) + '</b><small>' + h(mb.metier) + '</small></div>'; }).join('') + '</div></div>' +
      badgesHtml() +
      '<form class="bloc" data-form="equipe" style="margin-top:12px"><div class="bloc-t"><span>Leurs prénoms, leurs couleurs, tes consignes</span></div>' +
      S.cat.ordre.map((k) => { const m = eq[k]; return '<div class="membre-carte" data-role="' + k + '"><span class="agent grand" style="--c:' + h(m.couleur) + '">' + initiale(m.prenom) + '</span><div><div class="duo-champs"><label class="champ" style="margin:0"><span>' + h(m.metier) + '</span><input type="text" name="' + k + '.prenom" maxlength="24" value="' + h(m.prenom) + '" data-apercu="' + k + '"></label><input type="color" name="' + k + '.couleur" value="' + h(m.couleur) + '" aria-label="Couleur de ' + h(m.prenom) + '" data-apercu="' + k + '"></div><p class="role">' + h(m.fait) + '</p><label class="champ" style="margin:0"><span>Tes consignes</span><textarea name="' + k + '.consignes" rows="2" maxlength="600" placeholder="' + h(PISTES[k]) + '">' + h(m.consignes || '') + '</textarea></label></div></div>'; }).join('') +
      '<div class="actions" style="margin-top:16px"><button class="btn" type="submit">Enregistrer mon équipe</button></div></form>';
  }
  const PISTES = { idees: 'Des sujets du quotidien, jamais de politique', plume: 'Tutoie, sois drôle, finis toujours par une question', critique: 'Sois très exigeante sur l\'accroche', traduction: 'En anglais, parle comme une Londonienne de 25 ans', realisation: 'Des images lumineuses, plutôt la nature', diffusion: 'Pas plus de 4 hashtags' };

  /* ── les réglages ── */
  const SECTIONS = [['chaine', 'Ma chaîne'], ['langues', 'Langues et voix'], ['videos', 'Mes vidéos'], ['budget', 'Budget'], ['pilote', 'Pilote automatique'], ['connexions', 'Connexions'], ['publication', 'Publication'], ['apparence', 'Apparence'], ['compte', 'Mon compte'], ['aide', 'Aide']];
  const FUSEAUX = [['Europe/Paris', 'France, Belgique, Suisse'], ['Europe/London', 'Royaume-Uni'], ['Europe/Madrid', 'Espagne'], ['Europe/Rome', 'Italie'], ['Europe/Lisbon', 'Portugal'], ['Europe/Berlin', 'Allemagne'], ['America/Martinique', 'Martinique'], ['America/Guadeloupe', 'Guadeloupe'], ['America/Cayenne', 'Guyane'], ['Indian/Reunion', 'La Réunion'], ['America/Montreal', 'Québec'], ['America/New_York', 'New York'], ['America/Sao_Paulo', 'Brésil'], ['Africa/Abidjan', 'Côte d\'Ivoire, Sénégal'], ['Africa/Casablanca', 'Maroc'], ['Asia/Dubai', 'Émirats'], ['Asia/Kolkata', 'Inde'], ['Asia/Tokyo', 'Japon'], ['Asia/Shanghai', 'Chine']];
  function inter(nom, coche, titre, texte, desactive) { return '<label class="inter"><span><b>' + h(titre) + '</b>' + (texte ? '<small>' + h(texte) + '</small>' : '') + '</span><input type="checkbox" name="' + nom + '"' + (coche ? ' checked' : '') + (desactive ? ' disabled' : '') + '></label>'; }
  function nuancier(nom, valeur) { return '<div class="nuancier" data-nuancier="' + nom + '">' + NUANCES.map((c) => '<button type="button" style="background:' + c + '" data-a="nuance" data-c="' + c + '" class="' + (String(valeur).toUpperCase() === c ? 'on' : '') + '" aria-label="' + c + '"></button>').join('') + '<input type="color" name="' + nom + '" value="' + h(valeur) + '" aria-label="Autre couleur"></div>'; }
  function formulaire(section, contenu, bouton) { return '<form class="bloc" data-form="reglages" data-section="' + section + '">' + contenu + (bouton === false ? '' : '<div class="actions" style="margin-top:8px"><button class="btn" type="submit">' + h(bouton || 'Enregistrer') + '</button></div>') + '</form>'; }
  function champ(titre, html, aide) { return '<div class="champ"><span>' + h(titre) + '</span>' + html + (aide ? '<small>' + aide + '</small>' : '') + '</div>'; }

  function sectionChaine(r) {
    const c = r.chaine;
    return formulaire('chaine',
      '<label class="champ"><span>Le nom de ta chaîne</span><input type="text" name="chaine.nom" maxlength="60" value="' + h(c.nom) + '" placeholder="Les petites questions"></label>' +
      '<label class="champ"><span>Tes sujets</span><textarea name="chaine.sujets" rows="3" maxlength="700" placeholder="Les questions bêtes de la vie de tous les jours, la science expliquée simplement">' + h(c.sujets) + '</textarea><small>Le plus précis possible : c\'est ce qui guide les idées et les scripts.</small></label>' +
      '<label class="champ"><span>Ton public</span><input type="text" name="chaine.public" maxlength="300" value="' + h(c.public) + '" placeholder="18 à 30 ans, curieux, plutôt sur TikTok"></label>' +
      '<label class="champ"><span>Ton ton</span><input type="text" name="chaine.ton" maxlength="300" value="' + h(c.ton) + '" placeholder="Complice, simple et drôle"></label>' +
      '<label class="champ"><span>Des vidéos que tu aimes</span><textarea name="chaine.exemples" rows="2" maxlength="900" placeholder="Des créatrices, des formats, des vidéos qui ont marché chez toi">' + h(c.exemples) + '</textarea></label>' +
      '<label class="champ"><span>Ce que tu ne veux jamais</span><textarea name="chaine.interdits" rows="2" maxlength="500" placeholder="Pas de gros mots, pas de régimes, pas de politique">' + h(c.interdits) + '</textarea></label>');
  }
  // les voix naturelles : allumées ou non, la voix de sa chaîne (à écouter avant de choisir), ce que ça coûte
  function blocVoixIa(r) {
    const vi = r.voix_ia || {};
    const cat = S.cat.voix_ia || { voix: {}, couts: {} };
    if (!S.moi.connexions.fal.branchee) return '<div class="message" style="margin-bottom:16px"><b>Des voix naturelles</b>Avec ta clé fal, tes vidéos sont dites par une vraie voix (ElevenLabs), la même dans toutes tes langues : environ ' + h(usd(cat.couts.court || 0)) + ' par langue pour une vidéo courte. <a href="#reglages/connexions">Brancher ma clé fal</a></div>';
    const cartes = Object.keys(cat.voix).map((k) => {
      const x = cat.voix[k];
      return '<div class="voix-ia"><label><input type="radio" name="voix_ia.voix" value="' + h(k) + '"' + (k === vi.voix ? ' checked' : '') + '><span><b>' + h(x.nom) + '</b><small>' + h(x.court) + '</small></span></label>' +
        '<button type="button" class="ecouter" data-a="ecouterVoix" data-voix="' + h(k) + '" title="Écouter ' + h(x.nom) + '" aria-label="Écouter la voix ' + h(x.nom) + '">' + ico('ecouter') + '</button></div>';
    }).join('');
    return '<div class="panneau-voix">' + inter('voix_ia.actif', vi.actif !== false, 'Voix naturelles', 'Une vraie voix d\'ElevenLabs, la même dans toutes tes langues, avec l\'accent de chaque langue. Environ ' + usd(cat.couts.court || 0) + ' par langue pour une vidéo courte, ' + usd(cat.couts.long || 0) + ' pour une longue, sur ta clé fal.') +
      '<div class="voix-grille" role="radiogroup" aria-label="La voix de ta chaîne">' + cartes + '</div><div id="ecoute" class="ecoute" hidden></div>' +
      '<p class="doux petit" style="margin:10px 0 0">Écouter coûte moins d\'un centime. Sans voix naturelle, ou si fal ne répond pas, la voix gratuite de chaque langue (ci-dessous) prend le relais.</p></div>';
  }
  function sectionLangues(r) {
    const voix = r.langues.map((l) => {
      const L = S.cat.langues[l];
      const v = r.voix[l] || L.defaut, vit = r.vitesse[l] || L.vitesse;
      return '<div class="champ"><span>Voix en ' + h(L.nom.toLowerCase()) + '</span><select name="voix.' + l + '">' + L.voix.map((x) => '<option value="' + h(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + h(x[1]) + '</option>').join('') + '</select><label class="ligne" style="margin-top:10px;gap:12px"><span class="doux petit" style="min-width:64px">Débit</span><input type="range" name="vitesse.' + l + '" min="0.8" max="1.25" step="0.05" value="' + h(vit) + '" class="plein"></label></div>';
    }).join('');
    return formulaire('langues',
      champ('Ta langue principale', '<select name="langue_source">' + Object.keys(S.cat.langues).sort((a, b) => nomLangue(a).localeCompare(nomLangue(b), 'fr')).map((l) => '<option value="' + l + '"' + (l === r.langue_source ? ' selected' : '') + '>' + h(nomLangue(l)) + '</option>').join('') + '</select>', 'Les scripts sont écrits dans cette langue, puis adaptés.') +
      champ('Tes langues', choixLangues('langues[]', r.langues), 'Chaque langue fait une vidéo de plus, avec sa voix, ses sous-titres et ses hashtags (six au plus).') + blocVoixIa(r) +
      (S.moi.connexions.fal.branchee && (r.voix_ia || {}).actif !== false ? '<h3 class="sous-titre-voix">Les voix gratuites, en secours</h3>' : '') + voix +
      '<p class="doux petit" style="margin-bottom:12px">Les voix gratuites : Kokoro pour les langues aux voix les plus naturelles, Piper pour les autres. Enregistre pour voir les voix d\'une langue que tu viens d\'ajouter.</p>');
  }
  function sectionVideos(r) {
    return formulaire('videos',
      champ('Durée habituelle', radios('format', [['court', '35 à 50 secondes'], ['long', 'Plus d\'une minute']], r.format), 'TikTok ne rémunère que les vidéos de plus d\'une minute ; les courtes se regardent plus souvent jusqu\'au bout.') +
      lookHtml(r, r.format) +
      '<p class="doux petit" style="margin:-4px 0 16px">Vidéos d\'illustration : des vidéos libres de droits (Pexels) choisies phrase par phrase, offertes. Images IA : chaque scène est créée pour ta vidéo, dans le style que tu choisis, sur ta clé fal. Texte animé : le texte sur un fond à tes couleurs.</p>' +
      champ('La couleur de tes vidéos', nuancier('couleur', r.couleur), 'L\'accroche et le mot qui s\'allume pendant les sous-titres.') +
      champ('Musique', radios('musique', Object.keys(S.cat.musiques).map((k) => [k, S.cat.musiques[k]]), r.musique), 'Une musique d\'ambiance très douce sous la voix, fabriquée par le studio (aucun droit à payer).'));
  }
  function sectionBudget(r) {
    const d = S.moi.depense;
    return formulaire('budget',
      '<div class="message" style="margin-bottom:16px"><b>Aujourd\'hui : ' + h(usd(d.jour)) + ' sur ' + h(usd(d.budget)) + '</b>Ce mois : ' + h(usd(d.mois)) + '. Depuis le début : ' + h(usd(d.total)) + '.</div>' +
      '<label class="champ"><span>Budget par jour : <output id="budgetVal">' + h(usd(r.budget_jour)) + '</output></span><input type="range" name="budget_jour" min="0.1" max="' + (r.budget_jour > 5 || r.style === 'ia' ? 20 : 5) + '" step="0.05" value="' + h(r.budget_jour) + '"><small>Ton équipe s\'arrête dès qu\'elle l\'atteint, et reprend le lendemain. Il compte l\'écriture (Claude) et, avec le look images IA, les images (fal). Une vidéo coûte environ ' + h(usd(d.estime_video)) + '.' + (d.estime_video > r.budget_jour ? ' Monte ton budget : une vidéo coûte plus que ce que tu permets par jour.' : '') + '</small></label>' +
      champ('Qualité de l\'écriture', radios('qualite', Object.keys(S.cat.qualites).map((k) => [k, S.cat.qualites[k].nom]), r.qualite), h((S.cat.qualites[r.qualite] || {}).explication || '')) +
      inter('tendances', r.tendances, 'Regarder les tendances', h(membre('idees').prenom) + ' cherche sur le web ce dont on parle cette semaine avant de proposer des idées (1 centime la recherche).'));
  }
  function sectionPilote(r) {
    const p = r.pilote, up = S.moi.connexions.uploadpost.branchee;
    return formulaire('pilote',
      '<p class="doux" style="margin-bottom:8px">Chaque jour, à ton heure, ' + h(membre('idees').prenom) + ' choisit une idée et l\'équipe fait la vidéo toute seule, dans ton budget.</p>' +
      inter('pilote.actif', p.actif, 'Pilote automatique', 'Des vidéos tous les jours, sans rien demander.') +
      '<div class="grille2" style="margin-top:12px">' + champ('Vidéos par jour', '<select name="pilote.videos_jour">' + [1, 2, 3, 4, 5].map((n) => '<option' + (n === p.videos_jour ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') +
      champ('À partir de', '<select name="pilote.heure">' + Array.from({ length: 24 }, (_, i) => '<option value="' + i + '"' + (i === p.heure ? ' selected' : '') + '>' + i + ' h</option>').join('') + '</select>') + '</div>' +
      champ('Ton fuseau horaire', '<select name="fuseau">' + FUSEAUX.concat(FUSEAUX.some((f) => f[0] === r.fuseau) ? [] : [[r.fuseau, r.fuseau]]).map((f) => '<option value="' + h(f[0]) + '"' + (f[0] === r.fuseau ? ' selected' : '') + '>' + h(f[1]) + '</option>').join('') + '</select>', 'Ton budget repart aussi à minuit, chez toi.') +
      inter('pilote.relire', p.relire, 'Je relis avant le montage', 'Le script t\'attend pour validation. Décoche pour que tout se fasse seul.') +
      inter('pilote.publier', p.publier, 'Publier tout seul', up ? 'Dès qu\'une vidéo du pilote est prête, ' + membre('diffusion').prenom + ' la publie là où tu l\'as réglé.' : 'Demande la publication automatique (Connexions).', !up));
  }
  function etatCle(c, nom) {
    if (!c.branchee) return '<div class="etat-cle"><span class="point"></span><div class="plein"><b>' + h(nom) + ' n\'est pas branché</b><small>Suis les étapes ci-dessous.</small></div></div>';
    const bon = (c.etat || 'ok') === 'ok';
    return '<div class="etat-cle"><span class="point ' + (bon ? 'ok' : 'alerte') + '"></span><div class="plein"><b>' + (bon ? h(nom) + ' est branché' : h(nom) + ' demande ton attention') + '</b><small>Clé se terminant par ' + h(c.fin) + ', ajoutée ' + h(depuis(c.le)) + (c.message ? '. ' + h(c.message) : '') + '</small></div></div>';
  }
  function sectionConnexions() {
    const cl = S.moi.connexions.claude, up = S.moi.connexions.uploadpost;
    const l = (u, t) => '<a class="lien" href="' + u + '" target="_blank" rel="noopener noreferrer">' + h(t) + ico('ouvrir') + '</a>';
    let x = '<div class="bloc"><h2>Ta clé Claude</h2><p class="doux" style="margin:6px 0 14px">C\'est elle qui fait travailler ton équipe. Tu paies Claude directement, à l\'usage : quelques centimes par vidéo.</p>' + etatCle(cl, 'Claude') +
      '<ol class="tuto"><li><b>Crée ton compte Claude pour les applications</b><p>Sur platform.claude.com, inscris-toi avec ton e-mail. C\'est un compte à part de l\'application Claude.</p>' + l('https://platform.claude.com', 'Ouvrir platform.claude.com') + '</li>' +
      '<li><b>Ajoute un peu de crédit</b><p>Settings, puis Billing, puis Buy credits : 5 $ suffisent pour commencer. Laisse le rechargement automatique désactivé.</p>' + l('https://platform.claude.com/settings/billing', 'Ouvrir Billing') + '</li>' +
      '<li><b>Fixe une limite de dépense</b><p>Settings, puis Limits : une limite par mois (10 $ par exemple). Ton compte ne pourra jamais la dépasser.</p>' + l('https://platform.claude.com/settings/limits', 'Ouvrir Limits') + '</li>' +
      '<li><b>Crée ta clé</b><p>Settings, puis API keys, puis Create key. Appelle-la « Studio » et choisis l\'expiration « Never » (sinon elle s\'arrête toute seule au bout de quelques jours). Laisse le reste tel quel. Copie-la tout de suite avec le bouton de copie : c\'est une longue suite d\'une centaine de caractères (souvent <code>sk-ant-…</code>), qui ne s\'affiche qu\'une fois.</p>' + l('https://platform.claude.com/settings/keys', 'Ouvrir API keys') + '</li>' +
      '<li><b>Colle-la ici</b><p>Le studio vérifie qu\'elle marche et qu\'il te reste du crédit, puis la range chiffrée. Elle ne s\'affiche plus jamais en entier. Si quelque chose ne va pas, le message dit exactement quoi.</p>' +
      '<form data-form="cleClaude" style="margin-top:10px"><input type="text" name="cle" class="champ-cle" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-form-type="other" placeholder="sk-ant-…" required><p class="erreur-cle" role="alert" hidden></p><div class="actions" style="margin-top:10px"><button class="btn" type="submit">Vérifier et enregistrer</button>' + (cl.branchee ? '<button class="btn discret" type="button" data-a="cleClaudeRetirer">Retirer ma clé</button>' : '') + '</div></form></li>' +
      '<li><b>Choisis ton budget du jour</b><p>Dans <a href="#reglages/budget">Budget</a> : arrivée au plafond, ton équipe s\'arrête jusqu\'au lendemain.</p></li></ol></div>';
    const fal = S.moi.connexions.fal || { branchee: false };
    const ia = S.cat.ia || IA_VIDE;
    x += '<div class="bloc"><h2>Images IA</h2><p class="doux" style="margin:6px 0 14px">Facultatif. Avec ta clé fal, chaque scène de tes vidéos est créée pour elle, dans le style que tu choisis (photo réaliste, anime, aquarelle...), et peut même devenir une vraie vidéo. Tu paies fal à l\'usage : environ ' + h(usd(coutIa('court', 'zoom'))) + ' par vidéo en images animées, ' + h(usd(coutIa('court', 'accroche'))) + ' avec l\'accroche en vidéo. Les images : ' + h(ia.modeles.image || 'FLUX.2') + ' ; les vidéos : ' + h(ia.modeles.video || 'MiniMax') + '.</p>' + etatCle(fal, 'fal') +
      '<ol class="tuto"><li><b>Crée ton compte fal</b><p>Sur fal.ai, inscris-toi avec ton e-mail ou ton compte Google.</p>' + l('https://fal.ai', 'Ouvrir fal.ai') + '</li>' +
      '<li><b>Ajoute un peu de crédit</b><p>Dans ton tableau de bord, Billing : 5 $ suffisent pour une quinzaine de vidéos avec l\'accroche en vidéo. Laisse le rechargement automatique désactivé : tu ne dépenseras jamais plus que ce que tu as mis.</p>' + l('https://fal.ai/dashboard/billing', 'Ouvrir Billing') + '</li>' +
      '<li><b>Crée ta clé</b><p>Dans Keys, Create key, de type API. Appelle-la « Studio », puis copie-la en entier : deux suites de chiffres et de lettres séparées par deux-points. Elle ne s\'affiche qu\'une fois.</p>' + l('https://fal.ai/dashboard/keys', 'Ouvrir Keys') + '</li>' +
      '<li><b>Colle-la ici</b><p>Le studio vérifie que fal la connaît, puis la range chiffrée. Elle ne s\'affiche plus jamais en entier.</p>' +
      '<form data-form="cleFal" style="margin-top:10px"><input type="text" name="cle" class="champ-cle" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-form-type="other" placeholder="1a2b3c4d-…:9f8e7d…" required><p class="erreur-cle" role="alert" hidden></p><div class="actions" style="margin-top:10px"><button class="btn" type="submit">Vérifier et enregistrer</button>' + (fal.branchee ? '<button class="btn discret" type="button" data-a="cleFalRetirer">Retirer ma clé</button>' : '') + '</div></form></li>' +
      '<li><b>Choisis le look Images IA</b><p>Dans <a href="#reglages/videos">Mes vidéos</a> pour toutes tes vidéos, ou au moment de créer une vidéo. Le même budget du jour compte Claude et fal.</p></li></ol></div>';
    x += '<div class="bloc"><h2>Publication automatique</h2><p class="doux" style="margin:6px 0 14px">Facultatif. upload-post publie tes vidéos sur tes comptes, sans passer par ton téléphone. Gratuit jusqu\'à 10 publications par mois sur YouTube et Instagram ; TikTok demande leur offre Basic (environ 16 $ par mois).</p>' + etatCle(up, 'upload-post');
    if (up.branchee) {
      const pr = up.profils || [];
      x += '<h3 style="margin:14px 0 8px">Tes profils</h3><p class="doux petit" style="margin-bottom:10px">Un profil relie un compte par plateforme. Deux langues sur deux comptes TikTok différents : deux profils.</p>' +
        (pr.length ? '<div class="plateformes">' + pr.map((p) => '<div class="plateforme"><div class="plein"><b>' + h(p.nom || p.username) + '</b><small>' + h(Object.keys(S.cat.plateformes).map((k) => S.cat.plateformes[k] + ' : ' + (p.comptes[k] ? (p.comptes[k].reconnecter ? 'à reconnecter' : p.comptes[k].nom) : 'non relié')).join(' ; ')) + '</small></div><button class="btn second petit" data-a="upConnecter" data-profil="' + h(p.username) + '">' + ico('lien') + 'Relier mes comptes</button></div>').join('') + '</div>' : '<p class="doux petit">Aucun profil pour l\'instant.</p>') +
        '<form data-form="upProfil" class="duo-champs" style="margin-top:12px"><input type="text" name="nom" maxlength="40" pattern="[A-Za-z0-9_.\\-]{3,40}" placeholder="Nom du profil (studio, studio-en)" required><button class="btn second" type="submit">Créer</button></form>' +
        '<div class="actions" style="margin-top:12px"><button class="btn discret petit" data-a="upRafraichir">Rafraîchir</button><a class="btn discret petit" href="#reglages/publication">Choisir où publier chaque langue</a><button class="btn discret petit" data-a="upRetirer">Retirer upload-post</button></div>';
    } else {
      x += '<ol class="tuto"><li><b>Crée ton compte upload-post</b><p>Gratuit, sans carte bancaire.</p>' + l('https://www.upload-post.com', 'Ouvrir upload-post.com') + '</li>' +
        '<li><b>Crée ta clé</b><p>Dans ton tableau de bord, ouvre API Keys et crée une clé. Copie-la.</p></li>' +
        '<li><b>Colle-la ici</b><form data-form="cleUp" style="margin-top:10px"><input type="text" name="cle" class="champ-cle" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-form-type="other" placeholder="Ta clé upload-post" required><p class="erreur-cle" role="alert" hidden></p><div class="actions" style="margin-top:10px"><button class="btn" type="submit">Vérifier et enregistrer</button></div></form></li>' +
        '<li><b>Relie tes comptes</b><p>Crée un profil, puis « Relier mes comptes » : TikTok, YouTube, Instagram, comme tu veux.</p></li>' +
        '<li><b>Choisis où publier chaque langue</b><p>Dans Publication. Sans upload-post, tu publies depuis ton téléphone : Partager, puis l\'appli.</p></li></ol>';
    }
    return x + '</div>';
  }
  function sectionPublication(r) {
    const up = S.moi.connexions.uploadpost;
    if (!up.branchee) return '<div class="bloc"><h2>Publication</h2><p class="doux" style="margin-top:6px">Branche d\'abord upload-post dans <a href="#reglages/connexions">Connexions</a>. Sans lui, chaque vidéo prête se télécharge ou se partage depuis ton téléphone, avec son texte prêt à copier.</p></div>';
    const pr = up.profils || [];
    const lignes = r.langues.map((l) => {
      const c = (r.publication || {})[l] || {};
      return '<div class="champ"><span>Vidéos en ' + h(nomLangue(l).toLowerCase()) + '</span><select name="publication.' + l + '.profil"><option value="">À la main, depuis mon téléphone</option>' + pr.map((p) => '<option value="' + h(p.username) + '"' + (p.username === c.profil ? ' selected' : '') + '>Profil ' + h(p.nom || p.username) + '</option>').join('') + '</select><div class="choix" style="margin-top:10px">' + Object.keys(S.cat.plateformes).map((k) => '<label><input type="checkbox" name="publication.' + l + '.plateformes[]" value="' + k + '"' + ((c.plateformes || []).indexOf(k) >= 0 ? ' checked' : '') + '><span>' + h(S.cat.plateformes[k]) + '</span></label>').join('') + '</div></div>';
    }).join('');
    return formulaire('publication', lignes +
      champ('Visibilité sur TikTok', '<select name="visibilite.tiktok">' + [['PUBLIC_TO_EVERYONE', 'Tout le monde'], ['MUTUAL_FOLLOW_FRIENDS', 'Amis'], ['FOLLOWER_OF_CREATOR', 'Abonnés'], ['SELF_ONLY', 'Moi seulement (pour essayer)']].map((o) => '<option value="' + o[0] + '"' + (o[0] === r.visibilite.tiktok ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') +
      champ('Visibilité sur YouTube', '<select name="visibilite.youtube">' + [['public', 'Publique'], ['unlisted', 'Non répertoriée'], ['private', 'Privée (pour essayer)']].map((o) => '<option value="' + o[0] + '"' + (o[0] === r.visibilite.youtube ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') +
      inter('etiquette_ia', r.etiquette_ia, 'Signaler le contenu fait avec l\'IA sur TikTok', 'TikTok demande d\'étiqueter les vidéos dont la voix est générée par une IA réaliste.'));
  }
  function sectionApparence(r) {
    return formulaire('apparence', champ('La couleur de ton studio', nuancier('theme.accent', r.theme.accent), 'Les boutons, ta marque, et toi dans ton studio en 3D.') +
      champ('Le jour et la nuit', radios('theme.mode', [['auto', 'Selon l\'heure'], ['jour', 'Toujours le jour'], ['nuit', 'Toujours la nuit']], r.theme.mode), 'Selon l\'heure : la nuit tombe à 20 h chez toi, les lampadaires s\'allument.') +
      inter('theme.ville', r.theme.ville !== false, 'Mon studio en 3D à l\'accueil', 'Décoche si ton téléphone chauffe ou rame : l\'accueil reste, sans la 3D.'));
  }
  function sectionCompte() {
    return '<div class="bloc"><h2>Mon compte</h2><p class="doux" style="margin:6px 0 16px">Identifiant : <b>' + h(S.moi.identifiant) + '</b></p><form data-form="mdp"><label class="champ"><span>Mot de passe actuel</span><input type="password" name="ancien" autocomplete="current-password" required></label><label class="champ"><span>Nouveau mot de passe</span><input type="password" name="nouveau" autocomplete="new-password" minlength="10" required><small>10 caractères au moins.</small></label><button class="btn second" type="submit">Changer mon mot de passe</button></form></div>' +
      '<div class="bloc"><div class="actions"><button class="btn second" data-a="revoirVisite">Revoir la visite du studio</button><button class="btn second" data-a="deconnexion">Me déconnecter</button><button class="btn discret" data-a="partout">Déconnecter tous mes appareils</button></div></div>';
  }
  function sectionAide() {
    const q = [
      ['Combien ça coûte ?', 'L\'écriture se paie sur ta clé Claude : environ 1 centime par vidéo en qualité économique, 8 centimes en qualité équilibrée (plus 2 par langue), 15 centimes en premium. Avec ta clé fal : la voix naturelle, environ ' + usd(coutVoix('court', 1)) + ' par langue pour une vidéo courte (' + usd(coutVoix('long', 1)) + ' pour une longue) ; le look Images IA, environ ' + usd(coutIa('court', 'zoom')) + ' par vidéo en images animées, ' + usd(coutIa('court', 'accroche')) + ' avec l\'accroche en vidéo, ' + usd(coutIa('court', 'tout')) + ' tout en vidéo ; une image créée quand aucune vidéo d\'illustration ne colle, 1,6 centime. Le montage, les voix gratuites, les vidéos d\'illustration et le stockage sont offerts par le studio. Ton budget du jour (Claude et fal ensemble) bloque tout dépassement.'],
      ['Les images IA, c\'est quoi ?', 'Au lieu de vidéos trouvées dans une banque, chaque phrase a sa scène créée pour ta vidéo, dans le style que tu choisis : photo réaliste, anime, 3D, aquarelle, pâte à modeler... Le même personnage revient d\'une scène à l\'autre. Les images zooment doucement, et la première scène (ou toutes) peut devenir une vraie vidéo IA. Il faut ta clé fal : Réglages, Connexions.'],
      ['Quelles langues ?', Object.keys(S.cat.langues).length + ' langues. Les voix les plus naturelles : ' + (S.cat.naturelles || []).map(nomLangue).join(', ') + '. Les autres ont une voix correcte, un peu plus robotique. Une vidéo peut sortir dans six langues au plus, chacune avec ses sous-titres et ses hashtags.'],
      ['Pourquoi TikTok ne se publie pas tout seul ?', 'TikTok n\'autorise la publication automatique que par des services agréés. upload-post l\'est, sur son offre payante. Sinon, depuis ton téléphone : Partager, puis TikTok ; le texte se copie en un geste.'],
      ['TikTok me paiera-t-il ?', 'Le programme de rémunération de TikTok ne compte que les vidéos de plus d\'une minute : choisis la durée « Plus d\'une minute » pour celles-là. Les conditions (âge, abonnés, vues) sont dans l\'appli TikTok, rubrique Studio TikTok.'],
      ['Et YouTube ?', 'Une vidéo verticale de moins de 3 minutes devient un Short tout seul. Elle peut rapporter une fois ta chaîne acceptée au Programme Partenaire YouTube.'],
      ['Combien de temps mes vidéos restent-elles ici ?', 'Leurs fichiers sont gardés ' + S.cat.garde_jours + ' jours : télécharge celles que tu veux garder. Les scripts restent.'],
      ['Ma vidéo est bloquée, je fais quoi ?', 'Ouvre-la : le message dit pourquoi (clé, crédit, budget du jour) et le bouton pour régler. Une vidéo en images IA peut aussi continuer sans elles, avec des vidéos d\'illustration. Les petits soucis passagers se réessaient tout seuls.'],
      ['D\'où viennent les images, la voix, la musique ?', 'Les vidéos d\'illustration viennent de Pexels (libres de droits, usage commercial permis) : Lou en réunit plusieurs par phrase et garde celle qui montre vraiment ce qui est dit ; sinon une image est créée pour la phrase (avec ta clé fal), sinon le fond animé. Les images IA et la voix naturelle (ElevenLabs) sont faites pour toi par fal, sur ton compte, et tu peux t\'en servir commercialement. Sans clé fal, la voix est une voix de synthèse libre (Kokoro ou Piper). La musique est fabriquée par le studio. Tu peux publier et monétiser sans rien payer de plus pour elles.'],
      ['Qu\'est-ce qui se passe dans ma rue ?', 'La vie du quartier : Mila qui se gare comme elle peut, des collègues qui s\'ennuient et lorgnent sur la piscine de la résidence d\'à côté... Touche la voiture garée ou la piscine pour voir.'],
      ['Qui voit mes clés et mes vidéos ?', 'Tes clés (Claude, fal, upload-post) sont rangées chiffrées et ne s\'affichent plus jamais. Dans la tour, Louis voit que ton compte existe, ta dépense et le nombre de tes vidéos.']
    ];
    return '<div class="bloc">' + q.map((x) => '<details class="aide"><summary>' + h(x[0]) + '</summary><p>' + h(x[1]) + '</p></details>').join('') + '</div>';
  }
  function vueReglages(section) {
    const r = S.moi.reglages;
    const s = SECTIONS.some((x) => x[0] === section) ? section : 'chaine';
    const corps = { chaine: sectionChaine, langues: sectionLangues, videos: sectionVideos, budget: sectionBudget, pilote: sectionPilote, connexions: sectionConnexions, publication: sectionPublication, apparence: sectionApparence, compte: sectionCompte, aide: sectionAide }[s](r);
    return '<div class="s-tete"><div><h1>Réglages</h1></div></div><nav class="reglages-nav" aria-label="Réglages">' + SECTIONS.map((x) => '<a href="#reglages/' + x[0] + '" class="' + (x[0] === s ? 'on' : '') + '">' + h(x[1]) + '</a>').join('') + '</nav>' + corps;
  }

  /* ── lire un formulaire : les noms à points font des objets, [] des listes ── */
  function lireForm(form) {
    const out = {};
    const poser = (chemin, val) => { const k = chemin.split('.'); let o = out; k.slice(0, -1).forEach((x) => { o[x] = o[x] && typeof o[x] === 'object' ? o[x] : {}; o = o[x]; }); o[k[k.length - 1]] = val; };
    const prendre = (chemin) => chemin.split('.').reduce((o, x) => (o ? o[x] : undefined), out);
    $$('[name]', form).forEach((el) => {
      const n = el.name;
      if (!n || el.disabled) return;
      if (/\[\]$/.test(n)) { const c = n.slice(0, -2); if (!Array.isArray(prendre(c))) poser(c, []); if (el.checked) prendre(c).push(el.value); return; }
      if (el.type === 'checkbox') poser(n, el.checked);
      else if (el.type === 'radio') { if (el.checked) poser(n, el.value); }
      else if (el.type === 'range' || el.type === 'number') poser(n, Number(el.value));
      else poser(n, el.value);
    });
    return out;
  }

  /* ── les formulaires ── */
  const FORMS = {
    async message(f, btn) {
      const c = S.conv;
      const ta = $('textarea[name="texte"]', f);
      const texte = String(ta.value || '').trim();
      const fichiers = c.pieces.slice();
      if (!texte && !fichiers.length) { ta.focus(); return; }
      if (c.envoi) return;
      btn.disabled = true;
      try {
        const pieces = [];
        for (let i = 0; i < fichiers.length; i++) {
          const fi = fichiers[i], type = typeFichier(fi);
          c.envoi = 'Envoi de ' + fi.name + (fichiers.length > 1 ? ' (' + (i + 1) + ' sur ' + fichiers.length + ')' : '');
          c.progres = 0; majConv(true);
          const r = await agir('message_envoi', { nom: fi.name, type, taille: fi.size });
          await televerser(r.url, fi, r.type, (x) => { c.progres = x; const b = $('.barre-envoi i'); if (b) b.style.width = Math.round(x * 100) + '%'; });
          pieces.push({ chemin: r.chemin, nom: fi.name, type: r.type, taille: fi.size });
        }
        const d = await agir('message', { texte, pieces });
        c.envoi = null; c.pieces = []; ta.value = ''; ta.style.height = '';
        const p = $('#conv-pieces'); if (p) p.innerHTML = '';
        recevoir({ messages: [d.message], non_lus: S.moi.messages_non_lus, vu_jusqua: c.vu }, true);
      } catch (e) { c.envoi = null; majConv(); toast(e.message, 'err'); }
      finally { btn.disabled = false; }
    },
    async connexion(f, btn) {
      const d = lireForm(f);
      await occupe(btn, async () => { await agir('connexion', d); const e = await lire('etat'); S.moi = e.moi; S.videos = null; S.statuts = null; S.fil = []; location.hash = '#accueil'; rendre(); });
    },
    async invitation(f, btn) {
      const d = lireForm(f);
      if (d.mdp !== d.mdp2) { toast('Les deux mots de passe ne sont pas pareils.', 'err'); return; }
      await occupe(btn, async () => { await agir('invitation', { code: f.dataset.code, mdp: d.mdp }); const e = await lire('etat'); S.moi = e.moi; history.replaceState(null, '', '/studio#accueil'); rendre(); toast('Bienvenue dans ton studio.', 'ok'); });
    },
    async creer(f, btn) {
      const d = lireForm(f);
      if (!S.moi.connexions.claude.branchee) { toast('Branche d\'abord ta clé Claude.', 'err'); location.hash = '#reglages/connexions'; return; }
      if (d.style === 'ia' && !S.moi.connexions.fal.branchee) { toast('Branche d\'abord ta clé fal pour les images IA, ou choisis un autre look.', 'err'); location.hash = '#reglages/connexions'; return; }
      if (String(d.sujet || '').trim().length < 4) { toast('Écris ton idée en quelques mots.', 'err'); const t = $('textarea[name="sujet"]', f); if (t) t.focus(); return; }
      if ((d.langues || []).length > 6) { toast('Six langues au plus par vidéo.', 'err'); return; }
      await occupe(btn, async () => { const r = await agir('creer', { sujet: d.sujet, langues: d.langues, format: d.format, style: d.style, ia: d.ia || null, modele: d.modele || null }); S.video = r.video; S.videos = null; S.modele = ''; location.hash = '#video/' + r.video.id; });
    },
    // lancer un clip : son fichier audio d'abord (droit dans le stockage), puis le clip
    async clip(f, btn) {
      const d = lireForm(f);
      const m = d.musique || {};
      if (!S.moi.connexions.claude.branchee) { toast('Branche d\'abord ta clé Claude : ' + membre('realisation').prenom + ' en a besoin pour découper ton prompt.', 'err'); location.hash = '#reglages/connexions'; return; }
      if (!S.moi.connexions.fal.branchee) { toast('Branche d\'abord ta clé fal : les images et les plans du clip se font sur ton compte fal.', 'err'); location.hash = '#reglages/connexions'; return; }
      if (String(d.prompt || '').trim().length < 20) { toast('Colle ton prompt : quelques phrases au moins.', 'err'); const t = $('textarea[name="prompt"]', f); if (t) t.focus(); return; }
      if (m.source === 'fichier' && !(($('input[name="son"]', f) || {}).files || []).length) { toast('Choisis ton fichier audio, ou une autre musique.', 'err'); return; }
      await occupe(btn, async () => {
        const musique = { source: m.source || 'aucune' };
        if (musique.source === 'fichier') Object.assign(musique, await envoyerSon(f, btn), { debut: Number(m.debut) || 0 });
        if (musique.source === 'ia') musique.idee = m.idee || '';
        const r = await agir('creer', { genre: 'clip', prompt: d.prompt, format: d.format, duree: d.duree, qualite: d.qualite, montage: d.montage, bruitages: !!d.bruitages, valider: !!d.valider, musique });
        S.brouillonClip = null; memoire.ecrire('brouillonClip', null);
        S.video = r.video; S.videos = null; S.planOuvert = null; location.hash = '#video/' + r.video.id;
      });
    },
    // refaire l'image d'un plan (avec ses retouches et sa consigne)
    async clipPlan(f, btn) {
      const d = lireForm(f);
      await occupe(btn, async () => {
        const r = await agir('clip_plan', { id: S.video.id, i: Number(f.dataset.i), image: d.image, mouvement: d.mouvement, son: d.son, duree: d.duree, effet: d.effet, refaire: true, consigne: d.consigne });
        S.planOuvert = null; majVideo(r.video); suivre(S.video.id); toast(membre('realisation').prenom + ' refait l\'image.', 'ok');
      });
    },
    // refaire le montage d'un clip : un autre style, une autre musique (son nouveau fichier part d'abord)
    async remonter(f, btn) {
      const d = lireForm(f);
      const m = d.musique || {};
      const cl = S.video.plan.clip || {};
      const fichier = (($('input[name="son"]', f) || {}).files || []).length > 0;
      if (m.source === 'fichier' && !fichier && !(cl.musique && cl.musique.source === 'fichier')) { toast('Choisis ton fichier audio, ou une autre musique.', 'err'); return; }
      const nouvelleIa = m.source === 'ia' && (cl.musique.source !== 'ia' || (m.idee || '') !== (cl.musique.idee || ''));
      if (nouvelleIa && !(await fenetre({ titre: 'Créer une nouvelle musique ?', texte: 'Environ ' + usd(catClip().prix.musique_minute || 0.6) + ' sur ta clé fal, puis le montage repart avec elle.', ok: 'Créer et remonter' }))) return;
      await occupe(btn, async () => {
        const musique = { source: m.source || 'aucune' };
        if (musique.source === 'fichier') Object.assign(musique, fichier ? await envoyerSon(f, btn) : {}, { debut: Number(m.debut) || 0 });
        if (musique.source === 'ia') musique.idee = m.idee || '';
        const r = await agir('refaire', { id: S.video.id, montage: d.montage, bruitages: !!d.bruitages, musique });
        S.partage = {}; majVideo(r.video); suivre(S.video.id); toast('Le montage repart.', 'ok');
      });
    },
    async idees(f, btn) {
      const d = lireForm(f);
      if (!S.moi.connexions.claude.branchee) { toast('Branche d\'abord ta clé Claude.', 'err'); location.hash = '#reglages/connexions'; return; }
      S.mayaCherche = true;
      const c = $('#contenu'); if (c) c.innerHTML = vueCreer();
      try { await agir('idees', { theme: d.theme }); toast(membre('idees').prenom + ' a des idées pour toi.', 'ok'); if (S.ville) S.ville.feter('idees'); }
      catch (e) { toast(e.message, 'err'); }
      finally { S.mayaCherche = false; if (route().vue === 'creer') { const c2 = $('#contenu'); if (c2) c2.innerHTML = vueCreer(); } const j = $('.jauge'); if (j) j.outerHTML = jaugeHtml(); }
    },
    async script(f, btn) {
      await occupe(btn, async () => {
        await agir('modifier', { id: S.video.id, script: scriptDe(f) });
        const r = await agir('valider', { id: S.video.id });
        majVideo(r.video); toast('C\'est parti.', 'ok'); suivre(S.video.id);
      });
    },
    async texte(f, btn) {
      const d = lireForm(f);
      await occupe(btn, async () => { const r = await agir('modifier', { id: S.video.id, langue: f.dataset.l, texte: d }); S.video = r.video; toast('Texte enregistré.', 'ok'); });
    },
    async equipe(f, btn) {
      await occupe(btn, async () => { await agir('equipe', { equipe: lireForm(f) }); rendre(); toast('Ton équipe est enregistrée.', 'ok'); verifierBadges(); });
    },
    async reglages(f, btn) {
      const d = lireForm(f);
      await occupe(btn, async () => { await agir('reglages', { reglages: d }); rendre(); toast('Enregistré.', 'ok'); verifierBadges(); });
    },
    async visiteChaine(f, btn) {
      const d = lireForm(f);
      await occupe(btn, async () => { if (d.nom || d.sujets) await agir('reglages', { reglages: { chaine: { nom: d.nom, sujets: d.sujets } } }); const b = $('.barre'); if (b) b.outerHTML = barreHtml('accueil'); if (S.ville) majVille(); ouvrirVisite(S.visite + 1); });
    },
    async cleClaude(f, btn) {
      await brancherCle(f, btn, 'cle_claude', (r) => { toast(r.avertissement ? 'Clé enregistrée : ' + r.avertissement : 'Ta clé Claude est branchée.', r.avertissement ? '' : 'ok'); verifierBadges(); });
    },
    async cleFal(f, btn) {
      await brancherCle(f, btn, 'cle_fal', (r) => toast(r.avertissement ? 'Clé enregistrée : ' + r.avertissement : 'Ta clé fal est branchée : le look Images IA est à toi.', r.avertissement ? '' : 'ok'));
    },
    async cleUp(f, btn) {
      await brancherCle(f, btn, 'uploadpost', () => toast('upload-post est branché.', 'ok'));
    },
    async upProfil(f, btn) {
      await occupe(btn, async () => { await agir('uploadpost_creer_profil', { nom: lireForm(f).nom }); rendre(); toast('Profil créé : relie tes comptes.', 'ok'); });
    },
    async mdp(f, btn) {
      await occupe(btn, async () => { const r = await agir('mdp', lireForm(f)); f.reset(); toast(r.message || 'Mot de passe changé.', 'ok'); });
    }
  };
  // brancher une clé : en cas de refus, la raison reste écrite sous la case, jusqu'au prochain essai
  async function brancherCle(f, btn, op, ok) {
    const zone = $('.erreur-cle', f);
    if (zone) { zone.hidden = true; zone.textContent = ''; }
    await occupe(btn, async () => {
      let r;
      try { r = await agir(op, { cle: lireForm(f).cle }); }
      catch (e) {
        if (!zone) throw e;
        const m = String(e.message || e);
        zone.textContent = m.charAt(0).toUpperCase() + m.slice(1) + (/[.!?]$/.test(m) ? '' : '.');
        zone.hidden = false;
        return;
      }
      rendre(); ok(r);
    });
  }
  function scriptDe(f) {
    const beats = (S.video.script.beats || []).map((b, i) => {
      const champ = (sel) => $(sel + '[data-i="' + i + '"]', f);
      const voix = champ('textarea[name="voix"]'), ecran = champ('input[name="ecran"]'), req = champ('input[name="requete"]'), prompt = champ('textarea[name="prompt"]');
      const out = { voix: voix ? voix.value : b.voix, ecran: ecran ? ecran.value : b.ecran };
      // ce qu'elle a retouché de l'image ; le reste (la description, le mouvement...) reste celui de la plume
      if (b.visuel || req || prompt) out.visuel = Object.assign({}, b.visuel || {}, req ? { requete: req.value } : {}, prompt ? { prompt: prompt.value } : {});
      return out;
    }).filter((b) => String(b.voix || '').trim());
    const v = (n) => { const el = $('[name="' + n + '"]', f); return el ? el.value : undefined; };
    const s = { titre: v('titre'), accroche: v('accroche'), description: v('description'), hashtags: String(v('hashtags') || '').split(/[\s,]+/).filter(Boolean), beats };
    if (v('direction') !== undefined) s.direction = v('direction');
    return s;
  }

  /* ── les boutons ── */
  const ACTIONS = {
    recharger() { location.reload(); },
    menu() { S.menu = !S.menu; const b = $('.barre'); if (b) b.outerHTML = barreHtml(route().vue); },
    async basculerNuit() {
      const nuit = !estNuit();
      S.moi.reglages.theme.mode = nuit ? 'nuit' : 'jour';
      appliquerTheme(); majVille();
      const b = $('.barre'); if (b) b.outerHTML = barreHtml(route().vue);
      try { await agir('reglages', { reglages: { theme: { mode: nuit ? 'nuit' : 'jour' } } }); } catch (e) { /* l'affichage a changé, l'enregistrement reviendra */ }
    },
    replier() { S.salutReplie = !S.salutReplie; const s = $('#salut'); if (s) s.outerHTML = salutHtml(); },
    fil() { S.filOuvert = !S.filOuvert; S.fil.forEach((x) => { x.frais = false; }); const f = $('#fil'); if (f) f.outerHTML = filHtml(); },
    vueZoom(b) { if (S.ville) S.ville.zoomer(Number(b.dataset.k) || 1); },
    vueTourner() { if (S.ville) S.ville.tourner(45); },
    vueCentre() { if (S.ville) S.ville.regarder(null); },
    regarderScene() { if (S.ville && S.evenement && S.evenement.focus) S.ville.regarder(S.evenement.focus); const x = $('#evenement'); if (x) x.hidden = true; },
    fermerFiche() { fermerFiche(); },
    visiteSuivante() { if (S.visite == null) return; if (S.visite >= VISITE.length - 1) { finirVisite(); return; } let i = S.visite + 1; while (i < VISITE.length - 1 && VISITE[i]().passe) i++; ouvrirVisite(i); },
    visiteFin() { finirVisite(); },
    visiteSortie() { finirVisite(); },
    visiteMontrer() { if (S.ville) { S.ville.scene('accident'); } finirVisite(); },
    revoirVisite() { S.menu = false; if (route().vue !== 'accueil') { location.hash = '#accueil'; setTimeout(() => ouvrirVisite(0), 400); } else ouvrirVisite(0); },
    filtre(b) { S.filtre = b.dataset.f; $('#contenu').innerHTML = vueVideos(); },
    prendreExemple() { const m = (S.cat.modeles || {})[S.modele]; const t = $('textarea[name="sujet"]'); if (m && t) { t.value = m.exemple; t.focus(); } },
    async ideeChoisir(b) {
      if (!S.moi.connexions.claude.branchee) { toast('Branche d\'abord ta clé Claude.', 'err'); location.hash = '#reglages/connexions'; return; }
      await occupe(b, async () => { const r = await agir('creer', { idee_id: b.dataset.id, modele: S.modele || null }); await rafraichirMoi(); S.video = r.video; S.videos = null; location.hash = '#video/' + r.video.id; });
    },
    async ideeOublier(b) { await occupe(b, async () => { await agir('idee_oublier', { id: b.dataset.id }); $('#contenu').innerHTML = vueCreer(); }); },
    async scriptEnregistrer(b) { const f = b.closest('form'); await occupe(b, async () => { const r = await agir('modifier', { id: S.video.id, script: scriptDe(f) }); S.video = r.video; toast('Retouches enregistrées.', 'ok'); }); },
    async reecrire(b) {
      const c = ($('#consigne') || {}).value || '';
      const clip = estClip(S.video);
      await occupe(b, async () => { const r = await agir('reecrire', { id: S.video.id, consigne: c }); S.planOuvert = null; majVideo(r.video); suivre(S.video.id); toast(clip ? membre('realisation').prenom + ' redécoupe ton prompt.' : membre('plume').prenom + ' réécrit le script.', 'ok'); });
    },
    /* un clip */
    ouvrirPlan(b) {
      S.planOuvert = Number(b.dataset.i);
      const c = $('#v-corps'); if (c) c.innerHTML = corpsVideo(S.video);
      const ed = $('#editeur-plan'); if (ed) { ed.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); const t = $('textarea', ed); if (t) t.focus({ preventScroll: true }); }
    },
    fermerPlan() { S.planOuvert = null; const c = $('#v-corps'); if (c) c.innerHTML = corpsVideo(S.video); },
    voirPlan(b) {
      const i = Number(b.dataset.i), cl = S.video.plan.clip;
      const j = ((cl.gen || {}).videos || [])[i];
      if (j && j.url) voirVideo(j.url, 'Plan ' + (i + 1) + ' : ' + ((cl.storyboard.plans[i] || {}).resume || ''));
    },
    async clipPlanEnregistrer(b) {
      const f = b.closest('form'), d = lireForm(f);
      await occupe(b, async () => {
        const r = await agir('clip_plan', { id: S.video.id, i: Number(f.dataset.i), image: d.image, mouvement: d.mouvement, son: d.son, duree: d.duree, effet: d.effet });
        if (r.video.status !== 'relecture') S.planOuvert = null;
        majVideo(r.video);
        if (r.video.status !== 'relecture') { suivre(S.video.id); toast('Enregistré : la première image a changé, ' + membre('realisation').prenom + ' la refait.', 'ok'); } else toast('Plan enregistré.', 'ok');
      });
    },
    async clipPlanRetirer(b) {
      const f = b.closest('form'), i = Number(f.dataset.i);
      if (!(await fenetre({ titre: 'Retirer le plan ' + (i + 1) + ' ?', texte: 'Il ne sera ni filmé ni monté. Son image est perdue.', ok: 'Retirer', danger: true }))) return;
      await occupe(b, async () => { const r = await agir('clip_plan', { id: S.video.id, i, retirer: true }); S.planOuvert = null; majVideo(r.video); toast('Plan retiré.', 'ok'); });
    },
    async clipRef(b) {
      const cl = S.video.plan.clip, e = (cl.storyboard.elements || []).find((x) => x.id === b.dataset.e) || {};
      const n = 1 + cl.storyboard.plans.filter((p) => p.elements.indexOf(e.id) >= 0).length;
      const consigne = await fenetre({ titre: 'Refaire ' + (e.nom || 'cet élément') + ' ?', texte: 'Sa nouvelle image, puis les ' + (n - 1) + ' plans où il apparaît : environ ' + usd(n * prixImageClip(cl)) + ' sur ta clé fal. Une consigne, si tu veux :', saisie: 'Plus brillant, une cape rouge, plus grand', ok: 'Refaire' });
      if (consigne === null) return;
      await occupe(b, async () => { const r = await agir('clip_reference', { id: S.video.id, element: e.id, consigne }); majVideo(r.video); suivre(S.video.id); });
    },
    async tourner(b) {
      const cl = S.video.plan.clip;
      if (!(await fenetre({ titre: 'Tourner le clip ?', texte: 'Environ ' + usd(cl.a_payer) + ' sur ta clé fal. Les plans tournent en même temps : compte 2 à 5 minutes, puis le montage.', ok: 'Tourner' }))) return;
      await occupe(b, async () => { const r = await agir('valider', { id: S.video.id, accepte: cl.a_payer }); S.planOuvert = null; majVideo(r.video); suivre(S.video.id); toast(membre('realisation').prenom + ' tourne ton clip.', 'ok'); });
    },
    async clipBudget(b) {
      const cl = S.video.plan.clip;
      if (!(await fenetre({ titre: 'Accepter ' + usd(cl.a_payer) + ' de plus ?', texte: 'C\'est ce qu\'il reste à payer sur ta clé fal pour finir ce clip.', ok: 'Accepter' }))) return;
      await occupe(b, async () => { const r = await agir('clip_budget', { id: S.video.id, accepte: cl.a_payer }); majVideo(r.video); suivre(S.video.id); });
    },
    async reprendre(b) { await occupe(b, async () => { const r = await agir('reprendre', { id: S.video.id }); majVideo(r.video); suivre(S.video.id); }); },
    async refaire(b) {
      const ia = ((S.video || {}).plan || {}).style === 'ia';
      const voix = voixNaturelle() ? ' Les phrases déjà dites par ta voix naturelle sont reprises ; une nouvelle voix, ou une phrase changée, se paie sur ta clé fal (environ ' + usd(coutVoix(((S.video || {}).plan || {}).format || S.moi.reglages.format, ((S.video || {}).langues || []).length || 1)) + ' pour tout redire).' : '';
      if (!(await fenetre({ titre: 'Refaire le montage ?', texte: ia ? 'Avec tes réglages actuels (couleur, musique, voix). Les images IA de moins de 6 jours sont reprises sans rien payer ; les plus vieilles, ou celles qui avaient raté, sont refaites sur ta clé fal.' + voix : 'Avec tes réglages actuels (couleur, musique, voix) et de nouvelles images : Lou relit les vidéos de chaque phrase (moins d\'un centime sur ta clé Claude)' + (S.moi.connexions.fal.branchee ? ' et fait créer une image là où aucune ne colle (1,6 centime chacune).' : '.') + voix, ok: 'Refaire' }))) return;
      await occupe(b, async () => { const r = await agir('refaire', { id: S.video.id }); S.partage = {}; majVideo(r.video); suivre(S.video.id); });
    },
    async archiver(b) { await occupe(b, async () => { await agir('archiver', { id: S.video.id }); S.videos = null; location.hash = '#videos'; toast('Vidéo archivée.', 'ok'); }); },
    async supprimer(b) {
      if (!(await fenetre({ titre: 'Supprimer cette vidéo ?', texte: 'Le script et les fichiers sont effacés pour de bon.', ok: 'Supprimer', danger: true }))) return;
      await occupe(b, async () => { await agir('supprimer', { id: S.video.id }); S.video = null; S.videos = null; location.hash = '#videos'; toast('Vidéo supprimée.', 'ok'); });
    },
    onglet(b) { S.onglet[S.video.id] = b.dataset.l; $('#v-corps').innerHTML = corpsVideo(S.video); },
    async partager(b) {
      const v = S.video, l = b.dataset.l, k = v.id + l;
      const t = textePub(v, l);
      if (!S.partage[k]) {
        // d'abord la vidéo dans le téléphone, puis le partage (le navigateur exige un geste juste avant)
        await occupe(b, async () => {
          const u = ((v.liens || {})[l] || {})['video.mp4'];
          const r = await fetch(u);
          if (!r.ok) throw new Error('La vidéo ne se télécharge pas : recharge la page.');
          const f = new File([await r.blob()], 'video-' + l + '.mp4', { type: 'video/mp4' });
          if (!navigator.canShare({ files: [f] })) throw new Error('Ton navigateur ne sait pas partager une vidéo : utilise Télécharger.');
          S.partage[k] = f;
        });
        if (S.partage[k]) { b.lastChild.textContent = 'Partager maintenant'; toast('Prête : touche encore Partager.', 'ok'); }
        return;
      }
      try { await navigator.share({ files: [S.partage[k]], title: t.titre, text: legende(t) }); }
      catch (e) { if (e && e.name !== 'AbortError') toast('Partage impossible : utilise Télécharger.', 'err'); }
    },
    async copierTexte(b) {
      const t = textePub(S.video, b.dataset.l);
      try { await navigator.clipboard.writeText([t.titre, legende(t)].filter(Boolean).join('\n\n')); toast('Texte copié.', 'ok'); }
      catch (e) { toast('Copie impossible : sélectionne le texte à la main.', 'err'); }
    },
    async publier(b) {
      await occupe(b, async () => { const r = await agir('publier', { id: S.video.id }); majVideo(r.video); suivre(S.video.id); toast(membre('diffusion').prenom + ' publie ta vidéo.', 'ok'); });
    },
    async marquer(b) {
      const lien = await fenetre({ titre: 'Publiée sur ' + S.cat.plateformes[b.dataset.p] + ' ?', texte: 'Colle le lien de la publication si tu veux le retrouver ici (facultatif).', saisie: 'https://…', ok: 'C\'est publié' });
      if (lien === null) return;
      await occupe(b, async () => { const r = await agir('marquer_publiee', { id: S.video.id, langue: b.dataset.l, plateforme: b.dataset.p, lien: lien || null }); majVideo(r.video); toast('Noté.', 'ok'); });
    },
    nuance(b) {
      const n = b.closest('[data-nuancier]');
      $$('button', n).forEach((x) => x.classList.toggle('on', x === b));
      const i = $('input[type="color"]', n); if (i) i.value = b.dataset.c.toLowerCase();
      if (n.dataset.nuancier === 'theme.accent') document.documentElement.style.setProperty('--accent', b.dataset.c);
    },
    async cleClaudeRetirer(b) {
      if (!(await fenetre({ titre: 'Retirer ta clé Claude ?', texte: 'Ton équipe s\'arrête jusqu\'à ce que tu en colles une autre.', ok: 'Retirer', danger: true }))) return;
      await occupe(b, async () => { await agir('cle_claude_supprimer'); rendre(); });
    },
    async cleFalRetirer(b) {
      if (!(await fenetre({ titre: 'Retirer ta clé fal ?', texte: 'Les vidéos au look Images IA attendront une nouvelle clé (ou continueront avec des vidéos d\'illustration si tu le choisis).', ok: 'Retirer', danger: true }))) return;
      await occupe(b, async () => { await agir('cle_fal_supprimer'); rendre(); });
    },
    async sansIa(b) {
      const ia = ((S.video || {}).plan || {}).style === 'ia';
      if (!(await fenetre(ia
        ? { titre: 'Continuer sans images IA ?', texte: 'Cette vidéo prend des vidéos d\'illustration à la place (offertes) et la voix gratuite, puis part au montage. Les images IA déjà faites restent sur ton compte fal.', ok: 'Continuer' }
        : { titre: 'Continuer avec la voix gratuite ?', texte: 'Cette vidéo part au montage sans passer par fal : la voix gratuite de chaque langue, et le fond animé là où aucune vidéo ne colle.', ok: 'Continuer' }))) return;
      await occupe(b, async () => { const r = await agir('sans_ia', { id: S.video.id }); majVideo(r.video); suivre(S.video.id); });
    },
    retirerPiece(b) { S.conv.pieces.splice(Number(b.dataset.i), 1); const p = $('#conv-pieces'); if (p) p.innerHTML = piecesChoisiesHtml(); },
    async envoyerALouis(b) {
      await occupe(b, async () => { await agir('message', { video: { id: S.video.id, langue: b.dataset.l } }); toast('Envoyée à Louis : il la voit dans vos messages.', 'ok'); });
    },
    // écouter une voix naturelle : une phrase dans sa langue principale, sur sa clé fal ; le lecteur reste sous les voix
    async ecouterVoix(b) {
      const voix = b.dataset.voix;
      await occupe(b, async () => {
        const r = await agir('ecouter_voix', { voix, langue: S.moi.reglages.langue_source });
        const z = $('#ecoute');
        if (!z) return;
        const nom = ((S.cat.voix_ia || {}).voix || {})[voix] || {};
        z.hidden = false;
        z.innerHTML = '<span class="petit">' + h(nom.nom || voix) + ' en ' + h(nomLangue(S.moi.reglages.langue_source).toLowerCase()) + '</span><audio controls autoplay preload="auto" src="' + h(r.url) + '"></audio>';
        const a = $('audio', z);
        if (a) a.play().catch(() => { /* la lecture automatique peut être refusée : le lecteur est là */ });
      });
    },
    async upConnecter(b) { await occupe(b, async () => { const r = await agir('uploadpost_connecter', { profil: b.dataset.profil }); location.href = r.url; }); },
    async upRafraichir(b) { await occupe(b, async () => { await agir('uploadpost_profils'); rendre(); toast('Profils à jour.', 'ok'); }); },
    async upRetirer(b) {
      if (!(await fenetre({ titre: 'Retirer upload-post ?', texte: 'Tes vidéos ne se publieront plus toutes seules. Tes comptes restent reliés chez upload-post.', ok: 'Retirer', danger: true }))) return;
      await occupe(b, async () => { await agir('uploadpost_supprimer'); rendre(); });
    },
    async deconnexion(b) { await occupe(b, async () => { await agir('deconnexion'); S.moi = null; S.videos = null; S.video = null; S.statuts = null; S.fil = []; S.menu = false; if (S.ville) { S.ville.detruire(); S.ville = null; } location.hash = ''; rendre(); }); },
    async partout(b) {
      if (!(await fenetre({ titre: 'Déconnecter tous tes appareils ?', texte: 'Y compris celui-ci : tu devras te reconnecter partout.', ok: 'Tout déconnecter' }))) return;
      await occupe(b, async () => { await agir('deconnexion', { partout: true }); S.moi = null; if (S.ville) { S.ville.detruire(); S.ville = null; } location.hash = ''; rendre(); });
    }
  };
  async function rafraichirMoi() { try { const d = await lire('moi'); S.moi = d.moi; } catch (e) { /* la page reste comme elle est */ } }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (S.menu && !e.target.closest('.compte')) { S.menu = false; const br = $('.barre'); if (br) br.outerHTML = barreHtml(route().vue); }
    if (!b || !ACTIONS[b.dataset.a]) return;
    if (b.tagName === 'A' && b.getAttribute('href') && b.getAttribute('href') !== '#') { ACTIONS[b.dataset.a](b, e); return; }
    e.preventDefault();
    ACTIONS[b.dataset.a](b, e);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (S.menu) ACTIONS.menu(); else if (S.fiche) fermerFiche(); } });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f || !FORMS[f.dataset.form]) return;
    e.preventDefault();
    FORMS[f.dataset.form](f, $('button[type="submit"]', f) || e.submitter);
  });
  // l'aperçu en direct : un prénom ou une couleur d'équipe, le budget, une couleur, le modèle choisi, la recherche de langue
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name !== 'fichiers' || !t.closest('[data-form="message"]')) return;
    const trop = Array.from(t.files || []).filter((f) => f.size > 200 * 1048576);
    if (trop.length) toast(trop.map((f) => f.name).join(', ') + ' : trop lourd (200 Mo au plus).', 'err');
    S.conv.pieces = S.conv.pieces.concat(Array.from(t.files || []).filter((f) => f.size <= 200 * 1048576)).slice(0, 6);
    t.value = '';
    const p = $('#conv-pieces'); if (p) p.innerHTML = piecesChoisiesHtml();
  });
  document.addEventListener('keydown', (e) => {
    // Entrée envoie sur ordinateur, Maj + Entrée va à la ligne ; sur téléphone, Entrée va à la ligne
    const t = e.target;
    if (e.key === 'Enter' && !e.shiftKey && t.name === 'texte' && t.closest('[data-form="message"]') && matchMedia('(hover: hover) and (pointer: fine)').matches) { e.preventDefault(); t.form.requestSubmit(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.name === 'texte' && t.closest('[data-form="message"]')) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
    // un clip : le genre choisi (vidéo racontée ou clip), puis le formulaire du clip ou du remontage, qui a ses propres
    // aperçus (sa qualité n'est pas celle de l'écriture)
    if (t.name === 'genre' && t.closest('.genres')) { S.genreCreer = t.value; memoire.ecrire('genre', t.value); const c = $('#contenu'); if (c) c.innerHTML = vueCreer(); return; }
    const formClip = t.closest && t.closest('form[data-form="clip"], form[data-form="remonter"], form[data-form="clipPlan"]');
    if (formClip) { if (S.cat && formClip.dataset.form !== 'clipPlan') majClip(formClip); return; }
    if (t.dataset && t.dataset.apercu) {
      const carte = t.closest('.membre-carte');
      const av = carte && $('.agent', carte);
      if (av) { const p = $('input[name$=".prenom"]', carte).value, c = $('input[name$=".couleur"]', carte).value; av.textContent = (p || '?').charAt(0).toUpperCase(); av.style.setProperty('--c', c); }
    }
    if (t.name === 'budget_jour') { const o = $('#budgetVal'); if (o) o.textContent = usd(t.value); }
    if (t.type === 'color' && t.closest('[data-nuancier]')) { const n = t.closest('[data-nuancier]'); $$('button', n).forEach((x) => x.classList.toggle('on', x.dataset.c.toLowerCase() === t.value.toLowerCase())); if (n.dataset.nuancier === 'theme.accent') document.documentElement.style.setProperty('--accent', t.value); }
    if (t.name === 'qualite' && S.cat) { const s = t.closest('.champ'); const sm = s && $('small', s); if (sm) sm.textContent = (S.cat.qualites[t.value] || {}).explication || ''; }
    if (['style', 'format', 'ia.mouvement', 'ia.style'].indexOf(t.name) >= 0 && S.cat) majLook(t.closest('form'));
    if (t.name === 'modele') {
      S.modele = t.value;
      const m = (S.cat.modeles || {})[t.value], ta = $('textarea[name="sujet"]'), aide = $('#aideIdee');
      if (ta) ta.placeholder = m ? m.exemple : 'Pourquoi on a toujours froid aux pieds la nuit';
      if (aide) aide.innerHTML = m ? 'Par exemple : « ' + h(m.exemple) + ' ». <a href="#" data-a="prendreExemple">Prendre cet exemple</a>' : 'Une phrase suffit.';
    }
    if (t.dataset && t.dataset.filtreLangues != null) {
      const q = t.value.trim().toLowerCase();
      $$('label[data-nom]', t.parentNode).forEach((l) => l.classList.toggle('masque', !!q && l.dataset.nom.indexOf(q) < 0 && !$('input', l).checked));
    }
    if (t.name === 'langues[]') { const n = $$('input[name="langues[]"]:checked', t.closest('form')).length; if (n > 6) { t.checked = false; toast('Six langues au plus par vidéo.', 'err'); } if (S.cat) majLook(t.closest('form')); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.moi && route().vue === 'video' && S.video) suivre(S.video.id); if (!document.hidden && S.moi && route().vue === 'accueil') chargerVideos(true); });
  // la nuit tombe (ou le jour se lève) pendant qu'elle est là
  setInterval(() => { if (!S.moi || (S.moi.reglages.theme.mode || 'auto') !== 'auto') return; const avant = document.documentElement.dataset.theme; appliquerTheme(); if (document.documentElement.dataset.theme !== avant) { majVille(); const b = $('.barre'); if (b) b.outerHTML = barreHtml(route().vue); } }, 60000);

  setInterval(verifierMessages, 20000);
  async function demarrer() {
    S.genreCreer = memoire.lire('genre', 'video');
    S.brouillonClip = memoire.lire('brouillonClip', null);
    try { const d = await lire('etat'); S.cat = d.catalogue; S.moi = d.moi; }
    catch (e) { $('#app').innerHTML = '<div class="porte"><div class="porte-c verre"><h1>Le studio ne répond pas</h1><p class="sous">' + h(e.message) + '</p><button class="btn" data-a="recharger">Réessayer</button></div></div>'; return; }
    rendre();
  }
  demarrer();
})();
