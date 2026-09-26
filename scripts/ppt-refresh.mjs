// Daily PPT budget. With no key this writes a zero-credit log and exits 0.
// The key is never printed. Raw bodies never go in data/.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HISTORY_DAYS,
  MAIN_BUDGET,
  SLAB_TARGET,
  createLimiter,
  creditCost,
  fetchWithBackoff,
  minuteUnits,
  planFromRecords,
  usageSkeleton,
} from "./lib/ppt-plan.mjs";
import { orderRefreshCalls, sanitizeDates, setBand } from "./lib/ppt-refresh-order.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.pokemonpricetracker.com/api/v2";

function redact(text, secrets) {
  let out = String(text || "");
  for (const secret of secrets) {
    if (secret && String(secret).length > 3) out = out.split(secret).join("[redacted]");
  }
  return out.slice(0, 180);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function callsFor(sealedRows, sets, { dates = {}, volumes = {} } = {}) {
  const calls = [];
  for (const row of sealedRows) {
    const id = `sealed-${row.tcgPlayerId}`;
    const hasHistory = !!row.hasHistory || Boolean(dates[id]);
    calls.push({
      bucket: "sealed",
      priority: "sealed",
      id,
      refreshed: dates[id] || "",
      volume: 0,
      estimated: creditCost({ hasHistory }),
      units: 1,
      items: 1,
      url: `${BASE}/sealed-products?tcgPlayerId=${encodeURIComponent(row.tcgPlayerId)}&limit=1&includeHistory=true&days=${HISTORY_DAYS}`,
    });
  }
  for (const set of sets) {
    const id = `set-${set.setId}`;
    const hasHistory = Boolean(dates[id]);
    const volume = volumes[set.setId] || 0;
    calls.push({
      bucket: "singles",
      priority: setBand(set, volume),
      id,
      refreshed: dates[id] || "",
      volume,
      estimated: set.cardCount * (hasHistory ? 1 : 2),
      units: minuteUnits(set.cardCount),
      items: set.cardCount,
      url: `${BASE}/cards?setId=${encodeURIComponent(set.pptSetId)}&fetchAllInSet=true&includeHistory=true&days=${HISTORY_DAYS}`,
    });
  }
  return calls;
}

// A provider outage should not turn into hours of retries on every queued call.
export const MAX_FAILS_IN_ROW = 5;

export function resumeIds(cursor, callIds, today) {
  const prev = new Set(Array.isArray(cursor?.done) ? cursor.done : []);
  const complete = callIds.length > 0 && callIds.every((id) => prev.has(id));
  if (complete && cursor?.asOf && cursor.asOf !== today) return [];
  return callIds.filter((id) => prev.has(id));
}

export async function executePlan({ key, calls, fetchImpl, reserve, rawDir, budget = MAIN_BUDGET, secrets = [], alreadyDone = [] } = {}) {
  const used = { sealed: 0, singles: 0, slabs: 0, intraday: 0, crosscheck: 0, total: 0 };
  const items = { sealed: 0, singles: 0, slabs: 0 };
  const errors = [];
  const done = [];
  let skipped = 0;
  let rateLimits = 0;
  let retries = 0;
  let failedInRow = 0;
  const finished = new Set(alreadyDone || []);
  if (!key) return { used, items, errors, raw: "not fetched", skipped, rateLimits, retries, done };
  if (rawDir) await mkdir(rawDir, { recursive: true });
  const queue = (calls || []).filter((call) => call?.id && call.estimated > 0 && !finished.has(call.id));
  for (let i = 0; i < queue.length; i += 1) {
    const call = queue[i];
    if (used.total + call.estimated > budget) {
      skipped += call.items || 1;
      continue;
    }
    await reserve(call.units || 1);
    let body;
    try {
      body = await fetchImpl(call.url, key);
    } catch (err) {
      rateLimits += err.rateLimits || 0;
      retries += err.rateLimits || 1;
      errors.push(redact(err.message, [key, ...secrets]));
      if (err.daily) {
        skipped += call.items || 1;
        for (const rest of queue.slice(i + 1)) skipped += rest.items || 1;
        break;
      }
      skipped += call.items || 1;
      failedInRow += 1;
      if (failedInRow >= MAX_FAILS_IN_ROW) {
        errors.push(`${MAX_FAILS_IN_ROW} calls failed in a row; stopped for today`);
        for (const rest of queue.slice(i + 1)) skipped += rest.items || 1;
        break;
      }
      continue;
    }
    failedInRow = 0;
    const spent = body?.metadata?.apiCallsConsumed?.total;
    if (typeof spent !== "number") {
      errors.push("response did not say how many credits it used; skipped");
      skipped += call.items || 1;
      continue;
    }
    used[call.bucket] = (used[call.bucket] || 0) + spent;
    used.total += spent;
    items[call.bucket] = (items[call.bucket] || 0) + call.items;
    done.push(call.id);
    if (rawDir) await writeFile(join(rawDir, `${call.id}.json`), JSON.stringify(body));
    if (used.total >= budget) {
      for (const rest of queue.slice(i + 1)) skipped += rest.items || 1;
      break;
    }
  }
  return { used, items, errors, raw: rawDir ? "artifact" : "not fetched", skipped, rateLimits, retries, done };
}

export async function loadQueue(root = ROOT) {
  const catalogue = await readJson(join(root, "data/card-catalogue.json"));
  const cards = Object.values(catalogue.cards || {});
  const setMap = (await readJson(join(root, "data/ppt-set-map.json"))).bySlug || {};
  const sealedCfg = await readJson(join(root, "scripts/ppt-history-backfill-ids.json"));
  const sealed = (sealedCfg.products || []).map((row) => ({
    tcgPlayerId: String(row.tcgPlayerId),
    hasHistory: (row.keys || []).some((key) => ["data/history/ppt-sealed-private", "data/history/ppt-sealed"].some((dir) => existsSync(join(root, dir, `${key}.json`)))),
  }));
  const priced = cards.reduce((n, card) => n + (Number(card.price) > 0 ? 1 : 0), 0);
  const withId = cards.some((card) => card.tcgplayerProductId);
  const plan = planFromRecords({
    sealed,
    cards,
    setMap,
    slabCandidates: Math.min(SLAB_TARGET, priced),
    slabExecutable: withId ? Math.min(SLAB_TARGET, priced) : 0,
  });
  return { plan, sealed, sets: plan.setOrder || [] };
}

export async function volumeBySet(root) {
  const out = {};
  try {
    const enrichment = JSON.parse(await readFile(join(root, "data/singles-enrichment.json"), "utf8"));
    const catalogue = JSON.parse(await readFile(join(root, "data/card-catalogue.json"), "utf8"));
    const cards = catalogue.cards || {};
    for (const row of enrichment.cards || []) {
      const setId = cards[row.cardId]?.setId;
      const vol = Number(row.raw?.vol30);
      if (!setId || !(vol > 0)) continue;
      out[setId] = (out[setId] || 0) + vol;
    }
  } catch {
    return {};
  }
  return out;
}

function publicUsage(plan, extra) {
  const usage = usageSkeleton(plan, extra);
  usage.estimate.blockedNoSetId = plan.blockedNoSetId || 0;
  usage.estimate.sealedNote = plan.sealed.note;
  usage.estimate.slabNote = plan.slabs.note;
  usage.estimate.singlesByTier = plan.singles.byTier;
  delete usage.estimate.tiers;
  usage.estimate.schedule = plan.schedule.tiers.map((row) => ({
    tier: row.tier,
    items: row.items,
    credits: row.credits,
    startDay: row.startDay,
    endDay: row.endDay,
    days: row.days,
  }));
  usage.estimate.days = plan.schedule.days;
  return usage;
}

async function defaultFetch(url, key, stats) {
  const { body, rateLimits } = await fetchWithBackoff(url, key, {
    request: async (oneUrl, oneKey) => {
      const res = await fetch(oneUrl, {
        headers: { Authorization: `Bearer ${oneKey}` },
        signal: AbortSignal.timeout(30000),
      });
      let body = {};
      try { body = await res.json(); } catch { body = {}; }
      return { status: res.status, body, retryAfter: res.headers.get("retry-after") };
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  if (stats) stats.rateLimits += rateLimits;
  return body;
}

export async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const key = process.env.POKEMONPRICETRACKER_API_KEY || "";
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  const { plan, sealed, sets } = await loadQueue();
  const usage = publicUsage(plan, {
    asOf: today,
    status: key ? "ran" : "skipped",
    reason: key ? "Key was present. Credits below are what the provider reported." : "POKEMONPRICETRACKER_API_KEY is not set. No request was sent.",
  });
  usage.raw = "not fetched";
  usage.run = { creditsUsed: 0, itemsDone: 0, itemsSkipped: 0, rateLimitCount: 0, retries: 0 };
  const cursorPath = join(ROOT, "data/meta/ppt-cursor.json");
  const datesPath = join(ROOT, "ppt-raw-private/refresh-dates.json");
  let cursor = { done: [] };
  if (existsSync(cursorPath)) {
    try { cursor = JSON.parse(await readFile(cursorPath, "utf8")); } catch { cursor = { done: [] }; }
  }
  let dates = {};
  if (existsSync(datesPath)) {
    try { dates = sanitizeDates(JSON.parse(await readFile(datesPath, "utf8"))); } catch { dates = {}; }
  }
  if (key) {
    const stats = { rateLimits: 0 };
    const volumes = await volumeBySet(ROOT);
    const calls = orderRefreshCalls(callsFor(sealed, sets, { dates, volumes }));
    const alreadyDone = resumeIds(cursor, calls.map((call) => call.id), today);
    const ran = await executePlan({
      key,
      calls,
      fetchImpl: (url, oneKey) => defaultFetch(url, oneKey, stats),
      reserve: createLimiter(),
      rawDir: join(ROOT, "ppt-raw-private", today),
      secrets: [token],
      alreadyDone,
    });
    usage.credits.used = ran.used;
    usage.credits.remaining = Math.max(0, usage.credits.budget - ran.used.total);
    usage.items = { sealed: ran.items.sealed, singles: ran.items.singles, slabs: ran.items.slabs };
    usage.errors = ran.errors;
    usage.run = {
      creditsUsed: ran.used.total,
      itemsDone: ran.items.sealed + ran.items.singles + ran.items.slabs,
      itemsSkipped: ran.skipped,
      rateLimitCount: ran.rateLimits + stats.rateLimits,
      retries: ran.retries + stats.rateLimits,
    };
    usage.raw = "private repo catchem-data-private";
    usage.rawNote = token
      ? "PRIVATE_DATA_TOKEN is set. Raw is written under ppt-raw-private and pushed to the private repo. It is not committed here."
      : "PRIVATE_DATA_TOKEN is not set. Raw was not pushed and is not committed here.";
    const nextDates = { ...dates };
    for (const id of ran.done) nextDates[id] = today;
    await mkdir(join(ROOT, "ppt-raw-private"), { recursive: true });
    await writeFile(datesPath, `${JSON.stringify({ asOf: today, dates: sanitizeDates(nextDates) }, null, 2)}\n`);
    cursor = {
      asOf: today,
      done: [...new Set([...alreadyDone, ...ran.done])],
      advanced: ran.done.length > 0,
      note: "Resume point. Ids only. Not a price.",
    };
  }
  const meta = join(ROOT, "data/meta");
  await mkdir(meta, { recursive: true });
  await writeFile(join(meta, "ppt-usage.json"), JSON.stringify(usage, null, 2));
  const cursorReady = Array.isArray(cursor.done);
  if (!cursorReady || key) {
    const next = key && cursorReady ? cursor : {
      asOf: today,
      done: [],
      advanced: false,
      note: "Resume point. Ids only. Not a price.",
    };
    await writeFile(cursorPath, JSON.stringify(next, null, 2));
  }
  console.log(`ppt-refresh ${usage.status} credits=${usage.credits.used.total} sealedQueued=${plan.sealed.queued} singles=${plan.singles.items} days=${plan.schedule.days}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    const key = process.env.POKEMONPRICETRACKER_API_KEY || "";
    console.error(`ppt-refresh failed: ${redact(err.message, [key, process.env.PRIVATE_DATA_TOKEN || ""])}`);
    process.exitCode = 1;
  });
}
