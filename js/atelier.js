/* ═══════════════════════════════════════════════════════════════
   NOVALEM APP — js/atelier.js
   L'ATELIER (v2, repart de zero). Remplace l'ancien usine-ui.
   Une fiche plein ecran par client, qui recouvre le CRM, avec une
   barre d'etapes en haut. Le monteur reprend ou il s'etait arrete.

   Etape 1 (Munitions)  : ZIP d'assets client (fabrique dans le
     navigateur, avec brief.txt) + prompt personnalise adapte a la
     formule + bouton Ouvrir Claude. Il glisse le ZIP, colle le
     prompt, recupere le ZIP du site.
   Etape 2 (Mise en ligne) : guide GitHub + Vercel clic par clic +
     capture du lien d'apercu Vercel.
   Etapes 3-5 : a venir (verification, textes/images, controle final).

   Aucune nouvelle table, aucune nouvelle cle. L'etat de progression
   et le lien Vercel sont ranges dans web_liens (comme l'ancien).
   Expose window.Atelier.open(clientId).
═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var SB_URL  = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';
var BUCKET  = 'web-usine';
var LIB_APERCU = 'Apercu Vercel';
var LIB_STATE  = '__atelier__';

var _sb = null;
function sb() { if (!_sb) _sb = window.supabase.createClient(SB_URL, SB_ANON); return _sb; }
function el(id) { return document.getElementById(id); }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m, warn) {
  var box = el('toaster'); if (!box) { return; }
  var t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = m;
  box.appendChild(t);
  setTimeout(function () { t.remove(); }, 3400);
}
function slug(s) { return String(s || 'client').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'client'; }

/* ── formule / scope depuis web_clients.valeur_estimee ────────── */
function formuleInfo(v) {
  var n = Number(v) || 0;
  if (n >= 1200) return { label: 'Signature', pages: '6 pages et plus', key: 'C' };
  if (n >= 800)  return { label: 'Vitrine',   pages: 'multipage (jusqu\'a 5 pages)', key: 'B' };
  if (n >= 300)  return { label: 'Essentiel', pages: 'une page',        key: 'A' };
  if (n > 0)     return { label: 'Menu QR',   pages: 'une page menu',   key: 'QR' };
  return { label: 'Essentiel', pages: 'une page', key: 'A' };
}

/* ── etat courant ─────────────────────────────────────────────── */
var CLIENT = null, LIENS = [], ETAPE = 0, HDR = {}, SECT = 'header';
var ANALYSES = {}, T0 = 0, LOG = [];
var FILES = [], PREFS = '', SOEMAIL = '', WIN_T = null, CFX_T = null;
var STEPS = [
  { id: 'munitions', lbl: 'Munitions',       active: true },
  { id: 'ligne',     lbl: 'Mise en ligne',   active: true },
  { id: 'verif',     lbl: 'Verification',    active: true },
  { id: 'textes',    lbl: 'Textes & images', active: true },
  { id: 'final',     lbl: 'Controle final',  active: true }
];
var MAX_ACTIVE = 4; // index de la derniere etape active
var VSECTIONS = [
  { id: 'header',    lbl: 'Header',    active: true },
  { id: 'hero',      lbl: 'Hero',      active: true },
  { id: 'rubriques', lbl: 'Rubriques', active: true },
  { id: 'footer',    lbl: 'Footer',    active: true },
  { id: 'contact',   lbl: 'Contact',   active: true }
];

function lienRow(lib) { for (var i = 0; i < LIENS.length; i++) { if (LIENS[i].libelle === lib) return LIENS[i]; } return null; }
function lienUrl(lib) { var r = lienRow(lib); return r ? (r.url || '') : ''; }

async function setLien(lib, url) {
  var ex = lienRow(lib);
  if (url) {
    if (ex) { var u = await sb().from('web_liens').update({ url: url }).eq('id', ex.id); if (u.error) { toast('Erreur : ' + u.error.message, true); return; } ex.url = url; }
    else { var r = await sb().from('web_liens').insert({ client_id: CLIENT.id, libelle: lib, url: url }).select().single(); if (r.error) { toast('Erreur : ' + r.error.message, true); return; } if (r.data) LIENS.push(r.data); }
  } else if (ex) { await sb().from('web_liens').delete().eq('id', ex.id); LIENS = LIENS.filter(function (x) { return x.id !== ex.id; }); }
}

async function saveState() {
  var payload = JSON.stringify({ etape: ETAPE, hdr: HDR, t0: T0, log: LOG });
  var ex = lienRow(LIB_STATE);
  try {
    if (ex) { await sb().from('web_liens').update({ url: payload }).eq('id', ex.id); ex.url = payload; }
    else { var r = await sb().from('web_liens').insert({ client_id: CLIENT.id, libelle: LIB_STATE, url: payload }).select().single(); if (r.data) LIENS.push(r.data); }
  } catch (e) {}
}

/* ── styles injectes une fois (reprend le theme de l'app) ─────── */
function injectCss() {
  if (el('atl-css')) return;
  var s = document.createElement('style');
  s.id = 'atl-css';
  s.textContent = [
    '#atl-ov{position:fixed;inset:0;z-index:1000;background:var(--bg);display:flex;flex-direction:column;animation:atlin .18s ease}',
    '@keyframes atlin{from{opacity:0}to{opacity:1}}',
    '#atl-head{display:flex;align-items:center;gap:14px;padding:14px 22px;border-bottom:1px solid var(--line);background:var(--card);flex-shrink:0}',
    '#atl-head .lg{font-family:Newsreader,serif;font-size:20px}',
    '#atl-head .lg b{color:var(--gold);font-weight:500}',
    '#atl-head .sep{color:var(--line2)}',
    '#atl-head .cli{font-family:Newsreader,serif;font-size:20px}',
    '#atl-x{margin-left:auto;width:34px;height:34px;border-radius:8px;border:1px solid var(--line2);background:var(--card);color:var(--mut);font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}',
    '#atl-x:hover{background:var(--bg2);color:var(--ink)}',
    '#atl-steps{display:flex;align-items:flex-start;gap:0;padding:16px 22px 10px;border-bottom:1px solid var(--line);background:var(--card);overflow-x:auto;flex-shrink:0}',
    '.atl-st{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:92px;text-align:center;flex-shrink:0}',
    '.atl-st .dot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid var(--line2);color:var(--mut2);background:var(--card)}',
    '.atl-st .lb{font-size:11.5px;color:var(--mut2);font-weight:700}',
    '.atl-st.on .dot{border-color:var(--gold);background:var(--gold-soft);color:var(--gold)}',
    '.atl-st.on .lb{color:var(--ink)}',
    '.atl-st.done .dot{border-color:var(--gold);background:var(--gold);color:#fff}',
    '.atl-st.done .lb{color:var(--ink)}',
    '.atl-st.can{cursor:pointer}',
    '.atl-st.can:hover .dot{border-color:var(--gold)}',
    '.atl-st.soon .dot{border-style:dashed}',
    '.atl-ln{flex:1;height:2px;background:var(--line);margin-top:14px;min-width:14px}',
    '.atl-ln.fill{background:var(--gold)}',
    '#atl-body{flex:1;overflow:auto;padding:26px 22px 60px}',
    '.atl-inner{max-width:920px;margin:0 auto}',
    '.atl-lead{font-size:12.5px;color:var(--mut);margin-bottom:16px}',
    '.atl-big{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 4px}',
    '.atl-big .btn{padding:13px 18px;font-size:14px}',
    '.atl-note{font-size:12.5px;color:var(--mut);margin-top:12px;line-height:1.6}',
    '.atl-brief{white-space:pre-wrap;font-size:13.5px;line-height:1.6;background:var(--bg2);border-radius:10px;padding:16px;max-height:280px;overflow:auto}',
    '.atl-files{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-top:10px}',
    '.atl-fi{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:12px;background:#fff}',
    '.atl-guide{counter-reset:atl;margin:4px 0 0;padding:0;list-style:none}',
    '.atl-guide li{position:relative;padding:0 0 14px 40px;font-size:14px;line-height:1.55}',
    '.atl-guide li:before{counter-increment:atl;content:counter(atl);position:absolute;left:0;top:-2px;width:26px;height:26px;border-radius:50%;background:var(--gold-soft);color:var(--gold);border:1px solid var(--gold-line);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}',
    '.atl-guide li b{font-weight:700}',
    '.atl-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:26px;border-top:1px solid var(--line);padding-top:16px}',
    '.atl-badge{font-size:12px;font-weight:800;padding:5px 13px;border-radius:99px;background:var(--gold-soft);color:var(--gold);border:1px solid var(--gold-line)}',
    '.atl-spin{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--mut);padding:8px 0}',
    '.atl-spin .spin{width:16px;height:16px;border:2px solid var(--line2);border-top-color:var(--gold);border-radius:50%;display:inline-block;animation:atlspin .7s linear infinite}',
    '@keyframes atlspin{to{transform:rotate(360deg)}}',
    '.atl-ck{display:flex;gap:10px;align-items:flex-start;padding:9px 2px;border-bottom:1px solid var(--line)}',
    '.atl-ck .ic{width:20px;flex-shrink:0;text-align:center;padding-top:1px}',
    '.atl-ck .lb{font-size:13.5px}',
    '.atl-ck .ev{font-size:11.5px;color:var(--mut2);margin-top:2px;line-height:1.45}',
    'label.atl-ck{cursor:pointer}',
    '.atl-resume{font-size:13px;color:var(--ink);background:var(--bg2);border-radius:10px;padding:13px;margin-top:14px;line-height:1.55}'
  ].join('');
  document.head.appendChild(s);
}

/* ── brief.txt et prompt ──────────────────────────────────────── */
function buildBriefTxt(c) {
  var f = formuleInfo(c.valeur_estimee);
  var L = [];
  L.push('NOVALEM — Brief de production');
  L.push('=============================');
  L.push('Client        : ' + (c.entreprise || 'a preciser'));
  if (c.secteur) L.push('Secteur       : ' + c.secteur);
  var coord = [c.telephone, c.email, c.ville].filter(Boolean).join('  |  ');
  if (coord) L.push('Coordonnees   : ' + coord);
  L.push('Formule       : ' + f.label + ' (' + f.pages + ')');
  L.push('');
  L.push('BRIEF DETAILLE');
  L.push('--------------');
  L.push(c.brief && c.brief.trim() ? c.brief.trim() : '(pas encore de brief valide par Louis)');
  if (c.notes && c.notes.trim()) { L.push(''); L.push('NOTES BRUTES'); L.push('------------'); L.push(c.notes.trim()); }
  return L.join('\n');
}

function profileBlock(key) {
  if (key === 'A') return [
    'PROFIL Essentiel — une page, landing de conversion. Un seul but : on convertit. Ordre impose :',
    '1. Header leger : logo a gauche, reseaux a droite (seulement si le client en a). PAS de menu de navigation classique (au mieux des ancres qui glissent). On enleve toute distraction.',
    '2. Hero, au-dessus de la ligne de flottaison (tout tient sans scroller) : titre accrocheur = proposition de valeur en une phrase (ce que fait l\'entreprise, pour qui, quel benefice), sous-titre court, 2 a 4 puces benefices, un CTA principal avec du relief (bouton bien contraste), un visuel fort, un signal de confiance.',
    '3. Divulgation progressive : plus on scrolle, plus on donne de detail. Chaque section repond a une objection.',
    '4. Bandeau des services principaux juste sous le hero, avec de vraies photos de mise en situation.',
    '5. Comment ca marche en 3 etapes (si pertinent).',
    '6. Preuve sociale : references / logos + temoignages courts avec nom.',
    '7. CTA repetes comme points de decision, a la fin de chaque section importante.',
    '8. Sections profondes : details de l\'offre, exemples concrets, FAQ (3 a 5 questions qui levent les freins), tarifs si le metier s\'y prete.',
    '9. CTA final fort.',
    '10. Footer : coordonnees, reseaux (si fournis), lien mentions legales, mention discrete "Realisation Novalem".'
  ].join('\n');
  if (key === 'B') return [
    'PROFIL Vitrine — multipage (jusqu\'a 5 pages). Vrai site avec navigation complete.',
    'Arborescence type : Accueil, Services (ou une page par service majeur), A propos, Contact, Mentions legales (+ CGV si pertinent).',
    'Navigation claire en header, presente sur toutes les pages, etat actif visible. L\'accueil reprend l\'esprit du hero de conversion (titre, valeur, CTA) et renvoie vers les pages internes. Chaque page a son <title>, sa <meta description>, son <h1> unique et son SEO. Coherence visuelle et de navigation d\'une page a l\'autre.'
  ].join('\n');
  if (key === 'C') return [
    'PROFIL Signature — 6 pages et plus, avec modules. Tout le profil Vitrine, en plus riche, plus les modules retenus (prise de rendez-vous, formulaire de devis, blog SEO, version multilingue, simulateur interactif, boutique).',
    'Navigation structuree (menu clair, eventuellement regroupe). Chaque module est soigne et coherent avec le reste. Arborescence complete et SEO par page.'
  ].join('\n');
  return [
    'PROFIL Menu QR — une seule page ultra simple, pensee pour etre scannee via un QR code, optimisee mobile avant tout.',
    'Affiche clairement le menu / la carte (categories, produits, prix), le logo, un moyen de contact (tel / WhatsApp). Pas de fioritures, chargement tres rapide, lisible d\'une main sur telephone.'
  ].join('\n');
}

function buildPrompt(c) {
  var f = formuleInfo(c.valeur_estimee);
  var coord = [c.telephone && ('tel ' + c.telephone), c.email, c.ville].filter(Boolean).join(', ');
  var brief = (c.brief && c.brief.trim()) ? c.brief.trim() : '(brief non renseigne, demande a Louis de le valider dans la fiche client)';
  var imgList = FILES.filter(function (x) { var fo = folderFor(x.name); return fo === 'logo' || fo === 'photos'; }).map(function (x) { return x.name; });
  var imgBlock = imgList.length
    ? ('IMAGES FOURNIES (dans le ZIP, a placer aux bons endroits, reference chacune par son nom EXACT, par exemple /img/' + imgList[0] + ') :\n' + imgList.map(function (n) { return '- ' + n; }).join('\n'))
    : 'Images : utilise celles presentes dans le ZIP si il y en a.';
  var prefsBlock = (PREFS && PREFS.trim()) ? ('PREFERENCES NOVALEM (a respecter EN PRIORITE, elles priment sur les reglages par defaut) :\n' + PREFS.trim()) : '';
  return [
'Tu es le developpeur web de Novalem. Tu construis un site internet livre au client en code natif, dans un fichier ZIP complet, pret a mettre en ligne. Aucune solution no-code, aucun WordPress, aucun builder. Le client est 100% proprietaire de son site.',
'',
'STACK ET LIVRABLE',
'- Site 100% statique : HTML5, CSS3, JavaScript vanilla. Aucun framework, aucune etape de build. Doit fonctionner en ouvrant index.html et etre deployable tel quel sur hebergement mutualise OVH (depot FileZilla) comme sur Vercel.',
'- Structure propre : index.html (+ pages secondaires si multipage), /css/style.css, /js/main.js, /img/, /assets/ (logo, favicon).',
'- Livre TOUT le projet en fichiers complets, pret a glisser sur GitHub.',
'',
'CLIENT',
'- Entreprise : ' + (c.entreprise || 'a preciser'),
(c.secteur ? '- Secteur : ' + c.secteur : '- Secteur : a preciser'),
(coord ? '- Coordonnees : ' + coord : '- Coordonnees : a preciser'),
'- Formule retenue : ' + f.label + ' (' + f.pages + ')',
'',
'INFORMATIONS DETAILLEES (brief de production) :',
brief,
'',
'Tous les fichiers du client (logo, photos, textes) sont dans le ZIP que je te joins, avec un brief.txt.',
imgBlock,
'Tu DOIS placer les images fournies aux bons endroits, referencees par leur nom exact (par exemple /img/<nom>). N\'insere AUCUN placeholder d\'image (jamais de bloc [IMAGE...]). Ecris de vrais textes a partir du brief, sans marqueur [A COMPLETER]. Si une information factuelle manque vraiment (par exemple des temoignages reels), n\'invente pas de faux contenu et ne laisse pas de marqueur : omets la section ou remplace-la par un element que tu peux reellement produire.',
'',
'DIRECTION ARTISTIQUE',
'- Si une charte client est fournie (couleurs, police, logo), respecte-la strictement.',
'- Sinon, DA Novalem par defaut : clair et editorial, fond porcelaine, accents or, tres aere, typographie soignee, moderne et premium.',
'- Responsive mobile-first impeccable. Le header disparait completement quand on scrolle vers le bas et reapparait des qu\'on scrolle vers le haut. Hamburger propre sur mobile.',
'',
prefsBlock,
profileBlock(f.key),
'',
'REGLES DE REDACTION',
'- Textes naturels, concrets, humains. Evite le style "IA" : pas de tirets longs (—), pas de formules creuses ("dans un monde ou", "que vous soyez... ou..."), pas de superlatifs vides.',
'- Ponctuation : virgules, parentheses, deux-points. Jamais de tiret long.',
'- Phrases courtes, vocabulaire du metier du client.',
'',
'SEO, PERFORMANCE, ACCESSIBILITE (deja amorces)',
'- lang="fr", un seul <h1> par page, hierarchie h2/h3 propre.',
'- <title> et <meta name="description"> pertinents et uniques par page.',
'- Open Graph (og:title, og:description, og:image) + favicon.',
'- alt descriptif sur chaque image.',
'- JSON-LD LocalBusiness (nom, adresse, tel, horaires) si commerce local.',
'- Images optimisees + loading="lazy", CSS et JS legers. Objectif PageSpeed > 90.',
'- Contrastes suffisants, navigation clavier de base, focus visibles.',
'',
'Livre maintenant le projet complet, tous les fichiers, pret a extraire et a pousser sur GitHub.'
  ].join('\n');
}

/* ── fichiers du client (bucket : racine ET /docs) ────────────── */
function folderFor(name) {
  var ext = (name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp'].indexOf(ext) >= 0) return /logo/i.test(name) ? 'logo' : 'photos';
  if (['pdf', 'txt', 'doc', 'docx', 'rtf', 'md', 'csv'].indexOf(ext) >= 0) return 'textes-documents';
  return 'autres';
}
async function listAll() {
  var seen = {}, out = [], subs = ['', '/docs'];
  for (var i = 0; i < subs.length; i++) {
    try {
      var r = await sb().storage.from(BUCKET).list(CLIENT.id + subs[i], { limit: 200 });
      (r.data || []).forEach(function (f) {
        if (!f.name || f.name.charAt(0) === '.' || f.name === 'docs') return;
        if (f.id === null || f.id === undefined) return; // dossier, pas un fichier
        if (seen[f.name]) return; seen[f.name] = 1;
        out.push({ name: f.name, path: CLIENT.id + subs[i] + '/' + f.name });
      });
    } catch (e) {}
  }
  return out;
}

/* ── rendu ────────────────────────────────────────────────────── */
function stepsBar() {
  var out = '';
  for (var i = 0; i < STEPS.length; i++) {
    var s = STEPS[i], cls = 'atl-st';
    if (i === ETAPE) cls += ' on';
    else if (i < ETAPE) cls += ' done';
    if (s.active && i !== ETAPE) cls += ' can';
    if (!s.active) cls += ' soon';
    var dot = (i < ETAPE) ? '&#10003;' : (i + 1);
    out += '<div class="' + cls + '" data-i="' + i + '"><div class="dot">' + dot + '</div><div class="lb">' + esc(s.lbl) + (s.active ? '' : '<br><span style="font-size:10px">bientot</span>') + '</div></div>';
    if (i < STEPS.length - 1) out += '<div class="atl-ln' + (i < ETAPE ? ' fill' : '') + '"></div>';
  }
  return out;
}

function render() {
  var ov = el('atl-ov'); if (!ov) return;
  var f = formuleInfo(CLIENT.valeur_estimee);
  ov.querySelector('#atl-steps').innerHTML = stepsBar();
  ov.querySelectorAll('#atl-steps .atl-st.can').forEach(function (n) {
    n.addEventListener('click', function () { var i = +n.getAttribute('data-i'); goStep(i); });
  });
  var body = ov.querySelector('#atl-inner');
  if (ETAPE === 0) body.innerHTML = viewMunitions(f);
  else if (ETAPE === 1) body.innerHTML = viewLigne();
  else if (ETAPE === 2) { body.innerHTML = viewVerif(); if (lienUrl(LIB_APERCU)) enterVerif(); }
  else if (ETAPE === 3) { body.innerHTML = viewTextes(); if (lienUrl(LIB_APERCU)) showAnalyse('textes'); }
  else body.innerHTML = viewFinal();
  if (ETAPE === 0) listFiles();
}

function viewMunitions(f) {
  var hasBrief = CLIENT.brief && CLIENT.brief.trim();
  return '' +
    '<div class="atl-lead">Etape 1 sur ' + STEPS.length + '. Recupere tout ce qu\'il te faut pour lancer le site dans Claude : le ZIP des fichiers du client et le prompt pret a coller.</div>' +
    '<div class="card" style="margin-bottom:16px"><h2>Brief de production ' + '<span class="atl-badge" style="margin-left:6px">' + esc(f.label) + '</span></h2>' +
    (hasBrief
      ? '<div class="atl-brief">' + esc(CLIENT.brief.trim()) + '</div>'
      : '<div class="hint">Le brief n\'est pas encore valide. Demande a Louis de le renseigner dans la fiche client (bouton "Mettre le brief au propre"). Tu peux quand meme generer le ZIP et le prompt, mais ils seront incomplets.</div>') +
    '</div>' +
    '<div class="card"><h2>Tes munitions</h2>' +
    '<div class="atl-big">' +
    '<button class="btn gold" onclick="Atelier._zip(this)">Telecharger le ZIP d\'assets</button>' +
    '<button class="btn" onclick="Atelier._copy(this)">Copier le prompt</button>' +
    '<button class="btn ghost" onclick="Atelier._claude()">Ouvrir Claude &#8599;</button>' +
    '</div>' +
    '<div class="atl-note"><b>La marche a suivre :</b> ouvre Claude, glisse le ZIP dans la conversation, colle le prompt, envoie. Claude te renvoie le ZIP du site. (Le bouton Claude ouvre juste une conversation, c\'est toi qui glisses le ZIP.)</div>' +
    '<details style="margin-top:14px"><summary style="cursor:pointer;font-size:12.5px;color:var(--mut)">Voir le prompt qui sera copie</summary><div class="atl-brief" style="margin-top:8px">' + esc(buildPrompt(CLIENT)) + '</div></details>' +
    '<div style="margin-top:16px"><div class="lbl" style="margin-top:0">Fichiers du client rassembles dans le ZIP</div><div class="atl-files" id="atl-files"><div class="empty" style="grid-column:1/-1;padding:10px">Chargement...</div></div><div id="atl-files-note"></div></div>' +
    '</div>' +
    '<div class="atl-foot"><span></span><button class="btn gold" onclick="Atelier._go(1)">Etape suivante : mise en ligne &rarr;</button></div>';
}

function viewLigne() {
  var ap = lienUrl(LIB_APERCU);
  return '' +
    '<div class="atl-lead">Etape 2 sur ' + STEPS.length + '. Mets le ZIP du site en ligne pour obtenir un apercu, puis colle le lien ici.</div>' +
    '<div class="card" style="margin-bottom:16px"><h2>1. GitHub</h2>' +
    '<ol class="atl-guide">' +
    '<li>Va sur <b>github.com/new</b> (connecte-toi si besoin).</li>' +
    '<li>Donne un nom au depot (ex. le nom du client), laisse en <b>Public</b> ou Private, clique <b>Create repository</b>.</li>' +
    '<li>Sur la page du depot vide, clique <b>uploading an existing file</b>.</li>' +
    '<li>Ouvre le ZIP du site que Claude t\'a donne, <b>extrais-le</b>, puis glisse <b>tout le contenu</b> du dossier (index.html, /css, /js, /img...) dans la zone. Glisse les fichiers, pas le dossier parent.</li>' +
    '<li>Clique <b>Commit changes</b>.</li>' +
    '</ol></div>' +
    '<div class="card" style="margin-bottom:16px"><h2>2. Vercel</h2>' +
    '<ol class="atl-guide">' +
    '<li>Va sur <b>vercel.com/new</b> (connecte-toi avec GitHub).</li>' +
    '<li>Dans la liste, trouve ton depot et clique <b>Import</b>.</li>' +
    '<li>Ne touche a rien, clique <b>Deploy</b>. Attends la fin.</li>' +
    '<li>Clique <b>Visit</b> ou <b>Continue to dashboard</b> : tu as l\'adresse en <b>.vercel.app</b>. C\'est ton apercu.</li>' +
    '</ol>' +
    '<div class="hint">Pour une correction plus tard : re-uploade le nouveau ZIP sur le <b>meme</b> depot GitHub, Vercel redeploie tout seul. Rien a refaire.</div></div>' +
    '<div class="card"><h2>3. Le lien d\'apercu</h2>' +
    '<label class="lbl" style="margin-top:0">Adresse .vercel.app de l\'apercu</label>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" id="atl-ap" value="' + esc(ap) + '" placeholder="https://xxxx.vercel.app" style="flex:1;min-width:220px;padding:10px 12px;border:1px solid var(--line2);border-radius:8px;font:inherit">' +
    (ap ? '<a class="btn ghost" style="text-decoration:none" target="_blank" href="' + esc(ap) + '">Ouvrir</a>' : '') +
    '<button class="btn gold" onclick="Atelier._saveApercu()">Enregistrer le lien</button></div>' +
    '<div class="atl-note">Ce lien est range sur la fiche du client. Tu pourras le donner a Louis pour qu\'il verifie l\'apercu.</div>' +
    '</div>' +
    '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(0)">&larr; Retour aux munitions</button><span style="font-size:12.5px;color:var(--mut2)">Les etapes de verification arrivent bientot.</span></div>';
}

function sectionLabel(id) { for (var i = 0; i < VSECTIONS.length; i++) if (VSECTIONS[i].id === id) return VSECTIONS[i].lbl; return id; }
function verifNav() {
  return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">' + VSECTIONS.map(function (s) {
    if (!s.active) return '<span class="chip gray" style="opacity:.6">' + esc(s.lbl) + ' (bientot)</span>';
    return '<button class="btn ' + (s.id === SECT ? 'gold' : 'ghost') + ' sm" onclick="Atelier._sect(\'' + s.id + '\')">' + esc(s.lbl) + '</button>';
  }).join('') + '</div>';
}

function viewVerif() {
  var ap = lienUrl(LIB_APERCU);
  if (!ap) {
    return '<div class="atl-lead">Etape 3 sur ' + STEPS.length + '. Verification du site, section par section.</div>' +
      '<div class="card"><h2>Il me faut d\'abord le lien de l\'apercu</h2><div style="font-size:13.5px;color:var(--mut);line-height:1.6">Va a l\'etape 2 (Mise en ligne) et colle l\'adresse .vercel.app de l\'apercu. Reviens ensuite ici.</div>' +
      '<div style="margin-top:14px"><button class="btn gold" onclick="Atelier._go(1)">Aller a la mise en ligne</button></div></div>' +
      '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(1)">&larr; Retour</button><span></span></div>';
  }
  var lbl = sectionLabel(SECT);
  return '<div class="atl-lead">Etape 3 sur ' + STEPS.length + '. L\'IA lit ton apercu en ligne et pre-verifie chaque section. Tu confirmes ce qui est visuel.</div>' +
    '<div class="card">' + verifNav() +
    '<h2 style="margin-top:2px">' + esc(lbl) + ' <span class="chip gray" style="font-size:10px">' + esc(ap.replace(/^https?:\/\//, '')) + '</span></h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:12px">L\'IA analyse chaque section a l\'arrivee, et prepare les suivantes en arriere-plan. Elle ne bluffe jamais sur ce qu\'elle ne voit pas.</div>' +
    '<div id="atl-verif-res" style="margin-top:8px"></div>' +
    '</div>' +
    '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(1)">&larr; Retour</button><span style="font-size:12.5px;color:var(--mut2)">Rubriques, footer et contact arrivent apres.</span></div>';
}

function setSect(id) { SECT = id; render(); }

function curSection() { return ETAPE === 3 ? 'textes' : SECT; }

async function ensureAnalyse(section) {
  if (ANALYSES[section]) return ANALYSES[section];
  var ap = lienUrl(LIB_APERCU); if (!ap) return { ok: false, error: 'Ajoute le lien de l\'apercu (etape 2).' };
  try {
    var r = await fetch('/api/verif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ap, section: section, brief: (CLIENT.brief || CLIENT.notes || ''), formule: formuleInfo(CLIENT.valeur_estimee).label }) });
    var d = await r.json();
    if (d && d.ok) ANALYSES[section] = d;
    return d;
  } catch (e) { return { ok: false, error: e.message || 'reseau' }; }
}

function showAnalyse(section) {
  var res = el('atl-verif-res'); if (!res) return;
  if (ANALYSES[section]) { renderVerif(ANALYSES[section]); return; }
  var game = startGame(res);
  ensureAnalyse(section).then(function (d) {
    game.stop();
    if (curSection() !== section) return;
    if (!d || !d.ok) { res.innerHTML = '<div class="hint">' + esc((d && d.error) || 'Analyse impossible.') + '</div>'; }
    else renderVerif(d);
  });
}

function enterVerif() {
  var res = el('atl-verif-res'); if (!res) return;
  if (ANALYSES.__loaded && ANALYSES[SECT]) { renderVerif(ANALYSES[SECT]); return; }
  var game = startGame(res);
  ensureAll().then(function (d) {
    game.stop();
    if (ETAPE !== 2) return;
    if (ANALYSES[SECT]) renderVerif(ANALYSES[SECT]);
    else res.innerHTML = '<div class="hint">' + esc((d && d.error) || 'Analyse impossible.') + '</div>';
  });
}

async function ensureAll() {
  if (ANALYSES.__loaded) return {};
  var ap = lienUrl(LIB_APERCU); if (!ap) return { ok: false, error: 'Ajoute le lien de l\'apercu (etape 2).' };
  try {
    var r = await fetch('/api/verif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ap, section: 'all', brief: (CLIENT.brief || CLIENT.notes || ''), formule: formuleInfo(CLIENT.valeur_estimee).label }) });
    var d = await r.json();
    if (d && d.ok && d.all) { Object.keys(d.all).forEach(function (k) { ANALYSES[k] = d.all[k]; }); ANALYSES.__loaded = true; }
    return d;
  } catch (e) { return { ok: false, error: e.message || 'reseau' }; }
}

function logEvent(txt) { LOG.push({ t: Date.now(), e: txt }); }
function fmtDur(ms) { var m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'min'; }
function fmtClock(ts) { try { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
function fmtWhen(ts) { try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

function renderVerif(d) {
  var res = el('atl-verif-res'); if (!res) return;
  var sect = d.section || SECT;
  if (!HDR[sect]) HDR[sect] = {};
  var conf = HDR[sect];
  var auto = (d.checks || []).filter(function (k) { return k.group === 'auto'; });
  var human = (d.checks || []).filter(function (k) { return k.group === 'human'; });
  function ic(s) { return s === 'ok' ? '<span style="color:var(--green);font-weight:800">&#10003;</span>' : (s === 'ko' ? '<span style="color:var(--red);font-weight:800">&#10007;</span>' : '<span style="color:var(--mut2);font-weight:800">&bull;</span>'); }
  var html = '';
  html += '<div class="lbl" style="margin-top:0">Verifie par l\'IA</div>';
  html += auto.map(function (k) {
    return '<div class="atl-ck"><div class="ic">' + ic(k.status) + '</div><div><div class="lb">' + esc(k.label) + '</div><div class="ev">' + esc(k.evidence) + '</div></div></div>';
  }).join('');
  html += '<div class="lbl">A confirmer a l\'oeil</div>';
  html += human.map(function (k) {
    var on = conf[k.id] ? 'checked' : '';
    return '<label class="atl-ck"><div class="ic"><input type="checkbox" ' + on + ' onchange="Atelier._hdr(\'' + sect + '\',\'' + k.id + '\', this.checked)" style="width:auto"></div><div><div class="lb">' + esc(k.label) + '</div><div class="ev">' + esc(k.evidence) + '</div></div></label>';
  }).join('');
  if (d.resume) html += '<div class="atl-resume">' + esc(d.resume) + '</div>';

  var ko = auto.filter(function (k) { return k.status === 'ko'; });
  var todo = human.filter(function (k) { return !conf[k.id]; });
  var reste = ko.length + todo.length;

  if (reste > 0) {
    var lbl = sectionLabel(sect) || sect;
    var corr = 'Corrige la section ' + lbl + ' du site (code natif, textes sans tirets longs).\n';
    if (d.correction && d.correction.trim()) corr += '\n' + d.correction.trim() + '\n';
    else if (ko.length) corr += '\n' + ko.map(function (k) { return '- ' + k.label + ' : ' + k.evidence; }).join('\n') + '\n';
    if (todo.length) corr += '\nAssure-toi aussi de :\n' + todo.map(function (k) { return '- ' + k.label; }).join('\n') + '\n';
    html += '<div class="card" style="margin-top:14px;border-color:var(--gold-line)"><h2 style="font-size:16px">A corriger sur cette section</h2>' +
      '<div class="atl-brief" id="atl-corr">' + esc(corr.trim()) + '</div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold" onclick="Atelier._copyCorr()">Copier le prompt</button><button class="btn ghost" onclick="Atelier._claude()">Ouvrir Claude &#8599;</button><button class="btn ghost" onclick="Atelier._re(\'' + sect + '\')">Re-analyser</button></div>' +
      '<div class="atl-note">Colle dans la meme conversation Claude, re-uploade la nouvelle version sur le meme depot GitHub, Vercel redeploie, puis Re-analyser.</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px"><span style="font-size:12.5px;color:var(--mut2)">' + reste + ' point(s) a regler avant de valider</span><button class="btn" disabled>Valider et continuer</button></div>';
  } else {
    html += '<div class="hint" style="border-color:var(--green);background:var(--green-soft);color:var(--green);margin-top:14px">Tout est bon sur cette section.</div>' +
      '<div style="display:flex;align-items:center;justify-content:flex-end;margin-top:16px"><button class="btn gold" onclick="Atelier._valider()">Valider et continuer &rarr;</button></div>';
  }
  res.innerHTML = html;
}

function hdrToggle(sect, id, val) {
  if (!HDR[sect]) HDR[sect] = {};
  HDR[sect][id] = !!val;
  if (sect === 'final' && id === 'valide' && val) { logEvent('Controle final valide'); saveState(); celebrate(); return; }
  saveState();
  if ((ETAPE === 2 || ETAPE === 3) && ANALYSES[sect]) renderVerif(ANALYSES[sect]);
}

function valider() {
  var cs = curSection();
  if (!HDR[cs]) HDR[cs] = {};
  HDR[cs].__done = true;
  logEvent('Valide : ' + (cs === 'textes' ? 'Textes & images' : (sectionLabel(cs) || cs)));
  saveState();
  if (ETAPE === 3) { goStep(4); return; }
  if (ETAPE === 2) {
    var idx = -1, i;
    for (i = 0; i < VSECTIONS.length; i++) if (VSECTIONS[i].id === SECT) idx = i;
    var next = null;
    for (i = idx + 1; i < VSECTIONS.length; i++) if (VSECTIONS[i].active) { next = VSECTIONS[i].id; break; }
    if (next) setSect(next); else goStep(3);
  }
}

async function copyCorr() {
  var box = el('atl-corr'); if (!box) return;
  var txt = box.textContent || '';
  try { await navigator.clipboard.writeText(txt); toast('Correction copiee'); }
  catch (e) {
    var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Correction copiee'); } catch (_) { toast('Copie impossible, selectionne le texte', true); }
    ta.remove();
  }
}

function viewTextes() {
  var ap = lienUrl(LIB_APERCU);
  if (!ap) {
    return '<div class="atl-lead">Etape 4 sur ' + STEPS.length + '. Passe sur tous les textes et les images.</div>' +
      '<div class="card"><h2>Il me faut d\'abord le lien de l\'apercu</h2><div style="font-size:13.5px;color:var(--mut);line-height:1.6">Va a l\'etape 2 (Mise en ligne) et colle l\'adresse .vercel.app de l\'apercu.</div>' +
      '<div style="margin-top:14px"><button class="btn gold" onclick="Atelier._go(1)">Aller a la mise en ligne</button></div></div>' +
      '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(2)">&larr; Retour</button><span></span></div>';
  }
  return '<div class="atl-lead">Etape 4 sur ' + STEPS.length + '. On passe tous les textes au crible pour enlever le cote trop IA, et on verifie les images.</div>' +
    '<div class="card"><h2>Textes &amp; images <span class="chip gray" style="font-size:10px">' + esc(ap.replace(/^https?:\/\//, '')) + '</span></h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:12px">L\'IA lit tous les textes du site des l\'arrivee, repere ce qui sonne trop IA et te propose des reformulations. Elle verifie aussi les images (alt, placeholders oublies).</div>' +
    '<div id="atl-verif-res" style="margin-top:8px"></div>' +
    '</div>' +
    '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(2)">&larr; Retour a la verification</button><span style="font-size:12.5px;color:var(--mut2)">Ensuite : le controle final.</span></div>';
}

function viewFinal() {
  var ap = lienUrl(LIB_APERCU);
  if (!ap) {
    return '<div class="atl-lead">Etape 5 sur ' + STEPS.length + '. Controle final du site complet.</div>' +
      '<div class="card"><h2>Il me faut d\'abord le lien de l\'apercu</h2><div style="font-size:13.5px;color:var(--mut);line-height:1.6">Va a l\'etape 2 (Mise en ligne) et colle l\'adresse .vercel.app de l\'apercu.</div>' +
      '<div style="margin-top:14px"><button class="btn gold" onclick="Atelier._go(1)">Aller a la mise en ligne</button></div></div>' +
      '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(3)">&larr; Retour</button><span></span></div>';
  }
  return '<div class="atl-lead">Etape 5 sur ' + STEPS.length + '. Le controle final. Claude audite tout le site d\'un coup et te rend un bilan honnete.</div>' +
    '<div class="card"><h2>Controle final <span class="chip gray" style="font-size:10px">' + esc(ap.replace(/^https?:\/\//, '')) + '</span></h2>' +
    '<div style="font-size:12.5px;color:var(--mut);margin-bottom:12px">Une passe globale sur toutes les sections et tous les textes, avec un verdict clair et les corrections prioritaires s\'il en reste.</div>' +
    '<button class="btn gold" id="atl-final-btn" onclick="Atelier._final(this)">Lancer le controle final</button>' +
    '<div id="atl-verif-res" style="margin-top:16px"></div>' +
    '</div>' +
    '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(3)">&larr; Retour aux textes</button><span style="font-size:12.5px;color:var(--mut2)">Derniere etape de l\'Atelier.</span></div>';
}

function startGame(container) {
  if (!container) return { stop: function () {} };
  var msgs = ['Lecture du site en ligne...', 'Analyse du header et du hero...', 'Controle des rubriques et du footer...', 'Relecture de tous les textes...', 'Presque termine...'];
  container.innerHTML =
    '<div id="atl-g-msg" style="text-align:center;padding:6px 0 2px;color:var(--mut);font-size:13px">' + msgs[0] + '</div>' +
    '<div style="text-align:center;font-size:12px;color:var(--mut2);margin-bottom:8px">En attendant, attrape les pastilles. Score : <b id="atl-g-score">0</b></div>' +
    '<div id="atl-g-area" style="position:relative;height:180px;border:1px dashed var(--line2);border-radius:12px;background:var(--bg2);overflow:hidden;cursor:crosshair">' +
    '<div id="atl-g-dot" style="position:absolute;width:26px;height:26px;border-radius:50%;background:var(--gold);left:40px;top:40px;transition:left .16s,top .16s"></div>' +
    '</div>';
  var score = 0, mi = 0;
  var area = el('atl-g-area'), dot = el('atl-g-dot');
  function move() {
    if (!area || !dot) return;
    var w = Math.max(30, area.clientWidth - 30), h = Math.max(30, area.clientHeight - 30);
    dot.style.left = Math.floor(Math.random() * w) + 'px';
    dot.style.top = Math.floor(Math.random() * h) + 'px';
  }
  if (dot) dot.onclick = function (e) { e.stopPropagation(); score++; var s = el('atl-g-score'); if (s) s.textContent = score; move(); };
  var t1 = setInterval(move, 850);
  var t2 = setInterval(function () { mi = (mi + 1) % msgs.length; var m = el('atl-g-msg'); if (m) m.textContent = msgs[mi]; }, 1600);
  move();
  return { stop: function () { clearInterval(t1); clearInterval(t2); } };
}

async function doFinal(btn) {
  var ap = lienUrl(LIB_APERCU);
  if (!ap) { toast('Ajoute d\'abord le lien de l\'apercu (etape 2)', true); return; }
  var res = el('atl-verif-res');
  if (btn) btn.disabled = true;
  var game = startGame(res);
  try {
    var r = await fetch('/api/verif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ap, section: 'final', brief: (CLIENT.brief || CLIENT.notes || ''), formule: formuleInfo(CLIENT.valeur_estimee).label }) });
    var d = await r.json();
    game.stop();
    if (!d.ok) { if (res) res.innerHTML = '<div class="hint">' + esc(d.error || 'Analyse impossible.') + '</div>'; }
    else renderFinal(d);
  } catch (e) { game.stop(); if (res) res.innerHTML = '<div class="hint">Erreur : ' + esc(e.message || 'reseau') + '</div>'; }
  if (btn) btn.disabled = false;
}

function renderFinal(d) {
  var res = el('atl-verif-res'); if (!res) return;
  if (!HDR['final']) HDR['final'] = {};
  var checks = d.checks || [];
  var ko = checks.filter(function (k) { return k.status === 'ko'; });
  var human = d.humanCount || 0;
  var bySection = {};
  checks.forEach(function (k) { (bySection[k.section] = bySection[k.section] || []).push(k); });
  function ic(s) { return s === 'ok' ? '<span style="color:var(--green);font-weight:800">&#10003;</span>' : (s === 'ko' ? '<span style="color:var(--red);font-weight:800">&#10007;</span>' : '<span style="color:var(--mut2);font-weight:800">&bull;</span>'); }
  var html = '';
  if (ko.length) html += '<div class="hint" style="border-color:var(--red);background:var(--red-soft);color:var(--red)"><b>' + ko.length + ' point(s) a corriger</b> cote code, plus ' + human + ' points a confirmer a l\'oeil.</div>';
  else html += '<div class="hint" style="border-color:var(--green);background:var(--green-soft);color:var(--green)"><b>Aucun probleme bloquant detecte</b> cote code. Il reste ' + human + ' points a confirmer a l\'oeil.</div>';
  Object.keys(bySection).forEach(function (sec) {
    html += '<div class="lbl">' + esc(sec) + '</div>';
    html += bySection[sec].map(function (k) {
      return '<div class="atl-ck"><div class="ic">' + ic(k.status) + '</div><div><div class="lb">' + esc(k.label) + '</div><div class="ev">' + esc(k.evidence) + '</div></div></div>';
    }).join('');
  });
  if (d.resume) html += '<div class="atl-resume">' + esc(d.resume) + '</div>';
  if (d.correction && d.correction.trim()) {
    html += '<div class="card" style="margin-top:14px;border-color:var(--gold-line)"><h2 style="font-size:16px">Corrections prioritaires</h2>' +
      '<div class="atl-brief" id="atl-corr">' + esc(d.correction.trim()) + '</div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold" onclick="Atelier._copyCorr()">Copier</button><button class="btn ghost" onclick="Atelier._claude()">Ouvrir Claude &#8599;</button></div>' +
      '<div class="atl-note">Colle dans la meme conversation Claude, re-uploade sur le meme depot GitHub, Vercel redeploie, puis relance le controle.</div>' +
      '<div style="margin-top:10px"><button class="btn ghost sm" onclick="Atelier._final(null)">Relancer le controle</button></div>' +
      '</div>';
  }
  var last = LOG.length ? LOG[LOG.length - 1].t : Date.now();
  html += '<div class="lbl">Suivi de production</div>';
  html += '<div class="atl-resume" style="font-size:12.5px">Demarre le ' + esc(fmtWhen(T0)) + '<br>Temps ecoule : <b>' + esc(fmtDur(last - T0)) + '</b></div>';
  if (LOG.length) {
    html += '<div style="margin-top:8px">' + LOG.map(function (x) { return '<div style="font-size:12px;color:var(--mut2);padding:4px 0;border-bottom:1px solid var(--line)"><b style="color:var(--mut)">' + esc(fmtClock(x.t)) + '</b> &middot; ' + esc(x.e) + '</div>'; }).join('') + '</div>';
  }
  var on = HDR['final'].valide ? 'checked' : '';
  html += '<label class="atl-ck" style="margin-top:14px"><div class="ic"><input type="checkbox" ' + on + ' onchange="Atelier._hdr(\'final\',\'valide\', this.checked)" style="width:auto"></div><div><div class="lb">Controle final valide, le site est pret</div><div class="ev">a cocher une fois que tout est bon, cote code et cote visuel</div></div></label>';
  res.innerHTML = html;
}

function confetti(cv) {
  if (!cv) return;
  var ctx = cv.getContext('2d');
  cv.width = cv.clientWidth || window.innerWidth; cv.height = cv.clientHeight || window.innerHeight;
  var cols = ['#C8900A', '#E9C46A', '#2A9D8F', '#E76F51', '#457B9D', '#F4A261', '#ffffff'];
  var P = [];
  for (var i = 0; i < 170; i++) {
    P.push({ x: cv.width / 2 + (Math.random() - .5) * 80, y: cv.height / 3 + (Math.random() - .5) * 50, vx: (Math.random() - .5) * 11, vy: Math.random() * -9 - 3, g: .16 + Math.random() * .14, s: 5 + Math.random() * 8, a: Math.random() * Math.PI, va: (Math.random() - .5) * .35, c: cols[(Math.random() * cols.length) | 0] });
  }
  var t0 = Date.now();
  function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    P.forEach(function (p) { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.a += p.va; p.vx *= .995; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); });
    if (Date.now() - t0 < 6500) CFX_T = requestAnimationFrame(frame);
  }
  frame();
}

function celebrate() {
  if (el('atl-win')) return;
  var ov = document.createElement('div');
  ov.id = 'atl-win';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(20,16,10,.74);backdrop-filter:blur(3px)';
  ov.innerHTML =
    '<canvas id="atl-cfx" style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
    '<div style="position:relative;text-align:center;color:#fff;padding:24px">' +
    '<div style="font-size:66px;line-height:1">\uD83C\uDF89</div>' +
    '<div style="font-size:27px;font-weight:800;margin-top:8px">Site termine</div>' +
    '<div style="font-size:14px;opacity:.85;margin-top:6px">' + esc(CLIENT.entreprise || '') + ' est pret a etre livre.</div>' +
    '<div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap">' +
    (SOEMAIL ? '<button class="btn gold" id="atl-notify" onclick="Atelier._notify(this)">Prevenir Louis</button>' : '') +
    '<button class="btn ghost" onclick="Atelier._closeWin()" style="color:#fff;border-color:rgba(255,255,255,.5)">Fermer</button>' +
    '</div>' +
    '<div id="atl-win-count" style="font-size:11.5px;opacity:.6;margin-top:12px"></div>' +
    '</div>';
  document.body.appendChild(ov);
  confetti(el('atl-cfx'));
  var n = 7, cd = el('atl-win-count');
  if (cd) cd.textContent = 'Fermeture automatique dans ' + n + 's';
  WIN_T = setInterval(function () { n--; if (cd) cd.textContent = 'Fermeture automatique dans ' + n + 's'; if (n <= 0) { closeWin(); close(); } }, 1000);
}

function closeWin() { if (WIN_T) { clearInterval(WIN_T); WIN_T = null; } if (CFX_T) { cancelAnimationFrame(CFX_T); CFX_T = null; } var w = el('atl-win'); if (w) w.remove(); }

async function notify(btn) {
  if (!SOEMAIL) { toast('Aucun email de societe configure (Ma societe)', true); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }
  try {
    var r = await fetch('/api/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: SOEMAIL, subject: 'Site termine : ' + (CLIENT.entreprise || ''), body: 'Le site de ' + (CLIENT.entreprise || 'ce client') + ' vient d\'etre termine et valide dans l\'atelier.\nApercu : ' + (lienUrl(LIB_APERCU) || '(lien non renseigne)') }) });
    var d = await r.json();
    if (d && d.error) { toast('Envoi impossible : ' + d.error, true); if (btn) { btn.disabled = false; btn.textContent = 'Prevenir Louis'; } return; }
    toast('Louis a ete prevenu par mail');
    if (btn) btn.textContent = 'Louis prevenu';
  } catch (e) { toast('Envoi impossible', true); if (btn) { btn.disabled = false; btn.textContent = 'Prevenir Louis'; } }
}

function viewSoon() {
  return '<div class="card"><h2>Bientot disponible</h2><div style="font-size:13.5px;color:var(--mut);line-height:1.6">Cette etape (verification intelligente du site section par section, passe sur les textes et les images, controle final) est en cours de construction. On la fait proprement, une etape a la fois.</div></div>' +
    '<div class="atl-foot"><button class="btn ghost" onclick="Atelier._go(1)">&larr; Retour</button><span></span></div>';
}

async function listFiles() {
  var box = el('atl-files'), note = el('atl-files-note');
  if (!box) return;
  var files, errored = false;
  try { var r = await sb().storage.from(BUCKET).list(CLIENT.id, { limit: 200 }); if (r.error) errored = true; } catch (e) { errored = true; }
  files = await listAll();
  if (errored && !files.length) {
    box.innerHTML = '';
    if (note) note.innerHTML = '<div class="hint">Le depot de fichiers n\'est pas encore active (bucket "web-usine"). Le ZIP marchera quand meme avec le brief seul. Pour l\'activer une fois : Supabase &gt; Storage &gt; New bucket &gt; nom <b>web-usine</b> &gt; Public &gt; Create.</div>';
    return;
  }
  if (note) note.innerHTML = '';
  box.innerHTML = files.length ? files.map(function (f) {
    return '<div class="atl-fi"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(f.name) + '">' + esc(f.name) + '</span><span class="chip gray" style="font-size:9.5px">' + esc(folderFor(f.name)) + '</span></div>';
  }).join('') : '<div class="empty" style="grid-column:1/-1;padding:10px">Aucun fichier depose pour ce client. Le ZIP contiendra le brief seul.</div>';
}

/* ── actions ──────────────────────────────────────────────────── */
async function doZip(btn) {
  if (!window.JSZip) { toast('Outil ZIP non charge, recharge la page', true); return; }
  var old = btn.textContent; btn.disabled = true; btn.textContent = 'Preparation...';
  try {
    var zip = new window.JSZip();
    zip.file('brief.txt', buildBriefTxt(CLIENT));
    var files = await listAll();
    for (var i = 0; i < files.length; i++) {
      btn.textContent = 'Ajout ' + (i + 1) + '/' + files.length + '...';
      try {
        var url = sb().storage.from(BUCKET).getPublicUrl(files[i].path).data.publicUrl;
        var resp = await fetch(url);
        if (!resp.ok) continue;
        var blob = await resp.blob();
        zip.file(folderFor(files[i].name) + '/' + files[i].name, blob);
      } catch (e) {}
    }
    btn.textContent = 'Compression...';
    var content = await zip.generateAsync({ type: 'blob' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = 'assets-' + slug(CLIENT.entreprise) + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast(files.length ? (files.length + ' fichier(s) + brief dans le ZIP') : 'ZIP cree (brief seul, aucun fichier depose)');
  } catch (e) { toast('Echec du ZIP : ' + (e.message || e), true); }
  btn.disabled = false; btn.textContent = old;
}

async function doCopy(btn) {
  var txt = buildPrompt(CLIENT);
  try { await navigator.clipboard.writeText(txt); toast('Prompt copie'); return; } catch (e) {}
  var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Prompt copie'); } catch (_) { toast('Copie impossible, ouvre "Voir le prompt" et copie a la main', true); }
  ta.remove();
}

function doClaude() { window.open('https://claude.ai/new', '_blank', 'noopener'); }

async function saveApercu() {
  var v = el('atl-ap') ? el('atl-ap').value.trim() : '';
  await setLien(LIB_APERCU, v);
  toast('Lien enregistre');
  render();
}

function goStep(i) {
  if (i < 0 || i >= STEPS.length) return;
  if (!STEPS[i].active) { toast('Cette etape arrive bientot', false); return; }
  ETAPE = i; saveState(); render();
  var b = el('atl-body'); if (b) b.scrollTop = 0;
}

async function open(clientId) {
  injectCss();
  var c = await sb().from('web_clients').select('*').eq('id', clientId).single();
  if (c.error || !c.data) { toast('Client introuvable', true); return; }
  CLIENT = c.data;
  var l = await sb().from('web_liens').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
  LIENS = l.data || [];
  ETAPE = 0; HDR = {}; SECT = 'header'; ANALYSES = {}; T0 = Date.now(); LOG = [];
  var st = lienRow(LIB_STATE);
  if (st && st.url) { try { var o = JSON.parse(st.url); if (typeof o.etape === 'number') ETAPE = Math.max(0, Math.min(MAX_ACTIVE, o.etape)); if (o.hdr && typeof o.hdr === 'object') HDR = o.hdr; else if (o.header) HDR = { header: o.header }; if (typeof o.t0 === 'number') T0 = o.t0; if (Array.isArray(o.log)) LOG = o.log; } catch (e) {} }
  try { FILES = await listAll(); } catch (e) { FILES = []; }
  try { var _so = await sb().from('web_societe').select('*').limit(1); var _sr = (_so.data && _so.data[0]) || {}; PREFS = _sr.prefs_sites || ''; SOEMAIL = _sr.email || ''; } catch (e) {}

  var f = formuleInfo(CLIENT.valeur_estimee);
  var ov = document.createElement('div');
  ov.id = 'atl-ov';
  ov.innerHTML =
    '<div id="atl-head"><div class="lg">Nova<b>lem</b></div><span class="sep">/</span><div class="cli">Atelier &middot; ' + esc(CLIENT.entreprise || '') + '</div>' +
    '<span class="atl-badge" style="margin-left:4px">' + esc(f.label) + '</span>' +
    '<button id="atl-x" onclick="Atelier._close()" aria-label="Fermer">&times;</button></div>' +
    '<div id="atl-steps"></div>' +
    '<div id="atl-body"><div class="atl-inner" id="atl-inner"></div></div>';
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  render();
}

function close() {
  closeWin();
  var ov = el('atl-ov'); if (ov) ov.remove();
  document.body.style.overflow = '';
  if (typeof window.loadAll === 'function') { try { window.loadAll(); } catch (e) {} }
}

window.Atelier = {
  open: open,
  _close: close,
  _go: goStep,
  _zip: doZip,
  _copy: doCopy,
  _claude: doClaude,
  _saveApercu: saveApercu,
  _final: doFinal,
  _re: function (sect) { logEvent('Correction re-analysee : ' + (sectionLabel(sect) || sect)); saveState(); delete ANALYSES[sect]; showAnalyse(sect); },
  _valider: valider,
  _notify: notify,
  _closeWin: function () { closeWin(); close(); },
  _sect: setSect,
  _hdr: hdrToggle,
  _copyCorr: copyCorr
};
})();
