// api/lib/france-travail.js
// Intégration complète France Travail :
// - Offres d'emploi v2 : publier, gérer
// - JCMO : vérification légale avant publication
// - La Bonne Boite v2 : prospects à fort potentiel de recrutement

const BTP_TO_ROME = {
  go:'F1201', so:'F1101', be:'F1106', vrd:'F1302', hse:'H1502', mgmt:'F1201',
};

// ── Auth OAuth2 — scope dynamique ────────────────────────
async function getToken(scope) {
  const clientId     = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('FRANCE_TRAVAIL_CLIENT_ID / SECRET manquants dans Vercel → Environment Variables');
  }
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope
  });
  const resp = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Auth France Travail (${resp.status}): ${txt}`);
  }
  const data = await resp.json();
  return data.access_token;
}

// ════════════════════════════════════════════════════════
// 1. OFFRES D'EMPLOI v2
// ════════════════════════════════════════════════════════

// Publier une annonce
async function postToFranceTravail(post) {
  const token = await getToken('api_offresdemploiv2 o2dsoffre');
  const offre = {
    intitule:      post.title,
    description:   post.body,
    typeContrat:   'CDI',
    natureContrat: 'E1',
    experienceExige: 'E',
    romeCode:      BTP_TO_ROME[post.cat] || 'F1201',
    lieuTravail:   { libelle: post.location || 'France' },
    salaire:       post.salary ? { libelle: post.salary, commentaire: 'Selon profil' } : undefined,
    entreprise:    { description: 'Cabinet de recrutement spécialisé BTP — BTPRecruit' },
  };
  Object.keys(offre).forEach(k => offre[k] === undefined && delete offre[k]);

  const resp = await fetch('https://api.francetravail.io/partenaire/offresdemploi/v2/offres', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(offre)
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Publication FT (${resp.status}): ${txt}`);
  }
  const result = await resp.json();
  return {
    reference: result.id || 'OK',
    url: result.origineOffre?.urlOrigine || null,
    message: `Publié sur France Travail${result.id ? ` — Réf: ${result.id}` : ''}`
  };
}

// Rechercher des offres BTP (pour veille concurrentielle ou récupérer candidats)
async function searchOffres({ motsCles, romeCode, commune, rayon = 30, nbResultats = 20 }) {
  const token = await getToken('api_offresdemploiv2');
  const params = new URLSearchParams({ range: `0-${nbResultats - 1}` });
  if (motsCles)  params.set('motsCles', motsCles);
  if (romeCode)  params.set('codeROME', romeCode);
  if (commune)   params.set('commune', commune);
  if (rayon)     params.set('distance', rayon);

  const resp = await fetch(`https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  if (!resp.ok) throw new Error(`Recherche FT (${resp.status})`);
  return resp.json();
}

// ════════════════════════════════════════════════════════
// 2. JE CONTRÔLE MON OFFRE (JCMO) — vérification légale
// ════════════════════════════════════════════════════════
async function verifyOffer(post) {
  const token = await getToken('api_jcmov1');
  const body = {
    title:       post.title,
    description: post.body,
    contractType: 'CDI',
    location:    post.location || 'France',
  };

  const resp = await fetch('https://api.francetravail.io/partenaire/jcmo/v1/verify', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // JCMO est en bêta — si l'endpoint exact diffère, on renvoie un résultat de fallback
  if (!resp.ok) {
    // Fallback : analyse basique locale
    return localLegalCheck(post);
  }
  const result = await resp.json();
  return {
    ok: result.conformite ?? result.valid ?? true,
    issues: result.anomalies || result.issues || [],
    score: result.score || null,
    source: 'jcmo_api'
  };
}

// Vérification légale locale (fallback si JCMO bêta indisponible)
function localLegalCheck(post) {
  const issues = [];
  const body = (post.body || '').toLowerCase();
  const title = (post.title || '').toLowerCase();

  // Mentions discriminatoires interdites
  const forbidden = ['jeune', 'dynamique', 'moins de', 'plus de', 'ans minimum', 'ans maximum',
    'beau', 'belle', 'présentable', 'français natif', 'sans accent'];
  forbidden.forEach(w => {
    if (body.includes(w) || title.includes(w)) {
      issues.push(`⚠️ Mention potentiellement discriminatoire : "${w}"`);
    }
  });

  // Mentions obligatoires
  if (!body.includes('cdi') && !body.includes('cdd') && !body.includes('contrat')) {
    issues.push('⚠️ Type de contrat non précisé');
  }
  if (!post.location) {
    issues.push('⚠️ Localisation manquante');
  }
  if (!post.salary) {
    issues.push('ℹ️ Salaire non renseigné (recommandé pour plus de candidatures)');
  }
  if ((post.body || '').length < 200) {
    issues.push('ℹ️ Description courte — une annonce détaillée attire plus de candidats');
  }

  return {
    ok: issues.filter(i => i.startsWith('⚠️')).length === 0,
    issues,
    source: 'local_check'
  };
}

// ════════════════════════════════════════════════════════
// 3. LA BONNE BOITE v2 — prospects à fort potentiel
// ════════════════════════════════════════════════════════
async function findBonnesBoites({ rome, commune, distance = 30, nbResultats = 20 }) {
  const token = await getToken('api_labonneboitev2');
  const params = new URLSearchParams({
    rome_codes:   rome || 'F1201',
    latitude:     commune?.lat || '',
    longitude:    commune?.lon || '',
    distance,
    page_size:    nbResultats,
  });
  // Supprimer les params vides
  [...params.entries()].forEach(([k, v]) => { if (!v) params.delete(k); });

  // Alternative : recherche par département
  if (!commune?.lat && commune?.dept) {
    params.set('departement', commune.dept);
  }

  const resp = await fetch(`https://api.francetravail.io/partenaire/labonneboite/v2/company/search?${params}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`La Bonne Boite (${resp.status}): ${txt}`);
  }
  const data = await resp.json();

  // Normaliser le résultat
  const companies = (data.companies || data.results || []).map(c => ({
    name:          c.name || c.label,
    siret:         c.siret,
    address:       c.address || c.city,
    naf:           c.naf,
    size:          c.headcount_text || c.headcount,
    score:         c.stars || c.hiring_rate,
    url:           c.url || null,
    phone:         c.phone || null,
    email:         c.email || null,
  }));

  return { companies, total: data.total || companies.length };
}

module.exports = {
  postToFranceTravail,
  searchOffres,
  verifyOffer,
  localLegalCheck,
  findBonnesBoites,
};


