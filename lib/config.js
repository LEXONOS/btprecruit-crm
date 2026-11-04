// Réglages de La Tour. Rien de secret ici : le dépôt est public.
'use strict';

const TZ = 'America/Guadeloupe';

// Base : projet Supabase « Novalemo » (au repos), tables hq_*.
// La clé secrète se pose dans Vercel sous le nom HQ_SUPABASE_KEY.
const SUPABASE_URL = process.env.HQ_SUPABASE_URL || 'https://fbmzlfrwxrzflfkazvmn.supabase.co';
const SUPABASE_KEY = process.env.HQ_SUPABASE_KEY || '';

// Modèles (USD par million de tokens, grille officielle Anthropic, nov. 2026)
const MODELS = {
  fast: { id: process.env.HQ_MODEL_FAST || 'claude-haiku-5-5', fallback: 'claude-haiku-4-5', in: 0.10, out: 0.50, cacheWrite: 0.125, cacheRead: 0.01 },
  smart: { id: process.env.HQ_MODEL_SMART || 'claude-sonnet-5-5', fallback: 'claude-sonnet-4-5', in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.10 },
  genius: { id: process.env.HQ_MODEL_GENIUS || 'claude-opus-5-5', fallback: 'claude-sonnet-5-5', in: 4, out: 20, cacheWrite: 5, cacheRead: 0.20 }
};
const WEB_SEARCH_USD = 0.01;          // 10 $ les 1 000 recherches
const PLACES_USD = 0.035;             // Google Places Text Search (au-delà du gratuit mensuel)

// Budget par défaut (modifiable dans l'interface, stocké dans hq_config.budget)
const BUDGET_DEFAUT = {
  jour_usd: 1.5,                      // plafond IA du jour, tout compris (Novalemo passe en premier quand il se resserre)
  recherches_jour: 30,                // recherches web Anthropic
  places_jour: 25,                    // recherches Google Places (Chasseur Maps + domaines)
  envoi_auto: true,                   // pilote automatique : les emails et les réponses partent sans validation (contrôle qualité automatique)
  emails_jour: 50,                    // plafond d'envoi quotidien : le palier de la boîte décide en dessous (8 au départ, 40 au bout d'un mois, selon sa santé)
  apercus_jour: 20,                   // aperçus de sites fabriqués par jour (Démo-maker), au plus ; le stock suit ce que la boîte envoie
  domaine_max_usd: 25                 // prix maximum d'un nom de domaine acheté pour un client
};

// Novalemo Sites : la Martinique, et seulement elle (la Guadeloupe est le terrain de Studio Novalem).
const NOVALEMO = {
  iles: ['MQ'], depts: ['972'], zone: 'Martinique',
  // grille de la maison : aucun autre prix ne sort, ni d'un agent ni d'un email
  // deux façons de payer, au choix du client : en une fois, sans abonnement (490 €), ou 45 € par mois pendant 12 mois,
  // puis plus rien à payer pour le site, qui reste à lui. Dans les deux cas, hébergement et nom de domaine compris la
  // première année, puis 25 € par an. 12 x 45 = 540 € : 50 € de plus pour étaler, l'écart normal d'un paiement en fois,
  // qui laisse le paiement unique meilleur sans rendre le mois dissuasif.
  grille: {
    essentiel: { nom: 'Essentiel', prix: 490, mois: 45, quoi: 'site d\'une page, complet, sur votre nom de domaine' },
    vitrine: { nom: 'Vitrine', prix: 990, mois: 89, quoi: 'site de plusieurs pages (accueil, services, à propos, contact), le plus choisi' },
    signature: { nom: 'Signature', prix: 1390, mois: 119, quoi: 'site complet avec une page par service, pensé pour Google' },
    menu: { nom: 'Menu QR', prix: 250, quoi: 'carte en ligne avec QR code pour la restauration' }
  },
  // au mois : 12 mensualités, puis l'abonnement s'arrête de lui-même (le site reste au client, hébergement 25 € par an)
  abonnement: { engagement_mois: 12, retouches_mois: 1, relance_jours: 7, fin_auto: true },
  apercu_jours: 30,                   // un aperçu non commandé disparaît au bout de 30 jours
  revisions_avant: 3,                 // retouches incluses avant paiement
  revisions_apres: 2,                 // retouches incluses dans les 30 jours après la mise en ligne
  hebergement_an_eur: 25,             // après la première année (hébergement et domaine inclus la première année)
  projet_sites: process.env.HQ_SITES_PROJET || 'novalemo-martinique',
  signature_site: { texte: 'Site réalisé par Studio Novalem', url: 'https://studionovalem.fr' }
};

const CYCLE_SECONDES = 250;           // temps de travail max d'un passage (fonction limitée à 300 s)
const AGENTS_EN_PARALLELE = 3;

const SEED_VERSION = 9;

// Le projet Vercel de la tour (pas un secret) : la porte n'accepte qu'un jeton qui voit CE projet, dans CETTE équipe,
// et la tour n'écrit ses variables que là. Un autre projet du même nom, ailleurs, ne compte pas.
const TOUR_VERCEL = { projet: process.env.HQ_TOUR_PROJET || 'prj_IZ61QfV69ZXNiUkTtPPLXN6Dasdq', equipe: process.env.HQ_TOUR_EQUIPE || 'team_AtJC6Hy6Sxqq0VJC1Hy2OU5O' };

module.exports = { TZ, TOUR_VERCEL, SUPABASE_URL, SUPABASE_KEY, MODELS, WEB_SEARCH_USD, PLACES_USD, BUDGET_DEFAUT, NOVALEMO, CYCLE_SECONDES, AGENTS_EN_PARALLELE, SEED_VERSION };
