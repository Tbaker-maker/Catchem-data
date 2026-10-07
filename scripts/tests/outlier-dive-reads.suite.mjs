import {
  diveTeaserReads,
  interleaveExtraKinds,
  money,
  outlierReads,
} from "../lib/outlier-dive-reads.mjs";
import { buildBrowse } from "../lib/extra-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  const doc = {
    high: [{
      id: "sv5-pc-etb",
      name: "Temporal Forces Pokemon Center Elite Trainer Box",
      severity: "high",
      direction: "high",
      todayDate: "2026-10-06",
      todayPrice: 499.99,
      referencePrice: 255.75,
      pctGap: 95.5,
      provisionalLabel: "possible real move",
    }],
    soft: [{
      id: "xy12-etb",
      name: "Evolutions Elite Trainer Box",
      severity: "high",
      direction: "high",
      todayDate: "2026-10-06",
      todayPrice: 850,
      referencePrice: 420,
      pctGap: 102.4,
      provisionalLabel: "likely bad listing",
    }],
  };
  const flagged = outlierReads(doc);
  t("outlier read uses the product id", flagged.length === 1 && flagged[0].id === "outlier-sv5-pc-etb" && flagged[0].sku === "sv5-pc-etb");
  t("outlier read keeps prices and dates from the file", flagged[0].price === 499.99 && flagged[0].asOf === "2026-10-06" && flagged[0].referencePrice === 255.75);
  t("outlier sentence states the gap without inventing solds", /499\.99/.test(flagged[0].path) && /255\.75/.test(flagged[0].path) && /95\.5%/.test(flagged[0].path) && !/\bsolds?\b/i.test(flagged[0].path));
  t("likely bad listing stays out of Flagged reads", !flagged.some((row) => row.sku === "xy12-etb"));
  t("a row without an id is dropped", outlierReads({ high: [{ name: "No Id", todayPrice: 1, referencePrice: 2, todayDate: "2026-10-06", pctGap: 10, provisionalLabel: "possible real move" }], soft: [] }).length === 0);

  const dives = diveTeaserReads([
    { id: "sv5-pc-etb", name: "Temporal Forces Pokemon Center Elite Trainer Box", asOf: "2026-10-06", latest: { priceMedian: 499.99, lastSeen: "2026-10-06", dataStatus: "live" }, outlier: { note: "Price flagged: 95.5% above recent median — review" } },
    { id: "no-price", name: "Empty", asOf: "2026-10-06", latest: { dataStatus: "no-active-market", listingCount: 0 } },
    { id: "me1-bb", name: "Mega Evolution Booster Bundle", asOf: "2026-10-06", latest: { priceMedian: 64.99, lastSeen: "2026-10-06", dataStatus: "live" } },
  ]);
  t("dive teaser keeps the dive id", dives.some((r) => r.id === "dive-sv5-pc-etb" && r.diveId === "sv5-pc-etb" && r.href === "/dive/sv5-pc-etb"));
  t("dive teaser uses the file price", dives.find((r) => r.id === "dive-sv5-pc-etb").price === 499.99 && /499\.99/.test(dives.find((r) => r.id === "dive-sv5-pc-etb").path) && dives.some((r) => r.id === "dive-me1-bb" && r.price === 64.99));
  t("a dive without price or outlier note does not ship", !dives.some((r) => r.id === "dive-no-price"));

  const lead = [
    { id: "move-1", readKind: "price", price: 1 },
    { id: "pokemon-a", readKind: "pokemon" },
    { id: "move-2", readKind: "price", price: 2 },
  ];
  const mixed = interleaveExtraKinds(lead, flagged.concat(dives), { every: 2 });
  t("short front still starts with the price move", mixed[0].id === "move-1");
  t("mix includes non-price types when present", mixed.some((r) => r.readKind === "outlier") && mixed.some((r) => r.readKind === "dive") && mixed.some((r) => r.readKind === "pokemon"));

  const browse = buildBrowse({
    asOf: "2026-10-06",
    cardIds: ["a", "b"],
    rankedIds: ["a", "b"],
    news: [],
    waves: [],
    flagged: flagged.map((r) => ({ id: r.id, readKind: r.readKind })),
    dives: dives.map((r) => ({ id: r.id, readKind: r.readKind })),
  });
  t("browse exposes flagged and dive filters", browse.filters.flagged.items.length === 1 && browse.filters.dive.items.length === 2);
  t("volume filter is not invented on browse", !browse.filters.volume);
  t("empty copy is honest", browse.filters.flagged.empty === "No flagged prices." && browse.filters.dive.empty === "No deep dives.");
  t("money helper does not invent", money(0) === "" && money(1.5) === "$1.50");

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("outlier-dive-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
