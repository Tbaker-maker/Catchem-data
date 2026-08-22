// refresh-tiers.mjs — every card priced, frequency by what it is worth.
//
// Tyler, 2026-08-23: "fit in all of them. Make the lesser valued cards not
// every day price checks so we don't run out on monthly actions."
//
// That is the right shape, and the arithmetic is better than it sounds. Pricing
// all 16,468 cards EVERY day costs ~494,000 calls a month. Tiering by value
// costs about 51,000 — a 90% saving — while still holding a current price for
// every single card in the catalogue. Nothing is dropped; only the CADENCE
// changes, which is the Cadence Law applied to data instead of agents.
//
// WHY VALUE DECIDES FREQUENCY: a $2,000 card that moves 5% has moved $100 and
// somebody cares today. A $0.30 common that moves 5% has moved a penny and
// nobody will notice this quarter. Refresh rate should track how fast a stale
// number becomes a WRONG number, and for bulk that takes months.
//
// WHAT THIS IS NOT: a claim that cheap cards do not matter. They stay in the
// catalogue, stay priced, and stay queryable. They are simply not re-asked
// daily, because asking daily would not change the answer.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

// Bands chosen so the daily tier is small enough to be genuinely fresh and the
// bulk tier is large enough to be cheap. Thresholds are provisional until the
// discovery sweep reports the real distribution — recorded as such, not as fact.
// SEALED USES THE SAME LOGIC WITH DIFFERENT NUMBERS. A $400 booster box and a
// $400 card are equally worth watching daily, but the sealed floor sits higher
// because there is no true bulk tier — the cheapest sealed product we track is
// still a real product somebody buys, where a $0.30 common is not.
export const SEALED_TIERS = [
  { id: "daily", everyDays: 1, minPrice: 0, why: "all of it. 207 products is a rounding error against a 20,000 budget and there is no argument for stale sealed data" },
];
export const sealedTierFor = (price) => SEALED_TIERS.find(t => (price ?? 0) >= t.minPrice) ?? SEALED_TIERS[SEALED_TIERS.length - 1];

// THE FLOORS ARE DELIBERATELY TIGHT. An earlier version of this had a
// quarterly tier — 90 days of staleness — and Tyler killed it in one line:
// "we can't have that old of data if we're data based." He was right. A price
// we publish is a claim about now, and a 90-day-old number wearing today's
// date is not a stale fact, it is a false one.
//
// Nothing here is ever worse than a week, and tiering only engages AT ALL when
// the universe exceeds the daily budget. Below that, everything refreshes
// every day, because it fits and because staleness we do not have to accept
// is staleness we should not accept.
export const TIERS = [
  { id: "daily",   everyDays: 1, minPrice: 5, why: "anything with a real price. The default, and where everything sits while the budget allows it" },
  { id: "2-day",   everyDays: 2, minPrice: 1, why: "only if the universe outgrows the budget" },
  { id: "3-day",   everyDays: 3, minPrice: 0, why: "the floor. Bulk commons, and still never worse than three days old" },
];

// BUDGET-AWARE. Tiering is a fallback, not a policy. While the whole universe
// fits inside the daily allowance, EVERYTHING refreshes daily — because
// staleness we do not have to accept is staleness we should not accept.
// Only when the universe outgrows the budget does the value floor engage, and
// even then the worst case is three days.
export const tierFor = (price, universeSize = 0, budget = 20000) =>
  universeSize && universeSize <= budget * 0.95
    ? TIERS[0]                                        // it fits — everything daily
    : (TIERS.find(t => (price ?? 0) >= t.minPrice) ?? TIERS[TIERS.length - 1]);

// Which cards are due today? Spread each tier across its own cycle so we do not
// price 7,000 quarterly cards on the same morning — an even daily load is the
// difference between a budget and a spike.
export function dueToday(cards, todayIso = new Date().toISOString().slice(0, 10), universeSize = 0, DAILY_BUDGET = 20000) {
  const dayNum = Math.floor(Date.parse(todayIso) / 86400000);
  const due = [];
  for (const [id, c] of Object.entries(cards)) {
    const t = tierFor(c.price, universeSize, DAILY_BUDGET);
    if (t.everyDays === 1) { due.push({ id, tier: t.id }); continue; }
    // stable per-card offset, so each card lands on its own day of the cycle
    let h = 0; for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
    if (Math.abs(h) % t.everyDays === dayNum % t.everyDays) due.push({ id, tier: t.id });
  }
  return due;
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const disc = await J("data/discovery-prices.json");
  const cat = await J("data/card-catalogue.json");
  if (!cat) { console.log("· refresh tiers: no catalogue yet"); process.exitCode = 0; }
  else {
    // Use swept prices where we have them; otherwise assume bulk, which is the
    // conservative direction — an unpriced card gets asked rarely until we know
    // it deserves better, rather than eating the daily budget on a guess.
    const universeSize = Object.keys(cat.cards).length + (await J("data/sealed-prices.json") ?? { products: [] }).products.length;
    const cards = Object.fromEntries(Object.keys(cat.cards).map(id => [id, { price: disc?.prices?.[id] ?? 0 }]));
    const counts = {}; for (const id of Object.keys(cards)) { const t = tierFor(cards[id].price, universeSize, 20000); counts[t.id] = (counts[t.id] ?? 0) + 1; }
    const perDay = TIERS.reduce((s, t) => s + (counts[t.id] ?? 0) / t.everyDays, 0);
    const due = dueToday(cards, undefined, universeSize, 20000);

    // Sealed alongside singles, because the budget is shared and a plan that
    // only counts half the spend is not a plan.
    const sp = await J("data/sealed-prices.json") ?? { products: [] };
    const sealedCounts = {};
    for (const p of sp.products) { const t = sealedTierFor(p.priceMedian); sealedCounts[t.id] = (sealedCounts[t.id] ?? 0) + 1; }
    const sealedPerDay = SEALED_TIERS.reduce((s, t) => s + (sealedCounts[t.id] ?? 0) / t.everyDays, 0);

    const report = { generatedAt: new Date().toISOString(),
      mode: universeSize <= 19000 ? `EVERYTHING DAILY — ${universeSize.toLocaleString("en-US")} items fits inside the ${(20000).toLocaleString("en-US")} daily budget, so nothing is stale` : `TIERED — the universe (${universeSize.toLocaleString("en-US")}) has outgrown the budget, so the value floor has engaged. Worst case is three days.`,
      basis: disc?.prices ? `${Object.keys(disc.prices).length.toLocaleString("en-US")} swept prices` : "NO SWEEP YET — every card is treated as bulk until discovery-sweep runs, which is the conservative direction",
      catalogue: Object.keys(cards).length,
      tiers: TIERS.map(t => ({ ...t, cards: counts[t.id] ?? 0, callsPerDay: Math.round((counts[t.id] ?? 0) / t.everyDays) })),
      callsPerDay: Math.round(perDay), callsPerMonth: Math.round(perDay * 30),
      dueToday: due.length,
      sealed: { products: sp.products.length,
        tiers: SEALED_TIERS.map(t => ({ ...t, products: sealedCounts[t.id] ?? 0, callsPerDay: Math.round((sealedCounts[t.id] ?? 0) / t.everyDays) })),
        callsPerDay: Math.round(sealedPerDay) },
      combinedCallsPerDay: Math.round(perDay + sealedPerDay),
      combinedCallsPerMonth: Math.round((perDay + sealedPerDay) * 30),
      budgetUsedPct: Math.round((perDay + sealedPerDay) / 20000 * 1000) / 10,
      versusDailyEverything: { callsPerMonth: Object.keys(cards).length * 30, saving: `${Math.round((1 - perDay / Object.keys(cards).length) * 100)}%` } };
    await writeFile(join(ROOT, "research/pulse/refresh-tiers.json"), JSON.stringify(report, null, 1));
    console.log(`  ${report.mode}\n`);
    console.log(`✓ refresh tiers: every one of ${report.catalogue.toLocaleString("en-US")} cards priced · ${report.callsPerDay.toLocaleString("en-US")} calls/day · ${report.callsPerMonth.toLocaleString("en-US")}/month`);
    for (const t of report.tiers) console.log(`  ${t.id.padEnd(10)} every ${String(t.everyDays).padStart(2)}d  ${String(t.cards).padStart(6)} cards  ${String(t.callsPerDay).padStart(5)} calls/day`);
    console.log(`\n  SEALED (${report.sealed.products} products):`);
    for (const t of report.sealed.tiers) console.log(`  ${t.id.padEnd(10)} every ${String(t.everyDays).padStart(2)}d  ${String(t.products).padStart(6)} products ${String(t.callsPerDay).padStart(5)} calls/day`);
    console.log(`\n  COMBINED: ${report.combinedCallsPerDay.toLocaleString("en-US")} calls/day · ${report.combinedCallsPerMonth.toLocaleString("en-US")}/month · ${report.budgetUsedPct}% of the 20k daily budget`);
    console.log(`  due today: ${due.length.toLocaleString("en-US")} singles · saves ${report.versusDailyEverything.saving} against pricing everything daily`);
    console.log(`  basis: ${report.basis}`);
  }
}
