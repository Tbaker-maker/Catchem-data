// Flag sealed ask prices that sit way too high or way too low vs the product's
// own recent heat-history. Desk review list — not a sold count, not a fill.
//
// CUTOFF RULE (conservative default — flag fewer, more extreme; Tyler can tighten):
//   HIGH: |today − median(last ≤7 prior dated heat-history prices)| / median ≥ 50%
//   SOFT: same window, gap ≥ 40% and < 50% (matches IMPLAUSIBLE_DELTA / correction-hunter)
//   Need ≥3 prior positive prices. Missing history or no today's price → no flag.
//   Packs (subtype booster-pack / id ending -pack) are skipped — buyout desk already
//   records skippedPacks and does not score that lane.
//   Browse total null is left null; listingCount is the filtered page count, never
//   solds, never copied into Browse total.
//
// Provisional label compares the eBay ask to the TCGplayer price for the same id.
//   TCGplayer stayed flat (under 15%, the same band as The Spread) while the
//   eBay median jumped → "likely bad listing" (kept out of Flagged reads)
//   both moved the same way → "possible real move" (the only Flagged read)
//   they moved opposite ways, or the TCGplayer series is missing or held → "review"
// A held id (cover variant, no TCGplayer id, not on the id map) is not the same product.
// listingCount is the filtered page count. It is not used for this label.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCrosscheck } from "./lib/ppt-paths.mjs";
import { loadMarketHistory } from "./lib/market-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** High flag: 50% off the product's own recent median. Soft: 40%. */
export const HIGH_GAP = 0.5;
export const SOFT_GAP = 0.4;
export const PRIOR_WINDOW = 7;
export const MIN_PRIORS = 3;
/** TCGplayer move has to clear this before it counts. Same 15% as The Spread. */
export const TCG_MOVE = 0.15;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value) {
  return typeof value === "string" && DAY_RE.test(value);
}

export function median(values) {
  const s = values.filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}

export function isPack(product) {
  if (!product) return false;
  if (product.subtype === "booster-pack") return true;
  const id = typeof product.id === "string" ? product.id : "";
  return /-pack$/.test(id);
}

export function pctGap(today, ref) {
  if (!(typeof today === "number" && today > 0 && typeof ref === "number" && ref > 0)) return null;
  return (today - ref) / ref;
}

/**
 * Build dated price points for one id from heat-history rows.
 * Only positive numeric prices. Sorted by date ascending.
 */
export function seriesFor(id, heatRows) {
  const out = [];
  for (const row of heatRows || []) {
    if (row?.id !== id) continue;
    if (!isDay(row.date)) continue;
    if (typeof row.price !== "number" || !(row.price > 0)) continue;
    out.push({
      date: row.date,
      price: row.price,
      listingCount: typeof row.listingCount === "number" && Number.isFinite(row.listingCount) ? row.listingCount : null,
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/**
 * Reference = median of up to PRIOR_WINDOW prior points (need MIN_PRIORS).
 * asOf picks the "today" row: the latest point on asOf, else the latest point overall
 * when asOf is omitted. Points on asOf are not part of the reference window.
 */
export function referenceWindow(series, asOf = "") {
  if (!Array.isArray(series) || !series.length) return null;
  let todayIdx = -1;
  if (isDay(asOf)) {
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (series[i].date === asOf) { todayIdx = i; break; }
    }
    if (todayIdx < 0) return null;
  } else {
    todayIdx = series.length - 1;
  }
  const today = series[todayIdx];
  const prior = series.slice(0, todayIdx).slice(-PRIOR_WINDOW);
  if (prior.length < MIN_PRIORS) return null;
  const ref = median(prior.map((p) => p.price));
  if (ref == null) return null;
  const gap = pctGap(today.price, ref);
  if (gap == null) return null;
  return {
    todayPrice: today.price,
    todayDate: today.date,
    todayListingCount: today.listingCount,
    priorListingCount: prior[prior.length - 1].listingCount,
    referencePrice: ref,
    priorCount: prior.length,
    priorFrom: prior[0].date,
    priorTo: prior[prior.length - 1].date,
    gap,
  };
}

export function severityFor(gap) {
  if (gap == null || !Number.isFinite(gap)) return null;
  const abs = Math.abs(gap);
  if (abs >= HIGH_GAP) return "high";
  if (abs >= SOFT_GAP) return "soft";
  return null;
}

/**
 * Browse totals from sealed-prices priceHistory[].total when present.
 * Never invent. Never treat listingCount as Browse total.
 */
export function browseTotalsFromHistory(product, todayDate) {
  const hist = Array.isArray(product?.priceHistory) ? product.priceHistory : [];
  const byDate = new Map();
  for (const row of hist) {
    if (!isDay(row?.date)) continue;
    if (typeof row.total === "number" && Number.isFinite(row.total)) byDate.set(row.date, row.total);
  }
  const today = byDate.get(todayDate);
  if (today == null) return { today: null, prior: null };
  const dates = [...byDate.keys()].filter((d) => d < todayDate).sort();
  const priorDate = dates.at(-1);
  return { today, prior: priorDate ? byDate.get(priorDate) : null, priorDate: priorDate || null };
}

/**
 * Review label from the eBay median gap and the TCGplayer gap for the same id.
 * hold is a reason the TCGplayer series is not this product. A null tcg gap
 * means no series was on file — the label stays "review" and nothing is invented.
 */
export function reviewLabel({ ebayGap, tcgGap, hold = "" } = {}) {
  if (hold) return { label: "review", conflict: true, why: hold };
  if (typeof ebayGap !== "number" || !Number.isFinite(ebayGap) || typeof tcgGap !== "number" || !Number.isFinite(tcgGap)) {
    return { label: "review", conflict: false, why: "No TCGplayer price for this id on the window — not invented" };
  }
  const tcgSign = Math.abs(tcgGap) < TCG_MOVE ? 0 : Math.sign(tcgGap);
  const ebaySign = Math.sign(ebayGap);
  if (tcgSign === 0) {
    return { label: "likely bad listing", conflict: false, why: "TCGplayer price stayed flat while the eBay median jumped" };
  }
  if (tcgSign === ebaySign) {
    return { label: "possible real move", conflict: false, why: "TCGplayer price and the eBay median moved the same way" };
  }
  return { label: "review", conflict: true, why: "TCGplayer price and the eBay median moved opposite ways" };
}

/** Last point vs the median of up to PRIOR_WINDOW earlier points. Same id only. */
export function tcgWindowGap(points, todayDate) {
  const byDate = new Map();
  for (const row of points || []) {
    if (!isDay(row?.date) || (todayDate && row.date > todayDate)) continue;
    if (typeof row.tcgMarket !== "number" || !(row.tcgMarket > 0)) continue;
    byDate.set(row.date, row.tcgMarket);
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length < 2) return null;
  const today = dates[dates.length - 1];
  const priorDates = dates.slice(0, -1).slice(-PRIOR_WINDOW);
  if (!priorDates.length) return null;
  const ref = median(priorDates.map((day) => byDate.get(day)));
  const now = byDate.get(today);
  const gap = pctGap(now, ref);
  if (gap == null || ref == null) return null;
  return {
    today,
    now,
    ref: Math.round(ref * 100) / 100,
    gap,
    priorFrom: priorDates[0],
    priorTo: priorDates[priorDates.length - 1],
  };
}

/** Unmatched ids are not the same product. A cover variant or a missing id stays out. */
export function tcgHoldReason(id, unmatchedProducts) {
  const row = (unmatchedProducts || []).find((item) => item && item.id === id);
  if (!row) return "";
  const reason = String(row.reason || "").trim();
  if (!reason) return "";
  if (/cover variant|no TCGplayer id|held out of the id map|not high confidence/i.test(reason)) return reason;
  return "";
}

/**
 * Provisional label from the eBay gap and the TCGplayer series for this id.
 * Returns { label, reasons, conflict }.
 */
export function provisionalLabel({ gap, tcg, hold = "" }) {
  const reasons = [];
  const decision = reviewLabel({ ebayGap: gap, tcgGap: tcg?.gap, hold });
  if (gap != null && Number.isFinite(gap)) {
    reasons.push(`eBay ask vs its recent median ${gap > 0 ? "+" : ""}${Math.round(gap * 1000) / 10}%`);
  }
  if (hold) reasons.push(`TCGplayer series not used: ${hold}`);
  else if (tcg && tcg.gap != null) {
    reasons.push(`TCGplayer ${tcg.ref} → ${tcg.now} (${tcg.gap > 0 ? "+" : ""}${Math.round(tcg.gap * 1000) / 10}%)`);
    reasons.push(decision.why);
  } else {
    reasons.push("No TCGplayer price for this id on the window — not invented");
  }
  return { label: decision.label, reasons, conflict: decision.conflict };
}

export function evaluateProduct({ id, name, subtype, heatRows, product, asOf, tapeRow, tcgPoints, hold = "" }) {
  if (isPack({ id, subtype })) return null;
  const series = seriesFor(id, heatRows);
  const win = referenceWindow(series, asOf);
  if (!win) return null;
  const sev = severityFor(win.gap);
  if (!sev) return null;

  const browseFromHist = browseTotalsFromHistory(product, win.todayDate);
  // Prefer sealed-prices priceHistory totals; fall back to buyout-tape when present.
  let browseToday = browseFromHist.today;
  let browsePrior = browseFromHist.prior;
  if (browseToday == null && typeof tapeRow?.browseTotalNow === "number") browseToday = tapeRow.browseTotalNow;
  if (browsePrior == null && typeof tapeRow?.browseTotalBefore === "number") browsePrior = tapeRow.browseTotalBefore;

  const tcg = hold ? null : tcgWindowGap(tcgPoints, win.todayDate);
  const label = provisionalLabel({ gap: win.gap, tcg, hold });

  return {
    id,
    name: name || product?.name || id,
    subtype: subtype || product?.subtype || null,
    severity: sev,
    direction: win.gap > 0 ? "high" : "low",
    todayDate: win.todayDate,
    todayPrice: win.todayPrice,
    referencePrice: Math.round(win.referencePrice * 100) / 100,
    referenceWindow: {
      priorCount: win.priorCount,
      from: win.priorFrom,
      to: win.priorTo,
      rule: `median of last ${win.priorCount} prior heat-history prices (window ≤${PRIOR_WINDOW}, min ${MIN_PRIORS})`,
    },
    pctGap: Math.round(win.gap * 1000) / 10,
    listingCount: win.todayListingCount,
    listingCountPrior: win.priorListingCount,
    listingCountNote: "heat-history listingCount is the filtered page count, not Browse total, not solds, and not the review label",
    browseTotal: browseToday,
    browseTotalPrior: browsePrior,
    tcgNow: tcg ? tcg.now : null,
    tcgReference: tcg ? tcg.ref : null,
    tcgPct: tcg ? Math.round(tcg.gap * 1000) / 10 : null,
    tcgAsOf: tcg ? tcg.today : null,
    provisionalLabel: label.label,
    evidence: label.reasons,
    conflict: label.conflict,
  };
}

export function flagSealedPriceOutliers({ heatHistory, sealedPrices, buyoutTape, tcgById = null, unmatched = [], asOf = "" } = {}) {
  const heatRows = Array.isArray(heatHistory) ? heatHistory : [];
  const products = Array.isArray(sealedPrices?.products) ? sealedPrices.products : [];
  const byProduct = new Map(products.map((p) => [p.id, p]));
  const tapeRows = Array.isArray(buyoutTape?.rows) ? buyoutTape.rows : [];
  const byTape = new Map(tapeRows.map((r) => [r.id, r]));
  const tcg = tcgById instanceof Map ? tcgById : new Map();

  const dates = [...new Set(heatRows.map((r) => r.date).filter(isDay))].sort();
  const day = isDay(asOf) ? asOf : (dates.at(-1) || "");
  const ids = [...new Set(heatRows.map((r) => r.id).filter(Boolean))].sort();

  let skippedPacks = 0;
  let skippedNoHistory = 0;
  const high = [];
  const soft = [];

  for (const id of ids) {
    const product = byProduct.get(id) || { id };
    if (isPack(product) || isPack({ id })) {
      skippedPacks += 1;
      continue;
    }
    const row = evaluateProduct({
      id,
      name: product.name,
      subtype: product.subtype,
      heatRows,
      product,
      asOf: day,
      tapeRow: byTape.get(id),
      tcgPoints: tcg.get(id) || [],
      hold: tcgHoldReason(id, unmatched),
    });
    if (!row) {
      skippedNoHistory += 1;
      continue;
    }
    if (row.severity === "high") high.push(row);
    else soft.push(row);
  }

  high.sort((a, b) => Math.abs(b.pctGap) - Math.abs(a.pctGap));
  soft.sort((a, b) => Math.abs(b.pctGap) - Math.abs(a.pctGap));

  return {
    generatedAt: new Date().toISOString(),
    asOf: day || null,
    source: {
      heatHistory: "data/heat-history.json",
      sealedPrices: "data/sealed-prices.json",
      buyoutTape: "data/buyout-tape.json",
      tcgplayer: "TCGplayer market for the same id only (crosscheck history or data/history/tcgplayer-market). A held id is not used.",
      sealedPricesUpdatedAt: sealedPrices?.updatedAt || null,
    },
    rule: {
      highGap: HIGH_GAP,
      softGap: SOFT_GAP,
      priorWindow: PRIOR_WINDOW,
      minPriors: MIN_PRIORS,
      tcgMove: TCG_MOVE,
      note: "HIGH when |today − median(last ≤7 prior heat-history prices)| / median ≥ 50%. SOFT at ≥40% and <50%. Review label: TCGplayer flat while the eBay median jumped → likely bad listing. Both moved the same way → possible real move. Opposite moves, a missing series, or a held id → review. Only possible real move is a Flagged read. Packs skipped. Do not invent prices.",
    },
    skippedPacks,
    skippedNoFlag: skippedNoHistory,
    highCount: high.length,
    softCount: soft.length,
    high,
    soft,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

/** Points whose id field is the sealed id. No name matching. */
export async function loadTcgById(root) {
  const byId = new Map();
  const add = (id, date, market) => {
    if (!id || !isDay(date) || typeof market !== "number" || !(market > 0)) return;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push({ id, date, tcgMarket: market });
  };
  const history = await readCrosscheck(root, "crosscheck-history.json");
  const rows = Array.isArray(history) ? history : (history?.rows || []);
  for (const row of rows) add(row?.id, row?.date, row?.tcgMarket);
  try {
    const market = await loadMarketHistory(root);
    for (const [id, pts] of market.merged) {
      for (const point of pts) add(id, point.date, point.market);
    }
  } catch { /* market history optional */ }
  return byId;
}

export async function writeSealedPriceOutliers({ root = ROOT, asOf = "" } = {}) {
  const heatHistory = await readJson(join(root, "data/heat-history.json")).catch(() => []);
  const sealedPrices = await readJson(join(root, "data/sealed-prices.json")).catch(() => ({ products: [] }));
  const buyoutTape = await readJson(join(root, "data/buyout-tape.json")).catch(() => ({ rows: [] }));
  const unmatchedDoc = await readJson(join(root, "data/history/tcgplayer-market/unmatched.json")).catch(() => ({ products: [] }));
  const tcgById = await loadTcgById(root);
  const report = flagSealedPriceOutliers({
    heatHistory,
    sealedPrices,
    buyoutTape,
    tcgById,
    unmatched: unmatchedDoc?.products || [],
    asOf,
  });

  const outDir = join(root, "data/derived");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "sealed-price-outliers.json");
  await writeFile(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  // Pointer only. Do not rescore browse levels here.
  try {
    const tape = { ...buyoutTape };
    tape.priceOutlierFile = "data/derived/sealed-price-outliers.json";
    tape.priceOutlierPolicy = `high≥${HIGH_GAP * 100}% soft≥${SOFT_GAP * 100}% vs median of last ≤${PRIOR_WINDOW} prior heat-history prices (min ${MIN_PRIORS}); TCGplayer flat → likely bad listing; same direction → possible real move; otherwise review; packs skipped`;
    tape.priceOutlierAsOf = report.asOf;
    tape.priceOutlierHighCount = report.highCount;
    tape.priceOutlierSoftCount = report.softCount;
    await writeFile(join(root, "data/buyout-tape.json"), JSON.stringify(tape, null, 2) + "\n", "utf8");
  } catch {
    /* buyout-tape optional */
  }

  return { path: outPath, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const asOf = process.argv.includes("--asOf") ? process.argv[process.argv.indexOf("--asOf") + 1] : "";
  const { path, report } = await writeSealedPriceOutliers({ asOf: asOf || "" });
  console.log(`sealed-price outliers → ${path} asOf ${report.asOf}: high ${report.highCount}, soft ${report.softCount}, packs skipped ${report.skippedPacks}`);
  for (const row of report.high) {
    console.log(`  HIGH ${row.pctGap > 0 ? "+" : ""}${row.pctGap}%  ${row.id}  $${row.todayPrice} vs ref $${row.referencePrice}  ${row.provisionalLabel}`);
  }
  for (const row of report.soft) {
    console.log(`  SOFT ${row.pctGap > 0 ? "+" : ""}${row.pctGap}%  ${row.id}  $${row.todayPrice} vs ref $${row.referencePrice}  ${row.provisionalLabel}`);
  }
}
