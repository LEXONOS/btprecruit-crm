// Léo, Chasseur nouveaux domaines : listes Afnic des 3 derniers jours, annuaire officiel EN MARTINIQUE
// (département 972 seulement), ce qu'il y a derrière le domaine, note sur 100. N'écrit en base QUE les pistes
// retenues (pas une ligne par domaine : c'est ce qui avait saturé la base de novalem-app). Curseur dans hq_config.
'use strict';
const ND = require('../chasse/nd-moteur');
const { jourGP } = require('../util');
const { NOVALEMO } = require('../config');

// Une piste n'entre que si elle est en Martinique : entreprise trouvée dans le 972, ou nom qui sent la Martinique
function dansLaZone(a) {
  const e = a.data && a.data.entreprise;
  if (e) return NOVALEMO.depts.indexOf(String(e.dep)) >= 0;
  const sig = (a.data && a.data.signaux) || [];
  return sig.some(function (s) { return NOVALEMO.iles.indexOf(s.ile) >= 0; }) && !sig.some(function (s) { return s.ile === 'GP' || s.ile === 'NORD'; });
}

const JOURS = 3;
const SCORE_MIN = 45;
const OUVRIERS = 6;
const ILE = { '971': 'GP', '972': 'MQ', '977': 'BL', '978': 'MF' };
const ETAT = { rien: 'aucun', parking: 'parking', construction: 'construction', vide: 'vide', reseau: 'reseau', redirection: 'redirection', erreur: 'erreur', site: 'site' };

function versLead(d, a, jour) {
  const x = a.data, e = x.entreprise, s = x.site || {}, g = x.google || null;
  const email = x.email ? x.email.adresse : null;
  const tel = (g && g.tel) || (s.tels && s.tels[0]) || null;
  return {
    company_id: 'novalemo', dedupe: 'domaine:' + d, source: 'domaines',
    name: e ? e.nom : d, sector: e ? (e.activite || null) : null, island: e ? (ILE[e.dep] || null) : 'MQ', commune: e ? (e.commune || null) : null,
    website: s.etat === 'site' ? 'https://' + d : null, domain: d, email: email, email_source: x.email ? x.email.source : null, phone: tel,
    site_state: ETAT[s.etat] || s.etat || null, score: a.score, reason: (x.pourquoi || []).join(' ; '),
    status: email ? 'a_contacter' : (tel ? 'a_appeler' : 'sans_contact'),
    data: { nouveau_domaine: true, jour_afnic: jour, entreprise: e || null, site: { etat: s.etat, titre: s.titre, outil: s.outil, fournisseur: s.fournisseur }, google: g, signaux: x.signaux, mx: x.mx && x.mx.ok ? x.mx.qui || 'oui' : null }
  };
}

async function run(ctx) {
  const db = ctx.db;
  const cfg = (await db.one('hq_config', { eq: { key: 'job:domaines' } })) || { key: 'job:domaines', value: {} };
  const etat = cfg.value || {};
  etat.jours = etat.jours || {};
  const jour = await db.one('hq_daily', { eq: { day: jourGP() } });
  const googleRestant = { n: Math.max(0, Math.min(6, (ctx.budget.places_jour || 0) - ((jour && jour.places) || 0))) };
  const googleAvant = googleRestant.n;
  const bilan = { traites: 0, leads: 0, ecartes: 0, erreurs: 0, jours: [] };
  const t0 = Date.now();
  const limite = Math.min(ctx.limite, t0 + 130000);           // 2 min max par passage : on reprend au suivant
  const assez = function () { return Date.now() > limite - 25000; };
  const pc = { attendre: ND.cadence(210), cleGoogle: process.env.GOOGLE_MAPS_API_KEY || '', googleRestant: googleRestant, limite: limite - 5000, departements: NOVALEMO.depts.join(','), prefere: NOVALEMO.depts[0] };

  // garde seulement les 7 derniers jours dans le curseur
  Object.keys(etat.jours).forEach(function (j) { if (j < ND.jourParis(-8)) delete etat.jours[j]; });

  for (let k = 1; k <= JOURS && !assez(); k++) {
    const j = ND.jourParis(-k);
    const st = etat.jours[j] || (etat.jours[j] = { offset: 0, total: null, fini: false, leads: 0 });
    if (st.fini || st.absent) continue;
    let liste;
    try {
      const r = await ND.telechargerAfnic(j);
      if (r.absent) { st.absent = k > 1; continue; }
      liste = r.domaines;
    } catch (e) { bilan.erreurs++; continue; }
    st.total = liste.length;
    const nouveaux = [];
    let curseur = st.offset;
    let echecs = 0;
    async function ouvrier() {
      while (!assez() && curseur < liste.length && echecs < 8) {
        const d = liste[curseur++];
        try {
          const a = await ND.analyser(d, pc);
          bilan.traites++;
          echecs = 0;
          if (a.etape === 'lead' && a.score >= SCORE_MIN && dansLaZone(a)) nouveaux.push(versLead(d, a, j));
          else bilan.ecartes++;
        } catch (e) {
          if (/^temps écoulé/.test(String(e.message))) { curseur--; return; }
          bilan.erreurs++; echecs++;
        }
      }
    }
    await Promise.all(Array(OUVRIERS).fill(0).map(ouvrier));
    st.offset = Math.min(curseur, liste.length);
    if (st.offset >= liste.length) st.fini = true;
    if (nouveaux.length) {
      const ins = await db.insert('hq_leads', nouveaux, { onConflict: 'dedupe', ignoreDuplicates: true });
      st.leads += ins.length;
      bilan.leads += ins.length;
    }
    bilan.jours.push(j + ' : ' + st.offset + '/' + st.total + (st.fini ? ' (fini)' : ''));
  }
  await db.upsert('hq_config', { key: 'job:domaines', value: etat, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  ctx.compteurs.leads += bilan.leads;
  ctx.compteurs.places += (googleAvant - googleRestant.n);
  const reste = Object.keys(etat.jours).filter(function (j) { return !etat.jours[j].fini && !etat.jours[j].absent; }).length;
  return {
    resume: bilan.traites + ' domaines analysés, ' + bilan.leads + ' piste(s) retenue(s)' + (bilan.erreurs ? ', ' + bilan.erreurs + ' erreur(s)' : '') + (reste ? ', reprise au prochain passage' : ', listes à jour'),
    detail: bilan, produit: bilan.leads, duree_s: Math.round((Date.now() - t0) / 1000),
    prochain_min: reste ? 15 : null
  };
}

module.exports = { run, versLead, dansLaZone };
