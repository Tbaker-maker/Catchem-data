import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pullFactor, pullTable, RATING_WEIGHTS } from "../lib/card-rating.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };
export async function run() {
  fail = 0;
  const doc = JSON.parse(await readFile(join(ROOT, "data/pull-rates-published.json"), "utf-8"));
  t("every rate names a source with a link", doc.rates.every((r) => doc.sources[r.source]?.url && r.oneInPacks > 0));
  t("every cross-check has a link", doc.rates.every((r) => !r.crossCheck || /^https:\/\//.test(r.crossCheckUrl)));
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => ({ kind: "single", setSlug: "a", rarity: "Special Illustration Rare", num: `${i}` })),
    ...Array.from({ length: 5 }, (_, i) => ({ kind: "single", setSlug: "b", rarity: "Special Illustration Rare", num: `${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ kind: "single", setSlug: "c", rarity: "Special Illustration Rare", num: `${i}` })),
  ];
  const tbl = pullTable({ sources: { s: { name: "S", url: "https://x", dataAsOf: "2026-09-20" } }, rates: [{ setSlug: "a", rarity: "Special Illustration Rare", oneInPacks: 90, source: "s" }, { setSlug: "b", rarity: "Special Illustration Rare", oneInPacks: 32, source: "s" }, { setSlug: "c", rarity: "Special Illustration Rare", oneInPacks: 30, source: "s" }] }, rows);
  t("per-card odds = tier x cards", tbl.get("a|Special Illustration Rare").perCard === 900);
  t("hardest pull scores highest", pullFactor({ setSlug: "a", rarity: "Special Illustration Rare" }, tbl).v > pullFactor({ setSlug: "c", rarity: "Special Illustration Rare" }, tbl).v);
  t("no published rate, no factor", pullFactor({ setSlug: "z", rarity: "Special Illustration Rare" }, tbl) === null);
  t("weights still add to 100", Object.values(RATING_WEIGHTS).reduce((a, b) => a + b, 0) === 100);
  return fail;
}
