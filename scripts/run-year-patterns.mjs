// Nightly private year study, present-day match, forming warnings, unusual activity.
// Writes under data/private/year-patterns/. Public data/derived/year-patterns.json
// lists only patterns that passed on own tcgcsv days. Fill days stay out of that file.
// Item alerts stay off unless config/year-patterns.json says alerts true AND a
// forming warning passed the later split at n>=20.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { loadFillMap } from "./lib/fill-history.mjs";
import { stageOf } from "./lib/sealed-rating.mjs";
import { backtest } from "./lib/tracker.mjs";
import {
  HORIZONS,
  MIN_N,
  alertsDocument,
  auditRows,
  backtestForming,
  conditionKeys,
  coveredChange,
  formingWarnings,
  gateOwnOnly,
  gridStarts,
  isHit,
  medianLower,
  mineYearPatterns,
  ownPoints,
  presentMatches,
  provenLine,
  publicCopyOk,
  studyPoints,
  unusualEvents,
} from "./lib/year-patterns.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

function putPoint(map, pid, day, price) {
  if (!(pid > 0) || !(price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return;
  if (!map.has(pid)) map.set(pid, new Map());
  map.get(pid).set(day, price);
}

export async function loadStudyInputs(root = ROOT) {
  const own = new Map();
  const dayDir = join(root, "data/history/tcgcsv-daily");
  const names = (await readdir(dayDir)).filter((n) => n.endsWith(".json")).sort();
  const dated = [];
  for (const name of names) {
    const doc = await J(join(dayDir, name), null);
    const date = String(doc?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    dated.push(date);
    for (const row of doc.prices || []) putPoint(own, Number(row.id), date, Number(row.market));
  }
  dated.sort();
  const asOf = dated.at(-1) || null;

  const listings = new Map();
  const listDays = [];
  const histDir = join(root, "data/derived/listing-counts/history");
  for (const name of (await readdir(histDir).catch(() => [])).filter((n) => n.endsWith(".json.gz")).sort()) {
    const doc = JSON.parse(gunzipSync(await readFile(join(histDir, name))).toString());
    const date = String(doc.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    listDays.push(date);
    for (const row of doc.rows || []) {
      const pid = Number(String(row.id || "").replace(/^tcgcsv-/, ""));
      if (!(pid > 0) || !(Number(row.listingsCounted) >= 0)) continue;
      if (!listings.has(pid)) listings.set(pid, []);
      listings.get(pid).push([date, Number(row.listingsCounted)]);
    }
  }

  const catalog = await J(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] });
  const sets = await J(join(root, "research/assets/public/sets.json"), { sets: [] });
  const rot = await J(join(root, "research/assets/public/rotation-status.json"), { sets: [], sources: [] });
  const byName = new Map();
  for (const s of sets.sets || []) {
    if (s?.name) byName.set(String(s.name).toLowerCase(), s);
    if (s?.slug) byName.set(String(s.slug).toLowerCase(), s);
  }
  const rotBySlug = new Map((rot.sets || []).map((s) => [s.slug, s]));
  const metaByPid = new Map();
  for (const item of catalog.items || []) {
    const pid = Number(item.tcgplayerProductId);
    if (!(pid > 0) || metaByPid.has(pid)) continue;
    const raw = String(item.set || "");
    const tail = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1).trim() : raw;
    const set = byName.get(raw.toLowerCase()) || byName.get(tail.toLowerCase()) || null;
    const rotRow = set ? rotBySlug.get(set.slug) : null;
    const stage = stageOf({ release: set?.release || null, subtype: item.subtype || null, rot: rotRow });
    metaByPid.set(pid, {
      pid,
      itemId: item.id || `tcgcsv-${pid}`,
      kind: item.kind === "sealed" ? "sealed" : "single",
      release: set?.release || null,
      mark: rotRow?.mark || null,
      rotationStage: stage?.key || null,
      setSlug: set?.slug || null,
    });
  }

  const crowd = await loadCrowd(root);
  // Sealed fill only: the singles fill (pokeviz-singles) charts card pages but is kept out of
  // this study, which was built and gated on sealed. Adding 7955 daily singles series took the
  // nightly build from about 1 to 9 minutes.
  const fill = loadFillMap(root, { keys: ["pokeviz"] });
  return {
    own, asOf, datedDays: dated.length, listings, listDays: [...new Set(listDays)].sort(),
    metaByPid, rotSources: rot.sources || [], crowd, fill,
  };
}

async function loadCrowd(root) {
  const files = ["data/private/tcgci/rescored-claims.json", "data/private/youtube/claims.json"];
  const events = [];
  const found = [];
  for (const rel of files) {
    const doc = await J(join(root, rel), null);
    if (!doc) continue;
    found.push(rel);
    for (const c of doc.claims || []) {
      const pid = Number(c.pid ?? c.productId);
      const date = c.date || c.issued;
      const dir = Number(c.dir);
      if (!(pid > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !dir) continue;
      events.push({ pid, date, dir });
    }
  }
  return { events, found };
}

export function buildObservations(inputs) {
  const { own, fill, listings, metaByPid, rotSources, crowd, asOf } = inputs;
  const pids = new Set([...own.keys(), ...fill.keys()]);
  let minDate = null;
  const seriesByPid = new Map();
  let fillPoints = 0;
  let ownPointCount = 0;
  let fillProducts = 0;
  for (const pid of pids) {
    const ownPairs = [...(own.get(pid)?.entries() || [])].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const points = studyPoints(ownPairs, fill.get(pid) || null);
    if (points.length < 2) continue;
    if (points.some((p) => p.src === "fill")) { fillProducts += 1; fillPoints += points.filter((p) => p.src === "fill").length; }
    ownPointCount += points.filter((p) => p.src === "own").length;
    seriesByPid.set(pid, points);
    if (!minDate || points[0].date < minDate) minDate = points[0].date;
  }

  const raw = [];
  for (const horizon of HORIZONS) {
    for (const start of gridStarts(minDate, asOf, horizon)) {
      for (const [pid, points] of seriesByPid) {
        const win = coveredChange(points, start, addDaysSafe(start, horizon), horizon);
        if (!win) continue;
        const meta = metaByPid.get(pid) || { pid, itemId: `tcgcsv-${pid}` };
        const keys = conditionKeys({
          points,
          listings: listings.get(pid) || [],
          crowdEvents: crowd.events,
          meta,
          sources: rotSources,
          start,
        });
        raw.push({
          id: `${pid}|${start}|${horizon}`,
          pid,
          itemId: meta.itemId,
          horizon,
          start,
          change: win.change,
          startSrc: win.startSrc,
          endSrc: win.endSrc,
          usesFill: win.startSrc === "fill" || win.endSrc === "fill",
          keys,
        });
      }
    }
  }

  const byWindow = new Map();
  for (const row of raw) {
    const k = `${row.start}|${row.horizon}`;
    if (!byWindow.has(k)) byWindow.set(k, []);
    byWindow.get(k).push(row.change);
  }
  const medians = new Map();
  for (const [k, values] of byWindow) medians.set(k, medianLower(values));
  const rows = raw.map((row) => {
    const market = medians.get(`${row.start}|${row.horizon}`);
    return { ...row, market, hit: isHit(row.change, market) };
  });
  return { rows, minDate, products: seriesByPid.size, fillProducts, fillPoints, ownPointCount, seriesByPid };
}

function addDaysSafe(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

function toPairs(points) {
  return (points || []).map((p) => [p.date, p.price]);
}

export async function runYearPatterns({
  root = ROOT,
  token = process.env.PRIVATE_DATA_TOKEN || "",
  now = new Date(),
} = {}) {
  const cfg = await J(join(root, "config/year-patterns.json"), { alerts: false, minFormingPct: 50 });
  const alertsOn = cfg.alerts === true;
  const minPct = Number.isFinite(Number(cfg.minFormingPct)) ? Number(cfg.minFormingPct) : 50;
  const inputs = await loadStudyInputs(root);
  if (!inputs.asOf) throw new Error("no dated tcgcsv day");
  const built = buildObservations(inputs);
  const mined = {};
  const passed = [];
  const failed = [];
  for (const horizon of HORIZONS) {
    const slice = built.rows.filter((r) => r.horizon === horizon);
    const result = mineYearPatterns(slice, { minN: MIN_N, horizon });
    mined[horizon] = {
      trainN: result.trainN,
      testN: result.testN,
      cutoff: result.cutoff,
      baseTrain: result.baseTrain.rate == null ? null : result.baseTrain.rate,
      baseTest: result.baseTest.rate == null ? null : result.baseTest.rate,
      passed: result.passed.length,
      failed: result.failed.length,
    };
    for (const p of result.passed) {
      const testRows = slice.filter((r) => result.cutoff && r.start >= result.cutoff);
      const own = gateOwnOnly(p.keys, testRows, { minN: MIN_N });
      const line = own.passed ? provenLine(p, own) : "";
      passed.push({
        ...p,
        ownOnly: own,
        public: Boolean(own.passed && publicCopyOk(line)),
        line: own.passed && publicCopyOk(line) ? line : "",
        rows: auditRows(p.keys, testRows).slice(0, 80),
      });
    }
    for (const p of result.failed) {
      const testRows = slice.filter((r) => result.cutoff && r.start >= result.cutoff);
      failed.push({ ...p, rows: auditRows(p.keys, testRows).slice(0, 20) });
    }
  }

  const proven = passed.filter((p) => p.passedLater);
  const todayItems = [];
  for (const [pid, points] of built.seriesByPid) {
    const own = ownPoints(points);
    if (own.length < 2) continue;
    const meta = inputs.metaByPid.get(pid) || { pid, itemId: `tcgcsv-${pid}` };
    todayItems.push({
      pid,
      itemId: meta.itemId,
      asOf: inputs.asOf,
      keys: conditionKeys({
        points: own,
        listings: inputs.listings.get(pid) || [],
        crowdEvents: inputs.crowd.events,
        meta,
        sources: inputs.rotSources,
        start: inputs.asOf,
      }),
    });
  }
  const present = presentMatches(todayItems, proven);
  const formingAll = formingWarnings(todayItems, proven, { minPct: 0 });
  const formingFeed = formingAll.filter((row) => row.pctComplete >= minPct && publicCopyOk(row.line));
  const formingTests = proven.map((p) => backtestForming(built.rows, p, { minN: MIN_N, cutoff: p.cutoff }));
  const warningsPassed = formingTests.some((row) => row.passed);
  const alerts = alertsDocument({
    asOf: inputs.asOf,
    enabled: alertsOn,
    warningsPassed,
    items: formingFeed,
  });

  const priceMap = new Map();
  const events = [];
  let thinSkipped = "no sales count on the daily price file";
  for (const [pid, points] of built.seriesByPid) {
    const prices = toPairs(points);
    priceMap.set(pid, prices);
    const found = unusualEvents({
      pid,
      prices,
      listings: inputs.listings.get(pid) || [],
      sales: null,
    });
    if (!found.thinSkipped) thinSkipped = null;
    for (const ev of found.events) if (publicCopyOk(ev.line)) events.push(ev);
  }
  const unusualBt = backtest(events.map((e) => ({ date: e.date, pid: e.pid })), priceMap, inputs.asOf);
  const unusualCounts = {};
  for (const ev of events) unusualCounts[ev.kind] = (unusualCounts[ev.kind] || 0) + 1;

  const publicPatterns = passed.filter((p) => p.public).map((p) => ({
    id: p.id,
    horizon: p.horizon,
    keys: p.keys,
    testN: p.ownOnly.n,
    testRate: p.ownOnly.rate,
    // Own-day base rate for the same horizon, so a page can say "vs X% normally".
    baseRate: Number.isFinite(p.ownOnly.base) ? p.ownOnly.base : null,
    line: p.line,
  }));
  const publicDoc = {
    asOf: inputs.asOf,
    source: "year-patterns",
    alerts: false,
    ownDataOnly: true,
    note: "Patterns here passed the later time split on own tcgcsv days only. Fill days are not in this file. Item warnings stay empty while alerts is false.",
    patterns: alertsOn ? publicPatterns : publicPatterns,
    lines: alerts.userLines,
  };
  // Item lines stay empty unless the config flag is on and the warning backtest passed.
  if (!alertsOn || !warningsPassed) publicDoc.lines = [];
  publicDoc.alerts = alertsOn && warningsPassed;

  const byH = {};
  for (const h of HORIZONS) {
    const slice = built.rows.filter((r) => r.horizon === h);
    byH[h] = {
      n: slice.length,
      hits: slice.filter((r) => r.hit).length,
      fill: slice.filter((r) => r.usesFill).length,
      own: slice.filter((r) => !r.usesFill).length,
    };
  }
  const summary = {
    asOf: inputs.asOf,
    generatedAt: now.toISOString(),
    private: true,
    source: "year-patterns",
    minN: MIN_N,
    hitRule: "move of at least 3% and above the median move of items in the same window",
    stride: "one window per horizon, windows do not overlap",
    ownDays: inputs.datedDays,
    ownDayLast: inputs.asOf,
    listingDays: inputs.listDays,
    claimFiles: inputs.crowd.found,
    products: built.products,
    fillProducts: built.fillProducts,
    fillPoints: built.fillPoints,
    ownPoints: built.ownPointCount,
    windows: byH,
    mined,
    passed: passed.length,
    failed: failed.length,
    publicPatterns: publicPatterns.length,
    presentMatches: present.length,
    forming: formingAll.length,
    formingAtOrAboveMinPct: formingFeed.length,
    warningsPassed,
    alertsEnabled: alertsOn && warningsPassed,
    unusual: { counts: unusualCounts, total: events.length, thinSkipped, backtest: unusualBt },
    skipped: [
      inputs.listDays.length < 2 ? `listings counted history has ${inputs.listDays.length} dated night, so a 1 to 2 day drop cannot be scored yet` : null,
      !inputs.crowd.found.length ? "no private claim file, so crowd keys were not used" : null,
      thinSkipped,
    ].filter(Boolean),
  };

  let store;
  try { store = await openPrivate({ root, token }); }
  catch (err) {
    console.error(`year-patterns: ${err.message}; using local data/private`);
    store = await openPrivate({ root, token: "" });
  }
  const dir = join(store.dir, "year-patterns");
  await mkdir(join(dir, "present"), { recursive: true });
  const write = (name, doc) => writeFile(join(dir, name), JSON.stringify(doc, null, 1) + "\n");
  await write("summary.json", summary);
  await write("passed.json", { asOf: inputs.asOf, private: true, patterns: passed });
  await write("failed.json", { asOf: inputs.asOf, private: true, patterns: failed });
  await write("rows.json", {
    asOf: inputs.asOf,
    private: true,
    note: "Test-split rows for each pattern. startSrc and endSrc are own or fill. Fill is only before the first own day.",
    passed: passed.map((p) => ({ id: p.id, n: p.rows.length, rows: p.rows })),
    failed: failed.map((p) => ({ id: p.id, n: p.rows.length, rows: p.rows })),
  });
  await write(join("present", `${inputs.asOf}.json`), {
    asOf: inputs.asOf,
    private: true,
    ownOnly: true,
    note: "Matches use own tcgcsv days only.",
    count: present.length,
    matches: present,
  });
  await write("forming.json", {
    asOf: inputs.asOf,
    private: true,
    count: formingAll.length,
    backtest: formingTests,
    warnings: formingAll,
  });
  await write("alerts.json", alerts);
  await write("unusual.json", {
    asOf: inputs.asOf,
    private: true,
    note: "Private. A forward window may use fill days before the first own day. Public wording is the line field.",
    thinSkipped,
    counts: unusualCounts,
    backtest: unusualBt,
    events: events.slice(0, 200),
    eventCount: events.length,
  });

  await mkdir(join(root, "data/derived"), { recursive: true });
  await writeFile(join(root, "data/derived/year-patterns.json"), JSON.stringify(publicDoc, null, 1) + "\n");

  const paths = [
    "year-patterns/summary.json",
    "year-patterns/passed.json",
    "year-patterns/failed.json",
    "year-patterns/rows.json",
    `year-patterns/present/${inputs.asOf}.json`,
    "year-patterns/forming.json",
    "year-patterns/alerts.json",
    "year-patterns/unusual.json",
  ];
  const pushed = await store.close(paths, `Year patterns ${inputs.asOf}: ${passed.length} passed`);
  return {
    status: "ok",
    asOf: inputs.asOf,
    passed: passed.length,
    failed: failed.length,
    publicPatterns: publicPatterns.length,
    present: present.length,
    forming: formingAll.length,
    warningsPassed,
    unusual: unusualCounts,
    unusualTotal: events.length,
    alertsEnabled: publicDoc.alerts,
    thinSkipped,
    listingDays: inputs.listDays.length,
    claimFiles: inputs.crowd.found,
    windows: byH,
    top: passed.slice(0, 8).map((p) => ({
      id: p.id,
      testN: p.testN,
      testRate: p.testRate,
      ownN: p.ownOnly.n,
      ownRate: p.ownOnly.rate,
      public: p.public,
    })),
    pushed: Boolean(pushed?.pushed),
    paths,
  };
}

if (process.argv[1] && process.argv[1].endsWith("run-year-patterns.mjs")) {
  const out = await runYearPatterns();
  console.log(JSON.stringify({ yearPatterns: out }, null, 2));
}
