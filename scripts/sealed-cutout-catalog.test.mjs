// Every sealed product the site shows from the priced file, the public feed,
// and the named holes has a passed cutout or a blocked reason. A pass row
// points at a real png and webp. A fail row has no file.
import { readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { showableProducts, productTypeOf, nameAgrees, FEED_MUST, judgeCut } from "./lib/sealed-cutouts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function load(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " " + detail : ""}`); }
  };

  const prices = await load(join(ROOT, "data/sealed-prices.json"), { products: [] });
  const catalog = await load(join(ROOT, "data/sealed-products.json"), []);
  const reads = await load(join(ROOT, "research/assets/public/reads.json"), { reads: [] });
  const cuts = await load(join(ROOT, "data/sealed-cutouts.json"), { products: [] });
  const review = await load(join(ROOT, "data/sealed-cutout-review.json"), { products: [] });
  const show = showableProducts(prices.products || [], Array.isArray(catalog) ? catalog : [], reads);
  const byId = new Map((cuts.products || []).map((row) => [row.id, row]));
  const why = new Map((review.products || []).map((row) => [row.id, row]));

  t("the show set is the priced file plus the feed holes", show.length >= (prices.products || []).length);
  const missing = [];
  for (const product of show) {
    const row = byId.get(product.id);
    if (!row) { missing.push(product.id); continue; }
    if (row.pass === true) {
      if (!row.file || !row.png) missing.push(product.id + " no file");
      else {
        for (const rel of [row.file, row.png]) {
          try { await access(join(ROOT, "research/assets/public", rel)); }
          catch { missing.push(product.id + " " + rel); }
        }
      }
    } else {
      const note = why.get(product.id);
      if (!note || !note.reason) missing.push(product.id + " no reason");
    }
  }
  t("every showable sealed id passed or is blocked", missing.length === 0, missing.slice(0, 8).join(", "));

  for (const id of FEED_MUST) {
    const row = [...byId.values()].find((r) => r.id === id || r.siteId === id);
    t(id + " is in the catalog", !!row);
  }
  const sleeve = [...byId.values()].find((r) => r.id === "tcgcsv-712112");
  t("the sleeved pack is not typed as a bare pack", sleeve && sleeve.productType === "sleeved-pack");
  const blister = [...byId.values()].find((r) => r.id === "tcgcsv-712108");
  t("the blister is a blister", blister && blister.productType === "blister");
  const deck = [...byId.values()].find((r) => r.id === "tcgcsv-704188");
  t("the battle deck is a deck", deck && deck.productType === "deck");

  const shippedFail = (cuts.products || []).filter((r) => r.pass === true && (!String(r.file || "").startsWith("cutouts/") || /\.jpe?g$/i.test(String(r.file || ""))));
  t("a pass row is a cutout image", shippedFail.length === 0);
  const leaked = (review.products || []).filter((r) => r.kept && r.kept !== "not shipped");
  t("a blocked cutout is not shipped", leaked.length === 0);

  t("a tiny source names its reason", judgeCut({ tiny: true }).join(",") === "source photo is too small");
  const sample = { name: "Delta Reign Sleeved Booster Pack", subtype: "booster-pack" };
  t("a sleeved name wins over a pack subtype", productTypeOf(sample) === "sleeved-pack" && nameAgrees(sample.name, "sleeved-pack"));
  t("decks plural is a deck", productTypeOf({ name: "Legendary Battle Decks [Lugia]" }) === "deck");

  const lib = await readFile(join(ROOT, "scripts/lib/sealed-cutouts.mjs"), "utf8");
  t("the public lib has no scale table", !/booster-box"\s*:\s*0\./.test(lib) && !lib.includes("cutout-scale.json"));
  const py = await readFile(join(ROOT, "scripts/sealed-cutout-cut.py"), "utf8");
  const build = await readFile(join(ROOT, "scripts/build-sealed-cutouts.mjs"), "utf8");
  t("public cutout code has no em or en dash", !/[\u2013\u2014]/.test(lib + py + build));

  return fail;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await run();
  if (n) process.exit(1);
}
