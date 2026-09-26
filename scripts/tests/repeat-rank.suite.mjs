import { boardAppearances, rankFromAppearances } from "../lib/repeat-rank.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const history = [
    { date: "2026-09-20", id: "a", price: 10 },
    { date: "2026-09-20", id: "b", price: 10 },
    { date: "2026-09-21", id: "a", price: 20 },
    { date: "2026-09-21", id: "b", price: 11 },
    { date: "2026-09-22", id: "a", price: 22 },
    { date: "2026-09-22", id: "b", price: 11 },
  ];
  const days = boardAppearances(history, 1);
  t("the larger move is the one that shows up", days.find((d) => d.date === "2026-09-21").ids[0] === "a");
  const ranked = rankFromAppearances(days, new Map([["a", "Alpha"]]), "2026-09-22", [7, 30, 90]);
  t("short tape is building history", ranked.status === "building history" && ranked.rows[0].id === "a");
  t("rank rows carry no price", !("price" in (ranked.rows[0] || {})) && ranked.rows[0].days7 >= 1 && ranked.rows[0].lastSeen);
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("repeat-rank.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
