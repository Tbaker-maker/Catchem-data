// windowless-price-guard.mjs — a price with no time window is not a price.
//
// 2026-08-23. We published PSA 10 at $5,101 as what a card sells for. It is a
// median of 559 sales spanning $1,500 to $8,000 with NO DATE RANGE — a
// historical average over an unknown span. Tyler checked before posting and
// caught it. Had he not, a creator repeating our number would have been wrong
// in public, on our word, and that is the one failure this whole system exists
// to prevent.
//
// TWO THINGS WENT WRONG AND BOTH ARE NOW GUARDED:
//  1. A windowless aggregate was treated as a current price, and compared
//     against a current raw price — computing the gap between today and an
//     unknown past, then calling it a premium.
//  2. There were TWO code paths to that number and the first fix covered one.
//
// This checks the SHAPE of the data rather than any single consumer: any sold
// aggregate that lacks a date range must not appear in a published figure,
// whoever reads it and whichever path they take.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const problems = [];

// 1 — does any sold aggregate we hold lack a window?
const enrich = await J("data/singles-enrichment.json");
const rows = (enrich?.cards ?? enrich?.rows ?? []);
const WINDOW_FIELDS = /from|to|since|window|period|days|range|start|end/i;
let windowless = 0;
for (const c of rows) {
  const sold = c?.ebaySold;
  if (!sold) continue;
  const hasWindow = Object.keys(sold).some(k => WINDOW_FIELDS.test(k));
  if (!hasWindow) windowless++;
}
if (windowless) problems.push({ severity: "info",
  what: `${windowless} card(s) carry sold aggregates with no date range`,
  why: "A median with no window is a historical average. It is usable for context and unusable as a price." });

// 2 — did any of those numbers reach a PUBLISHED surface? This is the check
// that matters, and it looks at output rather than at intent.
const SURFACES = ["research/pulse/pulse-feed.json", "data/derived-insights.json", "research/pulse/demand.json"];
for (const s of SURFACES) {
  const d = await J(s);
  if (!d) continue;
  const txt = JSON.stringify(d);
  // A published psa figure paired with a price is the exact shape that shipped.
  if (/"psa10"\s*:\s*\d/.test(txt) || /"psa9"\s*:\s*\d/.test(txt))
    problems.push({ severity: "critical",
      what: `${s} publishes a PSA sale figure as a number`,
      why: "Those aggregates have no time window. Publishing one as a price is what nearly reached a post today." });
}

// 3 — are there multiple code paths to it? The first fix covered one of two.
const scripts = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
const readers = [];
for (const f of scripts) {
  if (/windowless-price-guard/.test(f)) continue;
  const src = await readFile(join(ROOT, "scripts", f), "utf-8").catch(() => "");
  if (/ebaySold\?\.psa|ebaySold\.psa/.test(src)) readers.push(f);
}
if (readers.length > 1)
  problems.push({ severity: "high",
    what: `${readers.length} scripts read PSA sale figures directly: ${readers.join(", ")}`,
    why: "Multiple paths to the same unusable number. Disabling one leaves the others live, which is precisely how this shipped." });

const critical = problems.filter(p => p.severity === "critical");
if (critical.length) {
  console.error(`\n✗ WINDOWLESS PRICE — ${critical.length} critical:`);
  for (const p of problems) console.error(`   [${p.severity}] ${p.what}\n     ${p.why}`);
  console.error("\n   A price with no time window is not a price. It cannot be published, chipped, or compared to a current figure.\n");
  process.exitCode = 1;
} else {
  console.log(`✓ windowless price: no PSA sale figure reaches a published surface${problems.length ? ` · ${problems.length} note(s)` : ""}`);
  for (const p of problems) console.log(`  [${p.severity}] ${p.what}`);
}
