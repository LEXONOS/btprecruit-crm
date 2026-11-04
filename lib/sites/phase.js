// La phase de test des sites : tant qu'elle dure, les aperçus se fabriquent (en priorité pour les entreprises sans
// site, puis celles dont le site est vraiment mauvais), Miranda les critique, Louis les regarde dans la tour, et aucun
// premier email ni relance ne part. Les réponses aux conversations en cours continuent. Louis la termine d'un bouton.
'use strict';
const CLE = 'sites:phase';
const iso = function () { return new Date().toISOString(); };

// une lecture qui échoue compte comme la phase de test (aucun envoi de plus) : jamais d'email par accident
async function lire(db) {
  let echec = false;
  const r = await db.one('hq_config', { eq: { key: CLE } }).catch(function () { echec = true; return null; });
  if (echec) return { phase: 'test', illisible: true };
  return (r && r.value) || { phase: 'envoi' };
}
async function enTest(db) { return (await lire(db)).phase === 'test'; }
async function ecrire(db, phase, par) {
  const v = Object.assign({}, await lire(db), { phase: phase === 'test' ? 'test' : 'envoi', le: iso(), par: par || 'louis' });
  delete v.illisible;
  if (phase === 'test' && !v.depuis) v.depuis = v.le;
  if (phase !== 'test') v.fin = v.le;
  await db.upsert('hq_config', { key: CLE, value: v, updated_at: iso() }, { onConflict: 'key' });
  return v;
}

// l'ordre de priorité des prospects pour un aperçu : pas de vrai site d'abord, puis un site vraiment mauvais
const SANS_SITE = ['aucun', 'reseau', 'parking', 'construction', 'vide', 'erreur'];
function rang(lead) {
  const e = lead && lead.site_state;
  if (!e || SANS_SITE.indexOf(e) >= 0) return lead && lead.website && !e ? 1 : 0;
  const a = (lead.data && lead.data.audit) || {};
  const defauts = (a.defauts || []).length + (a.https === false ? 1 : 0) + (a.mobile === false ? 1 : 0) + (a.gratuit ? 1 : 0) + (!a.mentions_legales ? 1 : 0);
  if (e === 'douteux' && defauts >= 2) return 1;
  return 2;
}

// Pour la tour : la phase, et les derniers aperçus du nouveau moteur avec le verdict de Miranda
async function tableau(db) {
  const ph = await lire(db);
  const rows = await db.select('hq_sites', { select: 'id,lead_id,slug,status,version,url_apercu,created_at,spec,data', in: { status: ['brouillon', 'apercu'] }, order: 'id.desc', limit: 60 }).catch(function () { return []; });
  const lids = rows.map(function (r) { return r.lead_id; }).filter(Boolean);
  const leads = lids.length ? await db.select('hq_leads', { select: 'id,status,site_state,email,phone', in: { id: lids } }).catch(function () { return []; }) : [];
  const sites = rows.filter(function (r) { return r.spec && r.spec.compo; }).map(function (r) {
    const c = (r.data && r.data.critique) || null, l = leads.find(function (x) { return x.id === r.lead_id; }) || {}, sp = r.spec || {};
    return { id: r.id, nom: sp.nom, metier: sp.metier || sp.activite, commune: sp.commune, url: r.url_apercu || null, statut: r.status, prospect: l.status || null, sans_site: rang(l) === 0, contact: l.email ? 'email' : l.phone ? 'téléphone' : null,
      photos: (sp.photos || []).filter(function (p) { return p && p.fichier; }).length, critique: c && c.note != null ? { note: c.note, verdict: c.verdict, resume: c.resume, problemes: (c.problemes || []).slice(0, 3), a_jour: c.version === r.version, abandon: !!c.abandon, tours: c.tours || 1 } : null, cree_le: r.created_at };
  });
  const valides = sites.filter(function (s) { return s.critique && s.critique.verdict === 'valide' && s.critique.a_jour; }).length;
  return { phase: ph.phase, depuis: ph.depuis || null, fin: ph.fin || null, sites: sites.slice(0, 30), valides: valides, juges: sites.filter(function (s) { return s.critique; }).length };
}

module.exports = { CLE, lire, enTest, ecrire, rang, tableau, SANS_SITE };
