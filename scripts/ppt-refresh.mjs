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
  minuteUnits,
  planFromRecords,
  usageSkeleton,
} from "./lib/ppt-plan.mjs";

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

export function callsFor(sealedRows, sets) {
  const calls = [];
  for (const row of sealedRows) {
    calls.push({
      bucket: "sealed",
      id: `sealed-${row.tcgPlayerId}`,
      estimated: creditCost({ hasHistory: !!row.hasHistory }),
      units: 1,
      items: 1,
      url: `${BASE}/sealed-products?tcgPlayerId=${encodeURIComponent(row.tcgPlayerId)}&limit=1&includeHistory=true&days=${HISTORY_DAYS}`,
    });
  }
  for (const set of sets) {
    calls.push({
      bucket: "singles",
      id: `set-${set.setId}`,
      estimated: set.cardCount * 2,
      units: minuteUnits(set.cardCount),
      items: set.cardCount,
      url: `${BASE}/cards?setId=${encodeURIComponent(set.pptSetId)}&fetchAllInSet=true&includeHistory=true&days=${HISTORY_DAYS}`,
    });
  }
  return calls;
}

export async function executePlan({ key, calls, fetchImpl, reserve, rawDir, budget = MAIN_BUDGET, secrets = [] }) {
  const used = { sealed: 0, singles: 0, slabs: 0, intraday: 0, crosscheck: 0, total: 0 };
  const items = { sealed: 0, singles: 0, slabs: 0 };
  const errors = [];
  if (!key) return { used, items, errors, raw: "not fetched" };
  if (rawDir) await mkdir(rawDir, { recursive: true });
  for (const call of calls) {
    if (used.total + call.estimated > budget) break;
    await reserve(call.units);
    let body;
    try {
      body = await fetchImpl(call.url, key);
    } catch (err) {
      errors.push(redact(err.message, [key, ...secrets]));
      if (err.daily || errors.length >= 3) break;
      continue;
    }
    const spent = body?.metadata?.apiCallsConsumed?.total;
    if (typeof spent !== "number") {
      errors.push("response did not say how many credits it used; stopped");
      break;
    }
    used[call.bucket] += spent;
    used.total += spent;
    items[call.bucket] += call.items;
    if (rawDir) await writeFile(join(rawDir, `${call.id}.json`), JSON.stringify(body));
    if (used.total >= budget) break;
  }
  return { used, items, errors, raw: rawDir ? "artifact" : "not fetched" };
}

export async function loadQueue(root = ROOT) {
  const catalogue = await readJson(join(root, "data/card-catalogue.json"));
  const cards = Object.values(catalogue.cards || {});
  const setMap = (await readJson(join(root, "data/ppt-set-map.json"))).bySlug || {};
  const sealedCfg = await readJson(join(root, "scripts/ppt-history-backfill-ids.json"));
  const sealed = (sealedCfg.products || []).map((row) => ({
    tcgPlayerId: String(row.tcgPlayerId),
    hasHistory: (row.keys || []).some((key) => existsSync(join(root, "data/history/ppt-sealed", `${key}.json`))),
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

async function defaultFetch(url, key) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(30000),
  });
  let body = {};
  try { body = await res.json(); } catch { body = {}; }
  if (res.status === 429) {
    const daily = body.limitType === "daily";
    const err = new Error(daily ? "daily cap" : "rate limited");
    err.daily = daily;
    throw err;
  }
  if (!res.ok) throw new Error(`http ${res.status}`);
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
  if (key) {
    const calls = callsFor(sealed, sets);
    const ran = await executePlan({
      key,
      calls,
      fetchImpl: defaultFetch,
      reserve: createLimiter(),
      rawDir: join(ROOT, "ppt-raw-private", today),
      secrets: [token],
    });
    usage.credits.used = ran.used;
    usage.credits.remaining = Math.max(0, usage.credits.budget - ran.used.total);
    usage.items = { sealed: ran.items.sealed, singles: ran.items.singles, slabs: ran.items.slabs };
    usage.errors = ran.errors;
    usage.raw = "actions artifact ppt-raw-private, 90 days";
    usage.rawNote = token
      ? "PRIVATE_DATA_TOKEN is set. Raw is still written only under ppt-raw-private for the artifact. It is not committed."
      : "PRIVATE_DATA_TOKEN is not set. Raw stays in the artifact and out of this repo.";
  }
  const meta = join(ROOT, "data/meta");
  await mkdir(meta, { recursive: true });
  await writeFile(join(meta, "ppt-usage.json"), JSON.stringify(usage, null, 2));
  const cursorPath = join(meta, "ppt-cursor.json");
  if (!existsSync(cursorPath)) {
    await writeFile(cursorPath, JSON.stringify({
      asOf: today,
      sealedOffset: 0,
      setOffset: 0,
      advanced: false,
      note: "Resume point. Not a price.",
    }, null, 2));
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
