/* Tableur de suivi distributeur : interface façon feuille de calcul */
(function () {
  "use strict";
  const E = window.Engine;
  const KEY = "vinego-cockpit-v1";
  const C = E.CLIENTS;
  const N = E.num;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let state = load();
  const ui = {
    pane: false, unread: 0, busy: null, flash: new Set(), flashT: null,
    undo: {}, lastUndo: null, chain: Promise.resolve(), menu: null,
    pointerDown: false, pendingRender: false, lastAct: Date.now(), noteHover: false, sel: null
  };

  /* ---------- Stockage ---------- */
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.version) return migrate(s);
    } catch (e) { /* état neuf */ }
    return migrate(E.defaultState());
  }
  function migrate(s) {
    const d = E.defaultState();
    const ds = d.settings;
    s.settings = Object.assign({}, ds, s.settings || {});
    for (const k of ["fixed", "ranges", "yields", "buyTargets", "naturalCost"]) s.settings[k] = Object.assign({}, ds[k], s.settings[k] || {});
    s.settings.needs = Object.assign({}, ds.needs, s.settings.needs || {});
    if (!s.settings.fileName) s.settings.fileName = "Suivi_distribution_2026.xlsx";
    if (s.settings.idleSec === undefined) s.settings.idleSec = 60;
    if (!s.settings.zoom) s.settings.zoom = 100;
    for (const k of ["months", "offers", "journal", "chat"]) if (!s[k]) s[k] = d[k];
    if (!s.current) s.current = d.current;
    if (!s.partners) s.partners = {};
    if (!s.ui || typeof s.ui !== "object") s.ui = {};
    if (!s.ui.sheet || s.ui.view) { s.ui.sheet = "todo"; delete s.ui.view; }
    return s;
  }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    const sv = document.getElementById("saved");
    if (sv) sv.textContent = "Enregistrement…";
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        if (sv) sv.textContent = "Enregistré";
      } catch (e) {
        if (sv) sv.textContent = "Non enregistré";
        toast("Sauvegarde impossible : stockage du navigateur plein. Exporte une copie (Fichier).");
      }
    }, 150);
  }

  /* ---------- Outils ---------- */
  const esc = (s) => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d) => (v === null || v === undefined || v === "" || isNaN(v) ? "" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 0 : d }));
  const eur = (v) => (v === null || v === undefined || v === "" || isNaN(v) ? "" : Math.round(v).toLocaleString("fr-FR") + " €");
  const MN = (m) => E.MONTHS[m - 1] || `Mois ${m}`;
  const PH_KEY = { 1: "p1", 2: "p2", 3: "r" };
  const PHASES = [{ k: 1, label: "1. Planification" }, { k: 2, label: "2. Ventes et achats" }, { k: 3, label: "3. Résultats" }];
  const PHASE_LONG = { 1: "phase 1, écran vert", 2: "phase 2, écran bleu", 3: "résultats du mois" };
  const PHASE_NAME = { 1: "planification", 2: "ventes et achats", 3: "résultats" };
  const PRODS_ALL = [{ k: "mixed", label: "Agglomérés" }, { k: "A", label: "Espagne A" }, { k: "B", label: "Espagne B" }, { k: "C", label: "Espagne C" }, { k: "Q1", label: "Q1" }, { k: "Q2", label: "Q2" }, { k: "Q3", label: "Q3" }, { k: "Q4", label: "Q4" }];
  const STATUS = [{ k: "pending", label: "En attente" }, { k: "accepted", label: "Acceptée" }, { k: "refused", label: "Refusée" }, { k: "cancelled", label: "Annulée" }];
  const prodLabel = (k) => (PRODS_ALL.find((p) => p.k === k) || { label: k || "" }).label;
  const clientLabel = (k) => (C.find((c) => c.k === k) || { label: k || "" }).label;
  const termLab = (k) => (E.TERMS.find((t) => t.k === String(k)) || { label: k || "" }).label;
  const statusLab = (k) => (STATUS.find((t) => t.k === k) || { label: k === "confirmed" ? "Confirmée" : k || "" }).label;
  const mktLab = (k) => (E.MKT.find((t) => t.k === k) || { label: k || "" }).label;
  const lastMonth = () => N(state.settings.months) || 6;
  const now = () => new Date().toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

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
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
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

  /* ---------- Grille ---------- */
  function grid(def) {
    const widths = def.cols.slice();
    while (widths.length < 26 && (widths.length < (def.minCols || 12) || widths.reduce((a, b) => a + b, 0) < 1900)) widths.push(84);
    const ncol = widths.length;
    const total = 42 + widths.reduce((a, b) => a + b, 0);
    let h = `<table class="grid" style="width:${total}px"><colgroup><col style="width:42px">${widths.map((w) => `<col style="width:${w}px">`).join("")}</colgroup>`;
    h += `<thead><tr><th class="corner"></th>${widths.map((w, i) => `<th>${LETTERS[i] || ""}</th>`).join("")}</tr></thead><tbody>`;
    let r = 0;
    for (const row of def.rows) {
      r++;
      const cells = Array.isArray(row) ? row : row.cells;
      let ci = 0, tds = "";
      for (const raw of cells) {
        const c = raw !== null && typeof raw === "object" ? raw : { v: raw };
        const span = Math.min(c.span || 1, ncol - ci);
        if (span <= 0) break;
        const ref = (LETTERS[ci] || "") + r;
        let attrs = `data-ref="${ref}"`;
        if (span > 1) attrs += ` colspan="${span}"`;
        if (c.note) attrs += ` data-note="${esc(c.note)}"`;
        if (c.act) attrs += ` data-act="${c.act}"` + Object.entries(c.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
        if (c.act && !c.html) attrs += ` role="button" tabindex="0"`;
        const cls = `${c.cls || ""}${c.note ? " has-note" : ""}`.trim();
        tds += `<td ${attrs}${cls ? ` class="${cls}"` : ""}>${c.html !== undefined ? c.html : esc(c.v === null || c.v === undefined ? "" : c.v)}</td>`;
        ci += span;
      }
      for (; ci < ncol; ci++) tds += `<td data-ref="${LETTERS[ci] || ""}${r}"></td>`;
      h += `<tr><th class="rn">${r}</th>${tds}</tr>`;
    }
    const minRows = Math.max(def.minRows || 0, 48);
    while (r < minRows) {
      r++;
      let tds = "";
      for (let ci = 0; ci < ncol; ci++) tds += `<td data-ref="${LETTERS[ci] || ""}${r}"></td>`;
      h += `<tr><th class="rn">${r}</th>${tds}</tr>`;
    }
    return h + "</tbody></table>";
  }

  /* Cellule éditable liée à l'état. reco = valeur affichée tant que rien n'est saisi. */
  function inp(path, o) {
    o = o || {};
    const stored = getP(path);
    const empty = stored === null || stored === undefined || stored === "";
    let disp = stored, reco = false;
    if (empty && o.reco !== undefined && o.reco !== null) { disp = o.reco; reco = true; }
    const fl = ui.flash.has(path) ? " flash" : "";
    const label = esc(o.label || "");
    let html;
    if (o.check) {
      return { html: `<input type="checkbox" data-path="${path}" data-type="bool" ${stored ? "checked" : ""} aria-label="${label}">`, cls: `c${fl} ${o.cls || ""}`, note: o.note, span: o.span };
    }
    if (o.options) {
      const cur = disp === null || disp === undefined ? "" : String(disp);
      html = `<select data-path="${path}" data-type="${o.type || "text"}" aria-label="${label}">${o.blank ? `<option value=""></option>` : ""}${o.options.map((op) => `<option value="${esc(op.k)}" ${String(op.k) === cur ? "selected" : ""}>${esc(op.label)}</option>`).join("")}</select>`;
    } else if (o.area) {
      html = `<textarea data-path="${path}" data-type="text" placeholder="${esc(o.ph || "")}" aria-label="${label}">${esc(stored || "")}</textarea>`;
    } else {
      const type = o.type || "num";
      let v = disp === null || disp === undefined ? "" : disp;
      if (type === "num" && v !== "" && typeof v === "number") v = v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
      if (type === "list" && Array.isArray(v)) v = v.join(", ");
      html = `<input type="text" ${type === "num" ? 'inputmode="decimal"' : ""} data-path="${path}" data-type="${type}" value="${esc(v)}" placeholder="${esc(o.ph || "")}" aria-label="${label}">`;
    }
    return { html, cls: `in${reco ? " reco" : ""}${fl}${o.left ? " l" : ""} ${o.cls || ""}`.trim(), note: o.note, span: o.span };
  }
  const link = (text, act, data, o) => Object.assign({ html: `<a href="#" data-act="${act}"${Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("")}>${esc(text)}</a>` }, o || {});
  const btn = (text, act, data, o) => Object.assign({ html: `<button class="cbtn${(o && o.ghost) ? " ghost" : ""}" data-act="${act}"${Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("")}${o && o.disabled ? " disabled" : ""}>${esc(text)}</button>` }, o || {});
  const sec = (text, span) => [{ v: text, span: span || 8, cls: "sec" }];
  const chRow = (labels) => labels.map((l) => (typeof l === "object" ? Object.assign({ cls: "ch" }, l, { cls: `ch ${l.cls || ""}` }) : { v: l, cls: "ch" }));
  const signCls = (v) => (v === null || v === undefined || isNaN(v) ? "" : v < 0 ? "neg" : "pos");
  const idxCls = (v) => (v === null || v === undefined ? "" : v >= 1.3 ? "good" : v <= 0.7 ? "bad" : "mid");
  const databar = (pct) => `<div class="databar" aria-label="Avancement ${pct} %"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span><b>${pct} %</b></div>`;
  const monthOpts = () => Array.from({ length: lastMonth() }, (_, i) => ({ k: i + 1, label: MN(i + 1) }));

  function okCell(ok, labels) {
    labels = labels || ["OK", "À revoir", "À compléter"];
    if (ok === true) return { v: labels[0], cls: "good c" };
    if (ok === false) return { v: labels[1], cls: "bad c" };
    return { v: labels[2], cls: "gray c" };
  }

  /* ---------- Explications ---------- */
  function priceWhy(m, p) {
    const rs = C.map((c) => ({ c, r: E.recoPrice(state, m, c.k, p) }));
    const friendly = (t) => {
      if (/ouverture/i.test(t)) return `Juste sous les seuils ronds (69, 39) : ça paraît bien moins cher que 70 ou 40 sans perdre de marge. Grands comptes : ton coût (${fmt(E.mixedCost(state), 2)} €) plus quelques euros, gros volume mais petite marge.`;
      if (/Q4 rare/i.test(t)) return "Q4 : la plus grosse demande, et le tri en produit peu. Prix fort partout.";
      if (/Q3 équilibré/i.test(t)) return "Q3 se vend bien et se paie bien : haut de fourchette.";
      if (/Surplus après tri/i.test(t)) return "Le tri sort plus de cette qualité que la demande : prix agressif pour tout écouler.";
      return t;
    };
    const uniq = Array.from(new Set(rs.map((x) => x.r.reason)));
    if (uniq.length === 1) return friendly(uniq[0]);
    return rs.filter((x) => E.need(state, m, x.c.k, p) > 0 || p === "mixed").map((x) => `${x.c.label} : ${friendly(x.r.reason)}`).join(" ; ");
  }

  /* ---------- Feuille « À faire » (parcours guidé) ---------- */
  function decisionKeys(m, phase) {
    if (phase === 1) return E.productsFor(state, m).map((p) => `price_${p.k}`).concat(["terms", "mkt"]);
    if (phase === 2) return (E.isNat(state, m) ? ["sort"] : []).concat(["del"]).concat(m < lastMonth() ? ["buy"] : []);
    return [];
  }

  const DEC_LABEL = { terms: "les délais de paiement", mkt: "le marketing", sort: "le tri (Decisions > Production)", del: "les quantités à livrer (Sales)", buy: "tes achats pour le mois suivant (Negotiations)" };
  function nextAction(m, phase, steps, keys, chk, closed) {
    const st = steps.find((s) => !s.optional && !E.stepDone(state, m, phase, s));
    if (st) return `Capture dans le jeu : ${st.where}, puis Ctrl+V ici.`;
    const k = keys.find((x) => !chk[x]);
    if (k) return `Saisis dans le jeu ${k.startsWith("price_") ? `les prix ${prodLabel(k.slice(6)) === "Agglomérés" ? "des agglomérés" : prodLabel(k.slice(6))}` : DEC_LABEL[k]} (section 2), puis coche « ${phase === 2 && k === "buy" ? "Fait" : "Saisi"} ».`;
    const bad = E.checks(state, m, phase).find((c) => c.ok === false);
    if (bad) return `À revoir avant de valider : ${bad.label.toLowerCase()} (section 3).`;
    if (!closed) return phase === 3 ? "Lance l'analyse du mois, lis le plan, puis coche la case de la section 3." : "Coche ta partie dans le jeu, clique sur Finish the phase, puis coche la case de la section 3.";
    return phase < 3 || m < lastMonth() ? "Tout est fait : clique sur Étape suivante (section 3)." : "Partie terminée.";
  }

  /* Verdict sur une offre : les offres externes ne se négocient pas */
  function judge(o) {
    const m = N(o.month);
    const j = o.type === "sell" ? E.judgeSell(state, m, o.product, o.price) : E.judgeBuy(state, m, o.product, o.price);
    if (!j) return null;
    if (/extern|german|allemand|partner|partenaire/i.test(o.counterpart || "") && o.type !== "sell") {
      if (j.verdict === "ok") return { verdict: "ok", label: "Bon prix : accepte la quantité dont tu as besoin (pas négociable)", counter: null };
      if (j.verdict === "nego") return { verdict: "nego", label: "Pas négociable : accepte seulement si tu manques de stock, sinon refuse", counter: null };
      return { verdict: "refuse", label: "Trop cher : refuse", counter: null };
    }
    return j;
  }

  function sheetTodo() {
    const { m, phase } = state.current;
    const mo = E.month(state, m);
    const last = lastMonth();
    const W = [36, 250, 116, 116, 116, 150, 310, 96];
    const R = [];
    const steps = E.steps(state, m, phase);
    const req = steps.filter((s) => !s.optional);
    const sDone = req.filter((s) => E.stepDone(state, m, phase, s)).length;
    const keys = decisionKeys(m, phase);
    const chk = (phase === 3 ? null : mo[PH_KEY[phase]].check) || {};
    const dDone = keys.filter((k) => chk[k]).length;
    const closed = phase === 3 ? !!mo.closed : !!mo[PH_KEY[phase]].done;
    const total = req.length + keys.length + 1;
    const done = sDone + dDone + (closed ? 1 : 0);
    const pct = Math.round((done / total) * 100);

    R.push([{ v: "Suivi distribution", span: 2, cls: "title" }, { v: "Mois", cls: "r muted" }, inp("current.m", { type: "num", options: monthOpts(), label: "Mois" }), { v: "Phase", cls: "r muted" }, inp("current.phase", { type: "num", options: PHASES, label: "Phase" }), { html: databar(pct) }, { v: `${done} sur ${total}`, cls: "r muted" }]);
    R.push([{ v: `Objectif du mois : ${E.lead(state, m)}`, span: 8, cls: "wrap lead" }]);
    R.push([{ v: "" }, { v: "Prochaine action", cls: "b" }, { v: nextAction(m, phase, steps, keys, chk, closed), span: 6, cls: "wrap b mid" }]);
    R.push([]);
    R.push(sec(`La stratégie de cette étape : ${MN(m)}, ${PHASE_NAME[phase]}`));
    for (const x of E.strategy(state, m, phase)) R.push([{ v: "" }, { v: x.k, cls: `b ${x.k === "Le piège" ? "bad" : x.k === "Tes chiffres" ? "mid" : ""}` }, { v: x.t, span: 6, cls: "wrap" }]);
    R.push([]);

    // 1. Captures
    R.push(sec(`1. Captures à faire dans le jeu (${PHASE_LONG[phase]})`));
    R.push(chRow(["N°", "Dans le jeu, ouvre", { v: "Ce que tu captures", span: 3 }, { v: "Pourquoi", span: 2 }, { v: "Statut", cls: "c" }]));
    steps.forEach((s, i) => {
      const d = E.stepDone(state, m, phase, s);
      const st = d ? { v: "Fait", cls: "good toggle" } : s.optional ? { v: "Facultatif", cls: "gray toggle" } : { v: "À faire", cls: "mid toggle" };
      R.push([{ v: i + 1, cls: "c muted" }, { v: s.where, cls: "wrap b" }, { v: s.what, span: 3, cls: "wrap" }, { v: s.why, span: 2, cls: "wrap muted" }, Object.assign(st, { act: "step-toggle", data: { id: s.id }, note: "Clique pour changer le statut à la main" })]);
    });
    R.push([{ v: "" }, { v: "Win + Maj + S pour capturer une zone de l'écran, puis Ctrl+V n'importe où ici, ou glisse le fichier sur la page. Plusieurs captures d'un coup, c'est possible. Tu peux aussi copier tout le texte d'une page du jeu (Ctrl+A puis Ctrl+C) et le coller ici. Tout est lu et rangé tout seul.", span: 5, cls: "wrap muted" }, link("Ou choisir des fichiers sur l'ordinateur", "insert", {}, { span: 2 })]);
    R.push([]);

    // 2. Décisions
    if (phase === 1) todoP1(R, m);
    else if (phase === 2) todoP2(R, m);
    else todoP3(R, m);
    R.push([]);

    // 3. Vérifications
    R.push(sec("3. Vérifications avant de valider la phase"));
    R.push(chRow(["", "Contrôle", { v: "Résultat", cls: "c" }, { v: "Détail", span: 4 }, ""]));
    for (const c of E.checks(state, m, phase)) R.push([{ v: "" }, { v: c.label, cls: "wrap" }, okCell(c.ok), { v: c.detail, span: 4, cls: "wrap muted" }, { v: "" }]);
    const donePath = phase === 3 ? `months.${m}.closed` : `months.${m}.${PH_KEY[phase]}.done`;
    R.push([{ v: "" }, { v: phase === 3 ? "Résultats relus, plan du mois suivant compris" : "Phase cochée et validée dans le jeu (Finish the phase)", cls: "wrap b" }, inp(donePath, { check: true, label: "Phase terminée" }), { v: phase === 3 ? "" : "Une fois validée, l'écran du jeu passe en gris : plus rien ne se modifie.", span: 4, cls: "wrap muted" }, { v: "" }]);
    const prev = phase > 1 ? `${MN(m)}, ${PHASE_NAME[phase - 1]}` : m > 1 ? `${MN(m - 1)}, résultats` : null;
    const next = phase < 3 ? `${MN(m)}, ${PHASE_NAME[phase + 1]}` : m < last ? `${MN(m + 1)}, planification` : null;
    R.push([{ v: "" }, prev ? link(`Étape précédente : ${prev}`, "prev") : { v: "" }, { v: "", span: 3 }, next ? btn(`Étape suivante : ${next}`, "next", {}, { span: 2 }) : { v: "Fin de la partie", span: 2, cls: "muted" }, { v: "" }]);
    R.push([]);

    // 4. Attention et anticipation
    const ph = phase === 3 ? 2 : phase;
    const al = E.alerts(state, m, ph);
    const an = E.anticipate(state, m);
    R.push(sec("4. Attention et à anticiper"));
    if (!al.length && !an.length) R.push([{ v: "" }, { v: "Rien à signaler pour l'instant.", span: 7, cls: "muted" }]);
    for (const a of al) R.push([{ v: "" }, { v: a.lvl === "bad" ? "Urgent" : a.lvl === "warn" ? "Attention" : "Info", cls: `c ${a.lvl === "bad" ? "bad" : a.lvl === "warn" ? "mid" : "gray"}` }, { v: a.t, span: 6, cls: "wrap" }]);
    for (const t of an) R.push([{ v: "" }, { v: "À anticiper", cls: "c gray" }, { v: t, span: 6, cls: "wrap" }]);
    return grid({ cols: W, rows: R, minRows: R.length + 8 });
  }

  function todoP1(R, m) {
    const nat = E.isNat(state, m);
    R.push(sec("2. À saisir dans le jeu : Decisions > Planning"));
    R.push(chRow(["", "Ce que tu règles", { v: "Vignerons", cls: "r" }, { v: "Cavistes", cls: "r" }, { v: "Grands comptes", cls: "r" }, { v: "Pourquoi", span: 2 }, { v: "Saisi", cls: "c" }]));
    for (const p of E.productsFor(state, m)) {
      const cells = C.map((c) => {
        const r = E.recoPrice(state, m, c.k, p.k);
        const [lo, hi] = E.range(state, c.k, p.k);
        const eff = E.effPrice(state, m, c.k, p.k);
        const stored = N(E.get(state.months, [m, "p1", "prices", c.k, p.k], null));
        const out = eff < lo || eff > hi;
        let note = `Conseillé : ${r.price} €\nFourchette du jeu : ${lo} à ${hi} €\n${r.reason}`;
        if (stored !== null && stored !== r.price) note = `Tu as mis ${stored} €. L'outil conseille ${r.price} €.\nFourchette : ${lo} à ${hi} €\n${r.reason}`;
        if (E.need(state, m, c.k, p.k) === 0 && p.k !== "mixed") note += "\nCe client n'en demande pas ce mois-ci : le prix compte peu.";
        return inp(`months.${m}.p1.prices.${c.k}.${p.k}`, { type: "num", reco: r.price, note, label: `Prix ${p.label} ${c.label}`, cls: out ? "over" : "" });
      });
      R.push([{ v: "" }, { v: `Prix ${p.label} (€ par lot)`, cls: "b" }].concat(cells, [{ v: priceWhy(m, p.k), span: 2, cls: "wrap muted" }, inp(`months.${m}.p1.check.price_${p.k}`, { check: true, label: "Saisi" })]));
    }
    const rt = E.recoTerms(state, m);
    R.push([{ v: "" }, { v: "Délai de paiement client", cls: "b" }].concat(C.map((c) => inp(`months.${m}.p1.terms.${c.k}`, { options: E.TERMS, reco: rt[c.k], label: `Délai ${c.label}`, note: `Conseillé : ${termLab(rt[c.k])}` })), [{ v: `${rt.why}.`, span: 2, cls: "wrap muted" }, inp(`months.${m}.p1.check.terms`, { check: true, label: "Saisi" })]));
    const rm = E.recoMarketing(state, m);
    const est = E.estimate(state, m, false);
    if (!nat) {
      const mc = E.marketingCost(state, m);
      R.push([{ v: "" }, { v: "Budget pub produit (€)", cls: "b" }, inp(`months.${m}.p1.adProduct`, { type: "num", reco: rm.adProduct, label: "Pub produit", note: `Conseillé : ${fmt(rm.adProduct)} €` }), { v: est.ca ? `${fmt((mc / est.ca) * 100, 1)} % du CA attendu` : "", span: 2, cls: "muted" }, { v: `${rm.why}.`, span: 2, cls: "wrap muted" }, inp(`months.${m}.p1.check.mkt`, { check: true, label: "Saisi" })]);
    } else {
      const opts = E.MKT.map((x) => ({ k: x.k, label: x.cost ? `${x.label} (${fmt(x.cost)} €)` : x.label }));
      R.push([{ v: "" }, { v: "Action marketing ciblée", cls: "b" }].concat(C.map((c) => inp(`months.${m}.p1.marketing.${c.k}`, { options: opts, reco: E.effMarketing(state, m).reco ? rm.targeted[c.k] : "none", label: `Marketing ${c.label}`, note: `Conseillé : ${mktLab(rm.targeted[c.k])}` })), [{ v: `${rm.why}. Une visite à 50 000 € doit rapporter plus de 50 000 € de marge dans le mois.`, span: 2, cls: "wrap muted" }, inp(`months.${m}.p1.check.mkt`, { check: true, label: "Saisi" })]));
      R.push([{ v: "" }, { v: "Pub produit globale (€)", cls: "b" }, inp(`months.${m}.p1.adProduct`, { type: "num", reco: E.effMarketing(state, m).reco ? rm.adProduct : 0, label: "Pub produit" }), { v: "Laisse à 0 avec des actions ciblées", span: 2, cls: "muted" }, { v: "", span: 3 }]);
    }
    R.push([{ v: "" }, { v: "Résultat estimé du mois", cls: "b" }, { v: eur(est.result), cls: `r b ${signCls(est.result)}` }, { v: `CA ${eur(est.ca)}, marge ${eur(est.margin)}`, span: 2, cls: "muted" }, { v: `Estimation : demande du guide × ton attractivité du mois dernier, avec ces prix et tes coûts (fixes ${eur(est.fixed)}, marketing ${eur(est.marketing)}). Sert à comparer deux choix, pas à prédire au centime.`, span: 2, cls: "wrap muted" }, { v: "" }]);
    R.push([{ v: "" }, link("Remettre toutes les valeurs conseillées", "reset-p1"), { v: "Les chiffres en bleu sont les valeurs conseillées. Tape par-dessus si tu fais un autre choix : tout se recalcule. Survole une cellule à coin rouge pour l'explication.", span: 6, cls: "wrap muted" }]);
  }

  function todoP2(R, m) {
    const mo = E.month(state, m);
    const nat = E.isNat(state, m);
    const prods = E.productsFor(state, m);
    const last = lastMonth();
    R.push(sec("2. À faire dans le jeu : Production, Sales, Negotiations"));
    // Demande et stock
    R.push([{ v: "" }, { v: "a. Demande reçue (lue dans Sales) et stock", span: 7, cls: "b" }]);
    R.push(chRow(["", "Produit", { v: "Vignerons", cls: "r" }, { v: "Cavistes", cls: "r" }, { v: "Grands comptes", cls: "r" }, { v: "Stock dispo", cls: "r" }, "Lecture", ""]));
    for (const p of prods) {
      const cells = C.map((c) => {
        const idx = E.index(state, m, c.k, p.k);
        const nd = E.need(state, m, c.k, p.k);
        const note = `Besoin du guide : ${fmt(nd)} lots${idx !== null ? `\nAttractivité : ${idx.toFixed(2)}\n${idx >= 1.3 ? "Plus attractif que la moyenne : tu peux monter le prix le mois prochain." : idx <= 0.7 ? "Les autres sont moins chers ou plus visibles." : "Dans le peloton."}` : ""}`;
        return inp(`months.${m}.p2.demand.${c.k}.${p.k}`, { type: "num", label: `Demande ${p.label} ${c.label}`, note, cls: idxCls(idx) });
      });
      const dt = E.demandTotal(state, m, p.k);
      const st = E.availableStock(state, m, p.k);
      let lec = "";
      if (dt === null) lec = "Capture Decisions > Sales";
      else if (dt > st) lec = `Rupture : ${fmt(dt - st)} lots non servis. Les clients les plus chers d'abord ; prix en hausse le mois prochain.`;
      else if (st && dt < st * 0.5) lec = p.k.startsWith("Q") ? "Le tri en sort plus que la demande : le surplus reste en stock pour le mois prochain, ou se revend aux distributeurs à court." : "Peu de demande pour ton stock : garde le surplus, achète peu, propose-le aux distributeurs à court.";
      else lec = "Demande couverte par ton stock.";
      R.push([{ v: "" }, { v: p.label, cls: "b" }].concat(cells, [{ v: fmt(st), cls: "r", note: p.k.startsWith("Q") ? "Stock trié + sortie du tri de ce mois" : "Stock lu dans le jeu" }, { v: lec, cls: "wrap muted" }, { v: "" }]));
    }
    if (nat) {
      const raw = ["A", "B", "C"].map((o) => `${o} ${fmt(E.stockOf(state, m, o) || 0)}`).join(", ");
      R.push([{ v: "" }, { v: "Naturels non triés", cls: "muted" }, { v: raw, span: 3, cls: "muted" }, { v: "", span: 3 }]);
      // Tri
      const rs = E.recoSort(state, m);
      const y = state.settings.yields;
      R.push([{ v: "" }, { v: "b. Tri : Decisions > Production", span: 7, cls: "b" }]);
      R.push(chRow(["", "Origine", { v: "À trier", cls: "r" }, { v: "En stock", cls: "r" }, { v: "Sortie Q1 / Q2 / Q3 / Q4", span: 2 }, "Pourquoi", { v: "Saisi", cls: "c" }]));
      ["A", "B", "C"].forEach((o, i) => {
        const eff = N(E.get(mo, ["p2", "sort", o], null));
        const lots = eff !== null ? eff : rs[o];
        const outQ = (y[o] || []).map((pc) => fmt(Math.floor((lots * (N(pc) || 0)) / 100))).join(" / ");
        R.push([{ v: "" }, { v: `Espagne ${o}`, cls: "b" }, inp(`months.${m}.p2.sort.${o}`, { type: "num", reco: rs[o], label: `Tri ${o}`, note: `Conseillé : ${fmt(rs[o])} lots` }), { v: fmt(E.stockOf(state, m, o) || 0), cls: "r" }, { v: outQ, span: 2, cls: "muted" }, { v: i === 0 ? rs.why : i === 1 ? `Coût du tri : ${fmt(state.settings.sortCost)} € par lot, capacité ${fmt(state.settings.sortCap)} lots par mois.` : "", cls: "wrap muted" }, i === 0 ? inp(`months.${m}.p2.check.sort`, { check: true, label: "Saisi" }) : { v: "" }]);
      });
    }
    // Répartition
    const alloc = E.allocate(state, m);
    R.push([{ v: "" }, { v: `${nat ? "c" : "b"}. Ventes à saisir : Sales > Quantity of final products to deliver`, span: 7, cls: "b" }]);
    R.push(chRow(["", "Produit", { v: "Vignerons", cls: "r" }, { v: "Cavistes", cls: "r" }, { v: "Grands comptes", cls: "r" }, { v: "Reste en stock", cls: "r" }, "Pourquoi", { v: "Saisi", cls: "c" }]));
    prods.forEach((p, i) => {
      let tot = 0;
      const cells = C.map((c) => {
        const stored = N(E.get(mo, ["p2", "deliveries", c.k, p.k], null));
        const rec = alloc[c.k] ? alloc[c.k][p.k] : 0;
        const eff = stored !== null ? stored : rec;
        tot += eff || 0;
        const d = N(E.get(mo, ["p2", "demand", c.k, p.k], null));
        const over = d !== null && eff > d;
        return inp(`months.${m}.p2.deliveries.${c.k}.${p.k}`, { type: "num", reco: rec, label: `Livraison ${p.label} ${c.label}`, note: `Conseillé : ${fmt(rec)} lots${d !== null ? `\nCommande du client : ${fmt(d)}` : ""}`, cls: over ? "over" : "" });
      });
      const left = E.availableStock(state, m, p.k) - tot;
      R.push([{ v: "" }, { v: p.label, cls: "b" }].concat(cells, [{ v: fmt(left), cls: `r ${left < 0 ? "neg b" : ""}` }, { v: i === 0 ? "Chaque produit va d'abord au client qui le paie le plus cher, jamais plus que sa commande. Ce que tu ne livres pas part chez les concurrents." : "", cls: "wrap muted" }, i === 0 ? inp(`months.${m}.p2.check.del`, { check: true, label: "Saisi" }) : { v: "" }]));
    });
    // Achats
    const plan = E.purchasePlan(state, m);
    const nextM = MN(m + 1);
    R.push([{ v: "" }, { v: `${nat ? "d" : "c"}. Achats pour ${m < last ? nextM : "après la fin"} : Negotiations > New offer > Purchase`, span: 7, cls: "b" }]);
    if (m >= last) {
      R.push([{ v: "" }, { v: "Dernier mois joué : n'achète rien, ça ne se vendra jamais.", span: 7, cls: "wrap mid" }]);
    } else {
      R.push(chRow(["", "Produit", { v: "Quantité", cls: "r" }, { v: "Ouvre à", cls: "r" }, { v: "Vise", cls: "r" }, { v: "Plafond", cls: "r" }, "Pourquoi", { v: "Fait", cls: "c" }]));
      let first = true;
      if (plan.mixed) {
        const t = plan.mixed.targets;
        R.push([{ v: "" }, { v: "Agglomérés", cls: "b" }, { v: `${fmt(plan.mixed.buy)} lots`, cls: "r b", note: plan.mixed.bought ? `Déjà acheté ce mois-ci : ${fmt(plan.mixed.bought)} lots (déduits)` : "" }, { v: `${t.anchor} €`, cls: "r" }, { v: `${t.target} €`, cls: "r good" }, { v: `${t.ceiling} €`, cls: "r bad" }, { v: `Demande attendue en ${nextM} : ${fmt(plan.mixed.expected)} (guide × ton attractivité), moins ce qu'il te restera (${fmt(plan.mixed.leftover)}). Demande 60 jours de délai : livré dans 30 jours, payé dans 60.`, cls: "wrap muted" }, inp(`months.${m}.p2.check.buy`, { check: true, label: "Fait" })]);
        first = false;
      }
      if (plan.natural) {
        const t = plan.natural.targets.A;
        R.push([{ v: "" }, { v: "Espagne A", cls: "b" }, { v: `${fmt(plan.natural.buyA)} lots`, cls: "r b", note: plan.natural.bought ? `Déjà acheté ce mois-ci : ${fmt(plan.natural.bought)} lots de naturels (déduits)` : "" }, { v: `${t.anchor} €`, cls: "r" }, { v: `${t.target} €`, cls: "r good" }, { v: `${t.ceiling} €`, cls: "r bad" }, { v: plan.natural.rule === "q4" ? `Ton surplus de Q3 (${fmt(plan.natural.q3Leftover)}) couvre déjà le Q3 de ${nextM}, mais il te manquera du Q4 (${fmt(plan.natural.q4Expected)} attendus, ${fmt(plan.natural.q4Leftover)} en stock). On garde le volume habituel (demande Q3 ÷ 0,30, moins tes ${fmt(plan.natural.rawLeft)} naturels non triés) : le Q4 se vend, le surplus de Q3 servira le mois d'après.` : `Demande Q3 attendue en ${nextM} : ${fmt(plan.natural.q3Expected)}. Un lot d'A trié donne 30 % de Q3 : on divise par 0,30, moins ton surplus de Q3 (${fmt(plan.natural.q3Leftover)}) et tes naturels non triés (${fmt(plan.natural.rawLeft)}). On ne couvre pas tout le Q4 exprès : ce serait des milliers de Q1 et Q2 invendables. Le Q4 se vend donc au prix fort.`, cls: "wrap muted" }, first ? inp(`months.${m}.p2.check.buy`, { check: true, label: "Fait" }) : { v: "" }]);
      }
      for (const n of plan.notes) R.push([{ v: "" }, { v: n, span: 7, cls: "wrap muted" }]);
    }
    // Offres du mois
    const offers = (state.offers || []).map((o, i) => ({ o, i })).filter(({ o }) => N(o.month) === m);
    R.push([{ v: "" }, { v: "Offres de ce mois (verdict de l'outil)", span: 7, cls: "b" }]);
    if (!offers.length) {
      R.push([{ v: "" }, { v: "Aucune offre enregistrée. Capture Decisions > Negotiations, ou tape-la dans la barre du haut (ex. « I2 me propose 3 000 A à 49 € à 60 jours »).", span: 7, cls: "wrap muted" }]);
    } else {
      R.push(chRow(["", "Contrepartie", "Produit", { v: "Quantité", cls: "r" }, { v: "Prix", cls: "r" }, "Délai", "Verdict", "Statut"]));
      for (const { o } of offers.slice(-12)) {
        const j = judge(o);
        R.push([{ v: "" }, { v: `${o.counterpart || "?"} (${o.dir === "out" ? "envoyée" : "reçue"}, ${o.type === "sell" ? "vente" : "achat"})`, cls: "wrap" }, { v: prodLabel(o.product) }, { v: fmt(N(o.qty)), cls: "r" }, { v: eur(N(o.price)), cls: "r" }, { v: termLab(o.term) }, j ? { v: `${j.label}${j.counter ? `. Contre-offre : ${j.counter} €` : ""}`, cls: `wrap ${j.verdict === "ok" ? "good" : j.verdict === "nego" ? "mid" : "bad"}` } : { v: "" }, { v: statusLab(o.status) }]);
      }
    }
    R.push([{ v: "" }, link("Préparer la négo : tes limites, tes arguments, les réponses aux objections (feuille Négos)", "sheet", { sheet: "nego" }, { span: 7 })]);
    // Surplus
    let tot = 0;
    for (const c of C) { const s = N(E.get(mo, ["p2", "deliveries", c.k, "mixed"], null)); tot += s !== null ? s : alloc[c.k] ? alloc[c.k].mixed || 0 : 0; }
    const leftMixed = Math.max(0, E.availableStock(state, m, "mixed") - tot);
    if (leftMixed > 0 && E.demandTotal(state, m, "mixed") !== null) {
      const mail = `Bonjour, ici ${state.settings.myId || "D…"}. J'ai ${fmt(leftMixed)} lots d'agglomérés disponibles tout de suite, livraison immédiate entre distributeurs, ${Math.max(Math.ceil(E.mixedCost(state) + 6), 24)} € le lot, paiement à la commande. Premier arrivé, premier servi.`;
      R.push([{ v: "" }, { v: "Surplus à revendre", cls: "b" }, { v: mail, span: 5, cls: "wrap" }, link("Copier", "copy", { text: mail }, { cls: "c" })]);
    }
  }

  const RES_FIELDS = [
    ["turnover", "Chiffre d'affaires"], ["monthlyResult", "Résultat du mois"], ["cumResult", "Résultat cumulé"],
    ["cashEnd", "Trésorerie fin de mois"], ["cashM1", "Prévision trésorerie M+1"], ["cashM2", "Prévision trésorerie M+2"],
    ["score", "Score du mois"], ["avgScore", "Score moyen"], ["totalScore", "Score total"], ["rank", "Classement"],
    ["marketingCosts", "Coûts marketing"], ["stockValue", "Valeur du stock"], ["cashStart", "Trésorerie début de mois"], ["inflows", "Encaissements"], ["outflows", "Décaissements"]
  ];
  function resLecture(k, v, r) {
    if (v === null) return "";
    if (["monthlyResult", "cumResult"].includes(k)) return v < 0 ? "Négatif. Le résultat mensuel compte double : à corriger le mois prochain (prix, achats, marketing)." : "Positif.";
    if (["cashEnd", "cashM1", "cashM2"].includes(k)) return v < 0 ? "Sous zéro : −10 points par mois. Délais clients courts, achats à 60 jours, marketing coupé." : "Positive.";
    if (k === "score" && N(r.avgScore) !== null) return v >= N(r.avgScore) ? "Au-dessus de la moyenne." : "Sous la moyenne.";
    return "";
  }
  function todoP3(R, m) {
    const mo = E.month(state, m);
    const r = mo.results || {};
    R.push(sec("2. Les chiffres du mois (lus dans tes captures, modifiables)"));
    R.push(chRow(["", "Indicateur", { v: "Valeur", cls: "r" }, { v: "Lecture", span: 4 }, ""]));
    for (const [k, l] of RES_FIELDS.slice(0, 10)) {
      const v = N(r[k]);
      R.push([{ v: "" }, { v: l }, inp(`months.${m}.results.${k}`, { type: "num", label: l, cls: signCls(["monthlyResult", "cumResult", "cashEnd", "cashM1", "cashM2"].includes(k) ? v : null) }), { v: resLecture(k, v, r), span: 4, cls: "wrap muted" }, { v: "" }]);
    }
    R.push([{ v: "" }, { v: "Analyse du mois et plan du suivant", cls: "b" }, btn(ui.busy === "analyse" ? "Analyse en cours…" : mo.analysis ? "Relancer l'analyse" : "Analyser le mois", "analyze", {}, { span: 2, disabled: !!ui.busy }), { v: "Relit toute ta partie (prix, demande, attractivité, achats, négos, résultats) et sort le plan chiffré du mois prochain, avec deux plans B.", span: 4, cls: "wrap muted" }]);
    if (mo.analysis) R.push([{ v: "" }, { html: `<div class="cellmd">${md(mo.analysis)}</div>`, span: 7, cls: "wrap" }]);
    R.push([{ v: "" }, { v: "Ce que tu as compris ce mois-ci", cls: "b wrap" }, inp(`months.${m}.notes`, { area: true, span: 6, ph: "Ce qui a marché, ce que font les autres, ce qu'a dit le formateur…", label: "Notes du mois" })]);
  }

  /* ---------- Tableau de bord ---------- */
  function sheetDash() {
    const total = lastMonth();
    const months = Array.from({ length: total }, (_, i) => i + 1);
    const W = [36, 230].concat(months.map(() => 112));
    const R = [];
    const { m, phase } = state.current;
    R.push([{ v: "Tableau de bord", span: 2, cls: "title" }, { v: `En cours : ${MN(m)}, ${PHASE_NAME[phase]}`, span: Math.max(3, total), cls: "muted" }]);
    R.push([]);
    let lastR = null;
    for (let i = total; i >= 1; i--) { const x = state.months[i] && state.months[i].results; if (x && Object.keys(x).some((k) => N(x[k]) !== null)) { lastR = { m: i, r: x }; break; } }
    R.push(sec(lastR ? `Dernier mois connu : ${MN(lastR.m)}` : "Dernier mois connu", 2 + total));
    const r = lastR ? lastR.r : {};
    const kp = [["Résultat du mois", "monthlyResult", true], ["Résultat cumulé", "cumResult", true], ["Trésorerie fin", "cashEnd", true], ["Prévision M+1", "cashM1", true], ["Score du mois", "score", false], ["Score total", "totalScore", false], ["Classement", "rank", false]];
    R.push([{ v: "" }].concat(kp.slice(0, 1 + total).map(([l]) => ({ v: l, cls: "ch c" }))));
    R.push([{ v: "" }].concat(kp.slice(0, 1 + total).map(([, k, money]) => { const v = N(r[k]); return { v: v === null ? "" : money ? eur(v) : fmt(v, 2), cls: `c big ${money && v !== null ? (v < 0 ? "bad" : "good") : ""}` }; })));
    R.push([]);
    R.push(sec("Mois par mois", 2 + total));
    R.push(chRow([""].concat(["Indicateur"], months.map((i) => ({ v: MN(i), cls: `r ${i === m ? "cur" : ""}` })))));
    const line = (label, fn, money, colorize) => R.push([{ v: "" }, { v: label }].concat(months.map((i) => { const v = fn(i); return { v: v === null || v === undefined ? "" : money ? eur(v) : typeof v === "string" ? v : fmt(v, 2), cls: `r ${colorize ? signCls(v) : ""} ${i === m ? "cur" : ""}` }; })));
    const rv = (k) => (i) => N(E.get(state.months, [i, "results", k], null));
    line("Chiffre d'affaires", rv("turnover"), true);
    line("Résultat du mois", rv("monthlyResult"), true, true);
    line("Résultat cumulé", rv("cumResult"), true, true);
    line("Trésorerie fin de mois", rv("cashEnd"), true, true);
    line("Prévision M+1", rv("cashM1"), true, true);
    line("Prévision M+2", rv("cashM2"), true, true);
    line("Score du mois", rv("score"));
    line("Score moyen", rv("avgScore"));
    line("Score total", rv("totalScore"));
    line("Classement", rv("rank"));
    line("Demande reçue (lots)", (i) => { let t = null; for (const p of E.productsFor(state, i)) { const d = E.demandTotal(state, i, p.k); if (d !== null) t = (t || 0) + d; } return t; });
    line("Lots livrés", (i) => { const mo = state.months[i]; if (!mo || !mo.p2 || !Object.keys(mo.p2.deliveries || {}).length) return null; let t = 0; for (const p of E.productsFor(state, i)) t += E.delivered(state, i, p.k); return t; });
    line("Taux de service", (i) => { let d = 0, l = 0, any = false; for (const p of E.productsFor(state, i)) { const x = E.demandTotal(state, i, p.k); if (x !== null) { d += x; l += E.delivered(state, i, p.k); any = true; } } return any && d ? `${Math.round((l / d) * 100)} %` : null; });
    line("Attractivité moyenne", (i) => { const v = []; for (const p of E.productsFor(state, i)) for (const c of C) { const x = E.index(state, i, c.k, p.k); if (x !== null) v.push(x); } return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null; });
    R.push([]);
    const series = months.map((i) => ({ m: i, res: rv("monthlyResult")(i), cash: rv("cashEnd")(i) }));
    R.push(sec("Graphique : résultat mensuel et trésorerie", 2 + total));
    R.push([{ v: "" }, { html: chartSVG(series), span: 1 + total, cls: "chart" }]);
    R.push([]);
    R.push(sec("Attractivité par client (demande reçue ÷ besoin du guide)", 2 + total));
    R.push(chRow(["", "Mois, produit"].concat(C.map((c) => ({ v: c.label, cls: "r" })))));
    let any = false;
    for (const i of months) for (const p of E.productsFor(state, i)) {
      const vals = C.map((c) => E.index(state, i, c.k, p.k));
      if (vals.every((v) => v === null)) continue;
      any = true;
      R.push([{ v: "" }, { v: `${MN(i)}, ${p.label}` }].concat(vals.map((v) => ({ v: v === null ? "" : v.toFixed(2), cls: `r ${idxCls(v)}` }))));
    }
    if (!any) R.push([{ v: "" }, { v: "Apparaît dès que la demande reçue (Sales) est lue.", span: 4, cls: "muted" }]);
    R.push([{ v: "" }, { v: "Vert : au-dessus de 1,3, tu es plus attractif que la moyenne (monte le prix si tu es en rupture). Rouge : sous 0,7, les autres sont moins chers ou plus visibles.", span: 1 + total, cls: "wrap muted" }]);
    return grid({ cols: W, rows: R, minRows: R.length + 6 });
  }

  function chartSVG(series) {
    const W = Math.max(520, series.length * 110), H = 230, L = 64, Rr = 16, T = 26, B = 34;
    const vals = series.flatMap((s) => [s.res, s.cash]).filter((v) => v !== null);
    if (!vals.length) return `<div style="padding:24px;color:var(--muted)">Le graphique apparaît après tes premiers résultats (Results).</div>`;
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    if (lo === hi) hi = lo + 1;
    const pad = (hi - lo) * 0.08; hi += pad; if (lo < 0) lo -= pad;
    const n = series.length, bw = Math.min(36, ((W - L - Rr) / n) * 0.45);
    const x = (i) => L + ((i + 0.5) * (W - L - Rr)) / n;
    const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const ticks = [];
    for (let k = 0; k <= 4; k++) ticks.push(lo + ((hi - lo) * k) / 4);
    const gl = ticks.map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="#e1dfdd"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#605e5c">${Math.round(v / 1000)} k€</text>`).join("");
    const bars = series.map((s, i) => (s.res === null ? "" : `<rect x="${x(i) - bw / 2}" y="${Math.min(y(0), y(s.res))}" width="${bw}" height="${Math.max(1, Math.abs(y(s.res) - y(0)))}" fill="${s.res < 0 ? "#c0504d" : "#4f81bd"}"><title>${MN(s.m)} : résultat ${eur(s.res)}</title></rect>`)).join("");
    const pts = series.map((s, i) => (s.cash === null ? null : [x(i), y(s.cash), s])).filter(Boolean);
    const line = pts.length ? `<polyline fill="none" stroke="#f79646" stroke-width="2.5" points="${pts.map((p) => `${p[0]},${p[1]}`).join(" ")}"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#f79646"><title>${MN(p[2].m)} : trésorerie ${eur(p[2].cash)}</title></circle>`).join("")}` : "";
    const labels = series.map((s, i) => `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#605e5c">${MN(s.m).slice(0, 4)}.</text>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" style="max-width:100%;height:auto;display:block;border:1px solid #d2d0ce;background:#fff" role="img" aria-label="Résultat mensuel en barres et trésorerie en ligne, par mois"><text x="${W / 2}" y="16" text-anchor="middle" font-size="12" font-weight="700" fill="#1f1f1f">Résultat mensuel et trésorerie</text>${gl}<line x1="${L}" x2="${W - Rr}" y1="${y(0)}" y2="${y(0)}" stroke="#8a8886"/>${bars}${line}${labels}<rect x="${W - 250}" y="${H - 14}" width="10" height="8" fill="#4f81bd"/><text x="${W - 236}" y="${H - 6}" font-size="10.5" fill="#605e5c">Résultat</text><rect x="${W - 170}" y="${H - 14}" width="10" height="8" fill="#f79646"/><text x="${W - 156}" y="${H - 6}" font-size="10.5" fill="#605e5c">Trésorerie fin</text></svg>`;
  }

  /* ---------- Prévisions : les mois qui arrivent ---------- */
  function sheetPlan() {
    const total = lastMonth();
    const months = Array.from({ length: total }, (_, i) => i + 1);
    const W = [36, 210].concat(months.map(() => 176));
    const R = [];
    const cur = state.current.m;
    const O = months.map((i) => E.outlook(state, i));
    const curCls = (i) => (i === cur ? " cur" : "");
    R.push([{ v: "Prévisions : la partie mois par mois", span: 2 + Math.min(total, 3), cls: "title" }]);
    R.push([{ v: "" }, { v: "Ce qui va se passer, ce qu'il faut préparer, et ce qui s'est réellement passé. La colonne verte est le mois en cours. Les chiffres des mois à venir sont des repères calculés sur le guide : ils se recalent dès que tes vrais chiffres arrivent.", span: 1 + total, cls: "wrap muted" }]);
    R.push([]);
    R.push(chRow(["", "Mois"].concat(O.map((o) => ({ v: MN(o.m), cls: `c${curCls(o.m)}` })))));
    const row = (label, fn, cls) => R.push([{ v: "" }, { v: label, cls: "b wrap" }].concat(O.map((o) => { const v = fn(o); const c = typeof v === "object" && v !== null ? v : { v }; return Object.assign({}, c, { cls: `wrap ${cls || ""} ${c.cls || ""}${curCls(o.m)}` }); })));
    row("Statut", (o) => ({ v: o.status, cls: o.status === "En cours" ? "b c" : "c muted" }));
    row("Ce qui se passe", (o) => o.event);
    row("Produits vendus", (o) => o.products);
    row("Besoin guide agglomérés (lots, par distributeur)", (o) => fmt(o.needMixed), "r");
    row("Besoin guide naturels Q1 à Q4", (o) => (o.needNat ? fmt(o.needNat) : "Aucun"), "r");
    row("Charges fixes (salaires + admin)", (o) => eur(o.fixed), "r");
    row("Décaissements exceptionnels", (o) => (o.exceptional ? { v: `${eur(o.exceptional)} (stock + trieuse)`, cls: "bad" } : { v: "Aucun" }));
    row("Délais clients conseillés", (o) => o.terms);
    row("Marketing conseillé", (o) => o.marketing);
    row("Achats à lancer ce mois-là (pour le suivant)", (o) => o.buy);
    row("Résultat estimé avec les recos", (o) => ({ v: eur(o.estResult), cls: `r ${signCls(o.estResult)}` }));
    row("Résultat réel", (o) => ({ v: o.result === null ? "" : eur(o.result), cls: `r ${signCls(o.result)}` }));
    row("Trésorerie réelle (fin de mois)", (o) => ({ v: o.cash === null ? "" : eur(o.cash), cls: `r ${signCls(o.cash)}` }));
    row("À surveiller", (o) => o.watch);
    R.push([]);
    R.push([{ v: "" }, link("Aller à l'étape en cours", "sheet", { sheet: "todo" }), { v: "Si le formateur annonce un autre nombre de mois ou une autre date d'arrivée des naturels, dis-le dans la barre du haut : tout se recale.", span: total, cls: "wrap muted" }]);
    return grid({ cols: W, rows: R, minRows: R.length + 6 });
  }

  /* ---------- Saisie : toutes les données brutes d'un mois ---------- */
  function sheetData() {
    const m = Math.min(Math.max(1, N(state.ui.dataM) || state.current.m), lastMonth());
    const mo = E.month(state, m);
    const nat = E.isNat(state, m);
    const prods = E.productsFor(state, m);
    const W = [36, 230, 108, 108, 108, 108, 300];
    const R = [];
    R.push([{ v: "Saisie des données", span: 2, cls: "title" }, { v: "Mois", cls: "r muted" }, inp("ui.dataM", { type: "num", options: monthOpts(), label: "Mois affiché", reco: m }), { v: "Tout ce qui est lu dans tes captures arrive ici. Corrige une valeur en tapant par-dessus.", span: 3, cls: "wrap muted" }]);
    R.push([]);
    const table = (title, base, note) => {
      R.push(sec(title, 7));
      R.push(chRow(["", "Produit"].concat(C.map((c) => ({ v: c.label, cls: "r" })), [{ v: "Total", cls: "r" }, note ? "" : ""])));
      for (const p of prods) {
        let t = null;
        const cells = C.map((c) => { const v = N(E.get(mo, base.concat([c.k, p.k]), null)); if (v !== null) t = (t || 0) + v; return inp(`months.${m}.${base.join(".")}.${c.k}.${p.k}`, { type: "num", label: `${title} ${p.label} ${c.label}` }); });
        R.push([{ v: "" }, { v: p.label, cls: "b" }].concat(cells, [{ v: fmt(t), cls: "r" }, { v: "" }]));
      }
    };
    R.push(sec("Planning (prix en € par lot, délais, publicité)", 7));
    R.push(chRow(["", "Produit"].concat(C.map((c) => ({ v: c.label, cls: "r" })), ["", ""])));
    for (const p of prods) R.push([{ v: "" }, { v: p.label, cls: "b" }].concat(C.map((c) => inp(`months.${m}.p1.prices.${c.k}.${p.k}`, { type: "num", label: `Prix ${p.label} ${c.label}` })), [{ v: "" }, { v: "" }]));
    R.push([{ v: "" }, { v: "Délai de paiement", cls: "b" }].concat(C.map((c) => inp(`months.${m}.p1.terms.${c.k}`, { options: E.TERMS, blank: true, label: `Délai ${c.label}` })), [{ v: "" }, { v: "" }]));
    if (nat) R.push([{ v: "" }, { v: "Action marketing ciblée", cls: "b" }].concat(C.map((c) => inp(`months.${m}.p1.marketing.${c.k}`, { options: E.MKT, blank: true, label: `Marketing ${c.label}` })), [{ v: "" }, { v: "" }]));
    R.push([{ v: "" }, { v: "Pub produit (€)", cls: "b" }, inp(`months.${m}.p1.adProduct`, { type: "num", label: "Pub produit" }), { v: "", span: 4 }]);
    R.push([]);
    R.push(sec("Stock en début de phase 2 (lots)", 7));
    const sk = nat ? ["mixed", "A", "B", "C", "Q1", "Q2", "Q3", "Q4"] : ["mixed"];
    for (let i = 0; i < sk.length; i += 4) {
      const part = sk.slice(i, i + 4);
      R.push([{ v: "" }, { v: "Produit", cls: "ch" }].concat(part.map((k) => ({ v: prodLabel(k), cls: "ch r" }))));
      R.push([{ v: "" }, { v: "Stock", cls: "b" }].concat(part.map((k) => inp(`months.${m}.p2.stock.${k}`, { type: "num", label: `Stock ${prodLabel(k)}` }))));
    }
    R.push([]);
    table("Demande reçue (Sales, Quantity of ordered products)", ["p2", "demand"]);
    R.push([]);
    if (nat) {
      R.push(sec("Tri (lots à trier)", 7));
      R.push([{ v: "" }, { v: "Origine", cls: "ch" }, { v: "Espagne A", cls: "ch r" }, { v: "Espagne B", cls: "ch r" }, { v: "Espagne C", cls: "ch r" }]);
      R.push([{ v: "" }, { v: "Lots triés", cls: "b" }].concat(["A", "B", "C"].map((o) => inp(`months.${m}.p2.sort.${o}`, { type: "num", label: `Tri ${o}` }))));
      R.push([]);
    }
    table("Livraisons (Sales, Quantity of final products to deliver)", ["p2", "deliveries"]);
    R.push([]);
    R.push(sec("Résultats du mois", 7));
    for (let i = 0; i < RES_FIELDS.length; i += 2) {
      const a = RES_FIELDS[i], b = RES_FIELDS[i + 1];
      R.push([{ v: "" }, { v: a[1] }, inp(`months.${m}.results.${a[0]}`, { type: "num", label: a[1] }), { v: "" }].concat(b ? [{ v: b[1], span: 1 }, inp(`months.${m}.results.${b[0]}`, { type: "num", label: b[1] })] : []));
    }
    R.push([]);
    R.push(sec("Notes du mois", 7));
    R.push([{ v: "" }, inp(`months.${m}.notes`, { area: true, span: 6, ph: "Ce que tu as compris, ce que font les autres…", label: "Notes du mois" })]);
    return grid({ cols: W, rows: R, minRows: R.length + 6 });
  }

  /* ---------- Négociations ---------- */
  function sheetNego() {
    const W = [36, 96, 92, 130, 86, 110, 92, 84, 124, 110, 280, 70];
    const R = [];
    const mOpts = monthOpts();
    const m = state.current.m;
    const nb = E.negoBrief(state, m);
    R.push([{ v: "Négociations", span: 3, cls: "title" }, { v: `Préparation de ${MN(m)} : tes limites, le rapport de force, tes arguments et quoi répondre. Puis chaque offre avec le verdict de l'outil.`, span: 8, cls: "wrap muted" }]);
    R.push([]);
    R.push(sec(`1. Tes limites en ${MN(m)} (à ne jamais franchir)`, 12));
    R.push(chRow(["", { v: "Ce que tu négocies", span: 2 }, { v: "Quantité", cls: "r" }, { v: "Ouvre à", cls: "r" }, { v: "Vise", cls: "r" }, { v: "Limite", cls: "r" }, "Délai", { v: "Ce que tu peux lâcher", span: 2 }, "Pourquoi cette limite", ""]));
    for (const l of nb.limits) {
      R.push([{ v: "" }, { v: l.label, span: 2, cls: "wrap b" }, { v: l.qty === null || l.qty === undefined ? "" : `${fmt(l.qty)} lots`, cls: "r" }, { v: l.anchor === null ? "" : `${l.anchor} €`, cls: "r" }, { v: l.target === null ? "" : `${l.target} €`, cls: l.target === null ? "" : "r good" }, { v: `${l.limitLabel === "plancher" ? "min " : "max "}${l.limit} €`, cls: "r bad b", note: l.limitLabel === "plancher" ? "Plancher : en dessous, tu refuses." : "Plafond : au-dessus, tu refuses ou tu baisses le volume." }, { v: l.term, cls: "wrap" }, { v: l.give, span: 2, cls: "wrap muted" }, { v: l.why, cls: "wrap muted" }, { v: "" }]);
    }
    R.push([{ v: "" }, { v: "« Ouvre à » : ton premier chiffre, justifié. « Vise » : là où tu veux finir. « Limite » : au-delà tu dis non, même en fin de phase. Les repères se changent dans Paramètres.", span: 10, cls: "wrap muted" }]);
    R.push([]);
    R.push(sec("2. Le rapport de force ce mois-ci", 12));
    for (const t of nb.power) R.push([{ v: "" }, { v: t, span: 10, cls: "wrap" }]);
    R.push([]);
    R.push(sec("3. Tes arguments (à copier dans tes mails ou à dire)", 12));
    R.push(chRow(["", { v: "Ce que tu dis", span: 6 }, { v: "Quand l'utiliser", span: 3 }, ""]));
    for (const a of nb.args) R.push([{ v: "" }, { v: a.t, span: 6, cls: "wrap b" }, { v: a.when, span: 3, cls: "wrap muted" }, link("Copier", "copy", { text: a.t.replace(/^« | »$/g, "") }, { cls: "c" })]);
    R.push([]);
    R.push(sec("4. Ce qu'ils vont te dire, et quoi répondre", 12));
    R.push(chRow(["", { v: "Ils disent", span: 4 }, { v: "Tu réponds", span: 6 }]));
    for (const o of nb.objections) R.push([{ v: "" }, { v: o.they, span: 4, cls: "wrap" }, { v: o.you, span: 6, cls: "wrap b" }]);
    R.push([]);
    R.push(sec("5. Les règles d'or", 12));
    for (const t of nb.rules) R.push([{ v: "" }, { v: t, span: 10, cls: "wrap" }]);
    R.push([{ v: "" }, { v: `Si ça bloque : ${nb.batna}`, span: 10, cls: "wrap mid" }]);
    R.push([]);
    R.push(sec("6. Ajouter une offre à la main", 12));
    R.push(chRow(["", "Mois", "Sens", "Contrepartie", "Type", "Produit", { v: "Quantité", cls: "r" }, { v: "Prix", cls: "r" }, "Délai", "Statut", "", ""]));
    const s = (id, opts, cur) => `<select id="${id}" aria-label="${id}">${opts.map((o) => `<option value="${esc(o.k)}" ${String(o.k) === String(cur) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
    const t = (id, ph, num) => `<input type="text" id="${id}" placeholder="${esc(ph || "")}" ${num ? 'inputmode="decimal"' : ""} aria-label="${id}">`;
    R.push([{ v: "" }, { html: s("of-month", mOpts, state.current.m), cls: "in" }, { html: s("of-dir", [{ k: "in", label: "Reçue" }, { k: "out", label: "Envoyée" }], "in"), cls: "in" }, { html: t("of-cp", "I1_…"), cls: "in l" }, { html: s("of-type", [{ k: "buy", label: "Achat" }, { k: "sell", label: "Vente" }], "buy"), cls: "in" }, { html: s("of-prod", PRODS_ALL, "mixed"), cls: "in" }, { html: t("of-qty", "", true), cls: "in" }, { html: t("of-price", "", true), cls: "in" }, { html: s("of-term", E.TERMS, "60"), cls: "in" }, { html: s("of-status", STATUS, "pending"), cls: "in" }, btn("Ajouter", "add-offer"), { v: "" }]);
    R.push([]);
    const offers = (state.offers || []).map((o, i) => ({ o, i })).sort((a, b) => (N(b.o.month) || 0) - (N(a.o.month) || 0) || (b.o.t || 0) - (a.o.t || 0));
    R.push(sec(`7. Toutes les offres (${offers.length})`, 12));
    R.push(chRow(["", "Mois", "Sens", "Contrepartie", "Type", "Produit", { v: "Quantité", cls: "r" }, { v: "Prix", cls: "r" }, "Délai", "Statut", "Verdict de l'outil", ""]));
    if (!offers.length) R.push([{ v: "" }, { v: "Aucune offre pour l'instant.", span: 10, cls: "muted" }]);
    for (const { o, i } of offers) {
      const j = judge(o);
      const p = (f) => `offers.${i}.${f}`;
      R.push([{ v: "" }, inp(p("month"), { type: "num", options: mOpts, label: "Mois" }), inp(p("dir"), { options: [{ k: "in", label: "Reçue" }, { k: "out", label: "Envoyée" }], label: "Sens" }), inp(p("counterpart"), { type: "text", left: true, label: "Contrepartie" }), inp(p("type"), { options: [{ k: "buy", label: "Achat" }, { k: "sell", label: "Vente" }], label: "Type" }), inp(p("product"), { options: PRODS_ALL, label: "Produit" }), inp(p("qty"), { type: "num", label: "Quantité" }), inp(p("price"), { type: "num", label: "Prix" }), inp(p("term"), { options: E.TERMS, label: "Délai" }), inp(p("status"), { options: STATUS, label: "Statut" }), j ? { v: `${j.label}${j.counter ? `. Contre-offre : ${j.counter} €` : ""}`, cls: `wrap ${j.verdict === "ok" ? "good" : j.verdict === "nego" ? "mid" : "bad"}` } : { v: "" }, link("Suppr.", "del-offer", { i }, { cls: "c" })]);
    }
    R.push([]);
    const myId = state.settings.myId || "D…";
    const mails = [
      ["Ouverture, à tous les industriels", `Bonjour, ici ${myId}, distributeur. Je cherche un ou deux partenaires fiables sur plusieurs mois. Pour préparer, pouvez-vous m'indiquer votre stock disponible et vos conditions ? Je reviens vers vous avant la fin de la phase.`],
      ["Appel d'offres (mars)", `Bonjour, je lance une consultation pour avril : 4 000 lots d'Espagne A, paiement 60 jours après livraison. Je retiens les deux meilleures propositions reçues avant [heure]. Je suis prêt à m'engager sur avril, mai et juin avec le partenaire retenu.`],
      ["Trois options, à ton fournisseur favori", `Je te propose trois formules au choix pour 3 000 lots d'A : 50 € à 60 jours ; 46 € payés à la livraison ; 44 € si on s'engage aussi sur mai et juin. Dis-moi celle qui t'arrange.`],
      ["Accord écrit (preuve en cas de litige)", `Pour confirmer notre accord : ${myId} achète [quantité] lots de [produit] à [prix] € le lot, paiement [délai], livraison [mois]. Si l'offre n'est pas envoyée dans le simulateur avant la fin de la phase, l'accord tombe. Merci de me confirmer par retour.`]
    ];
    R.push(sec("8. Mails prêts à copier", 12));
    for (const [title, txt] of mails) R.push([{ v: "" }, { v: title, span: 2, cls: "b wrap" }, { v: txt, span: 8, cls: "wrap" }, link("Copier", "copy", { text: txt }, { cls: "c" })]);
    R.push([]);
    const teams = (state.settings.teams || []).filter((x) => /^[ID]/i.test(x));
    const seen = Array.from(new Set(teams.concat((state.offers || []).map((o) => o.counterpart).filter((x) => x && x !== "Externe"))));
    R.push(sec("9. Ce que tu sais de chaque équipe", 12));
    if (!seen.length) R.push([{ v: "" }, { v: "La liste des équipes se remplit avec une capture de l'Email Box (liste des destinataires).", span: 10, cls: "muted" }]);
    for (const tm of seen) R.push([{ v: "" }, { v: tm, span: 2, cls: "b" }, inp(`partners.${tm.replace(/[^\w-]/g, "_")}.note`, { type: "text", left: true, span: 9, ph: "Stock ? trésorerie ? fiable ? prix pratiqués ?", label: `Notes ${tm}` })]);
    return grid({ cols: W, rows: R, minRows: R.length + 6 });
  }

  /* ---------- Notes (journal) ---------- */
  function sheetNotes() {
    const W = [36, 120, 90, 110, 760];
    const R = [];
    R.push([{ v: "Notes", span: 2, cls: "title" }, { v: "Tout ce qui a été lu, demandé et répondu, plus tes propres notes. Le plus récent en haut.", span: 3, cls: "muted" }]);
    R.push([]);
    R.push([{ v: "" }, { v: "Nouvelle note", cls: "b" }, { html: `<textarea id="j-text" placeholder="Ex. I2 a l'air à court de cash, il a baissé son A à 47 € en fin de phase." aria-label="Nouvelle note"></textarea>`, span: 2, cls: "in" }, link("Ajouter", "add-journal")]);
    R.push([]);
    R.push(chRow(["", "Quand", "Mois", "Type", "Texte"]));
    const items = (state.journal || []).slice().reverse().slice(0, 300);
    if (!items.length) R.push([{ v: "" }, { v: "Vide pour l'instant.", span: 4, cls: "muted" }]);
    for (const j of items) R.push([{ v: "" }, { v: j.when || "", cls: "muted" }, { v: j.m ? MN(j.m) : "", cls: "muted" }, { v: j.kind || "Note" }, { html: `<div class="cellmd">${md(j.text)}</div>`, cls: "wrap" }]);
    return grid({ cols: W, rows: R, minRows: R.length + 6, minCols: 8 });
  }

  /* ---------- Paramètres ---------- */
  function sheetSettings() {
    const s = state.settings;
    const W = [36, 250, 82, 82, 82, 82, 82, 82, 320];
    const R = [];
    const row = (label, cell, note) => R.push([{ v: "" }, { v: label }, cell, { v: "", span: 5 }, { v: note || "", cls: "wrap muted" }]);
    R.push([{ v: "Paramètres de la session", span: 3, cls: "title" }, { v: "Valeurs des vidéos Sciado par défaut. Le plus simple : capture les écrans Settings et le guide, ils se remplissent seuls.", span: 6, cls: "wrap muted" }]);
    R.push([]);
    R.push(sec("Ta session", 9));
    row("Ton identifiant", inp("settings.myId", { type: "text", left: true, ph: "D2_42140", label: "Identifiant" }), "Affiché dans le jeu en haut à droite.");
    row("Nombre de distributeurs", inp("settings.nDist", { type: "num", label: "Distributeurs" }), "Rempli par la liste des équipes de l'Email Box.");
    row("Nombre d'industriels", inp("settings.nInd", { type: "num", label: "Industriels" }), "Plus d'industriels que de distributeurs : les prix d'achat baissent.");
    row("Nombre de mois joués", inp("settings.months", { type: "num", label: "Mois joués" }), "Le dernier mois, on n'achète rien.");
    row("Naturels à partir du mois", inp("settings.naturalsFrom", { type: "num", label: "Naturels à partir de" }), "3 = mars dans les vidéos.");
    R.push([{ v: "" }, { v: "Équipes (séparées par des virgules)" }, inp("settings.teams", { type: "list", left: true, span: 6, label: "Équipes", ph: "D1_..., D2_..., I1_..." }), { v: "" }]);
    R.push([]);
    R.push(sec("Stock de départ et coûts", 9));
    row("Stock de départ (lots)", inp("settings.startStock", { type: "num", label: "Stock de départ" }));
    row("Valeur de ce stock (€)", inp("settings.startStockValue", { type: "num", label: "Valeur du stock" }), `Coût par lot utilisé : ${fmt(E.mixedCost(state), 2)} €. On ne vend jamais d'aggloméré en dessous.`);
    row("Coût d'achat agglo par défaut (€)", inp("settings.mixedCost", { type: "num", label: "Coût agglo" }));
    row("Prix d'achat Espagne A / B / C (€)", inp("settings.naturalCost.A", { type: "num", label: "Prix A" }));
    R[R.length - 1][3] = inp("settings.naturalCost.B", { type: "num", label: "Prix B" });
    R[R.length - 1].splice(4, 0, inp("settings.naturalCost.C", { type: "num", label: "Prix C" }));
    R[R.length - 1][5] = { v: "", span: 3 };
    R.push([]);
    R.push(sec("Charges mensuelles", 9));
    row("Salaires avant les naturels (€)", inp("settings.fixed.wages", { type: "num", label: "Salaires" }));
    row("Salaires dès les naturels (€)", inp("settings.fixed.wagesNat", { type: "num", label: "Salaires naturels" }));
    row("Frais administratifs (€)", inp("settings.fixed.admin", { type: "num", label: "Admin" }));
    row("Stockage (% de la valeur du stock)", inp("settings.fixed.storagePct", { type: "num", label: "Stockage" }));
    R.push([]);
    R.push(sec("Fourchettes de prix clients (min et max, € par lot)", 9));
    R.push(chRow(["", "Produit"].concat(C.flatMap((c) => [{ v: `${c.label} min`, cls: "r" }, { v: "max", cls: "r" }]), [""])));
    for (const p of E.PRODUCTS) R.push([{ v: "" }, { v: p.label, cls: "b" }].concat(C.flatMap((c) => [inp(`settings.ranges.${c.k}.${p.k}.0`, { type: "num", label: `${p.label} ${c.label} min` }), inp(`settings.ranges.${c.k}.${p.k}.1`, { type: "num", label: `${p.label} ${c.label} max` })]), [{ v: "" }]));
    R.push([]);
    const nm = Math.min(Math.max(1, N(state.ui.needsM) || 3), 10);
    R.push(sec("Besoins du guide, par distributeur (lots par mois)", 9));
    R.push([{ v: "" }, { v: "Mois affiché" }, inp("ui.needsM", { type: "num", options: Array.from({ length: Math.max(lastMonth(), 6) }, (_, i) => ({ k: i + 1, label: MN(i + 1) })), reco: nm, label: "Mois des besoins" }), { v: "Sert à calculer ton attractivité et tes achats.", span: 5, cls: "muted" }]);
    R.push(chRow(["", "Produit"].concat(C.map((c) => ({ v: c.label, cls: "r" })))));
    for (const p of E.PRODUCTS) R.push([{ v: "" }, { v: p.label, cls: "b" }].concat(C.map((c) => inp(`settings.needs.${nm}.${c.k}.${p.k}`, { type: "num", label: `Besoin ${p.label} ${c.label}` }))));
    R.push([]);
    R.push(sec("Trieuse (rendements en %)", 9));
    R.push(chRow(["", "Origine", { v: "Q1", cls: "r" }, { v: "Q2", cls: "r" }, { v: "Q3", cls: "r" }, { v: "Q4", cls: "r" }]));
    for (const o of ["A", "B", "C"]) R.push([{ v: "" }, { v: `Espagne ${o}`, cls: "b" }].concat([0, 1, 2, 3].map((i) => inp(`settings.yields.${o}.${i}`, { type: "num", label: `Rendement ${o} Q${i + 1}` }))));
    row("Coût du tri par lot (€)", inp("settings.sortCost", { type: "num", label: "Coût du tri" }));
    row("Capacité de la trieuse (lots par mois)", inp("settings.sortCap", { type: "num", label: "Capacité" }));
    R.push([]);
    R.push(sec("Repères d'achat (€ par lot)", 9));
    R.push(chRow(["", "Produit", { v: "Ouvre à", cls: "r" }, { v: "Vise", cls: "r" }, { v: "Plafond", cls: "r" }]));
    for (const [k, l] of [["mixedEarly", "Agglomérés avant les naturels"], ["mixedLate", "Agglomérés après"], ["A", "Espagne A"], ["B", "Espagne B"], ["C", "Espagne C"]]) R.push([{ v: "" }, { v: l, cls: "b" }].concat(["anchor", "target", "ceiling"].map((f) => inp(`settings.buyTargets.${k}.${f}`, { type: "num", label: `${l} ${f}` }))));
    R.push([]);
    R.push(sec("Calcul du score (guide utilisateur)", 9));
    R.push([{ v: "" }, inp("settings.scoreNotes", { area: true, span: 8, ph: "Recopie ou capture la règle exacte du score : l'analyse s'en sert pour prioriser.", label: "Calcul du score" })]);
    R.push([]);
    R.push(sec("Affichage et discrétion", 9));
    row("Nom du fichier affiché", inp("settings.fileName", { type: "text", left: true, span: 1, label: "Nom du fichier" }), "Titre de l'onglet du navigateur.");
    row("Masquer les commentaires après", inp("settings.idleSec", { type: "num", options: [{ k: 0, label: "Jamais" }, { k: 30, label: "30 s" }, { k: 60, label: "1 min" }, { k: 120, label: "2 min" }], label: "Masquer après" }), "Sans activité, le volet des commentaires et les bulles se ferment. Échap le fait tout de suite.");
    R.push([]);
    R.push(sec("Données", 9));
    R.push([{ v: "" }, link("Exporter une copie de sauvegarde", "export"), link("Ouvrir une copie", "import-file", {}, { span: 2 }), link("Tester la connexion", "ping", {}, { span: 2 }), { v: "", span: 2 }, link("Tout effacer", "reset")]);
    R.push([{ v: "" }, { v: "Tout est enregistré dans ce navigateur, sur cet ordinateur. Exporte une copie pour changer de machine ou par sécurité.", span: 8, cls: "wrap muted" }]);
    return grid({ cols: W, rows: R, minRows: R.length + 6 });
  }

  /* ---------- Rendu ---------- */
  const SHEETS = [["todo", "À faire"], ["dash", "Tableau de bord"], ["plan", "Prévisions"], ["data", "Saisie"], ["nego", "Négos"], ["notes", "Notes"], ["settings", "Paramètres"]];
  function sheetHTML() {
    switch (state.ui.sheet) {
      case "dash": return sheetDash();
      case "plan": return sheetPlan();
      case "data": return sheetData();
      case "nego": return sheetNego();
      case "notes": return sheetNotes();
      case "settings": return sheetSettings();
      default: return sheetTodo();
    }
  }
  function scheduleRender() {
    if (ui.pointerDown) { ui.pendingRender = true; return; }
    requestAnimationFrame(render);
  }
  function render() {
    const a = document.activeElement;
    const ap = a && a.dataset ? a.dataset.path : null;
    const wrap = document.getElementById("sheet");
    const st = wrap.scrollTop, sl = wrap.scrollLeft;
    document.documentElement.style.setProperty("--fs", `${(13 * (N(state.settings.zoom) || 100)) / 100}px`);
    document.title = state.settings.fileName || "Suivi_distribution_2026.xlsx";
    document.getElementById("fname").textContent = state.settings.fileName || "Suivi_distribution_2026.xlsx";
    wrap.innerHTML = sheetHTML();
    wrap.scrollTop = st; wrap.scrollLeft = sl;
    renderTabs();
    renderStatus();
    renderPane();
    if (ap) {
      const el = wrap.querySelector(`[data-path="${CSS.escape(ap)}"]`);
      if (el && el.type !== "checkbox" && el.tagName !== "SELECT") { el.focus({ preventScroll: true }); }
    }
    if (ui.sel) { const td = wrap.querySelector(`td[data-ref="${ui.sel}"]`); if (td) td.classList.add("sel"); }
  }
  function renderTabs() {
    document.getElementById("tabs").innerHTML = SHEETS.map(([k, l]) => `<button class="${state.ui.sheet === k ? "on" : ""}" data-act="sheet" data-sheet="${k}">${l}</button>`).join("");
  }
  function renderStatus() {
    const { m, phase } = state.current;
    const z = N(state.settings.zoom) || 100;
    document.getElementById("status").innerHTML = `<span class="grow">${ui.busy ? `<span class="busy"></span>${esc(ui.busyText || "Calcul…")}` : "Prêt"}</span><span>${esc(MN(m))}, ${esc(PHASE_NAME[phase])}</span><span class="zoom"><button data-act="zoom" data-d="-10" aria-label="Zoom arrière">&minus;</button><span>${z} %</span><button data-act="zoom" data-d="10" aria-label="Zoom avant">+</button></span>`;
    const fx = document.getElementById("fx");
    fx.placeholder = ui.busy ? "Lecture en cours…" : "Saisie rapide : une info, une question, ou colle une capture (Ctrl+V). Entrée pour valider.";
  }
  function renderPane() {
    const pane = document.getElementById("pane");
    const b = document.getElementById("pane-btn");
    b.classList.toggle("on", ui.pane);
    b.innerHTML = `Commentaires${!ui.pane && ui.unread ? `<span class="count">${ui.unread}</span>` : ""}`;
    if (!ui.pane) { pane.hidden = true; pane.innerHTML = ""; return; }
    pane.hidden = false;
    const items = (state.chat || []).slice(-40);
    const body = items.length ? items.map((x, i) => {
      const me = x.role === "user";
      const ch = x.changes && x.changes.length ? `<details class="cmt-ch"><summary>${x.changes.length} cellule${x.changes.length > 1 ? "s" : ""} mise${x.changes.length > 1 ? "s" : ""} à jour</summary><ul>${x.changes.slice(0, 60).map((c) => `<li>${esc(c.label)} : ${esc(c.show)}</li>`).join("")}</ul></details>` : "";
      const undo = x.undoId && ui.undo[x.undoId] ? `<div class="cmt-act"><a data-act="undo" data-id="${x.undoId}">Annuler ces modifications</a></div>` : "";
      return `<div class="cmt ${x.err ? "err" : ""}"><div class="cmt-h"><span class="cmt-av ${me ? "me" : ""}">${me ? "MOI" : "AN"}</span><span>${me ? "Moi" : "Analyse"}${x.when ? `, ${esc(x.when)}` : ""}</span></div><div class="cmt-b">${me ? esc(x.content) : md(x.content)}</div>${ch}${undo}</div>`;
    }).join("") : `<p style="color:var(--muted)">Les réponses et ce qui a été lu dans tes captures s'affichent ici. Écris dans la barre fx en haut, ou colle une capture.</p>`;
    pane.innerHTML = `<div class="pane-head"><b>Commentaires</b><button data-act="pane-close" aria-label="Fermer">&times;</button></div><div class="pane-body" id="pane-body">${body}${ui.busy ? `<div class="cmt"><div class="cmt-h"><span class="cmt-av">AN</span><span>Analyse</span></div><div class="cmt-b" style="color:var(--muted)">${esc(ui.busyText || "Lecture…")}</div></div>` : ""}</div><div class="pane-foot">${(state.chat || []).length ? `<a data-act="chat-reset">Effacer la conversation</a>` : "Échap pour masquer"}</div>`;
    const pb = document.getElementById("pane-body");
    if (pb) pb.scrollTop = pb.scrollHeight;
  }
  function openPane() { ui.pane = true; ui.unread = 0; renderPane(); }

  /* ---------- IA ---------- */
  async function api(payload) {
    const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    let j;
    try { j = await r.json(); } catch (e) { j = { error: r.status === 413 ? "Captures trop lourdes : envoie-en moins à la fois." : `Réponse illisible du serveur (${r.status}).` }; }
    if (!r.ok || j.error) throw new Error(j.error || `Erreur ${r.status}`);
    return j;
  }
  function aiState() {
    const s = E.summary(state);
    const { m, phase } = state.current;
    try {
      const prods = E.productsFor(state, m);
      s.toolRecos = {
        month: m, phase,
        prices: Object.fromEntries(C.map((c) => [c.k, Object.fromEntries(prods.map((p) => [p.k, E.effPrice(state, m, c.k, p.k)]))])),
        terms: Object.fromEntries(C.map((c) => [c.k, E.effTerm(state, m, c.k)])),
        marketing: E.effMarketing(state, m),
        sort: E.recoSort(state, m),
        deliveries: E.allocate(state, m),
        purchasePlan: E.purchasePlan(state, m),
        checks: E.checks(state, m, phase),
        alerts: E.alerts(state, m, phase === 3 ? 2 : phase).map((a) => a.t),
        estimate: E.estimate(state, m, false)
      };
    } catch (e) { /* recos indisponibles */ }
    return s;
  }
  function ctxNow() {
    const { m, phase } = state.current;
    return { m, phase, monthName: MN(m), phaseName: PHASE_NAME[phase], steps: E.steps(state, m, phase).map((s) => `${s.screen} (${s.where})`).join(" ; "), myId: state.settings.myId };
  }
  function history() {
    return (state.chat || []).filter((x) => !x.err).slice(-6).map((x) => ({ role: x.role, content: x.content }));
  }
  function setBusy(t) { ui.busy = t ? "lecture" : null; ui.busyText = t || ""; renderStatus(); if (ui.pane) renderPane(); }

  function ingest(files, text) {
    ui.chain = ui.chain.then(() => doIngest(files || [], text || "")).catch(() => {});
    return ui.chain;
  }
  async function doIngest(files, text) {
    const imgs = [], pdfs = [];
    let extra = "";
    for (const f of files) {
      try {
        if (f.type && f.type.startsWith("image/")) imgs.push(await compressImage(f));
        else if (f.type === "application/pdf") {
          if (f.size > 3.2e6) { toast("PDF trop lourd (3 Mo max) : fais plutôt des captures des pages utiles."); continue; }
          pdfs.push({ kind: "pdf", data: await readBase64(f), name: f.name });
        } else if ((f.type && f.type.startsWith("text/")) || /\.(txt|csv|md)$/i.test(f.name || "")) extra += `\n${await f.text()}`;
        else toast(`Format non pris en charge : ${f.name || "fichier"}`);
      } catch (e) { toast(e.message); }
    }
    text = (text + extra).trim();
    if (!imgs.length && !pdfs.length && !text) return;
    const label = [imgs.length ? `${imgs.length} capture${imgs.length > 1 ? "s" : ""}` : "", pdfs.length ? `${pdfs.length} PDF` : "", text ? (text.length > 160 ? `${text.slice(0, 160)}…` : text) : ""].filter(Boolean).join(" + ");
    state.chat.push({ role: "user", content: label, when: now() });
    setBusy(imgs.length || pdfs.length ? `Lecture de ${[imgs.length ? `${imgs.length} capture${imgs.length > 1 ? "s" : ""}` : "", pdfs.length ? `${pdfs.length} PDF` : ""].filter(Boolean).join(" et ")}…` : "Analyse de ta saisie…");
    if (!ui.pane) ui.unread++;
    renderPane();
    const ctx = Object.assign(ctxNow(), { hasText: !!text });
    const groups = batches(imgs).map((g) => ({ images: g }));
    for (const p of pdfs) groups.push({ pdf: p });
    if (!groups.length) groups.push({});
    const hist = history().slice(0, -1);
    const st = aiState();
    const results = new Array(groups.length);
    let idx = 0, errs = [];
    async function worker() {
      while (idx < groups.length) {
        const gi = idx++;
        const g = groups[gi];
        const payload = { action: "smart", context: ctx, text: gi === 0 ? text : "", images: (g.images || []).map((f) => ({ mediaType: f.mediaType, data: f.data })), state: st, history: hist };
        if (g.pdf) payload.pdf = { data: g.pdf.data };
        try { results[gi] = await api(payload); } catch (e) { errs.push(e.message); }
      }
    }
    await Promise.all([worker(), worker(), worker()].slice(0, Math.min(3, groups.length)));
    const changes = [], replies = [];
    for (const r of results) {
      if (!r) continue;
      try { changes.push(...applyData(r.data || {}, ctx)); } catch (e) { errs.push(`Rangement impossible : ${e.message}`); }
      if (r.reply) replies.push(r.reply);
    }
    let undoId = null;
    if (changes.length) {
      undoId = `u${Date.now()}`;
      ui.undo[undoId] = changes;
      ui.lastUndo = undoId;
      state.journal.push({ when: now(), m: state.current.m, kind: "Lu", text: `${changes.length} valeur(s) rangée(s) : ${changes.slice(0, 12).map((c) => `${c.label} ${c.show}`).join(" ; ")}${changes.length > 12 ? " ; …" : ""}` });
      flash(changes.map((c) => c.path));
    }
    let content = replies.join("\n\n");
    if (errs.length) content += `${content ? "\n\n" : ""}Problème : ${errs.join(" ; ")}. Réessaie, ou saisis la valeur dans la feuille Saisie.`;
    if (!content) content = changes.length ? "C'est rangé." : "Je n'ai rien trouvé d'exploitable. Essaie une capture plus nette ou colle le texte de la page.";
    state.chat.push({ role: "assistant", content, when: now(), changes: changes.map((c) => ({ label: c.label, show: c.show })), undoId, err: !results.some(Boolean) });
    if (text && replies.length) state.journal.push({ when: now(), m: state.current.m, kind: "Échange", text: `**Toi :** ${label}\n\n${replies.join("\n\n")}` });
    if (state.chat.length > 120) state.chat = state.chat.slice(-120);
    if (state.journal.length > 600) state.journal = state.journal.slice(-600);
    setBusy(null);
    save();
    ui.pane = true; ui.unread = 0;
    render();
  }

  function flash(paths) {
    for (const p of paths) ui.flash.add(p);
    clearTimeout(ui.flashT);
    ui.flashT = setTimeout(() => { ui.flash.clear(); render(); }, 9000);
  }

  /* Range les données renvoyées par l'IA au bon endroit, et liste ce qui a changé */
  function normClient(k) {
    const s = String(k || "").toLowerCase().replace(/[\s_-]/g, "");
    if (["winemakers", "keyacc", "cellars"].includes(s)) return s;
    if (/wine|vign/.test(s)) return "winemakers";
    if (/cell|cav|sell/.test(s)) return "cellars";
    if (/key|trad|grand|nego/.test(s)) return "keyacc";
    return null;
  }
  function normProd(k) {
    const s = String(k || "").trim();
    const q = s.match(/\bq\s?([1-4])\b/i);
    if (q) return `Q${q[1]}`;
    if (/^(mixed|agglo)/i.test(s)) return "mixed";
    if (/^[abc]$/i.test(s)) return s.toUpperCase();
    const mm = s.match(/(?:spain|espagne)\s*([abc])\b/i);
    if (mm) return mm[1].toUpperCase();
    return null;
  }
  function normTerm(v) {
    const s = String(v || "").toLowerCase();
    if (/60/.test(s)) return "60";
    if (/30/.test(s)) return "30";
    if (/order|commande/.test(s)) return "order";
    if (/deliv|livraison/.test(s)) return "delivery";
    return null;
  }
  function normMkt(v) {
    const s = String(v || "").toLowerCase();
    if (/flyer/.test(s)) return "flyers";
    if (/mail/.test(s)) return "emailing";
    if (/visit/.test(s)) return "visit";
    if (/none|aucun|^$/.test(s)) return "none";
    return null;
  }
  function applyData(d, ctx) {
    const changes = [];
    if (!d || typeof d !== "object") return changes;
    const last = lastMonth();
    let m = N(d.month);
    if (!m || m < 1 || m > 10) m = null;
    const mD = m || ctx.m;
    const mR = m || (ctx.phase === 3 ? ctx.m : Math.max(1, ctx.m - 1));
    const put = (path, val, label, show) => {
      if (val === null || val === undefined || val === "" || (typeof val === "number" && isNaN(val))) return;
      const old = getP(path);
      if (JSON.stringify(old) === JSON.stringify(val)) return;
      setP(path, val);
      changes.push({ path, old: old === undefined ? undefined : JSON.parse(JSON.stringify(old)), label, show: show !== undefined ? show : typeof val === "number" ? fmt(val, 2) : Array.isArray(val) ? val.join(" à ") : String(val) });
    };
    const each = (obj, fn) => { if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) fn(k, v); };
    E.month(state, mD);
    each(d.stock, (k, v) => { const p = normProd(k); if (p) put(`months.${mD}.p2.stock.${p}`, N(v), `${MN(mD)}, stock ${prodLabel(p)}`); });
    let demandChanged = false;
    each(d.demand, (ck, o) => { const c = normClient(ck); if (c) each(o, (pk, v) => { const p = normProd(pk); if (p) { const n0 = changes.length; put(`months.${mD}.p2.demand.${c}.${p}`, N(v), `${MN(mD)}, demande ${clientLabel(c)} ${prodLabel(p)}`); if (changes.length > n0) demandChanged = true; } }); });
    each(d.deliveries, (ck, o) => { const c = normClient(ck); if (c) each(o, (pk, v) => { const p = normProd(pk); if (p && N(v)) put(`months.${mD}.p2.deliveries.${c}.${p}`, N(v), `${MN(mD)}, livraison ${clientLabel(c)} ${prodLabel(p)}`); }); });
    each(d.prices, (ck, o) => { const c = normClient(ck); if (c) each(o, (pk, v) => { const p = normProd(pk); if (p) put(`months.${mD}.p1.prices.${c}.${p}`, N(v), `${MN(mD)}, prix ${clientLabel(c)} ${prodLabel(p)}`, `${fmt(N(v), 2)} €`); }); });
    each(d.terms, (ck, v) => { const c = normClient(ck); const t = normTerm(v); if (c && t) put(`months.${mD}.p1.terms.${c}`, t, `${MN(mD)}, délai ${clientLabel(c)}`, termLab(t)); });
    if (d.adProduct !== undefined && d.adProduct !== null) put(`months.${mD}.p1.adProduct`, N(d.adProduct), `${MN(mD)}, pub produit`, eur(N(d.adProduct)));
    each(d.marketing, (ck, v) => { const c = normClient(ck); const k = normMkt(v); if (c && k) put(`months.${mD}.p1.marketing.${c}`, k, `${MN(mD)}, marketing ${clientLabel(c)}`, mktLab(k)); });
    each(d.sort, (k, v) => { const p = normProd(k); if (["A", "B", "C"].includes(p) && N(v)) put(`months.${mD}.p2.sort.${p}`, N(v), `${MN(mD)}, tri ${prodLabel(p)}`); });
    each(d.results, (k, v) => { const f = RES_FIELDS.find((x) => x[0] === k); if (f || ["wages"].includes(k)) put(`months.${mR}.results.${k}`, N(v), `${MN(mR)}, ${f ? f[1].toLowerCase() : k}`); });
    if (Array.isArray(d.offers)) {
      for (const o of d.offers) {
        if (!o || typeof o !== "object") continue;
        const om = N(o.month) || mD;
        const prod = normProd(o.product) || "mixed";
        const status = o.status === "confirmed" ? "accepted" : ["pending", "accepted", "refused", "cancelled"].includes(o.status) ? o.status : "pending";
        const type = /^s(ell|ale)|vente/i.test(String(o.type || "")) ? "sell" : "buy";
        const dup = state.offers.find((x) => N(x.month) === om && (x.counterpart || "") === (o.counterpart || "") && x.product === prod && N(x.qty) === N(o.qty) && N(x.price) === N(o.price));
        if (dup) { if (o.status && dup.status !== status) { changes.push({ path: "", offerStatus: { ref: dup, old: dup.status }, label: `Offre ${o.counterpart || ""} ${prodLabel(prod)}`, show: statusLab(status) }); dup.status = status; } continue; }
        const rec = { month: om, dir: o.dir === "out" ? "out" : "in", counterpart: o.counterpart || "", type, product: prod, qty: N(o.qty), price: N(o.price), term: normTerm(o.term) || "60", status, t: Date.now() };
        state.offers.push(rec);
        changes.push({ path: "", offerRef: rec, label: `Offre ${rec.dir === "out" ? "envoyée à" : "reçue de"} ${o.counterpart || "?"}`, show: `${type === "sell" ? "vente" : "achat"} ${prodLabel(prod)} ${fmt(N(o.qty))} lots à ${eur(N(o.price))}, ${statusLab(status)}` });
      }
    }
    const s = d.settings;
    if (s && typeof s === "object") {
      const st = state.settings;
      if (s.myId) put("settings.myId", String(s.myId), "Ton identifiant");
      if (Array.isArray(s.teams) && s.teams.length) {
        const teams = Array.from(new Set((st.teams || []).concat(s.teams.map(String))));
        put("settings.teams", teams, "Équipes", teams.join(", "));
        const dist = teams.filter((t) => /^D/i.test(t)).length, ind = teams.filter((t) => /^I/i.test(t)).length;
        if (dist) put("settings.nDist", dist, "Nombre de distributeurs");
        if (ind) put("settings.nInd", ind, "Nombre d'industriels");
      }
      for (const [k, l] of [["nDist", "Nombre de distributeurs"], ["nInd", "Nombre d'industriels"], ["months", "Nombre de mois joués"], ["naturalsFrom", "Naturels à partir du mois"], ["startStock", "Stock de départ"], ["startStockValue", "Valeur du stock de départ"], ["mixedCost", "Coût agglo"], ["sortCost", "Coût du tri"], ["sortCap", "Capacité de la trieuse"]]) {
        const v = N(s[k]);
        if (v === null || v < 0) continue;
        if (["startStock", "startStockValue"].includes(k) && ctx.m !== 1) continue;
        if (["months", "naturalsFrom"].includes(k) && !(v >= 1 && v <= 10)) continue;
        put(`settings.${k}`, v, l);
      }
      each(s.naturalCost, (k, v) => { const p = normProd(k); if (["A", "B", "C"].includes(p)) put(`settings.naturalCost.${p}`, N(v), `Prix d'achat moyen ${prodLabel(p)}`); });
      each(s.fixed, (k, v) => { if (["wages", "wagesNat", "admin", "storagePct"].includes(k)) put(`settings.fixed.${k}`, N(v), `Charge ${k}`); });
      each(s.buyTargets, (k, o) => { if (st.buyTargets[k]) each(o, (f, v) => { if (["anchor", "target", "ceiling"].includes(f)) put(`settings.buyTargets.${k}.${f}`, N(v), `Repère ${k} ${f}`); }); });
      each(s.ranges, (ck, o) => { const c = normClient(ck); if (c) each(o, (pk, v) => { const p = normProd(pk); if (p && Array.isArray(v) && v.length === 2 && N(v[0]) !== null && N(v[1]) !== null && N(v[0]) < N(v[1])) put(`settings.ranges.${c}.${p}`, [N(v[0]), N(v[1])], `Fourchette ${clientLabel(c)} ${prodLabel(p)}`); }); });
      each(s.yields, (k, v) => { const p = normProd(k); if (["A", "B", "C"].includes(p) && Array.isArray(v) && v.length === 4) { let arr = v.map((x) => N(x) || 0); if (arr.every((x) => x <= 1)) arr = arr.map((x) => Math.round(x * 1000) / 10); put(`settings.yields.${p}`, arr, `Rendements ${prodLabel(p)}`, arr.join(" / ")); } });
      each(s.needs, (mk, o) => { const nm = N(mk); if (nm) each(o, (ck, oo) => { const c = normClient(ck); if (c) each(oo, (pk, v) => { const p = normProd(pk); if (p) put(`settings.needs.${nm}.${c}.${p}`, N(v), `Besoin ${MN(nm)} ${clientLabel(c)} ${prodLabel(p)}`); }); }); });
      if (typeof s.scoreNotes === "string" && s.scoreNotes.trim()) put("settings.scoreNotes", s.scoreNotes.trim(), "Calcul du score", "noté");
      if (s.ranges || s.yields || s.sortCap) { st.seen = st.seen || {}; st.seen[`settings${ctx.m === 1 ? "" : ctx.m}`] = true; }
    }
    const when = now();
    if (Array.isArray(d.emails)) for (const e of d.emails) if (e && (e.summary || e.subject)) state.journal.push({ when, m: ctx.m, kind: "Mail", text: `${e.from ? `De ${e.from}` : ""}${e.subject ? ` (${e.subject})` : ""} : ${e.summary || ""}` });
    if (d.notes && !d.remember) state.journal.push({ when, m: ctx.m, kind: "Lu", text: String(d.notes) });
    if (d.remember) state.journal.push({ when, m: ctx.m, kind: "À retenir", text: String(d.remember) });
    const screens = Array.isArray(d.screens) ? d.screens : typeof d.screen === "string" ? d.screen.split(/[,|]/).map((x) => x.trim()) : [];
    const got = E.markSeen(state, ctx.m, ctx.phase, screens.filter(Boolean));
    if (got.length) changes.push({ path: "", label: "Captures cochées", show: got.join(", ") });
    if (d.current && typeof d.current === "object" && ctx.hasText) {
      const cm = N(d.current.m), cp = N(d.current.phase);
      if (cm && cm >= 1 && cm <= last && cp && cp >= 1 && cp <= 3 && (cm !== state.current.m || cp !== state.current.phase)) {
        changes.push({ path: "", current: Object.assign({}, state.current), label: "Étape", show: `${MN(cm)}, ${PHASE_NAME[cp]}` });
        moveTo(cm, cp);
      }
    }
    return changes;
  }

  async function analyze() {
    const m = state.current.m;
    ui.busy = "analyse"; ui.busyText = `Analyse de ${MN(m)}…`;
    render();
    try {
      const j = await api({ action: "analyze", m, state: aiState() });
      E.month(state, m).analysis = j.text;
      state.chat.push({ role: "assistant", content: `**Analyse de ${MN(m)}**\n\n${j.text}`, when: now() });
      state.journal.push({ when: now(), m, kind: "Analyse", text: j.text });
    } catch (e) {
      toast(`Analyse impossible : ${e.message}`);
    }
    ui.busy = null;
    save();
    render();
  }

  /* ---------- Fichiers ---------- */
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
        resolve({ kind: "image", mediaType: "image/jpeg", data: d.split(",")[1], name: file.name || "capture" });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
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
  function batches(files) {
    const out = [];
    let cur = [], size = 0;
    for (const f of files) {
      const s = f.data.length;
      if (cur.length && (size + s > 3.4e6 || cur.length >= 4)) { out.push(cur); cur = []; size = 0; }
      cur.push(f); size += s;
    }
    if (cur.length) out.push(cur);
    return out;
  }
  function pickFiles() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.multiple = true; inp.accept = "image/*,application/pdf,text/plain";
    inp.onchange = () => ingest(Array.from(inp.files || []), "");
    inp.click();
  }

  /* ---------- Navigation dans la partie ---------- */
  function moveTo(m, phase) {
    state.current = { m, phase };
    state.ui.sheet = "todo";
    const wrap = document.getElementById("sheet");
    if (wrap) { wrap.scrollTop = 0; wrap.scrollLeft = 0; }
  }
  function nextStep() {
    const { m, phase } = state.current;
    const mo = E.month(state, m);
    if (phase === 1) { E.commitP1(state, m); mo.p1.done = true; moveTo(m, 2); }
    else if (phase === 2) { E.commitP2(state, m); mo.p2.done = true; moveTo(m, 3); }
    else if (m < lastMonth()) { mo.closed = true; moveTo(m + 1, 1); }
    save(); render();
  }
  function prevStep() {
    const { m, phase } = state.current;
    if (phase > 1) moveTo(m, phase - 1);
    else if (m > 1) moveTo(m - 1, 3);
    save(); render();
  }

  /* ---------- Menus ---------- */
  function openMenu(kind, anchor) {
    const menu = document.getElementById("menu");
    let items = [];
    if (kind === "file") items = [["export", "Exporter une copie de sauvegarde"], ["import-file", "Ouvrir une copie de sauvegarde"], null, ["ping", "Tester la connexion"], null, ["reset", "Tout effacer"]];
    if (kind === "view") {
      const idle = N(state.settings.idleSec) || 0;
      items = [["pane", ui.pane ? "Masquer les commentaires" : "Afficher les commentaires"], ["hide-all", "Tout masquer (Échap)"], null].concat([0, 30, 60, 120].map((s) => ["idle", `${idle === s ? "Actif : " : ""}masquer les commentaires ${s ? `après ${s < 60 ? `${s} s` : `${s / 60} min`} sans activité` : "jamais automatiquement"}`, { s }]));
    }
    menu.innerHTML = items.map((it) => (it ? `<button data-act="${it[0]}"${it[2] ? Object.entries(it[2]).map(([k, v]) => ` data-${k}="${v}"`).join("") : ""}>${esc(it[1])}</button>` : "<hr>")).join("");
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.min(r.left, window.innerWidth - 260)}px`;
    menu.style.top = `${r.bottom + 2}px`;
    menu.hidden = false;
    ui.menu = kind;
  }
  function closeMenu() { const m = document.getElementById("menu"); m.hidden = true; ui.menu = null; }
  function hideNote() { const n = document.getElementById("note"); n.hidden = true; ui.noteHover = false; }
  function showNote(td) {
    const n = document.getElementById("note");
    n.textContent = td.dataset.note;
    n.hidden = false;
    const r = td.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 24);
    let left = r.right + 6;
    if (left + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 6);
    n.style.left = `${left}px`;
    n.style.top = `${Math.min(r.top, window.innerHeight - n.offsetHeight - 8)}px`;
  }
  function hideAll() {
    closeMenu(); hideNote();
    if (ui.pane) { ui.pane = false; renderPane(); }
    document.getElementById("dropzone").hidden = true;
  }

  /* ---------- Actions ---------- */
  const actions = {
    sheet: (el) => { state.ui.sheet = el.dataset.sheet; const w = document.getElementById("sheet"); w.scrollTop = 0; w.scrollLeft = 0; save(); render(); },
    menu: (el) => { if (ui.menu === el.dataset.menu) closeMenu(); else openMenu(el.dataset.menu, el); },
    insert: () => pickFiles(),
    help: () => {
      state.chat.push({ role: "assistant", when: now(), content: "**Comment ça marche**\n- Feuille À faire : suis les étapes dans l'ordre. Elle te dit quoi capturer dans le jeu, quoi y saisir, et pourquoi.\n- Win + Maj + S pour capturer, puis Ctrl+V ici : c'est lu et rangé tout seul (la cellule mise à jour clignote en jaune). « Annuler ces modifications » si c'est faux.\n- Barre fx en haut : tape une info (« I2 me propose 3 000 A à 49 € à 60 jours »), une consigne (« on joue 5 mois ») ou une question, puis Entrée.\n- Les chiffres bleus sont les valeurs conseillées : tape par-dessus pour faire un autre choix. Le coin rouge d'une cellule = l'explication au survol.\n- Prévisions : ce qui se passe les mois suivants. Tableau de bord : tes chiffres.\n- Échap masque les commentaires. Sans activité, ils se masquent seuls (réglable dans Affichage)." });
      openPane(); save();
    },
    pane: () => { closeMenu(); if (ui.pane) { ui.pane = false; renderPane(); } else openPane(); },
    "pane-close": () => { ui.pane = false; renderPane(); },
    "hide-all": () => hideAll(),
    idle: (el) => { state.settings.idleSec = N(el.dataset.s) || 0; closeMenu(); save(); toast(state.settings.idleSec ? "Réglé" : "Masquage automatique désactivé"); },
    zoom: (el) => { state.settings.zoom = Math.max(70, Math.min(150, (N(state.settings.zoom) || 100) + N(el.dataset.d))); save(); render(); },
    "fx-send": () => sendFx(),
    "fx-clear": () => { const fx = document.getElementById("fx"); fx.value = ""; autoGrow(fx); fx.focus(); },
    "step-toggle": (el) => {
      const { m, phase } = state.current;
      const mo = E.month(state, m);
      mo.seen = mo.seen || {};
      mo.seen[phase] = mo.seen[phase] || {};
      const st = E.steps(state, m, phase).find((s) => s.id === el.dataset.id);
      if (!st) return;
      const d = E.stepDone(state, m, phase, st);
      mo.seen[phase][st.id] = !d;
      save(); render();
    },
    next: () => nextStep(),
    prev: () => prevStep(),
    "reset-p1": () => {
      const m = state.current.m;
      if (!confirm(`Remettre les prix, délais et marketing de ${MN(m)} aux valeurs conseillées ?`)) return;
      const mo = E.month(state, m);
      mo.p1.prices = {}; mo.p1.terms = {}; mo.p1.marketing = {}; mo.p1.adProduct = null;
      save(); render();
    },
    analyze: () => { if (!ui.busy) analyze(); },
    undo: (el) => doUndo(el.dataset.id),
    "add-offer": () => {
      const v = (id) => document.getElementById(id).value;
      if (!N(v("of-qty")) && !N(v("of-price"))) { toast("Saisis au moins une quantité ou un prix"); return; }
      state.offers.push({ month: N(v("of-month")), dir: v("of-dir"), counterpart: v("of-cp").trim(), type: v("of-type"), product: v("of-prod"), qty: N(v("of-qty")), price: N(v("of-price")), term: v("of-term"), status: v("of-status"), t: Date.now() });
      save(); render(); toast("Offre ajoutée");
    },
    "del-offer": (el) => { if (confirm("Supprimer cette offre ?")) { state.offers.splice(+el.dataset.i, 1); save(); render(); } },
    copy: (el) => { navigator.clipboard.writeText(el.dataset.text).then(() => toast("Copié"), () => toast("Copie impossible")); },
    "add-journal": () => {
      const ta = document.getElementById("j-text");
      if (!ta || !ta.value.trim()) return;
      state.journal.push({ when: now(), m: state.current.m, kind: "Note", text: ta.value.trim() });
      save(); render();
    },
    "chat-reset": () => { if (confirm("Effacer la conversation ? Les données rangées restent.")) { state.chat = []; save(); renderPane(); } },
    export: () => {
      closeMenu();
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `suivi-distribution-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    "import-file": () => {
      closeMenu();
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "application/json,.json";
      inp.onchange = async () => {
        try { const s = JSON.parse(await inp.files[0].text()); if (!s.version) throw new Error("fichier non reconnu"); state = migrate(s); save(); render(); toast("Copie ouverte"); } catch (e) { toast(`Ouverture impossible : ${e.message}`); }
      };
      inp.click();
    },
    reset: () => { closeMenu(); if (confirm("Tout effacer ? Exporte d'abord une copie si tu veux la garder.")) { state = migrate(E.defaultState()); save(); render(); } },
    ping: async () => {
      closeMenu();
      try { const j = await api({ action: "ping" }); toast(j.hasKey ? "Connexion prête" : "Clé ANTHROPIC_API_KEY absente sur Vercel"); } catch (e) { toast(`Connexion impossible : ${e.message}`); }
    }
  };

  function delP(path) {
    const ks = path.split(".");
    const chain = [state];
    for (let i = 0; i < ks.length - 1; i++) { const o = chain[i][ks[i]]; if (!o || typeof o !== "object") return; chain.push(o); }
    delete chain[chain.length - 1][ks[ks.length - 1]];
    // nettoie les objets devenus vides (demande, livraisons…), sans toucher aux blocs du mois
    if (ks[0] === "months") for (let i = chain.length - 1; i >= 4; i--) if (!Object.keys(chain[i]).length) delete chain[i - 1][ks[i - 1]];
  }
  function doUndo(id) {
    const list = id && ui.undo[id];
    if (!list) { toast("Rien à annuler"); return; }
    for (const c of list.slice().reverse()) {
      if (c.path) { if (c.old === undefined) delP(c.path); else setP(c.path, c.old); }
      if (c.offerRef) { const i = state.offers.indexOf(c.offerRef); if (i >= 0) state.offers.splice(i, 1); }
      if (c.offerStatus) c.offerStatus.ref.status = c.offerStatus.old;
      if (c.current) state.current = c.current;
    }
    state.chat = state.chat.map((x) => (x.undoId === id ? Object.assign({}, x, { undoId: null, content: `${x.content}\n\n(Modifications annulées)` }) : x));
    state.journal.push({ when: now(), m: state.current.m, kind: "Annulation", text: "Lecture annulée : les valeurs rangées ont été remises comme avant." });
    delete ui.undo[id];
    if (ui.lastUndo === id) ui.lastUndo = null;
    save(); render(); toast("Modifications annulées");
  }

  /* ---------- Barre fx ---------- */
  function autoGrow(fx) {
    fx.style.height = "auto";
    fx.style.height = `${Math.min(fx.scrollHeight, window.innerHeight * 0.4)}px`;
  }
  function sendFx() {
    const fx = document.getElementById("fx");
    const t = fx.value.trim();
    if (!t) { fx.focus(); return; }
    fx.value = ""; autoGrow(fx);
    ingest([], t);
  }

  /* ---------- Événements ---------- */
  const activity = () => { ui.lastAct = Date.now(); };
  ["pointermove", "keydown", "wheel", "pointerdown", "touchstart"].forEach((ev) => document.addEventListener(ev, activity, { passive: true, capture: true }));
  setInterval(() => {
    const s = N(state.settings.idleSec) || 0;
    if (!s || ui.busy) return;
    if (Date.now() - ui.lastAct > s * 1000 && (ui.pane || !document.getElementById("note").hidden || ui.menu)) hideAll();
  }, 3000);

  document.addEventListener("pointerdown", (e) => {
    ui.pointerDown = true;
    if (ui.menu && !e.target.closest("#menu") && !e.target.closest("[data-act=menu]")) closeMenu();
    const td = e.target.closest(".grid td");
    if (td) {
      document.querySelectorAll(".grid td.sel").forEach((x) => x.classList.remove("sel"));
      td.classList.add("sel");
      ui.sel = td.dataset.ref;
      document.getElementById("namebox").textContent = td.dataset.ref || "";
    }
  }, true);
  document.addEventListener("pointerup", () => {
    ui.pointerDown = false;
    if (ui.pendingRender) { ui.pendingRender = false; setTimeout(render, 0); }
  }, true);
  document.addEventListener("focusin", (e) => {
    const td = e.target.closest && e.target.closest(".grid td");
    if (td) document.getElementById("namebox").textContent = td.dataset.ref || "";
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (el) {
      const fn = actions[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el, e); }
      return;
    }
    const td = e.target.closest(".grid td.has-note");
    if (td && !e.target.closest("input,select,textarea")) {
      const n = document.getElementById("note");
      if (!n.hidden && n.textContent === td.dataset.note) hideNote(); else showNote(td);
    }
  });
  document.addEventListener("keydown", (e) => {
    const tag = e.target.tagName;
    if (e.target.id === "fx" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFx(); return; }
    if (e.key === "Escape") { hideAll(); if (tag === "TEXTAREA" || tag === "INPUT") e.target.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && ui.lastUndo) { e.preventDefault(); doUndo(ui.lastUndo); return; }
    if (e.key === "Enter" && e.target.matches && e.target.matches(".grid td[role=button]")) { e.preventDefault(); e.target.click(); }
    if (e.key === "Enter" && tag === "INPUT" && e.target.closest(".grid")) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "fx") autoGrow(e.target); });

  document.addEventListener("change", (e) => {
    const el = e.target;
    const path = el.dataset && el.dataset.path;
    if (!path) return;
    const t = el.dataset.type;
    let v;
    if (t === "bool") v = el.checked;
    else if (t === "num") v = el.value.trim() === "" ? null : N(el.value);
    else if (t === "list") v = el.value.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    else v = el.value;
    if (path.startsWith("ui.")) setP(path, v);
    else setP(path, v);
    if (path === "settings.teams") {
      const dist = v.filter((x) => /^D/i.test(x)).length, ind = v.filter((x) => /^I/i.test(x)).length;
      if (dist) state.settings.nDist = dist;
      if (ind) state.settings.nInd = ind;
    }
    if (path === "current.m" || path === "current.phase") {
      state.current.m = Math.min(Math.max(1, N(state.current.m) || 1), lastMonth());
      state.current.phase = Math.min(Math.max(1, N(state.current.phase) || 1), 3);
      document.getElementById("sheet").scrollTop = 0;
    }
    save();
    if (el.tagName === "SELECT" || t === "bool") { ui.pointerDown = false; ui.pendingRender = false; requestAnimationFrame(render); }
    else scheduleRender();
  });

  document.addEventListener("mouseover", (e) => {
    const td = e.target.closest && e.target.closest(".grid td.has-note");
    if (td && window.matchMedia("(hover: hover)").matches) { showNote(td); ui.noteHover = true; }
  });
  document.addEventListener("mouseout", (e) => {
    const td = e.target.closest && e.target.closest(".grid td.has-note");
    if (td && ui.noteHover && !td.contains(e.relatedTarget)) hideNote();
  });
  document.getElementById("sheet").addEventListener("scroll", () => { if (!document.getElementById("note").hidden) hideNote(); }, { passive: true });

  document.addEventListener("paste", (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = Array.from(cd.files || []).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    const tag = e.target.tagName;
    const inField = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
    if (files.length) {
      e.preventDefault();
      const fx = document.getElementById("fx");
      const t = fx.value.trim();
      fx.value = ""; autoGrow(fx);
      ingest(files, t);
      return;
    }
    if (!inField) {
      const text = cd.getData("text/plain");
      if (text && text.trim()) { e.preventDefault(); ingest([], text); }
    }
  });

  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
  window.addEventListener("dragenter", (e) => { if (hasFiles(e)) { dragDepth++; document.getElementById("dropzone").hidden = false; } });
  window.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.getElementById("dropzone").hidden = true; });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    dragDepth = 0;
    document.getElementById("dropzone").hidden = true;
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    ingest(Array.from(e.dataTransfer.files), "");
  });

  render();
})();
