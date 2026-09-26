// ONE-OFF import of the 2026-09-25 history backfill into labelled per-product files.
//   Sealed:  PokemonPriceTracker raw responses (artifact of PPT backfill run
//            36206031966) -> data/history/ppt-sealed/<id>.json
//   Singles: novaoc/rarebox-price-history (TCGplayer market via the TCGCSV
//            archive, change-only) -> data/history/singles-rarebox/<cardId>.json
// Rules: nothing in data/history/tcgplayer-market/ (TCGCSV) is touched. Where
// both sources have a day, readers use the TCGCSV point (scripts/lib/market-history.mjs);
// the PPT point stays in its own folder so a day's move can be taken within PPT.
// No gap is filled; nothing is interpolated.
// Usage: PPT_RAW_DIR=ppt-history-raw node scripts/import-history-backfill.mjs
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PPT_SOURCE } from "./lib/market-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = process.env.PPT_RAW_DIR || "ppt-history-raw";
const RAREBOX_DIR = process.env.RAREBOX_DIR || null; // local copy, else fetched live
const RAREBOX_URL = "https://raw.githubusercontent.com/novaoc/rarebox-price-history/main/data/pokemon";
const SINGLES_SOURCE = "TCGplayer market via TCGCSV archive (rarebox-price-history)";
const J = async (p) => JSON.parse(await readFile(p, "utf8"));
const DAY = 86400000;
const iso = (d) => new Date(d * DAY).toISOString().slice(0, 10);

// ── sealed ──────────────────────────────────────────────────────────────────────
const products = await J(join(ROOT, "data/sealed-products.json"));
const names = new Map(products.map((p) => [p.id, p.name]));
try {
  for (const pl of (await J(join(ROOT, "trending.json"))).plays || []) if (pl.sku && !names.has(pl.sku)) names.set(pl.sku, pl.name);
} catch {}
const sealedOut = join(ROOT, "data/history/ppt-sealed");
await mkdir(sealedOut, { recursive: true });
let sealedFiles = 0, sealedPoints = 0, skippedTcgcsv = 0;
const noHistory = [];
for (const f of (await readdir(RAW)).filter((n) => n.endsWith(".json") && !n.startsWith("_")).sort()) {
  const raw = await J(join(RAW, f));
  const pid = String(raw.request.tcgPlayerId);
  const hit = (raw.response?.data || []).find((d) => String(d.tcgPlayerId) === pid);
  for (const id of raw.request.keys) {
    if (!names.has(id)) continue;
    if (!hit || !(hit.priceHistory || []).length) { noHistory.push({ id, tcgplayerProductId: Number(pid), reason: hit ? "PPT returned no price history" : "PPT returned no product for this id" }); continue; }
    let tcgcsvDates = new Set();
    try {
      const t = await J(join(ROOT, "data/history/tcgplayer-market", `${id}.json`));
      tcgcsvDates = new Set((t.points || []).map((p) => p.date));
    } catch {}
    const points = [];
    for (const h of hit.priceHistory) {
      const date = String(h.date).slice(0, 10);
      if (!(h.unopenedPrice > 0)) continue;
      if (tcgcsvDates.has(date)) skippedTcgcsv++; // kept here, but on read the TCGCSV point for that day wins
      points.push({ date, market: h.unopenedPrice });
    }
    points.sort((a, b) => (a.date < b.date ? -1 : 1));
    const dedup = points.filter((p, i) => i === 0 || p.date !== points[i - 1].date);
    const gaps = [];
    for (let i = 1; i < dedup.length; i++) {
      const span = Math.round((Date.parse(dedup[i].date) - Date.parse(dedup[i - 1].date)) / DAY);
      if (span > 1) gaps.push({ from: dedup[i - 1].date, to: dedup[i].date, missingDays: span - 1, reason: "PPT has no price for these days. Not filled in." });
    }
    await writeFile(join(sealedOut, `${id}.json`), JSON.stringify({
      id,
      name: names.get(id),
      tcgplayerProductId: Number(pid),
      providerName: hit.name,
      source: PPT_SOURCE,
      field: "market = PPT unopenedPrice for that day (TCGplayer market price). PPT sealed history has no low, high or sales counts.",
      fetched: { at: "2026-09-26T00:50:34Z", run: "Catchem-data Actions run 36206031966 (ppt-history-backfill.yml)", request: "GET /api/v2/sealed-products?tcgPlayerId=<id>&limit=1&includeHistory=true&days=180", window: raw.response?.metadata?.historyWindow || null },
      note: "Every point in this file is from the source above. On a day that data/history/tcgplayer-market/ (TCGCSV) also has, readers use the TCGCSV point. Missing days are not filled in.",
      points: dedup,
      gaps,
    }) .replace(/\},\{"date"/g, '},\n{"date"') + "\n");
    sealedFiles++; sealedPoints += dedup.length;
  }
}
await writeFile(join(sealedOut, "manifest.json"), JSON.stringify({
  source: PPT_SOURCE, files: sealedFiles, points: sealedPoints, daysAlsoOnFileFromTcgcsv_tcgcsvWinsOnRead: skippedTcgcsv, noHistory,
}, null, 2) + "\n");
console.log(`sealed: ${sealedFiles} files, ${sealedPoints} points, ${skippedTcgcsv} days also on file from TCGCSV (TCGCSV wins on read), ${noHistory.length} without history`);

// ── singles ─────────────────────────────────────────────────────────────────────
function normNumber(num) { // rarebox common.norm_number
  let n = String(num || "").split("/")[0].trim().toLowerCase();
  n = n.replace(/^0+(?=[a-z0-9])/, "");
  const m = n.match(/^([a-z]+)0*(\d.*)$/);
  return m ? m[1] + m[2] : n;
}
// singles-prices.json rows that errored on 2026-09-21 carry only a label.
const LABEL_SETS = { "Darkness Ablaze": "swsh3", "Brilliant Stars Trainer Gallery": "swsh9tg", "Astral Radiance Trainer Gallery": "swsh10tg", "Paldea Evolved": "sv2", "Journey Together": "sv9", "White Flare": "rsv10pt5", "Pokémon Futsal Collection": "fut20" };
const singles = await J(join(ROOT, "data/singles-prices.json"));
const singlesOut = join(ROOT, "data/history/singles-rarebox");
await mkdir(singlesOut, { recursive: true });
const sets = new Map();
async function setFile(setId) {
  if (sets.has(setId)) return sets.get(setId);
  let doc = null;
  try {
    if (RAREBOX_DIR) doc = await J(join(RAREBOX_DIR, `${setId}.json`));
    else {
      const res = await fetch(`${RAREBOX_URL}/${setId}.json`, { signal: AbortSignal.timeout(20000) });
      if (res.ok) doc = await res.json();
    }
  } catch { doc = null; }
  sets.set(setId, doc);
  return doc;
}
const seen = new Set();
const missing = [];
let singleFiles = 0;
for (const c of singles.cards || []) {
  let setId = c.setId, number = c.number, name = c.name, how = "data/singles-prices.json";
  if (!setId) {
    const m = String(c.watchLabel || "").match(/^(?:AUTO-\w+: )?(.+?) #(\S+) \((.+)\)$/);
    if (!m || !LABEL_SETS[m[3]]) { missing.push({ watchLabel: c.watchLabel, reason: "no set id or number on file" }); continue; }
    [name, number, setId] = [m[1], m[2], LABEL_SETS[m[3]]];
    how = "parsed from watchLabel (row errored in singles-prices.json)";
  }
  const cardId = `${setId}-${number}`;
  if (seen.has(cardId)) continue;
  seen.add(cardId);
  const doc = await setFile(setId);
  if (!doc) { missing.push({ cardId, watchLabel: c.watchLabel, reason: `rarebox has no data/pokemon/${setId}.json` }); continue; }
  const card = doc.cards?.[normNumber(number)];
  if (!card) { missing.push({ cardId, watchLabel: c.watchLabel, reason: `card ${normNumber(number)} not in rarebox ${setId}.json` }); continue; }
  const want = c.priceVariant;
  const variants = want && card[want] ? [want] : Object.keys(card);
  await writeFile(join(singlesOut, `${cardId}.json`), JSON.stringify({
    id: cardId,
    name,
    watchLabel: c.watchLabel,
    setId, number,
    mapping: how,
    source: SINGLES_SOURCE,
    sourceRepo: "https://github.com/novaoc/rarebox-price-history",
    note: "Change-only: a point is stored only when the price changed (with a 7-day heartbeat). Weekly steps from 2024-02-08, daily for about the last 90 days, ending 2026-09-15 when the TCGCSV archive went offline. Days between points are not filled in. Prices (c) TCGplayer.",
    variants: variants.map((v) => ({
      variant: v,
      selection: want && card[want] ? "matches singles-prices priceVariant" : "no usable priceVariant on file; every rarebox variant kept",
      points: card[v].map(([d, usd]) => ({ date: iso(d), market: usd })),
    })),
  }).replace(/\},\{"date"/g, '},\n{"date"') + "\n");
  singleFiles++;
}
await writeFile(join(singlesOut, "manifest.json"), JSON.stringify({
  source: SINGLES_SOURCE, epoch: "day numbers are days since 1970-01-01 UTC; checked: swsh7 #215 holofoil = 2302.74 on 2026-09-15",
  files: singleFiles, missing,
}, null, 2) + "\n");
console.log(`singles: ${singleFiles} files, ${missing.length} missing`);
