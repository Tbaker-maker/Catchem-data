import { BANNED } from "../lib/public-bundle.mjs";
import {
  BOARD_MAX,
  PLAIN_CAP,
  STREAK_MIN,
  buildReadLibrary,
  daySpan,
  endStreak,
  explainRead,
} from "../lib/read-library.mjs";

function card(partial) {
  return {
    id: partial.id,
    sku: partial.sku,
    kind: "single",
    name: partial.name || "Pikachu",
    set: partial.set || "Base Set",
    headline: partial.headline,
    path: partial.path || partial.headline,
    price: partial.price,
    changePct: partial.changePct,
    windowDays: partial.windowDays,
    asOf: "2026-10-08",
    source: "TCGplayer market",
    href: `/c/${partial.sku}`,
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const pts = [["2026-10-05", 1], ["2026-10-06", 2], ["2026-10-07", 3], ["2026-10-08", 4]];
  t("three steps are not a 4-day streak", endStreak(pts).n === 3);
  t("a missing day breaks the streak", endStreak([["2026-10-05", 1], ["2026-10-06", 2], ["2026-10-08", 4]]).n === 0);
  const four = [["2026-10-04", 1], ["2026-10-05", 2], ["2026-10-06", 3], ["2026-10-07", 4], ["2026-10-08", 5]];
  t("four consecutive up steps qualify", endStreak(four).n === 4 && endStreak(four).dir === 1);
  t("a flat step ends the streak", endStreak([["2026-10-04", 1], ["2026-10-05", 2], ["2026-10-06", 2], ["2026-10-07", 3], ["2026-10-08", 4]]).n === 2);

  const catalogue = {
    asOf: "2026-10-08",
    source: "TCGplayer market",
    cards: {
      a: card({ id: "move-tcgcsv-1-7", sku: "tcgcsv-1", headline: "Pikachu is up 16.2% over 7 days, from $6.05 to $7.03.", price: 7.03, changePct: 16.2, windowDays: 7 }),
      b: card({ id: "move-tcgcsv-2-7", sku: "tcgcsv-2", name: "Dragonair", headline: "Dragonair is down 7.5% over 7 days, from $18.88 to $17.46.", price: 17.46, changePct: -7.5, windowDays: 7 }),
      c: card({ id: "move-tcgcsv-3-30", sku: "tcgcsv-3", name: "Pidgey", headline: "Pidgey hit a 6-month high: $2.66, up 72.7% in 30 days.", price: 2.66, changePct: 72.7, windowDays: 30 }),
      d: card({ id: "move-tcgcsv-3-90", sku: "tcgcsv-3", name: "Pidgey", headline: "Pidgey hit a 6-month high: $2.66, up 9.9% in 90 days.", price: 2.66, changePct: 9.9, windowDays: 90 }),
      e: card({ id: "move-tcgcsv-4-7", sku: "tcgcsv-4", name: "Oddish", headline: "Oddish is up 1% over 7 days, from $1.00 to $1.01.", price: 1.01, changePct: 1, windowDays: 7 }),
      f: card({ id: "move-tcgcsv-5-30", sku: "tcgcsv-5", name: "Abra", headline: "Abra hit a 6-month low: $1.10, down 9.1% in 30 days.", price: 1.1, changePct: -9.1, windowDays: 30 }),
      h: card({ id: "move-tcgcsv-11-7", sku: "tcgcsv-11", name: "Gastly", headline: "Gastly is up 40% over 7 days, from $1.00 to $1.40.", path: "Gastly latest price rose from $1.00 on Sep 27 to $1.40 on Oct 8, up 40%.", price: 1.4, changePct: 40, windowDays: 7 }),
      i: card({ id: "move-tcgcsv-12-90", sku: "tcgcsv-12", name: "Koffing", headline: "Koffing hit a 6-month high: $2.00, up 10% in 90 days.", path: "Koffing latest price rose from $1.80 on Jul 9 to $2.00 on Oct 8, up 10%.", price: 2, changePct: 10, windowDays: 90 }),
    },
  };
  const series = new Map([
    [1, new Map([["2026-10-01", 6.05], ["2026-10-08", 7.03]])],
    [2, new Map([["2026-10-01", 18.88], ["2026-10-08", 17.46]])],
    [3, new Map([["2026-04-01", 1], ["2026-07-10", 2.42], ["2026-09-08", 1.54], ["2026-10-08", 2.66]])],
    [4, new Map([["2026-10-01", 1], ["2026-10-08", 1.01]])],
    [5, new Map([["2026-04-01", 3], ["2026-09-08", 1.21], ["2026-10-08", 1.1]])],
    [9, new Map([["2026-10-01", 4.95], ["2026-10-04", 1], ["2026-10-05", 2], ["2026-10-06", 3], ["2026-10-07", 4], ["2026-10-08", 5]])],
    [11, new Map([["2026-09-27", 1], ["2026-10-08", 1.4]])],
    [12, new Map([["2026-04-01", 1], ["2026-07-09", 1.82], ["2026-10-08", 2]])],
  ]);
  catalogue.cards.g = card({ id: "move-tcgcsv-9-7", sku: "tcgcsv-9", name: "Mew", headline: "Mew is up 1% over 7 days.", price: 5, changePct: 1, windowDays: 7 });
  const extra = {
    lag: { reads: [], omitted: [{ set: "A" }], missingPrice: [{ set: "B" }, { set: "C" }] },
    group: { reads: [] },
  };
  const lib = buildReadLibrary({ catalogue, extra, series });
  t("mover qualified is one sku", lib.counts.mover.qualified === 1);
  t("a missing day inside the window drops the read", lib.counts.mover.droppedNoExactDay === 1 && !lib.board.some((row) => row.sku === "tcgcsv-11") && !lib.signals.some((row) => row.sku === "tcgcsv-11"));
  t("a high with no price on the exact day is dropped", lib.counts.high.qualified === 1 && !lib.board.some((row) => row.sku === "tcgcsv-12") && !lib.signals.some((row) => row.sku === "tcgcsv-12"));
  t("a boarded window starts exactly N days earlier", lib.board.filter((row) => row.signal === "mover" || row.signal === "plain" || row.signal === "high").every((row) => daySpan(row.startDate, row.endDate) === row.windowDays && row.endDate === "2026-10-08"));
  t("plain qualified skips the high and the low", lib.counts.plain.qualified === 3);
  t("high is one sku even when two windows say it", lib.counts.high.qualified === 1);
  t("low is counted and not boarded", lib.counts.low.qualified === 1 && lib.counts.low.boarded === 0);
  t("streak qualified from consecutive days", lib.counts.streak.qualified === 1 && lib.counts.streak.boarded === 1);
  t("set move stays out when the file has no read", lib.counts.set.qualified === 0 && lib.counts.set.boarded === 0);
  t("omitted and missing stay out of the set count", lib.counts.set.omitted === 1 && lib.counts.set.missingPrice === 2);
  t("board stays inside the cap", lib.board.length <= BOARD_MAX);
  t("plain takes at most two seats", lib.board.filter((row) => row.signal === "plain").length <= PLAIN_CAP);
  t("one sku is not boarded twice", new Set(lib.board.map((row) => row.sku)).size === lib.board.length);
  const streak = lib.board.find((row) => row.signal === "streak");
  t("streak sentence uses the series price", streak && streak.headline.includes("has risen 4 days running") && streak.headline.includes("$5.00") && streak.sku === "tcgcsv-9");
  t("signals chip rows are movers, set moves, highs, and streaks", lib.signals.every((row) => ["mover", "set", "high", "streak"].includes(row.signal)) && lib.signals.some((row) => row.signal === "mover") && !lib.signals.some((row) => row.signal === "plain"));
  const mover = lib.board.find((row) => row.signal === "mover");
  t("mover names the id and the 8% line", mover && mover.whyItMatters.includes("tcgcsv-1") && mover.whyItMatters.includes("at least 8%"));
  t("wrong line says a listing is not a sale", lib.board.every((row) => row.whatWouldMakeThisWrong.includes("listing is not a sale")));
  t("no banned word in a board line", lib.board.every((row) => !BANNED.test(row.headline) && !BANNED.test(row.whyItMatters) && !BANNED.test(row.whatWouldMakeThisWrong)));
  t("a 7.9% move is not a mover", explainRead(card({ id: "move-tcgcsv-8-7", sku: "tcgcsv-8", headline: "x", price: 10, changePct: 7.9, windowDays: 7 }), "mover") == null);
  t("streak minimum stays 4", STREAK_MIN === 4);

  const clash = new Map([[9, new Map([["2026-10-04", 1], ["2026-10-05", 2], ["2026-10-06", 3], ["2026-10-07", 4], ["2026-10-08", 9]])]]);
  const left = buildReadLibrary({ catalogue, extra, series: clash });
  t("a price that disagrees with the card is left out", left.counts.streak.qualified === 0 && left.disagreements.length === 1 && left.disagreements[0].cardPrice === 5 && left.disagreements[0].seriesPrice === 9);

  const lagRead = {
    id: "lag-base",
    sku: "tcgcsv-20",
    readKind: "lag",
    kind: "lag",
    name: "Base",
    set: "Base",
    headline: "Base loose packs moved and the booster box did not.",
    why: "Both series are on the row.",
    asOf: "2026-10-08",
    windowDays: 30,
    pack: { fromDate: "2026-09-08", toDate: "2026-10-08" },
    box: { fromDate: "2026-09-08", toDate: "2026-10-08" },
  };
  const lag = buildReadLibrary({
    catalogue,
    extra: { lag: { reads: [lagRead], omitted: [], missingPrice: [] }, group: { reads: [] } },
    series,
  });
  t("a lag read already on the file can board", lag.counts.set.qualified === 1 && lag.board.some((row) => row.signal === "set" && row.id === "lag-base" && row.startDate === "2026-09-08" && row.endDate === "2026-10-08"));
  const reached = buildReadLibrary({
    catalogue,
    extra: { lag: { reads: [{ ...lagRead, id: "lag-back", pack: { fromDate: "2026-09-06", toDate: "2026-10-08" }, box: { fromDate: "2026-09-06", toDate: "2026-10-08" } }], omitted: [], missingPrice: [] }, group: { reads: [] } },
    series,
  });
  t("a set move that reaches back to an earlier day is dropped", reached.counts.set.qualified === 0 && reached.counts.set.boarded === 0);
  return fail;
}
