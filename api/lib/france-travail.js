// api/lib/france-travail.js
const BTP_TO_ROME = {
  go:'F1201', so:'F1101', be:'F1106', vrd:'F1302', hse:'H1502', mgmt:'F1201',
};

async function getFranceTravailToken() {
  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('FRANCE_TRAVAIL_CLIENT_ID et FRANCE_TRAVAIL_CLIENT_SECRET manquants dans Vercel → Settings → Environment Variables');

  const params = new URLSearchParams({
    grant_type: 'client_credentials', client_id: clientId,
    client_secret: clientSecret, scope: 'api_offresdemploiv2 o2dsoffre'
  });

  const resp = await fetch('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!resp.ok) throw new Error(`Auth France Travail échouée (${resp.status})`);
  const data = await resp.json();
  return data.access_token;
}

async function postToFranceTravail(post) {
  const token = await getFranceTravailToken();
  const offre = {
    intitule: post.title, description: post.body,
    typeContrat: 'CDI', natureContrat: 'E1', experienceExige: 'E',
    romeCode: BTP_TO_ROME[post.cat] || 'F1201',
    lieuTravail: { libelle: post.location || 'France' },
    salaire: post.salary ? { libelle: post.salary } : undefined,
    entreprise: { description: 'Cabinet de recrutement BTP — BTPRecruit' }
  };
  Object.keys(offre).forEach(k => offre[k] === undefined && delete offre[k]);

  const resp = await fetch('https://api.francetravail.io/partenaire/offresdemploi/v2/offres', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(offre)
  });
  if (!resp.ok) throw new Error(`Publication France Travail échouée (${resp.status})`);
  const result = await resp.json();
  return { reference: result.id || 'OK', message: `Publié sur France Travail${result.id ? ` — Réf: ${result.id}` : ''}` };
}

module.exports = { postToFranceTravail };

