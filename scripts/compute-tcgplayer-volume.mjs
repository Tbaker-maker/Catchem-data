// Writes data/derived/tcgplayer-volume.json from PPT set raws on disk.
// Nightly: ppt-refresh.mjs calls updateVolumeFile() right after it writes
// today's raws. By hand (seeding from older raw days, oldest first):
//   node scripts/compute-tcgplayer-volume.mjs --raw <dir> [--raw <dir> ...]
// Raw bodies are read, never copied. Only counts and dates are written: every
// card to the private state (ppt-raw-private/tcgplayer-volume.json, pushed to
// catchem-data-private), and only the cards shown in reads to the public
// data/derived/tcgplayer-volume.json.
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VOLUME_FILE, VOLUME_STATE_FILE, catalogIndex, mergeVolumeDoc, publicVolumeDoc, serializeVolumeDoc, setVolumes } from "./lib/tcgplayer-volume.mjs";
import { volumeReads } from "./lib/volume-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

/** Rows from every set-*.json in one raw folder. */
export async function volumesFromRawDir(rawDir, index) {
  const rows = {};
  const skipped = {};
  let files = 0;
  if (!rawDir || !existsSync(rawDir)) return { rows, skipped, files };
  const day = basename(rawDir);
  for (const name of (await readdir(rawDir)).filter((n) => /^set-.+\.json$/.test(n)).sort()) {
    const body = await readJson(join(rawDir, name));
    if (!body) continue;
    files += 1;
    const got = setVolumes(body, index, { fallbackDay: day });
    for (const [id, row] of Object.entries(got.rows)) {
      if (!rows[id] || String(rows[id].scrapedOn) <= String(row.scrapedOn)) rows[id] = row;
    }
    for (const [why, n] of Object.entries(got.skipped)) skipped[why] = (skipped[why] || 0) + n;
  }
  return { rows, skipped, files };
}

export async function updateVolumeFile({ root = ROOT, rawDirs = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const catalog = await readJson(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const index = catalogIndex(catalog.items || []);
  const outPath = join(root, VOLUME_FILE);
  const statePath = join(root, VOLUME_STATE_FILE);
  // The private state carries every card; it is mounted from catchem-data-private.
  let doc = await readJson(statePath, null);
  const report = { files: 0, cards: 0, skipped: {} };
  for (const dir of rawDirs) {
    const got = await volumesFromRawDir(dir, index);
    report.files += got.files;
    report.cards += Object.keys(got.rows).length;
    for (const [why, n] of Object.entries(got.skipped)) report.skipped[why] = (report.skipped[why] || 0) + n;
    if (got.files) doc = mergeVolumeDoc(doc, got.rows, { updatedOn: today });
  }
  if (!report.files) return { ...report, written: false, counts: doc?.counts || null };
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, serializeVolumeDoc(doc));
  // Public: only the cards a volume read will show.
  const shown = volumeReads(doc, catalog.items || [], { asOf: today }).map((r) => r.sku);
  const pub = publicVolumeDoc(doc, shown);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, serializeVolumeDoc(pub));
  return { ...report, written: true, counts: doc.counts, published: pub.published };
}

async function main() {
  const args = process.argv.slice(2);
  const rawDirs = [];
  for (let i = 0; i < args.length; i += 1) if (args[i] === "--raw" && args[i + 1]) rawDirs.push(args[++i]);
  const today = new Date().toISOString().slice(0, 10);
  if (!rawDirs.length) rawDirs.push(join(ROOT, "ppt-raw-private", today));
  const out = await updateVolumeFile({ rawDirs, today });
  console.log(`tcgplayer-volume ${out.written ? "written" : "unchanged (no set raws)"} files=${out.files} cards=${out.cards} published=${out.published ?? 0} ${JSON.stringify(out.counts || {})} skipped=${JSON.stringify(out.skipped)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`tcgplayer-volume failed: ${String(err?.message || err).slice(0, 180)}`);
    process.exitCode = 1;
  });
}
