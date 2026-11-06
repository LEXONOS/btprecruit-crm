// Les missions de Louis : ce qu'il reste à faire une seule fois, étape par étape, chaque étape vérifiée pour de vrai.
// Les codes se collent dans la tour : chacun est essayé avant d'être enregistré (une clé de test, un mot de passe faux,
// un jeton sans accès au projet sont refusés avec la raison), puis la tour l'écrit elle-même dans les variables Vercel
// de son projet (type sensible : illisible ensuite, même par elle) et redémarre. Aucun code n'est gardé en base, ni
// renvoyé à l'écran, ni écrit dans un journal.
'use strict';
const { SUPABASE_URL, NOVALEMO, TOUR_VERCEL } = require('./config');
const { court } = require('./util');

const API = 'https://api.vercel.com';
let FORCE = null;                       // tests : fetch simulé pour Vercel, Supabase et Stripe
function forcer(f) { FORCE = f; }
const iso = function () { return new Date().toISOString(); };

async function appel(url, opts) {
  const r = await (FORCE || fetch)(url, Object.assign({ signal: AbortSignal.timeout(20000) }, opts));
  const d = await r.json().catch(function () { return {}; });
  return { ok: r.ok, statut: r.status, d: d };
}
async function vercel(jeton, methode, chemin, corps, equipe) {
  const url = API + chemin + (equipe ? (chemin.indexOf('?') >= 0 ? '&' : '?') + 'teamId=' + encodeURIComponent(equipe) : '');
  const r = await appel(url, { method: methode, headers: { Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined });
  if (!r.ok) { const e = new Error((r.d.error && r.d.error.message) || ('HTTP ' + r.statut)); e.statut = r.statut; e.code = r.d.error && r.d.error.code; throw e; }
  return r.d;
}
// Le projet de la tour, vu par ce jeton : son identifiant et son équipe sont fixés (config.js). Pas de recherche par nom,
// pas d'autre équipe, pas de compte personnel : un projet du même nom ailleurs ne prouve rien et ne reçoit jamais rien.
async function equipeDuProjet(jeton) {
  try {
    const p = await vercel(jeton, 'GET', '/v9/projects/' + encodeURIComponent(TOUR_VERCEL.projet), null, TOUR_VERCEL.equipe);
    if (!p || p.id !== TOUR_VERCEL.projet) return null;
    return { equipe: TOUR_VERCEL.equipe, projet: { id: p.id, nom: p.name } };
  } catch (e) {
    if (e.statut === 401 || (e.statut === 403 && /token/i.test(e.message))) throw e;
    return null;
  }
}
function cibleSure(cible) { return !!(cible && cible.projet && cible.projet.id === TOUR_VERCEL.projet && cible.equipe === TOUR_VERCEL.equipe); }

/* ── vérifications avant d'enregistrer ── */
async function verifierVercel(v) {
  if (!/^[A-Za-z0-9_-]{16,}$/.test(v)) return { erreur: 'ce n\'est pas un jeton Vercel (copie-le en entier)' };
  try {
    const e = await equipeDuProjet(v);
    if (!e) return { erreur: 'ce jeton ne voit pas le projet de la tour : recrée-le avec Scope « Novalem\'s projects »' };
    return { ok: true, equipe: e.equipe, projet: e.projet };
  } catch (err) { return { erreur: err.statut === 401 || err.statut === 403 ? 'jeton refusé par Vercel (expiré ou mal copié)' : 'Vercel ne répond pas : ' + court(err.message, 80) }; }
}
// Le rôle porté par une ancienne clé Supabase (un jeton signé) : seule service_role donne accès aux tables (la clé
// publique « anon » répond aussi, mais vide, et la tour tomberait en panne à la première écriture)
function roleJwt(v) { try { return JSON.parse(Buffer.from(String(v).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role || null; } catch (e) { return null; } }
async function verifierSupabase(v) {
  if (!/^(eyJ|sb_secret_)/.test(v)) return { erreur: /^sb_publishable_/.test(v) ? 'c\'est la clé publique : il faut la clé secrète (Secret keys)' : 'ce n\'est pas une clé Supabase (elle commence par sb_secret_)' };
  if (/^eyJ/.test(v) && roleJwt(v) !== 'service_role') return { erreur: roleJwt(v) === 'anon' ? 'c\'est la clé publique (anon) : il faut la clé secrète (Secret keys, ou service_role)' : 'ce n\'est pas la clé secrète du projet (Secret keys)' };
  const h = { apikey: v };
  if (/^eyJ/.test(v)) h.Authorization = 'Bearer ' + v;
  const r = await appel(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/hq_config?select=key&limit=1', { headers: h }).catch(function (e) { return { ok: false, statut: 0, d: { message: e.message } }; });
  if (r.ok) return { ok: true };
  if (r.statut === 401 || r.statut === 403) return { erreur: 'clé refusée par Supabase : copie la clé secrète du projet Novalemo' };
  return { erreur: 'Supabase répond : ' + court((r.d && (r.d.message || r.d.hint)) || ('HTTP ' + r.statut), 100) };
}
async function verifierStripe(v) {
  if (/^(sk|rk)_test_/.test(v)) return { erreur: 'c\'est la clé de TEST : coupe le mode test dans Stripe (en haut à droite) et copie la clé secrète live (sk_live_...)' };
  if (!/^(sk|rk)_live_/.test(v)) return { erreur: 'ce n\'est pas une clé secrète Stripe (elle commence par sk_live_)' };
  const r = await appel('https://api.stripe.com/v1/account', { headers: { Authorization: 'Bearer ' + v, 'Stripe-Version': '2024-06-20' } }).catch(function (e) { return { ok: false, statut: 0, d: { error: { message: e.message } } }; });
  if (!r.ok) return { erreur: r.statut === 401 ? 'clé refusée par Stripe (mal copiée ?)' : 'Stripe répond : ' + court((r.d.error && r.d.error.message) || ('HTTP ' + r.statut), 100) };
  if (!r.d.charges_enabled) return { ok: true, compte: r.d.id || null, avertissement: 'clé bonne, mais ton compte Stripe n\'accepte pas encore les paiements : termine son activation (identité, IBAN) sur dashboard.stripe.com, la tour vérifiera seule' };
  return { ok: true, compte: r.d.id || null };
}
// Une clé d'un AUTRE compte Stripe ne remplace jamais une clé qui marche : l'argent partirait ailleurs et les abonnements
// en cours resteraient sur l'ancien compte. Pour changer vraiment de compte : révoquer d'abord l'ancienne clé chez Stripe.
async function memeCompteStripe(nouveau) {
  const ancien = String(process.env.HQ_STRIPE_KEY || '').trim();
  if (!ancien || ancien === nouveau.cle || !/^(sk|rk)_live_/.test(ancien) || !nouveau.compte) return { ok: true };
  const a = await appel('https://api.stripe.com/v1/account', { headers: { Authorization: 'Bearer ' + ancien, 'Stripe-Version': '2024-06-20' } }).catch(function () { return null; });
  if (a && a.ok && a.d && a.d.id && a.d.id !== nouveau.compte) return { erreur: 'cette clé est celle d\'un autre compte Stripe que celui branché : les paiements et les abonnements en cours resteraient sur l\'ancien. Si tu changes vraiment de compte, révoque d\'abord l\'ancienne clé dans Stripe (Développeurs, Clés API), puis recolle la nouvelle' };
  return { ok: true };
}
async function verifierMail(u, p) {
  const r = await require('./mail').testerAvec(u, p).catch(function (e) { return { ok: false, erreur: e.message }; });
  if (r.ok) return { ok: true, fournisseur: r.fournisseur };
  const pb = [r.erreur, r.smtp && !r.smtp.ok ? 'envoi : ' + r.smtp.erreur : '', r.imap && !r.imap.ok ? 'réception : ' + r.imap.erreur : ''].filter(Boolean).join(' ; ');
  return { erreur: 'connexion refusée (' + court(pb, 160) + ')' + (r.aide ? '. Il faut un ' + r.aide : '') };
}
async function verifierWhatsApp(k, n, t) {
  if (!k || !n) return { erreur: 'il faut la clé Kapso et l\'identifiant du numéro' };
  if (t && !require('./martinique').e164(t)) return { erreur: 'numéro affiché illisible (ex. 0696 12 34 56)' };
  try { await require('./whatsapp').tester(k, n); return { ok: true }; }
  catch (e) { return { erreur: e.statut === 401 ? 'clé Kapso refusée' : e.statut === 404 ? 'identifiant du numéro introuvable chez Kapso' : 'Kapso répond : ' + court(e.message, 100) }; }
}
function verifierDomaineApercus(v) { return /^[a-z0-9-]+(\.[a-z0-9-]+){2,}$/.test(String(v).toLowerCase()) ? { ok: true } : { erreur: 'il faut un sous-domaine, par exemple apercu.novalemo.fr' }; }

/* ── écrire dans Vercel et redémarrer la tour ── */
// Toutes les variables d'une étape en une seule requête (une adresse et son mot de passe changent ensemble). Vercel peut
// en accepter une partie : ce qui a raté est réessayé une fois, puis l'étape est défaite (chaque variable reprend sa valeur
// d'avant, une nouvelle est retirée) : jamais une adresse neuve avec l'ancien mot de passe.
async function ecrireVariables(jeton, cible, valeurs) {
  if (!cibleSure(cible)) throw new Error('projet Vercel inattendu : rien n\'est écrit');
  const id = encodeURIComponent(cible.projet.id);
  const chemin = '/v10/projects/' + id + '/env?upsert=true';
  const lot = function (vals, type) { return Object.keys(vals).map(function (k) { return { key: k, value: String(vals[k]), target: ['production'], type: type }; }); };
  const envoyer = async function (vals) {
    try { return await vercel(jeton, 'POST', chemin, lot(vals, 'sensitive'), cible.equipe); }
    catch (e) { if (e.statut === 400) return vercel(jeton, 'POST', chemin, lot(vals, 'encrypted'), cible.equipe); throw e; }
  };
  const nomRate = function (x) { return (x && ((x.error && (x.error.key || x.error.envVarKey)) || x.key)) || null; };
  const sous = function (cles) { const o = {}; cles.forEach(function (k) { o[k] = valeurs[k]; }); return o; };
  const r = await envoyer(valeurs);
  let rates = ((r && r.failed) || []).map(nomRate).filter(Boolean);
  if (!rates.length && r && r.failed && r.failed.length) rates = Object.keys(valeurs);
  if (rates.length) { const r2 = await envoyer(sous(rates)).catch(function () { return null; }); if (r2 && !(r2.failed || []).length) rates = []; }
  if (!rates.length) return;
  const passees = Object.keys(valeurs).filter(function (k) { return rates.indexOf(k) < 0; });
  const avant = {}; passees.forEach(function (k) { if (String(process.env[k] || '').trim()) avant[k] = process.env[k]; });
  if (Object.keys(avant).length) await envoyer(avant).catch(function () {});
  const neuves = passees.filter(function (k) { return !avant[k]; });
  if (neuves.length) {
    const l = await vercel(jeton, 'GET', '/v9/projects/' + id + '/env', null, cible.equipe).catch(function () { return null; });
    for (const e of ((l && l.envs) || []).filter(function (x) { return neuves.indexOf(x.key) >= 0 && (x.target || []).indexOf('production') >= 0; })) await vercel(jeton, 'DELETE', '/v9/projects/' + id + '/env/' + encodeURIComponent(e.id), null, cible.equipe).catch(function () {});
  }
  throw new Error(rates.join(', ') + ' refusé(s), rien n\'a changé : réessaie');
}
// Plus besoin de la protection Vercel pour coller un code : la tour a sa propre porte (mot de passe de Louis, sessions
// signées, voir acces.js) et l'API refuse tout appel sans session. Louis est prévenu de chaque code changé (le nom, jamais la valeur) : dans la tour, et par email s'il remplace un code déjà là
async function prevenir(valeurs, hote) {
  const db = require('./db').open();
  const cles = Object.keys(valeurs);
  const remplaces = cles.filter(function (k) { const avant = String(process.env[k] || '').trim(); return avant && avant !== String(valeurs[k]); });
  if (db) await db.insert('hq_messages', { from_id: 'systeme', to_id: 'louis', company_id: 'groupe', kind: remplaces.length ? 'alerte' : 'note', subject: 'Réglage enregistré : ' + cles.join(', '), body: 'Enregistré depuis la tour (' + (hote || 'adresse inconnue') + ') et vérifié. ' + (remplaces.length ? 'Remplace un code déjà branché : si ce n\'est pas toi, révoque ce code chez son fournisseur tout de suite.' : 'Rien à faire.') }, { returning: false }).catch(function () {});
  const mail = require('./mail');
  const a = mail.identite().adresse;
  if (remplaces.length && mail.branchee() && a) await mail.envoyer({ to: a, subject: 'La tour : un code a été remplacé (' + remplaces.join(', ') + ')', text: 'Bonjour Louis,\n\nUn code déjà branché vient d\'être remplacé dans la tour : ' + remplaces.join(', ') + ' (depuis ' + (hote || 'adresse inconnue') + ').\n\nSi c\'est toi, rien à faire. Sinon, révoque ce code chez son fournisseur (Stripe, Vercel, Supabase, ta boîte mail ou Kapso) et recolle le bon dans la tour.\n\nLa tour' }).catch(function () {});
}
// Un nouveau déploiement de production identique au dernier : il démarre avec les nouvelles variables (2 minutes environ).
// Un redémarrage précédent encore en route est annulé : sinon, fini après celui-ci, il remettrait en ligne une tour sans
// le dernier code collé. Seuls les redémarrages lancés par la tour sont annulés, jamais une mise à jour du code.
async function redemarrer(jeton, cible) {
  if (!cibleSure(cible)) throw new Error('projet Vercel inattendu');
  const pid = encodeURIComponent(cible.projet.id);
  const enCours = await vercel(jeton, 'GET', '/v6/deployments?projectId=' + pid + '&target=production&state=BUILDING,QUEUED,INITIALIZING&limit=10', null, cible.equipe).catch(function () { return {}; });
  for (const x of (enCours.deployments || []).filter(function (d) { return d.meta && d.meta.tour === 'redemarrage'; })) {
    await vercel(jeton, 'PATCH', '/v12/deployments/' + encodeURIComponent(x.uid || x.id) + '/cancel', null, cible.equipe).catch(function () {});
  }
  const l = await vercel(jeton, 'GET', '/v6/deployments?projectId=' + pid + '&target=production&state=READY&limit=1', null, cible.equipe);
  const dep = (l.deployments || [])[0];
  if (!dep) throw new Error('aucun déploiement de production à relancer');
  const d = await vercel(jeton, 'POST', '/v13/deployments?forceNew=1', { name: dep.name || cible.projet.nom, deploymentId: dep.uid || dep.id, target: 'production', meta: { tour: 'redemarrage' } }, cible.equipe);
  return { id: d.id, url: d.url };
}

// Enregistre une ou plusieurs variables (essayées d'abord). Le jeton Vercel s'enregistre avec lui-même ; les autres
// passent par le jeton déjà branché.
const AUTORISEES = ['HQ_VERCEL_TOKEN', 'HQ_SUPABASE_KEY', 'HQ_STRIPE_KEY', 'HQ_MAIL_USER', 'HQ_MAIL_PASS', 'HQ_WHATSAPP_KEY', 'HQ_WHATSAPP_NUMERO', 'HQ_WHATSAPP_TEL', 'HQ_SITES_DOMAINE', 'HQ_PEXELS_KEY', 'HQ_PIXABAY_KEY', 'HQ_GITHUB_TOKEN'];
async function enregistrer(valeurs, ctx) {
  ctx = ctx || {};
  const v = {};
  Object.keys(valeurs || {}).forEach(function (k) { if (AUTORISEES.indexOf(k) >= 0 && String(valeurs[k] || '').trim()) v[k] = String(valeurs[k]).trim(); });
  if (!Object.keys(v).length) return { erreur: 'rien à enregistrer' };
  if (v.HQ_MAIL_PASS && !v.HQ_MAIL_USER) v.HQ_MAIL_USER = process.env.HQ_MAIL_USER || '';
  // chaque code est essayé avant d'être écrit
  let note = null, verif;
  if (v.HQ_VERCEL_TOKEN) { verif = await verifierVercel(v.HQ_VERCEL_TOKEN); if (verif.erreur) return verif; }
  if (v.HQ_SUPABASE_KEY) { const r = await verifierSupabase(v.HQ_SUPABASE_KEY); if (r.erreur) return r; }
  if (v.HQ_STRIPE_KEY) { const r = await verifierStripe(v.HQ_STRIPE_KEY); if (r.erreur) return r; note = r.avertissement || null; const m = await memeCompteStripe({ cle: v.HQ_STRIPE_KEY, compte: r.compte }); if (m.erreur) return m; }
  if (v.HQ_MAIL_USER || v.HQ_MAIL_PASS) { const r = await verifierMail(v.HQ_MAIL_USER, v.HQ_MAIL_PASS || process.env.HQ_MAIL_PASS); if (r.erreur) return r; }
  if (v.HQ_WHATSAPP_KEY || v.HQ_WHATSAPP_NUMERO) { const r = await verifierWhatsApp(v.HQ_WHATSAPP_KEY || process.env.HQ_WHATSAPP_KEY, v.HQ_WHATSAPP_NUMERO || process.env.HQ_WHATSAPP_NUMERO, v.HQ_WHATSAPP_TEL); if (r.erreur) return r; }
  if (v.HQ_SITES_DOMAINE) { const r = verifierDomaineApercus(v.HQ_SITES_DOMAINE); if (r.erreur) return r; v.HQ_SITES_DOMAINE = v.HQ_SITES_DOMAINE.toLowerCase(); }
  if (v.HQ_PEXELS_KEY) { const r = await require('./sites/images').verifier(v.HQ_PEXELS_KEY); if (r.erreur) return r; }
  if (v.HQ_PIXABAY_KEY) { const r = await require('./sites/images').verifierPixabay(v.HQ_PIXABAY_KEY); if (r.erreur) return r; }
  const jeton = v.HQ_VERCEL_TOKEN || String(process.env.HQ_VERCEL_TOKEN || '').trim();
  if (!jeton) return { erreur: 'colle d\'abord le jeton Vercel (première étape) : c\'est lui qui permet à la tour d\'enregistrer les autres codes' };
  const cible = verif && verif.projet ? verif : await equipeDuProjet(jeton).catch(function () { return null; });
  if (!cible) return { erreur: 'le jeton Vercel branché ne voit plus le projet de la tour : recolle un jeton (première étape)' };
  // l'usine du Studio : la tour pose elle-même sur GitHub un secret partagé tout neuf et sa propre adresse, puis garde
  // le jeton et le secret dans ses variables (l'usine ne parle qu'à la tour, et seulement avec ce secret)
  if (v.HQ_GITHUB_TOKEN) {
    const G = require('./studio/github');
    const r = await G.verifier(v.HQ_GITHUB_TOKEN);
    if (r.erreur) return r;
    const secret = require('crypto').randomBytes(32).toString('hex');
    try { await G.poserSecret(v.HQ_GITHUB_TOKEN, 'HQ_USINE_SECRET', secret); await G.poserVariable(v.HQ_GITHUB_TOKEN, 'HQ_TOUR', require('./studio').adresseTour()); }
    catch (e) { return { erreur: 'GitHub a refusé le secret de l\'usine : ' + court(e.message, 100) + ' (vérifie les permissions Secrets et Variables du jeton)' }; }
    v.HQ_USINE_SECRET = secret;
  }
  try { await ecrireVariables(jeton, cible, v); }
  catch (e) { return { erreur: 'Vercel a refusé l\'enregistrement : ' + court(e.message, 100) }; }
  await prevenir(v, ctx.hote).catch(function () {});
  let dep = null;
  try { dep = await redemarrer(jeton, cible); } catch (e) { return { ok: true, enregistre: Object.keys(v), note: 'enregistré, mais le redémarrage automatique a échoué (' + court(e.message, 80) + ') : Vercel, projet btprecruit-crm, Deployments, « Redeploy »' }; }
  return { ok: true, enregistre: Object.keys(v), redemarrage: dep.id, note: note, message: 'Enregistré et vérifié. La tour redémarre avec ce réglage : environ 2 minutes.' };
}

/* ── l'état des missions ── */
async function lireCle(db, k) { const r = await db.one('hq_config', { eq: { key: k } }); return (r && r.value) || null; }
const COCHABLES = ['factures', 'activite', 'titulaire', 'sim', 'kapso'];
async function cocher(db, etape, fait) {
  if (COCHABLES.indexOf(etape) < 0) return { erreur: 'étape inconnue' };
  const cur = (await lireCle(db, 'missions')) || {};
  const coches = Object.assign({}, cur.coches || {});
  if (fait) coches[etape] = iso(); else delete coches[etape];
  await db.upsert('hq_config', { key: 'missions', value: Object.assign({}, cur, { coches: coches }), updated_at: iso() }, { onConflict: 'key' });
  return { ok: true };
}

async function etat(db) {
  const V = require('./sites/vercel'), S = require('./sites/stripe'), mail = require('./mail'), W = require('./whatsapp');
  let base = false, coches = {}, id = null, boite = {}, demande = null, domaines = 0, waRecu = false, pub = {};
  if (db) {
    try {
      const cfg = await db.select('hq_config', { in: { key: ['missions', 'identite', 'boite', 'publication'] } });
      const val = function (k) { const r = cfg.find(function (c) { return c.key === k; }); return (r && r.value) || {}; };
      coches = val('missions').coches || {}; id = val('identite'); boite = val('boite'); pub = val('publication');
      base = true;
      demande = await require('./jobs/whatsapp').demande(db).catch(function () { return null; });
      domaines = await db.count('hq_sites', { eq: { domaine_mode: 'achat' }, in: { status: ['livraison', 'en_ligne', 'pause'] } }).catch(function () { return 0; });
      waRecu = !!(await db.one('hq_inbox', { eq: { subject: 'WhatsApp' }, select: 'id' }).catch(function () { return null; }));
    } catch (e) { base = false; }
  }
  const ident = require('./jobs/livraison').identiteComplete(id);
  const dns = boite.dns || null;
  const dnsOk = !!(dns && dns.spf && dns.spf.ok && dns.dkim && dns.dkim.ok && dns.dmarc && dns.dmarc.ok);
  const adresse = mail.identite().adresse || '';
  const domaineMail = adresse.split('@')[1] || '';
  const stripeLive = S.branche() && !S.modeTest();
  const c = function (k) { return !!coches[k]; };
  const pied = S.piedFacture(id || {}, true);

  const brancher = { id: 'brancher', titre: 'Brancher Novalemo', but: 'Une seule fois. Ensuite la tour trouve, vend, encaisse et met en ligne toute seule.', etapes: [
    { id: 'vercel', titre: 'Le jeton Vercel', pourquoi: 'Il héberge les aperçus et les sites, réserve les noms de domaine, et laisse la tour enregistrer tes autres codes à ta place.', faire: ['Ouvre la page des jetons.', 'Clique Create Token. Nom : La Tour. Scope : Novalem\'s projects. Expiration : No Expiration. Puis Create.', 'Copie le jeton et colle-le ici.'], liens: [{ texte: 'Ouvrir les jetons Vercel', url: 'https://vercel.com/account/tokens' }], champs: [{ variable: 'HQ_VERCEL_TOKEN', label: 'Jeton Vercel', type: 'password' }], fait: V.branche() },
    { id: 'base', titre: 'La base Supabase', pourquoi: 'La mémoire de la tour : prospects, emails, sites, ventes. Les tables sont déjà créées.', faire: ['Ouvre les clés du projet Novalemo.', 'Dans Secret keys, copie la clé (bouton copier à droite).', 'Colle-la ici.'], liens: [{ texte: 'Ouvrir les clés Supabase', url: 'https://supabase.com/dashboard/project/fbmzlfrwxrzflfkazvmn/settings/api-keys' }], champs: [{ variable: 'HQ_SUPABASE_KEY', label: 'Clé secrète Supabase', type: 'password' }], fait: base },
    { id: 'stripe', titre: 'Le paiement Stripe', pourquoi: 'Les clients paient par carte, en une fois ou au mois ; l\'argent arrive sur ton compte Stripe, les factures partent seules.', faire: ['Ouvre les clés Stripe, mode test coupé (interrupteur en haut à droite).', 'Clé secrète : Révéler, puis copie (elle commence par sk_live_).', 'Colle-la ici. Si Stripe te demande d\'activer le compte, fais-le d\'abord (identité, IBAN).'], liens: [{ texte: 'Ouvrir les clés Stripe', url: 'https://dashboard.stripe.com/apikeys' }], champs: [{ variable: 'HQ_STRIPE_KEY', label: 'Clé secrète live', type: 'password' }], fait: stripeLive, note: S.branche() && S.modeTest() ? 'La clé branchée est une clé de test : rien n\'est vendu tant que ce n\'est pas la clé live.' : null },
    { id: 'boite', titre: 'Ta boîte d\'envoi', pourquoi: 'Les emails partent de ton adresse et les réponses reviennent dans la tour. La connexion est essayée avant d\'enregistrer.', faire: ['Écris l\'adresse qui enverra les emails (celle de ton domaine).', 'Écris son mot de passe. Pour une adresse Google, crée un mot de passe d\'application (bouton).', 'Clique Vérifier et enregistrer.'], liens: [{ texte: 'Mot de passe d\'application Google', url: 'https://myaccount.google.com/apppasswords' }], champs: [{ variable: 'HQ_MAIL_USER', label: 'Adresse d\'envoi', type: 'email', valeur: adresse || '' }, { variable: 'HQ_MAIL_PASS', label: 'Mot de passe de la boîte', type: 'password' }], fait: mail.branchee() },
    { id: 'identite', titre: 'Ton identité de vente', pourquoi: 'Le vendeur sur les factures et les conditions de vente, et le titulaire des noms de domaine des clients.', faire: ['Ouvre le formulaire.', 'Remplis nom, adresse, SIRET, téléphone.', 'Enregistre.'], action: { texte: 'Remplir mon identité', act: 'identite' }, fait: ident, bloque: !base ? 'après la base' : null },
    { id: 'dns', titre: 'Tes emails arrivent en boîte de réception', pourquoi: 'SPF, DKIM et DMARC prouvent que les emails viennent bien de toi. Sans eux, ils tombent en indésirables.', faire: dns ? ['spf', 'dkim', 'dmarc'].filter(function (k) { return dns[k] && !dns[k].ok; }).map(function (k) { return k.toUpperCase() + ' : ' + (dns[k].conseil || 'à activer chez l\'hébergeur du domaine'); }).concat(['Puis clique Vérifier (un réglage DNS peut mettre une heure à se voir).']) : mail.branchee() ? ['Clique Vérifier : la tour lit les réglages de ton domaine et te dit exactement quoi ajouter.'] : ['Branche d\'abord ta boîte d\'envoi, la tour lira ton domaine toute seule.'], liens: domaineMail ? [{ texte: 'Zone DNS de ' + domaineMail + ' (OVH)', url: 'https://www.ovh.com/manager/#/web/domain/' + domaineMail + '/zone' }] : [], action: mail.branchee() && base ? { texte: 'Vérifier', act: 'missionDns' } : null, fait: dnsOk, bloque: !mail.branchee() ? 'après la boîte d\'envoi' : null },
    { id: 'factures', titre: 'Les mentions sur les factures au mois', pourquoi: 'Les factures des abonnements sont faites par Stripe : on lui donne une fois tes mentions obligatoires (vendeur, SIRET, TVA non applicable, pénalités).', faire: ['Copie le texte (bouton).', 'Ouvre les réglages des factures Stripe, champ « Pied de page par défaut » (Default footer), colle, enregistre.', 'Coche « C\'est fait ».'], liens: [{ texte: 'Ouvrir les réglages des factures', url: 'https://dashboard.stripe.com/settings/billing/invoice' }], copier: [{ texte: 'Copier les mentions', valeur: pied }], coche: true, fait: c('factures'), bloque: !ident ? 'après ton identité de vente' : null },
    { id: 'photos', titre: 'Les photos d\'illustration', pourquoi: 'Quand une entreprise n\'a pas de photos, Léa, l\'iconographe, choisit pour son aperçu des photos de son métier, libres de droits (Pexels, gratuit), les décrit et les regarde une à une avant de les poser : le métier doit se reconnaître, aucun visage, aucun logo. Le photographe est crédité dans les mentions légales. Sans cette clé, beaucoup d\'aperçus restent sans photo.', faire: ['Ouvre la page API de Pexels et connecte-toi (ou crée ton compte gratuit).', 'Clique « Your API Key », remplis le petit formulaire (projet : sites internet pour des entreprises de Martinique), puis copie la clé.', 'Colle-la ici : elle est essayée avant d\'être enregistrée.'], liens: [{ texte: 'Ouvrir Pexels API', url: 'https://www.pexels.com/api' }], champs: [{ variable: 'HQ_PEXELS_KEY', label: 'Clé API Pexels', type: 'password' }], fait: !!String(process.env.HQ_PEXELS_KEY || '').trim() },
    { id: 'activite', titre: 'Ton activité déclarée', pourquoi: 'Les factures partent à ton nom : la création de sites doit figurer sur ta micro-entreprise (ton code APE actuel est celui du recrutement).', faire: ['Ouvre le guichet des formalités.', 'Modification, ajout d\'une activité : création de sites internet.', 'Coche « C\'est fait ».'], liens: [{ texte: 'Ouvrir le guichet', url: 'https://formalites.entreprises.gouv.fr' }], coche: true, fait: c('activite') }
  ] };
  const domaine = { id: 'domaine', titre: 'Ton premier nom de domaine', but: 'Le premier domaine acheté pour un client demande une validation de ton email, une seule fois.', visible: domaines > 0 || c('titulaire'), etapes: [
    { id: 'titulaire', titre: 'Valider l\'email du titulaire', pourquoi: 'Le registre des noms de domaine vérifie l\'email du titulaire. Sans clic, le domaine est suspendu sous 15 jours.', faire: ['Cherche dans ta boîte l\'email de vérification du registre (expéditeur Vercel ou registrar).', 'Clique le lien.', 'Coche « C\'est fait ».'], coche: true, fait: c('titulaire') }
  ] };
  const waBranche = W.branche();
  const whatsapp = { id: 'whatsapp', titre: 'WhatsApp', but: demande ? demande.whatsapp + ' prospect(s) ont demandé WhatsApp et ' + demande.appel + ' un appel ces 30 derniers jours' + (demande.whatsapp >= demande.seuil ? ' : ça vaut le coup.' : ' (seuil : ' + demande.seuil + '). Rien ne presse.') : 'Pour les clients qui préfèrent écrire sur WhatsApp. Emma y répond comme par email.', recommande: !!(demande && demande.whatsapp >= demande.seuil), visible: true, etapes: [
    { id: 'sim', titre: 'Une SIM de Martinique', pourquoi: 'Un numéro 0696 ou 0697 rassure les clients. Il ne servira qu\'à WhatsApp.', faire: ['Prends la SIM la moins chère (Orange, SFR Caraïbe, Digicel ou Free Caraïbe).', 'Mets-la dans un vieux téléphone le temps de recevoir un code par SMS.', 'Coche « C\'est fait ».'], coche: true, fait: c('sim') || waBranche },
    { id: 'kapso', titre: 'Le compte Kapso', pourquoi: 'Kapso relie le numéro à la tour (gratuit jusqu\'à 2 000 messages par mois).', faire: ['Ouvre Kapso et crée le compte.', 'Connecte un numéro WhatsApp : ton numéro, puis le code reçu par SMS.', 'Coche « C\'est fait ».'], liens: [{ texte: 'Ouvrir Kapso', url: 'https://app.kapso.ai' }], coche: true, fait: c('kapso') || waBranche },
    { id: 'codes', titre: 'Les codes WhatsApp', pourquoi: 'La tour lit les messages reçus et répond avec eux. Ils sont essayés avant d\'être enregistrés.', faire: ['Dans Kapso : la clé API du projet (API keys).', 'L\'identifiant du numéro (Phone number ID, sur la fiche du numéro).', 'Le numéro tel qu\'il s\'affiche.'], champs: [{ variable: 'HQ_WHATSAPP_KEY', label: 'Clé API Kapso', type: 'password' }, { variable: 'HQ_WHATSAPP_NUMERO', label: 'Identifiant du numéro', type: 'text' }, { variable: 'HQ_WHATSAPP_TEL', label: 'Numéro (ex. 0696 12 34 56)', type: 'tel' }], fait: waBranche },
    { id: 'essai', titre: 'L\'essai', pourquoi: 'Pour voir la boucle tourner.', faire: ['Depuis ton téléphone, écris « test » au numéro WhatsApp.', 'Dans 5 minutes, le message apparaît dans la tour et Emma répond.'], fait: waRecu, bloque: !waBranche ? 'après les codes' : null }
  ] };
  const apercus = { id: 'apercus', titre: 'Les aperçus sur ton domaine', but: 'Facultatif : des liens d\'aperçu à ton nom (apercu.novalemo.fr) arrivent mieux en boîte de réception qu\'une adresse vercel.app.', visible: true, etapes: [
    { id: 'cname', titre: 'Le sous-domaine', pourquoi: 'Un seul enregistrement chez l\'hébergeur de ton domaine.', faire: ['Dans la zone DNS de ton domaine : un CNAME « apercu » vers cname.vercel-dns.com.', 'Écris ici l\'adresse complète, puis Vérifier et enregistrer.'], copier: [{ texte: 'Copier la cible du CNAME', valeur: 'cname.vercel-dns.com' }], champs: [{ variable: 'HQ_SITES_DOMAINE', label: 'Sous-domaine (ex. apercu.novalemo.fr)', type: 'text' }], fait: !!(process.env.HQ_SITES_DOMAINE && pub.hote_perso_ok) }
  ] };
  // facultatif : une seconde banque de photos, deux fois plus de choix pour Léa
  const plusPhotos = { id: 'photos2', titre: 'Plus de photos pour les aperçus', but: 'Facultatif : une seconde banque de photos libres (Pixabay) double le choix de Léa ; plus d\'aperçus ouvrent sur une vraie photo du métier.', visible: true, etapes: [
    { id: 'pixabay', titre: 'La clé Pixabay', pourquoi: 'Pixabay est une banque de photos libres de droits, gratuite, usage commercial permis. Léa y cherche en même temps que sur Pexels, décrit chaque photo et ne garde que les bonnes.', faire: ['Crée ton compte gratuit sur Pixabay (ou connecte-toi).', 'Ouvre la page API de Pixabay : connecté, ta clé est écrite dans l\'encadré « Parameters », à la ligne « key ». Copie-la.', 'Colle-la ici : elle est essayée avant d\'être enregistrée.'], liens: [{ texte: 'Ouvrir Pixabay API', url: 'https://pixabay.com/api/docs/' }], champs: [{ variable: 'HQ_PIXABAY_KEY', label: 'Clé API Pixabay', type: 'password' }], fait: !!String(process.env.HQ_PIXABAY_KEY || '').trim() }
  ] };
  const G = require('./studio/github');
  let rendues = 0;
  if (base) rendues = await db.count('hq_videos', { in: { status: ['critique', 'traduction', 'langues', 'prete', 'publiee'] } }).catch(function () { return 0; });
  const studio = { id: 'studio', titre: 'Brancher le Studio 3D', but: 'Une seule fois : les vidéos se fabriquent ensuite toutes seules (script, scène 3D, voix, montage, traductions), gratuitement, sur GitHub.', recommande: true, visible: true, etapes: [
    { id: 'usine', titre: 'Le jeton GitHub de l\'usine', pourquoi: 'L\'usine du Studio (voix, 3D, montage) tourne sur GitHub, gratuitement : le dépôt de la tour est public. Ce jeton laisse la tour lancer l\'usine et lui poser son code secret. Il ne voit que ce dépôt.', faire: ['Ouvre la page des jetons GitHub (bouton).', 'Token name : La Tour Usine. Resource owner : LEXONOS. Expiration : la plus longue proposée.', 'Repository access : Only select repositories, puis btprecruit-crm.', 'Permissions : clique « + Add permissions », coche Actions, Secrets et Variables (Variables n\'y est pas d\'office), puis passe chacune des trois sur « Read and write » (Metadata reste en Read-only, c\'est normal).', 'Generate token, copie-le et colle-le ici : la tour fait le reste. Un jeton déjà créé sans Variables : sur GitHub, ouvre-le, Edit, ajoute Variables en Read and write, Update, puis recolle-le ici.'], liens: [{ texte: 'Créer le jeton GitHub', url: 'https://github.com/settings/personal-access-tokens/new' }], champs: [{ variable: 'HQ_GITHUB_TOKEN', label: 'Jeton GitHub (github_pat_...)', type: 'password' }], fait: G.branche() },
    { id: 'premiere', titre: 'La première vidéo', pourquoi: 'Pour voir la chaîne tourner de bout en bout : Sacha trouve l\'accroche, Clara écrit, Félix juge la viralité, Hélène vérifie les faits, Oscar monte la scène, l\'usine rend, Vera juge, Romane et Nina écrivent les autres langues.', faire: ['Rien à faire : elle arrive dans Studio en deux à trois heures (l\'écriture, puis 10 à 15 minutes de fabrication par langue).'], fait: rendues > 0, bloque: !G.branche() ? 'après le jeton GitHub' : null }
  ] };
  const missions = [brancher, studio, domaine, whatsapp, apercus, plusPhotos].filter(function (m) { return m.visible !== false; }).map(function (m) {
    const faites = m.etapes.filter(function (e) { return e.fait; }).length;
    const prochaine = m.etapes.find(function (e) { return !e.fait && !e.bloque; }) || null;
    return Object.assign({}, m, { faites: faites, total: m.etapes.length, finie: faites === m.etapes.length, prochaine: prochaine ? prochaine.id : null });
  });
  const aFaire = missions.filter(function (m) { return m.id === 'brancher' || m.id === 'domaine' || m.recommande; }).reduce(function (t, m) { return t + (m.total - m.faites); }, 0);
  return { missions: missions, a_faire: aFaire, base: base, jeton: V.branche(), deploiement: process.env.VERCEL_DEPLOYMENT_ID || null };
}

module.exports = { etat, enregistrer, cocher, verifierStripe, verifierSupabase, verifierVercel, roleJwt, forcer, AUTORISEES, ecrireVariables, redemarrer, equipeDuProjet };
