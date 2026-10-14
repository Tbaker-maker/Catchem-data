// Inputs for the Singles Index: own TCGCSV daily days, plus chart-only fill.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadFillMap } from "./fill-history.mjs";

export const MIN_PRICE = 1;

export async function singlesIndexInputs(root, { minPrice = MIN_PRICE } = {}) {
  const catalog = JSON.parse(await readFile(join(root, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const singlePids = new Set((catalog.items || []).filter((i) => i.kind === "single" && i.tcgplayerProductId).map((i) => Number(i.tcgplayerProductId)));
  const dir = join(root, "data/history/tcgcsv-daily");
  const files = (await readdir(dir)).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  const prices = new Map();
  const elig = new Map();
  const dates = [];
  for (const f of files) {
    const day = JSON.parse(await readFile(join(dir, f), "utf8"));
    const date = f.slice(0, 10);
    const set = new Set();
    for (const row of day.prices || []) {
      const pid = Number(row.id);
      const v = Number(row.market);
      if (!singlePids.has(pid) || !(v >= minPrice)) continue;
      const key = `${pid}#${row.printing || ""}`;
      if (!prices.has(key)) prices.set(key, new Map());
      prices.get(key).set(date, v);
      set.add(key);
    }
    if (set.size) { elig.set(date, set); dates.push(date); }
  }
  const members = [...prices.keys()];
  // Chart-only fill: singles only, dates before our first own day.
  const first = dates[0] || "9999-12-31";
  const fillMap = loadFillMap(root);
  const fillPrices = new Map();
  const fillElig = new Map();
  const fillKeys = new Set();
  for (const [pid, f] of fillMap) {
    if (!singlePids.has(pid)) continue;
    const m = new Map();
    for (const [d, v] of f.points || []) {
      if (!(d < first) || !(Number(v) >= minPrice)) continue;
      m.set(d, Number(v));
      if (!fillElig.has(d)) fillElig.set(d, new Set());
      fillElig.get(d).add(String(pid));
    }
    if (m.size) { fillPrices.set(String(pid), m); fillKeys.add(f.key); }
  }
  return { dates, prices, elig, members, fillDates: [...fillElig.keys()].sort(), fillPrices, fillElig, fillMembers: [...fillPrices.keys()], fillKeys: [...fillKeys] };
}
