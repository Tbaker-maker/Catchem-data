// Inputs for sealed pathways: every sealed product with a TCGplayer id, its
// long history (private TCGCSV archive, passed in) merged with our nightly
// tcgcsv days. Same product id on both sides. Nothing is filled.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { mergePoints } from "./read-pathways.mjs";

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

export async function nightlyMarkets(root, ids) {
  const dir = join(root, "data/history/tcgcsv-daily");
  const by = new Map();
  let files = [];
  try { files = (await readdir(dir)).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort(); } catch { return by; }
  for (const name of files) {
    const doc = await readJson(join(dir, name), {});
    const date = doc.date || name.slice(0, 10);
    for (const row of doc.prices || []) {
      const id = Number(row.id);
      if (!ids.has(id) || !(row.market > 0)) continue;
      const list = by.get(id) || [];
      if (!list.length || list.at(-1)[0] !== date) list.push([date, Number(row.market)]);
      by.set(id, list);
    }
  }
  return by;
}

export async function loadSealedPathwayItems(root, longById) {
  if (!longById || !longById.size) return [];
  const products = await readJson(join(root, "data/sealed-products.json"), []);
  const sets = await readJson(join(root, "research/assets/public/sets.json"), {});
  const releaseOf = new Map((sets?.sets || []).map((s) => [String(s.name || "").toLowerCase(), s.release || s.releaseDate || ""]));
  const pid = new Map();
  for (const p of products) { const n = Number(p.tcgPlayerId); if (n > 0 && longById.has(p.id)) pid.set(n, p); }
  const nightly = await nightlyMarkets(root, new Set(pid.keys()));
  const out = [];
  for (const [n, p] of pid) {
    const pts = mergePoints(longById.get(p.id), nightly.get(n) || []);
    if (pts.length < 2) continue;
    out.push({ id: p.id, name: p.name, set: p.set || "", release: releaseOf.get(String(p.set || "").toLowerCase()) || "", rarity: "", pts });
  }
  return out;
}
