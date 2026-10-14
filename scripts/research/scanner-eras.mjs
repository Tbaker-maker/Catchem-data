// Private multi-era scanner backtest. Uses only allowed sources (own tcgcsv days +
// approved PokeViz fill). Saves long-history packs under data/private/history/
// and era grades under research/scanner-eras/ in catchem-data-private.
// Not part of the nightly. Does not change public reads or the public gate.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { openPrivate } from "../lib/private-store.mjs";
import { loadFillMap } from "../lib/fill-history.mjs";
import { mergeOwnFill } from "../lib/span-reads.mjs";
import { isoOf } from "../lib/history-reads.mjs";
import { replayItems, scoreGates } from "../lib/scanner/engine.mjs";
import { daysBetween } from "../lib/scanner/common.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

// Eras chosen from available allowed depth (own from 2024-02-08; PokeViz from 2025-09-30).
// 2020-21 boom and 2022-23 cooldown are skipped: no allowed free source reaches them.
export const ERAS = [
  {
    id: "2024-own",
    label: "2024 own year",
    start: "2024-02-08",
    end: "2024-12-31",
    why: "First dense own tcgcsv days. Earliest allowed history. Stands in for post-crash recovery while 2020-22 stay unreachable under terms/robots.",
  },
  {
    id: "2025",
    label: "2025 full year",
    start: "2025-01-01",
    end: "2025-12-31",
    why: "Full calendar year of own days; PokeViz fill starts 2025-09-30 and only fills before each item's first own day.",
  },
  {
    id: "2026-current",
    label: "2026 to latest own day",
    start: "2026-01-01",
    end: "2026-09-15",
    why: "Latest own hist-long day in the public pack (2026-09-15). Current market window.",
  },
];

const SAMPLE_SINGLES = 1200;
const SAMPLE_SEALED = 300;

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

async function loadOwnSingles() {
  const pub = join(ROOT, "research/assets/public");
  const catalog = await J(join(ROOT, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const byPid = new Map();
  for (const item of catalog.items || []) {
    const pid = Number(item.tcgplayerProductId);
    if (pid > 0 && !byPid.has(pid)) byPid.set(pid, item);
  }
  const singles = [];
  const files = (await readdir(join(pub, "hist-long")).catch(() => [])).filter((f) => /^\d\d\.json$/.test(f)).sort();
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
      singles.push({
        id: row.id,
        pid,
        name: row.name || cat?.name || "",
        set: row.set || cat?.set || "",
        kind: "single",
        price: pts.at(-1).price,
        href: `/c/${row.id}`,
        points: pts,
        listings: [],
        span,
      });
    }
  }
  singles.sort((a, b) => b.span - a.span || b.points.length - a.points.length || (a.id < b.id ? -1 : 1));
  return singles;
}

async function loadSealed(fill) {
  const catalog = await J(join(ROOT, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const sealed = [];
  for (const item of catalog.items || []) {
    if (item.kind !== "sealed") continue;
    const pid = Number(item.tcgplayerProductId);
    if (!(pid > 0)) continue;
    // Sealed own history is thin in hist-long; use fill + any catalog price trail via fill only for private grade sample.
    const rawFill = (fill.get(pid)?.points || []).filter((p) => Array.isArray(p));
    // Sealed own hist-long is thin; private grade may use approved fill alone.
    const points = rawFill.length
      ? rawFill.map((p) => ({ date: p[0], price: Number(p[1]), src: "fill" })).filter((p) => p.price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date)).sort((a, b) => (a.date < b.date ? -1 : 1))
      : [];
    if (points.length < 20) continue;
    const span = daysBetween(points[0].date, points.at(-1).date);
    if (span < 90) continue;
    sealed.push({
      id: item.id || `tcgcsv-${pid}`,
      pid,
      name: item.name || "",
      set: item.set || "",
      kind: "sealed",
      price: Number(item.price) || points.at(-1).price,
      href: `/p/${item.id || `tcgcsv-${pid}`}`,
      points,
      listings: [],
      span,
    });
  }
  sealed.sort((a, b) => b.span - a.span || (a.id < b.id ? -1 : 1));
  return sealed;
}

function clipItem(item, asOf) {
  const points = (item.points || []).filter((p) => p.date <= asOf);
  return { ...item, points, price: points.at(-1)?.price || item.price };
}

function gateKey(row) {
  return `${row.pattern}|${row.stage}|${row.kind}|${row.dir || "up"}|${row.horizon}d`;
}

function briefGate(row) {
  return {
    pattern: row.pattern,
    stage: row.stage,
    kind: row.kind,
    dir: row.dir || "up",
    horizon: row.horizon,
    n: row.n,
    hits: row.hits,
    rate: row.rate,
    rateLo: row.rateLo,
    rateHi: row.rateHi,
    baseRate: row.baseRate,
    passed: row.passed === true,
    medianPct: row.medianPct,
    trainN: row.train?.n || 0,
    trainRate: row.train?.rate ?? null,
    trainPassed: row.train?.passed === true,
    testN: row.test?.n || 0,
    testRate: row.test?.rate ?? null,
    testPassed: row.test?.passed === true,
  };
}

async function packHistory(storeDir, fill) {
  const histDir = join(storeDir, "history");
  await mkdir(join(histDir, "pokeviz"), { recursive: true });
  await mkdir(join(histDir, "tcgcsv-own"), { recursive: true });

  // PokeViz pack (already approved fill)
  const singlesDoc = JSON.parse(gunzipSync(await readFile(join(ROOT, "data/backfill/pokeviz/singles.json.gz"))).toString("utf8"));
  const sealedDoc = await J(join(ROOT, "data/backfill/pokeviz/raw.json"), { items: [] });
  const pokevizItems = [];
  for (const it of singlesDoc.items || []) {
    pokevizItems.push({
      id: `tcgcsv-${it.pid}`,
      pid: Number(it.pid),
      kind: "single",
      printing: it.printing || "",
      source: "pokeviz-singles",
      sourceUrl: it.url || "",
      fetchedDate: singlesDoc.fetchedDate || "",
      robotsCheckedAt: singlesDoc.robotsCheckedAt || "",
      points: it.points || [],
    });
  }
  for (const it of sealedDoc.items || []) {
    pokevizItems.push({
      id: `tcgcsv-${it.pid}`,
      pid: Number(it.pid),
      kind: "sealed",
      source: "pokeviz",
      sourceUrl: it.url || "",
      fetchedDate: sealedDoc.fetchedDate || "",
      robotsCheckedAt: sealedDoc.robotsCheckedAt || "",
      points: it.points || [],
    });
  }
  const pokevizPack = {
    source: "pokevizinvestor.com",
    sourceKeys: ["pokeviz", "pokeviz-singles"],
    note: "Approved fill. Private grading store. Not shown publicly.",
    packedAt: new Date().toISOString(),
    itemCount: pokevizItems.length,
    earliest: pokevizItems.flatMap((i) => (i.points || []).map((p) => p[0])).sort()[0] || null,
    latest: pokevizItems.flatMap((i) => (i.points || []).map((p) => p[0])).sort().at(-1) || null,
  };
  await writeFile(join(histDir, "pokeviz/manifest.json"), JSON.stringify(pokevizPack, null, 1) + "\n");
  await writeFile(join(histDir, "pokeviz/series.json.gz"), gzipSync(Buffer.from(JSON.stringify({ ...pokevizPack, items: pokevizItems }))));

  // Own tcgcsv hist-long pack (sample of longest series + index of all ids/spans for reuse)
  const own = await loadOwnSingles();
  const ownItems = own.map((it) => ({
    id: it.id,
    pid: it.pid,
    kind: "single",
    source: "tcgcsv-own",
    fetchedDate: it.points.at(-1)?.date || "",
    points: it.points.map((p) => [p.date, p.price]),
  }));
  const ownPack = {
    source: "tcgcsv daily (our own days)",
    sourceKey: "tcgcsv-own",
    note: "Copied from research/assets/public/hist-long for private reuse. Own days win over fill.",
    packedAt: new Date().toISOString(),
    itemCount: ownItems.length,
    earliest: ownItems[0] ? own.reduce((m, it) => (it.points[0].date < m ? it.points[0].date : m), own[0].points[0].date) : null,
    latest: ownItems[0] ? own.reduce((m, it) => (it.points.at(-1).date > m ? it.points.at(-1).date : m), own[0].points.at(-1).date) : null,
  };
  await writeFile(join(histDir, "tcgcsv-own/manifest.json"), JSON.stringify(ownPack, null, 1) + "\n");
  await writeFile(join(histDir, "tcgcsv-own/series.json.gz"), gzipSync(Buffer.from(JSON.stringify({ ...ownPack, items: ownItems }))));

  return { pokevizPack, ownPack, own, pokevizItems };
}

async function runEra(items, era) {
  const clipped = items.map((it) => clipItem(it, era.end)).filter((it) => it.points.length >= 20);
  const replay = replayItems(clipped, era.end);
  const inEra = replay.detections.filter((row) => row.date >= era.start && row.date <= era.end);
  const gates = scoreGates(inEra, replay.base, era.end);
  return {
    era: era.id,
    label: era.label,
    start: era.start,
    end: era.end,
    why: era.why,
    items: clipped.length,
    detections: inEra.length,
    gateRows: gates.length,
    passed: gates.filter((g) => g.passed).length,
    gates: gates.map(briefGate),
  };
}

function durableTable(eraResults) {
  const byKey = new Map();
  for (const era of eraResults) {
    for (const g of era.gates) {
      const key = gateKey(g);
      if (!byKey.has(key)) byKey.set(key, { key, pattern: g.pattern, stage: g.stage, kind: g.kind, dir: g.dir, horizon: g.horizon, eras: {} });
      byKey.get(key).eras[era.era] = {
        n: g.n,
        rate: g.rate,
        rateLo: g.rateLo,
        baseRate: g.baseRate,
        passed: g.passed,
        trainN: g.trainN,
        trainRate: g.trainRate,
        testN: g.testN,
        testRate: g.testRate,
      };
    }
  }
  const rows = [];
  for (const row of byKey.values()) {
    const erasWithData = Object.entries(row.eras).filter(([, v]) => (v.n || 0) > 0);
    const erasReady = erasWithData.filter(([, v]) => (v.n || 0) >= 20);
    const durable = erasReady.length > 0 && erasReady.every(([, v]) => v.passed === true)
      && erasReady.length === ERAS.filter((e) => eraResults.find((r) => r.era === e.id && r.items > 0)).length;
    // durable only if every era that has the study also has this key with n>=20 and passed
    const allEras = eraResults.map((e) => e.era);
    const durableStrict = allEras.every((id) => row.eras[id] && row.eras[id].n >= 20 && row.eras[id].passed === true);
    const passCount = allEras.filter((id) => row.eras[id]?.passed === true && row.eras[id].n >= 20).length;
    const meanRate = erasReady.length ? erasReady.reduce((s, [, v]) => s + (v.rate || 0), 0) / erasReady.length : 0;
    const meanLo = erasReady.length ? erasReady.reduce((s, [, v]) => s + (v.rateLo || 0), 0) / erasReady.length : 0;
    rows.push({
      ...row,
      durable: durableStrict,
      erasWithN20: erasReady.length,
      passCount,
      meanRate: Math.round(meanRate * 10) / 10,
      meanRateLo: Math.round(meanLo * 10) / 10,
    });
  }
  rows.sort((a, b) => (b.durable - a.durable) || (b.passCount - a.passCount) || (b.meanRateLo - a.meanRateLo) || (a.key < b.key ? -1 : 1));
  return rows;
}

export async function main({ token = process.env.PRIVATE_DATA_TOKEN || "", sampleSingles = SAMPLE_SINGLES, sampleSealed = SAMPLE_SEALED } = {}) {
  const started = Date.now();
  const fill = loadFillMap(ROOT);
  let store;
  try { store = await openPrivate({ root: ROOT, token }); }
  catch (err) {
    console.error(`scanner-eras: ${err.message}; using local data/private`);
    store = await openPrivate({ root: ROOT, token: "" });
  }

  const packed = await packHistory(store.dir, fill);
  // Attach pokeviz fill onto own singles for grade training (own wins on overlap)
  const fillByPid = fill;
  const singles = packed.own.slice(0, sampleSingles).map((it) => {
    const f = fillByPid.get(it.pid);
    if (!f) return it;
    const own = it.points.map((p) => [p.date, p.price]);
    const merged = mergeOwnFill(own, f.points || []);
    return { ...it, points: merged };
  });
  const sealedAll = await loadSealed(fillByPid);
  const sealed = sealedAll.slice(0, sampleSealed);
  const items = [...singles, ...sealed];

  const eraResults = [];
  for (const era of ERAS) {
    const t0 = Date.now();
    const result = await runEra(items, era);
    result.runtimeMs = Date.now() - t0;
    eraResults.push(result);
    console.log(JSON.stringify({ era: result.era, items: result.items, detections: result.detections, passed: result.passed, runtimeMs: result.runtimeMs }));
  }

  const durable = durableTable(eraResults);
  const durableList = durable.filter((r) => r.durable);
  const top15 = durable.slice(0, 15);

  const sources = {
    checked: "2026-10-13",
    allowedUsed: [
      {
        site: "our own tcgcsv days (hist-long)",
        depth: packed.ownPack,
        verdict: "allowed (our data)",
      },
      {
        site: "pokevizinvestor.com",
        depth: packed.pokevizPack,
        verdict: "allowed (Tyler approved; terms 404; robots Allow: /)",
        note: "History on card pages starts ~2025-09-30 (about one year). Not multi-year to 2019.",
      },
    ],
    skippedForDepthOrTerms: [
      { site: "tcgcsv archive", reason: "403 archive removed", depth: null },
      { site: "2020-21 boom era", reason: "no allowed free source reaches 2019-2021", depth: null },
      { site: "2022-23 cooldown era", reason: "no allowed free source reaches 2022-2023", depth: null },
      { site: "pkmnprices.com", reason: "terms forbid scrape outside paid API; paid seller", robots: "Allow: / with dashboard disallows", termsChecked: "2026-10-13" },
      { site: "pokemonpricetracker.com", reason: "paid; terms forbid scrape without consent; commercial needs Business; robots Disallow: /api/", termsChecked: "2026-10-13" },
      { site: "pokedata.io", reason: "terms forbid redistribute; already skipped in fill-sources", termsChecked: "prior" },
      { site: "tcggraph.com", reason: "robots Disallow: /api/; no terms page (404); paid credits API", robotsChecked: "2026-10-13" },
      { site: "tcgapi.dev", reason: "paid API; no public terms page found", robotsChecked: "2026-10-13" },
      { site: "pokecollector.com", reason: "robots Disallow: /", robotsChecked: "2026-10-13" },
      { site: "tcgplayer.com", reason: "terms forbid crawl/scrape", termsChecked: "prior" },
      { site: "PPT sealed private pack", reason: "paid seller; not pulled for this job (existing private ppt-sealed left untouched)", depth: "180 sealed files in data/history/ppt-sealed" },
    ],
  };

  const summary = {
    asOf: "2026-10-13",
    version: 1,
    scannerVersion: 2,
    sampleSingles,
    sampleSealed,
    items: items.length,
    eras: ERAS,
    eraResults: eraResults.map((e) => ({
      era: e.era, label: e.label, start: e.start, end: e.end, why: e.why,
      items: e.items, detections: e.detections, gateRows: e.gateRows, passed: e.passed, runtimeMs: e.runtimeMs,
    })),
    durableCount: durableList.length,
    durable: durableList,
    top15,
    foldIntoWeightsProposal: {
      note: "Do not change the nightly public gate yet.",
      idea: [
        "Keep the current train/test + rateLo>base gate as the public bar.",
        "Add a private weight multiplier from era durability: durableStrict → 1.0, passCount/eras → 0.5–0.9, else 0.25.",
        "Prefer durable rows when ranking past-cases and when picking which horizon to show.",
        "When a third era of own days exists (full 2026), recompute durableStrict before any public use.",
        "Listings patterns stay private until n≥20 in at least two eras.",
      ],
    },
    sources,
    runtimeMs: Date.now() - started,
  };

  const outDir = join(store.dir, "../research/scanner-eras");
  // store.dir is data/private; research/ should be at repo root of private clone
  const researchDir = store.remote
    ? join(store.dir, "..", "..", "research", "scanner-eras")
    : join(ROOT, "data/private/../research/scanner-eras".replace("/../", "/"));
  // Fix paths cleanly:
  const erasDir = join(dirname(store.dir), "..", "research", "scanner-eras");
  // store.dir = <clone>/data/private OR <root>/data/private
  // want <clone>/research/scanner-eras OR <root>/research/scanner-eras — but public repo shouldn't get this.
  // Prefer sibling of data/: join(store.dir, '..', '..') if store.dir ends with data/private... 
  // openPrivate: dir = join(clone, "data/private") or join(root, "data/private")
  // so join(store.dir, "..", "..", "research", "scanner-eras") = clone/research/scanner-eras or root/research/scanner-eras
  const dest = join(store.dir, "..", "..", "research", "scanner-eras");
  await mkdir(dest, { recursive: true });
  await writeFile(join(dest, "summary.json"), JSON.stringify(summary, null, 1) + "\n");
  await writeFile(join(dest, "eras.json"), JSON.stringify({ eras: ERAS, results: eraResults }, null, 1) + "\n");
  await writeFile(join(dest, "durable.json"), JSON.stringify({ durable: durableList, top15, all: durable }, null, 1) + "\n");
  await writeFile(join(dest, "sources.json"), JSON.stringify(sources, null, 1) + "\n");

  // private-store close only adds under data/private/. Keep era reports there too.
  const privResearch = join(store.dir, "research/scanner-eras");
  await mkdir(privResearch, { recursive: true });
  for (const name of ["summary.json", "eras.json", "durable.json", "sources.json"]) {
    await writeFile(join(privResearch, name), await readFile(join(dest, name)));
  }
  const uniq = [
    "history/pokeviz/manifest.json",
    "history/pokeviz/series.json.gz",
    "history/tcgcsv-own/manifest.json",
    "history/tcgcsv-own/series.json.gz",
    "research/scanner-eras/summary.json",
    "research/scanner-eras/eras.json",
    "research/scanner-eras/durable.json",
    "research/scanner-eras/sources.json",
  ];
  const pushed = await store.close(uniq, `scanner eras backtest ${summary.asOf}: ${durableList.length} durable`);
  console.log(JSON.stringify({
    scannerEras: {
      items: items.length,
      durable: durableList.length,
      top: top15.slice(0, 5).map((r) => r.key),
      pushed: pushed?.pushed,
      sha: pushed?.sha || null,
      reason: pushed?.reason || null,
      runtimeMs: summary.runtimeMs,
      note: "Era reports at data/private/research/scanner-eras/ (private-store push scope). History at data/private/history/.",
    },
  }));
  return summary;
}

if (process.argv[1] && process.argv[1].endsWith("scanner-eras.mjs")) {
  const summary = await main({ token: process.env.PRIVATE_DATA_TOKEN || "" });
  if (!summary) process.exit(1);
}
