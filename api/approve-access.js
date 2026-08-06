const { createClient } = require('@supabase/supabase-js');

function clean(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, action } = req.body || {};
  if (!id || !action) return res.status(400).json({ error: 'Paramètres manquants' });
  if (!['valider', 'refuser'].includes(action)) return res.status(400).json({ error: 'Action invalide' });

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Configuration serveur manquante' });

  const admin = createClient(process.env.SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { disabled: true },
  });

  if (action === 'refuser') {
    const { error } = await admin
      .from('demandes_acces')
      .update({ statut: 'refusé' })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // action === 'valider'
  const { data: demande, error: e1 } = await admin
    .from('demandes_acces')
    .select('prenom, nom, password_hash, statut')
    .eq('id', id)
    .single();

  if (e1 || !demande) return res.status(404).json({ error: 'Demande introuvable' });
  if (demande.statut !== 'en_attente') return res.status(409).json({ error: 'Demande déjà traitée' });

  const email = `${clean(demande.prenom)}.${clean(demande.nom)}@novalem.internal`;

  const { data: authData, error: e2 } = await admin.auth.admin.createUser({
    email,
    password: demande.password_hash,
    email_confirm: true,
    user_metadata: {
      prenom: demande.prenom,
      nom:    demande.nom,
    },
  });

  if (e2) return res.status(500).json({ error: e2.message });

  // Met à jour le profil créé par le trigger handle_new_user
  if (authData?.user?.id) {
    await admin.from('users')
      .update({
        prenom:          demande.prenom,
        nom:             demande.nom,
        avatar_initials: (demande.prenom[0] + demande.nom[0]).toUpperCase(),
        role:            'scout',
        actif:           true,
      })
      .eq('id', authData.user.id);
  }

  await admin.from('demandes_acces')
    .update({ statut: 'validé' })
    .eq('id', id);

  return res.json({ ok: true, email });
};
