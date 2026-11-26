import { buildNights, cappedNight, rowsFromDoc } from "../lib/listing-count-git-backfill.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log(`  ok ${name}`);
  else { fail += 1; console.error(`  FAIL ${name}`); }
};

console.log("listing-count-git-backfill");
t("a night with every row on 50 is capped", cappedNight([50, 50, 50, 12]));
t("a night with a row above 50 is not capped", !cappedNight([50, 50, 51]));
t("an empty night counts as capped", cappedNight([]));
t("rows skip missing and negative counts", rowsFromDoc({ products: [{ id: "a", listingCount: 3 }, { id: "b" }, { id: "c", listingCount: -1 }] }).length === 1);
t("rows accept an object of products", rowsFromDoc({ products: { x: { id: "x", listingCount: 0 } } }).length === 1);
const { nights, skipped } = buildNights([
  { day: "2026-08-20", at: "2026-08-20T04:00:00.000Z", doc: { products: [{ id: "a", listingCount: 10 }] } },
  { day: "2026-08-20", at: "2026-08-20T20:00:00.000Z", doc: { products: [{ id: "a", listingCount: 70 }] } },
  { day: "2026-08-01", at: "2026-08-01T04:00:00.000Z", doc: { products: [{ id: "a", listingCount: 50 }, { id: "b", listingCount: 50 }] } },
]);
t("last commit of the day wins", nights["2026-08-20"]?.rows[0].listingsCounted === 70);
t("capped day is skipped with a reason", skipped.length === 1 && skipped[0].day === "2026-08-01");
if (fail) { console.error(`listing-count-git-backfill: ${fail} failed`); process.exit(1); }
