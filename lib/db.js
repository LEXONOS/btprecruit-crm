// Accès base : PostgREST de Supabase avec la clé secrète (serveur uniquement),
// ou une base en mémoire (mode démo sans clé, et tests).
'use strict';
const { SUPABASE_URL, SUPABASE_KEY } = require('./config');

function enc(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return encodeURIComponent(String(v));
}
function inList(vals) {
  return '(' + vals.map(function (v) { return '"' + String(v).replace(/"/g, '\\"') + '"'; }).map(encodeURIComponent).join(',') + ')';
}
// q = { select, eq:{}, neq:{}, in:{}, gte:{}, lte:{}, gt:{}, lt:{}, is:{}, not_in:{}, ilike:{}, order:'col.desc' | ['a.asc','b.desc'], limit, offset }
function query(q) {
  q = q || {};
  const p = [];
  p.push('select=' + encodeURIComponent(q.select || '*'));
  ['eq', 'neq', 'gte', 'lte', 'gt', 'lt'].forEach(function (op) {
    Object.keys(q[op] || {}).forEach(function (k) { p.push(encodeURIComponent(k) + '=' + op + '.' + enc(q[op][k])); });
  });
  Object.keys(q.in || {}).forEach(function (k) { p.push(encodeURIComponent(k) + '=in.' + inList(q.in[k])); });
  Object.keys(q.not_in || {}).forEach(function (k) { p.push(encodeURIComponent(k) + '=not.in.' + inList(q.not_in[k])); });
  Object.keys(q.is || {}).forEach(function (k) { p.push(encodeURIComponent(k) + '=is.' + (q.is[k] === null ? 'null' : enc(q.is[k]))); });
  Object.keys(q.ilike || {}).forEach(function (k) { p.push(encodeURIComponent(k) + '=ilike.' + encodeURIComponent(q.ilike[k])); });
  if (q.order) p.push('order=' + [].concat(q.order).map(encodeURIComponent).join(','));
  if (q.limit) p.push('limit=' + Number(q.limit));
  if (q.offset) p.push('offset=' + Number(q.offset));
  return p.join('&');
}

class BaseManquante extends Error {}

// Supabase rend au plus 1 000 lignes par requête (max-rows) : au-delà, on pagine, dans un ordre stable (clé primaire en dernier)
const PAGE = 1000;
const CLES = { hq_config: 'key', hq_suppression: 'email', hq_daily: 'day' };
async function paginer(brut, table, q) {
  q = q || {};
  const voulu = q.limit ? Number(q.limit) : Infinity;
  if (voulu <= PAGE) return brut(table, q);
  const cle = CLES[table] || 'id';
  const ordre = [].concat(q.order || []);
  if (!ordre.some(function (o) { return String(o).split('.')[0] === cle; })) ordre.push(cle + '.asc');
  const out = [];
  let offset = Number(q.offset || 0);
  while (out.length < voulu && out.length < 50000) {
    const n = Math.min(PAGE, voulu - out.length);
    const page = await brut(table, Object.assign({}, q, { order: ordre, limit: n, offset: offset }));
    for (const r of page) out.push(r);
    if (page.length < n) break;
    offset += page.length;
  }
  return out;
}

function pgrest(url, key) {
  const legacy = /^eyJ/.test(key);
  function headers(extra) {
    const h = Object.assign({ apikey: key, 'Content-Type': 'application/json' }, extra || {});
    if (legacy) h.Authorization = 'Bearer ' + key;
    return h;
  }
  async function call(method, path, body, extra) {
    const r = await fetch(url + '/rest/v1/' + path, { method: method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok) {
      const msg = (data && (data.message || data.hint)) || ('HTTP ' + r.status);
      const code = data && data.code;
      if (code === 'PGRST205' || code === '42P01' || /could not find the table|does not exist/i.test(String(msg))) throw new BaseManquante('Tables absentes : ' + msg);
      if (r.status === 401 || r.status === 403) throw new Error('Clé Supabase refusée (HQ_SUPABASE_KEY) : ' + msg);
      throw new Error(path.split('?')[0] + ' : ' + msg);
    }
    return { data: data, headers: r.headers };
  }
  return {
    mode: 'supabase',
    async select(table, q) { return paginer(async function (t, qq) { return (await call('GET', t + '?' + query(Object.assign({}, qq, { limit: qq.limit || PAGE })))).data || []; }, table, q); },
    async one(table, q) { const r = await this.select(table, Object.assign({}, q, { limit: 1 })); return r[0] || null; },
    async count(table, q) {
      const r = await call('HEAD', table + '?' + query(Object.assign({}, q, { select: 'id' })), undefined, { Prefer: 'count=exact', Range: '0-0' });
      const cr = r.headers.get('content-range') || '';
      const n = parseInt(cr.split('/')[1], 10);
      return isNaN(n) ? 0 : n;
    },
    async insert(table, rows, o) {
      o = o || {};
      const pref = [o.returning === false ? 'return=minimal' : 'return=representation', 'missing=default'];
      if (o.ignoreDuplicates) pref.push('resolution=ignore-duplicates');
      const path = table + (o.onConflict ? '?on_conflict=' + encodeURIComponent(o.onConflict) : '');
      return (await call('POST', path, rows, { Prefer: pref.join(',') })).data || [];
    },
    async upsert(table, rows, o) {
      o = o || {};
      const path = table + '?on_conflict=' + encodeURIComponent(o.onConflict || 'id');
      return (await call('POST', path, rows, { Prefer: 'resolution=merge-duplicates,missing=default,return=' + (o.returning ? 'representation' : 'minimal') })).data || [];
    },
    async update(table, patch, q) {
      return (await call('PATCH', table + '?' + query(Object.assign({}, q, { select: (q && q.select) || '*' })), patch, { Prefer: 'return=representation' })).data || [];
    },
    async remove(table, q) { return (await call('DELETE', table + '?' + query(q), undefined, { Prefer: 'return=minimal' })).data; },
    async rpc(fn, args) { return (await call('POST', 'rpc/' + fn, args || {})).data; }
  };
}

// ── Base en mémoire (démo, tests) ──────────────────────────
function memory(seedTables) {
  const T = seedTables || {};
  const seq = {};
  function tab(t) { if (!T[t]) T[t] = []; return T[t]; }
  function match(row, q) {
    q = q || {};
    for (const k of Object.keys(q.eq || {})) if (String(row[k]) !== String(q.eq[k])) return false;
    for (const k of Object.keys(q.neq || {})) if (String(row[k]) === String(q.neq[k])) return false;
    for (const k of Object.keys(q.in || {})) if (q.in[k].map(String).indexOf(String(row[k])) < 0) return false;
    for (const k of Object.keys(q.not_in || {})) if (q.not_in[k].map(String).indexOf(String(row[k])) >= 0) return false;
    for (const k of Object.keys(q.gte || {})) if (!(row[k] != null && row[k] >= q.gte[k])) return false;
    for (const k of Object.keys(q.lte || {})) if (!(row[k] != null && row[k] <= q.lte[k])) return false;
    for (const k of Object.keys(q.gt || {})) if (!(row[k] != null && row[k] > q.gt[k])) return false;
    for (const k of Object.keys(q.lt || {})) if (!(row[k] != null && row[k] < q.lt[k])) return false;
    for (const k of Object.keys(q.is || {})) if (q.is[k] === null ? row[k] != null : row[k] !== q.is[k]) return false;
    return true;
  }
  function sel(t, q) {
    q = q || {};
    let rows = tab(t).filter(function (r) { return match(r, q); });
    [].concat(q.order || []).reverse().forEach(function (o) {
      const parts = String(o).split('.'), col = parts[0], desc = parts[1] === 'desc';
      rows = rows.slice().sort(function (a, b) {
        const x = a[col], y = b[col];
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
      });
    });
    if (q.offset) rows = rows.slice(q.offset);
    rows = rows.slice(0, Math.min(q.limit || PAGE, PAGE));          // même plafond que Supabase
    return rows.map(function (r) { return Object.assign({}, r); });
  }
  const now = function () { return new Date().toISOString(); };
  const auto = { hq_knowledge: 1, hq_messages: 1, hq_tasks: 1, hq_runs: 1, hq_proposals: 1, hq_leads: 1, hq_outbox: 1, hq_items: 1, hq_inbox: 1, hq_sites: 1, hq_fichiers: 1, hq_videos: 1 };
  const uniques = { hq_leads: 'dedupe', hq_items: 'dedupe', hq_videos: 'dedupe', hq_config: 'key', hq_suppression: 'email', hq_daily: 'day', hq_agents: 'id', hq_companies: 'id', hq_inbox: 'message_id', hq_sites: 'slug' };
  return {
    mode: 'memoire', tables: T,
    async select(t, q) { return paginer(async function (tt, qq) { return sel(tt, qq); }, t, q); },
    async one(t, q) { return sel(t, Object.assign({}, q, { limit: 1 }))[0] || null; },
    async count(t, q) { return tab(t).filter(function (r) { return match(r, q); }).length; },
    async insert(t, rows, o) {
      o = o || {};
      const out = [];
      [].concat(rows).forEach(function (r) {
        const row = Object.assign({ created_at: now(), updated_at: now() }, r);
        const u = uniques[t];
        if (u && row[u] != null && tab(t).some(function (x) { return x[u] === row[u]; })) {
          if (o.ignoreDuplicates) return;
          throw new Error(t + ' : doublon ' + row[u]);
        }
        if (auto[t] && row.id == null) { seq[t] = (seq[t] || 0) + 1; row.id = seq[t]; }
        tab(t).push(row); out.push(Object.assign({}, row));
      });
      return out;
    },
    async upsert(t, rows, o) {
      const key = (o && o.onConflict) || uniques[t] || 'id';
      [].concat(rows).forEach(function (r) {
        const i = tab(t).findIndex(function (x) { return String(x[key]) === String(r[key]); });
        if (i >= 0) Object.assign(tab(t)[i], r, { updated_at: now() });
        else { const row = Object.assign({ created_at: now(), updated_at: now() }, r); if (auto[t] && row.id == null) { seq[t] = (seq[t] || 0) + 1; row.id = seq[t]; } tab(t).push(row); }
      });
      return [];
    },
    async update(t, patch, q) {
      const out = [];
      tab(t).forEach(function (r) { if (match(r, q)) { Object.assign(r, patch); out.push(Object.assign({}, r)); } });
      return out;
    },
    async remove(t, q) { T[t] = tab(t).filter(function (r) { return !match(r, q); }); return null; },
    async rpc(fn, a) {
      if (fn === 'hq_bump') {
        const d = tab('hq_daily');
        let row = d.find(function (x) { return x.day === a.p_day; });
        if (!row) { row = { day: a.p_day, cost_usd: 0, runs: 0, searches: 0, places: 0, leads: 0, emails: 0, items: 0 }; d.push(row); }
        row.cost_usd += a.p_cost || 0; row.runs += a.p_runs || 0; row.searches += a.p_searches || 0; row.places += a.p_places || 0;
        row.leads += a.p_leads || 0; row.emails += a.p_emails || 0; row.items += a.p_items || 0;
        return null;
      }
      if (fn === 'hq_lock') {
        const k = 'lock:' + a.p_name, c = tab('hq_config');
        const row = c.find(function (x) { return x.key === k; });
        if (row && new Date(row.value.until) > new Date()) return false;
        const v = { key: k, value: { until: new Date(Date.now() + a.p_seconds * 1000).toISOString(), owner: a.p_owner || null } };
        if (row) Object.assign(row, v); else c.push(v);
        return true;
      }
      if (fn === 'hq_unlock') { T.hq_config = tab('hq_config').filter(function (x) { return !(x.key === 'lock:' + a.p_name && (!a.p_owner || !x.value || !x.value.owner || x.value.owner === a.p_owner)); }); return null; }
      if (fn === 'hq_menage') return { runs: 0, messages: 0 };
      // la porte : même logique que les fonctions SQL (une instruction, rien entre la lecture et l'écriture)
      if (fn === 'hq_compter') {
        const c = tab('hq_config'), k = 'essai:' + a.p_cle, t = Date.now(), d8 = function (x) { return new Date(x).toISOString(); };
        let row = c.find(function (x) { return x.key === k; });
        if (!row) { row = { key: k, value: { n: 0, debut: d8(t), blocages: 0 }, updated_at: d8(t) }; c.push(row); }
        const v = row.value || {};
        let n = v.n || 0, b = v.blocages || 0, debut = Date.parse(v.debut) || t, jusqu = v.bloque_jusqu ? Date.parse(v.bloque_jusqu) : 0;
        if (jusqu > t) return { bloque: true, dernier: false, n: n, blocages: b, reste_ms: jusqu - t };
        if (debut < t - a.p_fenetre_s * 1000) { n = 0; debut = t; }
        n += 1;
        row.updated_at = d8(t);
        if (n >= a.p_max) {
          b += 1; jusqu = t + 1000 * (a.p_croissant === false ? a.p_blocage_s : Math.min(86400, a.p_blocage_s * Math.pow(2, b - 1)));
          row.value = { n: 0, debut: d8(t), blocages: b, bloque_jusqu: d8(jusqu) };
          return { bloque: false, dernier: true, n: n, blocages: b, reste_ms: jusqu - t };
        }
        row.value = { n: n, debut: d8(debut), blocages: b, bloque_jusqu: jusqu ? d8(jusqu) : null };
        return { bloque: false, dernier: false, n: n, blocages: b, reste_ms: 0 };
      }
      if (fn === 'hq_acces_maj' || fn === 'hq_acces_init') {
        const c = tab('hq_config');
        let row = c.find(function (x) { return x.key === 'acces'; });
        if (!row) { row = { key: 'acces', value: {}, updated_at: now() }; c.push(row); }
        const v = row.value || {};
        if (fn === 'hq_acces_maj') row.value = Object.assign({}, v, a.p_patch || {}, { gen: (v.gen || 0) + (a.p_gen_plus || 0) });
        else if (!('version' in v)) row.value = Object.assign({ gen: 0 }, v, { version: a.p_version });
        row.updated_at = now();
        return Object.assign({}, row.value);
      }
      return null;
    }
  };
}

// Écrire sur une ligne sans écraser ce qu'un autre agent vient d'y mettre (plusieurs agents tournent en même temps) :
// relit la ligne, fn(ligne fraîche) rend le patch (ou null pour renoncer), et l'écriture n'a lieu que si la ligne n'a pas
// bougé entre-temps (même statut, même horodatage). Sinon on relit et on recommence. Rend la ligne écrite, ou null.
// Les champs JSON (data, stripe) se fusionnent dans fn à partir de la ligne fraîche, jamais d'une copie ancienne.
async function majFraiche(db, table, id, fn) {
  for (let essai = 0; essai < 4; essai++) {
    const f = await db.one(table, { eq: { id: id } });
    if (!f) return null;
    const patch = fn(f);
    if (!patch) return null;
    const cond = { id: id };
    if (f.status !== undefined && f.status !== null) cond.status = f.status;
    if (f.updated_at) cond.updated_at = f.updated_at;
    let t = new Date().toISOString();
    if (t === f.updated_at) t = new Date(Date.now() + 1).toISOString();
    const out = await db.update(table, Object.assign({}, patch, { updated_at: patch.updated_at && patch.updated_at !== f.updated_at ? patch.updated_at : t }), { eq: cond });
    if (out && out.length) return out[0];
  }
  return null;
}

let MEM = null;
let FORCE = null;                       // tests : base imposée
function forcer(d) { FORCE = d; }
function open() {
  if (FORCE) return FORCE;
  if (SUPABASE_KEY) return pgrest(SUPABASE_URL.replace(/\/$/, ''), SUPABASE_KEY);
  return null;
}
function demo() { if (!MEM) MEM = memory(); return MEM; }

module.exports = { open, demo, memory, pgrest, query, forcer, majFraiche, BaseManquante };
