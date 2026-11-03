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
  jour_usd: 1.5,                      // plafond IA du jour, tout compris
  recherches_jour: 30,                // recherches web Anthropic
  places_jour: 25,                    // recherches Google Places (Chasseur Maps + domaines)
  envoi_auto: false,                  // envoi réel des emails : seulement quand Louis l'active et que la boîte d'envoi existe
  emails_jour: 25                     // plafond d'envoi quotidien (délivrabilité)
};

const CYCLE_SECONDES = 250;           // temps de travail max d'un passage (fonction limitée à 300 s)
const AGENTS_EN_PARALLELE = 3;

const SEED_VERSION = 1;

module.exports = { TZ, SUPABASE_URL, SUPABASE_KEY, MODELS, WEB_SEARCH_USD, PLACES_USD, BUDGET_DEFAUT, CYCLE_SECONDES, AGENTS_EN_PARALLELE, SEED_VERSION };
