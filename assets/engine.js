/* ViNego Cockpit : moteur de stratégie (logique pure, sans interface).
   Utilisable dans le navigateur (window.Engine) et dans Node (module.exports) pour les tests. */
(function (root) {
  "use strict";

  const CLIENTS = [
    { k: "winemakers", label: "Vignerons" },
    { k: "cellars", label: "Cavistes" },
    { k: "keyacc", label: "Grands comptes" }
  ];
  const PRODUCTS = [
    { k: "mixed", label: "Agglomérés" },
    { k: "Q1", label: "Q1" },
    { k: "Q2", label: "Q2" },
    { k: "Q3", label: "Q3" },
    { k: "Q4", label: "Q4" }
  ];
  const RAW = [
    { k: "A", label: "Espagne A" },
    { k: "B", label: "Espagne B" },
    { k: "C", label: "Espagne C" }
  ];
  const TERMS = [
    { k: "order", label: "À la commande" },
    { k: "delivery", label: "À la livraison" },
    { k: "30", label: "30 jours" },
    { k: "60", label: "60 jours" }
  ];
  const MKT = [
    { k: "none", label: "Aucune", cost: 0 },
    { k: "flyers", label: "Flyers", cost: 10000 },
    { k: "emailing", label: "E-mailing", cost: 20000 },
    { k: "visit", label: "Visite d'usine", cost: 50000 }
  ];
  const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre"];

  const NAT_DEFAULT_PRICES = {
    Q1: { winemakers: 168, cellars: 148, keyacc: 150 },
    Q2: { winemakers: 148, cellars: 129, keyacc: 114 },
    Q3: { winemakers: 148, cellars: 122, keyacc: 104 },
    Q4: { winemakers: 139, cellars: 99, keyacc: 89 }
  };

  function defaultNeeds() {
    const needs = {};
    const wm = {
      3: { Q1: 130, Q2: 260, Q3: 390, Q4: 520 },
      4: { Q1: 160, Q2: 320, Q3: 480, Q4: 640 },
      5: { Q1: 200, Q2: 400, Q3: 600, Q4: 800 },
      6: { Q1: 130, Q2: 260, Q3: 390, Q4: 520 }
    };
    for (let m = 1; m <= 10; m++) {
      const nat = m >= 3;
      const w = wm[m] || wm[6];
      needs[m] = {
        winemakers: { mixed: 200, Q1: nat ? w.Q1 : 0, Q2: nat ? w.Q2 : 0, Q3: nat ? w.Q3 : 0, Q4: nat ? w.Q4 : 0 },
        cellars: { mixed: 1200, Q1: nat ? 200 : 0, Q2: nat ? 200 : 0, Q3: nat ? 200 : 0, Q4: nat ? 600 : 0 },
        keyacc: { mixed: 6000, Q1: 0, Q2: nat ? 300 : 0, Q3: nat ? 600 : 0, Q4: nat ? 900 : 0 }
      };
    }
    return needs;
  }

  function defaultSettings() {
    return {
      myId: "",
      nDist: null,
      nInd: null,
      months: 6,
      naturalsFrom: 3,
      mixedCost: 20,
      naturalCost: { A: 55, B: 60, C: 65 },
      startStock: 12000,
      startStockValue: null,
      fixed: { wages: 40000, admin: 20000, wagesNat: 150000, storagePct: 0.33 },
      ranges: {
        winemakers: { mixed: [40, 80], Q1: [160, 200], Q2: [140, 180], Q3: [120, 160], Q4: [100, 140] },
        cellars: { mixed: [25, 50], Q1: [145, 170], Q2: [125, 150], Q3: [105, 130], Q4: [85, 100] },
        keyacc: { mixed: [10, 30], Q1: [130, 150], Q2: [110, 130], Q3: [90, 110], Q4: [70, 90] }
      },
      needs: defaultNeeds(),
      yields: { A: [15, 30, 30, 25], B: [20, 30, 30, 20], C: [25, 30, 25, 20] },
      sortCost: 2,
      sortCap: 20000,
      buyTargets: {
        mixedEarly: { anchor: 16, target: 19, ceiling: 20 },
        mixedLate: { anchor: 12, target: 15, ceiling: 20 },
        A: { anchor: 42, target: 48, ceiling: 60 },
        B: { anchor: 45, target: 50, ceiling: 58 },
        C: { anchor: 42, target: 48, ceiling: 55 }
      },
      teams: [],
      scoreNotes: ""
    };
  }

  function emptyMonth() {
    return {
      p1: { prices: {}, terms: {}, adProduct: null, marketing: {}, check: {}, done: false },
      p2: { stock: {}, demand: {}, sort: {}, deliveries: {}, check: {}, done: false },
      results: {},
      analysis: "",
      notes: ""
    };
  }

  function defaultState() {
    return {
      version: 1,
      settings: defaultSettings(),
      months: {},
      offers: [],
      journal: [],
      chat: [],
      current: { m: 1, phase: 1 }
    };
  }

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    const s = String(v).replace(/[\s  €%]/g, "").replace(",", ".");
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function get(obj, path, dflt) {
    let o = obj;
    for (const p of path) {
      if (o === null || o === undefined) return dflt;
      o = o[p];
    }
    return o === undefined || o === null ? dflt : o;
  }

  function month(state, m) {
    if (!state.months[m]) state.months[m] = emptyMonth();
    const mo = state.months[m];
    const tpl = emptyMonth();
    for (const k of Object.keys(tpl)) if (mo[k] === undefined) mo[k] = tpl[k];
    for (const ph of ["p1", "p2"]) for (const k of Object.keys(tpl[ph])) if (mo[ph][k] === undefined) mo[ph][k] = tpl[ph][k];
    return mo;
  }

  function isNat(state, m) {
    return m >= (num(state.settings.naturalsFrom) || 3);
  }

  function productsFor(state, m) {
    return isNat(state, m) ? PRODUCTS : PRODUCTS.slice(0, 1);
  }

  function need(state, m, c, p) {
    return num(get(state.settings.needs, [m, c, p], 0)) || 0;
  }

  function range(state, c, p) {
    const r = get(state.settings.ranges, [c, p], null);
    return r ? [num(r[0]), num(r[1])] : [0, 0];
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function mixedCost(state) {
    const s = state.settings;
    const v = num(s.startStockValue), q = num(s.startStock);
    if (v && q) return Math.round((v / q) * 100) / 100;
    return num(s.mixedCost) || 20;
  }

  function natCost(state, origin) {
    return (num(get(state.settings, ["naturalCost", origin || "A"], 55)) || 55) + (num(state.settings.sortCost) || 2);
  }

  /* Indice d'attractivité : demande reçue / besoin du guide */
  function index(state, m, c, p) {
    const d = num(get(state.months, [m, "p2", "demand", c, p], null));
    const n = need(state, m, c, p);
    if (d === null || !n) return null;
    return d / n;
  }

  function stockOf(state, m, p) {
    return num(get(state.months, [m, "p2", "stock", p], null));
  }

  function sortedOutput(state, m) {
    const out = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    let sort = get(state.months, [m, "p2", "sort"], {});
    // Rien de saisi : on compte le tri conseillé
    if (isNat(state, m) && !["A", "B", "C"].some((o) => num(sort[o]) !== null)) sort = recoSort(state, m);
    for (const o of ["A", "B", "C"]) {
      const lots = num(sort[o]) || 0;
      const y = state.settings.yields[o] || [0, 0, 0, 0];
      ["Q1", "Q2", "Q3", "Q4"].forEach((q, i) => (out[q] += Math.floor((lots * (num(y[i]) || 0)) / 100)));
    }
    return out;
  }

  function availableStock(state, m, p) {
    const base = stockOf(state, m, p) || 0;
    if (p.startsWith("Q")) return base + sortedOutput(state, m)[p];
    return base;
  }

  function delivered(state, m, p) {
    let t = 0;
    for (const c of CLIENTS) t += num(get(state.months, [m, "p2", "deliveries", c.k, p], 0)) || 0;
    return t;
  }

  function demandTotal(state, m, p) {
    let t = 0, any = false;
    for (const c of CLIENTS) {
      const d = num(get(state.months, [m, "p2", "demand", c.k, p], null));
      if (d !== null) { t += d; any = true; }
    }
    return any ? t : null;
  }

  /* Livré : ce qui est saisi, sinon la répartition conseillée (si la demande est connue) */
  function effDelivered(state, m, p) {
    const stored = CLIENTS.some((c) => num(get(state.months, [m, "p2", "deliveries", c.k, p], null)) !== null);
    if (stored) return delivered(state, m, p);
    if (demandTotal(state, m, p) === null) return 0;
    const a = allocate(state, m);
    return CLIENTS.reduce((t, c) => t + (num(get(a, [c.k, p], 0)) || 0), 0);
  }
  function leftover(state, m, p) {
    const s = availableStock(state, m, p);
    return Math.max(0, s - effDelivered(state, m, p));
  }
  function effSort(state, m, o) {
    const sort = get(state.months, [m, "p2", "sort"], {});
    if (["A", "B", "C"].some((k) => num(sort[k]) !== null)) return num(sort[o]) || 0;
    return isNat(state, m) ? recoSort(state, m)[o] || 0 : 0;
  }

  function step(state, c, p) {
    const [lo, hi] = range(state, c, p);
    return Math.max(1, Math.round((hi - lo) * 0.1));
  }

  function defaultPrice(state, m, c, p) {
    if (p === "mixed") {
      const cost = mixedCost(state);
      if (c === "winemakers") return 69;
      if (c === "cellars") return 39;
      return clamp(Math.max(24, Math.ceil(cost + 3)), ...range(state, c, p));
    }
    return NAT_DEFAULT_PRICES[p][c];
  }

  /* Prix conseillé + raison, à partir du mois précédent et de l'indice obtenu */
  function recoPrice(state, m, c, p) {
    const [lo, hi] = range(state, c, p);
    // Prix du mois précédent : celui saisi, sinon celui que l'outil conseillait (supposé appliqué)
    let prevP = num(get(state.months, [m - 1, "p1", "prices", c, p], null));
    if (prevP === null && m - 1 >= 1 && (p === "mixed" || isNat(state, m - 1))) prevP = recoPrice(state, m - 1, c, p).price;
    let price, reason;
    if (prevP === null || !isNat(state, m - 1) && p !== "mixed") {
      price = defaultPrice(state, m, c, p);
      reason = p === "mixed" ? "Prix d'ouverture du playbook" : (p === "Q4" ? "Q4 rare partout : prix fort" : (p === "Q3" ? "Q3 équilibré : haut de fourchette" : "Surplus après tri : prix agressif"));
    } else {
      const idx = index(state, m - 1, c, p);
      const dem = num(get(state.months, [m - 1, "p2", "demand", c, p], null));
      const del = num(get(state.months, [m - 1, "p2", "deliveries", c, p], null));
      const rate = dem ? (del === null ? null : del / dem) : null;
      const left = leftover(state, m - 1, p);
      const st = step(state, c, p);
      if (idx === null) {
        price = prevP; reason = "Pas de demande relevée le mois dernier : prix inchangé";
      } else if (idx >= 1.6) {
        price = prevP + st; reason = `Indice ${idx.toFixed(2)} : tu es bien plus attractif que la moyenne, on monte de ${st} €`;
      } else if (idx >= 1.3 && (rate === null || rate < 0.95)) {
        price = prevP + st; reason = `Indice ${idx.toFixed(2)} et rupture : on monte de ${st} €`;
      } else if (idx >= 1.3) {
        price = prevP; reason = `Indice ${idx.toFixed(2)} et tout servi : on garde (tu peux tester +${st} €)`;
      } else if (idx <= 0.7 && left > 0) {
        price = prevP - st; reason = `Indice ${idx.toFixed(2)} avec du stock invendu : on baisse de ${st} €`;
      } else {
        price = prevP; reason = `Indice ${idx.toFixed(2)} : dans le peloton, on garde`;
      }
    }
    if (p === "mixed") {
      const floor = Math.ceil(mixedCost(state) + 2);
      if (price < floor) { price = floor; reason += " (plancher : coût + 2 €)"; }
    }
    if (p === "Q4" && price < hi - 3) {
      price = Math.max(price, hi - 3);
    }
    price = clamp(Math.round(price), lo, hi);
    return { price, reason };
  }

  function lastCashForecast(state, m) {
    for (let k = m - 1; k >= 1; k--) {
      const r = get(state.months, [k, "results"], {});
      const vals = [num(r.cashM1), num(r.cashM2), num(r.cashEnd)].filter((v) => v !== null);
      if (vals.length) return Math.min(...vals);
    }
    return null;
  }

  function recoTerms(state, m) {
    const nf = num(state.settings.naturalsFrom) || 3;
    if (m === 1) return { winemakers: "30", cellars: "30", keyacc: "order", why: "30 jours sur les clients à forte marge (encaissés en mars), comptant sur les grands comptes" };
    if (m < nf) return { winemakers: "delivery", cellars: "delivery", keyacc: "order", why: "Avant mars, tout doit être encaissé avant ou pendant le mois des gros décaissements" };
    if (m === nf) return { winemakers: "delivery", cellars: "delivery", keyacc: "order", why: "Mois le plus dur pour la trésorerie : délais courts" };
    const cash = lastCashForecast(state, m);
    if (cash !== null && cash > 50000) return { winemakers: "30", cellars: "delivery", keyacc: "order", why: "Trésorerie confortable : le délai long attire sans coûter de marge" };
    return { winemakers: "delivery", cellars: "delivery", keyacc: "order", why: "Trésorerie à surveiller : délais courts" };
  }

  function expectedRevenue(state, m, useReco) {
    let ca = 0;
    for (const p of productsFor(state, m)) {
      for (const c of CLIENTS) {
        const price = useReco ? recoPrice(state, m, c.k, p.k).price : effPrice(state, m, c.k, p.k);
        if (price === null) continue;
        const idx = index(state, m - 1, c.k, p.k);
        ca += need(state, m, c.k, p.k) * (idx ? Math.min(idx, 1.5) : 1) * price;
      }
    }
    return Math.round(ca);
  }

  function recoMarketing(state, m) {
    if (!isNat(state, m)) {
      const ca = expectedRevenue(state, m, true);
      return { adProduct: Math.round((ca * 0.025) / 500) * 500, targeted: { winemakers: "none", cellars: "none", keyacc: "none" }, why: "Environ 2,5 % du CA attendu : la pub profite aussi aux grands comptes peu rentables" };
    }
    const peak = m === 5;
    return {
      adProduct: 0,
      targeted: { winemakers: "emailing", cellars: peak ? "flyers" : "none", keyacc: "none" },
      why: peak ? "Pic des vignerons en mai : e-mailing vignerons + flyers cavistes" : "Une action ciblée là où la marge est forte (vignerons). Pas de pub produit en même temps"
    };
  }

  function marketingCost(state, m) {
    const eff = effMarketing(state, m);
    let t = num(eff.adProduct) || 0;
    for (const c of CLIENTS) {
      const k = eff.targeted[c.k] || "none";
      const def = MKT.find((x) => x.k === k);
      if (def) t += def.cost;
    }
    return t;
  }

  function fixedCosts(state, m) {
    const f = state.settings.fixed;
    const wages = isNat(state, m) ? num(f.wagesNat) || 150000 : num(f.wages) || 40000;
    return wages + (num(f.admin) || 20000);
  }

  /* Résultat estimé du mois à partir des prix saisis (ou conseillés) */
  function estimate(state, m, useReco) {
    let ca = 0, cogs = 0, lots = 0;
    for (const p of productsFor(state, m)) {
      for (const c of CLIENTS) {
        const price = useReco ? recoPrice(state, m, c.k, p.k).price : effPrice(state, m, c.k, p.k);
        if (price === null) continue;
        const idx = index(state, m - 1, c.k, p.k);
        const q = need(state, m, c.k, p.k) * (idx ? Math.min(idx, 1.5) : 1);
        ca += q * price;
        cogs += q * (p.k === "mixed" ? mixedCost(state) : natCost(state, "A"));
        lots += q;
      }
    }
    const mkt = useReco ? (recoMarketing(state, m).adProduct + Object.values(recoMarketing(state, m).targeted).reduce((s, k) => s + (MKT.find((x) => x.k === k) || { cost: 0 }).cost, 0)) : marketingCost(state, m);
    const fixed = fixedCosts(state, m);
    return { ca: Math.round(ca), margin: Math.round(ca - cogs), lots: Math.round(lots), marketing: mkt, fixed, result: Math.round(ca - cogs - mkt - fixed) };
  }

  /* Répartition des ventes : chaque produit va d'abord au client qui le paie le plus cher */
  function allocate(state, m) {
    const out = {};
    for (const c of CLIENTS) out[c.k] = {};
    for (const p of productsFor(state, m)) {
      let left = availableStock(state, m, p.k);
      const order = CLIENTS.map((c) => ({ c: c.k, price: effPrice(state, m, c.k, p.k) || 0, dem: num(get(state.months, [m, "p2", "demand", c.k, p.k], 0)) || 0 }))
        .sort((a, b) => b.price - a.price);
      for (const o of order) {
        const q = Math.max(0, Math.min(o.dem, left));
        out[o.c][p.k] = q;
        left -= q;
      }
    }
    return out;
  }

  /* Plan d'achat pour le mois suivant */
  function purchasePlan(state, m) {
    const next = m + 1;
    const plan = { next, mixed: null, natural: null, notes: [] };
    const last = num(state.settings.months) || 6;
    if (m >= last) {
      plan.notes.push("Dernier mois joué : n'achète rien pour un mois qui n'existera pas.");
      return plan;
    }
    // Agglomérés
    let exp = 0;
    for (const c of CLIENTS) {
      const idx = index(state, m, c.k, "mixed");
      exp += need(state, next, c.k, "mixed") * (idx ? Math.min(idx, 1.5) : 1);
    }
    const leftMixed = leftover(state, m, "mixed");
    const t = m < (num(state.settings.naturalsFrom) || 3) ? state.settings.buyTargets.mixedEarly : state.settings.buyTargets.mixedLate;
    plan.mixed = { expected: Math.round(exp), leftover: leftMixed, buy: Math.max(0, Math.round(exp - leftMixed)), targets: t };
    // Naturels
    if (isNat(state, next) && next === (num(state.settings.naturalsFrom) || 3)) {
      plan.notes.push("Le stock de naturels racheté au fournisseur allemand couvre déjà mars : n'achète des naturels que pour avril, en mars.");
    } else if (isNat(state, next)) {
      const exp = {};
      for (const q of ["Q1", "Q2", "Q3", "Q4"]) {
        exp[q] = 0;
        for (const c of CLIENTS) {
          const idx = index(state, m, c.k, q);
          exp[q] += need(state, next, c.k, q) * (idx ? Math.min(idx, 1.5) : 1);
        }
      }
      const yA = state.settings.yields.A || [15, 30, 30, 25];
      const y3 = (num(yA[2]) || 30) / 100, y4 = (num(yA[3]) || 25) / 100;
      // Naturels non triés qui restent en fin de mois (en équivalent lots d'A)
      const rawLeft = ["A", "B", "C"].reduce((t, o) => t + Math.max(0, (stockOf(state, m, o) || 0) - effSort(state, m, o)), 0);
      const rawLeftA = Math.max(0, (stockOf(state, m, "A") || 0) - effSort(state, m, "A"));
      const q3Left = leftover(state, m, "Q3"), q4Left = leftover(state, m, "Q4");
      const netQ3 = Math.max(0, exp.Q3 - q3Left), netQ4 = Math.max(0, exp.Q4 - q4Left);
      const forQ3 = Math.ceil(netQ3 / y3);
      const usual = Math.ceil(exp.Q3 / y3);
      const forQ4 = Math.ceil(netQ4 / y4);
      // Règle : couvrir le Q3. Si ton surplus de Q3 le couvre déjà mais que le Q4 manque, on garde le volume habituel
      // (le surplus de Q3 servira le mois d'après), sauf si le mois suivant est le dernier.
      let base = forQ3, rule = "q3";
      if (next < last && forQ4 > forQ3) { const v = Math.min(forQ4, usual); if (v > base) { base = v; rule = "q4"; } }
      const lots = Math.max(0, base - rawLeft);
      plan.natural = { q3Expected: Math.round(exp.Q3), q4Expected: Math.round(exp.Q4), q3Leftover: q3Left, q4Leftover: q4Left, rawLeftA, rawLeft, buyA: lots, rule, targets: { A: state.settings.buyTargets.A, B: state.settings.buyTargets.B, C: state.settings.buyTargets.C } };
      if (next === last) plan.notes.push(`${MONTHS[next - 1]} est le dernier mois : n'achète que ce qui se vendra, le surplus sera perdu.`);
      if (next === 5) plan.notes.push("Mai = pic des vignerons : vise plutôt le haut du plan.");
    }
    return plan;
  }

  /* Évalue une offre d'achat reçue par rapport à tes repères */
  function judgeBuy(state, m, product, price) {
    const p = num(price);
    let t;
    if (product === "mixed") t = m < (num(state.settings.naturalsFrom) || 3) ? state.settings.buyTargets.mixedEarly : state.settings.buyTargets.mixedLate;
    else if (["A", "B", "C"].includes(product)) t = state.settings.buyTargets[product];
    if (!t || p === null) return null;
    if (p <= t.target) return { verdict: "ok", label: "Bon prix, accepte (ou grignote un petit bonus)", counter: null, t };
    if (p <= t.ceiling) return { verdict: "nego", label: "Négocie", counter: Math.round(((t.target + p) / 2) * 2) / 2, t };
    return { verdict: "refuse", label: "Au-dessus de ton plafond : refuse ou contre-offre", counter: t.target, t };
  }

  function judgeSell(state, m, product, price) {
    const p = num(price);
    if (p === null) return null;
    const cost = product === "mixed" ? mixedCost(state) : natCost(state, ["A", "B", "C"].includes(product) ? product : "A");
    if (p < cost) return { verdict: "refuse", label: `Sous ton coût (${cost} €) : refuse`, counter: Math.ceil(cost + 4) };
    if (p < cost + 4) return { verdict: "nego", label: "Marge trop fine : demande plus", counter: Math.ceil(cost + 6) };
    return { verdict: "ok", label: "Marge correcte", counter: null };
  }

  const LEADS = {
    1: "Janvier : le marché croule sous le stock. Vise la marge sur les clients qui paient, garde ton surplus (stocker coûte 0,33 % par mois) et couvre tes 60 000 € de fixes.",
    2: "Février : un seul objectif, arriver en mars avec assez de cash pour encaisser 285 000 € de stock et 150 000 € de salaires sans passer sous zéro.",
    3: "Mars : le tournant. Les naturels arrivent, l'acheteur allemand disparaît, les industriels n'ont plus que toi. Q4 au prix fort, Espagne A en priorité, achats calés sur la demande Q3.",
    4: "Avril : tiens l'avance. Passe aux 30 jours chez les vignerons si ta trésorerie le permet, et achète pour le pic de mai.",
    5: "Mai : pic des vignerons (2 000 lots de naturels par distributeur). C'est le mois pour mettre le paquet sur eux.",
    6: "Juin : retour au niveau de mars. Si c'est le dernier mois, n'achète rien pour la suite."
  };

  function lead(state, m) {
    const last = num(state.settings.months) || 6;
    let t = LEADS[m] || "Applique la méthode : indices, prix, trésorerie, achats pour le mois suivant.";
    if (m === last && m !== 6) t += " C'est le dernier mois joué : n'achète rien pour la suite.";
    return t;
  }

  function checklist(state, m, phase) {
    const nf = num(state.settings.naturalsFrom) || 3;
    const last = num(state.settings.months) || 6;
    const items = [];
    if (phase === 1) {
      if (m === 1) items.push("Relever le nombre de distributeurs et d'industriels, ton stock et sa valeur, les besoins du guide et le calcul du score (onglet Paramètres)");
      items.push("Lire les nouveaux mails (règles, news, bons de commande)");
      items.push("Regarder le stock et la prévision de trésorerie à 2 mois");
      if (m === nf) items.push("Lire le mail « Cessation of activity » et repérer quel canal marketing marche pour quel client");
      items.push("Saisir prix et délai pour chaque client (recos de l'outil)");
      if (m >= 2 && m < nf) items.push("Délais courts partout : à la commande ou à la livraison, jamais 30 ou 60 jours");
      if (m >= nf) items.push("Prix par qualité : Q4 au prix fort, Q1 et Q2 agressifs");
      items.push(m >= nf ? "Une action marketing ciblée max, pub produit à 0" : "Saisir le budget pub (environ 2,5 % du CA attendu)");
      if (m === 5) items.push("E-mailing vignerons : c'est leur pic de demande");
      items.push("Vérifier qu'aucun prix n'a été ramené à une borne par le simulateur");
      items.push("Cocher Planning, valider, puis Finish the phase");
    } else {
      items.push("Relever la demande reçue (Sales) dans l'outil : les indices se calculent seuls");
      if (m >= nf) items.push("Trier les naturels : ce que tu vends ce mois-ci plus une petite marge, garder le reste non trié");
      items.push("Répartir les ventes par marge (bouton « Proposer la répartition »)");
      if (m === 1) items.push("Traiter les 3 offres externes (accepter la moins chère si besoin de stock, viser 20 € ou moins)");
      items.push("Traiter les offres reçues (onglet Négos : l'outil te dit accepter, négocier ou refuser)");
      if (m === 1) items.push("Ouvrir le contact avec tous les industriels, sans t'engager");
      if (m >= 2 && m < nf) items.push("Aucun engagement sur les naturels, mais sonder les industriels sur leurs planches A, B, C");
      if (m === nf) items.push("Appel d'offres Espagne A pour avril, accord sur 3 mois avec 1 ou 2 industriels");
      if (m < last) items.push("Acheter pour le mois suivant selon le plan, à 60 jours si possible");
      else items.push("Dernier mois : n'acheter rien pour la suite");
      items.push("Proposer ton surplus aux distributeurs à court (livraison immédiate)");
      items.push("Vérifier que chaque accord tient en stock et en trésorerie");
      items.push("Valider seulement quand toutes les négos sont bouclées");
    }
    return items;
  }

  function anticipate(state, m) {
    const nf = num(state.settings.naturalsFrom) || 3;
    const last = num(state.settings.months) || 6;
    const out = [];
    if (m >= last) { out.push("Fin de partie : n'achète rien pour après, soigne ton résultat et ta trésorerie du dernier mois."); return out; }
    if (m === nf - 2 || (m === 1 && nf > 2)) out.push("Février : délais clients courts pour encaisser avant ou pendant mars. Garde du stock pas cher plutôt que brader.");
    if (m === nf - 1) {
      out.push("Mars : 285 000 € de naturels + 150 000 € de salaires + 20 000 € d'admin à payer. Vérifie la prévision de trésorerie MAINTENANT.");
      out.push("Les industriels perdent leur acheteur allemand en mars : achète le minimum maintenant, en masse en mars.");
    }
    if (m === nf) out.push("Avril : demande naturels environ 4 600 lots par distributeur. Si ta trésorerie est confortable, passe aux 30 jours chez les vignerons.");
    if (m === 4) out.push("Mai : pic des vignerons. Achète environ 10 % de plus en avril et prévois l'e-mailing vignerons.");
    if (m === 5) out.push("Juin : la demande revient au niveau de mars. N'achète pas trop en mai.");
    const plan = purchasePlan(state, m);
    if (plan.mixed && plan.mixed.buy) out.push(`Achats agglomérés pour ${MONTHS[m]} : environ ${plan.mixed.buy.toLocaleString("fr-FR")} lots (cible ${plan.mixed.targets.target} €, plafond ${plan.mixed.targets.ceiling} €).`);
    if (plan.natural && plan.natural.buyA) out.push(`Achats Espagne A pour ${MONTHS[m]} : environ ${plan.natural.buyA.toLocaleString("fr-FR")} lots (cible ${plan.natural.targets.A.target} €, plafond ${plan.natural.targets.A.ceiling} €).`);
    return out;
  }

  function alerts(state, m, phase) {
    const out = [];
    const mo = month(state, m);
    // Prix hors fourchette ou sous le coût
    for (const p of productsFor(state, m)) {
      for (const c of CLIENTS) {
        const v = num(get(mo, ["p1", "prices", c.k, p.k], null));
        if (v === null) continue;
        const [lo, hi] = range(state, c.k, p.k);
        if (v < lo || v > hi) out.push({ lvl: "warn", t: `${c.label} ${p.label} : ${v} € est hors fourchette (${lo} à ${hi}), le simulateur le ramènera à la borne.` });
        if (p.k === "mixed" && v < mixedCost(state)) out.push({ lvl: "bad", t: `${c.label} agglomérés à ${v} € : sous ton coût (${mixedCost(state)} €). Tu vends à perte.` });
      }
    }
    // Pub produit + ciblé
    const tgt = CLIENTS.some((c) => get(mo, ["p1", "marketing", c.k], "none") !== "none");
    if (tgt && (num(mo.p1.adProduct) || 0) > 0) out.push({ lvl: "warn", t: "Pub produit ET actions ciblées en même temps : Sciado conseille de choisir l'un ou l'autre." });
    // Délais longs avant mars
    const nf = num(state.settings.naturalsFrom) || 3;
    if (m >= 2 && m <= nf) {
      for (const c of CLIENTS) {
        const tm = get(mo, ["p1", "terms", c.k], null);
        if (tm === "30" || tm === "60") out.push({ lvl: "warn", t: `${c.label} à ${tm} jours en ${MONTHS[m - 1]} : l'argent arrivera après mars. Préfère à la livraison.` });
      }
    }
    // Trésorerie
    const cash = lastCashForecast(state, m + 1);
    if (cash !== null && cash < 0) out.push({ lvl: "bad", t: `Trésorerie prévue négative (${cash.toLocaleString("fr-FR")} €) : −10 points par mois. Raccourcis tes délais clients, passe tes achats à 60 jours, coupe le marketing.` });
    // Phase 2
    if (phase === 2) {
      for (const p of productsFor(state, m)) {
        const dt = demandTotal(state, m, p.k);
        const st = availableStock(state, m, p.k);
        if (dt !== null && st !== null && dt > st * 1.1 && st > 0) out.push({ lvl: "info", t: `${p.label} : demande ${dt.toLocaleString("fr-FR")} pour ${st.toLocaleString("fr-FR")} en stock. Sers d'abord les clients les plus chers, rachète du stock immédiat à un distributeur, monte le prix le mois prochain.` });
        if (dt !== null && st && dt < st * 0.5) out.push({ lvl: "info", t: p.k.startsWith("Q") ? `${p.label} : le tri en sort ${st.toLocaleString("fr-FR")} pour ${dt.toLocaleString("fr-FR")} demandés. Le surplus reste en stock pour le mois prochain, ou se revend à un distributeur à court.` : `${p.label} : peu de demande (${dt.toLocaleString("fr-FR")}) pour ton stock (${st.toLocaleString("fr-FR")}). Garde le surplus, n'achète presque rien, propose-le aux distributeurs à court.` });
      }
      const bought = (state.offers || []).filter((o) => num(o.month) === m && o.type === "buy" && ["accepted", "confirmed"].includes(o.status));
      const last = num(state.settings.months) || 6;
      if (m < last && !bought.length && (mo.p2.done || Object.keys(mo.p2.demand || {}).length)) out.push({ lvl: "warn", t: `Aucun achat accepté enregistré ce mois-ci : sans achat, rien à vendre en ${MONTHS[m] || "mois suivant"}.` });
      if (m >= last && bought.length) out.push({ lvl: "warn", t: "Achat enregistré au dernier mois : il ne servira à rien si la partie s'arrête." });
    }
    // Résultat du mois précédent négatif
    const prevRes = num(get(state.months, [m - 1, "results", "monthlyResult"], null));
    if (prevRes !== null && prevRes < 0) out.push({ lvl: "warn", t: `Résultat de ${MONTHS[m - 2]} négatif (${prevRes.toLocaleString("fr-FR")} €) : il compte double. Si tu as beaucoup vendu, tes prix étaient trop bas ou tes achats trop chers ; si tu as peu vendu, tes prix étaient trop hauts.` });
    return out;
  }

  /* ---------- Valeurs effectives : ce qui a été saisi, sinon la reco ---------- */
  function effPrice(state, m, c, p) {
    const v = num(get(state.months, [m, "p1", "prices", c, p], null));
    return v !== null ? v : recoPrice(state, m, c, p).price;
  }
  function effTerm(state, m, c) {
    const v = get(state.months, [m, "p1", "terms", c], null);
    return v ? String(v) : recoTerms(state, m)[c];
  }
  function effMarketing(state, m) {
    const mo = get(state.months, [m, "p1"], {});
    const r = recoMarketing(state, m);
    const stored = CLIENTS.some((c) => get(mo, ["marketing", c.k], null)) || num(mo.adProduct) !== null;
    if (!stored) return { adProduct: r.adProduct, targeted: Object.assign({}, r.targeted), reco: true };
    const t = {};
    for (const c of CLIENTS) t[c.k] = get(mo, ["marketing", c.k], null) || "none";
    return { adProduct: num(mo.adProduct) || 0, targeted: t, reco: false };
  }

  /* Tri conseillé : couvrir la demande Q3 et Q4 restante avec l'Espagne A d'abord, puis B, puis C pour le Q1 */
  function recoSort(state, m) {
    const s = state.settings;
    const out = { A: 0, B: 0, C: 0, why: "", rem: {} };
    if (!isNat(state, m)) return out;
    let capLeft = num(s.sortCap) || 20000;
    const rem = {};
    for (const q of ["Q1", "Q2", "Q3", "Q4"]) {
      const dem = demandTotal(state, m, q);
      const target = dem !== null ? dem : CLIENTS.reduce((t, c) => t + need(state, m, c.k, q), 0);
      rem[q] = Math.max(0, target - (stockOf(state, m, q) || 0));
    }
    const y = (o, i) => (num((s.yields[o] || [])[i]) || 0) / 100;
    const qi = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
    for (const o of ["A", "B", "C"]) {
      const stock = stockOf(state, m, o) || 0;
      if (!stock || capLeft <= 0) continue;
      const focus = o === "C" ? ["Q1", "Q2", "Q3", "Q4"] : ["Q3", "Q4"];
      let lots = 0;
      for (const q of focus) {
        const yy = y(o, qi[q]);
        if (yy > 0 && rem[q] > 0) lots = Math.max(lots, Math.ceil(rem[q] / yy));
      }
      lots = Math.min(lots, stock, capLeft);
      if (!lots) continue;
      out[o] = lots;
      capLeft -= lots;
      for (const q of Object.keys(qi)) rem[q] = Math.max(0, rem[q] - Math.floor(lots * y(o, qi[q])));
    }
    out.rem = rem;
    const parts = [];
    if (out.A) parts.push(`${out.A.toLocaleString("fr-FR")} lots d'Espagne A`);
    if (out.B) parts.push(`${out.B.toLocaleString("fr-FR")} de B`);
    if (out.C) parts.push(`${out.C.toLocaleString("fr-FR")} de C`);
    out.why = parts.length
      ? `Trier ${parts.join(", ")} couvre la demande Q3 et Q4 de ce mois (les plus gros volumes). Le reste reste non trié : il se revend plus facilement et ne coûte rien à trier.`
      : "Rien à trier : ton stock trié couvre déjà la demande, ou tu n'as pas de naturels non triés.";
    if (rem.Q4 > 0 || rem.Q3 > 0) out.why += ` Il manquera encore ${rem.Q4 ? `${rem.Q4.toLocaleString("fr-FR")} Q4` : ""}${rem.Q4 && rem.Q3 ? " et " : ""}${rem.Q3 ? `${rem.Q3.toLocaleString("fr-FR")} Q3` : ""} : sers d'abord les clients qui paient le plus, rachète à un distributeur (livraison immédiate).`;
    return out;
  }

  /* Remplit ce qui n'a pas été saisi avec les recos (quand on passe à l'étape suivante) */
  function commitP1(state, m) {
    const mo = month(state, m);
    for (const p of productsFor(state, m)) for (const c of CLIENTS) {
      mo.p1.prices[c.k] = mo.p1.prices[c.k] || {};
      if (num(mo.p1.prices[c.k][p.k]) === null) mo.p1.prices[c.k][p.k] = recoPrice(state, m, c.k, p.k).price;
    }
    const rt = recoTerms(state, m);
    for (const c of CLIENTS) if (!mo.p1.terms[c.k]) mo.p1.terms[c.k] = rt[c.k];
    const eff = effMarketing(state, m);
    if (eff.reco) { mo.p1.adProduct = eff.adProduct; mo.p1.marketing = Object.assign({}, eff.targeted); }
  }
  function commitP2(state, m) {
    const mo = month(state, m);
    if (isNat(state, m) && !["A", "B", "C"].some((o) => num(get(mo, ["p2", "sort", o], null)) !== null)) {
      const r = recoSort(state, m);
      mo.p2.sort = { A: r.A, B: r.B, C: r.C };
    }
    const hasDel = CLIENTS.some((c) => Object.keys(get(mo, ["p2", "deliveries", c.k], {})).length);
    if (!hasDel && Object.keys(mo.p2.demand || {}).length) mo.p2.deliveries = allocate(state, m);
  }

  /* ---------- Parcours guidé : captures à faire, phase par phase ---------- */
  function steps(state, m, phase) {
    const nf = num(state.settings.naturalsFrom) || 3;
    const S = [];
    const add = (id, screen, where, what, why, optional) => S.push({ id, screen, where, what, why, optional: !!optional });
    if (phase === 1) {
      if (m === 1) {
        add("email", "email", "Email Box", "Le mail « Starting notes », puis la liste des destinataires quand tu fais New email (toutes les équipes D… et I…)", "Je compte les distributeurs et les industriels : c'est le rapport de force de toute la partie, et la demande des clients se partage entre distributeurs.");
        add("settings", "settings", "Settings (les 3 onglets : Production, Delays and costs, Customer information)", "Les fourchettes de prix par client et par produit, les délais, les coûts", "Tes prix doivent rester dans les fourchettes (sinon le jeu les ramène à la borne) et tous les calculs partent de ces chiffres.");
        add("balance", "results_balance", "Results > Balance sheet", "La valeur de ton stock de départ", "Elle donne ton vrai coût par lot : on ne vend jamais en dessous.");
        add("guide", "guide", "Guide utilisateur (PDF ou captures)", "Le calcul du score et les besoins des clients", "Les besoins servent à calculer ton attractivité ; le calcul du score dit ce qui rapporte des points.", true);
      } else {
        add("email", "email", "Email Box", m === nf ? "Le mail « Cessation of activity » et les nouveaux mails du mois" : "Les nouveaux mails du mois (s'il y en a)", m === nf ? "Mars change tout : nouveaux produits, nouvelles charges, nouvelles règles de marketing." : "Le formateur change parfois les règles par mail en début de mois.", m !== nf);
        add("cash", "results_cash", "Results > Cash", "La trésorerie et sa prévision sur les 2 mois suivants", "Tes délais de paiement dépendent de ta trésorerie : chaque mois sous zéro coûte 10 points.");
        if (m === nf) add("settings", "settings", "Settings > Customer information et Production", "Les fourchettes Q1 à Q4 et les rendements de la trieuse", "Les nouveaux produits ont leurs propres fourchettes : je recale les prix dessus.");
      }
      add("stock", "stock", "Decisions, panneau du stock (flèche bleue à droite)", "Ton stock vendable ce mois-ci", "On ne vend que ce qu'on a : ça cale la demande à viser.");
      add("planning", "planning", "Decisions > Planning (écran vert), une fois tes valeurs saisies", "L'écran rempli, avant de cliquer sur Finish the phase", "Je vérifie que tout est bien saisi : le jeu ramène sans prévenir un prix hors fourchette à la borne.", true);
    } else if (phase === 2) {
      add("sales", "sales", "Decisions > Sales", "La quantité commandée par chaque client (Quantity of ordered products)", "C'est ta vraie demande : elle donne ton attractivité, la répartition à saisir et les prix du mois prochain.");
      add("stock", "stock", "Panneau du stock (flèche bleue)", isNat(state, m) ? "Ton stock à jour, avec les naturels non triés Espagne A, B, C" : "Ton stock à jour", "Pour répartir les ventes sans dépasser ce que tu as.");
      if (isNat(state, m)) add("production", "production", "Decisions > Production", "La trieuse (capacité, quantités à trier)", "Je calcule combien trier pour couvrir la demande Q3 et Q4.");
      add("nego", "negotiations", "Decisions > Negotiations", "La liste des offres, et le détail (loupe) de chaque offre reçue", "Je juge chaque offre : accepter, négocier ou refuser, avec la contre-offre.");
      add("email", "email", "Email Box", "Les mails des industriels ou des distributeurs", "Leurs prix et leurs stocks annoncés aident à négocier.", true);
    } else {
      add("ranking", "results_ranking", "Results > Ranking", "Ton score du mois, le score moyen et ton rang", "Pour savoir si tu es devant le peloton.");
      add("income", "results_income", "Results > Income statement", "CA, charges, résultat du mois et cumulé", "Le résultat mensuel compte double dans le score.");
      add("cash", "results_cash", "Results > Cash", "La trésorerie de fin de mois et la prévision des 2 mois suivants", "Une prévision négative se corrige maintenant, pas le mois prochain.");
      add("balance", "results_balance", "Results > Balance sheet", "La valeur du stock, les dettes, le découvert", "Le découvert coûte environ 1 % par mois.", true);
      add("kpi", "results_kpi", "Results > Negotiation KPIs", "Qui accepte, qui refuse", "Pour choisir tes partenaires du mois prochain.", true);
    }
    return S;
  }

  function stepDone(state, m, phase, st) {
    const mo = month(state, m);
    const seen = (mo.seen && mo.seen[phase]) || {};
    if (seen[st.id] === true) return true;
    if (seen[st.id] === false) return false;
    const has = (o) => o && typeof o === "object" && Object.keys(o).length > 0;
    const r = mo.results || {};
    const rPrev = m > 1 ? get(state.months, [m - 1, "results"], {}) : {};
    const s = state.settings;
    switch (st.id) {
      case "settings": return !!(s.seen && s.seen[`settings${m === 1 ? "" : m}`]);
      case "balance": return phase === 1 ? num(s.startStockValue) !== null : num(r.stockValue) !== null;
      case "guide": return !!(s.scoreNotes && s.scoreNotes.trim());
      case "stock": return has(mo.p2.stock);
      case "cash": return phase === 1 ? [rPrev.cashEnd, rPrev.cashM1].some((v) => num(v) !== null) : [r.cashEnd, r.cashM1].some((v) => num(v) !== null);
      case "sales": return has(mo.p2.demand);
      case "nego": return (state.offers || []).some((o) => num(o.month) === m);
      case "ranking": return [r.score, r.totalScore, r.rank].some((v) => num(v) !== null);
      case "income": return [r.monthlyResult, r.turnover].some((v) => num(v) !== null);
      default: return false;
    }
  }

  function markSeen(state, m, phase, screens) {
    const mo = month(state, m);
    mo.seen = mo.seen || {};
    mo.seen[phase] = mo.seen[phase] || {};
    const list = steps(state, m, phase);
    const got = [];
    for (const scr of screens || []) {
      for (const st of list) if (st.screen === scr && mo.seen[phase][st.id] !== true) { mo.seen[phase][st.id] = true; got.push(st.id); }
      if (scr === "settings") { state.settings.seen = state.settings.seen || {}; state.settings.seen[`settings${m === 1 ? "" : m}`] = true; }
    }
    return got;
  }

  /* ---------- Contrôles avant de valider une phase ---------- */
  function checks(state, m, phase) {
    const out = [];
    const nf = num(state.settings.naturalsFrom) || 3;
    const last = num(state.settings.months) || 6;
    const mo = month(state, m);
    const add = (label, ok, detail) => out.push({ label, ok, detail: detail || "" });
    const cash = lastCashForecast(state, m + 1);
    if (phase === 1) {
      const outR = [], under = [];
      for (const p of productsFor(state, m)) for (const c of CLIENTS) {
        const v = effPrice(state, m, c.k, p.k);
        const [lo, hi] = range(state, c.k, p.k);
        if (v < lo || v > hi) outR.push(`${c.label} ${p.label} ${v} € (${lo} à ${hi})`);
        if (p.k === "mixed" && v < mixedCost(state)) under.push(`${c.label} ${v} €`);
      }
      add("Tous les prix sont dans les fourchettes du jeu", !outR.length, outR.length ? `Hors fourchette : ${outR.join(", ")}` : "OK");
      add("Aucun aggloméré vendu sous ton coût", !under.length, under.length ? `Sous ${mixedCost(state)} € : ${under.join(", ")}` : `Coût utilisé : ${mixedCost(state)} € par lot`);
      if (m >= 2 && m <= nf) {
        const long = CLIENTS.filter((c) => ["30", "60"].includes(effTerm(state, m, c.k))).map((c) => c.label);
        add("Délais clients courts avant les gros décaissements", !long.length, long.length ? `${long.join(", ")} à 30 ou 60 jours : l'argent arrivera trop tard` : "OK");
      }
      const eff = effMarketing(state, m);
      const both = (num(eff.adProduct) || 0) > 0 && CLIENTS.some((c) => eff.targeted[c.k] && eff.targeted[c.k] !== "none");
      add("Pas de pub produit et d'actions ciblées en même temps", !both, both ? "Choisis l'un ou l'autre (conseil Sciado)" : "OK");
      if (cash !== null) add("Trésorerie prévue positive", cash >= 0, `Prévision la plus basse : ${cash.toLocaleString("fr-FR")} €`);
      else add("Trésorerie prévue positive", null, m === 1 ? "Pas encore de prévision en janvier" : "Capture Results > Cash pour le vérifier");
      const est = estimate(state, m, false);
      add("Résultat estimé du mois", est.result >= 0 ? true : null, `${est.result.toLocaleString("fr-FR")} € (estimation)`);
    } else if (phase === 2) {
      const over = [], overStock = [];
      for (const p of productsFor(state, m)) {
        let tot = 0;
        for (const c of CLIENTS) {
          const d = num(get(mo, ["p2", "demand", c.k, p.k], null));
          const v = num(get(mo, ["p2", "deliveries", c.k, p.k], null));
          if (v !== null) tot += v;
          if (v !== null && d !== null && v > d) over.push(`${c.label} ${p.label}`);
        }
        const st = availableStock(state, m, p.k);
        if (tot > st && st >= 0 && tot > 0) overStock.push(`${p.label} : ${tot.toLocaleString("fr-FR")} pour ${st.toLocaleString("fr-FR")}`);
      }
      const hasDem = Object.keys(mo.p2.demand || {}).length > 0;
      add("Livraisons pas plus hautes que les commandes", hasDem ? !over.length : null, !hasDem ? "Capture Decisions > Sales d'abord" : over.length ? over.join(", ") : "OK");
      add("Livraisons pas plus hautes que le stock", hasDem ? !overStock.length : null, overStock.length ? overStock.join(", ") : hasDem ? "OK" : "");
      if (isNat(state, m)) {
        const tot = ["A", "B", "C"].reduce((t, o) => t + (num(get(mo, ["p2", "sort", o], 0)) || 0), 0);
        const cap = num(state.settings.sortCap) || 20000;
        const tooMuch = ["A", "B", "C"].filter((o) => (num(get(mo, ["p2", "sort", o], 0)) || 0) > (stockOf(state, m, o) || 0) && stockOf(state, m, o) !== null);
        add("Tri dans la capacité et dans ton stock", tot <= cap && !tooMuch.length, tot > cap ? `${tot.toLocaleString("fr-FR")} lots pour ${cap.toLocaleString("fr-FR")} de capacité` : tooMuch.length ? `Plus que ton stock en ${tooMuch.join(", ")}` : "OK");
      }
      const bought = (state.offers || []).filter((o) => num(o.month) === m && o.type === "buy" && ["accepted", "confirmed"].includes(o.status));
      if (m < last) add(`Stock acheté pour ${MONTHS[m] || "le mois suivant"}`, bought.length ? true : false, bought.length ? `${bought.reduce((t, o) => t + (num(o.qty) || 0), 0).toLocaleString("fr-FR")} lots acceptés` : "Aucun achat accepté : sans achat, rien à vendre le mois prochain");
      else add("Rien acheté pour après la fin", !bought.length, bought.length ? "Un achat au dernier mois ne servira à rien" : "OK");
      const tooHigh = bought.filter((o) => { const j = judgeBuy(state, m, o.product, o.price); return j && j.verdict === "refuse"; });
      if (bought.length) add("Aucun achat au-dessus de ton plafond", !tooHigh.length, tooHigh.length ? tooHigh.map((o) => `${o.counterpart || "?"} ${o.price} €`).join(", ") : "OK");
      if (cash !== null) add("Trésorerie prévue positive", cash >= 0, `Prévision la plus basse : ${cash.toLocaleString("fr-FR")} €`);
    } else {
      const r = mo.results || {};
      const v = (k) => num(r[k]);
      add("Résultat du mois positif", v("monthlyResult") === null ? null : v("monthlyResult") >= 0, v("monthlyResult") === null ? "Capture Results > Income statement" : `${v("monthlyResult").toLocaleString("fr-FR")} € (compte double)`);
      add("Trésorerie de fin de mois positive", v("cashEnd") === null ? null : v("cashEnd") >= 0, v("cashEnd") === null ? "Capture Results > Cash" : `${v("cashEnd").toLocaleString("fr-FR")} €`);
      const f = [v("cashM1"), v("cashM2")].filter((x) => x !== null);
      add("Prévision de trésorerie positive", f.length ? Math.min(...f) >= 0 : null, f.length ? `Plus bas prévu : ${Math.min(...f).toLocaleString("fr-FR")} €` : "Capture Results > Cash");
      add("Score au-dessus de la moyenne", v("score") === null || v("avgScore") === null ? null : v("score") >= v("avgScore"), v("score") === null ? "Capture Results > Ranking" : `${v("score")} contre ${v("avgScore") === null ? "?" : v("avgScore")} de moyenne`);
    }
    return out;
  }

  /* ---------- Vue des mois : ce qui se passe et ce qu'il faut préparer ---------- */
  function outlook(state, m) {
    const nf = num(state.settings.naturalsFrom) || 3;
    const last = num(state.settings.months) || 6;
    const cur = state.current || { m: 1, phase: 1 };
    let event;
    if (m === 1) event = "Début de partie : stock de départ, 3 offres du fournisseur allemand, premiers prix et pub.";
    else if (m < nf) event = "Dernier mois avant les naturels : encaisser vite, acheter le minimum, préparer la trésorerie.";
    else if (m === nf) event = "Les naturels arrivent (Q1 à Q4). Fournisseur allemand liquidé : plus d'offres externes. Tu paies 285 000 € de stock et 30 000 € de trieuse. Salaires 150 000 €.";
    else if (m === 5) event = "Pic des vignerons (environ 1,5 fois mars) : mets le paquet sur eux.";
    else if (m === nf + 1) event = "La demande naturels monte (vignerons environ 1,2 fois mars). Délais plus longs possibles si la trésorerie suit.";
    else if (m === 6) event = "La demande revient au niveau de mars.";
    else event = "Même mécanique : attractivité, prix, achats pour le mois suivant.";
    if (m === last) event += " Dernier mois joué : n'achète rien pour la suite.";
    const sumNeed = (prods) => CLIENTS.reduce((t, c) => t + prods.reduce((u, p) => u + need(state, m, c.k, p), 0), 0);
    const fixed = fixedCosts(state, m);
    const exceptional = m === nf ? 315000 : 0;
    const rt = recoTerms(state, m);
    const tl = (k) => (TERMS.find((t) => t.k === k) || { label: k }).label;
    const rm = recoMarketing(state, m);
    const mk = rm.adProduct ? `Pub produit ${rm.adProduct.toLocaleString("fr-FR")} €` : CLIENTS.filter((c) => rm.targeted[c.k] !== "none").map((c) => `${(MKT.find((x) => x.k === rm.targeted[c.k]) || {}).label} ${c.label.toLowerCase()}`).join(", ") || "Aucune";
    const plan = purchasePlan(state, m);
    const buy = [];
    if (plan.mixed && plan.mixed.buy) buy.push(`Agglo environ ${plan.mixed.buy.toLocaleString("fr-FR")} lots (cible ${plan.mixed.targets.target} €)`);
    if (plan.natural && plan.natural.buyA) buy.push(`Espagne A environ ${plan.natural.buyA.toLocaleString("fr-FR")} lots (cible ${plan.natural.targets.A.target} €)`);
    if (!buy.length && plan.notes.length) buy.push(plan.notes[0]);
    const est = estimate(state, m, true);
    const r = get(state.months, [m, "results"], {});
    const status = m < cur.m ? "Passé" : m === cur.m ? "En cours" : "À venir";
    const ant = anticipate(state, m).filter((x) => !/^Achats/.test(x));
    return {
      m, status, event,
      products: isNat(state, m) ? "Agglomérés + naturels Q1 à Q4" : "Agglomérés",
      needMixed: sumNeed(["mixed"]), needNat: isNat(state, m) ? sumNeed(["Q1", "Q2", "Q3", "Q4"]) : 0,
      fixed, exceptional,
      terms: CLIENTS.map((c) => `${c.label} ${tl(rt[c.k]).toLowerCase()}`).join(", "),
      marketing: mk,
      buy: buy.join(" ; ") || "Rien",
      estResult: est.result,
      result: num(r.monthlyResult), cash: num(r.cashEnd),
      watch: ant[0] || ""
    };
  }

  /* Résumé compact de l'état pour le coach IA */
  function summary(state) {
    const s = state.settings;
    const months = {};
    for (const k of Object.keys(state.months).sort((a, b) => a - b)) {
      const mo = state.months[k];
      const idx = {};
      for (const c of CLIENTS) for (const p of PRODUCTS) {
        const v = index(state, num(k), c.k, p.k);
        if (v !== null) (idx[c.k] = idx[c.k] || {})[p.k] = Math.round(v * 100) / 100;
      }
      months[k] = { p1: mo.p1, p2: mo.p2, results: mo.results, indices: idx, notes: mo.notes };
    }
    return {
      position: state.current,
      settings: { myId: s.myId, nDist: s.nDist, nInd: s.nInd, months: s.months, naturalsFrom: s.naturalsFrom, mixedCost: mixedCost(state), startStock: s.startStock, fixed: s.fixed, teams: s.teams, scoreNotes: s.scoreNotes },
      months,
      offers: (state.offers || []).slice(-40),
      journal: (state.journal || []).slice(-15)
    };
  }

  const Engine = {
    CLIENTS, PRODUCTS, RAW, TERMS, MKT, MONTHS,
    defaultState, defaultSettings, emptyMonth, month, num, get, isNat, productsFor, need, range, mixedCost, natCost,
    index, stockOf, sortedOutput, availableStock, delivered, demandTotal, leftover, recoPrice, recoTerms, recoMarketing,
    marketingCost, fixedCosts, expectedRevenue, estimate, allocate, purchasePlan, judgeBuy, judgeSell, lead, checklist,
    anticipate, alerts, summary, lastCashForecast,
    effPrice, effTerm, effMarketing, recoSort, effSort, effDelivered, commitP1, commitP2, steps, stepDone, markSeen, checks, outlook
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
