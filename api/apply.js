// api/apply.js — NOVALEM v2 (Sprint 1)
// Receives candidatures avec CV + déclenche analyse IA
// ─────────────────────────────────────────────────────────────────
// Flow attendu côté frontend :
//   1. Le formulaire upload le CV directement vers Supabase Storage
//      (bucket 'candidatures-cv') avec la clé anon → policy 'anon_can_upload_cv'
//   2. Une fois l'upload terminé, le formulaire POST ici avec :
//      { firstname, lastname, email, phone, message, job_id, job_title,
//        cv_storage_path, cv_filename, cv_size_bytes, cv_mime_type, ... }
//   3. On insère la row, on déclenche l'analyse IA (inline), on envoie l'email
// ─────────────────────────────────────────────────────────────────
// Env vars requises sur Vercel :
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  ← nouveau, pour lire les CV en privé
//   SUPABASE_ANON_KEY          ← fallback si service role absent
//   ANTHROPIC_API_KEY          ← déjà présent
//   RESEND_API_KEY             ← déjà présent
//   CRM_USER_EMAIL             ← déjà présent (notif candidatures)

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY        = process.env.RESEND_API_KEY;
const NOTIF_EMAIL           = process.env.CRM_USER_EMAIL || 'contact@novalem-recrutement.fr';

// Service role préférée pour accéder au bucket privé. Fallback anon si absente.
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false }, realtime: { disabled: true } }
);

const CV_BUCKET     = 'candidatures-cv';
const ALLOWED_MIME  = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_CV_SIZE   = 10 * 1024 * 1024; // 10 Mo

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

// ═══════════════════════════════════════════════════════════════
// Handler principal
// ═══════════════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const {
      // Annonce ciblée (peut être null = candidature spontanée)
      job_id, job_title, job_reference, job_description,
      // Candidat
      firstname, lastname, email, phone, linkedin_url, message,
      // CV (optionnel mais recommandé)
      cv_storage_path, cv_filename, cv_size_bytes, cv_mime_type,
      // Tracking
      source, utm_source, utm_campaign,
    } = req.body || {};

    // ─── Validation des champs obligatoires ────────────────────
    if (!firstname || !lastname || !email) {
      return res.status(400).json({ error: 'Prénom, nom et email sont obligatoires' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    // ─── Validation CV si fourni ───────────────────────────────
    if (cv_storage_path) {
      if (cv_mime_type && !ALLOWED_MIME.includes(cv_mime_type)) {
        return res.status(400).json({ error: 'Type de fichier non autorisé (PDF, JPG, PNG, WebP uniquement)' });
      }
      if (cv_size_bytes && cv_size_bytes > MAX_CV_SIZE) {
        return res.status(400).json({ error: 'CV trop volumineux (max 10 Mo)' });
      }
    }

    // ─── Insertion candidature dans la DB ──────────────────────
    const ipAddress = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;
    const userAgent = req.headers['user-agent'] || null;

    const record = {
      job_posting_id:   job_id || null,
      job_title:        job_title || null,
      job_reference:    job_reference || null,
      firstname:        firstname.trim(),
      lastname:         lastname.trim(),
      email:            email.trim().toLowerCase(),
      phone:            (phone || '').trim() || null,
      linkedin_url:     (linkedin_url || '').trim() || null,
      message:          (message || '').trim() || null,
      source:           source || 'site_novalem',
      status:           'nouveau',
      // CV metadata
      cv_storage_path:  cv_storage_path || null,
      cv_filename:      cv_filename || null,
      cv_size_bytes:    cv_size_bytes || null,
      cv_mime_type:     cv_mime_type || null,
      cv_uploaded_at:   cv_storage_path ? new Date().toISOString() : null,
      // Tracking
      utm_source:       utm_source || null,
      utm_campaign:     utm_campaign || null,
      ip_address:       ipAddress,
      user_agent:       userAgent,
    };

    const { data: appData, error: appError } = await supabase
      .from('job_applications')
      .insert([record])
      .select()
      .single();

    if (appError) {
      console.error('[apply] insert error:', appError.message);
      return res.status(500).json({ error: 'Erreur enregistrement candidature' });
    }

    // ─── Incrémenter le compteur de l'annonce ─────────────────
    if (job_id) {
      supabase.rpc('increment_job_applications', { p_job_id: job_id })
        .then(({ error }) => { if (error) console.warn('[apply] increment:', error.message); });
    }

    // ─── Envoyer l'email de notification (non-bloquant) ───────
    if (RESEND_API_KEY) {
      sendNotificationEmail({ ...record, app_id: appData.id })
        .catch(e => console.warn('[apply] email error:', e.message));
    }

    // ─── Analyse IA du CV (bloquante mais avec timeout 25s) ───
    // Pourquoi bloquante : on veut renvoyer le score au candidat (optionnel)
    // et surtout avoir l'analyse prête quand Louis ouvre le CRM.
    // maxDuration de la fonction Vercel = 30s (cf. vercel.json)
    let aiResult = null;
    if (cv_storage_path && ANTHROPIC_API_KEY) {
      try {
        aiResult = await Promise.race([
          analyzeCv(cv_storage_path, cv_mime_type, { job_title, job_reference, job_description }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout 25s')), 25000)),
        ]);

        if (aiResult) {
          await supabase
            .from('job_applications')
            .update({
              ai_analysis:       aiResult,
              ai_score:          clampInt(aiResult.score_match, 0, 100),
              ai_resume:         aiResult.resume_court || null,
              ai_strengths:      aiResult.points_forts || null,
              ai_weaknesses:     aiResult.points_faibles || null,
              ai_recommendation: ['a_contacter','a_etudier','pas_adapte'].includes(aiResult.recommandation)
                                   ? aiResult.recommandation : null,
              ai_analyzed_at:    new Date().toISOString(),
            })
            .eq('id', appData.id);
        }
      } catch (err) {
        console.error('[apply] AI error:', err.message);
        await supabase
          .from('job_applications')
          .update({ ai_error: err.message.slice(0, 500) })
          .eq('id', appData.id)
          .catch(() => {});
      }
    }

    return res.status(200).json({
      success:  true,
      message:  'Candidature reçue',
      id:       appData.id,
      analyzed: !!aiResult,
    });

  } catch (err) {
    console.error('[apply] fatal:', err);
    return res.status(500).json({ error: 'Erreur serveur — réessayez ou contactez-nous directement.' });
  }
};

// ═══════════════════════════════════════════════════════════════
// Analyse IA du CV via Claude (PDF natif ou image)
// ═══════════════════════════════════════════════════════════════
async function analyzeCv(storagePath, mimeType, jobContext) {
  // 1. Récupérer le fichier depuis Storage (privé → besoin service_role)
  const { data: fileData, error: dlErr } = await supabase.storage
    .from(CV_BUCKET)
    .download(storagePath);

  if (dlErr || !fileData) {
    throw new Error('CV inaccessible: ' + (dlErr?.message || 'fichier introuvable'));
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const base64 = buffer.toString('base64');

  // 2. Construire le payload selon le type (PDF natif vs image)
  const inferredMime = mimeType || inferMimeFromPath(storagePath);
  const isPdf   = inferredMime === 'application/pdf';
  const isImage = inferredMime?.startsWith('image/');

  if (!isPdf && !isImage) {
    throw new Error(`Format non supporté pour analyse IA: ${inferredMime}`);
  }

  const content = isPdf
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text',     text: buildPrompt(jobContext) },
      ]
    : [
        { type: 'image',    source: { type: 'base64', media_type: inferredMime, data: base64 } },
        { type: 'text',     text: buildPrompt(jobContext) },
      ];

  // 3. Appel Claude (Haiku = rapide + pas cher, suffisant pour cette tâche)
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:       'claude-haiku-4-5-20251001',
      max_tokens:  1500,
      messages:    [{ role: 'user', content }],
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${errTxt.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data.content?.[0]?.text || '';

  // 4. Extraire le JSON de la réponse
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Réponse IA non parsable (pas de JSON détecté)');

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('JSON IA invalide: ' + e.message);
  }
}

function buildPrompt(ctx) {
  const annonceLigne = ctx?.job_title
    ? `\nAnnonce ciblée : "${ctx.job_title}"${ctx.job_reference ? ` (réf. ${ctx.job_reference})` : ''}`
    : '\nCandidature spontanée (pas d\'annonce ciblée).';

  const descLigne = ctx?.job_description
    ? `\nDescription de l'annonce :\n${String(ctx.job_description).slice(0, 800)}`
    : '';

  return `Tu es un assistant de recrutement BTP expérimenté. Analyse ce CV et renvoie UNIQUEMENT un JSON valide (sans markdown, sans texte avant ou après) selon la structure exacte ci-dessous.
${annonceLigne}${descLigne}

Structure JSON OBLIGATOIRE :
{
  "experience_totale_annees": <number ou null>,
  "experience_metier_annees": <number ou null>,
  "competences_cles": [<5 à 8 strings courts>],
  "formation_principale": "<string ou null>",
  "dernier_poste": "<string ou null>",
  "derniere_entreprise": "<string ou null>",
  "localisation_actuelle": "<string ou null>",
  "permis_b": <true | false | null>,
  "score_match": <number 0-100>,
  "resume_court": "<2-3 phrases factuelles>",
  "points_forts": [<2 à 4 strings>],
  "points_faibles": [<0 à 3 strings>],
  "recommandation": "<a_contacter | a_etudier | pas_adapte>"
}

Barème score_match :
  90-100 : profil idéal, correspondance forte
  70-89  : bon match, à contacter
  50-69  : profil moyen, à étudier
  <50    : écart important, peu adapté

Si l'annonce n'est pas précisée, juge la qualité générale du CV pour des postes BTP (score_match = qualité globale du profil). Sois honnête, factuel, jamais flatteur. Pas de markdown, pas de \`\`\`json, juste l'objet brut.`;
}

// ═══════════════════════════════════════════════════════════════
// Email de notification (conservé du v1 + enrichi avec CV/IA)
// ═══════════════════════════════════════════════════════════════
async function sendNotificationEmail(rec) {
  if (!RESEND_API_KEY) return;

  const subject = rec.job_title
    ? `[Novalem] Candidature — ${rec.job_title} — ${rec.firstname} ${rec.lastname}`
    : `[Novalem] Candidature spontanée — ${rec.firstname} ${rec.lastname}`;

  const cvLigne = rec.cv_storage_path
    ? `<tr><td style="padding:8px 0;color:#888">CV</td><td style="padding:8px 0">✓ ${escapeHtml(rec.cv_filename || 'fichier joint')}</td></tr>`
    : `<tr><td style="padding:8px 0;color:#888">CV</td><td style="padding:8px 0;color:#c66">Aucun CV joint</td></tr>`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
      <div style="background:#C8900A;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">Nouvelle candidature Novalem</h2>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        ${rec.job_title
          ? `<p style="background:#FFF8EC;border:1px solid #F0D090;padding:10px 14px;border-radius:6px;margin-bottom:20px;font-size:14px"><strong>Offre :</strong> ${escapeHtml(rec.job_title)}${rec.job_reference ? ` (${escapeHtml(rec.job_reference)})` : ''}</p>`
          : `<p style="background:#f5f5f5;padding:10px 14px;border-radius:6px;margin-bottom:20px;font-size:14px"><em>Candidature spontanée</em></p>`}
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#888;width:120px">Nom</td><td style="padding:8px 0;font-weight:600">${escapeHtml(rec.firstname)} ${escapeHtml(rec.lastname)}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(rec.email)}" style="color:#C8900A">${escapeHtml(rec.email)}</a></td></tr>
          ${rec.phone ? `<tr><td style="padding:8px 0;color:#888">Téléphone</td><td style="padding:8px 0">${escapeHtml(rec.phone)}</td></tr>` : ''}
          ${rec.linkedin_url ? `<tr><td style="padding:8px 0;color:#888">LinkedIn</td><td style="padding:8px 0"><a href="${escapeHtml(rec.linkedin_url)}" style="color:#C8900A">Voir le profil</a></td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#888">Source</td><td style="padding:8px 0">${escapeHtml(rec.utm_source || rec.source || 'site')}</td></tr>
          ${cvLigne}
        </table>
        ${rec.message ? `<div style="margin-top:16px;padding:14px;background:#f9f9f9;border-radius:6px;font-size:14px;line-height:1.7"><strong>Message :</strong><br>${escapeHtml(rec.message).replace(/\n/g,'<br>')}</div>` : ''}
        <p style="margin:24px 0 0 0;font-size:13px">→ <a href="https://novalem-crm.vercel.app/crm" style="color:#C8900A;font-weight:600">Ouvrir dans le CRM</a></p>
        <p style="margin-top:20px;font-size:12px;color:#999">Reçu le ${new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
      </div>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:     'Novalem Recrutement <contact@novalem-recrutement.fr>',
      to:       [NOTIF_EMAIL],
      reply_to: rec.email,
      subject,
      html,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════════════════════════
function inferMimeFromPath(path) {
  const p = (path || '').toLowerCase();
  if (p.endsWith('.pdf'))  return 'application/pdf';
  if (p.endsWith('.png'))  return 'image/png';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
