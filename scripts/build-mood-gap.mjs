// Market breadth and the private mood gap pack.
// Thresholds come from MOOD_GAP_CONFIG. If that file is missing, nothing public is written.
// Talk text is scored and dropped. Titles and comments are not stored.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMoodGap, rowsFromDaily, slicesFromMeter, viewWeight, addDays, productBreadth, indexWindow, scoreBacktest } from "./lib/mood-gap.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

export function sealedIdSet(products) {
  const ids = new Set();
  const list = Array.isArray(products) ? products : (products?.products || []);
  for (const row of list) {
    const id = String(row?.tcgPlayerId ?? "");
    if (/^\d+$/.test(id)) ids.add(id);
  }
  return ids;
}

export function talkFromArchives({ videos = [], posts = [], boardDay, freshnessDays }) {
  const sources = [];
  const add = (rows, source, dateOf, textOf, viewsOf) => {
    for (const row of rows || []) {
      const asOf = String(dateOf(row) || "").slice(0, 10);
      const age = boardDay && asOf ? Math.round((Date.parse(`${boardDay}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86400000) : null;
      if (!asOf || age == null || age < 0 || !(Number(freshnessDays) >= 0) || age > Number(freshnessDays)) continue;
      const texts = textOf(row).map((line) => String(line || "")).filter(Boolean);
      if (!texts.length) continue;
      sources.push({ asOf, source, texts, weight: viewWeight(viewsOf ? viewsOf(row) : 0) });
    }
  };
  add(videos, "youtube", (row) => row.publishedAt || row.date, (row) => [row.title, ...(row.topComments || []).map((item) => item?.text)], (row) => row.views);
  add(posts, "x", (row) => row.created_at, (row) => [row.text], () => 0);
  return sources;
}

export async function loadMoodInputs(root, boardDay, cfg) {
  const [indexes, meter, eras, cohorts, flags, sealedProducts] = await Promise.all([
    readJson(join(root, "research/assets/public/indexes.json")),
    readJson(join(root, "research/assets/public/market-meter.json")),
    readJson(join(root, "data/era-index-history-tcg.json")),
    readJson(join(root, "data/cohort-history.json")),
    readJson(join(root, "data/flags.json")),
    readJson(join(root, "data/sealed-products.json")),
  ]);
  const ids = sealedIdSet(sealedProducts);
  const days = {};
  for (const span of [7, 30]) {
    const asked = new Date(Date.parse(`${boardDay}T00:00:00Z`) - span * 86400000).toISOString().slice(0, 10);
    for (const day of [asked, boardDay]) {
      if (days[day]) continue;
      const doc = await readJson(join(root, "data/history/tcgcsv-daily", `${day}.json`));
      if (!doc) continue;
      days[day] = rowsFromDaily(doc, ids).rows;
    }
    if (!days[asked]) {
      const names = Object.keys(days);
      void names;
      const startDoc = await nearestDaily(root, asked, ids);
      if (startDoc) days[startDoc.day] = startDoc.rows;
    }
  }
  return {
    boardDay,
    cfg,
    flag: flags?.flags?.["reads.moodGap"]?.value === true,
    days,
    indexes: { singles: indexes?.singles || [], sealed: indexes?.sealed || [] },
    eras: eras?.entries || [],
    cohorts: cohorts?.entries || [],
    slices: slicesFromMeter(meter),
  };
}

async function nearestDaily(root, target, ids) {
  let hit = "";
  for (let i = 1; i <= 14; i += 1) {
    const day = new Date(Date.parse(`${target}T00:00:00Z`) - i * 86400000).toISOString().slice(0, 10);
    const doc = await readJson(join(root, "data/history/tcgcsv-daily", `${day}.json`));
    if (doc?.date) { hit = doc; break; }
  }
  if (!hit) return null;
  const parsed = rowsFromDaily(hit, ids);
  return parsed.rows.length ? parsed : null;
}

export function weeklyCalls({ sundays = [], dayRows = {}, singles = [], sealed = [], videos = [], posts = [], cfg }) {
  const calls = [];
  for (const day of sundays) {
    const pack = buildMoodGap({
      boardDay: day,
      cfg,
      flag: false,
      days: dayRows,
      indexes: { singles, sealed },
      talk: talkFromArchives({ videos, posts, boardDay: day, freshnessDays: Number(cfg?.freshnessDays) }),
    });
    if (pack.T == null || pack.D == null || pack.G == null) continue;
    const next7 = addDays(day, 7);
    const next30 = addDays(day, 30);
    const breadth = dayRows[day] && dayRows[next7] ? productBreadth(dayRows[day], dayRows[next7]).all : null;
    const idx = indexWindow(singles, next30, 30);
    const row = { date: day, call: pack.G > 0, G: pack.G, T: pack.T, D: pack.D };
    if (breadth && breadth.n > 0) row.hit7 = breadth.up > breadth.down;
    if (idx && idx.held === false && idx.pct != null) row.hit30 = idx.pct > 0;
    calls.push(row);
  }
  const ready = calls.filter((row) => typeof row.hit7 === "boolean" && typeof row.hit30 === "boolean");
  return { calls: ready.map(({ date, call, hit7, hit30 }) => ({ date, call, hit7, hit30 })), backtest: scoreBacktest(ready, cfg?.minBacktestN) };
}

export function storePack(pack) {
  return {
    asOf: pack.asOf,
    held: pack.held,
    D: pack.D,
    T: pack.T,
    G: pack.G,
    talkHeld: pack.talkHeld,
    breadth7: pack.breadth7,
    breadth30: pack.breadth30,
    singles7: pack.singles7,
    sealed7: pack.sealed7,
    singles30: pack.singles30,
    sealed30: pack.sealed30,
    indexGap7: pack.indexGap7,
    indexGap30: pack.indexGap30,
    sets: pack.sets,
    facts: pack.facts,
    plain: pack.plain,
    sinceLastWeek: pack.sinceLastWeek,
    share: pack.share,
    backtest: pack.backtest,
    publicRead: pack.publicRead,
  };
}

async function main() {
  const cfgPath = process.env.MOOD_GAP_CONFIG || "";
  const cfg = cfgPath ? await readJson(cfgPath) : null;
  const meter = await readJson(join(ROOT, "research/assets/public/market-meter.json"));
  const boardDay = String(meter?.asOf || "").slice(0, 10);
  if (!cfg || !boardDay) {
    console.log(JSON.stringify({ held: "thresholds missing", publicRead: null, asOf: boardDay || null }));
    return;
  }
  const inputs = await loadMoodInputs(ROOT, boardDay, cfg);
  const videos = process.env.MOOD_GAP_VIDEOS ? JSON.parse(await readFile(process.env.MOOD_GAP_VIDEOS, "utf8")) : [];
  const posts = process.env.MOOD_GAP_POSTS ? JSON.parse(await readFile(process.env.MOOD_GAP_POSTS, "utf8")) : [];
  const talk = talkFromArchives({ videos, posts, boardDay, freshnessDays: Number(cfg.freshnessDays) });
  const pack = buildMoodGap({ ...inputs, talk, backtestRows: [] });
  const stored = storePack(pack);
  if (pack.publicRead && inputs.flag) {
    const out = join(ROOT, "research/assets/public/feed/mood-gap.json");
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify({ asOf: boardDay, read: pack.publicRead, section: pack.sections[0] || null }, null, 2) + "\n");
  }
  const summary = {
    asOf: stored.asOf,
    publicRead: stored.publicRead ? stored.publicRead.id : null,
    T: stored.T,
    D: stored.D,
    G: stored.G,
    talkHeld: stored.talkHeld,
    facts: (stored.facts || []).length,
    breadth7: stored.breadth7 ? { n: stored.breadth7.n, up: stored.breadth7.up, start: stored.breadth7.start, end: stored.breadth7.end, held: stored.breadth7.held } : null,
    backtest: stored.backtest,
  };
  console.log(JSON.stringify(summary));
  if (process.env.MOOD_GAP_OUT) {
    await mkdir(dirname(process.env.MOOD_GAP_OUT), { recursive: true });
    await writeFile(process.env.MOOD_GAP_OUT, JSON.stringify(stored, null, 2) + "\n");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
