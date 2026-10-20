// Nightly market meter. Reads dated set indexes and eBay listings counted.
// Scores each component against later index moves. Publishes only the
// components the private model-spec marks as passed. No spec, no new file.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { open } from "node:fs/promises";
import {
  addDays, median, windowPct, percentileScore, shareScore, breadthFrom,
  scoreCalls, packSlice, factLine, COMPONENT_METER,
} from "./lib/market-meter.mjs";
import { applyModelSpec } from "./lib/model-spec.mjs";
import { openPrivate } from "./lib/private-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SETS = join(ROOT, "research/assets/public/sets");
const r1 = (n) => Math.round(Number(n) * 10) / 10;

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

async function readSetHead(path) {
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(160000);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    let text = buf.slice(0, bytesRead).toString("utf8");
    const cut = text.indexOf('"items"');
    if (cut < 0) return null;
    text = text.slice(0, cut).replace(/,\s*$/, "") + "}";
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    await fh.close();
  }
}

function cleanSeries(raw) {
  const out = [];
  for (const p of raw || []) {
    const d = String(p?.d || "").slice(0, 10);
    const v = Number(p?.v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !(v > 0)) continue;
    if (out.length && out[out.length - 1].d === d) out[out.length - 1].v = v;
    else out.push({ d, v });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return out;
}

function prepare(series) {
  const by = new Map(series.map((p) => [p.d, p.v]));
  const pct7 = new Map();
  const hist = [];
  for (const p of series) {
    const pct = windowPct(series, p.d, 7);
    if (pct == null) continue;
    pct7.set(p.d, pct);
    hist.push({ d: p.d, pct, abs: Math.abs(pct) });
  }
  return { series, by, pct7, hist };
}

function priorNums(hist, day, days, key) {
  const from = addDays(day, -days);
  const out = [];
  for (const row of hist) {
    if (row.d >= day) break;
    if (row.d >= from) out.push(row[key]);
  }
  return out;
}

function priorValues(series, day, n = 90) {
  const out = [];
  for (const p of series) {
    if (p.d >= day) break;
    out.push(p.v);
  }
  return out.slice(-n);
}

function memberRow(prep, day) {
  const pct = prep.pct7.get(day);
  if (pct == null) return null;
  const v = prep.by.get(day);
  const priorAbs = priorNums(prep.hist, day, 90, "abs");
  const prevVals = priorValues(prep.series, day, 90);
  const medAbs = median(priorAbs);
  const mover = priorAbs.length >= 8 && medAbs != null ? Math.abs(pct) > medAbs : null;
  const high = prevVals.length >= 20 ? v >= Math.max(...prevVals) : null;
  return { pct, mover, high };
}

function sliceParts(members, day, noun, listings) {
  const rows = [];
  for (const prep of members) {
    const row = memberRow(prep, day);
    if (row) rows.push(row);
  }
  const parts = {};
  const breadth = breadthFrom(rows.map((row) => row.pct));
  if (breadth) parts.breadth = { score: breadth.score, fact: factLine("breadth", breadth, noun), info: breadth };
  const mover = shareScore(rows.map((row) => row.mover));
  if (mover) parts.movers = { score: mover.score, fact: factLine("movers", mover, noun) };
  const highs = shareScore(rows.map((row) => row.high));
  if (highs) parts.newHighs = { score: highs.score, fact: factLine("newHighs", highs, noun) };
  const med = median(rows.map((row) => row.pct));
  if (med != null) parts._medianPct = med;
  if (listings) Object.assign(parts, listings);
  return parts;
}

function addMomentum(days, noun) {
  const hist = [];
  for (const day of days) {
    if (day.parts._medianPct == null) continue;
    const prior = hist.filter((row) => row.d < day.d && row.d >= addDays(day.d, -90)).map((row) => row.pct);
    const score = percentileScore(day.parts._medianPct, prior);
    hist.push({ d: day.d, pct: day.parts._medianPct });
    if (score == null) continue;
    day.parts.momentum = {
      score,
      fact: factLine("momentum", { score, pct: day.parts._medianPct }, noun),
    };
  }
}

function listingPanel(rows) {
  const byDate = new Map();
  for (const row of rows || []) {
    const d = String(row.date || "").slice(0, 10);
    const n = Number(row.listingCount);
    const id = String(row.id || "");
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(n) || n < 0) continue;
    if (!byDate.has(d)) byDate.set(d, new Map());
    byDate.get(d).set(id, n);
  }
  const dates = [...byDate.keys()].sort();
  const changes = [];
  const goneRates = [];
  const out = new Map();
  for (let i = 1; i < dates.length; i += 1) {
    const d = dates[i];
    const prevD = dates[i - 1];
    if (addDays(prevD, 1) !== d) continue;
    const now = byDate.get(d);
    const prev = byDate.get(prevD);
    let prevSum = 0;
    let nowSum = 0;
    let gone = 0;
    let changed = 0;
    let both = 0;
    for (const [id, n0] of prev) {
      if (!now.has(id)) continue;
      const n1 = now.get(id);
      both += 1;
      prevSum += n0;
      nowSum += n1;
      if (n1 !== n0) changed += 1;
      if (n1 < n0) gone += n0 - n1;
    }
    if (both < 8 || !(prevSum > 0)) continue;
    const chg = ((nowSum - prevSum) / prevSum) * 100;
    const rate = (gone / prevSum) * 100;
    const priorChg = changes.filter((row) => row.d < d).map((row) => row.chg);
    const priorGone = goneRates.filter((row) => row.d < d).map((row) => row.rate);
    const supply = percentileScore(chg, priorChg.map((n) => -n).concat(priorChg).length ? priorChg : []);
    // Rising listings is fear, so invert the percentile of the change.
    const supplyScore = percentileScore(-chg, priorChg.map((n) => -n));
    const goneScore = percentileScore(rate, priorGone);
    const churn = shareScore([true, true].slice(0, 0).concat(Array.from({ length: changed }, () => true).concat(Array.from({ length: both - changed }, () => false))), 8);
    const block = {};
    if (supplyScore != null) block.supply = { score: supplyScore, fact: factLine("supply", { chg }) };
    if (churn) block.churn = { score: churn.score, fact: factLine("churn", churn) };
    if (goneScore != null) block.sellThrough = { score: goneScore, fact: factLine("sellThrough", { rate }) };
    out.set(d, block);
    changes.push({ d, chg });
    goneRates.push({ d, rate });
    void supply;
  }
  return out;
}

function forwards(members, day, horizons) {
  const out = {};
  for (const h of horizons) {
    const end = addDays(day, h);
    const vals = [];
    for (const prep of members) {
      const pct = windowPct(prep.series, end, h);
      if (pct != null) vals.push(pct);
    }
    out[h] = vals.length >= 8 ? median(vals) : null;
  }
  return out;
}

function panelFor(members, noun, listingByDay, horizons) {
  const dates = new Set();
  for (const prep of members) for (const d of prep.pct7.keys()) dates.add(d);
  const days = [...dates].sort().map((d) => ({ d, parts: sliceParts(members, d, noun, listingByDay?.get(d) || null), fwd: forwards(members, d, horizons) }));
  addMomentum(days, noun);
  return days;
}

function studyComponent(days, key, kind, specBits) {
  const byH = {};
  let best = null;
  for (const h of [7, 14, 30]) {
    const rows = days.filter((day) => day.parts[key]?.score != null && Number.isFinite(day.fwd[h])).map((day) => ({ score: day.parts[key].score, fwd: day.fwd[h] }));
    const scored = scoreCalls(rows, { kind, hitPct: specBits.hitPct, minN: specBits.minN });
    byH[`${h}d`] = scored;
    if (scored.published && (!best || scored.rate > best.rate)) best = { horizon: h, ...scored };
  }
  return { key, meter: kind, pass: Boolean(best), best, horizons: byH };
}

const LEFT_OUT = [
  { id: "priceCuts", why: "No dated file records which eBay listings were repriced lower." },
  { id: "askGap", why: "The gap between the cheapest real listing and the median ask is not a dated history." },
  { id: "premiumRatio", why: "Premium ratio flags have no dated history in the price files, so they are not scored." },
  { id: "setHeat", why: "Set heat states are one night, not a history that can be scored." },
];

const FAILED_WHY = {
  supply: "Listings counted history is too short to score supply direction.",
  sellThrough: "Listings counted history is too short to score listings gone.",
  churn: "Listings counted churn did not clear the private proof bar.",
};

function leftOutFor(spec) {
  const rows = LEFT_OUT.slice();
  for (const [id, why] of Object.entries(FAILED_WHY)) {
    if (!spec?.components?.[id]) rows.push({ id, why });
  }
  return rows;
}

function publicSlice(row) {
  if (!row) return null;
  return {
    mood: row.mood,
    moodBand: row.moodBand,
    heat: row.heat,
    heatBand: row.heatBand,
    used: row.used,
    moodUsed: row.moodUsed,
    heatUsed: row.heatUsed,
    reasons: row.reasons,
    inputs: (row.inputs || []).map((part) => ({ id: part.id, meter: part.meter, score: part.score, fact: part.fact })),
  };
}

async function main() {
  const publish = process.argv.includes("--publish");
  const loaded = await applyModelSpec({ root: ROOT, force: true });
  const spec = loaded.marketMeter;
  const files = (await readdir(SETS)).filter((name) => name.endsWith(".json"));
  const sets = [];
  for (const name of files) {
    const doc = await readSetHead(join(SETS, name));
    if (!doc?.slug) continue;
    const single = prepare(cleanSeries(doc.singleIndex));
    const sealed = prepare(cleanSeries(doc.sealedIndex));
    if (!single.series.length && !sealed.series.length) continue;
    sets.push({
      slug: String(doc.slug),
      name: String(doc.name || doc.slug),
      era: String(doc.era || ""),
      release: String(doc.release || "").slice(0, 10),
      single,
      sealed,
    });
  }
  const heat = await readJson(join(ROOT, "data/heat-history.json"));
  const listingByDay = listingPanel(Array.isArray(heat) ? heat : []);
  const vintageBefore = spec?.vintageBefore || "2003-06-01";
  const modernEras = new Set(spec?.modernEras || ["Scarlet & Violet", "Mega Evolution"]);
  const baskets = [];
  for (const set of sets) {
    const vintage = /^\d{4}-\d{2}-\d{2}$/.test(set.release) && set.release < vintageBefore;
    const modern = modernEras.has(set.era);
    if (set.single.series.length) baskets.push({ ...set, prep: set.single, side: "singles", vintage, modern });
    if (set.sealed.series.length) baskets.push({ ...set, prep: set.sealed, side: "sealed", vintage, modern });
  }
  const groups = {
    market: { noun: "sets", members: baskets.map((b) => b.prep), listings: listingByDay },
    singles: { noun: "singles", members: baskets.filter((b) => b.side === "singles").map((b) => b.prep), listings: null },
    sealed: { noun: "sealed", members: baskets.filter((b) => b.side === "sealed").map((b) => b.prep), listings: listingByDay },
    vintage: { noun: "Vintage sets", members: baskets.filter((b) => b.vintage).map((b) => b.prep), listings: null },
    modern: { noun: "Modern sets", members: baskets.filter((b) => b.modern).map((b) => b.prep), listings: null },
  };
  const eras = {};
  for (const era of new Set(sets.map((set) => set.era).filter(Boolean))) {
    eras[era] = { noun: era, members: baskets.filter((b) => b.era === era).map((b) => b.prep), listings: null };
  }
  const horizons = [7, 14, 30];
  const built = {};
  for (const [key, group] of Object.entries(groups)) {
    built[key] = panelFor(group.members, group.noun, group.listings, horizons);
  }
  const study = {};
  const studyBits = { hitPct: spec?.hitPct || 3, minN: spec?.minN || 20 };
  for (const key of Object.keys(COMPONENT_METER)) {
    study[key] = studyComponent(built.market, key, COMPONENT_METER[key], studyBits);
  }
  const studyDoc = {
    asOf: built.market.at(-1)?.d || "",
    sets: sets.length,
    baskets: baskets.length,
    listingDays: listingByDay.size,
    hitPct: studyBits.hitPct,
    minN: studyBits.minN,
    components: study,
  };
  await mkdir(join(ROOT, "data/private/market-meter"), { recursive: true });
  const studyBody = JSON.stringify(studyDoc, null, 1) + "\n";
  await writeFile(join(ROOT, "data/private/market-meter/scores.json"), studyBody);
  console.log(Object.entries(study).map(([key, row]) => `${key}:${row.pass ? "pass" : "out"}`).join(" "));
  if (process.env.PRIVATE_DATA_TOKEN) {
    try {
      const store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN });
      await mkdir(join(store.dir, "market-meter"), { recursive: true });
      await writeFile(join(store.dir, "market-meter/scores.json"), studyBody);
      const saved = await store.close(["market-meter/scores.json"], "data: market meter scores");
      console.log(`market meter private scores ${saved.pushed ? "pushed" : "kept"}`);
    } catch (err) {
      console.log(`market meter private scores not pushed (${err.message || "error"})`);
    }
  }

  if (!publish) return;
  if (!spec) {
    console.log("market meter: spec missing, wrote no public file");
    return;
  }
  const latest = built.market.at(-1)?.d || "";
  const take = (key) => {
    const days = built[key];
    const last = days.filter((day) => day.d === latest).at(-1) || days.at(-1);
    if (!last) return null;
    const packed = packSlice(last.parts, spec);
    if (!packed) return null;
    const history = [];
    for (const day of days) {
      const row = packSlice(day.parts, spec);
      if (!row || row.mood == null || row.heat == null) continue;
      history.push({ d: day.d, mood: row.mood, heat: row.heat });
    }
    return { ...publicSlice(packed), history };
  };
  const eraOut = {};
  for (const [era, group] of Object.entries(eras)) {
    const days = panelFor(group.members, group.noun, null, [7]);
    const last = days.at(-1);
    if (!last || last.d !== latest) continue;
    const packed = packSlice(last.parts, spec);
    if (packed) eraOut[era] = publicSlice(packed);
  }
  const setOut = {};
  let setHidden = 0;
  for (const set of sets) {
    const full = await readJson(join(SETS, `${set.slug}.json`));
    const items = Array.isArray(full?.items) ? full.items : [];
    const pcts = [];
    for (const item of items) {
      const hist = Array.isArray(item?.hist) ? item.hist : [];
      const series = cleanSeries(hist.map((p) => (Array.isArray(p) ? { d: p[0], v: p[1] } : p)));
      const pct = windowPct(series, latest, 7);
      if (pct != null) pcts.push(pct);
    }
    const members = [set.single, set.sealed].filter((prep) => prep.series.length);
    if (!members.length && pcts.length < 8) { setHidden += 1; continue; }
    const days = members.length ? panelFor(members, set.name, null, [7]) : [];
    const last = days.at(-1);
    const parts = last && last.d === latest ? { ...last.parts } : {};
    delete parts._medianPct;
    const breadth = breadthFrom(pcts);
    if (breadth) parts.breadth = { score: breadth.score, fact: factLine("breadth", breadth, "priced cards") };
    // One set is not a crowd. A single index can still say if it moved more than its own week.
    if (members.length && members.length < 8) {
      const flags = members.map((prep) => memberRow(prep, latest)).filter(Boolean);
      const mover = shareScore(flags.map((row) => row.mover), 1);
      const highs = shareScore(flags.map((row) => row.high), 1);
      if (mover) parts.movers = { score: mover.score, fact: mover.score >= 50 ? `${set.name} moved more than its usual week` : `${set.name} did not move more than its usual week` };
      if (highs) parts.newHighs = { score: highs.score, fact: highs.score >= 50 ? `${set.name} is at a 90 day high` : `${set.name} is under its 90 day high` };
    }
    const packed = packSlice(parts, spec);
    if (!packed) { setHidden += 1; continue; }
    setOut[set.slug] = { name: set.name, era: set.era, ...publicSlice(packed) };
  }
  const market = take("market");
  const singles = take("singles");
  const sealed = take("sealed");
  const vintage = take("vintage");
  const modern = take("modern");
  if (!market || market.mood == null || market.heat == null) {
    console.log("market meter: under the private minimum, wrote no public file");
    return;
  }
  const doc = {
    asOf: latest,
    published: true,
    source: "TCGplayer market indexes. eBay listings counted where a component used them.",
    components: Object.keys(spec.components).sort(),
    leftOut: leftOutFor(spec),
    hidden: [
      !vintage ? { id: "vintage", why: "WOTC set indexes are too short for two proven inputs on the same day." } : null,
    ].filter(Boolean),
    market,
    singles,
    sealed,
    vintage,
    modern,
    eras: eraOut,
    sets: setOut,
  };
  const body = JSON.stringify(doc);
  await mkdir(join(ROOT, "data/derived"), { recursive: true });
  await writeFile(join(ROOT, "data/derived/market-meter.json"), body);
  await writeFile(join(ROOT, "research/assets/public/market-meter.json"), body);
  console.log(`market meter ${latest} mood ${market.mood} ${market.moodBand} heat ${market.heat} ${market.heatBand} used ${market.used} history ${market.history.length} sets ${Object.keys(setOut).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
