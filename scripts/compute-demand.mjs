// compute-demand.mjs — the first instruments built on DEMAND, not on asks.
//
// Everything we publish today reads listings and infers what people want from
// how much is for sale. That is inference dressed as measurement, and we have
// been careful about the difference. These are the first numbers where we do
// not have to infer: vol30 is how many actually sold, sellers is how many
// distinct people are selling, and the graded blocks are what slabs actually
// went for.
//
// WHAT CHANGES BECAUSE OF IT: "listed at $200" is a fact about a seller's hope.
// "sold 47 times in thirty days" is a fact about buyers. Only one of those
// tells you whether a market exists, and it is the one nobody in this hobby
// publishes.
//
// EVERY INSTRUMENT HERE DEGRADES HONESTLY. Enrichment currently covers a dozen
// cards, so most of this returns nothing until the coverage lands. Returning
// nothing is correct; returning a national figure computed from twelve cards
// would be the worst thing this file could do.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const enrich = await J("data/singles-enrichment.json") ?? {};
const rows = (enrich.cards ?? enrich.rows ?? []).filter(c => c?.raw);
const MIN_SAMPLE = 25;                     // below this, say so rather than compute

const money = n => `$${Math.round(n).toLocaleString("en-US")}`;
const out = { generatedAt: new Date().toISOString(), coverage: rows.length,
  note: "Built on measured sales rather than listings. Most of this stays empty until enrichment coverage grows — an empty instrument is honest, a national figure from twelve cards is not." };

// ── 1 · LIQUIDITY: does a market actually exist here? ──────────────────────
// Listings tell you how much is for sale. Volume tells you whether anybody is
// buying it. A card with forty listings and two sales a month is not a liquid
// market, it is a queue.
out.liquidity = rows.filter(c => c.raw.vol30 != null && c.raw.listings).map(c => {
  const turn = c.raw.vol30 / c.raw.listings;          // sales per listing, per month
  return { cardId: c.cardId, name: c.name, vol30: c.raw.vol30, listings: c.raw.listings,
    turnover: Math.round(turn * 100) / 100, chip: "VERIFIED",
    read: turn >= 1 ? `${c.raw.vol30} sold against ${c.raw.listings} listed — everything on the shelf turns over inside a month, which is a market rather than a queue.`
        : turn >= 0.25 ? `${c.raw.vol30} sold against ${c.raw.listings} listed — steady, and a seller should expect weeks rather than days.`
        : `${c.raw.vol30} sold against ${c.raw.listings} listed — the shelf is far deeper than the demand under it. A price here is what sellers hope for, not what the market pays.`,
    simple: `${c.raw.listings} of these are for sale and about ${c.raw.vol30} sold last month. More sales than listings means it moves quickly; far more listings than sales means you might wait.` };
}).sort((a, b) => a.turnover - b.turnover);

// ── 2 · CONCENTRATION: is this a market, or is it one person? ──────────────
// Forty listings from one seller is a shop window. Forty from forty people is a
// market. Listing count alone cannot tell those apart, and we have been
// publishing listing counts for weeks without being able to.
out.concentration = rows.filter(c => c.raw.sellers && c.raw.listings).map(c => {
  const per = c.raw.listings / c.raw.sellers;
  return { cardId: c.cardId, name: c.name, sellers: c.raw.sellers, listings: c.raw.listings,
    listingsPerSeller: Math.round(per * 10) / 10, chip: "VERIFIED",
    read: per >= 3 ? `${c.raw.listings} listings from only ${c.raw.sellers} sellers — a few holders are setting this price, and one of them changing their mind moves it.`
        : `${c.raw.listings} listings spread across ${c.raw.sellers} sellers — broad enough that no single holder sets the price.`,
    simple: `${c.raw.sellers} different people are selling this. When that number is small, the price is really just a few people's opinion.` };
}).filter(x => x.listingsPerSeller >= 3).sort((a, b) => b.listingsPerSeller - a.listingsPerSeller);

// ── 3 · THE GRADED QUESTION, answered with sold prices at last ─────────────
// RT-5 has reported INSUFFICIENT for weeks for want of exactly this. These are
// completed sales, not asks, which is why it can carry VERIFIED at all.
out.gradedPremium = rows.filter(c => c?.ebaySold?.psa10?.median && c?.ebaySold?.psa9?.median && c.raw.market).map(c => {
  const raw = c.raw.market, p9 = c.ebaySold.psa9.median, p10 = c.ebaySold.psa10.median;
  const GRADING_COST = 25;                  // a defensible round number; the real figure varies by tier and turnaround
  return { cardId: c.cardId, name: c.name, raw, psa9: p9, psa10: p10,
    psa9Count: c.ebaySold.psa9.count, psa10Count: c.ebaySold.psa10.count,
    tenClears: Math.round((p10 - raw - GRADING_COST) * 100) / 100,
    nineClears: Math.round((p9 - raw - GRADING_COST) * 100) / 100,
    chip: "VERIFIED",
    read: `A PSA 10 has been selling around ${money(p10)} against ${money(raw)} ungraded, so a 10 clears the grading cost comfortably. A 9 sells around ${money(p9)}, which ${p9 - raw - GRADING_COST > 0 ? "still clears it, though by much less" : "does not cover it once the fee is counted"}. The whole decision is the odds of getting the 10.`,
    simple: `Ungraded this sells for about ${money(raw)}. Graded a 10 it sells for about ${money(p10)}, graded a 9 about ${money(p9)}. Grading costs the same either way, so the question is how likely a 10 is.`,
    basis: `${c.ebaySold.psa10.count} PSA 10 sales and ${c.ebaySold.psa9.count} PSA 9 sales observed` };
}).sort((a, b) => b.tenClears - a.tenClears);

// ── 4 · THE MARKET-WIDE READ, only when the sample supports one ────────────
out.marketDemand = rows.length >= MIN_SAMPLE
  ? (() => {
      const vols = rows.map(c => c.raw.vol30).filter(v => v != null).sort((a, b) => a - b);
      return { cards: vols.length, medianMonthlySales: vols[Math.floor(vols.length / 2)], chip: "READ" };
    })()
  : { available: false, have: rows.length, need: MIN_SAMPLE,
      why: `Enrichment covers ${rows.length} card${rows.length === 1 ? "" : "s"}. A market-wide demand figure from that would be a national claim built on a sample you could count on your hands, so there is not one.` };

await writeFile(join(ROOT, "research/pulse/demand.json"), JSON.stringify(out, null, 1));
console.log(`✓ demand: ${out.liquidity.length} liquidity · ${out.concentration.length} concentrated · ${out.gradedPremium.length} graded${out.marketDemand.available === false ? ` · market-wide withheld (${rows.length}/${MIN_SAMPLE})` : ""}`);
for (const g of out.gradedPremium.slice(0, 2)) console.log(`  ${g.name}: raw ${money(g.raw)} · PSA9 ${money(g.psa9)} · PSA10 ${money(g.psa10)}`);
for (const l of out.liquidity.slice(0, 2)) console.log(`  ${l.name}: ${l.vol30} sold / ${l.listings} listed = ${l.turnover} turnover`);
