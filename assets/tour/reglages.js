// Le pilotage : la mise en route (chaque code collé une fois, essayé avant d'être gardé) et les réglages (boîte d'envoi,
// identité de vente, sécurité, apparence, branchements).
import { $, esc, ico, depuis, date, pluriel, anneau, toast, occupe, dialogue } from './outils.js';
import { lireApi, envoyer, porte } from './api.js';
import { apresChangement } from './porte.js';
import { S, demo, action, rafraichir, chargerMissions, rechargerEtat, majTheme, aller } from './etat.js';

const tete = (titre, texte) => '<div class="s-tete"><div><h1>' + esc(titre) + '</h1>' + (texte ? '<p>' + texte + '</p>' : '') + '</div></div>';
let recharge = null;
export function brancherRechargePilotage(fn) { recharge = fn; }
const recharger = () => { if (recharge) recharge(); };

/* ── la mise en route ── */
const enAttente = {};            // étape -> heure de l'enregistrement (la tour redémarre)
let choisie = null;
function etapes() { const out = []; ((S.mis && S.mis.missions) || []).forEach((m) => m.etapes.forEach((e) => out.push(Object.assign({ mission: m }, e)))); return out; }
function courante() {
  const ms = (S.mis && S.mis.missions) || [];
  const b = ms.find((m) => m.id === 'brancher' && !m.finie) || ms.find((m) => !m.finie && (m.recommande || m.id === 'domaine'));
  return b ? b.prochaine : null;
}
const route = {
  titre: 'Mise en route', icone: 'route', vivante: true, chaud: true,
  compte: () => (S.mis && S.mis.a_faire) || 0,
  async charger() { if (!S.mis) await chargerMissions(); return null; },
  rendre(p) {
    if (!S.mis) return tete('Mise en route') + '<div class="vide">La liste ne se charge pas : recharge la page.</div>';
    const ms = S.mis.missions, b = ms.find((m) => m.id === 'brancher') || { faites: 0, total: 1 };
    const id = (p.etape && etapes().some((e) => e.id === p.etape)) ? p.etape : (choisie && etapes().some((e) => e.id === choisie && !e.fait)) ? choisie : courante() || (etapes()[0] || {}).id;
    const e = etapes().find((x) => x.id === id);
    let h = '<div class="s-tete"><div><h1>Mise en route</h1><p>' + (S.mis.a_faire ? 'Encore ' + pluriel(S.mis.a_faire, 'étape') + '. Chaque code est essayé avant d\'être gardé, puis la tour l\'enregistre elle-même dans Vercel et redémarre.' : 'Tout est branché : la tour tourne seule.') + '</p></div><div style="display:flex;align-items:center;gap:12px">' + anneau(b.faites, b.total, 46) + '<span style="font-size:13px;color:var(--doux)"><b style="display:block;color:var(--encre);font-size:17px">' + b.faites + ' sur ' + b.total + '</b>pour brancher Novalemo</span></div></div>';
    h += '<div class="route"><div class="carte route-liste">' + ms.map((m) => '<h3>' + esc(m.titre) + '</h3>' + m.etapes.map((x, i) => {
      const att = enAttente[x.id] && !x.fait;
      return '<button class="' + (x.fait ? 'fait ' : '') + (x.id === id ? 'on' : '') + '" data-etape="' + esc(x.id) + '"><span class="n">' + (x.fait ? ico('coche') : i + 1) + '</span><span>' + esc(x.titre) + '<small>' + esc(x.fait ? 'fait' : att ? 'redémarrage en cours' : x.bloque ? x.bloque : x.id === courante() ? 'maintenant' : 'à faire') + '</small></span></button>';
    }).join('')).join('') + '</div>';
    h += '<div class="carte etape">' + (e ? carteEtape(e) : '') + '</div></div>';
    return h;
  },
  apres(el) {
    el.querySelectorAll('[data-etape]').forEach((b) => b.addEventListener('click', () => { choisie = b.dataset.etape; aller('gestion/route?etape=' + encodeURIComponent(b.dataset.etape)); }));
    // coller un code suffit : il est vérifié tout de suite
    el.querySelectorAll('input[data-var]').forEach((i) => i.addEventListener('paste', () => setTimeout(() => { const tous = Array.from(el.querySelectorAll('input[data-var]')); if (tous.every((x) => x.value.trim() || x.dataset.facultatif)) { const b = el.querySelector('[data-act="misEnregistrer"]'); if (b && tous.length === 1) b.click(); } }, 60)));
  }
};
function carteEtape(e) {
  const att = enAttente[e.id] && !e.fait;
  let h = '<h2>' + esc(e.titre) + '</h2><p class="pourquoi">' + esc(e.pourquoi || '') + '</p>';
  if (e.fait) {
    h += '<div class="reussite">' + ico('coche') + '<div><b>C\'est fait.</b>' + (e.coche ? '<div class="ligne-actions" style="margin-top:8px"><button class="btn btn-discret btn-petit" data-act="misDecocher" data-id="' + esc(e.id) + '">Pas encore fait finalement</button></div>' : '') + '</div></div>';
    const suite = etapes().find((x) => !x.fait && !x.bloque);
    if (suite) h += '<div class="ligne-actions" style="margin-top:16px"><button class="btn btn-primaire" data-etape-suivante="' + esc(suite.id) + '" data-aller="gestion/route?etape=' + esc(suite.id) + '">Étape suivante : ' + esc(suite.titre) + '</button></div>';
    return h;
  }
  if (e.bloque) return h + '<div class="note">Cette étape vient ' + esc(e.bloque) + '.</div>';
  if (e.faire && e.faire.length) h += '<ol>' + e.faire.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ol>';
  const btn = [];
  (e.liens || []).forEach((l) => btn.push('<a class="btn btn-second" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + ico('externe') + esc(l.texte) + '</a>'));
  (e.copier || []).forEach((c, i) => btn.push('<button class="btn btn-second" data-act="misCopier" data-id="' + esc(e.id) + '" data-i="' + i + '">' + ico('copier') + esc(c.texte) + '</button>'));
  if (btn.length) h += '<div class="ligne-actions" style="margin-bottom:16px">' + btn.join('') + '</div>';
  if (e.champs) h += e.champs.map((c) => '<label class="champ"><span>' + esc(c.label) + '</span><input class="saisie' + (c.type === 'password' ? ' code' : '') + '" data-var="' + esc(c.variable) + '" type="' + (c.type === 'password' ? 'password' : c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : 'text') + '" autocomplete="off" spellcheck="false" value="' + esc(c.valeur || '') + '"' + (c.type === 'password' ? ' placeholder="colle ici"' : '') + '></label>').join('');
  const fin = [];
  if (e.champs) fin.push('<button class="btn btn-primaire" data-act="misEnregistrer" data-id="' + esc(e.id) + '">' + ico('cadenas') + 'Vérifier et enregistrer</button>');
  if (e.action) fin.push(e.action.act === 'identite' ? '<button class="btn btn-primaire" data-aller="gestion/reglages?onglet=identite">' + esc(e.action.texte) + '</button>' : '<button class="btn btn-primaire" data-act="' + esc(e.action.act) + '">' + esc(e.action.texte) + '</button>');
  if (e.coche) fin.push('<button class="btn btn-primaire" data-act="misCocher" data-id="' + esc(e.id) + '">' + ico('coche') + 'C\'est fait</button>');
  if (fin.length) h += '<div class="ligne-actions">' + fin.join('') + '</div>';
  if (e.note) h += '<div class="note">' + esc(e.note) + '</div>';
  if (att) h += '<div class="reussite">' + '<span class="btn btn-discret btn-icone occupe" style="pointer-events:none"></span><div><b>Enregistré et vérifié.</b><br>La tour redémarre avec ce réglage, environ deux minutes : l\'étape passe seule à « fait ». Tu peux continuer pendant ce temps.</div></div>';
  return h;
}
const etapeDe = (id) => etapes().find((e) => e.id === id);
action('misCopier', (b, d) => { const e = etapeDe(d.id), c = e && e.copier && e.copier[Number(d.i)]; if (c) navigator.clipboard.writeText(c.valeur).then(() => toast('Copié.', 'ok'), () => toast('Copie impossible : sélectionne le texte à la main.', 'err')); });
action('misEnregistrer', (b, d) => occupe(b, async () => {
  const valeurs = {};
  document.querySelectorAll('.etape [data-var]').forEach((el) => { if (el.value.trim()) valeurs[el.dataset.var] = el.value.trim(); });
  if (!Object.keys(valeurs).length) throw new Error('Colle d\'abord le code dans le champ.');
  const r = await envoyer({ op: 'mission_enregistrer', valeurs: valeurs });
  if (r.erreur) { document.querySelectorAll('.etape [data-var]').forEach((el) => el.classList.add('erreur')); throw new Error(r.erreur.charAt(0).toUpperCase() + r.erreur.slice(1) + '.'); }
  document.querySelectorAll('.etape [data-var]').forEach((el) => { el.value = ''; });
  enAttente[d.id] = Date.now();
  toast(r.message || 'Enregistré.', 'ok'); if (r.note) toast(r.note);
  const suite = etapes().find((x) => !x.fait && !x.bloque && x.id !== d.id && !enAttente[x.id]);
  choisie = suite ? suite.id : d.id;
  aller('gestion/route' + (suite ? '?etape=' + encodeURIComponent(suite.id) : ''));
  suivre(d.id);
}));
function suivre(id) {
  const debut = Date.now();
  const t = setInterval(async () => {
    await chargerMissions();
    const e = etapeDe(id);
    if ((e && e.fait) || Date.now() - debut > 6 * 60000) { clearInterval(t); delete enAttente[id]; if (e && e.fait) { toast('« ' + e.titre + ' » : fait.', 'ok'); rechargerEtat(); rafraichir(); } }
  }, 15000);
}
action('misCocher', (b, d) => occupe(b, async () => { const r = await envoyer({ op: 'mission_cocher', etape: d.id, fait: true }); if (r.erreur) throw new Error(r.erreur); await chargerMissions(); recharger(); }));
action('misDecocher', (b, d) => occupe(b, async () => { const r = await envoyer({ op: 'mission_cocher', etape: d.id, fait: false }); if (r.erreur) throw new Error(r.erreur); await chargerMissions(); recharger(); }));
action('missionDns', (b) => occupe(b, async () => {
  const r = await envoyer({ op: 'mission_dns' }); const dn = r.dns || {};
  const ok = ['spf', 'dkim', 'dmarc'].filter((x) => dn[x] && dn[x].ok);
  toast(ok.length === 3 ? 'SPF, DKIM et DMARC : tout est bon.' : ok.length + ' sur 3 en place. ' + ['spf', 'dkim', 'dmarc'].filter((x) => !(dn[x] && dn[x].ok)).map((x) => x.toUpperCase()).join(', ') + ' encore à faire (un réglage DNS peut mettre une heure à se voir).', ok.length === 3 ? 'ok' : 'err');
  await chargerMissions(); recharger();
}));

/* ── les réglages ── */
const ONGLETS = [['pilote', 'Pilote'], ['boite', 'Boîte d\'envoi'], ['identite', 'Identité de vente'], ['securite', 'Sécurité'], ['apparence', 'Apparence'], ['branchements', 'Branchements']];
const reglages = {
  titre: 'Réglages', icone: 'reglages', vivante: false,
  async charger(p) {
    const o = p.onglet || 'pilote';
    if (o === 'boite' && S.m.boite && S.m.boite.branchee) return { boite: await lireApi('boite').catch((e) => ({ erreur: e.message })) };
    if (o === 'identite' && !demo()) return { identite: (await lireApi('identite').catch(() => ({}))).identite || {} };
    if (o === 'securite') return { app: await porte.appareils().catch(() => ({ appareils: [] })) };
    if (o === 'branchements' && !S.etat) await rechargerEtat();
    return {};
  },
  rendre(p, d) {
    const o = p.onglet || 'pilote';
    let h = tete('Réglages');
    h += '<div class="filtres">' + ONGLETS.map((x) => '<button data-filtre="' + x[0] + '" data-cle="onglet" class="' + (o === x[0] ? 'on' : '') + '">' + esc(x[1]) + '</button>').join('') + '</div>';
    h += '<div class="carte" style="max-width:760px">' + (ONGLET[o] || ONGLET.pilote)(d || {}) + '</div>';
    return h;
  },
  apres(el) { el.querySelectorAll('[data-bascule]').forEach((x) => x.addEventListener('click', () => x.classList.toggle('on'))); }
};
const ONGLET = {
  pilote() {
    const b = S.m.budget || {};
    return '<div class="reglage"><div><b>Pilote automatique</b><span>Emails, réponses, commandes et mises en ligne partent seuls, après le contrôle qualité. Coupé : tout attend ta validation dans la Gestion.</span></div><button class="interrupteur' + (b.envoi_auto ? ' on' : '') + '" data-act="pilote" data-v="' + (b.envoi_auto ? '0' : '1') + '" aria-label="Pilote automatique"></button></div>' +
      '<div class="reglage"><div><b>Les plafonds</b><span>Coût de l\'IA par jour, emails, aperçus, prix des domaines.</span></div><button class="btn btn-second btn-petit" data-aller="gestion/couts">Ouvrir</button></div>' +
      '<div class="reglage" style="display:block"><b>Nom du groupe</b><div class="ligne-actions" style="margin-top:8px;flex-wrap:nowrap"><input class="saisie" id="gNom" value="' + esc((S.m.groupe || {}).name || '') + '"><button class="btn btn-second" data-act="groupeRenommer">Renommer</button></div></div>';
  },
  boite(d) {
    if (!(S.m.boite && S.m.boite.branchee)) return '<p style="margin:0 0 14px">La boîte qui envoie les emails des agents et reçoit les réponses des prospects n\'est pas encore branchée.</p><button class="btn btn-primaire" data-aller="gestion/route?etape=boite">La brancher</button>';
    const b = d.boite;
    if (!b || b.erreur) return '<p style="color:var(--alerte)">' + esc((b && b.erreur) || 'La boîte ne répond pas.') + '</p>';
    const s = b.stats14;
    let h = '<div class="mini-kpi"><div><small>Aujourd\'hui</small><b>' + b.envoyes_jour + ' / ' + b.quota + '</b></div><div><small>En file</small><b>' + b.prets + '</b></div><div><small>Réponses 14 j</small><b>' + s.reponses + '</b></div></div>';
    if (b.pause) h += '<div class="attend" style="margin-top:14px"><b>En pause</b><br>' + esc(b.raison || '') + '<div class="ligne-actions" style="margin-top:10px"><button class="btn btn-ok btn-petit" data-act="boitePause" data-p="0">Reprendre l\'envoi</button></div></div>';
    h += '<div class="reglage" style="margin-top:8px"><div><b>' + esc(b.adresse) + (b.fournisseur ? ', ' + esc(b.fournisseur) : '') + '</b><span>Les emails partent ' + esc(b.fenetre || '') + ', espacés. La boîte chauffe : 8 par jour au départ, 40 au bout d\'un mois, plus vite si elle reçoit des réponses, moins vite dès que les rebonds ou les STOP montent' + (b.sante && b.sante.raison ? ' (en ce moment : ' + esc(b.sante.raison) + ')' : '') + ', jamais plus que ton plafond de ' + b.plafond + '.</span></div></div>';
    h += '<div class="reglage"><div><b>14 derniers jours</b><span>' + [s.envoyes + ' envoyés', s.reponses + ' réponses', s.stop + ' STOP', s.rebonds + ' adresses invalides', s.absences + ' absences'].join(', ') + '</span></div></div>';
    if (b.dns) h += '<div class="reglage"><div><b>Délivrabilité de ' + esc(b.dns.domaine) + '</b><span>' + ['spf', 'dkim', 'dmarc'].map((x) => x.toUpperCase() + ' ' + (b.dns[x] && b.dns[x].ok ? 'en place' : 'à régler')).join(', ') + '</span></div><button class="btn btn-second btn-petit" data-act="boiteDns">Revérifier</button></div>';
    h += '<div class="reglage"><div><b>Réception</b><span>Dernière relève ' + esc(b.releve_at ? depuis(b.releve_at) : 'jamais') + '. Seuls les messages liés à nos envois sont lus, rien n\'est marqué comme lu.' + (b.erreur_releve ? ' Erreur : ' + esc(b.erreur_releve) : '') + '</span></div></div>';
    h += '<div class="ligne-actions" style="margin-top:12px"><button class="btn btn-second btn-petit" data-act="boiteReleve">Relever maintenant</button><button class="btn btn-second btn-petit" data-act="boiteTest">Tester la connexion</button><button class="btn btn-second btn-petit" data-act="boiteEssai">M\'envoyer un email test</button>' + (b.pause ? '' : '<button class="btn btn-danger btn-petit" data-act="boitePause" data-p="1">Mettre en pause</button>') + '</div>';
    return h;
  },
  identite(d) {
    if (demo()) return '<p style="margin:0">L\'identité de vente se lit dans la base : elle s\'affiche ici dès que la base est branchée.</p>';
    const id = d.identite || {};
    const f = (k, label, ph, type) => '<label class="champ"><span>' + esc(label) + '</span><input class="saisie" id="id_' + k + '" type="' + (type || 'text') + '" value="' + esc(id[k] || '') + '" placeholder="' + esc(ph || '') + '"></label>';
    return '<p style="margin:0 0 16px;color:var(--doux)">Le vendeur sur les conditions de vente et les factures, et le titulaire des noms de domaine réservés pour les clients. Gardé dans ta base, jamais affiché ailleurs.' + (id.source ? ' ' + esc(id.source.charAt(0).toUpperCase() + id.source.slice(1)) + ' : vérifie d\'un coup d\'œil.' : '') + '</p>' +
      '<div class="grille g2" style="gap:0 14px">' + f('entreprise', 'Nom (tel qu\'au registre)', 'Louis Renault') + f('forme', 'Forme', 'EI') + f('siret', 'SIRET', '14 chiffres') + f('marque', 'Nom commercial', 'NOVALEM') + f('prenom', 'Prénom') + f('nom', 'Nom') + f('email', 'Email de contact (sinon la boîte d\'envoi)', '', 'email') + f('telephone', 'Téléphone', '+590 691 00 00 00', 'tel') + f('adresse', 'Adresse du siège') + f('cp', 'Code postal') + f('ville', 'Ville') + f('region', 'Département ou région') + f('pays', 'Pays (2 lettres)', 'FR') + f('mentions_facture', 'Mention en pied de facture (facultatif)', 'TVA non applicable, art. 293 B du CGI.') + '</div>' +
      '<div class="ligne-actions" style="margin-top:6px"><button class="btn btn-primaire" data-act="identiteEnregistrer">Enregistrer</button></div>';
  },
  securite(d) {
    const ap = (d.app && d.app.appareils) || [];
    return '<div class="reglage" style="display:block"><b>Changer le mot de passe</b><span>Toutes les sessions ouvertes sont coupées. La tour redémarre (deux minutes) et te reconnecte toute seule avec le nouveau.</span>' +
      '<div class="grille g2" style="gap:0 14px;margin-top:12px"><label class="champ"><span>Mot de passe actuel</span><input class="saisie" id="mdpActuel" type="password" autocomplete="current-password"></label><label class="champ"><span>Nouveau mot de passe</span><input class="saisie" id="mdpNouveau" type="password" autocomplete="new-password"></label></div><button class="btn btn-primaire btn-petit" data-act="mdpChanger">' + ico('cadenas') + 'Changer</button></div>' +
      '<div class="reglage" style="display:block"><b>Appareils connus</b><span>Chaque nouvel appareil te prévient dans la tour et par email.</span><div class="lignes" style="margin-top:8px">' + (ap.length ? ap.slice(0, 6).map((a) => '<div class="ligne"><span class="l-c"><b>' + esc(a.nom) + (a.ici ? ' (celui-ci)' : '') + '</b><span>' + esc('Vu ' + depuis(a.derniere) + ', adresse ' + a.adresse + ', premier passage ' + date(a.premiere)) + '</span></span></div>').join('') + (ap.length > 6 ? '<p style="color:var(--doux);margin:8px 0 0;font-size:12.5px">Et ' + pluriel(ap.length - 6, 'autre appareil') + ' plus ancien' + (ap.length > 7 ? 's' : '') + '.</p>' : '') : '<p style="color:var(--doux);margin:6px 0 0">La liste se remplit dès que la base est branchée.</p>') + '</div>' +
      '<div class="ligne-actions" style="margin-top:12px"><button class="btn btn-second btn-petit" data-act="partout">Déconnecter les autres appareils</button><button class="btn btn-danger btn-petit" data-act="deconnexion">Me déconnecter</button></div></div>' +
      '<div class="reglage"><div><b>Ce qui protège la tour</b><span>Mot de passe gardé seulement en empreinte (scrypt) dans Vercel, sessions signées de 30 jours fermées côté serveur, chaque essai compté avant d\'être vérifié (5 ratés par adresse puis attente, tes appareils jamais bloqués par les autres), une tour restée sur un ancien mot de passe n\'ouvre plus rien, origine vérifiée sur chaque action, cron fermé par son propre secret, aucun script venu d\'ailleurs.</span></div></div>';
  },
  apparence() {
    let p = 'auto'; try { p = localStorage.getItem('tour_theme') || 'auto'; } catch (e) { /* rien */ }
    return '<div class="reglage"><div><b>Thème</b><span>Selon l\'heure, la ville passe de nuit à 19 h et de jour à 6 h, heure de la Guadeloupe.</span></div></div><div class="filtres">' + [['auto', 'Selon l\'heure'], ['jour', 'Toujours clair'], ['nuit', 'Toujours sombre']].map((x) => '<button data-act="theme" data-v="' + x[0] + '" class="' + (p === x[0] ? 'on' : '') + '">' + esc(x[1]) + '</button>').join('') + '</div>';
  },
  branchements() {
    const e = S.etat || {}, pl = S.m.pilote || {};
    const l = [['Base Supabase', e.base && !demo(), 'Prospects, emails, sites, ventes', 'base'], ['Claude (Anthropic)', e.anthropic, 'Le cerveau des agents'], ['Google Maps', e.google, 'La chasse aux prospects'], ['Boîte d\'envoi', e.envoi, e.boite || 'Emails et réponses', 'boite'], ['Hébergement des sites (Vercel)', e.vercel, 'Aperçus, sites, domaines', 'vercel'], ['Paiement (Stripe)', e.stripe && !e.stripe_test, e.stripe_test ? 'Clé de test : rien n\'est vendu' : 'Cartes, abonnements, factures', 'stripe'], ['Identité de vente', pl.identite, 'Vendeur et titulaire des domaines', 'identite'], ['Photos (Pexels, Pixabay)', e.pexels, 'Les photos des aperçus', 'photos'], ['Cron protégé', e.cron, 'Le passage des 15 minutes']];
    return l.map((x) => '<div class="branchement"><span class="point ' + (x[1] ? 'idle' : 'attente') + '"></span><span class="l-c"><b>' + esc(x[0]) + '</b><span>' + esc(x[2]) + '</span></span>' + (x[1] ? '<span class="pastille ok">branché</span>' : x[3] ? '<button class="btn btn-second btn-petit" data-aller="gestion/route?etape=' + x[3] + '">Brancher</button>' : '<span class="pastille">non</span>') + '</div>').join('');
  }
};
const garde = () => { if (demo()) { toast('La base n\'est pas encore branchée : la mise en route d\'abord.', 'err'); return false; } return true; };
action('groupeRenommer', (b) => { if (garde()) occupe(b, async () => { await envoyer({ op: 'groupe', name: $('#gNom').value }); toast('Renommé.', 'ok'); await rafraichir(); }); });
action('identiteEnregistrer', (b) => { if (garde()) occupe(b, async () => {
  const v = {}; ['entreprise', 'forme', 'siret', 'marque', 'prenom', 'nom', 'email', 'telephone', 'adresse', 'cp', 'ville', 'region', 'pays', 'mentions_facture'].forEach((x) => { const el = $('#id_' + x); if (el) v[x] = el.value; });
  const r = await envoyer(Object.assign({ op: 'identite' }, v));
  toast(r.complete ? 'Identité enregistrée : les noms de domaine peuvent être réservés.' : 'Enregistré. Il manque encore des champs pour réserver les noms de domaine.', r.complete ? 'ok' : 'err');
  await rafraichir(); chargerMissions();
}); });
action('boitePause', (b, d) => occupe(b, async () => { await envoyer({ op: 'boite_pause', pause: d.p === '1' }); toast(d.p === '1' ? 'Envoi en pause.' : 'Envoi repris.', 'ok'); recharger(); }));
action('boiteDns', (b) => occupe(b, async () => { await envoyer({ op: 'boite_dns' }); toast('DNS revérifié.', 'ok'); recharger(); }));
action('boiteReleve', (b) => occupe(b, async () => { const r = await envoyer({ op: 'boite_releve' }); toast(r.resume || 'Relève faite.', r.erreur ? 'err' : 'ok'); rafraichir(); recharger(); }));
action('boiteTest', (b) => occupe(b, async () => { const r = await envoyer({ op: 'boite_test' }); const pb = [r.smtp && !r.smtp.ok ? 'envoi : ' + r.smtp.erreur : '', r.imap && !r.imap.ok ? 'réception : ' + r.imap.erreur : ''].filter(Boolean).join(', '); toast(r.ok ? 'Connexion bonne : envoi et réception (' + (r.fournisseur || '') + ').' : 'Problème, ' + pb, r.ok ? 'ok' : 'err'); }));
action('boiteEssai', (b) => occupe(b, async () => { const r = await envoyer({ op: 'boite_test_envoi' }); toast('Email de test envoyé à ' + r.a + ' : regarde s\'il arrive en boîte de réception.', 'ok'); }));
action('mdpChanger', (b) => occupe(b, async () => {
  const actuel = $('#mdpActuel').value, nouveau = $('#mdpNouveau').value;
  if (!actuel || !nouveau) throw new Error('Remplis les deux champs.');
  const r = await porte.changer(actuel, nouveau);
  $('#mdpActuel').value = ''; $('#mdpNouveau').value = '';
  if (r.note) { toast(r.note, 'err'); return; }
  S.monte = false;
  apresChangement(nouveau, r, { surEntree: () => location.reload() });
}));
action('partout', async (b) => { if (!(await dialogue({ titre: 'Déconnecter les autres appareils ?', texte: 'Ils devront retaper le mot de passe. Celui-ci reste connecté.', ok: 'Déconnecter' }))) return; occupe(b, async () => { await porte.partout(); toast('Les autres appareils sont déconnectés.', 'ok'); recharger(); }); });
action('deconnexion', (b) => occupe(b, async () => { await porte.deconnexion(); location.reload(); }));
action('theme', (b, d) => { try { localStorage.setItem('tour_theme', d.v); } catch (e) { /* rien */ } majTheme(); recharger(); });

export const SECTIONS_PILOTAGE = { route: route, reglages: reglages };
