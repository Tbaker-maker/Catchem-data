// scripts/extend-crosscheck-map.mjs — INCREMENTAL id-map extension.
// Adds map rows for sealed SKUs not yet in data/crosscheck-id-map.json,
// PRESERVING every existing row's reviewed/exclude state (never regenerates).
// Same scoring + auto-approve criteria as build-crosscheck-map.mjs
// (campaign ruling 2026-08-18: HOLDs accumulate silently — this prints one
// consolidated HOLD list at the end instead of stopping per batch).
// Run from Tyler's shell (key via Read-Host; ~1 search per new SKU).
// Skips SKUs with activeMarketThin (no eBay median to sanity against and
// no crosscheck value while suspended) — listed as skipped, not HOLD.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Node's fetch has NO default timeout: a host that accepts the connection
// and never answers hangs this script until the CI runner kills the job.
// A hung job is worse than a failed one — nothing goes red, the whole
// allowance burns and no guard reports. Every call below is bounded.
const FETCH_TIMEOUT_MS = 20000;

const DATA = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
if (!KEY) { console.error("Missing POKEMONPRICETRACKER_API_KEY"); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}` };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MULT = /\bcase\b|\bdisplay\b|\blot\b|set of|x\d|\dx|pallet|bundle of|1 of each|mini tin/i;
const norm = s => (s || "").toLowerCase().replace(/\[[^\]]*\]/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

async function getJSON(url) {
  let lastErr;
  for (let a = 0; a <= 3; a++) {
    if (a > 0) await sleep([2000, 8000, 20000][a - 1]);
    try { const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: H }); if (res.ok) return res.json();
      lastErr = new Error(String(res.status)); if (res.status < 500 && res.status !== 429) throw lastErr;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const map = JSON.parse(await readFile(join(DATA, "crosscheck-id-map.json"), "utf-8"));
const products = JSON.parse(await readFile(join(DATA, "sealed-products.json"), "utf-8"));
const prices = JSON.parse(await readFile(join(DATA, "sealed-prices.json"), "utf-8"));
const medianOf = id => prices.products?.find(p => p.id === id)?.priceMedian ?? null;
const have = new Set(map.entries.map(e => e.id));

const holds = [], skipped = [];
let added = 0, approved = 0;
for (const product of products) {
  if (have.has(product.id)) continue;
  if (product.activeMarketThin) { skipped.push(product.id); continue; }
  await sleep(1100);
  const q = product.subtype === "pc-etb" ? `${product.set} Elite Trainer Box` : product.name;
  let candidates = [];
  try {
    const d = await getJSON(`${BASE}/sealed-products?search=${encodeURIComponent(q)}&limit=5`);
    candidates = d.data || [];
  } catch (e) {
    map.entries.push({ id: product.id, ourName: product.name, tcgPlayerId: null, matchedName: null,
      matchConfidence: "low", reviewed: false, holdReason: `search failed ${e.message}` });
    holds.push({ id: product.id, reason: `search failed ${e.message}` });
    added++; continue;
  }
  const ourMedian = medianOf(product.id);
  const on = norm(product.name);
  const ourWords = on.split(" ");
  let best = null;
  for (const c of candidates) {
    const raw = (c.name || "").toLowerCase();
    const cn = norm(c.name);
    if (MULT.test(raw)) continue;
    const isPc = product.subtype === "pc-etb";
    if (isPc !== raw.includes("pokemon center")) continue;
    if (c.unopenedPrice == null) continue;
    const exact = cn === on;
    const allWords = ourWords.every(w => cn.includes(w));
    const extra = cn.split(" ").length - ourWords.length;
    const confHigh = exact || (allWords && extra <= 1);
    const ratio = ourMedian != null ? c.unopenedPrice / ourMedian : null;
    const ratioOk = ratio == null ? false : ratio >= 0.6 && ratio <= 1.6;
    const rank = (confHigh ? 2 : 0) + (ratioOk ? 1 : 0);
    if (!best || rank > best.rank || (rank === best.rank && ratio != null && Math.abs(ratio - 1) < Math.abs((best.ratio ?? 9) - 1)))
      best = { c, rank, confHigh, ratioOk, ratio };
  }
  if (!best) {
    map.entries.push({ id: product.id, ourName: product.name, tcgPlayerId: null, matchedName: null,
      matchConfidence: "low", reviewed: false, holdReason: `no viable candidate among ${candidates.length}` });
    holds.push({ id: product.id, reason: `no viable candidate (${candidates.length} results)` });
    added++; continue;
  }
  const entry = {
    id: product.id, ourName: product.name,
    tcgPlayerId: best.c.tcgPlayerId, matchedName: best.c.name,
    unopenedPrice: best.c.unopenedPrice ?? null, providerUpdatedAt: best.c.updatedAt ?? null,
    matchConfidence: best.confHigh ? "high" : "medium",
    ...(best.ratio != null ? { eBayMedian: medianOf(product.id), priceRatio: Math.round(best.ratio * 100) / 100 } : {}),
  };
  if (best.confHigh && best.ratioOk) {
    entry.reviewed = true;
    entry.autoApproved = "extension pass (campaign 2026-08-18): high conf + ratio 0.6-1.6 + clean name";
    approved++;
  } else {
    entry.reviewed = false;
    entry.exclude = entry.matchConfidence !== "low"; // block non-low HOLDs from the fetch gate
    entry.holdReason = !best.confHigh ? "name confidence below high" : `ratio ${entry.priceRatio ?? "n/a"} outside 0.6-1.6`;
    holds.push({ id: product.id, reason: entry.holdReason, theirs: best.c.name, ratio: entry.priceRatio ?? null });
  }
  map.entries.push(entry);
  added++;
  console.log(`  ${product.id.padEnd(26)} ${entry.reviewed ? "AUTO" : "HOLD"} → ${best.c.name} ($${best.c.unopenedPrice ?? "—"}${entry.priceRatio ? ", r" + entry.priceRatio : ""})`);
}

map.classification = { ...(map.classification || {}),
  extendedAt: new Date().toISOString(),
  approved: map.entries.filter(e => e.reviewed === true).length,
  excluded: map.entries.filter(e => e.exclude === true).length,
};
await writeFile(join(DATA, "crosscheck-id-map.json"), JSON.stringify(map, null, 2) + "\n");
console.log(`\n✓ map extended: +${added} rows (${approved} auto-approved). Skipped activeMarketThin: ${skipped.length}.`);
console.log("\n══ CONSOLIDATED HOLD LIST ══");
for (const h of holds) console.log(`  ${h.id.padEnd(26)} ${h.reason}${h.theirs ? " → " + h.theirs : ""}`);
if (!holds.length) console.log("  (none)");
