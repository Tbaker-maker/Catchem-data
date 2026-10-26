// Price since release for sealed products, and the era median path.
// No cutoff numbers live here. A missing price or retail is null, never 0.

export const FILLED_BEFORE = "2026-09-25";

const BANNED = /(\bsold\b|\bsales?\b|\bbuy\b|\bsell\b|\bshould\b|\binvest\w*|\brecommend\w*|\bcollectr\b|\bpokeviz\b|–|—)/i;

export function banned(text) {
  return BANNED.test(String(text || ""));
}

export function emptyReceipt() {
  return { source: null, date: null, method: null, listingsCounted: null, filled: false };
}

export function receipt({ source, date, method, listingsCounted, filled }) {
  let n = null;
  if (listingsCounted != null && listingsCounted !== "" && Number.isFinite(Number(listingsCounted))) {
    n = Number(listingsCounted);
  }
  return {
    source: source || null,
    date: date || null,
    method: method || null,
    listingsCounted: n,
    filled: filled === true,
  };
}

export function numberField(n, rec) {
  const value = n == null || !Number.isFinite(Number(n)) ? null : Number(n);
  return { n: value, receipt: rec || emptyReceipt() };
}

export function round4(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 10000) / 10000;
}

export function publicSource(source) {
  if (source === "archived-market") return "Archived TCGplayer market prices";
  if (source === "tcgcsv-daily") return "TCGplayer market";
  return null;
}

export function isFilled(date, source) {
  if (source === "archived-market") return true;
  return typeof date === "string" && date < FILLED_BEFORE;
}

export function dayGap(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function weekIndex(release, date) {
  const gap = dayGap(release, date);
  if (gap == null) return null;
  return Math.floor(gap / 7);
}

export function median(nums) {
  const v = (nums || []).filter((n) => n != null && Number.isFinite(Number(n))).map(Number).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// Our print wins on a shared day. Archive days on or after our first day are left out.
export function joinSeries(own, archiveRows) {
  const mine = (own || [])
    .filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(p.date || "") && p.price > 0)
    .map((p) => ({ date: p.date, price: Number(p.price), source: "tcgcsv-daily" }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map();
  for (const p of mine) byDate.set(p.date, p);
  const first = mine[0]?.date || null;
  for (const row of archiveRows || []) {
    const date = Array.isArray(row) ? row[0] : row && row.date;
    const price = Array.isArray(row) ? Number(row[1]) : Number(row && row.price);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !(price > 0)) continue;
    if (byDate.has(date)) continue;
    if (first && date >= first) continue;
    byDate.set(date, { date, price, source: "archived-market" });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function weeklyPoints(release, points) {
  if (!release) return [];
  const byWeek = new Map();
  for (const p of points || []) {
    const week = weekIndex(release, p.date);
    if (week == null) continue;
    const prev = byWeek.get(week);
    if (!prev || p.date > prev.date) byWeek.set(week, { ...p, week, early: week < 0 });
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week);
}

export function vsRetail(price, retail) {
  if (!(retail > 0) || !(price > 0)) return null;
  return round4(price / retail);
}

export function pointField(point, retail) {
  if (!point) return { price: numberField(null, emptyReceipt()), vsRetail: numberField(null, emptyReceipt()) };
  const src = publicSource(point.source);
  const filled = isFilled(point.date, point.source);
  const ratio = vsRetail(point.price, retail);
  return {
    price: numberField(point.price, receipt({
      source: src,
      date: point.date,
      method: "last market print in that week since release",
      listingsCounted: null,
      filled,
    })),
    vsRetail: numberField(ratio, ratio == null ? emptyReceipt() : receipt({
      source: src,
      date: point.date,
      method: "price divided by the sourced retail for this id",
      listingsCounted: null,
      filled,
    })),
  };
}

export function eraPaths(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.era || !row.subtype) continue;
    for (const pt of row.points || []) {
      if (pt.price?.n == null) continue;
      const key = `${row.era}\0${row.subtype}`;
      const bag = groups.get(key) || new Map();
      const list = bag.get(pt.week) || [];
      list.push({ price: pt.price.n, vs: pt.vsRetail?.n ?? null, date: pt.date, filled: pt.price.receipt.filled === true, early: pt.early === true });
      bag.set(pt.week, list);
      groups.set(key, bag);
    }
  }
  const out = [];
  for (const [key, weeks] of groups) {
    const [era, subtype] = key.split("\0");
    const weekRows = [];
    for (const [week, list] of [...weeks.entries()].sort((a, b) => a[0] - b[0])) {
      const prices = list.map((x) => x.price);
      const ratios = list.map((x) => x.vs).filter((x) => x != null);
      const date = list.reduce((d, x) => (x.date > d ? x.date : d), list[0].date);
      const filled = list.every((x) => x.filled);
      const med = round4(median(prices));
      const medVs = ratios.length ? round4(median(ratios)) : null;
      weekRows.push({
        week,
        early: week < 0,
        count: numberField(list.length, receipt({
          source: "TCGplayer market",
          date,
          method: "products with a price in that week since release",
          listingsCounted: null,
          filled,
        })),
        median: numberField(med, receipt({
          source: "TCGplayer market",
          date,
          method: "median of one price per product in that week since release",
          listingsCounted: null,
          filled,
        })),
        vsRetail: numberField(medVs, medVs == null ? emptyReceipt() : receipt({
          source: "TCGplayer market",
          date,
          method: "median of price divided by sourced retail in that week",
          listingsCounted: null,
          filled,
        })),
      });
    }
    out.push({ era, subtype, weeks: weekRows });
  }
  out.sort((a, b) => a.era.localeCompare(b.era) || a.subtype.localeCompare(b.subtype));
  return out;
}

export function productRow(product, points, retail) {
  const weeks = weeklyPoints(product.release, points);
  const publicPoints = weeks.map((pt) => {
    const fields = pointField(pt, retail);
    return { week: pt.week, early: pt.early, date: pt.date, ...fields };
  });
  const last = weeks.length ? weeks[weeks.length - 1] : null;
  const latestFields = pointField(last, retail);
  if (last) {
    latestFields.price.receipt.method = "latest market print on file";
    if (latestFields.vsRetail.n != null) latestFields.vsRetail.receipt.method = "latest price divided by the sourced retail for this id";
  }
  return {
    id: product.id,
    name: product.name,
    set: product.set || null,
    setId: product.setId || null,
    subtype: product.subtype || null,
    era: product.era || null,
    release: product.release || null,
    retail: numberField(retail, retail == null ? emptyReceipt() : receipt({
      source: "sourced retail",
      date: product.retailDate || null,
      method: "amount stated for this exact id",
      listingsCounted: null,
      filled: false,
    })),
    latest: latestFields.price,
    vsRetail: latestFields.vsRetail,
    points: publicPoints,
  };
}
