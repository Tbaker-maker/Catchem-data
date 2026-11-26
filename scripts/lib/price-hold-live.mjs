// price-hold.json keeps two kinds of ids. "vintage" ids come from the vintage
// sample. "unverified" ids come from rating rows flagged check. The nightly
// bundle keeps the unverified ids in line with tonight's rating files, so a
// card the rating no longer flags gets its price back on the set page.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export async function loadCheckIds(ratingDir) {
  const ids = new Set();
  let files = 0;
  let names = [];
  try { names = await readdir(ratingDir); } catch { return null; }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    let doc;
    try { doc = JSON.parse(await readFile(join(ratingDir, name), "utf8")); } catch { return null; }
    files += 1;
    for (const row of doc?.rows || []) if (row && row.check && row.id) ids.add(row.id);
  }
  return files ? ids : null;
}

// checkIds null means the rating files could not be read. Nothing is released then.
// canRelease(id) must say yes too. The bundle allows only singles from a set
// with a known modern release date, so a vintage card keeps its vintage check.
export function liveHoldDoc(holdDoc, checkIds, canRelease = () => false) {
  const ids = { ...(holdDoc?.ids || {}) };
  const released = [];
  if (checkIds instanceof Set) {
    for (const [id, reason] of Object.entries(ids)) {
      if (reason === "unverified" && !checkIds.has(id) && canRelease(id)) {
        delete ids[id];
        released.push(id);
      }
    }
  }
  return { doc: { ...(holdDoc || {}), ids }, released };
}
