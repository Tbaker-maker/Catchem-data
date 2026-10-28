// Fail when two breakdowns are near-duplicates after stripping numbers.
// Builds varied fixtures plus a sample of real item facts when present.
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBreakdown, breakdownShape, shapeSimilarity, whatWeSee, BANNED } from "../lib/what-we-see.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SIM_LIMIT = 0.82;

function fixture(id, overrides) {
  return {
    id,
    item: { id, kind: "single", name: "Demo", price: 20, priceAsOf: "2026-10-28" },
    asOf: "2026-10-28",
    ...overrides,
  };
}

const FIXTURES = [
  fixture("a-athigh", {
    range: { from: "2024-01-01", now: { date: "2026-10-28", price: 50 }, high: { price: 50, date: "2026-10-28" }, low: { price: 10, date: "2024-06-01" }, daysSinceHigh: 0, fromHighPct: 0 },
    change: { d30: { pct: 18, from: "2026-09-28", to: "2026-10-28", p0: 42, p1: 50 } },
  }),
  fixture("b-drawdown", {
    range: { from: "2024-01-01", now: { date: "2026-10-28", price: 30 }, high: { price: 80, date: "2025-06-01" }, low: { price: 20, date: "2024-03-01" }, daysSinceHigh: 514, fromHighPct: -62.5 },
    change: { d30: { pct: -4, from: "2026-09-28", to: "2026-10-28", p0: 31.2, p1: 30 } },
  }),
  fixture("c-listings", {
    change: { d30: { pct: 2, from: "2026-09-28", to: "2026-10-28", p0: 20, p1: 20.4 } },
    listings: { n: 40, date: "2026-10-28", prev: 80, prevDate: "2026-10-21", pct: -50, span: 7 },
  }),
  fixture("d-vsset", {
    change: { d30: { pct: -22, from: "2026-09-28", to: "2026-10-28", p0: 40, p1: 31.2 } },
    setMomentum: { pct: -4, from: "2026-09-28", to: "2026-10-28", set: "SV08: Surging Sparks", kind: "singles" },
  }),
  fixture("e-contrast", {
    change: {
      d7: { pct: 12, from: "2026-10-21", to: "2026-10-28", p0: 20, p1: 22.4 },
      d30: { pct: -18, from: "2026-09-28", to: "2026-10-28", p0: 27, p1: 22.4 },
    },
  }),
  fixture("f-gap", {
    item: { id: "f-gap", kind: "single", name: "Demo", price: 25, priceAsOf: "2026-10-28" },
    gap: { ebay: 40, tcg: 25, pct: 60, ebayDate: "2026-10-28", tcgDate: "2026-10-28" },
    change: { d30: { pct: 1, from: "2026-09-28", to: "2026-10-28", p0: 24.8, p1: 25 } },
  }),
  fixture("g-sealed-rip", {
    item: { id: "g-sealed-rip", kind: "sealed", name: "ETB", price: 70, priceAsOf: "2026-10-28" },
    kind: "sealed",
    rip: { contentsEV: 55, price: 70, roiPct: -21.4, asOf: "2026-10-28" },
    change: { d30: { pct: -6, from: "2026-09-28", to: "2026-10-28", p0: 74.5, p1: 70 } },
    gap: { ebay: 78, tcg: 70, pct: 11.4, ebayDate: "2026-10-28", tcgDate: "2026-10-28", condition: "Sealed" },
  }),
  fixture("h-nearlow", {
    range: { from: "2024-01-01", now: { date: "2026-10-28", price: 21 }, high: { price: 60, date: "2025-01-01" }, low: { price: 20, date: "2026-10-20" }, daysSinceHigh: 666, fromHighPct: -65 },
    change: { d90: { pct: -30, from: "2026-07-30", to: "2026-10-28", p0: 30, p1: 21 } },
  }),
  fixture("i-flat", {
    change: { d30: { pct: 1.2, from: "2026-09-28", to: "2026-10-28", p0: 20, p1: 20.24 } },
  }),
  fixture("j-rank", {
    rank: { rank: 1, of: 200, set: "SV10: Destined Rivals", asOf: "2026-10-28" },
    change: { d30: { pct: -3, from: "2026-09-28", to: "2026-10-28", p0: 100, p1: 97 } },
    range: { from: "2025-05-01", now: { date: "2026-10-28", price: 97 }, high: { price: 120, date: "2025-08-01" }, low: { price: 80, date: "2026-01-01" }, daysSinceHigh: 453, fromHighPct: -19.2 },
  }),
  fixture("k-y1up", {
    change: { y1: { pct: 85, from: "2025-10-28", to: "2026-10-28", p0: 10, p1: 18.5 }, d30: { pct: 4, from: "2026-09-28", to: "2026-10-28", p0: 17.8, p1: 18.5 } },
  }),
  fixture("l-rotation", {
    rotation: { mark: "I", status: "Rotated", asOf: "2026-08-24" },
    change: { d30: { pct: -12, from: "2026-09-28", to: "2026-10-28", p0: 20, p1: 17.6 } },
  }),
];

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => {
    console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok && !extra ? "" : (extra ? ` ${extra}` : "")}`);
    if (!ok) fail += 1;
  };

  const lines = FIXTURES.map((f) => {
    const b = buildBreakdown(f);
    t(`fixture ${f.id} has a line`, !!b.line);
    t(`fixture ${f.id} clean`, !BANNED.test(b.line) && !/[\u2014\u2013]/.test(b.line) && !/\bNM\b/.test(b.line) && !/\bcollectr\b/i.test(b.line));
    t(`fixture ${f.id} has sections`, b.sections.length >= 1);
    return { id: f.id, line: b.line, lead: b.lead, shape: breakdownShape(b.line) };
  });

  const shapes = new Set(lines.map((r) => r.shape));
  t(`fixture shapes are mostly unique (${shapes.size}/${lines.length})`, shapes.size >= Math.ceil(lines.length * 0.75));

  let worst = { sim: 0, a: "", b: "" };
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const sim = shapeSimilarity(lines[i].line, lines[j].line);
      if (sim > worst.sim) worst = { sim, a: lines[i].id, b: lines[j].id };
      if (sim >= SIM_LIMIT) {
        t(`near-duplicate ${lines[i].id} vs ${lines[j].id}`, false, `sim=${sim.toFixed(3)}`);
      }
    }
  }
  t(`no fixture pair at or above ${SIM_LIMIT} similarity (worst ${worst.sim.toFixed(3)} ${worst.a}/${worst.b})`, worst.sim < SIM_LIMIT);

  const itemDir = join(ROOT, "research/assets/public/feed/items");
  let realLines = [];
  try {
    const files = (await readdir(itemDir)).filter((n) => n.endsWith(".json")).slice(0, 40);
    for (const name of files) {
      const doc = JSON.parse(await readFile(join(itemDir, name), "utf8"));
      for (const [id, row] of Object.entries(doc.items || {})) {
        const b = buildBreakdown({ ...row, id });
        if (!b.line) continue;
        realLines.push({ id, line: b.line, shape: breakdownShape(b.line), lead: b.lead });
        if (realLines.length >= 120) break;
      }
      if (realLines.length >= 120) break;
    }
  } catch { /* optional */ }

  if (realLines.length >= 40) {
    const realShapes = new Set(realLines.map((r) => r.shape));
    const uniqRatio = realShapes.size / realLines.length;
    t(`real sample unique-shape ratio ${uniqRatio.toFixed(2)} (${realShapes.size}/${realLines.length}) >= 0.35`, uniqRatio >= 0.35);
    let hits = 0;
    let checked = 0;
    for (let i = 0; i < realLines.length; i++) {
      for (let j = i + 1; j < Math.min(realLines.length, i + 25); j++) {
        checked += 1;
        if (shapeSimilarity(realLines[i].line, realLines[j].line) >= SIM_LIMIT) hits += 1;
      }
    }
    const hitRate = checked ? hits / checked : 0;
    t(`real near-duplicate rate ${hitRate.toFixed(3)} (${hits}/${checked}) < 0.25`, hitRate < 0.25);
    const leads = new Set(realLines.map((r) => r.lead).filter(Boolean));
    t(`real sample uses multiple lead kinds (${leads.size})`, leads.size >= 4);
  } else {
    console.log("  skip real-item uniqueness (no item shards)");
  }

  const again = whatWeSee(FIXTURES[1]);
  t("phrasing is stable for the same id", again === lines[1].line);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("breakdown-unique.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("breakdown-unique ok");
}
