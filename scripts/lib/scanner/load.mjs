// Nightly scanner load. Replay and the public board are a pure function of the dated files.
// Private notes go to data/private/scanner. alerts stays false.

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { loadFillMap } from "../fill-history.mjs";
import { mergeOwnFill } from "../span-reads.mjs";
import { openPrivate } from "../private-store.mjs";
import { isoOf } from "../history-reads.mjs";
import {
  DAILY_REPLAY_CAP, SCANNER_VERSION, SCORE_SEALED_CAP, SCORE_SINGLE_CAP, daysBetween,
} from "./common.mjs";
import { presentDetections, rankExtremes, replayItems, rotationMembership, scoreGates } from "./engine.mjs";
import { buildScannerReads } from "./reads.mjs";

const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

function parseLong(text) {
  const out = [];
  for (const pair of String(text || "").split(",")) {
    const [d, v] = pair.split(":");
    const n = Number(d);
    const x = Number(v);
    if (Number.isInteger(n) && x > 0) out.push({ date: isoOf(n), price: Math.round(x * 100) / 100, src: "own" });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

export async function loadScoreItems(root, asOf, series) {
  const pub = join(root, "research/assets/public");
  const catalog = await J(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const groupDates = await J(join(root, "data/tcgcsv-group-dates.json"), {});
  const byPid = new Map();
  for (const item of catalog.items || []) {
    const pid = Number(item.tcgplayerProductId);
    if (!(pid > 0) || byPid.has(pid)) continue;
    byPid.set(pid, item);
  }
  const singles = [];
  let files = [];
  try { files = (await readdir(join(pub, "hist-long"))).filter((f) => /^\d\d\.json$/.test(f)).sort(); } catch { files = []; }
  for (const file of files) {
    let long, bucket;
    try {
      long = JSON.parse(await readFile(join(pub, "hist-long", file), "utf8"));
      bucket = JSON.parse(await readFile(join(pub, "buckets", file), "utf8"));
    } catch { continue; }
    for (const row of bucket || []) {
      if (!row || row.kind !== "single") continue;
      const pts = parseLong(long.rows?.[row.id]);
      if (pts.length < 20) continue;
      const span = daysBetween(pts[0].date, pts.at(-1).date);
      if (span < 90) continue;
      const pid = Number(String(row.id).replace(/^tcgcsv-/, ""));
      const cat = byPid.get(pid);
      const night = series?.get(pid);
      if (night) {
        for (const [date, price] of night) {
          if (price > 0) {
            const i = pts.findIndex((p) => p.date === date);
            if (i >= 0) pts[i] = { date, price, src: "own" };
            else pts.push({ date, price, src: "own" });
          }
        }
        pts.sort((a, b) => (a.date < b.date ? -1 : 1));
      }
      singles.push({
        id: row.id,
        pid,
        name: row.name || cat?.name || "",
        set: row.set || cat?.set || "",
        setSlug: row.setSlug || "",
        kind: "single",
        artist: row.artist || "",
        release: row.release || groupDates[String(cat?.groupId || "")] || "",
        price: pts.at(-1)?.price || 0,
        href: `/c/${row.id}`,
        points: pts,
        listings: [],
        span,
      });
    }
  }
  singles.sort((a, b) => b.span - a.span || b.points.length - a.points.length || (a.id < b.id ? -1 : 1));
  const fill = loadFillMap(root);
  const sealed = [];
  for (const item of catalog.items || []) {
    if (item.kind !== "sealed") continue;
    const pid = Number(item.tcgplayerProductId);
    if (!(pid > 0)) continue;
    const own = [];
    const days = series?.get(pid);
    if (days) for (const [date, price] of days) if (price > 0) own.push([date, price]);
    own.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const rawFill = (fill.get(pid)?.points || []).filter((p) => Array.isArray(p));
    const points = mergeOwnFill(own, rawFill);
    if (points.length < 20) continue;
    const span = daysBetween(points[0].date, points.at(-1).date);
    if (span < 90) continue;
    sealed.push({
      id: item.id || `tcgcsv-${pid}`,
      pid,
      name: item.name || "",
      set: item.set || "",
      setSlug: "",
      kind: "sealed",
      artist: "",
      release: groupDates[String(item.groupId)] || "",
      price: Number(item.price) || points.at(-1).price,
      href: `/p/${item.id || `tcgcsv-${pid}`}`,
      points,
      listings: [],
      span,
    });
  }
  sealed.sort((a, b) => b.span - a.span || (a.id < b.id ? -1 : 1));
  const singlesAvailable = singles.length;
  const sealedAvailable = sealed.length;
  const items = [...singles.slice(0, SCORE_SINGLE_CAP), ...sealed.slice(0, SCORE_SEALED_CAP)];
  await attachListings(root, items);
  return { items, singles: Math.min(singlesAvailable, SCORE_SINGLE_CAP), sealed: Math.min(sealedAvailable, SCORE_SEALED_CAP), singlesAvailable, sealedAvailable, asOf };
}

async function attachListings(root, items) {
  const byPid = new Map(items.map((item) => [item.pid, item]));
  const products = await J(join(root, "data/sealed-products.json"), []);
  const pidOfSku = new Map();
  for (const row of products || []) {
    const pid = Number(row.tcgPlayerId);
    if (row.id && pid > 0) pidOfSku.set(row.id, pid);
  }
  const heat = await J(join(root, "data/heat-history.json"), []);
  const lists = new Map();
  for (const row of heat || []) {
    const pid = pidOfSku.get(row.id);
    if (!pid || !(row.listingCount >= 0) || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || "")) continue;
    if (!lists.has(pid)) lists.set(pid, new Map());
    lists.get(pid).set(row.date, Number(row.listingCount));
  }
  const dir = join(root, "data/derived/listing-counts/history");
  for (const name of (await readdir(dir).catch(() => [])).filter((n) => n.endsWith(".json.gz")).sort()) {
    let doc;
    try { doc = JSON.parse(gunzipSync(await readFile(join(dir, name))).toString()); } catch { continue; }
    const date = String(doc.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const row of doc.rows || []) {
      const pid = Number(String(row.id || "").replace(/^tcgcsv-/, ""));
      if (!(pid > 0) || !(row.listingsCounted >= 0)) continue;
      if (!lists.has(pid)) lists.set(pid, new Map());
      lists.get(pid).set(date, Number(row.listingsCounted));
    }
  }
  for (const [pid, days] of lists) {
    const item = byPid.get(pid);
    if (!item) continue;
    item.listings = [...days.entries()].map(([date, n]) => ({ date, n })).sort((a, b) => (a.date < b.date ? -1 : 1));
  }
}

export function scanItemsFrom(catalog, series, asOf, scoreItems) {
  const score = new Map((scoreItems || []).map((item) => [item.id, item]));
  const metas = [];
  const seen = new Set();
  for (const raw of catalog?.items || []) {
    const pid = Number(raw.tcgplayerProductId);
    const id = raw.id || (pid ? `tcgcsv-${pid}` : "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const kind = raw.kind === "sealed" ? "sealed" : "single";
    metas.push({ id, pid, kind, price: Number(raw.price) || 0, raw });
  }
  const { tonight, tops } = rotationMembership(metas, asOf);
  const items = [];
  for (const meta of tonight) {
    let item = score.get(meta.id);
    if (!item) {
      const days = meta.pid ? series?.get(meta.pid) : null;
      if (!days || days.size < 2) continue;
      const points = [];
      for (const [date, price] of days) if (price > 0 && date <= asOf) points.push({ date, price, src: "own" });
      points.sort((a, b) => (a.date < b.date ? -1 : 1));
      if (points.length < 2) continue;
      const raw = meta.raw;
      item = {
        id: meta.id, pid: meta.pid, name: raw.name || "", set: raw.set || "", kind: meta.kind, artist: "", release: "",
        price: meta.price || points.at(-1).price, href: meta.kind === "sealed" ? `/p/${meta.id}` : `/c/${meta.id}`,
        points, listings: [],
      };
    }
    item.top = tops.has(meta.id);
    items.push(item);
  }
  return items;
}

function tally(rows, field) {
  const out = {};
  for (const row of rows || []) {
    const key = row[field] || "other";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

export async function collectScannerReads({ root, asOf, series, catalog, token = process.env.PRIVATE_DATA_TOKEN || "" }) {
  const started = Date.now();
  const score = await loadScoreItems(root, asOf, series);
  const scan = scanItemsFrom(catalog || { items: [] }, series, asOf, score.items);
  const replayStarted = Date.now();
  const replay = replayItems(score.items, asOf);
  const gates = scoreGates(replay.detections, replay.base, asOf);
  const replayMs = Date.now() - replayStarted;
  const live = presentDetections({ items: scan, groupItems: score.items, asOf, gates, ready: true });
  const reads = buildScannerReads(live.present, gates, asOf);
  const extremes = rankExtremes(gates);
  const passed = gates.filter((row) => row.passed);
  const summary = {
    asOf,
    version: SCANNER_VERSION,
    alerts: false,
    scoreSingles: score.singles,
    scoreSealed: score.sealed,
    singlesAvailable: score.singlesAvailable,
    sealedAvailable: score.sealedAvailable,
    scoreCaps: { singles: SCORE_SINGLE_CAP, sealed: SCORE_SEALED_CAP, dailyReplay: DAILY_REPLAY_CAP },
    dailyReplay: replay.dailyReplay,
    replayMs,
    runtimeMs: Date.now() - started,
    scanItems: scan.length,
    tonight: live.tonight,
    tops: live.tops,
    split: { proven: live.split.provenN, explore: live.split.exploreN, tailExploreShare: Math.round(live.split.tailExploreShare * 1000) / 1000 },
    detections: replay.detections.length,
    detectionsByPattern: tally(replay.detections.filter((row) => !row.explore && !row.candidate), "pattern"),
    present: live.present.length,
    presentByPattern: tally(live.present.filter((row) => !row.explore && !row.candidate), "pattern"),
    passed: passed.length,
    passedKeys: passed.map((row) => `${row.pattern}|${row.stage}|${row.kind}|${row.dir}|${row.horizon}d|n=${row.n}|rate=${row.rate}|lo=${row.rateLo}|base=${row.baseRate}|train=${row.train?.rate}|test=${row.test?.rate}`),
    listingsProgress: listingsProgress(gates),
    publicReads: reads.length,
    publicByKind: tally(reads, "readKind"),
    strongest: extremes.strongest.map(brief),
    weakest: extremes.weakest.map(brief),
  };
  await writePrivate(root, token, asOf, { summary, gates, present: live.present, detections: replay.detections });
  summary.runtimeMs = Date.now() - started;
  return { reads, summary, gates, present: live.present, detections: replay.detections };
}

const LISTING_PATTERNS = ["listings-down-flat", "listings-up-flat", "price-up-listings-up", "price-down-listings-down", "thin-jump"];

function listingsProgress(gates) {
  return LISTING_PATTERNS.map((pattern) => {
    const rows = (gates || []).filter((row) => row.pattern === pattern);
    const best = rows.slice().sort((a, b) => b.n - a.n || a.horizon - b.horizon)[0];
    return {
      pattern,
      n: best?.n || 0,
      reached20: rows.some((row) => row.n >= 20),
      stage: best?.stage || "",
      kind: best?.kind || "",
      horizon: best?.horizon || null,
      rate: best?.rate ?? null,
      rateLo: best?.rateLo ?? null,
      passed: rows.some((row) => row.passed),
    };
  });
}

function brief(row) {
  return {
    pattern: row.pattern, stage: row.stage, kind: row.kind, dir: row.dir, horizon: row.horizon,
    n: row.n, rate: row.rate, rateLo: row.rateLo, rateHi: row.rateHi, upRate: row.upRate,
    baseRate: row.baseRate, passed: row.passed, medianPct: row.medianPct,
    trainRate: row.train?.rate ?? null, testRate: row.test?.rate ?? null,
    trainN: row.train?.n ?? 0, testN: row.test?.n ?? 0,
  };
}

async function writePrivate(root, token, asOf, payload) {
  let store;
  try { store = await openPrivate({ root, token }); }
  catch { store = await openPrivate({ root, token: "" }); }
  const dir = join(store.dir, "scanner");
  await mkdir(dir, { recursive: true });
  const weights = {
    asOf, version: SCANNER_VERSION, alerts: false, halfLifeDays: 180, minN: 20, hitPct: 3,
    rows: payload.gates.map((row) => ({
      pattern: row.pattern, stage: row.stage, kind: row.kind, horizon: row.horizon, dir: row.dir,
      n: row.n, hits: row.hits, rate: row.rate, rateLo: row.rateLo, rateHi: row.rateHi, upRate: row.upRate,
      baseRate: row.baseRate, passed: row.passed, weight: row.weight, medianPct: row.medianPct,
      train: row.train, test: row.test,
    })),
  };
  const day = {
    asOf, version: SCANNER_VERSION, alerts: false,
    summary: payload.summary,
    forward: payload.gates.filter((row) => row.passed).map((row) => ({
      pattern: row.pattern, stage: row.stage, kind: row.kind, horizon: row.horizon,
      n: row.n, medianPct: row.medianPct, rate: row.rate, rateLo: row.rateLo, upRate: row.upRate,
      from: row.from, to: row.to, train: row.train, test: row.test, examples: row.examples,
    })),
    candidates: payload.present.filter((row) => row.candidate).slice(0, 200).map((row) => ({ ...compact(row), forward: forwardStats(row, payload.gates) })),
    present: payload.present.filter((row) => !row.explore).slice(0, 4000).map((row) => ({ ...compact(row), forward: forwardStats(row, payload.gates) })),
    detections: payload.detections.filter((row) => !row.explore).slice(0, 12000).map(compact),
  };
  await writeFile(join(dir, "weights.json"), JSON.stringify(weights, null, 1) + "\n");
  await writeFile(join(dir, "summary.json"), JSON.stringify(payload.summary, null, 1) + "\n");
  await writeFile(join(dir, `${asOf}.json`), JSON.stringify(day) + "\n");
  const rel = [`scanner/weights.json`, `scanner/summary.json`, `scanner/${asOf}.json`];
  try { await store.close(rel, `scanner ${asOf}`); } catch { /* local copy already written */ }
}

function forwardStats(row, gates) {
  const out = {};
  for (const h of [7, 30, 90]) {
    const g = (gates || []).find((x) => x.pattern === row.pattern && x.stage === row.stage && x.kind === row.kind && x.horizon === h && (!row.dir || !x.dir || x.dir === row.dir));
    out[`${h}d`] = g
      ? { n: g.n, medianPct: g.medianPct, rate: g.rate, rateLo: g.rateLo, upRate: g.upRate, dir: g.dir, passed: g.passed === true, trainRate: g.train?.rate ?? null, testRate: g.test?.rate ?? null }
      : { n: 0, medianPct: null, rate: null, passed: false };
  }
  return out;
}

function compact(row) {
  const g = {};
  for (const [key, value] of Object.entries(row.grades || {})) {
    if (!value?.scored) continue;
    g[key] = { hit: value.hit, upHit: value.upHit === true, dir: value.dir || "", pct: value.pct, from: value.from, to: value.to };
  }
  return {
    id: row.id, name: row.name, kind: row.kind, pattern: row.pattern, stage: row.stage, date: row.date,
    strength: row.strength, start: row.start, end: row.end, p0: row.p0, p1: row.p1,
    startSrc: row.startSrc, endSrc: row.endSrc, candidate: row.candidate || "", privateOnly: row.privateOnly === true,
    metrics: row.metrics || {}, grades: g,
  };
}
