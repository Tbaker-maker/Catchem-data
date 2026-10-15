// Read dated limit files and write data/derived/limits/latest.json.
// A warning line is added to data/derived/status.json when a source is at 85%.
// Missing files are omitted. This script never calls an API and never throws
// on a missing file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLimits, mergeAlerts, YOUTUBE_DAILY_QUOTA } from "./lib/limits-watch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "data/derived/limits/latest.json";
const STATUS = "data/derived/status.json";

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const now = new Date();
const listing = await readJson(join(ROOT, "data/derived/listing-counts/state.json"));
const ppt = await readJson(join(ROOT, "data/ppt/run-report.json"));
const budgets = await readJson(join(ROOT, "config/api-budgets.json"));
const youtubeLimit = Number(budgets?.youtube?.dailyQuota) || YOUTUBE_DAILY_QUOTA;
const localYt = await readJson(join(ROOT, "data/private/youtube/state.json"));
const doc = buildLimits({
  now,
  listingLog: listing?.log ?? null,
  ppt,
  youtube: localYt,
  youtubeLimit,
});

await mkdir(join(ROOT, "data/derived/limits"), { recursive: true });
await writeFile(join(ROOT, OUT), JSON.stringify(doc, null, 1) + "\n");

const status = await readJson(join(ROOT, STATUS));
if (status && typeof status === "object") {
  status.alerts = mergeAlerts(status.alerts, doc.warnings);
  await writeFile(join(ROOT, STATUS), JSON.stringify(status, null, 1) + "\n");
}

console.log(JSON.stringify({ limits: { asOf: doc.asOf, sources: doc.sources.map((s) => s.id), warnings: doc.warnings.length, path: OUT } }));
