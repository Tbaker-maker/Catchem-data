// Weekly receipts from the watch log we already keep. Direction is the move
// into the read. The grade is the next observed ask. No dollars in the file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gradeRead, movePct, summarizeReads } from "./lib/receipts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));
const log = await read("research/pulse/watch-log.json").catch(() => ({ entries: [] }));
const heat = await read("data/heat-history.json").catch(() => []);
const sealed = await read("data/sealed-prices.json").catch(() => ({ products: [] }));
const singles = await read("data/singles-prices.json").catch(() => ({ cards: [] }));

const sealedNow = new Map((sealed.products || []).map((p) => [p.id, p.priceMedian]));
const singleNow = new Map((singles.cards || []).map((c) => [c.cardId, c.priceMarket]));
const byId = new Map();
for (const row of heat) {
  if (!byId.has(row.id)) byId.set(row.id, []);
  byId.get(row.id).push(row);
}
for (const rows of byId.values()) rows.sort((a, b) => (a.date < b.date ? -1 : 1));

function directionInto(id, date, start) {
  const rows = byId.get(id) || [];
  const prior = [...rows].reverse().find((r) => r.date < date && typeof r.price === "number");
  if (!prior || !(start > 0)) return null;
  if (start > prior.price) return "up";
  if (start < prior.price) return "down";
  return null;
}

function laterPrice(kind, id, date, start) {
  if (kind === "sealed") {
    const rows = byId.get(id) || [];
    const nxt = rows.find((r) => r.date > date && typeof r.price === "number");
    if (nxt) return nxt.price;
    return sealedNow.get(id) ?? null;
  }
  return singleNow.get(id) ?? null;
}

const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const reads = [];
for (const entry of log.entries || []) {
  if (!entry?.date || entry.date < weekAgo) continue;
  for (const kind of ["sealed", "raw"]) {
    const pick = entry[kind];
    if (!pick?.name || typeof pick.price !== "number") continue;
    const id = pick.id || null;
    const later = laterPrice(kind === "raw" ? "single" : "sealed", id, entry.date, pick.price);
    const direction = directionInto(id, entry.date, pick.price);
    const result = gradeRead({ start: pick.price, later, direction });
    reads.push({
      id, name: pick.name, kind: kind === "raw" ? "single" : "sealed", date: entry.date,
      result, movePct: movePct(pick.price, later),
    });
  }
}
const summary = summarizeReads(reads);
const doc = {
  asOf: new Date().toISOString().slice(0, 10),
  generatedAt: new Date().toISOString(),
  method: "Reads we tracked in the last 7 days. A hit moved the same way as the move into the read. A miss moved the other way, or did not move. The largest misses are listed with the largest hits. Dollars are not stored here.",
  ...summary,
  reads: reads.map(({ id, name, kind, date, result, movePct: pct }) => ({ id, name, kind, date, result, movePct: pct })),
};
const out = join(ROOT, "data/derived/receipts-weekly.json");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(doc, null, 1) + "\n");
console.log(`receipts: tracked ${summary.tracked}, graded ${summary.graded}, hit rate ${summary.hitRate}`);
