// Index stress. Recommendations only: nothing here removes a product.
// Prices are never filled in. A missing day stays a gap.
import { median, quarterKey } from "./index-baskets.mjs";

export const BOOTSTRAP_DRAWS = 1000;
export const WEIGHT_CAP = 0.05;
export const DISAGREE_POINTS = 0.5;
export const SPIKE_ABS = 0.25;
export const STALE_DAYS = 2;
export const LATE_DAYS = 3;
export const STRESS_SEED = 20260926;
export const MIN_RETURNS = 8;

const r1 = (n) => Math.round(n * 10) / 10;
const r4 = (n) => Math.round(n * 10000) / 10000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// 5% cap. Infeasible when fewer than 20 names are in the move (20 * 5% = 100%).
// Then the factor is the uncapped value weight, and infeasible is true.
export function cappedFactor(rels, weights, cap = WEIGHT_CAP) {
  const n = rels.length;
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!n || !(sum > 0)) return { factor: null, capApplied: false, infeasible: true };
  const raw = weights.map((w) => w / sum);
  const vw = rels.reduce((s, rel, i) => s + rel * raw[i], 0);
  if (n * cap < 1 - 1e-9) {
    return { factor: vw, capApplied: false, infeasible: true };
  }
  const w = raw.slice();
  const locked = new Array(n).fill(false);
  let capApplied = raw.some((x) => x > cap + 1e-12);
  for (let iter = 0; iter < n + 1 && capApplied; iter++) {
    const over = [];
    for (let i = 0; i < n; i++) if (!locked[i] && w[i] > cap + 1e-12) over.push(i);
    if (!over.length) break;
    for (const i of over) {
      w[i] = cap;
      locked[i] = true;
    }
    const lockedSum = w.reduce((s, x, i) => s + (locked[i] ? x : 0), 0);
    let free = 0;
    for (let i = 0; i < n; i++) if (!locked[i]) free += w[i];
    const target = 1 - lockedSum;
    if (!(free > 0) || target < -1e-9) break;
    for (let i = 0; i < n; i++) if (!locked[i]) w[i] = (w[i] / free) * target;
  }
  const factor = rels.reduce((s, rel, i) => s + rel * w[i], 0);
  return { factor, capApplied, infeasible: false };
}

function priceOn(member, date) {
  const n = member.prices[date];
  return n > 0 ? n : 0;
}

// Same basket rule as chainIndex: reset when the quarter changes, then keep it.
// equal = mean of price relatives. median = median relative. capped = 5% value weight.
export function methodLevels(dates, members) {
  const points = [];
  const gaps = [];
  let levelE = 100, levelC = 100, levelM = 100;
  let prev = null;
  let basket = [];
  let quarter = null;
  let capAppliedDays = 0;
  let capInfeasibleDays = 0;
  const memberList = [...members];
  for (const date of dates) {
    const q = quarterKey(date);
    if (q !== quarter) {
      quarter = q;
      const next = memberList.filter((m) => priceOn(m, date) > 0);
      if (next.length) basket = next;
    }
    if (!basket.length) continue;
    if (!prev) {
      points.push({
        date,
        equal: 100,
        capped: 100,
        median: 100,
        matched: basket.filter((m) => priceOn(m, date) > 0).length,
      });
      prev = date;
      continue;
    }
    const span = daysBetween(prev, date);
    if (span > 1) {
      gaps.push({
        from: prev,
        to: date,
        missingDays: span - 1,
        note: "No price was invented for the days in between.",
      });
    }
    const rels = [];
    const weights = [];
    for (const m of basket) {
      const a = priceOn(m, prev);
      const b = priceOn(m, date);
      if (!(a > 0) || !(b > 0)) continue;
      rels.push(b / a);
      weights.push(a);
    }
    if (!rels.length) {
      gaps.push({
        from: prev,
        to: date,
        missingDays: Math.max(span - 1, 0),
        note: "No product in the basket was priced on both days.",
      });
      prev = date;
      continue;
    }
    const med = median(rels);
    const eq = rels.reduce((s, r) => s + r, 0) / rels.length;
    const cap = cappedFactor(rels, weights);
    if (cap.capApplied) capAppliedDays++;
    if (cap.infeasible) capInfeasibleDays++;
    levelE *= eq;
    levelC *= cap.factor;
    levelM *= med;
    points.push({
      date,
      from: prev,
      equal: r1(levelE),
      capped: r1(levelC),
      median: r1(levelM),
      matched: rels.length,
      capApplied: !!cap.capApplied,
      capInfeasible: !!cap.infeasible,
    });
    prev = date;
  }
  const last = points[points.length - 1] || null;
  return {
    points,
    gaps,
    capAppliedDays,
    capInfeasibleDays,
    basketIds: [...new Set(basket.map((m) => m.id))],
    levels: last
      ? { equal: last.equal, capped: last.capped, median: last.median }
      : { equal: null, capped: null, median: null },
  };
}

export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const x = p * (sorted.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  if (i >= sorted.length - 1) return sorted[sorted.length - 1];
  return sorted[i] * (1 - f) + sorted[i + 1] * f;
}

export function bootstrapBand(dates, members, draws = BOOTSTRAP_DRAWS, seed = STRESS_SEED) {
  const rng = mulberry32(seed);
  const n = members.length;
  const byDate = new Map();
  for (let d = 0; d < draws; d++) {
    const sample = new Array(n);
    for (let i = 0; i < n; i++) sample[i] = members[Math.floor(rng() * n)];
    const { points } = methodLevels(dates, sample);
    for (const p of points) {
      if (typeof p.median !== "number") continue;
      if (!byDate.has(p.date)) byDate.set(p.date, []);
      byDate.get(p.date).push(p.median);
    }
  }
  const band = [];
  for (const date of dates) {
    const arr = byDate.get(date);
    if (!arr?.length) continue;
    arr.sort((a, b) => a - b);
    band.push({
      date,
      p05: r1(percentile(arr, 0.05)),
      p95: r1(percentile(arr, 0.95)),
      draws: arr.length,
    });
  }
  return band;
}

export function leaveOneOut(dates, members, fullMedian) {
  const rows = [];
  for (const m of members) {
    const rest = members.filter((x) => x.id !== m.id);
    const { levels } = methodLevels(dates, rest);
    const levelWithout = levels.median;
    const raw = levelWithout == null || fullMedian == null ? null : levelWithout - fullMedian;
    const delta = raw == null ? null : Math.round(raw * 100) / 100;
    rows.push({ id: m.id, name: m.name, levelWithout, delta, raw });
  }
  rows.sort((a, b) => Math.abs(b.raw ?? 0) - Math.abs(a.raw ?? 0) || a.id.localeCompare(b.id));
  return rows.map(({ raw, ...rest }) => rest);
}

export function flagItems(members, dates, asOf) {
  const start = dates[0] || null;
  const out = [];
  for (const m of members) {
    const obs = dates.filter((d) => priceOn(m, d) > 0).map((d) => ({ date: d, price: m.prices[d] }));
    const flags = [];
    let spike = null;
    let maxAbs = 0;
    for (let i = 1; i < obs.length; i++) {
      const abs = Math.abs(obs[i].price / obs[i - 1].price - 1);
      if (abs > maxAbs) maxAbs = abs;
      if (abs > SPIKE_ABS && !spike) {
        spike = {
          from: obs[i - 1].date,
          to: obs[i].date,
          absReturn: r4(abs),
        };
      }
    }
    if (spike) flags.push("spiky");
    const first = obs[0]?.date || null;
    const last = obs.length ? obs[obs.length - 1].date : null;
    if (!last || (asOf && daysBetween(last, asOf) > STALE_DAYS)) flags.push("stale");
    if (first && start && daysBetween(start, first) > LATE_DAYS) flags.push("late");
    if (first && last) {
      const missing = dates.filter((d) => d > first && d < last && !(priceOn(m, d) > 0));
      if (missing.length) flags.push("gappy");
    }
    out.push({
      id: m.id,
      name: m.name,
      type: m.type || null,
      flags,
      observations: obs.length,
      first,
      last,
      maxAbsReturn: r4(maxAbs),
      spike,
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function disagreeOf(levels) {
  const vals = [levels.equal, levels.capped, levels.median].filter((v) => typeof v === "number");
  if (vals.length < 2) return { flag: false, maxGap: null, threshold: DISAGREE_POINTS };
  const maxGap = r1(Math.max(...vals) - Math.min(...vals));
  return {
    flag: maxGap > DISAGREE_POINTS,
    maxGap,
    threshold: DISAGREE_POINTS,
    note: maxGap > DISAGREE_POINTS
      ? `Equal, 5%-capped and median end ${maxGap} points apart, which is over the ${DISAGREE_POINTS} point line.`
      : `Equal, 5%-capped and median end within ${DISAGREE_POINTS} points.`,
  };
}

export function weedOut(items, looRows, basketIds, asOf) {
  const loo = new Map(looRows.map((r) => [r.id, r]));
  const inBasket = new Set(basketIds);
  const rows = [];
  for (const item of items) {
    if (!item.flags.length) continue;
    const influence = loo.get(item.id)?.delta ?? null;
    const reasons = [];
    if (item.flags.includes("spiky") && item.spike) {
      reasons.push(`Price moved ${Math.round(item.spike.absReturn * 100)}% from ${item.spike.from} to ${item.spike.to}.`);
    }
    if (item.flags.includes("stale")) {
      reasons.push(item.last
        ? `No fresh price within ${STALE_DAYS} days of ${asOf}. Last observation ${item.last}.`
        : `No price on file by ${asOf}.`);
    }
    if (item.flags.includes("gappy")) reasons.push("Missing at least one observed day between its first and last price.");
    if (item.flags.includes("late")) reasons.push(`First price is more than ${LATE_DAYS} days after the series starts.`);
    if (!inBasket.has(item.id)) reasons.push("Not in the current quarter basket, so it does not move this line.");
    else if (influence != null && influence !== 0) reasons.push(`Leaving it out moves the median index by ${influence} points.`);
    const score = (item.flags.includes("spiky") ? 4 : 0)
      + (item.flags.includes("stale") ? 2 : 0)
      + (item.flags.includes("gappy") ? 1 : 0)
      + (item.flags.includes("late") ? 1 : 0)
      + Math.min(Math.abs(influence ?? 0), 5);
    rows.push({
      id: item.id,
      name: item.name,
      type: item.type,
      flags: item.flags,
      reasons,
      influence,
      score,
    });
  }
  rows.sort((a, b) => b.score - a.score || Math.abs(b.influence ?? 0) - Math.abs(a.influence ?? 0) || a.id.localeCompare(b.id));
  return rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    type: r.type,
    flags: r.flags,
    reasons: r.reasons,
    influence: r.influence,
    recommendation: "Review only. This product was not removed.",
  }));
}

export function typeSplit(dates, members) {
  const types = [...new Set(members.map((m) => m.type).filter(Boolean))].sort();
  const rows = [];
  for (const type of types) {
    const group = members.filter((m) => m.type === type);
    if (group.length < 3) {
      rows.push({ type, n: group.length, levels: null, note: "Fewer than 3 products, so no line was built." });
      continue;
    }
    const groupDates = dates.filter((d) => group.some((m) => m.prices[d] > 0));
    if (groupDates.length < 2) {
      rows.push({ type, n: group.length, levels: null, start: groupDates[0] || null, note: "Fewer than 2 priced days, so no line was built." });
      continue;
    }
    const { levels, points } = methodLevels(groupDates, group);
    rows.push({
      type,
      n: group.length,
      start: points[0]?.date || null,
      levels,
      matchedLast: points[points.length - 1]?.matched ?? 0,
      outsideHeadline: !!group[0].outsideHeadline,
    });
  }
  return rows;
}

function returnsPossible(members) {
  let n = 0;
  for (const m of members) {
    const days = Object.keys(m.prices).filter((d) => m.prices[d] > 0);
    if (days.length >= 2) n++;
  }
  return n;
}

/**
 * members: { id, name, type, prices: { [date]: number }, outsideHeadline? }
 * dates: sorted observed days only.
 */
export function buildStressReport(spec) {
  const dates = [...(spec.dates || [])].sort();
  const members = spec.members || [];
  const extra = spec.extraMembers || [];
  const everyone = [...members, ...extra];
  const asOf = spec.asOf || dates[dates.length - 1] || null;
  const canReturn = returnsPossible(members);
  const base = {
    kind: spec.kind,
    asOf,
    today: spec.today || null,
    source: spec.source,
    sourceFile: spec.sourceFile,
    seriesStale: !!(asOf && spec.today && daysBetween(asOf, spec.today) > STALE_DAYS),
    removalsApplied: 0,
    thresholds: {
      bootstrap: BOOTSTRAP_DRAWS,
      band: [5, 95],
      weightCap: WEIGHT_CAP,
      disagreeIndexPoints: DISAGREE_POINTS,
      spikeAbsReturn: SPIKE_ABS,
      staleDays: STALE_DAYS,
      lateEntryDays: LATE_DAYS,
      seed: STRESS_SEED,
      rng: "mulberry32",
    },
    method: "Quarter basket, same rule as the published index. Equal line is the mean price change. Median line is the median price change. Capped line is value-weighted with no name above 5% when 20 or more names are in that day's move. Fewer than 20 names makes a 5% cap impossible, so that day uses the uncapped value weight and says so. The trust band and the leave-one-out list are on the median line. A single spike often does not move a median; spikes are flagged on their own. Missing days are gaps. Nothing is removed.",
  };
  if (dates.length < 2 || canReturn < MIN_RETURNS) {
    const items = flagItems(everyone, dates, asOf);
    return {
      ...base,
      sufficient: false,
      thin: true,
      insufficientReason: dates.length < 2
        ? `Only ${dates.length} observed day${dates.length === 1 ? "" : "s"} on file. A trust band needs two priced days. No band was invented.`
        : `Only ${canReturn} products have two prices. A trust band needs ${MIN_RETURNS}. No band was invented.`,
      universe: { items: members.length, observedDays: dates.length, withTwoPrices: canReturn },
      lines: null,
      disagree: null,
      trustBand: null,
      leaveOneOutTop10: [],
      byType: spec.kind === "sealed" ? typeSplit(dates, everyone) : [],
      byRarity: spec.kind === "single" ? typeSplit(dates, members) : [],
      flagCounts: countFlags(items),
      items: items.map(publicItem),
      weedOut: [],
      gaps: [],
      note: "Not enough repeated prices to stress an index. No number here was filled in.",
    };
  }
  const walked = methodLevels(dates, members);
  const basketMembers = members.filter((m) => walked.basketIds.includes(m.id));
  const band = bootstrapBand(dates, basketMembers);
  const loo = leaveOneOut(dates, basketMembers, walked.levels.median);
  const biggestMove = loo.reduce((m, row) => Math.max(m, Math.abs(row.delta ?? 0)), 0);
  const items = flagItems(everyone, dates, asOf);
  const weeds = weedOut(items, loo, walked.basketIds, asOf);
  const lastBand = band[band.length - 1] || null;
  return {
    ...base,
    sufficient: true,
    thin: dates.length < 5 || canReturn < 30,
    insufficientReason: null,
    universe: {
      items: members.length,
      basket: walked.basketIds.length,
      observedDays: dates.length,
      withTwoPrices: canReturn,
      extra: extra.length,
    },
    lines: {
      equal: walked.levels.equal,
      capped: walked.levels.capped,
      median: walked.levels.median,
      capAppliedDays: walked.capAppliedDays,
      capInfeasibleDays: walked.capInfeasibleDays,
    },
    points: walked.points,
    disagree: disagreeOf(walked.levels),
    trustBand: {
      method: "median line",
      latest: lastBand,
      byDate: band,
    },
    leaveOneOutTop10: loo.slice(0, 10),
    leaveOneOutNote: biggestMove === 0
      ? "Removing any one basket name moves the rounded median by less than 0.01 points."
      : "Ranked by how far the median line moves when that name is left out. A spike in one name often does not move a median.",
    byType: spec.kind === "sealed" ? typeSplit(dates, everyone) : [],
    byRarity: spec.kind === "single" ? typeSplit(dates, members) : [],
    flagCounts: countFlags(items),
    items: items.map(publicItem),
    weedOut: weeds.slice(0, 25),
    weedOutCount: weeds.length,
    gaps: walked.gaps,
    note: weeds.length
      ? `${Math.min(25, weeds.length)} of ${weeds.length} flagged products are listed, ranked. None were removed.`
      : "No product was flagged. None were removed.",
  };
}

function countFlags(items) {
  const c = { stale: 0, gappy: 0, spiky: 0, late: 0 };
  for (const item of items) for (const f of item.flags) if (c[f] != null) c[f]++;
  return c;
}

function publicItem(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    flags: item.flags,
    observations: item.observations,
    first: item.first,
    last: item.last,
    maxAbsReturn: item.maxAbsReturn,
  };
}
