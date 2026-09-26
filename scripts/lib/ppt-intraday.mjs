// Intraday sample and the rule for spending the reserve.
// This file does not call the network and does not invent a change percent.

export const SAMPLE_SIZE = 50;
export const CHANGE_THRESHOLD = 0.15;
export const RESERVE_BUDGET = 4000;
export const CROSSCHECK_CREDITS = 137;
export const INTRADAY_DAY_CAP = RESERVE_BUDGET - CROSSCHECK_CREDITS;
export const RUNS_UTC = [0, 4, 8, 12, 16, 20];
export const PER_RUN_CAP = Math.floor(INTRADAY_DAY_CAP / RUNS_UTC.length);

export function selectSample(products, limit = SAMPLE_SIZE) {
  return (products || [])
    .filter((row) => row && row.id && row.name && typeof row.score === "number")
    .slice()
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, id: row.id, name: row.name, kind: "sealed" }));
}

// before and after are { id, price } from a test fixture or a future paired pull.
// A missing price is not a change and is not filled in.
export function changeStats(before, after) {
  const prior = new Map((before || []).filter((row) => typeof row.price === "number").map((row) => [row.id, row.price]));
  let compared = 0;
  let changed = 0;
  const moves = [];
  for (const row of after || []) {
    if (typeof row.price !== "number" || !prior.has(row.id)) continue;
    const from = prior.get(row.id);
    if (!(from > 0)) continue;
    compared += 1;
    const pct = (row.price - from) / from;
    if (row.price !== from) {
      changed += 1;
      moves.push(Math.abs(pct));
    }
  }
  moves.sort((a, b) => a - b);
  const mid = moves.length ? moves[Math.floor((moves.length - 1) / 2)] : null;
  const changedPct = compared ? Math.round((changed / compared) * 1000) / 10 : null;
  return {
    compared,
    changed,
    changedPct,
    medianAbsMovePct: mid == null ? null : Math.round(mid * 1000) / 10,
    meaningfulChange: changedPct == null ? null : changedPct > CHANGE_THRESHOLD * 100,
  };
}

export function intradayResult({ sample, asOf, keySet = false, pairedPulls = 0 }) {
  const result = {
    asOf,
    status: "not-run",
    changedPct: null,
    medianAbsMovePct: null,
    meaningfulChange: null,
    creditsUsed: 0,
    sampleSize: sample.length,
    sampleSource: "Heat Check order. The list is which products would be pulled. It is not a price.",
    thresholdPct: CHANGE_THRESHOLD * 100,
    dayCap: INTRADAY_DAY_CAP,
    perRunCap: PER_RUN_CAP,
    runsUtc: RUNS_UTC,
    workflow: "disabled",
    sample,
  };
  if (!keySet) {
    result.reason = "POKEMONPRICETRACKER_API_KEY is not set. No request was sent. A change percent needs two pulls 4 to 6 hours apart, so none was invented.";
    return result;
  }
  if (pairedPulls < 2) {
    result.reason = "Two pulls 4 to 6 hours apart are not on file. No request was sent. No change percent was invented.";
    return result;
  }
  result.reason = "Paired pulls are present, but this build does not turn them into a percent until a human checks the private raw. The workflow stays disabled.";
  return result;
}
