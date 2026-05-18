// api/jobs.js — NOVALEM
// GET  /api/jobs                        → offres publiées (site)
// POST /api/jobs action=sign_contract   → signature électronique (public, sans auth)
// POST /api/jobs (X-CRM-Secret)         → actions CRM authentifiées

const { createClient } = require('@supabase/supabase-js');

function getSB() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
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
        .select('id,title,location,contract_type,category:cat,salary_display,experience,reference,description,skills,views_count,applications_count,created_at')
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

  // Préparer la pièce jointe PDF pour les emails
  const pdfAttachment = signed_pdf ? [{
    filename: `Contrat-signe-${ref}.pdf`,
    content: signed_pdf,
  }] : [];

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
    ${signature_image ? `
    <div style="margin-top:14px;padding:12px;background:#F8F5EF;border-radius:6px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px">Signature graphique</div>
      <img src="${signature_image}" alt="Signature" style="max-width:100%;max-height:80px;display:block;margin:0 auto">
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
        attachments: pdfAttachment,
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
      ${signature_image ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #E8E4DC">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px">Votre signature</div>
        <img src="${signature_image}" alt="Signature" style="max-width:100%;max-height:60px;display:block">
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
          attachments: pdfAttachment,
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

    // Mettre à jour le profil candidat dans crm_data si cand_id fourni
    if (candId) {
      try {
        // Récupérer la crm_data existante (stockée par l'utilisateur CRM)
        // On met à jour le candidat pour : _dossier_validated, _dossier_ref, et ajouter doc 'dossier'
        const { data: rows } = await sb
          .from('crm_data')
          .select('id, data')
          .in('id', [1, 2]);  // Louis=1, Corentin=2

        for (const row of (rows || [])) {
          try {
            const db = JSON.parse(row.data || '{}');
            const cands = db.candidates || [];
            const cand = cands.find(c => c.id === candId);
            if (cand) {
              // Marquer dossier validé
              cand._dossier_validated = true;
              cand._dossier_ref = ref;
              cand._dossier_signed_at = sig.signed_at;
              cand._dossier_notif_seen = false;

              // Ajouter dans la liste docs
              cand.docs = cand.docs || [];
              const docEntry = { id: 'dossier', l: 'Dossier candidature signé', ico: '📋',
                name: `Dossier_${id.prenom}_${id.nom}.pdf`, date: new Date().toISOString(),
                file: true, ref };
              const existing = cand.docs.findIndex(d => d.id === 'dossier');
              if (existing >= 0) cand.docs[existing] = docEntry;
              else cand.docs.push(docEntry);

              // Sauvegarder
              await sb.from('crm_data').update({ data: JSON.stringify(db) }).eq('id', row.id);
              break;
            }
          } catch(e2) {}
        }
      } catch(e) {
        console.warn('[dossier] crm_data update error:', e.message);
      }
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

  // ── Mettre à jour le profil candidat dans le CRM (Supabase) ────
  if (sb && candId) {
    try {
      // Lire les données CRM existantes
      const { data: crmRows } = await sb
        .from('crm_data')
        .select('id, data')
        .order('id', { ascending: true });

      if (crmRows?.length) {
        for (const row of crmRows) {
          let db;
          try { db = typeof row.data === 'string' ? JSON.parse(row.data) : row.data; }
          catch(e) { continue; }

          const cand = (db.candidates || []).find(c => c.id === candId);
          if (cand) {
            // Marquer dossier validé
            cand._dossier_validated = true;
            cand._dossier_validated_at = new Date().toISOString();
            cand._dossier_ref = ref;
            cand._dossier_notif_seen = false;

            // Ajouter dans la liste des docs
            cand.docs = cand.docs || [];
            const docEntry = {
              id: 'dossier',
              name: `Dossier_${id.prenom}_${id.nom}_${ref}.pdf`,
              date: new Date().toISOString(),
              size: 'signé',
              file: true,
              signed_by: sig.signed_by,
              signed_at: sig.signed_at,
            };
            // Remplacer ou ajouter
            const existingIdx = cand.docs.findIndex(d => d.id === 'dossier');
            if (existingIdx >= 0) cand.docs[existingIdx] = docEntry;
            else cand.docs.push(docEntry);

            // Passer en statut "dossier" si encore en précal
            if (['new','precal'].includes(cand.status)) {
              cand.status = 'dossier';
            }
            cand.updated = new Date().toISOString();

            // Sauvegarder
            await sb.from('crm_data').update({ data: JSON.stringify(db) }).eq('id', row.id);
            console.log('[dossier] Profil candidat mis à jour:', candId, 'ref:', ref);
            break;
          }
        }
      }
    } catch(e) {
      console.warn('[dossier] Mise à jour profil candidat échouée (non-bloquant):', e.message);
    }
  }

  return res.status(200).json({ success: true, ref, message: 'Dossier reçu' });
}
