// Flags cards that share a name and not a collector number.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { variantGroups } from "./lib/variant-check.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf8"));
const cards = Object.entries(catalog.cards || {}).map(([id, card]) => ({ id, ...card, number: card.number }));
const groups = variantGroups(cards);
const asOf = String(catalog.ingestedAt || "").slice(0, 10);
const doc = {
  asOf,
  source: "data/card-catalogue.json",
  note: "Same name, different collector number. A read that names one of these cards has to show the number.",
  groups: groups.length,
  rows: groups.map((group) => ({ name: group.name, numbers: group.numbers, n: group.cards.length })),
};
await mkdir(join(ROOT, "data/derived"), { recursive: true });
await writeFile(join(ROOT, "data/derived/variant-flags.json"), JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify({ variantFlags: { asOf, groups: groups.length } }));
