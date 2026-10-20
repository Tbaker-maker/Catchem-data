// Listings-led tracker v1 (private). Pure functions; the nightly runner is scripts/run-tracker.mjs.
// Lead signal: falling listings counted with a stable or rising price. Support signal: the
// existing heat state from data/heat-report.json (sealed). Picks are logged daily and scored
// later: a hit is a move of 3% or more that also beats the median move of every scored item
// over the same window, at 7, 30 and 90 days. A rate is shown only once n >= 20.
export const HORIZONS = [7, 30, 90];
export const HIT_PCT = 3;
export const MIN_N = 20;
export const MIN_NIGHTS = 3;

const DAY = 86400000;
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const pct = (a, b) => (a > 0 && b > 0 ? ((b - a) / a) * 100 : null);

// series: [[date, value]] sorted. Change from the first value on or after `from` to the last on or before `to`.
export function changeOver(series, from, to) {
  const a = series.find((p) => p[0] >= from && p[0] <= to);
  const b = [...series].reverse().find((p) => p[0] <= to && p[0] >= from);
  if (!a || !b || a[0] === b[0]) return null;
  return pct(a[1], b[1]);
}

// listings: Map<pid, [[date, n]]>, prices: Map<pid, [[date, price]]>, heat: Map<pid, state>
export function scoreItems({ listings, prices, heat = new Map(), asOf, window = 14 }) {
  const from = addDays(asOf, -window);
  const out = [];
  for (const [pid, ls] of listings) {
    const recent = ls.filter((p) => p[0] >= from && p[0] <= asOf);
    if (recent.length < MIN_NIGHTS) continue;
    const lChg = changeOver(recent, from, asOf);
    const pChg = changeOver(prices.get(pid) || [], from, asOf);
    if (lChg == null || pChg == null) continue;
    if (!(lChg < 0) || pChg < -2) continue; // listings must fall; price stable (>= -2%) or rising
    const state = heat.get(pid) || null;
    const bonus = state === "markup" || state === "accumulation" ? 5 : state === "distribution" || state === "markdown" ? -5 : 0;
    const score = Math.round((-lChg + Math.max(0, Math.min(pChg, 20)) * 0.5 + bonus) * 10) / 10;
    out.push({ pid, score, listingsChgPct: Math.round(lChg * 10) / 10, priceChgPct: Math.round(pChg * 10) / 10, nights: recent.length, heat: state });
  }
  return out.sort((a, b) => b.score - a.score || a.pid - b.pid);
}

// Sealed ask facts. Recorded every night. They do not change scoreItems.
// feedScore stays false until the private proven flag is true.
export function scoreAskFacts(rows, { proven = false } = {}) {
  const clean = (rows || []).filter((row) => row && row.id).map((row) => ({
    id: row.id,
    asOf: row.asOf || null,
    cheapestReal: row.cheapestReal?.price ?? (Number(row.cheapestReal) > 0 ? Number(row.cheapestReal) : null),
    ebayMedianAsk: Number(row.ebayMedianAsk) > 0 ? Number(row.ebayMedianAsk) : null,
    ebayMedianCount: Number.isInteger(Number(row.ebayMedianCount)) ? Number(row.ebayMedianCount) : null,
    tcgListedMedian: Number(row.tcgListedMedian) > 0 ? Number(row.tcgListedMedian) : null,
    gapPct: Number.isFinite(Number(row.gapPct)) ? Number(row.gapPct) : null,
  }));
  return { feedScore: proven === true, rows: clean };
}

// picks: [{ date, pid }], prices: Map. Returns per-horizon { n, hits, rate|null }.
export function backtest(picks, prices, asOf) {
  const res = {};
  for (const h of HORIZONS) {
    const due = picks.filter((p) => addDays(p.date, h) <= asOf);
    let n = 0, hits = 0;
    const byDate = new Map();
    for (const p of due) { if (!byDate.has(p.date)) byDate.set(p.date, []); byDate.get(p.date).push(p); }
    for (const [date, rows] of byDate) {
      const end = addDays(date, h);
      const all = [];
      for (const s of prices.values()) { const c = changeOver(s, date, end); if (c != null) all.push(c); }
      if (!all.length) continue;
      all.sort((a, b) => a - b);
      const market = all[Math.floor(all.length / 2)];
      for (const r of rows) {
        const c = changeOver(prices.get(r.pid) || [], date, end);
        if (c == null) continue;
        n += 1;
        if (c >= HIT_PCT && c > market) hits += 1;
      }
    }
    res[`${h}d`] = { n, hits, rate: n >= MIN_N ? Math.round((hits / n) * 1000) / 10 : null, gate: `n>=${MIN_N}` };
  }
  return res;
}
