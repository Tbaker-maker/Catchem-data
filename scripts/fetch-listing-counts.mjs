// Nightly listing counts for sealed products and singles that the sealed
// price step does not cover. One eBay Browse call per item, same filters every
// night. Plans to config/api-budgets.json useShare (98%) of the daily Browse allowance minus the sealed step and
// stops at the first 429. Public wording: "listings counted", never "supply".
//
// A private per-day call budget (catchem-data-private, ebay-browse/limits.json)
// is an earlier stop so the run does not spend the public ceiling. If that
// file or key is missing, no listing calls are made and last-good rows keep
// their date. The reserve number is not stored here.
//
//   data/derived/listing-counts/latest.json            one row per item, last good read
//   data/derived/listing-counts/history/<day>.json.gz  tonight's reads
//   data/derived/listing-counts/state.json             last refresh day per id
//   data/derived/listing-counts/api-usage.json         calls per night
// Runs at the end of fetch-sealed-prices.mjs (same eBay env); data/derived/ is
// already in the nightly commit, so the workflow file is unchanged.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tiers, pickRun, roleSlice, missingTop, ptDate, listingFileDay, mergeDayRows, used24, nightlyBudget, buildQuery, summarize, EBAY_BROWSE_DAILY_LIMIT, TAIL_FLOOR, RUNS_PER_DAY, applyTotalCaps, vintageHeldBack } from "./lib/listing-counts.mjs";
import { browseCallsLeft, countWithinBudget, loadBrowseReserve } from "./lib/ebay-browse-budget.mjs";
import { browseBudgetAlert, mergeAlerts } from "./lib/limits-watch.mjs";
import { addMissingRows, sealedStepIndex, sealedStepRowsForDay } from "./lib/sealed-listing-coverage.mjs";
import { readdir } from "node:fs/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OAUTH = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const CAT = { sealed: "2536", single: "183454" };
const COND = { sealed: "1000", single: "4000" }; // New / Ungraded
const CONCURRENCY = 3;
const DELAY_MS = 250;
const J = async (p, d) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function addStatusAlert(line) {
  if (!line) return;
  console.log(line);
  const statusPath = join(ROOT, "data/derived/status.json");
  const status = await J(statusPath, null);
  if (!status || typeof status !== "object" || Array.isArray(status)) return;
  status.alerts = mergeAlerts(status.alerts, [line]);
  await writeFile(statusPath, JSON.stringify(status, null, 1) + "\n");
}

async function token() {
  const { EBAY_APP_ID: a, EBAY_CERT_ID: c } = process.env;
  if (!a || !c) return null;
  const res = await fetch(OAUTH, { method: "POST", signal: AbortSignal.timeout(30000), headers: { Authorization: `Basic ${Buffer.from(`${a}:${c}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope" });
  if (!res.ok) throw new Error(`OAuth ${res.status}`);
  return (await res.json()).access_token;
}

export async function runListingCounts({ afterSealedStep = false, now = new Date() } = {}) {
  const catalog = await J(join(ROOT, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const today = listingFileDay(now);
  const products = await J(join(ROOT, "data/sealed-products.json"), []);
  const priced = products.filter((p) => p.ebay !== false && p.searchQuery);
  const skipIds = new Set(priced.map((p) => String(p.tcgPlayerId)).filter(Boolean));
  const queryById = new Map(products.filter((p) => p.tcgPlayerId).map((p) => [String(p.tcgPlayerId), p.searchQuery || null]));
  const items = (catalog.items || []).map((it) => (it.kind === "sealed" && queryById.get(String(it.tcgplayerProductId)) ? { ...it, searchQuery: queryById.get(String(it.tcgplayerProductId)) } : it));
  const attention = new Set();
  for (const f of ["hype-effect-single.json", "crowded-calls-single.json"]) {
    for (const r of (await J(join(ROOT, "data/derived", f), {})).items || []) if (r.id || r.cardId) attention.add(r.id || r.cardId);
  }
  const statePath = join(ROOT, "data/derived/listing-counts/state.json");
  const state = await J(statePath, { last: {} });
  state.last ||= {}; state.log ||= [];
  const cfg = (await J(join(ROOT, "config/api-budgets.json"), {})).ebayBrowse || {};
  const b = nightlyBudget({ sealedPriced: priced.length, limit: Number(process.env.EBAY_BROWSE_DAILY_LIMIT) || cfg.dailyLimit || EBAY_BROWSE_DAILY_LIMIT, share: cfg.useShare });
  // The nightly sealed step spends its calls before this runs; log its upper
  // bound on the shared rolling counter.
  if (afterSealedStep) state.log.push({ at: now.toISOString(), n: b.sealedStep, source: "sealed-price-step" });
  state.log = state.log.filter((e) => Date.parse(e.at) > now.getTime() - 2 * 86400000);
  const used = used24(state.log, now);
  // Until .github/workflows/listing-counts.yml exists, the nightly is the only
  // run, so it spends the whole day's listing budget.
  const scheduled = await readFile(join(ROOT, ".github/workflows/listing-counts.yml"), "utf8").then(() => true, () => false);
  const runsPerDay = scheduled ? cfg.runsPerDay || RUNS_PER_DAY : 1;
  // Role: "full" (morning and evening) or "top" (midday, and the nightly after
  // the sealed step: daily-tier retries only). Unscheduled repo: one full run.
  const role = afterSealedStep ? "guardian" : (process.env.LISTING_RUN_ROLE || "full");
  const tierPlan = tiers({ items, skipIds, attention, dailyBudget: b.budget, tailFloor: cfg.tailFloor ?? TAIL_FLOOR });
  const sealedInWindow = afterSealedStep || state.log.some((e) => e.source === "sealed-price-step" && Date.parse(e.at) > now.getTime() - 86400000);
  const holdBack = vintageHeldBack(state.log, now);
  const slice = Math.min(Number(process.env.LISTING_COUNT_BUDGET) || Infinity,
    runsPerDay === 1 ? Math.max(0, b.safe - used - holdBack) : roleSlice({ role, safe: b.safe, used, dailyBudget: b.budget, sealedStep: b.sealedStep, sealedInWindow, topShare: cfg.topShare, holdBack }));
  const wanted = pickRun({ daily: tierPlan.daily, tail: tierPlan.tail, last: state.last, now, slice: Math.max(0, slice - 1), role });
  // Private reserve is an earlier stop on the same rolling window. It is not logged.
  const reserve = await loadBrowseReserve({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" });
  const privateLeft = browseCallsLeft({ reserve, used });
  const searchBudget = reserve == null ? null : Math.min(wanted.length, Math.max(0, Math.min(slice, privateLeft) - 1));
  const heldByReserve = reserve == null || (wanted.length > 0 && searchBudget < wanted.length);
  const plan = { picked: heldByReserve ? [] : wanted, poolSize: tierPlan.daily.length + tierPlan.tail.length, perNightNeed: tierPlan.daily.length, cycleNights: tierPlan.tailCycleDays };
  const runLabel = heldByReserve ? "held by the private call budget" : String(wanted.length);
  console.log(`listing counts: daily tier ${tierPlan.daily.length} (${JSON.stringify(tierPlan.counts)}, singles at or above $${tierPlan.singleCutoff}), tail ${tierPlan.tail.length} every ${tierPlan.tailCycleDays} days, used ${used}/${b.safe} in 24h, vintage hold ${holdBack}, this run ${runLabel}${reserve == null ? ", private call budget missing" : ""}`);

  if (reserve == null) {
    await addStatusAlert(browseBudgetAlert("missing"));
    await indexSealedStep();
    return { picked: 0, calls: 0, callBudget: "missing" };
  }

  if (role === "guardian" && !wanted.length) {
    console.log("count guardian: every daily-tier item has a count today, nothing to do");
    await indexSealedStep();
    return { picked: 0 };
  }

  if (searchBudget <= 0 && wanted.length > 0) {
    await addStatusAlert(browseBudgetAlert("held"));
    await indexSealedStep();
    return { picked: 0, calls: 0, callBudget: "held" };
  }

  const tok = await token().catch((e) => { console.log(`listing counts: ${e.message}`); return null; });
  const latestPath = join(ROOT, "data/derived/listing-counts/latest.json");
  const latest = await J(latestPath, { rows: {} });
  latest.rows ||= {};
  let failures = 0;
  const client = async (it) => {
    const kind = it.kind === "sealed" ? "sealed" : "single";
    const params = new URLSearchParams({ q: buildQuery(it), category_ids: CAT[kind], filter: `conditionIds:{${COND[kind]}},priceCurrency:USD,itemLocationCountry:US`, limit: "50" });
    try {
      const res = await fetch(`${SEARCH}?${params}`, { signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${tok}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
      if (res.status === 429) { failures += 1; return { stop: true, fail: true }; }
      if (!res.ok) { failures += 1; return { fail: true }; }
      const d = await res.json();
      const summaries = d.itemSummaries || [];
      const row = { id: it.id, kind, tier: it.tier, date: today, ...summarize(kind, d.total, summaries.map((x) => x.title || ""), summaries, it) };
      return { row };
    } catch { failures += 1; return { fail: true }; }
    finally { await sleep(DELAY_MS); }
  };
  const counted = tok && searchBudget > 0
    ? await countWithinBudget({ ordered: wanted, budget: searchBudget, client, rows: latest.rows, today, previousAsOf: latest.asOf, concurrency: CONCURRENCY })
    : { rows: latest.rows, calls: 0, refreshed: [], alert: "", asOf: today, rateLimited: false, kind: "ok" };
  const calls = counted.calls;
  const rateLimited = counted.rateLimited;
  const capped = applyTotalCaps(counted.refreshed);
  latest.rows = { ...counted.rows };
  for (const row of capped) {
    latest.rows[row.id] = row;
    state.last[row.id] = now.toISOString();
  }
  if (counted.kind === "ok") latest.asOf = today;
  else if (counted.asOf) latest.asOf = counted.asOf;
  if (counted.alert) await addStatusAlert(counted.alert);
  latest.note = "Listings counted: eBay US listings, same filters every night (no lots, cases or graded for raw). An estimate from eBay's total and a sampled page. Not supply.";
  await mkdir(join(ROOT, "data/derived/listing-counts/history"), { recursive: true });
  await writeFile(latestPath, JSON.stringify(latest) + "\n");
  if (capped.length) {
    const historyPath = join(ROOT, `data/derived/listing-counts/history/${today}.json.gz`);
    let prev = [];
    try { prev = JSON.parse(gunzipSync(await readFile(historyPath))).rows || []; } catch { prev = []; }
    const rows = mergeDayRows(prev, capped);
    await writeFile(historyPath, gzipSync(JSON.stringify({ date: today, rows }), { level: 9 }));
  }
  if (tok) state.log.push({ at: new Date().toISOString(), n: calls + 1, source: "listing-counts" });
  await writeFile(statePath, JSON.stringify(state) + "\n");
  const usagePath = join(ROOT, "data/derived/listing-counts/api-usage.json");
  const usage = await J(usagePath, { nights: [] });
  const night = { date: today, ebayBrowse: { limit: b.limit, safe: b.safe, sealedStepMax: b.sealedStep, role, slice, listingCountCalls: calls + (tok ? 1 : 0), failures, rateLimited, counted: capped.length, pool: plan.poolSize, perNightNeed: plan.perNightNeed, cycleNights: plan.cycleNights } };
  night.at = now.toISOString(); night.ebayBrowse.used24hAfter = used24(state.log, new Date());
  const missed = missingTop(tierPlan.daily, state.last, new Date());
  night.ebayBrowse.topMissingToday = missed.length;
  night.ebayBrowse.ptDate = ptDate(new Date());
  // Daily check: the evening full run and the nightly retry are the last runs of a PT day.
  if (missed.length && (role === "top" && afterSealedStep || Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Vancouver", hour: "numeric", hourCycle: "h23" }).format(new Date())) >= 17)) {
    console.log(`listing counts: TOP ITEMS MISSING A DAY (${ptDate(new Date())}): ${missed.length}. First: ${missed.slice(0, 20).join(", ")}`);
  }
  night.ebayBrowse.dailyTier = tierPlan.counts; night.ebayBrowse.singleCutoff = tierPlan.singleCutoff;
  usage.nights = [...(usage.nights || []), night].slice(-120);
  await writeFile(usagePath, JSON.stringify(usage, null, 1) + "\n");
  await indexSealedStep();
  const tailNote = `${failures} failed${rateLimited ? ", stopped at 429" : ""}${tok ? "" : ", no eBay key"}`;
  if (counted.kind === "held") console.log(`listing counts: stopped at the private call budget, ${tailNote}`);
  else console.log(`listing counts: ${capped.length} counted, ${calls} calls, ${tailNote}`);
}

// Copy filteredTotal the sealed price step already stored. Does not call eBay
// and does not add to the Browse log. Existing listing-count rows stay.
export async function indexSealedStep() {
  const sealed = await J(join(ROOT, "data/sealed-prices.json"), { products: [] });
  const products = sealed.products || [];
  const dir = join(ROOT, "data/derived/listing-counts/history");
  await mkdir(dir, { recursive: true });
  let added = 0;
  let names = [];
  try { names = (await readdir(dir)).filter((name) => name.endsWith(".json.gz")); } catch { names = []; }
  for (const name of names) {
    const date = name.slice(0, 10);
    const path = join(dir, name);
    let blob = { date, rows: [] };
    try { blob = JSON.parse(gunzipSync(await readFile(path))); } catch { continue; }
    const prev = blob.rows || [];
    const rows = addMissingRows(prev, sealedStepRowsForDay(products, date));
    if (rows.length === prev.length) continue;
    added += rows.length - prev.length;
    await writeFile(path, gzipSync(JSON.stringify({ ...blob, date: blob.date || date, rows }), { level: 9 }));
  }
  const index = sealedStepIndex(products);
  await writeFile(join(ROOT, "data/derived/listing-counts/sealed-step.json"), JSON.stringify(index) + "\n");
  const latestPath = join(ROOT, "data/derived/listing-counts/latest.json");
  const latest = await J(latestPath, { rows: {} });
  latest.rows ||= {};
  const today = listingFileDay(new Date());
  let latestChanged = false;
  for (const row of sealedStepRowsForDay(products, today)) {
    const cur = latest.rows[row.id];
    if (!cur || String(cur.date || "") < row.date) {
      latest.rows[row.id] = row;
      latestChanged = true;
    }
  }
  if (latestChanged) await writeFile(latestPath, JSON.stringify(latest) + "\n");
  return { added, series: Object.keys(index.series).length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const job = process.argv.includes("--index-sealed-step")
    ? indexSealedStep().then((r) => console.log(`sealed-step index: ${r.series} series, ${r.added} history rows added, no eBay call`))
    : runListingCounts({ afterSealedStep: process.argv.includes("--after-sealed") });
  job.catch((e) => { console.error(`listing counts skipped: ${e.message}`); });
}
