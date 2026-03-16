// api/lib/france-travail.js
// Publication automatique sur France Travail (ex Pôle Emploi)
// via l'API Offres d'emploi — docs : https://francetravail.io/produits-et-services/api

// ─── Auth OAuth2 ─────────────────────────────────────────────
async function getFranceTravailToken() {
  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Variables FRANCE_TRAVAIL_CLIENT_ID et FRANCE_TRAVAIL_CLIENT_SECRET manquantes. ' +
      'Configurez-les dans Vercel → Settings → Environment Variables.'
    );
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'api_offresdemploiv2 o2dsoffre'
  });

  const resp = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`France Travail auth échouée (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return data.access_token;
}

// ─── Mapping catégorie BTP → code ROME France Travail ─────────
const BTP_TO_ROME = {
  go:   'F1201', // Conduite de travaux du BTP
  so:   'F1101', // Architecture du BTP et du paysage
  be:   'F1106', // Ingénierie et études du BTP
  vrd:  'F1302', // Géologie et prospection minière
  hse:  'H1502', // Management et inspection en environnement urbain
  mgmt: 'F1201', // Conduite de travaux du BTP
};

// ─── Création de l'offre ──────────────────────────────────────
export async function postToFranceTravail(post) {
  const token = await getFranceTravailToken();
  const romeCode = BTP_TO_ROME[post.cat] || 'F1201';

  // Construction du corps de l'offre au format France Travail
  const offre = {
    intitule: post.title,
    description: post.body,
    typeContrat: 'CDI',
    natureContrat: 'E1', // CDI
    experienceExige: 'E', // Exigée
    romeCode,
    lieuTravail: {
      libelle: post.location || 'France',
    },
    salaire: post.salary ? {
      libelle: post.salary,
      commentaire: 'Selon profil et expérience'
    } : undefined,
    entreprise: {
      description: 'Cabinet de recrutement spécialisé BTP — BTPRecruit'
    },
    contact: {
      coordonnees1: 'recrutement@btprecruit.fr'
    }
  };

  // Nettoyer les champs undefined
  Object.keys(offre).forEach(k => offre[k] === undefined && delete offre[k]);

  const resp = await fetch(
    'https://api.francetravail.io/partenaire/offresdemploi/v2/offres',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(offre)
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`France Travail publication échouée (${resp.status}): ${text}`);
  }

  const result = await resp.json();

  return {
    reference: result.id || result.reference || 'OK',
    url: result.origineOffre?.urlOrigine || null,
    message: `Offre publiée sur France Travail${result.id ? ` — Réf: ${result.id}` : ''}`
  };
}
