// enrich-by-set.mjs — enrichment at catalogue scale, priced properly.
//
// WHY THIS EXISTS ALONGSIDE fetch-singles-enrichment.mjs (which it does not
// replace): that script searches the provider BY NAME and then picks the right
// variant out of the results by card number. That works, and for a handful of
// watchlist cards it is the right tool. But it costs
// limit x (1 + includeHistory + includeEbay) = 20 x 3 = SIXTY credits per card,
// because credits bill on the REQUESTED limit and nineteen of the twenty
// results are discarded after the match.
//
// Sixty credits a card makes 6,000 cards cost 360,000 — eighteen days of a
// 20,000/day budget. And the obvious "fix" is a trap: dropping to limit=1
// returns the top NAME match, which for most cards is the wrong variant, so it
// would not save credits, it would write no-match over working data. (I
// recommended exactly that in a report on 2026-08-22 and was wrong.)
//
// The cheap path is a different QUERY. fetchAllInSet returns every card in a
// set in one response, billed ONCE at set-size x per-card cost, with the
// per-request caps not applying — and no name matching at all, because every
// card arrives with its own number. Measured against our catalogue: the densest
// sets give 5,993 cards including 4,027 of the top 6,000 by value for 17,979
// credits in 130 calls, versus 360,000 for the same coverage by name search.
//
// It also returns tcgPlayerId for every card. We hold ids for 12 of 16,468
// today, which is precisely WHY enrichment has to search by name. After one
// pass, every later refresh is a precise 3-credit lookup instead of a 60-credit
// search — the first pass is what makes all the later ones cheap.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv, requireKey } from "./lib/load-env.mjs";

loadEnv();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT, p), "utf-8"));
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;

// Node's fetch has NO default timeout; a host that accepts and never answers
// would hang this until the runner kills it.
const FETCH_TIMEOUT_MS = 30000;

// THE HARD CEILING. This is the one guard that matters here: a bug in the set
// loop spends real money-equivalent budget, and the daily pool does not reset
// until 00:00 UTC. It stops BEFORE a call it cannot afford rather than after,
// because the provider bills on the requested size, not on what we keep.
const CREDIT_CEILING = Number(process.env.ENRICH_CREDIT_CEILING || 17979);
const HISTORY_DAYS = Number(process.env.ENRICH_HISTORY_DAYS || 180);
const PER_CARD_COST = 3; // 1 basic + 1 includeHistory + 1 includeEbay

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── THE MINUTE BUDGET IS IN UNITS, NOT CALLS ───────────────────────────────
// The first run of this script paced one call per second and still took a 429
// (per_minute) after 31 calls, stopping at 9,114 of its 17,979-credit ceiling.
// The bug was mine: "60 calls/minute" is not the rule for THIS query. A
// fetchAllInSet request costs min(30, ceil(cards/10)) units of the 60-unit
// minute budget, because it returns a whole set. Our sets average ~28 cards,
// so each call cost ~3 units — a real ceiling near 20 calls a minute, and one
// call per second overruns it three times over.
//
// So the pace cannot be a constant. It has to be a rolling-window reservation
// priced per set: a 500-card set costs 30 units (half the minute) and a
// 12-card set costs 2, and sleeping a flat second between them is either
// wasteful or a 429 depending on which one comes next.
const MINUTE_UNITS = Number(process.env.ENRICH_MINUTE_UNITS || 60);
const unitsFor = cards => Math.min(30, Math.ceil(cards / 10));
const spentWindow = []; // { at, units } for the last 60s

async function reserve(units) {
  for (;;) {
    const now = Date.now();
    while (spentWindow.length && now - spentWindow[0].at >= 60000) spentWindow.shift();
    const used = spentWindow.reduce((a, w) => a + w.units, 0);
    if (used + units <= MINUTE_UNITS) { spentWindow.push({ at: now, units }); return; }
    // Wait exactly until the oldest reservation ages out of the window, plus a
    // small margin for clock skew between us and the provider.
    await sleep(60000 - (now - spentWindow[0].at) + 250);
  }
}

async function getJSON(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (r.status === 429) {
    // The body says WHICH limit was hit, and they clear on completely
    // different clocks: per_minute in seconds, daily not until 00:00 UTC.
    const body = await r.json().catch(() => ({}));
    const wait = Number(r.headers.get("retry-after") || body.retryAfter || 60);
    return { rateLimited: true, limitType: body.limitType || "unknown", retryAfter: wait };
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function planOnly() {
  const cat = await J("data/card-catalogue.json");
  // The set map is not optional. Requesting a set by our own slug is silently
  // ignored by the provider and billed anyway — that is exactly how the first
  // run spent 9,114 credits and returned five sets it never asked for.
  const map = await J("data/ppt-set-map.json").catch(() => null);
  const bySet = {};
  for (const c of Object.values(cat.cards)) if (c.setId) bySet[c.setId] = (bySet[c.setId] || 0) + 1;
  const priced = Object.entries(cat.cards).filter(([, c]) => c.price != null)
    .sort((a, b) => b[1].price - a[1].price);
  const top = new Set(priced.slice(0, 6000).map(([id]) => id));
  const topPerSet = {};
  for (const [id, c] of Object.entries(cat.cards)) if (top.has(id)) topPerSet[c.setId] = (topPerSet[c.setId] || 0) + 1;
  // Rank by top-6000 cards bought per credit spent: the densest value first, so
  // a ceiling that stops early still stops on the best sets.
  return Object.entries(bySet)
    .map(([setId, cards]) => {
      const m = map?.bySlug?.[setId];
      // Prefer the PROVIDER's card count for costing — ours is what made the
      // first run's estimates wrong, and cost is billed on their set size.
      const size = m?.cardCount ?? cards;
      return { setId, pptSetId: m?.pptSetId ?? null, cards: size, ourCards: cards,
        top: topPerSet[setId] || 0, cost: size * PER_CARD_COST };
    })
    .filter(s => s.top > 0)
    .sort((a, b) => (b.top / b.cost) - (a.top / a.cost));
}

async function main() {
  if (!KEY) requireKey("POKEMONPRICETRACKER_API_KEY");
  const plan = await planOnly();

  // REFUSE TO SPEND WITHOUT THE MAP. This is the guard the first run lacked.
  const unmapped = plan.filter(s => !s.pptSetId);
  if (plan.every(s => !s.pptSetId)) {
    console.error("No data/ppt-set-map.json — every request would use our slug, which the");
    console.error("provider ignores while still billing. Run: node scripts/resolve-set-ids.mjs");
    process.exit(1);
  }
  if (unmapped.length) console.log(`skipping ${unmapped.length} sets with no provider id (they would bill and return nothing)`);

  // RESUME, don't re-buy. A set already in the file was paid for; re-fetching it
  // spends the ceiling twice for the same data. Key on the setId we REQUESTED,
  // not the one that comes back — the provider answers with its own internal id,
  // so keying on the response matched nothing and re-bought everything.
  const prior = await J("data/enrichment-by-set.json").catch(() => null);
  const out = prior?.byCard ?? {};
  const haveSets = new Set(prior?.fetchedSets ?? []);
  let spent = 0, calls = 0, cards = Object.keys(out).length;
  let stoppedBecause = "plan exhausted";
  const todo = plan.filter(s => s.pptSetId && !haveSets.has(String(s.pptSetId)));
  console.log(`plan: ${plan.length} sets · ${haveSets.size} already held · ${todo.length} to fetch`);
  console.log(`ceiling ${CREDIT_CEILING.toLocaleString("en-US")} credits · minute budget ${MINUTE_UNITS} units`);
  const fetchedSets = new Set(haveSets);
  // A call that bills and delivers nothing is the signature of the namespace
  // bug. Two in a row means stop and look, not grind through the plan.
  let emptyStreak = 0;

  for (const s of todo) {
    if (spent + s.cost > CREDIT_CEILING) { stoppedBecause = `ceiling would be exceeded by ${s.setId} (${s.cost})`; break; }
    const url = `${BASE}/cards?setId=${encodeURIComponent(s.pptSetId)}&fetchAllInSet=true`
      + `&includeHistory=true&includeEbay=true&days=${HISTORY_DAYS}`;

    let d, attempt = 0;
    for (;;) {
      await reserve(unitsFor(s.cards));
      try { d = await getJSON(url); } catch (e) { d = { error: e.message }; }
      if (!d.rateLimited) break;
      // A per-minute 429 is a PAUSE, not an ending — it clears in seconds, and
      // the previous run threw away 8,865 unspent credits by treating the two
      // limits as one. A daily 429 genuinely ends the run: it clears at 00:00
      // UTC and nothing we do here shortens that.
      if (d.limitType === "daily") { stoppedBecause = `429 (daily) — pool exhausted, resets 00:00 UTC`; break; }
      if (++attempt > 5) { stoppedBecause = `429 (${d.limitType}) survived ${attempt} waits`; break; }
      console.log(`  ⏸ 429 (${d.limitType}) — waiting ${d.retryAfter}s, then resuming`);
      spentWindow.length = 0; // the provider's window is evidently ahead of ours
      await sleep((d.retryAfter + 1) * 1000);
    }
    if (d?.rateLimited) break;
    if (d?.error) { console.log(`  ${s.setId}: ${d.error}`); continue; }

    // Trust the REPORTED charge over the estimate — the estimate is arithmetic,
    // this is what was actually billed.
    const billed = d.metadata?.apiCallsConsumed?.total ?? s.cost;
    spent += billed; calls++;
    let got = 0;
    for (const c of d.data || []) { if (!out[c.id || c.tcgPlayerId]) cards++; out[c.id || c.tcgPlayerId] = c; got++; }
    fetchedSets.add(String(s.pptSetId));
    console.log(`  ${s.setId.padEnd(12)}→${String(s.pptSetId).padEnd(7)} ${String(got).padStart(4)} cards · ${String(unitsFor(s.cards)).padStart(2)}u · billed ${String(billed).padStart(5)} · running ${spent.toLocaleString("en-US")}`);

    // Billed and empty. The first run did this 26 times without noticing.
    if (got === 0) {
      if (++emptyStreak >= 2) {
        stoppedBecause = `two consecutive calls billed and returned no cards — stopping before this repeats 26 times`;
        break;
      }
    } else emptyStreak = 0;
  }
  await writeFile(join(ROOT, "data/enrichment-by-set.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), creditsSpent: spent,
      creditsSpentCumulative: (prior?.creditsSpentCumulative ?? prior?.creditsSpent ?? 0) + spent,
      calls, cards, ceiling: CREDIT_CEILING, historyDays: HISTORY_DAYS, stoppedBecause,
      fetchedSets: [...fetchedSets], byCard: out }, null, 1) + "\n");
  console.log(`\n✓ ${cards.toLocaleString("en-US")} cards · ${calls} calls · ${spent.toLocaleString("en-US")} credits of ${CREDIT_CEILING.toLocaleString("en-US")} · ${stoppedBecause}`);

  // Distil immediately. The raw file is gitignored and ~200 KB per card-set;
  // nothing downstream should ever read it, so leaving the run without a fresh
  // distilled file is leaving the instruments on stale data.
  const { distil } = await import("./distil-enrichment.mjs");
  const dist = await distil();
  await writeFile(join(ROOT, "data/enrichment-distilled.json"), JSON.stringify(dist, null, 1) + "\n");
  console.log(`✓ distilled → data/enrichment-distilled.json (${dist.cardCount.toLocaleString("en-US")} cards)`);
}

// argv[1] is undefined under `node -e`, and pathToFileURL(undefined) throws —
// so this guard has to check before it converts, or importing planOnly from
// another process crashes the import rather than skipping the CLI block.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--plan") {
    const plan = await planOnly();
    const total = plan.reduce((a, s) => a + s.cost, 0);
    const mapped = plan.filter(s => s.pptSetId);
    let run = 0, sets = 0, cards = 0, top = 0, units = 0;
    for (const s of mapped) {
      if (run + s.cost > CREDIT_CEILING) continue;
      run += s.cost; sets++; cards += s.cards; top += s.top; units += unitsFor(s.cards);
    }
    const prior = await J("data/enrichment-by-set.json").catch(() => null);
    const held = new Set(prior?.fetchedSets ?? []);
    console.log(`DRY RUN — no calls made, no credits spent`);
    console.log(`  whole plan     : ${plan.length} sets · ${total.toLocaleString("en-US")} credits`);
    console.log(`  provider ids   : ${mapped.length} of ${plan.length} mapped` +
      (mapped.length ? "" : "  ← RUN scripts/resolve-set-ids.mjs FIRST, or every call bills and returns nothing"));
    console.log(`  under ceiling  : ${sets} sets · ${cards.toLocaleString("en-US")} cards · ${top.toLocaleString("en-US")} of the top 6,000 · ${run.toLocaleString("en-US")} credits`);
    // Wall clock is set by the MINUTE-UNIT budget, not by a per-call delay:
    // each set costs min(30, ceil(cards/10)) of 60 units a minute.
    console.log(`  minute units   : ${units.toLocaleString("en-US")} at ${MINUTE_UNITS}/min = ~${Math.ceil(units / MINUTE_UNITS)} min`);
    console.log(`  already held   : ${held.size} sets — a resume skips these and re-buys nothing`);
  } else await main();
}
