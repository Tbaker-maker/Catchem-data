// Reads check Nov 11 (2): movers.json said "TCGplayer market, one day." while
// every change on it was a 30-day move (Mew B/RGB +13.8% was Oct 12 $3,746.75
// to Nov 11 $4,263.60, flat on the day). Rows now carry their own window.
import * as pb from "../lib/public-bundle.mjs";
import { readFile } from "node:fs/promises";
const { bestMove, moverRow, MOVERS_NOTE } = pb;

function series(start, values) {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return values.map((v, i) => [new Date(t0 + i * 86400000).toISOString().slice(0, 10), v]);
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  // 31 days, steady climb then flat for the last 6: no one-day move at all.
  const vals = [];
  for (let i = 0; i <= 30; i++) vals.push(i < 25 ? 100 + i * 2 : 148);
  const move = bestMove(series("2026-10-12", vals), "single");
  t("a flat last day can still be a mover", move && move.pct > 0);
  t("the move names a 7 or 30 day window", move && (move.window === 7 || move.window === 30));
  const row = moverRow({ id: "move-tcgcsv-1", name: "Mew", set: "x", price: move.to, changePct: Math.round(move.pct * 10) / 10, windowDays: move.window, fromPrice: move.from, fromDate: move.fromDate, href: "/c/tcgcsv-1", image: "", hist: [] });
  t("a mover row keeps its window and start", row.windowDays === move.window && row.fromPrice === move.from && row.fromDate === move.fromDate && row.id === "tcgcsv-1");
  t("the movers note never calls the change one day", !/one day|today|24 ?h/i.test(MOVERS_NOTE) && /7 or 30 days/.test(MOVERS_NOTE));
  {
    const launchDay = typeof pb.launchDay === "function" ? pb.launchDay : () => "";
    const inLaunchWindow = typeof pb.inLaunchWindow === "function" ? pb.inLaunchWindow : () => false;
    const start = "2026-09-26";
    // Pikachu ex 107 (30th Celebration): promo group dated 2025-09-26, first priced 2026-10-08.
    const promo = launchDay("2025-09-26", series("2026-10-08", [400, 300, 250]), start);
    t("a promo first priced after our files began launches on its first price", promo === "2026-10-08");
    t("a fall from a launch price is kept off Falling", inLaunchWindow("2026-10-26", promo));
    // Delta Reign Pokemon Center ETB: preorder prices from 2026-10-08, released 2026-11-06.
    const preorder = launchDay("2026-11-06", series("2026-10-08", [295, 280, 260]), start);
    t("a fall from a preorder price is kept off Falling", preorder === "2026-11-06" && inLaunchWindow("2026-10-26", preorder));
    const old = launchDay("2020-11-13", series("2026-09-26", [10, 9, 8]), start);
    t("a fall on an older card stays on Falling", old === "2020-11-13" && !inLaunchWindow("2026-10-26", old));
    const late = launchDay("2020-11-13", series("2026-09-29", [10, 9, 8]), start);
    t("a card missing from the first few files is not new", late === "2020-11-13");
    t("a fall 30 days after launch stays on Falling", !inLaunchWindow("2026-11-07", "2026-10-08") && inLaunchWindow("2026-11-06", "2026-10-08"));
    const bundle = await readFile(new URL("../build-public-bundle.mjs", import.meta.url), "utf8");
    t("the movers file drops launch falls", /changePct < 0 && !launchFalls\.has\(/.test(bundle));
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("movers-window.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("movers window ok");
}
