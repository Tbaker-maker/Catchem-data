// Script-only mining of "what winning calls have in common" and crowd-vs-data
// candidates. Private. No AI. Patterns with n≥20 that beat base rate on holdout
// become candidate read rules (status: candidate, small sample).
import { HORIZONS, addDays } from "./self-check.mjs";
import { eraOf, stageOf } from "./sealed-rating.mjs";

export const MIN_N = 20;
export const HOLDOUT = 0.3;
export const SOURCE = "call-patterns";
export const CROWD_WINDOW_DAYS = 14;
export const CROWD_MIN_CREATORS = 3;
export const CROWD_MIN_CALLS = 5;

const SEASONS = { 12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring", 6: "summer", 7: "summer", 8: "summer", 9: "fall", 10: "fall", 11: "fall" };

export function seasonOf(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  return SEASONS[Number(iso.slice(5, 7))] || null;
}

export function monthOf(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  return iso.slice(5, 7);
}

export function priceBand(p) {
  if (!(p > 0)) return null;
  if (p < 25) return "under_25";
  if (p < 100) return "25_100";
  if (p < 300) return "100_300";
  if (p < 1000) return "300_1000";
  return "over_1000";
}

export function trendBand(chg) {
  if (chg == null || !Number.isFinite(chg)) return null;
  if (chg <= -0.15) return "down_hard";
  if (chg <= -0.03) return "down";
  if (chg < 0.03) return "flat";
  if (chg < 0.15) return "up";
  return "up_hard";
}

export function distBand(ratio) {
  // ratio = price / high (or price/low). Closer to 1 = near that extreme.
  if (ratio == null || !Number.isFinite(ratio)) return null;
  if (ratio >= 0.95) return "near";
  if (ratio >= 0.8) return "mid";
  return "far";
}

export function popularityTier(n) {
  if (n == null || !Number.isFinite(n)) return null;
  if (n >= 50) return "hot";
  if (n >= 15) return "warm";
  if (n >= 5) return "cool";
  return "quiet";
}

// Attach condition flags true on the call date from our files / price book.
export function attachConditions(call, ctx = {}) {
  const pid = call.pid ?? call.productId;
  const date = call.date || call.issued;
  const meta = ctx.metaByPid?.get(Number(pid)) || {};
  const priceOn = ctx.priceOn || (() => null);
  let px = null;
  if (typeof call.price === "number") px = call.price;
  else if (call.price && typeof call.price === "object" && Number(call.price.at_call) > 0) px = Number(call.price.at_call);
  else if (call.atCall != null) px = Number(call.atCall);
  else px = priceOn(pid, date);
  const release = meta.release || null;
  const ageDays = release && date ? Math.round((Date.parse(date) - Date.parse(release)) / 86400000) : null;
  const era = eraOf(release);
  const rot = ctx.rotBySet?.get(meta.setSlug) || ctx.rotBySet?.get(meta.setId) || null;
  const stage = stageOf({ release, subtype: meta.subtype, rot });

  const p30 = priceOn(pid, addDays(date, -30));
  const p90 = priceOn(pid, addDays(date, -90));
  const trend30 = px > 0 && p30 > 0 ? px / p30 - 1 : null;
  const trend90 = px > 0 && p90 > 0 ? px / p90 - 1 : null;

  // High/low over ~1y window ending at call date (from price book days).
  let hi = null, lo = null;
  if (ctx.seriesByPid?.has(Number(pid))) {
    const ser = ctx.seriesByPid.get(Number(pid));
    const from = addDays(date, -365);
    for (const [d, v] of ser) {
      if (d > date || d < from || !(v > 0)) continue;
      if (hi == null || v > hi) hi = v;
      if (lo == null || v < lo) lo = v;
    }
  }
  const nearHigh = px > 0 && hi > 0 ? px / hi : null;
  const nearLow = px > 0 && lo > 0 ? lo / px : null; // high = near low when lo/px ~ 1

  const pull = ctx.pullBySet?.get(meta.setSlug) || ctx.pullBySet?.get(meta.setId) || null;
  const listings = ctx.listingsById?.get(meta.id) ?? ctx.listingsByPid?.get(Number(pid)) ?? null;
  const sealedRatio = ctx.sealedRatioBySet?.get(meta.setSlug) ?? null;

  const hit = call.ourVerdict30 === "right" || call.h30?.held === true;
  const miss = call.ourVerdict30 === "wrong" || (call.h30 && call.h30.held === false && call.h30.result === "miss");
  const scored = hit || miss || call.ourVerdict30 === "flat";

  // Neutral labels (never buy/sell/hold — those are banned in public copy).
  const dir = call.hold ? "flat_call" : call.dir > 0 ? "up_call" : call.dir < 0 ? "down_call" : (call.rating === "buy" ? "up_call" : call.rating === "sell" || call.rating === "avoid" ? "down_call" : call.rating === "hold" ? "flat_call" : null);
  const topics = call.topicHints || call.topics || [];

  const cond = {
    product_type: meta.subtype || meta.kind || call.target || null,
    set_age: ageDays == null ? null : ageDays < 90 ? "under_90d" : ageDays < 365 ? "under_1y" : ageDays < 365 * 3 ? "1_to_3y" : "over_3y",
    era: era?.key || null,
    rotation_stage: stage?.key || null,
    regulation_mark: rot?.mark || null,
    price_level: priceBand(px),
    trend_30d: trendBand(trend30),
    trend_90d: trendBand(trend90),
    near_high: distBand(nearHigh),
    near_low: nearLow == null ? null : distBand(nearLow),
    pull_rate_band: pull?.band != null ? `band_${pull.band}` : null,
    sealed_singles_ratio: sealedRatio == null ? null : sealedRatio >= 2 ? "sealed_rich" : sealedRatio <= 0.5 ? "singles_rich" : "balanced",
    popularity: popularityTier(listings),
    month: monthOf(date),
    season: seasonOf(date),
    direction: dir,
    topic: topics[0] || (call.target === "sealed" ? "sealed" : call.target === "card" ? "singles" : null),
  };

  return {
    id: call.id || call.tcgciId,
    source: call.source || "tcgci-derived",
    pid: Number(pid) || null,
    channel: call.channel || null,
    date,
    dir,
    hit: scored ? hit : null,
    ourVerdict30: call.ourVerdict30 || null,
    conditions: cond,
    meta: { setSlug: meta.setSlug || null, name: meta.name || call.item || null, release },
  };
}

export function conditionEntries(row) {
  const out = [];
  for (const [k, v] of Object.entries(row.conditions || {})) {
    if (v == null || v === "") continue;
    out.push(`${k}=${v}`);
  }
  return out;
}

// Holdout split by call id hash for stability.
export function splitHoldout(rows, { frac = HOLDOUT, seed = 7 } = {}) {
  const train = [], test = [];
  for (const r of rows) {
    const h = [...String(r.id || "")].reduce((a, c) => (a * 33 + c.charCodeAt(0) + seed) >>> 0, 0);
    (h % 100 < frac * 100 ? test : train).push(r);
  }
  return { train, test };
}

export function baseRate(rows) {
  const scored = rows.filter((r) => r.hit != null);
  if (!scored.length) return null;
  return scored.filter((r) => r.hit).length / scored.length;
}

export function rateFor(rows, pred) {
  const scored = rows.filter((r) => r.hit != null && pred(r));
  const n = scored.length;
  if (!n) return { n: 0, hits: 0, rate: null };
  const hits = scored.filter((r) => r.hit).length;
  return { n, hits, rate: hits / n };
}

// Single- and 2-condition patterns that beat base rate on holdout with n≥minN.
export function minePatterns(rows, { minN = MIN_N, holdoutFrac = HOLDOUT, seed = 7 } = {}) {
  const scored = rows.filter((r) => r.hit != null);
  const { train, test } = splitHoldout(scored, { frac: holdoutFrac, seed });
  const baseTrain = baseRate(train);
  const baseTest = baseRate(test);
  if (baseTrain == null) return { patterns: [], baseTrain, baseTest, trainN: train.length, testN: test.length };

  const keys = new Set();
  for (const r of train) for (const e of conditionEntries(r)) keys.add(e);
  const singles = [];
  for (const key of keys) {
    const tr = rateFor(train, (r) => conditionEntries(r).includes(key));
    if (tr.n < minN || tr.rate == null || tr.rate <= baseTrain) continue;
    const te = rateFor(test, (r) => conditionEntries(r).includes(key));
    if (te.n < minN || te.rate == null || te.rate <= (baseTest ?? 0)) continue;
    singles.push({
      kind: "single",
      keys: [key],
      trainN: tr.n, trainRate: round4(tr.rate), trainHits: tr.hits,
      testN: te.n, testRate: round4(te.rate), testHits: te.hits,
      lift: round4(te.rate - (baseTest ?? 0)),
      status: "candidate_small_sample",
    });
  }
  singles.sort((a, b) => b.lift - a.lift || b.testN - a.testN);

  // Top singles only pair to keep combinatorial cost down
  const top = singles.slice(0, 25).map((p) => p.keys[0]);
  const pairs = [];
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = top[i], b = top[j];
      if (a.split("=")[0] === b.split("=")[0]) continue; // same dimension
      const pred = (r) => {
        const e = conditionEntries(r);
        return e.includes(a) && e.includes(b);
      };
      const tr = rateFor(train, pred);
      if (tr.n < minN || tr.rate == null || tr.rate <= baseTrain) continue;
      const te = rateFor(test, pred);
      if (te.n < minN || te.rate == null || te.rate <= (baseTest ?? 0)) continue;
      pairs.push({
        kind: "pair",
        keys: [a, b],
        trainN: tr.n, trainRate: round4(tr.rate), trainHits: tr.hits,
        testN: te.n, testRate: round4(te.rate), testHits: te.hits,
        lift: round4(te.rate - (baseTest ?? 0)),
        status: "candidate_small_sample",
      });
    }
  }
  pairs.sort((a, b) => b.lift - a.lift || b.testN - a.testN);

  // Greedy depth-2 decision stump on train, validated on holdout
  const tree = greedyTree(train, test, { minN, baseTest });

  // Tiny logistic: score = sum of log-odds from singles that fire; validate on holdout
  const logistic = fitLogistic(singles.slice(0, 15), train, test, { minN, baseTest });

  return {
    patterns: [...singles, ...pairs, ...tree, ...logistic].sort((a, b) => b.lift - a.lift || b.testN - a.testN),
    singles: singles.slice(0, 40),
    pairs: pairs.slice(0, 40),
    tree,
    logistic,
    baseTrain: round4(baseTrain),
    baseTest: baseTest == null ? null : round4(baseTest),
    trainN: train.length,
    testN: test.length,
  };
}

function round4(x) { return Math.round(x * 10000) / 10000; }

function greedyTree(train, test, { minN, baseTest }) {
  const out = [];
  const base = baseRate(train);
  if (base == null) return out;
  // Find best first split
  const keys = new Set();
  for (const r of train) for (const e of conditionEntries(r)) keys.add(e);
  let best = null;
  for (const key of keys) {
    const left = rateFor(train, (r) => conditionEntries(r).includes(key));
    if (left.n < minN || left.rate == null) continue;
    const gain = left.rate - base;
    if (!best || gain > best.gain) best = { key, ...left, gain };
  }
  if (!best || best.gain <= 0) return out;
  // Second split inside the first
  const subset = train.filter((r) => conditionEntries(r).includes(best.key));
  let best2 = null;
  for (const key of keys) {
    if (key === best.key || key.split("=")[0] === best.key.split("=")[0]) continue;
    const left = rateFor(subset, (r) => conditionEntries(r).includes(key));
    if (left.n < minN || left.rate == null) continue;
    const gain = left.rate - baseRate(subset);
    if (gain != null && (!best2 || gain > best2.gain)) best2 = { key, ...left, gain };
  }
  const keysPath = best2 ? [best.key, best2.key] : [best.key];
  const pred = (r) => keysPath.every((k) => conditionEntries(r).includes(k));
  const te = rateFor(test, pred);
  if (te.n >= minN && te.rate != null && te.rate > (baseTest ?? 0)) {
    out.push({
      kind: "tree",
      keys: keysPath,
      trainN: best2?.n ?? best.n,
      trainRate: round4(best2?.rate ?? best.rate),
      trainHits: best2?.hits ?? best.hits,
      testN: te.n, testRate: round4(te.rate), testHits: te.hits,
      lift: round4(te.rate - (baseTest ?? 0)),
      status: "candidate_small_sample",
    });
  }
  return out;
}

function fitLogistic(singles, train, test, { minN, baseTest }) {
  // Weight each single by train lift; predict hit if sum of firing lifts > 0.
  if (!singles.length) return [];
  const weights = new Map(singles.map((p) => [p.keys[0], p.trainRate - 0.5]));
  const pred = (r) => {
    let s = 0;
    for (const e of conditionEntries(r)) if (weights.has(e)) s += weights.get(e);
    return s > 0;
  };
  const tr = rateFor(train, pred);
  const te = rateFor(test, pred);
  if (te.n < minN || te.rate == null || te.rate <= (baseTest ?? 0)) return [];
  return [{
    kind: "logistic",
    keys: singles.slice(0, 8).map((p) => p.keys[0]),
    trainN: tr.n, trainRate: round4(tr.rate), trainHits: tr.hits,
    testN: te.n, testRate: round4(te.rate), testHits: te.hits,
    lift: round4(te.rate - (baseTest ?? 0)),
    status: "candidate_small_sample",
    note: "Sum of train lifts from firing singles; predict hit when sum > 0.",
  }];
}

export function patternsToIdeas(patterns, { asOf, now = new Date() } = {}) {
  return patterns.map((p, i) => ({
    id: `callpat:${p.kind}:${p.keys.join("+")}:${asOf || "x"}`,
    kind: "call_pattern",
    source: SOURCE,
    status: "candidate",
    smallSample: true,
    date: asOf || now.toISOString().slice(0, 10),
    pattern: p,
    rule: {
      when: p.keys,
      expect: "hit_above_base",
      wording: `Candidate (small sample): when ${p.keys.map((k) => k.replace(/=/g, " is ")).join(" and ")}, past calls matched more often than the base rate on holdout (test n=${p.testN}, hit ${Math.round(p.testRate * 100)}%, lift ${Math.round(p.lift * 100)} pts).`,
    },
    note: "Private test list. Not published. Self-check scores going forward.",
  }));
}

// ── Crowd clusters ──────────────────────────────────────────────────────────
// Group same-direction calls on the same product within 14 days.
export function crowdClusters(calls, { windowDays = CROWD_WINDOW_DAYS, minCreators = CROWD_MIN_CREATORS, minCalls = CROWD_MIN_CALLS } = {}) {
  const byPid = new Map();
  for (const c of calls) {
    const pid = c.pid ?? c.productId;
    const date = c.date || c.issued;
    const dir = c.hold ? 0 : c.dir;
    if (pid == null || !date || dir == null) continue;
    const key = `${pid}|${dir}`;
    if (!byPid.has(key)) byPid.set(key, []);
    byPid.get(key).push({ ...c, pid: Number(pid), date, dir });
  }
  const clusters = [];
  for (const [, arr] of byPid) {
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    let i = 0;
    while (i < arr.length) {
      let j = i;
      const creators = new Set();
      while (j < arr.length && daysBetween(arr[i].date, arr[j].date) <= windowDays) {
        if (arr[j].channel) creators.add(arr[j].channel);
        j++;
      }
      const slice = arr.slice(i, j);
      if (creators.size >= minCreators || slice.length >= minCalls) {
        const scored = slice.filter((c) => c.ourVerdict30 === "right" || c.ourVerdict30 === "wrong" || c.h30?.held != null);
        const hits = scored.filter((c) => c.ourVerdict30 === "right" || c.h30?.held === true).length;
        const misses = scored.filter((c) => c.ourVerdict30 === "wrong" || (c.h30 && c.h30.held === false)).length;
        clusters.push({
          pid: slice[0].pid,
          dir: slice[0].dir,
          start: slice[0].date,
          end: slice[j - 1 > i ? j - 1 : i]?.date || slice[0].date,
          calls: slice.length,
          creators: creators.size,
          creatorKeys: [...creators],
          scored: scored.length,
          hits,
          misses,
          crowdWrong: scored.length >= 3 && misses > hits,
          crowdRight: scored.length >= 3 && hits > misses,
          item: slice[0].item || slice[0].meta?.name || null,
        });
      }
      i = Math.max(i + 1, j);
    }
  }
  return clusters;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// Score crowd clusters under conditions (booster boxes, near highs, hype sets).
export function crowdVsData(clusters, rowByPidDate, { minN = MIN_N } = {}) {
  const scored = clusters.filter((c) => c.scored >= 3);
  const baseWrong = scored.length ? scored.filter((c) => c.crowdWrong).length / scored.length : null;
  const dims = [];
  const annotate = (c) => {
    const row = rowByPidDate?.get(`${c.pid}|${c.start}`) || rowByPidDate?.get(`${c.pid}|${c.end}`);
    const cond = row?.conditions || {};
    return {
      ...c,
      product_type: cond.product_type,
      near_high: cond.near_high,
      era: cond.era,
      popularity: cond.popularity,
      season: cond.season,
    };
  };
  const rich = scored.map(annotate);
  for (const dim of ["product_type", "near_high", "era", "popularity", "season"]) {
    const vals = new Set(rich.map((c) => c[dim]).filter(Boolean));
    for (const v of vals) {
      const sub = rich.filter((c) => c[dim] === v);
      if (sub.length < minN) continue;
      const wrong = sub.filter((c) => c.crowdWrong).length;
      const rate = wrong / sub.length;
      if (baseWrong != null && rate > baseWrong + 0.05) {
        dims.push({
          kind: "crowd_vs_data",
          condition: `${dim}=${v}`,
          n: sub.length,
          crowdWrongRate: round4(rate),
          baseWrongRate: round4(baseWrong),
          lift: round4(rate - baseWrong),
          status: "candidate_small_sample",
          publicWording: `Heavy creator attention on products with ${dim.replace(/_/g, " ")} ${v}. In past clusters like this, the crowd call was wrong on ${Math.round(rate * 100)}% of scored groups (n=${sub.length}).`,
        });
      }
    }
  }
  dims.sort((a, b) => b.lift - a.lift);
  return { baseWrongRate: baseWrong == null ? null : round4(baseWrong), clusters: scored.length, patterns: dims };
}

// Creative crowd-read prototypes (candidates; private test).
export function prototypeCrowdReads({ clusters, rows, attentionByPid, priceSeries, asOf }) {
  const out = [];

  // Quiet climbers: price up ≥10% over 30d, attention near zero
  const quiet = [];
  for (const [pid, ser] of priceSeries || []) {
    const pts = [...ser.entries()].filter(([d]) => d <= asOf).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (pts.length < 2) continue;
    const last = pts[pts.length - 1];
    const prev = pts.find(([d]) => d >= addDays(asOf, -30)) || pts[0];
    if (!(last[1] > 0 && prev[1] > 0)) continue;
    const chg = last[1] / prev[1] - 1;
    const attn = attentionByPid?.get(Number(pid)) || 0;
    if (chg >= 0.1 && attn <= 1) quiet.push({ pid: Number(pid), chg: round4(chg), attn });
  }
  if (quiet.length >= 5) {
    out.push({
      kind: "quiet_climbers",
      status: "candidate_small_sample",
      n: quiet.length,
      publicWording: `Products up 10% or more over 30 days with near-zero creator attention (n=${quiet.length} on ${asOf}).`,
      sample: quiet.slice(0, 10),
    });
  }

  // Hype fade: cluster with high attention but flat/down price after
  const fades = clusters.filter((c) => c.creators >= 3 && c.scored >= 3 && c.misses >= c.hits && c.dir > 0);
  if (fades.length >= 5) {
    out.push({
      kind: "hype_fade",
      status: "candidate_small_sample",
      n: fades.length,
      publicWording: `Sets or products with heavy creator up-call attention where price did not follow within 30 days (n=${fades.length} clusters).`,
      sample: fades.slice(0, 8).map((c) => ({ pid: c.pid, start: c.start, creators: c.creators, misses: c.misses, hits: c.hits })),
    });
  }

  // Attention lag: median days between first coverage and +5% move (lead) or reverse
  const lags = [];
  for (const c of clusters) {
    if (c.dir <= 0 || !priceSeries?.has(c.pid)) continue;
    const ser = priceSeries.get(c.pid);
    const p0 = ser.get(c.start);
    if (!(p0 > 0)) continue;
    let leadDays = null;
    for (let d = 1; d <= 60; d++) {
      const day = addDays(c.start, d);
      const p = ser.get(day);
      if (p > 0 && p / p0 - 1 >= 0.05) { leadDays = d; break; }
    }
    // days coverage led price: if price already up before start, negative
    let trail = null;
    for (let d = 1; d <= 60; d++) {
      const day = addDays(c.start, -d);
      const p = ser.get(day);
      if (p > 0 && p0 / p - 1 >= 0.05) { trail = -d; break; }
    }
    lags.push({ pid: c.pid, start: c.start, priceLeadDays: leadDays, coverageTrailDays: trail });
  }
  if (lags.length >= 10) {
    const withLead = lags.filter((x) => x.priceLeadDays != null);
    const med = median(withLead.map((x) => x.priceLeadDays));
    out.push({
      kind: "attention_lag",
      status: "candidate_small_sample",
      n: withLead.length,
      medianDaysPriceAfterCoverage: med,
      publicWording: withLead.length
        ? `Among crowded up-call clusters, median days from first coverage to a 5% price rise was ${med} (n=${withLead.length}).`
        : `Crowded up-call clusters rarely saw a 5% rise within 60 days (n=${lags.length}).`,
    });
  }

  // Consensus flips: same creator+product opposite direction within 45 days
  const byCP = new Map();
  for (const r of rows || []) {
    if (!r.channel || r.pid == null) continue;
    const k = `${r.channel}|${r.pid}`;
    if (!byCP.has(k)) byCP.set(k, []);
    byCP.get(k).push(r);
  }
  const flips = [];
  for (const [, arr] of byCP) {
    arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].dir && arr[i - 1].dir && arr[i].dir !== arr[i - 1].dir && daysBetween(arr[i - 1].date, arr[i].date) <= 45) {
        flips.push({ channel: arr[i].channel, pid: arr[i].pid, from: arr[i - 1].date, to: arr[i].date, fromDir: arr[i - 1].dir, toDir: arr[i].dir });
      }
    }
  }
  if (flips.length >= 5) {
    out.push({
      kind: "consensus_flips",
      status: "candidate_small_sample",
      n: flips.length,
      publicWording: `Creators reversed direction on the same product within 45 days (n=${flips.length} flips). Private count only; no names in public copy.`,
    });
  }

  // Crowd-ignored rarities: topic singles rising while sealed dominates attention
  const sealedAttn = clusters.filter((c) => c.dir !== 0).length;
  const singleRows = (rows || []).filter((r) => r.conditions?.topic === "singles" || r.conditions?.product_type === "single");
  const risingSingles = singleRows.filter((r) => r.conditions?.trend_30d === "up" || r.conditions?.trend_30d === "up_hard");
  if (risingSingles.length >= 10 && sealedAttn >= 10) {
    out.push({
      kind: "crowd_ignored_rarities",
      status: "candidate_small_sample",
      n: risingSingles.length,
      publicWording: `Singles with an up 30-day trend while creator clusters focused elsewhere (n=${risingSingles.length} rising singles rows; ${sealedAttn} direction clusters on file).`,
    });
  }

  return out;
}

function median(xs) {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function crowdIdeas(crowdPatterns, prototypes, { asOf } = {}) {
  const ideas = [];
  for (const p of crowdPatterns || []) {
    ideas.push({
      id: `crowd:${p.condition}:${asOf}`,
      kind: "crowd_vs_data",
      source: SOURCE,
      status: "candidate",
      smallSample: true,
      date: asOf,
      pattern: p,
      rule: {
        when: [p.condition, "crowd_cluster"],
        expect: "crowd_often_wrong",
        wording: p.publicWording,
      },
      note: "Private. Public copy must stay neutral, data-only, no advice words, no creator names.",
    });
  }
  for (const p of prototypes || []) {
    ideas.push({
      id: `crowdproto:${p.kind}:${asOf}`,
      kind: p.kind,
      source: SOURCE,
      status: "candidate",
      smallSample: true,
      date: asOf,
      pattern: p,
      rule: { when: [p.kind], expect: "test_privately", wording: p.publicWording },
      note: "Prototype crowd angle. Private test. Neutral public wording only.",
    });
  }
  return ideas;
}

// Refresh hit rates for candidate ideas against newly scored rows (self-check).
export function scorePatternCandidates(ideas = [], rows = [], { minN = MIN_N } = {}) {
  const scored = rows.filter((r) => r.hit != null);
  const base = baseRate(scored);
  const out = [];
  for (const idea of ideas) {
    if (!idea || (idea.kind !== "call_pattern" && !String(idea.kind || "").startsWith("crowd") && idea.kind !== "crowd_vs_data" && !["quiet_climbers","hype_fade","attention_lag","consensus_flips","crowd_ignored_rarities"].includes(idea.kind))) continue;
    const keys = idea.pattern?.keys || idea.rule?.when?.filter((k) => k.includes("=")) || [];
    if (!keys.length && idea.kind === "call_pattern") continue;
    let n = 0, hits = 0;
    if (keys.length) {
      for (const r of scored) {
        const e = conditionEntries(r);
        if (keys.every((k) => e.includes(k))) { n++; if (r.hit) hits++; }
      }
    } else {
      // crowd prototypes: use pattern.n already; mark as pending refresh
      n = idea.pattern?.n || 0;
      hits = null;
    }
    const rate = n && hits != null ? hits / n : null;
    const passed = n >= minN && rate != null && base != null && rate > base;
    out.push({
      id: idea.id,
      kind: idea.kind,
      keys,
      n,
      hits,
      rate: rate == null ? null : Math.round(rate * 10000) / 10000,
      base: base == null ? null : Math.round(base * 10000) / 10000,
      passedHoldout: passed,
      status: passed ? "passed_holdout" : "candidate_small_sample",
    });
  }
  return { base: base == null ? null : Math.round(base * 10000) / 10000, scored: scored.length, rows: out };
}
