#!/usr/bin/env node
// Last check on research/assets/public/reads.json. Runs after the chips are stamped.
// Blocked reads go to data/derived/read-flags/<day>.json and are left out.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { finishBoard } from "./lib/board-mix.mjs";
import { guardChipDoc, guardReads, loadDaily, loadGuard } from "./lib/reads-guard.mjs";
import { writeReadFlags } from "./lib/read-thin-data.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const path = join(ROOT, "research/assets/public/reads.json");
const bundle = JSON.parse(await readFile(path, "utf8"));
const cfg = await loadGuard(ROOT);
if (!cfg) console.warn("reads guard: limits not loaded, the price checks did not run tonight");
const daily = await loadDaily(ROOT);
let heatRows = [];
try { heatRows = JSON.parse(await readFile(join(ROOT, "data/heat-history.json"), "utf8")); } catch { heatRows = []; }
const seen = new Map();
const head = process.env.READS_GUARD_NO_NET === "1" ? null : async (url) => {
  if (seen.has(url)) return seen.get(url);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  try { await res.body?.cancel(); } catch { /* status is enough */ }
  seen.set(url, res.status);
  return res.status;
};
const before = (bundle.reads || []).length;
const { keep, flags, fixes } = await guardReads(bundle.reads || [], { cfg, daily, heatRows, head });
if (flags.length) {
  const wrote = await writeReadFlags(ROOT, bundle.asOf, flags).catch(() => null);
  if (!wrote) {
    console.error("reads guard: flag file not written, no read was dropped");
    process.exit(0);
  }
}
const kept = finishBoard(keep);
bundle.reads = kept;
if (typeof bundle.count === "number") bundle.count = kept.length;
await writeFile(path, `${JSON.stringify(bundle, null, 1)}\n`);
const chipPath = join(ROOT, "research/assets/public/signal-chips.json");
try {
  const chips = JSON.parse(await readFile(chipPath, "utf8"));
  // Every read left out today, by this step or an earlier one, loses its chips.
  let dayFlags = flags;
  try { dayFlags = [...flags, ...(JSON.parse(await readFile(join(ROOT, `data/derived/read-flags/${String(bundle.asOf).slice(0, 10)}.json`), "utf8")).flags || [])]; } catch { /* only tonight's */ }
  await writeFile(chipPath, `${JSON.stringify(guardChipDoc(chips, kept, dayFlags, cfg))}\n`);
} catch { console.warn("reads guard: signal-chips.json not rewritten"); }
console.log(JSON.stringify({ before, after: keep.length, blocked: flags.map((f) => `${f.id}:${f.rule}`), fixes: fixes.length }));
