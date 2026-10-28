/* ViNego Cockpit : passerelle IA (Anthropic).
   Actions : extract (lire captures / texte / PDF et renvoyer du JSON), coach (chat), analyze (débrief du mois). */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODELS = [process.env.AI_MODEL, "claude-sonnet-5-5", "claude-sonnet-4-5"].filter(Boolean);

const PLAYBOOK = `
Tu es le coach de Louis, distributeur dans le business game ViNego (Sciado Partenaires), épreuve de fin de Bachelor.
Objectif : battre tous les autres joueurs. Le score : le résultat mensuel compte double, chaque mois de trésorerie négative coûte 10 points, découvert = agios d'environ 1 % par mois.

RÈGLES DU JEU (valeurs des vidéos Sciado, à remplacer par celles de la session si elles diffèrent)
- Chaque mois : phase 1 planification (prix, délai, pub par client), phase 2 négociation (ventes, tri, achats). Le formateur passe d'une phase à l'autre.
- Livraison industriel vers distributeur : 30 jours (acheté ce mois-ci = vendable le mois prochain). Entre distributeurs : livraison immédiate.
- Clients finaux : vignerons, cavistes, grands comptes (négociants). La demande totale par client = besoin du guide x nombre de distributeurs, partagée selon prix, délai et pub. Indice = demande reçue / besoin du guide.
- Fourchettes agglomérés : vignerons 40-80, cavistes 25-50, grands comptes 10-30 € le lot. Naturels (dès mars) : Q1 160-200 / 145-170 / 130-150, Q2 140-180 / 125-150 / 110-130, Q3 120-160 / 105-130 / 90-110, Q4 100-140 / 85-100 / 70-90 (vignerons / cavistes / grands comptes).
- Besoins par distributeur : agglomérés 200 / 1 200 / 6 000. Naturels mars : Q1 130/200/0, Q2 260/200/300, Q3 390/200/600, Q4 520/600/900. Vignerons avril x1,23, mai x1,54 (pic), juin = mars.
- Charges distributeur : salaires 40 000 €/mois puis 150 000 € dès mars, admin 20 000 €, stockage 0,33 % de la valeur du stock. Pub jan-fév 2,5 à 5 % du CA. Dès mars actions ciblées par client : flyers 10 000, e-mailing 20 000, visite 50 000 € HT. Ne pas cumuler pub produit et actions ciblées.
- Mars : le fournisseur allemand est en liquidation, plus d'offres externes. Le distributeur rachète un stock de naturels (285 000 € payés en mars) et une trieuse (30 000 € comptant). Les industriels rachètent des planches (175 000 € payés en mars).
- Phase 2 du distributeur, dans cet ordre : Production (tri des naturels), puis Sales (ventes), puis Negotiations. Les lots triés en Production sont donc vendables dans le même mois (vidéos Sciado Month 3 Phase 2 Production puis Sales).
- Trieuse : 2 € par lot, 20 000 lots/mois. Rendements Q1/Q2/Q3/Q4 : Espagne A 15/30/30/25 %, B 20/30/30/20 %, C 25/30/25/20 %.
- Prix moyens d'achat des naturels : A 55, B 60, C 65 €. Coût industriel estimé : agglo 8-9 € variable, 18-20 € complet ; naturel A environ 18 €.

STRATÉGIE DE LOUIS
- Marge et trésorerie d'abord, volume ensuite. Ne jamais vendre sous le coût, jamais de trésorerie prévue négative à 2 mois, jamais une concession sans contrepartie, toujours deux fournisseurs, toujours acheter pour le mois suivant.
- Janvier : prix juste sous les ronds (vignerons 69, cavistes 39, grands comptes 24 ou coût + 3), 30 jours vignerons et cavistes, comptant grands comptes, pub 2,5 % du CA. Garder le surplus (stocker coûte peu), le revendre aux distributeurs à court.
- Février : délais courts partout pour encaisser avant mars, achats minimum (prix industriels hauts tant qu'ils ont l'acheteur allemand), préparer la trésorerie de mars.
- Mars et après : prix inversés à la rareté (Q4 au prix fort, Q1-Q2 agressifs), Espagne A en priorité, lots de A à acheter = demande Q3 attendue / 0,30, accords sur 3 mois à 60 jours avec 1-2 industriels, une action marketing ciblée rentable (vignerons). Le délai client long ne coûte rien si la trésorerie reste positive.
- Réajuster en phase 1 selon l'indice du mois précédent : au-dessus de 1,3 avec rupture, monter de 10 % de la fourchette ; sous 0,7 avec stock invendu, baisser de 10 % ; sinon garder. Un levier à la fois.
- Négo : appel d'offres, ancre justifiée, trois options équivalentes, donnant-donnant, cadrage par les contraintes de l'industriel, questions avant chiffres, timing (volume principal tôt, complément en fin de phase), grignotage final. Pas de mensonge vérifiable : le formateur lit les mails et la posture est notée.
- Repères d'achat (ancre / cible / plafond) : agglo jan-fév 16/19/20, agglo dès mars 12/15/20, A 42/48/60, B 45/50/58, C 42/48/55.

STYLE
Réponds en français, tutoiement, direct, dense, orienté action, avec des chiffres précis tirés des données. Pas de tirets cadratins, pas d'emojis. Quand une donnée manque, dis laquelle et comment l'obtenir. Signale clairement quand tu fais une hypothèse.
`;

const EXTRACT_SCHEMA = `{
  "screen": "planning | sales | production | negotiations | offer_detail | stock | settings | results_ranking | results_income | results_cash | results_balance | email | guide | other (plusieurs possibles séparés par des virgules)",
  "month": "numéro du mois visible (janvier = 1) ou null",
  "stock": { "mixed": 0, "A": 0, "B": 0, "C": 0, "Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0 },
  "demand": { "winemakers": { "mixed": 0, "Q1": 0 }, "cellars": {}, "keyacc": {} },
  "deliveries": { "winemakers": {}, "cellars": {}, "keyacc": {} },
  "prices": { "winemakers": { "mixed": 0 }, "cellars": {}, "keyacc": {} },
  "terms": { "winemakers": "order | delivery | 30 | 60" },
  "adProduct": 0,
  "marketing": { "winemakers": "none | flyers | emailing | visit" },
  "sort": { "A": 0, "B": 0, "C": 0 },
  "offers": [ { "dir": "in | out", "counterpart": "ex. I1_41240 ou Externe", "type": "buy | sell", "product": "mixed | A | B | C | Q1 | Q2 | Q3 | Q4", "qty": 0, "price": 0, "term": "order | delivery | 30 | 60", "status": "pending | accepted | refused | cancelled" } ],
  "results": { "turnover": 0, "monthlyResult": 0, "cumResult": 0, "cashStart": 0, "cashEnd": 0, "inflows": 0, "outflows": 0, "cashM1": 0, "cashM2": 0, "score": 0, "totalScore": 0, "avgScore": 0, "rank": 0, "marketingCosts": 0, "wages": 0, "stockValue": 0 },
  "settings": { "myId": "", "teams": ["D1_...", "I2_..."], "ranges": { "winemakers": { "mixed": [40, 80] } }, "fixed": { "wages": 0, "admin": 0, "storagePct": 0 }, "yields": { "A": [15, 30, 30, 25] }, "sortCost": 0, "sortCap": 0, "needs": { "3": { "winemakers": { "Q1": 0 } } } },
  "emails": [ { "from": "", "subject": "", "summary": "résumé utile en une phrase" } ],
  "notes": "ce qui est important pour la stratégie, en français, 3 phrases max"
}`;

const SMART_SYSTEM = `${PLAYBOOK}

TON RÔLE ICI
Tu es l'assistant intégré au tableau de suivi de Louis (il est distributeur). Il t'envoie n'importe quoi : des captures d'écran du simulateur, du texte copié d'une page, un PDF, une info qu'il tape vite (« j'ai 4 000 lots de Q3 », « I2 me propose 48 € à 60 jours »), une consigne (« le formateur a dit qu'on joue 5 mois », « on passe en phase 2 »), ou une question.
Tu fais toujours deux choses :
1. DATA : tu ranges toutes les informations dans le JSON pour que l'outil les enregistre au bon endroit. Rien d'inventé : seulement ce qui est visible ou dit.
2. REPLY : tu réponds à Louis.

Correspondances : Winemakers = winemakers (vignerons), Cellars ou Sellers = cellars (cavistes), Traders ou Key accounts = keyacc (grands comptes). Mixed stoppers = mixed. Spain A / semi-finished Spain A = A (naturels non triés), idem B et C. Q1 à Q4 = Q1 à Q4.
Écrans : Decisions > Planning (prix, délais, publicité par client) = planning ; Decisions > Sales (Quantity of ordered products by the customers = demand ; Quantity of final products to deliver = deliveries) = sales ; Decisions > Production (trieuse, quantités triées = sort) = production ; Decisions > Negotiations (flèche vers la gauche = reçue (in), vers la droite = envoyée (out) ; Purchase = achat (buy), Sale = vente (sell)) = negotiations ; détail d'une offre = offer_detail ; Stock for sale = stock ; Settings = settings ; Results : Ranking = results_ranking, Income statement = results_income, Cash = results_cash (prévisions des mois suivants = cashM1 et cashM2), Balance sheet = results_balance, Negotiation KPIs = results_kpi ; Email Box = email ; guide utilisateur = guide.
Délais : At order = order, At delivery = delivery, 30 days = 30, 60 days after delivery = 60.

FORMAT DE SORTIE OBLIGATOIRE, rien d'autre :
<reply>
ta réponse à Louis
</reply>
<data>
{ objet JSON }
</data>

Clés possibles du JSON (toutes optionnelles, omets ce qui n'est pas donné) :
${EXTRACT_SCHEMA.replace(/\n}$/, "")},
  "screens": ["planning", "sales", "..."],
  "current": { "m": 3, "phase": 2 },
  "remember": "un fait utile à noter dans le journal (règle annoncée par le formateur, info sur un concurrent), ou null"
}
Dans "settings" tu peux aussi mettre : "months" (nombre de mois joués), "naturalsFrom", "nDist", "nInd", "startStock", "startStockValue", "mixedCost", "naturalCost" { "A": 55 }, "buyTargets" { "A": { "anchor": 42, "target": 48, "ceiling": 60 } }, "fixed" { "wagesNat": 150000 }, "scoreNotes" (texte du calcul du score s'il est visible).
"month" : le mois auquel appartiennent les données s'il est visible ou dit (janvier = 1), sinon null. Des résultats (Results) sans mois visible appartiennent au dernier mois terminé.
"current" : seulement si Louis écrit lui-même qu'il passe à un autre mois ou une autre phase (phase 3 = résultats). Jamais à partir d'une capture.
Nombres sans espaces ni symboles (12 000 = 12000 ; -48 520,01 € = -48520.01).

RÈGLES POUR REPLY
- Question posée : réponds-y d'abord, de façon chiffrée, à partir de ses données et de la stratégie. Donne la décision à prendre, pas un cours.
- Les recommandations calculées par l'outil sont dans toolRecos (prix, délais, marketing, tri, répartition, plan d'achat, contrôles). Appuie-toi dessus ; ne les contredis qu'avec une raison chiffrée, et dis-le clairement.
- Offre d'achat reçue : prix inférieur ou égal à la cible = bon prix, accepte (vérifie la quantité et la trésorerie) ; entre la cible et le plafond = négocie, contre-offre entre les deux ; au-dessus du plafond = refuse ou contre-offre à la cible. Les offres externes (fournisseur allemand) ne se négocient pas : accepter ou refuser.
- N'invente aucune règle du jeu. Si tu n'es pas sûr d'une règle, dis-le en une phrase et dis comment vérifier.
- Données lues : dis en 1 à 3 lignes ce que tu as lu (les chiffres clés) et ce que ça change pour sa prochaine décision.
- Capture floue, coupée ou pas du bon écran : dis exactement quoi recapturer.
- 8 lignes maximum sauf si la question demande plus. Tutoiement, français, direct. Pas de tirets cadratins, pas d'emojis, pas de titres.`;

function splitSmart(text) {
  const t = text || "";
  const r = t.match(/<reply>([\s\S]*?)<\/reply>/i);
  const d = t.match(/<data>([\s\S]*?)(<\/data>|$)/i);
  let reply = r ? r[1].trim() : "";
  let data = d ? parseJson(d[1]) : null;
  if (!r && !d) { data = parseJson(t); reply = data ? "" : t.trim(); }
  return { reply, data: data || {} };
}

const EXTRACT_SYSTEM = `Tu lis des captures d'écran, du texte copié ou des PDF du simulateur ViNego (Sciado) côté distributeur, et tu en extrais les données en JSON.

Correspondances : Winemakers = winemakers (vignerons), Cellars ou Sellers = cellars (cavistes), Traders ou Key accounts = keyacc (grands comptes). Mixed stoppers ou bouchons agglomérés = mixed. Stoppers Spain A / semi-finished Spain A = A (naturels non triés), idem B et C. Stoppers Q1 à Q4 = Q1 à Q4.
Écrans possibles : Planning / Marketing positioning (prix, délais, publicité par client), Sales (Quantity of ordered products by the customers = demand ; Quantity of final products to deliver = deliveries), Production (trieuse, quantités triées = sort), Negotiations (liste des offres : flèche vers la gauche = reçue (in), flèche vers la droite = envoyée (out) ; Purchase = achat (buy), Sale = vente (sell)), Summary d'une offre, Stock for sale (stock), Settings (fourchettes de prix, délais, coûts, rendements), Results (Ranking, Income statement, Cash avec prévisions des mois suivants = cashM1 et cashM2, Balance sheet), Email box.
Délais : At order = order, At delivery = delivery, 30 days = 30, 60 days after delivery = 60.

Règles :
- Ne mets QUE les champs réellement visibles. Omet les clés absentes, n'invente rien, pas de zéro par défaut.
- Nombres sans espaces ni symboles (12 000 lots = 12000, -48 520,01 € = -48520.01).
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.

Schéma (indicatif, toutes les clés sont optionnelles) :
${EXTRACT_SCHEMA}`;

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

async function callClaude({ system, messages, maxTokens, effort }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY manquante dans les variables Vercel du projet.");
  let lastErr = null;
  for (const model of MODELS) {
    let withEffort = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = { model, max_tokens: maxTokens || 4000, system, messages };
      if (withEffort && effort) body.output_config = { effort };
      const r = await fetch(API_URL, {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        return { text, model, stop: data.stop_reason };
      }
      const msg = (data.error && data.error.message) || `HTTP ${r.status}`;
      lastErr = new Error(`${model} : ${msg}`);
      if (r.status === 400 && withEffort && /output_config|effort/i.test(msg)) { withEffort = false; continue; }
      if (r.status === 404 || /model/i.test(msg) && r.status === 400) break; // modèle indisponible : on essaie le suivant
      throw lastErr;
    }
  }
  throw lastErr || new Error("Aucun modèle disponible");
}

function parseJson(text) {
  if (!text) return null;
  const s = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(s); } catch (e) { /* on cherche le premier objet */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  }
  return null;
}

function originAllowed(req) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === req.headers.host || host.endsWith(".vercel.app") || host.startsWith("localhost");
  } catch (e) { return false; }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "POST uniquement" });
  if (!originAllowed(req)) return json(res, 403, { error: "Origine non autorisée" });
  if (process.env.COCKPIT_KEY && req.headers["x-cockpit-key"] !== process.env.COCKPIT_KEY) return json(res, 401, { error: "Clé d'accès invalide" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const action = body.action;

  try {
    if (action === "ping") {
      return json(res, 200, { ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY, models: MODELS });
    }

    if (action === "extract") {
      const content = [];
      for (const img of (body.images || []).slice(0, 8)) {
        if (img && img.data) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: img.data } });
      }
      if (body.pdf && body.pdf.data) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: body.pdf.data } });
      const ctx = body.context || {};
      let instr = `Contexte : Louis est distributeur${ctx.myId ? ` (${ctx.myId})` : ""}, mois en cours ${ctx.m || "?"}, phase ${ctx.phase || "?"}.`;
      if (body.hint) instr += ` Type d'écran indiqué par Louis : ${body.hint}.`;
      if (body.text) instr += `\n\nTexte copié depuis le simulateur :\n"""\n${String(body.text).slice(0, 60000)}\n"""`;
      instr += "\n\nExtrais toutes les données visibles au format JSON demandé.";
      content.push({ type: "text", text: instr });
      if (content.length === 1 && !body.text) return json(res, 400, { error: "Rien à lire : ajoute une capture, un PDF ou du texte." });
      const out = await callClaude({ system: EXTRACT_SYSTEM, messages: [{ role: "user", content }], maxTokens: 6000, effort: "low" });
      const data = parseJson(out.text);
      if (!data) return json(res, 502, { error: "La réponse de l'IA n'était pas du JSON lisible.", raw: out.text.slice(0, 2000) });
      return json(res, 200, { ok: true, data, model: out.model });
    }

    if (action === "smart") {
      const content = [];
      for (const img of (body.images || []).slice(0, 8)) {
        if (img && img.data) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: img.data } });
      }
      if (body.pdf && body.pdf.data) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: body.pdf.data } });
      const ctx = body.context || {};
      const text = String(body.text || "").slice(0, 60000);
      if (!content.length && !text.trim()) return json(res, 400, { error: "Rien à lire : ajoute une capture, un PDF ou du texte." });
      let instr = `Position actuelle de Louis : mois ${ctx.m || "?"} (${ctx.monthName || ""}), phase ${ctx.phase || "?"} (${ctx.phaseName || ""}).`;
      if (ctx.steps) instr += `\nCaptures attendues à cette étape : ${ctx.steps}.`;
      if (content.length) instr += `\nIl t'envoie ${content.length} fichier(s). Lis tout ce qui est visible.`;
      if (text.trim()) instr += `\n\nCe que Louis écrit ou colle :\n"""\n${text}\n"""`;
      content.push({ type: "text", text: instr });
      const history = (body.history || []).slice(-6).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 4000) })).filter((m) => m.content);
      while (history.length && history[0].role !== "user") history.shift();
      const msgs = [];
      for (const h of history) { if (msgs.length && msgs[msgs.length - 1].role === h.role) msgs[msgs.length - 1].content += "\n" + h.content; else msgs.push(h); }
      if (msgs.length && msgs[msgs.length - 1].role === "user") msgs.push({ role: "assistant", content: "(noté)" });
      msgs.push({ role: "user", content });
      const system = `${SMART_SYSTEM}\n\nDONNÉES ACTUELLES DE LA PARTIE (JSON) :\n${JSON.stringify(body.state || {}).slice(0, 80000)}`;
      const imagesOnly = content.length > 1 && !text.trim();
      const out = await callClaude({ system, messages: msgs, maxTokens: 7000, effort: imagesOnly ? "low" : "medium" });
      const { reply, data } = splitSmart(out.text);
      const cut = out.stop === "max_tokens" ? "\n\nRéponse coupée : renvoie tes captures en plus petits paquets (2 ou 3 à la fois) pour être sûr que tout est rangé." : "";
      return json(res, 200, { ok: true, reply: (reply || "") + cut, data, model: out.model });
    }

    if (action === "coach") {
      const state = body.state || {};
      const history = (body.messages || []).slice(-14).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 8000) }));
      if (!history.length || history[history.length - 1].role !== "user") return json(res, 400, { error: "Message manquant" });
      const system = `${PLAYBOOK}\n\nDONNÉES ACTUELLES DE LA PARTIE (JSON, saisies par Louis ou extraites de ses captures) :\n${JSON.stringify(state).slice(0, 90000)}\n\nQuand c'est pertinent, termine par : « À faire maintenant », « Attention », « Pour le mois prochain ».`;
      const content = [];
      for (const img of (body.images || []).slice(0, 4)) {
        if (img && img.data) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: img.data } });
      }
      if (content.length) {
        const last = history.pop();
        content.push({ type: "text", text: last.content });
        history.push({ role: "user", content });
      }
      const out = await callClaude({ system, messages: history, maxTokens: 3000, effort: "medium" });
      return json(res, 200, { ok: true, text: out.text, model: out.model });
    }

    if (action === "analyze") {
      const state = body.state || {};
      const m = body.m;
      const system = `${PLAYBOOK}\n\nDONNÉES DE LA PARTIE :\n${JSON.stringify(state).slice(0, 90000)}`;
      const prompt = `Fais le débrief du mois ${m} et le plan du mois ${Number(m) + 1}.
Structure exacte, titres en gras sur leur propre ligne :
**Ce qui s'est passé** (chiffres clés, indice par client, ce qui a marché ou pas)
**Ce que ça dit des concurrents et des industriels**
**Plan pour le mois prochain** (prix conseillés client par client, délais, marketing, quantités et prix d'achat, avec la raison de chaque choix)
**Pièges à éviter**
**Si ça tourne mal** (deux plans B concrets)
Sois précis et chiffré. Si des données manquent, dis lesquelles.`;
      const out = await callClaude({ system, messages: [{ role: "user", content: prompt }], maxTokens: 3500, effort: "medium" });
      return json(res, 200, { ok: true, text: out.text, model: out.model });
    }

    return json(res, 400, { error: "Action inconnue" });
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) });
  }
};
