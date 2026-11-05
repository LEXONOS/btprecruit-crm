// Nina, responsable des langues du Studio : adapte chaque vidéo validée par Vera dans les autres langues de la ligne
// (titre, accroche, voix off phrase par phrase, chiffres à l'écran, étiquettes des pièces, description, hashtags du
// pays). Une adaptation, pas une traduction mot à mot : même durée, mêmes images, le ton d'un créateur du pays.
'use strict';
const S = require('../studio');
const { outil } = require('../studio/ecrire');
const { court, nettoie } = require('../util');

const OUTIL = {
  name: 'adapter_video',
  description: 'La vidéo adaptée dans la langue demandée.',
  input_schema: {
    type: 'object',
    properties: {
      titre: { type: 'string', description: 'Titre (70 signes max)' },
      accroche: { type: 'string', description: 'Texte de l\'accroche à l\'écran, 7 mots max, un mot entre *étoiles*' },
      beats: { type: 'array', items: { type: 'object', properties: { voix: { type: 'string' }, ecran: { type: 'string' }, etiquettes: { type: 'array', items: { type: 'object', properties: { objet: { type: 'string' }, texte: { type: 'string' } }, required: ['objet', 'texte'] } } }, required: ['voix'] } },
      description: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' } }
    },
    required: ['titre', 'accroche', 'beats', 'description', 'hashtags']
  }
};

const CONSEILS = {
  fr: 'Français parlé de créateur TikTok, tutoiement (« ta clim »), phrases vivantes. Unités métriques.',
  es: 'Español neutro latinoamericano (audiencia de México a Argentina), tuteo, frases vivas.',
  pt: 'Português do Brasil, coloquial e direto (você), frases vivas.',
  it: 'Italiano parlato, diretto, dai del tu.',
  hi: 'Hindi parlé courant (hinglish accepté pour les mots techniques usuels : AC, compressor), en écriture devanagari, chiffres en chiffres. Ton d\'un créateur indien de vidéos éducatives.',
  en: 'Simple spoken English.'
};

function systeme(langue) {
  const L = S.LANGUES[langue] || {};
  return 'Tu es Nina, responsable des langues du Studio. Tu adaptes en ' + (L.nom || langue) + ' une vidéo verticale « comment ça marche » écrite en anglais. ' + (CONSEILS[langue] || '') +
    '\nRÈGLES\n1. Une phrase adaptée par phrase source, dans le même ordre, le même sens, les mêmes faits et chiffres (aucun ajout).\n2. Même longueur à l\'oral (à 15 % près) : les images sont calées sur chaque phrase.\n3. L\'accroche garde sa force (une contradiction, une question) ; un mot entre *étoiles*.\n4. Les étiquettes : mêmes objets (même identifiant), texte de 2 ou 3 mots, 28 signes max, les noms techniques du pays.\n5. Le texte à l\'écran (ecran) : court, adapté (unités et nombres du pays).\n6. Hashtags : 5, ceux que le public du pays cherche vraiment.\n7. Pas de tiret long, pas d\'emoji.';
}

function source(v) {
  const s = v.script || {};
  const plans = (v.scene && v.scene.plans) || [];
  return { titre: s.titre, accroche: s.accroche, description: s.description, hashtags: s.hashtags, beats: (s.beats || []).map((b, i) => ({ voix: b.voix, ecran: b.ecran || undefined, etiquettes: (plans[i] && plans[i].etiquettes) || [] })) };
}

function verifier(x, src) {
  const err = [];
  if (!Array.isArray(x.beats) || x.beats.length !== src.beats.length) return ['il faut ' + src.beats.length + ' phrases (ici ' + ((x.beats || []).length) + ')'];
  x.beats.forEach((b, i) => {
    const s = src.beats[i];
    const l0 = String(s.voix).length, l1 = String(b.voix || '').length;
    if (!b.voix) err.push('phrase ' + (i + 1) + ' vide');
    else if (l1 > l0 * 1.6 + 20) err.push('phrase ' + (i + 1) + ' beaucoup trop longue');
    const objets = (s.etiquettes || []).map((e) => e.objet);
    const ets = Array.isArray(b.etiquettes) ? b.etiquettes : [];
    if (ets.length !== objets.length || ets.some((e, k) => e.objet !== objets[k])) err.push('phrase ' + (i + 1) + ' : les étiquettes doivent viser ' + (objets.join(', ') || 'aucun objet'));
    ets.forEach((e) => { if (!e.texte || String(e.texte).length > 28) err.push('phrase ' + (i + 1) + ' : étiquette trop longue « ' + e.texte + ' »'); });
  });
  return err;
}

async function run(ctx) {
  const db = ctx.db;
  const v = await db.one('hq_videos', { eq: { status: 'traduction' }, order: 'updated_at.asc' });
  if (!v) return { resume: 'Aucune vidéo à adapter.', prochain_min: 45 };
  const cibles = (v.langues || []).filter((l) => l !== v.langue_source && !(v.traductions || {})[l]);
  if (!cibles.length) {
    const autres = (v.langues || []).filter((l) => l !== v.langue_source);
    await S.maj(db, v.id, { status: autres.length ? 'langues' : 'prete' }, 'traduction');
    if (autres.length) await db.update('hq_agents', { next_run_at: new Date(Date.now() + 60000).toISOString() }, { eq: { id: 'monteur' }, neq: { status: 'paused' } }).catch(() => null);
    return { resume: '« ' + court(v.titre, 60) + ' » : toutes les langues sont prêtes' + (autres.length ? ', l\'usine les rend.' : '.'), produit: 0, prochain_min: 5 };
  }
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const src = source(v);
  const faites = [], ratees = [];
  let cout = 0;
  for (const l of cibles.slice(0, 3)) {
    if (ctx.limite && Date.now() > ctx.limite - 40000) break;
    const contenu = 'LA VIDÉO EN ANGLAIS :\n' + JSON.stringify(src) + '\n\nAdapte-la (outil adapter_video).';
    let x = null, err = [];
    for (let essai = 0; essai < 2; essai++) {
      try {
        const r = await outil({ tier: l === 'hi' ? 'smart' : 'fast', systeme: systeme(l), contenu: contenu + (err.length ? '\n\nTA PREMIÈRE VERSION A ÉTÉ REFUSÉE :\n- ' + err.join('\n- ') : ''), outil: OUTIL, maxTokens: 5000 });
        cout += r.cout; x = r.entree; err = verifier(x, src);
      } catch (e) { cout += e.cout || 0; err = [court(e.message, 160)]; }
      if (!err.length) break;
    }
    if (err.length) { ratees.push(l + ' (' + court(err.join(' ; '), 120) + ')'); continue; }
    const propre = {
      titre: nettoie(court(x.titre, 90)), accroche: nettoie(court(x.accroche, 70)), description: nettoie(court(x.description, 400)),
      hashtags: (x.hashtags || []).slice(0, 6).map((h) => '#' + String(h).replace(/^#+/, '').replace(/\s+/g, '')),
      beats: x.beats.map((b) => ({ voix: nettoie(String(b.voix).trim()), ecran: b.ecran ? nettoie(court(b.ecran, 14)) : null, etiquettes: (b.etiquettes || []).map((e) => ({ objet: e.objet, texte: nettoie(court(e.texte, 28)) })) }))
    };
    await require('../db').majFraiche(db, 'hq_videos', v.id, (f) => (f.status === 'traduction' ? { traductions: Object.assign({}, f.traductions || {}, { [l]: propre }) } : null));
    faites.push(l);
  }
  await S.ajouterCout(db, v.id, cout);
  // une langue impossible deux passages de suite : on la retire (la vidéo ne reste pas bloquée)
  if (ratees.length) {
    const deja = new Set(((v.critique || {}).langues_ratees) || []);
    const aRetirer = ratees.map((x) => x.slice(0, 2)).filter((l) => deja.has(l));
    await require('../db').majFraiche(db, 'hq_videos', v.id, (f) => ({ langues: (f.langues || []).filter((l) => aRetirer.indexOf(l) < 0), critique: Object.assign({}, f.critique || {}, { langues_ratees: Array.from(new Set(Array.from(deja).concat(ratees.map((x) => x.slice(0, 2))))) }) }));
  }
  if (faites.length) ctx.compteurs.items++;
  return { resume: '« ' + court(v.titre, 60) + ' » adaptée en ' + (faites.join(', ') || 'aucune langue') + (ratees.length ? ' ; ratée(s) : ' + ratees.join(', ') : '') + '.', cout, produit: faites.length, erreur: !faites.length && ratees.length > 0, prochain_min: 5 };
}

module.exports = { run, verifier, source, OUTIL };
