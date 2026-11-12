// Weekly change file. Biggest movers, new patterns, listings counted changes.
// Empty sections stay empty. No filler numbers.

export const WEEKLY_SOURCE = "TCGplayer market via TCGCSV";
export const WEEKLY_WINDOW_DAYS = 7;
export const WEEKLY_STALE_DAYS = 2;
export const WEEKLY_START_SLACK = 3;

function isoDay(value) {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function dayNum(value) {
  const s = isoDay(value);
  return s ? Date.parse(`${s}T00:00:00Z`) / 86400000 : NaN;
}

function addDays(value, days) {
  const n = dayNum(value);
  if (!Number.isFinite(n)) return "";
  return new Date((n + days) * 86400000).toISOString().slice(0, 10);
}

function points(hist) {
  return (Array.isArray(hist) ? hist : [])
    .map((p) => (Array.isArray(p) ? { date: isoDay(p[0]), price: Number(p[1]) } : null))
    .filter((p) => p && p.date && p.price > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function windowMove(hist, { asOf, days = WEEKLY_WINDOW_DAYS, staleDays = WEEKLY_STALE_DAYS, startSlack = WEEKLY_START_SLACK, floor = 0 } = {}) {
  const series = points(hist);
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const endDay = isoDay(asOf) || last.date;
  const end = [...series].reverse().find((p) => dayNum(p.date) <= dayNum(endDay) && dayNum(endDay) - dayNum(p.date) <= staleDays);
  if (!end) return null;
  const target = addDays(endDay, -days);
  if (!target) return null;
  const start = [...series].reverse().find((p) => {
    const d = dayNum(p.date);
    return d <= dayNum(target) && dayNum(target) - d <= startSlack;
  });
  if (!start || start.date >= end.date) return null;
  if (!(start.price >= floor) || !(end.price >= floor)) return null;
  const pct = Math.round(((end.price - start.price) / start.price) * 1000) / 10;
  if (!pct) {
    const spike = spikeFlag(series, start, end);
    if (!spike) return null;
    return { from: start.date, to: end.date, p0: start.price, p1: end.price, pct: 0, flag: spike };
  }
  return { from: start.date, to: end.date, p0: start.price, p1: end.price, pct, flag: spikeFlag(series, start, end) };
}

export function spikeFlag(hist, start, end) {
  const series = Array.isArray(hist) && hist[0] && hist[0].date ? hist : points(hist);
  const mid = series.filter((p) => p.date > start.date && p.date < end.date);
  if (!mid.length) return "";
  const high = mid.reduce((a, b) => (b.price > a.price ? b : a), mid[0]);
  const low = mid.reduce((a, b) => (b.price < a.price ? b : a), mid[0]);
  const top = Math.max(start.price, end.price);
  const bottom = Math.min(start.price, end.price);
  if (high.price >= top * 1.5) return "thin-spike";
  if (bottom > 0 && low.price <= bottom * 0.5) return "thin-spike";
  return "";
}

function moverRow(card, move) {
  const kind = String(card.kind || "").toLowerCase() === "sealed" ? "sealed" : "single";
  const row = {
    id: String(card.id || ""),
    name: String(card.name || ""),
    number: String(card.num || card.number || ""),
    set: String(card.set || ""),
    setSlug: String(card.setSlug || ""),
    kind,
    from: move.from,
    to: move.to,
    p0: move.p0,
    p1: move.p1,
    pct: move.pct,
    source: WEEKLY_SOURCE,
  };
  const printing = String(card.printing || "").trim();
  if (printing) row.printing = printing;
  const era = String(card.era || "").trim();
  if (era) row.era = era;
  if (move.flag) row.flag = move.flag;
  return row;
}

function byAbsPct(rows) {
  return rows.slice().sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || (a.id < b.id ? -1 : 1));
}

export function biggestMovers(cards, { limit = 15, floor = 5, asOf, days = WEEKLY_WINDOW_DAYS, staleDays = WEEKLY_STALE_DAYS } = {}) {
  const out = [];
  for (const card of cards || []) {
    const move = windowMove(card.hist, { asOf, days, staleDays, floor });
    if (!move || !card.id || !move.pct) continue;
    out.push(moverRow(card, move));
  }
  return byAbsPct(out).slice(0, limit);
}

export function splitMovers(rows, { singlesLimit = 8, sealedLimit = 5 } = {}) {
  const singles = (rows || []).filter((row) => row.kind !== "sealed");
  const sealed = (rows || []).filter((row) => row.kind === "sealed");
  const up = (list) => list.filter((row) => row.pct > 0);
  const down = (list) => list.filter((row) => row.pct < 0);
  return {
    risers: byAbsPct(up(singles)).slice(0, singlesLimit),
    fallers: byAbsPct(down(singles)).slice(0, singlesLimit),
    sealedRisers: byAbsPct(up(sealed)).slice(0, sealedLimit),
    sealedFallers: byAbsPct(down(sealed)).slice(0, sealedLimit),
  };
}

export function patternLine(row) {
  if (typeof row === "string") return row;
  if (!row || typeof row !== "object") return "";
  if (row.line) return String(row.line);
  const name = String(row.pattern || row.name || "").trim().toLowerCase();
  const stage = String(row.stage || "").trim().toLowerCase();
  const kind = String(row.kind || row.scope || "").trim().toLowerCase();
  const dir = String(row.dir || "").trim().toLowerCase();
  const horizon = `${String(row.horizon || row.days || "").toString().replace(/d$/i, "")}d`;
  if (!name || !stage) return "";
  const bits = [name, stage, kind, dir, horizon];
  if (row.n != null) bits.push(`n=${row.n}`);
  if (row.rate != null) bits.push(`rate=${row.rate}`);
  if (row.base != null) bits.push(`base=${row.base}`);
  return bits.join("|");
}

export function newPatterns(summary) {
  if (Array.isArray(summary?.passed)) {
    return summary.passed.map((row) => {
      const line = patternLine(row);
      return {
        pattern: row.pattern,
        stage: row.stage,
        kind: row.kind,
        dir: row.dir,
        horizon: row.horizon,
        n: row.n,
        rate: row.rate,
        ...(row.base != null ? { base: row.base } : {}),
        ...(line ? { line } : {}),
      };
    });
  }
  const rows = summary?.passedKeys || summary?.forward || [];
  return Array.isArray(rows) ? rows : [];
}

export function listingChanges(latestRows, olderRows, { minDays = 1 } = {}) {
  const prev = new Map();
  for (const row of olderRows || []) if (row?.id) prev.set(row.id, row);
  const out = [];
  for (const row of Object.values(latestRows || {})) {
    const n = row.listingsCounted;
    const before = prev.get(row.id);
    if (!(n > 0) || !before || !(before.listingsCounted > 0)) continue;
    if (!row.date || !before.date || before.date >= row.date) continue;
    const days = Math.round((Date.parse(row.date) - Date.parse(before.date)) / 86400000);
    if (days < minDays) continue;
    const pct = Math.round(((n - before.listingsCounted) / before.listingsCounted) * 1000) / 10;
    if (!pct) continue;
    const kind = String(row.kind || before.kind || "").toLowerCase() === "sealed" ? "sealed" : "single";
    out.push({
      id: row.id,
      name: row.name || before.name || "",
      kind,
      from: before.date,
      to: row.date,
      fromN: before.listingsCounted,
      toN: n,
      prevDate: before.date,
      date: row.date,
      prev: before.listingsCounted,
      n,
      days,
      pct,
    });
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || (a.id < b.id ? -1 : 1)).slice(0, 20);
}

export function screenerRows(cards, { asOf, listings = [], limit = 400, floor = 5 } = {}) {
  const listingMap = new Map((listings || []).map((row) => [row.id, row]));
  const out = [];
  for (const card of cards || []) {
    const d7 = windowMove(card.hist, { asOf, days: 7, floor });
    const d30 = windowMove(card.hist, { asOf, days: 30, floor: 0 });
    const d90 = windowMove(card.hist, { asOf, days: 90, floor: 0 });
    const listed = listingMap.get(card.id);
    if (!d7 && !d30 && !d90 && !listed) continue;
    const keep = [d7, d30, d90].some((m) => m && Math.abs(m.pct) >= 5) || listed;
    if (!keep) continue;
    const base = d7 || d30 || d90;
    const row = moverRow(card, base || { from: listed?.from, to: listed?.to, p0: 0, p1: Number(card.price || card.market || 0) || 0, pct: listed?.pct || 0 });
    if (!base) {
      delete row.p0;
      if (!(row.p1 > 0)) delete row.p1;
    }
    row.windows = {};
    if (d7) row.windows["7d"] = d7;
    if (d30) row.windows["30d"] = d30;
    if (d90) row.windows["90d"] = d90;
    if (listed) {
      row.fromN = listed.fromN;
      row.toN = listed.toN;
      row.prev = listed.prev;
      row.n = listed.n;
      row.prevDate = listed.prevDate;
      row.date = listed.date;
      row.listingsPct = listed.pct;
    }
    const maxAbs = Math.max(Math.abs(d7?.pct || 0), Math.abs(d30?.pct || 0), Math.abs(d90?.pct || 0), Math.abs(listed?.pct || 0));
    out.push({ row, maxAbs });
  }
  return out.sort((a, b) => b.maxAbs - a.maxAbs || (a.row.id < b.row.id ? -1 : 1)).slice(0, limit).map((x) => x.row);
}

export function weeklyDoc({ asOf, movers, risers, fallers, sealedRisers, sealedFallers, patterns, listings, listingDays, screener, windowFrom, includesSealed, source = WEEKLY_SOURCE, windowDays = WEEKLY_WINDOW_DAYS } = {}) {
  const start = isoDay(windowFrom) || (isoDay(asOf) ? addDays(asOf, -windowDays) : "");
  return {
    asOf,
    windowFrom: start || undefined,
    windowDays,
    source,
    label: "Weekly changes",
    includesSealed: includesSealed === true,
    movers: movers || [],
    risers: risers || [],
    fallers: fallers || [],
    sealedRisers: sealedRisers || [],
    sealedFallers: sealedFallers || [],
    patterns: patterns || [],
    screener: screener || [],
    listingsCounted: {
      daysOnFile: listingDays || 0,
      changes: listings || [],
      note: (listingDays || 0) < 2 ? "Listings counted changes need two dated files. Until then this list stays empty." : "Change in listings counted between two dated files. A listing is not a sale.",
    },
  };
}
