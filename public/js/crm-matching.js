/* ════════════════════════════════════════════════════════════════════════
   NOVALEM CRM — Module « Matching & Présentation de profils »
   ────────────────────────────────────────────────────────────────────────
   Se charge APRÈS crm-app.js. Il REMPLACE proprement les 3 points d'entrée
   existants (qui étaient cassés : ids #mo-body inexistants + clé API absente) :

     • findForNeed(needId)        →  Besoin   →  Candidats   (trouver + positionner + présenter)
     • openSendProfileModal(id)   →  Candidat →  Entreprises (réversible)
     • aiMatchEnterprises(id)     →  Candidat →  Entreprises (même modale)

   Chaîne complète :
     1. Sélection intelligente (moteur de score local + lexique BTP).
     2. Aperçu CV (popup), CV anonymisé normalisé sur la DA Novalem (PDF jsPDF).
     3. Email prêt à partir : objet + corps rédigé (1 ou plusieurs profils,
        condensé au-delà de 1), CV anonymisés en pièce jointe.
     4. Suivi : relance automatique J+1 (reportable « demain / +1 j » depuis l'agenda).

   Dépendances déjà présentes : jsPDF (window.jspdf), /api/send-email (Resend),
   clé Anthropic (Paramètres). Tout a un repli sans IA pour ne jamais bloquer.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─────────────────────────────────────────────────────────────────────────
   0. RÉGLAGES & RACCOURCIS
   ───────────────────────────────────────────────────────────────────────── */
const NV_AI_MODEL   = 'claude-haiku-4-5-20251001'; // modèle prouvé dans cet environnement
const NV_AI_MAX_TOK = 1600;
const NV_BULLETS_SOLO = 7;   // ≤ 7 points pour 1 profil
const NV_BULLETS_MULTI = 4;  // 3-4 points quand plusieurs profils
const NV_MATCH_MIN  = 30;    // score minimal pour proposer un candidat / une entreprise
const NV_FOLLOWUP_DAYS = 1;  // relance à J+1 ouvré

const E  = (s) => (typeof esc === 'function') ? esc(s)
              : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const MB = () => document.getElementById('mb');
const MF = () => document.getElementById('mf');

// petite feuille de style locale (spinner) — n'écrase rien d'existant
(function injectStyle(){
  if (document.getElementById('nv-style')) return;
  const s = document.createElement('style');
  s.id = 'nv-style';
  s.textContent = `@keyframes nvspin{to{transform:rotate(360deg)}}
  .nv-spin{display:inline-block;width:18px;height:18px;border:2px solid var(--bd2);border-top-color:var(--ac4);border-radius:50%;animation:nvspin .7s linear infinite;vertical-align:middle}
  .nv-pick{accent-color:var(--ac);width:16px;height:16px;flex-shrink:0;cursor:pointer}
  .nv-row{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid var(--bd);border-radius:var(--r2);margin-bottom:7px;background:var(--s2);cursor:pointer;transition:.12s}
  .nv-row:hover{border-color:var(--bd3)}
  .nv-score{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;flex-shrink:0;min-width:42px;text-align:right}
  .nv-chip{font-size:9px;padding:2px 7px;border-radius:10px;font-weight:700;white-space:nowrap}
  .nv-grp{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin:12px 0 8px}
  .nv-input{width:100%;background:var(--s2);border:1px solid var(--bd2);border-radius:var(--r);color:var(--tx);font-size:12px;padding:8px 10px;font-family:inherit}
  .nv-att{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:5px;font-size:11px}`;
  document.head.appendChild(s);
})();

/* ─────────────────────────────────────────────────────────────────────────
   1. MOTEUR DE MATCHING (local, déterministe, « concret »)
   ───────────────────────────────────────────────────────────────────────── */

// Lexique des spécialités BTP — détecte les correspondances fines
// (ex : « menuiserie aluminium » côté candidat ↔ besoin/notes côté entreprise).
const NV_SPECIALTIES = [
  { key:'aluminium',  rx:/\b(alu|aluminium)\b/i },
  { key:'menuiserie', rx:/\bmenuiser/i },
  { key:'charpente',  rx:/\bcharpent/i },
  { key:'bois',       rx:/\bbois\b/i },
  { key:'pvc',        rx:/\bpvc\b/i },
  { key:'façade',     rx:/\bfa[cç]ade/i },
  { key:'serrurerie', rx:/\bserrurer|m[ée]tallerie/i },
  { key:'platrerie',  rx:/\bpl[âa]tr|plaquist|cloison/i },
  { key:'carrelage',  rx:/\bcarrel/i },
  { key:'peinture',   rx:/\bpeintur/i },
  { key:'electricite',rx:/\b[ée]lectric|cfo|cfa\b/i },
  { key:'plomberie',  rx:/\bplomb|chauffag|cvc|sanitaire|fluide/i },
  { key:'etancheite', rx:/\b[ée]tanch/i },
  { key:'gros_oeuvre',rx:/\bgros\s?[œo]uvre|maçonn|coffr|banch|béton\b/i },
  { key:'second_oeuvre',rx:/\bsecond\s?[œo]uvre|tce\b/i },
  { key:'vrd',        rx:/\bvrd|voirie|r[ée]seaux|terrassement|enrob/i },
  { key:'structure',  rx:/\bstructure|b[ée]ton arm[ée]|charpente m[ée]tallique|robot|etabs|eurocode/i },
  { key:'topographie',rx:/\bg[ée]om[èe]tre|topograph/i },
  { key:'hse',        rx:/\bhse|qse|s[ée]curit[ée]|sps|mase\b/i },
];

const NV_STOP = new Set(('de des du la le les un une et en pour avec sur dans au aux par sous ' +
  'h f hf cdi cdd ans an confirme confirmé senior junior poste profil recherche recherché ' +
  'mois immediate immédiate disponible').split(' '));

function nvTokens(str){
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(w => w.length > 3 && !NV_STOP.has(w));
}
function nvSpecsOf(str){
  const out = new Set();
  NV_SPECIALTIES.forEach(s => { if (s.rx.test(str || '')) out.add(s.key); });
  return out;
}
function nvNum(v){ const n = Number(String(v || '').replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; }

// Texte « profil » complet d'un candidat (sert au matching ET aux replis IA)
function nvCandText(c){
  return [c.role, getCatLabel(c.cat), c.notes_pre, c.notes_int, c.notes, c.mobility,
          c.cv_extracted && c.cv_extracted.poste_actuel, c.cv_extracted && c.cv_extracted.notes_synthese]
         .filter(Boolean).join(' ');
}
function nvNeedText(n){
  return [n.title, getCatLabel(n.cat), n.notes, n.location].filter(Boolean).join(' ');
}
function getCatLabel(id){ try { return getCat(id).l; } catch(_) { return 'BTP'; } }

// Score 0-100 + raisons lisibles. Cœur du « matching intelligent ».
function nvScore(cand, need){
  if (!cand || !need) return { score:0, reasons:[] };
  let s = 0; const reasons = [];

  // Catégorie BTP
  if (cand.cat === need.cat) { s += 42; reasons.push(getCatLabel(cand.cat)); }
  else {
    const i = BTP_CATS.findIndex(x => x.id === cand.cat);
    const j = BTP_CATS.findIndex(x => x.id === need.cat);
    if (i >= 0 && j >= 0 && Math.abs(i - j) <= 1) { s += 16; reasons.push('Secteur proche'); }
  }

  // Intitulé / rôle — chevauchement de mots-clés
  const tn = new Set(nvTokens(need.title));
  const tc = new Set(nvTokens([cand.role, cand.cv_extracted && cand.cv_extracted.poste_actuel].filter(Boolean).join(' ')));
  let titleHits = 0; tn.forEach(w => { if (tc.has(w)) titleHits++; });
  if (titleHits) { s += Math.min(22, titleHits * 9); reasons.push('Métier'); }

  // Spécialités fines (alu, menuiserie, structure…) — besoin+notes ↔ candidat+notes
  const sNeed = nvSpecsOf(nvNeedText(need));
  const sCand = nvSpecsOf(nvCandText(cand));
  const shared = [...sNeed].filter(k => sCand.has(k));
  if (shared.length) {
    s += Math.min(20, shared.length * 12);
    reasons.push(shared.slice(0,2).map(k => k.replace(/_/g, ' ')).join(' · '));
  }

  // Salaire (le souhait du candidat doit tenir dans la fourchette du besoin)
  const sal = nvNum(cand.salary), smin = nvNum(need.smin), smax = nvNum(need.smax) || 999999;
  if (sal > 0 && (smin > 0 || need.smax)) {
    if (sal >= smin && sal <= smax) { s += 14; reasons.push('Salaire OK'); }
    else if (sal >= smin * 0.9 && sal <= smax * 1.12) { s += 7; }
  } else s += 6;

  // Disponibilité
  const av = (cand.avail || '').toLowerCase();
  if (/imm[ée]d|de suite|dispo|maintenant/.test(av)) { s += 10; reasons.push('Dispo'); }
  else if (/1 mois|un mois|semaine|pr[ée]avis/.test(av)) s += 6;
  else if (av) s += 3;

  // Localisation / mobilité
  if (need.location && cand.mobility) {
    const mob = cand.mobility.toLowerCase();
    if (/national|france|toute|partout/.test(mob)) { s += 8; }
    else if (nvTokens(need.location).some(w => mob.includes(w))) { s += 9; reasons.push('Zone'); }
  }

  return { score: Math.max(0, Math.min(100, Math.round(s))), reasons: [...new Set(reasons)] };
}

function nvScoreColor(score){
  if (score >= 70) return 'var(--ac2)';
  if (score >= 50) return 'var(--ac4)';
  return 'var(--mu)';
}

/* ─────────────────────────────────────────────────────────────────────────
   2. CV ANONYMISÉ — génération IA (+ repli) puis PDF DA Novalem
   ───────────────────────────────────────────────────────────────────────── */

const _anonCache = new Map(); // candId -> { sig, struct }

// Retrouve le CV d'origine embarqué (base64) pour une anonymisation plus riche.
function nvFindCv(cand){
  const docs = cand.docs;
  if (!Array.isArray(docs)) return null;
  for (const d of docs) {
    if (d && typeof d === 'object' && d.file && /pdf|image\/(png|jpe?g)/i.test(d.type || '')) {
      return { dataUrl: d.file, type: (d.type || '').toLowerCase() };
    }
  }
  return null;
}

function nvGetKey(){ try { return getApiKey(); } catch(_) { return ''; } }

// Détecte les permis / CACES dans tout le matériel disponible.
function nvDetectPermis(cand, struct){
  if (struct && Array.isArray(struct.permis) && struct.permis.length) return struct.permis;
  const txt = (nvCandText(cand) + ' ' + (cand.cv_extracted ? JSON.stringify(cand.cv_extracted) : '')).toLowerCase();
  const found = [];
  if (/permis\s*b\b|permis\s+de\s+conduire|v[ée]hicul/.test(txt)) found.push('Permis B');
  [['c','C'],['ce','CE'],['d','D']].forEach(([k,lbl]) => {
    if (new RegExp('permis\\s*' + k + '\\b').test(txt)) found.push('Permis ' + lbl);
  });
  const caces = txt.match(/caces[^.,;]*/);
  if (caces) found.push(caces[0].toUpperCase().slice(0, 28).trim());
  if (/nacelle/.test(txt)) found.push('Nacelle');
  return [...new Set(found)];
}

// Normalise une disponibilité en phrase courte.
function nvDispo(cand){
  const a = (cand.avail || '').trim();
  if (!a) return '';
  const l = a.toLowerCase();
  if (/imm[ée]d|de suite|maintenant|dispo/.test(l)) return 'Disponible immédiatement';
  if (/^disponible/i.test(a)) return a;
  return 'Disponible ' + a.charAt(0).toLowerCase() + a.slice(1);
}

function nvPrenom(cand){
  const p = (cand.prenom || cand.name || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '';
}

// Repli sans IA : structure le CV à partir des champs + notes.
function nvTemplateStruct(cand){
  const cat = getCatLabel(cand.cat);
  const notes = [cand.notes_int, cand.notes_pre, cand.notes].filter(Boolean).join(' ').replace(/\[IA\]\s*/g, '');
  const years = (notes.match(/(\d{1,2})\s*ans?/) || [])[1] || (cand.cv_extracted && cand.cv_extracted.experience_annees) || '';
  const sentences = notes.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 8);
  const skills = [];
  const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
  nvSpecsOf(notes).forEach(k => skills.push(cap1(k.replace(/_/g, ' '))));
  // Quelques compétences génériques crédibles selon la catégorie si rien d'extrait
  if (!skills.length) {
    const def = {
      go:['Pilotage de chantier','Management d\'équipes','Suivi budgétaire','Lecture de plans'],
      so:['Coordination TCE','Suivi sous-traitants','Réception de travaux','Planning'],
      be:['Études techniques','Logiciels métier','Notes de calcul','Normes Eurocodes'],
      vrd:['Réseaux secs/humides','Voirie & terrassement','Implantation','Suivi de chantier'],
      hse:['Prévention des risques','Audits sécurité','Animation HSE','Documentation QSE'],
      mgmt:['Chiffrage / devis','Relation client','Pilotage d\'affaires','Développement commercial'],
    }[cand.cat] || ['Gestion de chantier','Coordination','Suivi qualité','Sécurité'];
    def.forEach(d => skills.push(d));
  }
  return {
    prenom: nvPrenom(cand),
    metier: cand.role || cat,
    titre: cand.role || cat,
    annees_experience: years ? String(years) : '',
    accroche: sentences[0] || `${cand.role || cat}${years ? ' — ' + years + ' ans d\'expérience' : ''}.`,
    arguments: [
      sentences[1] || `Profil ${cat.toLowerCase()} opérationnel, rencontré et qualifié par nos soins.`,
      sentences[2] || 'Compétences et références vérifiées, candidat motivé et engagé.',
    ],
    competences: skills.slice(0, 8),
    permis: nvDetectPermis(cand, null),
    experiences: [],
    formations_certs: [],
    points_forts: skills.slice(0, 3),
  };
}

// Génère la structure anonymisée (IA si clé dispo, sinon repli). Mise en cache.
async function nvBuildStruct(cand){
  const sig = (cand.updated || '') + '|' + (cand.id || '');
  const hit = _anonCache.get(cand.id);
  if (hit && hit.sig === sig) return hit.struct;

  const key = nvGetKey();
  let struct = null;

  if (key) {
    try { struct = await nvGenStructAI(cand, key); }
    catch (e) { console.warn('[NV] IA CV indispo, repli template :', e && e.message); }
  }
  if (!struct) struct = nvTemplateStruct(cand);

  // garde-fous d'anonymisation + complétions
  struct.prenom = struct.prenom || nvPrenom(cand);
  struct.metier = struct.metier || cand.role || getCatLabel(cand.cat);
  struct.titre  = struct.titre  || struct.metier;
  if (!struct.permis || !struct.permis.length) struct.permis = nvDetectPermis(cand, struct);
  struct.competences = (struct.competences || []).filter(Boolean);
  struct.experiences = (struct.experiences || []).map(nvScrubExp).filter(Boolean);

  _anonCache.set(cand.id, { sig, struct });
  return struct;
}

// Sécurité : retire tout nom d'entreprise résiduel d'une expérience.
function nvScrubExp(x){
  if (!x || typeof x !== 'object') return null;
  return {
    periode: x.periode || '',
    poste: x.poste || '',
    secteur: x.secteur || x.contexte || '',
    ville: x.ville || '',
    realisations: Array.isArray(x.realisations) ? x.realisations.filter(Boolean) : [],
  };
}

// Appel IA — extraction + anonymisation en un seul passage (multimodal si CV joint).
async function nvGenStructAI(cand, key){
  const cv = nvFindCv(cand);
  const ctx = [
    `Poste ciblé : ${cand.role || ''}`,
    `Spécialité : ${getCatLabel(cand.cat)}`,
    `Disponibilité : ${cand.avail || ''}`,
    `Mobilité : ${cand.mobility || ''}`,
    `Salaire souhaité : ${cand.salary ? cand.salary + '€/an' : ''}`,
    `Notes recruteur (précal) : ${cand.notes_pre || ''}`,
    `Notes recruteur (entretien) : ${cand.notes_int || ''}`,
    `Notes : ${cand.notes || ''}`,
    cand.cv_extracted ? `Données extraites : ${JSON.stringify(cand.cv_extracted)}` : '',
  ].filter(l => l.split(': ')[1] && l.split(': ')[1].trim()).join('\n');

  const system =
`Tu es expert en recrutement BTP. Tu produis un CV ANONYMISÉ et NORMALISÉ, prêt à envoyer à une entreprise cliente.
OBJECTIF : l'entreprise ne doit PAS pouvoir reconnaître un CV qu'elle aurait déjà reçu, ni identifier le candidat.

RÈGLES D'ANONYMISATION (strictes) :
- AUCUN nom de famille (prénom seul autorisé), AUCUNE photo, AUCUNE date de naissance, AUCUNE adresse, AUCUN email/téléphone.
- AUCUN nom d'entreprise employeur (même grands groupes) : remplace chaque employeur par un descripteur neutre du SECTEUR/TYPE
  (ex. « Entreprise générale du BTP », « PME de gros œuvre », « Bureau d'études structure », « Promoteur immobilier », « Groupe de construction »).
- ON CONSERVE : la ville de chaque expérience, les dates/périodes, les missions et réalisations, les compétences, les certifications.
- Reformule légèrement les missions pour qu'elles ne soient pas retrouvables mot pour mot sur internet, sans en changer le sens.

SORTIE : un objet JSON STRICT, sans markdown, exactement :
{
 "prenom": "",
 "metier": "intitulé de poste clair",
 "titre": "intitulé affiché en tête de CV",
 "annees_experience": "",
 "accroche": "1 phrase d'accroche percutante",
 "arguments": ["argument de vente 1 (1 phrase)", "argument de vente 2 (1 phrase)"],
 "competences": ["", ""],
 "permis": ["Permis B", "CACES ..."],
 "experiences": [{"periode":"","poste":"","secteur":"","ville":"","realisations":["",""]}],
 "formations_certs": ["", ""],
 "points_forts": ["", "", ""]
}`;

  const content = [];
  if (cv) {
    const mt = cv.type.includes('pdf') ? 'application/pdf' : (cv.type.includes('png') ? 'image/png' : 'image/jpeg');
    content.push({ type: mt === 'application/pdf' ? 'document' : 'image',
                   source: { type:'base64', media_type: mt, data: (cv.dataUrl.split(',')[1] || cv.dataUrl) } });
  }
  content.push({ type:'text', text:
    (cv ? 'Anonymise et normalise ce CV en respectant strictement les règles.\n\n' : 'Construis un CV anonymisé à partir de ces informations.\n\n')
    + 'Contexte recruteur :\n' + ctx });

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': key,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: NV_AI_MODEL, max_tokens: NV_AI_MAX_TOK, system, messages: [{ role:'user', content }] }),
  });
  if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error((e.error && e.error.message) || ('HTTP ' + resp.status)); }
  const data = await resp.json();
  const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let parsed = null;
  try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
  catch (_) { const m = raw.match(/\{[\s\S]*\}/); if (m) try { parsed = JSON.parse(m[0]); } catch (e) {} }
  if (!parsed) throw new Error('JSON IA invalide');
  return parsed;
}

// ── PDF du CV anonymisé (Direction Artistique Novalem : sombre + accent doré) ──
function nvCVPDF(cand, S){
  const lib = window.jspdf; if (!lib) return null;
  const doc = new lib.jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210, H = 297, ML = 18, MR = 18, CW = W - ML - MR;
  const FOOT = 12;                       // hauteur réservée au pied de page
  const C = { dark:[26,22,20], gold:[201,137,26], grey:[110,104,96], soft:[245,243,239], line:[228,224,216] };
  const sf = (s, z) => { doc.setFont('helvetica', s); doc.setFontSize(z); };
  const tc = (...a) => doc.setTextColor(...a);
  // Assainit le texte : la police PDF standard (Helvetica/WinAnsi) ne sait pas
  // dessiner les flèches Unicode (→) ni certains espaces fins → caractères de
  // remplacement propres, sinon on obtient des glyphes parasites ("!'").
  const safe = (t) => String(t == null ? '' : t)
    .replace(/[\u2190-\u21FF\u2794\u2798-\u27BF\u2B00-\u2BFF]/g, '\u2013')
    .replace(/[\u00A0\u2007\u2009\u202F]/g, ' ');
  const wrap = (t, w) => doc.splitTextToSize(safe(t), w);
  // Saut de page si la hauteur restante est insuffisante
  const room = (h) => { if (y + h > H - FOOT - 2) { doc.addPage(); y = 16; return true; } return false; };

  // ── En-tête (bandeau sombre) — titre borné pour ne jamais chevaucher NOVALEM ──
  doc.setFillColor(...C.dark); doc.rect(0, 0, W, 34, 'F');
  const RIGHT_BLOCK = 46;                 // zone réservée à droite (PRÉSENTÉ PAR / NOVALEM)
  const titleMaxW = W - MR - RIGHT_BLOCK - ML;
  let titleTxt = String(S.titre || S.metier || 'Profil BTP');
  let tz = 18; sf('bold', tz);
  while (doc.getTextWidth(titleTxt) > titleMaxW && tz > 11) { tz -= 0.5; sf('bold', tz); }
  let titleLines = wrap(titleTxt, titleMaxW);
  if (titleLines.length > 2) titleLines = titleLines.slice(0, 2); // garde-fou : 2 lignes max
  tc(255,255,255);
  if (titleLines.length === 1) { doc.text(titleLines[0], ML, 15); }
  else { doc.text(titleLines[0], ML, 12); doc.text(titleLines[1], ML, 12 + tz * 0.42); }
  sf('normal', 9); tc(...C.gold);
  doc.text(wrap(getCatLabel(cand.cat) + (S.annees_experience ? '   ·   ' + S.annees_experience + ' ans d\'expérience' : ''), titleMaxW)[0], ML, 27);
  sf('bold', 8); tc(180,170,160); doc.text('PRÉSENTÉ PAR', W - MR, 11, { align:'right' });
  sf('bold', 12); tc(...C.gold); doc.text('NOVALEM', W - MR, 18, { align:'right' });
  sf('normal', 7); tc(150,142,134); doc.text('Recrutement BTP', W - MR, 23, { align:'right' });

  // ── Bandeau infos clés — chaque paire mesurée, retour à la ligne propre ──
  const kv = [
    nvDispo(cand) ? ['Disponibilité', nvDispo(cand).replace(/^Disponible\s*/i, '')] : null,
    cand.salary ? ['Salaire souhaité', fM(cand.salary) + '/an'] : null,
    cand.mobility ? ['Mobilité', cand.mobility] : null,
    (S.permis && S.permis.length) ? ['Permis', S.permis.join(', ')] : null,
  ].filter(Boolean);
  let y = 41, kx = ML;
  kv.forEach(([k, v]) => {
    const kl = k + ' : ';
    sf('normal', 8);  const kw = doc.getTextWidth(kl);
    sf('bold', 8);    const vw = doc.getTextWidth(safe(v));
    const pairW = kw + vw + 9;
    if (kx + kw + vw > W - MR) { kx = ML; y += 5; }   // passe à la ligne AVANT de déborder
    sf('normal', 8); tc(160,150,140); doc.text(kl, kx, y);
    sf('bold', 8);   tc(...C.dark);   doc.text(safe(v), kx + kw, y);
    kx += pairW;
  });
  y += 8;

  const section = (label, w) => {
    room(16);
    sf('bold', 9); tc(...C.gold); doc.text(String(label).toUpperCase(), ML, y); y += 2;
    doc.setDrawColor(...C.gold); doc.setLineWidth(0.5); doc.line(ML, y, ML + (w || 50), y); y += 5;
  };

  // ── Accroche (encadré beige, hauteur calée sur le texte) ──
  if (S.accroche) {
    const lines = wrap(S.accroche, CW - 10);
    const hgt = lines.length * 4.4 + 8;
    room(hgt + 2);
    doc.setFillColor(...C.soft); doc.roundedRect(ML, y, CW, hgt, 2, 2, 'F');
    sf('italic', 9.5); tc(...C.grey); doc.text(lines, ML + 5, y + 6); y += hgt + 6;
  }

  // ── Points forts (3 cartes de hauteur égale, texte borné dans la carte) ──
  if (Array.isArray(S.points_forts) && S.points_forts.length) {
    section('Points forts', 34);
    const pts = S.points_forts.slice(0, 3);
    const gap = 4, colW = (CW - (pts.length - 1) * gap) / pts.length;
    const wrapped = pts.map(p => wrap(p, colW - 6));
    let maxH = 0; wrapped.forEach(w => { maxH = Math.max(maxH, w.length * 3.7 + 7); });
    room(maxH + 7);
    pts.forEach((p, i) => {
      const x = ML + i * (colW + gap);
      doc.setFillColor(...C.soft); doc.roundedRect(x, y, colW, maxH, 2, 2, 'F');
      sf('bold', 8); tc(...C.dark); doc.text(wrapped[i], x + 3, y + 5);
    });
    y += maxH + 7;
  }

  // ── Expériences (poste borné pour ne pas chevaucher la période) ──
  if (Array.isArray(S.experiences) && S.experiences.length) {
    section('Expériences professionnelles', 76);
    S.experiences.forEach(x => {
      room(18);
      sf('normal', 8); const perW = x.periode ? doc.getTextWidth(String(x.periode)) + 4 : 0;
      sf('bold', 9.5);
      const posteLines = wrap(String(x.poste || ''), CW - perW);
      tc(...C.dark); doc.text(posteLines, ML, y);
      if (x.periode) { sf('normal', 8); tc(...C.grey); doc.text(safe(x.periode), W - MR, y, { align:'right' }); }
      y += posteLines.length * 4.3 + 0.6;
      const sub = [x.secteur, x.ville].filter(Boolean).join('  ·  ');
      if (sub) { sf('italic', 8); tc(...C.grey); const sl = wrap(sub, CW); doc.text(sl, ML, y); y += sl.length * 3.9 + 0.6; }
      (x.realisations || []).forEach(r => {
        sf('normal', 8.5); const rl = wrap('•  ' + r, CW - 4);
        room(rl.length * 3.9 + 2); tc(...C.dark); doc.text(rl, ML + 2, y); y += rl.length * 3.9 + 1.2;
      });
      y += 3.5;
    });
  }

  // ── Compétences (2 colonnes, avance = hauteur réelle de la ligne) ──
  if (Array.isArray(S.competences) && S.competences.length) {
    section('Compétences', 50);
    const cols = 2, gap = 6, cw2 = (CW - gap) / cols;
    for (let i = 0; i < S.competences.length; i += cols) {
      let rowLines = 1;
      const cells = [];
      for (let j = 0; j < cols && i + j < S.competences.length; j++) {
        const cl = wrap('›  ' + S.competences[i + j], cw2 - 4);
        cells.push(cl); rowLines = Math.max(rowLines, cl.length);
      }
      room(rowLines * 4 + 1.5);
      cells.forEach((cl, j) => { sf('normal', 8.5); tc(...C.dark); doc.text(cl, ML + j * (cw2 + gap), y); });
      y += rowLines * 4 + 1.5;
    }
    y += 3;
  }

  // ── Formations & certifications (avance = hauteur réelle) ──
  if (Array.isArray(S.formations_certs) && S.formations_certs.length) {
    section('Formations & certifications', 66);
    S.formations_certs.forEach(f => {
      sf('normal', 8.5); const fl = wrap('›  ' + f, CW - 4);
      room(fl.length * 4 + 1.5); tc(...C.dark); doc.text(fl, ML, y); y += fl.length * 4 + 1.5;
    });
  }

  // ── Pied de page sur chaque page ──
  const np = doc.getNumberOfPages();
  for (let p = 1; p <= np; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.dark); doc.rect(0, H - 10, W, 10, 'F');
    sf('normal', 6.5); tc(180,170,160);
    doc.text('NOVALEM · Recrutement BTP · contact@novalem-recrutement.fr · Document confidentiel', ML, H - 4);
    doc.text(p + '/' + np, W - MR, H - 4, { align:'right' });
  }
  return doc.output('datauristring').split(',')[1];
}

function nvCvFilename(cand, S){
  const base = (S && S.metier) || cand.role || getCatLabel(cand.cat) || 'Profil';
  const pre = nvPrenom(cand);
  return ('CV_Novalem_' + (pre ? pre + '_' : '') + base).replace(/[^\w\-]+/g, '_').replace(/_+/g, '_') + '.pdf';
}

/* ─────────────────────────────────────────────────────────────────────────
   3. APERÇU CV (popup) — pour « regarder le CV avant de décider »
   ───────────────────────────────────────────────────────────────────────── */
let _nvBack = null; // action de retour optionnelle (revenir à la liste)
function nvPreviewBack(){ const f = _nvBack; _nvBack = null; if (typeof f === 'function') f(); else closeMo(); }

async function nvPreviewCV(candId, backType, backId){
  const cand = cById(candId); if (!cand) return;
  _nvBack = backType === 'need' ? (() => nvOpenNeedMatch(backId))
          : backType === 'cand' ? (() => nvOpenCandMatch(backId))
          : null;
  openMo('Aperçu CV — ' + E(cand.name),
    '<div style="display:flex;align-items:center;gap:10px;padding:26px;color:var(--mu);font-size:12px"><span class="nv-spin"></span> Génération du CV anonymisé…</div>', '');
  let S;
  try { S = await nvBuildStruct(cand); }
  catch (e) { MB().innerHTML = '<div class="mu_ fs11" style="padding:16px">Impossible de générer l\'aperçu : ' + E(e.message) + '</div>'; return; }

  const chip = (t) => '<span class="nv-chip" style="background:var(--ac-dim);color:var(--ac4);border:1px solid var(--ac-border)">' + E(t) + '</span>';
  const html = `
   <div style="border:1px solid var(--bd2);border-radius:var(--r2);overflow:hidden">
    <div style="background:var(--s1);border-bottom:1px solid var(--bd);padding:14px 16px">
     <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:var(--tx)">${E(S.titre || S.metier)}</div>
     <div style="font-size:10px;color:var(--ac4);margin-top:2px">${E(getCatLabel(cand.cat))}${S.annees_experience ? ' · ' + E(S.annees_experience) + ' ans' : ''}</div>
     <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      ${nvDispo(cand) ? chip(nvDispo(cand)) : ''}
      ${cand.salary ? chip('Salaire souhaité : ' + fM(cand.salary) + '/an') : ''}
      ${cand.mobility ? chip(cand.mobility) : ''}
      ${(S.permis || []).map(chip).join('')}
     </div>
    </div>
    <div style="padding:14px 16px;font-size:11px;line-height:1.6;max-height:42vh;overflow-y:auto">
     ${S.accroche ? `<div style="font-style:italic;color:var(--mu);margin-bottom:12px">${E(S.accroche)}</div>` : ''}
     ${(S.experiences && S.experiences.length) ? `<div class="nv-grp">Expériences</div>` + S.experiences.map(x => `
        <div style="margin-bottom:9px">
         <div style="font-weight:700;color:var(--tx)">${E(x.poste || '')} <span class="mu_ fs10" style="font-weight:400">${E([x.secteur, x.ville].filter(Boolean).join(' · '))}</span> <span class="mu_ fs10" style="float:right">${E(x.periode || '')}</span></div>
         ${(x.realisations || []).map(r => `<div style="color:var(--mu);padding-left:10px">• ${E(r)}</div>`).join('')}
        </div>`).join('') : ''}
     ${(S.competences && S.competences.length) ? `<div class="nv-grp">Compétences</div><div style="color:var(--mu)">${S.competences.map(E).join(' · ')}</div>` : ''}
     ${(S.formations_certs && S.formations_certs.length) ? `<div class="nv-grp">Formations & certifications</div>${S.formations_certs.map(f => `<div style="color:var(--mu)">› ${E(f)}</div>`).join('')}` : ''}
    </div>
   </div>
   <div style="margin-top:10px;font-size:10px;color:var(--ac4);background:var(--ac-dim);border-radius:var(--r);padding:7px 10px">
    Anonymisé : sans nom de famille, photo, coordonnées ni nom d'entreprise. Villes, dates et missions conservées.
   </div>`;
  MB().innerHTML = html;
  MF().innerHTML =
    `${_nvBack ? '<button class="btn bg bsm" onclick="nvPreviewBack()">← Retour à la liste</button>' : '<button class="btn bg bsm" onclick="closeMo()">Fermer</button>'}
     <button class="btn bp bsm" onclick="nvDownloadCVById('${candId}')">⬇ Télécharger le PDF</button>`;
}

// Ouvre un PDF (base64) dans un nouvel onglet sans perturber la modale en cours.
function nvOpenPdfBlob(candId){
  const cand = cById(candId); if (!cand) return;
  const hit = _anonCache.get(candId);
  const b64 = hit && hit.struct ? nvCVPDF(cand, hit.struct) : null;
  if (!b64) { nvPreviewCV(candId); return; }
  try {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (_) { nvPreviewCV(candId); }
}

function nvDownloadBase64Pdf(b64, filename){
  const a = document.createElement('a');
  a.href = 'data:application/pdf;base64,' + b64;
  a.download = filename || 'CV_Novalem.pdf';
  document.body.appendChild(a); a.click(); a.remove();
}
async function nvDownloadCVById(candId){
  const cand = cById(candId); if (!cand) return;
  toast('Préparation du PDF…', 'i');
  const S = await nvBuildStruct(cand);
  const b64 = nvCVPDF(cand, S);
  if (!b64) { toast('jsPDF indisponible', 'e'); return; }
  nvDownloadBase64Pdf(b64, nvCvFilename(cand, S));
}

/* ─────────────────────────────────────────────────────────────────────────
   4. BESOIN → CANDIDATS  (remplace findForNeed)
   ───────────────────────────────────────────────────────────────────────── */
function nvOpenNeedMatch(needId){
  const need = nById(needId); if (!need) return;
  const co = coById(need.company_id);

  const all = DB.candidates.filter(c => !['placed', 'ko'].includes(c.status));
  const ranked = all.map(c => ({ c, m: nvScore(c, need) }))
                    .sort((a, b) => b.m.score - a.m.score);

  const linked = ranked.filter(x => x.c.linked_need === needId);
  const suggest = ranked.filter(x => x.c.linked_need !== needId && x.m.score >= NV_MATCH_MIN);

  const rowHtml = (x, checked) => {
    const c = x.c, sc = x.m.score, cs = getCS(c.status);
    return `<label class="nv-row">
      <input type="checkbox" class="nv-pick" value="${c.id}" ${checked ? 'checked' : ''}>
      <div style="flex:1;min-width:0">
       <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:12px">${E(c.name)}</span>
        <span class="pill ${cs.p}" style="font-size:9px">${cs.l}</span>
        ${c.pepite ? '<span class="nv-chip" style="background:var(--ac-dim);color:var(--ac4)">★ Pépite</span>' : ''}
       </div>
       <div class="mu_ fs10" style="margin:3px 0">${E(c.role || getCatLabel(c.cat))}${c.salary ? ' · ' + fM(c.salary) : ''}${c.avail ? ' · ' + E(c.avail) : ''}</div>
       ${x.m.reasons.length ? `<div style="display:flex;gap:5px;flex-wrap:wrap">${x.m.reasons.slice(0,4).map(r => `<span class="nv-chip" style="background:var(--s3);color:var(--mu)">${E(r)}</span>`).join('')}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
       <span class="nv-score" style="color:${nvScoreColor(sc)}">${sc}%</span>
       <button type="button" class="btn bg bxs" onclick="event.preventDefault();event.stopPropagation();nvPreviewCV('${c.id}','need','${needId}')">Voir CV</button>
      </div>
    </label>`;
  };

  const head = `<div style="margin-bottom:12px;padding:10px 12px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);font-size:11px">
     <strong>${E(need.title)}</strong>${co ? ' · ' + E(co.name) : ''} · <span class="tag ${getCat(need.cat).cls}">${getCat(need.cat).l}</span>
     ${need.location ? ' · ' + E(need.location) : ''}${(need.smin || need.smax) ? ' · ' + (need.smin && need.smax ? fM(need.smin) + '–' + fM(need.smax) : (need.smax ? '≤' + fM(need.smax) : '≥' + fM(need.smin))) : ''}
    </div>`;

  const body = head +
    (linked.length ? `<div class="nv-grp">Déjà positionnés sur ce besoin (${linked.length})</div>` + linked.map(x => rowHtml(x, false)).join('') : '') +
    (suggest.length ? `<div class="nv-grp">Candidats suggérés (triés par pertinence)</div>` + suggest.map(x => rowHtml(x, false)).join('')
                    : `<div class="mu_ fs11" style="padding:14px 4px">Aucun candidat suffisamment pertinent pour ce besoin.${all.length ? ' Affinez la fiche besoin (notes, spécialité) ou ajoutez des candidats.' : ''}</div>`) +
    `<div style="margin-top:10px;font-size:10px;color:var(--mu2)">Cochez des candidats puis « Positionner » (suivi sur le besoin) ou « Préparer l'email » (CV anonymisés en pièce jointe).</div>`;

  openMo('Trouver des candidats — ' + E(need.title), body,
    `<button class="btn bg bsm" onclick="closeMo()">Fermer</button>
     <button class="btn bg bsm" onclick="nvAddSelectedToNeed('${needId}')">+ Positionner</button>
     <button class="btn bp bsm" onclick="nvComposeFromNeed('${needId}')">✉ Préparer l'email →</button>`);
}

function nvSelectedIds(){ return $$('#mb .nv-pick:checked').map(el => el.value); }

// Positionne un candidat sur un besoin (= suivi pipeline). N'envoie rien.
function nvLinkCandToNeed(candId, needId, silent){
  const c = cById(candId), n = nById(needId); if (!c || !n) return false;
  if (c.linked_need === needId) return false;
  c.linked_need = needId; c.updated = now_();
  if (n.company_id) addTimeline(n.company_id, 'note', `Candidat positionné sur le besoin « ${n.title} » : ${c.name} (${c.role || getCatLabel(c.cat)})`);
  if (!silent) { save(); }
  return true;
}

function nvAddSelectedToNeed(needId){
  const ids = nvSelectedIds();
  if (!ids.length) { toast('Cochez au moins un candidat', 'w'); return; }
  let n = 0; ids.forEach(id => { if (nvLinkCandToNeed(id, needId, true)) n++; });
  save();
  if (typeof rCands === 'function') rCands();
  if (typeof rNeeds === 'function') rNeeds();
  if (typeof badges === 'function') badges();
  if (UI.ptype === 'need' && UI.pid === needId && typeof openNeedPanel === 'function') openNeedPanel(needId);
  toast(n ? n + ' candidat(s) positionné(s) sur le besoin ✓' : 'Déjà positionnés', 's');
  nvOpenNeedMatch(needId); // rafraîchit la modale
}

// Positionne les sélectionnés PUIS ouvre l'email vers l'entreprise du besoin.
function nvComposeFromNeed(needId){
  const ids = nvSelectedIds();
  if (!ids.length) { toast('Cochez au moins un candidat', 'w'); return; }
  const n = nById(needId); if (!n) return;
  ids.forEach(id => nvLinkCandToNeed(id, needId, true));
  save();
  if (typeof rCands === 'function') rCands();
  nvComposeToCompany(n.company_id, ids, needId);
}

/* ─────────────────────────────────────────────────────────────────────────
   5. CANDIDAT → ENTREPRISES  (remplace openSendProfileModal + aiMatchEnterprises)
   ───────────────────────────────────────────────────────────────────────── */
function nvOpenCandMatch(candId){
  const cand = cById(candId); if (!cand) return;
  const now = Date.now(), week = 7 * 864e5;

  // Univers : clients + prospects avec besoin ouvert + CVthèque (accept_cv)
  const universe = DB.companies.filter(co =>
    co.type === 'client' || co._accept_cv ||
    DB.needs.some(n => n.company_id === co.id && n.status === 'open'));

  const rows = universe.map(co => {
    const openNeeds = DB.needs.filter(n => n.company_id === co.id && n.status === 'open');
    // meilleur score parmi les besoins ouverts, sinon score « catégorie » via un besoin fictif
    let best = { score: 0, reasons: [] };
    if (openNeeds.length) openNeeds.forEach(n => { const m = nvScore(cand, n); if (m.score > best.score) best = m; });
    else best = nvScore(cand, { cat: co.cat, title: '', notes: co.notes, location: co.city });
    const last = co._last_cv_sent_at;
    const days = last ? Math.floor((now - new Date(last)) / 864e5) : null;
    return {
      co, score: best.score, reasons: best.reasons,
      needTitle: openNeeds[0] ? openNeeds[0].title : '',
      hasContract: !!(co._contract_signed || co.contract),
      hasNeed: openNeeds.length > 0,
      sentThisWeek: days !== null && days < 7, days,
    };
  }).sort((a, b) => b.score - a.score);

  const visible = rows.filter(r => r.score >= NV_MATCH_MIN || r.hasNeed || r.hasContract);

  const row = (r) => {
    const co = r.co;
    const badge = r.hasContract ? '<span class="nv-chip" style="background:var(--green-dim);color:var(--ac2)">✓ Contrat</span>'
                : r.hasNeed ? '<span class="nv-chip" style="background:var(--blue-dim);color:var(--ac5)">◎ Besoin ouvert</span>'
                : '<span class="nv-chip" style="background:var(--s3);color:var(--mu)">CVthèque</span>';
    const warn = r.sentThisWeek ? `<span class="nv-chip" style="background:var(--red-dim);color:var(--ac3)">⚠ Envoyé il y a ${r.days}j</span>` : '';
    return `<label class="nv-row" style="${r.sentThisWeek ? 'border-color:var(--red-border);background:var(--red-dim)' : ''}">
      <input type="checkbox" class="nv-pick" value="${co.id}">
      <div style="flex:1;min-width:0">
       <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:12px">${E(co.name)}</span>${badge}${warn}
       </div>
       <div class="mu_ fs10" style="margin:3px 0">${E(co.city || '')}${co.contact ? ' · ' + E(co.contact) : ''}${r.needTitle ? ' · Besoin : ' + E(r.needTitle) : ''}</div>
       ${r.reasons.length ? `<div style="display:flex;gap:5px;flex-wrap:wrap">${r.reasons.slice(0,4).map(x => `<span class="nv-chip" style="background:var(--s3);color:var(--mu)">${E(x)}</span>`).join('')}</div>` : ''}
      </div>
      <span class="nv-score" style="color:${nvScoreColor(r.score)}">${r.score}%</span>
    </label>`;
  };

  const head = `<div style="margin-bottom:12px;padding:10px 12px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);font-size:11px">
     <strong>${E(cand.name)}</strong> · ${E(cand.role || getCatLabel(cand.cat))}${cand.salary ? ' · ' + fM(cand.salary) : ''}${cand.avail ? ' · ' + E(cand.avail) : ''}
     <button class="btn bg bxs" style="float:right" onclick="nvPreviewCV('${candId}','cand','${candId}')">Voir le CV anonymisé</button>
    </div>`;

  openMo('Présenter ce profil — ' + E(cand.name),
    head + (visible.length ? visible.map(row).join('')
      : `<div class="mu_ fs11" style="padding:14px 4px">Aucune entreprise pertinente. Ajoutez des prospects/clients, créez des besoins ou activez la CVthèque.</div>`) +
    `<div style="margin-top:10px;font-size:10px;color:var(--ac4);background:var(--ac-dim);border-radius:var(--r);padding:7px 10px">⚠ Évitez d'envoyer le même profil 2× par semaine à une entreprise (entreprises en rouge).</div>`,
    `<button class="btn bg bsm" onclick="closeMo()">Fermer</button>
     <button class="btn bp bsm" onclick="nvComposeFromCandMatch('${candId}')">✉ Préparer l'email →</button>`);
}

function nvComposeFromCandMatch(candId){
  const ids = nvSelectedIds();
  if (!ids.length) { toast('Cochez au moins une entreprise', 'w'); return; }
  nvComposeCandidateToCompanies(candId, ids);
}

/* ─────────────────────────────────────────────────────────────────────────
   6. RÉDACTION DES PUCES & DU CORPS D'EMAIL
   ───────────────────────────────────────────────────────────────────────── */
// Construit la liste de points (≤7 solo / ≤4 multi) en GARANTISSANT permis + dispo + salaire.
function nvBullets(cand, S, condensed){
  const cap = condensed ? NV_BULLETS_MULTI : NV_BULLETS_SOLO;
  const tail = [];
  if (S.permis && S.permis.length) tail.push(S.permis.join(' · '));
  if (nvDispo(cand)) tail.push(nvDispo(cand));
  if (cand.salary) tail.push('Salaire souhaité : ' + fM(cand.salary) + '/an');
  const skillsAllowed = Math.max(1, cap - tail.length);
  const skills = (S.competences || []).slice(0, skillsAllowed);
  return skills.concat(tail).slice(0, cap);
}

function nvIntroLine(cand, S, condensed){
  const pre = S.prenom || nvPrenom(cand);
  const metier = S.metier || cand.role || getCatLabel(cand.cat);
  const yrs = S.annees_experience ? ` — ${S.annees_experience} ans d'expérience` : '';
  if (condensed) return `**${pre || metier}${pre ? ' — ' + metier : ''}**${yrs}`;
  return `Comme convenu, je me permets de vous transmettre le profil de **${pre || metier}**${pre ? ', ' + metier : ''}${yrs}.`;
}

// Corps complet. plain=true → version texte (mailto) sans markdown.
function nvEmailBody(opts){
  const { company, need, items, userName, userPhone, plain } = opts;
  const condensed = items.length > 1;
  const bullet = plain ? '• ' : '▸ ';
  const bold = (t) => plain ? t.replace(/\*\*/g, '') : t;
  const L = [];

  L.push('Bonjour ' + (typeof greetCo === 'function' ? greetCo(company) : 'Madame, Monsieur') + ',');
  L.push('');
  L.push('J\'espère que vous allez bien.');
  L.push('');

  if (!condensed) {
    const it = items[0];
    let intro = bold(nvIntroLine(it.cand, it.S, false));
    if (need) intro = intro.replace('Comme convenu,', `Comme convenu, et suite à votre besoin de ${need.title},`);
    L.push(intro);
    L.push('');
    (it.S.arguments || []).slice(0, 2).forEach(a => { if (a) L.push(a); });
    L.push('');
    L.push(bold('**Points clés :**'));
    nvBullets(it.cand, it.S, false).forEach(b => L.push(bullet + b));
  } else {
    let intro = `Comme convenu, je vous transmets ${items.length} profils que j'ai sélectionnés` + (need ? ` pour votre besoin de ${need.title}` : '') + ' :';
    L.push(intro);
    L.push('');
    items.forEach((it, i) => {
      L.push(bold(nvIntroLine(it.cand, it.S, true)));
      const arg = (it.S.arguments || [])[0]; if (arg) L.push(arg);
      nvBullets(it.cand, it.S, true).forEach(b => L.push(bullet + b));
      if (i < items.length - 1) { L.push(''); if (!plain) L.push('---'); L.push(''); }
    });
  }

  L.push('');
  if (!plain) L.push('---');
  L.push('');
  L.push(`Vous trouverez ${items.length > 1 ? 'les CV anonymisés' : 'le CV anonymisé'} en pièce jointe.`);
  L.push('Je reste à votre entière disposition pour tout complément d\'information ou pour organiser un échange — n\'hésitez pas à me rappeler.');
  L.push('Je reste également à l\'écoute si vous avez d\'autres critères : nous disposons d\'autres profils susceptibles de vous intéresser.');
  L.push('');
  L.push('Bien cordialement,');
  L.push(bold(`**${userName}**`));
  L.push(userPhone);
  L.push('Novalem — Recrutement BTP');
  L.push('contact@novalem-recrutement.fr');

  return L.join('\n');
}

function nvSubject(items, catId){
  if (items.length === 1) {
    const m = items[0].S.metier || items[0].cand.role || getCatLabel(catId);
    return `Présentation profil — ${m} | Novalem Recrutement`;
  }
  return `Présentation de ${items.length} profils ${getCatLabel(catId)} | Novalem Recrutement`;
}

/* ─────────────────────────────────────────────────────────────────────────
   7. MODALE DE COMPOSITION (aperçu éditable + envoi + repli messagerie)
   ───────────────────────────────────────────────────────────────────────── */
let _nvCompose = null; // contexte courant

// Prépare items {cand,S,b64,filename} pour une liste de candidats.
async function nvPrepareItems(cands){
  const items = [];
  for (const cand of cands) {
    const S = await nvBuildStruct(cand);
    const b64 = nvCVPDF(cand, S);
    items.push({ cand, S, b64, filename: nvCvFilename(cand, S) });
  }
  return items;
}

function nvLoadingModal(title){
  openMo(title, '<div style="display:flex;align-items:center;gap:10px;padding:26px;color:var(--mu);font-size:12px"><span class="nv-spin"></span> Génération des CV anonymisés et de l\'email…</div>', '');
}

function nvUser(){
  const k = (typeof uKey === 'function');
  return {
    name: (k && localStorage.getItem(uKey('btp_user_name'))) || localStorage.getItem('btp_user_name') || 'Louis RENAULT',
    phone: (k && localStorage.getItem(uKey('btp_user_tel'))) || localStorage.getItem('btp_user_tel') || '06 58 21 20 96',
  };
}

// ── 7a. Email vers UNE entreprise avec 1..N profils (besoin → candidats) ──
async function nvComposeToCompany(coId, candIds, needId){
  const co = coById(coId);
  if (!co) { toast('Ce besoin n\'est rattaché à aucune entreprise — complétez la fiche besoin', 'e'); return; }
  const cands = candIds.map(cById).filter(Boolean);
  if (!cands.length) { toast('Aucun candidat valide', 'e'); return; }
  nvLoadingModal('Préparation de l\'email');

  let items; try { items = await nvPrepareItems(cands); }
  catch (e) { closeMo(); toast('Erreur génération : ' + e.message, 'e'); return; }

  const need = needId ? nById(needId) : null;
  const u = nvUser();
  const catId = (need && need.cat) || cands[0].cat;
  const subject = nvSubject(items, catId);
  const body = nvEmailBody({ company: co, need, items, userName: u.name, userPhone: u.phone, plain: false });

  _nvCompose = { mode: 'toCompany', coId, needId, candIds, items, catId };
  nvRenderCompose({
    title: 'Présenter ' + items.length + ' profil' + (items.length > 1 ? 's' : '') + (co ? ' — ' + co.name : ''),
    to: (co && co.email) || '',
    subject, body, items,
    note: co && !co.email ? 'Cette entreprise n\'a pas d\'email enregistré — renseignez-le ci-dessus.' : null,
  });
}

// ── 7b. Email d'1 profil vers 1..N entreprises (candidat → entreprises) ──
async function nvComposeCandidateToCompanies(candId, coIds){
  const cand = cById(candId); if (!cand) return;
  const cos = coIds.map(coById).filter(Boolean);
  nvLoadingModal('Préparation de l\'email');

  let items; try { items = await nvPrepareItems([cand]); }
  catch (e) { closeMo(); toast('Erreur génération : ' + e.message, 'e'); return; }

  const u = nvUser();
  const subject = nvSubject(items, cand.cat);
  // Aperçu basé sur la 1re entreprise ; chaque entreprise recevra sa propre civilité.
  const sample = cos[0] || { contact: '' };
  const need = DB.needs.find(n => cos[0] && n.company_id === cos[0].id && n.status === 'open') || null;
  const body = nvEmailBody({ company: sample, need, items, userName: u.name, userPhone: u.phone, plain: false });

  _nvCompose = { mode: 'candToCompanies', candId, coIds, items, catId: cand.cat };
  nvRenderCompose({
    title: 'Présenter ' + E(cand.name) + ' à ' + cos.length + ' entreprise' + (cos.length > 1 ? 's' : ''),
    to: cos.map(c => c.email).filter(Boolean).join(', '),
    subject, body, items,
    multiNote: cos.length > 1 ? `L'email sera personnalisé et envoyé séparément à chaque entreprise (${cos.length}). La formule de politesse (« Bonjour Monsieur/Madame… ») est adaptée automatiquement à chaque destinataire.` : null,
  });
}

function nvRenderCompose(o){
  const apiBase = (typeof getApiBase === 'function') ? getApiBase() : null;
  const att = o.items.map(it => `<div class="nv-att">
      <span style="color:var(--ac4)">📎</span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${E(it.filename)}</span>
      ${it.b64 ? `<button class="btn bg bxs" onclick="nvOpenPdfBlob('${it.cand.id}')">Aperçu</button>` : '<span class="nv-chip" style="background:var(--red-dim);color:var(--ac3)">PDF KO</span>'}
    </div>`).join('');

  MB().innerHTML = `
    ${o.note ? `<div style="margin-bottom:10px;font-size:10px;color:var(--ac3);background:var(--red-dim);border-radius:var(--r);padding:7px 10px">${E(o.note)}</div>` : ''}
    ${o.multiNote ? `<div style="margin-bottom:10px;font-size:10px;color:var(--ac5);background:var(--blue-dim);border-radius:var(--r);padding:7px 10px">${E(o.multiNote)}</div>` : ''}
    <div class="sl" style="margin-top:0">Destinataire${(_nvCompose && _nvCompose.mode === 'candToCompanies') ? '(s)' : ''}</div>
    <input id="nv-to" class="nv-input" value="${E(o.to)}" placeholder="email@entreprise.fr">
    <div class="sl">Objet</div>
    <input id="nv-subj" class="nv-input" value="${E(o.subject)}">
    <div class="sl">Message</div>
    <textarea id="nv-body" class="nv-input" style="min-height:230px;line-height:1.55;font-family:'DM Mono',monospace;font-size:11px">${E(o.body)}</textarea>
    <div class="sl">Pièces jointes — CV anonymisés (${o.items.length})</div>
    ${att}
    <div style="margin-top:8px;font-size:10px;color:var(--mu2)">Relance automatique programmée à J+${NV_FOLLOWUP_DAYS} (reportable d'un clic depuis l'agenda si la personne n'est pas joignable).</div>`;

  MF().innerHTML =
    `<button class="btn bg bsm" onclick="closeMo()">Annuler</button>
     <button class="btn bg bsm" onclick="nvComposeFallback()">⬇ CV + ma messagerie</button>
     <button class="btn bp bsm" id="nv-send-btn" onclick="nvSendCompose()" ${apiBase ? '' : 'title="Indisponible en local — utilisez « CV + ma messagerie » ou déployez sur Vercel"'}>✉ Envoyer${apiBase ? '' : ' (serveur requis)'}</button>`;
}

// Effets post-envoi : statut « présenté », timelines, compteurs, relance J+1.
function nvAfterSent(co, items, need){
  const today = new Date();
  const dateStr = (typeof localDateStr === 'function') ? localDateStr(addWorkingDays(today, NV_FOLLOWUP_DAYS)) : null;
  co._last_cv_sent_at = new Date().toISOString();
  co._cv_sent_count = (co._cv_sent_count || 0) + items.length;

  const names = items.map(it => it.cand.name).join(', ');
  addTimeline(co.id, 'profile_sent', `Profil(s) envoyé(s) : ${names}` + (need ? ` → ${need.title}` : ''), null);

  items.forEach(it => {
    const c = it.cand;
    if (c.status !== 'placed') { c.status = 'presented'; c.updated = now_(); }
    if (need && c.linked_need !== need.id) c.linked_need = need.id;
  });

  // Relance unique pour l'entreprise (J+1 ouvré)
  if (typeof addAgendaAuto === 'function') {
    addAgendaAuto({
      type: 'relance',
      title: 'Relancer ' + co.name + ' — réception CV ' + names.split(',')[0] + (items.length > 1 ? ' +' + (items.length - 1) : ''),
      date: dateStr || (typeof todayKey === 'function' ? todayKey() : undefined),
      time: '09:30',
      comp_id: co.id,
      cand_id: items[0].cand.id,
      notes: `${items.length} profil(s) envoyé(s) le ${(typeof fD === 'function' && typeof todayKey === 'function') ? fD(todayKey()) : ''}` +
             (need ? ` pour « ${need.title} »` : '') +
             `. Vérifier la bonne réception et obtenir un retour. Si la personne n'est pas joignable : reporter (Demain / +1 jour).`,
      _profile_followup: true,
      _auto: true,
    });
  }
}

async function nvSendCompose(){
  if (!_nvCompose) return;
  const apiBase = (typeof getApiBase === 'function') ? getApiBase() : null;
  if (!apiBase) { toast('Envoi serveur indisponible en local — utilisez « CV + ma messagerie »', 'w'); return; }

  const to = ($('#nv-to').value || '').trim();
  const subject = ($('#nv-subj').value || '').trim();
  const body = $('#nv-body').value || '';
  if (!to) { toast('Renseignez au moins un destinataire', 'e'); return; }

  const btn = document.getElementById('nv-send-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="nv-spin"></span> Envoi…'; }
  const u = nvUser();
  const attachments = _nvCompose.items.filter(it => it.b64).map(it => ({ filename: it.filename, content: it.b64, type: 'application/pdf' }));

  try {
    if (_nvCompose.mode === 'toCompany') {
      const co = coById(_nvCompose.coId);
      const need = _nvCompose.needId ? nById(_nvCompose.needId) : null;
      const ok = await nvPostEmail(apiBase, { to, subject, body, from_name: u.name + ' — NOVALEM', attachments });
      if (!ok) throw new Error('Envoi refusé par le serveur');
      nvAfterSent(co, _nvCompose.items, need);
      toast('✅ Email envoyé à ' + co.name + ' — relance J+' + NV_FOLLOWUP_DAYS + ' planifiée', 's');
    } else {
      // 1 profil → N entreprises : un email personnalisé chacun
      const cand = cById(_nvCompose.candId);
      const cos = _nvCompose.coIds.map(coById).filter(c => c && c.email);
      // Le corps édité par l'utilisateur est conservé ; seule la civilité change par entreprise.
      let sent = 0;
      for (const co of cos) {
        const need = DB.needs.find(n => n.company_id === co.id && n.status === 'open') || null;
        const perBody = nvSwapGreeting(body, co);
        const ok = await nvPostEmail(apiBase, { to: co.email, subject, body: perBody, from_name: u.name + ' — NOVALEM', attachments });
        if (ok) { nvAfterSent(co, _nvCompose.items, need); sent++; }
      }
      if (!sent) throw new Error('Aucun envoi abouti (emails manquants ?)');
      toast('✅ ' + E(cand.name) + ' envoyé à ' + sent + ' entreprise(s) — relances planifiées', 's');
    }

    save();
    if (typeof rCands === 'function') rCands();
    if (typeof rNeeds === 'function') rNeeds();
    if (typeof badges === 'function') badges();
    if (UI.view === 'dash' && typeof rDash === 'function') rDash();
    closeMo();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '✉ Envoyer'; }
    toast('Erreur : ' + e.message, 'e');
  }
}

// Remplace la 1re ligne « Bonjour … , » par la civilité de l'entreprise donnée,
// en préservant le reste du texte édité par l'utilisateur.
function nvSwapGreeting(body, co){
  const greet = 'Bonjour ' + (typeof greetCo === 'function' ? greetCo(co) : 'Madame, Monsieur') + ',';
  const lines = String(body).split('\n');
  if (/^bonjour\b/i.test((lines[0] || '').trim())) { lines[0] = greet; return lines.join('\n'); }
  return greet + '\n\n' + body;
}

async function nvPostEmail(apiBase, payload){
  const resp = await fetch(apiBase + '/api/send-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) { console.warn('[NV] send-email:', data); return false; }
  return !!(data.sent || data.id);
}

// Repli « ouvrir ma messagerie » : télécharge les CV puis ouvre un mailto pré-rempli.
function nvComposeFallback(){
  if (!_nvCompose) return;
  const to = ($('#nv-to') ? $('#nv-to').value : '') || '';
  const subject = ($('#nv-subj') ? $('#nv-subj').value : '') || '';
  // version texte propre (pas de markdown) pour le mailto
  const u = nvUser();
  let plainBody;
  if (_nvCompose.mode === 'toCompany') {
    const co = coById(_nvCompose.coId);
    const need = _nvCompose.needId ? nById(_nvCompose.needId) : null;
    plainBody = nvEmailBody({ company: co, need, items: _nvCompose.items, userName: u.name, userPhone: u.phone, plain: true });
  } else {
    const cos = _nvCompose.coIds.map(coById).filter(Boolean);
    const co = cos[0] || { contact: '' };
    const need = DB.needs.find(n => cos[0] && n.company_id === cos[0].id && n.status === 'open') || null;
    plainBody = nvEmailBody({ company: co, need, items: _nvCompose.items, userName: u.name, userPhone: u.phone, plain: true });
  }

  // Télécharger chaque CV pour pièce jointe manuelle
  _nvCompose.items.forEach((it, i) => { if (it.b64) setTimeout(() => nvDownloadBase64Pdf(it.b64, it.filename), i * 250); });

  const firstTo = to.split(',')[0].trim();
  const href = 'mailto:' + encodeURIComponent(firstTo) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(plainBody);
  setTimeout(() => { window.location.href = href; }, 300);
  toast('CV téléchargé(s) — à joindre dans votre messagerie qui vient de s\'ouvrir', 'i');
}

/* ─────────────────────────────────────────────────────────────────────────
   8. EXPOSITION GLOBALE + OVERRIDES (résolus par les onclick au clic)
   ───────────────────────────────────────────────────────────────────────── */
const G = window;
// overrides des points d'entrée existants
G.findForNeed         = nvOpenNeedMatch;
G.openSendProfileModal = nvOpenCandMatch;
G.aiMatchEnterprises   = nvOpenCandMatch;
// API du module
G.nvOpenNeedMatch = nvOpenNeedMatch;
G.nvOpenCandMatch = nvOpenCandMatch;
G.nvPreviewCV = nvPreviewCV;
G.nvPreviewBack = nvPreviewBack;
G.nvOpenPdfBlob = nvOpenPdfBlob;
G.nvDownloadCVById = nvDownloadCVById;
G.nvLinkCandToNeed = (cid, nid) => { if (nvLinkCandToNeed(cid, nid)) { if (typeof rCands === 'function') rCands(); toast('Candidat positionné ✓', 's'); } };
G.nvAddSelectedToNeed = nvAddSelectedToNeed;
G.nvComposeFromNeed = nvComposeFromNeed;
G.nvComposeFromCandMatch = nvComposeFromCandMatch;
G.nvSendCompose = nvSendCompose;
G.nvComposeFallback = nvComposeFallback;
// utilitaires éventuellement utiles ailleurs
G.nvScore = nvScore;
G.nvBuildStruct = nvBuildStruct;

console.log('[Novalem] Module Matching & Présentation chargé ✓');
})();
