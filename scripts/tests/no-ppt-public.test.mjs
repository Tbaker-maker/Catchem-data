// Guard: PokemonPriceTracker (PPT) history never reaches the public repo or its outputs.
// Licence: PPT data stays private until a PPT Business plan and a written yes.
// 1. No PPT history folder or file is tracked in this repo.
// 2. Every price point in the public buckets, sparks and quick-sheet inputs is a
//    TCGCSV day we publish (data/history/tcgcsv-daily or data/history/tcgplayer-market).
//    A point on a day those files do not hold for that product is treated as PPT-derived.
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export const BANNED_PATHS = [
  "data/history/market-backfill/",
  "data/history/market-backfill-removed.json",
  "data/history/ppt-sealed/",
  "data/history/ppt-sealed-private/",
  "ppt-raw-private/",
  // PPT-valued files moved to catchem-data-private on 2026-10-10.
  "data/derived/tcgplayer-volume.json",
  "data/singles-enrichment.json",
  "data/enrichment-distilled.json",
  // rarebox archive: no licence, personal use only. Private repo since 2026-10-10.
  "data/history/singles-rarebox/",
  "ppt-raw-private/singles-rarebox/",
];

// A public JSON file must not carry PPT-sourced values. Names and ids may stay.
export const PPT_SOURCE_RE = /pokemon\s*price\s*tracker|pokemonpricetracker/i;
export const VALUE_KEYS = /^(market|low|high|mid|price|sold7d|sold30d|vol30|recentSales|conditions|tcgMarket|tcgPrice)$/;
export function pptValuedDoc(doc) {
  // true when the top-level source names PPT and any nested object holds a value key
  const src = `${doc?.source || ""} ${doc?.provenance || ""}`;
  if (!PPT_SOURCE_RE.test(src)) return false;
  let hit = false;
  const walk = (v, d) => { if (hit || d > 6 || !v || typeof v !== "object") return; for (const [k, x] of Object.entries(v)) { if (VALUE_KEYS.test(k) && (typeof x === "number" || (x && typeof x === "object"))) { hit = true; return; } walk(x, d + 1); } };
  walk(doc.cards || doc.rows || doc.entries || doc, 0);
  return hit;
}

export function pptPathsIn(files) {
  return files.filter((f) => BANNED_PATHS.some((p) => p.endsWith("/") ? f.startsWith(p) : f === p));
}

// allowed: Map pid -> Map date -> price (2dp)
export function unexplainedPoints(cards, allowed) {
  const bad = [];
  for (const card of cards) {
    if (!card || !Array.isArray(card.hist) || !card.pid) continue;
    const days = allowed.get(Number(card.pid));
    for (const [day, value] of card.hist) {
      const seen = days?.get(day);
      if (seen == null || Math.abs(seen - Number(value)) > 0.011) bad.push(`${card.pid} ${day} ${value}`);
    }
  }
  return bad;
}

async function publicDays() {
  const allowed = new Map();
  const add = (pid, day, v) => {
    const id = Number(pid); const n = Number(v);
    if (!id || !(n > 0)) return;
    if (!allowed.has(id)) allowed.set(id, new Map());
    const m = allowed.get(id);
    // a product can have several printings on one day; keep each value
    const key = day;
    if (!m.has(key)) m.set(key, Math.round(n * 100) / 100);
    else if (Math.abs(m.get(key) - n) > 0.011) m.set(`${key}#${n}`, n);
  };
  for (const f of await readdir(join(ROOT, "data/history/tcgcsv-daily"))) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", f), "utf8"));
    for (const p of doc.prices || []) add(p.id, doc.date, p.market);
  }
  try {
    for (const f of await readdir(join(ROOT, "data/history/tcgplayer-market"))) {
      if (!f.endsWith(".json")) continue;
      const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgplayer-market", f), "utf8"));
      for (const p of doc.points || []) add(doc.tcgplayerProductId, p.date, p.market);
    }
  } catch {}
  return allowed;
}

export async function runNoPptPublicTests() {
  fail = 0;
  t("a backfill file is a PPT path", pptPathsIn(["data/history/market-backfill/00.json", "data/history/tcgcsv-daily/2026-10-10.json"]).length === 1);
  t("the removed list is a PPT path", pptPathsIn(["data/history/market-backfill-removed.json"]).length === 1);
  {
    const allowed = new Map([[1, new Map([["2026-10-10", 2]])]]);
    t("a point on a public day passes", unexplainedPoints([{ pid: 1, hist: [["2026-10-10", 2]] }], allowed).length === 0);
    t("a point on a day no public file holds fails", unexplainedPoints([{ pid: 1, hist: [["2026-04-01", 2]] }], allowed).length === 1);
    t("a different value on a public day fails", unexplainedPoints([{ pid: 1, hist: [["2026-10-10", 3]] }], allowed).length === 1);
  }
  t("a rarebox singles file is a banned path", pptPathsIn(["data/history/singles-rarebox/swsh2-200.json"]).length === 1);
  {
    const flags = JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf8")).flags;
    t("ppt.publicDisplay flag is off (no PPT numbers in public until Business plan + written yes)", flags["ppt.publicDisplay"]?.value === false, `value=${flags["ppt.publicDisplay"]?.value}`);
    t("CATCHEM_PPT_LICENSED is not forcing PPT on", process.env.CATCHEM_PPT_LICENSED !== "1");
    const importer = await readFile(join(ROOT, "scripts/import-history-backfill.mjs"), "utf8");
    t("history importer never writes rarebox singles under data/", !/join\(ROOT,\s*"data\/history\/singles-rarebox"/.test(importer));
  }
  let tracked = [];
  try { tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean); } catch {}
  const leaked = pptPathsIn(tracked);
  t("no PPT history file is tracked in the public repo", leaked.length === 0, leaked.slice(0, 5).join(", "));

  t("a PPT-sourced doc with prices is flagged", pptValuedDoc({ source: "pokemonpricetracker v2", cards: [{ raw: { market: 2 } }] }));
  t("a PPT-named ids-only map is not flagged", !pptValuedDoc({ source: "build-crosscheck-map.mjs vs pokemonpricetracker v2", entries: [{ id: "a", tcgPlayerId: "1" }] }));
  const pptValued = [];
  for (const f of tracked.filter((n) => /^(data|research\/assets)\/.*\.json$/.test(n) && !n.startsWith("data/history/"))) {
    try {
      const raw = await readFile(join(ROOT, f), "utf8");
      if (raw.length > 30_000_000 || !PPT_SOURCE_RE.test(raw.slice(0, 4000))) continue;
      if (pptValuedDoc(JSON.parse(raw))) pptValued.push(f);
    } catch {}
  }
  t("no tracked public JSON carries PPT-sourced values", pptValued.length === 0, pptValued.slice(0, 5).join(", "));
  let volumeReads = [];
  try { volumeReads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8")).reads.filter((r) => r.readKind === "volume" || r.kind === "volume"); } catch {}
  t("volume reads are off until PPT's written yes", volumeReads.length === 0, `${volumeReads.length} volume reads`);

  const allowed = await publicDays();
  const allowsVariant = (pid, day, v) => { const m = allowed.get(pid); if (!m) return false; for (const [k, x] of m) if ((k === day || k.startsWith(day + "#")) && Math.abs(x - v) <= 0.011) return true; return false; };
  const bucketDir = join(ROOT, "research/assets/public/buckets");
  const bad = [];
  for (const f of (await readdir(bucketDir)).filter((n) => n.endsWith(".json"))) {
    const doc = JSON.parse(await readFile(join(bucketDir, f), "utf8"));
    for (const card of Array.isArray(doc) ? doc : Object.values(doc)) {
      if (!card?.pid || !Array.isArray(card.hist)) continue;
      for (const [day, v] of card.hist) if (!allowsVariant(Number(card.pid), day, Number(v))) bad.push(`${card.pid} ${day} ${v}`);
    }
  }
  t("every public bucket price point is a TCGCSV day we publish", bad.length === 0, `${bad.length} points, e.g. ${bad.slice(0, 3).join("; ")}`);
  return fail;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await runNoPptPublicTests() ? 1 : 0);
