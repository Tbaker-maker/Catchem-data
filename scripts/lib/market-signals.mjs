// Set momentum and listings-counted dry-up. Every number comes from dated points.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function median(xs) {
  const s = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function addDays(iso, days) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

export function moveBetween(points, asOf, days) {
  const pts = (points || []).filter((p) => Array.isArray(p) && DAY.test(p[0]) && p[1] > 0 && p[0] <= asOf).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (pts.length < 2) return null;
  const end = pts[pts.length - 1];
  const want = addDays(asOf, -days);
  let start = null;
  for (const p of pts) if (p[0] <= want) start = p;
  if (!start || start[0] === end[0]) return null;
  return {
    from: start[0],
    to: end[0],
    p0: start[1],
    p1: end[1],
    pct: Math.round(((end[1] - start[1]) / start[1]) * 1000) / 10,
  };
}

export function setMomentum(cards, { asOf, days = 30, minCards = 8 } = {}) {
  const moves = [];
  for (const card of cards || []) {
    const m = moveBetween(card.hist, asOf, days);
    if (!m || !(card.price >= 5)) continue;
    moves.push({ set: card.set || "", id: card.id, name: card.name, number: card.number || card.num || "", ...m });
  }
  const market = median(moves.map((m) => m.pct));
  if (market == null) return [];
  const bySet = new Map();
  for (const row of moves) {
    if (!row.set) continue;
    if (!bySet.has(row.set)) bySet.set(row.set, []);
    bySet.get(row.set).push(row);
  }
  const out = [];
  for (const [set, rows] of bySet) {
    if (rows.length < minCards) continue;
    const med = median(rows.map((r) => r.pct));
    const from = rows.map((r) => r.from).sort()[0];
    const to = rows.map((r) => r.to).sort().at(-1);
    const gap = Math.round((med - market) * 10) / 10;
    out.push({
      id: `set-momentum-${set.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      readKind: "set-momentum",
      name: set,
      asOf,
      from,
      to,
      n: rows.length,
      medianPct: Math.round(med * 10) / 10,
      marketMedianPct: Math.round(market * 10) / 10,
      gap,
      headline: `${set}: 30-day median card move ${Math.round(med * 10) / 10}% vs the market median ${Math.round(market * 10) / 10}% (${from} to ${to}, ${rows.length} cards).`,
    });
  }
  out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || (a.name < b.name ? -1 : 1));
  return out;
}

// series: [{ date, n }] oldest to newest. A dry-up is down 25% or more across
// a span of at least 14 days.
export function dryUp(series, { minDrop = 0.25, minDays = 14 } = {}) {
  const pts = (series || []).filter((p) => DAY.test(p?.date) && p.n > 0).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const out = [];
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const span = Math.round((Date.parse(pts[j].date) - Date.parse(pts[i].date)) / 86400000);
      if (span < minDays) continue;
      const drop = (pts[i].n - pts[j].n) / pts[i].n;
      if (drop + 1e-9 < minDrop) continue;
      out.push({
        id: pts[j].id || "",
        name: pts[j].name || "",
        from: pts[i].date,
        to: pts[j].date,
        fromN: pts[i].n,
        toN: pts[j].n,
        days: span,
        dropPct: Math.round(drop * 1000) / 10,
      });
    }
  }
  const best = new Map();
  for (const row of out) {
    const prev = best.get(row.id || row.name);
    if (!prev || row.dropPct > prev.dropPct) best.set(row.id || row.name, row);
  }
  return [...best.values()].sort((a, b) => b.dropPct - a.dropPct || (a.id < b.id ? -1 : 1)).map((row) => ({
    ...row,
    readKind: "listings-dryup",
    headline: `${row.name || row.id}: listings counted down ${row.dropPct}% in ${row.days} days (${row.fromN} on ${row.from} to ${row.toN} on ${row.to}).`,
  }));
}
