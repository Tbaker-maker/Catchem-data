// Long price history for singles from rarebox-price-history (TCGplayer market via the
// tcgcsv daily archive, 2024-02-08 to 2026-09-15). Matched by TCGplayer product id and
// printing. Points are kept as stored: change-only with a 7-day heartbeat. Nothing is
// filled or interpolated. Usage: RAREBOX_DIR=/path/to/clone node scripts/backfill-long-history.mjs
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const RB = process.env.RAREBOX_DIR;
if (!RB) { console.error("set RAREBOX_DIR"); process.exit(1); }
const pub = join(ROOT, "research/assets/public");
const out = join(pub, "hist-long");
await mkdir(out, { recursive: true });

const index = new Map(); // productId -> { file, key }
const groups = JSON.parse(await readFile(join(RB, "maps/groups.json"), "utf8"))["3"] || {};
for (const setKey of new Set(Object.values(groups).filter(Boolean))) {
  let pm = {};
  try { pm = JSON.parse(await readFile(join(RB, "maps/products/pokemon", `${setKey}.json`), "utf8")); } catch { continue; }
  for (const [pid, v] of Object.entries(pm)) if (!v[1]) index.set(Number(pid), { setKey, key: String(v[0]) });
}
const setCache = new Map();
async function setDoc(k) {
  if (!setCache.has(k)) {
    try { setCache.set(k, JSON.parse(await readFile(join(RB, "data/pokemon", `${k}.json`), "utf8"))); } catch { setCache.set(k, null); }
  }
  return setCache.get(k);
}
const day = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
let matched = 0, singles = 0, first = "9999", last = "0000", points = 0;
const files = (await readdir(join(pub, "buckets"))).filter((f) => /^\d\d\.json$/.test(f)).sort();
for (const f of files) {
  const rows = JSON.parse(await readFile(join(pub, "buckets", f), "utf8"));
  const doc = { source: "TCGplayer market via the tcgcsv daily archive (rarebox-price-history)", sourceUrl: "https://github.com/novaoc/rarebox-price-history", note: "Change-only points with a 7-day heartbeat: a day with no point kept the last price. A gap longer than 8 days is a real gap. Prices (c) TCGplayer.", rows: {} };
  for (const r of rows) {
    if (r.kind === "sealed" || !r.pid) continue;
    singles += 1;
    const hit = index.get(Number(r.pid));
    if (!hit) continue;
    const sd = await setDoc(hit.setKey);
    const card = sd?.cards?.[hit.key];
    if (!card) continue;
    const want = String(r.printing || "").toLowerCase();
    const keys = Object.keys(card);
    const pk = keys.find((k) => k === want) || (keys.length === 1 ? keys[0] : "");
    const series = (card[pk] || []).filter((p) => Array.isArray(p) && Number(p[1]) > 0);
    if (series.length < 2) continue;
    matched += 1;
    points += series.length;
    const a = day(series[0][0]), b = day(series.at(-1)[0]);
    if (a < first) first = a;
    if (b > last) last = b;
    doc.rows[r.id] = series.map((p) => `${p[0]}:${p[1]}`).join(",");
  }
  await writeFile(join(out, f), JSON.stringify(doc) + "\n");
}
const summary = { asOf: new Date().toISOString().slice(0, 10), singles, matched, points, first, last, epoch: "day numbers are days since 1970-01-01 UTC" };
await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify(summary));
