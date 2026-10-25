// node scripts/publish-gate.mjs [--check]   (--check reports only, never writes)
import { readFile, writeFile } from "node:fs/promises";
import { finishBoard } from "./lib/board-mix.mjs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gateReads, RULES, checkMeter, unpublishMeter } from "./lib/publish-gate.mjs";
import { gateSealedPrices } from "./lib/real-listing.mjs";
import { loadReadStability } from "./lib/read-stability.mjs";
import { loadFeedFloor } from "./lib/feed-floor.mjs";
import { leadIds } from "./lib/feed-rank.mjs";
import { applyModelSpec } from "./lib/model-spec.mjs";
import { boosterBoxFlagGap } from "./lib/premium-ratio.mjs";
import { ARCHIVE_SOURCE, backfillUnitJumps, loadSanityBound } from "./lib/premium-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");
const check = process.argv.includes("--check");
const previewOnly = process.argv.includes("--preview-only");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

// Reads page sample lines: drop any that show raw card codes instead of names.
const { RAW_CODE } = await import("./lib/publish-gate.mjs");
const prevPath = join(PUB, "reads-preview.json");
const preview = await J(prevPath, null);
let previewBad = 0;
if (preview?.lines && typeof preview.lines === "object") {
  for (const [k, v] of Object.entries(preview.lines)) if (typeof v === "string" && RAW_CODE.test(v)) { delete preview.lines[k]; previewBad += 1; console.log(`gate drop title reads-preview ${k} (raw card code)`); }
}
if (previewOnly) {
  if (previewBad && !check) await writeFile(prevPath, JSON.stringify(preview, null, 1) + "\n");
  console.log(JSON.stringify({ previewDropped: previewBad }));
  process.exit(0);
}
const readsPath = join(PUB, "reads.json");
const doc = await J(readsPath, { reads: [] });
const chips = (await J(join(PUB, "signal-chips.json"), {}))?.byId || {};
const listings = {};
for (const p of (await J(join(PUB, "listings-counted.json"), {}))?.products || []) if (p?.listingsCounted?.date) listings[p.id] = p.listingsCounted;
const sets = {};
for (const s of (await J(join(PUB, "sets.json"), {}))?.sets || []) if (s?.name && s.release) sets[s.name] = s.release;
let prev = {};
try {
  const old = JSON.parse(execFileSync("git", ["show", `${process.env.GATE_PREV_REF || "HEAD"}:research/assets/public/reads.json`], { cwd: ROOT, maxBuffer: 1 << 28 }).toString());
  for (const r of old.reads || []) prev[r.id] = r;
} catch { prev = {}; }
const facts = (id) => { const p = join(PUB, "feed/facts", `${id}.json`); if (!existsSync(p)) return null; try { return JSON.parse(execFileSync("cat", [p]).toString()); } catch { return null; } };

const asOf = doc.asOf || (doc.reads || []).map((r) => r.asOf).filter(Boolean).sort().pop();
const stability = await loadReadStability(ROOT);
const floor = await loadFeedFloor(ROOT);
const ctx = { chips, listings, sets, prev, facts, asOf, stability, floor };
const { readdir } = await import("node:fs/promises");
const feedFiles = [];
for (const dir of ["today", "up", "down", "watch", "cook", "cool", "heat"]) {
  const d = join(PUB, "feed", dir);
  if (!existsSync(d)) continue;
  for (const f of await readdir(d)) if (f.endsWith(".json")) feedFiles.push(join(d, f));
}
const res = gateReads(doc.reads || [], ctx);
const total = { rows: doc.reads?.length || 0, dropped: res.dropped, counts: { ...res.counts } };
const log = [...res.log];
const writes = [];
for (const f of feedFiles) {
  const rows = await J(f, null);
  if (!Array.isArray(rows)) continue;
  const fr = gateReads(rows, { ...ctx, prev: {} }, { maxDropShare: 1 });
  total.rows += rows.length; total.dropped += fr.dropped;
  for (const k of Object.keys(fr.counts)) total.counts[k] += fr.counts[k];
  log.push(...fr.log.map((l) => ({ ...l, file: f.slice(PUB.length + 1) })));
  if (fr.log.length) writes.push([f, fr.kept]);
}
console.log(JSON.stringify(total));
for (const l of log) console.log(`gate ${l.action} ${l.rule} ${l.id}${l.file ? ` [${l.file}]` : ""}${l.note ? ` (${l.note})` : ""}`);
const systemic = total.rows > 20 && total.dropped / total.rows > 0.25;
const sealedPath = join(ROOT, "data/sealed-prices.json");
const sealedDoc = await J(sealedPath, null);
if (sealedDoc && Array.isArray(sealedDoc.products)) {
  const sealedGate = gateSealedPrices(sealedDoc.products);
  for (const row of sealedGate.log) console.log(`gate drop ${row.rule} ${row.id}${row.dropped != null ? ` (${row.dropped} history points)` : ""}${row.price != null ? ` ($${row.price} vs median $${row.median})` : ""}`);
  if (sealedGate.log.length && !check) {
    sealedDoc.products = sealedGate.products;
    await writeFile(sealedPath, JSON.stringify(sealedDoc, null, 2) + "\n");
    await writeFile(join(ROOT, "data/derived/sealed-ask-gate-log.json"), JSON.stringify({ at: new Date().toISOString(), rules: ["cheapest-under-half", "history-under-0.3"], log: sealedGate.log }, null, 1) + "\n");
  }
}
const meterLoaded = await applyModelSpec({ root: ROOT });
if (meterLoaded.marketMeter) {
  const freshAsOf = String((await J(join(PUB, "counts.json"), {}))?.asOf || "").slice(0, 10);
  for (const meterPath of [join(PUB, "market-meter.json"), join(ROOT, "data/derived/market-meter.json")]) {
    const meter = await J(meterPath, null);
    if (!meter) continue;
    const verdict = checkMeter(meter, { minComponents: meterLoaded.marketMeter.minComponents, freshAsOf });
    if (!verdict.ok) {
      console.log(`gate drop meter ${verdict.reasons.join(",")}`);
      if (!check) await writeFile(meterPath, JSON.stringify(unpublishMeter(meter)));
    }
  }
} else {
  console.log("market meter gate: spec missing, left the public file as it is");
}
const premiumDoc = await J(join(PUB, "premium-ratio.json"), null);
const productList = await J(join(ROOT, "data/sealed-products.json"), null);
if (premiumDoc && Array.isArray(productList)) {
  const boxPids = new Set(productList.filter((row) => row?.subtype === "booster-box" && row.tcgPlayerId).map((row) => String(row.tcgPlayerId)));
  const daysByPid = new Map();
  const archiveIds = new Set();
  const jumpSeries = new Map();
  const notePoint = (id, date, market, archive) => {
    if (!(market > 0) || !id) return;
    if (archive) archiveIds.add(id);
    if (!archive && !archiveIds.has(id)) return;
    if (!jumpSeries.has(id)) jumpSeries.set(id, []);
    jumpSeries.get(id).push({ date, market, archive });
  };
  const dailyDir = join(ROOT, "data/history/tcgcsv-daily");
  const folders = [join(dailyDir, "archive"), dailyDir];
  for (const folder of folders) {
    if (!existsSync(folder)) continue;
    const fromArchive = folder.endsWith("/archive");
    for (const name of await readdir(folder)) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue;
      const day = await J(join(folder, name), null);
      const date = String(day?.date || name.slice(0, 10));
      for (const row of day?.prices || []) {
        const id = String(row?.id || "");
        const market = Number(row?.market);
        if (boxPids.has(id) && market > 0) {
          if (!daysByPid.has(id)) daysByPid.set(id, new Set());
          daysByPid.get(id).add(date);
        }
        const archive = fromArchive || row?.source === ARCHIVE_SOURCE;
        notePoint(id, date, market, archive);
      }
    }
  }
  const dayCount = new Map([...daysByPid].map(([id, set]) => [id, set.size]));
  const gap = boosterBoxFlagGap(premiumDoc, productList, dayCount);
  if (gap.failed) {
    console.error("publish gate: a booster box flag is missing from bySet");
    process.exit(1);
  }
  if (archiveIds.size) {
    const guard = await loadSanityBound(ROOT);
    const jump = backfillUnitJumps(jumpSeries, guard);
    if (jump.failed) {
      console.error(jump.missingBound
        ? "publish gate: a backfilled series is present and the private sanity bound is missing"
        : "publish gate: a backfilled series jumps past the private sanity bound");
      process.exit(1);
    }
  }
}
if (systemic) { console.error(`publish gate: systemic breakage, ${total.dropped} of ${total.rows} rows failed. Not publishing.`); process.exit(1); }
if (!check) {
  if (previewBad) await writeFile(prevPath, JSON.stringify(preview, null, 1) + "\n");
  const board = finishBoard(res.kept);
  await writeFile(readsPath, JSON.stringify({ ...doc, reads: board, count: board.length, gate: { rules: RULES.map(([id]) => id), counts: res.counts, dropped: res.dropped } }, null, 1) + "\n");
  for (const [f, kept] of writes) await writeFile(f, JSON.stringify(kept) + "\n");
  const ids = leadIds(res.kept, floor, 8);
  await writeFile(join(PUB, "feed/lead-order.json"), JSON.stringify({ asOf: asOf || "", ids }, null, 1) + "\n");
}
