// Thin data check. Fixture limits only. The live limits stay in the private repo.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { flagLine } from "../lib/copy-rules.mjs";
import { eraOf } from "../lib/board-mix.mjs";
import { eraOfSet } from "../lib/extra-reads.mjs";
import {
  clearReadThinCache, dropThinReads, gateReads, releaseEra, thinReadBlock, thinReadHits, writeReadFlags,
} from "../lib/read-thin-data.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };

const FIX = {
  minAnchorDays: 2,
  anchorBand: 0.2,
  minJumps: 2,
  jumpRatio: 1.8,
  minListings: 9,
  bigMoveRatio: 1.8,
  minDipPct: 2,
  minDipUsd: 3,
  maxDayGap: 0,
  eraTags: { Modern: ["SV", "ME"], Vintage: ["WOTC"] },
};

const rayquaza = {
  id: "deep-slump-tcgcsv-88648",
  name: "Rayquaza EX",
  deep: "slump",
  set: "Dragons Exalted",
  headline: "Slump watch: Rayquaza EX is under its high.",
  chart: { points: [["2026-09-10", 219.47], ["2026-09-15", 484.74], ["2026-09-26", 219.47], ["2026-10-21", 219.47]] },
};
const jolteon = {
  id: "deep-recovery-tcgcsv-86351",
  name: "Jolteon Star",
  deep: "recovery",
  set: "EX Power Keepers",
  headline: "Recovery watch: Jolteon Star has climbed.",
  chart: { points: [["2026-06-26", 449], ["2026-09-01", 750], ["2026-10-06", 750], ["2026-10-08", 1750], ["2026-10-21", 1750]] },
};
const wiggly = {
  id: "high-tcgcsv-90603",
  name: "Wigglytuff ex",
  set: "EX Hidden Legends",
  headline: "Wigglytuff ex more than doubled in a week.",
  price: 160.83,
  tiles: { price: { from: 76.66 } },
  signals: [{ kind: "era", tag: "Modern" }],
  thin: { listingsCounted: 5 },
};
const salamenceEx = {
  id: "high-tcgcsv-88904",
  name: "Salamence ex",
  set: "EX Power Keepers",
  headline: "Salamence ex is at a high.",
  price: 40,
  signals: [{ kind: "era", tag: "Modern" }],
};
const salamenceMe = {
  id: "high-tcgcsv-716502",
  name: "Salamence ex - 109/128",
  set: "ME: 30th Celebration",
  headline: "Salamence ex is at a high.",
  price: 12,
  signals: [{ kind: "era", tag: "Modern" }],
};
const salamenceSv = {
  id: "high-sv-salamence",
  name: "Salamence ex",
  set: "SV09: Journey Together",
  headline: "Salamence ex is at a high.",
  price: 8,
  signals: [{ kind: "era", tag: "Modern" }],
};
const chase = {
  id: "chase-ex",
  name: "EX Power Keepers",
  set: null,
  headline: "Chase list.",
  signals: [{ kind: "era", tag: "Modern" }],
};
const etb = {
  id: "mktmove-swsh2-etb",
  name: "Rebel Clash Elite Trainer Box",
  sku: "swsh2-etb",
  lane: "sealed",
  readKind: "mktmove",
  headline: "Rebel Clash Elite Trainer Box market price moved.",
  receipt: { from: "2026-10-19", to: "2026-10-21", marketFrom: 327.82, marketTo: 326.26, ask: 400 },
  thin: { listingsCounted: 15, listingsDate: "2026-10-19", priceDate: "2026-10-21" },
};

const rayBlock = thinReadBlock(rayquaza, FIX);
t("a one day slump price is blocked", rayBlock?.rule === "single-price");
const jolteonHits = thinReadHits(jolteon, FIX);
t("a one jump recovery is blocked", thinReadBlock(jolteon, FIX)?.rule === "single-jump" && !jolteonHits.some((row) => row.rule === "single-price"));
const wigglyHits = thinReadHits(wiggly, FIX).map((row) => row.rule);
t("a big move on 5 listings counted is blocked", wigglyHits[0] === "thin-listings" && wigglyHits.includes("era-mismatch"));
t("an EX era card tagged Modern is blocked", thinReadBlock(salamenceEx, FIX)?.rule === "era-mismatch");
t("a 30th Celebration card tagged Modern stays", thinReadBlock(salamenceMe, FIX) == null);
t("a Journey Together card tagged Modern stays", thinReadBlock(salamenceSv, FIX) == null);
t("a chase name with an EX prefix tagged Modern is blocked", thinReadBlock(chase, FIX)?.rule === "era-mismatch");
const etbHits = thinReadHits(etb, FIX).map((row) => row.rule);
t("a 1.56 sealed dip is blocked", etbHits[0] === "small-dip" && etbHits.includes("date-mismatch"));

const cluster = {
  id: "deep-slump-cluster",
  deep: "slump",
  name: "Sneasel",
  headline: "Slump watch: Sneasel is under its high.",
  chart: { points: [["2026-09-01", 369.5], ["2026-09-02", 386.33], ["2026-10-21", 300]] },
};
t("a multi day high inside the band stays", thinReadBlock(cluster, FIX) == null);
const smallStep = {
  id: "deep-slump-small",
  deep: "slump",
  name: "Sylveon ex",
  headline: "Slump watch: Sylveon ex is under its high.",
  chart: { points: [["2026-09-01", 560], ["2026-09-10", 563.47], ["2026-09-20", 558], ["2026-10-21", 417]] },
};
t("a small slump step stays", thinReadBlock(smallStep, FIX) == null);
const mild = {
  id: "deep-recovery-mild",
  deep: "recovery",
  name: "Vaporeon",
  headline: "Recovery watch: Vaporeon has climbed.",
  chart: { points: [["2026-09-01", 100], ["2026-09-15", 100], ["2026-10-21", 155]] },
};
t("a recovery under the jump bar stays", thinReadBlock(mild, FIX) == null);
const thick = {
  id: "high-thick",
  name: "Card",
  headline: "Card more than doubled in a week.",
  price: 24,
  tiles: { price: { from: 10 } },
  thin: { listingsCounted: 12 },
};
t("a big move with more listings counted stays", thinReadBlock(thick, FIX) == null);
const missingCount = { id: "high-nocount", name: "Card", headline: "Card more than doubled in a week.", price: 20, tiles: { price: { from: 10 } } };
t("a big move with no listings counted stays", thinReadBlock(missingCount, FIX) == null);
const half = { id: "half", name: "Card", headline: "Card is lower.", price: 50, tiles: { price: { from: 100 } }, thin: { listingsCounted: 1 } };
t("a move down is not a big move", thinReadBlock(half, FIX) == null);
const bigDip = {
  id: "mktmove-big",
  lane: "sealed",
  readKind: "mktmove",
  name: "Box",
  headline: "Box market price moved.",
  receipt: { from: "2026-10-21", to: "2026-10-21", marketFrom: 100, marketTo: 90 },
  thin: { listingsDate: "2026-10-21", priceDate: "2026-10-21", listingsCounted: 20 },
};
t("a same day sealed dip that clears the bar stays", thinReadBlock(bigDip, FIX) == null);
const rise = {
  id: "mktmove-up",
  lane: "sealed",
  readKind: "mktmove",
  name: "Box",
  headline: "Box market price moved.",
  receipt: { from: "2026-10-21", to: "2026-10-21", marketFrom: 100, marketTo: 110 },
};
t("a rise is not a dip", thinReadBlock(rise, FIX) == null);
t("no config means no block", thinReadBlock(rayquaza, null) == null && gateReads([rayquaza], null).flags.length === 0);

const reasons = thinReadHits(wiggly, FIX).concat(thinReadHits(etb, FIX), thinReadHits(rayquaza, FIX), thinReadHits(jolteon, FIX));
t("reasons name the rule and do not rewrite the read", reasons.every((row) => row.reason && flagLine(row.reason).length === 0 && !/[\u2013\u2014]/.test(row.reason) && !/\b(sold|sales|buy|sell|hold|invest)\b/i.test(row.reason)));

const boolCard = { id: "bool", thin: true, headline: "Flat.", price: 1 };
const gatedBool = gateReads([boolCard], FIX);
t("a boolean thin flag stays on the card", boolCard.thin === true && gatedBool.keep.length === 1);
const internal = { id: "keep-me", headline: "Quiet card.", thin: { note: "internal" } };
const gatedKeep = gateReads([internal], FIX);
t("internal thin evidence is not left on a kept read", gatedKeep.keep.length === 1 && gatedKeep.keep[0].thin == null);

t("era comes from the set prefix", releaseEra("SWSH07: Evolving Skies") === "SWSH" && releaseEra("SM - Dragon Majesty") === "SM" && releaseEra("EX Hidden Legends") === "EX" && releaseEra("POP Series 5") === "POP" && releaseEra("Base Set") === "" && releaseEra("Expedition") === "");
t("board era uses that prefix", eraOf("SV09: Journey Together") === "SV" && eraOf("EX Hidden Legends") === "EX" && eraOf("Base Set") === "");
t("extra era buckets stay swsh or modern", eraOfSet("SWSH07: Evolving Skies") === "swsh" && eraOfSet("SV09: Journey Together") === "modern" && eraOfSet("ME: 30th Celebration") === "modern" && eraOfSet("EX Hidden Legends") === "");

const src = readFileSync(new URL("../lib/read-thin-data.mjs", import.meta.url), "utf8");
t("the module does not assign a listings floor", !/minListings\s*[:=]\s*\d/.test(src));
t("the module does not assign an anchor band", !/anchorBand\s*[:=]\s*\d/.test(src));

const prevFile = process.env.READ_THIN_DATA_FILE;
const root = await mkdtemp(join(tmpdir(), "thin-flags-"));
try {
  const cfgPath = join(root, "fixture.json");
  await writeFile(cfgPath, JSON.stringify(FIX));
  process.env.READ_THIN_DATA_FILE = cfgPath;
  clearReadThinCache();
  const open = await dropThinReads([rayquaza, smallStep], root, "not-a-day");
  t("a flag that cannot be dated does not drop the read", open.length === 2);
  const dropped = await dropThinReads([rayquaza, smallStep], root, "2026-10-22");
  const flag = JSON.parse(await readFile(join(root, "data/derived/read-flags/2026-10-22.json"), "utf8"));
  t("a blocked read is flagged and left out", dropped.length === 1 && dropped[0].id === smallStep.id && flag.flags.length === 1 && flag.flags[0].rule === "single-price" && flag.flags[0].id === rayquaza.id);
  t("the flag states the reason", flag.flags[0].reason === "This slump or recovery rests on one dated price." && !/[\u2013\u2014]/.test(flag.source));
  await writeReadFlags(root, "2026-10-22", [{ id: rayquaza.id, rule: "single-price", reason: flag.flags[0].reason, read: { id: rayquaza.id } }]);
  const again = JSON.parse(await readFile(join(root, "data/derived/read-flags/2026-10-22.json"), "utf8"));
  t("the same read and rule is not listed twice", again.flags.length === 1);
} finally {
  if (prevFile == null) delete process.env.READ_THIN_DATA_FILE;
  else process.env.READ_THIN_DATA_FILE = prevFile;
  clearReadThinCache();
  await rm(root, { recursive: true, force: true });
}

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("read thin data ok");
