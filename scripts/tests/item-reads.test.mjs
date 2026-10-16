// Item read lookups: every item read lands in its bucket with a section.
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
if (fail) process.exit(1); else console.log("item reads ok");
