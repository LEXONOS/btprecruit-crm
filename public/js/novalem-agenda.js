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

function create(container, opts) {
  opts = opts || {};
  var state = {
    view: opts.view || 'semaine',
    date: opts.date || new Date(),
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
      var durMin = e.date_fin ? Math.max(30, (new Date(e.date_fin) - d0) / 60000) : 60;
      var top = (startMin - state.hourStart * 60) / 60 * H;
      var height = Math.max(24, durMin / 60 * H - 3);
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
      var now = new Date();
      var nm = now.getHours() * 60 + now.getMinutes();
      if (nm >= state.hourStart * 60 && nm <= state.hourEnd * 60) {
        html += '<div class="nva-now" style="top:' + ((nm - state.hourStart * 60) / 60 * H) + 'px"></div>';
      }
    }
    return html;
  }

  // ── Vues Jour et Semaine ─────────────────────────────
  function renderGrid(days) {
    var today = new Date();
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
      return '<div class="nva-allday-cell">' + alldayCell(d) + '</div>';
    }).join('');

    var hoursCol = '';
    for (var h = 0; h < nHours; h++) {
      hoursCol += '<div class="nva-hour" style="height:' + H + 'px"><span>' + (state.hourStart + h) + 'h</span></div>';
    }
    var cols = days.map(function (d) {
      return '<div class="nva-col' + (sameDay(d, today) ? ' today' : '') + '" style="height:' + (nHours * H) + 'px">' + dayColumn(d, sameDay(d, today)) + '</div>';
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
    var today = new Date();
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
      else if (act === 'today') { state.date = new Date(); render(); }
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
    var dayEl = t.closest('[data-day]');
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
