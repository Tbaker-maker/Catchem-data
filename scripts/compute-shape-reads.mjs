// Writes ppt-raw-private/shape-facts.json from PPT set raws already on disk.
// Nightly: ppt-refresh.mjs calls updateShapeFile() after today's raws land.
// Raw bodies are read, never copied. The bulk file stays private.
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SHAPE_STATE_FILE, cardFacts } from "./lib/shape-facts.mjs";
import { catalogIndex, scrapeDayOf } from "./lib/tcgplayer-volume.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

export async function factsFromRawDir(rawDir, index) {
  const rows = {};
  let files = 0;
  let graded = 0;
  if (!rawDir || !existsSync(rawDir)) return { rows, files, graded };
  const day = basename(rawDir);
  for (const name of (await readdir(rawDir)).filter((n) => /^set-.+\.json$/.test(n)).sort()) {
    const body = await readJson(join(rawDir, name));
    if (!body) continue;
    files += 1;
    const scrapeDay = scrapeDayOf(body, day);
    const cards = Array.isArray(body.data) ? body.data : [];
    const seen = new Map();
    for (const card of cards) {
      const pid = String(card?.tcgPlayerId ?? "").trim();
      if (!pid) continue;
      seen.set(pid, (seen.get(pid) || 0) + 1);
      if (card?.ebay?.salesByGrade || card?.salesByGrade) graded += 1;
    }
    for (const card of cards) {
      const pid = String(card?.tcgPlayerId ?? "").trim();
      if (!/^\d+$/.test(pid) || seen.get(pid) !== 1) continue;
      const fact = cardFacts(card, index.get(pid), scrapeDay);
      if (!fact) continue;
      if (!rows[fact.id] || String(rows[fact.id].scrapedOn) <= String(fact.scrapedOn)) rows[fact.id] = fact;
    }
  }
  return { rows, files, graded };
}

export function mergeShapeDoc(prev, fresh, { updatedOn } = {}) {
  const cards = { ...(prev?.cards || {}) };
  for (const [id, row] of Object.entries(fresh || {})) {
    const old = cards[id];
    if (old && String(old.scrapedOn || "") > String(row.scrapedOn || "")) continue;
    cards[id] = row;
  }
  return {
    schema: 1,
    updatedOn: updatedOn || prev?.updatedOn || "",
    note: "Facts for reads. Counts and the prices those reads name. Not a bulk price table.",
    cards,
  };
}

export async function updateShapeFile({ root = ROOT, rawDirs = [], today = "" } = {}) {
  const catalog = await readJson(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const index = catalogIndex(catalog.items || []);
  const statePath = join(root, SHAPE_STATE_FILE);
  let doc = await readJson(statePath, null);
  const report = { files: 0, cards: 0, graded: 0 };
  for (const dir of rawDirs) {
    const got = await factsFromRawDir(dir, index);
    report.files += got.files;
    report.cards += Object.keys(got.rows).length;
    report.graded += got.graded;
    if (got.files) doc = mergeShapeDoc(doc, got.rows, { updatedOn: today });
  }
  if (!report.files || !doc) return { ...report, written: false };
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(doc));
  report.cards = Object.keys(doc.cards || {}).length;
  return { ...report, written: true };
}

async function main() {
  const args = process.argv.slice(2);
  const rawDirs = [];
  for (let i = 0; i < args.length; i += 1) if (args[i] === "--raw" && args[i + 1]) rawDirs.push(args[++i]);
  const today = new Date().toISOString().slice(0, 10);
  if (!rawDirs.length) rawDirs.push(join(ROOT, "ppt-raw-private", today));
  const out = await updateShapeFile({ rawDirs, today });
  console.log(`shape-facts ${out.written ? "written" : "unchanged"} files=${out.files} cards=${out.cards} graded=${out.graded}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`shape-facts failed: ${String(err?.message || err).slice(0, 180)}`);
    process.exitCode = 1;
  });
}
