/* NOVALEM CRM — Vérification auth (chargé en premier sur crm.html) */
/* Aligné sur hub.html et index.html : session valide 24h */
(function(){
  const SESSION_MAX_MS = 7*24*3600000; // 7 jours d'inactivité (fenêtre glissante) — aligné hub.html / index.html
  const raw = localStorage.getItem('novalem_user');
  if (!raw) { window.location.href = '/'; return; }
  try {
    const u = JSON.parse(raw);
    if (!u || !u.id || !u.ts || (Date.now() - u.ts) > SESSION_MAX_MS) {
      localStorage.removeItem('novalem_user');
      window.location.href = '/';
      return;
    }
    /* Fenêtre glissante : prolonge la session à chaque chargement du CRM */
    u.ts = Date.now();
    try { localStorage.setItem('novalem_user', JSON.stringify(u)); } catch(_){}
    window.CURRENT_USER = u;
  } catch(e) {
    localStorage.removeItem('novalem_user');
    window.location.href = '/';
  }
})();
