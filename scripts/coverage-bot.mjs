// Weekly counts: priced cards, cards with a year of history, listings counted
// items, and image gaps. A drop is flagged. The file is dated.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flagCoverageDrops } from "./lib/ops-bots.mjs";
import { openPrivate } from "./lib/private-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "data/derived/coverage.json";

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const catalog = await readJson(join(ROOT, "data/catalog/tcgcsv-latest.json"));
const asOf = String(catalog?.asOf || new Date().toISOString()).slice(0, 10);
let priced = 0;
let yearHistory = 0;
const bucketDir = join(ROOT, "research/assets/public/buckets");
for (const file of (await readdir(bucketDir).catch(() => [])).filter((name) => name.endsWith(".json"))) {
  const rows = JSON.parse(await readFile(join(bucketDir, file), "utf8"));
  for (const row of rows || []) {
    if (row?.kind === "sealed") continue;
    if (row?.price > 0) priced += 1;
    const pts = [...(row.hist || []), ...(row.fillHist || [])].map((p) => (Array.isArray(p) ? p[0] : "")).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (pts.length >= 2) {
      const span = (Date.parse(pts.at(-1)) - Date.parse(pts[0])) / 86400000;
      if (span >= 365) yearHistory += 1;
    }
  }
}
const listings = await readJson(join(ROOT, "data/derived/listing-counts/latest.json"));
const listingsCounted = Object.values(listings?.rows || {}).filter((row) => row?.listingsCounted > 0).length;
const gaps = await readJson(join(ROOT, "data/image-gaps.json"));
const picture = await readJson(join(ROOT, "data/catalogue-picture-gaps.json"));
const patternGaps = await readJson(join(ROOT, "data/pattern-image-gaps.json"));
const imageGaps = (Array.isArray(gaps?.pids) ? gaps.pids.length : 0)
  + (Array.isArray(picture?.stillMissing) ? picture.stillMissing.length : 0)
  + (Array.isArray(patternGaps?.cards) ? patternGaps.cards.length : 0);
const prev = await readJson(join(ROOT, OUT));
const counts = { priced, yearHistory, listingsCounted, imageGaps };
const drops = flagCoverageDrops(prev?.counts, counts);
const doc = {
  asOf,
  source: "buckets, listing-counts/latest.json, image gap file",
  counts,
  drops,
  note: "A year of history means the first and last dated point on the card are at least 365 days apart. Image gaps going up is flagged. The other counts are flagged when they fall.",
};
await mkdir(join(ROOT, "data/derived"), { recursive: true });
await writeFile(join(ROOT, OUT), JSON.stringify(doc, null, 1) + "\n");
let store;
try { store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" }); }
catch { store = await openPrivate({ root: ROOT, token: "" }); }
await mkdir(join(store.dir, "coverage"), { recursive: true });
await writeFile(join(store.dir, "coverage/latest.json"), JSON.stringify(doc, null, 1) + "\n");
const pushed = await store.close(["coverage/latest.json"], `coverage ${asOf}`);
console.log(JSON.stringify({ coverage: { asOf, counts, drops, pushed: Boolean(pushed?.pushed), path: OUT } }));
if (drops.length && process.argv.includes("--strict")) process.exit(1);
