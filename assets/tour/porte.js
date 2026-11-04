// La porte : créer le mot de passe (une fois, prouvé par un jeton Vercel), se connecter, le retrouver s'il est oublié.
// Le mot de passe tapé reste dans cette page le temps du redémarrage de la tour, puis sert une seule fois à entrer.
import { $, esc, ico, LOGO, salut } from './outils.js';
import { porte } from './api.js';

let racine = null, suite = null, minimum = 10;

export function afficher(etat, opts) {
  suite = opts && opts.surEntree;
  minimum = (etat && etat.min) || 12;
  monter();
  if (etat.redemarre) return attente();
  if (!etat.configure) return creation(false);
  return connexion(etat);
}
function monter() { if (!racine) { racine = document.createElement('div'); racine.className = 'porte'; document.body.appendChild(racine); } }
// Après « Changer le mot de passe » dans les réglages : même attente, puis entrée avec le nouveau
export function apresChangement(mdp, res, opts) { suite = opts && opts.surEntree; monter(); redemarrage(mdp, res); }
function fermer() { if (racine) { racine.remove(); racine = null; } }

function cadre(html) {
  racine.innerHTML = '<div class="porte-c verre">' + '<div class="marque">' + LOGO + '<span><b>La Tour</b><small>LEXONOS</small></span></div>' + html + '</div>';
  const champ = racine.querySelector('input'); if (champ) setTimeout(() => champ.focus(), 60);
  racine.querySelectorAll('.oeil button').forEach((b) => b.addEventListener('click', () => {
    const i = b.parentElement.querySelector('input'); const v = i.type === 'password'; i.type = v ? 'text' : 'password';
    b.innerHTML = ico(v ? 'oeilBarre' : 'oeil'); b.setAttribute('aria-label', v ? 'Masquer' : 'Afficher');
  }));
}
const champMdp = (id, label, aide, auto) => '<label class="champ"><span>' + label + '</span><span class="oeil"><input class="saisie" id="' + id + '" type="password" autocomplete="' + (auto || 'current-password') + '" spellcheck="false"><button type="button" aria-label="Afficher">' + ico('oeil') + '</button></span>' + (aide ? '<small>' + aide + '</small>' : '') + '</label>';

function connexion(etat) {
  cadre('<h1>' + esc(salut()) + ' Louis</h1><p class="chapo">' + (etat && etat.expiree ? 'Ta session a expiré. Entre ton mot de passe pour rouvrir la tour.' : etat && etat.horsLigne ? 'La tour ne répond pas pour l\'instant. Réessaie dans un moment.' : 'Entre ton mot de passe pour ouvrir la tour.') + '</p>' +
    '<form id="fConnexion" autocomplete="on"><input type="text" name="username" value="louis" autocomplete="username" hidden>' + champMdp('mdp', 'Mot de passe') +
    '<p class="erreur-t" id="err"></p><button class="btn btn-primaire btn-large" type="submit">Entrer</button></form>' +
    '<a class="lien" href="#" id="oubli">Mot de passe oublié ?</a>');
  $('#oubli', racine).addEventListener('click', (e) => { e.preventDefault(); creation(true); });
  $('#fConnexion', racine).addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = e.submitter || $('button[type="submit"]', racine), mdp = $('#mdp', racine).value;
    if (!mdp) return erreur('Tape ton mot de passe.');
    b.classList.add('occupe');
    try { await porte.connexion(mdp); entrer(); }
    catch (err) { erreur(err.message); $('#mdp', racine).classList.add('erreur'); $('#mdp', racine).select(); }
    finally { b.classList.remove('occupe'); }
  });
}

function force(m) {
  const l = m.length, varie = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(m)).length;
  if (!l) return 0; if (l < minimum) return 1; if (l < 14) return varie >= 3 ? 3 : 2; if (l < 20) return varie >= 2 ? 4 : 3; return 4;
}
function creation(oubli) {
  cadre('<h1>' + (oubli ? 'Nouveau mot de passe' : 'Ferme la tour à clé') + '</h1>' +
    '<p class="chapo">' + (oubli ? 'Un jeton Vercel de ton compte prouve que c\'est toi. Le nouveau mot de passe remplace l\'ancien, toutes les sessions ouvertes sont coupées.' : 'Une seule fois. Un jeton Vercel prouve que c\'est ton compte, puis tu choisis ton mot de passe. Personne d\'autre ne pourra entrer.') + '</p>' +
    '<ol class="etapes"><li><span>Ouvre tes jetons Vercel, clique <b>Create Token</b> : nom « La Tour », portée « Novalem\'s projects », sans expiration. Copie-le.</span></li><li><span>Colle-le ci-dessous et choisis ton mot de passe.</span></li></ol>' +
    '<a class="btn btn-second btn-large" href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" style="margin-bottom:16px">' + ico('externe') + 'Ouvrir mes jetons Vercel</a>' +
    '<form id="fCreation" autocomplete="off">' +
    '<label class="champ"><span>Jeton Vercel</span><span class="oeil"><input class="saisie code" id="jeton" type="password" autocomplete="off" spellcheck="false" placeholder="colle le jeton ici"><button type="button" aria-label="Afficher">' + ico('oeil') + '</button></span></label>' +
    '<input type="text" name="username" value="louis" autocomplete="username" hidden>' +
    champMdp('mdp1', 'Ton mot de passe', 'Au moins ' + minimum + ' caractères. Une petite phrase se retient mieux qu\'un mot compliqué.', 'new-password') +
    '<div class="force" id="force"><i></i><i></i><i></i><i></i></div>' +
    '<label class="champ" style="margin-top:12px"><span>Encore une fois</span><input class="saisie" id="mdp2" type="password" autocomplete="new-password" spellcheck="false"></label>' +
    '<p class="erreur-t" id="err"></p><button class="btn btn-primaire btn-large" type="submit">' + ico('cadenas') + (oubli ? 'Changer le mot de passe' : 'Fermer la tour à clé') + '</button></form>' +
    (oubli ? '<a class="lien" href="#" id="retour">Je l\'ai retrouvé</a>' : '<p style="margin:14px 0 0;font-size:12.5px;color:var(--doux)">Le jeton sert aussi à la tour pour enregistrer tes autres codes à ta place. Ton mot de passe n\'est gardé nulle part en clair.</p>'));
  const r = $('#retour', racine); if (r) r.addEventListener('click', (e) => { e.preventDefault(); connexion({}); });
  $('#mdp1', racine).addEventListener('input', (e) => { $('#force', racine).className = 'force f' + force(e.target.value); });
  $('#fCreation', racine).addEventListener('submit', async (e) => {
    e.preventDefault();
    const jeton = $('#jeton', racine).value.trim(), m1 = $('#mdp1', racine).value, m2 = $('#mdp2', racine).value;
    racine.querySelectorAll('.saisie').forEach((x) => x.classList.remove('erreur'));
    if (!jeton) { $('#jeton', racine).classList.add('erreur'); return erreur('Colle d\'abord ton jeton Vercel.'); }
    if (m1.length < minimum) { $('#mdp1', racine).classList.add('erreur'); return erreur('Le mot de passe doit faire au moins ' + minimum + ' caractères.'); }
    if (m1 !== m2) { $('#mdp2', racine).classList.add('erreur'); return erreur('Les deux mots de passe ne sont pas les mêmes.'); }
    const b = e.submitter || $('button[type="submit"]', racine);
    b.classList.add('occupe');
    try { const res = await porte.creer(jeton, m1); redemarrage(m1, res); }
    catch (err) { erreur(err.message); if (/jeton/i.test(err.message)) $('#jeton', racine).classList.add('erreur'); }
    finally { b.classList.remove('occupe'); }
  });
}

// Une tour encore sur l'ancien mot de passe répond (le temps que la nouvelle démarre) : on attend qu'elle cède la place
function attente() {
  cadre('<h1>La tour redémarre</h1><p class="chapo">Le mot de passe vient de changer. La tour redémarre avec le nouveau, environ deux minutes, puis elle te le demande.</p><div class="attente-r"><span class="btn btn-discret btn-icone occupe" style="pointer-events:none"></span><div><b>Redémarrage en cours</b></div></div>');
  const tic = setInterval(async () => {
    try { const e = await porte.etat(); if (!e.redemarre) { clearInterval(tic); if (e.connecte) entrer(); else if (!e.configure) creation(false); else connexion(e); } }
    catch (err) { /* la tour redémarre : on réessaie */ }
  }, 4000);
}

// La tour redémarre avec le mot de passe (environ 2 minutes) ; dès que la tour qui répond connaît CETTE version, on entre
// avec (jamais un essai sur l'ancienne : il compterait comme raté)
function redemarrage(mdp, res) {
  const t0 = Date.now();
  cadre('<h1>La tour redémarre</h1><p class="chapo">Ton mot de passe est enregistré. La tour redémarre avec lui, environ deux minutes. Tu entres tout seul dès qu\'elle est prête.</p>' +
    '<div class="attente-r"><span class="btn btn-discret btn-icone occupe" style="pointer-events:none"></span><div><b id="rTexte">Redémarrage en cours</b><div style="font-size:12.5px;color:var(--doux)" id="rTemps">0 s</div></div></div>' +
    (res && res.note ? '<p class="erreur-t" style="margin-top:14px">' + esc(res.note) + '</p><button class="btn btn-second btn-large" id="recharger">Recharger la page</button>' : ''));
  const rb = $('#recharger', racine); if (rb) rb.addEventListener('click', () => location.reload());
  const tic = setInterval(async () => {
    const s = Math.round((Date.now() - t0) / 1000);
    const el = $('#rTemps', racine); if (el) el.textContent = s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0');
    if (s > 360) { const tx = $('#rTexte', racine); if (tx) tx.textContent = 'C\'est plus long que prévu : recharge la page dans une minute.'; }
    try {
      const e = await porte.etat();
      if (e.configure && !e.redemarre && (!res || !res.version || e.version === res.version)) {
        try { await porte.connexion(mdp); clearInterval(tic); mdp = null; entrer(); }
        catch (err) { if (err.statut === 401 || err.statut === 429) { clearInterval(tic); mdp = null; connexion({}); erreur(err.statut === 401 ? 'La tour a redémarré : entre ton mot de passe.' : err.message); } }
      }
    } catch (err) { /* la tour redémarre : on réessaie */ }
  }, 4000);
}

function erreur(t) { const e = $('#err', racine); if (e) e.textContent = t || ''; }
function entrer() { fermer(); if (suite) suite(); }
