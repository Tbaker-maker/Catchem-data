// Earlier singles chart history from pokevizinvestor.com card pages (public fan site,
// TCGplayer market data). Approved by Tyler 2026-10-13. Same polite rules as the sealed
// backfill: robots re-checked first, 1 request every 3 seconds, honest user-agent, no login.
// Any 403, 429 or block page stops the run. Resumable: pages already in the output are
// not fetched again; progress is saved every 100 pages.
// Match: the page's TCGplayer product id (sku) and the printing our daily file holds for it.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { robotsAllows } from "./backfill-pokeviz.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "https://pokevizinvestor.com";
const UA = "CatchEm/1.0 (catchemtcg.com; singles history backfill)";
const GAP_MS = 3000;
const OUT = join(ROOT, "data/backfill/pokeviz/singles.json.gz");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseCard(html) {
  const sku = Number((String(html).match(/"sku":"(\d+)"/) || [])[1]) || null;
  let series = [];
  for (const m of String(html).matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!m[1].includes('"points"')) continue;
    try {
      const j = JSON.parse(m[1].trim());
      if (Array.isArray(j) && j.every((x) => x && Array.isArray(x.points))) { series = j; break; }
    } catch { /* not the chart block */ }
  }
  return { sku, series };
}

// Pick the series whose name is our printing for that product. No match, no fill.
export function pickSeries(series, printing) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const s = (series || []).find((x) => norm(x.name) === norm(printing));
  return s ? s.points.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && p[1] > 0) : null;
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  if (res.status === 403 || res.status === 429 || /captcha|access denied|cf-chl|attention required/i.test(text.slice(0, 4000))) {
    throw Object.assign(new Error(`blocked ${res.status} ${url}`), { stop: true });
  }
  return res.ok ? text : "";
}

async function ourPrintings() {
  const dir = join(ROOT, "data/history/tcgcsv-daily");
  const last = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
  const doc = JSON.parse(await readFile(join(dir, last), "utf8"));
  return new Map((doc.prices || []).map((r) => [Number(r.id), r.printing]));
}

async function save(doc) {
  await mkdir(dirname(OUT), { recursive: true });
  // Stored gzipped: the plain file is about 57 MB, the gzip about 8 MB.
  await writeFile(OUT, gzipSync(JSON.stringify(doc) + "\n", { level: 9 }));
}

async function main() {
  const robots = await get(`${HOST}/robots.txt`);
  if (!robotsAllows(robots, "/")) throw new Error("robots.txt no longer allows reading. Stopped.");
  await sleep(GAP_MS);
  const sm = await get(`${HOST}/sitemap.xml`);
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter((u) => /\/cards\/[^/]+$/.test(u) && robotsAllows(robots, new URL(u).pathname));
  const printing = await ourPrintings();
  let doc;
  try { doc = JSON.parse(gunzipSync(await readFile(OUT)).toString("utf8")); } catch { doc = null; }
  if (!doc) doc = { source: "pokevizinvestor.com (public fan site, TCGplayer market data)", sourceKey: "pokeviz-singles", items: [], seen: [], unmatched: 0 };
  const seen = new Set(doc.seen);
  doc.cardPages = urls.length;
  doc.robotsCheckedAt = new Date().toISOString();
  let n = 0;
  for (const url of urls) {
    if (seen.has(url)) continue;
    await sleep(GAP_MS);
    let html = "";
    try { html = await get(url); }
    catch (err) {
      if (err.stop) { await save(doc); throw err; }
      await sleep(30000);
      try { html = await get(url); } catch (err2) { if (err2.stop) { await save(doc); throw err2; } continue; }
    }
    const { sku, series } = parseCard(html);
    const ours = sku ? printing.get(sku) : null;
    const points = ours ? pickSeries(series, ours) : null;
    if (points?.length) doc.items.push({ pid: sku, printing: ours, url, points });
    else doc.unmatched += 1;
    doc.seen.push(url); seen.add(url);
    if (++n % 100 === 0) { doc.fetchedAt = new Date().toISOString(); await save(doc); console.log(JSON.stringify({ read: doc.seen.length, matched: doc.items.length })); }
  }
  doc.fetchedAt = new Date().toISOString();
  doc.fetchedDate = doc.fetchedAt.slice(0, 10);
  doc.complete = doc.seen.length >= urls.length;
  await save(doc);
  console.log(JSON.stringify({ cardPages: urls.length, read: doc.seen.length, matched: doc.items.length, unmatched: doc.unmatched, complete: doc.complete }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(String(err.message || err)); process.exit(err.stop ? 2 : 1); });
}
