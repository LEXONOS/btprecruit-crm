/* ════════════════════════════════════════════════════════════════════════
   NOVALEM — Annonces Pro  (module drop-in, additif)
   ────────────────────────────────────────────────────────────────────────
   À inclure APRÈS crm-app.js dans crm.html :
       <script src="js/crm-app.js"></script>
       <script src="js/novalem-annonces-pro.js"></script>   ← ajouter cette ligne

   Ce module n'écrase aucune fonction cœur. Il ajoute :
     1. Un Studio IA multi-plateforme : depuis une annonce, génère 3 versions
        adaptées (Site Novalem / Indeed / France Travail) au format propre de
        chaque plateforme, prêtes au copier-coller manuel.
     2. Une passerelle Besoins → Annonces : transforme un besoin client en
        annonce, avec un interrupteur "publique / garder privé" par besoin.
     3. Remplace le bouton "Textes adaptés" (genBoardTexts) par le Studio IA.
   Réutilise tes helpers existants : openMo, closeMo, toast, esc, uid, now_,
   save, getApiKey, getCat, getApiBase, DB.posts, DB.needs, DB.companies.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const MODEL = 'claude-sonnet-4-6';        // même modèle que aiGeneratePost
  let _studio = null;                        // versions générées en mémoire

  // ── Helpers locaux ──────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const companyName = (id) =>
    (window.DB?.companies || []).find((c) => c.id === id)?.name || '';

  function needSalary(n) {
    const a = (n.smin || '').toString().trim();
    const b = (n.smax || '').toString().trim();
    if (a && b) return `${a} – ${b} € brut/an`;
    if (a) return `À partir de ${a} € brut/an`;
    if (b) return `Jusqu'à ${b} € brut/an`;
    return '';
  }

  function catLabel(catVal) {
    try { return (window.getCat ? window.getCat(catVal) : null)?.l || 'BTP'; }
    catch (e) { return 'BTP'; }
  }

  // Parse JSON robuste (même logique que l'analyse email existante)
  function parseAiJson(txt) {
    if (!txt) return null;
    try { return JSON.parse(txt.replace(/```json|```/g, '').trim()); }
    catch (e) {
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) { return null; } }
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. STUDIO IA MULTI-PLATEFORME
  // ════════════════════════════════════════════════════════════════════════
  window.openAnnonceStudio = async function (postId) {
    const p = (window.DB?.posts || []).find((x) => x.id === postId);
    if (!p) { toast('Annonce introuvable', 'e'); return; }

    const key = (window.getApiKey ? window.getApiKey() : '');
    if (!key) { toast('Clé API manquante — Paramètres', 'e'); return; }

    // Modale en chargement
    openMo(
      '✨ Studio multi-plateforme',
      `<div style="padding:40px 10px;text-align:center;color:var(--mu)">
         <div style="font-size:13px;margin-bottom:8px">Génération des 3 versions adaptées…</div>
         <div style="font-size:11px;opacity:.7">Site Novalem · Indeed · France Travail</div>
         <div class="as-spin" style="margin:18px auto 0"></div>
       </div>
       <style>
         .as-spin{width:26px;height:26px;border:3px solid var(--s4);border-top-color:var(--ac);border-radius:50%;animation:asrot .8s linear infinite}
         @keyframes asrot{to{transform:rotate(360deg)}}
       </style>`,
      ''
    );

    const prompt =
`Tu es expert en rédaction d'annonces de recrutement BTP en France.
À partir des informations ci-dessous, produis 3 versions de la MÊME annonce, chacune adaptée aux conventions de sa plateforme.

POSTE : ${p.title}
SECTEUR : ${catLabel(p.cat)}
LOCALISATION : ${p.location || 'France'}
SALAIRE : ${p.salary || 'Selon profil'}
CONTEXTE : ${p.notes_brief || p.body || 'Cabinet de recrutement Novalem (BTP)'}

Règles par plateforme :
• SITE NOVALEM : version riche et marque employeur. Présentation cabinet, missions détaillées, profil, avantages, appel à candidater. Ton professionnel et humain.
• INDEED : l'intitulé doit contenir le poste + la ville (ex "Conducteur de travaux GO H/F - Lyon"). Description concise et scannable, sections courtes (Le poste / Missions / Profil / Conditions), mots-clés métier pour la recherche. Pas de long blabla de marque employeur en intro.
• FRANCE TRAVAIL : format administratif strict. Intitulé avec H/F. Mentionne explicitement type de contrat, lieu précis, fourchette de salaire. Description structurée (Mission / Profil recherché / Conditions). AUCUNE mention discriminante (âge, "jeune", "dynamique", apparence, nationalité).

Vérifie aussi la conformité légale (non-discrimination, mentions obligatoires) et liste les problèmes éventuels.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte autour, exactement cette forme :
{"indeed_title":"...","ft_intitule":"...","site":"texte complet","indeed":"texte complet","francetravail":"texte complet","legal":["problème 1","problème 2"]}
Si aucun problème légal, "legal" doit être un tableau vide [].`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': key,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error?.message || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const txt = data.content?.find((b) => b.type === 'text')?.text || data.content?.[0]?.text || '';
      const j = parseAiJson(txt);
      if (!j || !j.site) throw new Error('Réponse IA illisible, réessayez');

      _studio = {
        postId,
        site: j.site || '',
        indeed: j.indeed || '',
        francetravail: j.francetravail || '',
        indeed_title: j.indeed_title || p.title,
        ft_intitule: j.ft_intitule || p.title,
        legal: Array.isArray(j.legal) ? j.legal : [],
      };

      // Vérif légale serveur en complément (non bloquante)
      const apiBase = window.getApiBase ? window.getApiBase() : null;
      if (apiBase) {
        try {
          const r = await fetch(`${apiBase}/api/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_offer', post: { title: p.title, body: _studio.francetravail, location: p.location, salary: p.salary, cat: p.cat } }),
          });
          const v = await r.json().catch(() => ({}));
          (v.issues || []).forEach((i) => { if (!_studio.legal.includes(i)) _studio.legal.push(i); });
        } catch (e) { /* fallback silencieux : on garde la vérif IA */ }
      }

      renderStudio('indeed');
    } catch (err) {
      openMo('✨ Studio multi-plateforme',
        `<div style="padding:24px;color:var(--red);font-size:12px">Erreur IA : ${esc(err.message)}</div>`,
        `<button class="btn bg" onclick="closeMo()">Fermer</button>`);
    }
  };

  // Rendu de la modale studio avec onglets
  function renderStudio(active) {
    if (!_studio) return;
    const p = (window.DB?.posts || []).find((x) => x.id === _studio.postId) || {};
    const tabs = [
      { id: 'indeed',        label: 'Indeed',         tip: 'Colle ce texte sur ton compte Indeed (3 annonces gratuites/mois).' },
      { id: 'francetravail', label: 'France Travail',  tip: 'Colle sur entreprise.francetravail.fr — dépôt gratuit, durée 4 à 30 j renouvelable.' },
      { id: 'site',          label: 'Site Novalem',    tip: 'Version publiée sur ton propre site (bouton ci-dessous).' },
    ];
    const txt = _studio[active] || '';
    const tip = tabs.find((t) => t.id === active)?.tip || '';
    const titleLine =
      active === 'indeed' ? `<div class="lbl">Intitulé Indeed</div><input id="as-title" class="as-inp" value="${esc(_studio.indeed_title)}">` :
      active === 'francetravail' ? `<div class="lbl">Intitulé France Travail</div><input id="as-title" class="as-inp" value="${esc(_studio.ft_intitule)}">` :
      '';

    const tabBar = tabs.map((t) => `
      <div onclick="_asTab('${t.id}')" class="as-tab ${active === t.id ? 'on' : ''}">${t.label}</div>`).join('');

    const legalHtml = _studio.legal.length
      ? `<div class="as-legal warn">⚠️ Vérif légale : ${_studio.legal.map(esc).join(' · ')}</div>`
      : `<div class="as-legal ok">✓ Conforme — aucune mention problématique détectée</div>`;

    openMo(`✨ Studio — ${esc(p.title || '')}`,
      `<div class="as-tabs">${tabBar}</div>
       <div class="as-tip">${esc(tip)}</div>
       ${legalHtml}
       ${titleLine}
       <div class="lbl" style="margin-top:8px">Texte de l'annonce</div>
       <textarea id="as-body" class="as-ta">${esc(txt)}</textarea>
       <style>
         .as-tabs{display:flex;gap:4px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;padding:3px;margin-bottom:8px}
         .as-tab{flex:1;text-align:center;padding:7px 6px;font-size:11px;border-radius:4px;cursor:pointer;color:var(--mu);font-weight:600;transition:.12s}
         .as-tab.on{background:var(--s1);color:var(--tx);box-shadow:0 1px 3px rgba(0,0,0,.35)}
         .as-tab:hover:not(.on){color:var(--tx)}
         .as-tip{font-size:10px;color:var(--mu);margin-bottom:8px}
         .as-legal{font-size:10px;border-radius:5px;padding:6px 9px;margin-bottom:8px}
         .as-legal.ok{color:var(--green);background:var(--green-dim);border:1px solid var(--green-border)}
         .as-legal.warn{color:var(--orange);background:var(--orange-dim);border:1px solid var(--orange-border)}
         .as-inp{width:100%;background:var(--s2);border:1px solid var(--bd2);border-radius:5px;color:var(--tx);padding:7px 9px;font-size:12px;font-family:'DM Mono',monospace}
         .as-ta{width:100%;min-height:260px;background:var(--s2);border:1px solid var(--bd2);border-radius:5px;color:var(--tx);padding:9px;font-size:11px;line-height:1.65;font-family:'DM Mono',monospace}
       </style>`,
      `<button class="btn bg" onclick="closeMo()">Fermer</button>
       <button class="btn bi" onclick="_asCopy()">📋 Copier ${active === 'site' ? 'le texte' : 'pour ' + (tabs.find(t=>t.id===active)?.label)}</button>
       <button class="btn bp" onclick="_asPublishSite()">Publier sur le site</button>`
    );
    _studio._active = active;
  }

  window._asTab = function (id) {
    // mémorise l'édition en cours avant de changer d'onglet
    if (_studio && _studio._active) {
      const ta = $('as-body'); if (ta) _studio[_studio._active] = ta.value;
      const ti = $('as-title');
      if (ti) { if (_studio._active === 'indeed') _studio.indeed_title = ti.value; if (_studio._active === 'francetravail') _studio.ft_intitule = ti.value; }
    }
    renderStudio(id);
  };

  window._asCopy = function () {
    const ta = $('as-body'); if (!ta) return;
    const ti = $('as-title');
    const full = (ti ? ti.value + '\n\n' : '') + ta.value;
    navigator.clipboard.writeText(full).then(() => toast('Copié ✓ — colle sur la plateforme', 'i'));
  };

  window._asPublishSite = function () {
    if (!_studio) return;
    const p = (window.DB?.posts || []).find((x) => x.id === _studio.postId);
    if (!p) return;
    const ta = $('as-body');
    // si on est sur l'onglet site on prend l'édition courante, sinon la version site
    p.body = (_studio._active === 'site' && ta) ? ta.value : (_studio.site || p.body);
    p.status = 'active';
    p.boards = Array.from(new Set([...(p.boards || []), 'Site Novalem']));
    p.jcmo_ok = _studio.legal.length === 0;
    p.jcmo_issues = _studio.legal.slice();
    p.updated = now_();
    save();
    closeMo();
    if (typeof rPosts === 'function') rPosts();
    if (typeof openPostPanel === 'function') openPostPanel(p.id);
    toast('Annonce publiée sur le site ✓', 's');
  };

  // ════════════════════════════════════════════════════════════════════════
  // 2. BESOINS → ANNONCES (avec interrupteur public / privé par besoin)
  // ════════════════════════════════════════════════════════════════════════
  window.openNeedsToAnnonces = function () {
    // Un besoin reste "publiable" tant qu'il n'est pas terminé. Le schéma réel
    // des statuts (cf. openNeedForm) est : open / sent / interview / won / lost.
    // On exclut les états terminaux (won = placé, lost = perdu) + les anciens
    // libellés legacy (closed / pourvu) par sécurité.
    const DONE = ['won', 'lost', 'closed', 'pourvu', 'placed'];
    const needs = (window.DB?.needs || []).filter((n) => !DONE.includes(n.status));
    const body = needs.length
      ? needs.map((n) => {
          const pub = n.publishable !== false; // public par défaut
          const sal = needSalary(n);
          const linked = (window.DB?.posts || []).some((p) => p.from_need === n.id);
          return `
          <div class="ntoa-row">
            <div style="flex:1;min-width:0">
              <div class="ntoa-t">${esc(n.title || 'Besoin')}</div>
              <div class="ntoa-sub">${esc(companyName(n.company_id) || '—')} · ${esc(n.location || '—')}${sal ? ' · ' + esc(sal) : ''}${n.urgency ? ` · <span style="color:var(--orange)">${esc(n.urgency)}</span>` : ''}</div>
            </div>
            <label class="ntoa-tog" title="Public = annonce diffusable. Privé = sourcing direct seulement.">
              <input type="checkbox" ${pub ? 'checked' : ''} onchange="_ntoaTogglePub('${n.id}',this.checked)">
              <span>${pub ? 'Public' : 'Privé'}</span>
            </label>
            ${linked
              ? `<span class="tag" style="color:var(--green);background:var(--green-dim)">Annonce créée</span>`
              : `<button class="btn bp bsm" ${pub ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'} onclick="_ntoaCreate('${n.id}')">→ Créer l'annonce</button>`}
          </div>`;
        }).join('')
      : `<div style="padding:30px;text-align:center;color:var(--mu);font-size:12px">Aucun besoin ouvert. Ajoute-en dans l'onglet Besoins.</div>`;

    openMo('📋 Publier depuis un besoin client',
      `<div style="font-size:11px;color:var(--mu);margin-bottom:10px">
         Choisis quels besoins deviennent des annonces publiques. Les besoins en
         <strong>Privé</strong> restent en sourcing direct et ne sont jamais diffusés.
       </div>
       <div class="ntoa-list">${body}</div>
       <style>
         .ntoa-list{display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto}
         .ntoa-row{display:flex;align-items:center;gap:10px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;padding:9px 11px}
         .ntoa-t{font-size:12px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
         .ntoa-sub{font-size:10px;color:var(--mu);margin-top:2px}
         .ntoa-tog{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--mu);cursor:pointer;white-space:nowrap}
         .ntoa-tog input{accent-color:var(--ac)}
       </style>`,
      `<button class="btn bg" onclick="closeMo()">Fermer</button>`
    );
  };

  window._ntoaTogglePub = function (needId, val) {
    const n = (window.DB?.needs || []).find((x) => x.id === needId);
    if (!n) return;
    n.publishable = val; n.updated = now_(); save();
    openNeedsToAnnonces(); // re-render pour activer/griser le bouton
  };

  window._ntoaCreate = function (needId) {
    const n = (window.DB?.needs || []).find((x) => x.id === needId);
    if (!n) { toast('Besoin introuvable', 'e'); return; }
    if (n.publishable === false) { toast('Ce besoin est en Privé', 'w'); return; }

    // Crée une annonce brouillon pré-remplie depuis le besoin
    const post = {
      id: uid(),
      title: n.title || 'Annonce',
      cat: n.cat || 'go',
      location: n.location || '',
      salary: needSalary(n),
      notes_brief: `Client : ${companyName(n.company_id) || 'PME BTP'}. ${n.notes || ''}`.trim(),
      body: '',
      boards: ['Site Novalem', 'Indeed', 'France Travail'],
      status: 'active',
      from_need: n.id,            // lien besoin → annonce
      created: now_(),
      updated: now_(),
    };
    DB.posts.unshift(post);
    save();
    closeMo();
    if (typeof rPosts === 'function') rPosts();
    toast('Annonce créée — génération IA en cours', 's');
    window.openAnnonceStudio(post.id); // enchaîne direct sur le Studio
  };

  // ════════════════════════════════════════════════════════════════════════
  // 3. INTÉGRATION UI : barre d'outils + remplacement de genBoardTexts
  // ════════════════════════════════════════════════════════════════════════

  // Le bouton "Textes adaptés" existant ouvre désormais le Studio IA
  window.genBoardTexts = function (id) { window.openAnnonceStudio(id); };

  // Injecte une barre d'actions en haut de l'onglet Annonces après chaque rendu
  const _rPosts = window.rPosts;
  window.rPosts = function () {
    if (typeof _rPosts === 'function') _rPosts.apply(this, arguments);
    try {
      const host = $('view-posts');
      if (!host || $('annonces-pro-bar')) return;
      const bar = document.createElement('div');
      bar.id = 'annonces-pro-bar';
      bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px';
      bar.innerHTML =
        `<button class="btn bp bsm" onclick="openNeedsToAnnonces()">📋 Publier depuis un besoin</button>
         <span class="tag" style="color:var(--purple);background:var(--purple-dim);align-self:center">
           ✨ Studio IA : ouvre une annonce → "Textes adaptés"
         </span>`;
      host.insertBefore(bar, host.firstChild);
    } catch (e) { /* no-op */ }
  };

  console.log('[Novalem] Annonces Pro chargé ✓');
})();
