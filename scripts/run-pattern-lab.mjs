import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promotePatterns } from "./lib/pattern-lab.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const episodes = await readFile(join(ROOT, "data/derived/pattern-episodes.json"), "utf8").then(JSON.parse).catch(() => null);
const asOf = new Date().toISOString().slice(0, 10);
const result = episodes ? promotePatterns(episodes.rows || []) : null;
const out = {
  asOf,
  rule: "Weekly. One count per card per episode. A pattern is promoted only when the false-discovery check passes at q=0.05 and the edge is at least 5 points.",
  episodes: result ? result.baseN : 0,
  duplicates: result ? result.duplicates : 0,
  promoted: result ? result.promoted : [],
  reason: episodes ? "" : "No episode file yet, so nothing is promoted.",
};
const dest = join(ROOT, "data/derived/pattern-lab.json");
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ asOf, episodes: out.episodes, promoted: out.promoted.length, reason: out.reason || "ok" }));
