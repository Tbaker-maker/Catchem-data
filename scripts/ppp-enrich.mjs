// PkmnPrices Pro enrichment: eBay sold comps, sold comps per day, graded population,
// Cardmarket EUR, and 365-day history (private). Runs after scripts/ppp-refresh.mjs
// (current prices) and shares its credit plan in config/ppp-budget.json.
//
// Raw responses go to ppp-raw-private/ (gitignored, synced to catchem-data-private
// under ppp/). Only derived numbers are written to research/assets/public/market-depth/.
//
//   node scripts/ppp-enrich.mjs            fetch within lane caps, then derive
//   node scripts/ppp-enrich.mjs --derive   derive only (no API calls)
//   PPP_LANES=map,comps  limit lanes;  PPP_SCALE=0.2  run at 20% of each cap
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadBudget, laneMeter, checkBudget, ledgerFor } from "./lib/ppp-budget.mjs";
import { pppClient, loadKey, redactKey } from "./lib/ppp-client.mjs";
import { deriveItem, SOURCE, POP_SOURCE, EUR_SOURCE, SOLD_WINDOW_DAYS } from "./lib/ppp-derive.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const RAW = process.env.PPP_RAW_DIR || join(ROOT, "ppp-raw-private");
export const PUBLIC_DIR = join(ROOT, "research/assets/public/market-depth");
const DAY = 86400000;
const bucketOf = (pid) => String(Number(pid) % 100).padStart(2, "0");

async function readJson(p, fallback) { try { return JSON.parse(await readFile(p, "utf8")); } catch { return fallback; } }
async function writeJson(p, v, pretty = false) { await mkdir(dirname(p), { recursive: true }); await writeFile(p, `${JSON.stringify(v, null, pretty ? 1 : 0)}\n`); }

// Products we carry, from the public buckets: tcgcsv-<pid>, kind, name, current market.
export async function loadProducts(root = ROOT) {
  const dir = join(root, "research/assets/public/buckets");
  const out = [];
  for (const f of (await readdir(dir)).filter((n) => /^\d\d\.json$/.test(n))) {
    const rows = JSON.parse(await readFile(join(dir, f), "utf8"));
    for (const r of Array.isArray(rows) ? rows : Object.values(rows)) {
      const pid = Number(r?.pid);
      if (!pid || !/^tcgcsv-\d+$/.test(String(r.id))) continue;
      const prices = [Number(r.price), ...(r.printings || []).map((p) => Number(p?.price))].filter((n) => n > 0);
      out.push({ id: r.id, pid, kind: r.kind === "sealed" ? "sealed" : "single", name: String(r.name || ""), market: prices.length ? Math.max(...prices) : 0 });
    }
  }
  return out;
}

// All sealed first by value, interleaved 1:1 with singles by value, then the rest of the singles.
export function priorityOrder(products) {
  const byValue = (a, b) => b.market - a.market || a.pid - b.pid;
  const sealed = products.filter((p) => p.kind === "sealed" && p.market > 0).sort(byValue);
  const singles = products.filter((p) => p.kind !== "sealed" && p.market > 0).sort(byValue);
  const out = [];
  const n = Math.max(sealed.length, singles.length);
  for (let i = 0; i < n; i++) { if (sealed[i]) out.push(sealed[i]); if (singles[i]) out.push(singles[i]); }
  return out;
}

const fresh = (at, days, now) => at && days > 0 && now - Date.parse(at) < days * DAY;

async function loadShard(kind, b) { return readJson(join(RAW, kind, `${b}.json`), {}); }

export async function runLanes({ client, budget, products, lanes, scale = 1, now = Date.now(), log = console.log }) {
  const map = await readJson(join(RAW, "id-map.json"), { single: {}, sealed: {} });
  map.single ||= {}; map.sealed ||= {};
  const order = priorityOrder(products);
  const shards = new Map();
  const shard = async (kind, b) => { const k = `${kind}/${b}`; if (!shards.has(k)) shards.set(k, await loadShard(kind, b)); return shards.get(k); };
  const day = new Date(now).toISOString().slice(0, 10);
  const ledger = ledgerFor(await readJson(join(RAW, "ledger.json"), null), day);
  const meters = [];
  const meter = (name) => {
    const start = ledger.lanes[name] || 0;
    const m = laneMeter(name, budget, start);
    const cap = Math.floor(m.cap * scale);
    const w = { name, cap, canSpend: (c = 1) => m.spent + c <= cap && m.canSpend(c), charge: m.charge, get spent() { return m.spent - start; }, get total() { return m.spent; } };
    meters.push(w);
    return w;
  };
  const report = {};
  let since = 0;
  // Save every 50 products so a crash never throws away credits already spent.
  const flush = async (force = false) => {
    if (!force && ++since < 50) return;
    since = 0;
    for (const w of meters) ledger.lanes[w.name] = w.total;
    await writeJson(join(RAW, "ledger.json"), ledger);
    for (const [k, v] of shards) await writeJson(join(RAW, `${k}.json`), v);
    await writeJson(join(RAW, "id-map.json"), map);
  };
  const refresh = budget.refreshDays || {};
  const iso = new Date(now).toISOString();

  if (lanes.has("map")) {
    const m = meter("map");
    let done = 0, hits = 0, bulkPages = 0;
    // Bulk first: list pages of 100 (1 credit per item, same as one-by-one, but 100x
    // fewer requests). English sealed by value, then English singles by value.
    const ours = { single: new Set(products.filter((p) => p.kind !== "sealed").map((p) => p.pid)), sealed: new Set(products.filter((p) => p.kind === "sealed").map((p) => p.pid)) };
    map.bulk ||= { sealed: 0, single: 0, sealedDone: false, singleDone: false };
    for (const kind of ["sealed", "single"]) {
      while (!map.bulk[`${kind}Done`] && m.canSpend(100)) {
        const page = map.bulk[kind] + 1;
        const r = await client.get(kind === "sealed" ? "/v1/sealed" : "/v1/cards", { language: kind === "sealed" ? "en" : "English", sort: "price_desc", currency: "usd", per_page: 100, page }, m, { expect: 100 });
        if (r.daily || r.budget || !r.ok) break;
        const rows = r.body?.data || [];
        for (const x of rows) {
          const pid = Number(x.tcg_player_id);
          if (!pid || !ours[kind].has(pid)) continue;
          if (map[kind][pid] && map[kind][pid] !== x.id) map[kind][pid] = null; // two PPP ids for one product: ambiguous
          else if (map[kind][pid] !== null) map[kind][pid] = x.id;
          (map.checkedAt ||= {})[`${kind}:${pid}`] = iso;
        }
        map.bulk[kind] = page;
        bulkPages++;
        if (!rows.length || page >= Number(r.body?.pagination?.total_pages || 0)) map.bulk[`${kind}Done`] = true;
        await flush(true);
      }
    }
    for (const p of order) {
      const known = map[p.kind][p.pid];
      if (known !== undefined && (known || fresh(map.checkedAt?.[`${p.kind}:${p.pid}`], 30, now))) continue;
      if (!m.canSpend(2)) break;
      const r = await client.get(p.kind === "sealed" ? "/v1/sealed" : "/v1/cards", { tcg_player_id: p.pid, per_page: 2 }, m, { expect: 2 });
      if (r.daily || r.budget) break;
      if (!r.ok) continue;
      const rows = (r.body?.data || []).filter((x) => Number(x.tcg_player_id) === p.pid);
      map[p.kind][p.pid] = rows.length === 1 ? rows[0].id : null;
      (map.checkedAt ||= {})[`${p.kind}:${p.pid}`] = iso;
      done++; if (rows.length === 1) hits++;
      await flush();
    }
    report.map = { bulkPages, looked: done, matched: hits, credits: m.spent };
  }

  const mapped = order.filter((p) => map[p.kind][p.pid]);

  if (lanes.has("comps")) {
    const m = meter("comps");
    let done = 0;
    for (const p of mapped) {
      const s = await shard("comps", bucketOf(p.pid));
      if (fresh(s[p.pid]?.at, refresh.comps, now)) continue;
      const gradedToo = p.kind !== "sealed" && p.market >= 20;
      const need = 20 + (gradedToo ? 20 : 0) + (p.kind === "sealed" ? 1 : 0);
      if (!m.canSpend(need)) break;
      const base = p.kind === "sealed" ? `/v1/sealed/${map.sealed[p.pid]}` : `/v1/cards/${map.single[p.pid]}`;
      const raw = await client.get(`${base}/listings/ebay`, { period: `${SOLD_WINDOW_DAYS}d`, limit: 20, ...(p.kind === "sealed" ? {} : { graded: "false" }) }, m, { expect: 20 });
      if (raw.daily || raw.budget) break;
      if (!raw.ok) continue;
      const entry = { at: iso, rows: raw.body?.data || [], more: !!raw.body?.pagination?.has_more };
      if (gradedToo) {
        const g = await client.get(`${base}/listings/ebay`, { period: `${SOLD_WINDOW_DAYS}d`, limit: 20, graded: "true" }, m, { expect: 20 });
        if (g.ok) { entry.gradedRows = g.body?.data || []; entry.gradedMore = !!g.body?.pagination?.has_more; }
      }
      s[p.pid] = entry;
      if (p.kind === "sealed") {
        const d = await client.get(base, {}, m);
        if (d.ok) (await shard("detail", bucketOf(p.pid)))[p.pid] = { at: iso, body: d.body };
      }
      done++;
      await flush();
    }
    report.comps = { products: done, credits: m.spent };
  }

  if (lanes.has("volume")) {
    const m = meter("volume");
    let done = 0;
    for (const p of mapped) {
      if (p.kind === "sealed") continue; // the API has no sealed sales/volume endpoint
      const s = await shard("volume", bucketOf(p.pid));
      if (fresh(s[p.pid]?.at, refresh.volume, now)) continue;
      if (!m.canSpend(200)) break;
      const r = await client.get(`/v1/cards/${map.single[p.pid]}/sales/volume`, { period: `${SOLD_WINDOW_DAYS}d`, limit: 200 }, m, { expect: 200 });
      if (r.daily || r.budget) break;
      if (!r.ok) continue;
      s[p.pid] = { at: iso, rows: r.body?.data || [], more: Number(r.body?.pagination?.total_pages) > 1 };
      done++;
      await flush();
    }
    report.volume = { products: done, credits: m.spent };
  }

  if (lanes.has("pop")) {
    const m = meter("pop");
    let done = 0;
    for (const p of mapped) {
      if (p.kind === "sealed") continue;
      const s = await shard("pop", bucketOf(p.pid));
      if (fresh(s[p.pid]?.at, refresh.pop, now)) continue;
      if (!m.canSpend(2)) break;
      const id = map.single[p.pid];
      const r = await client.get(`/v1/cards/${id}/population`, {}, m);
      if (r.daily || r.budget) break;
      if (!r.ok) continue;
      s[p.pid] = { at: iso, body: r.body };
      const d = await client.get(`/v1/cards/${id}`, { currency: "eur" }, m);
      if (d.ok) (await shard("detail", bucketOf(p.pid)))[p.pid] = { at: iso, body: { prices: d.body?.prices || [] } };
      done++;
      await flush();
    }
    report.pop = { products: done, credits: m.spent };
  }

  if (lanes.has("history")) {
    const m = meter("history");
    let done = 0;
    for (const p of mapped) {
      const s = await shard("history", bucketOf(p.pid));
      if (s[p.pid]) continue; // one 365-day backfill per product; incremental later
      const base = p.kind === "sealed" ? `/v1/sealed/${map.sealed[p.pid]}` : `/v1/cards/${map.single[p.pid]}`;
      const params = p.kind === "sealed" ? { period: "365d", limit: 365, currency: "usd" } : { period: "365d", limit: 365, currency: "usd", condition: "Near Mint" };
      if (!m.canSpend(365)) break;
      const r = await client.get(`${base}/prices/history`, params, m, { expect: 365 });
      if (r.daily || r.budget) break;
      if (!r.ok) continue;
      s[p.pid] = { at: iso, rows: r.body?.data || [], pages: r.body?.pagination?.total_pages || 1 };
      done++;
      await flush();
    }
    report.history = { products: done, credits: m.spent };
  }

  await flush(true);
  return report;
}

// Derived public files: one per pid bucket, keyed by our product id.
export async function deriveAll({ products, asOf, now = Date.now() }) {
  const byBucket = new Map();
  const counts = { items: 0, sold: 0, soldSealed: 0, graded: 0, daily: 0, pop: 0, eur: 0 };
  const shardCache = new Map();
  const get = async (kind, b) => { const k = `${kind}/${b}`; if (!shardCache.has(k)) shardCache.set(k, await loadShard(kind, b)); return shardCache.get(k); };
  for (const p of products) {
    const b = bucketOf(p.pid);
    const raw = {
      comps: (await get("comps", b))[p.pid],
      volume: (await get("volume", b))[p.pid],
      pop: (await get("pop", b))[p.pid],
      detail: (await get("detail", b))[p.pid],
    };
    if (!raw.comps && !raw.volume && !raw.pop && !raw.detail) continue;
    const item = deriveItem(raw, { asOf, kind: p.kind, name: p.name, market: p.market });
    if (!item) continue;
    if (!byBucket.has(b)) byBucket.set(b, {});
    byBucket.get(b)[p.id] = item;
    counts.items++;
    if (item.sold) { counts.sold++; if (p.kind === "sealed") counts.soldSealed++; }
    if (item.graded) counts.graded++;
    if (item.daily) counts.daily++;
    if (item.pop) counts.pop++;
    if (item.eur) counts.eur++;
  }
  await mkdir(PUBLIC_DIR, { recursive: true });
  for (const [b, items] of byBucket) {
    await writeJson(join(PUBLIC_DIR, `${b}.json`), { asOf, source: SOURCE, popSource: POP_SOURCE, eurSource: EUR_SOURCE, items });
  }
  await writeJson(join(PUBLIC_DIR, "meta.json"), {
    asOf,
    builtAt: new Date(now).toISOString(),
    soldWindowDays: SOLD_WINDOW_DAYS,
    sources: { sold: SOURCE, pop: POP_SOURCE, eur: EUR_SOURCE },
    note: "Derived numbers only. Sold = eBay sold comps, raw copies, exact item, half-price/double filter applied. Listings counted elsewhere on the site are active listings, not sales.",
    counts,
    buckets: [...byBucket.keys()].sort(),
  }, true);
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const budget = loadBudget();
  const problems = checkBudget(budget);
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  const products = await loadProducts();
  const asOf = new Date().toISOString().slice(0, 10);
  let report = {};
  if (!process.argv.includes("--derive")) {
    const key = loadKey();
    if (!key) { console.log("PKMNPRICES_API_KEY not set; skipping fetch"); }
    else {
      const client = pppClient({ key, minGapMs: budget.minGapMs, log: (s) => console.log(redactKey(s, key)) });
      const lanes = new Set((process.env.PPP_LANES || "map,comps,volume,pop,history").split(",").map((s) => s.trim()).filter(Boolean));
      const scale = Math.min(1, Math.max(0, Number(process.env.PPP_SCALE || 1)));
      try {
        report = await runLanes({ client, budget, products, lanes, scale });
      } catch (err) { console.error(redactKey(err.stack || err.message, key)); process.exitCode = 1; }
      report.stats = client.stats;
    }
  }
  const counts = await deriveAll({ products, asOf });
  const ledgerPath = join(ROOT, "data/ppp/enrich-report.json");
  await writeJson(ledgerPath, { at: new Date().toISOString(), asOf, lanes: report, derived: counts }, true);
  console.log(JSON.stringify({ lanes: report, derived: counts }));
}
