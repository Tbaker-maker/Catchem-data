import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dropTiledCycles, feedWindow, separateHalfCopies } from "../lib/public-bundle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function addPoint(map, pid, date, market) {
  const id = Number(pid);
  const value = Number(market);
  const day = String(date || "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !(value > 0)) return;
  if (!map.has(id)) map.set(id, new Map());
  map.get(id).set(day, Math.round(value * 100) / 100);
}

async function readJson(rel) {
  return JSON.parse(await readFile(join(ROOT, rel), "utf8"));
}

async function seriesFor(ids) {
  const map = new Map();
  const want = new Set(ids.map(Number));
  const backfill = {
    509848: "data/history/market-backfill/48.json",
    532841: "data/history/market-backfill/41.json",
    624676: "data/history/market-backfill/76.json",
  };
  for (const id of want) {
    const doc = await readJson(backfill[id]);
    for (const pt of doc.series?.[String(id)] || []) addPoint(map, id, pt?.[0], pt?.[1]);
  }
  for (const day of ["2026-09-26", "2026-09-27", "2026-09-29"]) {
    const doc = await readJson(`data/history/tcgcsv-daily/${day}.json`);
    for (const row of doc.prices || []) {
      if (want.has(Number(row.id))) addPoint(map, row.id, day, row.market);
    }
  }
  const out = new Map();
  for (const id of want) {
    const days = map.get(id);
    const hist = dropTiledCycles([...days.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1));
    const split = separateHalfCopies(hist);
    out.set(id, { hist, split, move30: split.ambiguous ? null : feedWindow(split.keep, 30), move90: split.ambiguous ? null : feedWindow(split.keep, 90) });
  }
  return out;
}

function pricedRows(doc) {
  const rows = [];
  for (const kind of ["singles", "sealed"]) {
    for (const dir of ["up", "down"]) rows.push(...(doc.priceMovers?.[kind]?.[dir] || []));
  }
  if (doc.priceMovers?.day30?.singles) rows.push(doc.priceMovers.day30.singles);
  if (doc.priceMovers?.day30?.sealed) rows.push(doc.priceMovers.day30.sealed);
  return rows;
}

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  };

  const weekly = await readJson("research/digests/weekly-news.json");
  const built = await seriesFor([509848, 532841, 624676]);
  const espeon = built.get(509848).move30;
  const pack = built.get(532841).move30;
  t("Espeon 30-day series is $1.07 on 2026-08-26 to $2.07 on 2026-09-25",
    espeon && espeon.from === 1.07 && espeon.to === 2.07 && espeon.fromDate === "2026-08-26" && espeon.toDate === "2026-09-25" && espeon.pct === 93.5,
    JSON.stringify(espeon));
  t("Temporal Forces pack 30-day series is $11.19 on 2026-08-30 to $9.27 on 2026-09-29",
    pack && pack.from === 11.19 && pack.to === 9.27 && pack.fromDate === "2026-08-30" && pack.toDate === "2026-09-29" && pack.pct === -17.2,
    JSON.stringify(pack));

  const day30 = weekly.priceMovers?.day30 || {};
  t("the weekly 30-day singles example matches that series",
    day30.singles?.fromPrice === espeon?.from && day30.singles?.toPrice === espeon?.to && day30.singles?.percent === espeon?.pct && day30.singles?.fromDate === espeon?.fromDate && day30.singles?.toDate === espeon?.toDate);
  t("the weekly 30-day sealed example matches that series",
    day30.sealed?.fromPrice === pack?.from && day30.sealed?.toPrice === pack?.to && day30.sealed?.percent === pack?.pct && day30.sealed?.fromDate === pack?.fromDate && day30.sealed?.toDate === pack?.toDate);

  // trending.json is a living file: its markets are refreshed by hand (e.g.
  // e9ab044 moved this ETB from $117.28 to $118.26 on 2026-10-05). Pinning the
  // live value broke the nightly run without anything being wrong. The weekly
  // letter froze the trending figure it compared in its omitted note, so the
  // disagreement is checked against that frozen figure plus the two dated
  // tcgcsv-daily files, which never change. The live file is only checked to
  // still map this sku to product 624676.
  const trending = await readJson("trending.json");
  const trend = (trending.plays || []).find((row) => row.sku === "destined-rivals-etb");
  const day27 = (await readJson("data/history/tcgcsv-daily/2026-09-27.json")).prices.find((row) => row.id === 624676);
  const day29 = (await readJson("data/history/tcgcsv-daily/2026-09-29.json")).prices.find((row) => row.id === 624676);
  const omitted = (weekly.priceMovers?.omitted || []).find((row) => row.id === "tcgcsv-624676");
  const keptTrend = (omitted?.figures || []).find((row) => row.file === "trending.json" && row.sku === "destined-rivals-etb");
  const keptDay27 = (omitted?.figures || []).find((row) => row.file === "data/history/tcgcsv-daily/2026-09-27.json");
  const keptDay29 = (omitted?.figures || []).find((row) => row.file === "data/history/tcgcsv-daily/2026-09-29.json");
  t("the catalog day and the partial print and trending disagree",
    day27?.market === 116.85 && day29?.market === 118.37
      && keptDay27?.price === day27.market && keptDay29?.price === day29.market
      && keptTrend?.price === 114.94
      && trend?.tcgplayerProductId === 624676 && trend.market > 0
      && new Set([day27.market, day29.market, keptTrend.price]).size === 3,
    JSON.stringify({ day27: day27?.market, day29: day29?.market, letterTrending: keptTrend?.price, liveTrending: trend?.market, liveId: trend?.tcgplayerProductId }));

  const named = pricedRows(weekly).filter((row) => row.name === "Destined Rivals Elite Trainer Box");
  const figures = new Set((omitted?.figures || []).map((row) => row.price));
  t("Destined Rivals Elite Trainer Box is left out", named.length === 0 && omitted && !omitted.percent && !omitted.toPrice);
  t("the omitted note keeps both disagreeing markets and the catalog-day print",
    figures.has(118.37) && figures.has(116.85) && figures.has(114.94) && omitted.figures.length === 3);
  t("graded slabs are not priced in the weekly letter",
    weekly.priceMovers?.graded === "not included" && pricedRows(weekly).every((row) => !/slab|psa|cgc|bgs|graded/i.test(row.name || "")));

  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("weekly-movers.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("weekly movers ok");
}
