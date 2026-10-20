// Merge two copies of the listing-counts files when two runs wrote them on the same day.
// The price run (its after-sealed listing step) and the standalone Listing counts run both
// write data/derived/listing-counts/. When both push, git cannot merge them line by line,
// so the price commit used to stop in a conflicted rebase and the night's prices never landed.
// These merges keep every read and every logged eBay call from both sides.

const ts = (v) => { const n = Date.parse(v || ""); return Number.isFinite(n) ? n : 0; };

// state.json: newest refresh per id; call log is the union (the shared 24h budget needs both runs' calls).
export function mergeState(a = {}, b = {}) {
  const last = { ...(a.last || {}) };
  for (const [id, at] of Object.entries(b.last || {})) if (!last[id] || ts(at) > ts(last[id])) last[id] = at;
  const seen = new Set();
  const log = [];
  for (const e of [...(a.log || []), ...(b.log || [])]) {
    const key = `${e?.at}|${e?.source}|${e?.n}`;
    if (seen.has(key)) continue;
    seen.add(key);
    log.push(e);
  }
  log.sort((x, y) => ts(x.at) - ts(y.at));
  return { ...a, ...b, last, log };
}

// Rows keyed by id: the row whose id was refreshed most recently (per merged state.last) wins;
// otherwise the newer row date, then side b.
function pickRow(ra, rb, lastA, lastB) {
  if (!ra) return rb;
  if (!rb) return ra;
  const ta = ts(lastA), tb = ts(lastB);
  if (ta !== tb) return ta > tb ? ra : rb;
  return String(ra.date || "") > String(rb.date || "") ? ra : rb;
}

export function mergeLatest(a = {}, b = {}, stateA = {}, stateB = {}) {
  const rows = {};
  const ids = new Set([...Object.keys(a.rows || {}), ...Object.keys(b.rows || {})]);
  for (const id of ids) rows[id] = pickRow(a.rows?.[id], b.rows?.[id], stateA.last?.[id], stateB.last?.[id]);
  const asOf = String(a.asOf || "") > String(b.asOf || "") ? a.asOf : b.asOf;
  return { ...a, ...b, rows, asOf };
}

export function mergeHistoryDay(a = {}, b = {}, stateA = {}, stateB = {}) {
  const byA = new Map((a.rows || []).filter((r) => r?.id).map((r) => [r.id, r]));
  const byB = new Map((b.rows || []).filter((r) => r?.id).map((r) => [r.id, r]));
  const rows = [];
  for (const id of new Set([...byA.keys(), ...byB.keys()])) rows.push(pickRow(byA.get(id), byB.get(id), stateA.last?.[id], stateB.last?.[id]));
  return { ...a, ...b, date: a.date || b.date, rows };
}

// api-usage.json: one entry per run; keep both runs' nights, in time order, last 120.
export function mergeUsage(a = {}, b = {}) {
  const seen = new Set();
  const nights = [];
  for (const n of [...(a.nights || []), ...(b.nights || [])]) {
    const key = `${n?.at}|${n?.date}|${n?.ebayBrowse?.listingCountCalls}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nights.push(n);
  }
  nights.sort((x, y) => ts(x.at) - ts(y.at));
  return { ...a, ...b, nights: nights.slice(-120) };
}
