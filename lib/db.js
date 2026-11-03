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
    async select(table, q) { return (await call('GET', table + '?' + query(q))).data || []; },
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
    if (q.limit) rows = rows.slice(0, q.limit);
    return rows.map(function (r) { return Object.assign({}, r); });
  }
  const now = function () { return new Date().toISOString(); };
  const auto = { hq_knowledge: 1, hq_messages: 1, hq_tasks: 1, hq_runs: 1, hq_proposals: 1, hq_leads: 1, hq_outbox: 1, hq_items: 1, hq_inbox: 1 };
  const uniques = { hq_leads: 'dedupe', hq_items: 'dedupe', hq_config: 'key', hq_suppression: 'email', hq_daily: 'day', hq_agents: 'id', hq_companies: 'id', hq_inbox: 'message_id' };
  return {
    mode: 'memoire', tables: T,
    async select(t, q) { return sel(t, q); },
    async one(t, q) { return sel(t, Object.assign({}, q, { limit: 1 }))[0] || null; },
    async count(t, q) { return sel(t, q).length; },
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
        const v = { key: k, value: { until: new Date(Date.now() + a.p_seconds * 1000).toISOString() } };
        if (row) Object.assign(row, v); else c.push(v);
        return true;
      }
      if (fn === 'hq_unlock') { T.hq_config = tab('hq_config').filter(function (x) { return x.key !== 'lock:' + a.p_name; }); return null; }
      if (fn === 'hq_menage') return { runs: 0, messages: 0 };
      return null;
    }
  };
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

module.exports = { open, demo, memory, pgrest, query, forcer, BaseManquante };
