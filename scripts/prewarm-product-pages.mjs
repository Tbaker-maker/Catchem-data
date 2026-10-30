#!/usr/bin/env node
// Pace GET /p/{id} so the edge cache is warm after a public-data publish.
// One GitHub job is killed at six hours. On Oct 28 and Oct 29 that happened
// at 7400 of 31021 pages. Work is sliced into batches that finish well under
// that cap, skip ids already warm for this data version, and back off on 503.
//
//   node scripts/prewarm-product-pages.mjs --plan --out prewarm-state --state prewarm-state/warm.json
//   node scripts/prewarm-product-pages.mjs --batch 0 --batch-size 169 --ids prewarm-state/ids.json --state prewarm-state/warm.json --report prewarm-state/batch-0.json
//   node scripts/prewarm-product-pages.mjs --join prewarm-state --reports prewarm-state/reports
//
// Env: PREWARM_KIND, PREWARM_SLEEP, PREWARM_LIMIT, PREWARM_FRESH, PREWARM_MAX_BATCHES. Origin comes from flag("site").
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

export const GITHUB_JOB_LIMIT_MS = 6 * 60 * 60 * 1000;
export const JOB_TIMEOUT_MIN = 90;
export const BATCH_TIME_CAP_MS = 60 * 60 * 1000;
export const BATCH_BUDGET_MS = 50 * 60 * 1000;
export const MAX_JOBS = 240;
export const DEFAULT_SLEEP_MS = 1200;
export const REQUEST_TIMEOUT_MS = 20000;
export const MAX_GAP_MS = 15000;
export const SKIP_GAP_MS = 400;
export const USER_AGENT = "catchem-prewarm-html/2";

const SEARCH_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/public-data/research/assets/public/search-lite.json";

export function politeSleepMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SLEEP_MS;
  return Math.min(MAX_GAP_MS, Math.max(250, Math.round(n)));
}

export function skipGapMs(sleepMs) {
  return Math.min(politeSleepMs(sleepMs), SKIP_GAP_MS);
}

export function batchSizeFor(count, sleepMs = DEFAULT_SLEEP_MS) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return 1;
  const slow = REQUEST_TIMEOUT_MS + politeSleepMs(sleepMs);
  const maxByTime = Math.max(1, Math.floor(BATCH_TIME_CAP_MS / slow));
  const minToFit = Math.ceil(n / MAX_JOBS);
  if (minToFit > maxByTime) return maxByTime;
  return Math.min(maxByTime, n);
}

export function worstCaseMs(batchSize, sleepMs = DEFAULT_SLEEP_MS) {
  return batchSize * (REQUEST_TIMEOUT_MS + politeSleepMs(sleepMs));
}

export function selectIds(rows, { kind = "all", limit = Infinity } = {}) {
  if (!Array.isArray(rows)) throw new Error("search-lite shape");
  const want = kind === "sealed" || kind === "single" ? kind : "all";
  const cap = Number.isFinite(limit) ? limit : Infinity;
  const ids = [];
  const seen = new Set();
  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || !row[0].startsWith("tcgcsv-")) continue;
    if (want !== "all" && row[5] !== want) continue;
    if (seen.has(row[0])) continue;
    seen.add(row[0]);
    ids.push(row[0]);
    if (ids.length >= cap) break;
  }
  return ids;
}

export function sliceFor(ids, batchIndex, batchSize) {
  const size = Math.max(1, Number(batchSize) || 1);
  const start = Math.max(0, Number(batchIndex) || 0) * size;
  return (ids || []).slice(start, start + size);
}

export function parseWarm(raw, version) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(version || "")) ? String(version) : "";
  if (!day) return { version: "", ids: [] };
  const ids = [];
  const seen = new Set();
  const list = raw && !Array.isArray(raw) && raw.version === day && Array.isArray(raw.ids) ? raw.ids : [];
  for (const id of list) {
    if (typeof id !== "string" || !id.startsWith("tcgcsv-") || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { version: day, ids };
}

export function pendingIds(ids, warm) {
  const known = warm instanceof Set ? warm : new Set(warm || []);
  return (ids || []).filter((id) => !known.has(id));
}

export function workBatches(ids, warm, batchSize, maxJobs = MAX_JOBS) {
  const known = warm instanceof Set ? warm : new Set(warm || []);
  const size = Math.max(1, Number(batchSize) || 1);
  const all = [];
  const n = Math.ceil((ids || []).length / size);
  for (let i = 0; i < n; i += 1) {
    const slice = ids.slice(i * size, i * size + size);
    if (slice.some((id) => !known.has(id))) all.push(i);
  }
  const cap = Math.max(0, Number(maxJobs) || 0);
  return {
    indexes: all.slice(0, cap),
    remaining: Math.max(0, all.length - cap),
    total: all.length,
  };
}

export function nextGap(gap, sleepMs, code, header) {
  const base = politeSleepMs(sleepMs);
  const cur = Number.isFinite(Number(gap)) ? Number(gap) : base;
  if (code === 503 || code === 0) return Math.min(Math.max(cur, base) * 2, MAX_GAP_MS);
  if (header === "hit") return skipGapMs(base);
  return Math.max(base, Math.floor(cur * 0.9));
}

export function mergeWarm(prev, reports, version) {
  const base = parseWarm(prev && prev.version ? prev : { version, ids: prev && prev.ids }, version);
  const seen = new Set(base.ids);
  const ids = base.ids.slice();
  for (const report of reports || []) {
    for (const id of (report && report.warmIds) || []) {
      if (typeof id !== "string" || !id.startsWith("tcgcsv-") || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return { version: base.version, ids };
}

export function formatBatchReport(report) {
  const r = report || {};
  return `BATCH ${r.index} runtime_ms=${r.runtimeMs} requested=${r.requested} skipped_warm=${r.skippedWarm} ok=${r.ok} skip_header=${r.skipHeader} err=${r.err}`;
}

function cacheMark(res) {
  const edge = String(res?.headers?.get?.("x-edge-cache") || "");
  const pre = String(res?.headers?.get?.("x-prewarm") || "");
  if (edge === "hit" || pre === "html-skip" || pre === "hit") return "hit";
  return "";
}

export async function readDataVersion(origin, fetchImpl = globalThis.fetch) {
  const base = String(origin || "https://catchemtcg.com").replace(/\/$/, "");
  try {
    const res = await fetchImpl(`${base}/`, {
      method: "HEAD",
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const version = String(res.headers?.get?.("x-data-version") || "").trim();
    if (res.body?.cancel) { try { await res.body.cancel(); } catch { /* ignore */ } }
    return /^\d{4}-\d{2}-\d{2}$/.test(version) ? version : "";
  } catch {
    return "";
  }
}

export async function runBatch({
  ids,
  batchIndex = 0,
  warm,
  sleepMs = DEFAULT_SLEEP_MS,
  budgetMs = BATCH_BUDGET_MS,
  origin = "https://catchemtcg.com",
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
} = {}) {
  const known = warm instanceof Set ? new Set(warm) : new Set(warm || []);
  const added = [];
  const base = String(origin || "https://catchemtcg.com").replace(/\/$/, "");
  const gap0 = politeSleepMs(sleepMs);
  const pending = pendingIds(ids || [], known);
  const skippedWarm = (ids || []).length - pending.length;
  const t0 = now();
  let gap = gap0;
  let requested = 0;
  let ok = 0;
  let skipHeader = 0;
  let err = 0;
  let n503 = 0;
  let stoppedEarly = false;

  for (let i = 0; i < pending.length; i += 1) {
    if (now() - t0 >= budgetMs) {
      stoppedEarly = true;
      break;
    }
    const id = pending[i];
    let code = 0;
    let header = "";
    try {
      const res = await fetchImpl(`${base}/p/${encodeURIComponent(id)}`, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      code = Number(res.status) || 0;
      header = cacheMark(res);
      if (res.arrayBuffer) await res.arrayBuffer();
      else if (res.text) await res.text();
      if (code === 200 && header === "hit") {
        skipHeader += 1;
        known.add(id);
        added.push(id);
      } else if (code === 200) {
        ok += 1;
        known.add(id);
        added.push(id);
      } else if (code === 503) {
        n503 += 1;
        err += 1;
      } else {
        err += 1;
      }
    } catch {
      code = 0;
      err += 1;
    }
    requested += 1;
    gap = nextGap(gap, gap0, code, header);
    if (requested === 1 || requested % 25 === 0) {
      console.log(formatBatchReport({
        index: batchIndex,
        runtimeMs: Math.max(0, now() - t0),
        requested,
        skippedWarm,
        ok,
        skipHeader,
        err,
      }));
    }
    if (now() - t0 < budgetMs) await sleepImpl(gap);
  }

  return {
    index: batchIndex,
    runtimeMs: Math.max(0, now() - t0),
    requested,
    skippedWarm,
    ok,
    skipHeader,
    err,
    n503,
    stoppedEarly,
    warmIds: added,
  };
}

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  if (v == null || v.startsWith("--")) return true;
  return v;
}
function envOr(name, fallback) {
  const v = process.env[name];
  return v == null || v === "" ? fallback : v;
}
function kindOf() {
  const raw = String(opt("--kind", envOr("PREWARM_KIND", "all")) || "all");
  return raw === "sealed" || raw === "single" ? raw : "all";
}
function limitOf() {
  const raw = opt("--limit", envOr("PREWARM_LIMIT", "0"));
  if (raw === true || raw === "0" || raw === "" || args.includes("--all")) return Infinity;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
}
function freshOf() {
  const raw = String(opt("--fresh", envOr("PREWARM_FRESH", "false")) || "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
function maxBatchesOf() {
  const raw = opt("--max-batches", envOr("PREWARM_MAX_BATCHES", "0"));
  const n = Number(raw === true ? 0 : raw);
  if (!Number.isFinite(n) || n <= 0) return MAX_JOBS;
  return Math.min(MAX_JOBS, Math.floor(n));
}
function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}
function githubOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(file, `${name}=${value}\n`);
}
function githubSummary(text) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  appendFileSync(file, text.endsWith("\n") ? text : `${text}\n`);
}
async function originOf() {
  try {
    const { flag } = await import("./flags.mjs");
    return String(flag("site") || "https://catchemtcg.com").replace(/\/$/, "");
  } catch {
    return "https://catchemtcg.com";
  }
}
async function loadRows() {
  const res = await fetch(SEARCH_URL, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`search-lite ${res.status}`);
  return res.json();
}
async function loadIds(path) {
  if (path && path !== true) {
    const data = readJson(path, null);
    if (!Array.isArray(data)) throw new Error("ids file shape");
    return data.filter((id) => typeof id === "string");
  }
  return selectIds(await loadRows(), { kind: kindOf(), limit: limitOf() });
}
function loadWarmFile(path) {
  if (!path || path === true) return null;
  return readJson(path, null);
}

async function planMain() {
  const out = String(opt("--out", "prewarm-state"));
  const statePath = String(opt("--state", join(out, "warm.json")));
  const sleepMs = politeSleepMs(opt("--sleep-ms", envOr("PREWARM_SLEEP", DEFAULT_SLEEP_MS)));
  const origin = await originOf();
  const version = await readDataVersion(origin);
  const ids = await loadIds(opt("--ids", ""));
  const fresh = freshOf();
  const stored = fresh ? null : loadWarmFile(statePath);
  const warm = parseWarm(stored, version);
  const batchSize = batchSizeFor(ids.length, sleepMs);
  const planned = workBatches(ids, new Set(warm.ids), batchSize, maxBatchesOf());
  mkdirSync(out, { recursive: true });
  writeJson(join(out, "ids.json"), ids);
  writeJson(join(out, "warm.json"), warm);
  writeJson(join(out, "meta.json"), {
    version,
    batchSize,
    sleepMs,
    kind: kindOf(),
    indexes: planned.indexes,
    remaining: planned.remaining,
    total: planned.total,
    ids: ids.length,
    warm: warm.ids.length,
  });
  githubOutput("batches", JSON.stringify(planned.indexes));
  githubOutput("batch_size", String(batchSize));
  githubOutput("sleep_ms", String(sleepMs));
  githubOutput("version", version);
  console.log(`plan version=${version || "unknown"} ids=${ids.length} warm=${warm.ids.length} batchSize=${batchSize} jobs=${planned.indexes.length} later=${planned.remaining} sleepMs=${sleepMs}`);
}

async function warmMain() {
  const batchIndex = Number(opt("--batch", "0"));
  const sleepMs = politeSleepMs(opt("--sleep-ms", envOr("PREWARM_SLEEP", DEFAULT_SLEEP_MS)));
  const ids = await loadIds(opt("--ids", ""));
  const batchSize = Number(opt("--batch-size", batchSizeFor(ids.length, sleepMs))) || batchSizeFor(ids.length, sleepMs);
  const fresh = freshOf();
  const statePath = opt("--state", "");
  const origin = await originOf();
  const version = await readDataVersion(origin);
  const stored = fresh || !statePath || statePath === true ? null : loadWarmFile(String(statePath));
  const warm = parseWarm(stored, version);
  const slice = sliceFor(ids, batchIndex, batchSize);
  const budgetRaw = Number(opt("--budget-ms", BATCH_BUDGET_MS));
  const report = await runBatch({
    ids: slice,
    batchIndex,
    warm: warm.ids,
    sleepMs,
    budgetMs: Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : BATCH_BUDGET_MS,
    origin,
  });
  const line = formatBatchReport(report);
  console.log(line);
  if (report.stoppedEarly) console.log(`BATCH ${batchIndex} stopped inside the time budget; the rest stays for the next run`);
  const reportPath = opt("--report", "");
  if (reportPath && reportPath !== true) writeJson(String(reportPath), report);
  if (statePath && statePath !== true) writeJson(String(statePath), mergeWarm(warm, [report], version));
  githubOutput("version", version);
  githubSummary(line);
  if (report.requested > 0 && report.n503 / report.requested > 0.02) process.exitCode = 1;
}

function listJson(dir, out = []) {
  let names = [];
  try { names = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const ent of names) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) listJson(path, out);
    else if (ent.name.endsWith(".json") && ent.name !== "warm.json" && ent.name !== "ids.json" && ent.name !== "meta.json") out.push(path);
  }
  return out;
}

function joinMain() {
  const dir = String(opt("--join", "prewarm-state"));
  const meta = readJson(join(dir, "meta.json"), {});
  const version = typeof meta.version === "string" ? meta.version : "";
  const prev = parseWarm(loadWarmFile(join(dir, "warm.json")), version);
  const reportsDir = opt("--reports", join(dir, "reports"));
  const reports = [];
  for (const path of listJson(String(reportsDir === true ? join(dir, "reports") : reportsDir))) {
    const data = readJson(path, null);
    if (data && typeof data === "object" && !Array.isArray(data) && data.warmIds) reports.push(data);
  }
  reports.sort((a, b) => Number(a.index) - Number(b.index));
  const lines = reports.map(formatBatchReport);
  for (const line of lines) console.log(line);
  const warm = mergeWarm(prev, reports, version);
  writeJson(join(dir, "warm.json"), warm);
  const totalMs = reports.reduce((sum, r) => sum + (Number(r.runtimeMs) || 0), 0);
  const summary = `join batches=${reports.length} runtime_ms=${totalMs} warm=${warm.ids.length} version=${version || "unknown"}`;
  console.log(summary);
  githubSummary(`${lines.join("\n")}\n${summary}\n`);
}

async function main() {
  if (args.includes("--plan")) return planMain();
  if (args.includes("--join")) return joinMain();
  if (args.includes("--batch")) return warmMain();
  console.error("Use --plan, --batch N, or --join DIR");
  process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  });
}
