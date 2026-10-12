// Writes data/card-variants.json and feed/card-variants.json. build-feed runs the same step nightly.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildVariantFile } from "./lib/read-tags.mjs";
const doc = await buildVariantFile(join(dirname(fileURLToPath(import.meta.url)), ".."));
console.log(JSON.stringify(doc.counts));
