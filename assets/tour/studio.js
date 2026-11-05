// La section Studio de la Gestion : les trois lignes, l'usine, et chaque vidéo avec son lecteur dans chaque langue.
// Louis peut regarder, renvoyer une scène à Oscar, refuser, valider à la place de Vera, relancer une fabrication ratée,
// et régler le rythme d'une ligne.
import { $, esc, ico, usd, depuis, pluriel, toast, occupe, dialogue } from './outils.js';
import { lireApi, envoyer } from './api.js';
import { nom, demo, action, aller } from './etat.js';

const TON = { accroche: 'nu', relecture: 'attention', reecriture: 'nu', verification: 'nu', script: '', scene: '', essai: 'cobalt', critique: 'attention', traduction: 'cobalt', langues: 'cobalt', prete: 'ok', publiee: 'ok', refuse: 'alerte', echec: 'alerte' };
// qui a la vidéo entre les mains à chaque étape
const QUI = { accroche: 'scenariste', relecture: 'prof_viral', reecriture: 'scenariste', verification: 'verif_studio', script: 'animateur', scene: 'monteur', essai: 'monteur', critique: 'critique_video', traduction: 'plume_fr', langues: 'monteur' };
const ECRITURE = ['accroche', 'relecture', 'reecriture', 'verification'];
const tete = (titre, texte, actions) => '<div class="s-tete"><div><h1>' + esc(titre) + '</h1>' + (texte ? '<p>' + texte + '</p>' : '') + '</div>' + (actions ? '<div class="ligne-actions">' + actions + '</div>' : '') + '</div>';
const vide = (titre, texte, bouton) => '<div class="vide"><b>' + esc(titre) + '</b>' + esc(texte) + (bouton || '') + '</div>';
let rechargeur = null;
export function brancherRechargeStudio(fn) { rechargeur = fn; }
const recharger = () => { if (rechargeur) rechargeur(); };
let dernier = null;

function carteUsine(d) {
  const u = d.usine || {};
  if (!u.branchee) return '<div class="barre-pilote manque"><div><b>L\'usine n\'est pas encore branchée</b><span>La salle d\'écriture travaille déjà (accroches, scripts, relecture, vérification) ; les vidéos se fabriquent dès que le jeton GitHub est collé (2 minutes).</span></div><button class="btn btn-primaire btn-petit" data-aller="gestion/route">Mise en route</button></div>';
  const f = (u.fabrications || []).slice(0, 4);
  const enCours = f.filter((x) => x.etat !== 'completed').length;
  return '<div class="carte" style="margin-bottom:14px"><h2 class="carte-t">L\'usine<small>GitHub Actions, ' + esc(u.depot || '') + '</small></h2>' +
    (f.length ? '<div class="studio-fab">' + f.map((x) => '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer"><span class="pastille ' + (x.etat !== 'completed' ? 'cobalt' : x.resultat === 'success' ? 'ok' : 'alerte') + '">' + esc(x.etat !== 'completed' ? 'en cours' : x.resultat === 'success' ? 'finie' : 'ratée') + '</span><b>' + esc(x.nom) + '</b><small>' + esc(depuis(x.le)) + '</small></a>').join('') + '</div>' : '<p style="margin:0;color:var(--doux);font-size:13px">Aucune fabrication pour l\'instant.</p>') +
    (enCours ? '<p style="margin:10px 0 0;font-size:12.5px;color:var(--doux)">' + pluriel(enCours, 'fabrication') + ' en cours (10 à 15 minutes chacune).</p>' : '') + '</div>';
}

function carteLignes(d) {
  const L = d.lignes || {}, R = d.reglages || {}, noms = d.langues || {};
  return '<div class="grille studio-lignes">' + Object.keys(L).map((k) => {
    const l = L[k], r = R[k] || {};
    const etat = l.actif ? (r.videos_jour ? '<span class="pastille ok">En service</span>' : '<span class="pastille attention">En pause</span>') : '<span class="pastille nu">À brancher</span>';
    return '<div class="carte"><h2 class="carte-t">' + esc(l.nom) + etat + '</h2><p style="margin:0 0 10px;color:var(--encre-2);font-size:13px">' + esc(l.court) + ', ' + esc((l.plateformes || []).join(' et ')) + '</p>' +
      (l.actif ? '<p style="margin:0;font-size:12.5px;color:var(--doux)">' + esc(r.videos_jour) + ' vidéo(s) par jour, en ' + esc((r.langues || []).map((x) => noms[x] || x).join(', ')) + '</p><div class="ligne-actions" style="margin-top:10px"><button class="btn btn-second btn-petit" data-act="studioRythme" data-ligne="' + k + '" data-v="' + esc(r.videos_jour) + '">Régler le rythme</button></div>' : '<p style="margin:0;font-size:12.5px;color:var(--doux)">' + esc(l.attente || '') + '</p>') + '</div>';
  }).join('') + '</div>';
}

function ficheVideo(v, noms) {
  const c = v.critique;
  const etape = QUI[v.statut] ? ' chez ' + nom(QUI[v.statut]) : '';
  const lecteurs = (v.rendus || []).filter((r) => r.video);
  const enCours = (v.rendus || []).filter((r) => r.etat === 'demande').map((r) => noms[r.langue] || r.langue);
  const ratees = (v.rendus || []).filter((r) => r.etat === 'echec');
  let h = '<article class="fiche studio-v"><div class="fiche-t"><div><b>' + esc(v.titre || v.sujet || 'Vidéo ' + v.id) + '</b><span class="s">' + esc([v.sujet, 'n° ' + v.id, depuis(v.maj), usd(v.cout)].filter(Boolean).join(', ')) + '</span></div><span class="pastille ' + (TON[v.statut] || '') + '">' + esc((dernier.statuts || {})[v.statut] || v.statut) + esc(etape) + '</span></div>';
  const e = v.ecriture || {};
  if (e.accroche) h += '<p class="info">' + esc(nom('accrocheur')) + ' : « ' + esc(String(e.accroche.voix).replace(/\*/g, '')) + ' » <span style="color:var(--doux)">(la meilleure de ' + esc(e.accroche.nombre) + ' accroches' + (v.accroche ? ', à l\'écran : « ' + esc(String(v.accroche).replace(/\*/g, '')) + ' »' : '') + ')</span></p>';
  else if (v.accroche) h += '<p class="info">Accroche : « ' + esc(String(v.accroche).replace(/\*/g, '')) + ' »</p>';
  if (e.viral) h += '<p class="info"><b>' + esc(nom('prof_viral')) + ' ' + esc(e.viral.note) + '/10</b>' + (e.viral.versions > 1 ? ' (version ' + esc(e.viral.versions) + ')' : '') + ' : ' + esc(e.viral.resume || '') + '</p>';
  if (e.verif) h += '<p class="info">' + esc(nom('verif_studio')) + ' : ' + esc(pluriel(e.verif.faits, 'fait')) + ' vérifiés' + (e.verif.corriges ? ', ' + esc(e.verif.corriges) + ' corrigé(s)' : '') + (e.verif.faux ? ', <b style="color:var(--alerte)">' + esc(e.verif.faux) + ' faux</b>' : '') + '. ' + esc(e.verif.resume || '') + '</p>';
  if (e.blagues) h += '<p class="info">' + esc(nom('plume_fr')) + ', l\'humour de la version française : ' + esc(e.blagues.join(' ; ')) + '</p>';
  if (c) h += '<p class="info"><b>' + esc(nom('critique_video')) + ' ' + esc(c.note) + '/10</b> : ' + esc(c.resume || '') + (c.problemes && c.problemes.length ? '<br><span style="color:var(--doux)">' + c.problemes.slice(0, 3).map((p) => 'plan ' + esc(p.plan) + ' : ' + esc(p.constat)).join('<br>') + '</span>' : '') + '</p>';
  if (v.a_verifier && v.a_verifier.length) h += '<p class="info" style="color:var(--attention)">À vérifier : ' + esc(v.a_verifier.join(' ; ')) + '</p>';
  if (enCours.length) h += '<p class="info">À l\'usine : ' + esc(enCours.join(', ')) + '</p>';
  if (ratees.length) h += '<p class="info" style="color:var(--alerte)">' + ratees.map((r) => esc(noms[r.langue] || r.langue) + ' : ' + esc(r.erreur || 'échec')).join('<br>') + '</p>';
  if (lecteurs.length) h += '<div class="studio-lecteurs">' + lecteurs.map((r) => '<figure><video controls preload="none" playsinline' + (r.vignette ? ' poster="' + esc(r.vignette) + '"' : '') + ' src="' + esc(r.video) + '"></video><figcaption>' + esc(noms[r.langue] || r.langue) + (r.duree ? ', ' + Math.round(r.duree) + ' s' : '') + (r.titre ? '<span>' + esc(r.titre) + '</span>' : '') + '</figcaption></figure>').join('') + '</div>';
  const b = [];
  if (v.statut === 'critique' || v.statut === 'refuse') b.push('<button class="btn btn-ok btn-petit" data-act="studioVideo" data-faire="valider" data-id="' + v.id + '">Valider</button>');
  if (['scene', 'essai', 'critique', 'traduction', 'langues', 'prete', 'refuse'].indexOf(v.statut) >= 0) b.push('<button class="btn btn-second btn-petit" data-act="studioVideo" data-faire="refaire" data-id="' + v.id + '">Autre scène</button>');
  if (v.statut === 'echec' || ratees.length) b.push('<button class="btn btn-second btn-petit" data-act="studioVideo" data-faire="relancer" data-id="' + v.id + '">Relancer</button>');
  if (['refuse', 'publiee'].indexOf(v.statut) < 0) b.push('<button class="btn btn-danger btn-petit" data-act="studioVideo" data-faire="refuser" data-id="' + v.id + '">Refuser</button>');
  if (b.length) h += '<div class="ligne-actions">' + b.join('') + '</div>';
  return h + '</article>';
}

const studio = {
  titre: 'Vidéos', court: 'Studio', icone: 'studio', vivante: false,
  compte: () => (dernier && dernier.comptes ? (dernier.comptes.prete || 0) : 0),
  async charger(p) { if (demo()) return { demo: true, videos: [] }; return lireApi('studio', { statut: p.statut || '' }); },
  rendre(p, d) {
    d = d || {};
    dernier = d;
    if (d.erreur) return tete('Studio 3D') + vide('Le Studio ne se charge pas', d.erreur);
    const c = d.comptes || {}, noms = d.langues || {};
    const total = Object.keys(c).reduce((s, k) => s + c[k], 0);
    let h = tete('Studio 3D', 'Les vidéos se font seules. La salle d\'écriture : ' + nom('actu_studio') + ' suit l\'actualité, ' + nom('accrocheur') + ' trouve les accroches, ' + nom('scenariste') + ' écrit, ' + nom('prof_viral') + ' juge la viralité, ' + nom('verif_studio') + ' vérifie les faits. La fabrication : ' + nom('animateur') + ' monte la 3D, l\'usine rend, ' + nom('critique_video') + ' juge, ' + nom('plume_fr') + ' écrit en français, ' + nom('localisation') + ' adapte le reste. ' + (total ? pluriel(total, 'vidéo') + ', ' + usd(d.cout_total) + ' d\'IA en tout.' : ''));
    if (demo()) return h + vide('La base n\'est pas encore branchée', 'La mise en route d\'abord.', '<button class="btn btn-primaire btn-petit" style="margin-top:10px" data-aller="gestion/route">Mise en route</button>');
    h += carteUsine(d);
    h += carteLignes(d);
    const filtres = [['', 'Tout'], ['prete', 'Prêtes'], ['critique', 'À juger'], ['langues', 'Langues'], ['ecriture', 'En écriture'], ['script', 'À monter'], ['refuse', 'Refusées'], ['echec', 'Échecs']];
    const nb = (k) => (k === 'ecriture' ? ECRITURE.reduce((s2, x) => s2 + (c[x] || 0), 0) : c[k]);
    h += '<div class="filtres" style="margin-top:16px">' + filtres.map((x) => '<button data-filtre="' + x[0] + '" class="' + ((p.statut || '') === x[0] ? 'on' : '') + '">' + esc(x[1]) + (x[0] && nb(x[0]) ? '<b>' + nb(x[0]) + '</b>' : '') + '</button>').join('') + '</div>';
    const rows = d.videos || [];
    h += rows.length ? rows.map((v) => ficheVideo(v, noms)).join('') : vide(p.statut ? 'Aucune vidéo dans cet état' : 'Aucune vidéo pour l\'instant', nom('accrocheur') + ' lance le premier sujet à son prochain passage.');
    return h;
  }
};

action('studioVideo', async (b, d) => {
  const libelles = { valider: ['Valider cette vidéo ?', 'Elle part en traduction, puis à l\'usine pour les autres langues.', 'Valider'], refaire: ['Demander une autre scène ?', 'Oscar refait la scène 3D, puis l\'usine refait le rendu.', 'Autre scène'], refuser: ['Refuser cette vidéo ?', 'Elle sort de la fabrication.', 'Refuser'], relancer: ['Relancer la fabrication ?', nom('monteur') + ' renvoie les langues ratées à l\'usine.', 'Relancer'] };
  const l = libelles[d.faire];
  if (!l || !(await dialogue({ titre: l[0], texte: l[1], ok: l[2], danger: d.faire === 'refuser' }))) return;
  occupe(b, async () => { await envoyer({ op: 'studio_video', id: Number(d.id), faire: d.faire }); toast('C\'est noté.', 'ok'); recharger(); });
});
action('studioRythme', async (b, d) => {
  const v = window.prompt('Vidéos par jour pour cette ligne (0 = pause) :', d.v || '2');
  if (v == null) return;
  const n = parseInt(v, 10);
  if (!(n >= 0 && n <= 12)) { toast('Un nombre entre 0 et 12.', 'err'); return; }
  occupe(b, async () => { await envoyer({ op: 'studio_regler', ligne: d.ligne, videos_jour: n }); toast('Rythme réglé.', 'ok'); recharger(); });
});

export const SECTIONS_STUDIO = { studio: studio };
export { aller };
