import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./flags.mjs";
import { pickMorning } from "./lib/morning-card.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
const news = JSON.parse(await readFile(join(ROOT, "research/digests/news.json"), "utf8"));
const doc = pickMorning({
  reads: reads.reads || [],
  news: news.catalog || [],
  asOf: String(reads.asOf || "").slice(0, 10),
  supplyOn: flag("supply.leadReads") === true,
});
await writeFile(join(ROOT, "research/assets/public/today.json"), JSON.stringify(doc, null, 2) + "\n");
console.log(JSON.stringify(doc, null, 2));
