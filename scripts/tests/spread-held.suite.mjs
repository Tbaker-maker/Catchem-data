import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isSpreadHeld, heldDivergenceReport, SPREAD_HELD_STATUS } from "../lib/spread-held.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("top-level TCGplayer market holds The Spread", isSpreadHeld({ priceSource: "TCGplayer market", products: [] }) === true);
  t("row-level TCGplayer market holds The Spread", isSpreadHeld({ products: [{ id: "a", priceSource: "TCGplayer market" }] }) === true);
  t("legacy eBay-priced file does not hold", isSpreadHeld({ source: "ebay-browse-api", products: [{ id: "a", priceMedian: 10 }] }) === false);

  const held = heldDivergenceReport({
    priceSource: "TCGplayer market",
    products: [{ id: "swsh7-bb" }, { id: "sv3-etb" }],
  }, "2026-10-27T12:00:00.000Z");
  t("held status", held.dataStatus === SPREAD_HELD_STATUS);
  t("held has zero compared rows", held.rows.length === 0 && held.counts.compared === 0 && held.counts.signals === 0);
  t("held notes every product as skipped", held.skipped.length === 2 && held.counts.skipped === 2);
  t("held rows carry no eBay ask median", held.rows.every((r) => !("ebayAskMedian" in r)));
  t("held reason names listings counted", /listings counted/.test(held.heldReason) && /TCGplayer market/.test(held.method));

  const root = join(dirname(dirname(fileURLToPath(import.meta.url))), "..");
  const schemas = JSON.parse(await readFile(join(root, "data/schemas.json"), "utf8"));
  const floor = schemas.files["data/divergence-report.json"].requires.rows.minLength;
  t("schema allows a held empty rows array", floor === 0);

  return fail;
}
