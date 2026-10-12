// Private per-detector scores. Nothing here is written to the public tree.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { learningNight } from "./lib/detectors/score-flag.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_REL = "data/private/detector-learning.json";

export async function writeDetectorReport(root, rows) {
  const doc = learningNight(rows);
  if (doc.public !== false) throw new Error("detector report must stay private");
  const path = join(root, PRIVATE_REL);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(doc));
  return doc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = JSON.parse(process.argv[2] || "[]");
  const doc = await writeDetectorReport(ROOT, rows);
  console.log(JSON.stringify({ public: doc.public, rows: doc.rows.length }));
}
