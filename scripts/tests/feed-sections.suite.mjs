import { applyImageGaps, applyShelf, assignSections } from "../lib/feed-catalogue.mjs";
import { BANNED, pathSentence } from "../lib/public-bundle.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };
  const card = (id, days, pct, sku = "tcgcsv-1") => ({
    id, sku, windowDays: days, changePct: pct, direction: pct < 0 ? "down" : "up", name: id, thin: false, score: Math.abs(pct),
  });
  const cards = {
    a: card("a", 90, 40, "tcgcsv-9"),
    b: card("b", 7, 12, "tcgcsv-7"),
    c: card("c", 7, 3, "tcgcsv-3"),
    d: card("d", 30, 9, "tcgcsv-30"),
  };
  const lists = assignSections(cards);
  const home = ["today", "watch", "cook", "up", "down"].flatMap((key) => lists[key]);
  t("a 90-day read is a cook and not a mover", lists.cook.includes("a") && !lists.up.includes("a") && !lists.down.includes("a"));
  t("a big 7-day move is a mover and not in today", lists.up.includes("b") && !lists.today.includes("b") && !lists.cook.includes("b"));
  t("a small 7-day move stays in today", lists.today.includes("c") && !lists.up.includes("c") && !lists.down.includes("c"));
  t("a 30-day read is a watch", lists.watch.includes("d") && !lists.up.includes("d"));
  t("no read is in two home sections", new Set(home).size === home.length);
  applyShelf(cards, [
    { date: "2026-09-27", sku_id: "tcgcsv-9", listing_count: 19 },
    { date: "2026-09-26", sku_id: "tcgcsv-7", listing_count: 40 },
    { date: "2026-09-27", sku_id: "tcgcsv-7", listing_count: 50 },
  ]);
  t("listings under 20 are left off", cards.a.listings == null);
  t("the newest shelf count of at least 20 is kept", cards.b.listings === 50 && cards.b.listingsAsOf === "2026-09-27");
  const gaps = {
    v: { id: "v", sku: "tcgcsv-642634", set: "SV: Black Bolt", image: "https://tcgplayer-cdn.tcgplayer.com/product/642634_in_400x400.jpg", name: "Victini (Master Ball Pattern)" },
    ok: { id: "ok", sku: "tcgcsv-42346", set: "Base Set", image: "https://tcgplayer-cdn.tcgplayer.com/product/42346_in_400x400.jpg", name: "Charizard" },
  };
  applyImageGaps(gaps, [642634], new Map([["SV: Black Bolt", "https://images.pokemontcg.io/zsv10pt5/logo.png"]]));
  t("a missing product photo is cleared and the set logo is kept", gaps.v.image === "" && gaps.v.logo === "https://images.pokemontcg.io/zsv10pt5/logo.png");
  t("a real product photo is left alone", gaps.ok.image.includes("42346") && !gaps.ok.logo);
  const down = [];
  for (let i = 0; i < 28; i += 1) {
    const day = new Date(Date.parse("2026-09-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    down.push([day, Math.round((10 - i * 0.2) * 100) / 100]);
  }
  const dug = pathSentence(down, { direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 10, windowDays: 30 });
  const flat = down.map((p, i) => [p[0], i < 21 ? 8 : p[1]]);
  const first = pathSentence(flat, { direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 8, windowDays: 30 });
  const shape = (text) => String(text).replace(/\$[0-9,.]+/g, "$").replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g, "DATE").replace(/\b\d+(?:\.\d+)?\b/g, "n");
  const repeats = (text) => {
    const prices = text.match(/\$[0-9,.]+/g) || [];
    const dates = text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g) || [];
    return new Set(prices).size !== prices.length || new Set(dates).size !== dates.length;
  };
  t("a falling series is one sentence and does not restate a percent", !/not the first/.test(dug) && !/%/.test(dug) && !/\. [A-Z]/.test(dug) && dug.endsWith(".") && /check on /.test(dug) && !repeats(dug) && !BANNED.test(dug));
  t("a new drop does not use the old week line", !/not the first down week/.test(first) && !/first down week/.test(first) && !/week of lower lows/.test(first) && first.endsWith(".") && !repeats(first));
  t("two paths do not share a sentence shape", shape(dug) !== shape(first));
  t("a missing series says so", pathSentence([], {}) === "A price path is missing." && pathSentence([["2026-09-27", 4]], {}) === "A price path is missing.");
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("feed-sections.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("feed sections ok");
}
