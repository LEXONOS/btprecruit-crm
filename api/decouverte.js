// api/decouverte.js — MOTEUR DECOUVERTE (Places API NEW)
// La page Decouverte l'appelle par petits paquets pour que ca ne bloque
// jamais (pas besoin de Vercel Pro). Deux actions :
//   { mode:"scan", cell:{s,n,w,e}, types:[...] }
//        -> restos d'une case + drapeau "saturee" (trop dense => la page
//           redecoupe automatiquement, aucun spot loupe)
//   { mode:"details", ids:[...] }  (max 25)
//        -> site + telephone de chaque resto (pour garder ceux SANS site)
//
// Utilise la Places API (New) : places.googleapis.com/v1.
// A activer une fois dans Google Cloud : "Places API (New)".
// Variable Vercel requise : GOOGLE_MAPS_API_KEY.
// La cle doit etre utilisable cote serveur : PAS de restriction
// "referHTTP referrers" (ca c'est pour le navigateur) ; laisse-la sans
// restriction d'application, ou restreins par API uniquement.
// Cette fonction ne touche pas Supabase : c'est la page (connectee)
// qui enregistre les cibles.

const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/';
const KEY = process.env.GOOGLE_MAPS_API_KEY;

function centreRayon(cell) {
  const lat = (cell.s + cell.n) / 2, lng = (cell.w + cell.e) / 2;
  const mLat = (cell.n - cell.s) * 111320;
  const mLng = (cell.e - cell.w) * 111320 * Math.cos(lat * Math.PI / 180);
  const rayon = Math.min(50000, Math.ceil(0.5 * Math.sqrt(mLat * mLat + mLng * mLng)) + 30);
  return { lat, lng, rayon };
}

// Recherche a proximite (New) : max 20 resultats, pas de pagination.
// => si on recoit 20, la case est "pleine" et la page la redecoupe.
async function nearby(lat, lng, rayon, types) {
  const body = {
    includedTypes: types,
    maxResultCount: 20,
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(rayon, 50000) } },
    languageCode: 'fr'
  };
  const r = await fetch(NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types'
    },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || ('Places API HTTP ' + r.status));
  const places = (d.places || []).map(function (p) {
    return {
      place_id: p.id,
      name: p.displayName ? p.displayName.text : '',
      vicinity: p.formattedAddress || '',
      lat: p.location ? p.location.latitude : null,
      lng: p.location ? p.location.longitude : null,
      rating: p.rating || null,
      reviews: p.userRatingCount || 0,
      types: p.types || []
    };
  });
  return { places: places, saturated: places.length >= 20 };
}

async function details(id) {
  try {
    const r = await fetch(DETAILS_URL + encodeURIComponent(id), {
      headers: {
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'id,websiteUri,internationalPhoneNumber,businessStatus,googleMapsUri'
      }
    });
    const d = await r.json();
    if (!r.ok) return {};
    return { website: d.websiteUri || '', phone: d.internationalPhoneNumber || '', business_status: d.businessStatus || '', url: d.googleMapsUri || '' };
  } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!KEY) return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY manquante dans les variables Vercel du projet.' });

  try {
    const b = req.body || {};

    if (b.mode === 'scan') {
      const cell = b.cell;
      if (!cell) return res.status(400).json({ error: 'cellule manquante' });
      const types = (b.types && b.types.length) ? b.types : ['restaurant', 'meal_takeaway'];
      const { lat, lng, rayon } = centreRayon(cell);
      const out = await nearby(lat, lng, rayon, types);
      return res.status(200).json(out);
    }

    if (b.mode === 'details') {
      const ids = (b.ids || []).slice(0, 25);
      const out = {};
      let i = 0; const K = 5;
      await Promise.all(Array(Math.min(K, ids.length)).fill(0).map(async () => {
        while (i < ids.length) { const id = ids[i++]; out[id] = await details(id); }
      }));
      return res.status(200).json({ details: out });
    }

    return res.status(400).json({ error: 'mode inconnu' });
  } catch (err) {
    console.error('api/decouverte:', err);
    return res.status(500).json({ error: err.message });
  }
};
