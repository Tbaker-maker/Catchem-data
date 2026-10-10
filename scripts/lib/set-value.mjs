// Sum of TCGplayer market for singles priced on both exact days.
// The read stays off until set.valueReads is true.

const COPY_BAN = /\b(resistance|support|breakout|bottom|cheap|crash|buys?|sells?|selling|holds?|holding|printed)\b/i;

export function dayBefore(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
}

export function sumBoth(ids, startPrices, endPrices) {
  let start = 0;
  let end = 0;
  let count = 0;
  for (const id of ids) {
    const a = startPrices.get(id);
    const b = endPrices.get(id);
    if (!(a > 0) || !(b > 0)) continue;
    start += a;
    end += b;
    count += 1;
  }
  return {
    count,
    start: Math.round(start * 100) / 100,
    end: Math.round(end * 100) / 100,
  };
}

export function setMove(sum, minPct = 8) {
  if (!sum || !(sum.count > 0) || !(sum.start > 0)) return null;
  const pct = Math.round(((sum.end - sum.start) / sum.start) * 1000) / 10;
  if (!Number.isFinite(pct) || Math.abs(pct) < minPct) return null;
  return pct;
}

export function setSentence(name, pct, count, start, end) {
  const dir = pct < 0 ? "down" : "up";
  const line = `${name} singles priced on both days are ${dir} ${Math.abs(pct)}% in 30 days (${count} cards, $${start.toFixed(2)} → $${end.toFixed(2)}).`;
  if (COPY_BAN.test(line)) throw new Error("set sentence used a banned word");
  return line;
}

export function buildSetValue(sets, priceDays, { enabled = false, endDate, minPct = 8 } = {}) {
  const days = Object.keys(priceDays || {}).sort();
  const latest = endDate || days[days.length - 1] || "";
  const startDate = latest ? dayBefore(latest, 30) : "";
  const startOnFile = days.includes(startDate);
  const reads = [];
  if (startOnFile && latest && priceDays[latest]) {
    const endMap = priceDays[latest];
    const startMap = priceDays[startDate];
    for (const set of sets || []) {
      const sum = sumBoth(set.ids || [], startMap, endMap);
      const pct = setMove(sum, minPct);
      if (pct == null) continue;
      reads.push({
        slug: set.slug,
        name: set.name,
        days: 30,
        fromDate: startDate,
        toDate: latest,
        count: sum.count,
        from: sum.start,
        to: sum.end,
        pct,
        sentence: setSentence(set.name, pct, sum.count, sum.start, sum.end),
      });
    }
  }
  reads.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.name.localeCompare(b.name));
  return {
    enabled: enabled === true,
    flag: "set.valueReads",
    asOf: latest,
    windowDays: 30,
    minPct,
    exactStart: startDate,
    exactStartOnFile: startOnFile,
    sets: (sets || []).length,
    wouldQualify: reads.length,
    rule: "The sum uses only singles with a TCGplayer market price on both exact days. A missing day drops the set. The card count is the number of those singles.",
    reads: enabled === true ? reads : [],
  };
}
