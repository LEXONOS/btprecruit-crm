// Margot, juriste : les mentions légales de chaque site. Elle cherche l'entreprise dans le registre officiel (annuaire
// des entreprises) dès que le client a donné son nom officiel ou son SIRET, complète la fiche (forme, SIREN, siège,
// dirigeant, greffe), dit à Emma ce qui manque encore (capital, ordre professionnel...) et prévient Louis si un site
// payé reste sans ses mentions obligatoires. Rien n'est inventé : ce qui n'est pas trouvé est demandé au client.
'use strict';
const P = require('../sites/publication');
const J = require('../sites/juridique');
const { majFraiche } = require('../db');
const { court } = require('../util');

const LOT = 6;
const EN_LIGNE = ['paye', 'livraison', 'en_ligne'];
const iso = function (t) { return new Date(t || Date.now()).toISOString(); };

async function message(db, sujet, corps, kind) { await db.insert('hq_messages', { from_id: 'juridique', to_id: 'louis', company_id: 'novalemo', kind: kind || 'alerte', subject: court(sujet, 120), body: corps }, { returning: false }); }

async function run(ctx) {
  const db = ctx.db;
  const rows = [];
  for (let off = 0; off < 4000; off += 250) {
    const r = await db.select('hq_sites', { select: 'id,lead_id,status,version,paid_at,live_at,legal:spec->legal,jr:data->juridique', in: { status: ['brouillon', 'apercu', 'commande'].concat(EN_LIGNE) }, order: 'id.asc', limit: 250, offset: off });
    rows.push.apply(rows, r);
    if (r.length < 250) break;
  }
  const legalDe = function (r) { return r.legal !== undefined ? (r.legal || {}) : ((r.spec && r.spec.legal) || {}); };
  const jrDe = function (r) { return r.jr !== undefined ? (r.jr || {}) : ((r.data && r.data.juridique) || {}); };
  // 1. ce que le client a donné (nom officiel, SIRET) : vérifié tout de suite ; 2. les sites payés sans entreprise trouvée
  // (un essai par semaine) ; 3. les aperçus sans entreprise (un seul essai, d'après le nom)
  const semaine = Date.now() - 7 * 86400000;
  const aChercher = rows.filter(function (r) {
    const l = legalDe(r), j = jrDe(r);
    if (l.a_verifier) return true;
    if (l.siren && l.source === 'registre') return false;
    const dernier = Date.parse(j.cherche_le || '') || 0;
    if (EN_LIGNE.indexOf(r.status) >= 0 || r.status === 'commande') return dernier < semaine;
    return !dernier;
  }).sort(function (a, b) { return (legalDe(b).a_verifier ? 1 : 0) - (legalDe(a).a_verifier ? 1 : 0); });
  let trouves = 0, cherches = 0, publier = false;
  const notes = [];
  for (const r of aChercher.slice(0, LOT)) {
    if (ctx.limite && Date.now() > ctx.limite - 30000) break;
    const site = await db.one('hq_sites', { eq: { id: r.id } });
    if (!site) continue;
    const lead = site.lead_id ? await db.one('hq_leads', { eq: { id: site.lead_id } }) : null;
    const avant = JSON.stringify(site.spec || {});
    const res = await J.completer(site.spec || {}, lead);
    if (res.erreur) { notes.push('registre injoignable (' + court(res.erreur, 60) + ')'); break; }   // panne de l'annuaire : on reprend au prochain passage
    cherches++;
    const spec = res.spec;
    const manquants = J.questions(spec).map(function (q) { return q.cle; });
    const ok = await majFraiche(db, 'hq_sites', site.id, function (f) {
      if (JSON.stringify(f.spec || {}) !== avant) return null;   // modifié entre-temps : on reprendra au prochain passage
      const d = Object.assign({}, f.data || {}, { juridique: Object.assign({}, (f.data && f.data.juridique) || {}, { cherche_le: iso(), resume: res.resume, manquants: manquants }) });
      return JSON.stringify(spec) !== avant ? { spec: spec, data: d, version: (f.version || 1) + 1 } : { data: d };
    });
    if (!ok) continue;
    if (res.trouve) { trouves++; notes.push(court((spec.nom || ''), 40) + ' : ' + res.resume); if (['apercu', 'commande'].concat(EN_LIGNE).indexOf(site.status) >= 0) publier = true; }
    else notes.push(court((spec.nom || ''), 40) + ' : ' + res.resume);
  }
  // les sites payés dont les mentions obligatoires restent incomplètes trois jours après le paiement : Louis le sait, une fois
  let incomplets = 0;
  for (const r of rows.filter(function (x) { return EN_LIGNE.indexOf(x.status) >= 0; })) {
    const j0 = jrDe(r);
    if (j0.complet_v && j0.complet_v === r.version) continue;   // déjà vu complet à cette version de la fiche
    const full = await db.one('hq_sites', { eq: { id: r.id } });
    if (!full) continue;
    const site = { spec: full.spec || {} };
    if (J.complet(site.spec)) { await majFraiche(db, 'hq_sites', full.id, function (f) { return { data: Object.assign({}, f.data || {}, { juridique: Object.assign({}, (f.data && f.data.juridique) || {}, { complet_v: f.version || 1 }) }) }; }); continue; }
    incomplets++;
    const j = jrDe(r);
    const depuis = Date.parse(full.paid_at || full.live_at || '') || Date.now();
    if (j.alerte_le || Date.now() - depuis < 3 * 86400000) continue;
    const m = J.manquants(site.spec).filter(function (e) { return e.bloquant; }).map(function (e) { return e.libelle; });
    await message(db, 'Mentions légales incomplètes : ' + court(site.spec.nom || '', 60), 'Site payé ' + (full.domaine ? '(' + full.domaine + ') ' : '') + 'dont les mentions obligatoires sont incomplètes : ' + m.join(', ') + '. Emma les redemande au client à sa prochaine réponse ; s\'il ne répond pas, un mot de ta part peut aider. Amende encourue par le client : jusqu\'à 75 000 € (personne) ou 375 000 € (société).');
    await majFraiche(db, 'hq_sites', full.id, function (f) { return { data: Object.assign({}, f.data || {}, { juridique: Object.assign({}, (f.data && f.data.juridique) || {}, { alerte_le: iso() }) }) }; });
  }
  if (publier) await P.ecrireEtat(db, { a_publier: true });
  const resume = (cherches ? cherches + ' entreprise(s) cherchée(s) dans le registre, ' + trouves + ' trouvée(s)' + (notes.length ? ' : ' + notes.slice(0, 4).join(' ; ') : '') : 'Rien à chercher dans le registre') + (incomplets ? '. ' + incomplets + ' site(s) payé(s) aux mentions encore incomplètes (Emma les demande).' : '.');
  return { resume: resume, produit: trouves, prochain_min: aChercher.length > LOT ? 20 : null, detail: { cherches: cherches, trouves: trouves, incomplets: incomplets, notes: notes } };
}

module.exports = { run };
