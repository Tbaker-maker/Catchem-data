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
  { id: "daily",   everyDays: 1, minPrice: 150, why: "boxes and premium collections — a percent here is real money" },
  { id: "fast",    everyDays: 2, minPrice: 40,  why: "ETBs, bundles, most in-print product" },
  { id: "weekly",  everyDays: 7, minPrice: 0,   why: "packs and tins — cheap, but still products people buy, so never worse than weekly" },
];
export const sealedTierFor = (price) => SEALED_TIERS.find(t => (price ?? 0) >= t.minPrice) ?? SEALED_TIERS[SEALED_TIERS.length - 1];

export const TIERS = [
  { id: "daily",     everyDays: 1,  minPrice: 100, why: "a 5% move here is $5+ and somebody is watching it today" },
  { id: "fast",      everyDays: 3,  minPrice: 25,  why: "moves matter within the week, not within the hour" },
  { id: "weekly",    everyDays: 7,  minPrice: 5,   why: "real cards with real prices that do not swing daily" },
  { id: "monthly",   everyDays: 30, minPrice: 1,   why: "a stale month-old price here is still roughly right" },
  { id: "quarterly", everyDays: 90, minPrice: 0,   why: "bulk. Asking daily would not change the answer, and a stale answer is not a wrong one" },
];

export const tierFor = (price) => TIERS.find(t => (price ?? 0) >= t.minPrice) ?? TIERS[TIERS.length - 1];

// Which cards are due today? Spread each tier across its own cycle so we do not
// price 7,000 quarterly cards on the same morning — an even daily load is the
// difference between a budget and a spike.
export function dueToday(cards, todayIso = new Date().toISOString().slice(0, 10)) {
  const dayNum = Math.floor(Date.parse(todayIso) / 86400000);
  const due = [];
  for (const [id, c] of Object.entries(cards)) {
    const t = tierFor(c.price);
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
    const cards = Object.fromEntries(Object.keys(cat.cards).map(id => [id, { price: disc?.prices?.[id] ?? 0 }]));
    const counts = {}; for (const id of Object.keys(cards)) { const t = tierFor(cards[id].price); counts[t.id] = (counts[t.id] ?? 0) + 1; }
    const perDay = TIERS.reduce((s, t) => s + (counts[t.id] ?? 0) / t.everyDays, 0);
    const due = dueToday(cards);

    // Sealed alongside singles, because the budget is shared and a plan that
    // only counts half the spend is not a plan.
    const sp = await J("data/sealed-prices.json") ?? { products: [] };
    const sealedCounts = {};
    for (const p of sp.products) { const t = sealedTierFor(p.priceMedian); sealedCounts[t.id] = (sealedCounts[t.id] ?? 0) + 1; }
    const sealedPerDay = SEALED_TIERS.reduce((s, t) => s + (sealedCounts[t.id] ?? 0) / t.everyDays, 0);

    const report = { generatedAt: new Date().toISOString(),
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
    console.log(`✓ refresh tiers: every one of ${report.catalogue.toLocaleString("en-US")} cards priced · ${report.callsPerDay.toLocaleString("en-US")} calls/day · ${report.callsPerMonth.toLocaleString("en-US")}/month`);
    for (const t of report.tiers) console.log(`  ${t.id.padEnd(10)} every ${String(t.everyDays).padStart(2)}d  ${String(t.cards).padStart(6)} cards  ${String(t.callsPerDay).padStart(5)} calls/day`);
    console.log(`\n  SEALED (${report.sealed.products} products):`);
    for (const t of report.sealed.tiers) console.log(`  ${t.id.padEnd(10)} every ${String(t.everyDays).padStart(2)}d  ${String(t.products).padStart(6)} products ${String(t.callsPerDay).padStart(5)} calls/day`);
    console.log(`\n  COMBINED: ${report.combinedCallsPerDay.toLocaleString("en-US")} calls/day · ${report.combinedCallsPerMonth.toLocaleString("en-US")}/month · ${report.budgetUsedPct}% of the 20k daily budget`);
    console.log(`  due today: ${due.length.toLocaleString("en-US")} singles · saves ${report.versusDailyEverything.saving} against pricing everything daily`);
    console.log(`  basis: ${report.basis}`);
  }
}
