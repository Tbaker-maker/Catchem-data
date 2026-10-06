// Adds flagged (outlier) and dive teaser reads from files already on disk.
// Does not invent volume/solds. Does not rebuild lag/group.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBrowse } from "./lib/extra-reads.mjs";
import {
  diveTeaserReads,
  interleaveExtraKinds,
  loadDiveDocsForTeasers,
  loadOutlierDoc,
  outlierReads,
} from "./lib/outlier-dive-reads.mjs";
import { publicRead } from "./build-extra-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));

const extra = await read("research/assets/public/feed/extra-reads.json");
const browseOld = await read("research/assets/public/feed/browse.json");
const catalogue = await read("research/assets/public/feed/catalogue.json");

const outlierDoc = await loadOutlierDoc(ROOT);
const flagged = outlierReads(outlierDoc);
const diveDocs = await loadDiveDocsForTeasers(ROOT, { max: 12 });
const dives = diveTeaserReads(diveDocs);

const keepKinds = new Set(["lag", "group", "supply"]);
const priorReads = (extra.reads || []).filter((r) => keepKinds.has(r.readKind));
extra.reads = [...priorReads, ...flagged, ...dives];
extra.volume = [];
extra.volumeNote = "No sold count is on file, so no volume read ships.";
extra.flagged = { count: flagged.length, source: "data/derived/sealed-price-outliers.json" };
extra.dives = { count: dives.length, source: "research/pulse/dive/" };

const cardIds = Object.keys(catalogue.cards || {});
const ranked = browseOld.ranked || [];
let waves = browseOld.filters?.wave?.items || [];
let newsCount = browseOld.newsCount || 0;
try {
  const news = await read("research/digests/news.json");
  newsCount = (news.filters?.news?.items || []).length || newsCount;
  waves = (news.catalog || []).filter((row) => row && (row.wave || row.reprint));
} catch { /* keep prior */ }

const browse = buildBrowse({
  asOf: extra.asOf || browseOld.asOf || catalogue.asOf,
  cardIds: cardIds.length ? cardIds : (browseOld.unfiltered || []),
  rankedIds: ranked,
  news: new Array(newsCount),
  waves,
  flagged: flagged.map(publicRead),
  dives: dives.map(publicRead),
});

await writeFile(join(ROOT, "research/assets/public/feed/extra-reads.json"), JSON.stringify(extra, null, 1) + "\n");
await writeFile(join(ROOT, "research/assets/public/feed/browse.json"), JSON.stringify(browse) + "\n");

const readsPath = join(ROOT, "research/assets/public/reads.json");
const doc = JSON.parse(await readFile(readsPath, "utf8"));
const drop = new Set(["lag", "group", "supply", "outlier", "dive"]);
const kept = (doc.reads || []).filter((row) => !drop.has(row.readKind));
// Short front: prices + facts stay, then a few flagged and dive teasers.
const frontExtras = [...flagged, ...dives.slice(0, 4)].map(publicRead);
doc.reads = interleaveExtraKinds(kept, frontExtras, { every: 2 });
doc.filterField = "readKind";
await writeFile(readsPath, JSON.stringify(doc, null, 1) + "\n");

console.log(JSON.stringify({
  outliers: flagged.length,
  dives: dives.length,
  waves: waves.length,
  volume: 0,
  lead: doc.reads.length,
  leadKinds: doc.reads.reduce((m, r) => ((m[r.readKind] = (m[r.readKind] || 0) + 1), m), {}),
}));
