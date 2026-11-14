// Réglages de La Tour. Rien de secret ici : le dépôt est public.
'use strict';

const TZ = 'America/Guadeloupe';

// Base : projet Supabase « Novalemo » (au repos), tables hq_*.
// La clé secrète se pose dans Vercel sous le nom HQ_SUPABASE_KEY.
const SUPABASE_URL = process.env.HQ_SUPABASE_URL || 'https://fbmzlfrwxrzflfkazvmn.supabase.co';
const SUPABASE_KEY = process.env.HQ_SUPABASE_KEY || '';

// Modèles (USD par million de tokens, grille officielle Anthropic, nov. 2026)
const MODELS = {
  // Haiku 5.5 : 0,10 $ / 0,50 $ jusqu'à 100 000 jetons lus par appel, cinq fois plus au-delà (long)
  fast: { id: process.env.HQ_MODEL_FAST || 'claude-haiku-5-5', fallback: 'claude-haiku-4-5', in: 0.10, out: 0.50, cacheWrite: 0.125, cacheRead: 0.01, long: { seuil: 100000, in: 0.50, out: 2.50, cacheWrite: 0.625, cacheRead: 0.05 } },
  smart: { id: process.env.HQ_MODEL_SMART || 'claude-sonnet-5-5', fallback: 'claude-sonnet-4-5', in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.20 },
  genius: { id: process.env.HQ_MODEL_GENIUS || 'claude-opus-5-5', fallback: 'claude-sonnet-5-5', in: 4, out: 20, cacheWrite: 5, cacheRead: 0.20 }
};
const WEB_SEARCH_USD = 0.01;          // 10 $ les 1 000 recherches
const PLACES_USD = 0.035;             // Google Places Text Search (au-delà du gratuit mensuel)

// Budget par défaut (modifiable dans l'interface, stocké dans hq_config.budget)
const BUDGET_DEFAUT = {
  jour_usd: 1,                        // plafond IA du jour, tout compris, compté appel par appel sur la vraie dépense (lib/garde.js) :
                                      // la chaîne Novalemo coûte environ 0,13 $ par prospect (aperçu, jugement, email, relance), soit
                                      // 7 à 8 prospects par jour, le rythme de la boîte à ses débuts
  mois_usd: 25,                       // plafond IA du mois : la tour s'arrête toute seule jusqu'au 1er quand il est atteint
  recherches_jour: 30,                // recherches web Anthropic
  places_jour: 80,                    // recherches Google Places (Chasseur Maps + domaines), 0,035 $ l'une : 2,80 $ par jour au plus
  envoi_auto: true,                   // pilote automatique : les emails et les réponses partent sans validation (contrôle qualité automatique)
  emails_jour: 50,                    // plafond d'envoi quotidien : le palier de la boîte décide en dessous (8 au départ, 40 au bout d'un mois, selon sa santé)
  apercus_jour: 20,                   // aperçus de sites fabriqués par jour (Démo-maker), au plus ; le stock suit ce que la boîte envoie
  domaine_max_usd: 25,                // prix maximum d'un nom de domaine acheté pour un client
  note_envoi: 6,                      // note de Miranda (sur 10, version en ligne) à partir de laquelle un aperçu part chez le prospect
  // 14 nov. 2026, Louis : « on a largement assez de sites faits et envoyés, il faut les relancer maintenant », sans coûter
  // des centaines d'euros. La fabrication (chasse, aperçus, photos, mise en page, jugement de Miranda) est en pause : la
  // tour envoie et relance les aperçus déjà faits, répond, encaisse et met en ligne. Rallumable dans Coûts et budget.
  fabrication: false
};
// les agents de la fabrication : ils ne passent pas tant que budget.fabrication est coupé (rien n'est supprimé)
const FABRICATION = ['chasse_maps', 'chasse_domaines', 'chasse_registre', 'contacts', 'demo', 'da', 'photos', 'critique'];

// Novalemo Sites : la Martinique, et seulement elle (la Guadeloupe est le terrain de Studio Novalem).
const NOVALEMO = {
  iles: ['MQ'], depts: ['972'], zone: 'Martinique',
  // grille de la maison : aucun autre prix ne sort, ni d'un agent ni d'un email
  // 12 nov. 2026, Louis : « si on met à 99 € le site c'est déjà très bien, pas besoin de mettre plus ». Une seule offre,
  // en une fois, sans abonnement : le site d'une page, nom de domaine et hébergement compris la première année, puis
  // 25 € par an. Fait avec l'aide de l'IA, et on le dit : c'est ce qui permet ce prix. Plus gros (plusieurs pages,
  // réservation, boutique) : Studio Novalem, l'agence de Louis, sur devis (NOVALEMO.studio).
  // (avant : 490 € ou 45 € par mois, Vitrine 990 €, Signature 1 390 € : un email ou un lien à ces prix ne part plus)
  grille: {
    essentiel: { nom: 'Essentiel', prix: 99, quoi: 'site d\'une page, complet, sur votre nom de domaine' }
  },
  studio: { nom: 'Studio Novalem', url: 'https://studionovalem.fr', quoi: 'plusieurs pages, réservation en ligne, boutique, outil sur mesure' },
  // au mois : 12 mensualités, puis l'abonnement s'arrête de lui-même (le site reste au client, hébergement 25 € par an)
  abonnement: { engagement_mois: 12, retouches_mois: 1, relance_jours: 7, fin_auto: true },
  apercu_jours: 30,                   // un aperçu non commandé disparaît au bout de 30 jours
  // les relances, en jours après le premier email (14 nov. 2026) : le lien remis, une question simple, le dernier message
  relances: [3, 8, 15],
  revisions_avant: 3,                 // retouches incluses avant paiement
  revisions_apres: 2,                 // retouches incluses dans les 30 jours après la mise en ligne
  hebergement_an_eur: 25,             // après la première année (hébergement et domaine inclus la première année)
  projet_sites: process.env.HQ_SITES_PROJET || 'novalemo-martinique',
  signature_site: { texte: 'Site réalisé par Studio Novalem', url: 'https://studionovalem.fr' }
};

const CYCLE_SECONDES = 250;           // temps de travail max d'un passage (fonction limitée à 300 s)
// aucun appel à Claude ne démarre après la fin du passage plus cette marge : il serait coupé par Vercel, payé et perdu
const ECHEANCE_MARGE_S = 30;

// Les agents qui travaillent (9 nov. 2026, Louis : « que Novalemo ») : la chaîne qui rapporte, de la chasse au paiement.
// Tous les autres (Studio 3D, E-commerce, Labo, direction, RH, pôle écriture) sont en pause : ils ne passent plus, même
// si leur fiche dit le contraire. Pour en rallumer un, l'ajouter ici (ou HQ_AGENTS_ACTIFS="id1,id2" dans Vercel, ou
// HQ_AGENTS_ACTIFS="tous" pour revenir à l'ancien fonctionnement).
const ACTIFS = [
  // trouver
  'chasse_maps', 'chasse_domaines', 'chasse_registre', 'contacts', 'juridique',
  // fabriquer l'aperçu
  'demo', 'da', 'photos', 'critique', 'livraison', 'portfolio',
  // écrire, relancer, répondre
  'redacteur', 'relanceur', 'reponses',
  // le relevé des coûts
  'controleur'
];
function agentsActifs() {
  const v = String(process.env.HQ_AGENTS_ACTIFS || '').trim();
  if (v === 'tous') return null;
  if (v) return v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  return ACTIFS;
}
const AGENTS_EN_PARALLELE = 3;

const SEED_VERSION = 21;

// Le projet Vercel de la tour (pas un secret) : la porte n'accepte qu'un jeton qui voit CE projet, dans CETTE équipe,
// et la tour n'écrit ses variables que là. Un autre projet du même nom, ailleurs, ne compte pas.
const TOUR_VERCEL = { projet: process.env.HQ_TOUR_PROJET || 'prj_IZ61QfV69ZXNiUkTtPPLXN6Dasdq', equipe: process.env.HQ_TOUR_EQUIPE || 'team_AtJC6Hy6Sxqq0VJC1Hy2OU5O' };

module.exports = { TZ, TOUR_VERCEL, SUPABASE_URL, SUPABASE_KEY, MODELS, WEB_SEARCH_USD, PLACES_USD, BUDGET_DEFAUT, FABRICATION, NOVALEMO, CYCLE_SECONDES, ECHEANCE_MARGE_S, ACTIFS, agentsActifs, AGENTS_EN_PARALLELE, SEED_VERSION };
