// Le pôle écriture de Novalemo. Deux choses : la charte, qui fait sonner chaque message comme écrit par quelqu'un (elle
// est donnée à chaque agent qui écrit), et les messages en test. Chaque premier email suit une variante (A, B, C...) ;
// on compte qui répond, qui est intéressé, qui dit STOP, qui achète. Une variante n'est jugée qu'après assez d'envois ;
// Colette, responsable de l'écriture, garde celles qui font répondre, retire les autres et en invente de nouvelles.
'use strict';
const { court } = require('./util');

const CLE = 'ecriture';
const MIN_ENVOIS = 25;          // avant, une différence de taux de réponse ne veut rien dire
const MAX_ACTIVES = 3;          // la gagnante et deux challengers au plus
const JOURS = 60;

const CHARTE_DEFAUT = `Écris comme Louis parlerait à un artisan qu'il croise au Lamentin : direct, poli, simple. Une personne écrit à une personne.
- Phrases courtes, une idée par phrase, des mots de tous les jours. Pas de jargon (« digital », « visibilité en ligne », « présence web »).
- Commence par quelque chose de VRAI et de précis sur lui (ce que tu as vu : son métier, sa commune, sa page Facebook, son site qui ne s'ouvre pas sur téléphone). Jamais de compliment vague.
- Une seule chose à regarder (l'aperçu de son site), une seule question à la fin, à laquelle on répond en un mot.
- Toujours dire, simplement, que tout reste modifiable (textes, photos, couleurs, rubriques) : il dit ce qu'il veut changer, on l'ajuste.
- Aucune formule toute faite : pas de « je me permets », « j'espère que vous allez bien », « n'hésitez pas », « je reste à votre disposition », « dans l'attente de votre retour », « suite à ».
- Pas d'adjectifs empilés, pas de point d'exclamation de vendeur, pas de majuscules pour insister.
- Varie : deux emails de suite ne commencent pas de la même façon.
- Dans une réponse : réponds d'abord à SA question, avec SES mots. Il tutoie : tutoie. Il écrit trois mots : réponds en deux phrases. Il est pressé : va au but. Il hésite : rassure avec un fait, pas avec un adjectif.
- WhatsApp : encore plus court, des lignes courtes comme dans une vraie conversation, pas de bloc de signature.
- Si tu ne sais pas, demande. Ne jamais inventer un fait, un prix, un délai.`;

const VARIANTES_DEFAUT = [
  { id: 'A', nom: 'L\'aperçu tout de suite', consigne: 'Très court (50 à 80 mots). Première phrase : ce que tu as vu sur lui, en une ligne. Deuxième : le lien de son aperçu, présenté simplement (« j\'ai préparé à quoi pourrait ressembler votre site »). Puis ce qui est compris et le prix en une phrase. Question finale en un mot.' },
  { id: 'B', nom: 'Le constat d\'abord', consigne: '80 à 110 mots. Commence par le problème concret que tu as constaté (pas de site, seulement Facebook, pas de mentions légales, site qui ne s\'ouvre pas sur téléphone) et ce qu\'il lui coûte en une phrase (les clients qui le cherchent sur Google trouvent un concurrent). Puis l\'aperçu comme réponse, le prix, une question simple.' }
];

const nouveau = function () { return { charte: CHARTE_DEFAUT, variantes: VARIANTES_DEFAUT.map(function (v) { return Object.assign({ statut: 'test', cree_le: null }, v); }), historique: [] }; };

async function lire(db) {
  if (!db) return nouveau();
  const r = await db.one('hq_config', { eq: { key: CLE } }).catch(function () { return null; });
  // une copie : un réglage refusé ne touche jamais ce qui est enregistré
  const v = r && r.value ? JSON.parse(JSON.stringify(r.value)) : null;
  if (!v || !Array.isArray(v.variantes) || !v.variantes.length) return Object.assign(nouveau(), v && v.charte ? { charte: v.charte } : {});
  return Object.assign({ historique: [] }, v, { charte: v.charte || CHARTE_DEFAUT });
}
async function ecrire(db, v) {
  await db.upsert('hq_config', { key: CLE, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return v;
}
const actives = function (e) { return e.variantes.filter(function (v) { return v.statut !== 'retiree'; }); };

// La variante d'un prospect : stable (le même prospect garde la même tant que les variantes ne changent pas) et répartie
function variantePour(lead, e) {
  const a = actives(e);
  if (!a.length || !lead) return null;
  const h = ((Number(lead.id) || 0) * 2654435761 >>> 0) % a.length;
  return a[h];
}
// l'angle enregistré avec l'email : « v:A » suivi de l'angle de situation donné par la rédactrice (« v:A facebook »)
const angleDe = function (id, suite) { return 'v:' + id + (suite ? ' ' + String(suite).replace(/^v:\S*\s*/, '') : ''); };
const idDeAngle = function (angle) { const m = String(angle || '').match(/^v:([A-Z]{1,2})(?:\s|$)/); return m ? m[1] : null; };

// Ce que la rédactrice lit avant d'écrire : la consigne de chaque variante en test
function consignes(e) {
  const a = actives(e);
  if (!a.length) return '';
  return 'LES MESSAGES EN TEST (pôle écriture) : chaque prospect a SA variante (champ variante de lister_leads). Suis sa consigne à la lettre, c\'est elle qu\'on mesure :\n' + a.map(function (v) { return v.id + ' « ' + v.nom + ' » : ' + v.consigne; }).join('\n');
}

// Ce que chaque variante a donné : envoyés, réponses, intéressés, STOP, ventes, et le verdict
async function resultats(db, e) {
  e = e || await lire(db);
  const depuis = new Date(Date.now() - JOURS * 86400000).toISOString();
  const premiers = (await db.select('hq_outbox', { select: 'id,lead_id,angle,sent_at', eq: { kind: 'prospection', status: 'envoye' }, gte: { sent_at: depuis }, limit: 4000 })).filter(function (o) { return idDeAngle(o.angle) && o.lead_id; });
  const lids = Array.from(new Set(premiers.map(function (o) { return o.lead_id; })));
  const inbox = [], leads = [], sites = [];
  for (let i = 0; i < lids.length; i += 300) {
    const morceau = lids.slice(i, i + 300);
    const [ib, ld, st] = await Promise.all([
      db.select('hq_inbox', { select: 'lead_id,kind,intent', in: { lead_id: morceau }, limit: 4000 }),
      db.select('hq_leads', { select: 'id,status', in: { id: morceau }, limit: 4000 }),
      db.select('hq_sites', { select: 'lead_id,status', in: { lead_id: morceau, status: ['paye', 'livraison', 'en_ligne', 'pause'] }, limit: 4000 })
    ]);
    inbox.push.apply(inbox, ib); leads.push.apply(leads, ld); sites.push.apply(sites, st);
  }
  const parLead = {};
  lids.forEach(function (id) { parLead[id] = { reponse: false, positif: false, stop: false, vente: false }; });
  inbox.forEach(function (i) { const p = parLead[i.lead_id]; if (!p) return; if (i.kind === 'reponse') p.reponse = true; if (i.kind === 'stop' || i.intent === 'stop') p.stop = true; if (['interesse', 'rdv', 'question'].indexOf(i.intent) >= 0) p.positif = true; });
  leads.forEach(function (l) { const p = parLead[l.id]; if (!p) return; if (l.status === 'stop') p.stop = true; if (['interesse', 'client'].indexOf(l.status) >= 0) { p.positif = true; p.reponse = true; } });
  sites.forEach(function (s) { const p = parLead[s.lead_id]; if (p) { p.vente = true; p.positif = true; p.reponse = true; } });
  const stats = {};
  e.variantes.forEach(function (v) { stats[v.id] = { envoyes: 0, reponses: 0, positifs: 0, stop: 0, ventes: 0 }; });
  const vus = new Set();
  premiers.forEach(function (o) {
    const id = idDeAngle(o.angle), s = stats[id];
    if (!s || vus.has(o.lead_id)) return;
    vus.add(o.lead_id);
    const p = parLead[o.lead_id];
    s.envoyes++; if (p.reponse) s.reponses++; if (p.positif) s.positifs++; if (p.stop) s.stop++; if (p.vente) s.ventes++;
  });
  Object.keys(stats).forEach(function (id) {
    const s = stats[id];
    s.taux_reponse = s.envoyes ? Math.round(1000 * s.reponses / s.envoyes) / 10 : 0;
    s.taux_positif = s.envoyes ? Math.round(1000 * s.positifs / s.envoyes) / 10 : 0;
    s.taux_stop = s.envoyes ? Math.round(1000 * s.stop / s.envoyes) / 10 : 0;
    // une réponse compte, un « intéressé » compte double, une vente bien plus ; un STOP retire
    s.score = s.envoyes ? Math.round(1000 * (s.reponses + 2 * s.positifs + 5 * s.ventes - 2 * s.stop) / s.envoyes) / 1000 : 0;
  });
  // verdict : la meilleure (assez d'envois) mène ; une variante qui fait nettement moins bien, ou qui agace, est à retirer
  const jugees = actives(e).filter(function (v) { return stats[v.id].envoyes >= MIN_ENVOIS; });
  const tete = jugees.slice().sort(function (a, b) { return stats[b.id].score - stats[a.id].score; })[0] || null;
  return e.variantes.map(function (v) {
    const s = stats[v.id];
    let verdict = v.statut === 'retiree' ? 'retiree' : 'en_test';
    if (v.statut !== 'retiree' && s.envoyes >= MIN_ENVOIS) {
      if (s.taux_stop > 3) verdict = 'a_retirer';
      else if (tete && v.id === tete.id) verdict = 'en_tete';
      else if (tete && stats[tete.id].score > 0 && s.score < 0.6 * stats[tete.id].score) verdict = 'a_retirer';
    }
    return Object.assign({}, v, s, { verdict: verdict, manque: Math.max(0, MIN_ENVOIS - s.envoyes) });
  });
}

// Inès règle le pôle : nouvelle charte, une variante de plus, une variante retirée. Les règles dures restent dans le code.
async function regler(db, i, auteur) {
  const e = await lire(db);
  const t = new Date().toISOString(), faits = [];
  // une charte vide veut dire : pas de changement de charte (le reste du réglage passe quand même)
  const c = i.charte == null ? '' : String(i.charte).trim();
  if (c) {
    if (c.length < 200 || c.length > 3500) return { erreur: 'la charte fait entre 200 et 3 500 caractères' };
    if (/[—–]/.test(c)) return { erreur: 'pas de tiret long dans la charte (Louis n\'en veut nulle part)' };
    e.charte = c; faits.push('charte réécrite');
  }
  // retirer puis ajouter : on juge l'état final (une variante en test au moins, trois au plus)
  if (i.retirer) {
    const v = e.variantes.find(function (x) { return x.id === String(i.retirer).trim().toUpperCase(); });
    if (!v) return { erreur: 'variante inconnue : ' + i.retirer };
    if (v.statut !== 'retiree') { v.statut = 'retiree'; v.retiree_le = t; faits.push('variante ' + v.id + ' retirée'); }
  }
  if (i.ajouter && (String(i.ajouter.nom || '').trim() || String(i.ajouter.consigne || '').trim())) {
    const nom = String(i.ajouter.nom || '').trim(), consigne = String(i.ajouter.consigne || '').trim();
    if (actives(e).length >= MAX_ACTIVES) return { erreur: MAX_ACTIVES + ' variantes en test au plus : retire d\'abord la moins bonne (retirer et ajouter vont ensemble dans le même réglage)' };
    if (nom.length < 3 || nom.length > 50) return { erreur: 'un nom de 3 à 50 caractères' };
    if (consigne.length < 40 || consigne.length > 700) return { erreur: 'une consigne de 40 à 700 caractères, concrète (longueur, première phrase, angle, question finale)' };
    const prises = e.variantes.map(function (v) { return v.id; });
    let id = null;
    for (let k = 0; k < 26 * 27 && !id; k++) { const c = k < 26 ? String.fromCharCode(65 + k) : String.fromCharCode(65 + Math.floor(k / 26) - 1) + String.fromCharCode(65 + k % 26); if (prises.indexOf(c) < 0) id = c; }
    e.variantes.push({ id: id, nom: court(nom, 50), consigne: court(consigne, 700), statut: 'test', cree_le: t, par: auteur || null });
    faits.push('variante ' + id + ' en test : ' + nom);
  }
  if (!actives(e).length) return { erreur: 'il faut garder au moins une variante en test : ajoute la nouvelle dans le même réglage' };
  if (!faits.length) return { erreur: 'rien à régler (charte, ajouter ou retirer)' };
  e.historique = (e.historique || []).concat([{ le: t, par: auteur || null, quoi: faits.join(', '), note: i.note ? court(String(i.note), 300) : null }]).slice(-40);
  await ecrire(db, e);
  return { ok: true, fait: faits };
}

// Ce que la tour montre (Gestion, Emails)
async function tableau(db) {
  const e = await lire(db);
  const res = await resultats(db, e);
  return { charte: e.charte, variantes: res, min_envois: MIN_ENVOIS, historique: (e.historique || []).slice(-8).reverse() };
}

module.exports = { lire, ecrire, regler, resultats, tableau, variantePour, angleDe, idDeAngle, actives, consignes, CHARTE_DEFAUT, VARIANTES_DEFAUT, MIN_ENVOIS, MAX_ACTIVES };
