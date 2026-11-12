// Pure functions that turn private PkmnPrices responses into the few derived
// numbers we publish. Raw rows (titles, listing urls, comp ids, seller countries)
// never leave this module. Thin data returns null so the page hides the stat.
export const SOLD_WINDOW_DAYS = 90;
export const MIN_SOLD = 5;        // raw sold median needs at least 5 kept comps
export const MIN_GRADED = 3;      // one grader + grade line needs 3 kept comps
export const MIN_DAILY_TOTAL = 5; // the daily sold series needs 5 comps over 2+ days
export const STALE_SOLD_DAYS = 45;
// PkmnPrices can collect a comp days or weeks after it sold, so the newest days
// undercount. The daily series stops this many days before asOf.
export const DAILY_LAG_DAYS = 3; // a sold median whose latest comp is older is hidden
export const SOURCE = "eBay sold comps via PkmnPrices";
export const POP_SOURCE = "PSA, BGS, CGC and SGC population reports via PkmnPrices (GemRate)";
export const EUR_SOURCE = "Cardmarket via PkmnPrices";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;
const r2 = (n) => Math.round(n * 100) / 100;

export function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Words that mark a comp as a different item than the product, unless the
// product's own name uses the same word (a Booster Bundle may say "bundle").
const OFF_ITEM = [
  /\b(psa|bgs|cgc|sgc|beckett|graded|slab(bed)?)\b/i,
  /\b(proxy|custom|orica|replica|fake|reprint art|digital|code card|online code)\b/i,
  /\b(empty|no cards|no packs|box only|opened|open box|unsealed|resealed|damaged|crushed|torn|dent(ed)?|hole)\b/i,
  /\b(lot|bundle of|set of|bulk|case)\b/i,
  /\b(\d+\s?x|x\s?\d+)\b/i,
  /\b(japanese|japan|korean|chinese|german|french|italian|spanish|portuguese)\b/i,
  /\bpromo\b/i,
];

export function offItem(title, productName = "") {
  const t = String(title || "");
  const own = String(productName || "");
  return OFF_ITEM.some((re) => re.test(t) && !re.test(own));
}

// Keep comps that are this exact item, in USD, inside the window, then drop
// anything under half or over double the kept median (the half-price filter),
// and anything under a quarter or over 4x the current TCGplayer market when known
// (a wide guard against a different item; the median filter does the real work).
export function keepComps(rows, { asOf, kind = "single", name = "", market = null, graded = false, days = SOLD_WINDOW_DAYS } = {}) {
  const end = Date.parse(asOf);
  const start = end - days * DAY;
  let kept = [];
  let dropped = 0;
  for (const row of rows || []) {
    const price = Number(row?.price);
    const day = String(row?.sold_at || "").slice(0, 10);
    const t = Date.parse(day);
    const isGraded = !!row?.grader;
    const ok = price > 0 && row?.currency === "USD" && ISO.test(day) && t <= end && t > start
      && isGraded === graded
      && (kind === "sealed" || row?.attribution === "exact")
      && (graded ? true : !offItem(row?.title, name));
    if (!ok) { dropped++; continue; }
    kept.push({ price, day, grader: row.grader || null, grade: row.grade == null ? null : String(row.grade), q: row.grade_qualifier || null });
  }
  if (!graded && Number(market) > 0) {
    const before = kept.length;
    kept = kept.filter((c) => c.price >= market * 0.25 && c.price <= market * 4);
    dropped += before - kept.length;
  }
  if (!graded) {
    const m = median(kept.map((c) => c.price));
    if (m) {
      const before = kept.length;
      kept = kept.filter((c) => c.price >= m * 0.5 && c.price <= m * 2);
      dropped += before - kept.length;
    }
  }
  return { kept, dropped };
}

export function soldStats(rows, opts = {}) {
  const { kept, dropped } = keepComps(rows, opts);
  if (kept.length < MIN_SOLD) return null;
  const prices = kept.map((c) => c.price).sort((a, b) => a - b);
  const last = kept.map((c) => c.day).sort().at(-1);
  if (Date.parse(opts.asOf) - Date.parse(last) > STALE_SOLD_DAYS * DAY) return null;
  const first = kept.map((c) => c.day).sort()[0];
  return {
    n: kept.length,
    read: kept.length + dropped,
    median: r2(median(prices)),
    p25: r2(quantile(prices, 0.25)),
    p75: r2(quantile(prices, 0.75)),
    first,
    last,
    dropped,
    days: opts.days || SOLD_WINDOW_DAYS,
    currency: "USD",
    truncated: !!opts.truncated,
  };
}

// Median by grader + grade (BGS Black Label and CGC Pristine kept apart).
export function gradedStats(rows, opts = {}) {
  const { kept } = keepComps(rows, { ...opts, graded: true });
  const groups = new Map();
  for (const c of kept) {
    if (!c.grade) continue;
    const key = `${c.grader} ${c.grade}${c.q ? ` ${c.q}` : ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const out = [];
  for (const [key, list] of groups) {
    if (list.length < MIN_GRADED) continue;
    const prices = list.map((c) => c.price);
    const m = median(prices);
    // the same half-price filter inside each grade
    const keep = list.filter((c) => c.price >= m * 0.5 && c.price <= m * 2);
    if (keep.length < MIN_GRADED) continue;
    out.push({ label: key, n: keep.length, median: r2(median(keep.map((c) => c.price))), last: keep.map((c) => c.day).sort().at(-1) });
  }
  return out.sort((a, b) => b.n - a.n).slice(0, 6);
}

// sales/volume rows -> [[date, comps recorded]] for raw + graded, USD + EUR.
export function dailySold(rows, { asOf, days = SOLD_WINDOW_DAYS } = {}) {
  const end = Date.parse(asOf);
  const map = new Map();
  for (const row of rows || []) {
    const day = String(row?.date || "").slice(0, 10);
    const n = Number(row?.sales);
    const t = Date.parse(day);
    if (!ISO.test(day) || !(n >= 0) || t > end - DAILY_LAG_DAYS * DAY || t <= end - days * DAY) continue;
    map.set(day, (map.get(day) || 0) + Math.round(n));
  }
  const pts = [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const total = pts.reduce((s, p) => s + p[1], 0);
  if (pts.length < 2 || total < MIN_DAILY_TOTAL) return null;
  return pts;
}

// Population: the variant with the most graded copies, per-grader totals and gems,
// and the top grades. Counts are counts; nothing is estimated.
export function popSummary(body, { variant = "" } = {}) {
  const vars = Array.isArray(body?.variants) ? body.variants : [];
  if (!vars.length) return null;
  const pick = vars.find((v) => variant && v.variant === variant) || [...vars].sort((a, b) => (b.total_population || 0) - (a.total_population || 0))[0];
  const total = Number(pick?.total_population);
  if (!(total > 0)) return null;
  const graders = {};
  for (const [g, rep] of Object.entries(pick.graders || {})) {
    const t = Number(rep?.total);
    if (!(t > 0)) continue;
    const top = {};
    for (const k of ["10", "9.5", "9"]) if (Number(rep.grades?.[k]) > 0) top[k] = Number(rep.grades[k]);
    graders[g] = { total: t, gems: Number(rep.gems) || 0, top };
    if (Number(rep.pristine) > 0) graders[g].pristine = Number(rep.pristine);
    if (Number(rep.black_label) > 0) graders[g].blackLabel = Number(rep.black_label);
  }
  return {
    variant: String(pick.variant || ""),
    variants: vars.length,
    total,
    gems: Number(pick.total_gems) || 0,
    gemRate: Number.isFinite(Number(pick.gem_rate)) ? Number(pick.gem_rate) : null,
    graders,
    asOf: String(pick.updated_at || "").slice(0, 10) || null,
    changed: pick.last_population_change || null,
  };
}

export function eurPrice(detail, { kind = "single", variant = "" } = {}) {
  const rows = (detail?.prices || []).filter((p) => p?.source === "cardmarket" && p?.currency === "EUR" && Number(p.market_price) > 0);
  if (!rows.length) return null;
  let row = rows[0];
  if (kind !== "sealed") {
    row = rows.find((p) => p.condition === "Near Mint" && (!variant || p.variant === variant)) || rows.find((p) => p.condition === "Near Mint");
    if (!row) return null;
  }
  return { market: r2(Number(row.market_price)), asOf: String(row.created_at || "").slice(0, 10) };
}

// Allowed keys in a published market-depth item. The guard test checks this list.
export const PUBLIC_ITEM_KEYS = new Set(["sold", "graded", "daily", "pop", "eur"]);
export const PUBLIC_SOLD_KEYS = new Set(["n", "read", "median", "p25", "p75", "first", "last", "dropped", "days", "currency", "truncated"]);
export const PUBLIC_GRADED_KEYS = new Set(["label", "n", "median", "last"]);
export const PUBLIC_POP_KEYS = new Set(["variant", "variants", "total", "gems", "gemRate", "graders", "asOf", "changed"]);
export const PUBLIC_EUR_KEYS = new Set(["market", "asOf"]);

export function deriveItem(raw, { asOf, kind, name, market }) {
  const out = {};
  if (raw.comps) {
    const opts = { asOf, kind, name, market, truncated: !!raw.comps.more };
    const sold = soldStats(raw.comps.rows, opts);
    if (sold) out.sold = sold;
    if (kind !== "sealed") {
      const graded = gradedStats(raw.comps.gradedRows || [], { asOf, kind, name });
      if (graded.length) out.graded = graded;
    }
  }
  if (raw.volume) {
    const d = dailySold(raw.volume.rows, { asOf });
    if (d) out.daily = d;
  }
  if (raw.pop) {
    const p = popSummary(raw.pop.body);
    if (p) out.pop = p;
  }
  if (raw.detail) {
    const e = eurPrice(raw.detail.body, { kind });
    // A Cardmarket number under half or over double our TCGplayer market (no FX
    // applied; EUR and USD are within ~20%) is more likely a different item or a
    // thin market than a price. Hide it.
    if (e && (!(Number(market) > 0) || (e.market >= market * 0.5 && e.market <= market * 2))) out.eur = e;
  }
  return Object.keys(out).length ? out : null;
}
