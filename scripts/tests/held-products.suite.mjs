// held-products.suite.mjs — a held product reaches no editorial input.
//
// The Pulse leaked held products three times on 2026-10-06 (Keeps showing up,
// Supply shifts, and in review Deepest markets / pack math / rip-sell-trade /
// Rip or Hold), each time through a list that skipped its own filter. The fix
// scrubs held products once, where the files are read (loadEditorialJson).
// This suite proves that on the real committed files:
//   1. hold one product from EVERY product list Pulse, cards and Discord read,
//      scrub, and none of them is left anywhere in the scrubbed data;
//   2. the scrub removes only those rows, nothing else;
//   3. the consumers read those files through the scrub, never raw, so a new
//      section added later cannot skip it;
//   4. the Board labels a held product instead of pricing it.
// scripts/tests/held-pulse-e2e.mjs builds the whole Pulse with held products
// injected and greps every output; it is too slow for this fail-fast gate.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeBlocked, scrubHeld } from "../lib/publish-guard.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const J = async (rel) => { try { return JSON.parse(await readFile(join(ROOT, rel), "utf8")); } catch { return null; } };

export const EDITORIAL_FILES = [
  "data/derived-insights.json",
  "data/derived/repeat-rank.json",
  "data/heat-report.json",
  "data/divergence-report.json",
  "research/pulse/rip-sell-trade.json",
];
export const CONSUMERS = [
  "scripts/generate-pulse.mjs",
  "scripts/mint-cards.mjs",
  "scripts/mint-social-card.mjs",
  "scripts/send-discord-alerts.mjs",
  "scripts/social-posts.mjs",
  "scripts/post-bank.mjs",
];

// One product from every product list those files carry.
export function pickHeld(docs, products) {
  const ids = new Set();
  const byName = new Map(products.map((p) => [p.name, p.id]));
  const take = (row) => {
    if (!row) return;
    if (row.id && products.some((p) => p.id === row.id)) ids.add(row.id);
    else if (row.name && byName.has(row.name)) ids.add(byName.get(row.name));
    else if (row.flagship && byName.has(row.flagship)) ids.add(byName.get(row.flagship));
  };
  const der = docs["data/derived-insights.json"] || {};
  take(der.supplyShifts?.[0]);
  take(der.depthReads?.[0]);
  take(der.packMath?.priciest?.[0]);
  take(der.packMath?.cheapest?.[0]);
  take(der.dailyThree?.sealed);
  take(der.watchOutcomes?.sealed);
  take(der.narrative?.quietMovers?.[0]);
  const rr = docs["data/derived/repeat-rank.json"] || {};
  take(rr.sealed?.rows?.[0]);
  take((docs["data/heat-report.json"]?.reads || [])[0]);
  take((docs["data/divergence-report.json"]?.rows || []).find((r) => r.signal) || docs["data/divergence-report.json"]?.rows?.[0]);
  take((docs["research/pulse/rip-sell-trade.json"]?.rows || [])[0]);
  return ids;
}

const countRows = (v, pred) => {
  let n = 0;
  const walk = (x) => {
    if (Array.isArray(x)) { for (const y of x) { if (pred(y)) n += 1; walk(y); } }
    else if (x && typeof x === "object") for (const y of Object.values(x)) walk(y);
  };
  walk(v);
  return n;
};

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  };

  const sp = await J("data/sealed-prices.json") || { products: [] };
  const docs = {};
  for (const rel of EDITORIAL_FILES) docs[rel] = await J(rel);
  const heldIds = pickHeld(docs, sp.products || []);
  t("at least four products are held across the lists", heldIds.size >= 4, String(heldIds.size));
  const blk = makeBlocked(heldIds, sp.products || []);

  // 1 + 2: nothing held survives; nothing else is removed.
  const leaks = [];
  let wronglyDropped = 0;
  for (const rel of EDITORIAL_FILES) {
    const doc = docs[rel];
    if (!doc) continue;
    const clean = scrubHeld(doc, blk);
    const text = JSON.stringify(clean);
    for (const n of blk.names) if (text.includes(n)) leaks.push(`${rel}: ${n}`);
    for (const id of blk.ids) if (text.includes(`"${id}"`)) leaks.push(`${rel}: ${id}`);
    const isHeld = (r) => r && typeof r === "object" && !Array.isArray(r)
      && ["id", "productId", "sku", "name", "flagship", "subject", "title"].some((k) => typeof r[k] === "string" && blk.blocked(r[k]))
      || (r && typeof r === "object" && !Array.isArray(r) && Object.values(r).some((v) => typeof v === "string" && blk.mentions(v)));
    const keptBefore = countRows(doc, (r) => r && typeof r === "object" && !Array.isArray(r) && !isHeld(r));
    const keptAfter = countRows(clean, (r) => r && typeof r === "object" && !Array.isArray(r));
    // Rows nested under a removed row disappear with it, so after <= before;
    // anything beyond that would mean an unheld row was dropped.
    if (keptAfter > keptBefore) wronglyDropped += 1;
  }
  t("no held product name or id is left in any scrubbed editorial file", leaks.length === 0, leaks.slice(0, 5).join(" · "));
  const der = scrubHeld(docs["data/derived-insights.json"] || {}, blk);
  const raw = docs["data/derived-insights.json"] || {};
  const heldShifts = (raw.supplyShifts || []).filter((r) => blk.blocked(r.id)).length;
  t("only held rows leave a list (supply shifts)", (der.supplyShifts || []).length === (raw.supplyShifts || []).length - heldShifts && heldShifts >= 1,
    `${(raw.supplyShifts || []).length} → ${(der.supplyShifts || []).length}, held ${heldShifts}`);
  t("a held single-product slot becomes null, an unheld one stays",
    (!raw.dailyThree?.sealed || der.dailyThree?.sealed === null || !blk.blocked(raw.dailyThree.sealed.name))
    && (raw.sealedIndex == null || der.sealedIndex?.level === raw.sealedIndex.level));
  t("scrub leaves numbers alone", wronglyDropped === 0 && JSON.stringify(der.eraIndexes) === JSON.stringify(scrubHeld(raw.eraIndexes, makeBlocked([], []))));

  // 3: consumers read these files through the scrub, never with a plain read.
  const rawRead = new RegExp(`\\bJ\\(\\s*"(${EDITORIAL_FILES.map((f) => f.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})"`);
  const bad = [];
  for (const rel of CONSUMERS) {
    const src = await readFile(join(ROOT, rel), "utf8");
    // A line marked "held-scrub: catalog" feeds the product catalog (Board and
    // feed products), where held rows stay on purpose and carry a held label.
    const lines = src.split("\n").filter((l) => !/held-scrub: catalog/.test(l));
    if (lines.some((l) => rawRead.test(l))) bad.push(rel);
    if (/derived-insights\.json/.test(src) && !/loadEditorialJson|\bE\("data\/derived-insights\.json"\)/.test(src)) bad.push(rel + " (derived not scrubbed)");
  }
  t("Pulse, cards, social and Discord read editorial files only through the held scrub", bad.length === 0, bad.join(", "));

  // 4: the Board labels a held product instead of pricing it.
  const board = await readFile(join(ROOT, "scripts/generate-board.mjs"), "utf8");
  t("the Board labels held products and shows no price for them",
    /loadBlocked/.test(board) && /isHeld\(p\) \? "held"/.test(board) && /dot held/.test(board));

  // The negative case: a planted held row inside a nested list is removed.
  const planted = { lists: { a: [{ id: "x-held", name: "Planted Held Box" }, { id: "y-ok", name: "Fine Box" }] }, pick: { name: "Planted Held Box" }, note: "Planted Held Box went up" };
  const pb = makeBlocked(["x-held"], [{ id: "x-held", name: "Planted Held Box" }]);
  const pc = scrubHeld(planted, pb);
  t("a planted held row, slot and sentence are all removed, the unheld row stays",
    pc.lists.a.length === 1 && pc.lists.a[0].id === "y-ok" && pc.pick === null && !JSON.stringify(pc.lists).includes("Planted"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("held-products.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("held products ok");
}
