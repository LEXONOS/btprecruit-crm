const { createClient } = require('@supabase/supabase-js');

function clean(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, action, userId, role, actif } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Paramètres manquants' });
  const ACTIONS = ['valider', 'refuser', 'lister_users', 'set_role', 'set_actif', 'supprimer_user'];
  if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'Action invalide' });

  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Configuration serveur manquante' });

  const admin = createClient(process.env.SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { disabled: true },
  });

  if (action === 'lister_users') {
    let { data, error } = await admin.from('users').select('id, prenom, nom, role, actif, email').order('prenom');
    if (error) {
      const r2 = await admin.from('users').select('id, prenom, nom, role, actif').order('prenom');
      if (r2.error) return res.status(500).json({ error: r2.error.message });
      data = r2.data;
    }
    return res.json({ users: data || [] });
  }

  if (action === 'set_role') {
    if (!userId || !['superviseur', 'scout', 'monteur'].includes(role)) return res.status(400).json({ error: 'userId ou rôle invalide' });
    const { error } = await admin.from('users').update({ role }).eq('id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (action === 'set_actif') {
    if (!userId) return res.status(400).json({ error: 'userId manquant' });
    const { error } = await admin.from('users').update({ actif: !!actif }).eq('id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (action === 'supprimer_user') {
    if (!userId) return res.status(400).json({ error: 'userId manquant' });
    await admin.from('web_clients').update({ monteur_id: null }).eq('monteur_id', userId);
    const delAuth = await admin.auth.admin.deleteUser(userId);
    if (delAuth.error) {
      // suppression du compte bloquee (references existantes) : on desactive au moins l'acces
      await admin.from('users').update({ actif: false }).eq('id', userId);
      return res.status(200).json({ ok: true, desactive: true, note: delAuth.error.message });
    }
    await admin.from('users').delete().eq('id', userId);
    return res.json({ ok: true });
  }

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
