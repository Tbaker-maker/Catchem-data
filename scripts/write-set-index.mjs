// One-shot compact set indexes from the set files already on disk.
// The nightly build writes the same files. This does not rebuild prices.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compactSide, writeSetIndexFile } from "./lib/set-index-files.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/assets/public");
const dir = join(OUT, "sets");
const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
const sets = [];
let enough = 0;
let thin = 0;
for (const name of names) {
  const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
  const row = await writeSetIndexFile(OUT, {
    slug: doc.slug || name.replace(/\.json$/, ""),
    name: doc.name,
    asOf: doc.asOf || "",
    single: doc.singleIndex,
    sealed: doc.sealedIndex,
  });
  sets.push(row);
  if (row.single >= 2 || row.sealed >= 2) enough += 1;
  else thin += 1;
}
sets.sort((a, b) => a.name.localeCompare(b.name));
const asOf = sets.map(() => "").length ? (JSON.parse(await readFile(join(dir, names[0]), "utf8")).asOf || "") : "";
await mkdir(join(OUT, "feed"), { recursive: true });
await writeFile(join(OUT, "feed/set-index.json"), JSON.stringify({ asOf, sets }));
console.log(`set index: ${sets.length} files, ${enough} with a line, ${thin} thin`);
