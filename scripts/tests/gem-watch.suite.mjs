import { readFile } from "node:fs/promises";
import { gemRows, publicGemRows, peerLagRow, sealedAgeRow, joinPokevizBridge, copyOk, loadLimits } from "../lib/gem-watch.mjs";

const limits = {
  priceFloor: 1,
  peerMin: 3,
  episodeGapDays: 10,
  quietWeekMaxPct: 5,
  climbMinPct: 6,
  climbMaxWeekPct: 5,
  climbWindowDays: 40,
  oneWeekMaxShare: 0.6,
};

const peers = [
  { printing: "holo" },
  { printing: "holo" },
  { printing: "holo" },
];

function climb(start, step) {
  const points = [];
  let price = start;
  for (let i = 0; i < 5; i++) {
    const date = new Date(Date.parse("2030-01-01T00:00:00Z") + i * 7 * 86400000).toISOString().slice(0, 10);
    points.push({ date, price: Math.round(price * 1000) / 1000 });
    price *= step;
  }
  return points;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };
  const card = { id: "c1", name: "Card A", printing: "holo", peers, points: climb(10, 1.02) };
  const rows = gemRows({ cards: [card], limits, asOf: "2030-01-29" });
  t("a steady climb fires", rows.some((r) => r.pattern === "quiet-climb"));
  const spike = gemRows({ cards: [{ ...card, id: "c2", points: [{ date: "2030-01-01", price: 10 }, { date: "2030-01-08", price: 10 }, { date: "2030-01-15", price: 10 }, { date: "2030-01-22", price: 10 }, { date: "2030-01-29", price: 16 }] }], limits, asOf: "2030-01-29" });
  t("one big week gives no row", spike.length === 0);
  t("too few peers gives no row", gemRows({ cards: [{ ...card, peers: peers.slice(0, 2) }], limits, asOf: "2030-01-29" }).length === 0);
  t("a printing mismatch gives no row", gemRows({ cards: [{ ...card, peers: [{ printing: "reverse" }, { printing: "reverse" }, { printing: "reverse" }] }], limits, asOf: "2030-01-29" }).length === 0);
  t("a missing private config gives no row", gemRows({ cards: [card], limits: null, asOf: "2030-01-29" }).length === 0);
  t("loadLimits on a missing file gives no row", (await loadLimits("/tmp/no-such-gem-watch.json")) === null);
  t("the flag off returns no public row", publicGemRows({ cards: [card], limits, asOf: "2030-01-29" }, false).length === 0);
  t("copy lint rejects a claim", !copyOk("hidden gem will breakout") && !copyOk("Buy this undervalued card"));
  t("a fact line passes the lint", rows.every((r) => copyOk(r.line) && r.source === "TCGplayer market"));
  t("peer lag returns no row", peerLagRow({ id: "c1" }) === null);
  const cohort = [
    { id: "a", type: "etb", price: 30, pokemonCenter: false },
    { id: "b", type: "etb", price: 40, pokemonCenter: false },
    { id: "c", type: "etb", price: 50, pokemonCenter: false },
    { id: "pc", type: "etb", price: 80, pokemonCenter: true, name: "Pokemon Center ETB" },
  ];
  const low = sealedAgeRow({ id: "box", name: "Standard ETB", type: "etb", price: 20, pokemonCenter: false }, cohort, limits, "2030-02-01");
  t("sealed low side fires inside its age group", low && low.pattern === "sealed-age" && low.pokemonCenter === false && copyOk(low.line));
  t("a price above the cohort median gives no row", sealedAgeRow({ id: "box2", name: "Standard ETB", type: "etb", price: 90, pokemonCenter: false }, cohort, limits, "2030-02-01") === null);
  const joined = joinPokevizBridge(
    [{ date: "2026-09-18", price: 5 }],
    [{ date: "2026-09-18", price: 9 }, { date: "2026-09-20", price: 6 }, { date: "2026-09-10", price: 7 }],
  );
  t("pokeviz fills only the bridge gap", joined.find((p) => p.date === "2026-09-20")?.source === "pokeviz" && joined.find((p) => p.date === "2026-09-18")?.price === 5 && !joined.some((p) => p.date === "2026-09-10"));
  const engine = await readFile(new URL("../lib/scanner/engine.mjs", import.meta.url), "utf8");
  const flags = JSON.parse(await readFile(new URL("../../data/flags.json", import.meta.url), "utf8"));
  t("quiet patterns stay out of the scanner while gem watch is off", flags.flags["reads.gemWatch"].value === false && !engine.includes("quiet-high") && !engine.includes("quiet-climb"));
  t("supply and wiki flags default off", flags.flags["reads.supplyWatch"].value === false && flags.flags["reads.wikiHeat"].value === false);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("gem-watch.suite.mjs")) process.exit(await run() ? 1 : 0);
