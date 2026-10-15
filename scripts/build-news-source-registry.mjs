// Writes the logged review for each registry source. No network.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewSource } from "./lib/news-source-registry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(await readFile(join(ROOT, "config/news-source-registry.json"), "utf8"));
const logs = await readFile(join(ROOT, "data/derived/news-source-logs.json"), "utf8").then(JSON.parse).catch(() => ({ logs: [] }));
const byName = new Map((logs.logs || []).map((row) => [row.name, row]));
const reviews = (registry.sources || []).map((source) => {
  const log = byName.get(source.name) || {};
  return reviewSource(source, {
    robotsText: log.robotsText || "",
    termsText: log.termsText || "",
    path: log.path || "/",
    checkedAt: log.checkedAt || "",
  });
});
const out = {
  asOf: registry.asOf,
  rule: registry.rule,
  dropped: reviews.filter((row) => row.dropped).map((row) => row.name),
  reviews,
};
const dest = join(ROOT, "data/derived/news-source-registry.json");
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ sources: reviews.length, dropped: out.dropped.length }));
