// La conversation avec son équipe (« Parler à l'équipe ») : elle écrit comme à une collègue (« est-ce que tu peux… »),
// l'équipe répond, pose ses questions quand il lui manque quelque chose pour coller à ce qu'elle fait, et agit : lancer
// une vidéo, la faire réécrire, ajouter une langue, relancer un montage raté, changer un réglage, donner une consigne à
// une coéquipière, retenir ce qu'elle aime, proposer des idées, noter une idée.
// Un seul appel à Claude par message (le petit modèle, le moyen en qualité premium ; sur sa clé, dans son budget du
// jour) : la réponse arrive avec les actions, vérifiées et faites ici, une par une, et ce qui s'est passé est écrit sous la
// réponse. Ce qui coûte des dollars (un clip) ou se voit en public (publier) attend son « oui » d'un bouton.
// La conversation est gardée dans hq_config (crea:discussion:<compte>) : les 60 derniers messages.
'use strict';
const C = require('./index');
const CL = require('./claude');
const E = require('./equipe');
const B = require('./bible');
const { court, nettoie } = require('../util');

const iso = () => new Date().toISOString();
const GARDES = 60;
const propre = (s, n) => nettoie(court(String(s == null ? '' : s).replace(/[<>]/g, '').trim(), n));
const cle = (c) => 'crea:discussion:' + c.id;

async function lireTout(db, c) { const r = await db.one('hq_config', { eq: { key: cle(c) } }).catch(() => null); return ((r && r.value && r.value.messages) || []).slice(-GARDES); }
async function ecrire(db, c, messages) { await db.upsert('hq_config', { key: cle(c), value: { messages: messages.slice(-GARDES) }, updated_at: iso() }, { onConflict: 'key' }); }
async function lire(db, c) { return { messages: await lireTout(db, c) }; }

const TYPES = ['creer_video', 'creer_clip', 'reecrire', 'ajouter_langues', 'relancer_montage', 'refaire_montage', 'publier', 'annuler_programmation', 'modifier_reglages', 'consignes', 'retenir', 'oublier', 'proposer_idees', 'ajouter_idee'];
// ce qui attend son « oui » (un bouton sous la réponse)
const A_CONFIRMER = ['creer_clip', 'publier'];
const OUTIL = {
  name: 'repondre',
  description: 'Rend la réponse de l\'équipe : le message, les questions (avec des réponses toutes prêtes), les actions à faire, ce qu\'il faut retenir.',
  input_schema: {
    type: 'object',
    properties: {
      qui: { type: 'string', enum: C.ORDRE_ROLES, description: 'La coéquipière qui répond (la plus concernée)' },
      message: { type: 'string', description: 'La réponse, au tutoiement, courte (2 à 6 phrases), sans tiret long ni emoji' },
      questions: {
        type: 'array', maxItems: 3,
        items: { type: 'object', properties: { question: { type: 'string' }, choix: { type: 'array', items: { type: 'string' }, description: '2 à 4 réponses toutes prêtes, courtes' } }, required: ['question', 'choix'] }
      },
      actions: {
        type: 'array', maxItems: 4,
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: TYPES },
            video: { type: 'number', description: 'Le numéro de la vidéo visée' },
            sujet: { type: 'string' }, consigne: { type: 'string' },
            langues: { type: 'array', items: { type: 'string' }, description: 'Codes de langue (fr, en, es, pt, it, hi, zh, ja, de, ar...)' },
            format: { type: 'string', enum: ['court', 'long'] }, style: { type: 'string', enum: ['clips', 'ia', 'texte'] },
            modele: { type: 'string', enum: [''].concat(Object.keys(B.MODELES)) },
            ia_style: { type: 'string', enum: Object.keys(C.STYLES_IA) }, mouvement: { type: 'string', enum: Object.keys(C.MOUVEMENTS_IA) }, modele_video: { type: 'string', enum: C.MODELES_VIDEO },
            personnages: { type: 'array', items: { type: 'string' }, description: 'Les identifiants de ses personnages' },
            prompt: { type: 'string', description: 'Le prompt de réalisateur d\'un clip' }, qualite: { type: 'string', enum: C.MODELES_VIDEO }, musique: { type: 'string', description: 'La musique à créer pour un clip, en anglais' },
            quand: { type: 'string', enum: ['maintenant', 'programme'] },
            reglages: { type: 'object', description: 'Les réglages à changer (seulement ceux autorisés)' },
            role: { type: 'string', enum: C.ORDRE_ROLES }, texte: { type: 'string' }, theme: { type: 'string' },
            titre: { type: 'string' }, angle: { type: 'string' }
          },
          required: ['type']
        }
      }
    },
    required: ['qui', 'message']
  }
};

// les réglages qu'elle peut changer en le demandant (ni son budget, ni ses connexions, ni sa publication : ceux-là se
// règlent à la main)
function patchAutorise(x) {
  x = x && typeof x === 'object' ? x : {};
  const out = {};
  ['langues', 'langue_source', 'format', 'style', 'ia', 'musique', 'couleur', 'qualite', 'tendances', 'questions', 'voix_ia', 'pilote'].forEach((k) => { if (x[k] != null) out[k] = x[k]; });
  if (x.chaine && typeof x.chaine === 'object') { out.chaine = {}; ['nom', 'sujets', 'public', 'ton', 'exemples', 'interdits'].forEach((k) => { if (x.chaine[k] != null) out.chaine[k] = x.chaine[k]; }); }
  return out;
}

function systeme(c) {
  const eq = C.equipeDe(c);
  return 'Tu es l\'équipe de ' + c.prenom + ', une créatrice de vidéos courtes (TikTok, YouTube Shorts, Instagram Reels) : ' +
    C.ORDRE_ROLES.map((k) => eq[k].prenom + ' (' + eq[k].metier.toLowerCase() + ', « ' + k + ' »)').join(', ') + '. Elle vous parle comme à des collègues. Réponds au nom de la plus concernée.\n\n' +
    'CE QUE TU PEUX FAIRE (actions, faites tout de suite et vérifiées par le studio)\n' +
    '- creer_video : lance une vidéo racontée (sujet ; langues, format, style clips/ia/texte, modele de forme, ia_style, mouvement, modele_video, personnages, consigne pour la plume). Quelques centimes.\n' +
    '- creer_clip : un clip filmé par IA à partir d\'un prompt de réalisateur (prompt, qualite rapide/hd/pro/cinema, musique, personnages) : coûte plusieurs dollars, elle confirme d\'un bouton.\n' +
    '- reecrire : refait le script avec sa consigne, seulement si la vidéo est « Script à valider » ou « Bloquée ».\n' +
    '- ajouter_langues : une vidéo prête ou publiée reçoit d\'autres langues (sa voix et son montage, les autres langues ne bougent pas).\n' +
    '- relancer_montage : refait seulement les langues dont le montage a raté. refaire_montage : refait les images et le montage avec ses réglages actuels.\n' +
    '- publier : selon ses règles de publication (quand : maintenant ou programme) ; elle confirme d\'un bouton. annuler_programmation : annule ce qui est programmé.\n' +
    '- modifier_reglages : chaine (nom, sujets, public, ton, exemples, interdits), langues, langue_source, format, style, ia (style, mouvement, modele, images), musique, couleur, qualite (eco, equilibre, premium), tendances, questions (oui/non), voix_ia (actif, voix), pilote (actif, videos_jour, heure, relire, publier). Jamais son budget, ses clés ni sa publication : dis-lui où les régler.\n' +
    '- consignes : ajoute une consigne durable à une coéquipière (role, texte). retenir : une phrase courte sur ce qu\'elle aime, veut ou ne veut pas (texte). oublier : retire une phrase retenue (texte exact).\n' +
    '- proposer_idees : ' + eq.idees.prenom + ' cherche des idées (theme). ajouter_idee : note une idée dans son carnet (titre, angle).\n\n' +
    'TES RÈGLES\n' +
    '- Quand sa demande est floue, ou pour mieux coller à ce qu\'elle fait (ses sujets, son public, son ton, ses exemples, ce qu\'elle ne veut pas, ses personnages, son rythme), pose une à trois questions, chacune avec 2 à 4 réponses toutes prêtes. Pas d\'interrogatoire : l\'essentiel d\'abord.\n' +
    '- Quand c\'est clair, agis tout de suite et dis ce que tu fais, avec le prix à peu près. Ce que tu apprends d\'elle et qui durera, retiens-le (retenir) ou range-le dans ses réglages.\n' +
    '- Si elle demande l\'interview de sa chaîne : pose les questions petit à petit, puis enregistre ses réponses (modifier_reglages, retenir).\n' +
    '- Ne promets rien que tes actions ne font pas ; une action impossible (le statut de la vidéo), dis-le et propose ce qui marche.\n' +
    '- Une personne réelle et connue : jamais son visage, sa voix ni son nom dans une image ou une vidéo (c\'est un deepfake, interdit, et supprimé par les plateformes). Propose un personnage inventé qui ne ressemble à personne de réel, un archétype, ou ses propres personnages.\n' +
    '- Les vidéos et les langues se désignent par leur numéro et leur code. Réponds en français, au tutoiement, court, sans tiret long ni emoji.\n\n' +
    E.contexte(c);
}

// ce que l'équipe sait de son studio en ce moment : ses réglages utiles, ses vidéos récentes, la vidéo ouverte
async function etat(db, c, videoId) {
  const r = C.reglagesDe(c);
  const d = C.depense(c);
  const vids = await db.select('hq_crea_videos', { eq: { createur_id: c.id }, order: ['created_at.desc'], limit: 12, select: 'id,status,titre,langues,langue_source,rendus,publication,plan,etape,created_at' }).catch(() => []);
  const pub = (v) => Object.keys(v.publication || {}).map((l) => l + ':' + Object.keys((v.publication[l] || {}).plateformes || {}).map((p) => p + '=' + v.publication[l].plateformes[p].etat).join('/')).join(' ');
  const out = {
    reglages: { langue: r.langue_source, langues: r.langues, format: r.format, style: r.style, ia: r.ia, qualite: r.qualite, musique: r.musique, voix: r.voix_ia, questions: r.questions, pilote: r.pilote },
    budget: { jour: Math.round(d.jour * 100) / 100, plafond: r.budget_jour, video_estimee: C.coutEstime(r, r.langues.length, C.voixNaturelle(c)) },
    connexions: { claude: !!(c.secrets || {}).claude, fal: !!(c.secrets || {}).fal, uploadpost: !!(c.secrets || {}).uploadpost },
    publication: Object.fromEntries(Object.keys(r.publication || {}).map((l) => { const g = C.regleDe(r, l); return [l, g.profil ? g.profil + ' (' + g.plateformes.join('+') + ', ' + g.mode + ')' : 'à la main']; })),
    personnages: r.personnages.map((p) => ({ id: p.id, nom: p.nom, genre: p.genre, photos: (p.photos || []).length })),
    videos: vids.map((v) => ({ n: v.id, titre: court(v.titre, 70), statut: C.statutDe(v), genre: (v.plan || {}).genre === 'clip' ? 'clip' : 'video', langues: v.langues, montees: Object.keys(v.rendus || {}).filter((l) => (v.rendus[l] || {}).etat === 'fini'), ratees: Object.keys(v.rendus || {}).filter((l) => (v.rendus[l] || {}).etat === 'echec'), publication: pub(v) || undefined, souci: (v.etape || {}).erreur || undefined }))
  };
  const ouverte = videoId ? await db.one('hq_crea_videos', { eq: { id: Number(videoId), createur_id: c.id } }).catch(() => null) : null;
  if (ouverte) {
    const s = ouverte.script || {};
    out.video_ouverte = { n: ouverte.id, titre: ouverte.titre, sujet: court(ouverte.sujet, 300), statut: C.statutDe(ouverte), style: (ouverte.plan || {}).style, accroche: s.accroche, phrases: (s.beats || []).slice(0, 20).map((b) => court(String(b.voix || '').replace(/\*/g, ''), 160)), note: (ouverte.critique || {}).note || undefined };
  }
  return out;
}

function nettoyerReponse(x, c) {
  x = x || {};
  const qui = C.ORDRE_ROLES.indexOf(x.qui) >= 0 ? x.qui : 'idees';
  const questions = (Array.isArray(x.questions) ? x.questions : []).map((q) => q && { question: propre(q.question, 160), choix: (Array.isArray(q.choix) ? q.choix : []).map((t) => propre(t, 70)).filter(Boolean).slice(0, 4) }).filter((q) => q && q.question).slice(0, 3);
  const actions = (Array.isArray(x.actions) ? x.actions : []).filter((a) => a && TYPES.indexOf(a.type) >= 0).slice(0, 4);
  return { qui, message: propre(x.message, 1500) || 'Je regarde ça.', questions, actions };
}

// Une action de l'équipe, faite pour de vrai (ou mise de côté pour son « oui ») : rend ce qui s'est passé
async function faire(db, c, a, deps) {
  const CH = deps.CH;
  const id = Number(a.video) || null;
  const nom = (l) => (C.LANGUES[l] || {}).nom || l;
  const res = (ok, texte, extra) => Object.assign({ type: a.type, ok, texte }, extra || {});
  try {
    if (a.type === 'creer_video') {
      const ia = a.style === 'ia' ? { style: a.ia_style, mouvement: a.mouvement, modele: a.modele_video } : undefined;
      const r = await CH.creer(db, c, { sujet: a.sujet, langues: Array.isArray(a.langues) && a.langues.length ? a.langues : undefined, format: a.format, style: a.style, ia, modele: a.modele || null, personnages: a.personnages, consigne: a.consigne });
      return r.ok ? res(true, 'Vidéo lancée : « ' + court(r.video.titre || r.video.sujet, 70) + ' »', { video: r.video.id }) : res(false, r.erreur);
    }
    if (a.type === 'reecrire') { const r = await CH.reecrire(db, c, id, a.consigne || a.texte); return r.ok ? res(true, 'Le script repart à l\'écriture', { video: id }) : res(false, r.erreur); }
    if (a.type === 'ajouter_langues') { const r = await CH.ajouterLangues(db, c, id, a.langues); return r.ok ? res(true, 'Ajout de : ' + r.langues.map(nom).join(', '), { video: id }) : res(false, r.erreur); }
    if (a.type === 'relancer_montage') { const r = await CH.relancerMontage(db, c, id); return r.ok ? res(true, 'Le montage raté repart', { video: id }) : res(false, r.erreur); }
    if (a.type === 'refaire_montage') { const r = await CH.refaireMontage(db, c, id); return r.ok ? res(true, 'Le montage est refait', { video: id }) : res(false, r.erreur); }
    if (a.type === 'annuler_programmation') { const r = await CH.annulerProgrammation(db, c, id, (a.langues || [])[0] || null); return r.ok ? res(true, 'Programmation annulée', { video: id }) : res(false, r.erreur); }
    if (a.type === 'publier') {
      if (!deps.confirme) return res(null, 'Publier la vidéo n° ' + id + (a.quand === 'programme' ? ' à l\'heure de grande écoute' : ' maintenant'), { attente: true, video: id });
      const r = await CH.publier(db, c, id, Array.isArray(a.langues) && a.langues.length ? Object.fromEntries(a.langues.map((l) => [l, ['tiktok', 'youtube', 'instagram']])) : null, a.quand === 'programme' ? 'programme' : 'maintenant');
      return r.ok ? res(true, 'Publication lancée' + ((r.ignorees || []).length ? ' (' + r.ignorees.map((x) => x.nom + ' : ' + x.raison).join(' ; ') + ')' : ''), { video: id }) : res(false, r.erreur);
    }
    if (a.type === 'creer_clip') {
      const CLIP = require('./clip');
      const o = { genre: 'clip', prompt: a.prompt, qualite: C.MODELES_VIDEO.indexOf(a.qualite) >= 0 ? a.qualite : 'hd', format: '9:16', montage: 'zooms', bruitages: true, valider: true, musique: a.musique ? { source: 'ia', idee: a.musique } : { source: 'aucune' }, personnages: a.personnages };
      if (!deps.confirme) {
        const est = CLIP.estimer({ prompt: o.prompt, qualite: o.qualite, musique: o.musique.source });
        return res(null, 'Lancer ce clip en qualité ' + ((CLIP.QUALITES[o.qualite] || {}).nom || o.qualite) + ' (environ ' + est.total.toFixed(2).replace('.', ',') + ' $ sur ta clé fal, images d\'abord : tu valides avant le tournage)', { attente: true, prix: est.total });
      }
      const r = await CH.creer(db, c, o);
      return r.ok ? res(true, 'Clip lancé : tu valides les images avant le tournage', { video: r.video.id }) : res(false, r.erreur);
    }
    if (a.type === 'modifier_reglages') {
      const patch = patchAutorise(a.reglages);
      if (!Object.keys(patch).length) return res(false, 'ce réglage se change à la main, dans Réglages');
      const reglages = C.nettoyerReglages(patch, c.reglages);
      await db.update('hq_createurs', { reglages, updated_at: iso() }, { eq: { id: c.id } });
      c.reglages = reglages;
      return res(true, 'Réglages changés : ' + Object.keys(patch).join(', '), { moi: true });
    }
    if (a.type === 'consignes') {
      const role = C.ORDRE_ROLES.indexOf(a.role) >= 0 ? a.role : null;
      const t = propre(a.texte || a.consigne, 300);
      if (!role || !t) return res(false, 'consigne incomplète');
      const avant = C.equipeDe(c)[role].consignes || '';
      const equipe = C.nettoyerEquipe({ [role]: { consignes: court((avant ? avant + '\n' : '') + t, 600) } }, c.equipe);
      await db.update('hq_createurs', { equipe, updated_at: iso() }, { eq: { id: c.id } });
      c.equipe = equipe;
      return res(true, 'Consigne donnée à ' + C.equipeDe(c)[role].prenom, { moi: true });
    }
    if (a.type === 'retenir' || a.type === 'oublier') {
      const t = propre(a.texte, 200);
      if (!t) return res(false, 'rien à retenir');
      const r = C.reglagesDe(c);
      const memoire = a.type === 'retenir' ? C.nettoyerMemoire([t].concat(r.memoire)) : r.memoire.filter((x) => x.toLowerCase() !== t.toLowerCase());
      const reglages = Object.assign({}, c.reglages || {}, { memoire });
      await db.update('hq_createurs', { reglages, updated_at: iso() }, { eq: { id: c.id } });
      c.reglages = reglages;
      return res(true, (a.type === 'retenir' ? 'Retenu : ' : 'Oublié : ') + t, { moi: true });
    }
    if (a.type === 'proposer_idees') {
      const recentes = await db.select('hq_crea_videos', { eq: { createur_id: c.id }, order: ['created_at.desc'], limit: 25, select: 'titre' });
      const r = await E.proposerIdees(db, c, { theme: a.theme, deja: recentes.map((x) => x.titre).filter(Boolean).concat((c.idees || []).map((x) => x.titre)), recherches: C.reglagesDe(c).tendances });
      const frais = await db.one('hq_createurs', { eq: { id: c.id }, select: 'id,idees' });
      const idees = r.idees.concat((frais || c).idees || []).slice(0, 12);
      await db.update('hq_createurs', { idees, updated_at: iso() }, { eq: { id: c.id } });
      c.idees = idees;
      return res(true, r.idees.length + ' idées dans Créer : ' + r.idees.slice(0, 3).map((x) => '« ' + court(x.titre, 50) + ' »').join(', '), { moi: true, idees: true });
    }
    if (a.type === 'ajouter_idee') {
      const t = propre(a.titre || a.sujet, 90);
      if (!t) return res(false, 'idée vide');
      const frais = await db.one('hq_createurs', { eq: { id: c.id }, select: 'id,idees' });
      const idees = [{ id: Date.now().toString(36) + 'm', titre: t, angle: propre(a.angle || a.texte, 400), accroche: '', pourquoi: '', source: 'moi', le: iso() }].concat((frais || c).idees || []).slice(0, 12);
      await db.update('hq_createurs', { idees, updated_at: iso() }, { eq: { id: c.id } });
      c.idees = idees;
      return res(true, 'Idée notée : « ' + t + ' »', { moi: true, idees: true });
    }
    return res(false, 'action inconnue');
  } catch (e) {
    if (e.code === 'budget' || /^cle|credit/.test(e.code || '')) return res(false, e.message);
    return res(false, court(e.message || String(e), 200));
  }
}

// Son message : la réponse de l'équipe, ses actions faites (ou en attente de son « oui »)
async function envoyer(db, c, b, deps) {
  b = b || {};
  const texte = propre(b.texte, 2000);
  if (!texte) return { code: 400, erreur: 'écris ton message' };
  if (!(c.secrets || {}).claude) return { code: 409, erreur: 'branche d\'abord ta clé Claude : ton équipe en a besoin pour te répondre (Réglages, Connexions)' };
  const messages = await lireTout(db, c);
  const moi = { id: Date.now(), auteur: 'moi', texte, le: iso(), video: Number(b.video) || undefined };
  const histoire = messages.slice(-16).map((m) => (m.auteur === 'moi' ? 'ELLE : ' : 'ÉQUIPE (' + (m.qui || '') + ') : ') + court(m.texte, 600) + (m.resultats && m.resultats.length ? ' [fait : ' + m.resultats.map((x) => (x.ok ? '' : x.ok === false ? 'raté, ' : 'en attente, ') + court(x.texte, 120)).join(' ; ') + ']' : '')).join('\n');
  const st = await etat(db, c, b.video);
  const prompt = 'ÉTAT DE SON STUDIO (en ce moment) :\n' + JSON.stringify(st) + (histoire ? '\n\nLA CONVERSATION JUSQU\'ICI :\n' + histoire : '') + '\n\nSON MESSAGE : « ' + texte + ' »\n\nAppelle l\'outil repondre.';
  let x;
  try {
    const r = await CL.appeler(db, c, { usage: 'discuter', system: systeme(c), prompt, outil: OUTIL, maxTokens: 1600 });
    x = nettoyerReponse(r.sortie, c);
    x.cout = r.cout;
  } catch (e) {
    return { code: e.code === 'budget' || /^cle|credit/.test(e.code || '') ? 402 : 400, erreur: court(e.message, 300), code_erreur: e.code || null };
  }
  const resultats = [];
  let maj = false, idees = false;
  for (let i = 0; i < x.actions.length; i++) {
    const r = await faire(db, c, x.actions[i], Object.assign({}, deps, { confirme: false }));
    if (r.attente) r.i = i;
    if (r.moi) maj = true;
    if (r.idees) idees = true;
    resultats.push(r);
  }
  const reponse = { id: Date.now() + 1, auteur: 'equipe', qui: x.qui, texte: x.message, questions: x.questions, resultats, actions: x.actions.filter((a, i) => (resultats[i] || {}).attente).length ? x.actions : undefined, le: iso(), cout: x.cout, video: moi.video };
  await ecrire(db, c, messages.concat([moi, reponse]));
  return { code: 200, ok: true, messages: [moi, reponse], maj, idees, videos: resultats.some((r) => r.video && r.ok) };
}

// son « oui » à une action en attente (un clip, une publication)
async function confirmer(db, c, b, deps) {
  const messages = await lireTout(db, c);
  const m = messages.find((x) => x.id === Number(b.message) && x.auteur === 'equipe');
  const i = Number(b.action);
  if (!m || !Array.isArray(m.actions) || !m.actions[i] || !(m.resultats || [])[i] || !m.resultats[i].attente) return { code: 404, erreur: 'cette proposition n\'attend plus de réponse' };
  const r = await faire(db, c, m.actions[i], Object.assign({}, deps, { confirme: true }));
  m.resultats[i] = Object.assign({}, r, { attente: false, confirme_le: iso() });
  await ecrire(db, c, messages);
  return { code: 200, ok: true, message: m, resultat: r };
}

async function effacer(db, c) { await ecrire(db, c, []); return { code: 200, ok: true }; }

module.exports = { lire, envoyer, confirmer, effacer, faire, etat, systeme, patchAutorise, nettoyerReponse, OUTIL, TYPES, A_CONFIRMER };
