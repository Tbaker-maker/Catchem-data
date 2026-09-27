// Two lines for one set. Sealed uses sealed history only. Chase uses singles
// only. A short tape is "building history", not a made-up level.
const CHASE = /special illustration|illustration rare|hyper rare|rainbow|secret|alt art|rare ultra|mega hyper/i;

export function isChaseRarity(rarity) {
  return CHASE.test(String(rarity || ""));
}

function levelOf(points) {
  const clean = (points || []).filter((p) => p && p.date && typeof p.price === "number" && p.price > 0);
  const byDate = new Map();
  for (const p of clean) byDate.set(p.date, p.price);
  const dates = [...byDate.keys()].sort();
  if (dates.length < 2) return { level: null, days: dates.length, status: "building history" };
  const first = byDate.get(dates[0]);
  const last = byDate.get(dates[dates.length - 1]);
  return { level: Math.round((last / first) * 1000) / 10, days: dates.length, status: dates.length < 3 ? "building history" : "live" };
}

export function setLines({ sealed = [], singles = [], sealedHistory = [], asOf }) {
  const hist = new Map();
  for (const row of sealedHistory) {
    if (!row?.id || !row.date || typeof row.price !== "number") continue;
    if (!hist.has(row.id)) hist.set(row.id, []);
    hist.get(row.id).push({ date: row.date, price: row.price });
  }
  const bySet = new Map();
  for (const p of sealed) {
    if (!p?.setId) continue;
    if (!bySet.has(p.setId)) bySet.set(p.setId, { setId: p.setId, set: p.set || p.setId, sealedProducts: [], chases: [] });
    bySet.get(p.setId).sealedProducts.push(p);
  }
  for (const c of singles) {
    if (!c?.setId || !isChaseRarity(c.rarity)) continue;
    if (!bySet.has(c.setId)) bySet.set(c.setId, { setId: c.setId, set: c.setName || c.setId, sealedProducts: [], chases: [] });
    bySet.get(c.setId).chases.push(c);
  }
  const sets = [];
  for (const group of bySet.values()) {
    const series = group.sealedProducts.map((p) => levelOf(hist.get(p.id) || []));
    const live = series.filter((s) => s.level != null);
    const sealedLevel = live.length
      ? Math.round((live.reduce((a, s) => a + s.level, 0) / live.length) * 10) / 10
      : null;
    const sealedDays = series.reduce((a, s) => Math.max(a, s.days), 0);
    const chaseRanked = [...group.chases].sort((a, b) => (b.priceMarket || 0) - (a.priceMarket || 0) || String(a.name).localeCompare(String(b.name)));
    const chaseLevels = chaseRanked.map((c) => levelOf(c.priceHistory || []));
    const chaseLive = chaseLevels.filter((s) => s.level != null);
    const chaseLevel = chaseLive.length
      ? Math.round((chaseLive.reduce((a, s) => a + s.level, 0) / chaseLive.length) * 10) / 10
      : null;
    sets.push({
      setId: group.setId,
      set: group.set,
      sealed: {
        products: group.sealedProducts.length,
        level: sealedDays >= 3 && sealedLevel != null ? sealedLevel : null,
        days: sealedDays,
        status: sealedDays >= 3 && sealedLevel != null ? "live" : "building history",
      },
      chase: {
        cards: chaseRanked.length,
        names: chaseRanked.slice(0, 3).map((c) => c.name),
        level: chaseLevel != null && chaseLive.some((s) => s.days >= 2) ? chaseLevel : null,
        status: chaseRanked.length && chaseLevel != null ? "live" : "building history",
      },
    });
  }
  sets.sort((a, b) => a.set.localeCompare(b.set));
  return {
    asOf: asOf || null,
    method: "Sealed line: equal-weight move of that set's sealed products versus each product's own first observed ask. Chase line: illustration, special illustration, secret, rainbow, rare ultra, and hyper-rare singles in that set only. The two lines are never averaged together.",
    sets,
  };
}
