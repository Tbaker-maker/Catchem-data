// scripts/tests/run-tests.mjs — fail-fast unit + contract tests.
// Runs FIRST in the daily workflow (before any fetch): pure-math tests import
// the same lib the engines ship, contract tests validate yesterday's committed
// artifacts. Any failure kills the run before API quota burns.
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexLevel, offTcgEra, sealedPremium, mergeByDate } from "../lib/instruments.mjs";
import { runTcgcsvCatalogTests } from "./tcgcsv-catalog.test.mjs";
import { runPptPlanTests } from "./ppt-plan.test.mjs";
import { runSealedIdTests } from "./sealed-id-match.test.mjs";
import { runStressTests } from "./stress.test.mjs";
import { enterIndex } from "../lib/index-baskets.mjs";
import { searchItems } from "../lib/search-rank.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const J = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf-8"));
let pass = 0, fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
};

console.log("── index math ──");
t("empty basket defaults to 100.0", indexLevel([]) === 100.0);
t("flat basket is exactly 100.0", indexLevel([1, 1, 1]) === 100.0);
t("symmetric moves cancel", indexLevel([1.1, 0.9]) === 100.0);
{
  const before = indexLevel([1.1, 0.9]);
  const afterAdd = indexLevel([1.1, 0.9, 1.0]); // entrant at its own baseline
  t("composition invariance: entrant at baseline never jumps the level", before === afterAdd,
    `${before} → ${afterAdd}`);
  t("known value: [1.2, 1.0] → 110.0", indexLevel([1.2, 1.0]) === 110.0);
}

console.log("── venue gate (RT-4a) ──");
for (const id of ["sm1-etb", "sm35-etb", "base1-booster-box", "neo1-booster-box", "hgss1-booster-box", "xy12-etb", "bw1-booster-box", "det1-etb", "dp1-booster-box"])
  t(`${id} gated`, offTcgEra(id) === true);
for (const id of ["sv9-booster-box", "swsh7-pack", "me1-booster-box", "cel25-upc", "swsh12pt5-bb"])
  t(`${id} NOT gated`, offTcgEra(id) === false);

console.log("── sealed premium (thin-n aware) ──");
{
  const p = sealedPremium(80.56, 54.95, 64);
  t("EvSkies math: +46.6%", p.pct === 46.6, String(p.pct));
  t("healthy n → not thin", p.thin === false);
  const thin = sealedPremium(9.19, 9.39, 7);
  t("me1 math: -2.1%", thin.pct === -2.1, String(thin.pct));
  t("n=7 → thin flag", thin.thin === true);
  t("no loose lane → null pct", sealedPremium(10, null, null).pct === null);
  t("null pct never thin", sealedPremium(10, null, null).thin === false);
}

console.log("── merge-by-date (8-vs-329 guard) ──");
{
  const existing = [];
  for (let d = 1; d <= 329; d++) existing.push({ date: `2026-07-${String((d % 28) + 1).padStart(2, "0")}`, id: "p" + d, v: d });
  const todays = Array.from({ length: 8 }, (_, i) => ({ date: "2026-08-19", id: "q" + i }));
  const merged = mergeByDate(existing, todays, "2026-08-19");
  t("8 fresh rows never replace 329", merged.length === 337, String(merged.length));
  const twice = mergeByDate(merged, todays, "2026-08-19");
  t("same-day rerun is idempotent", twice.length === 337, String(twice.length));
  t("prior history survives verbatim", twice.filter((e) => e.date !== "2026-08-19").length === 329);
}

console.log("── artifact contracts (yesterday's committed run) ──");
try {
  const div = await J("data/divergence-report.json");
  const gatedSignals = (div.rows || []).filter((r) => r.signal && offTcgEra(r.id));
  t("no gated era ever signals", gatedSignals.length === 0, gatedSignals.map((r) => r.id).join(","));
} catch (e) { t("divergence-report readable", false, e.message); }
try {
  const hh = await J("data/heat-history.json");
  const keys = new Set(hh.map((r) => r.date + "·" + r.id));
  t("heat-history has no duplicate date+id rows", keys.size === hh.length, `${keys.size} vs ${hh.length}`);
  t("heat-history is post-cut only", hh.every((r) => r.date >= "2026-08-18"));
} catch (e) { t("heat-history readable", false, e.message); }
try {
  const feed = await J("research/pulse/pulse-feed.json");
  t("feed carries the full catalog", (feed.products || []).length >= 150, String(feed.products?.length));
  t("feed history is arrays of [date,price,listings]", Object.values(feed.history || {}).every((h) => Array.isArray(h) && h.every((r) => Array.isArray(r))));
} catch (e) { t("pulse-feed readable", false, e.message); }

console.log("── share-card mint smoke ──");
// A CARD IS ONLY REQUIRED IF ITS DATA EXISTS. This asserted all four cards
// unconditionally, and on 2026-08-23 that killed the entire daily run: graded
// figures were withdrawn (deliberately - the source carries no window), so
// dailyThree.graded went falsy, so mint-cards stopped minting latest-graded.svg,
// so the committed fossil was deleted, so this assertion failed - and it runs in
// the FAIL-FAST gate, BEFORE the eBay fetch. A correct editorial decision took
// the whole pipeline down through a test that asserted a FILE rather than a
// BEHAVIOUR. The run fired at 04:38 UTC and died at step 6 of 23.
//
// Each card is now required exactly when mint-cards would mint it: when the
// matching dailyThree entry is present. A card whose data is withdrawn is not
// a missing card, it is an absent subject.
let t3 = {};
try { t3 = (await J("data/derived-insights.json")).dailyThree ?? {}; } catch {}
for (const name of ["index", "sealed", "graded", "raw"]) {
  const required = name === "index" ? true : !!t3[name];
  try {
    const s = await stat(join(ROOT, `research/pulse/cards/latest-${name}.svg`));
    t(`latest-${name}.svg exists nonzero`, s.size > 200, String(s.size));
  } catch {
    if (required) t(`latest-${name}.svg exists nonzero`, false, "missing");
    else console.log(`  - latest-${name}.svg absent, and dailyThree.${name} is absent too - not a failure`);
  }
}

console.log("── tcgcsv catalog ──");
{
  const n = runTcgcsvCatalogTests();
  t("tcgcsv catalog suite", n === 0, `${n} failed`);
}

console.log("── ppt plan ──");
{
  const n = await runPptPlanTests();
  t("ppt plan suite", n === 0, `${n} failed`);
}

console.log("── sealed id match ──");
{
  const n = await runSealedIdTests();
  t("sealed id match suite", n === 0, `${n} failed`);
}

console.log("── index stress ──");
{
  const n = runStressTests();
  t("stress suite", n === 0, `${n} failed`);
}

console.log("── chain-linked entry ──");
{
  const prices = new Map([
    ["a", new Map([["2026-03-31", 100], ["2026-04-01", 110]])],
    ["b", new Map([["2026-04-01", 50]])],
  ]);
  const elig = new Map([["2026-03-31", new Set(["a"])], ["2026-04-01", new Set(["a", "b"])]]);
  const entered = enterIndex(["2026-03-31", "2026-04-01"], prices, elig, ["a", "b"]);
  t("new constituent does not jump a chain-linked index", entered.points[1].equal === 110 && entered.points[1].entered === 1, JSON.stringify(entered.points[1]));
}

console.log("── search rank ──");
{
  const rows = [
    { id: "a", name: "Umbreon VMAX", set: "Evolving Skies", number: "215", kind: "single", aliases: ["moonbreon"], price: 1 },
    { id: "b", name: "Krabby", set: "Base", kind: "single", aliases: [], price: 2 },
    { id: "c", name: "151 Elite Trainer Box", set: "151", kind: "sealed", subtype: "etb", aliases: ["etb", "151"], price: 3 },
  ];
  t("moonbreon alias", searchItems(rows, "moonbreon")[0]?.id === "a");
  t("bb is not inside Krabby", searchItems(rows, "bb").length === 0);
  t("151 etb is sealed", searchItems(rows, "151 etb")[0]?.id === "c");
}

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) process.exit(1);
