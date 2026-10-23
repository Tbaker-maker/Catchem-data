// Thin data check. Fixture limits only. The live limits stay in the private repo.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

const FIXTURE_URL = new URL("./fixtures/read-thin-limits.json", import.meta.url);
const FIX = JSON.parse(readFileSync(FIXTURE_URL, "utf8"));

function days(start, n, price) {
  const out = [];
  let t0 = Date.parse(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i += 1) {
    out.push([new Date(t0).toISOString().slice(0, 10), price]);
    t0 += 86400000;
  }
  return out;
}

const rayquaza = {
  id: "deep-slump-one-day",
  name: "Rayquaza EX",
  deep: "slump",
  set: "Dragons Exalted",
  headline: "Slump watch: Rayquaza EX is under its high.",
  chart: { points: [...days("2026-09-01", 5, 200), ["2026-09-06", 900], ...days("2026-09-07", 2, 200)] },
};
const jolteon = {
  id: "deep-recovery-one-jump",
  name: "Jolteon Star",
  deep: "recovery",
  set: "EX Power Keepers",
  headline: "Recovery watch: Jolteon Star has climbed.",
  chart: { points: [...days("2026-09-01", 5, 100), ...days("2026-09-06", 2, 800)] },
};
const wiggly = {
  id: "high-wiggly",
  name: "Wigglytuff ex",
  set: "EX Hidden Legends",
  headline: "Wigglytuff ex more than doubled in a week.",
  price: 80,
  tiles: { price: { from: 10 } },
  signals: [{ kind: "era", tag: "Modern" }],
  thin: { listingsCounted: 4 },
};
const salamenceEx = {
  id: "high-salamence-ex",
  name: "Salamence ex",
  set: "EX Power Keepers",
  headline: "Salamence ex is at a high.",
  price: 40,
  signals: [{ kind: "era", tag: "Modern" }],
};
const salamenceMe = {
  id: "high-salamence-me",
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
  receipt: { from: "2026-10-01", to: "2026-10-21", marketFrom: 100, marketTo: 90, ask: 400 },
  thin: { listingsCounted: 4, listingsDate: "2026-10-01", priceDate: "2026-10-21" },
};
const quiet = { id: "quiet-card", name: "Quiet", headline: "Flat line.", price: 12 };

const rayBlock = thinReadBlock(rayquaza, FIX);
t("a one day slump price is blocked", rayBlock?.rule === "single-price");
const jolteonHits = thinReadHits(jolteon, FIX);
t("a one jump recovery is blocked", thinReadBlock(jolteon, FIX)?.rule === "single-jump" && !jolteonHits.some((row) => row.rule === "single-price"));
const wigglyHits = thinReadHits(wiggly, FIX).map((row) => row.rule);
t("a big move on few listings counted is blocked", wigglyHits[0] === "thin-listings" && wigglyHits.includes("era-mismatch"));
t("an EX era card tagged Modern is blocked", thinReadBlock(salamenceEx, FIX)?.rule === "era-mismatch");
t("a 30th Celebration card tagged Modern stays", thinReadBlock(salamenceMe, FIX) == null);
t("a Journey Together card tagged Modern stays", thinReadBlock(salamenceSv, FIX) == null);
t("a chase name with an EX prefix tagged Modern is blocked", thinReadBlock(chase, FIX)?.rule === "era-mismatch");
const etbHits = thinReadHits(etb, FIX).map((row) => row.rule);
t("a small sealed dip is blocked", etbHits[0] === "small-dip" && etbHits.includes("date-mismatch"));

const cluster = {
  id: "deep-slump-cluster",
  deep: "slump",
  name: "Sneasel",
  headline: "Slump watch: Sneasel is under its high.",
  chart: { points: [...days("2026-09-01", 5, 100), ["2026-09-06", 90]] },
};
t("a multi day high inside the band stays", thinReadBlock(cluster, FIX) == null);
const smallStep = {
  id: "deep-slump-small",
  deep: "slump",
  name: "Sylveon ex",
  headline: "Slump watch: Sylveon ex is under its high.",
  chart: { points: [...days("2026-09-01", 5, 500), ["2026-09-06", 510], ["2026-09-07", 400]] },
};
t("a small slump step stays", thinReadBlock(smallStep, FIX) == null);
const mild = {
  id: "deep-recovery-mild",
  deep: "recovery",
  name: "Vaporeon",
  headline: "Recovery watch: Vaporeon has climbed.",
  chart: { points: [...days("2026-09-01", 5, 100), ["2026-09-06", 250]] },
};
t("a recovery under the jump bar stays", thinReadBlock(mild, FIX) == null);
const thick = {
  id: "high-thick",
  name: "Card",
  headline: "Card more than doubled in a week.",
  price: 90,
  tiles: { price: { from: 10 } },
  thin: { listingsCounted: 80 },
};
t("a big move with more listings counted stays", thinReadBlock(thick, FIX) == null);
const missingCount = { id: "high-nocount", name: "Card", headline: "Card more than doubled in a week.", price: 80, tiles: { price: { from: 10 } } };
t("a big move with no listings counted stays", thinReadBlock(missingCount, FIX) == null);
const half = { id: "half", name: "Card", headline: "Card is lower.", price: 40, tiles: { price: { from: 100 } }, thin: { listingsCounted: 1 } };
t("a move down is not a big move", thinReadBlock(half, FIX) == null);
const bigDip = {
  id: "mktmove-big",
  lane: "sealed",
  readKind: "mktmove",
  name: "Box",
  headline: "Box market price moved.",
  receipt: { from: "2026-10-21", to: "2026-10-21", marketFrom: 200, marketTo: 100 },
  thin: { listingsDate: "2026-10-21", priceDate: "2026-10-21", listingsCounted: 80 },
};
t("a same day sealed dip that clears the bar stays", thinReadBlock(bigDip, FIX) == null);
const rise = {
  id: "mktmove-up",
  lane: "sealed",
  readKind: "mktmove",
  name: "Box",
  headline: "Box market price moved.",
  receipt: { from: "2026-10-21", to: "2026-10-21", marketFrom: 100, marketTo: 140 },
};
t("a rise is not a dip", thinReadBlock(rise, FIX) == null);
t("a quiet read stays when limits are loaded", thinReadBlock(quiet, FIX) == null);

const partial = { ...FIX };
delete partial.minDipUsd;
const missingGate = gateReads([quiet, rayquaza], null);
t("missing config blocks the read", thinReadBlock(quiet, null)?.reason === "thin data limits not loaded" && thinReadBlock(rayquaza, null)?.rule === "limits-missing");
t("a missing limit blocks the read", thinReadBlock(quiet, partial)?.reason === "thin data limits not loaded" && gateReads([quiet], partial).keep.length === 0);
t("missing config flags every read and keeps none", missingGate.keep.length === 0 && missingGate.flags.length === 2 && missingGate.flags.every((row) => row.rule === "limits-missing" && row.reason === "thin data limits not loaded"));

const reasons = thinReadHits(wiggly, FIX).concat(thinReadHits(etb, FIX), thinReadHits(rayquaza, FIX), thinReadHits(jolteon, FIX), [thinReadBlock(quiet, null)]);
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
const testSrc = readFileSync(new URL("./read-thin-data.test.mjs", import.meta.url), "utf8");
t("limits are loaded from the fixture file", ["minAnchorDays", "anchorBand", "minJumps", "jumpRatio", "minListings", "bigMoveRatio", "minDipPct", "minDipUsd", "maxDayGap"].every((key) => Number.isFinite(FIX[key])) && FIX.eraTags && String(FIX.note || "").includes("Fixture only"));
t("the test file does not assign the limits inline", !/minListings\s*:\s*\d/.test(testSrc) && !/anchorBand\s*:\s*\d/.test(testSrc) && !/jumpRatio\s*:\s*\d/.test(testSrc) && !/minDipUsd\s*:\s*\d/.test(testSrc));
t("the module does not assign a listings floor", !/minListings\s*[:=]\s*\d/.test(src));
t("the module does not assign an anchor band", !/anchorBand\s*[:=]\s*\d/.test(src));
t("the module does not assign a jump ratio", !/jumpRatio\s*[:=]\s*\d/.test(src));
t("the module does not assign a dollar dip floor", !/minDipUsd\s*[:=]\s*\d/.test(src));
t("the module does not fall back to a jump count", !/\?\s*cfg\.minJumps\s*:\s*\d/.test(src) && !/minJumps\s*[:=]\s*\d/.test(src));

const prevFile = process.env.READ_THIN_DATA_FILE;
const prevToken = process.env.PRIVATE_DATA_TOKEN;
const outer = await mkdtemp(join(tmpdir(), "thin-flags-"));
const root = join(outer, "repo");
await mkdir(root);
try {
  process.env.READ_THIN_DATA_FILE = FIXTURE_URL.pathname;
  delete process.env.PRIVATE_DATA_TOKEN;
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

  process.env.READ_THIN_DATA_FILE = join(root, "missing-limits.json");
  clearReadThinCache();
  const blocked = await dropThinReads([quiet], root, "2026-10-22");
  const missed = JSON.parse(await readFile(join(root, "data/derived/read-flags/2026-10-22.json"), "utf8"));
  const row = missed.flags.find((item) => item.id === quiet.id);
  t("a missing config file blocks the read and flags the reason", blocked.length === 0 && row?.rule === "limits-missing" && row?.reason === "thin data limits not loaded");

  await writeFile(join(root, "partial-limits.json"), JSON.stringify({ ...FIX, minListings: null }));
  process.env.READ_THIN_DATA_FILE = join(root, "partial-limits.json");
  clearReadThinCache();
  const partialDrop = await dropThinReads([{ id: "also-quiet", name: "Also", headline: "Flat.", price: 11 }], root, "2026-10-23");
  const partialFlag = JSON.parse(await readFile(join(root, "data/derived/read-flags/2026-10-23.json"), "utf8"));
  t("a config missing one limit blocks the read", partialDrop.length === 0 && partialFlag.flags[0].reason === "thin data limits not loaded");
} finally {
  if (prevFile == null) delete process.env.READ_THIN_DATA_FILE;
  else process.env.READ_THIN_DATA_FILE = prevFile;
  if (prevToken == null) delete process.env.PRIVATE_DATA_TOKEN;
  else process.env.PRIVATE_DATA_TOKEN = prevToken;
  clearReadThinCache();
  await rm(outer, { recursive: true, force: true });
}

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("read thin data ok");
