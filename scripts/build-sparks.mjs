// Writes research/assets/public/sparks/NN.json from the published buckets.
// One product id, one packed 30-day series. No new prices.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packSpark } from "./lib/spark30.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/assets/public");

export async function writeSparks(outDir = OUT) {
  const counts = JSON.parse(await readFile(join(outDir, "counts.json"), "utf8"));
  const asOf = String(counts.asOf || "").slice(0, 10);
  const dir = join(outDir, "buckets");
  const names = (await readdir(dir)).filter((name) => /^\d{2}\.json$/.test(name));
  const dest = join(outDir, "sparks");
  await mkdir(dest, { recursive: true });
  let rows = 0;
  for (const name of names) {
    const cards = JSON.parse(await readFile(join(dir, name), "utf8"));
    const packed = {};
    for (const card of cards || []) {
      if (!card || !card.id) continue;
      const spark = packSpark(card.hist, asOf);
      if (spark) packed[card.id] = spark;
    }
    rows += Object.keys(packed).length;
    await writeFile(join(dest, name), JSON.stringify({ asOf, rows: packed }));
  }
  return { asOf, files: names.length, rows };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = await writeSparks();
  console.log(`sparks: ${out.rows} series in ${out.files} files, as of ${out.asOf}`);
}
