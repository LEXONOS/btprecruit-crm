/* ViNego Cockpit : interface */
(function () {
  "use strict";
  const E = window.Engine;
  const KEY = "vinego-cockpit-v1";
  const C = E.CLIENTS;
  const N = E.num;

  let state = load();
  let view = (state.ui && state.ui.view) || "dash";
  const ui = {
    importOpen: false,
    imp: { files: [], text: "", hint: "auto", m: null, busy: false, result: null, error: null, sel: {} },
    chatBusy: false, chatAttach: [], chatDraft: "",
    analyzeBusy: false, needsM: 3,
    pointerDown: false, pendingRender: false
  };

  /* ---------- Stockage ---------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.version) return migrate(s);
    } catch (e) { /* état neuf */ }
    return E.defaultState();
  }
  function migrate(s) {
    const d = E.defaultState();
    const ds = d.settings;
    s.settings = Object.assign({}, ds, s.settings || {});
    for (const k of ["fixed", "ranges", "yields", "buyTargets", "naturalCost"]) s.settings[k] = Object.assign({}, ds[k], s.settings[k] || {});
    s.settings.needs = Object.assign({}, ds.needs, s.settings.needs || {});
    for (const k of ["months", "offers", "journal", "chat"]) if (!s[k]) s[k] = d[k];
    if (!s.current) s.current = d.current;
    if (!s.partners) s.partners = {};
    return s;
  }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("Sauvegarde impossible : stockage du navigateur plein. Exporte tes données."); }
    }, 120);
  }

  /* ---------- Outils ---------- */
  const esc = (s) => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d) => (v === null || v === undefined || v === "" || isNaN(v) ? "-" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d || 0 }));
  const eur = (v) => (v === null || v === undefined || v === "" || isNaN(v) ? "-" : Math.round(v).toLocaleString("fr-FR") + " €");
  const MN = (m) => E.MONTHS[m - 1] || `Mois ${m}`;
  function getP(path) { return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), state); }
  function setP(path, val) {
    const ks = path.split(".");
    let o = state;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] === null || o[ks[i]] === undefined || typeof o[ks[i]] !== "object") o[ks[i]] = /^\d+$/.test(ks[i + 1]) && ks[0] !== "months" && ks[0] !== "settings" ? [] : {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function md(text) {
    const lines = esc(text || "").split(/\r?\n/);
    let html = "", inList = false, para = [];
    const flush = () => { if (para.length) { html += `<p>${para.join("<br>")}</p>`; para = []; } };
    for (const raw of lines) {
      const l = raw.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (/^\s*([-•*]|\d+[.)])\s+/.test(raw)) {
        flush();
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${l.replace(/^\s*([-•*]|\d+[.)])\s+/, "")}</li>`;
      } else if (!raw.trim()) {
        if (inList) { html += "</ul>"; inList = false; }
        flush();
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        para.push(l.replace(/^#+\s*/, ""));
      }
    }
    if (inList) html += "</ul>";
    flush();
    return html;
  }
  function inNum(path, ph, extra) {
    const v = getP(path);
    return `<input type="text" inputmode="decimal" class="in-num" data-path="${path}" data-type="num" value="${v === null || v === undefined ? "" : esc(v)}" placeholder="${ph === undefined || ph === null ? "" : esc(ph)}" ${extra || ""}>`;
  }
  function inText(path, ph) {
    const v = getP(path);
    return `<input type="text" data-path="${path}" data-type="text" value="${esc(v || "")}" placeholder="${esc(ph || "")}">`;
  }
  function sel(path, options, dflt) {
    const v = getP(path);
    const cur = v === undefined || v === null || v === "" ? dflt : v;
    return `<select data-path="${path}" data-type="text">${options.map((o) => `<option value="${esc(o.k)}" ${String(o.k) === String(cur) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  }
  function chk(path, label) {
    const v = !!getP(path);
    return `<label class="chk ${v ? "done" : ""}"><input type="checkbox" data-path="${path}" data-type="bool" ${v ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }
  function idxTag(v) {
    if (v === null || v === undefined) return `<span class="tag none">pas de donnée</span>`;
    const cls = v >= 1.3 ? "good" : v <= 0.7 ? "bad" : "mid";
    return `<span class="tag ${cls}">indice ${v.toFixed(2)}</span>`;
  }
  function head(title, sub, actions) {
    return `<div class="head"><div><h2>${esc(title)}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}</div><div class="row">${actions || ""}<button class="btn coach-toggle" data-act="toggle-coach">Coach</button></div></div>`;
  }
  const impBtn = (target, m, label) => `<button class="btn primary" data-act="import" data-target="${target}" data-m="${m || ""}">${esc(label || "Importer une capture")}</button>`;

  /* ---------- Navigation ---------- */
  function go(v) {
    view = v;
    const mm = v.match(/^m(\d+)(p1|p2|r)$/);
    if (mm) state.current = { m: +mm[1], phase: mm[2] === "p1" ? 1 : mm[2] === "p2" ? 2 : 3 };
    state.ui = { view };
    save();
    render();
    document.getElementById("main").scrollTop = 0;
    document.getElementById("rail").classList.remove("open");
  }
  function curView() {
    const { m, phase } = state.current;
    return `m${m}${phase === 1 ? "p1" : phase === 2 ? "p2" : "r"}`;
  }

  /* ---------- Rendu ---------- */
  function scheduleRender() {
    if (ui.pointerDown) { ui.pendingRender = true; return; }
    requestAnimationFrame(render);
  }
  function render() {
    const a = document.activeElement;
    const ap = a && a.dataset ? a.dataset.path : null;
    document.getElementById("rail").innerHTML = railHTML();
    document.getElementById("main").innerHTML = mainHTML();
    renderCoach();
    renderModal();
    if (ap) {
      const el = document.querySelector(`[data-path="${CSS.escape(ap)}"]`);
      if (el && el.type !== "checkbox") { el.focus(); try { el.select(); } catch (e) { /* select absent */ } }
    }
  }

  function railHTML() {
    const total = N(state.settings.months) || 6;
    const nav = [["dash", "Tableau de bord"], ["nego", "Négociations"], ["settings", "Paramètres"], ["journal", "Journal"]];
    let tl = "";
    for (let m = 1; m <= total; m++) {
      const mo = state.months[m] || {};
      const p1 = mo.p1 && mo.p1.done, p2 = mo.p2 && mo.p2.done, r = mo.results && N(mo.results.monthlyResult) !== null;
      const cur = state.current.m === m;
      const st = (id, label, ok) => `<button class="step ${ok ? "ok" : ""} ${view === `m${m}${id}` ? "on" : ""}" data-act="go" data-view="m${m}${id}">${label}</button>`;
      tl += `<div class="tm ${p1 && p2 && r ? "done" : ""} ${cur ? "cur" : ""}"><span class="dot"></span><div class="mname">${MN(m)}${E.isNat(state, m) ? " <small style=\"color:var(--muted);font-weight:500\">naturels</small>" : ""}</div><div class="steps">${st("p1", "Planification", p1)}${st("p2", "Ventes et achats", p2)}${st("r", "Résultats", r)}</div></div>`;
    }
    return `<div class="brand"><h1>ViNego Cockpit</h1><p>${esc(state.settings.myId || "Distributeur")}, ${state.settings.nDist ? `${state.settings.nDist} distributeurs` : "session à paramétrer"}</p></div>
      <div class="nav">
        <button class="btn primary" style="justify-content:center;margin-bottom:8px" data-act="import" data-target="auto" data-m="">Importer une capture</button>
        ${nav.map(([v, l]) => `<button class="${view === v ? "on" : ""}" data-act="go" data-view="${v}">${l}</button>`).join("")}
      </div>
      <div class="timeline"><h2>La partie, mois par mois</h2>${tl}</div>
      <div class="rail-foot">Sauvegarde automatique dans ce navigateur. Pense à exporter de temps en temps (Paramètres).</div>`;
  }

  function mainHTML() {
    const mm = view.match(/^m(\d+)(p1|p2|r)$/);
    if (mm) {
      const m = +mm[1];
      E.month(state, m);
      return mm[2] === "p1" ? viewP1(m) : mm[2] === "p2" ? viewP2(m) : viewResults(m);
    }
    if (view === "nego") return viewNego();
    if (view === "settings") return viewSettings();
    if (view === "journal") return viewJournal();
    return viewDash();
  }

  /* ---------- Tableau de bord ---------- */
  function viewDash() {
    const total = N(state.settings.months) || 6;
    let last = null;
    for (let m = total; m >= 1; m--) { const r = state.months[m] && state.months[m].results; if (r && Object.keys(r).length) { last = { m, r }; break; } }
    const { m, phase } = state.current;
    const setupMissing = !state.settings.nDist || !state.settings.myId;
    const k = (label, v, cls) => `<div class="kpi"><span>${label}</span><b class="${cls || ""}">${v}</b></div>`;
    const r = last ? last.r : {};
    const cls = (v) => (N(v) === null ? "" : N(v) < 0 ? "neg" : "pos");
    let hist = "";
    const series = [];
    for (let i = 1; i <= total; i++) {
      const x = (state.months[i] && state.months[i].results) || {};
      if (!Object.keys(x).length) continue;
      series.push({ m: i, res: N(x.monthlyResult), cash: N(x.cashEnd) });
      hist += `<tr><td>${MN(i)}</td><td class="num">${eur(N(x.turnover))}</td><td class="num">${eur(N(x.monthlyResult))}</td><td class="num">${eur(N(x.cumResult))}</td><td class="num">${eur(N(x.cashEnd))}</td><td class="num">${fmt(N(x.score))}</td><td class="num">${fmt(N(x.avgScore))}</td><td class="num">${fmt(N(x.totalScore))}</td></tr>`;
    }
    // Indices
    let idxRows = "";
    for (let i = 1; i <= total; i++) {
      for (const p of E.productsFor(state, i)) {
        const vals = C.map((c) => E.index(state, i, c.k, p.k));
        if (vals.every((v) => v === null)) continue;
        idxRows += `<tr><td>${MN(i)}</td><td>${p.label}</td>${vals.map((v) => `<td>${idxTag(v)}</td>`).join("")}</tr>`;
      }
    }
    return `${head("Tableau de bord", "Où tu en es, ce que disent tes chiffres, et la prochaine étape.", impBtn("auto", ""))}
      ${setupMissing ? `<div class="card hl"><h3>Commence par paramétrer ta session</h3><p class="hint">Glisse une capture de l'onglet Settings, du guide (besoins clients, calcul du score) et de la liste des équipes de l'Email Box : l'outil remplit tout seul ton identifiant, le nombre de distributeurs, les fourchettes et les besoins.</p><div class="row">${impBtn("settings", "", "Importer mes captures de paramètres")}<button class="btn" data-act="go" data-view="settings">Saisir à la main</button></div></div>` : ""}
      <div class="lead"><strong>${MN(m)}, ${phase === 1 ? "planification" : phase === 2 ? "ventes et achats" : "résultats"}.</strong> ${esc(E.lead(state, m))}<div style="margin-top:10px"><button class="btn small primary" data-act="go" data-view="${curView()}">Ouvrir l'étape en cours</button></div></div>
      <div class="kpis">
        ${k(last ? `Résultat de ${MN(last.m)}` : "Résultat du mois", eur(N(r.monthlyResult)), cls(r.monthlyResult))}
        ${k("Résultat cumulé", eur(N(r.cumResult)), cls(r.cumResult))}
        ${k("Trésorerie fin de mois", eur(N(r.cashEnd)), cls(r.cashEnd))}
        ${k("Prévision trésorerie M+1", eur(N(r.cashM1)), cls(r.cashM1))}
        ${k("Score total", fmt(N(r.totalScore)))}
        ${k("Score du mois / moyenne", `${fmt(N(r.score))} / ${fmt(N(r.avgScore))}`)}
      </div>
      ${series.length >= 2 ? `<div class="card"><h3>Résultat mensuel et trésorerie</h3>${chartSVG(series)}</div>` : ""}
      <div class="card"><h3>Historique</h3>${hist ? `<div class="tbl-wrap"><table><tr><th>Mois</th><th class="num">CA</th><th class="num">Résultat</th><th class="num">Cumulé</th><th class="num">Trésorerie fin</th><th class="num">Score</th><th class="num">Moyenne</th><th class="num">Total</th></tr>${hist}</table></div>` : `<p class="empty">Rien encore. Après chaque mois, glisse tes captures de résultats dans l'étape Résultats.</p>`}</div>
      <div class="card"><h3>Tes indices d'attractivité</h3><p class="hint">Demande reçue divisée par le besoin du guide. Au-dessus de 1,3 tu es plus attractif que la moyenne (monte tes prix si tu es en rupture), sous 0,7 les autres sont moins chers.</p>${idxRows ? `<div class="tbl-wrap"><table><tr><th>Mois</th><th>Produit</th>${C.map((c) => `<th>${c.label}</th>`).join("")}</tr>${idxRows}</table></div>` : `<p class="empty">Les indices apparaîtront dès que tu auras saisi ta demande reçue en phase 2.</p>`}</div>`;
  }

  function chartSVG(series) {
    const W = 760, H = 220, L = 70, R = 20, T = 20, B = 30;
    const vals = series.flatMap((s) => [s.res, s.cash]).filter((v) => v !== null);
    if (!vals.length) return "";
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    if (lo === hi) hi = lo + 1;
    const x = (i) => L + (series.length === 1 ? 0 : (i * (W - L - R)) / (series.length - 1));
    const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const line = (key, color) => {
      const pts = series.map((s, i) => (s[key] === null ? null : `${x(i)},${y(s[key])}`)).filter(Boolean);
      return `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${pts.join(" ")}"/>` + series.map((s, i) => (s[key] === null ? "" : `<circle cx="${x(i)}" cy="${y(s[key])}" r="4" fill="${color}"><title>${MN(s.m)} : ${eur(s[key])}</title></circle>`)).join("");
    };
    const zero = `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#4a6a5e" stroke-dasharray="4 4"/><text x="${L - 8}" y="${y(0) + 4}" text-anchor="end">0 €</text>`;
    const labels = series.map((s, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${MN(s.m).slice(0, 4)}</text>`).join("");
    const ticks = [hi, lo].map((v) => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v / 1000)} k€</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Résultat mensuel et trésorerie par mois" style="width:100%;height:auto">${zero}${ticks}${labels}${line("cash", "#8cc49a")}${line("res", "#e0a95a")}</svg><div class="row" style="font-size:13px;color:var(--muted)"><span><b style="color:#e0a95a">●</b> Résultat mensuel</span><span><b style="color:#8cc49a">●</b> Trésorerie fin de mois</span></div>`;
  }

  /* ---------- Phase 1 ---------- */
  function viewP1(m) {
    const mo = E.month(state, m);
    const prods = E.productsFor(state, m);
    const nat = E.isNat(state, m);
    let rows = "";
    for (const p of prods) {
      rows += `<tr><th>${p.label}</th>` + C.map((c) => {
        const r = E.recoPrice(state, m, c.k, p.k);
        const [lo, hi] = E.range(state, c.k, p.k);
        return `<td><div class="cell" title="${esc(r.reason)}">${inNum(`months.${m}.p1.prices.${c.k}.${p.k}`, r.price)}<small>Reco <b>${r.price} €</b>, fourchette ${lo} à ${hi}</small></div></td>`;
      }).join("") + `</tr>`;
    }
    const reasons = prods.map((p) => C.map((c) => ({ c, p, r: E.recoPrice(state, m, c.k, p.k) }))).flat().filter((x) => x.r.reason && !/ouverture|inchangé/i.test(x.r.reason)).slice(0, 8);
    const rt = E.recoTerms(state, m);
    const rm = E.recoMarketing(state, m);
    const est = E.estimate(state, m, false), estR = E.estimate(state, m, true);
    const hasPrices = C.some((c) => N(E.get(mo, ["p1", "prices", c.k, "mixed"], null)) !== null);
    const termLabel = (k) => (E.TERMS.find((t) => t.k === k) || {}).label || k;
    const mktLabel = (k) => (E.MKT.find((t) => t.k === k) || {}).label || k;
    const ca = estR.ca;
    const mcost = E.marketingCost(state, m);
    return `${head(`${MN(m)}, phase 1 : planification`, "Prix, délais et publicité par client. Tout ce que tu saisis ici ne vaut que pour ce mois.", impBtn("p1", m, "Importer l'écran Planning"))}
      <div class="lead">${esc(E.lead(state, m))}</div>
      <div class="card"><h3>Tes prix (€ par lot)</h3><p class="hint">La reco tient compte de ton indice du mois dernier. Survole une case pour voir la raison.</p>
        <div class="tbl-wrap"><table><tr><th>Produit</th>${C.map((c) => `<th>${c.label}</th>`).join("")}</tr>${rows}</table></div>
        ${reasons.length ? `<ul class="antic" style="margin-top:10px">${reasons.map((x) => `<li>${x.c.label} ${x.p.label} : ${esc(x.r.reason)}</li>`).join("")}</ul>` : ""}
        <div class="row" style="margin-top:12px"><button class="btn" data-act="apply-prices" data-m="${m}">Appliquer les prix conseillés</button></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>Délais de paiement clients</h3><p class="hint">Reco : ${esc(rt.why)}.</p>
          <table>${C.map((c) => `<tr><th>${c.label}</th><td>${sel(`months.${m}.p1.terms.${c.k}`, [{ k: "", label: "Choisir" }].concat(E.TERMS), "")}</td><td><small style="color:var(--muted)">Reco : ${termLabel(rt[c.k])}</small></td></tr>`).join("")}</table>
          <div class="row" style="margin-top:12px"><button class="btn" data-act="apply-terms" data-m="${m}">Appliquer les délais conseillés</button></div>
        </div>
        <div class="card"><h3>${nat ? "Marketing" : "Publicité produit"}</h3><p class="hint">Reco : ${esc(rm.why)}.</p>
          <label class="f">Pub produit (€, globale)${inNum(`months.${m}.p1.adProduct`, rm.adProduct)}</label>
          ${nat ? `<table style="margin-top:10px">${C.map((c) => `<tr><th>${c.label}</th><td>${sel(`months.${m}.p1.marketing.${c.k}`, E.MKT.map((x) => ({ k: x.k, label: x.cost ? `${x.label} (${fmt(x.cost)} €)` : x.label })), "none")}</td><td><small style="color:var(--muted)">Reco : ${mktLabel(rm.targeted[c.k])}</small></td></tr>`).join("")}</table>` : ""}
          <p class="hint" style="margin-top:10px">Coût marketing saisi : <b>${eur(mcost)}</b>, soit ${ca ? fmt((mcost / ca) * 100, 1) : "-"} % du CA attendu.</p>
          <div class="row"><button class="btn" data-act="apply-mkt" data-m="${m}">Appliquer la reco marketing</button></div>
        </div>
      </div>
      <div class="card"><h3>Résultat estimé du mois</h3><p class="hint">Estimation à partir des besoins du guide, de ton indice du mois dernier et de tes coûts. Elle sert à comparer, pas à prédire au centime.</p>
        <table><tr><th></th><th class="num">Tes saisies</th><th class="num">Avec les recos</th></tr>
        <tr><td>Chiffre d'affaires attendu</td><td class="num">${hasPrices ? eur(est.ca) : "-"}</td><td class="num">${eur(estR.ca)}</td></tr>
        <tr><td>Marge brute</td><td class="num">${hasPrices ? eur(est.margin) : "-"}</td><td class="num">${eur(estR.margin)}</td></tr>
        <tr><td>Marketing</td><td class="num">${eur(est.marketing)}</td><td class="num">${eur(estR.marketing)}</td></tr>
        <tr><td>Charges fixes (salaires + admin)</td><td class="num">${eur(est.fixed)}</td><td class="num">${eur(estR.fixed)}</td></tr>
        <tr><th>Résultat estimé</th><th class="num">${hasPrices ? eur(est.result) : "-"}</th><th class="num">${eur(estR.result)}</th></tr></table>
      </div>
      ${checklistCard(m, 1)}`;
  }

  function checklistCard(m, phase) {
    const items = E.checklist(state, m, phase);
    const key = phase === 1 ? "p1" : "p2";
    return `<div class="card"><h3>Checklist de la phase</h3>${items.map((t, i) => chk(`months.${m}.${key}.check.${i}`, t)).join("")}
      <div style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">${chk(`months.${m}.${key}.done`, phase === 1 ? "Phase 1 validée dans le simulateur" : "Phase 2 validée dans le simulateur")}</div>
      <div class="row" style="margin-top:10px">${phase === 1 ? `<button class="btn primary" data-act="go" data-view="m${m}p2">Passer à la phase 2</button>` : `<button class="btn primary" data-act="go" data-view="m${m}r">Passer aux résultats</button>`}</div></div>`;
  }

  /* ---------- Phase 2 ---------- */
  function viewP2(m) {
    const mo = E.month(state, m);
    const prods = E.productsFor(state, m);
    const nat = E.isNat(state, m);
    const stockKeys = nat ? ["mixed", "A", "B", "C", "Q1", "Q2", "Q3", "Q4"] : ["mixed"];
    const label = (k) => ({ mixed: "Agglomérés", A: "Espagne A (non trié)", B: "Espagne B (non trié)", C: "Espagne C (non trié)" }[k] || k);
    // Demande
    let dem = "";
    for (const p of prods) {
      const dt = E.demandTotal(state, m, p.k), st = E.availableStock(state, m, p.k);
      dem += `<tr><th>${p.label}</th>` + C.map((c) => `<td><div class="cell">${inNum(`months.${m}.p2.demand.${c.k}.${p.k}`, "")}<small>Besoin ${fmt(E.need(state, m, c.k, p.k))} ${idxTag(E.index(state, m, c.k, p.k))}</small></div></td>`).join("") + `<td class="num">${fmt(dt)} / ${fmt(st)}</td></tr>`;
    }
    // Tri
    let sortCard = "";
    if (nat) {
      const out = E.sortedOutput(state, m);
      const sortTotal = ["A", "B", "C"].reduce((s, o) => s + (N(E.get(mo, ["p2", "sort", o], 0)) || 0), 0);
      const q4Need = Math.max(0, (E.demandTotal(state, m, "Q4") || 0) - (E.stockOf(state, m, "Q4") || 0));
      const yA = (N(state.settings.yields.A[3]) || 25) / 100;
      const sugA = Math.min(E.stockOf(state, m, "A") || 0, Math.ceil(q4Need / yA));
      sortCard = `<div class="card"><h3>Tri des naturels</h3><p class="hint">Trie ce que tu vends ce mois-ci plus une petite marge, garde le reste non trié (plus facile à revendre). Coût ${fmt(state.settings.sortCost)} € par lot, capacité ${fmt(state.settings.sortCap)} lots.</p>
        <div class="fields">${["A", "B", "C"].map((o) => `<label class="f">Lots ${label(o)} à trier${inNum(`months.${m}.p2.sort.${o}`, "")}</label>`).join("")}</div>
        <p class="hint" style="margin-top:10px">Sortie : Q1 ${fmt(out.Q1)}, Q2 ${fmt(out.Q2)}, Q3 ${fmt(out.Q3)}, Q4 ${fmt(out.Q4)}. Coût du tri : ${eur(sortTotal * (N(state.settings.sortCost) || 2))}.${sortTotal > (N(state.settings.sortCap) || 20000) ? ` <b style="color:var(--wine)">Au-dessus de la capacité de la trieuse.</b>` : ""}</p>
        ${q4Need ? `<p class="hint">Pour couvrir ta demande Q4 restante (${fmt(q4Need)} lots), il faudrait trier environ <b>${fmt(Math.ceil(q4Need / yA))}</b> lots d'Espagne A${sugA < Math.ceil(q4Need / yA) ? `, mais tu n'en as que ${fmt(E.stockOf(state, m, "A") || 0)} : sers le Q4 aux clients les plus chers` : ""}.</p>` : ""}
      </div>`;
    }
    // Répartition
    let delRows = "";
    for (const p of prods) {
      const st = E.availableStock(state, m, p.k), dl = E.delivered(state, m, p.k);
      delRows += `<tr><th>${p.label}</th>` + C.map((c) => {
        const d = N(E.get(mo, ["p2", "demand", c.k, p.k], null));
        const v = N(E.get(mo, ["p2", "deliveries", c.k, p.k], null));
        const rate = d ? Math.round(((v || 0) / d) * 100) : null;
        return `<td><div class="cell">${inNum(`months.${m}.p2.deliveries.${c.k}.${p.k}`, "")}<small>${rate === null ? "" : `Taux ${rate} %`}</small></div></td>`;
      }).join("") + `<td class="num">${fmt(st)}</td><td class="num">${fmt(Math.max(0, st - dl))}</td></tr>`;
    }
    // Achats
    const plan = E.purchasePlan(state, m);
    const buys = (state.offers || []).map((o, i) => ({ o, i })).filter(({ o }) => N(o.month) === m && o.type === "buy");
    const acc = buys.filter(({ o }) => ["accepted", "confirmed"].includes(o.status));
    const sumQ = (pk) => acc.filter(({ o }) => (pk === "nat" ? ["A", "B", "C"].includes(o.product) : o.product === pk)).reduce((s, { o }) => s + (N(o.qty) || 0), 0);
    const tRow = (lab, t) => `<tr><td>${lab}</td><td class="num">${t.anchor} €</td><td class="num">${t.target} €</td><td class="num">${t.ceiling} €</td></tr>`;
    let planHTML = "";
    if (plan.mixed) planHTML += `<p>Agglomérés pour ${MN(plan.next)} : demande attendue ${fmt(plan.mixed.expected)}, reste en stock ${fmt(plan.mixed.leftover)}, <b>à acheter environ ${fmt(plan.mixed.buy)} lots</b>. Déjà accepté : ${fmt(sumQ("mixed"))}.</p>`;
    if (plan.natural) planHTML += `<p>Naturels pour ${MN(plan.next)} : demande Q3 attendue ${fmt(plan.natural.q3Expected)}, <b>à acheter environ ${fmt(plan.natural.buyA)} lots d'Espagne A</b> (règle Q3 ÷ 0,30). Déjà accepté : ${fmt(sumQ("nat"))}.</p>`;
    planHTML += plan.notes.map((n) => `<p class="hint">${esc(n)}</p>`).join("");
    const tg = state.settings.buyTargets;
    const targets = `<table><tr><th>Produit</th><th class="num">Ancre</th><th class="num">Cible</th><th class="num">Plafond</th></tr>${tRow(m < (N(state.settings.naturalsFrom) || 3) ? "Agglomérés (avant mars)" : "Agglomérés", m < (N(state.settings.naturalsFrom) || 3) ? tg.mixedEarly : tg.mixedLate)}${E.isNat(state, m + 1) ? tRow("Espagne A", tg.A) + tRow("Espagne B", tg.B) + tRow("Espagne C", tg.C) : ""}</table>`;
    const buyList = buys.length ? `<table style="margin-top:10px"><tr><th>Industriel</th><th>Produit</th><th class="num">Qté</th><th class="num">Prix</th><th>Délai</th><th>Statut</th></tr>${buys.map(({ o }) => `<tr><td>${esc(o.counterpart || "")}</td><td>${esc(prodLabel(o.product))}</td><td class="num">${fmt(N(o.qty))}</td><td class="num">${eur(N(o.price))}</td><td>${esc(termLab(o.term))}</td><td>${esc(statusLab(o.status))}</td></tr>`).join("")}</table>` : `<p class="empty">Aucune offre d'achat enregistrée ce mois-ci.</p>`;
    // Surplus
    const leftMixed = E.leftover(state, m, "mixed");
    const myId = state.settings.myId || "D…";
    const surplusMail = `Bonjour, ici ${myId}. J'ai ${fmt(leftMixed)} lots d'agglomérés disponibles tout de suite, livraison immédiate entre distributeurs, ${Math.max(Math.ceil(E.mixedCost(state) + 6), 24)} € le lot, paiement à la commande. Premier arrivé, premier servi.`;
    return `${head(`${MN(m)}, phase 2 : ventes et achats`, "Demande reçue, tri, répartition des ventes et achats pour le mois suivant.", impBtn("p2", m, "Importer Sales, stock ou offres"))}
      <div class="card"><h3>Ton stock en début de phase 2</h3><p class="hint">Le panneau Stock for sale du simulateur (flèche bleue).</p>
        <div class="fields">${stockKeys.map((k) => `<label class="f">${label(k)}${inNum(`months.${m}.p2.stock.${k}`, "")}</label>`).join("")}</div></div>
      <div class="card"><h3>Demande reçue (onglet Sales)</h3><p class="hint">Saisis la quantité commandée par chaque client : l'indice se calcule seul. Dernière colonne : demande totale / stock disponible.</p>
        <div class="tbl-wrap"><table><tr><th>Produit</th>${C.map((c) => `<th>${c.label}</th>`).join("")}<th class="num">Total / stock</th></tr>${dem}</table></div></div>
      ${sortCard}
      <div class="card"><h3>Répartition des ventes</h3><p class="hint">Chaque produit va d'abord au client qui le paie le plus cher, jamais plus que sa commande. Recopie ensuite ces quantités dans Quantity of final products to deliver.</p>
        <div class="tbl-wrap"><table><tr><th>Produit</th>${C.map((c) => `<th>${c.label}</th>`).join("")}<th class="num">Stock dispo</th><th class="num">Reste</th></tr>${delRows}</table></div>
        <div class="row" style="margin-top:12px"><button class="btn" data-act="allocate" data-m="${m}">Proposer la répartition</button></div></div>
      <div class="card hl"><h3>Achats pour ${MN(m + 1) || "le mois suivant"}</h3>${planHTML}<div style="margin-top:8px">${targets}</div>${buyList}
        <div class="row" style="margin-top:12px"><button class="btn" data-act="go" data-view="nego">Ouvrir les négociations</button></div></div>
      ${leftMixed > 0 ? `<div class="card"><h3>Revendre ton surplus</h3><p class="hint">${fmt(leftMixed)} lots d'agglomérés restent après tes ventes. Les distributeurs à court peuvent les recevoir immédiatement.</p><div class="mail">${esc(surplusMail)}</div><button class="btn small" data-act="copy" data-text="${esc(surplusMail)}">Copier le mail</button></div>` : ""}
      ${checklistCard(m, 2)}`;
  }

  /* ---------- Résultats ---------- */
  const RES_FIELDS = [
    ["turnover", "Chiffre d'affaires"], ["monthlyResult", "Résultat du mois"], ["cumResult", "Résultat cumulé"],
    ["cashStart", "Trésorerie début de mois"], ["cashEnd", "Trésorerie fin de mois"], ["cashM1", "Prévision trésorerie M+1"], ["cashM2", "Prévision trésorerie M+2"],
    ["inflows", "Encaissements"], ["outflows", "Décaissements"], ["marketingCosts", "Coûts marketing"], ["stockValue", "Valeur du stock"],
    ["score", "Score du mois"], ["avgScore", "Score moyen"], ["totalScore", "Score total"], ["rank", "Classement"]
  ];
  function viewResults(m) {
    const mo = E.month(state, m);
    return `${head(`${MN(m)} : résultats`, "Glisse tes captures du classement, du compte de résultat, de la trésorerie et du bilan : tout se remplit.", impBtn("results", m, "Importer mes résultats"))}
      <div class="card"><h3>Les chiffres du mois</h3><div class="fields">${RES_FIELDS.map(([k, l]) => `<label class="f">${l}${inNum(`months.${m}.results.${k}`, "")}</label>`).join("")}</div></div>
      <div class="card hl"><h3>Débrief et plan du mois suivant</h3><p class="hint">L'IA relit toute ta partie (prix, demande, indices, achats, négos, résultats) et te sort le plan chiffré du mois prochain.</p>
        <div class="row"><button class="btn primary" data-act="analyze" data-m="${m}" ${ui.analyzeBusy ? "disabled" : ""}>${ui.analyzeBusy ? "Analyse en cours…" : mo.analysis ? "Relancer l'analyse" : "Analyser le mois"}</button>${ui.analyzeBusy ? `<span class="spinner"></span>` : ""}</div>
        ${mo.analysis ? `<div class="ai-out" style="margin-top:14px">${md(mo.analysis)}</div>` : ""}</div>
      <div class="card"><h3>Ce que j'ai compris ce mois-ci</h3><textarea data-path="months.${m}.notes" data-type="text" placeholder="Ce qui a marché, ce que font les autres, ce que t'a dit le formateur au débrief…">${esc(mo.notes || "")}</textarea></div>
      ${m < (N(state.settings.months) || 6) ? `<div class="row"><button class="btn primary" data-act="go" data-view="m${m + 1}p1">Passer à ${MN(m + 1)}</button></div>` : ""}`;
  }

  /* ---------- Négociations ---------- */
  const PRODS_ALL = [{ k: "mixed", label: "Agglomérés" }, { k: "A", label: "Espagne A" }, { k: "B", label: "Espagne B" }, { k: "C", label: "Espagne C" }, { k: "Q1", label: "Q1" }, { k: "Q2", label: "Q2" }, { k: "Q3", label: "Q3" }, { k: "Q4", label: "Q4" }];
  const STATUS = [{ k: "pending", label: "En attente" }, { k: "accepted", label: "Acceptée" }, { k: "refused", label: "Refusée" }, { k: "cancelled", label: "Annulée" }];
  const prodLabel = (k) => (PRODS_ALL.find((p) => p.k === k) || { label: k || "" }).label;
  const termLab = (k) => (E.TERMS.find((t) => t.k === String(k)) || { label: k || "" }).label;
  const statusLab = (k) => (STATUS.find((t) => t.k === k) || { label: k === "confirmed" ? "Confirmée" : k || "" }).label;

  function viewNego() {
    const total = N(state.settings.months) || 6;
    const mOpts = Array.from({ length: total }, (_, i) => ({ k: i + 1, label: MN(i + 1) }));
    const offers = (state.offers || []).map((o, i) => ({ o, i })).sort((a, b) => (N(b.o.month) || 0) - (N(a.o.month) || 0) || (b.o.t || 0) - (a.o.t || 0));
    const rows = offers.map(({ o, i }) => {
      const j = o.type === "sell" ? E.judgeSell(state, N(o.month), o.product, o.price) : E.judgeBuy(state, N(o.month), o.product, o.price);
      const vt = j ? `<span class="tag ${j.verdict === "ok" ? "good" : j.verdict === "nego" ? "mid" : "bad"}">${esc(j.label)}</span>${j.counter ? `<br><small style="color:var(--muted)">Contre-offre : ${j.counter} €</small>` : ""}` : "";
      const p = (f) => `offers.${i}.${f}`;
      return `<tr><td>${sel(p("month"), mOpts, state.current.m)}</td><td>${sel(p("dir"), [{ k: "in", label: "Reçue" }, { k: "out", label: "Envoyée" }], "in")}</td><td>${inText(p("counterpart"), "I1_…")}</td><td>${sel(p("type"), [{ k: "buy", label: "Achat" }, { k: "sell", label: "Vente" }], "buy")}</td><td>${sel(p("product"), PRODS_ALL, "mixed")}</td><td>${inNum(p("qty"), "")}</td><td>${inNum(p("price"), "")}</td><td>${sel(p("term"), E.TERMS, "60")}</td><td>${sel(p("status"), STATUS, "pending")}</td><td style="min-width:150px">${vt}</td><td><button class="btn small ghost" data-act="del-offer" data-i="${i}" aria-label="Supprimer">Suppr.</button></td></tr>`;
    }).join("");
    const myId = state.settings.myId || "D…";
    const mails = [
      ["Ouverture, à tous les industriels", `Bonjour, ici ${myId}, distributeur. Je cherche un ou deux partenaires fiables sur plusieurs mois. Pour préparer, pouvez-vous m'indiquer votre stock disponible et vos conditions ? Je reviens vers vous avant la fin de la phase.`],
      ["Appel d'offres (mars)", `Bonjour, je lance une consultation pour avril : 4 000 lots d'Espagne A, paiement 60 jours après livraison. Je retiens les deux meilleures propositions reçues avant [heure]. Je suis prêt à m'engager sur avril, mai et juin avec le partenaire retenu.`],
      ["Les trois options, à ton favori", `Je te propose trois formules au choix pour 3 000 lots d'A : 50 € à 60 jours ; 46 € payés à la livraison ; 44 € si on s'engage aussi sur mai et juin. Dis-moi celle qui t'arrange.`],
      ["Accord écrit (preuve en cas de litige)", `Pour confirmer notre accord : ${myId} achète [quantité] lots de [produit] à [prix] € le lot, paiement [délai], livraison [mois]. Si l'offre n'est pas envoyée dans le simulateur avant la fin de la phase, l'accord tombe. Merci de me confirmer par retour.`]
    ];
    const teams = (state.settings.teams || []).filter((t) => /^I/i.test(t) || /^D/i.test(t));
    const seen = Array.from(new Set(teams.concat((state.offers || []).map((o) => o.counterpart).filter((x) => x && x !== "Externe"))));
    return `${head("Négociations", "Chaque offre reçue ou envoyée, avec le verdict de l'outil par rapport à tes repères (ancre, cible, plafond).", impBtn("nego", state.current.m, "Importer l'écran des offres"))}
      <div class="card"><h3>Ajouter une offre</h3>
        <div class="fields">
          <label class="f">Mois<select id="of-month">${mOpts.map((o) => `<option value="${o.k}" ${o.k === state.current.m ? "selected" : ""}>${o.label}</option>`).join("")}</select></label>
          <label class="f">Sens<select id="of-dir"><option value="in">Reçue</option><option value="out">Envoyée</option></select></label>
          <label class="f">Contrepartie<input type="text" id="of-cp" placeholder="I1_41240" list="teams-list"></label>
          <label class="f">Type<select id="of-type"><option value="buy">Achat</option><option value="sell">Vente</option></select></label>
          <label class="f">Produit<select id="of-prod">${PRODS_ALL.map((p) => `<option value="${p.k}">${p.label}</option>`).join("")}</select></label>
          <label class="f">Quantité<input type="text" inputmode="decimal" class="in-num" id="of-qty"></label>
          <label class="f">Prix unitaire<input type="text" inputmode="decimal" class="in-num" id="of-price"></label>
          <label class="f">Délai<select id="of-term">${E.TERMS.map((t) => `<option value="${t.k}" ${t.k === "60" ? "selected" : ""}>${t.label}</option>`).join("")}</select></label>
          <label class="f">Statut<select id="of-status">${STATUS.map((t) => `<option value="${t.k}">${t.label}</option>`).join("")}</select></label>
        </div>
        <datalist id="teams-list">${seen.map((t) => `<option value="${esc(t)}">`).join("")}</datalist>
        <div class="row" style="margin-top:12px"><button class="btn primary" data-act="add-offer">Ajouter</button></div></div>
      <div class="card"><h3>Toutes les offres</h3>${rows ? `<div class="tbl-wrap"><table class="offers-tbl"><tr><th>Mois</th><th>Sens</th><th>Contrepartie</th><th>Type</th><th>Produit</th><th>Qté</th><th>Prix</th><th>Délai</th><th>Statut</th><th>Verdict</th><th></th></tr>${rows}</table></div>` : `<p class="empty">Aucune offre. Ajoute-les à la main ou glisse une capture de l'écran Negotiations.</p>`}</div>
      <div class="grid2">
        <div class="card"><h3>Mails prêts à envoyer</h3>${mails.map(([t, txt]) => `<p style="margin:10px 0 0;font-weight:600">${esc(t)}</p><div class="mail">${esc(txt)}</div><button class="btn small" data-act="copy" data-text="${esc(txt)}">Copier</button>`).join("")}</div>
        <div class="card"><h3>Tes partenaires</h3><p class="hint">Note ce que tu apprends sur chacun : stock, cash, fiabilité, prix pratiqués.</p>${seen.length ? seen.map((t) => `<label class="f" style="margin-bottom:10px">${esc(t)}${inText(`partners.${t.replace(/[^\w-]/g, "_")}.note`, "Stock A ? trésorerie ? fiable ?")}</label>`).join("") : `<p class="empty">Ajoute la liste des équipes dans Paramètres (ou importe une capture de l'Email Box).</p>`}</div>
      </div>`;
  }

  /* ---------- Paramètres ---------- */
  function viewSettings() {
    const s = state.settings;
    const total = N(s.months) || 6;
    const nm = Math.min(Math.max(1, ui.needsM), 10);
    const cost = E.mixedCost(state);
    const rangeRows = E.PRODUCTS.map((p) => `<tr><th>${p.label}</th>${C.map((c) => `<td><div class="row" style="flex-wrap:nowrap;gap:6px">${inNum(`settings.ranges.${c.k}.${p.k}.0`, "")}${inNum(`settings.ranges.${c.k}.${p.k}.1`, "")}</div></td>`).join("")}</tr>`).join("");
    const needRows = E.PRODUCTS.map((p) => `<tr><th>${p.label}</th>${C.map((c) => `<td>${inNum(`settings.needs.${nm}.${c.k}.${p.k}`, "")}</td>`).join("")}</tr>`).join("");
    const yRows = ["A", "B", "C"].map((o) => `<tr><th>Espagne ${o}</th>${[0, 1, 2, 3].map((i) => `<td>${inNum(`settings.yields.${o}.${i}`, "")}</td>`).join("")}</tr>`).join("");
    const tg = [["mixedEarly", "Agglomérés jan-fév"], ["mixedLate", "Agglomérés dès mars"], ["A", "Espagne A"], ["B", "Espagne B"], ["C", "Espagne C"]];
    return `${head("Paramètres de la session", "Tout ce qui sert aux calculs. Les valeurs par défaut viennent des vidéos Sciado : remplace-les par celles de ta session.", impBtn("settings", "", "Importer Settings, guide ou Email Box"))}
      <div class="grid2">
        <div class="card"><h3>Ta session</h3><div class="fields">
          <label class="f">Ton identifiant${inText("settings.myId", "D2_42140")}</label>
          <label class="f">Nombre de distributeurs${inNum("settings.nDist", "")}</label>
          <label class="f">Nombre d'industriels${inNum("settings.nInd", "")}</label>
          <label class="f">Nombre de mois joués${inNum("settings.months", 6)}</label>
          <label class="f">Naturels à partir du mois${inNum("settings.naturalsFrom", 3)}</label>
        </div>
        <label class="f" style="margin-top:12px">Équipes (séparées par des virgules)<input type="text" data-path="settings.teams" data-type="list" value="${esc((s.teams || []).join(", "))}" placeholder="D1_..., D2_..., I1_..."></label></div>
        <div class="card"><h3>Ton stock de départ et tes coûts</h3><div class="fields">
          <label class="f">Stock de départ (lots)${inNum("settings.startStock", 12000)}</label>
          <label class="f">Valeur de ce stock (€)${inNum("settings.startStockValue", "voir le bilan")}</label>
          <label class="f">Coût d'achat agglo par défaut${inNum("settings.mixedCost", 20)}</label>
          <label class="f">Prix d'achat A${inNum("settings.naturalCost.A", 55)}</label>
          <label class="f">Prix d'achat B${inNum("settings.naturalCost.B", 60)}</label>
          <label class="f">Prix d'achat C${inNum("settings.naturalCost.C", 65)}</label>
        </div><p class="hint" style="margin-top:10px">Coût de revient agglo utilisé : <b>${fmt(cost, 2)} €</b> par lot. Tu ne vends jamais en dessous.</p></div>
      </div>
      <div class="card"><h3>Charges</h3><div class="fields">
        <label class="f">Salaires jan-fév${inNum("settings.fixed.wages", 40000)}</label>
        <label class="f">Salaires dès les naturels${inNum("settings.fixed.wagesNat", 150000)}</label>
        <label class="f">Frais administratifs${inNum("settings.fixed.admin", 20000)}</label>
        <label class="f">Stockage (% de la valeur)${inNum("settings.fixed.storagePct", 0.33)}</label>
      </div></div>
      <div class="card"><h3>Fourchettes de prix clients (min, max)</h3><div class="tbl-wrap"><table><tr><th>Produit</th>${C.map((c) => `<th>${c.label}</th>`).join("")}</tr>${rangeRows}</table></div></div>
      <div class="card"><h3>Besoins du guide, par distributeur</h3><p class="hint">Sert à calculer tes indices. Choisis le mois.</p>
        <div class="row" style="margin-bottom:10px">${Array.from({ length: total }, (_, i) => `<button class="step ${nm === i + 1 ? "on" : ""}" data-act="needs-m" data-m="${i + 1}">${MN(i + 1)}</button>`).join("")}</div>
        <div class="tbl-wrap"><table><tr><th>Produit</th>${C.map((c) => `<th>${c.label}</th>`).join("")}</tr>${needRows}</table></div></div>
      <div class="grid2">
        <div class="card"><h3>Trieuse</h3><table><tr><th></th><th>Q1 %</th><th>Q2 %</th><th>Q3 %</th><th>Q4 %</th></tr>${yRows}</table>
          <div class="fields" style="margin-top:10px"><label class="f">Coût par lot${inNum("settings.sortCost", 2)}</label><label class="f">Capacité mensuelle${inNum("settings.sortCap", 20000)}</label></div></div>
        <div class="card"><h3>Repères d'achat</h3><table><tr><th></th><th>Ancre</th><th>Cible</th><th>Plafond</th></tr>${tg.map(([k, l]) => `<tr><th>${l}</th>${["anchor", "target", "ceiling"].map((f) => `<td>${inNum(`settings.buyTargets.${k}.${f}`, "")}</td>`).join("")}</tr>`).join("")}</table></div>
      </div>
      <div class="card"><h3>Calcul du score (guide utilisateur)</h3><p class="hint">Recopie ou importe la règle exacte : le coach IA s'en servira pour prioriser.</p><textarea data-path="settings.scoreNotes" data-type="text" placeholder="Ex. résultat mensuel x2, -10 points par mois de trésorerie négative…">${esc(s.scoreNotes || "")}</textarea></div>
      <div class="card"><h3>Données</h3><p class="hint">Tout est sauvegardé dans ce navigateur. Exporte un fichier pour changer d'ordinateur ou par sécurité.</p>
        <div class="row"><button class="btn" data-act="export">Exporter (fichier)</button><button class="btn" data-act="import-file">Importer un fichier</button><button class="btn" data-act="ping">Tester la connexion IA</button><span class="spacer"></span><button class="btn ghost" data-act="reset">Tout effacer</button></div></div>`;
  }

  /* ---------- Journal ---------- */
  function viewJournal() {
    const items = (state.journal || []).slice().reverse();
    return `${head("Journal", "Ce que tu observes, ce que t'apprennent les mails et les débriefs. Le coach IA le lit.", "")}
      <div class="card"><textarea id="j-text" placeholder="Ex. I2 a l'air à court de cash, il a baissé son A à 47 € en fin de phase."></textarea><div class="row" style="margin-top:10px"><button class="btn primary" data-act="add-journal">Ajouter au journal</button></div></div>
      <div class="card">${items.length ? items.map((j) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><small style="color:var(--muted)">${esc(j.when || "")}${j.m ? `, ${MN(j.m)}` : ""}</small><div>${md(j.text)}</div></div>`).join("") : `<p class="empty">Journal vide.</p>`}</div>`;
  }

  /* ---------- Coach ---------- */
  function renderCoach() {
    const el = document.getElementById("coach");
    const { m, phase } = state.current;
    const ph = phase === 3 ? 2 : phase;
    E.month(state, m);
    const items = E.checklist(state, m, ph);
    const key = ph === 1 ? "p1" : "p2";
    const checks = state.months[m][key].check || {};
    const nextI = items.findIndex((t, i) => !checks[i]);
    const al = E.alerts(state, m, ph);
    const an = E.anticipate(state, m);
    const log = (state.chat || []).slice(-30).map((x) => `<div class="msg ${x.role}">${x.role === "assistant" ? md(x.content) : esc(x.content)}</div>`).join("");
    const draft = ui.chatDraft;
    el.innerHTML = `<div class="coach-head"><div class="row"><h2>Coach, ${MN(m)} ${phase === 1 ? "phase 1" : phase === 2 ? "phase 2" : "résultats"}</h2><span class="spacer"></span><button class="btn small ghost coach-toggle" data-act="toggle-coach">Fermer</button></div>
        <div class="next"><small>Prochaine action</small>${nextI >= 0 ? esc(items[nextI]) : "Checklist terminée pour cette phase."}</div></div>
      <div class="coach-body">
        <div class="coach-sec"><h3>À faire maintenant</h3>${items.map((t, i) => chk(`months.${m}.${key}.check.${i}`, t)).join("")}</div>
        <div class="coach-sec"><h3>Attention</h3>${al.length ? al.map((a) => `<div class="alert ${a.lvl}">${esc(a.t)}</div>`).join("") : `<p class="empty">Rien à signaler pour l'instant.</p>`}</div>
        <div class="coach-sec"><h3>À anticiper</h3>${an.length ? `<ul class="antic">${an.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : `<p class="empty">Rien de particulier.</p>`}</div>
      </div>
      <div class="chat">
        <div class="chat-log" id="chat-log">${log || `<p class="empty" style="font-size:13px">Pose une question au coach IA : il connaît ta stratégie et toutes tes données. Tu peux coller une capture (Ctrl+V) dans le champ.</p>`}${ui.chatBusy ? `<div class="row"><span class="spinner"></span><small style="color:var(--muted)">Le coach réfléchit…</small></div>` : ""}</div>
        <div class="quick">${["Vérifie mes saisies de cette phase", "Que dois-je faire maintenant ?", "Prépare ma prochaine négo", "Plan pour le mois prochain"].map((q) => `<button data-act="quick" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
        ${ui.chatAttach.length ? `<div class="attach-thumbs">${ui.chatAttach.map((f, i) => `<img src="${f.url}" alt="Capture jointe ${i + 1}">`).join("")}<button class="btn small ghost" data-act="chat-clear-attach">Retirer</button></div>` : ""}
        <div class="chat-in"><textarea id="chat-input" placeholder="Ta question, ou colle une capture…" ${ui.chatBusy ? "disabled" : ""}>${esc(draft)}</textarea><button class="btn primary" data-act="chat-send" ${ui.chatBusy ? "disabled" : ""}>Envoyer</button></div>
        <div class="row"><button class="btn small ghost" data-act="chat-attach">Joindre une capture</button>${(state.chat || []).length ? `<button class="btn small ghost" data-act="chat-reset">Nouvelle conversation</button>` : ""}</div>
      </div>`;
    const lg = document.getElementById("chat-log");
    if (lg) lg.scrollTop = lg.scrollHeight;
  }

  /* ---------- IA ---------- */
  async function api(payload) {
    const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    let j;
    try { j = await r.json(); } catch (e) { j = { error: r.status === 413 ? "Captures trop lourdes : envoie-en moins à la fois." : `Réponse illisible du serveur (${r.status}).` }; }
    if (!r.ok || j.error) throw new Error(j.error || `Erreur ${r.status}`);
    return j;
  }

  async function sendChat(text) {
    text = (text || "").trim();
    if (!text && !ui.chatAttach.length) return;
    state.chat.push({ role: "user", content: text || "Regarde cette capture et dis-moi quoi en faire.", t: Date.now() });
    ui.chatDraft = "";
    ui.chatBusy = true;
    save();
    renderCoach();
    try {
      const msgs = state.chat.filter((x) => !x.err).slice(-14).map((x) => ({ role: x.role, content: x.content }));
      const j = await api({ action: "coach", messages: msgs, state: E.summary(state), images: ui.chatAttach.map((f) => ({ mediaType: f.mediaType, data: f.data })) });
      state.chat.push({ role: "assistant", content: j.text || "(réponse vide)", t: Date.now() });
    } catch (e) {
      state.chat.push({ role: "assistant", content: `Erreur : ${e.message}`, t: Date.now(), err: true });
    }
    ui.chatAttach = [];
    ui.chatBusy = false;
    save();
    renderCoach();
  }

  async function analyze(m) {
    ui.analyzeBusy = true;
    render();
    try {
      const j = await api({ action: "analyze", m, state: E.summary(state) });
      E.month(state, m).analysis = j.text;
    } catch (e) {
      toast(`Analyse impossible : ${e.message}`);
    }
    ui.analyzeBusy = false;
    save();
    render();
  }

  /* ---------- Fichiers et captures ---------- */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 2000;
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = c.toDataURL("image/jpeg", 0.88);
        URL.revokeObjectURL(url);
        resolve({ kind: "image", mediaType: "image/jpeg", data: d.split(",")[1], url: d, name: file.name || "capture" });
      };
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = url;
    });
  }
  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(",")[1]);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
  }
  async function addFiles(list, toChat) {
    for (const f of Array.from(list || [])) {
      try {
        if (f.type.startsWith("image/")) {
          const img = await compressImage(f);
          (toChat ? ui.chatAttach : ui.imp.files).push(img);
        } else if (f.type === "application/pdf" && !toChat) {
          if (f.size > 3.2e6) { toast("PDF trop lourd (3 Mo max) : fais plutôt des captures."); continue; }
          ui.imp.files.push({ kind: "pdf", data: await readBase64(f), name: f.name });
        } else if (f.type.startsWith("text/") && !toChat) {
          ui.imp.text += (ui.imp.text ? "\n\n" : "") + (await f.text());
        } else {
          toast(`Format non pris en charge : ${f.name}`);
        }
      } catch (e) { toast(e.message); }
    }
    if (toChat) renderCoach(); else renderModal();
  }

  function openImport(target, m) {
    ui.importOpen = true;
    ui.imp = { files: [], text: "", hint: target || "auto", m: m || state.current.m, busy: false, result: null, error: null, sel: {} };
    renderModal();
  }

  const HINTS = [
    { k: "auto", label: "Je ne sais pas, devine" }, { k: "p1", label: "Planning (prix, délais, pub)" }, { k: "p2", label: "Sales, stock, tri" },
    { k: "nego", label: "Négociations, offres" }, { k: "results", label: "Résultats (classement, compte de résultat, trésorerie, bilan)" },
    { k: "settings", label: "Settings, guide, liste des équipes" }, { k: "email", label: "Email Box" }
  ];

  function renderModal() {
    const root = document.getElementById("modal-root");
    if (!ui.importOpen) { root.innerHTML = ""; return; }
    const imp = ui.imp;
    const total = N(state.settings.months) || 6;
    const mOpts = Array.from({ length: total }, (_, i) => `<option value="${i + 1}" ${imp.m === i + 1 ? "selected" : ""}>${MN(i + 1)}</option>`).join("");
    let body;
    if (imp.busy) {
      body = `<div class="row" style="padding:30px 0"><span class="spinner"></span><span>Lecture de tes captures en cours, 10 à 40 secondes…</span></div>`;
    } else if (imp.result) {
      const secs = previewSections(imp.result);
      body = `<p class="hint">Voici ce que j'ai lu. Décoche ce qui est faux, choisis le mois, puis applique.</p>
        <label class="f" style="max-width:240px;margin-bottom:12px">Ranger dans le mois<select id="imp-m">${mOpts}</select></label>
        ${secs.length ? secs.map((s) => `<div class="preview-sec"><label class="chk"><input type="checkbox" data-imp-sel="${s.key}" ${imp.sel[s.key] !== false ? "checked" : ""}><span>${esc(s.label)}</span></label><div class="kv">${s.html}</div></div>`).join("") : `<p class="empty">Je n'ai trouvé aucune donnée exploitable. Essaie une capture plus nette ou colle le texte de la page.</p>`}
        <div class="row" style="margin-top:14px"><button class="btn primary" data-act="imp-apply" ${secs.length ? "" : "disabled"}>Appliquer</button><button class="btn" data-act="imp-restart">Recommencer</button><span class="spacer"></span><button class="btn ghost" data-act="imp-close">Fermer</button></div>`;
    } else {
      body = `<p class="hint">Glisse tes captures d'écran, colle-les (Ctrl+V), dépose un PDF, ou colle le texte de la page (Ctrl+A puis Ctrl+C dans le simulateur). L'IA lit tout et remplit l'outil ; tu vérifies avant d'appliquer.</p>
        <div class="drop" id="drop" data-act="pick-files"><b>Dépose ou colle tes captures ici</b><br><small>PNG, JPG ou PDF, plusieurs à la fois</small></div>
        ${imp.files.length ? `<div class="thumbs">${imp.files.map((f, i) => `<div class="thumb">${f.kind === "image" ? `<img src="${f.url}" alt="${esc(f.name)}">` : `<div class="pdf">PDF</div>`}<button data-act="imp-remove" data-i="${i}" aria-label="Retirer">×</button></div>`).join("")}</div>` : ""}
        <label class="f">Ou colle le texte de la page<textarea id="imp-text" placeholder="Colle ici le texte copié depuis le simulateur…">${esc(imp.text)}</textarea></label>
        <div class="fields" style="margin-top:12px"><label class="f">C'est quel écran ?<select id="imp-hint">${HINTS.map((h) => `<option value="${h.k}" ${imp.hint === h.k ? "selected" : ""}>${h.label}</option>`).join("")}</select></label><label class="f">Mois concerné<select id="imp-m">${mOpts}</select></label></div>
        ${imp.error ? `<div class="alert bad" style="margin-top:12px">${esc(imp.error)}</div>` : ""}
        <div class="row" style="margin-top:16px"><button class="btn primary" data-act="imp-run">Lire et remplir</button><span class="spacer"></span><button class="btn ghost" data-act="imp-close">Annuler</button></div>`;
    }
    root.innerHTML = `<div class="modal-bg" data-act="imp-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Importer des captures"><h2>Importer une capture</h2>${body}</div></div>`;
    const drop = document.getElementById("drop");
    if (drop) {
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("over"));
      drop.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); });
    }
    const ta = document.getElementById("imp-text");
    if (ta) ta.addEventListener("input", () => (ui.imp.text = ta.value));
    const hs = document.getElementById("imp-hint");
    if (hs) hs.addEventListener("change", () => (ui.imp.hint = hs.value));
    const ms = document.getElementById("imp-m");
    if (ms) ms.addEventListener("change", () => (ui.imp.m = +ms.value));
  }

  function batches(files) {
    const out = [];
    let cur = [], size = 0;
    for (const f of files) {
      const s = f.data.length;
      if (cur.length && (size + s > 3.4e6 || cur.length >= 5)) { out.push(cur); cur = []; size = 0; }
      cur.push(f); size += s;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function deepMerge(a, b) {
    if (b === null || b === undefined) return a;
    if (Array.isArray(b)) return (a || []).concat(b);
    if (typeof b !== "object") return b;
    const o = Object.assign({}, a || {});
    for (const k of Object.keys(b)) o[k] = deepMerge(o[k], b[k]);
    return o;
  }

  async function runImport() {
    const imp = ui.imp;
    if (!imp.files.length && !imp.text.trim()) { imp.error = "Ajoute au moins une capture, un PDF ou du texte."; renderModal(); return; }
    imp.busy = true; imp.error = null;
    renderModal();
    const hint = (HINTS.find((h) => h.k === imp.hint) || {}).label;
    const ctx = { m: imp.m, phase: state.current.phase, myId: state.settings.myId };
    try {
      let merged = {};
      const groups = imp.files.length ? batches(imp.files) : [[]];
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi];
        const payload = { action: "extract", context: ctx, hint: imp.hint === "auto" ? null : hint, text: gi === 0 ? imp.text : "", images: g.filter((f) => f.kind === "image").map((f) => ({ mediaType: f.mediaType, data: f.data })) };
        const pdf = g.find((f) => f.kind === "pdf");
        if (pdf) payload.pdf = { data: pdf.data };
        const j = await api(payload);
        merged = deepMerge(merged, j.data || {});
      }
      imp.result = merged;
      const dm = N(merged.month);
      if (dm && dm >= 1 && dm <= (N(state.settings.months) || 6)) imp.m = dm;
      imp.sel = {};
    } catch (e) {
      imp.error = e.message;
    }
    imp.busy = false;
    renderModal();
  }

  function kvList(obj) {
    return Object.entries(obj || {}).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => `${esc(k)} : ${esc(typeof v === "object" ? JSON.stringify(v) : fmt(v, 2) !== "-" ? fmt(v, 2) : v)}`).join("<br>");
  }
  function clientTable(obj) {
    return C.filter((c) => obj && obj[c.k]).map((c) => `${c.label} : ${Object.entries(obj[c.k]).map(([p, v]) => `${prodLabel(p)} ${typeof v === "number" ? fmt(v) : esc(v)}`).join(", ")}`).join("<br>");
  }
  function previewSections(d) {
    const s = [];
    const has = (o) => o && typeof o === "object" && Object.keys(o).length;
    if (has(d.stock)) s.push({ key: "stock", label: "Stock", html: kvList(d.stock) });
    if (has(d.demand)) s.push({ key: "demand", label: "Demande reçue (Sales)", html: clientTable(d.demand) });
    if (has(d.deliveries)) s.push({ key: "deliveries", label: "Quantités livrées", html: clientTable(d.deliveries) });
    if (has(d.prices) || has(d.terms) || d.adProduct !== undefined || has(d.marketing)) s.push({ key: "p1", label: "Planning (prix, délais, pub)", html: [clientTable(d.prices), d.terms ? `Délais : ${C.filter((c) => d.terms[c.k]).map((c) => `${c.label} ${termLab(d.terms[c.k])}`).join(", ")}` : "", d.adProduct !== undefined && d.adProduct !== null ? `Pub produit : ${eur(N(d.adProduct))}` : "", has(d.marketing) ? `Marketing : ${JSON.stringify(d.marketing)}` : ""].filter(Boolean).join("<br>") });
    if (has(d.sort)) s.push({ key: "sort", label: "Tri", html: kvList(d.sort) });
    if (Array.isArray(d.offers) && d.offers.length) s.push({ key: "offers", label: `Offres (${d.offers.length})`, html: d.offers.map((o) => `${o.dir === "out" ? "Envoyée à" : "Reçue de"} ${esc(o.counterpart || "?")} : ${o.type === "sell" ? "vente" : "achat"} ${prodLabel(o.product)} ${fmt(N(o.qty))} lots à ${eur(N(o.price))}, ${termLab(o.term)}, ${statusLab(o.status)}`).join("<br>") });
    if (has(d.results)) s.push({ key: "results", label: "Résultats", html: kvList(d.results) });
    if (has(d.settings)) s.push({ key: "settings", label: "Paramètres", html: Object.entries(d.settings).map(([k, v]) => `${esc(k)} : ${esc(JSON.stringify(v)).slice(0, 400)}`).join("<br>") });
    if (Array.isArray(d.emails) && d.emails.length) s.push({ key: "emails", label: `Mails (${d.emails.length}) vers le journal`, html: d.emails.map((e) => `${esc(e.from || "")} ${esc(e.subject || "")} : ${esc(e.summary || "")}`).join("<br>") });
    if (d.notes) s.push({ key: "notes", label: "Ce que l'IA a remarqué (vers le journal)", html: esc(d.notes) });
    return s;
  }

  function mergeNums(target, src) {
    for (const [k, v] of Object.entries(src || {})) {
      if (v && typeof v === "object" && !Array.isArray(v)) { target[k] = target[k] && typeof target[k] === "object" ? target[k] : {}; mergeNums(target[k], v); }
      else if (v !== null && v !== undefined && v !== "") target[k] = typeof v === "number" ? v : (N(v) !== null && !/^[a-z]/i.test(String(v)) ? N(v) : v);
    }
  }

  function applyImport() {
    const d = ui.imp.result || {};
    const m = ui.imp.m || state.current.m;
    const ok = (k) => ui.imp.sel[k] !== false;
    const mo = E.month(state, m);
    const done = [];
    if (d.stock && ok("stock")) { mergeNums(mo.p2.stock, d.stock); done.push("stock"); }
    if (d.demand && ok("demand")) { mergeNums(mo.p2.demand, d.demand); done.push("demande"); }
    if (d.deliveries && ok("deliveries")) { mergeNums(mo.p2.deliveries, d.deliveries); done.push("livraisons"); }
    if (ok("p1")) {
      if (d.prices) mergeNums(mo.p1.prices, d.prices);
      if (d.terms) for (const c of C) if (d.terms[c.k]) mo.p1.terms[c.k] = String(d.terms[c.k]);
      if (d.adProduct !== undefined && d.adProduct !== null) mo.p1.adProduct = N(d.adProduct);
      if (d.marketing) for (const c of C) if (d.marketing[c.k]) mo.p1.marketing[c.k] = d.marketing[c.k];
      if (d.prices || d.terms || d.marketing || d.adProduct !== undefined) done.push("planning");
    }
    if (d.sort && ok("sort")) { mergeNums(mo.p2.sort, d.sort); done.push("tri"); }
    if (d.results && ok("results")) { mergeNums(mo.results, d.results); done.push("résultats"); }
    if (Array.isArray(d.offers) && ok("offers")) {
      let n = 0;
      for (const o of d.offers) {
        const dup = state.offers.find((x) => N(x.month) === m && x.counterpart === o.counterpart && x.product === o.product && N(x.qty) === N(o.qty) && N(x.price) === N(o.price));
        if (dup) { if (o.status) dup.status = o.status; continue; }
        state.offers.push({ month: m, dir: o.dir || "in", counterpart: o.counterpart || "", type: o.type || "buy", product: o.product || "mixed", qty: N(o.qty), price: N(o.price), term: o.term ? String(o.term) : "60", status: o.status === "confirmed" ? "accepted" : o.status || "pending", t: Date.now() });
        n++;
      }
      done.push(`${n} offre(s)`);
    }
    if (d.settings && ok("settings")) {
      const s = d.settings, st = state.settings;
      if (s.myId) st.myId = s.myId;
      if (Array.isArray(s.teams) && s.teams.length) {
        st.teams = Array.from(new Set((st.teams || []).concat(s.teams)));
        const dist = st.teams.filter((t) => /^D/i.test(t)).length, ind = st.teams.filter((t) => /^I/i.test(t)).length;
        if (dist) st.nDist = dist;
        if (ind) st.nInd = ind;
      }
      if (s.ranges) mergeNums(st.ranges, s.ranges);
      if (s.fixed) mergeNums(st.fixed, s.fixed);
      if (s.yields) mergeNums(st.yields, s.yields);
      if (s.needs) mergeNums(st.needs, s.needs);
      if (N(s.sortCost) !== null) st.sortCost = N(s.sortCost);
      if (N(s.sortCap) !== null) st.sortCap = N(s.sortCap);
      done.push("paramètres");
    }
    const when = new Date().toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    if (Array.isArray(d.emails) && ok("emails")) for (const e of d.emails) state.journal.push({ when, m, text: `Mail ${e.from ? `de ${e.from}` : ""}${e.subject ? ` (${e.subject})` : ""} : ${e.summary || ""}` });
    if (d.notes && ok("notes")) state.journal.push({ when, m, text: `Lu dans tes captures : ${d.notes}` });
    ui.importOpen = false;
    save();
    render();
    toast(done.length ? `Ajouté à ${MN(m)} : ${done.join(", ")}` : "Rien appliqué");
  }

  /* ---------- Actions ---------- */
  const actions = {
    go: (el) => go(el.dataset.view),
    import: (el) => openImport(el.dataset.target, N(el.dataset.m) || state.current.m),
    "pick-files": () => pickFiles(false),
    "imp-remove": (el) => { ui.imp.files.splice(+el.dataset.i, 1); renderModal(); },
    "imp-run": () => runImport(),
    "imp-restart": () => { ui.imp.result = null; ui.imp.error = null; renderModal(); },
    "imp-close": () => { ui.importOpen = false; renderModal(); },
    "imp-bg": (el, e) => { if (e.target === el) { ui.importOpen = false; renderModal(); } },
    "imp-apply": () => applyImport(),
    "apply-prices": (el) => {
      const m = +el.dataset.m;
      for (const p of E.productsFor(state, m)) for (const c of C) setP(`months.${m}.p1.prices.${c.k}.${p.k}`, E.recoPrice(state, m, c.k, p.k).price);
      save(); render(); toast("Prix conseillés appliqués");
    },
    "apply-terms": (el) => { const m = +el.dataset.m; const r = E.recoTerms(state, m); for (const c of C) setP(`months.${m}.p1.terms.${c.k}`, r[c.k]); save(); render(); toast("Délais conseillés appliqués"); },
    "apply-mkt": (el) => { const m = +el.dataset.m; const r = E.recoMarketing(state, m); setP(`months.${m}.p1.adProduct`, r.adProduct); for (const c of C) setP(`months.${m}.p1.marketing.${c.k}`, r.targeted[c.k]); save(); render(); toast("Marketing conseillé appliqué"); },
    allocate: (el) => { const m = +el.dataset.m; const a = E.allocate(state, m); E.month(state, m).p2.deliveries = a; save(); render(); toast("Répartition proposée : recopie-la dans le simulateur"); },
    analyze: (el) => analyze(+el.dataset.m),
    "add-offer": () => {
      const v = (id) => document.getElementById(id).value;
      if (!N(v("of-qty")) && !N(v("of-price"))) { toast("Saisis au moins une quantité ou un prix"); return; }
      state.offers.push({ month: N(v("of-month")), dir: v("of-dir"), counterpart: v("of-cp").trim(), type: v("of-type"), product: v("of-prod"), qty: N(v("of-qty")), price: N(v("of-price")), term: v("of-term"), status: v("of-status"), t: Date.now() });
      save(); render(); toast("Offre ajoutée");
    },
    "del-offer": (el) => { state.offers.splice(+el.dataset.i, 1); save(); render(); },
    copy: (el) => { navigator.clipboard.writeText(el.dataset.text).then(() => toast("Copié"), () => toast("Copie impossible")); },
    "needs-m": (el) => { ui.needsM = +el.dataset.m; render(); },
    export: () => {
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vinego-cockpit-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    "import-file": () => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "application/json,.json";
      inp.onchange = async () => {
        try { const s = JSON.parse(await inp.files[0].text()); if (!s.version) throw new Error("Fichier non reconnu"); state = migrate(s); save(); render(); toast("Données importées"); } catch (e) { toast(`Import impossible : ${e.message}`); }
      };
      inp.click();
    },
    reset: () => { if (confirm("Tout effacer ? Exporte d'abord si tu veux garder une copie.")) { state = E.defaultState(); view = "dash"; save(); render(); } },
    ping: async () => {
      try { const j = await api({ action: "ping" }); toast(j.hasKey ? "Connexion IA prête" : "Clé ANTHROPIC_API_KEY absente sur Vercel"); } catch (e) { toast(`IA injoignable : ${e.message}`); }
    },
    "add-journal": () => {
      const ta = document.getElementById("j-text");
      if (!ta.value.trim()) return;
      state.journal.push({ when: new Date().toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }), m: state.current.m, text: ta.value.trim() });
      save(); render();
    },
    "chat-send": () => sendChat(ui.chatDraft),
    quick: (el) => sendChat(el.dataset.q),
    "chat-attach": () => pickFiles(true),
    "chat-clear-attach": () => { ui.chatAttach = []; renderCoach(); },
    "chat-reset": () => { state.chat = []; save(); renderCoach(); },
    "toggle-coach": () => document.getElementById("coach").classList.toggle("open"),
    "toggle-rail": () => document.getElementById("rail").classList.toggle("open")
  };

  function pickFiles(toChat) {
    const inp = document.createElement("input");
    inp.type = "file"; inp.multiple = true; inp.accept = toChat ? "image/*" : "image/*,application/pdf,text/plain";
    inp.onchange = () => addFiles(inp.files, toChat);
    inp.click();
  }

  /* ---------- Événements ---------- */
  document.addEventListener("pointerdown", () => { ui.pointerDown = true; }, true);
  document.addEventListener("pointerup", () => {
    ui.pointerDown = false;
    if (ui.pendingRender) { ui.pendingRender = false; setTimeout(render, 0); }
  }, true);

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (fn) { if (el.tagName === "A") e.preventDefault(); fn(el, e); }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.impSel) { ui.imp.sel[el.dataset.impSel] = el.checked; return; }
    const path = el.dataset && el.dataset.path;
    if (!path) return;
    const t = el.dataset.type;
    let v;
    if (t === "bool") v = el.checked;
    else if (t === "num") v = N(el.value);
    else if (t === "list") v = el.value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    else v = el.value;
    setP(path, v);
    if (path === "settings.teams") {
      const dist = v.filter((x) => /^D/i.test(x)).length, ind = v.filter((x) => /^I/i.test(x)).length;
      if (dist) state.settings.nDist = dist;
      if (ind) state.settings.nInd = ind;
    }
    save();
    if (el.tagName === "SELECT" || t === "bool") { ui.pointerDown = false; ui.pendingRender = false; requestAnimationFrame(render); }
    else scheduleRender();
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "chat-input") ui.chatDraft = e.target.value;
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.id === "chat-input" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(ui.chatDraft); }
    if (e.key === "Escape" && ui.importOpen && !ui.imp.busy) { ui.importOpen = false; renderModal(); }
  });

  document.addEventListener("paste", (e) => {
    const files = Array.from(e.clipboardData ? e.clipboardData.files : []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.id === "chat-input") { addFiles(files, true); return; }
    if (!ui.importOpen) openImport("auto", state.current.m);
    if (!ui.imp.busy && !ui.imp.result) addFiles(files, false);
  });

  window.addEventListener("dragover", (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    if (!ui.importOpen) openImport("auto", state.current.m);
    if (!ui.imp.busy && !ui.imp.result) addFiles(e.dataTransfer.files, false);
  });

  render();
})();
