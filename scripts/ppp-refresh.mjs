// Daily PkmnPrices (PPP) budget. With no key this writes a zero-credit log and exits 0.
// The key is never printed. Raw bodies never go in data/.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BASE, buildUrl, defaultRequest, fetchPpp, pppLimiter, redact } from "./lib/ppp-client.mjs";
import {
  DAILY_CREDITS,
  MAIN_BUDGET,
  MAX_FAILS_IN_ROW,
  estimateNightly,
  loadIdMap,
  nextMarked,
  orderRefreshCalls,
  publicIdMap,
  resumeIds,
  skipRecent,
  spentEarlierToday,
  usageSkeleton,
} from "./lib/ppp-plan.mjs";
import { comparePulls } from "./lib/ppp-compare.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonSafe(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

export async function loadQueue(root = ROOT) {
  const sealedCfg = await readJson(join(root, "scripts/ppt-history-backfill-ids.json"));
  const sealed = (sealedCfg.products || []).map((row) => ({
    tcgPlayerId: String(row.tcgPlayerId),
    keys: row.keys || [],
  }));
  const catalog = await readJsonSafe(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const singles = [];
  for (const item of catalog.items || []) {
    if (item.kind !== "single" || !item.tcgplayerProductId) continue;
    singles.push({
      tcgPlayerId: String(item.tcgplayerProductId),
      name: item.name || "",
      set: item.set || "",
      price: Number(item.price) || 0,
    });
  }
  return { sealed, singles, tcgcsv: catalog };
}

export function callsFor({ sealed, singles, idMap, dates = {} }) {
  const calls = [];
  for (const row of sealed) {
    const tid = String(row.tcgPlayerId);
    const pppId = idMap.sealed[tid];
    if (!pppId) {
      calls.push({
        bucket: "sealed",
        kind: "lookup",
        id: `sealed-lookup-${tid}`,
        tcgPlayerId: tid,
        mapped: false,
        refreshed: dates[`sealed-${tid}`] || "",
        price: 0,
        estimated: 1,
        units: 1,
        items: 1,
        url: buildUrl("/v1/sealed", { tcg_player_id: tid, per_page: 5 }),
      });
    }
    calls.push({
      bucket: "sealed",
      kind: "detail",
      id: `sealed-${tid}`,
      tcgPlayerId: tid,
      pppId: pppId || null,
      mapped: Boolean(pppId),
      refreshed: dates[`sealed-${tid}`] || "",
      price: 0,
      estimated: 1,
      units: 1,
      items: 1,
      url: pppId ? buildUrl(`/v1/sealed/${pppId}`, { currency: "usd" }) : null,
    });
  }
  for (const row of singles) {
    const tid = String(row.tcgPlayerId);
    const pppId = idMap.cards[tid];
    if (!pppId) {
      calls.push({
        bucket: "singles",
        kind: "lookup",
        id: `card-lookup-${tid}`,
        tcgPlayerId: tid,
        mapped: false,
        refreshed: dates[`card-${tid}`] || "",
        price: row.price || 0,
        estimated: 1,
        units: 1,
        items: 1,
        url: buildUrl("/v1/cards", { tcg_player_id: tid, per_page: 5 }),
      });
    }
    calls.push({
      bucket: "singles",
      kind: "detail",
      id: `card-${tid}`,
      tcgPlayerId: tid,
      pppId: pppId || null,
      mapped: Boolean(pppId),
      refreshed: dates[`card-${tid}`] || "",
      price: row.price || 0,
      estimated: 1,
      units: 1,
      items: 1,
      url: pppId ? buildUrl(`/v1/cards/${pppId}`, { currency: "usd" }) : null,
    });
  }
  return calls;
}

function lookupId(body) {
  const rows = Array.isArray(body?.data) ? body.data : [];
  if (rows.length === 1 && Number(rows[0]?.id) > 0) return Number(rows[0].id);
  return null;
}

export async function executePlan({
  key,
  calls,
  fetchImpl,
  reserve,
  rawDir,
  budget = MAIN_BUDGET,
  secrets = [],
  alreadyDone = [],
  idMap,
  onProgress,
} = {}) {
  const used = { sealed: 0, singles: 0, total: 0 };
  const items = { sealed: 0, singles: 0 };
  const errors = [];
  const done = [];
  const empty = [];
  const failedIds = [];
  const resolved = [];
  let skipped = 0;
  let budgetSkipped = 0;
  let httpFailed = 0;
  let callsSent = 0;
  let callsFailed = 0;
  let callsNotSent = 0;
  let rateLimits = 0;
  let retries = 0;
  let failedInRow = 0;
  const finished = new Set(alreadyDone || []);
  const map = {
    sealed: { ...(idMap?.sealed || {}) },
    cards: { ...(idMap?.cards || {}) },
  };
  const hold = (call) => {
    budgetSkipped += call.items || 1;
    callsNotSent += 1;
    skipped += call.items || 1;
  };
  if (!key) {
    return {
      used, items, errors, raw: "not fetched", skipped, budgetSkipped, httpFailed,
      callsSent, callsFailed, callsNotSent, rateLimits, retries, done, empty, failedIds, resolved, idMap: map,
    };
  }
  if (rawDir) await mkdir(rawDir, { recursive: true });
  const pending = (calls || []).filter((call) => call?.id && call.estimated > 0 && !finished.has(call.id));
  for (let i = 0; i < pending.length; i += 1) {
    const call = pending[i];
    if (call.kind === "detail" && !call.pppId) {
      const learned = call.bucket === "sealed" ? map.sealed[call.tcgPlayerId] : map.cards[call.tcgPlayerId];
      if (learned) {
        call.pppId = learned;
        call.mapped = true;
        call.url = call.bucket === "sealed"
          ? buildUrl(`/v1/sealed/${learned}`, { currency: "usd" })
          : buildUrl(`/v1/cards/${learned}`, { currency: "usd" });
      }
    }
    if (call.kind === "detail" && !call.url) {
      // Lookup missed or has not run yet. Skip without charging; a later run retries.
      hold(call);
      continue;
    }
    if (used.total + call.estimated > budget) {
      hold(call);
      continue;
    }
    await reserve(call.units || 1);
    let result;
    try {
      result = await fetchImpl(call.url, key);
    } catch (err) {
      rateLimits += err.rateLimits || 0;
      retries += err.rateLimits || 1;
      const charged = Number(err.charged) || 0;
      used[call.bucket] = (used[call.bucket] || 0) + charged;
      used.total += charged;
      errors.push(redact(err.message, [key, ...secrets]));
      httpFailed += call.items || 1;
      callsFailed += 1;
      skipped += call.items || 1;
      if (err.status >= 400 && err.status < 500 && err.status !== 429) failedIds.push(call.id);
      if (err.daily) {
        for (const rest of pending.slice(i + 1)) hold(rest);
        break;
      }
      failedInRow += 1;
      if (failedInRow >= MAX_FAILS_IN_ROW) {
        errors.push(`${MAX_FAILS_IN_ROW} calls failed in a row; stopped for today`);
        for (const rest of pending.slice(i + 1)) hold(rest);
        break;
      }
      continue;
    }
    failedInRow = 0;
    const charged = result?.charged;
    if (typeof charged !== "number") {
      errors.push("response did not say how many credits it used; skipped");
      httpFailed += call.items || 1;
      callsFailed += 1;
      skipped += call.items || 1;
      continue;
    }
    used[call.bucket] = (used[call.bucket] || 0) + charged;
    used.total += charged;
    const status = result.status ?? 0;
    if (status >= 400) {
      httpFailed += call.items || 1;
      callsFailed += 1;
      skipped += call.items || 1;
      if (status < 500 && status !== 429) failedIds.push(call.id);
      errors.push(redact(`http ${status} on ${call.id}`, [key, ...secrets]));
      if (used.total >= budget) {
        for (const rest of pending.slice(i + 1)) hold(rest);
        break;
      }
      continue;
    }
    callsSent += 1;
    done.push(call.id);
    if (call.kind === "lookup") {
      const rows = Array.isArray(result.body?.data) ? result.body.data : [];
      const pppId = lookupId(result.body);
      if (pppId) {
        if (call.bucket === "sealed") map.sealed[call.tcgPlayerId] = pppId;
        else map.cards[call.tcgPlayerId] = pppId;
        resolved.push({ bucket: call.bucket, tcgPlayerId: call.tcgPlayerId, pppId });
      } else {
        empty.push(call.id);
      }
      if (rawDir) {
        await writeFile(join(rawDir, `${call.id}.json`), JSON.stringify({
          tcgPlayerId: call.tcgPlayerId,
          matchCount: rows.length,
          pppId,
          body: result.body,
          charged,
          status,
        }));
      }
    } else {
      items[call.bucket] = (items[call.bucket] || 0) + (call.items || 1);
      if (rawDir) {
        await writeFile(join(rawDir, `${call.id}.json`), JSON.stringify({
          tcgPlayerId: call.tcgPlayerId,
          pppId: call.pppId,
          body: result.body,
          charged,
          status,
        }));
      }
    }
    if (typeof onProgress === "function") {
      await onProgress({ done, map, used });
    }
    if (used.total >= budget) {
      for (const rest of pending.slice(i + 1)) hold(rest);
      break;
    }
  }
  return {
    used, items, errors, raw: rawDir ? "artifact" : "not fetched", skipped, budgetSkipped, httpFailed,
    callsSent, callsFailed, callsNotSent, rateLimits, retries, done, empty, failedIds, resolved, idMap: map,
  };
}

async function defaultFetch(url, key, stats) {
  const result = await fetchPpp(url, key, {
    request: defaultRequest,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  if (stats) stats.rateLimits += result.rateLimits || 0;
  return result;
}

function tcgcsvIndex(catalog) {
  const map = new Map();
  for (const item of catalog?.items || []) {
    if (item?.tcgplayerProductId) map.set(String(item.tcgplayerProductId), item);
  }
  return map;
}

async function loadTodayPulls(rawDir, prefix) {
  if (!rawDir || !existsSync(rawDir)) return [];
  const names = await readdir(rawDir);
  const out = [];
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith(".json") || name.includes("-lookup-")) continue;
    try {
      const doc = JSON.parse(await readFile(join(rawDir, name), "utf8"));
      if (doc?.body && doc.tcgPlayerId) out.push(doc);
    } catch { /* skip a bad file and keep the rest */ }
  }
  return out;
}

async function loadPptSealed(root, today) {
  const map = new Map();
  const dirs = [join(root, "ppt-raw-private", today), join(root, "ppt-raw-private")];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let names = [];
    try { names = await readdir(dir); } catch { continue; }
    for (const name of names) {
      if (!name.startsWith("sealed-") || !name.endsWith(".json")) continue;
      const tid = name.replace(/^sealed-/, "").replace(/\.json$/, "");
      try {
        map.set(String(tid), JSON.parse(await readFile(join(dir, name), "utf8")));
      } catch { /* skip */ }
    }
  }
  return map;
}

async function loadPptCardBodies(root, today) {
  const dir = join(root, "ppt-raw-private", today);
  if (!existsSync(dir)) return [];
  const names = await readdir(dir);
  const out = [];
  for (const name of names) {
    if (!name.startsWith("set-") || !name.endsWith(".json")) continue;
    try { out.push(JSON.parse(await readFile(join(dir, name), "utf8"))); } catch { /* skip */ }
  }
  return out;
}

export async function writeComparison({ root = ROOT, rawDir, today, tcgcsv, usage }) {
  const pppSealed = await loadTodayPulls(rawDir, "sealed-");
  const pppCards = await loadTodayPulls(rawDir, "card-");
  const compared = comparePulls({
    pppSealed,
    pppCards,
    tcgcsvByTid: tcgcsvIndex(tcgcsv),
    pptSealedByTid: await loadPptSealed(root, today),
    pptCardBodies: await loadPptCardBodies(root, today),
  });
  const privateReport = {
    asOf: today,
    note: "Private comparison. Contains dollar prices. Do not copy into the public repo.",
    counts: {
      pppSealed: pppSealed.length,
      pppCards: pppCards.length,
    },
    sealedVsTcgcsv: compared.sealedVsTcgcsv,
    sealedVsPpt: compared.sealedVsPpt,
    singlesVsTcgcsv: compared.singlesVsTcgcsv,
    singlesVsPpt: compared.singlesVsPpt,
  };
  const publicCompare = {
    asOf: today,
    note: compared.public.note,
    sealed: compared.public.sealed,
    singles: compared.public.singles,
  };
  if (rawDir) {
    await mkdir(join(rawDir, ".."), { recursive: true });
    await writeFile(join(root, "ppp-raw-private", `compare-${today}.json`), `${JSON.stringify(privateReport)}\n`);
  }
  if (usage) usage.compare = publicCompare;
  return { privateReport, publicCompare };
}

export async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const key = process.env.PKMNPRICES_API_KEY || "";
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  const { sealed, singles, tcgcsv } = await loadQueue();
  let spentToday = 0;
  try {
    spentToday = spentEarlierToday(JSON.parse(await readFile(join(ROOT, "data/meta/ppp-usage.json"), "utf8")), today);
  } catch {
    spentToday = 0;
  }
  const idMap = loadIdMap(await readJsonSafe(join(ROOT, "data/ppp-id-map.json"), {}));
  const estimate = estimateNightly({
    sealedCount: sealed.length,
    singlesCount: singles.length,
    mappedSealed: Object.keys(idMap.sealed).length,
    mappedSingles: Object.keys(idMap.cards).length,
  });
  const budget = Math.max(0, MAIN_BUDGET - spentToday);
  const usage = usageSkeleton(estimate, {
    asOf: today,
    status: key ? "ran" : "skipped",
    reason: key
      ? "Key was present. credits.used is this run only, as x-credits-charged reported it. credits.usedToday adds earlier runs on the same UTC day. credits.remaining is the daily budget minus usedToday, worked out here, because x-credits-remaining can lag."
      : "PKMNPRICES_API_KEY is not set. No request was sent.",
  });
  usage.raw = "not fetched";
  usage.credits.usedToday = spentToday;
  usage.credits.remaining = Math.max(0, DAILY_CREDITS - spentToday);
  const cursorPath = join(ROOT, "data/meta/ppp-cursor.json");
  const datesPath = join(ROOT, "ppp-raw-private/refresh-dates.json");
  const mapPath = join(ROOT, "data/ppp-id-map.json");
  let cursor = { done: [] };
  if (existsSync(cursorPath)) {
    try { cursor = JSON.parse(await readFile(cursorPath, "utf8")); } catch { cursor = { done: [] }; }
  }
  let dates = {};
  let emptyIds = {};
  let failedIds = {};
  if (existsSync(datesPath)) {
    try {
      const saved = JSON.parse(await readFile(datesPath, "utf8"));
      dates = saved.dates && typeof saved.dates === "object" ? saved.dates : {};
      emptyIds = saved.emptyIds && typeof saved.emptyIds === "object" ? saved.emptyIds : {};
      failedIds = saved.failedIds && typeof saved.failedIds === "object" ? saved.failedIds : {};
    } catch { dates = {}; emptyIds = {}; failedIds = {}; }
  }
  const persistState = async (next) => {
    await mkdir(join(ROOT, "data/meta"), { recursive: true });
    if (next.dates) {
      await mkdir(join(ROOT, "ppp-raw-private"), { recursive: true });
      await writeFile(datesPath, `${JSON.stringify(next.dates, null, 2)}\n`);
    }
    if (next.cursor) await writeFile(cursorPath, `${JSON.stringify(next.cursor, null, 2)}\n`);
    if (next.map) await writeFile(mapPath, `${JSON.stringify(publicIdMap({ ...next.map, asOf: today }), null, 2)}\n`);
  };
  if (key) {
    const stats = { rateLimits: 0 };
    const rawDir = join(ROOT, "ppp-raw-private", today);
    const wanted = callsFor({ sealed, singles, idMap, dates });
    const afterEmpty = skipRecent(wanted, emptyIds, today);
    const afterFail = skipRecent(afterEmpty.calls, failedIds, today);
    const calls = orderRefreshCalls(afterFail.calls);
    const alreadyDone = resumeIds(cursor, calls.map((call) => call.id), today);
    let progressWrites = 0;
    const ran = await executePlan({
      key,
      calls,
      fetchImpl: (url, oneKey) => defaultFetch(url, oneKey, stats),
      reserve: pppLimiter(),
      rawDir,
      secrets: [token],
      alreadyDone,
      budget,
      idMap,
      onProgress: async ({ done, map }) => {
        progressWrites += 1;
        if (progressWrites % 25 !== 0) return;
        await persistState({
          cursor: { asOf: today, done: [...new Set([...alreadyDone, ...done])], advanced: done.length > 0, note: "Resume point. Ids only. Not a price." },
          map,
        });
      },
    });
    usage.credits.used = ran.used;
    usage.credits.usedToday = spentToday + ran.used.total;
    usage.credits.remaining = Math.max(0, DAILY_CREDITS - usage.credits.usedToday);
    usage.credits.usedThisRun = ran.used.total;
    usage.items = { sealed: ran.items.sealed, singles: ran.items.singles };
    usage.errors = ran.errors;
    usage.run = {
      creditsUsed: ran.used.total,
      itemsDone: ran.items.sealed + ran.items.singles,
      itemsFailed: ran.httpFailed,
      itemsBudgetSkipped: ran.budgetSkipped,
      itemsSkipped: ran.skipped,
      callsSent: ran.callsSent,
      callsFailed: ran.callsFailed,
      callsNotSent: ran.callsNotSent,
      rateLimitCount: ran.rateLimits + stats.rateLimits,
      retries: ran.retries + stats.rateLimits,
    };
    usage.raw = "private repo catchem-data-private";
    usage.rawNote = token
      ? "PRIVATE_DATA_TOKEN is set. Raw is written under ppp-raw-private and pushed to the private repo. It is not committed here."
      : "PRIVATE_DATA_TOKEN is not set. Raw was not pushed and is not committed here.";
    const nextDates = { ...(dates || {}) };
    for (const id of ran.done) {
      if (id.startsWith("sealed-") && !id.startsWith("sealed-lookup-")) nextDates[id] = today;
      if (id.startsWith("card-") && !id.startsWith("card-lookup-")) nextDates[id] = today;
    }
    const nextEmpty = nextMarked(emptyIds, { done: ran.done, found: ran.empty, today });
    const nextFailed = nextMarked(failedIds, { done: ran.done, found: ran.failedIds, today });
    usage.emptyIds = {
      skippedToday: afterEmpty.skipped.length,
      foundEmptyToday: ran.empty.length,
      marked: Object.keys(nextEmpty).length,
      recheckDays: 7,
      note: "Lookups PPP answered with no unique product. Skipped until a week has passed, then asked once more.",
    };
    usage.failedIds = {
      skippedToday: afterFail.skipped.length,
      foundToday: ran.failedIds.length,
      marked: Object.keys(nextFailed).length,
      recheckDays: 7,
      note: "Ids PPP rejected with a 4xx. Skipped for a week, then asked once more. Rate limits are not cached. Successes stay on the cursor.",
    };
    cursor = {
      asOf: today,
      done: [...new Set([...alreadyDone, ...ran.done])],
      advanced: ran.done.length > 0,
      note: "Resume point. Ids only. Not a price.",
    };
    await persistState({
      cursor,
      dates: { asOf: today, dates: nextDates, emptyIds: nextEmpty, failedIds: nextFailed },
      map: ran.idMap,
    });
    try {
      await writeComparison({ root: ROOT, rawDir, today, tcgcsv, usage });
    } catch (err) {
      console.error(`ppp-compare skipped: ${redact(err.message, [key, token])}`);
    }
  } else {
    await persistState({
      cursor: { asOf: today, done: Array.isArray(cursor.done) ? cursor.done : [], advanced: false, note: "Resume point. Ids only. Not a price." },
      map: idMap,
    });
  }
  const meta = join(ROOT, "data/meta");
  await mkdir(meta, { recursive: true });
  await writeFile(join(meta, "ppp-usage.json"), `${JSON.stringify(usage, null, 2)}\n`);
  if (key) {
    console.log(`ppp-refresh ${usage.status} credits=${usage.credits.used.total} sealedQueued=${sealed.length} singles=${singles.length}`);
  } else {
    console.log("ppp-refresh skipped PKMNPRICES_API_KEY is not set. No request was sent.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    const key = process.env.PKMNPRICES_API_KEY || "";
    console.error(`ppp-refresh failed: ${redact(err.message, [key, process.env.PRIVATE_DATA_TOKEN || ""])}`);
    process.exitCode = 1;
  });
}
