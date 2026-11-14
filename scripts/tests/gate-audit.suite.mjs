// Backward from Morning Pulse schema-guard. Fixture values only.
// Live files are not edited. The risks are the ones in the guard source:
// a 400-row cap, a missing schemas registry, a missing specialty input,
// and a required file that is absent.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findImpossible, specialtyBoxProblems, specialtyReadProblem, unreadableFileProblem } from "../schema-guard.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const rows = Array.from({ length: 401 }, (_, i) => ({ changePct: i === 400 ? 1128.6 : 1, priceMedian: i === 400 ? -1 : 10 }));
  const hits = findImpossible(rows, "data/heat-history.json", Date.parse("2026-11-14T12:00:00Z"));
  t("a capped sample past row 400 still fails on the percent", hits.some((h) => h.includes("[400].changePct") && h.includes("beyond any real move")));
  t("a capped sample past row 400 still fails on a negative price", hits.some((h) => h.includes("[400].priceMedian") && h.includes("cannot be negative")));
  const head = findImpossible(rows.slice(0, 400), "data/heat-history.json", Date.parse("2026-11-14T12:00:00Z"));
  t("the first 400 clean rows do not fail", head.length === 0);

  const src = readFileSync(join(ROOT, "scripts/schema-guard.mjs"), "utf8");
  const miss = src.match(/no schemas\.json[\s\S]{0,160}process\.exit\((\d)\)/);
  t("a missing schemas.json fails closed", miss?.[1] === "1" && !/no schemas\.json[\s\S]{0,80}process\.exit\(0\)/.test(src));
  t("the plausibility scan no longer stops at 400 rows", !/slice\(0,\s*400\)/.test(src));

  t("a required file that is missing is a problem", unreadableFileProblem("data/sealed-prices.json", { readers: 21 }, new Error("ENOENT"))?.includes("unreadable"));
  t("an optional file that is missing is not a problem", unreadableFileProblem("data/crosscheck-history.json", { optional: true, readers: 2 }, new Error("ENOENT")) == null);

  const box = specialtyBoxProblems({ sv3pt5: "specialty", sv1: "mainline" }, [
    { setId: "sv3pt5", subtype: "booster-box", name: "151 Booster Box" },
    { setId: "sv3pt5", subtype: "booster-pack", name: "151 Booster Pack" },
    { setId: "sv1", subtype: "booster-box", name: "Scarlet Booster Box" },
  ]);
  t("a specialty booster box fails the schema guard", box.length === 1 && box[0].includes("sv3pt5") && box[0].includes("151 Booster Box"));
  t("a specialty pack and a mainline box do not", specialtyBoxProblems({ sv3pt5: "specialty", sv1: "mainline" }, [
    { setId: "sv3pt5", subtype: "booster-pack", name: "151 Booster Pack" },
    { setId: "sv1", subtype: "booster-box", name: "Scarlet Booster Box" },
  ]).length === 0);
  const gone = specialtyReadProblem(Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }));
  t("a missing set-classes or sealed-products file fails closed", gone?.includes("could not read") && gone.includes("ENOENT"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("gate-audit.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("gate audit ok");
}
