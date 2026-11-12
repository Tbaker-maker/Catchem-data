// Credit plan and public usage log for PkmnPrices. No network. No prices. No key.
export const DAILY_CREDITS = 20000;
export const MAIN_BUDGET = 16000;
export const RESERVE_BUDGET = 4000;
export const REQ_PER_MIN = 55;
export const RECHECK_DAYS = 7;
export const MAX_FAILS_IN_ROW = 5;

export function spentEarlierToday(prev, today) {
  if (!prev || prev.asOf !== today) return 0;
  const credits = prev.credits || {};
  const value = Number.isFinite(credits.usedToday) ? credits.usedToday : credits.used?.total;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function resumeIds(cursor, callIds, today) {
  const prev = new Set(Array.isArray(cursor?.done) ? cursor.done : []);
  const complete = callIds.length > 0 && callIds.every((id) => prev.has(id));
  if (complete && cursor?.asOf && cursor.asOf !== today) return [];
  return callIds.filter((id) => prev.has(id));
}

export function daysBetween(from, to) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  return Math.round((b - a) / 86400000);
}

export function skipRecent(calls, marked, today, days = RECHECK_DAYS) {
  const skipped = [];
  const kept = [];
  for (const call of calls || []) {
    const when = marked?.[call.id];
    if (when && daysBetween(when, today) < days) skipped.push(call);
    else kept.push(call);
  }
  return { calls: kept, skipped };
}

export function nextMarked(prev, { done = [], found = [], today }) {
  const out = { ...(prev || {}) };
  for (const id of done) delete out[id];
  for (const id of found) out[id] = today;
  return out;
}

export function loadIdMap(doc) {
  const sealed = {};
  const cards = {};
  const srcSealed = doc?.sealed && typeof doc.sealed === "object" ? doc.sealed : {};
  const srcCards = doc?.cards && typeof doc.cards === "object" ? doc.cards : {};
  for (const [key, value] of Object.entries(srcSealed)) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) sealed[String(key)] = id;
  }
  for (const [key, value] of Object.entries(srcCards)) {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) cards[String(key)] = id;
  }
  return { sealed, cards };
}

export function publicIdMap({ sealed = {}, cards = {}, asOf }) {
  return {
    note: "PkmnPrices ids keyed by TCGplayer product id. Ids only. No prices.",
    asOf: asOf || "",
    sealed,
    cards,
    counts: { sealed: Object.keys(sealed).length, cards: Object.keys(cards).length },
  };
}

export function orderRefreshCalls(calls) {
  const lookups = new Map();
  const details = [];
  const others = [];
  for (const call of calls || []) {
    if (call.kind === "lookup") lookups.set(`${call.bucket}:${call.tcgPlayerId}`, call);
    else if (call.kind === "detail") details.push(call);
    else others.push(call);
  }
  const rank = (bucket) => (bucket === "sealed" ? 0 : 1);
  details.sort((a, b) => {
    const bucket = rank(a.bucket) - rank(b.bucket);
    if (bucket) return bucket;
    const mapped = Number(Boolean(b.mapped)) - Number(Boolean(a.mapped));
    if (mapped) return mapped;
    const stale = String(a.refreshed || "").localeCompare(String(b.refreshed || ""));
    if (stale) return stale;
    return (Number(b.price) || 0) - (Number(a.price) || 0);
  });
  const out = [];
  for (const detail of details) {
    const key = `${detail.bucket}:${detail.tcgPlayerId}`;
    const lookup = lookups.get(key);
    if (lookup) {
      out.push(lookup);
      lookups.delete(key);
    }
    out.push(detail);
  }
  out.push(...lookups.values(), ...others);
  return out;
}

export function estimateNightly({ sealedCount, singlesCount, mappedSealed = 0, mappedSingles = 0, budget = MAIN_BUDGET }) {
  const sealedLookups = Math.max(0, sealedCount - mappedSealed);
  const sealedDetails = sealedCount;
  const sealedCredits = sealedLookups + sealedDetails;
  const left = Math.max(0, budget - sealedCredits);
  const unmappedSingles = Math.max(0, singlesCount - mappedSingles);
  // Prefer already-mapped details (1 credit). Unmapped need a lookup + a detail.
  const mappedDetailsFit = Math.min(mappedSingles, left);
  const leftover = left - mappedDetailsFit;
  const unmappedFit = Math.min(unmappedSingles, Math.floor(leftover / 2));
  const singlesCredits = mappedDetailsFit + unmappedFit * 2;
  return {
    budget,
    reserve: RESERVE_BUDGET,
    daily: DAILY_CREDITS,
    sealedCredits,
    singlesCredits,
    total: sealedCredits + singlesCredits,
    sealedCount,
    singlesCount,
    mappedSealed,
    mappedSingles,
    singlesThisNight: mappedDetailsFit + unmappedFit,
    notes: [
      "Main budget is 16,000 of 20,000 daily credits; 4,000 stays in reserve.",
      "Current prices only. History is 1 credit per row and is not in the nightly refresh.",
      "A mapped product costs 1 credit for GET /v1/sealed/:id or GET /v1/cards/:id. An unmapped product also spends 1 credit on the tcg_player_id lookup.",
    ],
  };
}

export function usageSkeleton(estimate, { asOf, status, reason }) {
  return {
    asOf,
    status,
    reason,
    credits: {
      budget: DAILY_CREDITS,
      main: MAIN_BUDGET,
      reserve: RESERVE_BUDGET,
      used: { sealed: 0, singles: 0, total: 0 },
      remaining: DAILY_CREDITS,
      usedToday: 0,
      usedThisRun: 0,
      labels: {
        used: "this run only, from x-credits-charged",
        usedThisRun: "this run only, from x-credits-charged",
        usedToday: "all runs this UTC day",
        remaining: "daily budget minus usedToday; not the lagging x-credits-remaining header",
      },
    },
    items: { sealed: 0, singles: 0 },
    errors: [],
    estimate: estimate || {},
    note: "Public log only. No API key and no raw prices.",
    raw: "not fetched",
    run: { creditsUsed: 0, itemsDone: 0, itemsSkipped: 0, rateLimitCount: 0, retries: 0 },
  };
}
