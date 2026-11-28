#!/usr/bin/env node
// Prints pathway reads for one night from files on disk, ordered the way the
// board orders them. Private config and the private sealed history are read
// from ../catchem-data-private or PRIVATE_DATA_TOKEN. Writes nothing public.
//   node scripts/sample-pathway-reads.mjs [--n 15] [--json out.json]
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHistoryCards } from "./lib/history-reads.mjs";
import { loadPathways, loadSealedLong, pathwayReads } from "./lib/read-pathways.mjs";
import { loadSealedPathwayItems } from "./lib/pathway-inputs.mjs";
import { spaceFamilies } from "./lib/reads-guard.mjs";
import { revaryPhrasing } from "./lib/read-phrasing.mjs";
import { loadStaleMarket } from "./lib/stale-market.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const cfg = await loadPathways(ROOT);
if (!cfg) { console.log("pathways: no valid private config, nothing to sample"); process.exit(0); }
const { cards } = await loadHistoryCards(ROOT);
const asOf = cards.reduce((m, c) => (c.pts.at(-1)[0] > m ? c.pts.at(-1)[0] : m), "");
const sealed = await loadSealedPathwayItems(ROOT, await loadSealedLong(ROOT));
const reads = spaceFamilies(pathwayReads({ singles: cards, sealed, asOf, cfg, staleMarketRule: await loadStaleMarket(ROOT) }));
const n = Number(arg("--n", 15));
const byPath = {};
for (const r of reads) byPath[r.pathway.version] = (byPath[r.pathway.version] || 0) + 1;
console.log(`pathways ${asOf}: ${reads.length} reads ${JSON.stringify(byPath)} config ${cfg.hash.slice(0, 12)}`);
// --mix: round robin across versions so every pathway shows up in a short sample.
let show = reads;
if (process.argv.includes("--mix")) {
  const lanes = Object.keys(byPath).map((v) => reads.filter((r) => r.pathway.version === v));
  show = [];
  for (let i = 0; lanes.some((l) => i < l.length); i += 1) for (const l of lanes) if (l[i]) show.push(l[i]);
  show = revaryPhrasing(show);
}
for (const r of show.slice(0, n)) {
  console.log(`\n[${r.pathway.version}] ${r.headline}`);
  for (const l of r.lines) console.log(`  - ${l}`);
}
const out = arg("--json", "");
if (out) await writeFile(out, JSON.stringify({ asOf, reads }, null, 1) + "\n");
