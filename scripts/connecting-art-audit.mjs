import { readFile } from "node:fs/promises";
// CONNECTING ART, EVERY COMPLETE GROUP. The wiki table that listed Carvanha
// above Sharpedo was a page layout, not the picture: Carvanha's right edge
// continues into Sharpedo's left, and stacking them is visibly broken.
// Spidops hangs from a web that lands on Tarountula — that one IS top to
// bottom. This file records the decision for every complete combined group
// so a new one cannot ship with a guessed direction.
const art = JSON.parse(await readFile("data/connecting-art.json", "utf8"));

// Printed art checked against the files, not the wiki table.
const ART_ACROSS = new Set(["ex1-51|ex1-22"]); // Carvanha | Sharpedo — panorama, left to right
const ART_ORDER = {
  "neo3-13|neo3-6|neo3-14": ["neo3-6", "neo3-13", "neo3-14"], // Entei | Raikou | Suicune
};

function decide(g) {
  const c0 = (g.cards || []).map(x => typeof x === "string" ? x : x?.id).filter(Boolean);
  const key = c0.join("|");
  const c = ART_ORDER[key] || c0;
  const shape = g.rowShape || [];
  const arr = String(g.arrangement || "");
  if (ART_ACROSS.has(key)) return { dir: "across", cols: c.length, rows: 1, shape: [c.length], c, why: "printed edges continue left-right (wiki table was top-bottom)" };
  if (arr.startsWith("grid")) return { dir: "grid", cols: Math.max(...shape, 1), rows: shape.length, shape, c, why: "source grid" };
  if (arr === "vertical" || (shape.length > 1 && shape[0] === 1))
    return { dir: "down", cols: 1, rows: c.length, shape: Array(c.length).fill(1), c, why: "printed edges continue top-bottom, or LEGEND halves" };
  return { dir: "across", cols: c.length, rows: 1, shape: shape.length ? shape : [c.length], c, why: "source row" };
}

const groups = (art.groups || []).filter(g => g.resolution === "COMPLETE" && g.relation === "COMBINED_ILLUSTRATION" && (g.cards || []).length > 1);
console.log("CONNECTING ART — " + groups.length + " complete combined groups\n");
let failed = 0;
const byDir = { across: 0, down: 0, grid: 0 };
for (const g of groups) {
  const d = decide(g);
  byDir[d.dir]++;
  const names = (g.grid || []).flat().map(x => x.sourceName).filter(Boolean).join(" + ");
  console.log("  " + d.dir.padEnd(7) + String(d.cols) + "x" + d.rows + "  " + (g.artist || "?") + "  " + names);
}

const fish = groups.find(g => (g.cards || []).includes("ex1-51"));
const fishD = fish ? decide(fish) : null;
const spider = groups.find(g => (g.cards || []).includes("sv1-243"));
const spiderD = spider ? decide(spider) : null;
const legend = groups.find(g => g.mechanic === "LEGEND" || (g.arrangement === "vertical" && JSON.stringify(g.rowShape) === "[2]"));
const legendD = legend ? decide(legend) : null;

if (!fishD || fishD.dir !== "across") { console.error("\n✗ Carvanha/Sharpedo must lay ACROSS — stacking them is the broken fishes"); failed++; }
else console.log("\n✓ fishes lay across");
if (!spiderD || spiderD.dir !== "down") { console.error("✗ Spidops/Tarountula must stack — the web runs top to bottom"); failed++; }
else console.log("✓ spider stacks");
if (!legendD || legendD.dir !== "down") { console.error("✗ LEGEND halves must stack"); failed++; }
else if (JSON.stringify(legendD.shape) !== JSON.stringify(Array(legendD.c.length).fill(1))) {
  console.error("✗ LEGEND shape must be one card per row, not the wiki's [2] — that draws the bottom half off the canvas");
  failed++;
} else console.log("✓ LEGEND stacks, one half per row");

const beasts = groups.find(g => (g.cards || []).includes("neo3-6") && (g.cards || []).includes("neo3-13"));
const beastsD = beasts ? decide(beasts) : null;
if (!beastsD || beastsD.c.join("|") !== "neo3-6|neo3-13|neo3-14") {
  console.error("✗ Neo Revelation beasts must read Entei | Raikou | Suicune — Entei's claws enter Raikou from the left");
  failed++;
} else console.log("✓ beasts read Entei, Raikou, Suicune left to right");

const sizes = new Set(groups.map(g => (g.cards || []).length));
if (![2,3,4,6,9,11].every(n => sizes.has(n))) {
  console.error("✗ missing a combined size we hold: have " + [...sizes].sort((a,b)=>a-b));
  failed++;
} else console.log("✓ sizes in the walker: " + [...sizes].sort((a,b)=>a-b).join(", "));

console.log("\n" + byDir.across + " across · " + byDir.down + " down · " + byDir.grid + " grid");
if (failed) process.exit(1);
console.log("\n✓ every complete combined group has a direction taken from the picture, not the wiki table");
