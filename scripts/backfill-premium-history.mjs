// One check of the tcgcsv price archive. A non-200, including 403, stops.
// No prices are invented and no nightly point is replaced. Run again with
// --retry only after the archive answer changes. This script does not start
// the nightly job.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideArchiveStop } from "./lib/premium-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOG = join(ROOT, "data/history/tcgcsv-archive-terms.json");
const URL = "https://tcgcsv.com/archive/tcgplayer/prices-2024-02-08.ppmd.7z";

const readJson = async (file) => { try { return JSON.parse(await readFile(file, "utf8")); } catch { return null; } };

const prior = await readJson(LOG);
if (prior?.stopped && !process.argv.includes("--retry")) {
  console.log(`premium history: archive status ${prior.status} on ${prior.checked}, stopped, no prices written`);
  process.exit(0);
}

const checked = new Date().toISOString();
let status = 0;
let note = "";
try {
  const res = await fetch(URL, {
    headers: { "user-agent": "CatchEm/1.0 (catchemtcg.com)" },
    signal: AbortSignal.timeout(20000),
  });
  status = res.status;
  note = (await res.text()).replace(/\s+/g, " ").slice(0, 500);
} catch (err) {
  status = 0;
  note = String(err?.message || err);
}
const log = {
  checked,
  robots: "https://tcgcsv.com/robots.txt",
  robotsAllows: true,
  terms: "https://tcgcsv.com/docs",
  archiveUrl: URL,
  status,
  stopped: decideArchiveStop(status),
  note,
};
await mkdir(dirname(LOG), { recursive: true });
await writeFile(LOG, JSON.stringify(log, null, 1) + "\n");
if (log.stopped) {
  console.log(`premium history: archive status ${status}, stopped, no prices written`);
  process.exit(0);
}
console.log("premium history: archive returned 200. No extractor ran in this step, no prices written.");
