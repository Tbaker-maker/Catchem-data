// Run: node scripts/tests/read-ledger.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReadLedger } from "../build-read-ledger.mjs";
import { outcomeOf, banned, cleanClaim } from "../lib/read-ledger.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let failed = 0;
function t(name, cond) {
  if (cond) console.log(`  ok ${name}`);
  else { failed += 1; console.error(`  FAIL ${name}`); }
}

t("no direction is null", outcomeOf(null, { price: 1 }, { price: 2 }) === null);
t("flat into the write stays null", outcomeOf({ price: 5 }, { price: 5 }, { price: 6 }) === null);
t("same way is a hit", outcomeOf({ price: 1 }, { price: 2 }, { price: 3 }) === "hit");
t("other way is a miss", outcomeOf({ price: 1 }, { price: 2 }, { price: 1 }) === "miss");
t("unchanged later is a miss", outcomeOf({ price: 2 }, { price: 1 }, { price: 1 }) === "miss");
t("sale sentence is removed", !banned(cleanClaim("25 listings counted. A listing is not a sale.")));

const reads = JSON.parse(readFileSync(join(ROOT, "research/assets/public/reads.json"), "utf8"));
const { doc } = buildReadLedger(ROOT);
t("flag off", doc.READ_LEDGER === "off" && doc.enabled === false);
t("every read is kept", reads.reads.every((r) => doc.rows.some((row) => row.id === r.id)));
t("misses are kept", doc.counts.misses > 0);
t("no banned words", !banned(JSON.stringify(doc)));
t("no condition field", doc.rows.every((r) => !("condition" in r)));
t("null outcome is null", doc.rows.filter((r) => r.outcome == null).every((r) => r.outcome === null));
t("numbers are null or finite", doc.rows.every((r) => (r.price.n == null || Number.isFinite(r.price.n)) && (r.laterPrice.n == null || Number.isFinite(r.laterPrice.n))));
t("a number has a receipt", doc.rows.every((r) => r.price.receipt && r.laterPrice.receipt && (r.price.n == null || r.price.receipt.source)));

const sealed = JSON.parse(readFileSync(join(ROOT, "data/sealed-prices.json"), "utf8"));
const byProduct = new Map(sealed.products.map((p) => [p.id, p]));
function filePoints(product) {
  return (product?.priceHistory || [])
    .filter((h) => h && h.date && h.price != null && Number.isFinite(Number(h.price)))
    .map((h) => ({ date: h.date, price: Number(h.price) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
function fileEnds(pts, date) {
  let prior = null;
  let written = null;
  let later = null;
  for (const p of pts) {
    if (p.date < date) prior = p;
    else if (p.date === date) written = p;
    else if (!later) later = p;
  }
  return { prior, written, later };
}
function fileOutcome(prior, written, later) {
  if (!prior || !written || !later) return null;
  if (prior.price === written.price) return null;
  const direction = written.price > prior.price ? 1 : -1;
  if (later.price === written.price) return "miss";
  return (later.price > written.price ? 1 : -1) === direction ? "hit" : "miss";
}
const scored = doc.rows.filter((r) => String(r.id).startsWith("receipt-"));
console.log("HAND");
let mismatches = 0;
let shown = 0;
for (const row of scored) {
  if (shown >= 12) break;
  const body = row.id.slice("receipt-".length + 11);
  if (!body.startsWith("sealed-")) continue;
  const pid = body.slice("sealed-".length);
  const pts = filePoints(byProduct.get(pid));
  const { prior, written, later } = fileEnds(pts, row.date);
  const expectOutcome = fileOutcome(prior, written, later);
  const ok = row.price.n === (written ? written.price : null)
    && row.laterPrice.n === (later ? later.price : null)
    && row.outcome === expectOutcome
    && (written == null || row.price.receipt.date === written.date)
    && (row.price.n == null || row.price.receipt.source === "eBay asks");
  if (!ok) mismatches += 1;
  console.log(`${pid}\t${row.date}\t${written ? written.price : "null"}\t${row.price.n}\t${later ? later.price : "null"}\t${row.laterPrice.n}\t${expectOutcome}\t${row.outcome}\t${ok ? "match" : "MISS"}`);
  t(`hand ${row.id}`, ok);
  shown += 1;
}

const openRead = doc.rows.find((r) => r.id === "deep-set-sm-guardians-rising");
t("a basket read with no single later price stays open", openRead && openRead.outcome === null);

if (mismatches) t("scored hand check", false);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("read ledger tests passed");
