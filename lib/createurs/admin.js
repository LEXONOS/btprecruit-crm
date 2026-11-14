// Ce que Louis fait des comptes des créatrices, depuis la tour : en créer un (il envoie le lien d'invitation), refaire
// un lien (mot de passe oublié), mettre en pause, réactiver, supprimer. Il voit leur activité et leurs dépenses, jamais
// leurs clés ni leurs scripts.
'use strict';
const C = require('./index');
const AC = require('./acces');
const F = require('./fabrication');
const { court, sansAccents } = require('../util');

const iso = () => new Date().toISOString();

async function liste(db) {
  const comptes = await db.select('hq_createurs', { order: ['created_at.asc'], select: 'id,identifiant,prenom,statut,reglages,secrets,couts,derniere_connexion,invitation_expire,created_at' });
  const videos = comptes.length ? await db.select('hq_crea_videos', { in: { createur_id: comptes.map((c) => c.id) }, select: 'id,createur_id,status,created_at', order: ['created_at.desc'], limit: 1000 }) : [];
  return comptes.map((c) => {
    const r = C.reglagesDe(c);
    const d = C.depense(c);
    const siennes = videos.filter((v) => v.createur_id === c.id);
    return {
      id: c.id, identifiant: c.identifiant, prenom: c.prenom, statut: c.statut, chaine: r.chaine.nom || null, langues: r.langues,
      claude: !!(c.secrets || {}).claude, uploadpost: !!(c.secrets || {}).uploadpost, pilote: !!r.pilote.actif,
      depense: { jour: d.jour, mois: d.mois, total: d.total, budget: r.budget_jour },
      videos: { total: siennes.length, pretes: siennes.filter((v) => v.status === 'prete').length, publiees: siennes.filter((v) => v.status === 'publiee').length, en_cours: siennes.filter((v) => C.AUTOMATIQUES.indexOf(v.status) >= 0 || v.status === 'relecture').length },
      derniere_connexion: c.derniere_connexion, invitation_valable: !!(c.invitation_expire && new Date(c.invitation_expire).getTime() > Date.now()), invitation_expire: c.invitation_expire, created_at: c.created_at
    };
  });
}

// un identifiant tiré du prénom (sans accents, en minuscules), rendu unique
async function identifiantLibre(db, base) {
  const racine = (sansAccents(base).replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'creatrice').slice(0, 24);
  const r = racine.length >= 3 ? racine : (racine + '.studio');
  for (let i = 0; i < 50; i++) {
    const id = i ? r + (i + 1) : r;
    if (!(await db.one('hq_createurs', { eq: { identifiant: id }, select: 'id' }))) return id;
  }
  throw new Error('aucun identifiant libre');
}

async function agir(db, op, b) {
  if (op === 'crea_liste') return { createurs: await liste(db) };
  if (op === 'crea_creer') {
    const prenom = court(String(b.prenom || '').replace(/[<>]/g, '').trim(), 40);
    if (prenom.length < 2) throw new Error('Son prénom, s\'il te plaît.');
    let identifiant = b.identifiant ? AC.identifiantPropre(b.identifiant) : null;
    if (b.identifiant && !identifiant) throw new Error('Identifiant : 3 à 32 lettres minuscules, chiffres, points ou tirets.');
    if (identifiant && await db.one('hq_createurs', { eq: { identifiant }, select: 'id' })) throw new Error('Cet identifiant est déjà pris.');
    identifiant = identifiant || await identifiantLibre(db, prenom);
    const [c] = await db.insert('hq_createurs', { identifiant, prenom, statut: 'invitee', reglages: {}, equipe: {}, secrets: {}, couts: {}, journal: C.ligneJournal({}, 'Compte créé par Louis'), idees: [] });
    const inv = await AC.inviter(db, c);
    return { ok: true, id: c.id, identifiant, prenom, code: inv.code, expire: inv.expire, createurs: await liste(db) };
  }
  const c = await db.one('hq_createurs', { eq: { id: Number(b.id) || 0 } });
  if (!c) throw new Error('Compte introuvable.');
  if (op === 'crea_lien') {
    const inv = await AC.inviter(db, c);
    await db.update('hq_createurs', { journal: C.ligneJournal(c, 'Nouveau lien envoyé par Louis'), updated_at: iso() }, { eq: { id: c.id } });
    return { ok: true, id: c.id, identifiant: c.identifiant, prenom: c.prenom, code: inv.code, expire: inv.expire, createurs: await liste(db) };
  }
  if (op === 'crea_statut') {
    const pause = b.statut === 'suspendue';
    if (!pause && c.statut !== 'suspendue') return { ok: true, createurs: await liste(db) };
    // la pause ferme ses sessions ; la reprise la remet comme avant (invitée si elle n'avait jamais choisi son mot de passe)
    await db.update('hq_createurs', { statut: pause ? 'suspendue' : (c.mdp ? 'active' : 'invitee'), gen: (c.gen || 0) + (pause ? 1 : 0), journal: C.ligneJournal(c, pause ? 'Compte mis en pause par Louis' : 'Compte réactivé par Louis'), updated_at: iso() }, { eq: { id: c.id } });
    return { ok: true, createurs: await liste(db) };
  }
  if (op === 'crea_supprimer') {
    const vids = await db.select('hq_crea_videos', { eq: { createur_id: c.id }, select: 'id,createur_id,langues' });
    for (const v of vids) await F.effacerFichiers(v).catch(() => null);
    await db.remove('hq_crea_videos', { eq: { createur_id: c.id } });
    await db.remove('hq_createurs', { eq: { id: c.id } });
    await db.remove('hq_config', { eq: { key: 'crea:pilote:' + c.id } }).catch(() => null);
    return { ok: true, createurs: await liste(db) };
  }
  throw new Error('Opération inconnue');
}

module.exports = { liste, agir, identifiantLibre };
