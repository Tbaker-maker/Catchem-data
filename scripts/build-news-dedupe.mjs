import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeNews } from "./lib/news-dedupe.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const news = JSON.parse(await readFile(join(ROOT, "research/digests/news.json"), "utf8"));
const registry = await readFile(join(ROOT, "config/news-source-registry.json"), "utf8").then(JSON.parse).catch(() => ({ sources: [] }));
const tiers = new Map((registry.sources || []).map((row) => [row.name, row.tier]));
const rows = dedupeNews(news.catalog || news.items || [], (name) => tiers.get(name) || "Unconfirmed");
const out = {
  asOf: news.asOf || "",
  source: "research/digests/news.json",
  rule: "One row per headline. Official when a source in that row is Official. Confirmed when two sources remain and none is Official. Otherwise Unconfirmed.",
  count: rows.length,
  rows,
};
const dest = join(ROOT, "data/derived/news-deduped.json");
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(out));
console.log(JSON.stringify({ asOf: out.asOf, count: out.count }));
