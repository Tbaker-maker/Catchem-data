// distil-enrichment.mjs — turn the raw enrichment payload into something the
// repo can hold and the instruments can read.
//
// The raw response is 166 MB for 861 cards, because each card carries 180 days
// of history across five conditions. At catalogue scale that is roughly 3 GB —
// not committable, not loadable, and git history is forever, so committing it
// once is committing it permanently. It is also entirely regenerable from the
// API, which makes it exactly the kind of file that belongs in .gitignore.
//
// What the instruments actually need is much smaller:
//   - compute-demand reads raw.vol30 / raw.listings / raw.sellers
//   - the theses (RT-1, RT-3, RT-7) need RETURNS over windows, not the tape
// So this keeps the per-card facts and the derived windows, and throws the
// day-by-day series away. If a thesis later needs the raw series, the raw file
// regenerates in one run.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data/enrichment-by-set.json");

// Return over a window, from the NM daily series. Null rather than a guess when
// the window is longer than the tape we hold — a card from a set released two
// months ago has no 180-day return, and inventing one is the whole failure mode
// the Trust Standard exists to stop.
// `tol` exists because we ask for 180 days and the provider sends 179 points.
// An exact-window return then needs a 181st point that never arrives, so the
// six-month figure came back null on 100% of cards while the tape sitting right
// there was one day short. Allowing a small shortfall — and REPORTING the span
// actually used — is the difference between "no six-month return exists" and
// "here is the 179-day return". Beyond the tolerance it still returns null:
// a card whose set is two months old has no six-month return, and inventing one
// is the failure the Trust Standard exists to stop.
function ret(series, days, tol = 0) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const last = series[series.length - 1];
  const span = Math.min(days, series.length - 1);
  if (days - span > tol) return null;
  const then = series[series.length - 1 - span];
  if (!then?.market || !last?.market) return null;
  return { pct: Math.round(((last.market / then.market) - 1) * 1000) / 10, days: span };
}

export async function distil() {
  const raw = JSON.parse(await readFile(RAW, "utf-8"));
  const cards = [];
  for (const [id, c] of Object.entries(raw.byCard || {})) {
    const px = c.prices || {};
    const nm = c.priceHistory?.conditions?.["Near Mint"]?.history;
    const vol30 = Array.isArray(nm)
      ? nm.slice(-30).reduce((a, r) => a + (r.volume || 0), 0) : null;
    const conditions = Object.keys(c.priceHistory?.conditions || {});
    cards.push({
      cardId: c.id || id, tcgPlayerId: c.tcgPlayerId ?? null,
      name: c.name, number: c.cardNumber ?? null, setName: c.setName ?? null,
      raw: {
        market: px.market ?? null, low: px.low ?? null,
        sellers: px.sellers ?? null, listings: px.listings ?? null,
        recentSales: px.recentSales ?? null, vol30,
        lastUpdated: px.lastUpdated ?? null,
        provenance: "TCGplayer via pokemonpricetracker, condition-split",
      },
      // Condition ladder, current values only — the reason we paid for history.
      conditions: Object.fromEntries(Object.entries(px.variants || {}).flatMap(([printing, byCond]) =>
        Object.entries(byCond).map(([cond, v]) => [`${printing} / ${cond}`, v?.price ?? null]))),
      conditionsTracked: conditions,
      history: (() => {
        const r30 = ret(nm, 30), r90 = ret(nm, 90, 5), r180 = ret(nm, 180, 15);
        return { days: Array.isArray(nm) ? nm.length : 0,
          ret30: r30?.pct ?? null, ret30Days: r30?.days ?? null,
          ret90: r90?.pct ?? null, ret90Days: r90?.days ?? null,
          ret180: r180?.pct ?? null, ret180Days: r180?.days ?? null };
      })(),
      ebaySold: c.ebay?.salesByGrade ?? null,
    });
  }
  return { generatedAt: new Date().toISOString(),
    source: "distilled from data/enrichment-by-set.json (raw is gitignored, regenerable)",
    creditsSpent: raw.creditsSpent ?? null, cardCount: cards.length, cards };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = await distil();
  const path = join(ROOT, "data/enrichment-distilled.json");
  await writeFile(path, JSON.stringify(out, null, 1) + "\n");
  const { size } = await import("node:fs").then(m => m.promises.stat(path));
  console.log(`✓ distilled ${out.cardCount.toLocaleString("en-US")} cards → ${(size / 1048576).toFixed(1)} MB`);
  const withRet = out.cards.filter(c => c.history.ret30 != null).length;
  const withVol = out.cards.filter(c => c.raw.vol30 != null).length;
  const withLadder = out.cards.filter(c => Object.keys(c.conditions).length > 1).length;
  console.log(`  30-day return: ${withRet} · vol30: ${withVol} · condition ladder: ${withLadder}`);
}
