// Nina, responsable des langues du Studio : adapte chaque vidéo validée par Vera dans les autres langues de la ligne
// (titre, accroche, voix off phrase par phrase, chiffres à l'écran, étiquettes des pièces, description, hashtags du
// pays). Une adaptation, pas une traduction mot à mot : même durée, mêmes images, le ton d'un créateur du pays.
// Le français est écrit par Romane (la plume française) ; Nina le reprend seulement si Romane n'y arrive pas.
'use strict';
const S = require('../studio');
const V = require('../studio/viral');
const L = require('../studio/langues');
const { outil } = require('../studio/ecrire');
const { court } = require('../util');

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
  const Lg = S.LANGUES[langue] || {};
  return 'Tu es Nina, responsable des langues du Studio. Tu adaptes en ' + (Lg.nom || langue) + ' une vidéo verticale « comment ça marche » écrite en anglais, comme un créateur du pays l\'aurait écrite. ' + (CONSEILS[langue] || '') +
    '\n\n' + V.ACCROCHE +
    '\n\nRÈGLES\n1. Une phrase adaptée par phrase source, dans le même ordre, le même sens, les mêmes faits et chiffres (aucun ajout).\n2. Même longueur à l\'oral (à 15 % près) : les images sont calées sur chaque phrase.\n3. L\'accroche (phrase 1 et texte à l\'écran) garde toute sa force dans ta langue : réécris-la pour qu\'elle frappe, ne la traduis pas à plat ; un mot entre *étoiles* à l\'écran.\n4. Les mots forts entre *étoiles* (1 à 3 par phrase), aux mêmes endroits du sens.\n5. Une touche d\'humour de la version anglaise qui ne marche pas dans ta langue : remplace-la par une situation équivalente que tout le monde connaît dans le pays (jamais une personne ni un groupe, jamais de politique, jamais un drame).\n6. Les étiquettes : mêmes objets (même identifiant), texte de 2 ou 3 mots, 28 signes max, les noms techniques du pays.\n7. Le texte à l\'écran (ecran) : court, adapté (unités et nombres du pays).\n8. Hashtags : 5, ceux que le public du pays cherche vraiment.\n9. Pas de tiret long, pas d\'emoji.';
}

// le français revient à Romane, sauf si elle a échoué deux fois ou si la vidéo attend depuis plus de 6 heures
function pourNina(v) {
  const t = v.traductions || {};
  const c = v.critique || {};
  const attente = c.le ? Date.now() - new Date(c.le).getTime() : 0;
  const plumeEnPanne = (c.plume_echecs || 0) >= 2 || attente > 6 * 3600000;
  return (v.langues || []).filter((l) => l !== v.langue_source && !t[l] && (l !== S.PLUME || plumeEnPanne));
}

async function run(ctx) {
  const db = ctx.db;
  const liste = await db.select('hq_videos', { eq: { status: 'traduction' }, order: 'updated_at.asc', limit: 20 });
  if (!liste.length) return { resume: 'Aucune vidéo à adapter.', prochain_min: 45 };
  // une vidéo dont toutes les langues sont écrites avance ; sinon la première qui a du travail pour Nina
  for (const x of liste) if (!pourNina(x).length && await L.avancer(db, x.id)) return { resume: '« ' + court(x.titre, 60) + ' » : toutes les langues sont prêtes, l\'usine les rend.', produit: 0, prochain_min: 5 };
  const v = liste.find((x) => pourNina(x).length);
  if (!v) return { resume: 'J\'attends la version française de Romane.', prochain_min: 30 };
  if (!ctx.peutDepenser()) return { resume: 'Budget IA du jour atteint, je reprends plus tard.', prochain_min: 120 };
  const cibles = pourNina(v);
  const src = L.source(v);
  const faites = [], ratees = [];
  let cout = 0;
  for (const l of cibles.slice(0, 3)) {
    if (ctx.limite && Date.now() > ctx.limite - 40000) break;
    const contenu = 'LA VIDÉO EN ANGLAIS :\n' + JSON.stringify(src) + '\n\nAdapte-la (outil adapter_video).';
    let x = null, err = [];
    for (let essai = 0; essai < 2; essai++) {
      try {
        const r = await outil({ tier: l === 'hi' ? 'smart' : 'fast', systeme: systeme(l), contenu: contenu + (err.length ? '\n\nTA PREMIÈRE VERSION A ÉTÉ REFUSÉE :\n- ' + err.join('\n- ') : ''), outil: OUTIL, maxTokens: 5000 });
        cout += r.cout; x = r.entree; err = L.verifier(x, src);
      } catch (e) { cout += e.cout || 0; err = [court(e.message, 160)]; }
      if (!err.length) break;
    }
    if (err.length) { ratees.push(l + ' (' + court(err.join(' ; '), 120) + ')'); continue; }
    await L.enregistrer(db, v.id, l, L.propre(x));
    faites.push(l);
  }
  await S.ajouterCout(db, v.id, cout);
  // une langue impossible deux passages de suite : on la retire (la vidéo ne reste pas bloquée)
  if (ratees.length) {
    const deja = new Set(((v.critique || {}).langues_ratees) || []);
    const aRetirer = ratees.map((x) => x.slice(0, 2)).filter((l) => deja.has(l));
    await require('../db').majFraiche(db, 'hq_videos', v.id, (f) => ({ langues: (f.langues || []).filter((l) => aRetirer.indexOf(l) < 0), critique: Object.assign({}, f.critique || {}, { langues_ratees: Array.from(new Set(Array.from(deja).concat(ratees.map((x) => x.slice(0, 2))))) }) }));
  }
  const avance = await L.avancer(db, v.id);
  if (faites.length) ctx.compteurs.items++;
  return { resume: '« ' + court(v.titre, 60) + ' » adaptée en ' + (faites.join(', ') || 'aucune langue') + (ratees.length ? ' ; ratée(s) : ' + ratees.join(', ') : '') + (avance ? ' ; toutes les langues sont prêtes.' : '.'), cout, produit: faites.length, erreur: !faites.length && ratees.length > 0, prochain_min: 5 };
}

module.exports = { run, OUTIL, pourNina };
