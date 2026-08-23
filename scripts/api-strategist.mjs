// api-strategist.mjs — are we using what we already pay for?
//
// THE QUESTION IT EXISTS TO ANSWER: not "what could we buy" but "what is
// already arriving that we throw away". Every response we receive is fully paid
// for the moment it lands. A field we ignore cost exactly as much as a field we
// use, and unused fields are the cheapest capability in any system — no new
// spend, no new integration, no new dependency, just noticing.
//
// It found the answer immediately on our own data: PPT returns `vol30` (actual
// 30-day sales volume) and `ebaySold.psa8/9/10` (graded sold prices) on cards we
// already fetch. Volume is DEMAND MEASURED DIRECTLY, and every instrument we own
// reads listings — asks — and infers demand from them. Graded sold prices are
// the feed we have spent weeks saying we do not have.
//
// BLIND SPOTS, declared per the Domain Competence Law: chat cannot reach the
// provider's docs or make a live call. Everything here is read from responses we
// have already stored. It can tell you what arrived; it cannot tell you what
// else the endpoint would return if asked differently. That question routes to
// whoever has a key.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return ""; } };

const findings = [];
const F = (severity, what, why, action, owner) => findings.push({ severity, what, why, action, owner });

// Every field name that appears anywhere in our own source, so "used" means
// genuinely referenced rather than merely stored.
const scripts = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
const allSrc = (await Promise.all(scripts.map(f => R(`scripts/${f}`)))).join("\n");
const app = await R("../catchem-app/src/Ticker.jsx");
const FETCHERS = /^fetch-|^ingest-/;
const downstream = (await Promise.all(scripts.filter(f => !FETCHERS.test(f) && f !== "api-strategist.mjs").map(f => R(`scripts/${f}`)))).join("\n") + app;
// A field is USED only if something that does not fetch it also reads it.
const used = (field) => new RegExp(`\\b${field}\\b`).test(downstream);

// ── 1 · WHAT ARRIVES AND IS NEVER READ ─────────────────────────────────────
{
  const enrich = await J("data/singles-enrichment.json");
  const row = (enrich?.cards ?? enrich?.rows ?? [])[0];
  if (row) {
    // Value judgments are stated, not implied — each one is arguable and should be.
    const WORTH = {
      vol30: { v: "critical", why: "actual 30-day sales VOLUME. Every instrument we own reads listings — asks — and infers demand from them. This is demand measured directly, and no competitor publishes it." },
      recentSales: { v: "critical", why: "what things actually SOLD for. We currently compare asks to prices and label the mismatch; sales would let us report the transaction instead of the intention." },
      sellers: { v: "high", why: "how many distinct sellers, not just how many listings. One seller with forty listings is a very different market from forty sellers with one each, and listing count cannot tell them apart." },
      listings: { v: "medium", why: "TCGplayer listing depth — the number we said we could not get, sitting in a response we already receive." },
      low: { v: "medium", why: "the floor beneath the market price, which is the number a buyer actually chases." },
      psa10: { v: "critical", why: "graded sold prices. This is the licensed graded feed we have spent weeks recording as unavailable, and it may already be in our hands." },
      psa9: { v: "critical", why: "the other half of the PSA-9 tax thesis (RT-5), which is currently INSUFFICIENT for want of exactly this." },
    };
    // psa8/9/10 are OBJECTS, and the original walk only inspected scalars - so
    // the most valuable finding in the system was invisible to the agent built
    // to find it. Inspect a block by its own key, not only by its leaves.
    const scan = (obj, path = "") => {
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const w0 = WORTH[k];
          if (w0 && !used(k) && Object.keys(v).length)
            F(w0.v, `${path ? path + "." : ""}${k} arrives populated and is never read`, w0.why,
              "wire it through - the call is already made and the data already paid for", "chat");
          scan(v, path ? `${path}.${k}` : k); continue;
        }
        const w = WORTH[k];
        if (w && !used(k))
          F(w.v, `${path ? path + "." : ""}${k} arrives on every card and is never read`, w.why,
            "wire it through — the call is already being made and the data is already being paid for", "chat");
      }
    };
    scan(row);
  }
}

// ── 2 · ENDPOINTS WE KNOW EXIST AND HAVE NEVER ENUMERATED ──────────────────
{
  const endpoints = [...new Set([...allSrc.matchAll(/BASE\s*\+\s*"(\/[a-z-]+)|BASE\}(\/[a-z-]+)/g)].map(m => m[1] || m[2]))];
  for (const e of endpoints) {
    // Queried BY NAME for things we already chose is not the same as knowing
    // what the endpoint contains.
    const enumerated = new RegExp(`${e.replace("/", "")}\\?[^"']*(page|limit=\\d{3,}|offset)`).test(allSrc);
    if (!enumerated)
      F("high", `${e} is only ever queried by name`, 
        "We ask it about products we already picked from somewhere else, so our universe is bounded by a list we wrote by hand rather than by what the provider actually holds.",
        "page through it once and count what is there — the answer changes what is possible, not just what is convenient", "cc");
  }
}

// ── 3 · CALL EFFICIENCY: are we asking one at a time for things we could batch?
{
  const perItemLoops = (allSrc.match(/for \(const [^)]+\) \{[\s\S]{0,400}?await fetch/g) ?? []).length;
  if (perItemLoops >= 2)
    F("medium", `${perItemLoops} places fetch one item at a time inside a loop`,
      "If any of those endpoints accept a batch or a set filter, we are spending N calls where one would do — and call budget is the thing that decides how much of the market we can see.",
      "check whether each endpoint supports a set, page or id-list parameter before scaling the loop up", "cc");
}

// ── 4 · WHAT WE PAY FOR AND DO NOT TOUCH AT ALL ────────────────────────────
{
  const tiers = { free: ["pokemontcg.io"], paid: ["pokemonpricetracker"] };
  for (const host of tiers.paid) {
    const callers = scripts.filter(f => allSrc.includes(host) && (allSrc.split(f)[0] ?? "").length >= 0);
    F("medium", `the paid provider is called from ${scripts.filter(async f => (await R(`scripts/${f}`)).includes(host)).length || "few"} places`,
      "A paid tier justifies itself by what it uniquely provides. If the only thing we take from it is a price we could get free elsewhere, we are paying for a duplicate.",
      "list what ONLY the paid provider gives us; if that list is short, either use more of it or stop paying for it", "tyler");
  }
}

// ── 5 · HOW SHOULD THE BUDGET ACTUALLY BE SPENT? ───────────────────────────
// Finding unused fields is half the job. The other half is saying what to do
// with the room they free. This ranks candidate spends by what each buys that
// we cannot currently do at all - capability first, coverage second, because a
// wider version of something we already have is worth less than the first
// version of something we have none of.
const allocation = [];
{
  const cat = await J("data/card-catalogue.json") ?? { cards: {} };
  const enrich = await J("data/singles-enrichment.json") ?? {};
  const sp = await J("data/sealed-prices.json") ?? { products: [] };
  const enriched = (enrich.cards ?? enrich.rows ?? []).length;
  const catalogue = Object.keys(cat.cards).length;
  const priced = Object.values(cat.cards).filter(c => typeof c.price === "number" && c.price >= 2).length;

  // SPEND IT. An earlier version of this held ~11,000 calls a day in reserve
  // for no stated reason, and Tyler asked the obvious question: why save so
  // many? Every candidate reason was tested and only one survived - retries and
  // failures, which needs 10%, not 55%.
  //
  // Rate limiting is a real risk but the mitigation is PACING, not
  // underspending: 20,000 calls at 60ms apart is twenty minutes inside a job
  // that may run for six hours. Runtime is not a constraint either.
  //
  // UNSPENT CALLS DO NOT ROLL OVER. They evaporate at midnight. A budget held
  // back is not saved, it is destroyed - and every day at half utilisation is
  // half a day of capability nobody chose to decline, they just never allocated.
  const BUDGET = 20000;
  const RETRY_RESERVE = 0.10;
  const USABLE = Math.round(BUDGET * (1 - RETRY_RESERVE));
  const cardRefresh = Math.round(priced * 0.75 + (catalogue - priced) * 0.33);
  const sealedRefresh = sp.products.length;
  const spare = USABLE - cardRefresh - sealedRefresh;

  allocation.push({
    rank: 1, spend: "ENRICHMENT on the top few thousand cards",
    callsPerDay: Math.min(spare, 6000),   // enrichment on ~6,000 cards, not 3,000 - it is the highest-capability spend we have
    haveNow: `${enriched} cards (${(enriched / catalogue * 100).toFixed(2)}% of catalogue)`,
    buys: "Sales VOLUME and graded sold prices. This is the only candidate that unlocks instruments we cannot build at all today - every number we publish currently reads asks and infers demand, and vol30 measures demand directly. It also unblocks the graded index and makes RT-5 testable for the first time.",
    why: "Capability, not coverage. We already have prices on 16,468 cards and volume on twelve.",
  });
  allocation.push({
    rank: 2, spend: "ENUMERATE and add sealed products",
    callsPerDay: Math.max(0, spare - 6000 - 700 - 1500),   // everything left after the higher-capability spends
    haveNow: `${sp.products.length} products, chosen by hand from eBay`,
    buys: "Coverage of a market nobody else indexes, on a catalogue we have never even counted. The endpoint exists and has only ever been queried by name.",
    why: "Second because it widens something we already do well rather than enabling something new - but it is the widest gap between what we track and what exists.",
  });
  allocation.push({
    rank: 3, spend: "Twice-daily refresh on the top 500 cards and boxes",
    callsPerDay: 700,
    haveNow: "once a day, everything",
    buys: "Intraday movement on the things people actually watch. A $2,000 card can move meaningfully between breakfast and dinner.",
    why: "Cheap, and the only way to say anything about a market DURING a day rather than about yesterday.",
  });
  allocation.push({
    rank: 4, spend: "Historical backfill where the provider has it",
    callsPerDay: 1500,
    haveNow: "5 days of our own tape",
    buys: "Every thesis we hold reports INSUFFICIENT for want of history. Backfill would make RT-1, RT-3 and RT-7 testable years earlier than waiting.",
    why: "Highest long-term value, entirely dependent on whether the provider exposes history at our tier - which nobody has checked.",
  });

  const allocated = allocation.reduce((n, a) => n + a.callsPerDay, 0);
  const unallocated = USABLE - cardRefresh - sealedRefresh - allocated;
  F(unallocated > USABLE * 0.15 ? "high" : "medium",
    `budget: ${(cardRefresh + sealedRefresh + allocated).toLocaleString("en-US")} of ${USABLE.toLocaleString("en-US")} usable allocated (${Math.round((cardRefresh + sealedRefresh + allocated) / USABLE * 100)}%), ${Math.max(0, unallocated).toLocaleString("en-US")} still unassigned`,
    "Unspent calls do not roll over - they evaporate at midnight. A budget held back is not saved, it is destroyed. The only defensible reserve is 10% for retries; everything beyond that is capability nobody declined, they just never allocated it.",
    unallocated > 0 ? "assign the remainder to the highest-ranked spend that can absorb it" : "fully allocated - the constraint is now real work rather than budget", "tyler");
}

const out = { generatedAt: new Date().toISOString(),
  question: "Not what could we buy, but what is already arriving that we throw away. A field we ignore cost exactly as much as a field we use.",
  blindSpots: [
    "Chat cannot reach the provider's documentation or make a live call. Everything here is read from responses already stored.",
    "It can say what ARRIVED. It cannot say what an endpoint would return if asked differently — that needs somebody with a key.",
    "It cannot see rate limits, quotas or tier boundaries; those are dashboard facts.",
  ],
  allocation,
  counts: { critical: findings.filter(f => f.severity === "critical").length, high: findings.filter(f => f.severity === "high").length, medium: findings.filter(f => f.severity === "medium").length },
  findings };
await writeFile(join(ROOT, "research/pulse/api-strategy.json"), JSON.stringify(out, null, 1));
console.log(`✓ api strategist: ${out.counts.critical} critical · ${out.counts.high} high · ${out.counts.medium} medium`);
for (const f of findings.filter(f => f.severity === "critical")) console.log(`  CRITICAL [${f.owner}] ${f.what}`);
for (const f of findings.filter(f => f.severity === "high")) console.log(`  HIGH     [${f.owner}] ${f.what}`);
console.log(`\n  HOW TO SPEND THE ROOM:`);
for (const a of allocation) console.log(`   ${a.rank}. ${a.spend.padEnd(46)} ~${String(a.callsPerDay).padStart(5)} calls/day  (have now: ${a.haveNow})`);
