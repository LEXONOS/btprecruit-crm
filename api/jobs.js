// api/jobs.js — NOVALEM
// GET  /api/jobs                        → offres publiées (site)
// POST /api/jobs action=sign_contract   → signature électronique (public, sans auth)
// POST /api/jobs (X-CRM-Secret)         → actions CRM authentifiées

const { createClient } = require('@supabase/supabase-js');

function getSB() {
  const url = process.env.SUPABASE_URL;
  // Côté serveur, on privilégie la clé service_role (contourne RLS → écritures
  // fiables quoi qu'il arrive) ; sinon on retombe sur la clé anon.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou clé Supabase manquante');
  // Realtime désactivé : aucune API serverless n'en a besoin, et ça évite
  // le warning "Node.js 20 detected without native WebSocket support".
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { disabled: true },
  });
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-CRM-Secret',
};

module.exports = async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ══ GET — offres publiées ══════════════════════════════════════
  if (req.method === 'GET') {
    try {
      const sb = getSB();
      const { data: jobs, error } = await sb
        .from('job_postings')
        .select('id,title,location,contract_type,cat,salary_display,experience,reference,description,skills,views_count,applications_count,created_at')
        .eq('published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ jobs: jobs || [] });
    } catch (err) {
      return res.status(500).json({ jobs: [], error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'GET ou POST requis' });

  const { action, job } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action requis' });

  // ══ Signature électronique — PUBLIC (pas de secret requis) ═════
  if (action === 'sign_contract') {
    return handleSignContract(req, res);
  }

  // ══ Dossier candidature — PUBLIC ══════════════════════════════
  if (action === 'submit_dossier') {
    return handleSubmitDossier(req, res);
  }

  // ══ Auto-booking — PUBLIC (lien candidat, protégé par token) ══
  if (action === 'get_booking')     return handleGetBooking(req, res);
  if (action === 'book_slot')       return handleBookSlot(req, res);

  // ══ France Travail — vérification JCMO seulement (la publication est manuelle) ══
  if (action === 'verify_offer')    return handleVerifyOffer(req, res);

  // ══ Actions CRM authentifiées ══════════════════════════════════
  const secret = req.headers['x-crm-secret'];
  if (!secret || secret !== process.env.CRM_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }

  try {
    if (action === 'publish') {
      if (!job?.crm_id || !job?.title) return res.status(400).json({ error: 'crm_id et title requis' });
      const row = {
        crm_id: job.crm_id, title: job.title,
        location: job.location || '', contract_type: job.contract_type || 'CDI',
        cat: job.cat || job.category || 'go',
        salary_display: job.salary_display || job.salary || '',
        experience: job.experience || '', reference: job.reference || '',
        description: job.description || job.body || '',
        skills: Array.isArray(job.skills) ? job.skills : [],
        published: true, updated_at: new Date().toISOString(),
      };
      const { data, error } = await sb.from('job_postings').upsert(row, { onConflict: 'crm_id' }).select().single();
      if (error) throw error;
      return res.status(200).json({ success: true, job: data });
    }
    if (action === 'unpublish') {
      const filter = job?.id ? { id: job.id } : { crm_id: job?.crm_id };
      const { error } = await sb.from('job_postings').update({ published: false, updated_at: new Date().toISOString() }).match(filter);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    if (action === 'list_all') {
      const { data: jobs, error } = await sb.from('job_postings').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, jobs: jobs || [] });
    }
    if (action === 'get_applications') {
      const { data: apps, error } = await sb.from('job_applications').select('*').eq('job_posting_id', job?.id).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json({ success: true, applications: apps || [] });
    }
    if (action === 'update_app_status') {
      const { error } = await sb.from('job_applications').update({ status: job?.status }).eq('id', job?.app_id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    if (action === 'delete') {
      const filter = job?.id ? { id: job.id } : { crm_id: job?.crm_id };
      const { error } = await sb.from('job_postings').delete().match(filter);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: `Action inconnue : ${action}` });
  } catch (err) {
    console.error('[api/jobs]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ── Signature électronique ─────────────────────────────────────
// Niveau eIDAS simple + faisceau d'indices renforcé
// Stockage dans novalem_signatures avec preuves juridiques (signature graphique,
// fonction signataire, hash contrat, audit log, acceptances)
async function handleSignContract(req, res) {
  const {
    co_id, ct_id, token,
    signer_name, signer_fonction, signer_email, co_name,
    signature_image, signature_method,
    user_agent, contract_hash, audit_log, acceptances,
    signed_pdf,
  } = req.body || {};

  // ── Validations ──
  if (!ct_id || !token || !signer_name?.trim()) {
    return res.status(400).json({ error: 'ct_id, token et signer_name sont requis' });
  }
  if (!signer_fonction?.trim()) {
    return res.status(400).json({ error: 'La fonction du signataire est requise (preuve du pouvoir d\'engagement)' });
  }
  // Signature graphique obligatoire (dessinée ou importée) — la typée seule n'est pas suffisante
  if (!signature_image || !signature_method || !['drawn', 'uploaded'].includes(signature_method)) {
    return res.status(400).json({ error: 'Signature graphique manquante (dessinée ou importée requise)' });
  }
  // 3 acceptances obligatoires
  if (!acceptances?.lecture || !acceptances?.pouvoir || !acceptances?.eidas) {
    return res.status(400).json({ error: 'Toutes les cases d\'engagement doivent être cochées' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
           || req.socket?.remoteAddress || 'unknown';
  const signed_at = new Date().toISOString();
  const ref = 'NV-' + ct_id.slice(0, 8).toUpperCase();

  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }

  // Vérifier si déjà signé (même ct_id + token)
  const { data: existing } = await sb
    .from('novalem_signatures')
    .select('signer_name, signer_fonction, signed_at')
    .eq('ct_id', ct_id)
    .eq('token', token)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({
      error: 'Contrat déjà signé',
      signer_name: existing.signer_name,
      signer_fonction: existing.signer_fonction,
      signed_at: existing.signed_at,
      reference: ref,
    });
  }

  // Enregistrer la signature avec preuves juridiques complètes
  const { error: insertErr } = await sb.from('novalem_signatures').insert({
    co_id:               co_id || null,
    ct_id,
    token,
    co_name:             co_name || null,
    signer_name:         signer_name.trim(),
    signer_fonction:     signer_fonction.trim(),
    signer_email:        signer_email || null,
    signer_ip:           ip,
    signed_at,
    status:              'signé',
    signature_image:     signature_image,
    signature_method:    signature_method,
    user_agent:          user_agent || req.headers['user-agent'] || null,
    contract_hash:       contract_hash || null,
    acceptance_lecture:  !!acceptances?.lecture,
    acceptance_pouvoir:  !!acceptances?.pouvoir,
    acceptance_eidas:    !!acceptances?.eidas,
    audit_log:           audit_log || {},
  });

  if (insertErr) {
    console.error('[sign] Insert error:', insertErr.message);
    return res.status(500).json({ error: 'Erreur enregistrement signature: ' + insertErr.message });
  }

  // ── Archivage du PDF contre-signé dans Supabase Storage ──
  let pdfUrl = null;
  if (signed_pdf) {
    try {
      const pdfBuffer = Buffer.from(signed_pdf, 'base64');
      const fileName = `contrat-signe-${ref}-${Date.now()}.pdf`;
      const { error: upErr } = await sb.storage
        .from('contrats-signes')
        .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });
      if (!upErr) {
        const { data: pub } = sb.storage.from('contrats-signes').getPublicUrl(fileName);
        pdfUrl = pub?.publicUrl || null;
        // Enregistrer l'URL dans la ligne de signature
        if (pdfUrl) {
          await sb.from('novalem_signatures')
            .update({ pdf_url: pdfUrl })
            .eq('ct_id', ct_id).eq('token', token);
        }
      } else {
        console.warn('[sign] PDF storage error:', upErr.message);
      }
    } catch (e) {
      console.warn('[sign] PDF archive exception:', e.message);
    }
  }

  // Préparer les pièces jointes pour les emails
  // - Le PDF du contrat contre-signé
  // - La signature en image inline (CID) car Gmail bloque les images base64 dans <img src>
  const sigB64 = (signature_image || '').split(',')[1] || '';
  const sigAttachment = sigB64 ? [{
    filename: 'signature.png',
    content: sigB64,
    content_id: 'signature-novalem',
  }] : [];
  const pdfAttachment = signed_pdf ? [{
    filename: `Contrat-signe-${ref}.pdf`,
    content: signed_pdf,
  }] : [];
  const allAttachments = [...pdfAttachment, ...sigAttachment];

  // Envoyer les emails de notification
  const RESEND_KEY   = process.env.RESEND_API_KEY;
  // Email de notification : toujours contact@novalem (pro), CRM_USER_EMAIL en copie si différent
  const NOVALEM_EMAIL = 'contact@novalem-recrutement.fr';
  const EXTRA_NOTIFY  = (process.env.CRM_USER_EMAIL && process.env.CRM_USER_EMAIL !== NOVALEM_EMAIL)
                       ? process.env.CRM_USER_EMAIL : null;
  const SENDER_EMAIL  = process.env.SENDER_EMAIL   || 'contact@novalem-recrutement.fr';

  const dt = new Date(signed_at).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris'
  });

  if (RESEND_KEY) {
    // Email à NOVALEM
    const htmlNovalem = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">
  <div style="background:#1A1614;padding:16px 24px"><div style="font-size:17px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div><div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;margin-top:1px">CONTRAT SIGNÉ ✅</div></div>
  <div style="padding:22px 24px">
    <div style="background:#F0FFF4;border:1px solid #86EFB0;border-radius:6px;padding:12px 16px;margin-bottom:18px;font-weight:700;color:#166534;font-size:14px">✅ ${co_name || co_id || 'Client'} vient de signer le contrat</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#888;width:130px">Client</td><td style="padding:8px 10px;font-weight:700">${co_name || co_id || '—'}</td></tr>
      <tr><td style="padding:8px 10px;color:#888">Signataire</td><td style="padding:8px 10px;font-weight:700">${signer_name}</td></tr>
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#888">Fonction</td><td style="padding:8px 10px;font-weight:700">${signer_fonction}</td></tr>
      <tr><td style="padding:8px 10px;color:#888">Email</td><td style="padding:8px 10px">${signer_email || '—'}</td></tr>
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#888">Date & heure</td><td style="padding:8px 10px">${dt} (Paris)</td></tr>
      <tr><td style="padding:8px 10px;color:#888">IP</td><td style="padding:8px 10px;font-family:monospace;font-size:11px">${ip}</td></tr>
      <tr style="background:#F8F5EF"><td style="padding:8px 10px;color:#888">Mode signature</td><td style="padding:8px 10px">${signature_method === 'drawn' ? 'Dessinée à la main' : 'Image importée'}</td></tr>
      <tr><td style="padding:8px 10px;color:#888">Référence</td><td style="padding:8px 10px;font-family:monospace;font-size:12px;color:#C9891A;font-weight:700">${ref}</td></tr>
    </table>
    ${sigB64 ? `
    <div style="margin-top:14px;padding:12px;background:#F8F5EF;border-radius:6px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px">Signature graphique</div>
      <img src="cid:signature-novalem" alt="Signature" style="max-width:100%;max-height:80px;display:block;margin:0 auto">
    </div>` : ''}
    <p style="margin:16px 0 0;font-size:12px;color:#888">Prochaine étape : ouvrez le CRM → fiche client → onglet Contrats → Vérifier signature → transmettez les coordonnées du candidat.</p>
  </div>
  <div style="background:#F8F5EF;padding:10px 24px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">NOVALEM · Signature électronique eIDAS simple · ${ref}</div>
</div></body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `NOVALEM CRM <${SENDER_EMAIL}>`,
        to: EXTRA_NOTIFY ? [NOVALEM_EMAIL, EXTRA_NOTIFY] : [NOVALEM_EMAIL],
        subject: `✅ Contrat signé — ${co_name || 'Client'} (${ref})`,
        html: htmlNovalem,
        attachments: allAttachments,
      })
    }).catch(e => console.warn('[sign] email novalem:', e.message));

    // Email de confirmation au signataire
    if (signer_email) {
      const htmlClient = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)">
  <div style="background:#1A1614;padding:16px 24px"><div style="font-size:17px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div><div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;margin-top:1px">CONFIRMATION DE SIGNATURE</div></div>
  <div style="padding:22px 24px">
    <p style="font-size:14px;font-weight:700;margin-bottom:14px">Bonjour ${signer_name},</p>
    <p style="font-size:13px;line-height:1.7;margin-bottom:16px">Nous confirmons avoir reçu votre signature électronique du <strong>Contrat Cadre de Recrutement NOVALEM</strong> en qualité de <strong>${signer_fonction}</strong>${co_name ? ' de ' + co_name : ''}.</p>
    <div style="background:#F8F5EF;border-radius:6px;padding:14px;margin-bottom:16px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9891A;margin-bottom:8px">Certificat de signature</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#666;width:110px">Signataire</td><td style="font-weight:700">${signer_name}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Fonction</td><td>${signer_fonction}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Date</td><td>${dt}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Référence</td><td style="font-family:monospace;color:#C9891A;font-weight:700">${ref}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Valeur légale</td><td>Signature simple — eIDAS (UE) n°910/2014</td></tr>
      </table>
      ${sigB64 ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #E8E4DC">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">Votre signature</div>
        <img src="cid:signature-novalem" alt="Signature" style="max-width:100%;max-height:60px;display:block">
      </div>` : ''}
    </div>
    <p style="font-size:12px;color:#888;line-height:1.65">NOVALEM vous contactera très prochainement avec les coordonnées du candidat pour organiser l'entretien. <strong>Conservez cet email comme preuve de signature.</strong></p>
  </div>
  <div style="background:#F8F5EF;padding:10px 24px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">NOVALEM · contact@novalem-recrutement.fr · 06 58 21 20 96 · novalem-recrutement.fr</div>
</div></body></html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Louis RENAULT — NOVALEM <${SENDER_EMAIL}>`,
          to: [signer_email],
          subject: `Confirmation de signature — Contrat NOVALEM (${ref})`,
          html: htmlClient,
          attachments: allAttachments,
        })
      }).catch(e => console.warn('[sign] email client:', e.message));
    }
  }

  return res.status(200).json({
    success:     true,
    signed_at,
    signer_name: signer_name.trim(),
    reference:   ref,
  });
}


// ── Soumission dossier candidature ────────────────────────────────────
// ── Helpers documents candidats → bucket Supabase privé "candidat-docs" ──
const DOC_SLOT = { cv:'cv', id:'id_card', titre:'id_card', permis:'permis', carte_vit:'carte_vit', dossier:'dossier' };
function _fmtSize(n){ return n<1024 ? n+'o' : (n<1024*1024 ? Math.round(n/1024)+'Ko' : (n/1024/1024).toFixed(1)+'Mo'); }
function _extFor(mime, filename){
  if(mime==='application/pdf') return '.pdf';
  if(mime==='image/jpeg'||mime==='image/jpg') return '.jpg';
  if(mime==='image/png') return '.png';
  if(mime==='image/webp') return '.webp';
  const fromName = (filename||'').includes('.') ? '.'+filename.split('.').pop() : '';
  return fromName || '.bin';
}
// Upload une pièce dans le bucket privé candidat-docs ; renvoie l'entrée doc
// (chemin de stockage + URL signée longue durée). Fini le base64 dans la fiche.
async function uploadCandidateDoc(sb, candId, slotId, att){
  const b64 = att.content || '';
  if(!b64) return null;
  const mime = att.type || (att.key==='dossier' ? 'application/pdf' : 'application/octet-stream');
  const buf  = Buffer.from(b64, 'base64');
  const ext  = _extFor(mime, att.filename);
  const path = `${candId}/${slotId}${ext}`;
  const { error: upErr } = await sb.storage.from('candidat-docs').upload(path, buf, { contentType: mime, upsert: true });
  if(upErr){ console.warn('[doc] upload', slotId, upErr.message); return null; }
  let url = null;
  try { const { data: s } = await sb.storage.from('candidat-docs').createSignedUrl(path, 60*60*24*365); url = s?.signedUrl || null; } catch(_){}
  return { id: slotId, name: att.filename || (slotId+ext), size: _fmtSize(buf.length), date: new Date().toISOString(), type: mime, storage_path: path, url };
}

// Rattache un dossier validé à la fiche candidat (table crm_candidats) :
// champs dossier + pièces uploadées dans le bucket. N'écrit QUE cette fiche
// (plus de réécriture du blob global → plus d'écrasement concurrent).
async function attachDossierToCandidate(sb, candId, info){
  const { ref, sig, pro, admin, comp, dossier, attachments, id } = info;
  const { data: row, error } = await sb.from('crm_candidats').select('data').eq('id', candId).maybeSingle();
  if(error) throw error;
  if(!row || !row.data){ console.warn('[dossier] candidat introuvable dans crm_candidats:', candId); return false; }
  const cand = typeof row.data==='string' ? JSON.parse(row.data) : row.data;

  cand._dossier_validated    = true;
  cand._dossier_validated_at = new Date().toISOString();
  cand._dossier_ref          = ref;
  cand._dossier_signed_at    = sig.signed_at;
  cand._dossier_notif_seen   = false;
  cand._dossier_data = {
    pro, admin,
    competences: comp,
    experiences: dossier.experiences || [],
    self_employed: !!dossier.self_employed || !!(dossier.experiences && dossier.experiences.length === 0)
  };
  cand.experiences = dossier.experiences || [];
  if(['new','precal'].includes(cand.status)) cand.status = 'dossier';
  cand.updated = new Date().toISOString();

  // ── Déversement vers l'onglet « Contrôle de référence » ──────────────────
  // Chaque expérience renseignée devient une ligne de contrôle de référence.
  // On préserve les références ajoutées à la main (sans _src) et le statut
  // « fait » / la note déjà saisis pour une expérience identique (re-soumission).
  try {
    const prevRefs = Array.isArray(cand.refs) ? cand.refs.slice() : [];
    const manualRefs = prevRefs.filter(r => r && r._src !== 'dossier');
    const dossierRefs = (dossier.experiences || []).map((e, i) => {
      const company = (e.societe || '').trim() || (e.fonction ? 'Expérience — ' + e.fonction : 'Expérience pro ' + (i + 1));
      const phone = (e.ref_tel || '').trim();
      const key = 'exp_' + i + '_' + (company + '|' + phone).toLowerCase().replace(/\s+/g, '');
      const prev = prevRefs.find(r => r && r._src === 'dossier' && r._key === key);
      return {
        company,
        contact: [e.ref_nom, e.ref_fonction].filter(Boolean).join(' — '),
        phone,
        role: [e.fonction, e.periode].filter(Boolean).join(' · '),   // contexte : poste tenu + période
        done: prev ? !!prev.done : false,
        note: prev ? (prev.note || '') : '',
        _src: 'dossier',
        _key: key
      };
    }).filter(r => r.company || r.phone || r.contact);
    cand.refs = manualRefs.concat(dossierRefs);
  } catch (e) { console.warn('[dossier] refs depuis expériences:', e.message); }

  cand.docs = cand.docs || [];
  const upsertDoc = (entry) => { const i = cand.docs.findIndex(d => d.id === entry.id); if(i>=0) cand.docs[i]=entry; else cand.docs.push(entry); };
  for (const att of (attachments || [])) {
    const slotId = DOC_SLOT[att.key] || att.key;
    try {
      let entry;
      if (att.storage_path) {
        // Déjà déposé dans le bucket par le client → on enregistre juste le lien
        entry = { id: slotId, name: att.filename || slotId, size: att.size ? _fmtSize(att.size) : undefined, date: new Date().toISOString(), type: att.type || 'application/octet-stream', storage_path: att.storage_path, url: att.url || null };
      } else if (att.content) {
        entry = await uploadCandidateDoc(sb, candId, slotId, att);
      }
      if (entry) { entry.ref = ref; upsertDoc(entry); }
    } catch(e){ console.warn('[dossier] doc', slotId, e.message); }
  }
  if(!cand.docs.some(d => d.id === 'dossier')){
    upsertDoc({ id:'dossier', name:`Dossier_${id.prenom}_${id.nom}_${ref}.pdf`, date:new Date().toISOString(), missing:true, signed_by: sig.signed_by, signed_at: sig.signed_at, ref });
  }

  const { error: upErr } = await sb.from('crm_candidats').update({
    data: cand, statut: cand.status || 'dossier', updated_at: new Date().toISOString()
  }).eq('id', candId);
  if(upErr) throw upErr;
  console.log('[dossier] fiche candidat mise à jour:', candId, 'ref:', ref);
  return true;
}

async function handleSubmitDossier(req, res) {
  const { dossier, attachments } = req.body || {};
  if (!dossier || !dossier.identite) {
    return res.status(400).json({ error: 'Données dossier manquantes' });
  }

  const id = dossier.identite;
  const pro = dossier.pro || {};
  const admin = dossier.admin || {};
  const comp = dossier.competences || {};
  const sig = dossier.signature || {};
  const candId = dossier.cand_id || null;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const NOVALEM_EMAIL = 'contact@novalem-recrutement.fr';
  const SENDER_EMAIL = process.env.SENDER_EMAIL || NOVALEM_EMAIL;

  const dt = new Date(sig.signed_at || Date.now()).toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris'
  });

  const ref = 'DOS-' + Date.now().toString(36).toUpperCase();

  // ── Enregistrer en Supabase ────────────────────────────────────────
  let sb;
  try { sb = getSB(); } catch(e) {}

  if (sb) {
    try {
      await sb.from('novalem_dossiers').insert({
        ref,
        cand_id: candId,
        prenom: id.prenom,
        nom: id.nom,
        email: id.email,
        tel: id.tel,
        poste: pro.poste,
        cat: pro.cat,
        experience: pro.experience,
        sal_souhaite: pro.sal_souhaite,
        dispo: pro.dispo,
        mobilite: pro.mobilite,
        permis: pro.permis,
        situation_ue: admin.situation_ue,
        caces: JSON.stringify(comp.caces || []),
        signed_at: sig.signed_at,
        signed_by: sig.signed_by,
        status: 'received',
        created_at: new Date().toISOString(),
      });
    } catch(e) {
      console.warn('[dossier] Supabase insert error (non-bloquant):', e.message);
    }

    // Mettre à jour la fiche candidat (table dédiée crm_candidats) + pièces dans le bucket
    if (candId) {
      try { await attachDossierToCandidate(sb, candId, { ref, sig, pro, admin, comp, dossier, attachments, id }); }
      catch(e) { console.warn('[dossier] mise à jour fiche candidat:', e.message); }
    }
  }

  if (RESEND_KEY) {
    // ── Email récap à NOVALEM ──────────────────────────────────────
    const catLabels = {go:'Gros Œuvre',tp:'Travaux Publics',vrd:'VRD',elec:'Électricité',
      plomb:'Plomberie/CVC',charp:'Charpente/Couverture',fin:'Second œuvre',archi:"Bureau d'études",autre:'Autre'};

    const rows = (pairs) => pairs.filter(([,v])=>v)
      .map(([k,v]) => `<tr style="background:${pairs.indexOf([k,v])%2?'#F8F5EF':'#fff'}"><td style="padding:7px 10px;color:#888;font-size:12px;width:140px">${k}</td><td style="padding:7px 10px;font-size:12px;font-weight:600">${v}</td></tr>`).join('');

    const htmlNovalem = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:28px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <div style="background:#1A1614;padding:16px 24px">
    <div style="font-size:17px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;margin-top:1px">NOUVEAU DOSSIER CANDIDATURE 📋</div>
  </div>
  <div style="padding:20px 24px">
    <div style="background:#F0FFF4;border:1px solid #86EFB0;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-weight:700;color:#166534;font-size:14px">
      📋 Nouveau dossier reçu — ${id.prenom} ${id.nom}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
      ${rows([
        ['Candidat', `${id.civilite} ${id.prenom} ${id.nom}`],
        ['Email', id.email],
        ['Téléphone', id.tel],
        ['Poste', pro.poste],
        ['Spécialité', catLabels[pro.cat]||pro.cat],
        ['Expérience', {moins5:'< 5 ans','5a15':'5 à 15 ans',plus15:'> 15 ans'}[pro.experience]||pro.experience],
        ['Salaire souhaité', pro.sal_souhaite ? pro.sal_souhaite+' €/an' : null],
        ['Disponibilité', pro.dispo],
        ['Mobilité', pro.mobilite],
        ['Permis', pro.permis==='oui'?'Oui':pro.permis==='non'?'Non':pro.permis],
        ['Situation admin.', {ue:'UE/EEE','non-ue':'Titre séjour hors UE',fr:'Française'}[admin.situation_ue]||admin.situation_ue],
        ['CACES', comp.caces?.length ? comp.caces.join(', ') : null],
        ['Signé le', dt],
        ['Référence', ref],
      ])}
    </table>
    ${candId ? `<p style="font-size:12px;color:#888">ID CRM : <code>${candId}</code> — Ouvrez la fiche candidat dans le CRM pour voir le dossier complet.</p>` : ''}
  </div>
  <div style="background:#F8F5EF;padding:10px 24px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">
    NOVALEM · Ref. dossier : ${ref} · ${dt}
  </div>
</div></body></html>`;

    const emailPayload = {
      from: `NOVALEM CRM <${SENDER_EMAIL}>`,
      to: [NOVALEM_EMAIL],
      subject: `📋 Nouveau dossier — ${id.prenom} ${id.nom} — ${pro.poste||''}`,
      html: htmlNovalem,
    };

    // Joindre les documents si présents
    if (attachments?.length) {
      emailPayload.attachments = attachments.map(a => ({
        filename: a.filename,
        content: a.content,
        type: a.type || 'application/octet-stream',
      }));
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    }).catch(e => console.warn('[dossier] email novalem:', e.message));

    // ── Email de confirmation au candidat ─────────────────────────
    if (id.email) {
      const htmlCand = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:28px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <div style="background:#1A1614;padding:16px 24px">
    <div style="font-size:17px;font-weight:900;color:#fff">NOVA<span style="color:#C9891A">LEM</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;margin-top:1px">CONFIRMATION DOSSIER</div>
  </div>
  <div style="padding:22px 24px">
    <p style="font-size:15px;font-weight:700;margin-bottom:12px">Bonjour ${id.prenom},</p>
    <p style="font-size:13px;line-height:1.7;margin-bottom:14px">Nous confirmons avoir bien reçu votre dossier de candidature. Notre équipe va l'étudier et reviendra vers vous très prochainement.</p>
    <div style="background:#F8F5EF;border-radius:8px;padding:14px;margin-bottom:16px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9891A;margin-bottom:8px">Récapitulatif</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="padding:3px 0;color:#888;width:130px">Poste</td><td style="font-weight:600">${pro.poste||'—'}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Disponibilité</td><td>${pro.dispo||'—'}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Signé le</td><td>${dt}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Référence</td><td style="font-family:monospace;color:#C9891A;font-weight:700">${ref}</td></tr>
      </table>
    </div>
    <p style="font-size:12px;color:#888;line-height:1.65">Conservez cet email comme preuve de dépôt. En cas de question : <strong>contact@novalem-recrutement.fr</strong></p>
  </div>
  <div style="background:#F8F5EF;padding:10px 24px;border-top:1px solid #E8E4DC;font-size:10px;color:#aaa">
    NOVALEM · contact@novalem-recrutement.fr · 06 58 21 20 96 · novalem-recrutement.fr
  </div>
</div></body></html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Louis RENAULT — NOVALEM <${SENDER_EMAIL}>`,
          to: [id.email],
          subject: `Confirmation de dépôt — Dossier NOVALEM (${ref})`,
          html: htmlCand,
        }),
      }).catch(e => console.warn('[dossier] email candidat:', e.message));
    }
  }

  return res.status(200).json({ success: true, ref, message: 'Dossier reçu' });
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-BOOKING — créneaux candidat (fusionné depuis book.js)
// ═══════════════════════════════════════════════════════════════════
async function findCandidateById(sb, cid) {
  const { data: row, error } = await sb.from('crm_candidats').select('data').eq('id', cid).maybeSingle();
  if (error) throw error;
  if (!row || !row.data) return { cand: null };
  const cand = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { cand };
}

async function handleGetBooking(req, res) {
  const { cid, bk } = req.body || {};
  if (!cid || !bk) return res.status(400).json({ error: 'cid et bk requis' });
  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }
  try {
    const { cand } = await findCandidateById(sb, cid);
    if (!cand)         return res.status(404).json({ error: 'Candidat introuvable' });
    if (!cand.booking) return res.status(404).json({ error: 'Aucune invitation active' });
    if (cand.booking.token !== bk) return res.status(403).json({ error: 'Lien invalide ou expiré' });
    const now = Date.now();
    const slots = (cand.booking.slots || []).filter(s => new Date(s.dt).getTime() > now);
    // Données de pré-remplissage issues de la fiche / extraction CV
    const ex = cand.cv_extracted || {};
    const fullName = cand.name || '';
    const parts = fullName.trim().split(/\s+/);
    const prefill = {
      prenom: ex.prenom || (parts.length > 1 ? parts[0] : ''),
      nom:    ex.nom    || (parts.length > 1 ? parts.slice(1).join(' ') : fullName),
      email:  cand.email || ex.email || '',
      tel:    cand.phone || ex.telephone || '',
      poste:  cand.role || ex.poste_cible || ex.poste_actuel || '',
      mobilite: cand.mobility || ex.mobilite || '',
      salaire:  cand.salary || ex.salaire_actuel || '',
      experience_annees: ex.experience_annees || '',
    };
    return res.status(200).json({
      candName: cand.name || '',
      status: cand.booking.status || 'sent',
      picked: cand.booking.picked || null,
      recruiter: cand.booking.recruiter || { name: 'Votre interlocuteur Novalem', phone: '' },
      slots,
      prefill,
    });
  } catch (e) {
    console.error('get_booking error:', e);
    return res.status(500).json({ error: e.message });
  }
}

async function handleBookSlot(req, res) {
  const { cid, bk, picked } = req.body || {};
  if (!cid || !bk || !picked?.dt) return res.status(400).json({ error: 'cid, bk et picked requis' });
  let sb;
  try { sb = getSB(); } catch (e) { return res.status(500).json({ error: e.message }); }
  try {
    const { cand } = await findCandidateById(sb, cid);
    if (!cand)         return res.status(404).json({ error: 'Candidat introuvable' });
    if (!cand.booking) return res.status(404).json({ error: 'Aucune invitation active' });
    if (cand.booking.token !== bk) return res.status(403).json({ error: 'Lien invalide' });
    if (cand.booking.status === 'booked' && cand.booking.picked) {
      return res.status(409).json({ error: 'Un créneau a déjà été réservé', picked: cand.booking.picked });
    }
    const valid = (cand.booking.slots || []).some(s => s.dt === picked.dt);
    if (!valid) return res.status(400).json({ error: 'Créneau non proposé' });
    if (new Date(picked.dt).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Créneau expiré, choisissez-en un autre' });
    }
    // Lien visio généré côté serveur (le candidat le reçoit immédiatement)
    const visioLink = 'https://meet.jit.si/novalem-' + Math.random().toString(36).slice(2, 10);

    cand.booking.status        = 'booked';
    cand.booking.picked        = { dateStr: picked.dateStr, h: picked.h, dt: picked.dt, label: picked.label || '' };
    cand.booking.booked_at     = new Date().toISOString();
    cand.booking.visio_link    = visioLink;
    cand.booking._agenda_added = false;
    cand.booking_notif_seen    = false;
    cand.visio_link            = visioLink;
    cand.int_date_planned      = picked.dateStr;
    cand.int_time              = picked.h + ':00';

    const { error: upErr } = await sb.from('crm_candidats').update({ data: cand, updated_at: new Date().toISOString() }).eq('id', cid);
    if (upErr) throw upErr;

    // Email de confirmation au candidat (avec lien visio) — best effort, n'échoue pas la résa
    try {
      await sendBookingConfirmation(cand, picked, visioLink);
    } catch (mailErr) {
      console.error('booking confirmation email error:', mailErr);
    }

    return res.status(200).json({ success: true, picked: cand.booking.picked, visio_link: visioLink, recruiter: cand.booking.recruiter || null });
  } catch (e) {
    console.error('book_slot error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════
// FRANCE TRAVAIL — vérification + publication (fusionné depuis post-job/verify-offer)
// ═══════════════════════════════════════════════════════════════════
async function handleVerifyOffer(req, res) {
  const { post } = req.body || {};
  if (!post?.title || !post?.body) return res.status(400).json({ error: 'post.title et post.body requis' });
  const { verifyOffer, localLegalCheck } = require('./_lib/france-travail.js');
  try {
    const result = await verifyOffer(post);
    return res.status(200).json(result);
  } catch (err) {
    const local = localLegalCheck(post);
    return res.status(200).json({ ...local, fallback: true, fallbackReason: err.message });
  }
}

// ── Email de confirmation d'entretien au candidat (avec lien visio) ──
async function sendBookingConfirmation(cand, picked, visioLink) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SENDER_EMAIL = process.env.SENDER_EMAIL || 'contact@novalem-recrutement.fr';
  if (!RESEND_KEY || !cand.email) return;

  const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const d = new Date(picked.dt);
  const whenStr = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} à ${picked.h}h00`;
  const firstN = (cand.name || '').split(' ')[0] || '';
  const recruiterName = cand.booking?.recruiter?.name || 'L\'équipe Novalem';
  const recruiterPhone = cand.booking?.recruiter?.phone || '';

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F3EF;font-family:Arial,Helvetica,sans-serif;color:#1A1614">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07)">
    <div style="background:#1A1614;padding:20px 32px">
      <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px">NOVA<span style="color:#C9891A">LEM</span></div>
      <div style="font-size:9px;color:rgba(255,255,255,.5);letter-spacing:2px;text-transform:uppercase;margin-top:2px">Recrutement BTP · CDI</div>
    </div>
    <div style="padding:28px 32px;font-size:14px;line-height:1.7;color:#2a2a2a">
      <p style="margin:0 0 12px 0">Bonjour ${firstN},</p>
      <p style="margin:0 0 16px 0">Votre dossier a bien été reçu et votre entretien est <strong>confirmé</strong>. Voici les détails :</p>
      <div style="background:#F0FBF4;border:1px solid #BFE9CE;border-radius:8px;padding:16px 18px;margin:0 0 20px 0">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16924f;margin-bottom:6px">Entretien visioconférence</div>
        <div style="font-size:17px;font-weight:700;color:#14532d">${whenStr}</div>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${visioLink}" style="display:inline-block;background:#C9891A;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px">Rejoindre l'entretien →</a>
      </div>
      <p style="margin:0 0 6px 0;font-size:13px;color:#555">Lien direct : <a href="${visioLink}" style="color:#C9891A">${visioLink}</a></p>
      <p style="margin:16px 0 0 0;font-size:13px;color:#555">Merci de vous connecter 2-3 minutes avant l'heure prévue, dans un endroit calme avec une bonne connexion. ${recruiterPhone ? `En cas d'imprévu, appelez le ${recruiterPhone}.` : ''}</p>
      <p style="margin:16px 0 0 0">À très vite,<br><strong>${recruiterName}</strong>${recruiterPhone ? '<br>' + recruiterPhone : ''}</p>
    </div>
    <div style="background:#F8F5EF;padding:16px 32px;border-top:1px solid #E8E4DC;font-size:11px;color:#888;line-height:1.7">
      <strong style="color:#C9891A">NOVALEM</strong> — Cabinet de recrutement BTP<br>
      contact@novalem-recrutement.fr
    </div>
  </div>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${recruiterName} — NOVALEM <${SENDER_EMAIL}>`,
      to: cand.email,
      subject: `Entretien confirmé — ${whenStr}`,
      html,
    }),
  });
}
