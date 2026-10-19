// Private call ledger for run stage calls (Building, Slowing, Stalled, Reversing).
// Reads tonight's public signal-chips.json after the stamp step, logs each new
// stage call with its price and listings counted on the call date, then checks
// every open call on day 7, 14 and 30 against the TCGplayer market on that day
// (or the first priced day up to 3 days later). Nothing public is written.
//   catchem-data-private data/private/stage-calls/ledger.json
//   catchem-data-private data/private/stage-calls/backtest.json (--backtest)
// A call is a hit when the later price is on the called side: dir up means higher
// than the call price, dir down means lower. Stalled calls are logged, not scored.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { runStage } from "./lib/seller-stage.mjs";
import { fullSeries, shift, upTo } from "./lib/ir-sir-watch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
export const HORIZONS = [7, 14, 30];
const r2 = (x) => Math.round(x * 100) / 100;

export function priceOn(pts, day, slack = 3) {
  for (const p of pts) if (p[0] >= day && p[0] <= shift(day, slack)) return p;
  return null;
}
export function priceAtOrBefore(pts, day, tol = 1) {
  let hit = null;
  for (const p of pts) { if (p[0] <= day) hit = p; else break; }
  return hit && hit[0] >= shift(day, -tol) ? hit : null;
}

export function newCalls(chips, ledger, { seriesOf, listingOf, dedupeDays = 7 }) {
  const asOf = chips?.asOf;
  const out = [];
  const recent = new Set((ledger.calls || []).filter((c) => c.date > shift(asOf, -dedupeDays)).map((c) => `${c.sku}|${c.stage}|${c.dir}`));
  const seen = new Set();
  for (const [readId, v] of Object.entries(chips?.byId || {})) {
    const st = v?.tiles?.price?.stage;
    const sku = String(v?.sku || "");
    if (!st || !st.word || !sku || st.date !== asOf) continue;
    const k = `${sku}|${st.word}|${st.dir}`;
    if (recent.has(k) || seen.has(k)) continue;
    seen.add(k);
    const pts = seriesOf(sku) || [];
    const p = priceAtOrBefore(pts, asOf, 1);
    const l = listingOf(sku);
    out.push({
      key: `${k}|${asOf}`, date: asOf, sku, readId, name: v.name || "", stage: st.word, dir: st.dir, days: st.days,
      price: p ? p[1] : null, priceDate: p ? p[0] : null, source: "TCGplayer market",
      listings: l && l.date >= shift(asOf, -1) ? { n: l.listingsCounted, date: l.date, sellers: l.sellers ?? null, top2Share: l.top2Share ?? null } : null,
      outcomes: {}, status: p ? "open" : "no price",
    });
  }
  return out;
}

export function checkOutcomes(calls, { seriesOf, today }) {
  for (const c of calls) {
    if (c.status !== "open" || !(c.price > 0)) continue;
    const pts = seriesOf(c.sku) || [];
    for (const h of HORIZONS) {
      const key = `d${h}`;
      if (c.outcomes[key]) continue;
      const due = shift(c.date, h);
      if (due > today) continue;
      const p = priceOn(pts, due, 3);
      if (!p) { if (shift(due, 3) < today) c.outcomes[key] = { due, missing: true }; continue; }
      const pct = (p[1] / c.price - 1) * 100;
      const hit = c.stage === "Stalled" ? null : c.dir === "up" ? p[1] > c.price : p[1] < c.price;
      c.outcomes[key] = { due, date: p[0], price: p[1], pct: r2(pct), hit };
    }
    if (c.outcomes.d30) c.status = "closed";
  }
  return calls;
}

export function summarize(calls) {
  const groups = {};
  for (const c of calls) {
    const g = (groups[`${c.stage} ${c.dir}`] ||= { logged: 0, open: 0 });
    g.logged += 1;
    if (c.status === "open") g.open += 1;
    for (const h of HORIZONS) {
      const o = c.outcomes?.[`d${h}`];
      if (!o || o.missing || o.hit == null) continue;
      g[`scored${h}`] = (g[`scored${h}`] || 0) + 1;
      g[`hits${h}`] = (g[`hits${h}`] || 0) + (o.hit ? 1 : 0);
    }
    for (const h of HORIZONS) if (g[`scored${h}`]) g[`rate${h}`] = r2(g[`hits${h}`] / g[`scored${h}`]);
  }
  return groups;
}

// History check: replay the run stage on every daily series with the live rules.
export function backtestStages(seriesList, spec, { from, to, step = 7 }) {
  const calls = [];
  for (const { sku, pts } of seriesList) {
    for (let a = from; a <= to; a = shift(a, step)) {
      const st = runStage(upTo(pts, a), a, spec);
      if (!st) continue;
      const p = priceAtOrBefore(pts, a, 1);
      if (!p) continue;
      calls.push({ sku, date: a, stage: st.word, dir: st.dir, price: p[1], outcomes: {}, status: "open" });
    }
  }
  const today = shift(to, 40);
  checkOutcomes(calls, { seriesOf: (s) => seriesList.find((x) => x.sku === s)?.pts, today });
  return summarize(calls);
}

async function loadSeries() {
  const longRows = {};
  for (const f of (await readdir(join(PUB, "hist-long"))).filter((f) => /^\d+\.json$/.test(f))) Object.assign(longRows, (await J(join(PUB, "hist-long", f), {})).rows || {});
  const map = new Map();
  for (const f of (await readdir(join(PUB, "buckets"))).filter((f) => f.endsWith(".json"))) for (const r of (await J(join(PUB, "buckets", f), [])) || []) map.set(r.id, { row: r, long: longRows[r.id] });
  const cache = new Map();
  return (sku) => {
    if (cache.has(sku)) return cache.get(sku);
    const hit = map.get(sku);
    const pts = hit ? fullSeries(hit.row, hit.long) : null;
    cache.set(sku, pts);
    return pts;
  };
}

async function main() {
  const chips = await J(join(PUB, "signal-chips.json"), null);
  if (!chips?.asOf) { console.log("stage calls: no signal-chips.json, nothing logged"); return; }
  const store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" });
  const touched = [];
  try {
    const path = join(store.dir, "stage-calls/ledger.json");
    const ledger = (await J(path, null)) || { calls: [] };
    const seriesOf = await loadSeries();
    const latest = (await J(join(ROOT, "data/derived/listing-counts/latest.json"), {}))?.rows || {};
    const add = newCalls(chips, ledger, { seriesOf, listingOf: (s) => latest[s] || null });
    ledger.calls = [...(ledger.calls || []), ...add];
    checkOutcomes(ledger.calls, { seriesOf, today: chips.asOf });
    ledger.asOf = chips.asOf;
    ledger.private = true;
    ledger.rule = "Each run stage call is stored on its call date with the TCGplayer market that day and eBay listings counted when counted within a day. Day 7, 14 and 30 use that day's market, or the first priced day up to 3 days later. Hit: later price on the called side (dir up higher, dir down lower). Stalled is not scored. One call per product, stage and direction per 7 days.";
    ledger.summary = summarize(ledger.calls);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(ledger, null, 1) + "\n");
    touched.push("stage-calls/ledger.json");
    if (process.argv.includes("--backtest")) {
      const spec = (await J(join(store.dir, "signal-chips/thresholds.json"), {}))?.stage;
      const list = [];
      for (const f of (await readdir(join(PUB, "buckets"))).filter((f) => f.endsWith(".json"))) for (const r of (await J(join(PUB, "buckets", f), [])) || []) if (r.kind === "single" && (r.fillHist || []).length > 60) list.push(r.id);
      const seriesList = list.map((sku) => ({ sku, pts: seriesOf(sku) }));
      const from = "2025-10-15", to = shift(chips.asOf, -31);
      const bt = { asOf: chips.asOf, from, to, step: 7, cards: seriesList.length, note: "Replays the live run stage rules weekly on daily TCGplayer market history. Same hit rule as the ledger. Overlapping windows, so calls are not independent.", stages: backtestStages(seriesList, spec, { from, to, step: 7 }) };
      await writeFile(join(store.dir, "stage-calls/backtest.json"), JSON.stringify(bt, null, 1) + "\n");
      touched.push("stage-calls/backtest.json");
      console.log(`stage calls backtest: ${JSON.stringify(bt.stages)}`);
    }
    const rev = ledger.calls.filter((c) => c.stage === "Reversing" && c.status === "open").length;
    console.log(`stage calls: ${add.length} logged tonight, ${ledger.calls.length} on file, ${rev} open Reversing`);
  } finally {
    if (store.remote) { const r = await store.close(touched, "Run stage call ledger"); console.log(`stage calls private: ${r.pushed ? "stored" : r.reason}`); }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`stage calls: skipped, ${e?.message || e}`); });
}
