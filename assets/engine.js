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
    const sort = get(state.months, [m, "p2", "sort"], {});
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

  function leftover(state, m, p) {
    const s = availableStock(state, m, p);
    return Math.max(0, s - delivered(state, m, p));
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
    const prevP = num(get(state.months, [m - 1, "p1", "prices", c, p], null));
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
        const price = useReco ? recoPrice(state, m, c.k, p.k).price : num(get(state.months, [m, "p1", "prices", c.k, p.k], null));
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
    const mo = get(state.months, [m, "p1"], {});
    let t = num(mo.adProduct) || 0;
    for (const c of CLIENTS) {
      const k = get(mo, ["marketing", c.k], "none");
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
        const price = useReco ? recoPrice(state, m, c.k, p.k).price : num(get(state.months, [m, "p1", "prices", c.k, p.k], null));
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
      const order = CLIENTS.map((c) => ({ c: c.k, price: num(get(state.months, [m, "p1", "prices", c.k, p.k], 0)) || 0, dem: num(get(state.months, [m, "p2", "demand", c.k, p.k], 0)) || 0 }))
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
      let q3 = 0;
      for (const c of CLIENTS) {
        const idx = index(state, m, c.k, "Q3");
        q3 += need(state, next, c.k, "Q3") * (idx ? Math.min(idx, 1.5) : 1);
      }
      const yA = (num(state.settings.yields.A[2]) || 30) / 100;
      const rawLeftA = Math.max(0, (stockOf(state, m, "A") || 0) - (num(get(state.months, [m, "p2", "sort", "A"], 0)) || 0));
      const q3Left = leftover(state, m, "Q3");
      const lots = Math.max(0, Math.ceil((q3 - q3Left) / yA) - rawLeftA);
      plan.natural = { q3Expected: Math.round(q3), q3Leftover: q3Left, rawLeftA, buyA: lots, targets: { A: state.settings.buyTargets.A, B: state.settings.buyTargets.B, C: state.settings.buyTargets.C } };
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
        if (dt !== null && st && dt < st * 0.5) out.push({ lvl: "info", t: `${p.label} : peu de demande (${dt.toLocaleString("fr-FR")}) pour ton stock (${st.toLocaleString("fr-FR")}). Garde le surplus, n'achète presque rien, propose-le aux distributeurs à court.` });
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
    anticipate, alerts, summary, lastCashForecast
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
