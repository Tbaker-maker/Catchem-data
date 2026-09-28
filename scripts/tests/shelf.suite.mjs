import { appendShelfText, ptDate, shelfRows } from "../lib/shelf.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };
  t("a UTC morning is still the Pacific day before", ptDate("2026-09-27T09:54:14.339Z") === "2026-09-27");
  const prices = [{ id: 229276, market: 9.54 }, { id: 1, market: 3 }];
  const entries = [
    { id: "ok", tcgPlayerId: "229276", matchConfidence: "high", reviewed: true },
    { id: "thin", tcgPlayerId: "1", matchConfidence: "high", reviewed: true },
    { id: "low", tcgPlayerId: "2", matchConfidence: "low", reviewed: true },
    { id: "stale-map", tcgPlayerId: "3", matchConfidence: "high", reviewed: false },
  ];
  const products = [
    { id: "ok", dataStatus: "live", lastSeen: "2026-09-27", listingCount: 42 },
    { id: "thin", dataStatus: "live", lastSeen: "2026-09-27", listingCount: 19 },
    { id: "copied", dataStatus: "query_error", lastSeen: "2026-09-26", listingCount: 40 },
    { id: "low", dataStatus: "live", lastSeen: "2026-09-27", listingCount: 30 },
    { id: "stale-map", dataStatus: "live", lastSeen: "2026-09-27", listingCount: 30 },
    { id: "nomarket", dataStatus: "live", lastSeen: "2026-09-27", listingCount: 25 },
  ];
  const rows = shelfRows({ products, entries, prices, date: "2026-09-27" });
  t("only a live count of at least 20 with a same-day market is kept", rows.length === 1 && rows[0].sku_id === "tcgcsv-229276" && rows[0].listing_count === 42 && rows[0].market === 9.54 && rows[0].kind === "sealed" && rows[0].market_source === "tcgplayer_market");
  const again = appendShelfText("", rows);
  const twice = appendShelfText(again.text, rows);
  t("the same sku and day is not written twice", again.added === 1 && twice.added === 0 && twice.text === again.text);
  return fail;
}
