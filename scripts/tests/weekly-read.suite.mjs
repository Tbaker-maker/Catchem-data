import { weeklyMarkdown, weeklyRead } from "../lib/weekly-read.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const doc = weeklyRead({
    asOf: "2026-09-26",
    heat: [{ id: "x", name: "Box", label: "Hot", score: 3 }],
    repeat: { status: "building history", sealed: { rows: [{ id: "x", name: "Box", days7: 2, days30: 2, days90: 2, streak: 2, lastSeen: "2026-09-26" }] }, singles: { rows: [] } },
    receipts: { tracked: 2, graded: 2, hits: 1, misses: 1, hitRate: 50, biggestHits: [{ name: "A", kind: "sealed", movePct: 4, result: "hit" }], biggestMisses: [{ name: "B", kind: "single", movePct: -9, result: "miss" }], open: 0 },
    sets: [{ set: "Scarlet", sealed: { status: "building history", level: null }, chase: { status: "building history", level: null, names: ["Chase"] } }],
  });
  const md = weeklyMarkdown(doc);
  t("weekly outline has the four parts", md.includes("## 1. Heat") && md.includes("## 3. Reads we tracked") && md.includes("Miss — B") && md.includes("Hit — A"));
  t("weekly json has no banned framing", doc.title.startsWith("Weekly Read") && doc.sections.length === 4);
  let threw = false;
  try { weeklyMarkdown({ ...doc, heat: [{ name: "Box", heat: "bullish" }] }); } catch { threw = true; }
  t("a banned word refuses the outline", threw);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("weekly-read.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
