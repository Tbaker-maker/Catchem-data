import { planListingCounts, nightlyBudget, buildQuery, keepTitle, summarize, TIERS } from "../lib/listing-counts.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name); } };
  const { readFile } = await import("node:fs/promises");
  const cfg = JSON.parse(await readFile(new URL("../../config/api-budgets.json", import.meta.url), "utf8"));
  const b = nightlyBudget({ sealedPriced: 207, limit: cfg.ebayBrowse.dailyLimit, share: cfg.ebayBrowse.useShare });
  t("plan uses 98% of 5000 with 100 in reserve", b.safe === 4900 && b.reserve === 100 && b.budget + b.sealedStep < 4900);
  t("share is a config value", nightlyBudget({ limit: 1000, share: 0.5 }).safe === 500);
  t("priced tiers refresh at least weekly", TIERS.filter((x) => x.id !== "tail").every((x) => x.every <= 7));
  const items = [
    { id: "s1", kind: "sealed", tcgplayerProductId: 1, name: "Box A" },
    { id: "s2", kind: "sealed", tcgplayerProductId: 2, name: "Box B" },
    { id: "c1", kind: "single", price: 500, name: "Card - 1/10", number: "001/10" },
    { id: "c2", kind: "single", price: 2, name: "Card B - 2/10", number: "2/10" },
    { id: "c3", kind: "single", price: 0.2, name: "Bulk", number: "3" },
  ];
  const p = planListingCounts({ items, skipIds: new Set(["2"]), today: "2026-10-13", budget: 2, topN: 1 });
  t("sealed comes first and already-priced sealed is skipped", p.picked[0].id === "s1" && !p.picked.some((x) => x.id === "s2"));
  t("top single by value is next", p.picked[1].id === "c1");
  t("sub-$1 singles join the pool as the tail", p.poolSize === 4 && p.tierCounts.tail === 1 && !p.picked.some((x) => x.id === "c3"));
  const pt = planListingCounts({ items, skipIds: new Set(["2"]), state: { last: { s1: "2026-10-13", c1: "2026-10-13", c2: "2026-10-13" } }, today: "2026-10-13", budget: 4, topN: 1 });
  t("spare calls reach the tail", pt.picked.some((x) => x.id === "c3"));
  t("cycle nights are reported", typeof pt.cycleNights === "number" && pt.cycleNights >= 7);
  const p2 = planListingCounts({ items, skipIds: new Set(["2"]), state: { last: { s1: "2026-10-12", c1: "2026-10-12" } }, today: "2026-10-13", budget: 1, topN: 1 });
  t("the never-read long tail beats a sealed item read yesterday", p2.picked[0].id === "c2" || p2.picked[0].id === "c1");
  t("budget is never exceeded", planListingCounts({ items, today: "2026-10-13", budget: 0 }).picked.length === 0);
  t("raw single query drops graded and lots", /-psa/.test(buildQuery(items[2])) && /-lot/.test(buildQuery(items[2])) && /Card 1\/10/.test(buildQuery(items[2])));
  t("sealed query drops cases", /-case/.test(buildQuery(items[0])));
  t("graded and lot titles are not counted for raw", !keepTitle("single", "PSA 10 Charizard") && !keepTitle("single", "Lot of 5 cards") && keepTitle("single", "Charizard ex 199/165 NM"));
  t("case titles are not counted for sealed", !keepTitle("sealed", "Booster Box Case 6x") && keepTitle("sealed", "Booster Box Sealed"));
  const s = summarize("single", 200, ["Charizard NM", "PSA 9 Charizard", "Charizard", "Charizard lot"]);
  t("count scales the eBay total by the kept share", s.listingsCounted === 100 && s.sampleKept === 2);
  t("no total means no count", summarize("single", undefined, ["a"]).listingsCounted === null);
  const yt = JSON.parse(await readFile(new URL("../../config/youtube-channels.json", import.meta.url), "utf8"));
  t("YouTube cap is 98% of 10,000", Math.floor(cfg.youtube.dailyQuota * cfg.youtube.useShare) === 9800 && yt.limits.dailyUnitBudget <= 9800);
  return fail;
}
