// verify-pocket-images.mjs — one checked picture per Pokémon TCG Pocket id.
//
// The Post Office showed every Pocket card without a picture: pocket-rows.json
// carried no image, and play.html asked for /pocket-img/<set>/<num>, a path
// nothing serves (404). This script checks the image URL the catalogue already
// holds for each id (data/pocket-catalogue.json, built by ingest-pocket.mjs),
// and, when that host has no file for the id, the Limitless CDN file for the
// same set code and collector number. Matched by id only, never by name.
// A URL counts only if it answers 200 with real JPEG/WebP bytes. Nothing is
// mirrored: the rows keep the host URL (hotlink, same as ingest-pocket.mjs).
//
// Writes data/pocket-images.json and column 14 of research/assets/pocket-rows.json.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const cat = JSON.parse(await readFile(join(ROOT, "data/pocket-catalogue.json"), "utf8"));
const ROWS = join(ROOT, "research/assets/pocket-rows.json");
const rows = JSON.parse(await readFile(ROWS, "utf8"));

export function isImage(buf) {
  const b = new Uint8Array(buf);
  if (b.length < 4000) return false;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return jpeg || webp;
}

export function candidates(id, card) {
  const m = /^tcgp-(.+)-(\d{3})$/.exec(id);
  const out = [];
  if (card && card.image) out.push(card.image);
  if (m) out.push("https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/pocket/" + m[1] + "/" + m[1] + "_" + m[2] + "_EN.webp");
  return [...new Set(out)];
}

async function check(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "CatchEm-pocket-images/1.0" }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) return false;
    return isImage(await r.arrayBuffer());
  } catch { return false; }
}

const images = {};
const missing = [];
const ids = Object.keys(cat.cards);
let next = 0;
async function worker() {
  while (next < ids.length) {
    const id = ids[next++];
    let hit = "";
    for (const url of candidates(id, cat.cards[id])) { if (await check(url)) { hit = url; break; } }
    if (hit) images[id] = hit; else missing.push(id);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));

const sorted = {};
for (const id of Object.keys(images).sort()) sorted[id] = images[id];
await writeFile(join(ROOT, "data/pocket-images.json"), JSON.stringify({
  note: "One verified picture URL per Pocket id (200 + real JPEG/WebP bytes). Matched by id. Hotlinked, not hosted.",
  checkedAt: new Date().toISOString(),
  count: Object.keys(sorted).length,
  missing: missing.sort(),
  images: sorted,
}, null, 0));

for (const r of rows) {
  while (r.length < 14) r.push(0);
  r[14] = sorted[r[0]] || 0;
}
await writeFile(ROWS, JSON.stringify(rows));
console.log("✓ pocket images: " + Object.keys(sorted).length + "/" + ids.length + " verified, " + missing.length + " missing");
