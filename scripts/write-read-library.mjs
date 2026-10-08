// Writes research/assets/public/feed/read-library.json from the files already on disk.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSeries } from "./build-extra-reads.mjs";
import { writeReadLibrary } from "./lib/read-library.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));

const catalogue = await read("research/assets/public/feed/catalogue.json");
const extra = await read("research/assets/public/feed/extra-reads.json");
const series = await loadSeries(ROOT);
const lib = await writeReadLibrary({ root: ROOT, catalogue, extra, series });
const sample = {};
for (const kind of lib.order) {
  const row = lib.board.find((item) => item.signal === kind) || lib.signals.find((item) => item.signal === kind);
  sample[kind] = row ? row.headline : "";
}
console.log(JSON.stringify({ asOf: lib.asOf, counts: lib.counts, board: lib.board.length, signals: lib.signals.length, sample, disagreements: lib.disagreements.length }, null, 2));
