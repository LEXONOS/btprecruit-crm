// api/find-prospects.js — Veille annonces BTP France Travail Nice (06)
// POST /api/find-prospects {} → toutes offres BTP département 06

const BTP_ROME = ['F1201','F1101','F1106','F1302','H1502'];

async function getToken() {
  const clientId     = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('FRANCE_TRAVAIL_CLIENT_ID / CLIENT_SECRET manquants dans Vercel → Settings → Environment Variables');
  }
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         'api_offresdemploiv2 o2dsoffre',
  });
  const resp = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Auth FT (${resp.status}): ${txt.slice(0,200)}`);
  }
  const data = await resp.json();
  if (!data.access_token) throw new Error('Token vide — vérifiez vos credentials France Travail');
  return data.access_token;
}

async function searchRome(token, rome) {
  const params = new URLSearchParams({
    codeROME:    rome,
    departement: '06',
    range:       '0-49',   // max 50 résultats par appel
    tri:         '1',      // tri par date de création
  });

  const url = `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept':        'application/json',
    }
  });

  // 206 = résultats partiels (pagination), c'est normal
  // 200 = résultats complets
  // Tout autre code = erreur
  if (resp.status !== 200 && resp.status !== 206) {
    const txt = await resp.text();
    throw new Error(`FT ${resp.status} (ROME ${rome}): ${txt.slice(0,150)}`);
  }

  const data = await resp.json();
  // L'API FT peut renvoyer resultats, results, ou offres selon la version
  return data.resultats || data.results || data.offres || [];
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
    const debug   = [];

    for (const rome of BTP_ROME) {
      try {
        const offres = await searchRome(token, rome);
        debug.push({ rome, count: offres.length });

        for (const o of offres) {
          if (seen.has(o.id)) continue;
          seen.add(o.id);

          const companyName = o.entreprise?.nom?.trim() || null;

          results.push({
            id:          o.id,
            title:       o.intitule || '',
            description: (o.description || '').slice(0, 1200),
            company:     companyName,          // null si anonyme
            hasCompany:  !!companyName,        // true = nom connu, false = à analyser par IA
            location:    o.lieuTravail?.libelle || 'Nice (06)',
            rome,
            salary:      o.salaire?.libelle    || null,
            date:        o.dateCreation        || null,
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
      debug,
      errors: errors.length ? errors : undefined,
    });

  } catch (err) {
    console.error('[find-prospects]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
