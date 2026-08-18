// scripts/compute-heat-states.mjs
// Catch'em heat-state engine — assigns Wyckoff states to sealed SKUs.
// Reads data/sealed-prices.json → writes data/heat-report.json and appends
// today's snapshot to data/heat-history.json (builds supply history forward).
//
// TRUST STANDARD compliance:
//  - States are READS (interpretation), labeled with mode + confidence.
//  - Supply WoW needs 7+ days of accumulated snapshots; until then the
//    engine runs "price-only" mode and says so.
//  - SKUs with dataStatus != "live" are excluded from reads, listed separately.
//  - KNOWN_CONTAMINATED SKUs stay excluded until FIX_DEPLOY_DATE is set and
//    7 clean days accumulate. Honest gap > confident wrong answer.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");

// ── Config ───────────────────────────────────────────────────────────────────
const FIX_DEPLOY_DATE = "2026-08-18"; // filtered fetch shipped f80d876; first clean daily run 2026-08-18 04:50 UTC
const KNOWN_CONTAMINATED = ["sv9-booster-box", "sv9-etb", "swsh7-booster-box"]; // pre-fix poisoned history (swsh7: published $144 vs real ~$2900)
const PRICE_UP_STRONG = 0.06;   // +6% WoW
const PRICE_DOWN_STRONG = -0.06;
const SUPPLY_DOWN = -0.12;      // -12% listings WoW
const SUPPLY_UP = 0.12;
const MIN_HISTORY_DAYS = 8;     // need 8 price points for a WoW read
const IMPLAUSIBLE_DELTA = 0.40; // |WoW| beyond ±40% = data-quality problem, not a market move

const pct = (now, then) => (then > 0 ? (now - then) / then : null);
const round = n => (n == null ? null : Math.round(n * 1000) / 1000);

function priceWoW(history, cutoff) {
  const usable = cutoff ? history.filter(h => h.date >= cutoff) : history;
  if (usable.length < MIN_HISTORY_DAYS) return { wow: null, days: usable.length };
  const now = usable[usable.length - 1].price;
  const then = usable[usable.length - 8].price; // 7 days back
  return { wow: pct(now, then), days: usable.length };
}

function supplyWoW(snapshots, id) {
  const rows = snapshots.filter(s => s.id === id).sort((a, b) => a.date < b.date ? -1 : 1);
  if (rows.length < 8) return { wow: null, days: rows.length };
  const now = rows[rows.length - 1].listingCount;
  const then = rows[rows.length - 8].listingCount;
  return { wow: pct(now, then), days: rows.length };
}

function assignState(pWow, sWow) {
  // Dual-signal (preferred)
  if (pWow != null && sWow != null) {
    if (pWow >= PRICE_UP_STRONG && sWow <= SUPPLY_DOWN)
      return { state: "markup", emoji: "🔥", read: "Markup phase. Money in, supply shrinking — possible breakout.", confidence: "dual-signal" };
    if (pWow <= PRICE_DOWN_STRONG && sWow >= SUPPLY_UP)
      return { state: "markdown", emoji: "❄️", read: "Markdown phase. Sellers outpacing buyers.", confidence: "dual-signal" };
    if (Math.abs(pWow) < PRICE_UP_STRONG && sWow <= SUPPLY_DOWN)
      return { state: "accumulation", emoji: "😴", read: "Accumulation phase. Quiet tape, supply drifting down — deep hold.", confidence: "dual-signal" };
    return { state: "distribution", emoji: "📈", read: "Distribution phase. Money and supply both flowing — healthy tape.", confidence: "dual-signal" };
  }
  // Price-only fallback (supply history still accumulating)
  if (pWow == null) return null;
  if (pWow >= PRICE_UP_STRONG)
    return { state: "markup", emoji: "🔥", read: "Price momentum up. Possible markup — supply signal pending.", confidence: "price-only" };
  if (pWow <= PRICE_DOWN_STRONG)
    return { state: "markdown", emoji: "❄️", read: "Price momentum down. Possible markdown — supply signal pending.", confidence: "price-only" };
  return { state: "distribution", emoji: "📈", read: "Price stable. Healthy tape — supply signal pending.", confidence: "price-only" };
}

async function main() {
  const prices = JSON.parse(await readFile(join(DATA, "sealed-prices.json"), "utf-8"));
  let snapshots = [];
  try { snapshots = JSON.parse(await readFile(join(DATA, "heat-history.json"), "utf-8")); } catch {}

  const today = new Date().toISOString().split("T")[0];

  // Append today's snapshot (idempotent per day)
  snapshots = snapshots.filter(s => s.date !== today);
  for (const p of prices.products || []) {
    if (p.dataStatus === "live") {
      snapshots.push({ date: today, id: p.id, price: p.priceMedian, listingCount: p.listingCount });
    }
  }
  // Keep 120 days
  const cutoffDate = new Date(Date.now() - 120 * 86400000).toISOString().split("T")[0];
  snapshots = snapshots.filter(s => s.date >= cutoffDate);

  const reads = [], excluded = [];
  for (const p of prices.products || []) {
    const base = { id: p.id, name: p.name, set: p.set, subtype: p.subtype,
                   priceMedian: p.priceMedian, listingCount: p.listingCount };
    if (KNOWN_CONTAMINATED.includes(p.id) && !FIX_DEPLOY_DATE) {
      excluded.push({ ...base, reason: "contaminated-history — excluded until fix deploys + 7 clean days" }); continue;
    }
    if (p.dataStatus !== "live") {
      excluded.push({ ...base, reason: `dataStatus: ${p.dataStatus}` }); continue;
    }
    // The fix changed fetch methodology for EVERY SKU (relevance ordering,
    // title filtering, per-subtype bounds) — pre-fix medians measure a
    // different thing. WoW reads restart from the fix date for all SKUs, or a
    // methodology shift would masquerade as a market move.
    const cutoff = FIX_DEPLOY_DATE;
    const pW = priceWoW(p.priceHistory || [], cutoff);
    const sW = supplyWoW(snapshots, p.id);
    if (pW.wow != null && Math.abs(pW.wow) > IMPLAUSIBLE_DELTA) {
      excluded.push({ ...base, reason: `implausible WoW ${(pW.wow*100).toFixed(0)}% — likely query contamination, needs data-quality review` }); continue;
    }
    const st = assignState(pW.wow, sW.wow);
    if (!st) { excluded.push({ ...base, reason: `insufficient history (${pW.days} days)` }); continue; }
    reads.push({ ...base, ...st, priceWoW: round(pW.wow), supplyWoW: round(sW.wow) });
  }

  const order = { markup: 0, markdown: 1, accumulation: 2, distribution: 3 };
  reads.sort((a, b) => order[a.state] - order[b.state] || Math.abs(b.priceWoW ?? 0) - Math.abs(a.priceWoW ?? 0));

  const supplyDays = new Set(snapshots.map(s => s.date)).size;
  const report = {
    generatedAt: new Date().toISOString(),
    method: "Wyckoff-state reads from Catchem-data bot (eBay active listings). States are interpretations, not facts. Demand = Buy Pressure (est. from listing activity, not reported sales). Active Listings measured.",
    mode: supplyDays >= 8 ? "dual-signal" : `price-only (supply history: day ${supplyDays} of 8 needed)`,
    counts: { markup: reads.filter(r=>r.state==="markup").length, markdown: reads.filter(r=>r.state==="markdown").length,
              accumulation: reads.filter(r=>r.state==="accumulation").length, distribution: reads.filter(r=>r.state==="distribution").length,
              excluded: excluded.length },
    reads, excluded,
  };

  await writeFile(join(DATA, "heat-history.json"), JSON.stringify(snapshots) + "\n");
  await writeFile(join(DATA, "heat-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`✓ heat-report.json — mode: ${report.mode}`);
  console.log(`  🔥${report.counts.markup} ❄️${report.counts.markdown} 😴${report.counts.accumulation} 📈${report.counts.distribution} · excluded: ${report.counts.excluded}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
