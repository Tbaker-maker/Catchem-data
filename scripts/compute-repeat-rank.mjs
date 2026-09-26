// Public repeat-appearance list. Counts only — no asks, no provider prices.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boardAppearances, rankFromAppearances } from "./lib/repeat-rank.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

const heat = await read("data/heat-history.json").catch(() => []);
const sealed = await read("data/sealed-prices.json").catch(() => ({ products: [] }));
const singles = await read("data/singles-prices.json").catch(() => ({ cards: [] }));
const asOf = new Date().toISOString().slice(0, 10);
const names = new Map((sealed.products || []).map((p) => [p.id, p.name]));
const sealedRank = rankFromAppearances(boardAppearances(heat), names, asOf);

const singleHistory = [];
const singleNames = new Map();
for (const card of singles.cards || []) {
  if (!card.cardId) continue;
  singleNames.set(card.cardId, card.name);
  for (const point of card.priceHistory || []) {
    if (point?.date && typeof point.price === "number") singleHistory.push({ date: point.date, id: card.cardId, price: point.price });
  }
}
const singlesRank = rankFromAppearances(boardAppearances(singleHistory), singleNames, asOf);
const status = sealedRank.status === "building history" || singlesRank.status === "building history"
  ? "building history" : "live";

const doc = {
  asOf,
  generatedAt: new Date().toISOString(),
  method: "A name keeps showing up when it is among the eight largest day-over-day ask moves on an observed day. Windows are 7, 30, and 90 calendar days. A short tape is marked building history. Sealed and singles are separate lists.",
  status,
  sealed: { observedDays: sealedRank.observedDays, status: sealedRank.status, rows: sealedRank.rows },
  singles: { observedDays: singlesRank.observedDays, status: singlesRank.status, rows: singlesRank.rows },
};
const out = join(ROOT, "data/derived/repeat-rank.json");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(doc, null, 1) + "\n");
console.log(`repeat-rank: sealed ${sealedRank.rows.length}, singles ${singlesRank.rows.length}, ${status}`);
