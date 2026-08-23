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
// 60 calls/minute on our tier. Prepaid credits raise the daily quota and
// explicitly NOT the burst limit, so this pace is not negotiable by spending.
const PACE_MS = Number(process.env.ENRICH_PACE_MS || 1000);
const HISTORY_DAYS = Number(process.env.ENRICH_HISTORY_DAYS || 180);
const PER_CARD_COST = 3; // 1 basic + 1 includeHistory + 1 includeEbay

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    .map(([setId, cards]) => ({ setId, cards, top: topPerSet[setId] || 0, cost: cards * PER_CARD_COST }))
    .filter(s => s.top > 0)
    .sort((a, b) => (b.top / b.cost) - (a.top / a.cost));
}

async function main() {
  if (!KEY) { console.error("Missing POKEMONPRICETRACKER_API_KEY"); process.exit(1); }
  const plan = await planOnly();
  const out = {}; let spent = 0, calls = 0, cards = 0, stoppedBecause = "plan exhausted";
  console.log(`plan: ${plan.length} sets · ceiling ${CREDIT_CEILING.toLocaleString("en-US")} credits · pace ${PACE_MS}ms`);

  for (const s of plan) {
    if (spent + s.cost > CREDIT_CEILING) { stoppedBecause = `ceiling would be exceeded by ${s.setId} (${s.cost})`; break; }
    const url = `${BASE}/cards?setId=${encodeURIComponent(s.setId)}&fetchAllInSet=true`
      + `&includeHistory=true&includeEbay=true&days=${HISTORY_DAYS}`;
    let d;
    try { d = await getJSON(url); } catch (e) { console.log(`  ${s.setId}: ${e.message}`); await sleep(PACE_MS); continue; }
    if (d.rateLimited) { stoppedBecause = `429 (${d.limitType}), retry after ${d.retryAfter}s`; break; }
    // Trust the REPORTED charge over the estimate — the estimate is arithmetic,
    // this is what was actually billed.
    const billed = d.metadata?.apiCallsConsumed?.total ?? s.cost;
    spent += billed; calls++;
    for (const c of d.data || []) { out[c.id || c.tcgPlayerId] = c; cards++; }
    console.log(`  ${s.setId.padEnd(12)} ${String((d.data || []).length).padStart(4)} cards · billed ${String(billed).padStart(5)} · running ${spent.toLocaleString("en-US")}`);
    await sleep(PACE_MS);
  }
  await writeFile(join(ROOT, "data/enrichment-by-set.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), creditsSpent: spent, calls, cards,
      ceiling: CREDIT_CEILING, historyDays: HISTORY_DAYS, stoppedBecause, cards_: undefined, byCard: out }, null, 1) + "\n");
  console.log(`\n✓ ${cards.toLocaleString("en-US")} cards · ${calls} calls · ${spent.toLocaleString("en-US")} credits of ${CREDIT_CEILING.toLocaleString("en-US")} · ${stoppedBecause}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--plan") {
    const plan = await planOnly();
    const total = plan.reduce((a, s) => a + s.cost, 0);
    let run = 0, sets = 0, cards = 0, top = 0;
    for (const s of plan) { if (run + s.cost > CREDIT_CEILING) continue; run += s.cost; sets++; cards += s.cards; top += s.top; }
    console.log(`DRY RUN — no calls made, no credits spent`);
    console.log(`  whole plan     : ${plan.length} sets · ${total.toLocaleString("en-US")} credits`);
    console.log(`  under ceiling  : ${sets} sets · ${cards.toLocaleString("en-US")} cards · ${top.toLocaleString("en-US")} of the top 6,000 · ${run.toLocaleString("en-US")} credits`);
    console.log(`  calls          : ${sets} at ${PACE_MS}ms = ~${Math.ceil(sets * PACE_MS / 60000)} min (cap is 60/min)`);
  } else await main();
}
