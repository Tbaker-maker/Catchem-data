import { boardPriceMismatches } from "../lib/board-sync.mjs";
import { applyDayPrices, dayPublishedBeforeRun } from "../fetch-tcgcsv-catalog.mjs";
import { listingFileDay, mergeDayRows } from "../lib/listing-counts.mjs";
import { priceDayStale } from "../lib/ops-bots.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const priceOf = new Map([["tcgcsv-1", 10], ["tcgcsv-2", 20]]);
  const same = boardPriceMismatches({
    reads: [{ href: "/c/tcgcsv-1", price: 10 }],
    movers: [{ href: "/p/tcgcsv-2", price: 20 }],
    priceOf,
  });
  t("a board that matches the bundle passes", same.length === 0);
  const drifted = boardPriceMismatches({
    reads: [{ href: "/c/tcgcsv-1", price: 9.5 }, { href: "/c/tcgcsv-2", price: 20, image: "https://i.ebayimg.com/x.jpg" }],
    movers: [{ href: "/p/tcgcsv-2", price: 19 }],
    priceOf,
  });
  t("a drifted read, mover, and ebay image are all caught", drifted.length === 3 && drifted.some((row) => row.where === "read") && drifted.some((row) => row.where === "image"));
  const past = boardPriceMismatches({
    reads: [{ href: "/c/tcgcsv-1", price: 4, endDate: "2025-09-25" }],
    priceOf,
    asOf: "2026-10-14",
  });
  t("a past window price is not compared to today's bundle", past.length === 0);

  const latest = { asOf: "2026-10-13", counts: { priced: 1, unpriced: 1 }, items: [
    { tcgplayerProductId: 1, price: 5, asOf: "2026-10-13" },
    { tcgplayerProductId: 2, price: 8, asOf: "2026-10-13" },
  ] };
  const daily = { date: "2026-10-14", prices: [{ id: 1, market: 5.5 }] };
  const next = applyDayPrices(latest, daily);
  t("a published day moves the catalog forward and leaves other prices", next.asOf === "2026-10-14" && next.items[0].price === 5.5 && next.items[1].price === 8);
  t("the same day is not rewritten", applyDayPrices(next, daily) === next);
  t("an older day does not roll the catalog back", applyDayPrices(next, { date: "2026-10-13", prices: [{ id: 1, market: 1 }] }) === next);
  t("a rerun does not rewrite a day that was already published", dayPublishedBeforeRun("/x", "2026-10-14", "abc", () => {}) === true);

  const morning = new Date("2026-10-14T17:42:17.587Z");
  t("a morning count files under the Pacific day, not the catalog day", listingFileDay(morning) === "2026-10-14");
  const oct13 = [{ id: "a", date: "2026-10-13", listingsCounted: 4 }];
  const oct14 = [{ id: "b", date: "2026-10-14", listingsCounted: 2 }, { id: "a", date: "2026-10-14", listingsCounted: 5 }];
  const merged = mergeDayRows(oct13, [{ id: "b", date: "2026-10-14", listingsCounted: 2 }]);
  t("a same-day merge keeps earlier rows and adds the new ones", merged.length === 2 && merged.find((row) => row.id === "a").listingsCounted === 4);
  t("a later row for the same id replaces the earlier one", mergeDayRows(oct13, oct14).find((row) => row.id === "a").listingsCounted === 5);

  t("a price day from yesterday is not an alert", priceDayStale("2026-10-13", "2026-10-14") == null);
  const late = priceDayStale("2026-10-12", "2026-10-14");
  t("a price day more than one day old is an alert", late?.ageDays === 2 && late.id === "price-day-stale");
  return fail;
}
