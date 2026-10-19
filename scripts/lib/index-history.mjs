// Long history for the sitewide singles and sealed index lines.
// Same method as the nightly line (scripts/lib/public-index-line.mjs): each point
// is (sum of today's prices) / (sum of the same cards' prices on the last real
// point), chain-linked, over the cards in tonight's index. A card that is not
// priced on both points is left out of that link, so a card entering later never
// makes the line jump.
// Prices per card, best source first:
//   "n" our nightly TCGplayer market days (exact days only, never carried),
//   "a" TCGplayer market via the tcgcsv daily archive (hist-long): weekly
//       snapshots until the archive turns daily, then change-only points with a
//       7-day heartbeat, so a daily-era day with no point holds the last price
//       for up to 7 days and never past the archive's last day,
//   "f" public fan-site TCGplayer market (approved chart fill), before our first own day.
// The guard values (junk and one-step limits, link floor) come from the private
// repo and are passed in. This file holds no thresholds.
const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const ms = (d) => Date.parse(`${d}T00:00:00Z`);

export function unpackLong(packed) {
  return String(packed || "").split(",").map((b) => b.split(":")).filter((b) => b.length === 2 && Number(b[1]) > 0).map(([d, v]) => [iso(Number(d) * DAY), Number(v)]);
}

// Grid of index days: archive snapshot days while the archive is weekly, then every day.
export function indexDays({ weeklyDays = [], dailyFrom, end }) {
  const out = weeklyDays.filter((d) => d < dailyFrom).sort();
  for (let t = ms(dailyFrom); t <= ms(end); t += DAY) out.push(iso(t));
  return out;
}

function median(vals) {
  const s = [...vals].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
}

// One card: Map(day -> [price, source]) on the grid.
export function cardSeries({ own = [], long = [], fan = [] }, { days, dailyFrom, archiveEnd, heartbeat = 7, guard }) {
  const ownMap = new Map(own.filter((p) => Number(p[1]) > 0).map((p) => [p[0], Number(p[1])]));
  const firstOwn = own.length ? own.map((p) => p[0]).sort()[0] : "9999-12-31";
  const longPts = long.filter((p) => p[0] < firstOwn).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const longMap = new Map(longPts);
  const fanMap = new Map(fan.filter((p) => Number(p[1]) > 0 && p[0] < firstOwn).map((p) => [p[0], Number(p[1])]));
  const ref = median([...ownMap.values(), ...longMap.values(), ...fanMap.values()]);
  // Junk is a listing-glitch high far above the card's own middle price (for example $99,999).
  const junk = (v) => guard && ref > 0 && v > ref * guard.junkX;
  const out = new Map();
  let dropped = 0;
  let li = 0;
  let lastLong = null;
  for (const day of days) {
    while (li < longPts.length && longPts[li][0] <= day) { lastLong = longPts[li]; li += 1; }
    let v = null;
    let s = "";
    if (ownMap.has(day)) { v = ownMap.get(day); s = "n"; }
    else if (day < firstOwn && longMap.has(day)) { v = longMap.get(day); s = "a"; }
    else if (day < firstOwn && day >= dailyFrom && day <= archiveEnd && lastLong && lastLong[0] >= dailyFrom && (ms(day) - ms(lastLong[0])) / DAY <= heartbeat) { v = lastLong[1]; s = "a"; }
    else if (day < firstOwn && fanMap.has(day)) { v = fanMap.get(day); s = "f"; }
    if (v == null) continue;
    if (junk(v)) { dropped += 1; continue; }
    out.set(day, [v, s]);
  }
  return { map: out, dropped };
}

// Value weights (the price on the earlier day), with one card's say capped at a
// share of the step so a thin, dear card cannot carry the line. With no cap, or
// when no card is over it, the step is exactly sum(today) / sum(last day).
export function cappedWeights(ws, cap) {
  const w = ws.map(Number);
  if (!(cap > 0 && cap < 1) || w.length * cap <= 1) return w;
  for (let k = 0; k < 20; k += 1) {
    const free = w.reduce((s, v) => s + v, 0);
    const lim = cap * free;
    let hit = false;
    for (let i = 0; i < w.length; i += 1) if (w[i] > lim + 1e-9) { w[i] = lim; hit = true; }
    if (!hit) break;
  }
  return w;
}

// cards: [{ own, long, fan }]. Returns points [{ d, v, n, s }] where v is null on a gap.
export function longIndexLine(cards, opts) {
  const { days, guard } = opts;
  if (!guard || !(guard.junkX > 1) || !(guard.stepHi > 1) || !(guard.stepLo < 1) || !(guard.minLinks >= 1)) throw new Error("index history needs the private guard values");
  const series = [];
  let dropped = 0;
  for (const c of cards) {
    const r = cardSeries(c, opts);
    dropped += r.dropped;
    if (r.map.size) series.push(r.map);
  }
  const first = days.find((d) => series.filter((m) => m.has(d)).length >= guard.minLinks);
  if (!first) return { points: [], diag: { cards: series.length, dropped } };
  const points = [{ d: first, v: 100, n: series.filter((m) => m.has(first)).length, s: "" }];
  let level = 100;
  let from = first;
  let stepOut = 0;
  const used = new Set();
  for (const day of days.filter((d) => d > first)) {
    const pairs = [];
    series.forEach((m, i) => {
      const a = m.get(from);
      const b = m.get(day);
      if (!a || !b) return;
      const r = b[0] / a[0];
      if (r > guard.stepHi || r < guard.stepLo) { stepOut += 1; return; }
      pairs.push([a[0], r, b[1], i]);
    });
    const n = pairs.length;
    if (n < guard.minLinks) { points.push({ d: day, v: null, n, s: "" }); continue; }
    const w = cappedWeights(pairs.map((p) => p[0]), guard.capShare);
    let sw = 0;
    let swr = 0;
    const share = { n: 0, a: 0, f: 0 };
    pairs.forEach((p, k) => { sw += w[k]; swr += w[k] * p[1]; share[p[2]] += w[k] * p[1]; used.add(p[3]); });
    if (!(sw > 0)) { points.push({ d: day, v: null, n, s: "" }); continue; }
    level *= swr / sw;
    const s = Object.entries(share).sort((x, y) => y[1] - x[1])[0][0];
    points.push({ d: day, v: Math.round(level * 10) / 10, n, s, ...(share.f > 0 ? { fShare: Math.round((share.f / swr) * 1000) / 1000 } : {}) });
    from = day;
  }
  if (points[1]?.s) points[0].s = points[1].s;
  return { points, diag: { cards: series.length, used: used.size, dropped, stepOut } };
}

// Chart series for the site: real points only, [day, level, source]. The site
// fills the days between and fades gaps.
export function chartSeries(points) {
  return points.filter((p) => p.v > 0).map((p) => [p.d, p.v, p.s || "n"]);
}

// Archive days in order. The archive is weekly until the first run of back-to-back
// days, then daily. Returns the weekly days, the first daily day and the last day.
export function archiveCadence(allDays) {
  const days = [...new Set(allDays)].sort();
  if (!days.length) return { weeklyDays: [], dailyFrom: "", archiveEnd: "" };
  let dailyFrom = days.at(-1);
  for (let i = 0; i < days.length - 1; i += 1) {
    if (ms(days[i + 1]) - ms(days[i]) === DAY) { dailyFrom = days[i]; break; }
  }
  return { weeklyDays: days.filter((d) => d < dailyFrom), dailyFrom, archiveEnd: days.at(-1) };
}

// Earlier history spliced onto tonight's public line. The public line is kept as
// it is; the long line is used only for days before the public line's first day,
// scaled so the two meet on that day.
export function splice(longPts, ownPts) {
  const own = (ownPts || []).filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(String(p.d)));
  const firstOwn = own.find((p) => p.v > 0);
  if (!firstOwn) return { points: own, joined: false };
  const at = (longPts || []).find((p) => p.d === firstOwn.d && p.v > 0);
  if (!at) return { points: own, joined: false };
  const k = firstOwn.v / at.v;
  const early = longPts.filter((p) => p.d < firstOwn.d).map((p) => (p.v > 0 ? { ...p, v: Math.round(p.v * k * 10) / 10 } : p));
  return { points: [...early, ...own.map((p) => ({ ...p, s: p.v > 0 ? "n" : "" }))], joined: true, scale: k };
}
