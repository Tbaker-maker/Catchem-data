// Writes research/assets/public/price-hold.json and clears held headline prices
// on the published set files, the singles index, and movers.
// The listing band is read from catchem-data-private. It is not written out.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decidePrice, isVintageRelease, loadPriceTrustConfig, printingOk, publicHoldDoc } from "./lib/price-trust.mjs";
import { indexLine } from "./lib/public-index-line.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");
const SETS = join(PUB, "sets");

const cfg = await loadPriceTrustConfig(ROOT);
const asOf = "2026-10-17";

const unverified = new Set();
const ratingDir = join(PUB, "feed/rating");
for (const name of await readdir(ratingDir)) {
  if (!name.endsWith(".json")) continue;
  const doc = JSON.parse(await readFile(join(ratingDir, name), "utf8"));
  for (const row of doc.rows || []) {
    if (row && row.check && row.id) unverified.add(row.id);
  }
}

const files = (await readdir(SETS)).filter((name) => name.endsWith(".json"));
const decisions = [];
const vintageIds = new Set();
let vintagePriced = 0;
let modernPriced = 0;
let printingMixed = 0;
let unverifiedVintage = 0;
let unverifiedModern = 0;

for (const name of files) {
  const doc = JSON.parse(await readFile(join(SETS, name), "utf8"));
  const release = doc.release || "";
  const vintage = isVintageRelease(release);
  let changed = false;
  for (const item of doc.items || []) {
    if (!item || item.kind === "sealed") continue;
    const priced = Number(item.price) > 0;
    if (priced && vintage) vintagePriced += 1;
    if (priced && !vintage) modernPriced += 1;
    if (priced && !printingOk(item)) printingMixed += 1;
    const flagged = unverified.has(item.id);
    if (flagged && vintage) unverifiedVintage += 1;
    if (flagged && !vintage) unverifiedModern += 1;
    if (!priced) continue;
    const decision = decidePrice({
      id: item.id,
      kind: "single",
      release,
      price: item.price,
      printing: item.printing,
      printings: item.printings,
      condition: item.condition,
      unverified: flagged,
      vintage,
      ebayAsks: [],
    }, cfg);
    if (vintage && item.id) vintageIds.add(item.id);
    if (decision.status !== "checking") continue;
    decisions.push({ id: item.id, status: "checking", reason: decision.reason, vintage });
    item.price = null;
    item.priceStatus = "checking";
    if (Array.isArray(item.printings)) {
      item.printings = item.printings.map((p) => (p && Number(p.price) > 0 ? { ...p, price: null, status: "checking" } : p));
    }
    changed = true;
  }
  if (!changed) continue;
  const live = (doc.items || []).filter((it) => it && it.kind === "single" && it.priceStatus !== "checking" && Number(it.price) > 0);
  doc.priced = live.length;
  const value = Math.round(live.reduce((sum, it) => sum + Number(it.price || 0), 0));
  if (value > 0) doc.value = value;
  else delete doc.value;
  doc.singleIndex = indexLine((doc.items || []).filter((it) => it && it.kind === "single" && it.priceStatus !== "checking")).points;
  if (doc.chaseLine && decisions.some((row) => row.id === doc.chaseLine.id)) doc.chaseLine = { ...doc.chaseLine, price: null };
  await writeFile(join(SETS, name), JSON.stringify(doc));
}

const hold = publicHoldDoc(decisions, asOf);
await writeFile(join(PUB, "price-hold.json"), JSON.stringify(hold));

const setsDoc = JSON.parse(await readFile(join(PUB, "sets.json"), "utf8"));
const bySlug = new Map();
for (const name of files) {
  const doc = JSON.parse(await readFile(join(SETS, name), "utf8"));
  bySlug.set(doc.slug, doc);
}
for (const row of setsDoc.sets || []) {
  const doc = bySlug.get(row.slug);
  if (!doc) continue;
  row.priced = doc.priced;
  if (doc.value > 0) row.value = doc.value;
  else delete row.value;
}
await writeFile(join(PUB, "sets.json"), JSON.stringify(setsDoc));

const all = [];
for (const doc of bySlug.values()) {
  for (const it of doc.items || []) {
    if (it && it.kind === "single" && it.priceStatus !== "checking") all.push(it);
  }
}
const indexes = JSON.parse(await readFile(join(PUB, "indexes.json"), "utf8"));
indexes.singles = indexLine(all).points;
indexes.asOf = asOf;
indexes.note = "Chain-linked value-weighted index: each day is the sum of today's prices over the sum of the same cards' prices on the last real day. Singles and sealed are separate. A single being checked is left out. Two days is not a month.";
await writeFile(join(PUB, "indexes.json"), JSON.stringify(indexes, null, 1) + "\n");

const movers = JSON.parse(await readFile(join(PUB, "movers.json"), "utf8"));
const drop = (rows) => (rows || []).filter((row) => row && !hold.ids[row.id]);
for (const key of ["singles", "singlesRising", "singlesFalling"]) movers[key] = drop(movers[key]);
await writeFile(join(PUB, "movers.json"), JSON.stringify(movers, null, 1) + "\n");

const note = {
  asOf,
  note: "A condition is shown only when the price is for that condition. Graded and played copies can differ.",
  source: "TCGplayer market price",
  nmDefault: false,
};
await writeFile(join(PUB, "feed/card/condition-note.json"), JSON.stringify(note));

const vintageChecking = decisions.filter((row) => row.vintage).length;
const modernChecking = decisions.filter((row) => !row.vintage).length;
const byReason = {};
for (const row of decisions) byReason[row.reason] = (byReason[row.reason] || 0) + 1;
const sweep = {
  asOf,
  before: {
    vintagePriced,
    modernPriced,
    nmChipVintage: vintagePriced,
    nmChipModern: modernPriced,
    unverifiedVintage,
    unverifiedModern,
    printingMixed,
  },
  after: {
    vintageChecking,
    modernChecking,
    vintagePublished: vintagePriced - vintageChecking,
    nmChipVintage: 0,
    nmChipModern: 0,
    byReason,
  },
  note: "NM chips before are every priced single, because the page stamped NM with no condition field. No eBay ask sample for printing and condition is on disk, so no vintage price is published.",
};
await writeFile(join(ROOT, "data/derived/price-trust-sweep.json"), JSON.stringify(sweep, null, 1) + "\n");
console.log(JSON.stringify(sweep.after));
console.log("holds", Object.keys(hold.ids).length);
