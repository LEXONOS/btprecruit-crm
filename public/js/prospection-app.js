/* ═══════════════════════════════════════════════════════════════════
   NOVALEM PROSPECTION — Cockpit de prospection telephonique
   Page autonome (/prospection) branchee sur le meme Supabase que le
   reste du CRM. Concue pour Leyla : reperage sur Google Maps, sessions
   d'appels "bam bam bam", file de mails, objectifs et paliers.
════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

// ── CONFIG SUPABASE (meme projet canonique que le hub / le CRM) ────
var NOV_SB_URL  = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
var NOV_SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';

var _sb = null;
function sb() {
  if (!_sb) { _sb = window.supabase.createClient(NOV_SB_URL, NOV_SB_ANON); }
  return _sb;
}

// ── ZONES COMMERCIALES DE GUADELOUPE ───────────────────────────────
var ZONES = [
  'Jarry', 'Moudong (Jarry)', 'La Jaille (Baie-Mahault)', 'Destreland',
  'Dothemare (Les Abymes)', 'Milenis (Les Abymes)', 'Providence (Les Abymes)',
  'Petit-Perou (Les Abymes)', 'Grand Camp', 'Bergevin (Pointe-a-Pitre)',
  'Pointe-a-Pitre centre', 'Le Gosier', 'Sainte-Anne', 'Saint-Francois',
  'Le Moule', 'Morne-a-l\'Eau', 'Petit-Bourg', 'Lamentin', 'Sainte-Rose',
  'Capesterre-Belle-Eau', 'Basse-Terre', 'Baillif / Saint-Claude', 'Autre'
];

var QUALITES = {
  aucun:         'Aucun site',
  facebook_seul: 'Facebook seulement',
  site_faible:   'Site faible / date',
  site_ok:       'Site correct'
};

var STATUTS = {
  a_appeler:      'A appeler',
  rappeler:       'A rappeler',
  mail_a_envoyer: 'Mail a envoyer',
  mail_envoye:    'Mail envoye',
  rdv_pris:       'RDV pris',
  pas_interesse:  'Pas interesse',
  hors_cible:     'Hors cible',
  injoignable:    'Injoignable'
};

// ── CONTENU COACHING PAR DEFAUT (modifiable par le superviseur) ────
var CFG_DEFAULTS = {
  obj_appels_jour: 30,
  obj_rdv_mission: 20,
  script_accroche:
    'Bonjour, [prenom] de Novalem, je vous derange deux minutes ?\n' +
    '(Attendre le oui. Sourire, ca s\'entend au telephone.)\n\n' +
    'Je vous appelle parce qu\'en preparant ma tournee sur [zone], je suis tombee sur votre fiche Google. ' +
    'Vous avez de bons avis, mais je n\'ai pas trouve votre site internet. C\'est normal, vous n\'en avez pas ?',
  script_decouverte:
    'Laisser parler. Ecouter vraiment, noter ce qu\'il dit.\n\n' +
    'Questions utiles :\n' +
    '- Aujourd\'hui, vos clients vous trouvent comment ? Bouche a oreille ?\n' +
    '- Quand quelqu\'un vous cherche sur Google et ne trouve rien, vous pensez qu\'il fait quoi ?\n' +
    '- Vous avez deja pense a un site, ou on vous a deja fait des devis ?',
  script_proposition:
    'Justement, c\'est pour ca que j\'appelle. Novalem, c\'est une entreprise d\'ici, en Guadeloupe. ' +
    'On cree des sites professionnels en code sur mesure, a partir de 390 euros, site livre et 100 % a vous.\n\n' +
    'Je ne vais pas vous vendre quoi que ce soit au telephone. Ce que je vous propose, c\'est que Louis, ' +
    'le createur, passe vous voir directement, il vous montre des sites qu\'il a faits ici et vous dit ' +
    'exactement ce que ca donnerait pour vous. C\'est gratuit et sans engagement.\n\n' +
    'Vous etes plutot disponible en debut ou en fin de semaine ?\n' +
    '(Toujours proposer un choix entre deux creneaux, jamais une question ouverte.)',
  objections: [
    { q: 'Je n\'ai pas le temps',
      r: 'Je comprends tout a fait, c\'est justement pour ca que je ne vous retiens pas. Le rendez-vous dure 20 minutes, Louis se deplace chez vous, au moment qui VOUS arrange. Vous preferez plutot le matin ou l\'apres-midi ?' },
    { q: 'Combien ca coute ?',
      r: 'Ca depend de ce qu\'il vous faut, mais pour vous donner un ordre d\'idee : un site complet demarre a 390 euros, en une fois, sans abonnement. Une agence classique facture entre 3 000 et 6 000 euros. C\'est exactement ce que Louis vous detaillera au rendez-vous, avec un prix ferme et sans surprise.' },
    { q: 'J\'ai deja une page Facebook, ca me suffit',
      r: 'Facebook c\'est tres bien, gardez-le. Mais quand un client tape votre activite sur Google, c\'est un site qui sort en premier, pas une page Facebook. Et un site, c\'est a vous : personne ne peut le fermer ou changer les regles. Les deux ensemble, c\'est la que ca devient puissant.' },
    { q: 'Envoyez-moi un mail / une doc',
      r: 'Avec plaisir, je vous l\'envoie dans la journee. Je note quelle adresse ? ... Parfait. Et pour que le mail ne se perde pas, je vous propose de deja caler un creneau avec Louis, vous pourrez toujours le decaler. Plutot cette semaine ou la semaine prochaine ?' },
    { q: 'Je n\'ai pas besoin de site, j\'ai deja mes clients',
      r: 'Et c\'est super, ca veut dire que votre travail plait. Le site ne sert pas qu\'a trouver des clients : il rassure ceux qu\'on vous recommande, il affiche vos horaires, vos photos, vos avis. La plupart des clients de Louis etaient dans votre cas, et aujourd\'hui ils recoivent des demandes via leur site.' },
    { q: 'Je vais y reflechir',
      r: 'Bien sur, et vous avez raison de reflechir. Ce que je vous propose, c\'est de reflechir avec les bonnes infos : Louis passe, vous montre du concret, vous donne un prix, et VOUS decidez tranquillement apres. Ca ne vous engage a rien. Mardi ou jeudi ?' }
  ],
  regles: [
    { t: 'Le but de l\'appel, c\'est le rendez-vous', d: 'Jamais de vente au telephone. Un seul objectif par appel : obtenir un creneau pour Louis. Tout le reste est secondaire.' },
    { t: 'Souris avant de decrocher', d: 'Le sourire s\'entend. Tiens-toi droite, parle un peu plus lentement que d\'habitude, articule.' },
    { t: 'Les 10 premieres secondes decident de tout', d: 'Prenom + Novalem + une raison precise d\'appeler (sa fiche Google). Pas de blabla, pas d\'excuses.' },
    { t: 'Pose des questions, puis tais-toi', d: 'Celui qui pose les questions mene l\'appel. Apres une question, silence total : c\'est a lui de parler.' },
    { t: 'Propose toujours deux creneaux', d: '"Mardi ou jeudi ?" fonctionne mille fois mieux que "quand etes-vous disponible ?".' },
    { t: 'Un non n\'est jamais personnel', d: 'Sur 10 appels, 7 diront non. C\'est mathematique, pas personnel. Chaque non te rapproche du prochain oui.' },
    { t: 'Note tout, tout de suite', d: 'Prenom du contact, ce qu\'il a dit, son humeur. La fiche remplie aujourd\'hui, c\'est le rappel reussi de demain.' },
    { t: 'Enchaine sans reflechir', d: 'Le pire ennemi, c\'est la pause entre deux appels. Raccroche, clique, appelle. La vitesse cree l\'elan.' },
    { t: 'Barrage secretaire : reste simple', d: '"C\'est [prenom] de Novalem, c\'est au sujet de la fiche Google de l\'entreprise, il/elle est disponible ?" Dit avec naturel, ca passe.' },
    { t: 'Termine chaque session par une victoire', d: 'Finis toujours sur un appel aboutit (un RDV, un mail note, un rappel cale), jamais sur un echec. C\'est bon pour la tete.' }
  ],
  email_objet: 'Votre site internet — Novalem (suite a notre appel)',
  email_modele:
    'Bonjour{contact},\n\n' +
    'Merci pour notre echange de ce jour au sujet de {entreprise}.\n\n' +
    'Comme convenu, vous trouverez en piece jointe la presentation complete de Novalem : les formules, ' +
    'les options et les abonnements. L\'essentiel en quelques mots :\n\n' +
    '- Site complet a partir de 390 euros, en une fois\n' +
    '- Le site et le nom de domaine sont a vous a 100 %\n' +
    '- Referencement Google integre des la conception\n' +
    '- SAV gratuit a vie sur tout bug du code livre\n\n' +
    'Derniere realisation a decouvrir : https://ifc-guadeloupe.fr\n\n' +
    'La prochaine etape, c\'est simple : Louis, le createur de Novalem, passe vous voir, vous montre des ' +
    'exemples concrets et vous donne un prix ferme, gratuitement et sans engagement.\n\n' +
    'Quelles sont vos disponibilites cette semaine ?\n\n' +
    'Bien cordialement,\n' +
    '{signature}\n' +
    'Novalem — Creation de sites internet en Guadeloupe'
};

// ── ETAT ───────────────────────────────────────────────────────────
var DB = {
  me: null,            // { id, name, role, prenom }
  cibles: [],
  actions: [],         // 30 derniers jours, tous utilisateurs
  users: {},           // id -> nom affiche
  cfg: null,           // CFG_DEFAULTS surcharge par web_parametres.data.prospection
  signes: 0            // clients issus de la prospection passes en signe/en_cours/livre
};
var VIEW = 'jour';
var SESSION = null;    // { queue:[ids], i, appels, rdv, t0 }
var _cfgVersion = null;

// ── HELPERS ────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function digits(s) { return String(s || '').replace(/[^0-9+]/g, ''); }
function fmtTel(s) {
  var d = digits(s).replace(/^\+590/, '0').replace(/^\+33/, '0').replace(/^590/, '0');
  if (d.length === 10) return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return s || '';
}
function telHref(s) { return 'tel:' + digits(s); }
function todayKey(d) {
  var x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function fmtDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' ' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
}
function toast(msg, cls) {
  var t = document.createElement('div');
  t.className = 'toast' + (cls ? ' ' + cls : '');
  t.textContent = msg;
  el('toasts').appendChild(t);
  setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(function () { t.remove(); }, 3000);
}
function copyText(s, msg) {
  navigator.clipboard.writeText(s).then(function () { toast(msg || 'Copie'); })
    .catch(function () { toast('Copie impossible', 'bad'); });
}
function cible(id) {
  for (var i = 0; i < DB.cibles.length; i++) { if (DB.cibles[i].id === id) return DB.cibles[i]; }
  return null;
}
function cfg() { return DB.cfg || CFG_DEFAULTS; }
function isSup() { return DB.me && DB.me.role === 'superviseur'; }
function firstName() {
  if (!DB.me) return '';
  return (DB.me.prenom || (DB.me.name || '').split(' ')[0] || '').trim();
}

// ── CHARGEMENT DES DONNEES ─────────────────────────────────────────
function load() {
  var u = window.CURRENT_USER || {};
  DB.me = { id: u.id, name: u.name || 'Utilisateur', role: u.role || 'scout', prenom: '' };
  var since = new Date(Date.now() - 30 * 864e5).toISOString();

  var pMe = sb().from('users').select('id,prenom,nom,role').eq('id', u.id).maybeSingle()
    .then(function (r) {
      if (r.data) {
        DB.me.prenom = r.data.prenom || '';
        DB.me.role = r.data.role || DB.me.role;
      }
    }).catch(function () {});

  var pUsers = sb().from('users').select('id,prenom,nom')
    .then(function (r) {
      (r.data || []).forEach(function (x) {
        DB.users[x.id] = ((x.prenom || '') + ' ' + (x.nom || '')).trim() || 'Utilisateur';
      });
    }).catch(function () {});

  var pCibles = sb().from('web_prospection_cibles').select('*')
    .order('created_at', { ascending: false }).limit(3000)
    .then(function (r) {
      if (r.error) throw r.error;
      DB.cibles = r.data || [];
    });

  var pActions = sb().from('web_prospection_actions').select('*')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(8000)
    .then(function (r) { DB.actions = (r.data || []); }).catch(function () { DB.actions = []; });

  var pCfg = sb().from('web_parametres').select('data,updated_at').eq('id', 'global').maybeSingle()
    .then(function (r) {
      var p = (r.data && r.data.data && r.data.data.prospection) || {};
      DB.cfg = Object.assign({}, CFG_DEFAULTS, p);
      _cfgVersion = r.data ? r.data.updated_at : null;
    }).catch(function () { DB.cfg = Object.assign({}, CFG_DEFAULTS); });

  var pSignes = sb().from('web_clients').select('id,statut_pipeline,source')
    .ilike('source', 'Prospection%')
    .then(function (r) {
      DB.signes = (r.data || []).filter(function (c) {
        return ['signe', 'en_cours', 'livre', 'sav'].indexOf(c.statut_pipeline) >= 0;
      }).length;
    }).catch(function () {});

  return Promise.all([pMe, pUsers, pCibles, pActions, pCfg, pSignes]);
}

function saveCfg(patch) {
  DB.cfg = Object.assign({}, cfg(), patch);
  return sb().from('web_parametres').select('data').eq('id', 'global').maybeSingle()
    .then(function (r) {
      var data = (r.data && r.data.data) || {};
      data.prospection = Object.assign({}, data.prospection || {}, patch);
      return sb().from('web_parametres').upsert({ id: 'global', data: data, updated_at: new Date().toISOString() });
    })
    .then(function (r) {
      if (r && r.error) throw r.error;
      toast('Reglages enregistres');
    })
    .catch(function () { toast('Enregistrement des reglages impossible', 'bad'); });
}

// ── JOURNAL D'ACTIONS + STATS ──────────────────────────────────────
function logAction(cibleId, type, resultat, details) {
  var a = {
    cible_id: cibleId || null, user_id: DB.me.id, type: type,
    resultat: resultat || null, details: details || null,
    created_at: new Date().toISOString()
  };
  DB.actions.unshift(a);
  sb().from('web_prospection_actions').insert([{
    cible_id: a.cible_id, user_id: a.user_id, type: a.type,
    resultat: a.resultat, details: a.details
  }]).then(function (r) { if (r.error) console.warn('logAction', r.error); });
}
function myCallsToday() {
  var k = todayKey();
  return DB.actions.filter(function (a) {
    return a.user_id === DB.me.id && a.type === 'appel' && todayKey(new Date(a.created_at)) === k;
  }).length;
}
function myStreak() {
  var days = {};
  DB.actions.forEach(function (a) {
    if (a.user_id === DB.me.id && a.type === 'appel') days[todayKey(new Date(a.created_at))] = 1;
  });
  var n = 0, d = new Date();
  if (!days[todayKey(d)]) d.setDate(d.getDate() - 1); // la serie tient si on n'a pas encore appele aujourd'hui
  while (days[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function totalRdv() {
  return DB.cibles.filter(function (c) { return c.statut === 'rdv_pris'; }).length;
}
function dueRappels() {
  var now = Date.now();
  return DB.cibles.filter(function (c) {
    return c.rappel_le && new Date(c.rappel_le).getTime() <= now &&
      ['rappeler', 'mail_envoye'].indexOf(c.statut) >= 0;
  }).sort(function (a, b) { return new Date(a.rappel_le) - new Date(b.rappel_le); });
}
function mailsAEnvoyer() {
  return DB.cibles.filter(function (c) { return c.statut === 'mail_a_envoyer'; });
}

// ── TOPBAR (anneau, serie, badges) ─────────────────────────────────
function refreshTop() {
  var calls = myCallsToday(), goal = cfg().obj_appels_jour || 30;
  el('ring-n').textContent = calls + '/' + goal;
  var pct = Math.min(1, goal ? calls / goal : 0);
  el('ring-fg').style.strokeDashoffset = String(100.5 * (1 - pct));
  el('ring-fg').style.stroke = pct >= 1 ? 'var(--ok)' : 'var(--gold)';
  el('streak-n').textContent = String(myStreak());
  var f = firstName() || DB.me.name;
  el('u-name').textContent = f;
  el('u-avatar').textContent = (f[0] || '?').toUpperCase();
  var nr = dueRappels().length;
  el('tb-rap').style.display = nr ? '' : 'none';
  el('tb-rap').textContent = String(nr);
  el('tb-rap').style.background = 'var(--bad)';
  var nm = mailsAEnvoyer().length;
  el('tb-mails').style.display = nm ? '' : 'none';
  el('tb-mails').textContent = String(nm);
  var nf = DB.cibles.length;
  el('tb-fichier').style.display = nf ? '' : 'none';
  el('tb-fichier').textContent = String(nf);
  el('tab-pilotage').style.display = isSup() ? '' : 'none';
  el('top-date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── CONFETTIS + PALIERS ────────────────────────────────────────────
function confetti() {
  var cv = el('confetti'), ctx = cv.getContext('2d');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  var cols = ['#C8900A', '#E0A92E', '#F0CE78', '#26221A', '#FFFFFF'];
  var parts = [];
  for (var i = 0; i < 110; i++) {
    parts.push({
      x: cv.width / 2 + (Math.random() - .5) * 140, y: cv.height / 2,
      vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4,
      s: Math.random() * 7 + 4, c: cols[i % cols.length],
      r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3
    });
  }
  var t0 = Date.now();
  (function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += .35; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
      ctx.restore();
    });
    if (Date.now() - t0 < 1800) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}
function milestone(title, sub) {
  var m = document.createElement('div');
  m.className = 'milestone';
  m.innerHTML = '<div class="mcard"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>';
  document.body.appendChild(m);
  setTimeout(function () { m.remove(); }, 2400);
}

// ── ROUTEUR D'ONGLETS ──────────────────────────────────────────────
var VIEWS = {};
function show(v) {
  VIEW = v;
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('act', tabs[i].getAttribute('data-v') === v);
  el('view').innerHTML = '';
  el('view').style.animation = 'none';
  void el('view').offsetWidth;
  el('view').style.animation = '';
  (VIEWS[v] || VIEWS.jour)();
  refreshTop();
}
window.show = show;
document.getElementById('tabs').addEventListener('click', function (e) {
  var t = e.target.closest('.tab');
  if (t) show(t.getAttribute('data-v'));
});
window.logout = function () {
  try { sb().auth.signOut(); } catch (e) {}
  localStorage.removeItem('novalem_user');
  window.location.href = '/';
};

// ═══════════════════════════════════════════════════════════════════
// VUE : MA JOURNEE
// ═══════════════════════════════════════════════════════════════════
VIEWS.jour = function () {
  var rdv = totalRdv(), goal = cfg().obj_rdv_mission || 20;
  var pct = Math.min(100, Math.round(rdv / goal * 100));
  var due = dueRappels(), mails = mailsAEnvoyer();
  var aAppeler = DB.cibles.filter(function (c) { return c.statut === 'a_appeler'; }).length;
  var calls = myCallsToday();
  var h = new Date().getHours();
  var salut = h < 12 ? 'Bonjour' : (h < 18 ? 'Bon apres-midi' : 'Bonsoir');

  var dueHtml = due.slice(0, 6).map(function (c) {
    return '<div class="row"><div class="r-main"><b>' + esc(c.entreprise) + '</b>' +
      '<span>' + esc(STATUTS[c.statut]) + ' &middot; prevu ' + esc(fmtDate(c.rappel_le)) + '</span></div>' +
      '<span class="r-tel">' + esc(fmtTel(c.telephone)) + '</span>' +
      '<button class="btn mini gold" onclick="startSession(\'' + c.id + '\')">Appeler</button></div>';
  }).join('');

  el('view').innerHTML =
    '<div class="h1">' + salut + ' ' + esc(firstName() || DB.me.name) + '<small>' +
      (calls === 0 ? 'Prete pour ta session du jour ? Tout est la, il n\'y a plus qu\'a appeler.' :
       'Deja ' + calls + ' appel' + (calls > 1 ? 's' : '') + ' aujourd\'hui. On continue sur la lancee.') +
    '</small></div>' +

    '<div class="mission" style="margin-top:20px">' +
      '<div class="mission-head"><b>Mission : ' + goal + ' rendez-vous pour Louis</b>' +
      '<span>' + rdv + ' / ' + goal + ' &middot; ' + pct + ' %</span></div>' +
      '<div class="mbar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="mnote">' + (rdv >= goal ? 'Mission accomplie. Bravo, serieusement.' :
        (goal - rdv) + ' rendez-vous restants. Chaque appel compte.') + '</div>' +
    '</div>' +

    '<div class="grid3" style="margin-top:14px">' +
      '<div class="card stat"><b>' + calls + '</b><span>Appels aujourd\'hui</span>' +
        '<span class="sub">Objectif : ' + (cfg().obj_appels_jour || 30) + ' par jour</span></div>' +
      '<div class="card stat"><b>' + aAppeler + '</b><span>Cibles a appeler</span>' +
        '<span class="sub">' + (aAppeler < 15 ? 'Pense a passer en Reperage pour recharger' : 'De quoi tenir la session') + '</span></div>' +
      '<div class="card stat"><b>' + due.length + '</b><span>Rappels du jour</span>' +
        '<span class="sub">' + (mails.length ? mails.length + ' mail(s) a envoyer en plus' : 'File de mails a jour') + '</span></div>' +
    '</div>' +

    '<div style="margin-top:22px;text-align:center">' +
      '<button class="btn gold big" onclick="startSession()">Lancer la session d\'appels</button>' +
      '<div style="font-size:12px;color:var(--mut2);margin-top:9px;font-weight:600">Rappels en retard d\'abord, puis les nouvelles cibles</div>' +
    '</div>' +

    (due.length ? '<div class="sec-t">A rappeler maintenant</div><div class="card">' + dueHtml + '</div>' : '') +
    (mails.length ? '<div class="sec-t">Mails en attente</div><div class="card"><div class="row">' +
      '<div class="r-main"><b>' + mails.length + ' mail' + (mails.length > 1 ? 's' : '') + ' a envoyer</b>' +
      '<span>Des prospects attendent la doc promise au telephone</span></div>' +
      '<button class="btn mini" onclick="show(\'mails\')">Ouvrir la file</button></div></div>' : '');
};

// ═══════════════════════════════════════════════════════════════════
// VUE : SESSION D'APPELS
// ═══════════════════════════════════════════════════════════════════
function buildQueue(focusId) {
  var due = dueRappels().map(function (c) { return c.id; });
  var fresh = DB.cibles.filter(function (c) { return c.statut === 'a_appeler'; })
    .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })
    .map(function (c) { return c.id; });
  var q = due.concat(fresh);
  if (focusId) {
    q = q.filter(function (id) { return id !== focusId; });
    q.unshift(focusId);
  }
  return q;
}
window.startSession = function (focusId) {
  SESSION = { queue: buildQueue(focusId || null), i: 0, appels: 0, rdv: 0, t0: Date.now() };
  show('session');
};
VIEWS.session = function () {
  if (!SESSION) SESSION = { queue: buildQueue(null), i: 0, appels: 0, rdv: 0, t0: Date.now() };
  renderCall();
};
function sessCurrent() {
  if (!SESSION) return null;
  while (SESSION.i < SESSION.queue.length) {
    var c = cible(SESSION.queue[SESSION.i]);
    if (c) return c;
    SESSION.i++;
  }
  return null;
}
function renderCall() {
  var c = sessCurrent();
  var mins = SESSION ? Math.floor((Date.now() - SESSION.t0) / 60000) : 0;
  var head =
    '<div class="sess-top">' +
      '<span class="chip">Cible <b>' + (SESSION ? Math.min(SESSION.i + 1, SESSION.queue.length) : 0) + ' / ' + (SESSION ? SESSION.queue.length : 0) + '</b></span>' +
      '<span class="chip">Appels <b>' + (SESSION ? SESSION.appels : 0) + '</b></span>' +
      '<span class="chip">RDV <b>' + (SESSION ? SESSION.rdv : 0) + '</b></span>' +
      '<span class="chip">Duree <b>' + mins + ' min</b></span>' +
      '<button class="btn ghost mini" style="margin-left:auto" onclick="endSession()">Terminer la session</button>' +
    '</div>';

  if (!c) {
    el('view').innerHTML = head +
      '<div class="card empty"><b>File d\'appels vide</b>' +
      '<span>Toutes les cibles du moment sont traitees. Passe en Reperage pour recharger la file,<br>ou souffle deux minutes, tu l\'as merite.</span>' +
      '<div style="margin-top:16px"><button class="btn gold" onclick="show(\'reperage\')">Aller au Reperage</button></div></div>';
    return;
  }

  var s = cfg();
  var objHtml = (s.objections || []).map(function (o) {
    return '<details class="obj"><summary>' + esc(o.q) + '</summary><div class="ob">' + esc(o.r) + '</div></details>';
  }).join('');

  el('view').innerHTML = head +
    '<div class="sess-grid">' +
      '<div>' +
        '<div class="callcard">' +
          '<div class="cc-ent">' + esc(c.entreprise) + '</div>' +
          '<div class="cc-meta">' +
            (c.zone ? '<span class="chip">' + esc(c.zone) + '</span>' : '') +
            '<span class="chip">' + esc(QUALITES[c.qualite_site] || 'Site inconnu') + '</span>' +
            '<span class="pill p-' + esc(c.statut) + '">' + esc(STATUTS[c.statut]) + '</span>' +
            (c.tentatives ? '<span class="chip">Tentative n&deg;' + (c.tentatives + 1) + '</span>' : '') +
          '</div>' +
          (c.telephone ?
            '<a class="cc-tel" href="' + esc(telHref(c.telephone)) + '" onclick="markDialed()">' + esc(fmtTel(c.telephone)) + '</a>' +
            '<div class="cc-tel-sub">Clique pour appeler, ou touche C pour copier le numero</div>'
            : '<div class="cc-tel" style="font-size:22px;color:var(--bad)">Numero manquant</div>' +
              '<div class="cc-tel-sub">Complete la fiche depuis l\'onglet Fichier, ou passe a la suivante</div>') +
          (c.lien_maps ? '<a href="' + esc(c.lien_maps) + '" target="_blank" rel="noopener" class="btn mini" style="margin-right:8px">Fiche Google</a>' : '') +
          (c.site_actuel ? '<a href="' + esc(c.site_actuel) + '" target="_blank" rel="noopener" class="btn mini">Site actuel</a>' : '') +
          (c.notes ? '<div class="cc-notes">' + esc(c.notes) + '</div>' : '') +
          '<div class="outcomes">' +
            '<button class="oc oc-rdv"  onclick="ocRdv()"><b>RDV pris</b><span class="key">1</span></button>' +
            '<button class="oc oc-rap"  onclick="ocRappeler()"><b>A rappeler</b><span class="key">2</span></button>' +
            '<button class="oc oc-mail" onclick="ocMail()"><b>Veut un mail</b><span class="key">3</span></button>' +
            '<button class="oc oc-nrp"  onclick="ocNrp()"><b>Pas de reponse</b><span class="key">4</span></button>' +
            '<button class="oc oc-non"  onclick="ocNon()"><b>Pas interesse</b><span class="key">5</span></button>' +
            '<button class="oc oc-hc"   onclick="ocHorsCible()"><b>Hors cible</b><span class="key">6</span></button>' +
          '</div>' +
          '<div style="margin-top:10px"><button class="oc" style="width:100%;flex-direction:row;justify-content:center" onclick="ocAutre()"><b>Autre issue (je raconte ce qui s\'est passe)</b><span class="key">7</span></button></div>' +
          '<div class="skip"><button onclick="ocSkip()">Passer sans appeler</button>' +
          ' &middot; <button onclick="ocNote()">Ajouter une note</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="script"><div class="card">' +
        '<div class="sc-head"><b>Script d\'appel</b></div>' +
        '<div class="sc-body">' +
          '<div class="sc-step"><div class="st"><i>1</i>Accroche</div><p>' + esc(s.script_accroche) + '</p></div>' +
          '<div class="sc-step"><div class="st"><i>2</i>Decouverte</div><p>' + esc(s.script_decouverte) + '</p></div>' +
          '<div class="sc-step"><div class="st"><i>3</i>Le rendez-vous</div><p>' + esc(s.script_proposition) + '</p></div>' +
          '<div class="sc-step"><div class="st"><i>!</i>Objections</div>' + objHtml + '</div>' +
        '</div>' +
      '</div></div>' +
    '</div>';
}
window.markDialed = function () { /* clic sur tel: — rien a faire, l'issue sera loggee par les boutons */ };
window.endSession = function () {
  if (SESSION && SESSION.appels > 0) {
    toast('Session terminee : ' + SESSION.appels + ' appel(s), ' + SESSION.rdv + ' RDV');
  }
  SESSION = null;
  show('jour');
};

// ── ISSUES D'APPEL ─────────────────────────────────────────────────
function updCible(id, patch) {
  var c = cible(id);
  if (c) Object.assign(c, patch);
  return sb().from('web_prospection_cibles').update(patch).eq('id', id)
    .then(function (r) { if (r.error) { console.warn(r.error); toast('Sauvegarde en ligne echouee', 'bad'); } });
}
function advance() {
  if (SESSION) { SESSION.i++; }
  refreshTop();
  if (VIEW === 'session') renderCall();
}
function bumpCall(c, resultat, details) {
  if (SESSION) SESSION.appels++;
  logAction(c.id, 'appel', resultat, details || null);
  checkCallMilestones();
}
function checkCallMilestones() {
  var n = myCallsToday();
  if (n === (cfg().obj_appels_jour || 30)) milestone('Objectif du jour atteint', n + ' appels. Machine.');
}
window.ocSkip = function () { advance(); };
window.ocNote = function () {
  var c = sessCurrent(); if (!c) return;
  openModal('Note sur ' + esc(c.entreprise),
    '<div class="field"><label>Note</label><textarea id="m-note">' + esc(c.notes || '') + '</textarea></div>',
    [{ label: 'Enregistrer', cls: 'gold', fn: function () {
      var v = el('m-note').value.trim();
      updCible(c.id, { notes: v });
      logAction(c.id, 'note', null, v.slice(0, 200));
      closeModal(); renderCall();
    } }]);
};
window.ocNrp = function () {
  var c = sessCurrent(); if (!c) return;
  var t = (c.tentatives || 0) + 1;
  var patch = { tentatives: t };
  if (t >= 3) { patch.statut = 'injoignable'; patch.rappel_le = null; }
  else {
    patch.statut = 'rappeler';
    var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 30, 0, 0);
    patch.rappel_le = d.toISOString();
  }
  updCible(c.id, patch);
  bumpCall(c, 'pas_repondu');
  toast(t >= 3 ? 'Classee injoignable apres 3 tentatives' : 'Rappel automatique demain matin');
  advance();
};
window.ocNon = function () {
  var c = sessCurrent(); if (!c) return;
  openModal('Pas interesse — ' + esc(c.entreprise),
    '<div class="field"><label>Raison donnee (utile pour Louis)</label><input id="m-raison" placeholder="ex : trop cher, deja un neveu qui s\'en occupe..."></div>',
    [{ label: 'Passer sans raison', cls: '', fn: function () { finishNon(c, ''); } },
     { label: 'Enregistrer', cls: 'gold', fn: function () { finishNon(c, el('m-raison').value.trim()); } }]);
};
function finishNon(c, raison) {
  updCible(c.id, { statut: 'pas_interesse', tentatives: (c.tentatives || 0) + 1, rappel_le: null,
    notes: raison ? ((c.notes ? c.notes + '\n' : '') + 'Refus : ' + raison) : c.notes });
  bumpCall(c, 'pas_interesse', raison);
  closeModal();
  toast('Suivante. Un non de plus vers le prochain oui.');
  advance();
}
window.ocHorsCible = function () {
  var c = sessCurrent(); if (!c) return;
  updCible(c.id, { statut: 'hors_cible', rappel_le: null });
  logAction(c.id, 'statut', 'hors_cible');
  advance();
};
window.ocAutre = function () {
  var c = sessCurrent(); if (!c) return;
  openModal('Autre issue — ' + esc(c.entreprise),
    '<div class="field"><label>Ce qui s\'est passe *</label><textarea id="m-autre" placeholder="ex : c\'est la femme du gerant qui a repondu, elle dit de rappeler M. Celestin directement au 0690..., plutot interesse"></textarea></div>' +
    '<div class="field"><label>Et maintenant ?</label><div class="qchips">' +
      '<button class="qchip on" id="ma-next-rap" onclick="autreNext(\'rap\')">A rappeler</button>' +
      '<button class="qchip" id="ma-next-file" onclick="autreNext(\'file\')">Laisser dans la file</button>' +
      '<button class="qchip" id="ma-next-clos" onclick="autreNext(\'clos\')">Classer sans suite</button>' +
    '</div></div>' +
    '<div class="frow" id="ma-rapwrap"><div class="field"><label>Rappeler quand ?</label><input type="datetime-local" id="ma-rap"></div></div>',
    [{ label: 'Enregistrer', cls: 'gold', fn: function () {
      var txt = el('m-autre').value.trim();
      if (!txt) { toast('Raconte ce qui s\'est passe, meme en deux mots', 'bad'); return; }
      var nx = window._autreNext || 'rap';
      var patch = { tentatives: (c.tentatives || 0) + 1,
        notes: (c.notes ? c.notes + '\n' : '') + new Date().toLocaleDateString('fr-FR') + ' : ' + txt };
      if (nx === 'rap') {
        var v = el('ma-rap').value;
        var d = v ? new Date(v) : (function () { var x = new Date(); x.setDate(x.getDate() + 1); x.setHours(9, 30, 0, 0); return x; })();
        patch.statut = 'rappeler'; patch.rappel_le = d.toISOString();
      } else if (nx === 'clos') { patch.statut = 'hors_cible'; patch.rappel_le = null; }
      else { patch.statut = 'a_appeler'; patch.rappel_le = null; }
      updCible(c.id, patch);
      bumpCall(c, 'autre', txt.slice(0, 300));
      closeModal(); toast('Note enregistree'); advance();
    } }]);
  window._autreNext = 'rap';
};
window.autreNext = function (n) {
  window._autreNext = n;
  ['rap', 'file', 'clos'].forEach(function (k) {
    var b = el('ma-next-' + k); if (b) b.classList.toggle('on', k === n);
  });
  var w = el('ma-rapwrap'); if (w) w.style.display = n === 'rap' ? '' : 'none';
};
window.ocRappeler = function () {
  var c = sessCurrent(); if (!c) return;
  var chips = [
    { l: 'Dans 1 heure', h: 1 }, { l: 'Cet apres-midi (14h30)', at: 14.5 },
    { l: 'Demain matin (9h30)', d: 1, at: 9.5 }, { l: 'Demain apres-midi (14h30)', d: 1, at: 14.5 },
    { l: 'Lundi matin (9h30)', lundi: true }
  ];
  var html = '<div class="datechips">' + chips.map(function (ch, i) {
    return '<button class="qchip" onclick="pickRappel(' + i + ')">' + esc(ch.l) + '</button>';
  }).join('') + '</div>' +
  '<div class="frow" style="margin-top:6px"><div class="field"><label>Ou choisir</label><input type="datetime-local" id="m-rap"></div></div>' +
  '<div class="field"><label>Note pour le rappel</label><input id="m-rapnote" placeholder="ex : demande de rappeler apres 15h, parler a Mme..."></div>';
  window._rapChips = chips; window._rapCible = c;
  openModal('Programmer le rappel — ' + esc(c.entreprise), html,
    [{ label: 'Programmer', cls: 'gold', fn: function () {
      var v = el('m-rap').value;
      if (!v) { toast('Choisis un creneau ou une date', 'bad'); return; }
      doRappel(c, new Date(v));
    } }]);
};
window.pickRappel = function (i) {
  var ch = window._rapChips[i], d = new Date();
  if (ch.h) d.setTime(d.getTime() + ch.h * 3600e3);
  if (ch.d) d.setDate(d.getDate() + ch.d);
  if (ch.lundi) { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 30, 0, 0); }
  if (ch.at) { d.setHours(Math.floor(ch.at), Math.round(ch.at % 1 * 60), 0, 0); }
  doRappel(window._rapCible, d);
};
function doRappel(c, date) {
  var note = el('m-rapnote') ? el('m-rapnote').value.trim() : '';
  updCible(c.id, { statut: 'rappeler', rappel_le: date.toISOString(), tentatives: (c.tentatives || 0) + 1,
    notes: note ? ((c.notes ? c.notes + '\n' : '') + 'Rappel : ' + note) : c.notes });
  bumpCall(c, 'rappeler', note);
  closeModal();
  toast('Rappel programme ' + fmtDate(date.toISOString()));
  advance();
}
window.ocMail = function () {
  var c = sessCurrent(); if (!c) return;
  openModal('Il veut un mail — ' + esc(c.entreprise),
    '<div class="field"><label>Adresse e-mail *</label><input id="m-email" type="email" value="' + esc(c.email || '') + '" placeholder="contact@entreprise.gp"></div>' +
    '<div class="field"><label>Prenom / nom du contact</label><input id="m-contact" value="' + esc(c.contact_nom || '') + '" placeholder="ex : M. Dupont"></div>',
    [{ label: 'Ajouter a la file de mails', cls: 'gold', fn: function () {
      var em = el('m-email').value.trim();
      if (!em || em.indexOf('@') < 1) { toast('Il faut une adresse e-mail valide', 'bad'); return; }
      updCible(c.id, { statut: 'mail_a_envoyer', email: em, contact_nom: el('m-contact').value.trim() || c.contact_nom,
        tentatives: (c.tentatives || 0) + 1 });
      bumpCall(c, 'mail');
      closeModal();
      toast('Ajoute a la file de mails');
      advance();
    } }]);
};

// ── RDV PRIS : la bascule vers le pipeline de Louis ────────────────
window.ocRdv = function () {
  var c = sessCurrent(); if (!c) return;
  var d = new Date(); d.setDate(d.getDate() + 1);
  var defDate = todayKey(d);
  openModal('RDV pris — ' + esc(c.entreprise),
    '<div class="frow">' +
      '<div class="field"><label>Date *</label><input type="date" id="m-rdate" value="' + defDate + '"></div>' +
      '<div class="field"><label>Heure *</label><input type="time" id="m-rtime" value="09:00"></div>' +
    '</div>' +
    '<div class="field"><label>Type de rendez-vous</label><div class="qchips">' +
      '<button class="qchip on" id="m-rtype-phy" onclick="rdvType(\'phy\')">Sur place</button>' +
      '<button class="qchip" id="m-rtype-tel" onclick="rdvType(\'tel\')">Telephone / visio</button>' +
    '</div></div>' +
    '<div class="frow">' +
      '<div class="field"><label>Contact rencontre</label><input id="m-rcontact" value="' + esc(c.contact_nom || '') + '" placeholder="ex : Mme Larose, la gerante"></div>' +
      '<div class="field"><label>E-mail</label><input id="m-remail" type="email" value="' + esc(c.email || '') + '"></div>' +
    '</div>' +
    '<div class="field"><label>Adresse / lieu</label><input id="m-rlieu" value="' + esc(c.adresse || (c.zone || '')) + '"></div>' +
    '<div class="agenda-day" id="m-agenda"><b>Agenda de Louis ce jour-la</b><div class="ag-free">Chargement...</div></div>' +
    '<div class="field"><label>Note pour Louis</label><textarea id="m-rnote" placeholder="Ce qu\'il faut savoir avant le RDV : ce qui l\'interesse, son activite, son humeur..."></textarea></div>',
    [{ label: 'Valider le rendez-vous', cls: 'gold', fn: function () { saveRdv(c); } }]);
  window._rdvType = 'phy';
  el('m-rdate').addEventListener('change', loadAgendaDay);
  loadAgendaDay();
};
// Montre les RDV deja poses ce jour-la (uniquement les vrais RDV a heure fixe,
// pas les taches sans horaire que Louis met aussi dans son agenda)
function loadAgendaDay() {
  var box = el('m-agenda'); if (!box) return;
  var dv = el('m-rdate').value; if (!dv) return;
  var from = new Date(dv + 'T00:00:00').toISOString();
  var to = new Date(dv + 'T23:59:59').toISOString();
  sb().from('web_evenements').select('titre,type,date_debut,lieu')
    .in('type', ['rdv_physique', 'rdv_visio'])
    .eq('statut', 'a_faire')
    .gte('date_debut', from).lte('date_debut', to)
    .order('date_debut')
    .then(function (r) {
      if (!el('m-agenda')) return;
      var evs = r.data || [];
      if (r.error) { el('m-agenda').innerHTML = '<b>Agenda de Louis ce jour-la</b><div class="ag-free">Agenda indisponible, verifie avec Louis de vive voix</div>'; return; }
      if (!evs.length) {
        el('m-agenda').innerHTML = '<b>Agenda de Louis ce jour-la</b><div class="ag-free">Journee libre, tu peux caler le creneau que tu veux</div>';
        return;
      }
      var html = evs.map(function (e) {
        var d = new Date(e.date_debut);
        var hh = String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
        return '<div class="ag-item"><span>' + hh + '</span>' + esc(e.titre) + (e.lieu ? ' (' + esc(e.lieu) + ')' : '') + '</div>';
      }).join('');
      el('m-agenda').innerHTML = '<b>Agenda de Louis ce jour-la : evite ces creneaux (compte 1h30 par RDV avec la route)</b>' + html;
    });
}
window.rdvType = function (t) {
  window._rdvType = t;
  el('m-rtype-phy').classList.toggle('on', t === 'phy');
  el('m-rtype-tel').classList.toggle('on', t === 'tel');
};
function saveRdv(c) {
  var dv = el('m-rdate').value, tv = el('m-rtime').value;
  if (!dv || !tv) { toast('Il faut la date et l\'heure', 'bad'); return; }
  var when = new Date(dv + 'T' + tv);
  var contact = el('m-rcontact').value.trim();
  var email = el('m-remail').value.trim();
  var lieu = el('m-rlieu').value.trim();
  var note = el('m-rnote').value.trim();
  var type = window._rdvType === 'tel' ? 'rdv_visio' : 'rdv_physique';

  // 1. Creer le client dans le pipeline Sites de Louis
  sb().from('web_clients').insert([{
    entreprise: c.entreprise,
    contact_nom: contact || c.contact_nom || null,
    email: email || c.email || null,
    telephone: c.telephone || null,
    ville: c.zone || null,
    source: 'Prospection — ' + (firstName() || DB.me.name),
    statut_pipeline: 'contacte',
    notes: 'RDV pris par la prospection le ' + new Date().toLocaleDateString('fr-FR') +
      (note ? '\n' + note : '') +
      (c.qualite_site ? '\nSite actuel : ' + (QUALITES[c.qualite_site] || c.qualite_site) : '') +
      (c.lien_maps ? '\nFiche Google : ' + c.lien_maps : '')
  }]).select().then(function (r) {
    if (r.error) throw r.error;
    var cl = r.data && r.data[0];
    // 2. Creer le RDV dans l'agenda de l'espace Sites
    var pEv = sb().from('web_evenements').insert([{
      client_id: cl ? cl.id : null,
      titre: 'RDV prospection — ' + c.entreprise,
      type: type,
      date_debut: when.toISOString(),
      lieu: lieu || null,
      notes: (contact ? 'Contact : ' + contact + '\n' : '') + (note || ''),
      statut: 'a_faire',
      auto: false
    }]);
    // 3. Mettre a jour la cible
    var pC = updCible(c.id, {
      statut: 'rdv_pris', rappel_le: null, client_id: cl ? cl.id : null,
      contact_nom: contact || c.contact_nom, email: email || c.email,
      tentatives: (c.tentatives || 0) + 1
    });
    return Promise.all([pEv, pC]);
  }).then(function () {
    if (SESSION) { SESSION.rdv++; SESSION.appels++; }
    logAction(c.id, 'rdv', null, fmtDate(when.toISOString()));
    logAction(c.id, 'appel', 'rdv');
    closeModal();
    confetti();
    var n = totalRdv();
    var goal = cfg().obj_rdv_mission || 20;
    if (n >= goal) milestone('MISSION ACCOMPLIE', goal + ' rendez-vous. Chapeau bas.');
    else if (n === 1) milestone('Premier rendez-vous !', 'Le premier est toujours le plus dur. C\'est parti.');
    else if (n === 5 || n === 10 || n === 15) milestone(n + ' rendez-vous !', 'Plus que ' + (goal - n) + ' pour boucler la mission.');
    else toast('RDV enregistre. Il est dans l\'agenda de Louis.', 'gold');
    advance();
  }).catch(function (e) {
    console.warn(e);
    toast('Enregistrement du RDV impossible, reessaie', 'bad');
  });
}

// ═══════════════════════════════════════════════════════════════════
// VUE : RAPPELS — tous les rappels programmes, groupes par echeance
// ═══════════════════════════════════════════════════════════════════
function lastRappelNote(c) {
  if (!c.notes) return '';
  var lines = c.notes.split('\n').filter(function (l) { return l.trim(); });
  return lines.length ? lines[lines.length - 1] : '';
}
VIEWS.rappels = function () {
  var withRap = DB.cibles.filter(function (c) {
    return c.rappel_le && ['rappeler', 'mail_envoye'].indexOf(c.statut) >= 0;
  }).sort(function (a, b) { return new Date(a.rappel_le) - new Date(b.rappel_le); });

  var now = new Date();
  var todayK = todayKey(now);
  var tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowK = todayKey(tomorrow);

  var groups = { retard: [], jour: [], demain: [], plus: [] };
  withRap.forEach(function (c) {
    var d = new Date(c.rappel_le), k = todayKey(d);
    if (d < now && k !== todayK) groups.retard.push(c);
    else if (k === todayK) (d <= now ? groups.retard : groups.jour).push(c);
    else if (k === tomorrowK) groups.demain.push(c);
    else groups.plus.push(c);
  });

  function rowsOf(list, showDate) {
    return list.map(function (c) {
      var d = new Date(c.rappel_le);
      var hh = String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
      var when = showDate ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hh : hh;
      var note = lastRappelNote(c);
      return '<div class="row">' +
        '<span class="chip" style="min-width:86px;justify-content:center;font-variant-numeric:tabular-nums;font-weight:800;color:var(--ink)">' + esc(when) + '</span>' +
        '<div class="r-main"><b>' + esc(c.entreprise) + '</b>' +
        '<span>' + esc(c.zone || '') + (note ? ' &middot; ' + esc(note) : '') + '</span></div>' +
        '<span class="pill p-' + esc(c.statut) + '">' + esc(STATUTS[c.statut]) + '</span>' +
        '<span class="r-tel">' + esc(fmtTel(c.telephone)) + '</span>' +
        '<button class="btn mini" onclick="decalRappel(\'' + c.id + '\')">D&eacute;caler</button>' +
        '<button class="btn mini gold" onclick="startSession(\'' + c.id + '\')">Appeler</button>' +
      '</div>';
    }).join('');
  }
  function section(title, list, color, showDate) {
    if (!list.length) return '';
    return '<div class="sec-t" style="color:' + color + '">' + title + ' (' + list.length + ')</div>' +
      '<div class="card">' + rowsOf(list, showDate) + '</div>';
  }

  el('view').innerHTML =
    '<div class="h1">Rappels<small>Chaque promesse de rappel est ici, a l\'heure pres. Un rappel fait a l\'heure dite, c\'est ce qui transforme un "rappelez-moi" en rendez-vous.</small></div>' +
    '<div style="margin-top:6px">' +
    (withRap.length ?
      section('En retard, a rattraper', groups.retard, 'var(--bad)', true) +
      section('Aujourd\'hui', groups.jour, 'var(--ink)', false) +
      section('Demain', groups.demain, 'var(--mut)', false) +
      section('Plus tard', groups.plus, 'var(--mut)', true)
      : '<div class="card empty" style="margin-top:16px"><b>Aucun rappel programme</b><span>Les rappels que tu programmes pendant les sessions d\'appels arriveront ici, ranges par echeance.</span></div>') +
    '</div>';
};
window.decalRappel = function (id) {
  var c = cible(id); if (!c) return;
  var chips = [
    { l: 'Dans 1 heure', h: 1 }, { l: 'Cet apres-midi (14h30)', at: 14.5 },
    { l: 'Demain matin (9h30)', d: 1, at: 9.5 }, { l: 'Demain apres-midi (14h30)', d: 1, at: 14.5 },
    { l: 'Lundi matin (9h30)', lundi: true }
  ];
  window._decChips = chips;
  var html = '<div class="datechips">' + chips.map(function (ch, i) {
    return '<button class="qchip" onclick="pickDecal(\'' + id + '\',' + i + ')">' + esc(ch.l) + '</button>';
  }).join('') + '</div>' +
  '<div class="frow" style="margin-top:6px"><div class="field"><label>Ou choisir</label><input type="datetime-local" id="dec-dt"></div></div>';
  openModal('Decaler le rappel — ' + esc(c.entreprise), html,
    [{ label: 'Decaler', cls: 'gold', fn: function () {
      var v = el('dec-dt').value;
      if (!v) { toast('Choisis un creneau ou une date', 'bad'); return; }
      doDecal(id, new Date(v));
    } }]);
};
window.pickDecal = function (id, i) {
  var ch = window._decChips[i], d = new Date();
  if (ch.h) d.setTime(d.getTime() + ch.h * 3600e3);
  if (ch.d) d.setDate(d.getDate() + ch.d);
  if (ch.lundi) { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 30, 0, 0); }
  if (ch.at) { d.setHours(Math.floor(ch.at), Math.round(ch.at % 1 * 60), 0, 0); }
  doDecal(id, d);
};
function doDecal(id, date) {
  updCible(id, { rappel_le: date.toISOString() });
  logAction(id, 'statut', 'rappel_decale', fmtDate(date.toISOString()));
  closeModal();
  toast('Rappel decale ' + fmtDate(date.toISOString()));
  refreshTop();
  if (VIEW === 'rappels') VIEWS.rappels(); else show(VIEW);
}

// ═══════════════════════════════════════════════════════════════════
// VUE : REPERAGE
// ═══════════════════════════════════════════════════════════════════
var REP = { zone: 'Jarry', qualite: 'aucun' };
VIEWS.reperage = function () {
  var zoneOpts = ZONES.map(function (z) {
    return '<option value="' + esc(z) + '"' + (REP.zone === z ? ' selected' : '') + '>' + esc(z) + '</option>';
  }).join('');
  var qChips = Object.keys(QUALITES).map(function (k) {
    return '<button class="qchip' + (REP.qualite === k ? ' on' : '') + '" onclick="repQual(\'' + k + '\')">' + esc(QUALITES[k]) + '</button>';
  }).join('');
  var today = todayKey();
  var adds = DB.cibles.filter(function (c) { return todayKey(new Date(c.created_at)) === today; });
  var addsHtml = adds.map(function (c) {
    return '<div class="row"><div class="r-main"><b>' + esc(c.entreprise) + '</b>' +
      '<span>' + esc(c.zone || '') + ' &middot; ' + esc(QUALITES[c.qualite_site] || '') + '</span></div>' +
      '<span class="r-tel">' + esc(fmtTel(c.telephone)) + '</span>' +
      '<button class="btn mini danger" onclick="delCible(\'' + c.id + '\')">Retirer</button></div>';
  }).join('');

  el('view').innerHTML =
    '<div class="h1">Rep&eacute;rage<small>Trouve les entreprises sur Google Maps, ajoute-les ici. Une bonne cible = une fiche Google active, mais pas de site (ou un mauvais).</small></div>' +

    '<div class="grid2" style="margin-top:20px;align-items:stretch">' +
      '<div class="card pad">' +
        '<div class="sec-t" style="margin-top:0">1. Ouvre la carte de la zone</div>' +
        '<div class="frow"><div class="field" style="flex:1"><label>Zone a prospecter</label><select id="rep-zone" onchange="repZone(this.value)">' + zoneOpts + '</select></div></div>' +
        '<div style="display:flex;gap:9px;margin-top:12px;flex-wrap:wrap">' +
          '<button class="btn" onclick="openMaps(\'entreprises\')">Toutes les entreprises</button>' +
          '<button class="btn" onclick="openMaps(\'restaurants\')">Restaurants</button>' +
          '<button class="btn" onclick="openMaps(\'garage automobile\')">Garages</button>' +
          '<button class="btn" onclick="openMaps(\'coiffeur institut\')">Coiffure / beaute</button>' +
          '<button class="btn" onclick="openMaps(\'artisan batiment\')">Artisans</button>' +
        '</div>' +
        '<div style="font-size:12.5px;color:var(--mut);margin-top:14px;line-height:1.55">' +
          'Sur chaque fiche, regarde la ligne <b>Site Web</b>. Absente ? C\'est une cible en or. ' +
          'Presente ? Clique : si le site est moche, lent ou date, c\'est une cible aussi. ' +
          'Note le nom, le numero, et colle le lien de la fiche.' +
        '</div>' +
      '</div>' +
      '<div class="card pad">' +
        '<div class="sec-t" style="margin-top:0">2. Ajoute la cible</div>' +
        '<div class="field"><label>Entreprise *</label><input id="rep-ent" placeholder="ex : Garage Antilles Auto" autocomplete="off"></div>' +
        '<div class="frow" style="margin-top:12px">' +
          '<div class="field"><label>Telephone *</label><input id="rep-tel" placeholder="0690 00 00 00" autocomplete="off"></div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px"><label>Etat de son site</label><div class="qchips" id="rep-quals">' + qChips + '</div></div>' +
        '<div class="frow" style="margin-top:12px">' +
          '<div class="field"><label>Lien fiche Google</label><input id="rep-maps" placeholder="Coller le lien (optionnel)"></div>' +
          '<div class="field"><label>Site actuel</label><input id="rep-site" placeholder="URL si site existant"></div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px"><label>Note</label><input id="rep-note" placeholder="ex : belle devanture, 45 avis Google..."></div>' +
        '<div style="margin-top:16px;display:flex;align-items:center;gap:12px">' +
          '<button class="btn gold" onclick="addCible()">Ajouter la cible</button>' +
          '<span style="font-size:12px;color:var(--mut2);font-weight:600">Entree = ajouter</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="sec-t">Ajouts du jour (' + adds.length + ')</div>' +
    '<div class="card">' + (addsHtml || '<div class="empty"><b>Rien pour l\'instant</b><span>Les cibles ajoutees aujourd\'hui apparaitront ici.</span></div>') + '</div>';

  var f = el('rep-ent');
  if (f) f.focus();
  ['rep-ent', 'rep-tel', 'rep-maps', 'rep-site', 'rep-note'].forEach(function (id) {
    var n = el(id);
    if (n) n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); window.addCible(); } });
  });
};
window.repZone = function (z) { REP.zone = z; };
window.repQual = function (k) {
  REP.qualite = k;
  var btns = el('rep-quals').querySelectorAll('.qchip');
  var keys = Object.keys(QUALITES);
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', keys[i] === k);
};
window.openMaps = function (what) {
  var q = encodeURIComponent(what + ' ' + REP.zone + ' Guadeloupe');
  window.open('https://www.google.com/maps/search/' + q, '_blank', 'noopener');
};
window.addCible = function () {
  var ent = el('rep-ent').value.trim();
  var tel = el('rep-tel').value.trim();
  if (!ent) { toast('Il faut le nom de l\'entreprise', 'bad'); el('rep-ent').focus(); return; }
  if (!tel) { toast('Il faut le numero de telephone', 'bad'); el('rep-tel').focus(); return; }
  var dg = digits(tel);
  var dup = DB.cibles.find(function (c) {
    return (dg && digits(c.telephone) === dg) || c.entreprise.toLowerCase() === ent.toLowerCase();
  });
  if (dup) { toast('Deja dans le fichier : ' + dup.entreprise + ' (' + STATUTS[dup.statut] + ')', 'bad'); return; }
  var row = {
    entreprise: ent, telephone: tel, zone: REP.zone, qualite_site: REP.qualite,
    lien_maps: el('rep-maps').value.trim() || null,
    site_actuel: el('rep-site').value.trim() || null,
    notes: el('rep-note').value.trim() || null,
    statut: 'a_appeler'
  };
  sb().from('web_prospection_cibles').insert([row]).select().then(function (r) {
    if (r.error) throw r.error;
    var c = r.data[0];
    DB.cibles.unshift(c);
    logAction(c.id, 'ajout', null, REP.zone);
    ['rep-ent', 'rep-tel', 'rep-maps', 'rep-site', 'rep-note'].forEach(function (id) { el(id).value = ''; });
    el('rep-ent').focus();
    toast('Cible ajoutee : ' + ent);
    VIEWS.reperage();
    refreshTop();
  }).catch(function (e) { console.warn(e); toast('Ajout impossible, verifie la connexion', 'bad'); });
};
window.delCible = function (id) {
  var c = cible(id); if (!c) return;
  if (!window.confirm('Retirer ' + c.entreprise + ' du fichier ?')) return;
  sb().from('web_prospection_cibles').delete().eq('id', id).then(function (r) {
    if (r.error) { toast('Suppression impossible', 'bad'); return; }
    DB.cibles = DB.cibles.filter(function (x) { return x.id !== id; });
    toast('Cible retiree');
    show(VIEW);
  });
};

// ═══════════════════════════════════════════════════════════════════
// VUE : MAILS
// ═══════════════════════════════════════════════════════════════════
function mailFor(c) {
  // Version personnalisee pour CE prospect (modifiee par Leyla avant envoi) ?
  try {
    var ov = localStorage.getItem('nov_prosp_mail_' + c.id);
    if (ov) { ov = JSON.parse(ov); if (ov && ov.corps) return { objet: ov.objet, corps: ov.corps, custom: true }; }
  } catch (e) {}
  var s = cfg();
  var contact = c.contact_nom ? ' ' + c.contact_nom : '';
  var body = (s.email_modele || '')
    .replace(/\{contact\}/g, contact)
    .replace(/\{entreprise\}/g, c.entreprise || '')
    .replace(/\{signature\}/g, firstName() || DB.me.name);
  return { objet: s.email_objet || 'Novalem — votre site internet', corps: body };
}
function clearMailCustom(id) { try { localStorage.removeItem('nov_prosp_mail_' + id); } catch (e) {} }
window.mailModif = function (id) {
  var c = cible(id); if (!c) return;
  var m = mailFor(c);
  openModal('Modifier ce mail — ' + esc(c.entreprise),
    '<div class="field"><label>Objet</label><input id="mm-objet" value="' + esc(m.objet) + '"></div>' +
    '<div class="field"><label>Corps du mail</label><textarea id="mm-corps" style="min-height:260px;font-size:13px;line-height:1.55">' + esc(m.corps) + '</textarea></div>' +
    '<div style="font-size:11.5px;color:var(--mut2);font-weight:600">Ne concerne que ce prospect. Le modele de base reste inchange' + (isSup() ? ' (il se modifie dans Methode, tout en bas)' : '') + '.</div>',
    [{ label: 'Revenir au modele', cls: '', fn: function () {
        clearMailCustom(id); closeModal(); toast('Mail remis au modele de base'); show('mails');
      } },
     { label: 'Enregistrer', cls: 'gold', fn: function () {
        var ob = el('mm-objet').value.trim(), co = el('mm-corps').value;
        if (!co.trim()) { toast('Le corps du mail est vide', 'bad'); return; }
        try { localStorage.setItem('nov_prosp_mail_' + id, JSON.stringify({ objet: ob || 'Novalem — votre site internet', corps: co })); } catch (e) {}
        closeModal(); toast('Mail personnalise pour ' + c.entreprise); show('mails');
      } }]);
};
VIEWS.mails = function () {
  var list = mailsAEnvoyer();
  var html = list.map(function (c) {
    var m = mailFor(c);
    return '<div class="card pad" style="margin-bottom:14px">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<b style="font-size:16px;font-weight:800">' + esc(c.entreprise) + '</b>' +
        '<span class="chip">' + esc(c.email || 'e-mail manquant') + '</span>' +
        (c.contact_nom ? '<span class="chip">' + esc(c.contact_nom) + '</span>' : '') +
        '<span style="margin-left:auto;font-size:11.5px;color:var(--mut2);font-weight:600">Promis le ' + esc(fmtDate(c.updated_at)) + '</span>' +
      '</div>' +
      '<div class="mailprev" style="margin-top:12px">' + esc(m.corps) + '</div>' +
      '<div style="display:flex;gap:9px;margin-top:13px;flex-wrap:wrap">' +
        '<button class="btn mini' + (m.custom ? ' gold' : '') + '" onclick="mailModif(\'' + c.id + '\')">' + (m.custom ? 'Modifier (personnalise)' : 'Modifier ce mail') + '</button>' +
        '<button class="btn mini" onclick="mailCopie(\'' + c.id + '\')">Copier le mail</button>' +
        '<button class="btn mini" onclick="mailObjet(\'' + c.id + '\')">Copier l\'objet</button>' +
        '<a class="btn mini" href="' + esc('mailto:' + (c.email || '') + '?subject=' + encodeURIComponent(m.objet) + '&body=' + encodeURIComponent(m.corps)) + '">Ouvrir dans la messagerie</a>' +
        '<button class="btn mini gold" style="margin-left:auto" id="send-' + c.id + '" onclick="mailEnvoiDirect(\'' + c.id + '\')">Envoyer maintenant</button>' +
        '<button class="btn mini ghost" onclick="mailEnvoye(\'' + c.id + '\')" title="Si tu l\'as envoye depuis ta messagerie">Deja envoye ailleurs</button>' +
      '</div>' +
    '</div>';
  }).join('');

  el('view').innerHTML =
    '<div class="h1">Mails a envoyer<small>Le mail promis au telephone part le jour meme : c\'est ce qui fait serieux. Le bouton Envoyer joint automatiquement la presentation PDF (formules, options, abonnements), et une relance se programme toute seule 3 jours apres.</small></div>' +
    '<div style="margin-top:20px">' +
    (html || '<div class="card empty"><b>File vide</b><span>Aucun mail en attente. Tout est parti, propre.</span></div>') +
    '</div>';
};
var _fichePdf = null; // base64 de la fiche de presentation, chargee une fois
function loadFiche() {
  if (_fichePdf) return Promise.resolve(_fichePdf);
  return fetch('/docs/novalem-presentation.pdf')
    .then(function (r) { if (!r.ok) throw new Error('fiche introuvable'); return r.blob(); })
    .then(function (b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { _fichePdf = String(fr.result).split(',')[1]; res(_fichePdf); };
        fr.onerror = rej;
        fr.readAsDataURL(b);
      });
    });
}
window.mailEnvoiDirect = function (id) {
  var c = cible(id); if (!c) return;
  if (!c.email || c.email.indexOf('@') < 1) { toast('E-mail manquant : modifie la fiche d\'abord', 'bad'); return; }
  var m = mailFor(c);
  var btn = el('send-' + id);
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }
  loadFiche().catch(function () { return null; }).then(function (pdf) {
  return fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: c.email, subject: m.objet, body: m.corps,
      from_name: (firstName() || DB.me.name) + ' — Novalem',
      format: 'simple',
      attachments: pdf ? [{ filename: 'NOVALEM-presentation.pdf', content: pdf, type: 'application/pdf' }] : [] })
  }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (x) {
      if (!x.ok) throw new Error(x.j && x.j.error || 'Envoi refuse');
      toast('Mail envoye a ' + c.email, 'gold');
      window.mailEnvoye(id);
    })
    .catch(function (e) {
      console.warn(e);
      if (btn) { btn.disabled = false; btn.textContent = 'Envoyer maintenant'; }
      toast('Envoi impossible (' + (e.message || 'erreur') + '). Utilise Copier + ta messagerie.', 'bad');
    });
  });
};
window.mailCopie = function (id) { var c = cible(id); if (c) copyText(mailFor(c).corps, 'Mail copie'); };
window.mailObjet = function (id) { var c = cible(id); if (c) copyText(mailFor(c).objet, 'Objet copie'); };
window.mailEnvoye = function (id) {
  var c = cible(id); if (!c) return;
  clearMailCustom(id);
  var d = new Date(); d.setDate(d.getDate() + 3); d.setHours(9, 30, 0, 0);
  updCible(id, { statut: 'mail_envoye', rappel_le: d.toISOString() });
  logAction(id, 'mail', 'envoye');
  toast('Mail marque envoye. Relance programmee ' + fmtDate(d.toISOString()));
  show('mails');
};

// ═══════════════════════════════════════════════════════════════════
// VUE : FICHIER
// ═══════════════════════════════════════════════════════════════════
var FIL = { q: '', statut: '', zone: '' };
VIEWS.fichier = function () {
  var zones = {};
  DB.cibles.forEach(function (c) { if (c.zone) zones[c.zone] = 1; });
  var list = DB.cibles.filter(function (c) {
    if (FIL.statut && c.statut !== FIL.statut) return false;
    if (FIL.zone && c.zone !== FIL.zone) return false;
    if (FIL.q) {
      var q = FIL.q.toLowerCase();
      if ((c.entreprise || '').toLowerCase().indexOf(q) < 0 &&
          digits(c.telephone).indexOf(digits(q)) < 0 &&
          (c.notes || '').toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });
  var rows = list.slice(0, 200).map(function (c) {
    return '<div class="row">' +
      '<div class="r-main"><b>' + esc(c.entreprise) + '</b>' +
      '<span>' + esc(c.zone || '') + (c.contact_nom ? ' &middot; ' + esc(c.contact_nom) : '') +
      (c.rappel_le ? ' &middot; rappel ' + esc(fmtDate(c.rappel_le)) : '') + '</span></div>' +
      '<span class="pill p-' + esc(c.statut) + '">' + esc(STATUTS[c.statut]) + '</span>' +
      '<span class="r-tel">' + esc(fmtTel(c.telephone)) + '</span>' +
      '<button class="btn mini" onclick="editCible(\'' + c.id + '\')">Modifier</button>' +
      '<button class="btn mini gold" onclick="startSession(\'' + c.id + '\')">Appeler</button>' +
    '</div>';
  }).join('');
  var stOpts = '<option value="">Tous les statuts</option>' + Object.keys(STATUTS).map(function (k) {
    return '<option value="' + k + '"' + (FIL.statut === k ? ' selected' : '') + '>' + esc(STATUTS[k]) + '</option>';
  }).join('');
  var znOpts = '<option value="">Toutes les zones</option>' + Object.keys(zones).sort().map(function (z) {
    return '<option value="' + esc(z) + '"' + (FIL.zone === z ? ' selected' : '') + '>' + esc(z) + '</option>';
  }).join('');

  el('view').innerHTML =
    '<div class="h1">Le fichier<small>' + DB.cibles.length + ' cibles au total &middot; ' + list.length + ' affichees</small></div>' +
    '<div class="filters" style="margin-top:18px">' +
      '<input type="search" id="fil-q" placeholder="Chercher un nom, un numero..." value="' + esc(FIL.q) + '">' +
      '<select onchange="filSet(\'statut\',this.value)">' + stOpts + '</select>' +
      '<select onchange="filSet(\'zone\',this.value)">' + znOpts + '</select>' +
      (isSup() ? '<button class="btn mini ghost" style="margin-left:auto" onclick="exportCSV()">Exporter en CSV</button>' : '') +
    '</div>' +
    '<div class="card">' + (rows || '<div class="empty"><b>Aucune cible</b><span>Modifie les filtres ou ajoute des cibles en Reperage.</span></div>') + '</div>';

  var q = el('fil-q');
  q.addEventListener('input', function () { FIL.q = q.value; VIEWS.fichier(); var n = el('fil-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
};
window.filSet = function (k, v) { FIL[k] = v; VIEWS.fichier(); };
window.editCible = function (id) {
  var c = cible(id); if (!c) return;
  var stOpts = Object.keys(STATUTS).map(function (k) {
    return '<option value="' + k + '"' + (c.statut === k ? ' selected' : '') + '>' + esc(STATUTS[k]) + '</option>';
  }).join('');
  var qOpts = Object.keys(QUALITES).map(function (k) {
    return '<option value="' + k + '"' + (c.qualite_site === k ? ' selected' : '') + '>' + esc(QUALITES[k]) + '</option>';
  }).join('');
  var znOpts = ZONES.map(function (z) {
    return '<option value="' + esc(z) + '"' + (c.zone === z ? ' selected' : '') + '>' + esc(z) + '</option>';
  }).join('');
  openModal('Modifier — ' + esc(c.entreprise),
    '<div class="field"><label>Entreprise</label><input id="e-ent" value="' + esc(c.entreprise) + '"></div>' +
    '<div class="frow"><div class="field"><label>Telephone</label><input id="e-tel" value="' + esc(c.telephone || '') + '"></div>' +
    '<div class="field"><label>E-mail</label><input id="e-email" value="' + esc(c.email || '') + '"></div></div>' +
    '<div class="frow"><div class="field"><label>Contact</label><input id="e-contact" value="' + esc(c.contact_nom || '') + '"></div>' +
    '<div class="field"><label>Zone</label><select id="e-zone">' + znOpts + '</select></div></div>' +
    '<div class="frow"><div class="field"><label>Statut</label><select id="e-statut">' + stOpts + '</select></div>' +
    '<div class="field"><label>Etat du site</label><select id="e-qual">' + qOpts + '</select></div></div>' +
    '<div class="field"><label>Notes</label><textarea id="e-notes">' + esc(c.notes || '') + '</textarea></div>',
    [{ label: 'Supprimer', cls: 'danger', fn: function () { closeModal(); window.delCible(id); } },
     { label: 'Enregistrer', cls: 'gold', fn: function () {
      updCible(id, {
        entreprise: el('e-ent').value.trim() || c.entreprise,
        telephone: el('e-tel').value.trim() || null,
        email: el('e-email').value.trim() || null,
        contact_nom: el('e-contact').value.trim() || null,
        zone: el('e-zone').value, statut: el('e-statut').value,
        qualite_site: el('e-qual').value,
        notes: el('e-notes').value.trim() || null
      });
      closeModal(); show(VIEW);
    } }]);
};
window.exportCSV = function () {
  var head = ['entreprise', 'zone', 'telephone', 'email', 'contact', 'statut', 'etat_site', 'tentatives', 'rappel', 'notes', 'ajoutee_le'];
  var lines = [head.join(';')].concat(DB.cibles.map(function (c) {
    return [c.entreprise, c.zone, c.telephone, c.email, c.contact_nom, STATUTS[c.statut], QUALITES[c.qualite_site],
      c.tentatives, c.rappel_le || '', (c.notes || '').replace(/[\n;]/g, ' '), c.created_at.slice(0, 10)]
      .map(function (v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
  }));
  var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'prospection-novalem-' + todayKey() + '.csv';
  a.click();
};

// ═══════════════════════════════════════════════════════════════════
// VUE : LA METHODE
// ═══════════════════════════════════════════════════════════════════
VIEWS.coaching = function () {
  var s = cfg();
  var reglesHtml = (s.regles || []).map(function (r, i) {
    return '<div class="rule"><i>' + (i + 1) + '</i><div><b>' + esc(r.t) + '</b><span>' + esc(r.d) + '</span></div></div>';
  }).join('');
  var objHtml = (s.objections || []).map(function (o) {
    return '<details class="obj"><summary>' + esc(o.q) + '</summary><div class="ob">' + esc(o.r) + '</div></details>';
  }).join('');

  el('view').innerHTML =
    '<div class="h1">La methode<small>Comment on bosse chez Novalem : le parcours, le script, les reponses aux objections. Relis-la avant tes premieres sessions, apres ca viendra tout seul.</small></div>' +

    '<div class="sec-t">Le parcours d\'un prospect</div>' +
    '<div class="card pad"><div class="proc">' +
      '<div class="pstep"><i>1</i><b>Reperage</b><span>Trouve sur Google Maps, ajoute au fichier</span></div>' +
      '<div class="pstep"><i>2</i><b>Appel</b><span>Objectif unique : le rendez-vous</span></div>' +
      '<div class="pstep"><i>3</i><b>Mail</b><span>Si demande, envoye le jour meme</span></div>' +
      '<div class="pstep"><i>4</i><b>RDV</b><span>Louis se deplace et presente</span></div>' +
      '<div class="pstep"><i>5</i><b>Signature</b><span>Le client paie, ta commission tombe</span></div>' +
    '</div></div>' +

    '<div class="sec-t">Le script, etape par etape</div>' +
    '<div class="card pad">' +
      '<div class="sc-step"><div class="st"><i>1</i>Accroche (les 10 premieres secondes)</div><p>' + esc(s.script_accroche) + '</p></div>' +
      '<div class="sc-step"><div class="st"><i>2</i>Decouverte (le faire parler)</div><p>' + esc(s.script_decouverte) + '</p></div>' +
      '<div class="sc-step" style="margin-bottom:0"><div class="st"><i>3</i>Le rendez-vous (la seule chose qui compte)</div><p>' + esc(s.script_proposition) + '</p></div>' +
    '</div>' +

    '<div class="sec-t">Reponses aux objections</div>' +
    '<div>' + objHtml + '</div>' +

    '<div class="sec-t">Les 10 regles d\'or</div>' +
    '<div class="card pad">' + reglesHtml + '</div>' +

    (isSup() ?
      '<div class="sec-t">Reglages (visibles par toi seul, Louis) : mets tout ca a ta sauce</div>' +
      '<div class="card pad">' +
        '<div class="frow">' +
          '<div class="field"><label>Objectif d\'appels par jour</label><input type="number" id="cf-appels" value="' + (s.obj_appels_jour || 30) + '" min="1"></div>' +
          '<div class="field"><label>Objectif RDV de la mission</label><input type="number" id="cf-rdv" value="' + (s.obj_rdv_mission || 20) + '" min="1"></div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px"><label>Script — accroche</label><textarea id="cf-s1" style="min-height:100px">' + esc(s.script_accroche) + '</textarea></div>' +
        '<div class="field" style="margin-top:12px"><label>Script — decouverte</label><textarea id="cf-s2" style="min-height:100px">' + esc(s.script_decouverte) + '</textarea></div>' +
        '<div class="field" style="margin-top:12px"><label>Script — proposition de RDV</label><textarea id="cf-s3" style="min-height:100px">' + esc(s.script_proposition) + '</textarea></div>' +
        '<div class="field" style="margin-top:12px"><label>Objet du mail</label><input id="cf-obj" value="' + esc(s.email_objet) + '"></div>' +
        '<div class="field" style="margin-top:12px"><label>Modele de mail ({contact}, {entreprise}, {signature} sont remplaces)</label><textarea id="cf-mail" style="min-height:170px">' + esc(s.email_modele) + '</textarea></div>' +
        '<div style="margin-top:14px"><button class="btn gold" onclick="saveCoaching()">Enregistrer les reglages</button></div>' +
      '</div>' : '');
};
window.saveCoaching = function () {
  saveCfg({
    obj_appels_jour: parseInt(el('cf-appels').value, 10) || 30,
    obj_rdv_mission: parseInt(el('cf-rdv').value, 10) || 20,
    script_accroche: el('cf-s1').value,
    script_decouverte: el('cf-s2').value,
    script_proposition: el('cf-s3').value,
    email_objet: el('cf-obj').value,
    email_modele: el('cf-mail').value
  }).then(function () { refreshTop(); });
};

// ═══════════════════════════════════════════════════════════════════
// VUE : PILOTAGE (superviseur)
// ═══════════════════════════════════════════════════════════════════
VIEWS.pilotage = function () {
  if (!isSup()) { show('jour'); return; }
  var total = DB.cibles.length;
  var appelees = DB.cibles.filter(function (c) { return (c.tentatives || 0) > 0; }).length;
  var mails = DB.cibles.filter(function (c) { return ['mail_a_envoyer', 'mail_envoye'].indexOf(c.statut) >= 0; }).length;
  var rdv = totalRdv();
  var pctOf = function (n, d) { return d ? Math.round(n / d * 100) : 0; };

  // Barres : appels par jour sur 14 jours (toute l'equipe)
  var days = [], byDay = {};
  for (var i = 13; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
    var k = todayKey(d);
    days.push({ k: k, l: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' }) });
    byDay[k] = 0;
  }
  DB.actions.forEach(function (a) {
    if (a.type !== 'appel') return;
    var k = todayKey(new Date(a.created_at));
    if (k in byDay) byDay[k]++;
  });
  var max = 1;
  days.forEach(function (d) { if (byDay[d.k] > max) max = byDay[d.k]; });
  var barsHtml = days.map(function (d) {
    var v = byDay[d.k];
    return '<div class="bar"><b>' + (v || '') + '</b><i style="height:' + Math.round(v / max * 100) + '%"></i><span>' + d.l + '</span></div>';
  }).join('');

  // Stats par personne
  var per = {};
  DB.actions.forEach(function (a) {
    if (!a.user_id) return;
    if (!per[a.user_id]) per[a.user_id] = { appels: 0, rdv: 0, mails: 0 };
    if (a.type === 'appel') per[a.user_id].appels++;
    if (a.type === 'rdv') per[a.user_id].rdv++;
    if (a.type === 'mail' && a.resultat === 'envoye') per[a.user_id].mails++;
  });
  var perHtml = Object.keys(per).map(function (uid) {
    var p = per[uid];
    return '<tr><td style="font-weight:700">' + esc(DB.users[uid] || 'Utilisateur') + '</td>' +
      '<td>' + p.appels + '</td><td>' + p.mails + '</td><td>' + p.rdv + '</td>' +
      '<td>' + (p.appels ? pctOf(p.rdv, p.appels) + ' %' : '-') + '</td></tr>';
  }).join('');

  el('view').innerHTML =
    '<div class="h1">Pilotage<small>Vue d\'ensemble de la prospection sur les 30 derniers jours.</small></div>' +

    '<div class="grid3" style="margin-top:20px">' +
      '<div class="card stat"><b>' + rdv + '</b><span>RDV pris</span><span class="sub">' + pctOf(rdv, appelees) + ' % des cibles appelees</span></div>' +
      '<div class="card stat"><b>' + appelees + '</b><span>Cibles appelees</span><span class="sub">sur ' + total + ' au fichier</span></div>' +
      '<div class="card stat"><b>' + DB.signes + '</b><span>Clients signes</span><span class="sub">issus de la prospection</span></div>' +
    '</div>' +

    '<div class="sec-t">Entonnoir</div>' +
    '<div class="card pad"><div class="funnel">' +
      '<div class="fstep"><span class="fl">Au fichier</span><div class="fb"><i style="width:100%"></i><b>' + total + '</b></div><span class="fp">100 %</span></div>' +
      '<div class="fstep"><span class="fl">Appelees</span><div class="fb"><i style="width:' + pctOf(appelees, total) + '%"></i><b>' + appelees + '</b></div><span class="fp">' + pctOf(appelees, total) + ' %</span></div>' +
      '<div class="fstep"><span class="fl">Mail envoye</span><div class="fb"><i style="width:' + pctOf(mails, total) + '%"></i><b>' + mails + '</b></div><span class="fp">' + pctOf(mails, total) + ' %</span></div>' +
      '<div class="fstep"><span class="fl">RDV pris</span><div class="fb"><i style="width:' + pctOf(rdv, total) + '%"></i><b>' + rdv + '</b></div><span class="fp">' + pctOf(rdv, total) + ' %</span></div>' +
      '<div class="fstep"><span class="fl">Signes</span><div class="fb"><i style="width:' + pctOf(DB.signes, total) + '%"></i><b>' + DB.signes + '</b></div><span class="fp">' + pctOf(DB.signes, total) + ' %</span></div>' +
    '</div></div>' +

    '<div class="sec-t">Appels par jour (14 jours, toute l\'equipe)</div>' +
    '<div class="card pad"><div class="bars">' + barsHtml + '</div></div>' +

    '<div class="sec-t">Par personne (30 jours)</div>' +
    '<div class="card"><table class="ptable">' +
      '<tr><th>Personne</th><th>Appels</th><th>Mails</th><th>RDV</th><th>Taux RDV</th></tr>' +
      (perHtml || '<tr><td colspan="5" style="color:var(--mut)">Pas encore d\'activite</td></tr>') +
    '</table></div>';
};

// ═══════════════════════════════════════════════════════════════════
// MODALES + CLAVIER + DEMARRAGE
// ═══════════════════════════════════════════════════════════════════
function openModal(title, body, actions) {
  var btns = (actions || []).map(function (a, i) {
    return '<button class="btn ' + (a.cls || '') + '" data-mi="' + i + '">' + a.label + '</button>';
  }).join('');
  el('modal-root').innerHTML =
    '<div class="ovl" id="ovl"><div class="modal">' +
      '<div class="modal-h"><b>' + title + '</b><button class="x" onclick="closeModal()">&times;</button></div>' +
      '<div class="modal-b">' + body + '<div class="modal-f">' + btns + '</div></div>' +
    '</div></div>';
  window._modalActs = actions || [];
  el('ovl').addEventListener('click', function (e) { if (e.target.id === 'ovl') closeModal(); });
  var bs = el('modal-root').querySelectorAll('[data-mi]');
  for (var i = 0; i < bs.length; i++) {
    bs[i].addEventListener('click', function (e) {
      var a = window._modalActs[parseInt(e.currentTarget.getAttribute('data-mi'), 10)];
      if (a && a.fn) a.fn();
    });
  }
  var f = el('modal-root').querySelector('input,textarea,select');
  if (f) f.focus();
}
window.closeModal = function () { el('modal-root').innerHTML = ''; };
window.openModal = openModal;

document.addEventListener('keydown', function (e) {
  if (el('modal-root').innerHTML) { if (e.key === 'Escape') closeModal(); return; }
  var tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (VIEW !== 'session' || !sessCurrent()) return;
  var map = { '1': window.ocRdv, '2': window.ocRappeler, '3': window.ocMail, '4': window.ocNrp, '5': window.ocNon, '6': window.ocHorsCible, '7': window.ocAutre };
  if (map[e.key]) { e.preventDefault(); map[e.key](); }
  if (e.key === 'c' || e.key === 'C') {
    var c = sessCurrent();
    if (c && c.telephone) copyText(fmtTel(c.telephone), 'Numero copie');
  }
});

// Rafraichir les donnees quand on revient sur l'onglet du navigateur
document.addEventListener('visibilitychange', function () {
  if (!document.hidden && DB.me) {
    load().then(function () { refreshTop(); if (VIEW !== 'session') show(VIEW); });
  }
});

// ── DEMARRAGE ──────────────────────────────────────────────────────
el('view').innerHTML = '<div class="empty" style="padding-top:80px"><b>Chargement du cockpit...</b><span>Connexion a la base Novalem</span></div>';
load().then(function () {
  refreshTop();
  show('jour');
}).catch(function (e) {
  console.warn(e);
  el('view').innerHTML =
    '<div class="card empty" style="margin-top:40px"><b>Impossible de charger les donnees</b>' +
    '<span>Verifie ta connexion internet. Si le probleme persiste, le module SQL (supabase/prospection-schema.sql) n\'a peut-etre pas encore ete installe : previens Louis.</span>' +
    '<div style="margin-top:16px"><button class="btn gold" onclick="window.location.reload()">Reessayer</button></div></div>';
});

})();
