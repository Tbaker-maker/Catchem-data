// New types stay behind reads.library. The switch is off, so take is not called
// on the nightly board. Existing board types are not in this list.

import { checkDetector } from "./shape.mjs";
import { sealedVsChase } from "./sealed-vs-chase.mjs";
import { groupLag } from "./group-lag.mjs";
import { setHeat } from "./set-heat.mjs";
import { listingTrend } from "./listing-trend.mjs";
import { attachRotation } from "./rotation-note.mjs";
import { firstWeek } from "./first-week.mjs";

function slot(det) {
  return checkDetector({ status: "behind-reads.library", gate: "reads.library", ...det });
}

function kept(rows) {
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

export const SLOTS = [
  slot({
    id: "supply",
    inputs: ["data/supply-watch.json"],
    rule: "Listing counts. Not sales. Flag supply.leadReads is already off.",
    minimums: { publish: false },
    copy: "No sentence until RD rules KEEP.",
    take: () => [],
    wrongIf: "A slot that returns a row before RD rules KEEP.",
  }),
  slot({
    id: "sealed-vs-singles",
    inputs: ["data/sealed-products.json", "tcgcsv daily series"],
    rule: "Sealed against the singles in the same set. Needs an RD rule.",
    minimums: { publish: false },
    copy: "No sentence until RD rules KEEP.",
    take: () => [],
    wrongIf: "A slot that returns a row before RD rules KEEP.",
  }),
  slot({
    id: "sealed-vs-chase",
    inputs: ["exact 7-day TCGplayer pair"],
    rule: "One side clears $1 and 3%. The other does not.",
    minimums: { dollars: 1, pct: 3, days: 7 },
    copy: "Name the side, both prices, both dates.",
    take(_lib, ctx) {
      return kept(ctx?.sealedPairs).map((pair) => sealedVsChase(pair)).filter(Boolean);
    },
    wrongIf: "Both sides clear, or a price or a date is missing.",
  }),
  slot({
    id: "group-lag",
    inputs: ["same era", "same kind", "exact 7-day pair"],
    rule: "At least 5 ids up. Name at most 8 flat ids.",
    minimums: { up: 5, flatMax: 8, pct: 8, dollars: 1, days: 7 },
    copy: "Dollars first. No padding.",
    take(_lib, ctx) {
      return kept(ctx?.groups).map((group) => groupLag(group.members, group)).filter(Boolean);
    },
    wrongIf: "Fewer than 5 ids are up, or a flat id is named past 8.",
  }),
  slot({
    id: "set-heat",
    inputs: ["priced cards in one set", "exact 7-day pair"],
    rule: "At least 5 cards moved at least 8% and at least $1.",
    minimums: { n: 5, pct: 8, dollars: 1, days: 7 },
    copy: "{n} of {priced} priced cards in {set}.",
    take(_lib, ctx) {
      return kept(ctx?.setHeats).map((row) => setHeat(row.cards, row)).filter(Boolean);
    },
    wrongIf: "Fewer than 5 cards cleared, or a day file is missing.",
  }),
  slot({
    id: "listing",
    inputs: ["filteredTotal", "exact 7-day pair"],
    rule: "Start at least 40. Move at least 15 and 20%. Skip 17 combinedArts parents.",
    minimums: { start: 40, move: 15, pct: 20, days: 7, parents: 17 },
    copy: "eBay listings {n} to {n} ({Mon D} to {Mon D}).",
    take(_lib, ctx) {
      return kept(ctx?.listings).map((row) => listingTrend(row)).filter(Boolean);
    },
    wrongIf: "The start is under 40, the move is under 15, or the id is a combined-art parent.",
  }),
  slot({
    id: "rotation",
    inputs: ["research/assets/public/rotation-status.json"],
    rule: "A line only on a qualified read whose set mark is F or G.",
    minimums: { marks: ["F", "G"] },
    copy: "Marked {mark} on the rotation list.",
    take(lib, ctx) {
      if (!ctx?.rotation) return [];
      return kept(lib?.board).map((row) => attachRotation(row, ctx.rotation)).filter((row) => row && row.rotation);
    },
    wrongIf: "The set is not F or G, or the read did not qualify.",
  }),
  slot({
    id: "release",
    inputs: ["releases.json", "first two daily prices"],
    rule: "A verified release and its first two daily prices.",
    minimums: { prices: 2, verified: true },
    copy: "Dollars first. A missing day is no read.",
    take(_lib, ctx) {
      return kept(ctx?.releases).map((row) => firstWeek(row.release, row.prices, ctx.dailyFiles)).filter(Boolean);
    },
    wrongIf: "The release is not verified, or a daily price is missing.",
  }),
];
