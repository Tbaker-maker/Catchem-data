// Reads check Nov 11 (2): movers.json said "TCGplayer market, one day." while
// every change on it was a 30-day move (Mew B/RGB +13.8% was Oct 12 $3,746.75
// to Nov 11 $4,263.60, flat on the day). Rows now carry their own window.
import { bestMove, moverRow, MOVERS_NOTE } from "../lib/public-bundle.mjs";

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
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("movers-window.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("movers window ok");
}
