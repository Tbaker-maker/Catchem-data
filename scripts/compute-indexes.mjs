// Build data/indexes from eBay asking-price history and, when present,
// the TCGplayer backfill. The two series are never joined into one line.
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WRONG_MATCH_IDS, WRONG_MATCH_WHY, chainIndex, eraOf, typeKey } from "./lib/index-baskets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/indexes");
const J = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

export async function publishChartIndexes() {
  const today = new Date().toISOString().slice(0, 10);
  const daysBefore = (date, n) => new Date(Date.parse(date) - n * 86400000).toISOString().slice(0, 10);
  const prices = await J("data/sealed-prices.json");
  const products = await J("data/sealed-products.json");
  const heat = await J("data/heat-history.json");
  const quarantine = new Set((await J("data/quarantine.json")).entries.map((e) => e.id));
  const byId = new Map(products.map((p) => [p.id, p]));
  const newest = prices.updatedAt?.slice(0, 10) || heat.reduce((m, r) => (r.date > m ? r.date : m), "");
  const stale = newest < daysBefore(today, 2);

  const excluded = [];
  for (const id of quarantine) excluded.push({ id, name: byId.get(id)?.name || id, reason: "on the quarantine list" });
  for (const id of WRONG_MATCH_IDS) excluded.push({ id, name: byId.get(id)?.name || id, reason: WRONG_MATCH_WHY[id] });

  const livePrice = new Map();
  const liveElig = new Map();
  for (const row of heat) {
    if (!row.price || !row.date || !row.id) continue;
    if (quarantine.has(row.id) || WRONG_MATCH_IDS.has(row.id)) continue;
    if ((row.listingCount ?? 0) < 8) continue;
    const meta = byId.get(row.id);
    if (!meta || !eraOf(meta.setId) || !typeKey(meta.subtype)) continue;
    if (!livePrice.has(row.id)) livePrice.set(row.id, new Map());
    livePrice.get(row.id).set(row.date, row.price);
    if (!liveElig.has(row.date)) liveElig.set(row.date, new Set());
    liveElig.get(row.date).add(row.id);
  }
  const liveDates = [...liveElig.keys()].sort();

  const backfillPrice = new Map();
  const backfillDir = join(ROOT, "data/history/tcgplayer-market");
  let backfillDates = [];
  let backfillGap = [{ from: daysBefore(today, 365), to: daysBefore(today, 1), note: "No TCGplayer history file is in this run, so this series is empty. It is not filled from eBay." }];
  try {
    const cov = JSON.parse(await readFile(join(backfillDir, "coverage.json"), "utf8"));
    if (cov.archive && cov.archive.available === false) {
      backfillGap = [{ from: cov.window.from, to: cov.window.to, note: "TCGCSV has not published the price archive. Only days we could read live are in this series. Missing days are not filled in." }];
    }
    const names = (await readdir(backfillDir)).filter((n) => n.endsWith(".json") && !["mapping.json", "unmatched.json", "coverage.json"].includes(n));
    const dates = new Set();
    for (const name of names) {
      const doc = JSON.parse(await readFile(join(backfillDir, name), "utf8"));
      if (quarantine.has(doc.id) || WRONG_MATCH_IDS.has(doc.id)) continue;
      const pts = (doc.points || []).filter((p) => p.market > 0 && p.date);
      if (!pts.length) continue;
      backfillPrice.set(doc.id, new Map(pts.map((p) => [p.date, p.market])));
      for (const p of pts) dates.add(p.date);
    }
    backfillDates = [...dates].sort();
  } catch { /* backfill not on this branch */ }

  function seriesFor(memberIds) {
    const members = new Set(memberIds);
    const live = chainIndex(liveDates, livePrice, liveElig, members);
    const backElig = new Map(backfillDates.map((d) => [d, new Set(memberIds.filter((id) => backfillPrice.get(id)?.has(d)))]));
    const back = backfillDates.length ? chainIndex(backfillDates, backfillPrice, backElig, members) : { base: 100, points: [], gaps: [] };
    return {
      backfill: {
        source: "TCGplayer market price",
        available: back.points.length > 0,
        base: 100,
        points: back.points.map(({ basket, ...p }) => p),
        gaps: back.points.length > 1 ? back.gaps : backfillGap,
      },
      live: {
        source: "eBay asking prices",
        available: !stale && live.points.length > 0,
        withheld: stale ? `Newest sealed price file is ${newest}, more than 2 days before ${today}. This index is not published.` : null,
        base: 100,
        points: stale ? [] : live.points.map(({ basket, ...p }) => p),
        gaps: live.gaps,
      },
      break: "The TCGplayer series and the eBay series are separate. They are not spliced into one line.",
    };
  }

  function doc(id, name, memberIds) {
    return {
      id, name, asOf: newest,
      method: "Fixed basket, reset each quarter. Each day's move is the median price change of products priced on both days, with equal weight. A value-weighted line gives a dearer product a bigger say. A day with no shared prices is a gap.",
      basket: memberIds.map((pid) => {
        const p = byId.get(pid);
        return { id: pid, name: p?.name || pid, type: typeKey(p?.subtype), era: eraOf(p?.setId) };
      }),
      series: seriesFor(memberIds),
    };
  }

  const universe = [...livePrice.keys()];
  await mkdir(OUT, { recursive: true });
  const written = [];
  async function put(file, body) {
    if (!body.basket.length) return null;
    await writeFile(join(OUT, file), JSON.stringify(body, null, 2));
    written.push(file);
    return body;
  }

  const headline = await put("sealed.json", doc("sealed", "Sealed Index", universe));
  for (const type of ["booster-box", "etb", "pc-etb", "bundle", "pack"]) {
    const ids = universe.filter((id) => typeKey(byId.get(id)?.subtype) === type);
    await put(`type-${type}.json`, doc(`type-${type}`, type, ids));
  }
  const hiddenEras = [];
  for (const era of ["WOTC / vintage", "XY", "Sun & Moon", "Sword & Shield", "Scarlet & Violet", "Mega Evolution"]) {
    const ids = universe.filter((id) => eraOf(byId.get(id)?.setId) === era);
    const slug = era.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const body = await put(`era-${slug}.json`, doc(`era-${slug}`, era, ids));
    if (!body) hiddenEras.push({ era, reason: "No product in this era cleared the listing, quarantine, and match checks." });
  }
  await writeFile(join(OUT, "manifest.json"), JSON.stringify({
    asOf: newest, stale,
    sourceLive: "eBay asking prices",
    sourceBackfill: "TCGplayer market price",
    rawChase: { hidden: true, products: 0, reason: "No chase-single price history is on file, so the Raw Chase Index is not published." },
    excluded, hiddenEras, files: written,
  }, null, 2));
  console.log(`indexes ${written.length}, stale=${stale}, newest=${newest}`);
  return headline;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await publishChartIndexes();
