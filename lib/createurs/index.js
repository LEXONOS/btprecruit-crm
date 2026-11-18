// Le studio des créatrices (/studio) : les amies de Louis font leurs vidéos TikTok, YouTube et Instagram avec leur
// propre équipe d'agents, de l'idée à la publication. Chacune a son compte, ses réglages, son équipe (prénoms,
// couleurs, consignes), sa clé Claude (elle paie ses vidéos, dans le budget du jour qu'elle choisit), si elle le veut
// sa clé fal (les images et les vidéos créées par IA, dans le même budget) et la publication automatique par
// upload-post. La tour fournit le reste : le montage (l'usine sur GitHub Actions), les vidéos d'illustration (Pexels,
// la clé de Louis, gratuite), le stockage des vidéos (14 jours).
// Ici : les langues et les voix, les rôles de l'équipe, les looks, les réglages par défaut et leur nettoyage, les vues
// envoyées à la page (jamais une clé, jamais un jeton de l'usine).
'use strict';
const { court, nettoie } = require('../util');
const FAL = require('./fal');

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
// Le look des vidéos : des vidéos d'illustration (Pexels, offertes), des images créées par IA (sur sa clé fal), ou le
// texte animé sur un fond à ses couleurs
const STYLES = { clips: 'Vidéos d\'illustration', ia: 'Images IA', texte: 'Texte animé' };
// Les looks des images IA : ce que la créatrice voit (nom, court, teintes de l'aperçu) et ce que l'IA reçoit en plus de
// chaque scène (prompt, en anglais). Jamais un nom de studio, d'artiste ou de marque.
const STYLES_IA = {
  realiste: { nom: 'Photo réaliste', court: 'Comme filmé pour de vrai', prompt: 'photorealistic cinematic photograph, natural light, shallow depth of field, rich detail, 35mm lens', teintes: ['#3B2F2A', '#B07A4F', '#E8C9A0'] },
  anime: { nom: 'Anime', court: 'Le dessin animé japonais', prompt: 'anime illustration, clean line art, vibrant colors, detailed painted background, cel shading', teintes: ['#2B6CF0', '#FF8FB1', '#FFE36E'] },
  '3d': { nom: '3D', court: 'Comme un film d\'animation', prompt: 'stylized 3D animation render, soft global illumination, rounded friendly shapes, expressive characters, vibrant colors', teintes: ['#5B8CFF', '#FFB86B', '#FF6FA1'] },
  illustration: { nom: 'Illustration', court: 'Aplats de couleurs, formes simples', prompt: 'flat vector illustration, bold simple shapes, limited color palette, clean editorial style, subtle grain', teintes: ['#1F3A5F', '#F25C54', '#F7B267'] },
  aquarelle: { nom: 'Aquarelle', court: 'Doux, peint à la main', prompt: 'delicate watercolor painting, soft washes, visible paper texture, gentle pastel tones, hand-painted', teintes: ['#9BB7D4', '#F4C7C3', '#FBEFD5'] },
  pate: { nom: 'Pâte à modeler', court: 'Des petits personnages en pâte', prompt: 'claymation style, handmade plasticine figures and sets, stop-motion look, soft studio lighting, tactile texture', teintes: ['#E76F51', '#F4A261', '#2A9D8F'] },
  neon: { nom: 'Néon de nuit', court: 'La ville la nuit, des lumières vives', prompt: 'neon-lit night scene, glowing pink and cyan lights, reflections on wet surfaces, atmospheric haze, cinematic', teintes: ['#0D0A1F', '#FF2E88', '#21D4FD'] },
  vintage: { nom: 'Vintage', court: 'Une photo argentique des années 70', prompt: 'vintage 1970s film photograph, warm faded colors, soft grain, nostalgic mood, slight vignette', teintes: ['#6B4F3A', '#C98E5A', '#E9D5A1'] }
};
// Comment les images IA bougent : un zoom lent (les images seules), ou de vraies vidéos IA tirées des images
const MOUVEMENTS_IA = {
  zoom: { nom: 'Images animées', court: 'Chaque scène est une image qui zoome doucement' },
  accroche: { nom: 'Accroche en vidéo', court: 'La première scène en vraie vidéo IA, les autres en images animées' },
  tout: { nom: 'Tout en vidéo', court: 'Chaque scène en vraie vidéo IA' }
};
// La qualité des images IA : FLUX.2 Turbo (rapide, 1,6 centime), ou Nano Banana 2.1 en 2K (plus fin, comprend mieux une
// scène compliquée, 7 centimes). Avec ses personnages (leurs photos), les images passent toujours par Nano Banana, qui
// les garde à l'identique d'une scène à l'autre.
const IMAGES_IA = {
  turbo: { nom: 'Rapide', court: 'FLUX.2 Turbo : net et économique', prix: () => FAL.MODELES.image.prix },
  premium: { nom: 'Premium', court: 'Nano Banana 2.1 en 2K : plus fin, les scènes compliquées', prix: () => FAL.prixImageClip('2K') }
};
// Le modèle qui anime les scènes (les mêmes qualités que les clips) : du plus économique au plus spectaculaire
const MODELES_VIDEO = ['rapide', 'hd', 'pro', 'cinema'];
// le coût des images IA d'une vidéo, à peu près : une image par phrase, plus les secondes animées en vidéo (une phrase
// animée : 5 à 6 secondes facturées, la marge de fal comprise ; 4 au moins en Cinéma, 3 en Pro)
const PHRASES = { court: 10, long: 16 };
const SECONDES_ANIMEES = { zoom: 0, accroche: 5, tout: 5.9 };
function prixImageIa(images, avecPersos) {
  if (avecPersos) return FAL.prixImageClip(images === 'premium' ? '2K' : '1K');
  return (IMAGES_IA[images] || IMAGES_IA.turbo).prix();
}
function coutIa(format, mouvement, modele, images, avecPersos) {
  const n = PHRASES[format] || PHRASES.court;
  const m = Object.prototype.hasOwnProperty.call(MOUVEMENTS_IA, mouvement) ? mouvement : 'accroche';
  const q = MODELES_VIDEO.indexOf(modele) >= 0 ? modele : 'rapide';
  const scenes = m === 'tout' ? n : m === 'accroche' ? 1 : 0;
  const parScene = scenes ? FAL.prixAnimation(q, m === 'tout' ? SECONDES_ANIMEES.tout - 0.7 : SECONDES_ANIMEES.accroche - 0.7) : 0;
  return Math.round((n * prixImageIa(images, avecPersos) + scenes * parScene) * 100) / 100;
}
// Les voix naturelles : des voix d'ElevenLabs (Eleven v4), dites sur sa clé fal. Chaque voix parle toutes les langues
// avec l'accent de la langue ; la même voix pour toutes ses vidéos, c'est la voix de sa chaîne. Ce qu'en dit la page
// (genre, allure) : à écouter avant de choisir.
const VOIX_IA = {
  Jessica: { nom: 'Jessica', genre: 'femme', court: 'Jeune, pétillante, expressive' },
  Laura: { nom: 'Laura', genre: 'femme', court: 'Jeune, enjouée, un peu espiègle' },
  Sarah: { nom: 'Sarah', genre: 'femme', court: 'Jeune, douce et claire' },
  Matilda: { nom: 'Matilda', genre: 'femme', court: 'Chaleureuse, rassurante' },
  Alice: { nom: 'Alice', genre: 'femme', court: 'Nette et sûre d\'elle, ton de prof' },
  Lily: { nom: 'Lily', genre: 'femme', court: 'Posée, voix de conteuse' },
  Will: { nom: 'Will', genre: 'homme', court: 'Jeune, détendu, sympa' },
  Liam: { nom: 'Liam', genre: 'homme', court: 'Jeune, énergique' },
  Chris: { nom: 'Chris', genre: 'homme', court: 'Décontracté, naturel' },
  George: { nom: 'George', genre: 'homme', court: 'Chaleureux, conteur' },
  Brian: { nom: 'Brian', genre: 'homme', court: 'Voix grave et profonde' },
  Daniel: { nom: 'Daniel', genre: 'homme', court: 'Posé, ton de journaliste' },
  River: { nom: 'River', genre: 'neutre', court: 'Calme, ni féminine ni masculine' }
};
// le nombre de caractères dits d'une vidéo, à peu près (110 à 150 mots en court, 200 à 250 en long)
const CARACTERES = { court: 900, long: 1600 };
function coutVoix(format, nbLangues) {
  return Math.round((CARACTERES[format] || CARACTERES.court) * Math.max(1, nbLangues || 1) * FAL.MODELES.voix.mille / 1000 * 100) / 100;
}
// la phrase qu'elle entend quand elle écoute une voix, dans chaque langue
const PHRASES_ECOUTE = {
  fr: 'Salut ! C\'est moi qui raconterai tes prochaines vidéos. On commence ?',
  en: 'Hi! I\'m the voice of your next videos. Ready to start?',
  es: '¡Hola! Soy la voz de tus próximos vídeos. ¿Empezamos?',
  pt: 'Oi! Eu sou a voz dos seus próximos vídeos. Vamos começar?',
  it: 'Ciao! Sono la voce dei tuoi prossimi video. Cominciamo?',
  hi: 'नमस्ते! मैं आपके अगले वीडियो की आवाज़ हूँ। शुरू करें?',
  zh: '你好！我是你接下来视频的声音。我们开始吧？',
  ja: 'こんにちは！次の動画の声を担当します。始めましょうか？',
  de: 'Hallo! Ich bin die Stimme deiner nächsten Videos. Sollen wir anfangen?',
  nl: 'Hoi! Ik ben de stem van je volgende video\'s. Zullen we beginnen?',
  ar: 'مرحبًا! أنا صوت فيديوهاتك القادمة. هل نبدأ؟',
  ru: 'Привет! Я голос твоих следующих видео. Начнём?',
  uk: 'Привіт! Я голос твоїх наступних відео. Почнемо?',
  pl: 'Cześć! Jestem głosem twoich kolejnych filmów. Zaczynamy?',
  tr: 'Merhaba! Sonraki videolarının sesi benim. Başlayalım mı?',
  ro: 'Salut! Eu sunt vocea următoarelor tale videoclipuri. Începem?',
  el: 'Γεια σου! Είμαι η φωνή των επόμενων βίντεό σου. Ξεκινάμε;',
  cs: 'Ahoj! Jsem hlas tvých dalších videí. Začneme?',
  sk: 'Ahoj! Som hlas tvojich ďalších videí. Začneme?',
  hu: 'Szia! Én vagyok a következő videóid hangja. Kezdhetjük?',
  sv: 'Hej! Jag är rösten i dina nästa videor. Ska vi börja?',
  da: 'Hej! Jeg er stemmen i dine næste videoer. Skal vi gå i gang?',
  no: 'Hei! Jeg er stemmen i de neste videoene dine. Skal vi begynne?',
  fi: 'Hei! Olen seuraavien videoidesi ääni. Aloitetaanko?',
  ca: 'Hola! Sóc la veu dels teus pròxims vídeos. Comencem?',
  vi: 'Xin chào! Mình là giọng đọc cho các video tiếp theo của bạn. Bắt đầu nhé?',
  fa: 'سلام! من صدای ویدیوهای بعدی تو هستم. شروع کنیم؟',
  sw: 'Habari! Mimi ni sauti ya video zako zijazo. Tuanze?'
};
// La publication de chaque langue : vers quel profil upload-post (un profil relie UNE chaîne YouTube, UN compte TikTok,
// UN compte Instagram : deux langues sur deux chaînes YouTube, deux profils), sur quelles plateformes, et quand.
//   bouton      elle publie elle-même, d'un bouton (ou depuis son téléphone)
//   auto        dès que la langue est montée
//   programme   à l'heure de grande écoute du pays visé (ou à l'heure qu'elle choisit), dans le fuseau de ce pays
const MODES_PUB = { bouton: 'Je publie moi-même', auto: 'Dès qu\'elle est prête', programme: 'À l\'heure de grande écoute' };
// l'heure de grande écoute de chaque langue : en fin de journée, dans le fuseau du pays qu'on vise le plus souvent avec
// cette langue (TikTok n'existe pas en Chine continentale, ni YouTube : le chinois vise Taïwan, Hong Kong, Singapour)
const MARCHES = {
  fr: ['Europe/Paris', 18, 'France'], en: ['America/New_York', 18, 'États-Unis (New York)'], es: ['America/Mexico_City', 19, 'Mexique'], pt: ['America/Sao_Paulo', 19, 'Brésil'],
  it: ['Europe/Rome', 19, 'Italie'], hi: ['Asia/Kolkata', 19, 'Inde'], zh: ['Asia/Taipei', 20, 'Taïwan'], ja: ['Asia/Tokyo', 20, 'Japon'], de: ['Europe/Berlin', 18, 'Allemagne'],
  nl: ['Europe/Amsterdam', 18, 'Pays-Bas'], ar: ['Asia/Riyadh', 21, 'Arabie saoudite'], ru: ['Europe/Moscow', 19, 'Russie'], uk: ['Europe/Kyiv', 19, 'Ukraine'], pl: ['Europe/Warsaw', 18, 'Pologne'],
  tr: ['Europe/Istanbul', 20, 'Turquie'], ro: ['Europe/Bucharest', 19, 'Roumanie'], el: ['Europe/Athens', 19, 'Grèce'], cs: ['Europe/Prague', 18, 'Tchéquie'], sk: ['Europe/Bratislava', 18, 'Slovaquie'],
  hu: ['Europe/Budapest', 18, 'Hongrie'], sv: ['Europe/Stockholm', 18, 'Suède'], da: ['Europe/Copenhagen', 18, 'Danemark'], no: ['Europe/Oslo', 18, 'Norvège'], fi: ['Europe/Helsinki', 18, 'Finlande'],
  ca: ['Europe/Madrid', 19, 'Catalogne'], vi: ['Asia/Ho_Chi_Minh', 20, 'Viêt Nam'], fa: ['Asia/Tehran', 20, 'Iran'], sw: ['Africa/Nairobi', 19, 'Kenya']
};
const marcheDe = (l) => { const m = MARCHES[l] || MARCHES.en; return { fuseau: m[0], heure: m[1], pays: m[2] }; };
const TIKTOK_VISIBILITE = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
const YOUTUBE_VISIBILITE = ['public', 'unlisted', 'private'];

const DEFAUT = {
  chaine: { nom: '', sujets: '', public: '', ton: 'complice, simple et drôle', exemples: '', interdits: '' },
  langue_source: 'fr',
  langues: ['fr'],
  format: 'court',            // court : 35 à 50 s ; long : plus d'une minute (TikTok ne paie que celles-là)
  style: 'clips',             // clips : des vidéos d'illustration ; ia : des images créées par IA ; texte : le texte animé
  ia: { style: 'realiste', mouvement: 'accroche', modele: 'rapide', images: 'turbo' },   // le look, le mouvement, le modèle vidéo et la qualité des images IA
  couleur: '#FF5A8A',         // la couleur de ses vidéos (l'accroche, le mot qui s'allume)
  musique: 'calme',
  voix: {},                   // { en: 'af_bella' } : les voix gratuites (Kokoro, Piper), sans clé fal ou en secours
  voix_ia: { actif: true, voix: 'Jessica' },   // la voix naturelle de sa chaîne (ElevenLabs, sur sa clé fal si elle l'a branchée)
  vitesse: {},                // { en: 1.05 }
  qualite: 'equilibre',
  budget_jour: 0.5,           // en dollars, sur sa clé Claude
  tendances: true,            // Maya regarde l'actualité de la niche sur le web (1 centime la recherche)
  pilote: { actif: false, videos_jour: 1, heure: 9, relire: true, publier: false },
  publication: {},            // { fr: { profil: 'studio', plateformes: ['tiktok', 'youtube'], mode: 'programme', heure: 18, fuseau: 'Europe/Paris', depuis } }
  questions: 'oui',           // l'équipe pose ses questions avant d'écrire (oui : à chaque vidéo lancée à la main ; non : jamais)
  memoire: [],                // ce que l'équipe a retenu d'elle, au fil des conversations (lu à chaque écriture)
  personnages: [],            // ses personnages : { id, nom, genre, description, description_en, nom_en, photos: [chemins], le }
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
// les mêmes étapes, pour un clip (un prompt de réalisateur, lib/createurs/clip.js)
const STATUTS_CLIP = Object.assign({}, STATUTS, { ecriture: 'Découpage en plans', relecture: 'Images à valider', realisation: 'Images et tournage' });
const estClip = (v) => !!(v && ((v.plan && v.plan.genre === 'clip') || v.genre === 'clip'));
const statutDe = (v) => (estClip(v) ? STATUTS_CLIP : STATUTS)[v.status] || v.status;
// les étapes que l'équipe fait seule (la page ou le passage régulier les font avancer)
const AUTOMATIQUES = ['ecriture', 'langues', 'realisation', 'fabrication', 'publication'];
const GARDE_JOURS = 14;       // les fichiers d'une vidéo restent 14 jours dans le stockage (le stockage gratuit de Supabase : 1 Go)
// Le compte de Louis dans le studio (identifiant « louis » : seul Louis crée des comptes, depuis la tour). Il y fait ses
// propres vidéos, et sa messagerie va vers les créatrices au lieu de lui revenir : il leur écrit et leur envoie ses
// vidéos prêtes (lib/createurs/messages.js), comme depuis la tour.
const COMPTE_LOUIS = 'louis';
const estLouis = (c) => !!c && c.identifiant === COMPTE_LOUIS;

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
    ia: nettoyerIa(r.ia),
    voix_ia: nettoyerVoixIa(r.voix_ia),
    voix: Object.assign({}, r.voix || {}), vitesse: Object.assign({}, r.vitesse || {}), publication: Object.assign({}, r.publication || {}),
    memoire: Array.isArray(r.memoire) ? r.memoire.slice(0, MEMOIRE_MAX) : [], personnages: Array.isArray(r.personnages) ? r.personnages.slice(0, PERSOS_MAX) : [],
    questions: r.questions === 'non' ? 'non' : 'oui'
  });
}
const MEMOIRE_MAX = 30, PERSOS_MAX = 12;

// le look et le mouvement des images IA, passés au tamis (ce qui manque reprend la valeur d'avant, puis celle par défaut)
function nettoyerIa(e, avant) {
  const a = Object.assign({}, DEFAUT.ia, avant && typeof avant === 'object' ? avant : {});
  const x = e && typeof e === 'object' ? e : {};
  const choisir = (v, av, liste, d) => (Object.prototype.hasOwnProperty.call(liste, v) ? v : Object.prototype.hasOwnProperty.call(liste, av) ? av : d);
  const parmi = (v, av, liste, d) => (liste.indexOf(v) >= 0 ? v : liste.indexOf(av) >= 0 ? av : d);
  return {
    style: choisir(x.style, a.style, STYLES_IA, DEFAUT.ia.style), mouvement: choisir(x.mouvement, a.mouvement, MOUVEMENTS_IA, DEFAUT.ia.mouvement),
    modele: parmi(x.modele, a.modele, MODELES_VIDEO, DEFAUT.ia.modele), images: choisir(x.images, a.images, IMAGES_IA, DEFAUT.ia.images)
  };
}

// la voix naturelle : allumée ou non, et laquelle (une voix inconnue reprend la précédente, puis celle par défaut)
function nettoyerVoixIa(e, avant) {
  const a = Object.assign({}, DEFAUT.voix_ia, avant && typeof avant === 'object' ? avant : {});
  const x = e && typeof e === 'object' ? e : {};
  const voix = Object.prototype.hasOwnProperty.call(VOIX_IA, x.voix) ? x.voix : Object.prototype.hasOwnProperty.call(VOIX_IA, a.voix) ? a.voix : DEFAUT.voix_ia.voix;
  return { actif: x.actif != null ? bool(x.actif, a.actif !== false) : a.actif !== false, voix };
}
// la voix naturelle sert-elle ? Allumée, et sa clé fal branchée
function voixNaturelle(c) { const r = reglagesDe(c); return !!(r.voix_ia.actif && ((c && c.secrets) || {}).fal); }

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
  if (Object.prototype.hasOwnProperty.call(STYLES, e.style)) r.style = e.style;
  if (e.ia && typeof e.ia === 'object') r.ia = nettoyerIa(e.ia, r.ia);
  if (e.voix_ia && typeof e.voix_ia === 'object') r.voix_ia = nettoyerVoixIa(e.voix_ia, r.voix_ia);
  if (e.couleur != null) r.couleur = hexa(e.couleur, r.couleur);
  if (MUSIQUES[e.musique]) r.musique = e.musique;
  if (e.voix && typeof e.voix === 'object') Object.keys(e.voix).forEach((l) => { if (voixValide(l, e.voix[l])) r.voix[l] = e.voix[l]; });
  if (e.vitesse && typeof e.vitesse === 'object') Object.keys(e.vitesse).forEach((l) => { if (LANGUES[l]) r.vitesse[l] = Math.round(entre(e.vitesse[l], 0.8, 1.25, LANGUES[l].vitesse) * 100) / 100; });
  if (QUALITES[e.qualite]) r.qualite = e.qualite;
  // jusqu'à 200 $ par jour : le mode « sans compter » (des clips en qualité Cinéma, tout en vidéo) ; l'équipe s'arrête
  // toujours au plafond choisi
  if (e.budget_jour != null) r.budget_jour = Math.round(entre(e.budget_jour, 0.05, BUDGET_MAX, r.budget_jour) * 100) / 100;
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
      pub[l] = nettoyerRegle(e.publication[l], (r.publication || {})[l], l);
    });
    r.publication = Object.assign({}, r.publication, pub);
  }
  if (Array.isArray(e.memoire)) r.memoire = nettoyerMemoire(e.memoire);
  if (e.questions != null) r.questions = e.questions === 'non' || e.questions === false ? 'non' : 'oui';
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

// La règle de publication d'une langue, passée au tamis. « depuis » : le moment où la règle s'est mise à publier toute
// seule ; seules les vidéos montées après partent (une règle allumée ne publie jamais d'un coup ses vieilles vidéos).
const BUDGET_MAX = 200;
function nettoyerRegle(x, avant, l) {
  x = x && typeof x === 'object' ? x : {};
  const a = avant && typeof avant === 'object' ? avant : {};
  const m = marcheDe(l);
  const profil = /^[A-Za-z0-9_.-]{1,60}$/.test(String(x.profil != null ? x.profil : a.profil || '')) ? String(x.profil != null ? x.profil : a.profil) : '';
  const pl = (Array.isArray(x.plateformes) ? x.plateformes : (a.plateformes || [])).filter((p, i, t) => PLATEFORMES[p] && t.indexOf(p) === i);
  const mode = MODES_PUB[x.mode] ? x.mode : (MODES_PUB[a.mode] ? a.mode : 'bouton');
  const seule = profil && pl.length && mode !== 'bouton';
  const avantSeule = a.profil && (a.plateformes || []).length && MODES_PUB[a.mode] && a.mode !== 'bouton';
  // « le » : depuis quand ce profil sert cette langue (le pilote ne publie pas d'un coup les vidéos montées avant ; une
  // règle d'avant le 18 nov. n'en a pas et garde son ancien comportement)
  const le = !profil ? null : (a.profil === profil ? (a.le || null) : iso());
  return {
    profil, plateformes: profil ? pl : [], mode: profil ? mode : 'bouton',
    heure: Math.round(entre(x.heure != null ? x.heure : a.heure, 0, 23, m.heure)),
    fuseau: fuseauValide(x.fuseau) ? x.fuseau : (fuseauValide(a.fuseau) ? a.fuseau : m.fuseau),
    depuis: seule ? (avantSeule && a.depuis ? a.depuis : iso()) : null,
    le
  };
}
// la règle d'une langue telle qu'elle s'applique (les défauts du pays visé si elle n'en a pas réglé)
function regleDe(r, l) { const x = (r.publication || {})[l] || {}; return nettoyerRegle(x, x, l); }
// ce que l'équipe a retenu d'elle : des phrases courtes, sans doublon, les plus récentes d'abord
function nettoyerMemoire(liste) {
  const vus = new Set();
  return (Array.isArray(liste) ? liste : []).map((x) => texte(typeof x === 'string' ? x : (x && x.texte), 200)).filter((t) => {
    const k = t.toLowerCase();
    if (t.length < 3 || vus.has(k)) return false;
    vus.add(k); return true;
  }).slice(0, MEMOIRE_MAX);
}
// un personnage : son nom, ce qu'il est, sa description (la sienne, et celle que l'IA a écrite en anglais pour le
// redessiner à l'identique), ses photos (des chemins de son dossier, vérifiés par l'appelant)
const GENRES_PERSO = { personnage: 'Personnage', moi: 'Moi', mascotte: 'Mascotte', objet: 'Objet', lieu: 'Lieu' };
const cheminPersoValide = (createurId, c) => new RegExp('^crea/' + Number(createurId) + '/persos/[a-f0-9]{16}\\.jpg$').test(String(c || ''));
function nettoyerPersonnage(x, avant, createurId) {
  x = x && typeof x === 'object' ? x : {};
  const a = avant || {};
  const photos = (Array.isArray(x.photos) ? x.photos : a.photos || []).map(String).filter((c, i, t) => cheminPersoValide(createurId, c) && t.indexOf(c) === i).slice(0, 4);
  return {
    id: a.id || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    nom: texte(x.nom != null ? x.nom : a.nom, 40) || 'Mon personnage',
    genre: GENRES_PERSO[x.genre] ? x.genre : (GENRES_PERSO[a.genre] ? a.genre : 'personnage'),
    description: texteLong(x.description != null ? x.description : a.description || '', 600),
    nom_en: texte(x.nom_en != null ? x.nom_en : a.nom_en || '', 60).replace(/["`<>]/g, '\''),
    description_en: texteLong(x.description_en != null ? x.description_en : a.description_en || '', 800).replace(/["`<>]/g, '\''),
    photos, le: a.le || iso(), maj_le: iso()
  };
}
// ses personnages tels que la page les voit : jamais un chemin de fichier (les photos arrivent en liens signés à part)
const persoPublic = (p) => ({ id: p.id, nom: p.nom, genre: p.genre, description: p.description, nom_en: p.nom_en, description_en: p.description_en, photos: (p.photos || []).length, le: p.le });

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

// Le coût estimé d'une vidéo (pour le pilote et l'affichage) : l'écriture sur sa clé Claude, et les images IA sur sa
// clé fal si c'est son look
function coutEstime(reglages, nbLangues, avecVoix, avecPersos) {
  const q = QUALITES[reglages.qualite] || QUALITES.equilibre;
  const f = reglages.format === 'long' ? 1.4 : 1;
  const x = reglages.ia || {};
  const ia = reglages.style === 'ia' ? coutIa(reglages.format, x.mouvement, x.modele, x.images, avecPersos) : 0;
  const voix = avecVoix ? coutVoix(reglages.format, nbLangues) : 0;
  return Math.round((q.par_video * f + q.par_langue * f * Math.max(0, (nbLangues || 1) - 1) + (reglages.tendances ? 0.02 : 0) + ia + voix) * 1000) / 1000;
}

// Une ligne de son journal (les 40 dernières sont gardées)
function ligneJournal(c, quoi, detail) { return [{ le: iso(), quoi: court(quoi, 80), detail: detail ? court(detail, 240) : undefined }].concat(((c && c.journal) || []).slice(0, 39)); }

// Ce que la page de la créatrice reçoit sur elle (jamais une clé)
function moi(c, extra) {
  const s = (c && c.secrets) || {};
  const r = reglagesDe(c);
  const d = depense(c);
  return Object.assign({
    id: c.id, identifiant: c.identifiant, prenom: c.prenom, statut: c.statut, louis: estLouis(c),
    reglages: Object.assign({}, r, { personnages: r.personnages.map(persoPublic) }), equipe: equipeDe(c),
    connexions: {
      claude: s.claude ? { branchee: true, fin: s.claude.fin, le: s.claude.le, etat: s.claude.etat || 'ok', message: s.claude.message || null } : { branchee: false },
      fal: s.fal ? { branchee: true, fin: s.fal.fin, le: s.fal.le, etat: s.fal.etat || 'ok', message: s.fal.message || null } : { branchee: false },
      uploadpost: s.uploadpost ? { branchee: true, fin: s.uploadpost.fin, le: s.uploadpost.le, etat: s.uploadpost.etat || 'ok', plan: s.uploadpost.plan || null, profils: s.uploadpost.profils || [], message: s.uploadpost.message || null } : { branchee: false }
    },
    depense: { jour: Math.round(d.jour * 10000) / 10000, mois: Math.round(d.mois * 10000) / 10000, total: Math.round(d.total * 10000) / 10000, budget: r.budget_jour, estime_video: coutEstime(r, r.langues.length, voixNaturelle(c)), estime_ia: r.style === 'ia' ? coutIa(r.format, r.ia.mouvement, r.ia.modele, r.ia.images) : 0, estime_voix: voixNaturelle(c) ? coutVoix(r.format, r.langues.length) : 0 },
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
  // les images IA en cours : ce qui est prêt (l'adresse publique de l'image chez fal), jamais les adresses de suivi
  const plan = Object.assign({}, v.plan || {});
  if (plan.generation) {
    const g = plan.generation;
    const vue = (j) => (j ? { etat: j.etat, url: j.etat === 'fini' ? j.url : undefined, erreur: j.etat === 'echec' ? j.erreur || null : undefined } : null);
    plan.generation = { style: g.style, mouvement: g.mouvement, cout: Number(g.cout) || 0, images: (g.images || []).map(vue), videos: (g.videos || []).map(vue), fin_le: g.fin_le || null };
  }
  // les voix naturelles : où en est chaque langue, jamais les adresses des fichiers
  if (plan.voix_ia) {
    const g = plan.voix_ia;
    const langues = {};
    Object.keys(g.langues || {}).forEach((l) => { const ms = (g.langues[l] || {}).morceaux || []; langues[l] = { etat: g.langues[l].etat, faites: ms.filter((m) => m.etat === 'fini').length, total: ms.length }; });
    plan.voix_ia = { voix: g.voix, cout: Number(g.cout) || 0, langues };
  }
  // un clip : ses choix, son découpage, ce qui est prêt (les adresses publiques des images et des plans chez fal),
  // jamais les adresses de suivi ni le chemin de son fichier audio
  if (plan.clip) {
    const cl = plan.clip, g = cl.gen || {}, m = cl.musique || {};
    const vue = (j) => (j ? { etat: j.etat, url: j.etat === 'fini' ? j.url : undefined, erreur: j.etat === 'echec' ? j.erreur || null : undefined, consigne: j.consigne || undefined } : null);
    plan.clip = {
      prompt: cl.prompt, format: cl.format, qualite: cl.qualite, montage: cl.montage, bruitages: cl.bruitages !== false, valider: !!cl.valider, duree: cl.duree,
      musique: { source: m.source || 'aucune', nom: m.nom || null, debut: m.debut || 0, idee: m.idee || null, etat: g.musique ? g.musique.etat : null },
      budget: Number(cl.budget) || 0, estime: Number(cl.estime) || 0, storyboard: cl.storyboard || null,
      gen: { refs: (g.refs || []).map((j) => (j ? Object.assign({ id: j.el }, vue(j)) : null)), images: (g.images || []).map(vue), videos: (g.videos || []).map(vue), sons: (g.sons || []).map(vue), cout: Number(g.cout) || 0 }
    };
  }
  return {
    id: v.id, status: v.status, statut: statutDe(v), sujet: v.sujet, titre: v.titre, langue_source: v.langue_source, langues: v.langues || [],
    idee: v.idee || {}, script: v.script || {}, critique: v.critique || {}, traductions: v.traductions || {}, plan, rendus, publication: v.publication || {},
    etape: v.etape || {}, cout_usd: Number(v.cout_usd) || 0, auto: !!v.auto, created_at: v.created_at, updated_at: v.updated_at,
    garde_jusqu: v.created_at ? new Date(new Date(v.created_at).getTime() + GARDE_JOURS * 86400000).toISOString() : null,
    liens: liens || undefined
  };
}
// la ligne courte d'une liste
function videoResume(v) {
  const r = v.rendus || {};
  return { id: v.id, status: v.status, statut: statutDe(v), genre: estClip(v) ? 'clip' : 'video', titre: v.titre || court(v.sujet, 80), accroche: v.accroche || (v.script || {}).accroche || null, vignette: v.vignette || null, langues: v.langues || [], cout_usd: Number(v.cout_usd) || 0, auto: !!v.auto, etape: { quoi: (v.etape || {}).quoi || null, erreur: (v.etape || {}).erreur || null }, pretes: Object.keys(r).filter((l) => r[l] && r[l].etat === 'fini'), note: (v.critique || {}).note || null, created_at: v.created_at, updated_at: v.updated_at };
}

module.exports = {
  LANGUES, NATURELLES, ROLES, ORDRE_ROLES, PLATEFORMES, MUSIQUES, QUALITES, STYLES, STYLES_IA, MOUVEMENTS_IA, PHRASES, VOIX_IA, CARACTERES, PHRASES_ECOUTE, TIKTOK_VISIBILITE, YOUTUBE_VISIBILITE, DEFAUT, STATUTS, STATUTS_CLIP, AUTOMATIQUES, GARDE_JOURS, COMPTE_LOUIS, estLouis, statutDe,
  reglagesDe, nettoyerReglages, nettoyerIa, nettoyerVoixIa, voixNaturelle, coutVoix, equipeDe, nettoyerEquipe, voixDe, voixValide, jourDe, heureDe, depense, coutEstime, coutIa, ligneJournal, moi, videoPublique, videoResume, fuseauValide,
  IMAGES_IA, MODELES_VIDEO, prixImageIa, MODES_PUB, MARCHES, marcheDe, nettoyerRegle, regleDe, nettoyerMemoire, BUDGET_MAX, MEMOIRE_MAX, PERSOS_MAX, GENRES_PERSO, cheminPersoValide, nettoyerPersonnage, persoPublic
};
