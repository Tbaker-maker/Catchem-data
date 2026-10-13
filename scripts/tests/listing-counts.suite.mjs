import { tiers, pickRun, runSlice, used24, nightlyBudget, buildQuery, keepTitle, summarize } from "../lib/listing-counts.mjs";
import { readFile } from "node:fs/promises";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name); } };
  const cfg = JSON.parse(await readFile(new URL("../../config/api-budgets.json", import.meta.url), "utf8"));
  const b = nightlyBudget({ sealedPriced: 207, limit: cfg.ebayBrowse.dailyLimit, share: cfg.ebayBrowse.useShare });
  t("plan uses 98% of 5000 with 100 in reserve", b.safe === 4900 && b.reserve === 100 && b.budget + b.sealedStep < 4900);
  t("share is a config value", nightlyBudget({ limit: 1000, share: 0.5 }).safe === 500);

  const items = [
    { id: "s1", kind: "sealed", tcgplayerProductId: 1, price: 100, name: "Box A" },
    { id: "s2", kind: "sealed", tcgplayerProductId: 2, price: 50, name: "Box B" },
    { id: "s3", kind: "sealed", tcgplayerProductId: 3, name: "Unpriced tin" },
    { id: "c1", kind: "single", price: 500, name: "Card - 1/10", number: "001/10" },
    { id: "c2", kind: "single", price: 2, name: "Card B - 2/10", number: "2/10" },
    { id: "c3", kind: "single", price: 0.2, name: "Bulk", number: "3" },
  ];
  const tp = tiers({ items, skipIds: new Set(["2"]), dailyBudget: 3, tailFloor: 1 });
  t("priced sealed is in the daily tier, priced-step sealed skipped", tp.daily.some((x) => x.id === "s1") && !tp.daily.some((x) => x.id === "s2") && !tp.tail.some((x) => x.id === "s2"));
  t("unpriced sealed without attention is tail", tp.tail.some((x) => x.id === "s3"));
  t("singles fill the daily tier by value up to budget minus the tail floor", tp.counts.singlesTop === 1 && tp.daily.some((x) => x.id === "c1") && tp.singleCutoff === 500);
  t("attention lifts an unpriced sealed product into the daily tier", tiers({ items, attention: new Set(["s3"]), dailyBudget: 10 }).daily.some((x) => x.id === "s3"));
  t("leftover and tail cycle are reported", tp.leftover === 1 && tp.tailCycleDays === tp.tail.length);

  const now = new Date("2026-10-13T12:00:00Z");
  const log = [{ at: "2026-10-12T11:00:00Z", n: 999 }, { at: "2026-10-13T04:00:00Z", n: 700 }, { at: "2026-10-13T08:00:00Z", n: 300 }];
  t("counter is a rolling 24 hours", used24(log, now) === 1000);
  t("a run takes an even share of the day", runSlice({ safe: 4900, used: 0, dailyBudget: 4200, runsPerDay: 6 }) === 700);
  t("a run never passes the 24-hour cap", runSlice({ safe: 4900, used: 4800, dailyBudget: 4200, runsPerDay: 6 }) === 100 && runSlice({ safe: 4900, used: 5000, dailyBudget: 4200 }) === 0);
  const last = { s1: "2026-10-13T06:00:00Z", c1: "2026-10-12T06:00:00Z" };
  const pr = pickRun({ daily: tp.daily, tail: tp.tail, last, now, slice: 2 });
  t("daily items counted in the last 20 hours wait; stale daily items go first", pr[0].id === "c1" && !pr.some((x) => x.id === "s1"));
  t("leftover goes to the tail", pr.length === 2 && pr[1].tier === "tail");
  t("slice is never exceeded", pickRun({ daily: tp.daily, tail: tp.tail, now, slice: 0 }).length === 0);

  t("raw single query drops graded and lots", /-psa/.test(buildQuery(items[3])) && /-lot/.test(buildQuery(items[3])) && /Card 1\/10/.test(buildQuery(items[3])));
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
