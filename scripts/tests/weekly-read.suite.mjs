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
    repeat: {
      status: "building history",
      sealed: { rows: [
        { id: "a", name: "Box A", days7: 2, days30: 2, days90: 2, streak: 2, lastSeen: "2026-09-26" },
        { id: "b", name: "Box B", days7: 2, days30: 2, days90: 2, streak: 2, lastSeen: "2026-09-26" },
        { id: "c", name: "Box C", days7: 2, days30: 2, days90: 2, streak: 2, lastSeen: "2026-09-26" },
      ] },
      singles: { rows: [{ id: "z", name: "Zero", days7: 0, days30: 1, days90: 1, streak: 1, lastSeen: "2026-09-21" }] },
    },
    sets: [
      { set: "Scarlet", sealed: { status: "building history", level: null }, chase: { status: "building history", level: null, names: ["Chase", "Chase"] } },
      { set: "Two", sealed: { status: "building history", level: null }, chase: { status: "building history", level: null, names: [] } },
      { set: "Three", sealed: { status: "building history", level: null }, chase: { status: "building history", level: null, names: [] } },
    ],
  });
  const md = weeklyMarkdown(doc);
  t("weekly outline has the kept sections", md.includes("## Keeps showing up") && md.includes("## Sealed line and chase line"));
  t("weekly outline drops the track record", !md.includes("Hit rate") && !md.includes("Hits") && !md.includes("Misses") && !doc.readsWeTracked);
  t("weekly outline drops a short heat list and a zero-day single", !md.includes("## Heat") && !md.includes("Zero"));
  t("weekly outline dedupes chase names", doc.sealedAndChase[0].chaseNames.length === 1);
  t("weekly title has no em dash", doc.title === "Weekly Read, 2026-09-26" && !md.includes("\u2014"));
  let threw = false;
  try { weeklyMarkdown({ ...doc, heat: [{ name: "Box", heat: "load up now" }, { name: "B", heat: "x" }, { name: "C", heat: "y" }], keepsShowingUp: doc.keepsShowingUp, sealedAndChase: doc.sealedAndChase }); } catch { threw = true; }
  t("an advice phrase refuses the outline", threw);
  let shop = true;
  try { weeklyMarkdown({ ...doc, heat: [{ name: "Box", heat: "Buy on eBay" }, { name: "B", heat: "x" }, { name: "C", heat: "y" }], keepsShowingUp: doc.keepsShowingUp, sealedAndChase: doc.sealedAndChase }); } catch { shop = false; }
  t("a shop button label passes the outline", shop);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("weekly-read.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
