import { canadaGapDoc, gapRows, latestMarket, parseValetRate } from "../lib/canada-gap.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const rate = parseValetRate({ observations: [{ d: "2026-10-14", FXUSDCAD: { v: "1.3800" } }, { d: "2026-10-15", FXUSDCAD: { v: "1.4000" } }] });
  t("the newest Bank of Canada row is kept", rate.rate === 1.4 && rate.date === "2026-10-15");
  t("a missing rate is not invented", parseValetRate({ observations: [] }) === null);
  const market = latestMarket([{ date: "2026-10-14", market: 10 }, { date: "2026-10-15", market: 12 }]);
  t("the newest US market point is kept", market.marketUsd === 12 && market.marketDate === "2026-10-15");
  const markets = new Map([["cel25-etb", market]]);
  const rows = gapRows({
    products: [{ id: "cel25-etb", name: "Celebrations Elite Trainer Box", cadRetail: 20, checked: "2026-10-15", sourceUrl: "https://example.test/retail", enteredBy: "person" }],
    markets,
    rate,
    asOf: "2026-10-15",
  });
  t("gap uses both dates and the CAD conversion", rows.length === 1 && rows[0].usMarketCad === 16.8 && rows[0].gapPct === 19 && rows[0].cadChecked === "2026-10-15" && rows[0].usMarketDate === "2026-10-15" && rows[0].rateDate === "2026-10-15");
  const empty = canadaGapDoc({ products: [], markets, rate, asOf: "2026-10-15" });
  t("an empty config is an empty file, not an error", empty.products.length === 0 && empty.note && !JSON.stringify(empty).includes("No data"));
  const skipped = gapRows({
    products: [{ id: "missing", cadRetail: 10, checked: "2026-10-15", sourceUrl: "https://example.test/x" }],
    markets,
    rate,
  });
  t("a product with no US market price is omitted", skipped.length === 0);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("canada-gap.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("canada gap ok");
}
