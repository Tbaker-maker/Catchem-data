// Run: node scripts/tests/supply-runway.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { isoWeek, weeklySeries, runwayWeeks, limitsOk, productRow, banned } from "../lib/supply-runway.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fake = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/supply-runway-limits.json"), "utf8"));
let failed = 0;
function t(name, cond) {
  if (cond) console.log(`  ok ${name}`);
  else { failed++; console.error(`  FAIL ${name}`); }
}

t("fixture loads", limitsOk(fake));
t("empty limits refused", limitsOk(null) === false && limitsOk({}) === false);
t("week of Oct 13", isoWeek("2026-10-13") === "2026-W42");
t("week of Oct 24", isoWeek("2026-10-24") === "2026-W43");

const weeks = weeklySeries([
  { date: "2026-10-13", listingsCounted: 20 },
  { date: "2026-10-18", listingsCounted: 16 },
  { date: "2026-10-24", listingsCounted: 10 },
]);
t("last count in the week wins", weeks.length === 2 && weeks[0].n === 16 && weeks[1].n === 10);
const run = runwayWeeks(weeks, fake);
t("runway is current over the drop", run.n === Math.round((10 / 6) * 100) / 100);
t("flat series is null not zero", runwayWeeks([{ n: 10 }, { n: 10 }], fake).n === null);
t("one week is null not zero", runwayWeeks([{ n: 10 }], fake).n === null);
t("a missing count is skipped", weeklySeries([{ date: "2026-10-13", listingsCounted: null }, { date: "2026-10-14", listingsCounted: 4 }]).length === 1);

const row = productRow({ id: "box", name: "Box", set: "Set", subtype: "booster-box" }, [
  { date: "2026-10-13", listingsCounted: 20 },
  { date: "2026-10-24", listingsCounted: 10 },
], fake);
t("row has a receipt", row.weeks[0].listingsCounted.receipt.listingsCounted === 20 && row.weeks[0].listingsCounted.receipt.filled === false);
t("no condition", row.condition == null);
t("no banned words", !banned(JSON.stringify(row)) && !banned("Each week is the last listings counted in that week."));

// Hand check: the priced box uses the sealed file count. A history id uses the raw gz.
const sealed = JSON.parse(readFileSync(join(ROOT, "data/sealed-prices.json"), "utf8"));
const product = sealed.products.find((p) => p.id === "swsh7-booster-box");
const box = productRow(product, [{ date: product.lastSeen, listingsCounted: product.listingCount, origin: "sealed-file" }], fake);
t("hand sealed file count", box.current.n === product.listingCount && box.weeks.length === 1 && box.runwayWeeks.n === null);
console.log(`HAND\t${product.id}\t${product.lastSeen}\t${product.listingCount}\t${box.current.n}\t${box.current.n === product.listingCount ? "match" : "MISS"}`);

const dir = join(ROOT, "data/derived/listing-counts/history");
const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort();
const bag = [];
for (const name of files) {
  const doc = JSON.parse(gunzipSync(readFileSync(join(dir, name))).toString("utf8"));
  for (const r of doc.rows || []) {
    if (r && r.kind === "sealed" && r.id === "tcgcsv-148226" && r.listingsCounted != null) {
      bag.push({ date: r.date || doc.date, listingsCounted: r.listingsCounted, origin: "history" });
    }
  }
}
const again = weeklySeries(bag);
const histRow = productRow({ id: "tcgcsv-148226", name: "Premium Trainer's XY Collection", set: "Alternate Art Promos", subtype: "special-collection" }, bag, fake);
t("hand history weeks", bag.length > 0 && histRow.weeks.length === again.length);
if (again.length) {
  t("hand history last", histRow.weeks.at(-1).listingsCounted.n === again.at(-1).n);
  console.log(`HAND\ttcgcsv-148226\t${again.at(-1).week}\t${again.at(-1).date}\t${again.at(-1).n}\t${histRow.weeks.at(-1).listingsCounted.n}\tmatch`);
}

