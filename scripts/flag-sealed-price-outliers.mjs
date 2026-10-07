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
// Provisional label uses only file evidence (Browse total from sealed-prices
// priceHistory / buyout-tape when present, and heat-history listingCount):
//   listing crash (≥30% day-over-day drop) + price spike → possible real move
//   wild price + listings flat or up → possible bad listing
//   conflict → both labels (Tyler's lag rule — do not pick a winner)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** High flag: 50% off the product's own recent median. Soft: 40%. */
export const HIGH_GAP = 0.5;
export const SOFT_GAP = 0.4;
export const PRIOR_WINDOW = 7;
export const MIN_PRIORS = 3;
/** Day-over-day listing drop treated as a crash for the provisional label. */
export const LISTING_CRASH = 0.3;

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

function listingChange(now, before) {
  if (typeof now !== "number" || !Number.isFinite(now) || typeof before !== "number" || !Number.isFinite(before) || !(before > 0)) {
    return { pct: null, crash: false, flatOrUp: false };
  }
  const pct = (now - before) / before;
  return {
    pct,
    crash: pct <= -LISTING_CRASH,
    flatOrUp: pct >= -0.05,
  };
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
 * Provisional label from file evidence only.
 * Returns { label, reasons, conflict }.
 */
export function provisionalLabel({ gap, browse, heatListings }) {
  const reasons = [];
  const priceSpike = gap != null && gap >= HIGH_GAP;
  const priceDump = gap != null && gap <= -HIGH_GAP;
  const priceExtreme = priceSpike || priceDump;

  const browseCh = listingChange(browse?.today, browse?.prior);
  const heatCh = listingChange(heatListings?.today, heatListings?.prior);

  if (browseCh.pct != null) {
    reasons.push(`Browse total ${browse.prior} → ${browse.today} (${Math.round(browseCh.pct * 1000) / 10}%)`);
  } else {
    reasons.push("Browse total missing on this window — not invented");
  }
  if (heatCh.pct != null) {
    reasons.push(`heat-history listingCount (filtered page count, not solds) ${heatListings.prior} → ${heatListings.today} (${Math.round(heatCh.pct * 1000) / 10}%)`);
  }

  const realSignals = [];
  const fakeSignals = [];

  if (priceSpike && (browseCh.crash || heatCh.crash)) realSignals.push("price spike with listing crash");
  if (priceDump && (browseCh.crash || heatCh.crash)) realSignals.push("price dump with listing crash");

  if (priceExtreme && (browseCh.flatOrUp || (browseCh.pct == null && heatCh.flatOrUp))) {
    fakeSignals.push("wild price with listings flat or up");
  }
  if (priceExtreme && browseCh.pct == null && heatCh.pct == null) {
    fakeSignals.push("wild price with no listing change to read");
  }

  // Conflict: Browse and filtered listingCount disagree on crash vs flat.
  const listingConflict = browseCh.pct != null && heatCh.pct != null
    && ((browseCh.crash && heatCh.flatOrUp) || (heatCh.crash && browseCh.flatOrUp));

  if (listingConflict) {
    reasons.push("Browse total and filtered listingCount disagree — both labels kept");
    return {
      label: "review — possible bad listing; review — possible real move",
      reasons,
      conflict: true,
    };
  }

  if (realSignals.length && fakeSignals.length) {
    reasons.push(...realSignals, ...fakeSignals);
    return {
      label: "review — possible bad listing; review — possible real move",
      reasons,
      conflict: true,
    };
  }
  if (realSignals.length) {
    reasons.push(...realSignals);
    return { label: "review — possible real move", reasons, conflict: false };
  }
  if (fakeSignals.length || priceExtreme) {
    reasons.push(...(fakeSignals.length ? fakeSignals : ["wild price without a matching listing crash"]));
    return { label: "review — possible bad listing", reasons, conflict: false };
  }
  return { label: "review — possible bad listing", reasons, conflict: false };
}

export function evaluateProduct({ id, name, subtype, heatRows, product, asOf, tapeRow }) {
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

  const label = provisionalLabel({
    gap: win.gap,
    browse: { today: browseToday, prior: browsePrior },
    heatListings: { today: win.todayListingCount, prior: win.priorListingCount },
  });

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
    listingCountNote: "heat-history listingCount is the filtered page count, not Browse total, not solds",
    browseTotal: browseToday,
    browseTotalPrior: browsePrior,
    provisionalLabel: label.label,
    evidence: label.reasons,
    conflict: label.conflict,
  };
}

export function flagSealedPriceOutliers({ heatHistory, sealedPrices, buyoutTape, asOf = "" } = {}) {
  const heatRows = Array.isArray(heatHistory) ? heatHistory : [];
  const products = Array.isArray(sealedPrices?.products) ? sealedPrices.products : [];
  const byProduct = new Map(products.map((p) => [p.id, p]));
  const tapeRows = Array.isArray(buyoutTape?.rows) ? buyoutTape.rows : [];
  const byTape = new Map(tapeRows.map((r) => [r.id, r]));

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
      sealedPricesUpdatedAt: sealedPrices?.updatedAt || null,
    },
    rule: {
      highGap: HIGH_GAP,
      softGap: SOFT_GAP,
      priorWindow: PRIOR_WINDOW,
      minPriors: MIN_PRIORS,
      listingCrash: LISTING_CRASH,
      note: "HIGH when |today − median(last ≤7 prior heat-history prices)| / median ≥ 50%. SOFT at ≥40% and <50%. Conservative default (flag fewer). Packs skipped. Missing history → no flag. Do not invent prices or solds.",
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

export async function writeSealedPriceOutliers({ root = ROOT, asOf = "" } = {}) {
  const heatHistory = await readJson(join(root, "data/heat-history.json")).catch(() => []);
  const sealedPrices = await readJson(join(root, "data/sealed-prices.json")).catch(() => ({ products: [] }));
  const buyoutTape = await readJson(join(root, "data/buyout-tape.json")).catch(() => ({ rows: [] }));
  const report = flagSealedPriceOutliers({ heatHistory, sealedPrices, buyoutTape, asOf });

  const outDir = join(root, "data/derived");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "sealed-price-outliers.json");
  await writeFile(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  // Desk already reads buyout-tape; attach a pointer without changing browse levels.
  try {
    const tape = { ...buyoutTape };
    tape.priceOutlierFile = "data/derived/sealed-price-outliers.json";
    tape.priceOutlierPolicy = `high≥${HIGH_GAP * 100}% soft≥${SOFT_GAP * 100}% vs median of last ≤${PRIOR_WINDOW} prior heat-history prices (min ${MIN_PRIORS}); packs skipped; missing history → no flag`;
    tape.priceOutlierAsOf = report.asOf;
    tape.priceOutlierHighCount = report.highCount;
    tape.priceOutlierSoftCount = report.softCount;
    // Keep browse levelPolicy unscored — that lane still has no cutoff.
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
