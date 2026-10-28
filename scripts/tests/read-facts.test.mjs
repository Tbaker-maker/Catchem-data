// Read facts: the joins that feed /feed/r/* pages. Fixed fixture, no live files.
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unpackLong, mergeHistory, changeOver, highLow, band, listingsFact, matchPattern, itemKeys } from "../lib/read-facts.mjs";
import { buildReadFacts, factFileName } from "../build-read-facts.mjs";
import { whatWeSee, BANNED, buildBreakdown, breakdownShape, shapeSimilarity } from "../lib/what-we-see.mjs";

let fail = 0;
const t = (n, c) => { if (c) console.log("  ok ", n); else { fail++; console.error("  FAIL", n); } };

const day = (s) => Date.parse(s + "T00:00:00Z") / 86400000;
t("long history unpacks day numbers", unpackLong(`${day("2025-10-14")}:10,${day("2026-01-01")}:12`)[1][0] === "2026-01-01");
const hist = mergeHistory([["2025-10-14", 10], ["2026-07-15", 30]], [["2026-09-14", 20], ["2026-10-14", 15]]);
t("30-day change uses dated ends", JSON.stringify(changeOver(hist, 30, "2026-10-14")) === JSON.stringify({ pct: -25, from: "2026-09-14", to: "2026-10-14", p0: 20, p1: 15 }));
t("1Y change from the year-ago point", changeOver(hist, 365, "2026-10-14")?.pct === 50);
t("no 30-day change across a long gap", changeOver([["2026-08-01", 5], ["2026-10-14", 6]], 30, "2026-10-14") === null);
const hl = highLow(hist, "2026-10-14");
t("high, low, days since high, % from high", hl.high.date === "2026-07-15" && hl.low.price === 10 && hl.daysSinceHigh === 91 && hl.fromHighPct === -50);
t("band needs 5 items", band([{ pct: 1, from: "a", to: "b" }]) === null && band([1, 2, -3, 4, 5].map((p) => ({ pct: p, from: "2026-09-14", to: "2026-10-14" }))).median === 2);
t("listings change from the oldest count within 7 days", JSON.stringify(listingsFact({ "2026-10-05": 9, "2026-10-08": 20, "2026-10-14": 15 })) === JSON.stringify({ n: 15, date: "2026-10-14", prev: 20, prevDate: "2026-10-08", pct: -25, span: 6 }));
t("pattern without a base rate never shows", matchPattern([{ id: "x", keys: ["set_age=under_1y"], testRate: 0.3, testN: 50, horizon: 7 }], ["set_age=under_1y"]) === null);
t("most specific passed pattern wins", matchPattern([
  { id: "a", keys: ["set_age=under_1y"], testRate: 0.3, baseRate: 0.2, testN: 50, horizon: 7 },
  { id: "b", keys: ["set_age=under_1y", "rotation_stage=current"], testRate: 0.3, baseRate: 0.2, testN: 40, horizon: 7 },
], ["set_age=under_1y", "rotation_stage=current"]).id === "b");
t("item keys match the pattern miner", itemKeys({ release: "2026-03-01", rotation: { mark: "J", status: "Standard" }, asOf: "2026-10-14" }).join() === "set_age=under_1y,rotation_stage=current");
t("fact file names stay path-safe", factFileName("a/b c") === "a_b_c.json");

// End to end on a tiny tree: the joins that were missing on live pages.
const root = await mkdtemp(join(tmpdir(), "rf-"));
const pub = join(root, "research/assets/public");
for (const d of ["buckets", "hist-long", "sets", "feed"]) await mkdir(join(pub, d), { recursive: true });
await mkdir(join(root, "data/derived/listing-counts/history"), { recursive: true });
const w = (p, o) => writeFile(join(root, p), JSON.stringify(o));
const nightly = [["2026-09-14", 60], ["2026-10-14", 48]];
const singles = [1, 2, 3, 4, 5].map((i) => ({ id: `tcgcsv-${i}`, name: `Card ${i}`, num: `${190 + i}/182`, kind: "single", rarity: "Illustration Rare", artist: "Okacheke", price: 40 + i, printings: i === 1 ? [{ name: "Normal", price: 41, asOf: "2026-10-14" }, { name: "Reverse Holofoil", price: 55, asOf: "2026-10-14" }] : [], hist: nightly, scan: `/img/sv10/${190 + i}`, rank: i, of: 5, set: "SV10: Destined Rivals", setSlug: "sv10-destined-rivals", asOf: "2026-10-14" }));
const sealed = { id: "tcgcsv-900", name: "Perfect Order Elite Trainer Box", kind: "sealed", subtype: "etb", price: 73.87, hist: [["2026-09-14", 70], ["2026-10-14", 73.87]], scan: "", set: "ME03: Perfect Order", setSlug: "me03-perfect-order", asOf: "2026-10-14" };
await w("research/assets/public/buckets/00.json", [...singles, sealed]);
await w("research/assets/public/hist-long/00.json", { rows: { "tcgcsv-1": `${day("2025-10-14")}:70` } });
await w("research/assets/public/sets.json", { sets: [{ slug: "sv10-destined-rivals", name: "SV10: Destined Rivals", release: "2025-05-30" }, { slug: "me03-perfect-order", name: "ME03: Perfect Order", release: "2026-03-27" }] });
await w("research/assets/public/sets/sv10-destined-rivals.json", { name: "SV10: Destined Rivals", singleIndex: [{ d: "2026-09-14", v: 100 }, { d: "2026-10-14", v: 82 }] });
await w("research/assets/public/rotation-status.json", { asOf: "2026-08-24", sets: [{ slug: "sv10-destined-rivals", mark: "I", status: "Standard" }, { slug: "me03-perfect-order", mark: "J", status: "Standard" }] });
await w("research/assets/public/listings-counted.json", { products: [{ id: "me3-etb", listingsCounted: { n: 30, date: "2026-10-14", prev: { n: 33, date: "2026-10-13" } } }] });
await w("research/assets/public/reads.json", { asOf: "2026-10-14", reads: [
  { id: "backto-tcgcsv-1", sku: "tcgcsv-1", set: "SV10: Destined Rivals" },
  { id: "deep-sealedgap-me3-etb", sku: "me3-etb" },
  { id: "rarity-dr", readKind: "rarity-band", receipt: { set: "Destined Rivals" } },
] });
await w("data/sealed-prices.json", { products: [{ id: "me3-etb", set: "Perfect Order", tcgPlayerId: "900", listingCount: 103, priceHistory: [{ date: "2026-10-14", price: 76.66 }] }] });
await w("data/derived/singles-asks.json", { rows: [{ id: "tcgcsv-1", ebay: 50, listings: 12, date: "2026-10-14", condition: "Ungraded" }] });
await w("data/derived/rip-roi.json", { asOf: "2026-10-14", rows: [{ id: "tcgcsv-900", price: 73.87, contentsEV: 60, roiPct: -18.8, beatChance: 22, median: 50 }] });
await w("data/derived/year-patterns.json", { asOf: "2026-10-14", patterns: [{ id: "p", keys: ["set_age=1_to_3y", "rotation_stage=previous"], testN: 3503, testRate: 0.25, baseRate: 0.2076, horizon: 7 }] });
await writeFile(join(root, "data/derived/listing-counts/history/2026-10-13.json.gz"), gzipSync(JSON.stringify({ date: "2026-10-13", rows: [{ id: "tcgcsv-1", listingsCounted: 10 }] })));

const { facts } = await buildReadFacts(root);
const single = facts["backto-tcgcsv-1"];
t("single: 30-day and 1Y change", single?.change?.d30?.pct === -20 && single?.change?.y1?.from === "2025-10-14");
t("single: listings counted with dated change", single?.listings?.n === 12 && single.listings.prev === 10 && single.listings.prevDate === "2026-10-13");
t("single: eBay vs TCGplayer gap, both dated", single?.gap?.ebay === 50 && single.gap.tcgDate === "2026-10-14");
t("single: rank in set and variants", single?.rank?.rank === 1 && single.rank.of === 5 && single?.variants?.length === 2);
t("single: rarity and artist bands", single?.rarityBand?.n === 5 && single?.artistBand?.artist === "Okacheke");
t("single: similar cards carry thumbnails", single?.similar?.length === 4 && single.similar.every((s) => s.image.startsWith("/img/")));
t("single: passed pattern with base rate", single?.pattern?.rate === 25 && single.pattern.base === 20.8 && single.pattern.n === 3503);
t("single: rotation and set momentum", single?.rotation?.mark === "I" && single?.setMomentum?.pct === -18);
const box = facts["deep-sealedgap-me3-etb"];
t("sealed sku joins through tcgPlayerId", box?.item?.id === "tcgcsv-900");
t("sealed: listings counted from the sealed file", box?.listings?.n === 30 && box.listings.prev === 33);
t("sealed: Rip value joins", box?.rip?.contentsEV === 60);
t("sealed: eBay ask vs TCGplayer", box?.gap?.ebay === 76.66);
t("set read joins on the bare set name", facts["rarity-dr"]?.setMomentum?.set === "SV10: Destined Rivals");

const all = await buildReadFacts(root, { items: true });
const shard = all.items.get("sv10-destined-rivals");
t("item reads cover every priced row, grouped by set", shard && Object.keys(shard).length === 5 && all.items.get("me03-perfect-order")?.["tcgcsv-900"]);
t("item read has 7/30/90/1Y fields when dated", shard["tcgcsv-1"].change.d30.pct === -20 && shard["tcgcsv-1"].change.y1);
t("sealed item read joins its eBay ask by tcgPlayerId", all.items.get("me03-perfect-order")["tcgcsv-900"].gap?.ebay === 76.66);
t("item reads skip bands and similar (kept small)", !shard["tcgcsv-1"].rarityBand && !shard["tcgcsv-1"].similar);
const line = whatWeSee({ id: "tcgcsv-demo", range: { from: "2025-05-29", now: { date: "2026-10-14", price: 47.34 }, high: { price: 84.54, date: "2025-05-29" }, low: { price: 40, date: "2026-01-08" }, daysSinceHigh: 503, fromHighPct: -44 }, change: { d30: { pct: -22.3, from: "2026-09-14", to: "2026-10-14", p0: 60.9, p1: 47.34 } } });
t("what-we-see line is dated and plain", /84\.54/.test(line) && /2025/.test(line) && /22%|Down|fell|lower/i.test(line) && !BANNED.test(line) && !/[\u2014\u2013]/.test(line));
t("breakdown carries lead and ordered sections", (() => { const b = buildBreakdown({ id: "tcgcsv-demo", range: { from: "2025-05-29", now: { date: "2026-10-14", price: 47.34 }, high: { price: 84.54, date: "2025-05-29" }, low: { price: 40, date: "2026-01-08" }, daysSinceHigh: 503, fromHighPct: -44 }, change: { d30: { pct: -22.3, from: "2026-09-14", to: "2026-10-14", p0: 60.9, p1: 47.34 } } }); return b.line === line && b.sections.length >= 1 && Array.isArray(b.order) && b.order[0]; })());
t("no line without backing data", whatWeSee({}) === "" && whatWeSee({ change: { d30: { pct: 3 } } }) === "");

if (fail) process.exit(1); else console.log("read facts ok");
