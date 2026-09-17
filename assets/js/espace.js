/* L'Officine : espace équipe (commandes, catalogue, offres, événements, équipe) */
(function(){
'use strict';
var C = window.OFFICINE_CONFIG || {};
var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var CATS = {'spiritueux': 'Spiritueux', 'rhums': 'Rhums & canne', 'vins': 'Vins & champagnes', 'epicerie': 'Épicerie fine', 'sans-alcool': 'Sans alcool'};
var FORMATS = ['Masterclass', 'Atelier dégustation', 'Lancement', 'Soirée privée'];
var BADGES = ['Nouveauté', 'Coup de cœur', 'Édition limitée', 'Dernières bouteilles'];
var MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
var POIGNEE = '<span class="poignee" aria-label="Glisser pour déplacer" title="Glisser pour déplacer"><svg viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg></span>';
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function euros(n){ return Number(n || 0).toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €'; }
function nombre(v){ var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; }
function jour(s){ var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function isoJour(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function aujourdHui(){ var d = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Guadeloupe'})); d.setHours(0, 0, 0, 0); return d; }
function slug(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
function dateHeure(iso){ return new Date(iso).toLocaleString('fr-FR', {timeZone: 'America/Guadeloupe', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}); }
function dateLongue(s){ var d = jour(s); return d.toLocaleDateString('fr-FR', {weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'}); }
var tt;
function toast(msg, ko, action){
  var t = $('#toast');
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button type="button">' + esc(action.texte) + '</button>' : '');
  t.className = 'toast on' + (ko ? ' ko' : '');
  if (action) $('button', t).onclick = function(){ t.className = 'toast'; action.faire(); };
  clearTimeout(tt); tt = setTimeout(function(){ t.className = 'toast'; }, action ? 6000 : (ko ? 5000 : 2600));
}
var FORMES = {
  spiritueux: 'M38 6h24v26c0 6 22 8 22 22v140c0 5-3 8-8 8H24c-5 0-8-3-8-8V54c0-14 22-16 22-22z',
  rhums: 'M42 4h16v46c0 12 26 18 26 44v100c0 4-3 6-6 6H22c-3 0-6-2-6-6V94c0-26 26-32 26-44z',
  vins: 'M44 2h12v58c0 14 22 22 22 40v96c0 3-2 4-4 4H26c-2 0-4-1-4-4v-96c0-18 22-26 22-40z',
  epicerie: 'M22 82h56v8c6 2 8 6 8 12v84c0 8-6 14-14 14H28c-8 0-14-6-14-14v-84c0-6 2-10 8-12z',
  'sans-alcool': 'M40 8h20v22c0 8 30 20 30 62v90c0 10-8 18-18 18H28c-10 0-18-8-18-18V92c0-42 30-54 30-62z'
};
var TEINTES = {spiritueux: ['#3A2410', '#6B4420'], rhums: ['#4A2A0C', '#8A5520'], vins: ['#1D2A1E', '#2F4230'], epicerie: ['#5C2A22', '#8C4A38'], 'sans-alcool': ['#2F4A48', '#5E7F79']};
var nbSvg = 0;
function bouteille(cat){
  var f = FORMES[cat] || FORMES.rhums, t = TEINTES[cat] || TEINTES.rhums, id = 'g' + (nbSvg++);
  var bouchon = cat === 'epicerie' ? '<rect x="18" y="70" width="64" height="14" rx="3" fill="#B8955A"/>' :
    '<rect x="' + (cat === 'vins' ? 43 : 39) + '" y="0" width="' + (cat === 'vins' ? 14 : 22) + '" height="' + (cat === 'vins' ? 30 : 22) + '" rx="2" fill="#B8955A"/>';
  var etiq = cat === 'epicerie' ? [26, 118, 48, 50] : cat === 'vins' ? [26, 120, 48, 52] : [22, 112, 56, 58];
  return '<svg class="btl" viewBox="0 0 100 212" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" x2="1">' +
    '<stop offset="0" stop-color="' + t[0] + '"/><stop offset=".35" stop-color="' + t[1] + '"/><stop offset=".6" stop-color="' + t[0] + '"/><stop offset="1" stop-color="' + t[0] + '"/></linearGradient></defs>' +
    '<ellipse cx="50" cy="208" rx="40" ry="3.5" fill="rgba(6,27,30,.18)"/>' +
    '<path d="' + f + '" fill="url(#' + id + ')"/>' + bouchon +
    '<path d="M' + (etiq[0] + 6) + ' 60 q2 40 0 130" stroke="rgba(255,255,255,.18)" stroke-width="3" fill="none"/>' +
    '<rect x="' + etiq[0] + '" y="' + etiq[1] + '" width="' + etiq[2] + '" height="' + etiq[3] + '" fill="#EFE8DB"/>' +
    '<rect x="' + (etiq[0] + 3) + '" y="' + (etiq[1] + 3) + '" width="' + (etiq[2] - 6) + '" height="' + (etiq[3] - 6) + '" fill="none" stroke="#B8955A" stroke-width=".6"/>' +
    '<path d="M50 ' + (etiq[1] + 12) + 'c-3 0-3 7 0 7s3-7 0-7zM50 ' + (etiq[1] + 19) + 'v16M50 ' + (etiq[1] + 29) + 'h3.5M50 ' + (etiq[1] + 32) + 'h2.4" stroke="#B8955A" stroke-width=".9" fill="none"/>' +
    '<text x="50" y="' + (etiq[1] + etiq[3] - 8) + '" text-anchor="middle" font-family="Bodoni Moda, serif" font-size="6.5" fill="#122428">L\'Officine</text></svg>';
}

if (!C.supabaseUrl || !C.supabaseAnon || !window.supabase){
  document.body.innerHTML = '<p style="padding:40px">' + (!window.supabase ? 'Le module de connexion n\'a pas pu se charger. Vérifiez la connexion internet ou désactivez un éventuel bloqueur de publicité, puis rechargez la page.' : 'L\'espace n\'est pas encore relié à la base (assets/js/config.js vide). Rechargez avec Ctrl + Maj + R.') + '</p>';
  return;
}
var typeLien = (location.hash.match(/type=(\w+)/) || [])[1] || '';
// Session gardée uniquement en mémoire : chaque ouverture de l'espace demande l'e-mail et le mot de passe
var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnon, {auth: {persistSession: false, autoRefreshToken: true, detectSessionInUrl: true}});
try { Object.keys(localStorage).forEach(function(k){ if (/^sb-.*-auth-token/.test(k)) localStorage.removeItem(k); }); } catch(e){}
// Déconnexion automatique après 30 minutes sans activité
(function(){
  var limite = 30 * 60 * 1000, derniere = Date.now();
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(function(t){ document.addEventListener(t, function(){ derniere = Date.now(); }, {passive: true}); });
  setInterval(function(){
    if (Date.now() - derniere > limite && !$('#vueApp').hidden){
      sb.auth.signOut().then(function(){ location.href = '/espace'; });
    }
  }, 30000);
})();
var etat = {moi: null, produits: [], evenements: [], commandes: [], equipe: [], statut: 'a_preparer', periode: 'avenir', vue: 'commandes', filtreProd: ''};

/* ================= Connexion ================= */
function afficher(connecte){ $('#vueConnexion').hidden = connecte; $('#vueApp').hidden = !connecte; }
var modeMdp = false;
function modeNouveauMdp(invite){
  modeMdp = true; afficher(false);
  $('#cnxTitre').textContent = invite ? 'Bienvenue dans l\'équipe' : 'Nouveau mot de passe';
  $('#cnxAide').textContent = 'Choisissez votre mot de passe (6 caractères minimum).';
  $('#lblMail').hidden = true; $('#cnxMail').required = false;
  $('#cnxMdp').autocomplete = 'new-password';
  $('#cnxBtn').textContent = 'Enregistrer et entrer';
  $('#cnxOubli').hidden = true;
}
$('#formCnx').addEventListener('submit', function(e){
  e.preventDefault();
  var msg = $('#cnxMsg'), btn = $('#cnxBtn');
  btn.disabled = true; msg.className = 'msg'; msg.textContent = '';
  if (modeCreer){
    var nom = $('#cnxNom').value.trim(), mail = $('#cnxMail').value.trim(), mdp = $('#cnxMdp').value;
    if (nom.length < 2 || !/^\S+@\S+\.\S+$/.test(mail) || mdp.length < 8){
      msg.className = 'msg ko'; msg.textContent = 'Indiquez votre nom, votre e-mail et un mot de passe de 8 caractères minimum.'; btn.disabled = false; return;
    }
    sb.auth.signUp({email: mail, password: mdp, options: {data: {nom: nom}, emailRedirectTo: location.origin + '/espace'}}).then(function(r){
      if (r.error) throw r.error;
      sb.auth.signOut();
      msg.className = 'msg ok';
      msg.textContent = r.data.session ? 'Compte créé. Votre accès sera activé très rapidement, vous pourrez alors vous connecter.' : 'Compte créé. Confirmez votre adresse via l\'e-mail reçu : votre accès sera ensuite activé très rapidement.';
      $('#cnxCreer').click(); msg.className = 'msg ok';
      msg.textContent = r.data.session ? 'Compte créé. Votre accès sera activé très rapidement, vous pourrez alors vous connecter.' : 'Compte créé. Confirmez votre adresse via l\'e-mail reçu : votre accès sera ensuite activé très rapidement.';
    }).catch(function(err){
      msg.className = 'msg ko';
      msg.textContent = /registered|exists/i.test(err.message) ? 'Un compte existe déjà avec cette adresse : connectez-vous.' : 'Création impossible : ' + err.message;
    }).then(function(){ btn.disabled = false; });
    return;
  }
  var p = modeMdp
    ? sb.auth.updateUser({password: $('#cnxMdp').value}).then(function(r){ if (r.error) throw r.error; modeMdp = false; history.replaceState(null, '', '/espace'); return demarrer(); })
    : sb.auth.signInWithPassword({email: $('#cnxMail').value.trim(), password: $('#cnxMdp').value}).then(function(r){ if (r.error) throw r.error; return demarrer(); });
  p.catch(function(err){
    msg.className = 'msg ko';
    msg.textContent = /Invalid login/i.test(err.message) ? 'E-mail ou mot de passe incorrect.' : /at least|short/i.test(err.message) ? 'Le mot de passe doit faire au moins 6 caractères.' : 'Connexion impossible : ' + err.message;
  }).then(function(){ btn.disabled = false; });
});
var modeCreer = false;
$('#cnxCreer').addEventListener('click', function(){
  modeCreer = !modeCreer;
  $('#lblNom').hidden = !modeCreer; $('#cnxNom').required = modeCreer;
  $('#cnxTitre').textContent = modeCreer ? 'Créer mon compte' : 'Espace équipe';
  $('#cnxBtn').textContent = modeCreer ? 'Créer mon compte' : 'Se connecter';
  $('#cnxCreer').textContent = modeCreer ? 'J\'ai déjà un compte' : 'Première fois ? Créer mon compte';
  $('#cnxOubli').hidden = modeCreer;
  $('#cnxMdp').autocomplete = modeCreer ? 'new-password' : 'current-password';
  $('#cnxMsg').textContent = '';
});
$('#cnxOubli').addEventListener('click', function(){
  var mail = $('#cnxMail').value.trim(), msg = $('#cnxMsg');
  if (!mail){ msg.className = 'msg ko'; msg.textContent = 'Indiquez d\'abord votre e-mail.'; return; }
  sb.auth.resetPasswordForEmail(mail, {redirectTo: location.origin + '/espace'}).then(function(r){
    msg.className = r.error ? 'msg ko' : 'msg ok';
    msg.textContent = r.error ? 'Envoi impossible : ' + r.error.message : 'Un lien pour choisir un nouveau mot de passe vient de partir par e-mail.';
  });
});
$('#deco').addEventListener('click', function(){ sb.auth.signOut().then(function(){ location.href = '/espace'; }); });
sb.auth.onAuthStateChange(function(ev){ if (ev === 'PASSWORD_RECOVERY') modeNouveauMdp(false); });

function jeton(){ return sb.auth.getSession().then(function(r){ return r.data.session ? r.data.session.access_token : ''; }); }
function api(route, corps){
  return jeton().then(function(j){
    return fetch(route, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + j}, body: JSON.stringify(corps)});
  }).then(function(r){ return r.json().catch(function(){ return {ok: false}; }); })
    .then(function(d){ if (!d.ok) throw new Error(d.erreur || 'Action impossible pour le moment.'); return d; });
}

function demarrer(){
  return sb.auth.getUser().then(function(r){
    var u = r.data && r.data.user;
    if (!u){ afficher(false); return; }
    return sb.from('admins').select('*').eq('user_id', u.id).then(function(a){
      if (a.error || !a.data || !a.data.length){
        afficher(false);
        $('#cnxMsg').className = 'msg ko';
        $('#cnxMsg').textContent = 'Votre compte existe, mais son accès n\'est pas encore activé. Il le sera très rapidement.';
        sb.auth.signOut(); return;
      }
      etat.moi = a.data[0];
      etat.moi.email = etat.moi.email || u.email;
      $('#moiNom').textContent = etat.moi.nom || etat.moi.email;
      $('#moiRole').textContent = etat.moi.super ? 'Studio Novalem' : (etat.moi.role === 'gerant' ? 'Gérant' : 'Équipe');
      $$('[data-vue-btn="studio"]').forEach(function(b){ b.hidden = !etat.moi.super; });
      $('#eqInviter').hidden = etat.moi.role !== 'gerant';
      afficher(true);
      var cible = (location.hash.replace('#', '').match(/^(commandes|catalogue|evenements|equipe|studio)$/) || [])[0] || 'commandes';
      if (cible === 'studio' && !etat.moi.super) cible = 'commandes';
      aller(cible);
      if (etat.moi.super) chargerStudio();
      setInterval(function(){ if (!document.hidden) chargerCommandes(); }, 30000);
      window.addEventListener('focus', function(){ chargerCommandes(); });
      return Promise.all([chargerCommandes(), chargerProduits(), chargerEvenements(), chargerEquipe()]);
    });
  });
}
sb.auth.getSession().then(function(r){
  if (typeLien === 'recovery') return;
  if (r.data.session){
    if (typeLien === 'invite'){ modeNouveauMdp(true); return; }
    demarrer();
  } else afficher(false);
});

/* ================= Navigation ================= */
$('#navMobile').innerHTML = $('#navApp').innerHTML.replace(/id="badge(\w+)"/g, 'data-badge="$1"').replace('id="navStudio"', '');
function aller(vue){
  etat.vue = vue;
  $$('[data-vue]').forEach(function(v){ v.hidden = v.dataset.vue !== vue; });
  $$('[data-vue-btn]').forEach(function(b){ b.setAttribute('aria-current', b.dataset.vueBtn === vue); });
  history.replaceState(null, '', '#' + vue);
  window.scrollTo(0, 0);
}
document.addEventListener('click', function(e){ var b = e.target.closest('[data-vue-btn]'); if (b) aller(b.dataset.vueBtn); });
function badge(nom, n){
  [$('#badge' + nom)].concat($$('[data-badge="' + nom + '"]')).forEach(function(el){ if (!el) return; el.hidden = !n; el.textContent = n; });
}

/* ================= Panneau d'édition ================= */
var panneau = $('#panneau'), voile = $('#voile'), courant = null, modifie = false;
function ouvrir(o){
  courant = o; modifie = false;
  $('#pTitre').textContent = o.titre;
  $('#pForm').innerHTML = o.html;
  $('#pApercu').hidden = !o.apercu;
  $('.p-zone').classList.toggle('sans-apercu', !o.apercu);
  panneau.classList.toggle('etroit', !o.apercu);
  $('#pSuppr').hidden = !o.supprimer;
  $('#pSuppr').textContent = o.texteSuppr || 'Supprimer';
  $('#pOk').textContent = o.okTexte || 'Enregistrer';
  $('#pOk').hidden = !o.valider;
  $('#pEtat').textContent = '';
  panneau.classList.add('on'); voile.classList.add('on'); panneau.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#pForm').scrollTop = 0;
  if (o.apres) o.apres($('#pForm'));
}
function fermer(force){
  if (!panneau.classList.contains('on')) return;
  if (!force && modifie && !confirm('Des modifications ne sont pas enregistrées. Fermer quand même ?')) return;
  panneau.classList.remove('on'); voile.classList.remove('on'); panneau.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  courant = null;
}
voile.addEventListener('click', function(){ fermer(); });
$('[data-fermer]').addEventListener('click', function(){ fermer(); });
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') fermer(); });
$('#pForm').addEventListener('input', function(){ modifie = true; $('#pEtat').textContent = 'Modifications non enregistrées'; if (courant && courant.apercu) courant.apercu(); });
$('#pForm').addEventListener('change', function(){ if (courant && courant.apercu) courant.apercu(); });
window.addEventListener('beforeunload', function(e){ if (modifie && courant){ e.preventDefault(); e.returnValue = ''; } });
$('#pForm').addEventListener('submit', function(e){
  e.preventDefault();
  if (!courant || !courant.valider) return;
  var ok = $('#pOk'); ok.disabled = true; $('#pEtat').textContent = 'Enregistrement…';
  Promise.resolve().then(function(){ return courant.valider($('#pForm')); })
    .then(function(res){ if (res !== false){ modifie = false; fermer(true); } else $('#pEtat').textContent = 'Vérifiez les champs en rouge'; })
    .catch(function(err){ $('#pEtat').textContent = ''; toast(err.message || String(err), true); })
    .then(function(){ ok.disabled = false; });
});
$('#pSuppr').addEventListener('click', function(){ if (courant && courant.supprimer) courant.supprimer(); });
function chp(label, champ, aide, attrs){ return '<label class="chp" ' + (attrs || '') + '>' + label + champ + (aide ? '<small>' + aide + '</small>' : '') + '</label>'; }
function inp(nom, val, attrs){ return '<input name="' + nom + '" value="' + esc(val == null ? '' : val) + '" ' + (attrs || '') + '>'; }
function erreurChamp(form, nom, texte){
  var i = form.elements[nom]; if (!i) return;
  var l = i.closest('.chp'); if (!l) return;
  l.classList.add('err');
  var e = document.createElement('span'); e.className = 'erreur'; e.textContent = texte; l.appendChild(e);
}
function effacerErreurs(form){ $$('.chp.err', form).forEach(function(l){ l.classList.remove('err'); }); $$('.erreur', form).forEach(function(e){ e.remove(); }); }

/* ================= Photos ================= */
function reduire(fichier, max){
  return new Promise(function(ok, ko){
    if (!/^image\//.test(fichier.type)) return ko(new Error('Ce fichier n\'est pas une image.'));
    var img = new Image();
    img.onload = function(){
      var k = Math.min(1, (max || 1400) / Math.max(img.width, img.height));
      var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      var ctx = c.getContext('2d');
      /* une photo détourée garde son fond transparent, les autres sont aplaties en JPEG */
      var transparent = /png|webp/i.test(fichier.type) && aDeLaTransparence(img);
      if (!transparent){ ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function(b){ b ? ok(b) : ko(new Error('Photo illisible.')); }, transparent ? 'image/png' : 'image/jpeg', .85);
    };
    img.onerror = function(){ ko(new Error('Cette image ne peut pas être lue. Essayez un JPG ou un PNG.')); };
    img.src = URL.createObjectURL(fichier);
  });
}
function aDeLaTransparence(img){
  try {
    var L = 60, c = document.createElement('canvas');
    c.width = L; c.height = L;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0, L, L);
    var d = x.getImageData(0, 0, L, L).data;
    for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  } catch (e) {}
  return false;
}
function televerser(prefixe, fichier){
  return reduire(fichier).then(function(blob){
    var png = blob.type === 'image/png';
    var chemin = prefixe + '-' + Date.now() + (png ? '.png' : '.jpg');
    return sb.storage.from('produits').upload(chemin, blob, {contentType: png ? 'image/png' : 'image/jpeg', upsert: true}).then(function(r){
      if (r.error) throw new Error('Envoi de la photo impossible : ' + r.error.message);
      return sb.storage.from('produits').getPublicUrl(chemin).data.publicUrl;
    });
  });
}
function depotHtml(url, repli){
  return '<div class="depot"><div class="cadre" data-cadre>' + (url ? '<img src="' + esc(url) + '" alt="">' : repli) + '</div>' +
    '<div><div class="zone-depot" data-zone tabindex="0"><b>Choisir une photo</b><br>ou la glisser ici<br><small>Depuis le téléphone : prise de vue directe possible</small></div>' +
    '<input type="file" name="fichier" accept="image/*" hidden>' +
    '<input type="hidden" name="image" value="' + esc(url || '') + '">' +
    '<div class="liens"><button type="button" class="b lien mini" data-retirer-photo' + (url ? '' : ' hidden') + '>Retirer la photo</button></div></div></div>';
}
function brancherDepot(form, repli){
  var zone = $('[data-zone]', form), f = form.elements.fichier, cadre = $('[data-cadre]', form), retirer = $('[data-retirer-photo]', form);
  var montrer = function(fichier){
    if (!fichier) return;
    if (!/^image\//.test(fichier.type)) return toast('Ce fichier n\'est pas une image.', true);
    form._photo = fichier;
    cadre.innerHTML = '<img src="' + URL.createObjectURL(fichier) + '" alt="">';
    retirer.hidden = false; modifie = true; $('#pEtat').textContent = 'Modifications non enregistrées';
    if (courant && courant.apercu) courant.apercu();
  };
  zone.addEventListener('click', function(){ f.click(); });
  zone.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); f.click(); } });
  f.addEventListener('change', function(){ montrer(f.files[0]); });
  ['dragenter', 'dragover'].forEach(function(t){ zone.addEventListener(t, function(e){ e.preventDefault(); zone.classList.add('survol'); }); });
  ['dragleave', 'drop'].forEach(function(t){ zone.addEventListener(t, function(e){ e.preventDefault(); zone.classList.remove('survol'); }); });
  zone.addEventListener('drop', function(e){ montrer(e.dataTransfer.files[0]); });
  retirer.addEventListener('click', function(){
    form._photo = null; form.elements.image.value = ''; f.value = '';
    cadre.innerHTML = repli; retirer.hidden = true; modifie = true;
    if (courant && courant.apercu) courant.apercu();
  });
}
function photoFinale(form, prefixe){
  if (form._photo) return televerser(prefixe, form._photo);
  return Promise.resolve(form.elements.image.value || null);
}
function urlApercu(form){
  var img = $('[data-cadre] img', form);
  return img ? img.src : '';
}

/* ================= Commandes ================= */
var STATUTS = {a_preparer: ['À préparer', 'or'], prete: ['Prête, client prévenu', 'vert'], retiree: ['Retirée', ''], annulee: ['Annulée', 'rouge']};
function chargerCommandes(){
  return sb.from('commandes').select('*').order('created_at', {ascending: false}).limit(500).then(function(r){
    if (r.error){ toast('Lecture des commandes impossible : ' + r.error.message, true); return; }
    etat.commandes = r.data; rendreCommandes();
  });
}
function rendreCommandes(){
  badge('Cmd', etat.commandes.filter(function(c){ return c.statut === 'a_preparer'; }).length);
  $$('#cmdFiltres [data-statut]').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.statut === etat.statut); });
  var q = slug($('#cmdRech').value);
  var liste = etat.commandes.filter(function(c){
    return (!etat.statut || c.statut === etat.statut) && (!q || slug([c.numero, c.client_nom, c.client_email, c.client_tel].join(' ')).indexOf(q) > -1);
  });
  if (!liste.length){
    $('#cmdListe').innerHTML = '<div class="vide"><b>' + (etat.commandes.length ? 'Rien ici.' : 'Aucune commande pour le moment.') + '</b>' + (etat.commandes.length ? 'Aucune commande dans cette catégorie.' : 'Elles apparaîtront ici dès le premier paiement en ligne.') + '</div>';
    return;
  }
  $('#cmdListe').innerHTML = liste.map(function(c){
    var st = STATUTS[c.statut] || ['', ''];
    var lignes = (c.lignes || []).map(function(l){
      return '<li' + (l.type === 'evenement' ? ' class="resa"' : '') + '><span>' + l.qte + ' x ' + esc(l.nom) + '</span><span>' + euros(l.prix * l.qte) + '</span></li>';
    }).join('');
    var aProduits = (c.lignes || []).some(function(l){ return l.type === 'produit'; });
    var a = '';
    if (c.statut === 'a_preparer') a += (aProduits ? '<button class="b mini plein" data-act="prevenir">Prête : prévenir le client</button>' : '') + '<button class="b mini contour" data-act="retiree">' + (aProduits ? 'Marquer retirée' : 'Marquer traitée') + '</button>';
    if (c.statut === 'prete') a += '<button class="b mini plein" data-act="retiree">Marquer retirée</button><button class="b mini contour" data-act="prevenir">Renvoyer l\'e-mail</button>';
    if (c.statut !== 'annulee' && c.statut !== 'retiree') a += '<button class="b mini danger" data-act="annulee">Annuler</button>';
    if (c.statut === 'retiree' || (c.statut === 'annulee' && !c.rembourse_le)) a += '<button class="b mini discret" data-act="a_preparer">Remettre à préparer</button>';
    return '<article class="cmd" data-id="' + c.id + '"><div><h3>' + esc(c.numero) + '</h3><div class="sous">' + dateHeure(c.created_at) + '</div>' +
      '<span class="tag ' + st[1] + '" style="display:inline-block;margin-top:8px">' + st[0] + '</span> ' +
      '<span class="tag ' + (c.paiement === 'au_retrait' ? 'or' : 'vert') + '" style="display:inline-block;margin-top:8px">' + (c.paiement === 'au_retrait' ? 'À encaisser au retrait' : 'Payée en ligne') + '</span>' +
      (c.note ? '<div class="sous" style="margin-top:6px">« ' + esc(c.note) + ' »</div>' : '') +
      '<div class="client"><b>' + esc(c.client_nom || 'Nom non renseigné') + '</b><br>' +
      (c.client_tel ? '<a href="tel:' + esc(c.client_tel) + '">' + esc(c.client_tel) + '</a><br>' : '') +
      (c.client_email ? '<a href="mailto:' + esc(c.client_email) + '">' + esc(c.client_email) + '</a>' : '') + '</div></div>' +
      '<div><ul>' + lignes + '</ul><div class="tot"><span>' + (c.paiement === 'au_retrait' ? 'Total à encaisser' : 'Total payé') + '</span><span>' + euros(c.total) + '</span></div>' +
      (c.prevenu_at ? '<div class="sous" style="margin-top:6px">Client prévenu le ' + dateHeure(c.prevenu_at) + '</div>' : '') +
      (c.rembourse_le ? '<div class="sous" style="margin-top:6px;color:var(--vertok)">Remboursé le ' + dateHeure(c.rembourse_le) + '</div>' : '') + '</div>' +
      '<div class="actions">' + a + '</div></article>';
  }).join('');
}
$('#cmdFiltres').addEventListener('click', function(e){ var b = e.target.closest('[data-statut]'); if (b){ etat.statut = b.dataset.statut; rendreCommandes(); } });
$('#cmdRech').addEventListener('input', rendreCommandes);
$('#cmdActu').addEventListener('click', function(){ chargerCommandes().then(function(){ toast('Commandes à jour.'); }); });
$('#cmdListe').addEventListener('click', function(e){
  var b = e.target.closest('[data-act]'); if (!b) return;
  var c = etat.commandes.filter(function(x){ return x.id === b.closest('[data-id]').dataset.id; })[0], act = b.dataset.act;
  if (act === 'prevenir'){
    ouvrir({titre: 'Prévenir ' + (c.client_nom || 'le client'), okTexte: 'Envoyer l\'e-mail',
      html: '<div class="sect"><p class="aide">Un e-mail part à <b>' + esc(c.client_email) + '</b> pour dire que la commande ' + esc(c.numero) + ' est prête à être retirée.</p>' +
        chp('Message ajouté (facultatif)', '<textarea name="message" maxlength="400" placeholder="Ex. : le millésime 2019 a été remplacé par le 2020."></textarea>') + '</div>',
      valider: function(form){
        return api('/api/notifier', {id: c.id, message: form.elements.message.value.trim()}).then(function(){ toast('Client prévenu.'); return chargerCommandes(); });
      }});
    return;
  }
  if (act === 'annulee'){
    var enLigne = c.paiement === 'en_ligne';
    if (!confirm('Annuler la commande ' + c.numero + ' ?\n\n' + (enLigne ? 'Le client sera remboursé automatiquement de ' + euros(c.total) + ' sur sa carte et prévenu par e-mail.' : 'Le client sera prévenu par e-mail.') + ' Les bouteilles et les places reviennent en stock.')) return;
    b.disabled = true; b.textContent = enLigne ? 'Remboursement…' : 'Annulation…';
    api('/api/rembourser', {id: c.id}).then(function(d){
      toast(d.rembourse ? 'Commande annulée et client remboursé.' : 'Commande annulée.');
      chargerCommandes(); chargerProduits(); chargerEvenements();
    }).catch(function(e){ b.disabled = false; b.textContent = 'Annuler'; toast(e.message, true); });
    return;
  }
  b.disabled = true;
  sb.from('commandes').update({statut: act}).eq('id', c.id).then(function(r){
    if (r.error){ b.disabled = false; return toast('Modification impossible : ' + r.error.message, true); }
    toast({retiree: 'Commande marquée retirée.', annulee: 'Commande annulée.', a_preparer: 'Commande remise à préparer.'}[act]);
    chargerCommandes();
  });
});

/* ================= Catalogue ================= */
function offreActive(p){
  if (p.prix_offre == null) return false;
  var a = aujourdHui();
  return (!p.offre_debut || jour(p.offre_debut) <= a) && (!p.offre_fin || jour(p.offre_fin) >= a);
}
function seuil(p){ return p.seuil_alerte == null ? 3 : p.seuil_alerte; }
// Fiche incomplète : il manque une info utile au client, sauf si l'équipe a confirmé qu'il n'y en a pas
function manques(p){
  if (p.fiche_validee) return [];
  var m = [];
  if (!p.image) m.push('photo');
  if (!p.description) m.push('description');
  if (!p.contenance) m.push('contenance');
  if (!p.origine) m.push('origine');
  return m;
}
function chargerProduits(){
  return sb.from('produits').select('*').order('ordre').order('nom').then(function(r){
    if (r.error){ toast('Lecture du catalogue impossible : ' + r.error.message, true); return; }
    etat.produitsCharges = true;
    etat.produits = r.data.map(function(p){ p.prix = Number(p.prix); if (p.prix_offre != null) p.prix_offre = Number(p.prix_offre); return p; });
    rendreCatalogue();
  });
}
var selRayon = $('#catRayon');
selRayon.innerHTML = '<option value="">Tous les rayons</option>' + Object.keys(CATS).map(function(k){ return '<option value="' + k + '">' + CATS[k] + '</option>'; }).join('');
['#catRech', '#catRayon', '#catFiltre'].forEach(function(s){ $(s).addEventListener('input', rendreCatalogue); });
var FILTRES = {
  ligne: function(p){ return p.actif; }, horsligne: function(p){ return !p.actif; },
  rupture: function(p){ return p.actif && p.prix > 0 && p.stock === 0; }, faible: function(p){ return p.actif && p.stock > 0 && p.stock <= seuil(p); },
  offre: function(p){ return p.prix_offre != null; },
  incomplete: function(p){ return manques(p).length > 0; },
  sansprix: function(p){ return !(p.prix > 0); }
};
function rendreCatalogue(){
  majMigration();
  var P = etat.produits, enLigne = P.filter(FILTRES.ligne);
  var nR = P.filter(FILTRES.rupture).length, nF = P.filter(FILTRES.faible).length, nO = P.filter(function(p){ return offreActive(p) && p.actif; }).length;
  badge('Stock', nR + P.filter(FILTRES.incomplete).length);
  var f = $('#catFiltre').value;
  var nP = P.filter(FILTRES.sansprix).length, nI = P.filter(FILTRES.incomplete).length;
  $('#kpis').innerHTML = [['ligne', enLigne.length, 'en ligne sur le site', ''], ['rupture', nR, 'en rupture', nR ? 'alerte' : ''], ['incomplete', nI, 'fiches à compléter', nI ? 'alerte' : ''], ['offre', P.filter(function(p){ return offreActive(p) && p.actif; }).length, 'offres en cours', '']]
    .map(function(k){ return '<button class="kpi ' + k[3] + '" data-kpi="' + k[0] + '" aria-pressed="' + (f === k[0]) + '"><b>' + k[1] + '</b><span>' + k[2] + '</span></button>'; }).join('');
  var q = slug($('#catRech').value), ray = selRayon.value;
  var liste = P.filter(function(p){
    return (!ray || p.categorie === ray) && (!f || FILTRES[f](p)) && (!q || slug([p.nom, p.origine, p.style].join(' ')).indexOf(q) > -1);
  });
  var triable = !q && !f;
  $('#astuceOrdre').textContent = !P.length ? '' : triable
    ? 'Glissez les produits par la poignée pour choisir l\'ordre d\'affichage sur le site' + (ray ? ' dans ce rayon.' : '.')
    : 'Pour changer l\'ordre, videz la recherche et le filtre.';
  var el = $('#listeProd');
  el.classList.toggle('sans-tri', !triable);
  if (!P.length){ el.innerHTML = '<div class="vide"><b>Le catalogue est vide.</b>Ajoutez un premier produit ou importez un fichier.</div>'; return; }
  if (!liste.length){ el.innerHTML = '<div class="vide"><b>Aucun produit ne correspond.</b>Changez la recherche ou le filtre.</div>'; return; }
  el.innerHTML = liste.map(ligneProduit).join('');
  activerTri(el, triable, ordonnerProduits);
}
function ligneProduit(p){
  var o = offreActive(p), tags = '';
  if (!p.actif) tags += '<span class="tag">Hors ligne</span>';
  var mq = manques(p);
  if (mq.length) tags += '<span class="tag rouge">Fiche incomplète : ' + mq.join(', ') + '</span>';
  if (p.actif && p.prix > 0 && p.stock === 0) tags += '<span class="tag rouge">Rupture</span>';
  else if (p.actif && p.prix > 0 && p.stock <= seuil(p)) tags += '<span class="tag or">Stock faible</span>';
  if (p.prix_offre != null) tags += '<span class="tag ' + (o ? 'offre' : '') + '">' + esc(p.offre_label || 'Offre') + (o ? '' : ' (programmée)') + '</span>';
  if (p.badge) tags += '<span class="tag">' + esc(p.badge) + '</span>';
  return '<div class="ligne' + (p.actif ? '' : ' hors') + (p.actif && p.stock === 0 ? ' rupture' : '') + (mq.length ? ' incomplete' : '') + '" data-id="' + esc(p.id) + '">' + POIGNEE +
    '<div class="vign">' + (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : bouteille(p.categorie)) + '</div>' +
    '<div class="titre-l" data-edit><div class="nom">' + esc((p.marque ? p.marque + ' ' : '') + p.nom) + '</div><div class="sous">' + esc([CATS[p.categorie], p.contenance].filter(Boolean).join(', ')) + '</div>' + (tags ? '<div class="tags">' + tags + '</div>' : '') + '</div>' +
    '<div class="prix-l">' + (!(p.prix > 0) ? '<span class="tag rouge">Prix manquant</span>' : o ? '<s>' + euros(p.prix) + '</s>' + euros(p.prix_offre) : euros(p.prix)) + '</div>' +
    '<div class="col-stock"><span class="stepper"><button type="button" data-d="-1" aria-label="Une bouteille de moins">−</button><input type="number" min="0" inputmode="numeric" value="' + p.stock + '" aria-label="Stock"><button type="button" data-d="1" aria-label="Une bouteille de plus">+</button></span><span class="etat-save"></span></div>' +
    '<div class="col-bascule"><button type="button" class="bascule" role="switch" aria-checked="' + p.actif + '" title="' + (p.actif ? 'Visible sur le site' : 'Masqué du site') + '" aria-label="Visible sur le site"></button></div>' +
    '<div class="col-actions"><button type="button" class="b mini contour" data-edit>Modifier</button></div></div>';
}
$('#kpis').addEventListener('click', function(e){
  var k = e.target.closest('[data-kpi]'); if (!k) return;
  $('#catFiltre').value = $('#catFiltre').value === k.dataset.kpi ? '' : k.dataset.kpi;
  rendreCatalogue();
});

/* glisser-deposer */
var tris = {};
function activerTri(el, actif, surFin){
  if (!window.Sortable) return;
  if (tris[el.id]) tris[el.id].destroy();
  if (!actif) return;
  tris[el.id] = window.Sortable.create(el, {handle: '.poignee', animation: 180, ghostClass: 'fantome', chosenClass: 'choisi', forceFallback: true, fallbackTolerance: 3,
    onEnd: function(ev){ if (ev.oldIndex !== ev.newIndex) surFin($$('[data-id]', el).map(function(x){ return x.dataset.id; })); }});
}
function ordonnerProduits(visibles){
  var global = etat.produits.slice();
  var positions = [];
  global.forEach(function(p, i){ if (visibles.indexOf(p.id) > -1) positions.push(i); });
  var parId = {}; global.forEach(function(p){ parId[p.id] = p; });
  visibles.forEach(function(id, k){ global[positions[k]] = parId[id]; });
  var ids = global.map(function(p){ return p.id; });
  global.forEach(function(p, i){ p.ordre = i + 1; });
  etat.produits = global;
  sb.rpc('reordonner', {p_table: 'produits', p_ids: ids}).then(function(r){
    if (r.error){ toast('Ordre non enregistré : ' + r.error.message, true); return chargerProduits(); }
    toast('Ordre enregistré, le site est à jour.');
  });
}

/* ---------- transfert des photos du site vers la base (gérant) ---------- */
var PREFIXE_LOCAL = '/img/produits/';
function aTransferer(){ return etat.produits.filter(function(p){ return p.image && p.image.indexOf(PREFIXE_LOCAL) === 0; }); }
function majMigration(){
  var n = aTransferer().length, gerant = etat.moi && etat.moi.super;
  var ri = $('#reimport');
  if (ri){
    ri.hidden = !(gerant && etat.produitsCharges && etat.produits.length && !n);
    $('#reimportTxt').textContent = 'Remplace les photos de la base par les fichiers du dossier img/produits du site, quand vous en avez déposé de nouvelles versions. Les références sans fichier ne bougent pas.';
  }
  $('#initial').hidden = !(gerant && etat.produitsCharges && !etat.produits.length);
  $('#migration').hidden = !(gerant && n);
  $('#migrationTxt').textContent = n + ' photo' + (n > 1 ? 's sont encore stockées' : ' est encore stockée') + ' dans le code du site. Une fois transférées, Morgane les gère entièrement depuis cet espace.';
}
$('#initialBtn').addEventListener('click', function(){
  var b = $('#initialBtn'); b.disabled = true; b.textContent = 'Installation…';
  fetch('/data/catalogue.json', {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error('catalogue du site introuvable'); return r.json(); })
    .then(function(d){
      var champs = ['id', 'marque', 'nom', 'categorie', 'accroche', 'style', 'origine', 'degre', 'contenance', 'notes', 'description', 'caracteristiques', 'maison', 'image', 'photo_type', 'badge', 'ordre'];
      var lignes = (d.produits || []).filter(function(p){ return !p.demo; }).map(function(p){
        var o = {prix: 0, stock: 0, actif: true};
        champs.forEach(function(c){ if (p[c] !== undefined) o[c] = p[c]; });
        o.caracteristiques = o.caracteristiques || [];
        return o;
      });
      if (!lignes.length) throw new Error('aucune référence à installer');
      var lots = []; for (var k = 0; k < lignes.length; k += 40) lots.push(lignes.slice(k, k + 40));
      return lots.reduce(function(pr, lot){
        return pr.then(function(){ return sb.from('produits').upsert(lot, {onConflict: 'id'}).then(function(r){ if (r.error) throw new Error(r.error.message); }); });
      }, Promise.resolve()).then(function(){ return lignes.length; });
    })
    .then(function(n){ toast(n + ' références installées. Transférez maintenant les photos.'); return chargerProduits(); })
    .catch(function(e){ toast('Installation impossible : ' + e.message, true); b.disabled = false; b.textContent = 'Installer le catalogue'; });
});
$('#migrationBtn').addEventListener('click', function(){
  var liste = aTransferer(), total = liste.length, faits = 0, echecs = 0, stop = false;
  if (!total) return;
  ouvrir({titre: 'Transfert des photos', html:
    '<div class="sect"><h4>' + total + ' photos à transférer</h4><p class="aide">Gardez cette page ouverte pendant le transfert (une à deux minutes). En cas de coupure, relancez : les photos déjà transférées sont ignorées.</p>' +
    '<div class="progression"><i id="migBarre"></i></div><p class="aide" id="migEtat" style="margin-top:8px">Démarrage…</p><div class="journal" id="migJournal"></div></div>'});
  panneau.addEventListener('transitionend', function f(){ if (!panneau.classList.contains('on')){ stop = true; panneau.removeEventListener('transitionend', f); } });
  var journal = function(t, ko){ var j = $('#migJournal'); if (!j) return; j.insertAdjacentHTML('afterbegin', '<div' + (ko ? ' class="ko"' : '') + '>' + esc(t) + '</div>'); };
  var suivant = function(){
    if (stop) return;
    var p = liste.shift();
    if (!p){
      if (faits + echecs < total) return;
      $('#migEtat').textContent = 'Terminé : ' + faits + ' photos transférées' + (echecs ? ', ' + echecs + ' en échec (relancez pour réessayer).' : '.');
      toast(echecs ? 'Transfert terminé avec ' + echecs + ' échec(s).' : 'Toutes les photos sont dans la base.', !!echecs);
      majMigration(); rendreCatalogue();
      return;
    }
    var chemin = 'catalogue/' + p.id + '.jpg';
    fetch(p.image, {cache: 'no-store'}).then(function(r){ if (!r.ok) throw new Error('photo introuvable sur le site'); return r.blob(); })
      .then(function(blob){ return sb.storage.from('produits').upload(chemin, blob, {contentType: 'image/jpeg', upsert: true, cacheControl: '31536000'}); })
      .then(function(r){
        if (r.error) throw new Error(r.error.message);
        var url = sb.storage.from('produits').getPublicUrl(chemin).data.publicUrl;
        return sb.from('produits').update({image: url}).eq('id', p.id).then(function(u){ if (u.error) throw new Error(u.error.message); p.image = url; });
      })
      .then(function(){ faits++; journal('Transférée : ' + (p.marque ? p.marque + ' ' : '') + p.nom); })
      .catch(function(e){ echecs++; journal('Échec : ' + p.nom + ' (' + e.message + ')', true); })
      .then(function(){
        var fait = faits + echecs;
        var b = $('#migBarre'); if (b) b.style.width = Math.round(fait / total * 100) + '%';
        var et = $('#migEtat'); if (et) et.textContent = fait + ' / ' + total;
        suivant();
      });
  };
  suivant(); suivant(); suivant();
});

/* ---------- réimport des photos déposées dans le site (gérant) ---------- */
if ($('#reimportBtn')) $('#reimportBtn').addEventListener('click', function(){
  var liste = etat.produits.slice(), total = liste.length, faits = 0, sautes = 0, echecs = 0, stop = false;
  if (!total) return;
  ouvrir({titre: 'Réimport des photos', html:
    '<div class="sect"><h4>' + total + ' références à vérifier</h4><p class="aide">Pour chaque référence, le fichier img/produits/&lt;identifiant&gt;.png ou .jpg du site remplace la photo de la base. Gardez cette page ouverte. En cas de coupure, relancez.</p>' +
    '<div class="progression"><i id="riBarre"></i></div><p class="aide" id="riEtat" style="margin-top:8px">Démarrage…</p><div class="journal" id="riJournal"></div></div>'});
  panneau.addEventListener('transitionend', function f(){ if (!panneau.classList.contains('on')){ stop = true; panneau.removeEventListener('transitionend', f); } });
  var journal = function(t, ko){ var j = $('#riJournal'); if (!j) return; j.insertAdjacentHTML('afterbegin', '<div' + (ko ? ' class="ko"' : '') + '>' + esc(t) + '</div>'); };
  var prendre = function(id){
    return fetch(PREFIXE_LOCAL + id + '.png', {cache: 'no-store'}).then(function(r){
      if (r.ok) return r.blob().then(function(b){ return {blob: b, ext: 'png', type: 'image/png'}; });
      return fetch(PREFIXE_LOCAL + id + '.jpg', {cache: 'no-store'}).then(function(r2){
        if (!r2.ok) return null;
        return r2.blob().then(function(b){ return {blob: b, ext: 'jpg', type: 'image/jpeg'}; });
      });
    });
  };
  var suivant = function(){
    if (stop) return;
    var p = liste.shift();
    if (!p){
      if (faits + echecs + sautes < total) return;
      $('#riEtat').textContent = 'Terminé : ' + faits + ' photo' + (faits > 1 ? 's remplacées' : ' remplacée') + ', ' + sautes + ' sans fichier' + (echecs ? ', ' + echecs + ' en échec (relancez pour réessayer).' : '.');
      toast(echecs ? 'Réimport terminé avec ' + echecs + ' échec(s).' : faits + ' photos remplacées.', !!echecs);
      rendreCatalogue();
      return;
    }
    prendre(p.id).then(function(f){
      if (!f){ sautes++; return; }
      var chemin = 'catalogue/' + p.id + '.' + f.ext, autre = 'catalogue/' + p.id + '.' + (f.ext === 'png' ? 'jpg' : 'png');
      return sb.storage.from('produits').upload(chemin, f.blob, {contentType: f.type, upsert: true, cacheControl: '31536000'}).then(function(r){
        if (r.error) throw new Error(r.error.message);
        var url = sb.storage.from('produits').getPublicUrl(chemin).data.publicUrl + '?v=' + Date.now();
        return sb.from('produits').update({image: url}).eq('id', p.id).then(function(u){
          if (u.error) throw new Error(u.error.message);
          p.image = url;
          return sb.storage.from('produits').remove([autre]).catch(function(){});
        });
      }).then(function(){ faits++; journal('Remplacée : ' + (p.marque ? p.marque + ' ' : '') + p.nom); });
    })
    .catch(function(e){ echecs++; journal('Échec : ' + p.nom + ' (' + e.message + ')', true); })
    .then(function(){
      var fait = faits + echecs + sautes;
      var b = $('#riBarre'); if (b) b.style.width = Math.round(fait / total * 100) + '%';
      var et = $('#riEtat'); if (et) et.textContent = fait + ' / ' + total + ' vérifiées, ' + faits + ' remplacées';
      suivant();
    });
  };
  suivant(); suivant(); suivant();
});

/* stock en direct */
var minuteries = {};
function planifierStock(ligne, val){
  var id = ligne.dataset.id, p = etat.produits.filter(function(x){ return x.id === id; })[0];
  val = Math.max(0, parseInt(val, 10) || 0);
  $('input', ligne).value = val;
  var et = $('.etat-save', ligne); et.className = 'etat-save'; et.textContent = '…';
  clearTimeout(minuteries[id]);
  minuteries[id] = setTimeout(function(){
    var avant = p.stock;
    sb.from('produits').update({stock: val}).eq('id', id).then(function(r){
      if (r.error){ et.className = 'etat-save ko'; et.textContent = 'Échec'; return; }
      p.stock = val;
      et.className = 'etat-save ok'; et.textContent = 'Enregistré';
      setTimeout(function(){ et.textContent = ''; }, 1600);
      if ((avant === 0) !== (val === 0) || (avant <= seuil(p)) !== (val <= seuil(p))) setTimeout(rendreCatalogue, 900);
    });
  }, 550);
}
$('#listeProd').addEventListener('click', function(e){
  var ligne = e.target.closest('.ligne'); if (!ligne) return;
  var p = etat.produits.filter(function(x){ return x.id === ligne.dataset.id; })[0];
  var d = e.target.closest('[data-d]');
  if (d) return planifierStock(ligne, (parseInt($('input', ligne).value, 10) || 0) + +d.dataset.d);
  if (e.target.closest('.bascule')){
    var v = !p.actif;
    return sb.from('produits').update({actif: v}).eq('id', p.id).then(function(r){
      if (r.error) return toast('Modification impossible : ' + r.error.message, true);
      p.actif = v; rendreCatalogue();
      toast(v ? '« ' + p.nom + ' » est visible sur le site.' : '« ' + p.nom + ' » est masqué du site.', false, {texte: 'Annuler', faire: function(){
        sb.from('produits').update({actif: !v}).eq('id', p.id).then(function(){ p.actif = !v; rendreCatalogue(); });
      }});
    });
  }
  if (e.target.closest('[data-edit]')) editerProduit(p);
});
$('#listeProd').addEventListener('change', function(e){ if (e.target.matches('.stepper input')) planifierStock(e.target.closest('.ligne'), e.target.value); });
$('#listeProd').addEventListener('keydown', function(e){ if (e.key === 'Enter' && e.target.matches('.stepper input')){ e.preventDefault(); e.target.blur(); } });
$('#prodNouveau').addEventListener('click', function(){ editerProduit(null); });

/* ---------- editeur produit ---------- */
function editerProduit(p, copie){
  var neuf = !p || copie;
  var d = p ? Object.assign({}, p) : {categorie: selRayon.value || 'rhums', stock: 0, prix: '', actif: true, seuil_alerte: 3};
  if (copie){ d.nom = d.nom + ' (copie)'; d.image = d.image || ''; }
  var badgeLibre = d.badge && BADGES.indexOf(d.badge) < 0;
  var aOffre = d.prix_offre != null;
  var mqE = neuf ? [] : manques(Object.assign({}, d, {fiche_validee: false}));
  var html =
    (mqE.length ? '<div class="sect encart-rouge"><h4>Fiche incomplète</h4><p>Il manque : <b>' + mqE.join(', ') + '</b>. Complétez ces champs ci-dessous, ou confirmez que ce produit n\'en a pas.</p>' +
      '<div class="ligne-bascule"><span>Fiche complète telle quelle<small>Ce produit n\'a pas de ' + mqE.join(' ni de ') + ' à ajouter : ne plus le signaler.</small></span><button type="button" class="bascule" role="switch" data-champ="fiche_validee" aria-checked="' + !!d.fiche_validee + '"></button></div></div>' : '') +
    '<div class="sect"><h4>L\'essentiel</h4>' +
      depotHtml(d.image, bouteille(d.categorie)) +
      '<div class="duo">' + chp('Marque ou maison', inp('marque', d.marque, 'maxlength="60" placeholder="Ex. : Neisson"')) +
      chp('Nom du produit *', inp('nom', d.nom, 'required maxlength="90" placeholder="Ex. : Soubwa"')) + '</div>' +
      chp('Rayon', '<div class="choix">' + Object.keys(CATS).map(function(k){ return '<label><input type="radio" name="categorie" value="' + k + '"' + (k === d.categorie ? ' checked' : '') + '><span>' + CATS[k] + '</span></label>'; }).join('') + '</div>') +
      '<div class="trio">' +
        chp('Prix de vente TTC *', '<span class="prefixe" data-unite="€">' + inp('prix', d.prix === '' ? '' : String(d.prix).replace('.', ','), 'inputmode="decimal" required') + '</span>', '<span data-net></span>') +
        chp('En stock', inp('stock', d.stock, 'type="number" min="0" inputmode="numeric"')) +
        chp('Alerte stock faible', inp('seuil_alerte', d.seuil_alerte, 'type="number" min="0" inputmode="numeric"'), 'À partir de combien prévenir.') +
      '</div>' +
      '<div class="ligne-bascule"><span>Visible sur le site<small>Masqué, le produit reste enregistré mais n\'apparaît plus.</small></span><button type="button" class="bascule" role="switch" data-champ="actif" aria-checked="' + d.actif + '"></button></div>' +
    '</div>' +
    '<div class="sect"><h4>Présentation</h4>' +
      chp('Accroche', inp('accroche', d.accroche, 'maxlength="120" placeholder="Une phrase qui donne envie"'), 'Affichée en haut de la fiche. <span class="compteur" data-compte="accroche"></span>') +
      chp('Description', '<textarea name="description" maxlength="700" rows="5" placeholder="L\'histoire du produit, la maison, ce qui le rend unique.">' + esc(d.description || '') + '</textarea>', '<span class="compteur" data-compte="description"></span>') +
      chp('Notes de dégustation', '<textarea name="notes" maxlength="300" rows="2" placeholder="Ex. : vanille grillée, fruits confits, finale longue.">' + esc(d.notes || '') + '</textarea>') +
      '<div class="duo">' + chp('Origine', inp('origine', d.origine, 'placeholder="Guadeloupe, Écosse…"')) + chp('Style', inp('style', d.style, 'placeholder="Hors d\'âge, blanc de noirs…"')) + '</div>' +
      '<div class="duo">' + chp('Degré', inp('degre', d.degre, 'placeholder="42 %"')) + chp('Contenance', inp('contenance', d.contenance, 'placeholder="70 cl"')) + '</div>' +
      chp('Caractéristiques', '<textarea name="caracteristiques" rows="5" placeholder="Distillerie : Neisson\nVieillissement : 8 ans">' + esc((d.caracteristiques || []).map(function(c){ return c[0] + ' : ' + c[1]; }).join('\n')) + '</textarea>', 'Une ligne par caractéristique, au format « Libellé : valeur ». Affichées dans la fiche du site.') +
      chp('La maison', '<textarea name="maison" maxlength="600" rows="3" placeholder="Quelques mots sur le producteur.">' + esc(d.maison || '') + '</textarea>') +
    '</div>' +
    '<div class="sect"><h4>Mise en avant</h4><p class="aide">Un badge s\'affiche sur la photo du produit.</p>' +
      '<div class="choix">' + ['', ].concat(BADGES).map(function(b){ return '<label><input type="radio" name="badge_choix" value="' + esc(b) + '"' + ((d.badge || '') === b && !badgeLibre ? ' checked' : '') + '><span>' + (b || 'Aucun') + '</span></label>'; }).join('') +
      '<label><input type="radio" name="badge_choix" value="__libre"' + (badgeLibre ? ' checked' : '') + '><span>Autre…</span></label></div>' +
      '<div class="repli' + (badgeLibre ? ' on' : '') + '" data-repli="badge"><div>' + chp('Texte du badge', inp('badge_libre', badgeLibre ? d.badge : '', 'maxlength="24" placeholder="Ex. : Primé 2026"')) + '</div></div>' +
    '</div>' +
    '<div class="sect"><h4>Offre<button type="button" class="bascule" role="switch" data-champ="offre" aria-checked="' + aOffre + '" aria-label="Activer une offre"></button></h4>' +
      '<p class="aide">Le prix barré et le badge d\'offre apparaissent sur le site pendant la période choisie. Le paiement applique le prix d\'offre.</p>' +
      '<div class="repli' + (aOffre ? ' on' : '') + '" data-repli="offre"><div>' +
        '<div class="remises">' + [10, 15, 20, 25, 30].map(function(x){ return '<button type="button" class="b mini contour" data-remise="' + x + '">-' + x + ' %</button>'; }).join('') + '</div>' +
        '<div class="duo">' + chp('Prix pendant l\'offre', '<span class="prefixe" data-unite="€">' + inp('prix_offre', aOffre ? String(d.prix_offre).replace('.', ',') : '', 'inputmode="decimal"') + '</span>') +
          chp('Texte du badge d\'offre', inp('offre_label', d.offre_label, 'maxlength="24" placeholder="-20 %, Offre de Noël…"'), 'Vide : « -X % » calculé tout seul.') + '</div>' +
        '<p class="calc" data-calc></p>' +
        '<div class="duo">' + chp('Début', inp('offre_debut', d.offre_debut, 'type="date"'), 'Vide : dès maintenant.') + chp('Fin', inp('offre_fin', d.offre_fin, 'type="date"'), 'Vide : jusqu\'à ce que vous l\'arrêtiez.') + '</div>' +
      '</div></div>' +
    '</div>' +
    (neuf ? '' : '<div class="sect"><h4>Historique du stock</h4><ul class="histo" data-histo><li><span>Chargement…</span></li></ul></div>') +
    (neuf ? '' : '<p style="margin-top:18px"><button type="button" class="b contour mini" data-dupliquer>Dupliquer ce produit</button></p>');

  ouvrir({
    titre: neuf ? (copie ? 'Copie de produit' : 'Nouveau produit') : d.nom, html: html,
    apercu: function(){ apercuProduit($('#pForm')); },
    supprimer: neuf ? null : function(){
      if (!confirm('Supprimer définitivement « ' + d.nom + ' » ?\n\nPour le retirer du site sans le perdre, utilisez plutôt « Visible sur le site ».')) return;
      sb.from('produits').delete().eq('id', d.id).then(function(r){
        if (r.error) return toast('Suppression impossible : ' + r.error.message, true);
        modifie = false; fermer(true); toast('Produit supprimé.'); chargerProduits();
      });
    },
    apres: function(form){
      brancherDepot(form, bouteille(d.categorie));
      $$('.bascule[data-champ]', form).forEach(function(b){
        b.addEventListener('click', function(){
          var v = b.getAttribute('aria-checked') !== 'true';
          b.setAttribute('aria-checked', v); modifie = true;
          if (b.dataset.champ === 'offre'){ $('[data-repli="offre"]', form).classList.toggle('on', v); if (v && !form.elements.prix_offre.value) form.elements.prix_offre.focus(); }
          apercuProduit(form);
        });
      });
      $$('input[name=badge_choix]', form).forEach(function(r){ r.addEventListener('change', function(){ $('[data-repli="badge"]', form).classList.toggle('on', r.value === '__libre' && r.checked); }); });
      $$('input[name=categorie]', form).forEach(function(r){ r.addEventListener('change', function(){ if (!form._photo && !form.elements.image.value) $('[data-cadre]', form).innerHTML = bouteille(r.value); }); });
      $$('[data-remise]', form).forEach(function(b){
        b.addEventListener('click', function(){
          var prix = nombre(form.elements.prix.value);
          if (!prix) return toast('Indiquez d\'abord le prix de vente.', true);
          form.elements.prix_offre.value = String(Math.round(prix * (100 - +b.dataset.remise)) / 100).replace('.', ',');
          modifie = true; majCalc(form); apercuProduit(form);
        });
      });
      ['prix', 'prix_offre'].forEach(function(n){ form.elements[n].addEventListener('input', function(){ majCalc(form); majNet(form); }); });
      form.addEventListener('click', function(ev){
        if (!ev.target.closest('[data-prix-net]')) return;
        ev.preventDefault();
        var net = nombre(prompt('Combien voulez-vous recevoir pour ce produit, après commission (en €) ?', ''));
        if (!(net > 0)) return;
        var prix = Math.ceil((net + STRIPE_FIXE) / (1 - STRIPE_TAUX) * 10) / 10 - 0.01;
        form.elements.prix.value = prix.toFixed(2).replace('.', ',');
        modifie = true; majCalc(form); majNet(form); apercuProduit(form);
      });
      ['accroche', 'description'].forEach(function(n){
        var c = $('[data-compte="' + n + '"]', form), i = form.elements[n];
        var m = function(){ c.textContent = i.value.length + ' / ' + i.maxLength; }; i.addEventListener('input', m); m();
      });
      var dup = $('[data-dupliquer]', form);
      if (dup) dup.addEventListener('click', function(){ if (modifie && !confirm('Les modifications en cours seront perdues. Continuer ?')) return; modifie = false; fermer(true); editerProduit(d, true); });
      if (!neuf) chargerHisto(d.id, $('[data-histo]', form));
      majCalc(form); majNet(form); apercuProduit(form);
    },
    valider: function(form){
      effacerErreurs(form);
      var el = form.elements, ok = true;
      var prix = nombre(el.prix.value), offreOn = $('[data-champ="offre"]', form).getAttribute('aria-checked') === 'true';
      var po = nombre(el.prix_offre.value);
      var choixB = (form.querySelector('input[name=badge_choix]:checked') || {}).value || '';
      var v = {
        nom: el.nom.value.trim(), marque: el.marque.value.trim() || null, maison: el.maison.value.trim() || null,
        caracteristiques: el.caracteristiques.value.split('\n').map(function(l){ var k = l.indexOf(':'); return k > 0 ? [l.slice(0, k).trim(), l.slice(k + 1).trim()] : null; }).filter(function(c){ return c && c[0] && c[1]; }),
        categorie: form.querySelector('input[name=categorie]:checked').value,
        prix: prix, stock: Math.max(0, parseInt(el.stock.value, 10) || 0), seuil_alerte: Math.max(0, parseInt(el.seuil_alerte.value, 10) || 0),
        actif: $('[data-champ="actif"]', form).getAttribute('aria-checked') === 'true',
        accroche: el.accroche.value.trim() || null, description: el.description.value.trim() || null, notes: el.notes.value.trim() || null,
        origine: el.origine.value.trim() || null, style: el.style.value.trim() || null, degre: el.degre.value.trim() || null, contenance: el.contenance.value.trim() || null,
        fiche_validee: !!($('[data-champ="fiche_validee"]', form) && $('[data-champ="fiche_validee"]', form).getAttribute('aria-checked') === 'true'),
        badge: choixB === '__libre' ? (el.badge_libre.value.trim() || null) : (choixB || null),
        prix_offre: offreOn ? po : null,
        offre_label: offreOn ? (el.offre_label.value.trim() || (prix && po ? '-' + Math.round((1 - po / prix) * 100) + ' %' : null)) : null,
        offre_debut: offreOn ? (el.offre_debut.value || null) : null,
        offre_fin: offreOn ? (el.offre_fin.value || null) : null
      };
      if (!v.nom){ erreurChamp(form, 'nom', 'Le nom est obligatoire.'); ok = false; }
      if (prix === null || prix < 0){ erreurChamp(form, 'prix', 'Indiquez un prix (0 = pas encore en vente en ligne).'); ok = false; }
      if (offreOn && !(prix > 0)){ erreurChamp(form, 'prix', 'Une offre demande un prix de vente.'); ok = false; }
      if (offreOn){
        if (!(po >= 0) || po === null){ erreurChamp(form, 'prix_offre', 'Indiquez le prix pendant l\'offre.'); ok = false; }
        else if (prix && po >= prix){ erreurChamp(form, 'prix_offre', 'Doit être inférieur au prix de vente.'); ok = false; }
        if (v.offre_debut && v.offre_fin && v.offre_fin < v.offre_debut){ erreurChamp(form, 'offre_fin', 'La fin est avant le début.'); ok = false; }
      }
      if (!ok){ var e1 = $('.chp.err', form); if (e1) e1.scrollIntoView({behavior: 'smooth', block: 'center'}); return false; }
      var id = neuf ? slug(v.nom) + '-' + Math.random().toString(36).slice(2, 6) : d.id;
      return photoFinale(form, id).then(function(url){
        v.image = url;
        if (neuf){
          v.id = id;
          v.ordre = etat.produits.reduce(function(m, x){ return Math.min(m, x.ordre || 0); }, 1) - 1;
          return sb.from('produits').insert(v);
        }
        return sb.from('produits').update(v).eq('id', id);
      }).then(function(r){
        if (r.error) throw new Error(/duplicate/.test(r.error.message) ? 'Un produit porte déjà cet identifiant, réessayez.' : 'Enregistrement impossible : ' + r.error.message);
        toast(neuf ? 'Produit ajouté en tête de liste.' : 'Modifications enregistrées.');
        return chargerProduits();
      });
    }
  });
}
// Commission Stripe estimée (carte européenne) : 1,5 % + 0,25 €
var STRIPE_TAUX = 0.015, STRIPE_FIXE = 0.25;
function majNet(form){
  var z = $('[data-net]', form); if (!z) return;
  var p = nombre(form.elements.prix.value);
  if (!(p > 0)){ z.innerHTML = 'Indiquez le prix payé par le client, commission Stripe incluse.'; return; }
  var com = Math.round((p * STRIPE_TAUX + STRIPE_FIXE) * 100) / 100;
  z.innerHTML = 'Commission Stripe estimée : ' + euros(com) + ', vous recevez environ <b>' + euros(p - com) + '</b>. <a href="#" data-prix-net>Calculer le prix à partir du montant à recevoir</a>';
}
function majCalc(form){
  var p = nombre(form.elements.prix.value), o = nombre(form.elements.prix_offre.value), c = $('[data-calc]', form);
  c.textContent = p && o !== null && o < p ? 'Soit -' + Math.round((1 - o / p) * 100) + ' %, une économie de ' + euros(p - o) + ' par bouteille.' : '';
}
function apercuProduit(form){
  var el = form.elements, zone = $('#pApercu');
  var cat = (form.querySelector('input[name=categorie]:checked') || {}).value || 'rhums';
  var prix = nombre(el.prix.value), po = nombre(el.prix_offre.value);
  var offreOn = $('[data-champ="offre"]', form).getAttribute('aria-checked') === 'true' && po !== null && prix && po < prix;
  var deb = el.offre_debut.value, fin = el.offre_fin.value, a = isoJour(aujourdHui());
  var enCours = offreOn && (!deb || deb <= a) && (!fin || fin >= a);
  var choixB = (form.querySelector('input[name=badge_choix]:checked') || {}).value || '';
  var bd = choixB === '__libre' ? el.badge_libre.value.trim() : choixB;
  var lbl = el.offre_label.value.trim() || (offreOn ? '-' + Math.round((1 - po / prix) * 100) + ' %' : '');
  var stock = parseInt(el.stock.value, 10) || 0, visible = $('[data-champ="actif"]', form).getAttribute('aria-checked') === 'true';
  var url = urlApercu(form);
  zone.innerHTML = '<p class="lbl">Aperçu sur le site</p><div class="ap-carte"><div class="visuel">' + (url ? '<img src="' + esc(url) + '" alt="">' : bouteille(cat)) +
    '<div class="pastilles">' + (stock === 0 ? '<span>Revient bientôt</span>' : '') + (enCours ? '<span class="offre">' + esc(lbl) + '</span>' : '') + (bd ? '<span>' + esc(bd) + '</span>' : '') + '</div></div>' +
    '<div class="bas"><div>' + (el.marque.value ? '<div class="orig" style="letter-spacing:.1em;text-transform:uppercase">' + esc(el.marque.value) + '</div>' : '') + '<h5>' + esc(el.nom.value || 'Nom du produit') + '</h5><div class="orig">' + esc([el.origine.value, el.contenance.value].filter(Boolean).join(', ')) + '</div></div>' +
    '<span class="px">' + (!(prix > 0) ? 'En boutique' : enCours ? '<s>' + euros(prix) + '</s>' + euros(po) : euros(prix)) + '</span></div>' +
    (el.accroche.value ? '<p class="acc">' + esc(el.accroche.value) + '</p>' : '') +
    '<p class="etat-ap' + (visible ? '' : ' off') + '">' + (visible ? (!(prix > 0) ? 'Visible, affiché « En boutique » : pas de vente en ligne tant que le prix est à 0.' : stock === 0 ? 'Visible, affiché « Revient bientôt », commande impossible.' : 'Visible et commandable, ' + stock + ' en stock.') : 'Masqué : n\'apparaît pas sur le site.') + '</p>' +
    (offreOn && !enCours ? '<p class="etat-ap off" style="background:#F3E8CF;color:#7A5F10">Offre programmée' + (deb > a ? ' à partir du ' + dateLongue(deb) : ', période terminée') + '.</p>' : '') + '</div>';
}
function chargerHisto(id, ul){
  sb.from('mouvements_stock').select('*').eq('produit_id', id).order('created_at', {ascending: false}).limit(12).then(function(r){
    if (!ul.isConnected) return;
    if (r.error || !r.data.length){ ul.innerHTML = '<li><span>Aucun mouvement enregistré pour l\'instant.</span></li>'; return; }
    ul.innerHTML = r.data.map(function(m){
      var diff = m.avant == null ? 'Création : ' + m.apres : (m.apres - m.avant > 0 ? '+' : '') + (m.apres - m.avant) + ' (' + m.avant + ' → ' + m.apres + ')';
      return '<li><span>' + diff + ', ' + esc(m.origine === 'vente en ligne' ? 'vente en ligne' : (m.auteur || 'équipe')) + '</span><span>' + dateHeure(m.created_at) + '</span></li>';
    }).join('');
  });
}

/* ---------- import CSV ---------- */
function lireCSV(texte){
  texte = texte.replace(/^\uFEFF/, '');
  var l0 = texte.split('\n')[0];
  var sep = (l0.match(/;/g) || []).length > (l0.match(/,/g) || []).length ? ';' : ',';
  var lignes = [], ligne = [], champ = '', guil = false;
  for (var i = 0; i < texte.length; i++){
    var c = texte[i];
    if (guil){ if (c === '"'){ if (texte[i + 1] === '"'){ champ += '"'; i++; } else guil = false; } else champ += c; }
    else if (c === '"') guil = true;
    else if (c === sep){ ligne.push(champ); champ = ''; }
    else if (c === '\n' || c === '\r'){ if (c === '\r' && texte[i + 1] === '\n') i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
    else champ += c;
  }
  if (champ || ligne.length){ ligne.push(champ); lignes.push(ligne); }
  var tete = lignes.shift().map(function(h){ return slug(h).replace(/-/g, '_'); });
  return lignes.filter(function(l){ return l.join('').trim(); }).map(function(l){ var o = {}; tete.forEach(function(h, k){ o[h] = (l[k] || '').trim(); }); return o; });
}
var ALIAS = {'spiritueux': 'spiritueux', 'rhum': 'rhums', 'rhums': 'rhums', 'rhums-canne': 'rhums', 'vin': 'vins', 'vins': 'vins', 'vins-champagnes': 'vins', 'champagne': 'vins', 'epicerie': 'epicerie', 'epicerie-fine': 'epicerie', 'sans-alcool': 'sans-alcool'};
var ENTETES = {'reference-ne-pas-modifier': 'id', 'reference': 'id', 'id': 'id', 'rayon': 'categorie', 'categorie': 'categorie', 'marque': 'marque', 'produit': 'nom', 'nom': 'nom',
  'contenance': 'contenance', 'prix-ttc': 'prix', 'prix': 'prix', 'stock': 'stock', 'en-ligne': 'actif', 'origine': 'origine', 'style': 'style', 'degre': 'degre',
  'accroche': 'accroche', 'description': 'description', 'notes': 'notes'};
function chargerXlsx(){
  if (window.XLSX) return Promise.resolve();
  return new Promise(function(ok, ko){ var s = document.createElement('script'); s.src = '/assets/vendor/xlsx.mini.min.js'; s.onload = ok; s.onerror = function(){ ko(new Error('Lecture Excel indisponible.')); }; document.head.appendChild(s); });
}
function lireTableau(f){
  if (/\.xlsx?$/i.test(f.name)){
    return chargerXlsx().then(function(){ return f.arrayBuffer(); }).then(function(buf){
      var wb = window.XLSX.read(buf, {type: 'array'});
      return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1, defval: '', raw: true});
    });
  }
  return f.text().then(function(t){
    t = t.replace(/^\uFEFF/, '');
    var l0 = t.split('\n')[0], sep = (l0.match(/;/g) || []).length > (l0.match(/,/g) || []).length ? ';' : ',';
    var lignes = [], ligne = [], champ = '', guil = false;
    for (var i = 0; i < t.length; i++){
      var c = t[i];
      if (guil){ if (c === '"'){ if (t[i + 1] === '"'){ champ += '"'; i++; } else guil = false; } else champ += c; }
      else if (c === '"') guil = true;
      else if (c === sep){ ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r'){ if (c === '\r' && t[i + 1] === '\n') i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
      else champ += c;
    }
    if (champ || ligne.length){ ligne.push(champ); lignes.push(ligne); }
    return lignes;
  });
}
function enObjets(lignes){
  var iTete = -1, cles = [];
  for (var i = 0; i < Math.min(lignes.length, 15); i++){
    var c = lignes[i].map(function(h){ return ENTETES[slug(String(h).replace(/\(.*?\)/g, ''))] || null; });
    if (c.filter(Boolean).length >= 2 && (c.indexOf('nom') > -1 || c.indexOf('id') > -1)){ iTete = i; cles = c; break; }
  }
  if (iTete < 0) throw new Error('Colonnes non reconnues. Utilisez le fichier modèle de L\'Officine ou des colonnes nom, rayon, prix, stock.');
  return lignes.slice(iTete + 1).map(function(l){
    var o = {}; cles.forEach(function(k, j){ if (k) o[k] = String(l[j] == null ? '' : l[j]).trim(); }); return o;
  }).filter(function(o){ return o.id || o.nom; });
}
$('#csv').setAttribute('accept', '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
$('#csv').addEventListener('change', function(e){
  var f = e.target.files[0]; if (!f) return;
  lireTableau(f).then(enObjets).then(function(objets){
    var parId = {}; etat.produits.forEach(function(p){ parId[p.id] = p; });
    var envois = [], erreurs = [], nNeufs = 0, nMaj = 0, nPrix = 0;
    objets.forEach(function(o, i){
      var ex = o.id && parId[o.id], v = {};
      if (o.prix !== undefined && o.prix !== ''){ var px = nombre(o.prix); if (px === null || px < 0){ erreurs.push((o.nom || o.id) + ' : prix illisible'); return; } v.prix = px; if (px > 0) nPrix++; }
      if (o.stock !== undefined && o.stock !== ''){ var st = parseInt(o.stock, 10); if (isNaN(st) || st < 0){ erreurs.push((o.nom || o.id) + ' : stock illisible'); return; } v.stock = st; }
      if (o.actif) v.actif = !/^(non|no|0|false|hors)/i.test(o.actif);
      ['marque', 'nom', 'contenance', 'origine', 'style', 'degre', 'accroche', 'description', 'notes'].forEach(function(k){ if (o[k]) v[k] = o[k]; });
      if (o.categorie){ var cat = ALIAS[slug(o.categorie)]; if (cat) v.categorie = cat; }
      if (ex){
        var fusion = Object.assign({}, ex, v);
        delete fusion.created_at;
        envois.push(fusion); nMaj++;
      } else {
        if (!v.nom || !v.categorie){ erreurs.push('Ligne ' + (i + 1) + ' (' + (o.nom || o.id || 'sans nom') + ') : nom ou rayon manquant'); return; }
        v.id = o.id || slug((v.marque || '') + ' ' + v.nom + ' ' + (v.contenance || ''));
        if (parId[v.id]){ envois.push(Object.assign({}, parId[v.id], v)); nMaj++; return; }
        envois.push(Object.assign({prix: 0, stock: 0, actif: true, ordre: 1000 + i}, v)); nNeufs++;
      }
    });
    ouvrir({titre: 'Importer ' + f.name, okTexte: 'Importer ' + envois.length + ' ligne' + (envois.length > 1 ? 's' : ''),
      html: '<div class="sect"><p><b>' + envois.length + '</b> lignes prêtes : ' + nMaj + ' mises à jour, ' + nNeufs + ' nouvelles références, ' + nPrix + ' avec un prix.' + (erreurs.length ? ' <b>' + erreurs.length + '</b> lignes ignorées.' : '') + '</p>' +
        '<p class="aide" style="margin-top:6px">Pour les références existantes, seules les cases remplies du fichier sont modifiées : photos, descriptions, badges et offres restent intacts.</p>' +
        '<div class="apercu-import">' + (envois.slice(0, 60).map(function(p){ return esc((p.marque ? p.marque + ' ' : '') + p.nom) + ', ' + (p.prix > 0 ? euros(p.prix) : 'prix à venir') + ', stock ' + (p.stock || 0) + (p.actif === false ? ', masqué' : ''); }).join('<br>') || 'Aucune ligne valable.') + (envois.length > 60 ? '<br>…' : '') + '</div>' +
        (erreurs.length ? '<div class="apercu-import" style="color:var(--rouge)">' + erreurs.map(esc).join('<br>') + '</div>' : '') + '</div>',
      valider: envois.length ? function(){
        var paquets = [], k;
        for (k = 0; k < envois.length; k += 100) paquets.push(envois.slice(k, k + 100));
        return paquets.reduce(function(pr, lot){
          return pr.then(function(){ return sb.from('produits').upsert(lot, {onConflict: 'id'}).then(function(r){ if (r.error) throw new Error('Import impossible : ' + r.error.message); }); });
        }, Promise.resolve()).then(function(){ toast(envois.length + ' lignes importées.'); return chargerProduits(); });
      } : null});
  }).catch(function(err){ toast(err.message, true); });
  e.target.value = '';
});

/* ================= Événements ================= */
function chargerEvenements(){
  return sb.from('evenements').select('*').order('ordre').order('date').then(function(r){
    if (r.error){ toast('Lecture des événements impossible : ' + r.error.message, true); return; }
    etat.evenements = r.data.map(function(e){ e.prix = Number(e.prix); return e; }); rendreEvenements();
  });
}
$('#evtFiltres').addEventListener('click', function(e){ var b = e.target.closest('[data-periode]'); if (b){ etat.periode = b.dataset.periode; rendreEvenements(); } });
function rendreEvenements(){
  var a = aujourdHui(), avenir = etat.periode === 'avenir';
  $$('#evtFiltres [data-periode]').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.periode === etat.periode); });
  $('#evtTriDate').hidden = !avenir;
  var liste = etat.evenements.filter(function(e){ return avenir ? jour(e.date) >= a : jour(e.date) < a; });
  if (!avenir) liste.sort(function(x, y){ return jour(y.date) - jour(x.date); });
  var el = $('#evtListe');
  el.classList.toggle('sans-tri', !avenir);
  if (!liste.length){ el.innerHTML = '<div class="vide"><b>' + (avenir ? 'Aucun événement à venir.' : 'Aucun événement passé.') + '</b>' + (avenir ? 'Créez le premier, il apparaîtra aussitôt dans le programme.' : '') + '</div>'; activerTri(el, false); return; }
  el.innerHTML = liste.map(function(e){
    var pct = e.places_total ? Math.min(100, e.places_vendues / e.places_total * 100) : 0, complet = e.places_vendues >= e.places_total;
    var tags = (!e.actif ? '<span class="tag">Masqué</span>' : '') + (complet ? '<span class="tag rouge">Complet</span>' : (avenir && e.actif ? '<span class="tag vert">Réservations ouvertes</span>' : ''));
    return '<div class="ligne evt-l' + (e.actif ? '' : ' hors') + (avenir ? '' : ' passe') + '" data-id="' + e.id + '">' + POIGNEE +
      '<div class="vign large">' + (e.image ? '<img src="' + esc(e.image) + '" alt="" loading="lazy">' : '<span class="date-l">' + jour(e.date).getDate() + ' ' + MOIS[jour(e.date).getMonth()] + '</span>') + '</div>' +
      '<div class="titre-l" data-edit><div class="date-l">' + esc(dateLongue(e.date)) + ', ' + esc(e.heure) + '</div><div class="nom">' + esc(e.titre) + '</div><div class="sous">' + esc(e.format) + ', ' + euros(e.prix) + ' la place</div>' + (tags ? '<div class="tags">' + tags + '</div>' : '') + '</div>' +
      '<div class="col-places">' + e.places_vendues + ' / ' + e.places_total + ' places<div class="jauge"><i class="' + (complet ? 'plein' : '') + '" style="width:' + pct + '%"></i></div></div>' +
      '<div class="col-bascule"><button type="button" class="bascule" role="switch" aria-checked="' + e.actif + '" aria-label="Visible sur le site"></button></div>' +
      '<div class="col-actions"><button type="button" class="b mini contour" data-part>Participants</button><button type="button" class="b mini contour" data-edit>Modifier</button></div></div>';
  }).join('');
  activerTri(el, avenir, ordonnerEvenements);
}
function ordonnerEvenements(ids){
  var rang = {}; ids.forEach(function(id, i){ rang[id] = i; });
  etat.evenements.forEach(function(e){ if (rang[e.id] != null) e.ordre = rang[e.id] + 1; });
  sb.rpc('reordonner', {p_table: 'evenements', p_ids: ids}).then(function(r){
    if (r.error){ toast('Ordre non enregistré : ' + r.error.message, true); return chargerEvenements(); }
    toast('Ordre du programme enregistré.');
  });
}
$('#evtTriDate').addEventListener('click', function(){
  var a = aujourdHui();
  var ids = etat.evenements.filter(function(e){ return jour(e.date) >= a; }).sort(function(x, y){ return jour(x.date) - jour(y.date); }).map(function(e){ return e.id; });
  sb.rpc('reordonner', {p_table: 'evenements', p_ids: ids}).then(function(r){
    if (r.error) return toast('Impossible : ' + r.error.message, true);
    toast('Programme remis dans l\'ordre des dates.'); chargerEvenements();
  });
});
$('#evtListe').addEventListener('click', function(ev){
  var l = ev.target.closest('.ligne'); if (!l) return;
  var e = etat.evenements.filter(function(x){ return x.id === l.dataset.id; })[0];
  if (ev.target.closest('.bascule')){
    return sb.from('evenements').update({actif: !e.actif}).eq('id', e.id).then(function(r){
      if (r.error) return toast('Modification impossible : ' + r.error.message, true);
      e.actif = !e.actif; rendreEvenements(); toast(e.actif ? 'Événement visible sur le site.' : 'Événement masqué du site.');
    });
  }
  if (ev.target.closest('[data-part]')) return participants(e);
  if (ev.target.closest('[data-edit]')) editerEvt(e);
});
$('#evtNouveau').addEventListener('click', function(){ editerEvt(null); });
function editerEvt(e, copie){
  var neuf = !e || copie;
  var d = e ? Object.assign({}, e) : {format: 'Atelier dégustation', heure: '18h30', places_total: 12, places_vendues: 0, prix: '', actif: true, date: ''};
  if (copie){ d.date = ''; d.places_vendues = 0; }
  var repli = '<span class="date-l">Photo</span>';
  var html =
    '<div class="sect"><h4>L\'événement</h4>' + depotHtml(d.image, repli) +
      chp('Titre *', inp('titre', d.titre, 'required maxlength="90" placeholder="Ex. : Les rhums vieux de la Caraïbe"')) +
      chp('Format', '<div class="choix">' + FORMATS.map(function(f){ return '<label><input type="radio" name="format" value="' + f + '"' + (f === d.format ? ' checked' : '') + '><span>' + f + '</span></label>'; }).join('') + '</div>') +
      chp('Description', '<textarea name="description" maxlength="400" rows="4" placeholder="Le programme, l\'intervenant, ce qu\'on va goûter.">' + esc(d.description || '') + '</textarea>') +
    '</div>' +
    '<div class="sect"><h4>Date et places</h4>' +
      '<div class="duo">' + chp('Date *', inp('date', d.date, 'type="date" required min="' + (neuf ? isoJour(aujourdHui()) : '') + '"')) + chp('Heure *', inp('heure', d.heure, 'required placeholder="18h30"')) + '</div>' +
      '<div class="trio">' + chp('Prix par place', '<span class="prefixe" data-unite="€">' + inp('prix', d.prix === '' ? '' : String(d.prix).replace('.', ','), 'inputmode="decimal" required') + '</span>') +
        chp('Places au total', inp('places_total', d.places_total, 'type="number" min="1" inputmode="numeric"')) +
        chp('Déjà vendues', inp('places_vendues', d.places_vendues, 'type="number" min="0" inputmode="numeric"'), 'Mis à jour avec les ventes en ligne. À corriger si vous vendez en boutique.') + '</div>' +
      '<div class="ligne-bascule"><span>Visible sur le site</span><button type="button" class="bascule" role="switch" data-champ="actif" aria-checked="' + d.actif + '"></button></div>' +
    '</div>' +
    (neuf ? '' : '<p style="margin-top:18px"><button type="button" class="b contour mini" data-dupliquer>Dupliquer (nouvelle date)</button></p>');
  ouvrir({
    titre: neuf ? (copie ? 'Nouvelle date : ' + d.titre : 'Nouvel événement') : d.titre, html: html,
    supprimer: neuf ? null : function(){
      if (d.places_vendues > 0) return toast('Des places sont vendues : masquez l\'événement plutôt que de le supprimer.', true);
      if (!confirm('Supprimer « ' + d.titre + ' » ?')) return;
      sb.from('evenements').delete().eq('id', d.id).then(function(r){
        if (r.error) return toast('Suppression impossible : ' + r.error.message, true);
        modifie = false; fermer(true); toast('Événement supprimé.'); chargerEvenements();
      });
    },
    apres: function(form){
      brancherDepot(form, repli);
      $$('.bascule[data-champ]', form).forEach(function(b){ b.addEventListener('click', function(){ b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true'); modifie = true; }); });
      var dup = $('[data-dupliquer]', form);
      if (dup) dup.addEventListener('click', function(){ if (modifie && !confirm('Les modifications en cours seront perdues. Continuer ?')) return; modifie = false; fermer(true); editerEvt(d, true); });
    },
    valider: function(form){
      effacerErreurs(form);
      var el = form.elements, ok = true;
      var v = {
        titre: el.titre.value.trim(), format: form.querySelector('input[name=format]:checked').value,
        description: el.description.value.trim() || null, date: el.date.value, heure: el.heure.value.trim(),
        prix: nombre(el.prix.value), places_total: parseInt(el.places_total.value, 10) || 0,
        places_vendues: Math.max(0, parseInt(el.places_vendues.value, 10) || 0),
        actif: $('[data-champ="actif"]', form).getAttribute('aria-checked') === 'true'
      };
      if (!v.titre){ erreurChamp(form, 'titre', 'Le titre est obligatoire.'); ok = false; }
      if (!v.date){ erreurChamp(form, 'date', 'Choisissez une date.'); ok = false; }
      if (!v.heure){ erreurChamp(form, 'heure', 'Indiquez l\'heure.'); ok = false; }
      if (v.prix === null || v.prix < 0){ erreurChamp(form, 'prix', 'Indiquez un prix (0 si gratuit).'); ok = false; }
      if (v.places_total < 1){ erreurChamp(form, 'places_total', 'Au moins 1 place.'); ok = false; }
      if (v.places_vendues > v.places_total){ erreurChamp(form, 'places_vendues', 'Plus de places vendues que de places.'); ok = false; }
      if (!ok) return false;
      return photoFinale(form, 'evt-' + slug(v.titre)).then(function(url){
        v.image = url;
        if (neuf){ v.ordre = etat.evenements.reduce(function(m, x){ return Math.max(m, x.ordre || 0); }, 0) + 1; return sb.from('evenements').insert(v); }
        return sb.from('evenements').update(v).eq('id', d.id);
      }).then(function(r){
        if (r.error) throw new Error('Enregistrement impossible : ' + r.error.message);
        toast(neuf ? 'Événement créé, il est dans le programme.' : 'Événement mis à jour.');
        etat.periode = 'avenir';
        return chargerEvenements();
      });
    }
  });
}
function participants(e){
  sb.from('commandes').select('numero,client_nom,client_tel,client_email,lignes,statut').contains('lignes', [{ref: e.id}]).then(function(r){
    if (r.error) return toast('Lecture impossible : ' + r.error.message, true);
    var total = 0, lignes = [];
    r.data.forEach(function(c){
      if (c.statut === 'annulee') return;
      var q = c.lignes.filter(function(l){ return l.ref === e.id; }).reduce(function(t, l){ return t + l.qte; }, 0);
      if (!q) return;
      total += q;
      lignes.push('<li><span><b>' + esc(c.client_nom || 'Sans nom') + '</b><br><span class="sous">' + esc(c.numero) + ', ' + esc(c.client_tel || c.client_email || '') + '</span></span><span>' + q + (q > 1 ? ' places' : ' place') + '</span></li>');
    });
    ouvrir({titre: 'Participants', html: '<div class="sect"><h4>' + esc(e.titre) + '</h4><p class="aide">' + esc(dateLongue(e.date)) + ', ' + esc(e.heure) + '. ' + total + ' place(s) réservée(s) en ligne, ' + e.places_vendues + ' comptée(s) au total.</p>' +
      (lignes.length ? '<ul class="participants">' + lignes.join('') + '</ul>' : '<p class="vide" style="margin-top:12px">Aucune réservation en ligne pour le moment.</p>') +
      '<p style="margin-top:16px"><button type="button" class="b contour" onclick="window.print()">Imprimer la liste</button></p></div>'});
  });
}

/* ================= Exports Excel ================= */
var STATUT_TXT = {a_preparer: 'À préparer', prete: 'Prête', retiree: 'Retirée', annulee: 'Annulée'};
function feuilleCommandes(){
  var lignes = [];
  etat.commandes.forEach(function(c){
    (c.lignes || []).forEach(function(l){
      lignes.push({'Numéro': c.numero, 'Date': new Date(c.created_at).toLocaleString('fr-FR', {timeZone: 'America/Guadeloupe'}), 'Statut': STATUT_TXT[c.statut] || c.statut,
        'Règlement': c.paiement === 'au_retrait' ? 'Au retrait' : 'En ligne', 'Client': c.client_nom || '', 'Téléphone': c.client_tel || '', 'E-mail': c.client_email || '',
        'Article': l.nom, 'Type': l.type === 'evenement' ? 'Réservation' : 'Produit', 'Quantité': l.qte, 'Prix unitaire (€)': l.prix, 'Sous-total (€)': Math.round(l.prix * l.qte * 100) / 100,
        'Total commande (€)': Number(c.total), 'Note client': c.note || ''});
    });
  });
  return lignes;
}
function feuilleCatalogue(){
  return etat.produits.map(function(p){
    return {'Référence': p.id, 'Rayon': CATS[p.categorie], 'Marque': p.marque || '', 'Produit': p.nom, 'Contenance': p.contenance || '', 'Prix TTC (€)': p.prix, 'Stock': p.stock,
      'En ligne': p.actif ? 'oui' : 'non', 'Badge': p.badge || '', 'Prix offre (€)': p.prix_offre == null ? '' : p.prix_offre, 'Offre': p.offre_label || '',
      'Origine': p.origine || '', 'Degré': p.degre || '', 'Accroche': p.accroche || '', 'Description': p.description || '', 'Notes': p.notes || '', 'Photo': p.image || ''};
  });
}
function feuilleEvenements(){
  return etat.evenements.map(function(e){
    return {'Titre': e.titre, 'Format': e.format, 'Date': e.date, 'Heure': e.heure, 'Prix (€)': e.prix, 'Places': e.places_total, 'Vendues': e.places_vendues, 'Visible': e.actif ? 'oui' : 'non', 'Description': e.description || ''};
  });
}
function exporter(quoi){
  chargerXlsx().then(function(){
    var X = window.XLSX, wb = X.utils.book_new();
    var ajout = function(nom, lignes){
      var ws = X.utils.json_to_sheet(lignes.length ? lignes : [{'Info': 'Aucune donnée'}]);
      var cles = Object.keys(lignes[0] || {Info: 1});
      ws['!cols'] = cles.map(function(k){ return {wch: Math.min(60, Math.max(10, k.length + 2, ...lignes.slice(0, 200).map(function(l){ return String(l[k] == null ? '' : l[k]).length; })))}; });
      X.utils.book_append_sheet(wb, ws, nom);
    };
    if (quoi === 'commandes' || quoi === 'tout') ajout('Commandes', feuilleCommandes());
    if (quoi === 'catalogue' || quoi === 'tout') ajout('Catalogue', feuilleCatalogue());
    if (quoi === 'tout') ajout('Evenements', feuilleEvenements());
    var d = new Date(), jourTxt = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    X.writeFile(wb, 'officine-' + (quoi === 'tout' ? 'sauvegarde' : quoi) + '-' + jourTxt + '.xlsx');
    toast('Fichier téléchargé.');
  }).catch(function(e){ toast(e.message, true); });
}
document.addEventListener('click', function(e){ var b = e.target.closest('[data-export]'); if (b) exporter(b.dataset.export); });

/* ================= E-mails de notification ================= */
function ouvrirNotifs(){
  sb.from('notif_emails').select('id,email,valide,ajoute_par,created_at,valide_le').order('created_at').then(function(r){
    var l = r.data || [];
    var lignes = l.length ? l.map(function(n){
      return '<li data-id="' + n.id + '"><span><b>' + esc(n.email) + '</b><br><span class="sous">' +
        (n.valide ? 'Active depuis le ' + dateHeure(n.valide_le) : 'En attente : l\'adresse doit cliquer sur le lien reçu') + '</span></span>' +
        '<span class="actions-m">' + (n.valide ? '<span class="tag vert">Active</span>' : '<span class="tag or">À valider</span><button type="button" class="b mini contour" data-renvoyer>Renvoyer le lien</button>') +
        '<button type="button" class="b mini danger" data-retirer-notif>Retirer</button></span></li>';
    }).join('') : '';
    ouvrir({titre: 'E-mails de notification', okTexte: 'Ajouter et envoyer le lien',
      html: '<div class="sect"><h4>Qui reçoit les commandes ?</h4><p class="aide">Chaque nouvelle commande ou réservation est envoyée à ces adresses. Une adresse ajoutée reçoit d\'abord un e-mail avec un lien d\'activation : elle ne reçoit les commandes qu\'une fois le lien cliqué.</p>' +
        (lignes ? '<ul class="participants">' + lignes + '</ul>' : '<p class="vide" style="margin-top:12px">Aucune adresse pour l\'instant.</p>') + '</div>' +
        '<div class="sect"><h4>Ajouter une adresse</h4>' + chp('E-mail', inp('email', '', 'type="email" placeholder="contact@exemple.fr"')) + '</div>',
      valider: function(form){
        effacerErreurs(form);
        var em = form.elements.email.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(em)){ erreurChamp(form, 'email', 'Adresse invalide.'); return false; }
        return api('/api/notifications', {action: 'ajouter', email: em}).then(function(){
          toast('Lien d\'activation envoyé à ' + em + '.'); setTimeout(ouvrirNotifs, 400);
        });
      },
      apres: function(form){
        $$('li[data-id]', form).forEach(function(li){
          var rv = $('[data-renvoyer]', li);
          if (rv) rv.addEventListener('click', function(){
            api('/api/notifications', {action: 'renvoyer', id: li.dataset.id}).then(function(){ toast('Lien renvoyé.'); }).catch(function(e){ toast(e.message, true); });
          });
          $('[data-retirer-notif]', li).addEventListener('click', function(){
            if (!confirm('Retirer cette adresse ? Elle ne recevra plus les commandes.')) return;
            sb.from('notif_emails').delete().eq('id', li.dataset.id).then(function(x){
              if (x.error) return toast(x.error.message, true);
              toast('Adresse retirée.'); li.remove();
            });
          });
        });
      }});
  });
}
document.addEventListener('click', function(e){ if (e.target.closest('[data-notifs]')) ouvrirNotifs(); });

/* ================= Studio (compte Studio Novalem) ================= */
function chargerStudio(){
  sb.rpc('comptes_en_attente').then(function(r){
    var l = r.data || [];
    badge('Studio', l.length);
    $('#stAttente').innerHTML = l.length ? l.map(function(u){
      return '<div class="membre" data-uid="' + u.user_id + '"><span class="avatar">' + esc((u.nom || u.email).charAt(0).toUpperCase()) + '</span>' +
        '<div class="qui"><b>' + esc(u.nom || 'Sans nom') + '</b><span>' + esc(u.email) + ', créé le ' + dateHeure(u.cree_le) + (u.confirme ? '' : ', e-mail non confirmé') + '</span></div>' +
        '<div class="actions-m"><button class="b mini plein" data-acces="gerant">Accès gérant</button><button class="b mini contour" data-acces="equipe">Accès équipe</button><button class="b mini danger" data-suppr>Supprimer</button></div></div>';
    }).join('') : '<p class="aide">Aucun compte en attente.</p>';
  });
  sb.from('admins').select('*').order('created_at').then(function(r){
    var l = (r.data || []).filter(function(m){ return !m.super; });
    $('#stEquipe').innerHTML = l.length ? l.map(function(m){
      return '<div class="membre" data-uid="' + m.user_id + '"><span class="avatar">' + esc((m.nom || m.email || '?').charAt(0).toUpperCase()) + '</span>' +
        '<div class="qui"><b>' + esc(m.nom || m.email) + '</b><span>' + esc(m.email || '') + '</span></div>' +
        '<div class="actions-m"><select data-role-st aria-label="Rôle"><option value="equipe"' + (m.role === 'equipe' ? ' selected' : '') + '>Équipe</option><option value="gerant"' + (m.role === 'gerant' ? ' selected' : '') + '>Gérant</option></select>' +
        '<button class="b mini danger" data-suppr>Supprimer le compte</button></div></div>';
    }).join('') : '<p class="aide">Personne pour l\'instant. Demandez à Morgane de créer son compte depuis l\'écran de connexion, il apparaîtra dans « Comptes en attente ».</p>';
  });
  sb.from('reglages').select('*').then(function(r){
    (r.data || []).forEach(function(g){
      if (g.cle === 'stripe_etat' && g.valeur){
        var e = g.valeur;
        $('#stStripeEtat').innerHTML = 'Clé ' + (e.mode === 'live' ? '<b>réelle</b>' : '<b>de test</b>') + ' reçue le ' + dateHeure(e.le) + ', compte <b>' + esc(e.compte) + '</b>. Paiements activés chez Stripe : <b>' + (e.paiements_actifs ? 'oui' : 'pas encore') + '</b>. Webhook : ' + (e.webhook_ok === false ? '<b style="color:var(--rouge)">à créer (bouton Secours ci-dessous)</b>' : '<b>en place</b>') + '.';
      }
      if (g.cle === 'code_stripe') montrerLienStripe(g.valeur);
      if (g.cle === 'mode_commande'){ var i = $('#stMode input[value="' + g.valeur + '"]'); if (i) i.checked = true; }
    });
  });
}
function montrerLienStripe(code){
  var url = (C.pageStripe || 'https://officine-paiement.vercel.app').replace(/\/$/, '') + '/?code=' + code;
  var z = $('#stStripeUrl'); z.hidden = false;
  z.innerHTML = '<input readonly value="' + esc(url) + '"><button type="button" class="b mini contour" id="stStripeCopie">Copier le lien</button>';
  $('#stStripeCopie').onclick = function(){ navigator.clipboard.writeText(url).then(function(){ toast('Lien copié : envoyez-le à L\'Officine.'); }); };
}
function reglage(cle, valeur){
  return sb.from('reglages').upsert({cle: cle, valeur: valeur, updated_at: new Date().toISOString()}, {onConflict: 'cle'}).then(function(r){
    if (r.error) throw new Error(r.error.message);
  });
}
$('#stWebhookUrl').textContent = location.origin + '/api/webhook';
$('#stWebhook').addEventListener('click', function(){
  var b = this; b.disabled = true;
  api('/api/studio-stripe', {action: 'webhook'}).then(function(d){ toast('Webhook ' + (d.mode === 'live' ? 'réel' : 'de test') + ' créé.'); chargerStudio(); })
    .catch(function(e){ toast(e.message, true); }).then(function(){ b.disabled = false; });
});
$('#stManuel').addEventListener('click', function(){
  var sk = $('#stSk').value.trim(), wh = $('#stWh').value.trim();
  if (!sk && !wh) return toast('Collez au moins une clé.', true);
  api('/api/studio-stripe', {action: 'manuel', secret: sk || null, webhook: wh || null}).then(function(){
    $('#stSk').value = ''; $('#stWh').value = ''; toast('Clés rangées dans le coffre.'); chargerStudio();
  }).catch(function(e){ toast(e.message, true); });
});
$('#stStripeLien').addEventListener('click', function(){
  var a = new Uint8Array(12); crypto.getRandomValues(a);
  var code = Array.prototype.map.call(a, function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
  reglage('code_stripe', code).then(function(){ montrerLienStripe(code); toast('Nouveau lien créé (l\'ancien ne fonctionne plus).'); }).catch(function(e){ toast(e.message, true); });
});
$('#stMode').addEventListener('change', function(e){
  reglage('mode_commande', e.target.value).then(function(){ toast('Prise de commande mise à jour.'); }).catch(function(err){ toast(err.message, true); });
});
function actionStudio(e){
  var ligne = e.target.closest('[data-uid]'); if (!ligne) return;
  var uid = ligne.dataset.uid, b;
  if ((b = e.target.closest('[data-acces]'))){
    sb.rpc('donner_acces', {p_user: uid, p_role: b.dataset.acces}).then(function(r){
      if (r.error) return toast(r.error.message, true);
      toast('Accès activé.'); chargerStudio(); chargerEquipe();
    });
  }
  if (e.target.closest('[data-suppr]')){
    if (!confirm('Supprimer définitivement ce compte ?')) return;
    sb.rpc('retirer_compte', {p_user: uid}).then(function(r){
      if (r.error) return toast(r.error.message, true);
      toast('Compte supprimé.'); chargerStudio(); chargerEquipe();
    });
  }
}
$('#stAttente').addEventListener('click', actionStudio);
$('#stEquipe').addEventListener('click', actionStudio);
$('#stEquipe').addEventListener('change', function(e){
  if (!e.target.matches('[data-role-st]')) return;
  sb.from('admins').update({role: e.target.value}).eq('user_id', e.target.closest('[data-uid]').dataset.uid).then(function(r){
    if (r.error) return toast(r.error.message, true);
    toast('Rôle mis à jour.'); chargerEquipe();
  });
});
document.addEventListener('click', function(e){ var b = e.target.closest('[data-vue-btn="studio"]'); if (b && etat.moi && etat.moi.super) chargerStudio(); });

/* ================= Équipe ================= */
function chargerEquipe(){
  return sb.from('admins').select('*').order('created_at').then(function(r){
    if (r.error) return;
    etat.equipe = r.data; rendreEquipe();
  });
}
function rendreEquipe(){
  var gerant = etat.moi && etat.moi.role === 'gerant';
  $('#eqListe').innerHTML = etat.equipe.filter(function(m){ return !m.super; }).map(function(m){
    var moi = m.user_id === etat.moi.user_id, nom = m.nom || m.email || 'Membre';
    return '<div class="membre" data-uid="' + m.user_id + '"><span class="avatar">' + esc(nom.charAt(0).toUpperCase()) + '</span>' +
      '<div class="qui"><b>' + esc(nom) + (moi ? ' (vous)' : '') + '</b><span>' + esc(m.email || '') + '</span></div>' +
      (gerant && !moi
        ? '<select data-role aria-label="Rôle"><option value="equipe"' + (m.role === 'equipe' ? ' selected' : '') + '>Équipe</option><option value="gerant"' + (m.role === 'gerant' ? ' selected' : '') + '>Gérant</option></select><button type="button" class="b mini danger" data-retirer>Retirer l\'accès</button>'
        : '<span class="tag">' + (m.role === 'gerant' ? 'Gérant' : 'Équipe') + '</span>') + '</div>';
  }).join('');
}
$('#eqListe').addEventListener('change', function(e){
  if (!e.target.matches('[data-role]')) return;
  var uid = e.target.closest('[data-uid]').dataset.uid;
  sb.from('admins').update({role: e.target.value}).eq('user_id', uid).then(function(r){
    if (r.error) return toast('Modification impossible : ' + r.error.message, true);
    toast('Rôle mis à jour.'); chargerEquipe();
  });
});
$('#eqListe').addEventListener('click', function(e){
  if (!e.target.closest('[data-retirer]')) return;
  var m = etat.equipe.filter(function(x){ return x.user_id === e.target.closest('[data-uid]').dataset.uid; })[0];
  if (!confirm('Retirer l\'accès de ' + (m.nom || m.email) + ' ? Son compte sera supprimé.')) return;
  api('/api/equipe', {action: 'retirer', user_id: m.user_id}).then(function(){ toast('Accès retiré.'); chargerEquipe(); }).catch(function(err){ toast(err.message, true); });
});
$('#eqInviter').addEventListener('click', function(){
  ouvrir({titre: 'Inviter une personne', okTexte: 'Envoyer l\'invitation',
    html: '<div class="sect"><p class="aide">La personne reçoit un e-mail avec un lien pour choisir son mot de passe et entrer dans l\'espace.</p>' +
      chp('Prénom et nom', inp('nom', '', 'maxlength="60" required')) + chp('E-mail *', inp('email', '', 'type="email" required')) +
      chp('Rôle', '<div class="choix"><label><input type="radio" name="role" value="equipe" checked><span>Équipe</span></label><label><input type="radio" name="role" value="gerant"><span>Gérant</span></label></div>') + '</div>',
    valider: function(form){
      effacerErreurs(form);
      var em = form.elements.email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(em)){ erreurChamp(form, 'email', 'E-mail invalide.'); return false; }
      return api('/api/equipe', {action: 'inviter', email: em, nom: form.elements.nom.value.trim(), role: form.querySelector('input[name=role]:checked').value})
        .then(function(){ toast('Invitation envoyée à ' + em + '.'); return chargerEquipe(); });
    }});
});
})();
