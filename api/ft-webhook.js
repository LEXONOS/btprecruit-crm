// api/ft-webhook.js
// Webhook France Travail — reçoit les nouvelles candidatures automatiquement
// France Travail appelle cette URL à chaque nouvelle candidature sur vos offres
// URL à déclarer : https://novalem-crm.vercel.app/api/ft-webhook

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // France Travail envoie en POST
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase non configuré');
    return res.status(200).json({ ok: true }); // Toujours 200 pour FT
  }

  try {
    const payload = req.body;
    console.log('FT webhook reçu:', JSON.stringify(payload).slice(0, 200));

    // Format candidature France Travail (variable selon la version)
    const candidature = payload.candidature || payload.application || payload;
    const candidat = candidature.candidat || candidature.candidate || {};

    // Créer le candidat dans le format du CRM
    const newCand = {
      id: `ft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: [candidat.prenom, candidat.nom].filter(Boolean).join(' ') ||
            candidat.firstName + ' ' + candidat.lastName ||
            'Candidat FT',
      phone:  candidat.telephone || candidat.phone || '',
      email:  candidat.email || '',
      salary: '',
      avail:  candidat.disponibilite || candidat.availability || '',
      mobility: '',
      role:   candidature.posteVise || candidature.jobTitle || '',
      cat:    'go', // sera affiné par l'IA
      source: 'France Travail',
      status: 'entrant',
      post_id: candidature.idOffre || candidature.offerId || null,
      ft_id:  candidat.id || candidat.candidatId || null,
      docs:   [],
      pepite: false,
      notes_pre: candidature.lettreMotivation || candidature.coverLetter || '',
      cv_url: candidat.urlCV || candidat.cvUrl || null,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    // Charger la DB actuelle depuis Supabase
    const sb = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }, realtime: { disabled: true }
    });
    const { data: rows, error: loadErr } = await sb
      .from('crm_data').select('data').eq('id', 1).maybeSingle();

    if (loadErr) throw loadErr;

    let DB = rows?.data ? (typeof rows.data === 'string' ? JSON.parse(rows.data) : rows.data) : { candidates: [], companies: [], needs: [], agenda: [], posts: [] };

    // Éviter les doublons (même email FT)
    const exists = DB.candidates.some(c =>
      (newCand.ft_id && c.ft_id === newCand.ft_id) ||
      (newCand.email && c.email === newCand.email)
    );

    if (!exists) {
      DB.candidates.unshift(newCand);
      // Auto-créer une précal dans l'agenda
      DB.agenda = DB.agenda || [];
      DB.agenda.push({
        id: `ag_${Date.now()}`,
        type: 'call',
        title: `Précal FT — ${newCand.name}`,
        date: new Date().toISOString(),
        time: '',
        cand_id: newCand.id,
        comp_id: null,
        notes: 'Candidature reçue via France Travail',
        done: false,
        created: new Date().toISOString(),
      });

      // Sauvegarder dans Supabase
      const { error: saveErr } = await sb
        .from('crm_data')
        .upsert({ id: 1, data: JSON.stringify(DB), updated_at: new Date().toISOString() }, { onConflict: 'id' });

      if (saveErr) throw saveErr;
      console.log(`Nouveau candidat FT ajouté: ${newCand.name}`);
    } else {
      console.log(`Candidat déjà existant ignoré: ${newCand.email}`);
    }

    // Toujours répondre 200 rapidement à France Travail
    return res.status(200).json({ ok: true, processed: !exists });

  } catch (err) {
    console.error('FT webhook error:', err.message);
    return res.status(200).json({ ok: true, error: err.message }); // 200 quand même
  }
};
