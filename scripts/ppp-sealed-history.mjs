// Fill short sealed price histories from the PkmnPrices history lane.
// Cap: config/ppp-budget.json lanes.history (500 credits per UTC day), shared
// with the ledger in ppp-raw-private/ledger.json. Never spends another lane.
//
//   node scripts/ppp-sealed-history.mjs
// No key: writes the progress counter and exits 0. No request is sent.
// Raw rows go to ppp-raw-private/history/. The public file is counts only.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadBudget, laneMeter, ledgerFor } from "./lib/ppp-budget.mjs";
import { pppClient, loadKey, redactKey } from "./lib/ppp-client.mjs";
import { loadFillMap } from "./lib/fill-history.mjs";
import { loadProducts, RAW } from "./ppp-enrich.mjs";
import { queueSealed, pullLimit, chartPoints, progressDoc } from "./lib/ppp-sealed-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROGRESS = join(ROOT, "data/ppp/sealed-history-progress.json");
const FILL_OUT = join(ROOT, "data/backfill/pkmnprices/sealed.json");

async function readJson(p, fallback) {
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return fallback; }
}
async function writeJson(p, v) {
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, `${JSON.stringify(v, null, 2)}\n`);
}

const bucketOf = (pid) => String(Number(pid) % 100).padStart(2, "0");

async function listingWatch(root) {
  const doc = await readJson(join(root, "data/derived/listing-counts/latest.json"), { rows: {} });
  const out = new Map();
  for (const row of Object.values(doc.rows || {})) {
    const m = String(row?.id || "").match(/^tcgcsv-(\d+)$/);
    if (!m || row.kind !== "sealed") continue;
    out.set(Number(m[1]), { tier: row.tier || "tail", listingsCounted: Number(row.listingsCounted) || 0 });
  }
  return out;
}

async function ownDayCounts(root) {
  const dir = join(root, "data/history/tcgplayer-market");
  const days = new Map();
  const points = new Map();
  let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith(".json")); } catch { files = []; }
  for (const file of files) {
    if (["mapping.json", "coverage.json", "unmatched.json", "no-tcg-listing.json", "removed-not-real.json"].includes(file)) continue;
    const doc = await readJson(join(dir, file), null);
    const pid = Number(doc?.tcgplayerProductId);
    if (!pid || !Array.isArray(doc.points)) continue;
    const rows = [];
    for (const pt of doc.points) {
      const day = String(pt?.date || "").slice(0, 10);
      const price = Number(pt?.market);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(price > 0)) continue;
      if (pt?.source && !/tcgcsv|tcgplayer market/i.test(String(pt.source))) continue;
      rows.push([day, price]);
    }
    if (!rows.length) continue;
    days.set(pid, rows.length);
    points.set(pid, rows);
  }
  return { days, points };
}

async function haveHistory(rawDir) {
  const ids = new Set();
  const dir = join(rawDir, "history");
  let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith(".json")); } catch { files = []; }
  for (const file of files) {
    const doc = await readJson(join(dir, file), {});
    for (const pid of Object.keys(doc)) ids.add(Number(pid));
  }
  return ids;
}

export async function runSealedHistory({ root = ROOT, rawDir = RAW, client = null, now = Date.now(), log = console.log, budget = loadBudget() } = {}) {
  const asOf = new Date(now).toISOString().slice(0, 10);
  const cap = Number(budget.lanes?.history?.cap) || 0;
  const ledgerPath = join(rawDir, "ledger.json");
  const ledger = ledgerFor(await readJson(ledgerPath, null), asOf);
  const spentBefore = Number(ledger.lanes?.history) || 0;
  const meter = laneMeter("history", budget, spentBefore, { stopped: ledger.stopped?.history || null });
  const products = await loadProducts(root);
  const map = await readJson(join(rawDir, "id-map.json"), { sealed: {} });
  const watch = await listingWatch(root);
  const own = await ownDayCounts(root);
  let filled = new Set();
  try {
    const fills = loadFillMap(root, { keys: ["pokeviz"] });
    filled = new Set(fills.keys());
  } catch { filled = new Set(); }
  const doneIds = await haveHistory(rawDir);
  const annotated = products.filter((p) => p.kind === "sealed").map((p) => ({
    ...p,
    pppId: map.sealed?.[p.pid] || map.sealed?.[String(p.pid)] || null,
    ...(watch.get(p.pid) || { tier: "tail", listingsCounted: 0 }),
  }));
  const queue = queueSealed(annotated, { filled, haveHistory: doneIds, ownDays: own.days });
  const counts = { done: 0, verified: 0, held: 0, skipped: 0 };
  const fillItems = [];
  const existingFill = await readJson(FILL_OUT, { items: [] });
  for (const item of existingFill.items || []) fillItems.push(item);

  const writeProgress = async (status, reason) => {
    const doc = progressDoc({
      asOf,
      cap,
      spentBefore,
      spentThisRun: meter.spent - spentBefore,
      queued: queue.length,
      done: counts.done,
      verified: counts.verified,
      held: counts.held,
      skipped: counts.skipped,
      shown: 0,
      status,
      reason,
    });
    doc.updatedAt = new Date(now).toISOString();
    await writeJson(PROGRESS, doc);
    return doc;
  };

  if (!client) {
    const doc = await writeProgress("skipped", "PKMNPRICES_API_KEY is not set. No request was sent.");
    log(`ppp-sealed-history skipped. queued=${queue.length} historySpentToday=${spentBefore}`);
    return doc;
  }
  if (meter.stopped) {
    const doc = await writeProgress("stopped", "history lane already stopped for this UTC day");
    log("ppp-sealed-history stopped for this UTC day");
    return doc;
  }

  const shards = new Map();
  const shard = async (pid) => {
    const b = bucketOf(pid);
    if (!shards.has(b)) shards.set(b, await readJson(join(rawDir, "history", `${b}.json`), {}));
    return shards.get(b);
  };

  for (const p of queue) {
    const limit = pullLimit(meter);
    if (!limit) { counts.skipped++; break; }
    const r = await client.get(`/v1/sealed/${p.pppId}/prices/history`, { period: "365d", limit, currency: "usd" }, meter, { expect: limit });
    if (r.daily || r.budget) { counts.skipped++; break; }
    if (!r.ok) { counts.held++; continue; }
    const rows = r.body?.data || [];
    const s = await shard(p.pid);
    s[p.pid] = { at: new Date(now).toISOString(), rows, pages: r.body?.pagination?.total_pages || 1, limit };
    counts.done++;
    const ownPoints = own.points.get(p.pid) || [];
    const gate = chartPoints(rows, ownPoints);
    if (gate.show) {
      counts.verified++;
      fillItems.push({ pid: p.pid, points: gate.points, verifiedOverlap: gate.overlap });
    } else {
      counts.held++;
    }
    ledger.lanes.history = meter.spent;
    if (meter.stopped) (ledger.stopped ||= {}).history = { ...meter.stopped, at: new Date(now).toISOString() };
    await writeJson(ledgerPath, ledger);
    for (const [b, v] of shards) await writeJson(join(rawDir, "history", `${b}.json`), v);
    if (meter.stopped) break;
  }

  if (fillItems.length) {
    await writeJson(FILL_OUT, {
      source: "PkmnPrices sealed history, TCGplayer USD, unopened",
      sourceKey: "pkmnprices",
      chartFill: false,
      note: "Held. An overlap sample matched our own days. chartFill in config/fill-sources.json stays false until that file is turned on.",
      items: fillItems,
    });
  }
  const status = meter.stopped ? "stopped" : "ok";
  const reason = meter.stopped ? "a history call charged more than its row limit" : "";
  const doc = await writeProgress(status, reason);
  log(JSON.stringify({ queued: queue.length, done: counts.done, verified: counts.verified, held: counts.held, credits: doc.spentThisRun }));
  return doc;
}

async function main() {
  const budget = loadBudget();
  const key = loadKey();
  let client = null;
  if (key) client = pppClient({ key, minGapMs: budget.minGapMs, log: (s) => console.log(redactKey(s, key)) });
  try {
    await runSealedHistory({ client, budget });
  } catch (err) {
    console.error(redactKey(err.stack || err.message, key));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
