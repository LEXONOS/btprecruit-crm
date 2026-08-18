/* =====================================================================
   CHASSE AUX RESTOS SANS SITE - NOVALEM - v2 (PRO)
   ---------------------------------------------------------------------
   Version "abusee" : quadrille la Guadeloupe zone par zone et redecoupe
   automatiquement toute case trop dense, donc elle ne loupe aucun spot.
   Sort la liste des restos SANS vrai site, avec telephone, un lien
   WhatsApp deja pret (message + nom du resto dedans), et genere un
   cockpit d'envoi (page a ouvrir dans ton navigateur).

   REMPLACE la version chasse-restos.js.
   ---------------------------------------------------------------------
   COMMENT LANCER :

   1) Colle ta cle API Google ci-dessous (meme cle que pour la v1).

   2) Choisis la ZONE (voir juste apres). Laisse "TEST" pour le 1er essai
      (petit bout de Gosier, verifie que la cle marche sans depenser).
      Quand c'est bon, mets "TOUT" pour toute la Guadeloupe, ou une ile
      precise si tu veux avancer par morceaux.

   3) Terminal, dans le dossier du fichier :
          node chasse-restos-PRO.js

   4) A la fin tu obtiens :
          restos-SANS-site.csv     <- ta liste (nom, tel, lien WhatsApp)
          restos-avec-site.csv     <- les autres, pour rien perdre
          cockpit-whatsapp.html    <- ouvre-le : tu blastes en 1 clic/resto
   ===================================================================== */

const API_KEY = "AIzaSyAHGs8gP1XCk-CJ6NlsHX3wruI7ZWyaZjc";

// Zones possibles : "TEST", "TOUT", "GRANDE-TERRE", "BASSE-TERRE",
// "MARIE-GALANTE", "LES-SAINTES", "LA-DESIRADE"
const ZONE = "TEST";

// Le message WhatsApp pre-rempli. {NOM} est remplace par le nom du resto.
// Modifie-le comme tu veux, garde-le court.
const MSG_WHATSAPP = (nom) =>
`Bonjour ${nom}, je suis Louis du studio web Novalem (Guadeloupe). ` +
`J'ai vu que vous n'avez pas encore de site internet. Je realise des ` +
`sites simples et pros pour les restos d'ici : menu en QR code, page de ` +
`presentation, a partir de 250 EUR. Un exemple : https://ifc-guadeloupe.fr ` +
`Ca vous dirait d'en parler ?`;

// ---------------------------------------------------------------------
// REGLAGES AVANCES (pas besoin d'y toucher)
// ---------------------------------------------------------------------

// Types Google balayes. restaurant + meal_takeaway couvrent restos,
// snacks et lolos. Ajoute "cafe","bar","bakery" si tu veux ratisser plus large.
const TYPES = ["restaurant", "meal_takeaway"];

const INITIAL_STEP = 0.045;   // taille des cases de depart (~5 km)
const MIN_STEP = 0.006;       // finesse max quand on redecoupe (~650 m)
const POOL_DISCOVERY = 4;     // cases balayees en parallele
const POOL_DETAILS = 6;       // fiches (site+tel) recuperees en parallele
const PAUSE_TOKEN = 2100;     // pause imposee par Google avant page 2/3 (ms)

// On garde une cible meme si elle met juste sa page reseau/agregateur en "site".
const PAS_UN_VRAI_SITE = [
  "facebook.com", "instagram.com", "fb.me", "linktr.ee", "linktree",
  "tripadvisor.", "thefork.", "lafourchette.", "ubereats.", "deliveroo.",
  "google.com", "goo.gl", "wa.me", "whatsapp.com", "beacons.ai", "taplink",
  "sites.google.com", "wixsite.com/mysite"
];

// Boites (bounding boxes) des iles.
const ILES = {
  "GRANDE-TERRE":  { s: 16.17, n: 16.52, w: -61.61, e: -61.14 },
  "BASSE-TERRE":   { s: 15.93, n: 16.37, w: -61.82, e: -61.50 },
  "MARIE-GALANTE": { s: 15.85, n: 16.02, w: -61.36, e: -61.12 },
  "LES-SAINTES":   { s: 15.83, n: 15.90, w: -61.68, e: -61.55 },
  "LA-DESIRADE":   { s: 16.28, n: 16.34, w: -61.10, e: -60.82 },
  "TEST":          { s: 16.19, n: 16.23, w: -61.53, e: -61.47 }
};

// Communes (pour ranger chaque resto dans sa commune, sans cout API).
const COMMUNES = [
  ["Le Gosier",16.206,-61.499],["Les Abymes",16.271,-61.505],["Pointe-a-Pitre",16.241,-61.533],
  ["Baie-Mahault",16.267,-61.588],["Le Moule",16.333,-61.348],["Sainte-Anne",16.227,-61.383],
  ["Saint-Francois",16.252,-61.271],["Petit-Bourg",16.190,-61.591],["Sainte-Rose",16.331,-61.697],
  ["Gourbeyre",16.006,-61.680],["Basse-Terre",15.998,-61.727],["Capesterre-Belle-Eau",16.045,-61.567],
  ["Lamentin",16.269,-61.632],["Morne-a-l'Eau",16.336,-61.516],["Petit-Canal",16.383,-61.489],
  ["Port-Louis",16.420,-61.531],["Anse-Bertrand",16.472,-61.506],["Bouillante",16.132,-61.769],
  ["Deshaies",16.302,-61.795],["Pointe-Noire",16.232,-61.789],["Vieux-Habitants",16.058,-61.766],
  ["Baillif",16.013,-61.746],["Saint-Claude",16.024,-61.686],["Trois-Rivieres",15.965,-61.641],
  ["Vieux-Fort",15.951,-61.708],["Goyave",16.130,-61.571],["Grand-Bourg",15.883,-61.316],
  ["Capesterre-de-Marie-Galante",15.902,-61.223],["Saint-Louis",15.958,-61.311],
  ["Terre-de-Haut",15.865,-61.585],["Terre-de-Bas",15.855,-61.639],["La Desirade",16.307,-61.020]
];

// ---------------------------------------------------------------------
// CODE
// ---------------------------------------------------------------------
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -------- cache disque : reruns pas cheres (fiches deja vues zappees)
const CACHE_FICHIER = "cache-details.json";
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FICHIER, "utf8")); } catch (e) { cache = {}; }
const sauverCache = () => { try { fs.writeFileSync(CACHE_FICHIER, JSON.stringify(cache)); } catch (e) {} };

// -------- helpers purs (testables)
function grid(box, step) {
  const cells = [];
  for (let la = box.s; la < box.n - 1e-9; la += step) {
    for (let lo = box.w; lo < box.e - 1e-9; lo += step) {
      cells.push({ s: la, n: Math.min(la + step, box.n), w: lo, e: Math.min(lo + step, box.e) });
    }
  }
  return cells;
}

function cellCentreRayon(cell) {
  const lat = (cell.s + cell.n) / 2, lng = (cell.w + cell.e) / 2;
  const mLat = (cell.n - cell.s) * 111320;
  const mLng = (cell.e - cell.w) * 111320 * Math.cos(lat * Math.PI / 180);
  const rayon = Math.min(50000, Math.ceil(0.5 * Math.sqrt(mLat * mLat + mLng * mLng)) + 30);
  return { lat, lng, rayon };
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function communeLaPlusProche(lat, lng) {
  let best = "", bd = Infinity;
  for (const [nom, cLat, cLng] of COMMUNES) {
    const d = distanceKm(lat, lng, cLat, cLng);
    if (d < bd) { bd = d; best = nom; }
  }
  return best;
}

function analyseSite(website) {
  if (!website) return { aUnSite: false, detail: "" };
  const bas = website.toLowerCase();
  if (PAS_UN_VRAI_SITE.some((m) => bas.includes(m))) return { aUnSite: false, detail: "reseau social : " + website };
  return { aUnSite: true, detail: website };
}

function lienWhatsApp(telephone, nom) {
  if (!telephone) return "";
  const digits = String(telephone).replace(/[^0-9]/g, "");
  if (!digits) return "";
  return "https://wa.me/" + digits + "?text=" + encodeURIComponent(MSG_WHATSAPP(nom));
}

function categorieLisible(types) {
  return (types || [])
    .filter((t) => !["point_of_interest", "establishment", "food", "store"].includes(t))
    .slice(0, 2).join(", ");
}

// -------- CSV
const champ = (v) => '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
const ligneCSV = (vals) => vals.map(champ).join(";");

// -------- appel Google robuste
async function g(url) {
  for (let e = 0; e < 4; e++) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OVER_QUERY_LIMIT") { await sleep(4000); continue; }
      if (data.status === "INVALID_REQUEST") { await sleep(1600); continue; } // token pas encore pret
      if (data.status === "REQUEST_DENIED") {
        console.error("\n>>> Google refuse la requete : " + (data.error_message || "") +
          "\n>>> Verifie que ta cle est bonne, que 'Places API' est ACTIVEE et que la facturation est activee.\n");
        process.exit(1);
      }
      return data;
    } catch (err) { await sleep(1500); }
  }
  return { status: "ECHEC", results: [] };
}

// -------- une recherche Nearby (jusqu'a 3 pages), dit si c'est sature
async function nearby(lat, lng, rayon, type) {
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${rayon}&type=${type}&language=fr&key=${API_KEY}`;
  const out = []; let sature = false;
  for (let p = 0; p < 3; p++) {
    const data = await g(url);
    for (const r of (data.results || [])) out.push(r);
    if (data.next_page_token) {
      if (p === 2) { sature = true; break; } // il y a encore des pages au-dela de 3
      await sleep(PAUSE_TOKEN);
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${data.next_page_token}&key=${API_KEY}`;
    } else break;
  }
  if (out.length >= 60) sature = true;
  return { results: out, sature };
}

// -------- scan d'une case, avec redecoupage auto si sature
async function scanCase(cell, store, stats) {
  const { lat, lng, rayon } = cellCentreRayon(cell);
  let sature = false, trouve = false;
  for (const t of TYPES) {
    const { results, sature: s } = await nearby(lat, lng, rayon, t);
    if (results.length) trouve = true;
    if (s) sature = true;
    for (const r of results) {
      if (!store.has(r.place_id)) {
        store.set(r.place_id, {
          place_id: r.place_id, nom: r.name,
          adresse: r.vicinity || r.formatted_address || "",
          note: r.rating || "", avis: r.user_ratings_total || "",
          categorie: categorieLisible(r.types),
          commune: communeLaPlusProche(r.geometry.location.lat, r.geometry.location.lng)
        });
      }
    }
  }
  stats.cases++;
  const step = cell.n - cell.s;
  if (sature && step / 2 >= MIN_STEP) {
    stats.redecoupes++;
    const mLat = (cell.s + cell.n) / 2, mLng = (cell.w + cell.e) / 2;
    const subs = [
      { s: cell.s, n: mLat, w: cell.w, e: mLng }, { s: cell.s, n: mLat, w: mLng, e: cell.e },
      { s: mLat, n: cell.n, w: cell.w, e: mLng }, { s: mLat, n: cell.n, w: mLng, e: cell.e }
    ];
    for (const sc of subs) await scanCase(sc, store, stats);
  }
  return trouve;
}

// -------- pool de concurrence simple
async function pool(items, taille, worker) {
  let idx = 0;
  const runners = Array(Math.min(taille, items.length)).fill(0).map(async () => {
    while (idx < items.length) { const i = idx++; await worker(items[i], i); }
  });
  await Promise.all(runners);
}

// -------- fiche detaillee (site + telephone)
async function details(placeId) {
  if (cache[placeId]) return cache[placeId];
  const champs = "website,international_phone_number,business_status,url";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${champs}&language=fr&key=${API_KEY}`;
  const data = await g(url);
  const d = data.result || {};
  cache[placeId] = d;
  return d;
}

// -------- cockpit HTML d'envoi WhatsApp
function genererCockpit(restos) {
  const data = JSON.stringify(restos.map((r) => ({
    nom: r.nom, commune: r.commune, tel: r.telephone, wa: r.lienWhatsApp,
    maps: r.maps, cat: r.categorie, site: r.detailSite
  })));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cockpit prospection - Novalem</title>
<style>
  :root{--cream:#faf6ef;--ink:#2b2a26;--or:#b8912f;--line:#e7dcc7}
  *{box-sizing:border-box}body{margin:0;font-family:'Outfit',system-ui,Arial,sans-serif;background:var(--cream);color:var(--ink)}
  header{position:sticky;top:0;background:rgba(250,246,239,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:16px 20px;z-index:5}
  h1{margin:0 0 4px;font-size:20px}.sub{font-size:13px;opacity:.7}
  .bar{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  input,select{padding:9px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff}
  .wrap{max-width:820px;margin:18px auto;padding:0 16px 60px}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:10px;display:flex;gap:14px;align-items:center;box-shadow:0 1px 2px rgba(0,0,0,.03)}
  .card.done{opacity:.45}
  .info{flex:1;min-width:0}.nom{font-weight:600;font-size:16px}.meta{font-size:13px;opacity:.7;margin-top:2px}
  .badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:#f3ead6;color:#7a5f1e;margin-left:6px}
  .btns{display:flex;gap:8px;flex-shrink:0}
  a.btn,button.btn{border:0;cursor:pointer;font:inherit;font-weight:600;padding:10px 14px;border-radius:10px;text-decoration:none;display:inline-flex;align-items:center;white-space:nowrap}
  .wa{background:#25d366;color:#fff}.tel{background:#eef1f4;color:#26303a}.ok{background:#fff;border:1px solid var(--line);color:#444}
  .count{font-weight:600;color:var(--or)}
</style></head><body>
<header>
  <h1>Cockpit prospection <span class="count" id="c"></span></h1>
  <div class="sub">Clique WhatsApp : le message est deja pret avec le nom du resto. Coche "Fait" pour avancer.</div>
  <div class="bar">
    <input id="q" placeholder="Rechercher un resto ou une commune...">
    <select id="f"><option value="all">Tous</option><option value="todo">A faire</option><option value="done">Faits</option></select>
    <select id="cm"><option value="all">Toutes communes</option></select>
  </div>
</header>
<div class="wrap" id="list"></div>
<script>
const DATA = ${data};
const done = JSON.parse((()=>{try{return localStorage.getItem('nv_done')||'{}'}catch(e){return '{}'}})());
const save = ()=>{try{localStorage.setItem('nv_done',JSON.stringify(done))}catch(e){}};
const communes=[...new Set(DATA.map(d=>d.commune))].sort();
const cm=document.getElementById('cm');communes.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;cm.appendChild(o)});
function key(d){return d.nom+'|'+d.tel}
function render(){
  const q=document.getElementById('q').value.toLowerCase();
  const f=document.getElementById('f').value, c=cm.value;
  const list=document.getElementById('list');list.innerHTML='';
  let shown=0,total=DATA.length,fait=DATA.filter(d=>done[key(d)]).length;
  DATA.forEach(d=>{
    const isDone=!!done[key(d)];
    if(f==='todo'&&isDone)return; if(f==='done'&&!isDone)return;
    if(c!=='all'&&d.commune!==c)return;
    if(q&&!(d.nom.toLowerCase().includes(q)||(d.commune||'').toLowerCase().includes(q)))return;
    shown++;
    const card=document.createElement('div');card.className='card'+(isDone?' done':'');
    card.innerHTML='<div class="info"><div class="nom">'+d.nom+(d.site?' <span class="badge">page reseau</span>':'')+'</div>'+
      '<div class="meta">'+(d.commune||'')+(d.cat?' · '+d.cat:'')+(d.tel?' · '+d.tel:' · pas de tel')+'</div></div>'+
      '<div class="btns">'+
        (d.wa?'<a class="btn wa" target="_blank" href="'+d.wa+'">WhatsApp</a>':'')+
        (d.tel?'<a class="btn tel" href="tel:'+d.tel.replace(/ /g,'')+'">Appeler</a>':'')+
        '<button class="btn ok">'+(isDone?'Annuler':'Fait')+'</button>'+
      '</div>';
    card.querySelector('.ok').onclick=()=>{if(done[key(d)])delete done[key(d)];else done[key(d)]=1;save();render()};
    list.appendChild(card);
  });
  document.getElementById('c').textContent=fait+' / '+total+' faits';
}
['q','f','cm'].forEach(id=>document.getElementById(id).addEventListener('input',render));
render();
</script></body></html>`;
}

// -------- programme principal
async function main() {
  if (API_KEY === "COLLE_TA_CLE_ICI" || !API_KEY) {
    console.log("\n>>> Colle ta cle API Google en haut du fichier.\n"); process.exit(1);
  }
  const box = ILES[ZONE];
  if (!box) { console.log("\n>>> ZONE inconnue : " + ZONE + "\n"); process.exit(1); }

  const zones = ZONE === "TOUT"
    ? ["GRANDE-TERRE", "BASSE-TERRE", "MARIE-GALANTE", "LES-SAINTES", "LA-DESIRADE"]
    : [ZONE];

  console.log("\nChasse v2 lancee sur : " + zones.join(", ") + "\nTypes : " + TYPES.join(", ") + "\n");

  // 1) DECOUVERTE : quadrillage + redecoupage auto
  const store = new Map();
  const stats = { cases: 0, redecoupes: 0 };
  for (const z of zones) {
    const cells = grid(ILES[z] || box, INITIAL_STEP);
    console.log("Zone " + z + " : " + cells.length + " cases de depart...");
    await pool(cells, POOL_DISCOVERY, async (cell) => { await scanCase(cell, store, stats); });
    console.log("   -> " + store.size + " restos cumules (" + stats.cases + " cases scannees, " + stats.redecoupes + " redecoupees)");
  }

  const liste = [...store.values()];
  console.log("\n" + liste.length + " restaurants uniques. Recuperation site + telephone...\n");

  // 2) DETAILS : site + telephone (en parallele)
  const sansSite = [], avecSite = [];
  let fait = 0;
  await pool(liste, POOL_DETAILS, async (r) => {
    const d = await details(r.place_id);
    fait++; if (fait % 40 === 0) { console.log("   " + fait + "/" + liste.length + "..."); sauverCache(); }
    if (d.business_status && d.business_status !== "OPERATIONAL") return;
    const site = analyseSite(d.website);
    const tel = d.international_phone_number || "";
    const row = {
      ...r, telephone: tel,
      aUnSite: site.aUnSite ? "OUI" : "NON", detailSite: site.detail,
      lienWhatsApp: site.aUnSite ? "" : lienWhatsApp(tel, r.nom),
      maps: d.url || ("https://www.google.com/maps/place/?q=place_id:" + r.place_id)
    };
    (site.aUnSite ? avecSite : sansSite).push(row);
  });
  sauverCache();

  // cibles avec telephone en premier
  sansSite.sort((a, b) => (b.telephone ? 1 : 0) - (a.telephone ? 1 : 0) || String(a.commune).localeCompare(b.commune));

  // 3) SORTIES
  const entete = ligneCSV(["Nom", "Commune", "Telephone", "Lien WhatsApp", "A un site", "Detail site", "Adresse", "Categorie", "Note", "Nb avis", "Lien Google Maps", "place_id"]);
  const toCSV = (arr) => "\uFEFF" + [entete, ...arr.map((r) => ligneCSV([
    r.nom, r.commune, r.telephone, r.lienWhatsApp, r.aUnSite, r.detailSite, r.adresse, r.categorie, r.note, r.avis, r.maps, r.place_id
  ]))].join("\n");

  fs.writeFileSync("restos-SANS-site.csv", toCSV(sansSite));
  fs.writeFileSync("restos-avec-site.csv", toCSV(avecSite));
  fs.writeFileSync("cockpit-whatsapp.html", genererCockpit(sansSite));

  // recap par commune
  const parCommune = {};
  for (const r of sansSite) parCommune[r.commune] = (parCommune[r.commune] || 0) + 1;
  const avecTel = sansSite.filter((r) => r.telephone).length;

  console.log("\n========================================");
  console.log("TERMINE.");
  console.log("  Restos SANS vrai site : " + sansSite.length + "  (dont " + avecTel + " avec telephone)");
  console.log("  Restos avec un site   : " + avecSite.length);
  console.log("\n  Par commune :");
  Object.entries(parCommune).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log("    " + String(n).padStart(3) + "  " + c));
  console.log("\n  Fichiers : restos-SANS-site.csv / restos-avec-site.csv / cockpit-whatsapp.html");
  console.log("========================================\n");
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { grid, cellCentreRayon, communeLaPlusProche, analyseSite, lienWhatsApp, categorieLisible, distanceKm, genererCockpit };
