// api/brief.js — L'IA met au propre le brief de production pour le monteur.
// Variable Vercel requise : ANTHROPIC_API_KEY (existe deja).
// Recoit { entreprise, secteur, notes, brouillon } et renvoie { brief } en texte.

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante dans les variables Vercel du projet.' });

  const b = req.body || {};
  const contexte =
    'Entreprise : ' + (b.entreprise || 'a preciser') + '\n' +
    'Secteur : ' + (b.secteur || 'a preciser') + '\n' +
    'Infos connues (notes) : ' + (b.notes || 'aucune') + '\n' +
    'Brouillon de Louis : ' + (b.brouillon || 'aucun');

  const systeme =
    "Tu mets au propre un brief de production de site internet, destine a un monteur qui va construire le site. " +
    "A partir de notes en vrac, tu produis une fiche claire, concise, HONNETE et directement exploitable. " +
    "N'invente JAMAIS d'information : si un element manque, ecris explicitement 'a preciser'. " +
    "Reste simple et concret, pas de jargon inutile. " +
    "Reponds UNIQUEMENT avec le brief en texte brut, structure exactement ainsi :\n\n" +
    "CLIENT : ...\n" +
    "OBJECTIF DU SITE : ...\n" +
    "PAGES : ...\n" +
    "CONTENU FOURNI : ...\n" +
    "TON / STYLE : ...\n" +
    "CONTRAINTES / DEADLINE : ...\n" +
    "A FAIRE (checklist courte) : ...\n\n" +
    "Pas d'introduction, pas de conclusion, aucune phrase autour.";

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1300,
        system: systeme,
        messages: [{ role: 'user', content: contexte }]
      })
    });
    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: (d.error && d.error.message) || ('Erreur IA HTTP ' + r.status) });
    const texte = (d.content && d.content[0] && d.content[0].text) ? d.content[0].text : '';
    return res.json({ brief: texte });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
