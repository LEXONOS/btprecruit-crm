// api/nego.js - Assistant nego Districom (etude de cas REDA)
// Utilise ANTHROPIC_API_KEY deja configuree sur Vercel

const CONTEXTE = `Tu es le copilote de negociation d'un etudiant qui joue un commercial de Districom Formation dans une simulation de negociation commerciale (examen oral Bachelor REDA).

ENTREPRISE : Districom Formation, organisme de formation pro, 12 ans, SARL certifiee Qualiopi, 18 salaries (9 formateurs internes), CA 2,4 M euros, national, presentiel + distanciel, positionnement sur-mesure premium. Enjeu : concurrence e-learning low-cost, defendre les marges.

CATALOGUE (prix HT / cout de revient / marge) :
- Intra 1 jour (12 pers max) : 2800 / 1750 / 37,5%
- Intra 2 jours (12 pers max) : 5200 / 3300 / 36,5%
- Parcours managerial 6 modules sur 3 mois : 14500 / 9200 / 36,5%
- Distanciel 1 jour classe virtuelle : 1900 / 1100 / 42%
- Diagnostic / audit des besoins : 1200 / 600 / 50%
- Certification par participant : 180 / 70 / 61%
- Coaching individuel 5 seances : 2400 / 1400 / 41,5%
- Supports pedagogiques (forfait) : 950 / 450 / 52,5%

PRIX REMISES :
- Intra 1 jour : -8% = 2576, -15% = 2380, plancher = 2190
- Intra 2 jours : -8% = 4784, -15% = 4420, plancher = 4125
- Parcours : -8% = 13340, -15% = 12325, plancher = 11500
- Distanciel : -8% = 1748, -15% = 1615, plancher = 1375

REGLES DE NEGO (a respecter absolument dans tes conseils) :
- Remise max seul : 8%
- Remise max 15% : uniquement avec accord du responsable ET engagement volume (3 sessions mini ou parcours complet)
- Plancher absolu : marge 20%, jamais en dessous
- Jamais de concession sans contrepartie (volume, signature rapide, acompte)
- Ordre des concessions : 1 delais de paiement 45-60j (coute 0), 2 diagnostic offert (1200), 3 supports offerts (950), 4 remise par petits pas jusqu'a 8%, 5 le 15% en dernier recours avec "je dois valider avec ma direction"
- Cadeaux plutot que remises : un cadeau coute 2x moins que la meme somme en remise
- Paiement standard : 30% commande, solde 30 jours
- Le diagnostic sert a PERSONNALISER la formation (consultant sur site avant la formation, cas reels du client), pas a la choisir

LES 4 FORMATIONS :
1. Gestion d'entrepot et logistique : 2 jours presentiel, 5200, resp. logistique / chefs d'equipe entrepot
2. Excellence relation client : 1 jour presentiel, 2800, conseillers clientele / commerciaux sedentaires
3. Gestion des conflits : 1 jour, 2800 presentiel ou 1900 distanciel, managers / RH
4. Management d'equipe : parcours 6 modules / 3 mois, 14500, managers de proximite, modules vendables separement

ARGUMENTS CLES :
- Prix par participant : 1 jour = 233/pers, 2 jours = 433/pers, parcours = 201/jour/pers
- Face au e-learning : contenu vs resultat, formation sur les cas reels du client, mesure des acquis
- Face a "trop cher" : demander "par rapport a quoi", ramener au cout par participant et au cout de la non-formation

STYLE DE TES REPONSES : francais direct, concret, actionnable. Pas de blabla. Tu donnes des phrases pretes a dire a l'oral. Tu chiffres tout (prix exacts, valeur des cadeaux). Tu rappelles la contrepartie a exiger pour chaque concession. Reponds en texte brut, sans markdown, sans asterisques.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante sur Vercel' });

  try {
    const { mode, decouverte, historique, message } = req.body || {};

    let userPrompt = '';

    if (mode === 'offre') {
      userPrompt = `Voici ce que j'ai appris pendant la phase de decouverte avec le client :\n\n${decouverte}\n\nDonne-moi dans cet ordre, avec ces titres en majuscules :\nREFORMULATION : la phrase de reformulation exacte a dire au client pour verrouiller la decouverte.\nOFFRE RECOMMANDEE : quelle(s) prestation(s) proposer, a quel prix de depart (toujours plein tarif), et pourquoi c'est adapte a son besoin.\nARGUMENTAIRE : 3 arguments cibles sur SES enjeux (pas un catalogue).\nPLAN DE CONCESSION : ce que je lache si ca negocie, dans l'ordre, avec la contrepartie a exiger a chaque fois, et mon prix limite sur ce deal.\nPHRASE DE CLOSING : la question alternative pour conclure.`;
    } else if (mode === 'live') {
      const hist = Array.isArray(historique) && historique.length
        ? 'Historique des echanges precedents :\n' + historique.map(h => `Client : ${h.client}\nConseil donne : ${h.conseil}`).join('\n---\n') + '\n\n'
        : '';
      userPrompt = `${hist}Le client vient de dire : "${message}"\n\nDonne-moi :\n1. Ce qui se joue (1 phrase : quelle technique il utilise ou quel signal il envoie)\n2. LA REPONSE a dire, mot pour mot, prete a l'oral\n3. Le piege a eviter (1 phrase)\nSois bref, je suis en plein entretien.`;
    } else {
      return res.status(400).json({ error: 'mode invalide (offre ou live)' });
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        system: CONTEXTE,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: 'Erreur API Anthropic', detail: data });
    }

    const texte = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return res.status(200).json({ texte });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
