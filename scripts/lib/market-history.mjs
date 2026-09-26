// TCGplayer market history for sealed products, from two labelled folders.
//   data/history/tcgplayer-market/  TCGCSV live days (daily append from 2026-09-25)
//   data/history/ppt-sealed-private/  mounted from the private repo for one run, if the token exists
//   data/history/ppt-sealed/          old public folder; removed. Still read if a checkout has it.
// The folders are never merged on disk. Readers get one value per day: the
// TCGCSV point when there is one, otherwise the PPT point. A day in neither
// folder is missing and stays missing.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const TCGCSV_DIR = "data/history/tcgplayer-market";
export const PPT_DIR = "data/history/ppt-sealed-private";
export const PPT_DIR_LEGACY = "data/history/ppt-sealed";
export const TCGCSV_SOURCE = "TCGplayer market via TCGCSV";
export const PPT_SOURCE = "PokemonPriceTracker (TCGplayer-derived)";
const META = new Set(["mapping.json", "unmatched.json", "coverage.json", "manifest.json"]);

async function readFolder(root, dir) {
  const out = new Map();
  let names = [];
  try { names = await readdir(join(root, dir)); } catch { return out; }
  for (const name of names) {
    if (!name.endsWith(".json") || META.has(name)) continue;
    const doc = JSON.parse(await readFile(join(root, dir, name), "utf8"));
    if (!doc.id) continue;
    const m = new Map();
    for (const p of doc.points || []) if (p.date && p.market > 0) m.set(p.date, p.market);
    out.set(doc.id, m);
  }
  return out;
}

// Returns { ids, merged: Map id -> [{date, market, source}], priceMap: Map id -> Map date -> market,
//           pairPrice(id, a, b) -> [pa, pb] | null, coverage }
export async function loadMarketHistory(root) {
  const tcg = await readFolder(root, TCGCSV_DIR);
  const mounted = await readFolder(root, PPT_DIR);
  const legacy = await readFolder(root, PPT_DIR_LEGACY);
  const ppt = mounted.size ? mounted : legacy;
  if (!ppt.size) console.log("No PPT sealed history mounted. Those days are skipped, not filled.");
  const ids = new Set([...tcg.keys(), ...ppt.keys()]);
  const merged = new Map();
  const priceMap = new Map();
  let first = null, last = null;
  for (const id of ids) {
    const t = tcg.get(id) || new Map();
    const p = ppt.get(id) || new Map();
    const dates = [...new Set([...t.keys(), ...p.keys()])].sort();
    const pts = dates.map((date) => t.has(date)
      ? { date, market: t.get(date), source: TCGCSV_SOURCE }
      : { date, market: p.get(date), source: PPT_SOURCE });
    if (!pts.length) continue;
    merged.set(id, pts);
    priceMap.set(id, new Map(pts.map((x) => [x.date, x.market])));
    if (!first || pts[0].date < first) first = pts[0].date;
    if (!last || pts.at(-1).date > last) last = pts.at(-1).date;
  }
  // A day-over-day move is only taken from ONE source: TCGCSV if it has both
  // days, else PPT if it has both days. A move is never computed across sources.
  function pairPrice(id, a, b) {
    const t = tcg.get(id);
    if (t?.has(a) && t.has(b)) return [t.get(a), t.get(b)];
    const p = ppt.get(id);
    if (p?.has(a) && p.has(b)) return [p.get(a), p.get(b)];
    return null;
  }
  return {
    ids: [...merged.keys()],
    merged,
    priceMap,
    pairPrice,
    coverage: { products: merged.size, tcgcsvProducts: tcg.size, pptProducts: ppt.size, first, last },
  };
}
