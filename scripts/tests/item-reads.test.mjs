// Item read lookups: every item read lands in its bucket with a section.
import { splitImages, splitIr } from "../write-card-lookups.mjs";
import { buildItemReads, sectionFor, itemIdOf, bucketOf } from "../write-item-reads.mjs";

let fail = 0;
const t = (n, c) => { if (c) console.log("  ok ", n); else { fail++; console.error("  FAIL", n); } };
const bundle = { asOf: "2026-10-16", reads: [
  { id: "a", readKind: "deep", sku: "tcgcsv-101", headline: "A", asOf: "2026-10-15" },
  { id: "b", readKind: "listings", href: "/p/tcgcsv-101", headline: "B", asOf: "2026-10-16" },
  { id: "c", readKind: "set", headline: "No item" },
  { id: "d", readKind: "rarity-band", href: "/c/tcgcsv-7", path: "D" },
] };
const out = buildItemReads(bundle);
t("bucket by id % 100", bucketOf("tcgcsv-101") === "01" && !!out["01"]["tcgcsv-101"]);
t("all reads for an item kept, newest first", out["01"]["tcgcsv-101"].map((r) => r.id).join() === "b,a");
t("reads with no item skipped", !JSON.stringify(out).includes('"c"'));
t("sections", sectionFor({ readKind: "listings" }) === "supply" && sectionFor({ kind: "rarity-band" }) === "rank" && sectionFor({ readKind: "deep" }) === "price");
t("href ids", itemIdOf({ href: "/c/tcgcsv-7" }) === "tcgcsv-7" && itemIdOf({ href: "https://x/c/tcgcsv-7" }) === "");
t("sealed slug hrefs map through redirects", itemIdOf({ href: "/p/sv3pt5-bb" }, { "sv3pt5-bb": "/p/tcgcsv-502000" }) === "tcgcsv-502000");
const im = splitImages({ "tcgcsv-101": "/thumb/a/1", "base-set": "/img/base1/logo.png", "base1-1": "/thumb/base1/1" });
t("image split keeps bucket ids and logos only", im["01"]["tcgcsv-101"] && im["05"]["base-set"] && !im["01"]["base1-1"] && !im["05"]["tcgcsv-101"]);
const ir = splitIr({ asOf: "x", rows: [{ id: "tcgcsv-101" }, { id: "tcgcsv-7" }] });
t("ir split keeps header and bucket rows", ir["01"].asOf === "x" && ir["01"].rows.length === 1 && ir["07"].rows[0].id === "tcgcsv-7");
t("item reads keep the full read", out["01"]["tcgcsv-101"][0].readKind === "listings");
if (fail) process.exit(1); else console.log("item reads ok");
