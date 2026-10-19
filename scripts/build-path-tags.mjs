// Build data/path-tags.json from the public set files already on disk.
// Does not fetch, and does not edit the set files or the read builders.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize, tagSingle, unnumberedReason } from "./lib/path-tags.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SETS = join(ROOT, "research/assets/public/sets");
const OUT = join(ROOT, "data/path-tags.json");

const names = (await readdir(SETS)).filter((name) => name.endsWith(".json")).sort();
if (!names.length) throw new Error("no public set files");

let singles = 0;
let sealedSeen = 0;
let asOf = "";
const byId = {};
const clashes = [];
const reasons = { megaEvolution: 0, promosAndExtras: 0, originalUnnumbered: 0, other: 0 };

for (const name of names) {
  const set = JSON.parse(await readFile(join(SETS, name), "utf8"));
  if (set.asOf && set.asOf > asOf) asOf = set.asOf;
  for (const item of set.items || []) {
    if (item.kind === "sealed") {
      sealedSeen += 1;
      continue;
    }
    if (item.kind !== "single") continue;
    singles += 1;
    const reason = unnumberedReason(set.name);
    if (reason) reasons[reason] += 1;
    const tag = tagSingle({ id: item.id, kind: "single", setName: set.name, artist: item.artist, rarity: item.rarity });
    if (!tag) continue;
    if (byId[item.id]) clashes.push(item.id);
    else byId[item.id] = tag;
  }
}

const rows = Object.values(byId);
const coverage = summarize({ singles, sealedSeen, rows, reasons });
const doc = {
  asOf: asOf || null,
  source: "Illustrator names are copied from the public set files, where the card name and the set already agree. Generation is a number from 1 to 9 for the series that set already belongs to, or ME for Mega Evolution, its own generation. Rarity is kept only for Illustration Rare, Special Illustration Rare and Ultra Rare. A promo set with no series name is not numbered. e-Card sets are generation 2. POP Series is generation 3. Legendary Collection is generation 1. Sealed products are not tagged.",
  rule: "This file does not match on card name. A single with no illustrator credit has no artist field. A set that is not one generation has no generation field.",
  coverage,
  clashes: clashes.length,
  byId,
};

await writeFile(OUT, JSON.stringify(doc));
console.log(`path-tags: ${Object.keys(byId).length} tagged, ${coverage.artist} artist (${coverage.artistPct}%), ${coverage.generation} generation (${coverage.generationPct}%), singles ${coverage.singles}, clashes ${clashes.length}, asOf ${doc.asOf}`);
console.log("unnumbered", coverage.unnumbered);
if (clashes.length) process.exit(1);
