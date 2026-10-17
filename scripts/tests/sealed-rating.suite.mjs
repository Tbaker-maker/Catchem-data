import { sealedShard, pctRank, verdictOf, buildSealedRatings, sealedReads, cleanCopy, stageOf, setNamed, setValues, TYPES } from "../lib/sealed-rating.mjs";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

export async function run() {
  fail = 0;
  const today = "2026-10-12";
  t("percentile needs 5 peers", pctRank(1, [1, 2, 3]) === null && pctRank(3, [1, 2, 3, 4, 5]) === 0.5);
  t("verdict wording", verdictOf(0.9, "Elite Trainer Boxes") === "Low price next to its set's top card, compared with other Elite Trainer Boxes" && verdictOf(0.1, "tins").startsWith("High price") && verdictOf(0.5, "tins").startsWith("In line"));
  t("advice phrases caught", !cleanCopy("buy now") && !cleanCopy("load up on boxes") && !cleanCopy("guaranteed to climb") && !cleanCopy("you can't lose") && cleanCopy("prices bottomed") && cleanCopy("Buy on TCGplayer") && !cleanCopy("a \u2014 b") && cleanCopy("Low price next to its set's top card"));
  t("stage: Mega era is current", stageOf({ release: "2025-11-14", subtype: "etb", rot: null }).key === "current");
  t("stage: rotated uses the official status", stageOf({ release: "2023-09-22", subtype: "etb", rot: { mark: "G", status: "Rotated April 10, 2026" } }).label === "Rotated April 10, 2026");
  t("stage: tins flagged", stageOf({ release: "2023-09-22", subtype: "tin", rot: { mark: "G", status: "Rotated April 10, 2026" } }).late === true);
  t("set naming", setNamed("151 Elite Trainer Box", "SV: Scarlet & Violet 151") && setNamed("Phantasmal Flames Booster Box", "ME02: Phantasmal Flames") && !setNamed("Knock Out Collection [Kyogre]", "Ditto Games Expo 2007"));
  const single = (i, p, slug = "sv-x") => ({ id: `tcgcsv-${i}`, name: `Mon${i} - ${i}/100`, num: `${i}/100`, kind: "single", setSlug: slug, price: p, asOf: today });
  const sv = setValues([single(1, 30), single(2, 10), single(3, 5)], today).get("sv-x");
  t("set value sums singles on the day", sv.total === 45 && sv.top.name === "Mon1" && sv.n === 3);
  t("4x outlier top card held", setValues([single(1, 1000), single(2, 10), single(3, 5)], today).get("sv-x").top.price === 10);
  const singles = Array.from({ length: 12 }, (_, i) => single(i + 1, i === 0 ? 30 : 10));
  const hist = (a, z) => Array.from({ length: 8 }, (_, i) => [`2026-10-0${i + 1}`.replace("0-10", "10"), i === 7 ? z : a]);
  const etb = (i, name, p) => ({ id: `tcgcsv-9${i}`, name, kind: "sealed", subtype: "etb", set: "SV: Testset", setSlug: "sv-x", release: "2024-01-01", price: p, asOf: today, hist: hist(p, p) });
  const sealed = [etb(1, "Testset Elite Trainer Box", 5), ...Array.from({ length: 6 }, (_, i) => etb(i + 2, `Testset Elite Trainer Box [${i}]`, 300 + i * 50)), etb(9, "Testset Elite Trainer Box Display", 5)];
  const list = buildSealedRatings({ rows: [...singles, ...sealed], rot: { sets: [] }, today });
  const a = list.find((r) => r.id === "tcgcsv-91");
  t("display skipped", !list.find((r) => r.id === "tcgcsv-99"));
  t("cheap ETB reads low next to its top card", a.chase.ratio === 6 && a.verdict.startsWith("Low price"));
  t("price carries date and source", a.price.date === today && a.price.source === "TCGplayer market");
  t("factors 0 to 1", list.every((r) => Object.values(r.factors).every((f) => f.v >= 0 && f.v <= 1)));
  const reads = sealedReads(list, { asOf: today });
  t("read path, 3+ lines, clean copy", reads.length >= 1 && reads[0].headline.startsWith("Sealed vs its top card, Elite Trainer Boxes: Testset Elite Trainer Box") && reads[0].lines.length >= 3 && reads.every((r) => cleanCopy(r.headline) && r.lines.every(cleanCopy)));
  t("shard stable", sealedShard("tcgcsv-242436") === "04" && sealedShard("tcgcsv-16") === "00");
  t("every type has a label", Object.values(TYPES).every((x) => x.label && x.one));
  return fail;
}
