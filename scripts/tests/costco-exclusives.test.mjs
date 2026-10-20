import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { costcoListingOk } from "../lib/costco-exclusives.mjs";
import { keepTitle } from "../lib/listing-counts.mjs";
import { rankCatalog } from "../lib/collector-search.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const doc = JSON.parse(await readFile(join(ROOT, "data/costco-exclusives.json"), "utf8"));
const products = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
const lite = JSON.parse(await readFile(join(ROOT, "research/assets/public/search-lite.json"), "utf8"));
const byId = new Map(products.map((row) => [row.id, row]));
const catById = new Map((catalog.items || []).map((row) => [row.id, row]));

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log(`  ok ${name}`);
  else { fail += 1; console.error(`  FAIL ${name}`); }
};

const rows = doc.products || [];
t("18 sealed Costco products", rows.length === 18);
t("every row is US", rows.every((row) => row.region === "US"));
t("every row is tagged by the file", doc.tag === "Costco exclusive");
t("no invented release date", rows.every((row) => row.release == null));
t("plain ETB title is not the Costco bundle", costcoListingOk({ name: "Costco Pokemon Evolving Skies Elite Trainer Box and Tin", exclusive: "Costco" }, "Pokemon Evolving Skies Elite Trainer Box") === false);
t("Costco title is not the plain ETB", costcoListingOk({ name: "Evolving Skies Elite Trainer Box", subtype: "etb" }, "Costco Pokemon Evolving Skies Elite Trainer Box and Tin") === false);
t("Costco title stays on the Costco product", costcoListingOk({ exclusive: "Costco", name: "Costco Pokemon Evolving Skies Elite Trainer Box and Tin" }, "Costco Evolving Skies ETB and Tin") === true);
t("listing count drops a plain ETB for the Costco row", keepTitle("sealed", "Pokemon Evolving Skies Elite Trainer Box", { name: "Costco Pokemon Evolving Skies Elite Trainer Box and Tin", kind: "sealed" }) === false);
t("listing count keeps a Costco title", keepTitle("sealed", "Costco Evolving Skies Elite Trainer Box and Tin", { name: "Costco Pokemon Evolving Skies Elite Trainer Box and Tin", kind: "sealed" }) === true);

let priced = 0;
let checking = 0;
for (const row of rows) {
  const live = byId.get(row.id);
  const cat = catById.get(row.id);
  t(`${row.id} is on the sealed list`, !!live && live.exclusive === "Costco" && live.browse !== false);
  t(`${row.id} is in the catalog`, !!cat && cat.kind === "sealed");
  if (Number(cat?.price) > 0) priced += 1;
  else checking += 1;
  if (row.ebay === true) {
    t(`${row.id} nightly query requires costco`, Array.isArray(row.requireExtra) && row.requireExtra.includes("costco") && /costco/i.test(row.searchQuery || ""));
    t(`${row.id} stays off the matched sku list`, live.ebay === false && !live.searchQuery);
  }
}
t("priced from the catalog", priced === 15);
t("no catalog price yet", checking === 3);

const top = (q) => rankCatalog(q, lite, 1)[0];
const name = (row) => String(row?.[1] || "").toLowerCase();
t("costco evolving skies opens the bundle", /costco/.test(name(top("costco evolving skies"))) && /evolving skies/.test(name(top("costco evolving skies"))) && /elite trainer box/.test(name(top("costco evolving skies"))));
t("evolving skies etb is not the costco bundle", !/costco/.test(name(top("evolving skies etb"))));
t("151 etb is not the costco bundle", !/costco/.test(name(top("151 etb"))));

const fixture = [
  ["tcgcsv-1", "Evolving Skies Elite Trainer Box", "Evolving Skies", "", "", "sealed", 400, "swsh07-evolving-skies", ""],
  ["tcgcsv-610741", "Costco Pokemon Evolving Skies Elite Trainer Box and Tin", "Evolving Skies", "", "", "sealed", 622, "swsh07-evolving-skies", ""],
  ["tcgcsv-587750", "Costco Pokemon Collector 3-Pack: Scarlet & Violet 151 ETB + Paldea Legends Tins", "Miscellaneous Cards & Products", "", "", "sealed", 1000, "miscellaneous", ""],
];
const fixTop = (q) => rankCatalog(q, fixture, 1)[0];
t("costco etb prefers a costco elite trainer product", /costco/.test(name(fixTop("costco etb"))) && (/elite trainer/.test(name(fixTop("costco etb"))) || /\betb\b/.test(name(fixTop("costco etb")))));
t("costco etb can see an ETB abbreviation", String(fixTop("costco etb")?.[0]) !== "tcgcsv-1");

if (fail) {
  console.error(`costco exclusives: ${fail} failed`);
  process.exit(1);
}
console.log("costco exclusives ok");
