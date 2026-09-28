import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED, bestMove, changePct, chartSeries, dropTiledCycles, headlineFor, isThinSeries, money, rankReads, selectFeedReads, spikeDates, whyFor, whyPattern } from "../lib/public-bundle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("money drops zero, blank, and NaN", money(0) === null && money(null) === null && money("nope") === null && money(12.5) === "$12.50");
  t("a cheap base or a wild move is not a percent", changePct(1.5, 3) === null && changePct(10, 20) === null && changePct(10, 12) === 20);
  const down = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.parse("2026-04-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    down.push([d, Math.round((100 - i * 0.4) * 100) / 100]);
  }
  const move = bestMove(down, "single");
  const banned = headlineFor({ name: "Latias & Latios GX", set: "Team Up", price: move.to, fromPrice: move.from, changePct: move.pct, windowDays: move.window });
  t("a headline names the window and the two prices", move.window === 30 && banned.includes("over 30 days") && banned.includes("is down") && banned.includes("(Team Up)") && !banned.includes("heating") && !/\bprint\b/i.test(banned) && !BANNED.test(banned));
  const spike = down.map((p, i) => i === 50 ? [p[0], p[1] * 3] : p);
  t("a one-day spike is not a read", bestMove(spike, "single") === null || bestMove(down.map((p, i) => [p[0], i === 50 ? 400 : 100]), "single") === null);
  const stuck = down.map((p, i) => [p[0], i < 50 ? 100 : 140]);
  t("one step that stays put is not three days", bestMove(stuck, "single") === null);
  const jumped = down.map((p, i) => [p[0], i < 59 ? 20 + i * 0.05 : 200]);
  t("one day cannot be most of the move", bestMove(jumped, "single") === null);
  const old = headlineFor({ name: "Charizard", set: "Base Set", year: 1999, release: "1999-01-09", number: "004/102", price: 3914, fromPrice: 4500, changePct: -13, windowDays: 30, toDate: "2026-09-27" });
  t("an old card names the set and the year", old === "Charizard (Base Set, 1999, #4) is down 13% over 30 days, from $4,500 to $3,914.");
  const gengar = headlineFor({ name: "Mega Gengar ex - 284/217", set: "ME: Ascended Heroes", number: "284/217", release: "2026-01-30", price: 866.33, fromPrice: 984.26, changePct: -12, windowDays: 30, toDate: "2026-09-27" });
  t("a suffix becomes the collector number", gengar === "Mega Gengar ex (Ascended Heroes, #284) is down 12% over 30 days, from $984.26 to $866.33.");
  const accent = headlineFor({ name: "Pokemon Catcher", set: "Test Set", price: 12.5, fromPrice: 10, changePct: 25, windowDays: 7, toDate: "2026-09-27" });
  t("Pokémon stays accented", accent.startsWith("Pokémon Catcher (Test Set) is up 25% over 7 days"));
  const why = whyFor(down);
  t("why uses the whole series and skips the old 30-day line", why.length > 0 && !/last 30 days ran|low of the last 30|high of the last 30|we store|at least/i.test(why));
  const led = headlineFor({ name: "151 Elite Trainer Box", set: "SV: Scarlet & Violet 151", release: "2023-09-22", price: down.at(-1)[1], fromPrice: down[30][1], changePct: -17.6, windowDays: 30, toDate: down.at(-1)[0], fromDate: down[30][0], hist: down });
  t("a series low leads when it is the stronger fact", led.startsWith("151 Elite Trainer Box (Scarlet & Violet 151) hit its lowest price since April") && led.includes("down 17.6% in 30 days") && !/at least|we store/i.test(led));
  const long = [];
  for (let i = 0; i < 170; i++) {
    const d = new Date(Date.parse("2026-04-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    long.push([d, Math.round((80 - i * 0.2) * 100) / 100]);
  }
  const six = headlineFor({ name: "Lost Thunder Booster Box", set: "SM - Lost Thunder", release: "2018-11-02", price: long.at(-1)[1], fromPrice: long.at(-30)[1], changePct: -8, windowDays: 30, toDate: long.at(-1)[0], hist: long });
  t("a long series says a 6-month low", six.includes("hit a 6-month low") && !/we store|at least/i.test(six));
  const thinPts = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.parse("2026-08-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    thinPts.push([d, i < 25 ? 50 : Math.round((50 - (i - 24) * 1.5) * 100) / 100]);
  }
  const thinCopy = headlineFor({ name: "Arceus LV.X", set: "Diamond and Pearl Promos", number: "DP53", release: "2007-05-01", price: thinPts.at(-1)[1], fromPrice: thinPts[10][1], changePct: -20, windowDays: 30, toDate: thinPts.at(-1)[0], hist: thinPts });
  t("a thin series is not a record and says on few sales", isThinSeries(thinPts) && thinCopy.includes("on few sales") && !/6-month|highest price|lowest price/i.test(thinCopy));
  const tiled = [];
  const seed = [10, 10, 9];
  for (let i = 0; i < 15; i++) tiled.push([new Date(Date.parse("2026-03-31T00:00:00Z") + i * 86400000).toISOString().slice(0, 10), seed[i % 3]]);
  tiled.push(["2026-04-15", 12], ["2026-04-16", 12.4]);
  const cleaned = dropTiledCycles(tiled);
  t("a 3-day tiled cycle keeps only the first three days", cleaned.length === 5 && cleaned[2][1] === 9 && cleaned[3][0] === "2026-04-15");
  const spiked = down.map((p, i) => i === 40 ? [p[0], p[1] * 0.4] : p);
  const drawn = chartSeries(spiked);
  t("a one-day spike is left off the chart", drawn.length === spiked.length - 1 && !drawn.some((p) => p[0] === spiked[40][0]) && !headlineFor({ name: "Mega Gengar ex", set: "ME: Ascended Heroes", number: "284/217", release: "2026-01-30", price: spiked.at(-1)[1], fromPrice: spiked[30][1], changePct: -8, windowDays: 30, hist: spiked, toDate: spiked.at(-1)[0] }).includes(String(spiked[40][1])));
  const gengarApril = [
    ["2026-04-14", 1199.04], ["2026-04-15", 1213.21], ["2026-04-16", 1245.44], ["2026-04-17", 1243.94],
    ["2026-04-18", 1261.54], ["2026-04-19", 1269.14], ["2026-04-20", 1279.54], ["2026-04-21", 1268.24],
    ["2026-04-22", 1293.56], ["2026-04-23", 1284.21], ["2026-04-24", 792.62], ["2026-04-25", 727.76],
    ["2026-04-26", 1291.94], ["2026-04-27", 924.79], ["2026-04-28", 1492.76], ["2026-04-29", 1304.65],
    ["2026-04-30", 1490.65], ["2026-05-01", 1424.59], ["2026-05-02", 1469.33], ["2026-05-03", 1423.96],
    ["2026-05-04", 1348.06], ["2026-05-05", 1260.97], ["2026-05-06", 818.98], ["2026-05-07", 1057.55],
    ["2026-05-08", 1420.03],
  ];
  const gengarSpikes = spikeDates(gengarApril);
  const gengarChart = chartSeries(gengarApril);
  const gengarCopy = headlineFor({ name: "Mega Gengar ex - 284/217", set: "ME: Ascended Heroes", number: "284/217", release: "2026-01-30", price: 866.33, fromPrice: 984.26, changePct: -12, windowDays: 30, toDate: "2026-09-27", hist: gengarApril }) + whyFor(gengarApril, { name: "Mega Gengar ex - 284/217", set: "ME: Ascended Heroes", number: "284/217", release: "2026-01-30", price: 866.33, fromPrice: 984.26, changePct: -12, windowDays: 30, toDate: "2026-09-27" });
  t("Gengar April 24 to 28 drops the bad cluster and does not draw it", gengarSpikes.has("2026-04-24") && gengarSpikes.has("2026-04-25") && gengarSpikes.has("2026-04-27") && !gengarChart.some((p) => ["2026-04-24", "2026-04-25", "2026-04-27"].includes(p[0])) && !gengarChart.some((p) => p[1] > 800 && p[1] < 860) && !/792\.62|727\.76|924\.79|831\.70|834\.74/.test(gengarCopy));
  const sameSet = [1, 2, 3].map((n) => ({ type: "mover", price: 20, fromPrice: 10, changePct: -10, windowDays: 30, set: "ME: Ascended Heroes", name: "Card " + n, score: 100 - n, hist: down, toDate: down.at(-1)[0], release: "2026-01-30" }));
  const other = { type: "mover", price: 20, fromPrice: 10, changePct: 12, windowDays: 30, set: "Base Set", name: "Other", score: 50, hist: down.map((p, i) => [p[0], 40 + i]), toDate: down.at(-1)[0], release: "1999-01-09" };
  const capped = selectFeedReads([...sameSet, other], 12);
  t("at most two reads from one set", capped.filter((row) => row.set === "ME: Ascended Heroes").length <= 2 && new Set(capped.map((row) => whyPattern(row.why))).size === capped.length);
  const dropped = rankReads([
    { type: "mover", price: 10, headline: "This is a buy.", set: "A", score: 9 },
    { type: "mover", price: 10, headline: "Pikachu is up 4% over 7 days, from $10 to $10.40.", set: "A", score: 2 },
  ], 5);
  t("a banned headline never ranks", dropped.length === 1 && !BANNED.test(dropped[0].headline));
  const many = Array.from({ length: 20 }, (_, i) => ({ type: "mover", price: 10 + i, headline: `Card ${i} is up 9% over 7 days, from $10 to $10.90.`, set: "S" + (i % 3), score: i }));
  t("the list stops at 12", rankReads(many, 12).length === 12);

  try {
    const counts = JSON.parse(await readFile(join(ROOT, "research/assets/public/counts.json"), "utf8"));
    const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
    t("counts add up and slabs stay at zero", counts.items === counts.single + counts.sealed && counts.slab === 0 && counts.single > 20000);
    t("the day has at most 12 reads", reads.reads.length <= 12);
    const oldWhy = /last 30 days ran|low of the last 30|high of the last 30|we store|at least/i;
    const bad = reads.reads.filter((row) => !money(row.price) || !row.headline || !row.why || BANNED.test(row.headline) || BANNED.test(row.why || "") || row.price === 0 || !/\b(over|in) (7|30) days\b/.test(row.headline) || !/\([^)]+\)/.test(row.headline) || oldWhy.test(row.why) || oldWhy.test(row.headline) || /\b(heating up|cooling off|last print|Top card in|checked again)\b/i.test(row.headline));
    t("every read has a price, a window, and a clean headline", bad.length === 0);
    t("a read is one kind", reads.reads.every((row) => row.kind === "single" || row.kind === "sealed"));
    const patterns = reads.reads.map((row) => whyPattern(row.why));
    t("no repeated why pattern", patterns.length === new Set(patterns).size);
    const bySet = new Map();
    for (const row of reads.reads) bySet.set(row.set, (bySet.get(row.set) || 0) + 1);
    t("at most two reads from one set", [...bySet.values()].every((n) => n <= 2));
    const thinTop = reads.reads.filter((row, i) => i < 3 && (/on few sales/i.test(row.headline) || isThinSeries(row.hist, row.toDate)));
    const thinClaim = reads.reads.filter((row) => /on few sales/i.test(row.headline) && (/6-month|highest price|lowest price/i.test(row.headline) || row.n < 4));
    t("no thin item in the first three or making a record claim", thinTop.length === 0 && thinClaim.length === 0);
    const fallen = reads.reads.map((row) => row.why.match(/Has fallen (\d+) of the last 30 days/)).filter(Boolean);
    t("fallen-days why is used once and only past 15", fallen.length <= 1 && fallen.every((m) => Number(m[1]) >= 15));
    const bucket = JSON.parse(await readFile(join(ROOT, "research/assets/public/buckets/96.json"), "utf8"));
    const gengarCard = bucket.find((card) => card.id === "tcgcsv-676096");
    const dip = (gengarCard?.hist || []).filter((pt) => pt[0] === "2026-04-24" || pt[0] === "2026-04-25" || pt[0] === "2026-04-27");
    const standIn = (gengarCard?.hist || []).some((pt) => pt[0] >= "2026-04-24" && pt[0] <= "2026-04-27" && pt[1] > 800 && pt[1] < 860);
    t("the Gengar April spike is gone from the chart", gengarCard && dip.length === 0 && !standIn);
  } catch (err) {
    t("public bundle is on disk", false);
    console.error(err);
  }
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("public-bundle.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
