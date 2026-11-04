// La Tour : l'interface. Deux espaces : la Ville (la maquette 3D, pour voir d'un coup d'œil que tout tourne) et la
// Gestion (les chiffres, les prospects, les ventes). Derrière une porte : le mot de passe de Louis.
import { $, esc, ico, LOGO, toast, heureGP, occupe, usd, pluriel } from './outils.js';
import { lireApi, envoyer, porte, quandDeconnecte } from './api.js';
import { S, nom, demo, hooks, aller, ACTIONS } from './etat.js';
import * as Porte from './porte.js';
import * as Hud from './hud.js';
import * as Gestion from './gestion.js';
import * as Fiches from './fiches.js';

/* ── le chargement ── */
function progression(p, texte) {
  const b = $('#chargementBarre'); if (b) b.style.width = p + '%';
  const e = $('#chargementEtape'); if (e && texte) e.textContent = texte;
}
function finirChargement() { const c = $('#chargement'); if (c) { c.classList.add('fini'); setTimeout(() => c.remove(), 800); } }

let villeP = null;
function chargerVille() {
  if (villeP) return villeP;
  villeP = import('./ville.js').then((mod) => {
    S.ville = mod.creerVille($('#ville'), { surChoix: Hud.choix, surSurvol: Hud.survol, apresImage: Hud.apresImage });
    S.ville.theme(document.documentElement.dataset.theme);
    window.__tour = { pause: (on) => { if (S.ville) S.ville.actif(!on && S.espace !== 'gestion'); }, ville: () => S.ville };   // captures d'écran et essais des tests
    return S.ville;
  }).catch((e) => {
    console.error(e);
    $('#ville').classList.add('sans-3d');
    return null;
  });
  return villeP;
}

async function demarrer() {
  progression(12, 'Ouverture de la porte');
  let e;
  try { e = await porte.etat(); } catch (err) { e = { configure: true, connecte: false, horsLigne: true }; }
  chargerVille();
  if (!e.connecte) {
    progression(60, 'La ville se construit');
    await villeP;
    if (S.ville) S.ville.maj({ companies: [], agents: [] });
    progression(100, '');
    finirChargement();
    $('#ville').classList.add('attenue');
    if (S.ville) S.ville.actif(true);
    Porte.afficher(e, { surEntree: entrer });
    return;
  }
  await entrer(true);
}

// Une fois la porte passée : la ville, le monde, l'interface
async function entrer(depuisChargement) {
  if (!depuisChargement) { $('#ville').classList.remove('attenue'); }
  progression(45, 'La ville se construit');
  await chargerVille();
  progression(72, 'Les agents arrivent');
  try { await poll(true); } catch (e) { /* le poll réessaie seul */ }
  monterInterface();
  progression(100, 'Prêt');
  if (depuisChargement) finirChargement();
  $('#ville').classList.remove('attenue');
  if (S.ville && S.m) { S.ville.maj(etatVille()); S.ville.intro(); }
  routeur();
  chargerMissions();
  lireApi('etat').then((x) => { S.etat = x; diffuser(); }).catch(() => {});
  setInterval(chargerMissions, 60000);
  setInterval(majTheme, 60000);
}

quandDeconnecte((d) => {
  if (!S.monte) return;
  S.monte = false;
  clearTimeout(pollTimer);
  document.body.classList.add('deconnecte');
  $('#app').innerHTML = '';
  $('#ville').classList.add('attenue');
  if (S.ville) S.ville.actif(true);
  Porte.afficher({ configure: !d.configurer, connecte: false, expiree: !d.redemarre, redemarre: !!d.redemarre }, { surEntree: () => { location.reload(); } });
});

/* ── le monde, relu toutes les quelques secondes ── */
let pollTimer = null;
async function poll(premier) {
  clearTimeout(pollTimer);
  try {
    const d = await lireApi('world', S.premier ? {} : { since: S.lastId });
    S.echecs = 0;
    const nouveaux = S.premier ? [] : (d.messages || []);
    const msgs = S.premier ? (d.messages || []) : nouveaux;
    S.m = Object.assign({}, d, { messages: undefined });
    msgs.forEach((m) => { if (m.id > S.lastId) S.lastId = m.id; });
    S.msgs = S.premier ? msgs.slice().reverse() : nouveaux.slice().reverse().concat(S.msgs).slice(0, 200);
    if (S.ville) S.ville.maj(etatVille());
    nouveaux.forEach((m, k) => setTimeout(() => {
      if (S.ville && m.from_id && m.from_id !== 'systeme') S.ville.impulsion(m.from_id, m.to_id || 'louis', m.kind);
      if (m.to_id === 'louis' && ['alerte', 'proposition', 'rapport'].indexOf(m.kind) >= 0) toast(nom(m.from_id) + ' : ' + (m.subject || ''), m.kind === 'alerte' ? 'err' : 'ok');
    }, k * 380));
    S.premier = false;
    diffuser(nouveaux.map((m) => m.id));
  } catch (e) {
    S.echecs++;
    if (e.statut === 401) return;
    const v = $('#etatVie'); if (v) v.innerHTML = '<span class="point error"></span><span>hors ligne</span>';
    if (premier) throw e;
  }
  pollTimer = setTimeout(poll, document.hidden ? 30000 : S.cycle ? 2500 : 6000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.monte) poll(); });

function etatVille() {
  const c = (S.m && S.m.compteurs) || {};
  return {
    companies: S.m.companies.map((x) => ({ id: x.id, name: x.name, color: x.color, status: x.status, kind: x.kind })),
    agents: S.m.agents.map((a) => ({ id: a.id, company_id: a.company_id, parent_id: a.parent_id, status: a.kind === 'attente' ? 'attente' : a.status, kind: a.kind, tier: a.tier, seat: a.seat, name: a.name })),
    decisions: (S.m.proposals || []).filter((p) => p.status === 'a_louis').length,
    en_ligne: c.en_ligne || 0, apercus: c.apercus || 0, heure: heureGP()
  };
}

function diffuser(frais) {
  if (!S.monte) return;
  majBarre();
  S.abonnes.forEach((fn) => { try { fn(frais || []); } catch (e) { console.error(e); } });
}

async function chargerMissions() {
  try { S.mis = await lireApi('missions'); diffuser(); } catch (e) { /* on réessaie à la prochaine minute */ }
}
async function rechargerEtat() { try { S.etat = await lireApi('etat'); diffuser(); } catch (e) { /* plus tard */ } }

/* ── le thème : la nuit tombe à 19 h en Guadeloupe ── */
function majTheme() {
  let pref = 'auto'; try { pref = localStorage.getItem('tour_theme') || 'auto'; } catch (e) { /* rien */ }
  const h = heureGP();
  const t = pref === 'auto' ? (h >= 19 || h < 6 ? 'nuit' : 'jour') : pref;
  if (document.documentElement.dataset.theme !== t) {
    document.documentElement.dataset.theme = t;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'nuit' ? '#0A1328' : '#EDF1F7');
  }
  if (S.ville) { S.ville.theme(t); S.ville.heure(h); }
}

/* ── la barre et les deux espaces ── */
function monterInterface() {
  if (S.monte) return;
  S.monte = true;
  $('#app').innerHTML =
    '<header class="barre" id="barre">' +
      '<a class="marque" href="#/ville" aria-label="La Tour, vue d\'ensemble">' + LOGO + '<span><b>La Tour</b><small id="nomGroupe">' + esc((S.m && S.m.groupe && S.m.groupe.name) || 'LEXONOS') + '</small></span></a>' +
      '<nav class="bascule" id="bascule" aria-label="Espaces"><i></i><button data-espace="ville">' + ico('ville') + '<span>Ville</span></button><button data-espace="gestion">' + ico('gestion') + '<span>Gestion</span></button></nav>' +
      '<div class="barre-d">' +
        '<span class="etat-vie" id="etatVie"><span class="point"></span><span>connexion…</span></span>' +
        '<button class="btn btn-discret btn-icone compteur" data-act="decisions" title="Décisions qui t\'attendent">' + ico('decisions') + '<b id="nbDecisions"></b></button>' +
        '<button class="btn btn-discret btn-icone masque-tel" data-act="cycle" id="btnCycle" title="Faire passer maintenant les agents dont c\'est l\'heure">' + ico('eclair') + '</button>' +
        '<span style="position:relative"><button class="btn btn-discret btn-icone" data-act="compte" title="Ton compte" aria-haspopup="true">' + ico('reglages') + '</button></span>' +
      '</div>' +
    '</header>' +
    '<div class="calque" id="calque"></div>' +
    '<section class="gestion" id="gestion" aria-label="Gestion"></section>';
  Hud.monter($('#calque'));
  Gestion.monter($('#gestion'));
  Fiches.monter();
  document.addEventListener('click', clic);
  document.addEventListener('keydown', clavier);
  window.addEventListener('hashchange', routeur);
  window.addEventListener('resize', placerBascule);
  majBarre();
}

function placerBascule() {
  const b = $('#bascule'); if (!b) return;
  const on = b.querySelector('button.on') || b.querySelector('button');
  const i = b.querySelector('i');
  i.style.width = on.offsetWidth + 'px'; i.style.transform = 'translateX(' + (on.offsetLeft - 4) + 'px)';
}

function majBarre() {
  if (!S.m || !$('#barre')) return;
  const n = (S.m.proposals || []).filter((p) => p.status === 'a_louis').length;
  const b = $('#nbDecisions'); b.textContent = n || ''; b.className = n ? '' : 'zero';
  const v = $('#etatVie');
  const travail = S.m.agents.filter((a) => a.status === 'working').length;
  if (S.m.demo) v.innerHTML = '<span class="point waiting"></span><span>en attente de la base</span>';
  else v.innerHTML = '<span class="point ' + (travail ? 'working' : 'idle') + '"></span><span>' + (travail ? pluriel(travail, 'agent') + ' au travail' : 'tout est calme') + '</span>';
  const g = $('#nomGroupe'); if (g && S.m.groupe) g.textContent = S.m.groupe.name;
  $$bascule();
}
function $$bascule() {
  document.querySelectorAll('#bascule button').forEach((x) => x.classList.toggle('on', x.dataset.espace === S.espace));
  placerBascule();
}

/* ── le routeur : #/ville, #/ville/novalemo, #/gestion/ventes?statut=en_ligne ── */
function routeur() {
  if (!S.monte) return;
  const h = location.hash.replace(/^#\/?/, '');
  const [chemin, q] = h.split('?');
  const p = chemin.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(q || ''));
  if (p[0] === 'gestion') {
    S.espace = 'gestion'; S.section = p[1] || 'tableau'; S.params = params;
    Hud.cacher(); Gestion.afficher(S.section, params);
    if (S.ville) S.ville.actif(false);
  } else {
    S.espace = 'ville';
    Gestion.cacher(); Hud.afficher();
    if (S.ville) S.ville.actif(true);
    if (p[1]) Hud.ouvrir(p[1]); else Hud.fermerPanneau(true);
  }
  $$bascule();
  majTheme();
}

/* ── les clics de la barre ── */
function clic(ev) {
  const t = ev.target.closest('[data-espace],[data-act]');
  if (!t) { fermerMenu(); return; }
  if (t.dataset.espace) { aller(t.dataset.espace === 'ville' ? 'ville' : 'gestion/' + (S.section || 'tableau')); return; }
  const a = t.dataset.act;
  if (a === 'decisions') { aller('gestion/decisions'); return; }
  if (a === 'cycle') { lancerCycle(t); return; }
  if (a === 'compte') { basculerMenu(t); return; }
  if (a === 'deconnexion') { occupe(t, async () => { await porte.deconnexion(); location.reload(); }); return; }
  if (a === 'menu-reglages') { fermerMenu(); aller('gestion/reglages'); return; }
  if (a === 'menu-route') { fermerMenu(); aller('gestion/route'); return; }
  if (a === 'menu-securite') { fermerMenu(); aller('gestion/reglages?onglet=securite'); return; }
  if (a === 'menu-theme') { fermerMenu(); const l = ['auto', 'jour', 'nuit']; let p = 'auto'; try { p = localStorage.getItem('tour_theme') || 'auto'; } catch (e) { /* rien */ } const n = l[(l.indexOf(p) + 1) % 3]; try { localStorage.setItem('tour_theme', n); } catch (e) { /* rien */ } majTheme(); toast(n === 'auto' ? 'Thème : selon l\'heure de la Guadeloupe.' : n === 'jour' ? 'Thème : toujours clair.' : 'Thème : toujours sombre.', 'ok'); return; }
  if (a && ACTIONS[a]) ACTIONS[a](t, t.dataset);
}
function clavier(ev) {
  if (ev.key === 'Escape') {
    if (Fiches.ouvert()) { Fiches.fermer(); return; }
    if (S.espace === 'ville') { Hud.fermerPanneau(); aller('ville'); }
  }
}
function basculerMenu(btn) {
  const deja = $('#menuCompte'); if (deja) { deja.remove(); return; }
  const m = document.createElement('div'); m.className = 'menu-compte'; m.id = 'menuCompte';
  m.innerHTML = '<button data-act="menu-route">' + ico('route') + 'Mise en route</button><button data-act="menu-reglages">' + ico('reglages') + 'Réglages</button><button data-act="menu-securite">' + ico('cadenas') + 'Sécurité</button><button data-act="menu-theme">' + ico('lune') + 'Changer de thème</button><hr><button data-act="cycle-menu">' + ico('eclair') + 'Lancer un cycle</button><hr><button data-act="deconnexion">' + ico('sortie') + 'Se déconnecter</button>';
  btn.parentElement.appendChild(m);
  m.querySelector('[data-act="cycle-menu"]').addEventListener('click', (e) => { e.stopPropagation(); fermerMenu(); lancerCycle($('#btnCycle')); });
}
function fermerMenu() { const m = $('#menuCompte'); if (m) m.remove(); }

async function lancerCycle(btn, agentId) {
  if (demo()) { toast('La base n\'est pas encore branchée : la mise en route d\'abord.', 'err'); aller('gestion/route'); return; }
  S.cycle = true; poll();
  return occupe(btn, async () => {
    try {
      const r = await envoyer(agentId ? { agent: agentId } : {}, '/api/tick');
      if (r.occupe) toast('Un cycle tourne déjà, il se termine dans quelques minutes.');
      else if (r.passages) toast(pluriel(r.passages.length, 'passage') + ', ' + usd(r.passages.reduce((s, p) => s + p.cout, 0)) + (r.passages.length === 1 ? ' : ' + String(r.passages[0].resume || '').slice(0, 140) : ''), 'ok');
      return r;
    } finally { S.cycle = false; poll(); }
  });
}

Object.assign(hooks, { routeur: routeur, rafraichir: () => poll(), lancerCycle: lancerCycle, chargerMissions: chargerMissions, rechargerEtat: rechargerEtat, majTheme: majTheme });
demarrer();
