/* ════════════════════════════════════════════════════════════════════════
   NOVALEM — Annonces Pro v3  (module drop-in, additif)
   ────────────────────────────────────────────────────────────────────────
   À inclure APRÈS crm-app.js dans crm.html :
       <script src="js/crm-app.js"></script>
       <script src="js/novalem-annonces-pro.js"></script>   ← cette ligne

   Ce que fait ce module :
     1. STUDIO IA refondu — génère une annonce propre à partir de :
          • une annonce Indeed collée,   • quelques notes de découverte,
          • un besoin client existant,   • ou rien (mode vivier / fictive).
        Sortie : 3 versions cohérentes (Site Novalem / Indeed / France Travail),
        chaque champ prêt au copier-coller dans le formulaire de la plateforme.
        Règles imposées : non-discrimination stricte, salaire normalisé en
        € BRUT ANNUEL (fourchette), anonymisation du client, même architecture
        (DA) pour toutes les annonces, aucune invention hors mode vivier.
     2. VRAIE publication site — écrit dans la table job_postings (action
        'publish' de /api/jobs), retire (unpublish) et nettoie les orphelins.
     3. Gestionnaire « En ligne » — voir / retirer ce qui est réellement publié.

   Réutilise tes helpers : openMo, closeMo, toast, esc, uid, now_, save,
   aiCall, aiReady, getApiBase, getCat, BTP_CATS, DB, cfgGet, saveSharedConfig.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const MODEL = 'claude-sonnet-4-6';
  let _studio = null;          // données générées (en mémoire) pour la modale Studio
  let _genBusy = false;

  // ── Helpers locaux ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const _esc = (s) => (window.esc ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));
  const _now = () => (window.now_ ? now_() : new Date().toISOString());
  const _uid = () => (window.uid ? uid() : 'p' + Math.random().toString(36).slice(2, 10));
  const companyName = (id) => (window.DB?.companies || []).find((c) => c.id === id)?.name || '';
  function catLabel(catVal) { try { return (window.getCat ? getCat(catVal) : null)?.l || 'BTP'; } catch (e) { return 'BTP'; } }
  function catCls(catVal)  { try { return (window.getCat ? getCat(catVal) : null)?.cls || 'tgo'; } catch (e) { return 'tgo'; } }

  // Format euro FR
  const fmtEur = (n) => Number(n || 0).toLocaleString('fr-FR');

  // Fourchette de marché de secours (€ brut annuel) — utilisée seulement comme
  // garde-fou côté client si l'IA renvoie une valeur aberrante. Indicatif.
  const MARKET = {
    go:   [30000, 65000], so: [28000, 60000], be: [32000, 70000],
    vrd:  [30000, 66000], hse:[30000, 60000], mgmt:[42000, 95000],
  };

  // Génère une référence interne stable : NOV-GO-2606-7F
  function genRef(post) {
    const cat = (post.cat || 'go').toUpperCase().slice(0, 4);
    const d = new Date();
    const ym = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0');
    const rnd = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `NOV-${cat}-${ym}-${rnd}`;
  }

  // Parse JSON robuste (tolère ```json … ``` et le texte autour)
  function parseAiJson(txt) {
    if (!txt) return null;
    try { return JSON.parse(txt.replace(/```json|```/g, '').trim()); }
    catch (e) {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) { return null; } }
      return null;
    }
  }

  // Mini markdown → HTML pour l'aperçu (gras, listes, retours ligne)
  function mdToHtml(md) {
    if (!md) return '<span class="mu_ fs11">—</span>';
    let h = _esc(md);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = h.split('\n'); const out = []; let inUl = false;
    for (let ln of lines) {
      if (/^\s*[-•]\s+/.test(ln)) {
        if (!inUl) { out.push('<ul style="margin:4px 0 8px;padding-left:18px">'); inUl = true; }
        out.push('<li style="margin:2px 0">' + ln.replace(/^\s*[-•]\s+/, '') + '</li>');
      } else {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (ln.trim() === '') out.push('<div style="height:6px"></div>');
        else out.push('<div>' + ln + '</div>');
      }
    }
    if (inUl) out.push('</ul>');
    return out.join('');
  }

  // Markdown → texte propre. Le site public affiche la description en clair
  // (retours à la ligne simples), sans interpréter le markdown. On retire donc
  // les **gras**, on transforme "- " en "• ", et on enlève le label "Accroche"
  // (le chapeau d'accroche n'a pas besoin de titre côté public).
  function mdToPlain(md) {
    if (!md) return '';
    const lines = String(md).replace(/\r/g, '').split('\n');
    const out = [];
    let firstHeading = true;
    const stripBold = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1');
    for (let raw of lines) {
      const ln = raw.trim();
      const h = ln.match(/^\*\*(.+?)\*\*:?\s*$/);            // ligne entièrement en gras = titre de section
      if (h) {
        const title = h[1].trim();
        if (firstHeading && /^accroche$/i.test(title)) { firstHeading = false; continue; }
        firstHeading = false;
        if (out.length && out[out.length - 1] !== '') out.push('');  // ligne vide avant un titre
        out.push(title);
        continue;
      }
      if (/^[-•]\s+/.test(ln)) { out.push('• ' + stripBold(ln.replace(/^[-•]\s+/, ''))); continue; }
      out.push(stripBold(ln));
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  }

  // Scan anti-discrimination côté client (garde-fou avant publication)
  const DISCRIM = [
    'jeune', 'junior dynamique', 'senior expérimenté', 'moins de', 'plus de',
    'ans maximum', 'ans max', '18-', '20-', '25-', '30-', '35 ans', '40 ans',
    'beau', 'belle', 'présentable', 'bonne présentation', 'français natif',
    'langue maternelle', 'de nationalité', 'célibataire', 'sans enfant',
    'bonne condition physique', 'sans handicap',
  ];
  function scanDiscrim(text) {
    const t = (' ' + (text || '') + ' ').toLowerCase();
    const hits = [];
    DISCRIM.forEach((w) => { if (t.includes(w)) hits.push(w); });
    return hits;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. GÉNÉRATION IA
  // ════════════════════════════════════════════════════════════════════════
  const DA_SECTIONS = ['Accroche', 'Le poste', 'Vos missions', 'Profil recherché', 'Conditions & avantages', 'Le cabinet', 'Candidater'];

  function buildSystem() {
    return [
      "Tu es le rédacteur d'annonces senior de NOVALEM, cabinet de recrutement spécialisé dans le BTP en France (gros œuvre, second œuvre, bureau d'études, VRD/TP, HSE, encadrement).",
      "Tu écris des annonces sobres, crédibles et humaines. JAMAIS de ton « IA », jamais de superlatifs creux, pas d'emojis, pas de « équipe jeune et dynamique ».",
      "",
      "RÈGLES ABSOLUES (non négociables) :",
      "",
      "1) NON-DISCRIMINATION (Code du travail art. L1132-1). Interdiction stricte de toute mention liée à : âge ou tranche d'âge (« jeune », « junior/senior » au sens de l'âge, « moins/plus de X ans »), sexe ou genre (toujours écrire « H/F »), nationalité / origine / « langue maternelle » / « français natif », situation de famille, grossesse, état de santé ou handicap (sauf mention POSITIVE d'accessibilité/inclusion), apparence physique, religion, opinions politiques, activité syndicale. N'utilise jamais ces critères, même de façon détournée. Les seules exigences autorisées sont : compétences, diplômes/habilitations, expérience professionnelle, mobilité géographique.",
      "",
      "2) SALAIRE — toujours exprimé en € BRUT ANNUEL, sous forme de FOURCHETTE raisonnable (jamais un chiffre sec, jamais de net, jamais d'horaire). Si un salaire est fourni en entrée : garde-le et construis une fourchette cohérente autour (sans l'inventer à la hausse). Si rien n'est fourni : estime une fourchette de MARCHÉ prudente et réaliste pour ce poste, cette séniorité et cette région, et marque \"estimated\": true. La fourchette doit rester plausible pour le BTP français.",
      "",
      "3) ANONYMISATION — les versions PUBLIQUES (site, Indeed, France Travail) ne nomment JAMAIS l'entreprise cliente ni aucun détail identifiant (nom de marque, nom du dirigeant, adresse précise, numéro de chantier). Parle de « notre client » de manière générique (secteur, taille, type de chantiers) OU centre sur Novalem. Le nom du client est confidentiel et ne sort jamais.",
      "",
      "4) INVENTION — voir le mode fourni :",
      "   • MODE = reel : n'invente AUCUN fait non fourni. Pas de fausse adresse, pas de faux avantages chiffrés, pas de missions précises fabriquées. Si une information manque, reste générique sans inventer de spécificité.",
      "   • MODE = vivier : tu PEUX ajouter des détails plausibles et réalistes (missions courantes du métier, environnement de travail, avantages standards du secteur) pour rendre l'annonce crédible et attractive. MAIS tu n'usurpes jamais l'identité d'une entreprise réelle nommée : tu présentes le poste comme un profil que Novalem recrute régulièrement pour ses clients (annonce « vivier »), de façon honnête.",
      "",
      "5) ARCHITECTURE (DA) — la version SITE suit TOUJOURS exactement ces sections, dans cet ordre, titres en **gras** sur leur propre ligne : " + DA_SECTIONS.map((s) => '**' + s + '**').join(' / ') + ". « Vos missions » et « Profil recherché » en listes à puces « - ». « Le cabinet » : 2-3 phrases sobres présentant Novalem (cabinet spécialisé BTP, accompagnement, confidentialité) + le process (échange, présentation au client). « Candidater » : 1 ligne d'appel à candidature.",
      "",
      "6) Indeed = format scannable, sections courtes, mots-clés métier. France Travail = format administratif strict, mentions conformes.",
      "",
      "Réponds UNIQUEMENT par un objet JSON valide, sans markdown autour, sans commentaire.",
    ].join('\n');
  }

  function buildUserPayload(post) {
    const mode = post.fictive ? 'vivier' : 'reel';
    const lines = [];
    lines.push(`MODE : ${mode}`);
    lines.push(`POSTE : ${post.title || '(à déduire)'}`);
    lines.push(`SECTEUR : ${catLabel(post.cat)}`);
    lines.push(`LOCALISATION : ${post.location || 'France'}`);
    lines.push(`TYPE DE CONTRAT : ${post.contract_type || 'CDI'}`);
    if (post.salary_hint) lines.push(`SALAIRE INDIQUÉ : ${post.salary_hint}`);
    if (post.experience)  lines.push(`EXPÉRIENCE : ${post.experience}`);
    lines.push(`RÉFÉRENCE INTERNE À UTILISER : ${post.reference || genRef(post)}`);

    if (post.source_mode === 'paste' && post.source_raw) {
      lines.push('\nANNONCE SOURCE À REFORMULER (collée par l\'utilisateur — réécris-la entièrement, anonymise le nom de l\'entreprise, NE recopie pas le texte tel quel) :\n"""\n' + post.source_raw.slice(0, 6000) + '\n"""');
    } else if (post.source_raw) {
      lines.push('\nNOTES DE DÉCOUVERTE (informations connues — base-toi dessus, ne va pas au-delà sauf en mode vivier) :\n"""\n' + post.source_raw.slice(0, 4000) + '\n"""');
    } else if (mode === 'vivier') {
      lines.push('\nAucune note : génère une annonce « vivier » crédible et attractive pour ce poste (détails réalistes autorisés).');
    } else {
      lines.push('\nAucune note détaillée : reste générique et factuel, n\'invente rien.');
    }

    lines.push(
      '\nProduis EXACTEMENT cette structure JSON :',
      JSON.stringify({
        ref: 'string',
        public_title: 'Intitulé public H/F + ville',
        contract_type: 'CDI | CDD | Intérim | Alternance',
        experience: 'ex: 3 à 5 ans',
        location: 'ex: Lyon (69)',
        salary: { min: 0, max: 0, display: 'xx 000 – yy 000 € brut/an', estimated: true, note: 'origine de la fourchette' },
        skills: ['compétence/mot-clé', '...'],
        site_md: 'Texte markdown SITE avec les sections imposées',
        indeed: { titre: '', contrat: '', lieu: '', salaire: '', description: '', competences: ['', ''] },
        france_travail: { intitule: '', contrat: '', lieu: '', duree_hebdo: '35h', salaire: '', experience: '', description: '', mentions: 'Poste ouvert à toutes et tous (H/F). ...' },
        legal: ['liste des points légaux corrigés ou à surveiller, sinon vide'],
        internal_note: 'Ce que tu as déduit ou estimé (visible cabinet uniquement). Si salaire estimé, explique.',
      }, null, 0)
    );
    return lines.join('\n');
  }

  // Normalise/valide la sortie IA + garde-fous salaire
  function normalizeAi(j, post) {
    const out = {
      ref: j.ref || post.reference || genRef(post),
      public_title: j.public_title || post.title || 'Annonce',
      contract_type: j.contract_type || post.contract_type || 'CDI',
      experience: j.experience || post.experience || '',
      location: j.location || post.location || '',
      skills: Array.isArray(j.skills) ? j.skills.filter(Boolean).slice(0, 12) : [],
      site_md: j.site_md || '',
      indeed: j.indeed || {},
      france_travail: j.france_travail || {},
      legal: Array.isArray(j.legal) ? j.legal.filter(Boolean) : [],
      internal_note: j.internal_note || '',
    };
    // Salaire
    let sal = j.salary || {};
    let min = parseInt(sal.min, 10) || 0;
    let max = parseInt(sal.max, 10) || 0;
    if (min && max && min > max) { const t = min; min = max; max = t; }
    // garde-fou marché
    const band = MARKET[post.cat] || [22000, 120000];
    if (min && (min < band[0] * 0.6 || min > band[1] * 1.6)) out.legal.push('⚠️ Fourchette salariale à vérifier (hors marché ' + catLabel(post.cat) + ')');
    const display = sal.display || (min && max ? `${fmtEur(min)} – ${fmtEur(max)} € brut/an` : (min ? `À partir de ${fmtEur(min)} € brut/an` : ''));
    out.salary = { min, max, display, estimated: !!sal.estimated, note: sal.note || '' };

    // scan discrim sur tous les textes publics
    const blob = [out.site_md, out.indeed.description, out.indeed.titre, out.france_travail.description, out.france_travail.intitule].join('\n');
    scanDiscrim(blob).forEach((w) => out.legal.push('⛔ Terme à risque détecté : « ' + w + ' »'));
    return out;
  }

  // Appel IA principal
  async function generateAnnonceAI(post) {
    if (!(window.aiReady && aiReady())) { toast('IA indisponible (mode local) — déployez sur Vercel', 'e'); return null; }
    const data = await aiCall({
      model: MODEL,
      max_tokens: 3000,
      system: buildSystem(),
      messages: [{ role: 'user', content: buildUserPayload(post) }],
    });
    const txt = data.content?.find((b) => b.type === 'text')?.text || data.content?.[0]?.text || '';
    const j = parseAiJson(txt);
    if (!j || !j.site_md) throw new Error('Réponse IA illisible — réessaie');
    return normalizeAi(j, post);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. STUDIO — modale de génération + onglets
  // ════════════════════════════════════════════════════════════════════════
  window.openAnnonceStudio = async function (postId) {
    const p = (window.DB?.posts || []).find((x) => x.id === postId);
    if (!p) { toast('Annonce introuvable', 'e'); return; }
    if (!p.reference) { p.reference = genRef(p); }

    openMo('Studio annonce',
      `<div style="padding:42px 10px;text-align:center;color:var(--mu)">
         <div style="font-size:13px;margin-bottom:6px">Rédaction de l'annonce…</div>
         <div style="font-size:11px;opacity:.7">Site Novalem · Indeed · France Travail · conformité</div>
         <div class="as-spin" style="margin:18px auto 0"></div>
       </div>
       <style>.as-spin{width:26px;height:26px;border:3px solid var(--s4,#333);border-top-color:var(--ac,#c8e040);border-radius:50%;animation:asrot .8s linear infinite}@keyframes asrot{to{transform:rotate(360deg)}}</style>`,
      '');

    try {
      const g = await generateAnnonceAI(p);
      if (!g) { closeMo(); return; }
      _studio = Object.assign({ postId }, g, { _active: 'site', _edited: {} });

      // Pré-remplit l'annonce CRM avec la sortie publique propre
      p.reference     = g.ref;
      p.title         = g.public_title;
      p.contract_type = g.contract_type;
      p.experience    = g.experience;
      p.location      = g.location || p.location;
      p.salary        = g.salary.display;
      p.salary_min    = g.salary.min;
      p.salary_max    = g.salary.max;
      p.salary_est    = g.salary.estimated;
      p.skills        = g.skills;
      p.body          = g.site_md;                 // version site (anonymisée)
      p.out_indeed    = g.indeed;
      p.out_ft        = g.france_travail;
      p.internal_note = g.internal_note;
      p.jcmo_issues   = g.legal;
      p.jcmo_ok       = g.legal.filter((i) => i.startsWith('⛔')).length === 0;
      p.gen_at        = _now();
      p.updated       = _now();
      if (window.save) save();

      renderStudio('site');
    } catch (err) {
      openMo('Studio annonce',
        `<div style="padding:24px;color:var(--red,#e66);font-size:12px">Erreur IA : ${_esc(err.message)}</div>`,
        `<button class="btn bg" onclick="closeMo()">Fermer</button>
         <button class="btn bp" onclick="openAnnonceStudio('${postId}')">Réessayer</button>`);
    }
  };

  // Sauvegarde l'édition de l'onglet courant
  function captureEdit() {
    if (!_studio) return;
    const a = _studio._active;
    const body = $('as-body'); const t1 = $('as-f1'); const sk = $('as-sk');
    if (a === 'site' && body) { _studio.site_md = body.value; }
    if (a === 'indeed') {
      _studio.indeed = _studio.indeed || {};
      ['titre', 'contrat', 'lieu', 'salaire'].forEach((f) => { const el = $('as-i-' + f); if (el) _studio.indeed[f] = el.value; });
      if (body) _studio.indeed.description = body.value;
      if (sk) _studio.indeed.competences = sk.value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (a === 'ft') {
      _studio.france_travail = _studio.france_travail || {};
      ['intitule', 'contrat', 'lieu', 'duree_hebdo', 'salaire', 'experience', 'mentions'].forEach((f) => { const el = $('as-ft-' + f); if (el) _studio.france_travail[f] = el.value; });
      if (body) _studio.france_travail.description = body.value;
    }
  }

  function fieldRow(label, id, val, hint) {
    return `<div class="as-field">
      <div class="as-fl"><span>${_esc(label)}</span><button class="as-cp" onclick="_asCopyVal('${id}')">copier</button></div>
      <input id="${id}" class="as-inp" value="${_esc(val || '')}" placeholder="${_esc(hint || '')}">
    </div>`;
  }

  function renderStudio(active) {
    if (!_studio) return;
    captureEdit();
    _studio._active = active;
    const p = (window.DB?.posts || []).find((x) => x.id === _studio.postId) || {};
    const tabs = [
      { id: 'site',   label: 'Site Novalem',  tip: 'Version publiée sur ton site (anonymisée). Bouton « Publier sur le site » ci-dessous.' },
      { id: 'indeed', label: 'Indeed',        tip: 'Recopie chaque champ dans le formulaire Indeed (3 annonces gratuites/mois).' },
      { id: 'ft',     label: 'France Travail',tip: 'Recopie chaque champ dans entreprise.francetravail.fr (dépôt gratuit).' },
      { id: 'check',  label: 'Conformité',    tip: 'Vérifs légales + note interne (jamais publiée).' },
    ];
    const tabBar = tabs.map((t) => `<div onclick="_asTab('${t.id}')" class="as-tab ${active === t.id ? 'on' : ''}">${t.label}</div>`).join('');
    const tip = tabs.find((t) => t.id === active)?.tip || '';

    const dq = _studio.legal || [];
    const blockers = dq.filter((i) => i.startsWith('⛔'));
    const legalHtml = dq.length
      ? `<div class="as-legal ${blockers.length ? 'bad' : 'warn'}">${blockers.length ? '⛔ À corriger avant publication :' : '⚠️ À surveiller :'} ${dq.map(_esc).join(' · ')}</div>`
      : `<div class="as-legal ok">✓ Conforme — aucune mention problématique détectée</div>`;

    let bodyHtml = '';
    if (active === 'site') {
      const est = _studio.salary?.estimated ? ` <span class="as-pill">fourchette estimée</span>` : '';
      bodyHtml = `
        <div class="as-meta">
          <span class="tag ${catCls(p.cat)}">${_esc(catLabel(p.cat))}</span>
          <span class="as-chip">${_esc(_studio.public_title)}</span>
          <span class="as-chip">${_esc(_studio.contract_type)}</span>
          <span class="as-chip">${_esc(_studio.location)}</span>
          <span class="as-chip">${_esc(_studio.salary?.display || '—')}${est}</span>
        </div>
        <div class="as-twocol">
          <div>
            <div class="as-fl"><span>Texte du site (markdown — éditable)</span><button class="as-cp" onclick="_asCopyVal('as-body')">copier</button></div>
            <textarea id="as-body" class="as-ta">${_esc(_studio.site_md)}</textarea>
          </div>
          <div class="as-prev"><div class="as-prev-h">Aperçu</div><div class="as-prev-b">${mdToHtml(_studio.site_md)}</div></div>
        </div>`;
    } else if (active === 'indeed') {
      const i = _studio.indeed || {};
      bodyHtml = `
        ${fieldRow('Titre du poste', 'as-i-titre', i.titre, 'Conducteur de travaux GO H/F — Lyon')}
        ${fieldRow('Type de contrat', 'as-i-contrat', i.contrat, 'CDI')}
        ${fieldRow('Lieu', 'as-i-lieu', i.lieu, 'Lyon (69)')}
        ${fieldRow('Salaire', 'as-i-salaire', i.salaire, '38 000 – 45 000 € brut/an')}
        <div class="as-field">
          <div class="as-fl"><span>Description</span><button class="as-cp" onclick="_asCopyVal('as-body')">copier</button></div>
          <textarea id="as-body" class="as-ta">${_esc(i.description || '')}</textarea>
        </div>
        <div class="as-field">
          <div class="as-fl"><span>Compétences (tags, séparés par des virgules)</span><button class="as-cp" onclick="_asCopyVal('as-sk')">copier</button></div>
          <input id="as-sk" class="as-inp" value="${_esc((i.competences || _studio.skills || []).join(', '))}">
        </div>`;
    } else if (active === 'ft') {
      const f = _studio.france_travail || {};
      bodyHtml = `
        ${fieldRow('Intitulé du poste', 'as-ft-intitule', f.intitule, 'Conducteur de travaux H/F')}
        ${fieldRow('Type de contrat', 'as-ft-contrat', f.contrat, 'CDI')}
        ${fieldRow('Lieu de travail', 'as-ft-lieu', f.lieu, 'Lyon (69)')}
        ${fieldRow('Durée hebdomadaire', 'as-ft-duree_hebdo', f.duree_hebdo, '35h')}
        ${fieldRow('Salaire', 'as-ft-salaire', f.salaire, '38 000 – 45 000 € brut/an')}
        ${fieldRow('Expérience exigée', 'as-ft-experience', f.experience, '3 à 5 ans')}
        <div class="as-field">
          <div class="as-fl"><span>Descriptif de l'offre</span><button class="as-cp" onclick="_asCopyVal('as-body')">copier</button></div>
          <textarea id="as-body" class="as-ta">${_esc(f.description || '')}</textarea>
        </div>
        ${fieldRow('Mentions / conformité', 'as-ft-mentions', f.mentions, 'Poste ouvert à toutes et tous (H/F).')}`;
    } else { // check
      bodyHtml = `
        ${legalHtml}
        <div class="as-fl" style="margin-top:10px"><span>Note interne (cabinet — jamais publiée)</span></div>
        <div class="notebox" style="white-space:pre-wrap">${_esc(_studio.internal_note || '—')}</div>
        <div class="as-fl" style="margin-top:10px"><span>Salaire retenu</span></div>
        <div class="notebox">${_esc(_studio.salary?.display || '—')}${_studio.salary?.note ? ' — ' + _esc(_studio.salary.note) : ''}</div>`;
    }

    const liveBadge = p.live_on_site
      ? `<span class="as-live on">● En ligne sur le site</span>`
      : `<span class="as-live">○ Pas encore sur le site</span>`;

    openMo(`Studio — ${_esc(p.title || '')}`,
      `<div class="as-top">${liveBadge}<span class="as-ref">${_esc(p.reference || '')}</span>${p.fictive ? '<span class="as-vivier">Vivier</span>' : ''}</div>
       <div class="as-tabs">${tabBar}</div>
       <div class="as-tip">${_esc(tip)}</div>
       ${active !== 'check' ? legalHtml : ''}
       ${bodyHtml}
       <style>
         .as-top{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
         .as-live{font-size:10px;color:var(--mu)} .as-live.on{color:var(--green,#3dd49a)}
         .as-ref{font-size:10px;color:var(--mu);font-family:'DM Mono',monospace;margin-left:auto}
         .as-vivier{font-size:9px;color:var(--ac6,#b48bff);background:rgba(154,74,224,.14);border:1px solid rgba(154,74,224,.3);padding:1px 6px;border-radius:10px}
         .as-tabs{display:flex;gap:4px;background:var(--s2,#1a1a1a);border:1px solid var(--bd,#333);border-radius:6px;padding:3px;margin-bottom:8px}
         .as-tab{flex:1;text-align:center;padding:7px 6px;font-size:11px;border-radius:4px;cursor:pointer;color:var(--mu);font-weight:600}
         .as-tab.on{background:var(--s1,#0e0e0e);color:var(--tx,#eee);box-shadow:0 1px 3px rgba(0,0,0,.4)}
         .as-tip{font-size:10px;color:var(--mu);margin-bottom:8px}
         .as-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
         .as-chip{font-size:10px;color:var(--tx);background:var(--s2,#1a1a1a);border:1px solid var(--bd,#333);border-radius:10px;padding:2px 9px}
         .as-pill{font-size:9px;color:var(--orange,#e0a040);background:var(--orange-dim,rgba(224,160,64,.12));border-radius:8px;padding:1px 6px;margin-left:4px}
         .as-twocol{display:grid;grid-template-columns:1fr 1fr;gap:10px}
         @media(max-width:760px){.as-twocol{grid-template-columns:1fr}}
         .as-prev{background:var(--s2,#1a1a1a);border:1px solid var(--bd,#333);border-radius:6px;overflow:hidden}
         .as-prev-h{font-size:10px;color:var(--mu);padding:6px 10px;border-bottom:1px solid var(--bd,#333);background:var(--s3,#161616)}
         .as-prev-b{padding:10px 12px;font-size:12px;line-height:1.6;max-height:340px;overflow:auto}
         .as-field{margin-bottom:8px}
         .as-fl{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--mu);margin-bottom:3px}
         .as-cp{font-size:9px;color:var(--ac6,#b48bff);background:none;border:1px solid var(--bd2,#3a3a3a);border-radius:4px;padding:1px 7px;cursor:pointer}
         .as-cp:hover{border-color:var(--ac6,#b48bff)}
         .as-inp{width:100%;background:var(--s2,#1a1a1a);border:1px solid var(--bd2,#3a3a3a);border-radius:5px;color:var(--tx,#eee);padding:7px 9px;font-size:12px}
         .as-ta{width:100%;min-height:300px;background:var(--s2,#1a1a1a);border:1px solid var(--bd2,#3a3a3a);border-radius:5px;color:var(--tx,#eee);padding:9px;font-size:11px;line-height:1.6;font-family:'DM Mono',monospace}
         .as-legal{font-size:10px;border-radius:5px;padding:6px 9px;margin-bottom:8px}
         .as-legal.ok{color:var(--green,#3dd49a);background:var(--green-dim,rgba(61,212,154,.1));border:1px solid var(--green-border,rgba(61,212,154,.3))}
         .as-legal.warn{color:var(--orange,#e0a040);background:var(--orange-dim,rgba(224,160,64,.1));border:1px solid var(--orange-border,rgba(224,160,64,.3))}
         .as-legal.bad{color:var(--red,#e66);background:rgba(230,90,90,.1);border:1px solid rgba(230,90,90,.35)}
       </style>`,
      `<button class="btn bg" onclick="closeMo()">Fermer</button>
       <button class="btn bg bsm" onclick="_asSaveDraft()">Enregistrer</button>
       <button class="btn bi bsm" onclick="openAnnonceStudio('${p.id}')">↻ Régénérer</button>
       ${p.live_on_site
          ? `<button class="btn bd_ bsm" onclick="unpublishFromSite('${p.id}')">Retirer du site</button>`
          : `<button class="btn bp" onclick="publishToSite('${p.id}')">Publier sur le site</button>`}`
    );
  }

  window._asTab = function (id) { renderStudio(id); };

  window._asCopyVal = function (id) {
    const el = $(id); if (!el) return;
    navigator.clipboard.writeText(el.value || '').then(() => toast('Copié ✓', 'i'));
  };

  window._asSaveDraft = function () {
    if (!_studio) return;
    captureEdit();
    const p = (window.DB?.posts || []).find((x) => x.id === _studio.postId); if (!p) return;
    p.body = _studio.site_md; p.out_indeed = _studio.indeed; p.out_ft = _studio.france_travail;
    p.title = _studio.public_title; p.salary = _studio.salary?.display || p.salary;
    p.skills = _studio.skills; p.updated = _now();
    if (window.save) save();
    if (typeof rPosts === 'function') rPosts();
    toast('Enregistré ✓', 's');
  };

  // ════════════════════════════════════════════════════════════════════════
  // 3. PUBLICATION RÉELLE → table job_postings (le site lit cette table)
  // ════════════════════════════════════════════════════════════════════════

  // Secret de publication (X-CRM-Secret). Stocké une fois dans la config agence.
  function getPublishSecret() { return window.cfgGet ? cfgGet('crm_publish_secret', 'btp_crm_secret', '') : (localStorage.getItem('btp_crm_secret') || ''); }
  async function setPublishSecret(v) {
    try { localStorage.setItem('btp_crm_secret', v); } catch (e) {}
    if (window.saveSharedConfig) { try { await saveSharedConfig({ crm_publish_secret: v }); } catch (e) {} }
  }

  function promptSecret(retryFn) {
    openMo('Connexion site — une seule fois',
      `<div style="font-size:12px;line-height:1.7;color:var(--tx)">
         Pour publier sur ton site, le CRM a besoin du <strong>secret de publication</strong>
         (la variable <code>CRM_SECRET</code> que tu as définie dans Vercel &gt; Settings &gt; Environment Variables).
         <br><br>Colle-le ici : il sera mémorisé pour toutes tes prochaines publications.
       </div>
       <div class="fgrp ff" style="margin-top:12px"><span class="lbl">Secret CRM</span>
         <input id="pub-secret" type="password" placeholder="CRM_SECRET" value="${_esc(getPublishSecret())}" style="font-family:'DM Mono',monospace">
       </div>`,
      `<button class="btn bg" onclick="closeMo()">Annuler</button>
       <button class="btn bp" onclick="_asSaveSecret()">Enregistrer & publier</button>`);
    window._asSaveSecret = async function () {
      const v = ($('pub-secret')?.value || '').trim();
      if (!v) { toast('Secret requis', 'e'); return; }
      await setPublishSecret(v);
      closeMo();
      if (typeof retryFn === 'function') retryFn();
    };
  }

  async function jobsApi(action, payload, opts) {
    const apiBase = window.getApiBase ? getApiBase() : null;
    if (!apiBase) { toast('Mode local — déploie sur Vercel pour publier', 'w'); return { _local: true }; }
    const headers = { 'Content-Type': 'application/json' };
    if (opts?.auth) headers['X-CRM-Secret'] = getPublishSecret();
    const r = await fetch(`${apiBase}/api/jobs`, { method: 'POST', headers, body: JSON.stringify(Object.assign({ action }, payload)) });
    let data = {}; try { data = await r.json(); } catch (e) {}
    return { status: r.status, ok: r.ok, data };
  }

  window.publishToSite = async function (postId) {
    const p = (window.DB?.posts || []).find((x) => x.id === postId); if (!p) return;
    // capture éventuelle édition en cours
    if (_studio && _studio.postId === postId) { window._asSaveDraft(); }

    // garde-fou conformité
    const blockers = scanDiscrim([p.body, JSON.stringify(p.out_indeed || {}), JSON.stringify(p.out_ft || {})].join('\n'));
    if (blockers.length) {
      toast('Publication bloquée — terme(s) à risque : ' + blockers.join(', '), 'e');
      return;
    }
    if (!getPublishSecret()) { promptSecret(() => window.publishToSite(postId)); return; }

    toast('Publication sur le site…', 'i');
    const row = {
      crm_id: p.id,
      title: p.title || 'Annonce',
      location: p.location || '',
      contract_type: p.contract_type || 'CDI',
      cat: p.cat || 'go',
      salary_display: p.salary || '',
      experience: p.experience || '',
      reference: p.reference || genRef(p),
      description: mdToPlain(p.body || ''), // ← version SITE anonymisée, en texte propre (le site l'affiche en clair)
      skills: Array.isArray(p.skills) ? p.skills : [],
    };
    try {
      const res = await jobsApi('publish', { job: row }, { auth: true });
      if (res._local) return;
      if (res.status === 401) { promptSecret(() => window.publishToSite(postId)); return; }
      if (!res.ok) throw new Error(res.data?.error || `HTTP ${res.status}`);
      p.live_on_site = true;
      p.site_job_id = res.data?.job?.id || p.site_job_id || null;
      p.status = 'active';
      p.published_on = Array.from(new Set([...(p.published_on || []), 'Site Novalem']));
      p.updated = _now();
      if (window.save) save();
      if (typeof rPosts === 'function') rPosts();
      if (_studio && _studio.postId === postId) renderStudio(_studio._active || 'site');
      toast('En ligne sur le site ✓', 's');
    } catch (err) { toast('Erreur publication : ' + err.message, 'e'); }
  };

  window.unpublishFromSite = async function (postId) {
    const p = (window.DB?.posts || []).find((x) => x.id === postId); if (!p) return;
    if (!getPublishSecret()) { promptSecret(() => window.unpublishFromSite(postId)); return; }
    toast('Retrait du site…', 'i');
    try {
      const res = await jobsApi('unpublish', { job: { crm_id: p.id, id: p.site_job_id || undefined } }, { auth: true });
      if (res._local) return;
      if (res.status === 401) { promptSecret(() => window.unpublishFromSite(postId)); return; }
      if (!res.ok) throw new Error(res.data?.error || `HTTP ${res.status}`);
      p.live_on_site = false;
      p.published_on = (p.published_on || []).filter((b) => b !== 'Site Novalem');
      p.updated = _now();
      if (window.save) save();
      if (typeof rPosts === 'function') rPosts();
      if (_studio && _studio.postId === postId) renderStudio(_studio._active || 'site');
      toast('Retiré du site', 'w');
    } catch (err) { toast('Erreur : ' + err.message, 'e'); }
  };

  // ════════════════════════════════════════════════════════════════════════
  // 4. GESTIONNAIRE « EN LIGNE » — voir / nettoyer ce qui est réellement publié
  // ════════════════════════════════════════════════════════════════════════
  window.openLiveManager = async function () {
    if (!getPublishSecret()) { promptSecret(() => window.openLiveManager()); return; }
    openMo('En ligne sur le site',
      `<div style="padding:34px;text-align:center;color:var(--mu);font-size:12px">Lecture des annonces du site…</div>`, '');
    try {
      const res = await jobsApi('list_all', {}, { auth: true });
      if (res._local) { closeMo(); return; }
      if (res.status === 401) { promptSecret(() => window.openLiveManager()); return; }
      if (!res.ok) throw new Error(res.data?.error || `HTTP ${res.status}`);
      const jobs = res.data?.jobs || [];
      const live = jobs.filter((j) => j.published);
      const localIds = new Set((window.DB?.posts || []).map((p) => p.id));
      const rows = jobs.length ? jobs.map((j) => {
        const orphan = !localIds.has(j.crm_id);
        return `<div class="lm-row">
          <div style="flex:1;min-width:0">
            <div class="lm-t">${_esc(j.title)} ${j.published ? '<span class="lm-on">● en ligne</span>' : '<span class="lm-off">retirée</span>'}</div>
            <div class="lm-s">${_esc(j.location || '—')} · ${_esc(j.salary_display || '—')} · ${_esc(j.reference || '')}${orphan ? ' · <span style="color:var(--orange,#e0a040)">orpheline (plus dans le CRM)</span>' : ''}</div>
          </div>
          <button class="btn bd_ bxs" onclick="deleteLive('${_esc(j.id)}','${_esc((j.title || '').replace(/'/g, ''))}')">Supprimer</button>
        </div>`;
      }).join('') : '<div style="padding:24px;text-align:center;color:var(--mu);font-size:12px">Aucune annonce dans la table du site.</div>';
      openMo('En ligne sur le site',
        `<div style="font-size:11px;color:var(--mu);margin-bottom:10px">${live.length} annonce(s) actuellement visible(s) sur novalem-recrutement.fr. Supprime ici les annonces « orphelines » (celles qui ne sont plus dans ton CRM mais restent affichées).</div>
         <div class="lm-list">${rows}</div>
         <style>
           .lm-list{display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto}
           .lm-row{display:flex;align-items:center;gap:10px;background:var(--s2,#1a1a1a);border:1px solid var(--bd,#333);border-radius:6px;padding:9px 11px}
           .lm-t{font-size:12px;font-weight:600;color:var(--tx,#eee)}
           .lm-on{font-size:9px;color:var(--green,#3dd49a)} .lm-off{font-size:9px;color:var(--mu)}
           .lm-s{font-size:10px;color:var(--mu);margin-top:2px}
         </style>`,
        `<button class="btn bg" onclick="closeMo()">Fermer</button>`);
    } catch (err) {
      openMo('En ligne sur le site', `<div style="padding:24px;color:var(--red,#e66);font-size:12px">Erreur : ${_esc(err.message)}</div>`, `<button class="btn bg" onclick="closeMo()">Fermer</button>`);
    }
  };

  window.deleteLive = async function (jobId, title) {
    if (!confirm(`Supprimer définitivement « ${title} » du site ?`)) return;
    try {
      const res = await jobsApi('delete', { job: { id: jobId } }, { auth: true });
      if (res._local) return;
      if (!res.ok) throw new Error(res.data?.error || `HTTP ${res.status}`);
      // reflète localement si l'annonce existe encore dans le CRM
      (window.DB?.posts || []).forEach((p) => { if (p.site_job_id === jobId) { p.live_on_site = false; } });
      if (window.save) save();
      toast('Supprimée du site ✓', 's');
      window.openLiveManager();
    } catch (err) { toast('Erreur : ' + err.message, 'e'); }
  };

  // ════════════════════════════════════════════════════════════════════════
  // 5. FORMULAIRE ANNONCE (override) — modes d'entrée + champs privés + vivier
  // ════════════════════════════════════════════════════════════════════════
  window.openPostForm = function (id = null) {
    const p = id ? (window.DB?.posts || []).find((x) => x.id === id) : {};
    if (id && !p) return;
    const cats = (window.BTP_CATS || [{ id: 'go', l: 'BTP' }]);
    const catOpts = cats.map((c) => `<option value="${c.id}" ${(p.cat || 'go') === c.id ? 'selected' : ''}>${_esc(c.l)}</option>`).join('');
    const ctOpts = ['CDI', 'CDD', 'Intérim', 'Alternance'].map((c) => `<option ${(p.contract_type || 'CDI') === c ? 'selected' : ''}>${c}</option>`).join('');
    const companies = (window.DB?.companies || []);
    const coOpts = `<option value="">— Aucun / confidentiel —</option>` + companies.map((c) => `<option value="${c.id}" ${p.client_company_id === c.id ? 'selected' : ''}>${_esc(c.name)}</option>`).join('');
    const mode = p.source_mode || 'notes';

    openMo(id ? 'Modifier l\'annonce' : 'Nouvelle annonce',
      `<div class="fg">
        <div class="fgrp ff">
          <span class="lbl">Comment veux-tu partir ?</span>
          <div class="np-modes" id="np-modes">
            <label class="np-mode ${mode === 'paste' ? 'on' : ''}"><input type="radio" name="np-mode" value="paste" ${mode === 'paste' ? 'checked' : ''} onchange="_npMode('paste')"> Coller une annonce (Indeed…)</label>
            <label class="np-mode ${mode === 'notes' ? 'on' : ''}"><input type="radio" name="np-mode" value="notes" ${mode === 'notes' ? 'checked' : ''} onchange="_npMode('notes')"> Quelques notes de découverte</label>
            <label class="np-mode ${mode === 'blank' ? 'on' : ''}"><input type="radio" name="np-mode" value="blank" ${mode === 'blank' ? 'checked' : ''} onchange="_npMode('blank')"> Partir de zéro</label>
          </div>
        </div>

        <div class="fgrp ff" id="np-rawwrap">
          <span class="lbl" id="np-rawlbl">${mode === 'paste' ? 'Colle ici l\'annonce existante' : 'Notes (poste, missions, salaire évoqué, spécificités…)'}</span>
          <textarea id="np-raw" style="min-height:110px" placeholder="${mode === 'paste' ? 'Colle le texte brut de l\'annonce Indeed / France Travail…' : 'Ex : conducteur de travaux GO, chantiers logements collectifs, secteur Lyon, ~42K évoqué, véhicule, CDI'}">${_esc(p.source_raw || '')}</textarea>
        </div>

        <div class="fgrp"><span class="lbl">Poste${mode === 'paste' ? ' (laisse vide pour laisser l\'IA déduire)' : ''}</span><input id="np-title" value="${_esc(p.title || '')}" placeholder="Conducteur de travaux GO"></div>
        <div class="fgrp"><span class="lbl">Catégorie</span><select id="np-cat">${catOpts}</select></div>
        <div class="fgrp"><span class="lbl">Localisation</span><input id="np-loc" value="${_esc(p.location || '')}" placeholder="Lyon (69)"></div>
        <div class="fgrp"><span class="lbl">Type de contrat</span><select id="np-ct">${ctOpts}</select></div>
        <div class="fgrp"><span class="lbl">Expérience</span><input id="np-exp" value="${_esc(p.experience || '')}" placeholder="3 à 5 ans"></div>
        <div class="fgrp"><span class="lbl">Salaire évoqué (laisse vide = estimé marché)</span><input id="np-sal" value="${_esc(p.salary_hint || '')}" placeholder="42 000 € brut/an ou 38-45K"></div>

        <div class="np-sep">Confidentiel — visible cabinet uniquement, jamais publié</div>
        <div class="fgrp"><span class="lbl">Client / entreprise</span><select id="np-co">${coOpts}</select></div>
        <div class="fgrp ff"><span class="lbl">Ou nom libre du client</span><input id="np-cofree" value="${_esc(p.client_company || '')}" placeholder="Nom de l'entreprise (si pas dans la liste)"></div>
        <div class="fgrp ff"><span class="lbl">Pourquoi ce mandat / notes internes</span><textarea id="np-why" style="min-height:50px" placeholder="Contexte, contact, raison de la prise de mandat…">${_esc(p.why_applied || '')}</textarea></div>

        <label class="np-fic ${p.fictive ? 'on' : ''}" id="np-ficwrap">
          <input type="checkbox" id="np-fic" ${p.fictive ? 'checked' : ''} onchange="document.getElementById('np-ficwrap').classList.toggle('on',this.checked)">
          <span><strong>Annonce vivier (fictive)</strong> — pas de client réel derrière. L'IA peut ajouter des détails réalistes pour garder une CVthèque active. Présentée comme un poste que Novalem recrute régulièrement.</span>
        </label>
      </div>
      <style>
        .np-modes{display:flex;flex-direction:column;gap:5px;margin-top:4px}
        .np-mode{display:flex;gap:7px;align-items:flex-start;font-size:11px;text-transform:none;cursor:pointer;background:var(--s2,#1a1a1a);border:1px solid var(--bd,#333);border-radius:6px;padding:8px 10px}
        .np-mode.on{border-color:var(--ac,#c8e040);background:rgba(200,224,64,.06)}
        .np-mode input{accent-color:var(--ac,#c8e040);margin-top:1px}
        .np-sep{font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);margin:14px 0 2px;padding-top:10px;border-top:1px dashed var(--bd2,#3a3a3a)}
        .np-fic{display:flex;gap:8px;align-items:flex-start;font-size:11px;text-transform:none;cursor:pointer;background:var(--s2,#1a1a1a);border:1px solid var(--bd,#333);border-radius:6px;padding:9px 11px;margin-top:12px;line-height:1.5}
        .np-fic.on{border-color:var(--ac6,#b48bff);background:rgba(154,74,224,.07)}
        .np-fic input{accent-color:var(--ac6,#b48bff);margin-top:2px}
      </style>`,
      `<button class="btn bg" onclick="closeMo()">Annuler</button>
       ${id ? `<button class="btn bd_" onclick="delPost('${id}')">Supprimer</button>` : ''}
       <button class="btn bg" onclick="savePostForm('${id || ''}',false)">Enregistrer</button>
       ${window.aiReady && aiReady() ? `<button class="btn bp" onclick="savePostForm('${id || ''}',true)">Enregistrer & générer ✨</button>` : ''}`
    );
  };

  window._npMode = function (m) {
    document.querySelectorAll('#np-modes .np-mode').forEach((el) => el.classList.toggle('on', el.querySelector('input').value === m));
    const lbl = $('np-rawlbl'); const raw = $('np-raw'); const wrap = $('np-rawwrap');
    if (wrap) wrap.style.display = m === 'blank' ? 'none' : '';
    if (lbl) lbl.textContent = m === 'paste' ? 'Colle ici l\'annonce existante' : 'Notes (poste, missions, salaire évoqué, spécificités…)';
    if (raw) raw.placeholder = m === 'paste' ? 'Colle le texte brut de l\'annonce Indeed / France Travail…' : 'Ex : conducteur de travaux GO, chantiers logements, secteur Lyon, ~42K évoqué, véhicule, CDI';
  };

  window.savePostForm = function (id, thenGenerate) {
    const mode = (document.querySelector('input[name="np-mode"]:checked')?.value) || 'notes';
    const title = ($('np-title')?.value || '').trim();
    const raw = ($('np-raw')?.value || '').trim();
    const fictive = !!$('np-fic')?.checked;
    if (!title && mode !== 'paste') { toast('Indique au moins le poste', 'e'); return; }
    if (mode === 'paste' && !raw && !title) { toast('Colle une annonce ou indique le poste', 'e'); return; }

    const coId = $('np-co')?.value || '';
    const coFree = ($('np-cofree')?.value || '').trim();
    const data = {
      title,
      cat: $('np-cat')?.value || 'go',
      location: ($('np-loc')?.value || '').trim(),
      contract_type: $('np-ct')?.value || 'CDI',
      experience: ($('np-exp')?.value || '').trim(),
      salary_hint: ($('np-sal')?.value || '').trim(),
      source_mode: mode,
      source_raw: mode === 'blank' ? '' : raw,
      fictive,
      client_company_id: coId || null,
      client_company: coFree || (coId ? companyName(coId) : ''),
      why_applied: ($('np-why')?.value || '').trim(),
      boards: ['Site Novalem', 'Indeed', 'France Travail'],
      updated: _now(),
    };
    let pid = id;
    if (id) {
      const p = (window.DB?.posts || []).find((x) => x.id === id);
      Object.assign(p, data);
      if (!p.reference) p.reference = genRef(p);
      if (!p.status) p.status = 'draft';
    } else {
      data.id = _uid();
      data.created = _now();
      data.status = 'draft';
      data.reference = genRef(data);
      data.live_on_site = false;
      (window.DB?.posts || []).unshift(data);
      pid = data.id;
    }
    if (window.save) save();
    closeMo();
    if (typeof rPosts === 'function') rPosts();
    if (thenGenerate) { window.openAnnonceStudio(pid); }
    else toast(id ? 'Mis à jour ✓' : 'Brouillon créé ✓', 's');
  };

  // l'ancien bouton « Générer avec IA » du formulaire pointe vers le Studio
  window.aiGeneratePost = function (id) {
    const pid = (!id || id === '__new__') ? null : id;
    if (!pid) { savePostForm('', true); return; }
    window.openAnnonceStudio(pid);
  };

  // ════════════════════════════════════════════════════════════════════════
  // 6. PANNEAU ANNONCE (override) — public + privé + statut site + actions
  // ════════════════════════════════════════════════════════════════════════
  window.openPostPanel = function (id) {
    const p = (window.DB?.posts || []).find((x) => x.id === id); if (!p) return;
    const cat = window.getCat ? getCat(p.cat) : { l: 'BTP', cls: 'tgo' };
    const live = p.live_on_site;
    const dq = p.jcmo_issues || [];
    const blockers = dq.filter((i) => i.startsWith('⛔'));

    const priv = (p.client_company || p.why_applied)
      ? `<div class="pp-priv">
           <div class="pp-priv-h">🔒 Confidentiel — cabinet uniquement</div>
           ${p.client_company ? `<div class="dr"><span class="drk">Client</span><span class="drv">${_esc(p.client_company)}</span></div>` : ''}
           ${p.why_applied ? `<div class="dr"><span class="drk">Notes</span><span class="drv" style="text-align:right;max-width:60%">${_esc(p.why_applied)}</span></div>` : ''}
         </div>`
      : '';

    const sub = `<span class="tag ${cat.cls}">${_esc(cat.l)}</span>
       <span class="pill ${p.status === 'active' ? 'pwin' : 'pnew'}">${p.status === 'active' ? 'Active' : 'Brouillon'}</span>
       ${live ? '<span class="pill pwin">● En ligne</span>' : '<span class="pill pnew">Hors ligne</span>'}
       ${p.fictive ? '<span class="pill" style="background:rgba(154,74,224,.16);color:var(--ac6,#b48bff)">Vivier</span>' : ''}`;

    const conf = blockers.length
      ? `<span style="color:var(--red,#e66);font-size:10px">⛔ ${blockers.length} point(s) bloquant(s)</span>`
      : (dq.length ? `<span style="color:var(--orange,#e0a040);font-size:10px">⚠️ ${dq.length} à surveiller</span>` : `<span style="color:var(--green,#3dd49a);font-size:10px">✓ conforme</span>`);

    window.setPanel(p.title, sub, null,
      `${priv}
       <div class="dr"><span class="drk">Référence</span><span class="drv" style="font-family:'DM Mono',monospace">${_esc(p.reference || '—')}</span></div>
       <div class="dr"><span class="drk">Localisation</span><span class="drv">${_esc(p.location || '—')}</span></div>
       <div class="dr"><span class="drk">Contrat</span><span class="drv">${_esc(p.contract_type || '—')}</span></div>
       <div class="dr"><span class="drk">Salaire</span><span class="drv">${_esc(p.salary || '—')}${p.salary_est ? ' <span class="mu_ fs10">(estimé)</span>' : ''}</span></div>
       <div class="dr"><span class="drk">Conformité</span><span class="drv">${conf}</span></div>
       ${(p.skills || []).length ? `<div class="sl">Compétences</div><div class="flex fg5 fw">${p.skills.map((s) => `<span class="tag" style="background:var(--s3,#161616)">${_esc(s)}</span>`).join('')}</div>` : ''}
       <div class="sl mt12">Texte site (anonymisé)</div>
       <div class="notebox" style="max-height:220px;overflow:auto">${mdToHtml(p.body || '')}</div>
       <style>
         .pp-priv{background:rgba(154,74,224,.06);border:1px solid rgba(154,74,224,.25);border-radius:6px;padding:8px 11px;margin-bottom:10px}
         .pp-priv-h{font-size:10px;color:var(--ac6,#b48bff);margin-bottom:4px;font-weight:600}
       </style>`,
      `<button class="btn bp bsm" onclick="openAnnonceStudio('${id}')">✨ Studio (Site / Indeed / FT)</button>
       ${live
          ? `<button class="btn bd_ bsm" onclick="unpublishFromSite('${id}')">Retirer du site</button>`
          : `<button class="btn bp bsm" onclick="publishToSite('${id}')">Publier sur le site</button>`}
       <button class="btn bg bsm" onclick="openPostForm('${id}')">✎ Modifier</button>
       <button class="btn bg bsm" onclick="togPostSt('${id}')">${p.status === 'active' ? '⏸ Clôturer' : '▶ Activer'}</button>
       <button class="btn bd_ bsm" onclick="delPost('${id}')">🗑 Supprimer</button>`
    );
  };

  // Suppression : retire AUSSI du site (job_postings)
  window.delPost = async function (id) {
    const p = (window.DB?.posts || []).find((x) => x.id === id); if (!p) return;
    if (!confirm(`Supprimer l'annonce « ${p.title || ''} » ?${p.live_on_site ? '\n(Elle sera aussi retirée du site.)' : ''}`)) return;
    if (p.live_on_site && getPublishSecret()) {
      try { await jobsApi('delete', { job: { crm_id: p.id, id: p.site_job_id || undefined } }, { auth: true }); } catch (e) {}
    }
    if (window.DB) DB.posts = (DB.posts || []).filter((x) => x.id !== id);
    if (window.save) save();
    if (typeof closePanel === 'function') closePanel();
    if (typeof rPosts === 'function') rPosts();
    toast('Supprimée' + (p.live_on_site ? ' (CRM + site)' : ''), 'w');
  };

  // Clôturer = retire du site ; activer = simple statut
  window.togPostSt = function (id) {
    const p = (window.DB?.posts || []).find((x) => x.id === id); if (!p) return;
    if (p.status === 'active') {
      p.status = 'closed';
      if (p.live_on_site) { window.unpublishFromSite(id); }
    } else {
      p.status = 'active';
    }
    p.updated = _now();
    if (window.save) save();
    if (typeof rPosts === 'function') rPosts();
    window.openPostPanel(id);
    toast(p.status === 'active' ? 'Activée' : 'Clôturée', 's');
  };

  window.genBoardTexts = function (id) { window.openAnnonceStudio(id); };

  // ════════════════════════════════════════════════════════════════════════
  // 7. BESOINS → ANNONCES (avec interrupteur public / privé)
  // ════════════════════════════════════════════════════════════════════════
  function needSalary(n) {
    const a = (n.smin || '').toString().trim(); const b = (n.smax || '').toString().trim();
    if (a && b) return `${a} – ${b}`;
    if (a) return `À partir de ${a}`;
    if (b) return `Jusqu'à ${b}`;
    return '';
  }

  window.openNeedsToAnnonces = function () {
    const DONE = ['won', 'lost', 'closed', 'pourvu', 'placed'];
    const needs = (window.DB?.needs || []).filter((n) => !DONE.includes(n.status));
    const body = needs.length ? needs.map((n) => {
      const pub = n.publishable !== false;
      const sal = needSalary(n);
      const linked = (window.DB?.posts || []).some((p) => p.from_need === n.id);
      return `<div class="ntoa-row">
        <div style="flex:1;min-width:0">
          <div class="ntoa-t">${_esc(n.title || 'Besoin')}</div>
          <div class="ntoa-sub">${_esc(companyName(n.company_id) || '—')} · ${_esc(n.location || '—')}${sal ? ' · ' + _esc(sal) + ' € brut/an' : ''}</div>
        </div>
        <label class="ntoa-tog"><input type="checkbox" ${pub ? 'checked' : ''} onchange="_ntoaTogglePub('${n.id}',this.checked)"><span>${pub ? 'Public' : 'Privé'}</span></label>
        ${linked ? `<span class="tag" style="color:var(--green,#3dd49a)">Annonce créée</span>`
                 : `<button class="btn bp bsm" ${pub ? '' : 'disabled style="opacity:.4"'} onclick="_ntoaCreate('${n.id}')">→ Créer l'annonce</button>`}
      </div>`;
    }).join('') : `<div style="padding:28px;text-align:center;color:var(--mu);font-size:12px">Aucun besoin ouvert.</div>`;

    openMo('Publier depuis un besoin client',
      `<div style="font-size:11px;color:var(--mu);margin-bottom:10px">Les besoins en <strong>Privé</strong> restent en sourcing direct et ne sont jamais diffusés.</div>
       <div class="ntoa-list">${body}</div>
       <style>
         .ntoa-list{display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto}
         .ntoa-row{display:flex;align-items:center;gap:10px;background:var(--s2,#1a1a1a);border:1px solid var(--bd,#333);border-radius:6px;padding:9px 11px}
         .ntoa-t{font-size:12px;font-weight:600;color:var(--tx,#eee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
         .ntoa-sub{font-size:10px;color:var(--mu);margin-top:2px}
         .ntoa-tog{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--mu);cursor:pointer;white-space:nowrap}
         .ntoa-tog input{accent-color:var(--ac,#c8e040)}
       </style>`,
      `<button class="btn bg" onclick="closeMo()">Fermer</button>`);
  };

  window._ntoaTogglePub = function (needId, val) {
    const n = (window.DB?.needs || []).find((x) => x.id === needId); if (!n) return;
    n.publishable = val; n.updated = _now(); if (window.save) save();
    window.openNeedsToAnnonces();
  };

  window._ntoaCreate = function (needId) {
    const n = (window.DB?.needs || []).find((x) => x.id === needId); if (!n) { toast('Besoin introuvable', 'e'); return; }
    if (n.publishable === false) { toast('Ce besoin est en Privé', 'w'); return; }
    const sal = needSalary(n);
    const post = {
      id: _uid(),
      title: n.title || 'Annonce',
      cat: n.cat || 'go',
      location: n.location || '',
      contract_type: 'CDI',
      experience: '',
      salary_hint: sal ? sal + ' € brut/an' : '',
      source_mode: 'notes',
      source_raw: (n.notes || '').trim(),
      fictive: false,
      client_company_id: n.company_id || null,
      client_company: companyName(n.company_id) || '',
      why_applied: n.notes || '',
      boards: ['Site Novalem', 'Indeed', 'France Travail'],
      status: 'draft',
      from_need: n.id,
      reference: '',
      live_on_site: false,
      created: _now(), updated: _now(),
    };
    post.reference = genRef(post);
    (window.DB?.posts || []).unshift(post);
    if (window.save) save();
    closeMo();
    if (typeof rPosts === 'function') rPosts();
    toast('Annonce créée — génération en cours', 's');
    window.openAnnonceStudio(post.id);
  };

  // ════════════════════════════════════════════════════════════════════════
  // 8. LISTE DES ANNONCES (override) — badge « en ligne » + barre d'outils
  // ════════════════════════════════════════════════════════════════════════
  window.rPosts = function () {
    const host = $('view-posts'); if (!host) return;
    const posts = (window.DB?.posts || []);
    const cards = posts.length ? `<div class="g3">${posts.map((p) => {
      const cat = window.getCat ? getCat(p.cat) : { l: 'BTP', cls: 'tgo' };
      return `<div class="prcard" onclick="openPostPanel('${p.id}')">
        <div class="flex fjb fac mb4"><div class="prcard-n">${_esc(p.title)}</div>
          ${p.live_on_site ? '<span class="pill pwin">● En ligne</span>' : `<span class="pill ${p.status === 'active' ? 'pwin' : 'pnew'}">${p.status === 'active' ? 'Active' : 'Brouillon'}</span>`}
        </div>
        <div class="prcard-m"><span class="tag ${cat.cls}">${_esc(cat.l)}</span>${p.fictive ? ' <span class="tag" style="background:rgba(154,74,224,.16);color:var(--ac6,#b48bff)">vivier</span>' : ''}<br>${_esc(p.location || '—')} · ${_esc(p.salary || '—')}</div>
        <div class="fs10 mu_ mt8">${_esc(p.reference || '')} · ${p.client_company ? _esc(p.client_company) : (p.fictive ? 'vivier' : 'client confidentiel')}</div>
      </div>`;
    }).join('')}</div>` : '<div class="empty">Aucune annonce — <button class="btn bp bxs" onclick="openPostForm()">+ Créer</button></div>';

    host.innerHTML = `<div id="annonces-pro-bar" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn bp bsm" onclick="openPostForm()">+ Nouvelle annonce</button>
        <button class="btn bg bsm" onclick="openNeedsToAnnonces()">📋 Depuis un besoin</button>
        <button class="btn bg bsm" onclick="openLiveManager()">🌐 En ligne sur le site</button>
      </div>${cards}`;
  };

  console.log('[Novalem] Annonces Pro v3 chargé ✓');
})();
