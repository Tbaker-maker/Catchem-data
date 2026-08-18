// scripts/fetch-singles-enrichment.mjs — Wave B minimum viable (INTERNAL ONLY)
// For CONFIRMED chase printings only (needsReview:false in singles-prices.json),
// pulls PPT /cards enrichment: sellers/listings/recentSales, daily sales
// volume, and eBay sold-by-grade (PSA 8/9/10) → data/singles-enrichment.json.
// Computes the Grading Premium per card:
//   GP(psa10) = psa10 sold median − raw market − $79.99 (PSA floor, Aug 2026)
//   GP(psa9)  = psa9  sold median − raw market − $79.99
// Built 2026-08-18 against real captured shapes (research/eval-samples/
// ppt-cards-history-RAW.json, ppt-cards-ebay-RAW.json), not docs.
// Provenance split hard per Trust Standard: "TCGplayer market via PPT" vs
// "eBay sold via PPT" are different claims. ALL output is licensing-gated
// (research/ppt-licensing-note.md) — internal instruments only.
// Key: POKEMONPRICETRACKER_API_KEY env (Tyler's shell; never persisted).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
if (!KEY) { console.error("Missing POKEMONPRICETRACKER_API_KEY"); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}` };
const PSA_FLOOR = 79.99; // cheapest orderable PSA tier, Aug 2026 (Value paused)
const RAW_FRESH_DAYS = 3, SOLD_FRESH_DAYS = 7;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url) {
  let lastErr;
  for (let a = 0; a <= 3; a++) {
    if (a > 0) await sleep([2000, 8000, 20000][a - 1]);
    try {
      const res = await fetch(url, { headers: H });
      if (res.ok) return res.json();
      lastErr = new Error(String(res.status));
      if (res.status < 500 && res.status !== 429) throw lastErr;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const ageDays = ts => ts ? (Date.now() - new Date(ts)) / 86400000 : Infinity;
const grade = (g) => g ? { count: g.count ?? null, median: g.medianPrice ?? null, min: g.minPrice ?? null, max: g.maxPrice ?? null } : null;
const round2 = n => n == null ? null : Math.round(n * 100) / 100;

async function main() {
  const sp = JSON.parse(await readFile(join(DATA, "singles-prices.json"), "utf-8"));
  const confirmed = sp.cards.filter(c => c.cardId && c.needsReview === false);
  console.log(`enriching ${confirmed.length} confirmed printings…`);

  const out = [];
  let credits = 0;
  for (const c of confirmed) {
    await sleep(1100);
    try {
      // v3 lookup (2026-08-18): direct /prices?setId=&number= — name search
      // NEVER surfaces secret-rare printings (0/12 at limit 5 AND at limit 20,
      // 720 credits of evidence); the number-addressed endpoint is what the
      // verify gate already uses. pokemontcg setId passed as-is (same
      // assumption as verify-watchlist-prices.mjs — if PPT's setId space
      // differs, both fail together and loudly).
      const setId = c.cardId.split("-")[0];
      const d = await getJSON(`${BASE}/prices?setId=${encodeURIComponent(setId)}&number=${encodeURIComponent(c.number)}&includeEbay=true&includeHistory=true&days=30`);
      credits += d.metadata?.apiCallsConsumed?.total ?? 1;
      const hit = Array.isArray(d?.data) ? d.data[0] : d?.data ?? null;
      if (!hit) {
        out.push({ cardId: c.cardId, watchLabel: c.watchLabel, dataStatus: "no-match",
          note: `PPT /prices returned nothing for setId=${setId} number=${c.number}` });
        console.log(`  ${c.cardId.padEnd(12)} NO MATCH (/prices)`);
        continue;
      }
      const px = hit.prices || {};
      // 30d sales volume from history (sum of volume where present, NM condition)
      let vol30 = null;
      const nmHist = hit.priceHistory?.conditions?.["Near Mint"]?.history;
      if (Array.isArray(nmHist)) vol30 = nmHist.reduce((a, r) => a + (r.volume || 0), 0);
      const sbg = hit.ebay?.salesByGrade || {};
      const rawFresh = ageDays(px.lastUpdated) <= RAW_FRESH_DAYS;
      const soldFresh = ageDays(hit.ebay?.lastEbayCheck) <= SOLD_FRESH_DAYS;
      const psa10 = grade(sbg.psa10), psa9 = grade(sbg.psa9), psa8 = grade(sbg.psa8);
      const gpOk = rawFresh && soldFresh && px.market != null;
      out.push({
        cardId: c.cardId, watchLabel: c.watchLabel, name: hit.name, number: hit.cardNumber,
        pptSetName: hit.setName, tcgPlayerId: hit.tcgPlayerId ?? null,
        raw: {
          market: px.market ?? null, low: px.low ?? null,
          sellers: px.sellers ?? null, listings: px.listings ?? null,
          recentSales: px.recentSales ?? null, vol30,
          lastUpdated: px.lastUpdated ?? null,
          dataStatus: px.market == null ? "unavailable" : rawFresh ? "live" : "stale",
          provenance: `TCGplayer market via pokemonpricetracker, updated ${px.lastUpdated || "unknown"}`,
        },
        ebaySold: {
          psa8, psa9, psa10,
          lastEbayCheck: hit.ebay?.lastEbayCheck ?? null,
          dataStatus: !hit.ebay ? "unavailable" : soldFresh ? "live" : "stale",
          provenance: `eBay sold-by-grade via pokemonpricetracker, checked ${hit.ebay?.lastEbayCheck || "unknown"}`,
        },
        gradingPremium: {
          formula: `gradeMedian - rawMarket - ${PSA_FLOOR} (PSA cheapest tier, Aug 2026)`,
          psa10: gpOk && psa10?.median != null ? round2(psa10.median - px.market - PSA_FLOOR) : null,
          psa9: gpOk && psa9?.median != null ? round2(psa9.median - px.market - PSA_FLOOR) : null,
          dataStatus: gpOk ? "live" : "insufficient-freshness-or-price",
        },
      });
      console.log(`  ${c.cardId.padEnd(12)} raw $${px.market ?? "—"} · psa10 ${psa10?.median != null ? "$" + psa10.median : "—"} (n=${psa10?.count ?? "—"}) · vol30 ${vol30 ?? "—"}`);
    } catch (e) {
      out.push({ cardId: c.cardId, watchLabel: c.watchLabel, dataStatus: "error", note: e.message.slice(0, 100) });
      console.log(`  ${c.cardId.padEnd(12)} ERROR ${e.message}`);
    }
  }

  await writeFile(join(DATA, "singles-enrichment.json"), JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: "pokemonpricetracker.com v2 /cards (includeEbay + includeHistory)",
    citationRule: "INTERNAL INSTRUMENT ONLY — all PPT-derived numbers are licensing-gated (research/ppt-licensing-note.md). Raw-market and eBay-sold provenance are separate claims; never mix in one figure.",
    psaFloorUsd: PSA_FLOOR,
    creditsConsumed: credits,
    cards: out,
  }, null, 2) + "\n");
  console.log(`✓ data/singles-enrichment.json — ${out.length} cards, ~${credits} credits consumed`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
