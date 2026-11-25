// When the feed publishes a showable sealed id, record a block if nobody
// has traced a cutout. Does not invent a photo or a size. A later cutter
// may replace the row.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { blocksForUncovered, showableProducts } from "./sealed-cutouts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

async function load(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

export async function writeUncoveredCutoutBlocks(root = ROOT) {
  const prices = await load(join(root, "data/sealed-prices.json"), { products: [] });
  const catalog = await load(join(root, "data/sealed-products.json"), []);
  const reads = await load(join(root, "research/assets/public/reads.json"), { reads: [] });
  const cuts = await load(join(root, "data/sealed-cutouts.json"), { products: [] });
  const review = await load(join(root, "data/sealed-cutout-review.json"), { products: [] });
  const show = showableProducts(prices.products || [], Array.isArray(catalog) ? catalog : [], reads);
  const blocks = blocksForUncovered(show, cuts.products || [], review.products || []);
  if (!blocks.length) return { added: [] };
  const rows = [...(cuts.products || [])];
  const notes = [...(review.products || [])];
  for (const block of blocks) {
    rows.push(block.row);
    notes.push(block.review);
  }
  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  notes.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const doc = {
    ...cuts,
    failed: rows.filter((row) => !row.pass).length,
    passed: rows.filter((row) => row.pass).length,
    products: rows,
  };
  const reviewDoc = {
    ...review,
    count: notes.length,
    products: notes,
  };
  const text = JSON.stringify(doc, null, 2) + "\n";
  await mkdir(join(root, "research/assets/public"), { recursive: true });
  await writeFile(join(root, "data/sealed-cutouts.json"), text);
  await writeFile(join(root, "research/assets/public/sealed-cutouts.json"), text);
  await writeFile(join(root, "data/sealed-cutout-review.json"), JSON.stringify(reviewDoc, null, 2) + "\n");
  return { added: blocks.map((block) => block.review.id) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await writeUncoveredCutoutBlocks();
  console.log(JSON.stringify(result));
}
