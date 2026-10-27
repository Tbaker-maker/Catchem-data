import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  tcgPricedRow, catalogByIdFrom, artsPriceSource, SEALED_PRICE_SOURCE, SEALED_PRICE_SOURCE_LOW,
  REMOVED_NOT_REAL_IDS, NO_TCG_LISTING_IDS, medianOf, resolveTcgPlayerId, lowListingUsable,
} from "../lib/sealed-tcg-price.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const products = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
  const list = Array.isArray(products) ? products : Object.values(products);
  const byId = catalogByIdFrom(list);
  const prices = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
  const priceIds = new Set((prices.products || []).map((p) => p.id));
  const removed = JSON.parse(await readFile(join(ROOT, "data/history/tcgplayer-market/removed-not-real.json"), "utf8"));
  const mapping = JSON.parse(await readFile(join(ROOT, "data/history/tcgplayer-market/mapping.json"), "utf8"));
  const mapIds = new Set((mapping.entries || []).map((e) => e.id));

  for (const id of REMOVED_NOT_REAL_IDS) {
    t(`removed from sealed-products: ${id}`, !byId.has(id));
    t(`removed from sealed-prices: ${id}`, !priceIds.has(id));
  }
  t("removal report lists all 14", (removed.removed || []).length === 14);
  t("removal report keeps Lost Origin and Silver Tempest bundles", (removed.keptReal || []).some((r) => r.id === "swsh11-bundle") && (removed.keptReal || []).some((r) => r.id === "swsh12-bundle"));
  t("no em or en dash in removal reasons", !(removed.removed || []).some((r) => /[\u2013\u2014]/.test(JSON.stringify(r))));

  t("xy12 Charizard art mapped", byId.get("xy12-etb-mega-charizard-y")?.tcgPlayerId === "123447" && mapIds.has("xy12-etb-mega-charizard-y"));
  t("sv1 pc arts mapped", mapIds.has("sv1-pc-etb-miraidon") && mapIds.has("sv1-pc-etb-koraidon"));
  t("mega forces set of 3 mapped", mapIds.has("mega-forces-tin-set-of-3") && byId.get("mega-forces-tin-set-of-3")?.tcgPlayerId === "702508");
  t("crown zenith premium mapped", byId.get("swsh12pt5-premium")?.tcgPlayerId === "505916");
  t("base1 unlimited mapped with edition", byId.get("base1-booster-box")?.tcgPlayerId === "185731" && byId.get("base1-booster-box")?.edition === "Revised Unlimited");
  t("jungle fossil neo stay unmapped", !byId.get("base2-booster-box")?.tcgPlayerId && !byId.get("base3-booster-box")?.tcgPlayerId && !byId.get("neo1-booster-box")?.tcgPlayerId);
  t("edition gap list is the three vintage boxes", NO_TCG_LISTING_IDS.join(",") === "base2-booster-box,base3-booster-box,neo1-booster-box");

  const market = new Map([
    [229284, new Map([["2026-10-27", { date: "2026-10-27", market: 132.53, low: 123.5 }]])],
    [229285, new Map([["2026-10-27", { date: "2026-10-27", market: 133.59, low: 119.01 }]])],
    [701600, new Map([["2026-10-27", { date: "2026-10-27", low: 642.5 }]])],
    [185731, new Map([["2026-10-27", { date: "2026-10-27", low: 100000 }]])],
  ]);
  const hub = tcgPricedRow(
    { id: "swsh5-etb", name: "Battle Styles Elite Trainer Box", combinedArts: true, arts: ["swsh5-etb-single-strike-urshifu-red", "swsh5-etb-rapid-strike-urshifu-blue"], listingCount: 88, priceHistory: [] },
    market,
    "2026-10-27",
    { catalogById: byId },
  );
  t("hub median across 2 arts", hub.priceUsd === medianOf([132.53, 133.59]) && hub.priceSource === artsPriceSource(2));
  t("hub carries per-art prices", hub.artsPrices?.length === 2 && hub.artsPrices.every((a) => a.priceSource === SEALED_PRICE_SOURCE));

  const costco = tcgPricedRow(
    { id: "tcgcsv-701600", name: "Costco tin bundle", priceFloor: 100, priceCeiling: 2000, priceHistory: [], listingCount: 0 },
    market,
    "2026-10-27",
    { catalogById: byId },
  );
  t("Costco embed pid copied", costco.tcgPlayerId === "701600");
  t("Costco null market uses low listing label", costco.priceUsd === 642.5 && costco.priceSource === SEALED_PRICE_SOURCE_LOW);

  const base = tcgPricedRow(
    { id: "base1-booster-box", name: "Base Set Unlimited Booster Box", tcgPlayerId: "185731", priceFloor: 1500, priceCeiling: 10000, priceHistory: [] },
    market,
    "2026-10-27",
    { catalogById: byId },
  );
  t("junk low above ceiling is not a price", base.priceUsd == null && !lowListingUsable(base, 100000));

  const resolved = resolveTcgPlayerId({ id: "tcgcsv-692583" }, byId);
  t("catalog Costco pid resolves", resolved.pid === 692583 || resolved.pid === Number(byId.get("tcgcsv-692583")?.tcgPlayerId || 692583));

  // Real LO/ST bundles stay
  t("Lost Origin bundle stays in catalog", byId.has("swsh11-bundle") && byId.get("swsh11-bundle").tcgPlayerId === "278819");
  t("Silver Tempest bundle stays in catalog", byId.has("swsh12-bundle") && byId.get("swsh12-bundle").tcgPlayerId === "283396");

  return fail;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await run();
  process.exit(n ? 1 : 0);
}
