// Append one call row per read in a Feed bundle. Writes data/learning, not the public Pages bundle.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendLearningLog } from "./lib/learning-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const bundleFlag = args.indexOf("--bundle");
const bundlePath = bundleFlag >= 0 ? args[bundleFlag + 1] : join(ROOT, "research/assets/public/reads.json");
const outFlag = args.indexOf("--out");
const outPath = outFlag >= 0 ? args[outFlag + 1] : join(ROOT, "data/learning/calls.jsonl");

const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const result = await appendLearningLog(outPath, bundle);
console.log(`learning log ${outPath} added ${result.added} total ${result.total}`);
