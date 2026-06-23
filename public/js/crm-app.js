/* NOVALEM CRM — Application principale */
// ═══════════════════════════════════════════════════════
// CONSTANTS — exact pipelines as specified
// ═══════════════════════════════════════════════════════
const BTP_CATS=[
 {id:'go', l:'Gros Œuvre', cls:'tgo', jobs:['Conducteur de travaux GO','Chef de chantier GO','Maçon N3/N4','Coffreur-bancheur N3','Chef d\'équipe GO','Grutier']},
 {id:'so', l:'Second Œuvre', cls:'tso', jobs:['Conducteur de travaux TCE','Électricien N3 CFA/CFO','Plombier-chauffagiste N3','Carreleur N3','Plaquiste N3','Menuisier N3']},
 {id:'be', l:'Bureau d\'Études', cls:'tbe', jobs:['Ingénieur études structure','Ingénieur VRD','Métreur-économiste','Dessinateur-projeteur Revit','Économiste de la construction','Ingénieur géotechnique']},
 {id:'vrd', l:'VRD / TP', cls:'tvrd', jobs:['Conducteur de travaux VRD','Chef de chantier VRD','Géomètre-topographe','Conducteur d\'engins TP','Technicien géomètre','Chef de projet VRD']},
 {id:'hse', l:'HSE / QSE', cls:'thse', jobs:['Coordinateur SPS','Responsable QSE BTP','Animateur sécurité chantier','Technicien contrôle qualité','MASE Auditeur']},
 {id:'mgmt', l:'Management / Chargé d\'affaires',cls:'tmgmt',jobs:['Chargé d\'affaires TCE','Directeur de travaux','Directeur de production','Responsable d\'exploitation','Chef de projet MOE','Business Developer BTP']},
];

// CANDIDATE PIPELINE: Nouveau → Précal → Dossier envoyé → Entretien visio → Présenté client → Placé (+ KO)
const CAND_ST=[
 {id:'entrant', l:'Entrant', p:'pent', nxt:null},
 {id:'new', l:'Qualifié', p:'pnew', nxt:'Faire la précal téléphonique'},
 {id:'precal', l:'Précal faite', p:'ppre', nxt:' Planifier entretien visio'},
 {id:'dossier', l:'Dossier envoyé', p:'pdos', nxt:'Entretien planifié'},
 {id:'interview', l:'Entretien visio', p:'pvis', nxt:' Rédiger synthèse entretien'},
 {id:'presented', l:'Présenté client', p:'ppres', nxt:'Relancer client (+72h)'},
 {id:'placed', l:'Placé', p:'pplac', nxt:null},
 {id:'ko', l:'KO', p:'pko', nxt:null},
];

// COMPANY PIPELINE — tree structure:
// À appeler → NRP
// À appeler → Contacté → Pas de besoin
// À appeler → Contacté → Besoin → CV envoyé → Contrat envoyé → Placé
// (+ Client actif = any company with contract signed)
const COMP_ST=[
 {id:'tocall', l:'À appeler', p:'ptoc'},
 {id:'nrp', l:'NRP', p:'pnrp'}, // no response
 {id:'called', l:'Contacté', p:'pcal'},
 {id:'nobiz', l:'Pas de besoin',p:'pbno'},
 {id:'need', l:'Besoin ✓', p:'pnee'},
 {id:'cvsent', l:'CV envoyé', p:'pcsnt'},
 {id:'contract', l:'Contrat envoyé',p:'pcli'},
 {id:'active', l:'Client actif', p:'pwin'},
];

const DOCS_LIST=[
 {id:'cv',       l:'CV',                              ico:'📄', required:true},
 {id:'id_card',  l:"Pièce d'identité (recto/verso)", ico:'🪹', required:true,  note:"CNI, passeport ou titre de séjour selon situation"},
 {id:'permis',   l:'Permis de conduire (recto/verso)', ico:'🚗', required:false, note:"Obligatoire si permis déclaré dans le dossier"},
 {id:'carte_vit',l:'Carte vitale',                    ico:'💳', required:false, note:"Recommandé — n° sécu nécessaire pour la DPAE à l'embauche"},
 {id:'dossier',  l:'Dossier de candidature signé', ico:'✅', required:true,  auto:true, note:"Généré automatiquement à la signature du dossier en ligne"},
];
// Legacy compat — some old candidates stored docs as string arrays
const DOCS=DOCS_LIST.map(d=>d.l);

// ── Détection de présence d'une pièce candidat ────────────────────────────
// Une pièce est "reçue" si elle a un contenu base64 (file), un chemin de
// stockage bucket (storage_path) OU une URL signée (url). Les pièces d'un
// dossier envoyé en ligne arrivent en storage_path/url SANS base64 : il faut
// donc les trois conditions, sinon elles sont comptées comme manquantes.
// _pg : le contenu (base64) a été déchargé hors de la fiche, dans la table
// crm_candidat_files (pour ne plus alourdir chaque chargement). Le fichier est
// récupéré à la demande via pgFileBase64() au moment de l'aperçu / de l'IA.
function docHasFile(d){ return !!(d && !d.missing && (d.file || d.storage_path || d.url || d._pg)); }
// Pièce d'un type donné, présente, dans la liste de pièces d'un candidat.
function findDoc(c,id){ return (c&&c.docs?c.docs:[]).find(d=>d&&d.id===id&&docHasFile(d)); }

// base64 -> Blob (aperçu robuste des gros PDF, sans URL data géante)
function _b64ToBlobApp(b64, mime){
 const bin=atob(b64||''); const len=bin.length; const arr=new Uint8Array(len);
 for(let i=0;i<len;i++) arr[i]=bin.charCodeAt(i);
 return new Blob([arr], { type: mime||'application/octet-stream' });
}
// Récupère le base64 d'une pièce déchargée dans crm_candidat_files (à la demande).
// Renvoie { mediaType, base64, filename } ou null.
async function pgFileBase64(candId, slot){
 const sb=getSB(); if(!sb||!candId) return null;
 try{
  const { data, error }=await sb.from('crm_candidat_files')
    .select('b64,mime,filename').eq('cand_id',candId).eq('slot',slot||'cv').maybeSingle();
  if(error||!data||!data.b64) return null;
  return { mediaType:data.mime||'application/pdf', base64:data.b64, filename:data.filename||null };
 }catch(_){ return null; }
}
// Dépose une pièce dans la table de décharge (utilisé en repli si le bucket échoue).
async function pgFilePut(candId, slot, file, base64){
 const sb=getSB(); if(!sb||!candId) return false;
 try{
  let b64=base64;
  if(!b64 && file){ b64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(((r.result||'')+'').split(',')[1]||''); r.onerror=rej; r.readAsDataURL(file); }); }
  if(!b64) return false;
  const { error }=await sb.from('crm_candidat_files').upsert(
    { cand_id:candId, slot:slot||'cv', filename:(file&&file.name)||null, mime:(file&&file.type)||'application/pdf', b64 },
    { onConflict:'cand_id,slot' }
  );
  return !error;
 }catch(_){ return false; }
}
// Borne une promesse dans le temps : si elle n'a pas répondu à temps, on
// continue sans elle (empêche les chargements / uploads bloqués à l'infini
// quand le cloud est lent ou restreint).
function _withTimeout(promise, ms, fallback){
 return Promise.race([
   Promise.resolve(promise).catch(()=>fallback),
   new Promise(res=>setTimeout(()=>res(fallback), ms))
 ]);
}
// Anti-régression : décharge tout base64 résiduel d'une fiche vers
// crm_candidat_files et remplace la pièce par une référence légère (_pg).
// Garantit qu'aucune fiche ne peut ré-alourdir crm_candidats lors d'une
// écriture, même si le cache local contient encore d'anciens CV en base64.
// Renvoie true si la fiche a été modifiée.
async function _offloadBase64Docs(c){
 const sb=getSB(); if(!sb || !c || !Array.isArray(c.docs)) return false;
 let changed=false;
 for(let i=0;i<c.docs.length;i++){
   const d=c.docs[i];
   if(d && typeof d.file==='string' && d.file.startsWith('data:')){
     const comma=d.file.indexOf(',');
     if(comma<0) continue;
     const meta=d.file.slice(5, comma);              // ex : application/pdf;base64
     const mime=(meta.split(';')[0]) || d.type || 'application/pdf';
     const b64=d.file.slice(comma+1);
     if(!b64) continue;
     try{
       const slot=d.id||'cv';
       const { error }=await sb.from('crm_candidat_files').upsert(
         { cand_id:c.id, slot, filename:d.name||null, mime, b64 },
         { onConflict:'cand_id,slot' }
       );
       if(error) throw error;
       const light=Object.assign({}, d); delete light.file; light._pg=true; light.type=light.type||mime;
       c.docs[i]=light;
       changed=true;
     }catch(e){ console.warn('[offload] doc', d.id, e.message); /* base64 conservé → réessai au prochain sync */ }
   }
 }
 return changed;
}
// Meilleure source immédiatement affichable (data URL ou URL http) pour un aperçu
// rapide sans régénérer d'URL signée. openDocPreview gère le rafraîchissement.
function docDirectSrc(d){
 if(!d) return null;
 if(typeof d.file==='string' && (d.file.startsWith('data:')||/^https?:/.test(d.file))) return d.file;
 return d.url || (typeof d.file==='string'?d.file:null) || null;
}
const SOURCES=['LinkedIn','Indeed','France Travail','CVtech','Candidature spontanée','APEC','Welcome to the Jungle','Réseau / Recommandation','Cold outreach'];
const PRO_TABS=[
 {id:'active',l:'À appeler / En cours'},
 {id:'nobiz',l:' Pas de besoin'},
 {id:'refused',l:'× Refus cabinet'},
 {id:'accept_cv',l:'✉ Accepte CV'},
];
let proTab='active';
let proSelectedId=null;
const AG_TYPES=[
 {id:'call',ico:'📞',l:'Appel',col:'var(--orange)'},
 {id:'visio',ico:'🎥',l:'Entretien visio',col:'var(--blue)'},
 {id:'task',ico:'✅',l:'Tâche',col:'var(--green)'},
 {id:'relance',ico:'🔁',l:'Relance',col:'var(--purple)'},
 {id:'contract',ico:'📄',l:'Contrat',col:'var(--gold)'},
 {id:'meeting',ico:'🤝',l:'Rendez-vous',col:'var(--green)'}
];
const agType=(id)=>AG_TYPES.find(t=>t.id===id)||AG_TYPES[2];
const BOARDS=['France Travail','Indeed','LinkedIn Jobs','APEC','Welcome to the Jungle','Monster','Meteojob'];
const WEEK_HOURS=[8,9,10,11,12,13,14,15,16,17,18];
function fmtDate(d){const days=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];return`${days[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;}
function genJitsiLink(){const id=Math.random().toString(36).slice(2,10);return`https://meet.jit.si/novalem-${id}`;}

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
var DB={candidates:[],companies:[],needs:[],agenda:[],posts:[],invoices:[],email_rules:[]};
// DB est volontairement déclaré en `var` (et non `let`) pour qu'il soit exposé
// sur l'objet global `window`. Les modules additifs (novalem-annonces-pro.js,
// crm-booking.js) lisent `window.DB` ; un `let` au niveau racine d'un script
// classique reste invisible depuis `window`, ce qui faisait apparaître à tort
// « Aucun besoin ouvert » dans la passerelle Besoins → Annonces.
try{ window.DB = DB; }catch(_){}

// ═══════════════════════════════════════════════════════
// MULTI-USER — contexte utilisateur courant
// ═══════════════════════════════════════════════════════

// CURRENT_USER est défini par l'auth check ci-dessus
// window.CURRENT_USER = {id, name, role, initials, color}

function currentUserId(){return(window.CURRENT_USER||{}).id||'louis';}
function currentUserName(){return(window.CURRENT_USER||{}).name||'Louis';}
function isAdmin(){return(window.CURRENT_USER||{}).role==='admin';}

// ── Identité stable ──────────────────────────────────────
// currentUserId() renvoie l'UUID Supabase (id de session). Pour l'attribution
// lisible et les quelques tests par personne, on dérive un "slug" stable à
// partir du prénom : "Louis Renault" -> "louis", "Corentin Dupont" -> "corentin".
// Robuste pour une petite équipe et dégrade proprement si un 3e arrive.
function userSlug(name){
  const n=(name!=null?name:currentUserName())||'';
  return n.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')   // sans accents
    .replace(/[^a-z0-9]/g,'') || 'user';
}
// Vrai si l'utilisateur connecté est le superviseur (rôle, pas le prénom)
function isSuperviseur(){return(window.CURRENT_USER||{}).role==='superviseur';}

// Palette d'attribution : couleur stable par auteur (slug)
function authorColor(slug){
  const map={louis:'var(--ac4)',corentin:'var(--ac5)'};
  if(map[slug])return map[slug];
  // fallback déterministe pour tout autre auteur
  const pal=['var(--ac4)','var(--ac5)','var(--purple)','var(--orange)','var(--blue)'];
  let h=0;for(const c of (slug||''))h=(h*31+c.charCodeAt(0))>>>0;
  return pal[h%pal.length];
}

// Taguer une entité avec l'utilisateur courant (UUID + slug + nom lisible)
function tagUser(obj){
  obj.assigned_to=currentUserId();
  obj.by=obj.by||currentUserId();
  obj.by_slug=userSlug();
  obj.by_name=obj.by_name||currentUserName();
  return obj;
}

// Stats d'activité par utilisateur (pour reporting)
function computeUserStats(userId){
  const us=userId||currentUserId();
  const today=todayLocal();
  const thisWeekStart=localDateStr((()=>{const d=new Date();d.setDate(d.getDate()-d.getDay()+1);return d;})());
  return{
    prospectsTotal: DB.companies.filter(c=>c.type==='prospect'&&c.assigned_to===us).length,
    prospectsCalledToday: (DB.companies.filter(c=>c.type==='prospect'&&c.assigned_to===us&&c.timeline&&c.timeline[0]&&c.timeline[0].date&&c.timeline[0].date.startsWith(today))).length,
    candidatsTotal: DB.candidates.filter(c=>c.assigned_to===us).length,
    placed: DB.candidates.filter(c=>c.assigned_to===us&&c.status==='placed').length,
    agendaToday: DB.agenda.filter(a=>!a.done&&isToday(a.date)).length,
  };
}


let UI={view:'dash',ptype:null,pid:null,ptab:0,cands_tab:'trier',agView:'week',agDate:(()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})(),calWeekOffset:0};

// ═══════════════════════════════════════════════════════
// STORAGE — localStorage (cache) + Supabase (cloud sync)
// ═══════════════════════════════════════════════════════

// ── Modèle "agence" ──────────────────────────────────────
// Base PARTAGÉE : un seul espace pour Louis + Corentin.
//   crm_data id=0 → config d'agence partagée (clé Anthropic, taux, objectif CA)
//   crm_data id=1 → données d'agence partagées (candidats, mandats, agenda…)
// L'attribution "qui fait quoi" vit dans le JSON (by / by_name sur chaque fiche).
const AGENCY_DATA_ROW = 1;   // une seule ligne de données, partagée
const AGENCY_CFG_ROW  = 0;   // une seule ligne de config, partagée

// Projet Supabase canonique de Novalem (le même que hub.html / index.html, où
// tourne déjà l'auth). C'est la source de vérité — pas besoin que Corentin
// configure quoi que ce soit.
const NOV_SB_URL  = 'https://hfdkkdyyhpymrwiqmitn.supabase.co';
const NOV_SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZGtrZHl5aHB5bXJ3aXFtaXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NTU3OTgsImV4cCI6MjA4OTIzMTc5OH0.UWli4BIDWHwGOKuFCom8wQFYHnNYPtODAI5Cl7tCRJ8';

// ── Config helpers ───────────────────────────────────────
// uKey = clés localStorage PERSO (préfixées par utilisateur). On ne garde
// le préfixe QUE pour le perso (nom, téléphone, thème). Tout le reste est partagé.
function uKey(k){return k+'_'+(currentUserId()||'louis');}

// Supabase URL/clé : on pointe TOUJOURS sur le projet Novalem canonique.
// (Les anciens champs localStorage btp_sb_url/btp_sb_key deviennent inutiles ;
//  on les lit encore en dernier recours pour ne rien casser sur d'anciens postes.)
function getSupabaseUrl(){return NOV_SB_URL||localStorage.getItem(uKey('btp_sb_url'))||localStorage.getItem('btp_sb_url')||'';}
function getSupabaseKey(){return NOV_SB_ANON||localStorage.getItem(uKey('btp_sb_key'))||localStorage.getItem('btp_sb_key')||'';}
function setSupabaseUrl(v){if(v)localStorage.setItem(uKey('btp_sb_url'),v);}
function setSupabaseKey(v){if(v)localStorage.setItem(uKey('btp_sb_key'),v);}

// ── Config d'agence partagée (crm_data id=0) ─────────────
// Chargée une fois au démarrage (loadSharedConfig). Les getters lisent ce cache
// d'abord, puis retombent sur localStorage si le cloud n'a pas encore répondu.
let NOVCFG = null; // { anthropic_key, taux_hon, obj_ca }
function cfgGet(key, lsKey, def){
  if(NOVCFG && NOVCFG[key]!=null && NOVCFG[key]!=='') return NOVCFG[key];
  if(lsKey){const v=localStorage.getItem(uKey(lsKey))||localStorage.getItem(lsKey); if(v!=null&&v!=='') return v;}
  return def;
}

// ── Supabase client ──────────────────────────────────────
// Un seul client, sur le projet canonique. Plus de client par-utilisateur.
let _sbClient=null;
function getSB(){
 try{
 if(!_sbClient){
 _sbClient=window.supabase.createClient(NOV_SB_URL,NOV_SB_ANON);
 _sbClient._url=NOV_SB_URL;
 }
 return _sbClient;
 }catch(e){return null;}
}

// ── Chargement de la config partagée (au démarrage) ──────
async function loadSharedConfig(){
  const sb=getSB(); if(!sb)return;
  try{
    const {data,error}=await sb.from('crm_data').select('data').eq('id',AGENCY_CFG_ROW).maybeSingle();
    if(error)throw error;
    if(data&&data.data){
      NOVCFG = typeof data.data==='string' ? JSON.parse(data.data) : data.data;
    }else{
      NOVCFG = {anthropic_key:'',taux_hon:'18',obj_ca:'10000'};
    }
  }catch(e){console.warn('loadSharedConfig:',e);}
}

// ── Sauvegarde de la config partagée (depuis les Réglages) ─
async function saveSharedConfig(patch){
  NOVCFG = Object.assign({anthropic_key:'',taux_hon:'18',obj_ca:'10000'}, NOVCFG||{}, patch||{});
  const sb=getSB(); if(!sb)return;
  try{
    await sb.from('crm_data').upsert(
      {id:AGENCY_CFG_ROW,data:JSON.stringify(NOVCFG),updated_at:new Date().toISOString()},
      {onConflict:'id'}
    );
  }catch(e){console.warn('saveSharedConfig:',e);}
}

// ── localStorage save (cache local — toujours instantané) ─
// Cache partagé sous une clé unique. Si le quota du navigateur est dépassé
// (documents base64 volumineux), on met en cache SANS les candidats : le
// cloud (table crm_candidats) reste la source de vérité pour eux.
function saveLocal(){
 try{ localStorage.setItem('btpcrm5_agency',JSON.stringify(DB)); }
 catch(e){
   try{ const lite=Object.assign({},DB,{candidates:[]}); localStorage.setItem('btpcrm5_agency',JSON.stringify(lite)); }catch(_){}
 }
}

// ══════════════════════════════════════════════════════════════════
// PERSISTANCE CLOUD — modèle anti-perte de données
// ------------------------------------------------------------------
// AVANT : toute la base (candidats + entreprises + agenda + documents
//   base64) était un seul gros JSON dans crm_data (1 ligne). Le navigateur
//   ET le serveur réécrivaient ce bloc entier → toute écriture concurrente
//   en écrasait une autre (candidats qui disparaissent, documents perdus).
// APRÈS : chaque candidat = sa propre ligne dans crm_candidats. Le serveur
//   (dossier validé, créneau réservé) met à jour SA ligne sans toucher au
//   reste. Le navigateur ne pousse que les candidats qu'il a réellement
//   modifiés (comparaison d'empreinte), donc il n'écrase jamais le serveur.
//   Entreprises / besoins / agenda (écrits seulement par toi) restent dans
//   crm_data : c'est sûr car il n'y a qu'un seul écrivain.
// ══════════════════════════════════════════════════════════════════

let _candSnap = {};        // empreinte du dernier état persisté (id -> JSON)
let _candUpdatedAt = {};   // dernier updated_at connu par candidat (delta-load)
let _candRefreshTimer = null;

// Construit la ligne SQL d'un candidat (colonnes filtrables + objet complet).
function _candRow(c){
 return {
   id: c.id,
   name: c.name||'',
   prenom: c.prenom||'',
   nom: c.nom||'',
   email: c.email||'',
   phone: c.phone||'',
   statut: c.status||'entrant',
   poste: c.role||'',
   cat: c.cat||'',
   city: c.city||c.ville||'',
   source: c.source||'',
   data: c,
   updated_at: new Date().toISOString()
 };
}

// Indicateurs de synchro (badge en haut du CRM)
function _syncOk(){
 const ind=document.getElementById('sync-ind');
 if(ind){ind.title='Cloud OK — '+new Date().toLocaleTimeString('fr-FR');ind.textContent='● Connecté';ind.style.color='var(--green)';}
}
function _syncErr(e){
 const ind=document.getElementById('sync-ind');
 if(ind){ind.textContent='· Sync ×';ind.style.color='var(--ac3)';ind.title='Erreur sync: '+((e&&e.message)||e);}
}

// ── Sync des DONNÉES PARTAGÉES (tout sauf les candidats) vers crm_data ──
let _syncTimer=null;
function syncToSupabase(){
 clearTimeout(_syncTimer);
 _syncTimer=setTimeout(async()=>{
  const sb=getSB(); if(!sb)return;
  try{
    const shared={
      companies:   DB.companies||[],
      needs:       DB.needs||[],
      agenda:      DB.agenda||[],
      posts:       DB.posts||[],
      invoices:    DB.invoices||[],
      email_rules: DB.email_rules||[]
    };
    const {error}=await sb.from('crm_data').upsert({id:AGENCY_DATA_ROW,data:JSON.stringify(shared),updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error)throw error;
    _syncOk();
  }catch(e){ _syncErr(e); console.warn('Supabase sync (partagé) error:',e); }
 },800);
}

// ── Sync des CANDIDATS modifiés vers crm_candidats (une ligne chacun) ──
let _candSyncTimer=null;
function syncCandidates(){
 clearTimeout(_candSyncTimer);
 _candSyncTimer=setTimeout(_doCandSync,800);
}
async function _doCandSync(){
 const sb=getSB(); if(!sb)return;
 try{
   // Anti-régression : on décharge tout base64 résiduel hors des fiches AVANT
   // de les écrire vers Supabase, pour ne jamais ré-alourdir crm_candidats
   // (et donc ne jamais relancer le dépassement de bande passante).
   let _sanitized=false;
   for(const c of (DB.candidates||[])){
     if(Array.isArray(c.docs) && c.docs.some(d=>d&&typeof d.file==='string'&&d.file.startsWith('data:'))){
       const ch=await _offloadBase64Docs(c);
       if(ch) _sanitized=true;
     }
   }
   if(_sanitized) saveLocal();

   const rows=[]; const seen={};
   for(const c of (DB.candidates||[])){
     if(!c.id) c.id=(typeof uid==='function'?uid():Date.now().toString(36));
     seen[c.id]=true;
     const snap=JSON.stringify(c);
     if(_candSnap[c.id]!==snap){ rows.push(_candRow(c)); _candSnap[c.id]=snap; }
   }
   if(rows.length){
     const {error}=await sb.from('crm_candidats').upsert(rows,{onConflict:'id'});
     if(error)throw error;
   }
   // Suppressions : présents dans l'empreinte mais plus dans DB.candidates
   const toDel=Object.keys(_candSnap).filter(id=>!seen[id]);
   if(toDel.length){
     await sb.from('crm_candidats').delete().in('id',toDel);
     toDel.forEach(id=>delete _candSnap[id]);
   }
   _syncOk();
 }catch(e){ _syncErr(e); console.warn('Supabase sync (candidats) error:',e); }
}

// ══════════════════════════════════════════════════════════════════
// NOVALEM THEME ENGINE
// ══════════════════════════════════════════════════════════════════

const NOVALEM_THEMES = {
  orbital: {
    id:'orbital', name:'Orbital', desc:"Sombre et précis. L'identité NOVALEM.",
    preview:['#09090a','#c8e040','#f0f0ec'],
  },
  prestige: {
    id:'prestige', name:'Prestige', desc:"Chaleur du bois, rigueur de l'or. Wall Street.",
    preview:['#0f0b08','#d4a842','#f5ede0'],
  },
  matrix: {
    id:'matrix', name:'Matrix', desc:'Néon vert sur noir absolu. Cyberpunk.',
    preview:['#000000','#00ff88','#a0ffb0'],
  },
  aurora: {
    id:'aurora', name:'Aurora', desc:'Indigo profond, violet glacé. SaaS premium.',
    preview:['#0a0814','#7c3aed','#e0d7ff'],
  },
};

const NOVALEM_OPTIONS = {
  accent:{
    label:'Couleur accent', icon:'🎨',
    options:[
      {val:'',label:'Défaut',color:'var(--ac)'},
      {val:'gold',label:'Or',color:'#C9891A'},
      {val:'blue',label:'Bleu',color:'#4a84e2'},
      {val:'green',label:'Vert',color:'#2dd4a0'},
      {val:'red',label:'Rouge',color:'#f04b4b'},
      {val:'purple',label:'Violet',color:'#9048e0'},
    ],
  },
  radius:{
    label:'Bords', icon:'⬡',
    options:[
      {val:'',label:'Normal',preview:'8px'},
      {val:'pill',label:'Arrondi',preview:'99px'},
      {val:'sharp',label:'Carré',preview:'2px'},
      {val:'soft',label:'Doux',preview:'14px'},
    ],
  },
  anim:{
    label:'Animations', icon:'⚡',
    options:[
      {val:'',label:'Fluides',desc:'Élégant'},
      {val:'bouncy',label:'Rebonds',desc:'Vif'},
      {val:'slow',label:'Lentes',desc:'Zen'},
      {val:'instant',label:'Aucune',desc:'Instantané'},
    ],
  },
  sidebar:{
    label:'Sidebar', icon:'◧',
    options:[
      {val:'',label:'Normal',desc:'160px'},
      {val:'compact',label:'Compacte',desc:'Icônes'},
      {val:'wide',label:'Large',desc:'220px'},
    ],
  },
  density:{
    label:'Densité', icon:'⊞',
    options:[
      {val:'',label:'Normal',desc:'Équilibré'},
      {val:'compact',label:'Dense',desc:'+infos'},
      {val:'comfortable',label:'Aéré',desc:'Confort'},
    ],
  },
};

function getCurrentThemeId(){
  return localStorage.getItem(uKey('novalem_theme'))||'';
}
function getCurrentOpts(){
  try{return JSON.parse(localStorage.getItem(uKey('novalem_opts'))||'{}');}catch(_){return {};}
}
function _applyTheme(themeId,opts={},save=true){
  const html=document.documentElement;
  if(themeId)html.setAttribute('data-theme',themeId);
  else html.removeAttribute('data-theme');
  ['accent','radius','anim','sidebar','density'].forEach(k=>{
    if(opts[k])html.setAttribute(`data-${k}`,opts[k]);
    else html.removeAttribute(`data-${k}`);
  });
  if(save){
    localStorage.setItem(uKey('novalem_theme'),themeId||'');
    localStorage.setItem(uKey('novalem_opts'),JSON.stringify(opts));
  }
}
function loadTheme(){
  _applyTheme(getCurrentThemeId(),getCurrentOpts(),false);
}
function _previewTheme(id){
  const opts=getCurrentOpts();
  const themeId=id==='orbital'?'':id;
  _applyTheme(themeId,opts,true);
  Object.values(NOVALEM_THEMES).forEach(t=>{
    const el=document.getElementById(`tp-${t.id}`);
    const isActive=t.id===(id||'orbital');
    if(el){
      el.style.borderColor=isActive?'var(--ac)':'var(--bd)';
      el.style.background=isActive?'var(--ac-dim)':'var(--s3)';
    }
  });
}
function _toggleOpt(key,val){
  const opts=getCurrentOpts();
  const themeId=getCurrentThemeId();
  if(opts[key]===val)delete opts[key];
  else opts[key]=val;
  _applyTheme(themeId,opts,true);
  const allBtns=document.querySelectorAll(`[id^="opt-${key}-"]`);
  allBtns.forEach(btn=>{
    const isActive=btn.id===`opt-${key}-${val||'default'}`&&(opts[key]===val||(val===''&&!opts[key]));
    btn.style.borderColor=isActive?'var(--ac)':'var(--bd)';
    btn.style.background=isActive?'var(--ac-dim)':'var(--s3)';
    btn.style.color=isActive?'var(--ac)':'var(--mu)';
    btn.style.fontWeight=isActive?'700':'400';
  });
}
function _resetTheme(){
  _applyTheme('',{},true);
  closeMo();
  toast('Style réinitialisé ✓','i');
}

function openStylePanel(){
  const currentTheme=getCurrentThemeId();
  const currentOpts=getCurrentOpts();
  const themes=Object.values(NOVALEM_THEMES);

  const miniSvg=(t)=>{
    const [bg,ac,tx]=t.preview;
    return `<svg width="100%" height="40" viewBox="0 0 110 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="110" height="40" fill="${bg}"/>
      <rect x="0" y="0" width="24" height="40" fill="${bg}" opacity=".7"/>
      <rect x="4" y="7" width="14" height="2.5" rx="1.2" fill="${ac}" opacity=".9"/>
      <rect x="4" y="13" width="11" height="1.5" rx=".7" fill="${tx}" opacity=".3"/>
      <rect x="4" y="17" width="13" height="1.5" rx=".7" fill="${tx}" opacity=".2"/>
      <rect x="28" y="0" width="82" height="8" fill="${bg}" opacity=".5"/>
      <rect x="32" y="11" width="22" height="12" rx="2" fill="${bg}" opacity=".5" stroke="${ac}" stroke-width=".4" stroke-opacity=".5"/>
      <rect x="58" y="11" width="22" height="12" rx="2" fill="${bg}" opacity=".5" stroke="${ac}" stroke-width=".4" stroke-opacity=".35"/>
      <rect x="84" y="11" width="22" height="12" rx="2" fill="${bg}" opacity=".5" stroke="${ac}" stroke-width=".4" stroke-opacity=".2"/>
      <rect x="36" y="16" width="9" height="3" rx="1" fill="${ac}" opacity=".9"/>
      <rect x="62" y="16" width="9" height="3" rx="1" fill="${ac}" opacity=".65"/>
      <rect x="88" y="16" width="9" height="3" rx="1" fill="${ac}" opacity=".4"/>
      <rect x="32" y="28" width="70" height="2" rx="1" fill="${tx}" opacity=".2"/>
      <rect x="32" y="33" width="50" height="2" rx="1" fill="${tx}" opacity=".12"/>
      <rect x="87" y="28" width="19" height="6" rx="3" fill="${ac}" opacity=".7"/>
    </svg>`;
  };

  const themesGrid=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:4px">
    ${themes.map(t=>{
      const isActive=(currentTheme===t.id)||(t.id==='orbital'&&!currentTheme);
      return `<div onclick="_previewTheme('${t.id}')" id="tp-${t.id}" style="
        cursor:pointer;border-radius:var(--r3);overflow:hidden;
        border:2px solid ${isActive?'var(--ac)':'var(--bd)'};
        background:${isActive?'var(--ac-dim)':'var(--s3)'};
        box-shadow:${isActive?'0 0 0 1px var(--ac-border),var(--sh)':'var(--sh)'};
        transition:all .2s">
        <div style="line-height:0;overflow:hidden">${miniSvg(t)}</div>
        <div style="padding:7px 9px;border-top:1px solid var(--bd)">
          <div style="font-size:11px;font-weight:800;color:${isActive?'var(--ac)':'var(--tx)'}">
            ${t.name}${isActive?` <span style="font-size:9px;opacity:.6">✓</span>`:''}
          </div>
          <div style="font-size:9px;color:var(--mu);margin-top:2px;line-height:1.4">${t.desc}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  const optsHtml=Object.entries(NOVALEM_OPTIONS).map(([key,opt])=>{
    const current=currentOpts[key]||'';
    return `<div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--mu);margin-bottom:7px">${opt.icon} ${opt.label}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${opt.options.map(o=>{
          const active=current===o.val;
          let pre='';
          if(key==='accent'&&o.color)pre=`<span style="width:7px;height:7px;border-radius:50%;background:${o.color};display:inline-block;box-shadow:0 0 4px ${o.color}50"></span>`;
          if(key==='radius'&&o.preview)pre=`<span style="width:12px;height:8px;border:1.5px solid currentColor;border-radius:${o.preview};display:inline-block"></span>`;
          return `<button onclick="_toggleOpt('${key}','${o.val}')" id="opt-${key}-${o.val||'default'}" style="
            display:inline-flex;align-items:center;gap:4px;
            padding:4px 10px;font-size:11px;font-family:inherit;cursor:pointer;
            border-radius:var(--r2);border:1.5px solid ${active?'var(--ac)':'var(--bd)'};
            background:${active?'var(--ac-dim)':'var(--s3)'};
            color:${active?'var(--ac)':'var(--mu)'};font-weight:${active?'700':'400'};
            transition:all .15s">${pre}${o.label}${o.desc?`<span style="font-size:9px;opacity:.55">${o.desc}</span>`:''}</button>`;
        }).join('')}
      </div>
    </div>`;
  }).join('<div style="height:1px;background:var(--bd3);opacity:.4;margin:2px 0"></div>');

  openMo('🎨 Apparence & Style',`
  <div style="max-width:520px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:13px;font-weight:800;color:var(--tx)">Personnalisation du CRM</div>
        <div style="font-size:10px;color:var(--mu);margin-top:2px">Modifications appliquées en temps réel</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--green);background:var(--green-dim);border:1px solid var(--green-border);padding:3px 9px;border-radius:100px">
        <div style="width:5px;height:5px;border-radius:50%;background:var(--green)"></div>
        Live
      </div>
    </div>
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:var(--mu);margin-bottom:10px">🎭 Thème principal</div>
    ${themesGrid}
    <div style="height:1px;background:var(--bd);margin:16px 0"></div>
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:var(--mu);margin-bottom:12px">⚙ Personnalisation</div>
    <div style="display:flex;flex-direction:column;gap:12px">${optsHtml}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px;padding-top:14px;border-top:1px solid var(--bd)">
      <button onclick="_resetTheme()" style="font-size:11px;color:var(--mu);background:transparent;border:1px solid var(--bd);border-radius:var(--r);padding:5px 12px;cursor:pointer;font-family:inherit;transition:all .15s" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'" onmouseout="this.style.borderColor='var(--bd)';this.style.color='var(--mu)'">↺ Défaut</button>
      <div style="font-size:9px;color:var(--mu2)">Sauvegarde automatique · local</div>
    </div>
  </div>`,
  `<button class="btn bg" onclick="closeMo()">Fermer</button>`);
}


// ── Horloges duales France / Guadeloupe ────────────────────────
function _getTimezoneOffsetFR(){
  const now=new Date();
  const frH=parseInt(new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'numeric',hour12:false}).formatToParts(now).find(p=>p.type==='hour')?.value||0);
  const gwH=parseInt(new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Guadeloupe',hour:'numeric',hour12:false}).formatToParts(now).find(p=>p.type==='hour')?.value||0);
  let diff=frH-gwH; if(diff<0)diff+=24; return diff;
}
function frToGwada(h){let g=h-_getTimezoneOffsetFR();if(g<0)g+=24;return g;}
function gwadaToFr(h){let f=h+_getTimezoneOffsetFR();if(f>=24)f-=24;return f;}
function _formatTz(date,tz){return new Intl.DateTimeFormat('fr-FR',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);}
function _tickClocks(){
  const now=new Date();
  const frEl=document.getElementById('clock-fr');
  const gwEl=document.getElementById('clock-gwada');
  const diffEl=document.getElementById('tz-diff');
  if(frEl)frEl.textContent=_formatTz(now,'Europe/Paris');
  if(gwEl)gwEl.textContent=_formatTz(now,'America/Guadeloupe');
  if(diffEl){const d=_getTimezoneOffsetFR();diffEl.textContent=`+${d}h`;diffEl.title=`France = Gwada +${d}h`;}
}
function _updateAgTz(){
  // Affichage fuseau France/Gwada réservé au superviseur (Louis, en Guadeloupe)
  if(!isSuperviseur())return;
  const sel=document.getElementById('af-h');
  const frEl=document.getElementById('ag-tz-fr');
  const gwEl=document.getElementById('ag-tz-gw');
  if(!sel||!frEl||!gwEl)return;
  const val=sel.value;
  if(!val){frEl.textContent='—';gwEl.textContent='—';return;}
  const h=parseInt(val.split(':')[0]);
  const mn=val.split(':')[1]||'00';
  frEl.textContent=val+' 🇫🇷';
  gwEl.textContent=String(frToGwada(h)).padStart(2,'0')+':'+mn+' 🌴';
}

// ── Proposer un rappel agenda (toast non-bloquant) ────────────
function _proposeAgendaItem({type='task',title='',notes='',cand_id=null,co_id=null,delay=0,hour=9,question=''}){
  const d=new Date();
  d.setDate(d.getDate()+delay);
  while(d.getDay()===0||d.getDay()===6){d.setDate(d.getDate()+1);}
  const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const timeStr=`${String(hour).padStart(2,'0')}:00`;
  const existing=document.getElementById('_agenda-propose-mo');
  if(existing)existing.remove();
  const mo=document.createElement('div');
  mo.id='_agenda-propose-mo';
  mo.style.cssText='position:fixed;bottom:24px;right:24px;z-index:9998;background:var(--s3);border:1px solid var(--gold-bd,rgba(200,144,10,.3));border-radius:10px;padding:14px 16px;max-width:320px;box-shadow:var(--sh3);animation:slideInRight .3s ease';
  const f=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(d);
  mo.innerHTML=`<div style="display:flex;gap:10px;align-items:flex-start">
    <span style="font-size:18px;flex-shrink:0">📅</span>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:4px">${esc(question||'Ajouter à l\'agenda ?')}</div>
      <div style="font-size:10px;color:var(--mu);margin-bottom:10px">${f} à ${timeStr} — ${esc(title)}</div>
      <div style="display:flex;gap:8px">
        <button onclick="_addProposedItem()" style="flex:1;background:var(--gold);color:#fff;border:none;border-radius:6px;padding:6px;font-size:12px;font-weight:700;cursor:pointer">Oui</button>
        <button onclick="document.getElementById('_agenda-propose-mo')?.remove()" style="background:var(--s4);color:var(--mu);border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer">Non</button>
      </div>
    </div>
  </div>`;
  window._proposedItem={type,title,notes,cand_id,co_id,date:dateStr,time:timeStr};
  document.body.appendChild(mo);
  setTimeout(()=>mo.remove(),12000);
}
function _addProposedItem(){
  const p=window._proposedItem;if(!p)return;
  document.getElementById('_agenda-propose-mo')?.remove();
  addAgendaAuto({type:p.type,title:p.title,date:p.date,time:p.time,cand_id:p.cand_id,comp_id:p.co_id,notes:p.notes,_auto:true});
  save();badges();
  toast(`📅 Agenda : ${p.title}`,'s');
  window._proposedItem=null;
}

// ── Aperçu document candidat ─────────────────────────────────
async function openDocPreview(candId,docId){
  const cand=cById(candId);if(!cand)return;
  const doc=(cand.docs||[]).find(d=>d.id===docId);
  if(!doc || (!doc.file && !doc.storage_path && !doc.url && !doc._pg)){toast('Aucun fichier','w');return;}
  // Pièce dans le bucket → on régénère une URL signée fraîche (robuste à l'expiration)
  let src=(typeof doc.file==='string'&&doc.file.startsWith('data:'))?doc.file:(doc.url||doc.file||null);
  if(doc.storage_path){ const fresh=await freshDocUrl(doc.storage_path); if(fresh) src=fresh; }
  // Pièce déchargée hors fiche → on va chercher le base64 dans crm_candidat_files
  if(!src && doc._pg){
    toast('Chargement du document…','i');
    const pg=await pgFileBase64(candId, doc.id);
    if(pg && pg.base64){
      try{ src=URL.createObjectURL(_b64ToBlobApp(pg.base64, pg.mediaType||doc.type||'application/pdf')); }
      catch(_){ src='data:'+(pg.mediaType||doc.type||'application/pdf')+';base64,'+pg.base64; }
    }
  }
  if(!src){toast('Fichier indisponible','w');return;}
  const ref=(doc.name||doc.storage_path||'');
  const isPdf=doc.type==='application/pdf'||(typeof src==='string'&&src.startsWith('data:application/pdf'))||/\.pdf(\?|$)/i.test(ref);
  const isImg=(doc.type&&doc.type.startsWith('image/'))||/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(ref);
  const label=doc.name||docId;
  document.getElementById('doc-preview-ov')?.remove();
  const ov=document.createElement('div');
  ov.id='doc-preview-ov';
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px';
  ov.onclick=(e)=>{if(e.target===ov)ov.remove();};
  let content='';
  if(isPdf)content=`<iframe src="${src}" style="width:min(880px,96vw);height:min(88vh,900px);border:none;border-radius:8px;background:#fff"></iframe>`;
  else if(isImg)content=`<img src="${src}" style="max-width:min(880px,96vw);max-height:min(88vh,900px);object-fit:contain;border-radius:8px">`;
  else content=`<div style="background:var(--s2);border-radius:8px;padding:32px;text-align:center;color:var(--mu)"><div style="font-size:40px;margin-bottom:12px">📄</div><div>${esc(label)}</div></div>`;
  ov.innerHTML=`<div style="max-width:min(900px,98vw)"><div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;margin-bottom:10px"><div style="font-size:13px;font-weight:700;color:#fff">${esc(label)}</div><div style="display:flex;gap:8px"><a href="${src}" target="_blank" download="${esc(label)}" style="background:var(--gold);color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:12px;font-weight:700;text-decoration:none">⬇ Télécharger</a><button onclick="document.getElementById('doc-preview-ov').remove()" style="background:#2a2a2e;color:#aaa;border:none;border-radius:6px;padding:7px 12px;font-size:12px;cursor:pointer">× Fermer</button></div></div>${content}</div>`;
  document.body.appendChild(ov);
}

// ── CSS animation toast agenda ────────────────────────────────
(()=>{
  if(document.getElementById('_agenda-css'))return;
  const st=document.createElement('style');
  st.id='_agenda-css';
  st.textContent='@keyframes slideInRight{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}';
  document.head.appendChild(st);
})();

// Theme + clocks init (runs immediately on script parse)
loadTheme();
setInterval(_tickClocks,1000);_tickClocks();

// ── save() = cache local immédiat + cloud en arrière-plan ──
// Pousse les données partagées (crm_data) ET les candidats modifiés (crm_candidats).
function save(){
 saveLocal();
 syncToSupabase();
 syncCandidates();
}

// ── Chargement complet depuis le cloud (partagé + candidats) ──
async function loadAllFromCloud(){
 const sb=getSB(); if(!sb) return false;
 // 1. Données partagées (entreprises, besoins, agenda, posts, factures, règles)
 try{
   const {data,error}=await sb.from('crm_data').select('data').eq('id',AGENCY_DATA_ROW).maybeSingle();
   if(!error && data && data.data){
     const shared = typeof data.data==='string' ? JSON.parse(data.data) : data.data;
     if(shared){
       DB.companies   = shared.companies   || [];
       DB.needs       = shared.needs       || [];
       DB.agenda      = shared.agenda      || [];
       DB.posts       = shared.posts       || [];
       DB.invoices    = shared.invoices    || [];
       DB.email_rules = shared.email_rules || [];
     }
   }
 }catch(e){ console.warn('[load] données partagées:',e); }
 // 2. Candidats (table dédiée — une ligne chacun)
 try{ await loadCandidates(); }catch(e){ console.warn('[load] candidats:',e); }
 try{ window.DB=DB; }catch(_){}
 saveLocal();
 // 3. Rafraîchissement périodique sûr (remplace l'ancien minuteur destructeur)
 if(!_candRefreshTimer) _candRefreshTimer=setInterval(refreshCandidates, 60000);
 return true;
}

// Charge tous les candidats depuis crm_candidats dans DB.candidates.
async function loadCandidates(){
 const sb=getSB(); if(!sb)return;
 const {data,error}=await sb.from('crm_candidats').select('data,updated_at').order('updated_at',{ascending:false});
 if(error)throw error;
 const rows=(data||[]).filter(r=>r && r.data);
 const list=rows.map(r=> typeof r.data==='string'?JSON.parse(r.data):r.data ).filter(Boolean);
 DB.candidates=list;
 _candSnap={}; _candUpdatedAt={};
 for(const r of rows){
   const c = typeof r.data==='string'?JSON.parse(r.data):r.data;
   if(c && c.id){ _candSnap[c.id]=JSON.stringify(c); _candUpdatedAt[c.id]=r.updated_at; }
 }
 try{ window.DB=DB; }catch(_){}
}

// Re-tire les candidats du cloud et fusionne ce que le serveur a écrit
// (dossier validé, créneau réservé, documents déposés) sans écraser tes
// modifications locales en cours.
async function refreshCandidates(){
 const sb=getSB(); if(!sb)return;
 // 1. On ne tire d'abord QUE les empreintes légères (id + updated_at) : quelques
 //    octets, même avec des centaines de fiches. On ne télécharge le contenu
 //    complet que des fiches réellement nouvelles ou modifiées côté serveur.
 let metas;
 try{
   const r=await sb.from('crm_candidats').select('id,updated_at').order('updated_at',{ascending:false});
   if(r.error)throw r.error;
   metas=r.data||[];
 }catch(e){ console.warn('[refresh] empreintes candidats:',e); return; }

 const toFetch=[];
 for(const m of metas){
   if(!m || !m.id) continue;
   const known=_candUpdatedAt[m.id];
   const present=(DB.candidates||[]).some(x=>x.id===m.id);
   if(!present || known!==m.updated_at) toFetch.push(m.id);
 }
 if(!toFetch.length) return; // rien de neuf → zéro téléchargement

 let rows;
 try{
   const r=await sb.from('crm_candidats').select('data,updated_at').in('id', toFetch);
   if(r.error)throw r.error;
   rows=r.data||[];
 }catch(e){ console.warn('[refresh] contenu candidats:',e); return; }

 let changed=false;
 for(const row of rows){
   const cc = typeof row.data==='string'?JSON.parse(row.data):row.data;
   if(!cc || !cc.id) continue;
   _candUpdatedAt[cc.id]=row.updated_at;
   const idx=(DB.candidates||[]).findIndex(x=>x.id===cc.id);
   if(idx<0){
     DB.candidates.unshift(cc);
     _candSnap[cc.id]=JSON.stringify(cc);
     changed=true;
   }else{
     const local=DB.candidates[idx];
     const localStr=JSON.stringify(local);
     if(_candSnap[cc.id]===localStr){
       // Local non modifié depuis la dernière synchro → le cloud fait foi
       const ccStr=JSON.stringify(cc);
       if(ccStr!==localStr){ DB.candidates[idx]=cc; _candSnap[cc.id]=ccStr; changed=true; }
     }else{
       // Local modifié non sauvegardé → on ne fusionne QUE les champs serveur
       const merged=_mergeServerFields(local,cc);
       if(JSON.stringify(merged)!==localStr){ DB.candidates[idx]=merged; changed=true; }
     }
   }
 }
 if(changed){
   saveLocal();
   if(typeof scanBookings==='function'){ try{scanBookings();}catch(_){}}
   if(typeof badges==='function'){ try{badges();}catch(_){}}
   if(typeof UI!=='undefined' && UI){
     if(UI.view==='cands' && typeof rCands==='function'){ try{rCands();}catch(_){}}
     if(UI.view==='dash' && typeof rDash==='function'){ try{rDash();}catch(_){}}
   }
 }
}

// Champs écrits EXCLUSIVEMENT par le serveur (réception dossier / réservation).
function _mergeServerFields(local,cloud){
 const out=Object.assign({},local);
 ['_dossier_validated','_dossier_validated_at','_dossier_ref','_dossier_data','_dossier_signed_at','_dossier_notif_seen','_dossier_tracking','booking_notif_seen'].forEach(f=>{
   if(cloud[f]!==undefined) out[f]=cloud[f];
 });
 // booking : on prend la version cloud mais on garde le flag local _agenda_added
 if(cloud.booking!==undefined){
   const b=Object.assign({},cloud.booking);
   if(local.booking && local.booking._agenda_added) b._agenda_added=true;
   out.booking=b;
 }
 // documents : union par id (ne perd ni les tiens ni ceux du dossier).
 // Si une pièce existe des deux côtés et que la version locale est encore en
 // base64 alors que le cloud l'a allégée (_pg / bucket), on prend le cloud.
 if(Array.isArray(cloud.docs)){
   const localDocs=(out.docs||[]).slice();
   const idx={}; localDocs.forEach((d,i)=>{ if(d&&d.id) idx[d.id]=i; });
   cloud.docs.forEach(cd=>{
     if(!cd||!cd.id) return;
     if(idx[cd.id]===undefined){ localDocs.push(cd); }
     else{
       const ld=localDocs[idx[cd.id]];
       const localIsB64 = ld && typeof ld.file==='string' && ld.file.startsWith('data:');
       const cloudIsLight = !(cd.file && typeof cd.file==='string' && cd.file.startsWith('data:'));
       if(localIsB64 && cloudIsLight) localDocs[idx[cd.id]]=cd;
     }
   });
   out.docs=localDocs;
 }
 return out;
}

// ── load() au démarrage = cache local instantané, puis cloud ──
async function load(){
 // 1. Cache local d'abord (instantané)
 try{
   const local=JSON.parse(localStorage.getItem('btpcrm5_agency'));
   if(local){ DB=Object.assign({candidates:[],companies:[],needs:[],agenda:[],posts:[],invoices:[],email_rules:[]},local); try{window.DB=DB;}catch(_){}}
 }catch(e){/* DB vierge */}
 // 2. Indicateur de connexion
 if(typeof updateConnIndicator==='function')updateConnIndicator();
 // 3. Config d'agence partagée (clé Anthropic, taux, objectif CA) — bornée
 await _withTimeout(loadSharedConfig(), 8000, null);
 // 4. Données cloud (partagé + candidats)
 const sb=getSB();
 if(!sb)return; // Pas de client — cache local seul
 try{
   // Borné : si le cloud est lent/restreint, on n'attend pas indéfiniment.
   // Le cache local est déjà chargé ci-dessus ; les fiches arriveront au
   // prochain refresh dès que le cloud répond.
   await _withTimeout(loadAllFromCloud(), 9000, false);
   if(!_candRefreshTimer) _candRefreshTimer=setInterval(refreshCandidates, 60000);
   if(typeof rDash==='function')rDash();
   if(typeof badges==='function')badges();
   const ind=document.getElementById('sync-ind');
   if(ind){ind.textContent='● Connecté';ind.style.color='var(--green)';ind.title='Données chargées — '+new Date().toLocaleTimeString('fr-FR');}
 }catch(e){
   console.warn('Supabase load error:',e);
   const ind=document.getElementById('sync-ind');
   if(ind){ind.textContent='· Sync ×';ind.style.color='var(--ac3)';ind.title='Cloud inaccessible — données locales utilisées';}
 }
}

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const now_=()=>new Date().toISOString();
const ago=(n)=>new Date(Date.now()-n*86400000).toISOString();
const inDays=(n)=>new Date(Date.now()+n*86400000).toISOString();

// ═══════════════════════════════════════════════════════
// DATES — moteur timezone-safe (source unique de vérité)
// Règle d'or : une date d'agenda est une JOURNÉE CALENDAIRE LOCALE
// "YYYY-MM-DD", jamais un instant UTC. On ne fait JAMAIS
// new Date("YYYY-MM-DD") (interprété minuit UTC → décalage d'un jour).
// ═══════════════════════════════════════════════════════
// Renvoie la clé jour locale (YYYY-MM-DD) de n'importe quelle valeur
// (chaîne date seule, timestamp ISO complet, Date, ou nombre ms).
function dayKey(v){
 if(v===null||v===undefined||v==='') return '';
 if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0,10);
 const d=(v instanceof Date)?v:new Date(v);
 if(isNaN(d.getTime())) return (typeof v==='string'?v.slice(0,10):'');
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// Clé jour d'aujourd'hui (locale)
function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
// Parse une valeur date en Date locale SANS décalage (date seule → midi local)
function parseDayLocal(v){
 if(!v) return null;
 if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v+'T12:00:00');
 const d=new Date(v); return isNaN(d.getTime())?null:d;
}
// Ajoute n jours OUVRÉS (saute samedi/dimanche) à une date → renvoie une Date
function addWorkingDays(baseDate,n){
 const d=baseDate?new Date(baseDate.getTime()):new Date();
 let added=0;
 while(added<n){d.setDate(d.getDate()+1);const wd=d.getDay();if(wd!==0&&wd!==6)added++;}
 return d;
}
// Décale une clé jour de n jours (n peut être négatif), renvoie une clé jour
function shiftDayKey(key,n){const d=parseDayLocal(key)||new Date();d.setDate(d.getDate()+n);return dayKey(d);}

// Affichage court : 06/06/2026 — timezone-safe (date seule traitée comme jour local)
const fD=(iso)=>{if(!iso)return'—';const d=parseDayLocal(iso);return d?d.toLocaleDateString('fr-FR'):'—';};
const fM=(n)=>{if(!n&&n!==0)return'—';return Number(n).toLocaleString('fr-FR')+'€';};
const honor=(s)=>{const taux=Number(getTauxHon())/100;return s?fM(Math.round(Number(s)*taux)):'—';};
const esc=(s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ═══════════════════════════════════════════════════════
// CIVILITÉ EMAILS — "Monsieur Dupont" / "Madame Dupont"
// Objectif : dans les mails, utiliser le NOM DE FAMILLE (pas le prénom),
// précédé de Monsieur/Madame. Si on ne peut pas déterminer le genre de
// façon fiable, on retombe sur "Madame, Monsieur" (toujours correct, jamais vexant).
// ═══════════════════════════════════════════════════════
const _NAMES_F=new Set('marie nathalie isabelle sylvie catherine francoise martine christine monique nicole sandrine valerie veronique stephanie celine julie aurelie emilie laure laura camille manon lea chloe sarah emma clara ines jade louise alice anais elodie audrey amandine marine pauline charlotte juliette justine oceane mathilde melanie caroline laetitia virginie sophie delphine carole patricia brigitte chantal jacqueline annie helene florence corinne sabrina karine severine fanny laurence agnes claire elise marion morgane jessica vanessa elsa lucie eva zoe maelys lina romane jeanne alicia maeva noemie cindy aurore gwendoline solene angelique estelle myriam samira nadia fatima leila yasmine anne agathe apolline maud lou capucine garance ambre maelle rose anna gabrielle margaux flavie lou-anne ophelie pascale dominique-f beatrice colette denise ginette odette suzanne yvette'.split(' '));
const _NAMES_M=new Set('jean pierre michel andre philippe rene louis alain jacques bernard marcel daniel roger robert claude henri georges paul christian gerard maurice raymond guy joseph francois fernand lucien marc thierry pascal patrick laurent stephane david frederic nicolas sebastien julien olivier vincent christophe bruno eric franck cedric jerome fabrice jonathan kevin anthony alexandre maxime romain thomas antoine quentin theo hugo lucas enzo nathan ethan gabriel raphael arthur jules adam noah leo tom mathis mohamed yanis ismael ayoub bilal sofiane karim mehdi samir mickael cyril damien dimitri florian gaetan gregory loic ludovic remi sylvain teddy valentin william yann mathieu benjamin emmanuel guillaume corentin clement baptiste victor martin simon adrien aurelien xavier herve gilles denis joel fabien gilbert didier serge yves alban regis come jean-claude jean-pierre jean-luc jean-marc jean-michel hadrien gaspard hippolyte come edouard augustin matheo ilyes rayan amine walid abdel'.split(' '));
function _firstWord(s){return String(s||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[\s'-]+/).filter(Boolean)[0]||'';}
// Devine le genre d'après le prénom. Renvoie 'F', 'M' ou null (incertain).
function guessCivilite(prenom){
  var p=_firstWord(prenom); if(!p) return null;
  if(_NAMES_F.has(p)) return 'F';
  if(_NAMES_M.has(p)) return 'M';
  return null;
}
// Met la 1re lettre de chaque mot du nom en majuscule (Dupont, De La Tour)
function _capName(s){return String(s||'').trim().split(/\s+/).filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');}
// Construit la formule d'appel d'un email.
// opts: {fullName, prenom, nom, civilite}  civilite = 'M' | 'F' | 'Mme' | 'M.' | null
function mailGreeting(opts){
  opts=opts||{};
  var prenom=opts.prenom||'', nom=opts.nom||'', full=opts.fullName||'';
  if((!prenom||!nom) && full){
    var parts=String(full).trim().split(/\s+/).filter(Boolean);
    if(parts.length>=2){ if(!prenom)prenom=parts[0]; if(!nom)nom=parts.slice(1).join(' '); }
    else if(parts.length===1 && !prenom){ prenom=parts[0]; }
  }
  var c=opts.civilite;
  var g=(c==='F'||c==='Mme')?'F':((c==='M'||c==='M.')?'M':null);
  if(!g) g=guessCivilite(prenom);
  var last=_capName(nom);
  if(g==='F' && last) return 'Madame '+last;
  if(g==='M' && last) return 'Monsieur '+last;
  return 'Madame, Monsieur'; // genre indéterminé → formule de politesse neutre, sans prénom
}
// Raccourcis pour candidat / contact entreprise
function greetCand(c){ if(!c) return 'Madame, Monsieur'; return mailGreeting({fullName:c.name,prenom:c.prenom,nom:c.nom,civilite:c.civilite}); }
function greetCo(co){ if(!co) return 'Madame, Monsieur'; return mailGreeting({fullName:co.contact,prenom:co.contact_prenom,nom:co.contact_nom,civilite:co.civilite}); }

// Format phone: 0658212090 → 06 58 21 20 90
const fPhone=(n)=>{if(!n)return'—';const d=String(n).replace(/\D/g,'');if(d.length===10)return d.match(/.{2}/g).join('\u202f');if(d.length===9)return d.match(/.{2}/g).join('\u202f');return String(n);};
const getCat=(id)=>BTP_CATS.find(c=>c.id===id)||BTP_CATS[0];
// Exposé sur window : le module Annonces Pro lit `window.getCat` pour libeller
// le secteur BTP dans le prompt IA (sinon repli silencieux sur « BTP »).
try{ window.getCat = getCat; }catch(_){}
const getCS=(id)=>CAND_ST.find(s=>s.id===id)||CAND_ST[0];
const getCmpS=(id)=>COMP_ST.find(s=>s.id===id)||COMP_ST[0];
const getNS=(id)=>[{id:'open',l:'Ouvert'},{id:'sent',l:'CV envoyés'},{id:'interview',l:'Entretiens'},{id:'won',l:'Placé'},{id:'lost',l:'Perdu'}].find(s=>s.id===id)||{id:'open',l:'Ouvert'};
const cById=(id)=>DB.candidates.find(c=>c.id===id);
const coById=(id)=>DB.companies.find(c=>c.id===id);
const nById=(id)=>DB.needs.find(n=>n.id===id);
const agById=(id)=>DB.agenda.find(a=>a.id===id);
// Timezone-safe : compare des JOURNÉES locales, jamais des instants UTC.
const isToday=(iso)=>!!iso&&dayKey(iso)===todayKey();
const isTomorrow=(iso)=>!!iso&&dayKey(iso)===shiftDayKey(todayKey(),1);
const isPast=(iso)=>!!iso&&dayKey(iso)<todayKey(); // strictement avant aujourd'hui
const daysDiff=(iso)=>iso?Math.floor((Date.now()-new Date(iso))/86400000):0;

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
function toast(msg,t='s'){
 const el=document.createElement('div');
 el.className=`toast t${t}`;el.textContent=msg;
 document.getElementById('toaster').appendChild(el);
 setTimeout(()=>el.classList.add('show'),10);
 setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),200);},2200);
}

// ═══════════════════════════════════════════════════════
// VIEW
// ═══════════════════════════════════════════════════════
function go(v){
 UI.view=v;
 document.querySelectorAll('.ni').forEach(el=>el.classList.toggle('act',el.dataset.v===v));
 document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
 document.getElementById('view-'+v).classList.add('active');
 const T={dash:'Dashboard',cands:'Candidats',needs:'Besoins',pros:'Prospects',clients:'Clients',agenda:'Agenda',posts:'Annonces',emails:'Emails',reporting:'Reporting',facturation:'Facturation'};
 document.getElementById('tbt').textContent=T[v]||v;
 const A={dash:'',facturation:`<button class="btn bp bsm" onclick="openInvoiceForm()">+ Facture</button>`,cands:`<button class="btn bp bsm" onclick="openCandForm()">+ Candidat</button><label class="btn bg bsm" style="cursor:pointer">↑ CSV<input type="file" accept=".csv" style="display:none" onchange="importCandCsv(event)"></label>`,needs:`<button class="btn bp bsm" onclick="openNeedForm()">+ Besoin</button>`,pros:`<button class="btn bg bsm" onclick="downloadCsvTemplate()">↓ Modèle</button><label class="btn bg bsm" style="cursor:pointer">↑ Import Excel / CSV<input type="file" accept=".csv,.xlsx,.xls,.txt" style="display:none" onchange="importProspects(event)"></label><button class="btn bp bsm" onclick="openCoForm()">+ Prospect</button>`,clients:``,agenda:`<button class="btn bp bsm" onclick="openAgForm()">+ Événement</button>`,posts:`<button class="btn bp bsm" onclick="openPostForm()">+ Annonce</button>`};
 document.getElementById('tba').innerHTML=A[v]||'';
 ({dash:rDash,cands:rCands,needs:rNeeds,pros:rPros,clients:rClients,cvtheque:rCVtheque,agenda:rAgenda,posts:rPosts,emails:rEmails,reporting:rReporting,facturation:rFacturation})[v]?.();
 badges();
}

function badges(){
 const active=DB.candidates.filter(c=>!['ko','placed'].includes(c.status));
 document.getElementById('badge-cands').textContent=active.length;
 document.getElementById('badge-needs').textContent=DB.needs.filter(n=>n.status==='open').length;
 const pros=DB.companies.filter(c=>c.type==='prospect'&&c.status!=='nobiz').length;
 document.getElementById('badge-pros').textContent=pros;
 // urgency badge
 const urg=computeAlerts().length;
 const ub=document.getElementById('badge-urg');
 ub.textContent=urg;ub.style.display=urg?'':'none';
 // agenda today
 const ag=DB.agenda.filter(a=>!a.done&&isToday(a.date)).length;
 const ab=document.getElementById('badge-ag');
 ab.textContent=ag;ab.style.display=ag?'':'none';
 // revenue
 const rev=DB.candidates.filter(c=>c.status==='placed').reduce((a,c)=>a+(Number(c.salary||0)*.18),0);
 document.getElementById('nf-rev').textContent=rev?fM(Math.round(rev)):'0€';
 // Invoice badge: unpaid/overdue
 const unpaid=(DB.invoices||[]).filter(inv=>['sent','overdue'].includes(inv.status)).length;
 const ib=document.getElementById('badge-inv');
 if(ib){ib.textContent=unpaid;ib.style.display=unpaid?'':'none';}
}

// ═══════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════
function computeAlerts(){
 const a=[];
 DB.candidates.forEach(c=>{
 if(c.status==='new') a.push({color:'var(--ac4)',msg:`Précal à faire : ${c.name}`,act:`openCandPanel('${c.id}')`});
 if(c._dossier_validated&&!c._dossier_notif_seen){
   a.push({color:'var(--ac2)',msg:'&#x2705; Dossier validé — '+c.name+' — prêt à envoyer en anonyme',act:"openCandPanel('"+c.id+"')"});
  }
  if(c.booking&&c.booking.status==='booked'&&c.booking.picked&&c.booking_notif_seen===false){
   const bp=c.booking.picked;
   const bw=new Date(bp.dt).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' à '+bp.h+'h';
   a.push({color:'var(--ac2)',msg:'&#x1F4C5; '+c.name+' a validé son dossier — entretien réservé le '+bw,act:"openEntrantSplit('"+c.id+"')"});
  }
  if(c.status==='entrant'&&daysDiff(c.created)>2) a.push({color:'var(--ac4)',msg:`Entrant sans action (${daysDiff(c.created)}j) : ${c.name}`,act:`switchCandTab('trier');go('cands');openEntrantSplit('${c.id}')`});
 if(c.status==='precal'&&daysDiff(c.updated)>5&&!c.int_date_planned) a.push({color:'var(--ac6)',msg:`Entretien non planifié (${daysDiff(c.updated)}j) : ${c.name}`,act:`openCandPanel('${c.id}')`});
 if(c.status==='dossier'&&!c._dossier_validated&&daysDiff(c.updated)>2) a.push({color:'var(--ac3)',msg:`Dossier sans retour (${daysDiff(c.updated)}j) : ${c.name}`,act:`openCandPanel('${c.id}')`});
 if(c.status==='presented'&&daysDiff(c.updated)>3) a.push({color:'var(--ac3)',msg:`Client sans retour (${daysDiff(c.updated)}j) sur ${c.name}`,act:`openCandPanel('${c.id}')`});
 if(c.status==='interview'&&daysDiff(c.updated)>3) a.push({color:'var(--ac5)',msg:`Synthèse entretien manquante : ${c.name}`,act:`openCandPanel('${c.id}')`});
 });
 // Prospects avec rappel dû aujourd'hui
 const today=new Date();today.setHours(0,0,0,0);
 DB.companies.filter(c=>c.type==='prospect'&&c.status==='nobiz'&&c.nobiz_remind&&new Date(c.nobiz_remind)<=today).forEach(c=>
 a.push({color:'var(--ac4)',msg:`Rappel prospect : ${c.name}`,act:`go('pros')`})
);
 DB.agenda.filter(a=>!a.done&&isPast(a.date)&&!isToday(a.date)).forEach(ev=>
 a.push({color:'var(--ac6)',msg:`En retard : ${ev.title}`,act:`go('agenda')`})
);
 // Factures en retard
 const todayStr=todayKey();
 (DB.invoices||[]).filter(inv=>inv.status==='sent'&&inv.due_date&&inv.due_date<todayStr).forEach(inv=>{
 const co=coById(inv.company_id);
 a.push({color:'var(--ac3)',msg:`Facture impayée en retard — ${co?co.name:'?'} (${fM(inv.amount)})`,act:`go('facturation')`});
 });
 // Relances profil J+3
 DB.agenda.filter(function(ag){return !ag.done&&ag._profile_followup;}).forEach(function(ag){
  var diff=(parseDayLocal(ag.date)-new Date())/86400000;
  if(diff<2){
   var co2=coById(ag.comp_id),ca2=cById(ag.cand_id);
   a.push({color:'var(--ac5)',msg:'&#x1F4DE; Rappeler '+(co2?co2.name:'client')+' — réception CV '+(ca2?ca2.name:''),act:"openAgPanel('"+ag.id+"')"});
  }
 });
 // Contrat envoyé non signé → relance urgente à partir de J+2
 DB.companies.forEach(function(co){
  var ct=co._contract_draft;
  if(ct&&ct.sent_at&&!co._contract_signed){
   var dj=daysDiff(ct.sent_at);
   if(dj>=2) a.push({color:'var(--ac6)',msg:'&#x26A1; Contrat non signé ('+dj+'j) : '+co.name+' — relancer la signature',act:"UI.ptab=4;openCoPanel('"+co.id+"')"});
  }
 });
 return a;
}


// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
// ── COCKPIT AGENDA (dashboard) — charge mentale zéro ──
// Une ligne d'agenda riche : icône, titre, entité liée, extrait de note (contexte), heure colorée par état.
function dashAgRow(a){
 const t=agType(a.type);
 const ctx=agendaContext(a);
 const ent=(ctx.co&&ctx.co.name)||(ctx.ca&&ctx.ca.name)||'';
 const stt=agendaState(a);
 const C={overdue:'var(--red)',today:'var(--gold)',soon:'var(--blue)',upcoming:'var(--mu)',done:'var(--green)'}[stt]||'var(--mu)';
 const note=a.notes?a.notes.replace(/\n/g,' '):'';
 return `<div class="aitem" onclick="openAgPanel('${a.id}')" style="align-items:flex-start;border-left:2px solid ${C}">
   <span style="font-size:13px;flex-shrink:0;line-height:1.3">${t.ico}</span>
   <div style="flex:1;min-width:0">
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><strong style="font-size:11px">${esc(a.title)}</strong>${ent?`<span style="font-size:9px;color:var(--mu2)">· ${esc(ent)}</span>`:''}</div>
    ${note?`<div style="font-size:10px;color:var(--mu);margin-top:2px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(note)}</div>`:''}
   </div>
   <span style="font-size:10px;font-weight:700;color:${C};flex-shrink:0">${a.time||(stt==='today'?'Jour':'')}</span>
 </div>`;
}
function dashInterviewCard(a){
 const ca=a.cand_id?cById(a.cand_id):null;const visioLink=ca&&ca.visio_link||null;
 return `<div class="interview-card" onclick="${ca?`openInterviewModal('${ca.id}')`:`openAgPanel('${a.id}')`}"><div class="interview-time">${a.time||'—'}</div><div class="interview-info"><div class="interview-name">${esc(a.title)}</div><div class="interview-sub">${ca?esc(ca.name):''}</div></div>${visioLink?`<a href="${esc(visioLink)}" target="_blank" onclick="event.stopPropagation()" class="btn bi bxs">Rejoindre</a>`:''}</div>`;
}
function renderDashAgendaBlocks(){
 const byTime=(a,b)=>((a.time||'99')>(b.time||'99')?1:-1);
 const overdue=DB.agenda.filter(a=>!a.done&&isPast(a.date)).sort((a,b)=>((a.date||'')+(a.time||''))<((b.date||'')+(b.time||''))?-1:1);
 const interviews=DB.agenda.filter(a=>!a.done&&isToday(a.date)&&a.type==='visio').sort(byTime);
 const todayOther=DB.agenda.filter(a=>!a.done&&isToday(a.date)&&a.type!=='visio').sort(byTime);
 const tomorrow=DB.agenda.filter(a=>!a.done&&isTomorrow(a.date)).sort(byTime);
 const cnt=(n,c)=>`<span style="font-size:9px;color:${c||'var(--mu)'};font-family:'DM Mono',monospace;font-weight:700;margin-left:4px">(${n})</span>`;
 let h='';
 if(overdue.length){
  h+=`<div class="dsec" style="color:var(--red)">⚠ En retard${cnt(overdue.length,'var(--red)')}</div>`;
  h+=overdue.slice(0,5).map(dashAgRow).join('');
  if(overdue.length>5)h+=`<div style="font-size:10px;color:var(--mu);padding:4px 10px">+${overdue.length-5} autre(s) · <span style="color:var(--blue);cursor:pointer" onclick="go('agenda')">voir l'agenda →</span></div>`;
 }
 h+=`<div class="dsec${overdue.length?' mt14':''}">Entretiens du jour${interviews.length?cnt(interviews.length,'var(--blue)'):''}</div>`;
 h+=interviews.length?interviews.map(dashInterviewCard).join(''):`<div class="aitem"><span class="mu_ fs10">Aucun entretien aujourd'hui</span></div>`;
 h+=`<div class="dsec mt14">À faire aujourd'hui${todayOther.length?cnt(todayOther.length,'var(--gold)'):''}</div>`;
 h+=todayOther.length?todayOther.map(dashAgRow).join(''):`<div class="aitem"><span class="mu_ fs10">Rien d'autre aujourd'hui ✓</span></div>`;
 if(tomorrow.length){
  h+=`<div class="dsec mt14" style="color:var(--blue)">Demain — anticiper${cnt(tomorrow.length,'var(--blue)')}</div>`;
  h+=tomorrow.slice(0,4).map(dashAgRow).join('');
  if(tomorrow.length>4)h+=`<div style="font-size:10px;color:var(--mu);padding:4px 10px">+${tomorrow.length-4} demain · <span style="color:var(--blue);cursor:pointer" onclick="go('agenda')">voir →</span></div>`;
 }
 return h;
}

function rDash(){
 const c=DB.candidates;
 const placed=c.filter(x=>x.status==='placed');
 const active=c.filter(x=>!['ko','placed','entrant'].includes(x.status));
 const ents=c.filter(x=>x.status==='entrant');
 const revEnc=placed.reduce((a,x)=>a+(Number(x.salary||0)*.18),0);
 const revPot=active.reduce((a,x)=>a+(Number(x.salary||0)*.18),0);
 const alerts=computeAlerts();
 const todayAg=DB.agenda.filter(a=>!a.done&&isToday(a.date)).sort((a,b)=>a.time>b.time?1:-1);

 // Action prioritaire n°1
 const topAlert=alerts[0]||null;

 // Entretien imminent (dans les 60min ou en cours)
 const now=new Date();
 const imminentInt=DB.agenda.find(a=>{
 if(a.done||!isToday(a.date)||a.type!=='visio'||!a.time)return false;
 const [h,m]=(a.time||'00:00').split(':').map(Number);
 const agT=new Date();agT.setHours(h,m,0,0);
 const diff=(agT-now)/60000;
 return diff>=-5&&diff<=60;
 });

 const imminentBanner=imminentInt?`
 <div class="entretien-now">
 <div class="entretien-time">${imminentInt.time}</div>
 <div class="entretien-info">
 <div class="entretien-name"> ${esc(imminentInt.title)}</div>
 <div style="font-size:10px;color:var(--mu);margin-top:2px">${imminentInt.cand_id&&cById(imminentInt.cand_id)?esc(cById(imminentInt.cand_id).name)+' — ':''}Entretien imminent ou en cours</div>
 </div>
 ${imminentInt.cand_id&&cById(imminentInt.cand_id)?.visio_link?`<a href="${esc(cById(imminentInt.cand_id).visio_link)}" target="_blank" class="btn bi">Rejoindre</a>`:''}
 </div>`:'';

 // Notif contrat signé non acquittée
 const cn=DB._contract_notif;
 const contractBanner=cn?'<div style="background:rgba(45,212,160,.1);border:1px solid rgba(45,212,160,.3);border-left:3px solid var(--green);border-radius:var(--r2);padding:13px 16px;margin-bottom:12px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="goToSignedContract()"><span style="font-size:20px">&#x2705;</span><div style="flex:1"><div style="font-family:Syne,sans-serif;font-weight:700;font-size:13px;color:var(--green)">Contrat sign&eacute; &mdash; envoyer le contact candidat</div><div style="font-size:11px;color:var(--mu);margin-top:2px">'+esc(cn.coName||'Client')+' a sign&eacute;'+(cn.signer?' ('+esc(cn.signer)+')':'')+' &middot; cliquez pour valider le placement</div></div><button class="btn bg bxs" onclick="event.stopPropagation();dismissContractNotif()" style="font-size:10px">&#x2715;</button>&nbsp;<button class="btn bp bxs" onclick="event.stopPropagation();goToSignedContract()">Valider &rarr;</button></div>':'';

 const priorityBanner=topAlert?`
 <div class="priority-action ${topAlert.color==='var(--ac3)'?'':' warn'}" onclick="${topAlert.act}" style="cursor:pointer;margin-bottom:12px">
 <div class="priority-dot ${topAlert.color==='var(--ac3)'?'red':'orange'}"></div>
 <div class="priority-msg">
 <strong>Action prioritaire</strong>
 <span>${esc(topAlert.msg)}</span>
 </div>
 <button class="btn bp bsm" onclick="${topAlert.act}">→ Traiter</button>
 </div>`:'';

 document.getElementById('view-dash').innerHTML=contractBanner+imminentBanner+priorityBanner+`
 <div class="dkpi">
 <div class="kpi" style="cursor:pointer" onclick="switchCandTab('encours');go('cands')"><div class="kpi-v ac2">${active.length}</div><div class="kpi-l">Pipeline actif</div><div class="kpi-s">${ents.length} entrant(s) à trier</div></div>
 <div class="kpi"><div class="kpi-v ac">${placed.length}</div><div class="kpi-l">Placements</div><div class="kpi-s">${fM(Math.round(revEnc))} encaissé</div></div>
 <div class="kpi" style="cursor:pointer" onclick="go('needs')"><div class="kpi-v" style="color:var(--ac4)">${DB.needs.filter(n=>n.status==='open').length}</div><div class="kpi-l">Besoins ouverts</div><div class="kpi-s">${DB.needs.length} au total</div></div>
 <div class="kpi" style="cursor:pointer" onclick="go('clients')"><div class="kpi-v ac5">${DB.companies.filter(co=>co.type==='client').length}</div><div class="kpi-l">Clients</div><div class="kpi-s">${DB.companies.filter(co=>co.type==='prospect').length} prospects</div></div>
 <div class="kpi"><div class="kpi-v" style="color:var(--ac6)">${fM(Math.round(revPot))}</div><div class="kpi-l">CA potentiel</div><div class="kpi-s">si tous placés</div></div>
 <div class="kpi" style="cursor:pointer" onclick="go('cands')"><div class="kpi-v ac3">${alerts.length}</div><div class="kpi-l">Actions req.</div><div class="kpi-s">${todayAg.length} événement(s) today</div></div>
 </div>
 <div class="dg">
 <div>
 <div class="dsec">Actions requises <span style="font-size:9px;color:var(--mu);font-family:'DM Mono',monospace;font-weight:400">(${alerts.length})</span></div>
 ${alerts.length?alerts.slice(0,8).map(a=>`<div class="aitem" onclick="${a.act}"><div class="adot" style="background:${a.color}"></div><span style="flex:1">${esc(a.msg)}</span></div>`).join('')+(alerts.length>8?`<div style="font-size:10px;color:var(--mu);padding:5px 10px">+${alerts.length-8} autres…</div>`:''):`<div class="aitem"><div class="adot" style="background:var(--ac2)"></div><span class="mu_ fs10">Aucune action urgente OK</span></div>`}
 <div class="dsec mt14">Pipeline actif</div>
 ${CAND_ST.filter(s=>!['placed','ko','entrant'].includes(s.id)).map(s=>{
 const cs=DB.candidates.filter(c=>c.status===s.id);
 if(!cs.length)return'';
 return`<div class="mb8"><div class="fs9 mu2_" style="text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">${s.l} (${cs.length})</div>${cs.slice(0,2).map(c=>`<div class="aitem" onclick="openCandPanel('${c.id}')"><span class="pill ${s.p}" style="font-size:9px">${s.l}</span><span style="flex:1">${esc(c.name)}</span><span class="fs10 mu_">${esc(c.role||'')} </span></div>`).join('')}${cs.length>2?`<div class="fs10 mu_ mt4" style="padding-left:8px">+${cs.length-2} autre(s)…</div>`:''}</div>`;
 }).join('')||`<div class="mu_ fs11">Aucun candidat actif</div>`}
 </div>
 <div>
 ${renderDashAgendaBlocks()}
 <div class="dsec mt14">Besoins ouverts</div>
 ${DB.needs.filter(n=>n.status==='open').slice(0,5).map(n=>{const co=coById(n.company_id);return`<div class="aitem" onclick="openNeedPanel('${n.id}')"><span style="flex:1">${esc(n.title)}</span><span class="fs10 mu_">${co?esc(co.name):''}</span><span class="fs9" style="color:${{h:'var(--ac3)',m:'var(--ac4)',l:'var(--mu2)'}[n.urgency]||'var(--mu2)'}">${{h:'●',m:'○',l:'·'}[n.urgency]||''}</span></div>`;}).join('')||`<div class="mu_ fs11">Aucun besoin ouvert</div>`}
 <div class="dsec mt14"> Entrants à trier</div>
 ${DB.candidates.filter(c=>c.status==='entrant').slice(0,4).map(c=>{const cat=getCat(c.cat);return`<div class="aitem" onclick="switchCandTab('trier');go('cands');setTimeout(()=>openEntrantSplit('${c.id}'),80)"><span class="pill pent">Entrant</span><span style="flex:1">${esc(c.name)}</span><span class="tag ${cat.cls} fs9">${cat.l}</span></div>`;}).join('')||`<div class="mu_ fs11">Aucun entrant en attente</div>`}
 </div>
 </div>`;
}

function rCands(){
 const tab=UI.cands_tab;
 const nTrier=DB.candidates.filter(c=>c.status==='entrant').length;
 const nEnCours=DB.candidates.filter(c=>['new','precal'].includes(c.status)).length;
 const nDossiers=DB.candidates.filter(c=>['dossier','interview','presented'].includes(c.status)).length;
 const nPipeline=DB.candidates.filter(c=>!['entrant','ko','placed'].includes(c.status)).length;
 document.getElementById('view-cands').innerHTML=`
 <div class="vtabs" style="gap:2px">
 <div class="vt ${tab==='trier'?'act':''}" onclick="switchCandTab('trier')" title="Candidats reçus, non encore triés">
 À trier ${nTrier>0?`<span class="vt-badge" style="background:rgba(224,74,74,.25);color:var(--ac3)">${nTrier}</span>`:''}
 </div>
 <div class="vt ${tab==='encours'?'act':''}" onclick="switchCandTab('encours')" title="Précal faite — RDV entretien prévu">
 Précal / RDV ${nEnCours>0?`<span class="vt-badge" style="background:rgba(224,152,58,.2);color:var(--ac4)">${nEnCours}</span>`:''}
 </div>
 <div class="vt ${tab==='dossiers'?'act':''}" onclick="switchCandTab('dossiers')" title="Dossier validé — prêts à placer">
 Dossiers validés ${nDossiers>0?`<span class="vt-badge" style="background:rgba(80,120,8,.18);color:var(--ac)">${nDossiers}</span>`:''}
 </div>
 <div class="vt ${tab==='pipeline'?'act':''}" onclick="switchCandTab('pipeline')" title="Vue kanban complète">
 Pipeline <span class="vt-badge">${nPipeline}</span>
 </div>
 </div>
 <div id="cands-sub"></div>`;
 if(tab==='trier') rEntrants();
 else if(tab==='encours') rEnCours();
 else if(tab==='dossiers') rDossiers();
 else rPipeline();
}
function switchCandTab(t){UI.cands_tab=t;rCands();}

// ── TAB 1 : ENTRANTS BRUTS ──────────────────────────────
function rEntrants(){
 const q=(document.getElementById('se')||{}).value?.toLowerCase()||'';
 const filt=DB.candidates.filter(c=>{
 if(c.status!=='entrant')return false;
 if(q){const txt=(c.name+' '+(c.role||'')+' '+(c.phone||'')).toLowerCase();if(!txt.includes(q))return false;}
 return true;
 });
 const ko=DB.candidates.filter(c=>c.status==='ko').length;

 document.getElementById('cands-sub').innerHTML=`
 <div class="tb">
 <div class="srch"><input id="se" placeholder="Rechercher…" oninput="rEntrants()" value="${esc(q)}"></div>
 <span class="fs10 mu_">${filt.length} candidat(s) à traiter</span>
 <div style="margin-left:auto;display:flex;gap:6px">
 <button class="btn bg bsm" onclick="importCandCSV()">↑ Import CSV</button>
 <button class="btn bp bsm" onclick="openAddCVModal()">+ Ajouter</button>
 </div>
 </div>
 ${filt.length ? `
 <table class="tbl" id="ent-table">
 <thead><tr>
 <th style="width:32px"></th>
 <th>Nom</th>
 <th>Téléphone</th>
 <th>Poste</th>
 <th>Annonce</th>
 <th>Reçu le</th>
 <th style="width:80px"></th>
 </tr></thead>
 <tbody>
 ${filt.map(c=>entRow(c)).join('')}
 </tbody>
 </table>` : `
 <div style="text-align:center;padding:60px 20px;color:var(--mu)">
 <div style="font-size:40px;margin-bottom:12px"></div>
 <div class="syne bold" style="font-size:14px;margin-bottom:6px">Aucun candidat entrant</div>
 <div class="fs11" style="margin-bottom:16px">Les candidats qui postulent à vos annonces apparaissent ici.<br>Vous pouvez aussi en ajouter manuellement via leur CV.</div>
 <button class="btn bp" onclick="openAddCVModal()">+ Ajouter un candidat via CV</button>
 </div>`}
 ${ko?`<div class="fs10 mu_ mt12 " style="padding-left:4px"> ${ko} candidat(s) KO — non retenus</div>`:''}`;

 if(q){const el=document.getElementById('se');if(el)el.value=q;}
}

function entRow(c){
 const cat=getCat(c.cat);
 const hasCv=!!findDoc(c,'cv');
 const annonce=c.post_id?DB.posts.find(p=>p.id===c.post_id):null;
 return`<tr onclick="openEntrantSplit('${c.id}')" style="cursor:pointer">
 <td onclick="event.stopPropagation()">
 <span style="width:8px;height:8px;border-radius:50%;background:${hasCv?'var(--ac2)':'var(--bd2)'};display:inline-block;margin-left:4px" title="${hasCv?'CV uploadé':'Sans CV'}"></span>
 </td>
 <td><strong style="font-family:'Syne',sans-serif">${esc(c.name)}</strong></td>
 <td style="font-family:'DM Mono',monospace;color:var(--ac2)">${fPhone(c.phone)}</td>
 <td><span class="tag ${cat.cls}">${esc(c.role||cat.l)}</span></td>
 <td style="font-size:10px;color:var(--mu)">${annonce?esc(annonce.title):'—'}</td>
 <td style="font-size:10px;color:var(--mu)">${fD(c.created)}</td>
 <td onclick="event.stopPropagation()" class="acol">
 <button class="btn bp bxs" onclick="startPrecal('${c.id}')">✓ Garder</button>
 <button class="btn bd_ bxs" onclick="koEntrant('${c.id}')">×</button>
 </td>
 </tr>`;
}

function koEntrant(id){
 const c=cById(id);if(!c)return;
 c.status='ko';c.updated=now_();save();rCands();badges();
 toast(`${c.name} — marqué KO`,'w');
}

// ═══════════════════════════════════════════════════════════
// TAB 2 — EN COURS : PRÉCAL / RDV PRÉVU
// Candidats qualifiés (status: new ou precal)
// Précal faite, en attente d'entretien visio
// ═══════════════════════════════════════════════════════════
function rEnCours(){
 const cands=DB.candidates.filter(c=>['new','precal'].includes(c.status))
 .sort((a,b)=>{
 // Ceux avec RDV agenda en premier
 const aAg=DB.agenda.find(ag=>ag.cand_id===a.id&&!ag.done&&ag.date>=todayKey());
 const bAg=DB.agenda.find(ag=>ag.cand_id===b.id&&!ag.done&&ag.date>=todayKey());
 if(aAg&&!bAg)return -1;
 if(!aAg&&bAg)return 1;
 if(aAg&&bAg)return (aAg.date+aAg.time||'').localeCompare(bAg.date+bAg.time||'');
 return new Date(b.updated)-new Date(a.updated);
 });

 const today=todayKey();

 const rows=cands.map(c=>{
 const cat=getCat(c.cat);
 const st=getCS(c.status);
 // Prochain RDV agenda lié à ce candidat
 const nextAg=DB.agenda.find(ag=>ag.cand_id===c.id&&!ag.done&&ag.date>=today);
 const overdueAg=DB.agenda.find(ag=>ag.cand_id===c.id&&!ag.done&&ag.date<today);
 const agDisplay=nextAg
 ? `<span style="font-size:10px;padding:2px 8px;background:rgba(61,224,154,.08);border:1px solid rgba(61,224,154,.2);border-radius:2px;color:var(--ac2)"> ${fmtDateStr(nextAg.date)}${nextAg.time?' à '+nextAg.time:''}</span>`
 : overdueAg
 ? `<span style="font-size:10px;padding:2px 8px;background:rgba(224,74,74,.1);border:1px solid rgba(224,74,74,.25);border-radius:2px;color:var(--ac3)">! RDV dépassé — ${fmtDateStr(overdueAg.date)}</span>`
 : `<span style="font-size:10px;color:var(--mu2)">Aucun RDV planifié</span>`;

 const docsOk=(c.docs||[]).filter(docHasFile).length;
 const hasCv=!!findDoc(c,'cv');

 return`<div class="cc encours-card" onclick="openCandPanel('${c.id}')" style="margin-bottom:6px;padding:12px 13px">
 <div style="display:flex;align-items:flex-start;gap:12px">

 <!-- Téléphone bloc gauche -->
 <div style="flex-shrink:0;width:150px" onclick="event.stopPropagation()">
 <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:3px">Téléphone</div>
 <div style="font-family:'DM Mono',monospace;font-size:15px;color:var(--ac2);font-weight:500;letter-spacing:.03em;display:flex;align-items:center;gap:5px">
 ${c.phone?`${fPhone(c.phone)}<span onclick="cpPhone('${esc(c.phone)}')" style="cursor:pointer;font-size:12px;color:var(--mu);transition:.1s" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--mu)'">⧉</span>`
 :`<span style="color:var(--mu);font-size:12px">Non renseigné</span>`}
 </div>
 </div>

 <!-- Infos centre -->
 <div style="flex:1;min-width:0">
 <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
 <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px">${esc(c.name)}</span>
 ${c.pepite?'<span style="font-size:11px"></span>':''}
 <span class="pill ${st.p}" style="font-size:9px">${st.l}</span>
 <span class="tag ${cat.cls}">${esc(c.role||cat.l)}</span>
 </div>
 <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:5px">
 ${agDisplay}
 </div>
 ${c.notes_pre?`<div style="font-size:10px;color:var(--mu);line-height:1.5;max-height:32px;overflow:hidden;text-overflow:ellipsis">${esc(c.notes_pre.slice(0,120))}${c.notes_pre.length>120?'…':''}</div>`:''}
 </div>

 <!-- Actions droite -->
 <div onclick="event.stopPropagation()" style="flex-shrink:0;display:flex;flex-direction:column;gap:4px">
 ${c.status==='new'
 ? `<button class="btn bp bsm" onclick="openPrecalScript('${c.id}')">Lancer script</button>`
 : `<button class="btn bi bsm" onclick="openCalendarMo('${c.id}')">RDV visio</button>`}
 ${c.status==='precal'
 ? `<button class="btn bg bxs" onclick="openPrecalScript('${c.id}')">Re-précal</button>`
 : ''}
 </div>
 </div>
 </div>`;
 }).join('');

 document.getElementById('cands-sub').innerHTML=`
 <div class="tb">
 <span class="fs10 mu_">${cands.length} candidat(s) en cours de qualification</span>
 <div style="margin-left:auto;display:flex;gap:6px">
 <button class="btn bg bsm" onclick="openAddCVModal()">+ Ajouter</button>
 </div>
 </div>
 ${cands.length?`<div style="margin-top:8px">${rows}</div>`:`
 <div style="text-align:center;padding:60px 20px;color:var(--mu)">
 <div style="font-size:36px;margin-bottom:12px"></div>
 <div class="syne bold" style="font-size:13px;margin-bottom:6px">Aucun candidat en cours</div>
 <div class="fs11">Les candidats gardés depuis "À trier" apparaissent ici,<br>en attente de précal téléphonique et de RDV visio.</div>
 </div>`}`;
}

// Helper: format date string lisiblement
function fmtDateStr(ds){
 if(!ds)return'—';
 try{
 const d=new Date(ds+'T12:00:00');
 const days=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
 const today=new Date();today.setHours(12,0,0,0);
 const diff=Math.round((d-today)/86400000);
 if(diff===0)return"Aujourd'hui";
 if(diff===1)return'Demain';
 if(diff===-1)return'Hier';
 if(diff>0&&diff<7)return`${days[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
 return`${d.getDate()}/${d.getMonth()+1}`;
 }catch(e){return ds;}
}

// Avancer un candidat vers le prochain statut sans modal
function advanceCandStatus(id, newStatus){
 const c=cById(id);if(!c)return;
 const prev=c.status;
 c.status=newStatus;c.updated=now_();save();
 rCands();badges();
 const st=getCS(newStatus);
 toast(`${c.name} → ${st.l}`,'s');
}

// ═══════════════════════════════════════════════════════════
// TAB 3 — DOSSIERS VALIDÉS : PRÊTS À PLACER
// Candidats avec dossier complet ou en cours de présentation
// (status: dossier / interview / presented)
// ═══════════════════════════════════════════════════════════
function rDossiers(){
 const cands=DB.candidates.filter(c=>['dossier','interview','presented'].includes(c.status))
 .sort((a,b)=>{
 // presented d'abord, puis interview, puis dossier
 const order={presented:0,interview:1,dossier:2};
 const oa=order[a.status]??3;
 const ob=order[b.status]??3;
 if(oa!==ob)return oa-ob;
 return new Date(b.updated)-new Date(a.updated);
 });

 // Pièces réellement OBLIGATOIRES = celles marquées required dans DOCS_LIST
 // (CV, pièce d'identité, dossier signé). Le permis et la carte vitale sont
 // FACULTATIFs : leur absence ne doit JAMAIS afficher « dossier incomplet ».
 const DOCS_REQUIRED=DOCS_LIST.filter(d=>d.required).map(d=>d.id);
 const today=todayKey();

 function docPct(c){
 const docs=c.docs||[];
 const done=DOCS_REQUIRED.filter(id=>docs.find(d=>d.id===id&&docHasFile(d))).length;
 return{done,total:DOCS_REQUIRED.length,pct:Math.round(done/DOCS_REQUIRED.length*100)};
 }

 const stColors={
 dossier:{bg:'rgba(20,80,180,.12)',tx:'var(--ac5)',brd:'rgba(20,80,180,.25)'},
 interview:{bg:'rgba(120,20,180,.12)',tx:'var(--ac6)',brd:'rgba(120,20,180,.25)'},
 presented:{bg:'rgba(61,224,154,.08)',tx:'var(--ac2)',brd:'rgba(61,224,154,.2)'},
 };

 const rows=cands.map(c=>{
 const cat=getCat(c.cat);
 const st=getCS(c.status);
 const sc=stColors[c.status]||stColors.dossier;
 const dp=docPct(c);
 const docMissing=DOCS_REQUIRED.filter(id=>!(c.docs||[]).find(d=>d.id===id&&docHasFile(d)));
 const nextAg=DB.agenda.find(ag=>ag.cand_id===c.id&&!ag.done&&ag.date>=today);

 const docBar=`<div style="display:flex;align-items:center;gap:6px">
 <div style="flex:1;height:3px;background:var(--bd);border-radius:2px">
 <div style="width:${dp.pct}%;height:100%;background:${dp.pct===100?'var(--ac2)':'var(--ac4)'};border-radius:2px;transition:.3s"></div>
 </div>
 <span style="font-size:9px;color:${dp.pct===100?'var(--ac2)':'var(--ac4)'}">Docs ${dp.done}/${dp.total}</span>
 ${dp.pct<100?`<span style="font-size:9px;color:var(--ac3)" title="Docs manquants: ${docMissing.map(id=>DOCS_LIST.find(d=>d.id===id)?.l||id).join(', ')}">!️</span>`:'<span style="font-size:10px;color:var(--ac2)">✓</span>'}
 </div>`;

 return`<div class="cc" onclick="openCandPanel('${c.id}')" style="margin-bottom:6px;padding:11px 13px;border-left-color:${sc.tx}">
 <div style="display:flex;align-items:flex-start;gap:12px">

 <!-- Statut bloc gauche -->
 <div style="flex-shrink:0;width:110px">
 <span style="display:inline-block;padding:3px 9px;background:${sc.bg};color:${sc.tx};border:1px solid ${sc.brd};border-radius:2px;font-size:10px;font-weight:600;white-space:nowrap">${st.l}</span>
 ${nextAg?`<div style="margin-top:5px;font-size:9px;color:var(--mu)"> ${fmtDateStr(nextAg.date)}</div>`:''}
 </div>

 <!-- Infos -->
 <div style="flex:1;min-width:0">
 <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
 <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px">${esc(c.name)}</span>
 ${c.pepite?'<span></span>':''}
 <span class="tag ${cat.cls}">${esc(c.role||cat.l)}</span>
 ${c.salary?`<span style="font-size:10px;color:var(--ac2)">${fM(c.salary)}</span>`:''}
 </div>

 <!-- Barre docs -->
 ${docBar}

 <!-- Matching besoins -->
 ${(()=>{
 if(c.linked_need){
 const ln=DB.needs.find(n=>n.id===c.linked_need);
 const lco=ln?DB.companies.find(co=>co.id===ln.company_id):null;
 const score=ln?computeMatchScore(c,ln):0;
 const scoreClass=score>=75?'hi':score>=50?'med':'lo';
 return `<div style="margin-top:6px;padding:4px 8px;background:rgba(74,130,224,.08);border:1px solid rgba(74,130,224,.2);border-radius:2px;display:flex;align-items:center;gap:6px;font-size:10px">
 <div class="match-score ${scoreClass}" style="width:28px;height:28px;font-size:11px">${score}%</div>
 <div><div style="font-weight:600">${esc(lco?.name||'?')}</div><div style="color:var(--mu)">${esc(ln?.title||'')}</div></div>
 </div>`;
 }
 // Pas de besoin lié → chercher les meilleurs matches
 const matches=getTopMatches(c.id,2);
 if(matches.length){
 return `<div style="margin-top:6px">` +
 matches.map(m=>{
 const scoreClass=m.score>=75?'hi':m.score>=50?'med':'lo';
 return `<div style="margin-bottom:3px;padding:3px 8px;background:var(--s3);border:1px solid var(--bd);border-radius:2px;display:flex;align-items:center;gap:6px;font-size:10px;cursor:pointer" onclick="event.stopPropagation();toggleLink('${c.id}','${m.need.id}');rCands()">
 <div class="match-score ${scoreClass}" style="width:24px;height:24px;font-size:10px">${m.score}%</div>
 <div style="flex:1;min-width:0"><span style="font-weight:600">${esc(m.co?.name||'?')}</span> — <span style="color:var(--mu)">${esc(m.need.title)}</span></div>
 <span style="color:var(--ac5);font-size:9px">Lier →</span>
 </div>`;
 }).join('') +
 `</div>`;
 }
 return `<div style="margin-top:5px;font-size:10px;color:var(--mu2)">Aucun besoin compatible — <span style="cursor:pointer;color:var(--ac5);text-decoration:underline" onclick="event.stopPropagation();go('needs')">voir les besoins</span></div>`;
 })()}
 </div>

 <!-- Actions droite -->
 <div onclick="event.stopPropagation()" style="flex-shrink:0;display:flex;flex-direction:column;gap:4px">
 ${c.status==='dossier'
 ?`<button class="btn bi bsm" onclick="openCandPanel('${c.id}')">Dossier</button>`
 : c.status==='interview'
 ?`<button class="btn bg bsm" onclick="advanceCandStatus('${c.id}','presented')">→ Présenté</button>`
 :`<button class="btn bg bxs" style="color:var(--ac2);border-color:rgba(61,224,154,.3)" onclick="advanceCandStatus('${c.id}','placed')">→ Placé ✓</button>`}
 </div>
 </div>
 </div>`;
 }).join('');

 document.getElementById('cands-sub').innerHTML=`
 <div class="tb">
 <span class="fs10 mu_">${cands.length} candidat(s) qualifié(s) — prêts à placer</span>
 <div style="margin-left:auto;display:flex;gap:6px">
 <button class="btn bg bsm" onclick="go('needs')">Voir les besoins</button>
 </div>
 </div>
 ${cands.length?`<div style="margin-top:8px">${rows}</div>`:`
 <div style="text-align:center;padding:60px 20px;color:var(--mu)">
 <div style="font-size:36px;margin-bottom:12px"></div>
 <div class="syne bold" style="font-size:13px;margin-bottom:6px">Aucun dossier validé</div>
 <div class="fs11">Les candidats dont le dossier est envoyé et l'entretien passé<br>apparaissent ici, prêts à être présentés aux clients.</div>
 </div>`}`;
}

function openEntrantSplit(id){
 const c=cById(id);if(!c)return;
 if(c.booking&&c.booking.status==='booked'&&c.booking_notif_seen===false){c.booking_notif_seen=true;save();badges();}
 const cat=getCat(c.cat);
 const hasCv=!!findDoc(c,'cv');
 const cvDoc=findDoc(c,'cv');
 const annonce=c.post_id?DB.posts.find(p=>p.id===c.post_id):null;

 // Build CV preview
 let cvPreview='';
 if(cvDoc){
 const cvSrc=docDirectSrc(cvDoc);
 const cvIsPdf=cvDoc.type==='application/pdf'||(typeof cvSrc==='string'&&/\.pdf(\?|$)/i.test(cvSrc));
 if(cvIsPdf){
 cvPreview=`<iframe src="${cvSrc}" style="width:100%;height:100%;border:none;border-radius:3px" title="CV ${esc(c.name)}"></iframe>`;
 } else {
 cvPreview=`<img src="${cvSrc}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:3px" alt="CV ${esc(c.name)}">`;
 }
 } else {
 cvPreview=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--mu);gap:12px">
 <div style="font-size:48px"></div>
 <div class="fs11">Aucun CV uploadé</div>
 <label class="btn bp bsm" style="cursor:pointer">
 ↑ Uploader le CV
 <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="uploadCvFromSplit(event,'${id}')">
 </label>
 </div>`;
 }

 const html=`
 <div id="ent-split-ov" onclick="closeEntrantSplit(event)" style="position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(4px);z-index:70;display:flex;align-items:stretch;padding:16px;gap:12px">

 <!-- CV GAUCHE -->
 <div onclick="event.stopPropagation()" style="flex:1;background:var(--s2);border:1px solid var(--bd2);border-radius:6px;overflow:hidden;display:flex;flex-direction:column;min-width:0">
 <div style="padding:10px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;flex-shrink:0">
 <span class="fs10 mu_" style="text-transform:uppercase;letter-spacing:.08em">CV — ${esc(c.name)}</span>
 ${cvDoc?`<label class="btn bg bxs" style="cursor:pointer;margin-left:auto">↑ Remplacer<input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="uploadCvFromSplit(event,'${id}')"></label>`:''}
 </div>
 <div style="flex:1;padding:${cvDoc?.type==='application/pdf'?'0':'16px'};overflow:auto;display:flex;align-items:${cvDoc?.type==='application/pdf'?'stretch':'center'};justify-content:center">
 ${cvPreview}
 </div>
 </div>

 <!-- INFOS DROITE -->
 <div onclick="event.stopPropagation()" style="width:380px;flex-shrink:0;background:var(--s1);border:1px solid var(--bd2);border-radius:6px;display:flex;flex-direction:column;overflow:hidden">

 <!-- Header candidat -->
 <div style="padding:20px 20px 16px;border-bottom:1px solid var(--bd);flex-shrink:0">
 <div onclick="closeEntrantSplit()" style="float:right;cursor:pointer;color:var(--mu);font-size:16px;line-height:1;padding:2px" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--mu)'">×</div>
 <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:20px;margin-bottom:4px">${esc(c.name)}</div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
 <span class="tag ${cat.cls}">${cat.l}</span>
 <span class="pill pent">Entrant brut</span>
 ${annonce?`<span class="fs10" style="color:var(--ac5)">${esc(annonce.title)}</span>`:''}
 </div>
 </div>

 <!-- Téléphone BIG -->
 <div style="padding:16px 20px;border-bottom:1px solid var(--bd);flex-shrink:0">
 <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:6px">Téléphone</div>
 <div style="font-family:'DM Mono',monospace;font-weight:500;font-size:22px;color:var(--ac2);display:flex;align-items:center;gap:10px;font-variant-numeric:tabular-nums;letter-spacing:.05em">
 ${c.phone?`${fPhone(c.phone)}<button class="btn bg bxs" onclick="cpPhone('${esc(c.phone)}')">⧉</button>`:`<span style="color:var(--mu);font-size:14px;font-family:'DM Mono',monospace">Non renseigné</span>`}
 </div>
 </div>

 <!-- Infos scroll -->
 <div style="flex:1;overflow-y:auto;padding:14px 20px">
 <div class="dr"><span class="drk">Email</span><span class="drv">${esc(c.email||'—')}</span></div>
 <div class="dr"><span class="drk">Poste</span><span class="drv">${esc(c.role||'—')}</span></div>
 <div class="dr"><span class="drk">Salaire</span><span class="drv">${fM(c.salary)}</span></div>
 <div class="dr"><span class="drk">Disponibilité</span><span class="drv">${esc(c.avail||'—')}</span></div>
 <div class="dr"><span class="drk">Mobilité</span><span class="drv">${esc(c.mobility||'—')}</span></div>
 <div class="dr"><span class="drk">Source</span><span class="drv">${esc(c.source||'—')}</span></div>
 <div class="dr"><span class="drk">Reçu le</span><span class="drv">${fD(c.created)}</span></div>
 ${c.notes_pre?`<div class="sl">Notes IA / pré-analyse</div><div class="notebox fs10">${esc(c.notes_pre)}</div>`:''}

 ${cvDoc?`
 <div style="margin-top:14px;padding:9px 12px;background:rgba(154,74,224,.07);border:1px solid rgba(154,74,224,.25);border-radius:3px">
 <div style="font-size:11px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><span class="ai-badge">IA</span><strong>Ré-analyser le CV</strong></div>
 <button id="ai-btn-${c.id}" class="btn bxs" style="background:rgba(154,74,224,.15);color:var(--ac6);border:1px solid rgba(154,74,224,.3)" onclick="aiExtractCVSplit('${c.id}')">Analyser avec IA</button>
 ${c.cv_extracted?`<span class="fs10 mu_" style="margin-left:8px">Dernière extraction effectuée</span>`:''}
 </div>`:''}

 <!-- Edition rapide -->
 <div class="sl mt12">Modifier infos</div>
 <div style="display:flex;flex-direction:column;gap:6px">
 <input id="es-name" value="${esc(c.name)}" placeholder="Nom complet" style="font-size:11px">
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
 <input id="es-phone" value="${esc(c.phone||'')}" placeholder="Téléphone" style="font-size:11px">
 <input id="es-email" value="${esc(c.email||'')}" placeholder="Email" style="font-size:11px">
 </div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
 <input id="es-sal" value="${esc(c.salary||'')}" placeholder="Salaire €/an" style="font-size:11px">
 <input id="es-avail" value="${esc(c.avail||'')}" placeholder="Disponibilité" style="font-size:11px">
 </div>
 <select id="es-post" style="font-size:11px">
 <option value="">— Rattacher à une annonce —</option>
 ${DB.posts.filter(p=>p.status==='active').map(p=>`<option value="${p.id}" ${c.post_id===p.id?'selected':''}>${esc(p.title)}</option>`).join('')}
 </select>
 <button class="btn bp bsm" onclick="saveEntrantSplitEdits('${c.id}')"> Enregistrer les modifications</button>
 </div>
 </div>

 <!-- Actions bas -->
 <div style="padding:12px 16px;border-top:1px solid var(--bd);display:flex;gap:6px;flex-shrink:0">
 <button class="btn bp" style="flex:2" onclick="closeEntrantSplit();startPrecal('${c.id}')">✓ Garder — Lancer précal</button>
 <button class="btn bd_" style="flex:1" onclick="koEntrant('${c.id}');closeEntrantSplit()">× KO</button>
 </div>
 </div>
 </div>`;

 document.getElementById('ent-split-ov')?.remove();
 document.body.insertAdjacentHTML('beforeend',html);
}

function closeEntrantSplit(e){
 if(e&&e.target!==document.getElementById('ent-split-ov'))return;
 document.getElementById('ent-split-ov')?.remove();
}

function saveEntrantSplitEdits(id){
 const c=cById(id);if(!c)return;
 c.name=document.getElementById('es-name')?.value||c.name;
 c.phone=document.getElementById('es-phone')?.value||'';
 c.email=document.getElementById('es-email')?.value||'';
 c.salary=document.getElementById('es-sal')?.value||'';
 c.avail=document.getElementById('es-avail')?.value||'';
 c.post_id=document.getElementById('es-post')?.value||null;
 c.updated=now_();
 save();
 // Refresh the split view
 document.getElementById('ent-split-ov')?.remove();
 openEntrantSplit(id);
 toast('Modifications enregistrées ✓','s');
}

async function uploadCvFromSplit(event,candId){
 const file=event.target.files[0];if(!file)return;
 if(file.size>10*1024*1024){toast('Fichier trop lourd (max 10 Mo)','e');return;}
 const c=cById(candId);if(!c)return;
 toast('Envoi du CV…','i');
 // 1. On tente le bucket (léger pour la fiche). Borné à 15s pour ne jamais bloquer.
 let entry=null;
 try{
   const up=await _withTimeout(cvBucketUpload(candId,'cv',file), 15000, null);
   if(up && up.storage_path){
     entry={id:'cv',name:file.name,size:formatSize(file.size),date:now_(),type:file.type,storage_path:up.storage_path,url:up.url};
   }
 }catch(_){}
 // 2. Repli : décharge dans crm_candidat_files (PAS de base64 dans la fiche).
 if(!entry){
   const ok=await _withTimeout(pgFilePut(candId,'cv',file), 20000, false);
   if(ok) entry={id:'cv',name:file.name,size:formatSize(file.size),date:now_(),type:file.type,_pg:true};
 }
 if(!entry){ toast('Échec de l\'envoi du CV — réessayez','e'); return; }
 c.docs=c.docs||[];
 const idx=c.docs.findIndex(d=>d.id==='cv');
 if(idx>=0)c.docs[idx]=entry;else c.docs.push(entry);
 c.updated=now_();save();
 document.getElementById('ent-split-ov')?.remove();
 openEntrantSplit(candId);
 toast('CV uploadé','s');
 if(getApiKey()){ setTimeout(()=>aiExtractCVSplit(candId),300); }
}

// Wrapper pour l'IA depuis le split view (refresh le split après)
async function aiExtractCVSplit(candId){
 await aiExtractCV(candId);
 // Refresh split view avec les nouvelles données
 setTimeout(()=>{
 if(document.getElementById('ent-split-ov')){
 document.getElementById('ent-split-ov').remove();
 openEntrantSplit(candId);
 }
 },500);
}

// ═══════════════════════════════════════════════════════════
// MODAL AJOUT CANDIDAT VIA CV — Batch upload + extraction IA
// ═══════════════════════════════════════════════════════════
// Modèle IA centralisé pour extraction CV (Haiku 4.5 = rapide & économique)
const CV_AI_MODEL='claude-haiku-4-5-20251001';
const CV_AI_MAX_TOKENS=600;
const CV_AI_CONCURRENCY=3;          // nb de CV analysés en parallèle (évite rate limit)
const CV_MAX_SIZE=5*1024*1024;      // 5 MB
const CV_ALLOWED_TYPES=['application/pdf','image/jpeg','image/png','image/jpg'];
// Durée d'animation perçue par CV (toujours constante quelle que soit la vitesse réelle de l'API)
const CV_ANIM_DURATION_MS=4200;

// Prompt unique factorisé — toujours mêmes champs retournés
const CV_PROMPT=`Analyse ce CV. Réponds UNIQUEMENT par un objet JSON valide, sans markdown ni texte autour.
Schéma exact:
{"nom":"","prenom":"","email":"","telephone":"","poste_actuel":"","poste_cible":"","salaire_actuel":"","disponibilite":"","mobilite":"","experience_annees":"","notes_synthese":""}
Règles:
- telephone: 10 chiffres collés (ex: "0612345678") ou format international sans espaces
- salaire_actuel: entier annuel brut en € (ex: 42000) ou "" si absent
- experience_annees: entier ou ""
- disponibilite: phrase courte (ex: "Immédiate", "Sous 1 mois")
- mobilite: zones (ex: "National", "Île-de-France")
- notes_synthese: 2 phrases max, vue recruteur BTP
- Si info absente: chaîne vide "". Aucun null.`;

function openAddCVModal(){
 const apiOk=!!getApiKey();
 openMo('Ajouter des candidats via CV',`
 <div class="info-box mb12">
 Glissez 1 ou plusieurs CV → l'IA analyse chaque fichier et crée les fiches candidat automatiquement.
 ${!apiOk?`<br><strong style="color:var(--ac4)">! Configurez d'abord votre clé IA dans · Paramètres pour l'extraction automatique.</strong>`:''}
 </div>

 <!-- Sélection annonce / catégorie par défaut (appliquée à tous les CV du batch) -->
 <div class="fg" style="margin-bottom:14px">
 <div class="fgrp ff"><span class="lbl">Rattacher tous les CV à une annonce (optionnel)</span>
 <select id="cv-batch-post">
 <option value="">— Aucune annonce —</option>
 ${DB.posts.filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${esc(p.title)}</option>`).join('')}
 </select>
 </div>
 </div>

 <!-- Zone de drop / upload multi-fichiers -->
 <div id="cv-dropzone"
  style="border:2px dashed var(--bd2);border-radius:var(--r2);padding:36px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;margin-bottom:14px;background:var(--s2)"
  onclick="document.getElementById('cv-file-input').click()"
  ondragover="event.preventDefault();this.style.borderColor='var(--ac)';this.style.background='var(--ac-dim)'"
  ondragleave="this.style.borderColor='var(--bd2)';this.style.background='var(--s2)'"
  ondrop="handleCvDrop(event)">
 <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;letter-spacing:-.2px;margin-bottom:6px">Cliquez ou glissez vos CV ici</div>
 <div class="fs10 mu_">PDF, JPG, PNG · max 5 Mo par fichier · sélection multiple autorisée</div>
 <input type="file" id="cv-file-input" accept=".pdf,.jpg,.jpeg,.png" multiple style="display:none" onchange="handleCvFileSelected(event)">
 </div>

 <!-- Zone de progression batch -->
 <div id="cv-batch-progress" style="display:none">
 <!-- Barre globale -->
 <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
 <div style="display:flex;align-items:center;gap:8px">
 <span class="ai-badge">IA</span>
 <span class="fs11 bold" id="cv-batch-title">Analyse en cours…</span>
 </div>
 <span class="fs10 mu_" id="cv-batch-count">0 / 0</span>
 </div>
 <div class="cvb-globalbar">
 <div class="cvb-globalfill" id="cv-batch-global-fill" style="width:0%"></div>
 </div>

 <!-- Liste des fichiers -->
 <div id="cv-batch-list" style="margin-top:14px;display:flex;flex-direction:column;gap:7px;max-height:340px;overflow-y:auto;padding-right:2px"></div>

 <!-- Résumé final -->
 <div id="cv-batch-summary" style="display:none;margin-top:14px;padding:12px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2)"></div>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Fermer</button>
 <button id="cv-batch-add-more" class="btn bg" style="display:none" onclick="document.getElementById('cv-file-input').click()">+ Ajouter d'autres CV</button>`
 );

 // State du batch — sera réinitialisé à chaque ouverture
 window._cvBatch={files:[],done:0,errors:0,running:false};
}

function handleCvDrop(event){
 event.preventDefault();
 const dz=document.getElementById('cv-dropzone');
 if(dz){dz.style.borderColor='var(--bd2)';dz.style.background='var(--s2)';}
 const files=Array.from(event.dataTransfer.files||[]);
 if(files.length)enqueueCvFiles(files);
}
function handleCvFileSelected(event){
 const files=Array.from(event.target.files||[]);
 if(files.length)enqueueCvFiles(files);
 event.target.value=''; // permet de re-uploader le même fichier
}

// ── Ajoute des fichiers à la queue et lance le traitement ─────────
function enqueueCvFiles(rawFiles){
 if(!window._cvBatch)window._cvBatch={files:[],done:0,errors:0,running:false};
 const batch=window._cvBatch;
 const rejected=[];
 rawFiles.forEach(f=>{
  if(f.size>CV_MAX_SIZE){rejected.push(`${f.name} (>5Mo)`);return;}
  if(!CV_ALLOWED_TYPES.includes(f.type)){rejected.push(`${f.name} (format invalide)`);return;}
  batch.files.push({
   id:'cvb_'+Math.random().toString(36).slice(2,9),
   file:f,
   name:f.name,
   type:f.type,
   size:formatSize(f.size),
   status:'queued',   // queued | reading | analyzing | done | error
   progress:0,        // 0..100 (animation perçue)
   candId:null,
   extracted:null,
   error:null
  });
 });
 if(rejected.length)toast(`${rejected.length} fichier(s) ignoré(s) : ${rejected.slice(0,2).join(', ')}${rejected.length>2?'…':''}`,'w');
 if(!batch.files.length)return;
 // Bascule UI : cache dropzone, montre progress
 const dz=document.getElementById('cv-dropzone');if(dz)dz.style.display='none';
 const prog=document.getElementById('cv-batch-progress');if(prog)prog.style.display='block';
 const addBtn=document.getElementById('cv-batch-add-more');if(addBtn)addBtn.style.display='inline-flex';
 renderCvBatchList();
 if(!batch.running)runCvBatch();
}

// ── Rendu de la liste des fichiers (cartes) ──────────────────────
function renderCvBatchList(){
 const list=document.getElementById('cv-batch-list');if(!list)return;
 const batch=window._cvBatch;if(!batch)return;
 list.innerHTML=batch.files.map(f=>cvBatchCardHtml(f)).join('');
 updateCvBatchGlobal();
}
function cvBatchCardHtml(f){
 const statusMap={
  queued:    {label:'En file',     cls:'cvb-queue',    icon:'·'},
  reading:   {label:'Lecture',     cls:'cvb-read',     icon:'·'},
  analyzing: {label:'Analyse IA',  cls:'cvb-ai',       icon:'IA'},
  done:      {label:'Ajouté',      cls:'cvb-done',     icon:'✓'},
  error:     {label:'Échec',       cls:'cvb-error',    icon:'!'}
 };
 const s=statusMap[f.status]||statusMap.queued;
 const click=f.status==='done'&&f.candId?`onclick="closeMo();openEntrantSplit('${f.candId}')" style="cursor:pointer"`:'';
 return `<div class="cvb-card ${s.cls}" data-id="${f.id}" ${click} title="${f.status==='done'?'Ouvrir la fiche candidat':''}">
  <div class="cvb-ico">${s.icon}</div>
  <div class="cvb-info">
   <div class="cvb-name" title="${esc(f.name)}">${esc(f.name)}</div>
   <div class="cvb-sub">
    <span class="cvb-status">${s.label}${f.error?` — ${esc(f.error).slice(0,60)}`:''}</span>
    ${f.status==='done'&&f.extracted?.nom?`<span class="cvb-extracted">→ ${esc([f.extracted.prenom,f.extracted.nom].filter(Boolean).join(' '))}</span>`:''}
   </div>
   <div class="cvb-bar"><div class="cvb-fill" data-fill="${f.id}" style="width:${f.progress}%"></div></div>
  </div>
  <div class="cvb-pct" data-pct="${f.id}">${Math.round(f.progress)}%</div>
 </div>`;
}

// ── Mise à jour visuelle ─────────────────────────────────────────
// Tick de progression (60 fps) : on ne touche QUE la largeur de barre + le %
function tickCvFileUI(f){
 const fill=document.querySelector(`.cvb-card[data-id="${f.id}"] .cvb-fill`);
 const pct=document.querySelector(`.cvb-card[data-id="${f.id}"] .cvb-pct`);
 if(fill)fill.style.width=f.progress+'%';
 if(pct)pct.textContent=Math.round(f.progress)+'%';
 updateCvBatchGlobal();
}
// Changement de statut : on remplace la carte entière (couleurs, icône, label)
function updateCvFileUI(f){
 const card=document.querySelector(`.cvb-card[data-id="${f.id}"]`);
 if(card)card.outerHTML=cvBatchCardHtml(f);
 updateCvBatchGlobal();
}

function updateCvBatchGlobal(){
 const batch=window._cvBatch;if(!batch)return;
 const total=batch.files.length||1;
 const sum=batch.files.reduce((a,f)=>a+(f.progress||0),0);
 const pct=Math.round(sum/total);
 const fill=document.getElementById('cv-batch-global-fill');
 if(fill)fill.style.width=pct+'%';
 const count=document.getElementById('cv-batch-count');
 if(count)count.textContent=`${batch.done+batch.errors} / ${total}`;
 const title=document.getElementById('cv-batch-title');
 if(title){
  if(batch.done+batch.errors>=total){
   title.textContent=batch.errors?`Terminé — ${batch.done} ajouté${batch.done>1?'s':''}, ${batch.errors} échec${batch.errors>1?'s':''}`:`Terminé — ${batch.done} candidat${batch.done>1?'s':''} ajouté${batch.done>1?'s':''}`;
  } else {
   title.textContent='Analyse en cours…';
  }
 }
}

// ── Animation de progression — toujours ~CV_ANIM_DURATION_MS quelle que soit la vitesse réelle de l'API
// Plan : 0 → 15 % (lecture, ~10 % de la durée), 15 → 88 % (IA, easeOutCubic), 88 → 100 % (sauvegarde, ~3 %)
function animateCvProgress(f,onTick){
 const start=performance.now();
 const totalMs=CV_ANIM_DURATION_MS;
 // easeOutCubic — démarre vite, ralentit en fin → ressenti satisfaisant
 const ease=t=>1-Math.pow(1-t,3);
 let stopped=false;
 function tick(now){
  if(stopped)return;
  const elapsed=now-start;
  const t=Math.min(elapsed/totalMs,1);
  // Si la requête API est revenue → on accélère le finish ; sinon on plafonne à 88 %
  const cap=f._apiDone?100:88;
  const eased=ease(t);
  const target=Math.min(eased*cap,cap);
  // Lecture : 0 → 15 % sur les premiers 10 % de la durée (boost initial)
  const readBoost=t<.10?(t/.10)*15:15;
  f.progress=Math.max(f.progress,Math.min(Math.max(readBoost,target),100));
  if(typeof onTick==='function')onTick(f);
  if(f.progress>=100||(stopped))return;
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
 return ()=>{stopped=true;};
}

// ── Boucle principale : traite la queue avec concurrence ─────────
async function runCvBatch(){
 const batch=window._cvBatch;if(!batch)return;
 batch.running=true;
 const workers=Array.from({length:CV_AI_CONCURRENCY},()=>processCvWorker());
 await Promise.all(workers);
 batch.running=false;
 finalizeCvBatch();
}

async function processCvWorker(){
 const batch=window._cvBatch;
 while(true){
  const f=batch.files.find(x=>x.status==='queued');
  if(!f)return;
  await processOneCvFile(f);
 }
}

// ── Traite un seul CV : lecture → IA → création candidat ─────────
async function processOneCvFile(f){
 const batch=window._cvBatch;
 // Animation lancée dès le départ — utilise le tick léger (60 fps)
 const stopAnim=animateCvProgress(f,(file)=>tickCvFileUI(file));
 try{
  // 1) Lecture en base64
  f.status='reading';updateCvFileUI(f);
  const dataUrl=await readFileAsDataURL(f.file);
  f._dataUrl=dataUrl;

  // 2) Appel IA (parallèle à l'animation)
  f.status='analyzing';updateCvFileUI(f);
  const extracted=await callCvExtractionApi(f.type,dataUrl);
  f._apiDone=true; // l'animation va alors filer vers 100 %
  f.extracted=extracted;

  // 3) Création du candidat (upload CV inclus, jamais de base64 durable dans la fiche)
  const candId=await createCandidateFromCv(f,extracted);
  f.candId=candId;

  // Force la fin de l'animation à 100 %
  f.progress=100;f.status='done';updateCvFileUI(f);
  batch.done++;updateCvBatchGlobal();
 }catch(err){
  console.error('CV batch error',f.name,err);
  f._apiDone=true;
  f.error=err.message||'Erreur inconnue';
  f.status='error';
  f.progress=100;
  updateCvFileUI(f);
  batch.errors++;updateCvBatchGlobal();
 }finally{
  stopAnim();
 }
}

function readFileAsDataURL(file){
 return new Promise((res,rej)=>{
  const r=new FileReader();
  r.onload=e=>res(e.target.result);
  r.onerror=()=>rej(new Error('Lecture fichier échouée'));
  r.readAsDataURL(file);
 });
}

// ── Appel IA centralisé — toujours mêmes champs, modèle économique ─
async function callCvExtractionApi(mediaType,dataUrl){
 const key=getApiKey();
 if(!key)throw new Error('Clé API manquante (Paramètres)');
 const base64=dataUrl.split(',')[1]||dataUrl;
 const blockType=mediaType==='application/pdf'?'document':'image';
 const resp=await fetch('https://api.anthropic.com/v1/messages',{
  method:'POST',
  headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
  body:JSON.stringify({
   model:CV_AI_MODEL,
   max_tokens:CV_AI_MAX_TOKENS,
   messages:[{role:'user',content:[
    {type:blockType,source:{type:'base64',media_type:mediaType,data:base64}},
    {type:'text',text:CV_PROMPT}
   ]}]
  })
 });
 if(!resp.ok){
  const e=await resp.json().catch(()=>({}));
  throw new Error(e.error?.message||`HTTP ${resp.status}`);
 }
 const data=await resp.json();
 const raw=data.content?.[0]?.text||'{}';
 const clean=raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
 try{return JSON.parse(clean);}
 catch(e){throw new Error('JSON IA invalide');}
}

// ── Crée la fiche candidat depuis l'extraction ───────────────────
async function createCandidateFromCv(f,extracted){
 const n=now_();
 const postId=document.getElementById('cv-batch-post')?.value||null;
 const postObj=postId?DB.posts.find(p=>p.id===postId):null;

 // Catégorie : depuis l'annonce, sinon depuis le poste extrait, sinon défaut
 let cat='go';
 if(postObj)cat=postObj.cat||'go';
 const targetRole=extracted.poste_cible||extracted.poste_actuel||'';
 let matchedRole='';
 if(targetRole&&Array.isArray(BTP_CATS)){
  const allJobs=BTP_CATS.flatMap(c=>(c.jobs||[]).map(j=>({j,cat:c.id})));
  const m=allJobs.find(({j})=>j.toLowerCase().includes(targetRole.toLowerCase().slice(0,10)));
  if(m){matchedRole=m.j;if(!postObj)cat=m.cat;}
 }

 const fullName=[extracted.prenom,extracted.nom].filter(Boolean).join(' ').trim()||f.name.replace(/\.[^.]+$/,'');
 const synth=extracted.notes_synthese?`[IA] ${extracted.notes_synthese}`:'';

 const c={
  id:uid(),
  name:fullName,
  phone:extracted.telephone||'',
  email:extracted.email||'',
  salary:extracted.salaire_actuel||'',
  avail:extracted.disponibilite||'',
  mobility:extracted.mobilite||'',
  notes_pre:synth,
  cat,
  role:postObj?postObj.title:(matchedRole||targetRole||''),
  post_id:postId||null,
  source:postObj?`Annonce: ${postObj.title}`:'Import CV (batch)',
  status:'entrant',
  docs:[],
  pepite:false,
  cv_extracted:extracted,
  created:n,
  updated:n,
 };
 DB.candidates.unshift(c);

 // CV → bucket (léger pour la fiche). Repli : table de décharge. Dernier
 // recours seulement (cloud momentanément indisponible) : base64 dans la
 // fiche, qui sera déchargé automatiquement par _doCandSync au prochain sync.
 // Objectif : ne JAMAIS stocker durablement un CV en base64 dans crm_candidats.
 let entry=null;
 try{
   const up=await _withTimeout(cvBucketUpload(c.id,'cv',f.file), 15000, null);
   if(up && up.storage_path){
     entry={id:'cv',name:f.name,size:formatSize(f.size),date:n,type:f.type,storage_path:up.storage_path,url:up.url};
   }
 }catch(_){}
 if(!entry){
   const ok=await _withTimeout(pgFilePut(c.id,'cv',f.file), 20000, false);
   if(ok) entry={id:'cv',name:f.name,size:formatSize(f.size),date:n,type:f.type,_pg:true};
 }
 if(!entry){
   entry={id:'cv',name:f.name,size:formatSize(f.size),date:n,type:f.type,file:f._dataUrl};
 }
 c.docs=[entry];
 c.updated=now_();
 return c.id;
}

// ── Finalisation : sauvegarde, refresh, résumé ───────────────────
function finalizeCvBatch(){
 const batch=window._cvBatch;if(!batch)return;
 save();
 rCands();
 badges();

 const sumEl=document.getElementById('cv-batch-summary');
 if(sumEl){
  const okList=batch.files.filter(f=>f.status==='done');
  const errList=batch.files.filter(f=>f.status==='error');
  sumEl.style.display='block';
  sumEl.innerHTML=`
   <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px">Résumé du batch</span>
   </div>
   <div class="fs11" style="line-height:1.7">
    <div><span style="color:var(--green)">✓ ${okList.length} candidat${okList.length>1?'s':''} ajouté${okList.length>1?'s':''}</span>${errList.length?` &nbsp;·&nbsp; <span style="color:var(--red)">! ${errList.length} échec${errList.length>1?'s':''}</span>`:''}</div>
    ${okList.length?`<div class="fs10 mu_" style="margin-top:4px">Cliquez sur une carte pour ouvrir la fiche du candidat.</div>`:''}
   </div>`;
 }
 if(batch.done>0)toast(`${batch.done} candidat${batch.done>1?'s':''} ajouté${batch.done>1?'s':''} ✓`,'s');
 if(batch.errors>0&&batch.done===0)toast(`${batch.errors} CV n'ont pas pu être traités`,'e');
}

// ── TAB 2 : PIPELINE ───────────────────────────────────
function rPipeline(){
 const q=(document.getElementById('sp2')||{}).value?.toLowerCase()||'';
 const cf=(document.getElementById('fpc')||{}).value||'';
 const filt=DB.candidates.filter(c=>{
 if(c.status==='entrant')return false;
 const txt=(c.name+' '+(c.role||'')).toLowerCase();
 if(q&&!txt.includes(q))return false;
 if(cf&&c.cat!==cf)return false;
 return true;
 });
 const catOpts=BTP_CATS.map(c=>`<option value="${c.id}">${c.l}</option>`).join('');
 document.getElementById('cands-sub').innerHTML=`
 <div class="tb">
 <div class="srch"><input id="sp2" placeholder="Rechercher…" oninput="rPipeline()" value="${esc(q)}"></div>
 <select id="fpc" onchange="rPipeline()" style="max-width:175px"><option value="">Toutes catégories</option>${catOpts}</select>
 <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mu);cursor:pointer;margin:0;white-space:nowrap">
 <input type="checkbox" id="fpep" onchange="rPipeline()" style="width:11px;height:11px;accent-color:var(--ac4)">Pepites
 </label>
 </div>
 <div class="kb" style="grid-template-columns:repeat(6,minmax(172px,1fr))">${
 CAND_ST.filter(s=>!['entrant','placed','ko'].includes(s.id)).map((st,i)=>{
 const pepOnly=(document.getElementById('fpep')||{}).checked||false;
 const cards=filt.filter(c=>c.status===st.id&&(!pepOnly||c.pepite));
 const PBGS=['rgba(200,130,20,.15)','rgba(20,80,180,.15)','rgba(120,20,180,.15)','rgba(20,140,100,.15)','rgba(80,120,8,.15)'];
 const PTXS=['var(--ac4)','var(--ac5)','var(--ac6)','var(--ac2)','var(--ac)'];
 const hbg=PBGS[i]||'rgba(100,100,100,.1)';
 const htx=PTXS[i]||'var(--mu)';
 return`<div class="kbc">
 <div class="kbh" style="background:${hbg}"><span class="kbh-t" style="color:${htx}">${st.l}</span><span class="kbh-n" style="color:${htx}">${cards.length}</span></div>
 <div class="kbcards">${cards.length?cards.map(c=>candCard(c,st)).join(''):`<div class="empty-col">—</div>`}</div>
 </div>`;
 }).join('')
 }</div>`;
 if(cf){const el=document.getElementById('fpc');if(el)el.value=cf;}
}
function candCard(c,st){
 const cat=getCat(c.cat);
 const docs=(c.docs||[]).filter(docHasFile).length;
 return`<div class="cc ${c.pepite?'pep':''}" onclick="openCandPanel('${c.id}')" oncontextmenu="ctxCand(event,'${c.id}')">
 <div class="cc-name">${esc(c.name)}${c.pepite?'':''}</div>
 <div class="cc-role">${esc(c.role||'—')}${c.salary?` · <span style="color:var(--ac2)">${fM(c.salary)}</span>`:''}
 </div>
 <div class="cc-row"><span class="tag ${cat.cls}">${cat.l}</span><span class="fs10 mu_">${esc(c.source||'')}</span>${c.linked_need?`<span class="fs10 ac5"></span>`:''}</div>
 <div class="cc-row"><span class="fs10 mu_">Docs${docs}/${DOCS_LIST.length}</span><span class="fs10 mu_">Màj:${fD(c.updated)}</span></div>
 ${st.nxt?`<div class="cc-nxt">${st.nxt}</div>`:''}
 </div>`;
}
// ═══════════════════════════════════════════════════════════
// PRÉCAL FLOW — modal step by step
// ═══════════════════════════════════════════════════════════
function startPrecal(id){
 const c=cById(id);if(!c)return;
 const cvDoc=findDoc(c,'cv');
 const _cvSrc=cvDoc?docDirectSrc(cvDoc):null;
 const _cvIsPdf=cvDoc&&(cvDoc.type==='application/pdf'||(typeof _cvSrc==='string'&&/\.pdf(\?|$)/i.test(_cvSrc)));
 const cvHtml=cvDoc?(_cvIsPdf?`<iframe src="${_cvSrc}" style="width:100%;height:300px;border:none;border-radius:6px;margin-bottom:12px"></iframe>`:`<img src="${_cvSrc}" style="max-width:100%;max-height:300px;object-fit:contain;border-radius:6px;margin-bottom:12px">`):`<div style="background:var(--s3);border:1px dashed var(--bd2);border-radius:6px;padding:14px;text-align:center;margin-bottom:12px;color:var(--mu);font-size:11px">Aucun CV — <label style="color:var(--gold);cursor:pointer">Uploader<input type="file" accept=".pdf,.jpg,.png" style="display:none" onchange="uploadCvFromSplit(event,'${id}')"></label></div>`;
 const openNeeds=DB.needs.filter(n=>n.status==='open');
 const cat=getCat(c.cat);
 const matchedNeeds=openNeeds.filter(n=>n.cat===c.cat);
 openMo(`Précal — ${c.name}`,`
 <div class="steps">
 <div class="step"><div class="step-dot cur">1</div><span class="step-l cur">Qualifier</span></div>
 <div class="step-arr">→</div>
 <div class="step"><div class="step-dot">2</div><span class="step-l">Planifier</span></div>
 <div class="step-arr">→</div>
 <div class="step"><div class="step-dot">3</div><span class="step-l">Envoyer</span></div>
 </div>
 ${cvHtml}
 <div class="info-box mb12">
 Appeler <strong>${esc(c.name)}</strong>${c.phone?` au <strong>${fPhone(c.phone)}</strong>`:''}<br>
 <span class="fs10">Objectif : qualifier le profil et déterminer l'intérêt de poursuivre</span>
 </div>
 <div class="fg">
 <div class="fgrp ff">
 <span class="lbl">Intitulé du poste (libre)</span>
 <input id="pre-role" list="pre-role-list" value="${esc(c.role||'')}" placeholder="Ex : Conducteur de travaux, Chef de chantier, Électricien…" autocomplete="off">
 <datalist id="pre-role-list">
 ${BTP_CATS.flatMap(cat=>cat.jobs).map(j=>`<option value="${esc(j)}">`).join('')}
 </datalist>
 </div>
 <div class="fgrp"><span class="lbl">Spécialité / Secteur</span>
 <select id="pre-cat">
 ${BTP_CATS.map(cat=>`<option value="${cat.id}" ${(c.cat||'go')===cat.id?'selected':''}>${cat.l}</option>`).join('')}
 </select>
 </div>
 <div class="fgrp"><span class="lbl">Salaire souhaité (€/an)</span><input id="pre-sal" type="number" value="${c.salary||''}" placeholder="42000"></div>
 <div class="fgrp"><span class="lbl">Disponibilité</span><input id="pre-av" value="${esc(c.avail||'')}" placeholder="Immédiate / sous 1 mois…"></div>
 <div class="fgrp"><span class="lbl">Mobilité</span><input id="pre-mob" value="${esc(c.mobility||'')}" placeholder="Rhône-Alpes, National…"></div>
 <div class="fgrp ff"><span class="lbl">Notes précal (résumé appel)</span><textarea id="pre-notes" style="min-height:80px">${esc(c.notes_pre||'')}</textarea></div>
 </div>
 <div class="sl">Qualification</div>
 <div class="fg">
 <div class="fgrp"><span class="lbl">Correspond à un besoin ?</span>
 <select id="pre-need">
 <option value="">— Pas de besoin correspondant</option>
 ${matchedNeeds.length?matchedNeeds.map(n=>`<option value="${n.id}" ${c.linked_need===n.id?'selected':''}>${esc(n.title)} — ${coById(n.company_id)?.name||'?'}</option>`).join(''):''}
 ${!matchedNeeds.length?`<option disabled>Aucun besoin ouvert en ${cat.l}</option>`:''}
 </select>
 </div>
 <div class="fgrp"><span class="lbl">Profil</span>
 <select id="pre-profile">
 <option value="normal" ${!c.pepite?'selected':''}>Profil standard</option>
 <option value="pepite" ${c.pepite?'selected':''}>Pepite (profil rare)</option>
 </select>
 </div>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bg" onclick="savePrecalThenInvite('${id}')" title="Envoyer un email au candidat pour qu'il remplisse son dossier et choisisse lui-même son créneau">✉️ Envoyer invitation</button>
 <button class="btn bp" onclick="savePrecalStep1('${id}')">📞 Appel → Planifier moi-même</button>`
);
}
// Branche "invitation auto" : sauvegarde la qualif puis ouvre le flux d'invitation (crm-booking.js)
function savePrecalThenInvite(id){
 const c=cById(id);if(!c)return;
 // Réutilise la sauvegarde de la qualification sans enchaîner sur le calendrier manuel
 c.role=document.getElementById('pre-role').value.trim();
 c.cat=document.getElementById('pre-cat')?.value||c.cat||'go';
 c.salary=document.getElementById('pre-sal').value;
 c.avail=document.getElementById('pre-av').value;
 c.mobility=document.getElementById('pre-mob').value;
 c.notes_pre=document.getElementById('pre-notes').value;
 c.linked_need=document.getElementById('pre-need').value||null;
 c.pepite=document.getElementById('pre-profile').value==='pepite';
 c.status='precal';c.updated=now_();
 save();
 if(typeof window.startInvitation==='function'){window.startInvitation(id);}
 else{toast('Module booking non chargé — vérifiez crm-booking.js','e');}
}
function savePrecalStep1(id){
 const c=cById(id);if(!c)return;
 const notes=document.getElementById('pre-notes').value;
 c.role=document.getElementById('pre-role').value.trim();
 c.cat=document.getElementById('pre-cat')?.value||c.cat||'go';
 c.salary=document.getElementById('pre-sal').value;
 c.avail=document.getElementById('pre-av').value;
 c.mobility=document.getElementById('pre-mob').value;
 c.notes_pre=notes;
 c.linked_need=document.getElementById('pre-need').value||null;
 c.pepite=document.getElementById('pre-profile').value==='pepite';
 c.status='precal';c.updated=now_();
 save();
 // Go to step 2: calendar
 openCalendarMo(id);
}
// ═══════════════════════════════════════════════════════════
// CALENDAR MODAL — disponibilités + sélection créneau
// ═══════════════════════════════════════════════════════════
function openCalendarMo(candId){
 UI.calSelected=null;
 UI.calWeekOffset=0;
 renderCalMo(candId);
}
function getWeekDates(offset){
 const d=new Date();
 const dow=d.getDay();
 const monday=new Date(d);
 monday.setDate(d.getDate()-(dow===0?6:dow-1)+(offset*7));
 const days=[];
 for(let i=0;i<5;i++){const dd=new Date(monday);dd.setDate(monday.getDate()+i);days.push(dd);}
 return days;
}
function getTakenSlots(){
 // Returns set of "YYYY-MM-DD HH" strings for taken slots
 const taken=new Set();
 DB.agenda.filter(a=>!a.done&&a.date&&a.time).forEach(a=>{
 const dateStr=dayKey(a.date);
 const h=parseInt(a.time.split(':')[0]);
 taken.add(`${dateStr}_${h}`);
 // Block 1h duration
 taken.add(`${dateStr}_${h}`);
 });
 return taken;
}
function renderCalMo(candId){
 const c=cById(candId);
 const days=getWeekDates(UI.calWeekOffset);
 const taken=getTakenSlots();
 const now=new Date();
 const mondayLabel=fmtDate(days[0]);
 const fridayLabel=fmtDate(days[4]);
 let gridHtml='';
 // Header
 gridHtml+=`<div class="cal-hd-cell" style="font-size:9px;color:var(--mu2)">Heure</div>`;
 days.forEach(d=>{
 const isToday_=d.toDateString()===new Date().toDateString();
 gridHtml+=`<div class="cal-hd-cell ${isToday_?'today':''}">${fmtDate(d)}</div>`;
 });
 // Slots
 WEEK_HOURS.forEach(h=>{
 const isLouis=isSuperviseur();
    const gwH=isLouis?frToGwada(h):null;
    gridHtml+=`<div class="cal-time" style="flex-direction:column;gap:1px;align-items:center">
      <span style="font-size:11px;font-weight:700">${h}h</span>
      ${isLouis?`<span style="font-size:8px;color:var(--gold);opacity:.8">${gwH}h🌴</span>`:''}
    </div>`;
 days.forEach(d=>{
 const dateStr=d.toISOString().split('T')[0];
 const key=`${dateStr}_${h}`;
 const slotDt=new Date(d);slotDt.setHours(h,0,0,0);
 const isPast_=slotDt<now;
 const isTaken=taken.has(key);
 const isSel=UI.calSelected?.dateStr===dateStr&&UI.calSelected?.h===h;
 let cls='cal-slot';
 if(isPast_)cls+=' past';
 else if(isTaken)cls+=' taken';
 else cls+=' avail';
 if(isSel)cls+=' selected';
 let inner='';
 if(isTaken){
 const ev=DB.agenda.find(a=>{return dayKey(a.date)===dateStr&&parseInt((a.time||'').split(':')[0])===h;});
 inner=`<div class="cal-ev taken-ev">${ev?esc(ev.title.slice(0,18)):'Occupé'}</div>`;
 }
 if(isSel){inner=`<div class="cal-ev new-ev">✓ Sélectionné</div>`;}
 const clickable=!isPast_&&!isTaken;
 gridHtml+=`<div class="${cls}" ${clickable?`onclick="selectSlot('${candId}','${dateStr}',${h})"`:''}>${inner}</div>`;
 });
 });
 openMo(` Planifier entretien visio — ${c?c.name:''}`,`
 <div class="steps">
 <div class="step"><div class="step-dot done">1</div><span class="step-l done">Qualifier</span></div>
 <div class="step-arr">→</div>
 <div class="step"><div class="step-dot cur">2</div><span class="step-l cur">Planifier</span></div>
 <div class="step-arr">→</div>
 <div class="step"><div class="step-dot">3</div><span class="step-l">Envoyer</span></div>
 </div>
 <div class="info-box mb10">Sélectionnez un créneau d'1h pour l'entretien visio.<br><span class="fs10">· Disponible &nbsp;|&nbsp; ● Occupé (agenda) &nbsp;|&nbsp; Grisé = passé</span></div>
 <div class="cal-nav">
 <button class="btn bg bsm" onclick="calPrevWeek('${candId}')">← Sem. précédente</button>
 <div class="cal-week-l">${mondayLabel} — ${fridayLabel}</div>
 <button class="btn bg bsm" onclick="calNextWeek('${candId}')">Sem. suivante →</button>
 </div>
 <div class="cal-wrap"><div class="cal-grid" style="grid-template-rows:auto ${WEEK_HOURS.map(()=>'34px').join(' ')}">${gridHtml}</div></div>
 ${UI.calSelected?`<div style="margin-top:10px;padding:9px 11px;background:rgba(61,224,154,.07);border:1px solid rgba(61,224,154,.2);border-radius:3px;font-size:11px">Créneau sélectionné : <strong>${UI.calSelected.label}</strong></div>`:''}`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bg" onclick="startPrecal('${candId}')">← Retour</button>
 <button class="btn bp" ${!UI.calSelected?'disabled style="opacity:.4;cursor:not-allowed"':''} onclick="proceedToEmail('${candId}')">Valider → Préparer email</button>`
);
}
function calPrevWeek(id){UI.calWeekOffset--;renderCalMo(id);}
function calNextWeek(id){UI.calWeekOffset++;renderCalMo(id);}
function selectSlot(candId,dateStr,h){
 const d=parseDayLocal(dateStr);
 const days=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
 const label=`${days[d.getDay()]} ${d.getDate()}/${d.getMonth()+1} à ${h}h00–${h+1}h00`;
 UI.calSelected={dateStr,h,label};
 renderCalMo(candId);
}
// ═══════════════════════════════════════════════════════════
// STEP 3 — EMAIL AUTO avec lien visio
// ═══════════════════════════════════════════════════════════
function proceedToEmail(candId){
 if(!UI.calSelected){toast('Sélectionnez d\'abord un créneau','e');return;}
 const c=cById(candId);if(!c)return;
 const visioLink=genJitsiLink();
 const sel=UI.calSelected;
 const d=parseDayLocal(sel.dateStr); // ← jour local (midi), JAMAIS new Date("YYYY-MM-DD") = minuit UTC = veille en Guadeloupe
 const dateStr=`${d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} de ${sel.h}h00 à ${sel.h+1}h00`;
 c.visio_link=visioLink;c.int_date_planned=sel.dateStr;c.int_time=`${sel.h}:00`;c.updated=now_();save();

 // Récupérer signature + infos depuis paramètres
 const nom=localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||'[Votre nom]';
 const tel=localStorage.getItem(uKey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'';
 const dossierUrl=localStorage.getItem('btp_dossier_url')||'';
 const firstN=greetCand(c);

 const dossierLink=`https://novalem-crm.vercel.app/dossier.html?cid=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.name)}`;
 const emailBody=`Bonjour ${firstN},

Suite à notre échange téléphonique, je vous confirme notre entretien visio :

Date : ${dateStr}
Lien de connexion : ${visioLink}

Merci de vous connecter 2-3 minutes avant l'heure prévue.

─────────────────────────
Dossier de candidature
─────────────────────────
Merci de compléter votre dossier en cliquant sur le bouton ci-dessous :

[Compléter mon dossier en ligne](${dossierLink})

Cordialement,
${nom}
Novalem — Cabinet de recrutement`;

 closeMo();
 // Ajouter l'entretien à l'agenda (automatique)
 confirmEmailSent(candId,visioLink,sel.dateStr,sel.h);
 // Ouvrir le compose email avec le bon destinataire
 EM={to:c.email||'',subject:`Entretien visio NOVALEM — ${dateStr}`,body:emailBody,candId:candId,coId:null,tplKey:null};
 EM_VIEW='compose';
 EM_RECIPIENTS=c.email?[{email:c.email,name:c.name,type:'cand',entityId:candId}]:[];
 window._pendingAttachment=null;
 go('emails');
 setTimeout(()=>_emInitRecipients(),100);
}
function cpEmail(){const ta=document.querySelector('#mb textarea');if(!ta)return;navigator.clipboard.writeText(ta.value).then(()=>toast('Email copié ✓','i'));}
function cpText(t){navigator.clipboard.writeText(t).then(()=>toast('Copié ✓','i'));}
function confirmEmailSent(candId,visioLink,dateStr,h){
 const c=cById(candId);if(!c)return;
 // Move to "dossier" stage
 c.status='dossier';
 c.visio_link=visioLink;
 c.int_date_planned=dateStr;
 c.int_time=`${h}:00`;
 c.email_sent=now_();
 c.updated=now_();
 // Auto-add to agenda (date normalisée — plus de décalage)
 addAgendaAuto({
  type:'visio',
  title:`Entretien visio — ${c.name}`,
  date:dateStr,
  time:`${h}:00`,
  cand_id:c.id,
  notes:`Entretien visio planifié.\nLien : ${visioLink}`,
  _auto:true
 });
 save();closeMo();closePanel();
 badges();
 if(UI.view==='cands') rCands();
 const gwHour=frToGwada(h);
  toast(`${c.name} → Entretien ${h}h FR = ${gwHour}h Gwada · Agenda ✓`,'s');
 // Show in pipeline
 setTimeout(()=>{switchCandTab('pipeline');openCandPanel(candId);},300);
}
// ═══════════════════════════════════════════════════════════
// openCandPanel defined below
function setCPTab(i,id){
 UI.ptab=i;
 if(i===4){const cand=cById(id);if(cand&&cand._dossier_validated&&!cand._dossier_notif_seen){cand._dossier_notif_seen=true;save();badges();}}
 renderCandPanelTab(id);
}
function setCoTab(i,id){UI.ptab=i;openCoPanel(id);}
function renderCandPanelTab(id){
 const c=cById(id);if(!c)return;
 // Source unique de vérité : openCandPanel reconstruit la barre d'onglets ET le
 // corps avec le MÊME ordre [Profil, Fichiers, Entretien, Références, Suivi].
 // (Avant, un tableau au mauvais ordre faisait basculer l'onglet Fichiers vers
 // Entretien après un upload.)
 openCandPanel(id);
 // Bind file inputs after render (onglet Fichiers = index 1)
 if(UI.ptab===1) bindFileInputs(id);
}

// TAB 0 — PROFIL
function renderCPProfil(c){
 const openNeeds=DB.needs.filter(n=>n.status==='open');
 return`
 ${c.phone?`<div class="callbox"><div class="callbox-ph">${fPhone(c.phone)}</div><button class="btn bg bxs" onclick="cpPhone('${esc(c.phone)}')">⧉</button></div>`:''}
 ${c.visio_link?`<div class="visio-box"><span class="fs10 mu_"> Lien visio planifié :</span><br><span class="visio-link">${esc(c.visio_link)}</span><br><button class="btn bg bxs mt4" onclick="cpText('${esc(c.visio_link)}')">Copier</button></div>`:''}
 <div class="dr"><span class="drk">Poste</span><span class="drv">${esc(c.role||'—')}</span></div>
 <div class="dr"><span class="drk">Salaire</span><span class="drv">${fM(c.salary)} <span class="mu_ fs10">(hon. ${honor(c.salary)})</span></span></div>
 <div class="dr"><span class="drk">Email</span><span class="drv">${esc(c.email||'—')}</span></div>
 <div class="dr"><span class="drk">Disponibilité</span><span class="drv">${esc(c.avail||'—')}</span></div>
 <div class="dr"><span class="drk">Mobilité</span><span class="drv">${esc(c.mobility||'—')}</span></div>
 <div class="dr"><span class="drk">Source</span><span class="drv">${esc(c.source||'—')}</span></div>
 <div class="dr"><span class="drk">Email envoyé</span><span class="drv">${c.email_sent?`${fD(c.email_sent)}`:'—'}</span></div>
 <div class="dr"><span class="drk">Entretien planifié</span><span class="drv">${c.int_date_planned?`${fD(c.int_date_planned)} à ${c.int_time||'—'}`:'—'}</span></div>
 <div class="sl">Notes précal</div>
 ${c.notes_pre?`<div class="notebox">${esc(c.notes_pre)}</div>`:'<div class="mu_ fs11 mt4">Pas de notes</div>'}
 <div class="sl">Statut pipeline <span><button class="btn bg bxs" onclick="openStatusTree('${c.id}')">Voir pipeline</button></span></div>
 <div class="st-sel">${CAND_ST.map(s=>`<div class="st-btn ${s.id===c.status?'cur':''}" onclick="setCS('${c.id}','${s.id}')">${s.l}</div>`).join('')}</div>
 <div class="sl">Matchage besoin</div>
 <div class="flex fw" style="gap:4px">${DB.needs.filter(n=>n.status==='open').map(n=>`<button class="btn bxs ${c.linked_need===n.id?'bp':'bg'}" onclick="toggleNeedLink('${c.id}','${n.id}')">${c.linked_need===n.id?'✓ ':''} ${esc(n.title)}</button>`).join('')||'<span class="mu_ fs10">Aucun besoin ouvert</span>'}</div>`;
}

// TAB 1 — ENTRETIEN
function renderCPEntretien(c){
 const cockpitBtn=(c.int_date_planned||c.visio_link)?`<button class="btn bp btn-full" style="margin-bottom:10px" onclick="openInterviewModal('${c.id}')">▶ Ouvrir le cockpit d'entretien</button>`:'';
 return cockpitBtn+`
 <div class="dr"><span class="drk">Entretien fait</span><span class="drv">${c.int_done?`${fD(c.int_date)}`:'Non'}</span></div>
 <div class="dr"><span class="drk">Planifié le</span><span class="drv">${c.int_date_planned?`${fD(c.int_date_planned)} ${c.int_time||''}`:' —'}</span></div>
 ${c.visio_link?`<div class="dr"><span class="drk">Lien visio</span><span class="drv"><a href="${esc(c.visio_link)}" target="_blank" style="color:var(--ac5)">Ouvrir →</a></span></div>`:''}
 <div class="sl">Synthèse entretien <span><button class="btn bg bxs" onclick="markIntDone('${c.id}')">Marquer fait</button></span></div>
 <textarea id="int-note-${c.id}" style="min-height:110px;margin-bottom:7px">${esc(c.notes_int||'')}</textarea>
 <button class="btn bp bsm btn-full" onclick="saveIntNote('${c.id}')">Sauvegarder synthèse</button>
 <div class="sl mt12">Notes générales</div>
 <textarea id="gen-note-${c.id}" style="min-height:60px;margin-bottom:7px">${esc(c.notes||'')}</textarea>
 <button class="btn bg bsm" onclick="saveGenNote('${c.id}')">Sauvegarder note</button>`;
}

// TAB 2 — FICHIERS (avec upload)
function renderCPFichiers(c){
 const docs=c.docs||[];
 const uploaded=docs.filter(docHasFile).length;
 const hasDossierPdf=!!findDoc(c,'dossier');
 const dossierBadge=c._dossier_validated
  ?'<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(45,212,160,.08);border:1px solid rgba(45,212,160,.25);border-radius:var(--r2);margin-bottom:12px"><span style="font-size:18px">&#x2705;</span><div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--ac2)">Dossier signé &amp; validé</div><div style="font-size:10px;color:var(--mu)">Réf. '+(c._dossier_ref||'—')+' · '+(c._dossier_validated_at?fD(c._dossier_validated_at):'—')+'</div></div></div>'
  :'<div style="padding:9px 12px;background:rgba(201,137,26,.07);border:1px solid rgba(201,137,26,.2);border-radius:var(--r2);margin-bottom:12px;font-size:11px;color:var(--ac4)">⚠ Dossier non reçu — <a href="https://novalem-crm.vercel.app/dossier.html?cid='+c.id+'&n='+encodeURIComponent(c.name)+'" target="_blank" style="color:var(--ac4);font-weight:700">Envoyer le lien</a></div>';
 // Bouton principal : ouvrir le dossier de candidature complet (récap + pièces)
 const fullBtn=(c._dossier_validated||c._dossier_data||hasDossierPdf||uploaded>0)
  ?`<button class="btn bp btn-full" style="margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:7px" onclick="openFullDossier('${c.id}')"><span style="font-size:15px">📂</span> Ouvrir le dossier de candidature complet</button>`
  :'';
return dossierBadge+fullBtn+`
 <div class="flex fjb fac mb8">
 <span class="fs11">${uploaded}/${DOCS_LIST.length} documents reçus</span>
 <div class="pgbar" style="width:100px"><div class="pgfill" style="width:${Math.round(uploaded/DOCS_LIST.length*100)}%"></div></div>
 </div>
 <div style="margin-bottom:10px">
 <label class="btn bp bsm" style="cursor:pointer;display:inline-flex;gap:5px">
 Upload multi-fichiers
 <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none" onchange="handleSmartUpload(event,'${c.id}')">
 </label>
 <span style="font-size:10px;color:var(--mu);margin-left:8px">Dépose plusieurs fichiers — classés automatiquement</span>
 </div>
 ${DOCS_LIST.map(d=>{
 const existing=docs.find(x=>x.id===d.id);
 const present=docHasFile(existing);
 return`<div class="file-row">
 <div class="file-ico">${d.ico}</div>
 <div class="file-info">
 <div class="file-name">${esc(d.l)}</div>
 ${present?`<div class="file-meta">${esc(existing.name||d.l)}${existing.size?' · '+existing.size:''} · ${fD(existing.date)}</div>`:`<div class="file-meta mu_">Non reçu</div>`}
 </div>
 <span class="file-status ${present?'fs-ok':'fs-miss'}">${present?'✓ OK':'Manquant'}</span>
 ${present?`<button class="btn bg bxs" onclick="openDocPreview('${c.id}','${d.id}')" style="font-size:11px" title="Ouvrir / aperçu">👁</button>`:''}
    <label class="file-upload-btn">
 ${present?'↑ Remplacer':'↑ Upload'}
 <input type="file" data-docid="${d.id}" data-candid="${c.id}" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none" onchange="handleFileUpload(event)">
 </label>
 ${present?`<button class="btn bd_ bxs" onclick="removeDoc('${c.id}','${d.id}')">×</button>`:''}
 </div>`;
 }).join('')}
 ${findDoc(c,'cv')?`
 <div style="margin-top:14px;padding:10px 12px;background:rgba(154,74,224,.07);border:1px solid rgba(154,74,224,.25);border-radius:3px">
 <div style="font-size:11px;margin-bottom:7px;display:flex;align-items:center;gap:6px">
 <span class="ai-badge">IA</span>
 <strong>Extraction automatique des données du CV</strong>
 </div>
 <div style="font-size:10px;color:var(--mu);margin-bottom:8px">Nom, email, téléphone, poste, salaire, disponibilité → pré-remplis automatiquement dans la fiche.</div>
 <button id="ai-btn-${c.id}" class="btn bsm" style="background:rgba(154,74,224,.15);color:var(--ac6);border:1px solid rgba(154,74,224,.3)" onclick="aiExtractCV('${c.id}')">Analyser CV</button>
 ${c.cv_extracted?`<div style="font-size:10px;color:var(--ac2);margin-top:5px">Dernière extraction effectuée</div>`:''}
 </div>`:`
 <div style="margin-top:10px;font-size:10px;color:var(--mu2)"> Uploadez le CV pour activer l'extraction IA automatique.</div>`}`;
}
function bindFileInputs(candId){/* inputs already bound via onchange in HTML */}
// ── Stockage des pièces candidat dans le bucket privé "candidat-docs" ──
// Évite la limite de 3 Mo et la saturation du cache : les fichiers vont dans
// le stockage Supabase, la fiche ne garde qu'un chemin + une URL signée.
async function cvBucketUpload(candId, slotId, file){
 const sb=getSB(); if(!sb) throw new Error('Cloud indisponible');
 const ext=(file.name&&file.name.includes('.'))?file.name.split('.').pop().toLowerCase():'bin';
 const path=`${candId}/${slotId}.${ext}`;
 const { error }=await sb.storage.from('candidat-docs').upload(path, file, { contentType:file.type||'application/octet-stream', upsert:true });
 if(error) throw error;
 let url=null;
 try{ const { data:s }=await sb.storage.from('candidat-docs').createSignedUrl(path, 60*60*24*365); url=(s&&s.signedUrl)||null; }catch(_){}
 return { storage_path:path, url };
}
async function freshDocUrl(storage_path){
 const sb=getSB(); if(!sb||!storage_path) return null;
 try{ const { data:s }=await sb.storage.from('candidat-docs').createSignedUrl(storage_path, 60*60); return (s&&s.signedUrl)||null; }catch(_){ return null; }
}
// Renvoie {mediaType, base64} d'une pièce (bucket OU base64 hérité) — pour l'IA.
async function docToBase64(doc, candId){
 if(!doc) return null;
 if(typeof doc.file==='string' && doc.file.startsWith('data:')){
   return { mediaType: doc.type||'application/pdf', base64: doc.file.split(',')[1]||'' };
 }
 // Pièce déchargée hors fiche → base64 récupéré dans crm_candidat_files
 if(doc._pg && candId){
   const pg=await pgFileBase64(candId, doc.id);
   if(pg && pg.base64) return { mediaType: pg.mediaType||doc.type||'application/pdf', base64: pg.base64 };
 }
 let url=null;
 if(doc.storage_path) url=await freshDocUrl(doc.storage_path);
 else if(doc.url) url=doc.url;
 else if(typeof doc.file==='string' && /^https?:/.test(doc.file)) url=doc.file;
 if(!url) return null;
 try{
   const resp=await fetch(url); const blob=await resp.blob();
   const b64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(((r.result||'')+'').split(',')[1]||''); r.onerror=rej; r.readAsDataURL(blob); });
   return { mediaType: doc.type||blob.type||'application/pdf', base64: b64 };
 }catch(_){ return null; }
}

// ── Upload multi-fichiers "intelligent" (dépôt rapide sur la fiche) ──
// Tu déposes un ou plusieurs fichiers, ils sont classés par nom et envoyés
// dans le bucket. C'est le bouton "Upload multi-fichiers" de l'onglet Fichiers.
async function handleSmartUpload(event, candId){
 const input=event.target;
 const files=Array.from(input.files||[]);
 if(!files.length) return;
 const c=cById(candId); if(!c) return;
 c.docs=c.docs||[];
 const classify=(name)=>{
   const n=(name||'').toLowerCase();
   if(/\bcv\b|curriculum|resume/.test(n)) return 'cv';
   if(/cni|identit|passeport|titre|sejour|séjour/.test(n)) return 'id_card';
   if(/permis/.test(n)) return 'permis';
   if(/vitale|secu|sécu/.test(n)) return 'carte_vit';
   if(/dossier/.test(n)) return 'dossier';
   return null;
 };
 const genericSlot=()=>{ let i=1; while(c.docs.find(d=>d.id==='pj_'+i)) i++; return 'pj_'+i; };
 toast(files.length>1?`Upload de ${files.length} fichiers…`:'Upload en cours…','i');
 for(const file of files){
   let slot=classify(file.name);
   if(!slot) slot=(!c.docs.find(d=>d.id==='cv'))?'cv':genericSlot();
   try{
     const { storage_path, url }=await cvBucketUpload(candId, slot, file);
     const entry={ id:slot, name:file.name, size:formatSize(file.size), date:now_(), type:file.type, storage_path, url, file:url };
     const idx=c.docs.findIndex(d=>d.id===slot);
     if(idx>=0)c.docs[idx]=entry; else c.docs.push(entry);
   }catch(e){
     // Repli : décharge dans crm_candidat_files (jamais de base64 dans la fiche)
     const ok=await _withTimeout(pgFilePut(candId, slot, file), 20000, false);
     if(ok){
       const entry={ id:slot, name:file.name, size:formatSize(file.size), date:now_(), type:file.type, _pg:true };
       const idx=c.docs.findIndex(d=>d.id===slot);
       if(idx>=0)c.docs[idx]=entry; else c.docs.push(entry);
     } else { toast('Échec upload '+file.name+' : '+(e.message||e),'e'); }
   }
 }
 c.updated=now_(); save();
 if(typeof renderCandPanelTab==='function') renderCandPanelTab(candId);
 input.value='';
 toast('Fichiers ajoutés ✓','s');
}

async function handleFileUpload(event){
 const input=event.target;
 const docId=input.dataset.docid;
 const candId=input.dataset.candid;
 const file=input.files[0];if(!file)return;
 const c=cById(candId);if(!c)return;
 toast('Upload en cours…','i');
 try{
   const { storage_path, url }=await cvBucketUpload(candId, docId, file);
   c.docs=c.docs||[];
   const idx=c.docs.findIndex(d=>d.id===docId);
   const docData={id:docId,name:file.name,size:formatSize(file.size),date:now_(),type:file.type,storage_path,url,file:url};
   if(idx>=0)c.docs[idx]=docData;else c.docs.push(docData);
   c.updated=now_();save();
   if(typeof renderCandPanelTab==='function') renderCandPanelTab(candId);
   toast(`${file.name} uploadé ✓`,'s');
 }catch(e){
   // Repli : décharge dans crm_candidat_files (PAS de base64 dans la fiche, pour ne pas alourdir les chargements)
   const ok=await _withTimeout(pgFilePut(candId, docId, file), 20000, false);
   if(ok){
     c.docs=c.docs||[];
     const idx=c.docs.findIndex(d=>d.id===docId);
     const docData={id:docId,name:file.name,size:formatSize(file.size),date:now_(),type:file.type,_pg:true};
     if(idx>=0)c.docs[idx]=docData;else c.docs.push(docData);
     c.updated=now_();save();
     if(typeof renderCandPanelTab==='function')renderCandPanelTab(candId);
     toast(`${file.name} uploadé`,'s');
   } else { toast('Échec upload : '+(e.message||e),'e'); }
 }
 input.value='';
}
function formatSize(bytes){if(bytes<1024)return bytes+'o';if(bytes<1024*1024)return Math.round(bytes/1024)+'Ko';return(bytes/1024/1024).toFixed(1)+'Mo';}
function removeDoc(candId,docId){
 const c=cById(candId);if(!c)return;
 const doc=(c.docs||[]).find(d=>d.id===docId);
 if(doc&&doc.storage_path){ const sb=getSB(); if(sb){ try{ sb.storage.from('candidat-docs').remove([doc.storage_path]); }catch(_){} } }
 if(doc&&doc._pg){ const sb=getSB(); if(sb){ try{ sb.from('crm_candidat_files').delete().eq('cand_id',candId).eq('slot',docId); }catch(_){} } }
 c.docs=(c.docs||[]).filter(d=>d.id!==docId);c.updated=now_();save();
 if(typeof renderCandPanelTab==='function') renderCandPanelTab(candId);
 toast('Fichier supprimé','w');
}

// TAB 3 — RÉFÉRENCES
function renderCPRefs(c){
 return`
 <div class="dr"><span class="drk">Contrôle REF</span><span class="drv">${c.ref_done?'Fait':'À faire'}</span></div>
 <div class="sl">Références <span><button class="btn bg bxs" onclick="addRef('${c.id}')">+ Ajouter</button></span></div>
 ${(c.refs||[]).length?(c.refs||[]).map((r,i)=>`<div class="refcard">
 <div class="flex fac fjb mb4"><strong class="fs11">${esc(r.company)}</strong><button class="btn bd_ bxs" onclick="rmRef('${c.id}',${i})">×</button></div>
 <div class="mu_ fs10">${esc(r.contact||'—')}${r.phone?` · ${esc(r.phone)}`:''}</div>
 ${r.done?`<div style="color:var(--ac2);font-size:10px;margin-top:4px">Appelé — ${esc(r.note||'OK')}</div>`:`<div style="color:var(--ac4);font-size:10px;margin-top:4px">À appeler</div>`}
 <div class="flex fw" style="gap:5px;margin-top:7px">
 ${r.phone?`<button class="btn bg bxs" onclick="cpPhone('${esc(r.phone)}')">${esc(r.phone)}</button>`:''}
 <button class="btn bg bxs" onclick="togRef('${c.id}',${i})">${r.done?'↺':'Fait'}</button>
 <button class="btn bi bxs" onclick="prosFromRef('${c.id}',${i})">→ Prospecter</button>
 </div>
 </div>`).join(''):'<div class="mu_ fs11 mt4">Aucune référence</div>'}
 <div class="sl mt12">Notes générales</div>
 <textarea id="gen-note2-${c.id}" style="min-height:64px;margin-bottom:6px">${esc(c.notes||'')}</textarea>
 <button class="btn bp bsm" onclick="saveGenNote2('${c.id}')">Sauvegarder</button>`;
}
// ═══════════════════════════════════════════════════════════
// AUTRES VUES (inchangées par rapport à v2)
// ═══════════════════════════════════════════════════════════
function rNeeds(){
 const q=(document.getElementById('sn')||{}).value?.toLowerCase()||'';
 const uf=(document.getElementById('fu')||{}).value||'';
 const sf=(document.getElementById('fns')||{}).value||'';
 const NST=[{id:'open',l:'Ouvert'},{id:'sent',l:'CV envoyés'},{id:'interview',l:'Entretiens'},{id:'won',l:'Placé'},{id:'lost',l:'Perdu'}];
 const filt=DB.needs.filter(n=>{
 const co=coById(n.company_id);
 const txt=((n.title||'')+(co?co.name:'')).toLowerCase();
 if(q&&!txt.includes(q))return false;
 if(uf&&n.urgency!==uf)return false;
 if(sf&&n.status!==sf)return false;
 return true;
 });
 const stOpts=NST.map(s=>`<option value="${s.id}">${s.l}</option>`).join('');
 document.getElementById('view-needs').innerHTML=`
 <div class="tb">
 <div class="srch"><input id="sn" placeholder="Rechercher besoin…" oninput="rNeeds()"></div>
 <select id="fu" onchange="rNeeds()" style="max-width:140px"><option value="">Toute urgence</option><option value="h">Urgent</option><option value="m">○ Moyen</option><option value="l">Long terme</option></select>
 <select id="fns" onchange="rNeeds()" style="max-width:140px"><option value="">Tous statuts</option>${stOpts}</select>
 </div>
 ${filt.length?`<div class="g3">${filt.map(n=>needCard(n)).join('')}</div>`:'<div class="empty">Aucun besoin — <button class="btn bp bxs" onclick="openNeedForm()">+ Créer</button></div>'}`;
}
function needCard(n){
 const co=coById(n.company_id);
 const cat=getCat(n.cat);
 const cands=DB.candidates.filter(c=>c.linked_need===n.id);
 const NST=[{id:'open',l:'Ouvert',p:'ppre'},{id:'sent',l:'CV envoyés',p:'pdos'},{id:'interview',l:'Entretiens',p:'pvis'},{id:'won',l:'Placé',p:'pplac'},{id:'lost',l:'Perdu',p:'pko'}];
 const st=NST.find(s=>s.id===n.status)||NST[0];
 const ucls={h:'var(--ac3)',m:'var(--ac4)',l:'var(--mu2)'}[n.urgency]||'var(--mu2)';
 return `<div class="nc u${n.urgency||'l'}" onclick="openNeedPanel('${n.id}')">
 <div class="nc-co">${co?esc(co.name):'— Entreprise ?'}</div>
 <div class="nc-t">${esc(n.title)}</div>
 <div class="nc-m">
 <span class="tag ${cat.cls}">${cat.l}</span><br>
 ${n.smin&&n.smax?`${fM(n.smin)}–${fM(n.smax)}`:n.smax?`≤${fM(n.smax)}`:'À définir'}<br>
 ${esc(n.location||'France')} · ${n.start?fD(n.start):'ASAP'}
 </div>
 <div class="nc-ft">
 <span class="pill ${st.p}">${st.l}</span>
 <span class="fs10" style="color:${ucls}">${{h:'Urgent',m:'○ Moyen',l:'Long terme'}[n.urgency]||''}</span>
 <span class="fs10 mu_ ml-auto" style="margin-left:auto">${cands.length}</span>
 </div>
 </div>`;
}

// ═══════════════════════════════════════════════════════
// PROSPECTS
// ═══════════════════════════════════════════════════════
function processNRPs(){
 const tk=todayKey();
 let changed=false;
 DB.companies.forEach(c=>{
 if(c.status==='nrp'&&c.next_call_date){
 if(dayKey(c.next_call_date)<=tk){c.status='tocall';c.next_call_date=null;changed=true;}
 }
 });
 if(changed)save();
}
function rPros() {
 processNRPs();
 const el = document.getElementById('view-pros');

 // Compute overdue/today reminders for nobiz
 const nobiZToday = DB.companies.filter(c =>
 c.type === 'prospect' && c.status === 'nobiz' && c.nobiz_remind &&
 new Date(c.nobiz_remind) <= new Date()
).length;

 // Tab bar
 const tabHtml = PRO_TABS.map(t => {
 let badge = '';
 if (t.id === 'nobiz' && nobiZToday) badge = `<span style="background:rgba(223,152,56,.25);color:var(--ac4);font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px">${nobiZToday}</span>`;
 return `<div class="vt ${proTab === t.id ? 'act' : ''}" onclick="setProTab('${t.id}')">${t.l}${badge}</div>`;
 }).join('');

 el.innerHTML = `
 <div class="vtabs" style="margin-bottom:12px">${tabHtml}</div>
 <div id="pro-sub"></div>`;

 renderProSub();
}

function setProTab(id) {
 proTab = id;
 renderProSub();
 // update vtabs active state
 document.querySelectorAll('#view-pros .vt').forEach((el, i) => {
 el.classList.toggle('act', PRO_TABS[i].id === id);
 });
}

function renderProSub() {
 const el = document.getElementById('pro-sub');
 if (!el) return;
 if (proTab === 'active') renderProActive(el);
 else if (proTab === 'nobiz') renderProNobiz(el);
 else renderProRefused(el);
}

// ── RECHERCHE / TRI PROSPECTS — état + utilitaires ─────
// proQuery / proSortKey sont conservés au niveau module pour survivre aux
// re-rendus complets (changement d'onglet, sauvegarde, mode sélection…).
let proQuery = '';
let proSortKey = 'smart';     // smart | name | city | phone | email | marge_desc | marge_asc
let _proVisible = [];          // instantané des prospects actifs (re-calculé à chaque rendu complet)

// Normalise une chaîne pour une recherche/un tri tolérants : minuscules,
// suppression des accents (é/è/ê → e…) et de la ponctuation. Permet à
// « reiniere » de retrouver « Les Ateliers de la Reinière ».
function _normTxt(s) {
 return (s == null ? '' : String(s))
 .toLowerCase()
 .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // accents
 .replace(/[^a-z0-9]+/g, ' ')                         // ponctuation → espace
 .trim();
}

// Vrai si chaque mot tapé apparaît quelque part dans les champs du prospect.
// Recherche sur : raison sociale, ville, téléphone, email, contact, fonction.
function _proMatch(c, q) {
 if (!q) return true;
 const hay = _normTxt([c.name, c.city, c.phone, c.email, c.contact, c.ctitle].filter(Boolean).join(' '));
 const tokens = _normTxt(q).split(' ').filter(Boolean);
 return tokens.every(t => hay.includes(t));
}

// Tri selon proSortKey. Les valeurs vides (ville/email manquants) sont
// renvoyées en fin de liste pour les tris alphabétiques.
function _sortPros(arr) {
 const a = arr.slice();
 const byText = (k) => (x, y) => {
 const vx = _normTxt(x[k]), vy = _normTxt(y[k]);
 if (!vx && vy) return 1;
 if (vx && !vy) return -1;
 return vx.localeCompare(vy, 'fr');
 };
 switch (proSortKey) {
 case 'name':  a.sort(byText('name')); break;
 case 'city':  a.sort(byText('city')); break;
 case 'phone': a.sort(byText('phone')); break;
 case 'email': a.sort(byText('email')); break;
 case 'marge_asc':  a.sort((x, y) => (Number(x.marge) || 0) - (Number(y.marge) || 0)); break;
 case 'marge_desc': a.sort((x, y) => (Number(y.marge) || 0) - (Number(x.marge) || 0)); break;
 default: // 'smart' : à rappeler → à appeler → NRP, puis marge décroissante
 a.sort((x, y) => {
 const order = { callback: 0, tocall: 1, nrp: 2 };
 const ox = order[x.status] ?? 3, oy = order[y.status] ?? 3;
 if (ox !== oy) return ox - oy;
 return (Number(y.marge) || 0) - (Number(x.marge) || 0);
 });
 }
 return a;
}

// ── ACTIVE TAB ─────────────────────────────────────────
function renderProActive(el) {
 const today = new Date(); today.setHours(0, 0, 0, 0);

 let pros = DB.companies.filter(c => c.type === 'prospect' && !['nobiz', 'refused'].includes(c.status));

 // Logique « NRP → jour suivant » : si NRP et date de rappel atteinte, repasse en à appeler
 pros.forEach(c => {
 if (c.status === 'nrp' && c.next_call_date) {
 if (dayKey(c.next_call_date) <= todayKey()) { c.status = 'tocall'; c.next_call_date = null; }
 }
 });

 // Masque les rappels planifiés dans le futur (pas encore dus)
 _proVisible = pros.filter(c => {
 if (c.status === 'callback' && c.next_call_date) {
 return dayKey(c.next_call_date) <= todayKey();
 }
 return true;
 });

 // Compte les rappels futurs (cachés)
 const futureCallbacks = pros.filter(c => {
 if (c.status === 'callback' && c.next_call_date) {
 return dayKey(c.next_call_date) > todayKey();
 }
 return false;
 }).length;

 const sortOpts = [
 { v: 'smart', l: 'Tri : pertinence' },
 { v: 'name', l: 'Nom (A→Z)' },
 { v: 'city', l: 'Ville (A→Z)' },
 { v: 'phone', l: 'Téléphone' },
 { v: 'email', l: 'Email (A→Z)' },
 { v: 'marge_desc', l: 'Marge (décroissante)' },
 { v: 'marge_asc', l: 'Marge (croissante)' },
 ].map(o => `<option value="${o.v}" ${proSortKey === o.v ? 'selected' : ''}>${o.l}</option>`).join('');

 // La barre d'outils (dont le champ de recherche) n'est construite qu'une fois ;
 // seules les lignes du tableau sont rafraîchies à la frappe → le focus est conservé.
 el.innerHTML = `
 <div class="tb" style="margin-top:14px">
 <div class="srch"><input id="pro-q" placeholder="Rechercher (nom, ville, tél, email…)" value="${esc(proQuery)}" oninput="onProSearchInput(this)"></div>
 <select id="pro-sort" title="Trier les prospects" onchange="onProSortChange(this.value)" style="max-width:185px;flex:0 0 auto">${sortOpts}</select>
 <button class="btn bp bsm" onclick="openCoForm()">+ Prospect</button>
 <label class="btn bg bsm" style="cursor:pointer">↑ CSV<input type="file" accept=".csv" style="display:none" onchange="importProsCsv(event)"></label>
 <button class="btn bg bsm" onclick="openBonnesBoites()" title="Trouver des entreprises BTP à fort potentiel via France Travail">Trouver via FT</button>
 ${futureCallbacks ? `<span style="font-size:10px;color:var(--ac5);margin-left:4px"> ${futureCallbacks} rappel(s) planifié(s) à venir</span>` : ''}
 </div>
 <table class="tbl" id="pro-table">
 <thead><tr>
 <th style="cursor:pointer" onclick="setProSort('name')" title="Trier par nom">Raison sociale</th>
 <th style="cursor:pointer" onclick="setProSort('phone')" title="Trier par téléphone">Téléphone</th>
 <th style="cursor:pointer" onclick="setProSort('email')" title="Trier par email">Email</th>
 <th style="cursor:pointer" onclick="setProSort('city')" title="Trier par ville">Ville</th>
 <th>Statut</th>
 <th style="cursor:pointer" onclick="toggleMargeSort()">Marge ↕</th>
 <th style="width:32px"></th>
 </tr></thead>
 <tbody id="pro-tbody"></tbody>
 </table>`;

 paintProRows();
}

// Rafraîchit UNIQUEMENT le corps du tableau (pas la barre d'outils) — appelé à
// chaque frappe / changement de tri, ce qui évite de détruire le champ de
// recherche et donc la perte de focus après une lettre.
function paintProRows() {
 const tb = document.getElementById('pro-tbody');
 if (!tb) return;
 const filtered = _sortPros(_proVisible.filter(c => _proMatch(c, proQuery)));
 if (filtered.length) {
 tb.innerHTML = filtered.map(c => proRow(c)).join('');
 } else {
 const msg = proQuery
 ? `Aucun résultat pour « ${esc(proQuery)} »`
 : 'Aucun prospect actif';
 tb.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--mu);padding:24px">${msg}</td></tr>`;
 }
}

// Saisie dans la recherche : on met à jour l'état puis on repeint les lignes.
// On ne retouche jamais l'<input>, donc le focus et le curseur restent intacts.
function onProSearchInput(input) {
 proQuery = input.value || '';
 paintProRows();
}

// Changement de tri via le menu déroulant.
function onProSortChange(val) {
 proSortKey = val || 'smart';
 paintProRows();
}

// Tri via clic sur un en-tête de colonne (raccourci). Re-rend la barre pour
// refléter la valeur sélectionnée dans le menu déroulant.
function setProSort(key) {
 proSortKey = key;
 renderProSub();
}

let _proSelectMode=false;
let _proSelected=new Set();

function proRow(c) {
 const st = { tocall: { l: 'À appeler', p: 'ptoc' }, nrp: { l: 'NRP', p: 'pnrp' }, callback: { l: 'À rappeler', p: 'pdos' } }[c.status] || { l: c.status, p: 'ptoc' };
 const callbackDate = c.status === 'callback' && c.next_call_date ? `<br><span style="font-size:9px;color:var(--ac5)">${fD(c.next_call_date)}</span>` : '';
 const marge = c.marge ? `<span style="color:var(--ac2);font-weight:600">${Number(c.marge).toLocaleString('fr-FR')}€</span>` : '<span style="color:var(--mu2)">—</span>';
 const chk=_proSelectMode?`<td onclick="event.stopPropagation()" style="width:24px;padding-left:8px"><input type="checkbox" ${_proSelected.has(c.id)?'checked':''} onchange="toggleProSelect('${c.id}',this.checked)" style="width:12px;accent-color:var(--ac3)"></td>`:'';
 return `<tr onclick="${_proSelectMode?`toggleProSelect('${c.id}')`:` openProPopup('${c.id}')`}" style="cursor:pointer${_proSelected.has(c.id)?';background:rgba(224,74,74,.04)':''}">
 ${chk}
 <td><strong>${esc(c.name)}</strong></td>
 <td style="font-family:'DM Mono',monospace;font-size:11px">${esc(c.phone || '—')}</td>
 <td style="font-size:10px;color:var(--mu);max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.email || '')}">${esc(c.email || '—')}</td>
 <td>${esc(c.city || '—')}</td>
 <td><span class="pill ${st.p}">${st.l}</span>${callbackDate}</td>
 <td>${marge}</td>
 <td onclick="event.stopPropagation()" style="width:32px;text-align:center">
 <span onclick="delCoConfirm('${c.id}')" style="color:var(--mu2);cursor:pointer;font-size:14px;padding:2px 5px;border-radius:2px;transition:.1s" onmouseover="this.style.color='var(--ac3)'" onmouseout="this.style.color='var(--mu2)'" title="Supprimer">×</span>
 </td>
 </tr>`;
}
function toggleProSelect(id, checked){
 if(checked===undefined)checked=!_proSelected.has(id);
 if(checked)_proSelected.add(id);else _proSelected.delete(id);
 renderProSub();
 const badge=document.getElementById('pro-sel-badge');
 if(badge)badge.textContent=_proSelected.size>0?`${_proSelected.size} sélectionné(s) · `:'';
}
function toggleProSelectMode(){
 _proSelectMode=!_proSelectMode;
 _proSelected.clear();
 renderProSub();
}
function deleteSelectedPros(){
 if(!_proSelected.size)return;
 const n=_proSelected.size;
 openMo(`Supprimer ${n} prospect(s) ?`,
 `<div style="font-size:12px;color:var(--mu)">Cette action est irréversible.</div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bd_" onclick="(()=>{DB.companies=DB.companies.filter(c=>!_proSelected.has(c.id));_proSelected.clear();_proSelectMode=false;save();closeMo();rPros();badges();toast('${n} supprimé(s)','w');})()">Supprimer ${n}</button>`
);
}

// Clic sur l'en-tête « Marge ↕ » : bascule entre tri décroissant et croissant.
// Utilise le système de tri unifié (proSortKey) au lieu de réordonner DB.
function toggleMargeSort() {
 proSortKey = (proSortKey === 'marge_desc') ? 'marge_asc' : 'marge_desc';
 renderProSub();
}

// ── NOBIZ TAB ──────────────────────────────────────────
function renderProNobiz(el) {
 const today = new Date();
 const pros = DB.companies.filter(c => c.type === 'prospect' && c.status === 'nobiz');
 pros.sort((a, b) => {
 // reminders first
 const ar = a.nobiz_remind && new Date(a.nobiz_remind) <= today ? 0 : 1;
 const br = b.nobiz_remind && new Date(b.nobiz_remind) <= today ? 0 : 1;
 return ar - br;
 });

 el.innerHTML = `
 <div style="padding:12px 0 8px;font-size:11px;color:var(--mu);line-height:1.7;border-bottom:1px solid var(--bd);margin-bottom:12px">
 Prospects ayant répondu "pas de besoin". Un rappel automatique est généré <strong>1 mois après l'appel</strong> pour relancer.
 </div>
 <table class="tbl">
 <thead><tr><th>Raison sociale</th><th>Ville</th><th>Appelé le</th><th>Rappel</th><th></th></tr></thead>
 <tbody>
 ${pros.length ? pros.map(c => {
 const isRemind = c.nobiz_remind && new Date(c.nobiz_remind) <= today;
 return `<tr onclick="openProPopup('${c.id}')" style="cursor:pointer;${isRemind ? 'background:rgba(223,152,56,.05)' : ''}">
 <td><strong>${esc(c.name)}</strong>${isRemind ? ' <span style="color:var(--ac4);font-size:10px"> Rappel !</span>' : ''}</td>
 <td>${esc(c.city || '—')}</td>
 <td style="font-size:10px;color:var(--mu)">${fD(c.nobiz_date || c.updated)}</td>
 <td style="font-size:10px;color:${isRemind ? 'var(--ac4)' : 'var(--mu)'}">${c.nobiz_remind ? fD(c.nobiz_remind) : '—'}</td>
 <td><button class="btn bi bxs" onclick="event.stopPropagation();resetPros('${c.id}')">↺ Remettre en liste</button></td>
 </tr>`;
 }).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--mu);padding:24px">Aucun</td></tr>`}
 </tbody>
 </table>`;
}

// ── REFUSED TAB ────────────────────────────────────────
function renderProRefused(el) {
 const pros = DB.companies.filter(c => c.type === 'prospect' && c.status === 'refused');
 el.innerHTML = `
 <div style="padding:12px 0 8px;font-size:11px;color:var(--mu);line-height:1.7;border-bottom:1px solid var(--bd);margin-bottom:12px">
 × Entreprises ne souhaitant pas travailler avec un cabinet. Conservées pour éviter les doubles appels.
 </div>
 <table class="tbl">
 <thead><tr><th>Raison sociale</th><th>Ville</th><th>Téléphone</th><th>Date refus</th><th></th></tr></thead>
 <tbody>
 ${pros.length ? pros.map(c => `<tr>
 <td><strong>${esc(c.name)}</strong></td>
 <td>${esc(c.city || '—')}</td>
 <td>${esc(c.phone || '—')}</td>
 <td style="font-size:10px;color:var(--mu)">${fD(c.updated)}</td>
 <td><button class="btn bi bxs" onclick="resetPros('${c.id}')">↺ Remettre</button></td>
 </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--mu);padding:24px">Aucun refus enregistré</td></tr>`}
 </tbody>
 </table>`;
}

function resetPros(id) {
 const c = coById(id);
 if (!c) return;
 c.status = 'tocall'; c.nobiz_remind = null; c.next_call_date = null; c.updated = now_();
 save(); renderProSub(); toast(`${c.name} remis en liste ✓`, 's');
}

// ═══════════════════════════════════════════════════════
// PROSPECT POPUP — centered modal
// ═══════════════════════════════════════════════════════
function openProPopup(id) {
 proSelectedId = id;
 _proPopupTab='appel'; // always start on Appel tab
 const c = coById(id); if (!c) return;
 renderProPopup(c);
}


// ═══════════════════════════════════════════════════════
// TIMELINE — log toutes les interactions par entreprise
// ═══════════════════════════════════════════════════════
function addTimeline(coId, type, note, extra){
 const c=coById(coId);if(!c)return;
 c.timeline=c.timeline||[];
 const uid_curr=currentUserId();
 const uname_curr=localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||currentUserName();
 c.timeline.unshift({id:uid(),date:now_(),type,note:note||'',extra:extra||null,by:uid_curr,byName:uname_curr,by_slug:userSlug()});
 c.updated=now_();
 save();
}

function renderTimeline(coId){
 const c=coById(coId);if(!c)return'<div class="mu_ fs11">Aucun historique</div>';
 const tl=c.timeline||[];
 if(!tl.length)return`<div style="text-align:center;padding:30px;color:var(--mu2);font-size:11px">
 <div style="font-size:28px;margin-bottom:8px"></div>
 Aucune interaction enregistrée.<br>Chaque appel, note ou email sera affiché ici.
 </div>`;
 const icons={call:'',email:'',note:'',besoin:'',status:'↺',nrp:'',nobiz:'',refused:'×',callback:'',profile_sent:'📤'};
 const colors={call:'var(--ac2)',email:'var(--ac5)',note:'var(--mu)',besoin:'var(--ac)',status:'var(--mu2)',nrp:'var(--ac4)',nobiz:'var(--mu)',refused:'var(--ac3)',callback:'var(--ac5)',profile_sent:'var(--ac4)'};
 return tl.map(e=>`
 <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd)">
 <div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:1px">${icons[e.type]||''}</div>
 <div style="flex:1;min-width:0">
 <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
 <span style="font-size:10px;font-weight:600;color:${colors[e.type]||'var(--mu)'}">${({call:'Appel',email:'Email',note:'Note',besoin:'Besoin créé',status:'Statut',nrp:'NRP',nobiz:'Pas de besoin',refused:'Refus cabinet',callback:'À rappeler',accept_cv:'Accepte CV',ko_email:'Email KO envoyé',profile_sent:'Profil envoyé'})[e.type]||e.type}</span>
 ${e.by?(()=>{const _ac=authorColor(e.by_slug||userSlug(e.byName||e.by));return `<span style="font-size:9px;padding:1px 6px;border-radius:10px;font-weight:700;background:color-mix(in srgb, ${_ac} 16%, transparent);color:${_ac}">${e.byName||e.by}</span>`;})():''}
 <span style="font-size:9px;color:var(--mu2);margin-left:auto">${fD(e.date)} ${e.date?new Date(e.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''}</span>
 </div>
 ${e.note?`<div style="font-size:11px;color:var(--mu);line-height:1.5;white-space:pre-wrap">${esc(e.note)}</div>`:''}
 ${e.extra?`<div style="font-size:10px;color:var(--ac4);margin-top:2px">${esc(e.extra)}</div>`:''}
 </div>
 </div>`).join('');
}

// ═══════════════════════════════════════════════════════
// PROSPECT POPUP — redesign complet avec onglets
// ═══════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════
// PROSPECT POPUP — 3 onglets: Appel | Infos | Besoin
// (Historique retiré pour les prospects non contactés)
// ═══════════════════════════════════════════════════════
let _proPopupTab='appel';

function renderProPopup(c) {
 const cat = getCat(c.cat);
 const lastContact=c.timeline&&c.timeline.length?new Date(c.timeline[0].date):null;
 const daysSince=lastContact?Math.floor((Date.now()-lastContact)/86400000):null;

 const tabBtn=(id,label)=>`<div onclick="setProTab2('${c.id}','${id}')" style="padding:8px 16px;font-size:11px;cursor:pointer;border-bottom:2px solid ${_proPopupTab===id?'var(--ac)':'transparent'};color:${_proPopupTab===id?'var(--ac)':'var(--mu)'};transition:.12s;white-space:nowrap;user-select:none">${label}</div>`;
 const tabs=[tabBtn('appel','Appel'),tabBtn('infos','ℹ️ Infos'),tabBtn('besoin','Besoin')].join('');

 // ── TAB APPEL ────────────────────────────────────────
 const tabAppel=`
 <div style="display:flex;flex-direction:column;gap:6px" id="pro-actions-list">
 <button onclick="proActNRP('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:3px;cursor:pointer;color:var(--tx);font-family:'DM Mono',monospace;font-size:11px;text-align:left;width:100%;transition:.15s" onmouseover="this.style.borderColor='var(--ac4)'" onmouseout="this.style.borderColor='var(--bd)'">
 <span style="font-size:15px"></span>
 <div><div style="font-weight:600">NRP — Pas de réponse</div><div style="font-size:10px;color:var(--mu)">Remis automatiquement demain matin</div></div>
 </button>
 <button onclick="proActCallback('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:3px;cursor:pointer;color:var(--tx);font-family:'DM Mono',monospace;font-size:11px;text-align:left;width:100%;transition:.15s" onmouseover="this.style.borderColor='var(--ac5)'" onmouseout="this.style.borderColor='var(--bd)'">
 <span style="font-size:15px"></span>
 <div><div style="font-weight:600">À rappeler</div><div style="font-size:10px;color:var(--mu)">Planifier une date et heure de rappel</div></div>
 </button>
 <button onclick="proActNobiz('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:3px;cursor:pointer;color:var(--tx);font-family:'DM Mono',monospace;font-size:11px;text-align:left;width:100%;transition:.15s" onmouseover="this.style.borderColor='var(--mu)'" onmouseout="this.style.borderColor='var(--bd)'">
 <span style="font-size:15px"></span>
 <div><div style="font-weight:600">Contacté — Pas de besoin</div><div style="font-size:10px;color:var(--mu)">Rappel automatique dans 2 mois</div></div>
 </button>
 <button onclick="setProTab2('${c.id}','besoin')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:rgba(61,224,154,.07);border:1px solid rgba(61,224,154,.25);border-radius:3px;cursor:pointer;color:var(--tx);font-family:'DM Mono',monospace;font-size:11px;text-align:left;width:100%;transition:.15s" onmouseover="this.style.background='rgba(61,224,154,.14)'" onmouseout="this.style.background='rgba(61,224,154,.07)'">
 <span style="font-size:15px"></span>
 <div><div style="font-weight:600;color:var(--ac2)">Besoin confirmé → Remplir le besoin</div><div style="font-size:10px;color:var(--mu)">Crée le client + besoin automatiquement</div></div>
 </button>
 <button onclick="proActAcceptCV('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:rgba(201,137,26,.07);border:1px solid rgba(201,137,26,.25);border-radius:3px;cursor:pointer;color:var(--tx);font-family:'DM Mono',monospace;font-size:11px;text-align:left;width:100%;transition:.15s" onmouseover="this.style.background='rgba(201,137,26,.14)'" onmouseout="this.style.background='rgba(201,137,26,.07)'">
 <span style="font-size:15px">✉</span>
 <div><div style="font-weight:600;color:var(--ac4)">Accepte de recevoir des CV</div><div style="font-size:10px;color:var(--mu)">Enregistre l'entreprise comme réceptrice de profils</div></div>
 </button>
 <button onclick="proActRefused('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:3px;cursor:pointer;color:var(--tx);font-family:'DM Mono',monospace;font-size:11px;text-align:left;width:100%;transition:.15s" onmouseover="this.style.borderColor='var(--ac3)'" onmouseout="this.style.borderColor='var(--bd)'">
 <span style="font-size:15px">×</span>
 <div><div style="font-weight:600">Ne veut pas de cabinet</div><div style="font-size:10px;color:var(--mu)">Archivé définitivement</div></div>
 </button>
 </div>
 <!-- Zone callback inline -->
 <div id="pro-callback-zone" style="display:none;margin-top:12px;padding:12px;background:rgba(74,130,224,.06);border:1px solid rgba(74,130,224,.2);border-radius:3px">
 <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:10px"> Planifier le rappel</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
 <div><span class="lbl">Date *</span><input type="date" id="pro-cb-date" value="${new Date(Date.now()+86400000).toISOString().split('T')[0]}" min="${new Date().toISOString().split('T')[0]}"></div>
 <div><span class="lbl">Heure (optionnelle)</span><select id="pro-cb-time" style="font-family:'DM Mono',monospace"><option value="">— Pas d'heure —</option>${AG_HALF_HOURS.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
 </div>
 <div style="margin-bottom:8px"><span class="lbl">Note (optionnelle)</span><textarea id="pro-cb-note" style="min-height:50px" placeholder="Ce qu'il a dit, point à retenir…"></textarea></div>
 <div style="display:flex;gap:6px">
 <button class="btn bp" style="flex:1" onclick="confirmCallback('${c.id}')">Confirmer le rappel ✓</button>
 <button class="btn bg bsm" onclick="document.getElementById('pro-callback-zone').style.display='none';document.getElementById('pro-actions-list').style.display='flex'">Annuler</button>
 </div>
 </div>`;

 // ── TAB INFOS ─────────────────────────────────────────
 const contacts=c.contacts||[];
 const tabInfos=`
 <div style="margin-bottom:14px">
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
 <div><span class="lbl">Nom contact</span><input id="pi-contact" value="${esc(c.contact||'')}" placeholder="Jean Dupont"></div>
 <div><span class="lbl">Poste / Titre</span><input id="pi-ctitle" value="${esc(c.ctitle||'')}" placeholder="DRH, Dir. travaux…"></div>
 <div><span class="lbl">Email</span><input id="pi-email" value="${esc(c.email||'')}" placeholder="contact@entreprise.fr"></div>
 <div><span class="lbl">Ville</span><input id="pi-city" value="${esc(c.city||'')}" placeholder="Nice, Monaco…"></div>
 </div>
 <!-- Modifier le téléphone -->
 <div style="margin-bottom:8px">
 <span class="lbl">Téléphone</span>
 <div style="display:flex;gap:6px">
 <input id="pi-phone" value="${esc(c.phone||'')}" placeholder="04 93 00 00 00" style="font-family:'DM Mono',monospace">
 </div>
 </div>
 <div style="margin-bottom:10px"><span class="lbl">Notes</span><textarea id="pi-notes" style="min-height:60px">${esc(c.notes||'')}</textarea></div>
 <button class="btn bp bsm btn-full" onclick="saveProInfos('${c.id}')">Sauvegarder</button>
 </div>
 ${contacts.length?`<div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:6px">Contacts supplémentaires</div>
 ${contacts.map((ct,i)=>`<div style="padding:7px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:3px;margin-bottom:4px;display:flex;align-items:center;gap:8px">
 <div style="flex:1"><div class="fs11" style="font-weight:600">${esc(ct.name)}</div><div class="mu_ fs10">${esc(ct.role||'')}${ct.phone?' · '+fPhone(ct.phone):''}${ct.email?' · '+esc(ct.email):''}</div></div>
 ${ct.phone?`<button class="btn bg bxs" onclick="cpPhone('${esc(ct.phone)}')">⧉</button>`:''}
 <button class="btn bd_ bxs" onclick="removeProContact('${c.id}',${i});openProPopup('${c.id}')">×</button>
 </div>`).join('')}`:''}
 <button class="btn bg bsm" onclick="addProContact('${c.id}')">+ Contact supplémentaire</button>`;

 // ── TAB BESOIN ────────────────────────────────────────
 const catOpts=getBTPCatOpts(c.cat);
 const tabBesoin=`
 <div style="background:rgba(61,224,154,.07);border:1px solid rgba(61,224,154,.2);border-radius:3px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:var(--ac2)">
 Remplissez le besoin — la fiche client sera créée automatiquement.
 </div>
 <!-- Champs obligatoires -->
 <div style="background:rgba(224,152,58,.06);border:1px solid rgba(224,152,58,.2);border-radius:3px;padding:10px 12px;margin-bottom:10px">
 <div style="font-size:10px;font-weight:600;color:var(--ac4);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Infos client — obligatoires pour créer la fiche</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
 <div><span class="lbl">Nom du contact *</span><input id="bb-contact" value="${esc(c.contact||'')}" placeholder="Prénom Nom du décideur"></div>
 <div><span class="lbl">Email *</span><input id="bb-email" value="${esc(c.email||'')}" placeholder="contact@entreprise.fr" oninput="document.getElementById('bb-nomail-wrap').style.display=this.value?'none':'flex'"></div>
 </div>
 <div id="bb-nomail-wrap" style="margin-top:6px;display:${c.email?'none':'flex'};align-items:center;gap:6px">
 <input type="checkbox" id="bb-nomail" style="width:12px;accent-color:var(--ac4)">
 <label for="bb-nomail" style="font-size:10px;color:var(--mu);cursor:pointer">Le contact ne souhaite pas communiquer son email</label>
 </div>
 </div>
 <!-- Besoin -->
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
 <div style="grid-column:1/-1"><span class="lbl">Poste recherché *</span><input id="bb-title" placeholder="Conducteur de travaux GO…" list="bb-jobs"><datalist id="bb-jobs">${BTP_CATS.flatMap(cat=>cat.jobs||[]).map(j=>`<option value="${esc(j)}">`).join('')}</datalist></div>
 <div><span class="lbl">Secteur BTP</span><select id="bb-cat">${catOpts}</select></div>
 <div><span class="lbl">Urgence</span><select id="bb-urg"><option value="h">Urgent</option><option value="m" selected>Moyen terme</option><option value="l">Long terme</option></select></div>
 <div><span class="lbl">Salaire min (€/an)</span><input id="bb-smin" type="number" placeholder="40000"></div>
 <div><span class="lbl">Salaire max (€/an)</span><input id="bb-smax" type="number" placeholder="55000"></div>
 <div style="grid-column:1/-1"><span class="lbl">Localisation</span><input id="bb-loc" value="${esc(c.city||'')}" placeholder="Nice, Monaco, Côte d'Azur…"></div>
 <div style="grid-column:1/-1"><span class="lbl">Notes / Critères</span><textarea id="bb-notes" style="min-height:60px" placeholder="Expérience requise, spécificités du poste…"></textarea></div>
 </div>
 <button class="btn bp btn-full" onclick="saveBesoinInline('${c.id}')">Valider — Créer client + besoin</button>`;

 const tabContent={appel:tabAppel,infos:tabInfos,besoin:tabBesoin}[_proPopupTab]||tabAppel;

 const html=`
 <div id="pro-popup-ov" onclick="closeProPopup(event)" style="position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(5px);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px">
 <div onclick="event.stopPropagation()" style="background:var(--s1);border:1px solid var(--bd2);border-radius:6px;width:100%;max-width:500px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column">
 <!-- Header -->
 <div style="padding:16px 20px 12px;border-bottom:1px solid var(--bd);flex-shrink:0">
 <div style="display:flex;align-items:flex-start;gap:10px">
 <div style="flex:1">
 <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:17px;margin-bottom:3px">${esc(c.name)}</div>
 <div style="font-size:11px;color:var(--mu);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
 ${c.city?`<span>${esc(c.city)}</span>`:''}
 <span class="tag ${cat.cls}">${cat.l}</span>
 ${daysSince!==null?`<span style="font-size:9px;background:var(--s3);padding:1px 6px;border-radius:8px;color:var(--mu2)">Contacté il y a ${daysSince}j</span>`:'<span style="font-size:9px;background:rgba(224,74,74,.1);padding:1px 6px;border-radius:8px;color:var(--ac3)">Jamais contacté</span>'}
 </div>
 </div>
 <div onclick="closeProPopup_direct()" style="cursor:pointer;color:var(--mu);font-size:17px;padding:2px;line-height:1;transition:.12s;flex-shrink:0" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--mu)'">×</div>
 </div>
 <!-- Téléphone -->
 <div style="margin-top:10px;padding:10px 14px;background:rgba(61,224,154,.04);border:1px solid rgba(61,224,154,.15);border-radius:3px;display:flex;align-items:center;gap:10px">
 <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--ac2);letter-spacing:.04em;flex:1">
 ${c.phone?fPhone(c.phone):'<span style="font-size:14px;color:var(--mu)">Non renseigné</span>'}
 </div>
 ${c.phone?`<button class="btn bg bxs" onclick="cpPhone('${esc(c.phone)}')">⧉</button>`:''}
 </div>
 </div>
 <!-- Tabs -->
 <div style="display:flex;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0">${tabs}</div>
 <!-- Content -->
 <div style="flex:1;overflow-y:auto;padding:14px 20px" id="pro-tab-content">${tabContent}</div>
 <!-- Footer -->
 <div style="padding:10px 20px;border-top:1px solid var(--bd);display:flex;gap:6px;flex-shrink:0;background:var(--s2)">
 <button class="btn bg bsm" onclick="closeProPopup_direct();openCoForm('${c.id}')">✎ Modifier fiche</button>
 <button class="btn bd_ bsm" onclick="closeProPopup_direct();delCo('${c.id}')"> Supprimer</button>
 </div>
 </div>
 </div>`;

 const existing=document.getElementById('pro-popup-ov');
 if(existing)existing.remove();
 document.body.insertAdjacentHTML('beforeend',html);
}

function setProTab2(coId,tab){
 _proPopupTab=tab;
 const c=coById(coId);if(!c)return;
 renderProPopup(c);
}

function getBTPCatOpts(selected){
 return BTP_CATS.map(cat=>`<option value="${cat.id}" ${(selected||'go')===cat.id?'selected':''}>${cat.l}</option>`).join('');
}

function closeProPopup(e){
 if(e&&e.target!==document.getElementById('pro-popup-ov'))return;
 closeProPopup_direct();
}
function closeProPopup_direct(){
 document.getElementById('pro-popup-ov')?.remove();
 proSelectedId=null;
 _proPopupTab='appel';
}

// ── Actions individuelles ─────────────────────────────
function proActNRP(coId){
 const c=coById(coId);if(!c)return;
 openMo('',`
 <div class="confirm-dialog">
 <div class="confirm-icon" style="background:var(--orange-dim);border:2px solid var(--orange-border)">
 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
 <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v2.92z"/>
 <line x1="1" y1="1" x2="23" y2="23"/>
 </svg>
 </div>
 <div class="confirm-title">${esc(c.name)}</div>
 <div class="confirm-desc">Pas de réponse lors de cet appel.<br>La fiche sera automatiquement remontée en tête de liste <strong>demain matin</strong>.</div>
 <div class="confirm-actions">
 <button class="btn-apple primary" onclick="(()=>{const c=coById('${coId}');if(c){c.status='nrp';const t=new Date();t.setDate(t.getDate()+1);t.setHours(0,0,0,0);c.next_call_date=t.toISOString();c.updated=now_();addTimeline('${coId}','nrp','Pas de réponse');save();closeProPopup_direct();closeMo();rPros();badges();toast(c.name+' — remis demain matin','w');}})()">
 Pas de réponse — remettre demain
 </button>
 <button class="btn-apple ghost" onclick="closeMo()">Annuler</button>
 </div>
 </div>`,
 ``
);
}

function proActCallback(coId){
 // Show callback zone, hide action list
 const list=document.getElementById('pro-actions-list');
 const zone=document.getElementById('pro-callback-zone');
 if(list)list.style.display='none';
 if(zone)zone.style.display='block';
}

function confirmCallback(coId){
 const c=coById(coId);if(!c)return;
 const dateEl=document.getElementById('pro-cb-date');
 const timeEl=document.getElementById('pro-cb-time');
 const noteEl=document.getElementById('pro-cb-note');
 if(!dateEl?.value){toast('Date requise','e');return;}
 c.status='callback';
 c.next_call_date=dayKey(dateEl.value);
 c.updated=now_();
 const note=noteEl?.value||'';
 const timeLabel=timeEl?.value?` à ${timeEl.value}`:'';
 addTimeline(coId,'callback',note||`Rappel planifié le ${fD(c.next_call_date)}${timeLabel}`,timeEl?.value||null);
 // Toujours ajouter au calendrier (avec ou sans heure) — la note sert de contexte au dashboard
 addAgendaAuto({title:`Rappeler ${c.name}`,type:'call',date:dateEl.value,time:timeEl?.value||null,comp_id:coId,notes:note||'Rappel prospect planifié.',_auto:true});
 save();closeProPopup_direct();rPros();badges();
 toast(` ${c.name} — rappel le ${fD(c.next_call_date)}${timeLabel}`,'s');
}

function proActNobiz(coId){
 const c=coById(coId);if(!c)return;
 openMo('',`
 <div class="confirm-dialog">
 <div class="confirm-icon" style="background:var(--s3);border:2px solid var(--bd2)">
 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mu)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
 <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
 </svg>
 </div>
 <div class="confirm-title">${esc(c.name)}</div>
 <div class="confirm-desc">Aucun besoin de recrutement pour le moment.<br>Un rappel sera planifié automatiquement dans <strong>2 mois</strong>.</div>
 <div class="confirm-actions">
 <button class="btn-apple primary" onclick="(()=>{const c=coById('${coId}');if(c){c.status='nobiz';const r=new Date();r.setMonth(r.getMonth()+2);c.nobiz_remind=r.toISOString();c.nobiz_date=now_();c.updated=now_();addTimeline('${coId}','nobiz','Pas de besoin actuellement','Rappel : '+fD(c.nobiz_remind));save();closeProPopup_direct();closeMo();rPros();badges();toast(c.name+' — rappel dans 2 mois','s');}})()">
 Confirmer — rappel dans 2 mois
 </button>
 <button class="btn-apple ghost" onclick="closeMo()">Annuler</button>
 </div>
 </div>`,
 ``
);
}

function proActAcceptCV(coId){
 const co=coById(coId);if(!co)return;
 // Obtenir les catégories BTP disponibles
 const catOpts=BTP_CATS.map(cat=>`<label style="display:flex;align-items:center;gap:7px;padding:5px 0;font-size:11px;cursor:pointer"><input type="checkbox" value="${cat.id}" style="accent-color:var(--ac4)"> ${cat.l}</label>`).join('');
 openMo('✉ Accepte de recevoir des CV',`
  <div style="margin-bottom:12px;font-size:12px;color:var(--mu);line-height:1.6"><strong>${esc(co.name)}</strong> sera ajouté à votre CVthèque — les profils correspondants pourront lui être envoyés.</div>
  <div style="margin-bottom:12px">
   <div class="lbl" style="margin-bottom:6px">Email de contact *</div>
   <input id="acv-email" value="${esc(co.email||'')}" placeholder="contact@entreprise.fr" style="font-size:12px">
  </div>
  <div>
   <div class="lbl" style="margin-bottom:6px">Types de profils acceptés</div>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;max-height:180px;overflow-y:auto;padding:4px">${catOpts}</div>
  </div>
  <div style="margin-top:12px">
   <div class="lbl" style="margin-bottom:6px">Notes (optionnel)</div>
   <textarea id="acv-note" style="min-height:50px" placeholder="Ce qu'il a dit, préférences particulières…"></textarea>
  </div>`,
  `<button class="btn bg" onclick="closeMo()">Annuler</button>
   <button class="btn bp" onclick="confirmAcceptCV('${coId}')">✉ Enregistrer</button>`
 );
 // Pré-cocher les catégories déjà enregistrées
 setTimeout(()=>{
  const saved=co._accept_cv_cats||[];
  saved.forEach(id=>{const el=document.querySelector('#mo-body input[value="'+id+'"]');if(el)el.checked=true;});
 },50);
}

function confirmAcceptCV(coId){
 const co=coById(coId);if(!co)return;
 const email=document.getElementById('acv-email')?.value.trim()||co.email||'';
 const note=document.getElementById('acv-note')?.value.trim()||'';
 const cats=[...document.querySelectorAll('#mo-body input[type="checkbox"]:checked')].map(el=>el.value);
 if(!email){toast('Email obligatoire','e');return;}
 co.email=email;
 co._accept_cv=true;
 co._accept_cv_cats=cats;
 co._accept_cv_note=note;
 co._accept_cv_date=now_();
 co.status='accept_cv';
 addTimeline(coId,'accept_cv','Accepte de recevoir des CV'+(cats.length?' — '+cats.map(id=>getCat(id).l).join(', '):'')+(note?'\n'+note:''),null);
 save();
 closeProPopup_direct();
 closeMo();
 rPros();
 badges();
 toast('✉ '+co.name+' ajouté à la CVthèque','s');
}

function proActRefused(coId){
 const c=coById(coId);if(!c)return;
 openMo('',`
 <div class="confirm-dialog">
 <div class="confirm-icon" style="background:var(--red-dim);border:2px solid var(--red-border)">
 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
 <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
 </svg>
 </div>
 <div class="confirm-title">${esc(c.name)}</div>
 <div class="confirm-desc">Ce prospect sera archivé définitivement.<br>Visible dans l'onglet <strong>Refus</strong> si vous changez d'avis.</div>
 <div class="confirm-actions">
 <button class="btn-apple danger" onclick="(()=>{const c=coById('${coId}');if(c){c.status='refused';c.updated=now_();addTimeline('${coId}','refused','Refus de travailler avec un cabinet');save();closeProPopup_direct();closeMo();rPros();badges();toast(c.name+' archivé','w');}})()">
 Archiver définitivement
 </button>
 <button class="btn-apple ghost" onclick="closeMo()">Annuler</button>
 </div>
 </div>`,
 ``
);
}

// ── Besoin inline avec champs obligatoires ────────────
function saveBesoinInline(coId){
 const title=document.getElementById('bb-title')?.value.trim();
 const contact=document.getElementById('bb-contact')?.value.trim();
 const email=document.getElementById('bb-email')?.value.trim();
 const nomail=document.getElementById('bb-nomail')?.checked;

 if(!title){toast('Poste recherché requis','e');document.getElementById('bb-title')?.focus();return;}
 if(!contact){toast('Nom du contact requis','e');document.getElementById('bb-contact')?.focus();return;}
 // Email recommandé mais pas bloquant si case cochée ou champ vide (juste un avertissement)
 if(!email&&!nomail&&!contact){
 // si vraiment rien → on continue quand même mais on avertit
 toast(' Pensez à noter le contact et l\'email pour la fiche client','i');
 }

 const c=coById(coId);if(!c)return;
 // Update contact info
 if(contact)c.contact=contact;
 if(email)c.email=email;
 // Convert to client
 c.type='client';c.status='active';c.contract=true;c.contract_date=now_();c.updated=now_();
 const need={
 id:uid(),company_id:coId,title,
 cat:document.getElementById('bb-cat')?.value||'go',
 smin:document.getElementById('bb-smin')?.value||null,
 smax:document.getElementById('bb-smax')?.value||null,
 urgency:document.getElementById('bb-urg')?.value||'m',
 notes:document.getElementById('bb-notes')?.value||'',
 location:document.getElementById('bb-loc')?.value||c.city||'',
 status:'open',created:now_(),updated:now_(),
 };
 DB.needs.unshift(need);
 addTimeline(coId,'besoin',`Besoin créé : ${title}`);
 save();
 closeProPopup_direct();
 toast(`${c.name} → Client · Besoin "${title}" créé`,'s');
 setTimeout(()=>toast('Visible dans l\'onglet "Besoins"','i'),600);
 badges();rPros();
}

// ── Sauvegarder infos contact ─────────────────────────
function saveProInfos(coId){
 const c=coById(coId);if(!c)return;
 const phone=document.getElementById('pi-phone')?.value.trim();
 c.contact=document.getElementById('pi-contact')?.value||c.contact;
 c.ctitle=document.getElementById('pi-ctitle')?.value||c.ctitle;
 c.email=document.getElementById('pi-email')?.value||c.email;
 c.city=document.getElementById('pi-city')?.value||c.city;
 if(phone)c.phone=phone;
 c.notes=document.getElementById('pi-notes')?.value||c.notes;
 c.updated=now_();save();
 // Refresh phone display in popup header
 openProPopup(coId);
 toast('Infos sauvegardées ✓','s');
}

function addProContact(coId){
 openMo('Ajouter un contact',`
 <div class="fg">
 <div class="fgrp"><span class="lbl">Nom *</span><input id="nc-name" placeholder="Jean Dupont"></div>
 <div class="fgrp"><span class="lbl">Rôle</span><input id="nc-role" placeholder="DRH, Responsable RH…"></div>
 <div class="fgrp"><span class="lbl">Téléphone</span><input id="nc-phone" placeholder="06 00 00 00 00"></div>
 <div class="fgrp"><span class="lbl">Email</span><input id="nc-email" placeholder="nom@entreprise.fr"></div>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bp" onclick="saveProContact('${coId}')">Ajouter</button>`
);
}
function saveProContact(coId){
 const name=document.getElementById('nc-name')?.value.trim();
 if(!name){toast('Nom requis','e');return;}
 const c=coById(coId);if(!c)return;
 c.contacts=c.contacts||[];
 c.contacts.push({id:uid(),name,role:document.getElementById('nc-role')?.value||'',phone:document.getElementById('nc-phone')?.value||'',email:document.getElementById('nc-email')?.value||''});
 c.updated=now_();save();closeMo();
 openProPopup(coId);toast('Contact ajouté ✓','s');
}
function removeProContact(coId,idx){
 const c=coById(coId);if(!c||!c.contacts)return;
 c.contacts.splice(idx,1);c.updated=now_();save();
 toast('Contact supprimé','w');
}

function addManualNote(coId){
 openMo('Note',`<textarea id="mn-note" style="min-height:80px" placeholder="Note d'appel, info importante…"></textarea>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bp" onclick="saveManualNote('${coId}')">Enregistrer</button>`
);
}
function saveManualNote(coId){
 const note=document.getElementById('mn-note')?.value.trim();
 if(!note){toast('Note vide','e');return;}
 addTimeline(coId,'note',note);closeMo();
 const c=coById(coId);
 if(c&&document.getElementById('pro-popup-ov')){_proPopupTab='appel';renderProPopup(c);}
 toast('Note enregistrée ✓','s');
}

// ── Compat legacy ─────────────────────────────────────
function toggleCallbackPicker(id){}
function openBesoinForm(coId){setProTab2(coId,'besoin');openProPopup(coId);}
function saveBesoinForm(coId){saveBesoinInline(coId);}
function openNobizEmailForm(id){proActNobiz(id);}
function selectProAction(id,action){
 if(action==='nrp')proActNRP(id);
 else if(action==='callback'){openProPopup(id);setTimeout(()=>proActCallback(id),100);}
 else if(action==='nobiz')proActNobiz(id);
 else if(action==='refused')proActRefused(id);
}
function confirmProAction(){}
function cancelProAction(){}
function proAction(id,action){
 if(action==='need'){setProTab2(id,'besoin');openProPopup(id);return;}
 selectProAction(id,action);
}



function rClients(){
 const q=(document.getElementById('scli')||{}).value?.toLowerCase()||'';
 const clients=DB.companies.filter(c=>{
 if(c.type!=='client')return false;
 const txt=(c.name+' '+(c.contact||'')+' '+(c.city||'')).toLowerCase();
 return !q||txt.includes(q);
 }).sort((a,b)=>{
 // Sort by last contact desc
 const aLast=(a.timeline&&a.timeline[0])?new Date(a.timeline[0].date):new Date(a.created||0);
 const bLast=(b.timeline&&b.timeline[0])?new Date(b.timeline[0].date):new Date(b.created||0);
 return bLast-aLast;
 });

 document.getElementById('view-clients').innerHTML=`
 <div class="tb">
 <div class="srch"><input id="scli" placeholder="Rechercher client…" oninput="rClients()"></div>
 <span class="fs10 mu_">${clients.length} client(s)</span>
 </div>
 ${clients.length?`<div class="g3">${clients.map(c=>{
 const cat=getCat(c.cat);
 const needs=DB.needs.filter(n=>n.company_id===c.id);
 const placed=DB.candidates.filter(x=>x.linked_need&&needs.find(n=>n.id===x.linked_need)&&x.status==='placed').length;
 const openNeeds=needs.filter(n=>n.status==='open').length;
 const lastTl=c.timeline&&c.timeline[0]?c.timeline[0]:null;
 const daysSince=lastTl?Math.floor((Date.now()-new Date(lastTl.date))/86400000):null;
 const contacts=(c.contacts||[]);
 return`<div class="prcard" onclick="openCoPanel('${c.id}')" style="position:relative">
 <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
 <div class="prcard-n">${esc(c.name)}</div>
 ${placed?`<span class="pill pwin fs10">✓ ${placed} placé(s)</span>`:''}
 </div>
 <div class="prcard-m">
 ${esc(c.contact||'—')}${c.ctitle?` · <span style="color:var(--mu2)">${esc(c.ctitle)}</span>`:''}
 ${contacts.length?`<span style="font-size:9px;color:var(--mu2);margin-left:4px">+${contacts.length}</span>`:''}
 <br>${esc(c.city||'—')} · <span class="tag ${cat.cls}">${cat.l}</span>
 </div>
 <div class="flex fac fg5 mt8 fw" style="flex-wrap:wrap">
 ${openNeeds?`<span style="font-size:10px;padding:1px 6px;background:rgba(74,130,224,.1);color:var(--ac5);border-radius:8px">${openNeeds} besoin(s)</span>`:''}
 ${daysSince!==null?`<span class="fs10 mu_" style="margin-left:auto">Contacté il y a ${daysSince}j</span>`:'<span class="fs10 mu_" style="margin-left:auto;color:var(--ac4)">Jamais contacté</span>'}
 </div>
 </div>`;
 }).join('')}</div>`:'<div class="empty">Aucun client. Convertissez un prospect ayant un besoin.</div>'}`;
}



// ═══════════════════════════════════════════════════════
// AGENDA — refonte complète
// ═══════════════════════════════════════════════════════

const AG_HOURS=['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
const AG_HALF_HOURS=['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00'];


// ═══════════════════════════════════════════════════════
// AGENDA — complet, timezone-safe, UX moderne
// ═══════════════════════════════════════════════════════

// Helper timezone-safe: toujours date locale, jamais UTC
const localDateStr=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayLocal=()=>localDateStr(new Date());

// ═══════════════════════════════════════════════════════
// MOTEUR AGENDA — création centralisée & automatisations
// Tout passage par addAgendaAuto garantit :
//  · une date NORMALISÉE en jour local (dayKey) → plus jamais de décalage
//  · des champs cohérents (id, created, updated, done…)
//  · la possibilité de lier un candidat / une entreprise
// ═══════════════════════════════════════════════════════
function addAgendaAuto(o){
 o=o||{};
 const item={
  id:uid(),
  type:o.type||'task',
  title:o.title||'(sans titre)',
  date:dayKey(o.date||todayKey()),      // ← TOUJOURS jour local YYYY-MM-DD
  time:o.time||null,
  cand_id:o.cand_id||null,
  comp_id:o.comp_id||null,
  notes:o.notes||'',
  done:!!o.done,
  created:now_(),
  updated:now_()
 };
 // Flags d'automatisation conservés tels quels
 ['_profile_followup','_contract_followup','_contract_log','_auto','_source','_origin'].forEach(k=>{if(o[k]!==undefined)item[k]=o[k];});
 if(o.done) item.done_at=now_();
 DB.agenda.unshift(item);
 return item;
}

// Événements liés à une entité (entreprise OU candidat), triés chronologiquement
function agendaForEntity(kind,id,opts){
 opts=opts||{};
 const key=kind==='co'?'comp_id':'cand_id';
 let list=DB.agenda.filter(a=>a[key]===id);
 if(!opts.includeDone) list=list; // on garde tout, le tri sépare
 return list.sort((a,b)=>{
  const ka=a.date||'',kb=b.date||'';
  if(ka!==kb) return ka<kb?-1:1;
  return (a.time||'')<(b.time||'')?-1:1;
 });
}

// Contexte complet d'un événement (entité liée + coordonnées) pour l'affichage
function agendaContext(a){
 if(!a) return {};
 const ca=a.cand_id?cById(a.cand_id):null;
 const co=a.comp_id?coById(a.comp_id):null;
 return {ca,co,
  phone:(co&&co.phone)||(ca&&ca.phone)||'',
  email:(co&&co.email)||(ca&&ca.email)||'',
  city:(co&&co.city)||(ca&&(ca.mobility||ca.localisation))||''
 };
}

// État d'un événement par rapport à maintenant : 'overdue' | 'today' | 'soon' | 'upcoming' | 'done'
function agendaState(a){
 if(!a) return 'upcoming';
 if(a.done) return 'done';
 const k=dayKey(a.date);
 const tk=todayKey();
 if(k<tk) return 'overdue';
 if(k===tk) return 'today';
 if(k===shiftDayKey(tk,1)) return 'soon';
 return 'upcoming';
}


const FR_DAYS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const FR_DAYS_SHORT=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const FR_MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const FR_MONTHS_SHORT=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

// Formater une date lisiblement
// ═══════════════════════════════════════════════════════
// IA AIDE PROFIL — Entreprises cibles + mots-clés
// ═══════════════════════════════════════════════════════
async function aiProfileAdvice(candId) {
 const cand = cById(candId); if(!cand) return;
 const key = getApiKey();
 if(!key){ toast('Clé API manquante — Paramètres','e'); return; }

 // Construire le contexte profil
 const profil = [
  cand.role ? 'Poste : '+cand.role : '',
  cand.salary ? 'Salaire : '+cand.salary+'€' : '',
  cand.avail ? 'Disponibilité : '+cand.avail : '',
  cand.mobility ? 'Mobilité : '+cand.mobility : '',
  cand.notes_pre ? 'Notes précal : '+cand.notes_pre : '',
  cand.notes ? 'Notes : '+cand.notes : '',
  cand.cat ? 'Spécialité : '+getCat(cand.cat).l : '',
 ].filter(Boolean).join('\n');

 // Ouvrir modal de chargement
 openMo('🤖 Analyse IA — '+esc(cand.name),
  `<div style="display:flex;align-items:center;gap:12px;padding:20px;color:var(--mu)">
   <div style="width:20px;height:20px;border:2px solid var(--bd2);border-top-color:var(--purple);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>
   <span style="font-size:12px">Analyse du profil en cours…</span>
  </div>`, '');

 try {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
   method:'POST',
   headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
   body: JSON.stringify({
    model:'claude-sonnet-4-20250514',
    max_tokens:1000,
    system:`Tu es un expert en recrutement BTP. Analyse ce profil candidat et retourne UNIQUEMENT un JSON valide sans markdown ni backtick avec cette structure exacte:
{
 "types_entreprises": ["type1","type2","type3","type4","type5"],
 "postes_compatibles": ["poste1","poste2","poste3"],
 "mots_cles": ["mot1","mot2","mot3","mot4","mot5","mot6"],
 "points_forts": ["point court 1","point court 2","point court 3"],
 "accroche": "Une phrase d'accroche de 1-2 lignes pour présenter ce profil à un client"
}`,
    messages:[{role:'user',content:'Profil candidat BTP :\n'+profil}]
   })
  });
  const data = await resp.json();
  const txt = data.content?.find(b=>b.type==='text')?.text || data.content?.[0]?.text || '';
  let parsed = null;
  try { parsed = JSON.parse(txt.replace(/```json|```/g,'').trim()); }
  catch(e) {
   const m = txt.match(/\{[\s\S]*\}/);
   if(m) try { parsed = JSON.parse(m[0]); } catch(e2){}
  }

  if(!parsed){ closeMo(); toast('Erreur analyse IA','e'); return; }

  // Afficher le résultat
  const html = `
   <div style="margin-bottom:14px">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:8px">💬 Accroche commerciale</div>
    <div style="background:rgba(154,74,224,.08);border:1px solid rgba(154,74,224,.2);border-radius:var(--r2);padding:12px 14px;font-size:12px;line-height:1.6;color:var(--tx);font-style:italic">"${esc(parsed.accroche||'')}"</div>
   </div>
   <div style="margin-bottom:14px">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:8px">🏢 Types d'entreprises cibles</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${(parsed.types_entreprises||[]).map(t=>`<span style="padding:4px 10px;background:var(--s3);border:1px solid var(--bd);border-radius:20px;font-size:11px">${esc(t)}</span>`).join('')}</div>
   </div>
   <div style="margin-bottom:14px">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:8px">💼 Postes compatibles</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${(parsed.postes_compatibles||[]).map(t=>`<span style="padding:4px 10px;background:rgba(61,224,154,.08);border:1px solid rgba(61,224,154,.2);border-radius:20px;font-size:11px;color:var(--ac2)">${esc(t)}</span>`).join('')}</div>
   </div>
   <div style="margin-bottom:14px">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:8px">🔑 Mots-clés à utiliser</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${(parsed.mots_cles||[]).map(t=>`<span style="padding:4px 10px;background:rgba(201,137,26,.1);border:1px solid rgba(201,137,26,.25);border-radius:20px;font-size:11px;color:var(--ac4)">${esc(t)}</span>`).join('')}</div>
   </div>
   <div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:8px">⭐ Points forts à mettre en avant</div>
    <div style="display:flex;flex-direction:column;gap:5px">${(parsed.points_forts||[]).map(t=>`<div style="display:flex;gap:8px;align-items:flex-start;font-size:11px"><span style="color:var(--ac4);flex-shrink:0">›</span>${esc(t)}</div>`).join('')}</div>
   </div>`;

  // Remplacer le contenu de la modal
  const mbody = document.getElementById('mo-body');
  if(mbody) mbody.innerHTML = html;
  const mfoot = document.getElementById('mo-foot');
  if(mfoot) mfoot.innerHTML = `<button class="btn bg" onclick="closeMo()">Fermer</button>`;

 } catch(e) {
  closeMo();
  toast('Erreur IA : '+e.message,'e');
 }
}


// ═══════════════════════════════════════════════════════
// CVTHÈQUE — Entreprises qui acceptent de recevoir des CV
// ═══════════════════════════════════════════════════════
function rCVtheque(){
 const cos = DB.companies.filter(co=>co._accept_cv);
 const el = document.getElementById('view-cvtheque');
 if(!el) return;

 // Filtre par catégorie
 const filterCat = document._cvthFilter || '';

 // Filtrer
 let list = cos;
 if(filterCat) list = list.filter(co=>(co._accept_cv_cats||[]).includes(filterCat));

 // Stats
 const total = cos.length;
 const thisWeek = cos.filter(co=>{
  const sent = co._last_cv_sent_at;
  if(!sent) return false;
  return (Date.now()-new Date(sent)) < 7*86400*1000;
 }).length;

 el.innerHTML = `
 <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
  <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px;flex:1">✉ CVthèque</div>
  <div style="font-size:11px;color:var(--mu)">${total} entreprise(s) · ${thisWeek} envoi(s) cette semaine</div>
 </div>

 <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
  <button class="btn bxs ${!filterCat?'bp':'bg'}" onclick="document._cvthFilter='';rCVtheque()">Tous (${total})</button>
  ${BTP_CATS.map(cat=>{
   const n=cos.filter(co=>(co._accept_cv_cats||[]).includes(cat.id)).length;
   if(!n)return'';
   return`<button class="btn bxs ${filterCat===cat.id?'bp':'bg'}" onclick="document._cvthFilter='${cat.id}';rCVtheque()">${cat.l} (${n})</button>`;
  }).join('')}
 </div>

 ${list.length ? `
 <div style="display:grid;gap:8px">
 ${list.map(co=>{
  const cat = getCat(co.cat);
  const cats = (co._accept_cv_cats||[]).map(id=>getCat(id).l);
  const lastSent = co._last_cv_sent_at;
  const daysSince = lastSent ? Math.floor((Date.now()-new Date(lastSent))/86400000) : null;
  const sentThisWeek = lastSent && (Date.now()-new Date(lastSent))<7*86400*1000;
  const cvSentCount = co._cv_sent_count||0;
  return`<div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r2);padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openCoPanel('${co.id}')">
   <div style="flex:1;min-width:0">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
     <span style="font-weight:700;font-size:13px">${esc(co.name)}</span>
     <span class="tag ${cat.cls}" style="font-size:9px">${cat.l}</span>
     ${sentThisWeek?`<span style="font-size:9px;padding:2px 7px;background:rgba(240,75,75,.1);color:var(--ac3);border-radius:10px;font-weight:700">⚠ Envoi récent</span>`:''}
    </div>
    <div style="font-size:11px;color:var(--mu);margin-bottom:3px">
     ${esc(co.contact||'—')}${co.city?' · '+esc(co.city):''} · ${esc(co.email||'—')}
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap">
     ${cats.length?cats.map(l=>`<span style="font-size:9px;padding:1px 6px;background:rgba(201,137,26,.1);color:var(--ac4);border-radius:8px">${l}</span>`).join(''):'<span style="font-size:10px;color:var(--mu2)">Tous profils</span>'}
    </div>
    ${co._accept_cv_note?`<div style="font-size:10px;color:var(--mu);margin-top:4px;font-style:italic">${esc(co._accept_cv_note)}</div>`:''}
   </div>
   <div style="text-align:right;flex-shrink:0">
    <div style="font-size:11px;color:var(--mu2)">${cvSentCount} CV envoyé(s)</div>
    ${lastSent?`<div style="font-size:10px;color:${sentThisWeek?'var(--ac3)':'var(--mu2)'}">Dernier : il y a ${daysSince}j</div>`:`<div style="font-size:10px;color:var(--ac2)">Jamais envoyé</div>`}
   </div>
  </div>`;
 }).join('')}
 </div>` : `<div style="text-align:center;padding:50px 20px;color:var(--mu2)">
  <div style="font-size:36px;margin-bottom:12px">✉</div>
  <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--tx)">Aucune entreprise dans la CVthèque</div>
  <div style="font-size:11px">Lors d'un appel prospect, cliquez "Accepte de recevoir des CV" pour les ajouter ici.</div>
 </div>`}`;
}


function fmtDateHuman(dateStr){
 if(!dateStr)return'—';
 const d=new Date(dateStr+'T12:00:00'); // midi = sans risque TZ
 const today=todayLocal();
 const tomorrow=localDateStr(new Date(Date.now()+86400000));
 if(dateStr===today)return"Aujourd'hui";
 if(dateStr===tomorrow)return'Demain';
 const diff=Math.round((new Date(dateStr+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);
 if(diff===-1)return'Hier';
 if(diff>0&&diff<7)return`${FR_DAYS[d.getDay()]} ${d.getDate()} ${FR_MONTHS_SHORT[d.getMonth()]}`;
 return`${FR_DAYS_SHORT[d.getDay()]} ${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const AG_HOURS_FULL=['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00'];

function rAgenda(){
 if(!UI.agView)UI.agView='week';
 if(!UI.agDate)UI.agDate=todayLocal();
 const vt=UI.agView;
 const showDone=(document.getElementById('ag-show-done')||{}).checked||false;
 const d=new Date(UI.agDate+'T12:00:00');
 const today=todayLocal();

 let label='';
 if(vt==='day'){
 label=fmtDateHuman(UI.agDate);
 } else if(vt==='week'){
 const mon=getMonday(d);const sun=new Date(mon);sun.setDate(sun.getDate()+6);
 label=`${mon.getDate()} ${FR_MONTHS_SHORT[mon.getMonth()]} — ${sun.getDate()} ${FR_MONTHS_SHORT[sun.getMonth()]} ${sun.getFullYear()}`;
 } else {
 label=`${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
 }

 document.getElementById('view-agenda').innerHTML=`
 <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
 <div style="display:flex;background:var(--s2);border:1px solid var(--bd);border-radius:3px;padding:3px;gap:2px">
 ${['day','week','month'].map(v=>`<div onclick="setAgView('${v}')" style="padding:5px 14px;border-radius:2px;font-size:11px;cursor:pointer;user-select:none;transition:.12s;${vt===v?'background:var(--s1);color:var(--tx);box-shadow:0 1px 3px rgba(0,0,0,.3)':'color:var(--mu)'}">${{day:'Jour',week:'Semaine',month:'Mois'}[v]}</div>`).join('')}
 </div>
 <div style="display:flex;align-items:center;gap:6px">
 <div onclick="agNav(-1)" style="cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid var(--bd2);border-radius:3px;font-size:14px;color:var(--mu);background:var(--s2);transition:.1s" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='var(--s2)'">‹</div>
 <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:12px;min-width:200px;text-align:center">${label}</div>
 <div onclick="agNav(1)" style="cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid var(--bd2);border-radius:3px;font-size:14px;color:var(--mu);background:var(--s2);transition:.1s" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='var(--s2)'">›</div>
 ${UI.agDate!==today?`<button class="btn bg bxs" onclick="agGoToday()" style="font-size:10px">Aujourd'hui</button>`:''}
 </div>
 <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mu);cursor:pointer;margin-left:auto">
 <input type="checkbox" id="ag-show-done" onchange="rAgenda()" style="width:11px;accent-color:var(--ac)"> Terminés
 </label>
 </div>
 <div id="ag-body"></div>`;

 const body=document.getElementById('ag-body');
 if(vt==='day') renderAgDay(body,UI.agDate,showDone);
 else if(vt==='week') renderAgWeek(body,UI.agDate,showDone);
 else renderAgMonth(body,UI.agDate,showDone);
}

function setAgView(v){UI.agView=v;rAgenda();}
function agNav(dir){
 const d=new Date(UI.agDate+'T12:00:00');
 if(UI.agView==='day') d.setDate(d.getDate()+dir);
 else if(UI.agView==='week') d.setDate(d.getDate()+(7*dir));
 else d.setMonth(d.getMonth()+dir);
 UI.agDate=localDateStr(d);rAgenda();
}
function agGoToday(){UI.agDate=todayLocal();rAgenda();}
function getMonday(d){
 const day=d.getDay(),diff=d.getDate()-(day===0?6:day-1);
 const m=new Date(d);m.setDate(diff);return m;
}

// ── DAY VIEW ──────────────────────────────────────────
function renderAgDay(el,dateStr,showDone){
 const HOURS=['07','08','09','10','11','12','13','14','15','16','17','18','19','20'];
 const today=todayLocal();
 const isToday=dateStr===today;
 const nowH=new Date().getHours();

 const items=DB.agenda.filter(a=>{
 if(!showDone&&a.done)return false;
 if(!a.date)return false;
 return (a.date||'').slice(0,10)===dateStr;
 });
 const noTime=items.filter(a=>!a.time);
 const withTime=items.filter(a=>a.time);

 let html='';
 if(noTime.length){
 html+=`<div style="margin-bottom:10px;display:flex;gap:5px;flex-wrap:wrap">${noTime.map(a=>{const t=AG_TYPES.find(t=>t.id===a.type)||AG_TYPES[2];return agDayEvt(a,t);}).join('')}</div>`;
 }

 html+=`<div class="day-grid" style="height:calc(100vh - 200px);overflow-y:auto">`;
 HOURS.forEach(h=>{
 const hNum=parseInt(h);
 const isNow=isToday&&hNum===nowH;
 const evts=withTime.filter(a=>a.time&&parseInt(a.time)===hNum);
 html+=`
 <div class="day-time" style="${isNow?'color:var(--ac5);font-weight:700':''};position:relative">
 ${h}:00
 ${isNow?`<div style="position:absolute;right:0;top:50%;width:6px;height:6px;background:var(--ac5);border-radius:50%;transform:translateY(-50%)"></div>`:''}
 </div>
 <div class="day-col ${isNow?'now-hour':''}" 
 onclick="openAgForm(null,null,null,'${dateStr}','${h}:00')" 
 style="cursor:pointer;min-height:44px;transition:.1s" 
 onmouseover="if(!event.target.closest('.day-evt'))this.style.background='rgba(207,224,70,.04)'" 
 onmouseout="this.style.background=''">
 ${evts.map(a=>agDayEvt(a,AG_TYPES.find(t=>t.id===a.type)||AG_TYPES[2])).join('')}
 </div>`;
 });
 html+=`</div>`;

 if(!items.length){
 el.innerHTML=`<div class="day-empty" style="padding:50px 20px;text-align:center;color:var(--mu2)">
 <div style="font-size:36px;margin-bottom:12px"></div>
 <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;margin-bottom:6px">Aucun événement — ${fmtDateHuman(dateStr)}</div>
 <div style="font-size:11px;margin-bottom:14px">Cliquez sur une plage horaire pour ajouter un événement</div>
 <button class="btn bp bsm" onclick="openAgForm(null,null,null,'${dateStr}')">+ Ajouter un événement</button>
 </div>`;
 return;
 }
 el.innerHTML=html;
}

function agDayEvt(a,t){
 const ca=a.cand_id?cById(a.cand_id):null;
 return`<div class="day-evt ${a.type} ${a.done?'done':''}" onclick="event.stopPropagation();openAgPanel('${a.id}')" style="transition:.15s">
 <span>${t.ico}</span>
 <div style="flex:1;min-width:0">
 <div class="day-evt-t">${esc(a.title)}</div>
 ${ca?`<div style="font-size:9px;color:var(--mu)">${esc(ca.name)}</div>`:''}
 </div>
 ${a.time?`<div class="day-evt-time">${a.time}</div>`:''}
 <div class="ai-chk ${a.done?'done':''}" 
 onclick="event.stopPropagation();animToggleDone('${a.id}',this)" 
 title="${a.done?'Remettre en attente':'Marquer terminé'}"
 style="transition:.2s;flex-shrink:0;margin-top:0">
 ${a.done?'✓':''}
 </div>
 </div>`;
}

// ── WEEK VIEW ─────────────────────────────────────────
function renderAgWeek(el,dateStr,showDone){
 const HOURS=['07','08','09','10','11','12','13','14','15','16','17','18','19','20'];
 const mon=getMonday(new Date(dateStr+'T12:00:00'));
 const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(d.getDate()+i);return d;});
 const today=todayLocal();
 const nowH=new Date().getHours();
 const DAYNAMES=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

 // All-day (calculé en amont pour dimensionner la grille proprement)
 const allDay=DB.agenda.filter(a=>{
 if(!showDone&&a.done)return false;
 return a.date&&!a.time&&days.some(d=>localDateStr(d)===a.date);
 });
 // Les 14 lignes d'heures se partagent la hauteur dispo → tout tient sans scroll
 const rowTpl='auto repeat('+HOURS.length+',minmax(0,1fr))'+(allDay.length?' auto':'');

 let html=`<div style="overflow-x:auto;overflow-y:hidden;height:calc(100vh - 150px)">
 <div class="wk-grid" style="grid-template-columns:44px repeat(7,1fr);grid-template-rows:${rowTpl};min-width:600px;height:100%">`;

 // Header
 html+=`<div class="wk-hd" style="background:var(--s1);border-right:1px solid var(--bd)"></div>`;
 days.forEach((d,i)=>{
 const ds=localDateStr(d); // ← TIMEZONE FIX
 const isToday=ds===today;
 html+=`<div class="wk-hd ${isToday?'today-col':''}" onclick="UI.agDate='${ds}';setAgView('day')" style="cursor:pointer;padding:7px 2px;text-align:center">
 <div style="font-size:10px;color:${isToday?'var(--ac5)':'var(--mu)'}">${DAYNAMES[i]}</div>
 <div style="width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:${isToday?'14':'13'}px;font-weight:800;${isToday?'background:var(--ac5);color:#000':'color:inherit'}">${d.getDate()}</div>
 </div>`;
 });

 // Hours
 HOURS.forEach(h=>{
 const hNum=parseInt(h);
 html+=`<div class="wk-time" style="border-top:1px solid var(--bd);padding-top:4px;font-size:9px">${h}</div>`;
 days.forEach((d,di)=>{
 const ds=localDateStr(d); // ← TIMEZONE FIX
 const isToday=ds===today;
 const isNow=isToday&&hNum===nowH;
 const evts=DB.agenda.filter(a=>{
 if(!showDone&&a.done)return false;
 if(!a.date||!a.time)return false;
 return (a.date||'').slice(0,10)===ds&&(a.time||'').startsWith(h);
 });
 html+=`<div class="wk-cell ${isToday?'today-col':''} ${isNow?'now-hour':''}" 
 onclick="openAgForm(null,null,null,'${ds}','${h}:00')" 
 style="cursor:pointer;min-height:0;overflow:hidden" 
 title="${h}h — ${DAYNAMES[di]} ${d.getDate()}">
 ${evts.map(a=>`<div class="wk-evt ${a.type} ${a.done?'done':''}" 
 onclick="event.stopPropagation();openAgPanel('${a.id}')" 
 title="${esc(a.title)}">${AG_TYPES.find(t=>t.id===a.type)?.ico||''} ${esc(a.title.length>16?a.title.slice(0,14)+'…':a.title)}</div>`).join('')}
 </div>`;
 });
 });

 // All-day (déjà calculé en amont pour la grille)
 if(allDay.length){
 html+=`<div class="wk-time" style="font-size:9px;color:var(--ac4);border-top:1px solid var(--bd)">All-day</div>`;
 days.forEach(d=>{
 const ds=localDateStr(d);
 const evts=allDay.filter(a=>(a.date||'').slice(0,10)===ds);
 html+=`<div class="wk-cell" onclick="openAgForm(null,null,null,'${ds}')" style="cursor:pointer">
 ${evts.map(a=>`<div class="wk-evt ${a.type}" onclick="event.stopPropagation();openAgPanel('${a.id}')">${esc(a.title)}</div>`).join('')}
 </div>`;
 });
 }
 html+=`</div></div>`;
 el.innerHTML=html;
}

// ── MONTH VIEW ────────────────────────────────────────
function renderAgMonth(el,dateStr,showDone){
 const d=new Date(dateStr+'T12:00:00');
 const y=d.getFullYear(),m=d.getMonth();
 const first=new Date(y,m,1);const last=new Date(y,m+1,0);
 let startDow=first.getDay();if(startDow===0)startDow=7;startDow--;
 const today=todayLocal();
 const DAYNAMES=['L','M','M','J','V','S','D'];
 const EVT_COLORS={call:'var(--ac4)',visio:'var(--ac5)',task:'var(--ac2)',relance:'var(--ac6)',contract:'var(--gold)',meeting:'var(--ac2)'};

 let html=`<div class="mo-grid">`;
 DAYNAMES.forEach(dn=>html+=`<div class="mo-dh">${dn}</div>`);
 for(let i=0;i<startDow;i++){
 const pd=new Date(y,m,1-(startDow-i));
 html+=`<div class="mo-day other-month"><div class="mo-dn"><span class="dn-num">${pd.getDate()}</span></div></div>`;
 }
 for(let day=1;day<=last.getDate();day++){
 const cur=new Date(y,m,day);
 const curStr=localDateStr(cur); // ← TIMEZONE FIX
 const isToday=curStr===today;
 const isPast=cur<new Date(today+'T12:00:00');
 const evts=DB.agenda.filter(a=>{
 if(!showDone&&a.done)return false;
 return (a.date||'').slice(0,10)===curStr;
 }).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
 const maxShow=3;
 html+=`<div class="mo-day ${isToday?'today':''} ${isPast&&!isToday?'past':''}" 
 onclick="UI.agDate='${curStr}';setAgView('day')" style="cursor:pointer">
 <div class="mo-dn">
 <span class="dn-num">${day}</span>
 ${evts.length?`<span style="font-size:8px;color:var(--mu2);margin-left:3px">${evts.length}</span>`:''}
 </div>
 ${evts.slice(0,maxShow).map(a=>{const t=AG_TYPES.find(t=>t.id===a.type)||AG_TYPES[2];return`<div class="mo-evt" style="background:var(--s3);color:${EVT_COLORS[a.type]||'var(--mu)'};${a.done?'opacity:.4;text-decoration:line-through':''}" onclick="event.stopPropagation();openAgPanel('${a.id}')">${t.ico} ${esc(a.title)}</div>`;}).join('')}
 ${evts.length>maxShow?`<div class="mo-more">+${evts.length-maxShow}</div>`:''}
 </div>`;
 }
 const endDow=last.getDay()===0?7:last.getDay();
 for(let i=1;i<=7-endDow;i++){
 html+=`<div class="mo-day other-month"><div class="mo-dn"><span class="dn-num">${i}</span></div></div>`;
 }
 html+=`</div>`;
 el.innerHTML=html;
}

// ── ITEM HTML (compat) ────────────────────────────────
function agItemHtml(a,mode){
 const t=AG_TYPES.find(t=>t.id===a.type)||AG_TYPES[2];
 const ca=a.cand_id?cById(a.cand_id):null;const co=a.comp_id?coById(a.comp_id):null;
 const sub=[ca?ca.name:'',co?co.name:''].filter(Boolean).join(' · ');
 return`<div class="ai ${a.done?'done':''}" onclick="openAgPanel('${a.id}')">
 <span style="font-size:12px;flex-shrink:0;margin-top:1px">${t.ico}</span>
 <div class="ai-chk ${a.done?'done':''}" onclick="event.stopPropagation();animToggleDone('${a.id}',this)">${a.done?'✓':''}</div>
 <div class="ai-body"><div class="ai-t">${esc(a.title)}</div>${sub?`<div class="ai-sub">${esc(sub)}</div>`:''}</div>
 <div class="ai-time">${a.time||''}</div>
 </div>`;
}

// Terminé avec animation
function animToggleDone(id, btn){
 const a=agById(id);if(!a)return;
 if(btn){
 btn.style.transform='scale(1.4)';
 btn.style.background=a.done?'var(--bd2)':'var(--ac2)';
 setTimeout(()=>{btn.style.transform='scale(1)';},200);
 }
 a.done=!a.done;save();
 setTimeout(()=>{rAgenda();badges();},220);
 toast(a.done?'Terminé':'Remis en attente','s');
}
function togAgDone(id){animToggleDone(id,null);}

// ═══════════════════════════════════════════════════════
// FORM ÉVÉNEMENT — UX moderne
// date: navigation ←→ + raccourcis | heure: select large
// ═══════════════════════════════════════════════════════

let _agFormDate=''; // date courante dans le form

function openAgForm(id=null,candId=null,coId=null,preDate=null,preTime=null){
 const a=id?agById(id):{};if(!a)return;
 const today=todayLocal();
 _agFormDate=a.date||(preDate||today);

 const typeOpts=AG_TYPES.map(t=>`<option value="${t.id}" ${(a.type||'task')===t.id?'selected':''}>${t.ico} ${t.l}</option>`).join('');
 const candOpts=`<option value="">— Aucun —</option>`+DB.candidates.map(c=>`<option value="${c.id}" ${(a.cand_id||candId)===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
 const coOpts=`<option value="">— Aucun —</option>`+DB.companies.map(c=>`<option value="${c.id}" ${(a.comp_id||coId)===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
 const initTime=a.time||(preTime||'');
 const timeOpts=`<option value="">— Pas d'heure —</option>`+AG_HOURS_FULL.map(t=>`<option value="${t}" ${initTime===t?'selected':''}>${t}</option>`).join('');

 openMo(id?'Modifier événement':'Nouvel événement',`
 <!-- Titre + type -->
 <div class="fgrp" style="margin-bottom:10px">
 <span class="lbl">Titre *</span>
 <input id="af-t" value="${esc(a.title||'')}" placeholder="Précal Thomas · Relance SARL Martin · Entretien visio…" autofocus style="font-size:13px;padding:9px 10px">
 </div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
 <div class="fgrp" style="margin:0"><span class="lbl">Type</span><select id="af-type">${typeOpts}</select></div>
 <div class="fgrp" style="margin:0"><span class="lbl">Statut</span><select id="af-done"><option value="0" ${!a.done?'selected':''}>En cours</option><option value="1" ${a.done?'selected':''}>Terminé</option></select></div>
 </div>

 <!-- Date — navigation intuitive -->
 <div style="margin-bottom:12px">
 <span class="lbl"> Date</span>
 <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
 <button type="button" onclick="agFormDateNav(-1)" style="width:30px;height:36px;background:var(--s3);border:1px solid var(--bd2);border-radius:3px;cursor:pointer;color:var(--mu);font-size:14px;display:flex;align-items:center;justify-content:center;transition:.1s" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--mu)'">‹</button>
 <div id="af-date-display" style="flex:1;text-align:center;font-family:'Syne',sans-serif;font-weight:700;font-size:13px;padding:8px 12px;background:var(--s3);border:1px solid var(--bd2);border-radius:3px;cursor:default">${fmtDateHuman(_agFormDate)}</div>
 <button type="button" onclick="agFormDateNav(1)" style="width:30px;height:36px;background:var(--s3);border:1px solid var(--bd2);border-radius:3px;cursor:pointer;color:var(--mu);font-size:14px;display:flex;align-items:center;justify-content:center;transition:.1s" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--mu)'">›</button>
 </div>
 <!-- Raccourcis rapides -->
 <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
 ${[["Aujourd'hui",todayLocal()],['Demain',localDateStr(new Date(Date.now()+86400000))],['+2j',localDateStr(new Date(Date.now()+2*86400000))],['+1 sem',localDateStr(new Date(Date.now()+7*86400000))]].map(([l,v])=>`<button type="button" onclick="agFormSetDate('${v}')" style="padding:3px 9px;font-size:10px;background:var(--s3);border:1px solid var(--bd2);border-radius:2px;cursor:pointer;color:var(--mu);font-family:'DM Mono',monospace;transition:.1s" onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--mu)'">${l}</button>`).join('')}
 </div>
 <input type="hidden" id="af-d" value="${_agFormDate}">
 </div>

 <!-- Heure — select large et lisible -->
 <div style="margin-bottom:12px">
 <span class="lbl"> Heure</span>
 <select id="af-h" style="font-family:'DM Mono',monospace;font-size:15px;font-weight:600;padding:9px 12px;margin-top:4px;letter-spacing:.04em">${timeOpts}</select>
 </div>

 <!-- Liens -->
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
 <div class="fgrp" style="margin:0"><span class="lbl">Candidat lié</span><select id="af-ca">${candOpts}</select></div>
 <div class="fgrp" style="margin:0"><span class="lbl">Entreprise liée</span><select id="af-co">${coOpts}</select></div>
 </div>
 <div class="fgrp"><span class="lbl">Notes</span><textarea id="af-notes" style="min-height:55px">${esc(a.notes||'')}</textarea></div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>${id?`<button class="btn bd_" onclick="delAg('${id}');closeMo()"></button>`:''}<button class="btn bp" onclick="saveAgForm('${id||''}')">Enregistrer ✓</button>`
);
}

function agFormDateNav(dir){
 const d=new Date(_agFormDate+'T12:00:00');
 d.setDate(d.getDate()+dir);
 agFormSetDate(localDateStr(d));
}

function agFormSetDate(dateStr){
 _agFormDate=dateStr;
 const inp=document.getElementById('af-d');
 if(inp)inp.value=dateStr;
 const disp=document.getElementById('af-date-display');
 if(disp){
 disp.textContent=fmtDateHuman(dateStr);
 disp.style.transform='scale(1.04)';
 setTimeout(()=>{if(disp)disp.style.transform='scale(1)';},150);
 }
}

function saveAgForm(id){
 const t=document.getElementById('af-t')?.value.trim();
 if(!t){toast('Titre requis','e');document.getElementById('af-t')?.focus();return;}
 const n=now_();
 const newDate=document.getElementById('af-d')?.value||_agFormDate;
 const newTime=document.getElementById('af-h')?.value||null;
 const isDone=document.getElementById('af-done')?.value==='1';
 const data={
 title:t,
 type:document.getElementById('af-type')?.value||'task',
 date:dayKey(newDate),
 time:newTime||null,
 cand_id:document.getElementById('af-ca')?.value||null,
 comp_id:document.getElementById('af-co')?.value||null,
 notes:document.getElementById('af-notes')?.value||'',
 done:isDone,
 updated:n
 };
 if(id){const a=agById(id);if(!a)return;Object.assign(a,data);}
 else{data.id=uid();data.created=n;DB.agenda.unshift(data);}
 save();closeMo();
 if(newDate)UI.agDate=dayKey(newDate);
 rAgenda();badges();
 // Si une fiche entreprise/candidat liée est ouverte, la rafraîchir (section Suivi)
 if(UI.ptype==='co'&&data.comp_id===UI.pid)openCoPanel(UI.pid);
 else if(UI.ptype==='cand'&&data.cand_id===UI.pid)openCandPanel(UI.pid);
 toast(id?'Événement mis à jour':'Événement ajouté','s');
}


function rPosts(){
 document.getElementById('view-posts').innerHTML=DB.posts.length?`<div class="g3">${DB.posts.map(p=>{
 const cat=getCat(p.cat);
 return `<div class="prcard" onclick="openPostPanel('${p.id}')">
 <div class="flex fjb fac mb4"><div class="prcard-n">${esc(p.title)}</div><span class="pill ${p.status==='active'?'pwin':'pnew'}">${p.status==='active'?'Active':'Brouillon'}</span></div>
 <div class="prcard-m"><span class="tag ${cat.cls}">${cat.l}</span><br>${esc(p.location||'—')} · ${esc(p.salary||'—')}</div>
 <div class="fs10 mu_ mt8">${(p.boards||[]).length} board(s) · Créée ${fD(p.created)}</div>
 </div>`;
 }).join('')}</div>`:'<div class="empty">Aucune annonce — <button class="btn bp bxs" onclick="openPostForm()">+ Créer</button></div>';
}

// ═══════════════════════════════════════════════════════
// PANEL SYSTEM
// ═══════════════════════════════════════════════════════
function openPanel(){document.getElementById('panel').classList.add('open');}
function closePanel(){document.getElementById('panel').classList.remove('open');UI.ptype=null;UI.pid=null;}

function setPanel(name,sub,tabs,body,actions){
 document.getElementById('ph-name').textContent=name;
 document.getElementById('ph-sub').innerHTML=sub||'';
 document.getElementById('ptabs').innerHTML=tabs||'';
 document.getElementById('pb').innerHTML=body||'';
 document.getElementById('pa').innerHTML=actions||'';
 openPanel();
}
function setPTab(t){
 UI.ptab=t;
 if(UI.ptype==='cand'&&UI.pid) openCandPanel(UI.pid);
 else if(UI.ptype==='co') openCoPanel(UI.pid);
 else if(UI.ptype==='need') openNeedPanel(UI.pid);
 // Rebind file inputs if Fichiers tab (index 1)
 if(UI.ptype==='cand'&&t===1&&UI.pid) setTimeout(()=>bindFileInputs(UI.pid),50);
}

// ── CANDIDATE PANEL ──────────────────────────────────────
function openCandPanel(id){
 UI.ptype='cand';UI.pid=id;if(!UI.ptab)UI.ptab=0;
 const c=cById(id);if(!c)return;
 const cat=getCat(c.cat);const st=getCS(c.status);
 const tabNames=['Profil','Fichiers','Entretien','Références','Suivi'];
 const tabs=tabNames.map((t,i)=>`<div class="ptab ${i===UI.ptab?'act':''}" onclick="setPTab(${i})">${t}</div>`).join('');
 const docs=c.docs||[];
 const B=[
 // 0 PROFIL
 `${c.phone?`<div class="callbox"><div class="callbox-ph">${fPhone(c.phone)}</div><div class="btn bg bxs" onclick="cpPhone('${esc(c.phone)}')">Copier</div></div>`:''}
 <div class="dr"><span class="drk">Poste ciblé</span><span class="drv">${esc(c.role||'—')}</span></div>
 <div class="dr"><span class="drk">Salaire brut/an</span><span class="drv">${fM(c.salary)} <span class="mu_ fs10">(hon. ${honor(c.salary)})</span></span></div>
 <div class="dr"><span class="drk">Email</span><span class="drv">${esc(c.email||'—')}</span></div>
 <div class="dr"><span class="drk">Disponibilité</span><span class="drv">${esc(c.avail||'—')}</span></div>
 <div class="dr"><span class="drk">Mobilité</span><span class="drv">${esc(c.mobility||'—')}</span></div>
 <div class="dr"><span class="drk">Source</span><span class="drv">${esc(c.source||'—')}</span></div>
 <div class="dr"><span class="drk">Créé le</span><span class="drv">${fD(c.created)}</span></div>
 <div class="sl">Notes précal</div>
 ${c.notes_pre?`<div class="notebox">${esc(c.notes_pre)}</div>`:'<div class="mu_ fs11">Pas de notes de précal</div>'}
 <div class="sl">Statut <span><button class="btn bg bxs" onclick="openStatusMo('cand','${id}')">Changer →</button></span></div>
 <div class="st-sel">${CAND_ST.map(s=>`<div class="st-btn ${s.id===c.status?'cur':''}" onclick="setCS('${id}','${s.id}')">${s.l}</div>`).join('')}</div>
 <div class="sl mt12">Matchage besoin</div>
 <div class="flex fg5 fw">${DB.needs.filter(n=>n.status==='open').map(n=>`<button class="btn ${c.linked_need===n.id?'bp':'bg'} bxs" onclick="toggleLink('${id}','${n.id}')">${c.linked_need===n.id?'✓ ':''} ${esc(n.title)}</button>`).join('')||'<span class="mu_ fs10">Aucun besoin ouvert</span>'}</div>
 ${renderLinkedAgenda('cand',id)}`,
 // 1 FICHIERS — rendered via renderCPFichiers
 renderCPFichiers(c),
 // 2 ENTRETIEN
 `<div class="dr"><span class="drk">Entretien fait</span><span class="drv">${c.int_done?`${fD(c.int_date)}`:'Non'}</span></div>
 <div class="dr"><span class="drk">Planifié le</span><span class="drv">${c.int_date_planned?`${fD(c.int_date_planned)} ${c.int_time||''}`:' —'}</span></div>
 ${c.visio_link?`<div class="visio-box"> <strong>Lien visio :</strong><br><span class="visio-link">${esc(c.visio_link)}</span><br><a href="${esc(c.visio_link)}" target="_blank" class="btn bi bxs mt4">Rejoindre</a></div>`:''}
 <div class="sl">Synthèse entretien <span><button class="btn bg bxs" onclick="markIntDone('${id}')">Marquer fait</button></span></div>
 <textarea id="int-note-${id}" style="min-height:100px">${esc(c.notes_int||'')}</textarea>
 <button class="btn bp bsm btn-full mt8" onclick="saveIntNote('${id}')">Sauvegarder synthèse</button>
 <div class="sl mt12">Notes générales</div>
 <textarea id="gen-note-${id}" style="min-height:60px">${esc(c.notes||'')}</textarea>
 <button class="btn bg bsm mt6" onclick="saveGenNote('${id}')">Sauvegarder note</button>`,
 // 3 RÉFÉRENCES
 `<div class="dr"><span class="drk">Contrôle REF</span><span class="drv">${c.ref_done?'Fait':'À faire'}</span></div>
 <div class="sl">Références <span class="mu_ fs10" style="font-weight:400">${(c.refs||[]).length} contact(s)</span> <span><button class="btn bg bxs" onclick="addRef('${id}')">+ Ajouter</button></span></div>
 ${(c.refs||[]).some(r=>r&&r._src==='dossier')?`<div class="fs10 mu_" style="margin:-2px 0 8px">Les référents marqués <span style="color:var(--ac4)">Dossier</span> ont été renseignés par le candidat dans son dossier.</div>`:''}
 ${(c.refs||[]).length?(c.refs||[]).map((r,i)=>`<div class="refcard">
 <div class="flex fac fjb mb4"><div style="display:flex;align-items:center;gap:6px;min-width:0"><strong class="fs11" style="overflow:hidden;text-overflow:ellipsis">${esc(r.company||'—')}</strong>${r._src==='dossier'?'<span style="font-size:8px;padding:1px 6px;background:rgba(201,137,26,.12);border:1px solid rgba(201,137,26,.25);border-radius:10px;color:var(--ac4);flex-shrink:0">Dossier</span>':''}</div><button class="btn bd_ bxs" onclick="rmRef('${id}',${i})">×</button></div>
 ${r.role?`<div class="fs10" style="color:var(--ac5);margin-bottom:2px">${esc(r.role)}</div>`:''}
 <div class="mu_ fs10">${esc(r.contact||'Référent non nommé')}${r.phone?` · <a href="tel:${esc(String(r.phone).replace(/\s/g,''))}" style="color:var(--ac2);font-family:'DM Mono',monospace">${esc(fPhone(r.phone))}</a>`:''}${r.phone?` <span onclick="cpPhone('${esc(r.phone)}')" style="cursor:pointer">⧉</span>`:''}</div>
 ${r.done?`<div style="color:var(--ac2);font-size:10px;margin-top:4px">✓ ${esc(r.note||'Référence vérifiée')}</div>`:`<div style="color:var(--ac4);font-size:10px;margin-top:4px">${r.phone?'À appeler':'Téléphone manquant'}</div>`}
 <div class="flex fg5 mt8">
 <button class="btn bp bxs" onclick="noteRef('${id}',${i})">✎ Compte-rendu</button>
 ${r.done?`<button class="btn bg bxs" onclick="togRef('${id}',${i})">↺ Rouvrir</button>`:''}
 <button class="btn bi bxs" onclick="prosFromRef('${id}',${i})">→ Prospecter</button>
 </div>
 </div>`).join(''):'<div class="mu_ fs11">Aucune référence — elles apparaîtront ici dès que le candidat aura renseigné ses expériences dans le dossier.</div>'}
 <div class="sl">Notes générales</div>
 <textarea id="gnote-${id}" style="min-height:64px">${esc(c.notes||'')}</textarea>
 <button class="btn bp bsm mt8" onclick="saveGNote('${id}')">Sauvegarder</button>`,
 // 4 SUIVI — Timeline interactions + statut dossier
 `<div style="margin-bottom:10px;display:flex;gap:6px;align-items:center">
  <span class="fs10 mu_">${(c.timeline||[]).length} interaction(s)</span>
  ${(function(){const f=dossierFunnelStatus(c);if(f.key==='sent')return '';return '<span style="font-size:9px;padding:2px 8px;background:'+f.bg+';border:1px solid '+f.border+';border-radius:10px;color:'+f.color+'">'+f.icon+' '+f.label+'</span>';})()}
  <button class="btn bg bxs" style="margin-left:auto" onclick="addManualNote('${id}')">+ Note</button>
 </div>
 <div>${renderTimeline(id)}</div>`
 ];
 const _hasDossier=c._dossier_validated||c._dossier_data||findDoc(c,'dossier')||(c.docs||[]).some(docHasFile);
 const acts=`<button class="btn bp bsm" onclick="openCandForm('${id}')">✎ Modifier</button>${_hasDossier?`<button class="btn bg bsm" onclick="openFullDossier('${id}')">📂 Dossier complet</button>`:''}<button class="btn bg bsm" onclick="openAgForm(null,'${id}')"> Planifier</button><button class="btn bg bsm" onclick="openSendProfileModal('${id}')">📤 Envoyer profil</button>${c._dossier_validated?`<button class="btn bxs" style="background:rgba(201,137,26,.12);color:var(--ac4)" onclick="aiMatchEnterprises('${id}')">🤖 Match IA</button>`:''}`;
 setPanel(c.name,`<span class="tag ${cat.cls}">${cat.l}</span> <span class="pill ${st.p}">${st.l}</span>${c.pepite?'':''}`,tabs,B[UI.ptab],acts);
}

// ── COMPANY PANEL ─────────────────────────────────────────
function openCoPanel(id){
 UI.ptype='co';UI.pid=id;
 const c=coById(id);if(!c)return;
 const cat=getCat(c.cat);
 const needs=DB.needs.filter(n=>n.company_id===id);
 const st=getCmpS(c.status);
 const contacts=c.contacts||[];
 const tl=c.timeline||[];

 const hasContract = !!(c._contract_draft);
 const ctTabLabel = hasContract
  ? (c._contract_signed ? '✅ Contrat' : '📄 Contrat')
  : '📄 Contrat';
 const tabs=['Fiche','Besoins',`Timeline (${tl.length})`,'Notes',ctTabLabel].map((t,i)=>`<div class="ptab ${i===UI.ptab?'act':''}" onclick="setCoTab(${i},'${id}')">${t}</div>`).join('');
 const B=[
 // 0 FICHE
 `${c.phone?`<div class="callbox"><div class="callbox-ph">${fPhone(c.phone)}</div><div class="btn bg bxs" onclick="cpPhone('${esc(c.phone)}')">⧉</div></div>`:''}
 <div class="dr"><span class="drk">Contact</span><span class="drv">${esc(c.contact||'—')}${c.ctitle?` <span class="mu_ fs10">${esc(c.ctitle)}</span>`:''}</span></div>
 <div class="dr"><span class="drk">Email</span><span class="drv">${c.email?`<a href="mailto:${esc(c.email)}" style="color:var(--ac5)">${esc(c.email)}</a>`:'—'}</span></div>
 <div class="dr"><span class="drk">Ville</span><span class="drv">${esc(c.city||'—')}</span></div>
 <div class="dr"><span class="drk">Client depuis</span><span class="drv">${c.contract_date?fD(c.contract_date):'—'}</span></div>
 ${contacts.length?`<div class="sl">Contacts</div>${contacts.map((ct,i)=>`<div class="refcard"><div class="flex fac fjb"><strong class="fs11">${esc(ct.name)}</strong></div><div class="mu_ fs10">${esc(ct.role||'—')}${ct.phone?' · '+fPhone(ct.phone):''}${ct.email?' · '+esc(ct.email):''}</div></div>`).join('')}`:''}
 ${needs.length?`
 <div class="sl">Besoins en cours <span><button class="btn bp bxs" onclick="setCoTab(1,'${id}')">Voir tous →</button></span></div>
 ${needs.filter(n=>n.status==='open').slice(0,3).map(n=>{
 const ns=getNS(n.status);const matched=DB.candidates.filter(cx=>cx.linked_need===n.id).length;
 return`<div class="nc u${n.urgency||'l'} mb8" onclick="openNeedPanel('${n.id}')" style="cursor:pointer">
 <div class="nc-t" style="font-size:12px">${esc(n.title)}</div>
 <div class="nc-ft">
 <span class="pill ppre">${ns.l}</span>
 <span class="fs10 mu_">${esc(n.location||'')}</span>
 <span class="fs10 mu_" style="margin-left:auto">${matched} candidat(s)</span>
 </div>
 </div>`;
 }).join('')||(needs.length?`<div class="mu_ fs11">Aucun besoin ouvert</div>`:'')}`:''}
 <div class="sl">Pipeline <span><button class="btn bg bxs" onclick="openStatusMo('co','${id}')">Voir arbre →</button></span></div>
 <div class="st-sel">${COMP_ST.map(s=>`<div class="st-btn ${s.id===c.status?'cur':''}" onclick="setCmpS('${id}','${s.id}')">${s.l}</div>`).join('')}</div>
 ${renderLinkedAgenda('co',id)}`,
 // 1 BESOINS
 `<div class="flex fjb fac mb8"><span class="fs11">${needs.length} besoin(s)</span><button class="btn bp bxs" onclick="openNeedForm('${id}')">+ Besoin</button></div>
 ${needs.map(n=>{const ns=getNS(n.status);const matched=DB.candidates.filter(cx=>cx.linked_need===n.id).length;return`<div class="nc u${n.urgency||'l'} mb8" onclick="openNeedPanel('${n.id}')"><div class="nc-t">${esc(n.title)}</div><div class="nc-ft"><span class="pill ppre">${ns.l}</span><span class="fs10 mu_">${esc(n.location||'')}</span><span class="fs10 mu_ ml-auto" style="margin-left:auto">${matched}</span></div></div>`;}).join('')||'<div class="mu_ fs11">Aucun besoin</div>'}`,
 // 2 TIMELINE
 `<div style="margin-bottom:10px;display:flex;gap:6px;align-items:center">
 <span class="fs10 mu_">${tl.length} interaction(s)</span>
 <button class="btn bg bxs" style="margin-left:auto" onclick="addManualNote('${id}')">+ Note</button>
 </div>
 <div>${renderTimeline(id)}</div>`,
 // 3 NOTES
 `<textarea id="conote-${id}" style="min-height:100px">${esc(c.notes||'')}</textarea><button class="btn bp bsm mt8" onclick="saveCoNote('${id}')">Sauvegarder</button>`,
 // 4 CONTRAT
 renderContractTab(c),
 ];
 const contractBtn=c.type==='client'?`<button class="btn bp bsm" onclick="openContractModal('${id}')">📄 Contrat</button>`:'';
 const acts=`${contractBtn}<button class="btn bg bsm" onclick="openCoForm('${id}')">✎ Modifier</button><button class="btn bg bsm" onclick="openAgForm(null,null,'${id}')">🔔 Relance</button><button class="btn bd_ bsm" onclick="delCo('${id}')">🗑</button>`;
 setPanel(c.name,`<span class="tag ${cat.cls}">${cat.l}</span> <span class="pill ${st.p}">${st.l}</span> <span class="pill ${c.type==='client'?'pwin':'ptoc'}">${c.type==='client'?'Client':'Prospect'}</span>`,tabs,B[Math.min(UI.ptab,B.length-1)],acts);
}

// ── NEED PANEL ─────────────────────────────────────────────
function openNeedPanel(id){
 UI.ptype='need';UI.pid=id;
 const n=nById(id);if(!n)return;
 const co=coById(n.company_id);
 const cat=getCat(n.cat);
 const matched=DB.candidates.filter(c=>c.linked_need===id);
 const NST=[{id:'open',l:'Ouvert'},{id:'sent',l:'CV envoyés'},{id:'interview',l:'Entretiens'},{id:'won',l:'Placé'},{id:'lost',l:'Perdu'}];
 const tabs=['Détail','Candidats'].map((t,i)=>`<div class="ptab ${i===UI.ptab?'act':''}" onclick="setPTab(${i})">${t}</div>`).join('');
 const B=[
 // 0 DETAIL
 `<div class="dr"><span class="drk">Entreprise</span><span class="drv">${co?`<span class="ac5" style="cursor:pointer" onclick="openCoPanel('${co.id}')">${esc(co.name)}</span>`:'—'}</span></div>
 <div class="dr"><span class="drk">Catégorie</span><span class="drv"><span class="tag ${cat.cls}">${cat.l}</span></span></div>
 <div class="dr"><span class="drk">Salaire</span><span class="drv">${n.smin&&n.smax?`${fM(n.smin)} – ${fM(n.smax)}`:n.smax?`≤ ${fM(n.smax)}`:n.smin?`≥ ${fM(n.smin)}`:'—'}</span></div>
 <div class="dr"><span class="drk">Honoraires est.</span><span class="drv ac">${n.smax?honor(n.smax):'—'}</span></div>
 <div class="dr"><span class="drk">Localisation</span><span class="drv">${esc(n.location||'France')}</span></div>
 <div class="dr"><span class="drk">Démarrage</span><span class="drv">${n.start?fD(n.start):'ASAP'}</span></div>
 <div class="dr"><span class="drk">Urgence</span><span class="drv">${{h:'Urgent',m:'○ Moyen',l:'Long terme'}[n.urgency]||'—'}</span></div>
 ${n.notes?`<div class="sl">Critères / Notes</div><div class="notebox">${esc(n.notes)}</div>`:''}
 <div class="sl">Statut</div>
 <div class="st-sel">${NST.map(s=>`<div class="st-btn ${s.id===n.status?'cur':''}" onclick="setNS('${id}','${s.id}')">${s.l}</div>`).join('')}</div>`,
 // 1 CANDIDATS
 `<div class="flex fjb fac mb8"><span class="fs11">${matched.length} candidat(s) matchés</span><button class="btn bp bxs" onclick="findForNeed('${id}')"> Trouver</button></div>
 ${matched.map(c=>{const cs=getCS(c.status);return`<div class="aitem" onclick="openCandPanel('${c.id}')"><span class="pill ${cs.p}">${cs.l}</span><span style="flex:1">${esc(c.name)}</span><span class="mu_ fs10">${fM(c.salary)}</span><button class="btn bd_ bxs" onclick="event.stopPropagation();toggleLink('${c.id}','${id}')">×</button></div>`;}).join('')||'<div class="mu_ fs11">Aucun candidat lié</div>'}
 <div class="sl mt12">Lier un candidat</div>
 <select id="nc-sel" style="margin-bottom:7px"><option value="">Choisir…</option>${DB.candidates.filter(c=>c.cat===n.cat&&!['ko','placed'].includes(c.status)&&c.linked_need!==id).map(c=>`<option value="${c.id}">${esc(c.name)} — ${esc(c.role||'')}</option>`).join('')}</select>
 <button class="btn bp bsm" onclick="linkFromSel('${id}')">Lier</button>`,
 ];
 const acts=`<button class="btn bp bsm" onclick="openNeedForm('${n.company_id||''}','${id}')">✎ Modifier</button><button class="btn bd_ bsm" onclick="delNeed('${id}')"></button>`;
 setPanel(n.title,`${co?`<span>${esc(co.name)}</span> · `:''}<span class="tag ${cat.cls}">${cat.l}</span>`,tabs,B[UI.ptab],acts);
}

// ── AGENDA PANEL ────────────────────────────────────────────
function openAgPanel(id){
 const a=agById(id);if(!a)return;
 UI.ptype='ag';UI.pid=id;
 const t=agType(a.type);
 const ctx=agendaContext(a);
 const ca=ctx.ca, co=ctx.co;
 const state=agendaState(a);
 const STATE_META={
  overdue:{l:'En retard',c:'var(--red)',bg:'var(--red-dim)',bd:'var(--red-border)'},
  today:{l:"Aujourd'hui",c:'var(--gold)',bg:'var(--ac-dim)',bd:'var(--ac-border)'},
  soon:{l:'Demain',c:'var(--blue)',bg:'var(--blue-dim)',bd:'var(--blue-border)'},
  upcoming:{l:'À venir',c:'var(--mu)',bg:'var(--s3)',bd:'var(--bd)'},
  done:{l:'Terminé',c:'var(--green)',bg:'var(--green-dim)',bd:'var(--green-border)'}
 };
 const sm=STATE_META[state]||STATE_META.upcoming;
 const heure=a.time?a.time:'Toute la journée';

 // Bandeau d'état + quand
 const banner=`<div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:${sm.bg};border:1px solid ${sm.bd};border-left:3px solid ${sm.c};border-radius:var(--r2);margin-bottom:12px">
  <span style="font-size:22px;line-height:1">${t.ico}</span>
  <div style="flex:1;min-width:0">
   <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:13px;color:var(--tx);line-height:1.25">${esc(a.title)}</div>
   <div style="font-size:10px;color:${sm.c};font-weight:700;margin-top:2px">${sm.l} · ${fmtDateHuman(a.date)}${a.time?' · '+a.time:''}</div>
  </div>
 </div>`;

 // Carte CONTEXTE — coordonnées immédiatement actionnables (cœur de la demande)
 let contextCard='';
 const entity = co || ca;
 if(entity){
  const isCo=!!co;
  const phone=ctx.phone, email=ctx.email, city=ctx.city;
  contextCard=`<div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r2);padding:12px 13px;margin-bottom:12px">
   <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
    <span style="font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--mu2)">${isCo?'Entreprise liée':'Candidat lié'}</span>
    <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:${isCo?'var(--blue)':'var(--green)'};cursor:pointer" onclick="${isCo?`openCoPanel('${co.id}')`:`openCandPanel('${ca.id}')`}">${esc(entity.name)} ›</span>
   </div>
   ${phone?`<div class="callbox" style="margin-bottom:7px"><div class="callbox-ph">${fPhone(phone)}</div><a href="tel:${esc(String(phone).replace(/\s/g,''))}" class="btn bg bxs" style="text-decoration:none">Appeler</a><div class="btn bg bxs" onclick="cpPhone('${esc(phone)}')">Copier</div></div>`:''}
   ${email?`<div class="dr"><span class="drk">Email</span><span class="drv"><a href="mailto:${esc(email)}" style="color:var(--blue)">${esc(email)}</a></span></div>`:''}
   ${city?`<div class="dr"><span class="drk">${isCo?'Ville':'Mobilité'}</span><span class="drv">${esc(city)}</span></div>`:''}
   ${isCo&&co.contact?`<div class="dr"><span class="drk">Contact</span><span class="drv">${esc(co.contact)}${co.ctitle?` <span class="mu_ fs10">${esc(co.ctitle)}</span>`:''}</span></div>`:''}
   ${!phone&&!email?`<div class="mu_ fs10">Aucune coordonnée enregistrée. <span style="color:var(--blue);cursor:pointer" onclick="${isCo?`openCoForm('${co.id}')`:`openCandForm('${ca.id}')`}">Compléter la fiche →</span></div>`:''}
  </div>`;
 }

 // Note / contexte (ce que l'utilisateur a écrit en planifiant)
 const noteCard=a.notes?`<div class="sl">Contexte / Note</div><div class="notebox">${esc(a.notes)}</div>`:'';

 // Entretien visio lié à un candidat → accès direct au cockpit + au lien de connexion
 let visioCard='';
 if(a.type==='visio' && ca){
  const _vl = ca.visio_link || ((a.notes||'').match(/https?:\/\/[^\s]+/)||[])[0] || '';
  visioCard=`<div style="margin-bottom:12px">
   <button class="btn bp btn-full" onclick="openInterviewModal('${ca.id}')">▶ Ouvrir le cockpit d'entretien</button>
   ${_vl?`<a href="${esc(_vl)}" target="_blank" class="btn bg bsm btn-full" style="text-decoration:none;margin-top:6px">🎥 Rejoindre la visio</a>`:''}
  </div>`;
 }

 // Détails secondaires
 const details=`<div class="sl">Détails</div>
  <div class="dr"><span class="drk">Type</span><span class="drv">${t.ico} ${t.l}</span></div>
  <div class="dr"><span class="drk">Date</span><span class="drv">${fD(a.date)}</span></div>
  <div class="dr"><span class="drk">Heure</span><span class="drv">${heure}</span></div>
  ${co&&ca?`<div class="dr"><span class="drk">Candidat</span><span class="drv"><span class="ac5" style="cursor:pointer" onclick="openCandPanel('${ca.id}')">${esc(ca.name)}</span></span></div>`:''}`;

 // Report rapide (sans ouvrir le formulaire)
 const reschedule=!a.done?`<div class="sl">Reporter</div>
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
   <button class="btn bg bxs" onclick="rescheduleAg('${id}','+1')">+1 jour</button>
   <button class="btn bg bxs" onclick="rescheduleAg('${id}','tomorrow')">Demain</button>
   <button class="btn bg bxs" onclick="rescheduleAg('${id}','+3')">+3 jours</button>
   <button class="btn bg bxs" onclick="rescheduleAg('${id}','nextweek')">+1 sem.</button>
  </div>`:'';

 const body=banner+visioCard+contextCard+noteCard+details+reschedule;
 const actions=`<button class="btn ${a.done?'bg':'bp'} bsm" onclick="togAgDone('${id}');openAgPanel('${id}')">${a.done?'↺ Rouvrir':'✓ Terminer'}</button><button class="btn bg bsm" onclick="openAgForm('${id}')">✎ Modifier</button><button class="btn bd_ bsm" onclick="delAg('${id}')">🗑</button>`;
 setPanel(a.title,`<span style="color:${sm.c};font-weight:700">${t.l}</span> · ${fmtDateHuman(a.date)}${a.time?` · ${a.time}`:''}`,null,body,actions);
}

// Report rapide d'un événement (recale la date, le rouvre, rafraîchit les vues liées)
function rescheduleAg(id,key){
 const a=agById(id);if(!a)return;
 let nd;
 if(key==='tomorrow')nd=shiftDayKey(todayKey(),1);
 else if(key==='nextweek')nd=shiftDayKey(todayKey(),7);
 else if(key==='today')nd=todayKey();
 else if(/^\+\d+$/.test(key))nd=shiftDayKey(dayKey(a.date)||todayKey(),parseInt(key.slice(1),10));
 else nd=dayKey(key);
 a.date=nd;a.done=false;a.updated=now_();
 save();
 if(typeof rAgenda==='function'&&UI.view==='agenda')rAgenda();
 badges();
 if(UI.view==='dash')rDash();
 if(UI.ptype==='co'&&a.comp_id===UI.pid)openCoPanel(UI.pid);
 else if(UI.ptype==='cand'&&a.cand_id===UI.pid)openCandPanel(UI.pid);
 else openAgPanel(id);
 toast('Reporté au '+fmtDateHuman(nd),'s');
}

// ── SUIVI / RAPPELS liés à une fiche (entreprise ou candidat) ──
// Affiche les événements d'agenda rattachés, regroupés En cours / Historique.
function renderLinkedAgenda(kind,id){
 const all=agendaForEntity(kind,id);
 const addBtn=kind==='co'
  ?`<button class="btn bp bxs" onclick="openAgForm(null,null,'${id}')">+ Rappel</button>`
  :`<button class="btn bp bxs" onclick="openAgForm(null,'${id}')">+ Rappel</button>`;
 if(!all.length){
  return `<div class="sl">Suivi & rappels <span>${addBtn}</span></div>
   <div class="mu_ fs11" style="padding:4px 0">Aucun rappel planifié. Ajoutez-en un pour ne rien oublier.</div>`;
 }
 const open=all.filter(a=>!a.done).sort((a,b)=>((a.date||'')+(a.time||''))<((b.date||'')+(b.time||''))?-1:1);
 const done=all.filter(a=>a.done).sort((a,b)=>(a.date||'')>(b.date||'')?-1:1);
 const STATE_C={overdue:'var(--red)',today:'var(--gold)',soon:'var(--blue)',upcoming:'var(--mu)',done:'var(--green)'};
 const row=(a)=>{
  const t=agType(a.type);const stt=agendaState(a);const c=STATE_C[stt]||'var(--mu)';
  const snippet=a.notes?`<div style="font-size:10px;color:var(--mu2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.notes.replace(/\n/g,' '))}</div>`:'';
  return `<div onclick="openAgPanel('${a.id}')" style="display:flex;align-items:flex-start;gap:9px;padding:8px 10px;background:var(--s2);border:1px solid var(--bd);border-left:2px solid ${c};border-radius:var(--r);margin-bottom:5px;cursor:pointer;transition:.12s" onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background='var(--s2)'">
   <span style="font-size:13px;line-height:1.2;flex-shrink:0">${t.ico}</span>
   <div style="flex:1;min-width:0">
    <div style="font-size:11px;font-weight:600;color:var(--tx);${a.done?'text-decoration:line-through;opacity:.6':''}">${esc(a.title)}</div>
    ${snippet}
   </div>
   <div style="text-align:right;flex-shrink:0">
    <div style="font-size:10px;font-weight:700;color:${c}">${fmtDateHuman(a.date)}</div>
    ${a.time?`<div style="font-size:9px;color:var(--mu2)">${a.time}</div>`:''}
   </div>
  </div>`;
 };
 let html=`<div class="sl">Suivi & rappels <span>${addBtn}</span></div>`;
 if(open.length){ html+=open.map(row).join(''); }
 else { html+=`<div class="mu_ fs11" style="padding:2px 0 6px">Aucun rappel en cours.</div>`; }
 if(done.length){
  html+=`<details style="margin-top:6px"><summary style="font-size:10px;color:var(--mu);cursor:pointer;padding:4px 0">Historique (${done.length} terminé${done.length>1?'s':''})</summary><div style="margin-top:4px">${done.slice(0,8).map(row).join('')}</div></details>`;
 }
 return html;
}



// ── POST PANEL ──────────────────────────────────────────────
function openPostPanel(id){
 const p=DB.posts.find(x=>x.id===id);if(!p)return;
 const cat=getCat(p.cat);
 const published=p.published_on||[];
 const boardsHtml=(p.boards||[]).map(b=>{
 const isPub=published.includes(b);
 return`<div class="board-row">
 <div class="board-name">${esc(b)}</div>
 <span class="board-status ${isPub?'bst-live':'bst-todo'}">${isPub?'✓ Publié':'À publier'}</span>
 </div>`;
 }).join('')||'<div class="mu_ fs11">—</div>';

 const jcmoStatus=p.jcmo_ok===true
 ?`<span style="color:var(--ac2);font-size:10px">Vérifiée légalement</span>`
 :p.jcmo_ok===false
 ?`<span style="color:var(--ac3);font-size:10px">! ${p.jcmo_issues?.length||0} point(s) à corriger</span>`
 :`<button class="btn bg bxs" onclick="verifyPostJCMO('${id}')"> Vérifier avant publication</button>`;

 setPanel(p.title,`<span class="tag ${cat.cls}">${cat.l}</span> <span class="pill ${p.status==='active'?'pwin':'pnew'}">${p.status==='active'?'Active':'Brouillon'}</span>`,null,`
 <div class="dr"><span class="drk">Localisation</span><span class="drv">${esc(p.location||'—')}</span></div>
 <div class="dr"><span class="drk">Salaire</span><span class="drv">${esc(p.salary||'—')}</span></div>
 <div class="sl">Conformité légale ${jcmoStatus}</div>
 ${p.jcmo_issues?.length?`<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px">${p.jcmo_issues.map(i=>`<div class="fs10" style="padding:4px 8px;background:var(--s3);border-radius:2px">${esc(i)}</div>`).join('')}</div>`:''}
 <div class="sl">Publication (${published.length}/${(p.boards||[]).length} boards)</div>
 ${boardsHtml}
 <div class="sl mt12">Texte de l'annonce</div>
 <div class="notebox" style="max-height:160px;overflow-y:auto">${esc(p.body||'—')}</div>`,
 `<button class="btn bp bsm" onclick="openPublishPanel('${id}')">Publier</button>
 <button class="btn bg bsm" onclick="verifyPostJCMO('${id}')"> Vérifier</button>
 <button class="btn ${p.status==='active'?'bg':'bg'} bsm" onclick="togPostSt('${id}')">${p.status==='active'?'⏸ Clôturer':'▶ Activer'}</button>
 <button class="btn bg bsm" onclick="openPostForm('${id}')">✎ Modifier</button>
 <button class="btn bd_ bsm" onclick="delPost('${id}')"></button>`
);
}

// ── Vérification légale JCMO ──────────────────────────
async function verifyPostJCMO(postId){
 const p=DB.posts.find(x=>x.id===postId);if(!p)return;
 const apiBase=getApiBase();
 toast(' Vérification légale en cours…','i');

 try{
 let result;
 if(apiBase){
 // Appel API Vercel
 const resp=await fetch(`${apiBase}/api/jobs`,{
 method:'POST',
 headers:{'Content-Type':'application/json'},
 body:JSON.stringify({action:'verify_offer',post:{title:p.title,body:p.body,location:p.location,salary:p.salary,cat:p.cat}})
 });
 result=await resp.json();
 } else {
 // Vérification locale si pas sur Vercel
 result=localLegalCheck(p);
 }

 p.jcmo_ok=result.ok;
 p.jcmo_issues=result.issues||[];
 p.updated=now_();
 save();
 openPostPanel(postId);

 if(result.ok){
 toast('Annonce conforme — prête à publier','s');
 } else {
 const warnings=result.issues.filter(i=>i.startsWith('!️')).length;
 toast(`! ${warnings} point(s) à corriger dans l'annonce`,'w');
 }
 }catch(err){
 toast('Vérification: '+err.message,'e');
 }
}

// Vérification légale locale (fallback)
function localLegalCheck(post){
 const issues=[];
 const body=(post.body||'').toLowerCase();
 const title=(post.title||'').toLowerCase();
 const forbidden=['jeune','dynamique','moins de','plus de','ans minimum','beau','belle','présentable','français natif'];
 forbidden.forEach(w=>{if(body.includes(w)||title.includes(w))issues.push(`! Mention potentiellement discriminatoire : "${w}"`)});
 if(!body.includes('cdi')&&!body.includes('cdd')&&!body.includes('contrat'))issues.push('! Type de contrat non précisé');
 if(!post.location)issues.push('! Localisation manquante');
 if(!post.salary)issues.push('ℹ️ Salaire non renseigné (recommandé)');
 if((post.body||'').length<200)issues.push('ℹ️ Description courte — une annonce détaillée attire plus de candidats');
 return{ok:issues.filter(i=>i.startsWith('!️')).length===0,issues,source:'local'};
}

// ═══════════════════════════════════════════════════════
// MODAL SYSTEM
// ═══════════════════════════════════════════════════════
function openMo(t,b,f){const mh=document.getElementById('mhdr');if(mh)mh.style.display=t?'flex':'none';const mht=document.getElementById('mht');if(mht)mht.textContent=t;document.getElementById('mb').innerHTML=b;document.getElementById('mf').innerHTML=f||'';if(f===''||f===undefined){const mff=document.getElementById('mf');if(mff)mff.style.display='none';}else{const mff=document.getElementById('mf');if(mff)mff.style.display='';}document.getElementById('mo').classList.add('open');}
function closeMo(){document.getElementById('mo').classList.remove('open');}
function moOvClick(e){if(e.target===document.getElementById('mo'))closeMo();}

// ── CAND FORM ────────────────────────────────────────────
function openCandForm(id=null){
 const c=id?cById(id):{};if(!c)return;
 const catOpts=BTP_CATS.map(cat=>`<option value="${cat.id}" ${(c.cat||'go')===cat.id?'selected':''}>${cat.l}</option>`).join('');
 const jobs=getCat(c.cat||'go').jobs;
 const jobOpts=jobs.map(j=>`<option value="${esc(j)}" ${c.role===j?'selected':''}>${esc(j)}</option>`).join('');
 const stOpts=CAND_ST.map(s=>`<option value="${s.id}" ${(c.status||'new')===s.id?'selected':''}>${s.l}</option>`).join('');
 const srcOpts=SOURCES.map(s=>`<option ${c.source===s?'selected':''}>${s}</option>`).join('');
 openMo(id?'Modifier candidat':'Nouveau candidat',`
 <div class="fg">
 <div class="fgrp ff"><span class="lbl">Nom complet *</span><input id="cf-n" value="${esc(c.name||'')}"></div>
 <div class="fgrp"><span class="lbl">Catégorie BTP</span><select id="cf-cat" onchange="updJobOpts()">${catOpts}</select></div>
 <div class="fgrp"><span class="lbl">Poste exact</span><select id="cf-role">${jobOpts}</select></div>
 <div class="fgrp"><span class="lbl">Salaire brut/an (€)</span><input id="cf-sal" type="number" value="${c.salary||''}" placeholder="42000"></div>
 <div class="fgrp"><span class="lbl">Téléphone</span><input id="cf-ph" value="${esc(c.phone||'')}"></div>
 <div class="fgrp"><span class="lbl">Email</span><input id="cf-em" value="${esc(c.email||'')}"></div>
 <div class="fgrp"><span class="lbl">Source</span><select id="cf-src">${srcOpts}</select></div>
 <div class="fgrp"><span class="lbl">Statut</span><select id="cf-st">${stOpts}</select></div>
 <div class="fgrp"><span class="lbl">Disponibilité</span><input id="cf-av" value="${esc(c.avail||'')}" placeholder="Immédiate / sous 1 mois"></div>
 <div class="fgrp"><span class="lbl">Mobilité</span><input id="cf-mob" value="${esc(c.mobility||'')}" placeholder="Rhône-Alpes, National…"></div>
 <div class="fgrp ff"><span class="lbl">Notes précal</span><textarea id="cf-npre">${esc(c.notes_pre||'')}</textarea></div>
 <div class="fgrp ff"><span class="lbl">Notes générales</span><textarea id="cf-notes">${esc(c.notes||'')}</textarea></div>
 <div class="fgrp ff" style="flex-direction:row;align-items:center;gap:7px"><input type="checkbox" id="cf-pep" ${c.pepite?'checked':''} style="width:12px;height:12px;accent-color:var(--ac4)"><span class="lbl" style="margin:0;text-transform:none;cursor:pointer" for="cf-pep">Marquer comme pépite</span></div>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>${id?`<button class="btn bd_" onclick="delCand('${id}')">Supprimer</button>`:''}<button class="btn bp" onclick="saveCandForm('${id||''}')">Enregistrer</button>`
);
}
function updJobOpts(){
 const v=document.getElementById('cf-cat')?.value||'go';
 const jobs=getCat(v).jobs;
 const el=document.getElementById('cf-role');
 if(el)el.innerHTML=jobs.map(j=>`<option>${esc(j)}</option>`).join('');
}
function saveCandForm(id){
 const name=document.getElementById('cf-n').value.trim();
 if(!name){toast('Nom requis','e');return;}
 const n=now_();
 const data={name,siret:document.getElementById('cof-siret')?.value?.trim()||'',cat:document.getElementById('cf-cat').value,role:document.getElementById('cf-role').value,salary:document.getElementById('cf-sal').value,phone:document.getElementById('cf-ph').value,email:document.getElementById('cf-em').value,source:document.getElementById('cf-src').value,status:document.getElementById('cf-st').value,avail:document.getElementById('cf-av').value,mobility:document.getElementById('cf-mob').value,notes_pre:document.getElementById('cf-npre').value,notes:document.getElementById('cf-notes').value,pepite:document.getElementById('cf-pep').checked,updated:n};
 if(id){const c=cById(id);Object.assign(c,data);}
 else{data.id=uid();data.created=n;data.docs=[];DB.candidates.unshift(data);autoAg(data);}
 save();closeMo();
 if(id&&UI.pid===id)openCandPanel(id);
 if(UI.view==='cands')rCands();else if(UI.view==='dash')rDash();
 badges();toast(id?'Mis à jour ✓':'Candidat ajouté ✓ — précal planifiée','s');
}
function autoAg(c){
 addAgendaAuto({type:'call',title:`Précal — ${c.name}`,date:todayKey(),cand_id:c.id,notes:'Appel de qualification téléphonique à réaliser.',_auto:true});
 save();
}

// ── COMPANY FORM ─────────────────────────────────────────

// ── SIRET Lookup IA ──────────────────────────────────────────────
async function siretLookup(nameFieldId, siretFieldId) {
 const name = document.getElementById(nameFieldId)?.value?.trim();
 if(!name || name.length < 3){ toast('Entrez d\'abord le nom de l\'entreprise','w'); return; }
 const key = getApiKey();
 if(!key){ toast('Clé API Anthropic manquante','e'); return; }
 const btn = event.target;
 if(btn){ btn.disabled=true; btn.textContent='⏳'; }
 try {
  const resp = await fetch('https://api.anthropic.com/v1/messages',{
   method:'POST',
   headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
   body:JSON.stringify({
    model:'claude-sonnet-4-20250514',
    max_tokens:100,
    system:'Tu es un assistant France. Si tu connais le SIRET de cette entreprise française, réponds UNIQUEMENT avec le numéro SIRET (14 chiffres sans espaces). Sinon réponds INCONNU.',
    messages:[{role:'user',content:'SIRET de l\'entreprise : '+name}]
   })
  });
  const data = await resp.json();
  const txt = (data.content?.[0]?.text||'').trim();
  const siret = txt.replace(/\s/g,'').match(/\d{14}/)?.[0];
  if(siret){
   const el = document.getElementById(siretFieldId);
   if(el){ el.value=siret; el.focus(); }
   toast('SIRET trouvé : '+siret,'s');
  } else {
   toast('SIRET non trouvé — à saisir manuellement','w');
  }
 } catch(e){ toast('Erreur IA','e'); }
 finally{ if(btn){btn.disabled=false;btn.textContent='🔍';} }
}


function openCoForm(id=null,ft='prospect'){
 const c=id?coById(id):{};if(!c)return;
 const catOpts=BTP_CATS.map(cat=>`<option value="${cat.id}" ${(c.cat||'go')===cat.id?'selected':''}>${cat.l}</option>`).join('');
 const stOpts=COMP_ST.map(s=>`<option value="${s.id}" ${(c.status||'tocall')===s.id?'selected':''}>${s.l}</option>`).join('');
 openMo(id?'Modifier':ft==='client'?'Nouveau client':'Nouveau prospect',`
 <div class="fg">
 <div class="fgrp ff"><span class="lbl">Raison sociale *</span><input id="cof-n" value="${esc(c.name||'')}"></div>
  <div class="fgrp"><span class="lbl">SIRET <button type="button" class="btn bxs" style="font-size:10px;padding:1px 7px;margin-left:6px;vertical-align:middle" onclick="siretLookup('cof-n','cof-siret')" title="Recherche auto via IA">🔍 Auto</button></span><input id="cof-siret" value="${esc(c.siret||'')}" placeholder="12345678901234" maxlength="14" style="font-family:'DM Mono',monospace"></div>
 <div class="fgrp"><span class="lbl">Nom contact</span><input id="cof-ct" value="${esc(c.contact||'')}"></div>
 <div class="fgrp"><span class="lbl">Fonction</span><input id="cof-ctt" value="${esc(c.ctitle||'')}" placeholder="Gérant / DRH…"></div>
 <div class="fgrp"><span class="lbl">Téléphone</span><input id="cof-ph" value="${esc(c.phone||'')}"></div>
 <div class="fgrp"><span class="lbl">Email</span><input id="cof-em" value="${esc(c.email||'')}"></div>
 <div class="fgrp"><span class="lbl">Ville / Région</span><input id="cof-city" value="${esc(c.city||'')}"></div>
 <div class="fgrp"><span class="lbl">Taille</span><select id="cof-sz"><option value="">—</option><option ${c.size==='tpe'?'selected':''} value="tpe">TPE (&lt;10)</option><option ${c.size==='pme'?'selected':''} value="pme">PME (10–250)</option><option ${c.size==='eti'?'selected':''} value="eti">ETI (250+)</option></select></div>
 <div class="fgrp"><span class="lbl">Secteur BTP</span><select id="cof-cat">${catOpts}</select></div>
 <div class="fgrp"><span class="lbl">Statut pipeline</span><select id="cof-st">${stOpts}</select></div>
 <div class="fgrp"><span class="lbl">Source</span><select id="cof-src"><option>Cold call</option><option>Job board</option><option>LinkedIn</option><option>Réseau</option><option>Contrôle REF</option><option>Recommandation</option></select></div>
 <div class="fgrp"><span class="lbl">Marge estimée (€)</span><input id="cof-marge" type="number" placeholder="6300" value="${esc(c.marge||'')}"></div>
 <div class="fgrp ff"><span class="lbl">Notes</span><textarea id="cof-notes">${esc(c.notes||'')}</textarea></div>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>${id?`<button class="btn bd_" onclick="delCo('${id}')">Supprimer</button>`:''}<button class="btn bp" onclick="saveCoForm('${id||''}','${ft}')">Enregistrer</button>`
);
}
function saveCoForm(id,ft){
 const name=document.getElementById('cof-n').value.trim();
 if(!name){toast('Nom requis','e');return;}
 const n=now_();
 const data={name,contact:document.getElementById('cof-ct').value,ctitle:document.getElementById('cof-ctt').value,phone:document.getElementById('cof-ph').value,email:document.getElementById('cof-em').value,city:document.getElementById('cof-city').value,size:document.getElementById('cof-sz').value,cat:document.getElementById('cof-cat').value,status:document.getElementById('cof-st').value,source:document.getElementById('cof-src').value,notes:document.getElementById('cof-notes').value,marge:document.getElementById('cof-marge')?.value||'',type:ft,updated:n};
 if(id){const c=coById(id);Object.assign(c,data);}
 else{data.id=uid();data.created=n;DB.companies.unshift(data);}
 save();closeMo();
 if(id&&UI.pid===id)openCoPanel(id);
 if(UI.view==='pros')rPros();else if(UI.view==='clients')rClients();else if(UI.view==='dash')rDash();
 badges();toast(id?'Mis à jour ✓':'Ajouté ✓','s');
}
function convertClient(id){
 const c=coById(id);if(!c)return;
 c.type='client';c.status='active';c.contract=true;c.contract_date=now_();c.updated=now_();
 save();openCoPanel(id);badges();
 toast(`${c.name} → Client ✓`,'s');
}

// ── NEED FORM ────────────────────────────────────────────
function openNeedForm(coId=null,id=null){
 const n=id?nById(id):{};if(!n)return;
 const clients=DB.companies.filter(c=>c.type==='client');
 const coOpts=clients.map(c=>`<option value="${c.id}" ${(n.company_id||coId)===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
 const catOpts=BTP_CATS.map(c=>`<option value="${c.id}" ${(n.cat||'go')===c.id?'selected':''}>${c.l}</option>`).join('');
 const NST=[{id:'open',l:'Ouvert'},{id:'sent',l:'CV envoyés'},{id:'interview',l:'Entretiens'},{id:'won',l:'Placé'},{id:'lost',l:'Perdu'}];
 const stOpts=NST.map(s=>`<option value="${s.id}" ${(n.status||'open')===s.id?'selected':''}>${s.l}</option>`).join('');
 const today=todayKey();
 openMo(id?'Modifier besoin':'Nouveau besoin',`
 <div class="fg">
 <div class="fgrp ff"><span class="lbl">Titre du poste *</span><input id="nf-t" value="${esc(n.title||'')}" placeholder="Conducteur de travaux GO"></div>
 <div class="fgrp"><span class="lbl">Client</span><select id="nf-co"><option value="">— Choisir —</option>${coOpts}</select></div>
 <div class="fgrp"><span class="lbl">Catégorie</span><select id="nf-cat">${catOpts}</select></div>
 <div class="fgrp"><span class="lbl">Salaire min (€/an)</span><input id="nf-smin" type="number" value="${n.smin||''}" placeholder="38000"></div>
 <div class="fgrp"><span class="lbl">Salaire max (€/an)</span><input id="nf-smax" type="number" value="${n.smax||''}" placeholder="48000"></div>
 <div class="fgrp"><span class="lbl">Localisation</span><input id="nf-loc" value="${esc(n.location||'')}"></div>
 <div class="fgrp"><span class="lbl">Démarrage</span><input id="nf-st" type="date" value="${n.start?new Date(n.start).toISOString().split('T')[0]:''}"></div>
 <div class="fgrp"><span class="lbl">Urgence</span><select id="nf-urg"><option value="h" ${n.urgency==='h'?'selected':''}>Urgent</option><option value="m" ${(n.urgency||'m')==='m'?'selected':''}>○ Moyen</option><option value="l" ${n.urgency==='l'?'selected':''}>Long terme</option></select></div>
 <div class="fgrp"><span class="lbl">Statut</span><select id="nf-s">${stOpts}</select></div>
 <div class="fgrp ff"><span class="lbl">Notes / Critères</span><textarea id="nf-notes">${esc(n.notes||'')}</textarea></div>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>${id?`<button class="btn bd_" onclick="delNeed('${id}')">Supprimer</button>`:''}<button class="btn bp" onclick="saveNeedForm('${id||''}','${coId||''}')">Enregistrer</button>`
);
}
function saveNeedForm(id,dco){
 const t=document.getElementById('nf-t').value.trim();
 if(!t){toast('Titre requis','e');return;}
 const n=now_();
 const data={title:t,company_id:document.getElementById('nf-co').value||dco,cat:document.getElementById('nf-cat').value,smin:document.getElementById('nf-smin').value,smax:document.getElementById('nf-smax').value,location:document.getElementById('nf-loc').value,start:document.getElementById('nf-st').value||null,urgency:document.getElementById('nf-urg').value,status:document.getElementById('nf-s').value,notes:document.getElementById('nf-notes').value,updated:n};
 if(id){const nd=nById(id);Object.assign(nd,data);}
 else{data.id=uid();data.created=n;DB.needs.unshift(data);}
 save();closeMo();
 if(id&&UI.pid===id)openNeedPanel(id);
 if(UI.view==='needs')rNeeds();else if(UI.view==='dash')rDash();
 badges();toast(id?'Mis à jour ✓':'Besoin ajouté ✓','s');
}

// ── AGENDA FORM ──────────────────────────────────────────
// ── POST FORM ────────────────────────────────────────────
function openPostForm(id=null){
 const p=id?DB.posts.find(x=>x.id===id):{};if(!p)return;
 const catOpts=BTP_CATS.map(c=>`<option value="${c.id}" ${(p.cat||'go')===c.id?'selected':''}>${c.l}</option>`).join('');
 const brdOpts=BOARDS.map(b=>`<label style="display:flex;align-items:center;gap:5px;font-size:11px;text-transform:none;cursor:pointer"><input type="checkbox" value="${b}" ${(p.boards||[]).includes(b)?'checked':''} style="width:11px;accent-color:var(--ac)"> ${b}</label>`).join('');
 openMo(id?'Modifier annonce':'Nouvelle annonce',`
 <div class="fg">
 <div class="fgrp ff"><span class="lbl">Titre *</span><input id="pf-t" value="${esc(p.title||'')}" placeholder="Conducteur de travaux GO — Lyon (H/F)"></div>
 <div class="fgrp"><span class="lbl">Catégorie</span><select id="pf-cat">${catOpts}</select></div>
 <div class="fgrp"><span class="lbl">Localisation</span><input id="pf-loc" value="${esc(p.location||'')}"></div>
 <div class="fgrp ff"><span class="lbl">Salaire affiché</span><input id="pf-sal" value="${esc(p.salary||'')}" placeholder="38 000 – 45 000€ brut/an"></div>
 <div class="fgrp ff"><span class="lbl">Infos pour l'IA (contexte client, spécificités…)</span><input id="pf-brief" value="${esc(p.notes_brief||'')}" placeholder="Ex: client PME lyonnaise, chantiers logements, CDI, véhicule de fonction"></div>
 <div class="fgrp ff">
 <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
 <span class="lbl" style="margin:0">Texte de l'annonce</span>
 ${getApiKey()?`<button id="ai-post-btn" type="button" class="btn bxs" style="background:rgba(154,74,224,.15);color:var(--ac6);border:1px solid rgba(154,74,224,.3)" onclick="aiGeneratePost('${id||'__new__'}')"> Générer avec IA</button>`:`<span class="ai-badge" style="cursor:pointer" onclick="openSettings()"> Configurer IA →</span>`}
 </div>
 <textarea id="pf-body" style="min-height:120px">${esc(p.body||'')}</textarea>
 </div>
 <div class="fgrp ff"><span class="lbl">Publier sur</span><div style="display:flex;flex-direction:column;gap:4px;margin-top:3px" id="brd">${brdOpts}</div></div>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button><button class="btn bp" onclick="savePostForm('${id||''}')">Enregistrer</button>`
);
}
function savePostForm(id){
 const t=document.getElementById('pf-t').value.trim();
 if(!t){toast('Titre requis','e');return;}
 const boards=Array.from(document.querySelectorAll('#brd input:checked')).map(i=>i.value);
 const n=now_();
 const data={title:t,cat:document.getElementById('pf-cat').value,location:document.getElementById('pf-loc').value,salary:document.getElementById('pf-sal').value,body:document.getElementById('pf-body').value,notes_brief:document.getElementById('pf-brief')?.value||'',boards,status:'draft',updated:n};
 if(id){const p=DB.posts.find(x=>x.id===id);Object.assign(p,data);}
 else{data.id=uid();data.created=n;DB.posts.unshift(data);}
 save();closeMo();rPosts();toast(id?'Mis à jour ✓':'Annonce créée ✓','s');
}

// ═══════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════
function setCS(id,st){
 const c=cById(id);if(!c)return;
 const prev=c.status;
 c.status=st;c.updated=now_();
 // KO → planifier email de refus dans 48h
 if(st==='ko' && prev!=='ko'){
  c._ko_email_at=Date.now()+(48*3600*1000);
  c._ko_email_sent=false;
 }
 save();
 if(UI.pid===id)openCandPanel(id);
 rCands();badges();
 toast(`→ ${getCS(st).l}`,'s');
 // Proposer création facture si → Placé
 if(st==='placed'&&prev!=='placed'){
 const existing=(DB.invoices||[]).find(inv=>inv.cand_id===id);
 if(!existing){
 setTimeout(()=>{
 const need=c.linked_need?DB.needs.find(n=>n.id===c.linked_need):null;
 const co=need?coById(need.company_id):null;
 toast(`Créer la facture pour ${c.name} ?`,'i');
 openMo('Facturation — Placement confirmé',`
 <div style="background:rgba(61,224,154,.07);border:1px solid rgba(61,224,154,.2);border-radius:3px;padding:10px 12px;margin-bottom:14px;font-size:11px">
 <strong>${esc(c.name)}</strong> vient d'être placé.${co?` Chez <strong>${esc(co.name)}</strong>.`:''} Créez la facture maintenant.
 </div>
 <div class="fg">
 <div class="fgrp"><span class="lbl">Salaire brut annuel (€)</span><input id="inv-sal" type="number" value="${c.salary||''}" placeholder="45000"></div>
 <div class="fgrp"><span class="lbl">Taux honoraires (%)</span><input id="inv-taux" type="number" value="${getTauxHon()}" step="0.5"></div>
 </div>
 <div id="inv-preview" style="padding:10px 12px;background:var(--s3);border:1px solid var(--bd);border-radius:3px;font-size:13px;text-align:center;margin-top:4px">
 <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:20px;color:var(--ac)">—</span><br>
 <span style="font-size:10px;color:var(--mu)">Montant honoraires</span>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Plus tard</button>
 <button class="btn bp" onclick="createInvoiceFromModal('${id}')">Créer la facture</button>`
);
 // Live preview
 ['inv-sal','inv-taux'].forEach(fid=>{
 const el=document.getElementById(fid);
 if(el)el.oninput=()=>{
 const sal=Number(document.getElementById('inv-sal')?.value||0);
 const taux=Number(document.getElementById('inv-taux')?.value||18);
 const amt=Math.round(sal*taux/100);
 const prev=document.getElementById('inv-preview');
 if(prev)prev.innerHTML=`<span style="font-family:'Syne',sans-serif;font-weight:800;font-size:20px;color:var(--ac)">${fM(amt)}</span><br><span style="font-size:10px;color:var(--mu)">= ${sal.toLocaleString('fr-FR')}€ × ${taux}%</span>`;
 };
 if(el)el.oninput();
 });
 },400);
 }
 }
}
function setCmpS(id,st){const c=coById(id);if(!c)return;c.status=st;c.updated=now_();save();if(UI.pid===id)openCoPanel(id);if(UI.view==='pros')rPros();else if(UI.view==='clients')rClients();badges();toast(`→ ${getCmpS(st).l}`,'s');}
function setNS(id,st){const n=nById(id);if(!n)return;n.status=st;n.updated=now_();save();if(UI.pid===id)openNeedPanel(id);rNeeds();badges();toast(`→ ${st}`,'s');}
function toggleLink(candId,needId){const c=cById(candId);if(!c)return;c.linked_need=c.linked_need===needId?null:needId;c.updated=now_();save();if(UI.pid===candId)openCandPanel(candId);else if(UI.pid===needId)openNeedPanel(needId);rCands();toast(c.linked_need?'Candidat lié ✓':'Lien supprimé','s');}
function linkFromSel(needId){const sel=document.getElementById('nc-sel');if(!sel||!sel.value)return;toggleLink(sel.value,needId);}
function togDoc(id,doc,checked){const c=cById(id);if(!c)return;c.docs=c.docs||[];if(checked&&!c.docs.includes(doc))c.docs.push(doc);else if(!checked)c.docs=c.docs.filter(d=>d!==doc);c.updated=now_();save();rCands();}
function saveIntNote(id){const c=cById(id);if(!c)return;const el=document.getElementById('int-note-'+id);if(!el)return;c.notes_int=el.value;c.int_done=!!el.value;if(el.value)c.int_date=now_();c.updated=now_();save();toast('Synthèse sauvegardée ✓','s');}
function saveGenNote2(id){const c=cById(id);if(!c)return;const el=document.getElementById('gen-note2-'+id);if(!el)return;c.notes=el.value;c.updated=now_();save();toast('Note sauvegardée ✓','s');}
function markIntDone(id){const c=cById(id);if(!c)return;c.int_done=true;c.int_date=now_();c.updated=now_();save();if(UI.pid===id)renderCandPanelTab(id);toast('Entretien marqué fait ✓','s');}

// ═══════════════════════════════════════════════════════════
// COCKPIT D'ENTRETIEN — pop-up unique ouvert depuis l'agenda (clic sur
// l'entretien) ou la fiche candidat. Réunit : le lien visio, le récap
// COMPLET du dossier (identité, situation, compétences, expériences +
// référents) pour repasser sur toutes les infos, et la prise de notes.
// ═══════════════════════════════════════════════════════════
// ── Récap structuré du dossier (réutilisé par le cockpit ET le dossier complet) ──
// Renvoie le bloc HTML identité → expériences, SANS les boutons d'action.
function dossierRecapHtml(c){
 const dd=c._dossier_data||{};
 const pro=dd.pro||{}, adm=dd.admin||{}, comp=dd.competences||{};
 const exps=(dd.experiences&&dd.experiences.length?dd.experiences:(c.experiences||[]));
 const EXPL={moins5:'Moins de 5 ans','5a15':'5 à 15 ans',plus15:'Plus de 15 ans'};
 const UEL={ue:'Ressortissant UE/EEE','non-ue':'Titre de séjour hors UE',fr:'Nationalité française'};
 const permL=pro.permis==='oui'?('Oui'+(pro.permis_detail?' — '+pro.permis_detail:'')):(pro.permis==='non'?'Non':(pro.permis_detail||pro.permis||''));
 const row=(k,v)=>v?`<div class="dr"><span class="drk">${esc(k)}</span><span class="drv">${esc(String(v))}</span></div>`:'';
 const chips=(arr)=>(arr&&arr.length)?arr.map(x=>`<span style="display:inline-block;background:var(--s3);border:1px solid var(--bd2);border-radius:3px;padding:2px 7px;margin:2px 3px 2px 0;font-size:10px">${esc(x)}</span>`).join(''):'';
 const hasComp=(comp.caces&&comp.caces.length)||(comp.electrique&&comp.electrique.length)||(comp.securite&&comp.securite.length)||(comp.logiciels&&comp.logiciels.length)||comp.langues;
 const hasAnyDossier=c._dossier_validated||c._dossier_data||(exps&&exps.length)||pro.poste;
 if(!hasAnyDossier){
  return `<div style="padding:11px 13px;background:rgba(201,137,26,.07);border:1px solid rgba(201,137,26,.2);border-radius:var(--r2);font-size:11px;color:var(--ac4)">Aucune donnée de dossier en ligne — seules les pièces ci-dessus sont disponibles.<br><span style="cursor:pointer;font-weight:700;color:var(--ac4)" onclick="cpText('https://novalem-crm.vercel.app/dossier.html?cid=${c.id}&amp;n=${encodeURIComponent(c.name)}')">Copier le lien du dossier à envoyer</span></div>`;
 }
 return `
   <div class="sl">Identité &amp; contact</div>
   ${row('Nom',c.name)}${row('Téléphone',c.phone)}${row('Email',c.email)}
   <div class="sl mt12">Situation professionnelle</div>
   ${row('Poste',pro.poste||c.role)}
   ${row('Expérience',EXPL[pro.experience]||pro.experience)}
   ${row('Salaire actuel',pro.sal_actuel?pro.sal_actuel+' €/an':'')}
   ${row('Salaire souhaité',pro.sal_souhaite?pro.sal_souhaite+' €/an':(c.salary?c.salary+' €/an':''))}
   ${row('Disponibilité',pro.dispo)}
   ${row('Type de contrat',pro.contrat)}
   ${row('Mobilité',pro.mobilite)}
   ${row('Permis',permL)}
   <div class="sl mt12">Situation administrative</div>
   ${row('Statut',UEL[adm.situation_ue]||adm.situation_ue)}
   ${row('Type de titre',adm.titre_type)}${row('Expiration titre',adm.titre_exp)}${row("Pays d'origine",adm.pays_origine)}
   ${hasComp?`<div class="sl mt12">Compétences</div>`:''}
   ${(comp.caces&&comp.caces.length)?`<div style="margin-bottom:6px"><span class="drk" style="display:block;margin-bottom:3px">CACES</span>${chips(comp.caces)}</div>`:''}
   ${(comp.electrique&&comp.electrique.length)?`<div style="margin-bottom:6px"><span class="drk" style="display:block;margin-bottom:3px">Habilitations élec.</span>${chips(comp.electrique)}</div>`:''}
   ${(comp.securite&&comp.securite.length)?`<div style="margin-bottom:6px"><span class="drk" style="display:block;margin-bottom:3px">Sécurité</span>${chips(comp.securite)}</div>`:''}
   ${(comp.logiciels&&comp.logiciels.length)?`<div style="margin-bottom:6px"><span class="drk" style="display:block;margin-bottom:3px">Logiciels</span>${chips(comp.logiciels)}</div>`:''}
   ${row('Langues',comp.langues)}
   ${(exps&&exps.length)?`<div class="sl mt12">Expériences professionnelles (${exps.length})</div>`+exps.map((e,i)=>`
     <div style="background:var(--s2);border:1px solid var(--bd);border-radius:var(--r2);padding:9px 11px;margin-bottom:7px">
      <div style="font-weight:700;font-size:12px;color:var(--tx)">${i+1}. ${esc(e.societe||'—')}${e.fonction?' — '+esc(e.fonction):''}</div>
      ${(e.contrat||e.periode)?`<div style="font-size:10px;color:var(--mu);margin-top:2px">${[esc(e.contrat||''),esc(e.periode||'')].filter(Boolean).join('  ·  ')}</div>`:''}
      ${e.motif?`<div style="font-size:10px;color:var(--mu);margin-top:2px">Motif de fin : ${esc(e.motif)}</div>`:''}
      ${(e.ref_nom||e.ref_tel)?`<div style="font-size:10px;color:var(--ac5);margin-top:3px">Référent : ${esc([e.ref_nom,e.ref_fonction].filter(Boolean).join(' · '))}${e.ref_tel?` · <a href="tel:${esc(String(e.ref_tel).replace(/\s/g,''))}" style="color:var(--ac5)">${esc(e.ref_tel)}</a>`:''}</div>`:''}
     </div>`).join(''):''}`;
}

// ── DOSSIER DE CANDIDATURE COMPLET (pop-up unique) ────────────────────────
// Vue de revue : toutes les pièces ouvrables d'un clic (👁) + le récap complet.
// ── Suivi de complétion du dossier en ligne (funnel) ─────────────
// Lit c._dossier_tracking {opened_at, last_seen_at, max_step}, alimenté par la
// page dossier.html à chaque étape, et renvoie un statut lisible pour le CRM.
function _agoLabel(ts){
 if(!ts) return '';
 const d=new Date(ts).getTime(); if(isNaN(d)) return '';
 const s=Math.max(0,Math.round((Date.now()-d)/1000));
 if(s<60) return "à l'instant";
 const m=Math.round(s/60); if(m<60) return 'il y a '+m+' min';
 const h=Math.round(m/60); if(h<24) return 'il y a '+h+' h';
 const j=Math.round(h/24); return 'il y a '+j+' j';
}
const DOSSIER_STEP_NAMES={1:'Identité',2:'Poste',3:'Administratif',4:'Compétences',5:'Signature'};
function dossierFunnelStatus(c){
 if(c && c._dossier_validated){
   return { key:'done', icon:'&#x2705;', label:'Dossier complété et signé', sub:(c._dossier_validated_at?fD(c._dossier_validated_at):''), color:'var(--ac2)', bg:'rgba(45,212,160,.08)', border:'rgba(45,212,160,.25)' };
 }
 const t=(c && c._dossier_tracking)||null;
 if(!t || !t.opened_at){
   return { key:'sent', icon:'&#x1f517;', label:'Lien pas encore ouvert', sub:"Le candidat n'a pas encore ouvert le dossier", color:'var(--mu)', bg:'var(--s2)', border:'var(--bd)' };
 }
 const step=t.max_step||1;
 const seen=_agoLabel(t.last_seen_at||t.opened_at);
 if(step>=5){
   return { key:'stuck', icon:'&#x270d;&#xfe0f;', label:'Bloqué à la signature', sub:"A tout rempli mais n'a pas signé · vu "+seen, color:'var(--ac4)', bg:'rgba(201,137,26,.09)', border:'rgba(201,137,26,.3)' };
 }
 if(step>=2){
   return { key:'progress', icon:'&#x270e;', label:'En cours — étape '+step+'/5', sub:(DOSSIER_STEP_NAMES[step]||'')+' · vu '+seen, color:'#3b82c4', bg:'rgba(59,130,196,.09)', border:'rgba(59,130,196,.3)' };
 }
 return { key:'opened', icon:'&#x23f3;', label:'Lien ouvert, pas commencé', sub:'Ouvert '+_agoLabel(t.opened_at), color:'#3b82c4', bg:'rgba(59,130,196,.06)', border:'rgba(59,130,196,.22)' };
}

function openFullDossier(candId){
 const c=cById(candId); if(!c){toast('Candidat introuvable','e');return;}
 const validated=!!c._dossier_validated;
 const _fs=dossierFunnelStatus(c);
 const banner=`<div style="display:flex;align-items:center;gap:9px;padding:11px 13px;background:${_fs.bg};border:1px solid ${_fs.border};border-radius:var(--r2);margin-bottom:14px">
   <span style="font-size:19px">${_fs.icon}</span>
   <div style="flex:1"><div style="font-size:12px;font-weight:700;color:${_fs.color}">${_fs.label}</div>
   <div style="font-size:10px;color:var(--mu)">${_fs.key==='done'?('Réf. '+esc(c._dossier_ref||'—')+' · signé le '+(c._dossier_signed_at?fD(c._dossier_signed_at):(c._dossier_validated_at?fD(c._dossier_validated_at):'—'))):esc(_fs.sub)}</div></div></div>`;

 // Section pièces — chaque pièce présente est ouvrable d'un clic
 const piecesRows=DOCS_LIST.map(d=>{
  const existing=(c.docs||[]).find(x=>x.id===d.id);
  const present=docHasFile(existing);
  const optTag=d.required?'':' <span style="font-size:9px;color:var(--mu2);font-weight:400;background:var(--s3);padding:1px 6px;border-radius:8px;vertical-align:middle">facultatif</span>';
  const emptyLabel=d.required?'Non reçu':'Non fourni — facultatif';
  return `<div style="display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid ${present?'rgba(45,212,160,.25)':'var(--bd)'};background:${present?'rgba(45,212,160,.05)':'var(--s2)'};border-radius:var(--r2);margin-bottom:6px">
    <span style="font-size:17px;width:22px;text-align:center;flex-shrink:0">${d.ico}</span>
    <div style="flex:1;min-width:0">
     <div style="font-size:12px;font-weight:600;color:var(--tx)">${esc(d.l)}${optTag}</div>
     <div style="font-size:10px;color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${present?esc((existing.name||d.l)+(existing.size?' · '+existing.size:''))+' · '+fD(existing.date):emptyLabel}</div>
    </div>
    ${present
      ?`<button class="btn bp bxs" style="flex-shrink:0" onclick="openDocPreview('${c.id}','${d.id}')">👁 Ouvrir</button>`
      :`<label class="file-upload-btn" style="flex-shrink:0">↑ Upload<input type="file" data-docid="${d.id}" data-candid="${c.id}" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style="display:none" onchange="handleFileUpload(event)"></label>`}
   </div>`;
 }).join('');

 const reqDocs=DOCS_LIST.filter(d=>d.required);
 const reqDone=reqDocs.filter(d=>findDoc(c,d.id)).length;
 const optDone=DOCS_LIST.filter(d=>!d.required&&findDoc(c,d.id)).length;
 const allReq=reqDone===reqDocs.length;
 const dossierPdf=findDoc(c,'dossier');
 const piecesBlock=`
  <div class="sl" style="margin-top:0">Pièces du dossier <span style="font-weight:400;color:${allReq?'var(--ac2)':'var(--ac4)'}">${reqDone}/${reqDocs.length} obligatoires${allReq?' ✓':''}</span>${optDone?`<span style="font-weight:400;color:var(--mu2);font-size:10px"> · +${optDone} facultative${optDone>1?'s':''}</span>`:''}</div>
  ${piecesRows}
  ${dossierPdf?`<button class="btn bg btn-full bsm" style="margin-top:4px" onclick="openDocPreview('${c.id}','dossier')">📄 Ouvrir le dossier PDF signé</button>`:''}`;

 const recapBlock=`<div class="sl mt12" style="border-top:1px solid var(--bd);padding-top:12px">Informations du dossier</div>`+dossierRecapHtml(c);

 openMo(`Dossier complet — ${c.name}`, banner+piecesBlock+recapBlock,
  `<button class="btn bg" onclick="closeMo()">Fermer</button>
   ${(c.int_date_planned||c.visio_link)?`<button class="btn bg" onclick="closeMo();openInterviewModal('${c.id}')">🎥 Cockpit entretien</button>`:''}
   <button class="btn bp" onclick="closeMo();openCandPanel('${c.id}');setTimeout(()=>setCPTab(1,'${c.id}'),140)">📎 Gérer les pièces</button>`);
}

function openInterviewModal(candId){
 const c=cById(candId); if(!c){toast('Candidat introuvable','e');return;}
 const link=c.visio_link||'';
 const when=c.int_date_planned?`${fD(c.int_date_planned)}${c.int_time?' à '+c.int_time:''}`:'Non planifié';

 const visioBlock=`
  <div style="background:rgba(61,224,154,.07);border:1px solid rgba(61,224,154,.25);border-radius:var(--r2);padding:12px 13px;margin-bottom:14px">
   <div style="font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--mu2);margin-bottom:8px">Entretien visio · ${esc(when)}</div>
   ${link?`<a href="${esc(link)}" target="_blank" class="btn bp btn-full" style="text-decoration:none;margin-bottom:7px">🎥 Rejoindre la visio</a>
   <div style="display:flex;gap:6px;align-items:center"><div style="flex:1;font-size:10px;color:var(--mu);font-family:'DM Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(link)}</div><button class="btn bg bxs" onclick="cpText('${esc(link)}')">Copier</button></div>`
   :`<div style="font-size:11px;color:var(--ac4)">Aucun lien visio. <span style="color:var(--blue);cursor:pointer" onclick="closeMo();openCalendarMo('${c.id}')">Planifier l'entretien →</span></div>`}
  </div>`;

 let dossierBlock='';
 if(c._dossier_validated){
  dossierBlock=dossierRecapHtml(c)+`
   <div style="margin-top:8px;display:flex;gap:6px"><button class="btn bp bsm" style="flex:1" onclick="closeMo();openFullDossier('${c.id}')">📂 Dossier complet</button><button class="btn bg bsm" style="flex:1" onclick="closeMo();openCandPanel('${c.id}');setTimeout(()=>setCPTab(1,'${c.id}'),140)">📎 Voir les pièces</button></div>`;
 } else {
  dossierBlock=`<div style="padding:11px 13px;background:rgba(201,137,26,.07);border:1px solid rgba(201,137,26,.2);border-radius:var(--r2);font-size:11px;color:var(--ac4)">
    Dossier non encore reçu — le récap s'affichera ici une fois le dossier signé.<br>
    <span style="cursor:pointer;font-weight:700;color:var(--ac4)" onclick="cpText('https://novalem-crm.vercel.app/dossier.html?cid=${c.id}&amp;n=${encodeURIComponent(c.name)}')">Copier le lien du dossier</span></div>`;
 }

 const notesBlock=`
  <div class="sl mt12">Notes d'entretien</div>
  <textarea id="intc-note-${c.id}" style="min-height:120px;width:100%;margin-bottom:4px" placeholder="Validation des infos du dossier, ressenti, points à creuser, détails des expériences passées…">${esc(c.notes_int||'')}</textarea>`;

 openMo(`Entretien — ${c.name}`, visioBlock+dossierBlock+notesBlock,
  `<button class="btn bg" onclick="closeMo()">Fermer</button>
   <button class="btn bg" onclick="markIntDoneFromModal('${c.id}')">✓ Entretien fait</button>
   <button class="btn bp" onclick="saveInterviewNote('${c.id}')">💾 Enregistrer</button>`);
}
function saveInterviewNote(candId){
 const c=cById(candId); if(!c)return;
 const el=document.getElementById('intc-note-'+candId); if(!el)return;
 c.notes_int=el.value; if(el.value){c.int_done=true; c.int_date=c.int_date||now_();}
 c.updated=now_(); save();
 if(UI.pid===candId&&UI.ptype==='cand')renderCandPanelTab(candId);
 toast("Notes d'entretien enregistrées ✓",'s');
}
function markIntDoneFromModal(candId){
 const c=cById(candId); if(!c)return;
 const el=document.getElementById('intc-note-'+candId); if(el)c.notes_int=el.value;
 c.int_done=true; c.int_date=now_(); c.updated=now_();
 save(); badges();
 if(UI.pid===candId&&UI.ptype==='cand')renderCandPanelTab(candId);
 toast('Entretien marqué fait ✓','s');
}
function openStatusTree(id){openStatusMo('cand',id);}
function toggleNeedLink(candId,needId){const c=cById(candId);if(!c)return;c.linked_need=c.linked_need===needId?null:needId;c.updated=now_();save();if(UI.pid===candId)renderCandPanelTab(candId);toast(c.linked_need?'Besoin lié ✓':'Lien retiré','s');}
function saveGNote(id){const c=cById(id);if(!c)return;const el=document.getElementById('gnote-'+id);if(!el)return;c.notes=el.value;c.updated=now_();save();toast('Note sauvegardée ✓','s');}
// Alias — lit gen-note-{id} ou gnote-{id} selon le panel
function saveGenNote(id){const c=cById(id);if(!c)return;const el=document.getElementById('gen-note-'+id)||document.getElementById('gnote-'+id);if(!el)return;c.notes=el.value;c.updated=now_();save();toast('Note sauvegardée ✓','s');}
function saveCoNote(id){const c=coById(id);if(!c)return;const el=document.getElementById('conote-'+id);if(!el)return;c.notes=el.value;c.updated=now_();save();toast('Note sauvegardée ✓','s');}
function addRef(id){openMo('Ajouter référence',`<div class="fg"><div class="fgrp ff"><span class="lbl">Entreprise</span><input id="rf-co" placeholder="Nom entreprise"></div><div class="fgrp"><span class="lbl">Contact</span><input id="rf-ct"></div><div class="fgrp"><span class="lbl">Téléphone</span><input id="rf-ph"></div></div>`,`<button class="btn bg" onclick="closeMo()">Annuler</button><button class="btn bp" onclick="saveRef('${id}')">Ajouter</button>`);}
function saveRef(id){const c=cById(id);if(!c)return;const co=document.getElementById('rf-co').value.trim();if(!co)return;c.refs=c.refs||[];c.refs.push({company:co,contact:document.getElementById('rf-ct').value,phone:document.getElementById('rf-ph').value,done:false,note:''});c.updated=now_();save();closeMo();openCandPanel(id);toast('Référence ajoutée ✓','s');}
function rmRef(id,i){const c=cById(id);if(!c||!c.refs)return;c.refs.splice(i,1);c.updated=now_();save();openCandPanel(id);}
function togRef(id,i){const c=cById(id);if(!c||!c.refs||!c.refs[i])return;c.refs[i].done=!c.refs[i].done;c.updated=now_();save();openCandPanel(id);toast(c.refs[i].done?'Contrôle fait ✓':'Remis en attente','s');}
// Saisir / éditer le compte-rendu du contrôle de référence (ce que dit le référent)
function noteRef(id,i){
 const c=cById(id);if(!c||!c.refs||!c.refs[i])return;const r=c.refs[i];
 openMo('Contrôle de référence',`
  <div style="font-size:12px;font-weight:700;margin-bottom:2px">${esc(r.company||'Référent')}</div>
  <div class="fs10 mu_" style="margin-bottom:10px">${esc(r.contact||'')}${r.phone?' · '+esc(fPhone(r.phone)):''}</div>
  <div class="fgrp"><span class="lbl">Compte-rendu de l'appel</span>
  <textarea id="rf-note" style="min-height:110px" placeholder="Ce que dit le référent : tenue du poste, ponctualité, savoir-être, motif de départ confirmé, recommande ou non…">${esc(r.note||'')}</textarea></div>`,
  `<button class="btn bg" onclick="closeMo()">Annuler</button><button class="btn bp" onclick="saveRefNote('${id}',${i})">✓ Enregistrer (marque fait)</button>`);
}
function saveRefNote(id,i){
 const c=cById(id);if(!c||!c.refs||!c.refs[i])return;
 const el=document.getElementById('rf-note');if(!el)return;
 c.refs[i].note=el.value.trim();c.refs[i].done=true;c.updated=now_();save();closeMo();openCandPanel(id);
 toast('Contrôle de référence enregistré ✓','s');
}
function prosFromRef(id,i){const c=cById(id);if(!c||!c.refs||!c.refs[i])return;const r=c.refs[i];closePanel();openCoForm();setTimeout(()=>{const n=document.getElementById('cof-n');if(n)n.value=r.company;const ph=document.getElementById('cof-ph');if(ph)ph.value=r.phone||'';const src=document.getElementById('cof-src');if(src)src.value='Contrôle REF';},80);}
function cpPhone(ph){navigator.clipboard.writeText(ph).then(()=>toast(`${ph} copié`,'i')).catch(()=>toast(ph,'i'));}

// ═══════════════════════════════════════════════════════════════════════
// ENVOI PROFIL ANONYME — Processus complet
// 1. openSendProfileModal(candId)  → choisir entreprises cibles
// 2. generateAnonCV(cand)          → IA anonymise + met en page Novalem
// 3. sendProfileEmail(candId,coId) → envoie le mail adapté (besoin ou CVthèque)
// 4. computeAlerts()               → relances J+3 dans le dashboard
// ═══════════════════════════════════════════════════════════════════════

// ── 1. MODAL CHOIX ENTREPRISE ──────────────────────────────────────────
function openSendProfileModal(candId) {
 const cand = cById(candId); if(!cand) return;
 const cat  = cand.cat;
 const now  = Date.now();
 const week = 7*24*3600*1000;

 // Entreprises avec besoin ouvert dans la même catégorie
 const withNeed = DB.needs
  .filter(n => n.status==='open' && n.cat===cat)
  .map(n => {
   const co = coById(n.company_id);
   if(!co) return null;
   const lastSent = co._last_cv_sent_at;
   const sentThisWeek = lastSent && (now - new Date(lastSent).getTime()) < week;
   const count = co._cv_sent_count||0;
   return { co, need:n, sentThisWeek, count, lastSent };
  }).filter(Boolean);

 // Entreprises CVthèque qui acceptent cette catégorie
 const cvtheque = DB.companies
  .filter(co => co._accept_cv && (co._accept_cv_cats||[]).includes(cat) && co.email)
  .filter(co => !withNeed.find(x=>x.co.id===co.id)) // pas en double
  .map(co => {
   const lastSent = co._last_cv_sent_at;
   const sentThisWeek = lastSent && (now - new Date(lastSent).getTime()) < week;
   return { co, need:null, sentThisWeek, lastSent };
  });

 const total = withNeed.length + cvtheque.length;

 const rowHtml = (item, type) => {
  const co = item.co;
  const isRed = item.sentThisWeek;
  const daysSince = item.lastSent ? Math.floor((now - new Date(item.lastSent).getTime())/86400000) : null;
  const tagLabel = type==='need'
   ? `<span style="font-size:9px;padding:2px 7px;background:rgba(61,224,154,.1);border:1px solid rgba(61,224,154,.25);border-radius:10px;color:var(--ac2)">Besoin : ${item.need.title}</span>`
   : `<span style="font-size:9px;padding:2px 7px;background:rgba(201,137,26,.1);border:1px solid rgba(201,137,26,.25);border-radius:10px;color:var(--ac4)">CVthèque</span>`;
  const warningLabel = isRed
   ? `<span style="font-size:9px;padding:2px 7px;background:rgba(240,75,75,.1);color:var(--ac3);border-radius:10px;font-weight:700">⚠ Envoyé il y a ${daysSince}j</span>`
   : '';
  const hasContract = !!(co._contract_signed || co.contract);

  return `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${isRed?'rgba(240,75,75,.3)':'var(--bd)'};border-radius:var(--r2);cursor:pointer;margin-bottom:6px;background:${isRed?'rgba(240,75,75,.04)':'var(--s2)'}">
   <input type="checkbox" value="${co.id}|${type}|${item.need?.id||''}" style="accent-color:var(--ac);width:15px;height:15px;flex-shrink:0" ${isRed?'':''}> 
   <div style="flex:1;min-width:0">
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
     <span style="font-weight:700;font-size:12px">${esc(co.name)}</span>
     ${hasContract ? '<span style="font-size:9px;color:var(--ac2)">✓ Contrat signé</span>' : ''}
     ${tagLabel}
     ${warningLabel}
    </div>
    <div style="font-size:10px;color:var(--mu)">${esc(co.contact||'—')} · ${esc(co.city||'—')} · ${esc(co.email||'—')}</div>
   </div>
  </label>`;
 };

 const listHtml = [
  withNeed.length ? `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px;margin-top:4px">Entreprises avec besoin ouvert</div>` + withNeed.map(x=>rowHtml(x,'need')).join('') : '',
  cvtheque.length ? `<div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px;margin-top:12px">CVthèque — acceptent des profils ${getCat(cat).l}</div>` + cvtheque.map(x=>rowHtml(x,'cv')).join('') : '',
 ].join('');

 const _comp=presentationCompleteness(cand);
 const compBanner=`<div style="margin-bottom:12px;padding:9px 12px;background:${_comp.missing.length?'rgba(201,137,26,.07)':'rgba(45,212,160,.08)'};border:1px solid ${_comp.missing.length?'rgba(201,137,26,.25)':'rgba(45,212,160,.25)'};border-radius:var(--r2);font-size:10.5px;line-height:1.6">
  <div style="font-weight:700;margin-bottom:3px;color:${_comp.missing.length?'var(--ac4)':'var(--ac2)'}">${_comp.missing.length?'⚠ Éléments utilisés pour la présentation':'✓ Profil complet pour la présentation'}</div>
  ${_comp.has.length?`<div style="color:var(--ac2)">Disponible : ${_comp.has.join(', ')}</div>`:''}
  ${_comp.missing.length?`<div style="color:var(--ac4)">Manquant : ${_comp.missing.join(', ')}</div>`:''}
 </div>`;
 openMo(`📤 Envoyer le profil — ${esc(cand.name)}`,
  `<div style="margin-bottom:12px;padding:10px 12px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);font-size:11px">
    <strong>${esc(cand.name)}</strong> · ${esc(cand.role||getCat(cat).l)} · ${cand.salary?fM(cand.salary)+'€/an':''} · Dispo : ${esc(cand.avail||'—')} · ${esc(cand.mobility||'—')}
   </div>
   ${compBanner}
   ${total ? `<div style="max-height:55vh;overflow-y:auto">${listHtml}</div>` : `<div style="text-align:center;padding:30px;color:var(--mu2);font-size:11px">Aucune entreprise disponible pour cette catégorie.<br>Ajoutez des entreprises dans la CVthèque ou créez des besoins.</div>`}
   <div style="margin-top:10px;padding:8px 12px;background:rgba(201,137,26,.07);border-radius:var(--r2);font-size:10px;color:var(--ac4)">
    ⚠ Les entreprises en rouge ont déjà reçu un profil cette semaine. Évitez d'en envoyer plus de 2 par semaine par entreprise.
   </div>`,
  `<button class="btn bg" onclick="closeMo()">Annuler</button>
   <button class="btn bp" onclick="confirmSendProfiles('${candId}')">📤 Générer et envoyer</button>`
 );
}

// ── 2. CONFIRMATION + GÉNÉRATION IA ───────────────────────────────────
async function confirmSendProfiles(candId) {
 const selected = [...document.querySelectorAll('#mo-body input[type="checkbox"]:checked')]
  .map(el => {
   const [coId, type, needId] = el.value.split('|');
   return { coId, type, needId: needId||null };
  });

 if(!selected.length){ toast('Sélectionnez au moins une entreprise','w'); return;}

 const cand = cById(candId); if(!cand) return;
 const key = getApiKey();
 if(!key){ toast('Clé API Anthropic manquante — Paramètres','e'); return; }

 closeMo();
 toast('Génération du CV anonymisé en cours…','i');

 // Générer le CV anonymisé via IA
 let anonCVText = null;
 try {
  anonCVText = await generateAnonCVText(cand, key);
 } catch(e) {
  toast('Erreur IA : '+e.message,'e');
  return;
 }

 // Générer le PDF anonymisé
 let pdfB64 = null;
 try {
  pdfB64 = generateAnonCVPDF(cand, anonCVText);
 } catch(e) {
  console.warn('PDF generation error:', e);
 }

 // Envoyer à chaque entreprise sélectionnée
 let sent = 0, lastErr = null;
 for(const item of selected) {
  const co = coById(item.coId);
  const need = item.needId ? DB.needs.find(n=>n.id===item.needId) : null;
  if(!co || !co.email) { lastErr = lastErr || `${co?co.name:'Entreprise'} n'a pas d'email enregistré`; continue; }

  const hasContract = !!(co._contract_signed || co.contract);
  let ok = false;
  try { ok = await sendProfileEmailToCompany(cand, co, need, hasContract, pdfB64, key); }
  catch(e){ lastErr = e.message; }
  if(ok) {
   sent++;
   // Mettre à jour compteurs
   co._last_cv_sent_at = new Date().toISOString();
   co._cv_sent_count = (co._cv_sent_count||0) + 1;
   // Changer statut candidat
   if(cand.status !== 'placed') {
    cand.status = 'presented';
    cand.updated = now_();
   }
   // Timeline
   addTimeline(co.id, 'profile_sent',
    `Profil envoyé : ${cand.name} (${cand.role||getCat(cand.cat).l})${need?' → Besoin : '+need.title:''}`,
    null
   );
   // Relance J+3 ouvrés — date normalisée + contexte
   addAgendaAuto({
    type:'relance',
    title:`Rappeler ${co.name} — réception CV ${cand.name}`,
    date: localDateStr(addWorkingDays(new Date(),3)),
    time:'09:00',
    cand_id: candId,
    comp_id: item.coId,
    notes:`Profil de ${cand.name} envoyé le ${fD(todayKey())}. Vérifier la bonne réception et relancer pour un retour.`,
    _profile_followup:true,
    _auto:true
   });
  }
 }

 save();
 rCands();
 badges();
 if(UI.view==='dash') rDash();

 if(sent > 0) {
  toast(`✅ Profil envoyé à ${sent} entreprise(s) — relance J+3 planifiée`,'s');
 } else {
  toast('Échec de l\'envoi : ' + (lastErr || 'vérifiez la configuration email et les adresses'),'e');
 }
}

// ── Brief candidat complet (dossier + CV + notes + références) pour l'IA ──
function buildCandidateBrief(cand){
 const cv = cand.cv_extracted || {};
 const dd = cand._dossier_data || {};
 const p=[];
 p.push(`Spécialité BTP : ${getCat(cand.cat).l}`);
 p.push(`Poste visé : ${cand.role || cv.poste_cible || getCat(cand.cat).l}`);
 if(cand.salary||cv.salaire_actuel) p.push(`Prétention salariale (brut annuel) : ${cand.salary||cv.salaire_actuel} €`);
 if(cand.avail||cv.disponibilite) p.push(`Disponibilité : ${cand.avail||cv.disponibilite}`);
 if(cand.mobility||cv.mobilite) p.push(`Mobilité : ${cand.mobility||cv.mobilite}`);
 if(cv.experience_annees) p.push(`Expérience : ${cv.experience_annees} ans`);
 if(cv.poste_actuel) p.push(`Poste actuel : ${cv.poste_actuel}`);
 if(cv.notes_synthese) p.push(`Synthèse CV : ${cv.notes_synthese}`);
 if(dd && Object.keys(dd).length) p.push(`Dossier de candidature (structuré) : ${JSON.stringify({pro:dd.pro,admin:dd.admin,competences:dd.competences})}`);
 const exps=(dd.experiences&&dd.experiences.length)?dd.experiences:(cand.experiences||[]);
 if(exps&&exps.length) p.push(`Expériences : ${JSON.stringify(exps.slice(0,10))}`);
 if(cand.notes_pre) p.push(`Notes pré-qualification : ${cand.notes_pre}`);
 if(cand.notes_int) p.push(`Notes d'entretien : ${cand.notes_int}`);
 if(cand.notes) p.push(`Notes générales : ${cand.notes}`);
 const refDone=(cand.refs||[]).filter(r=>r.done&&(r.note||r.contact));
 if(refDone.length) p.push(`Contrôle de référence EFFECTUÉ : ${refDone.map(r=>(r.contact||'ancien employeur')+' — '+(r.note||'retour positif')).join(' ; ')}`);
 return p.join('\n');
}

// ── Contrôle de complétude : ce qu'on a / ce qui manque pour présenter ──
function presentationCompleteness(cand){
 const cv=cand.cv_extracted||{};
 const has=[], missing=[];
 ((cand.docs||[]).some(d=>d.id==='cv'&&(d.file||d.storage_path||d.url))?has:missing).push('CV');
 (cand._dossier_validated?has:missing).push('Dossier de candidature');
 (cand.notes_int?has:missing).push("Notes d'entretien");
 ((cand.refs||[]).some(r=>r.done)?has:missing).push('Contrôle de référence');
 ((cand.salary||cv.salaire_actuel)?has:missing).push('Prétention salariale');
 return {has, missing};
}

// ── Email de présentation généré par l'IA, adapté au besoin entreprise ──
async function generateTailoredEmail(cand, co, need, key){
 if(!key) throw new Error('Clé API manquante');
 const userName = localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||'Louis RENAULT';
 const userPhone = localStorage.getItem(uKey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'';
 const prenomCo = greetCo(co)||'';
 const prenomCand = greetCand(cand)||'le candidat';
 const besoin = need ? `${need.title}${need.description?(' — '+need.description):''}` : (co._cv_need_note||'non précisé');
 const sys = `Tu es ${userName}, recruteur chez NOVALEM (recrutement BTP, placements CDI). Tu rédiges le corps d'un email présentant un candidat à une entreprise.
RÈGLES ABSOLUES :
- AUCUN MENSONGE. N'invente aucune compétence, expérience ni certification. Utilise UNIQUEMENT les informations fournies sur le candidat.
- Si un besoin entreprise est fourni, mets subtilement en avant, SANS mentir, les compétences RÉELLES du candidat qui correspondent à ce besoin (ex : "au niveau de votre besoin de quelqu'un qui maîtrise le QSE, [prénom] a justement... via telle expérience").
- Présente le candidat par son PRÉNOM uniquement.
STRUCTURE EXACTE du corps :
1. "Bonjour${prenomCo?' '+prenomCo:' Madame, Monsieur'}," puis "J'espère que vous allez bien."
2. Une phrase de contexte ("Comme convenu par téléphone" ou "Suite à votre besoin de ...").
3. 2 à 3 phrases MAXIMUM sur ce qui fait la FORCE / les points différenciants du profil.
4. Une liste de 8 points MAXIMUM (chaque ligne commence par "- ") des principales choses qu'il a faites et sait faire, concis, sans répéter l'accroche. Les DERNIÈRES puces, dans cet ordre, sont : la prétention salariale (brut annuel), le permis (Oui/Non), les langues. N'ajoute permis/langues que si l'info est disponible.
5. Si un contrôle de référence a été EFFECTUÉ, ajoute APRÈS la liste UNE seule phrase du type "En contactant ses anciens employeurs, je n'ai eu que de bons retours, notamment sur ...".
6. Une phrase de clôture invitant à le contacter, puis la signature :
${userName}${userPhone?'\n'+userPhone:''}\nNovalem — Recrutement BTP\ncontact@novalem-recrutement.fr
- Ton professionnel, direct, chaleureux mais sobre. Pas d'emojis, pas de gras markdown. Réponds UNIQUEMENT par le corps de l'email (texte brut + puces "- ").`;
 const user = `ENTREPRISE CIBLE : ${co.name||''}${co.city?(' ('+co.city+')'):''}\nCONTACT : ${co.contact||'inconnu'}\nBESOIN DE L'ENTREPRISE : ${besoin}\nPRÉNOM DU CANDIDAT À UTILISER : ${prenomCand}\n\nDONNÉES DU CANDIDAT :\n${buildCandidateBrief(cand)}`;
 const resp = await fetch('https://api.anthropic.com/v1/messages', {
  method:'POST',
  headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
  body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, system:sys, messages:[{role:'user',content:user}] })
 });
 if(!resp.ok){ const e=await resp.json().catch(()=>({})); throw new Error(e.error?.message||('HTTP '+resp.status)); }
 const data = await resp.json();
 const txt = (data.content||[]).find(b=>b.type==='text')?.text || '';
 return txt.trim();
}

// ── 3. GÉNÉRATION CV ANONYMISÉ (texte via IA) ─────────────────────────
async function generateAnonCVText(cand, key) {
 const profile = buildCandidateBrief(cand);

 const resp = await fetch('https://api.anthropic.com/v1/messages', {
  method:'POST',
  headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
  body: JSON.stringify({
   model:'claude-sonnet-4-20250514',
   max_tokens:1200,
   system:`Tu es expert en recrutement BTP. Génère un CV anonyme professionnel. 
RÈGLES STRICTES :
- Aucun nom de personne, aucune coordonnée (email/téléphone)
- Aucune entreprise sauf les très grands groupes (Vinci, Bouygues, Eiffage, GTM, SPIE, Colas, NGE, Fayat)
- Reformuler les expériences pour qu'elles ne soient pas retrouvables sur Google
- Conserver 100% des compétences, certifications et réalisations
- Ton professionnel, phrases courtes et percutantes
- Format JSON strict sans markdown :
{
 "titre": "Intitulé du poste",
 "accroche": "2-3 phrases percutantes sur le profil",
 "experiences": [{"periode":"","poste":"","contexte":"","realisations":["",""]}],
 "competences": ["",""],
 "formations_certs": ["",""],
 "points_forts": ["","",""]
}`,
   messages:[{role:'user', content:'Profil à anonymiser :\n'+profile}]
  })
 });

 const data = await resp.json();
 const txt = data.content?.find(b=>b.type==='text')?.text || '';
 let parsed = null;
 try { parsed = JSON.parse(txt.replace(/```json|```/g,'').trim()); }
 catch(e) {
  const m = txt.match(/\{[\s\S]*\}/);
  if(m) try { parsed = JSON.parse(m[0]); } catch(e2){}
 }
 if(!parsed) throw new Error('Réponse IA invalide');
 return parsed;
}

// ── 4. GÉNÉRATION PDF CV ANONYME (couleurs Novalem) ───────────────────
function generateAnonCVPDF(cand, anonCV) {
 const jsPDFLib = window.jspdf;
 if(!jsPDFLib) return null;
 const doc = new jsPDFLib.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 const W=210,H=297,ML=18,MR=18,MT=14,CW=174;
 // Palette Novalem : fond blanc/gris, accent orange, texte sombre, zéro bleu
 const C = { n:[26,22,20], o:[201,137,26], g:[100,95,90], f:[245,243,239], l:[232,228,220], w:[255,255,255] };

 function sf(s,sz){doc.setFont('helvetica',s);doc.setFontSize(sz);}
 function tc(){doc.setTextColor.apply(doc,arguments);}
 function fc(){doc.setFillColor.apply(doc,arguments);}
 function dc(){doc.setDrawColor.apply(doc,arguments);}
 function wt(t,x,y,o){doc.text(t,x,y,o||{});}
 function wrap(txt,w){return doc.splitTextToSize(txt,w);}

 let y=MT;

 // ── Header bande noire ───────────────────────────────────────────────
 fc(...C.n);doc.rect(0,0,W,32,'F');
 // Logo Novalem (petit, discret)
 sf('bold',8);tc(255,255,255,0.4);
 doc.setTextColor(180,170,160);
 wt('PRÉSENTÉ PAR',W-MR,10,{align:'right'});
 sf('bold',11);tc(...C.o);wt('NOVALEM',W-MR,17,{align:'right'});
 sf('normal',7);doc.setTextColor(130,125,120);wt('Recrutement BTP · CDI',W-MR,22,{align:'right'});

 // Titre poste
 sf('bold',18);tc(255,255,255);
 wt(anonCV.titre||cand.role||'Profil BTP',ML,14);
 sf('normal',9);tc(...C.o);wt(getCat(cand.cat).l,ML,21);

 // Infos clés : dispo / salaire / mobilité
 const kv = [
  cand.avail ? ['Dispo', cand.avail] : null,
  cand.salary ? ['Prétentions', fM(cand.salary)+' €/an'] : null,
  cand.mobility ? ['Mobilité', cand.mobility] : null,
 ].filter(Boolean);
 let kx = ML;
 sf('normal',8);
 kv.forEach(([k,v])=>{
  doc.setTextColor(160,150,140);wt(k+' : ',kx,28);
  const kw=doc.getTextWidth(k+' : ');
  tc(...C.o);wt(v,kx+kw,28);
  kx+=kw+doc.getTextWidth(v)+12;
 });

 y=40;

 // ── Accroche ─────────────────────────────────────────────────────────
 if(anonCV.accroche){
  fc(...C.f);doc.roundedRect(ML,y,CW,16,2,2,'F');
  sf('normal',9);tc(...C.g);
  const lines=wrap(anonCV.accroche,CW-10);
  wt(lines,ML+5,y+5);
  y+=20;
 }

 // ── Points forts ──────────────────────────────────────────────────────
 if(anonCV.points_forts?.length){
  sf('bold',9);tc(...C.o);wt('POINTS FORTS',ML,y);y+=2;
  dc(...C.o);doc.setLineWidth(0.5);doc.line(ML,y,ML+35,y);y+=4;
  const pts=anonCV.points_forts.slice(0,3);
  const colW=(CW-8)/pts.length;
  pts.forEach((pt,i)=>{
   fc(...C.f);doc.roundedRect(ML+i*(colW+4),y,colW,14,2,2,'F');
   sf('bold',8);tc(...C.n);
   const wrapped=wrap(pt,colW-6);
   wt(wrapped,ML+i*(colW+4)+3,y+4);
  });
  y+=20;
 }

 // ── Expériences ───────────────────────────────────────────────────────
 if(anonCV.experiences?.length){
  sf('bold',9);tc(...C.o);wt('EXPÉRIENCES PROFESSIONNELLES',ML,y);y+=2;
  dc(...C.o);doc.setLineWidth(0.5);doc.line(ML,y,ML+70,y);y+=5;

  anonCV.experiences.forEach(exp=>{
   if(y>H-50){doc.addPage();y=MT;}
   // Période + poste
   sf('bold',9.5);tc(...C.n);wt((exp.poste||''),ML,y);
   sf('normal',8.5);tc(...C.g);
   const pw=doc.getTextWidth(exp.poste||'');
   if(exp.periode) wt('  '+exp.periode,ML+pw+2,y);
   y+=5;
   // Contexte
   if(exp.contexte){
    sf('normal',8);tc(...C.g);
    const cl=wrap(exp.contexte,CW);
    wt(cl,ML,y);
    y+=cl.length*3.8+2;
   }
   // Réalisations
   (exp.realisations||[]).forEach(r=>{
    if(y>H-20){doc.addPage();y=MT;}
    sf('normal',8.5);tc(...C.n);
    const rl=wrap('› '+r,CW-5);
    wt(rl,ML+3,y);
    y+=rl.length*3.8+1;
   });
   y+=3;
  });
 }

 // ── Compétences ───────────────────────────────────────────────────────
 if(anonCV.competences?.length){
  if(y>H-40){doc.addPage();y=MT;}
  sf('bold',9);tc(...C.o);wt('COMPÉTENCES TECHNIQUES',ML,y);y+=2;
  dc(...C.o);doc.setLineWidth(0.5);doc.line(ML,y,ML+55,y);y+=5;
  const comps=anonCV.competences;
  const cols=2;const cw2=(CW-6)/cols;
  for(let i=0;i<comps.length;i+=cols){
   for(let j=0;j<cols&&i+j<comps.length;j++){
    sf('normal',8.5);tc(...C.n);
    wt('· '+comps[i+j],ML+j*(cw2+6),y);
   }
   y+=4.5;
  }
  y+=4;
 }

 // ── Formations / Certifications ───────────────────────────────────────
 if(anonCV.formations_certs?.length){
  if(y>H-30){doc.addPage();y=MT;}
  sf('bold',9);tc(...C.o);wt('FORMATIONS & CERTIFICATIONS',ML,y);y+=2;
  dc(...C.o);doc.setLineWidth(0.5);doc.line(ML,y,ML+60,y);y+=5;
  anonCV.formations_certs.forEach(f=>{
   sf('normal',8.5);tc(...C.n);wt('· '+f,ML,y);y+=4.5;
  });
 }

 // ── Footer ────────────────────────────────────────────────────────────
 const np=doc.getNumberOfPages();
 for(let p=1;p<=np;p++){
  doc.setPage(p);
  fc(...C.n);doc.rect(0,H-10,W,10,'F');
  sf('normal',6.5);tc(180,170,160);
  wt('NOVALEM · Cabinet de recrutement BTP · contact@novalem-recrutement.fr · Ce document est confidentiel',ML,H-4);
  wt(p+'/'+np,W-MR,H-4,{align:'right'});
 }

 return doc.output('datauristring').split(',')[1];
}

// ── 5. ENVOI EMAIL ADAPTÉ ─────────────────────────────────────────────
async function sendProfileEmailToCompany(cand, co, need, hasContract, pdfB64, key) {
 const apiBase = getApiBase();
 if(!apiBase) throw new Error("Envoi indisponible : vous consultez le CRM en local. Ouvrez-le depuis votre adresse en ligne (Vercel) pour envoyer.");

 const userName = localStorage.getItem(uKey('btp_user_name'))||'Louis RENAULT';
 const userPhone = localStorage.getItem(uKey('btp_user_tel'))||'06 58 21 20 96';
 const prenom = greetCo(co);

 // Infos profil visibles
 const infoLines = [
  `**Poste :** ${cand.role||getCat(cand.cat).l}`,
  cand.avail  ? `**Disponibilité :** ${cand.avail}` : null,
  cand.salary ? `**Prétentions :** ${fM(cand.salary)} €/an` : null,
  cand.mobility ? `**Mobilité :** ${cand.mobility}` : null,
  (cand.notes_pre||'').includes('permis') || (cand.notes||'').includes('permis') ? '**Permis B :** Oui' : null,
 ].filter(Boolean).join('\n');

 // Sujet
 let subject = need
  ? `Profil ${cand.role||getCat(cand.cat).l} — pour votre besoin ${need.title}`
  : `Profil ${cand.role||getCat(cand.cat).l} à découvrir`;

 // Corps généré par l'IA, adapté au besoin de l'entreprise (sans mensonge)
 let body=null;
 try { body = await generateTailoredEmail(cand, co, need, key); } catch(e){ console.warn('IA email présentation:', e); }
 if(!body){
  // Repli si l'IA est indisponible : structure proche, sans invention
  const prenomCand = greetCand(cand)||'ce candidat';
  body = `Bonjour${prenom?' '+prenom:' Madame, Monsieur'},\n\nJ'espère que vous allez bien.\n\n`
   +(need
    ? `Comme convenu, je vous présente le profil de ${prenomCand}, dont le parcours correspond à votre besoin de ${need.title}.\n\n`
    : `Je me permets de vous présenter le profil de ${prenomCand}, que j'ai rencontré en entretien.\n\n`)
   +`${infoLines}\n\n`
   +`Vous trouverez son CV anonymisé en pièce jointe. N'hésitez pas à me contacter directement pour en échanger :\n📞 ${userPhone}\n\n`
   +`Bien cordialement,\n${userName}\n${userPhone}\nNovalem — Recrutement BTP\ncontact@novalem-recrutement.fr`;
 }

 try {
  const payload = {
   to: co.email,
   subject,
   body,
   ...(pdfB64 ? {
    attachments:[{
     filename: `Profil_${(cand.role||'Candidat').replace(/\s+/g,'_')}_Novalem.pdf`,
     content: pdfB64,
     type: 'application/pdf'
    }]
   } : {}),
  };

  const resp = await fetch(apiBase+'/api/send-email',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(()=>({}));
  if(!resp.ok){
   throw new Error(data.hint || data.error || ('Serveur email : HTTP '+resp.status));
  }
  return !!(data.sent || data.id);
 } catch(e) {
  console.warn('sendProfileEmail error:', e);
  throw e; // propagé pour affichage du motif réel
 }
}



// ═══════════════════════════════════════════════════════════════
// IA MATCHING — Propose les meilleures entreprises pour un candidat
// 1 seul appel API, JSON compact, score 0-100
// ═══════════════════════════════════════════════════════════════
async function aiMatchEnterprises(candId) {
 const cand = cById(candId); if(!cand) return;
 const key = getApiKey();
 if(!key){ toast('Clé API manquante — Paramètres','e'); return; }

 const now = Date.now();
 const week = 7*24*3600*1000;

 // Construire la liste des entreprises pertinentes
 // (clients + prospects avec besoin ou CVthèque)
 const companies = DB.companies.filter(co =>
  co.email && (
   co.type === 'client' ||
   co._accept_cv ||
   DB.needs.some(n => n.company_id === co.id && n.status === 'open')
  )
 ).map(co => {
  const needs = DB.needs.filter(n => n.company_id === co.id && n.status === 'open');
  const lastSent = co._last_cv_sent_at;
  const daysSince = lastSent ? Math.floor((now - new Date(lastSent))/86400000) : null;
  return {
   id: co.id,
   name: co.name,
   city: co.city || '',
   cat: co.cat || '',
   hasContract: !!(co._contract_signed || co.contract),
   hasNeed: needs.length > 0,
   needTitles: needs.map(n => n.title).join(', '),
   acceptCV: !!co._accept_cv,
   acceptCats: co._accept_cv_cats || [],
   daysSince,
   sentThisWeek: daysSince !== null && daysSince < 7,
  };
 });

 if(!companies.length){ toast('Aucune entreprise disponible dans le CRM','w'); return; }

 // Ouvrir modal de chargement
 openMo('🤖 Match IA — ' + esc(cand.name),
  '<div style="display:flex;align-items:center;gap:12px;padding:30px;color:var(--mu)">' +
  '<div style="width:20px;height:20px;border:2px solid var(--bd2);border-top-color:var(--purple);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>' +
  '<span style="font-size:12px">Analyse des entreprises en cours…</span></div>', '');

 // Profil candidat résumé
 const profil = [
  cand.role || getCat(cand.cat).l,
  'Spécialité: ' + getCat(cand.cat).l,
  cand.salary ? 'Salaire: ' + cand.salary + '€' : '',
  cand.avail ? 'Dispo: ' + cand.avail : '',
  cand.mobility ? 'Mobilité: ' + cand.mobility : '',
  cand.notes_pre ? cand.notes_pre.slice(0,150) : '',
 ].filter(Boolean).join(' | ');

 // Liste entreprises compacte pour l'IA (max 20 pour économiser les tokens)
 const coList = companies.slice(0,20).map(co =>
  co.id + ':' + co.name + '(' + co.city + ')' + (co.hasNeed ? '[BESOIN:' + co.needTitles + ']' : '') + (co.acceptCV ? '[ACCEPTE:' + (co.acceptCats.join(',') || 'tous') + ']' : '') + (co.hasContract ? '[CONTRAT]' : '')
 ).join('\n');

 try {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
   method: 'POST',
   headers: {'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
   body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `Tu es expert en recrutement BTP. Pour un profil candidat, analyse les entreprises et retourne un JSON strict (sans markdown) :
{"matches":[{"id":"id_entreprise","score":85,"raison":"1 phrase max","match":"fort|moyen|faible"}]}
Trie par score décroissant. Max 10 entreprises. Score : 90+ = profil idéal pour le besoin exact, 70-89 = bon match catégorie/besoins, 50-69 = possible, <50 = ne pas inclure.`,
    messages:[{role:'user',content:'PROFIL:\n'+profil+'\n\nENTREPRISES:\n'+coList}]
   })
  });

  const data = await resp.json();
  const txt = data.content?.find(b=>b.type==='text')?.text || '';
  let parsed = null;
  try { parsed = JSON.parse(txt.replace(/```json|```/g,'').trim()); }
  catch(e){ const m=txt.match(/\{[\s\S]*\}/); if(m) try{parsed=JSON.parse(m[0]);}catch(e2){} }

  if(!parsed?.matches?.length){ closeMo(); toast('Aucun match trouvé','w'); return; }

  // Enrichir avec les données CRM
  const rows = parsed.matches.map(match => {
   const co = coById(match.id);
   if(!co) return '';
   const coCrm = companies.find(x=>x.id===match.id);
   const sentThisWeek = coCrm?.sentThisWeek;
   const daysSince = coCrm?.daysSince;
   const isFort = match.match === 'fort';
   const isMoyen = match.match === 'moyen';

   const borderColor = sentThisWeek ? 'rgba(240,75,75,.4)' : isFort ? 'rgba(201,137,26,.4)' : 'var(--bd)';
   const bgColor = sentThisWeek ? 'rgba(240,75,75,.04)' : isFort ? 'rgba(201,137,26,.04)' : 'var(--s2)';

   const badge = isFort && !sentThisWeek
    ? '<span style="font-size:9px;padding:2px 7px;background:rgba(201,137,26,.15);color:var(--ac4);border-radius:10px;font-weight:700;margin-left:6px">⭐ Match fort</span>'
    : '';
   const redBadge = sentThisWeek
    ? '<span style="font-size:9px;padding:2px 7px;background:rgba(240,75,75,.1);color:var(--ac3);border-radius:10px;font-weight:700">⚠ Envoyé il y a ' + daysSince + 'j</span>'
    : '';
   const contractBadge = coCrm?.hasContract
    ? '<span style="font-size:9px;color:var(--ac2)">✓ Contrat</span>'
    : coCrm?.hasNeed
     ? '<span style="font-size:9px;color:var(--ac5)">◎ Besoin ouvert</span>'
     : '<span style="font-size:9px;color:var(--mu2)">CVthèque</span>';

   return '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid ' + borderColor + ';border-radius:var(--r2);cursor:pointer;margin-bottom:7px;background:' + bgColor + '">' +
    '<input type="checkbox" value="' + co.id + '" style="accent-color:var(--ac);width:15px;height:15px;margin-top:2px;flex-shrink:0" ' + (sentThisWeek?'':'') + '>' +
    '<div style="flex:1;min-width:0">' +
     '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">' +
      '<span style="font-weight:700;font-size:12px">' + esc(co.name) + '</span>' + badge + redBadge +
      '<span style="margin-left:auto">' + contractBadge + '</span>' +
     '</div>' +
     '<div style="font-size:10px;color:var(--mu);margin-bottom:4px">' + esc(co.city||'') + ' · ' + esc(co.contact||'—') + '</div>' +
     '<div style="font-size:11px;color:var(--tx);font-style:italic">"' + esc(match.raison) + '"</div>' +
    '</div>' +
    '<div style="font-size:13px;font-weight:800;color:' + (isFort?'var(--ac4)':isMoyen?'var(--ac5)':'var(--mu)') + ';flex-shrink:0;min-width:36px;text-align:right">' + match.score + '%</div>' +
   '</label>';
  }).filter(Boolean).join('');

  const body = '<div style="margin-bottom:10px;padding:9px 12px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);font-size:11px">' +
   '<strong>' + esc(cand.name) + '</strong> · ' + esc(cand.role||getCat(cand.cat).l) + (cand.salary?' · '+fM(cand.salary)+'€':'') + '</div>' +
   '<div style="max-height:55vh;overflow-y:auto">' + rows + '</div>' +
   '<div style="margin-top:8px;padding:7px 10px;background:rgba(201,137,26,.06);border-radius:var(--r2);font-size:10px;color:var(--ac4)">⭐ Match fort · <span style="color:var(--ac3)">⚠ Rouge = envoi récent</span> · ✓ Contrat signé · ◎ Besoin ouvert</div>';

  const mbody = document.getElementById('mo-body');
  if(mbody) mbody.innerHTML = body;
  const mfoot = document.getElementById('mo-foot');
  if(mfoot) mfoot.innerHTML =
   '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
   '<button class="btn bp" onclick="sendFromAIMatch(&apos;' + candId + '&apos;)">📤 Envoyer aux sélectionnés</button>';

 } catch(e) {
  closeMo();
  toast('Erreur IA : ' + e.message, 'e');
 }
}

async function sendFromAIMatch(candId) {
 const selected = [...document.querySelectorAll('#mo-body input[type="checkbox"]:checked')].map(el=>el.value);
 if(!selected.length){ toast('Sélectionnez au moins une entreprise','w'); return; }

 const cand = cById(candId); if(!cand) return;
 const key = getApiKey();
 if(!key){ toast('Clé API Anthropic manquante','e'); return; }

 closeMo();
 toast('Génération et envoi en cours…','i');

 // Générer le CV anonymisé une seule fois
 let anonCV = null, pdfB64 = null;
 try {
  anonCV = await generateAnonCVText(cand, key);
  pdfB64 = generateAnonCVPDF(cand, anonCV);
 } catch(e) { console.warn('CV anon error:', e); }

 let sent = 0;
 const now = Date.now();
 const week = 7*24*3600*1000;

 for(const coId of selected) {
  const co = coById(coId); if(!co||!co.email) continue;
  const need = DB.needs.find(n=>n.company_id===coId&&n.status==='open')||null;
  const hasContract = !!(co._contract_signed||co.contract);
  const ok = await sendProfileEmailToCompany(cand, co, need, hasContract, pdfB64, key);
  if(ok) {
   sent++;
   co._last_cv_sent_at = new Date().toISOString();
   co._cv_sent_count = (co._cv_sent_count||0)+1;
   if(cand.status!=='placed') { cand.status='presented'; cand.updated=now_(); }
   addTimeline(co.id,'profile_sent','Profil envoyé : '+cand.name+' (via IA Match)'+(need?' → '+need.title:''),null);
   addTimeline(cand.id||candId,'profile_sent','Profil envoyé à '+co.name+(need?' → '+need.title:''),null);
   addAgendaAuto({type:'relance',title:'Rappeler '+co.name+' — réception CV '+cand.name,date:localDateStr(addWorkingDays(new Date(),3)),time:'09:00',cand_id:candId,comp_id:coId,notes:'Profil de '+cand.name+' envoyé (via IA Match) le '+fD(todayKey())+'. Vérifier réception et relancer.',_profile_followup:true,_auto:true});
  }
 }
 save(); rCands(); badges();
 if(UI.view==='dash') rDash();
 toast('✅ Profil envoyé à '+sent+' entreprise(s) — relance J+3 planifiée','s');
}


function sendCV(candId){const c=cById(candId);if(!c)return;openMo('CV anonyme à envoyer',`<div class="mu_ fs11 mb8">Envoyer ce profil anonymisé aux prospects avec besoin ouvert dans la même catégorie.</div>${DB.companies.filter(co=>co.type==='prospect'&&['need','cvsent'].includes(co.status)).map(co=>`<div class="aitem" onclick="markCVSent('${candId}','${co.id}')">${esc(co.name)} <span class="mu_ fs10 ml-auto">${esc(co.city||'')}</span></div>`).join('')||'<div class="mu_ fs11">Aucun prospect avec besoin confirmé</div>'}`,`<button class="btn bg" onclick="closeMo()">Fermer</button>`);}
function markCVSent(candId,coId){const co=coById(coId);if(!co)return;co.status='cvsent';co.updated=now_();save();closeMo();toast(`CV envoyé à ${co.name} ✓`,'s');}
function emailTpl(id){const c=cById(id);if(!c)return;const fn=greetCand(c);const tpl=`Bonjour ${fn},\n\nSuite à notre échange, je vous transmets comme convenu :\n\n1. Lien entretien visio : [LIEN VISIO]\n2. Dossier de candidature à compléter et signer : [LIEN DOSSIER]\n\nDocuments à retourner :\n• CV à jour\n• Pièce d'identité (recto/verso)\n• Carte vitale\n• Permis de conduire\n\nN'hésitez pas à me contacter si vous avez des questions.\n\nCordialement,\n[VOTRE NOM] — Novalem`;openMo(' Email dossier candidature',`<textarea style="min-height:200px;font-size:11px;line-height:1.6">${tpl}</textarea>`,`<button class="btn bg" onclick="closeMo()">Fermer</button><button class="btn bp" onclick="cpTpl()">Copier</button>`);}
function cpTpl(){const ta=document.querySelector('#mb textarea');if(!ta)return;navigator.clipboard.writeText(ta.value).then(()=>toast('Copié ✓','i'));}
function genBoardTexts(id){const p=DB.posts.find(x=>x.id===id);if(!p)return;const txt=`═ FRANCE TRAVAIL ═\nIntitulé: ${p.title}\nLocalisation: ${p.location||'—'}\nType: CDI\nSalaire: ${p.salary||'—'}\n\n${p.body||''}\n\n═ INDEED ═\n${p.title} | ${p.location||''}\n${p.salary||''}\n\n${(p.body||'').slice(0,280)}…\n\n═ LINKEDIN ═\nNous recrutons pour notre client : ${p.title}\n${p.location||'France'} | ${p.salary||'—'}\n\n${p.body||''}`;openMo('Textes adaptés',`<textarea style="min-height:220px;font-size:11px;line-height:1.6">${txt}</textarea>`,`<button class="btn bg" onclick="closeMo()">Fermer</button><button class="btn bp" onclick="cpTpl()">Copier tout</button>`);}
function togPostSt(id){const p=DB.posts.find(x=>x.id===id);if(!p)return;p.status=p.status==='active'?'closed':'active';p.updated=now_();save();openPostPanel(id);rPosts();toast(`Annonce ${p.status==='active'?'activée':'clôturée'}`,'s');}
function findForNeed(needId){const n=nById(needId);if(!n)return;const cands=DB.candidates.filter(c=>c.cat===n.cat&&!['ko','placed'].includes(c.status)&&c.linked_need!==needId);openMo('Candidats disponibles — '+n.title,`<div>${cands.length?cands.map(c=>`<div class="aitem">${esc(c.name)} <span class="mu_ fs10 flex" style="flex:1;margin-left:8px">${esc(c.role||'')}</span><button class="btn bp bxs" onclick="toggleLink('${c.id}','${needId}');closeMo()">Lier</button></div>`).join(''):'<div class="mu_ fs11">Aucun disponible dans cette catégorie</div>'}</div>`,`<button class="btn bg" onclick="closeMo()">Fermer</button>`);}
function openStatusMo(type,id){
 if(type==='co'){
 openMo('Pipeline Prospect — Arbre de décision',`
 <div style="font-size:11px;line-height:2">
 <div class="flex fac fg5"><strong>À appeler</strong></div>
 <div style="margin-left:16px;padding-left:10px;border-left:1px solid var(--bd)">
 <div class="flex fac fg5">↳ Pas de réponse → <span class="pill pnrp">NRP</span></div>
 <div class="flex fac fg5">↳ Répond → <span class="pill pcal">Contacté</span></div>
 <div style="margin-left:16px;padding-left:10px;border-left:1px solid var(--bd)">
 <div class="flex fac fg5">↳ Aucun besoin → <span class="pill pbno">Pas de besoin</span></div>
 <div class="flex fac fg5">↳ A un besoin → <span class="pill pnee">Besoin ✓</span></div>
 <div style="margin-left:16px;padding-left:10px;border-left:1px solid var(--bd)">
 <div class="flex fac fg5">↳ CV envoyé → <span class="pill pcsnt">CV envoyé</span></div>
 <div class="flex fac fg5">↳ Contrat envoyé → <span class="pill pcli">Contrat envoyé</span></div>
 <div class="flex fac fg5">↳ Placé → <span class="pill pwin">Client actif</span></div>
 </div>
 </div>
 </div>
 </div>`,`<button class="btn bg" onclick="closeMo()">Fermer</button>`);
 }
}

// ═══════════════════════════════════════════════════════
// IMPORT
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// IMPORT PROSPECTS — Excel (.xlsx) + CSV intelligent
// Analyse ton fichier réel : col 0=Nom, col 1=Ville, col 2=Tél, col 3=Email
// Détection automatique par contenu si colonnes dans un autre ordre
// ═══════════════════════════════════════════════════════

function importProspects(e){
 const f=e.target.files[0];if(!f)return;
 const ext=f.name.split('.').pop().toLowerCase();
 if(['xlsx','xls'].includes(ext)){
 _importExcel(f);
 } else {
 _importCsv(f);
 }
}

// Alias kept for toolbar button that still calls old name
function importProsCsv(e){importProspects(e);}

// ── Excel import via SheetJS ──────────────────────────
function _importExcel(file){
 const reader=new FileReader();
 reader.onload=(e)=>{
 try{
 const wb=XLSX.read(e.target.result,{type:'array'});
 const ws=wb.Sheets[wb.SheetNames[0]];
 const raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:false});
 const rows=raw.filter(r=>r.some(c=>c!=null&&String(c).trim()));
 _analyzeAndPreview(rows,'Excel');
 }catch(err){
 toast('Erreur lecture Excel — '+err.message,'e');
 }
 };
 reader.readAsArrayBuffer(file);
}

// ── CSV import — multi-encoding, multi-separator ──────
function _importCsv(file){
 const reader=new FileReader();
 reader.onload=(e)=>{
 // Try encodings: UTF-8 first, then Latin-1
 let text='';
 try{text=new TextDecoder('utf-8').decode(new Uint8Array(e.target.result));}
 catch(err){text=new TextDecoder('latin-1').decode(new Uint8Array(e.target.result));}
 // Handle different line endings
 text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
 // Detect separator
 const firstLine=text.split('\n')[0]||'';
 const sep=firstLine.split(';').length>firstLine.split(',').length?';':',';
 // Parse CSV properly (handle quoted multiline cells)
 const rows=_parseCSV(text,sep);
 _analyzeAndPreview(rows,'CSV');
 };
 reader.readAsArrayBuffer(file);
}

// Proper CSV parser that handles quoted cells with newlines
function _parseCSV(text,sep){
 const rows=[];let cur=[],cell='',inQ=false;
 for(let i=0;i<text.length;i++){
 const ch=text[i];
 if(ch==='"'){
 if(inQ&&text[i+1]==='"'){cell+='"';i++;}
 else inQ=!inQ;
 } else if(ch===sep&&!inQ){
 cur.push(cell.trim());cell='';
 } else if(ch==='\n'&&!inQ){
 cur.push(cell.trim());
 if(cur.some(c=>c)){rows.push(cur);}
 cur=[];cell='';
 } else {
 cell+=ch;
 }
 }
 if(cell||cur.length)cur.push(cell.trim());
 if(cur.some(c=>c))rows.push(cur);
 return rows;
}

// ── Smart column detection by content ────────────────
function _detectColumns(rows){
 // Score each column position for each type
 const testSample=rows.slice(0,Math.min(20,rows.length));
 const maxCols=Math.max(...testSample.map(r=>r.length));
 const scores={name:[],phone:[],email:[],city:[]};

 for(let col=0;col<maxCols;col++){
 const vals=testSample.map(r=>(r[col]||'').toString().trim()).filter(v=>v);
 let phoneScore=0,emailScore=0,cityScore=0,nameScore=0;
 vals.forEach(v=>{
 const vl=v.toLowerCase();
 // Email detection
 if(v.includes('@')&&v.includes('.')){emailScore+=10;}
 // Phone detection (French: 04/06/07/09 + digits, Monaco: 377)
 if(/^[\d\s\(\)\.+\-]{8,20}$/.test(v.replace(/\s/g,''))&&(/^0[0-9]/.test(v)||/^(\+33|33|377)/.test(v)||/^\(0\)/.test(v))){phoneScore+=8;}
 if(/^\d{2}\s\d{2}\s\d{2}\s\d{2}\s\d{2}$/.test(v.trim())){phoneScore+=5;}
 // City: short, capitalized, no digits
 if(v.length<30&&!/\d/.test(v)&&!/[@;]/.test(v)&&v===v.trim()){cityScore+=3;}
 if(/^[A-ZÁÀÂÄÉÈÊËÎÏÔÙÛÜ][a-záàâäéèêëîïôùûü\s\-']+$/.test(v)&&v.length<25){cityScore+=4;}
 // Name: longer, may have uppercase, no @ 
 if(!v.includes('@')&&v.length>3&&v.length<60&&!/^\d+$/.test(v)){nameScore+=2;}
 if(v===v.toUpperCase()&&v.length>3&&!v.includes('@')){nameScore+=3;} // ALL CAPS = likely company name
 });
 scores.name.push(nameScore);
 scores.phone.push(phoneScore);
 scores.email.push(emailScore);
 scores.city.push(cityScore);
 }

 // Assign columns greedily: highest score wins, no repeat
 const assigned={name:-1,phone:-1,email:-1,city:-1};
 const types=['email','phone','name','city']; // priority order
 const used=new Set();
 types.forEach(type=>{
 let best=-1,bestScore=-1;
 for(let col=0;col<maxCols;col++){
 if(used.has(col))continue;
 if(scores[type][col]>bestScore){bestScore=scores[type][col];best=col;}
 }
 if(best>=0&&bestScore>0){assigned[type]=best;used.add(best);}
 });

 return assigned;
}

// ── Preview modal before import ───────────────────────
function _analyzeAndPreview(rows, fileType){
 if(!rows.length){toast('Fichier vide ou illisible','e');return;}

 // Detect if first row is a header
 const firstRow=rows[0];
 const isHeader=firstRow.some(c=>c&&/^(nom|raison|soci|entreprise|tel|phone|mail|email|ville|city|contact|secteur|cat)/i.test(String(c).trim()));
 const dataRows=isHeader?rows.slice(1):rows;
 const cols=_detectColumns(dataRows);

 // Clean rows
 const parsed=dataRows.map(r=>{
 const raw_email=(r[cols.email]!=null?String(r[cols.email]):'').trim();
 // Handle multiple emails in one cell (split by newline, semicolon, comma)
 const emails=raw_email.split(/[\n;,]/).map(e=>e.trim()).filter(e=>e.includes('@'));
 return{
 name:(r[cols.name]!=null?String(r[cols.name]):'').trim(),
 phone:(r[cols.phone]!=null?String(r[cols.phone]):'').replace(/\(0\)/g,'0').trim(),
 email:emails.join(';'), // store multiple emails separated by ;
 city:(r[cols.city]!=null?String(r[cols.city]):'').trim(),
 _raw:r,
 };
 }).filter(p=>p.name&&p.name.length>1);

 window._importParsed=parsed;
 window._importCols=cols;

 // Estimate duplicates
 const dups=parsed.filter(p=>{
 const ph=p.phone.replace(/\D/g,'');
 return DB.companies.some(c=>
 c.name.toLowerCase()===p.name.toLowerCase()||
 (ph.length>=8&&c.phone&&c.phone.replace(/\D/g,'')===ph)
);
 }).length;

 // Preview table
 const preview=parsed.slice(0,6);
 const colLabels={name:'Raison sociale',phone:'Téléphone',email:'Email',city:'Ville'};
 const detectedCols=['name','phone','city','email'].filter(k=>cols[k]>=0);

 const previewHtml=preview.map(p=>`
 <tr>
 <td style="font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong title="${esc(p.name)}">${esc(p.name)}</strong></td>
 <td style="font-size:10px;font-family:'DM Mono',monospace;color:var(--ac2)">${esc(p.phone||'—')}</td>
 <td style="font-size:10px;color:var(--mu)">${esc(p.city||'—')}</td>
 <td style="font-size:10px;color:var(--ac5);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.email)}">${esc(p.email||'—')}</td>
 </tr>`).join('');

 openMo(`Import ${fileType} — ${parsed.length} prospect(s)`,`
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
 <div style="padding:6px 10px;background:rgba(61,224,154,.08);border:1px solid rgba(61,224,154,.2);border-radius:3px;font-size:10px">
 ✓ <strong>${parsed.length}</strong> lignes valides
 </div>
 <div style="padding:6px 10px;background:rgba(74,130,224,.08);border:1px solid rgba(74,130,224,.2);border-radius:3px;font-size:10px">
 <strong>${parsed.filter(p=>p.email).length}</strong> avec email
 </div>
 ${dups>0?`<div style="padding:6px 10px;background:rgba(224,152,58,.08);border:1px solid rgba(224,152,58,.2);border-radius:3px;font-size:10px">! <strong>${dups}</strong> doublon(s) ignorés</div>`:''}
 ${isHeader?`<div style="padding:6px 10px;background:var(--s3);border:1px solid var(--bd);border-radius:3px;font-size:10px">✓ En-têtes détectés</div>`:''}
 </div>
 <div style="font-size:10px;color:var(--mu2);margin-bottom:8px">Colonnes détectées : ${detectedCols.map(k=>`<strong>${colLabels[k]}</strong> → col. ${cols[k]+1}`).join(' · ')}</div>
 <div style="overflow-x:auto;margin-bottom:12px">
 <table class="tbl" style="min-width:100%">
 <thead><tr>
 <th>Raison sociale</th><th>Téléphone</th><th>Ville</th><th>Email</th>
 </tr></thead>
 <tbody>${previewHtml}</tbody>
 </table>
 </div>
 <div style="font-size:10px;color:var(--mu2);padding:8px 10px;background:var(--s3);border-radius:3px;line-height:1.7">
 Les emails sont stockés sur chaque fiche même s'ils n'apparaissent pas dans la liste.<br>
 Les doublons (même nom ou même numéro) seront ignorés.
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bp" onclick="confirmProspectImport()">Importer ${parsed.length} prospect(s) →</button>`
);
}

function confirmProspectImport(){
 const parsed=window._importParsed||[];
 let imported=0,skipped=0;
 parsed.forEach(p=>{
 const ph=p.phone.replace(/\D/g,'');
 const dup=DB.companies.find(c=>
 c.name.toLowerCase()===p.name.toLowerCase()||
 (ph.length>=8&&c.phone&&c.phone.replace(/\D/g,'')===ph)
);
 if(dup){
 // Update email if we now have it and didn't before
 if(!dup.email&&p.email){dup.email=p.email;dup.updated=now_();}
 skipped++;return;
 }
 DB.companies.unshift({
 id:uid(),name:p.name,phone:p.phone,email:p.email,city:p.city,
 contact:'',ctitle:'',cat:'go',type:'prospect',status:'tocall',
 source:'Import',created:now_(),updated:now_(),
 });
 imported++;
 });
 save();closeMo();rPros();badges();
 window._importParsed=null;
 toast(`${imported} prospect(s) importé(s)${skipped>0?` · ${skipped} doublon(s) ignoré(s)`:''}`,'s');
}

// Kept for compat
function confirmCsvImport(){confirmProspectImport();}

function downloadCsvTemplate(){
 const header='Raison sociale;Ville;Telephone;Email';
 const ex1='Bouygues Construction Nice;Nice;04 93 00 00 00;contact@bouygues.fr';
 const ex2='SARL Martin Elec;Cannes;06 12 34 56 78;martin@martin-elec.fr';
 const ex3='TP Dupont;Monaco;377 93 30 00 00;';
 const blob=new Blob(['\ufeff'+header+'\n'+ex1+'\n'+ex2+'\n'+ex3],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='prospects_novalem.csv';a.click();
 URL.revokeObjectURL(url);toast('Modèle téléchargé ✓','s');
}


function importCandCsv(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const lines=ev.target.result.trim().split('\n').filter(l=>l.trim());let n=0;lines.forEach(l=>{const cols=l.split(',').map(s=>s.trim().replace(/^"|"$/g,''));if(!cols[0])return;const c={id:uid(),name:cols[0],role:cols[1]||'',phone:cols[2]||'',email:cols[3]||'',source:cols[4]||'Import CSV',cat:'go',status:'entrant',docs:[],pepite:false,created:now_(),updated:now_()};DB.candidates.unshift(c);n++;});save();rCands();badges();toast(`${n} entrant(s) importés → onglet À trier`,'s');};r.readAsText(f,'UTF-8');}
function importCandCSV(){
 // Programmatically trigger a hidden file input
 let inp=document.getElementById('_csv-cand-input');
 if(!inp){inp=document.createElement('input');inp.type='file';inp.accept='.csv';inp.id='_csv-cand-input';inp.style.display='none';inp.onchange=importCandCsv;document.body.appendChild(inp);}
 inp.value='';inp.click();
}
function importCsv(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const lines=ev.target.result.trim().split('\n').filter(l=>l.trim());let n=0;lines.forEach(l=>{const cols=l.split(',').map(s=>s.trim().replace(/^"|"$/g,''));if(!cols[0])return;const c={id:uid(),name:cols[0],contact:cols[1]||'',phone:cols[2]||'',email:cols[3]||'',city:cols[4]||'',cat:'go',type:'prospect',status:'tocall',source:'Import CSV',created:now_(),updated:now_()};DB.companies.unshift(c);n++;});save();rPros();badges();toast(`${n} prospect(s) importés ✓`,'s');};r.readAsText(f,'UTF-8');}
function loadCandCsv(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{document.getElementById('cc-txt').value=ev.target.result;};r.readAsText(f,'UTF-8');}
function parseCandCsv(){const txt=document.getElementById('cc-txt').value;const lines=txt.trim().split('\n').filter(l=>l.trim());let n=0;lines.forEach(l=>{const cols=l.split(',').map(s=>s.trim());if(!cols[0])return;const c={id:uid(),name:cols[0],role:cols[1]||'',phone:cols[2]||'',email:cols[3]||'',source:cols[4]||'Import CSV',cat:'go',status:'new',docs:[],pepite:false,created:now_(),updated:now_()};DB.candidates.unshift(c);autoAg(c);n++;});save();closeMo();rCands();badges();toast(`${n} candidat(s) importés ✓ — précals planifiées`,'s');}

// ═══════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════
function delCand(id){
 const c=cById(id);if(!c)return;
 openMo('Supprimer ce candidat ?',`<div style="font-size:12px;color:var(--mu);line-height:1.6">Voulez-vous vraiment supprimer <strong>${esc(c.name)}</strong> ?<br>Cette action est irréversible.</div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button><button class="btn bd_" onclick="DB.candidates=DB.candidates.filter(x=>x.id!=='${id}');save();closePanel();closeMo();rCands();badges();toast('${esc(c.name)} supprimé','w')">Supprimer</button>`);
}
function delCo(id){
 const c=coById(id);if(!c)return;
 openMo(`Supprimer ${esc(c.name)} ?`,`<div style="font-size:12px;color:var(--mu);line-height:1.6">Voulez-vous vraiment supprimer <strong>${esc(c.name)}</strong> ?<br>Cette action est irréversible.</div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button><button class="btn bd_" onclick="(()=>{DB.companies=DB.companies.filter(x=>x.id!=='${id}');save();closePanel();closeMo();if(UI.view==='pros')rPros();else if(UI.view==='clients')rClients();badges();toast('Supprimé','w');})()">Supprimer</button>`);
}
function delCoConfirm(id){delCo(id);}
function delNeed(id){
 const n=nById(id);if(!n)return;
 openMo(`Supprimer ce besoin ?`,`<div style="font-size:12px;color:var(--mu);line-height:1.6">Supprimer <strong>${esc(n.title)}</strong> ?<br>Cette action est irréversible.</div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button><button class="btn bd_" onclick="(()=>{DB.needs=DB.needs.filter(x=>x.id!=='${id}');DB.candidates.forEach(c=>{if(c.linked_need==='${id}')c.linked_need=null;});save();closePanel();closeMo();rNeeds();badges();toast('Besoin supprimé','w');})()">Supprimer</button>`);
}
function delAg(id){const a=agById(id);const co=a&&a.comp_id,ca=a&&a.cand_id;DB.agenda=DB.agenda.filter(a=>a.id!==id);save();if(typeof rAgenda==='function'&&UI.view==='agenda')rAgenda();badges();if(UI.view==='dash')rDash();if(UI.ptype==='co'&&co===UI.pid)openCoPanel(UI.pid);else if(UI.ptype==='cand'&&ca===UI.pid)openCandPanel(UI.pid);else closePanel();toast('Événement supprimé','w');}
function delPost(id){DB.posts=DB.posts.filter(p=>p.id!==id);save();closePanel();rPosts();toast('Supprimé','w');}

// ═══════════════════════════════════════════════════════
// CTX MENU
// ═══════════════════════════════════════════════════════
function ctxCand(e,id){
 e.preventDefault();e.stopPropagation();
 const ctx=document.getElementById('ctx');
 ctx.innerHTML=CAND_ST.map(s=>`<div class="cxi" onclick="setCS('${id}','${s.id}');ctx.style.display='none'">→ ${s.l}</div>`).join('')+
 `<div style="border-top:1px solid var(--bd);margin:2px 0"></div><div class="cxi" onclick="openAgForm(null,'${id}')"> Planifier</div><div class="cxi d" onclick="delCand('${id}')"> Supprimer</div>`;
 ctx.style.display='block';
 ctx.style.left=Math.min(e.clientX,window.innerWidth-165)+'px';
 ctx.style.top=Math.min(e.clientY,window.innerHeight-280)+'px';
}
document.addEventListener('click',()=>document.getElementById('ctx').style.display='none');
document.querySelectorAll('.ni').forEach(el=>el.addEventListener('click',()=>go(el.dataset.v)));

// ═══════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════
function seed(){
 DB.companies=[
 {id:'co1',name:'SARL Martin BTP',marge:'9000',contact:'Pierre Martin',ctitle:'Gérant',phone:'0456789012',email:'p.martin@martinbtp.fr',city:'Lyon (69)',cat:'go',size:'pme',type:'client',status:'active',contract:true,contract_date:ago(30),source:'Job board',notes:'Client sérieux, paiement rapide. 2 besoins en cours.',created:ago(35),updated:ago(2)},
 {id:'co2',name:'Constructions Durand',marge:'7560',contact:'Alain Durand',ctitle:'DG',phone:'0467890123',email:'a.durand@durand.fr',city:'Grenoble (38)',cat:'go',size:'pme',type:'client',status:'active',contract:true,contract_date:ago(15),source:'Cold call',notes:'Besoin urgent chef de chantier.',created:ago(20),updated:ago(1)},
 {id:'co3',name:'Industech VRD',contact:'Sandra Petit',ctitle:'RH',phone:'0478901234',email:'s.petit@industech.fr',city:'Toulouse (31)',cat:'vrd',size:'pme',type:'prospect',status:'need',source:'LinkedIn',notes:'Besoin confirmé VRD. Envoyer contrat.',created:ago(8),updated:ago(2)},
 {id:'co4',name:'BTP Nord SARL',contact:'Marc Leblond',ctitle:'Gérant',phone:'0320101010',email:'m.leblond@btpnord.fr',city:'Lille (59)',cat:'so',size:'tpe',type:'prospect',status:'tocall',source:'Import CSV',notes:'',created:ago(3),updated:ago(3)},
 {id:'co5',name:'Immo Concept',contact:'Julien Brun',ctitle:'Directeur',phone:'0498765432',email:'j.brun@immoconcept.fr',city:'Marseille (13)',cat:'be',size:'pme',type:'prospect',status:'called',source:'Cold call',notes:'A dit "rappeler lundi". Pas de besoin pour l\'instant.',created:ago(5),updated:ago(4)},
 {id:'co6',name:'Renov Expert',contact:'Claire Morin',ctitle:'Gérant',phone:'0223344556',email:'c.morin@renov.fr',city:'Nantes (44)',cat:'so',size:'tpe',type:'prospect',status:'nrp',source:'Cold call',notes:'Essayé 3 fois. Essayer autre créneau.',created:ago(7),updated:ago(6)},
 ];
 DB.needs=[
 {id:'n1',company_id:'co1',title:'Conducteur de travaux GO',cat:'go',smin:42000,smax:50000,location:'Lyon (69)',start:inDays(21),urgency:'h',status:'open',notes:'CDI. Exp 5 ans min. Permis B. Chantiers logements collectifs.',created:ago(4),updated:ago(1)},
 {id:'n2',company_id:'co2',title:'Chef de chantier GO',cat:'go',smin:35000,smax:42000,location:'Grenoble (38)',start:inDays(14),urgency:'h',status:'sent',notes:'URGENT. Chantier démarré. Besoin immédiat.',created:ago(7),updated:ago(2)},
 {id:'n3',company_id:'co1',title:'Ingénieur études structure',cat:'be',smin:45000,smax:58000,location:'Lyon (69)',start:inDays(45),urgency:'m',status:'open',notes:'Robot/ETABS requis. Eurocodes.',created:ago(2),updated:ago(2)},
 ];
 DB.candidates=[
 {id:'c1',name:'Thomas Berger',cat:'go',role:'Conducteur de travaux GO',salary:'47000',phone:'0612345678',email:'t.berger@email.fr',source:'LinkedIn',status:'interview',avail:'Sous 1 mois',mobility:'Rhône-Alpes',pepite:true,docs:['CV reçu',"Pièce d'identité (scan recto/verso)",'RGPD signé','Autorisation contrôle de référence'],notes_pre:'8 ans exp gros œuvre. Très motivé. Cherche +salaire. Dispo 3 sem.',notes_int:'Excellent profil. Très bon techniquement. Bon leadership. À présenter à co1 en priorité.',int_done:true,int_date:ago(2),linked_need:'n1',refs:[{company:'Eiffage Construction',contact:'Guy Moreau',phone:'0412345678',done:true,note:'Très bon collaborateur. Part pour raisons familiales.'}],created:ago(12),updated:ago(1)},
 {id:'c2',name:'Karim Mansour',cat:'go',role:'Chef de chantier GO',salary:'38000',phone:'0698765432',email:'k.mansour@email.fr',source:'Indeed',status:'precal',avail:'Immédiate',mobility:'National',pepite:false,docs:['CV reçu'],notes_pre:'5 ans maçonnerie + coffrage. Dispo de suite. Cherche CDI stable en région.',int_done:false,linked_need:'n2',refs:[],created:ago(5),updated:ago(3)},
 {id:'c3',name:'Julie Marchand',cat:'be',role:'Ingénieur études structure',salary:'52000',phone:'0678901234',email:'j.marchand@mail.fr',source:'LinkedIn',status:'presented',avail:'Sous 3 mois',mobility:'IDF + RA',pepite:true,docs:['CV reçu',"Pièce d'identité (scan recto/verso)",'Carte vitale (scan)','RGPD signé','Autorisation contrôle de référence','Dossier candidature complet + signé'],notes_pre:'6 ans structure. Robot + ETABS. Anglais B2. Cherche évolution.',notes_int:'Top profil. Soft skills excellents. Présenter à co1 immédiatement.',int_done:true,int_date:ago(4),linked_need:'n3',refs:[],created:ago(14),updated:ago(1)},
 {id:'c4',name:'Marc Dupont',cat:'vrd',role:'Conducteur de travaux VRD',salary:'44000',phone:'0623456789',email:'m.dupont@mail.fr',source:'France Travail',status:'dossier',avail:'Sous 2 mois',mobility:'Occitanie',pepite:false,docs:['CV reçu',"Pièce d'identité (scan recto/verso)",'RGPD signé'],notes_pre:'7 ans VRD. Réseaux + voirie. Bien à l\'oral.',int_done:false,refs:[],created:ago(10),updated:ago(4)},
 {id:'c5',name:'Sonia Leroy',cat:'mgmt',role:'Chargée d\'affaires TCE',salary:'58000',phone:'0645678901',email:'s.leroy@mail.fr',source:'CVtech',status:'placed',avail:'—',mobility:'National',pepite:true,docs:DOCS,notes_pre:'10 ans TCE. Leadership confirmé. Placement parfait.',notes_int:'Profil rare. Très motivée. A accepté.',int_done:true,linked_need:null,refs:[],created:ago(60),updated:ago(10)},
 {id:'c6',name:'Antoine Roux',cat:'go',role:'Maçon N3/N4',salary:'28000',phone:'0601020304',email:'a.roux@mail.fr',source:'Job board',status:'entrant',avail:'Immédiate',mobility:'PACA',pepite:false,docs:[],notes_pre:'',int_done:false,refs:[],created:ago(1),updated:ago(1)},
 ];
 DB.candidates.push(
 {id:'c8',name:'Omar Diallo',cat:'go',role:'Conducteur de travaux GO',salary:'46000',phone:'0678123456',email:'o.diallo@mail.fr',source:'LinkedIn',status:'entrant',avail:'',mobility:'',pepite:false,docs:[],notes_pre:'7 ans CT GO. En poste. Cherche changer région.',refs:[],created:ago(0),updated:ago(0)},
 {id:'c9',name:'Léa Fontaine',cat:'be',role:'Dessinateur-projeteur Revit',salary:'36000',phone:'0656789012',email:'l.fontaine@mail.fr',source:'Indeed',status:'entrant',avail:'',mobility:'',pepite:false,docs:[],notes_pre:'2 ans Revit. Master BTP. Cherche CDI.',refs:[],created:ago(0),updated:ago(0)}
);
 DB.agenda=[
 {id:'a1',type:'call',title:'Précal Antoine Roux',date:now_(),time:'10:00',cand_id:'c6',comp_id:null,notes:'Nouveau candidat GO. Qualifier profil et dispos.',done:false,created:ago(1)},
 {id:'a2',type:'relance',title:'Relancer SARL Martin — retour Julie M.',date:now_(),time:'14:30',cand_id:'c3',comp_id:'co1',notes:'Demander retour sur candidature présentée il y a 4j.',done:false,created:ago(2)},
 {id:'a3',type:'visio',title:'Entretien visio Karim Mansour',date:inDays(2),time:'11:00',cand_id:'c2',comp_id:null,notes:'Envoyer lien + dossier avant. Préparer questions techniques GO.',done:false,created:ago(3)},
 {id:'a4',type:'task',title:'Envoyer contrat à Industech VRD',date:inDays(1),time:'09:00',cand_id:null,comp_id:'co3',notes:'Template contrat + CGV. Vérifier avant envoi.',done:false,created:ago(4)},
 {id:'a5',type:'call',title:'Contrôle REF Thomas B. — Eiffage',date:now_(),time:'16:00',cand_id:'c1',comp_id:null,notes:'Appeler Guy Moreau. Demander aussi si besoins recrutement.',done:false,created:ago(2)},
 ];
 DB.posts=[{id:'p1',title:'Conducteur de travaux GO — Lyon (H/F)',cat:'go',location:'Lyon (69)',salary:'42 000–50 000€/an',boards:['France Travail','Indeed','LinkedIn Jobs'],status:'active',body:'Notre cabinet de recrutement spécialisé BTP recherche pour un client PME lyonnaise un(e) Conducteur(trice) de travaux Gros Œuvre confirmé(e).\n\nMissions :\n• Pilotage chantiers logements collectifs / tertiaire\n• Management équipes propres et sous-traitants\n• Suivi budgétaire, planning, QSE\n\nProfil :\n• Bac+2/3 BTP\n• 5 ans exp. minimum\n• Permis B obligatoire\n\nCDI · Véhicule de fonction · Mutuelle',created:ago(5),updated:ago(5)}];
}

// ═══════════════════════════════════════════════════════
// SETTINGS & API CONFIG
// ═══════════════════════════════════════════════════════
function getApiKey(){return cfgGet('anthropic_key','btp_anthropic_key','');}
function setApiKey(k){localStorage.setItem(uKey('btp_anthropic_key'),k);/* miroir local */saveSharedConfig({anthropic_key:k});}
// Taux honoraires (%) et objectif CA : config d'agence partagée
function getTauxHon(){return cfgGet('taux_hon','btp_taux_hon','18');}
function getObjCA(){return cfgGet('obj_ca','btp_obj_ca','10000');}

function openSettings(){
 const apiKey=getApiKey();
 const sbUrl=getSupabaseUrl();
 const sbKey=getSupabaseKey();
 const sbOk=!!(sbUrl&&sbKey);
 // Profil utilisateur
 const nom=localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||'';
 const tel=localStorage.getItem(uKey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'';
 const userEmail=localStorage.getItem('btp_user_email')||'';
 // Objectif CA
 const objCA=getObjCA();
 // Taux honoraires
 const tauxHon=getTauxHon();
 // Dossier URL
 const dossierUrl=localStorage.getItem('btp_dossier_url')||'';

 openMo(`Parametres — ${currentUserName()}`,`
 <div style="max-height:72vh;overflow-y:auto;padding-right:4px">

 <!-- BOUTON STYLE -->
 <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
 <button onclick="closeMo();setTimeout(openStylePanel,80)" style="
 display:inline-flex;align-items:center;gap:7px;
 padding:8px 14px;font-size:11px;font-family:inherit;cursor:pointer;
 border-radius:var(--r2);border:1.5px solid var(--bd);
 background:var(--s3);color:var(--tx);font-weight:600;
 transition:all .2s;
 " onmouseover="this.style.borderColor='var(--ac)';this.style.color='var(--ac)'" onmouseout="this.style.borderColor='var(--bd)';this.style.color='var(--tx)'">
 🎨 Apparence & Style
 <span style="font-size:9px;color:var(--mu)">3 thèmes · 5 options →</span>
 </button>
 </div>

 <!-- PROFIL -->
 <div style="margin-bottom:18px;padding:12px 14px;background:var(--s3);border:1px solid var(--bd);border-radius:3px">
 <div style="font-size:11px;font-weight:700;margin-bottom:10px;color:var(--ac)">Profil — ${currentUserName()}</div>
 <div class="fg">
 <div class="fgrp"><span class="lbl">Votre nom complet</span>
 <input id="set-nom" value="${esc(nom)}" placeholder="ex: Louis Renault">
 </div>
 <div class="fgrp"><span class="lbl">Votre téléphone</span>
 <input id="set-tel" value="${esc(tel)}" placeholder="ex: 06 12 34 56 78">
 </div>
 <div class="fgrp"><span class="lbl">Votre email (expéditeur)</span>
 <input id="set-email" value="${esc(userEmail)}" placeholder="contact@novalem-recrutement.fr">
 </div>
 </div>
 <div style="font-size:10px;color:var(--mu);margin-top:6px">Ces informations s'utilisent dans tous les emails et la signature.</div>
 </div>

 <!-- BUSINESS -->
 <div style="margin-bottom:18px;padding:12px 14px;background:var(--s3);border:1px solid var(--bd);border-radius:3px">
 <div style="font-size:11px;font-weight:700;margin-bottom:10px;color:var(--ac4)"> Paramètres business</div>
 <div class="fg">
 <div class="fgrp"><span class="lbl">Objectif CA mensuel (€)</span>
 <input id="set-obj-ca" type="number" value="${esc(objCA)}" placeholder="10000">
 </div>
 <div class="fgrp"><span class="lbl">Taux d'honoraires (%)</span>
 <input id="set-taux" type="number" value="${esc(tauxHon)}" placeholder="18" min="1" max="40">
 <span style="font-size:10px;color:var(--mu);margin-top:3px">Standard cabinet CDI : 15-22% du salaire brut annuel</span>
 </div>
 <div class="fgrp"><span class="lbl">URL dossier de candidature (lien de téléchargement)</span>
 <input id="set-dossier" value="${esc(dossierUrl)}" placeholder="https://… (Google Drive, Dropbox, etc.)">
 <span style="font-size:10px;color:var(--mu);margin-top:3px">Ce lien sera inclus automatiquement dans les emails de précal</span>
 </div>
 </div>
 <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd)">
 <button class="btn bg bsm" onclick="closeMo();setTimeout(()=>openDispoSettings&&openDispoSettings(),80)" style="width:100%">
 🗓️ Mes disponibilités d'entretien — créneaux récurrents
 </button>
 <span style="font-size:10px;color:var(--mu);margin-top:5px;display:block">Définis une fois, réutilisés pour chaque invitation candidat (auto-booking).</span>
 </div>
 </div>

 <!-- IA -->
 <div style="margin-bottom:18px;padding:12px 14px;background:var(--s3);border:1px solid var(--bd);border-radius:3px">
 <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--ac6)"> Intelligence Artificielle (Anthropic)</div>
 <div style="font-size:11px;color:var(--mu);margin-bottom:8px;line-height:1.6">
 Extraction de CV, generation d'annonces, analyse emails. <a href="https://console.anthropic.com" target="_blank" style="color:var(--ac5)">→ console.anthropic.com</a><br>
        <span style="font-size:10px;color:var(--mu2)">La cle saisie ici doit aussi etre configuree dans Vercel → Settings → Environment Variables → ANTHROPIC_API_KEY</span>
 </div>
 <div class="fgrp"><span class="lbl">Clé API Anthropic</span>
 <input id="set-apikey" type="password" value="${esc(apiKey)}" placeholder="sk-ant-api03-…" autocomplete="off">
 </div>
 ${apiKey?`<div style="font-size:10px;color:var(--ac2);margin-top:4px">IA active</div>`:`<div style="font-size:10px;color:var(--ac4);margin-top:4px">! IA désactivée</div>`}
 </div>

 <!-- SUPABASE -->
 <div style="margin-bottom:18px;padding:12px 14px;background:var(--s3);border:1px solid var(--bd);border-radius:3px">
 <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--ac2)">· Synchronisation Cloud (Supabase)</div>
 <div style="font-size:11px;color:var(--ac2);display:flex;align-items:center;gap:6px">
   <span style="width:7px;height:7px;border-radius:50%;background:var(--green);display:inline-block"></span>
   Connecté à l'espace partagé Novalem
 </div>
 <div style="font-size:10px;color:var(--mu);margin-top:6px;line-height:1.5">
   Louis et Corentin partagent automatiquement la même base et la même config (clé Anthropic, taux, objectif). Rien à saisir ici.
 </div>
 </div>

 <!-- EXPORT -->
 <div style="padding:12px 14px;background:var(--s3);border:1px solid var(--bd);border-radius:3px">
 <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--ac5)"> Données & Sauvegarde</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">
 <button class="btn bg bsm" onclick="exportData()">⬇ Exporter JSON</button>
 <label class="btn bg bsm" style="cursor:pointer">⬆ Importer JSON<input type="file" accept=".json" style="display:none" onchange="importData(event)"></label>
 <button class="btn bd_ bsm" onclick="if(confirm('Effacer TOUTES les données ? Irréversible.'))resetAllData()"> Reset données</button>
 </div>
 <div style="font-size:10px;color:var(--mu2);margin-top:8px">Exportez régulièrement pour sauvegarder vos données.</div>
 </div>

 </div>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bp" onclick="saveSettings()"> Enregistrer</button>`
);
}
// ── Connexion cloud (bouton top-right) ────────────────────────────
function openConnexion(){
 const url=getSupabaseUrl();
 const key=getSupabaseKey();
 const connected=!!(url&&key);
 openMo('Connexion cloud', `
 <div class="info-box mb12">
 ${connected
   ? 'Votre CRM est <strong style="color:var(--ac2)">connecté</strong>. Vos données sont synchronisées et chargées depuis le cloud.'
   : 'En local, le CRM est <strong>vierge</strong>. Connectez-vous pour charger et synchroniser vos données.'}
 </div>
 <div class="fg">
 <div class="fgrp ff"><span class="lbl">URL Supabase</span>
 <input id="cx-url" value="${esc(url)}" placeholder="https://xxxxx.supabase.co"></div>
 <div class="fgrp ff"><span class="lbl">Clé Supabase (anon/public)</span>
 <input id="cx-key" value="${esc(key)}" placeholder="eyJhbGc…" type="password"></div>
 </div>
 ${connected?`<div style="margin-top:10px"><button class="btn bg bsm" onclick="disconnectCloud()" style="color:var(--ac3)">Se déconnecter (revenir en local vierge)</button></div>`:''}`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
  <button class="btn bp" id="cx-btn" onclick="connectCloud()">${connected?'Reconnecter & recharger':'Connecter'}</button>`
 );
}

async function connectCloud(){
 const url=(document.getElementById('cx-url')?.value||'').trim().replace(/\/$/,'');
 const key=(document.getElementById('cx-key')?.value||'').trim();
 if(!url||!key){toast('URL et clé requises','e');return;}
 const btn=document.getElementById('cx-btn');
 if(btn){btn.disabled=true;btn.textContent='Connexion…';}
 setSupabaseUrl(url);setSupabaseKey(key);_sbClient=null;
 // Tester + charger les données cloud
 const sb=getSB();
 if(!sb){if(btn){btn.disabled=false;btn.textContent='Connecter';}toast('Connexion impossible — vérifiez les identifiants','e');return;}
 try{
  await loadAllFromCloud();
  closeMo();
  updateConnIndicator();
  rDash();badges();
  if(typeof rCands==='function')rCands();
  toast('Connecté ✓ — données chargées','s');
 }catch(e){
  if(btn){btn.disabled=false;btn.textContent='Connecter';}
  toast('Erreur connexion : '+e.message,'e');
 }
}

function disconnectCloud(){
 setSupabaseUrl('');setSupabaseKey('');_sbClient=null;
 // Repasser en local vierge + reverrouiller derrière l'écran de connexion
 DB={candidates:[],companies:[],needs:[],agenda:[],posts:[],invoices:[],email_rules:[]};
 saveLocal();
 closeMo();
 if(typeof updateConnIndicator==='function')updateConnIndicator();
 if(typeof showConnGate==='function')showConnGate();
 toast('Déconnecté','i');
}

function updateConnIndicator(){
 const ind=document.getElementById('sync-ind');if(!ind)return;
 const connected=!!(getSupabaseUrl()&&getSupabaseKey());
 if(connected){ind.textContent='● Connecté';ind.style.color='var(--green)';ind.title='Cloud connecté — cliquez pour gérer';}
 else{ind.textContent='○ Connexion';ind.style.color='var(--mu2)';ind.title='Non connecté — cliquez pour connecter';}
}

function saveSettings(){
 // Profil utilisateur (PERSONNEL — chacun le sien, sert à signer ses mails)
 const nom=(document.getElementById('set-nom')?.value||'').trim();
 const tel=(document.getElementById('set-tel')?.value||'').trim();
 const userEmail=(document.getElementById('set-email')?.value||'').trim();
 localStorage.setItem(uKey('btp_user_name'), nom);
 localStorage.setItem(uKey('btp_user_tel'), tel);
 localStorage.setItem('btp_user_email', userEmail);

 // Business (PARTAGÉ — config d'agence, vu par Louis ET Corentin)
 const objCA=(document.getElementById('set-obj-ca')?.value||'10000').trim();
 const taux=(document.getElementById('set-taux')?.value||'18').trim();
 const dossierUrl=(document.getElementById('set-dossier')?.value||'').trim();
 localStorage.setItem('btp_obj_ca', objCA);       // miroir local
 localStorage.setItem(uKey('btp_taux_hon'), taux);// miroir local
 localStorage.setItem('btp_dossier_url', dossierUrl);

 // API key (PARTAGÉ)
 const k=document.getElementById('set-apikey')?.value.trim()||'';
 localStorage.setItem(uKey('btp_anthropic_key'),k); // miroir local

 // Pousser la config partagée vers le cloud (clé Anthropic + taux + objectif CA)
 saveSharedConfig({anthropic_key:k, taux_hon:taux, obj_ca:objCA});

 _sbClient=null;
 closeMo();

 // La base est toujours connectée au projet canonique → on resynchronise.
 const ind=document.getElementById('sync-ind');
 if(ind){ind.textContent='· Connexion…';ind.style.color='var(--ac4)';}
 clearTimeout(_syncTimer);_syncTimer=null;
 syncToSupabase();
 toast('Paramètres enregistrés — config partagée mise à jour ✓','s');
}

function exportData(){
 const data=JSON.stringify({db:DB,meta:{exported:new Date().toISOString(),version:'20'}},null,2);
 const blob=new Blob([data],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=`novalem-crm-${new Date().toISOString().slice(0,10)}.json`;
 a.click();URL.revokeObjectURL(url);
 toast('Données exportées ✓','s');
}

function importData(e){
 const file=e.target.files[0];if(!file)return;
 const reader=new FileReader();
 reader.onload=ev=>{
 try{
 const parsed=JSON.parse(ev.target.result);
 if(parsed.db){
 Object.assign(DB,parsed.db);
 } else if(parsed.candidates){
 Object.assign(DB,parsed);
 } else {
 toast('Format de fichier non reconnu','e');return;
 }
 save();
 // Refresh current view
 go(UI.view||'dash');
 toast('Données importées ✓ — CRM mis à jour','s');
 }catch(err){
 toast('Erreur import : '+err.message,'e');
 }
 };
 reader.readAsText(file);
}

function resetAllData(){
 DB.candidates=[];DB.companies=[];DB.needs=[];DB.agenda=[];DB.posts=[];DB.emails=[];
 save();go('dash');
 toast('Toutes les données ont été effacées','w');
}

// ═══════════════════════════════════════════════════════
// IA — EXTRACTION CV (Anthropic API)
// ═══════════════════════════════════════════════════════
async function aiExtractCV(candId){
 const c=cById(candId);if(!c)return;
 const key=getApiKey();
 if(!key){
 toast('Clé API manquante — configurez-la dans · Paramètres','e');
 return;
 }
 // Find uploaded CV doc
 const cvDoc=(c.docs||[]).find(d=>d.id==='cv'&&(d.file||d.storage_path||d.url||d._pg));
 if(!cvDoc){
 toast('Uploadez d\'abord le CV dans l\'onglet Fichiers','e');
 return;
 }
 const btn=document.getElementById(`ai-btn-${candId}`);
 if(btn){btn.textContent='Analyse en cours…';btn.disabled=true;}

 try{
 // Récupère le contenu du CV (bucket, base64 hérité, ou pièce déchargée) pour l'IA
 const conv=await docToBase64(cvDoc, candId);
 if(!conv||!conv.base64){ toast('Impossible de lire le CV','e'); if(btn){btn.textContent='Analyser CV';btn.disabled=false;} return; }
 const mediaType=conv.mediaType||'application/pdf';
 const base64Data=conv.base64;

 let messages;
 if(mediaType==='application/pdf'||mediaType.startsWith('image/')){
 messages=[{
 role:'user',
 content:[
 {type:mediaType==='application/pdf'?'document':'image',
 source:{type:'base64',media_type:mediaType,data:base64Data}},
 {type:'text',text:CV_PROMPT}
 ]
 }];
 } else {
 // Text-based fallback (shouldn't happen but safe)
 toast('Format non supporté — uploadez un PDF ou une image','e');
 if(btn){btn.textContent='Analyser CV';btn.disabled=false;}
 return;
 }

 const resp=await fetch('https://api.anthropic.com/v1/messages',{
 method:'POST',
 headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
 body:JSON.stringify({model:CV_AI_MODEL,max_tokens:CV_AI_MAX_TOKENS,messages})
 });

 if(!resp.ok){
 const err=await resp.json().catch(()=>({}));
 throw new Error(err.error?.message||`HTTP ${resp.status}`);
 }
 const data=await resp.json();
 const raw=data.content?.[0]?.text||'';

 // Parse JSON — strip potential markdown fences
 const clean=raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
 let extracted;
 try{extracted=JSON.parse(clean);}
 catch(e){throw new Error('Réponse IA non parseable: '+raw.slice(0,120));}

 // Apply extracted data to candidate
 const updates={};
 const fullName=[extracted.prenom,extracted.nom].filter(Boolean).join(' ').trim();
 if(fullName&&fullName!==c.name)updates.name=fullName;
 if(extracted.email&&!c.email)updates.email=extracted.email;
 if(extracted.telephone&&!c.phone)updates.phone=extracted.telephone;
 if(extracted.salaire_actuel&&!c.salary)updates.salary=extracted.salaire_actuel;
 if(extracted.disponibilite&&!c.avail)updates.avail=extracted.disponibilite;
 if(extracted.mobilite&&!c.mobility)updates.mobility=extracted.mobilite;
 // Build notes_pre from synthesis
 const notesPrefix=extracted.notes_synthese?`[IA] ${extracted.notes_synthese}\n\n`:'';
 if(notesPrefix&&!c.notes_pre)updates.notes_pre=notesPrefix.trim();
 // Find best matching role
 if(extracted.poste_cible||extracted.poste_actuel){
 const targetRole=extracted.poste_cible||extracted.poste_actuel;
 // Try to find a matching role in BTP_CATS
 const allJobs=BTP_CATS.flatMap(cat=>cat.jobs.map(j=>({j,cat:cat.id})));
 const match=allJobs.find(({j})=>j.toLowerCase().includes((targetRole||'').toLowerCase().slice(0,10)));
 if(match&&!c.role){updates.role=match.j;updates.cat=match.cat;}
 }
 updates.cv_extracted=extracted;
 updates.updated=now_();
 Object.assign(c,updates);
 save();

 // Show confirmation with what was filled
 const filled=Object.keys(updates).filter(k=>k!=='updated'&&k!=='cv_extracted');
 toast(`IA — ${filled.length} champ(s) rempli(s) : ${filled.join(', ')}`,'s');

 // Refresh panel
 if(UI.pid===candId)renderCandPanelTab(candId);
 rCands();

 }catch(err){
 console.error('AI extract error:',err);
 toast(`Erreur IA : ${err.message}`,'e');
 if(btn){btn.textContent='Analyser CV';btn.disabled=false;}
 }
}

// ═══════════════════════════════════════════════════════
// IA — GÉNÉRATION ANNONCE (Anthropic API)
// ═══════════════════════════════════════════════════════
async function aiGeneratePost(postId){
 const key=getApiKey();
 if(!key){toast('Clé API manquante — configurez-la dans · Paramètres','e');return;}

 // Read directly from the open form fields (works for new and existing posts)
 const title=document.getElementById('pf-t')?.value?.trim()||'';
 const location=document.getElementById('pf-loc')?.value||'';
 const salary=document.getElementById('pf-sal')?.value||'';
 const brief=document.getElementById('pf-brief')?.value||'';
 const catVal=document.getElementById('pf-cat')?.value||'go';
 const cat=getCat(catVal);

 if(!title){toast('Renseignez d\'abord le titre du poste','e');return;}

 const btn=document.getElementById('ai-post-btn');
 if(btn){btn.textContent='Génération…';btn.disabled=true;}

 const prompt=`Tu es expert en recrutement BTP. Rédige une annonce professionnelle et attractive.

Poste : ${title}
Secteur BTP : ${cat.l}
Localisation : ${location||'France'}
Salaire : ${salary||'Selon profil'}
Contexte : ${brief||'Cabinet de recrutement'}

Structure :
1) Présentation cabinet (2 lignes)
2) Missions (5 points bullet avec •)
3) Profil recherché (4 points bullet avec •)
4) Ce que nous offrons (3 points avec •)

Ton professionnel mais humain. Maximum 350 mots. Termine par une ligne "CDI · [avantages synthétisés]".
Réponds UNIQUEMENT avec le texte de l'annonce, sans titre, sans markdown, sans balises.`;

 try{
 const resp=await fetch('https://api.anthropic.com/v1/messages',{
 method:'POST',
 headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':key,'anthropic-dangerous-direct-browser-access':'true'},
 body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:900,messages:[{role:'user',content:prompt}]})
 });
 if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${resp.status}`);}
 const data=await resp.json();
 const text=data.content?.[0]?.text||'';
 const ta=document.getElementById('pf-body');
 if(ta){ta.value=text;ta.style.minHeight='200px';}
 toast('Annonce générée par IA','s');
 }catch(err){
 toast(`Erreur IA : ${err.message}`,'e');
 }finally{
 if(btn){btn.textContent=' Générer avec IA';btn.disabled=false;}
 }
}

// ═══════════════════════════════════════════════════════
// NOBIZ — FORMULAIRE EMAIL + ENVOI AUTO
// ═══════════════════════════════════════════════════════
function openNobizEmailForm(coId){
 const c=coById(coId);if(!c)return;
 closeProPopup_direct();
 // Set nobiz status + reminder
 c.status='nobiz';
 c.nobiz_date=now_();
 const remind=new Date();remind.setMonth(remind.getMonth()+1);
 c.nobiz_remind=remind.toISOString();
 c.updated=now_();
 save();

 openMo(` Pas de besoin — ${esc(c.name)}`,`
 <div style="background:rgba(61,224,154,.06);border:1px solid rgba(61,224,154,.2);border-radius:3px;padding:9px 12px;margin-bottom:14px;font-size:11px;color:var(--ac2)">
 Entreprise classée "Pas de besoin" · Rappel automatique dans 1 mois
 </div>
 <div class="fg">
 <div class="fgrp"><span class="lbl">Prénom du contact</span><input id="nb-fn" value="${esc(c.contact?c.contact.split(' ')[0]:'')}" placeholder="Jean"></div>
 <div class="fgrp"><span class="lbl">Email du contact</span><input id="nb-em" type="email" value="${esc(c.email||'')}" placeholder="jean@entreprise.fr"></div>
 <div class="fgrp ff"><span class="lbl">Note interne (facultatif)</span><input id="nb-note" placeholder="Ex : rappeler en mars, intéressé pour l'année prochaine…"></div>
 </div>
 <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--bd)">
 <div class="lbl">Email de présentation à envoyer (modifiable)</div>
 <textarea id="nb-email-body" style="min-height:150px;font-size:11px;line-height:1.6;margin-top:4px">${buildNobizEmail(c)}</textarea>
 </div>`,
 `<button class="btn bg" onclick="closeMo();rPros()">Fermer sans email</button>
 <button class="btn bg" onclick="copyNobizEmail()">Copier email</button>
 ${c.email?`<a class="btn bi" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Présentation Novalem — Cabinet de recrutement')}&body=${encodeURIComponent(buildNobizEmail(c))}" target="_blank" onclick="saveNobizNote('${coId}')">Ouvrir messagerie</a>`:''}
 <button class="btn bp" onclick="saveNobizNote('${coId}')">Valider</button>`
);
}

function buildNobizEmail(c){
 const fn=greetCo(c);
 return`Bonjour${fn?' '+fn:''},\n\nSuite à notre échange téléphonique, je vous remercie pour votre temps.\n\nJe me permets de vous faire parvenir une courte présentation de Novalem, cabinet de recrutement spécialisé dans le secteur du BTP.\n\nNous accompagnons les entreprises du bâtiment et des travaux publics dans leurs recrutements CDI : conducteurs de travaux, chefs de chantier, ingénieurs études, profils VRD/HSE, management et encadrement.\n\nSi à l'avenir un besoin de recrutement devait se présenter dans votre structure, n'hésitez pas à revenir vers moi — je serai heureux(se) de vous accompagner.\n\nBonne journée,\n[VOTRE NOM]\nNovalem — Cabinet de recrutement\n[VOTRE TÉLÉPHONE]`;
}
function copyNobizEmail(){
 const ta=document.getElementById('nb-email-body');
 if(!ta)return;
 navigator.clipboard.writeText(ta.value).then(()=>toast('Email copié ✓','i'));
}
function saveNobizNote(coId){
 const c=coById(coId);if(!c)return;
 const note=document.getElementById('nb-note')?.value||'';
 const email=document.getElementById('nb-em')?.value||'';
 if(note)c.notes=(c.notes?c.notes+'\n':'')+`[Pas de besoin] ${note}`;
 if(email&&!c.email)c.email=email;
 c.updated=now_();
 save();
 closeMo();
 rPros();
 badges();
 toast(`${c.name} → Pas de besoin · Rappel ${fD(c.nobiz_remind)}`,'w');
}

// ═══════════════════════════════════════════════════════
// ANNONCES — PUBLICATION JOB BOARDS
// ═══════════════════════════════════════════════════════
// Board config: direct post URL + deep link patterns for pre-filled posting
const BOARD_CONFIG={
 'France Travail':{
 url:'https://www.pole-emploi.fr/employeur/vos-recrutements/publier-une-offre.html',
 deeplink:(p)=>`https://www.francetravail.fr/employeur`,
 canAutopost:true,
 tip:'Publication automatique via API officielle (vérification JCMO incluse).'
 },
 'Indeed':{
 url:'https://employers.indeed.com/p/post-job',
 deeplink:(p)=>`https://employers.indeed.com/p/post-job?jobTitle=${encodeURIComponent(p.title)}&location=${encodeURIComponent(p.location||'')}`,
 canAutopost:false,
 tip:'Lien pré-rempli avec le titre et la ville. Copiez le corps de l\'annonce.'
 },
 'LinkedIn Jobs':{
 url:'https://www.linkedin.com/talent/post-a-job',
 deeplink:(p)=>`https://www.linkedin.com/talent/post-a-job?title=${encodeURIComponent(p.title)}&location=${encodeURIComponent(p.location||'')}`,
 canAutopost:false,
 tip:'Lien pré-rempli. Nécessite un compte LinkedIn Recruiter ou Company Page.'
 },
 'APEC':{
 url:'https://recruteurs.apec.fr/Offres/deposer-offre',
 deeplink:(p)=>`https://recruteurs.apec.fr/Offres/deposer-offre`,
 canAutopost:false,
 tip:'Gratuit pour les cadres. Copiez l\'annonce générée.'
 },
 'Welcome to the Jungle':{
 url:'https://www.welcometothejungle.com/fr/companies',
 deeplink:(p)=>`https://www.welcometothejungle.com/fr/companies`,
 canAutopost:false,
 tip:'Nécessite un compte entreprise WTJ payant.'
 },
 'Monster':{
 url:'https://hiring.monster.fr/',
 deeplink:(p)=>`https://hiring.monster.fr/`,
 canAutopost:false,
 tip:'Compte recruteur Monster requis.'
 },
 'Meteojob':{
 url:'https://www.meteojob.com/recruteur',
 deeplink:(p)=>`https://www.meteojob.com/recruteur`,
 canAutopost:false,
 tip:'Compte recruteur Meteojob requis.'
 },
};

// ─── Publication job boards ────────────────────────────────
// Détecte si le CRM tourne sur Vercel (API auto-post disponible)
// ou en local (liens manuels uniquement)
function getApiBase(){
 // L'envoi d'email et les appels serveur passent par /api/... (fonctions Vercel).
 // Indisponible uniquement si la page est ouverte en fichier local (file://) :
 // dans ce cas il faut utiliser l'adresse EN LIGNE (ex: https://novalem-crm.vercel.app).
 if(window.location.protocol==='file:') return null;
 if(!window.location.hostname) return null;
 return window.location.origin; // https://…vercel.app  ·  http://localhost:3000 (vercel dev)
}

function openPublishPanel(postId){
 const p=DB.posts.find(x=>x.id===postId);if(!p)return;
 const selectedBoards=p.boards||[];
 const apiBase=getApiBase();
 const isVercel=!!apiBase;
 const bodyPreview=(p.body||'').slice(0,180)+(p.body?.length>180?'…':'');

 const boardRows=selectedBoards.map(b=>{
 const cfg=BOARD_CONFIG[b]||{url:'#',tip:'',canAutopost:false};
 const isPublished=(p.published_on||[]).includes(b);
 const canAuto=isVercel&&cfg.canAutopost;

 if(isPublished){
 return`<div class="board-row">
 <div class="board-name">${esc(b)}</div>
 <div style="font-size:10px;color:var(--mu);flex:1"></div>
 <span class="board-status bst-live">✓ Publié</span>
 <button class="btn bg bxs" onclick="unmarkBoard('${postId}','${esc(b)}')">Annuler</button>
 </div>`;
 }
 return`<div class="board-row">
 <div class="board-name">${esc(b)}</div>
 <div style="font-size:10px;color:var(--mu);flex:1;padding:0 8px">${esc(cfg.tip)}</div>
 ${canAuto
 ?`<button class="btn bp bxs" id="pub-btn-${b.replace(/\s/g,'')}" onclick="autoPostToBoard('${postId}','${esc(b)}')"> Poster auto</button>`
 :`<a href="${cfg.deeplink(p)}" target="_blank" class="btn bg bxs" onclick="markBoardPublished('${postId}','${esc(b)}')">Ouvrir site →</a>`
 }
 </div>`;
 }).join('');

 openMo(`Publier — ${esc(p.title)}`,`
 <div style="margin-bottom:12px">
 <div class="lbl mb4">Aperçu</div>
 <div class="notebox fs10" style="max-height:70px;overflow:hidden">${esc(bodyPreview)}</div>
 <button class="btn bg bxs mt4" onclick="copyPostBody('${postId}')">Copier l'annonce complète</button>
 </div>

 ${isVercel?`
 <div style="padding:8px 11px;background:rgba(61,224,154,.07);border:1px solid rgba(61,224,154,.2);border-radius:3px;font-size:10px;color:var(--ac2);margin-bottom:10px">
 <strong>Mode Vercel actif</strong> — La publication automatique est disponible pour France Travail (si clés configurées dans les variables d'env Vercel).
 </div>`:`
 <div style="padding:8px 11px;background:rgba(74,130,224,.07);border:1px solid rgba(74,130,224,.2);border-radius:3px;font-size:10px;color:var(--ac5);margin-bottom:10px">
 <strong>Mode local</strong> — Publiez sur Vercel pour activer la publication automatique France Travail. En attendant, copiez l'annonce et utilisez les liens directs.
 </div>`}

 <div class="lbl mb6">Boards sélectionnés</div>
 ${boardRows||'<div class="mu_ fs11">Aucun board sélectionné — modifiez l\'annonce pour en ajouter.</div>'}

 <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--bd)">
 <button class="btn bg bsm" onclick="genBoardTexts('${postId}')">Textes adaptés par board</button>
 </div>`,
 `<button class="btn bg" onclick="closeMo()">Fermer</button>
 <button class="btn bp" onclick="copyPostBody('${postId}')">Copier annonce</button>`
);
}

function copyPostBody(postId){
 const p=DB.posts.find(x=>x.id===postId);if(!p)return;
 const full=`${p.title}\n${p.location||''} | ${p.salary||''}\n\n${p.body||''}`;
 navigator.clipboard.writeText(full).then(()=>toast('Annonce copiée ✓ — prête à coller','i'));
}

function markBoardPublished(postId,board){
 const p=DB.posts.find(x=>x.id===postId);if(!p)return;
 p.published_on=p.published_on||[];
 if(!p.published_on.includes(board)){p.published_on.push(board);p.status='active';p.updated=now_();save();}
 setTimeout(()=>openPublishPanel(postId),300);
 toast(`${board} — marqué publié ✓`,'s');
}

function unmarkBoard(postId,board){
 const p=DB.posts.find(x=>x.id===postId);if(!p)return;
 p.published_on=(p.published_on||[]).filter(b=>b!==board);
 p.updated=now_();save();
 setTimeout(()=>openPublishPanel(postId),300);
 toast(`${board} — dépublié`,'w');
}

// Appel vers le backend Vercel (France Travail auto-post)
async function autoPostToBoard(postId,board){
 const p=DB.posts.find(x=>x.id===postId);if(!p)return;
 const apiBase=getApiBase();if(!apiBase){toast('Mode local — déployez sur Vercel pour publier','w');return;}
 const btn=document.getElementById('pub-btn-'+board.replace(/\s/g,''));
 const originalLabel=btn?btn.textContent:'';
 if(btn){btn.textContent='⏳ Vérif JCMO…';btn.disabled=true;}

 try{
  if(btn)btn.textContent='⏳ Publication…';
  const resp=await fetch(`${apiBase}/api/jobs`,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'post_job',board,post:{title:p.title,location:p.location,salary:p.salary,body:p.body,cat:p.cat}})
  });
  const result=await resp.json().catch(()=>({}));

  // 422 = annonce non conforme (JCMO a bloqué)
  if(resp.status===422){
   if(btn){btn.textContent=originalLabel||'Poster auto';btn.disabled=false;}
   const issues=(result.issues||[]).join('\n• ');
   toast(`Publication bloquée — corrigez l'annonce :\n• ${issues}`,'e');
   // Stocke pour affichage dans le panneau
   p.jcmo_issues=result.issues||[];p.jcmo_ok=false;save();
   setTimeout(()=>openPublishPanel(postId),300);
   return;
  }
  if(!resp.ok){
   throw new Error(result.error||`HTTP ${resp.status}`);
  }

  // Succès : stocke la référence officielle et l'URL
  p.published_on=p.published_on||[];
  if(!p.published_on.includes(board))p.published_on.push(board);
  p.ft_reference=result.reference||null;
  p.ft_url=result.url||null;
  p.ft_published_at=result.publishedAt||new Date().toISOString();
  p.status='active';
  p.updated=now_();
  save();rPosts();
  setTimeout(()=>openPublishPanel(postId),300);
  toast(`Publié sur ${board} ✓ — Réf: ${result.reference||'OK'}`,'s');

 }catch(err){
  if(btn){btn.textContent=originalLabel||'Poster auto';btn.disabled=false;}
  toast(`Erreur ${board}: ${err.message}`,'e');
 }
}

// ═══════════════════════════════════════════════════════
// EMAILS — vue principale (refonte complète)
// ═══════════════════════════════════════════════════════

// ── État global composeur ────────────────────────────

// ═══════════════════════════════════════════════════════
// EMAIL — Section complète
// Inbox IMAP · Composition · Envoyés · Brouillons
// Liens cliquables · Recherche · Actions rapides
// ═══════════════════════════════════════════════════════

let EM_VIEW='inbox';
let INBOX_CACHE=null;
let INBOX_LOADING=false;
let INBOX_UNREAD=0;
let _emRefreshTimer=null;
let _inboxSearch='';
let _inboxFilter='all'; // 'all'|'unread'|'starred'
let AI_PANEL_OPEN=false;

// ── Templates ────────────────────────────────────────
const EMAIL_TPLS={
  invitation_booking:{
    label:'Invitation entretien (auto-booking)',
    to:(c)=>c.email||'',
    subject:()=>'Votre entretien Novalem — réservez votre créneau',
    body:(c,nom,tel)=>{
      const firstN=greetCand(c);
      const link=(typeof getApiBase==='function'&&getApiBase()||'https://novalem-crm.vercel.app')+'/dossier.html?cid='+encodeURIComponent(c.id||'')+(c.booking&&c.booking.token?('&bk='+c.booking.token):'')+'&n='+encodeURIComponent(c.name||'');
      return `Bonjour ${firstN},

Suite à notre échange, je souhaite organiser un entretien${c.role?(' pour le poste de '+c.role):''}.

Pour avancer, complétez votre dossier de candidature et choisissez directement le créneau qui vous convient :

[Compléter mon dossier et choisir mon créneau](${link})

---
**Vos données sont en sécurité.** Novalem est un cabinet de recrutement déclaré. Les informations transmises servent uniquement à constituer votre dossier et à le présenter aux entreprises qui recrutent. Jamais revendues, conformément au RGPD.

À très vite,
${nom||'[Votre nom]'}${tel?'\n'+tel:''}
Novalem — Cabinet de recrutement BTP`;
    }
  },
  precal:{
    label:'Confirmation précal + dossier',
    to:(c)=>c.email||'',
    subject:(c)=>`Novalem — Suite à notre échange | ${c.role||'Poste BTP'}`,
    body:(c,nom,tel)=>`Bonjour ${greetCand(c)},

Suite à notre échange téléphonique, je vous confirme notre entretien visio :

  Date : ${c.int_date_planned?fD(c.int_date_planned):'[DATE]'} à ${c.int_time||'[HEURE]'}
  Lien : ${c.visio_link||'[LIEN À INSÉRER]'}

Merci de vous connecter 2-3 minutes avant l'heure.

Documents à retourner :
  - CV à jour
  - Pièce d'identité (recto/verso)
  - Permis de conduire (si applicable)

En cas de question, n'hésitez pas à me contacter.

Bien cordialement,
${nom||'[Votre nom]'}${tel?'\n'+tel:''}
Novalem — Cabinet de recrutement`
  },
  relance:{
    label:'Relance dossier',
    to:(c)=>c.email||'',
    subject:(c)=>`[Relance] Dossier de candidature — ${(c.name||'').split(' ')[0]||''}`,
    body:(c,nom,tel)=>`Bonjour ${greetCand(c)},

Je me permets de vous relancer concernant votre dossier de candidature.

Sans les documents complets, je ne pourrai pas transmettre votre profil à nos clients.

Pourriez-vous me faire parvenir les éléments manquants dans les meilleurs délais ?

Merci pour votre réactivité,
${nom||'[Votre nom]'}${tel?'\n'+tel:''}
Novalem — Cabinet de recrutement`
  },
  envoi_profil:{
    label:'Envoi profil au client',
    to:()=>'',
    subject:(c)=>`Novalem — Profil candidat | ${c.role||'Poste BTP'}`,
    body:(c,nom,tel)=>`Bonjour,

Comme convenu, je vous transmets le profil de ${c.name||'[CANDIDAT]'} pour le poste de ${c.role||'[POSTE]'}.

Résumé du profil :
  Poste ciblé : ${c.role||'—'}
  Disponibilité : ${c.avail||'—'}
  Mobilité : ${c.mobility||'—'}
  Prétentions : ${c.salary?c.salary+'€ brut/an':'—'}
${c.notes_pre?'\nNotes : '+c.notes_pre:''}

Le dossier complet est disponible sur simple demande.

Je reste disponible pour tout échange,
${nom||'[Votre nom]'}${tel?'\n'+tel:''}
Novalem — Cabinet de recrutement`
  },
  retour_client:{
    label:'Demande retour client',
    to:()=>'',
    subject:(c)=>`Novalem — Retour sur le profil ${c.name||'candidat'}`,
    body:(c,nom,tel)=>`Bonjour,

Je me permets de vous recontacter concernant le profil de ${c.name||'[CANDIDAT]'} que je vous ai transmis récemment.

Avez-vous eu l'occasion d'en prendre connaissance ? Seriez-vous disponible pour un échange ?

Je reste à votre disposition,
${nom||'[Votre nom]'}${tel?'\n'+tel:''}
Novalem — Cabinet de recrutement`
  },
  placement:{
    label:'Confirmation placement',
    to:()=>'',
    subject:(c)=>`Novalem — Confirmation de placement | ${c.name||''}`,
    body:(c,nom,tel)=>`Bonjour,

J'ai le plaisir de vous confirmer le placement de ${c.name||'[CANDIDAT]'} sur le poste de ${c.role||'[POSTE]'}.

Date de prise de poste : [DATE]
Salaire convenu : ${c.salary?c.salary+'€ brut/an':'[SALAIRE]'}

Notre note d'honoraires vous parviendra prochainement.

Merci pour votre confiance,
${nom||'[Votre nom]'}${tel?'\n'+tel:''}
Novalem — Cabinet de recrutement`
  },
  blank:{
    label:'Email vide',
    to:()=>'',
    subject:()=>'',
    body:(c,nom,tel)=>`Bonjour,



Cordialement,
${nom||'[Votre nom]'}${tel?'\n'+tel:''}
Novalem — Cabinet de recrutement`
  }
};

// ── State compose ─────────────────────────────────────
let EM={to:'',subject:'',body:'',candId:null,coId:null,tplKey:null};

// ── Utilitaire: détecter et rendre les liens cliquables ─
function renderBodyWithLinks(text){
  if(!text)return'<span style="color:var(--mu2);font-style:italic">Corps vide</span>';
  // Échapper HTML d'abord
  const escaped=text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
  // Détecter URLs (http/https/www) et les rendre cliquables
  const withLinks=escaped.replace(
    /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi,
    (url)=>{
      const href=url.startsWith('http')?url:'https://'+url;
      return`<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--blue);text-decoration:underline;word-break:break-all" onclick="event.stopPropagation()">${url}</a>`;
    }
  );
  // Détecter emails aussi
  const withEmailLinks=withLinks.replace(
    /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" style="color:var(--green);text-decoration:underline">$1</a>'
  );
  return withEmailLinks;
}

// ── Main render ───────────────────────────────────────
function rEmails(){
  const el=document.getElementById('view-emails');if(!el)return;
  const nom=localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||'';
  const tel=localStorage.getItem(uKey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'';
  const history=(DB.emails||[]).slice().reverse().slice(0,100);
  const drafts=(DB.drafts||[]);
  const cands=DB.candidates.filter(c=>c.email).sort((a,b)=>a.name.localeCompare(b.name));
  const cos=DB.companies.filter(c=>c.email).sort((a,b)=>a.name.localeCompare(b.name));

  el.innerHTML=`
  <div style="display:grid;grid-template-columns:200px 1fr;height:calc(100vh - 110px);background:var(--s1);border:1px solid var(--bd);border-radius:8px;overflow:hidden">

    <!-- Sidebar -->
    <div style="border-right:1px solid var(--bd);display:flex;flex-direction:column;background:var(--s2)">
      <div style="padding:12px 10px;border-bottom:1px solid var(--bd)">
        <button class="btn bp btn-full" onclick="emShowView('compose')" style="font-size:11px;letter-spacing:.02em">Nouveau message</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:6px">
        ${[
          ['inbox','Boite de reception',INBOX_UNREAD],
          ['dossiers','Dossiers',0],
          ['compose','Rediger',0],
          ['sent','Envoyes',history.length],
          ['drafts','Brouillons',drafts.length],
        ].map(([v,l,n])=>`
          <div class="em-nav-item ${EM_VIEW===v?'em-nav-act':''}" onclick="emShowView('${v}')" id="${v==='inbox'?'em-nav-inbox':''}">
            ${l}
            ${n>0?`<span class="nbadge ${v==='inbox'?'nb-red':'nb-mu'}" style="margin-left:auto;${v==='inbox'&&INBOX_UNREAD===0?'display:none':''}">${n}</span>`:''}
          </div>`).join('')}
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);padding:12px 8px 4px">Templates</div>
        ${Object.entries(EMAIL_TPLS).map(([k,t])=>`
          <div class="em-nav-item" onclick="emQuickTpl('${k}')" style="font-size:10px;padding:5px 9px;color:var(--mu2)">${t.label}</div>
        `).join('')}
      </div>
      <!-- Signature info -->
      <div style="padding:10px 12px;border-top:1px solid var(--bd);font-size:10px">
        ${nom
          ?`<div style="color:var(--mu2);font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Signature</div>
             <div style="color:var(--mu);line-height:1.5">${esc(nom)}${tel?'<br>'+esc(tel):''}</div>`
          :`<div style="color:var(--orange);font-size:10px">Signature non configurée</div>`}
        <button class="btn bg bxs" style="margin-top:6px;width:100%;justify-content:center;font-size:9px" onclick="openSettings()">Parametres</button>
      </div>
    </div>

    <!-- Zone principale -->
    <div id="em-main" style="display:flex;flex-direction:column;overflow:hidden;min-height:0">
      ${emRenderView(EM_VIEW,cands,cos,history,drafts,nom,tel)}
    </div>
  </div>`;

  // Auto-refresh inbox toutes les 3 min
  clearInterval(_emRefreshTimer);
  _emRefreshTimer=setInterval(()=>{
    if(EM_VIEW==='inbox')emFetchInbox(false);
  },3*60*1000);
}

function emRenderView(view,cands,cos,history,drafts,nom,tel){
  if(view==='inbox')   return emRenderInbox();
  if(view==='sent')    return emRenderSent(history,cands);
  if(view==='drafts')  return emRenderDrafts(drafts,cands);
  if(view==='dossiers')return emRenderDossiers();
  return emRenderCompose(cands,cos,nom,tel);
}

function emShowView(view){
  EM_VIEW=view;
  closeAiPanel();
  const nom=localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||'';
  const tel=localStorage.getItem(uKey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'';
  const history=(DB.emails||[]).slice().reverse().slice(0,100);
  const drafts=(DB.drafts||[]);
  const cands=DB.candidates.filter(c=>c.email).sort((a,b)=>a.name.localeCompare(b.name));
  const cos=DB.companies.filter(c=>c.email).sort((a,b)=>a.name.localeCompare(b.name));
  const main=document.getElementById('em-main');
  if(main)main.innerHTML=emRenderView(view,cands,cos,history,drafts,nom,tel);
  // Update nav
  document.querySelectorAll('.em-nav-item').forEach(el=>{
    const id=el.id;
    const text=el.textContent.trim().toLowerCase();
    el.classList.toggle('em-nav-act',
      (view==='inbox'&&(id==='em-nav-inbox'||text.includes('boite')))||
      (view==='compose'&&text.includes('redig'))||
      (view==='sent'&&text.includes('envoy'))||
      (view==='drafts'&&text.includes('brouillon'))
    );
  });
  if(view==='inbox')emFetchInbox(false);
}

// ── INBOX ─────────────────────────────────────────────
function emRenderInbox(){
  const apiBase=getApiBase();
  if(!apiBase){
    return`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--mu2);text-align:center;padding:40px">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v2.92z"/></svg>
      <div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--tx);margin-bottom:6px">Disponible sur Vercel uniquement</div>
        <div style="font-size:11px;line-height:1.7">Configure les variables IMAP dans les Parametres Vercel :</div>
        <div style="margin-top:10px;background:var(--s3);border:1px solid var(--bd);border-radius:6px;padding:10px 14px;font-size:10px;text-align:left;line-height:2;font-family:'DM Mono',monospace">
          IMAP_HOST — ssl0.ovh.net<br>
          IMAP_USER — contact@novalem-recrutement.fr<br>
          IMAP_PASS — mot de passe OVH<br>
          IMAP_PORT — 993
        </div>
      </div>
    </div>`;
  }
  if(INBOX_LOADING&&!INBOX_CACHE){
    return`<div style="display:flex;align-items:center;justify-content:center;gap:12px;height:100%;color:var(--mu)">
      <div style="width:18px;height:18px;border:2px solid var(--bd2);border-top-color:var(--green);border-radius:50%;animation:spin .7s linear infinite"></div>
      Chargement...
    </div>`;
  }
  if(!INBOX_CACHE){
    setTimeout(()=>emFetchInbox(true),100);
    return`<div style="display:flex;align-items:center;justify-content:center;gap:12px;height:100%;color:var(--mu)">
      <div style="width:18px;height:18px;border:2px solid var(--bd2);border-top-color:var(--green);border-radius:50%;animation:spin .7s linear infinite"></div>
      Connexion IMAP...
    </div>`;
  }
  if(!INBOX_CACHE.emails?.length){
    return`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--mu2)">
      <div style="font-size:13px;color:var(--tx)">Boite vide</div>
      <div style="font-size:11px">Verifiez la config IMAP dans Parametres Vercel</div>
      <button class="btn bg bsm" onclick="emFetchInbox(true)">Actualiser</button>
    </div>`;
  }

  // Filtres
  let emails=INBOX_CACHE.emails;
  if(_inboxFilter==='unread')emails=emails.filter(e=>!e.seen);
  if(_inboxFilter==='starred')emails=emails.filter(e=>e._starred);
  if(_inboxSearch){
    const q=_inboxSearch.toLowerCase();
    emails=emails.filter(e=>(e.subject||'').toLowerCase().includes(q)||(e.from||'').toLowerCase().includes(q)||(e.snippet||'').toLowerCase().includes(q));
  }

  const ago=(iso)=>{
    const diff=Date.now()-new Date(iso).getTime();
    const m=Math.floor(diff/60000);
    if(m<1)return'maintenant';if(m<60)return m+'min';
    const h=Math.floor(m/60);if(h<24)return h+'h';
    const d=Math.floor(h/24);if(d<7)return d+'j';
    return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
  };

  const unread=INBOX_CACHE.emails.filter(e=>!e.seen).length;
  const fetchedMin=INBOX_CACHE.fetchedAt?Math.floor((Date.now()-INBOX_CACHE.fetchedAt)/60000):0;

  return`
    <!-- Barre de recherche + filtres -->
    <div style="padding:10px 12px;border-bottom:1px solid var(--bd);background:var(--s2);flex-shrink:0;display:flex;align-items:center;gap:8px">
      <div style="position:relative;flex:1">
        <input id="inbox-search" value="${esc(_inboxSearch)}" placeholder="Rechercher..." 
          oninput="_inboxSearch=this.value;const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderInbox()"
          style="padding-left:28px;font-size:11px;background:var(--s3);border:1px solid var(--bd)">
        <svg style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--mu2)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <div style="display:flex;gap:3px">
        ${['all','unread','starred'].map(f=>`<button onclick="_inboxFilter='${f}';const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderInbox()" style="padding:4px 9px;font-size:9px;border-radius:99px;border:1px solid var(--bd2);background:${_inboxFilter===f?'var(--ac)':'var(--s3)'};color:${_inboxFilter===f?'#0a0a08':'var(--mu)'};cursor:pointer;transition:.15s;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em">${{all:'Tous',unread:'Non lus',starred:'Importants'}[f]}</button>`).join('')}
      </div>
      <button class="btn bg bxs" onclick="emFetchInbox(true)" style="flex-shrink:0;font-size:10px" title="Actualiser">
        ${INBOX_LOADING?'..':'↺'}
      </button>
    </div>
    <!-- Infos barre -->
    <div style="padding:5px 14px;border-bottom:1px solid var(--bd);background:var(--s2);font-size:10px;color:var(--mu2);display:flex;align-items:center;gap:8px;flex-shrink:0">
      ${unread>0?`<span style="color:var(--green);font-weight:600">${unread} non lu${unread>1?'s':''}</span> ·`:''} 
      ${emails.length} email${emails.length>1?'s':''}
      ${fetchedMin>0?`· actualise il y a ${fetchedMin}min`:''}
      ${_inboxSearch||_inboxFilter!=='all'?`<button onclick="_inboxSearch='';_inboxFilter='all';const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderInbox()" style="margin-left:auto;font-size:9px;color:var(--mu);background:none;border:none;cursor:pointer;font-family:'DM Mono',monospace">Effacer filtres ×</button>`:''}
    </div>
    <!-- Liste emails -->
    <div style="overflow-y:auto;flex:1">
      ${emails.length?emails.map(email=>{
        const matchCand=DB.candidates.find(c=>c.email&&email.fromEmail&&c.email.toLowerCase()===email.fromEmail?.toLowerCase());
        const matchCo=DB.companies.find(c=>c.email&&email.fromEmail&&c.email.toLowerCase()===email.fromEmail?.toLowerCase());
        const match=matchCand||matchCo;
        return`<div class="inbox-item ${!email.seen?'unread':''}" style="display:flex;align-items:stretch">
          <div style="flex:1;cursor:pointer;padding:10px 14px 10px 8px" onclick="emOpenEmail('${email.uid}')">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <div style="width:6px;flex-shrink:0">${!email.seen?`<div style="width:6px;height:6px;border-radius:50%;background:var(--ac);margin-top:2px"></div>`:''}</div>
              <span class="inbox-from" style="font-weight:${email.seen?'400':'600'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(email.from||email.fromEmail||'—')}</span>
              ${match?`<span class="inbox-cand-match" style="flex-shrink:0">${esc(match.name)}</span>`:''}
              ${email.attachments?.length?`<span class="inbox-attach" style="flex-shrink:0">${email.attachments.length} PJ</span>`:''}
              <span class="inbox-date" style="flex-shrink:0">${ago(email.date)}</span>
            </div>
            <div class="inbox-subj" style="padding-left:12px">${esc(email.subject||'(sans objet)')}</div>
            <div class="inbox-snip" style="padding-left:12px">${esc(email.snippet||'')}</div>
          </div>
          <!-- Actions rapides au survol -->
          <div style="display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 8px;border-left:1px solid var(--bd);opacity:0;transition:.15s" 
               class="inbox-actions"
               onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
            <button onclick="event.stopPropagation();email._starred=!email._starred;const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderInbox()" 
              style="background:none;border:none;cursor:pointer;font-size:13px;color:${email._starred?'var(--orange)':'var(--mu2)'};padding:2px;transition:.15s;line-height:1" title="Important">${email._starred?'★':'☆'}</button>
            <button onclick="event.stopPropagation();emArchiveEmail('${email.uid}')" 
              style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--mu2);padding:2px;transition:.15s;line-height:1;font-family:'DM Mono',monospace" title="Archiver">▼</button>
            <button onclick="event.stopPropagation();emDeleteEmail('${email.uid}')" 
              style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--mu2);padding:2px;transition:.15s;line-height:1" 
              onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--mu2)'" title="Supprimer">×</button>
          </div>
        </div>`;
      }).join(''):`<div style="padding:40px;text-align:center;color:var(--mu2);font-size:11px">Aucun email${_inboxSearch?' pour "'+esc(_inboxSearch)+'"':''}</div>`}
    </div>`;
}

// ── Fetch IMAP ────────────────────────────────────────
async function emFetchInbox(forceRefresh=false){
  const apiBase=getApiBase();if(!apiBase)return;
  if(!forceRefresh&&INBOX_CACHE?.fetchedAt&&(Date.now()-INBOX_CACHE.fetchedAt)<3*60*1000)return;
  if(INBOX_LOADING)return;
  INBOX_LOADING=true;
  const main=document.getElementById('em-main');
  if(main&&EM_VIEW==='inbox')main.innerHTML=emRenderInbox();
  try{
    const resp=await fetch(`${apiBase}/api/imap`,{method:'GET',headers:{'Content-Type':'application/json'}});
    const data=await resp.json();
    if(!resp.ok)throw new Error(data.error||'Erreur serveur');
    INBOX_CACHE={emails:data.emails||[],fetchedAt:Date.now()};
    INBOX_UNREAD=INBOX_CACHE.emails.filter(e=>!e.seen).length;
    applyEmailRules();
    const badge=document.getElementById('em-inbox-badge');
    if(badge){badge.textContent=INBOX_UNREAD;badge.style.display=INBOX_UNREAD>0?'inline-flex':'none';}
  }catch(err){
    console.warn('IMAP error:',err);
    if(main&&EM_VIEW==='inbox')main.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--mu2)">
      <div style="font-size:13px;color:var(--red)">Connexion impossible</div>
      <div style="font-size:11px">${esc(err.message)}</div>
      <button class="btn bg bsm" onclick="emFetchInbox(true)">Reessayer</button>
    </div>`;
    INBOX_LOADING=false;return;
  }
  INBOX_LOADING=false;
  if(main&&EM_VIEW==='inbox')main.innerHTML=emRenderInbox();
}

// ── Ouvrir un email ───────────────────────────────────
async function emOpenEmail(uid){
  if(!INBOX_CACHE?.emails)return;
  const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));
  if(!email)return;
  email.seen=true;
  INBOX_UNREAD=Math.max(0,INBOX_UNREAD-1);
  const badge=document.getElementById('em-inbox-badge');
  if(badge){badge.textContent=INBOX_UNREAD;badge.style.display=INBOX_UNREAD>0?'inline-flex':'none';}
  const apiBase=getApiBase();
  if(apiBase)fetch(`${apiBase}/api/imap`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mark-read',uid:email.uid})}).catch(()=>{});

  const matchCand=DB.candidates.find(c=>c.email&&email.fromEmail&&c.email.toLowerCase()===email.fromEmail?.toLowerCase());
  const matchCo=DB.companies.find(c=>c.email&&email.fromEmail&&c.email.toLowerCase()===email.fromEmail?.toLowerCase());
  const existingRule=getEmailRule(email.fromEmail);
  if(existingRule?.autoLog&&existingRule.entityType==='co'){
    const already=(coById(existingRule.entityId)?.timeline||[]).find(t=>t.extra===String(email.uid));
    if(!already)addTimeline(existingRule.entityId,'email',`De : ${email.from||email.fromEmail}\nObjet : ${email.subject||'(sans objet)'}\n${(email.snippet||'').slice(0,150)}`,String(email.uid));
  }

  const main=document.getElementById('em-main');if(!main)return;

  // Banner liaison fiche
  const linkedEntity=existingRule?(existingRule.entityType==='co'?coById(existingRule.entityId):cById(existingRule.entityId)):null;
  let linkBanner='';
  if(linkedEntity&&existingRule?.autoLog){
    linkBanner=`<div style="padding:8px 14px;background:var(--green-dim);border-bottom:1px solid var(--green-border);font-size:11px;display:flex;align-items:center;gap:8px">
      <span style="color:var(--green)">Auto-lie a</span>
      <strong style="cursor:pointer;color:var(--green)" onclick="${existingRule.entityType==='co'?`openCoPanel('${existingRule.entityId}')`:''}">${esc(linkedEntity.name)}</strong>
      <button class="btn bg bxs" style="margin-left:auto;font-size:9px" onclick="DB.email_rules=(DB.email_rules||[]).filter(r=>r.id!=='${existingRule.id}');save();emOpenEmail('${uid}');toast('Regle supprimee','w')">Desactiver</button>
    </div>`;
  } else if(matchCo||matchCand){
    const entity=matchCo||matchCand;const etype=matchCo?'co':'cand';const eid=entity.id;
    linkBanner=`<div style="padding:10px 14px;background:var(--blue-dim);border-bottom:1px solid var(--blue-border);font-size:11px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <strong>${esc(entity.name)}</strong>
        <span style="font-size:10px;color:var(--mu)">correspond a ${esc(email.fromEmail||'')}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn bp bxs" onclick="linkEmailToFiche('${uid}','${etype}','${eid}',false)">Ajouter a la fiche</button>
        <button class="btn bi bxs" onclick="linkEmailToFiche('${uid}','${etype}','${eid}',true)">Toujours lier</button>
        <button class="btn bg bxs" onclick="${etype==='co'?`openCoPanel('${eid}')`:` openCandPanel('${eid}')`}">→ Voir la fiche</button>
      </div>
    </div>`;
  }

  // Attachments
  const attachHtml=(email.attachments||[]).map(a=>`
    <a ${a.url?`href="${esc(a.url)}" target="_blank" rel="noopener"`:'href="#"'} 
       class="attach-chip" style="text-decoration:none;cursor:pointer" 
       title="${esc(a.filename||'Fichier')}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      ${esc(a.filename||'Fichier')} 
      ${a.size?`<span style="opacity:.5">${Math.round(a.size/1024)}ko</span>`:''}
    </a>`).join('');

  const dateStr=email.date?new Date(email.date).toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})+'  '+new Date(email.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—';

  main.innerHTML=`
    ${linkBanner}
    <!-- Header email -->
    <div class="email-detail-header" style="flex-shrink:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <button class="btn bg bxs" onclick="emShowView('inbox')">← Retour</button>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:14px;color:var(--tx);margin-bottom:3px;line-height:1.3">${esc(email.subject||'(sans objet)')}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px">
            <span style="color:var(--blue)">${esc(email.from||email.fromEmail||'—')}</span>
            ${matchCand?`<span class="inbox-cand-match" style="cursor:pointer" onclick="openCandPanel('${matchCand.id}')">${esc(matchCand.name)}</span>`:''}
            ${matchCo?`<span class="inbox-cand-match" style="cursor:pointer" onclick="openCoPanel('${matchCo.id}')">${esc(matchCo.name)}</span>`:''}
            <span style="color:var(--mu2);font-size:10px;margin-left:auto">${dateStr}</span>
          </div>
        </div>
        <button onclick="email._starred=!email._starred;emOpenEmail('${uid}')" style="background:none;border:none;cursor:pointer;font-size:16px;color:${email._starred?'var(--orange)':'var(--mu2)'};padding:4px;transition:.15s" title="Marquer comme important">${email._starred?'★':'☆'}</button>
      </div>
      ${attachHtml?`<div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px">${attachHtml}</div>`:''}
      <!-- Actions -->
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn bp bxs" onclick="emReplyTo('${uid}')">Repondre</button>
        <button class="btn bg bxs" onclick="emForwardEmail('${uid}')">Transmettre</button>
        <button class="btn bg bxs" onclick="emMarkUnread('${uid}')">Marquer non lu</button>
        <button class="btn bg bxs" onclick="emSaveToFolder('${uid}')">Dossiers →</button>
        <button class="btn bg bxs" onclick="emArchiveEmail('${uid}')" title="Archiver cet email">Archiver</button>
        <button class="btn bd_ bxs" onclick="emDeleteEmail('${uid}')" style="margin-left:auto" title="Supprimer definitivement">Supprimer</button>
        ${matchCand?`<button class="btn bg bxs" onclick="openCandPanel('${matchCand.id}')">→ Profil ${esc(matchCand.name.split(' ')[0])}</button>`:''}
        ${matchCo?`<button class="btn bg bxs" onclick="openCoPanel('${matchCo.id}')">→ ${esc(matchCo.name)}</button>`:''}
        <button class="ai-badge" style="cursor:pointer;padding:4px 10px;font-size:10px;margin-left:auto" onclick="emAnalyzeEmail('${uid}')">Analyser IA</button>
      </div>
    </div>
    <!-- Corps de l'email -->
    <div class="email-detail-body" style="flex:1;overflow-y:auto;white-space:pre-wrap;word-break:break-word">
      ${renderBodyWithLinks(email.text||email.html?.replace(/<[^>]*>/g,'\n').replace(/\n{3,}/g,'\n\n').trim()||'')}
    </div>`;

  if(getApiKey())setTimeout(()=>emAnalyzeEmail(uid),1200);
}

function emMarkUnread(uid){
  if(!INBOX_CACHE?.emails)return;
  const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));
  if(!email)return;
  email.seen=false;
  INBOX_UNREAD++;
  const badge=document.getElementById('em-inbox-badge');
  if(badge){badge.textContent=INBOX_UNREAD;badge.style.display='inline-flex';}
  emShowView('inbox');
  toast('Marque comme non lu','s');
}

function emForwardEmail(uid){
  if(!INBOX_CACHE?.emails)return;
  const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));
  if(!email)return;
  EM={
    to:'',subject:`Fwd: ${email.subject||''}`,
    body:`\n\n──────────────\nDe : ${email.from||email.fromEmail}\nDate : ${new Date(email.date).toLocaleDateString('fr-FR')}\nObjet : ${email.subject}\n\n${email.text||''}`.slice(0,2000),
    candId:null,coId:null,tplKey:null
  };
  emShowView('compose');
}

// ── Répondre ──────────────────────────────────────────
function emReplyTo(uid){
  if(!INBOX_CACHE)return;
  const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));
  if(!email)return;
  const matchCand=DB.candidates.find(c=>c.email&&email.fromEmail&&c.email.toLowerCase()===email.fromEmail?.toLowerCase());
  const matchCo=DB.companies.find(c=>c.email&&email.fromEmail&&c.email.toLowerCase()===email.fromEmail?.toLowerCase());
  EM={
    to:email.fromEmail||'',
    subject:`Re: ${email.subject||''}`,
    body:`\n\n──────────────\nDe : ${email.from||email.fromEmail}\nDate : ${new Date(email.date).toLocaleDateString('fr-FR')}\nObjet : ${email.subject}\n\n${email.text||''}`.slice(0,2000),
    candId:matchCand?matchCand.id:null,
    coId:matchCo?matchCo.id:null,
    tplKey:null
  };
  emShowView('compose');
}

// ── Composeur ─────────────────────────────────────────
function emRenderCompose(cands,cos,nom,tel){
  const initTo=EM.to||'';
  const initSub=EM.subject||'';
  const initBody=EM.body||(EMAIL_TPLS.blank.body({},nom,tel));
  const candOpts=cands.map(c=>`<option value="${c.email}">${esc(c.name)} — ${esc(c.email)}</option>`).join('');
  const coOpts=cos.map(c=>`<option value="${c.email}">${esc(c.name)} — ${esc(c.email)}</option>`).join('');
  const tplOpts=Object.entries(EMAIL_TPLS).map(([k,t])=>`<option value="${k}">${t.label}</option>`).join('');

  return`
    <div style="padding:10px 14px;border-bottom:1px solid var(--bd);background:var(--s1);flex-shrink:0;display:flex;align-items:center;gap:8px">
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:12px">Nouveau message</span>
      <select onchange="emApplyTpl()" id="em-tpl" style="font-size:10px;background:var(--s3);border:1px solid var(--bd2);color:var(--tx);padding:3px 8px;border-radius:4px;margin-left:auto">
        <option value="">-- Template --</option>${tplOpts}
      </select>
    </div>
    <!-- Champs -->
    <div style="flex-shrink:0;border-bottom:1px solid var(--bd)">
      ${[
        {id:'em-to',label:'De',val:initTo,type:'text',placeholder:'destinataire@email.com'},
        {id:'em-cc',label:'Cc',val:'',type:'text',placeholder:''},
        {id:'em-sub',label:'Objet',val:initSub,type:'text',placeholder:''},
      ].map(f=>`<div style="display:flex;align-items:center;padding:0 14px;border-bottom:1px solid var(--bd)">
          <span style="font-size:10px;color:var(--mu);min-width:38px;flex-shrink:0;text-transform:uppercase;letter-spacing:.08em">${f.label}</span>
          <input id="${f.id}" value="${esc(f.val)}" placeholder="${f.placeholder}" 
            style="flex:1;background:transparent;border:none;padding:9px 8px;font-size:12px;color:var(--tx);font-family:'DM Mono',monospace;outline:none">
        </div>`).join('')}
      <!-- Sélecteurs contact -->
      <div style="display:flex;gap:6px;padding:6px 14px;border-bottom:1px solid var(--bd);flex-wrap:wrap">
        <select onchange="if(this.value){document.getElementById('em-to').value=this.value;this.value=''}" style="font-size:10px;background:var(--s3);border:1px solid var(--bd2);color:var(--mu);padding:3px 8px;border-radius:4px;max-width:160px">
          <option value="">Candidat...</option>${candOpts}
        </select>
        <select onchange="if(this.value){document.getElementById('em-to').value=this.value;this.value=''}" style="font-size:10px;background:var(--s3);border:1px solid var(--bd2);color:var(--mu);padding:3px 8px;border-radius:4px;max-width:160px">
          <option value="">Client/Prospect...</option>${coOpts}
        </select>
      </div>
    </div>
    <!-- Corps -->
    <textarea id="em-body" style="flex:1;background:transparent;border:none;padding:14px;font-size:12px;font-family:'DM Mono',monospace;color:var(--tx);resize:none;outline:none;line-height:1.7;min-height:0">${esc(initBody)}</textarea>
    ${emAttachmentsHtml()}
    <!-- Footer -->
    <div style="padding:10px 14px;border-top:1px solid var(--bd);display:flex;gap:6px;align-items:center;flex-shrink:0;background:var(--s2)">
      <button id="em-send-btn" class="btn bp bsm" onclick="emSend()">Envoyer</button>
      <button class="btn bg bxs" onclick="emOpenMailClient()" title="Ouvrir dans Gmail/Outlook">Via messagerie</button>
      <button class="btn bg bxs" onclick="emSaveDraft()">Brouillon</button>
      <button class="btn bg bxs" onclick="emClear()">Effacer</button>
      <div id="em-status" style="font-size:10px;margin-left:4px"></div>
      ${nom?`<span style="font-size:9px;color:var(--mu2);margin-left:auto">${esc(nom)}</span>`:''}
    </div>`;
}

// ── Envoi ─────────────────────────────────────────────
async function emSend(){
  const to=(document.getElementById('em-to')?.value||EM.to||'').trim();
  const cc=(document.getElementById('em-cc')?.value||'').trim();
  const sub=(document.getElementById('em-sub')?.value||EM.subject||'').trim();
  const body=(document.getElementById('em-body')?.value||EM.body||'').trim();
  if(!to){toast('Destinataire manquant','e');document.getElementById('em-to')?.focus();return;}
  if(!sub){toast('Objet manquant','e');document.getElementById('em-sub')?.focus();return;}
  const stEl=document.getElementById('em-status');
  const btn=document.getElementById('em-send-btn');
  const setStatus=(html)=>{if(stEl)stEl.innerHTML=html;};
  if(btn){btn.disabled=true;btn.textContent='Envoi...';}
  setStatus('<span style="color:var(--orange)">Envoi...</span>');
  const apiBase=getApiBase();
  if(!apiBase){emOpenMailClient();if(btn){btn.disabled=false;btn.textContent='Envoyer';}setStatus('');return;}
  try{
    // Récupérer HTML et PDF contrat si présents
    const contractHtml = sessionStorage.getItem('_contract_email_html') || null;
    const contractPdf  = sessionStorage.getItem('_contract_pdf_b64')    || null;
    const contractName = sessionStorage.getItem('_contract_pdf_name')   || 'Contrat_Novalem.pdf';
    const payload = { to, cc, subject: sub, body };
    if (contractHtml) payload.html = contractHtml;
    const attachments = [];
    if (contractPdf) attachments.push({ filename: contractName, content: contractPdf, type: 'application/pdf' });
    // Pièces jointes additionnelles (CV anonymisés du module présentation de profils, etc.)
    try {
      const extra = JSON.parse(sessionStorage.getItem('_nv_email_attachments') || '[]');
      if (Array.isArray(extra)) extra.forEach(a => { if (a && a.content) attachments.push({ filename: a.filename || 'piece-jointe.pdf', content: a.content, type: a.type || 'application/pdf' }); });
    } catch(_){}
    if (attachments.length) payload.attachments = attachments;
    const resp=await fetch(`${apiBase}/api/send-email`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await resp.json();
    if(resp.ok&&(data.sent||data.id)){
      setStatus('<span style="color:var(--green)">Envoye !</span>');
      // Nettoyer les données contrat après envoi
      sessionStorage.removeItem('_contract_email_html');
      sessionStorage.removeItem('_contract_pdf_b64');
      sessionStorage.removeItem('_contract_pdf_name');
      // Pièces jointes profils + suivi (statut « présenté » + relance) si envoi de profil(s)
      sessionStorage.removeItem('_nv_email_attachments');
      try { if (typeof window.nvApplyPendingFollowup === 'function') window.nvApplyPendingFollowup(to); } catch(_){}
      emLogEmail(to,sub,body,true);
      toast(`Email envoye a ${to}`,'s');
      if(btn){btn.textContent='Envoye !';btn.style.background='var(--green)';btn.style.color='#0a0a08';}
      setTimeout(()=>{emClear();setStatus('');if(btn){btn.disabled=false;btn.textContent='Envoyer';btn.style.background='';btn.style.color='';}emShowView('sent');},2000);
    }else{
      setStatus(`<span style="color:var(--red)">× ${esc(data.error||'Erreur')}</span>`);
      if(btn){btn.disabled=false;btn.textContent='Envoyer';}
      if(resp.status===403||data.hint){
        openMo('Domaine en attente de verification',`<div style="font-size:12px;line-height:1.8">Le domaine novalem-recrutement.fr n'est pas encore verifie sur Resend.<br><br>Utilisez "Via messagerie" pour envoyer depuis Gmail ou Outlook.</div>`,
          `<button class="btn bg" onclick="closeMo()">Fermer</button><button class="btn bp" onclick="closeMo();emOpenMailClient()">Via messagerie →</button>`);
      }
    }
  }catch(err){
    setStatus('<span style="color:var(--red)">× Erreur reseau</span>');
    if(btn){btn.disabled=false;btn.textContent='Envoyer';}
    toast('Erreur — utilise "Via messagerie"','w');
  }
}

// ── Messagerie native ─────────────────────────────────
function emOpenMailClient(){
  const to=(document.getElementById('em-to')?.value||EM.to||'').trim();
  const sub=(document.getElementById('em-sub')?.value||EM.subject||'').trim();
  const body=(document.getElementById('em-body')?.value||EM.body||'').trim();
  if(!to){toast('Destinataire manquant','e');return;}
  window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`);
  setTimeout(()=>{emLogEmail(to,sub,body,false);toast('Email ouvert dans ta messagerie','i');},600);
}

// ── Log + brouillons ──────────────────────────────────
function emLogEmail(to,subject,body,sent=true){
  DB.emails=DB.emails||[];
  DB.emails.push({id:uid(),to,subject,body,sent,date:now_(),read:true});
  if(DB.emails.length>200)DB.emails=DB.emails.slice(-200);
  save();
}
function emSaveDraft(){
  DB.drafts=DB.drafts||[];
  const to=(document.getElementById('em-to')?.value||EM.to||'').trim();
  const sub=(document.getElementById('em-sub')?.value||EM.subject||'').trim();
  const body=(document.getElementById('em-body')?.value||EM.body||'').trim();
  if(!to&&!sub&&!body){toast('Brouillon vide','w');return;}
  DB.drafts.push({id:uid(),to,subject:sub,body,date:now_()});
  save();toast('Brouillon sauvegarde ✓','s');
}
function emLoadDraft(i){
  const d=(DB.drafts||[])[i];if(!d)return;
  EM={to:d.to||'',subject:d.subject||'',body:d.body||'',candId:null,coId:null,tplKey:null};
  emShowView('compose');
}
function emDeleteDraft(i){
  DB.drafts=(DB.drafts||[]);DB.drafts.splice(i,1);save();
  const m=document.getElementById('em-main');
  if(m){const nom=localStorage.getItem(uKey('btp_user_name'))||'';const tel=localStorage.getItem(uKey('btp_user_tel'))||'';m.innerHTML=emRenderDrafts(DB.drafts,DB.candidates.filter(c=>c.email));}
  toast('Supprime','w');
}
function emClear(){
  EM={to:'',subject:'',body:'',candId:null,coId:null,tplKey:null};
  ['em-to','em-cc','em-sub','em-body'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  // Jeter les pièces jointes profils et le contexte de suivi en attente
  sessionStorage.removeItem('_nv_email_attachments');
  sessionStorage.removeItem('_nv_pending_followup');
}

// ── Pièces jointes du composer interne (CV profils + contrat) ─────────
function emComposeAttachments(){
  const list=[];
  try{ const pdf=sessionStorage.getItem('_contract_pdf_b64'); if(pdf) list.push({filename:sessionStorage.getItem('_contract_pdf_name')||'Contrat.pdf',_locked:true}); }catch(_){}
  try{ const extra=JSON.parse(sessionStorage.getItem('_nv_email_attachments')||'[]'); if(Array.isArray(extra)) extra.forEach((a,i)=>list.push({filename:a.filename||'piece-jointe.pdf',_idx:i})); }catch(_){}
  return list;
}
function emAttachmentsHtml(){
  const list=emComposeAttachments();
  if(!list.length) return '';
  return `<div id="em-attach-bar" style="flex-shrink:0;border-top:1px solid var(--bd);padding:8px 14px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:var(--s1)">
    <span style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--mu2)">Pièces jointes</span>
    ${list.map(a=>`<span style="display:inline-flex;align-items:center;gap:6px;background:var(--s3);border:1px solid var(--bd2);border-radius:12px;padding:3px 10px;font-size:10px;color:var(--tx)">📎 ${esc(a.filename)}${a._locked?'':`<span onclick="emRemoveAttachment(${a._idx})" style="cursor:pointer;color:var(--mu);font-weight:700;font-size:12px;line-height:1" title="Retirer">×</span>`}</span>`).join('')}
  </div>`;
}
function emRemoveAttachment(i){
  try{ const extra=JSON.parse(sessionStorage.getItem('_nv_email_attachments')||'[]'); if(Array.isArray(extra)){ extra.splice(i,1); sessionStorage.setItem('_nv_email_attachments',JSON.stringify(extra)); } }catch(_){}
  const bar=document.getElementById('em-attach-bar');
  if(bar) bar.outerHTML=emAttachmentsHtml(); // re-render uniquement la barre (préserve le texte saisi)
}

// Ouvre la MESSAGERIE INTERNE pré-remplie + pièces jointes (présentation de profils, etc.).
// opts: {to, subject, body, coId, attachments:[{filename,content,type}], followup:{...}}
// Le destinataire/objet/corps remplissent le composer ; les CV partent en pièce jointe
// via emSend (même mécanisme que l'envoi de contrat). Bascule sur l'onglet Emails.
function nvOpenMailboxCompose(opts){
  opts=opts||{};
  try{ sessionStorage.setItem('_nv_email_attachments', JSON.stringify(opts.attachments||[])); }catch(_){}
  if(opts.followup){ try{ sessionStorage.setItem('_nv_pending_followup', JSON.stringify(opts.followup)); }catch(_){} }
  else sessionStorage.removeItem('_nv_pending_followup');
  EM={to:opts.to||'',subject:opts.subject||'',body:opts.body||'',candId:null,coId:opts.coId||null,tplKey:null};
  EM_VIEW='compose';
  if(typeof closeMo==='function')closeMo();
  setTimeout(()=>{ if(typeof go==='function') go('emails'); },100);
}

// ── Envoyés ───────────────────────────────────────────
function emRenderSent(history,cands){
  if(!history.length)return`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--mu2);font-size:12px">Aucun email envoye</div>`;
  return`<div style="overflow-y:auto;flex:1">
    ${history.map((e,i)=>`<div style="padding:10px 14px;border-bottom:1px solid var(--bd);cursor:pointer;transition:.15s" onclick="emShowSentDetail(${i})" onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background=''">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
        <span style="font-size:11px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.subject||'(sans objet)')}</span>
        <span style="font-size:10px;color:var(--mu2);flex-shrink:0">${fD(e.date)}</span>
      </div>
      <div style="font-size:10px;color:var(--mu)">→ ${esc(e.to)}</div>
    </div>`).join('')}
  </div>`;
}
function emShowSentDetail(i){
  const history=(DB.emails||[]).slice().reverse();
  const e=history[i];if(!e)return;
  const main=document.getElementById('em-main');if(!main)return;
  main.innerHTML=`
    <div class="email-detail-header" style="flex-shrink:0">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <button class="btn bg bxs" onclick="emShowView('sent')">← Retour</button>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px">${esc(e.subject||'(sans objet)')}</div>
      </div>
      <div style="font-size:11px;color:var(--mu)">→ ${esc(e.to)} · ${fD(e.date)}</div>
    </div>
    <div class="email-detail-body" style="flex:1;overflow-y:auto;white-space:pre-wrap;word-break:break-word">
      ${renderBodyWithLinks(e.body||'')}
    </div>`;
}

// ── Brouillons ────────────────────────────────────────
function emRenderDrafts(drafts,cands){
  if(!drafts.length)return`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--mu2);font-size:12px">Aucun brouillon</div>`;
  return`<div style="overflow-y:auto;flex:1">
    ${drafts.map((d,i)=>`<div style="padding:10px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px">
      <div style="flex:1;cursor:pointer" onclick="emLoadDraft(${i})">
        <div style="font-size:11px;font-weight:500;margin-bottom:2px">${esc(d.subject||'(sans objet)')}</div>
        <div style="font-size:10px;color:var(--mu)">→ ${esc(d.to||'(aucun destinataire)')} · ${fD(d.date)}</div>
      </div>
      <button class="btn bg bxs" onclick="emLoadDraft(${i})">Modifier</button>
      <button class="btn bd_ bxs" onclick="emDeleteDraft(${i})">×</button>
    </div>`).join('')}
  </div>`;
}

// ── Template apply ────────────────────────────────────
function emApplyTpl(){
  const key=document.getElementById('em-tpl')?.value;if(!key)return;
  const tpl=EMAIL_TPLS[key];if(!tpl)return;
  const nom=localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||'';
  const tel=localStorage.getItem(uKey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'';
  // Try to find linked candidate
  let c={};
  if(EM.candId)c=cById(EM.candId)||{};
  const body=tpl.body(c,nom,tel);
  const to=tpl.to(c);const sub=tpl.subject(c);
  const toEl=document.getElementById('em-to');const subEl=document.getElementById('em-sub');const bodyEl=document.getElementById('em-body');
  if(toEl&&to)toEl.value=to;
  if(subEl&&sub)subEl.value=sub;
  if(bodyEl)bodyEl.value=body;
  toast(`Template "${tpl.label}" applique`,'s');
}
function emQuickTpl(key){
  EM={to:'',subject:'',body:'',candId:null,coId:null,tplKey:key};
  EM_VIEW='compose';
  emShowView('compose');
  setTimeout(()=>{document.getElementById('em-tpl').value=key;emApplyTpl();},80);
}

// ── Ouvrir depuis ailleurs ────────────────────────────
function openEmailWith({to='',subject='',body='',candId=null,coId=null,tplKey=null}={}){
  EM={to,subject,body,candId,coId,tplKey};
  go('emails');
}
function emailFromCand(candId,tplKey){
  const c=cById(candId);if(!c)return;
  EM={to:c.email||'',subject:'',body:'',candId,coId:null,tplKey};
  go('emails');
}

// ── Analyse IA ────────────────────────────────────────
async function emAnalyzeEmail(uid){
  if(!getApiKey())return;
  if(!INBOX_CACHE?.emails)return;
  const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));
  if(!email)return;
  showAiPanelLoading();
  try{
    const apiBase=window.location.hostname==='localhost'||window.location.hostname===''?null:window.location.origin;
    if(!apiBase){closeAiPanel();return;}
    const resp=await fetch(`${apiBase}/api/ai`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        messages:[{role:'user',content:`Analyse cet email recu dans un CRM de recrutement BTP. Extrait les informations cles et propose des actions concretes.\n\nDe: ${email.from||email.fromEmail}\nObjet: ${email.subject}\nDate: ${email.date}\n\nCorps:\n${(email.text||'').slice(0,2000)}`}],
        system:'Tu es un assistant CRM de recrutement specialise BTP. Reponds en JSON: {summary:string,actions:[{label:string,type:string,urgence:"haute"|"normale"|"basse"}],entityType:"candidat"|"client"|"prospect"|null,entityName:string|null}',
        max_tokens:600,
      })
    });
    const data=await resp.json();
    const txt=data.content?.find(b=>b.type==='text')?.text||data.content?.[0]?.text||'';
    let parsed=null;
    try{
     // Essai 1 : JSON direct
     parsed=JSON.parse(txt.replace(/```json|```/g,'').trim());
    }catch(e){
     // Essai 2 : extraire le JSON du texte
     const m=txt.match(/\{[\s\S]*\}/);
     if(m){try{parsed=JSON.parse(m[0]);}catch(e2){parsed=null;}}
    }
    if(!parsed){
     // Fallback : créer un résumé depuis le texte brut
     parsed={summary:txt.slice(0,300)||'Analyse non disponible',actions:[{label:'Marquer comme lu',type:'note',urgence:'normale'}],entityType:null,entityName:null};
    }
    showAiActionPanel(parsed,email,uid);
  }catch(e){closeAiPanel();console.warn('AI email analysis error:',e);}
}

function showAiPanelLoading(){
  document.getElementById('ai-action-panel')?.remove();
  AI_PANEL_OPEN=true;
  const el=document.createElement('div');el.id='ai-action-panel';el.className='ai-panel';
  el.innerHTML=`
    <div class="ai-panel-head">
      <div class="ai-panel-title">Analyse IA</div>
      <div class="ai-panel-close" onclick="closeAiPanel()">×</div>
    </div>
    <div class="ai-panel-body" style="display:flex;align-items:center;gap:10px;padding:20px;color:var(--mu)">
      <div style="width:16px;height:16px;border:2px solid var(--bd2);border-top-color:var(--purple);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>
      Analyse en cours...
    </div>`;
  document.body.appendChild(el);
}

function showAiActionPanel(analysis,email,uid){
  document.getElementById('ai-action-panel')?.remove();
  AI_PANEL_OPEN=true;
  const el=document.createElement('div');el.id='ai-action-panel';el.className='ai-panel';
  const urgColors={haute:'var(--red)',normale:'var(--ac)',basse:'var(--mu)'};
  el.innerHTML=`
    <div class="ai-panel-head">
      <div class="ai-panel-title">Analyse IA</div>
      <div class="ai-panel-close" onclick="closeAiPanel()">×</div>
    </div>
    <div class="ai-panel-body">
      ${analysis.entityName?`<div class="ai-panel-cand">${esc(analysis.entityName)}</div>`:''}
      ${analysis.summary?`<div class="ai-panel-resume">${esc(analysis.summary)}</div>`:''}
      ${(analysis.actions||[]).map((a,i)=>`
        <button class="ai-action-btn" onclick="executeAiAction(${i},'${uid}')">
          <span style="flex:1">${esc(a.label)}</span>
          <span class="ai-urgence" style="background:${a.urgence==='haute'?'var(--red-dim)':'var(--s3)'};color:${urgColors[a.urgence]||'var(--mu)'}">${a.urgence||'normale'}</span>
        </button>`).join('')}
    </div>`;
  window._lastAiAnalysis=analysis;
  document.body.appendChild(el);
}

function executeAiAction(actionIndex,emailUid){
  const analysis=window._lastAiAnalysis;if(!analysis)return;
  const action=(analysis.actions||[])[actionIndex];if(!action)return;
  const email=INBOX_CACHE?.emails?.find(e=>String(e.uid)===String(emailUid));
  const type=action.type||'note';
  if(type==='reply'||type==='repondre'){emReplyTo(emailUid);closeAiPanel();return;}
  if(type==='agenda'||type==='rdv'){go('agenda');closeAiPanel();return;}
  if(type==='prospect'||type==='contact'){go('pros');closeAiPanel();return;}
  if(type==='candidat'){go('cands');closeAiPanel();return;}
  toast(`Action: ${action.label}`,'i');
  closeAiPanel();
}


// ── Supprimer email de l'inbox ───────────────────────
function emDeleteEmail(uid){
  openMo('',`
    <div class="confirm-dialog">
      <div class="confirm-icon" style="background:var(--red-dim);border:2px solid var(--red-border)">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </div>
      <div class="confirm-title">Supprimer cet email ?</div>
      <div class="confirm-desc">Il sera retire de l'affichage. La suppression definitive se fait depuis votre boite mail OVH.</div>
      <div class="confirm-actions">
        <button class="btn-apple primary" onclick="(()=>{if(INBOX_CACHE?.emails){INBOX_CACHE.emails=INBOX_CACHE.emails.filter(e=>String(e.uid)!=='${uid}');INBOX_UNREAD=INBOX_CACHE.emails.filter(e=>!e.seen).length;const badge=document.getElementById('em-inbox-badge');if(badge){badge.textContent=INBOX_UNREAD;badge.style.display=INBOX_UNREAD>0?'inline-flex':'none';}}closeMo();emShowView('inbox');toast('Email supprime de la vue','w');})()">Supprimer</button>
        <button class="btn-apple ghost" onclick="closeMo()">Annuler</button>
      </div>
    </div>`,``);
}

// ── Archiver email ────────────────────────────────────
function emArchiveEmail(uid){
  if(!INBOX_CACHE?.emails)return;
  const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));
  if(!email)return;
  // Save to archived emails in DB
  DB.emails_archived=DB.emails_archived||[];
  DB.emails_archived.push({...email,archived_at:now_()});
  // Remove from inbox view
  INBOX_CACHE.emails=INBOX_CACHE.emails.filter(e=>String(e.uid)!==String(uid));
  save();
  emShowView('inbox');
  toast('Email archive','s');
}

// ── Dossiers email ────────────────────────────────────
function emSaveToFolder(uid){
  if(!INBOX_CACHE?.emails)return;
  const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));
  if(!email)return;
  const folders=(DB.email_folders||[]);
  const folderOpts=folders.map((f,i)=>`
    <div onclick="emAddToFolder(${i},'${uid}')" style="padding:9px 12px;cursor:pointer;border-radius:6px;transition:.12s;display:flex;align-items:center;gap:8px;font-size:12px" 
         onmouseover="this.style.background='var(--s3)'" onmouseout="this.style.background=''">
      <span style="font-size:14px">▷</span>
      <span>${esc(f.name)}</span>
      <span style="font-size:10px;color:var(--mu);margin-left:auto">${(f.emails||[]).length} email(s)</span>
    </div>`).join('');
  openMo('Enregistrer dans un dossier',`
    <div>
      ${folderOpts||'<div style="font-size:12px;color:var(--mu);padding:8px 0">Aucun dossier cree</div>'}
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--bd)">
        <div style="font-size:11px;color:var(--mu);margin-bottom:6px">Nouveau dossier</div>
        <div style="display:flex;gap:6px">
          <input id="new-folder-name" placeholder="Nom du dossier…" style="flex:1;font-size:12px">
          <button class="btn bp bsm" onclick="emCreateFolder(document.getElementById('new-folder-name').value,'${uid}')">Creer</button>
        </div>
      </div>
    </div>`,
    `<button class="btn bg" onclick="closeMo()">Fermer</button>`
  );
}

function emCreateFolder(name, uid){
  if(!name?.trim()){toast('Nom requis','e');return;}
  DB.email_folders=DB.email_folders||[];
  const folder={id:uid_(),name:name.trim(),emails:[],created:now_()};
  DB.email_folders.push(folder);
  if(uid)emAddToFolder(DB.email_folders.length-1,uid);
  else{save();closeMo();toast('Dossier cree ✓','s');}
}
function uid_(){return Math.random().toString(36).slice(2,9);}

function emAddToFolder(folderIdx,emailUid){
  DB.email_folders=DB.email_folders||[];
  const folder=DB.email_folders[folderIdx];if(!folder)return;
  const email=INBOX_CACHE?.emails?.find(e=>String(e.uid)===String(emailUid));
  if(!email)return;
  folder.emails=folder.emails||[];
  if(!folder.emails.find(e=>String(e.uid)===String(emailUid))){
    folder.emails.push({...email,saved_at:now_()});
  }
  save();closeMo();
  toast(`Email enregistre dans "${folder.name}" ✓`,'s');
}

// ── Vue Dossiers ──────────────────────────────────────
let _currentFolder=null;

function emRenderDossiers(){
  const folders=DB.email_folders||[];
  const archived=DB.emails_archived||[];

  if(_currentFolder!==null){
    const folder=folders[_currentFolder];
    if(!folder){_currentFolder=null;return emRenderDossiers();}
    return emRenderFolderContent(folder,_currentFolder);
  }

  return`
    <div style="padding:12px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;flex-shrink:0;background:var(--s2)">
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:12px">Dossiers & Archives</span>
      <button class="btn bp bxs" style="margin-left:auto" onclick="emPromptNewFolder()">+ Nouveau dossier</button>
    </div>
    <div style="overflow-y:auto;flex:1;padding:10px">
      <!-- Archives -->
      <div onclick="_currentFolder='archived';const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderDossiers()" 
           style="padding:12px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;cursor:pointer;margin-bottom:8px;display:flex;align-items:center;gap:10px;transition:.15s"
           onmouseover="this.style.borderColor='var(--bd3)'" onmouseout="this.style.borderColor='var(--bd)'">
        <div style="width:36px;height:36px;border-radius:8px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">▦</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:12px">Archives</div>
          <div style="font-size:10px;color:var(--mu)">${archived.length} email(s) archive(s)</div>
        </div>
      </div>
      <!-- Dossiers custom -->
      ${folders.length?folders.map((f,i)=>`
        <div style="padding:12px 14px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;cursor:pointer;margin-bottom:8px;display:flex;align-items:center;gap:10px;transition:.15s"
             onmouseover="this.style.borderColor='var(--bd3)'" onmouseout="this.style.borderColor='var(--bd)'">
          <div onclick="_currentFolder=${i};const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderDossiers()" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <div style="width:36px;height:36px;border-radius:8px;background:var(--ac-dim);border:1px solid var(--ac-border);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;color:var(--ac)">▷</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:12px">${esc(f.name)}</div>
              <div style="font-size:10px;color:var(--mu)">${(f.emails||[]).length} email(s) · Cree le ${fD(f.created)}</div>
            </div>
          </div>
          <button onclick="event.stopPropagation();emDeleteFolder(${i})" 
            style="background:none;border:none;cursor:pointer;color:var(--mu2);font-size:14px;padding:4px;transition:.15s;flex-shrink:0"
            onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--mu2)'" title="Supprimer ce dossier">×</button>
        </div>`).join(''):`<div style="font-size:11px;color:var(--mu2);text-align:center;padding:30px">Aucun dossier — cliquez sur "+ Nouveau dossier"</div>`}
    </div>`;
}

function emRenderFolderContent(folder,idx){
  const isArchived=idx==='archived';
  const emails=isArchived?(DB.emails_archived||[]):(folder.emails||[]);
  const title=isArchived?'Archives':folder.name;
  return`
    <div style="padding:10px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;flex-shrink:0;background:var(--s2)">
      <button class="btn bg bxs" onclick="_currentFolder=null;const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderDossiers()">← Dossiers</button>
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:12px">${esc(title)}</span>
      <span style="font-size:10px;color:var(--mu)">${emails.length} email(s)</span>
      ${!isArchived?`<button class="btn bg bxs" style="margin-left:auto" onclick="emExportFolder(${idx})">Exporter</button>`:''}
    </div>
    <div style="overflow-y:auto;flex:1">
      ${emails.length?emails.map((e,i)=>`
        <div style="padding:10px 14px;border-bottom:1px solid var(--bd);cursor:pointer;transition:.15s;display:flex;gap:8px" 
             onclick="emShowSavedEmail('${isArchived?'archived':idx}',${i})"
             onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background=''">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span style="font-size:11px;color:var(--blue);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.from||e.fromEmail||'—')}</span>
              <span style="font-size:10px;color:var(--mu2);flex-shrink:0">${fD(e.date||e.saved_at||e.archived_at)}</span>
            </div>
            <div style="font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.subject||'(sans objet)')}</div>
            <div style="font-size:10px;color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${esc(e.snippet||'')}</div>
          </div>
          ${!isArchived?`<button onclick="event.stopPropagation();emRemoveFromFolder(${idx},${i})" 
            style="background:none;border:none;cursor:pointer;color:var(--mu2);font-size:14px;padding:4px;flex-shrink:0;transition:.15s"
            onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--mu2)'" title="Retirer du dossier">×</button>`:''}
        </div>`).join(''):`<div style="font-size:11px;color:var(--mu2);text-align:center;padding:40px">Dossier vide</div>`}
    </div>`;
}

function emShowSavedEmail(folderIdx,emailIdx){
  let email;
  if(folderIdx==='archived')email=(DB.emails_archived||[])[emailIdx];
  else email=(DB.email_folders?.[folderIdx]?.emails||[])[emailIdx];
  if(!email)return;
  const main=document.getElementById('em-main');if(!main)return;
  main.innerHTML=`
    <div class="email-detail-header" style="flex-shrink:0">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <button class="btn bg bxs" onclick="_currentFolder=${folderIdx==='archived'?`'archived'`:folderIdx};const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderDossiers()">← Retour</button>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;flex:1">${esc(email.subject||'(sans objet)')}</div>
      </div>
      <div style="font-size:11px;color:var(--blue)">${esc(email.from||email.fromEmail||'—')} · ${fD(email.date)}</div>
    </div>
    <div class="email-detail-body" style="flex:1;overflow-y:auto;white-space:pre-wrap;word-break:break-word">
      ${renderBodyWithLinks(email.text||'')}
    </div>`;
}

function emRemoveFromFolder(folderIdx,emailIdx){
  if(!DB.email_folders?.[folderIdx])return;
  DB.email_folders[folderIdx].emails.splice(emailIdx,1);
  save();
  const m=document.getElementById('em-main');
  if(m)m.innerHTML=emRenderFolderContent(DB.email_folders[folderIdx],folderIdx);
  toast('Retire du dossier','w');
}

function emDeleteFolder(idx){
  openMo('',`
    <div class="confirm-dialog">
      <div class="confirm-icon" style="background:var(--red-dim);border:2px solid var(--red-border)">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </div>
      <div class="confirm-title">Supprimer ce dossier ?</div>
      <div class="confirm-desc">Les emails sauvegardes dedans seront perdus.</div>
      <div class="confirm-actions">
        <button class="btn-apple danger" onclick="(()=>{DB.email_folders.splice(${idx},1);save();closeMo();const m=document.getElementById('em-main');if(m)m.innerHTML=emRenderDossiers();toast('Dossier supprime','w');})()">Supprimer</button>
        <button class="btn-apple ghost" onclick="closeMo()">Annuler</button>
      </div>
    </div>`,``);
}

function emExportFolder(idx){
  const folder=DB.email_folders?.[idx];if(!folder)return;
  const sep='='.repeat(60);
  const emails=(folder.emails||[]).map(e=>[
    '=== '+(e.subject||'(sans objet)')+' ===',
    'De : '+(e.from||e.fromEmail||'—'),
    'Date : '+fD(e.date),
    '---',
    e.text||'(corps vide)',
    sep
  ].join('\n')).join('\n\n');
  const blob=new Blob([emails],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='emails_'+folder.name.replace(/\s/g,'_')+'.txt';a.click();
  URL.revokeObjectURL(url);
  toast('Dossier exporte','s');
}

function emPromptNewFolder(){
  openMo('Nouveau dossier',`
    <div class="fgrp"><span class="lbl">Nom du dossier</span><input id="nf-name" placeholder="Clients PACA, Candidats GO, Relances…" autofocus></div>`,
    `<button class="btn bg" onclick="closeMo()">Annuler</button>
     <button class="btn bp" onclick="emCreateFolder(document.getElementById('nf-name').value,null)">Creer</button>`
  );
}

// ── CSS inline : inbox-actions visible au survol ──────
(function(){
  const s=document.createElement('style');
  s.textContent='.inbox-item:hover .inbox-actions{opacity:1!important}';
  document.head.appendChild(s);
})();


function closeAiPanel(){
  document.getElementById('ai-action-panel')?.remove();
  AI_PANEL_OPEN=false;
  window._lastAiAnalysis=null;
}

// ── Legacy aliases ────────────────────────────────────
function openInMailClient(){emOpenMailClient();}
function logEmail(to,sub,body){emLogEmail(to,sub,body,true);}
function resetEmailCompose(){emClear();}
function quickLoadTpl(k){emQuickTpl(k);}
function emPickContact(){}


function rReporting(){
 const el=document.getElementById('view-reporting');
 el.innerHTML=`<div id="rep-content"></div>`;
 renderRep();
}

let repPeriod='month';
function setRepPeriod(p){repPeriod=p;renderRep();}

function getRepRange(){
 const now=new Date();
 const start=new Date(now);
 if(repPeriod==='week')start.setDate(now.getDate()-7);
 else if(repPeriod==='month')start.setDate(1);
 else if(repPeriod==='quarter')start.setMonth(now.getMonth()-3);
 else start.setFullYear(2000);
 start.setHours(0,0,0,0);
 return start;
}

function inPeriod(iso){
 if(!iso)return false;
 return new Date(iso)>=getRepRange();
}

function renderRep(){
 const cands=DB.candidates||[];
 const comps=DB.companies||[];
 const needs=DB.needs||[];

 // ── KPIs ──────────────────────────────────────────────
 const placed=cands.filter(c=>c.status==='placed');
 const active=cands.filter(c=>!['ko','placed','entrant'].includes(c.status));
 const entrants=cands.filter(c=>c.status==='entrant');
 const revEnc=placed.reduce((a,c)=>a+(Number(c.salary||0)*.18),0);
 const revPot=active.reduce((a,c)=>a+(Number(c.salary||0)*.18),0);
 const clients=comps.filter(c=>c.type==='client');
 const prospects=comps.filter(c=>c.type==='prospect'&&!['refused'].includes(c.status));
 const convRate=(()=>{
 const base=cands.filter(c=>!['entrant'].includes(c.status)).length;
 if(!base)return 0;
 // KO exclus du calcul — seuls les candidats actifs + placés comptent
 const actifsPlusPlaces=cands.filter(c=>!['entrant','ko'].includes(c.status)).length;
 if(!actifsPlusPlaces)return 0;
 return Math.round(placed.length/actifsPlusPlaces*100);
 })();

 // Candidats ajoutés dans la période
 const newInPeriod=cands.filter(c=>inPeriod(c.created)&&c.status!=='entrant').length;
 const placedInPeriod=placed.filter(c=>inPeriod(c.updated)).length;
 const callsInPeriod=(DB.agenda||[]).filter(a=>a.done&&inPeriod(a.date)&&a.type==='call').length;

 // ── Pipeline funnel ────────────────────────────────────
 const stages=[
 {id:'new',l:'Qualifiés',color:'var(--ac4)'},
 {id:'precal',l:'Précal faite',color:'var(--ac5)'},
 {id:'dossier',l:'Dossier envoyé',color:'var(--ac6)'},
 {id:'interview',l:'Entretien visio',color:'var(--ac2)'},
 {id:'presented',l:'Présenté client',color:'var(--ac)'},
 {id:'placed',l:'Placé ✓',color:'#cfe046'},
 ];
 const stageCount=stages.map(s=>({...s,n:cands.filter(c=>c.status===s.id).length}));
 const maxStage=Math.max(...stageCount.map(s=>s.n),1);

 // ── Sources candidats ──────────────────────────────────
 const sourceMap={};
 cands.forEach(c=>{const s=c.source||'Inconnu';sourceMap[s]=(sourceMap[s]||0)+1;});
 const sources=Object.entries(sourceMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
 const maxSource=Math.max(...sources.map(s=>s[1]),1);

 // ── CA par mois (6 derniers mois) ─────────────────────
 const months=[];
 for(let i=5;i>=0;i--){
 const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);
 const label=d.toLocaleDateString('fr-FR',{month:'short'});
 const mStart=new Date(d);
 const mEnd=new Date(d);mEnd.setMonth(mEnd.getMonth()+1);
 const mPlaced=placed.filter(c=>{
 const u=new Date(c.updated);return u>=mStart&&u<mEnd;
 });
 const ca=mPlaced.reduce((a,c)=>a+(Number(c.salary||0)*.18),0);
 months.push({label,ca:Math.round(ca),n:mPlaced.length});
 }
 const maxCA=Math.max(...months.map(m=>m.ca),1);

 // ── Prospects pipeline ─────────────────────────────────
 const proStages=[
 {id:'tocall',l:'À appeler',p:prospects.filter(c=>c.status==='tocall').length},
 {id:'nrp',l:'NRP',p:prospects.filter(c=>c.status==='nrp').length},
 {id:'callback',l:'À rappeler',p:prospects.filter(c=>c.status==='callback').length},
 {id:'nobiz',l:'Pas de besoin',p:comps.filter(c=>c.status==='nobiz').length},
 {id:'need',l:'Besoin confirmé',p:prospects.filter(c=>c.status==='need').length},
 ];

 // ── Objectif CA mensuel ────────────────────────────────
 const CAObjectif=Number(getObjCA());
 const caMonth=months[months.length-1]?.ca||0;
 const caPct=Math.min(Math.round(caMonth/CAObjectif*100),100);

 const periodBtns=['week','month','quarter','all'].map(p=>`
 <div class="rep-period-btn ${repPeriod===p?'act':''}" onclick="setRepPeriod('${p}')">
 ${{week:'7j',month:'Mois',quarter:'Trim.',all:'Tout'}[p]}
 </div>`).join('');

 document.getElementById('rep-content').innerHTML=`
 <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
 <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px">Vue d'ensemble</div>
 <div class="rep-period">${periodBtns}</div>
 </div>

 <!-- KPIs principaux -->
 <div class="rep-grid">
 <div class="rep-kpi" style="--kpi-color:var(--ac2)">
 <div class="rep-v" style="color:var(--ac2)">${fM(Math.round(revEnc))}</div>
 <div class="rep-l">CA encaissé</div>
 <div class="rep-sub">${placed.length} placement(s)</div>
 </div>
 <div class="rep-kpi" style="--kpi-color:var(--ac6)">
 <div class="rep-v" style="color:var(--ac6)">${fM(Math.round(revPot))}</div>
 <div class="rep-l">CA potentiel</div>
 <div class="rep-sub">${active.length} candidat(s) actifs</div>
 </div>
 <div class="rep-kpi" style="--kpi-color:var(--ac)">
 <div class="rep-v" style="color:var(--ac)">${convRate}%</div>
 <div class="rep-l">Taux conversion</div>
 <div class="rep-sub">entrant → placé</div>
 </div>
 <div class="rep-kpi" style="--kpi-color:var(--ac5)">
 <div class="rep-v" style="color:var(--ac5)">${clients.length}</div>
 <div class="rep-l">Clients actifs</div>
 <div class="rep-sub">${needs.filter(n=>n.status==='open').length} besoin(s) ouverts</div>
 </div>
 <div class="rep-kpi" style="--kpi-color:var(--ac4)">
 <div class="rep-v" style="color:var(--ac4)">${newInPeriod}</div>
 <div class="rep-l">Nouveaux candidats</div>
 <div class="rep-sub">sur la période</div>
 </div>
 <div class="rep-kpi" style="--kpi-color:var(--ac3)">
 <div class="rep-v" style="color:var(--ac3)">${callsInPeriod}</div>
 <div class="rep-l">Appels passés</div>
 <div class="rep-sub">sur la période</div>
 </div>
 </div>

 <!-- Objectif CA mensuel -->
 <div class="rep-card" style="margin-bottom:12px">
 <div class="rep-card-t">Objectif CA mensuel
 <span style="margin-left:auto;font-size:11px;color:${caPct>=100?'var(--ac2)':caPct>=60?'var(--ac4)':'var(--ac3)'}">${caMonth?fM(caMonth):'0€'} / ${fM(CAObjectif)} — ${caPct}%</span>
 </div>
 <div style="height:10px;background:var(--bd);border-radius:5px;overflow:hidden">
 <div style="height:100%;width:${caPct}%;background:${caPct>=100?'var(--ac2)':caPct>=60?'var(--ac4)':'var(--ac3)'};border-radius:5px;transition:width .5s"></div>
 </div>
 <div style="font-size:10px;color:var(--mu2);margin-top:5px">${caPct>=100?'Objectif atteint !':caPct>=60?`${fM(CAObjectif-caMonth)} pour atteindre l'objectif`:`${fM(CAObjectif-caMonth)} restants — ${100-caPct}% à combler`}</div>
 </div>

 <div class="rep-row" style="margin-bottom:12px">

 <!-- Funnel candidats -->
 <div class="rep-card">
 <div class="rep-card-t">Pipeline candidats</div>
 <div class="rep-funnel">
 ${stageCount.map(s=>`
 <div class="rep-funnel-row" onclick="go('cands')">
 <div class="rep-funnel-dot" style="background:${s.color}"></div>
 <div class="rep-funnel-lbl">${s.l}</div>
 <div class="rep-bar-track" style="width:80px">
 <div class="rep-bar-fill" style="width:${Math.round(s.n/maxStage*100)}%;background:${s.color}"></div>
 </div>
 <div class="rep-funnel-n" style="color:${s.color}">${s.n}</div>
 </div>`).join('')}
 </div>
 <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--bd);font-size:10px;color:var(--mu2)">
 KO : ${cands.filter(c=>c.status==='ko').length} · Entrants : ${entrants.length}
 </div>
 </div>

 <!-- Sources candidats -->
 <div class="rep-card">
 <div class="rep-card-t"> Sources candidats</div>
 ${sources.map(([src,n],i)=>{
 const colors=['var(--ac5)','var(--ac2)','var(--ac4)','var(--ac6)','var(--ac)','var(--mu)'];
 return`<div class="rep-bar-row">
 <div class="rep-bar-lbl">${esc(src)}</div>
 <div class="rep-bar-track">
 <div class="rep-bar-fill" style="width:${Math.round(n/maxSource*100)}%;background:${colors[i]||'var(--mu)'}"></div>
 </div>
 <div class="rep-bar-val">${n}</div>
 </div>`;
 }).join('')||'<div class="mu_ fs11">Pas encore de données</div>'}
 </div>
 </div>

 <!-- CA sur 6 mois -->
 <div class="rep-card" style="margin-bottom:12px">
 <div class="rep-card-t">Honoraires encaissés — 6 derniers mois</div>
 <div style="display:flex;align-items:flex-end;gap:8px;height:130px;padding-top:8px">
 ${months.map(m=>{
 const h=maxCA>0?Math.max(Math.round(m.ca/maxCA*110),m.ca>0?4:0):0;
 return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
 <div style="font-size:9px;color:var(--mu2);text-align:center;white-space:nowrap">${m.ca?fM(m.ca):''}</div>
 <div style="width:100%;border-radius:3px 3px 0 0;background:${m.ca>0?'var(--ac2)':'var(--bd)'};height:${h}px;transition:height .4s;min-height:2px;position:relative" title="${m.label}: ${fM(m.ca)}${m.n?' ('+m.n+' placement'+(m.n>1?'s':'')+')' :''}">
 </div>
 <div style="font-size:10px;color:var(--mu);text-align:center">${m.label}</div>
 </div>`;
 }).join('')}
 </div>
 </div>

 <div class="rep-row" style="margin-bottom:12px">
 <!-- Pipeline prospects -->
 <div class="rep-card">
 <div class="rep-card-t">Pipeline prospects</div>
 ${proStages.map(s=>`
 <div class="rep-source-row" onclick="go('pros')" style="cursor:pointer">
 <span style="flex:1;color:var(--mu)">${s.l}</span>
 <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px">${s.p}</span>
 </div>`).join('')}
 <div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--bd);font-size:10px;color:var(--mu2)">
 Total prospects actifs : ${prospects.length}
 </div>
 </div>

 <!-- Besoins par catégorie -->
 <div class="rep-card">
 <div class="rep-card-t">Besoins par secteur</div>
 ${(()=>{
 const bycat={};
 needs.forEach(n=>{bycat[n.cat]=(bycat[n.cat]||0)+1;});
 const sorted=Object.entries(bycat).sort((a,b)=>b[1]-a[1]);
 const maxN=Math.max(...sorted.map(([,n])=>n),1);
 if(!sorted.length)return'<div class="mu_ fs11">Aucun besoin</div>';
 return sorted.map(([cat,n])=>{
 const c=getCat(cat);
 const colors={go:'var(--ac2)',so:'var(--ac5)',be:'var(--ac6)',vrd:'var(--ac4)',hse:'var(--ac)',mgmt:'var(--ac3)'};
 return`<div class="rep-bar-row">
 <div class="rep-bar-lbl"><span class="tag ${c.cls}" style="font-size:9px">${c.l}</span></div>
 <div class="rep-bar-track">
 <div class="rep-bar-fill" style="width:${Math.round(n/maxN*100)}%;background:${colors[cat]||'var(--mu)'}"></div>
 </div>
 <div class="rep-bar-val">${n}</div>
 </div>`;
 }).join('');
 })()}
 </div>
 </div>

 <!-- Activité agenda -->
 <div class="rep-card">
 <div class="rep-card-t"> Activité récente</div>
 <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
 ${[
 {ico:'',l:'Appels',v:(DB.agenda||[]).filter(a=>a.done&&a.type==='call').length},
 {ico:'',l:'Entretiens visio',v:(DB.agenda||[]).filter(a=>a.done&&a.type==='visio').length},
 {ico:'',l:'Relances',v:(DB.agenda||[]).filter(a=>a.done&&a.type==='relance').length},
 {ico:'',l:'Tâches faites',v:(DB.agenda||[]).filter(a=>a.done&&a.type==='task').length},
 ].map(s=>`
 <div style="background:var(--s3);border-radius:3px;padding:10px 8px">
 <div style="font-size:18px;margin-bottom:4px">${s.ico}</div>
 <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:18px;color:var(--tx)">${s.v}</div>
 <div style="font-size:9px;color:var(--mu);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">${s.l}</div>
 </div>`).join('')}
 </div>
 </div>`;
}
(async()=>{
 const connected=!!(getSupabaseUrl()&&getSupabaseKey());
 if(!connected){
  // CRM verrouillé : on affiche l'écran de connexion, rien d'autre n'est accessible
  showConnGate();
  return;
 }
 showConnGate('loading'); // affiche l'écran de chargement pendant le pull cloud
 // Filet de sécurité : quoi qu'il arrive, l'écran de chargement se ferme.
 // Le CRM reste utilisable sur le cache local même si le cloud est injoignable.
 const _gateSafety=setTimeout(()=>{ try{hideConnGate();}catch(_){} }, 12000);
 try{
  await load(); // localStorage immédiat + Supabase en arrière-plan (borné)
  setTimeout(startSignaturePolling, 2000); // Démarrer le polling signatures
  // Si un contrat signé n'a pas encore été acquitté, afficher la notif flottante
  setTimeout(()=>{ if(DB._contract_notif) showFloatingContractNotif(); }, 2500);
  checkPendingKoEmails(); // Vérifier les emails KO en attente
  setInterval(checkPendingKoEmails, 3600000); // Revérifier toutes les heures
  rDash();
  badges();
  initUserBadge();
  if(typeof updateConnIndicator==='function')updateConnIndicator();
 }catch(e){
  console.warn('[boot]', e);
 }finally{
  clearTimeout(_gateSafety);
  hideConnGate();
 }
})();

// Économie de bande passante : on suspend le rafraîchissement auto quand
// l'onglet n'est pas visible, et on resynchronise une fois au retour.
document.addEventListener('visibilitychange', ()=>{
 if(document.hidden){
  if(_candRefreshTimer){ clearInterval(_candRefreshTimer); _candRefreshTimer=null; }
 }else{
  if(!_candRefreshTimer && getSB()){
   _candRefreshTimer=setInterval(refreshCandidates, 60000);
   try{ refreshCandidates(); }catch(_){}
  }
 }
});

// ═══════════════════════════════════════════════════════
// ÉCRAN DE CONNEXION / CHARGEMENT (gate plein écran)
// ═══════════════════════════════════════════════════════
function showConnGate(mode){
 // mode: undefined = formulaire de connexion ; 'loading' = chargement en cours
 let g=document.getElementById('conn-gate');
 if(!g){
  g=document.createElement('div');
  g.id='conn-gate';
  document.body.appendChild(g);
 }
 const loading = mode==='loading';
 g.innerHTML=`
  <div class="cg-bg"></div>
  <div class="cg-box">
   <div class="cg-logo">NOVA<span>LEM</span></div>
   <div class="cg-sub">Cabinet de recrutement BTP</div>
   ${loading ? `
    <div class="cg-loader"><div class="cg-bar"></div></div>
    <div class="cg-status" id="cg-status">Connexion sécurisée au cloud…</div>
   ` : `
    <div class="cg-card">
     <div class="cg-card-t">Connexion requise</div>
     <div class="cg-card-d">Votre espace est protégé. Connectez-vous pour charger vos données.</div>
     <div class="cg-field"><label>URL Supabase</label><input id="cg-url" placeholder="https://xxxxx.supabase.co" autocomplete="off"></div>
     <div class="cg-field"><label>Clé Supabase (anon/public)</label><input id="cg-key" type="password" placeholder="eyJhbGc…" autocomplete="off"></div>
     <button class="cg-btn" id="cg-connect" onclick="gateConnect()">Se connecter</button>
     <div class="cg-err" id="cg-err"></div>
    </div>
   `}
  </div>`;
 g.style.display='flex';
 document.body.style.overflow='hidden';
}

function hideConnGate(){
 const g=document.getElementById('conn-gate');
 if(g)g.style.display='none';
 document.body.style.overflow='';
}

async function gateConnect(){
 const url=(document.getElementById('cg-url')?.value||'').trim().replace(/\/$/,'');
 const key=(document.getElementById('cg-key')?.value||'').trim();
 const err=document.getElementById('cg-err');
 const btn=document.getElementById('cg-connect');
 if(err)err.textContent='';
 if(!url||!key){if(err)err.textContent='URL et clé requises.';return;}
 if(btn){btn.disabled=true;btn.textContent='Connexion…';}
 setSupabaseUrl(url);setSupabaseKey(key);_sbClient=null;
 const sb=getSB();
 if(!sb){if(btn){btn.disabled=false;btn.textContent='Se connecter';}if(err)err.textContent='Identifiants invalides.';return;}
 // Passer en mode chargement
 showConnGate('loading');
 try{
  const cgStatus=()=>document.getElementById('cg-status');
  if(cgStatus())cgStatus().textContent='Récupération de vos données…';
  await loadAllFromCloud();
  if(cgStatus())cgStatus().textContent='Préparation de l\'espace…';
  // Init complète
  setTimeout(startSignaturePolling, 2000);
  checkPendingKoEmails();
  setInterval(checkPendingKoEmails, 3600000);
  rDash();badges();initUserBadge();
  if(typeof rCands==='function')rCands();
  if(typeof updateConnIndicator==='function')updateConnIndicator();
  setTimeout(hideConnGate, 500); // petite pause pour que l'animation se voie
 }catch(e){
  // Échec → on remet le formulaire avec l'erreur
  setSupabaseUrl('');setSupabaseKey('');_sbClient=null;
  showConnGate();
  setTimeout(()=>{const er=document.getElementById('cg-err');if(er)er.textContent='Connexion échouée : '+e.message;},50);
 }
}

// ═══════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// CONTRAT — Génération PDF (jsPDF) + Aperçu + Envoi email avec PJ
// ═══════════════════════════════════════════════════════════════════

let _contractCoId = null;

// ── Validation SIRET (14 chiffres + algorithme de Luhn) ──
function isValidSiret(siret) {
 if (!siret) return false;
 const s = String(siret).replace(/\s/g, '');
 if (!/^\d{14}$/.test(s)) return false;
 let sum = 0;
 for (let i = 0; i < 14; i++) {
  let d = parseInt(s[i], 10);
  if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
  sum += d;
 }
 return sum % 10 === 0;
}

// ── Saisie SIRET en temps réel : valide + sauvegarde + active boutons ──
function _onSiretInput(val) {
 const co = coById(_contractCoId); if (!co) return;
 const clean = String(val).replace(/\s/g, '');
 co.siret = clean;
 const ok = isValidSiret(clean);
 const badge = document.getElementById('ct-siret-badge');
 const btnP = document.getElementById('ct-btn-preview');
 const btnS = document.getElementById('ct-btn-send');
 if (badge) {
  badge.textContent = ok ? '✓ Valide' : (clean.length === 14 ? '✗ Clé invalide' : '✗ Requis');
  badge.style.color = ok ? 'var(--ac5)' : 'var(--ac3)';
 }
 [btnP, btnS].forEach(b => {
  if (!b) return;
  b.disabled = !ok;
  b.style.opacity = ok ? '' : '.4';
  b.style.cursor = ok ? '' : 'not-allowed';
 });
 if (ok) save();
}

function openContractModal(coId) {
 _contractCoId = coId;
 const co = coById(coId); if (!co) return;
 const ct = co._contract_draft || {};
 const siretRaw = (co.siret || '').replace(/\s/g, '');
 const siretOk = isValidSiret(siretRaw);

 openMo('📄 Contrat — ' + esc(co.name), `
  <div style="max-height:68vh;overflow-y:auto;padding-right:2px">
  <div style="padding:9px 12px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);margin-bottom:14px;font-size:11px;display:flex;align-items:center;gap:8px">
   <div style="flex:1">
    <div style="font-weight:700">${esc(co.name)}</div>
    <div style="color:var(--mu)">${esc(co.contact||'')}${co.city?' · '+esc(co.city):''}</div>
   </div>
   ${co.email?`<span style="font-size:10px;color:var(--ac5)">${esc(co.email)}</span>`:'<span style="font-size:10px;color:var(--ac3)">⚠ Email manquant</span>'}
  </div>

  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px">SIRET du client <span style="color:var(--ac3)">obligatoire</span></div>
  <div style="background:var(--s3);border:1px solid ${siretOk?'var(--bd)':'var(--ac3)'};border-radius:var(--r2);padding:11px 13px;margin-bottom:14px">
   <div style="display:flex;align-items:center;gap:8px">
    <input id="ct-siret" type="text" inputmode="numeric" maxlength="17" value="${esc(co.siret||'')}" placeholder="123 456 789 00012"
     style="flex:1;font-family:'DM Mono',monospace;font-size:13px;font-weight:700;letter-spacing:.5px;padding:7px 10px"
     oninput="_onSiretInput(this.value)">
    <span id="ct-siret-badge" style="font-size:10px;font-weight:700;white-space:nowrap;color:${siretOk?'var(--ac5)':'var(--ac3)'}">${siretOk?'✓ Valide':'✗ Requis'}</span>
   </div>
   <div style="display:flex;align-items:center;justify-content:space-between;margin-top:7px;gap:8px">
    <span style="font-size:10px;color:var(--mu)">14 chiffres — identifie juridiquement l'entreprise sur le contrat</span>
    <a href="https://annuaire-entreprises.data.gouv.fr/rechercher?terme=${encodeURIComponent(((co.name||'')+' '+(co.city||'')).trim())}" target="_blank" rel="noopener"
     style="font-size:10px;color:var(--ac);text-decoration:none;white-space:nowrap;font-weight:600">🔍 Chercher le SIRET ↗</a>
   </div>
  </div>

  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px">Candidat concerné <span style="color:var(--mu2)">recommandé</span></div>
  <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);padding:9px 12px;margin-bottom:14px">
   ${(()=>{
     const cl=candidatsForClient(coId);
     if(!cl.length) return '<div style="font-size:10px;color:var(--mu)">Aucun candidat lié à un besoin de ce client. Vous pourrez l\'associer après la signature.</div>';
     const cur=(ct.candidat_id)||cl[0].id;
     return '<select id="ct-candidat" style="width:100%;font-size:12px;padding:6px 8px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;color:var(--tx)">'
      +cl.map(c=>{const ln=c.linked_need?nById(c.linked_need):null;return '<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+esc(c.name)+(ln?' — '+esc(ln.title):'')+'</option>';}).join('')
      +'</select><div style="font-size:9px;color:var(--mu2);margin-top:4px">Affiché automatiquement dans la pop-up de validation à la signature</div>';
   })()}
  </div>

  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px">Grille tarifaire</div>
  <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);overflow:hidden;margin-bottom:14px">
   <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;background:var(--s2);padding:7px 12px;gap:4px">
    <span style="font-size:9px;color:var(--mu2)">Profil</span>
    <span style="font-size:9px;color:var(--mu2);text-align:center">&lt; 5 ans</span>
    <span style="font-size:9px;color:var(--mu2);text-align:center">5–15 ans</span>
    <span style="font-size:9px;color:var(--mu2);text-align:center">&gt; 15 ans</span>
   </div>
   <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;padding:9px 12px;border-top:1px solid var(--bd);align-items:center">
    <span style="font-size:11px;font-weight:600">Non-cadre</span>
    <div style="text-align:center"><input id="ct-nc1" type="number" value="${ct.nc1||12}" min="1" max="40" step="0.5" style="width:60px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--ac);padding:4px 6px"> <span style="font-size:9px;color:var(--mu)">%</span></div>
    <div style="text-align:center"><input id="ct-nc2" type="number" value="${ct.nc2||13.5}" min="1" max="40" step="0.5" style="width:60px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--ac);padding:4px 6px"> <span style="font-size:9px;color:var(--mu)">%</span></div>
    <div style="text-align:center"><input id="ct-nc3" type="number" value="${ct.nc3||15}" min="1" max="40" step="0.5" style="width:60px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--ac);padding:4px 6px"> <span style="font-size:9px;color:var(--mu)">%</span></div>
   </div>
   <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;padding:9px 12px;border-top:1px solid var(--bd);align-items:center">
    <span style="font-size:11px;font-weight:600">Cadre</span>
    <div style="text-align:center"><input id="ct-c1" type="number" value="${ct.c1||15}" min="1" max="40" step="0.5" style="width:60px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--ac);padding:4px 6px"> <span style="font-size:9px;color:var(--mu)">%</span></div>
    <div style="text-align:center"><input id="ct-c2" type="number" value="${ct.c2||17}" min="1" max="40" step="0.5" style="width:60px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--ac);padding:4px 6px"> <span style="font-size:9px;color:var(--mu)">%</span></div>
    <div style="text-align:center"><input id="ct-c3" type="number" value="${ct.c3||20}" min="1" max="40" step="0.5" style="width:60px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--ac);padding:4px 6px"> <span style="font-size:9px;color:var(--mu)">%</span></div>
   </div>
  </div>
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px">Options</div>
  <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
   <label style="display:flex;align-items:center;gap:10px;padding:10px 13px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);cursor:pointer">
    <input type="checkbox" id="ct-geste" ${ct.geste?'checked':''} style="width:14px;height:14px;accent-color:var(--ac);flex-shrink:0">
    <div style="flex:1"><div style="font-size:11px;font-weight:600">Geste commercial — 1er recrutement</div><div style="font-size:10px;color:var(--mu)">Taux réduit pour le premier placement</div></div>
    <div style="display:flex;align-items:center;gap:5px">
     <input id="ct-geste-val" type="number" value="${ct.geste_val||12}" min="1" max="40" step="0.5" style="width:50px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--ac4);padding:4px 6px" onclick="event.stopPropagation()">
     <span style="font-size:9px;color:var(--mu)">%</span>
    </div>
   </label>
   <label style="display:flex;align-items:center;gap:10px;padding:10px 13px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);cursor:pointer">
    <input type="checkbox" id="ct-3070" ${ct.opt3070?'checked':''} style="width:14px;height:14px;accent-color:var(--ac);flex-shrink:0">
    <div><div style="font-size:11px;font-weight:600">Règlement 30 / 70 %</div><div style="font-size:10px;color:var(--mu)">30% signature contrat, 70% à l'intégration</div></div>
   </label>
   <label style="display:flex;align-items:center;gap:10px;padding:10px 13px;background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);cursor:pointer">
    <input type="checkbox" id="ct-garantie" ${ct.garantie?'checked':''} style="width:14px;height:14px;accent-color:var(--ac);flex-shrink:0">
    <div><div style="font-size:11px;font-weight:600">Garantie de remplacement — 3 mois</div><div style="font-size:10px;color:var(--mu)">Remplacement gratuit si départ dans les 3 mois</div></div>
   </label>
  </div>
  <div style="border-top:1px solid var(--bd);padding-top:12px;margin-bottom:4px">
   <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2)">Frais d'inscription</span>
    <span style="font-size:9px;color:var(--mu2)">optionnel · max 200€</span>
   </div>
   <div style="display:flex;align-items:center;gap:10px">
    <input type="range" id="ct-frais-slider" min="0" max="200" step="25" value="${ct.frais||0}" style="flex:1;accent-color:var(--ac)" oninput="document.getElementById('ct-frais').value=this.value;document.getElementById('ct-frais-disp').textContent=this.value>0?this.value+'€ HT':'Aucun'">
    <span id="ct-frais-disp" style="font-size:12px;font-family:'DM Mono',monospace;font-weight:700;min-width:60px;text-align:right">${(ct.frais||0)>0?(ct.frais||0)+'€ HT':'Aucun'}</span>
    <input type="hidden" id="ct-frais" value="${ct.frais||0}">
   </div>
   <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--mu2);margin-top:3px">
    <span>Aucun</span><span>50€</span><span>100€</span><span>150€</span><span>200€</span>
   </div>
  </div>
  </div>`,
  '<button class="btn bg" onclick="closeMo()">Annuler</button>' +
  '<button class="btn bg" id="ct-btn-preview" onclick="previewContract(\'' + coId + '\')"' + (siretOk?'':' disabled style="opacity:.4;cursor:not-allowed"') + '>👁 Aperçu contrat</button>' +
  '<button class="btn bp" id="ct-btn-send" onclick="sendContractEmail(\'' + coId + '\')"' + (siretOk?'':' disabled style="opacity:.4;cursor:not-allowed"') + '>📧 Envoyer au client</button>'
 );
 setTimeout(() => {
  const sl = document.getElementById('ct-frais-slider');
  const dp = document.getElementById('ct-frais-disp');
  const hi = document.getElementById('ct-frais');
  if (sl && dp && hi) {
   sl.oninput = function() {
    hi.value = this.value;
    dp.textContent = this.value > 0 ? this.value + '€ HT' : 'Aucun';
   };
  }
 }, 80);
}

function _getContractData(coId) {
 const co = coById(coId); if (!co) return null;
 const nom   = localStorage.getItem(uKey('btp_user_name'))  || localStorage.getItem('btp_user_name')  || 'Louis RENAULT';
 const tel   = localStorage.getItem(uKey('btp_user_tel'))   || localStorage.getItem('btp_user_tel')   || '06 58 21 20 96';
 const email = localStorage.getItem('btp_user_email') || 'contact@novalem-recrutement.fr';
 const dateStr = new Date().toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});
 return {
  client_name: co.name, client_siret: co.siret || '',
  nc1: parseFloat(document.getElementById('ct-nc1')?.value || 12),
  nc2: parseFloat(document.getElementById('ct-nc2')?.value || 13.5),
  nc3: parseFloat(document.getElementById('ct-nc3')?.value || 15),
  c1:  parseFloat(document.getElementById('ct-c1')?.value  || 15),
  c2:  parseFloat(document.getElementById('ct-c2')?.value  || 17),
  c3:  parseFloat(document.getElementById('ct-c3')?.value  || 20),
  geste:     !!(document.getElementById('ct-geste')?.checked),
  geste_val: parseFloat(document.getElementById('ct-geste-val')?.value || 12),
  opt3070:   !!(document.getElementById('ct-3070')?.checked),
  garantie:  !!(document.getElementById('ct-garantie')?.checked),
  frais:     parseInt(document.getElementById('ct-frais')?.value || 0),
  candidat_id: document.getElementById('ct-candidat')?.value || (co._contract_draft && co._contract_draft.candidat_id) || null,
  date_str:  dateStr,
  ref:       Math.random().toString(36).slice(2,12).toUpperCase(),
  user_name: nom, user_email: email, user_phone: tel,
 };
}

function generateContractPDF(data) {
 const jsPDFLib = window.jspdf;
 if (!jsPDFLib) { toast('jsPDF non chargé, réessayez', 'w'); return null; }
 const doc = new jsPDFLib.jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
 const W=210, H=297, ML=18, MR=18, MT=14, CW=174, bW=(CW-4)/2;
 const C = { n:[26,22,20], o:[201,137,26], g:[85,85,85], f:[245,243,239], l:[232,228,220] };
 const fc=(...rgb)=>doc.setFillColor(...rgb);
 const tc=(...rgb)=>doc.setTextColor(...rgb);
 const dc=(...rgb)=>doc.setDrawColor(...rgb);
 const sf=(s,sz)=>{doc.setFont('helvetica',s);doc.setFontSize(sz);};
 const wt=(t,x,y,o)=>doc.text(t,x,y,o||{});
 let y=MT;

 // En-tête
 sf('bold',22); tc(...C.n); wt('NOVA',ML,y+8);
 const nw=doc.getTextWidth('NOVA');
 tc(...C.o); wt('LEM',ML+nw,y+8);
 sf('normal',7.5); tc(...C.g);
 wt(data.user_email+'  ·  '+data.user_phone+'  ·  novalem-recrutement.fr',W-MR,y+4,{align:'right'});
 y+=10; sf('normal',8.5); tc(...C.o); wt('RECRUTEMENT BTP - CDI',ML,y+2);
 y+=5; dc(...C.o); doc.setLineWidth(0.8); doc.line(ML,y,W-MR,y); y+=7;

 // Titre
 sf('bold',14); tc(...C.n); wt('CONTRAT CADRE DE RECRUTEMENT',ML,y); y+=5;
 sf('normal',8.5); tc(...C.g); wt('Prestation de recrutement CDI \u2014 B\u00e2timent & Travaux Publics',ML,y); y+=9;

 // Parties
 function box(x,titre,nom,l2,l3){
  const h=l3?34:28;
  fc(...C.n);doc.rect(x,y,bW,8,'F');
  sf('bold',7.5);tc(255,255,255);wt(titre,x+4,y+5.2);
  fc(...C.f);doc.rect(x,y+8,bW,h-8,'F');
  dc(...C.l);doc.setLineWidth(0.3);doc.rect(x,y,bW,h,'S');
  sf('bold',10);tc(...C.n);wt(nom,x+4,y+15);
  sf('normal',8);tc(...C.g);wt(l2,x+4,y+21);
  if(l3)wt(l3,x+4,y+27);
  return h;
 }
 const bh1=box(ML,'LE CLIENT',data.client_name,'SIRET : '+(data.client_siret||'_______________'));
 box(ML+bW+4,'LE PRESTATAIRE','NOVALEM \u2014 '+data.user_name,'Cabinet de recrutement BTP \u2014 APE 7810Z',data.user_email+'  \u00b7  '+data.user_phone);
 y+=bh1+4;

 // Articles
 function art(num,titre,corps){
  if(y>H-52){doc.addPage();y=MT;}
  sf('bold',8.5);tc(...C.o);wt('Art. '+num+' \u2014 '+titre,ML,y);y+=4.5;
  sf('normal',8.5);tc(...C.n);
  const lines=doc.splitTextToSize(corps,CW);
  wt(lines,ML,y);y+=lines.length*4.2+2;
 }
 art('1','OBJET',"Le pr\u00e9sent contrat cadre d\u00e9finit les conditions dans lesquelles NOVALEM accompagne le Client dans l'ensemble de ses recrutements CDI relevant du B\u00e2timent et des Travaux Publics, sans limitation du nombre de postes, pour toute la dur\u00e9e de l'accord.");
 art('2','ENGAGEMENTS DE NOVALEM',"NOVALEM s'engage \u00e0 : sourcer des candidats qualifi\u00e9s ; proc\u00e9der \u00e0 leur pr\u00e9s\u00e9lection ; respecter la confidentialit\u00e9 des informations du Client ; ne pas approcher les salari\u00e9s du Client pendant la dur\u00e9e du contrat et les 12 mois suivants ; ne pas imposer de clause d'exclusivit\u00e9.");
 art('3','ENGAGEMENTS DU CLIENT',"Le Client s'engage \u00e0 : d\u00e9signer un interlocuteur unique ; communiquer sa d\u00e9cision sur chaque candidature dans les 8 jours calendaires ; recevoir les candidats retenus dans les 15 jours ; informer NOVALEM de tout recrutement d'un candidat pr\u00e9sent\u00e9 ; ex\u00e9cuter le contrat de bonne foi.");

 // Art. 4 Honoraires
 if(y>H-85){doc.addPage();y=MT;}
 sf('bold',8.5);tc(...C.o);wt('Art. 4 \u2014 HONORAIRES',ML,y);y+=4.5;
 sf('normal',8.5);tc(...C.n);
 wt('Les honoraires sont calcul\u00e9s en pourcentage du salaire brut annuel (SBA) convenu lors de chaque embauche :',ML,y);y+=5;
 const TR=[['Cat\u00e9gorie','< 5 ans','5 \u00e0 15 ans','> 15 ans'],['Non-cadre',data.nc1+' %',data.nc2+' %',data.nc3+' %'],['Cadre',data.c1+' %',data.c2+' %',data.c3+' %']];
 const CLS=[42,36,36,36];
 TR.forEach((row,ri)=>{
  let cx=ML;
  row.forEach((cell,ci)=>{
   if(ri===0)fc(...C.n);else if(ri===1)fc(...C.f);else fc(255,255,255);
   doc.rect(cx,y,CLS[ci],7,'F');
   dc(...C.l);doc.setLineWidth(0.3);doc.rect(cx,y,CLS[ci],7,'S');
   if(ri===0){sf('bold',8);tc(255,255,255);}
   else if(ci===0){sf('bold',8.5);tc(...C.n);}
   else{sf('normal',8.5);tc(...C.n);}
   wt(cell,ci===0?cx+4:cx+CLS[ci]/2,y+4.7,{align:ci===0?'left':'center'});
   cx+=CLS[ci];
  });
  y+=7;
 });
 y+=3;
 const opts=[];
 if(data.geste)opts.push('\u203a Geste commercial 1er recrutement : taux r\u00e9duit \u00e0 '+data.geste_val+' % pour le premier placement.');
 if(data.opt3070)opts.push('\u203a Modalit\u00e9 de r\u00e8glement 30/70 : 30 % \u00e0 la signature, 70 % \u00e0 l\'int\u00e9gration effective.');
 if(data.garantie)opts.push('\u203a Garantie de remplacement : d\u00e9part dans les 3 mois = reprise mission sans suppl\u00e9ment d\'honoraires.');
 if(data.frais>0)opts.push('\u203a Frais de dossier : '+data.frais+' \u20ac HT, exigibles \u00e0 la signature du pr\u00e9sent contrat.');
 opts.push('\u203a Les honoraires sont exigibles exclusivement en cas d\'int\u00e9gration effective. Aucun frais en l\'absence d\'embauche.');
 opts.forEach((line,i)=>{
  sf('normal',8.5);tc(...(i===opts.length-1?C.g:C.n));
  const w=doc.splitTextToSize(line,CW-4);
  wt(w,ML+2,y);y+=w.length*4.2+1.5;
 });
 y+=1;

 art('5','MODALIT\u00c9S DE R\u00c8GLEMENT',"Facturation \u00e0 la date d'int\u00e9gration effective. R\u00e8glement par virement bancaire \u00e0 r\u00e9ception de facture, sans escompte. Retards de paiement : p\u00e9nalit\u00e9s de plein droit au taux l\u00e9gal + 5 points + indemnit\u00e9 forfaitaire 40 \u20ac (art. L. 441-6 C. com.).");
 art('6','DROIT DE SUITE',"Pendant 24 mois suivant la fin du contrat, tout recrutement d'un candidat pr\u00e9sent\u00e9 directement ou indirectement ouvre droit aux honoraires de l'article 4.");
 art('7','CONFIDENTIALIT\u00c9 & RGPD',"Chaque partie traite avec confidentialit\u00e9 les informations \u00e9chang\u00e9es pendant la dur\u00e9e du contrat et les 5 ans suivants. NOVALEM traite les donn\u00e9es des candidats en qualit\u00e9 de responsable de traitement (R\u00e8gl. UE 2016/679).");
 art('8','DUR\u00c9E ET R\u00c9SILIATION',"Contrat de 12 mois, renouvelable tacitement par mois. R\u00e9siliation par LRAR sous pr\u00e9avis d'un mois. La clause de droit de suite demeure applicable apr\u00e8s toute extinction.");
 art('9','DROIT APPLICABLE',"Contrat soumis au droit fran\u00e7ais. Tout litige non r\u00e9solu amiablement sous 30 jours : comp\u00e9tence exclusive des Tribunaux de Nice (Alpes-Maritimes).");

 y+=3;dc(...C.l);doc.setLineWidth(0.4);doc.line(ML,y,W-MR,y);y+=6;

 // Signatures
 if(y>H-58){doc.addPage();y=MT;}
 fc(...C.n);doc.rect(ML,y,bW,8,'F');sf('bold',7.5);tc(255,255,255);wt('POUR LE CLIENT',ML+4,y+5.2);
 fc(...C.f);doc.rect(ML,y+8,bW,42,'F');dc(...C.l);doc.setLineWidth(0.3);doc.rect(ML,y,bW,50,'S');
 sf('bold',10);tc(...C.n);wt(data.client_name,ML+4,y+15);
 sf('normal',8);tc(...C.g);wt('SIRET : '+(data.client_siret||'_______________'),ML+4,y+21);
 sf('bold',8);tc(...C.o);wt('SIGNATURE \u00c9LECTRONIQUE',ML+4,y+33);
 sf('normal',7.5);tc(...C.g);wt('Un lien de signature vous est envoy\u00e9 par email',ML+4,y+38);
 sf('bold',8);tc(...C.n);wt('R\u00e9f. : '+data.ref,ML+4,y+44);

 const bx2=ML+bW+4;
 fc(...C.n);doc.rect(bx2,y,bW,8,'F');sf('bold',7.5);tc(255,255,255);wt('POUR NOVALEM',bx2+4,y+5.2);
 fc(...C.f);doc.rect(bx2,y+8,bW,42,'F');dc(...C.l);doc.setLineWidth(0.3);doc.rect(bx2,y,bW,50,'S');
 sf('bold',10);tc(...C.n);wt(data.user_name,bx2+4,y+15);
 sf('normal',8);tc(...C.g);wt('Directeur \u2014 NOVALEM',bx2+4,y+21);
 sf('italic',12);tc(...C.o);wt('L. Renault',bx2+4,y+34);
 sf('normal',7.5);tc(...C.g);wt('Signature',bx2+4,y+39);
 sf('normal',8);tc(...C.n);wt('Fait \u00e0 Nice, le '+data.date_str,bx2+4,y+45);

 const np=doc.getNumberOfPages();
 const ft='NOVALEM \u00b7 Cabinet de recrutement BTP \u00b7 APE 7810Z \u00b7 '+data.user_email+' \u00b7 '+data.user_phone+' \u00b7 Document confidentiel \u2014 g\u00e9n\u00e9r\u00e9 le '+data.date_str;
 for(let p=1;p<=np;p++){
  doc.setPage(p);
  dc(...C.l);doc.setLineWidth(0.3);doc.line(ML,H-12,W-MR,H-12);
  sf('normal',6.5);tc(...C.g);
  wt(ft,ML,H-8);wt(p+' / '+np,W-MR,H-8,{align:'right'});
 }
 return doc.output('datauristring');
}

function previewContract(coId) {
 const data = _getContractData(coId); if(!data) return;
 const co = coById(coId);
 if(co){
  co._contract_draft={nc1:data.nc1,nc2:data.nc2,nc3:data.nc3,c1:data.c1,c2:data.c2,c3:data.c3,geste:data.geste,geste_val:data.geste_val,opt3070:data.opt3070,garantie:data.garantie,frais:data.frais,candidat_id:data.candidat_id};
  save();
 }
 toast('Génération du contrat…','i');
 setTimeout(()=>{
  const uri=generateContractPDF(data); if(!uri) return;
  closeMo();
  const de=encodeURIComponent(JSON.stringify(data));
  openMo('👁 Aperçu — Contrat '+esc(data.client_name),
   '<div style="text-align:center;margin-bottom:8px;font-size:11px;color:var(--mu)">Vérifiez le contrat avant envoi</div>'+
   '<iframe src="'+uri+'" style="width:100%;height:520px;border:none;border-radius:6px;background:#fff"></iframe>',
   '<button class="btn bg" onclick="closeMo();openContractModal(\''+coId+'\')">← Modifier</button>'+
   '<button class="btn bp" onclick="sendContractEmail(\''+coId+'\',\''+de+'\')">📧 Envoyer au client</button>'
  );
 },150);
}


function sendContractEmail(coId, encodedData) {
 let data;
 if(encodedData){try{data=JSON.parse(decodeURIComponent(encodedData));}catch(e){data=null;}}
 if(!data) data=_getContractData(coId);
 if(!data) return;
 const co=coById(coId);if(!co)return;
 if(!co.email){toast('Email client manquant — ajoutez-le dans la fiche','e');return;}
 if(!isValidSiret(co.siret)){toast('SIRET invalide ou manquant — renseignez-le avant l\'envoi','e');return;}

 // Sauvegarder le draft négocié
 co._contract_draft={
  nc1:data.nc1,nc2:data.nc2,nc3:data.nc3,
  c1:data.c1,c2:data.c2,c3:data.c3,
  geste:data.geste,geste_val:data.geste_val,
  opt3070:data.opt3070,garantie:data.garantie,
  frais:data.frais,candidat_id:data.candidat_id,sent_at:now_()
 };
 save();

 // Générer le PDF et le stocker pour emSend
 const uri=generateContractPDF(data);
 if(uri){
  sessionStorage.setItem('_contract_pdf_b64',uri.split(',')[1]||'');
  sessionStorage.setItem('_contract_pdf_name','Contrat_Novalem_'+co.name.replace(/\W+/g,'_')+'.pdf');
 }

 // Générer l'URL de signature
 const ctId=uid(),token=uid()+uid();
 const dp=[
  encodeURIComponent(co.name),encodeURIComponent(co.siret||''),
  data.nc1,data.nc2,data.nc3,data.c1,data.c2,data.c3,
  data.geste?String(data.geste_val):'',
  data.opt3070?'1':'0',data.garantie?'1':'0',
  encodeURIComponent(data.date_str),data.frais||''
 ].join('|');
 const signUrl='https://novalem-crm.vercel.app/sign.html?co='+encodeURIComponent(coId)
  +'&ct='+ctId+'&t='+token
  +'&n='+encodeURIComponent(co.name)
  +'&d='+encodeURIComponent(dp);

 // ── EMAIL HTML via buildHtml de l'API ──────────────
 // Syntaxe spéciale : [Texte ->(url) = bouton CTA, > = puce dorée, **gras**
 const civPrenom = greetCo(co);

 let conditions = '';
 conditions += '> Non-cadre : **' + data.nc1 + ' %** / **' + data.nc2 + ' %** / **' + data.nc3 + ' %** du SBA (selon expérience)\n\n';
 conditions += '> Cadre : **' + data.c1 + ' %** / **' + data.c2 + ' %** / **' + data.c3 + ' %** du SBA (selon expérience)\n\n';
 if(data.geste)   conditions += '> Geste commercial 1er recrutement : **' + data.geste_val + ' %**\n\n';
 if(data.opt3070) conditions += '> Règlement **30 / 70 %**\n\n';
 if(data.garantie)conditions += '> Garantie de remplacement **3 mois**\n\n';
 // Frais non affichés dans le mail (subtil, dans le PDF uniquement)

 const body = 'Bonjour' + (civPrenom ? ' ' + civPrenom : '') + ',\n\n'
  + 'Suite à notre échange, je vous transmets notre proposition professionnelle de recrutement.\n\n'
  + '---\n\n'
  + '**Conditions convenues :**\n\n'
  + conditions
  + 'Nos honoraires sont dus exclusivement en cas d\'intégration effective du candidat.'
  + ' Aucun frais si le recrutement n\'aboutit pas.\n\n'
  + '---\n\n'
  + 'Pour signer le contrat, cliquez sur le bouton ci-dessous.'
  + ' La signature prend moins de 30 secondes, sans impression ni scan.\n\n'
  + '[Signer le contrat NOVALEM ->(' + signUrl + ')\n\n'
  + 'Dès réception de votre signature, je vous transmets immédiatement les coordonnées'
  + ' du candidat afin que vous puissiez organiser l\'entretien.\n\n'
  + 'Bien cordialement,\n'
  + '**' + (data.user_name || 'Louis Renault') + '**\n'
  + (data.user_phone || '+33 6 58 21 20 96') + '\n'
  + 'NOVALEM — Recrutement BTP\n'
  + 'contact@novalem-recrutement.fr';

 // Stocker le HTML (buildHtml est côté serveur — on garde body pour buildHtml)
 // Pas besoin de stocker HTML ici — l'API le construit depuis body
 sessionStorage.removeItem('_contract_email_html'); // Pas de HTML custom = l'API utilise buildHtml

 addTimeline(coId,'status','Contrat envoyé'+(data.frais>0?' (frais : '+data.frais+'€)':''),null);

 // ═══ AUTOMATISATION AGENDA — envoi de contrat ═══
 // 1) Trace de l'envoi (événement marqué fait → apparaît dans l'historique de la fiche & de l'agenda)
 const candLie=data.candidat_id||null;
 const candNom=candLie&&cById(candLie)?cById(candLie).name:'';
 addAgendaAuto({
  type:'contract',
  title:'Contrat envoyé — '+co.name,
  date:todayKey(),
  time:new Date().toTimeString().slice(0,5),
  comp_id:coId,
  cand_id:candLie,
  notes:'Proposition professionnelle envoyée à '+co.name+(candNom?' (candidat : '+candNom+')':'')+(data.frais>0?'\nFrais : '+data.frais+'€':'')+'\nEn attente de signature.',
  done:true,
  _contract_log:true
 });
 // 2) Relance signature à J+3 ouvrés (sauf si déjà signé) — sans doublon
 if(!co._contract_signed){
  DB.agenda=DB.agenda.filter(a=>!(a._contract_followup&&a.comp_id===coId&&!a.done));
  addAgendaAuto({
   type:'relance',
   title:'Relancer signature — '+co.name,
   date:localDateStr(addWorkingDays(new Date(),3)),
   time:'09:30',
   comp_id:coId,
   cand_id:candLie,
   notes:'Contrat envoyé le '+fD(todayKey())+'. Relancer la signature si toujours en attente.\nLe lien de signature est renvoyable en 1 clic depuis la fiche client (bouton « Relancer »).',
   _contract_followup:true
  });
 }
 save();

 EM={to:co.email,subject:'Proposition professionnelle NOVALEM — '+co.name,body:body,candId:null,coId:coId,tplKey:null};
 EM_VIEW='compose';
 closeMo();
 setTimeout(()=>go('emails'),100);
 toast('Email contrat prêt · Relance auto planifiée dans l\'agenda ✓','s');
}

// ── RELANCE SIGNATURE CONTRAT ──────────────────────────────────
// Ouvre un email de relance pré-rempli (client + lien de signature) pour
// un contrat déjà envoyé mais pas encore signé. Le lien est reconstruit à
// partir du contrat négocié mémorisé (co._contract_draft).
function relanceContract(coId){
 const co=coById(coId); if(!co){toast('Client introuvable','e');return;}
 const ct=co._contract_draft;
 if(!ct){toast('Aucun contrat envoyé pour ce client','e');return;}
 if(co._contract_signed){toast('Ce contrat est déjà signé ✓','s');return;}
 if(!co.email){toast('Email client manquant — ajoutez-le dans la fiche','e');return;}

 // Reconstruire l'URL de signature (même format que l'envoi initial)
 const ctId=uid(),token=uid()+uid();
 const dateStr=ct.sent_at
  ? new Date(ct.sent_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})
  : new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
 const dp=[
  encodeURIComponent(co.name),encodeURIComponent(co.siret||''),
  ct.nc1,ct.nc2,ct.nc3,ct.c1,ct.c2,ct.c3,
  ct.geste?String(ct.geste_val):'',
  ct.opt3070?'1':'0',ct.garantie?'1':'0',
  encodeURIComponent(dateStr),ct.frais||''
 ].join('|');
 const signUrl='https://novalem-crm.vercel.app/sign.html?co='+encodeURIComponent(coId)
  +'&ct='+ctId+'&t='+token
  +'&n='+encodeURIComponent(co.name)
  +'&d='+encodeURIComponent(dp);

 const nom=localStorage.getItem(uKey('btp_user_name'))||localStorage.getItem('btp_user_name')||'Louis RENAULT';
 const tel=localStorage.getItem(uKey('btp_user_tel'))||localStorage.getItem('btp_user_tel')||'06 58 21 20 96';
 const greeting=greetCo(co);
 const sentLabel=ct.sent_at?fD(ct.sent_at):'';

 const body='Bonjour '+greeting+',\n\n'
  +'Je me permets de revenir vers vous concernant notre proposition professionnelle de recrutement'
  +(sentLabel?' transmise le '+sentLabel:'')+'.\n\n'
  +'Le contrat est toujours en attente de votre signature. Celle-ci se fait en ligne, en moins de 30 secondes, sans impression ni scan.\n\n'
  +'[Signer le contrat NOVALEM ->('+signUrl+')\n\n'
  +'Dès réception de votre signature, je vous transmets immédiatement les coordonnées du candidat afin que vous puissiez organiser l\'entretien.\n\n'
  +'Je reste à votre disposition pour toute question.\n\n'
  +'Bien cordialement,\n**'+nom+'**\n'+tel+'\nNOVALEM — Recrutement BTP\ncontact@novalem-recrutement.fr';

 sessionStorage.removeItem('_contract_email_html'); // l'API reconstruit le HTML depuis le body
 addTimeline(coId,'email','Relance signature contrat envoyée',null);
 EM={to:co.email,subject:'Relance — signature du contrat NOVALEM ('+co.name+')',body:body,candId:null,coId:coId,tplKey:null};
 EM_VIEW='compose';
 if(typeof closeMo==='function')closeMo();
 setTimeout(()=>go('emails'),100);
 toast('Email de relance prêt — vérifiez puis envoyez','s');
}



// ═══════════════════════════════════════════════════════
// MAIL REFUS KO — envoyé automatiquement 48h après KO
// ═══════════════════════════════════════════════════════
async function sendKoRefusalEmail(cand) {
 if(!cand.email)return;
 const nom  = localStorage.getItem(uKey('btp_user_name'))||'Louis RENAULT';
 const tel  = localStorage.getItem(uKey('btp_user_tel'))||'06 58 21 20 96';
 const prenom = greetCand(cand);
 const body = 'Bonjour '+(prenom||'Madame, Monsieur')+',\n\n'
  + 'Suite à notre échange et après examen attentif de votre candidature, nous avons le regret de vous informer que nous ne sommes pas en mesure de donner une suite favorable à votre dossier à ce stade.\n\n'
  + 'Cette décision ne remet pas en cause la qualité de votre profil. Nous conservons votre candidature dans notre base et reviendrons vers vous si une opportunité correspondant à vos compétences se présente.\n\n'
  + 'Nous vous souhaitons une pleine réussite dans vos démarches.\n\n'
  + 'Bien cordialement,\n**'+nom+'**\n'+tel+'\nNovalem — Cabinet de recrutement BTP';
 const apiBase = getApiBase();
 if(!apiBase)return;
 try{
  await fetch(apiBase+'/api/send-email',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({to:cand.email,subject:'Suite à votre candidature — NOVALEM',body})
  });
  cand._ko_email_sent=true;
  addTimeline(cand.id,'ko_email','Email de refus envoyé automatiquement',null);
  save();
  toast('Email de refus envoyé à '+cand.name,'i');
 }catch(e){}
}

// Vérifier les KO en attente d'email au démarrage + toutes les heures
function checkPendingKoEmails(){
 const now=Date.now();
 DB.candidates.forEach(c=>{
  if(c.status==='ko'&&c._ko_email_at&&!c._ko_email_sent&&c._ko_email_at<=now&&c.email){
   sendKoRefusalEmail(c);
  }
 });
}


// ═══════════════════════════════════════════════════════
// FACTURATION — Suivi des honoraires et paiements
// ═══════════════════════════════════════════════════════

// ── Numérotation séquentielle ROBUSTE ──
// Basée sur un compteur persistant par année (jamais de doublon même après suppression).
function getInvoiceNumber(){
 const year=new Date().getFullYear();
 DB._invoice_seq=DB._invoice_seq||{};
 // Si pas encore de compteur pour l'année, on l'initialise au max existant
 if(!DB._invoice_seq[year]){
  let max=0;
  (DB.invoices||[]).forEach(inv=>{
   if(inv.invoice_number){
    const m=inv.invoice_number.match(new RegExp('NOVALEM-'+year+'-(\\d+)'));
    if(m){const n=parseInt(m[1],10);if(n>max)max=n;}
   }
  });
  DB._invoice_seq[year]=max;
 }
 DB._invoice_seq[year]++;
 return`NOVALEM-${year}-${String(DB._invoice_seq[year]).padStart(3,'0')}`;
}

// ── Auto-calcul du taux d'honoraires depuis le contrat signé ──
// Lit la grille négociée dans co._contract_draft et sélectionne la bonne
// case selon le statut (cadre/non-cadre) et l'expérience du candidat.
function computeHonoraireRate(co, isCadre, expYears){
 const ct=co&&co._contract_draft;
 // Pas de contrat → taux par défaut configuré
 if(!ct){
  return{rate:Number(getTauxHon()),source:'défaut',tranche:''};
 }
 // Tranche d'expérience : <5 ans / 5-15 ans / >15 ans
 let tIdx,tLabel;
 if(expYears<5){tIdx=1;tLabel='moins de 5 ans';}
 else if(expYears<=15){tIdx=2;tLabel='5 à 15 ans';}
 else{tIdx=3;tLabel='plus de 15 ans';}
 const key=(isCadre?'c':'nc')+tIdx;
 const rate=Number(ct[key]);
 if(!rate||isNaN(rate)){
  return{rate:Number(getTauxHon()),source:'défaut',tranche:tLabel};
 }
 return{
  rate,
  source:'contrat signé',
  tranche:tLabel,
  isCadre,
  geste:ct.geste?Number(ct.geste_val||0):0,
 };
}

function rFacturation(){
 DB.invoices=DB.invoices||[];
 const invs=DB.invoices;
 const filter=UI.invFilter||'all';

 // Auto-mark overdue
 const todayStr=todayKey();
 let changed=false;
 invs.forEach(inv=>{if(inv.status==='sent'&&inv.due_date&&inv.due_date<todayStr){inv.status='overdue';changed=true;}});
 if(changed)save();

 const totPaid=invs.filter(i=>i.status==='paid').reduce((a,i)=>a+Number(i.amount||0),0);
 const totPending=invs.filter(i=>i.status==='sent').reduce((a,i)=>a+Number(i.amount||0),0);
 const totOverdue=invs.filter(i=>i.status==='overdue').reduce((a,i)=>a+Number(i.amount||0),0);

 const stStyle={
 draft:{bg:'var(--s3)',tx:'var(--mu)',l:'Brouillon'},
 sent:{bg:'rgba(74,130,224,.12)',tx:'var(--ac5)',l:'Envoyée'},
 overdue:{bg:'rgba(224,74,74,.1)',tx:'var(--ac3)',l:'! En retard'},
 paid:{bg:'rgba(61,224,154,.1)',tx:'var(--ac2)',l:'Payée'},
 disputed:{bg:'rgba(224,152,58,.1)',tx:'var(--ac4)',l:'! Litige'},
 };

 const filters=[
 {id:'all',l:`Toutes (${invs.length})`},
 {id:'draft',l:`Brouillons (${invs.filter(i=>i.status==='draft').length})`},
 {id:'sent',l:`Envoyées (${invs.filter(i=>i.status==='sent').length})`},
 {id:'overdue',l:`En retard (${invs.filter(i=>i.status==='overdue').length})`},
 {id:'paid',l:`Payées (${invs.filter(i=>i.status==='paid').length})`},
 ];

 const visible=(filter==='all'?invs:invs.filter(i=>i.status===filter))
 .slice().sort((a,b)=>new Date(b.created)-new Date(a.created));

 document.getElementById('view-facturation').innerHTML=`
 <div class="dkpi" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
 <div class="kpi" style="cursor:pointer" onclick="UI.invFilter='paid';rFacturation()"><div class="kpi-v ac">${fM(Math.round(totPaid))}</div><div class="kpi-l">CA encaissé</div></div>
 <div class="kpi" style="cursor:pointer" onclick="UI.invFilter='sent';rFacturation()"><div class="kpi-v ac5">${fM(Math.round(totPending))}</div><div class="kpi-l">En attente paiement</div></div>
 <div class="kpi" style="cursor:pointer" onclick="UI.invFilter='overdue';rFacturation()"><div class="kpi-v ac3">${fM(Math.round(totOverdue))}</div><div class="kpi-l">En retard</div></div>
 <div class="kpi" style="cursor:pointer" onclick="openInvoiceForm()"><div class="kpi-v" style="color:var(--mu)">${invs.filter(i=>i.status==='draft').length}</div><div class="kpi-l">Brouillons</div></div>
 </div>
 <div class="vtabs" style="margin-bottom:14px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
 ${filters.map(f=>`<div class="vt ${filter===f.id?'act':''}" onclick="UI.invFilter='${f.id}';rFacturation()">${f.l}</div>`).join('')}
 <div style="flex:1"></div>
 <button class="btn bg bxs" onclick="openInvoiceSettings()" title="Coordonnées légales">⚙ Coordonnées</button>
 <button class="btn bp bxs" onclick="openInvoiceForm()">+ Facture</button>
 </div>
 ${visible.length?`
 <table class="tbl">
 <thead><tr>
 <th>N° Facture</th><th>Client</th><th>Candidat</th>
 <th>Montant HT</th><th>Émission</th><th>Échéance</th><th>Statut</th><th></th>
 </tr></thead>
 <tbody>${visible.map(inv=>{
 const co=coById(inv.company_id);
 const cand=cById(inv.cand_id);
 const ss=stStyle[inv.status]||stStyle.draft;
 return`<tr onclick="openInvoicePanel('${inv.id}')" style="cursor:pointer">
 <td><span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ac)">${esc(inv.invoice_number||'—')}</span></td>
 <td><strong>${co?esc(co.name):'—'}</strong></td>
 <td>${cand?esc(cand.name):'—'}</td>
 <td><strong style="color:var(--ac);font-family:'Syne',sans-serif">${fM(inv.amount)}</strong></td>
 <td style="font-size:10px;color:var(--mu)">${inv.invoice_date?fD(inv.invoice_date):'—'}</td>
 <td style="font-size:10px;color:${inv.status==='overdue'?'var(--ac3)':'var(--mu)'}">${inv.due_date?fD(inv.due_date):'—'}</td>
 <td><span style="padding:2px 8px;border-radius:10px;font-size:10px;background:${ss.bg};color:${ss.tx}">${ss.l}</span></td>
 <td onclick="event.stopPropagation()" class="acol">
 ${inv.status==='draft'?`<button class="btn bi bxs" onclick="markInvoiceSent('${inv.id}')">Envoyer</button>`:''}
 ${['sent','overdue'].includes(inv.status)?`<button class="btn bp bxs" onclick="markInvoicePaid('${inv.id}')">Payée ✓</button>`:''}
 </td>
 </tr>`;
 }).join('')}</tbody>
 </table>
 `:`<div style="text-align:center;padding:60px 20px;color:var(--mu2)">
 <div style="font-size:36px;margin-bottom:12px"></div>
 <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;margin-bottom:6px">Aucune facture</div>
 <div style="font-size:11px;margin-bottom:16px">Les factures sont créées automatiquement quand vous marquez un candidat comme "Placé".</div>
 <button class="btn bp bsm" onclick="openInvoiceForm()">+ Créer manuellement</button>
 </div>`}`;
}

function openInvoicePanel(id){
 const inv=(DB.invoices||[]).find(i=>i.id===id);if(!inv)return;
 UI.ptype='inv';UI.pid=id;
 const co=coById(inv.company_id);const cand=cById(inv.cand_id);
 const stStyle={draft:{bg:'var(--s3)',tx:'var(--mu)',l:'Brouillon'},sent:{bg:'rgba(74,130,224,.12)',tx:'var(--ac5)',l:'Envoyée'},overdue:{bg:'rgba(224,74,74,.1)',tx:'var(--ac3)',l:'! En retard'},paid:{bg:'rgba(61,224,154,.1)',tx:'var(--ac2)',l:'Payée'},disputed:{bg:'rgba(224,152,58,.1)',tx:'var(--ac4)',l:'! Litige'}};
 const ss=stStyle[inv.status]||stStyle.draft;
 const taux=inv.salary&&inv.amount?Math.round(inv.amount/inv.salary*100):18;
 setPanel(inv.invoice_number||'Facture',
 `<span style="padding:2px 8px;border-radius:10px;font-size:10px;background:${ss.bg};color:${ss.tx}">${ss.l}</span>`,
 null,
 `<div class="dr"><span class="drk">Client</span><span class="drv">${co?`<span class="ac5" style="cursor:pointer" onclick="openCoPanel('${co.id}')">${esc(co.name)}</span>`:'—'}</span></div>
 <div class="dr"><span class="drk">Candidat</span><span class="drv">${cand?`<span class="ac5" style="cursor:pointer" onclick="openCandPanel('${cand.id}')">${esc(cand.name)}</span>`:'—'}</span></div>
 <div class="dr"><span class="drk">Salaire brut</span><span class="drv">${fM(inv.salary)}</span></div>
 <div class="dr"><span class="drk">Taux honoraires</span><span class="drv">${taux}%</span></div>
 <div class="dr"><span class="drk">Montant HT</span><span class="drv" style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;color:var(--ac)">${fM(inv.amount)}</span></div>
 <div class="dr"><span class="drk">Émission</span><span class="drv">${inv.invoice_date?fD(inv.invoice_date):'—'}</span></div>
 <div class="dr"><span class="drk">Échéance</span><span class="drv" style="color:${inv.status==='overdue'?'var(--ac3)':'inherit'}">${inv.due_date?fD(inv.due_date):'—'}</span></div>
 ${inv.paid_date?`<div class="dr"><span class="drk">Payée le</span><span class="drv ac2">✓ ${fD(inv.paid_date)}</span></div>`:''}
 ${inv.notes?`<div class="sl">Notes</div><div class="notebox">${esc(inv.notes)}</div>`:''}
 <div class="sl mt12">Récapitulatif</div>
 <div class="notebox fs10" style="line-height:1.9">${esc(inv.invoice_number||'')} · ${co?esc(co.name):'?'}<br>Placement de ${cand?esc(cand.name):'?'}<br>Honoraires ${taux}% × ${fM(inv.salary)} = <strong style="color:var(--ac)">${fM(inv.amount)}</strong><br>${inv.due_date?`Échéance ${fD(inv.due_date)}`:''}</div>`,
 `<button class="btn bp bsm" onclick="generateInvoicePDF('${id}')">📄 Télécharger le PDF</button>
 ${co&&co.email?`<button class="btn bi bsm" onclick="emailInvoiceToClient('${id}')">📧 Envoyer au client</button>`:''}
 ${inv.status==='draft'?`<button class="btn bg bsm" onclick="markInvoiceSent('${id}')">Marquer envoyée</button>`:''}
 ${['sent','overdue'].includes(inv.status)?`<button class="btn bp bsm" onclick="markInvoicePaid('${id}')">Marquer payée ✓</button>`:''}
 <button class="btn bg bsm" onclick="editInvoiceNotes('${id}')">Notes</button>
 <button class="btn bd_ bsm" onclick="deleteInvoice('${id}')">Supprimer</button>`
);
}

function openInvoiceForm(candId){
 const cands=DB.candidates.filter(c=>['presented','placed'].includes(c.status));
 if(!cands.length){
  openMo('+ Nouvelle facture',`<div style="text-align:center;padding:24px 12px;color:var(--mu)">
   <div style="font-size:32px;margin-bottom:10px">📋</div>
   <div style="font-size:12px;line-height:1.6">Aucun candidat présenté ou placé pour le moment.<br>Une facture se crée à partir d'un placement confirmé.</div>
  </div>`,'<button class="btn bg" onclick="closeMo()">Fermer</button>');
  return;
 }
 const candOpts=cands.map(c=>{
  const n=c.linked_need?DB.needs.find(nd=>nd.id===c.linked_need):null;
  const co=n?coById(n.company_id):null;
  return`<option value="${c.id}" ${c.id===candId?'selected':''}>${esc(c.name)}${co?' — '+esc(co.name):''}</option>`;
 }).join('');
 openMo('+ Nouvelle facture d\u0027honoraires',`
  <div class="fg">
   <div class="fgrp ff"><span class="lbl">Candidat placé *</span>
    <select id="nif-cand" onchange="_invCandChanged()">
     <option value="">— Choisir le candidat —</option>${candOpts}
    </select>
   </div>
   <div id="nif-contract-info" style="display:none;font-size:10px;padding:8px 11px;border-radius:var(--r2);margin-bottom:10px"></div>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="fgrp"><span class="lbl">Statut du candidat *</span>
     <select id="nif-cadre" onchange="_invResetTaux()">
      <option value="0">Non-cadre</option>
      <option value="1">Cadre</option>
     </select>
    </div>
    <div class="fgrp"><span class="lbl">Expérience (années) *</span>
     <input id="nif-exp" type="number" min="0" placeholder="6" oninput="_invResetTaux()">
    </div>
   </div>
   <div class="fgrp"><span class="lbl">Salaire brut annuel négocié (€) *</span>
    <input id="nif-sal" type="number" placeholder="39000" oninput="_invRecalc()">
   </div>
   <div class="fgrp"><span class="lbl">Taux honoraires appliqué (%)</span>
    <div style="display:flex;gap:8px;align-items:center">
     <input id="nif-taux" type="number" step="0.5" style="flex:1" oninput="_invRecalc(true)">
     <button class="btn bg bxs" onclick="_invResetTaux()" title="Recalculer depuis le contrat">↻ Auto</button>
    </div>
    <div id="nif-taux-src" style="font-size:9px;color:var(--mu2);margin-top:3px"></div>
   </div>
   <div class="fgrp ff" id="nif-preview" style="background:rgba(207,224,70,.07);border:1px solid rgba(207,224,70,.22);border-radius:var(--r2);padding:13px 14px;display:none">
    <div id="nif-preview-detail" style="font-size:10.5px;color:var(--mu);line-height:1.85;margin-bottom:8px"></div>
    <div style="border-top:1px solid var(--bd);padding-top:8px;display:flex;justify-content:space-between;align-items:baseline">
     <span style="font-size:11px;color:var(--mu)">Montant honoraires HT</span>
     <span id="nif-preview-amt" style="font-family:'Syne',sans-serif;font-weight:800;font-size:22px;color:var(--ac)">—</span>
    </div>
   </div>
   <div class="fgrp ff"><span class="lbl">Date de prise de poste</span>
    <input id="nif-prise-poste" type="date">
   </div>
   <div class="fgrp ff"><span class="lbl">Notes (optionnel)</span>
    <textarea id="nif-notes" style="min-height:44px" placeholder="Précisions sur la prestation…"></textarea>
   </div>
  </div>`,
  `<button class="btn bg" onclick="closeMo()">Annuler</button>
   <button class="btn bp" onclick="saveInvoiceForm()">Créer la facture</button>`
 );
 if(candId){setTimeout(()=>_invCandChanged(),60);}
}

function _invCandChanged(){
 const candId=document.getElementById('nif-cand')?.value;
 const info=document.getElementById('nif-contract-info');
 if(!candId){if(info)info.style.display='none';return;}
 const c=cById(candId);if(!c)return;
 const need=c.linked_need?DB.needs.find(n=>n.id===c.linked_need):null;
 const co=need?coById(need.company_id):null;
 if(c.salary){const el=document.getElementById('nif-sal');if(el)el.value=c.salary;}
 if(info){
  info.style.display='block';
  if(co&&co._contract_signed){
   info.style.background='rgba(61,224,154,.1)';info.style.color='var(--ac2)';
   info.innerHTML=`✅ Contrat signé avec <strong>${esc(co.name)}</strong> — le taux est lu automatiquement depuis la grille négociée.`;
  }else if(co&&co._contract_draft){
   info.style.background='rgba(224,152,58,.1)';info.style.color='var(--ac4)';
   info.innerHTML=`⚠ Contrat préparé pour <strong>${esc(co.name)}</strong> mais pas encore signé. Grille utilisée à titre indicatif.`;
  }else{
   info.style.background='var(--s3)';info.style.color='var(--mu)';
   info.innerHTML=`ℹ️ Aucun contrat enregistré${co?' pour '+esc(co.name):''}. Taux par défaut — ajustez si besoin.`;
  }
 }
 _invResetTaux();
}

function _invResetTaux(){
 const candId=document.getElementById('nif-cand')?.value;
 if(!candId)return;
 const c=cById(candId);if(!c)return;
 const need=c.linked_need?DB.needs.find(n=>n.id===c.linked_need):null;
 const co=need?coById(need.company_id):null;
 const isCadre=document.getElementById('nif-cadre')?.value==='1';
 const exp=Number(document.getElementById('nif-exp')?.value||0);
 const r=computeHonoraireRate(co,isCadre,exp);
 const tx=document.getElementById('nif-taux');
 if(tx)tx.value=r.rate;
 const src=document.getElementById('nif-taux-src');
 if(src)src.textContent='Taux '+r.rate+'% — '+r.source+(r.tranche?' · tranche '+r.tranche:'');
 _invRecalc();
}

function _invRecalc(manualTaux){
 const sal=Number(document.getElementById('nif-sal')?.value||0);
 const taux=Number(document.getElementById('nif-taux')?.value||0);
 const prev=document.getElementById('nif-preview');
 if(!prev)return;
 const src=document.getElementById('nif-taux-src');
 if(manualTaux&&src)src.textContent='Taux '+taux+'% — ajusté manuellement';
 if(sal>0&&taux>0){
  prev.style.display='block';
  const amt=Math.round(sal*taux/100);
  document.getElementById('nif-preview-detail').innerHTML=
   `Salaire brut annuel : <strong>${sal.toLocaleString('fr-FR')} €</strong><br>`
   +`Taux honoraires : <strong>${String(taux).replace('.',',')} %</strong><br>`
   +`Calcul : ${sal.toLocaleString('fr-FR')} € × ${String(taux).replace('.',',')} %`;
  document.getElementById('nif-preview-amt').textContent=fM(amt);
 }else{
  prev.style.display='none';
 }
}

function saveInvoiceForm(){
 const candId=document.getElementById('nif-cand')?.value;
 const sal=Number(document.getElementById('nif-sal')?.value||0);
 const taux=Number(document.getElementById('nif-taux')?.value||0);
 const exp=Number(document.getElementById('nif-exp')?.value||0);
 const isCadre=document.getElementById('nif-cadre')?.value==='1';
 const prisePoste=document.getElementById('nif-prise-poste')?.value||'';
 const notes=document.getElementById('nif-notes')?.value||'';
 if(!candId){toast('Choisissez un candidat','e');return;}
 if(!sal){toast('Salaire brut requis','e');return;}
 if(!taux){toast('Taux honoraires requis','e');return;}
 _createInvoice(candId,sal,taux,notes,{exp,isCadre,prisePoste});
 closeMo();
}

function _createInvoice(candId,salary,taux,notes,extra){
 DB.invoices=DB.invoices||[];
 extra=extra||{};
 const c=cById(candId);
 const need=c?.linked_need?DB.needs.find(n=>n.id===c.linked_need):null;
 const co=need?coById(need.company_id):null;
 const amount=Math.round(Number(salary)*taux/100);
 const today=todayKey();
 const due=new Date();due.setDate(due.getDate()+30);
 const inv={
  id:uid(),invoice_number:getInvoiceNumber(),
  cand_id:candId,company_id:co?.id||null,need_id:need?.id||null,
  salary:Number(salary),taux,amount,
  exp_years:extra.exp||0,is_cadre:!!extra.isCadre,prise_poste:extra.prisePoste||'',
  status:'draft',invoice_date:today,
  due_date:due.toISOString().split('T')[0],paid_date:null,
  notes,created:now_(),updated:now_()
 };
 DB.invoices.unshift(inv);save();
 if(UI.view==='facturation')rFacturation();
 badges();toast(`Facture ${inv.invoice_number} créée — ${fM(amount)}`,'s');
}

function markInvoiceSent(id){
 const inv=(DB.invoices||[]).find(i=>i.id===id);if(!inv)return;
 inv.status='sent';const d=new Date();d.setDate(d.getDate()+30);inv.due_date=d.toISOString().split('T')[0];inv.updated=now_();save();
 if(UI.view==='facturation')rFacturation();if(UI.pid===id)openInvoicePanel(id);badges();
 toast(`Facture envoyée — échéance ${fD(inv.due_date)}`,'s');
}

function markInvoicePaid(id){
 const inv=(DB.invoices||[]).find(i=>i.id===id);if(!inv)return;
 inv.status='paid';inv.paid_date=new Date().toISOString().split('T')[0];inv.updated=now_();save();
 if(UI.view==='facturation')rFacturation();if(UI.pid===id)openInvoicePanel(id);badges();
 toast(`${inv.invoice_number} payée — ${fM(inv.amount)} encaissé`,'s');
}

function editInvoiceNotes(id){
 const inv=(DB.invoices||[]).find(i=>i.id===id);if(!inv)return;
 openMo('Notes facture',`<textarea id="inv-ne" style="min-height:80px">${esc(inv.notes||'')}</textarea>`,
 `<button class="btn bg" onclick="closeMo()">Annuler</button>
 <button class="btn bp" onclick="(()=>{const i=(DB.invoices||[]).find(x=>x.id==='${id}');if(i){i.notes=document.getElementById('inv-ne')?.value||'';i.updated=now_();save();closeMo();openInvoicePanel('${id}');toast('Sauvegardé ✓','s');}})()">Sauvegarder</button>`
);
}

function deleteInvoice(id){
 if(!confirm('Supprimer cette facture ?'))return;
 DB.invoices=(DB.invoices||[]).filter(i=>i.id!==id);save();closePanel();if(UI.view==='facturation')rFacturation();badges();toast('Supprimé','w');
}

// ── Infos légales de l'émetteur (NOVALEM) — paramétrables ──
function getNovalemLegal(){
 return{
  nom:    localStorage.getItem('nv_legal_nom')    || 'NOVALEM',
  gerant: localStorage.getItem('nv_legal_gerant') || 'Louis RENAULT',
  adresse:localStorage.getItem('nv_legal_adresse')|| '',
  cp:     localStorage.getItem('nv_legal_cp')     || '',
  ville:  localStorage.getItem('nv_legal_ville')  || '',
  siret:  localStorage.getItem('nv_legal_siret')  || '',
  ape:    localStorage.getItem('nv_legal_ape')    || '7810Z',
  email:  localStorage.getItem('nv_legal_email')  || 'contact@novalem-recrutement.fr',
  tel:    localStorage.getItem('nv_legal_tel')    || '06 58 21 20 96',
  iban:   localStorage.getItem('nv_legal_iban')   || '',
 };
}

// ── Modale paramètres légaux facturation ──
function openInvoiceSettings(){
 const L=getNovalemLegal();
 openMo('Coordonnées de facturation NOVALEM',`
  <div style="font-size:11px;color:var(--mu);margin-bottom:14px;line-height:1.55">
   Ces informations figureront sur toutes vos factures. Elles sont <strong>obligatoires légalement</strong>. À remplir une seule fois.
  </div>
  <div class="fg">
   <div class="fgrp ff"><span class="lbl">Dénomination *</span><input id="nvl-nom" value="${esc(L.nom)}" placeholder="NOVALEM"></div>
   <div class="fgrp ff"><span class="lbl">Gérant / Exploitant *</span><input id="nvl-gerant" value="${esc(L.gerant)}" placeholder="Louis RENAULT"></div>
   <div class="fgrp ff"><span class="lbl">Adresse *</span><input id="nvl-adresse" value="${esc(L.adresse)}" placeholder="Numéro et rue"></div>
   <div style="display:grid;grid-template-columns:1fr 2fr;gap:10px">
    <div class="fgrp"><span class="lbl">Code postal *</span><input id="nvl-cp" value="${esc(L.cp)}" placeholder="97110"></div>
    <div class="fgrp"><span class="lbl">Ville *</span><input id="nvl-ville" value="${esc(L.ville)}" placeholder="Pointe-à-Pitre"></div>
   </div>
   <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
    <div class="fgrp"><span class="lbl">SIRET *</span><input id="nvl-siret" value="${esc(L.siret)}" placeholder="14 chiffres"></div>
    <div class="fgrp"><span class="lbl">Code APE</span><input id="nvl-ape" value="${esc(L.ape)}" placeholder="7810Z"></div>
   </div>
   <div class="fgrp ff"><span class="lbl">IBAN (pour le règlement)</span><input id="nvl-iban" value="${esc(L.iban)}" placeholder="FR76 ..."></div>
  </div>`,
  `<button class="btn bg" onclick="closeMo()">Annuler</button>
   <button class="btn bp" onclick="saveInvoiceSettings()">Enregistrer</button>`
 );
}
function saveInvoiceSettings(){
 const g=id=>document.getElementById(id)?.value?.trim()||'';
 localStorage.setItem('nv_legal_nom',g('nvl-nom'));
 localStorage.setItem('nv_legal_gerant',g('nvl-gerant'));
 localStorage.setItem('nv_legal_adresse',g('nvl-adresse'));
 localStorage.setItem('nv_legal_cp',g('nvl-cp'));
 localStorage.setItem('nv_legal_ville',g('nvl-ville'));
 localStorage.setItem('nv_legal_siret',g('nvl-siret'));
 localStorage.setItem('nv_legal_ape',g('nvl-ape'));
 localStorage.setItem('nv_legal_iban',g('nvl-iban'));
 closeMo();
 toast('Coordonnées enregistrées ✓','s');
}

// ════════════════════════════════════════════════════════════════
// GÉNÉRATEUR PDF — Facture d'honoraires conforme à la réglementation
// française (Code de commerce L441 + CGI). Micro-entreprise, franchise TVA.
// ════════════════════════════════════════════════════════════════
function generateInvoicePDF(invId){
 const inv=(DB.invoices||[]).find(i=>i.id===invId);
 if(!inv){toast('Facture introuvable','e');return;}
 const jsPDFLib=window.jspdf;
 if(!jsPDFLib){toast('jsPDF non chargé, réessayez','w');return;}

 const L=getNovalemLegal();
 // Vérif des mentions légales minimales
 if(!L.siret||!L.adresse||!L.ville){
  toast('Complétez d\u0027abord vos coordonnées de facturation','w');
  setTimeout(openInvoiceSettings,300);
  return;
 }

 const co=coById(inv.company_id);
 const cand=cById(inv.cand_id);
 const need=inv.need_id?DB.needs.find(n=>n.id===inv.need_id):null;
 const doc=new jsPDFLib.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 const W=210,ML=18,MR=18;
 const gold=[201,137,26],ink=[26,22,20],grey=[90,90,90],soft=[245,243,239];
 const eur=n=>Number(n||0).toLocaleString('fr-FR')+' EUR';

 // ── En-tête ──
 doc.setFillColor(ink[0],ink[1],ink[2]);
 doc.rect(0,0,W,30,'F');
 doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(19);
 doc.text('NOVALEM',ML,16);
 doc.setTextColor(gold[0],gold[1],gold[2]);doc.setFontSize(7.5);
 doc.text('CABINET DE RECRUTEMENT BTP',ML,22);
 doc.setTextColor(255,255,255);doc.setFontSize(15);doc.setFont('helvetica','bold');
 doc.text('FACTURE',W-MR,15,{align:'right'});
 doc.setFontSize(8);doc.setTextColor(200,200,200);doc.setFont('helvetica','normal');
 doc.text(inv.invoice_number||'—',W-MR,21,{align:'right'});

 let y=42;

 // ── Émetteur / Client ──
 const boxW=(W-ML-MR-8)/2;
 doc.setFillColor(soft[0],soft[1],soft[2]);
 doc.roundedRect(ML,y,boxW,40,2,2,'F');
 doc.roundedRect(ML+boxW+8,y,boxW,40,2,2,'F');

 doc.setFontSize(7);doc.setTextColor(grey[0],grey[1],grey[2]);doc.setFont('helvetica','bold');
 doc.text('ÉMETTEUR',ML+5,y+7);
 doc.text('CLIENT',ML+boxW+13,y+7);
 doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(ink[0],ink[1],ink[2]);

 let ey=y+13;
 doc.setFont('helvetica','bold');doc.text(L.nom,ML+5,ey);doc.setFont('helvetica','normal');
 ey+=4.5;doc.setFontSize(7.5);doc.setTextColor(grey[0],grey[1],grey[2]);
 doc.text(L.gerant,ML+5,ey);ey+=4;
 doc.text(L.adresse,ML+5,ey);ey+=4;
 doc.text(L.cp+' '+L.ville,ML+5,ey);ey+=4;
 doc.text('SIRET '+L.siret,ML+5,ey);ey+=4;
 doc.text('APE '+L.ape+'  ·  '+L.tel,ML+5,ey);

 let cy=y+13;
 doc.setFontSize(8.5);doc.setTextColor(ink[0],ink[1],ink[2]);doc.setFont('helvetica','bold');
 doc.text(co?co.name:'Client',ML+boxW+13,cy);doc.setFont('helvetica','normal');
 cy+=4.5;doc.setFontSize(7.5);doc.setTextColor(grey[0],grey[1],grey[2]);
 if(co&&co.address){doc.text(String(co.address).slice(0,42),ML+boxW+13,cy);cy+=4;}
 if(co&&co.city){doc.text(co.city,ML+boxW+13,cy);cy+=4;}
 if(co&&co.siret){
  const sirenCli=String(co.siret).replace(/\s/g,'').slice(0,9);
  doc.text('SIREN '+sirenCli,ML+boxW+13,cy);cy+=4;
  doc.text('SIRET '+co.siret,ML+boxW+13,cy);cy+=4;
 }
 if(co&&co.contact){doc.text(co.contact,ML+boxW+13,cy);cy+=4;}

 y+=48;

 // ── Métadonnées facture ──
 doc.setFontSize(8);doc.setTextColor(grey[0],grey[1],grey[2]);
 const exDate=inv.prise_poste||inv.invoice_date;
 doc.text('Date de facture : '+fD(inv.invoice_date),ML,y);
 doc.text('Date d\u0027exécution : '+fD(exDate),ML+70,y);
 doc.text('Échéance : '+fD(inv.due_date),ML+140,y);
 y+=5;
 doc.setFontSize(7);doc.setTextColor(grey[0],grey[1],grey[2]);
 doc.text('Nature de l\u0027opération : prestation de services',ML,y);
 y+=8;

 // ── Tableau prestation ──
 doc.setFillColor(ink[0],ink[1],ink[2]);
 doc.rect(ML,y,W-ML-MR,9,'F');
 doc.setTextColor(255,255,255);doc.setFontSize(8);doc.setFont('helvetica','bold');
 doc.text('DÉSIGNATION',ML+4,y+5.8);
 doc.text('BASE',ML+108,y+5.8,{align:'right'});
 doc.text('TAUX',ML+138,y+5.8,{align:'right'});
 doc.text('MONTANT HT',W-MR-4,y+5.8,{align:'right'});
 y+=9;

 const poste=need?need.title:(cand&&cand.role)||'poste non précisé';
 doc.setFillColor(soft[0],soft[1],soft[2]);
 doc.rect(ML,y,W-ML-MR,20,'F');
 doc.setTextColor(ink[0],ink[1],ink[2]);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
 doc.text('Honoraires de recrutement',ML+4,y+7);
 doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(grey[0],grey[1],grey[2]);
 doc.text('Placement de '+(cand?cand.name:'—')+' — '+poste,ML+4,y+12.5);
 doc.text((inv.is_cadre?'Cadre':'Non-cadre')+' · '+(inv.exp_years||0)+' ans d\u0027expérience',ML+4,y+17);
 doc.setTextColor(ink[0],ink[1],ink[2]);doc.setFontSize(8.5);
 doc.text(eur(inv.salary),ML+108,y+11,{align:'right'});
 doc.text(String(inv.taux).replace('.',',')+' %',ML+138,y+11,{align:'right'});
 doc.setFont('helvetica','bold');
 doc.text(eur(inv.amount),W-MR-4,y+11,{align:'right'});
 y+=28;

 // ── Totaux ──
 const tbX=W-MR-72;
 doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.setTextColor(grey[0],grey[1],grey[2]);
 doc.text('Total HT',tbX,y);
 doc.setTextColor(ink[0],ink[1],ink[2]);doc.text(eur(inv.amount),W-MR-4,y,{align:'right'});
 y+=6;
 doc.setTextColor(grey[0],grey[1],grey[2]);doc.setFontSize(7.5);
 doc.text('TVA non applicable, art. 293 B du CGI',tbX,y);
 y+=8;
 doc.setFillColor(gold[0],gold[1],gold[2]);
 doc.roundedRect(tbX-4,y-5,W-MR-(tbX-4),11,1.5,1.5,'F');
 doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(9.5);
 doc.text('NET À PAYER',tbX,y+1.5);
 doc.text(eur(inv.amount),W-MR-4,y+1.5,{align:'right'});
 y+=16;

 // ── Conditions de règlement (mentions légales obligatoires) ──
 doc.setDrawColor(220,214,205);doc.setLineWidth(0.3);
 doc.line(ML,y,W-MR,y);y+=7;
 doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(ink[0],ink[1],ink[2]);
 doc.text('CONDITIONS DE RÈGLEMENT',ML,y);y+=5;
 doc.setFont('helvetica','normal');doc.setTextColor(grey[0],grey[1],grey[2]);doc.setFontSize(7);
 const cond=[
  'Paiement à 30 jours à compter de la date de facture'+(L.iban?', par virement.':'.'),
  L.iban?('IBAN : '+L.iban):'',
  'Pénalités de retard : taux directeur BCE majoré de 10 points. Indemnité forfaitaire pour frais de',
  'recouvrement : 40 EUR (art. L441-10 et D441-5 du Code de commerce). Pas d\u0027escompte pour paiement anticipé.',
 ].filter(Boolean);
 cond.forEach(line=>{doc.text(line,ML,y);y+=4;});
 y+=3;

 if(inv.notes){
  doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.setTextColor(ink[0],ink[1],ink[2]);
  doc.text('NOTES',ML,y);y+=4.5;
  doc.setFont('helvetica','normal');doc.setTextColor(grey[0],grey[1],grey[2]);doc.setFontSize(7);
  doc.splitTextToSize(inv.notes,W-ML-MR).forEach(l=>{doc.text(l,ML,y);y+=4;});
 }

 // ── Pied de page ──
 doc.setFontSize(6.5);doc.setTextColor(150,150,150);doc.setFont('helvetica','normal');
 doc.text(L.nom+' — '+L.gerant+' · SIRET '+L.siret+' · APE '+L.ape,W/2,280,{align:'center'});
 doc.text('Dispensé d\u0027immatriculation au RCS et au RM · Micro-entreprise · TVA non applicable art. 293 B du CGI',W/2,284,{align:'center'});
 doc.text(L.email+' · '+L.tel,W/2,288,{align:'center'});

 doc.save((inv.invoice_number||'facture')+'.pdf');
 toast('Facture PDF générée ✓','s');
}

// Ouvre un email pré-rempli pour transmettre la facture au client
function emailInvoiceToClient(invId){
 const inv=(DB.invoices||[]).find(i=>i.id===invId);
 if(!inv)return;
 const co=coById(inv.company_id);
 const cand=cById(inv.cand_id);
 if(!co||!co.email){toast('Email du client manquant','e');return;}
 const prenom=greetCo(co);
 const subj='Facture '+(inv.invoice_number||'')+' — NOVALEM';
 const body=`Bonjour ${prenom||''},\n\n`
  +`Veuillez trouver ci-joint la facture ${inv.invoice_number} relative au placement de ${cand?cand.name:'votre candidat'}.\n\n`
  +`Montant : ${Number(inv.amount).toLocaleString('fr-FR')} EUR (TVA non applicable).\n`
  +`Échéance de règlement : ${fD(inv.due_date)}.\n\n`
  +`Nous vous remercions de votre confiance et restons à votre disposition.\n\n`
  +`Bien à vous,\nLouis RENAULT — NOVALEM\ncontact@novalem-recrutement.fr — 06 58 21 20 96`;
 // D'abord générer le PDF (le client le joindra), puis ouvrir le mail
 generateInvoicePDF(invId);
 setTimeout(()=>{
  const mailto='mailto:'+encodeURIComponent(co.email)
   +'?subject='+encodeURIComponent(subj)
   +'&body='+encodeURIComponent(body);
  window.open(mailto,'_blank');
  toast('PDF téléchargé — joignez-le à l\u0027email','i');
 },600);
}

// ═══════════════════════════════════════════════════════
// EMAIL → TIMELINE — Lien automatique inbox ↔ fiches
// ═══════════════════════════════════════════════════════

function getEmailRule(fromEmail){
 if(!fromEmail)return null;
 return(DB.email_rules||[]).find(r=>r.fromEmail.toLowerCase()===fromEmail.toLowerCase());
}

function addEmailRule(fromEmail,entityType,entityId,autoLog){
 DB.email_rules=DB.email_rules||[];
 const ex=getEmailRule(fromEmail);
 if(ex){ex.entityType=entityType;ex.entityId=entityId;ex.autoLog=!!autoLog;}
 else DB.email_rules.push({id:uid(),fromEmail,entityType,entityId,autoLog:!!autoLog});
 save();
 toast(autoLog?`Emails de ${fromEmail} auto-liés désormais`:'Lié à la fiche ✓','s');
}

function applyEmailRules(){
 if(!INBOX_CACHE?.emails)return;
 const rules=(DB.email_rules||[]).filter(r=>r.autoLog);
 if(!rules.length)return;
 INBOX_CACHE.emails.forEach(email=>{
 if(!email.fromEmail||email._ruleApplied)return;
 const rule=rules.find(r=>r.fromEmail.toLowerCase()===email.fromEmail.toLowerCase());
 if(!rule)return;
 if(rule.entityType==='co'){
 const already=(coById(rule.entityId)?.timeline||[]).find(t=>t.extra===String(email.uid));
 if(!already){addTimeline(rule.entityId,'email',`De : ${email.from||email.fromEmail}\nObjet : ${email.subject||'(sans objet)'}\n${(email.snippet||'').slice(0,120)}`,String(email.uid));}
 }
 email._ruleApplied=true;
 });
}

function linkEmailToFiche(uid,entityType,entityId,autoLog){
 if(!INBOX_CACHE)return;
 const email=INBOX_CACHE.emails.find(e=>String(e.uid)===String(uid));if(!email)return;
 addEmailRule(email.fromEmail,entityType,entityId,autoLog);
 if(entityType==='co'){
 const already=(coById(entityId)?.timeline||[]).find(t=>t.extra===String(uid));
 if(!already){addTimeline(entityId,'email',`De : ${email.from||email.fromEmail}\nObjet : ${email.subject||'(sans objet)'}\n${(email.snippet||'').slice(0,150)}`,String(uid));}
 toast('Email ajouté à la timeline ✓','s');
 }
 emOpenEmail(uid);
}


// GLOBAL SEARCH — Ctrl+K
// ═══════════════════════════════════════════════════════
function openGS(){
 document.getElementById('gs-overlay').classList.add('open');
 setTimeout(()=>document.getElementById('gs-q')?.focus(),50);
 renderGS('');
}
function closeGS(){document.getElementById('gs-overlay').classList.remove('open');}
function renderGS(q){
 const el=document.getElementById('gs-results');
 if(!el)return;
 if(!q.trim()){el.innerHTML=`<div class="gs-empty">Tapez pour chercher un candidat, prospect, besoin…<br><span style="font-size:10px;color:var(--mu2);margin-top:6px;display:block">Candidats · Prospects · Clients · Besoins · Annonces</span></div>`;return;}
 const qL=q.toLowerCase();
 const cands=DB.candidates.filter(c=>!['ko'].includes(c.status)&&(c.name+' '+(c.role||'')+' '+(c.phone||'')).toLowerCase().includes(qL)).slice(0,5);
 const pros=DB.companies.filter(c=>(c.name+' '+(c.contact||'')+' '+(c.city||'')).toLowerCase().includes(qL)).slice(0,4);
 const needs=DB.needs.filter(n=>(n.title+' '+(coById(n.company_id)?.name||'')).toLowerCase().includes(qL)).slice(0,3);
 const posts=DB.posts.filter(p=>p.title.toLowerCase().includes(qL)).slice(0,2);
 let html='';
 if(cands.length){
 html+=`<div class="gs-section">Candidats</div>`;
 html+=cands.map(c=>{const st=getCS(c.status);const cat=getCat(c.cat);return`<div class="gs-item" onclick="closeGS();go('cands');setTimeout(()=>{switchCandTab('trier');openCandPanel('${c.id}')},80)"><span class="gs-item-ico"></span><div class="gs-item-main"><div class="gs-item-name">${esc(c.name)}</div><div class="gs-item-sub"><span class="pill ${st.p}" style="font-size:8px">${st.l}</span> · ${esc(c.role||cat.l)} · ${fPhone(c.phone)}</div></div></div>`;}).join('');
 }
 if(pros.length){
 html+=`<div class="gs-section">${pros.some(c=>c.type==='client')?'Entreprises':'Prospects / Clients'}</div>`;
 html+=pros.map(c=>{const st=getCmpS(c.status);return`<div class="gs-item" onclick="closeGS();go(c.type==='client'?'clients':'pros');setTimeout(()=>openCoPanel('${c.id}'),80)"><span class="gs-item-ico">${c.type==='client'?'':''}</span><div class="gs-item-main"><div class="gs-item-name">${esc(c.name)}</div><div class="gs-item-sub">${esc(c.city||'')}${c.contact?' · '+esc(c.contact):''} · <span class="pill ${st.p}" style="font-size:8px">${st.l}</span></div></div></div>`;}).join('');
 }
 if(needs.length){
 html+=`<div class="gs-section">Besoins</div>`;
 html+=needs.map(n=>{const co=coById(n.company_id);return`<div class="gs-item" onclick="closeGS();go('needs');setTimeout(()=>openNeedPanel('${n.id}'),80)"><span class="gs-item-ico"></span><div class="gs-item-main"><div class="gs-item-name">${esc(n.title)}</div><div class="gs-item-sub">${co?esc(co.name):''} · ${getCat(n.cat).l}</div></div></div>`;}).join('');
 }
 if(posts.length){
 html+=`<div class="gs-section">Annonces</div>`;
 html+=posts.map(p=>`<div class="gs-item" onclick="closeGS();go('posts');setTimeout(()=>openPostPanel('${p.id}'),80)"><span class="gs-item-ico"></span><div class="gs-item-main"><div class="gs-item-name">${esc(p.title)}</div><div class="gs-item-sub">${p.status==='active'?'Active':'Clôturée'} · ${esc(p.location||'')}</div></div></div>`).join('');
 }
 if(!html)html=`<div class="gs-empty">Aucun résultat pour "<strong>${esc(q)}</strong>"</div>`;
 el.innerHTML=html;
}
// Fix: attendre que le DOM soit prêt (gs-q et gs-overlay sont définis plus bas dans le body)
document.addEventListener('DOMContentLoaded',()=>{
 const q=document.getElementById('gs-q');
 const ov=document.getElementById('gs-overlay');
 if(q) q.addEventListener('input',e=>renderGS(e.target.value));
 if(ov) ov.addEventListener('click',e=>{if(e.target===ov)closeGS();});
});

// ═══════════════════════════════════════════════════════
// MATCHING ENGINE — score candidat ↔ besoin
// ═══════════════════════════════════════════════════════
function computeMatchScore(cand, need){
 if(!cand||!need)return 0;
 let score=0;
 // Même catégorie BTP (+50)
 if(cand.cat===need.cat) score+=50;
 else if(Math.abs(BTP_CATS.findIndex(c=>c.id===cand.cat)-BTP_CATS.findIndex(c=>c.id===need.cat))<=1) score+=20;
 // Salaire compatible (+25)
 const sal=Number(cand.salary||0);
 const smin=Number(need.smin||0);
 const smax=Number(need.smax||99999);
 if(sal>0){
 if(sal>=smin&&sal<=smax) score+=25;
 else if(sal>=smin*0.9&&sal<=smax*1.1) score+=12;
 } else score+=10; // pas de prétention → neutre
 // Disponibilité (+15)
 if(cand.avail){
 const av=(cand.avail||'').toLowerCase();
 if(av.includes('imméd')||av.includes('dispo')) score+=15;
 else if(av.includes('1 mois')||av.includes('semaine')) score+=10;
 else score+=5;
 } else score+=8;
 // Localisation (+10)
 if(need.location&&cand.mobility){
 const mob=(cand.mobility||'').toLowerCase();
 const loc=(need.location||'').toLowerCase();
 if(mob.includes('national')||mob.includes('france')) score+=10;
 else if(loc.split(/[\s,]+/).some(w=>w.length>3&&mob.includes(w))) score+=10;
 else score+=3;
 } else score+=5;
 return Math.min(100, score);
}

function getTopMatches(candId, n=3){
 const c=cById(candId);if(!c)return[];
 const openNeeds=DB.needs.filter(nd=>nd.status==='open');
 return openNeeds
 .map(nd=>({need:nd,score:computeMatchScore(c,nd),co:coById(nd.company_id)}))
 .filter(x=>x.score>=40)
 .sort((a,b)=>b.score-a.score)
 .slice(0,n);
}

function getTopCandidatesForNeed(needId, n=3){
 const nd=nById(needId);if(!nd)return[];
 const activeCands=DB.candidates.filter(c=>['dossier','interview','presented'].includes(c.status));
 return activeCands
 .map(c=>({cand:c,score:computeMatchScore(c,nd)}))
 .filter(x=>x.score>=40)
 .sort((a,b)=>b.score-a.score)
 .slice(0,n);
}

// ═══════════════════════════════════════════════════════
// PRÉCAL SCRIPT — modal live pendant l'appel
// ═══════════════════════════════════════════════════════
const PRECAL_QUESTIONS=[
 {id:'exp', label:"Expérience", hint:"Combien d'années dans le BTP ? Quel type de chantiers ? Taille des équipes ?", field:'pre-exp'},
 {id:'poste', label:"Poste recherché", hint:"Quel poste exactement ? CDI uniquement ou aussi intérim ?", field:'pre-poste'},
 {id:'sal', label:"Prétentions", hint:"Quel salaire brut annuel ? Package ? Avantages souhaités ?", field:'pre-sal2'},
 {id:'dispo', label:"Disponibilité", hint:"Quand disponible ? Préavis ? Encore en poste ?", field:'pre-dispo'},
 {id:'mob', label:"Mobilité", hint:"Zone géographique ? Déplacements ? Permis B ?", field:'pre-mob2'},
 {id:'motiv', label:"Motivations", hint:"Pourquoi changer ? Qu'est-ce qui est important pour vous dans le prochain poste ?", field:'pre-motiv'},
];
let _precalTimer=null;
let _precalSecs=0;

function openPrecalScript(id){
 const c=cById(id);if(!c)return;
 _precalSecs=0;
 const saved=JSON.parse(localStorage.getItem('precal_draft_'+id)||'{}');

 const questionsHTML=PRECAL_QUESTIONS.map((q,i)=>`
 <div class="precal-q ${saved[q.field]?'done':''}" id="pq-${q.id}">
 <div class="precal-q-num">${i+1}</div>
 <div class="precal-q-body">
 <div class="precal-q-label">${q.label}</div>
 <div class="precal-q-hint">${q.hint}</div>
 <input class="precal-q-input" id="${q.field}" placeholder="Votre note…" value="${esc(saved[q.field]||'')}"
 oninput="savePrecalDraft('${id}')" onfocus="this.closest('.precal-q').classList.remove('done')" onblur="if(this.value)this.closest('.precal-q').classList.add('done')">
 </div>
 </div>`).join('');

 openMo(`Script précal — ${c.name}`,`
 <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:10px 14px;background:rgba(61,224,154,.05);border:1px solid rgba(61,224,154,.2);border-radius:3px">
 <div>
 <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:2px">Numéro</div>
 <div style="font-family:'DM Mono',monospace;font-size:18px;color:var(--ac2);font-weight:500;letter-spacing:.04em;display:flex;align-items:center;gap:8px">
 ${c.phone?`${fPhone(c.phone)} <button class="btn bg bxs" onclick="cpPhone('${esc(c.phone)}')">⧉</button>`:`<span style="color:var(--mu)">Non renseigné</span>`}
 </div>
 </div>
 <div style="margin-left:auto;text-align:right">
 <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:2px">Durée</div>
 <div class="precal-timer" id="precal-timer-disp">0:00</div>
 </div>
 </div>
 <div style="margin-bottom:10px">${questionsHTML}</div>
 <div class="fgrp">
 <span class="lbl">Impression générale / Notes libres</span>
 <textarea id="pre-notes-script" style="min-height:60px" placeholder="Résumé de l'appel, points importants…" oninput="savePrecalDraft('${id}')">${esc(saved['pre-notes-script']||c.notes_pre||'')}</textarea>
 </div>
 <div class="fgrp">
 <span class="lbl">Profil</span>
 <select id="pre-profile-script">
 <option value="normal" ${!c.pepite?'selected':''}>Profil standard</option>
 <option value="pepite" ${c.pepite?'selected':''}>Pepite — profil rare à prioriser</option>
 <option value="ko">Non retenu — KO — KO</option>
 </select>
 </div>`,
 `<button class="btn bg" onclick="stopPrecalTimer();closeMo()">Annuler</button>
 <button class="btn bp" onclick="savePrecalScriptAndPlan('${id}')">Valider → Planifier RDV ▸</button>`
);
 startPrecalTimer();
}

function startPrecalTimer(){
 stopPrecalTimer();
 _precalSecs=0;
 _precalTimer=setInterval(()=>{
 _precalSecs++;
 const m=Math.floor(_precalSecs/60);
 const s=String(_precalSecs%60).padStart(2,'0');
 const el=document.getElementById('precal-timer-disp');
 if(el)el.textContent=`${m}:${s}`;
 else stopPrecalTimer();
 },1000);
}
function stopPrecalTimer(){if(_precalTimer){clearInterval(_precalTimer);_precalTimer=null;}}

function savePrecalDraft(id){
 const draft={};
 PRECAL_QUESTIONS.forEach(q=>{const el=document.getElementById(q.field);if(el)draft[q.field]=el.value;});
 const notesEl=document.getElementById('pre-notes-script');
 if(notesEl)draft['pre-notes-script']=notesEl.value;
 localStorage.setItem('precal_draft_'+id,JSON.stringify(draft));
}

function savePrecalScriptAndPlan(id){
 stopPrecalTimer();
 const c=cById(id);if(!c)return;
 // Construire résumé depuis les réponses
 const notes=PRECAL_QUESTIONS.map(q=>{
 const el=document.getElementById(q.field);
 return el&&el.value?`${q.label} : ${el.value}`:null;
 }).filter(Boolean);
 const notesLibres=document.getElementById('pre-notes-script')?.value||'';
 const notesComplet=[...notes,notesLibres?`\nNotes : ${notesLibres}`:null].filter(Boolean).join('\n');
 const profil=document.getElementById('pre-profile-script')?.value||'normal';

 // Extraire les infos dans les champs candidat
 const sal=document.getElementById('pre-sal2')?.value||'';
 const dispo=document.getElementById('pre-dispo')?.value||'';
 const mob=document.getElementById('pre-mob2')?.value||'';
 const poste=document.getElementById('pre-poste')?.value||'';

 if(profil==='ko'){
 c.status='ko';c.notes_pre=notesComplet;c.updated=now_();
 localStorage.removeItem('precal_draft_'+id);
 save();closeMo();rCands();badges();
 toast(`${c.name} → KO`,'w');return;
 }
 c.status='precal';
 c.notes_pre=notesComplet;
 if(sal)c.salary=sal.replace(/[^\d]/g,'');
 if(dispo)c.avail=dispo;
 if(mob)c.mobility=mob;
 if(poste)c.role=poste;
 c.pepite=profil==='pepite';
 c.updated=now_();
 save();
 localStorage.removeItem('precal_draft_'+id);
 toast(`Précal sauvegardée ✓ — planifiez le RDV`,'s');
 closeMo();
 // Matcher automatiquement avec un besoin si possible
 const matches=getTopMatches(id,1);
 if(matches.length&&matches[0].score>=60){
 c.linked_need=matches[0].need.id;
 save();
 toast(`Match auto : ${matches[0].co?.name||'?'} (${matches[0].score}%)`, 'i');
 }
 openCalendarMo(id);
}

// ═══════════════════════════════════════════════════════
// NOTIFICATIONS BROWSER
// ═══════════════════════════════════════════════════════
function initNotifications(){
 if(!('Notification' in window))return;
 if(Notification.permission==='granted') checkEntretienNotifs();
 else if(Notification.permission!=='denied'){
 // Demander la permission silencieusement au premier entretien planifié
 const hasTodayInterview=DB.agenda.some(a=>!a.done&&isToday(a.date)&&a.type==='visio');
 if(hasTodayInterview) Notification.requestPermission().then(p=>{if(p==='granted')checkEntretienNotifs();});
 }
}
function checkEntretienNotifs(){
 const now=new Date();
 DB.agenda.filter(a=>!a.done&&isToday(a.date)&&a.type==='visio'&&a.time).forEach(a=>{
 const [h,m]=(a.time||'00:00').split(':').map(Number);
 const agTime=new Date();agTime.setHours(h,m,0,0);
 const diff=(agTime-now)/60000; // minutes
 const notifKey='notif_sent_'+a.id+new Date().toDateString();
 if(diff>0&&diff<=30&&!sessionStorage.getItem(notifKey)){
 sessionStorage.setItem(notifKey,'1');
 const cand=a.cand_id?cById(a.cand_id):null;
 new Notification(` Entretien dans ${Math.round(diff)} min`,{
 body:`${a.title}${cand?' — '+cand.name:''}`,
 icon:'/favicon.ico',
 tag:'entretien-'+a.id,
 });
 }
 });
}

// ═══════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════
document.addEventListener('keydown',e=>{
 const tag=(document.activeElement?.tagName||'').toLowerCase();
 const inInput=['input','textarea','select'].includes(tag);
 if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openGS();return;}
 if(e.key==='Escape'){
 if(document.getElementById('gs-overlay').classList.contains('open')){closeGS();return;}
 if(document.getElementById('mo').classList.contains('open')){closeMo();return;}
 if(document.getElementById('panel').classList.contains('open')){closePanel();return;}
 if(document.getElementById('ent-split-ov')){closeEntrantSplit({target:document.getElementById('ent-split-ov')});return;}
 }
 if(!inInput){
 if(e.key==='1') go('dash');
 if(e.key==='2') go('cands');
 if(e.key==='3') go('pros');
 if(e.key==='4') go('needs');
 if(e.key==='5') go('agenda');
 if(e.key==='6') go('emails');
 }
});

// Lancer notifs
setTimeout(()=>initNotifications(), 2000);
setInterval(()=>checkEntretienNotifs(), 5*60*1000);

// ── User menu ─────────────────────────────────────────
function initUserBadge(){
  const u=window.CURRENT_USER||{};
  const avatar=document.getElementById('user-avatar');
  const badgeName=document.getElementById('user-badge-name');
  const umName=document.getElementById('um-name');
  const umRole=document.getElementById('um-role');
  if(avatar){avatar.textContent=u.initials||'?';avatar.style.background=u.color||'var(--ac)';}
  if(badgeName)badgeName.textContent=(u.name||'').split(' ')[0]||'?';
  if(umName)umName.textContent=u.name||'—';
  if(umRole)umRole.style.display='none';
  // Hide admin link for non-admins (but keep it accessible since data is shared)
  const adminLink=document.getElementById('um-admin-link');
  // Both can see reporting
  // Horloges FR/Gwada : réservées à Louis uniquement
  const clocks=document.getElementById('dual-clocks');
  if(clocks)clocks.style.display=/louis/i.test(u.name||'')?'flex':'none';
}

function toggleUserMenu(){
  const m=document.getElementById('user-menu');
  if(!m)return;
  m.style.display=m.style.display==='none'?'block':'none';
}
function closeUserMenu(){
  const m=document.getElementById('user-menu');
  if(m)m.style.display='none';
}
document.addEventListener('click',e=>{
  const badge=document.getElementById('user-badge');
  const menu=document.getElementById('user-menu');
  if(menu&&badge&&!badge.contains(e.target)&&!menu.contains(e.target)){
    menu.style.display='none';
  }
});

function logout(){
  sessionStorage.removeItem('novalem_user');
  sessionStorage.removeItem('btprecruit_auth');
  window.location.href='/';
}



/* ===== INITIALISATION (anciennement crm-init.js) ===== */
// ═══════════════════════════════════════════════════
// CONTRAT — Onglet suivi sur la fiche client
// ═══════════════════════════════════════════════════
function renderContractTab(co) {
 const ct = co._contract_draft;
 if (!ct) {
  return `<div style="text-align:center;padding:30px 20px;color:var(--mu2)">
   <div style="font-size:32px;margin-bottom:10px">📄</div>
   <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;margin-bottom:6px;color:var(--tx)">Aucun contrat envoyé</div>
   <div style="font-size:11px;margin-bottom:16px">Cliquez sur "📄 Contrat" pour générer et envoyer le contrat.</div>
   <button class="btn bp bsm" onclick="openContractModal('${co.id}')">📄 Générer un contrat</button>
  </div>`;
 }
 const signed = co._contract_signed;
 const sentAt = ct.sent_at ? fD(ct.sent_at) : '—';
 const signedAt = signed ? fD(signed.signed_at) : null;
 const statusColor = signed ? 'var(--green)' : 'var(--ac4)';
 const statusLabel = signed ? '✅ Contrat signé' : '⏳ En attente de signature';
 const statusBg    = signed ? 'rgba(45,212,160,.08)' : 'rgba(232,152,48,.08)';
 const statusBd    = signed ? 'rgba(45,212,160,.25)' : 'rgba(232,152,48,.25)';

 return `
  <!-- Statut -->
  <div style="padding:12px 14px;background:${statusBg};border:1px solid ${statusBd};border-radius:var(--r2);margin-bottom:14px;display:flex;align-items:center;gap:10px">
   <div style="flex:1">
    <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:${statusColor}">${statusLabel}</div>
    ${signed
     ? `<div style="font-size:11px;color:var(--mu);margin-top:2px">Signé par <strong>${esc(signed.signer_name)}</strong> le ${signedAt} · Réf. ${esc(signed.ref||'—')}</div>`
     : `<div style="font-size:11px;color:var(--mu);margin-top:2px">Envoyé le ${sentAt} — en attente de signature client</div>`}
   </div>
   ${!signed ? `<button class="btn bg bxs" onclick="checkContractSignature('${co.id}')">↻ Vérifier</button>` : ''}
  </div>

  <!-- Conditions négociées -->
  <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--mu2);margin-bottom:8px">Conditions négociées</div>
  <div style="background:var(--s3);border:1px solid var(--bd);border-radius:var(--r2);overflow:hidden;margin-bottom:12px">
   <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;background:var(--s2);padding:6px 10px;font-size:9px;color:var(--mu2)">
    <span>Profil</span><span style="text-align:center">&lt; 5 ans</span><span style="text-align:center">5–15 ans</span><span style="text-align:center">&gt; 15 ans</span>
   </div>
   <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;padding:7px 10px;border-top:1px solid var(--bd);font-size:11px">
    <span style="font-weight:600">Non-cadre</span>
    <span style="text-align:center;color:var(--ac);font-weight:700">${ct.nc1}%</span>
    <span style="text-align:center;color:var(--ac);font-weight:700">${ct.nc2}%</span>
    <span style="text-align:center;color:var(--ac);font-weight:700">${ct.nc3}%</span>
   </div>
   <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;padding:7px 10px;border-top:1px solid var(--bd);font-size:11px">
    <span style="font-weight:600">Cadre</span>
    <span style="text-align:center;color:var(--ac);font-weight:700">${ct.c1}%</span>
    <span style="text-align:center;color:var(--ac);font-weight:700">${ct.c2}%</span>
    <span style="text-align:center;color:var(--ac);font-weight:700">${ct.c3}%</span>
   </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:14px;font-size:11px">
   ${ct.geste     ? `<div style="display:flex;align-items:center;gap:7px"><span style="color:var(--ac4)">✓</span> Geste 1er recrutement : <strong>${ct.geste_val}%</strong></div>` : ''}
   ${ct.opt3070   ? `<div style="display:flex;align-items:center;gap:7px"><span style="color:var(--ac4)">✓</span> Règlement <strong>30 / 70 %</strong></div>` : ''}
   ${ct.garantie  ? `<div style="display:flex;align-items:center;gap:7px"><span style="color:var(--ac4)">✓</span> Garantie de remplacement <strong>3 mois</strong></div>` : ''}
   ${ct.frais > 0 ? `<div style="display:flex;align-items:center;gap:7px"><span style="color:var(--mu2)">·</span> <span style="color:var(--mu)">Frais de dossier : ${ct.frais}€ HT</span></div>` : ''}
  </div>

  <!-- Actions -->
  <div style="display:flex;gap:6px;flex-wrap:wrap">
   ${!signed ? `<button class="btn bp bsm" onclick="relanceContract('${co.id}')">📧 Relancer la signature</button>` : ''}
   <button class="btn bg bsm" onclick="openContractModal('${co.id}')">✎ Modifier / Renvoyer</button>
   <button class="btn bg bsm" onclick="previewContract('${co.id}')">👁 Aperçu PDF</button>
  </div>`;
}

// ── Helpers notif contrat signé ───────────────────

// Trouve les candidats liés à un client (via besoins → linked_need)
// Priorise ceux en cours de process (presented/interview/dossier)
function candidatsForClient(coId) {
 const needIds = DB.needs.filter(n => n.company_id === coId).map(n => n.id);
 if (!needIds.length) return [];
 const cands = DB.candidates.filter(c => c.linked_need && needIds.includes(c.linked_need));
 // Tri : les plus avancés dans le process d'abord
 const rank = { presented: 0, interview: 1, dossier: 2, precal: 3, new: 4, entrant: 5, placed: 6, ko: 7 };
 return cands.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
}

function goToSignedContract() {
 const cn = DB._contract_notif; if (!cn) return;
 openContractValidationModal(cn.coId);
}

// ════════════════════════════════════════════════════════════════
// POP-UP DE VALIDATION POST-SIGNATURE
// S'ouvre au clic sur la notif "Contrat signé". Guide le scout :
// 1. Confirme que le contrat est bien signé (récap)
// 2. Affiche AUTOMATIQUEMENT le candidat concerné
// 3. Permet d'envoyer le contact du candidat au client en 1 clic
// ════════════════════════════════════════════════════════════════
function openContractValidationModal(coId) {
 const co = coById(coId);
 if (!co) { toast('Client introuvable', 'e'); return; }
 const sig = co._contract_signed || {};
 const cn = DB._contract_notif || {};
 const cands = candidatsForClient(coId);

 // Candidat pré-sélectionné : celui mémorisé sur le contrat, sinon le plus avancé
 let preselId = (co._contract_draft && co._contract_draft.candidat_id) || cn.candId || null;
 if (!preselId && cands.length) preselId = cands[0].id;

 const sigDate = sig.signed_at
  ? new Date(sig.signed_at).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
  : '—';

 // Bloc récap signature
 const recapHtml = `
  <div style="background:rgba(45,212,160,.08);border:1px solid rgba(45,212,160,.25);border-radius:var(--r2);padding:14px 16px;margin-bottom:16px">
   <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
    <span style="font-size:18px">&#x2705;</span>
    <span style="font-family:Syne,sans-serif;font-weight:700;font-size:13px;color:var(--green)">Contrat signé électroniquement</span>
   </div>
   <div style="display:grid;grid-template-columns:auto 1fr;gap:5px 14px;font-size:11px">
    <span style="color:var(--mu)">Client</span><span style="font-weight:600">${esc(co.name)}</span>
    <span style="color:var(--mu)">Signataire</span><span style="font-weight:600">${esc(sig.signer_name||cn.signer||'—')}</span>
    <span style="color:var(--mu)">Date</span><span>${sigDate}</span>
    <span style="color:var(--mu)">Référence</span><span style="font-family:'DM Mono',monospace;color:var(--ac)">${esc(sig.ref||'—')}</span>
   </div>
  </div>`;

 // Bloc sélection candidat
 let candHtml;
 if (!cands.length) {
  candHtml = `
   <div style="background:var(--s3);border:1px solid var(--ac3);border-radius:var(--r2);padding:14px 16px;font-size:11px;color:var(--mu)">
    ⚠ Aucun candidat n'est lié à un besoin de ce client. Liez d'abord un candidat à un besoin de <strong>${esc(co.name)}</strong> pour pouvoir transmettre son contact.
   </div>`;
 } else {
  candHtml = `
   <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--mu2);margin-bottom:8px">Candidat concerné</div>
   <div style="display:flex;flex-direction:column;gap:6px">
    ${cands.map(c => {
      const cat = getCat(c.cat);
      const ln = c.linked_need ? nById(c.linked_need) : null;
      const checked = c.id === preselId;
      return `<label style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:var(--s3);border:1.5px solid ${checked?'var(--ac)':'var(--bd)'};border-radius:var(--r2);cursor:pointer" onclick="_selectValidCand('${c.id}')">
        <input type="radio" name="valid-cand" value="${c.id}" ${checked?'checked':''} style="accent-color:var(--ac);width:15px;height:15px;flex-shrink:0">
        <div style="flex:1">
         <div style="font-size:12px;font-weight:600">${esc(c.name)}</div>
         <div style="font-size:10px;color:var(--mu)">${ln?esc(ln.title):'Sans besoin'} ${c.phone?' · '+esc(c.phone):''}</div>
        </div>
        <span class="tag ${cat.cls} fs9">${cat.l}</span>
       </label>`;
    }).join('')}
   </div>`;
 }

 openMo('Valider le placement — ' + esc(co.name), `
  <div style="max-height:64vh;overflow-y:auto;padding-right:2px">
   ${recapHtml}
   ${candHtml}
   ${cands.length ? `<div style="margin-top:14px;font-size:11px;color:var(--mu);line-height:1.55;background:var(--s2);border-radius:var(--r2);padding:11px 13px">
    En cliquant sur <strong>« Envoyer le contact au client »</strong>, NOVALEM transmet les coordonnées du candidat sélectionné à ${esc(co.name)}. Le candidat passera au statut <strong>Présenté client</strong> (entretien à organiser). Le placement sera confirmé seulement après le retour positif de l'entreprise.
   </div>` : ''}
  </div>`,
  '<button class="btn bg" onclick="dismissContractNotif();closeMo()">Plus tard</button>' +
  (cands.length
    ? '<button class="btn bg" onclick="closeMo();UI.ptab=4;go(\'clients\');setTimeout(()=>openCoPanel(\''+coId+'\'),80)">Voir la fiche client</button>' +
      '<button class="btn bp" id="valid-send-btn" onclick="sendCandidateContactToClient(\''+coId+'\')">📨 Envoyer le contact au client</button>'
    : '<button class="btn bp" onclick="closeMo();go(\'cands\')">Aller aux candidats</button>')
 );
}

function _selectValidCand(candId) {
 document.querySelectorAll('input[name="valid-cand"]').forEach(r => {
  const lbl = r.closest('label');
  const on = r.value === candId;
  r.checked = on;
  if (lbl) lbl.style.borderColor = on ? 'var(--ac)' : 'var(--bd)';
 });
}

// Envoie le contact du candidat au client.
// Le candidat passe en "Présenté client" (entretien client à venir) — PAS "Placé".
// Le placement n'aura lieu que si l'entreprise valide après l'entretien.
function sendCandidateContactToClient(coId) {
 const co = coById(coId);
 if (!co) return;
 const sel = document.querySelector('input[name="valid-cand"]:checked');
 if (!sel) { toast('Sélectionnez un candidat', 'w'); return; }
 const cand = cById(sel.value);
 if (!cand) { toast('Candidat introuvable', 'e'); return; }

 // Le candidat est présenté au client (entretien à venir), pas placé
 cand.status = 'presented';
 cand.updated = now_();
 cand.presented_at = now_();
 cand.presented_company = co.id;

 // Historiser côté client
 addTimeline(co.id, 'status', '📨 Contact transmis : ' + cand.name + ' — entretien client à venir', null);

 // Acquitter la notif
 delete DB._contract_notif;
 if (co._contract_signed) co._contract_signed.contact_sent = true;
 const fn = document.getElementById('floating-contract-notif');
 if (fn) fn.remove();

 save();
 badges();
 closeMo();
 toast('✅ Contact de ' + cand.name + ' transmis à ' + co.name, 's');

 // Proposer d'ouvrir l'email pré-rempli vers le client
 setTimeout(() => {
  openMo('Contact transmis ✅', `
   <div style="text-align:center;padding:8px 4px">
    <div style="font-size:38px;margin-bottom:10px">📨</div>
    <div style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;margin-bottom:6px">${esc(cand.name)} présenté à ${esc(co.name)}</div>
    <div style="font-size:12px;color:var(--mu);line-height:1.6;margin-bottom:4px">
     Le candidat passe en <strong>« Présenté client »</strong>. Envoie maintenant un email à ${esc(co.name)} avec ses coordonnées pour qu'ils organisent l'entretien. Le placement sera confirmé après leur retour.
    </div>
   </div>`,
   '<button class="btn bg" onclick="closeMo()">Fermer</button>' +
   (co.email ? '<button class="btn bp" onclick="closeMo();_emailContactToClient(\''+coId+'\',\''+cand.id+'\')">📧 Rédiger l\'email au client</button>' : '')
  );
 }, 350);

 if (UI.view === 'dash') rDash();
}

// Ouvre un email pré-rempli pour transmettre le contact du candidat au client
function _emailContactToClient(coId, candId) {
 const co = coById(coId), cand = cById(candId);
 if (!co || !cand) return;
 const prenom = greetCo(co);
 const poste = (cand.linked_need && nById(cand.linked_need)) ? nById(cand.linked_need).title : (cand.poste || cand.title || 'le poste');
 const subj = 'Coordonnées de votre candidat — ' + cand.name;
 const body = `Bonjour ${prenom || ''},\n\n`
  + `Nous vous remercions de votre confiance et sommes ravis de vous compter parmi les partenaires de NOVALEM.\n\n`
  + `Suite à la signature de notre contrat, voici les coordonnées du candidat retenu pour ${poste} :\n\n`
  + `- Nom : ${cand.name}\n`
  + (cand.phone ? `- Téléphone : ${cand.phone}\n` : '')
  + (cand.email ? `- Email : ${cand.email}\n` : '')
  + `\nLe candidat est informé de votre intérêt pour son profil et attend votre prise de contact. Vous pouvez le contacter directement pour organiser l'entretien.\n\n`
  + `Nous restons en attente de la date d'entretien convenue afin de suivre le bon déroulement de la procédure. N'hésitez pas à nous contacter pour tout accompagnement.\n\n`
  + `Bien à vous,\nLouis RENAULT — NOVALEM\ncontact@novalem-recrutement.fr — 06 58 21 20 96`;
 const mailto = 'mailto:' + encodeURIComponent(co.email)
  + '?subject=' + encodeURIComponent(subj)
  + '&body=' + encodeURIComponent(body);
 window.open(mailto, '_blank');
 toast('Email pré-rempli ouvert', 'i');
}

function dismissContractNotif() {
 delete DB._contract_notif;
 save();
 if(UI.view==='dash') rDash();
}

// ════════════════════════════════════════════════════════════════
// POLLING SIGNATURES — vérifie toutes les 20s si un contrat envoyé
// a été signé. Ne s'arrête jamais (passe en veille si rien à suivre).
// Affiche une notification flottante visible sur TOUS les écrans.
// ════════════════════════════════════════════════════════════════
let _sigPollTimer = null;

async function _checkPendingSignatures() {
 const pending = DB.companies.filter(co => co._contract_draft && co._contract_draft.sent_at && !co._contract_signed);
 if (!pending.length) return;
 const sb = getSB();
 if (!sb) return;
 for (const co of pending) {
  try {
   const { data } = await sb.from('novalem_signatures')
    .select('signer_name,signed_at,ct_id')
    .eq('co_id', co.id)
    .order('signed_at', { ascending: false })
    .limit(1).maybeSingle();
   if (data && data.signer_name) {
    co._contract_signed = { signer_name: data.signer_name, signed_at: data.signed_at, ref: 'NV-' + (data.ct_id || '').slice(0, 8).toUpperCase() };
    // Clôturer la relance de signature en attente (automatisation agenda)
    (DB.agenda||[]).forEach(a=>{ if(a._contract_followup && a.comp_id===co.id && !a.done){ a.done=true; a.done_at=now_(); a.updated=now_(); } });
    // Tracer la signature dans l'agenda (jour de la signature)
    addAgendaAuto({ type:'contract', title:'Contrat signé — '+co.name, date:dayKey(data.signed_at||todayKey()), comp_id:co.id, cand_id:(co._contract_draft&&co._contract_draft.candidat_id)||null, notes:'Signé par '+data.signer_name+'. Transmettre les coordonnées du candidat et valider le placement.', done:true, _contract_log:true });
    const _cands = candidatsForClient(co.id);
    const _candId = (co._contract_draft && co._contract_draft.candidat_id) || (_cands[0] && _cands[0].id) || null;
    DB._contract_notif = { coId: co.id, coName: co.name, signer: data.signer_name, at: data.signed_at, candId: _candId };
    addTimeline(co.id, 'status', '&#x2705; Contrat sign&eacute; par ' + data.signer_name, null);
    save(); badges();
    if (UI.view === 'dash') rDash();
    showFloatingContractNotif();  // notif flottante sur n'importe quel écran
    toast('&#x2705; ' + co.name + ' a sign&eacute; le contrat !', 's');
   }
  } catch (e) { /* silencieux */ }
 }
}

function startSignaturePolling() {
 if (_sigPollTimer) return;
 // Vérification immédiate au démarrage
 _checkPendingSignatures();
 // Puis toutes les 20 secondes — le timer ne s'arrête jamais
 _sigPollTimer = setInterval(_checkPendingSignatures, 20000);
}

// ── Notification flottante (visible sur tous les écrans du CRM) ──
function showFloatingContractNotif() {
 const cn = DB._contract_notif;
 if (!cn) return;
 // Évite les doublons
 const old = document.getElementById('floating-contract-notif');
 if (old) old.remove();

 const el = document.createElement('div');
 el.id = 'floating-contract-notif';
 el.style.cssText = 'position:fixed;top:18px;right:18px;z-index:99999;max-width:340px;'
  + 'background:var(--s2,#1a1a1a);border:1px solid rgba(45,212,160,.4);border-left:3px solid var(--green,#2dd4a0);'
  + 'border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.4);'
  + 'animation:slideInNotif .35s cubic-bezier(.16,1,.3,1);cursor:pointer';
 el.onclick = function (e) {
  if (e.target.closest('.fcn-close')) return;
  el.remove();
  goToSignedContract();
 };
 el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:10px">'
  + '<span style="font-size:20px;flex-shrink:0">&#x2705;</span>'
  + '<div style="flex:1">'
  + '<div style="font-family:Syne,sans-serif;font-weight:700;font-size:12.5px;color:var(--green,#2dd4a0)">Contrat sign&eacute; !</div>'
  + '<div style="font-size:11px;color:var(--mu,#999);margin-top:3px;line-height:1.45">'
  + esc(cn.coName || 'Client') + (cn.signer ? ' &mdash; ' + esc(cn.signer) : '')
  + '<br><span style="color:var(--green,#2dd4a0);font-weight:600">Cliquez pour valider le placement &rarr;</span></div>'
  + '</div>'
  + '<button class="fcn-close" onclick="document.getElementById(\'floating-contract-notif\').remove()" '
  + 'style="background:none;border:none;color:var(--mu,#999);cursor:pointer;font-size:14px;padding:0 2px;flex-shrink:0">&#x2715;</button>'
  + '</div>';
 document.body.appendChild(el);

 // Auto-masquage après 30s (la bannière dashboard reste, elle)
 setTimeout(() => { const n = document.getElementById('floating-contract-notif'); if (n) n.remove(); }, 30000);
}

// Vérifier si le contrat a été signé (polling Supabase)
async function checkContractSignature(coId) {
 const co = coById(coId); if (!co || !co._contract_draft) return;
 toast('Vérification en cours…', 'i');
 const sb = getSB();
 if (!sb) { toast('Supabase non configuré', 'e'); return; }
 try {
  const { data, error } = await sb
   .from('novalem_signatures')
   .select('signer_name, signed_at, ct_id, status')
   .eq('co_id', coId)
   .order('signed_at', { ascending: false })
   .limit(1)
   .maybeSingle();
  if (error) throw error;
  if (data) {
   co._contract_signed = {
    signer_name: data.signer_name,
    signed_at:   data.signed_at,
    ref:         'NV-' + (data.ct_id || '').slice(0,8).toUpperCase(),
   };
   const _cands = candidatsForClient(coId);
   const _candId = (co._contract_draft && co._contract_draft.candidat_id) || (_cands[0] && _cands[0].id) || null;
   DB._contract_notif = { coId, coName: co.name, signer: data.signer_name, at: data.signed_at, candId: _candId };
   addTimeline(coId, 'status', '✅ Contrat signé par ' + data.signer_name, null);
   save();
   badges();
   toast('✅ Contrat signé par ' + data.signer_name, 's');
   closeMo();
   // Ouvrir directement la pop-up de validation
   setTimeout(() => openContractValidationModal(coId), 120);
  } else {
   toast('Pas encore signé', 'w');
  }
 } catch(e) {
  toast('Erreur: ' + e.message, 'e');
 }
}
