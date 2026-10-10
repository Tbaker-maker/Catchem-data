// Writes the public supply-lead file from heat-history. Does not call eBay.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./flags.mjs";
import { buildSupplyLead } from "./lib/supply-lead.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const heat = JSON.parse(await readFile(join(ROOT, "data/heat-history.json"), "utf8"));
const names = {};
const diveDir = join(ROOT, "research/pulse/dive");
for (const file of await readdir(diveDir)) {
  if (!file.endsWith(".json") || file === "index.json") continue;
  const doc = JSON.parse(await readFile(join(diveDir, file), "utf8"));
  if (doc && doc.id && doc.name) names[doc.id] = doc.name;
}
const enabled = flag("supply.leadReads") === true;
const doc = buildSupplyLead(heat, names, { enabled });
const out = join(ROOT, "research/assets/public/feed/supply-lead.json");
await writeFile(out, JSON.stringify(doc, null, 2) + "\n");
console.log(JSON.stringify({
  enabled: doc.enabled,
  asOf: doc.asOf,
  nights: doc.nightCount,
  products: doc.products,
  productsOnLatest: doc.productsOnLatest,
  windows: doc.windows,
  wouldQualify: doc.wouldQualify,
  published: doc.reads.length,
}, null, 2));
