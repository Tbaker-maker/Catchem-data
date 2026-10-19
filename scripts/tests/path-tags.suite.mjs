// Standalone. Not imported by scripts/tests/run-tests.mjs: open PRs already edit that file.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanArtist, generationOfSet, pct, tagSingle, unnumberedReason } from "../lib/path-tags.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log(`  ok ${name}`);
  else {
    fail += 1;
    console.error(`  FAIL ${name}${detail ? " " + detail : ""}`);
  }
};

t("generation: Base Set is 1", generationOfSet("Base Set") === "1");
t("generation: Base Set 2 is 1", generationOfSet("Base Set 2") === "1");
t("generation: Expedition is 2, not Original", generationOfSet("Expedition") === "2");
t("generation: Aquapolis and Skyridge are 2", generationOfSet("Aquapolis") === "2" && generationOfSet("Skyridge") === "2");
t("generation: e-Reader sample is 2", generationOfSet("E-Reader Sample Cards") === "2");
t("generation: POP Series 5 is 3", generationOfSet("POP Series 5") === "3");
t("generation: Legendary Collection is 1", generationOfSet("Legendary Collection") === "1");
t("generation: Southern Islands stays blank", generationOfSet("Southern Islands") === "");
t("generation: Neo Genesis is 2", generationOfSet("Neo Genesis") === "2");
t("generation: Diamond and Pearl Promos are 4", generationOfSet("Diamond and Pearl Promos") === "4");
t("generation: HGSS Promos are 4", generationOfSet("HGSS Promos") === "4");
t("generation: Black and White Promos are 5", generationOfSet("Black and White Promos") === "5");
t("generation: XY Promos are 6", generationOfSet("XY Promos") === "6");
t("generation: SM Promos are 7", generationOfSet("SM Promos") === "7");
t("generation: Celebrations stays with Sword and Shield, 8", generationOfSet("Celebrations") === "8");
t("generation: Pokemon GO stays 8", generationOfSet("Pokémon GO") === "8");
t("generation: SWSH promo cards are 8", generationOfSet("SWSH: Sword & Shield Promo Cards") === "8");
t("generation: SV promo cards are 9", generationOfSet("SV: Scarlet & Violet Promo Cards") === "9");
t("generation: Mega Evolution is not numbered", generationOfSet("ME01: Mega Evolution") === "" && generationOfSet("ME: Mega Evolution Promo") === "");
t("generation: a year on a promo is not a generation", generationOfSet("McDonald's Promos 2011") === "" && generationOfSet("McDonald's Promos 2024") === "");
t("generation: miscellaneous stays blank", generationOfSet("Miscellaneous Cards & Products") === "");

t("reason: Mega Evolution", unnumberedReason("ME02: Phantasmal Flames") === "megaEvolution");
t("reason: Southern Islands is original", unnumberedReason("Southern Islands") === "originalUnnumbered");
t("reason: numbered set has no reason", unnumberedReason("Base Set") === "");

t("artist: blank and unknown drop", cleanArtist("  ") === "" && cleanArtist("Unknown") === "");
t("artist: spaces collapse", cleanArtist("  Miki   Kudo ") === "Miki Kudo");

const tagged = tagSingle({ id: "tcgcsv-42386", kind: "single", setName: "Base Set", artist: "Mitsuhiro Arita" });
t("tag: single keeps artist and generation", tagged?.artist === "Mitsuhiro Arita" && tagged?.generation === "1" && tagged?.artistSlug === "mitsuhiro-arita");
t("tag: sealed is never tagged", tagSingle({ id: "tcgcsv-1", kind: "sealed", setName: "Base Set", artist: "Mitsuhiro Arita" }) === null);
t("tag: bad id is dropped", tagSingle({ id: "base1-4", kind: "single", setName: "Base Set", artist: "Mitsuhiro Arita" }) === null);
t("tag: mega can keep an artist and still have no generation", (() => {
  const row = tagSingle({ id: "tcgcsv-9", kind: "single", setName: "ME01: Mega Evolution", artist: "aky CG Works" });
  return row?.artist === "aky CG Works" && row.generation === undefined;
})());
t("tag: no credit and no generation is omitted", tagSingle({ id: "tcgcsv-8", kind: "single", setName: "Southern Islands", artist: "" }) === null);
t("pct: one decimal", pct(18879, 28633) === 65.9);

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data/path-tags.json");
const raw = await readFile(file, "utf8");
t("file: no em or en dash", !/[\u2013\u2014]/.test(raw));
const doc = JSON.parse(raw);
t("file: coverage singles is the public catalog count", doc.coverage?.singles === 28633, String(doc.coverage?.singles));
t("file: artist percent matches the count", doc.coverage.artistPct === pct(doc.coverage.artist, doc.coverage.singles));
t("file: generation percent matches the count", doc.coverage.generationPct === pct(doc.coverage.generation, doc.coverage.singles));
t("file: sealed tagged is zero", doc.coverage.sealedTagged === 0 && doc.coverage.sealedSeen > 0);
t("file: no id clash", doc.clashes === 0);

let artist = 0;
let generation = 0;
let both = 0;
let badGen = 0;
let sealedKey = 0;
for (const [id, row] of Object.entries(doc.byId)) {
  if (!/^tcgcsv-\d+$/.test(id)) badGen += 1;
  if (row.artist) artist += 1;
  if (row.generation) {
    generation += 1;
    if (!/^[1-9]$/.test(row.generation)) badGen += 1;
  }
  if (row.artist && row.generation) both += 1;
  if (row.kind === "sealed" || row.sealed) sealedKey += 1;
}
t("file: artist recount", artist === doc.coverage.artist, `${artist} vs ${doc.coverage.artist}`);
t("file: generation recount", generation === doc.coverage.generation, `${generation} vs ${doc.coverage.generation}`);
t("file: both recount", both === doc.coverage.both);
t("file: generation is only 1 to 9", badGen === 0);
t("file: no sealed row", sealedKey === 0);
t("file: note does not say sold, sales, or supply", !/\b(sold|sales|supply)\b/i.test(doc.source + " " + doc.rule));
t("file: artist coverage agrees with the public credit count", doc.coverage.artist === 18879, String(doc.coverage.artist));

if (fail) {
  console.error(`path-tags: ${fail} failed`);
  process.exit(1);
}
console.log("path-tags: all passed");
