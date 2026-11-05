// Lina, cheffe de fabrication du Studio : envoie à l'usine (GitHub Actions) chaque vidéo prête à rendre, une
// fabrication par langue, surveille celles qui n'arrivent pas, relance une fois, et arrête ce qui échoue deux fois.
// Aucun appel à Claude : ce poste ne coûte rien.
'use strict';
const G = require('../studio/github');
const F = require('../studio/fabrication');
const { majFraiche } = require('../db');
const { court } = require('../util');

const EN_VOL_MAX = 12;          // fabrications en même temps (GitHub en accepte 20 sur un dépôt public)
const PEREMPTION_MIN = 80;      // une fabrication sans nouvelles depuis 80 minutes est relancée

async function run(ctx) {
  const db = ctx.db;
  if (!G.branche()) return { resume: 'L\'usine n\'est pas encore branchée : la mission Studio attend Louis (un jeton GitHub, 2 minutes).', prochain_min: 240 };
  let videos = await db.select('hq_videos', { in: { status: ['scene', 'essai', 'langues'] }, order: 'updated_at.asc', limit: 60 });
  const relancees = [];
  for (const v of videos) { const p = await F.perimer(db, v, PEREMPTION_MIN); if (p.length) relancees.push(v.id + ' (' + p.join(', ') + ')'); }
  if (relancees.length) videos = await db.select('hq_videos', { in: { status: ['scene', 'essai', 'langues'] }, order: 'updated_at.asc', limit: 60 });
  let enVol = videos.reduce((n, v) => n + Object.values(v.rendus || {}).filter((r) => r && r.etat === 'demande').length, 0);
  const lances = [], echecs = [], abandons = [];
  for (const v of videos) {
    const r = v.rendus || {};
    // deux échecs sur la langue source : la vidéo s'arrête là, le DG est prévenu
    if (v.status === 'essai' && r[v.langue_source] && r[v.langue_source].etat === 'echec' && (r[v.langue_source].essais || 0) >= F.ESSAIS_MAX) {
      await majFraiche(db, 'hq_videos', v.id, (f) => (f.status === 'essai' ? { status: 'echec' } : null));
      echecs.push('« ' + court(v.titre, 50) + ' » : ' + court(r[v.langue_source].erreur || 'erreur inconnue', 180));
      continue;
    }
    // deux échecs sur une autre langue : on la laisse tomber, la vidéo continue sans elle
    if (v.status === 'langues') {
      const perdues = (v.langues || []).filter((l) => l !== v.langue_source && r[l] && r[l].etat === 'echec' && (r[l].essais || 0) >= F.ESSAIS_MAX);
      if (perdues.length) {
        await majFraiche(db, 'hq_videos', v.id, (f) => {
          const langues = (f.langues || []).filter((l) => perdues.indexOf(l) < 0);
          const autres = langues.filter((l) => l !== f.langue_source);
          return { langues, status: autres.every((l) => f.rendus[l] && f.rendus[l].etat === 'fini') ? 'prete' : f.status };
        });
        abandons.push(court(v.titre, 40) + ' sans ' + perdues.join(', '));
        continue;
      }
    }
    for (const l of F.aRendre(v)) {
      if (enVol >= EN_VOL_MAX) break;
      const d = await F.demander(db, v, l);
      if (d.ok) { enVol++; lances.push(v.id + ':' + l); }
      else if (d.raison && d.raison !== 'déjà demandée') echecs.push('lancement ' + v.id + ':' + l + ' : ' + d.raison);
    }
  }
  if (echecs.length) await db.insert('hq_messages', { from_id: ctx.agent.id, to_id: 'dg_studio', company_id: 'studio3d', kind: 'alerte', subject: 'Fabrication en échec', body: echecs.join('\n') + '\n\nL\'historique des fabrications est sur GitHub, onglet Actions du dépôt.' }, { returning: false });
  const morceaux = [];
  if (lances.length) morceaux.push(lances.length + ' fabrication(s) lancée(s) (' + lances.join(', ') + ')');
  if (relancees.length) morceaux.push('sans nouvelles, relancées : ' + relancees.join(', '));
  if (abandons.length) morceaux.push('langues abandonnées : ' + abandons.join(' ; '));
  if (echecs.length) morceaux.push(echecs.length + ' échec(s)');
  morceaux.push(enVol + ' en cours à l\'usine');
  return { resume: morceaux.join(', ') + '.', produit: lances.length, erreur: echecs.length > 0 && !lances.length, prochain_min: enVol ? 10 : 20 };
}

module.exports = { run };
