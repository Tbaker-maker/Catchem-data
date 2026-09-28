import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED, bestMove, changePct, headlineFor, money, rankReads, whyFor } from "../lib/public-bundle.mjs";

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
  t("why uses the whole series and skips the old 30-day line", /^Has fallen \d+ of the last 30 days\.$/.test(why) && !/last 30 days ran|low of the last 30|high of the last 30/i.test(why));
  const led = headlineFor({ name: "151 Elite Trainer Box", set: "SV: Scarlet & Violet 151", release: "2023-09-22", price: down.at(-1)[1], fromPrice: down[30][1], changePct: -17.6, windowDays: 30, toDate: down.at(-1)[0], fromDate: down[30][0], hist: down });
  t("a series low leads when it is the stronger fact", led.startsWith("151 Elite Trainer Box (Scarlet & Violet 151) hit its lowest price since at least April") && led.includes("down 17.6% in 30 days"));
  const thin = down.map((p, i) => [p[0], i < 20 ? 80 : p[1]]);
  t("a flat stretch is a thin market", whyFor(thin, { fromDate: thin[10][0], toDate: thin.at(-1)[0], changePct: -10 }) === "Few sales, so moves come in jumps.");
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
    const oldWhy = /last 30 days ran|low of the last 30|high of the last 30/i;
    const bad = reads.reads.filter((row) => !money(row.price) || !row.headline || !row.why || BANNED.test(row.headline) || BANNED.test(row.why || "") || row.price === 0 || !/\b(over|in) (7|30) days\b/.test(row.headline) || !/\([^)]+\)/.test(row.headline) || oldWhy.test(row.why) || oldWhy.test(row.headline) || /\b(heating up|cooling off|last print|Top card in|checked again)\b/i.test(row.headline));
    t("every read has a price, a window, and a clean headline", bad.length === 0);
    t("a read is one kind", reads.reads.every((row) => row.kind === "single" || row.kind === "sealed"));
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
