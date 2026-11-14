// Le studio d'une créatrice : de l'idée à la vidéo publiée, avec son équipe. Une page, sans dépendance.
// Les vues : la porte (connexion, invitation), l'accueil, créer, ses vidéos, une vidéo, son équipe, ses réglages.
// Une vidéo en route avance quand la page la regarde (une étape à la fois, voir lib/createurs/chaine.js) et toute
// seule le reste du temps.
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const S = { moi: null, cat: null, videos: null, filtre: 'tout', video: null, sigCorps: '', onglet: {}, partage: {}, mayaCherche: false, boucle: 0, chargement: false };

  /* ── petits outils ── */
  const I = {
    accueil: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    creer: '<path d="M12 5v14M5 12h14"/>',
    videos: '<rect x="4" y="3" width="7" height="12" rx="2"/><rect x="13" y="9" width="7" height="12" rx="2"/>',
    equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.8 14.6c2.2.3 3.8 1.9 4.5 4.4"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    retour: '<path d="M15 18l-6-6 6-6"/>',
    telecharger: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    partager: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
    copier: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    ouvrir: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    lecture: '<path d="M8 5.5v13l11-6.5z"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  const ico = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[n] || '') + '</svg>';
  const usd = (n) => { n = Number(n) || 0; if (n > 0 && n < 0.01) return 'moins d\'un centime'; return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $'; };
  const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '');
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
  const avatar = (role, cls, travaille) => { const m = membre(role); return '<span class="agent ' + (cls || '') + (travaille ? ' travaille' : '') + '" style="--c:' + h(m.couleur) + '" title="' + h(m.prenom) + '">' + h(String(m.prenom || '?').charAt(0).toUpperCase()) + '</span>'; };

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

  /* ── le thème : ses couleurs ── */
  function appliquerTheme() {
    const r = S.moi ? S.moi.reglages : {};
    const t = r.theme || {};
    const root = document.documentElement;
    root.dataset.mode = t.mode || 'sombre';
    root.style.setProperty('--accent', t.accent || '#8B5CF6');
    root.style.setProperty('--sur-accent', clair(t.accent) ? '#16121F' : '#FFFFFF');
    root.style.setProperty('--video', r.couleur || '#FF5A8A');
    const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.mode === 'clair' ? '#F5F3F9' : '#16121F');
  }

  /* ── la navigation ── */
  function route() {
    const x = location.hash.replace(/^#/, '');
    if (x.indexOf('invitation=') === 0) return { vue: 'invitation', arg: x.slice(11) };
    const p = x.split('/');
    const vue = ['accueil', 'creer', 'videos', 'video', 'equipe', 'reglages', 'connexions'].indexOf(p[0]) >= 0 ? p[0] : 'accueil';
    return vue === 'connexions' ? { vue: 'reglages', arg: 'connexions' } : { vue, arg: p[1] || '' };
  }
  window.addEventListener('hashchange', () => { S.boucle++; rendre(); window.scrollTo(0, 0); });

  function jaugeHtml() {
    const d = S.moi.depense;
    const k = Math.max(0, Math.min(1, d.budget ? d.jour / d.budget : 0));
    const c = 2 * Math.PI * 12;
    return '<a class="jauge" href="#reglages/budget" title="Dépense du jour sur ta clé Claude"><svg viewBox="0 0 30 30"><circle class="fond" cx="15" cy="15" r="12" fill="none" stroke-width="3"/><circle class="plein" cx="15" cy="15" r="12" fill="none" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - k)).toFixed(1) + '"/></svg><span>' + h(usd(d.jour)) + '<br>sur ' + h(usd(d.budget)) + '</span></a>';
  }
  function coque(vue, corps) {
    const r = S.moi.reglages;
    const nav = [['accueil', 'Accueil', 'accueil'], ['creer', 'Créer', 'creer'], ['videos', 'Vidéos', 'videos'], ['equipe', 'Équipe', 'equipe'], ['reglages', 'Réglages', 'reglages']];
    const actif = vue === 'video' ? 'videos' : vue;
    return '<div class="coque"><header class="entete"><span class="agent petit" style="--c:var(--accent)">' + h((r.chaine.nom || S.moi.prenom || '?').charAt(0).toUpperCase()) + '</span>' +
      '<div class="chaine"><b>' + h(r.chaine.nom || 'Le studio de ' + S.moi.prenom) + '</b><span>' + h(r.langues.map(nomLangue).join(', ')) + '</span></div>' + jaugeHtml() + '</header>' +
      '<nav class="nav" aria-label="Le studio">' + nav.map((n) => '<a href="#' + n[0] + '" class="' + (n[0] === 'creer' ? 'creer ' : '') + (actif === n[0] ? 'on' : '') + '"' + (actif === n[0] ? ' aria-current="page"' : '') + '>' + ico(n[2]) + '<span>' + n[1] + '</span></a>').join('') + '</nav>' +
      '<main id="contenu">' + corps + '</main></div>';
  }

  function rendre() {
    const r = route();
    if (r.vue === 'invitation') return vueInvitation(r.arg);
    if (!S.cat) return;
    if (!S.moi) return vueConnexion();
    appliquerTheme();
    let corps;
    if (r.vue === 'creer') corps = vueCreer();
    else if (r.vue === 'videos') corps = vueVideos();
    else if (r.vue === 'video') corps = vueVideo(r.arg);
    else if (r.vue === 'equipe') corps = vueEquipe();
    else if (r.vue === 'reglages') corps = vueReglages(r.arg || 'chaine');
    else corps = vueAccueil();
    $('#app').innerHTML = coque(r.vue, corps);
    apres(r);
  }
  // ce qui se charge après l'affichage (les listes, la vidéo, le suivi)
  function apres(r) {
    if (r.vue === 'reglages') { const a = $('.reglages-nav a.on'); if (a && a.scrollIntoView) a.scrollIntoView({ inline: 'center', block: 'nearest' }); }
    if ((r.vue === 'accueil' || r.vue === 'videos') && !S.chargement) chargerVideos();
    if (r.vue === 'video') { if (!S.video || String(S.video.id) !== String(r.arg)) chargerVideo(r.arg); else suivre(r.arg); }
  }
  async function chargerVideos(silencieux) {
    S.chargement = true;
    try { const d = await lire('videos'); S.videos = d.videos || []; } catch (e) { if (!silencieux) toast(e.message, 'err'); }
    finally { S.chargement = false; }
    const r = route();
    if (r.vue === 'accueil' || r.vue === 'videos') { const c = $('#contenu'); if (c) c.innerHTML = r.vue === 'accueil' ? vueAccueil() : vueVideos(); }
    // une vidéo en route : la liste se rafraîchit toute seule
    if ((r.vue === 'accueil' || r.vue === 'videos') && (S.videos || []).some((v) => S.cat.automatiques.indexOf(v.status) >= 0)) {
      const moi = ++S.boucle;
      await dormir(20000);
      if (moi === S.boucle && !document.hidden) chargerVideos(true);
    }
  }

  /* ── la porte ── */
  function porte(contenu) { $('#app').innerHTML = '<div class="porte"><div class="porte-c"><div class="marque"><span class="tel" aria-hidden="true"></span></div>' + contenu + '</div></div>'; }
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

  /* ── l'accueil ── */
  const TON = { ecriture: 'vif', relecture: 'attention', langues: 'vif', realisation: 'vif', fabrication: 'vif', prete: 'ok', publication: 'vif', publiee: 'ok', echec: 'alerte', archivee: '' };
  function cadre(v) {
    const fond = v.vignette ? '<img src="' + h(v.vignette) + '" alt="" loading="lazy"><span class="voile"></span>' : '';
    const e = v.etape || {};
    const ton = e.erreur ? 'alerte' : TON[v.status] || '';
    return '<a class="cadre" href="#video/' + v.id + '">' + fond + '<span class="accroche">' + forts(v.accroche || v.titre || '') + '</span><span class="pied"><span class="pastille ' + ton + '">' + h(e.erreur ? 'À regarder' : v.statut) + '</span><small>' + h(v.langues.map((l) => l.toUpperCase()).join(' ')) + '</small></span></a>';
  }
  function etapesDepart() {
    const m = S.moi, r = m.reglages;
    return [
      { fait: !!r.chaine.sujets, titre: 'Décris ta chaîne', texte: 'Tes sujets, ton public, ton ton : toute l\'équipe s\'en sert.', lien: '#reglages/chaine' },
      { fait: m.connexions.claude.branchee && m.connexions.claude.etat === 'ok', titre: 'Branche ta clé Claude', texte: 'C\'est elle qui fait travailler ton équipe, dans le budget que tu choisis. Le pas à pas prend 5 minutes.', lien: '#reglages/connexions' },
      { fait: (S.videos || []).length > 0, titre: 'Lance ta première vidéo', texte: 'Une idée en une phrase suffit.', lien: '#creer' },
      { fait: m.connexions.uploadpost.branchee, titre: 'Publication automatique', texte: 'Facultatif : sinon tu publies depuis ton téléphone en quelques secondes.', lien: '#reglages/connexions', facultatif: true }
    ];
  }
  function activiteEquipe() {
    const vids = (S.videos || []).filter((v) => S.cat.automatiques.indexOf(v.status) >= 0 && !(v.etape || {}).erreur).slice(0, 4);
    const qui = { ecriture: 'plume', langues: 'traduction', realisation: 'realisation', fabrication: 'realisation', publication: 'diffusion' };
    const quoi = (v) => {
      if (v.status === 'ecriture') return v.etape.quoi === 'critique' ? membre('critique').prenom + ' relit' : membre('plume').prenom + (v.etape.quoi === 'reecriture' ? ' réécrit' : ' écrit');
      if (v.status === 'langues') return membre('traduction').prenom + ' adapte';
      if (v.status === 'realisation') return membre('realisation').prenom + ' choisit les images de';
      if (v.status === 'fabrication') return 'Montage de';
      return membre('diffusion').prenom + ' publie';
    };
    if (!vids.length) return '';
    return '<div class="equipe-activite">' + vids.map((v) => { const role = v.status === 'ecriture' && v.etape.quoi === 'critique' ? 'critique' : qui[v.status]; return '<a href="#video/' + v.id + '">' + avatar(role, 'petit', true) + '<span><b>' + h(quoi(v)) + '</b> « ' + h(sansEtoiles(v.titre)) + ' »</span></a>'; }).join('') + '</div>';
  }
  function vueAccueil() {
    const m = S.moi;
    const vids = S.videos;
    const etapes = etapesDepart();
    const reste = etapes.filter((x) => !x.fait && !x.facultatif).length;
    const aValider = (vids || []).filter((v) => v.status === 'relecture').length;
    const pretes = (vids || []).filter((v) => v.status === 'prete').length;
    let phrase = 'Ton équipe est prête.';
    if (aValider) phrase = aValider > 1 ? aValider + ' scripts t\'attendent.' : 'Un script t\'attend.';
    else if (pretes) phrase = pretes > 1 ? pretes + ' vidéos sont prêtes à publier.' : 'Une vidéo est prête à publier.';
    else if (reste) phrase = 'Encore ' + reste + ' étape' + (reste > 1 ? 's' : '') + ' et ton équipe se met au travail.';
    let x = '<div class="intro"><h1>Salut ' + h(m.prenom) + '</h1><p>' + h(phrase) + '</p></div>';
    if (reste || !m.connexions.uploadpost.branchee && !(vids || []).length) {
      x += '<section class="section"><header><h2>Pour commencer</h2><p>' + etapes.filter((e) => e.fait).length + ' sur ' + etapes.length + '</p></header><div class="bloc"><ol class="tuto">' + etapes.map((e) =>
        '<li style="' + (e.fait ? 'opacity:.55' : '') + '"><b>' + h(e.titre) + (e.fait ? ' : fait' : '') + '</b><p>' + h(e.texte) + '</p>' + (e.fait ? '' : '<a class="lien" href="' + e.lien + '">' + (e.facultatif ? 'Voir comment' : 'C\'est parti') + '</a>') + '</li>').join('') + '</ol></div></section>';
    }
    const enCours = (vids || []).filter((v) => ['archivee', 'publiee'].indexOf(v.status) < 0).slice(0, 10);
    x += '<section class="section"><header><h2>Tes vidéos</h2>' + ((vids || []).length ? '<a class="btn discret petit" href="#videos">Tout voir</a>' : '') + '</header>' +
      (vids === null ? '<div class="cadres defile"><div class="cadre-vide"></div><div class="cadre-vide"></div></div>' : '<div class="cadres defile">' + enCours.map(cadre).join('') + '<a class="cadre nouveau" href="#creer"><span>' + ico('creer') + 'Nouvelle vidéo</span></a></div>') + '</section>';
    x += '<section class="section"><header><h2>Ton équipe</h2><a class="btn discret petit" href="#equipe">Personnaliser</a></header><div class="bloc"><div class="equipe-rang">' +
      S.cat.ordre.map((k) => { const mb = membre(k); return '<div class="membre">' + avatar(k) + '<b>' + h(mb.prenom) + '</b><small>' + h(mb.metier) + '</small></div>'; }).join('') + '</div>' + activiteEquipe() + '</div></section>';
    return x;
  }

  /* ── créer ── */
  function choixLangues(nom, coches) {
    return '<div class="choix">' + Object.keys(S.cat.langues).map((l) => '<label><input type="checkbox" name="' + nom + '" value="' + l + '"' + (coches.indexOf(l) >= 0 ? ' checked' : '') + (l === S.moi.reglages.langue_source ? ' data-source="1"' : '') + '><span>' + h(nomLangue(l)) + '</span></label>').join('') + '</div>';
  }
  function radios(nom, options, valeur) { return '<div class="choix">' + options.map((o) => '<label><input type="radio" name="' + nom + '" value="' + h(o[0]) + '"' + (o[0] === valeur ? ' checked' : '') + '><span>' + h(o[1]) + (o[2] ? ' <small>' + h(o[2]) + '</small>' : '') + '</span></label>').join('') + '</div>'; }
  function carteIdee(i) {
    return '<article class="idee"><h3>' + h(i.titre) + '</h3>' + (i.accroche ? '<blockquote>' + forts(i.accroche) + '</blockquote>' : '') + '<p>' + h(i.angle) + '</p>' + (i.pourquoi ? '<p class="pourquoi">' + h(i.pourquoi) + '</p>' : '') +
      '<div class="actions"><button class="btn petit" data-a="ideeChoisir" data-id="' + h(i.id) + '">Faire cette vidéo</button><button class="btn discret petit" data-a="ideeOublier" data-id="' + h(i.id) + '">Oublier</button></div></article>';
  }
  function vueCreer() {
    const r = S.moi.reglages;
    const q = S.cat.qualites[r.qualite] || {};
    let x = '<div class="intro"><h1>Nouvelle vidéo</h1><p>Donne une idée à ton équipe, ou demande-lui des idées.</p></div>';
    if (!S.moi.connexions.claude.branchee) x += '<div class="message attention" style="margin-bottom:18px"><b>Ta clé Claude n\'est pas encore branchée</b>Ton équipe ne peut pas écrire sans elle.<div class="actions"><a class="btn petit" href="#reglages/connexions">Brancher ma clé</a></div></div>';
    x += '<form class="bloc" data-form="creer"><label class="champ"><span>Ton idée</span><textarea name="sujet" rows="3" maxlength="600" placeholder="Pourquoi on a toujours froid aux pieds la nuit"></textarea><small>Une phrase suffit. ' + h(membre('plume').prenom) + ' écrit le script, ' + h(membre('critique').prenom) + ' le relit, puis tu le valides.</small></label>' +
      '<div class="champ"><span>Langues</span>' + choixLangues('langues[]', r.langues) + '<small>La version en ' + h(nomLangue(r.langue_source).toLowerCase()) + ' s\'écrit d\'abord ; ' + h(membre('traduction').prenom) + ' adapte les autres.</small></div>' +
      '<div class="champ"><span>Durée</span>' + radios('format', [['court', '35 à 50 secondes'], ['long', 'Plus d\'une minute', 'payée par TikTok']], r.format) + '</div>' +
      '<div class="champ"><span>Images</span>' + radios('style', [['clips', 'Vidéos d\'illustration'], ['texte', 'Texte animé']], r.style) + '</div>' +
      '<button class="btn large" type="submit">Lancer l\'équipe</button><p class="doux petit" style="margin-top:10px">Environ ' + h(usd(S.moi.depense.estime_video)) + ' sur ta clé en qualité ' + h((q.nom || '').toLowerCase()) + '.</p></form>';
    x += '<section class="section" style="margin-top:30px"><header><h2>Pas d\'idée ?</h2></header><div class="bloc"><div class="ligne" style="margin-bottom:14px">' + avatar('idees', 'grand', S.mayaCherche) + '<div class="plein"><h3>' + h(membre('idees').prenom) + ' te propose 5 idées</h3><p class="doux petit">' + (r.tendances ? 'Elle regarde d\'abord ce dont on parle cette semaine dans ta niche. ' : '') + 'Quelques centimes sur ta clé.</p></div></div>' +
      '<form data-form="idees"><label class="champ"><span>Un thème ?</span><input type="text" name="theme" maxlength="200" placeholder="Facultatif : la rentrée, les plantes, les entretiens d\'embauche"></label><button class="btn second large" type="submit"' + (S.mayaCherche ? ' disabled' : '') + '>' + (S.mayaCherche ? h(membre('idees').prenom) + ' cherche…' : 'Proposer des idées') + '</button></form></div>';
    const idees = S.moi.idees || [];
    if (idees.length) x += '<div class="idees" style="margin-top:14px">' + idees.map(carteIdee).join('') + '</div>';
    return x + '</section>';
  }

  /* ── les vidéos ── */
  const FILTRES = [['tout', 'Toutes'], ['route', 'En route'], ['valider', 'À valider'], ['pretes', 'Prêtes'], ['publiees', 'Publiées'], ['archivees', 'Archivées']];
  function filtrer(v) {
    const f = S.filtre;
    if (f === 'route') return S.cat.automatiques.indexOf(v.status) >= 0 || v.status === 'echec';
    if (f === 'valider') return v.status === 'relecture';
    if (f === 'pretes') return v.status === 'prete';
    if (f === 'publiees') return v.status === 'publiee';
    if (f === 'archivees') return v.status === 'archivee';
    return v.status !== 'archivee';
  }
  function vueVideos() {
    let x = '<div class="intro"><h1>Tes vidéos</h1></div><div class="onglets">' + FILTRES.map((f) => '<button data-a="filtre" data-f="' + f[0] + '" class="' + (S.filtre === f[0] ? 'on' : '') + '">' + f[1] + '</button>').join('') + '</div>';
    if (S.videos === null) return x + '<div class="cadres"><div class="cadre-vide"></div><div class="cadre-vide"></div></div>';
    const l = S.videos.filter(filtrer);
    if (!l.length) return x + '<div class="vide"><h3>' + (S.videos.length ? 'Rien ici pour l\'instant' : 'Pas encore de vidéo') + '</h3><p>' + (S.videos.length ? 'Les autres onglets en ont peut-être.' : 'Donne une première idée à ton équipe.') + '</p><a class="btn" href="#creer">Nouvelle vidéo</a></div>';
    return x + '<div class="cadres">' + l.map(cadre).join('') + '</div>';
  }

  /* ── une vidéo ── */
  function etapes(v) {
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
    liste.push({ role: 'realisation', titre: membre('realisation').prenom, sous: st === 'fabrication' ? 'le montage' : 'images et montage', fait: rang > 4, actif: st === 'realisation' || st === 'fabrication' });
    liste.push({ role: 'diffusion', titre: membre('diffusion').prenom, sous: 'la publication', fait: st === 'publiee' || st === 'archivee', actif: st === 'publication' });
    return liste.map((x) => Object.assign(x, { bloque: x.actif && bloque }));
  }
  function bandeHtml(v) {
    return '<div class="bande">' + etapes(v).map((x) => {
      const av = x.role === 'toi' ? '<span class="agent' + (x.actif ? ' travaille' : '') + '" style="--c:var(--accent)">' + h((S.moi.prenom || '?').charAt(0).toUpperCase()) + '</span>' : avatar(x.role, '', x.actif && !x.bloque && x.role !== 'toi');
      return '<div class="etape ' + (x.fait ? 'faite' : x.bloque ? 'bloquee' : x.actif ? 'active' : '') + '">' + av + '<b>' + h(x.titre) + '</b><small>' + h(x.sous) + '</small></div>';
    }).join('') + '</div>';
  }
  function activiteHtml(v) {
    const e = v.etape || {}, st = v.status;
    const r = v.rendus || {};
    if (e.bloque || (e.erreur && st !== 'echec')) {
      const act = { cle: '<a class="btn petit" href="#reglages/connexions">Ma clé Claude</a>', credit: '<a class="btn petit" href="https://platform.claude.com/settings/billing" target="_blank" rel="noopener noreferrer">Ajouter du crédit</a><button class="btn second petit" data-a="reprendre">Réessayer</button>', budget: '<a class="btn petit" href="#reglages/budget">Monter mon budget</a>', usine: '' }[e.bloque];
      return '<div class="activite alerte">' + avatar(roleActif(v), 'petit') + '<div class="plein"><b>' + h(e.bloque ? 'En attente' : 'Petit souci') + '</b><br>' + h(e.erreur || '') + (e.bloque ? '' : '<br><span class="doux petit">L\'équipe réessaie toute seule.</span>') + (act != null ? '<div class="actions" style="margin-top:8px">' + (act || '') + (e.bloque ? '' : '<button class="btn second petit" data-a="reprendre">Réessayer maintenant</button>') + '</div>' : '') + '</div></div>';
    }
    if (st === 'echec') return '<div class="activite alerte">' + avatar(roleActif(v), 'petit') + '<div class="plein"><b>Bloquée</b><br>' + h(e.erreur || 'L\'équipe n\'a pas pu finir.') + '<div class="actions" style="margin-top:8px"><button class="btn petit" data-a="reprendre">Reprendre</button></div></div></div>';
    const textes = {
      ecriture: e.quoi === 'critique' ? membre('critique').prenom + ' relit le script et le note.' : e.quoi === 'reecriture' ? membre('plume').prenom + ' réécrit le script avec ' + (e.consigne ? 'ta consigne.' : 'les remarques de ' + membre('critique').prenom + '.') : membre('plume').prenom + ' écrit le script.',
      relecture: 'À toi : relis le script, retouche ce que tu veux, puis valide.',
      langues: membre('traduction').prenom + ' écrit la version ' + h(nomLangue(e.langue || (v.langues || []).find((l) => l !== v.langue_source && !(v.traductions || {})[l]) || '').toLowerCase()) + '.',
      realisation: membre('realisation').prenom + ' choisit les images de chaque phrase.',
      fabrication: 'Montage en cours : ' + (v.langues || []).filter((l) => r[l] && r[l].etat === 'fini').length + ' sur ' + (v.langues || []).length + '. Compte 3 à 6 minutes.' + (e.note ? ' ' + e.note : ''),
      prete: 'Ta vidéo est prête.' + (e.note ? ' ' + e.note : ''),
      publication: membre('diffusion').prenom + ' publie ta vidéo.',
      publiee: 'Publiée.' + (e.note ? ' ' + e.note : ''),
      archivee: 'Archivée.'
    };
    const travaille = S.cat.automatiques.indexOf(st) >= 0;
    const role = st === 'relecture' ? null : roleActif(v);
    return '<div class="activite">' + (role ? avatar(role, 'petit', travaille) : '<span class="agent petit" style="--c:var(--accent)">' + h((S.moi.prenom || '?').charAt(0)) + '</span>') + '<div class="plein">' + textes[st] + '</div></div>';
  }
  function roleActif(v) {
    const e = v.etape || {};
    const st = v.status === 'echec' ? (e.statut_avant || 'ecriture') : v.status;
    return { ecriture: e.quoi === 'critique' ? 'critique' : 'plume', relecture: 'critique', langues: 'traduction', realisation: 'realisation', fabrication: 'realisation', prete: 'diffusion', publication: 'diffusion', publiee: 'diffusion', archivee: 'diffusion' }[st] || 'plume';
  }
  function etatHtml(v) { return bandeHtml(v) + activiteHtml(v); }

  function scriptLecture(s, titre) {
    if (!s || !s.beats) return '';
    return '<div class="bloc"><h3 style="margin-bottom:6px">' + h(titre || 'Le script') + '</h3>' + (s.accroche ? '<p class="doux petit">À l\'écran au début : « ' + h(sansEtoiles(s.accroche)) + ' »</p>' : '') + '<ol class="beats">' + s.beats.map((b) => '<li><div class="dit">' + forts(b.voix) + '</div><div class="sous">' + (b.ecran ? '<span>Écran : ' + h(b.ecran) + '</span>' : '') + (b.visuel && b.visuel.requete ? '<span>Image : ' + h(b.visuel.requete) + '</span>' : '') + '</div></li>').join('') + '</ol></div>';
  }
  function noteHtml(c) {
    if (!c || !c.note) return '';
    return '<div class="bloc"><div class="note-jade">' + avatar('critique', 'grand') + '<div class="plein"><div class="chiffre">' + h(String(c.note).replace('.', ',')) + '<small>/10</small></div><p style="margin-top:6px">' + h(c.verdict || '') + '</p>' +
      (c.points_forts && c.points_forts.length ? '<ul class="liste-points">' + c.points_forts.map((p) => '<li>' + h(p) + '</li>').join('') + '</ul>' : '') +
      (c.corrections && c.corrections.length ? '<p class="doux petit" style="margin-top:10px">Ce qu\'elle changerait encore :</p><ul class="liste-points">' + c.corrections.slice(0, 4).map((p) => '<li>' + h(p) + '</li>').join('') + '</ul>' : '') + '</div></div></div>';
  }
  function editionScript(v) {
    const s = v.script || {};
    const clips = (v.plan && v.plan.style) === 'clips';
    return '<form class="bloc vif" data-form="script"><h3 style="margin-bottom:14px">Le script de ' + h(membre('plume').prenom) + '</h3>' +
      '<label class="champ"><span>Titre</span><input type="text" name="titre" maxlength="100" value="' + h(s.titre || '') + '"></label>' +
      '<label class="champ"><span>Accroche à l\'écran</span><input type="text" name="accroche" maxlength="70" value="' + h(s.accroche || '') + '"><small>Les deux premières secondes, 7 mots au plus.</small></label>' +
      '<ol class="beats">' + (s.beats || []).map((b, i) => '<li><textarea name="voix" data-i="' + i + '" rows="2" aria-label="Phrase ' + (i + 1) + '">' + h(b.voix) + '</textarea><div class="duo"><label class="mini"><span>À l\'écran</span><input type="text" name="ecran" data-i="' + i + '" maxlength="48" value="' + h(b.ecran || '') + '"></label>' + (clips ? '<label class="mini"><span>Image (en anglais)</span><input type="text" name="requete" data-i="' + i + '" maxlength="60" value="' + h((b.visuel || {}).requete || '') + '"></label>' : '') + '</div></li>').join('') + '</ol>' +
      '<p class="doux petit" style="margin:4px 0 16px">Les mots entre *étoiles* s\'allument à l\'écran dans ta couleur.' + (clips ? ' L\'image se cherche en anglais, en 2 à 4 mots concrets : « ocean waves aerial ».' : '') + '</p>' +
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
    if (auto && !enCours) tete = '<div class="actions" style="margin-bottom:12px"><button class="btn" data-a="publier">Publier sur ' + h((conf.plateformes || []).map((k) => S.cat.plateformes[k]).join(', ')) + '</button></div>';
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
      '<button class="btn second" data-a="copierTexte" data-l="' + l + '">' + ico('copier') + 'Copier le texte</button></div>' +
      '<p class="doux petit" style="margin-top:10px">' + (((v.rendus || {})[l] || {}).duree ? Math.round(v.rendus[l].duree) + ' secondes. ' : '') + 'Disponible jusqu\'au ' + h(dateCourte(v.garde_jusqu)) + '.</p>' +
      '<form data-form="texte" data-l="' + l + '" style="margin-top:18px"><label class="champ"><span>Titre (TikTok, Instagram)</span><input type="text" name="titre" maxlength="100" value="' + h(t.titre) + '"></label>' +
      '<label class="champ"><span>Titre YouTube</span><input type="text" name="titre_youtube" maxlength="95" value="' + h(t.titre_youtube) + '"></label>' +
      '<label class="champ"><span>Texte de la publication</span><textarea name="description" rows="3" maxlength="2000">' + h(t.description) + '</textarea></label>' +
      '<label class="champ"><span>Hashtags</span><input type="text" name="hashtags" value="' + h((t.hashtags || []).join(' ')) + '"></label><button class="btn second petit" type="submit">Enregistrer le texte</button></form>' +
      '<div id="v-pub">' + pubHtml(v, l) + '</div></div></div>' +
      ((v.plan || {}).credits && v.plan.credits.length ? '<p class="doux petit" style="margin-top:14px">Images : Pexels (' + h(Array.from(new Set(v.plan.credits.map((c) => c.auteur))).slice(0, 8).join(', ')) + ').</p>' : '');
  }
  function corpsVideo(v) {
    const st = v.status;
    let x = '';
    if (st === 'relecture') return noteHtml(v.critique) + editionScript(v) + basVideo(v);
    if (['prete', 'publication', 'publiee'].indexOf(st) >= 0) return '<div class="bloc">' + lecteurHtml(v) + '</div>' + basVideo(v);
    if (st === 'ecriture' && !(v.script && v.script.beats)) {
      x += '<div class="bloc"><p class="doux petit">L\'idée</p><p style="margin-top:4px;font-size:16px">' + h(v.sujet) + '</p>' + (v.idee && v.idee.angle ? '<p class="doux petit" style="margin-top:8px">' + h(v.idee.angle) + '</p>' : '') + '</div>';
    }
    if (v.critique && v.critique.note && st === 'ecriture') x += noteHtml(v.critique);
    x += scriptLecture(v.script);
    const trad = Object.keys(v.traductions || {});
    if (trad.length) x += trad.map((l) => scriptLecture(v.traductions[l], 'Version ' + nomLangue(l).toLowerCase())).join('');
    const r = v.rendus || {};
    if (st === 'fabrication' || Object.keys(r).length) {
      x += '<div class="bloc"><h3 style="margin-bottom:10px">Le montage</h3><div class="plateformes">' + (v.langues || []).map((l) => {
        const e = r[l] || {};
        const t = e.etat === 'fini' ? 'Prête' : e.etat === 'demande' ? 'En cours depuis ' + h(depuis(e.demande_le)).replace('il y a ', '') : e.etat === 'echec' ? h(e.erreur || 'Raté') + (e.essais < 2 ? ' (nouvel essai bientôt)' : '') : 'En attente';
        return '<div class="plateforme"><div class="plein"><b>' + h(nomLangue(l)) + '</b><small' + (e.etat === 'echec' ? ' style="color:var(--alerte)"' : '') + '>' + t + '</small></div>' + (e.etat === 'fini' ? '<span class="pastille ok">' + ico('ok') + '</span>' : '') + '</div>';
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
  function signature(v) { return [v.status, (v.script && v.script.beats || []).length, (v.script || {}).titre, Object.keys(v.traductions || {}).join(), JSON.stringify(Object.keys(v.rendus || {}).map((l) => [l, v.rendus[l].etat, v.rendus[l].essais])), (v.critique || {}).note, (v.etape || {}).quoi].join('|'); }
  function vueVideo(id) {
    const v = S.video && String(S.video.id) === String(id) ? S.video : null;
    if (!v) return '<a class="retour" href="#videos">' + ico('retour') + 'Tes vidéos</a><div class="cadre-vide"></div>';
    S.sigCorps = signature(v);
    return '<a class="retour" href="#videos">' + ico('retour') + 'Tes vidéos</a><div class="video-tete"><div><div class="titre-video">' + forts(v.titre || v.sujet) + '</div><div class="meta"><span class="pastille ' + ((v.etape || {}).erreur ? 'alerte' : TON[v.status] || '') + '">' + h(v.statut) + '</span><span>' + h(v.langues.map(nomLangue).join(', ')) + '</span><span>' + h(usd(v.cout_usd)) + '</span><span>' + h(depuis(v.created_at)) + '</span>' + (v.auto ? '<span>pilote automatique</span>' : '') + '</div></div></div>' +
      '<div class="bloc" id="v-etat">' + etatHtml(v) + '</div><div id="v-corps" style="margin-top:12px">' + corpsVideo(v) + '</div>';
  }
  async function chargerVideo(id) {
    try { const d = await lire('video', { id }); S.video = d.video; }
    catch (e) { toast(e.message, 'err'); return; }
    if (route().vue === 'video' && route().arg === String(id)) { const c = $('#contenu'); if (c) c.innerHTML = vueVideo(id); suivre(id); }
  }
  // une nouvelle version de la vidéo : l'état se met à jour, le reste seulement si quelque chose a changé
  function majVideo(v) {
    if (!v) return;
    S.video = v;
    if (route().vue !== 'video' || route().arg !== String(v.id)) return;
    const e = $('#v-etat'), c = $('#v-corps');
    if (!e || !c) { $('#contenu').innerHTML = vueVideo(v.id); return; }
    e.innerHTML = etatHtml(v);
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
        if (d.video && d.video.status === 'prete') toast('Ta vidéo est prête.', 'ok');
      } catch (err) { attente = 8000; }
      await dormir(attente);
    }
  }

  /* ── l'équipe ── */
  function vueEquipe() {
    const eq = S.moi.equipe;
    return '<div class="intro"><h1>Ton équipe</h1><p>Six rôles, tes prénoms, tes couleurs. Les consignes que tu leur donnes passent avant tout le reste.</p></div><form class="bloc" data-form="equipe">' +
      S.cat.ordre.map((k) => { const m = eq[k]; return '<div class="membre-carte" data-role="' + k + '"><span class="agent grand" style="--c:' + h(m.couleur) + '">' + h(String(m.prenom).charAt(0).toUpperCase()) + '</span><div><div class="duo-champs"><label class="champ" style="margin:0"><span>' + h(m.metier) + '</span><input type="text" name="' + k + '.prenom" maxlength="24" value="' + h(m.prenom) + '" data-apercu="' + k + '"></label><input type="color" name="' + k + '.couleur" value="' + h(m.couleur) + '" aria-label="Couleur de ' + h(m.prenom) + '" data-apercu="' + k + '"></div><p class="role">' + h(m.fait) + '</p><label class="champ" style="margin:0"><span>Tes consignes</span><textarea name="' + k + '.consignes" rows="2" maxlength="600" placeholder="' + h(PISTES[k]) + '">' + h(m.consignes || '') + '</textarea></label></div></div>'; }).join('') +
      '<div class="actions" style="margin-top:16px"><button class="btn" type="submit">Enregistrer mon équipe</button></div></form>';
  }
  const PISTES = { idees: 'Des sujets du quotidien, jamais de politique', plume: 'Tutoie, sois drôle, finis toujours par une question', critique: 'Sois très exigeante sur l\'accroche', traduction: 'En anglais, parle comme une Londonienne de 25 ans', realisation: 'Des images lumineuses, plutôt la nature', diffusion: 'Pas plus de 4 hashtags' };

  /* ── les réglages ── */
  const SECTIONS = [['chaine', 'Ma chaîne'], ['langues', 'Langues et voix'], ['videos', 'Mes vidéos'], ['budget', 'Budget'], ['pilote', 'Pilote automatique'], ['connexions', 'Connexions'], ['publication', 'Publication'], ['apparence', 'Apparence'], ['compte', 'Mon compte'], ['aide', 'Aide']];
  const FUSEAUX = [['Europe/Paris', 'France, Belgique, Suisse'], ['Europe/London', 'Royaume-Uni'], ['Europe/Madrid', 'Espagne'], ['Europe/Rome', 'Italie'], ['Europe/Lisbon', 'Portugal'], ['America/Martinique', 'Martinique'], ['America/Guadeloupe', 'Guadeloupe'], ['America/Cayenne', 'Guyane'], ['Indian/Reunion', 'La Réunion'], ['America/Montreal', 'Québec'], ['America/New_York', 'New York'], ['America/Sao_Paulo', 'Brésil'], ['Africa/Abidjan', 'Côte d\'Ivoire, Sénégal'], ['Africa/Casablanca', 'Maroc'], ['Asia/Kolkata', 'Inde']];
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
  function sectionLangues(r) {
    const voix = r.langues.map((l) => {
      const L = S.cat.langues[l];
      const v = r.voix[l] || L.defaut, vit = r.vitesse[l] || L.vitesse;
      return '<div class="champ"><span>Voix en ' + h(L.nom.toLowerCase()) + '</span><select name="voix.' + l + '">' + L.voix.map((x) => '<option value="' + h(x[0]) + '"' + (x[0] === v ? ' selected' : '') + '>' + h(x[1]) + '</option>').join('') + '</select><label class="ligne" style="margin-top:10px;gap:12px"><span class="doux petit" style="min-width:64px">Débit</span><input type="range" name="vitesse.' + l + '" min="0.8" max="1.25" step="0.05" value="' + h(vit) + '" class="plein"></label></div>';
    }).join('');
    return formulaire('langues',
      champ('Ta langue principale', '<select name="langue_source">' + Object.keys(S.cat.langues).map((l) => '<option value="' + l + '"' + (l === r.langue_source ? ' selected' : '') + '>' + h(nomLangue(l)) + '</option>').join('') + '</select>', 'Les scripts sont écrits dans cette langue, puis adaptés.') +
      champ('Tes langues', choixLangues('langues[]', r.langues), 'Chaque langue fait une vidéo de plus, avec sa voix, ses sous-titres et ses hashtags.') + voix +
      '<p class="doux petit" style="margin-bottom:12px">Les voix sont des voix de synthèse (Kokoro), gratuites. Enregistre pour voir les voix d\'une langue que tu viens d\'ajouter.</p>');
  }
  function sectionVideos(r) {
    return formulaire('videos',
      champ('Durée habituelle', radios('format', [['court', '35 à 50 secondes'], ['long', 'Plus d\'une minute']], r.format), 'TikTok ne rémunère que les vidéos de plus d\'une minute ; les courtes se regardent plus souvent jusqu\'au bout.') +
      champ('Images', radios('style', [['clips', 'Vidéos d\'illustration'], ['texte', 'Texte animé']], r.style), 'Vidéos libres de droits (Pexels) choisies phrase par phrase, ou texte animé sur un fond à tes couleurs.') +
      champ('La couleur de tes vidéos', nuancier('couleur', r.couleur), 'L\'accroche et le mot qui s\'allume pendant les sous-titres.') +
      champ('Musique', radios('musique', Object.keys(S.cat.musiques).map((k) => [k, S.cat.musiques[k]]), r.musique), 'Une musique d\'ambiance très douce sous la voix, fabriquée par le studio (aucun droit à payer).'));
  }
  function sectionBudget(r) {
    const d = S.moi.depense;
    return formulaire('budget',
      '<div class="message" style="margin-bottom:16px"><b>Aujourd\'hui : ' + h(usd(d.jour)) + ' sur ' + h(usd(d.budget)) + '</b>Ce mois : ' + h(usd(d.mois)) + '. Depuis le début : ' + h(usd(d.total)) + '.</div>' +
      '<label class="champ"><span>Budget par jour : <output id="budgetVal">' + h(usd(r.budget_jour)) + '</output></span><input type="range" name="budget_jour" min="0.1" max="5" step="0.05" value="' + h(r.budget_jour) + '"><small>Ton équipe s\'arrête dès qu\'elle l\'atteint, et reprend le lendemain. Une vidéo coûte environ ' + h(usd(d.estime_video)) + '.</small></label>' +
      champ('Qualité de l\'écriture', radios('qualite', Object.keys(S.cat.qualites).map((k) => [k, S.cat.qualites[k].nom]), r.qualite), h((S.cat.qualites[r.qualite] || {}).explication || '')) +
      inter('tendances', r.tendances, 'Regarder les tendances', h(membre('idees').prenom) + ' cherche sur le web ce dont on parle cette semaine avant de proposer des idées (1 centime la recherche).'));
  }
  function sectionPilote(r) {
    const p = r.pilote, up = S.moi.connexions.uploadpost.branchee;
    return formulaire('pilote',
      '<p class="doux" style="margin-bottom:8px">Chaque jour, à ton heure, ' + h(membre('idees').prenom) + ' choisit une idée et l\'équipe fait la vidéo toute seule, dans ton budget.</p>' +
      inter('pilote.actif', p.actif, 'Pilote automatique', 'Des vidéos tous les jours, sans rien demander.') +
      '<div class="duo-champs" style="grid-template-columns:1fr 1fr;margin-top:12px">' + champ('Vidéos par jour', '<select name="pilote.videos_jour">' + [1, 2, 3, 4, 5].map((n) => '<option' + (n === p.videos_jour ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') +
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
      '<li><b>Crée ta clé</b><p>Settings, puis API keys, puis Create key. Appelle-la « Studio », puis copie-la : elle commence par <code>sk-ant-api</code> et ne s\'affiche qu\'une fois.</p>' + l('https://platform.claude.com/settings/keys', 'Ouvrir API keys') + '</li>' +
      '<li><b>Colle-la ici</b><p>Le studio vérifie qu\'elle marche et qu\'il te reste du crédit, puis la range chiffrée. Elle ne s\'affiche plus jamais en entier.</p>' +
      '<form data-form="cleClaude" style="margin-top:10px"><input type="password" name="cle" autocomplete="off" spellcheck="false" placeholder="sk-ant-api03-…" required><div class="actions" style="margin-top:10px"><button class="btn" type="submit">Vérifier et enregistrer</button>' + (cl.branchee ? '<button class="btn discret" type="button" data-a="cleClaudeRetirer">Retirer ma clé</button>' : '') + '</div></form></li>' +
      '<li><b>Choisis ton budget du jour</b><p>Dans <a href="#reglages/budget">Budget</a> : arrivée au plafond, ton équipe s\'arrête jusqu\'au lendemain.</p></li></ol></div>';
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
        '<li><b>Colle-la ici</b><form data-form="cleUp" style="margin-top:10px"><input type="password" name="cle" autocomplete="off" spellcheck="false" placeholder="Ta clé upload-post" required><div class="actions" style="margin-top:10px"><button class="btn" type="submit">Vérifier et enregistrer</button></div></form></li>' +
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
    return formulaire('apparence', champ('La couleur de ton studio', nuancier('theme.accent', r.theme.accent)) + champ('Mode', radios('theme.mode', [['sombre', 'Sombre'], ['clair', 'Clair']], r.theme.mode)));
  }
  function sectionCompte() {
    return '<div class="bloc"><h2>Mon compte</h2><p class="doux" style="margin:6px 0 16px">Identifiant : <b>' + h(S.moi.identifiant) + '</b></p><form data-form="mdp"><label class="champ"><span>Mot de passe actuel</span><input type="password" name="ancien" autocomplete="current-password" required></label><label class="champ"><span>Nouveau mot de passe</span><input type="password" name="nouveau" autocomplete="new-password" minlength="10" required><small>10 caractères au moins.</small></label><button class="btn second" type="submit">Changer mon mot de passe</button></form></div>' +
      '<div class="bloc"><div class="actions"><button class="btn second" data-a="deconnexion">Me déconnecter</button><button class="btn discret" data-a="partout">Déconnecter tous mes appareils</button></div></div>';
  }
  function sectionAide() {
    const q = [
      ['Combien ça coûte ?', 'Seule l\'écriture est payante, sur ta clé Claude : environ 1 centime par vidéo en qualité économique, 8 centimes en qualité équilibrée (plus 2 par langue), 15 centimes en premium. Le montage, les voix, les images et le stockage sont offerts par le studio. Ton budget du jour bloque tout dépassement.'],
      ['Pourquoi TikTok ne se publie pas tout seul ?', 'TikTok n\'autorise la publication automatique que par des services agréés. upload-post l\'est, sur son offre payante. Sinon, depuis ton téléphone : Partager, puis TikTok ; le texte se copie en un geste.'],
      ['TikTok me paiera-t-il ?', 'Le programme de rémunération de TikTok ne compte que les vidéos de plus d\'une minute : choisis la durée « Plus d\'une minute » pour celles-là. Les conditions (âge, abonnés, vues) sont dans l\'appli TikTok, rubrique Studio TikTok.'],
      ['Et YouTube ?', 'Une vidéo verticale de moins de 3 minutes devient un Short tout seul. Elle peut rapporter une fois ta chaîne acceptée au Programme Partenaire YouTube.'],
      ['Combien de temps mes vidéos restent-elles ici ?', 'Leurs fichiers sont gardés ' + S.cat.garde_jours + ' jours : télécharge celles que tu veux garder. Les scripts restent.'],
      ['Ma vidéo est bloquée, je fais quoi ?', 'Ouvre-la : le message dit pourquoi (clé, crédit, budget du jour) et le bouton pour régler. Les petits soucis passagers se réessaient tout seuls.'],
      ['D\'où viennent les images, la voix, la musique ?', 'Les images viennent de Pexels (libres de droits, usage commercial permis), la voix est une voix de synthèse (Kokoro, libre), la musique est fabriquée par le studio. Tu peux publier et monétiser sans rien payer pour elles.'],
      ['Qui voit ma clé et mes vidéos ?', 'Ta clé est rangée chiffrée et ne s\'affiche plus jamais. Dans la tour, Louis voit que ton compte existe, ta dépense et le nombre de tes vidéos.']
    ];
    return '<div class="bloc">' + q.map((x) => '<details class="aide"><summary>' + h(x[0]) + '</summary><p>' + h(x[1]) + '</p></details>').join('') + '</div>';
  }
  function vueReglages(section) {
    const r = S.moi.reglages;
    const s = SECTIONS.some((x) => x[0] === section) ? section : 'chaine';
    const corps = { chaine: sectionChaine, langues: sectionLangues, videos: sectionVideos, budget: sectionBudget, pilote: sectionPilote, connexions: sectionConnexions, publication: sectionPublication, apparence: sectionApparence, compte: sectionCompte, aide: sectionAide }[s](r);
    return '<div class="intro"><h1>Réglages</h1></div><nav class="reglages-nav" aria-label="Réglages">' + SECTIONS.map((x) => '<a href="#reglages/' + x[0] + '" class="' + (x[0] === s ? 'on' : '') + '">' + h(x[1]) + '</a>').join('') + '</nav>' + corps;
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
    async connexion(f, btn) {
      const d = lireForm(f);
      await occupe(btn, async () => { await agir('connexion', d); const e = await lire('etat'); S.moi = e.moi; S.videos = null; location.hash = '#accueil'; rendre(); });
    },
    async invitation(f, btn) {
      const d = lireForm(f);
      if (d.mdp !== d.mdp2) { toast('Les deux mots de passe ne sont pas pareils.', 'err'); return; }
      await occupe(btn, async () => { await agir('invitation', { code: f.dataset.code, mdp: d.mdp }); const e = await lire('etat'); S.moi = e.moi; history.replaceState(null, '', '/studio#accueil'); rendre(); toast('Bienvenue dans ton studio.', 'ok'); });
    },
    async creer(f, btn) {
      const d = lireForm(f);
      if (!S.moi.connexions.claude.branchee) { toast('Branche d\'abord ta clé Claude.', 'err'); location.hash = '#reglages/connexions'; return; }
      if (String(d.sujet || '').trim().length < 4) { toast('Écris ton idée en quelques mots.', 'err'); return; }
      await occupe(btn, async () => { const r = await agir('creer', { sujet: d.sujet, langues: d.langues, format: d.format, style: d.style }); S.video = r.video; S.videos = null; location.hash = '#video/' + r.video.id; });
    },
    async idees(f, btn) {
      const d = lireForm(f);
      if (!S.moi.connexions.claude.branchee) { toast('Branche d\'abord ta clé Claude.', 'err'); location.hash = '#reglages/connexions'; return; }
      S.mayaCherche = true;
      const c = $('#contenu'); if (c) c.innerHTML = vueCreer();
      try { await agir('idees', { theme: d.theme }); toast(membre('idees').prenom + ' a des idées pour toi.', 'ok'); }
      catch (e) { toast(e.message, 'err'); }
      finally { S.mayaCherche = false; if (route().vue === 'creer') { const c2 = $('#contenu'); if (c2) c2.innerHTML = vueCreer(); } rendreEntete(); }
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
      await occupe(btn, async () => { await agir('equipe', { equipe: lireForm(f) }); rendre(); toast('Ton équipe est enregistrée.', 'ok'); });
    },
    async reglages(f, btn) {
      const d = lireForm(f);
      await occupe(btn, async () => { await agir('reglages', { reglages: d }); rendre(); toast('Enregistré.', 'ok'); });
    },
    async cleClaude(f, btn) {
      await occupe(btn, async () => { const r = await agir('cle_claude', { cle: lireForm(f).cle }); rendre(); toast(r.avertissement ? 'Clé enregistrée : ' + r.avertissement : 'Ta clé Claude est branchée.', r.avertissement ? '' : 'ok'); });
    },
    async cleUp(f, btn) {
      await occupe(btn, async () => { await agir('uploadpost', { cle: lireForm(f).cle }); rendre(); toast('upload-post est branché.', 'ok'); });
    },
    async upProfil(f, btn) {
      await occupe(btn, async () => { await agir('uploadpost_creer_profil', { nom: lireForm(f).nom }); rendre(); toast('Profil créé : relie tes comptes.', 'ok'); });
    },
    async mdp(f, btn) {
      await occupe(btn, async () => { const r = await agir('mdp', lireForm(f)); f.reset(); toast(r.message || 'Mot de passe changé.', 'ok'); });
    }
  };
  function scriptDe(f) {
    const beats = (S.video.script.beats || []).map((b, i) => {
      const voix = $('textarea[name="voix"][data-i="' + i + '"]', f), ecran = $('input[name="ecran"][data-i="' + i + '"]', f), req = $('input[name="requete"][data-i="' + i + '"]', f);
      const out = { voix: voix ? voix.value : b.voix, ecran: ecran ? ecran.value : b.ecran };
      if (b.visuel || req) out.visuel = { requete: req ? req.value : (b.visuel || {}).requete, description: (b.visuel || {}).description || '' };
      return out;
    }).filter((b) => String(b.voix || '').trim());
    const v = (n) => { const el = $('[name="' + n + '"]', f); return el ? el.value : undefined; };
    return { titre: v('titre'), accroche: v('accroche'), description: v('description'), hashtags: String(v('hashtags') || '').split(/[\s,]+/).filter(Boolean), beats };
  }
  function rendreEntete() { const j = $('.jauge'); if (j && S.moi) j.outerHTML = jaugeHtml(); }

  /* ── les boutons ── */
  const ACTIONS = {
    recharger() { location.reload(); },
    filtre(b) { S.filtre = b.dataset.f; $('#contenu').innerHTML = vueVideos(); },
    async ideeChoisir(b) {
      if (!S.moi.connexions.claude.branchee) { toast('Branche d\'abord ta clé Claude.', 'err'); location.hash = '#reglages/connexions'; return; }
      await occupe(b, async () => { const r = await agir('creer', { idee_id: b.dataset.id }); await rafraichirMoi(); S.video = r.video; S.videos = null; location.hash = '#video/' + r.video.id; });
    },
    async ideeOublier(b) { await occupe(b, async () => { await agir('idee_oublier', { id: b.dataset.id }); $('#contenu').innerHTML = vueCreer(); }); },
    async scriptEnregistrer(b) { const f = b.closest('form'); await occupe(b, async () => { const r = await agir('modifier', { id: S.video.id, script: scriptDe(f) }); S.video = r.video; toast('Retouches enregistrées.', 'ok'); }); },
    async reecrire(b) {
      const c = ($('#consigne') || {}).value || '';
      await occupe(b, async () => { const r = await agir('reecrire', { id: S.video.id, consigne: c }); majVideo(r.video); suivre(S.video.id); toast(membre('plume').prenom + ' réécrit le script.', 'ok'); });
    },
    async reprendre(b) { await occupe(b, async () => { const r = await agir('reprendre', { id: S.video.id }); majVideo(r.video); suivre(S.video.id); }); },
    async refaire(b) {
      if (!(await fenetre({ titre: 'Refaire le montage ?', texte: 'Avec tes réglages actuels (couleur, musique, voix) et de nouvelles images. Ça ne coûte rien sur ta clé.', ok: 'Refaire' }))) return;
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
    },
    async cleClaudeRetirer(b) {
      if (!(await fenetre({ titre: 'Retirer ta clé Claude ?', texte: 'Ton équipe s\'arrête jusqu\'à ce que tu en colles une autre.', ok: 'Retirer', danger: true }))) return;
      await occupe(b, async () => { await agir('cle_claude_supprimer'); rendre(); });
    },
    async upConnecter(b) { await occupe(b, async () => { const r = await agir('uploadpost_connecter', { profil: b.dataset.profil }); location.href = r.url; }); },
    async upRafraichir(b) { await occupe(b, async () => { await agir('uploadpost_profils'); rendre(); toast('Profils à jour.', 'ok'); }); },
    async upRetirer(b) {
      if (!(await fenetre({ titre: 'Retirer upload-post ?', texte: 'Tes vidéos ne se publieront plus toutes seules. Tes comptes restent reliés chez upload-post.', ok: 'Retirer', danger: true }))) return;
      await occupe(b, async () => { await agir('uploadpost_supprimer'); rendre(); });
    },
    async deconnexion(b) { await occupe(b, async () => { await agir('deconnexion'); S.moi = null; S.videos = null; S.video = null; location.hash = ''; rendre(); }); },
    async partout(b) {
      if (!(await fenetre({ titre: 'Déconnecter tous tes appareils ?', texte: 'Y compris celui-ci : tu devras te reconnecter partout.', ok: 'Tout déconnecter' }))) return;
      await occupe(b, async () => { await agir('deconnexion', { partout: true }); S.moi = null; location.hash = ''; rendre(); });
    }
  };
  async function rafraichirMoi() { try { const d = await lire('moi'); S.moi = d.moi; } catch (e) { /* la page reste comme elle est */ } }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || !ACTIONS[b.dataset.a]) return;
    e.preventDefault();
    ACTIONS[b.dataset.a](b, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f || !FORMS[f.dataset.form]) return;
    e.preventDefault();
    FORMS[f.dataset.form](f, $('button[type="submit"]', f) || e.submitter);
  });
  // l'aperçu en direct : un prénom ou une couleur d'équipe, le budget, une couleur choisie à la main
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.apercu) {
      const carte = t.closest('.membre-carte');
      const av = carte && $('.agent', carte);
      if (av) { const p = $('input[name$=".prenom"]', carte).value, c = $('input[name$=".couleur"]', carte).value; av.textContent = (p || '?').charAt(0).toUpperCase(); av.style.setProperty('--c', c); }
    }
    if (t.name === 'budget_jour') { const o = $('#budgetVal'); if (o) o.textContent = usd(t.value); }
    if (t.type === 'color' && t.closest('[data-nuancier]')) $$('button', t.closest('[data-nuancier]')).forEach((x) => x.classList.toggle('on', x.dataset.c.toLowerCase() === t.value.toLowerCase()));
    if (t.name === 'qualite' && S.cat) { const s = t.closest('.champ'); const sm = s && $('small', s); if (sm) sm.textContent = (S.cat.qualites[t.value] || {}).explication || ''; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.moi && route().vue === 'video' && S.video) suivre(S.video.id); });

  async function demarrer() {
    try { const d = await lire('etat'); S.cat = d.catalogue; S.moi = d.moi; }
    catch (e) { $('#app').innerHTML = '<div class="porte"><div class="porte-c"><h1>Le studio ne répond pas</h1><p class="sous">' + h(e.message) + '</p><button class="btn" data-a="recharger">Réessayer</button></div></div>'; return; }
    rendre();
  }
  demarrer();
})();
