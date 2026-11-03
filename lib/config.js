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
  emails_jour: 25,                    // plafond d'envoi quotidien (délivrabilité)
  apercus_jour: 12,                   // aperçus de sites fabriqués par jour (Démo-maker)
  domaine_max_usd: 25                 // prix maximum d'un nom de domaine acheté pour un client
};

// Novalemo Sites : la Martinique, et seulement elle (la Guadeloupe est le terrain de Studio Novalem).
const NOVALEMO = {
  iles: ['MQ'], depts: ['972'], zone: 'Martinique',
  // grille de la maison : aucun autre prix ne sort, ni d'un agent ni d'un email
  // deux façons de payer, au choix du client : en une fois, ou au mois (12 mois d'engagement, puis sans engagement ;
  // le site reste à lui : s'il arrête après l'engagement, il le garde avec l'hébergement seul à 25 € par an).
  // Au mois, 12 mensualités valent le prix en une fois (Essentiel) ou un peu plus (Vitrine, Signature) : payer d'un
  // coup reste le meilleur prix, le mois ouvre la porte à ceux qui n'ont pas la somme ; ce qui court après la
  // première année fait la différence.
  grille: {
    essentiel: { nom: 'Essentiel', prix: 590, mois: 49, quoi: 'site d\'une page, complet, sur votre nom de domaine' },
    vitrine: { nom: 'Vitrine', prix: 990, mois: 89, quoi: 'site de plusieurs pages (accueil, services, à propos, contact), le plus choisi' },
    signature: { nom: 'Signature', prix: 1390, mois: 119, quoi: 'site complet avec une page par service, pensé pour Google' },
    menu: { nom: 'Menu QR', prix: 250, quoi: 'carte en ligne avec QR code pour la restauration' }
  },
  abonnement: { engagement_mois: 12, retouches_mois: 1, relance_jours: 7 },
  apercu_jours: 30,                   // un aperçu non commandé disparaît au bout de 30 jours
  revisions_avant: 3,                 // retouches incluses avant paiement
  revisions_apres: 2,                 // retouches incluses dans les 30 jours après la mise en ligne
  hebergement_an_eur: 25,             // après la première année (hébergement et domaine inclus la première année)
  projet_sites: process.env.HQ_SITES_PROJET || 'novalemo-martinique',
  signature_site: { texte: 'Site réalisé par Studio Novalem', url: 'https://studionovalem.fr' }
};

const CYCLE_SECONDES = 250;           // temps de travail max d'un passage (fonction limitée à 300 s)
const AGENTS_EN_PARALLELE = 3;

const SEED_VERSION = 7;

module.exports = { TZ, SUPABASE_URL, SUPABASE_KEY, MODELS, WEB_SEARCH_USD, PLACES_USD, BUDGET_DEFAUT, NOVALEMO, CYCLE_SECONDES, AGENTS_EN_PARALLELE, SEED_VERSION };
