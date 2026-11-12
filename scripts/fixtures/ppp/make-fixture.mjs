// Builds scripts/fixtures/ppp/reads-input.json: made-up rows in the exact
// PkmnPrices response shapes (openapi.json, 2026-11-12). Not real prices.
// Run: node scripts/fixtures/ppp/make-fixture.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ASOF = "2026-11-12";
const add = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

function comps(from, to, prices, extra = {}) {
  const out = [];
  let i = 0;
  for (let d = from; d <= to; d = add(d, 1)) {
    const price = prices[i % prices.length];
    out.push({ id: `${extra.tag || "c"}-${d}-${i}`, price, currency: "USD", sold_at: `${d}T18:00:00+00:00`, ingested_at: `${add(d, 1)}T03:00:00+00:00`, title: "made up", attribution: "exact", grader: null, grade: null, grade_qualifier: null, sale_type: "fixed_price", variant: extra.variant ?? "Holofoil", seller_country: "US", listing_url: null, updated_at: null, ...(extra.row || {}) });
    i += 1;
  }
  return out;
}

function volume(from, to, perDay, { graded = false, variant = "Holofoil" } = {}) {
  const out = [];
  let i = 0;
  for (let d = from; d <= to; d = add(d, 1)) {
    const sales = typeof perDay === "function" ? perDay(d, i) : perDay;
    out.push({ date: d, sales, priced_sales: sales, median: 40, graded, variant, currency: "USD" });
    i += 1;
  }
  return out;
}

function hist(from, to, priceOf, { currency = "USD", source = "tcgplayer", condition = "Near Mint", variant = "Holofoil" } = {}) {
  const out = [];
  let i = 0;
  for (let d = from; d <= to; d = add(d, 1)) {
    out.push({ date: d, avg: priceOf(d, i), high: null, low: null, currency, source, condition, variant });
    i += 1;
  }
  return out;
}

function pop(updated, total, gems, gemRate) {
  return { card_id: 1, variants: [{ variant: "Holofoil", total_population: total, total_gems: gems, gem_rate: gemRate, grades: { "9": total - gems, "10": gems }, pristine: 0, black_label: 0, authentic: 0, percent_higher: {}, graders: { PSA: { total: Math.round(total * 0.7), gems: Math.round(gems * 0.7), gem_rate: gemRate, grades: {}, pristine: null, black_label: null, authentic: 0, altered: null, qualified: 0, last_population_change: updated, pop_report_url: "https://www.psacard.com/pop", spec_id: "1", description: "made up" } }, last_population_change: updated, updated_at: `${updated}T21:00:00+00:00` }] };
}

export function fixtureDocs() {
  const start = add(ASOF, -100);
  const night1 = {
    kind: "ppp-reads-input",
    asOf: add(ASOF, -7),
    source: "fixture",
    items: {
      "tcgcsv-900001": { pppId: 1, kind: "single", printing: "Holofoil", population: pop(add(ASOF, -35), 2000, 140, 7) },
    },
  };
  const night2 = {
    kind: "ppp-reads-input",
    asOf: add(ASOF, -6),
    source: "fixture",
    items: {
      "tcgcsv-900001": { population: pop(add(ASOF, -7), 2100, 205, 9.76) },
      "tcgcsv-900002": { pppId: 2, kind: "single", printing: "Holofoil", population: pop(add(ASOF, -28), 400, 50, 12.5) },
    },
  };
  const tonight = {
    kind: "ppp-reads-input",
    asOf: ASOF,
    source: "fixture",
    items: {
      // Sold median well over the TCGplayer market, pace spike, pop growth.
      "tcgcsv-900001": {
        pppId: 1, kind: "single", printing: "Holofoil", volumeFrom: start,
        volume: volume(start, ASOF, (d) => (d > add(ASOF, -10) ? 3 : 0.5 > 0 ? (Number(d.slice(8)) % 2) : 0)),
        comps: [
          ...comps(add(ASOF, -13), ASOF, [60, 62, 58, 61]),
          ...comps(add(ASOF, -13), add(ASOF, -10), [20], { tag: "half" }),
          ...comps(add(ASOF, -13), ASOF, [40], { tag: "shared", row: { attribution: "shared" } }),
          ...comps(add(ASOF, -13), ASOF, [500], { tag: "slab", row: { grader: "PSA", grade: "10" } }),
          ...comps(add(ASOF, -41), add(ASOF, -28), [480], { tag: "slab0", row: { grader: "PSA", grade: "10" } }),
          ...comps(add(ASOF, -41), add(ASOF, -28), [40, 41, 39]),
        ],
        history: hist(add(ASOF, -365), ASOF, (d, i) => 30 + (i % 10)),
        population: pop(ASOF, 2300, 215, 9.35),
      },
      // Thin: only 3 comps, so no sold read.
      "tcgcsv-900002": { pppId: 2, kind: "single", printing: "Holofoil", comps: comps(add(ASOF, -2), ASOF, [80]), population: pop(ASOF, 410, 51, 12.44) },
      // Sealed: sold median against MSRP, sell-through rise.
      "tcgcsv-900003": {
        pppId: 3, kind: "sealed", volumeFrom: start,
        volume: volume(start, ASOF, (d) => (d > add(ASOF, -16) ? 2 : 1), { variant: null }),
        comps: [...comps(add(ASOF, -29), ASOF, [250, 255, 245], { variant: null }), ...comps(add(ASOF, -57), add(ASOF, -28), [200, 205], { variant: null, tag: "old" })],
        history: hist(add(ASOF, -60), ASOF, () => 900, { currency: "EUR", source: "cardmarket", condition: null, variant: null }),
      },
      // Cardmarket gap that moved; Japanese printing moving apart.
      "tcgcsv-900004": {
        pppId: 4, kind: "single", printing: "Holofoil",
        history: hist(add(ASOF, -60), ASOF, (d) => (d > add(ASOF, -20) ? 70 : 50), { currency: "EUR", source: "cardmarket", condition: null }),
        jp: { pppId: 40, history: hist(add(ASOF, -40), ASOF, (d, i) => 3000 + i * 40, { currency: "JPY", source: "tcgplayer", condition: null }) },
      },
    },
  };
  return [night1, night2, tonight];
}

// Own TCGplayer market days and listings counted for the same made-up ids.
export function fixtureCatalog() {
  const days = [];
  for (let i = 47; i >= 0; i -= 1) days.push(add(ASOF, -i));
  const own = {
    900001: (i) => 40 + (i > 40 ? 15 : 0), // jumps to 55 in the last week
    900002: (i) => (i >= 22 ? 80 : 60), // 60 until 26 days ago, then 80
    900003: () => 200,
    900004: (i) => 60,
  };
  return {
    asOf: ASOF,
    items: [
      { id: "tcgcsv-900001", tcgplayerProductId: 900001, name: "Madeup ex", set: "Fixture Set", kind: "single", printing: "Holofoil", printings: [{ name: "Holofoil" }], price: 55 },
      { id: "tcgcsv-900002", tcgplayerProductId: 900002, name: "Thin Card", set: "Fixture Set", kind: "single", printing: "Holofoil", printings: [{ name: "Holofoil" }], price: 80 },
      { id: "tcgcsv-900003", tcgplayerProductId: 900003, name: "Fixture Booster Box", set: "Fixture Set", kind: "sealed", printing: "Normal", printings: [{ name: "Normal" }], price: 200 },
      { id: "tcgcsv-900004", tcgplayerProductId: 900004, name: "Faraway Card", set: "Fixture Set", kind: "single", printing: "Holofoil", printings: [{ name: "Holofoil" }], price: 60 },
    ],
    daily: days.map((d, i) => ({ date: d, prices: Object.entries(own).map(([id, f]) => ({ id: Number(id), market: f(i), printing: id === "900003" ? "Normal" : "Holofoil" })) })),
    listings: days.map((d, i) => ({ date: d, rows: [{ id: "tcgcsv-900003", date: d, listingsCounted: i > 30 ? 20 : 40 }] })),
    msrp: { kind: "fixture", products: { "fx-bb": { name: "Fixture Booster Box", msrpUsd: 143.64, currency: "USD", sourceUrl: "https://example.com/sell-sheet", dateChecked: "2026-11-11", confidence: "high", tcgPlayerId: "900003", region: "US" } } },
    fx: days.map((d) => ({ date: d, usdPerEur: 1.1 })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL("./reads-input.json", import.meta.url), JSON.stringify(fixtureDocs()[2]) + "\n");
  console.log("wrote reads-input.json");
}
