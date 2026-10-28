// LOCK.md gates as CI (2026-10-27). Notes are not tests.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEALED_PRICE_SOURCE,
  SEALED_PRICE_SOURCE_LOW,
} from "../lib/sealed-tcg-price.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("sealed price source is TCGplayer market", SEALED_PRICE_SOURCE === "TCGplayer market");
  t("low listing source is labeled", SEALED_PRICE_SOURCE_LOW === "TCGplayer low listing");

  const prices = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
  const products = prices.products || [];
  const live = products.filter((p) => p.dataStatus === "live" && p.priceMedian);
  t("live sealed products exist", live.length >= 20);
  const badPrice = live.filter((p) => p.priceSource && !/TCGplayer/i.test(String(p.priceSource)));
  t("live priceSource stays on TCGplayer labels", badPrice.length === 0);
  const soldHits = products.filter((p) => /\bsold\b|\bsales\b/i.test(JSON.stringify({
    priceSource: p.priceSource, listingsSource: p.listingsSource, read: p.read, note: p.note,
  })));
  t("sealed price labels have no sold wording", soldHits.length === 0);

  const lib = await readFile(join(ROOT, "scripts/lib/sealed-tcg-price.mjs"), "utf8");
  t("lib names eBay as listings counted", /listings counted/i.test(lib));

  const mapping = JSON.parse(await readFile(join(ROOT, "data/history/tcgplayer-market/mapping.json"), "utf8"));
  const mapIds = new Set((mapping.entries || []).map((e) => e.id));
  t("sv1 PC art logos mapped", mapIds.has("sv1-pc-etb-miraidon") && mapIds.has("sv1-pc-etb-koraidon"));
  t("Mega Forces set of 3 mapped", mapIds.has("tcgcsv-702508"));

  const derived = await readFile(join(ROOT, "scripts/compute-derived.mjs"), "utf8");
  t("Morning Pulse has depth sealed fallback", derived.includes("fromLiveMarket") && derived.includes("depthRows"));
  const pub = await readFile(join(ROOT, "scripts/lib/publish-checks.mjs"), "utf8");
  t("publish checks treat watch shards as rotating", pub.includes("feed/watch/"));

  if (fail) {
    console.error(`lock-regression.suite: ${fail} failed`);
    process.exitCode = 1;
  } else {
    console.log("lock-regression.suite: all passed");
  }
  return fail;
}

const isMain = process.argv[1] && process.argv[1].endsWith("lock-regression.suite.mjs");
if (isMain) await run();
