// Sealed rows flagged browse:false in data/sealed-products.json (cases,
// displays of several products, sets of several, code cards, accessories,
// empty boxes) stay in the data files and history but are left out of the
// public browse, search, and reads. Joined by TCGplayer productId only.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function hiddenSealedPids(rows) {
  const out = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.browse !== false) continue;
    const pid = Number(row.tcgPlayerId);
    if (Number.isInteger(pid) && pid > 0) out.add(pid);
  }
  return out;
}

export function isBrowseHidden(item, pids) {
  return item?.kind === "sealed" && pids.has(Number(item.tcgplayerProductId));
}

// A hidden sealed product is not a public read. A Costco exclusive stays.
export function showsOnSite(item, pids, costcoIds) {
  if (!isBrowseHidden(item, pids)) return true;
  return Boolean(costcoIds && costcoIds.has(item?.id));
}

export async function siteGates(root) {
  let rows = [];
  let costco = [];
  try { rows = JSON.parse(await readFile(join(root, "data/sealed-products.json"), "utf8")); } catch { rows = []; }
  try { costco = JSON.parse(await readFile(join(root, "data/costco-exclusives.json"), "utf8")).products || []; } catch { costco = []; }
  return {
    pids: hiddenSealedPids(Array.isArray(rows) ? rows : []),
    costcoIds: new Set((Array.isArray(costco) ? costco : []).map((row) => row && row.id).filter(Boolean)),
  };
}
