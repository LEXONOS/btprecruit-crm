/* NOVALEM CRM — Vérification auth (chargé en premier sur crm.html) */
/* Aligné sur hub.html et index.html : session valide 24h */
(function(){
  const SESSION_MAX_MS = 24 * 3600000; // 24h — DOIT correspondre à hub.html et index.html
  const raw = sessionStorage.getItem('novalem_user');
  if (!raw) { window.location.href = '/'; return; }
  try {
    const u = JSON.parse(raw);
    if (!u || !u.id || !u.ts || (Date.now() - u.ts) > SESSION_MAX_MS) {
      sessionStorage.removeItem('novalem_user');
      window.location.href = '/';
      return;
    }
    window.CURRENT_USER = u;
  } catch(e) {
    sessionStorage.removeItem('novalem_user');
    window.location.href = '/';
  }
})();
