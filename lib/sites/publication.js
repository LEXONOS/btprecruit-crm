// La publication : l'état de tous les sites (aperçus et sites en ligne) devient UN déploiement de production du
// projet public. Un seul déploiement à la fois (jamais deux qui se marchent dessus), rendu refait à chaque fois
// depuis les fiches (une amélioration du moteur profite à tous les sites), fichiers envoyés une fois par empreinte.
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('./vercel');
const R = require('./rendu');
const T = require('./theme');
const { NOVALEMO } = require('../config');
const { court } = require('../util');
const { majFraiche } = require('../db');

const CLE = 'publication';
const PUBLIABLES = ['brouillon', 'apercu', 'commande', 'paye', 'livraison', 'en_ligne'];
const iso = function (t) { return new Date(t || Date.now()).toISOString(); };

async function lireEtat(db) { const r = await db.one('hq_config', { eq: { key: CLE } }); return (r && r.value) || {}; }
async function ecrireEtat(db, patch) { const v = Object.assign({}, await lireEtat(db), patch); await db.upsert('hq_config', { key: CLE, value: v, updated_at: iso() }, { onConflict: 'key' }); return v; }
async function identite(db) { const r = await db.one('hq_config', { eq: { key: 'identite' } }); return (r && r.value) || null; }

function urlApercu(hote, slug) { return 'https://' + hote + '/a/' + slug + '/'; }
function urlNovalemo(hote, chemin) { return 'https://' + hote + '/_n/' + chemin; }

/* ── pages de Novalemo servies avec les sites : conditions de vente, merci après paiement ── */
function pageNovalemo(titre, corps) {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + R.esc(titre) + ' · Novalemo</title><meta name="robots" content="noindex">' +
    '<style>@font-face{font-family:Inter;src:url(/_f/inter.woff2) format("woff2");font-weight:100 900;font-display:swap}*{box-sizing:border-box}body{margin:0;background:#f6f5ef;color:#0f1a16;font:400 1.02rem/1.65 Inter,system-ui,sans-serif}main{width:min(760px,100% - 40px);margin:0 auto;padding:64px 0 90px}h1{font:750 clamp(2rem,6vw,3.2rem)/1.05 Inter,sans-serif;letter-spacing:-.035em;margin:0 0 26px}h2{font:650 1.15rem/1.3 Inter,sans-serif;margin:30px 0 8px}p,li{color:#3a4642}a{color:#0aa37d}.k{font:600 .78rem/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#0aa37d;margin:0 0 18px}.box{background:#fff;border-radius:18px;padding:26px 28px;margin:26px 0;border:1px solid #e6e4da}</style></head><body><main>' + corps + '</main></body></html>';
}
function cgv(id) {
  const g = NOVALEMO.grille;
  const v = id && id.entreprise ? R.esc(id.entreprise) + (id.forme ? ', ' + R.esc(id.forme) : '') + (id.siret ? ', SIRET ' + R.esc(id.siret) : '') + (id.adresse ? ', ' + R.esc([id.adresse, id.cp, id.ville].filter(Boolean).join(' ')) : '') : 'Novalemo';
  return pageNovalemo('Conditions de vente', '<p class="k">Novalemo · Sites internet en Martinique</p><h1>Conditions de vente</h1>' +
    '<p>Les sites Novalemo sont vendus par ' + v + (id && id.marque ? ' (marques Novalemo et ' + R.esc(id.marque) + ')' : '') + '. Contact : ' + R.esc((id && id.email) || require('../mail').identite().adresse || '') + '.</p>' +
    '<h2>1. Ce que vous achetez</h2><p>La création de votre site internet et sa mise en ligne sur un nom de domaine, selon la formule choisie : ' + ['essentiel', 'vitrine', 'signature'].map(function (k) { return '<strong>' + g[k].nom + '</strong> ' + g[k].prix + ' € (' + R.esc(g[k].quoi) + ')'; }).join(', ') + '. Vous avez vu et validé l\'aperçu de votre site avant de payer.</p>' +
    '<h2>2. Prix et paiement</h2><p>Deux façons de payer, au choix, par carte : en une fois au moment de la commande, ou au mois (' + ['essentiel', 'vitrine', 'signature'].map(function (k) { return g[k].nom + ' ' + g[k].mois + ' € par mois'; }).join(', ') + '). Prix nets. TVA non applicable, article 293 B du CGI. Une facture vous est envoyée à chaque paiement.</p>' +
    '<h2>2 bis. Abonnement au mois</h2><p>Le premier mois est payé à la commande, puis chaque mois automatiquement sur la même carte. Engagement de ' + NOVALEMO.abonnement.engagement_mois + ' mois à compter de la commande. Vous pouvez demander l\'arrêt à tout moment, par simple email : pendant l\'engagement, il prend effet à la fin des ' + NOVALEMO.abonnement.engagement_mois + ' mois (les mensualités jusque-là sont prélevées normalement) ; après, à la fin du mois en cours. Un mois avant la fin de l\'engagement, un email vous le rappelle ; sans demande d\'arrêt, l\'abonnement continue au mois, sans engagement. L\'abonnement comprend l\'hébergement, le nom de domaine et une série de retouches chaque mois. À l\'arrêt, le site reste à vous et continue avec l\'hébergement seul (' + NOVALEMO.hebergement_an_eur + ' € par an). Un prélèvement refusé vous est signalé par email avec un lien pour régler ; sans règlement 14 jours plus tard, le site est mis en pause, puis remis en ligne dès le paiement. Si l\'abonnement s\'arrête faute de paiement, un lien permet de le reprendre aux mêmes conditions ; les mensualités restant dues jusqu\'à la fin de l\'engagement restent exigibles.</p>' +
    '<h2>3. Mise en ligne</h2><p>Le site est mis en ligne automatiquement après le paiement, en général dans l\'heure. Si vous avez déjà un nom de domaine, il est relié dès que vous avez fait le réglage indiqué par email. Si le site ne peut pas être mis en ligne dans les 14 jours suivant le paiement de notre fait, vous êtes remboursé en totalité.</p>' +
    '<h2>4. Hébergement et nom de domaine</h2><p>Paiement en une fois : l\'hébergement et le nom de domaine sont inclus la première année. Ensuite : ' + NOVALEMO.hebergement_an_eur + ' € par an, sans engagement, payables par carte sur le lien envoyé par email un mois avant l\'échéance ; une facture suit chaque paiement. Sans règlement 30 jours après l\'échéance, le site est mis en pause, puis remis en ligne dès le paiement. Le nom de domaine est réservé et géré pour vous ; il vous est transféré sur simple demande, ainsi que les fichiers du site.</p>' +
    '<h2>5. Retouches</h2><p>' + NOVALEMO.revisions_avant + ' séries de retouches avant paiement, puis ' + NOVALEMO.revisions_apres + ' dans les 30 jours après la mise en ligne (paiement en une fois) ou une chaque mois (abonnement), par simple email. Au-delà, chaque évolution fait l\'objet d\'un devis.</p>' +
    '<h2>6. Propriété</h2><p>Une fois payé (en une fois, ou au terme de l\'engagement pour l\'abonnement), le site vous appartient : textes, images que vous avez fournies et mise en page. Vous garantissez avoir les droits sur les contenus que vous nous transmettez. Les informations légales affichées sur votre site (raison sociale, SIRET, adresse) relèvent de votre responsabilité ; nous les reprenons des registres officiels et vous pouvez les corriger à tout moment.</p>' +
    '<h2>7. Réclamations</h2><p>Par email, réponse sous 48 heures ouvrées. Droit applicable : droit français.</p>');
}
function merci() {
  return pageNovalemo('Paiement reçu', '<p class="k">Novalemo</p><h1>Merci, c\'est payé.</h1><div class="box"><p>Votre site se met en ligne automatiquement. Vous recevez un email dès qu\'il est visible sur votre adresse, en général dans l\'heure.</p><p>Votre facture arrive aussi par email.</p></div><p>Une question, une retouche ? Répondez simplement à nos emails.</p>');
}
// Ce que voient les visiteurs d'un site en pause : neutre, sans rien dire du client ni de Novalemo
function pause() {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Site momentanément indisponible</title><meta name="robots" content="noindex">' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f6f5ef;color:#3a4642;font:400 1.05rem/1.6 system-ui,sans-serif;text-align:center}</style></head><body><p>Ce site est momentanément indisponible.<br>Merci de revenir un peu plus tard.</p></body></html>';
}

// Les fiches qui ne se rendent plus : Louis prévenu une fois par panne (une fiche réparée puis cassée à nouveau l'est encore)
async function signalerRates(db, rates, arret) {
  const etat = await lireEtat(db).catch(function () { return {}; });
  const deja = new Set((etat.rates_signales || []).map(Number));
  const nouveaux = rates.filter(function (x) { return !deja.has(Number(x.id)); });
  if (nouveaux.length) await db.insert('hq_messages', { from_id: 'livraison', to_id: 'louis', company_id: 'novalemo', kind: 'alerte', subject: nouveaux.length + ' site(s) impossible(s) à rendre', body: nouveaux.slice(0, 5).map(function (x) { return '#' + x.id + ' ' + x.nom + (x.live ? ' (EN LIGNE)' : '') + ' : ' + x.erreur; }).join('\n') + (arret ? '\nUn site en ligne est touché : la publication est arrêtée et la version précédente reste en ligne pour tous les sites, jusqu\'à correction de sa fiche.' : '\nLes autres sites sont publiés normalement ; ceux-ci sont absents de la publication tant que leur fiche n\'est pas corrigée.') }, { returning: false }).catch(function () {});
  const liste = rates.map(function (x) { return x.id; }).slice(0, 50);
  if (JSON.stringify(liste) !== JSON.stringify(etat.rates_signales || [])) await ecrireEtat(db, { rates_signales: liste }).catch(function () {});
}

/* ── fichiers d'un site ── */
// Les images sont rangées dans la fiche : { fichier, sha, taille, source?, fichier_id? } ; leurs octets sont chez Vercel (et pour les clients en base)
function images(spec) { return [].concat(spec.logo ? [spec.logo] : [], spec.photos || []).filter(function (x) { return x && x.fichier && x.sha; }); }
function rendreSite(site, mode, ctx) {
  const domaine = site.domaine;
  const r = R.rendre(site, { mode: mode, url: mode === 'live' && domaine ? 'https://' + domaine + '/' : null, identite: ctx.identite, contactNovalemo: ctx.contactNovalemo, optimiseur: ctx.optimiseur });
  const racine = (mode === 'live' ? 's/' : 'a/') + site.slug + '/';
  const imgs = images(site.spec || {}).map(function (i) { return { file: racine + 'img/' + i.fichier, sha: i.sha, size: i.taille, image: i }; });
  return { textes: r.files.map(function (f) { const b = Buffer.from(f.data); return { file: f.file, data: b, sha: V.sha1(b), size: b.length }; }), images: imgs };
}
function polices() {
  const dir = path.join(__dirname, 'polices');
  const out = [];
  Object.keys(T.FICHIERS_POLICES).forEach(function (k) { T.FICHIERS_POLICES[k].forEach(function (x) { const b = fs.readFileSync(path.join(dir, x.fichier)); out.push({ file: '_f/' + x.fichier, data: b, sha: V.sha1(b), size: b.length }); }); });
  return out;
}
// Configuration du projet public. Vérifié sur Vercel (nov. 2026) : un fichier existant passe toujours avant une
// réécriture, et une réécriture doit viser un FICHIER (index.html), jamais un dossier. D'où, par domaine client :
// la racine, les fichiers (images, robots, sitemap), les pages avec et sans barre finale.
// Sur le domaine d'un client, rien d'autre que son site : les chemins des autres sites (/s/autre/) et des aperçus (/a/)
// renvoient vers sa page d'accueil (une redirection passe avant les fichiers, une réécriture non ; vérifié sur Vercel).
function echapper(x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function vercelJson(live, pauses, hotesNovalemo) {
  const regles = [], redirections = [];
  live.forEach(function (s) {
    const h = [{ type: 'host', value: s.domaine }], racine = '/s/' + s.slug + '/';
    redirections.push({ source: '/a/:p(.*)', has: h, destination: '/', permanent: false });
    redirections.push({ source: '/s/:chemin((?!' + echapper(s.slug) + '(?:/|$)).*)', has: h, destination: '/', permanent: false });
    regles.push({ source: '/', has: h, destination: racine + 'index.html' });
    regles.push({ source: '/:f(.+\\.[a-zA-Z0-9]+)', has: h, destination: racine + ':f' });
    regles.push({ source: '/:chemin(.+)/', has: h, destination: racine + ':chemin/index.html' });
    // jamais les chemins de Vercel (/_vercel/image sert les photos optimisées du site)
    regles.push({ source: '/:chemin((?!_vercel/)[^.]*[^./])', has: h, destination: racine + ':chemin/index.html' });
  });
  (pauses || []).forEach(function (s) {
    const h = [{ type: 'host', value: s.domaine }];
    redirections.push({ source: '/a/:p(.*)', has: h, destination: '/', permanent: false });
    redirections.push({ source: '/s/:p(.*)', has: h, destination: '/', permanent: false });
    regles.push({ source: '/', has: h, destination: '/_n/pause/index.html' });
    regles.push({ source: '/:p(.+)', has: h, destination: '/_n/pause/index.html' });
  });
  // les sites en ligne vus par l'adresse de Novalemo (doublons de leur domaine) : jamais indexés
  const noindexS = (hotesNovalemo || []).filter(Boolean).filter(function (x, k, a) { return a.indexOf(x) === k; }).map(function (hn) { return { source: '/s/(.*)', has: [{ type: 'host', value: hn }], headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }; });
  const conf = {
    headers: [
      { source: '/a/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/_n/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/_f/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }, { key: 'Access-Control-Allow-Origin', value: '*' }] },
      { source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }] }
    ].concat(noindexS),
    redirects: redirections,
    rewrites: regles,
    images: { sizes: R.LARGEURS_IMAGES, formats: ['image/webp'], minimumCacheTTL: 2678400 }
  };
  return Buffer.from(JSON.stringify(conf, null, 1));
}

// L'adresse des aperçus : nom.vercel.app, ou un sous-domaine à Louis (HQ_SITES_DOMAINE, ex. apercu.novalemo.fr)
// dès qu'il répond (un enregistrement CNAME chez son hébergeur DNS suffit, la tour fait le reste).
async function choisirHote(projet, e) {
  const base = e.hote_vercel || await V.hotePrincipal(projet.id).catch(function () { return null; }) || (projet.nom + '.vercel.app');
  const perso = String(process.env.HQ_SITES_DOMAINE || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!perso) return { hote: base, hote_vercel: base };
  if (e.hote_perso === perso && e.hote_perso_ok) return { hote: perso, hote_vercel: base };
  if (e.hote_perso !== perso) await V.ajouterDomaine(projet.id, perso).catch(function () {});
  const cfg = await V.configDomaine(perso).catch(function () { return null; });
  const ok = !!(cfg && cfg.misconfigured === false);
  return { hote: ok ? perso : base, hote_vercel: base, hote_perso: perso, hote_perso_ok: ok };
}

// Octets d'une image que Vercel n'aurait plus : en base (fichiers des clients), sinon à sa source (site du prospect)
async function octetsImage(db, i) {
  if (i.fichier_id) {
    const f = await db.one('hq_fichiers', { eq: { id: i.fichier_id } });
    if (f && f.contenu) return Buffer.from(f.contenu, 'base64');
  }
  if (i.source) {
    const r = await require('../web').telechargerImage(i.source, 2000000).catch(function () { return null; });
    if (r && r.data && V.sha1(r.data) === i.sha) return r.data;
  }
  return null;
}

async function publier(db, opts) {
  opts = opts || {};
  if (!V.branche()) return { resume: 'Hébergement des sites non branché (HQ_VERCEL_TOKEN).', publie: false };
  const jeton = require('crypto').randomBytes(8).toString('hex');
  const verrou = await require('../runtime').verrouiller(db, 'publication', 330, jeton);
  if (!verrou) { await ecrireEtat(db, { a_publier: true }); return { resume: 'Publication déjà en cours.', publie: false }; }
  try {
    let e = await lireEtat(db);
    if (e.en_cours && Date.now() - new Date(e.en_cours.le).getTime() < 6 * 60000) { await ecrireEtat(db, { a_publier: true }); return { resume: 'Un déploiement est déjà en cours, on publiera juste après.', publie: false }; }
    const projet = await V.assurerProjet(e);
    const h = await choisirHote(projet, e);
    const hote = h.hote;
    const id = await identite(db);
    const ctx = { identite: id, contactNovalemo: require('../mail').identite().adresse || null, optimiseur: true };
    // les sites vendus d'abord, tous, puis les aperçus les plus récents : un client payé n'est jamais laissé de côté
    const vendus = await db.select('hq_sites', { in: { status: ['commande', 'paye', 'livraison', 'en_ligne'] }, order: 'id.asc' });
    const apercus = await db.select('hq_sites', { in: { status: ['brouillon', 'apercu'] }, order: 'id.desc', limit: Math.max(200, 3000 - vendus.length) });
    const sites = vendus.concat(apercus);
    const parSha = new Map(), entrees = new Map(), live = [], inclus = [];
    const ajouter = function (x) { entrees.set(x.file, { file: x.file, sha: x.sha, size: x.size }); if (x.data) parSha.set(x.sha, function () { return x.data; }); };
    const imageSource = new Map();
    const rates = [];
    for (const s of sites) {
      if (!s.spec || !s.spec.nom) continue;
      // un aperçu qui ne se rend pas ne bloque pas les autres (Louis est prévenu plus bas) ; un site EN LIGNE qui ne se rend
      // pas arrête la publication : le déploiement précédent continue de servir son domaine
      let a, l = null;
      try { a = rendreSite(s, 'apercu', ctx); if (s.domaine && s.data && s.data.live) l = rendreSite(s, 'live', ctx); }
      catch (e) {
        const x = { id: s.id, nom: s.spec.nom, erreur: String(e && e.message || e).slice(0, 160), live: !!(s.domaine && s.data && s.data.live) };
        rates.push(x);
        if (x.live) {
          await signalerRates(db, rates, true);
          throw new Error('le site en ligne ' + s.spec.nom + ' (' + s.domaine + ') ne se rend plus (' + x.erreur + ') : publication arrêtée, la version précédente reste en ligne');
        }
        continue;
      }
      a.textes.forEach(ajouter); a.images.forEach(function (x) { ajouter(x); imageSource.set(x.sha, x.image); });
      inclus.push(s.id);
      if (l) {
        l.textes.forEach(ajouter); l.images.forEach(function (x) { ajouter(x); imageSource.set(x.sha, x.image); });
        live.push({ id: s.id, slug: s.slug, domaine: s.domaine });
      }
    }
    await signalerRates(db, rates, false);
    polices().forEach(ajouter);
    // sites en pause (hébergement de l'année non réglé) : une page neutre sur leur domaine, rien d'autre
    const pauses = (await db.select('hq_sites', { eq: { status: 'pause' }, select: 'id,domaine', limit: 500 })).filter(function (x) { return x.domaine; });
    [{ file: '_n/cgv/index.html', data: Buffer.from(cgv(id)) }, { file: '_n/merci/index.html', data: Buffer.from(merci()) }, { file: '_n/pause/index.html', data: Buffer.from(pause()) }, { file: 'vercel.json', data: vercelJson(live, pauses, [h.hote, h.hote_vercel]) }]
      .forEach(function (x) { x.sha = V.sha1(x.data); x.size = x.data.length; ajouter(x); });
    // fichiers que Vercel n'a pas encore : textes et polices depuis la mémoire, images depuis la base ou leur source
    const perdus = [];
    const manquants = async function (shas) {
      const out = [];
      for (const sh of shas) {
        if (parSha.has(sh)) { out.push(parSha.get(sh)()); continue; }
        const im = imageSource.get(sh);
        const b = im ? await octetsImage(db, im) : null;
        if (b) out.push(b); else perdus.push(sh);
      }
      if (perdus.length) for (const [k, v] of entrees) if (perdus.indexOf(v.sha) >= 0) entrees.delete(k);
      return out;
    };
    let dep;
    try { dep = await V.deployer(projet, Array.from(entrees.values()), manquants, { origine: 'la-tour', raison: court(opts.raison || 'publication', 60) }); }
    catch (err) {
      if (perdus.length) dep = await V.deployer(projet, Array.from(entrees.values()), manquants, { origine: 'la-tour', raison: 'images perdues retirées' });
      else throw err;
    }
    if (perdus.length) await retirerImagesPerdues(db, sites, perdus);
    e = await ecrireEtat(db, Object.assign({ projet: projet, a_publier: false, en_cours: { id: dep.id, le: iso(), sites: inclus, live: live.map(function (x) { return x.id; }) } }, h));
    return { resume: 'Déploiement lancé : ' + inclus.length + ' site(s), dont ' + live.length + ' en ligne.', publie: true, id: dep.id, hote: hote };
  } finally {
    await require('../runtime').deverrouiller(db, 'publication', jeton);
  }
}
async function retirerImagesPerdues(db, sites, perdus) {
  for (const s of sites) {
    const sp = s.spec || {};
    const avant = images(sp).length;
    const ph = (sp.photos || []).filter(function (p) { return perdus.indexOf(p.sha) < 0; });
    const lg = sp.logo && perdus.indexOf(sp.logo.sha) >= 0 ? null : sp.logo;
    if (ph.length + (lg ? 1 : 0) !== avant) await db.update('hq_sites', { spec: Object.assign({}, sp, { photos: ph, logo: lg }), updated_at: iso() }, { eq: { id: s.id } });
  }
}

// Où en est le déploiement ? Prêt : les aperçus deviennent visibles (liens envoyables), les sites en ligne sont servis.
async function suivre(db, opts) {
  opts = opts || {};
  if (!V.branche()) return { resume: 'Hébergement non branché.', pret: false };
  let e = await lireEtat(db);
  if (!e.en_cours) {
    if (e.a_publier) return Object.assign({ suivi: 'rien en cours' }, await publier(db, { raison: 'reprise' }));
    return { resume: 'Rien en cours.', pret: false };
  }
  const tentatives = opts.attendre ? 6 : 1;
  let st = null;
  for (let k = 0; k < tentatives; k++) {
    st = await V.etatDeploiement(e.en_cours.id).catch(function (err) { return { etat: 'INCONNU', erreur: err.message }; });
    if (['READY', 'ERROR', 'CANCELED'].indexOf(st.etat) >= 0) break;
    if (k < tentatives - 1) await new Promise(function (ok) { setTimeout(ok, 5000); });
  }
  const age = Date.now() - new Date(e.en_cours.le).getTime();
  if (st.etat === 'READY') {
    const ids = e.en_cours.sites || [], liveIds = e.en_cours.live || [], hote = e.hote;
    const nouveaux = [];
    if (ids.length) {
      // seuls les sites qui changent vraiment sont écrits (et datés) : un déploiement ne rajeunit pas tous les sites
      const aChanger = function (s) { return s.status === 'brouillon' || !s.url_apercu || !s.published_at || (liveIds.indexOf(s.id) >= 0 && !(s.data && s.data.live_publie)); };
      const sites = [];
      for (let k = 0; k < ids.length; k += 200) (await db.select('hq_sites', { in: { id: ids.slice(k, k + 200) }, select: 'id,slug,lead_id,status,url_apercu,published_at,data' })).forEach(function (s) { sites.push(s); });
      for (const s of sites.filter(aChanger)) {
        let nouveau = false, url = null;
        const fait = await majFraiche(db, 'hq_sites', s.id, function (f) {
          if (!aChanger(f)) return null;
          const patch = {};
          if (f.status === 'brouillon') { patch.status = 'apercu'; nouveau = true; }
          if (!f.url_apercu) patch.url_apercu = url = urlApercu(hote, f.slug);
          if (!f.published_at) patch.published_at = iso();
          if (liveIds.indexOf(f.id) >= 0 && !(f.data && f.data.live_publie)) patch.data = Object.assign({}, f.data || {}, { live_publie: iso() });
          return patch;
        });
        if (!fait) continue;
        if (nouveau) nouveaux.push(s);
        if (s.lead_id && (nouveau || url)) await db.update('hq_leads', { apercu_etat: 'publie', apercu_url: fait.url_apercu, updated_at: iso() }, { eq: { id: s.lead_id } });
      }
    }
    e = await ecrireEtat(db, { en_cours: null, derniere: { id: e.en_cours.id, le: iso(), etat: 'READY', sites: ids.length, live: liveIds.length }, erreurs: 0 });
    let suite = null;
    if (e.a_publier) suite = await publier(db, { raison: 'en attente' });
    return { resume: 'Déploiement en ligne (' + ids.length + ' site(s)).', pret: true, nouveaux: nouveaux, suite: suite };
  }
  if (st.etat === 'ERROR' || st.etat === 'CANCELED' || age > 12 * 60000) {
    const n = (e.erreurs || 0) + 1;
    await ecrireEtat(db, { en_cours: null, a_publier: true, erreurs: n, derniere: { id: e.en_cours.id, le: iso(), etat: st.etat, erreur: st.erreur || null } });
    if (n === 2) await db.insert('hq_messages', { from_id: 'livraison', to_id: 'louis', company_id: 'novalemo', kind: 'alerte', subject: 'Publication des sites en échec', body: 'Deux déploiements de suite ont échoué (' + (st.erreur || st.etat) + '). Je réessaie à chaque cycle ; rien à faire de ton côté sauf si ça dure.' }, { returning: false });
    return { resume: 'Déploiement en échec (' + st.etat + '), nouvel essai au prochain cycle.', pret: false };
  }
  return { resume: 'Déploiement en cours (' + st.etat + ').', pret: false };
}

module.exports = { publier, suivre, lireEtat, ecrireEtat, urlApercu, urlNovalemo, cgv, merci, pause, vercelJson, rendreSite, PUBLIABLES, images };
