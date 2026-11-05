// Les sections de la Gestion : le tableau de bord, puis Novalemo (ventes, réponses, emails, prospects), puis le groupe
// (équipe, décisions, coûts, veille). Chaque section lit ce qu'il lui faut et se redessine quand le monde bouge.
import { $, esc, ico, url, eur, usd, nb, date, depuis, jourCourt, pluriel, salut, initiales, toast, occupe, dialogue, STATUT, LEADS, INTENT, SITEST, SITETON, FORMULE, ITEMK, PROPK, SOURCE, KIND } from './outils.js';
import { lireApi, envoyer } from './api.js';
import { S, agentDe, coDe, nom, demo, couleur, action, rafraichir, lancerCycle, aller } from './etat.js';
import { courbe } from './graph.js';

const k = () => (S.m && S.m.compteurs) || {};
const pilote = () => (S.m && S.m.pilote) || {};
const decisions = () => ((S.m && S.m.proposals) || []).filter((p) => p.status === 'a_louis');
const tete = (titre, texte, actions) => '<div class="s-tete"><div><h1>' + esc(titre) + '</h1>' + (texte ? '<p>' + texte + '</p>' : '') + '</div>' + (actions ? '<div class="ligne-actions">' + actions + '</div>' : '') + '</div>';
const chiffre = (label, valeur, sous, cls) => '<div class="chiffre ' + (cls || '') + '"><small>' + esc(label) + '</small><b>' + valeur + '</b>' + (sous ? '<span>' + sous + '</span>' : '') + '</div>';
const filtres = (liste, actif, cle, comptes) => '<div class="filtres">' + liste.map((x) => '<button data-filtre="' + esc(x[0]) + '"' + (cle ? ' data-cle="' + cle + '"' : '') + ' class="' + ((actif || '') === x[0] ? 'on' : '') + '">' + esc(x[1]) + (comptes && comptes[x[0]] ? '<b>' + comptes[x[0]] + '</b>' : '') + '</button>').join('') + '</div>';
const vide = (titre, texte, bouton) => '<div class="vide"><b>' + esc(titre) + '</b>' + esc(texte) + (bouton || '') + '</div>';
const lien = (u, texte, cls) => { const v = url(u); return v ? '<a class="btn ' + (cls || 'btn-second') + ' btn-petit" href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">' + esc(texte) + '</a>' : ''; };
// un aperçu ouvert depuis la tour : marqué ?tour=1, le panneau de l'aperçu sait que c'est Louis et ne compte pas son
// passage comme l'intérêt du prospect
const vueTour = (u) => { const v = url(u); return v && /\/a\/[a-z0-9-]+\/?$/.test(v) ? v + '?tour=1' : u; };
// ce que le prospect a fait dans le panneau de son aperçu, en une pastille
const INTERET = ['', 'A ouvert son aperçu', 'A regardé le paiement', 'A choisi une formule'];
const interet = (i) => i && i.niveau ? '<span class="pastille ' + (i.niveau >= 2 ? 'ok' : 'cobalt') + '" title="' + esc((i.fois || 1) + ' passage' + ((i.fois || 1) > 1 ? 's' : '') + ', le dernier ' + depuis(i.dernier_le) + (i.paiement ? ', ' + (i.paiement === 'mensuel' ? 'au mois' : 'en une fois') : '')) + '">' + esc(INTERET[Math.min(3, i.niveau)]) + '</span>' : '';
const garde = () => { if (demo()) { toast('La base n\'est pas encore branchée : la mise en route d\'abord.', 'err'); aller('gestion/route'); return false; } return true; };

// Ce qui manque au pilote automatique, dit une seule fois en haut des pages Novalemo
function barrePilote() {
  const p = pilote(), manque = [];
  if (demo()) manque.push('la base');
  if (!(S.m.boite && S.m.boite.branchee)) manque.push('la boîte d\'envoi');
  if (!p.vercel) manque.push('l\'hébergement des sites');
  if (!p.stripe || p.stripe_test) manque.push('le paiement');
  if (!p.identite) manque.push('ton identité de vente');
  if (manque.length) return '<div class="barre-pilote manque"><div><b>Pilote automatique : il manque ' + esc(manque.join(', ')) + '</b><span>Ce qui est déjà branché tourne déjà. Le reste se fait une seule fois.</span></div><button class="btn btn-primaire btn-petit" data-aller="gestion/route">Mise en route</button></div>';
  if (!p.auto) return '<div class="barre-pilote"><div><b>Pilote automatique coupé</b><span>Chaque email et chaque réponse attend ta validation ici.</span></div><button class="interrupteur" data-act="pilote" data-v="1" aria-label="Rallumer le pilote automatique"></button></div>';
  return '';
}

/* ── le tableau de bord ── */
const tableau = {
  titre: 'Tableau de bord', court: 'Accueil', icone: 'tableau', vivante: true,
  rendre() {
    const c = k(), j = S.m.jour || {}, b = S.m.budget || {};
    const travail = S.m.agents.filter((a) => a.status === 'working');
    let phrase;
    if (demo()) phrase = 'La tour attend ses clés : ' + pluriel((S.mis && S.mis.a_faire) || 0, 'étape') + ' de mise en route, quelques minutes, puis elle tourne seule.';
    else phrase = [travail.length ? pluriel(travail.length, 'agent') + ' au travail' : 'Tout est calme', c.apercus ? pluriel(c.apercus, 'aperçu') + ' en ligne' : '', c.reponses ? pluriel(c.reponses, 'réponse') + ' en cours' : ''].filter(Boolean).join(', ') + '.';
    let h = tete(salut() + ' Louis', esc(phrase), demo() ? '<button class="btn btn-primaire" data-aller="gestion/route">' + ico('route') + 'Reprendre la mise en route</button>' : '<button class="btn btn-second" data-aller="ville">' + ico('ville') + 'Voir la ville</button>');
    // l'argent
    const coutTotal = S.m.agents.reduce((s, a) => s + Number((a.stats && a.stats.cout) || 0), 0);
    h += '<div class="carte argent">' +
      '<div>' + chiffre('Encaissé par Novalemo', eur(c.ca_eur), c.clients ? pluriel(c.clients, 'client') + ', depuis le début' : 'Le premier paiement arrive ici.', 'grand') + '</div>' +
      '<div>' + chiffre('Chaque mois', eur(c.mrr_eur || 0), pluriel(c.abonnes || 0, 'abonnement')) + '</div>' +
      '<div>' + chiffre('Sites en ligne', nb(c.en_ligne), pluriel(c.commandes || 0, 'commande') + ' en cours') + '</div>' +
      '<div>' + chiffre('Coût de l\'IA', usd(j.cost_usd), 'aujourd\'hui, sur ' + usd(b.jour_usd) + (c.clients ? '<br>' + usd(coutTotal / Math.max(1, c.clients)) + ' par vente' : '')) + '</div></div>';
    // la chaîne Novalemo, du prospect au site en ligne : chaque maillon dit qui le tient
    const etapes = [
      ['Prospects', c.prospects, 'trouvés par ' + [nom('chasse_maps'), nom('chasse_domaines'), nom('chasse_registre')].join(', ')],
      ['Contactés', c.envoyes, 'emails de ' + nom('redacteur') + ' et ' + nom('relanceur')],
      ['Réponses', (c.reponses || 0) + (c.interesses || 0), 'lues par ' + nom('reponses')],
      ['Aperçus', c.apercus, 'fabriqués par ' + nom('demo')],
      ['Commandes', c.commandes, 'paiement envoyé'],
      ['En ligne', c.en_ligne, 'livrés par ' + nom('livraison')]
    ];
    h += '<div class="carte" style="margin-top:14px"><h2 class="carte-t">La chaîne Novalemo<small>du prospect au site en ligne</small></h2><div class="chaine">' + etapes.map((e, i) => {
      const v = Number(e[1] || 0), av = i ? Number(etapes[i - 1][1] || 0) : v;
      const pct = i === 0 ? (v ? 100 : 0) : av ? Math.min(100, Math.round(v / av * 100)) : 0;
      return '<div class="maillon' + (i === 5 && v ? ' vif' : '') + '"><small>' + esc(e[0]) + '</small><b>' + nb(v) + '</b><div class="jauge"><i style="width:' + pct + '%"></i></div><span title="' + esc(e[2]) + '">' + (i ? (av ? pct + ' % de l\'étape d\'avant' : esc(e[2])) : esc(e[2])) + '</span></div>';
    }).join('') + '</div></div>';
    // deux colonnes : la machine et le fil ; ce qui t'attend et qui travaille
    const pourToi = [];
    decisions().forEach((p) => pourToi.push('<button class="ligne" data-prop="' + p.id + '"><span class="avatar petit" style="--c:#E5B653">' + ico('decisions') + '</span><span class="l-c"><b>' + esc(p.title) + '</b><span>Décision, proposée par ' + esc(nom(p.from_id)) + '</span></span>' + ico('fleche') + '</button>'));
    if (S.mis && S.mis.a_faire) pourToi.push('<button class="ligne" data-aller="gestion/route"><span class="avatar petit" style="--c:#2B59E8">' + ico('route') + '</span><span class="l-c"><b>Mise en route</b><span>' + pluriel(S.mis.a_faire, 'étape') + ' encore, une seule fois</span></span>' + ico('fleche') + '</button>');
    if (!pilote().auto && c.brouillons) pourToi.push('<button class="ligne" data-aller="gestion/emails"><span class="avatar petit" style="--c:#2EE3AF">' + ico('emails') + '</span><span class="l-c"><b>' + pluriel(c.brouillons, 'email') + ' à valider</b><span>Le pilote automatique est coupé</span></span>' + ico('fleche') + '</button>');
    (S.msgs || []).filter((m) => m.to_id === 'louis' && m.kind === 'alerte' && Date.now() - new Date(m.created_at).getTime() < 2 * 86400000).slice(0, 4).forEach((m) => pourToi.push('<div class="ligne"><span class="avatar petit" style="--c:#FF5A60">!</span><span class="l-c"><b>' + esc(m.subject || '') + '</b><span>' + esc(nom(m.from_id) + ', ' + depuis(m.created_at)) + '</span></span></div>'));
    const prochains = S.m.agents.filter((a) => a.kind !== 'attente' && a.next_run_at && a.status !== 'paused').sort((a, b) => new Date(a.next_run_at) - new Date(b.next_run_at)).slice(0, 5);
    h += '<div class="grille g-tableau" style="margin-top:14px"><div class="grille">' +
      '<div class="carte"><h2 class="carte-t">Ce que fait la machine<small>14 derniers jours</small></h2>' + courbe(S.m.historique || [], 640) + '</div>' +
      '<div class="carte"><h2 class="carte-t">Le fil<a href="#/ville" style="font-size:12.5px;font-weight:500">dans la ville</a></h2><div class="lignes">' + ((S.msgs || []).slice(0, 7).map((m) => '<button class="ligne" data-agent="' + esc(agentDe(m.from_id) ? m.from_id : '') + '"><span class="avatar petit" style="--c:' + esc(couleur((agentDe(m.from_id) || {}).company_id)) + '">' + esc(initiales(nom(m.from_id))) + '</span><span class="l-c"><b>' + esc(m.subject || m.body || '') + '</b><span>' + esc(nom(m.from_id) + (m.to_id ? ' à ' + nom(m.to_id) : '') + ', ' + depuis(m.created_at)) + '</span></span></button>').join('') || vide('Aucun échange', 'Les premiers échanges arrivent dès que la base est branchée.')) + '</div></div>' +
      '</div><div class="grille">' +
      '<div class="carte"><h2 class="carte-t">Pour toi<small>' + (pourToi.length ? pourToi.length : '') + '</small></h2>' + (pourToi.length ? '<div class="lignes">' + pourToi.join('') + '</div>' : vide('Rien pour toi', 'La tour tourne seule. Elle te prévient ici quand une décision t\'attend.')) + '</div>' +
      '<div class="carte"><h2 class="carte-t">En ce moment<small>' + (travail.length ? pluriel(travail.length, 'agent') + ' au travail' : '') + '</small></h2><div class="lignes">' +
        (travail.length ? travail.map((a) => '<button class="ligne" data-agent="' + esc(a.id) + '"><span class="avatar petit" style="--c:' + esc(couleur(a.company_id)) + '">' + esc(initiales(a.name)) + '</span><span class="l-c"><b>' + esc(a.name) + '</b><span>' + esc(a.current_task || a.title) + '</span></span><span class="point working"></span></button>').join('')
          : prochains.length ? prochains.map((a) => '<button class="ligne" data-agent="' + esc(a.id) + '"><span class="avatar petit" style="--c:' + esc(couleur(a.company_id)) + '">' + esc(initiales(a.name)) + '</span><span class="l-c"><b>' + esc(a.name) + '</b><span>' + esc(a.title) + '</span></span><span class="l-d">' + esc(depuis(a.next_run_at)) + '</span></button>').join('') : vide('Personne au travail', demo() ? 'Les agents démarrent avec la base.' : 'Le prochain cycle passe dans moins de 15 minutes.')) +
      '</div>' + (demo() ? '' : '<div class="ligne-actions" style="margin-top:12px"><button class="btn btn-second btn-petit" data-act="cycle-section">' + ico('eclair') + 'Lancer un cycle</button></div>') + '</div>' +
      '</div></div>';
    return h;
  }
};
action('cycle-section', (b) => lancerCycle(b));

/* ── les ventes et les sites ── */
const ST_SITES = [['', 'Tous'], ['apercu', SITEST.apercu], ['commande', SITEST.commande], ['paye', SITEST.paye], ['livraison', SITEST.livraison], ['en_ligne', SITEST.en_ligne], ['expire', SITEST.expire]];
function ficheSite(r) {
  const l = r.lead || {};
  const liens = [];
  if (r.url_finale) liens.push(lien(r.url_finale, 'Voir le site en ligne', 'btn-ok'));
  if (r.url_apercu) liens.push(lien(vueTour(r.url_apercu), r.url_finale ? 'Aperçu' : 'Voir l\'aperçu'));
  if (r.paiement && r.status === 'commande') liens.push(lien(r.paiement, 'Paiement en une fois'));
  if (r.paiement_mois && r.status === 'commande') liens.push(lien(r.paiement_mois, 'Paiement au mois'));
  if (r.facture) liens.push(lien(r.facture, 'Facture'));
  if (['apercu', 'commande', 'brouillon'].indexOf(r.status) >= 0) liens.push('<button class="btn btn-danger btn-petit" data-act="siteAnnuler" data-id="' + r.id + '">Retirer</button>');
  const ab = r.abonnement;
  const quand = r.live_at ? 'en ligne ' + depuis(r.live_at) : r.paid_at ? 'payé ' + depuis(r.paid_at) : r.published_at ? 'aperçu publié ' + depuis(r.published_at) : 'créé ' + depuis(r.created_at);
  const prix = r.formule ? (FORMULE[r.formule] || r.formule) + (ab ? ', ' + eur(ab.mensualite_eur) + ' par mois' + (ab.arret ? ' (arrêt demandé)' : ab.statut !== 'active' ? ' (paiement en retard)' : ab.fin_auto ? ', 12 mois' : '') : r.montant_eur ? ', ' + eur(r.montant_eur) : '') : '';
  const autres = [r.domaine ? r.domaine + (r.domaine_mode === 'client' ? ' (son domaine)' : '') : '', r.revisions ? pluriel(r.revisions, 'retouche') : '', r.photos ? pluriel(r.photos, 'photo') + (r.logo ? ' et son logo' : '') : r.logo ? 'son logo' : '', r.template ? 'template ' + r.template : r.composition ? 'modèle ' + String(r.composition).split(',')[0] : '', r.problemes && r.problemes.length ? pluriel(r.problemes.length, 'phrase') + ' retirée' + (r.problemes.length > 1 ? 's' : '') + ' au contrôle' : ''].filter(Boolean).join(', ');
  return '<article class="fiche site"><div class="site-l"><div class="s-nom"><b>' + esc(r.nom || l.name || r.slug) + '</b><span>' + esc([r.activite, r.commune].filter(Boolean).join(', ') + (l.email ? ', ' + l.email : '')) + '</span></div>' +
    '<div class="s-det">' + esc(prix || 'Formule pas encore choisie') + '<span>' + esc(autres) + '</span></div>' +
    '<div class="s-etat"><span class="pastille ' + (SITETON[r.status] || '') + '">' + esc(SITEST[r.status] || r.status) + '</span><span style="font-size:12px;color:var(--doux)">' + esc(quand) + '</span>' + (['apercu', 'commande', 'brouillon'].indexOf(r.status) >= 0 ? interet(l.interet) : '') + (r.critique ? '<span class="pastille ' + (r.critique.verdict === 'valide' ? 'ok' : r.critique.abandon ? 'alerte' : 'cobalt') + '" title="' + esc(r.critique.resume || '') + '">' + esc(nom('critique')) + ' ' + note10(r.critique.note) + '</span>' : '') + '</div>' +
    (liens.length ? '<div class="ligne-actions">' + liens.join('') + '</div>' : '') + '</div></article>';
}
// La phase de test des sites : les aperçus du nouveau moteur, le verdict de Miranda, et le bouton qui lance l'envoi
const note10 = (n) => String(n).replace('.', ',') + '/10';
function carteTest(t) {
  if (!t || t.demo) return '';
  const test = t.phase === 'test';
  const ligne = (x) => { const c = x.critique; const pas = !c ? '<span class="pastille">En attente de Miranda</span>' : c.verdict === 'valide' ? '<span class="pastille ok">' + note10(c.note) + ' validé</span>' : '<span class="pastille ' + (c.abandon ? 'alerte' : 'cobalt') + '">' + note10(c.note) + (c.abandon ? ' refusé' : ' en reprise') + '</span>';
    return '<tr><td class="plein"><b>' + (x.url ? '<a href="' + esc(vueTour(x.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(x.nom || 'Site') + '</a>' : esc(x.nom || 'Site')) + '</b><small>' + esc([x.metier, x.commune, x.sans_site ? 'sans site aujourd\'hui' : null, x.photos ? pluriel(x.photos, 'photo') : 'sans photo'].filter(Boolean).join(', ')) + '</small></td><td>' + pas + (c && c.resume ? '<small class="serre">' + esc(c.resume) + '</small>' : '') + '</td></tr>'; };
  return '<div class="carte" style="margin-bottom:14px"><h2 class="carte-t">' + (test ? 'Sites en test' : 'Les derniers sites du nouveau moteur') + '<small>' + (test ? 'aucun premier email ne part, ' : '') + esc(nom('critique')) + ' : ' + t.valides + ' validé' + (t.valides > 1 ? 's' : '') + ' sur ' + t.juges + ' jugé' + (t.juges > 1 ? 's' : '') + '</small></h2>' +
    (t.sites && t.sites.length ? '<div class="defile"><table class="tableau adaptable"><thead><tr><th>Site</th><th>Verdict de ' + esc(nom('critique')) + '</th></tr></thead><tbody>' + t.sites.map(ligne).join('') + '</tbody></table></div>' : '<p class="note-emma">' + esc(nom('demo')) + ' fabrique les premiers sites du nouveau moteur : ils apparaissent ici avec le verdict de ' + esc(nom('critique')) + '.</p>') +
    '<div class="ligne-actions" style="margin-top:12px">' + (test ? '<button class="btn btn-ok btn-petit" data-act="phaseSites" data-v="envoi">Lancer l\'envoi</button><span style="font-size:12.5px;color:var(--doux)">Les premiers emails partiront avec les sites validés.</span>' : '<button class="btn btn-second btn-petit" data-act="phaseSites" data-v="test">Remettre en test</button>') + '</div></div>';
}
action('phaseSites', async (b, d) => {
  if (!garde()) return;
  const envoi = d.v === 'envoi';
  if (!(await dialogue({ titre: envoi ? 'Lancer l\'envoi ?' : 'Remettre les sites en test ?', texte: envoi ? 'Les premiers emails reprennent, au rythme de la boîte, seulement avec des aperçus validés par ' + nom('critique') + '.' : 'Plus aucun premier email ni relance tant que tu n\'auras pas relancé l\'envoi. Les réponses continuent.', ok: envoi ? 'Lancer l\'envoi' : 'Remettre en test' }))) return;
  occupe(b, async () => { await envoyer({ op: 'phase_sites', phase: envoi ? 'envoi' : 'test' }); toast(envoi ? 'Envoi lancé : les sites validés partent avec les premiers emails.' : 'Sites remis en test : aucun premier email ne part.', 'ok'); recharger(); });
});
const ventes = {
  titre: 'Ventes et sites', court: 'Ventes', icone: 'ventes', vivante: false,
  compte: () => (k().commandes || 0),
  async charger(p) { if (demo()) return { rows: [] }; const [r, t] = await Promise.all([lireApi('sites', { limite: 150, statut: p.statut || '' }), lireApi('phase_sites').catch(() => null)]); return Object.assign({}, r, { test: t }); },
  rendre(p, d) {
    const c = k();
    let h = tete('Ventes et sites', 'Chaque aperçu est un vrai site, fabriqué d\'avance pour un prospect de Martinique. Payé, il passe en ligne sur son nom de domaine, la facture part seule.');
    h += barrePilote();
    h += carteTest(d && d.test);
    h += '<div class="carte argent" style="margin-bottom:14px"><div>' + chiffre('Encaissé', eur(c.ca_eur), pluriel(c.clients || 0, 'client')) + '</div><div>' + chiffre('Chaque mois', eur(c.mrr_eur || 0), pluriel(c.abonnes || 0, 'abonnement')) + '</div><div>' + chiffre('En ligne', nb(c.en_ligne)) + '</div><div>' + chiffre('Aperçus', nb(c.apercus), pluriel(c.commandes || 0, 'commande') + ' en cours') + '</div></div>';
    h += filtres(ST_SITES, p.statut);
    const rows = (d && d.rows) || [];
    if (d && d.erreur) h += vide('La liste ne se charge pas', d.erreur);
    else h += rows.length ? rows.map(ficheSite).join('') : vide('Aucun site' + (p.statut ? ' dans cet état' : '') + ' pour l\'instant', pilote().vercel ? 'Noé fabrique les aperçus des meilleurs prospects dès qu\'ils ont un email.' : 'L\'hébergement des sites se branche dans la mise en route.');
    return h;
  }
};
action('siteAnnuler', async (b, d) => {
  if (!garde()) return;
  if (!(await dialogue({ titre: 'Retirer cet aperçu ?', texte: 'Il ne sera plus visible, et ses liens de paiement sont désactivés.', ok: 'Retirer', danger: true }))) return;
  occupe(b, async () => { await envoyer({ op: 'site_annuler', id: Number(d.id) }); toast('Retiré : il disparaît à la prochaine publication.', 'ok'); recharger(); });
});
action('pilote', (b, d) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'budget', envoi_auto: d.v === '1' }); toast(d.v === '1' ? 'Pilote automatique en marche : tout part seul après le contrôle qualité.' : 'Pilote coupé : emails et réponses attendent ta validation.', 'ok'); await rafraichir(); recharger(); }); });
let rechargeur = null;
export function brancherRecharge(fn) { rechargeur = fn; }
const recharger = () => { if (rechargeur) rechargeur(); };

/* ── les réponses des prospects ── */
function barreBoite(boite) {
  if (!(S.m.boite && S.m.boite.branchee)) return '<div class="barre-pilote manque"><div><b>Boîte d\'envoi pas encore branchée</b><span>Les emails partent de ton adresse et les réponses arrivent ici, toutes les 15 minutes.</span></div><button class="btn btn-primaire btn-petit" data-aller="gestion/route">Brancher</button></div>';
  if (!boite) return '';
  const rythme = boite.sante && boite.sante.niveau === 'fatigue' ? 'freiné : ' + boite.sante.raison : boite.sante && boite.sante.niveau === 'saine' ? 'la boîte est saine, il accélère' : 'il monte tant que la boîte reste saine';
  return '<div class="barre-pilote"><div><b>' + esc(boite.adresse) + '</b><span>' + (boite.pause ? 'En pause : ' + esc(boite.raison || '') : 'Aujourd\'hui ' + boite.envoyes_jour + ' sur ' + boite.quota + ' (' + esc(rythme) + '), ' + boite.prets + ' en file, ' + pluriel(boite.stats14.reponses, 'réponse') + ' en 14 jours') + '</span></div><button class="btn btn-second btn-petit" data-aller="gestion/reglages?onglet=boite">La boîte</button></div>';
}
function ficheReponse(r) {
  const l = r.lead || {}, o = r.origine, rep = r.reponse, ouverte = r.status === 'nouveau' || r.status === 'brouillon';
  let h = '<article class="fiche"><div class="fiche-t"><div><b>' + esc(r.from_name || r.from_email) + (l.name && l.name !== r.from_name ? ', ' + esc(l.name) : '') + '</b><span class="s">' + esc([r.from_email, date(r.received_at), l.sector, l.commune].filter(Boolean).join(', ')) + '</span></div><span class="pastille ' + (r.intent === 'interesse' || r.intent === 'rdv' ? 'ok' : r.intent === 'stop' || r.intent === 'pas_interesse' ? 'alerte' : ouverte ? 'cobalt' : '') + '">' + esc(INTENT[r.intent] || { nouveau: 'Nouvelle', brouillon: 'Réponse prête', traite: 'Traitée', archive: 'Archivée' }[r.status] || r.status) + '</span></div>';
  h += '<div class="texte-mail eux">' + esc(r.body || '(message vide)') + '</div>';
  if (r.data && r.data.pieces && r.data.pieces.length) h += '<p class="note-emma">Pièce(s) jointe(s) : ' + esc(r.data.pieces.map((p) => p.nom).filter(Boolean).join(', ')) + ' (dans ta messagerie)</p>';
  if (r.data && r.data.note) h += '<p class="note-emma">' + esc(nom('reponses')) + ' : ' + esc(r.data.note) + '</p>';
  if (o) h += '<details class="repli"><summary>Notre email : ' + esc(o.subject) + '</summary><div class="texte-mail">' + esc(o.body) + '</div></details>';
  let b = '';
  if (rep && rep.status !== 'envoye') {
    h += '<div class="brouillon"><small>Réponse préparée par ' + esc(nom(rep.agent_id)) + ', tu peux la retoucher</small><textarea class="saisie" id="rb' + rep.id + '" rows="6">' + esc(rep.body) + '</textarea>' + (rep.status === 'erreur' && rep.error ? '<p class="note-emma" style="color:var(--alerte)">Envoi raté : ' + esc(rep.error) + '</p>' : '') + '</div>';
    b += '<button class="btn btn-ok btn-petit" data-act="repEnvoyer" data-id="' + rep.id + '">' + (rep.status === 'pret' ? 'Envoyer maintenant' : 'Envoyer la réponse') + '</button>';
  } else if (rep && rep.status === 'envoye') h += '<p class="note-emma">Réponse envoyée ' + esc(date(rep.sent_at)) + '.</p>';
  else if (r.status === 'nouveau') { h += '<p class="note-emma">' + esc(nom('reponses')) + ' prépare une réponse au prochain passage.</p>'; b += '<button class="btn btn-second btn-petit" data-act="lancer" data-id="reponses">Lancer ' + esc(nom('reponses')) + ' maintenant</button>'; }
  if (l.phone) b += '<a class="btn btn-second btn-petit" href="tel:' + esc(String(l.phone).replace(/[^\d+]/g, '')) + '">Appeler ' + esc(l.phone) + '</a>';
  if (ouverte && r.intent !== 'interesse' && r.intent !== 'rdv') b += '<button class="btn btn-discret btn-petit" data-act="repInteresse" data-id="' + r.id + '">Il est intéressé</button>';
  if (ouverte) b += '<button class="btn btn-discret btn-petit" data-act="repTraite" data-id="' + r.id + '">Marquer traitée</button>';
  if (l.id && l.status !== 'stop' && ouverte) b += '<button class="btn btn-danger btn-petit" data-act="leadStop" data-id="' + l.id + '">STOP</button>';
  return h + (b ? '<div class="ligne-actions">' + b + '</div>' : '') + '</article>';
}
const reponses = {
  titre: 'Réponses', icone: 'reponses', vivante: false, chaud: true,
  compte: () => (k().reponses || 0),
  async charger() { if (demo()) return { rows: [] }; const [i, b] = await Promise.all([lireApi('inbox', { limite: 60 }), S.m.boite && S.m.boite.branchee ? lireApi('boite').catch(() => null) : Promise.resolve(null)]); return { rows: i.rows, boite: b }; },
  rendre(p, d) {
    let h = tete('Réponses', 'Les réponses des prospects, avec celle que ' + esc(nom('reponses')) + ' a préparée. En pilote automatique, elle part seule après le contrôle qualité.');
    h += S.m.boite && S.m.boite.branchee ? barreBoite(d && d.boite) + barrePilote() : barrePilote();
    const rows = (d && d.rows) || [];
    const ouvertes = rows.filter((r) => r.status === 'nouveau' || r.status === 'brouillon'), faites = rows.filter((r) => !(r.status === 'nouveau' || r.status === 'brouillon')).slice(0, 25);
    h += ouvertes.length ? ouvertes.map(ficheReponse).join('') : vide('Aucune réponse en attente', 'Dès qu\'un prospect répond, son message arrive ici avec une réponse déjà préparée.');
    if (faites.length) h += '<h2 style="font-size:14px;margin:26px 0 12px;color:var(--doux);font-weight:550">Déjà traitées</h2>' + faites.map(ficheReponse).join('');
    return h;
  }
};
action('repEnvoyer', (b, d) => { if (garde()) occupe(b, async () => { const ta = $('#rb' + d.id); const r = await envoyer({ op: 'reponse_envoyer', id: Number(d.id), body: ta ? ta.value : undefined }); toast(r.envoye ? 'Réponse envoyée, dans le même fil.' : 'Pas encore partie : ' + (r.erreur || '') + ' ' + (r.note || ''), r.envoye ? 'ok' : 'err'); recharger(); rafraichir(); }); });
action('repInteresse', (b, d) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'reponse_maj', id: Number(d.id), intent: 'interesse' }); toast('Noté : prospect intéressé.', 'ok'); recharger(); }); });
action('repTraite', (b, d) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'reponse_maj', id: Number(d.id), statut: 'traite' }); toast('Marquée traitée.', 'ok'); recharger(); }); });
action('leadStop', async (b, d) => { if (!garde()) return; if (!(await dialogue({ titre: 'Ne plus jamais le contacter ?', texte: 'Ses emails en attente sont annulés et son adresse ne recevra plus rien.', ok: 'Désinscrire', danger: true }))) return; occupe(b, async () => { await envoyer({ op: 'lead', id: Number(d.id), statut: 'stop' }); toast('Désinscrit.', 'ok'); recharger(); }); });

/* ── les emails de prospection ── */
let emailsCache = [];
function ficheEmail(r) {
  const l = r.lead || {}, bo = S.m.boite && S.m.boite.branchee;
  const mailto = 'mailto:' + encodeURIComponent(r.to_email) + '?subject=' + encodeURIComponent(r.subject) + '&body=' + encodeURIComponent(r.body);
  const site = url(l.website);
  return '<article class="fiche" data-mail="' + r.id + '"><div class="fiche-t"><div><b>' + esc(r.subject) + '</b><span class="s">' + esc(['à ' + r.to_email, l.name, [l.sector, l.commune].filter(Boolean).join(', '), r.step > 1 ? 'relance ' + (r.step - 1) + ', même fil' : ''].filter(Boolean).join(', ')) + '</span></div><span class="pastille ' + (r.status === 'erreur' ? 'alerte' : r.status === 'pret' ? 'cobalt' : 'attention') + '">' + esc({ a_valider: 'À valider', pret: 'En file d\'envoi', erreur: 'Envoi raté' }[r.status] || r.status) + '</span></div>' +
    (site ? '<p class="info">Son site : <a href="' + esc(site) + '" target="_blank" rel="noopener noreferrer">' + esc(l.website) + '</a>' + (l.site_state ? ' (' + esc(l.site_state) + ')' : '') + '</p>' : '') +
    (r.status === 'erreur' && r.error ? '<p class="info" style="color:var(--alerte)">' + esc(r.error) + '</p>' : '') +
    '<div class="texte-mail" data-corps="' + r.id + '">' + esc(r.body) + '</div><div class="ligne-actions">' +
    (bo ? (r.status === 'pret' ? '<button class="btn btn-second btn-petit" data-act="mail" data-id="' + r.id + '" data-s="a_valider">Retirer de la file</button>' : '<button class="btn btn-ok btn-petit" data-act="mail" data-id="' + r.id + '" data-s="pret">' + (r.status === 'erreur' ? 'Réessayer' : 'Valider l\'envoi') + '</button>') : '<a class="btn btn-ok btn-petit" href="' + esc(mailto) + '">Ouvrir dans ma messagerie</a><button class="btn btn-second btn-petit" data-act="mail" data-id="' + r.id + '" data-s="envoye">Marquer envoyé</button>') +
    '<button class="btn btn-discret btn-petit" data-act="mailModifier" data-id="' + r.id + '">Modifier</button><button class="btn btn-discret btn-petit" data-act="mailRetour" data-id="' + r.id + '">Un retour pour ' + esc(nom(r.agent_id || 'redacteur')) + '</button><button class="btn btn-danger btn-petit" data-act="mail" data-id="' + r.id + '" data-s="annule">Annuler</button></div></article>';
}
// Le pôle écriture : les variantes du premier email en test, ce que chacune a donné, et la charte que suivent ceux qui écrivent
const VERDICT = { en_tete: ['En tête', 'ok'], a_retirer: ['À retirer', 'alerte'], en_test: ['En test', 'cobalt'], retiree: ['Retirée', ''] };
const varianteDe = (angle) => (String(angle || '').match(/^v:([A-Z]{1,2})(?:\s|$)/) || [])[1] || null;
function carteEcriture(ec) {
  if (!ec || !ec.variantes || !ec.variantes.length) return '';
  const vs = ec.variantes.filter((v) => v.statut !== 'retiree' || v.envoyes);
  const resultats = (v) => !v.envoyes ? 'Pas encore envoyée' : [pluriel(v.envoyes, 'envoi'), pluriel(v.reponses, 'réponse') + ' (' + String(v.taux_reponse).replace('.', ',') + ' %)', pluriel(v.positifs, 'intéressé'), v.stop + ' STOP', v.ventes ? pluriel(v.ventes, 'vente') : ''].filter(Boolean).join(', ');
  return '<div class="carte" style="margin-bottom:14px"><h2 class="carte-t">Les messages en test<small>pôle écriture, ' + esc(nom('plume')) + '</small></h2>' +
    '<div class="defile"><table class="tableau adaptable"><thead><tr><th>Variante</th><th>Ce qu\'elle a donné</th><th>Verdict</th></tr></thead><tbody>' +
    vs.map((v) => { const vd = VERDICT[v.verdict] || [v.verdict, '']; return '<tr><td class="plein"><b>' + esc(v.id) + ', ' + esc(v.nom) + '</b><small class="serre">' + esc(v.consigne) + '</small></td><td>' + esc(resultats(v)) + '</td><td><span class="pastille ' + vd[1] + '">' + esc(vd[0]) + '</span>' + (v.verdict === 'en_test' && v.manque ? '<small>jugée dans ' + pluriel(v.manque, 'envoi') + '</small>' : '') + '</td></tr>'; }).join('') +
    '</tbody></table></div>' +
    '<details class="repli"><summary>La charte que suivent ceux qui écrivent</summary><div class="texte-mail">' + esc(ec.charte || '') + '</div></details></div>';
}
const emails = {
  titre: 'Emails', icone: 'emails', vivante: false,
  compte: () => (pilote().auto ? 0 : k().brouillons || 0),
  async charger() { if (demo()) return { rows: [] }; const [o, b, ec] = await Promise.all([lireApi('outbox', { limite: 80 }), S.m.boite && S.m.boite.branchee ? lireApi('boite').catch(() => null) : Promise.resolve(null), lireApi('ecriture').catch(() => null)]); emailsCache = o.rows || []; return { rows: o.rows, boite: b, ecriture: ec }; },
  rendre(p, d) {
    let h = tete('Emails', pilote().auto ? 'Les premiers emails et les relances partent seuls, au rythme que la boîte supporte, après le contrôle qualité. Tu peux toujours en retenir un.' : 'Pilote coupé : chaque email attend ta validation ici.');
    h += S.m.boite && S.m.boite.branchee ? barreBoite(d && d.boite) : barrePilote();
    h += carteEcriture(d && d.ecriture);
    const rows = ((d && d.rows) || []).filter((r) => r.kind !== 'reponse' && ['a_valider', 'pret', 'erreur'].indexOf(r.status) >= 0);
    const faits = ((d && d.rows) || []).filter((r) => ['envoye', 'annule'].indexOf(r.status) >= 0).slice(0, 30);
    h += rows.length ? rows.map(ficheEmail).join('') : vide('Aucun email en attente', nom('redacteur') + ' écrit dès que les chasseurs trouvent des prospects avec un email.');
    if (faits.length) h += '<div class="carte" style="margin-top:18px"><h2 class="carte-t">Déjà partis ou annulés</h2><div class="defile"><table class="tableau adaptable"><thead><tr><th>À</th><th>Objet</th><th>État</th><th class="d">Le</th></tr></thead><tbody>' + faits.map((r) => '<tr><td class="plein">' + esc(r.to_email) + '</td><td class="plein">' + esc(r.subject) + (r.kind === 'reponse' ? ' <small>réponse</small>' : r.kind === 'relance' ? ' <small>relance</small>' : varianteDe(r.angle) ? ' <small>variante ' + esc(varianteDe(r.angle)) + '</small>' : '') + '</td><td><span class="pastille ' + (r.status === 'envoye' ? 'ok' : '') + '">' + (r.status === 'envoye' ? 'Envoyé' : 'Annulé') + '</span>' + (r.error ? '<small>' + esc(r.error) + '</small>' : '') + '</td><td class="d" style="color:var(--doux)">' + esc(date(r.sent_at || r.updated_at)) + '</td></tr>').join('') + '</tbody></table></div></div>';
    return h;
  }
};
action('mail', (b, d) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'email', id: Number(d.id), statut: d.s }); toast({ pret: 'Validé : il part de ta boîte au prochain créneau (jours ouvrés, 8 h à 17 h 30).', a_valider: 'Retiré de la file.', envoye: 'Marqué envoyé.', annule: 'Annulé.' }[d.s] || 'Fait.', 'ok'); recharger(); rafraichir(); }); });
action('mailModifier', (b, d) => {
  const r = emailsCache.find((x) => String(x.id) === d.id); const box = document.querySelector('[data-corps="' + d.id + '"]');
  if (!r || !box) return;
  box.outerHTML = '<div style="margin-top:10px"><input class="saisie" id="es' + d.id + '" value="' + esc(r.subject) + '" style="margin-bottom:8px"><textarea class="saisie" id="eb' + d.id + '" rows="10">' + esc(r.body) + '</textarea><div class="ligne-actions" style="margin-top:8px"><button class="btn btn-primaire btn-petit" data-act="mailEnregistrer" data-id="' + d.id + '">Enregistrer</button></div></div>';
  b.remove();
});
action('mailEnregistrer', (b, d) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'email', id: Number(d.id), subject: $('#es' + d.id).value, body: $('#eb' + d.id).value }); toast('Email modifié.', 'ok'); recharger(); }); });
action('mailRetour', async (b, d) => { if (!garde()) return; const txt = await dialogue({ titre: 'Ton retour sur cet email', texte: 'Il devient une règle que la rédactrice suivra pour les prochains.', saisie: 'Ce qu\'il faut changer', ok: 'Transmettre' }); if (txt) occupe(b, async () => { await envoyer({ op: 'email', id: Number(d.id), retour: txt }); toast('Retour noté.', 'ok'); }); });

/* ── les prospects ── */
const ST_LEADS = [['', 'Tous'], ['a_contacter', LEADS.a_contacter], ['brouillon', LEADS.brouillon], ['contacte', LEADS.contacte], ['relance', LEADS.relance], ['interesse', LEADS.interesse], ['client', LEADS.client], ['a_appeler', LEADS.a_appeler], ['sans_contact', LEADS.sans_contact], ['ecarte', LEADS.ecarte]];
const prospects = {
  titre: 'Prospects', icone: 'prospects', vivante: false,
  async charger(p) { return demo() ? { rows: [] } : lireApi('leads', { limite: 200, statut: p.statut || '' }); },
  rendre(p, d) {
    const c = k();
    let h = tete('Prospects', 'Les entreprises de Martinique trouvées par les chasseurs (Google Maps, nouveaux domaines, registre), notées sur 100 avec la raison.');
    h += '<div class="grille g4" style="margin-bottom:14px"><div class="carte">' + chiffre('Prospects', nb(c.prospects)) + '</div><div class="carte">' + chiffre('À contacter', nb(c.a_contacter)) + '</div><div class="carte">' + chiffre('Intéressés', nb(c.interesses)) + '</div><div class="carte">' + chiffre('Sans email', nb(c.a_appeler), 'à appeler, ou sur WhatsApp') + '</div></div>';
    h += filtres(ST_LEADS, p.statut);
    const rows = (d && d.rows) || [];
    if (!rows.length) return h + vide('Aucun prospect' + (p.statut ? ' dans cet état' : '') + ' pour l\'instant', 'Les chasseurs passent toutes les quelques heures.');
    h += '<div class="carte"><div class="defile"><table class="tableau adaptable"><thead><tr><th>Entreprise</th><th>Lieu</th><th>Son site</th><th>Contact</th><th class="d">Note</th><th>État</th><th></th></tr></thead><tbody>' + rows.map((l) => {
      const site = url(l.website);
      return '<tr><td class="plein"><b>' + esc(l.name) + '</b><small>' + esc([l.sector, SOURCE[l.source] || l.source].filter(Boolean).join(', ')) + '</small></td><td>' + esc(l.commune || '') + '</td><td>' + (site ? '<a href="' + esc(site) + '" target="_blank" rel="noopener noreferrer">' + esc(l.site_state || 'site') + '</a>' : esc(l.site_state || 'aucun')) + (l.data && l.data.audit && l.data.audit.defauts && l.data.audit.defauts.length ? '<small>' + esc(l.data.audit.defauts.join(', ')) + '</small>' : '') + '</td><td>' + (l.email ? esc(l.email) + (l.email_source === 'devine' ? ' <small>deviné</small>' : '') : '') + (l.phone ? '<small><a href="tel:' + esc(String(l.phone).replace(/[^\d+]/g, '')) + '">' + esc(l.phone) + '</a></small>' : '') + '</td><td class="d num">' + esc(l.score || '') + '</td><td><span class="pastille ' + (l.status === 'client' || l.status === 'interesse' ? 'ok' : l.status === 'stop' || l.status === 'ecarte' || l.status === 'perdu' ? '' : 'cobalt') + '">' + esc(LEADS[l.status] || l.status) + '</span>' + (l.data && l.data.interet && ['client', 'stop', 'ecarte', 'perdu'].indexOf(l.status) < 0 ? ' ' + interet(l.data.interet) : '') + (l.reason ? '<small class="serre" title="' + esc(l.reason) + '">' + esc(String(l.reason).slice(0, 160)) + '</small>' : '') + '</td><td>' + (['stop', 'ecarte'].indexOf(l.status) < 0 ? '<button class="btn btn-discret btn-petit" data-act="leadStop" data-id="' + l.id + '" title="Ne plus jamais le contacter">STOP</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }
};

/* ── l'équipe ── */
const equipe = {
  titre: 'Équipe', icone: 'equipe', vivante: true,
  rendre(p) {
    const ordre = ['novalemo', 'groupe', 'studio3d', 'ecom', 'labo'], rang = (id) => { const i = ordre.indexOf(id); return i < 0 ? 9 : i; };
    const cos = S.m.companies.filter((c) => c.status === 'active' && (!p.co || c.id === p.co)).sort((a, b) => rang(a.id) - rang(b.id));
    let h = tete('Équipe', 'Qui dirige qui. Chaque agent a sa fiche de poste, une stratégie qu\'il réécrit lui-même, et rend des comptes à son chef.');
    h += filtres([['', 'Tout le groupe']].concat(S.m.companies.filter((c) => c.status === 'active').sort((a, b) => rang(a.id) - rang(b.id)).map((c) => [c.id, c.name])), p.co, 'co');
    h += '<div class="org">' + cos.map((c) => {
      const ag = S.m.agents.filter((a) => a.company_id === c.id);
      const carteA = (a) => '<button class="agent-c' + (a.kind === 'attente' ? ' attente' : '') + '" data-agent="' + esc(a.id) + '"><span class="avatar petit" style="--c:' + esc(c.color) + '">' + esc(initiales(a.name)) + '</span><span class="l-c"><b>' + esc(a.name) + '</b><span>' + esc(a.kind === 'attente' ? 'Attend : ' + (a.waiting_for || 'un outil') : a.status === 'working' ? (a.current_task || 'Au travail') : a.title) + '</span></span><span class="point ' + esc(a.kind === 'attente' ? 'attente' : a.status) + '"></span></button>';
      let x = '<section class="org-co carte" style="--c:' + esc(c.color) + '"><h2><i></i>' + esc(c.name) + '<small>' + pluriel(ag.length, 'agent') + '</small></h2>';
      const racines = ag.filter((a) => !ag.some((y) => y.id === a.parent_id));
      x += '<div class="equipe">' + racines.map(carteA).join('') + '</div>';
      const file = racines.slice();
      while (file.length) {
        const ch = file.shift(), sous = ag.filter((a) => a.parent_id === ch.id);
        if (!sous.length) continue;
        x += '<div class="chef">L\'équipe de ' + esc(ch.name) + ', ' + esc(String(ch.title || '').toLowerCase()) + '</div><div class="equipe">' + sous.map(carteA).join('') + '</div>';
        file.push.apply(file, sous);
      }
      return x + '</section>';
    }).join('') + '</div>';
    return h;
  }
};

/* ── les décisions ── */
const decisionsS = {
  titre: 'Décisions', icone: 'decisions', vivante: true, chaud: true,
  compte: () => decisions().length,
  rendre() {
    const ds = decisions(), enCours = (S.m.proposals || []).filter((p) => p.status === 'ouverte'), faites = (S.m.proposals || []).filter((p) => p.status === 'validee').slice(0, 10);
    const attente = S.m.agents.filter((a) => a.kind === 'attente');
    let h = tete('Décisions', 'Ce que les équipes ne décident pas seules : ce qui coûte de l\'argent réel, crée un compte, touche à la loi ou lance une entreprise.');
    const ligneP = (p) => '<button class="ligne" data-prop="' + p.id + '"><span class="l-c"><b>' + esc(p.title) + '</b><span>' + esc((PROPK[p.kind] || p.kind) + ', proposé par ' + nom(p.from_id) + (p.cost_month_usd != null ? ', ' + usd(p.cost_month_usd) + ' par mois' : '')) + '</span></span><span class="l-d">' + esc(jourCourt(p.created_at)) + '</span>' + ico('fleche') + '</button>';
    h += '<div class="carte"><h2 class="carte-t">À décider<small>' + ds.length + '</small></h2>' + (ds.length ? '<div class="lignes">' + ds.map(ligneP).join('') + '</div>' : vide('Rien à décider', 'Quand une équipe a besoin de toi, le dossier arrive ici et la balise s\'allume sur le toit de la tour.')) + '</div>';
    if (enCours.length) h += '<div class="carte" style="margin-top:14px"><h2 class="carte-t">En discussion dans les équipes<small>' + enCours.length + '</small></h2><div class="lignes">' + enCours.map(ligneP).join('') + '</div></div>';
    if (faites.length) h += '<div class="carte" style="margin-top:14px"><h2 class="carte-t">Validées</h2><div class="lignes">' + faites.map(ligneP).join('') + '</div></div>';
    h += '<div class="carte" style="margin-top:14px"><h2 class="carte-t">Ce que tes agents attendent<small>' + attente.length + '</small></h2><div class="lignes">' + attente.map((a) => '<button class="ligne" data-agent="' + esc(a.id) + '"><span class="avatar petit" style="--c:' + esc(couleur(a.company_id)) + '">' + esc(initiales(a.name)) + '</span><span class="l-c"><b>' + esc(a.name + ', ' + a.title) + '</b><span>' + esc(a.waiting_for || '') + '</span></span></button>').join('') + '</div></div>';
    return h;
  }
};

/* ── les coûts et le budget ── */
const couts = {
  titre: 'Coûts et budget', court: 'Coûts', icone: 'couts', vivante: true,
  rendre() {
    const j = S.m.jour || {}, b = S.m.budget || {}, hist = S.m.historique || [];
    const sept = hist.slice(-7).reduce((s, x) => s + Number(x.cost_usd || 0), 0), quatorze = hist.reduce((s, x) => s + Number(x.cost_usd || 0), 0);
    const pct = b.jour_usd ? Math.min(100, Number(j.cost_usd || 0) / Number(b.jour_usd) * 100) : 0;
    let h = tete('Coûts et budget', 'Le plafond du jour est respecté par tous les agents, au centime près. Novalemo passe en premier quand il se resserre.');
    h += '<div class="grille g4"><div class="carte">' + chiffre('Aujourd\'hui', usd(j.cost_usd), 'sur un plafond de ' + usd(b.jour_usd)) + '<div class="jauge' + (pct > 85 ? ' chaude' : '') + '" style="margin-top:12px"><i style="width:' + pct.toFixed(0) + '%"></i></div></div><div class="carte">' + chiffre('7 jours', usd(sept)) + '</div><div class="carte">' + chiffre('14 jours', usd(quatorze)) + '</div><div class="carte">' + chiffre('Passages aujourd\'hui', nb(j.runs)) + '</div></div>';
    h += '<div class="carte" style="margin-top:14px"><h2 class="carte-t">Jour par jour<small>14 jours</small></h2>' + courbe(hist, 1100) + '</div>';
    const top = S.m.agents.filter((a) => a.stats && a.stats.runs).sort((a, b) => (b.stats.cout || 0) - (a.stats.cout || 0)).slice(0, 16);
    h += '<div class="grille g2" style="margin-top:14px;align-items:start"><div class="carte"><h2 class="carte-t">Qui coûte, qui produit<small>depuis le début</small></h2>' + (top.length ? '<div class="defile"><table class="tableau"><thead><tr><th>Agent</th><th class="d">Passages</th><th class="d">Coût</th><th class="d">Produits</th></tr></thead><tbody>' + top.map((a) => '<tr><td><a href="#" data-agent="' + esc(a.id) + '">' + esc(a.name) + '</a><small>' + esc(a.title) + '</small></td><td class="d num">' + a.stats.runs + '</td><td class="d num">' + usd(a.stats.cout) + '</td><td class="d num">' + (a.stats.produit || 0) + '</td></tr>').join('') + '</tbody></table></div>' : vide('Pas encore de passages', 'Les chiffres arrivent avec les premiers cycles.')) + '</div>';
    h += '<div class="carte"><h2 class="carte-t">Les plafonds</h2>' +
      champ('bJour', 'Plafond de l\'IA par jour (dollars)', b.jour_usd, 0, 50, 0.25) + champ('bRech', 'Recherches web par jour (1 centime chacune)', b.recherches_jour, 0, 500, 1) + champ('bPlaces', 'Recherches Google Maps par jour', b.places_jour, 0, 500, 1) + champ('bMails', 'Emails envoyés par jour, au plus', b.emails_jour, 0, 200, 1) + champ('bApercus', 'Aperçus fabriqués par jour (3 centimes environ)', b.apercus_jour, 0, 60, 1) + champ('bDomaine', 'Prix maximum d\'un nom de domaine (dollars)', b.domaine_max_usd, 5, 80, 1) +
      '<div class="reglage"><div><b>Pilote automatique</b><span>Emails, réponses, commandes et mises en ligne partent seuls, après le contrôle qualité.</span></div><button class="interrupteur' + (b.envoi_auto ? ' on' : '') + '" id="bAuto" data-bascule aria-label="Pilote automatique"></button></div>' +
      '<div class="ligne-actions" style="margin-top:14px"><button class="btn btn-primaire" data-act="budgetEnregistrer">Enregistrer</button></div></div></div>';
    return h;
  },
  apres(el) { el.querySelectorAll('[data-bascule]').forEach((x) => x.addEventListener('click', () => x.classList.toggle('on'))); }
};
function champ(id, label, v, min, max, pas) { return '<label class="champ"><span>' + esc(label) + '</span><input class="saisie num" id="' + id + '" type="number" min="' + min + '" max="' + max + '" step="' + pas + '" value="' + esc(v) + '"></label>'; }
action('budgetEnregistrer', (b) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'budget', jour_usd: $('#bJour').value, recherches_jour: $('#bRech').value, places_jour: $('#bPlaces').value, emails_jour: $('#bMails').value, apercus_jour: $('#bApercus').value, domaine_max_usd: $('#bDomaine').value, envoi_auto: $('#bAuto').classList.contains('on') }); toast('Plafonds enregistrés.', 'ok'); await rafraichir(); }); });

/* ── la veille et les fiches des autres entreprises ── */
const veille = {
  titre: 'Veille et livrables', court: 'Veille', icone: 'veille', vivante: false,
  async charger(p) { return demo() ? { rows: [] } : lireApi('livrables', { limite: 100, type: p.type || '' }); },
  rendre(p, d) {
    let h = tete('Veille et livrables', 'Ce que produisent le Studio 3D, l\'E-commerce Lab et le Labo : idées, scripts, études de niche, références.');
    h += filtres([['', 'Tout']].concat(['reference', 'repo', 'veille', 'idee', 'script', 'niche', 'etude', 'evaluation'].map((x) => [x, ITEMK[x]])), p.type, 'type');
    const rows = (d && d.rows) || [];
    return h + (rows.length ? rows.map((i) => '<article class="fiche"><div class="fiche-t"><div><b>' + esc(i.title) + '</b><span class="s">' + esc([(ITEMK[i.kind] || i.kind), nom(i.agent_id), (coDe(i.company_id) || {}).name, i.score != null ? i.score + '/100' : '', date(i.created_at)].filter(Boolean).join(', ')) + '</span></div></div>' + (i.body ? '<details class="repli"><summary>Lire</summary><div class="texte-mail">' + esc(i.body) + '</div></details>' : '') + '</article>').join('') : vide('Rien pour l\'instant', 'Les livrables arrivent avec les passages des agents.'));
  }
};

export const SECTIONS = { tableau: tableau, ventes: ventes, reponses: reponses, emails: emails, prospects: prospects, equipe: equipe, decisions: decisionsS, couts: couts, veille: veille };
