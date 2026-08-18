/* ═══════════════════════════════════════════════════════════════
   NOVALEM APP — js/assistant-prospect.js
   Assistant prospect intelligent (bouton "Assistant IA" sur une cible).
   - lit la presence en ligne du prospect (via api/assistant-prospect)
   - ressort une fiche enrichie ou CHAQUE champ porte une preuve
     (sur / a valider) : on ne devine jamais, tu valides le reste d'un clic
   - genere un cold mail personnalise, pret a copier-coller dans ta boite
   Autonome : sa propre connexion Supabase, sa propre modale, ses helpers.
   Expose window.AssistantIA.open(cibleId).
═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var SB_URL = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';
var FICHE_URL = '/docs/novalem-presentation.pdf';

var _sb = null;
function sb() { if (!_sb) _sb = window.supabase.createClient(SB_URL, SB_ANON); return _sb; }
function el(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m, warn) {
  var t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = m;
  el('toaster').appendChild(t);
  setTimeout(function () { t.remove(); }, 3400);
}
function modal(titre, html) { el('mo-t').textContent = titre; el('mo-b').innerHTML = html; el('mo').classList.add('on'); }
function body(html) { el('mo-b').innerHTML = html; }
function fermer() { el('mo').classList.remove('on'); }

function copier(txt, btn) {
  function ok() { if (!btn) return; var o = btn.textContent; btn.textContent = 'Copie !'; setTimeout(function () { btn.textContent = o; }, 1400); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok).catch(ok);
  else { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); ok(); }
}

var CIBLE = null;   // ligne web_prospection_cibles
var SOC = null;     // ligne web_societe (pour la signature)
var RES = null;     // dernier resultat de l'IA

function badge(preuve) {
  if (preuve === 'fort') return '<span class="chip gold" style="margin-left:6px">sur</span>';
  if (preuve === 'faible') return '<span class="chip gray" style="margin-left:6px">a valider</span>';
  return '';
}
function val(champ) { return (champ && champ.valeur != null) ? String(champ.valeur) : ''; }
function pr(champ) { return (champ && champ.preuve) ? champ.preuve : 'absent'; }

// mappe la qualite renvoyee par l'IA vers les valeurs du select CRM
function mapQualite(q) {
  q = (q || '').toLowerCase();
  if (q === 'bon' || q === 'correct') return 'correct';
  if (q === 'mauvais' || q === 'vieux' || q === 'ancien') return 'mauvais';
  if (q === 'facebook') return 'facebook';
  if (q === 'aucun') return 'aucun';
  return '';
}

async function open(cibleId) {
  var c = await sb().from('web_prospection_cibles').select('*').eq('id', cibleId).single();
  if (c.error || !c.data) { toast('Cible introuvable', true); return; }
  CIBLE = c.data;
  RES = null;
  try { var s = await sb().from('web_societe').select('*').limit(1); SOC = (s.data && s.data[0]) || null; } catch (e) { SOC = null; }

  modal('Assistant IA — ' + (CIBLE.entreprise || ''),
    '<div class="hint" style="margin-top:0">L\'IA lit sa presence en ligne, en sort une fiche (chaque info est marquee <b>sur</b> ou <b>a valider</b>, jamais inventee) et te prepare un mail personnalise.</div>' +
    '<label class="lbl">Site ou page a analyser</label>' +
    '<input type="text" id="ia-url" value="' + esc(CIBLE.site_actuel || '') + '" placeholder="https://son-site.fr  (ou sa page Facebook/Insta)">' +
    '<div style="font-size:11.5px;color:var(--mut2);margin-top:5px">Laisse vide s\'il n\'a aucun site : l\'IA le prendra en compte et restera honnete.</div>' +
    '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button class="btn gold" id="ia-go" onclick="AssistantIA._analyser()">Analyser avec l\'IA</button>' +
    '<button class="btn ghost" onclick="AssistantIA._close()">Fermer</button></div>' +
    '<div id="ia-res" style="margin-top:16px"></div>');
}

async function analyser() {
  var url = (el('ia-url').value || '').trim();
  var b = el('ia-go');
  if (b) { b.disabled = true; b.textContent = 'Analyse en cours...'; }
  el('ia-res').innerHTML = '<div class="hint" style="border-color:var(--gold-line);background:var(--gold-soft)">L\'IA lit la page et redige... quelques secondes.</div>';

  var exp = { nom: 'Studio Novalem', email: 'contact@studionovalem.fr', tel: '+590 691 25 34 49' };
  if (SOC) {
    if (SOC.raison_sociale || SOC.nom) exp.nom = SOC.raison_sociale || SOC.nom;
    if (SOC.email) exp.email = SOC.email;
    if (SOC.telephone || SOC.tel) exp.tel = SOC.telephone || SOC.tel;
  }

  try {
    var r = await fetch('/api/assistant-prospect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'analyser', site_url: url, cible: CIBLE, expediteur: exp }),
    });
    var data = await r.json();
    if (!r.ok) throw new Error(data.error || ('Erreur ' + r.status));
    RES = data;
    if (b) { b.disabled = false; b.textContent = 'Relancer l\'analyse'; }
    rendreResultat();
  } catch (e) {
    if (b) { b.disabled = false; b.textContent = 'Analyser avec l\'IA'; }
    el('ia-res').innerHTML = '<div class="hint" style="border-color:var(--red);background:var(--red-soft)">Echec : ' + esc(e.message) +
      '<br><span style="font-size:11.5px">Verifie que ANTHROPIC_API_KEY est bien dans les variables Vercel du projet.</span></div>';
  }
}

function rendreResultat() {
  var f = RES.fiche || {};
  var src = RES.source || {};
  var mail = RES.mail || {};

  // --- bandeau source + opportunite ---
  var srcTxt = src.ok ? ('Site analyse : ' + esc(src.url)) : ('Pas de site lu' + (src.note ? ' (' + esc(src.note) + ')' : ''));
  var html =
    '<div style="font-size:12px;color:var(--mut2);margin-bottom:8px">' + srcTxt + '</div>' +
    (RES.resume_court ? '<div class="card" style="padding:12px 14px;border-color:var(--gold-line);background:var(--gold-soft);margin-bottom:14px"><b>Opportunite :</b> ' + esc(RES.resume_court) + '</div>' : '');

  // --- fiche enrichie : champs a enregistrer ---
  function ligne(k, libelle, champ, valAff) {
    var preuve = pr(champ), v = valAff != null ? valAff : val(champ);
    if (!v && preuve === 'absent') return '';
    var check = preuve === 'fort' ? 'checked' : '';
    return '<label style="display:flex;align-items:center;gap:9px;padding:7px 2px;border-bottom:1px solid var(--line);font-size:13.5px;cursor:pointer">' +
      '<input type="checkbox" data-k="' + k + '" ' + check + ' style="width:auto">' +
      '<span style="flex:1"><span style="color:var(--mut)">' + libelle + ' :</span> <b>' + esc(v || '(vide)') + '</b>' + badge(preuve) + '</span></label>';
  }

  var quali = mapQualite(val(f.qualite_site));
  var champsHtml =
    ligne('secteur', 'Secteur', f.secteur) +
    ligne('email', 'Email trouve', f.email_visible) +
    ligne('telephone', 'Telephone trouve', f.telephone_visible) +
    (quali ? ligne('qualite_site', 'Qualite du site', f.qualite_site, quali) : '') +
    (src.ok && src.url ? '<label style="display:flex;align-items:center;gap:9px;padding:7px 2px;border-bottom:1px solid var(--line);font-size:13.5px;cursor:pointer"><input type="checkbox" data-k="site_actuel" ' + (CIBLE.site_actuel ? '' : 'checked') + ' style="width:auto"><span style="flex:1"><span style="color:var(--mut)">Site :</span> <b>' + esc(src.url) + '</b></span></label>' : '');

  html += '<div class="card" style="margin-bottom:14px"><h2 style="margin-bottom:4px">Fiche du prospect</h2>' +
    '<div style="font-size:12px;color:var(--mut);margin-bottom:8px">Coche ce que tu veux ecrire sur la fiche. Les infos <b>sur</b> sont pre-cochees, les <b>a valider</b> sont a toi de confirmer.</div>' +
    (champsHtml || '<div class="empty" style="padding:8px">Rien de solide a enregistrer (site non lu ou vide).</div>') +
    // infos annexes affichees mais non enregistrees en colonne (rangees dans l'analyse complete)
    (val(f.description) ? '<div style="font-size:12.5px;color:var(--mut);margin-top:10px">Description : ' + esc(val(f.description)) + '</div>' : '') +
    ((val(f.instagram) || val(f.facebook)) ? '<div style="font-size:12.5px;color:var(--mut);margin-top:4px">Reseaux : ' + esc([val(f.instagram), val(f.facebook)].filter(Boolean).join(' | ')) + '</div>' : '') +
    ((val(f.couleur_principale) || val(f.couleur_secondaire)) ? '<div style="font-size:12.5px;color:var(--mut);margin-top:4px">Couleurs de marque : ' + esc([val(f.couleur_principale), val(f.couleur_secondaire)].filter(Boolean).join(' , ')) + ' (utiles pour amorcer sa charte)</div>' : '') +
    '<div style="margin-top:12px"><button class="btn gold" onclick="AssistantIA._save()">Enregistrer sur la fiche</button></div></div>';

  // --- mail genere ---
  html += '<div class="card"><h2 style="margin-bottom:6px">Mail personnalise</h2>' +
    '<div class="hint" style="margin-top:0">Copie-colle dans ta boite, puis joins la fiche : <a href="' + FICHE_URL + '" target="_blank">telecharger le PDF</a>. Relis avant d\'envoyer.</div>' +
    '<label class="lbl">Objet</label>' +
    '<div style="display:flex;gap:8px"><input type="text" id="ia-obj" value="' + esc(mail.objet || '') + '" style="flex:1"><button class="btn ghost sm" onclick="AssistantIA._copy(\'ia-obj\',this)">Copier</button></div>' +
    '<label class="lbl">Message</label>' +
    '<textarea id="ia-corps" style="min-height:210px">' + esc(mail.corps || '') + '</textarea>' +
    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
    '<button class="btn gold" onclick="AssistantIA._copy(\'ia-corps\',this)">Copier le message</button>' +
    '<button class="btn" onclick="AssistantIA._copyMail(this)">Objet + message</button>' +
    (CIBLE.email && CIBLE.email !== '//' ? '<a class="btn ghost" style="text-decoration:none;line-height:2" href="' + mailtoLink() + '">Ouvrir ma messagerie</a>' : '<span class="chip gray" style="align-self:center">Pas d\'email en fiche</span>') +
    '</div></div>';

  el('ia-res').innerHTML = html;
}

function mailtoLink() {
  var to = (CIBLE.email && CIBLE.email !== '//') ? CIBLE.email : '';
  var o = el('ia-obj') ? el('ia-obj').value : ((RES.mail && RES.mail.objet) || '');
  var c = el('ia-corps') ? el('ia-corps').value : ((RES.mail && RES.mail.corps) || '');
  return 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(o) + '&body=' + encodeURIComponent(c);
}

async function save() {
  var f = RES.fiche || {};
  var src = RES.source || {};
  var checked = {};
  Array.prototype.forEach.call(document.querySelectorAll('#ia-res input[type=checkbox][data-k]'), function (cb) { checked[cb.getAttribute('data-k')] = cb.checked; });

  // 1) colonnes qui existent a coup sur
  var core = {};
  if (checked.email && val(f.email_visible)) core.email = val(f.email_visible);
  if (checked.telephone && val(f.telephone_visible) && !CIBLE.telephone) core.telephone = val(f.telephone_visible);
  if (checked.qualite_site && mapQualite(val(f.qualite_site))) core.qualite_site = mapQualite(val(f.qualite_site));
  if (checked.site_actuel && src.url) core.site_actuel = src.url;

  if (Object.keys(core).length) {
    core.updated_at = new Date().toISOString();
    var r = await sb().from('web_prospection_cibles').update(core).eq('id', CIBLE.id);
    if (r.error) { toast('Erreur : ' + r.error.message, true); return; }
    Object.keys(core).forEach(function (k) { CIBLE[k] = core[k]; });
  }

  // 2) analyse complete + secteur (colonnes phase9, optionnelles)
  var extra = { enrichissement: { fiche: f, resume: RES.resume_court, source: src, mail: RES.mail }, enrichi_le: new Date().toISOString() };
  if (checked.secteur && val(f.secteur)) extra.secteur = val(f.secteur);
  try {
    var r2 = await sb().from('web_prospection_cibles').update(extra).eq('id', CIBLE.id);
    if (r2.error) throw new Error(r2.error.message);
    if (extra.secteur) CIBLE.secteur = extra.secteur;
    toast('Fiche mise a jour');
  } catch (e) {
    // colonnes pas encore creees : le coeur est deja sauve, on previent juste
    if (Object.keys(core).length) toast('Infos enregistrees (analyse complete non memorisee : execute supabase/phase9.sql)', true);
    else toast('Pour memoriser l\'analyse, execute supabase/phase9.sql', true);
  }

  if (typeof window.loadAll === 'function') { try { await window.loadAll(); } catch (e) {} }
}

window.AssistantIA = {
  open: open,
  _analyser: analyser,
  _save: save,
  _close: fermer,
  _copy: function (id, btn) { var e = el(id); if (e) copier(e.value, btn); },
  _copyMail: function (btn) { var o = el('ia-obj'), c = el('ia-corps'); copier((o ? o.value : '') + '\n\n' + (c ? c.value : ''), btn); },
};
})();
