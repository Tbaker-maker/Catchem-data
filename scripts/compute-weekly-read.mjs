import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { weeklyMarkdown, weeklyRead } from "./lib/weekly-read.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => { try { return JSON.parse(await readFile(join(ROOT, p), "utf8")); } catch { return null; } };
const asOf = new Date().toISOString().slice(0, 10);
const heatDoc = await read("data/heat-check.json");
const heat = [...(heatDoc?.products || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
const repeat = await read("data/derived/repeat-rank.json");
const receipts = await read("data/derived/receipts-weekly.json");
const lines = await read("data/derived/set-lines.json");
const doc = weeklyRead({
  asOf,
  heat,
  repeat,
  receipts,
  sets: lines?.sets || [],
});
doc.generatedAt = new Date().toISOString();
const dir = join(ROOT, "data/derived");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "weekly-read.json"), JSON.stringify(doc, null, 1) + "\n");
await writeFile(join(dir, "weekly-read.md"), weeklyMarkdown(doc));
console.log(`weekly-read: ${doc.heat.length} heat rows, ${doc.sealedAndChase.length} set lines`);
