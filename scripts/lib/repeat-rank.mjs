// How often a name is on our own board. A day counts when the name is among
// the largest ask moves versus the previous observed day. No prices leave
// this function — only counts.
export function boardAppearances(history, boardSize = 8) {
  const byDate = new Map();
  for (const row of history || []) {
    if (!row?.date || !row?.id || typeof row.price !== "number" || !(row.price > 0)) continue;
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  }
  const dates = [...byDate.keys()].sort();
  const days = [];
  let prev = new Map();
  for (const date of dates) {
    const next = new Map();
    const moves = [];
    for (const row of byDate.get(date)) {
      next.set(row.id, row.price);
      const before = prev.get(row.id);
      if (before) {
        const pct = (row.price - before) / before;
        if (Number.isFinite(pct) && pct !== 0) moves.push({ id: row.id, abs: Math.abs(pct) });
      }
    }
    moves.sort((a, b) => b.abs - a.abs || (a.id < b.id ? -1 : 1));
    days.push({ date, ids: moves.slice(0, boardSize).map((m) => m.id) });
    prev = next;
  }
  return days;
}

function inWindow(date, asOf, days) {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = end - days * 86400000;
  const t = Date.parse(`${date}T00:00:00Z`);
  return t >= start && t <= end;
}

export function rankFromAppearances(days, names, asOf, windows = [7, 30, 90]) {
  const observed = days.filter((d) => inWindow(d.date, asOf, Math.max(...windows)));
  const ids = new Set();
  for (const day of observed) for (const id of day.ids) ids.add(id);
  const rows = [];
  for (const id of ids) {
    const seen = observed.filter((d) => d.ids.includes(id)).map((d) => d.date);
    const row = { id, name: names.get(id) || id, lastSeen: seen[seen.length - 1] || null };
    for (const w of windows) row[`days${w}`] = seen.filter((d) => inWindow(d, asOf, w)).length;
    let streak = 0;
    for (let i = observed.length - 1; i >= 0; i--) {
      if (!observed[i].ids.includes(id)) break;
      streak += 1;
    }
    row.streak = streak;
    rows.push(row);
  }
  rows.sort((a, b) => b.days30 - a.days30 || b.days7 - a.days7 || (a.id < b.id ? -1 : 1));
  const thin = observed.length < 7;
  return { rows, observedDays: observed.length, status: thin ? "building history" : "live" };
}
