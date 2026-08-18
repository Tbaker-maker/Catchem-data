// scripts/build-crosscheck-map.mjs — one-time (re-runnable) builder for
// data/crosscheck-id-map.json: maps our 70 sealed SKUs → PPT tcgPlayerIds
// with matchConfidence, for Tyler's review BEFORE the first crosscheck run.
//
// Run from Tyler's shell (key via Read-Host pattern; ~70 searches × up to 5
// credits ≈ 350 credits one-time on the 20k/day tier).
//
// Scoring (built against real shapes, 2026-08-18 probe):
//   high   — normalized name equality with our product name
//   medium — all our name words present, no multiplier tokens (case/display/
//            bundle-of/x2..), ≤2 extra tokens, and price-ratio sanity vs our
//            eBay median (0.4–2.0×) when we have one
//   low    — anything else, zero results, or failed price sanity
// pc-etb SKUs prefer candidates whose name mentions pokemon center /
// [Pokemon Center]; vintage SKUs skip price sanity (our current is null).
// Low-confidence rows are BLOCKED from fetching until reviewed:true is set
// during Tyler's review (fetch-sealed-crosscheck.mjs enforces this).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
if (!KEY) { console.error("Missing POKEMONPRICETRACKER_API_KEY"); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}` };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MULTIPLIER_TOKENS = ["case", "display", "lot", "x2", "x3", "x4", "x6", "2x", "3x", "4x", "6x", "bundle of", "set of", "pallet"];
const norm = s => (s || "").toLowerCase().replace(/\[[^\]]*\]/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

async function getJSON(url) {
  let lastErr;
  for (let a = 0; a <= 3; a++) {
    if (a > 0) await sleep([2000, 8000, 20000][a - 1]);
    try {
      const res = await fetch(url, { headers: H });
      if (res.ok) return res.json();
      lastErr = new Error(`${res.status}`);
      if (res.status < 500 && res.status !== 429) throw lastErr;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function score(product, candidate, ourMedian) {
  const cn = norm(candidate.name);
  const on = norm(product.name);
  const rawName = (candidate.name || "").toLowerCase();
  const isPc = product.subtype === "pc-etb";
  const mentionsPc = rawName.includes("pokemon center");
  if (isPc !== mentionsPc && !(isPc && cn === on)) {
    // pc-etb must mention pokemon center; non-pc must not
    if (isPc && !mentionsPc) return "low";
    if (!isPc && mentionsPc) return null; // wrong family entirely — skip
  }
  const hasMult = MULTIPLIER_TOKENS.some(t => cn.includes(t) && !on.includes(t));
  if (hasMult) return null; // variant product — skip as candidate
  const ratioOk = ourMedian == null || candidate.unopenedPrice == null
    ? null
    : candidate.unopenedPrice / ourMedian >= 0.4 && candidate.unopenedPrice / ourMedian <= 2.0;
  if (cn === on && ratioOk !== false) return "high";
  const ourWords = on.split(" ");
  const allWords = ourWords.every(w => cn.includes(w));
  const extraTokens = cn.split(" ").length - ourWords.length;
  if (allWords && extraTokens <= 2 && ratioOk !== false) return "medium";
  return "low";
}

async function main() {
  // Pathogen guard (2026-08-18): this builder REGENERATES the whole map,
  // destroying review states. Superseded by extend-crosscheck-map.mjs for
  // day-to-day use; wholesale rebuild now requires explicit intent.
  try {
    await readFile(join(DATA, "crosscheck-id-map.json"), "utf-8");
    if (process.env.FORCE_REBUILD !== "yes") {
      console.error("map exists — use extend-crosscheck-map.mjs (incremental), or FORCE_REBUILD=yes to regenerate and LOSE review states");
      process.exit(1);
    }
  } catch {}

  const productsFile = JSON.parse(await readFile(join(DATA, "sealed-products.json"), "utf-8"));
  let prices = { products: [] };
  try { prices = JSON.parse(await readFile(join(DATA, "sealed-prices.json"), "utf-8")); } catch {}
  const medianOf = id => prices.products?.find(p => p.id === id)?.priceMedian ?? null;

  const entries = [];
  for (const product of productsFile) {
    await sleep(1100);
    const q = product.subtype === "pc-etb"
      ? `${product.set} Elite Trainer Box`
      : product.name.replace(/ Unlimited /, " "); // PPT names vintage as "[Revised Unlimited Edition]" brackets
    let candidates = [];
    try {
      const d = await getJSON(`${BASE}/sealed-products?search=${encodeURIComponent(q)}&limit=5`);
      candidates = d.data || [];
    } catch (e) {
      entries.push({ id: product.id, ourName: product.name, tcgPlayerId: null, matchedName: null, unopenedPrice: null, matchConfidence: "low", note: `search failed: ${e.message}` });
      console.log(`  ${product.id.padEnd(26)} ERROR ${e.message}`);
      continue;
    }
    const ourMedian = medianOf(product.id);
    let best = null;
    for (const c of candidates) {
      const s = score(product, c, ourMedian);
      if (s === null) continue;
      const rank = { high: 3, medium: 2, low: 1 }[s];
      if (!best || rank > best.rank) best = { c, s, rank };
    }
    if (!best) {
      entries.push({ id: product.id, ourName: product.name, tcgPlayerId: null, matchedName: null, unopenedPrice: null, matchConfidence: "low", note: `no viable candidate among ${candidates.length} results` });
      console.log(`  ${product.id.padEnd(26)} NO MATCH (${candidates.length} results)`);
      continue;
    }
    entries.push({
      id: product.id, ourName: product.name,
      tcgPlayerId: best.c.tcgPlayerId, matchedName: best.c.name,
      unopenedPrice: best.c.unopenedPrice ?? null,
      providerUpdatedAt: best.c.updatedAt ?? null,
      matchConfidence: best.s,
      ...(ourMedian != null && best.c.unopenedPrice != null
        ? { eBayMedian: ourMedian, priceRatio: Math.round((best.c.unopenedPrice / ourMedian) * 100) / 100 } : {}),
    });
    console.log(`  ${product.id.padEnd(26)} ${best.s.toUpperCase().padEnd(6)} → ${best.c.name} ($${best.c.unopenedPrice ?? "—"})`);
  }

  const counts = { high: 0, medium: 0, low: 0 };
  for (const e of entries) counts[e.matchConfidence]++;
  await writeFile(join(DATA, "crosscheck-id-map.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "build-crosscheck-map.mjs vs pokemonpricetracker v2",
    reviewRule: "low-confidence rows are excluded from fetching until a human sets reviewed:true (or exclude:true to drop them). fetch-sealed-crosscheck.mjs enforces this.",
    counts, entries,
  }, null, 2) + "\n");
  console.log(`\n✓ data/crosscheck-id-map.json — high:${counts.high} medium:${counts.medium} low:${counts.low}`);
  console.log("STOP: review low/medium rows before the first crosscheck run.");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
