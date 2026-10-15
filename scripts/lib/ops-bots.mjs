// Pure checks for the freshness, self-heal, janitor, and coverage bots.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function dayOf(value) {
  const day = String(value || "").slice(0, 10);
  return DAY.test(day) ? day : "";
}

export function daysBetween(from, to) {
  if (!DAY.test(String(from || "")) || !DAY.test(String(to || ""))) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

// Alert only when the price day is more than one day behind the calendar day.
// A file from yesterday is still the last closed day. Two days behind is late.
export function priceDayStale(priceDay, today) {
  const ageDays = daysBetween(priceDay, today);
  if (ageDays == null || ageDays <= 1) return null;
  return {
    id: "price-day-stale",
    priceDay,
    today,
    ageDays,
    alert: `price day ${priceDay} is ${ageDays} days behind ${today}`,
  };
}

export function freshnessReport({ today, priceDay, countsDay, readsDay, scannerDay }) {
  const board = dayOf(today);
  const checks = [
    { id: "price-day", path: "data/history/tcgcsv-daily", date: dayOf(priceDay) },
    { id: "listings-counted", path: "data/derived/listing-counts/latest.json", date: dayOf(countsDay) },
    { id: "reads", path: "research/assets/public/reads.json", date: dayOf(readsDay) },
    { id: "scanner", path: "data/private/scanner/summary.json", date: dayOf(scannerDay) },
  ].map((row) => ({
    ...row,
    ok: Boolean(board && row.date && row.date === board),
    detail: !row.date ? "missing" : row.date === board ? "fresh" : `dated ${row.date}`,
  }));
  return {
    asOf: board,
    checks,
    failures: checks.filter((row) => !row.ok).map((row) => row.id),
  };
}

// failLog: text of the failed steps. When given, only files the failure names
// (full path or file name) are restored, so an unrelated rewrite is left alone.
export function healPlan(files, failLog = null) {
  let data = [...new Set((files || []).filter((f) => /^(data|research\/assets\/public)\//.test(String(f))))];
  if (!data.length) return { action: "none", files: [], reason: "the red commit did not rewrite a data file" };
  if (failLog != null) {
    const log = String(failLog);
    data = data.filter((f) => log.includes(f) || log.includes(f.split("/").pop()));
    if (!data.length) return { action: "none", files: [], reason: "the failing steps do not name any file this commit rewrote" };
  }
  return { action: "restore", files: data, reason: "restore the last copy of the data files this commit rewrote" };
}

export function janitorRows(prs, now = new Date()) {
  const ms = now instanceof Date ? now.getTime() : Date.parse(now);
  const out = [];
  for (const pr of prs || []) {
    const created = Date.parse(pr.createdAt || "");
    const ageDays = Number.isFinite(created) ? Math.floor((ms - created) / 86400000) : null;
    const failing = (pr.checks || []).filter((c) => c.conclusion === "failure" || c.status === "failure" || c.state === "FAILURE").map((c) => c.name).filter(Boolean);
    const old = ageDays != null && ageDays >= 3;
    if (!old && !failing.length) continue;
    out.push({
      number: pr.number,
      title: pr.title || "",
      url: pr.url || "",
      ageDays,
      old,
      failing,
    });
  }
  return out.sort((a, b) => (a.number || 0) - (b.number || 0));
}

export function flagCoverageDrops(prev, next) {
  if (!prev) return [];
  const drops = [];
  for (const key of ["priced", "yearHistory", "listingsCounted"]) {
    if (prev[key] > 0 && next[key] < prev[key]) drops.push({ key, from: prev[key], to: next[key] });
  }
  if (prev.imageGaps > 0 && next.imageGaps > prev.imageGaps) {
    drops.push({ key: "imageGaps", from: prev.imageGaps, to: next.imageGaps, note: "image gaps went up" });
  }
  return drops;
}
