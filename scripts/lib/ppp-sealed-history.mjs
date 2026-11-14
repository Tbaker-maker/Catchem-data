// Sealed chart backfill on the PkmnPrices history lane.
// One credit per history row. The lane cap in config/ppp-budget.json is the
// ceiling for the UTC day, including credits already in the shared ledger.
// Points are stored raw in the private history shards. They are not written
// for the chart until an overlap sample matches our own TCGplayer days.

export const SHORT_OWN_DAYS = 90;
export const MIN_OVERLAP = 3;
export const MIN_PULL_ROWS = 30;

// Most-watched first: listing-count daily tier, then more listings counted,
// then a higher market, then a lower product id. Listings counted is the
// eBay listing total, not sales.
export function watchRank(a, b) {
  const tier = (p) => (p.tier === "daily" ? 0 : 1);
  const listings = (p) => Number(p.listingsCounted) || 0;
  const market = (p) => Number(p.market) || 0;
  return tier(a) - tier(b)
    || listings(b) - listings(a)
    || market(b) - market(a)
    || a.pid - b.pid;
}

// Short sealed histories: no PokeViz fill, and either no own series or fewer
// than SHORT_OWN_DAYS of our own days. Already-fetched products stay done.
export function queueSealed(products, { filled = new Set(), haveHistory = new Set(), ownDays = new Map() } = {}) {
  const out = [];
  for (const p of products || []) {
    if (!p || p.kind !== "sealed" || !p.pid || !p.pppId) continue;
    if (haveHistory.has(p.pid) || haveHistory.has(String(p.pid))) continue;
    if (filled.has(p.pid) || filled.has(String(p.pid))) continue;
    const days = Number(ownDays.get(p.pid) ?? ownDays.get(String(p.pid)) ?? 0);
    if (days >= SHORT_OWN_DAYS) continue;
    out.push(p);
  }
  out.sort(watchRank);
  return out;
}

// How many rows this call may ask for without crossing the lane cap.
export function pullLimit(meter, { maxRows = 365, minRows = MIN_PULL_ROWS } = {}) {
  if (!meter || meter.stopped) return 0;
  let room = 0;
  for (let n = maxRows; n >= minRows; n--) {
    if (meter.canSpend(n)) { room = n; break; }
  }
  return room;
}

function ownMap(ownPoints) {
  const own = new Map();
  for (const p of ownPoints || []) {
    const day = Array.isArray(p) ? p[0] : p?.date;
    const price = Array.isArray(p) ? Number(p[1]) : Number(p?.price ?? p?.market);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(day)) && price > 0) own.set(String(day), price);
  }
  return own;
}

// Unopened USD TCGplayer rows only. Cardmarket and other conditions stay out.
export function usdUnopened(rows) {
  const out = [];
  for (const row of rows || []) {
    if (String(row?.source || "").toLowerCase() !== "tcgplayer") continue;
    if (String(row?.currency || "").toUpperCase() !== "USD") continue;
    if (String(row?.condition || "Unopened") !== "Unopened") continue;
    const day = String(row.date || "").slice(0, 10);
    const price = Number(row.avg);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(price > 0)) continue;
    out.push([day, Math.round(price * 100) / 100]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return out;
}

// Sample overlap against our own days. No prices in the returned counts.
// A product with fewer than MIN_OVERLAP shared days is held, not shown.
export function verifyOverlap(pppRows, ownPoints, { minOverlap = MIN_OVERLAP, pct = 0.01, usd = 0.05 } = {}) {
  const own = ownMap(ownPoints);
  const points = usdUnopened(pppRows);
  let overlap = 0;
  let mismatches = 0;
  const sample = [];
  for (const [day, price] of points) {
    if (!own.has(day)) continue;
    overlap++;
    const base = own.get(day);
    const ok = Math.abs(price - base) <= Math.max(usd, base * pct);
    if (sample.length < 8) sample.push(ok);
    if (!ok) mismatches++;
  }
  const sampleBad = sample.filter((ok) => !ok).length;
  const passed = overlap >= minOverlap && sampleBad === 0 && mismatches === 0;
  return { passed, overlap, mismatches, sample: sample.length };
}

// Chart points are only dates before our first own day, and only after verify.
export function chartPoints(pppRows, ownPoints) {
  const check = verifyOverlap(pppRows, ownPoints);
  if (!check.passed) return { show: false, points: [], ...check };
  const own = [...ownMap(ownPoints).keys()].sort();
  const first = own[0] || null;
  if (!first) return { show: false, points: [], ...check, reason: "no own day" };
  const points = usdUnopened(pppRows).filter((p) => p[0] < first);
  if (!points.length) return { show: false, points: [], ...check, reason: "no earlier day" };
  return { show: true, points, ...check, fillTo: first };
}

// One own TCGplayer day. The first price kept for a day wins, so a later
// file cannot overwrite a day we already counted.
export function rememberOwnDay(byPid, pid, day, price) {
  const id = Number(pid);
  const d = String(day || "").slice(0, 10);
  const n = Number(price);
  if (!Number.isInteger(id) || id <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !(n > 0)) return byPid;
  let days = byPid.get(id);
  if (!days) { days = new Map(); byPid.set(id, days); }
  if (!days.has(d)) days.set(d, Math.round(n * 100) / 100);
  return byPid;
}

export function ownPoints(byPid, pid) {
  const days = byPid.get(Number(pid));
  if (!days) return [];
  return [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// Rows already paid for on the history lane. Gate them again. This does not
// fetch. A product with no own day, a failed overlap, or no earlier day stays out.
export function verifyStoredHistory(records, byPid, { skip = new Set() } = {}) {
  const items = [];
  let verified = 0;
  let held = 0;
  for (const rec of records || []) {
    const pid = Number(rec?.pid);
    if (!pid || skip.has(pid)) continue;
    const gate = chartPoints(rec.rows || [], ownPoints(byPid, pid));
    if (!gate.show) { held++; continue; }
    verified++;
    skip.add(pid);
    items.push({ pid, points: gate.points, verifiedOverlap: gate.overlap });
  }
  return { items, verified, held };
}

export function progressDoc({ asOf, cap, spentBefore = 0, spentThisRun = 0, queued = 0, done = 0, verified = 0, held = 0, skipped = 0, shown = 0, status = "idle", reason = "" } = {}) {
  return {
    asOf,
    lane: "history",
    cap,
    spentBefore,
    spentThisRun,
    spentToday: spentBefore + spentThisRun,
    queued,
    done,
    verified,
    held,
    skipped,
    shown,
    chartFill: false,
    status,
    reason,
    note: "Counts only. History rows stay private until an overlap sample matches our own TCGplayer days. chartFill stays off, so nothing from this lane is on the chart yet.",
  };
}
