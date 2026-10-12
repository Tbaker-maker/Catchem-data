import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyMappedPictures, mapSingles, normCollectorNumber } from "../lib/tcgcsv-catalogue-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

const groups = [
  { groupId: 1, name: "EX Battle Stadium", abbreviation: "BST" },
  { groupId: 2, name: "SWSH07: Evolving Skies", abbreviation: "SWSH07" },
  { groupId: 3, name: "SV01: Scarlet & Violet Base Set", abbreviation: "SVI" },
  { groupId: 4, name: "Gym Heroes", abbreviation: "G1" },
  { groupId: 5, name: "SV: Scarlet & Violet Promo Cards", abbreviation: "SVP" },
];
const sets = [
  { id: "swsh5", name: "Battle Styles", ptcgoCode: "BST" },
  { id: "swsh7", name: "Evolving Skies", ptcgoCode: "EVS" },
  { id: "sv1", name: "Scarlet & Violet", ptcgoCode: "SVI" },
  { id: "g1", name: "Generations", ptcgoCode: "GEN" },
  { id: "gym1", name: "Gym Heroes", ptcgoCode: "G1" },
  { id: "svp", name: "Scarlet & Violet Black Star Promos", ptcgoCode: "PR-SV" },
];
const cards = {
  "swsh5-1": { setId: "swsh5", number: "1", name: "Fan of Waves" },
  "swsh7-1": { setId: "swsh7", number: "1", name: "Weedle" },
  "sv1-1": { setId: "sv1", number: "1", name: "Pineco" },
  "sv1-2": { setId: "sv1", number: "2", name: "Pineco" },
  "sv1-9": { setId: "sv1", number: "9", name: "Lechonk" },
  "sv1-9b": { setId: "sv1", number: "9", name: "Lechonk" },
  "sv1-3": { setId: "sv1", number: "3", name: "Sprigatito" },
  "svp-13": { setId: "svp", number: "13", name: "Miraidon" },
  "svp-13-pc": { setId: "svp", number: "13", name: "Miraidon" },
  "svp-42": { setId: "svp", number: "42", name: "Houndstone" },
  "svp-159": { setId: "svp", number: "159", name: "Magneton" },
  "svp-159-pc": { setId: "svp", number: "159", name: "Magneton" },
  "svp-151": { setId: "svp", number: "151", name: "Gouging Fire" },
  "svp-101": { setId: "svp", number: "101", name: "Pikachu" },
};
const items = [
  { id: "tcgcsv-1", groupId: 1, name: "Fan of Waves", number: "001/163", kind: "single", printing: "Normal" },
  { id: "tcgcsv-2", groupId: 2, name: "Weedle", number: "001/203", kind: "single", printing: "Normal" },
  { id: "tcgcsv-3", groupId: 3, name: "Pineco", number: "002/198", kind: "single", printing: "Normal" },
  { id: "tcgcsv-4", groupId: 3, name: "Pineco", number: "001/198", kind: "single", printing: "Normal" },
  { id: "tcgcsv-5", groupId: 3, name: "Exeggcute (Poke Ball Pattern)", number: "001/198", kind: "single" },
  { id: "tcgcsv-6", groupId: 4, name: "Blaine's Charmander", number: "1/132", kind: "single" },
  { id: "tcgcsv-7", groupId: 3, name: "Lechonk", number: "009/198", kind: "single" },
  { id: "tcgcsv-8", groupId: 5, name: "Miraidon", number: "013", kind: "single" },
  { id: "tcgcsv-9", groupId: 3, name: "Sprigatito", number: "003/198", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-10", groupId: 3, name: "Sprigatito", number: "003/198", kind: "single", printing: "Normal" },
  { id: "tcgcsv-11", groupId: 5, name: "Miraidon (Pokemon Center Exclusive)", number: "013", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-12", groupId: 3, name: "Pineco", number: "002/198", kind: "single", printing: "Reverse Holofoil" },
  { id: "tcgcsv-13", groupId: 5, name: "Houndstone - 042 (Cosmos Holo)", number: "042", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-14", groupId: 5, name: "Miraidon (Cosmos Holo)", number: "013", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-15", groupId: 5, name: "Magneton - 159", number: "159", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-16", groupId: 5, name: "Magneton - 159 (Pokémon Center Exclusive)", number: "159", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-17", groupId: 5, name: "Gouging Fire - 151", number: "151", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-18", groupId: 5, name: "Gouging Fire - 151 (Staff)", number: "151", kind: "single", printing: "Holofoil" },
  { id: "tcgcsv-19", groupId: 5, name: "Pikachu - 101", number: "101", kind: "single", printing: "Normal" },
  { id: "tcgcsv-20", groupId: 5, name: "Pikachu (Asia Championship Series 23-24)", number: "101", kind: "single" },
];

export async function runCatalogueMapTests() {
  fail = 0;
  t("065a/119 and 65a are the same collector number", normCollectorNumber("065a/119") === "65a" && normCollectorNumber("65a") === "65a");
  t("SWSH07 is not rewritten to swsh7", normCollectorNumber("SWSH07") === "SWSH7");
  const built = mapSingles({ groups, sets, cards, items });
  const byId = new Map(built.mapped.map((row) => [row.id, row]));
  t("a shared name does not choose the card", byId.get("tcgcsv-3")?.catalogueId === "sv1-2");
  t("number 1 is the other Pineco", byId.get("tcgcsv-4")?.catalogueId === "sv1-1");
  t("Battle Stadium is not Battle Styles", !byId.has("tcgcsv-1") && built.skipped.find((row) => row.id === "tcgcsv-1")?.reason === "set-code-name-conflict");
  t("SWSH07 is not swsh7", !byId.has("tcgcsv-2") && built.skipped.find((row) => row.id === "tcgcsv-2")?.reason === "set-code-not-in-catalogue");
  t("a pattern card is skipped", built.skipped.find((row) => row.id === "tcgcsv-5")?.reason === "pattern-card");
  t("G1 is not given to Generations", !byId.has("tcgcsv-6") && built.skipped.find((row) => row.id === "tcgcsv-6")?.reason === "set-code-collision");
  t("two catalogue cards with one number are skipped", built.skipped.find((row) => row.id === "tcgcsv-7")?.reason === "clashing-catalogue-numbers");
  t("a plain promo maps to the plain id, not the stamped twin", byId.get("tcgcsv-8")?.catalogueId === "svp-13");
  t("a stamped promo maps to the pc id", byId.get("tcgcsv-11")?.catalogueId === "svp-13-pc");
  t("two printings do not share an id", byId.get("tcgcsv-8") !== byId.get("tcgcsv-11"));
  t("a reverse printing stays unmapped", built.skipped.find((row) => row.id === "tcgcsv-12")?.reason === "printing-not-in-catalogue");
  t("the plain card beside a reverse still maps", byId.get("tcgcsv-3")?.catalogueId === "sv1-2");
  t("a cosmos-only promo maps to the one catalogue id", byId.get("tcgcsv-13")?.catalogueId === "svp-42");
  t("a cosmos promo beside a plain does not take the plain id", !byId.has("tcgcsv-14") && built.skipped.find((row) => row.id === "tcgcsv-14")?.reason === "printing-not-in-catalogue");
  t("an accented Pokemon Center stamp maps to the pc id", byId.get("tcgcsv-16")?.catalogueId === "svp-159-pc" && byId.get("tcgcsv-15")?.catalogueId === "svp-159");
  t("a staff stamp stays unmapped", !byId.has("tcgcsv-18") && built.skipped.find((row) => row.id === "tcgcsv-18")?.reason === "printing-not-in-catalogue" && byId.get("tcgcsv-17")?.catalogueId === "svp-151");
  t("an extra championship stamp does not take the plain id", !byId.has("tcgcsv-20") && byId.get("tcgcsv-19")?.catalogueId === "svp-101");
  t("two plain products with one number are skipped", !byId.has("tcgcsv-9") && !byId.has("tcgcsv-10") && built.skipped.filter((row) => row.reason === "ambiguous-same-number").map((row) => row.id).sort().join() === "tcgcsv-10,tcgcsv-9");

  const doc = JSON.parse(await readFile(join(ROOT, "data/tcgcsv-to-catalogue.json"), "utf8"));
  const freshGroups = JSON.parse(await readFile(join(ROOT, "data/tcgcsv-groups.json"), "utf8"));
  const freshSets = JSON.parse(await readFile(join(ROOT, "data/catalogue-set-codes.json"), "utf8"));
  const catalogue = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf8"));
  const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const singles = catalog.items.filter((item) => item.kind === "single");
  const again = mapSingles({ groups: freshGroups.groups, sets: freshSets.sets, cards: catalogue.cards, items: singles });
  t("the file is the set-code map, not a hand list", again.mapped.length === doc.mapped.length && again.mapped.every((row, i) => row.id === doc.mapped[i].id && row.catalogueId === doc.mapped[i].catalogueId));
  t("mapped plus skipped is every single", doc.mapped.length + doc.skipped.length === singles.length);
  const pattern = new Set(doc.skipped.filter((row) => row.reason === "pattern-card").map((row) => row.id));
  t("no pattern card is mapped", doc.mapped.every((row) => !pattern.has(row.id)));
  t("no mapped row is name-only", doc.mapped.every((row) => row.setId && row.number && row.catalogueId && (row.join === "set-id" || row.join === "ptcgo")));
  const swsh7 = new Set(doc.mapped.filter((row) => row.setId === "swsh7").map((row) => row.groupId));
  t("no Evolving Skies row came from abbreviation SWSH07", ![...swsh7].some((id) => freshGroups.groups.some((group) => group.groupId === id && String(group.abbreviation).toUpperCase() === "SWSH07")));
  const images = { "sv1-2": "/img/sv1/2", "tcgcsv-3": "/cards/pattern/tcgcsv-3.jpg" };
  const applied = applyMappedPictures(images, [{ id: "tcgcsv-3", catalogueId: "sv1-2" }, { id: "tcgcsv-30", catalogueId: "sv1-2" }, { id: "tcgcsv-31", catalogueId: "missing" }, { id: "tcgcsv-32", catalogueId: "sv1-2", catalogueImage: false }]);
  t("an existing picture is not replaced", applied === 1 && images["tcgcsv-3"] === "/cards/pattern/tcgcsv-3.jpg" && images["tcgcsv-30"] === "/img/sv1/2" && !images["tcgcsv-31"]);
  t("a 404 catalogue file is not copied", !images["tcgcsv-32"]);
  const withheld = doc.mapped.filter((row) => row.catalogueImage === false);
  t("a mapped row with a cropped file is not held back", withheld.every((row) => !["me2pt5", "me3", "me4", "me5"].includes(row.setId)));
  t("no two printings share a catalogue id", new Set(doc.mapped.map((row) => row.catalogueId)).size === doc.mapped.length);
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runCatalogueMapTests();
  if (n) process.exit(1);
}
