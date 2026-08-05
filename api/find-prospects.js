// api/find-prospects.js — Veille annonces BTP France Travail
// POST /api/find-prospects { dept?, commune?, distance?, romes? }

const BTP_ROME_ALL = ['F1201','F1101','F1106','F1302','H1502'];

async function getToken() {
  const clientId     = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error('FRANCE_TRAVAIL_CLIENT_ID / CLIENT_SECRET manquants dans Vercel');
  const body = new URLSearchParams({
    grant_type: 'client_credentials', client_id: clientId,
    client_secret: clientSecret, scope: 'api_offresdemploiv2 o2dsoffre',
  });
  const resp = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }
  );
  if (!resp.ok) { const t = await resp.text(); throw new Error(`Auth FT (${resp.status}): ${t.slice(0,150)}`); }
  const data = await resp.json();
  if (!data.access_token) throw new Error('Token vide reçu de France Travail');
  return data.access_token;
}

async function searchRome(token, rome, searchParams) {
  const params = new URLSearchParams({ codeROME: rome, range: '0-49', tri: '1', ...searchParams });
  const resp = await fetch(
    `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
  );
  if (resp.status !== 200 && resp.status !== 206) {
    const txt = await resp.text();
    throw new Error(`FT ${resp.status} (${rome}): ${txt.slice(0,120)}`);
  }
  const data = await resp.json();
  return data.resultats || data.results || [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST uniquement' });

  try {
    const { dept, commune, distance, romes } = req.body || {};
    const token   = await getToken();
    const roList  = (romes && romes.length) ? romes : BTP_ROME_ALL;
    const results = [];
    const seen    = new Set();
    const errors  = [];
    const debug   = [];

    // Params de localisation
    const locParams = commune
      ? { commune, distance: String(distance || 20) }
      : { departement: dept || '06' };

    for (const rome of roList) {
      try {
        const offres = await searchRome(token, rome, locParams);
        debug.push({ rome, count: offres.length });
        for (const o of offres) {
          if (seen.has(o.id)) continue;
          seen.add(o.id);
          const company = o.entreprise?.nom?.trim() || null;
          results.push({
            id:          o.id,
            title:       o.intitule || '',
            description: (o.description || '').slice(0, 1400),
            company,
            location:    o.lieuTravail?.libelle || '',
            rome,
            salary:      o.salaire?.libelle || null,
            date:        o.dateCreation || null,
            url:         o.origineOffre?.urlOrigine || null,
          });
        }
      } catch (e) { errors.push({ rome, error: e.message }); }
    }

    return res.status(200).json({ offers: results, total: results.length, debug, errors: errors.length ? errors : undefined });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
