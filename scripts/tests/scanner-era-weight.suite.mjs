import { addDays } from "../lib/tracker.mjs";
import { scoreGates } from "../lib/scanner/engine.mjs";
import { eraFactorFor, factorFromPasses, resetEraFactorCache } from "../lib/scanner/era-weight.mjs";

export async function run() {
  resetEraFactorCache();
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("all eras stay at 1", factorFromPasses(3, 3) === 1);
  t("two eras sit at 0.9", factorFromPasses(2, 3) === 0.9);
  t("one era sits at 0.5", factorFromPasses(1, 3) === 0.5);
  t("no era sits at 0.25", factorFromPasses(0, 3) === 0.25);
  t("a key missing from the table is 0.25", eraFactorFor("not-a-pattern|confirmed|single|up|7d") === 0.25);
  t("flat-range confirmed 7d passed every era", eraFactorFor("flat-range|confirmed|single|flat|7d") === 1);

  const asOf = "2026-10-13";
  const baseOf = (rate) => ({ n: 40, hits: rate * 40, w: 40, wh: rate * 40, w2: 40, values: [] });
  const base = new Map();
  for (const split of ["train", "test", "all"]) base.set(`single|30d|down|${split}`, baseOf(0.2));
  const det = (i, date, hit) => ({
    id: `era-${i}-${date}`, name: `Card ${i}`, pattern: "slow-slide", stage: "confirmed", kind: "single", date, dir: "down",
    startSrc: "own", endSrc: "own", privateOnly: false, explore: false, candidate: "", metrics: {},
    grades: { "30d": { scored: true, hit, upHit: false, dir: "down", pct: -6, from: date, to: addDays(date, 30), fromSrc: "own", toSrc: "own", p0: 12, p1: 11 } },
  });
  const rows = [
    ...Array.from({ length: 22 }, (_, i) => det(i, "2026-02-01", true)),
    ...Array.from({ length: 22 }, (_, i) => det(i + 22, "2026-08-01", true)),
  ];
  const gate = scoreGates(rows, base, asOf).find((row) => row.pattern === "slow-slide" && row.horizon === 30);
  const factor = eraFactorFor("slow-slide|confirmed|single|down|30d");
  t("era weight does not change the public gate", gate?.passed === true && gate.train.passed === true && gate.test.passed === true);
  t("weight equals decayed rate times the era factor", gate && gate.weight === Math.round(gate.decayedRate * factor * 1000) / 1000 && factor > 0 && factor <= 1);

  return fail;
}
