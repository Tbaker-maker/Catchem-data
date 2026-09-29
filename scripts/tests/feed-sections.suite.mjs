import { applyShelf, assignSections } from "../lib/feed-catalogue.mjs";

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
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("feed-sections.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("feed sections ok");
}
