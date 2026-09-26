import { searchItems } from "../lib/search-rank.mjs";

let pass = 0;
let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.error(`  FAIL ${name} ${detail}`); }
};

const items = [
  { id: "es-215", name: "Umbreon VMAX", set: "Evolving Skies", number: "215", kind: "single", rarity: "Rare Rainbow", aliases: ["moonbreon", "umbrean"], price: 200, source: "TCGplayer market price", asOf: "2026-09-25" },
  { id: "es-bb", name: "Evolving Skies Booster Box", set: "Evolving Skies", kind: "sealed", subtype: "booster-box", aliases: ["bb", "booster box", "es"], price: 900, source: "eBay asking prices", asOf: "2026-09-25" },
  { id: "es-etb", name: "Evolving Skies Elite Trainer Box", set: "Evolving Skies", kind: "sealed", subtype: "etb", aliases: ["etb", "elite trainer box", "es"], price: 80, source: "eBay asking prices", asOf: "2026-09-25" },
  { id: "151-etb", name: "151 Elite Trainer Box", set: "Scarlet & Violet 151", kind: "sealed", subtype: "etb", aliases: ["etb", "151"], price: 70, source: "eBay asking prices", asOf: "2026-09-25" },
  { id: "151-pc", name: "151 Pokemon Center Elite Trainer Box", set: "Scarlet & Violet 151", kind: "sealed", subtype: "pc-etb", aliases: ["pc etb", "pokemon center etb", "151"], price: 120, source: "eBay asking prices", asOf: "2026-09-25" },
  { id: "zard", name: "Charizard ex", set: "151", number: "6", kind: "single", aliases: ["zard", "charzard"], price: 12, source: "TCGplayer market price", asOf: "2026-09-25" },
  { id: "pe-bb", name: "Prismatic Evolutions Booster Box", set: "Prismatic Evolutions", kind: "sealed", subtype: "booster-box", aliases: ["bb", "pe", "prismatic"], price: 400, source: "eBay asking prices", asOf: "2026-09-25" },
  { id: "slab", name: "Umbreon VMAX PSA 10", set: "Evolving Skies", number: "215", kind: "slab", aliases: ["moonbreon"], price: 2000, source: "eBay asking prices", asOf: "2026-09-25" },
];

const queries = [
  ["moonbreon", "es-215"],
  ["charzard", "zard"],
  ["umbrean", "es-215"],
  ["zard", "zard"],
  ["151 etb", "151-etb"],
  ["pc etb", "151-pc"],
  ["prismatic", "pe-bb"],
  ["evolving skies booster box", "es-bb"],
  ["etb", "es-etb"],
  ["bb", "es-bb"],
];
console.log("-- fixture queries --");
for (const [query, id] of queries) {
  const hits = searchItems(items, query);
  t(`${query} -> ${id}`, hits[0]?.id === id, hits.slice(0, 3).map((h) => `${h.id}:${h.match}`).join(", "));
}
t("exact beats alias", searchItems(items, "Umbreon VMAX")[0].match === "exact");
t("sealed filter drops the single", searchItems(items, "moonbreon", { kind: "sealed" }).every((h) => h.kind === "sealed"));
t("single filter keeps the card", searchItems(items, "moonbreon", { kind: "single" })[0].id === "es-215");
t("slab stays out of singles", searchItems(items, "moonbreon", { kind: "single" }).every((h) => h.kind !== "slab"));
t("short query returns nothing", searchItems(items, "e").length === 0);
const banned = ["crypto", "nft", "wallet", "dsk"];
const blob = JSON.stringify(items).toLowerCase();
for (const word of banned) t(`fixture has no ${word}`, !blob.includes(word));

console.log(`\n${pass} passed / ${fail} failed`);
if (fail) process.exit(1);
