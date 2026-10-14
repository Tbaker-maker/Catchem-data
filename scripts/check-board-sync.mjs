// Fail when a published read or mover price disagrees with the bundle.
// Run this after the bundle and the feed, so the two were just written together.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boardPriceMismatches } from "./lib/board-sync.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const priceOf = new Map();
const setDir = join(PUB, "sets");
for (const name of await readdir(setDir).catch(() => [])) {
  if (!name.endsWith(".json")) continue;
  const doc = await readJson(join(setDir, name));
  for (const it of doc?.items || []) if (it?.id && it.price) priceOf.set(it.id, it.price);
}
const reads = await readJson(join(PUB, "reads.json"));
const moversDoc = await readJson(join(PUB, "movers.json"));
const movers = [...(moversDoc?.singlesRising || []), ...(moversDoc?.sealedRising || [])];
const mismatches = boardPriceMismatches({ reads, movers, priceOf });
if (mismatches.length) {
  console.error(mismatches.slice(0, 12).map((row) => `${row.id} ${row.where} ${row.have} vs ${row.want}`).join("\n"));
  console.error(`price or image mismatch (${mismatches.length})`);
  process.exit(1);
}
console.log(`board and bundle agree (${priceOf.size} priced items, ${(reads?.reads || []).length} reads)`);
