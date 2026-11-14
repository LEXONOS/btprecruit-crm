// Le studio des créatrices (/studio) : les amies de Louis font leurs vidéos TikTok, YouTube et Instagram avec leur
// propre équipe d'agents, de l'idée à la publication. Chacune a son compte, ses réglages, son équipe (prénoms,
// couleurs, consignes), sa clé Claude (elle paie ses vidéos, dans le budget du jour qu'elle choisit) et, si elle le
// veut, la publication automatique par upload-post. La tour fournit le reste : le montage (l'usine sur GitHub Actions),
// les vidéos d'illustration (Pexels, la clé de Louis, gratuite), le stockage des vidéos (14 jours).
// Ici : les langues et les voix, les rôles de l'équipe, les réglages par défaut et leur nettoyage, les vues envoyées
// à la page (jamais une clé, jamais un jeton de l'usine).
'use strict';
const { court, nettoie } = require('../util');

// Les langues des vidéos et leurs voix, toutes gratuites, sur l'usine. Deux moteurs : Kokoro (les voix les plus
// naturelles : français, anglais, espagnol, portugais, italien, hindi, chinois, japonais) et Piper (une voix correcte
// pour une vingtaine d'autres langues, et des voix de plus pour certaines des premières : « piper:<nom de la voix> »).
// Les voix britanniques de Kokoro (bf_, bm_) parlent l'anglais britannique. cjk : écrit sans espaces (les sous-titres
// coupent par mots, pas par espaces) ; rtl : écrit de droite à gauche.
const P = (nom, libelle) => ['piper:' + nom, libelle];
const LANGUES = {
  fr: { nom: 'Français', kokoro: 'fr-fr', defaut: 'ff_siwis', vitesse: 1.05, voix: [['ff_siwis', 'Siwis, femme'], P('fr_FR-tom-medium', 'Tom, homme'), P('fr_FR-gilles-low', 'Gilles, homme, voix grave')] },
  en: {
    nom: 'Anglais', kokoro: 'en-us', defaut: 'af_heart', vitesse: 1.0,
    voix: [['af_heart', 'Heart, femme, chaleureuse'], ['af_bella', 'Bella, femme, pétillante'], ['af_nicole', 'Nicole, femme, douce'], ['af_sarah', 'Sarah, femme, claire'],
      ['am_michael', 'Michael, homme, posé'], ['am_fenrir', 'Fenrir, homme, voix grave'], ['am_puck', 'Puck, homme, dynamique'],
      ['bf_emma', 'Emma, femme, accent britannique'], ['bm_george', 'George, homme, accent britannique'], ['bm_fable', 'Fable, homme, conteur britannique']]
  },
  es: { nom: 'Espagnol', kokoro: 'es', defaut: 'ef_dora', vitesse: 1.0, voix: [['ef_dora', 'Dora, femme'], ['em_alex', 'Alex, homme'], ['em_santa', 'Santa, homme, voix grave'], P('es_AR-daniela-high', 'Daniela, femme, accent argentin'), P('es_MX-ald-medium', 'Voix mexicaine')] },
  pt: { nom: 'Portugais (Brésil)', kokoro: 'pt-br', defaut: 'pf_dora', vitesse: 1.0, voix: [['pf_dora', 'Dora, femme'], ['pm_alex', 'Alex, homme'], ['pm_santa', 'Santa, homme, voix grave']] },
  it: { nom: 'Italien', kokoro: 'it', defaut: 'if_sara', vitesse: 1.0, voix: [['if_sara', 'Sara, femme'], ['im_nicola', 'Nicola, homme'], P('it_IT-paola-medium', 'Paola, femme')] },
  hi: { nom: 'Hindi', kokoro: 'hi', defaut: 'hf_alpha', vitesse: 1.0, voix: [['hf_alpha', 'Alpha, femme'], ['hf_beta', 'Beta, femme'], ['hm_omega', 'Omega, homme'], ['hm_psi', 'Psi, homme']] },
  zh: {
    nom: 'Chinois (mandarin)', kokoro: 'cmn', defaut: 'zf_xiaoxiao', vitesse: 1.0, cjk: true,
    voix: [['zf_xiaoxiao', 'Xiaoxiao, femme'], ['zf_xiaobei', 'Xiaobei, femme'], ['zf_xiaoni', 'Xiaoni, femme'], ['zf_xiaoyi', 'Xiaoyi, femme'],
      ['zm_yunxi', 'Yunxi, homme'], ['zm_yunjian', 'Yunjian, homme'], ['zm_yunxia', 'Yunxia, homme'], ['zm_yunyang', 'Yunyang, homme']]
  },
  ja: { nom: 'Japonais', kokoro: 'ja', defaut: 'jf_alpha', vitesse: 1.0, cjk: true, voix: [['jf_alpha', 'Alpha, femme'], ['jf_gongitsune', 'Gongitsune, femme'], ['jf_nezumi', 'Nezumi, femme'], ['jf_tebukuro', 'Tebukuro, femme'], ['jm_kumo', 'Kumo, homme']] },
  de: { nom: 'Allemand', defaut: 'piper:de_DE-thorsten-medium', vitesse: 1.0, voix: [P('de_DE-thorsten-medium', 'Thorsten, homme'), P('de_DE-kerstin-low', 'Kerstin, femme'), P('de_DE-ramona-low', 'Ramona, femme')] },
  nl: { nom: 'Néerlandais', defaut: 'piper:nl_BE-nathalie-medium', vitesse: 1.0, voix: [P('nl_BE-nathalie-medium', 'Nathalie, femme, accent flamand'), P('nl_NL-ronnie-medium', 'Ronnie, homme'), P('nl_NL-pim-medium', 'Pim, homme')] },
  ar: { nom: 'Arabe', defaut: 'piper:ar_JO-kareem-medium', vitesse: 1.0, rtl: true, voix: [P('ar_JO-kareem-medium', 'Kareem, homme')] },
  ru: { nom: 'Russe', defaut: 'piper:ru_RU-irina-medium', vitesse: 1.0, voix: [P('ru_RU-irina-medium', 'Irina, femme'), P('ru_RU-dmitri-medium', 'Dmitri, homme'), P('ru_RU-ruslan-medium', 'Ruslan, homme')] },
  uk: { nom: 'Ukrainien', defaut: 'piper:uk_UA-ukrainian_tts-medium', vitesse: 1.0, voix: [P('uk_UA-ukrainian_tts-medium', 'Voix ukrainienne'), P('uk_UA-lada-x_low', 'Lada, femme')] },
  pl: { nom: 'Polonais', defaut: 'piper:pl_PL-gosia-medium', vitesse: 1.0, voix: [P('pl_PL-gosia-medium', 'Gosia, femme'), P('pl_PL-darkman-medium', 'Voix d\'homme')] },
  tr: { nom: 'Turc', defaut: 'piper:tr_TR-fettah-medium', vitesse: 1.0, voix: [P('tr_TR-fettah-medium', 'Fettah, homme'), P('tr_TR-fahrettin-medium', 'Fahrettin, homme'), P('tr_TR-dfki-medium', 'Voix 3')] },
  ro: { nom: 'Roumain', defaut: 'piper:ro_RO-mihai-medium', vitesse: 1.0, voix: [P('ro_RO-mihai-medium', 'Mihai, homme')] },
  el: { nom: 'Grec', defaut: 'piper:el_GR-rapunzelina-low', vitesse: 1.0, voix: [P('el_GR-rapunzelina-low', 'Voix de femme')] },
  cs: { nom: 'Tchèque', defaut: 'piper:cs_CZ-jirka-medium', vitesse: 1.0, voix: [P('cs_CZ-jirka-medium', 'Jirka, homme')] },
  sk: { nom: 'Slovaque', defaut: 'piper:sk_SK-lili-medium', vitesse: 1.0, voix: [P('sk_SK-lili-medium', 'Lili, femme')] },
  hu: { nom: 'Hongrois', defaut: 'piper:hu_HU-anna-medium', vitesse: 1.0, voix: [P('hu_HU-anna-medium', 'Anna, femme'), P('hu_HU-imre-medium', 'Imre, homme'), P('hu_HU-berta-medium', 'Berta, femme')] },
  sv: { nom: 'Suédois', defaut: 'piper:sv_SE-lisa-medium', vitesse: 1.0, voix: [P('sv_SE-lisa-medium', 'Lisa, femme'), P('sv_SE-nst-medium', 'Voix 2')] },
  da: { nom: 'Danois', defaut: 'piper:da_DK-talesyntese-medium', vitesse: 1.0, voix: [P('da_DK-talesyntese-medium', 'Voix danoise')] },
  no: { nom: 'Norvégien', defaut: 'piper:no_NO-talesyntese-medium', vitesse: 1.0, voix: [P('no_NO-talesyntese-medium', 'Voix norvégienne')] },
  fi: { nom: 'Finnois', defaut: 'piper:fi_FI-harri-medium', vitesse: 1.0, voix: [P('fi_FI-harri-medium', 'Harri, homme')] },
  ca: { nom: 'Catalan', defaut: 'piper:ca_ES-upc_ona-medium', vitesse: 1.0, voix: [P('ca_ES-upc_ona-medium', 'Ona, femme')] },
  vi: { nom: 'Vietnamien', defaut: 'piper:vi_VN-vais1000-medium', vitesse: 1.0, voix: [P('vi_VN-vais1000-medium', 'Voix vietnamienne')] },
  fa: { nom: 'Persan', defaut: 'piper:fa_IR-amir-medium', vitesse: 1.0, rtl: true, voix: [P('fa_IR-amir-medium', 'Amir, homme'), P('fa_IR-gyro-medium', 'Voix 2')] },
  sw: { nom: 'Swahili', defaut: 'piper:sw_CD-lanfrica-medium', vitesse: 1.0, voix: [P('sw_CD-lanfrica-medium', 'Voix swahilie')] }
};
// les langues aux voix les plus naturelles d'abord (l'ordre des listes)
const NATURELLES = ['fr', 'en', 'es', 'pt', 'it', 'hi', 'zh', 'ja'];

// L'équipe de chaque créatrice : six rôles, dont elle choisit les prénoms, les couleurs et les consignes
const ROLES = {
  idees: { prenom: 'Maya', couleur: '#F59E0B', metier: 'Les idées', fait: 'Cherche ce qui marche dans ta niche en ce moment et te propose des idées de vidéos.' },
  plume: { prenom: 'Inès', couleur: '#8B5CF6', metier: 'Le script', fait: 'Écrit le script : l\'accroche, chaque phrase dite, le texte à l\'écran, le titre et les hashtags.' },
  critique: { prenom: 'Jade', couleur: '#EF4444', metier: 'La relecture', fait: 'Note le script comme le ferait l\'algorithme et le fait réécrire tant qu\'il ne tient pas.' },
  traduction: { prenom: 'Nora', couleur: '#10B981', metier: 'Les langues', fait: 'Réécrit la vidéo dans chaque langue comme une créatrice du pays, jamais mot à mot.' },
  realisation: { prenom: 'Lou', couleur: '#3B82F6', metier: 'Le montage', fait: 'Choisit les vidéos d\'illustration de chaque phrase, la musique, et lance le montage.' },
  diffusion: { prenom: 'Sacha', couleur: '#EC4899', metier: 'La publication', fait: 'Publie sur tes comptes, ou te prépare tout pour publier depuis ton téléphone.' }
};
const ORDRE_ROLES = ['idees', 'plume', 'critique', 'traduction', 'realisation', 'diffusion'];

const PLATEFORMES = { tiktok: 'TikTok', youtube: 'YouTube Shorts', instagram: 'Instagram Reels' };
const MUSIQUES = { calme: 'Douce', energie: 'Énergique', mystere: 'Mystérieuse', aucune: 'Sans musique' };
const QUALITES = {
  eco: { nom: 'Économique', explication: 'Le plus petit modèle partout : environ 1 centime par vidéo et par langue.', par_video: 0.012, par_langue: 0.004 },
  equilibre: { nom: 'Équilibrée', explication: 'Le modèle moyen pour écrire, le petit pour relire : environ 8 centimes par vidéo, plus 2 par langue.', par_video: 0.08, par_langue: 0.02 },
  premium: { nom: 'Premium', explication: 'Le meilleur modèle pour écrire : environ 15 centimes par vidéo, plus 3 par langue.', par_video: 0.15, par_langue: 0.03 }
};
const TIKTOK_VISIBILITE = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
const YOUTUBE_VISIBILITE = ['public', 'unlisted', 'private'];

const DEFAUT = {
  chaine: { nom: '', sujets: '', public: '', ton: 'complice, simple et drôle', exemples: '', interdits: '' },
  langue_source: 'fr',
  langues: ['fr'],
  format: 'court',            // court : 35 à 50 s ; long : plus d'une minute (TikTok ne paie que celles-là)
  style: 'clips',             // clips : des vidéos d'illustration ; texte : le texte animé sur un fond à ses couleurs
  couleur: '#FF5A8A',         // la couleur de ses vidéos (l'accroche, le mot qui s'allume)
  musique: 'calme',
  voix: {},                   // { en: 'af_bella' }
  vitesse: {},                // { en: 1.05 }
  qualite: 'equilibre',
  budget_jour: 0.5,           // en dollars, sur sa clé Claude
  tendances: true,            // Maya regarde l'actualité de la niche sur le web (1 centime la recherche)
  pilote: { actif: false, videos_jour: 1, heure: 9, relire: true, publier: false },
  publication: {},            // { fr: { profil: 'studio', plateformes: ['tiktok', 'youtube'] } }
  visibilite: { tiktok: 'PUBLIC_TO_EVERYONE', youtube: 'public' },
  etiquette_ia: true,         // TikTok demande d'étiqueter le contenu fait avec l'IA (voix de synthèse réaliste)
  // l'apparence, comme la tour : jour, nuit, ou auto (le jour suit son heure) ; ville : son studio en 3D à l'accueil
  theme: { accent: '#8B5CF6', mode: 'auto', ville: true },
  fuseau: 'Europe/Paris',
  visite_faite: false         // la visite guidée du premier jour, faite ou passée
};

// Les étapes d'une vidéo, dans l'ordre
const STATUTS = {
  ecriture: 'Écriture du script',
  relecture: 'Script à valider',
  langues: 'Adaptation dans tes autres langues',
  realisation: 'Choix des images',
  fabrication: 'Montage',
  prete: 'Prête à publier',
  publication: 'Publication',
  publiee: 'Publiée',
  echec: 'Bloquée',
  archivee: 'Archivée'
};
// les étapes que l'équipe fait seule (la page ou le passage régulier les font avancer)
const AUTOMATIQUES = ['ecriture', 'langues', 'realisation', 'fabrication', 'publication'];
const GARDE_JOURS = 14;       // les fichiers d'une vidéo restent 14 jours dans le stockage (le stockage gratuit de Supabase : 1 Go)

const iso = () => new Date().toISOString();
const hexa = (c, d) => (/^#[0-9a-f]{6}$/i.test(String(c || '').trim()) ? String(c).trim().toUpperCase() : d);
const bool = (x, d) => (x === true || x === false ? x : d);
const entre = (x, a, b, d) => { const n = Number(x); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const sansBalises = (x) => String(x == null ? '' : x).replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
const texte = (x, n) => nettoie(court(sansBalises(x), n));
const texteLong = (x, n) => { const s = nettoie(sansBalises(x).replace(/\r/g, '').trim()); return s.length > n ? s.slice(0, n) : s; };

function fuseauValide(f) {
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(String(f || ''))) return false;
  try { new Intl.DateTimeFormat('fr', { timeZone: f }); return true; } catch (e) { return false; }
}
function voixValide(langue, id) { const l = LANGUES[langue]; return !!(l && l.voix.some((v) => v[0] === id)); }

// Les réglages d'une créatrice, complets (les défauts sous les siens)
function reglagesDe(c) {
  const r = (c && c.reglages) || {};
  return Object.assign({}, DEFAUT, r, {
    chaine: Object.assign({}, DEFAUT.chaine, r.chaine || {}),
    pilote: Object.assign({}, DEFAUT.pilote, r.pilote || {}),
    theme: Object.assign({}, DEFAUT.theme, r.theme || {}, { mode: ({ sombre: 'nuit', clair: 'jour' })[(r.theme || {}).mode] || (r.theme || {}).mode || DEFAUT.theme.mode }),
    visibilite: Object.assign({}, DEFAUT.visibilite, r.visibilite || {}),
    voix: Object.assign({}, r.voix || {}), vitesse: Object.assign({}, r.vitesse || {}), publication: Object.assign({}, r.publication || {})
  });
}

// Ce que la page envoie, passé au tamis : seulement des champs connus, des valeurs bornées
function nettoyerReglages(e, avant) {
  const r = reglagesDe({ reglages: avant || {} });
  e = e || {};
  if (e.chaine && typeof e.chaine === 'object') {
    const ch = e.chaine;
    r.chaine = {
      nom: ch.nom != null ? texte(ch.nom, 60) : r.chaine.nom,
      sujets: ch.sujets != null ? texteLong(ch.sujets, 700) : r.chaine.sujets,
      public: ch.public != null ? texteLong(ch.public, 300) : r.chaine.public,
      ton: ch.ton != null ? texteLong(ch.ton, 300) : r.chaine.ton,
      exemples: ch.exemples != null ? texteLong(ch.exemples, 900) : r.chaine.exemples,
      interdits: ch.interdits != null ? texteLong(ch.interdits, 500) : r.chaine.interdits
    };
  }
  if (e.langue_source != null && LANGUES[e.langue_source]) r.langue_source = e.langue_source;
  if (Array.isArray(e.langues)) r.langues = e.langues.filter((l, i, t) => LANGUES[l] && t.indexOf(l) === i).slice(0, 6);
  if (r.langues.indexOf(r.langue_source) < 0) r.langues.unshift(r.langue_source);
  r.langues = r.langues.slice(0, 6);
  if (['court', 'long'].indexOf(e.format) >= 0) r.format = e.format;
  if (['clips', 'texte'].indexOf(e.style) >= 0) r.style = e.style;
  if (e.couleur != null) r.couleur = hexa(e.couleur, r.couleur);
  if (MUSIQUES[e.musique]) r.musique = e.musique;
  if (e.voix && typeof e.voix === 'object') Object.keys(e.voix).forEach((l) => { if (voixValide(l, e.voix[l])) r.voix[l] = e.voix[l]; });
  if (e.vitesse && typeof e.vitesse === 'object') Object.keys(e.vitesse).forEach((l) => { if (LANGUES[l]) r.vitesse[l] = Math.round(entre(e.vitesse[l], 0.8, 1.25, LANGUES[l].vitesse) * 100) / 100; });
  if (QUALITES[e.qualite]) r.qualite = e.qualite;
  if (e.budget_jour != null) r.budget_jour = Math.round(entre(e.budget_jour, 0.05, 20, r.budget_jour) * 100) / 100;
  if (e.tendances != null) r.tendances = bool(e.tendances, r.tendances);
  if (e.pilote && typeof e.pilote === 'object') {
    const p = e.pilote;
    r.pilote = {
      actif: bool(p.actif, r.pilote.actif),
      videos_jour: Math.round(entre(p.videos_jour, 1, 5, r.pilote.videos_jour)),
      heure: Math.round(entre(p.heure, 0, 23, r.pilote.heure)),
      relire: bool(p.relire, r.pilote.relire),
      publier: bool(p.publier, r.pilote.publier)
    };
  }
  if (e.publication && typeof e.publication === 'object') {
    const pub = {};
    Object.keys(e.publication).forEach((l) => {
      if (!LANGUES[l]) return;
      const x = e.publication[l] || {};
      const profil = /^[A-Za-z0-9_.-]{1,60}$/.test(String(x.profil || '')) ? String(x.profil) : '';
      const pl = Array.isArray(x.plateformes) ? x.plateformes.filter((p, i, t) => PLATEFORMES[p] && t.indexOf(p) === i) : [];
      pub[l] = { profil, plateformes: profil ? pl : [] };
    });
    r.publication = Object.assign({}, r.publication, pub);
  }
  if (e.visibilite && typeof e.visibilite === 'object') {
    if (TIKTOK_VISIBILITE.indexOf(e.visibilite.tiktok) >= 0) r.visibilite.tiktok = e.visibilite.tiktok;
    if (YOUTUBE_VISIBILITE.indexOf(e.visibilite.youtube) >= 0) r.visibilite.youtube = e.visibilite.youtube;
  }
  if (e.etiquette_ia != null) r.etiquette_ia = bool(e.etiquette_ia, r.etiquette_ia);
  if (e.theme && typeof e.theme === 'object') {
    // les anciens noms (sombre, clair) deviennent ceux de la tour (nuit, jour)
    const mode = { sombre: 'nuit', clair: 'jour' }[e.theme.mode] || e.theme.mode;
    r.theme = {
      accent: hexa(e.theme.accent, r.theme.accent),
      mode: ['auto', 'jour', 'nuit'].indexOf(mode) >= 0 ? mode : ({ sombre: 'nuit', clair: 'jour' }[r.theme.mode] || r.theme.mode || 'auto'),
      ville: bool(e.theme.ville, r.theme.ville !== false)
    };
  }
  if (e.visite_faite != null) r.visite_faite = bool(e.visite_faite, r.visite_faite);
  if (e.fuseau != null && fuseauValide(e.fuseau)) r.fuseau = e.fuseau;
  return r;
}

// L'équipe d'une créatrice : les rôles, avec ses prénoms, ses couleurs et ses consignes
function equipeDe(c) {
  const e = (c && c.equipe) || {};
  const out = {};
  ORDRE_ROLES.forEach((k) => { out[k] = Object.assign({ role: k, consignes: '' }, ROLES[k], e[k] || {}); });
  return out;
}
function nettoyerEquipe(e, avant) {
  const out = Object.assign({}, avant || {});
  Object.keys(e || {}).forEach((k) => {
    if (!ROLES[k] || !e[k] || typeof e[k] !== 'object') return;
    const x = e[k], cur = out[k] || {};
    out[k] = {
      prenom: x.prenom != null ? (texte(x.prenom, 24) || ROLES[k].prenom) : (cur.prenom || ROLES[k].prenom),
      couleur: x.couleur != null ? hexa(x.couleur, cur.couleur || ROLES[k].couleur) : (cur.couleur || ROLES[k].couleur),
      consignes: x.consignes != null ? texteLong(x.consignes, 600) : (cur.consignes || '')
    };
  });
  return out;
}

// La voix d'une langue pour l'usine (le choix de la créatrice, sinon celle par défaut) : Kokoro ou Piper
function voixDe(reglages, langue) {
  const l = LANGUES[langue] || LANGUES.en;
  const v = voixValide(langue, (reglages.voix || {})[langue]) ? reglages.voix[langue] : l.defaut;
  const vitesse = entre((reglages.vitesse || {})[langue], 0.8, 1.25, l.vitesse);
  if (/^piper:/.test(v)) return { moteur: 'piper', piper: v.slice(6), voix: v, vitesse, cjk: !!l.cjk, rtl: !!l.rtl };
  const kokoro = langue === 'en' && /^b/.test(v) ? 'en-gb' : l.kokoro;
  return { moteur: 'kokoro', kokoro, voix: v, vitesse, cjk: !!l.cjk, rtl: !!l.rtl };
}

// Le jour et le mois chez elle (son budget repart à minuit, chez elle)
function jourDe(c, d) { const r = reglagesDe(c); try { return (d || new Date()).toLocaleDateString('sv-SE', { timeZone: r.fuseau }); } catch (e) { return (d || new Date()).toISOString().slice(0, 10); } }
function heureDe(c, d) { const r = reglagesDe(c); try { return Number((d || new Date()).toLocaleString('en-GB', { timeZone: r.fuseau, hour: '2-digit', hour12: false })) % 24; } catch (e) { return (d || new Date()).getUTCHours(); } }
function depense(c) {
  const k = (c && c.couts) || {};
  const j = jourDe(c);
  return { jour: Number((k.jours || {})[j]) || 0, mois: Number((k.mois || {})[j.slice(0, 7)]) || 0, total: Number(k.total) || 0 };
}

// Le coût estimé d'une vidéo (pour le pilote et l'affichage)
function coutEstime(reglages, nbLangues) {
  const q = QUALITES[reglages.qualite] || QUALITES.equilibre;
  const f = reglages.format === 'long' ? 1.4 : 1;
  return Math.round((q.par_video * f + q.par_langue * f * Math.max(0, (nbLangues || 1) - 1) + (reglages.tendances ? 0.02 : 0)) * 1000) / 1000;
}

// Une ligne de son journal (les 40 dernières sont gardées)
function ligneJournal(c, quoi, detail) { return [{ le: iso(), quoi: court(quoi, 80), detail: detail ? court(detail, 240) : undefined }].concat(((c && c.journal) || []).slice(0, 39)); }

// Ce que la page de la créatrice reçoit sur elle (jamais une clé)
function moi(c, extra) {
  const s = (c && c.secrets) || {};
  const r = reglagesDe(c);
  const d = depense(c);
  return Object.assign({
    id: c.id, identifiant: c.identifiant, prenom: c.prenom, statut: c.statut,
    reglages: r, equipe: equipeDe(c),
    connexions: {
      claude: s.claude ? { branchee: true, fin: s.claude.fin, le: s.claude.le, etat: s.claude.etat || 'ok', message: s.claude.message || null } : { branchee: false },
      uploadpost: s.uploadpost ? { branchee: true, fin: s.uploadpost.fin, le: s.uploadpost.le, etat: s.uploadpost.etat || 'ok', plan: s.uploadpost.plan || null, profils: s.uploadpost.profils || [], message: s.uploadpost.message || null } : { branchee: false }
    },
    depense: { jour: Math.round(d.jour * 10000) / 10000, mois: Math.round(d.mois * 10000) / 10000, total: Math.round(d.total * 10000) / 10000, budget: r.budget_jour, estime_video: coutEstime(r, r.langues.length) },
    journal: (c.journal || []).slice(0, 20),
    idees: (c.idees || []).slice(0, 10)
  }, extra || {});
}

// Ce que la page reçoit d'une vidéo (jamais le jeton d'une fabrication)
function videoPublique(v, liens) {
  const rendus = {};
  Object.keys(v.rendus || {}).forEach((l) => {
    const x = v.rendus[l] || {};
    rendus[l] = { etat: x.etat, essais: x.essais || 0, demande_le: x.demande_le || null, fini_le: x.fini_le || null, duree: x.duree || null, taille: x.taille || null, erreur: x.erreur || null, avertissements: x.avertissements || [], fichiers: x.fichiers || [] };
  });
  return {
    id: v.id, status: v.status, statut: STATUTS[v.status] || v.status, sujet: v.sujet, titre: v.titre, langue_source: v.langue_source, langues: v.langues || [],
    idee: v.idee || {}, script: v.script || {}, critique: v.critique || {}, traductions: v.traductions || {}, plan: v.plan || {}, rendus, publication: v.publication || {},
    etape: v.etape || {}, cout_usd: Number(v.cout_usd) || 0, auto: !!v.auto, created_at: v.created_at, updated_at: v.updated_at,
    garde_jusqu: v.created_at ? new Date(new Date(v.created_at).getTime() + GARDE_JOURS * 86400000).toISOString() : null,
    liens: liens || undefined
  };
}
// la ligne courte d'une liste
function videoResume(v) {
  const r = v.rendus || {};
  return { id: v.id, status: v.status, statut: STATUTS[v.status] || v.status, titre: v.titre || court(v.sujet, 80), accroche: v.accroche || (v.script || {}).accroche || null, vignette: v.vignette || null, langues: v.langues || [], cout_usd: Number(v.cout_usd) || 0, auto: !!v.auto, etape: { quoi: (v.etape || {}).quoi || null, erreur: (v.etape || {}).erreur || null }, pretes: Object.keys(r).filter((l) => r[l] && r[l].etat === 'fini'), note: (v.critique || {}).note || null, created_at: v.created_at, updated_at: v.updated_at };
}

module.exports = {
  LANGUES, NATURELLES, ROLES, ORDRE_ROLES, PLATEFORMES, MUSIQUES, QUALITES, TIKTOK_VISIBILITE, YOUTUBE_VISIBILITE, DEFAUT, STATUTS, AUTOMATIQUES, GARDE_JOURS,
  reglagesDe, nettoyerReglages, equipeDe, nettoyerEquipe, voixDe, voixValide, jourDe, heureDe, depense, coutEstime, ligneJournal, moi, videoPublique, videoResume, fuseauValide
};
