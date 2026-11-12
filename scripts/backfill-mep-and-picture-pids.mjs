// backfill-mep-and-picture-pids.mjs
//
// Why: card-catalogue.json only has 16 Mega Evolution Black Star Promo cards
// (8 numbers plus their Pokemon Center pairs) out of TCGCSV group 24451
// (ME: Mega Evolution Promo, 151 products). Those 16 came in with no
// tcgPlayerId. The same pass also writes a tcgPlayerId onto older catalogue
// ids that still have no card-images.json entry, when TCGCSV has exactly one
// matching product (same group, same collector number, same printing class).
// catalogue-set-codes.json is missing me6 (Delta Reign), so the tcgcsv map
// could not join that group; this adds the official set row (id me6, name
// Delta Reign, ptcgoCode DLR) from PokemonTCG/pokemon-tcg-data sets/en.json.
//
// Rules: no existing row is removed. An existing row is only given a
// tcgPlayerId when that field is empty and the match is unique. Staff,
// Winner, Worlds, Ace Trainer, Asia Championship, Prerelease, and Pitch
// Black Stamped printings are not added as new catalogue ids (no suffix
// convention exists for them). A Pokemon Center Exclusive is mep-{n}-pc.
// A unique plain / Cosmos Holo / 30th Celebration product is mep-{n}.
// Names are not a match key for the tcgPlayerId fill except to tell PC
// from plain and to drop the stamp classes above. No prices. No images
// are copied; the site serves the TCGplayer photo for these ids the same
// way it does for me2pt5 to me6.
//
// Usage: node scripts/backfill-mep-and-picture-pids.mjs [--dry]
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TCGCSV = "https://tcgcsv.com/tcgplayer/3";
const SETS_SRC = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json";
const DRY = process.argv.includes("--dry");
const METHOD = "tcgcsv-group-number-printing";
// Groups checked by hand: MEP, SVP, McDonald's 2017.
const GROUPS = { mep: 24451, svp: 22872, mcd17: 2148 };
const SET_NAME = { mep: "Mega Evolution Black Star Promos" };

const getJson = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": "Catchem-data catalogue backfill" }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ext = (p, n) => (p.extendedData || []).find((e) => e.name === n)?.value;
const normNum = (raw) => {
  if (raw == null) return "";
  const left = String(raw).trim().split("/")[0].trim();
  const m = left.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
  if (!m) return "";
  return m[1].toUpperCase() + String(parseInt(m[2], 10)) + m[3].toLowerCase();
};
const notesOf = (name) => [...String(name || "").matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)]
  .map((m) => m[1] || m[2] || "").join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const isPc = (name) => /pokemon center/.test(notesOf(name));
const isDroppedStamp = (name) => {
  const n = notesOf(name);
  if (/pokemon center/.test(n)) return false;
  return /\bstaff\b|\bwinner\b|world championships|ace trainer|asia championship|prerelease|\bstamped\b/.test(n)
    || /\bstaff\b/.test(String(name || "").toLowerCase());
};
const cardName = (name) => String(name || "")
  .replace(/\s+-\s+\d+\s*$/, "")
  .replace(/\s+-\s+\d+(?=\s*[\(\[])/, "")
  .replace(/\s*\(([^)]*)\)/g, "")
  .replace(/\s*\[[^\]]*\]/g, "")
  .replace(/\s+/g, " ")
  .trim();
const printingOf = (name) => {
  if (isPc(name)) return "pc";
  const n = notesOf(name);
  if (/cosmos holo/.test(n)) return "cosmos";
  if (/30th celebration/.test(n)) return "plain";
  if (n && isDroppedStamp(name)) return "stamp";
  return "plain";
};
const supertypeOf = (p) => {
  if (ext(p, "HP") || ext(p, "Stage")) return "Pokémon";
  const t = String(ext(p, "Card Type") || ext(p, "CardType") || "");
  if (/trainer|supporter|item|stadium|tool/i.test(t)) return "Trainer";
  if (/energy/i.test(t)) return "Energy";
  return null;
};

const catPath = join(ROOT, "data/card-catalogue.json");
const codesPath = join(ROOT, "data/catalogue-set-codes.json");
const cat = JSON.parse(await readFile(catPath, "utf8"));
const codes = JSON.parse(await readFile(codesPath, "utf8"));
const official = await getJson(SETS_SRC);
const today = new Date().toISOString();

// me6 is in the official set list and in the catalogue, but not in set-codes.
if (!codes.sets.some((s) => s.id === "me6")) {
  const me6 = official.find((s) => s.id === "me6");
  if (!me6) throw new Error("official sets/en.json has no me6");
  codes.sets.push({ id: me6.id, name: me6.name, ptcgoCode: me6.ptcgoCode ?? "DLR" });
  console.log(`set-codes: added me6 ${me6.name} ptcgoCode ${me6.ptcgoCode ?? "DLR"}`);
}

const productsBySet = {};
for (const [setId, groupId] of Object.entries(GROUPS)) {
  const payload = await getJson(`${TCGCSV}/${groupId}/products`);
  productsBySet[setId] = payload.results || [];
  await sleep(500);
  console.log(`${setId} group ${groupId}: ${productsBySet[setId].length} products`);
}

const bucket = (prods) => {
  const by = new Map();
  for (const p of prods) {
    const n = normNum(ext(p, "Number"));
    if (!n) continue;
    if (!by.has(n)) by.set(n, []);
    by.get(n).push(p);
  }
  return by;
};

const uniquePid = (prods, number, wantPc) => {
  const cand = prods.get(number) || [];
  const hits = cand.filter((p) => isPc(p.name) === wantPc && !isDroppedStamp(p.name));
  if (hits.length === 1) return hits[0];
  return null;
};

// 1. Fill tcgPlayerId on existing rows that have none (mep 16, svp gaps, mcd17).
let linked = 0;
const linkReport = [];
for (const [id, c] of Object.entries(cat.cards)) {
  if (c.tcgPlayerId) continue;
  const prods = productsBySet[c.setId];
  if (!prods) continue;
  const n = normNum(c.number);
  if (!n) continue;
  const hit = uniquePid(bucket(prods), n, /-pc$/i.test(id));
  if (!hit) continue;
  c.tcgPlayerId = String(hit.productId);
  c.tcgPlayerIdMethod = METHOD;
  linked++;
  linkReport.push(`${id} -> ${hit.productId} ${hit.name}`);
}

// 2. Add missing mep plain + pc rows from group 24451.
const mepProds = productsBySet.mep;
const mepBy = bucket(mepProds);
const skipped = [];
let added = 0;
for (const [number, list] of [...mepBy.entries()].sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }))) {
  const plainHits = list.filter((p) => !isPc(p.name) && !isDroppedStamp(p.name));
  const pcHits = list.filter((p) => isPc(p.name) && !isDroppedStamp(p.name));
  const addRow = (pidRow, suffix) => {
    const id = suffix ? `mep-${number}-${suffix}` : `mep-${number}`;
    if (cat.cards[id]) return;
    const name = cardName(pidRow.name);
    if (!name) { skipped.push(`${id} empty name from ${pidRow.name}`); return; }
    const row = {
      name,
      setId: "mep",
      setName: SET_NAME.mep,
      number,
      rarity: ext(pidRow, "Rarity") || "Promo",
      tcgPlayerId: String(pidRow.productId),
      tcgPlayerIdMethod: METHOD,
    };
    const st = supertypeOf(pidRow);
    if (st) row.supertype = st;
    cat.cards[id] = row;
    added++;
  };
  if (plainHits.length === 1) addRow(plainHits[0], "");
  else if (plainHits.length > 1) skipped.push(`mep-${number} ${plainHits.length} plain products: ${plainHits.map((p) => p.name).join(" | ")}`);
  else {
    const dropped = list.filter((p) => !isPc(p.name));
    if (dropped.length) skipped.push(`mep-${number} no plain row (${dropped.map((p) => p.name).join(" | ")})`);
  }
  if (pcHits.length === 1) addRow(pcHits[0], "pc");
  else if (pcHits.length > 1) skipped.push(`mep-${number} ${pcHits.length} PC products`);
}

const mepCount = Object.values(cat.cards).filter((c) => c.setId === "mep").length;
const mepNums = new Set(Object.values(cat.cards).filter((c) => c.setId === "mep").map((c) => String(c.number)));
cat.sets.mep = {
  cardsIngested: mepCount,
  expected: mepBy.size,
  complete: false,
  at: today,
  source: `${TCGCSV}/24451/products`,
  note: "TCGCSV group 24451 (ME: Mega Evolution Promo). Staff, Winner, Worlds, Ace Trainer, Asia Championship, Prerelease, and Pitch Black Stamped printings are not catalogue rows.",
};
cat.coverage = {
  ...cat.coverage,
  cards: Object.keys(cat.cards).length,
  cardsWithArtist: Object.values(cat.cards).filter((c) => c.artist).length,
  setsComplete: Object.values(cat.sets).filter((s) => s.complete).length,
};
cat.mepBackfill = {
  at: today,
  source: `${TCGCSV}/24451/products`,
  added,
  linkedExisting: linkReport.filter((l) => l.startsWith("mep-")).length,
  cardsInSet: mepCount,
  distinctNumbers: mepNums.size,
  tcgcsvProducts: mepProds.length,
  tcgcsvNumbers: mepBy.size,
};

console.log(`linked ${linked} existing tcgPlayerId rows`);
console.log(`added ${added} mep cards, set now ${mepCount} cards / ${mepNums.size} numbers (TCGCSV ${mepBy.size} numbers, ${mepProds.length} products)`);
if (skipped.length) {
  console.log("skipped:");
  for (const line of skipped) console.log("  " + line);
}

if (!DRY) {
  await writeFile(catPath, JSON.stringify(cat));
  await writeFile(codesPath, JSON.stringify(codes, null, 2) + "\n");
}
