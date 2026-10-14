import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickLadder, rowsFromDistilled } from "../lib/condition-prices.mjs";
import { readMissesVariant, variantGroups } from "../lib/variant-check.mjs";
import { cardTitle } from "../lib/card-face.mjs";
import { stampStale } from "../lib/read-stale.mjs";
import { gradeVote, summarizeVotes } from "../lib/heading-votes.mjs";
import { dryUp, setMomentum } from "../lib/market-signals.mjs";
import { biggestMovers, listingChanges, weeklyDoc } from "../lib/weekly-changes.mjs";
import { applyTotalCaps } from "../lib/ebay-total.mjs";
import { flagCoverageDrops, freshnessReport, healPlan, janitorRows } from "../lib/ops-bots.mjs";
import { checkSingle } from "../lib/price-sanity.mjs";
import { scannerWeekly } from "../lib/scanner-report.mjs";
import { bulkFloorForSet } from "../lib/rip-roi.mjs";
import { dayPublishedBeforeRun } from "../fetch-tcgcsv-catalog.mjs";
import { buildQuery } from "../lib/listing-counts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const ladder = pickLadder({ "Holofoil / Near Mint": 10, "Holofoil / Lightly Played": 8, "Holofoil / Moderately Played": 6, "Holofoil / Damaged": 2 }, "2026-10-13");
  t("condition ladder keeps NM LP MP DMG", ladder.NM.amount === 10 && ladder.LP.amount === 8 && ladder.MP.amount === 6 && ladder.DMG.amount === 2);
  const distilled = rowsFromDistilled({ generatedAt: "2026-10-13T00:00:00Z", cards: [{ cardId: "a", name: "Lugia", number: "108/135", conditions: { "Lightly Played": 4 }, raw: { market: 9, lastUpdated: "2026-10-13" } }] });
  t("a played price is stored and NM stays the default", distilled.rows.length === 1 && distilled.rows[0].conditions.NM.amount === 9 && distilled.rows[0].hasPlayed === true);
  t("NM alone is not a played row", rowsFromDistilled({ cards: [{ cardId: "b", conditions: { "Near Mint": 3 }, raw: { market: 3 } }] }).rows.length === 0);

  const lugia = [
    { id: "plasma-108", name: "Lugia EX", number: "108/135", set: "Plasma Storm" },
    { id: "plasma-134", name: "Lugia EX", number: "134/135", set: "Plasma Storm" },
  ];
  const groups = variantGroups(lugia);
  t("same name different number is flagged", groups.length === 1 && groups[0].numbers.join() === "108/135,134/135");
  const titled = cardTitle({ name: "Lugia EX", set: "Plasma Storm", number: "108/135" });
  t("the title keeps the full number", titled.includes("108/135") && !titled.includes("108/13 ") && readMissesVariant({ name: "Lugia EX", headline: titled }, groups[0]).length === 0);
  t("a headline without the number fails the variant check", readMissesVariant({ name: "Lugia EX", headline: "Lugia EX is up" }, groups[0]).length === 2);
  t("the eBay query keeps the collector number", buildQuery({ kind: "single", name: "Lugia EX", number: "108/135" }).includes("108/135"));

  const staleDoc = { asOf: "2026-10-13", reads: [{ id: "a", asOf: "2026-10-13", endDate: "2026-10-13" }, { id: "b", asOf: "2026-10-11", endDate: "2026-10-11" }] };
  const stale = stampStale(staleDoc);
  t("stale is true only when the read ends before the board day", stale.stale === 1 && staleDoc.reads[0].stale === false && staleDoc.reads[1].stale === true && staleDoc.reads[0].builtOn === "2026-10-13");

  const hit = gradeVote({ id: "v1", itemId: "c", dir: "up", date: "2026-10-01", price: 10 }, { date: "2026-10-08", price: 11 });
  const miss = gradeVote({ id: "v2", itemId: "c", dir: "up", date: "2026-10-01", price: 10 }, { date: "2026-10-08", price: 9 });
  t("a later price grades the heading vote", hit.hit === true && hit.pct === 10 && miss.hit === false);
  const many = Array.from({ length: 20 }, (_, i) => gradeVote({ id: `v${i}`, dir: "up", date: "2026-10-01", price: 10 }, { date: "2026-10-08", price: 12 }));
  t("under 20 votes does not pass", summarizeVotes([hit]).passed === false && summarizeVotes(many).passed === true && summarizeVotes(many).byDir.up.n === 20);

  const momentum = setMomentum([
    ...Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, number: `${i}/10`, set: "Alpha", price: 10, hist: [["2026-09-01", 10], ["2026-10-13", 12]] })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, number: `${i}/10`, set: "Beta", price: 10, hist: [["2026-09-01", 10], ["2026-10-13", 10]] })),
  ], { asOf: "2026-10-13" });
  t("set momentum compares the set median with the market median", momentum.length === 2 && momentum.some((row) => row.name === "Alpha" && row.medianPct === 20 && row.marketMedianPct === 10));
  const dry = dryUp([
    { id: "box", name: "Box", date: "2026-09-01", n: 100 },
    { id: "box", name: "Box", date: "2026-09-20", n: 70 },
  ]);
  t("listings counted dry-up needs 25% across 14 days", dry.length === 1 && dry[0].dropPct === 30 && dry[0].headline.includes("listings counted"));
  t("a short span is not a dry-up", dryUp([{ id: "box", name: "Box", date: "2026-09-01", n: 100 }, { id: "box", name: "Box", date: "2026-09-05", n: 50 }]).length === 0);

  const movers = biggestMovers([{ id: "c", name: "Card", num: "1/10", hist: [["2026-10-06", 10], ["2026-10-13", 12]] }]);
  t("a mover keeps both dates", movers.length === 1 && movers[0].from === "2026-10-06" && movers[0].to === "2026-10-13" && movers[0].pct === 20);
  const listed = listingChanges({ a: { id: "a", date: "2026-10-13", listingsCounted: 80 } }, [{ id: "a", date: "2026-10-01", listingsCounted: 100 }]);
  t("listings counted change uses two dated files", listed.length === 1 && listed[0].pct === -20);
  t("one listings day stays empty", weeklyDoc({ asOf: "2026-10-13", movers: [], patterns: [], listings: [], listingDays: 1 }).listingsCounted.changes.length === 0);

  const once = applyTotalCaps([{ id: "a", browseTotal: 713, listingsCounted: 713 }]);
  t("one 713 total is kept", once[0].listingsCounted === 713 && !once[0].totalCapped);
  const stuck = applyTotalCaps(Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, browseTotal: 713, listingsCounted: 713 })));
  t("713 on many searches is a cap, not a count", stuck.every((row) => row.listingsCounted == null && row.totalCapped === true && row.cap === 713));
  const hard = applyTotalCaps([{ id: "h", browseTotal: 10000, listingsCounted: 10000 }]);
  t("the documented 10000 cap is not published as an exact count", hard[0].listingsCounted == null && hard[0].cap === 10000);

  t("a rerun does not rewrite a day that was already published", dayPublishedBeforeRun("/x", "2026-10-13", "abc", () => {}) === true);
  t("self-heal restores data files only", healPlan(["data/sealed-prices.json", "scripts/x.mjs"]).files.join() === "data/sealed-prices.json");
  t("self-heal ignores a code-only red commit", healPlan(["scripts/x.mjs"]).action === "none");
  const old = janitorRows([{ number: 9, title: "Old", url: "https://example.com/9", createdAt: "2026-10-01T00:00:00Z", checks: [] }, { number: 10, title: "Red", url: "https://example.com/10", createdAt: "2026-10-13T00:00:00Z", checks: [{ name: "tests", conclusion: "failure" }] }], new Date("2026-10-13T00:00:00Z"));
  t("janitor lists old PRs and the failing test name", old.length === 2 && old[1].failing.join() === "tests" && old[0].old === true);
  t("coverage flags a drop in priced cards", flagCoverageDrops({ priced: 10, yearHistory: 4, listingsCounted: 3, imageGaps: 2 }, { priced: 9, yearHistory: 4, listingsCounted: 3, imageGaps: 2 }).some((row) => row.key === "priced"));
  t("freshness fails a missing scanner day", freshnessReport({ today: "2026-10-13", priceDay: "2026-10-13", countsDay: "2026-10-13", readsDay: "2026-10-13", scannerDay: "" }).failures.join() === "scanner");

  const single = checkSingle({ id: "c", name: "Lugia EX", number: "108/135", ebay: 40, tcg: 100, listings: 20, tcgDate: "2026-10-13", asOf: "2026-10-13" });
  t("a single keeps its number on the sanity row", single.number === "108/135" && single.kind === "single" && single.flag === "ebay-low");
  const weekly = scannerWeekly({ asOf: "2026-10-13", summary: {}, weights: { rows: [{ pattern: "flat-range", stage: "confirmed", kind: "single", dir: "flat", horizon: 7, n: 30, rate: 50, weight: 0.4, eraFactor: 1, passed: true }] } });
  t("scanner weekly keeps a passed row", weekly.passed === 1 && weekly.top[0].eraFactor === 1);

  const skewed = [
    ...Array.from({ length: 20 }, () => ({ setSlug: "set", rarity: "Common", price: 0.1 })),
    ...Array.from({ length: 5 }, () => ({ setSlug: "set", rarity: "Uncommon", price: 2 })),
  ];
  const bulk = bulkFloorForSet(skewed, "set");
  t("a low bulk median is raised to the trimmed mean", bulk.raised === true && bulk.perCard > bulk.median && bulk.n === 25);

  const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
  const banned = /\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|crypto|bitcoin)\b/i;
  const blob = (reads.reads || []).map((row) => [row.headline, ...(row.lines || [])].join(" ")).join("\n");
  t("published reads have no em dash and no banned word", !/[\u2014\u2013]/.test(blob) && !banned.test(blob) && !/(^|[^.])\bsupply\b/i.test(blob));

  return fail;
}
