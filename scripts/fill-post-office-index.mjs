// fill-post-office-index.mjs: give research/assets/cards/full/index.json a picture
// path and a row for every catalogue card the Post Office can now show.
//
// 1. A row with an empty src gets "/img/<setId>/<number>" when its catalogue card
//    has a TCGplayer product id. The site's /data/editor/tcg route serves that id's
//    TCGplayer photo when images.pokemontcg.io has no file (catchem-site
//    src/editor-tcg-pids.mjs). The row's "The picture is missing." fact goes.
// 2. A catalogue set with no Post Office rows at all gets one row per card, built
//    the way the existing rows are: species is the name without "Mega " and
//    without the suffix, rank is the rank the index already uses for that rarity.
// No row is removed and no filled src is changed. Usage: node scripts/fill-post-office-index.mjs [--dry]
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IDX = join(ROOT, "research/assets/cards/full/index.json");
const rows = JSON.parse(await readFile(IDX, "utf8"));
const cards = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf8")).cards;
const hasPid = (c) => c && /^\d+$/.test(String(c.tcgPlayerId || ""));
const numOf = (id, setId) => id.slice(setId.length + 1);

let filled = 0;
for (const r of rows) {
  if (r.src) continue;
  const c = cards[r.id];
  if (!hasPid(c)) continue;
  r.src = `/img/${r.setId}/${numOf(r.id, r.setId)}`;
  if (r.fact === "The picture is missing.") delete r.fact;
  filled++;
}

const rankCount = {};
for (const r of rows) {
  if (!r.rarity || typeof r.rank !== "number" || r.rank <= 0) continue;
  const m = (rankCount[r.rarity] ||= {});
  m[r.rank] = (m[r.rank] || 0) + 1;
}
const rankOf = (rarity) => {
  const m = rankCount[rarity];
  if (!m) return 0;
  return Number(Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]);
};
const species = (name) => String(name).replace(/^Mega /, "").split(" ")[0];
const inIndex = new Set(rows.map((r) => r.setId));
const order = (a, b) => String(a[1].number).localeCompare(String(b[1].number), "en", { numeric: true });
const bySet = {};
for (const [id, c] of Object.entries(cards)) if (!inIndex.has(c.setId)) (bySet[c.setId] ||= []).push([id, c]);
let added = 0;
for (const [setId, list] of Object.entries(bySet)) {
  for (const [id, c] of list.sort(order)) {
    const num = numOf(id, setId);
    const pic = hasPid(c);
    const row = { id, name: c.name, species: species(c.name), set: c.setName, setId,
      year: String(c.releaseDate || "").slice(0, 4), artist: c.artist ?? "", lock: num,
      rarity: c.rarity ?? "", rank: rankOf(c.rarity), src: pic ? `/img/${setId}/${num}` : "",
      tags: /^Mega /.test(c.name) ? "mega" : "" };
    if (!pic) row.fact = "The picture is missing.";
    rows.push(row);
    added++;
  }
  console.log(`${setId}: +${list.length} rows`);
}
console.log(`filled ${filled} empty src, added ${added} rows`);
if (!process.argv.includes("--dry")) await writeFile(IDX, JSON.stringify(rows));
