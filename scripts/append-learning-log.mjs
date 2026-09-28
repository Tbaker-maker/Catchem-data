// Append one call row per read in a Feed bundle. Writes data/learning, not the public Pages bundle.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appendLearningLog, readCallLog } from "./lib/learning-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const bundleFlag = args.indexOf("--bundle");
const bundlePath = bundleFlag >= 0 ? args[bundleFlag + 1] : join(ROOT, "research/assets/public/reads.json");
const outFlag = args.indexOf("--out");
const outPath = outFlag >= 0 ? args[outFlag + 1] : (process.env.LEARNING_LOG || "");
if (!outPath) {
  console.error("The call log is private. Set LEARNING_LOG or pass --out.");
  process.exit(1);
}
if (outPath.startsWith(ROOT)) {
  console.error("Refusing to write the call log inside the public repo.");
  process.exit(1);
}
const snapFlag = args.indexOf("--snapshot");
const snapPath = snapFlag >= 0 ? args[snapFlag + 1] : "";

if (snapPath) {
  let existing = null;
  try { existing = await readFile(snapPath, "utf8"); } catch (err) { if (!err || err.code !== "ENOENT") throw err; }
  if (existing == null) {
    const prior = await readCallLog(outPath);
    await mkdir(dirname(snapPath), { recursive: true });
    await writeFile(snapPath, JSON.stringify(prior, null, 2) + "\n", "utf8");
    console.log(`snapshot ${snapPath} rows ${prior.length}`);
  } else {
    console.log(`snapshot ${snapPath} already exists`);
  }
}

const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
const result = await appendLearningLog(outPath, bundle);
console.log(`learning log ${outPath} added ${result.added} total ${result.total}`);
if (result.skipped.length) console.log(`skipped ${result.skipped.join(" ")}`);
