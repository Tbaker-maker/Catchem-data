// Floor: a published move needs at least $1 and at least 3%.
// Machamp and Aegislash prices are read from the daily files. Nothing here is filled in.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { feedWindow } from "../lib/public-bundle.mjs";
import { buildReadLibrary } from "../lib/read-library.mjs";
import { floorOk, moverGate, streakGate } from "../lib/read-quality.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const START = "2026-10-03";
const END = "2026-10-10";

function pctOf(from, to) {
  return Math.round((((to - from) / from) * 100) * 10) / 10;
}

function climb(from, to, days, end) {
  const pts = [];
  for (let i = 0; i <= days; i += 1) {
    const date = new Date(Date.parse(`${end}T00:00:00Z`) - (days - i) * 86400000).toISOString().slice(0, 10);
    const price = Math.round((from + ((to - from) * i) / days) * 100) / 100;
    pts.push([date, price]);
  }
  return pts;
}

async function market(day, id) {
  const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", `${day}.json`), "utf8"));
  const row = (doc.prices || []).find((item) => item.id === id);
  return row ? Number(row.market) : null;
}

function card({ id, name, price, changePct }) {
  return {
    id: `move-${id}-7`,
    sku: id,
    kind: "single",
    name,
    set: "Test",
    headline: `${name} is ${changePct < 0 ? "down" : "up"} ${Math.abs(changePct)}% over 7 days.`,
    path: `${name} is ${changePct < 0 ? "down" : "up"} ${Math.abs(changePct)}% over 7 days.`,
    price,
    changePct,
    windowDays: 7,
    asOf: END,
    source: "TCGplayer market",
    href: `/c/${id}`,
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const machampFrom = await market(START, 124072);
  const machampTo = await market(END, 124072);
  const aegisFrom = await market(START, 226581);
  const aegisTo = await market(END, 226581);
  const victiniFrom = await market(START, 175275);
  const victiniTo = await market(END, 175275);
  const machampPct = pctOf(machampFrom, machampTo);
  const aegisPct = pctOf(aegisFrom, aegisTo);
  const victiniPct = pctOf(victiniFrom, victiniTo);

  t("Machamp 2026-10-10 file price is $4.76 and the 7-day move is 7.9%", machampTo === 4.76 && machampFrom === 4.41 && machampPct === 7.9);
  t("Aegislash V 2026-10-10 file price is $3.02 and the 7-day move is 7.9%", aegisTo === 3.02 && aegisFrom === 2.8 && aegisPct === 7.9);
  t("Victini file pair clears $1 and 3%", victiniFrom === 10.6 && victiniTo === 22.93 && floorOk(victiniFrom, victiniTo, victiniPct));
  t("Machamp and Aegislash miss the dollar floor", floorOk(machampFrom, machampTo, machampPct) === false && floorOk(aegisFrom, aegisTo, aegisPct) === false);
  t("the 8% mover bar still rejects 7.9%", moverGate({ days: 7, from: machampFrom, to: machampTo, pct: machampPct, start: START, end: END }) === false);
  t("a streak uses its own series gap", streakGate({ asOf: END, n: 4, first: machampFrom, last: machampTo }) === false && streakGate({ asOf: END, n: 4, first: victiniFrom, last: victiniTo }) === true);

  const series = new Map([
    [124072, new Map([[START, machampFrom], [END, machampTo]])],
    [226581, new Map([[START, aegisFrom], [END, aegisTo]])],
    [175275, new Map([[START, victiniFrom], [END, victiniTo]])],
  ]);
  const lib = buildReadLibrary({
    catalogue: {
      asOf: END,
      source: "TCGplayer market",
      cards: {
        machamp: card({ id: "tcgcsv-124072", name: "Machamp", price: machampTo, changePct: machampPct }),
        aegis: card({ id: "tcgcsv-226581", name: "Aegislash V", price: aegisTo, changePct: aegisPct }),
        victini: card({ id: "tcgcsv-175275", name: "Victini", price: victiniTo, changePct: victiniPct }),
      },
    },
    extra: { lag: { reads: [] }, group: { reads: [] } },
    series,
  });
  t("Machamp drops", !lib.board.some((row) => row.sku === "tcgcsv-124072") && lib.counts.plain.qualified === 0 && lib.counts.mover.qualified === 1);
  t("Aegislash V drops", !lib.board.some((row) => row.sku === "tcgcsv-226581") && !lib.signals.some((row) => row.sku === "tcgcsv-226581"));
  t("Victini stays", lib.board.some((row) => row.sku === "tcgcsv-175275" && row.signal === "mover"));

  t("a 2% climb is not a window", feedWindow(climb(40, 40.8, 90, END), 90) === null);
  t("a 10% move under $1 is not a window", feedWindow(climb(4, 4.4, 90, END), 90) === null);
  const kept = feedWindow(climb(20, 21, 90, END), 90);
  t("a $1 and 5% climb still counts", kept && kept.window === 90 && Math.abs(kept.pct) >= 3);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("floor.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
