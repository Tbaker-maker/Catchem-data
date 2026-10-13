// Earlier sealed price history from pokevizinvestor.com (public fan site, TCGplayer market data).
// Approved by Tyler 2026-10-12 after an accuracy check (median diff 0.0% vs our tcgcsv days).
// Polite reading: robots re-checked first, 1 request every 3 seconds, honest user-agent,
// no login. Any 403, 429 or block page stops the whole run and keeps the last good file.
// Writes data/backfill/pokeviz/raw.json. Merging happens in scripts/lib/fill-history.mjs,
// which only adds days before our own first tcgcsv day for each product.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "https://pokevizinvestor.com";
const UA = "CatchEm/1.0 (catchemtcg.com; sealed history backfill)";
const GAP_MS = 3000;
const OUT = join(ROOT, "data/backfill/pokeviz/raw.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s || "").toLowerCase().replace(/é/g, "e").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function robotsAllows(text, path) {
  let applies = false, verdict = null, best = -1;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { applies = v === "*" || /catchem/i.test(v); continue; }
    if (!applies || !v) continue;
    if (path.startsWith(v) && v.length > best) { best = v.length; verdict = k === "allow"; }
  }
  return verdict !== false;
}

export function parsePoints(html) {
  for (const m of String(html).matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) {
    const s = m[1];
    if (!s.includes('"Market price"')) continue;
    try {
      const j = JSON.parse(s.trim());
      const row = j.find((x) => x.name === "Market price");
      if (row) return row.points.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && p[1] > 0);
    } catch { /* not the chart block */ }
  }
  return null;
}

export function matchUrls(locs, products) {
  const idx = new Map();
  for (const p of products) {
    if (!p.tcgPlayerId) continue;
    for (const n of [p.tcgplayerName, p.name]) {
      if (!n) continue;
      const k = slug(n);
      if (!idx.has(k)) idx.set(k, new Set());
      idx.get(k).add(String(p.tcgPlayerId));
    }
  }
  const out = [];
  for (const u of locs) {
    if (!/\/sealed\/[^/]+$/.test(u)) continue;
    const ids = idx.get(u.split("/").pop());
    if (ids && ids.size === 1) out.push({ url: u, pid: Number([...ids][0]) });
  }
  return out;
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  if (res.status === 403 || res.status === 429 || /captcha|access denied|cf-chl|attention required/i.test(text.slice(0, 4000))) {
    throw Object.assign(new Error(`blocked ${res.status} ${url}`), { stop: true });
  }
  if (!res.ok) return { status: res.status, text: "" };
  return { status: res.status, text };
}

async function main() {
  const robots = await get(`${HOST}/robots.txt`);
  if (!robotsAllows(robots.text, "/")) throw new Error("robots.txt no longer allows reading. Stopped.");
  await sleep(GAP_MS);
  const sm = await get(`${HOST}/sitemap.xml`);
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const products = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
  const targets = matchUrls(locs, products).filter((t) => robotsAllows(robots.text, new URL(t.url).pathname));
  const limit = Number(process.env.POKEVIZ_LIMIT || 0);
  const list = limit ? targets.slice(0, limit) : targets;
  const fetchedAt = new Date().toISOString();
  const items = [];
  let missing = 0;
  for (const t of list) {
    await sleep(GAP_MS);
    let r;
    try { r = await get(t.url); }
    catch (err) {
      if (err.stop) throw err;
      // A timeout or network error is not a block: wait, try once more, then skip the page.
      await sleep(30000);
      try { r = await get(t.url); } catch (err2) { if (err2.stop) throw err2; missing++; continue; }
    }
    const points = r.text ? parsePoints(r.text) : null;
    if (!points?.length) { missing++; continue; }
    items.push({ pid: t.pid, url: t.url, points });
  }
  const doc = {
    source: "pokevizinvestor.com (public fan site, TCGplayer market data)",
    sourceKey: "pokeviz",
    fetchedAt,
    fetchedDate: fetchedAt.slice(0, 10),
    robotsCheckedAt: fetchedAt,
    matched: targets.length,
    read: list.length,
    withHistory: items.length,
    noHistory: missing,
    items,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(doc) + "\n");
  console.log(JSON.stringify({ matched: targets.length, withHistory: items.length, noHistory: missing }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(String(err.message || err)); process.exit(err.stop ? 2 : 1); });
}
