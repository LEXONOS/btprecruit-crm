// Le panneau de l'aperçu : la barre posée en bas de chaque aperçu, et ce qu'elle ouvre. Fini le bouton qui ouvrait un
// email : le prospect dit ici ce qu'il veut changer (élément par élément, en touchant la partie du site concernée s'il
// veut), dépose toutes ses photos et son logo, et tout arrive directement à la tour (api/apercu.js, lib/sites/retours.js),
// dans la boîte d'Emma. Ou il modifie lui-même, directement sur la page (« Modifier moi-même » : il touche un texte et
// l'écrit autrement, il touche une photo et met la sienne ; enregistré tout de suite, sans IA, lib/sites/edition.js).
// Ou il clique « Je le prends » : 99 € en une fois (la seule offre depuis le 12 nov. 2026), et part sur la page de
// paiement Stripe. Plus gros : Studio Novalem. Sans script, il reste un lien email qui marche (la fiche à compléter).
'use strict';
const F = require('./fiche');
const { NOVALEMO } = require('../config');

const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
const net = function (s) { return String(s == null ? '' : s).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); };
const ic = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + d + '</svg>'; };
const IC = {
  stylo: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  coeur: ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  image: ic('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  doigt: ic('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a5.5 5.5 0 0 1-4.6-2.5L4.4 14a1.4 1.4 0 0 1 2.2-1.7L9 14.5"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  fleche: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  cadenas: ic('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>')
};

// les parties du site qu'on peut viser : celles de la page, puis les réglages d'ensemble
const NOMS = { nav: 'En-tête', hero: 'Haut de page', services: 'Services', apropos: 'Présentation', galerie: 'Photos', avis: 'Avis', faq: 'Questions', contact: 'Contact', pied: 'Bas de page' };
const ZONE = { nav: 'haut', hero: 'haut', services: 'services', apropos: 'apropos', galerie: 'galerie', avis: 'avis', faq: 'faq', contact: 'contact', pied: 'pied' };
function parties(ctx) {
  const vues = [], deja = {};
  ((ctx.compo && ctx.compo.blocs) || []).forEach(function (b) { if (NOMS[b.rubrique] && !deja[b.rubrique] && b.rubrique !== 'nav') { deja[b.rubrique] = 1; vues.push({ zone: ZONE[b.rubrique], nom: NOMS[b.rubrique] }); } });
  return vues.concat([{ zone: 'couleurs', nom: 'Couleurs' }, { zone: 'textes', nom: 'Textes' }, { zone: 'logo', nom: 'Logo' }, { zone: 'autre', nom: 'Autre chose' }]);
}

function html(spec, ctx) {
  const nom = net(spec.nom);
  const r = ctx.retour || null;
  const illus = (ctx.photos || []).some(function (x) { return x.credit; });
  const g = NOVALEMO.grille.essentiel, mois = NOVALEMO.abonnement.engagement_mois, an = NOVALEMO.hebergement_an_eur;
  const studio = NOVALEMO.studio || { nom: 'Studio Novalem', url: 'https://studionovalem.fr' };
  const manque = F.manque(spec).filter(function (x) { return x.champ && x.cle !== 'services' && x.cle !== 'objectif'; }).slice(0, 4);
  const mailto = ctx.contactNovalemo ? 'mailto:' + ctx.contactNovalemo + '?subject=' + encodeURIComponent('Je veux ce site : ' + nom) + '&body=' + encodeURIComponent(F.corpsMailto(spec)) : '';
  const lienMail = mailto ? '<a class="ap-mail" href="' + esc(mailto) + '">Vous préférez l\'email ? Écrivez-nous</a>' : '';
  const barre = '<div class="ap-barre"><p class="ap-txt"><b>Votre site : ' + g.prix + ' €<span class="ap-court">, et il est à vous</span>.</b><span class="ap-long"> Aperçu préparé pour ' + esc(nom) + '. ' + (illus ? 'Photos d\'illustration, à remplacer par les vôtres. ' : '') + 'Tout est modifiable : touchez Modifier.</span></p>' +
    (r ? '<div class="ap-act"><button type="button" class="ap-b ap-b2 ap-b2-txt" data-ap-ouvre="retouches">' + IC.stylo + '<span>Modifier</span></button><button type="button" class="ap-b ap-b1" data-ap-ouvre="commande"><span>Je le prends</span>' + IC.fleche + '</button></div>' : (mailto ? '<div class="ap-act"><a class="ap-b ap-b1" href="' + esc(mailto) + '"><span>Je veux ce site</span></a></div>' : '')) + '</div>';
  if (!r && ctx.vendu) {
    // payé : plus rien à vendre ; une retouche passe par l'email (Emma vérifie que c'est bien lui)
    const mailRetouche = ctx.contactNovalemo ? 'mailto:' + ctx.contactNovalemo + '?subject=' + encodeURIComponent('Retouche : ' + nom) : '';
    return '<aside class="apercu" role="note"><div class="ap-barre"><p class="ap-txt"><b>Votre site est commandé.</b><span class="ap-long"> Il se met en ligne sur votre nom de domaine, tout vous arrive par email.</span></p>' + (mailRetouche ? '<div class="ap-act"><a class="ap-b ap-b2 ap-b2-txt" href="' + esc(mailRetouche) + '">' + IC.stylo + '<span>Une retouche</span></a></div>' : '') + '</div></aside>';
  }
  if (!r) return '<aside class="apercu" role="note">' + barre + '</aside>';
  const chips = parties(ctx).map(function (p) { return '<button type="button" class="ap-chip" data-ap-zone="' + esc(p.zone) + '" data-ap-nom="' + esc(p.nom) + '">' + IC.plus + '<span>' + esc(p.nom) + '</span></button>'; }).join('');
  const champs = manque.map(function (x, k) { return '<label class="ap-champ"><span>' + esc(x.champ.replace(/\s*:\s*$/, '')) + ' <i>facultatif</i></span><input type="text" data-ap-info="' + esc(x.champ.replace(/\s*:\s*$/, '')) + '" autocomplete="off"></label>'; }).join('');
  const retouches = '<form class="ap-pan" data-ap-pan="retouches" novalidate>' +
    '<div class="ap-tete"><h2>Votre site, à votre façon</h2><p>Changez vous-même les textes et les photos, directement sur la page : c\'est enregistré tout de suite.</p></div>' +
    '<button type="button" class="ap-b ap-b1 ap-editer" data-ap-editer>' + IC.stylo + '<span>Modifier moi-même, sur la page</span></button>' +
    '<p class="ap-ou"><span>ou dites-nous ce que vous voulez</span></p>' +
    '<div class="ap-tete ap-tete2"><h3>Qu\'est-ce qu\'on change ?</h3><p>Touchez une partie du site, ou choisissez-la ci-dessous, et dites-nous ce que vous voulez. On s\'occupe du reste.</p></div>' +
    '<button type="button" class="ap-viser" data-ap-viser>' + IC.doigt + '<span>Montrer sur la page</span></button>' +
    '<div class="ap-chips">' + chips + '</div>' +
    '<ol class="ap-elems" data-ap-elems aria-live="polite"></ol>' +
    '<div class="ap-depot" data-ap-depot tabindex="0" role="button" aria-label="Ajouter des photos ou votre logo">' + IC.image + '<b>Glissez ici vos photos et votre logo</b><span>ou touchez pour les choisir, autant que vous voulez</span><input type="file" accept="image/*" multiple data-ap-fichiers hidden></div>' +
    '<ul class="ap-vignettes" data-ap-vignettes></ul>' +
    (champs ? '<details class="ap-plus"><summary>Pour finir votre site, il nous manque peut-être</summary><div class="ap-champs">' + champs + '</div></details>' : '') +
    '<label class="ap-champ ap-libre"><span>Un message, une précision <i>facultatif</i></span><textarea rows="3" data-ap-message></textarea></label>' +
    '<div class="ap-qui"><label class="ap-champ"><span>Votre email</span><input type="email" required autocomplete="email" inputmode="email" data-ap-email placeholder="vous@exemple.fr"></label><label class="ap-champ"><span>WhatsApp ou téléphone <i>facultatif</i></span><input type="tel" autocomplete="tel" inputmode="tel" data-ap-tel></label></div>' +
    '<p class="ap-err" data-ap-err role="alert"></p>' +
    '<button type="submit" class="ap-b ap-b1 ap-envoi" data-ap-envoi><span>Envoyer mes retouches</span>' + IC.fleche + '</button>' +
    '<p class="ap-note">On applique vos retouches sur ce même lien et on vous prévient par email. ' + NOVALEMO.revisions_avant + ' séries de retouches sont incluses avant la mise en ligne.</p>' + lienMail +
    '</form>';
  const offre = function (mode, prix, unite, sous, details, cta) {
    return '<button type="button" class="ap-offre" data-ap-offre="' + mode + '" aria-pressed="false"><span class="ap-o-h"><b>' + prix + '</b><span>' + unite + '</span></span><span class="ap-o-s">' + sous + '</span><span class="ap-o-d">' + details + '</span><span class="ap-o-c" data-cta="' + esc(cta) + '"></span></button>';
  };
  const commande = '<div class="ap-pan" data-ap-pan="commande" hidden>' +
    '<div class="ap-tete"><h2>Votre site en ligne, sur votre nom de domaine</h2><p>' + (g.mois ? 'Choisissez comment payer.' : g.prix + ' € en une fois, sans abonnement.') + ' La mise en ligne se fait toute seule, en général dans l\'heure qui suit le paiement.</p></div>' +
    '<div class="ap-offres' + (g.mois ? '' : ' un') + '">' +
    offre('une_fois', g.prix + ' €', 'en une fois', 'Sans abonnement', 'Nom de domaine et hébergement inclus la première année, puis ' + an + ' € par an.', 'Payer ' + g.prix + ' €') +
    (g.mois ? offre('mensuel', g.mois + ' €', 'par mois', 'Pendant ' + mois + ' mois, puis plus rien', 'Le site reste à vous. Hébergement, nom de domaine et une retouche par mois inclus.', 'Payer le premier mois, ' + g.mois + ' €') : '') +
    '</div>' +
    '<ul class="ap-inclus"><li>' + IC.coeur + 'Site complet, sur ordinateur et téléphone</li><li>' + IC.coeur + 'Mentions légales en règle</li><li>' + IC.coeur + 'Vos retouches, avant comme après la mise en ligne</li></ul>' +
    '<div class="ap-attente" data-ap-attente hidden><p data-ap-attente-txt></p><label class="ap-champ"><span>Votre email</span><input type="email" autocomplete="email" inputmode="email" data-ap-email2 placeholder="vous@exemple.fr"></label></div>' +
    '<p class="ap-err" data-ap-err2 role="alert"></p>' +
    '<button type="button" class="ap-b ap-b1 ap-envoi" data-ap-payer disabled><span data-ap-payer-txt>Choisissez une formule</span>' + IC.cadenas + '</button>' +
    '<p class="ap-note">Paiement sécurisé par Stripe. Vous indiquez le nom de domaine souhaité sur la page de paiement (ou on vous en réserve un). <a href="/_n/cgv/" target="_blank" rel="noopener">Conditions de vente</a>.</p>' +
    '<button type="button" class="ap-lien" data-ap-ouvre="retouches">Il me faut d\'abord quelques retouches</button>' +
    '<p class="ap-studio">Un projet plus complet (plusieurs pages, réservation en ligne, boutique) ? <a href="' + esc(studio.url) + '" target="_blank" rel="noopener">' + esc(studio.nom) + '</a> s\'en occupe, sur devis.</p>' +
    '</div>';
  const fini = '<div class="ap-pan ap-fini" data-ap-pan="fini" hidden>' + IC.coeur + '<h2 data-ap-fini-t>C\'est bien reçu.</h2><p data-ap-fini-p>On applique vos retouches sur ce même lien et on vous écrit dès que c\'est prêt.</p><div class="ap-fini-a"><button type="button" class="ap-b ap-b1" data-ap-ouvre="commande" data-ap-fini-prendre hidden><span>Je le prends, ' + g.prix + ' €</span>' + IC.fleche + '</button><button type="button" class="ap-b ap-b2" data-ap-ferme>Revoir mon site</button></div></div>';
  const edition = '<div class="ap-pan" data-ap-pan="edition" hidden><div class="ap-tete"><h2>On enregistre vos changements ?</h2><p data-ap-ed-resume></p></div>' +
    '<label class="ap-champ"><span>Votre email</span><input type="email" autocomplete="email" inputmode="email" data-ap-email3 placeholder="vous@exemple.fr"></label>' +
    '<p class="ap-err" data-ap-err3 role="alert"></p>' +
    '<button type="button" class="ap-b ap-b1 ap-envoi" data-ap-ed-envoi><span>Enregistrer mes changements</span>' + IC.fleche + '</button>' +
    '<p class="ap-note">Vos changements restent sur ce même lien. Rien n\'est mis en ligne sur votre nom de domaine sans votre accord.</p>' +
    '<button type="button" class="ap-lien" data-ap-ed-reprendre>Continuer à modifier</button></div>';
  const outils = '<div class="ap-outils" data-ap-outils hidden><p><b>Vous modifiez votre site.</b><span> Touchez un texte pour l\'écrire autrement, ou « Changer la photo » pour mettre la vôtre.</span></p><div class="ap-o-a"><button type="button" class="ap-o-b" data-ap-ed-annule>Annuler</button><button type="button" class="ap-o-b ap-o-ok" data-ap-ed-ok>Enregistrer</button></div><p class="ap-o-msg" data-ap-ed-msg role="status" hidden></p><input type="file" accept="image/*" data-ap-ed-fichier hidden></div>';
  const dlg = '<dialog class="ap-dlg" data-ap-dlg aria-label="Votre site"><div class="ap-feuille"><div class="ap-haut"><div class="ap-onglets" role="tablist"><button type="button" role="tab" data-ap-tab="retouches" aria-selected="true">Modifier</button><button type="button" role="tab" data-ap-tab="commande" aria-selected="false">Je le prends</button></div><button type="button" class="ap-x" data-ap-ferme aria-label="Fermer">' + IC.x + '</button></div><div class="ap-corps">' + retouches + commande + edition + fini + '</div></div></dialog>';
  const viser = '<div class="ap-visee" data-ap-visee hidden><span>Touchez la partie du site à modifier</span><button type="button" data-ap-annule>Annuler</button></div>';
  return '<aside class="apercu" data-apercu data-api="' + esc(r.api) + '" data-site="' + esc(r.site) + '" data-cle="' + esc(r.jeton) + '" data-prix="' + esc(g.prix) + '" aria-label="Aperçu de votre site">' + barre + dlg + viser + outils + '</aside>';
}

// la feuille : neutre (les couleurs de Novalemo, pas celles du site), lisible partout, rien n'en sort
const CSS = `
.apercu{position:fixed;left:0;right:0;bottom:14px;margin:0 auto;z-index:80;width:min(860px,calc(100% - 20px));font:500 15px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14161a;-webkit-font-smoothing:antialiased}
.apercu *,.apercu *::before,.apercu *::after{box-sizing:border-box}
.ap-barre{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 10px 10px 20px;border-radius:18px;background:rgb(255 255 255 / .9);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border:1px solid rgb(20 22 26 / .1);box-shadow:0 1px 2px rgb(20 22 26 / .06),0 22px 50px -18px rgb(20 22 26 / .38);animation:k-ap-monte .9s cubic-bezier(.16,1,.3,1) .6s both}
@keyframes k-ap-monte{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.ap-txt{margin:0;font-size:.92rem;color:#3d424b}.ap-txt b{color:#14161a;font-weight:700}
.ap-act{display:flex;gap:8px;flex:none}
.ap-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:13px;border:1px solid transparent;font:inherit;font-weight:700;font-size:.95rem;cursor:pointer;text-decoration:none;-webkit-tap-highlight-color:transparent;transition:transform .35s cubic-bezier(.16,1,.3,1),background-color .25s,box-shadow .35s,opacity .25s}
.ap-b svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .35s cubic-bezier(.16,1,.3,1)}
.ap-b1{background:#14161a;color:#fff}.ap-b1:hover{box-shadow:0 12px 26px -12px rgb(20 22 26 / .6);transform:translateY(-1px)}.ap-b1:hover svg{transform:translateX(3px)}
.ap-b2{background:#fff;color:#14161a;border-color:rgb(20 22 26 / .16)}.ap-b2:hover{border-color:rgb(20 22 26 / .4)}
@media(max-width:640px){.apercu .ap-b2-txt span{display:inline}.apercu .ap-b2-txt{width:auto;padding:0 13px}}
@media(max-width:640px){.ap-court{display:none}}
@media(max-width:430px){.ap-act{gap:6px}.apercu .ap-act .ap-b{padding:0 11px}.ap-act .ap-b1 svg{display:none}.ap-barre{gap:10px}}
.ap-b:active{transform:scale(.97)}
.ap-b[disabled]{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
@media(max-width:640px){.apercu{bottom:8px;width:calc(100% - 14px)}.ap-barre{padding:9px 9px 9px 14px;border-radius:16px}.ap-long{display:none}.ap-txt{font-size:.86rem}.ap-b{min-height:44px;padding:0 13px}.ap-b2 span{display:none}.ap-b2{width:44px;padding:0}}
.a-apercu footer.r,.a-apercu .pied{padding-bottom:120px}
.ap-dlg{border:0;padding:0;margin:auto auto 0;width:min(640px,100%);max-height:min(92vh,880px);max-height:min(92dvh,880px);background:transparent;color:inherit;overflow:visible}
.ap-dlg::backdrop{background:rgb(15 17 21 / .42);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.ap-dlg[open]{animation:k-ap-feuille .6s cubic-bezier(.16,1,.3,1)}
@keyframes k-ap-feuille{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@media(min-width:700px){.ap-dlg{margin:auto}}
.ap-feuille{display:flex;flex-direction:column;max-height:inherit;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -10px 60px -20px rgb(0 0 0 / .4);overflow:hidden}
@media(min-width:700px){.ap-feuille{border-radius:24px}}
.ap-haut{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 14px 10px 18px;border-bottom:1px solid #eceef1}
.ap-onglets{display:flex;gap:4px;padding:4px;background:#f2f3f5;border-radius:12px}
.ap-onglets button{border:0;background:transparent;font:inherit;font-weight:650;font-size:.92rem;color:#5b616b;padding:9px 14px;border-radius:9px;cursor:pointer;transition:background-color .25s,color .25s}
.ap-onglets button[aria-selected=true]{background:#fff;color:#14161a;box-shadow:0 1px 3px rgb(20 22 26 / .12)}
.ap-x{width:40px;height:40px;border-radius:12px;border:0;background:#f2f3f5;display:grid;place-items:center;cursor:pointer}.ap-x svg{width:18px;height:18px;fill:none;stroke:#14161a;stroke-width:2;stroke-linecap:round}
.ap-corps{overflow:auto;overscroll-behavior:contain;padding:18px 20px 22px}
.ap-pan{display:grid;gap:16px}.ap-pan[hidden]{display:none}
.ap-tete h2{margin:0 0 6px;font-size:1.32rem;line-height:1.2;letter-spacing:-.02em;color:#14161a}
.ap-tete p{margin:0;color:#5b616b}
.ap-viser{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:52px;border:1.5px dashed #c9ccd3;border-radius:14px;background:#fafbfc;font:inherit;font-weight:650;color:#14161a;cursor:pointer;transition:border-color .25s,background-color .25s}
.ap-viser:hover{border-color:#14161a;background:#f4f5f7}
.ap-viser svg,.ap-chip svg,.ap-depot svg,.ap-fini svg,.ap-inclus svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ap-viser svg{width:22px;height:22px}
.ap-chips{display:flex;flex-wrap:wrap;gap:8px}
.ap-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #dfe2e7;background:#fff;border-radius:999px;padding:8px 13px 8px 10px;font:inherit;font-size:.88rem;font-weight:600;color:#30343b;cursor:pointer;transition:border-color .2s,background-color .2s,transform .3s cubic-bezier(.16,1,.3,1)}
.ap-chip svg{width:15px;height:15px}.ap-chip:hover{border-color:#14161a}.ap-chip:active{transform:scale(.96)}
.ap-elems{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.ap-elem{border:1px solid #e3e6ea;border-radius:16px;padding:12px 12px 12px 14px;background:#fff;animation:k-ap-elem .45s cubic-bezier(.16,1,.3,1)}
@keyframes k-ap-elem{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ap-elem-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.ap-elem-h b{font-size:.95rem}
.ap-elem-h button{border:0;background:#f2f3f5;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;cursor:pointer}.ap-elem-h svg{width:14px;height:14px;fill:none;stroke:#14161a;stroke-width:2;stroke-linecap:round}
.ap-elem textarea,.ap-champ input,.ap-champ textarea{width:100%;font:inherit;font-weight:450;font-size:16px;color:#14161a;border:1px solid #d9dce2;border-radius:12px;padding:11px 12px;background:#fff;resize:vertical;transition:border-color .2s,box-shadow .2s}
.ap-elem textarea:focus,.ap-champ input:focus,.ap-champ textarea:focus{outline:0;border-color:#14161a;box-shadow:0 0 0 3px rgb(20 22 26 / .1)}
.ap-depot{display:grid;justify-items:center;gap:4px;text-align:center;padding:22px 16px;border:1.5px dashed #c9ccd3;border-radius:18px;background:linear-gradient(180deg,#fafbfc,#f4f5f7);cursor:pointer;transition:border-color .25s,background-color .25s,transform .3s}
.ap-depot svg{width:30px;height:30px;color:#14161a;margin-bottom:4px}
.ap-depot b{font-size:.98rem}.ap-depot span{font-size:.86rem;color:#6b717b}
.ap-depot.sur,.ap-depot:hover{border-color:#14161a;background:#f0f1f4}
.ap-depot.sur{transform:scale(1.01)}
.ap-vignettes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
.ap-vignettes:empty{display:none}
.ap-vig{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#eef0f3}
.ap-vig img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .3s,filter .3s}
.ap-vig.charge img{opacity:.55;filter:grayscale(.4)}
.ap-vig .ap-jauge{position:absolute;left:8px;right:8px;bottom:8px;height:4px;border-radius:4px;background:rgb(255 255 255 / .6);overflow:hidden}.ap-vig .ap-jauge i{display:block;height:100%;width:var(--p,8%);background:#14161a;transition:width .3s}
.ap-vig:not(.charge) .ap-jauge{display:none}
.ap-vig.erreur::after{content:"Échec";position:absolute;inset:auto 6px 6px;background:#b42318;color:#fff;font-size:.72rem;font-weight:700;border-radius:6px;padding:2px 6px;text-align:center}
.ap-vig button{position:absolute;border:0;cursor:pointer;font:inherit}
.ap-vig .ap-suppr{top:6px;right:6px;width:26px;height:26px;border-radius:8px;background:rgb(255 255 255 / .92);display:grid;place-items:center}.ap-vig .ap-suppr svg{width:13px;height:13px;fill:none;stroke:#14161a;stroke-width:2.2;stroke-linecap:round}
.ap-vig .ap-logo{left:6px;top:6px;padding:3px 7px;border-radius:7px;background:rgb(255 255 255 / .92);font-size:.72rem;font-weight:700;color:#5b616b}
.ap-vig .ap-logo[aria-pressed=true]{background:#14161a;color:#fff}
.ap-plus{border:1px solid #e3e6ea;border-radius:16px;padding:0 14px}
.ap-plus summary{cursor:pointer;font-weight:650;padding:14px 0;list-style:none}.ap-plus summary::-webkit-details-marker{display:none}
.ap-plus summary::after{content:"+";float:right;font-weight:500;font-size:1.2rem;line-height:1}.ap-plus[open] summary::after{content:"–"}
.ap-champs{display:grid;gap:12px;padding-bottom:14px}
.ap-champ{display:grid;gap:6px}
.ap-champ>span{font-size:.88rem;font-weight:650;color:#30343b}.ap-champ i{font-style:normal;font-weight:500;color:#8a909a}
.ap-qui{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:560px){.ap-qui{grid-template-columns:1fr}}
.ap-err{margin:0;color:#b42318;font-weight:600;font-size:.9rem}.ap-err:empty{display:none}
.ap-envoi{width:100%;min-height:54px;font-size:1rem}
.ap-note{margin:0;font-size:.84rem;color:#6b717b}.ap-note a{color:inherit}
.ap-mail{font-size:.84rem;color:#6b717b;text-align:center}
.ap-offres{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:520px){.ap-offres{grid-template-columns:1fr}}
.ap-offre{display:grid;gap:6px;text-align:left;border:1.5px solid #dfe2e7;border-radius:18px;padding:16px;background:#fff;font:inherit;color:#14161a;cursor:pointer;transition:border-color .25s,box-shadow .35s,transform .35s cubic-bezier(.16,1,.3,1)}
.ap-offre:hover{border-color:#9aa0aa;transform:translateY(-2px)}
.ap-offre[aria-pressed=true]{border-color:#14161a;box-shadow:0 0 0 3px rgb(20 22 26 / .1),0 18px 34px -22px rgb(20 22 26 / .5)}
.ap-o-h{display:flex;align-items:baseline;gap:6px}.ap-o-h b{font-size:2rem;letter-spacing:-.03em;line-height:1}.ap-o-h span{color:#5b616b;font-weight:600}
.ap-o-s{font-weight:700}.ap-o-d{font-size:.86rem;color:#5b616b;line-height:1.45}
.ap-inclus{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:.92rem;color:#30343b}
.ap-inclus li{display:flex;align-items:center;gap:10px}.ap-inclus svg{width:18px;height:18px;flex:none;color:#16794a}
.ap-attente{display:grid;gap:10px;padding:14px;border-radius:14px;background:#f4f5f7}.ap-attente[hidden]{display:none}.ap-attente p{margin:0;font-weight:600}
.ap-lien{border:0;background:none;font:inherit;font-size:.9rem;font-weight:600;color:#30343b;text-decoration:underline;text-underline-offset:3px;cursor:pointer;justify-self:center;padding:6px}
.ap-fini{justify-items:center;text-align:center;padding:26px 0 8px}.ap-fini svg{width:54px;height:54px;padding:12px;border-radius:50%;background:#e7f6ee;color:#16794a}.ap-fini h2{margin:0;font-size:1.5rem;letter-spacing:-.02em}.ap-fini p{margin:0;color:#5b616b;max-width:40ch}
.ap-visee{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:95;display:flex;align-items:center;gap:12px;padding:10px 10px 10px 18px;border-radius:14px;background:#14161a;color:#fff;font-weight:600;box-shadow:0 18px 40px -16px rgb(0 0 0 / .5);white-space:nowrap}
.ap-visee[hidden]{display:none}
.ap-visee button{border:0;border-radius:10px;padding:8px 12px;background:rgb(255 255 255 / .14);color:#fff;font:inherit;cursor:pointer}
body.ap-choix main section,body.ap-choix header.r,body.ap-choix footer.r{cursor:crosshair}
body.ap-choix .ap-cible{outline:3px solid #2f6bff;outline-offset:-3px;box-shadow:inset 0 0 0 9999px rgb(47 107 255 / .07)}
.ap-editer{width:100%;min-height:54px;font-size:1rem}
.ap-ou{display:flex;align-items:center;gap:12px;margin:2px 0 0;color:#8a909a;font-size:.86rem;font-weight:600}.ap-ou::before,.ap-ou::after{content:"";flex:1;height:1px;background:#e3e6ea}
.ap-tete2 h3{margin:0 0 4px;font-size:1.08rem;letter-spacing:-.01em;color:#14161a}.ap-tete2 p{margin:0;color:#5b616b;font-size:.92rem}
.ap-offres.un{grid-template-columns:1fr}
.ap-studio{margin:0;padding:12px 14px;border-radius:14px;background:#f4f5f7;font-size:.88rem;color:#3d424b;text-align:center}.ap-studio a{color:#14161a;font-weight:700}
.ap-fini-a{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.ap-fini-a [hidden]{display:none}
body.ap-edition .ap-barre{display:none}
.ap-outils{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:96;width:min(860px,calc(100% - 20px));display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px 10px 16px;border-radius:16px;background:#14161a;color:#fff;box-shadow:0 18px 40px -16px rgb(0 0 0 / .55);font:500 14px/1.35 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.ap-outils[hidden]{display:none}.ap-outils p{margin:0;flex:1 1 260px}.ap-outils p span{color:#c9ccd3}
.ap-o-a{display:flex;gap:8px;flex:none}
.ap-o-b{border:0;border-radius:11px;min-height:42px;padding:0 15px;font:inherit;font-weight:700;cursor:pointer;background:rgb(255 255 255 / .14);color:#fff}
.ap-o-ok{background:#fff;color:#14161a}
.ap-outils .ap-o-msg{flex:1 1 100%;margin:0;padding:8px 10px;border-radius:10px;background:rgb(255 255 255 / .1);font-size:.86rem}.ap-o-msg[hidden]{display:none}
@media(max-width:640px){.ap-outils{top:8px;width:calc(100% - 14px)}.ap-outils p span{display:none}}
body.ap-edition .ap-ed{outline:2px dashed rgb(47 107 255 / .5);outline-offset:3px;border-radius:3px;cursor:text;transition:outline-color .2s,background-color .2s}
body.ap-edition .ap-ed:hover{outline-color:#2f6bff}
body.ap-edition .ap-ed:focus{outline:2px solid #2f6bff;background:rgb(47 107 255 / .07)}
body.ap-edition .ap-ed-img{cursor:pointer;outline:3px dashed rgb(47 107 255 / .7);outline-offset:-3px}
body.ap-edition .ap-ed-charge{opacity:.5;filter:grayscale(.5)}
.ap-calque{position:absolute;left:0;top:0;width:0;height:0;z-index:79}
.ap-pastille{position:absolute;box-sizing:border-box;width:max-content;display:inline-flex;align-items:center;gap:7px;min-height:38px;margin:0;padding:0 14px;border:0;border-radius:999px;background:#14161a;color:#fff;font:700 13px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:0;text-transform:none;white-space:nowrap;box-shadow:0 10px 24px -10px rgb(0 0 0 / .6);cursor:pointer;-webkit-tap-highlight-color:transparent}
.ap-pastille svg{flex:none;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ap-pastille:hover{background:#2f6bff}
@media(prefers-reduced-motion:reduce){.ap-barre,.ap-dlg[open],.ap-elem{animation:none}}
`;

// le comportement : isolé (voit w, d, b, calme), rien ne part sans un geste de la personne
const SCRIPT = `
var ap=d.querySelector('[data-apercu]');if(!ap)return;
var api=ap.getAttribute('data-api'),site=ap.getAttribute('data-site'),cle=ap.getAttribute('data-cle');
var dlg=ap.querySelector('[data-ap-dlg]');if(!dlg||!dlg.showModal||!w.fetch)return;
var q=function(s,r){return (r||ap).querySelector(s)},qa=function(s,r){return [].slice.call((r||ap).querySelectorAll(s))};
var pans=qa('[data-ap-pan]'),tabs=qa('[data-ap-tab]');
var moi=false;try{if(/[?&]tour=1(&|$)/.test(w.location.search))w.localStorage.setItem('nv-tour','1');moi=w.localStorage.getItem('nv-tour')==='1'}catch(e){}
var vus={};var signal=function(quoi,paiement){if(moi||vus[quoi])return;vus[quoi]=1;try{fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'vu',quoi:quoi,paiement:paiement||null,site:site,cle:cle}),keepalive:true}).catch(function(){})}catch(e){}};
var voir=function(p){pans.forEach(function(x){x.hidden=x.getAttribute('data-ap-pan')!==p});tabs.forEach(function(t){t.setAttribute('aria-selected',t.getAttribute('data-ap-tab')===p?'true':'false')});var c=q('.ap-corps');if(c)c.scrollTop=0;if(p==='retouches'||p==='commande')signal(p)};
var ouvrir=function(p){voir(p||'retouches');if(!dlg.open)dlg.showModal()};
qa('[data-ap-ouvre]').forEach(function(x){x.addEventListener('click',function(){ouvrir(x.getAttribute('data-ap-ouvre'))})});
tabs.forEach(function(t){t.addEventListener('click',function(){voir(t.getAttribute('data-ap-tab'))})});
qa('[data-ap-ferme]').forEach(function(x){x.addEventListener('click',function(){dlg.close()})});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close()});
var envoyer=function(corps){corps.site=site;corps.cle=cle;return fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(corps)}).then(function(r){return r.json().catch(function(){return {erreur:'réponse illisible'}}).then(function(j){if(!r.ok&&!j.erreur)j.erreur='erreur '+r.status;return j})}).catch(function(){return {erreur:'pas de connexion, réessayez'}})};
/* les éléments à changer */
var liste=q('[data-ap-elems]');
var ajouter=function(zone,nom,texte){var li=d.createElement('li');li.className='ap-elem';li.setAttribute('data-zone',zone);li.setAttribute('data-nom',nom);li.innerHTML='<div class="ap-elem-h"><b></b><button type="button" aria-label="Retirer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><textarea rows="2" placeholder="Ce que vous voulez changer ici"></textarea>';li.querySelector('b').textContent=nom;var ta=li.querySelector('textarea');if(texte)ta.value=texte;li.querySelector('button').addEventListener('click',function(){li.remove()});liste.appendChild(li);setTimeout(function(){ta.focus()},80);return li};
qa('[data-ap-zone]').forEach(function(c){c.addEventListener('click',function(){ajouter(c.getAttribute('data-ap-zone'),c.getAttribute('data-ap-nom'))})});
/* viser une partie de la page */
var NOMS={nav:'En-tête',hero:'Haut de page',services:'Services',apropos:'Présentation',galerie:'Photos',avis:'Avis',faq:'Questions',contact:'Contact',pied:'Bas de page'};
var ZONES={nav:'haut',hero:'haut',services:'services',apropos:'apropos',galerie:'galerie',avis:'avis',faq:'faq',contact:'contact',pied:'pied'};
var visee=q('[data-ap-visee]'),cible=null;
var partieDe=function(el){while(el&&el!==b){if(el.classList&&el.classList.contains('r')){var m=(el.className.match(/\\br-(nav|hero|services|apropos|galerie|avis|faq|contact|pied)-/)||[])[1];if(m)return {el:el,r:m}}el=el.parentElement}return null};
var finVisee=function(){b.classList.remove('ap-choix');visee.hidden=true;if(cible)cible.classList.remove('ap-cible');cible=null;d.removeEventListener('pointerover',survol,true);d.removeEventListener('click',choisir,true);d.removeEventListener('keydown',echap,true)};
var survol=function(e){if(ap.contains(e.target))return;var p=partieDe(e.target);if(cible&&(!p||p.el!==cible))cible.classList.remove('ap-cible');cible=p?p.el:null;if(cible)cible.classList.add('ap-cible')};
var choisir=function(e){if(ap.contains(e.target))return;e.preventDefault();e.stopPropagation();var p=partieDe(e.target);if(!p)return;finVisee();ouvrir('retouches');ajouter(ZONES[p.r],NOMS[p.r])};
var echap=function(e){if(e.key==='Escape'){e.preventDefault();finVisee();ouvrir('retouches')}};
var bv=q('[data-ap-viser]');if(bv)bv.addEventListener('click',function(){dlg.close();b.classList.add('ap-choix');visee.hidden=false;d.addEventListener('pointerover',survol,true);d.addEventListener('click',choisir,true);d.addEventListener('keydown',echap,true)});
q('[data-ap-annule]').addEventListener('click',function(e){e.stopPropagation();finVisee();ouvrir('retouches')});
/* les images : réduites dans le navigateur (2000 px, JPEG), envoyées une à une dès qu'elles sont posées */
var depot=q('[data-ap-depot]'),inp=q('[data-ap-fichiers]'),vigs=q('[data-ap-vignettes]'),envois=[],images=[];
var reduire=function(f){return new Promise(function(ok,ko){var u=URL.createObjectURL(f),im=new Image();im.onload=function(){var m=2000,k=Math.min(1,m/Math.max(im.naturalWidth,im.naturalHeight)),cv=d.createElement('canvas');cv.width=Math.max(1,Math.round(im.naturalWidth*k));cv.height=Math.max(1,Math.round(im.naturalHeight*k));var cx=cv.getContext('2d');var png=f.type==='image/png'&&f.size<2400000;if(!png){cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height)}cx.drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);cv.toBlob(function(bl){if(!bl)return ko();var r=new FileReader();r.onload=function(){ok({type:png?'image/png':'image/jpeg',donnees:String(r.result).split(',')[1],apercu:cv.toDataURL('image/jpeg',.6)})};r.onerror=ko;r.readAsDataURL(bl)},png?'image/png':'image/jpeg',.86)};im.onerror=function(){URL.revokeObjectURL(u);ko()};im.src=u})};
var poser=function(f){if(!/^image\\//.test(f.type||'')&&!/\\.(jpe?g|png|webp|heic|heif)$/i.test(f.name||''))return;var li=d.createElement('li');li.className='ap-vig charge';li.innerHTML='<img alt=""><span class="ap-jauge"><i></i></span><button type="button" class="ap-logo" aria-pressed="false">Logo</button><button type="button" class="ap-suppr" aria-label="Retirer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';vigs.appendChild(li);var x={li:li,id:null,logo:/logo/i.test(f.name||'')};var lg=li.querySelector('.ap-logo');lg.setAttribute('aria-pressed',x.logo?'true':'false');lg.addEventListener('click',function(){x.logo=!x.logo;lg.setAttribute('aria-pressed',x.logo?'true':'false')});li.querySelector('.ap-suppr').addEventListener('click',function(){x.retire=1;li.remove()});images.push(x);var jg=li.querySelector('.ap-jauge i');var t=setInterval(function(){var v=parseFloat(jg.style.getPropertyValue('--p'))||8;if(v<88)jg.style.setProperty('--p',(v+6)+'%')},250);
var p=reduire(f).then(function(r){li.querySelector('img').src=r.apercu;return envoyer({action:'image',type:r.type,donnees:r.donnees,nom:f.name||'image',logo:x.logo})}).then(function(j){clearInterval(t);li.classList.remove('charge');if(j&&j.id){x.id=j.id}else{li.classList.add('erreur');x.erreur=(j&&j.erreur)||'échec';li.title=x.erreur;if(!err.textContent)err.textContent='Une image n\\'est pas passée : '+x.erreur+'.'}}).catch(function(){clearInterval(t);li.classList.remove('charge');li.classList.add('erreur');x.erreur='image illisible';li.title=x.erreur});envois.push(p)};
var poserTout=function(fl){[].slice.call(fl||[]).slice(0,40).forEach(poser)};
depot.addEventListener('click',function(){inp.click()});depot.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}});
inp.addEventListener('change',function(){poserTout(inp.files);inp.value=''});
['dragenter','dragover'].forEach(function(n){depot.addEventListener(n,function(e){e.preventDefault();depot.classList.add('sur')})});
['dragleave','drop'].forEach(function(n){depot.addEventListener(n,function(e){e.preventDefault();depot.classList.remove('sur')})});
depot.addEventListener('drop',function(e){if(e.dataTransfer)poserTout(e.dataTransfer.files)});
/* l'envoi des retouches */
var form=q('[data-ap-pan=retouches]'),err=q('[data-ap-err]'),be=q('[data-ap-envoi]');
var fini=function(t,p,vendre){var a=q('[data-ap-fini-t]'),c=q('[data-ap-fini-p]'),pr=q('[data-ap-fini-prendre]');if(t)a.textContent=t;if(p)c.textContent=p;if(pr)pr.hidden=!vendre;voir('fini');if(!dlg.open)dlg.showModal()};
form.addEventListener('submit',function(e){e.preventDefault();err.textContent='';
var els=qa('.ap-elem').map(function(li){return {zone:li.getAttribute('data-zone'),nom:li.getAttribute('data-nom'),demande:li.querySelector('textarea').value}}).filter(function(x){return x.demande.trim()});
qa('[data-ap-info]').forEach(function(i){if(i.value.trim())els.push({zone:'autre',nom:i.getAttribute('data-ap-info'),demande:i.value})});
var msg=q('[data-ap-message]').value,mail=q('[data-ap-email]').value.trim(),tel=q('[data-ap-tel]').value;
if(!els.length&&!msg.trim()&&!images.some(function(x){return !x.retire})){err.textContent='Dites-nous ce qu\\'il faut changer, ou ajoutez des photos.';return}
if(!/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(mail)){err.textContent='Votre email, pour vous renvoyer le site mis à jour.';q('[data-ap-email]').focus();return}
be.disabled=true;be.querySelector('span').textContent=envois.length?'Envoi des photos…':'Envoi…';
Promise.all(envois).then(function(){var ok=images.filter(function(x){return x.id&&!x.retire});return envoyer({action:'retouches',elements:els,message:msg,email:mail,tel:tel,images:ok.map(function(x){return x.id}),logos:ok.filter(function(x){return x.logo}).map(function(x){return x.id})})}).then(function(j){be.disabled=false;be.querySelector('span').textContent='Envoyer mes retouches';if(j&&j.ok){liste.innerHTML='';vigs.innerHTML='';images=[];envois=[];q('[data-ap-message]').value='';qa('[data-ap-info]').forEach(function(i){i.value=''});fini('C\\'est bien reçu.','On applique vos retouches sur ce même lien et on vous écrit à '+mail+' dès que c\\'est prêt.')}else err.textContent=(j&&j.erreur)||'Envoi impossible, réessayez.'})});
/* la commande */
var choix=null,bp=q('[data-ap-payer]'),bpt=q('[data-ap-payer-txt]'),err2=q('[data-ap-err2]'),att=q('[data-ap-attente]');
qa('[data-ap-offre]').forEach(function(o){o.addEventListener('click',function(){choix=o.getAttribute('data-ap-offre');signal('formule',choix);qa('[data-ap-offre]').forEach(function(x){x.setAttribute('aria-pressed',x===o?'true':'false')});bp.disabled=false;bpt.textContent=o.querySelector('[data-cta]').getAttribute('data-cta')})});
/* une seule offre (99 €) : déjà choisie, le bouton payer est prêt */
var offres=qa('[data-ap-offre]');if(offres.length===1){choix=offres[0].getAttribute('data-ap-offre');offres[0].setAttribute('aria-pressed','true');bp.disabled=false;bpt.textContent=offres[0].querySelector('[data-cta]').getAttribute('data-cta')}
bp.addEventListener('click',function(){if(!choix)return;err2.textContent='';
if(!att.hidden){var m2=q('[data-ap-email2]').value.trim();if(!/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(m2)){err2.textContent='Votre email, pour vous envoyer le lien.';return}bp.disabled=true;envoyer({action:'rappel',paiement:choix,email:m2}).then(function(j){bp.disabled=false;if(j&&j.ok)fini('Merci, c\\'est noté.','Le lien de paiement arrive à '+m2+' très vite.');else err2.textContent=(j&&j.erreur)||'Envoi impossible, réessayez.'});return}
bp.disabled=true;var avant=bpt.textContent;bpt.textContent='Ouverture du paiement…';
envoyer({action:'commande',paiement:choix}).then(function(j){bp.disabled=false;bpt.textContent=avant;if(j&&j.url){w.location.href=j.url;return}if(j&&j.deja){fini('C\\'est déjà payé.',j.message);return}if(j&&j.attente){att.hidden=false;q('[data-ap-attente-txt]').textContent=j.message||'Laissez votre email : le lien de paiement arrive très vite.';bpt.textContent='Recevoir le lien';return}err2.textContent=(j&&j.erreur)||'Paiement indisponible, réessayez.'})});
/* « Modifier moi-même » : il touche un texte et l'écrit autrement, il touche une photo (ou « Changer la photo ») et met la
   sienne ; enregistré tout de suite (action edition), sans IA. Les liens ne s'ouvrent pas pendant qu'il modifie. Jamais
   ses coordonnées ni ses horaires : ils passent par un message (on vérifie). */
var PRIX=ap.getAttribute('data-prix')||'';
var outils=q('[data-ap-outils]'),edFichier=q('[data-ap-ed-fichier]'),edMsg=q('[data-ap-ed-msg]'),eds=[],edImgs=[],enEdition=false,imgVisee=null,calque=null,tPast=0,ouverts=[];
var norm=function(s){return String(s||'').replace(/\\s+/g,' ').trim()};
var INLINE=/^(SPAN|STRONG|EM|B|I|BR|SMALL|MARK|SUP|SUB|ABBR|Q|S|U)$/;
var SEL='main h1,main h2,main h3,main h4,main h5,main h6,main p,main li,main blockquote,main figcaption,main dt,main dd,main summary,main td,main th';
var COORD=/@|https?:|www\\.|(\\d[\\s.\\-]?){8,}/i;
var editable=function(el){if(!el||ap.contains(el))return false;if(el.closest('a,button,script,style,svg,form,address,nav,[data-horaires],[data-compte]'))return false;if(el.querySelector('a,button,img,svg,input,textarea,select,video,iframe,picture,ul,ol,p,div,section,figure,h1,h2,h3,h4,h5,h6,time'))return false;for(var i=0;i<el.children.length;i++){if(!INLINE.test(el.children[i].tagName))return false}var t=norm(el.textContent);return t.length>=1&&t.length<=700&&!COORD.test(t)};
var candidats=function(){var tous=[].slice.call(d.querySelectorAll(SEL)).filter(editable);return tous.filter(function(el){return !tous.some(function(o){return o!==el&&el.contains(o)})})};
var plainOk=(function(){try{var x=d.createElement('div');x.contentEditable='plaintext-only';return x.contentEditable==='plaintext-only'}catch(e){return false}})();
var dire=function(t){if(!edMsg)return;edMsg.textContent=t;edMsg.hidden=false;clearTimeout(dire.t);dire.t=setTimeout(function(){edMsg.hidden=true},4500)};
var surCollage=function(e){e.preventDefault();var t=((e.clipboardData||w.clipboardData)||{getData:function(){return ''}}).getData('text/plain')||'';try{d.execCommand('insertText',false,t.replace(/\\s+/g,' '))}catch(x){}};
var surTouche=function(e){if(e.key==='Enter'){e.preventDefault();e.target.blur()}};
var horsPanneau=function(t){return t&&t.closest&&!ap.contains(t)&&!(calque&&calque.contains(t))};
var bloqueLiens=function(e){if(!enEdition||!horsPanneau(e.target))return;if(e.target.closest('a,button,summary,label'))e.preventDefault()};
var choisirPhoto=function(im){imgVisee=im;edFichier.click()};
var surImage=function(e){if(!enEdition||!horsPanneau(e.target))return;var im=e.target.closest('img.ap-ed-img');if(!im)return;e.preventDefault();e.stopPropagation();choisirPhoto(im)};
/* une pastille « Changer la photo » sur chaque photo visible (une photo est souvent sous un texte ou un dégradé) */
var ICP='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
/* la partie vraiment visible d'une photo (un cadre qui la rogne, une photo plus grande que sa section) */
var vue=function(el){var r=el.getBoundingClientRect(),t=r.top,l=r.left,bo=r.bottom,ri=r.right;for(var p=el.parentElement;p&&p!==b;p=p.parentElement){var cs=w.getComputedStyle(p);if(cs.overflowX!=='visible'||cs.overflowY!=='visible'){var z=p.getBoundingClientRect();t=Math.max(t,z.top);l=Math.max(l,z.left);bo=Math.min(bo,z.bottom);ri=Math.min(ri,z.right)}}return {top:t,left:l,bottom:bo,right:ri}};
var pastilles=function(){if(!enEdition)return;if(!calque){calque=d.createElement('div');calque.className='ap-calque';b.appendChild(calque)}calque.innerHTML='';var W=d.documentElement.clientWidth,sx=w.scrollX,sy=w.scrollY;
  [].slice.call(d.querySelectorAll('img.ap-ed-img')).forEach(function(im){if(im.closest('header'))return;var cs=w.getComputedStyle(im);if(cs.visibility==='hidden'||cs.display==='none'||Number(cs.opacity)<0.1)return;var v=vue(im);if(v.right-v.left<90||v.bottom-v.top<70||v.right<=0||v.left>=W)return;
    var bt=d.createElement('button');bt.type='button';bt.className='ap-pastille';bt.innerHTML=ICP+'<span>Changer la photo</span>';calque.appendChild(bt);
    /* en bas à droite de la photo : le haut est souvent sous le menu du site */
    var bw=bt.offsetWidth,bh=bt.offsetHeight,x=Math.min(Math.max(8,v.right-14-bw),W-bw-8),y=Math.max(v.top+sy+8,v.bottom+sy-14-bh,8);bt.style.left=(x+sx)+'px';bt.style.top=y+'px';
    bt.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();choisirPhoto(im)})})};
var replacer=function(){clearTimeout(tPast);tPast=setTimeout(pastilles,160)};
var entrer=function(){if(dlg.open)dlg.close();
  [].slice.call(d.querySelectorAll('[data-r]')).forEach(function(e){e.classList.add('vu')});
  ouverts=[].slice.call(d.querySelectorAll('main details:not([open])'));ouverts.forEach(function(x){x.open=true});
  eds=candidats().map(function(el){var x={el:el,html:el.innerHTML,avant:norm(el.textContent)};el.setAttribute('contenteditable',plainOk?'plaintext-only':'true');el.setAttribute('spellcheck','true');el.classList.add('ap-ed');if(!plainOk)el.addEventListener('paste',surCollage);el.addEventListener('keydown',surTouche);return x});
  [].slice.call(d.querySelectorAll('main img,header img,footer img')).forEach(function(im){if(!ap.contains(im))im.classList.add('ap-ed-img')});
  enEdition=true;b.classList.add('ap-edition');outils.hidden=false;
  d.addEventListener('click',bloqueLiens,true);d.addEventListener('click',surImage,true);d.addEventListener('input',replacer,true);w.addEventListener('resize',replacer);
  pastilles();setTimeout(pastilles,900)};
var sortir=function(garder){eds.forEach(function(x){x.el.removeAttribute('contenteditable');x.el.removeAttribute('spellcheck');x.el.classList.remove('ap-ed');x.el.removeEventListener('paste',surCollage);x.el.removeEventListener('keydown',surTouche);if(!garder)x.el.innerHTML=x.html});eds=[];
  [].slice.call(d.querySelectorAll('.ap-ed-img')).forEach(function(im){im.classList.remove('ap-ed-img')});
  if(!garder)edImgs.forEach(function(x){x.im.setAttribute('src',x.src);if(x.srcset)x.im.setAttribute('srcset',x.srcset)});edImgs=[];
  ouverts.forEach(function(x){x.open=false});ouverts=[];
  if(calque){calque.remove();calque=null}
  enEdition=false;b.classList.remove('ap-edition');outils.hidden=true;
  d.removeEventListener('click',bloqueLiens,true);d.removeEventListener('click',surImage,true);d.removeEventListener('input',replacer,true);w.removeEventListener('resize',replacer)};
var changes=function(){return eds.map(function(x){return {avant:x.avant,apres:norm(x.el.textContent)}}).filter(function(x){return x.apres&&x.apres!==x.avant})};
var photosChangees=function(){return edImgs.filter(function(x){return x.id&&x.fichier}).map(function(x){return {fichier:x.fichier,image:x.id}})};
edFichier.addEventListener('change',function(){var f=edFichier.files&&edFichier.files[0];edFichier.value='';var im=imgVisee;imgVisee=null;if(!f||!im)return;
  var deja=edImgs.filter(function(x){return x.im===im})[0];var avant=deja||{im:im,src:im.getAttribute('src')||'',srcset:im.getAttribute('srcset'),fichier:String(im.getAttribute('src')||'').split('?')[0].split('#')[0].split('/').pop()};
  var logo=!!(im.closest('header')||/logo/i.test(String(im.className)+' '+(im.getAttribute('alt')||'')));
  var remettre=function(m){im.classList.remove('ap-ed-charge');if(!deja){im.setAttribute('src',avant.src);if(avant.srcset)im.setAttribute('srcset',avant.srcset)}dire(m)};
  im.classList.add('ap-ed-charge');
  reduire(f).then(function(r){im.removeAttribute('srcset');im.src=r.apercu;return envoyer({action:'image',type:r.type,donnees:r.donnees,nom:f.name||'photo',logo:logo})}).then(function(j){if(j&&j.id){im.classList.remove('ap-ed-charge');avant.id=j.id;if(!deja)edImgs.push(avant);dire('Photo posée. Pensez à Enregistrer.')}else remettre((j&&j.erreur)||'La photo n\\'est pas passée, essayez-en une autre.')}).catch(function(){remettre('Photo illisible, essayez-en une autre.')})});
qa('[data-ap-editer]').forEach(function(x){x.addEventListener('click',entrer)});
q('[data-ap-ed-annule]').addEventListener('click',function(){sortir(false)});
q('[data-ap-ed-reprendre]').addEventListener('click',function(){dlg.close()});
q('[data-ap-ed-ok]').addEventListener('click',function(){var t=changes(),ph=photosChangees();if(!t.length&&!ph.length){dire('Rien n\\'a changé pour l\\'instant : touchez un texte ou une photo.');return}
  var n=t.length+ph.length;q('[data-ap-ed-resume]').textContent=[t.length?t.length+' texte'+(t.length>1?'s':''):null,ph.length?ph.length+' photo'+(ph.length>1?'s':''):null].filter(Boolean).join(' et ')+' modifié'+(n>1?'s':'')+'. Laissez votre email : vous retrouvez votre site sur ce même lien.';
  var em=q('[data-ap-email3]');try{if(!em.value)em.value=w.localStorage.getItem('ap-email')||''}catch(e){}
  ouvrir('edition')});
q('[data-ap-ed-envoi]').addEventListener('click',function(){var bt=q('[data-ap-ed-envoi]'),err3=q('[data-ap-err3]');err3.textContent='';var mail=q('[data-ap-email3]').value.trim();if(!/^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i.test(mail)){err3.textContent='Votre email, pour retrouver votre site modifié.';return}
  var t=changes(),ph=photosChangees();bt.disabled=true;
  envoyer({action:'edition',textes:t,photos:ph,email:mail}).then(function(j){bt.disabled=false;if(j&&j.ok){try{w.localStorage.setItem('ap-email',mail);var k='ap-ed-'+site,v=JSON.parse(w.localStorage.getItem(k)||'{"t":[]}');v.t=(v.t||[]).filter(function(x){return !t.some(function(y){return y.avant===x.avant})}).concat(t);v.le=Date.now();w.localStorage.setItem(k,JSON.stringify(v))}catch(e){}
    sortir(true);fini('C\\'est enregistré.','Vos changements sont sur ce même lien. Pour mettre votre site en ligne sur votre nom de domaine : '+PRIX+' € en une fois.',true)}
    else err3.textContent=(j&&j.erreur)||'Enregistrement impossible, réessayez.'})});
/* des changements pas encore enregistrés : le navigateur prévient avant de quitter la page */
w.addEventListener('beforeunload',function(e){if(enEdition&&(changes().length||photosChangees().length)){e.preventDefault();e.returnValue=''}});
/* ses changements restent visibles sur ce lien le temps que la nouvelle version soit publiée */
try{var k0='ap-ed-'+site,v0=JSON.parse(w.localStorage.getItem(k0)||'null');if(v0&&v0.t&&Date.now()-v0.le<3*86400000){var cs=candidats();v0.t.forEach(function(x){cs.forEach(function(el){if(norm(el.textContent)===x.avant)el.textContent=x.apres})})}}catch(e){}
`;

module.exports = { html, CSS, SCRIPT, parties };
