/* ═══════════════════════════════════════════════════════════════
   NOVALEM APP — js/usine-ui.js  (atelier, version manuelle)
   Pas de generation IA ni de deploiement automatique : un simple
   suivi de production par client.
     - checklist de ce que le client a fourni
     - lien de l'apercu Vercel (ephemere)
     - lien du site en ligne (nom de domaine achete)
     - depot des fichiers du client (bucket Supabase "web-usine")
   Les liens et la checklist sont ranges dans web_liens (aucune
   nouvelle table). Expose window.UsineUI.open(clientId).
═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var SB_URL = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';
var BUCKET = 'web-usine';
var LIB_APERCU = 'Apercu Vercel';
var LIB_SITE = 'Site en ligne';
var LIB_CHECK = '__checklist__';

var _sb = null;
function sb() { if (!_sb) _sb = window.supabase.createClient(SB_URL, SB_ANON); return _sb; }
function el(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m, warn) {
  var t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = m;
  el('toaster').appendChild(t);
  setTimeout(function () { t.remove(); }, 3200);
}

var CHECK = [
  ['logo', 'Logo'],
  ['photos', 'Photos'],
  ['textes', 'Textes / contenus'],
  ['tarifs', 'Tarifs'],
  ['coordonnees', 'Coordonnees (adresse, tel, horaires)'],
  ['reseaux', 'Reseaux sociaux'],
  ['societe', 'Infos societe / mentions legales'],
  ['charte', 'Charte / couleurs souhaitees'],
  ['acces', 'Acces hebergement (OVH / domaine)']
];

var CLIENT = null;
var LIENS = [];
var SUIVI = {};

function lienRow(lib) { for (var i = 0; i < LIENS.length; i++) { if (LIENS[i].libelle === lib) return LIENS[i]; } return null; }
function lienUrl(lib) { var r = lienRow(lib); return r ? (r.url || '') : ''; }

async function setLien(lib, url) {
  var existing = lienRow(lib);
  if (url) {
    if (existing) {
      var u = await sb().from('web_liens').update({ url: url }).eq('id', existing.id);
      if (u.error) { toast('Erreur : ' + u.error.message, true); return; }
      existing.url = url;
    } else {
      var r = await sb().from('web_liens').insert({ client_id: CLIENT.id, libelle: lib, url: url }).select().single();
      if (r.error) { toast('Erreur : ' + r.error.message, true); return; }
      if (r.data) LIENS.push(r.data);
    }
  } else if (existing) {
    await sb().from('web_liens').delete().eq('id', existing.id);
    LIENS = LIENS.filter(function (x) { return x.id !== existing.id; });
  }
}

async function open(clientId) {
  var c = await sb().from('web_clients').select('*').eq('id', clientId).single();
  CLIENT = c.data;
  var l = await sb().from('web_liens').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
  LIENS = l.data || [];
  var chk = lienRow(LIB_CHECK);
  SUIVI = {};
  if (chk && chk.url) { try { SUIVI = JSON.parse(chk.url); } catch (e) { SUIVI = {}; } }
  render();
  listFiles();
}

function render() {
  var c = CLIENT;
  el('tb-title').textContent = 'Atelier — ' + (c.entreprise || '');
  var done = CHECK.filter(function (k) { return SUIVI[k[0]]; }).length;
  var ap = lienUrl(LIB_APERCU), si = lienUrl(LIB_SITE);
  el('content').innerHTML =
    '<button class="btn ghost sm" onclick="go(\'production\')" style="margin-bottom:14px">&larr; Sites a produire</button>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:14px">Suivi de production de <b>' + esc(c.entreprise || '') + '</b> : ce que le client a fourni, l\'apercu Vercel, le site en ligne et ses fichiers.</div>' +

    '<div class="grid g2">' +

    '<div class="card"><h2>Ce que le client a fourni <span class="chip gray" id="u-chk-count">' + done + ' / ' + CHECK.length + '</span></h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:8px">Coche au fur et a mesure ce que tu recois.</div>' +
    CHECK.map(function (k) {
      return '<label style="display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line);cursor:pointer;font-size:14px">' +
        '<input type="checkbox" data-k="' + k[0] + '" ' + (SUIVI[k[0]] ? 'checked' : '') + ' onchange="UsineUI._toggle(this)" style="width:auto">' +
        '<span>' + k[1] + '</span></label>';
    }).join('') +
    '</div>' +

    '<div class="card"><h2>Liens du site</h2>' +
    '<label class="lbl" style="margin-top:0">Apercu Vercel (lien ephemere)</label>' +
    '<div style="display:flex;gap:8px"><input type="text" id="u-apercu" value="' + esc(ap) + '" placeholder="https://xxxx.vercel.app" style="flex:1">' +
    (ap ? '<a class="btn ghost sm" style="text-decoration:none;line-height:2.2" target="_blank" href="' + esc(ap) + '">Ouvrir</a>' : '') + '</div>' +
    '<label class="lbl">Site en ligne (nom de domaine)</label>' +
    '<div style="display:flex;gap:8px"><input type="text" id="u-site" value="' + esc(si) + '" placeholder="https://entreprise.fr" style="flex:1">' +
    (si ? '<a class="btn ghost sm" style="text-decoration:none;line-height:2.2" target="_blank" href="' + esc(si) + '">Ouvrir</a>' : '') + '</div>' +
    '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold" onclick="UsineUI._saveLiens()">Enregistrer les liens</button>' +
    '<button class="btn ghost" onclick="UsineUI._enLigne()">Marquer le site en ligne (termine)</button></div>' +
    '<div style="font-size:11.5px;color:var(--mut2);margin-top:8px">Ces deux liens apparaissent aussi dans le dossier client. "En ligne" fait passer le client en termine dans le pipeline et le sort de la file de production.</div>' +
    '</div>' +

    '<div class="card" style="grid-column:1/-1"><h2>Fichiers du client</h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:10px">Balance ici tout ce que le client t\'a donne : logo, photos, PDF, textes. Zero tri.</div>' +
    '<div class="drop" id="u-drop" onclick="document.getElementById(\'u-fi\').click()" style="border:2px dashed var(--line2);border-radius:10px;padding:26px 16px;text-align:center;color:var(--mut);cursor:pointer;background:var(--bg2)">Glisse tes fichiers ici ou clique<br><span style="font-size:11px">jusqu\'a 20 Mo par fichier</span></div>' +
    '<input type="file" id="u-fi" multiple style="display:none" onchange="UsineUI._upload(this.files)">' +
    '<div id="u-files" style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px"></div>' +
    '<div id="u-files-note"></div>' +
    '</div>' +

    '</div>';

  var drop = el('u-drop');
  ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = 'var(--gold)'; }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = 'var(--line2)'; }); });
  drop.addEventListener('drop', function (e) { upload(e.dataTransfer.files); });
}

async function toggle(cb) {
  SUIVI[cb.getAttribute('data-k')] = cb.checked;
  var done = CHECK.filter(function (k) { return SUIVI[k[0]]; }).length;
  if (el('u-chk-count')) el('u-chk-count').textContent = done + ' / ' + CHECK.length;
  await setLien(LIB_CHECK, JSON.stringify(SUIVI));
}

async function saveLiens() {
  var ap = el('u-apercu').value.trim();
  var si = el('u-site').value.trim();
  await setLien(LIB_APERCU, ap);
  await setLien(LIB_SITE, si);
  toast('Liens enregistres');
  render();
  listFiles();
}

async function listFiles() {
  var box = el('u-files'), note = el('u-files-note');
  if (!box) return;
  var r;
  try { r = await sb().storage.from(BUCKET).list(CLIENT.id, { limit: 100 }); }
  catch (e) { r = { error: e }; }
  if (r.error) {
    box.innerHTML = '';
    if (note) note.innerHTML = '<div class="hint" style="border-color:var(--gold);background:#fff7e6">Le depot de fichiers n\'est pas encore active. Pour l\'activer une fois : Supabase &gt; Storage &gt; New bucket &gt; nom <b>web-usine</b> &gt; coche Public &gt; Create (ou colle supabase/depot-fichiers.sql). Ce n\'est pas necessaire pour prospecter.</div>';
    return;
  }
  if (note) note.innerHTML = '';
  var files = (r.data || []).filter(function (f) { return f.name && f.name.indexOf('.') !== 0; });
  box.innerHTML = files.map(function (f) {
    var ko = Math.round(((f.metadata && f.metadata.size) || 0) / 1024);
    return '<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:12px;background:#fff">' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
      '<span style="color:var(--mut2);font-size:10.5px">' + ko + ' Ko</span>' +
      '<span style="color:var(--red);cursor:pointer;font-weight:800;padding:0 3px" onclick="UsineUI._del(\'' + esc(f.name) + '\')">&times;</span></div>';
  }).join('') || '<div class="empty" style="grid-column:1/-1;padding:10px">Aucun fichier depose</div>';
}

async function upload(fileList) {
  var files = Array.prototype.slice.call(fileList || []);
  var ok = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (f.size > 20 * 1024 * 1024) { toast(f.name + ' : trop lourd (max 20 Mo)', true); continue; }
    var nom = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-');
    var r;
    try { r = await sb().storage.from(BUCKET).upload(CLIENT.id + '/' + nom, f, { upsert: true }); }
    catch (e) { r = { error: e }; }
    if (r.error) { toast('Echec ' + f.name + ' : ' + (r.error.message || 'depot non active'), true); }
    else ok++;
  }
  if (ok) toast(ok + ' fichier(s) envoye(s)');
  listFiles();
}

async function del(nom) {
  try { await sb().storage.from(BUCKET).remove([CLIENT.id + '/' + nom]); } catch (e) {}
  listFiles();
}

async function enLigne() {
  var si = el('u-site') ? el('u-site').value.trim() : '';
  if (si) await setLien(LIB_SITE, si);
  var r = await sb().from('web_clients').update({ statut_pipeline: 'en_ligne', updated_at: new Date().toISOString() }).eq('id', CLIENT.id);
  if (r.error) { toast('Erreur : ' + r.error.message, true); return; }
  toast((CLIENT.entreprise || 'Le site') + ' : marque en ligne (termine)');
  if (typeof window.loadAll === 'function') { try { await window.loadAll(); } catch (e) {} }
}

window.UsineUI = {
  open: open,
  _toggle: toggle,
  _saveLiens: saveLiens,
  _upload: upload,
  _del: del,
  _enLigne: enLigne
};
})();
