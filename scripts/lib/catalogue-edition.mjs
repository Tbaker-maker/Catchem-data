// Freshness of the sealed catalogue as a whole, used by publish-assert
// (blocking) and Generate Morning Pulse (which runs after public-data
// publish and must not abort later steps when eBay missed a cycle).
//
// Same calibration as the original publish-assert check: one full missed
// cycle (ageDays >= 2, rounded from the newest lastSeen day) is stale;
// fewer than 80% of live products on the newest day is partial. Fewer
// than 20 live priced rows is skipped (not enough to judge).
export function catalogueEditionFreshness(sp, now = Date.now()) {
  const live = (sp?.products || []).filter((p) => p.dataStatus === "live" && p.priceMedian && p.lastSeen);
  if (live.length < 20) return { status: "skip", live: live.length };
  const stamps = live.map((p) => String(p.lastSeen).slice(0, 10)).sort();
  const newest = stamps[stamps.length - 1];
  const ageDays = Math.round((now - Date.parse(newest)) / 86400000);
  const atNewest = stamps.filter((d) => d === newest).length;
  const pct = Math.round(atNewest / live.length * 100);
  const out = { newest, ageDays, pct, live: live.length, atNewest };
  if (ageDays >= 2) return { status: "stale", ...out };
  if (pct < 80) return { status: "partial", ...out };
  return { status: "ok", ...out };
}
