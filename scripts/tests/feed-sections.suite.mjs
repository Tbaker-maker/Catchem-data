import { applyImageGaps, applyShelf, assignSections, selectLead, sentenceShape } from "../lib/feed-catalogue.mjs";
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
  t("a falling series is one sentence and does not restate a percent", !/not the first/.test(dug) && !/%/.test(dug) && !/\. [A-Z]/.test(dug) && dug.endsWith(".") && !/check on /.test(dug) && !/\bstored\b|last print/i.test(dug) && /latest price/.test(dug) && !repeats(dug) && !BANNED.test(dug));
  const moved = down.map((p, i) => i === down.length - 1 ? [p[0], Math.round((p[1] - 1) * 100) / 100] : p);
  const again = pathSentence(moved, { direction: "down", fromDate: "2026-09-01", toDate: "2026-09-28", fromPrice: 10, windowDays: 30 });
  t("a real point change changes the sentence", again !== dug && /latest price/.test(again));
  t("a new drop does not use the old week line", !/not the first down week/.test(first) && !/first down week/.test(first) && !/week of lower lows/.test(first) && first.endsWith(".") && !repeats(first));
  t("two paths do not share a sentence shape", shape(dug) !== shape(first));
  t("a missing series says so", pathSentence([], {}) === "A price path is missing." && pathSentence([["2026-09-27", 4]], {}) === "A price path is missing.");
  const leadCards = [
    { id: "s7", sku: "tcgcsv-1", kind: "single", name: "Small", set: "A", thin: false, score: 3, windowDays: 7, changePct: 3, path: "The latest price is $3 on Sep 27, and this 7-day window opened at $2 on Sep 20." },
    { id: "b90", sku: "tcgcsv-1", kind: "single", name: "Big", set: "A", thin: false, score: 40, windowDays: 90, changePct: -40, path: "Lower lows are still printing, and the latest price is $4 on Sep 27." },
    { id: "seal", sku: "tcgcsv-2", kind: "sealed", name: "Box", set: "B", thin: false, score: 12, windowDays: 30, changePct: 12, path: "An up week started, and the latest price is $90 on Sep 27." },
    { id: "same", sku: "tcgcsv-3", kind: "single", name: "Twin", set: "C", thin: false, score: 11, windowDays: 30, changePct: 11, path: "An up week started, and the latest price is $10 on Sep 20.", _raw: [["2026-09-26", 9], ["2026-09-27", 10]], _pathOpts: { fromPrice: 8, fromDate: "2026-08-28", toDate: "2026-09-27", windowDays: 30 } },
  ];
  const picked = selectLead(leadCards, 24);
  t("the lead keeps the larger window for a product", picked.lead.some((row) => row.id === "b90") && !picked.lead.some((row) => row.id === "s7"));
  t("sealed can sit in the lead", picked.lead.some((row) => row.kind === "sealed"));
  t("a shared shape is rewritten or left out", new Set(picked.lead.map((row) => sentenceShape(row.path))).size === picked.lead.length);
  t("a failed shape is logged with the new line", picked.rewrites.some((row) => row.failed && Object.prototype.hasOwnProperty.call(row, "next")));
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("feed-sections.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("feed sections ok");
}
