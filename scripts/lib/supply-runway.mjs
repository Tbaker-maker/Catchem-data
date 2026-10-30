// Weekly listings counted and a runway in weeks.
// Cutoff numbers are not in this file. The caller passes a limits object.

export const LIMIT_KEYS = ["minWeeks", "minListings", "lookbackWeeks", "flatAbsPerWeek"];

const BANNED = /(\bsold\b|\bsales?\b|\bbuy\b|\bsell\b|\bshould\b|\binvest\w*|\brecommend\w*|\bcollectr\b|\u2013|\u2014)/i;

export function banned(text) {
  return BANNED.test(String(text || ""));
}

export function limitsOk(cfg) {
  if (!cfg || typeof cfg !== "object") return false;
  for (const k of LIMIT_KEYS) {
    if (typeof cfg[k] !== "number" || !Number.isFinite(cfg[k])) return false;
  }
  if (cfg.minWeeks < 2 || cfg.lookbackWeeks < 2 || cfg.minListings < 0 || cfg.flatAbsPerWeek < 0) return false;
  return true;
}

export function assertLimits(cfg) {
  if (!limitsOk(cfg)) {
    const err = new Error("runway limits not loaded");
    err.code = "LIMITS_MISSING";
    throw err;
  }
  return cfg;
}

export function isoWeek(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1 = new Date(jan4);
  week1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const week = Math.floor((date - week1) / 86400000 / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weeklySeries(points) {
  const byWeek = new Map();
  for (const p of points || []) {
    if (!p || !p.date || p.listingsCounted == null || !Number.isFinite(Number(p.listingsCounted))) continue;
    const week = isoWeek(p.date);
    if (!week) continue;
    const prev = byWeek.get(week);
    const row = { week, date: p.date, n: Number(p.listingsCounted), origin: p.origin || "history" };
    if (!prev || p.date > prev.date) byWeek.set(week, row);
  }
  return [...byWeek.values()].sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0));
}

export function runwayWeeks(weeks, limits) {
  assertLimits(limits);
  const pts = (weeks || []).filter((w) => w && w.n != null && Number.isFinite(w.n));
  if (pts.length < limits.minWeeks) return { n: null, missing: "not enough weeks on file" };
  const current = pts[pts.length - 1];
  if (current.n < limits.minListings) return { n: null, missing: "listings counted are under the private floor" };
  const look = pts.slice(-limits.lookbackWeeks);
  const deltas = [];
  for (let i = 1; i < look.length; i++) deltas.push(look[i].n - look[i - 1].n);
  if (!deltas.length) return { n: null, missing: "not enough weeks on file" };
  const pace = deltas.reduce((s, x) => s + x, 0) / deltas.length;
  if (!(pace < -limits.flatAbsPerWeek)) return { n: null, missing: "listings counted are not falling" };
  return { n: Math.round((current.n / Math.abs(pace)) * 100) / 100, missing: null };
}

export function receiptFor(week) {
  if (week.origin === "sealed-file") {
    return {
      source: "eBay asks",
      date: week.date,
      method: "count of asks kept on the sealed price file",
      listingsCounted: week.n,
      filled: false,
    };
  }
  return {
    source: "listings counted",
    date: week.date,
    method: "last listings counted in that week",
    listingsCounted: week.n,
    filled: false,
  };
}

export function productRow(product, points, limits) {
  const plainWeeks = weeklySeries(points);
  const weeks = plainWeeks.map((w) => ({
    week: w.week,
    date: w.date,
    listingsCounted: { n: w.n, receipt: receiptFor(w) },
  }));
  const plain = plainWeeks.map((w) => ({ week: w.week, date: w.date, n: w.n, origin: w.origin }));
  const run = runwayWeeks(plain, limits);
  const last = plain.length ? plain[plain.length - 1] : null;
  return {
    id: product.id,
    name: product.name,
    set: product.set,
    subtype: product.subtype,
    weeks,
    current: last ? { n: last.n, date: last.date, receipt: receiptFor(last) } : { n: null, date: null, receipt: { source: null, date: null, method: null, listingsCounted: null, filled: false } },
    runwayWeeks: { n: run.n, missing: run.missing, receipt: {
      source: run.n == null ? null : "listings counted",
      date: last ? last.date : null,
      method: run.n == null ? null : "current listings counted divided by the average weekly drop",
      listingsCounted: last ? last.n : null,
      filled: false,
    } },
  };
}
