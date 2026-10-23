// Public reads guard. Fixture limits only. The live limits stay in the private repo.
import { readFileSync } from "node:fs";
import {
  spaceFamilies, fixAskDate, fixChips, fixImage, guardReads, noChangeListings, priceHits, validGuard,
} from "../lib/reads-guard.mjs";
import { eraTagOf } from "../lib/signal-chips.mjs";
import { askCaptureDay } from "../lib/night-reads.mjs";
import { copiedDays } from "../lib/read-library.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };
const CFG = validGuard(JSON.parse(readFileSync(new URL("./fixtures/reads-guard-limits.json", import.meta.url), "utf8")));

console.log("reads guard");
t("fixture limits load", CFG != null);
t("no limits, no price opinion", priceHits({ chart: { points: [["2026-01-01", 1], ["2026-01-02", 9], ["2026-01-03", 1]] }, price: 1 }, null, null).length === 0);

const rayquaza = {
  id: "deep-slump-x", readKind: "deep", deep: "slump", price: 219.47,
  headline: "Slump watch: Card is 55% under its Sep 15 high.",
  lines: ["High $484.74 on Sep 15, the top of the past year.", "Tonight (Oct 23): $219.47."],
  chart: { points: [["2026-09-01", 219.47], ["2026-09-08", 219.47], ["2026-09-15", 484.74], ["2026-09-22", 219.47], ["2026-10-23", 219.47]] },
};
t("one point high with agreeing sides is a spike", priceHits(rayquaza, CFG).includes("spike-price"));

const charizard = {
  id: "deep-card-x", readKind: "deep", price: 1501.23, headline: "$1,501.23 tonight",
  chart: { points: [["2026-08-20", 1000], ["2026-09-27", 1501.23], ["2026-10-13", 1501.23], ["2026-10-17", 802.12], ["2026-10-19", 802.12], ["2026-10-23", 1501.23]] },
};
t("there and back between two fixed prices is a flip", priceHits(charizard, CFG).includes("price-flip"));

const caseRead = {
  id: "sealed-week-x", readKind: "sealed", price: 1912.99, changePct: -29.5, windowDays: 7,
  headline: "$2,715.00 (Oct 16) to $1,912.99 (Oct 23). Down 30%.",
  chart: { points: Array.from({ length: 13 }, (_, i) => [`2026-10-${String(10 + i).padStart(2, "0")}`, 2715]).concat([["2026-10-23", 1912.99]]) },
};
t("one night drop from a price that never moved is a flat step", priceHits(caseRead, CFG).includes("flat-step"));

const venusaur = {
  id: "deep-recovery-x", readKind: "deep", deep: "recovery", price: 480.01, headline: "Recovery watch",
  chart: { points: [["2026-07-16", 501], ["2026-07-22", 276.99], ["2026-07-29", 275], ["2026-08-27", 275], ["2026-09-03", 480.01], ["2026-09-10", 480.01], ["2026-09-26", 480.01], ["2026-10-05", 480.01], ["2026-10-23", 480.01]] },
};
t("one jump comeback then exactly flat is a flat step", priceHits(venusaur, CFG).includes("flat-step"));

const steady = {
  id: "year-x", readKind: "year", price: 13.11, headline: "$3.47 (Oct 23, 2025) to $13.11 (Oct 23)",
  chart: { points: [["2025-10-23", 3.47], ["2026-01-01", 5.2], ["2026-04-01", 7.9], ["2026-07-01", 10.4], ["2026-09-26", 11.37], ["2026-10-16", 12.6], ["2026-10-23", 13.11]] },
};
t("a steady climb passes", priceHits(steady, CFG).length === 0);
t("a set read is not judged by its link card", priceHits({ ...caseRead, readKind: "set" }, CFG).length === 0);

const daily = new Map([["536266", Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${16 + i}`, market: i === 7 ? 1912.99 : 2715, printing: "Normal" }))]]);
t("daily files fill a read that has no chart", priceHits({ sku: "tcgcsv-536266", readKind: "sealed", price: 1912.99, headline: "" }, CFG, daily).includes("flat-step"));

const flatChip = fixChips({ changePct: -29.5, windowDays: 7, signals: [
  { kind: "move", dir: "flat", text: "0% 7D" }, { kind: "momentum", word: "Flat" }, { kind: "confidence", bars: 3 },
] });
t("flat move chip beside a 30% drop is taken off", !flatChip.read.signals.some((c) => c.kind === "move"));
t("flat momentum chip beside a 30% drop is taken off", !flatChip.read.signals.some((c) => c.kind === "momentum"));
t("other chips stay", flatChip.read.signals.some((c) => c.kind === "confidence"));
const agree = fixChips({ changePct: -9, windowDays: 7, signals: [{ kind: "move", dir: "down", text: "9% 7D" }] });
t("an agreeing chip stays", agree.changed.length === 0);

const drain = { readKind: "listings", receipt: { n: 15, prev: 14 }, signals: [{ kind: "listings", dir: "down", text: "Listings -17% 7d" }], tiles: { listings: { word: "Draining" } } };
const fixedDrain = fixChips(drain).read;
t("draining chip beside a rising count is taken off", !fixedDrain.signals.length && !fixedDrain.tiles.listings);
t("10 to 10 listings read is no change", noChangeListings({ readKind: "listings", receipt: { n: 10, prev: 10 } }));
t("10 to 12 listings read is news", !noChangeListings({ readKind: "listings", receipt: { n: 12, prev: 10 } }));

const heatRows = [
  { date: "2026-10-18", id: "swsh3-pack", price: 14.99, listingCount: 57 },
  { date: "2026-10-19", id: "swsh3-pack", price: 15.5, listingCount: 55 },
  { date: "2026-10-21", id: "swsh3-pack", price: 15.5, listingCount: 55 },
  { date: "2026-10-23", id: "swsh3-pack", price: 12.99, listingCount: 54 },
];
const ask = fixAskDate({
  readKind: "askmove", sku: "swsh3-pack",
  headline: "Darkness Ablaze Booster Pack: the eBay ask went from $15.50 to $12.99 over Oct 21 to Oct 23.",
  path: "the eBay ask went from $15.50 to $12.99 over Oct 21 to Oct 23.",
  receipt: { from: "2026-10-21", to: "2026-10-23" },
}, heatRows);
t("carried ask row is dated by its capture day", ask.read.receipt.from === "2026-10-19" && ask.read.headline.includes("over Oct 19 to Oct 23"));
const heat = new Map(heatRows.map((r) => [r.date, r]));
t("night reads date the ask by capture day", askCaptureDay(heat, "2026-10-21") === "2026-10-19");
t("a fresh ask row keeps its own day", askCaptureDay(heat, "2026-10-19") === "2026-10-19");

t("a daily file that copies the day before is a missing day", [...copiedDays(["2026-10-10", "2026-10-11", "2026-10-12"], new Map([["2026-10-10", "[1]"], ["2026-10-11", "[1]"], ["2026-10-12", "[2]"]]))].join() === "2026-10-11");
t("different daily files are all kept", copiedDays(["2026-10-10", "2026-10-11"], new Map([["2026-10-10", "[1]"], ["2026-10-11", "[2]"]])).size === 0);

t("2007 set is Classic", eraTagOf("2007-05-23") === "Classic");
t("1999 set is Vintage", eraTagOf("1999-01-09") === "Vintage");
t("2012 set is Modern", eraTagOf("2012-08-15") === "Modern");
t("Call of Legends is Classic", eraTagOf("2011-02-09") === "Classic");

const img404 = await fixImage({ sku: "tcgcsv-684339", image: "https://catchemtcg.com/data/editor/tcg/me3/124_hires.png" }, async () => 404);
t("missing picture falls back to the TCGplayer photo", img404.read.image === "https://tcgplayer-cdn.tcgplayer.com/product/684339_in_400x400.jpg");
const imgOk = await fixImage({ sku: "tcgcsv-1", image: "https://catchemtcg.com/data/editor/tcg/a/1_hires.png" }, async () => 200);
t("a working picture stays", !imgOk.changed);
const imgErr = await fixImage({ sku: "tcgcsv-1", image: "https://catchemtcg.com/data/editor/tcg/a/1_hires.png" }, async () => { throw new Error("net"); });
t("a network error keeps the picture", !imgErr.changed);

const out = await guardReads([rayquaza, steady, { id: "l", readKind: "listings", receipt: { n: 10, prev: 10 } }], { cfg: CFG, daily: null, heatRows: [], head: null });
t("guard keeps the steady read only", out.keep.length === 1 && out.keep[0].id === "year-x" && out.flags.length === 2);
t("flag reasons have no dashes", out.flags.every((f) => !/[\u2013\u2014]/.test(f.reason)));

const spaced = spaceFamilies([{ id: 1, family: "a" }, { id: 2, family: "a" }, { id: 3, family: "b" }, { id: 4, family: "c" }]).map((r) => r.id).join();
t("no two of a family side by side after a drop", spaced === "1,3,2,4");

if (fail) { console.error(`reads guard: ${fail} failed`); process.exit(1); }
console.log("reads guard: all passed");
