// Why a sealed product has no listings counted history.
// History is two or more nights of filteredTotal on data/sealed-prices.json.
// A name is not a product id. All-arts parents stay unlinked.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { filteredTotalForNight } from "../lib/second-library.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CAP = 150;

function nights(product) {
  return (product.priceHistory || []).filter((point) => Number.isInteger(point?.filteredTotal) && point.filteredTotal >= 0).length;
}

export function listingsGap(product) {
  const n = nights(product);
  if (n >= 2) return "history";
  if (n === 1) return "one-night";
  const last = (product.priceHistory || []).at(-1);
  const fetched = product.filterReport?.fetched;
  const kept = product.filterReport?.kept;
  const total = last?.total;
  const would = filteredTotalForNight({
    browseTotal: total,
    fetched,
    kept,
    complete: Number.isInteger(fetched) && fetched < CAP,
    pageCap: CAP,
  });
  if (would != null && !Number.isInteger(last?.filteredTotal)) return "short-page";
  if (!last) return "no-history-point";
  if (typeof total === "number" && Number.isInteger(fetched) && total > fetched) return "capped";
  if (Number.isInteger(fetched) && fetched >= CAP) return "capped";
  return "other";
}

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

export async function run() {
  const prices = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
  const products = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
  const byId = new Map(products.map((row) => [row.id, row]));
  const live = (prices.products || []).filter((row) => row.dataStatus === "live");
  const counts = {};
  const ids = {};
  for (const row of live) {
    const why = listingsGap(row);
    counts[why] = (counts[why] || 0) + 1;
    (ids[why] ||= []).push(row.id);
  }
  t("every live sealed product has a listings counted reason", live.length > 0 && (counts.other || 0) === 0);
  t("listings counted history is the filtered count, not a capped sample", listingsGap({
    dataStatus: "live",
    priceHistory: [{ date: "2026-11-12", total: 400 }],
    filterReport: { fetched: 150, kept: 40 },
  }) === "capped");
  t("a short page is the gap the next nightly can record", listingsGap({
    dataStatus: "live",
    priceHistory: [{ date: "2026-11-12", total: 83 }],
    filterReport: { fetched: 84, kept: 37 },
  }) === "short-page");
  const tracked = products.filter((row) => row.ebay !== false);
  t("every tracked sealed product has an eBay query", tracked.every((row) => typeof row.searchQuery === "string" && row.searchQuery.trim()));
  const cross = JSON.parse(await readFile(join(ROOT, "data/sealed-id-crosswalk.json"), "utf8"));
  const split = (cross.products || []).filter((row) => String(row.why || "").startsWith("already split") && byId.has(row.id));
  t("all-arts parents stay without a guessed product id", split.length > 0 && split.every((row) => byId.get(row.id).tcgPlayerId == null));
  console.log("  listings counted gap:", JSON.stringify(counts));
  if (ids["short-page"]) console.log("  short-page:", ids["short-page"].join(", "));
  if (ids["one-night"]) console.log("  one-night:", ids["one-night"].join(", "));
  const unlinked = live.filter((row) => byId.get(row.id)?.tcgPlayerId == null && row.tcgPlayerId == null).map((row) => row.id);
  if (unlinked.length) console.log("  no product id:", unlinked.join(", "));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("sealed-listings-gap.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
