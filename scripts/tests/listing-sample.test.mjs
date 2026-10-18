import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  headlinePass, parseListing, passingConditions, publicSampleRow, readCondition, readPrinting,
  samePrinting, sampleRoom, topVintage,
} from "../lib/listing-sample.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cfg = { minListings: 3, minRatio: 0.5, maxRatio: 2 };

export async function runListingSampleTests() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail++; console.error("  FAIL", name); }
  };

  t("1st Edition and Unlimited stay apart", readPrinting("Espeon 1st Edition Holo") === "1st Edition Holofoil" && readPrinting("Espeon Unlimited Holo NM") === "Unlimited Holofoil" && !samePrinting("1st Edition Holofoil", "Unlimited Holofoil"));
  t("a title that names both editions is dropped", readPrinting("1st Edition Unlimited Holo") === "");
  t("Shadowless is its own printing", readPrinting("Charizard Shadowless Holo") === "Shadowless Holofoil");
  t("MP is not NM", readCondition("Moderately Played holo") === "MP" && readCondition("Near Mint") === "NM" && readCondition("NM LP") === "");
  t("a listing with no printing is dropped", parseListing({ title: "Espeon NM pokemon", price: { value: 20 } }) === null);
  t("a graded title is dropped", parseListing({ title: "Espeon 1st Edition Holo PSA 9", price: { value: 500 } }) === null);

  const asks = [380, 400, 420].map((n) => ({ title: "Espeon 1st Edition Holo NM", price: { value: n } }));
  const card = {
    id: "tcgcsv-1",
    kind: "single",
    release: "1999-01-09",
    price: 400,
    printing: "1st Edition Holofoil",
    printings: [
      { name: "1st Edition Holofoil", price: 400 },
      { name: "Unlimited Holofoil", price: 80 },
    ],
  };
  const passed = passingConditions(card, asks, cfg);
  t("a close NM sample publishes that printing only", passed.length === 1 && passed[0].condition === "NM" && passed[0].printing === "1st Edition Holofoil" && passed[0].amount === 400);
  const far = passingConditions(card, [1500, 1600, 1700].map((n) => ({ title: "Espeon 1st Edition Holo NM", price: { value: n } })), cfg);
  t("a vintage price far from the same printing is not published", far.length === 0 && !headlinePass(card, far));
  const played = passingConditions(card, [80, 90, 100].map((n) => ({ title: "Espeon 1st Edition Holo MP", price: { value: n } })), cfg);
  t("an MP sample does not become NM", played.length === 0);
  t("a modern card is not on this path", passingConditions({ ...card, release: "2024-01-01" }, asks, cfg).length === 0);
  t("an unverified card is not published", passingConditions({ ...card, unverified: true }, asks, cfg).length === 0);
  const row = publicSampleRow(card, passed);
  t("the public row has no band numbers", row.published === true && row.condition === "NM" && !("minRatio" in row) && !("maxRatio" in row) && !("minListings" in row));
  t("the call budget is a count, not a price", sampleRoom({ used: 4000, cap: 300 }) === 200 && sampleRoom({ used: 4900 }) === 0);
  const ranked = topVintage([
    { id: "new", release: "2024-01-01", price: 999, kind: "single" },
    { id: "b", release: "1999-01-09", price: 10, kind: "single" },
    { id: "a", release: "2000-01-01", price: 50, kind: "single" },
    { id: "box", release: "1999-01-09", price: 800, kind: "sealed" },
  ], 1);
  t("the top vintage single is the priced WOTC card", ranked.length === 1 && ranked[0].id === "a");
  const src = await readFile(join(ROOT, "scripts/lib/listing-sample.mjs"), "utf8");
  t("the sampler source has no live band", !/minRatio"\s*:\s*0\./.test(src) && !src.includes("0.7") && !src.includes("1.43"));
  return fail;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const n = await runListingSampleTests();
  if (n) process.exit(1);
  console.log("listing sample ok");
}
