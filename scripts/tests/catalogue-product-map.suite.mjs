// Catalogue-only card ids join to the nightly product by picture path, so
// /c/ecard2-H29 and /pokemon pages show tonight's price, not the Aug 22 import.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogueProductMap } from "../lib/catalogue-product-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const catalogue = {
    "ecard2-H29": { name: "Umbreon", setId: "ecard2", number: "H29", price: 1252.62, priceUpdatedAt: "2026/08/22" },
    "ex11-17": { name: "Umbreon", setId: "ex11", number: "17" },
    "neo2-13": { name: "Umbreon", setId: "neo2", number: "13" },
    "bad-id": { name: "Umbreon", setId: "../x", number: "1" },
    "tcgcsv-5": { name: "Umbreon", setId: "sv8pt5", number: "161" },
  };
  const singles = [
    { id: "tcgcsv-90001", kind: "single", scan: "/img/ecard2/H29" },
    { id: "tcgcsv-90002", kind: "single", scan: "/img/ex11/17" },
    { id: "tcgcsv-90003", kind: "single", scan: "/img/ex11/17" },
    { id: "tcgcsv-90004", kind: "sealed", scan: "/img/neo2/13" },
  ];
  const map = catalogueProductMap(catalogue, singles);
  t("a catalogue card joins the nightly single with its picture path", map["ecard2-H29"] === "tcgcsv-90001");
  t("a path two products share is no match", !("ex11-17" in map));
  t("a sealed row and a bad path never join", !("neo2-13" in map) && !("bad-id" in map));
  t("a nightly id is not remapped", !("tcgcsv-5" in map));
  const bundle = await readFile(join(ROOT, "scripts/build-public-bundle.mjs"), "utf8");
  t("the bundle writes catalogue card redirects to /c/ nightly ids", /catalogueProductMap\(catalogue\.cards/.test(bundle) && /redirects\.products\[cid\] = `\/c\/\$\{id\}`/.test(bundle));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("catalogue-product-map.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
