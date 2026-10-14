// Nightly listing counts for sealed products and singles that the sealed
// price step does not cover. One eBay Browse call per item, same filters every
// night. Plans to config/api-budgets.json useShare (98%) of the daily Browse allowance minus the sealed step and
// stops at the first 429. Public wording: "listings counted", never "supply".
//
//   data/derived/listing-counts/latest.json            one row per item, last good read
//   data/derived/listing-counts/history/<day>.json.gz  tonight's reads
//   data/derived/listing-counts/state.json             last refresh day per id
//   data/derived/listing-counts/api-usage.json         calls per night
// Runs at the end of fetch-sealed-prices.mjs (same eBay env); data/derived/ is
// already in the nightly commit, so the workflow file is unchanged.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tiers, pickRun, roleSlice, missingTop, ptDate, used24, nightlyBudget, buildQuery, summarize, EBAY_BROWSE_DAILY_LIMIT, TAIL_FLOOR, RUNS_PER_DAY, applyTotalCaps } from "./lib/listing-counts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OAUTH = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const CAT = { sealed: "2536", single: "183454" };
const COND = { sealed: "1000", single: "4000" }; // New / Ungraded
const CONCURRENCY = 3;
const DELAY_MS = 250;
const J = async (p, d) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token() {
  const { EBAY_APP_ID: a, EBAY_CERT_ID: c } = process.env;
  if (!a || !c) return null;
  const res = await fetch(OAUTH, { method: "POST", signal: AbortSignal.timeout(30000), headers: { Authorization: `Basic ${Buffer.from(`${a}:${c}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope" });
  if (!res.ok) throw new Error(`OAuth ${res.status}`);
  return (await res.json()).access_token;
}

export async function runListingCounts({ afterSealedStep = false, now = new Date() } = {}) {
  const catalog = await J(join(ROOT, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const today = String(catalog.asOf || new Date().toISOString()).slice(0, 10);
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
  const role = afterSealedStep ? "top" : (process.env.LISTING_RUN_ROLE || "full");
  const tierPlan = tiers({ items, skipIds, attention, dailyBudget: b.budget, tailFloor: cfg.tailFloor ?? TAIL_FLOOR });
  const sealedInWindow = afterSealedStep || state.log.some((e) => e.source === "sealed-price-step" && Date.parse(e.at) > now.getTime() - 86400000);
  const slice = Math.min(Number(process.env.LISTING_COUNT_BUDGET) || Infinity,
    runsPerDay === 1 ? Math.max(0, b.safe - used) : roleSlice({ role, safe: b.safe, used, dailyBudget: b.budget, sealedStep: b.sealedStep, sealedInWindow, topShare: cfg.topShare }));
  const picked = pickRun({ daily: tierPlan.daily, tail: tierPlan.tail, last: state.last, now, slice: Math.max(0, slice - 1), role });
  const plan = { picked, poolSize: tierPlan.daily.length + tierPlan.tail.length, perNightNeed: tierPlan.daily.length, cycleNights: tierPlan.tailCycleDays };
  console.log(`listing counts: daily tier ${tierPlan.daily.length} (${JSON.stringify(tierPlan.counts)}, singles at or above $${tierPlan.singleCutoff}), tail ${tierPlan.tail.length} every ${tierPlan.tailCycleDays} days, used ${used}/${b.safe} in 24h, this run ${picked.length}`);

  const tok = await token().catch((e) => { console.log(`listing counts: ${e.message}`); return null; });
  const latestPath = join(ROOT, "data/derived/listing-counts/latest.json");
  const latest = await J(latestPath, { rows: {} });
  const out = [];
  let calls = 0, failures = 0, rateLimited = false;
  if (tok) {
    const queue = [...plan.picked];
    const worker = async () => {
      while (queue.length && !rateLimited) {
        const it = queue.shift();
        const kind = it.kind === "sealed" ? "sealed" : "single";
        const params = new URLSearchParams({ q: buildQuery(it), category_ids: CAT[kind], filter: `conditionIds:{${COND[kind]}},priceCurrency:USD,itemLocationCountry:US`, limit: "50" });
        calls += 1;
        try {
          const res = await fetch(`${SEARCH}?${params}`, { signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${tok}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
          if (res.status === 429) { rateLimited = true; failures += 1; break; }
          if (!res.ok) { failures += 1; continue; }
          const d = await res.json();
          const row = { id: it.id, kind, tier: it.tier, date: today, ...summarize(kind, d.total, (d.itemSummaries || []).map((x) => x.title || "")) };
          out.push(row);
          latest.rows[it.id] = row;
          state.last[it.id] = now.toISOString();
        } catch { failures += 1; }
        await sleep(DELAY_MS);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }
  const capped = applyTotalCaps(out);
  for (const row of capped) latest.rows[row.id] = row;
  latest.asOf = today;
  latest.note = "Listings counted: eBay US listings, same filters every night (no lots, cases or graded for raw). An estimate from eBay's total and a sampled page. Not supply.";
  await mkdir(join(ROOT, "data/derived/listing-counts/history"), { recursive: true });
  await writeFile(latestPath, JSON.stringify(latest) + "\n");
  if (capped.length) await writeFile(join(ROOT, `data/derived/listing-counts/history/${today}.json.gz`), gzipSync(JSON.stringify({ date: today, rows: capped }), { level: 9 }));
  if (tok) state.log.push({ at: new Date().toISOString(), n: calls + 1, source: "listing-counts" });
  await writeFile(statePath, JSON.stringify(state) + "\n");
  const usagePath = join(ROOT, "data/derived/listing-counts/api-usage.json");
  const usage = await J(usagePath, { nights: [] });
  const night = { date: today, ebayBrowse: { limit: b.limit, safe: b.safe, sealedStepMax: b.sealedStep, role, slice, listingCountCalls: calls + (tok ? 1 : 0), failures, rateLimited, counted: out.length, pool: plan.poolSize, perNightNeed: plan.perNightNeed, cycleNights: plan.cycleNights } };
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
  console.log(`listing counts: ${out.length} counted, ${calls} calls, ${failures} failed${rateLimited ? ", stopped at 429" : ""}${tok ? "" : ", no eBay key"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runListingCounts({ afterSealedStep: process.argv.includes("--after-sealed") }).catch((e) => { console.error(`listing counts skipped: ${e.message}`); });
}
