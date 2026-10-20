// Premium history backfill. Fixture bounds only. The live bound stays private.
import { readFileSync } from "node:fs";
import {
  ARCHIVE_SOURCE, H_BLOCK, applyArchiveDay, backfillUnitJumps, crossUnitDropKeys,
  decideArchiveStop, dropOutliers, foldPriceDays, pickMarket, scopeProducts, seriesForPremium,
} from "../lib/premium-history.mjs";
import { foldSet } from "../lib/premium-ratio.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };

t("a 403 stops the archive pull", decideArchiveStop(403) === true);
t("a 200 does not stop", decideArchiveStop(200) === false);
t("any other status stops", decideArchiveStop(404) === true && decideArchiveStop(0) === true);

const nightly = [{ id: 10, market: 100, printing: "Normal" }];
const incoming = [
  { id: 10, date: "2024-06-01", market: 4, printing: "Normal" },
  { id: 11, date: "2024-06-01", market: 12, printing: "Normal", listedMedian: 11.5 },
  { id: 12, date: "2024-06-01", market: 0 },
];
const merged = applyArchiveDay(nightly, incoming);
t("a nightly point is not replaced", merged.prices.find((row) => row.id === 10).market === 100 && merged.prices.find((row) => row.id === 10).source == null);
t("an archive point is tagged and keeps the listed median", merged.prices.find((row) => row.id === 11).source === ARCHIVE_SOURCE && merged.prices.find((row) => row.id === 11).listedMedian === 11.5);
t("a missing price stays a gap", merged.gaps.includes("12") && !merged.prices.some((row) => row.id === 12));

const days = [
  { date: "2024-06-01", nightly: false, prices: [{ id: 10, market: 4 }, { id: 11, market: 8 }] },
  { date: "2024-06-01", nightly: true, prices: [{ id: 10, market: 100 }] },
  { date: "2024-06-02", nightly: true, prices: [{ id: 10, market: 101 }] },
];
const folded = seriesForPremium(days, [10, 11]);
t("the reader keeps the nightly price and the archive day", folded.series.get("10").map((row) => row[1]).join(",") === "100,101");
t("an archive only id is kept", folded.series.get("11")[0][1] === 8);
t("a day with no point is not invented", folded.series.get("10").length === 2);

const cross = [
  { id: "p", date: "2024-06-01", set: "SV: Prismatic Evolutions", subtype: "booster-pack", name: "Prismatic Evolutions Booster Pack", market: 400 },
  { id: "b", date: "2024-06-01", set: "SV: Prismatic Evolutions", subtype: "booster-box", name: "Prismatic Evolutions Booster Box", market: 120 },
  { id: "c", date: "2024-06-01", set: "SV: Prismatic Evolutions", subtype: "case", name: "Prismatic Evolutions Booster Box Case", market: 100 },
  { id: "ok", date: "2024-06-01", set: "SV: Prismatic Evolutions", subtype: "booster-pack", name: "Prismatic Evolutions Sleeved Pack", market: 8 },
];
const keys = crossUnitDropKeys(cross);
t("a pack priced as a box is dropped", keys.has("p|2024-06-01"));
t("a real box stays when the pack point is the bad one", keys.has("b|2024-06-01") === false);
t("a box under the pack is dropped", crossUnitDropKeys([{ id: "b2", date: "2024-06-01", set: "Temporal Forces", subtype: "booster-box", name: "Temporal Forces Booster Box", market: 6 }, { id: "p2", date: "2024-06-01", set: "Temporal Forces", subtype: "booster-pack", name: "Temporal Forces Pack", market: 12 }]).has("b2|2024-06-01"));
t("a real pack under the box stays", !keys.has("ok|2024-06-01"));
t("a case priced as a box is dropped", keys.has("c|2024-06-01"));

const guard = { junkX: 20, stepHi: 4, stepLo: 0.25 };
const odd = dropOutliers([
  { date: "2024-06-01", market: 100 },
  { date: "2024-06-08", market: 12 },
  { date: "2024-06-15", market: 104 },
  { date: "2024-06-22", market: 110 },
], guard);
t("a unit jump is dropped and the gap is not filled", odd.kept.map((row) => row.market).join(",") === "100,104,110" && odd.dropped.some((row) => row.why === "unit-jump" && row.market === 12));
t("neighbors inside the fixture bound stay", dropOutliers([{ date: "2024-06-01", market: 100 }, { date: "2024-06-08", market: 130 }], guard).dropped.length === 0);

const bad = new Map([["9", [{ date: "2024-06-01", market: 12, archive: true }, { date: "2024-06-08", market: 100, archive: false }]]]);
const good = new Map([["9", [{ date: "2024-06-01", market: 100, archive: true }, { date: "2024-06-08", market: 110, archive: false }]]]);
t("the gate fails when a backfilled series jumps past the bound", backfillUnitJumps(bad, guard).failed === true);
t("the gate passes a smooth backfilled series", backfillUnitJumps(good, guard).failed === false);
t("the gate ignores a nightly series", backfillUnitJumps(new Map([["9", [{ date: "2024-06-01", market: 12, archive: false }, { date: "2024-06-08", market: 100, archive: false }]]]), guard).failed === false);
t("a backfilled series with no bound fails closed", backfillUnitJumps(good, null).failed === true && backfillUnitJumps(good, null).missingBound === true);
t("no archive points do not fail", backfillUnitJumps(new Map(), null).failed === false);

t("one Normal printing is the price", pickMarket([{ marketPrice: 5, subTypeName: "Normal", midPrice: 4 }, { marketPrice: 9, subTypeName: "Holofoil" }])?.market === 5 && pickMarket([{ marketPrice: 5, subTypeName: "Normal", midPrice: 4 }])?.listedMedian === 4);
t("two Normal rows are a gap", pickMarket([{ marketPrice: 5, subTypeName: "Normal" }, { marketPrice: 6, subTypeName: "Normal" }]) == null);
t("two printings and no Normal are a gap", pickMarket([{ marketPrice: 5, subTypeName: "Holofoil" }, { marketPrice: 9, subTypeName: "Reverse Holofoil" }]) == null);
t("no market is a gap", pickMarket([{ lowPrice: 1, subTypeName: "Normal" }]) == null);

const products = JSON.parse(readFileSync(new URL("../../data/sealed-products.json", import.meta.url), "utf8"));
const scoped = scopeProducts(products);
t("scope is boxes packs etbs and bundles", scoped.length > 0 && scoped.every((row) => ["booster-box", "booster-pack", "etb", "booster-bundle"].includes(row.subtype)));
t("h block is first", H_BLOCK.includes(foldSet(scoped[0].set)) && foldSet(scoped[0].set) === "temporal forces");
t("prismatic is in scope even with no booster box", scoped.some((row) => foldSet(row.set) === "prismatic evolutions"));
const firstOther = scoped.findIndex((row) => !H_BLOCK.includes(foldSet(row.set)));
t("other booster box sets follow the h block", firstOther > 0 && scoped.slice(0, firstOther).every((row) => H_BLOCK.includes(foldSet(row.set))));
t("a tin is not in scope", !scoped.some((row) => row.subtype === "tin"));

const text = readFileSync(new URL("../lib/premium-history.mjs", import.meta.url), "utf8");
t("the module does not print a live cutoff", !/\b0\.92\b|\b1\.08\b/.test(text) && !/[\u2013\u2014]/.test(text));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("premium history ok");
