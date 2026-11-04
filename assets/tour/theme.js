// Le jour ou la nuit avant même le premier affichage : l'heure de la Guadeloupe, ou le choix de Louis (Réglages).
(function () {
  var pref = 'auto';
  try { pref = localStorage.getItem('tour_theme') || 'auto'; } catch (e) { /* stockage indisponible */ }
  var h = 12;
  try { h = parseInt(new Intl.DateTimeFormat('fr-FR', { timeZone: 'America/Guadeloupe', hour: 'numeric', hour12: false }).format(new Date()), 10); } catch (e) { /* ancien navigateur */ }
  var nuit = pref === 'nuit' || (pref === 'auto' && (h >= 19 || h < 6));
  document.documentElement.setAttribute('data-theme', nuit ? 'nuit' : 'jour');
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', nuit ? '#0A1328' : '#EDF1F7');
})();
