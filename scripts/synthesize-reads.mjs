#!/usr/bin/env node
// Rewrites each single item read in research/assets/public/reads.json into a
// summary of every signal on file for that item. Runs after the chips are
// stamped and before the reads guard, so the guard checks the new copy.
// Limits and weights come from catchem-data-private. Without them nothing changes.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContext, loadSynth, openingKey, synthesizeReads } from "./lib/read-synthesis.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const path = join(ROOT, "research/assets/public/reads.json");
const bundle = JSON.parse(await readFile(path, "utf8"));
const cfg = await loadSynth(ROOT);
if (!cfg) { console.warn("read synthesis: limits not loaded, reads left as they were"); process.exit(0); }
const ctx = await loadContext(ROOT, String(bundle.asOf).slice(0, 10), cfg);
const { reads, report } = synthesizeReads(bundle.reads || [], ctx, cfg);
bundle.reads = reads;
await writeFile(path, `${JSON.stringify(bundle, null, 1)}\n`);
const open = new Map();
for (const r of reads) { const k = openingKey(r.headline, [r.name]); open.set(k, (open.get(k) || 0) + 1); }
console.log(JSON.stringify({ ...report, topOpenings: [...open].sort((a, b) => b[1] - a[1]).slice(0, 5) }));
