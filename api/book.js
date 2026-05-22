// api/book.js — NOVALEM Auto-Booking (côté candidat)
// GET  /api/book?cid=CAND_ID&bk=TOKEN  → renvoie les créneaux proposés + interlocuteur
// POST /api/book  { cid, bk, picked:{dateStr,h,dt} } → enregistre la réservation
//
// Les données vivent dans crm_data (Supabase, id 1=Louis / 2=Corentin).
// On retrouve le candidat par son id, on vérifie le token, on lit/écrit c.booking.

const { createClient } = require('@supabase/supabase-js');

function getSB() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { disabled: true },
  });
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }

  // ── GET : renvoyer les créneaux proposés au candidat ───────────────
  if (req.method === 'GET') {
    const cid = req.query.cid;
    const bk  = req.query.bk;
    if (!cid || !bk) return res.status(400).json({ error: 'cid et bk requis' });

    try {
      const { cand } = await findCandidate(sb, cid);
      if (!cand)             return res.status(404).json({ error: 'Candidat introuvable' });
      if (!cand.booking)     return res.status(404).json({ error: 'Aucune invitation active' });
      if (cand.booking.token !== bk) return res.status(403).json({ error: 'Lien invalide ou expiré' });

      // Filtrer les créneaux désormais passés
      const now = Date.now();
      const slots = (cand.booking.slots || []).filter(s => new Date(s.dt).getTime() > now);

      return res.status(200).json({
        candName: cand.name || '',
        status:   cand.booking.status || 'sent',     // sent | booked
        picked:   cand.booking.picked || null,
        recruiter: cand.booking.recruiter || { name: 'Votre interlocuteur Novalem', phone: '' },
        slots,
      });
    } catch (e) {
      console.error('book GET error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST : enregistrer le créneau choisi ───────────────────────────
  if (req.method === 'POST') {
    const { cid, bk, picked } = req.body || {};
    if (!cid || !bk || !picked?.dt) return res.status(400).json({ error: 'cid, bk et picked requis' });

    try {
      const { rowId, db, cand } = await findCandidate(sb, cid);
      if (!cand)                     return res.status(404).json({ error: 'Candidat introuvable' });
      if (!cand.booking)             return res.status(404).json({ error: 'Aucune invitation active' });
      if (cand.booking.token !== bk) return res.status(403).json({ error: 'Lien invalide' });
      if (cand.booking.status === 'booked' && cand.booking.picked) {
        return res.status(409).json({ error: 'Un créneau a déjà été réservé', picked: cand.booking.picked });
      }

      // Vérifier que le créneau choisi fait bien partie des créneaux proposés
      const valid = (cand.booking.slots || []).some(s => s.dt === picked.dt);
      if (!valid) return res.status(400).json({ error: 'Créneau non proposé' });
      // Vérifier qu'il n'est pas passé
      if (new Date(picked.dt).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'Créneau expiré, choisissez-en un autre' });
      }

      // Écrire la réservation — le CRM (scanBookings) créera l'événement agenda au prochain sync
      cand.booking.status        = 'booked';
      cand.booking.picked        = { dateStr: picked.dateStr, h: picked.h, dt: picked.dt, label: picked.label || '' };
      cand.booking.booked_at     = new Date().toISOString();
      cand.booking._agenda_added = false;     // signal pour scanBookings côté CRM
      cand.booking_notif_seen    = false;

      await sb.from('crm_data').update({ data: JSON.stringify(db) }).eq('id', rowId);

      return res.status(200).json({
        success: true,
        picked: cand.booking.picked,
        recruiter: cand.booking.recruiter || null,
      });
    } catch (e) {
      console.error('book POST error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};

// ── Cherche un candidat par id dans crm_data (rows 1 et 2) ───────────
async function findCandidate(sb, cid) {
  const { data: rows, error } = await sb.from('crm_data').select('id, data').in('id', [1, 2]);
  if (error) throw error;
  for (const row of (rows || [])) {
    let db;
    try { db = JSON.parse(row.data || '{}'); } catch (e) { continue; }
    const cand = (db.candidates || []).find(c => c.id === cid);
    if (cand) return { rowId: row.id, db, cand };
  }
  return { rowId: null, db: null, cand: null };
}
