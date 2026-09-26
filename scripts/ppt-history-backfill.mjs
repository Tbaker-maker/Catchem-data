// scripts/ppt-history-backfill.mjs — ONE-OFF, manual (workflow_dispatch only).
// Pulls up to PPT_DAYS (default 180) of daily sealed price history from
// PokemonPriceTracker for every productId in scripts/ppt-history-backfill-ids.json
// and writes the RAW responses to ppt-history-raw/ for upload as a workflow
// artifact. It commits nothing and touches no data/ file.
//
// Cost: sealed-products with limit=1 + includeHistory = 2 credits per product
// (billed on requested limit). ~180 products ≈ 360 credits of the 20k/day pool.
// A hard CREDIT_CEILING stops the run long before the pool is at risk.
// The API key is read from env and is never printed.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
if (!KEY) { console.error("Missing POKEMONPRICETRACKER_API_KEY"); process.exit(1); }
const DAYS = Number(process.env.PPT_DAYS || 180);
const CREDIT_CEILING = Number(process.env.PPT_CREDIT_CEILING || 1500);
const LIMIT_N = Number(process.env.PPT_MAX_PRODUCTS || 0); // 0 = all
const OUT = "ppt-history-raw";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  for (let a = 0; a < 3; a++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = { nonJson: text.slice(0, 300) }; }
    if (res.status === 429) {
      if (body.limitType === "daily") return { status: 429, body, fatal: true };
      await sleep(15000); continue;
    }
    if (res.status >= 500) { await sleep(5000); continue; }
    return { status: res.status, body };
  }
  return { status: 0, body: { error: "retries exhausted" } };
}

const cfg = JSON.parse(await readFile("scripts/ppt-history-backfill-ids.json", "utf-8"));
let products = cfg.products;
if (LIMIT_N > 0) products = products.slice(0, LIMIT_N);
await mkdir(OUT, { recursive: true });
let spent = 0, ok = 0, miss = 0, err = 0;
const summary = [];
for (const p of products) {
  if (spent + 2 > CREDIT_CEILING) { console.log(`stop: credit ceiling ${CREDIT_CEILING} reached`); break; }
  await sleep(1500); // well under 60 calls/min
  const url = `${BASE}/sealed-products?tcgPlayerId=${encodeURIComponent(p.tcgPlayerId)}&limit=1&includeHistory=true&days=${DAYS}&maxDataPoints=${DAYS}`;
  const r = await get(url);
  const used = r.body?.metadata?.apiCallsConsumed?.total ?? 0;
  spent += used;
  await writeFile(`${OUT}/${p.tcgPlayerId}.json`, JSON.stringify({ request: { tcgPlayerId: p.tcgPlayerId, keys: p.keys, days: DAYS }, status: r.status, response: r.body }) + "\n");
  const hit = (r.body?.data || []).find(d => String(d.tcgPlayerId) === String(p.tcgPlayerId));
  const hist = hit ? (hit.priceHistory || hit.history || null) : null;
  const n = Array.isArray(hist) ? hist.length : (hist && typeof hist === "object" ? JSON.stringify(hist).length : 0);
  if (r.status === 200 && hit) ok++; else if (r.status === 200) miss++; else err++;
  summary.push({ tcgPlayerId: p.tcgPlayerId, keys: p.keys, status: r.status, hit: !!hit, credits: used, historyWindow: r.body?.metadata?.historyWindow || null });
  console.log(`${p.tcgPlayerId.padStart(7)} ${String(r.status)} hit=${!!hit} credits=${used} histSize=${n} total=${spent}`);
  if (r.fatal) { console.log("daily cap reached — stopping"); break; }
}
await writeFile(`${OUT}/_summary.json`, JSON.stringify({ ranAt: new Date().toISOString(), days: DAYS, creditsSpent: spent, ok, miss, err, products: summary }, null, 1) + "\n");
console.log(`done: ok=${ok} miss=${miss} err=${err} credits=${spent}`);
