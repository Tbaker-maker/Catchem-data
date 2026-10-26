// Run: node scripts/tests/number-receipts.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  receipt, pctChange, round4, priorChange, sealedRow, singleRow, pulseRows, fieldOk, banned, filledOn,
} from "../lib/number-receipts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let failed = 0;
function t(name, cond) {
  if (cond) console.log(`  ok ${name}`);
  else { failed++; console.error(`  FAIL ${name}`); }
}

t("missing listings counted is null", receipt({ source: "eBay asks", date: "2026-10-24", method: "count of listings on file", listingsCounted: null, filled: false }).listingsCounted === null);
t("a real zero stays zero", receipt({ source: "listings counted", date: "2026-10-24", method: "count of listings on file", listingsCounted: 0, filled: false }).listingsCounted === 0);
t("no divide by zero", pctChange(0, 10) === null);
t("filled before the archive date", filledOn("2026-09-24", null) === true && filledOn("2026-09-25", null) === false);
t("archive source is filled", filledOn("2026-10-01", "archived-market") === true);

const row = sealedRow({
  id: "box", name: "Box", set: "Set", setId: "s", subtype: "booster-box",
  priceUsd: 110, lastSeen: "2026-10-24", listingCount: 4,
  priceHistory: [{ date: "2026-10-01", price: 100 }, { date: "2026-10-24", price: 110 }],
}, null, "2026-10-24");
t("sealed price receipt", fieldOk(row.price) && row.price.n === 110 && row.price.receipt.source === "eBay asks" && row.price.receipt.filled === false);
t("sealed change matches the two asks", row.change.n === round4(pctChange(100, 110)));
t("sealed has no condition", row.condition == null);
t("missing history change is null", priorChange([{ date: "2026-10-24", price: 5 }]).n === null);

const single = singleRow({ id: "tcgcsv-1", name: "Card", number: "1", price: 9.5, date: "2026-10-24" }, { name: "Set", slug: "set", asOf: "2026-10-24" }, null);
t("single receipt", fieldOk(single.price) && single.price.receipt.listingsCounted === null && single.price.receipt.source === "TCGplayer market");
t("no banned words", !banned(row.price.receipt.method) && !banned(single.price.receipt.method));

const pulse = pulseRows({
  about: "History before Sep 25 2026 comes from archived TCGplayer market prices.",
  rows: [{
    id: "swsh7-booster-box", name: "Evolving Skies Booster Box", set: "Evolving Skies",
    cells: [
      { month: "2026-09", price: null, pct: null, priceDate: null, priceSource: null },
      { month: "2026-10", price: 2214.94, pct: -4.1463, priceDate: "2026-10-24", priceSource: "tcgcsv-daily" },
    ],
  }],
});
t("a missing pulse month is not stored as 0", pulse[0].prices.length === 1 && pulse[0].prices[0].price.n === 2214.94);
t("pulse change keeps the file percent", pulse[0].prices[0].change.n === -4.1463);

// Hand check against the live sealed file. These rows must match the source, not a copy of the output.
const sealed = JSON.parse(readFileSync(join(ROOT, "data/sealed-prices.json"), "utf8"));
const want = ["swsh7-booster-box", "swsh8-booster-box", "swsh4-booster-box", "sv3pt5-etb"];
const checks = [];
for (const id of want) {
  const src = sealed.products.find((p) => p.id === id);
  const built = sealedRow(src, null, String(sealed.updatedAt).slice(0, 10));
  const ok = src && built.price.n === src.priceUsd && built.price.receipt.date === src.lastSeen;
  checks.push({ id, source: src && src.priceUsd, ours: built.price.n, date: src && src.lastSeen, ok });
  t(`hand ${id}`, ok);
}
console.log("HAND");
for (const c of checks) console.log(`${c.id}\t${c.source}\t${c.ours}\t${c.date}\t${c.ok ? "match" : "MISS"}`);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("number receipts tests passed");
