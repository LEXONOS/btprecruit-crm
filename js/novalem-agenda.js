/* ═══════════════════════════════════════════════════════════════════
   NOVALEM AGENDA — composant calendrier partage
   Utilise par le cockpit de prospection (theme clair) et le CRM Sites
   (theme sombre, classe .nva-dark sur le conteneur).

   API :
     var ag = NovAgenda.create(containerEl, {
       events: function () { return [...web_evenements]; },
       labelFor: function (ev) { return 'texte affiche'; },   // optionnel
       onSlotClick: function (dateObj) {},                    // creation
       onEventClick: function (ev) {},                        // detail
       dark: false, view: 'semaine', date: new Date(),
       hourStart: 7, hourEnd: 20
     });
     ag.refresh(); ag.setView('jour'|'semaine'|'mois'); ag.setDate(d);

   Regle d'affichage : seuls les RDV (type rdv_*) sont poses sur la grille
   horaire. Tout le reste (rappels, taches, echeances, auto-rappels) va dans
   le bandeau "Journee" du jour concerne : les taches de Louis n'ont pas
   d'heure significative, elles ne doivent pas polluer les creneaux de RDV.
════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var HOUR_H = 52;      // px par heure (doit suivre .nva-hour du CSS)
var HOUR_H_M = 46;    // px par heure en mobile
var JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
var JOURS_C = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

var TYPE_STYLE = {
  rdv_physique: { cls: 'nva-c-gold', lbl: 'RDV sur place' },
  rdv_visio:    { cls: 'nva-c-blue', lbl: 'RDV visio / tel' },
  rappel:       { cls: 'nva-c-viol', lbl: 'Rappel' },
  tache:        { cls: 'nva-c-gray', lbl: 'Tache' },
  echeance:     { cls: 'nva-c-red',  lbl: 'Echeance' }
};

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var off = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - off);
  return x;
}
function hm(d) {
  return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
}
function localYMD(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function gdlpNow() { // maintenant, en heure murale Guadeloupe, sous forme de Date locale naive
  var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guadeloupe', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
  return new Date(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute);
}
function isMobile() { return window.innerWidth <= 760; }
function hourH() { return isMobile() ? HOUR_H_M : HOUR_H; }
function typeStyle(t) { return TYPE_STYLE[t] || TYPE_STYLE.tache; }
function isTimed(ev) { return String(ev.type || '').indexOf('rdv_') === 0; }

// Repartition des chevauchements : attribue une colonne a chaque RDV du jour
function layoutDay(evs) {
  var sorted = evs.slice().sort(function (a, b) { return new Date(a.date_debut) - new Date(b.date_debut); });
  var lanes = [];
  sorted.forEach(function (ev) {
    var s = new Date(ev.date_debut).getTime();
    var e = ev.date_fin ? new Date(ev.date_fin).getTime() : s + 3600e3;
    ev._s = s; ev._e = e;
    var placed = false;
    for (var i = 0; i < lanes.length; i++) {
      if (lanes[i] <= s) { ev._lane = i; lanes[i] = e; placed = true; break; }
    }
    if (!placed) { ev._lane = lanes.length; lanes.push(e); }
  });
  var n = Math.max(1, lanes.length);
  sorted.forEach(function (ev) { ev._lanes = n; });
  return sorted;
}

// Styles du glisser-deposer : injectes une seule fois, s'appuient sur les variables --nva-*
var _dragCssDone = false;
function ensureDragCss() {
  if (_dragCssDone) return;
  _dragCssDone = true;
  var s = document.createElement('style');
  s.id = 'nva-drag-css';
  s.textContent =
    '.nva-ev,.nva-chip{touch-action:none}' +
    '.nva-drag-clone{position:fixed!important;z-index:99999;pointer-events:none;margin:0!important;' +
      'box-shadow:0 16px 34px rgba(40,34,26,.30),0 3px 8px rgba(40,34,26,.20);opacity:.97;' +
      'transform:scale(1.04);will-change:left,top,transform,width,height;border-radius:8px}' +
    '.nva-drag-ghost{position:absolute;left:2px;right:3px;z-index:6;box-sizing:border-box;' +
      'border:2px dashed currentColor;border-radius:8px;background:rgba(200,144,10,.10);' +
      'pointer-events:none;animation:nvaGhostPulse 1s ease-in-out infinite}' +
    '.nva-drop-cell{outline:2px dashed var(--nva-gold,#C8900A);outline-offset:-3px;border-radius:8px;' +
      'background:var(--nva-gold-soft,rgba(200,144,10,.12))}' +
    '.nva-lifted{opacity:.32!important}' +
    '.nva-dragging,.nva-dragging *{cursor:grabbing!important;user-select:none!important}' +
    '@keyframes nvaGhostPulse{0%,100%{opacity:.5}50%{opacity:.9}}';
  document.head.appendChild(s);
}

function create(container, opts) {
  opts = opts || {};
  var state = {
    view: opts.view || 'semaine',
    date: opts.date || gdlpNow(),
    hourStart: opts.hourStart || 7,
    hourEnd: opts.hourEnd || 20
  };
  container.classList.add('nva');
  if (opts.dark) container.classList.add('nva-dark');

  function events() { return (opts.events ? opts.events() : []) || []; }
  function labelFor(ev) {
    if (opts.labelFor) { var l = opts.labelFor(ev); if (l) return l; }
    return ev.titre || '';
  }
  function evsOn(day) {
    return events().filter(function (e) { return e.statut !== 'annule' && sameDay(new Date(e.date_debut), day); });
  }

  // ── Barre de navigation ──────────────────────────────
  function titleFor() {
    if (state.view === 'jour') {
      return state.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (state.view === 'semaine') {
      var a = startOfWeek(state.date), b = new Date(a); b.setDate(b.getDate() + 6);
      var f1 = a.toLocaleDateString('fr-FR', { day: 'numeric', month: a.getMonth() === b.getMonth() ? undefined : 'short' });
      var f2 = b.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      return f1 + ' - ' + f2;
    }
    return state.date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  function shift(n) {
    var d = new Date(state.date);
    if (state.view === 'jour') d.setDate(d.getDate() + n);
    else if (state.view === 'semaine') d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    state.date = d;
    render();
  }

  // ── Bandeau "Journee" (evenements sans heure utile) ──
  function alldayCell(day) {
    var list = evsOn(day).filter(function (e) { return !isTimed(e); })
      .sort(function (a, b) { return new Date(a.date_debut) - new Date(b.date_debut); });
    return list.map(function (e) {
      var st = typeStyle(e.type);
      return '<div class="nva-chip ' + st.cls + (e.statut === 'fait' ? ' done' : '') + '" data-ev="' + esc(e.id) + '" title="' + esc(e.titre) + '">' + esc(labelFor(e)) + '</div>';
    }).join('');
  }

  // ── Colonne horaire d'un jour ────────────────────────
  function dayColumn(day, isToday) {
    var H = hourH();
    var nHours = state.hourEnd - state.hourStart;
    var html = '';
    // lignes d'heures + demi-heures
    for (var h = 1; h < nHours; h++) {
      html += '<div class="nva-hline" style="top:' + (h * H) + 'px"></div>';
    }
    for (var hh = 0; hh < nHours; hh++) {
      html += '<div class="nva-hline half" style="top:' + (hh * H + H / 2) + 'px"></div>';
    }
    // creneaux cliquables de 30 min
    for (var s = 0; s < nHours * 2; s++) {
      var mins = state.hourStart * 60 + s * 30;
      html += '<div class="nva-slot" data-slot="' + localYMD(day) + '|' + mins + '" style="top:' + (s * H / 2) + 'px;height:' + (H / 2) + 'px"></div>';
    }
    // RDV positionnes
    var timed = layoutDay(evsOn(day).filter(isTimed));
    timed.forEach(function (e) {
      var d0 = new Date(e.date_debut);
      var startMin = d0.getHours() * 60 + d0.getMinutes();
      // un RDV pose hors plage (avant hourStart / apres hourEnd) reste visible, colle au bord
      startMin = Math.min(Math.max(startMin, state.hourStart * 60), state.hourEnd * 60 - 30);
      var durMin = e.date_fin ? Math.max(30, (new Date(e.date_fin) - d0) / 60000) : 60;
      var top = (startMin - state.hourStart * 60) / 60 * H;
      var height = Math.max(24, Math.min(durMin / 60 * H - 3, (state.hourEnd * 60 - startMin) / 60 * H - 3));
      var w = 100 / e._lanes;
      var st = typeStyle(e.type);
      html += '<div class="nva-ev ' + st.cls + (e.statut === 'fait' ? ' done' : '') + '" data-ev="' + esc(e.id) + '"' +
        ' style="top:' + Math.max(0, top) + 'px;height:' + height + 'px;left:calc(' + (e._lane * w) + '% + 2px);width:calc(' + w + '% - 5px)"' +
        ' title="' + esc(e.titre) + (e.lieu ? ' - ' + esc(e.lieu) : '') + '">' +
        '<b>' + esc(labelFor(e)) + '</b>' +
        '<span>' + hm(d0) + (e.lieu ? ' &middot; ' + esc(e.lieu) : '') + '</span>' +
      '</div>';
    });
    // ligne "maintenant"
    if (isToday) {
      var now = gdlpNow();
      var nm = now.getHours() * 60 + now.getMinutes();
      if (nm >= state.hourStart * 60 && nm <= state.hourEnd * 60) {
        html += '<div class="nva-now" style="top:' + ((nm - state.hourStart * 60) / 60 * H) + 'px"></div>';
      }
    }
    return html;
  }

  // ── Vues Jour et Semaine ─────────────────────────────
  function renderGrid(days) {
    var today = gdlpNow();
    var H = hourH();
    var nHours = state.hourEnd - state.hourStart;
    var timeColW = '52px';
    var gridCols = timeColW + ' repeat(' + days.length + ',1fr)';

    var heads = '<div class="nva-day-h" style="border-left:none"></div>' + days.map(function (d) {
      var t = sameDay(d, today);
      return '<div class="nva-day-h' + (t ? ' today' : '') + '">' +
        '<div class="d1">' + (days.length === 1 ? JOURS[(d.getDay() + 6) % 7] : JOURS_C[(d.getDay() + 6) % 7]) + '</div>' +
        '<div class="d2">' + d.getDate() + '</div>' +
        (days.length === 1 ? '' : '<div class="d3">' + d.toLocaleDateString('fr-FR', { month: 'short' }) + '</div>') +
      '</div>';
    }).join('');

    var allday = '<div class="nva-allday-lbl">Journee</div>' + days.map(function (d) {
      return '<div class="nva-allday-cell" data-day="' + localYMD(d) + '">' + alldayCell(d) + '</div>';
    }).join('');

    var hoursCol = '';
    for (var h = 0; h < nHours; h++) {
      hoursCol += '<div class="nva-hour" style="height:' + H + 'px"><span>' + (state.hourStart + h) + 'h</span></div>';
    }
    var cols = days.map(function (d) {
      return '<div class="nva-col' + (sameDay(d, today) ? ' today' : '') + '" data-day="' + localYMD(d) + '" style="height:' + (nHours * H) + 'px">' + dayColumn(d, sameDay(d, today)) + '</div>';
    }).join('');

    return '<div class="nva-frame">' +
      '<div class="nva-days" style="grid-template-columns:' + gridCols + '">' + heads + '</div>' +
      '<div class="nva-allday" style="grid-template-columns:' + gridCols + '">' + allday + '</div>' +
      '<div class="nva-scroll"><div class="nva-grid" style="grid-template-columns:' + gridCols + '">' +
        '<div class="nva-hours">' + hoursCol + '</div>' + cols +
      '</div></div>' +
    '</div>';
  }

  // ── Vue Mois ─────────────────────────────────────────
  function renderMonth() {
    var y = state.date.getFullYear(), m = state.date.getMonth();
    var first = new Date(y, m, 1);
    var start = startOfWeek(first);
    var today = gdlpNow();
    var dows = JOURS_C.map(function (j) { return '<div class="nva-mdow">' + j + '</div>'; }).join('');
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var evs = evsOn(day).sort(function (a, b) { return new Date(a.date_debut) - new Date(b.date_debut); });
      var chips = evs.slice(0, 3).map(function (e) {
        var st = typeStyle(e.type);
        return '<div class="nva-chip ' + st.cls + (e.statut === 'fait' ? ' done' : '') + '" data-ev="' + esc(e.id) + '" title="' + esc(e.titre) + '">' +
          (isTimed(e) ? hm(new Date(e.date_debut)) + ' ' : '') + esc(labelFor(e)) + '</div>';
      }).join('');
      var more = evs.length > 3 ? '<div class="nva-more">+' + (evs.length - 3) + ' autres</div>' : '';
      cells += '<div class="nva-mcell' + (day.getMonth() !== m ? ' out' : '') + (sameDay(day, today) ? ' today' : '') + '" data-day="' + localYMD(day) + '">' +
        '<div class="nva-mnum">' + day.getDate() + '</div>' + chips + more + '</div>';
    }
    return '<div class="nva-frame"><div class="nva-mdows">' + dows + '</div><div class="nva-mgrid">' + cells + '</div></div>';
  }

  // ── Rendu global ─────────────────────────────────────
  function render() {
    var days;
    if (state.view === 'jour') days = [new Date(state.date.getFullYear(), state.date.getMonth(), state.date.getDate())];
    else if (state.view === 'semaine') {
      var s0 = startOfWeek(state.date);
      days = [];
      for (var i = 0; i < 7; i++) { var d = new Date(s0); d.setDate(d.getDate() + i); days.push(d); }
    }
    var legend = '<div class="nva-legend">' + Object.keys(TYPE_STYLE).map(function (t) {
      var st = TYPE_STYLE[t];
      return '<div class="nva-lg"><i class="' + st.cls + '" style="background:currentColor;border:none"></i>' + st.lbl + '</div>';
    }).join('') + '</div>';

    container.innerHTML =
      '<div class="nva-top">' +
        '<div class="nva-nav">' +
          '<button class="nva-btn" data-act="prev">&larr;</button>' +
          '<button class="nva-btn" data-act="today">Aujourd\'hui</button>' +
          '<button class="nva-btn" data-act="next">&rarr;</button>' +
        '</div>' +
        '<div class="nva-title">' + esc(titleFor()) + '</div>' +
        '<div class="nva-views">' +
          ['jour', 'semaine', 'mois'].map(function (v) {
            return '<button class="nva-vw' + (state.view === v ? ' on' : '') + '" data-view="' + v + '">' + v.charAt(0).toUpperCase() + v.slice(1) + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      (state.view === 'mois' ? renderMonth() : renderGrid(days)) +
      legend;

    // faire defiler la grille vers 8h30 par defaut
    var sc = container.querySelector('.nva-scroll');
    if (sc) sc.scrollTop = Math.max(0, (8.5 - state.hourStart) * hourH() - 10);
  }

  // ── Delegation d'evenements ──────────────────────────
  container.addEventListener('click', function (e) {
    var t = e.target;
    var actBtn = t.closest('[data-act]');
    if (actBtn) {
      var act = actBtn.getAttribute('data-act');
      if (act === 'prev') shift(-1);
      else if (act === 'next') shift(1);
      else if (act === 'today') { state.date = gdlpNow(); render(); }
      return;
    }
    var vwBtn = t.closest('[data-view]');
    if (vwBtn) { state.view = vwBtn.getAttribute('data-view'); render(); return; }
    var evEl = t.closest('[data-ev]');
    if (evEl) {
      var id = evEl.getAttribute('data-ev');
      var ev = events().find(function (x) { return String(x.id) === id; });
      if (ev && opts.onEventClick) opts.onEventClick(ev);
      return;
    }
    var dayEl = t.closest('.nva-mcell');
    if (dayEl) {
      state.date = new Date(dayEl.getAttribute('data-day') + 'T12:00:00');
      state.view = 'jour';
      render();
      return;
    }
    var slot = t.closest('[data-slot]');
    if (slot && opts.onSlotClick) {
      var parts = slot.getAttribute('data-slot').split('|');
      var d0 = new Date(parts[0] + 'T00:00:00');
      d0.setMinutes(parseInt(parts[1], 10));
      opts.onSlotClick(d0);
    }
  });

  // ── Glisser-deposer des evenements ───────────────────
  // Base sur les pointer events (et pas le drag HTML natif) : clone qui suit le
  // doigt/souris, ombre de depot calee sur le creneau vise, marche au tactile.
  var DRAG = null;
  var suppressNextClick = false;

  function initDrag() {
    ensureDragCss();
    container.addEventListener('pointerdown', onPD);
    // avale le clic synthetique qui suit un vrai deplacement (sinon la fiche s'ouvre apres le drop)
    container.addEventListener('click', function (e) {
      if (suppressNextClick) { suppressNextClick = false; e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  function onPD(e) {
    if (DRAG) return;                                  // un drop est peut-etre en cours d'atterrissage
    if (e.button != null && e.button !== 0) return;    // clic gauche / tactile uniquement
    var evEl = e.target && e.target.closest ? e.target.closest('[data-ev]') : null;
    if (!evEl) return;
    var id = evEl.getAttribute('data-ev');
    var ev = events().find(function (x) { return String(x.id) === id; });
    if (!ev) return;
    DRAG = { id: id, ev: ev, srcEl: evEl, startX: e.clientX, startY: e.clientY,
             moved: false, clone: null, ghost: null, ghostCell: null,
             timed: isTimed(ev), pointerId: e.pointerId, target: null, offX: 0, offY: 0 };
    try { container.setPointerCapture(e.pointerId); } catch (_) {}
    container.addEventListener('pointermove', onPM);
    container.addEventListener('pointerup', onPU);
    container.addEventListener('pointercancel', onPU);
  }

  function onPM(e) {
    if (!DRAG) return;
    if (!DRAG.moved) {
      if (Math.abs(e.clientX - DRAG.startX) + Math.abs(e.clientY - DRAG.startY) < 8) return;
      beginDrag(e);
    }
    e.preventDefault();
    moveClone(e.clientX, e.clientY);
    updateGhost(e.clientX, e.clientY);
    autoScroll(e.clientY);
  }

  function onPU(e) {
    container.removeEventListener('pointermove', onPM);
    container.removeEventListener('pointerup', onPU);
    container.removeEventListener('pointercancel', onPU);
    try { container.releasePointerCapture(DRAG && DRAG.pointerId); } catch (_) {}
    if (!DRAG) return;
    if (!DRAG.moved) {                                 // simple tap : ouvrir la fiche
      var ev0 = DRAG.ev;
      cleanupDrag();
      suppressNextClick = true;
      if (opts.onEventClick) opts.onEventClick(ev0);
      return;
    }
    e.preventDefault();
    finishDrop();
  }

  function beginDrag(e) {
    DRAG.moved = true;
    document.body.classList.add('nva-dragging');
    var r = DRAG.srcEl.getBoundingClientRect();
    var clone = DRAG.srcEl.cloneNode(true);
    clone.classList.add('nva-drag-clone');
    clone.style.left = r.left + 'px';
    clone.style.top = r.top + 'px';
    clone.style.width = r.width + 'px';
    clone.style.height = r.height + 'px';
    document.body.appendChild(clone);
    DRAG.clone = clone;
    DRAG.offX = e.clientX - r.left;
    DRAG.offY = e.clientY - r.top;
    DRAG.srcEl.classList.add('nva-lifted');
  }

  function moveClone(x, y) {
    if (!DRAG.clone) return;
    DRAG.clone.style.left = (x - DRAG.offX) + 'px';
    DRAG.clone.style.top = (y - DRAG.offY) + 'px';
  }

  function computeTarget(x, y) {
    var under = document.elementFromPoint(x, y);
    if (!under || !under.closest) return null;
    var mcell = under.closest('.nva-mcell');           // vue mois : une cellule = un jour
    if (mcell) return { kind: 'day', day: mcell.getAttribute('data-day'), el: mcell };
    var col = under.closest('.nva-col');               // vue jour/semaine : colonne horaire
    if (col && DRAG.timed) {
      var rect = col.getBoundingClientRect();
      var H = hourH();
      var minutes = state.hourStart * 60 + Math.round((y - rect.top) / H * 2) * 30;
      minutes = Math.max(state.hourStart * 60, Math.min(state.hourEnd * 60 - 30, minutes));
      return { kind: 'grid', day: col.getAttribute('data-day'), el: col, min: minutes };
    }
    var ad = under.closest('.nva-allday-cell');         // bandeau Journee
    if (ad) return { kind: 'day', day: ad.getAttribute('data-day'), el: ad };
    if (col) return { kind: 'day', day: col.getAttribute('data-day'), el: col };
    return null;
  }

  function updateGhost(x, y) {
    var t = computeTarget(x, y);
    DRAG.target = t;
    clearGhost();
    if (!t || !t.day) return;
    if (t.kind === 'grid') {
      var H = hourH();
      var d0 = new Date(DRAG.ev.date_debut);
      var durMin = DRAG.ev.date_fin ? Math.max(30, (new Date(DRAG.ev.date_fin) - d0) / 60000) : 60;
      var top = (t.min - state.hourStart * 60) / 60 * H;
      var height = Math.max(24, Math.min(durMin / 60 * H - 3, (state.hourEnd * 60 - t.min) / 60 * H - 3));
      var g = document.createElement('div');
      g.className = 'nva-drag-ghost ' + typeStyle(DRAG.ev.type).cls;
      g.style.top = Math.max(0, top) + 'px';
      g.style.height = height + 'px';
      t.el.appendChild(g);
      DRAG.ghost = g;
      setCloneTime(t.min);
    } else {
      t.el.classList.add('nva-drop-cell');
      DRAG.ghostCell = t.el;
    }
  }

  function clearGhost() {
    if (DRAG && DRAG.ghost) { DRAG.ghost.remove(); DRAG.ghost = null; }
    if (DRAG && DRAG.ghostCell) { DRAG.ghostCell.classList.remove('nva-drop-cell'); DRAG.ghostCell = null; }
  }

  function setCloneTime(min) {
    if (!DRAG.clone) return;
    var sp = DRAG.clone.querySelector('span');
    if (sp) sp.textContent = String(Math.floor(min / 60)).padStart(2, '0') + 'h' + String(min % 60).padStart(2, '0');
  }

  function targetRect() {
    if (DRAG.ghost) return DRAG.ghost.getBoundingClientRect();
    if (DRAG.ghostCell) return DRAG.ghostCell.getBoundingClientRect();
    return DRAG.srcEl.getBoundingClientRect();
  }

  function finishDrop() {
    var t = DRAG.target, ev = DRAG.ev;
    if (!t || !t.day) { cancelDrop(); return; }
    var p = t.day.split('-');
    var y = +p[0], mo = +p[1] - 1, da = +p[2];
    var old = new Date(ev.date_debut);
    var newStart = (t.kind === 'grid' && t.min != null)
      ? new Date(y, mo, da, Math.floor(t.min / 60), t.min % 60, 0)
      : new Date(y, mo, da, old.getHours(), old.getMinutes(), 0);
    if (newStart.getTime() === old.getTime()) { cancelDrop(); return; }
    settleClone(function () {
      suppressNextClick = true;
      cleanupDrag();
      if (opts.onEventMove) opts.onEventMove(ev, newStart);
      render();
    });
  }

  function settleClone(done) {
    var c = DRAG.clone;
    if (!c) { done(); return; }
    var tr = targetRect();
    c.style.transition = 'left .18s cubic-bezier(.2,.7,.2,1),top .18s cubic-bezier(.2,.7,.2,1),width .18s,height .18s,transform .18s,opacity .2s';
    c.style.left = tr.left + 'px';
    c.style.top = tr.top + 'px';
    c.style.width = tr.width + 'px';
    c.style.height = Math.max(24, tr.height) + 'px';
    c.style.transform = 'scale(1)';
    c.style.opacity = '.92';
    setTimeout(done, 185);
  }

  function cancelDrop() {
    var c = DRAG.clone;
    if (!c) { cleanupDrag(); return; }
    var r = DRAG.srcEl.getBoundingClientRect();
    c.style.transition = 'left .16s ease,top .16s ease,transform .16s ease,opacity .18s';
    c.style.left = r.left + 'px';
    c.style.top = r.top + 'px';
    c.style.transform = 'scale(1)';
    c.style.opacity = '.9';
    setTimeout(cleanupDrag, 160);
  }

  function cleanupDrag() {
    clearGhost();
    if (DRAG && DRAG.clone) DRAG.clone.remove();
    if (DRAG && DRAG.srcEl) DRAG.srcEl.classList.remove('nva-lifted');
    document.body.classList.remove('nva-dragging');
    DRAG = null;
  }

  function autoScroll(y) {
    var sc = container.querySelector('.nva-scroll');
    if (!sc) return;
    var r = sc.getBoundingClientRect();
    if (y < r.top + 44) sc.scrollTop -= 14;
    else if (y > r.bottom - 44) sc.scrollTop += 14;
  }

  if (typeof opts.onEventMove === 'function') initDrag();
  render();
  return {
    refresh: render,
    setView: function (v) { state.view = v; render(); },
    setDate: function (d) { state.date = d; render(); },
    getState: function () { return state; }
  };
}

window.NovAgenda = { create: create };
})();
