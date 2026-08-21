// scripts/pop-velocity.mjs — Pop Velocity: the SUPPLY side of Slab Math.
// Reads flat rows from data/pop-snapshots.json ({date,cardId,grader,pop10,
// pop9,popTotal,source}) and per card computes month-over-month pop growth %,
// gem rate (pop10/total), and a "pop pressure" read — fast 10-growth means
// the graded supply is inflating into the premium: RT-5's PSA-9-tax
// mechanism made measurable ("Premium +$1,426 BUT pop10 +38 this month —
// premium eroding as the hobby slabs into it").
// One snapshot = baseline mode (gem rates only; velocity wakes at date #2).
// Every row is chip READ, sourced "PSA pop report, manual snapshot [date]".
// Human-entered snapshots only — no scraping, no automation against PSA.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/pop-snapshots.json"), "utf-8"));
const snaps = d.snapshots || [];
if (!snaps.length) {
  console.log("pop-velocity dormant: 0 rows (monthly ritual — see data/pop-snapshots.json note)");
  process.exit(0);
}

// Labels from enrichment (confirmed chases) then watchlist (AUTO-B).
const label = new Map();
try {
  const e = JSON.parse(await readFile(join(ROOT, "data/singles-enrichment.json"), "utf-8"));
  for (const c of e.cards || []) label.set(c.cardId, `${c.name}`);
} catch {}
try {
  const w = JSON.parse(await readFile(join(ROOT, "data/singles-watchlist.json"), "utf-8"));
  for (const c of w.cards || []) {
    const m = /(?:^|\s)id:([\w-]+)/.exec(c.q || "");
    if (m && !label.has(m[1])) label.set(m[1], c.label.replace(/^AUTO-B: /, ""));
  }
} catch {}

const groups = new Map(); // cardId|grader -> rows sorted by date
for (const s of snaps) {
  const k = `${s.cardId}|${s.grader}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(s);
}
for (const rows of groups.values()) rows.sort((a, b) => a.date.localeCompare(b.date));

const pct1 = (x) => (x === null ? null : Math.round(x * 10) / 10);
const pressure = (g10) => {
  if (g10 === null) return "baseline — velocity read unlocks at snapshot 2";
  if (g10 >= 8) return "high — 10s minting fast; premium compression risk (RT-5 mechanism)";
  if (g10 >= 3) return "building — 10 pop growing faster than comfort; watch the premium";
  return "stable — pop growth not currently threatening the premium";
};

const rows = [];
const allDates = [...new Set(snaps.map((s) => s.date))].sort();
for (const [k, hist] of groups) {
  const curr = hist[hist.length - 1];
  const prev = hist.length >= 2 ? hist[hist.length - 2] : null;
  const gemRatePct = curr.popTotal ? pct1((curr.pop10 / curr.popTotal) * 100) : null;
  let growth10PctMo = null, growthTotalPctMo = null, dPop10 = null, dPopTotal = null;
  if (prev) {
    const days = (new Date(curr.date) - new Date(prev.date)) / 86400000 || 30;
    dPop10 = curr.pop10 - prev.pop10;
    dPopTotal = curr.popTotal - prev.popTotal;
    growth10PctMo = prev.pop10 ? pct1((dPop10 / prev.pop10) * (30 / days) * 100) : null;
    growthTotalPctMo = prev.popTotal ? pct1((dPopTotal / prev.popTotal) * (30 / days) * 100) : null;
  }
  rows.push({
    cardId: curr.cardId,
    name: label.get(curr.cardId) || curr.cardId,
    grader: curr.grader,
    asOf: curr.date,
    pop10: curr.pop10,
    pop9: curr.pop9,
    popTotal: curr.popTotal,
    gemRatePct,
    dPop10,
    dPopTotal,
    growth10PctMo,
    growthTotalPctMo,
    window: prev ? `${prev.date} → ${curr.date}` : null,
    popPressure: pressure(growth10PctMo),
    chip: "READ",
    source: `${curr.source}, manual snapshot ${curr.date}`,
  });
}
// Velocity mode sorts by fastest 10-growth; baseline mode by gem rate.
rows.sort((a, b) => (b.growth10PctMo ?? -1) - (a.growth10PctMo ?? -1) || (b.gemRatePct ?? 0) - (a.gemRatePct ?? 0));

const velocityLive = rows.some((r) => r.growth10PctMo !== null);
await writeFile(join(ROOT, "data/pop-velocity.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  chip: "READ",
  method: "Human-entered monthly snapshots from free pop front doors (psacard.com/pop when accessible; gemrate.com universal search PSA row otherwise) — no scraping. Growth = Δpop over the interval, normalized to /30 days. Gem rate = pop10/popTotal. Pop pressure is a Read: fast 10-growth = graded supply inflating into the Grading Premium (RT-5). Falsifier per row: if the premium holds through a fast-pop month, the compression read is wrong.",
  mode: velocityLive ? "velocity" : `baseline (${allDates.length}/2 snapshot dates — growth unlocks at date #2)`,
  snapshotDates: allDates,
  rows,
}, null, 2) + "\n");

if (velocityLive) {
  const f = rows[0];
  console.log(`✓ pop-velocity: ${rows.length} chases · fastest 10-growth: ${f.name} +${f.dPop10} (${f.growth10PctMo}%/mo)`);
} else {
  const g = rows[0];
  console.log(`✓ pop-velocity baseline: ${rows.length} chases recorded ${allDates[allDates.length - 1]} · top gem rate: ${g.name} ${g.gemRatePct}% · velocity wakes at snapshot date #2`);
}
