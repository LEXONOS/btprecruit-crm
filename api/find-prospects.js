// api/find-prospects.js — Veille annonces BTP France Travail Nice (06)
// POST /api/find-prospects {} → offres CDI BTP département 06

const AGENCY_KEYWORDS = [
  'intérim','interim','recrutement','cabinet de recr','agence d\'emploi',
  'manpower','adecco','randstad','hays','michael page','gi group','crit ',
  'proman','temporis','triangle int','samsic','expectra','synergie','aprojob',
  'fed construction','groupe partnaire','kelly','vedior','start people',
  'réseau alliance','iziwork','lynx rh','aquila rh','humanis','apec'
];

const BTP_ROME = ['F1201','F1101','F1106','F1302','H1502'];

function isAgency(name) {
  if (!name || !name.trim()) return true;
  const n = name.toLowerCase();
  return AGENCY_KEYWORDS.some(k => n.includes(k));
}

async function getToken() {
  const clientId     = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Variables FRANCE_TRAVAIL_CLIENT_ID / CLIENT_SECRET manquantes dans Vercel');
  }
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'api_offresdemploiv2'
  });
  const resp = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Auth France Travail (${resp.status}) — vérifiez vos credentials : ${txt.slice(0, 150)}`);
  }
  const data = await resp.json();
  if (!data.access_token) throw new Error('Token vide reçu de France Travail');
  return data.access_token;
}

async function searchRome(token, rome) {
  // Paramètres validés de l'API offres v2 FT
  // 'tri' (pas 'sort') — '1' = tri par date
  // L'API renvoie 206 quand il y a plus de résultats (pagination) — on l'accepte
  const params = new URLSearchParams({
    codeROME:    rome,
    departement: '06',
    range:       '0-29',
    tri:         '1',
  });

  const resp = await fetch(
    `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
  );

  // 206 = résultats partiels, c'est normal et acceptable
  if (resp.status !== 200 && resp.status !== 206) {
    const txt = await resp.text();
    throw new Error(`FT API ${resp.status} (ROME ${rome}): ${txt.slice(0, 150)}`);
  }

  const data = await resp.json();
  return data.resultats || [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST uniquement' });

  try {
    const token = await getToken();
    const results = [];
    const seen    = new Set();
    const errors  = [];

    for (const rome of BTP_ROME) {
      try {
        const offres = await searchRome(token, rome);
        for (const o of offres) {
          if (seen.has(o.id)) continue;
          seen.add(o.id);

          const companyName = o.entreprise?.nom?.trim() || null;
          const agencyOffer = isAgency(companyName);

          results.push({
            id:          o.id,
            title:       o.intitule || '',
            description: (o.description || '').slice(0, 900),
            company:     agencyOffer ? null : companyName,
            needsAI:     agencyOffer,
            location:    o.lieuTravail?.libelle || 'Nice (06)',
            rome,
            salary:      o.salaire?.libelle || null,
            date:        o.dateCreation || null,
            url:         o.origineOffre?.urlOrigine || null,
          });
        }
      } catch (e) {
        errors.push({ rome, error: e.message });
        console.warn('[veille]', e.message);
      }
    }

    return res.status(200).json({
      offers: results,
      total:  results.length,
      errors: errors.length ? errors : undefined,
    });

  } catch (err) {
    console.error('[find-prospects]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
