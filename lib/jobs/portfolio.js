// Lina, Responsable portfolio : vérifie que chaque site réalisé est en ligne et porte la signature
// Studio Novalem, puis le range par métier. Seuls les sites vérifiés servent d'exemples dans les emails.
'use strict';
const { telecharger } = require('../web');
const { parallele } = require('../util');

function lignes(playbook) {
  return String(playbook || '').split('\n').map(function (l) { return l.trim(); })
    .filter(function (l) { return /^[a-z0-9.-]+\.[a-z]{2,}\s*\|/i.test(l); })
    .map(function (l) { const p = l.split('|').map(function (x) { return x.trim(); }); return { domaine: p[0].toLowerCase(), entreprise: p[1] || p[0], metier: p[2] || '', commune: p[3] || '' }; });
}

async function verifier(s) {
  let t = await telecharger('https://' + s.domaine + '/').catch(function (e) { return { erreur: String(e.message || e) }; });
  if (t.erreur) t = await telecharger('https://www.' + s.domaine + '/').catch(function (e) { return { erreur: String(e.message || e) }; });
  if (t.erreur) return Object.assign({}, s, { en_ligne: false, signature: false, detail: t.erreur });
  const html = t.html || '';
  return Object.assign({}, s, {
    en_ligne: t.statut >= 200 && t.statut < 400,
    signature: /studio\s*novalem|novalem/i.test(html),
    url: t.url, http: t.statut
  });
}

async function run(ctx) {
  const db = ctx.db;
  const liste = lignes(ctx.agent.playbook);
  if (!liste.length) return { resume: 'Aucun site dans ma liste.', produit: 0 };
  const res = await parallele(liste, 4, verifier);
  const vu = new Date().toISOString();
  const rows = res.filter(function (r) { return r && r.domaine; }).map(function (r) {
    const ok = r.en_ligne && r.signature;
    return {
      company_id: 'novalemo', agent_id: ctx.agent.id, kind: 'reference', dedupe: 'reference:' + r.domaine,
      title: r.entreprise + ' (' + r.domaine + ')', body: r.metier + (r.commune ? ', ' + r.commune : ''),
      data: { domaine: r.domaine, url: r.url || 'https://' + r.domaine, entreprise: r.entreprise, metier: r.metier, commune: r.commune, en_ligne: !!r.en_ligne, signature: !!r.signature, http: r.http || null, detail: r.detail || null, vu_le: vu },
      status: ok ? 'valide' : (r.en_ligne ? 'a_verifier' : 'hors_ligne'), score: ok ? 100 : (r.en_ligne ? 50 : 0), updated_at: vu
    };
  });
  await db.upsert('hq_items', rows, { onConflict: 'dedupe' });
  const ok = rows.filter(function (r) { return r.status === 'valide'; });
  const douteux = rows.filter(function (r) { return r.status === 'a_verifier'; });
  const hs = rows.filter(function (r) { return r.status === 'hors_ligne'; });
  ctx.compteurs.items += rows.length;
  return {
    resume: ok.length + ' référence(s) vérifiée(s) en ligne avec la signature' + (douteux.length ? ', ' + douteux.length + ' en ligne sans signature visible' : '') + (hs.length ? ', ' + hs.length + ' injoignable(s)' : ''),
    produit: ok.length,
    detail: { valides: ok.map(function (r) { return r.data.domaine + ' (' + r.data.metier + ')'; }), sans_signature: douteux.map(function (r) { return r.data.domaine; }), hors_ligne: hs.map(function (r) { return r.data.domaine; }) }
  };
}

module.exports = { run, lignes };
