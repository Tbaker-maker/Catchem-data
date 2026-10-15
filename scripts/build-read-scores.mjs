import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publishScores } from "./lib/read-scorer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let weights;
try { weights = JSON.parse(await readFile(join(ROOT, "data/private/scanner/weights.json"), "utf8")); }
catch {
  console.log(JSON.stringify({ published: 0, reason: "no private weight file" }));
  process.exit(0);
}
const raw = (weights.rows || []).map((row) => ({
  id: [row.pattern, row.stage, row.kind, row.horizon, row.dir].filter((part) => part != null && part !== "").join("|"),
  hits: row.hits,
  n: row.n,
}));
const rows = publishScores(raw);
const out = {
  asOf: weights.asOf || "",
  source: "scanner weight file",
  rule: "Hit rate is hits divided by the sample. A row is published only when the sample is at least 20.",
  count: rows.length,
  rows,
};
const dest = join(ROOT, "research/assets/public/read-scores.json");
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ asOf: out.asOf, published: out.count, seen: raw.length }));
