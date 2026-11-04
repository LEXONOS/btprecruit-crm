// L'espace Gestion : la colonne de navigation (en bas sur téléphone) et la section ouverte.
import { $, esc, ico } from './outils.js';
import { S, surMonde, aller } from './etat.js';
import { SECTIONS, brancherRecharge } from './sections.js';
import { SECTIONS_PILOTAGE, brancherRechargePilotage } from './reglages.js';
import * as Fiches from './fiches.js';

const TOUTES = Object.assign({}, SECTIONS, SECTIONS_PILOTAGE);
const MENU = [
  { titre: null, ids: ['tableau'] },
  { titre: 'Novalemo', ids: ['ventes', 'reponses', 'emails', 'prospects'] },
  { titre: 'Le groupe', ids: ['equipe', 'decisions', 'couts', 'veille'] },
  { titre: 'Pilotage', ids: ['route', 'reglages'] }
];
const BAS = ['tableau', 'ventes', 'reponses', 'equipe', 'plus'];

let racine = null, nav = null, contenu = null, bas = null, courante = null, params = {}, jeton = 0;

export function monter(el) {
  racine = el;
  racine.innerHTML = '<nav class="nav-g" id="navG" aria-label="Sections"></nav><main class="contenu" id="contenuG"><div class="contenu-i" id="contenuI"></div></main><nav class="nav-bas verre" id="navBas" aria-label="Sections"></nav>';
  nav = $('#navG', racine); contenu = $('#contenuI', racine); bas = $('#navBas', racine);
  racine.addEventListener('click', clic);
  brancherRecharge(recharger); brancherRechargePilotage(recharger);
  racine.addEventListener('input', (e) => { if (courante && TOUTES[courante].saisie) TOUTES[courante].saisie(e, contenu); });
  surMonde(() => {
    majNav();
    if (!courante || racine.classList.contains('visible') === false) return;
    const s = TOUTES[courante];
    if (!s.vivante) return;
    // ne jamais effacer une saisie en cours
    const a = document.activeElement;
    if (a && contenu.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    rendre(true);
  });
}
export function afficher(id, p) {
  if (!TOUTES[id]) id = 'tableau';
  const change = id !== courante || JSON.stringify(p || {}) !== JSON.stringify(params);
  courante = id; params = p || {};
  racine.classList.add('visible');
  majNav();
  if (change) { contenu.parentElement.scrollTop = 0; rendre(false); }
}
export function cacher() { if (racine) racine.classList.remove('visible'); }

function majNav() {
  if (!nav) return;
  let h = '';
  MENU.forEach((g) => {
    if (g.titre) h += '<h3>' + esc(g.titre) + '</h3>';
    g.ids.forEach((id) => {
      const s = TOUTES[id]; const n = s.compte ? s.compte() : 0;
      h += '<button data-section="' + id + '" class="' + (id === courante ? 'on' : '') + '">' + ico(s.icone) + '<span>' + esc(s.titre) + '</span>' + (n ? '<b class="' + (s.chaud ? 'chaud' : '') + '">' + n + '</b>' : '') + '</button>';
    });
  });
  nav.innerHTML = h;
  bas.innerHTML = BAS.map((id) => {
    if (id === 'plus') return '<button data-plus class="' + (BAS.indexOf(courante) < 0 ? 'on' : '') + '">' + ico('plusMenu') + '<span>Plus</span></button>';
    const s = TOUTES[id]; const n = s.compte ? s.compte() : 0;
    return '<button data-section="' + id + '" class="' + (id === courante ? 'on' : '') + '">' + ico(s.icone) + '<span>' + esc(s.court || s.titre) + '</span>' + (n && s.chaud ? '<b>' + n + '</b>' : '') + '</button>';
  }).join('');
}

async function rendre(silence) {
  const s = TOUTES[courante], j = ++jeton;
  if (!silence && s.charger) contenu.innerHTML = '<div class="s-tete"><div><h1>' + esc(s.titre) + '</h1></div></div><div class="carte"><p style="color:var(--doux);margin:0">Chargement…</p></div>';
  let donnees = null;
  if (s.charger) { try { donnees = await s.charger(params); } catch (e) { donnees = { erreur: e.message }; } }
  if (j !== jeton) return;
  const sc = contenu.parentElement.scrollTop;
  contenu.innerHTML = s.rendre(params, donnees);
  if (s.apres) s.apres(contenu, params, donnees);
  if (silence) contenu.parentElement.scrollTop = sc;
}
export function recharger() { if (courante) rendre(true); }

function clic(e) {
  const t = e.target.closest('[data-section],[data-plus],[data-filtre],[data-agent],[data-co],[data-prop],[data-aller]');
  if (!t) return;
  const d = t.dataset;
  if (d.section) { const m = $('#menuPlus'); if (m) m.remove(); aller('gestion/' + d.section); return; }
  if (d.plus != null) { plus(); return; }
  if (d.filtre != null) { const p = Object.assign({}, params); const k = d.cle || 'statut'; if (d.filtre) p[k] = d.filtre; else delete p[k]; const q = new URLSearchParams(p).toString(); aller('gestion/' + courante + (q ? '?' + q : '')); return; }
  if (d.agent) { Fiches.agent(d.agent); return; }
  if (d.co) { Fiches.entreprise(d.co); return; }
  if (d.prop) { Fiches.proposition(Number(d.prop)); return; }
  if (d.aller) { aller(d.aller); }
}
// sur téléphone : les sections qui ne tiennent pas dans la barre du bas
function plus() {
  const ids = ['emails', 'prospects', 'decisions', 'couts', 'veille', 'route', 'reglages'];
  let m = $('#menuPlus');
  if (m) { m.remove(); return; }
  m = document.createElement('div'); m.className = 'menu-compte'; m.id = 'menuPlus';
  m.style.cssText = 'position:fixed;top:auto;bottom:84px;right:12px;left:auto';
  m.innerHTML = ids.map((id) => '<button data-section="' + id + '">' + ico(TOUTES[id].icone) + esc(TOUTES[id].titre) + '</button>').join('');
  racine.appendChild(m);
  setTimeout(() => document.addEventListener('click', function f(ev) { if (!ev.target.closest('#menuPlus,[data-plus]')) { const x = $('#menuPlus'); if (x) x.remove(); } document.removeEventListener('click', f); }), 0);
}
