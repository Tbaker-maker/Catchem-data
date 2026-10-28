#!/usr/bin/env node
// Pace GET /p/{id}?prewarm=html so FEED_KV product-html (+ prodrow) fills after publish.
// Covers every product in search-lite (sealed + singles). Backs off on 503/ERR.
// Usage:
//   node scripts/prewarm-product-pages.mjs [--all] [--limit N] [--sleep-ms N] [--kind sealed|single|all]
import { flag } from "./flags.mjs";

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  if (v == null || v.startsWith("--")) return true;
  return v;
}
const all = args.includes("--all") || opt("--limit", "") === "0";
const limit = all ? Infinity : Number(opt("--limit", 0) || 0) || Infinity;
const sleepMs = Number(opt("--sleep-ms", 1200));
const kind = String(opt("--kind", "all") || "all");
const base = String(flag("site") || "https://catchemtcg.com").replace(/\/$/, "");
const FETCH_MS = 120000;

async function sleep(ms) { await new Promise((r) => setTimeout(r, ms)); }

const searchUrl =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/public-data/research/assets/public/search-lite.json";
const rows = await (await fetch(searchUrl, { signal: AbortSignal.timeout(60000) })).json();
if (!Array.isArray(rows)) throw new Error("search-lite shape");
let ids = rows
  .filter((r) => Array.isArray(r) && typeof r[0] === "string" && r[0].startsWith("tcgcsv-"))
  .filter((r) => kind === "all" || r[5] === kind)
  .map((r) => r[0]);
ids = [...new Set(ids)];
if (Number.isFinite(limit)) ids = ids.slice(0, limit);

console.log(`prewarm html origin=${base} kind=${kind} n=${ids.length} sleepMs=${sleepMs}`);

let ok = 0, skip = 0, err = 0, n503 = 0;
let gap = sleepMs;
for (let i = 0; i < ids.length; i += 1) {
  const id = ids[i];
  const t0 = Date.now();
  let code = 0;
  let xp = "";
  try {
    // Plain GET fills the edge Cache API (same key as user hits). ?prewarm=html also
  // seeds prodrow but burns Worker CPU and storms under full-catalog pace.
  const res = await fetch(`${base}/p/${id}`, {
      headers: { "user-agent": "catchem-prewarm-html/2" },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    code = res.status;
    xp = res.headers.get("x-edge-cache") || res.headers.get("x-prewarm") || "";
    await res.arrayBuffer();
    if (code === 200 && xp === "hit") skip += 1;
    else if (code === 200) ok += 1;
    else if (code === 503) { n503 += 1; err += 1; }
    else err += 1;
  } catch {
    code = 0;
    err += 1;
  }
  const dt = Date.now() - t0;
  if ((i + 1) % 25 === 0 || code !== 200 || i < 5 || i === ids.length - 1) {
    console.log(`${i + 1}/${ids.length} ${id} ${code} ${dt}ms x-prewarm=${xp} gap=${gap}`);
  }
  if (code === 503 || code === 0) {
    gap = Math.min(gap * 2, 15000);
    await sleep(gap);
  } else {
    gap = Math.max(sleepMs, Math.floor(gap * 0.9));
    await sleep(gap);
  }
}
console.log(`FINAL ok=${ok} skip=${skip} err=${err} n503=${n503} n=${ids.length}`);
if (n503 > 0 && n503 > ids.length * 0.02) process.exitCode = 1;
