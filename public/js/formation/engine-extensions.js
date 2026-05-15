/* ═══════════════════════════════════════════════════════════════
   NOVALEM ACADÉMIE — ENGINE EXTENSIONS
   ───────────────────────────────────────────────────────────────
   Quatre nouveaux types d'exercices qui transforment la pédagogie
   passive en simulation active. Chacun est enregistré auprès de
   l'API NovaAcademy.registerExerciseType().

      detective  → Inspecter un document (CV, mail, annonce) avec
                   timer, repérer les lignes suspectes en cliquant.
                   Pour les modules "lire un CV", "spotter une annonce
                   non conforme", "détecter un mail manipulateur".

      dialogue   → Négociation conversationnelle tour par tour.
                   Le client/candidat parle, le scout choisit la
                   meilleure réponse parmi 3 ou 4. Les choix
                   influencent la suite. Pour les objections, les
                   négos salariales, les débriefs.

      aligner    → Matérialise la métaphore des "planètes alignées"
                   sous forme de curseurs qu'on ajuste pour faire
                   monter un score de probabilité de match. Pour les
                   modules sur la qualification et l'évaluation.

      bison      → Quiz chronométré rapide (90-180 s, 10-30 questions).
                   Aucune seconde chance. Test de chapitre tendu.

   Chaque type doit appeler processAnswer(correct, ex) une fois
   l'utilisateur a donné sa réponse finale. Le moteur s'occupe du
   reste (explication, XP, répétition espacée).
   ═══════════════════════════════════════════════════════════════ */

(function(){
  if (!window.NovaAcademy){
    console.error('[engine-extensions] NovaAcademy n\'est pas disponible. Vérifie que formation.html charge ce fichier APRÈS le moteur.');
    return;
  }

  /* ── Utilitaires partagés ─────────────────────────────────── */
  function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ═══════════════════════════════════════════════════════════
     1. DÉTECTIVE — Inspection de document avec hotspots
     ───────────────────────────────────────────────────────────
     Spec :
       ex.context  : phrase de cadrage ("Voici un CV reçu pour…")
       ex.doc      : { title, sub, lines:[{text, suspect:bool, why:string?}, …] }
       ex.timeLimit: secondes (défaut 60)
       ex.tolerance: nombre de faux positifs tolérés (défaut 1)
       ex.explain  : explication de fond après validation
     ═══════════════════════════════════════════════════════════ */
  NovaAcademy.registerExerciseType({
    type: 'detective',
    label: 'Détective',
    render(ex){
      const doc = ex.doc || { title:'(document)', sub:'', lines:[] };
      const timeLimit = ex.timeLimit || 60;
      const totalSuspects = doc.lines.filter(l => l.suspect).length;

      /* Contexte */
      const contextHTML = ex.context
        ? `<div class="ex-scenario-ctx"><b>Situation</b>${ex.context}</div>` : '';

      /* En-tête : timer + compteur */
      const headerHTML = `
        <div class="ex-det-header">
          <div class="ex-det-header-left">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span>Repère les <b>${totalSuspects}</b> élément${totalSuspects>1?'s':''} suspect${totalSuspects>1?'s':''}</span>
          </div>
          <span class="ex-det-counter">Trouvé : <b id="det-counter">0</b>/${totalSuspects}</span>
          <span class="ex-det-timer" id="det-timer">${timeLimit}s</span>
        </div>`;

      /* Lignes cliquables */
      const linesHTML = doc.lines.map((line, i) => {
        return `<span class="ex-det-line" data-i="${i}" data-suspect="${line.suspect ? '1':'0'}" onclick="window._detToggle(${i})">${line.text}<span class="ex-det-line-why">${escapeHTML(line.why||'')}</span></span>`;
      }).join('');

      const docHTML = `
        <div class="ex-det-doc">
          <div class="ex-det-doc-title">${escapeHTML(doc.title)}</div>
          ${doc.sub ? `<div class="ex-det-doc-sub">${escapeHTML(doc.sub)}</div>` : ''}
          ${linesHTML}
        </div>`;

      const barHTML = `
        <div class="ex-bar">
          <div class="ex-bar-left">Clique sur chaque ligne qui te semble suspecte, puis valide.</div>
          <div class="ex-bar-right">
            <button class="btn-primary" onclick="window._detSubmit()">J'ai terminé</button>
          </div>
        </div>`;

      /* Boot du jeu : flagged set + timer */
      setTimeout(() => {
        window._detState = {
          flagged: new Set(),
          total: totalSuspects,
          tolerance: (typeof ex.tolerance === 'number') ? ex.tolerance : 1,
          startTs: Date.now(),
          timeLimit,
          ended: false,
        };
        /* Timer */
        const timerEl = document.getElementById('det-timer');
        if (timerEl){
          window._detState.tickInt = setInterval(() => {
            if (window._detState.ended) return clearInterval(window._detState.tickInt);
            const elapsed = Math.floor((Date.now() - window._detState.startTs)/1000);
            const remaining = Math.max(0, timeLimit - elapsed);
            timerEl.textContent = remaining + 's';
            if (remaining <= 10) timerEl.classList.add('urgent');
            if (remaining === 0){
              clearInterval(window._detState.tickInt);
              window._detSubmit();
            }
          }, 250);
        }
      }, 0);

      return `<div class="ex-det">${contextHTML}${headerHTML}${docHTML}${barHTML}</div>`;
    }
  });

  /* Toggle d'une ligne */
  window._detToggle = function(i){
    if (!window._detState || window._detState.ended) return;
    const line = document.querySelector(`.ex-det-line[data-i="${i}"]`);
    if (!line) return;
    if (window._detState.flagged.has(i)){
      window._detState.flagged.delete(i);
      line.classList.remove('flagged');
    } else {
      window._detState.flagged.add(i);
      line.classList.add('flagged');
    }
    const counter = document.getElementById('det-counter');
    if (counter){
      const hits = [...window._detState.flagged].filter(idx => {
        const l = document.querySelector(`.ex-det-line[data-i="${idx}"]`);
        return l && l.dataset.suspect === '1';
      }).length;
      counter.textContent = hits;
    }
  };

  /* Validation finale */
  window._detSubmit = function(){
    if (!window._detState || window._detState.ended) return;
    window._detState.ended = true;
    if (window._detState.tickInt) clearInterval(window._detState.tickInt);

    const ex = currentExercise();
    let hits = 0, misses = 0, missed = 0;
    document.querySelectorAll('.ex-det-line').forEach(line => {
      const i = parseInt(line.dataset.i, 10);
      const isSuspect = line.dataset.suspect === '1';
      const wasFlagged = window._detState.flagged.has(i);
      line.classList.remove('flagged');
      if (isSuspect && wasFlagged){ line.classList.add('revealed-hit'); hits++; }
      else if (!isSuspect && wasFlagged){ line.classList.add('revealed-miss'); misses++; }
      else if (isSuspect && !wasFlagged){ line.classList.add('revealed-missed'); missed++; }
    });
    /* Critère de réussite : tous les suspects trouvés + faux positifs <= tolérance */
    const correct = (hits === window._detState.total) && (misses <= window._detState.tolerance);
    /* Désactiver le bouton */
    document.querySelectorAll('.ex-det .ex-bar .btn-primary').forEach(b => { b.disabled = true; b.style.opacity = '.5'; });
    processAnswer(correct, ex);
  };

  /* ═══════════════════════════════════════════════════════════
     2. DIALOGUE (Négo live) — Conversation branching
     ───────────────────────────────────────────────────────────
     Spec :
       ex.context : cadrage ("Tu appelles un prospect…")
       ex.turns   : [
         {
           speaker: 'client'|'candidate'|'self'|'narrator',
           text   : "…",
           options: [
             { text, next:idx|'end', feedback, fb:'positive'|'negative'|'neutral', score:1 },
             …
           ]
         },
         … (4 à 8 tours)
       ]
       ex.passScore : score minimum pour valider (défaut : sum(maxScore par tour)*0.7)
     ═══════════════════════════════════════════════════════════ */
  NovaAcademy.registerExerciseType({
    type: 'dialogue',
    label: 'Négo live',
    render(ex){
      const turns = ex.turns || [];
      const totalTurns = turns.length;
      const maxScore = turns.reduce((s, t) => s + Math.max(0, ...(t.options||[]).map(o => o.score||0)), 0);
      const passScore = (typeof ex.passScore === 'number') ? ex.passScore : Math.ceil(maxScore * 0.7);

      const contextHTML = ex.context
        ? `<div class="ex-scenario-ctx"><b>Situation</b>${ex.context}</div>` : '';

      const progressDots = turns.map((_, i) =>
        `<span class="ex-dlg-progress-dot ${i===0?'current':''}" data-step="${i}"></span>`
      ).join('');

      /* Boot */
      setTimeout(() => {
        window._dlgState = {
          turns,
          pos: 0,
          score: 0,
          history: [],
          passScore,
          maxScore,
          ended: false,
        };
        window._dlgRenderCurrent();
      }, 0);

      return `<div class="ex-dlg">
        ${contextHTML}
        <div class="ex-dlg-progress" id="dlg-progress">${progressDots}</div>
        <div class="ex-dlg-thread" id="dlg-thread"></div>
      </div>`;
    }
  });

  function _dlgSpeakerLabel(s){
    if (s === 'client') return 'Le client';
    if (s === 'candidate') return 'Le candidat';
    if (s === 'self') return 'Toi';
    return 'Contexte';
  }
  function _dlgSpeakerInitials(s){
    if (s === 'client') return 'CL';
    if (s === 'candidate') return 'CA';
    if (s === 'self') return 'TU';
    return '·';
  }

  window._dlgRenderCurrent = function(){
    const st = window._dlgState;
    if (!st) return;
    const turn = st.turns[st.pos];
    if (!turn) return _dlgEnd();

    /* Met à jour les progress dots */
    document.querySelectorAll('.ex-dlg-progress-dot').forEach((d, i) => {
      d.classList.remove('current');
      if (i < st.pos) d.classList.add('done');
      else if (i === st.pos) d.classList.add('current');
    });

    const thread = document.getElementById('dlg-thread');
    if (!thread) return;

    /* Affiche la bulle de l'interlocuteur */
    const speakerClass = `speaker-${turn.speaker}`;
    const bubbleHTML = `
      <div class="ex-dlg-bubble ${speakerClass}">
        <div class="ex-dlg-bubble-avatar">${_dlgSpeakerInitials(turn.speaker)}</div>
        <div class="ex-dlg-bubble-body">
          <div class="ex-dlg-bubble-speaker">${_dlgSpeakerLabel(turn.speaker)}</div>
          <div class="ex-dlg-bubble-text">${turn.text}</div>
        </div>
      </div>`;

    /* Affiche les options */
    const optsHTML = (turn.options||[]).map((opt, i) =>
      `<button class="ex-dlg-option" onclick="window._dlgPick(${i})">
        <span class="ex-dlg-option-key">${String.fromCharCode(65+i)}</span>
        <span>${opt.text}</span>
      </button>`
    ).join('');

    thread.insertAdjacentHTML('beforeend', bubbleHTML + `<div class="ex-dlg-options" id="dlg-opts">${optsHTML}</div>`);
    window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' });
  };

  window._dlgPick = function(idx){
    const st = window._dlgState;
    if (!st || st.ended) return;
    const turn = st.turns[st.pos];
    const opt = turn.options[idx];
    if (!opt) return;

    /* Verrouille les options et marque la pickée */
    document.querySelectorAll('#dlg-opts .ex-dlg-option').forEach((b, i) => {
      b.classList.add('disabled');
      if (i === idx) b.classList.add('picked');
    });

    /* Ajoute la bulle "toi" + feedback */
    const thread = document.getElementById('dlg-thread');
    if (thread){
      thread.insertAdjacentHTML('beforeend', `
        <div class="ex-dlg-bubble speaker-self">
          <div class="ex-dlg-bubble-avatar">TU</div>
          <div class="ex-dlg-bubble-body">
            <div class="ex-dlg-bubble-speaker">Toi</div>
            <div class="ex-dlg-bubble-text">${opt.text}</div>
          </div>
        </div>
        ${opt.feedback ? `<div class="ex-dlg-feedback ${opt.fb||'neutral'}">${opt.feedback}</div>` : ''}
      `);
    }
    /* L'élément précédent <div id="dlg-opts"> ne doit plus avoir cet ID */
    const oldOpts = document.getElementById('dlg-opts');
    if (oldOpts) oldOpts.removeAttribute('id');

    st.score += (opt.score || 0);
    st.history.push({ turnIdx: st.pos, optIdx: idx, score: opt.score||0 });

    /* Avance */
    if (opt.next === 'end' || opt.next === -1){ st.pos = st.turns.length; }
    else if (typeof opt.next === 'number'){ st.pos = opt.next; }
    else { st.pos++; }

    setTimeout(() => {
      if (st.pos >= st.turns.length) _dlgEnd();
      else window._dlgRenderCurrent();
    }, 700);
  };

  function _dlgEnd(){
    const st = window._dlgState;
    if (!st || st.ended) return;
    st.ended = true;
    document.querySelectorAll('.ex-dlg-progress-dot').forEach(d => { d.classList.remove('current'); d.classList.add('done'); });
    const correct = st.score >= st.passScore;
    const ex = currentExercise();
    /* Affiche le bilan dans le thread */
    const thread = document.getElementById('dlg-thread');
    if (thread){
      thread.insertAdjacentHTML('beforeend', `
        <div class="ex-dlg-feedback ${correct?'positive':'negative'}" style="margin-top:14px">
          <b>${correct ? 'Tour de table maîtrisé.' : 'Tour de table à retravailler.'}</b> Score : ${st.score}/${st.maxScore} (seuil : ${st.passScore})
        </div>`);
    }
    processAnswer(correct, ex);
  }

  /* ═══════════════════════════════════════════════════════════
     3. ALIGNER — Curseurs d'alignement des planètes
     ───────────────────────────────────────────────────────────
     Spec :
       ex.scenario : "Le client cherche un Conducteur de travaux gros oeuvre…"
       ex.dims     : [
         {
           key, label, hint?,
           min, max, step (default 1),
           start,      // valeur initiale
           ideal,      // valeur idéale (centre de la zone OK)
           tolerance,  // demi-largeur de la zone OK (en unités du curseur)
           weight      // poids dans le score final (1 par défaut)
         },
         …
       ]
       ex.threshold : score minimum (0..100) pour valider (défaut 75)
     ═══════════════════════════════════════════════════════════ */
  NovaAcademy.registerExerciseType({
    type: 'aligner',
    label: "L'Aligneur",
    render(ex){
      const dims = ex.dims || [];
      const threshold = ex.threshold || 75;
      const scenarioHTML = ex.scenario
        ? `<div class="ex-aln-scenario"><b>Contexte</b>${ex.scenario}</div>` : '';

      const scoreHTML = `
        <div class="ex-aln-score">
          <div>
            <div class="ex-aln-score-label">Probabilité de match</div>
            <div class="ex-aln-score-val low" id="aln-score">0</div>
          </div>
          <div class="ex-aln-score-bar">
            <div class="ex-aln-score-threshold" style="left:${threshold}%"></div>
            <div class="ex-aln-score-bar-fill" id="aln-bar" style="width:0%"></div>
          </div>
          <div style="text-align:right">
            <div class="ex-aln-score-label">Seuil</div>
            <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:var(--tx)">${threshold}%</div>
          </div>
        </div>`;

      const dimsHTML = dims.map((d, i) => {
        const range = d.max - d.min;
        const idealPct = ((d.ideal - d.min) / range) * 100;
        return `<div class="ex-aln-dim" data-key="${d.key}">
          <div class="ex-aln-dim-head">
            <span class="ex-aln-dim-label">${d.label}</span>
            <span class="ex-aln-dim-val" id="aln-val-${i}">${d.start}${d.unit||''}</span>
          </div>
          <div class="ex-aln-dim-slider">
            <input type="range" min="${d.min}" max="${d.max}" step="${d.step||1}" value="${d.start}" id="aln-input-${i}" oninput="window._alnUpdate()">
            <div class="ex-aln-dim-ideal" style="left:${idealPct}%"></div>
          </div>
          ${d.hint ? `<div class="ex-aln-dim-hint"><span>${d.hint}</span><span style="opacity:.6">Cible : ${d.ideal}${d.unit||''}</span></div>` : ''}
        </div>`;
      }).join('');

      const barHTML = `
        <div class="ex-bar">
          <div class="ex-bar-left">Ajuste chaque curseur pour aligner les variables. Le repère pointillé indique la cible.</div>
          <div class="ex-bar-right">
            <button class="btn-primary" onclick="window._alnSubmit()">Valider</button>
          </div>
        </div>`;

      /* Boot */
      setTimeout(() => {
        window._alnState = { dims, threshold };
        window._alnUpdate();
      }, 0);

      return `<div class="ex-aln">${scenarioHTML}${scoreHTML}${dimsHTML}${barHTML}</div>`;
    }
  });

  window._alnUpdate = function(){
    const st = window._alnState;
    if (!st) return;
    let totalScore = 0, totalWeight = 0;
    st.dims.forEach((d, i) => {
      const input = document.getElementById('aln-input-'+i);
      const valEl = document.getElementById('aln-val-'+i);
      if (!input || !valEl) return;
      const v = parseFloat(input.value);
      valEl.textContent = v + (d.unit||'');
      const w = d.weight || 1;
      totalWeight += w;
      const dist = Math.abs(v - d.ideal);
      const tol = d.tolerance || 0;
      let dimScore;
      if (dist <= tol) dimScore = 100;
      else {
        /* Décroissance linéaire au-delà de la tolérance, jusqu'à 0 à 3× la tolérance ou la portée */
        const fade = Math.max(tol * 3, (d.max - d.min) * 0.5);
        dimScore = Math.max(0, 100 * (1 - (dist - tol) / fade));
      }
      totalScore += dimScore * w;
      if (dimScore >= 80){ valEl.classList.add('aligned'); valEl.classList.remove('off'); }
      else if (dimScore <= 30){ valEl.classList.add('off'); valEl.classList.remove('aligned'); }
      else { valEl.classList.remove('aligned','off'); }
    });
    const finalScore = totalWeight ? Math.round(totalScore / totalWeight) : 0;
    const scoreEl = document.getElementById('aln-score');
    const barEl = document.getElementById('aln-bar');
    if (scoreEl){
      scoreEl.textContent = finalScore;
      scoreEl.classList.remove('low','mid','high');
      if (finalScore >= 75) scoreEl.classList.add('high');
      else if (finalScore >= 45) scoreEl.classList.add('mid');
      else scoreEl.classList.add('low');
    }
    if (barEl) barEl.style.width = finalScore + '%';
  };

  window._alnSubmit = function(){
    const st = window._alnState;
    if (!st) return;
    const scoreEl = document.getElementById('aln-score');
    const finalScore = parseInt(scoreEl ? scoreEl.textContent : '0', 10);
    const correct = finalScore >= st.threshold;
    document.querySelectorAll('.ex-aln input[type=range]').forEach(i => i.disabled = true);
    document.querySelectorAll('.ex-aln .ex-bar .btn-primary').forEach(b => { b.disabled = true; b.style.opacity='.5'; });
    processAnswer(correct, currentExercise());
  };

  /* ═══════════════════════════════════════════════════════════
     4. BISON — Quiz chronométré rapide
     ───────────────────────────────────────────────────────────
     Spec :
       ex.intro    : { title, sub } — écran d'intro
       ex.timeLimit: durée totale en secondes (défaut 120)
       ex.passScore: nombre minimum de bonnes réponses pour valider
       ex.questions: [
         { q, options, correct }  // QCM
         { q, tf:true, answer:bool } // Vrai/Faux
       ]
     ═══════════════════════════════════════════════════════════ */
  NovaAcademy.registerExerciseType({
    type: 'bison',
    label: 'Bison',
    render(ex){
      const intro = ex.intro || { title:'Test de chapitre', sub:'Vingt questions. Pas de seconde chance. Concentre-toi.' };
      const qCount = (ex.questions||[]).length;
      const timeLimit = ex.timeLimit || 120;
      const passScore = ex.passScore || Math.ceil(qCount * 0.7);

      /* Écran d'intro avant le démarrage */
      setTimeout(() => {
        window._bsnState = {
          questions: ex.questions || [],
          pos: 0,
          correctCount: 0,
          startTs: null,
          timeLimit,
          passScore,
          ended: false,
          tickInt: null,
        };
      }, 0);

      return `<div class="ex-bsn-intro">
        <div class="ex-bsn-intro-icon">🐃</div>
        <div class="ex-bsn-intro-title">${escapeHTML(intro.title)}</div>
        <div class="ex-bsn-intro-sub">${escapeHTML(intro.sub)}</div>
        <div class="ex-bsn-intro-rules">
          <div class="ex-bsn-intro-rule"><div class="ex-bsn-intro-rule-lab">Questions</div><div class="ex-bsn-intro-rule-val">${qCount}</div></div>
          <div class="ex-bsn-intro-rule"><div class="ex-bsn-intro-rule-lab">Temps</div><div class="ex-bsn-intro-rule-val">${Math.floor(timeLimit/60)}'${String(timeLimit%60).padStart(2,'0')}</div></div>
          <div class="ex-bsn-intro-rule"><div class="ex-bsn-intro-rule-lab">Seuil</div><div class="ex-bsn-intro-rule-val">${passScore}/${qCount}</div></div>
        </div>
        <button class="btn-primary pri" onclick="window._bsnStart()" style="padding:12px 28px">Lancer<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.4;margin-left:6px"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
      </div>`;
    }
  });

  window._bsnStart = function(){
    const st = window._bsnState;
    if (!st) return;
    st.startTs = Date.now();
    st.tickInt = setInterval(() => {
      if (st.ended) return clearInterval(st.tickInt);
      const elapsed = Math.floor((Date.now() - st.startTs)/1000);
      const remaining = Math.max(0, st.timeLimit - elapsed);
      const bar = document.getElementById('bsn-timer-fill');
      const txt = document.getElementById('bsn-timer-text');
      if (bar) bar.style.width = (100 * remaining / st.timeLimit) + '%';
      if (txt){
        txt.textContent = Math.floor(remaining/60) + ':' + String(remaining%60).padStart(2,'0');
        txt.classList.toggle('urgent', remaining <= 15);
      }
      if (remaining === 0) _bsnEnd();
    }, 250);
    _bsnRenderQ();
  };

  function _bsnRenderQ(){
    const st = window._bsnState;
    if (!st) return;
    const q = st.questions[st.pos];
    if (!q) return _bsnEnd();

    const isTF = !!q.tf;
    const optsHTML = isTF
      ? `<button class="ex-bsn-q-opt" onclick="window._bsnAnswer(true)">Vrai</button>
         <button class="ex-bsn-q-opt" onclick="window._bsnAnswer(false)">Faux</button>`
      : (q.options||[]).map((o, i) =>
          `<button class="ex-bsn-q-opt" onclick="window._bsnAnswer(${i})">${escapeHTML(o)}</button>`
        ).join('');

    const optClass = isTF ? 'tf' : (q.options && q.options.length <= 2 ? 'single' : '');

    const view = document.getElementById('view-module');
    /* On remplace le contenu de .module-runner par le HTML du jeu */
    const runner = view.querySelector('.module-runner') || view;
    runner.innerHTML = `
      <div class="ex-bsn-game">
        <div class="ex-bsn-header">
          <span class="ex-bsn-pos">Question <b>${st.pos + 1}</b>/${st.questions.length}</span>
          <div class="ex-bsn-timer-wrap">
            <div class="ex-bsn-timer-bar"><div class="ex-bsn-timer-fill" id="bsn-timer-fill" style="width:100%"></div></div>
            <span class="ex-bsn-timer-text" id="bsn-timer-text">${Math.floor(st.timeLimit/60)}:${String(st.timeLimit%60).padStart(2,'0')}</span>
          </div>
          <span class="ex-bsn-score">Score <b>${st.correctCount}</b></span>
        </div>
        <div class="ex-bsn-q">
          <div class="ex-bsn-q-text">${q.q}</div>
          <div class="ex-bsn-q-opts ${optClass}">${optsHTML}</div>
        </div>
      </div>`;
  }

  window._bsnAnswer = function(val){
    const st = window._bsnState;
    if (!st || st.ended) return;
    const q = st.questions[st.pos];
    const correct = q.tf ? (val === q.answer) : (val === q.correct);
    const btns = document.querySelectorAll('.ex-bsn-q-opt');
    btns.forEach(b => b.classList.add('disabled'));
    const correctIdx = q.tf ? (q.answer ? 0 : 1) : q.correct;
    const clickedIdx = q.tf ? (val ? 0 : 1) : val;
    if (btns[clickedIdx]) btns[clickedIdx].classList.add(correct ? 'correct' : 'wrong');
    if (!correct && btns[correctIdx]) btns[correctIdx].classList.add('correct');
    if (correct) st.correctCount++;
    setTimeout(() => {
      st.pos++;
      if (st.pos >= st.questions.length) _bsnEnd();
      else _bsnRenderQ();
    }, 550);
  };

  function _bsnEnd(){
    const st = window._bsnState;
    if (!st || st.ended) return;
    st.ended = true;
    if (st.tickInt) clearInterval(st.tickInt);
    const correct = st.correctCount >= st.passScore;
    const elapsed = Math.floor((Date.now() - st.startTs)/1000);
    const pct = Math.round((st.correctCount / st.questions.length) * 100);

    let rank, rankClass;
    if (pct === 100){ rank = 'Légende'; rankClass = 'gold'; }
    else if (pct >= 90){ rank = 'Or'; rankClass = 'gold'; }
    else if (pct >= 75){ rank = 'Argent'; rankClass = 'silver'; }
    else if (pct >= 60){ rank = 'Bronze'; rankClass = 'bronze'; }
    else { rank = 'À retravailler'; rankClass = 'iron'; }

    const view = document.getElementById('view-module');
    const runner = view.querySelector('.module-runner') || view;
    runner.innerHTML = `
      <div class="ex-bsn-end">
        <div class="ex-bsn-end-rank ${rankClass}">${rank}</div>
        <div style="font-size:14px;color:var(--mu);margin-bottom:6px">${correct ? 'Test validé.' : 'Test non validé — la question reviendra.'}</div>
        <div class="ex-bsn-end-stats">
          <div class="ex-bsn-end-stat">
            <div class="ex-bsn-end-stat-val">${st.correctCount}/${st.questions.length}</div>
            <div class="ex-bsn-end-stat-lab">bonnes</div>
          </div>
          <div class="ex-bsn-end-stat">
            <div class="ex-bsn-end-stat-val">${pct}%</div>
            <div class="ex-bsn-end-stat-lab">précision</div>
          </div>
          <div class="ex-bsn-end-stat">
            <div class="ex-bsn-end-stat-val">${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}</div>
            <div class="ex-bsn-end-stat-lab">temps</div>
          </div>
        </div>
      </div>`;

    /* Comme cette extension a son propre écran final, on signale immédiatement au moteur. */
    processAnswer(correct, currentExercise());
  }

  /* ═══════════════════════════════════════════════════════════
     Sanity log
     ═══════════════════════════════════════════════════════════ */
  console.log('[engine-extensions] 4 types d\'exercices enregistrés : detective, dialogue, aligner, bison.');
})();
