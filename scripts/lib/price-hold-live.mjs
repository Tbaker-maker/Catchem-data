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

// Singles from a set with a valid release date that is not vintage. Same rule
// the bundle uses, read from the public set pages it wrote.
export function modernSingleIds(setDocs, isVintage) {
  const ids = new Set();
  for (const doc of setDocs || []) {
    const rel = String(doc?.release || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rel) || isVintage(rel)) continue;
    for (const it of doc.items || []) if (it && it.kind === "single" && it.id) ids.add(it.id);
  }
  return ids;
}

// The nightly builds set pages before the card rating, so the bundle releases
// holds against last night's rating. After tonight's rating is written, this
// applies the same release with tonight's flags and rewrites price-hold.json.
// It returns the released ids; the workflow rebuilds the set pages when any are.
// A missing or unreadable file releases nothing.
export async function releaseAfterRating(pubDir, isVintage) {
  const { writeFile } = await import("node:fs/promises");
  const holdPath = join(pubDir, "price-hold.json");
  let holdDoc;
  try { holdDoc = JSON.parse(await readFile(holdPath, "utf8")); } catch { return []; }
  let index;
  try { index = JSON.parse(await readFile(join(pubDir, "sets.json"), "utf8")); } catch { return []; }
  const docs = [];
  for (const row of index?.sets || []) {
    if (!row || !row.slug) continue;
    try { docs.push(JSON.parse(await readFile(join(pubDir, "sets", `${row.slug}.json`), "utf8"))); } catch { return []; }
  }
  const modern = modernSingleIds(docs, isVintage);
  const live = liveHoldDoc(holdDoc, await loadCheckIds(join(pubDir, "feed/rating")), (id) => modern.has(id));
  if (live.released.length) await writeFile(holdPath, JSON.stringify(live.doc));
  return live.released;
}
