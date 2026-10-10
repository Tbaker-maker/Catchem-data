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
];

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
  let tracked = [];
  try { tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean); } catch {}
  const leaked = pptPathsIn(tracked);
  t("no PPT history file is tracked in the public repo", leaked.length === 0, leaked.slice(0, 5).join(", "));

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
