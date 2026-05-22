/* ═══════════════════════════════════════════════════════════════════
   NOVALEM CRM — Module Auto-Booking (Partie 1 : côté recruteur)
   ───────────────────────────────────────────────────────────────────
   Chargé APRÈS crm-app.js. Accède aux globals : DB, UI, openMo, closeMo,
   save, toast, cById, esc, currentUserId, uKey, getApiBase, getWeekDates,
   genJitsiLink, badges, rCands, go.

   Contenu :
   - Stockage des fenêtres de disponibilité récurrentes (par recruteur)
   - Modal "Mes disponibilités" (réglé une seule fois)
   - Moteur de calcul des créneaux libres (récurrents − agenda occupé)
   - Flux "Envoyer invitation" : sélection créneaux + email + lien booking
   ═══════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

// ── Constantes ────────────────────────────────────────────────────
const DISPO_KEY      = 'novalem_dispo_rules';   // par utilisateur (uKey)
const BOOK_HORIZON   = 14;                       // nb de jours proposés à l'avance
const BOOK_MAX_SLOTS = 12;                       // plafond de créneaux dans une invitation
const SLOT_MIN       = 60;                        // durée entretien (minutes)
const DAYS_FR        = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const DAYS_SHORT     = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const DAY_ORDER      = [1,2,3,4,5,6,0]; // lun→dim pour l'affichage des réglages

// Fenêtres par défaut (proposées à la 1re config) : lun/mer/jeu matin + ven aprem
const DEFAULT_RULES = {
  1:[{start:9,end:12}],            // lundi matin
  2:[],
  3:[{start:10,end:12}],           // mercredi 10-12
  4:[{start:14,end:17}],           // jeudi après-midi
  5:[],
  6:[], 0:[]
};

// ── Accès stockage des règles ─────────────────────────────────────
function loadRules(){
  try{
    const raw = localStorage.getItem(_ukey(DISPO_KEY));
    if(!raw) return JSON.parse(JSON.stringify(DEFAULT_RULES));
    const r = JSON.parse(raw);
    // garantir les 7 clés
    for(let d=0;d<7;d++){ if(!Array.isArray(r[d])) r[d]=[]; }
    return r;
  }catch(e){ return JSON.parse(JSON.stringify(DEFAULT_RULES)); }
}
function saveRules(rules){
  localStorage.setItem(_ukey(DISPO_KEY), JSON.stringify(rules));
  // Miroir dans DB.settings pour que ça suive la sync cloud
  try{
    DB.settings = DB.settings || {};
    DB.settings.dispo_rules = DB.settings.dispo_rules || {};
    DB.settings.dispo_rules[_uid()] = rules;
    if(typeof save==='function') save();
  }catch(e){}
}
function _uid(){ return (typeof currentUserId==='function'?currentUserId():'louis'); }
function _ukey(k){ return (typeof uKey==='function'? uKey(k) : k+'_'+_uid()); }

// ═══════════════════════════════════════════════════════════════════
// MOTEUR — calcule les créneaux libres à partir des règles récurrentes
// ═══════════════════════════════════════════════════════════════════
function computeFreeSlots(rules, horizonDays){
  horizonDays = horizonDays || BOOK_HORIZON;
  const taken = takenAgendaSet();
  const out = [];
  const now = new Date();
  const start = new Date(); start.setHours(0,0,0,0);

  for(let i=0;i<horizonDays;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const dow = d.getDay();
    const windows = rules[dow] || [];
    for(const w of windows){
      for(let h=w.start; h+1<=w.end; h++){     // créneaux d'1h
        const slotDt = new Date(d); slotDt.setHours(h,0,0,0);
        if(slotDt <= now) continue;            // passé / trop proche
        // au moins 12h de préavis
        if(slotDt.getTime() - now.getTime() < 12*3600000) continue;
        const dateStr = ymd(slotDt);
        const key = dateStr+'_'+h;
        if(taken.has(key)) continue;           // déjà un RDV agenda
        out.push({ dateStr, h, dt: slotDt.toISOString(), label: slotLabel(slotDt,h) });
      }
    }
  }
  return out;
}

function takenAgendaSet(){
  const s = new Set();
  (DB.agenda||[]).filter(a=>!a.done && a.date && a.time).forEach(a=>{
    const d = new Date(a.date);
    const h = parseInt((a.time||'').split(':')[0]);
    s.add(ymd(d)+'_'+h);
  });
  // ainsi que les créneaux déjà proposés/réservés à d'autres candidats (en attente)
  (DB.candidates||[]).forEach(c=>{
    if(c.booking && c.booking.status==='booked' && c.booking.picked){
      const p=c.booking.picked;
      s.add(p.dateStr+'_'+p.h);
    }
  });
  return s;
}

function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function slotLabel(dt,h){
  return DAYS_FR[dt.getDay()]+' '+dt.getDate()+' '+['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'][dt.getMonth()]+' · '+h+'h–'+(h+1)+'h';
}

// ═══════════════════════════════════════════════════════════════════
// MODAL — Réglage des disponibilités récurrentes (une seule fois)
// ═══════════════════════════════════════════════════════════════════
window.openDispoSettings = function(){
  const rules = loadRules();
  window._dispoEdit = JSON.parse(JSON.stringify(rules));
  renderDispoSettings();
};

function renderDispoSettings(){
  const rules = window._dispoEdit;
  const preview = computeFreeSlots(rules).slice(0, BOOK_MAX_SLOTS);

  const dayRows = DAY_ORDER.map(dow=>{
    const wins = rules[dow] || [];
    const chips = wins.length
      ? wins.map((w,wi)=>`<span class="dispo-chip">${w.start}h–${w.end}h<span class="dispo-chip-x" onclick="dispoRemoveWindow(${dow},${wi})">×</span></span>`).join('')
      : `<span class="dispo-empty">Aucune fenêtre</span>`;
    return `
    <div class="dispo-day">
      <div class="dispo-day-name">${DAYS_FR[dow]}</div>
      <div class="dispo-day-wins">${chips}</div>
      <div class="dispo-day-add">
        <select id="dispo-from-${dow}" class="dispo-mini">${hourOpts(8)}</select>
        <span class="dispo-dash">→</span>
        <select id="dispo-to-${dow}" class="dispo-mini">${hourOpts(12)}</select>
        <button class="dispo-add-btn" onclick="dispoAddWindow(${dow})">+ Ajouter</button>
      </div>
    </div>`;
  }).join('');

  openMo('Mes disponibilités d\'entretien', `
    <div class="info-box mb12">
      Définissez vos fenêtres récurrentes <strong>une seule fois</strong>. À chaque invitation envoyée, le système proposera automatiquement vos prochains créneaux libres (hors RDV déjà pris dans l'agenda).
    </div>
    <div class="dispo-grid">${dayRows}</div>

    <div class="dispo-preview-wrap">
      <div class="dispo-preview-hd">
        <span>Aperçu — prochains créneaux proposés</span>
        <span class="dispo-preview-count">${preview.length} créneau${preview.length>1?'x':''}</span>
      </div>
      <div class="dispo-preview-list">
        ${preview.length ? preview.map(s=>`<span class="dispo-prev-chip">${s.label}</span>`).join('') : '<span class="dispo-empty">Ajoutez des fenêtres pour voir l\'aperçu</span>'}
      </div>
    </div>`,
    `<button class="btn bg" onclick="closeMo()">Annuler</button>
     <button class="btn bp" onclick="dispoSave()">Enregistrer mes disponibilités</button>`
  );
}

function hourOpts(sel){
  let o='';
  for(let h=7;h<=20;h++){ o+=`<option value="${h}" ${h===sel?'selected':''}>${h}h</option>`; }
  return o;
}

window.dispoAddWindow = function(dow){
  const from = parseInt(document.getElementById('dispo-from-'+dow).value);
  const to   = parseInt(document.getElementById('dispo-to-'+dow).value);
  if(to<=from){ toast('L\'heure de fin doit être après le début','e'); return; }
  window._dispoEdit[dow] = window._dispoEdit[dow] || [];
  window._dispoEdit[dow].push({start:from,end:to});
  // fusion/tri simple
  window._dispoEdit[dow].sort((a,b)=>a.start-b.start);
  renderDispoSettings();
};
window.dispoRemoveWindow = function(dow,wi){
  window._dispoEdit[dow].splice(wi,1);
  renderDispoSettings();
};
window.dispoSave = function(){
  saveRules(window._dispoEdit);
  closeMo();
  toast('Disponibilités enregistrées ✓','s');
};

// ═══════════════════════════════════════════════════════════════════
// FLUX INVITATION — sélection des créneaux à proposer + email
// Appelé depuis la qualification (bouton "Envoyer invitation")
// ═══════════════════════════════════════════════════════════════════
window.startInvitation = function(candId){
  const c = cById(candId); if(!c) return;
  const rules = loadRules();
  const slots = computeFreeSlots(rules);
  if(!slots.length){
    // pas de dispo configurée → rediriger vers le réglage
    openMo('Aucun créneau disponible', `
      <div class="info-box mb12">
        Vous n'avez pas encore défini de disponibilités, ou tous vos créneaux sont occupés sur les ${BOOK_HORIZON} prochains jours.
      </div>
      <p style="font-size:12px;color:var(--mu);line-height:1.6">Configurez vos fenêtres d'entretien récurrentes, puis renvoyez l'invitation.</p>`,
      `<button class="btn bg" onclick="closeMo()">Fermer</button>
       <button class="btn bp" onclick="closeMo();setTimeout(()=>openDispoSettings(),80)">Définir mes disponibilités</button>`
    );
    return;
  }
  // Pré-sélection : les BOOK_MAX_SLOTS premiers
  window._invSel = {};
  slots.slice(0,BOOK_MAX_SLOTS).forEach(s=> window._invSel[s.dateStr+'_'+s.h]=s );
  renderInvitation(candId, slots);
};

function renderInvitation(candId, slots){
  const c = cById(candId);
  const selCount = Object.keys(window._invSel).length;

  // Grouper par jour pour l'affichage
  const byDay = {};
  slots.forEach(s=>{ (byDay[s.dateStr]=byDay[s.dateStr]||[]).push(s); });

  const dayBlocks = Object.keys(byDay).map(dateStr=>{
    const d = new Date(dateStr+'T00:00:00');
    const head = DAYS_FR[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1);
    const chips = byDay[dateStr].map(s=>{
      const key = s.dateStr+'_'+s.h;
      const on = !!window._invSel[key];
      return `<button class="inv-slot ${on?'on':''}" onclick="invToggle('${key}')">${s.h}h–${s.h+1}h</button>`;
    }).join('');
    return `<div class="inv-day"><div class="inv-day-h">${head}</div><div class="inv-day-slots">${chips}</div></div>`;
  }).join('');

  openMo('Inviter '+esc(c.name)+' à réserver', `
    <div class="steps">
      <div class="step"><div class="step-dot done">1</div><span class="step-l done">Qualifier</span></div>
      <div class="step-arr">→</div>
      <div class="step"><div class="step-dot cur">2</div><span class="step-l cur">Créneaux</span></div>
      <div class="step-arr">→</div>
      <div class="step"><div class="step-dot">3</div><span class="step-l">Email</span></div>
    </div>
    <div class="info-box mb10">
      Le candidat recevra ces créneaux et <strong>choisira lui-même</strong>. Décochez ceux que vous ne souhaitez pas proposer.
      <br><span class="fs10">Issus de vos disponibilités récurrentes · <a style="color:var(--ac);cursor:pointer" onclick="closeMo();setTimeout(()=>openDispoSettings(),80)">modifier mes fenêtres</a></span>
    </div>
    <div class="inv-grid">${dayBlocks}</div>
    <div class="inv-foot-count"><span id="inv-count">${selCount}</span> créneau(x) proposé(s)</div>`,
    `<button class="btn bg" onclick="closeMo()">Annuler</button>
     <button class="btn bp" onclick="invProceedEmail('${candId}')">Préparer l'email →</button>`
  );
  window._invSlots = slots;
}

window.invToggle = function(key){
  if(window._invSel[key]) delete window._invSel[key];
  else {
    const s = (window._invSlots||[]).find(x=> x.dateStr+'_'+x.h===key);
    if(s) window._invSel[key]=s;
  }
  // maj UI ciblée
  const btn = document.querySelector(`.inv-slot[onclick*="${key}"]`);
  if(btn) btn.classList.toggle('on');
  const cnt = document.getElementById('inv-count');
  if(cnt) cnt.textContent = Object.keys(window._invSel).length;
};

// ── Étape 3 : génère le token, stocke le booking, montre l'aperçu ──
window.invProceedEmail = function(candId){
  const c = cById(candId); if(!c) return;
  const sel = Object.values(window._invSel||{});
  if(!sel.length){ toast('Sélectionnez au moins un créneau','e'); return; }
  if(!c.email){ toast('Ce candidat n\'a pas d\'email — ajoutez-le sur sa fiche','e'); return; }
  sel.sort((a,b)=> a.dt<b.dt?-1:1);

  // Token de réservation (lien sécurisé, non devinable)
  const token = 'bk_'+Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,6);
  const rNom = localStorage.getItem(_ukey('btp_user_name'))||localStorage.getItem('btp_user_name')||'Votre interlocuteur Novalem';
  const rTel = localStorage.getItem(_ukey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'';

  // On prépare le booking en mémoire (sauvegardé seulement à l'envoi confirmé)
  window._invPending = {
    candId,
    token,
    slots: sel.map(s=>({dateStr:s.dateStr,h:s.h,dt:s.dt,label:s.label})),
    recruiter: { name: rNom, phone: rTel }
  };

  // Construire le lien candidat + corps du mail (aperçu = exactement ce qui sera envoyé)
  const base = (getApiBase() || 'https://novalem-crm.vercel.app');
  const link = base+'/dossier.html?cid='+encodeURIComponent(c.id)+'&bk='+encodeURIComponent(token)+'&n='+encodeURIComponent(c.name);
  const firstN = (c.name||'').split(' ')[0];
  const subject = 'Votre entretien Novalem — réservez votre créneau';
  const emailBody = buildInvitationEmail({firstN, link, slots:window._invPending.slots, nom:rNom, tel:rTel, role:c.role});

  window._invPending.subject = emailBody && subject;
  window._invPending.body = emailBody;
  window._invPending.link = link;

  renderInvPreview(c);
};

// ── Aperçu du mail (rendu fidèle) + bouton Envoyer direct ─────────
function renderInvPreview(c){
  const p = window._invPending;
  const apiBase = getApiBase();
  const canSendDirect = !!apiBase; // en prod Vercel → envoi auto via Resend

  // Rendu visuel du corps : on transforme [texte](url) en bouton, sauts de ligne en <br>
  const bodyHtml = invBodyToHtml(p.body);

  openMo('Vérifier et envoyer — '+esc(c.name), `
    <div class="steps">
      <div class="step"><div class="step-dot done">1</div><span class="step-l done">Qualifier</span></div>
      <div class="step-arr">→</div>
      <div class="step"><div class="step-dot done">2</div><span class="step-l done">Créneaux</span></div>
      <div class="step-arr">→</div>
      <div class="step"><div class="step-dot cur">3</div><span class="step-l cur">Envoyer</span></div>
    </div>

    <div class="inv-prev-meta">
      <div class="inv-prev-row"><span class="inv-prev-k">À</span><span class="inv-prev-v">${esc(c.email)}</span></div>
      <div class="inv-prev-row"><span class="inv-prev-k">Objet</span><span class="inv-prev-v">${esc(p.subject||'Votre entretien Novalem — réservez votre créneau')}</span></div>
      <div class="inv-prev-row"><span class="inv-prev-k">Créneaux</span><span class="inv-prev-v">${p.slots.length} proposé(s)</span></div>
    </div>

    <div class="inv-prev-label">Aperçu du message</div>
    <div class="inv-prev-mail">${bodyHtml}</div>

    ${!canSendDirect?`<div class="info-box" style="margin-top:10px">Mode local : l'envoi automatique nécessite le déploiement Vercel. Le lien sera copié à la place.</div>`:''}`,
    `<button class="btn bg" onclick="closeMo()">Annuler</button>
     <button class="btn bg" onclick="startInvitation('${c.id}')">← Modifier les créneaux</button>
     <button class="btn bp" id="inv-send-btn" onclick="invSendNow('${c.id}')">${canSendDirect?'✉️ Envoyer maintenant':'Copier le lien'}</button>`
  );
}

// Transforme le corps texte en HTML d'aperçu (bouton CTA + retours ligne)
function invBodyToHtml(body){
  let h = (body||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // [texte](url) → bouton
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" style="display:inline-block;margin:8px 0;padding:9px 16px;background:var(--ac);color:#0a0a08;border-radius:var(--r);font-weight:700;font-size:12px;text-decoration:none">$1</a>');
  h = h.replace(/\n/g,'<br>');
  return h;
}

// ── Envoi direct via Resend (/api/send-email) ─────────────────────
window.invSendNow = async function(candId){
  const c = cById(candId); if(!c) return;
  const p = window._invPending; if(!p){ toast('Session expirée, recommencez','e'); return; }
  const apiBase = getApiBase();
  const btn = document.getElementById('inv-send-btn');

  // Mode local : pas d'envoi auto possible → copier le lien
  if(!apiBase){
    navigator.clipboard?.writeText(p.link);
    commitBooking(c, p);
    closeMo();
    toast('Lien copié — collez-le au candidat','i');
    return;
  }

  if(btn){ btn.disabled=true; btn.textContent='Envoi…'; }
  try{
    const senderName = (localStorage.getItem(_ukey('btp_user_name'))||localStorage.getItem('btp_user_name')||'NOVALEM');
    const resp = await fetch(apiBase+'/api/send-email',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ to: c.email, subject: p.subject||'Votre entretien Novalem — réservez votre créneau', body: p.body, from_name: senderName+' — NOVALEM' })
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok || !(data.sent || data.id)){
      throw new Error(data.error || 'Échec de l\'envoi');
    }
    // Succès → on grave le booking sur le candidat
    commitBooking(c, p);
    if(btn){ btn.textContent='✓ Envoyé !'; btn.style.background='var(--green)'; btn.style.color='#0a0a08'; }
    toast(`Invitation envoyée à ${c.email} ✓`,'s');
    setTimeout(()=>{ closeMo(); }, 1100);
  }catch(e){
    if(btn){ btn.disabled=false; btn.textContent='✉️ Réessayer'; }
    toast('Erreur envoi : '+e.message,'e');
  }
};

// Grave le booking sur le candidat (statut, agenda en attente, etc.)
function commitBooking(c, p){
  c.booking = {
    token: p.token,
    status: 'sent',
    slots: p.slots,
    sent_at: new Date().toISOString(),
    picked: null,
    recruiter: p.recruiter
  };
  c.status = 'dossier';
  c.invite_method = 'email';
  c.invite_sent_at = (typeof now_==='function'?now_():new Date().toISOString());
  c.updated = (typeof now_==='function'?now_():new Date().toISOString());
  save();
  badges();
  if(UI.view==='cands' && typeof rCands==='function') rCands();
  window._invPending = null;
}

function buildInvitationEmail({firstN, link, slots, nom, tel, role}){
  const slotLines = slots.map(s=>'   • '+s.label).join('\n');
  const sig = nom + (tel?('\n'+tel):'') + '\nNovalem — Cabinet de recrutement BTP';
  return `Bonjour ${firstN},

Suite à notre échange, je souhaite organiser un entretien${role?(' pour le poste de '+role):''}.

Pour avancer, je vous invite à compléter votre dossier de candidature et à choisir directement le créneau d'entretien qui vous convient, en cliquant sur le lien ci-dessous :

[Compléter mon dossier et réserver mon créneau](${link})

Créneaux actuellement proposés :
${slotLines}

─────────────────────────
Vos données sont en sécurité
─────────────────────────
Novalem est un cabinet de recrutement déclaré. Les informations et documents que vous transmettez (pièce d'identité, justificatifs) servent uniquement à constituer votre dossier de candidature et à le présenter aux entreprises qui recrutent. Ils ne sont jamais revendus ni partagés à des tiers, conformément au RGPD. Vous pouvez à tout moment demander leur suppression.

À très vite,

${sig}`;
}

// ── Détection des réservations entrantes (notif côté recruteur) ────
// computeAlerts() de crm-app.js gère déjà _dossier_validated.
// On ajoute la détection booking via un hook léger au chargement.
function scanBookings(){
  let changed=false;
  (DB.candidates||[]).forEach(c=>{
    if(c.booking && c.booking.status==='booked' && c.booking.picked && !c.booking._agenda_added){
      // Créer l'événement agenda automatiquement
      const p = c.booking.picked;
      const link = c.visio_link || genJitsiLink();
      c.visio_link = link;
      c.int_date_planned = p.dateStr;
      c.int_time = p.h+':00';
      (DB.agenda = DB.agenda||[]).push({
        id: (typeof uid==='function'?uid():'ag_'+Date.now()),
        type:'visio',
        title:'Entretien visio — '+c.name,
        date: new Date(p.dateStr+'T00:00:00').toISOString(),
        time: p.h+':00',
        cand_id: c.id, comp_id:null,
        notes:'Réservé par le candidat · Lien : '+link,
        done:false,
        created:(typeof now_==='function'?now_():new Date().toISOString())
      });
      c.booking._agenda_added = true;
      c.status = (c.status==='dossier'?'interview':c.status);
      changed=true;
    }
  });
  if(changed && typeof save==='function'){ save(); if(typeof badges==='function') badges(); }
}
// Scan au chargement + après chaque sync cloud (toutes les 30s)
window.addEventListener('load', ()=> setTimeout(scanBookings, 1500));
setInterval(scanBookings, 30000);
window._scanBookings = scanBookings;

})();
