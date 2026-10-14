// Weekly change file. Biggest movers, new patterns, listings counted changes.
// Empty sections stay empty. No filler numbers.

function medianAbs(rows) {
  return rows.slice().sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || (a.id < b.id ? -1 : 1));
}

export function biggestMovers(cards, { limit = 15, floor = 5 } = {}) {
  const out = [];
  for (const card of cards || []) {
    const hist = Array.isArray(card.hist) ? card.hist.filter((p) => Array.isArray(p) && p[0] && p[1] > 0) : [];
    if (hist.length < 2) continue;
    const a = hist[hist.length - 2];
    const b = hist[hist.length - 1];
    if (!(a[1] >= floor) || !(b[1] >= floor)) continue;
    if (!(a[1] > 0)) continue;
    const pct = Math.round(((b[1] - a[1]) / a[1]) * 1000) / 10;
    if (!pct) continue;
    out.push({
      id: String(card.id || ""),
      name: String(card.name || ""),
      number: String(card.num || card.number || ""),
      set: String(card.set || ""),
      from: a[0],
      to: b[0],
      p0: a[1],
      p1: b[1],
      pct,
    });
  }
  return medianAbs(out).slice(0, limit);
}

export function newPatterns(summary) {
  const rows = summary?.passedKeys || summary?.forward || [];
  if (Array.isArray(summary?.passed)) {
    return summary.passed.map((row) => ({
      pattern: row.pattern, stage: row.stage, kind: row.kind, dir: row.dir, horizon: row.horizon, n: row.n, rate: row.rate,
    }));
  }
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
    out.push({
      id: row.id,
      name: row.name || before.name || "",
      from: before.date,
      to: row.date,
      fromN: before.listingsCounted,
      toN: n,
      days,
      pct,
    });
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || (a.id < b.id ? -1 : 1)).slice(0, 20);
}

export function weeklyDoc({ asOf, movers, patterns, listings, listingDays }) {
  return {
    asOf,
    label: "Weekly changes",
    movers: movers || [],
    patterns: patterns || [],
    listingsCounted: {
      daysOnFile: listingDays || 0,
      changes: listings || [],
      note: (listingDays || 0) < 2 ? "Listings counted changes need two dated files. Until then this list stays empty." : "Change in listings counted between two dated files. A listing is not a sale.",
    },
  };
}
