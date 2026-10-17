// Write research/assets/public/promos.json from the published set files
// plus data/promo-sources.json. No network. No new downloads.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPromos } from "./lib/promos.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const setsDir = join(root, "research/assets/public/sets");
const mapPath = join(root, "data/promo-sources.json");
const outPath = join(root, "research/assets/public/promos.json");

const files = (await readdir(setsDir)).filter((name) => name.endsWith(".json"));
const sets = [];
for (const file of files) {
  sets.push(JSON.parse(await readFile(join(setsDir, file), "utf8")));
}
const map = JSON.parse(await readFile(mapPath, "utf8"));
const doc = buildPromos(sets, { links: Array.isArray(map.links) ? map.links : [] });
await writeFile(outPath, JSON.stringify(doc) + "\n");
console.log(`promos: ${doc.count} priced, ${doc.sealedCount} sealed packs, ${doc.linked} linked, as of ${doc.asOf}`);
