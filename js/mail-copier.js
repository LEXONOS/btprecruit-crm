/* ═══════════════════════════════════════════════════════════════
   NOVALEM APP — js/mail-copier.js
   Plus d'envoi automatique : quand l'app prepare un mail (fiche de
   presentation, confirmation de RDV...), on ouvre une modale prete a
   copier-coller dans ta propre boite (Gmail...). Tu joins la fiche
   toi-meme depuis le PDF telechargeable.
   Expose : window.ouvrirMailCopier, window.copierChamp, window.copierTout.
═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var FICHE_URL = '/docs/novalem-presentation.pdf';
function el(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function flash(btn) {
  if (!btn) return;
  var o = btn.textContent;
  btn.textContent = 'Copie !';
  setTimeout(function () { btn.textContent = o; }, 1400);
}
function copier(txt, btn) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function () { flash(btn); }).catch(function () { flash(btn); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove(); flash(btn);
  }
}

window.copierChamp = function (id, btn) {
  var e = el(id); if (!e) return;
  copier(e.value, btn);
};
window.copierTout = function (btn) {
  var o = el('cp-obj'), c = el('cp-corps');
  var sep = String.fromCharCode(10, 10);
  copier((o ? o.value : '') + sep + (c ? c.value : ''), btn);
};

window.ouvrirMailCopier = function (to, sujet, corps) {
  var mailto = 'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(sujet || '') + '&body=' + encodeURIComponent(corps || '');
  var html =
    '<div class="hint" style="margin-top:0">Copie-colle ce mail dans ta boite (Gmail...) puis joins la fiche de presentation. Fiche a joindre : <a href="' + FICHE_URL + '" target="_blank">telecharger le PDF</a>.</div>' +
    '<label class="lbl">Destinataire</label>' +
    '<div style="display:flex;gap:8px"><input type="text" id="cp-to" readonly value="' + esc(to || '') + '" style="flex:1"><button class="btn ghost sm" onclick="copierChamp(\'cp-to\',this)">Copier</button></div>' +
    '<label class="lbl">Objet</label>' +
    '<div style="display:flex;gap:8px"><input type="text" id="cp-obj" readonly value="' + esc(sujet || '') + '" style="flex:1"><button class="btn ghost sm" onclick="copierChamp(\'cp-obj\',this)">Copier</button></div>' +
    '<label class="lbl">Message</label>' +
    '<textarea id="cp-corps" readonly style="min-height:190px">' + esc(corps || '') + '</textarea>' +
    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
    '<button class="btn gold" onclick="copierChamp(\'cp-corps\',this)">Copier le message</button>' +
    '<button class="btn" onclick="copierTout(this)">Objet + message</button>' +
    '<a class="btn ghost" style="text-decoration:none;text-align:center;line-height:2" href="' + mailto + '">Ouvrir ma messagerie</a>' +
    '<button class="btn ghost" style="margin-left:auto" onclick="closeMo()">Fermer</button></div>';
  openMo('Mail a envoyer' + (to ? ' a ' + to : ''), html);
};

})();
