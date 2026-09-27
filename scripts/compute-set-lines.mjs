import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setLines } from "./lib/set-lines.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));
const sealed = await read("data/sealed-prices.json").catch(() => ({ products: [] }));
const singles = await read("data/singles-prices.json").catch(() => ({ cards: [] }));
const history = await read("data/heat-history.json").catch(() => []);
const doc = setLines({
  sealed: sealed.products || [],
  singles: singles.cards || [],
  sealedHistory: history,
  asOf: (sealed.updatedAt || new Date().toISOString()).slice(0, 10),
});
doc.generatedAt = new Date().toISOString();
const out = join(ROOT, "data/derived/set-lines.json");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(doc, null, 1) + "\n");
const thin = doc.sets.filter((s) => s.sealed.status !== "live" || s.chase.status !== "live").length;
console.log(`set-lines: ${doc.sets.length} sets, ${thin} still building a line`);
