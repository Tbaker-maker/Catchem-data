// Build data/indexes from eBay asking-price history and, when present,
// the TCGplayer backfill. The two series are never joined into one line.
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WRONG_MATCH_IDS, WRONG_MATCH_WHY, enterIndex, eraOf, typeKey } from "./lib/index-baskets.mjs";
import { PPT_SOURCE, TCGCSV_SOURCE, loadMarketHistory } from "./lib/market-history.mjs";

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

  // TCGplayer market history: TCGCSV live days plus the PokemonPriceTracker
  // daily backfill (both TCGplayer market price, kept in separate folders and
  // labelled per source). A move is only ever taken within one source.
  const backfillPrice = new Map();
  let backfillDates = [];
  let pairPrice = null;
  let backfillCoverage = null;
  let backfillGap = [{ from: daysBefore(today, 365), to: daysBefore(today, 1), note: "No TCGplayer history file is in this run, so this series is empty. It is not filled from eBay." }];
  try {
    const hist = await loadMarketHistory(ROOT);
    pairPrice = hist.pairPrice;
    backfillCoverage = hist.coverage;
    const dates = new Set();
    for (const id of hist.ids) {
      if (quarantine.has(id) || WRONG_MATCH_IDS.has(id)) continue;
      const m = hist.priceMap.get(id);
      if (!m?.size) continue;
      backfillPrice.set(id, m);
      for (const d of m.keys()) dates.add(d);
    }
    backfillDates = [...dates].sort();
    if (backfillDates.length) {
      backfillGap = [{ from: daysBefore(backfillDates[0], 365), to: daysBefore(backfillDates[0], 1), note: "No TCGplayer history before this date is on file (the TCGCSV archive is offline and PokemonPriceTracker returns 180 days). Nothing earlier is filled in." }];
    }
  } catch { /* no history on this branch */ }

  function seriesFor(memberIds) {
    const members = new Set(memberIds);
    const live = enterIndex(liveDates, livePrice, liveElig, members);
    const backElig = new Map(backfillDates.map((d) => [d, new Set(memberIds.filter((id) => backfillPrice.get(id)?.has(d)))]));
    const back = backfillDates.length ? enterIndex(backfillDates, backfillPrice, backElig, members, pairPrice) : { base: 100, points: [], gaps: [] };
    return {
      backfill: {
        source: "TCGplayer market price",
        anchorRequested: "2026-03-31",
        anchorUsed: back.points[0]?.date || null,
        anchorLevel: 100,
        anchorReason: back.points[0]?.date === "2026-03-31"
          ? "First real TCGplayer day on file is 2026-03-31. Level 100 starts there. No earlier day was invented."
          : `No TCGplayer price on 2026-03-31 is on file. Level 100 starts on ${back.points[0]?.date || "no day"}. The days before that are a gap.`,
        sources: [
          { label: PPT_SOURCE, folder: "data/history/ppt-sealed", role: "daily history backfill, 2026-03-31 to 2026-09-25" },
          { label: TCGCSV_SOURCE, folder: "data/history/tcgplayer-market", role: "live daily append from 2026-09-25; wins on any day both have" },
        ],
        sameSourceMoves: "Each day's move uses two prices from the same source. No move is computed across sources.",
        available: back.points.length > 0,
        start: back.points[0]?.date || null,
        base: 100,
        points: back.points.map(({ basket, ...p }) => p),
        gaps: back.points.length > 1 ? [...backfillGap, ...back.gaps] : backfillGap,
      },
      live: {
        source: "eBay asking prices",
        anchorRequested: "2026-03-31",
        anchorUsed: live.points[0]?.date || null,
        anchorLevel: 100,
        anchorReason: "No eBay asking prices before the first day in heat history. Level 100 starts on that day. March 31 was not invented.",
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
      method: "Chain-linked. A name joins on the first day it has a price and does not move the level that day. Its first return is the next day it is priced. Each day's move is the median price change of names priced on both days. A value-weighted line gives a dearer product a bigger say. A day with no shared prices is a gap. Nothing is filled in.",
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
    sourceBackfill: "TCGplayer market price (PokemonPriceTracker daily backfill + TCGCSV live days)",
    backfillCoverage,
    rawChase: { hidden: true, products: 0, reason: "Chase-single history is on file (data/history/singles-rarebox/), but it is change-only and stops on 2026-09-15, so a daily chain-linked index would need filled-in days. The Raw Chase Index is not published." },
    excluded, hiddenEras, files: written,
  }, null, 2));
  await writeSinglesAndSlabs(newest);
  console.log(`indexes ${written.length}, stale=${stale}, newest=${newest}`);
  return headline;
}

async function writeSinglesAndSlabs(asOf) {
  let singles = { cards: [] };
  try { singles = await J("data/singles-prices.json"); } catch { /* none */ }
  const prices = new Map();
  const elig = new Map();
  const members = [];
  for (const card of singles.cards || []) {
    const id = card.cardId || card.id;
    if (!id) continue;
    const map = new Map();
    for (const row of card.priceHistory || []) {
      if (!row?.date || !(row.price > 0)) continue;
      map.set(row.date, row.price);
      if (!elig.has(row.date)) elig.set(row.date, new Set());
      elig.get(row.date).add(id);
    }
    if (!map.size) continue;
    prices.set(id, map);
    members.push(id);
  }
  const dates = [...elig.keys()].sort();
  const series = dates.length ? enterIndex(dates, prices, elig, members) : { base: 100, points: [], gaps: [] };
  const start = series.points[0]?.date || null;
  await writeFile(join(OUT, "singles.json"), JSON.stringify({
    id: "singles",
    name: "Singles Index",
    asOf: start,
    source: "TCGplayer market price",
    anchorRequested: "2026-03-31",
    anchorUsed: start,
    anchorLevel: 100,
    anchorReason: start
      ? `First real singles day on file is ${start}. March 31 was not invented. Days between observations are gaps.`
      : "No singles price history on file. No index level was invented.",
    method: "Chain-linked. A card joins on its first priced day and does not move the level that day. Sealed products are not in this index.",
    basket: members.length,
    series: { base: 100, points: series.points, gaps: series.gaps },
  }, null, 2));
  await writeFile(join(OUT, "slabs-status.json"), JSON.stringify({
    asOf,
    indexed: false,
    slabsWith30Days: 0,
    required: 30,
    source: "none on file",
    note: "No slab history is on file. 0 of 30 slabs have 30 days, so no slabs index was started. Slabs are not mixed into singles.",
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await publishChartIndexes();
