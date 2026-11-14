function calendarAgeDays(newest, now) {
  const day = String(newest || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const nowDay = new Date(now).toISOString().slice(0, 10);
  const a = Date.parse(`${day}T00:00:00Z`);
  const b = Date.parse(`${nowDay}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

// Freshness of the sealed catalogue as a whole, used by publish-assert
// (blocking) and Generate Morning Pulse (which runs after public-data
// publish and must not abort later steps when eBay missed a cycle).
//
// Age is whole calendar days between the newest lastSeen date and the UTC
// date of now. A check late on the next day is 1 day, not 2. One full missed
// cycle (ageDays >= 2) is stale. Fewer than 80% of live products on the
// newest day is partial. Fewer than 20 live priced rows is skipped.
export function catalogueEditionFreshness(sp, now = Date.now()) {
  const live = (sp?.products || []).filter((p) => p.dataStatus === "live" && p.priceMedian && p.lastSeen);
  if (live.length < 20) return { status: "skip", live: live.length };
  const stamps = live.map((p) => String(p.lastSeen).slice(0, 10)).sort();
  const newest = stamps[stamps.length - 1];
  const ageDays = calendarAgeDays(newest, now);
  const atNewest = stamps.filter((d) => d === newest).length;
  const pct = Math.round(atNewest / live.length * 100);
  const out = { newest, ageDays, pct, live: live.length, atNewest };
  if (!(ageDays >= 0)) return { status: "skip", ...out };
  if (ageDays >= 2) return { status: "stale", ...out };
  if (pct < 80) return { status: "partial", ...out };
  return { status: "ok", ...out };
}
